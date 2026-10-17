import assert from 'node:assert/strict';
import {perfIdentity,pendingPerfBaseline} from './ext-perf-selection.mjs';
import {stats} from './ext-perf-common.mjs';

export const policyVersion='D6-2026-10-16';
export const timingPolicy='Same runner only; P95 +10%, objective-round P99 / command max +25%, elapsed +10%, minimum 1ms. Any metric crossing in >=2 of 3 comparable rounds means regression. Full routes with different event/objective-block counts are report-only; the identical input prefix decides. Absolute times report only.';

// Post-process the unchanged observer output: never change instrumentation or
// substitute P95/max when old summaries lack P99. Nearest-rank, as for P95.
export function withObjectiveP99(summary,rounds) {
 const s=structuredClone(summary);
 assert.equal(rounds.length,s.semantic.rounds,'Objective round count drift');
 assert.ok(rounds.length>0&&rounds.every(r=>Number.isFinite(r.ms)&&r.ms>=0),'Invalid objective timings');
 const enrich=(target,rows)=>{
  const values=rows.map(r=>r.ms),observed=stats(values);
  for(const k of Object.keys(observed))assert.equal(target[k],observed[k],`Objective summary drift (${k})`);
  assert.ok(values.length>0,'Empty objective scene');
  target.p99=values.toSorted((a,b)=>a-b)[Math.ceil(values.length*.99)-1];
 };
 assert.deepEqual(Object.keys(s.roundDepth).sort(),[...new Set(rounds.map(r=>String(r.depth)))].sort(),'Objective depths drift');
 enrich(s.round,rounds);
 for(const [depth,target]of Object.entries(s.roundDepth))enrich(target,rounds.filter(r=>String(r.depth)===depth));
 return s;
}

export function parseOptions(args) {
 const options={rounds:3,cases:['classic','all'],limit:0,baseIdentity:'p0',headIdentity:'6b4'};
 const seen=new Set();
 for(let i=0;i<args.length;i+=2){
  const key=args[i];assert.ok(['--base','--head','--out','--rounds','--case','--limit','--base-identity','--head-identity','--head-source-hash','--shard'].includes(key)&&!seen.has(key),`Unknown/duplicate option ${key}`);
  seen.add(key);assert.ok(args[i+1]&&!args[i+1].startsWith('--'),`Missing ${key}`);
  if(key==='--case'){assert.ok(['classic','all','both'].includes(args[i+1]));options.cases=args[i+1]==='both'?['classic','all']:[args[i+1]];}
  else if(key==='--base-identity'||key==='--head-identity'){perfIdentity(args[i+1]);options[key==='--base-identity'?'baseIdentity':'headIdentity']=args[i+1];}
  else if(key==='--head-source-hash')options.headSourceHash=args[i+1];
  else options[key.slice(2)]=['--rounds','--limit'].includes(key)?Number(args[i+1]):args[i+1];
 }
 assert.notEqual(options.baseIdentity,options.headIdentity,'Conflicting A/B identities');
 assert.ok(perfIdentity(options.baseIdentity).accepted||pendingPerfBaseline(options.baseIdentity,options.headIdentity),'A must be a reviewed identity or the explicit pending C3/C4 comparison');
 assert.ok(options.base&&options.head&&options.out,'Expected --base --head --out');
 assert.ok(Number.isSafeInteger(options.rounds)&&options.rounds>=1&&options.rounds<=3,'rounds must be 1..3; only 3 can pass D6');
 assert.ok(Number.isSafeInteger(options.limit)&&options.limit>=0&&options.limit<=1714,'limit must be 0..1714 (0 = complete)');
 if(options.shard!==undefined){
  assert.ok(['classic','all-full','all-prefix'].includes(options.shard),'Unknown shard');
  assert.ok(!seen.has('--case')&&!options.headSourceHash,'Shard selects its own cases; immutable checkouts only');
  options.cases=options.shard==='classic'?['classic']:['all'];
 }
 if(options.headSourceHash!==undefined){assert.match(options.headSourceHash,/^[a-f0-9]{64}$/);assert.equal(options.rounds,1);assert.deepEqual(options.cases,['classic','all']);}
 return options;
}

export function counts(summary,metrics) {
 assert.ok(Object.keys(summary.segments).every(k=>metrics.includes(k)),'Unknown counter');
 return Object.fromEntries(metrics.map(k=>{
  const n=summary.segments[k]?.calls??0;assert.ok(Number.isSafeInteger(n)&&n>=0,`Invalid count ${k}`);return [k,n];
 }));
}

export function validateRun(s,{recordingHash,events,metrics,previous}) {
 assert.equal(s.mode,'wall');assert.equal(s.oos,0);assert.equal(s.recordingHash,recordingHash);assert.equal(s.events,events);
 assert.equal(s.command.n,events);assert.ok(s.semantic&&Object.keys(s.semantic).length>0);
 for(const v of [s.elapsed,...['p50','p95','max'].map(k=>s.command[k])])assert.ok(Number.isFinite(v)&&v>=0,'Invalid timing');
 const work=counts(s,metrics);
 if(previous){
  for(const k of ['node','machine','sourceHash','semantic','diagnostics'])assert.deepEqual(s[k],previous[k],`Unstable ${k}`);
  assert.deepEqual(work,counts(previous,metrics),'Unstable work counts');
 }
 return work;
}

// All values are milliseconds, including elapsed. Strict > retains the 1ms band.
export function compareTiming(a,b,{complete=true}={}) {
 const scenes=['command','round',...(complete?['depth.20','roundDepth.20']:[])];
 const values=[];
 for(const scene of scenes){
  const get=s=>scene.split('.').reduce((v,k)=>v?.[k],s);
  const tail=scene==='round'||scene.startsWith('roundDepth.')?'p99':'max';
  for(const [metric,fraction]of [['p95',.1],[tail,.25]])values.push({metric:`${scene}.${metric}`,a:get(a)?.[metric],b:get(b)?.[metric],fraction});
 }
 values.push({metric:'elapsed',a:a.elapsed,b:b.elapsed,fraction:.1});
 return values.map(v=>{
  assert.ok(Number.isFinite(v.a)&&v.a>=0&&Number.isFinite(v.b)&&v.b>=0,`Missing/invalid ${v.metric}`);
  const threshold=v.a+Math.max(1,v.a*v.fraction);
  return {...v,delta:v.b-v.a,relative:v.a===0?null:v.b/v.a-1,threshold,exceeded:v.b>threshold};
 });
}

export function decide(pairs) {
 assert.ok(pairs.length>=1&&pairs.length<=3);
 const exceededRounds=pairs.filter(p=>p.some(v=>v.exceeded)).length;
 return {exceededRounds,status:exceededRounds>=2?'regression':pairs.length===3?'pass':'incomplete'};
}

export function canFreeze({options,gates,hard}) {
 if(options.headSourceHash!==undefined||pendingPerfBaseline(options.baseIdentity,options.headIdentity))return false;
 return hard==='pass'&&options.rounds===3&&options.limit===0&&options.cases.join(',')==='classic,all'
  &&gates.length===3&&['classic/full','all/full','all/prefix'].every(key=>gates.some(g=>`${g.id}/${g.kind}`===key
   &&g.pairs?.length===3
   &&(g.status==='pass'||key==='all/full'&&g.status==='report-only'&&g.workloadChanged===true)));
}

export function kindsFor(options,id) {
 return id==='classic'?['full']:options.shard==='all-full'?['full']:options.shard==='all-prefix'?['prefix']:['full','prefix'];
}

export function evaluateGates(runs,options) {
 const gates=[];
 for(const id of options.cases)for(const kind of kindsFor(options,id)){
  const pairs=[],workloads=[];
  for(let round=1;round<=options.rounds;round++){
   const select=side=>{const rows=runs.filter(r=>r.id===id&&r.kind===kind&&r.round===round&&r.side===side);assert.ok(rows.length<=1,'Duplicate A/B run');return rows[0]?.summary;};
   const a=select('A'),b=select('B');
   if(!a||!b)continue;
   for(const k of ['node','machine'])assert.deepEqual(a[k],b[k],`Different A/B ${k}`);
   const work=s=>({events:s.events,blocks:s.semantic.blocks,rounds:s.semantic.rounds});
   assert.ok([...Object.values(work(a)),...Object.values(work(b))].every(n=>Number.isSafeInteger(n)&&n>=0),'Invalid workload counts');
   const changed=Object.keys(work(a)).some(k=>work(a)[k]!==work(b)[k]);
   if(id==='classic'||kind==='prefix'){
    assert.equal(changed,false,'Comparable workload counts drift');
    for(const k of ['rowsHash','rng','blocks','rounds','roundTicks'])assert.deepEqual(a.semantic[k],b.semantic[k],`Comparable load drift (${k})`);
   }
   workloads.push({round,a:work(a),b:work(b),changed});
   pairs.push(compareTiming(a,b,{complete:!options.limit&&kind==='full'}));
  }
  if(!pairs.length)continue;
  const verdict=decide(pairs),workloadChanged=workloads.some(w=>w.changed);
  const reportOnly=id==='all'&&kind==='full'&&workloadChanged;
  gates.push({id,kind,pairs,workloads,workloadChanged,...verdict,timingStatus:verdict.status,status:reportOnly?'report-only':verdict.status});
 }
 return gates;
}

export function overallStatus(result) {
 if(result.hard!=='pass')return result.hard==='failed'?'failed':'incomplete';
 return result.gates.some(g=>g.status==='regression')?'regression':canFreeze(result)?'pass':'incomplete';
}
