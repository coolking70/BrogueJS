import type { ItemTriggerFact } from '../../itemSdk';
import type { Json } from '../../types';
import type { EffectiveLootCatalog, LootItemDataV1 } from './types';
/** Match only the rows whose mechanics participated in this host receipt.
 * Nonzero signed sources participate even at a cap; runic rows remain 6B4. */
export function triggerLootKnowledge(data:LootItemDataV1,catalog:EffectiveLootCatalog,fact:ItemTriggerFact,nativeEnchantment?:number):Json {
 const active=fact.kind==='stat-commit'?new Set(fact.stats):fact.role==='attacker'?new Set(['loot.local.damage','native.weapon-enchant','native.physical-damage-dealt']):new Set(['native.physical-damage-taken']);
 const receiptKey=(stat:string)=>stat==='loot.ring-implicit'?data.baseId==='ring_of_regeneration'?'native.regeneration-bonus':data.baseId==='ring_of_awareness'?'native.awareness':stat:({ 'loot.local.armor':'native.armor-base','native.defense':'native.armor-base','native.regeneration':'native.regeneration-bonus','native.light':'native.light-points','native.stealth-range':'native.stealth-points' } as Record<string,string>)[stat]??stat;
 const unique=catalog.pack.uniques.uniques.find(u=>u.id===data.uniqueId);
 return JSON.parse(JSON.stringify({...data,affixes:data.affixes.map(a=>{
  const mods=(unique?.rows.find(r=>r.rowId===a.id)??catalog.affixes.find(d=>d.id===a.id))?.modifiers??[];
  return {...a,known:a.known||mods.some(m=>active.has(receiptKey(m.stat))&&(m.stat!=='loot.ring-implicit'||nativeEnchantment!==0)&&a.values[m.valueIndex]!==0&&!m.runicType&&(!m.conditions?.length||m.conditions.every(c=>fact.targetTags.includes(c.tag))))};
 })}));
}
