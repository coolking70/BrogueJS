/** Merge three same-runner shards. Never compare timings between runners.
 * node scripts/merge-ext-perf-ab.mjs NEW_OUT CLASSIC_DIR ALL_FULL_DIR ALL_PREFIX_DIR
 * Raw artifacts are copied into the portable aggregate; failures still publish.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,cpSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {hash,write} from './ext-perf-common.mjs';
import {comparablePrefix,pendingPerfBaseline,perfIdentity} from './ext-perf-selection.mjs';
import {parseOptions,kindsFor,validateRun,withObjectiveP99,evaluateGates,overallStatus,policyVersion,timingPolicy} from './ext-perf-ab-policy.mjs';

const [output,...inputs]=process.argv.slice(2);
assert.ok(output&&inputs.length===3,'Expected NEW_OUT CLASSIC_DIR ALL_FULL_DIR ALL_PREFIX_DIR');
if(inputs.every(path=>JSON.parse(readFileSync(resolve(path,'result.json'),'utf8')).identity==='party-v1')){const {mergePartyAb}=await import('./merge-party-perf-ab.mjs');mergePartyAb(output,inputs);process.exit(0);}
const out=resolve(output),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(!existsSync(out),'Use a fresh output directory; never overwrite evidence');
for(const input of inputs){const p=relative(resolve(input),out);assert.ok(p==='..'||p.startsWith('../'),'Output must be outside input artifacts');}
mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const names=['classic','all-full','all-prefix'];
const result={version:2,status:'running',hard:'pending',policyVersion,policy:timingPolicy,shards:[],runs:[],gates:[],steps:[],startedAt:new Date().toISOString()};
const cli=(label,script,args)=>{
 const log=execFileSync(process.execPath,[resolve(root,'scripts',script),...args],{cwd:root,encoding:'utf8'});
 writeFileSync(resolve(out,label+'.log'),log);result.steps.push({label,status:'pass'});
};
try {
 const metrics=read(resolve(root,'scripts/ext-perf-budget.json')).metrics;
 const observer=hash(['profile-ext-perf.mjs','ext-perf-common.mjs'].map(n=>readFileSync(resolve(root,'scripts',n),'utf8')).join('\0'));
 const first=new Map(),contracts={},sources={},dirs={},invocations=new Set();
 let reference;
 for(const [i,name]of names.entries()){
  const dir=resolve(out,'shards',name);cpSync(resolve(inputs[i]),dir,{recursive:true});dirs[name]=dir;
  const original=read(resolve(dir,'result.json')),options=original.options;
  assert.equal(options.shard,name,'Wrong/duplicate shard');
  assert.deepEqual(options.cases,name==='classic'?['classic']:['all']);
  const parsed=parseOptions(['--base',options.base,'--head',options.head,'--out',options.out,'--rounds',String(options.rounds),'--limit',String(options.limit),'--base-identity',options.baseIdentity,'--head-identity',options.headIdentity,'--shard',name]);
  assert.deepEqual(options,parsed,'Invalid shard options');
  assert.equal(original.hard,'pass','Failed/incomplete shard hard gate');
  assert.ok(['incomplete','regression'].includes(original.status)&&original.finishedAt,'Unfinished shard');
  assert.ok(original.steps.length&&original.steps.every(s=>s.status==='pass'),'Failed/unfinished shard step');
  assert.equal(original.policyVersion,policyVersion);assert.equal(original.policy,timingPolicy);
  assert.equal(original.instrumentationHash,observer,'Observer drift');
  assert.ok(original.runner.invocation&&!invocations.has(original.runner.invocation),'Duplicate runner invocation');invocations.add(original.runner.invocation);
  assert.equal(original.runner.shard,name);
  for(const [tool,digest]of Object.entries(original.toolHashes))assert.equal(digest,hash(readFileSync(resolve(root,'scripts',tool),'utf8')),`Tool drift ${tool}`);
  assert.ok(original.toolHashes['merge-ext-perf-ab.mjs'],'Missing merge tool provenance');
  if(reference){
   for(const key of ['rounds','limit','baseIdentity','headIdentity'])assert.deepEqual(options[key],reference.options[key],`Mixed ${key}`);
   for(const key of ['identities','instrumentationHash','toolHashes'])assert.deepEqual(original[key],reference[key],`Mixed ${key}`);
   for(const key of ['runId','attempt','node','heapMiB'])assert.deepEqual(original.runner[key],reference.runner[key],`Mixed runner ${key}`);
  }else {reference=original;result.options={...options,cases:['classic','all']};delete result.options.shard;result.identities=original.identities;result.instrumentationHash=observer;result.toolHashes=original.toolHashes;}
  result.shards.push({name,runner:original.runner,resultSha256:hash(readFileSync(resolve(dir,'result.json'),'utf8')),status:original.status});
  const expected=[];
  for(let round=1;round<=options.rounds;round++)for(const id of options.cases)for(const side of ['A','B'])for(const kind of kindsFor(options,id))expected.push({round,id,side,kind});
  // A1/B1/A2/B2/A3/B3 is an ordered contract, not just a bag of rows.
  const measured=original.runs.filter(r=>r.round!=='verify');
  assert.deepEqual(measured.map(({round,id,side,kind})=>({round,id,side,kind})),expected,'Missing/duplicate/reordered A/B run');
  const verifies=original.runs.filter(r=>r.round==='verify');
  assert.ok(verifies.length<=(name==='all-prefix'?0:1),'Unexpected verification runs');
  for(const r of verifies)assert.ok(r.side==='B'&&r.kind==='full'&&options.cases.includes(r.id),'Wrong verification slot');
  for(const r of original.runs){
   const key=`${r.side}-${r.id}-${r.kind}`,prefix=resolve(dir,`round-${r.round}`,key);
   const rounds=read(prefix+'.rounds.json'),summary=withObjectiveP99(read(prefix+'.summary.json'),rounds);
   assert.deepEqual(summary,r.summary,'Result/raw summary mismatch');
   const input=read(resolve(dir,'inputs',key+'.json')),contract=original.inputs[key];
   assert.equal(hash(input),contract.recordingHash,'Input drift');assert.equal(input.events.length,contract.events);
   if(contracts[key])assert.deepEqual(contract.recordingHash,contracts[key].recordingHash,'Cross-shard input drift');
   contracts[key]=contract;
   const previous=first.get(key);
   validateRun(summary,{...contract,metrics,previous:previous?.summary});
   if(previous)cli(`compare-${name}-${r.round}-${key}`,'compare-ext-perf.mjs',[previous.prefix,prefix,resolve(out,`comparison-${name}-${r.round}-${key}.json`)]);
   first.set(key,{prefix,summary});
   result.runs.push({...r,prefix,summary,shard:name,runnerInvocation:original.runner.invocation});
  }
  if(name!=='all-prefix'){
   for(const id of options.cases){sources[id]=original.sources[id];assert.ok(sources[id],'Missing candidate source');write(resolve(out,`${id}.source.json`),sources[id]);}
   for(const stage of ['c1',...(options.headIdentity==='6c3'?['c3']:options.headIdentity==='6c4'?['c4']:[])]){
    if(perfIdentity(options.headIdentity).generate){assert.ok(original[stage+'Scenes'],'Missing bounded supplement');assert.deepEqual(read(resolve(dir,stage+'-scenes.json')),original[stage+'Scenes']);assert.ok(original.steps.some(s=>s.label===stage.toUpperCase()+'-bounded-supplement'));}
   }
  }
 }
 // Both all shards must derive their prefix from the same complete captures.
 for(const side of ['A','B'])assert.deepEqual(read(resolve(dirs['all-full'],'inputs',`${side}-all-full.json`)),read(resolve(dirs['all-prefix'],'inputs',`${side}-all-full.json`)),'All shards captured different routes');
 const prefixResult=read(resolve(dirs['all-prefix'],'result.json'));
 const full=side=>read(resolve(dirs['all-prefix'],'inputs',`${side}-all-full.json`));
 const n=comparablePrefix(full('A'),full('B'));
 assert.equal(prefixResult.prefixEvidence.events,n);assert.equal(prefixResult.prefixEvidence.a,prefixResult.prefixEvidence.b);
 for(const side of ['A','B']){
  assert.equal(prefixResult.inputs[`${side}-all-prefix`].events,n);
  const prefix=read(resolve(dirs['all-prefix'],'inputs',`${side}-all-prefix.json`));
  assert.equal(comparablePrefix(full(side),prefix),n,'Prefix capture does not match complete input');
  assert.equal(prefixResult.prefixEvidence[side.toLowerCase()],hash(full(side).events.slice(0,n).map(e=>[e.action,e.data,e.decisions,e.rng])),'Prefix evidence drift');
 }
 result.prefixEvidence=prefixResult.prefixEvidence;
 result.gates=evaluateGates(result.runs,result.options);
 if(!result.options.limit&&!pendingPerfBaseline(result.options.baseIdentity,result.options.headIdentity))for(let round=1;round<=result.options.rounds;round++)cli(`original-budget-${round}`,'ext-perf-budget.mjs',['check',resolve(root,perfIdentity(result.options.baseIdentity).manifest),...['classic','all'].map(id=>`${id}=${resolve(dirs[id==='classic'?'classic':'all-full'],`round-${round}`,`A-${id}-full`)}`)]);
 result.hard='pass';result.status=overallStatus(result);
 if(result.status==='pass'){
  const candidate=resolve(out,`ext-perf-${result.options.headIdentity}-budget.candidate.json`);
  cli('freeze-candidate','ext-perf-budget.mjs',['freeze-split',candidate,...['classic','all'].map(id=>`${id}=${resolve(out,`${id}.source.json`)},${[1,2,3].map(round=>resolve(dirs[id==='classic'?'classic':'all-full'],`round-${round}`,`B-${id}-full`)).join(',')}`)]);
  const verification=result.runs.filter(r=>r.round==='verify');assert.deepEqual(verification.map(r=>r.id).sort(),['all','classic'],'Missing independent fourth B replay');
  cli('independent-frozen-check','ext-perf-budget.mjs',['check',candidate,...verification.map(r=>`${r.id}=${r.prefix}`)]);
  const manifest=read(candidate);manifest.provenance={identities:result.identities,shards:result.shards,policyVersion,toolHashes:result.toolHashes,independentPostFreezeReplay:false,independentHeldOutReplay:true,calibration:'First three B full runs per case; independent fourth B on that same runner checked after aggregate freeze. No cross-runner timing comparisons.'};
  const name=`ext-perf-${result.options.headIdentity}-budget.suggested.json`;write(resolve(out,name),manifest);result.manifest=name;
 }
} catch(error){result.status='failed';result.hard='failed';result.error=String(error.stack??error);console.error(result.error);}
result.finishedAt=new Date().toISOString();
// Paths to copied evidence remain usable after downloading the aggregate artifact.
for(const r of result.runs)r.prefix=relative(out,r.prefix);
write(resolve(out,'result.json'),result);
const lines=['# ext phase6 split A/B',`Status: **${result.status}**; hard: **${result.hard}**.`,timingPolicy,
 'Each A/B pair and all three repeats stay on one shard runner. Absolute timings from different shards are never compared.',
 ...Object.entries(result.identities??{}).map(([side,v])=>`${side}: ${v.commit}; src tree ${v.srcTree}; dirty hash ${v.sourceHash}.`),
 '', '| Gate | Crossed rounds | Verdict |', '| --- | --- | --- |',...result.gates.map(g=>`| ${g.id}/${g.kind} | ${g.exceededRounds}/${result.options.rounds} | ${g.status} |`),
 '', '| Pair / round | Metric | A ms | B ms | Crossed |', '| --- | --- | --- | --- | --- |',...result.gates.flatMap(g=>g.pairs.flatMap((pair,i)=>pair.map(v=>`| ${g.id}/${g.kind} / ${i+1} | ${v.metric} | ${v.a.toFixed(3)} | ${v.b.toFixed(3)} | ${v.exceeded} |`))),
 '',...result.shards.map(s=>`- [${s.name} raw summary](shards/${s.name}/summary.md), runner invocation ${s.runner.invocation}; ${s.runner.cpu}.`),
 '',result.manifest?`Suggested manifest: [${result.manifest}](${result.manifest}). First three full B runs; independent held-out fourth replay checked. Review before adopting.`:'No suggested manifest: incomplete, diagnostic, failed, regression or pending baseline acceptance. rounds=1/2 never pass D6.',
 result.error??''];
writeFileSync(resolve(out,'summary.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({status:result.status,hard:result.hard,manifest:result.manifest??null}));
if(result.status==='failed'||result.status==='regression'||result.status==='incomplete'&&result.options?.rounds===3&&!pendingPerfBaseline(result.options.baseIdentity,result.options.headIdentity))process.exitCode=1;
