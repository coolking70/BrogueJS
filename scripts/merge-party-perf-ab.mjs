import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdirSync,cpSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {write,hash} from './ext-perf-common.mjs';
import {PARTY_PERF_ID,PARTY_PERF_POLICY,validatePartyMeasurement,partyShardActors,parsePartyPerfOptions,assertStablePartyMeasurement} from './party-perf-identity.mjs';

// Proposals only: observed medians plus conservative max-of-three headroom.
// P1b must review these; no D6 comparison or automatic budget adoption.
function suggestBudget(cases,sources,tools){
 const median=values=>values.toSorted((a,b)=>a-b)[1];
 return {identity:PARTY_PERF_ID,status:'suggested-only',sources,tools,policy:PARTY_PERF_POLICY,
  method:'Three complete B rounds per scene. Reference = median; proposed timing limit = largest observation + max(1ms, 10% for P50/P95, 25% for P99/max). Bytes/memory = observed maximum. Report-only; P1b review required, no held-out verification or A/B verdict.',
  cases:Object.fromEntries(cases.map(({actors,mode,runs})=>[`${actors}/${mode}`,{
   actors,mode,node:runs[0].node,machine:runs[0].machine,input:runs[0].input,rowsHash:runs[0].rowsHash,rngHash:runs[0].rngHash,fullDigest:runs[0].fullDigest,
   timing:Object.fromEntries(['step','projection','event','full','encoding','flush'].map(field=>[field,Object.fromEntries(['p50','p95','p99','max'].map(metric=>{
    const values=runs.map(r=>r[field][metric]),max=Math.max(...values);return [metric,{rounds:values,medianMs:median(values),suggestedLimitMs:max+Math.max(1,max*(['p50','p95'].includes(metric)?.1:.25))}];
   }))])),
   maximumBytes:Object.fromEntries(Object.keys(runs[0].bytes).map(key=>[key,Math.max(...runs.map(r=>r.bytes[key]))])),
   maximumMemoryBytes:Object.fromEntries(Object.keys(runs[0].memory).map(key=>[key,Math.max(...runs.map(r=>r.memory[key]))]))
  }]))};
}
export function mergePartyAb(output,inputs){
 assert.equal(inputs.length,3);const out=resolve(output);assert.ok(!existsSync(out));
 for(const input of inputs){const p=relative(resolve(input),out);assert.ok(p==='..'||p.startsWith('../'),'Output must be outside input artifacts');}
 mkdirSync(out,{recursive:true});
 const result={identity:PARTY_PERF_ID,status:'running',budget:null,comparisons:[],cases:[]};
 try{
  const results=inputs.map(path=>({path:resolve(path),data:JSON.parse(readFileSync(resolve(path,'result.json'),'utf8'))}));
  assert.deepEqual(results.map(r=>r.data.options.shard).sort(),[...PARTY_PERF_POLICY.shards].sort());
  const first=results[0].data,calibrationOnly=first.options.calibrationOnly===true,sides=calibrationOnly?['B']:['A','B'];
  Object.assign(result,{mode:calibrationOnly?'calibration-only':'ab',sources:first.sources,tools:first.tools,shards:results.map(r=>r.data.options.shard)});
  for(const {path,data} of results){
   const options=data.options;
   parsePartyPerfOptions(['--head',options.head,'--out',options.out,'--rounds',String(options.rounds),'--steps',String(options.steps),'--shard',options.shard,...(options.calibrationOnly?['--calibration-only',...(options.base?['--base',options.base]:[])]:['--base',options.base])]);
   assert.equal(options.calibrationOnly===true,calibrationOnly,'Mixed measurement modes');
   assert.equal(data.identity,PARTY_PERF_ID);assert.deepEqual(data.policy,PARTY_PERF_POLICY);
   assert.equal(data.status,options.rounds===3&&options.steps===PARTY_PERF_POLICY.steps?'measured-no-budget':'smoke-only');
   assert.deepEqual(Object.keys(data.sources).sort(),sides);assert.deepEqual(data.sources,first.sources);assert.deepEqual(data.tools,first.tools);
   for(const [tool,digest] of Object.entries(data.tools))assert.equal(hash(readFileSync(new URL(tool,import.meta.url),'utf8')),digest,`Tool drift ${tool}`);
   assert.ok(data.tools['merge-party-perf-ab.mjs'],'Missing merge tool provenance');
   assert.equal(options.rounds,first.options.rounds);assert.equal(options.steps,first.options.steps);
   const expected=[];for(let round=1;round<=options.rounds;round++)for(const mode of PARTY_PERF_POLICY.modes)for(const side of sides)expected.push({round,side,mode});
   assert.deepEqual(data.runs.map(({round,side,mode})=>({round,side,mode})),expected,'Missing/duplicate/reordered observations');
   const previous=new Map();
   for(const run of data.runs){
    assert.equal(run.actors,partyShardActors(options.shard));
    assert.equal(run.artifact,`${run.round}-${run.side}-${run.actors}-${run.mode}.json`);
    const raw=readFileSync(resolve(path,run.artifact),'utf8');assert.equal(hash(raw),run.artifactHash);
    const artifact=JSON.parse(raw);assert.deepEqual(artifact,run.measurement);validatePartyMeasurement(artifact,{actors:run.actors,mode:run.mode,steps:options.steps});assert.equal(artifact.sourceHash,data.sources[run.side].sourceHash);
    const key=`${run.side}/${run.mode}`;if(previous.has(key))assertStablePartyMeasurement(artifact,previous.get(key));else previous.set(key,artifact);
   }
   for(const mode of PARTY_PERF_POLICY.modes){
    result.cases.push({actors:partyShardActors(options.shard),mode,runs:data.runs.filter(r=>r.side==='B'&&r.mode===mode).map(r=>r.measurement)});
    if(!calibrationOnly)for(let round=1;round<=options.rounds;round++){
     const select=side=>data.runs.find(r=>r.round===round&&r.side===side&&r.mode===mode).measurement,a=select('A'),b=select('B');
     result.comparisons.push({round,actors:a.actors,mode,comparable:a.rowsHash===b.rowsHash&&a.rngHash===b.rngHash,commandP95Ratio:a.step.p95?b.step.p95/a.step.p95:null,status:'report-only'});
    }
   }
   cpSync(path,resolve(out,options.shard),{recursive:true});
  }
  result.status=first.status;
  if(calibrationOnly&&result.status==='measured-no-budget'){
   const name='party-perf-budget.suggested.json';write(resolve(out,name),suggestBudget(result.cases,result.sources,result.tools));result.budget=name;
  }
 }catch(error){result.status='failed';result.error=String(error);throw error;}
 finally{
  write(resolve(out,'result.json'),result);
  const lines=[`# Party ${result.mode??'measurement'}: ${result.status}`,'','No frozen budget, A/B verdict or P1a performance pass.',
   '', '| Actors / scene | B rounds | Step P95 ms (each round) | Full P95 ms (each round) |','| --- | --- | --- | --- |',
   ...result.cases.map(c=>`| ${c.actors} / ${c.mode} | ${c.runs.length} | ${c.runs.map(r=>r.step.p95.toFixed(3)).join(' / ')} | ${c.runs.map(r=>r.full.p95.toFixed(3)).join(' / ')} |`),
   '',result.budget?`Provisional suggestion: [${result.budget}](${result.budget}). Three complete B rounds; P1b review required. No held-out verification.`:'No suggested budget. Calibration requires all six scenes with three complete B rounds of 2049 commands.',result.error??''];
  writeFileSync(resolve(out,'summary.md'),lines.join('\n')+'\n');
 }
 return result;
}
