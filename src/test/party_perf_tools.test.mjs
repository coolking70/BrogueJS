import {it,expect} from 'vitest';
import {PARTY_PERF_ID,PARTY_PERF_POLICY,partyShardActors,validatePartyMeasurement,parsePartyPerfOptions,partyRoundSides,comparePartyPair} from '../../scripts/party-perf-identity.mjs';
import {mergePartyAb} from '../../scripts/merge-party-perf-ab.mjs';
import {perfIdentity,loadPerfIdentity} from '../../scripts/ext-perf-selection.mjs';
const stat={n:4,p50:1,p95:2,p99:2,max:2,total:5};
const fixture=()=>({identity:PARTY_PERF_ID,status:'measurement-only',actors:2,mode:'party-only',steps:4,step:{...stat},projection:{...stat},event:{...stat},full:{...stat},encoding:{...stat},flush:{...stat},oos:0,zeroTicks:2,rowsHash:'a'.repeat(64),rngHash:'b'.repeat(64),fullDigest:'c'.repeat(64),sourceHash:'d'.repeat(64),bytes:{save:1,recording:1,partyControl:1,extraActors:1}});
it('routes party through a distinct measurement identity and 1/2/4 shards',()=>{expect(['classic','all-full','all-prefix'].map(partyShardActors)).toEqual([1,2,4]);expect(perfIdentity(PARTY_PERF_ID).accepted).toBe(false);expect(()=>loadPerfIdentity('.',PARTY_PERF_ID)).toThrow('Party uses');});
it('accepts complete short measurements without certifying a budget',()=>{expect(validatePartyMeasurement(fixture(),{actors:2,mode:'party-only',steps:4}).status).toBe('measurement-only');});
it.each(['oos','hash','bytes','samples','timing','status'])('rejects corrupted measurement %s',kind=>{const row=fixture();if(kind==='oos')row.oos=1;if(kind==='hash')row.rowsHash='';if(kind==='bytes')row.bytes.save=-1;if(kind==='samples')row.step.n=3;if(kind==='timing')row.full.p95=NaN;if(kind==='status')row.status='pass';expect(()=>validatePartyMeasurement(row,{actors:2,mode:'party-only',steps:4})).toThrow();});
it('rejects incomplete shard sets before publication',()=>{expect(()=>mergePartyAb('/private/tmp/unused-party-merge',[])).toThrow();});

it('requires no A for calibration-only and keeps A mandatory for paired runs',()=>{
 const args=['--head','b','--out','o'];
 expect(parsePartyPerfOptions([...args,'--calibration-only']).calibrationOnly).toBe(true);
 expect(parsePartyPerfOptions([...args,'--base','a']).calibrationOnly).toBe(false);
 for(const flags of [[],['--calibration-only','--base','a'],['--calibration-only','--calibration-only'],['--calibration-only','--steps','8'],['--calibration-only','--rounds','4'],['--head']])expect(()=>parsePartyPerfOptions([...args,...flags])).toThrow();
 expect(parsePartyPerfOptions([...args,'--calibration-only','--steps','8','--rounds','1']).steps).toBe(8);
});

import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {hash} from '../../scripts/ext-perf-common.mjs';
import {spawnSync} from 'node:child_process';
import {runPartyProfile} from '../../scripts/run-party-perf-ab.mjs';
it('keeps process timeouts and termination diagnostics distinct from semantic failures',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'party-process-test-'));
 try{
  const file=resolve(root,'measurement.json'),args={control:process.cwd(),root,file,mode:'party-only',actors:1,steps:2049};
  const invoke=(code,overrides={})=>(exe,argv,options)=>{
   expect(argv.slice(-3)).toEqual(['party-only','1','2049']);
   expect(options.timeout).toBe(1800000);
   return spawnSync(exe,['-e',code],{...options,...overrides});
  };
  expect(()=>runPartyProfile(args,invoke('setInterval(()=>{},1000)',{timeout:50}))).toThrow('error=ETIMEDOUT');
  const timeout=JSON.parse(readFileSync(file+'.log.json','utf8'));
  expect(timeout.exit).toBeNull();expect(timeout.signal).toBe('SIGTERM');expect(timeout.error.code).toBe('ETIMEDOUT');expect(timeout.elapsedMs).toBeGreaterThan(0);
  expect(()=>runPartyProfile(args,invoke('console.error("OOS regression");process.exit(1)'))).toThrow('OOS regression');
  const oos=JSON.parse(readFileSync(file+'.log.json','utf8'));
  expect(oos.exit).toBe(1);expect(oos.signal).toBeNull();expect(oos.error).toBeNull();
  runPartyProfile(args,invoke('console.log("complete")'));
  expect(JSON.parse(readFileSync(file+'.log.json','utf8')).exit).toBe(0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
it('aggregates B-only calibration, withholds smoke budgets and rejects incomplete or unstable evidence',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'party-calibration-test-'));let serial=0;
 try{
  const tools=Object.fromEntries(['run-party-perf-ab.mjs','profile-party-perf.mjs','party-perf-identity.mjs','merge-party-perf-ab.mjs','ext-perf-common.mjs'].map(name=>[name,hash(readFileSync(resolve('scripts',name),'utf8'))]));
  const merge=({rounds=3,steps=2049,ab=false,mutate=()=>{}}={})=>{
   const dir=resolve(root,String(++serial));mkdirSync(dir);
   const paths=PARTY_PERF_POLICY.shards.map(shard=>{
    const path=resolve(dir,shard);mkdirSync(path);const actors=partyShardActors(shard),sides=ab?['A','B']:['B'];
    const data={identity:PARTY_PERF_ID,policy:PARTY_PERF_POLICY,status:rounds===3?'measured-no-budget':'smoke-only',options:{head:'b',out:path,rounds,steps,shard,calibrationOnly:!ab,...(ab?{base:'a'}:{})},sources:Object.fromEntries(sides.map(side=>[side,{sha:side,sourceHash:'d'.repeat(64)}])),tools,runs:[]};
    for(let round=1;round<=rounds;round++)for(const mode of PARTY_PERF_POLICY.modes)for(const side of partyRoundSides(round,!ab)){
     const row={...fixture(),actors,mode,steps,step:{...stat,n:steps},node:'v24.fixture',machine:{cpu:shard},input:{seed:42,command:PARTY_PERF_POLICY.command},memory:{rss:123,heapUsed:100}};
     data.runs.push({round,side,actors,mode,artifact:`${round}-${side}-${actors}-${mode}.json`,measurement:row});
    }
    mutate(data,shard);
    for(const run of data.runs){const raw=JSON.stringify(run.measurement);writeFileSync(resolve(path,run.artifact),raw);run.artifactHash=hash(raw);}
    writeFileSync(resolve(path,'result.json'),JSON.stringify(data));return path;
   });
   const out=resolve(dir,'merged');return {out,run:()=>mergePartyAb(out,paths)};
  };
  const good=merge(),result=good.run();expect(result.status).toBe('measured-no-budget');expect(result.comparisons).toEqual([]);expect(result.mode).toBe('calibration-only');
  const budget=JSON.parse(readFileSync(resolve(good.out,result.budget),'utf8'));expect(budget.status).toBe('suggested-only');expect(Object.keys(budget.cases)).toHaveLength(6);expect(budget.cases['4/party-all'].timing.step.p95).toEqual({rounds:[2,2,2],medianMs:2,suggestedLimitMs:3});
  for(const config of [{rounds:1,steps:8},{rounds:2}]){const smoke=merge(config).run();expect(smoke.status).toBe('smoke-only');expect(smoke.budget).toBeNull();}
  const paired=merge({ab:true}).run();expect(paired.comparisons).toHaveLength(18);expect(paired.budget).toBeNull();
  for(const mutate of [
   d=>d.runs.pop(),d=>d.runs.reverse(),d=>d.runs.push(d.runs[0]),d=>d.runs[0].side='A',d=>d.status='failed',
   d=>d.options.calibrationOnly=false,d=>d.options.base='unexpected',d=>d.sources.B.sha='different',
   d=>d.tools={...d.tools,'merge-party-perf-ab.mjs':'bad'},d=>d.runs[2].measurement.rngHash='e'.repeat(64),
   d=>d.runs[2].measurement.fullDigest='e'.repeat(64),d=>d.runs[2].measurement.machine={cpu:'other'},d=>d.runs[0].measurement.oos=1,
  ]){
   const bad=merge({mutate:(d,s)=>{if(s==='all-full')mutate(d);}});expect(bad.run).toThrow();
   expect(JSON.parse(readFileSync(resolve(bad.out,'result.json'),'utf8')).status).toBe('failed');expect(existsSync(resolve(bad.out,'summary.md'))).toBe(true);expect(existsSync(resolve(bad.out,'party-perf-budget.suggested.json'))).toBe(false);
  }
 }finally{rmSync(root,{recursive:true,force:true});}
});

it('uses AB/BA/AB and rejects same-format semantic changes before ratios', () => {
 expect([1,2,3].map(n=>partyRoundSides(n))).toEqual([['A','B'],['B','A'],['A','B']]);
 expect(comparePartyPair(fixture(),fixture()).status).toBe('report-only');
 for(const key of ['rowsHash','rngHash','fullDigest','zeroTicks','input']){
  const a=fixture(),b=fixture();b[key]=key==='zeroTicks'?3:key==='input'?{seed:99}:'f'.repeat(64);
  expect(()=>comparePartyPair(a,b)).toThrow();
 }
});
