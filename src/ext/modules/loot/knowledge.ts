import type { ItemTriggerFact } from '../../itemSdk';
import type { Json } from '../../types';
import type { EffectiveLootCatalog, LootItemDataV1 } from './types';
/** Only facts with a direct physical-settlement witness are admitted in 6B1.
 * Passive/resource/rune effects await their own post-settlement ports. */
export function triggerLootKnowledge(data:LootItemDataV1,catalog:EffectiveLootCatalog,fact:ItemTriggerFact):Json {
 const active=fact.role==='attacker'?new Set(['loot.local.damage','native.weapon-enchant','native.physical-damage-dealt']):new Set(['native.physical-damage-taken']);
 const unique=catalog.pack.uniques.uniques.find(u=>u.id===data.uniqueId);
 return JSON.parse(JSON.stringify({...data,affixes:data.affixes.map(a=>{
  const mods=(unique?.rows.find(r=>r.rowId===a.id)??catalog.affixes.find(d=>d.id===a.id))?.modifiers??[];
  return {...a,known:a.known||mods.some(m=>active.has(m.stat)&&!m.runicType&&(!m.conditions?.length||m.conditions.every(c=>fact.targetTags.includes(c.tag))))};
 })}));
}
