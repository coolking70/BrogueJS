import {writeFileSync} from 'node:fs';
import {afterEach,expect,it} from 'vitest';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {loadLootPack} from '../definitions';
import {stateOf} from '../session';
import {logger} from '../../../../engine/Systems/Logger';
import type {LootItemDataV1} from '../types';
const handles:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>handles.splice(0).forEach(h=>h.dispose()));
it('natural rune pickup, socket, current save, full replay, seek and continuation',async()=>{
 const h=createWorldHarness({seed:1,mode:'easy',modules:['loot']});handles.push(h);const g=worldHarnessGame(h);
 const seed=Number(process.env.C2_SEED??26);
 g.startNewGame({seed,mode:'wizard',ruleSet:'extended',extensions:['loot'],extensionConfigurations:{loot:{presetId:'bountiful'}},initialCommands:[JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId:'bountiful'}})]});g.animationEnabled=false;
 h.ext('loot','set-filter',{v:1,revision:1,minRarity:'normal',classes:['weapon','armor','ring'],autoPickupGold:true});
 const {TerrainType}=await import('../../../../engine/Map/Grid');
 const {isAutoDescent}=await import('../../../../engine/Map/TerrainCatalog');
 async function walk(target:{x:number;y:number}){
  const score=(i:typeof g.player.equippedWeapon)=>i?.damage?Number(i.damage.match(/d(\d+)/)?.[1]??0)+(i.enchantment??0)*2:0;
  const upgrade=g.player.inventory.items.filter(i=>i.category===0&&i.identityId!=='dart'&&!i.isCursed&&(i.strengthRequired??0)<=g.player.strength).sort((a,b)=>score(b)-score(a))[0];
  if(upgrade&&!g.player.equippedWeapon?.isCursed&&score(upgrade)>score(g.player.equippedWeapon))g.executeItemCommand('equip',upgrade);
  const depth=g.depth,key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
  for(let attempt=0;attempt<500;attempt++){
   if(g.recordingInputBlocked)await g.flushRecording();
   while(logger.pendingAcknowledgment)logger.acknowledgeNext();
   if(g.depth!==depth||key(g.player.loc)===key(target))return;
   const seizer=g.player.seized?g.monsters.find(m=>m.hp>0&&m.seizing&&!m.isAlly&&!m.hasStatus('entranced')&&Math.max(Math.abs(m.x-g.player.x),Math.abs(m.y-g.player.y))===1):null;if(seizer){g.executeCommand('move',{x:Math.sign(seizer.x-g.player.x),y:Math.sign(seizer.y-g.player.y)});continue;}
   const queue=[{...g.player.loc}],parents=new Map<string,{x:number;y:number}|null>([[key(g.player.loc),null]]);
   for(let n=0;n<queue.length&&!parents.has(key(target));n++)for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1],[1,-1],[1,1],[-1,1],[-1,-1]]){
    const p=queue[n]!,at={x:p.x+dx!,y:p.y+dy!},cell=g.grid.getCell(at.x,at.y);
    if(dx&&dy&&(!g.grid.getCell(p.x+dx,p.y)?.isPassable||!g.grid.getCell(p.x,p.y+dy)?.isPassable))continue;
    if(cell&&(cell.isPassable||cell.layers.includes(TerrainType.DOOR)||cell.layers.includes(TerrainType.SECRET_DOOR))&&!cell.layers.some(t=>isAutoDescent(t)||t===TerrainType.LAVA)&&!parents.has(key(at))){parents.set(key(at),p);queue.push(at);}
   }
   if(!parents.has(key(target))){if(attempt%8!==7)continue;throw Error('No safe natural rune path');}
   let at=target,next=at;while(parents.get(key(at))){next=at;at=parents.get(key(at))!;}
   g.executeCommand(g.grid.getCell(next.x,next.y)!.layers.includes(TerrainType.SECRET_DOOR)?'search':'move',{x:next.x-g.player.x,y:next.y-g.player.y});
   while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
  }
  throw Error(`Natural rune path budget D${g.depth} ${JSON.stringify(g.player.loc)} -> ${JSON.stringify(target)} locked=${g.isInputLocked()} inventory=${g.isInventoryOpen} ack=${logger.pendingAcknowledgment} monster=${g.monsters.filter(m=>Math.max(Math.abs(m.x-g.player.x),Math.abs(m.y-g.player.y))<2).map(m=>m.name+':'+m.hp).join(',')}`);
 }
 const all=()=>[...g.items,...g.player.inventory.items];
 const data=(i:ReturnType<typeof all>[number])=>i.moduleData?.loot as unknown as LootItemDataV1|undefined;
 let target:ReturnType<typeof all>[number]|undefined;
 for(let step=0;step<100&&g.depth<=10;step++){
  if(process.env.C2_TRACE)writeFileSync(process.env.C2_TRACE,JSON.stringify({stage:'walking',step,depth:g.depth,events:g.recordedInputEvents.length,items:g.player.inventory.items.map(i=>({id:i.id,kind:i.identityId,rune:i.worldItem?.definitionId,sockets:data(i)?.sockets}))}));
  target=g.player.inventory.items.find(i=>data(i)?.rarity==='normal'&&data(i)!.sockets>0&&data(i)!.enhancement===0);
  if(target&&g.player.inventory.items.some(i=>i.worldItem?.definitionId.startsWith('loot.rune.')))break;
  const wanted=all().find(i=>!g.player.inventory.items.includes(i)&&(i.worldItem?.definitionId.startsWith('loot.rune.')||!target&&data(i)?.rarity==='normal'&&data(i)!.sockets>0));
  if(wanted){const d=g.depth;await walk(wanted.loc);if(g.depth===d)g.executeCommand('pickup');continue;}
  const victim=g.monsters.find(m=>m.hp>0&&!m.isAlly&&!m.isClone&&!m.isInvulnerable()&&!['none','fodder','splitter'].includes(loadLootPack().monsterClasses.members.find(row=>row.typeId===m.typeId)?.class??'standard')&&Math.max(Math.abs(m.x-g.player.x),Math.abs(m.y-g.player.y))<20);
  if(victim){await walk(victim.loc);continue;}
  const d=g.depth;await walk(g.levelSeeds[d-1]!.downStairsLoc);if(g.depth===d)g.executeCommand('stairs_down');
 }
 expect(target).toBeDefined();const material=g.player.inventory.items.find(i=>i.worldItem?.definitionId.startsWith('loot.rune.'))!;expect(material).toBeDefined();
 if([g.player.equippedWeapon,g.player.equippedArmor].includes(target!))g.executeItemCommand('unequip',target!);
 const targetId=target!.id,materialId=material.worldItem!.definitionId;
 h.ext('loot','socket',{v:1,revision:stateOf(g.extensionRuntime!.itemCommandState('loot')).revision,itemId:targetId,runeItemId:material.id},[false]);expect(data(target!)!.socketed).toEqual([]);
 h.ext('loot','socket',{v:1,revision:stateOf(g.extensionRuntime!.itemCommandState('loot')).revision,itemId:targetId,runeItemId:material.id},[true]);expect(data(target!)!.socketed).toEqual([materialId]);
 if(process.env.C2_TRACE)writeFileSync(process.env.C2_TRACE,JSON.stringify({stage:'replay',depth:g.depth,events:g.recordedInputEvents.length}));
 const save=h.save(),recording=h.exportRecording(),digest=h.digest();h.load(save);expect(h.digest()).toBe(digest);expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);
 for(const index of [0,Math.floor(JSON.parse(recording).events.length/2),JSON.parse(recording).events.length])h.seek(recording,index);expect(h.digest()).toBe(digest);
 h.load(save);h.command('escape');const continued=h.exportRecording();expect(h.replay(continued).ok).toBe(true);
 if(process.env.C2_EXPORT){writeFileSync(process.env.C2_EXPORT+'-save.json',save);writeFileSync(process.env.C2_EXPORT+'-recording.json',continued);writeFileSync(process.env.C2_EXPORT+'-witness.json',JSON.stringify({seed,targetId,materialId,depth:g.depth,events:JSON.parse(continued).events.length,sockets:data(target!)!.sockets}));}
},120000);
