import type { ItemEnhancementProvider } from '../../itemSdk';
import type { Json } from '../../types';
import { deriveNativeFacts, validateLootItemData } from './item';
import { enhancementCap } from './economy';
import { CountedLootRandom } from './random';
import type { EffectiveLootCatalog, LootItemDataV1, LootRandom } from './types';

/** Stable stored row order, including full positive rows. Negative values in a
 * positive modifier (speed/reduction) improve toward the end of its range. */
export function refinementRows(data: LootItemDataV1, catalog: EffectiveLootCatalog) {
 const unique=catalog.piecesById[data.pieceId!]?.piece??catalog.pack.uniques.uniques.find(u=>u.id===data.uniqueId);
 return data.affixes.flatMap((roll,index)=>{
  const row=unique?.rows.find(r=>r.rowId===roll.id),affix=catalog.affixes.find(a=>a.id===roll.id);
  const ranges=row?.ranges??affix?.tiers.find(t=>t.tier===roll.tier)?.ranges;
  const positive=row?row.modifiers.every(m=>['native.attack-speed','native.physical-damage-taken'].includes(m.stat)?roll.values[m.valueIndex]!<=0:roll.values[m.valueIndex]!>=0):affix?.polarity===1;
  return positive&&ranges?.length?[{index,ranges}]:[];
 });
}
export function lootEnhancementLimit(data:LootItemDataV1,catalog:EffectiveLootCatalog):number {
 const remaining=enhancementCap(data,catalog.pack)-data.enhancement;
 if(remaining>0)return remaining;
 return refinementRows(data,catalog).some(r=>r.ranges.some((range,i)=>data.affixes[r.index]!.values[i]!<range[1]))?1:0;
}
export function enhanceLoot(data:LootItemDataV1,catalog:EffectiveLootCatalog,amount:number,random:LootRandom):LootItemDataV1 {
 if(!validateLootItemData(data,catalog)||!Number.isSafeInteger(amount)||amount<0)throw new RangeError('Invalid enhancement');
 const next=structuredClone(data),limit=lootEnhancementLimit(data,catalog);
 if(amount===0)return next;
 if(!limit||amount>limit)throw new RangeError('Enhancement exceeds target capacity');
 const cap=enhancementCap(data,catalog.pack);
 if(data.enhancement<cap){next.enhancement+=amount;return next;}
 const rows=refinementRows(data,catalog),rng=new CountedLootRandom(random);rng.beginItem();
 const row=rows[rng.randomInt(0,rows.length-1)]!;
 next.affixes[row.index]!.values=row.ranges.map(([lo,hi],i)=>Math.max(data.affixes[row.index]!.values[i]!,rng.randomInt(lo,hi)));
 return next;
}
export function lootEnhancement(catalog:()=>EffectiveLootCatalog):ItemEnhancementProvider {
 return {
  preview(data){const item=data as unknown as LootItemDataV1,c=catalog();if(item.enhancement>=enhancementCap(item,c.pack))return null;
   const next=enhanceLoot(item,c,1,{randomInt:()=>{throw new Error('Preview cannot draw');}});return {data:next as unknown as Json,enchantmentDelta:deriveNativeFacts(next,c).enchantment-deriveNativeFacts(item,c).enchantment};},
  limit(data){return lootEnhancementLimit(data as unknown as LootItemDataV1,catalog());},
  apply(data,amount,random){const next=enhanceLoot(data as unknown as LootItemDataV1,catalog(),amount,random);return {data:next as unknown as Json,enchantmentDelta:deriveNativeFacts(next,catalog()).enchantment-deriveNativeFacts(data as unknown as LootItemDataV1,catalog()).enchantment};},
 };
}
