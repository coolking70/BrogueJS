/** Separately identified diagnostic loads; never substitutes for party-ai-v1.
 * node scripts/profile-party-ai-load.mjs OUTPUT ACTORS [STEPS=32]
 * The policy bucket has no Game; companion buckets use a deterministic arena
 * established before the real origin and regenerated on seed replay/seek.
 */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {cpus,platform,arch} from 'node:os';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {boot,hash,write,stats,drain} from './ext-perf-common.mjs';
import {hashCandidate} from './check-module-removal.mjs';
export const AI_LOAD_ID='party-ai-load-v1';
const toolHashes=()=>Object.fromEntries(['profile-party-ai-load.mjs','ext-perf-common.mjs','check-module-removal.mjs'].map(name=>[name,hash(readFileSync(new URL(name,import.meta.url),'utf8'))]));
export function noPathBudgetView(settings,actorId=1) {
 return {seed:'42',fingerprint:AI_LOAD_ID,actorId,ordinal:0,level:1,at:{x:2,y:2},hp:20,maxHp:20,
  leader:{x:500,y:500},cells:Array.from({length:10000},(_,i)=>({x:i%100,y:Math.floor(i/100),passable:true,danger:false,stairs:false})),
  occupied:[],enemies:[],recovery:[],rangedItem:null,pickups:[],settings:{...settings},order:null};
}
const quantile=v=>({...stats(v),p99:v.toSorted((a,b)=>a-b)[Math.ceil(v.length*.99)-1]??null});
export function validateAiLoad(row) {
 assert.equal(row.identity,AI_LOAD_ID);assert.equal(row.status,'measurement-only');assert.ok([1,2,4].includes(row.actors));
 assert.equal(row.policy.calls,row.steps*row.actors);assert.equal(row.policy.nodes,row.policy.calls*4096);
 assert.equal(row.policy.budgetFallbacks,row.policy.calls);assert.equal(row.policy.rngUnchanged,true);
 assert.deepEqual(row.companions.map(c=>c.count),[0,8,16]);
 for(const c of row.companions) {
  assert.equal(c.samples.length,row.steps);assert.equal(c.finalRecordLength,c.initialRecordLength+row.steps);
  assert.equal(c.lifecycle.saveLoad,true);assert.equal(c.lifecycle.seedReplay,true);assert.equal(c.lifecycle.seek,true);
  assert.equal(c.oos,0);assert.equal(c.ticks,row.steps*100);
  assert.ok(c.count===0?c.nativeActions===0:c.nativeActions>0);
  assert.equal(c.npcDecisions,c.nativeActions);
  for(const metric of [c.inputToReady,c.aiViewAndDecision,c.nativeDecision,c.projection,c.full,c.encoding,c.flush]) {
   assert.ok(metric.n>=0);if(metric.n)for(const key of ['p50','p95','p99','max','total'])assert.ok(Number.isFinite(metric[key])&&metric[key]>=0);
  }
 }
 return row;
}
export async function profileAiLoad(output,actors,steps=32) {
 assert.ok([1,2,4].includes(actors));assert.ok(Number.isSafeInteger(steps)&&steps>0&&steps<=2049);
 const sourceHash=hashCandidate(process.cwd()).sha256,tools=toolHashes();
 const {server,Game,load,logger}=await boot(),live=[];
 const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
 let initialize;const began=performance.now();
 try {
  const {PartyAiV1}=await load('ext/modules/party/PartyAiV1.ts'),{defaultPartyAi}=await load('ext/partyAi.ts');
  const {rng}=await load('engine/Random.ts'),{timeSystem}=await load('engine/Systems/Time.ts');
  const {mechanicalDigest}=await load('engine/Core/RecordingDigest.ts');
  const random=rng.getState(),policyTimes=[],policyResults=[];
  for(let i=0;i<steps*actors;i++) {
   const view=noPathBudgetView(defaultPartyAi().settings,1+i%actors),before=hash(view),begin=performance.now(),result=PartyAiV1.decide(view);
   policyTimes.push(performance.now()-begin);assert.equal(result.nodes,4096);assert.equal(result.diagnostic,'budget');
   assert.equal(result.intent.kind,'wait');assert.equal(hash(view),before);policyResults.push(result);
  }
  assert.deepEqual(rng.getState(),random);
  const {Monster,MonsterState}=await load('entities/Monster.ts'),monsters=(await load('data/monsters.json')).default;
  const {commitCreatureAnchor}=await load('engine/Movement/CreatureSpatial.ts');
  const {TerrainType:T,DungeonLayer:L}=await load('engine/Map/Grid.ts');
  const {EnvironmentManager}=await load('engine/Environment/Gas.ts'),{WaypointSystem}=await load('engine/Map/WaypointMap.ts');
  initialize=Game.prototype.initializeParty;
  const companionRows=[];
  for(const count of [0,8,16]) {
   Game.prototype.initializeParty=function(...args) {
    const result=initialize.apply(this,args);if(!this.party)return result;
    this.monsters=[];this.dormantMonsters=[];this.items=[];
    for(let y=0;y<this.grid.height;y++)for(let x=0;x<this.grid.width;x++) {
     this.grid.setTerrain(x,y,x===0||y===0||x===this.grid.width-1||y===this.grid.height-1?T.WALL:T.FLOOR);
     for(const layer of [L.LIQUID,L.SURFACE,L.GAS])this.grid.setTerrainLayer(x,y,layer,T.NOTHING);
     this.grid.getCell(x,y).machineNumber=0;
    }
    this.environment=new EnvironmentManager(this.grid);this.waypoints=new WaypointSystem();this.bindDungeonFeatureEffects();
    this.controlledActors.forEach((a,i)=>commitCreatureAnchor(a,{x:22+i,y:12}));
    for(let i=0;i<count;i++) {
     const ally=new Monster(15+i%8,9+Math.floor(i/8),monsters.find(m=>m.id==='goblin'));
     ally.isAlly=true;ally.state=MonsterState.WANDERING;ally.ticksUntilTurn=0;this.monsters.push(ally);
    }
    this.updateVision();return result;
   };
   const g=new Game({seed:1});live.push(g);
   g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:actors}},
    initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:actors}})]});g.animationEnabled=false;clear();
   const send=change=>{clear();g.executeCommand('party:ai',{kind:'party:ai',schema:1,issuerSlot:'local:0',expectedRevision:g.party.state.revision,change});};
   for(const m of g.party.state.members) {
    send({kind:'controller',actorId:m.actorId,expectedEpoch:m.controlEpoch,controller:{kind:'ai',policyId:'party-ai-v1'}});
    send({kind:'settings',actorId:m.actorId,expectedEpoch:m.controlEpoch,settings:{...m.ai.settings,tactic:'still'}});
    clear();g.executeCommand('party:policy',{kind:'party:policy',schema:2,issuerSlot:'local:0',expectedRevision:g.party.state.revision,actorId:m.actorId,
     change:{kind:'reactions',emptyPlan:'wait',values:Object.fromEntries(['new-hostile','damage','negative-status','low-hp','telegraph'].map(k=>[k,'continue']))}});
   }
   if(count)send({kind:'order',actorIds:g.monsters.map(m=>m.id),order:{kind:'guard',level:g.depth,x:18,y:15}});
   await g.flushRecording();
   const nativeTimes=[],aiTimes=[],projection=[],full=[],encoding=[],flush=[],samples=[];
   let nativeActions=0,npcDecisions=0;
   const port=g.timePorts;g.timePorts=function(){const p=port.call(this),take=p.effects.monsterTakeTurn;p.effects.monsterTakeTurn=(...args)=>{nativeActions++;const begin=performance.now();try{return take(...args);}finally{nativeTimes.push(performance.now()-begin);}};return p;};
   const windowPort=g.partyWindowPort;g.partyWindowPort=function(){const p=windowPort.call(this),decide=p.decide;p.decide=(...args)=>{const begin=performance.now();try{return decide(...args);}finally{aiTimes.push(performance.now()-begin);}};return p;};
   for(const ally of g.monsters){const prepare=ally.prepareNativeDecision;ally.prepareNativeDecision=function(...args){npcDecisions++;return prepare.apply(this,args);};}
   const initialRecordLength=g.recordedInputEvents.length,memoryStart=process.memoryUsage(),startTick=timeSystem.currentTick;
   let peakHeap=memoryStart.heapUsed,peakRss=memoryStart.rss;
   for(let index=0;index<steps;index++) {
    clear();const begin=performance.now(),tick=timeSystem.currentTick,beforeNpc=nativeActions;
    g.executeCommand('party:window',{kind:'party:window',schema:2,issuerSlot:'local:0',expectedRevision:g.party.state.revision,seq:g.party.state.window.seq+1,
     startTick:tick,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:[]});drain(g);
    const fs=performance.now();await g.flushRecording();flush.push(performance.now()-fs);
    samples.push({index,inputToReadyMs:performance.now()-begin,ticks:timeSystem.currentTick-tick,npcActions:nativeActions-beforeNpc,recordLength:g.recordedInputEvents.length});
    assert.equal(g.recordedInputEvents.length,initialRecordLength+index+1);
    const p=performance.now(),world=g.projectWholeRun();projection.push(performance.now()-p);
    const f=performance.now();mechanicalDigest(world,g.recordingInputState());full.push(performance.now()-f);
    const e=performance.now();new TextEncoder().encode(JSON.stringify(world));encoding.push(performance.now()-e);
    const memory=process.memoryUsage();peakHeap=Math.max(peakHeap,memory.heapUsed);peakRss=Math.max(peakRss,memory.rss);
   }
   const save=await g.toSaveSnapshotAsync(),recording=g.exportRecording(),expected=mechanicalDigest(g.projectWholeRun(),g.recordingInputState()),rngEnd=rng.getState(),ticks=timeSystem.currentTick-startTick;
   const h=new Game({seed:1});live.push(h);assert.ok(h.loadSnapshot(save));assert.deepEqual(mechanicalDigest(h.projectWholeRun(),h.recordingInputState()),expected);
   assert.ok(h.loadReplay(recording));while(h.replayCursor<recording.events.length&&!h.replayError){clear();const cursor=h.replayCursor;h.replayStep(true);assert.ok(h.replayError||h.replayCursor>cursor);}
   assert.equal(h.replayError,null);assert.deepEqual(mechanicalDigest(h.projectWholeRun(),h.recordingInputState()),expected);assert.deepEqual(rng.getState(),rngEnd);
   h.replaySeek(0);assert.equal(h.replayCursor,0);assert.equal(h.replayError,null);h.replaySeek(recording.events.length);assert.equal(h.replayCursor,recording.events.length);assert.equal(h.replayError,null);
   assert.deepEqual(mechanicalDigest(h.projectWholeRun(),h.recordingInputState()),expected);
   companionRows.push({count,samples,ticks,nativeActions,npcDecisions,initialRecordLength,finalRecordLength:recording.events.length,inputToReady:quantile(samples.map(s=>s.inputToReadyMs)),
    aiViewAndDecision:quantile(aiTimes),nativeDecision:quantile(nativeTimes),projection:quantile(projection),full:quantile(full),encoding:quantile(encoding),flush:quantile(flush),
    fullDigest:expected.root,rngHash:hash(rngEnd),inputHash:hash(recording.events.map(({action,data,decisions})=>({action,data,decisions}))),oos:0,
    memory:{start:memoryStart,end:process.memoryUsage(),sampledPeak:{heapUsed:peakHeap,rss:peakRss},scope:'process; peak sampled after each command, excludes verification peak'},
    bytes:{save:Buffer.byteLength(JSON.stringify(save)),recording:Buffer.byteLength(JSON.stringify(recording))},lifecycle:{saveLoad:true,seedReplay:true,seek:true}});
   write(resolve(output+`.companions-${count}.save.json`),save);write(resolve(output+`.companions-${count}.recording.json`),recording);
   for(const game of [g,h]){game.disposeRecording();live.splice(live.indexOf(game),1);}
  }
  const result={identity:AI_LOAD_ID,status:'measurement-only',tools,sourceHash,actors,steps,mode:'party-only',node:process.version,machine:{platform:platform(),arch:arch(),cpu:cpus()[0]?.model},
   scope:'Synthetic policy no-path budget plus pre-origin diagnostic native-companion arena; not natural play, party-ai-v1, browser, or a hard budget',
   policy:{input:'100x100-known-floor/unreachable-leader500,500',calls:policyResults.length,nodes:policyResults.reduce((n,r)=>n+r.nodes,0),budgetFallbacks:policyResults.length,rngUnchanged:true,timing:quantile(policyTimes),resultHash:hash(policyResults)},companions:companionRows};
  validateAiLoad(result);assert.deepEqual(toolHashes(),tools,'Tool changed');assert.equal(hashCandidate(process.cwd()).sha256,sourceHash,'Source changed');write(resolve(output),result);return result;
 }catch(error){write(resolve(output),{identity:AI_LOAD_ID,status:'failed',sourceHash,actors,steps,error:String(error),elapsedMs:performance.now()-began});throw error;
 }finally{if(initialize)Game.prototype.initializeParty=initialize;for(const game of live)game.disposeRecording();await server.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await profileAiLoad(process.argv[2],Number(process.argv[3]),Number(process.argv[4]??32));
