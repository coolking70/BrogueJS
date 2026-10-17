/** Explicit foundation test adapters for optional content contracts. They are
 * never catalog-discovered. Actual installed packs are always used when present.
 * The resident recipe optional service reserves crafting ownership; that adapter
 * uses fixture version 0.0.1/rules, never the deleted pack's manifest identity. */
import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../ext/descriptor';
import { extensionDataFingerprint } from '../../ext/fingerprint';
import type { WorldDefinitionPack } from '../../ext/worldSdk';
import type { ExtensionModule, Json } from '../../ext/types';
import { descriptor as forageBase } from '../../ext/testing/fixtures/forageFixture';
import { getInstalledModuleDescriptors } from '../../ext/catalog';
import { createWorldHarness } from '../../ext/testing/worldHarness';
import type { WorldHarnessOptions } from '../../ext/worldSdk';
import { prepare } from '../../ext/testing/fixtures/craftingSkeleton';

const item = (id: string, category: 'material' | 'kit') => ({owner:'crafting',id:'crafting.foundation-'+id,
 nameKey:'ext.crafting.foundation.'+id+'.name',descriptionKey:'ext.crafting.foundation.'+id+'.description',
 category,glyph:'*',color:'#bbbbbb',maxStack:99,nativeTemplate:null,tags:[],tool:null});
const pack: WorldDefinitionPack = {schema:1,worldSdk:2,
 items:[item('wood','material'),item('stone','material'),item('kit-chest','kit'),item('kit-table','kit')],resourceNodes:[],
 stations:[{owner:'crafting',id:'crafting.foundation-table',nameKey:'ext.crafting.foundation.table.name',descriptionKey:'ext.crafting.foundation.table.description',
 glyph:'T',color:'#bb9966',interactionDistance:1,stationTags:['station.table'],placementCost:[{itemDefinitionId:'crafting.foundation-wood',count:4},{itemDefinitionId:'crafting.foundation-stone',count:2}],
 placementTicks:300,workPositionPolicy:'adjacent-passable',kitDefinitionId:'crafting.foundation-kit-table'}],
 recipes:[{owner:'crafting',id:'crafting.foundation-make-chest-kit',nameKey:'ext.crafting.foundation.recipe.name',descriptionKey:'ext.crafting.foundation.recipe.description',
 inputs:[{itemDefinitionId:'crafting.foundation-wood',count:6}],outputs:[{itemDefinitionId:'crafting.foundation-kit-chest',count:1}],stationTags:['station.table'],toolTag:null,workTicks:500,offlineEligible:true}],
 startupItems:{instanceKey:'foundation-craft.startup',items:[{itemDefinitionId:'crafting.foundation-wood',count:6},{itemDefinitionId:'crafting.foundation-stone',count:4}],overflow:'floor-then-skip'}};
const rules={schema:1,version:'0.0.1',fingerprint:extensionDataFingerprint({fixture:'foundation-resident-physical-batches',pack})};
function validCounter(v:unknown):v is Json {
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='history,totals')return false;
 const s=v as {totals:unknown;history:unknown};
 if(!Array.isArray(s.history)||s.history.length>128)return false;
 if(!s.totals||typeof s.totals!=='object'||Array.isArray(s.totals)||Object.keys(s.totals).join(',')!=='craftBatches')return false;
 const count=(s.totals as {craftBatches:unknown}).craftBatches;
 return Number.isSafeInteger(count)&&Number(count)>=0;
}
const craft: ModuleDescriptor={id:'crafting',version:'0.0.1',foundation:FOUNDATION_PROTOCOL,worldSdk:2,rules,labelKey:'ext.crafting.foundation.label',
 locales:{zh_CN:Object.fromEntries([['ext.crafting.foundation.label','底座制作合同样本'],...[...pack.items,...pack.stations,...pack.recipes].flatMap(d=>[[d.nameKey,'底座合同样本 '+d.id],[d.descriptionKey,'独立测试声明。']])])},
 create:():ExtensionModule=>({id:'crafting',version:'0.0.1',rules,worldDefinitions:pack,
 initialState:()=>({totals:{craftBatches:0},history:[]}),validateState:validCounter,
 worldWorkCommands:{'place-station':{prepare:(p,sdk)=>prepare('place-station',p,sdk)}},
 optionalQueries:{'crafting.recipe-catalog.v1':{accepts:p=>!!p&&typeof p==='object'&&!Array.isArray(p)&&!Object.keys(p).length,
 validate:(v):v is Json=>JSON.stringify(v)===JSON.stringify({schema:1,recipes:pack.recipes}),query:()=>({schema:1,recipes:pack.recipes}) as unknown as Json}},
 worldWorkParticipant:{onCommitted(f,tx){
  const previous=tx.state as {totals:{craftBatches:number};history:Json[]};
  tx.replaceState({totals:{craftBatches:previous.totals.craftBatches+Number(f.operation==='craft-batch')},history:[...previous.history,f as unknown as Json].slice(-128)});
 }}})};
function needs(): ModuleDescriptor {
 const definitions=structuredClone(forageBase.create().worldDefinitions!);
 definitions.actorNeeds=[{owner:'fgfixture',id:'fgfixture.satiety',role:'satiety',max:2150,initial:1800,ticksPerPoint:200,
 bands:[{id:'fed',atOrBelow:2150},{id:'hungry',atOrBelow:300},{id:'weak',atOrBelow:150},{id:'starving',atOrBelow:0}],zeroDeadlineTicks:30000,departure:{visibleGraceTicks:2000}}];
 const identity={schema:1,version:'1.0.0',fingerprint:extensionDataFingerprint({fixture:'foundation-retirement-contract',definitions})};
 return {...forageBase,rules:identity,create:()=>{
  const m=forageBase.create(),qualifies=m.actorNeedParticipant!.qualifies;
  const participant:NonNullable<ExtensionModule['actorNeedParticipant']>={...m.actorNeedParticipant!,qualifies:(id,facts,context)=>{
   if(!qualifies(id,facts,context))return false;
   const result=context.queryOptional('settlement.resident-status.v1',{actorId:facts.actorId});
   return !(result.status==='available'&&(result.value as {resident?:boolean})?.resident===true);
  }};
  return {...m,rules:identity,worldDefinitions:definitions,commands:{},actorNeedParticipant:participant};
 }};
}
export function foundationNeedOwner(): string {return getInstalledModuleDescriptors().some(d=>d.id==='foraging')?'foraging':'fgfixture';}
export function foundationContractHarness(options:WorldHarnessOptions,configurations:Readonly<Record<string,Json>>) {
 const installed=getInstalledModuleDescriptors(),descriptors:ModuleDescriptor[]=[];
 const modules=options.modules.map(id=>id==='foraging'&&!installed.some(d=>d.id===id)?'fgfixture':id);
 if(options.modules.includes('foraging')&&!installed.some(d=>d.id==='foraging'))descriptors.push(needs());
 if(options.modules.includes('crafting')&&!installed.some(d=>d.id==='crafting'))descriptors.push(craft);
 for(const [id,configuration] of Object.entries(configurations)){
  const d=installed.find(d=>d.id===id);
  if(!modules.includes(id)||!d?.runConfiguration?.validate(configuration))throw new Error('Invalid foundation fixture configuration');
  descriptors.push({...d,rules:d.runConfiguration.identity(configuration),runConfiguration:{...d.runConfiguration,default:structuredClone(configuration)}});
 }
 return createWorldHarness({...options,modules},descriptors);
}

export function foundationCraftId(id:string):string {return getInstalledModuleDescriptors().some(d=>d.id==='crafting')?id:id.replace('crafting.','crafting.foundation-');}
