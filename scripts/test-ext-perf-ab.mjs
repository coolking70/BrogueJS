import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {stats,hash} from './ext-perf-common.mjs';
import {parseOptions,validateRun,compareTiming,decide,canFreeze,withObjectiveP99,evaluateGates,overallStatus} from './ext-perf-ab-policy.mjs';

const args=['--base','a','--head','b','--out','o'];
assert.equal(parseOptions(args).rounds,3);
assert.equal(parseOptions([...args,'--base-identity','6b4','--head-identity','6c1']).headIdentity,'6c1');
assert.equal(parseOptions([...args,'--base-identity','6c1','--head-identity','6c2']).headIdentity,'6c2');
assert.equal(parseOptions([...args,'--base-identity','6c2']).baseIdentity,'6c2');
for(const extra of [['--base-identity','6c4'],['--head-identity','6c4'],['--base-identity','6b4','--head-identity','6b4'],['--head-identity','6c1','--head-identity','6c1']])assert.throws(()=>parseOptions([...args,...extra]));
for(const extra of [['--rounds','0'],['--rounds','4'],['--rounds','1.5'],['--case','unknown'],['--limit','-1'],['--limit','1715'],['--unknown','x'],['--rounds','1','--rounds','3'],['--case']])assert.throws(()=>parseOptions([...args,...extra]));
const sample=()=>({mode:'wall',oos:0,recordingHash:'hash',events:3,node:'node',machine:{cpu:'cpu'},sourceHash:'src',semantic:{stateHash:'state',rng:[1],blocks:3,rounds:3,roundTicks:300,rowsHash:'rows'},diagnostics:{stats:{hits:1}},segments:{counter:{calls:2}},elapsed:100,
 command:{n:3,p50:1,p95:10,max:20},round:{p95:10,p99:20,max:20},depth:{20:{p95:10,max:20}},roundDepth:{20:{p95:10,p99:20,max:20}}});
const baseline=sample(),contract={recordingHash:'hash',events:3,metrics:['counter'],previous:baseline};
validateRun(sample(),contract);
for(const mutate of [s=>s.oos=1,s=>s.events--,s=>s.recordingHash='other',s=>s.mode='--cpu',s=>s.semantic.rng=[2],s=>s.segments.counter.calls++,s=>s.segments.extra={calls:1},s=>s.machine.cpu='other',s=>s.command.p95=NaN,s=>s.elapsed=undefined,s=>s.diagnostics.stats.hits++]){
 const s=sample();mutate(s);assert.throws(()=>validateRun(s,contract));
}
const edge=sample();edge.command.p95=11;edge.command.max=25;edge.elapsed=110;
assert.ok(compareTiming(baseline,edge).every(v=>!v.exceeded));
edge.command.p95+=.001;
const pass=compareTiming(baseline,baseline),fail=compareTiming(baseline,edge);
assert.equal(decide([fail,pass,pass]).status,'pass');
assert.equal(decide([fail,pass,fail]).status,'regression');
const other=sample();other.elapsed=111;
assert.equal(decide([fail,compareTiming(baseline,other),pass]).status,'regression','Different metrics still count as two crossed rounds');
assert.equal(decide([pass]).status,'incomplete');
const small=sample();small.command.p95=.1;const noise=structuredClone(small);noise.command.p95=1.1;
assert.equal(compareTiming(small,noise)[0].exceeded,false);
noise.command.p95=1.101;assert.equal(compareTiming(small,noise)[0].exceeded,true);
assert.throws(()=>compareTiming(baseline,{...sample(),roundDepth:{}}));
const ready={options:parseOptions(args),hard:'pass',gates:[['classic','full'],['all','full'],['all','prefix']].map(([id,kind])=>({id,kind,status:'pass',pairs:[pass,pass,pass]}))};
assert.equal(canFreeze(ready),true);
for(const change of [{hard:'failed'},{options:{...ready.options,rounds:1}},{options:{...ready.options,limit:32}},{options:{...ready.options,cases:['classic']}},{gates:[{status:'pass'}]},{gates:[{status:'pass'},{status:'pass'},{status:'regression'}]}])assert.equal(canFreeze({...ready,...change}),false);

// Revised D6: isolated objective maxima are descriptive; P99 and command max gate.
const spike=sample();spike.round.max=10000;spike.roundDepth[20].max=10000;
assert.ok(compareTiming(baseline,spike).every(v=>!v.exceeded));
for(const scene of ['round','roundDepth']){
 const tail=sample(),target=scene==='round'?tail.round:tail.roundDepth[20];
 target.p99=25;assert.ok(compareTiming(baseline,tail).every(v=>!v.exceeded));
 target.p99=25.001;assert.ok(compareTiming(baseline,tail).some(v=>v.exceeded));
 delete target.p99;assert.throws(()=>compareTiming(baseline,tail),/p99/);
}
const max=sample();max.command.max=25.001;assert.ok(compareTiming(baseline,max).some(v=>v.metric==='command.max'&&v.exceeded));
const rawRounds=Array.from({length:100},(_,i)=>({depth:20,ms:i+1}));
const raw={semantic:{rounds:100},round:stats(rawRounds.map(r=>r.ms)),roundDepth:{20:stats(rawRounds.map(r=>r.ms))}};
const enriched=withObjectiveP99(raw,rawRounds);
assert.equal(enriched.round.p99,99);assert.equal(enriched.roundDepth[20].p99,99);assert.equal(raw.round.p99,undefined);
assert.throws(()=>withObjectiveP99(raw,rawRounds.slice(1)));
assert.throws(()=>withObjectiveP99({...raw,round:{...raw.round,max:101}},rawRounds));
const runSet=()=>[1,2,3].flatMap(round=>[['classic','full'],['all','full'],['all','prefix']].flatMap(([id,kind])=>['A','B'].map(side=>({round,id,kind,side,summary:sample()}))));
const evaluate=runs=>({options:ready.options,hard:'pass',gates:evaluateGates(runs,ready.options)});
assert.equal(overallStatus(evaluate(runSet())),'pass');
for(const field of ['events','blocks','rounds']){
 const runs=runSet();
 for(const r of runs.filter(r=>r.id==='all'&&r.kind==='full'&&r.side==='B')){
  if(field==='events')r.summary.events++;else r.summary.semantic[field]=(r.summary.semantic[field]??0)+1;
  r.summary.elapsed=1000;
 }
 const result=evaluate(runs),full=result.gates.find(g=>g.id==='all'&&g.kind==='full');
 assert.equal(full.status,'report-only');assert.equal(full.timingStatus,'regression');assert.equal(overallStatus(result),'pass');
 const noPrefix=evaluate(runs.filter(r=>r.kind!=='prefix'));assert.equal(overallStatus(noPrefix),'incomplete');assert.equal(canFreeze(noPrefix),false);
 const partialFull=evaluate(runs.filter(r=>!(r.id==='all'&&r.kind==='full'&&r.round===3)));assert.equal(overallStatus(partialFull),'incomplete');assert.equal(canFreeze(partialFull),false);
 for(const r of runs.filter(r=>r.kind==='prefix'&&r.side==='B'))r.summary.elapsed=1000;
 assert.equal(overallStatus(evaluate(runs)),'regression','A bad comparable prefix still blocks');
}
const equalWork=runSet();for(const r of equalWork.filter(r=>r.id==='all'&&r.kind==='full'&&r.side==='B'))r.summary.elapsed=1000;
assert.equal(overallStatus(evaluate(equalWork)),'regression','Equal-work full route is still gating');
const drift=runSet();drift.find(r=>r.kind==='prefix'&&r.side==='B').summary.semantic.rng=[2];
assert.throws(()=>evaluate(drift),/Comparable load drift/);
for(const field of ['rng','rowsHash','blocks','rounds','roundTicks']){
 const classicDrift=runSet(),s=classicDrift.find(r=>r.id==='classic'&&r.side==='B').summary;
 s.semantic[field]=field==='rng'?[2]:field==='rowsHash'?'changed':s.semantic[field]+1;
 assert.throws(()=>evaluate(classicDrift),/Comparable (load|workload counts) drift/,'Classic behavior drift must still fail');
}
const diagnostic={options:{...ready.options,rounds:1},hard:'pass'};
diagnostic.gates=evaluateGates(runSet().filter(r=>r.round===1),diagnostic.options);
assert.equal(overallStatus(diagnostic),'incomplete');assert.equal(canFreeze(diagnostic),false);
const missing=runSet().filter(r=>r.round!==3);assert.equal(overallStatus(evaluate(missing)),'incomplete');
assert.throws(()=>evaluate([...runSet(),runSet()[0]]),/Duplicate/);
assert.equal(overallStatus({...evaluate(runSet()),hard:'failed'}),'failed');

// Exercise actual orchestration failure/reporting, without an engine replay.
const dir=mkdtempSync(resolve(tmpdir(),'ext-perf-ab-test-'));
try {
 mkdirSync(resolve(dir,'head'));
 const result=spawnSync(process.execPath,['scripts/run-ext-perf-ab.mjs','--base',process.cwd(),'--head',resolve(dir,'head'),'--out',resolve(dir,'result')],{encoding:'utf8'});
 assert.notEqual(result.status,0); // invalid checkout fails, leaving reviewable evidence
 assert.equal(JSON.parse(readFileSync(resolve(dir,'result/result.json'),'utf8')).status,'failed');
 assert.match(readFileSync(resolve(dir,'result/summary.md'),'utf8'),/failed/);
 // Exact original freezer/checker, synthetic fixture only: no production budget writes.
 const original=JSON.parse(readFileSync('scripts/ext-perf-budget.json','utf8'));
 const checkArgs=[],freezeArgs=[];
 for(const [id,c]of Object.entries(original.cases)){
  const prefix=resolve(dir,id);
  const s={...structuredClone(c.calibration[0]),node:c.node,machine:c.machine,sourceHash:c.sourceHash,mode:'wall',recordingHash:c.recordingHash,events:c.events,oos:0,semantic:c.semantic,segments:Object.fromEntries(Object.entries(c.maximumCalls).map(([k,calls])=>[k,{calls}]))};
  for(const key of Object.keys(c.timingBaseline)){
   const path=key.split('.');let node=s;for(const k of path.slice(0,-1))node=node[k]??={};node[path.at(-1)]={p95:1,max:1};
  }
  const rounds=Object.entries(c.calibration[0].roundDepth).flatMap(([depth,v])=>Array.from({length:v.n},()=>({depth:Number(depth),ms:1})));
  s.round=stats(rounds.map(r=>r.ms));s.roundDepth=Object.fromEntries(Object.keys(c.calibration[0].roundDepth).map(d=>[d,stats(rounds.filter(r=>r.depth===Number(d)).map(r=>r.ms))]));
  writeFileSync(prefix+'.rounds.json',JSON.stringify(rounds));
  writeFileSync(prefix+'.summary.json',JSON.stringify(s));checkArgs.push(`${id}=${prefix}`);
  writeFileSync(prefix+'.source.json',JSON.stringify(c.source));
  const prefixes=[1,2,3].map(n=>`${prefix}-${n}`);
  for(const p of prefixes){writeFileSync(p+'.summary.json',JSON.stringify(s));writeFileSync(p+'.rounds.json',JSON.stringify(rounds));}
  freezeArgs.push(`${id}=${prefix}.source.json,${prefixes.join(',')}`);
 }
 const frozen=resolve(dir,'suggested.json');
 const freeze=()=>spawnSync(process.execPath,['scripts/ext-perf-budget.mjs','freeze',frozen,...freezeArgs],{encoding:'utf8'});
 const frozenResult=freeze();assert.equal(frozenResult.status,0,frozenResult.stderr);
 assert.notEqual(freeze().status,0,'Freezer must refuse overwrite');
 assert.equal(spawnSync(process.execPath,['scripts/ext-perf-budget.mjs','check',frozen,...checkArgs],{encoding:'utf8'}).status,0,'Calibration fixture check against suggested manifest');
 const check=()=>spawnSync(process.execPath,['scripts/ext-perf-budget.mjs','check','scripts/ext-perf-budget.json',...checkArgs],{encoding:'utf8'});
 assert.equal(check().status,0);
 const path=resolve(dir,'all.summary.json'),s=JSON.parse(readFileSync(path,'utf8'));s.segments['light.dance'].calls++;
 writeFileSync(path,JSON.stringify(s));assert.notEqual(check().status,0,'Zero-budget counter growth must fail');

 // CLI recalculation consumes raw files, not old gates or precomputed P99.
 const artifact=resolve(dir,'artifact');mkdirSync(artifact);mkdirSync(resolve(artifact,'inputs'));
 const recording={events:[1,2,3]},offlineRuns=runSet(),inputs={};
 for(const r of offlineRuns){
  const key=`${r.side}-${r.id}-${r.kind}`,prefix=resolve(artifact,`round-${r.round}`,key);
  mkdirSync(resolve(artifact,`round-${r.round}`),{recursive:true});
  r.summary={...r.summary,recordingHash:hash(recording),segments:{},round:raw.round,roundDepth:raw.roundDepth,semantic:{...r.summary.semantic,rounds:100,blocks:100}};
  inputs[key]={recordingHash:hash(recording),events:3};
  writeFileSync(resolve(artifact,'inputs',key+'.json'),JSON.stringify(recording));
  writeFileSync(prefix+'.summary.json',JSON.stringify(r.summary));writeFileSync(prefix+'.rounds.json',JSON.stringify(rawRounds));
 }
 const artifactResult={version:1,status:'regression',hard:'pass',finishedAt:'test',options:ready.options,steps:[{status:'pass'}],runs:offlineRuns,inputs,instrumentationHash:original.instrumentationHash,runner:{runId:'fixture'},gates:[{status:'regression'}]};
 let serial=0;
 const recalculate=value=>{
  writeFileSync(resolve(artifact,'result.json'),JSON.stringify(value));
  return spawnSync(process.execPath,['scripts/recalculate-ext-perf-ab.mjs',resolve(artifact,'result.json'),resolve(dir,`offline-${++serial}`)],{encoding:'utf8'});
 };
 const recalculated=recalculate(artifactResult);assert.equal(recalculated.status,0,recalculated.stderr);
 assert.equal(JSON.parse(readFileSync(resolve(dir,'offline-1/result.json'),'utf8')).status,'pass');
 assert.equal(JSON.parse(readFileSync(resolve(artifact,'result.json'),'utf8')).status,'regression','Original evidence stays unchanged');
 for(const change of [{hard:'failed'},{status:'running'},{steps:[{status:'failed'}]},{runs:offlineRuns.slice(1)},{runs:[...offlineRuns,offlineRuns[0]]},{instrumentationHash:'changed'}])assert.notEqual(recalculate({...artifactResult,...change}).status,0);
 const drifted=structuredClone(artifactResult);drifted.runs[0].summary.elapsed++;
 assert.notEqual(recalculate(drifted).status,0,'Artifact/result mismatch fails');
 rmSync(resolve(artifact,'round-1/A-classic-full.rounds.json'));
 assert.notEqual(recalculate(artifactResult).status,0,'Missing raw P99 evidence fails closed');
} finally {rmSync(dir,{recursive:true,force:true});}
console.log('A/B options, hard gates, 1ms thresholds, 2-of-3 verdict, freeze eligibility P99/workload policy and budget negatives passed');

const {sourceSnapshot,assertCandidateSnapshot}=await import('./ext-perf-source-snapshot.mjs');
const candidateOptions=parseOptions([...args,'--base-identity','6c2','--head-identity','6c3','--rounds','1','--head-source-hash','a'.repeat(64)]);
assertCandidateSnapshot(candidateOptions,{hash:'a'.repeat(64)},{});
assert.throws(()=>assertCandidateSnapshot(candidateOptions,{hash:'b'.repeat(64)},{}));
assert.throws(()=>assertCandidateSnapshot(candidateOptions,{hash:'a'.repeat(64)},{GITHUB_ACTIONS:'true'}));
assertCandidateSnapshot({...candidateOptions,limit:257},{hash:'a'.repeat(64)},{});
for(const change of [{rounds:3},{limit:-1},{limit:1715},{cases:['classic']}])assert.throws(()=>assertCandidateSnapshot({...candidateOptions,...change},{hash:'a'.repeat(64)},{}));
assert.equal(canFreeze({...ready,options:{...ready.options,headSourceHash:'a'.repeat(64)}}),false);
const witness=mkdtempSync(resolve(tmpdir(),'c3-source-'));
try {mkdirSync(resolve(witness,'src'));writeFileSync(resolve(witness,'src','a.ts'),'first');const before=sourceSnapshot(witness);writeFileSync(resolve(witness,'src','a.ts'),'second');assert.notEqual(sourceSnapshot(witness).hash,before.hash);writeFileSync(resolve(witness,'src','new.ts'),'untracked');assert.equal(sourceSnapshot(witness).files.length,2);} finally {rmSync(witness,{recursive:true,force:true});}
