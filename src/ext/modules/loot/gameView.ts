import { reforgeCandidates } from './work';
import { lootItemClass } from './item';
import { matchRuneword } from './sockets';
import { enhancementCap } from './economy';
import type { LootItemDataV1 } from './types';
import i18next from 'i18next';
import { validateAttributeCatalog } from '../../attributeCatalog';
import type { Game } from '../../../engine/Core/Game';
import { Item, ItemCategory } from '../../../engine/Items/Item';
import { ItemLoader } from '../../../engine/Items/ItemLoader';
import { itemDisplayName } from '../../../engine/Items/ItemExtensionBindings';
import { resolveLootCatalog, stateOf } from './session';
import { buildLiveLootCompareView, lootCompareScalars, lootRingEquipSlots } from './comparison';
import { lootSigned } from './ui/format';
import { buildLootItemView, buildLootSalvageView, defaultLootPickupFilter, buildLootSetView } from './ui/viewModel';
import type { LootKnownItem, LootUiLocation, LootTextRef, LootAffixRowView } from './ui/types';
const viewCatalogs=new WeakMap<object,ReturnType<typeof resolveLootCatalog>>();
const text = (nameKey: string): LootTextRef => ({ nameKey, params: {} });
export function reachableLootItems(game: Game): { item: Item; location: LootUiLocation }[] {
 const equipment=[(game.party?game.focusedActor:game.player).equippedWeapon,(game.party?game.focusedActor:game.player).equippedArmor,(game.party?game.focusedActor:game.player).ringLeft,(game.party?game.focusedActor:game.player).ringRight];
 const result:{item:Item;location:LootUiLocation}[]=(game.party?game.focusedActor:game.player).inventory.items.map(item=>({item,location:equipment.includes(item)?'equipped' as const:'pack' as const}));
 if(!(game.party?game.focusedActor:game.player).hasStatus('hallucinating')) for(const item of game.items) if(game.grid.getCell(item.x,item.y)?.isVisible) result.push({item,location:'floor'});
 const ids=(game.party?game.readFocusedModuleView.bind(game):game.extensionRuntime?.readModuleView.bind(game.extensionRuntime))?.('loot')?.state.containerItemIds;
 if(Array.isArray(ids)) for(const id of ids) {
  if(typeof id!=='number')continue;
  const item=game.worldContainerItems?.get(id);if(item)result.push({item,location:'container'});
 }
 return result.filter(({item})=>[ItemCategory.WEAPON,ItemCategory.ARMOR,ItemCategory.RING].includes(item.category));
}
/** The adapter is the only place reading live Items. Vue receives known display data only. */
export function readLootGameView(game:Game,selectedId:number|null,selectedIds:readonly number[]) {
 const runtime=game.extensionRuntime!,catalog=viewCatalogs.get(runtime)??resolveLootCatalog(runtime.queryOptional.bind(runtime)),state=stateOf(runtime.itemCommandState('loot'));
 viewCatalogs.set(runtime,catalog);
 const attributeResult=runtime.queryOptional('growth.attributes.v1',{v:1});
 const attributeLabels:Record<string,string>={};
 if(attributeResult.status==='available'){validateAttributeCatalog(attributeResult.value);for(const entry of attributeResult.value.attributes)attributeLabels[entry.id]=i18next.t(entry.nameKey);}
 const options:import('./ui/types').LootUiOptions={presetId:state.presetId,attributeLabels};
 const reachable=reachableLootItems(game),equipment=[(game.party?game.focusedActor:game.player).equippedWeapon,(game.party?game.focusedActor:game.player).equippedArmor,(game.party?game.focusedActor:game.player).ringLeft,(game.party?game.focusedActor:game.player).ringRight];
 function known(item:Item,location:LootUiLocation):LootKnownItem|null {
  if(!item.moduleData?.loot||(game.party?game.focusedActor:game.player).hasStatus('hallucinating'))return null;
  if(item.moduleData?.loot&&location!=='floor'&&!(game.party?game.focusedActor:game.player).hasStatus('hallucinating')) return runtime.projectKnownItem(item,'loot',location).data as unknown as LootKnownItem;
  const socketProjection=item.moduleData?.loot&&location==='floor'?runtime.projectKnownItem(item,'loot',location).data as unknown as LootKnownItem:null;
  const rarity=socketProjection?.rarity??null;
  return {...(socketProjection?.sockets?{sockets:socketProjection.sockets}:{}),v:1,location,itemClass:item.category===0?'weapon':item.category===1?'armor':'ring',baseId:item.category===8&&!ItemLoader.identifiedItems.has(item.identityId??'')?null:item.identityId??null,rarity,ilvl:null,enhancement:0,affixCount:location==='floor'?null:0,affixes:[],setId:null,pieceId:null,uniqueId:null,rareName:null,corrupted:null,identified:!item.moduleData?.loot&&item.isIdentified,polarity:'unknown',familiarity:null};
 }
 Object.assign(options,{equippedKnown:equipment.filter((i):i is Item=>!!i).map(i=>({id:i.id,known:known(i,'equipped')}))});
 const sourceSets=[...new Set(options.equippedKnown!.flatMap(i=>i.known?.setId?[i.known.setId]:[]))].sort().map(id=>buildLootSetView(id,catalog,options));
 const entries=reachable.map(({item,location})=>({id:item.id,name:itemDisplayName(item,location,(game.party?game.focusedActor:game.player).hasStatus('hallucinating')),location,itemClass:item.category===0?'weapon' as const:item.category===1?'armor' as const:'ring' as const,known:known(item,location),owned:!!item.moduleData?.loot,
  canIdentify:location!=='floor'&&location!=='container'&&!!item.moduleData?.loot&&ItemLoader.canIdentifyItem(item),canSalvage:location==='pack'&&!!item.moduleData?.loot&&!(game.party?game.focusedActor:game.player).hasStatus('hallucinating'),
  enhancement:item.moduleData?.loot&&['pack','equipped'].includes(location)?{level:(item.moduleData.loot as unknown as LootItemDataV1).enhancement,cap:enhancementCap(item.moduleData.loot as unknown as LootItemDataV1,catalog.pack),allowed:game.canEnchantTarget(item),scroll:(game.party?game.focusedActor:game.player).inventory.items.some(i=>i.consumableId==='scroll_of_enchantment')}:null,
  canEquip:location==='pack',canUnequip:location==='equipped',
  ringEquipSlots:item.category===ItemCategory.RING&&location==='pack'?lootRingEquipSlots(item.id,equipment.slice(2).map(i=>i?.id??null)).map(index=>({slot:index===0?'left' as const:'right' as const,replace:!!equipment[index+2]})):[]}));
 const selectedRaw=reachable.find(r=>r.item.id===selectedId);
 const socketData=selectedRaw?.item.moduleData?.loot as unknown as LootItemDataV1|undefined;
 const socketAvailable=!!socketData&&selectedRaw?.location==='pack'&&socketData.rarity==='normal'&&socketData.enhancement===0&&socketData.socketed.length<socketData.sockets&&!(game.party?game.focusedActor:game.player).hasStatus('hallucinating');
 const socketChoices=socketAvailable?(game.party?game.focusedActor:game.player).inventory.items.flatMap(item=>{
  const rune=item.worldItem?catalog.runesById[item.worldItem.definitionId]:undefined,cls=lootItemClass(socketData!.baseId,catalog)!;
  if(!rune||!rune.itemClasses.includes(cls as 'weapon'|'armor'))return [];
  const word=matchRuneword(catalog,cls,socketData!.sockets,[...socketData!.socketed,rune.id]);
  return [{id:item.id,name:text(rune.nameKey),quantity:item.quantity,word:word?text(word.nameKey):null}];
 }):[];
 const workRead=(game.party?game.readFocusedModuleView.bind(game):runtime.readModuleView.bind(runtime))('loot')?.state.work as unknown as import('../../worldSdk').WorkContext|null;
 const station=workRead?workRead.stations.find(s=>s.tags.includes('station.forge')&&s.workPositions.some(p=>p.x===(game.party?game.focusedActor:game.player).x&&p.y===(game.party?game.focusedActor:game.player).y)):undefined;
 const workChoices:{operationId:string;rowId?:string;rowName?:LootTextRef;count:number;labelKey:string;payload:Record<string,unknown>}[]=[];
 if(station&&socketData&&selectedRaw?.location==='pack'&&!(game.party?game.focusedActor:game.player).hasStatus('hallucinating')&&workRead){
  const payload={itemId:selectedRaw.item.id,itemRevision:workRead.inventory.find(i=>i.id===selectedRaw.item.id)?.itemRevision,stationId:station.interactableId,stationRevision:station.revision,inventoryStamp:workRead.inventoryStamp};
  if(socketData.socketed.length)for(const mode of ['last','all'] as const){const operationId=`loot.work.unsocket-${mode}`;workChoices.push({operationId,count:mode==='all'?socketData.socketed.length:1,labelKey:mode==='last'?'ext.loot.ui.work.last':'ext.loot.ui.work.all',payload:{...payload,operationId}});}
  // Match the detail's prefix/suffix order; the command binds the unique affix ID and item stamp.
  socketData.affixes.map((row,index)=>({row,index,definition:catalog.affixes.find(a=>a.id===row.id)}))
   .sort((a,b)=>(a.definition?.position==='prefix'?0:1)-(b.definition?.position==='prefix'?0:1))
   .forEach(({row,index,definition})=>{if(reforgeCandidates(socketData,index,catalog).length){const operationId='loot.work.reforge';workChoices.push({operationId,rowId:row.id,rowName:text(definition!.nameKey),count:1,labelKey:'ext.loot.ui.work.reforge',payload:{...payload,operationId,rowId:row.id}});}});
 }
 const wordPreviews=selectedRaw&&!(game.party?game.focusedActor:game.player).hasStatus('hallucinating')?catalog.pack.runewords.words.filter(w=>w.baseClasses.includes(selectedRaw.item.category===0?'weapon':'armor')&&selectedRaw.item.category!==8).map(w=>({id:w.id,name:text(w.nameKey),sequence:w.sequence.map(id=>text(catalog.runesById[id]!.nameKey)),sockets:w.sockets,
  rows:buildLootItemView({v:1,location:'pack',itemClass:selectedRaw.item.category===0?'weapon':'armor',baseId:selectedRaw.item.identityId!,rarity:'runeword',ilvl:1,enhancement:0,affixCount:w.rows.length,affixes:w.rows.map(r=>({known:true,id:r.rowId,position:'row',polarity:1,tier:0,values:r.ranges.map(v=>v[0])})),sockets:{count:w.sockets,sequence:w.sequence},setId:null,pieceId:null,uniqueId:null,rareName:null,corrupted:false,identified:true,polarity:'benign',familiarity:null},catalog,options).rows})):[];
 const liveRows=(id:number,rows:readonly LootAffixRowView[]):readonly LootAffixRowView[]=>reachable.find(r=>r.item.id===id)?.item.runicType?rows:rows.map(row=>({...row,lines:row.lines.map(line=>line.runic?{...line,value:i18next.t('ext.loot.ui.runic.inactive',{value:line.value}),tone:'neutral' as const}:line)}));
 const selected=entries.find(e=>e.id===selectedId)??null;
 let card=null,compare=null;
 if(selected&&!(game.party?game.focusedActor:game.player).hasStatus('hallucinating')) {
  const raw=selected.known?buildLootItemView(selected.known,catalog,options):null;
  // Beta base formulas are never displayed in the game. Native prose remains in inspection.
  card=raw?{...raw,rows:liveRows(selected.id,raw.rows),baseStats:[]}:null;
  if(selected.location==='pack'||selected.location==='equipped') {
   const slots=selected.itemClass==='weapon'?[equipment[0]]:selected.itemClass==='armor'?[equipment[1]]:equipment.slice(2);
   compare=buildLiveLootCompareView({id:selected.id,known:selected.known,native:{itemClass:selected.itemClass,name:selected.name}},slots.map(i=>i?{id:i.id,known:known(i,'equipped'),native:!i.moduleData?.loot?{itemClass:i.category===0?'weapon':i.category===1?'armor':'ring',name:itemDisplayName(i,'equipped')}:undefined}:null),catalog,options,runtime.stats,(game.party?game.focusedActor:game.player).id);
  }
 }
 const salvage=buildLootSalvageView(entries.filter(e=>selectedIds.includes(e.id)&&e.canSalvage).map(e=>({key:String(e.id),item:e.known!})),catalog,state.presetId);
 const sourceItems=entries.filter(e=>e.location==='equipped'&&e.known).map(e=>({id:e.id,name:e.name,rows:liveRows(e.id,buildLootItemView(e.known!,catalog,options).rows.filter(row=>row.known))}));
 const sources=lootCompareScalars.flatMap(s=>{
  let b;try{b=runtime.stats.breakdown((game.party?game.focusedActor:game.player).id,s.key,{},true);}catch{return [];}
  return b.rows.filter(row=>row.known!==false&&row.layer==='equipment').map(row=>{
   const id=Number(/(?:loot\.item\.|native\.item\.)(\d+)/.exec(row.sourceId)?.[1]);
   const source=entries.find(e=>e.id===id&&e.location==='equipped');
   return {label:s.label,name:source?.name??'',value:row.category==='increased'||row.category==='more'?`${lootSigned(row.value/100)}%`:lootSigned(row.value/(s.divisor??1)),category:row.category};
  }).filter(row=>row.name);
 });
 return {workChoices,workAvailable:!!station,socketAvailable,socketChoices,wordPreviews,revision:state.revision,presetId:state.presetId,filter:structuredClone(state.filter),defaults:defaultLootPickupFilter(state.presetId),
  presetName:text(catalog.pack.presets.presets.find(p=>p.id===state.presetId)!.nameKey),entries,selected,card,compare,salvage,sources,sourceItems,sourceSets,
  shards:(game.party?game.focusedActor:game.player).inventory.items.filter(i=>i.worldItem?.definitionId==='loot.shard').reduce((n,i)=>n+i.quantity,0)};
}
export type LootGameView=ReturnType<typeof readLootGameView>;
