import { installedOptionalModules } from './support/installedExtensions';
import { expect, it } from 'vitest';
import { createItemHarness } from '../ext/testing/itemHarness';
import { createWorldHarness, worldHarnessGame } from '../ext/testing/worldHarness';
import { completeDescriptor, journeyDescriptor } from '../ext/testing/fixtures/itemFixture';
import { mechanicalDigest } from '../engine/Core/RecordingDigest';
import { computeCheckpoint, type CheckpointJob } from '../engine/Core/RecordingCheckpoint';
import { InlineRecordingBackend, WorkerRecordingBackend } from '../engine/Core/RecordingBackend';
import { TerrainType } from '../engine/Map/Grid';
import { isAutoDescent, isDeepWater } from '../engine/Map/TerrainCatalog';
import type { Game } from '../engine/Core/Game';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { rng } from '../engine/Random';
import { nativeStatRevision, nativeStat } from '../engine/Stats/NativeStatSources';
import { itemDisplayName } from '../engine/Items/ItemExtensionBindings';
import { ItemLoader } from '../engine/Items/ItemLoader';
const all=installedOptionalModules(['combat','crafting','foraging','giants','growth','narrative','settlement']);
const compositions=[[],['growth'],['combat'],['giants'],['growth','combat','giants'],['crafting','settlement'],all].map(installedOptionalModules);
const digest=(g:Game)=>mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState());
it.each(compositions.map(modules=>({modules})))('real fixture generation, recorded filter, save/replay/seek/continuation with $modules',({modules})=>{
 const h=createItemHarness({seed:42,mode:'easy',modules},[completeDescriptor]),g=h.game();
 expect(g.extensionRuntime!.snapshot().modules.c6fixture).toMatchObject({created:true});
 if(modules.includes('giants')){const capability=g.extensionRuntime!.queryOptional('foundation.item-encounters.v1',{});expect(capability).toMatchObject({status:'available',value:{v:1,owners:[{owner:'giants'}]}});expect(capability).toEqual(g.extensionRuntime!.queryOptional('foundation.item-encounters.v1',{}));}
 h.ext('c6fixture','set-filter',{v:1,revision:1,minRarity:'rare',classes:['weapon','ring'],autoPickupGold:false});h.command('wait');h.command('escape');
 const save=h.save(),expected=h.digest(),recording=h.exportRecording();h.load(save);expect(h.digest()).toBe(expected);expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(expected);
 h.seek(recording,1);expect(g.replayCursor).toBe(1);h.seek(recording,JSON.parse(recording).events.length);expect(h.digest()).toBe(expected);
 const continuation=h.save();h.load(continuation);h.command('escape');const branch=h.exportRecording();expect(h.replay(branch)).toEqual({ok:true,firstMismatch:null});h.dispose();
});
it.each([{mode:'classic',modules:[]},{mode:'extended',modules:[]},{mode:'extended',modules:all}])('keeps native lifecycle with $mode and $modules',({mode,modules})=>{
 const h=createWorldHarness({seed:42,mode:'easy',modules}),g=worldHarnessGame(h);
 if(mode==='extended'&&!modules.length)g.startNewGame({seed:42,mode:'easy',ruleSet:'extended',extensions:[]});
 g.animationEnabled=false;h.command('wait');h.command('escape');const save=h.save(),before=h.digest(),rec=h.exportRecording();h.load(save);expect(h.digest()).toBe(before);expect(h.replay(rec)).toEqual({ok:true,firstMismatch:null});h.seek(rec,JSON.parse(rec).events.length);const branch=h.save();h.load(branch);h.command('escape');expect(h.replay(h.exportRecording()).ok).toBe(true);h.dispose();
});
/** Recompute through real doors, monsters and native commands; never move live roots by hand. */
function walk(g:Game,target:{x:number;y:number}){
 const key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
 for(let attempt=0;attempt<500;attempt++){
  if(key(g.player.loc)===key(target))return;
  const queue=[{...g.player.loc}],previous=new Map<string,{x:number;y:number}|null>([[key(g.player.loc),null]]);
  for(let n=0;n<queue.length&&!previous.has(key(target));n++)for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){
   const p=queue[n]!,at={x:p.x+dx!,y:p.y+dy!},c=g.grid.getCell(at.x,at.y);
   if(c&&(c.isPassable||c.layers.includes(TerrainType.DOOR)||c.layers.includes(TerrainType.SECRET_DOOR))&&!c.layers.some(t=>isAutoDescent(t)||isDeepWater(t)||t===TerrainType.LAVA)&&!previous.has(key(at))){previous.set(key(at),p);queue.push(at);}
  }
  if(!previous.has(key(target)))throw Error('No safe fixture route');
  let at=target,next=at;while(previous.get(key(at))){next=at;at=previous.get(key(at))!;}
  if(g.grid.getCell(next.x,next.y)!.layers.includes(TerrainType.SECRET_DOOR))g.executeCommand('search');else g.executeCommand('move',{x:next.x-g.player.x,y:next.y-g.player.y});
 }
 throw Error('Fixture route budget');
}
it('naturally generates, walks to, picks up, equips, drops, salvages and replays data items',()=>{
 const h=createItemHarness({seed:42,mode:'easy'},[completeDescriptor]),g=h.game();
 const initial=g.items.filter(i=>i.moduleData);expect(initial.length).toBeGreaterThan(0);
 const item=initial.sort((a,b)=>Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)-Math.abs(b.x-g.player.x)-Math.abs(b.y-g.player.y))[0]!;
 walk(g,item.loc);if(!g.player.inventory.items.includes(item))g.executeCommand('pickup');expect(g.player.inventory.items).toContain(item);
 g.executeItemCommand('equip',item);expect([g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight]).toContain(item);
 const before=nativeStat(g.player,'native.damage-min');g.extensionRuntime!.stats.hypothetical(g.player.id,{unequip:item.id},true);expect(nativeStat(g.player,'native.damage-min')).toBe(before);
 g.executeItemCommand('unequip',item);g.executeItemCommand('drop',item);expect(g.items).toContain(item);g.executeCommand('pickup');expect(g.player.inventory.items).toContain(item);
 h.ext('c6fixture','salvage',{v:1,revision:1,itemIds:[item.id]});expect(g.player.inventory.items).not.toContain(item);expect(g.player.inventory.items.some(i=>i.worldItem?.definitionId==='c6fixture.shard')).toBe(true);
 const expected=h.digest(),rec=h.exportRecording(),save=h.save();h.load(save);expect(h.digest()).toBe(expected);expect(h.replay(rec)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(expected);h.seek(rec,JSON.parse(rec).events.length);expect(h.digest()).toBe(expected);h.dispose();
});
it('tracks partial knowledge in both digests without a mechanical revision; rejects old codec and bad data in place',()=>{
 const h=createItemHarness({seed:42,mode:'easy'},[completeDescriptor]),g=h.game(),item=g.items.find(i=>i.moduleData)!;expect(item).toBeDefined();
 const before=digest(g),revision=nativeStatRevision(g.player);ItemLoader.identifyInstance(item);const after=digest(g);expect(after.domains.native).not.toBe(before.domains.native);expect(after.domains.knowledge).not.toBe(before.domains.knowledge);expect(nativeStatRevision(g.player)).toBe(revision);
 const save=g.toSnapshot();for(const poison of [(s:typeof save)=>{s.version=6;(s as any).schema='brogue-web-whole-run-v6';},(s:typeof save)=>{s.items.find(i=>i.moduleData)!.moduleData!.c6fixture={v:99,known:true,power:2};},(s:typeof save)=>{s.extensions!.manifest.modules=s.extensions!.manifest.modules.filter(m=>m.id!=='c6fixture');}]){const bad=structuredClone(save);poison(bad);const audit=auditFullObjectGraph([g,rng]);expect(g.loadSnapshot(bad)).toBe(false);expect(audit.differences()).toEqual([]);}
 expect(g.loadSnapshot(save)).toBe(true);expect(itemDisplayName(g.items.find(i=>i.id===item.id)!,'floor')).toContain('rare');h.dispose();
});
it('produces identical frozen checkpoints with sync, inline, worker transport and fallback at 256/2048 and seek',async()=>{
 const run=async(kind:'sync'|'inline'|'worker'|'fallback')=>{const h=createItemHarness({seed:42,mode:'easy'},[completeDescriptor]),g=h.game();
 if(kind==='inline')g.configureRecordingBackend(()=>new InlineRecordingBackend());
 if(kind==='fallback')g.configureRecordingBackend(()=>new WorkerRecordingBackend(1000,()=>{throw Error('fixture unsupported worker');}));
 if(kind==='worker')g.configureRecordingBackend(()=>new WorkerRecordingBackend(1000,()=>{
  // Exercise the real worker backend and transferable wire contract in engine-only Node.
  const worker={onmessage:null as null|((event:{data:unknown})=>void),terminate(){},postMessage(job:CheckpointJob & {requestId:number},transfer:Transferable[]){const copy=structuredClone(job,{transfer});queueMicrotask(()=>worker.onmessage?.({data:{requestId:copy.requestId,result:computeCheckpoint(copy)}}));}};
  return worker as unknown as Worker;
 }));
 while(g.recordedInputEvents.length<2049){g.executeCommand('escape');if(g.recordingInputBlocked)await g.flushRecording();}
 const rec=kind!=='sync'?await g.exportRecordingAsync():g.exportRecording();rec.recordedAt=0;expect(rec.snapshots.map(s=>s.afterCommand)).toEqual([2048]);expect(rec.events[255]!.fullCheckpoint).not.toBeNull();const expected=digest(g);
 expect(g.loadReplay(rec)).toBe(true);g.replaySeek(2049);expect(g.replayError).toBeNull();expect(digest(g)).toEqual(expected);h.dispose();return rec;};
 const expected=await run('sync');for(const kind of ['inline','worker','fallback'] as const)expect(await run(kind)).toEqual(expected);
});

it('records natural kill, four equipment slots, unique No/Yes, ten-shard identification and continuation',()=>{
 const h=createItemHarness({seed:42,mode:'easy'},[journeyDescriptor]),g=h.game();
 const unique=g.items.find(i=>(i.moduleData?.c6fixture as any)?.unique)!;expect(unique).toBeDefined();walk(g,unique.loc);if(!g.player.inventory.items.includes(unique))g.executeCommand('pickup');
 const victim=g.monsters.find(m=>m.hp>0&&!m.isAlly&&m.typeId==='rat')??g.monsters.find(m=>m.hp>0&&!m.isAlly&&!m.spatial)!;
 expect(victim).toBeDefined();for(let n=0;n<20&&victim.hp>0;n++)walk(g,{...victim.loc});expect(victim.hp).toBeLessThanOrEqual(0);
 const chosen:import('../engine/Items/Item').Item[]=[];for(const category of [0,1,8,8]){const item=[...g.player.inventory.items,...g.items].find(i=>i!==unique&&i.category===category&&i.moduleData&&!chosen.includes(i));expect(item).toBeDefined();chosen.push(item!);if(!g.player.inventory.items.includes(item!)){walk(g,item!.loc);g.executeCommand('pickup');}expect(g.player.inventory.items).toContain(item);g.executeItemCommand('equip',item!);}
 expect([g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight].map(i=>i?.id)).toEqual(chosen.map(i=>i.id));
 const payload={v:1,revision:1,itemIds:[unique.id]};h.ext('c6fixture','salvage',payload,[false]);expect(g.player.inventory.items).toContain(unique);expect(g.exportRecording().events[g.recordedInputEvents.length-1]!.decisions).toEqual([false]);
 h.ext('c6fixture','salvage',payload,[true]);expect(g.player.inventory.items).not.toContain(unique);expect(g.exportRecording().events[g.recordedInputEvents.length-1]!.decisions).toEqual([true]);
 const receipt=g.extensionRuntime!.snapshot().foundation.itemDrops!.unique.c6fixture;expect(receipt).not.toBe('0'.repeat(32));
 h.ext('c6fixture','identify-shards',{v:1,revision:2,itemId:chosen[1]!.id});expect(chosen[1]!.identified).toBe(true);expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.unique.c6fixture).toBe(receipt);
 const expected=h.digest(),rec=h.exportRecording(),save=h.save();h.load(save);expect(h.digest()).toBe(expected);expect(h.replay(rec)).toEqual({ok:true,firstMismatch:null});h.seek(rec,JSON.parse(rec).events.length);expect(h.digest()).toBe(expected);h.load(h.save());h.command('escape');expect(h.replay(h.exportRecording()).ok).toBe(true);h.dispose();
});
