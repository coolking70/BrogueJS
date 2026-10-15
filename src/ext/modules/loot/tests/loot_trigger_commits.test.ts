import '../../../../i18n';
import { afterEach, expect, it, vi } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { resolveLootCatalog } from '../session';
import { triggerLootKnowledge } from '../knowledge';
import { getLootUiFixture, LOOT_UI_CATALOGS } from '../tools/preview/fixtures';
import { deriveNativeFacts } from '../item';
import { assembleDropItem } from '../../../../engine/Items/FixedItemAssembly';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { nativeStat, nativeStatRevision } from '../../../../engine/Stats/NativeStatSources';
import { TerrainType } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import type { LootItemDataV1 } from '../types';
const handles:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>{vi.restoreAllMocks();handles.splice(0).forEach(h=>h.dispose());});
function open(){const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']});handles.push(h);return {h,g:worldHarnessGame(h)};}
function add(g:ReturnType<typeof worldHarnessGame>,id:Parameters<typeof getLootUiFixture>[0]){const data=getLootUiFixture(id).data,c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),n=deriveNativeFacts(data,c);const i=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:20},moduleData:{loot:JSON.parse(JSON.stringify(data))}});g.player.inventory.addItem(i);g.extensionRuntime!.bindItemData(i);return i;}
const rows=(item:ReturnType<typeof add>)=>(item.moduleData!.loot as unknown as LootItemDataV1).affixes;
const key=(s:string)=>({'loot.local.armor':'native.armor-base','native.defense':'native.armor-base','native.regeneration':'native.regeneration-bonus','native.light':'native.light-points','native.stealth-range':'native.stealth-points'} as Record<string,string>)[s]??s;
it('every effective affix and each unique row has an exact matching receipt, never whole-item reveal',()=>{
 const c=LOOT_UI_CATALOGS.full,template=getLootUiFixture('R07').data;
 const definitions=[...c.affixes.map(a=>({id:a.id,unique:null,baseId:template.baseId,ranges:a.tiers[0]!.ranges,mods:a.modifiers})),...c.pack.uniques.uniques.flatMap(u=>u.rows.map(r=>({id:r.rowId,unique:u.id,baseId:u.baseId,ranges:r.ranges,mods:r.modifiers})))];
 for(const def of definitions){
  // Controlled pure protocol vector, not represented as generated equipment.
  const values=def.ranges.map(r=>r[0]||r[1]),data={...template,uniqueId:def.unique,baseId:def.baseId,affixes:[{id:def.id,tier:1,values,known:false}]} as LootItemDataV1;
  const nonRunic=def.mods.filter(m=>!m.runicType&&m.unit!=='runic-strength'&&!m.stat.startsWith('growth.'));
  const active=nonRunic.map(m=>m.stat==='loot.ring-implicit'?(def.baseId==='ring_of_regeneration'?'native.regeneration-bonus':'native.awareness'):key(m.stat));
  const result=triggerLootKnowledge(data,c,{kind:'stat-commit',stats:active,targetTags:['body.large']}) as unknown as LootItemDataV1;
  expect(result.affixes[0]!.known,def.id).toBe(nonRunic.some(m=>values[m.valueIndex]!==0));
  expect(triggerLootKnowledge(result,c,{kind:'stat-commit',stats:active,targetTags:['body.large']})).toEqual(result);
  expect((triggerLootKnowledge(data,c,{kind:'stat-commit',stats:[],targetTags:[]}) as unknown as LootItemDataV1).affixes[0]!.known,def.id).toBe(false);
  expect(data.affixes[0]!.known).toBe(false);
 }
});
it('public equip commits capacity only, ordinary reads and load do not trigger other rows',()=>{
 const {g}=open(),item=add(g,'R07'),r=g.extensionRuntime!;const random=rng.getState();
 r.stats.hypothetical(g.player.id,{equip:item.id},true);expect(rows(item).every(a=>!a.known)).toBe(true);expect(rng.getState()).toEqual(random);
 g.executeItemCommand('equip',item);expect(rows(item).find(a=>a.id==='loot.affix.titan')!.known).toBe(true);expect(rows(item).find(a=>a.id==='loot.affix.brutal')!.known).toBe(false);
 const data=JSON.stringify(item.moduleData);expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(JSON.stringify(g.player.inventory.items.find(i=>i.id===item.id)!.moduleData)).toBe(data);
});
it('detached receipts ignore unequipped items and leave RNG, mechanical revision and outcomes unchanged',()=>{
 const {g}=open(),a=add(g,'R07'),b=add(g,'R07'),r=g.extensionRuntime!;g.player.equip(a);
 const value=nativeStat(g.player,'native.strength'),revision=nativeStatRevision(g.player),random=rng.getState();
 r.commitItemStatKnowledge(g.player.id,['native.strength']);expect(rows(a).find(r=>r.id==='loot.affix.titan')!.known).toBe(true);expect(rows(b).every(r=>!r.known)).toBe(true);
 expect(nativeStat(g.player,'native.strength')).toBe(value);expect(nativeStatRevision(g.player)).toBe(revision);expect(rng.getState()).toEqual(random);
 const audit=auditFullObjectGraph([g,rng]);r.commitItemStatKnowledge(g.player.id,['native.strength']);expect(audit.differences()).toEqual([]);
});
it('application failure restores item knowledge, native flags and complete host graph',()=>{
 const {g}=open(),item=add(g,'R07'),r=g.extensionRuntime!;g.player.equip(item);const audit=auditFullObjectGraph([g,rng]);
 vi.spyOn(ItemLoader,'updateIdentifiableItem').mockImplementation(()=>{throw Error('late knowledge failure');});
 expect(()=>r.commitItemStatKnowledge(g.player.id,['native.strength'])).toThrow('late knowledge failure');expect(audit.differences()).toEqual([]);
});
it('fractional recovery and damage resistance receipts distinguish no-benefit cases',()=>{
 const {g}=open(),item=add(g,'R06'),r=g.extensionRuntime!;
 // Use genuine generated rows: select the matching stat only if this item has it.
 g.player.equip(item);const before=JSON.stringify(item.moduleData);g.player.hp=g.player.maxHp;g.player.recoverPerTurn();expect(JSON.stringify(item.moduleData)).toBe(before);
 const f=getLootUiFixture('R08'),zero={...f.data,affixes:f.data.affixes.map(a=>({...a,values:a.values.map(()=>0)}))};
 expect((triggerLootKnowledge(zero,f.catalog,{kind:'stat-commit',stats:['native.physical-damage-dealt'],targetTags:['body.large']}) as unknown as LootItemDataV1).affixes.every(a=>!a.known)).toBe(true);
 expect(r).toBeDefined();
});

it.each(['loot.unique.penitent','loot.unique.gambler'])('unique native implicit %s waits for its actual host settlement',id=>{
 const {g}=open(),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),u=c.pack.uniques.uniques.find(u=>u.id===id)!;
 const data={...getLootUiFixture('R12').data,baseId:u.baseId,uniqueId:u.id,affixes:u.rows.map(r=>({id:r.rowId,tier:0,values:r.ranges.map(v=>v[0]),known:false}))},n=deriveNativeFacts(data,c);
 const item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:false,familiarityRemaining:1000},moduleData:{loot:JSON.parse(JSON.stringify(data))}});g.player.inventory.addItem(item);g.extensionRuntime!.bindItemData(item);g.player.equip(item);
 expect(rows(item)[0]!.known).toBe(false);
 if(id==='loot.unique.penitent'){g.player.hp--;g.player.recoverPerTurn();}else{g.grid.setTerrain(g.player.x+1,g.player.y,TerrainType.SECRET_DOOR,'#',0x999999);g.executeCommand('search');}
 expect(rows(item)[0]!.known).toBe(true);
 expect((triggerLootKnowledge(data,c,{kind:'stat-commit',stats:['native.regeneration-bonus','native.awareness'],targetTags:[]},0) as unknown as LootItemDataV1).affixes[0]!.known).toBe(false);
});
