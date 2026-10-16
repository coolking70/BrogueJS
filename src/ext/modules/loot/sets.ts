import type { EffectiveLootCatalog, LootItemDataV1, LootModifierDraft } from './types';
export interface SetEquipment { id:number; data:LootItemDataV1 }
/** Four slots only. Distinct piece identity, canonical set order and numeric anchor. */
export function equippedLootSets(items:readonly SetEquipment[],catalog:EffectiveLootCatalog,knownOnly=false) {
 const groups=new Map<string,SetEquipment[]>();
 for(const item of items){
  if(!item.data.setId||knownOnly&&!item.data.identityKnown)continue;
  const members=groups.get(item.data.setId)??[];members.push(item);groups.set(item.data.setId,members);
 }
 return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([setId,members])=>({
  set:catalog.setsById[setId]!,count:new Set(members.map(i=>i.data.pieceId)).size,
  anchorId:Math.min(...members.map(i=>i.id)),
 }));
}
export function setModifierDrafts(items:readonly SetEquipment[],catalog:EffectiveLootCatalog,knownOnly=false) {
 return equippedLootSets(items,catalog,knownOnly).flatMap(({set,count,anchorId})=>set.bonuses.filter(b=>b.count<=count).flatMap(b=>b.rows.flatMap(row=>row.modifiers.map((mod,index)=>({
  anchorId,sourceId:`loot.item.${anchorId}.set.${set.id}.b${b.count}.${row.rowId}.${index}`,
  draft:{sourceId:row.rowId,stat:mod.stat,category:mod.category,slot:mod.slot??null,unit:mod.unit,value:row.ranges[mod.valueIndex]![0],conditions:mod.conditions,runicType:null,known:true} satisfies LootModifierDraft,
 })))));
}
