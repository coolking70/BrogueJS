import assert from 'node:assert/strict';
export const PARTY_PERF_ID='party-v1';
export const PARTY_PERF_POLICY=Object.freeze({schema:1,id:PARTY_PERF_ID,seed:42,actors:[1,2,4],modes:['party-only','party-all'],command:'ready-actor-wait-v1',steps:2049,budget:'measurement-only; P1b thresholds pending',shards:['classic','all-full','all-prefix']});
export function partyShardActors(shard){assert.ok(PARTY_PERF_POLICY.shards.includes(shard),'Unknown party shard');return PARTY_PERF_POLICY.actors[PARTY_PERF_POLICY.shards.indexOf(shard)];}
export function validatePartyMeasurement(row,{actors,mode,steps}){
 assert.equal(row.identity,PARTY_PERF_ID);assert.equal(row.actors,actors);assert.equal(row.mode,mode);assert.equal(row.steps,steps);assert.equal(row.step.n,steps);assert.equal(row.oos,0);
 for(const key of ['rowsHash','rngHash','fullDigest','sourceHash'])assert.match(row[key],/^[a-f0-9]{64}$/);
 for(const key of ['save','recording','partyControl','extraActors'])assert.ok(Number.isSafeInteger(row.bytes[key])&&row.bytes[key]>=0);
 for(const field of ['step','projection','event','full','encoding','flush']){const stat=row[field];assert.ok(Number.isSafeInteger(stat.n)&&stat.n>0);for(const key of ['p50','p95','p99','max','total'])assert.ok(Number.isFinite(stat[key])&&stat[key]>=0);assert.ok(stat.p50<=stat.p95&&stat.p95<=stat.p99&&stat.p99<=stat.max);}
 assert.ok(row.zeroTicks>=0&&row.zeroTicks<=steps);assert.equal(row.status,'measurement-only');return row;
}
