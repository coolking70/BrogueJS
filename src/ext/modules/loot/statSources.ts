import type { StatModifierRow, StatSourceProvider } from '../../stats';
import { projectItemModifiers } from './item';
import { monsterScalingAt } from './economy';
import type { EffectiveLootCatalog, LootItemDataV1, LootModifierDraft } from './types';
import { stateOf } from './session';
const remap: Record<string,string> = {'native.damage-min':'native.weapon-base-min','native.damage-max':'native.weapon-base-max','loot.local.armor':'native.armor-base',
  'native.regeneration':'native.regeneration-bonus','native.stealth-range':'native.stealth-points','native.light':'native.light-points'};
export function adaptLootModifier(mod: LootModifierDraft, itemId:number, index:number): StatModifierRow | null {
  // Implicit is already in native enchant; runic L0 is supplied by itemRunicPower, never added to native enchant.
  if(mod.stat==='loot.ring-implicit'||mod.runicType!==null||mod.unit==='runic-strength')return null;
  const stat=mod.stat==='native.defense'&&mod.unit==='display-armor'?'native.armor-base':remap[mod.stat]??mod.stat;
  const category=mod.category==='local-flat'?'flat':mod.category==='local-increased'?'increased':mod.category;
  const factor=['native.weapon-enchant','native.armor-enchant'].includes(stat)?4:mod.unit==='display-armor'?10:mod.stat==='native.awareness'?20:1;
  return {stat,category,value:mod.value*factor,layer:'equipment',sourceKind:'item-affix',sourceId:`loot.item.${itemId}.affix.${index}`,known:mod.known,
    ...(category==='more'?{slot:'equipment'}:{}),...(category==='override'?{priority:0}:{}),
    ...(mod.conditions?.length?{conditions:mod.conditions.map(c=>({kind:'target-tag' as const,value:c.tag}))}:{})};
}
export function lootStatSources(catalog:()=>EffectiveLootCatalog):StatSourceProvider {
 return {itemPolicy:'C6-1',initializeHealthOnBirth:true,
  keys:[{id:'loot.rarity-find',owner:'loot',unit:'bp',kind:'query',minimum:0,maximum:1000000,rounding:'floor',categories:['flat','increased','more','clamp'],increased:{minimum:-9000,maximum:50000},moreSlots:[],base:0}],
  collect(actor,context){
   const c=catalog(),preset=c.pack.presets.presets.find(p=>p.id===stateOf(context.state).presetId)!;
   if(!actor.player){
    if(!actor.hostile||(context.depth??0)<1)return [];
    const scale=monsterScalingAt(preset,context.depth!);
    return [['native.max-hp',scale.hpBp],['native.physical-damage-dealt',scale.damageBp],['native.accuracy',scale.accuracyBp]].filter(([,n])=>n!==0).map(([stat,value])=>({stat:String(stat),value:Number(value),category:'increased',layer:'environment',sourceKind:'loot-scaling',sourceId:`loot.scaling.${stat}`}));
   }
   const rows:StatModifierRow[]=context.equippedItems().flatMap(item=>{
    const data=item.moduleData?.loot as unknown as LootItemDataV1|undefined;
    if(!data)return [];
    const drafts=projectItemModifiers(data,c), expanded:LootModifierDraft[]=[];
    for(let i=0;i<drafts.length;i++){
     const mod=drafts[i]!;
     if(mod.stat!=='loot.local.damage'){expanded.push(mod);continue;}
     if(mod.category==='local-flat'){
      const next=drafts[++i];if(!next||next.stat!==mod.stat||next.sourceId!==mod.sourceId)throw new Error('Invalid local damage pair');
      expanded.push({...mod,stat:'native.weapon-base-min'},{...next,stat:'native.weapon-base-max'});
     }else expanded.push({...mod,stat:'native.weapon-base-min'},{...mod,stat:'native.weapon-base-max'});
    }
    return expanded.flatMap((mod,i)=>{
     const row=adaptLootModifier(mod,item.id,i);if(!row)return [];
     const cap=c.pack.caps.caps.find(cap=>cap.stat===mod.stat&&cap.scope==='loot-sources');
     if(!cap)return [row];
     const factor=mod.stat==='native.weapon-enchant'?4:mod.stat==='native.awareness'?20:1;
     return [{...row,budget:{minimum:(cap.min??-1000000)*factor,maximum:(cap.max??1000000)*factor}}];
    });
   });
   for(const cap of c.pack.caps.caps.filter(c=>c.scope==='final')) rows.push({stat:cap.stat,category:'clamp',value:cap.min??0,maximum:cap.max??1000000,layer:'environment',sourceKind:'loot-cap',sourceId:`loot.cap.${cap.stat}`});
   return rows;
  }
 };
}
