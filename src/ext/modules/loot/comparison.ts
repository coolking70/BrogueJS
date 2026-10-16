/** Production comparison adapter. Only knowledge DTOs and the public scalar SDK enter here. */
import i18next from 'i18next';
import type { StatQuery, EquipChange, PairFacts } from '../../stats';
import type { EffectiveLootCatalog, ItemClass } from './types';
import type { LootCompareView, LootKnownItem, LootTextRef, LootUiOptions, LootChipView } from './ui/types';
import { buildLootChipView, buildLootModifierCompareRows, knownSetCount } from './ui/viewModel';
import { lootSigned } from './ui/format';
export const lootCompareScalars:readonly {key:string;label:LootTextRef;lower?:boolean;divisor?:number;probe?:boolean}[]=[
 {key:'native.damage-min',label:{nameKey:'ext.loot.ui.integration.damage-min',params:{}}},
 {key:'native.damage-max',label:{nameKey:'ext.loot.ui.integration.damage-max',params:{}}},
 {key:'native.defense',label:{nameKey:'ext.loot.ui.integration.defense',params:{}},divisor:10},
 {key:'native.max-hp',label:{nameKey:'ext.loot.ui.integration.max-hp',params:{}}},
 {key:'native.strength',label:{nameKey:'ext.loot.ui.integration.strength',params:{}}},
 {key:'native.attack-speed',label:{nameKey:'ext.loot.ui.integration.attack-speed',params:{}},lower:true},
 {key:'growth.focus-capacity',label:{nameKey:'ext.loot.ui.stat.growth-focus-capacity',params:{}}},
 {key:'native.accuracy',label:{nameKey:'ext.loot.ui.live.accuracy',params:{}},lower:false},
 {key:'native.move-speed',label:{nameKey:'ext.loot.ui.live.move-speed',params:{}},lower:true},
 {key:'native.regeneration-bonus',label:{nameKey:'ext.loot.ui.live.regeneration-bonus',params:{}},lower:false},
 {key:'native.resist.fire',label:{nameKey:'ext.loot.ui.live.resist.fire',params:{}},lower:false},
 {key:'native.resist.poison',label:{nameKey:'ext.loot.ui.live.resist.poison',params:{}},lower:false},
 {key:'native.stealth-range',label:{nameKey:'ext.loot.ui.live.stealth-range',params:{}},lower:true},
 {key:'native.awareness',label:{nameKey:'ext.loot.ui.live.awareness',params:{}},lower:false},
 {key:'native.clairvoyance',label:{nameKey:'ext.loot.ui.live.clairvoyance',params:{}},lower:false},
 {key:'native.light',label:{nameKey:'ext.loot.ui.live.light',params:{}},lower:false},
 {key:'native.transference',label:{nameKey:'ext.loot.ui.live.transference',params:{}},lower:false},
 {key:'native.reaping',label:{nameKey:'ext.loot.ui.live.reaping',params:{}},lower:false},
 {key:'native.wisdom',label:{nameKey:'ext.loot.ui.live.wisdom',params:{}},lower:false},
 {key:'loot.rarity-find',label:{nameKey:'ext.loot.ui.live.rarity-find',params:{}}},
 {key:'combat.stamina-capacity',label:{nameKey:'ext.loot.ui.live.stamina-max',params:{}}},
 {key:'combat.stamina-regen',label:{nameKey:'ext.loot.ui.live.stamina-regen',params:{}}},
 {key:'combat.poise-capacity',label:{nameKey:'ext.loot.ui.live.poise-max',params:{}}},
 {key:'combat.poise-recovery',label:{nameKey:'ext.loot.ui.live.poise-regen',params:{}}},
 {key:'native.regeneration',label:{nameKey:'ext.loot.ui.live.recovery',params:{}},probe:true},
 {key:'native.physical-damage-taken',label:{nameKey:'ext.loot.ui.live.physical-taken',params:{}},probe:true,lower:true,divisor:10},
];
export interface LiveLootItem {id:number;known:LootKnownItem|null;native?:{itemClass:ItemClass;name:string}}
function nativeChip(name:string):LootChipView {return {glyph:')',rarity:{id:null,colorDark:'#cccccc',colorLight:'#333333',marker:'',label:null},name:{nameKey:'ext.loot.ui.name.normal',parts:{base:{nameKey:'ext.loot.ui.live.native-name',params:{name}},prefix:null,suffix:null,first:null,second:null,unique:null},enhancement:0},corrupted:null,unknownCount:0,countHidden:false};}
/** Native equip fills the first empty ring slot; replacement is accepted only when both are full. */
export function lootRingEquipSlots(candidateId:number,equipped:readonly (number|null)[]):number[] {
 if(equipped.includes(candidateId))return [];
 if(equipped[0]==null)return [0];
 if(equipped[1]==null)return [1];
 return [0,1];
}
export function buildLiveLootCompareView(candidate:LiveLootItem,equipped:readonly (LiveLootItem|null)[],catalog:EffectiveLootCatalog,options:LootUiOptions,stats:Pick<StatQuery,'hypothetical'> & {hypotheticalValue?(actorId:number,change:EquipChange,stat:string,knownOnly:boolean,facts?:PairFacts):number},playerId:number):LootCompareView {
 const itemClass=candidate.known?.itemClass??candidate.native!.itemClass;
 const slots=itemClass==='weapon'?['ext.loot.ui.slot.weapon']:itemClass==='armor'?['ext.loot.ui.slot.armor']:['ext.loot.ui.slot.left-ring','ext.loot.ui.slot.right-ring'];
 const chip=(item:LiveLootItem)=>item.known?buildLootChipView(item.known,catalog):nativeChip(item.native!.name);
 if(candidate.known?.location==='floor')return {candidate:chip(candidate),available:false,columns:[],notices:[{nameKey:'ext.loot.ui.compare.pickup-first',params:{}}]};
 const currentIndex=equipped.findIndex(item=>item?.id===candidate.id);
 const indices=currentIndex>=0?[currentIndex]:itemClass==='ring'?lootRingEquipSlots(candidate.id,equipped.map(item=>item?.id??null)):[0];
 const values=(change:Parameters<StatQuery['hypothetical']>[1])=>({...stats.hypothetical(playerId,change,true),...(stats.hypotheticalValue?Object.fromEntries(lootCompareScalars.filter(s=>s.probe).map(s=>[s.key,stats.hypotheticalValue!(playerId,change,s.key,true,s.key==='native.physical-damage-taken'?{baseValue:1000,attackKind:'melee'}:{})])):{})});
 const scalars=[...lootCompareScalars,...(catalog.availability.growth?.attributes??[]).map(id=>({key:`growth.attribute:${id}`,label:{nameKey:'ext.loot.ui.stat.growth-attribute',params:{name:options.attributeLabels?.[id]??id}},divisor:1,lower:false}))];
 const before=values({});
 const columns=indices.map(index=>{
  const previous=equipped[index];
  const after=currentIndex>=0?before:values({equip:candidate.id,...(previous?{unequip:previous.id}:{})});
  const all=options.equippedKnown??equipped.filter((i):i is LiveLootItem=>!!i);
  const next=currentIndex>=0?all:[...all.filter(i=>i.id!==previous?.id&&i.id!==candidate.id),candidate];
  const setIds=[...new Set([...all,...next].flatMap(i=>i.known?.setId?[i.known.setId]:[]))].sort();
  const setRows=setIds.flatMap(id=>{
   const a=knownSetCount(id,all),b=knownSetCount(id,next),set=catalog.setsById[id]!;
   const row=(key:string,label:LootTextRef,x:number,y:number)=>({key,label,before:String(x),after:String(y),delta:lootSigned(y-x),tone:y>x?'better' as const:y<x?'worse' as const:'same' as const});
   return [row(id,{nameKey:'ext.loot.ui.set.compare-count',params:{name:i18next.t(set.nameKey)}},a,b),...set.bonuses.map(bonus=>row(`${id}.${bonus.count}`,{nameKey:'ext.loot.ui.set.compare-bonus',params:{name:i18next.t(set.nameKey),count:bonus.count}},a>=bonus.count?1:0,b>=bonus.count?1:0))];
  });
  return {slot:{nameKey:slots[index]!,params:{}},equipped:previous?chip(previous):null,rows:[...setRows,...scalars.filter(s=>before[s.key]!==undefined&&after[s.key]!==undefined).map(s=>{
   const a=before[s.key]!/(s.divisor??1),b=after[s.key]!/(s.divisor??1),d=b-a,score=s.lower?-d:d;
   return {key:s.key,label:s.label,before:String(Math.round(a*1000)/1000),after:String(Math.round(b*1000)/1000),delta:lootSigned(d,1),tone:score>0?'better' as const:score<0?'worse' as const:'same' as const};
  }),...buildLootModifierCompareRows(candidate.known,previous?.known??null,catalog,options).filter(row=>row.condition||row.runic)]};
 });
 const unknown=[candidate,...equipped.filter((i):i is LiveLootItem=>!!i&&i.id!==candidate.id)].reduce((n,i)=>n+(i.known?.affixes.filter(a=>!a.known).length??0),0);
 return {candidate:chip(candidate),available:true,columns,notices:[...(unknown?[{nameKey:'ext.loot.ui.compare.unknown-excluded',params:{count:unknown}}]:[]),{nameKey:'ext.loot.ui.integration.conditional',params:{}}]};
}
