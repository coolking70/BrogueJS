/** Same-runner A1/B1/A2/B2/A3/B3. No timing against historical machines.
 * node scripts/run-ext-perf-ab.mjs --base CHECKOUT --head CHECKOUT --out NEW_DIR
 * Optional --rounds 1..3 --case classic|all|both --limit EVENTS (smoke only).
 * The unchanged observer resolves engine modules from each child's cwd. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,openSync,closeSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {cpus,totalmem,platform,arch} from 'node:os';
import {hash,write} from './ext-perf-common.mjs';
import {parseOptions,validateRun,compareTiming,decide,canFreeze} from './ext-perf-ab-policy.mjs';

const options=parseOptions(process.argv.slice(2));
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
 runner:{node:process.version,cpu:cpus()[0]?.model,cpus:cpus().length,memoryBytes:totalmem(),platform:platform(),arch:arch(),heapMiB:3072,runId:process.env.GITHUB_RUN_ID??null,attempt:process.env.GITHUB_RUN_ATTEMPT??null},
 identities:{},steps:[],runs:[],gates:[],
 scope:'classic: complete identical commands; all: original/new complete routes plus identical original first 1714 commands (before documented RNG divergence at 1715). Prefix is NOT a D20 calibration.',
 policy:'Same runner only; P95 +10%, max +25%, elapsed +10%, minimum 1ms. Any metric crossing in >=2 of 3 rounds means regression: rollback/fix required (no automatic git changes). Full-route workload change is reported, never automatically excused. Absolute times report only.'};
const fmt=v=>typeof v==='number'?v.toFixed(2):'—';
const triple=s=>s?['p50','p95','max'].map(k=>fmt(s[k])).join(' / '):'—';
function publish(){
 write(resolve(out,'result.json'),result);
 const lines=['# ext 6B4 cloud A/B',`Status: **${result.status}**; hard gate: **${result.hard}**.`,
  result.policy,result.scope,`Node ${result.runner.node}; ${result.runner.cpu}; heap 3072 MiB.`,
  ...Object.entries(result.identities).map(([k,v])=>`${k}: \`${v.commit}\`; src tree \`${v.srcTree}\`; dirty-src \`${v.sourceHash}\`.`),
  '', 'All times below are ms. Command and objective round columns are P50 / P95 / max.', '',
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
 lines.push('',result.manifest?'Suggested manifest: `ext-perf-6b4-budget.suggested.json`; independent post-freeze replay/check passed. Review before adopting; no repository writes.':'No recommended manifest. Partial/smoke/error/regression results cannot freeze a budget.',
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
 const original=read(resolve(roots.A,'scripts/ext-perf-budget.json')),metrics=original.metrics;
 assert.equal(instrumentationHash,original.instrumentationHash,'Observer drift');
 for(const [side,root]of Object.entries(roots)){
  const sourceDiff=execFileSync('git',['diff','HEAD','--','src'],{cwd:root,encoding:'utf8'});
  assert.equal(sourceDiff,'','Engine checkout must be clean');
  assert.equal(git(root,'ls-files','--others','--exclude-standard','src'),'','Untracked engine source');
  result.identities[side]={commit:git(root,'rev-parse','HEAD'),srcTree:git(root,'rev-parse','HEAD:src'),sourceHash:hash(sourceDiff),lockHash:hash(readFileSync(resolve(root,'package-lock.json'),'utf8'))};
  for(const n of ['profile-ext-perf.mjs','ext-perf-common.mjs','regenerate-ext-perf.mjs','compare-ext-perf.mjs','ext-perf-budget.mjs'])
   assert.equal(readFileSync(resolve(root,'scripts',n),'utf8'),readFileSync(resolve(control,'scripts',n),'utf8'),`Tool drift ${side}/${n}`);
 }
 result.identities.control={commit:git(control,'rev-parse','HEAD'),srcTree:git(control,'rev-parse','HEAD:src'),sourceHash:hash(execFileSync('git',['diff','HEAD','--','scripts','.github'],{cwd:control,encoding:'utf8'}))};
 result.instrumentationHash=instrumentationHash;
 result.toolHashes=Object.fromEntries(['run-ext-perf-ab.mjs','ext-perf-ab-policy.mjs','capture-ext-perf-prefix.mjs','regenerate-ext-perf.mjs','profile-ext-perf.mjs','ext-perf-common.mjs','compare-ext-perf.mjs','ext-perf-budget.mjs'].map(n=>[n,hash(readFileSync(resolve(control,'scripts',n),'utf8'))]));
 const inputs={};
 for(const id of options.cases){
  const oldRoute=resolve(roots.A,`scripts/perf/ext-late-${id}.route.json`),newRoute=resolve(roots.B,`scripts/perf/ext-6b4-late-${id}.route.json`);
  const a=read(oldRoute),b=read(newRoute),n=id==='classic'?a.commands.length:1714;
  assert.deepEqual(a.commands.slice(0,n),b.commands.slice(0,n),'Reviewed comparable commands changed');
  if(id==='classic')assert.equal(b.commands.length,n);
  for(const side of ['A','B']){
   const route=side==='A'?oldRoute:newRoute,root=roots[side];
   const full=resolve(out,'inputs',`${side}-${id}-full.json`);
   run(`capture-${side}-${id}-full`,root,options.limit?'capture-ext-perf-prefix.mjs':'regenerate-ext-perf.mjs',[route,full,...(options.limit?[String(options.limit)]:[])]);
   const data=read(full);inputs[`${side}-${id}-full`]={path:full,recordingHash:hash(data),events:data.events.length};
   if(!options.limit){
    const source=side==='A'?original.cases[id].source:read(resolve(roots.B,`scripts/perf/ext-6b4-late-${id}.source.json`));
    assert.equal(hash(data),source.recordingHash);assert.equal(data.events.length,source.events);
   }
   if(id==='all'){
    const prefix=resolve(out,'inputs',`${side}-${id}-prefix.json`);
    run(`capture-${side}-${id}-prefix`,root,'capture-ext-perf-prefix.mjs',[oldRoute,prefix,String(options.limit||1714)]);
    const p=read(prefix);inputs[`${side}-${id}-prefix`]={path:prefix,recordingHash:hash(p),events:p.events.length};
   }
  }
 }
 result.inputs=inputs;publish();
 const first=new Map();
 function measure(round,id,side,kind){
  const key=`${side}-${id}-${kind}`,input=inputs[key],prefix=resolve(out,`round-${round}`,key);
  run(`${round}-${key}`,roots[side],'profile-ext-perf.mjs',[input.path,prefix]);
  const summary=read(prefix+'.summary.json'),previous=first.get(key);
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
   pair[side]=measure(round,id,side,'full');
   if(id==='all')pair[side+'prefix']=measure(round,id,side,'prefix');
  }
  for(const kind of id==='all'?['full','prefix']:['full']){
   const a=pair['A'+(kind==='prefix'?'prefix':'')],b=pair['B'+(kind==='prefix'?'prefix':'')];
   if(id==='classic'||kind==='prefix'){
    assert.equal(a.summary.semantic.rowsHash,b.summary.semantic.rowsHash,'Comparable load drift (rows)');
    for(const k of ['rng','blocks','rounds','roundTicks'])assert.deepEqual(a.summary.semantic[k],b.summary.semantic[k],`Comparable load drift (${k})`);
   }
   let gate=result.gates.find(g=>g.id===id&&g.kind===kind);
   if(!gate){gate={id,kind,pairs:[]};result.gates.push(gate);}
   gate.pairs.push(compareTiming(a.summary,b.summary,{complete:!options.limit&&kind==='full'}));Object.assign(gate,decide(gate.pairs));
  }
  publish();
 }
 if(!options.limit&&options.cases.length===2)for(let round=1;round<=options.rounds;round++){
  const args=options.cases.map(id=>`${id}=${resolve(out,`round-${round}`,`A-${id}-full`)}`);
  run(`original-budget-${round}`,roots.A,'ext-perf-budget.mjs',['check',resolve(roots.A,'scripts/ext-perf-budget.json'),...args]);
 }
 result.hard='pass';
 result.status=result.gates.some(g=>g.status==='regression')?'regression':canFreeze({...result,options})?'pass':'incomplete';
 if(result.status==='pass'){
  result.status='verifying';publish();
  // Use the original freezer unchanged. First 3 complete B runs only; no cherry-picking.
  const manifest=resolve(out,'ext-perf-6b4-budget.candidate.json');
  run('freeze-candidate',roots.B,'ext-perf-budget.mjs',['freeze',manifest,...options.cases.map(id=>`${id}=${resolve(roots.B,`scripts/perf/ext-6b4-late-${id}.source.json`)},${[1,2,3].map(n=>resolve(out,`round-${n}`,`B-${id}-full`)).join(',')}`)]);
  const verification=options.cases.map(id=>measure('verify',id,'B','full'));
  run('independent-frozen-check',roots.B,'ext-perf-budget.mjs',['check',manifest,...verification.map(r=>`${r.id}=${r.prefix}`)]);
  // No policy/threshold rewriting: portable suggested manifest retains report-only absolute timing.
  const suggested=resolve(out,'ext-perf-6b4-budget.suggested.json');write(suggested,read(manifest));result.manifest=suggested;
  result.status='pass';
 }
 result.finishedAt=new Date().toISOString();publish();
 if(result.status==='regression')process.exitCode=1;
 // Explicit local diagnostics may succeed, but their report remains incomplete and cannot freeze.
} catch(error){result.status='failed';result.hard='failed';result.error=String(error.stack??error);result.finishedAt=new Date().toISOString();publish();console.error(result.error);process.exitCode=1;}
