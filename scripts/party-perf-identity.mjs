import assert from 'node:assert/strict';
import {CROSSFORMAT_ID,compareCrossformatProof,assertStableCrossformat} from './party-perf-crossformat.mjs';
export const PARTY_PERF_ID='party-v1';
export const PARTY_PERF_POLICY=Object.freeze({schema:1,id:PARTY_PERF_ID,seed:42,actors:[1,2,4],modes:['party-only','party-all'],command:'ready-actor-wait-v1',steps:2049,budget:'measurement-only; P1b thresholds pending',shards:['classic','all-full','all-prefix']});
export function partyShardActors(shard){assert.ok(PARTY_PERF_POLICY.shards.includes(shard),'Unknown party shard');return PARTY_PERF_POLICY.actors[PARTY_PERF_POLICY.shards.indexOf(shard)];}
export function parsePartyPerfOptions(args){
 const options={rounds:3,steps:PARTY_PERF_POLICY.steps,calibrationOnly:false,comparison:'strict'},seen=new Set();
 for(let i=0;i<args.length;i++){
  const key=args[i];assert.ok(['--base','--head','--out','--rounds','--steps','--shard','--calibration-only','--comparison'].includes(key)&&!seen.has(key),'Unknown/duplicate party option');seen.add(key);
  if(key==='--calibration-only'){options.calibrationOnly=true;continue;}
  const value=args[++i];assert.ok(value&&!value.startsWith('--'),`Missing ${key}`);options[key.slice(2)]=['--rounds','--steps'].includes(key)?Number(value):value;
 }
 assert.ok(options.head&&options.out,'Expected --head --out');
 assert.ok(options.calibrationOnly?!seen.has('--base'):!!options.base,'A/B requires --base; calibration-only must omit --base');
 assert.ok([1,2,3].includes(options.rounds));assert.ok(Number.isInteger(options.steps)&&options.steps>0&&options.steps<=PARTY_PERF_POLICY.steps);
 if(options.steps!==PARTY_PERF_POLICY.steps)assert.equal(options.rounds,1,'Short runs are smoke-only');
 assert.ok(['strict',CROSSFORMAT_ID].includes(options.comparison),'Unknown comparison identity');
 if(options.comparison!== 'strict')assert.ok(!options.calibrationOnly,'Cross-format proof requires A/B');
 if(options.shard)partyShardActors(options.shard);
 return options;
}
export function assertStablePartyMeasurement(row,previous){
 assertStableCrossformat(row,previous);
 for(const key of ['rowsHash','rngHash','fullDigest','input','zeroTicks','node','machine','sourceHash'])assert.deepEqual(row[key],previous[key],`Unstable party ${key} across rounds`);
}
export function validatePartyMeasurement(row,{actors,mode,steps}){
 assert.equal(row.identity,PARTY_PERF_ID);assert.equal(row.actors,actors);assert.equal(row.mode,mode);assert.equal(row.steps,steps);assert.equal(row.step.n,steps);assert.equal(row.oos,0);
 for(const key of ['rowsHash','rngHash','fullDigest','sourceHash'])assert.match(row[key],/^[a-f0-9]{64}$/);
 for(const key of ['save','recording','partyControl','extraActors'])assert.ok(Number.isSafeInteger(row.bytes[key])&&row.bytes[key]>=0);
 for(const field of ['step','projection','event','full','encoding','flush']){const stat=row[field];assert.ok(Number.isSafeInteger(stat.n)&&stat.n>0);for(const key of ['p50','p95','p99','max','total'])assert.ok(Number.isFinite(stat[key])&&stat[key]>=0);assert.ok(stat.p50<=stat.p95&&stat.p95<=stat.p99&&stat.p99<=stat.max);}
 assert.ok(row.zeroTicks>=0&&row.zeroTicks<=steps);assert.equal(row.status,'measurement-only');return row;
}

export function partyRoundSides(round, calibrationOnly = false) {
 assert.ok([1, 2, 3].includes(round));
 return calibrationOnly ? ['B'] : round % 2 ? ['A', 'B'] : ['B', 'A'];
}
export function comparePartyPair(a, b, comparison = 'strict') {
 assert.ok(['strict',CROSSFORMAT_ID].includes(comparison));
 const proof=comparison===CROSSFORMAT_ID?compareCrossformatProof(a,b):null;
 for (const key of ['identity', 'actors', 'mode', 'steps', ...(proof?[]:['input','fullDigest']), 'rowsHash', 'rngHash', 'zeroTicks', 'node', 'machine'])
  assert.deepEqual(a[key], b[key], `A/B party drift ${key}`);
 return {comparable:true,...(proof?{proof}:{}),commandP95Ratio:a.step.p95?b.step.p95/a.step.p95:null,fullP95Ratio:a.full.p95?b.full.p95/a.full.p95:null,status:'report-only'};
}
