import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync,rmSync,existsSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {hash,stats} from './ext-perf-common.mjs';
import {parseOptions,withObjectiveP99,policyVersion,timingPolicy,kindsFor} from './ext-perf-ab-policy.mjs';

const names=['classic','all-full','all-prefix'],common=['--base','a','--head','b','--out','o'];
for(const name of names){const o=parseOptions([...common,'--shard',name]);assert.deepEqual(o.cases,name==='classic'?['classic']:['all']);assert.deepEqual(kindsFor(o,o.cases[0]),name==='all-prefix'?['prefix']:['full']);}
for(const flags of [['--shard','all'],['--shard','classic','--case','classic'],['--shard','classic','--head-source-hash','a'.repeat(64)]])assert.throws(()=>parseOptions([...common,...flags]));
const dir=mkdtempSync(resolve(tmpdir(),'ext-perf-split-test-'));
const read=p=>JSON.parse(readFileSync(p,'utf8')),write=(p,v)=>writeFileSync(p,JSON.stringify(v));
let serial=0;
try {
 // Isolated synthetic control: no repository budgets or engine replay modified.
 const control=resolve(dir,'control');mkdirSync(control);symlinkSync(resolve('node_modules'),resolve(control,'node_modules'));cpSync('scripts',resolve(control,'scripts'),{recursive:true});
 const original=read('scripts/ext-perf-budget.json'),toolNames=['merge-ext-perf-ab.mjs','run-ext-perf-ab.mjs','ext-perf-ab-policy.mjs','ext-perf-budget.mjs'];
 const toolHashes=Object.fromEntries(toolNames.map(n=>[n,hash(readFileSync(resolve(control,'scripts',n),'utf8'))]));
 const recording={events:Array.from({length:2051},()=>({action:'wait',rng:[1]}))};
 const rawRounds=[{depth:20,ms:1},{depth:20,ms:1},{depth:20,ms:1}];
 const origin=id=>({recordingHash:hash(recording),events:2051,coverage:{20:{settled:500}},modules:id==='classic'?[]:Array(8).fill('fixture')});
 const summary=(id,machine)=>({mode:'wall',oos:0,recordingHash:hash(recording),events:2051,node:'v24.fixture',machine:{cpu:machine},sourceHash:'source',semantic:{stateHash:id,rng:[1],blocks:3,rounds:3,roundTicks:300,rowsHash:id},diagnostics:{},segments:{},elapsed:100,command:{n:2051,p50:1,p95:1,max:1},round:stats([1,1,1]),boundary:stats([1]),depth:{20:stats([1])},roundDepth:{20:stats([1,1,1])}});
 const shards={};
 for(const name of names){
  const path=resolve(dir,name);mkdirSync(path);mkdirSync(resolve(path,'inputs'));const id=name==='classic'?'classic':'all',kind=name==='all-prefix'?'prefix':'full';
  const options=parseOptions([...common,'--shard',name]);
  const result={version:1,options,hard:'pass',status:'incomplete',finishedAt:'fixture',policyVersion,policy:timingPolicy,instrumentationHash:original.instrumentationHash,toolHashes,identities:{A:{commit:'A'},B:{commit:'B'},control:{commit:'tools'}},runner:{invocation:name,shard:name,runId:'fixture',attempt:'1',node:'v24.fixture',heapMiB:3072,cpu:name},steps:[{status:'pass'}],runs:[],inputs:{},sources:{[id]:origin(id)}};
  for(const side of ['A','B'])for(const k of id==='all'?['full','prefix']:['full']){const key=`${side}-${id}-${k}`;write(resolve(path,'inputs',key+'.json'),recording);result.inputs[key]={recordingHash:hash(recording),events:2051,path:'historical/absolute/path'};}
  if(name==='all-prefix')result.prefixEvidence={events:2051,a:hash(recording.events.map(e=>[e.action,e.data,e.decisions,e.rng])),b:hash(recording.events.map(e=>[e.action,e.data,e.decisions,e.rng]))};
  for(const round of [1,2,3,...(name==='all-prefix'?[]:['verify'])])for(const side of round==='verify'?['B']:['A','B']){
   const key=`${side}-${id}-${kind}`,prefix=resolve(path,`round-${round}`,key);mkdirSync(resolve(path,`round-${round}`),{recursive:true});
   const s=summary(id,name);write(prefix+'.summary.json',s);write(prefix+'.rounds.json',rawRounds);
   for(const suffix of ['domains','full-domains','state'])write(prefix+`.${suffix}.json`,{state:id});
   result.runs.push({round,id,kind,side,prefix,summary:withObjectiveP99(s,rawRounds)});
  }
  write(resolve(path,'result.json'),result);writeFileSync(resolve(path,'summary.md'),name);shards[name]={path,result};
 }
 // Freeze an isolated synthetic A reference with different machines per case.
 const freezeArgs=['classic','all'].map(id=>{const name=id==='classic'?id:'all-full';write(resolve(dir,id+'.source.json'),origin(id));return `${id}=${resolve(dir,id+'.source.json')},${[1,2,3].map(n=>resolve(dir,name,`round-${n}`,`A-${id}-full`)).join(',')}`;});
 const spawn=(script,args)=>spawnSync(process.execPath,[resolve(control,'scripts',script),...args],{encoding:'utf8'});
 const budget=resolve(control,'scripts/ext-perf-budget.json');rmSync(budget);
 assert.notEqual(spawn('ext-perf-budget.mjs',['freeze',budget,...freezeArgs]).status,0,'Legacy freezer rejects different case machines');
 const frozen=spawn('ext-perf-budget.mjs',['freeze-split',budget,...freezeArgs]);assert.equal(frozen.status,0,frozen.stderr);
 const merge=(mutate=()=>{})=>{
  for(const [name,{path,result}]of Object.entries(shards)){const r=structuredClone(result);mutate(r,name);write(resolve(path,'result.json'),r);}
  const out=resolve(dir,`merged-${++serial}`),run=spawn('merge-ext-perf-ab.mjs',[out,...names.map(n=>shards[n].path)]);
  return {run,out,result:read(resolve(out,'result.json'))};
 };
 const good=merge();assert.equal(good.run.status,0,good.run.stderr);assert.equal(good.result.status,'pass');assert.ok(existsSync(resolve(good.out,good.result.manifest)));assert.equal(read(resolve(good.out,good.result.manifest)).provenance.independentHeldOutReplay,true);
 assert.ok(good.result.runs.every(r=>!r.prefix.startsWith('/')),'Aggregate paths are portable');
 const one=merge(r=>{r.options.rounds=1;r.runs=r.runs.filter(r=>r.round===1);});assert.equal(one.run.status,0,one.run.stderr);assert.equal(one.result.status,'incomplete');assert.equal(one.result.manifest,undefined);
 for(const mutate of [
  (r,n)=>{if(n==='all-full')r.hard='failed';},
  (r,n)=>{if(n==='all-full')r.finishedAt=undefined;},
  (r,n)=>{if(n==='all-prefix')r.runs.pop();},
  (r,n)=>{if(n==='classic')r.runs.push(r.runs[0]);},
  (r,n)=>{if(n==='classic')r.runs.reverse();},
  (r,n)=>{if(n==='classic')r.runs=r.runs.filter(r=>r.round!=='verify');},
  (r,n)=>{if(n==='all-full')r.identities.B.commit='other';},
  (r,n)=>{if(n==='all-full')r.runner.attempt='2';},
  (r,n)=>{if(n==='all-prefix')r.runner.invocation='classic';},
  (r,n)=>{if(n==='all-prefix')r.toolHashes['merge-ext-perf-ab.mjs']='drift';},
  (r,n)=>{if(n==='classic')r.runs[0].summary.elapsed++;},
  (r,n)=>{if(n==='all-prefix')r.options.rounds=2;},
 ]){const bad=merge(mutate);assert.notEqual(bad.run.status,0);assert.equal(bad.result.status,'failed');assert.equal(bad.result.manifest,undefined);assert.ok(existsSync(resolve(bad.out,'summary.md')));}
 // Regression cannot freeze; change raw timings and embedded summaries together.
 const {path,result}=shards['all-prefix'];
 for(const r of result.runs.filter(r=>r.side==='B')){r.summary.elapsed=200;const p=resolve(path,`round-${r.round}`,'B-all-prefix.summary.json');const raw=read(p);raw.elapsed=200;write(p,raw);}
 const regression=merge();assert.equal(regression.result.status,'regression',regression.run.stderr);assert.notEqual(regression.run.status,0);assert.equal(regression.result.manifest,undefined);
 // Interrupted/missing artifact produces reviewable aggregate failure.
 const missing=resolve(dir,'missing-output');const failure=spawn('merge-ext-perf-ab.mjs',[missing,shards.classic.path,resolve(dir,'absent'),shards['all-prefix'].path]);assert.notEqual(failure.status,0);assert.equal(read(resolve(missing,'result.json')).status,'failed');
} finally {rmSync(dir,{recursive:true,force:true});}
console.log('Split CLI: three-run merge/freeze/held-out check, one-round diagnostic, cross-runner cases, provenance/partial/drift negatives and regression passed');
