/** Offline transport repair only; no timing, replay, budget or D6 verdict.
 * node scripts/recalculate-party-window-perf.mjs OUT ORIGINAL_TOOLS_DIR NINE_RESULT_FILES...
 * Original merger bytes are required; every other tool must match unchanged.
 * Raw evidence stays in place, bound by absolute paths and SHA256 hashes. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {hash,write} from './ext-perf-common.mjs';
import {combineRoundReports} from './merge-party-rounds.mjs';
import {merge,readShard,verifyWindowTools,externalizeWindowMeasurements} from './merge-party-window-perf.mjs';

const [output,originalTools,...files]=process.argv.slice(2);
assert.ok(output&&originalTools&&files.length===9,'Expected OUT ORIGINAL_TOOLS_DIR NINE_RESULT_FILES');
const out=resolve(output);
assert.ok(!existsSync(out),'Fresh output required; original evidence is read-only');
const groups=new Map(['classic','all-full','all-prefix'].map(k=>[k,[]]));
const paths=new Map(),evidence=[];
let replacements;
for(const file of files){
 const report=readShard(file,{roundShard:true});
 assert.equal(report.options.rounds,3);assert.equal(report.options.steps,2049);
 const tools=verifyWindowTools(report.tools,{originalTools});
 if(replacements)assert.deepEqual(tools,replacements);else replacements=tools;
 assert.ok(groups.has(report.options.shard),'Unknown shard');
 groups.get(report.options.shard).push(report);
 for(const run of report.runs){
  const key=`${run.round}/${run.side}/${run.measurement.actors}/${run.measurement.mode}`;
  assert.ok(!paths.has(key),'Duplicate measurement');
  paths.set(key,resolve(file,'..',run.artifact));
 }
 evidence.push({file:resolve(file),sha256:hash(readFileSync(file,'utf8'))});
}
const combined=[...groups.values()].map(combineRoundReports),result=merge(combined);
assert.equal(result.status,'measured-no-budget');
const persisted=externalizeWindowMeasurements(result,(run,m)=>paths.get(`${run.round}/${run.side}/${m.actors}/${m.mode}`));
persisted.roundExecution={identity:'independent-round-pairs-v1',environments:Object.fromEntries(combined.map(r=>[r.options.shard,r.roundEnvironments]))};
persisted.recalculation={at:new Date().toISOString(),scope:'Merger transport repair only; all raw hashes, lifecycle, oracles, workload and A/B runner bindings rechecked. Original cloud failure unchanged.',replacements,evidence};
mkdirSync(out,{recursive:true});
for(const name of Object.keys(replacements))copyFileSync(resolve(originalTools,name),resolve(out,'original-'+name));
write(resolve(out,'result.json'),persisted);
console.log(JSON.stringify({status:result.status,measurements:result.runs.length,comparisons:result.comparisons.length,budget:result.budget}));
