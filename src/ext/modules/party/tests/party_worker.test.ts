import {timeSystem} from '../../../../engine/Systems/Time';
import {it,expect} from 'vitest';
import {Worker as NodeWorker} from 'node:worker_threads';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {build} from 'esbuild';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {logger} from '../../../../engine/Systems/Logger';
import {WorkerRecordingBackend} from '../../../../engine/Core/RecordingBackend';
import {computeCheckpoint,type CheckpointJob} from '../../../../engine/Core/RecordingCheckpoint';
import {mechanicalDigest} from '../../../../engine/Core/RecordingDigest';
it.each([1,4])('verifies %i members through production Worker code at 255/256/257/2047/2048/2049, save, seek and continuation',async count=>{
 const dir=mkdtempSync(join(tmpdir(),'party-worker-')),entry=join(dir,'worker.mjs');
 await build({entryPoints:[resolve('src/engine/Core/RecordingCheckpoint.worker.ts')],outfile:entry,bundle:true,platform:'node',format:'esm',banner:{js:"import {parentPort} from 'node:worker_threads';globalThis.postMessage=value=>parentPort.postMessage(value);"},footer:{js:'parentPort.on("message",data=>globalThis.onmessage({data}));'}});
 const jobs=new Map<number,CheckpointJob>(),verified:number[]=[];let integrityError:unknown;
 const g=new Game({seed:1});let h:Game|undefined;
 try{
 g.configureRecordingBackend(()=>new WorkerRecordingBackend(60000,()=>{const worker=new NodeWorker(entry),adapter:any={onmessage:null,onerror:null,onmessageerror:null,postMessage(job:CheckpointJob&{requestId:number},transfer:Transferable[]){jobs.set(job.requestId,structuredClone(job));worker.postMessage(job,transfer as any);},terminate(){void worker.terminate();}};
 worker.on('message',data=>{try{const job=jobs.get(data.requestId)!;const expected=computeCheckpoint(job);expect({...data.result,computeMs:0}).toEqual({...expected,computeMs:0});expect(data.result.full.domains.party).toBeTruthy();verified.push(job.boundaryCommand);}catch(error){integrityError=error;}adapter.onmessage?.({data});});worker.on('error',error=>adapter.onerror?.(error));return adapter;}));
 g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:count}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:count}})]});g.animationEnabled=false;
 const cuts=[255,256,257,2047,2048,2049];
 for(let step=g.recordedInputEvents.length;step<2049;step++){expect(g.isGameOver).toBe(false);const prefix=g.recordedInputEvents.length;while(logger.pendingAcknowledgment)logger.acknowledgeNext();if(g.recordingInputBlocked)await g.flushRecording();if([253,254,255,256,2046,2047,2048].includes(step))g.submitPartyWindow({kind:'party:window',schema:1,seq:g.party!.state.window.seq+1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[]});else g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);expect(g.recordedInputEvents.length).toBe(prefix+1);
 if(cuts.includes(g.recordedInputEvents.length)){await g.flushRecording();expect(integrityError).toBeUndefined();const saved=await g.toSaveSnapshotAsync();expect(saved.party!.state.members).toHaveLength(count);}}
 await g.flushRecording();const record=g.exportRecording(),save=g.toSaveSnapshot(),digest=mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState()).root;
 expect(save.run.recordingOrigin).toBeTruthy();expect(verified).toContain(256);expect(verified).toContain(2048);h=new Game({seed:1});expect(h.loadSnapshot(save)).toBe(true);expect(mechanicalDigest(h.toSnapshot(),(h as any).recordingInputState()).root).toBe(digest);expect(h.loadReplay(record)).toBe(true);await h.replaySeekAsync(2049);expect(h.replayCursor).toBe(2049);expect(h.replayError).toBeNull();expect(mechanicalDigest(h.toSnapshot(),(h as any).recordingInputState()).root).toBe(digest);
 const branch=h.toSaveSnapshot();expect(h.loadSnapshot(branch)).toBe(true);while(logger.pendingAcknowledgment)logger.acknowledgeNext();h.submitPartyWindow({kind:'party:window',schema:1,seq:h.party!.state.window.seq+1,expectedRevision:h.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[]});expect(h.exportRecording().events.length).toBeGreaterThan(record.events.length);expect(h.toSaveSnapshot().run.recordingOrigin).toBeTruthy();
 }finally{g.disposeRecording();h?.disposeRecording();rmSync(dir,{recursive:true,force:true});}
},600000);
