import type { Game } from '../../../engine/Core/Game';
import { Item, ItemCategory } from '../../../engine/Items/Item';
import { ItemLoader } from '../../../engine/Items/ItemLoader';
import { itemDisplayName } from '../../../engine/Items/ItemExtensionBindings';
import { resolveLootCatalog, stateOf } from './session';
import { buildLiveLootCompareView, lootCompareScalars, lootRingEquipSlots } from './comparison';
import { lootSigned } from './ui/format';
import { buildLootItemView, buildLootSalvageView, defaultLootPickupFilter } from './ui/viewModel';
import type { LootKnownItem, LootUiLocation, LootTextRef } from './ui/types';
const text = (nameKey: string): LootTextRef => ({ nameKey, params: {} });
export function reachableLootItems(game: Game): { item: Item; location: LootUiLocation }[] {
 const equipment=[game.player.equippedWeapon,game.player.equippedArmor,game.player.ringLeft,game.player.ringRight];
 const result:{item:Item;location:LootUiLocation}[]=game.player.inventory.items.map(item=>({item,location:equipment.includes(item)?'equipped' as const:'pack' as const}));
 if(!game.player.hasStatus('hallucinating')) for(const item of game.items) if(game.grid.getCell(item.x,item.y)?.isVisible) result.push({item,location:'floor'});
 const ids=game.extensionRuntime?.readModuleView('loot')?.state.containerItemIds;
 if(Array.isArray(ids)) for(const id of ids) {
  if(typeof id!=='number')continue;
  const item=game.worldContainerItems?.get(id);if(item)result.push({item,location:'container'});
 }
 return result.filter(({item})=>[ItemCategory.WEAPON,ItemCategory.ARMOR,ItemCategory.RING].includes(item.category));
}
/** The adapter is the only place reading live Items. Vue receives known display data only. */
export function readLootGameView(game:Game,selectedId:number|null,selectedIds:readonly number[]) {
 const runtime=game.extensionRuntime!,catalog=resolveLootCatalog(runtime.queryOptional.bind(runtime)),state=stateOf(runtime.itemCommandState('loot'));
 const reachable=reachableLootItems(game),equipment=[game.player.equippedWeapon,game.player.equippedArmor,game.player.ringLeft,game.player.ringRight];
 function known(item:Item,location:LootUiLocation):LootKnownItem|null {
  if(!item.moduleData?.loot||game.player.hasStatus('hallucinating'))return null;
  if(item.moduleData?.loot&&location!=='floor'&&!game.player.hasStatus('hallucinating')) return runtime.projectKnownItem(item,'loot',location).data as unknown as LootKnownItem;
  const rarity=item.moduleData?.loot&&location==='floor'?(runtime.projectKnownItem(item,'loot',location).data as {rarity?:LootKnownItem['rarity']}).rarity??null:null;
  return {v:1,location,itemClass:item.category===0?'weapon':item.category===1?'armor':'ring',baseId:item.category===8&&!ItemLoader.identifiedItems.has(item.identityId??'')?null:item.identityId??null,rarity,ilvl:null,enhancement:0,affixCount:location==='floor'?null:0,affixes:[],uniqueId:null,rareName:null,corrupted:null,identified:!item.moduleData?.loot&&item.isIdentified,polarity:'unknown',familiarity:null};
 }
 const entries=reachable.map(({item,location})=>({id:item.id,name:itemDisplayName(item,location,game.player.hasStatus('hallucinating')),location,itemClass:item.category===0?'weapon' as const:item.category===1?'armor' as const:'ring' as const,known:known(item,location),owned:!!item.moduleData?.loot,
  canIdentify:location!=='floor'&&location!=='container'&&!!item.moduleData?.loot&&ItemLoader.canIdentifyItem(item),canSalvage:location==='pack'&&!!item.moduleData?.loot&&!game.player.hasStatus('hallucinating'),
  canEquip:location==='pack',canUnequip:location==='equipped',
  ringEquipSlots:item.category===ItemCategory.RING&&location==='pack'?lootRingEquipSlots(item.id,equipment.slice(2).map(i=>i?.id??null)).map(index=>({slot:index===0?'left' as const:'right' as const,replace:!!equipment[index+2]})):[]}));
 const selected=entries.find(e=>e.id===selectedId)??null;
 let card=null,compare=null;
 if(selected&&!game.player.hasStatus('hallucinating')) {
  const raw=selected.known?buildLootItemView(selected.known,catalog,{presetId:state.presetId}):null;
  // Beta base formulas are never displayed in the game. Native prose remains in inspection.
  card=raw?{...raw,baseStats:[]}:null;
  if(selected.location==='pack'||selected.location==='equipped') {
   const slots=selected.itemClass==='weapon'?[equipment[0]]:selected.itemClass==='armor'?[equipment[1]]:equipment.slice(2);
   compare=buildLiveLootCompareView({id:selected.id,known:selected.known,native:{itemClass:selected.itemClass,name:selected.name}},slots.map(i=>i?{id:i.id,known:known(i,'equipped'),native:!i.moduleData?.loot?{itemClass:i.category===0?'weapon':i.category===1?'armor':'ring',name:itemDisplayName(i,'equipped')}:undefined}:null),catalog,{presetId:state.presetId},runtime.stats,game.player.id);
  }
 }
 const salvage=buildLootSalvageView(entries.filter(e=>selectedIds.includes(e.id)&&e.canSalvage).map(e=>({key:String(e.id),item:e.known!})),catalog,state.presetId);
 const sourceItems=entries.filter(e=>e.location==='equipped'&&e.known).map(e=>({id:e.id,name:e.name,rows:buildLootItemView(e.known!,catalog,{presetId:state.presetId}).rows.filter(row=>row.known)}));
 const sources=lootCompareScalars.flatMap(s=>{
  let b;try{b=runtime.stats.breakdown(game.player.id,s.key,{},true);}catch{return [];}
  return b.rows.filter(row=>row.known!==false&&row.layer==='equipment').map(row=>{
   const id=Number(/(?:loot\.item\.|native\.item\.)(\d+)/.exec(row.sourceId)?.[1]);
   const source=entries.find(e=>e.id===id&&e.location==='equipped');
   return {label:s.label,name:source?.name??'',value:row.category==='increased'||row.category==='more'?`${lootSigned(row.value/100)}%`:lootSigned(row.value/(s.divisor??1)),category:row.category};
  }).filter(row=>row.name);
 });
 return {revision:state.revision,presetId:state.presetId,filter:structuredClone(state.filter),defaults:defaultLootPickupFilter(state.presetId),
  presetName:text(catalog.pack.presets.presets.find(p=>p.id===state.presetId)!.nameKey),entries,selected,card,compare,salvage,sources,sourceItems,
  shards:game.player.inventory.items.filter(i=>i.worldItem?.definitionId==='loot.shard').reduce((n,i)=>n+i.quantity,0)};
}
export type LootGameView=ReturnType<typeof readLootGameView>;
