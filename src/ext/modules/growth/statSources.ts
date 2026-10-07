import { StatValidationError, decimalStatFraction, roundStatFraction } from '../../stats';
import type { StatKeyDeclaration, StatModifierRow, StatSourceProvider } from '../../stats';
import type { GrowthPack } from './attributes';
import { growthDerived, growthRuleActor, initialGrowthAttributes } from './attributes';
import { initialGrowthProgression } from './experience';
import type { GrowthProgression, GrowthAttributes } from './components';
import { collectModifiers } from './evaluator';
import type { GrowthRulePort } from './types';
import { growthSkillDefinition, growthSkillScopes, initialGrowthSkillBuild, type GrowthSkillBuild } from './skills';
import type { GrowthIdentityBuild } from './identities';
import type { GrowthState } from './state';
import { mapGrowthCombatCapacity } from './combatStats';
const PORTS:Partial<Record<GrowthRulePort,string>>={hitChance:'native.hit-chance',physicalDamage:'native.physical-damage-dealt',receivedPhysicalDamage:'native.physical-damage-taken',stealthRange:'native.stealth-range',searchStrength:'native.search-strength',focusCapacity:'growth.focus-capacity',focusRecoveryInterval:'growth.focus-recovery-interval',cooldownDuration:'growth.cooldown-duration',staminaCapacity:'combat.stamina-capacity',poiseCapacity:'combat.poise-capacity'};
function declaration(id:string,base:number,kind:StatKeyDeclaration['kind']='query'):StatKeyDeclaration{return {id,base,owner:'growth',unit:'integer',kind,minimum:0,maximum:1_000_000,rounding:id==='growth.cooldown-duration'?'ceil':'floor',categories:['override','flat','increased','more','clamp'],increased:{minimum:-9000,maximum:50000},moreSlots:[{id:'growth.slot.final',minimum:-10000,maximum:30000}]};}
export function createGrowthStatSources(pack:GrowthPack):StatSourceProvider {
 return {keys:[declaration('growth.focus-capacity',pack.config.focus.base,'materialized'),declaration('growth.focus-recovery-interval',pack.config.focus.recoveryInterval),declaration('growth.cooldown-duration',0),{...declaration('growth.xp-gain',0),maximum:Number.MAX_SAFE_INTEGER}],collect(actor,context){
  const state=context.state as unknown as GrowthState, progression=context.getComponent(actor.id,'progression') as unknown as GrowthProgression|undefined, attributes=context.getComponent(actor.id,'attributes') as unknown as GrowthAttributes|undefined;
  const enabled=!!progression&&!!attributes;
  const ruleActor=growthRuleActor(actor.id,progression??initialGrowthProgression(pack.config.levels),attributes??initialGrowthAttributes(pack));
  const identity=context.getComponent(actor.id,'identity') as unknown as GrowthIdentityBuild|undefined;
  const build=context.getComponent(actor.id,'skill-build') as unknown as GrowthSkillBuild|undefined;
  const scopes=growthSkillScopes(pack,build??initialGrowthSkillBuild(),state.objectiveClock??0,'actor',identity);
  const rows:StatModifierRow[]=[];
  if(enabled){const bonuses=growthDerived(pack,ruleActor,scopes),permanent=growthDerived(pack,ruleActor,[]);
   for(const [stat,value,base] of [['native.strength',bonuses.appliedStrength,permanent.appliedStrength],['native.max-hp',bonuses.appliedMaxHp,permanent.appliedMaxHp]] as const){
    if(base)rows.push({stat,value:base,category:'flat',layer:'character',sourceKind:'permanent-growth',sourceId:`growth.${stat}.permanent`,grantPolicy:'refill-delta'});
    if(value!==base)rows.push({stat,value:value-base,category:'flat',layer:'temporary',sourceKind:'growth-build',sourceId:`growth.${stat}.build`});
   }
  }
  for(const [port,stat] of [...Object.entries(PORTS),['hitChance','native.evasion']] as [GrowthRulePort,string][]){
   if(stat.startsWith('combat.')){const mapping=pack.config.combatStats;if(!mapping||!enabled||(actor.player&&!mapping.playerEnabled)||(!actor.player&&(!identity?.templateId||!mapping.allowedTemplateIds.includes(identity.templateId))))continue;}
   // Reading a capacity's L0 never queries another module's mutable state.
   let base:number;try{base=context.base(stat);}catch(error){if(stat.startsWith('combat.')&&error instanceof StatValidationError&&error.reason==='declaration')continue;throw error;}
   const owner=port==='receivedPhysicalDamage'||stat==='native.evasion'?'target':'actor',rule=pack.config.rules.ports[port],budget=pack.config.rules.budgets.find(b=>b.id===rule.budgetId)!;
   const input={actor:owner==='actor'?ruleActor:{...ruleActor,id:-1},target:owner==='target'?ruleActor:null,baseValue:base,actionId:0,resolutionId:0,tags:context.facts.skillId?growthSkillDefinition(pack,context.facts.skillId)?.tags??[]:[],attackKind:context.facts.attackKind,adjacent:context.facts.adjacent,direct:context.facts.direct,mode:context.facts.mode,rollMode:context.facts.probabilityRoll===false?'skip-guaranteed-hit' as const:'roll-probability' as const,inactiveAttributeActorIds:enabled?[]:[ruleActor.id]};
   const modifiers=collectModifiers(pack,input,scopes.map(s=>({...s,owner})),[{port,owner}],{});
   if(rule.preserveZero&&base===0)continue;
   if(port==='stealthRange'&&actor.statuses.includes('invisible'))continue;
   if(stat.startsWith('combat.')&&enabled){const resource=port==='staminaCapacity'?'stamina':'poise',map=pack.config.combatStats![resource];const mapped=mapGrowthCombatCapacity(base,attributes!.values[map.attributeId]!,map);if(mapped!==base)rows.push({stat,category:'flat',value:mapped-base,layer:'character',sourceKind:'capacity-map',sourceId:`growth.${resource}`});}
   modifiers.forEach((m,index)=>rows.push({stat,category:m.operation==='multiply'?'more':rule.additiveMode==='flat'?'flat':'increased',value:m.operation==='multiply'?roundStatFraction((()=>{const f=decimalStatFraction(m.magnitude);let n=(f.numerator-f.denominator)*10000n;const limit=BigInt(Number.MAX_SAFE_INTEGER)*f.denominator;if(n>limit)n=limit;if(n< -limit)n= -limit;return {numerator:n,denominator:f.denominator};})(),'nearest-half-away'):m.magnitude,layer:'temporary',sourceKind:'growth-modifier',sourceId:`growth.${port.toLowerCase()}.${index}`,...(m.operation==='multiply'?{slot:m.slot!,legacyFactor:String(m.magnitude)}:{budget:{minimum:budget.min,maximum:budget.max}})}));
   if(modifiers.length||enabled){let min=Math.ceil(rule.globalClamp.min),max=Math.min(1_000_000,Math.floor(rule.globalClamp.max));if(base>0&&rule.minimumPositive!==null)min=Math.max(min,rule.minimumPositive);if(port==='focusCapacity'){min=Math.max(min,pack.config.focus.min);max=Math.min(max,pack.config.focus.cap);}if(stat.startsWith('combat.')){const map=pack.config.combatStats![port==='staminaCapacity'?'stamina':'poise'];min=Math.max(min,map.min);max=Math.min(max,map.max);}if(rule.minimumBaseRatio!==null&&base>0)min=Math.max(min,roundStatFraction((()=>{const f=decimalStatFraction(rule.minimumBaseRatio!);return {numerator:BigInt(base)*f.numerator,denominator:f.denominator};})(),'ceil'));rows.push({stat,category:'clamp',value:min,maximum:max,layer:'character',sourceKind:'growth-rule',sourceId:`growth.${port.toLowerCase()}.bounds`});}
  }
  return rows;
 }};
}
