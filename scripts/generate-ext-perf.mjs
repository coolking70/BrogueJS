/** Reproducible wizard route. All world changes use recorded commands; the
 * route planner reads the generated map (omniscient, not human-play evidence).
 * node scripts/generate-ext-perf.mjs OUT_DIR classic|all SEED [waits=500] */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {boot,drain,write,hash} from './ext-perf-common.mjs';
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
 const g=new Game(); g.animationEnabled=true; g.onRenderRequested=()=>{}; g.onConfirmRequest=()=>true;
 const registry=createExtensionRegistry(); const initialCommands=registry.create(registry.manifest(modules)).flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);
 g.startNewGame({initialCommands:modules.length?initialCommands:undefined,seed,mode:'wizard',ruleSet:modules.length?'extended':'classic',extensions:modules});
 const targetDepth=Number(process.env.PERF_DEPTH??20);
 const coverage={}, targets=[targetDepth]; let commands=0;
 async function command(action,data) { const prior=g.recordedInputEvents.length; g.executeCommand(action,data); drain(g); while(g.pendingCommandConfirmation){g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);drain(g);} await g.flushRecording(); while(logger.pendingAcknowledgment)logger.acknowledgeNext(); assert.equal(g.isGameOver,false,'Route died'); assert.equal(g.recordedInputEvents.length,prior+1,JSON.stringify({action,locked:g.isInputLocked(),blocked:g.recordingInputBlocked,pending:g.pendingCommandConfirmation,inventory:g.isInventoryOpen,depth:g.depth})); commands++; }
  const score=i=>i?.damage?Number(i.damage.match(/d(\d+)/)?.[1]??0)+(i.enchantment??0)*2:0;
 function nextStep(avoid=true,loot=true) {
  const upgrade=loot&&!g.player.equippedWeapon?.isCursed?g.items.filter(i=>i.category===0&&i.identityId!=='dart'&&!i.isCursed&&(i.strengthRequired??0)<=g.player.strength&&score(i)>score(g.player.equippedWeapon)).sort((a,b)=>Math.max(Math.abs(a.loc.x-g.player.x),Math.abs(a.loc.y-g.player.y))-Math.max(Math.abs(b.loc.x-g.player.x),Math.abs(b.loc.y-g.player.y)))[0]:null;
  const w=g.grid.width,h=g.grid.height,key=(x,y)=>x*h+y;
  const start=key(g.player.x,g.player.y), queue=[start], parent=new Map([[start,-1]]);
  const dirs=[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
  for(let i=0;i<queue.length;i++) {
   const k=queue[i],x=Math.floor(k/h),y=k%h,c=g.grid.getCell(x,y);
   if(upgrade?x===upgrade.loc.x&&y===upgrade.loc.y:c.layers.includes(TerrainType.STAIRS_DOWN)) { let n=k; if(n===start)return upgrade?'pickup':null; while(parent.get(n)!==start)n=parent.get(n); return {x:Math.floor(n/h)-g.player.x,y:n%h-g.player.y}; }
   for(const [dx,dy]of dirs) {const nx=x+dx,ny=y+dy,n=key(nx,ny),cell=g.grid.getCell(nx,ny); if(!cell||parent.has(n)||(avoid&&g.getMonsterAt(nx,ny)))continue;
    const f=cellTerrainFlags(g.grid,nx,ny); if((!cell.isPassable&&!cell.layers.includes(TerrainType.SECRET_DOOR))||(f&(flags.T_LAVA_INSTA_DEATH|flags.T_AUTO_DESCENT)))continue;
    if(dx&&dy&&(!g.grid.getCell(x+dx,y)?.isPassable||!g.grid.getCell(x,y+dy)?.isPassable))continue;
    parent.set(n,k);queue.push(n);
   }
  }
  if(avoid)return nextStep(false,loot);
  if(upgrade)return nextStep(true,false);
  throw Error(`No stairs path D${g.depth} at ${g.player.x},${g.player.y}`);
 }
 let stalled=0,old='';
 while(g.depth<=targetDepth) {
  const d=g.depth;

  const weapon=g.player.inventory.items.filter(i=>i.category===0&&i.identityId!=='dart'&&!i.isCursed&&(i.strengthRequired??0)<=g.player.strength).sort((a,b)=>score(b)-score(a))[0];
  if(weapon&&!g.player.equippedWeapon?.isCursed&&score(weapon)>score(g.player.equippedWeapon)){g.executeItemCommand('equip',weapon);drain(g);await g.flushRecording();}
  if(targets.includes(d)&&!coverage[d]) {
   let settled=0,maxMonsters=0,maxLights=0;
   for(let i=0;i<Number(waits);i++) {const turn=g.stats.turns;await command('wait');settled+=g.stats.turns-turn;maxMonsters=Math.max(maxMonsters,g.monsters.filter(m=>m.hp>0).length);let lights=0;for(let x=0;x<g.grid.width;x++)for(let y=0;y<g.grid.height;y++)for(const t of g.grid.getCell(x,y).layers)if(flags.TERRAIN_FLAGS[t]?.glowLight)lights++;maxLights=Math.max(maxLights,lights);assert.equal(g.depth,d,'Wait scene fell');if((i+1)%100===0)console.log(JSON.stringify({depth:d,waits:i+1,commands}));}
   coverage[d]={settled,maxMonsters,maxTerrainLights:maxLights};console.log(JSON.stringify({depth:d,commands,coverage:coverage[d]}));
   if(d===targetDepth)break;
  }
  assert.ok(commands<16000,'Route command budget');
  const loc=`${g.depth}:${g.player.x},${g.player.y}`;stalled=loc===old?stalled+1:0;old=loc;
  if(stalled===599)write(`${out}/route-failure.json`,{loc,step:nextStep(),monster:g.getMonsterAt(g.player.x+nextStep().x,g.player.y+nextStep().y),cell:g.grid.getCell(g.player.x+nextStep().x,g.player.y+nextStep().y),logs:logger.messages.slice(-6),player:g.player,inventoryOpen:g.isInventoryOpen,throwing:g.isThrowing,pending:g.pendingArcana,seizer:g.findLiveSeizer()});
  assert.ok(stalled<600,`Stuck ${loc}`);
  const seizer=g.player.seized?g.findLiveSeizer():null;
  if(seizer)await command('move',{x:Math.sign(seizer.x-g.player.x),y:Math.sign(seizer.y-g.player.y)});
  else if(stalled>0&&stalled%8===0)await command('search');else {const step=nextStep();await command(step==='pickup'?'pickup':step?'move':'stairs_down',typeof step==='object'?step:undefined);}
  if(g.depth!==d)console.log(JSON.stringify({depth:g.depth,commands}));
 }
 const recording=await g.exportRecordingAsync({includeSnapshots:false});
 const path=`${out}/${combination}-${seed}`;
 write(path+'.recording.json',recording);
 write(path+'.route.json',{seed:recording.seed,mode:recording.mode,recordedAt:recording.recordedAt,extensions:recording.extensions??null,recordingHash:hash(recording),commands:recording.events.map(({action,data,decisions})=>({action,data,decisions}))});
 write(path+'.source.json',{kind:'wizard-command-route',planner:'omniscient BFS; no world edits',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,seed,mode:recording.mode,recordedAt:recording.recordedAt,recordingVersion:recording.version,codec:recording.codec,extensions:recording.extensions,modules,coverage,events:recording.events.length,recordingHash:hash(recording)});
 console.log(path);
} finally {await server.close();}
