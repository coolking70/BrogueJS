import {sourceSnapshot,assertCandidateSnapshot} from './ext-perf-source-snapshot.mjs';
/** Same-runner A1/B1/A2/B2/A3/B3. No timing against historical machines.
 * node scripts/run-ext-perf-ab.mjs --base CHECKOUT --head CHECKOUT --out NEW_DIR
 * Optional --rounds 1..3 --case classic|all|both --limit EVENTS (smoke only).
 * The unchanged observer resolves engine modules from each child's cwd. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,closeSync,realpathSync,copyFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {cpus,totalmem,platform,arch} from 'node:os';
import {hash,write} from './ext-perf-common.mjs';
import {perfIdentity,loadPerfIdentity,comparablePrefix,pendingPerfBaseline} from './ext-perf-selection.mjs';
import {parseOptions,kindsFor,validateRun,withObjectiveP99,evaluateGates,overallStatus,policyVersion,timingPolicy} from './ext-perf-ab-policy.mjs';

if(process.argv.includes('--party')){const {runPartyAb}=await import('./run-party-perf-ab.mjs');await runPartyAb(process.argv.slice(2).filter(a=>a!=='--party'));process.exit(0);}
const options=parseOptions(process.argv.slice(2));
const sameIdentity=options.baseIdentity===options.headIdentity;
const control=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const roots={A:realpathSync(options.base),B:realpathSync(options.head)};
assert.notEqual(roots.A,roots.B,'Separate A/B checkout directories required');
const out=resolve(options.out);
assert.ok(!existsSync(out),'Use a fresh output directory; never overwrite failed evidence');
for(const root of [control,...Object.values(roots)]){const path=relative(root,out);assert.ok(path==='..'||path.startsWith('../'),'Evidence must be outside checkouts');}
mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const git=(root,...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const result={version:1,status:'running',hard:'pending',options,startedAt:new Date().toISOString(),
 runner:{invocation:randomUUID(),job:process.env.GITHUB_JOB??null,shard:options.shard??null,node:process.version,cpu:cpus()[0]?.model,cpus:cpus().length,memoryBytes:totalmem(),platform:platform(),arch:arch(),heapMiB:3072,runId:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null},
 identities:{},steps:[],runs:[],gates:[],
 scope:options.limit?`Local diagnostic: first ${options.limit} production events of both registered routes, plus bounded feature scenes. This is not full-route timing or D20 calibration.`:sameIdentity?'Same-identity regression: both revisions recapture the frozen 6c4 commands with current codec headers; A/B recording, semantic/RNG/domain/final-state equality required. Historical budget is not applied to the new A. D6 thresholds unchanged.':'Registered A/B complete classic/all routes and an outcome-verified identical all prefix. Prefix length is derived from production captures; it is NOT a D20 calibration.',
 policyVersion,policy:timingPolicy};
const fmt=v=>typeof v==='number'?v.toFixed(2):'—';
const triple=s=>s?['p50','p95','p99','max'].map(k=>fmt(s[k])).join(' / '):'—';
function publish(){
 write(resolve(out,'result.json'),result);
 const lines=['# ext phase6 cloud A/B',`Status: **${result.status}**; hard gate: **${result.hard}**.`,
  result.policy,result.scope,`Node ${result.runner.node}; ${result.runner.cpu}; heap 3072 MiB.`,
  ...Object.entries(result.identities).map(([k,v])=>`${k}: \`${v.commit}\`; src tree \`${v.srcTree}\`; dirty-src \`${v.sourceHash}\`.`),
  '', 'All times below are ms. Command and objective round columns are P50 / P95 / P99 / max (command P99 unavailable; objective max is descriptive only).', '',
  '| Round / case / stream | Events / OOS | Command | Objective round | D20 command | D20 round | Replay wall | RSS / heap MiB |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |'];
 for(const r of result.runs){const s=r.summary;lines.push(`| ${r.round} / ${r.id} / ${r.side}-${r.kind} | ${s.events} / ${s.oos} | ${triple(s.command)} | ${triple(s.round)} | ${triple(s.depth[20])} | ${triple(s.roundDepth[20])} | ${fmt(s.elapsed)} | ${fmt(s.memory.rss/1048576)} / ${fmt(s.memory.heapUsed/1048576)} |`);}
 lines.push('', 'Stable counts (all 17 counters, semantic hashes and RNG retained in JSON):', '',
  '| Round / case / stream | collect / transaction | blocks / ticks |', '| --- | --- | --- |');
 for(const r of result.runs){const s=r.summary;lines.push(`| ${r.round} / ${r.id} / ${r.side}-${r.kind} | ${s.segments.collectExtensionComponents?.calls??0} / ${s.segments['extension.transaction']?.calls??0} | ${s.semantic.blocks} / ${s.semantic.roundTicks} |`);}
 lines.push('', '| Gate | Crossed rounds | Verdict |', '| --- | --- | --- |');
 for(const g of result.gates)lines.push(`| ${g.id} / ${g.kind} | ${g.exceededRounds} / ${options.rounds} | ${g.status} |`);
 lines.push('', '| Pair / round | Metric | A → B (ms) | Relative | Crossed |', '| --- | --- | --- | --- | --- |');
 for(const g of result.gates)for(const [i,pair]of g.pairs.entries())for(const v of pair)
  lines.push(`| ${g.id}/${g.kind} / ${i+1} | ${v.metric} | ${fmt(v.a)} → ${fmt(v.b)} | ${v.relative===null?'n/a':fmt(v.relative*100)+'%'} | ${v.exceeded?'yes':'no'} |`);
 lines.push('',result.manifest?`Suggested manifest: ext-perf-${options.headIdentity}-budget.suggested.json; independent post-freeze replay/check passed. Review before adopting; no repository writes.`:options.shard?'Shard evidence only; aggregate job decides D6 and the suggested manifest.':'No recommended manifest. Partial/smoke/error/regression results cannot freeze a budget.',
  result.error?`Failure: ${result.error}`:'',`Latest step: ${result.steps.at(-1)?.label??'preflight'} (${result.steps.at(-1)?.status??'pending'}).`,
  'A running/pending status means incomplete evidence, never a pass. Raw inputs, complete observer outputs, comparisons and logs are retained in the artifact.');
 writeFileSync(resolve(out,'summary.md'),lines.join('\n')+'\n');
}
let sequence=0;
function run(label,cwd,script,args){
 const step={label,cwd,script,args,startedAt:new Date().toISOString(),status:'running'};
 result.steps.push(step);publish();console.log(`[${step.startedAt}] ${label}`);
 const log=resolve(out,`${String(++sequence).padStart(3,'0')}-${label.replaceAll(/[^a-zA-Z0-9-]/g,'-')}.log`);
 const fd=openSync(log,'w');let child;
 try{child=spawnSync(process.execPath,['--max-old-space-size=3072',resolve(control,'scripts',script),...args],{cwd,stdio:['ignore',fd,fd],timeout:90*60*1000,killSignal:'SIGKILL',env:{...process.env,NODE_OPTIONS:'--max-old-space-size=3072'}});}
 finally{closeSync(fd);}
 Object.assign(step,{finishedAt:new Date().toISOString(),exit:child.status,signal:child.signal,log,status:child.status===0?'pass':'failed'});publish();
 assert.equal(child.status,0,`${label} failed (${child.error??child.signal??child.status}); see ${log}`);
}

publish();
try {
 assert.equal(Number(process.versions.node.split('.')[0]),24,'Use Node 24 on both sides');
 const instrumentationHash=hash(['profile-ext-perf.mjs','ext-perf-common.mjs'].map(n=>readFileSync(resolve(control,'scripts',n),'utf8')).join('\0'));
 // Frozen inputs live with the dispatched tools: historical engine checkouts
 // predate adoption of their cloud artifacts. Production recapture below must
 // still reproduce every event/hash on A; no header or checkpoint substitution.
 const pendingBase=pendingPerfBaseline(options.baseIdentity,options.headIdentity);
 let baseline;
 if(pendingBase){
  // Reconstruct both complete inputs from the requested immutable C3 checkout.
  // P0 supplies only the unchanged observer metric names, never a timing budget.
  const registry=perfIdentity(options.baseIdentity),paths={},sources={};
  for(const id of options.cases){
   const dir=resolve(out,'pending-base-artifacts',id),stem=resolve(dir,`${id}-438491256`);
   run(`generate-pending-base-${id}`,roots.A,'generate-ext-perf.mjs',[dir,id,'438491256','500']);
   paths[id]=stem+'.route.json';sources[id]=read(stem+'.source.json');
   const route=read(paths[id]),source=sources[id];assert.equal(source.source,git(roots.A,'rev-parse','HEAD'));if(id==='all'){assert.equal(source.codec.foundation,19);assert.equal(source.extensions.modules.find(m=>m.id==='loot')?.version,'0.8.0');}
   assert.equal(route.recordingHash,source.recordingHash);assert.equal(route.commands.length,source.events);assert.ok(source.events>2049&&source.coverage[20]?.settled>=500,'Missing complete pending baseline');
  }
  baseline={entry:{...registry,route:id=>paths[id]},sources,manifest:read(resolve(control,'scripts/ext-perf-budget.json'))};
  result.pendingBaseline={identity:options.baseIdentity,accepted:false,scope:'Comparison only; C3 review must complete before C4 budget acceptance.'};
 }else baseline=loadPerfIdentity(control,options.baseIdentity);
 const original=baseline.manifest,metrics=original.metrics;
 const headEntry=perfIdentity(options.headIdentity),generated=headEntry.generate===true;
 if(!generated)loadPerfIdentity(roots.B,options.headIdentity);
 result.cumulativeReference=read(resolve(roots.A,'scripts/ext-perf-budget.json'));
 result.cumulativeScope='P0 frozen counts and timing reference retained; historical machine timings are descriptive only.';
 assert.equal(instrumentationHash,original.instrumentationHash,'Observer drift');
 for(const [side,root]of Object.entries(roots)){
  const sourceDiff=execFileSync('git',['diff','HEAD','--','src'],{cwd:root,encoding:'utf8'});
  if(side==='B'&&options.headSourceHash){const snapshot=sourceSnapshot(root);assertCandidateSnapshot(options,snapshot);result.candidateSnapshot=snapshot;}
  else {assert.equal(sourceDiff,'','Engine checkout must be clean');assert.equal(git(root,'ls-files','--others','--exclude-standard','src'),'','Untracked engine source');}
  result.identities[side]={commit:git(root,'rev-parse','HEAD'),srcTree:git(root,'rev-parse','HEAD:src'),sourceHash:hash(sourceDiff),lockHash:hash(readFileSync(resolve(root,'package-lock.json'),'utf8'))};
  // The workflow stages the dispatched planner into both historical checkouts;
  // retain exact byte guards for generation, capture, observer and comparison.
  for(const n of ['profile-ext-perf.mjs','ext-perf-common.mjs','regenerate-ext-perf.mjs','generate-ext-perf.mjs','ext-perf-route-recovery.mjs','compare-ext-perf.mjs'])
   assert.equal(readFileSync(resolve(root,'scripts',n),'utf8'),readFileSync(resolve(control,'scripts',n),'utf8'),`Tool drift ${side}/${n}`);
 }
 result.identities.control={commit:git(control,'rev-parse','HEAD'),srcTree:git(control,'rev-parse','HEAD:src'),sourceHash:hash(execFileSync('git',['diff','HEAD','--','scripts','.github'],{cwd:control,encoding:'utf8'}))};
 result.instrumentationHash=instrumentationHash;
 result.toolHashes=Object.fromEntries(['merge-ext-perf-ab.mjs','ext-perf-source-snapshot.mjs','run-ext-perf-ab.mjs','generate-ext-perf.mjs','ext-perf-route-recovery.mjs','profile-ext-6c1.mjs','profile-ext-6c3.mjs','profile-ext-6c4.mjs','ext-perf-selection.mjs','ext-perf-ab-policy.mjs','capture-ext-perf-prefix.mjs','regenerate-ext-perf.mjs','profile-ext-perf.mjs','ext-perf-common.mjs','compare-ext-perf.mjs','ext-perf-budget.mjs'].map(n=>[n,hash(readFileSync(resolve(control,'scripts',n),'utf8'))]));
 const inputs={},routePaths={},sourcePaths={};
 for(const id of options.cases){
  routePaths[`A-${id}`]=resolve(control,baseline.entry.route(id));
  if(sameIdentity){
   // Regression on one frozen workload: both revisions execute the exact same
   // registered commands. Recapture current headers; compare A/B exact bytes.
   routePaths[`B-${id}`]=routePaths[`A-${id}`];
   sourcePaths[id]=resolve(control,baseline.entry.source(id));
  }else if(generated){
   const dir=resolve(out,'candidate-artifacts',id),stem=resolve(dir,`${id}-438491256`);
   run(`generate-B-${id}`,roots.B,'generate-ext-perf.mjs',[dir,id,'438491256','500']);
   routePaths[`B-${id}`]=stem+'.route.json';sourcePaths[id]=stem+'.source.json';
  }else{routePaths[`B-${id}`]=resolve(roots.B,headEntry.route(id));sourcePaths[id]=resolve(roots.B,headEntry.source(id));}
  const recordings={};
  for(const side of ['A','B']){
   const route=routePaths[`${side}-${id}`],full=resolve(out,'inputs',`${side}-${id}-full.json`);
   run(`capture-${side}-${id}-full`,roots[side],options.limit||sameIdentity?'capture-ext-perf-prefix.mjs':'regenerate-ext-perf.mjs',[route,full,...(options.limit||sameIdentity?[String(options.limit||read(route).commands.length)]:[])]);
   const data=read(full);recordings[side]=data;inputs[`${side}-${id}-full`]={path:full,recordingHash:hash(data),events:data.events.length};
   if(sameIdentity&&side==='B')sourcePaths[id]=full+'.source.json';
   if(!options.limit){
    const source=sameIdentity?read(full+'.source.json'):side==='A'?baseline.sources[id]:read(sourcePaths[id]);
    assert.equal(hash(data),source.recordingHash);assert.equal(data.events.length,source.events);
    assert.ok(source.events>2049&&source.coverage[20]?.settled>=500,'Missing complete D20 source');
    if(sameIdentity){assert.equal(source.events,baseline.sources[id].events);assert.equal(source.routeHash,hash(read(route)));assert.equal(source.source,result.identities[side].commit);}
   }
  }
  if(sameIdentity)assert.equal(hash(recordings.A),hash(recordings.B),'Same-identity A/B recording drift');
  if(id==='classic')assert.deepEqual(read(routePaths[`A-${id}`]).commands,read(routePaths[`B-${id}`]).commands,'Classic route changed');
  if(id==='all'&&options.shard!=='all-full'){
   const n=comparablePrefix(recordings.A,recordings.B);
   result.prefixEvidence={events:n,method:'Longest production command/outcome prefix; observer rechecks workload and RNG',a:hash(recordings.A.events.slice(0,n).map(e=>[e.action,e.data,e.decisions,e.rng])),b:hash(recordings.B.events.slice(0,n).map(e=>[e.action,e.data,e.decisions,e.rng]))};
   assert.equal(result.prefixEvidence.a,result.prefixEvidence.b);
   for(const side of ['A','B']){
    const prefix=resolve(out,'inputs',`${side}-${id}-prefix.json`);
    // An entire identical prefix is already a production capture. Reuse input
    // bytes only; its observer runs remain independent and interleaved.
    if(n===recordings[side].events.length){
     copyFileSync(inputs[`${side}-${id}-full`].path,prefix);
    }else run(`capture-${side}-${id}-prefix`,roots[side],'capture-ext-perf-prefix.mjs',[routePaths[`A-${id}`],prefix,String(n)]);
    const p=read(prefix);inputs[`${side}-${id}-prefix`]={path:prefix,recordingHash:hash(p),events:p.events.length};
   }
  }
 }
 result.inputs=inputs;result.sources=Object.fromEntries(Object.entries(sourcePaths).map(([id,path])=>[id,read(path)]));publish();
 const first=new Map();
 function measure(round,id,side,kind){
  const key=`${side}-${id}-${kind}`,input=inputs[key],prefix=resolve(out,`round-${round}`,key);
  run(`${round}-${key}`,roots[side],'profile-ext-perf.mjs',[input.path,prefix]);
  const summary=withObjectiveP99(read(prefix+'.summary.json'),read(prefix+'.rounds.json')),previous=first.get(key);
  validateRun(summary,{...input,metrics,previous:previous?.summary});
  const row={round,id,side,kind,prefix,summary};result.runs.push(row);
  if(previous)run(`compare-${round}-${key}`,roots[side],'compare-ext-perf.mjs',[previous.prefix,prefix,prefix+'.comparison.json']);
  else first.set(key,row);
  publish();return row;
 }
 for(let round=1;round<=options.rounds;round++)for(const id of options.cases){
  // Never parallelize: each case sees A1,B1,A2,B2,A3,B3 on this runner.
  const pair={};
  for(const side of ['A','B']){
   for(const kind of kindsFor(options,id))pair[side+kind]=measure(round,id,side,kind);
  }
  if(sameIdentity)for(const kind of kindsFor(options,id))run(`compare-AB-${round}-${id}-${kind}`,roots.B,'compare-ext-perf.mjs',[pair['A'+kind].prefix,pair['B'+kind].prefix,resolve(out,`compare-AB-${round}-${id}-${kind}.json`)]);
  result.gates=evaluateGates(result.runs,options);
  publish();
 }
 if(!sameIdentity&&!pendingBase&&!options.limit&&options.cases.length===2)for(let round=1;round<=options.rounds;round++){
  const args=options.cases.map(id=>`${id}=${resolve(out,`round-${round}`,`A-${id}-full`)}`);
  run(`original-budget-${round}`,roots.A,'ext-perf-budget.mjs',['check',resolve(control,baseline.entry.manifest),...args]);
 }
 if(generated&&options.shard!=='all-prefix'){run('C1-bounded-supplement',roots.B,'profile-ext-6c1.mjs',[resolve(out,'c1-scenes.json')]);result.c1Scenes=read(resolve(out,'c1-scenes.json'));}
 if(options.headIdentity==='6c3'&&options.shard!=='all-prefix'){run('C3-bounded-supplement',roots.B,'profile-ext-6c3.mjs',[resolve(out,'c3-scenes.json')]);result.c3Scenes=read(resolve(out,'c3-scenes.json'));}
 if(options.headIdentity==='6c4'&&options.shard!=='all-prefix'){run('C4-bounded-supplement',roots.B,'profile-ext-6c4.mjs',[resolve(out,'c4-scenes.json')]);result.c4Scenes=read(resolve(out,'c4-scenes.json'));}
 result.hard='pass';
 if(options.headSourceHash)assertCandidateSnapshot(options,sourceSnapshot(roots.B));
 result.status=overallStatus(result);
 if(options.shard&&options.shard!=='all-prefix'&&options.rounds===3&&!options.limit&&!pendingBase&&!result.gates.some(g=>g.status==='regression')){
  // Independent fourth B replay stays on this case's runner. The aggregate
  // freezes rounds 1..3, then checks this held-out replay against that budget.
  for(const id of options.cases)measure('verify',id,'B','full');
 }
 if(result.status==='pass'){
  result.status='verifying';publish();
  // Use the same correctness/count freezer with revised objective-tail reporting. First 3 complete B runs only; no cherry-picking.
  const manifest=resolve(out,`ext-perf-${options.headIdentity}-budget.candidate.json`);
  run('freeze-candidate',roots.B,'ext-perf-budget.mjs',['freeze',manifest,...options.cases.map(id=>`${id}=${sourcePaths[id]},${[1,2,3].map(n=>resolve(out,`round-${n}`,`B-${id}-full`)).join(',')}`)]);
  const verification=options.cases.map(id=>measure('verify',id,'B','full'));
  run('independent-frozen-check',roots.B,'ext-perf-budget.mjs',['check',manifest,...verification.map(r=>`${r.id}=${r.prefix}`)]);
  // Portable suggested manifest retains report-only absolute timing.
  const suggested=resolve(out,`ext-perf-${options.headIdentity}-budget.suggested.json`);write(suggested,read(manifest));result.manifest=suggested;
  result.status='pass';
 }
 result.finishedAt=new Date().toISOString();publish();
 if(result.status==='regression')process.exitCode=1;
 // Explicit local diagnostics may succeed, but their report remains incomplete and cannot freeze.
} catch(error){result.status='failed';result.hard='failed';result.error=String(error.stack??error);result.finishedAt=new Date().toISOString();publish();console.error(result.error);process.exitCode=1;}
