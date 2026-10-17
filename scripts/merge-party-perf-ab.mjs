import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdirSync,cpSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {write,hash} from './ext-perf-common.mjs';
import {PARTY_PERF_ID,PARTY_PERF_POLICY,validatePartyMeasurement,partyShardActors} from './party-perf-identity.mjs';
export function mergePartyAb(output,inputs){
 assert.equal(inputs.length,3);const out=resolve(output);assert.ok(!existsSync(out));mkdirSync(out,{recursive:true});
 const results=inputs.map(path=>({path:resolve(path),data:JSON.parse(readFileSync(resolve(path,'result.json'),'utf8'))}));
 assert.deepEqual(results.map(r=>r.data.options.shard).sort(),[...PARTY_PERF_POLICY.shards].sort());
 const first=results[0].data;
 for(const {path,data} of results){
  assert.equal(data.identity,PARTY_PERF_ID);assert.ok(['smoke-only','measured-no-budget'].includes(data.status));assert.deepEqual(data.sources,first.sources);assert.deepEqual(data.tools,first.tools);
  assert.equal(data.options.rounds,first.options.rounds);assert.equal(data.options.steps,first.options.steps);assert.equal(data.runs.length,data.options.rounds*4);
  const keys=new Set();for(const run of data.runs){const key=`${run.round}/${run.side}/${run.mode}`;assert.ok(!keys.has(key));keys.add(key);assert.ok(run.round>=1&&run.round<=data.options.rounds&&['A','B'].includes(run.side)&&PARTY_PERF_POLICY.modes.includes(run.mode));assert.equal(run.actors,partyShardActors(data.options.shard));
   assert.equal(hash(readFileSync(resolve(path,run.artifact),'utf8')),run.artifactHash);const artifact=JSON.parse(readFileSync(resolve(path,run.artifact),'utf8'));assert.deepEqual(artifact,run.measurement);validatePartyMeasurement(artifact,{actors:run.actors,mode:run.mode,steps:data.options.steps});assert.equal(artifact.sourceHash,data.sources[run.side].sourceHash);
  }
  cpSync(path,resolve(out,data.options.shard),{recursive:true});
 }
 const result={identity:PARTY_PERF_ID,status:results.every(r=>r.data.status==='measured-no-budget')?'measured-no-budget':'smoke-only',budget:null,sources:first.sources,tools:first.tools,shards:results.map(r=>r.data.options.shard),comparisons:results.flatMap(({data})=>Array.from({length:data.options.rounds},(_,index)=>PARTY_PERF_POLICY.modes.map(mode=>{const a=data.runs.find(r=>r.round===index+1&&r.side==='A'&&r.mode===mode).measurement,b=data.runs.find(r=>r.round===index+1&&r.side==='B'&&r.mode===mode).measurement;return {round:index+1,actors:a.actors,mode,comparable:a.rowsHash===b.rowsHash&&a.rngHash===b.rngHash,commandP95Ratio:a.step.p95?b.step.p95/a.step.p95:null,status:'report-only'};})).flat())};write(resolve(out,'result.json'),result);writeFileSync(resolve(out,'summary.md'),`# Party A/B: ${result.status}\n\nThree actor-count shards validated. No frozen budget and no performance pass.\n`);return result;
}
