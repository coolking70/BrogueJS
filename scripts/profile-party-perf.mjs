/** Bounded actual party commands and independent digest/roundtrip observations. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {cpus,platform,arch} from 'node:os';
import {resolve,join} from 'node:path';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {Worker} from 'node:worker_threads';
import {build} from 'esbuild';
import {boot,write,hash,stats,drain} from './ext-perf-common.mjs';
import {hashCandidate} from './check-module-removal.mjs';
import {PARTY_PERF_ID,PARTY_PERF_POLICY} from './party-perf-identity.mjs';
const [output,mode,countText,stepsText='16']=process.argv.slice(2),actors=Number(countText),steps=Number(stepsText);
assert.ok(output&&PARTY_PERF_POLICY.modes.includes(mode)&&PARTY_PERF_POLICY.actors.includes(actors));assert.ok(Number.isSafeInteger(steps)&&steps>0&&steps<=2049);
const sourceHash=hashCandidate(process.cwd()).sha256;
const {server,Game,logger,load}=await boot();
const workerDir=mkdtempSync(join(tmpdir(),'party-perf-worker-')),live=[];
try{
 const {createExtensionRegistry,getInstalledModuleDescriptors}=await load('ext/catalog.ts'),{rng}=await load('engine/Random.ts');
 const {mechanicalDigest}=await load('engine/Core/RecordingDigest.ts');
 const {computeCheckpoint}=await load('engine/Core/RecordingCheckpoint.ts');
 const registry=createExtensionRegistry();const ids=mode==='party-all'?getInstalledModuleDescriptors().map(m=>m.id):['party'];
 const configuration={party:{schema:1,members:actors}},manifest=registry.manifest(ids,configuration);
 const initialCommands=registry.create(manifest).flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);
 const {WorkerRecordingBackend}=await load('engine/Core/RecordingBackend.ts');
 const workerEntry=join(workerDir,'worker.mjs');
 await build({entryPoints:[resolve('src/engine/Core/RecordingCheckpoint.worker.ts')],outfile:workerEntry,bundle:true,platform:'node',format:'esm',banner:{js:"import {parentPort} from 'node:worker_threads';globalThis.postMessage=value=>parentPort.postMessage(value);"},footer:{js:'parentPort.on("message",data=>globalThis.onmessage({data}));'}});
 const g=new Game({seed:1});live.push(g);g.configureRecordingBackend(()=>new WorkerRecordingBackend(60000,()=>{const worker=new Worker(workerEntry),adapter={onmessage:null,onerror:null,onmessageerror:null,postMessage:(job,transfer)=>worker.postMessage(job,transfer),terminate:()=>void worker.terminate()};worker.on('message',data=>adapter.onmessage?.({data}));worker.on('error',error=>adapter.onerror?.(error));return adapter;}));g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:ids,extensionConfigurations:configuration,initialCommands});g.animationEnabled=false;
 const rows=[],times=[],project=[],full=[],event=[],encode=[],flush=[];let zeroTicks=0;
 for(let index=0;index<steps;index++){
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();if(g.recordingInputBlocked)await g.flushRecording();const actorId=g.readyPartyActorId;assert.ok(actorId,'No human decision');const before=g.world5?.simulationTicks??g.toSnapshot().run.currentTick;
  const t=performance.now();g.submitPartyIntent({kind:'wait'},actorId);drain(g);times.push(performance.now()-t);
  const after=g.world5?.simulationTicks??g.toSnapshot().run.currentTick;if(after===before)zeroTicks++;
  rows.push({actorId,revision:g.party.state.revision,tick:after,hp:g.controlledActors.map(a=>[a.id,a.hp,a.nutrition]),rng:rng.getState()});
  if(index===0||[254,255,256,2046,2047,2048,steps-1].includes(index)){
   const p=performance.now(),world=g.projectWholeRun();project.push(performance.now()-p);const input=g.recordingInputState();
   const e=performance.now();g.recordingEventDigest(manifest);event.push(performance.now()-e);
   const f=performance.now();mechanicalDigest(world,input);full.push(performance.now()-f);
   const c=performance.now();new TextEncoder().encode(JSON.stringify(world));encode.push(performance.now()-c);
   const a=performance.now();await g.flushRecording();flush.push(performance.now()-a);
  }
 }
 const save=await g.toSaveSnapshotAsync(),recording=g.exportRecording(),workerMetrics=g.recordingMetrics,input=g.recordingInputState(),world=g.projectWholeRun(),fullDigest=mechanicalDigest(world,input).root,random=rng.getState();
 const job={generation:1,boundaryCommand:recording.events.length,previousVerifiedBoundary:0,codecIdentity:hash(recording.codec),manifestFingerprint:hash(manifest),snapshot:true,bytes:new TextEncoder().encode(JSON.stringify(world)),inputState:input,checkpoint:null};
 const computed=computeCheckpoint(job);assert.equal(computed.full.root,fullDigest);
 const h=new Game({seed:1});live.push(h);assert.ok(h.loadSnapshot(JSON.parse(JSON.stringify(save))),'Save rejected');assert.ok(h.loadReplay(recording),'Replay rejected');while(h.replayCursor<recording.events.length&&!h.replayError)h.replayStep(true);assert.equal(h.replayError,null);assert.deepEqual(rng.getState(),random);assert.equal(mechanicalDigest(h.projectWholeRun(),h.recordingInputState()).root,fullDigest);
 const summarize=values=>({...stats(values),p99:values.toSorted((a,b)=>a-b)[Math.ceil(values.length*.99)-1]??null});
 const bytes=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
 write(resolve(output),{identity:PARTY_PERF_ID,status:'measurement-only',mode,actors,steps,sourceHash,node:process.version,machine:{platform:platform(),arch:arch(),cpu:cpus()[0]?.model},input:{seed:42,command:PARTY_PERF_POLICY.command,manifest},rowsHash:hash(rows),rngHash:hash(random),fullDigest,oos:0,zeroTicks,step:summarize(times),coldStepMs:times[0],warmStep:summarize(times.slice(1)),projection:summarize(project),event:summarize(event),full:summarize(full),encoding:summarize(encode),flush:summarize(flush),workerAlgorithmMs:computed.computeMs,workerTransport:'production worker in Node worker_threads',workerMetrics,bytes:{save:bytes(save),recording:bytes(recording),partyControl:bytes(save.party.state),extraActors:bytes(save.party.actors)},memory:process.memoryUsage()});
 write(resolve(output+'.save.json'),save);write(resolve(output+'.recording.json'),recording);
 g.disposeRecording();h.disposeRecording();
}finally{for(const g of live)g.disposeRecording();await server.close();rmSync(workerDir,{recursive:true,force:true});}
