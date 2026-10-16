/** Reproducible wizard route. All world changes use recorded commands; the
 * route planner reads the generated map (omniscient, not human-play evidence).
 * node scripts/generate-ext-perf.mjs OUT_DIR classic|all SEED [waits=500] */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {boot,drain,write,hash} from './ext-perf-common.mjs';
import {RouteRecovery,nextRouteStep,retryEntryDelay} from './ext-perf-route-recovery.mjs';
const [out,combination,seed='438491256',waits='500']=process.argv.slice(2);
assert.ok(out && ['classic','all'].includes(combination));
Date.now=()=>1792022400000; // Freeze metadata timestamps, never simulation clocks/RNG.
const {server,Game,logger,load}=await boot();
try {
 const {getInstalledModuleDescriptors,createExtensionRegistry}=await load('ext/catalog.ts');
 const {TerrainType}=await load('engine/Map/TerrainType.ts');
 const {cellTerrainFlags}=await load('engine/Map/DungeonFeature.ts');
 const flags=await load('engine/Map/TerrainCatalog.ts');
 const modules=combination==='all'?getInstalledModuleDescriptors().map(m=>m.id).sort():[];
 // If local replanning exhausts a chokepoint, rebuild from the same seed
 // with one extra recorded wait on entry to that depth. This changes enemy
 // approach deterministically, without editing/restoring game state or RNG.
 // Failed attempts are diagnostic only; the output is one fresh complete run.
 const entryDelays=new Map(),attempts=[];
 for(let attempt=0;;attempt++) {
 const g=new Game(); g.animationEnabled=true; g.onRenderRequested=()=>{}; g.onConfirmRequest=()=>true;
 const registry=createExtensionRegistry(); const initialCommands=registry.create(registry.manifest(modules)).flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);
 g.startNewGame({initialCommands:modules.length?initialCommands:undefined,seed,mode:'wizard',ruleSet:modules.length?'extended':'classic',extensions:modules});
 const targetDepth=Number(process.env.PERF_DEPTH??20);
 const coverage={}, targets=[targetDepth]; let commands=0;
 async function command(action,data) { const prior=g.recordedInputEvents.length; g.executeCommand(action,data); drain(g); while(g.pendingCommandConfirmation){g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);drain(g);} await g.flushRecording(); while(logger.pendingAcknowledgment)logger.acknowledgeNext(); assert.equal(g.isGameOver,false,'Route died'); assert.equal(g.recordedInputEvents.length,prior+1,JSON.stringify({action,locked:g.isInputLocked(),blocked:g.recordingInputBlocked,pending:g.pendingCommandConfirmation,inventory:g.isInventoryOpen,depth:g.depth})); commands++; if(commands%100===0)console.log(JSON.stringify({commands,depth:g.depth,attempt})); }
  const score=i=>i?.damage?Number(i.damage.match(/d(\d+)/)?.[1]??0)+(i.enchantment??0)*2:0;
 const recovery=new RouteRecovery();
 const nextStep=()=>nextRouteStep({g,recovery,score,TerrainType,cellTerrainFlags,flags});
 let stalled=0,old='',enteredDepth=null;
 try {
 while(g.depth<=targetDepth) {
  const d=g.depth;
  if(enteredDepth!==d) {
   enteredDepth=d;
   for(let i=0;i<(entryDelays.get(d)??0);i++)await command('wait');
  }
  recovery.observe(d,g.player.x,g.player.y);

  const weapon=g.player.inventory.items.filter(i=>i.category===0&&i.identityId!=='dart'&&!i.isCursed&&(i.strengthRequired??0)<=g.player.strength).sort((a,b)=>score(b)-score(a))[0];
  if(weapon&&!g.player.equippedWeapon?.isCursed&&score(weapon)>score(g.player.equippedWeapon)){g.executeItemCommand('equip',weapon);drain(g);await g.flushRecording();}
  if(targets.includes(d)&&!coverage[d]) {
   let settled=0,maxMonsters=0,maxLights=0;
   for(let i=0;i<Number(waits);i++) {const turn=g.stats.turns;await command('wait');settled+=g.stats.turns-turn;maxMonsters=Math.max(maxMonsters,g.monsters.filter(m=>m.hp>0).length);let lights=0;for(let x=0;x<g.grid.width;x++)for(let y=0;y<g.grid.height;y++)for(const t of g.grid.getCell(x,y).layers)if(flags.TERRAIN_FLAGS[t]?.glowLight)lights++;maxLights=Math.max(maxLights,lights);assert.equal(g.depth,d,'Wait scene fell');if((i+1)%100===0)console.log(JSON.stringify({depth:d,waits:i+1,commands}));}
   coverage[d]={settled,maxMonsters,maxTerrainLights:maxLights};console.log(JSON.stringify({depth:d,commands,coverage:coverage[d]}));
   if(d===targetDepth)break;
  }
  if(commands>=16000||recovery.steps>=1024)throw Object.assign(Error('Route command budget'),{routeBlocked:true});
  const loc=`${g.depth}:${g.player.x},${g.player.y}`;stalled=loc===old?stalled+1:0;old=loc;
  if(stalled>=600)throw Object.assign(Error(`Stuck ${loc}`),{routeBlocked:true});
  const seizer=g.player.seized?g.findLiveSeizer():null;
  if(seizer)await command('move',{x:Math.sign(seizer.x-g.player.x),y:Math.sign(seizer.y-g.player.y)});
  else if(stalled>0&&stalled%8===0)await command('search');else {const step=nextStep();recovery.attempted(step);await command(step==='pickup'?'pickup':step?'move':'stairs_down',typeof step==='object'?step:undefined);}
  if(g.depth!==d)console.log(JSON.stringify({depth:g.depth,commands}));
 }
 } catch(error) {
  if(!error.routeBlocked)throw error;
  write(`${out}/attempt-${attempt}-failure.json`,{depth:g.depth,x:g.player.x,y:g.player.y,error:error.message,recovery:recovery.events,blocked:[...recovery.blocked]});
  const delay=retryEntryDelay(entryDelays,g.depth,attempt,error);
  attempts.push({attempt,depth:g.depth,commands,error:error.message,nextEntryWaits:delay});
  write(`${out}/route-attempts.json`,attempts);console.log(JSON.stringify(attempts.at(-1)));
  continue;
 }
 const recording=await g.exportRecordingAsync({includeSnapshots:false});
 assert.ok(coverage[targetDepth]?.settled>=Number(waits),'Missing settled workload');
 assert.ok(coverage[targetDepth]?.maxMonsters>1&&coverage[targetDepth]?.maxTerrainLights>1,'Missing multi-monster/light workload');
 const path=`${out}/${combination}-${seed}`;
 write(path+'.recovery.json',{attempts,entryDelays:Object.fromEntries(entryDelays),events:recovery.events});
 write(path+'.recording.json',recording);
 write(path+'.route.json',{seed:recording.seed,mode:recording.mode,recordedAt:recording.recordedAt,extensions:recording.extensions??null,recordingHash:hash(recording),commands:recording.events.map(({action,data,decisions})=>({action,data,decisions}))});
 write(path+'.source.json',{kind:'wizard-command-route',planner:'omniscient BFS; bounded deterministic recovery v1; no world edits',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,seed,mode:recording.mode,recordedAt:recording.recordedAt,recordingVersion:recording.version,codec:recording.codec,extensions:recording.extensions,modules,coverage,events:recording.events.length,recordingHash:hash(recording)});
 console.log(path);break;
 }
} finally {await server.close();}
