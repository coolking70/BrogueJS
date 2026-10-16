/** Test-only C6 provider. No private engine or production module imports. */
import type { ItemContribution } from '../../../itemSdk';
import type { ExtensionModule, Json } from '../../../types';
import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../../descriptor';
export const itemContribution: ItemContribution = {
  itemDataValidators: { c6fixture: (data, { item }) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    const d = data as Record<string, unknown>;
    return Object.keys(d).sort().join(',') === 'known,power,v' && d.v === 1
      && typeof d.known === 'boolean' && Number.isSafeInteger(d.power) && Number(d.power) >= -20 && Number(d.power) <= 20
      && item.quantity === 1 && item.identified === d.known;
  } }
};
export function createItemFixture(): ExtensionModule {
  return { id: 'c6fixture', version: '1.0.0', ...itemContribution,
    initialState: () => ({}), validateState: (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length };
}
export const descriptor: ModuleDescriptor = { id: 'c6fixture', version: '1.0.0', foundation: FOUNDATION_PROTOCOL,
  labelKey: 'ext.c6fixture.name', create: createItemFixture };

/** External provider witness: imports only public SDK types, no host objects. */
export function createItemDropFixture(overrides: Partial<import('../../../itemSdk').DropProvider> = {}): ExtensionModule {
  const module=createItemFixture();
  return {...module, initialState:()=>({settled:0,watermark:0}),
    validateState:(v:unknown):v is Json=>!!v&&typeof v==='object'&&!Array.isArray(v)
      &&Object.keys(v).sort().join(',')==='settled,watermark'
      &&['settled','watermark'].every(k=>Number.isSafeInteger((v as Record<string,number>)[k])&&(v as Record<string,number>)[k]!>=0),
    itemDrops:{sources:['floor','vault','kill','encounter'],uniqueCatalog:['c6fixture.one'],
      roll(event,context){
        const category=event.source==='floor'||event.source==='vault'?event.itemClass:'weapon';
        const kind=event.source==='vault'&&event.baseId?event.baseId:category==='weapon'?'dagger':category==='armor'?'leather_armor':'ring_of_regeneration';
        const power=context.randomInt(1,3);
        return {v:1,converted:true,items:[{kind:'native',native:{kind,category,enchantment:0,runicType:null,isCursed:false,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,known:false,power}}}],gold:event.source==='kill'||event.source==='encounter'?7:0,uniqueIds:[null]};
      },
      settle(state,event){const s=state as Readonly<{settled:number;watermark:number}>;return {settled:s.settled+1,watermark:event.source==='encounter'?event.encounterOrdinal:s.watermark};},...overrides}
  };
}

export function createItemEncounterFixture():ExtensionModule {
  return {...createItemDropFixture({sources:['kill','encounter']}),ownedRegions:true,
    nativeForms:[{id:'c6fixture.guardian',nameKey:'ext.c6fixture.guardian',descriptionKey:'ext.c6fixture.guardianDescription',size:2,char:'Q',color:0x998877,hp:100,accuracy:90,defense:40,damage:'4-9',moveSpeed:100,attackSpeed:100,bloodType:0,DFChance:0,DFType:0}],
    generationContributions:[{id:'c6fixture.chamber',priority:0,minDepth:1,maxDepth:2,chance:100,width:12,height:10,entranceWidth:3,candidateLimit:16,formId:'c6fixture.guardian',guard:'return-to-spawn'}],
    itemEncounters:['c6fixture.chamber']};
}

/** Neutral rows demonstrate unit conversion, source separation and known-only projections. */
export function createItemStatsFixture():ExtensionModule {
  return {...createItemFixture(),statSources:{itemPolicy:'C6-1',collect(actor,context){
    if(!actor.player)return [];
    return context.equippedItems().flatMap(item=>{
      const data=item.moduleData?.c6fixture as Readonly<{power:number;known:boolean}>|undefined;if(!data)return [];
      const p=data.power,rows:import('../../../stats').StatModifierRow[]=[];
      const row=(stat:string,category:import('../../../stats').StatCategory,value:number,slot?:string)=>rows.push({stat,category,value,layer:'equipment',sourceKind:'item-affix',sourceId:`c6fixture.item.${item.id}.affix.${rows.length}`,known:data.known,...(slot?{slot}:{})});
      if(item.category===0){
        for(const stat of ['native.weapon-base-min','native.weapon-base-max']){row(stat,'flat',p);row(stat,'increased',1000);}
        row('native.weapon-enchant','flat',p*4);row('native.max-hp','flat',p);
        row('native.attack-speed','more',-p*1000,'equipment');row('native.physical-damage-taken','increased',-p*1000);
      }else if(item.category===1){row('native.armor-base','flat',p*10);row('native.armor-base','increased',1000);row('native.armor-enchant','flat',p*4);
      }else if(item.category===8){row('native.regeneration-bonus','flat',p);row('native.stealth-points','flat',p);row('native.light-points','flat',p);row('native.awareness','flat',p*20);}
      return rows;
    });
  }}};
}

import { extensionDataFingerprint } from '../../../fingerprint';
import type { WorldDefinitionPack } from '../../../worldSdk';
import type { ItemCommandProvider, ItemCommandProposal } from '../../../itemSdk';
import type { ReadonlyJson } from '../../../types';
export const commandDefinitions:WorldDefinitionPack={schema:1,worldSdk:1,items:[{owner:'c6fixture',id:'c6fixture.shard',nameKey:'ext.c6fixture.shard',descriptionKey:'ext.c6fixture.shardDescription',category:'material',glyph:'*',color:'#aaaaaa',maxStack:99,nativeTemplate:null,tags:[],tool:null}],resourceNodes:[],stations:[],recipes:[],startupItems:null};
const commandRules={schema:1,version:'1.0.0',fingerprint:extensionDataFingerprint(commandDefinitions)};
type FixtureState={revision:number;created:boolean;presetId:string;settled:number;watermark:number;filter:{minRarity:string;classes:string[];autoPickupGold:boolean}};
const stateOf=(s:ReadonlyJson)=>s as unknown as FixtureState;
function command(kind:ItemCommandProvider['kind']):ItemCommandProvider {return {kind,...(kind==='identify'?{materialDefinitionId:'c6fixture.shard'}:{}),prepare(payload,ctx){
 const p=payload as Record<string,ReadonlyJson>,state=stateOf(ctx.state),next:FixtureState=JSON.parse(JSON.stringify(state));next.revision++;
 const proposal:{-readonly [K in keyof ItemCommandProposal]:ItemCommandProposal[K]}={v:1,revision:ctx.revision,consume:[],updateOwnData:[],materials:[],nextState:next,chargedTicks:0,confirmation:null};
 if(kind==='create'){next.created=true;next.presetId=String(p.presetId);}
 if(kind==='filter'){if(!['all','rare'].includes(String(p.minRarity)))return null;next.filter={minRarity:String(p.minRarity),classes:p.classes as string[],autoPickupGold:p.autoPickupGold as boolean};}
 if(kind==='salvage'){const ids=p.itemIds as number[];proposal.consume=ids.map(itemId=>({itemId,quantity:1}));proposal.materials=[{definitionId:'c6fixture.shard',quantity:ids.length*10}];proposal.chargedTicks=100*ids.length;if(ids.some(id=>(ctx.inventory.find(i=>i.id===id)?.moduleData?.c6fixture as Record<string,ReadonlyJson>)?.unique===true))proposal.confirmation={nameKey:'ext.c6fixture.confirmUnique',params:{}};}
 if(kind==='identify'){const item=ctx.inventory.find(i=>i.id===p.itemId);if(!item?.moduleData?.c6fixture)return null;proposal.updateOwnData=[{itemId:item.id,data:{...(item.moduleData.c6fixture as Record<string,ReadonlyJson>),known:true}}];let left=10;proposal.consume=ctx.inventory.filter(i=>i.materialDefinitionId==='c6fixture.shard').flatMap(i=>{const n=Math.min(left,i.quantity);left-=n;return n?[{itemId:i.id,quantity:n}]:[];});proposal.chargedTicks=100;}
 return proposal;
}};}
export function createItemCompleteFixture():ExtensionModule {
 const drops=createItemDropFixture(),stats=createItemStatsFixture();
 return {...drops,rules:commandRules,worldDefinitions:commandDefinitions,statSources:stats.statSources,
 initialState:()=>({revision:0,created:false,presetId:'',settled:0,watermark:0,filter:{minRarity:'all',classes:['armor','ring','weapon'],autoPickupGold:true}}),
 validateState:(v:unknown):v is Json=>{if(!v||typeof v!=='object'||Array.isArray(v))return false;const s=v as FixtureState;return Object.keys(s).sort().join(',')==='created,filter,presetId,revision,settled,watermark'&&Number.isSafeInteger(s.revision)&&s.revision>=0&&typeof s.created==='boolean'&&typeof s.presetId==='string'&&Number.isSafeInteger(s.settled)&&Number.isSafeInteger(s.watermark)&&!!s.filter&&['all','rare'].includes(s.filter.minRarity)&&Array.isArray(s.filter.classes)&&s.filter.classes.every(c=>['weapon','armor','ring'].includes(c))&&typeof s.filter.autoPickupGold==='boolean';},
 initialCommand:{action:'create',payload:{v:1,presetId:'standard'}},validateInitialCommand:(action,payload)=>action==='create'&&JSON.stringify(payload)===JSON.stringify({v:1,presetId:'standard'}),initializationReady:ctx=>stateOf(ctx.state).created,
 itemCommands:{create:command('create'),'set-filter':command('filter'),salvage:command('salvage'),'identify-shards':command('identify')},
 itemDrops:{...drops.itemDrops!,settle(state,event){const s=stateOf(state);return {...s,settled:s.settled+1,watermark:event.source==='encounter'?event.encounterOrdinal:s.watermark};}},
 itemDataValidators:{c6fixture:(data,{item})=>{if(!data||typeof data!=='object'||Array.isArray(data))return false;const d=data as Record<string,ReadonlyJson>;return Object.keys(d).every(k=>['v','known','power','unique'].includes(k))&&d.v===1&&typeof d.known==='boolean'&&Number.isSafeInteger(d.power)&&Math.abs(Number(d.power))<=20&&(d.unique===undefined||typeof d.unique==='boolean')&&item.identified===d.known&&item.quantity===1;}},
 itemKnowledge:{known:data=>(data as Record<string,ReadonlyJson>).known===true,unique:data=>(data as Record<string,ReadonlyJson>).unique===true,reveal:data=>({...data as Record<string,ReadonlyJson>,known:true})},
 itemPickup:(item,state)=>{const f=stateOf(state).filter;if(item.category===5)return f.autoPickupGold;if(!item.moduleData?.c6fixture)return true;return f.minRarity==='all'&&f.classes.includes(item.category===0?'weapon':item.category===1?'armor':'ring');},
 itemPresentation:{project(item){const d=item.moduleData!.c6fixture as Record<string,ReadonlyJson>;return {rarity:d.unique?'unique':'rare',baseId:item.kindKey,isCursed:item.isCursed,rows:[{known:d.known!,id:'c6fixture.power',tier:1,values:[d.power!],sourceId:`c6fixture.item.${item.id}`,label:d.known?String(d.power):'?'}]};},name(facts){const d=facts.data as Record<string,ReadonlyJson>;return {nameKey:'ext.c6fixture.decorated',params:{base:facts.baseName,rarity:String(d.rarity)}};},appearance(facts){const d=facts.data as Record<string,ReadonlyJson>;return {colorToken:d.rarity==='unique'?'item-unique':'item-rare',marker:''};}}
 };
}
export const completeDescriptor:ModuleDescriptor={...descriptor,worldSdk:1,rules:commandRules,create:createItemCompleteFixture,runConfiguration:{default:{presetId:'standard'},validate:(v:unknown):v is Json=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).join(',')==='presetId'&&(v as {presetId:unknown}).presetId==='standard',identity:()=>commandRules},locales:{zh_CN:{'ext.c6fixture.name':'中性物品测试','ext.c6fixture.shard':'测试碎片','ext.c6fixture.shardDescription':'用于中性命令验证。','ext.c6fixture.confirmUnique':'确定分解这件唯一物品吗？','ext.c6fixture.decorated':'{{base}}［{{rarity}}］'},en:{'ext.c6fixture.name':'Item fixture','ext.c6fixture.shard':'Shard','ext.c6fixture.shardDescription':'Fixture material.','ext.c6fixture.confirmUnique':'Salvage this unique item?','ext.c6fixture.decorated':'{{base}} [{{rarity}}]'}}};
/** Recorded journey fixture: one unique floor item and a four-slot natural kill drop. */
const journeyRules={...commandRules,fingerprint:extensionDataFingerprint({definitions:commandDefinitions,journey:1})};
export const journeyDescriptor:ModuleDescriptor={...completeDescriptor,rules:journeyRules,runConfiguration:{...completeDescriptor.runConfiguration!,identity:()=>journeyRules},create:()=>{
 const m=createItemCompleteFixture(),p=m.itemDrops!;
 return {...m,rules:journeyRules,itemDrops:{...p,roll(event,context){
  if(event.source==='kill')return {v:1,converted:true,items:[['dagger','weapon'],['leather_armor','armor'],['ring_of_regeneration','ring'],['ring_of_regeneration','ring']].map(([kind,category],index)=>{context.beginItem(index);return {kind:'native' as const,native:{kind:kind!,category:category as import('../../../itemSdk').ItemClass,enchantment:0,runicType:null,isCursed:false,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,known:false,power:context.randomInt(1,1)}}};}),gold:0,uniqueIds:[null,null,null,null]};
  const result=p.roll(event,context);if(event.source==='floor'&&stateOf(context.state).settled===0&&result.items.length){return {...result,items:result.items.map(i=>('native'in i?{...i,moduleData:{c6fixture:{...i.moduleData.c6fixture as Record<string,ReadonlyJson>,unique:true}}}:i)),uniqueIds:['c6fixture.one']};}return result;
 }}};
}};
