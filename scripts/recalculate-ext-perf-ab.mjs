/** Offline D6 adjudication; raw artifacts are read-only, output must be new.
 * node scripts/recalculate-ext-perf-ab.mjs RESULT_JSON OUTPUT_DIR [--freeze]
 * Freeze reuses the first three full B runs, NOT an independent fourth replay. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {hash,write} from './ext-perf-common.mjs';
import {validateRun,withObjectiveP99,evaluateGates,overallStatus,policyVersion,timingPolicy} from './ext-perf-ab-policy.mjs';

const [input,output,flag,...extra]=process.argv.slice(2);
assert.ok(input&&output&&!extra.length&&(flag===undefined||flag==='--freeze'),'Expected RESULT_JSON OUTPUT_DIR [--freeze]');
const artifact=dirname(resolve(input)),out=resolve(output),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(!existsSync(out),'Use a fresh output directory; never overwrite evidence');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const original=read(input),metrics=read(resolve(root,'scripts/ext-perf-budget.json')).metrics;
assert.equal(original.hard,'pass','Cannot recalculate incomplete/failed hard evidence as a pass');
assert.ok(['pass','regression'].includes(original.status)&&original.finishedAt,'Incomplete A/B artifact');
assert.ok(original.steps.length>0&&original.steps.every(s=>s.status==='pass'),'Failed/incomplete artifact steps');
assert.ok(Number.isInteger(original.options.rounds)&&original.options.rounds>=1&&original.options.rounds<=3);
assert.ok(original.options.cases.length>0&&new Set(original.options.cases).size===original.options.cases.length&&original.options.cases.every(id=>['classic','all'].includes(id)));
assert.equal(original.instrumentationHash,hash(['profile-ext-perf.mjs','ext-perf-common.mjs'].map(n=>readFileSync(resolve(root,'scripts',n),'utf8')).join('\0')),'Observer drift');
const runs=[],evidence=[],first=new Map();
// Enumerate expected slots, not whatever rows happen to remain in the artifact.
for(let round=1;round<=original.options.rounds;round++)for(const id of original.options.cases)for(const side of ['A','B'])for(const kind of id==='all'?['full','prefix']:['full']){
 const rows=original.runs.filter(r=>r.round===round&&r.id===id&&r.side===side&&r.kind===kind);
 assert.equal(rows.length,1,'Missing/duplicate artifact run');
 const key=`${side}-${id}-${kind}`,prefix=resolve(artifact,`round-${round}`,key);
 const raw=read(prefix+'.summary.json'),rounds=read(prefix+'.rounds.json');
 const summary=withObjectiveP99(raw,rounds);
 assert.deepEqual(summary,withObjectiveP99(rows[0].summary,rounds),'Result/summary mismatch');
 const recording=read(resolve(artifact,'inputs',key+'.json'));
 const contract=original.inputs[key];
 assert.equal(hash(recording),contract.recordingHash,'Artifact input drift');
 assert.equal(recording.events.length,contract.events);
 validateRun(summary,{...contract,metrics,previous:first.get(key)});
 first.set(key,summary);
 runs.push({...rows[0],prefix,summary});
 evidence.push({round,id,side,kind,summarySha256:hash(readFileSync(prefix+'.summary.json','utf8')),roundsSha256:hash(readFileSync(prefix+'.rounds.json','utf8'))});
}
const gates=evaluateGates(runs,original.options);
const result={...original,runs,gates,policyVersion,policy:timingPolicy,
 recalculation:{at:new Date().toISOString(),originalStatus:original.status,originalResultSha256:hash(readFileSync(input,'utf8')),policyHash:hash(readFileSync(new URL('./ext-perf-ab-policy.mjs',import.meta.url),'utf8')),evidence,independentPostFreezeReplay:false}};
delete result.manifest;
result.status=overallStatus(result);
mkdirSync(out,{recursive:true});
if(flag==='--freeze'){
 assert.equal(result.status,'pass','Only complete passing adjudication can freeze');
 assert.equal(result.runner.runId,'38860207834','Offline freeze acceptance is specific to the reviewed 6B4 run');
 assert.equal(execFileSync('git',['rev-parse','HEAD:src'],{cwd:root,encoding:'utf8'}).trim(),result.identities.B.srcTree,'Current engine differs from B');
 assert.equal(execFileSync('git',['diff','HEAD','--','src'],{cwd:root,encoding:'utf8'}),'','Dirty current engine');
 const manifest=resolve(out,'ext-perf-6b4-budget.json');
 const cli=(...args)=>execFileSync(process.execPath,[resolve(root,'scripts/ext-perf-budget.mjs'),...args],{cwd:root,encoding:'utf8'});
 cli('freeze',manifest,...['classic','all'].map(id=>`${id}=${resolve(root,`scripts/perf/ext-6b4-late-${id}.source.json`)},${[1,2,3].map(n=>resolve(artifact,`round-${n}`,`B-${id}-full`)).join(',')}`));
 const frozen=read(manifest);
 frozen.provenance={runId:result.runner.runId,attempt:result.runner.attempt,url:`https://github.com/coolking70/BrogueJS/actions/runs/${result.runner.runId}`,
  identities:result.identities,runner:result.runner,instrumentationHash:result.instrumentationHash,originalToolHashes:result.toolHashes,
  originalResultSha256:result.recalculation.originalResultSha256,policyVersion,policyHash:result.recalculation.policyHash,
  recalculationToolHashes:Object.fromEntries(['recalculate-ext-perf-ab.mjs','ext-perf-ab-policy.mjs','ext-perf-budget.mjs'].map(n=>[n,hash(readFileSync(resolve(root,'scripts',n),'utf8'))])),
  calibration:'First three complete B runs, rounds 1/2/3; no sample removal or new timing.',
  acceptance:'Maintainer ruling 2026-10-16: B4-5 accepted under revised D6.',
  independentPostFreezeReplay:false,
  limitations:['Offline checks reuse calibration runs; no independent fourth replay.', 'Absolute timings are report-only and specific to this cloud runner.', 'all complete routes have different workloads; A/B timing verdict uses identical 1714-command prefix, not a D20 comparison.', 'No browser/mobile/D22+ or maximum-resident/structure load coverage.'],
  evidence:evidence.filter(r=>r.side==='B'&&r.kind==='full')};
 write(manifest,frozen);
 for(let n=1;n<=3;n++)writeFileSync(resolve(out,`frozen-check-${n}.log`),cli('check',manifest,...['classic','all'].map(id=>`${id}=${resolve(artifact,`round-${n}`,`B-${id}-full`)}`)));
 result.manifest=manifest;
}
write(resolve(out,'result.json'),result);
const lines=['# 6B4 offline D6 adjudication',`Status: **${result.status}**; original: **${original.status}**; hard: **${result.hard}** (original completed run, summary/input stability rechecked offline).`,timingPolicy,
 `Source run: ${result.runner.runId}, attempt ${result.runner.attempt}; result SHA256: \`${result.recalculation.originalResultSha256}\`.`,
 'P99 = nearest rank ceil(n × .99), from unchanged observer .rounds.json; objective max remains in raw evidence only.',
 '', '| Gate | Crossed rounds | Verdict | Timing-only verdict |', '| --- | --- | --- | --- |',
 ...gates.map(g=>`| ${g.id}/${g.kind} | ${g.exceededRounds}/${result.options.rounds} | ${g.status} | ${g.timingStatus} |`),
 '', '| Gate / round | Metric | A ms | B ms | Crossed |', '| --- | --- | --- | --- | --- |',
 ...gates.flatMap(g=>g.pairs.flatMap((p,i)=>p.map(v=>`| ${g.id}/${g.kind} / ${i+1} | ${v.metric} | ${v.a.toFixed(6)} | ${v.b.toFixed(6)} | ${v.exceeded} |`))),
 '', result.manifest?'Frozen manifest generated from original B rounds 1/2/3; all three offline budget checks passed. These are calibration-data rechecks, NOT an independent post-freeze replay.':'No manifest generated.',
 'No engine replay or new performance measurement executed. Original artifact and regression verdict preserved.'];
writeFileSync(resolve(out,'summary.md'),lines.join('\n')+'\n');
console.log(JSON.stringify({status:result.status,gates:gates.map(({id,kind,status,exceededRounds})=>({id,kind,status,exceededRounds})),manifest:result.manifest??null}));
if(result.status!=='pass')process.exitCode=1;
