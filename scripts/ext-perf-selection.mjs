/** Finite identities; arbitrary manifests and partial case selections are rejected. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const identities=Object.freeze({
 p0:{manifest:'scripts/ext-perf-budget.json',stem:'ext-late',accepted:true},
 '6b4':{manifest:'scripts/ext-perf-6b4-budget.json',stem:'ext-6b4-late',accepted:true},
 '6c1':{manifest:'scripts/ext-perf-6c1-budget.json',stem:'ext-6c1-late',accepted:true,generate:true},
 '6c3':{manifest:'scripts/ext-perf-6c3-budget.json',stem:'ext-6c3-late',accepted:false,generate:true},
 '6c2':{manifest:'scripts/ext-perf-6c2-budget.json',stem:'ext-6c2-late',accepted:true,generate:true},
});
export function perfIdentity(id){
 assert.ok(Object.hasOwn(identities,id),'Unknown or unimplemented benchmark identity');
 const entry=identities[id];
 return {...entry,id,route:which=>{assert.ok(['classic','all'].includes(which),'Unknown benchmark case');return `scripts/perf/${entry.stem}-${which}.route.json`;},source:which=>{assert.ok(['classic','all'].includes(which),'Unknown benchmark case');return `scripts/perf/${entry.stem}-${which}.source.json`;}};
}
export function loadPerfIdentity(root,id){
 const entry=perfIdentity(id),read=path=>{assert.ok(existsSync(resolve(root,path)),`Missing ${id} artifact ${path}`);return JSON.parse(readFileSync(resolve(root,path),'utf8'));};
 const manifest=read(entry.manifest);assert.deepEqual(Object.keys(manifest.cases).sort(),['all','classic']);
 const routes={},sources={};
 for(const which of ['classic','all']){
  routes[which]=read(entry.route(which));sources[which]=id==='p0'?manifest.cases[which].source:read(entry.source(which));
  const route=routes[which],source=sources[which],expected=manifest.cases[which];
  assert.equal(route.recordingHash,source.recordingHash,'Route/source hash drift');
  assert.equal(source.recordingHash,expected.recordingHash,'Source/manifest hash drift');
  assert.equal(route.commands.length,source.events,'Incomplete route');assert.equal(source.events,expected.events);
  assert.ok(source.events>2049&&source.coverage[20]?.settled>=500,'Missing complete D20 workload');
 }
 return {entry,manifest,routes,sources};
}
export function selectExtPerf(args) {
 const [inputDir,outputDir,...flags]=args;
 assert.ok(inputDir&&outputDir&&!inputDir.startsWith('--')&&!outputDir.startsWith('--'),'Expected input and output directories');
 assert.equal(new Set(flags).size,flags.length,'Duplicate benchmark option');
 assert.ok(flags.every(f=>f==='--regenerate'||f==='--phase6b4'||/^--identity=[a-z0-9]+$/.test(f)),'Unknown benchmark option');
 const choices=flags.filter(f=>f==='--phase6b4'||f.startsWith('--identity='));assert.ok(choices.length<=1,'Conflicting identity selection');
 const identity=choices[0]==='--phase6b4'?'6b4':choices[0]?.slice('--identity='.length)??'p0';
 const entry=perfIdentity(identity);
 return {inputDir,outputDir,identity,regenerate:flags.includes('--regenerate'),manifest:entry.manifest,route:entry.route};
}
/** Find the longest identical input/outcome prefix. The observer must still prove
 * rowsHash, both RNG streams, objective blocks/rounds/ticks in every A/B round. */
export function comparablePrefix(a,b){
 const project=e=>({action:e.action,data:e.data,decisions:e.decisions,tick:e.tick,turn:e.turn,simulationTicks:e.simulationTicks,levelRef:e.levelRef,player:e.player,hp:e.hp,rng:e.rng,terminal:e.terminal});
 let n=0;while(n<Math.min(a.events.length,b.events.length)&&JSON.stringify(project(a.events[n]))===JSON.stringify(project(b.events[n])))n++;
 assert.ok(n>0,'No proven comparable prefix; cannot judge D6');
 return n;
}
