/** Transport adapter for one actor-count/round per hosted job. A and B stay on
 * the same runner, with AB/BA/AB order. Existing mergers still recheck every raw
 * observation, lifecycle, source/tool identity and all requested rounds. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,cpSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {write,hash} from './ext-perf-common.mjs';

export function verifyRoundEnvironments(report) {
 if(!report.roundSharded){assert.equal(report.roundEnvironments,undefined);return;}
 assert.equal(report.roundSharded,true);
 assert.ok(report.tools?.['merge-party-rounds.mjs'],'Missing round transport provenance');
 assert.equal(report.roundEnvironments?.length,report.options.rounds,'Missing round environments');
 assert.deepEqual(report.roundEnvironments.map(e=>e.round),Array.from({length:report.options.rounds},(_,i)=>i+1));
 for(const run of report.runs){
  const environment=report.roundEnvironments[run.round-1];
  assert.match(environment.node,/^v24\./);
  assert.deepEqual({node:run.measurement.node,machine:run.measurement.machine},{node:environment.node,machine:environment.machine},'Round runner binding changed');
 }
}

export function combineRoundReports(reports) {
 assert.ok(reports.length>0,'Missing round reports');
 const first=reports[0],o=first.options;
 for(const report of reports)assert.equal(report.status,'round-complete',`Shard ${report.options?.shard??'unknown'} round ${report.options?.roundIndex??'?'} ${report.status}: ${report.error??'incomplete'}`);
 assert.ok([1,2,3].includes(o.rounds));assert.equal(reports.length,o.rounds,'Missing round');
 assert.deepEqual(reports.map(r=>r.options.roundIndex).sort(),Array.from({length:o.rounds},(_,i)=>i+1),'Duplicate/missing round');
 const combined=structuredClone(first);delete combined.options.roundIndex;combined.runs=[];combined.comparisons=[];combined.roundSharded=true;combined.roundEnvironments=[];
 for(const report of [...reports].sort((a,b)=>a.options.roundIndex-b.options.roundIndex)){
  const options={...report.options};delete options.roundIndex;delete options.out;
  const expected={...combined.options};delete expected.out;
  assert.deepEqual(options,expected,'Round options drift');
  for(const key of ['identity','policy','mode','source','sources','tools'])assert.deepEqual(report[key],first[key],`Round ${key} drift`);
  assert.ok(Array.isArray(report.runs)&&report.runs.length>0,'Missing round observations');
  const environment={node:report.runs[0].measurement?.node,machine:report.runs[0].measurement?.machine};
  assert.match(environment.node,/^v24\./,'Round runner must use Node 24');
  for(const run of report.runs){assert.equal(run.round,report.options.roundIndex,'Wrong round observation');assert.deepEqual({node:run.measurement.node,machine:run.measurement.machine},environment,'Mixed runner within one round');}
  combined.roundEnvironments.push({round:report.options.roundIndex,...environment});
  combined.runs.push(...report.runs);combined.comparisons.push(...report.comparisons);
 }
 combined.status=o.rounds===3&&o.steps===2049?'measured-no-budget':'smoke-only';
 return combined;
}

export function mergeRoundArtifacts(out,inputs) {
 assert.ok(!existsSync(out),'Fresh aggregate directory required');mkdirSync(out,{recursive:true});
 try {
  const groups=new Map(['classic','all-full','all-prefix'].map(k=>[k,[]]));
  for(const path of inputs){
   const report=JSON.parse(readFileSync(resolve(path,'result.json'),'utf8'));
   assert.equal(report.status,'round-complete',`Shard ${basename(path)} ${report.status}: ${report.error??'incomplete'}`);
   assert.ok(groups.has(report.options?.shard),'Unknown shard');groups.get(report.options.shard).push({path,report});
  }
  const paths=[];
  for(const [shard,entries]of groups){
   const combined=combineRoundReports(entries.map(e=>e.report)),dir=resolve(out,'combined',shard);mkdirSync(dir,{recursive:true});paths.push(dir);
   for(const {path,report}of entries){
    cpSync(path,resolve(out,'round-shards',`${shard}-${report.options.roundIndex}`),{recursive:true});
    for(const name of readdirSync(path)){
     if(['result.json','summary.md'].includes(name))continue;
     const dest=resolve(dir,name);
     if(existsSync(dest))assert.equal(hash(readFileSync(dest)),hash(readFileSync(resolve(path,name))),'Conflicting round artifact');
     else cpSync(resolve(path,name),dest,{recursive:true});
    }
   }
   write(resolve(dir,'result.json'),combined);
  }
  const party=JSON.parse(readFileSync(resolve(paths[0],'result.json'),'utf8')).identity==='party-v1';
  const target=resolve(out,'verified'),script=party?'merge-ext-perf-ab.mjs':'merge-party-window-perf.mjs';
  const child=spawnSync(process.execPath,[fileURLToPath(new URL(script,import.meta.url)),target,...paths.map(p=>party?p:resolve(p,'result.json'))],{encoding:'utf8',maxBuffer:16*1024*1024});
  assert.equal(child.status,0,`Round aggregate failed: ${child.stderr}`);
  const result=JSON.parse(readFileSync(resolve(target,'result.json'),'utf8'));
  result.roundExecution={identity:'independent-round-pairs-v1',environments:Object.fromEntries(paths.map(p=>{const r=JSON.parse(readFileSync(resolve(p,'result.json'),'utf8'));return [r.options.shard,r.roundEnvironments];}))};
  write(resolve(out,'result.json'),result);
  writeFileSync(resolve(out,'summary.md'),readFileSync(resolve(target,'summary.md'),'utf8')+'\nA/B pairs share one runner. Rounds are independent jobs; compare paired ratios, not absolute times across runners. Original round shards and verified combined evidence are retained.\n');
 }catch(error){write(resolve(out,'result.json'),{status:'failed',hard:'failed',error:String(error),shards:inputs});writeFileSync(resolve(out,'summary.md'),`# Party aggregate failed\n\n${error}\n\nNo performance verdict or budget.\n`);throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))mergeRoundArtifacts(resolve(process.argv[2]),process.argv.slice(3));
