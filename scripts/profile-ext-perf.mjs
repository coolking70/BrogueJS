/** Complete v4 replay, no checkpoint suppression. Wall timing, GC observation
 * and CPU profiling are separate runs. Raw outputs must stay outside git.
 * node scripts/profile-ext-perf.mjs INPUT OUTPUT_PREFIX [--gc|--cpu] */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {PerformanceObserver} from 'node:perf_hooks';
import {Session} from 'node:inspector';
import {cpus,platform,arch} from 'node:os';
import {boot,drain,write,hash,stats} from './ext-perf-common.mjs';
const [input,out,mode='wall']=process.argv.slice(2);assert.ok(input&&out);assert.ok(['wall','--gc','--cpu'].includes(mode),'Unknown profiling mode');
const recording=JSON.parse(readFileSync(input,'utf8'));
// Keep animation expiry independent of host load. All duration clocks below
// still use real performance.now(); simulation clocks/RNG are untouched.
Date.now=()=>recording.recordedAt;
const {server,Game,load}=await boot();
const segments={}, rows=[],blocks=[],rounds=[], digests=[],fullDomains=[],gc=[];let current=null,enabled=false;
function wrap(proto,name,label=name,onResult) {
 const original=proto[name];assert.equal(typeof original,'function',label);
 // Timing every hot occupancy lookup would dominate the work being measured.
 // Count these calls; time their enclosing vision/turn passes and sample CPU separately.
 const timed=!['hasCreatureAtForLight','getMonsterAt'].includes(label);
 proto[name]=function(...args){
  if(!enabled)return original.apply(this,args);
  const s=segments[label]??={calls:0,ms:timed?0:null};s.calls++;
  if(!timed)return original.apply(this,args);
  const start=performance.now();
  try{const value=original.apply(this,args);onResult?.(value);return value;}
  finally{const ms=performance.now()-start;s.ms+=ms;if(label==='objectiveTimeBlock')blocks.push({command:current.command,depth:current.depth,ms});}
 };
}
const observer=new PerformanceObserver(list=>gc.push(...list.getEntries().map(e=>({kind:e.detail.kind,ms:e.duration}))));
const session=new Session(),post=(method,args={})=>new Promise((resolve,reject)=>session.post(method,args,(e,v)=>e?reject(e):resolve(v)));
try {
 const completeReplayEvent=Game.prototype.completeReplayEvent;
 Game.prototype.completeReplayEvent=function(event,silent){const result=completeReplayEvent.call(this,event,silent);if(enabled&&event.fullCheckpoint)fullDomains.push({command:event.index+1,...event.fullCheckpoint});return result;};
 let accumulatedWork=0,accumulatedTicks=0;
 const timePorts=Game.prototype.timePorts;
 Game.prototype.timePorts=function(){const ports=timePorts.call(this);ports.effects.observeObjectiveWork=(ms,completed,ticks)=>{if(!enabled)return;accumulatedWork+=ms;accumulatedTicks+=ticks;if(completed){rounds.push({...current,ms:accumulatedWork,ticks:accumulatedTicks});accumulatedWork=accumulatedTicks=0;}};return ports;};
 for(const method of ['updateVision','hasCreatureAtForLight','objectiveTimeBlock','updateEnvironment','collectExtensionComponents','projectWholeRun','recordingEventDigest','getMonsterAt','checkpointCombatFactWorld','checkpointResidentWorld'])wrap(Game.prototype,method,method,method==='recordingEventDigest'?v=>digests.push(v):undefined);
 const {footprintOf}=await load('engine/Movement/CreatureSpatial.ts');
 const {LightMap}=await load('engine/Lighting/LightMap.ts');for(const method of ['buildLightMask','paintLight','dance'])wrap(LightMap.prototype,method,'light.'+method);
 const {EnvironmentManager}=await load('engine/Environment/Gas.ts');wrap(EnvironmentManager.prototype,'updateGases','gas.update');
 const {ExtensionRuntime}=await load('ext/runtime.ts');for(const method of ['snapshot','transaction','settle'])wrap(ExtensionRuntime.prototype,method,'extension.'+method);
 const g=new Game();g.animationEnabled=true;g.onRenderRequested=()=>{};
 // Untimed engine warm-up, then start the complete frozen input from origin.
 for(let i=0;i<12;i++){g.executeCommand('wait');drain(g);}
 const coldStart=performance.now();assert.equal(g.loadReplay(recording),true,'Recording rejected');const loadMs=performance.now()-coldStart;
 if(mode==='--gc')observer.observe({entryTypes:['gc']});
 if(mode==='--cpu'){session.connect();await post('Profiler.enable');await post('Profiler.start');}
 const memory={};const sampleMemory=()=>{for(const[k,v]of Object.entries(process.memoryUsage()))memory[k]=Math.max(memory[k]??0,v);};sampleMemory();
 const statsBefore={...(g.extensionRuntime?.stats.diagnostics??{hits:0,misses:0})};
 const started=performance.now();enabled=true;
 for(let i=0;i<recording.events.length;i++) {
  const e=recording.events[i],turn=g.absoluteTurnNumber,actions=g.stats.turns,ticks=g.world5?.simulationTicks??null;
  current={command:i+1,depth:g.depth};const start=performance.now();g.replayStep(true);drain(g);const ms=performance.now()-start;
  if(g.replayError)write(out+'.oos.json',{error:g.replayError,diagnostic:g.replayDiagnostic,event:e,snapshot:g.toSnapshot()});
  assert.equal(g.replayError,null,`OOS command ${i+1}`);assert.equal(g.replayCursor,i+1);
  rows.push({...current,action:e.action,endDepth:g.depth,ms,turns:g.absoluteTurnNumber-turn,actions:g.stats.turns-actions,ticks:ticks===null?null:g.world5.simulationTicks-ticks,monsters:g.monsters.filter(m=>m.hp>0).length,footprintCells:g.monsters.filter(m=>m.hp>0).reduce((n,m)=>n+footprintOf(m).length,0),bodyMembers:g.monsters.filter(m=>m.hp>0&&m.spatial?.bodyMember).length,full:!!e.fullCheckpoint});
  if((i+1)%128===0){sampleMemory();if(mode==='--gc')await new Promise(r=>setImmediate(r));}
  if((i+1)%100===0)console.log(JSON.stringify(rows.at(-1)));
 }
 enabled=false;const elapsed=performance.now()-started;sampleMemory();
 if(mode==='--cpu'){const {profile}=await post('Profiler.stop');write(out+'.cpuprofile',profile);}
 if(mode==='--gc')await new Promise(r=>setTimeout(r,20));observer.disconnect();
 assert.ok(g.recordingMetrics.peakJobs<=2);
 const snapshot=g.toSnapshot();snapshot.savedAt=0;write(out+'.state.json',snapshot);write(out+'.rows.json',rows);write(out+'.blocks.json',blocks);write(out+'.rounds.json',rounds);write(out+'.domains.json',digests);write(out+'.full-domains.json',fullDomains);
 const group=(a,key)=>Object.fromEntries([...new Set(a.map(x=>x[key]))].map(k=>[k,stats(a.filter(x=>x[key]===k).map(x=>x.ms))]));
 const summary={sourceHash:hash(execFileSync('git',['diff','HEAD','--','src'],{encoding:'utf8'})),node:process.version,machine:{cpu:cpus()[0]?.model,platform:platform(),arch:arch()},mode,recordingHash:hash(recording),events:rows.length,oos:0,loadMs,elapsed,command:stats(rows.map(r=>r.ms)),depth:group(rows,'depth'),round:stats(rounds.map(r=>r.ms)),roundDepth:group(rounds,'depth'),objectiveBlocks:stats(blocks.map(r=>r.ms)),objectiveDepth:group(blocks,'depth'),boundary:stats(rows.filter(r=>r.full).map(r=>r.ms)),segments,diagnostics:{stats:Object.fromEntries(Object.entries(g.extensionRuntime?.stats.diagnostics??{hits:0,misses:0}).map(([k,v])=>[k,v-statsBefore[k]])),maxFootprintCells:Math.max(...rows.map(r=>r.footprintCells)),maxBodyMembers:Math.max(...rows.map(r=>r.bodyMembers))},memory,gc:mode==='--gc'?{...stats(gc.map(e=>e.ms)),counts:Object.fromEntries([...new Set(gc.map(e=>e.kind))].map(k=>[k,gc.filter(e=>e.kind===k).length]))}:null,semantic:{stateHash:hash(snapshot),eventDomainsHash:hash(digests),verifiedFullDomainsHash:hash(fullDomains),rng:snapshot.rngState,rowsHash:hash(rows.map(({ms,...r})=>r)),blocks:blocks.length,rounds:rounds.length,roundTicks:rounds.reduce((n,r)=>n+r.ticks,0)},slowest:rows.toSorted((a,b)=>b.ms-a.ms).slice(0,10)};
 write(out+'.summary.json',summary);console.log(JSON.stringify({events:rows.length,elapsed,command:summary.command,semantic:summary.semantic}));
} finally {observer.disconnect();session.disconnect();await server.close();}
