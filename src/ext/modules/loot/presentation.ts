import i18next from 'i18next';
import { buildLootChipView } from './ui/viewModel';
import type { LootKnownItem } from './ui/types';
import type { ItemPresentationProvider } from '../../itemSdk';
import type { Json } from '../../types';
import type { EffectiveLootCatalog, LootItemDataV1 } from './types';
import { projectLootKnowledge } from './ui/knowledge';
import type { LootKnowledgeFacts } from './ui/types';
export function lootPresentation(catalog:()=>EffectiveLootCatalog):ItemPresentationProvider {
 return {project(item,knowledge){
   const k=knowledge as Record<string,Json>,data=item.moduleData!.loot as unknown as LootItemDataV1;
   const location=k.location as LootKnowledgeFacts['location'],known=data.affixes.every(a=>a.known);
   return JSON.parse(JSON.stringify(projectLootKnowledge(data,catalog(),{v:1,location,ringKindKnown:k.kindKnown===true,
    magicPolarity:'unknown',curseRevealed:false,hallucinating:false,
    familiarity:location==='floor'||known?null:{unit:item.category===0?'kills':'turns',remaining:Number(k.familiarityRemaining)}})));
  },name(facts){
   const data=facts.data as Record<string,Json>;
   const rarity=catalog().pack.rarities.rarities.find(r=>r.id===data.rarity);
   if(!rarity)return null;
   if(facts.location==='floor')return {nameKey:'ext.loot.ui.integration.decorated',params:{base:facts.baseName,marker:rarity.marker}};
   const view=buildLootChipView(facts.data as unknown as LootKnownItem,catalog()),params:Record<string,string|number>={base:facts.baseName};
   for(const [key,part] of Object.entries(view.name.parts))if(key!=='base')params[key]=part?i18next.t(part.nameKey,part.params):'';
   const name=i18next.t(view.name.nameKey,{...params,interpolation:{escapeValue:false}});
   return {nameKey:'ext.loot.ui.integration.decorated',params:{base:name,marker:rarity.marker}};
  },appearance(facts){
   const rarity=(facts.data as Record<string,Json>).rarity;
   const colorToken=rarity==='unique'?'item-unique':rarity==='rare'?'item-rare':rarity==='magic'?'item-uncommon':'item-common';
   return {colorToken,marker:''};
  }};
}
