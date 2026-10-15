/** Serial, opt-in deterministic performance gate. Absolute time is report-only.
 * node scripts/check-ext-perf.mjs INPUT_DIR OUTPUT_DIR [--regenerate]
 * Raw recordings/results stay outside the repository. */
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {hash} from './ext-perf-common.mjs';
const [inputDir,outputDir,flag]=process.argv.slice(2);
assert.ok(inputDir&&outputDir,'Expected input and output directories');
assert.ok(flag===undefined||flag==='--regenerate');
const manifest=JSON.parse(readFileSync(new URL('./ext-perf-budget.json',import.meta.url),'utf8'));
assert.equal(hash(['profile-ext-perf.mjs','ext-perf-common.mjs'].map(name=>readFileSync(new URL(name,import.meta.url),'utf8')).join('\0')),manifest.instrumentationHash,'Instrumentation drift: recalibration required');
mkdirSync(inputDir,{recursive:true});mkdirSync(outputDir,{recursive:true});
const run=(script,args)=>{const result=spawnSync(process.execPath,['--max-old-space-size=3072',script,...args],{stdio:'inherit'});if(result.error)throw result.error;assert.equal(result.status,0,`${script} failed (${result.signal??result.status})`);};
const checks=[];
for(const [id,benchmark]of Object.entries(manifest.cases)){
 const input=resolve(inputDir,`${id}-${benchmark.source.seed}.recording.json`),prefix=resolve(outputDir,id);
 if(flag)run('scripts/regenerate-ext-perf.mjs',[`scripts/perf/ext-late-${id}.route.json`,input]);
 run('scripts/profile-ext-perf.mjs',[input,prefix]);checks.push(`${id}=${prefix}`);
}
run('scripts/ext-perf-budget.mjs',['check','scripts/ext-perf-budget.json',...checks]);
