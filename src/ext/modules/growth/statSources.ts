import { immutableJson } from '../../json';
import type { Json } from '../../types';
import { StatValidationError, decimalStatFraction, roundStatFraction } from '../../stats';
import type { StatKeyDeclaration, StatModifierRow, StatSourceProvider } from '../../stats';
import type { GrowthPack } from './attributes';
import { growthDerived, growthRuleActor, initialGrowthAttributes } from './attributes';
import { initialGrowthProgression } from './experience';
import type { GrowthProgression, GrowthAttributes } from './components';
import { collectModifiers } from './evaluator';
import type { GrowthRulePort } from './types';
import { growthSkillDefinition, growthSkillScopes, initialGrowthSkillBuild, type GrowthSkillBuild } from './skills';
import { growthIdentityDefinitions, type GrowthIdentityBuild } from './identities';
import type { GrowthState } from './state';
import { mapGrowthCombatCapacity } from './combatStats';
const PORTS:Partial<Record<GrowthRulePort,string>>={hitChance:'native.hit-chance',physicalDamage:'native.physical-damage-dealt',receivedPhysicalDamage:'native.physical-damage-taken',stealthRange:'native.stealth-range',searchStrength:'native.search-strength',focusCapacity:'growth.focus-capacity',focusRecoveryInterval:'growth.focus-recovery-interval',cooldownDuration:'growth.cooldown-duration',staminaCapacity:'combat.stamina-capacity',poiseCapacity:'combat.poise-capacity'};
function declaration(id:string,base:number,kind:StatKeyDeclaration['kind']='query'):StatKeyDeclaration{return {id,base,owner:'growth',unit:'integer',kind,minimum:0,maximum:1_000_000,rounding:id==='growth.cooldown-duration'?'ceil':'floor',categories:['override','flat','increased','more','clamp'],increased:{minimum:-9000,maximum:50000},moreSlots:[{id:'growth.slot.final',minimum:-10000,maximum:30000}]};}
export const growthAttributeStat = (id:string):string => `growth.attribute:${id}`;
export function createGrowthStatSources(pack:GrowthPack):StatSourceProvider {
 // This module owns the collector and its complete dependencies. Cache by the
 // actual active scopes, attributes, facts and L0 inputs, not a revision hint.
 const derivedRows=new Map<string,readonly StatModifierRow[]>();
 const frozenTree=(value:unknown):boolean=>!value||typeof value!=='object'||Object.isFrozen(value)&&Reflect.ownKeys(value).every(key=>{
  const d=Object.getOwnPropertyDescriptor(value,key)!;return 'value' in d&&frozenTree(d.value);
 });
 const reusable=frozenTree(pack);
 return {gainReceipts:[{component:'progression',field:'experience',stat:'growth.xp-gain'}],keys:[declaration('growth.focus-capacity',pack.config.focus.base,'materialized'),declaration('growth.focus-recovery-interval',pack.config.focus.recoveryInterval),declaration('growth.cooldown-duration',0),{...declaration('growth.xp-gain',0),maximum:Number.MAX_SAFE_INTEGER},...pack.config.attributes.map(a=>({...declaration(growthAttributeStat(a.id),0),attributeId:a.id,unit:'rank',maximum:a.id===pack.config.strengthTraining.attributeId?Math.min(a.cap,pack.config.strengthTraining.cap):a.cap,categories:['flat','clamp'] as const,moreSlots:[]}))],
 collect(actor,context){
  const attributes=context.getComponent(actor.id,'attributes') as unknown as GrowthAttributes|undefined;
  if(!attributes||!context.getComponent(actor.id,'progression'))return [];
  const identity=context.getComponent(actor.id,'identity') as unknown as GrowthIdentityBuild|undefined;
  return pack.config.attributes.flatMap(a=>{
   const stat=growthAttributeStat(a.id),rows:StatModifierRow[]=[];
   const add=(value:number,sourceKind:string,sourceId:string)=>{if(value)rows.push({stat,value,category:'flat',layer:'character',sourceKind,sourceId});};
   add(attributes.allocated[a.id]!, 'allocated-attribute', `${a.id}.allocated`);
   let remaining=attributes.values[a.id]!-attributes.allocated[a.id]!;
   if(!identity?.templateId){
    for(const definition of growthIdentityDefinitions(pack,identity)){
     const amount=definition.attributes.filter(g=>g.attributeId===a.id).reduce((n,g)=>n+g.amount,0)+(identity?.choices.filter(c=>c.identityId===definition.id).reduce((n,c)=>n+(c.attributes[a.id]??0),0)??0);
     // Copied/template builds retain their exact total without regranting identities.
     const used=Math.min(remaining,amount);add(used,'identity-attribute',`${definition.id}.${a.id}`);remaining-=used;
    }
   }
   add(remaining,'initial-attribute',`${identity?.templateId??'growth.initial'}.${a.id}`);
   return rows;
  });
 },derived:{inputs:pack.config.attributes.map(a=>growthAttributeStat(a.id)),outputs:[...new Set([...Object.values(PORTS).filter(id=>!id.startsWith('combat.')),'native.evasion','native.strength','native.max-hp'])],optionalOutputs:['combat.stamina-capacity','combat.poise-capacity'],collect(actor,context){
  const state=context.state as unknown as GrowthState, progression=context.getComponent(actor.id,'progression') as unknown as GrowthProgression|undefined, attributes=context.getComponent(actor.id,'attributes') as unknown as GrowthAttributes|undefined;
  const enabled=!!progression&&!!attributes;
  let ruleActor=growthRuleActor(actor.id,progression??initialGrowthProgression(pack.config.levels),attributes??initialGrowthAttributes(pack));
  const permanentActor={...ruleActor,attributes:{...ruleActor.attributes}};
  if(enabled)ruleActor={...ruleActor,attributes:Object.fromEntries(pack.config.attributes.map(a=>[a.id,context.input(growthAttributeStat(a.id))]))};
  const identity=context.getComponent(actor.id,'identity') as unknown as GrowthIdentityBuild|undefined;
  const build=context.getComponent(actor.id,'skill-build') as unknown as GrowthSkillBuild|undefined;
  const scopes=growthSkillScopes(pack,build??initialGrowthSkillBuild(),state.objectiveClock??0,'actor',identity);
  const bases=new Map<string,number>();
  for(const stat of [...Object.values(PORTS),'native.evasion']){
   if(stat.startsWith('combat.')){const mapping=pack.config.combatStats;if(!mapping||!enabled||((actor.player||actor.tags.includes('party.member'))&&!mapping.playerEnabled)||(!actor.player&&!actor.tags.includes('party.member')&&(!identity?.templateId||!mapping.allowedTemplateIds.includes(identity.templateId))))continue;}
   try{bases.set(stat,context.base(stat));}catch(error){if(stat.startsWith('combat.')&&error instanceof StatValidationError&&error.reason==='declaration')continue;throw error;}
  }
  const stamp=JSON.stringify([enabled,ruleActor,permanentActor,scopes,actor.player,actor.statuses.includes('invisible'),identity?.templateId,context.facts,[...bases]]);
  const prior=reusable?derivedRows.get(stamp):undefined;if(prior)return prior;
  const rows:StatModifierRow[]=[];
  if(enabled){const bonuses=growthDerived(pack,ruleActor,scopes),permanent=growthDerived(pack,permanentActor,[]);
   for(const [stat,value,base] of [['native.strength',bonuses.appliedStrength,permanent.appliedStrength],['native.max-hp',bonuses.appliedMaxHp,permanent.appliedMaxHp]] as const){
    if(base)rows.push({stat,value:base,category:'flat',layer:'character',sourceKind:'permanent-growth',sourceId:`growth.${stat}.permanent`,grantPolicy:'refill-delta'});
    if(value!==base)rows.push({stat,value:value-base,category:'flat',layer:'temporary',sourceKind:'growth-build',sourceId:`growth.${stat}.build`});
   }
  }
  for(const [port,stat] of [...Object.entries(PORTS),['hitChance','native.evasion']] as [GrowthRulePort,string][]){
   if(stat.startsWith('combat.')){const mapping=pack.config.combatStats;if(!mapping||!enabled||((actor.player||actor.tags.includes('party.member'))&&!mapping.playerEnabled)||(!actor.player&&!actor.tags.includes('party.member')&&(!identity?.templateId||!mapping.allowedTemplateIds.includes(identity.templateId))))continue;}
   // Reading a capacity's L0 never queries another module's mutable state.
   const base=bases.get(stat);if(base===undefined)continue;
   const owner=port==='receivedPhysicalDamage'||stat==='native.evasion'?'target':'actor',rule=pack.config.rules.ports[port],budget=pack.config.rules.budgets.find(b=>b.id===rule.budgetId)!;
   const input={actor:owner==='actor'?ruleActor:{...ruleActor,id:-1},target:owner==='target'?ruleActor:null,baseValue:base,actionId:0,resolutionId:0,tags:context.facts.skillId?growthSkillDefinition(pack,context.facts.skillId)?.tags??[]:[],attackKind:context.facts.attackKind,adjacent:context.facts.adjacent,direct:context.facts.direct,mode:context.facts.mode,rollMode:context.facts.probabilityRoll===false?'skip-guaranteed-hit' as const:'roll-probability' as const,inactiveAttributeActorIds:enabled?[]:[ruleActor.id]};
   const modifiers=collectModifiers(pack,input,scopes.map(s=>({...s,owner})),[{port,owner}],{},true);
   if(rule.preserveZero&&base===0)continue;
   if(port==='stealthRange'&&actor.statuses.includes('invisible'))continue;
   if(stat.startsWith('combat.')&&enabled){const resource=port==='staminaCapacity'?'stamina':'poise',map=pack.config.combatStats![resource];const mapped=mapGrowthCombatCapacity(base,ruleActor.attributes[map.attributeId]!,map);if(mapped!==base)rows.push({stat,category:'flat',value:mapped-base,layer:'character',sourceKind:'capacity-map',sourceId:`growth.${resource}`});}
   modifiers.forEach((m)=>rows.push({stat,category:m.operation==='multiply'?'more':rule.additiveMode==='flat'?'flat':'increased',value:m.operation==='multiply'?roundStatFraction((()=>{const f=decimalStatFraction(m.magnitude);let n=(f.numerator-f.denominator)*10000n;const limit=BigInt(Number.MAX_SAFE_INTEGER)*f.denominator;if(n>limit)n=limit;if(n< -limit)n= -limit;return {numerator:n,denominator:f.denominator};})(),'nearest-half-away'):m.magnitude,layer:'temporary',sourceKind:'growth-modifier',sourceId:m.sourceId!,...(m.operation==='multiply'?{slot:m.slot!,legacyFactor:String(m.magnitude)}:{budget:{minimum:budget.min,maximum:budget.max}})}));
   if(modifiers.length||enabled){let min=Math.ceil(rule.globalClamp.min),max=Math.min(1_000_000,Math.floor(rule.globalClamp.max));if(base>0&&rule.minimumPositive!==null)min=Math.max(min,rule.minimumPositive);if(port==='focusCapacity'){min=Math.max(min,pack.config.focus.min);max=Math.min(max,pack.config.focus.cap);}if(stat.startsWith('combat.')){const map=pack.config.combatStats![port==='staminaCapacity'?'stamina':'poise'];min=Math.max(min,map.min);max=Math.min(max,map.max);}if(rule.minimumBaseRatio!==null&&base>0)min=Math.max(min,roundStatFraction((()=>{const f=decimalStatFraction(rule.minimumBaseRatio!);return {numerator:BigInt(base)*f.numerator,denominator:f.denominator};})(),'ceil'));rows.push({stat,category:'clamp',value:min,maximum:max,layer:'character',sourceKind:'growth-rule',sourceId:`growth.${port.toLowerCase()}.bounds`});}
  }
  const frozen=immutableJson(rows as unknown as Json) as unknown as readonly StatModifierRow[];
  if(reusable)derivedRows.set(stamp,frozen);if(derivedRows.size>1024)derivedRows.delete(derivedRows.keys().next().value!);
  return frozen;
 }}};
}
