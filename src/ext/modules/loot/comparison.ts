/** Production comparison adapter. Only knowledge DTOs and the public scalar SDK enter here. */
import type { StatQuery } from '../../stats';
import type { EffectiveLootCatalog } from './types';
import type { LootCompareView, LootKnownItem, LootTextRef, LootUiOptions } from './ui/types';
import { buildLootCompareView } from './ui/viewModel';
import { lootSigned } from './ui/format';
const scalars:readonly {key:string;label:LootTextRef;lower?:boolean;divisor?:number}[]=[
 {key:'native.damage-min',label:{nameKey:'ext.loot.ui.integration.damage-min',params:{}}},
 {key:'native.damage-max',label:{nameKey:'ext.loot.ui.integration.damage-max',params:{}}},
 {key:'native.defense',label:{nameKey:'ext.loot.ui.integration.defense',params:{}},divisor:10},
 {key:'native.max-hp',label:{nameKey:'ext.loot.ui.integration.max-hp',params:{}}},
 {key:'native.strength',label:{nameKey:'ext.loot.ui.integration.strength',params:{}}},
 {key:'native.attack-speed',label:{nameKey:'ext.loot.ui.integration.attack-speed',params:{}},lower:true},
];
export function buildLiveLootCompareView(candidate:{id:number;known:LootKnownItem},equipped:readonly ({id:number;known:LootKnownItem}|null)[],catalog:EffectiveLootCatalog,options:LootUiOptions,stats:Pick<StatQuery,'hypothetical'>,playerId:number):LootCompareView {
 const preview=buildLootCompareView(candidate.known,equipped.map(i=>i?.known??null),catalog,{...options,playerStrength:null});
 if(!preview.available)return preview;
 const before=stats.hypothetical(playerId,{},true);
 const columns=preview.columns.map((column,index)=>{
  const previous=equipped[index];
  const after=stats.hypothetical(playerId,{equip:candidate.id,...(previous?{unequip:previous.id}:{})},true);
  return {...column,rows:[...scalars.map(s=>{
   const a=before[s.key]!/(s.divisor??1),b=after[s.key]!/(s.divisor??1),d=b-a,score=s.lower?-d:d;
   return {key:s.key,label:s.label,before:String(a),after:String(b),delta:lootSigned(d,1),tone:score>0?'better' as const:score<0?'worse' as const:'same' as const};
  }),...column.rows.filter(row=>row.condition||row.runic)]};
 });
 return {...preview,columns,notices:[...preview.notices.filter(n=>n.nameKey!=='ext.loot.ui.compare.provisional'),{nameKey:'ext.loot.ui.integration.conditional',params:{}}]};
}
