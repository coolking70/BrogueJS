import { writeFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { createHeadlessGame } from '../../../../test/harness';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { nativeStat, nativeStatRevision } from '../../../../engine/Stats/NativeStatSources';
import { itemDisplayName } from '../../../../engine/Items/ItemExtensionBindings';
import { stateOf, resolveLootCatalog } from '../session';
import { buildLiveLootCompareView } from '../comparison';
import type { LootKnownItem } from '../ui/types';
import { prepareModuleCreation, buildModuleCreationCommands, buildModuleCreationConfigurations } from '../../../ui/creation';
import { getLootUiFixture } from '../tools/preview/fixtures';
import { rollLoot } from '../generator';
import { lootDrops } from '../drops';
import { initialLootState } from '../session';
import type { DropEvent } from '../../../itemSdk';
import { assembleDropItem } from '../../../../engine/Items/FixedItemAssembly';
import { deriveNativeFacts } from '../item';
import { triggerLootKnowledge } from '../knowledge';
import type { LootItemDataV1 } from '../types';
import { TerrainType } from '../../../../engine/Map/Grid';
import { isAutoDescent, isDeepWater } from '../../../../engine/Map/TerrainCatalog';
const handles:ReturnType<typeof createWorldHarness>[]=[];
function open(seed=42){const h=createWorldHarness({seed,mode:'easy',modules:['loot']});handles.push(h);return {h,g:worldHarnessGame(h)};}
afterEach(()=>{handles.splice(0).forEach(h=>h.dispose());vi.restoreAllMocks();});
async function walk(g:ReturnType<typeof createHeadlessGame>,target:{x:number;y:number}){
 const initialDepth=g.depth;
 const key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
 for(let attempt=0;attempt<500;attempt++){
  if(g.recordingInputBlocked)await g.flushRecording();
  if(g.depth!==initialDepth||key(g.player.loc)===key(target))return;
  const queue=[{...g.player.loc}],previous=new Map<string,{x:number;y:number}|null>([[key(g.player.loc),null]]);
  for(let n=0;n<queue.length&&!previous.has(key(target));n++)for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){
   const p=queue[n]!,at={x:p.x+dx!,y:p.y+dy!},c=g.grid.getCell(at.x,at.y);
   if(c&&(c.isPassable||c.layers.includes(TerrainType.DOOR)||c.layers.includes(TerrainType.SECRET_DOOR))&&!c.layers.some(t=>isAutoDescent(t)||isDeepWater(t)||t===TerrainType.LAVA)&&!previous.has(key(at))){previous.set(key(at),p);queue.push(at);}
  }
  if(!previous.has(key(target)))throw Error(`No safe loot route D${g.depth} ${JSON.stringify(target)} terrain=${JSON.stringify(g.grid.getCell(target.x,target.y)?.layers)}`);
  let at=target,next=at;while(previous.get(key(at))){next=at;at=previous.get(key(at))!;}
  if(g.grid.getCell(next.x,next.y)!.layers.includes(TerrainType.SECRET_DOOR))g.executeCommand('search');else g.executeCommand('move',{x:next.x-g.player.x,y:next.y-g.player.y});
  while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
 }
 throw Error('Loot route budget');
}
describe('6B1 integrated loot',()=>{
 it.each(['scarce','standard','bountiful'])('binds %s UI, manifest, initial command and first floor',presetId=>{
  const plan=prepareModuleCreation(['loot']),selected=new Map([['loot',[JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId}})]]]);
  const configs=buildModuleCreationConfigurations(plan,selected),commands=buildModuleCreationCommands(plan,selected);
  expect(configs).toEqual({loot:{presetId}});
  const g=createHeadlessGame(42,'test');g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['loot'],extensionConfigurations:configs,initialCommands:commands});g.animationEnabled=false;
  expect(g.extensionRuntime!.snapshot().modules.loot).toMatchObject({presetId,created:true,revision:1});
  expect(g.items.some(i=>i.moduleData?.loot)).toBe(true);
  const before=g.toSnapshot(),random=rng.getState();g.executeCommand('ext:command',commands[0]);expect(g.toSnapshot().extensions).toEqual(before.extensions);expect(rng.getState()).toEqual(random);
  g.extensionRuntime!.unload();
 });
 it('bridges original tape without resetting bucket zero and places gold last',()=>{
  const fixture=getLootUiFixture('R12'),p=lootDrops(()=>fixture.catalog),state=initialLootState('standard',fixture.catalog.fingerprint),calls:number[]=[],draws:number[][]=[];
  const event:DropEvent={v:1,eventId:1,source:'encounter',encounterKey:'giants.test',encounterOrdinal:1,formId:'giants.abyssal-colossus',level:{kind:'dungeon',depth:20},at:{x:1,y:1},playerId:1};
  let bucket=0;const random=(lo:number,hi:number)=>{draws.push([bucket,lo,hi]);return hi;};
  const proposal=p.roll(event,{owner:'loot',state,event,randomInt:random,beginItem:i=>{expect(i).toBeGreaterThan(bucket);bucket=i;calls.push(i);},stat:()=>0});
  const pure=rollLoot(fixture.catalog,{v:1,source:'encounter',depth:20,presetId:'standard',formId:'giants.abyssal-colossus',rarityFindBp:0,claimedUniqueIds:[]},{randomInt:(_lo,hi)=>hi});
  expect(proposal.items.map(i=>i.moduleData.loot)).toEqual(pure.items.map(i=>i.data));expect(proposal.gold).toBe(pure.gold);expect(calls).toEqual([1,8]);expect(draws[draws.length-1]![0]).toBe(8);
  const accepted={v:1 as const,eventId:1,accepted:[{index:1,itemId:4}],skipped:[{index:0,reason:'capacity' as const}],acceptedGold:0,newUniqueIds:proposal.uniqueIds[1]?[proposal.uniqueIds[1]!]:[]};
  const next=stateOf(p.settle(state,event,accepted));expect(next.watermark).toBe(1);expect(next.uniqueMask).toBe(accepted.newUniqueIds.reduce((mask,id)=>mask|(1<<fixture.catalog.pack.uniques.uniques.findIndex(u=>u.id===id)),0));
  expect(p.roll({...event,source:'vault',itemClass:'weapon',baseId:null,highValue:true,qualifiers:[]},{owner:'loot',state,event,randomInt:()=>{throw Error('native fallback drew');},beginItem:()=>{},stat:()=>0}).converted).toBe(false);
 });
 it('rejects bad identity/state/data without retiring live objects or RNG/IDs',()=>{
  const {g}=open(),save=g.toSnapshot();
  for(const poison of [(s:typeof save)=>{(s.extensions!.modules.loot as Record<string,unknown>).catalogFingerprint='sha256:'+'0'.repeat(64);},(s:typeof save)=>{(s.extensions!.modules.loot as Record<string,unknown>).uniqueMask=1;},(s:typeof save)=>{(s.extensions!.modules.loot as Record<string,unknown>).watermark=1;},(s:typeof save)=>{s.extensions!.modules.loot={};},(s:typeof save)=>{(s.items.find(i=>i.moduleData?.loot)!.moduleData!.loot as Record<string,unknown>).baseId='bad';},(s:typeof save)=>{s.extensions!.manifest.modules[0]!.configuration={presetId:'bad'};}]){
   const bad=structuredClone(save);poison(bad);const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId();expect(g.loadSnapshot(bad)).toBe(false);expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);
  }
 });
 it('equips real rows, compares known-only, projects four locations and preserves legal native changes',()=>{
  const {g}=open(),r=g.extensionRuntime!,catalog=resolveLootCatalog(r.queryOptional.bind(r)),fixture=getLootUiFixture('R07'),data=fixture.data,n=deriveNativeFacts(data,catalog);
  const item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:20},moduleData:{loot:JSON.parse(JSON.stringify(data))}});g.player.inventory.addItem(item);r.bindItemData(item);
  g.executeItemCommand('equip',item);expect(g.player.equippedWeapon).toBe(item);expect(nativeStat(g.player,'native.damage-max')).toBeGreaterThan(0);
  const project=(location:'floor'|'pack'|'equipped'|'container')=>r.projectKnownItem(item,'loot',location).data;
  expect(project('floor')).toEqual({rarity:data.rarity});
  for(const location of ['pack','equipped','container'] as const)expect(project(location)).toMatchObject({location,ilvl:null,affixes:data.affixes.map(a=>({known:false,position:catalog.affixes.find(d=>d.id===a.id)!.position}))});
  const revision=nativeStatRevision(g.player);ItemLoader.identifyInstance(item);expect(nativeStatRevision(g.player)).toBe(revision);
  const known=project('pack') as unknown as LootKnownItem,audit=auditFullObjectGraph([g,rng]);
  const compare=buildLiveLootCompareView({id:item.id,known},[null],catalog,{presetId:'standard'},r.stats,g.player.id);
  expect(compare.columns[0]!.rows.find(row=>row.key==='native.damage-max')!.after).toBe(String(r.stats.hypothetical(g.player.id,{equip:item.id},true)['native.damage-max']));
  for(let i=0;i<5;i++)itemDisplayName(item,'container');expect(audit.differences()).toEqual([]);
  item.enchantment=2;item.isCursed=false;expect(()=>g.toSnapshot()).not.toThrow();
 });
 it('physical fact projection reveals only supported witnessed rows and respects target conditions',()=>{
  const f=getLootUiFixture('R08');const small=triggerLootKnowledge(f.data,f.catalog,{kind:'physical-hit',role:'attacker',targetTags:[]}) as unknown as LootItemDataV1;
  expect(small.affixes.find(a=>a.id==='loot.affix.giantsbane')!.known).toBe(false);
  const large=triggerLootKnowledge(f.data,f.catalog,{kind:'physical-hit',role:'attacker',targetTags:['body.large']}) as unknown as LootItemDataV1;
  expect(large.affixes.find(a=>a.id==='loot.affix.giantsbane')!.known).toBe(true);expect(f.data.affixes.every(a=>!a.known)).toBe(true);
 });
 it('natural floor pickup/equip/salvage and recorded filter survive load/replay/seek/continuation',async()=>{
  const {h,g}=open();
  const item=g.items.filter(i=>i.moduleData?.loot&&!i.isCursed).sort((a,b)=>Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)-Math.abs(b.x-g.player.x)-Math.abs(b.y-g.player.y))[0]!;expect(item).toBeDefined();
  await walk(g,item.loc);if(!g.player.inventory.items.includes(item))g.executeCommand('pickup');expect(g.player.inventory.items).toContain(item);
  g.executeItemCommand('equip',item);expect([g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight]).toContain(item);
  g.executeItemCommand('unequip',item);h.ext('loot','salvage',{v:1,revision:1,itemIds:[item.id]});expect(g.player.inventory.items).not.toContain(item);
  h.ext('loot','set-filter',{v:1,revision:2,minRarity:'rare',classes:['ring','weapon','ring'],autoPickupGold:false});
  expect(stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision).toBe(3);
  const save=h.save(),recording=h.exportRecording(),digest=h.digest();h.load(save);expect(h.digest()).toBe(digest);expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);
  for(const cursor of [1,Math.floor(JSON.parse(recording).events.length/2),JSON.parse(recording).events.length])h.seek(recording,cursor);
  h.load(h.save());h.command('escape');expect(h.replay(h.exportRecording()).ok).toBe(true);
 },60000);
 it('current loot recording reaches 256/2048 checkpoints and resumes',async()=>{
  const {g,h}=open();while(g.recordedInputEvents.length<2049){g.executeCommand('escape');if(g.recordingInputBlocked)await g.flushRecording();}
  const recording=await g.exportRecordingAsync();expect(recording.snapshots.map(s=>s.afterCommand)).toEqual([2048]);expect(recording.events[255]!.fullCheckpoint).not.toBeNull();
  const digest=h.digest();h.seek(JSON.stringify(recording),2049);expect(h.digest()).toBe(digest);h.load(h.save());h.command('escape');expect(h.replay(h.exportRecording()).ok).toBe(true);
 },60000);
});

it('natural kill reward, shard identification, salvage and replay form one current-version journey',async()=>{
 const {g,h}=open(26);
 g.startNewGame({seed:26,mode:'wizard',ruleSet:'extended',extensions:['loot'],extensionConfigurations:{loot:{presetId:'standard'}},initialCommands:[JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId:'standard'}})]});g.animationEnabled=false;
 const killItems=()=>[...g.items,...g.player.inventory.items].filter(i=>(i.moduleData?.loot as unknown as LootItemDataV1|undefined)?.origin.source==='kill');
 for(let n=0;n<20&&!killItems().length;n++){
  const victim=g.monsters.filter(m=>m.hp>0&&!m.isAlly&&!m.isClone).sort((a,b)=>Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)-Math.abs(b.x-g.player.x)-Math.abs(b.y-g.player.y))[0];
  if(!victim)break;for(let attempt=0;attempt<20&&victim.hp>0;attempt++)await walk(g,{...victim.loc});
 }
 expect(killItems().length).toBeGreaterThan(0);
 const item=killItems().find(i=>!i.isCursed)!;expect(item).toBeDefined();
 if(!g.player.inventory.items.includes(item)){await walk(g,item.loc);g.executeCommand('pickup');}expect(g.player.inventory.items).toContain(item);
 g.executeItemCommand('equip',item);expect([g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight]).toContain(item);
 const shards=()=>g.player.inventory.items.filter(i=>i.worldItem?.definitionId==='loot.shard').reduce((n,i)=>n+i.quantity,0);
 let reserved:import('../../../../engine/Items/Item').Item|undefined;
 for(let n=0;n<40&&(shards()<10||!reserved);n++){
  reserved??=[...g.player.inventory.items,...g.items].find(i=>i.moduleData?.loot&&!i.isIdentified&&i!==item);
  if(reserved&&!g.player.inventory.items.includes(reserved)){await walk(g,reserved.loc);g.executeCommand('pickup');}
  const spare=[...g.player.inventory.items,...g.items].filter(i=>i!==item&&i!==reserved&&i.moduleData?.loot&&![g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight].includes(i))[0];if(!spare){expect(g.depth).toBeLessThan(10);const depth=g.depth;await walk(g,g.levelSeeds[g.depth-1]!.downStairsLoc);if(g.depth===depth)g.executeCommand('stairs_down');continue;}
  if(!g.player.inventory.items.includes(spare)){await walk(g,spare.loc);g.executeCommand('pickup');}expect(g.player.inventory.items).toContain(spare);
  h.ext('loot','salvage',{v:1,revision:stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision,itemIds:[spare.id]},[true]);
 }
 expect(shards()).toBeGreaterThanOrEqual(10);
 const target=reserved!;expect(target).toBeDefined();
 if(!g.player.inventory.items.includes(target)){await walk(g,target.loc);g.executeCommand('pickup');}
 h.ext('loot','identify-shards',{v:1,revision:stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision,itemId:target.id});expect(target.isIdentified).toBe(true);
 const save=h.save(),recording=h.exportRecording(),digest=h.digest();h.load(save);expect(h.digest()).toBe(digest);expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);h.seek(recording,JSON.parse(recording).events.length);expect(h.digest()).toBe(digest);
 h.load(h.save());h.command('escape');const continued=h.exportRecording();expect(h.replay(continued).ok).toBe(true);
 if(process.env.PHASE6B1_EXPORT){writeFileSync(process.env.PHASE6B1_EXPORT+'-save.json',save);writeFileSync(process.env.PHASE6B1_EXPORT+'-recording.json',continued);}
},60000);
