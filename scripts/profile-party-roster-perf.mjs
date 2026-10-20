/** Snapshot-origin conversion calibration. Setup is a separately hashed, engine-
 * validated diagnostic snapshot, never described as seed-replay evidence.
 * node scripts/profile-party-roster-perf.mjs OUTPUT SCENARIO.json [REPEATS=3]
 */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cpus,platform,arch,tmpdir} from 'node:os';
import {Worker} from 'node:worker_threads';
import {build} from 'esbuild';
import {createServer} from 'vite';
import {rosterEconomyPlugin,startRosterWorkObservation,ROSTER_WORK_UNITS} from './party-roster-work-observer.mjs';
import {boot as bootUninstrumented,hash,write,stats,drain} from './ext-perf-common.mjs';
import {hashCandidate} from './check-module-removal.mjs';
export const ROSTER_PERF_ID='party-roster-diagnostic-v1';
const toolHashes=()=>Object.fromEntries(['profile-party-roster-perf.mjs','party-roster-work-observer.mjs','ext-perf-common.mjs','check-module-removal.mjs'].map(name=>[name,hash(readFileSync(new URL(name,import.meta.url),'utf8'))]));
const quantile=v=>({...stats(v),p99:v.toSorted((a,b)=>a-b)[Math.ceil(v.length*.99)-1]??null});
export function validateRosterScenario(value) {
 assert.equal(value.identity,ROSTER_PERF_ID);assert.ok(typeof value.label==='string'&&value.label.length>0);
 assert.equal(value.provenance,'diagnostic-snapshot');assert.ok([1,2,4].includes(value.initialActors));
 assert.equal(typeof value.setupSnapshot,'string');assert.match(value.setupHash,/^[a-f0-9]{64}$/);
 assert.ok(Array.isArray(value.commands)&&value.commands.length>0&&value.commands.length<=64);
 for(const c of value.commands) {
  assert.ok(typeof c.label==='string'&&c.label.length>0);assert.ok(['join','station'].includes(c.operation));
  assert.ok(Number.isSafeInteger(c.targetId)&&c.targetId>0);
  assert.ok(c.operation==='station'?Number.isSafeInteger(c.campId)&&c.campId>0:c.campId===null);
  assert.ok(['success','rejection'].includes(c.outcome));
  if(c.outcome==='rejection')assert.ok(typeof c.error==='string'&&c.error.length>0);
  else assert.equal(c.error,undefined);
 }
 return value;
}
export async function profileRoster(output,scenarioFile,repeats=3) {
 assert.ok(Number.isSafeInteger(repeats)&&repeats>=1&&repeats<=100);
 const scenario=validateRosterScenario(JSON.parse(readFileSync(scenarioFile,'utf8'))),raw=readFileSync(resolve(dirname(scenarioFile),scenario.setupSnapshot),'utf8');
 assert.equal(hash(raw),scenario.setupHash,'Setup bytes changed');
 const setup=JSON.parse(raw),sourceHash=hashCandidate(process.cwd()).sha256,tools=toolHashes();
 assert.equal(setup.version,11);assert.equal(setup.party.state.schema,4);
 assert.equal(setup.party.state.members.filter(m=>m.life!=='dead').length,scenario.initialActors);
 const observerEvidence={},server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom',plugins:[rosterEconomyPlugin(observerEvidence)]});
 const load=p=>server.ssrLoadModule('/src/'+p);await load('i18n.ts');
 const {Game}=await load('engine/Core/Game.ts'),{logger}=await load('engine/Systems/Logger.ts'),dir=mkdtempSync(join(tmpdir(),'party-roster-perf-')),live=[];
 let workerBackend;const began=performance.now();
 try {
  const {rng}=await load('engine/Random.ts'),{timeSystem}=await load('engine/Systems/Time.ts'),{getNextEntityId}=await load('entities/Creature.ts');
  const {mechanicalDigest}=await load('engine/Core/RecordingDigest.ts'),{WorkerRecordingBackend}=await load('engine/Core/RecordingBackend.ts');
  const entry=join(dir,'worker.mjs');
  await build({entryPoints:[resolve('src/engine/Core/RecordingCheckpoint.worker.ts')],outfile:entry,bundle:true,platform:'node',format:'esm',
   banner:{js:"import {parentPort} from 'node:worker_threads';globalThis.postMessage=value=>parentPort.postMessage(value);"},footer:{js:'parentPort.on("message",data=>globalThis.onmessage({data}));'}});
  workerBackend=new WorkerRecordingBackend(60000,()=>{
   const worker=new Worker(entry),adapter={onmessage:null,onerror:null,onmessageerror:null,postMessage:(job,transfer)=>worker.postMessage(job,transfer),terminate:()=>void worker.terminate()};
   worker.on('message',data=>adapter.onmessage?.({data}));worker.on('error',error=>adapter.onerror?.(error));return adapter;
  });
  const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
  const fresh=snapshot=>{const g=new Game({seed:1});live.push(g);assert.ok(g.loadSnapshot(structuredClone(snapshot)),'Setup/result snapshot rejected');g.animationEnabled=false;clear();return g;};
  const digest=g=>mechanicalDigest(g.projectWholeRun(),g.recordingInputState());
  const command=(g,c,clearCommand=clear)=>{
   clearCommand();const data={kind:'party:roster',schema:1,expectedRevision:g.party.state.revision,issuerSlot:'local:0',actorId:g.player.id,
    targetId:c.targetId,operation:c.operation,campId:c.campId,level:{kind:'dungeon',depth:g.depth}};
   let error=null;try{g.executeCommand('party:roster',data);drain(g);}catch(e){error=e.code??e.message;}
   if(c.outcome==='success')assert.equal(error,null,`${c.label}: unexpected rejection ${error}`);else assert.equal(error,c.error,`${c.label}: rejection mismatch`);
   return data;
  };
  const runs=[];
  for(let repeat=0;repeat<repeats;repeat++) {
   const g=fresh(setup),samples=[],inputs=[],saves=[],states=[],memoryStart=process.memoryUsage();
   const targetActor=id=>g.controlledActors.find(a=>a.id===id)??g.party.stationed.get(id)??g.monsters.find(a=>a.id===id);let peakHeap=memoryStart.heapUsed,peakRss=memoryStart.rss;
   for(let i=0;i<scenario.commands.length;i++) {
    const c=scenario.commands[i];clear();const targetBefore=targetActor(c.targetId),targetHp=targetBefore?.hp,ownedBefore=(targetBefore?.inventory?.items??(targetBefore?.carriedItem?[targetBefore.carriedItem]:[])).map(item=>({id:item.id,quantity:item.quantity}));
    const before=digest(g),random=rng.getState(),allocator=getNextEntityId(),tick=timeSystem.currentTick,
     prefix=g.recordedInputEvents.length,transfers=g.party.state.transfers.length,members=g.controlledActors.length,npcs=g.monsters.length,tickets=g.world5?.tickets.length??0,
     orders=g.world5?.orders.length??0,residents=g.world5?.residents.length??0,jobs=g.world5?.residentJobs.length??0,bundles=g.actorActions?.bundles.length??0,begin=performance.now();
    const stopWork=startRosterWorkObservation();let economicWork;
    try{inputs.push(command(g,c));}finally{economicWork=stopWork();}
    const inputMs=performance.now()-begin;
    assert.equal(timeSystem.currentTick,tick,'Roster management advanced time');
    const p=performance.now(),world=g.projectWholeRun();const projectionMs=performance.now()-p;
    const f=performance.now(),current=mechanicalDigest(world,g.recordingInputState());const fullMs=performance.now()-f;
    if(c.outcome==='rejection'){
     assert.deepEqual(current,before,'Rejected conversion changed mechanical state');assert.deepEqual(rng.getState(),random);assert.equal(getNextEntityId(),allocator);assert.equal(g.recordedInputEvents.length,prefix);
    } else {
     assert.equal(g.party.state.transfers.length,transfers+1,'Accepted conversion did not append exactly one transfer');
     const targetAfter=targetActor(c.targetId);assert.ok(targetAfter,'Converted actor lost its authoritative root');
     if(targetHp!==undefined)assert.equal(targetAfter.hp,targetHp,'Identity conversion changed HP');
     for(const item of ownedBefore)assert.ok(targetAfter.inventory.items.some(after=>after.id===item.id&&after.quantity===item.quantity),'Identity conversion lost an owned item');
    }
    const e=performance.now(),bytes=new TextEncoder().encode(JSON.stringify(world));const encodingMs=performance.now()-e;
    const w=performance.now(),job={generation:repeat+1,boundaryCommand:i+1,previousVerifiedBoundary:i,codecIdentity:hash([11,24,8,6]),manifestFingerprint:hash(world.extensions.manifest),snapshot:true,bytes,inputState:g.recordingInputState(),checkpoint:null};
    const result=await workerBackend.enqueue(job),workerWallMs=performance.now()-w;
    assert.equal(workerBackend.kind,'worker','Production Worker downgraded');assert.deepEqual(result.full,current);
    const saveBegin=performance.now(),save=await g.toSaveSnapshotAsync(),saveMs=performance.now()-saveBegin;
    saves.push(save);states.push(current);const h=fresh(save);assert.deepEqual(digest(h),current);h.disposeRecording();live.splice(live.indexOf(h),1);
    const memory=process.memoryUsage();peakHeap=Math.max(peakHeap,memory.heapUsed);peakRss=Math.max(peakRss,memory.rss);
    samples.push({index:i,label:c.label,outcome:c.outcome,economicWork,inputMs,projectionMs,fullMs,encodingMs,workerWallMs,workerAlgorithmMs:result.computeMs,saveMs,
     ticks:timeSystem.currentTick-tick,transfers:g.party.state.transfers.length-transfers,membersBefore:members,membersAfter:g.controlledActors.length,npcsBefore:npcs,npcsAfter:g.monsters.length,
     economy:{residentJobsBefore:jobs,residentJobsAfter:g.world5?.residentJobs.length??0,actionBundlesBefore:bundles,actionBundlesAfter:g.actorActions?.bundles.length??0,residentsBefore:residents,residentsAfter:g.world5?.residents.length??0,ticketsBefore:tickets,ticketsAfter:g.world5?.tickets.length??0,ordersBefore:orders,ordersAfter:g.world5?.orders.length??0},
     fullDigest:current.root,saveBytes:Buffer.byteLength(JSON.stringify(save)),snapshotBytes:bytes.byteLength});
   }
   const expected=states.at(-1),finalRandom=rng.getState(),replay=fresh(setup);
   scenario.commands.forEach((c,i)=>{command(replay,c);assert.deepEqual(digest(replay),states[i]);});assert.deepEqual(rng.getState(),finalRandom);
   // Restore a middle checkpoint, then replay the exact tail in both directions.
   const middle=Math.floor((saves.length-1)/2),seek=fresh(saves[middle]);assert.deepEqual(digest(seek),states[middle]);
   scenario.commands.slice(middle+1).forEach(c=>command(seek,c));assert.deepEqual(digest(seek),expected);
   const summary={repeat:repeat+1,samples,inputHash:hash(inputs),finalDigest:expected.root,finalRng:hash(finalRandom),lifecycle:{saveLoad:true,snapshotReplay:true,snapshotSeek:true,seedReplay:false,productionWorkerCheckpoint:true},
    buckets:Object.fromEntries([...new Set(samples.map(s=>s.label+':'+s.outcome))].map(key=>[key,{samples:samples.filter(s=>s.label+':'+s.outcome===key)}])),
    memory:{start:memoryStart,end:process.memoryUsage(),sampledPeak:{heapUsed:peakHeap,rss:peakRss},scope:'process including verifier games; sampled once per command, not continuous peak'}};
   if(runs.length){assert.equal(summary.inputHash,runs[0].inputHash);assert.equal(summary.finalDigest,runs[0].finalDigest);assert.equal(summary.finalRng,runs[0].finalRng);}
   runs.push(summary);write(resolve(output+`.repeat-${repeat+1}.save.json`),saves.at(-1));for(const game of [g,replay,seek]){game.disposeRecording();live.splice(live.indexOf(game),1);}
  }
  // Replay with a second Vite server containing no instrumentation plugin.
  // Its modules/RNG/logger are independent; no measured interval includes this.
  const plain=await bootUninstrumented();
  try {
   const {mechanicalDigest:plainDigest}=await plain.load('engine/Core/RecordingDigest.ts');
   const g=new plain.Game({seed:1});
   try {
    assert.ok(g.loadSnapshot(structuredClone(setup)));g.animationEnabled=false;
    const plainClear=()=>{while(plain.logger.pendingAcknowledgment)plain.logger.acknowledgeNext();};
    scenario.commands.forEach((c,i)=>{command(g,c,plainClear);assert.equal(plainDigest(g.projectWholeRun(),g.recordingInputState()).root,runs[0].samples[i].fullDigest,'Instrumentation changed mechanical result');});
   } finally {g.disposeRecording();}
  } finally {await plain.server.close();}
  for(const run of runs)run.lifecycle.uninstrumentedSnapshotReplay=true;
  const all=runs.flatMap(r=>r.samples),buckets=Object.fromEntries([...new Set(all.map(s=>s.label+':'+s.outcome))].map(key=>{
   const samples=all.filter(s=>s.label+':'+s.outcome===key);return [key,{n:samples.length,metrics:Object.fromEntries(['inputMs','projectionMs','fullMs','encodingMs','workerWallMs','workerAlgorithmMs','saveMs'].map(metric=>[metric,quantile(samples.map(s=>s[metric]))])),ticks:samples.reduce((n,s)=>n+s.ticks,0),transfers:samples.reduce((n,s)=>n+s.transfers,0),economicWork:Object.fromEntries(Object.keys(ROSTER_WORK_UNITS).map(key=>[key,samples.reduce((n,s)=>n+s.economicWork[key],0)]))}];
  }));
  assert.deepEqual(toolHashes(),tools,'Tool changed');assert.equal(hashCandidate(process.cwd()).sha256,sourceHash,'Source changed');
  assert.deepEqual(Object.keys(observerEvidence).sort(),['ResidentEconomy.ts','ResidentJobs.ts','ResidentNeeds.ts']);
  const report={identity:ROSTER_PERF_ID,economicObserver:{units:ROSTER_WORK_UNITS,files:observerEvidence,scope:'Actual function/selected-job counts during measured command only; no root-length proxy; timings include small hook cost'},status:'measurement-only',tools,grade:'report-only',sourceHash,scenario,scenarioHash:hash(readFileSync(scenarioFile,'utf8')),repeats,runs,buckets,
   node:process.version,machine:{platform:platform(),arch:arch(),cpu:cpus()[0]?.model},scope:'Hashed diagnostic snapshot; snapshot replay/seek only, no seed replay claim; real production Worker checkpoint on each result; no hard budget'};
  write(resolve(output),report);return report;
 }catch(error){write(resolve(output),{identity:ROSTER_PERF_ID,status:'failed',sourceHash,scenario,error:String(error),elapsedMs:performance.now()-began});throw error;
 }finally{workerBackend?.dispose();for(const g of live)g.disposeRecording();await server.close();rmSync(dir,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await profileRoster(process.argv[2],process.argv[3],Number(process.argv[4]??3));
