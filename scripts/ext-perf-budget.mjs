/** Freeze after three complete quiet runs; check requires the frozen input.
 * freeze MANIFEST case=SOURCE_JSON,PREFIX1,PREFIX2,PREFIX3 [...]
 * check MANIFEST case=PREFIX [...]. Milliseconds report only until a dedicated runner. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {write,stats,hash} from './ext-perf-common.mjs';
const [action,path,...args]=process.argv.slice(2),read=p=>JSON.parse(readFileSync(p,'utf8'));
const median=values=>stats(values).p50;
const timingBaseline=runs=>Object.fromEntries(['command','round','boundary',...Object.keys(runs[0].depth).map(d=>'depth.'+d),...Object.keys(runs[0].roundDepth).map(d=>'roundDepth.'+d)].map(key=>{const values=runs.map(s=>key.split('.').reduce((v,k)=>v[k],s));return[key,Object.fromEntries(['p95','max'].map(k=>[k,median(values.map(v=>v[k]))]))];}));
const instrumentationHash=()=>hash(['profile-ext-perf.mjs','ext-perf-common.mjs'].map(name=>readFileSync(new URL(name,import.meta.url),'utf8')).join('\0'));
const metrics=['updateVision','hasCreatureAtForLight','objectiveTimeBlock','updateEnvironment','collectExtensionComponents','projectWholeRun','recordingEventDigest','getMonsterAt','checkpointCombatFactWorld','checkpointResidentWorld','light.buildLightMask','light.paintLight','light.dance','gas.update','extension.snapshot','extension.transaction','extension.settle'];
const counts=s=>{assert.ok(Object.keys(s.segments).every(k=>metrics.includes(k)),'Unknown work counter');return Object.fromEntries(metrics.map(k=>[k,s.segments[k]?.calls??0]));};
if(action==='freeze') {
 assert.ok(!existsSync(path),'Frozen manifest already exists; write a new reviewed manifest instead of silently rebaselining');
 const cases={};for(const arg of args){const[id,paths]=arg.split('='),[source,...prefixes]=paths.split(',');assert.equal(prefixes.length,3);const runs=prefixes.map(p=>read(p+'.summary.json'));
  for(const s of runs){assert.equal(s.mode,'wall');assert.ok(s.events>2049);assert.equal(s.oos,0);assert.equal(s.recordingHash,runs[0].recordingHash);assert.equal(s.events,runs[0].events);assert.equal(s.node,runs[0].node);assert.equal(s.sourceHash,runs[0].sourceHash);assert.deepEqual(s.machine,runs[0].machine);assert.deepEqual(s.semantic,runs[0].semantic);assert.deepEqual(counts(s),counts(runs[0]));}
  const origin=read(source);assert.equal(origin.recordingHash,runs[0].recordingHash);assert.equal(origin.events,runs[0].events);assert.ok(Object.entries(origin.coverage).some(([d,c])=>Number(d)>=20&&c.settled>=500),'Missing D20+ baseline');
  cases[id]={source:origin,node:runs[0].node,machine:runs[0].machine,sourceHash:runs[0].sourceHash,recordingHash:runs[0].recordingHash,events:runs[0].events,semantic:runs[0].semantic,maximumCalls:counts(runs[0]),calibration:runs.map(s=>({command:s.command,depth:s.depth,round:s.round,roundDepth:s.roundDepth,objectiveBlocks:s.objectiveBlocks,boundary:s.boundary,elapsed:s.elapsed})),timingBaseline:timingBaseline(runs),baselineP95:stats(runs.map(s=>s.command.p95)).p50,baselineMax:stats(runs.map(s=>s.command.max)).p50};
 }
 assert.equal(new Set(Object.values(cases).map(c=>c.sourceHash)).size,1,'Different source across cases');
 assert.equal(new Set(Object.values(cases).map(c=>hash([c.node,c.machine]))).size,1,'Different runner across cases');
 assert.ok(Object.values(cases).some(c=>c.source.modules.length===0));assert.ok(Object.values(cases).some(c=>c.source.modules.length>=8));
 write(path,{version:1,hashEncoding:'sha256(JSON.stringify(value)); preserves key/array order and every recording field',heapMiB:3072,metrics,instrumentationHash:instrumentationHash(),node:read(args[0].split('=')[1].split(',')[1]+'.summary.json').node,policy:{correctness:'hard: complete replay, zero OOS, exact semantic/RNG/domain/final state hashes',work:'hard: calls <= calibrated maximum; objective block count exact',absoluteTiming:'report-only; no dedicated runner',relativeWarning:{p95:1.1,max:1.25,noiseMs:1,rule:'dedicated runner: at least 2 of 3; currently report only'},gcPauseFraction:.05,targetsMs:{classicCommandP95:20,allCommandP95:40,allObjectiveP95:30,allObjectiveMax:100,gcP95:5,gcMax:20,travelMax:1000,multiRoundCommandMax:2000}},cases});
} else if(action==='check') {
 const manifest=read(path);assert.equal(instrumentationHash(),manifest.instrumentationHash,'Instrumentation drift: recalibration required');assert.deepEqual(args.map(a=>a.split('=')[0]).sort(),Object.keys(manifest.cases).sort(),'Missing or duplicate benchmark');
 for(const arg of args){const[id,prefix]=arg.split('='),c=manifest.cases[id];assert.ok(c,`Unknown case ${id}`);const s=read(prefix+'.summary.json');assert.equal(s.mode,'wall');assert.equal(s.recordingHash,c.recordingHash);assert.equal(s.events,c.events);assert.equal(s.oos,0);assert.deepEqual(s.semantic,c.semantic);
  const actualCounts=counts(s);
  for(const[k,max]of Object.entries(c.maximumCalls))assert.ok(actualCounts[k]<=max,`${id} work regression ${k}`);
  const sceneWarnings=Object.entries(c.timingBaseline).flatMap(([key,base])=>{const actual=key.split('.').reduce((v,k)=>v[k],s);return ['p95','max'].filter(k=>actual[k]>base[k]+Math.max(1,base[k]*(k==='p95'?.1:.25))).map(k=>({scene:key,metric:k,baseline:base[k],actual:actual[k]}));});
  console.log(JSON.stringify({case:id,hard:'pass',sceneWarnings,timing:'report-only',p95:s.command.p95,max:s.command.max,p95Warning:s.command.p95>c.baselineP95+Math.max(1,c.baselineP95*.1),maxWarning:s.command.max>c.baselineMax+Math.max(1,c.baselineMax*.25)}));
 }
} else throw Error('Expected freeze or check');
