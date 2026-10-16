import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseOptions,validateRun,compareTiming,decide,canFreeze} from './ext-perf-ab-policy.mjs';

const args=['--base','a','--head','b','--out','o'];
assert.equal(parseOptions(args).rounds,3);
for(const extra of [['--rounds','0'],['--rounds','4'],['--rounds','1.5'],['--case','unknown'],['--limit','-1'],['--limit','1715'],['--unknown','x'],['--rounds','1','--rounds','3'],['--case']])assert.throws(()=>parseOptions([...args,...extra]));
const sample=()=>({mode:'wall',oos:0,recordingHash:'hash',events:3,node:'node',machine:{cpu:'cpu'},sourceHash:'src',semantic:{stateHash:'state',rng:[1],blocks:3},diagnostics:{stats:{hits:1}},segments:{counter:{calls:2}},elapsed:100,
 command:{n:3,p50:1,p95:10,max:20},round:{p95:10,max:20},depth:{20:{p95:10,max:20}},roundDepth:{20:{p95:10,max:20}}});
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
const ready={options:parseOptions(args),hard:'pass',gates:Array.from({length:3},()=>({status:'pass'}))};
assert.equal(canFreeze(ready),true);
for(const change of [{hard:'failed'},{options:{...ready.options,rounds:1}},{options:{...ready.options,limit:32}},{options:{...ready.options,cases:['classic']}},{gates:[{status:'pass'}]},{gates:[{status:'pass'},{status:'pass'},{status:'regression'}]}])assert.equal(canFreeze({...ready,...change}),false);

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
  const s={...c.calibration[0],node:c.node,machine:c.machine,sourceHash:c.sourceHash,mode:'wall',recordingHash:c.recordingHash,events:c.events,oos:0,semantic:c.semantic,segments:Object.fromEntries(Object.entries(c.maximumCalls).map(([k,calls])=>[k,{calls}]))};
  for(const key of Object.keys(c.timingBaseline)){
   const path=key.split('.');let node=s;for(const k of path.slice(0,-1))node=node[k]??={};node[path.at(-1)]={p95:1,max:1};
  }
  writeFileSync(prefix+'.summary.json',JSON.stringify(s));checkArgs.push(`${id}=${prefix}`);
  writeFileSync(prefix+'.source.json',JSON.stringify(c.source));
  const prefixes=[1,2,3].map(n=>`${prefix}-${n}`);
  for(const p of prefixes)writeFileSync(p+'.summary.json',JSON.stringify(s));
  freezeArgs.push(`${id}=${prefix}.source.json,${prefixes.join(',')}`);
 }
 const frozen=resolve(dir,'suggested.json');
 const freeze=()=>spawnSync(process.execPath,['scripts/ext-perf-budget.mjs','freeze',frozen,...freezeArgs],{encoding:'utf8'});
 assert.equal(freeze().status,0,'Original freeze CLI accepts three full fixtures and two cases');
 assert.notEqual(freeze().status,0,'Original freezer must refuse overwrite');
 assert.equal(spawnSync(process.execPath,['scripts/ext-perf-budget.mjs','check',frozen,...checkArgs],{encoding:'utf8'}).status,0,'Independent summary check against suggested manifest');
 const check=()=>spawnSync(process.execPath,['scripts/ext-perf-budget.mjs','check','scripts/ext-perf-budget.json',...checkArgs],{encoding:'utf8'});
 assert.equal(check().status,0);
 const path=resolve(dir,'all.summary.json'),s=JSON.parse(readFileSync(path,'utf8'));s.segments['light.dance'].calls++;
 writeFileSync(path,JSON.stringify(s));assert.notEqual(check().status,0,'Zero-budget counter growth must fail');
} finally {rmSync(dir,{recursive:true,force:true});}
console.log('A/B options, hard gates, 1ms thresholds, 2-of-3 verdict, freeze eligibility and original budget negatives passed');
