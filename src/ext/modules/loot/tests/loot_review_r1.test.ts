import '../../../../i18n';
import { afterEach, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { resolveLootCatalog } from '../session';
import { rollLoot } from '../generator';
import { mulberry32 } from '../tools/stats';
import { assembleDropItem, assembleNativeTemplate } from '../../../../engine/Items/FixedItemAssembly';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { getLootUiFixture } from '../tools/preview/fixtures';
import { deriveNativeFacts } from '../item';
import { buildLootSalvageView } from '../ui/viewModel';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { rng } from '../../../../engine/Random';
import { nativeStat } from '../../../../engine/Stats/NativeStatSources';
import { applyActorPoiseDamage } from '../../../../engine/Core/PhasedAttackProduction';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { readLootGameView } from '../gameView';
import { useLootUi } from '../gameSession';
import type { LootItemDataV1 } from '../types';
import type { ProductionActorAttackState } from '../../../actorActions';
const handles:ReturnType<typeof createWorldHarness>[]=[],scopes:ReturnType<typeof effectScope>[]=[];
afterEach(()=>{scopes.splice(0).forEach(s=>s.stop());handles.splice(0).forEach(h=>h.dispose());});
function scene(suffix:string,ring=false,combat=false,also?:string){
 const h=createWorldHarness({seed:42,mode:'easy',modules:combat?['loot','combat']:['loot']}),g=worldHarnessGame(h);handles.push(h);
 const c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime));
 for(let seed=1;seed<=5000;seed++){
  const f=rollLoot(c,{v:1,source:'floor',depth:26,presetId:'standard',itemClass:ring?'ring':c.affixes.find(a=>a.id===`loot.affix.${suffix}`)!.itemClasses[0]!,rarityFindBp:0,claimedUniqueIds:[]},mulberry32(seed)).items.find(i=>i.data.affixes.some(a=>a.id===`loot.affix.${suffix}`)&&(!also||i.data.affixes.some(a=>a.id===`loot.affix.${also}`)));if(!f)continue;
  const n=f.native,item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:false,familiarityRemaining:1000},moduleData:{loot:JSON.parse(JSON.stringify(f.data))}});
  g.player.inventory.addItem(item);g.extensionRuntime!.bindItemData(item);for(const equipped of [...g.player.inventory.items])g.player.unequip(equipped,true);
  const current=()=>g.player.inventory.items.find(i=>i.id===item.id)!;
  return {g,h,item,current,known:()=> (current().moduleData!.loot as unknown as LootItemDataV1).affixes.find(a=>a.id===`loot.affix.${suffix}`)!.known};
 }
 throw Error('Missing generated review fixture');
}
function session(g:ReturnType<typeof worldHarnessGame>,id:number){
 const scope=effectScope();scopes.push(scope);const ui=scope.run(()=>useLootUi({game:()=>g,tick:ref(0),immersive:ref(false),canOpenPanel:()=>true,beforeOpenPanel(){},afterClosePanel(){},beforeOpenItemPanel:()=>true}))!;
 ui.itemActions!(id)[0]!.invoke();return {ui,props:()=>ui.panel.value!.props as any};
}
const row=(g:ReturnType<typeof worldHarnessGame>)=>(g.extensionRuntime!.snapshot().modules.combat as unknown as ProductionActorAttackState).actors.find(a=>a.actorId===g.player.id)!;
it('R1-F1 native fixed break recovery does not reveal stalwart, including after load',()=>{
 const {g,item,known}=scene('stalwart',false,true);g.player.equip(item);applyActorPoiseDamage(g,g.player.id,100000);
 const ticks=row(g).staggerRemainingTicks;expect(ticks).toBeGreaterThan(0);expect(known()).toBe(false);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(known()).toBe(false);
 productionActorActionScheduler(g)!.advanceActionTime(ticks);
 expect(row(g).staggerRemainingTicks).toBe(0);expect(row(g).poise).toBeGreaterThan(0);expect(known()).toBe(false);
});
it('R1-F2 left replacement cannot secretly fill the right empty slot',()=>{
 const {g,item}=scene('mending',true);g.player.equip(item);ItemLoader.identifyInstance(item);
 const candidate=ItemLoader.spawnRing('ring_of_regeneration',0,0)!;g.player.inventory.addItem(candidate);ItemLoader.identifyInstance(candidate);
 const {props}=session(g,candidate.id),events=g.recordedInputEvents.length;
 props().onEquip(false,'left');
 expect(g.player.ringLeft?.id).toBe(item.id);expect(g.player.ringRight).toBeNull();expect(g.recordedInputEvents).toHaveLength(events);
 expect(props().view.compare.columns.map((c:any)=>c.slot.nameKey)).toEqual(['ext.loot.ui.slot.right-ring']);
});
it('R1-F3 hidden item level has a conservative salvage interval enclosing the real yield',()=>{
 const {g,h,item}=scene('mending',true),view=readLootGameView(g,item.id,[item.id]);expect(view.selected!.known!.ilvl).toBeNull();
 const before=view.shards;h.ext('loot','salvage',{v:1,revision:view.revision,itemIds:[item.id]});const actual=readLootGameView(g,null,[]).shards-before;
 expect(actual).toBeGreaterThan(0);expect(view.salvage.total.min).toBeGreaterThan(0);expect(view.salvage.total.min).toBeLessThanOrEqual(actual);expect(view.salvage.total.max).toBeGreaterThanOrEqual(actual);
 expect(view.salvage.total.max).toBeGreaterThan(view.salvage.total.min);
});
it('R1-F4 native candidate retains the known loot chip and conditional loss',()=>{
 const {g,item}=scene('giantsbane');g.player.equip(item);ItemLoader.identifyInstance(item);
 const candidate=g.player.inventory.items.find(i=>i.category===0&&!i.moduleData?.loot)!;
 const column=readLootGameView(g,candidate.id,[]).compare!.columns[0]!;
 expect(column.equipped).not.toBeNull();const conditional=column.rows.find(r=>r.condition?.nameKey==='ext.loot.ui.condition.body-large');
 expect(conditional).toBeDefined();expect(conditional!.after).toBe('0%');expect(conditional!.delta).toMatch(/^-/);
 expect(nativeStat(g.player,'native.damage-min')).toBeGreaterThanOrEqual(0);
});
it.each((['whole','split','load-at-boundary'] as const).flatMap(mode=>[1,30].map(afterTicks=>({mode,afterTicks}))))('R1-F1 true recovery after break boundary: $mode, $afterTicks ticks',({mode,afterTicks})=>{
 // Extra poise capacity leaves room above the native fixed reset of 12.
 const {g,item,known}=scene('stalwart',false,true,'steadfast');g.player.equip(item);applyActorPoiseDamage(g,g.player.id,100000);const ticks=row(g).staggerRemainingTicks;
 if(mode==='whole')productionActorActionScheduler(g)!.advanceActionTime(ticks+afterTicks);
 else {
  productionActorActionScheduler(g)!.advanceActionTime(ticks);expect(known()).toBe(false);expect(row(g).poise).toBe(12);expect(row(g).poiseRecoveryRemainder).toBe(0);
  if(mode==='load-at-boundary'){expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(known()).toBe(false);}
  productionActorActionScheduler(g)!.advanceActionTime(afterTicks);
 }
 if(afterTicks===1){expect(row(g).poise).toBe(12);expect(row(g).poiseRecoveryRemainder).toBeGreaterThan(0);}
 else expect(row(g).poise).toBeGreaterThan(12);
 expect(known()).toBe(true);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(known()).toBe(true);
});
it.each(['empty','left','right','full-left','full-right','equipped'] as const)('R1-F2 actual command and comparison agree before/after load: %s',mode=>{
 const {g}=scene('mending',true);
 const ring=()=>{const i=assembleNativeTemplate('ring_of_regeneration');i.enchantment=2;g.player.inventory.addItem(i);return i;};
 const left=ring(),right=ring(),candidate=ring();
 if(mode==='left'||mode.startsWith('full'))g.player.equip(left);
 if(mode==='right'){g.player.equip(left);g.player.equip(right);g.player.unequip(left,true);}
 if(mode.startsWith('full'))g.player.equip(right);
 if(mode==='equipped')g.player.equip(candidate);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
 const {props}=session(g,candidate.id),v=props().view;
 const slots=mode==='left'?['right']:mode.startsWith('full')?['left','right']:mode==='equipped'?[]:['left'];
 expect(v.selected.ringEquipSlots.map((s:any)=>s.slot)).toEqual(slots);
 expect(v.selected.ringEquipSlots.every((s:any)=>s.replace===mode.startsWith('full'))).toBe(true);
 const side=mode==='left'||mode==='full-right'?'right':'left';
 const col=v.compare.columns.find((c:any)=>c.slot.nameKey===`ext.loot.ui.slot.${side}-ring`)!;
 const expected=Number(col.rows.find((r:any)=>r.key==='native.regeneration-bonus').after);
 // A bare mechanical snapshot has no recording prefix; observe the real command entry instead.
 const command=vi.spyOn(g,'executeItemCommand');props().onEquip(false,side);
 expect(command).toHaveBeenCalledTimes(mode==='equipped'?0:1);command.mockRestore();
 expect((side==='left'?g.player.ringLeft:g.player.ringRight)?.id).toBe(candidate.id);
 expect(nativeStat(g.player,'native.regeneration-bonus')).toBe(expected);
 const ids=[g.player.ringLeft?.id??null,g.player.ringRight?.id??null];
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect([g.player.ringLeft?.id??null,g.player.ringRight?.id??null]).toEqual(ids);expect(nativeStat(g.player,'native.regeneration-bonus')).toBe(expected);
});

function fixture(g:ReturnType<typeof worldHarnessGame>,id:Parameters<typeof getLootUiFixture>[0],reveal:'none'|'partial'|'all'){
 const data=JSON.parse(JSON.stringify(getLootUiFixture(id).data)) as LootItemDataV1;
 data.affixes.forEach((r,i)=>r.known=reveal==='all'||reveal==='partial'&&i===0);
 const c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),n=deriveNativeFacts(data,c);
 const item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:1000},moduleData:{loot:JSON.parse(JSON.stringify(data))}});
 g.player.inventory.addItem(item);g.extensionRuntime!.bindItemData(item);return item;
}
it('R1-F3 partial/unknown/known mixed batch keeps hidden levels across load and encloses actual atomic yield',()=>{
 const {g,h,item}=scene('mending',true),partial=fixture(g,'R06','partial'),full=fixture(g,'R07','all'),ids=[item.id,partial.id,full.id];
 const read=()=>readLootGameView(g,partial.id,ids);
 const view=read();expect(view.selected!.known!.ilvl).toBeNull();expect(view.selected!.known!.affixes.some(r=>r.known)).toBe(true);expect(view.selected!.known!.affixes.some(r=>!r.known)).toBe(true);
 const oracle=auditFullObjectGraph([g,rng]);expect(read().salvage).toEqual(view.salvage);expect(oracle.differences()).toEqual([]);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(read().salvage).toEqual(view.salvage);expect(read().selected!.known!.ilvl).toBeNull();
 const intervals=view.salvage.entries.map(e=>e.shards);expect(intervals[0]!.min).toBe(8);expect(intervals[0]!.max).toBe(120);
 expect(intervals[1]!.max).toBeGreaterThan(intervals[1]!.min);expect(intervals[2]!.min).toBe(intervals[2]!.max);
 expect(view.salvage.total).toEqual({min:intervals.reduce((n,r)=>n+r.min,0),max:intervals.reduce((n,r)=>n+r.max,0)});
 h.ext('loot','salvage',{v:1,revision:read().revision,itemIds:ids});const actual=readLootGameView(g,null,[]).shards-view.shards;
 expect(actual).toBeGreaterThanOrEqual(view.salvage.total.min);expect(actual).toBeLessThanOrEqual(view.salvage.total.max);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(readLootGameView(g,null,[]).shards-view.shards).toBe(actual);expect(g.player.inventory.items.some(i=>ids.includes(i.id))).toBe(false);
});
it('R1-F3 every legal unknown level and corruption outcome is enclosed without reading hidden data',()=>{
 const {g,item}=scene('mending',true),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),base=readLootGameView(g,item.id,[]).selected!.known!;
 for(const preset of c.pack.presets.presets)for(const rarity of ['magic','rare','unique'] as const){
  const dto={...base,rarity},view=buildLootSalvageView([{key:'unknown',item:dto}],c,preset.id);
  for(let ilvl=1;ilvl<=99;ilvl++)for(const corrupted of [false,true]){
   if(corrupted&&!c.pack.corruption.eligibleRarities.includes(rarity))continue;
   // Independent arithmetic oracle using public tables, never the production preview helper.
   let q=Math.floor(c.pack.salvage.base[rarity]*(1+Math.floor(ilvl/10))*preset.salvageMultiplierBp/10000);
   if(corrupted)q=Math.floor(q*1.5);q=Math.max(1,q);
   expect(view.total.min).toBeLessThanOrEqual(q);expect(view.total.max).toBeGreaterThanOrEqual(q);
  }
  expect(dto.ilvl).toBeNull();expect(view.total.max).toBeGreaterThan(view.total.min);
 }
});
it.each(['R08','R12'] as const)('R1-F4 native/loot both directions retain qualifiers without exposing hidden rows, with load: %s',id=>{
 const {g}=scene('giantsbane'),item=fixture(g,id,'none'),native=g.player.inventory.items.find(i=>i.category===0&&!i.moduleData?.loot)!;g.player.equip(item);
 const hidden=readLootGameView(g,native.id,[]).compare!;expect(hidden.columns[0]!.equipped).not.toBeNull();expect(hidden.columns[0]!.rows.filter(r=>r.condition||r.runic)).toEqual([]);expect(hidden.notices.some(n=>n.nameKey==='ext.loot.ui.compare.unknown-excluded')).toBe(true);
 ItemLoader.identifyInstance(item);const before=readLootGameView(g,native.id,[]).compare!;const losses=before.columns[0]!.rows.filter(r=>r.condition||r.runic);expect(losses.length).toBeGreaterThan(0);expect(losses.every(r=>r.delta.startsWith('-'))).toBe(true);
 const audit=auditFullObjectGraph([g,rng]);expect(readLootGameView(g,native.id,[]).compare).toEqual(before);expect(audit.differences()).toEqual([]);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(readLootGameView(g,native.id,[]).compare).toEqual(before);
 const liveNative=g.player.inventory.items.find(i=>i.id===native.id)!;g.executeItemCommand('equip',liveNative);
 const reverse=readLootGameView(g,item.id,[]).compare!;expect(reverse.columns[0]!.equipped).not.toBeNull();
 const gains=reverse.columns[0]!.rows.filter(r=>r.condition||r.runic);expect(gains.map(r=>r.key)).toEqual(losses.map(r=>r.key));expect(gains.every(r=>r.delta.startsWith('+'))).toBe(true);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(readLootGameView(g,item.id,[]).compare).toEqual(reverse);
});
