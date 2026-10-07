import { footprintOf } from '../Movement/CreatureSpatial';
/** Native formula nodes and the only production reader of raw ring bonuses. */
import type { Creature } from '../../entities/Creature';
import type { Item } from '../Items/Item';
import type { EquipChange, PairFacts, StatActorFacts, StatQuery, StatRational } from '../../ext/stats';
import { StatValidationError } from '../../ext/stats';
import { NATIVE_STAT_DAG, NATIVE_STAT_KEYS } from './NativeStatKeys';
import { StatPipeline, safeStatRational, type OwnedStatRow } from './StatPipeline';
import { effectiveRingEnchant, ringBonus, turnsForFullRegenInThousandths } from '../Items/RingBonuses';
import { netEnchant, strengthModifier, accuracyFraction, enchantedDamage, monsterAccuracyAdjusted, monsterDefenseAdjusted, monsterDamageAdjustmentAmount, damageFraction, hitProbability } from '../Combat/CombatFormulas';
import { MONSTER_CLASS_MEMBERS } from '../Combat/MonsterClass';
import { armorStealthAdjustment, ringAwarenessBonus, ringStealthAdjustment } from '../Items/ItemEffectFormulas';
import { bindItemStatInvalidation, unbindItemStatInvalidation } from '../Items/ItemStatInvalidation';
type EquippedActor = Creature & { strength?: number; inventory?: {items: Item[]}; equippedWeapon?: Item|null; equippedArmor?: Item|null; ringLeft?: Item|null; ringRight?: Item|null; accuracy?: number; defense?: number; damageString?: string; regenTurns?: number; typeId?: string; isAlly?: boolean; isCaged?: boolean };
interface NativeEnvironment { darkness(): boolean; shadow(): boolean; rested(): boolean }
const environments = new WeakMap<Creature, NativeEnvironment>();
const bindings = new WeakMap<Creature, { pipeline: StatPipeline; dirty(): void; bonus(key:string):number; atomic<T>(work:()=>T):T }>();
const revisions = new WeakMap<Creature, number>();
const itemProposals=new WeakMap<Creature,ReadonlyMap<number,Partial<Item>>>();
function speedDelta(a:Creature,attack:boolean):number{const base=(a as unknown as Record<string,number>)[attack?'infoAttackSpeed':'infoMovementSpeed']??(attack?a.attackSpeed:a.movementSpeed);return a.hasStatus('haste')||a.hasStatus('hasted')?Math.floor(base/2)-base:a.hasStatus('slowed')?base:0;}
export function configureNativeStats(actor:Creature, environment:NativeEnvironment):void { environments.set(actor,environment); markStatsDirty(actor); }
export function bindStats(actor:Creature, pipeline:StatPipeline, dirty:()=>void, bonus:(key:string)=>number,atomic:<T>(work:()=>T)=>T):void { bindings.set(actor,{pipeline,dirty,bonus,atomic});const inventory=(actor as EquippedActor).inventory;if(inventory)bindItemStatInvalidation(inventory,()=>markStatsDirty(actor)); }
export function atomicStats<T>(actor:Creature,work:()=>T):T { return bindings.get(actor)?.atomic(work)??work(); }
export function unbindStats(actor:Creature):void { bindings.delete(actor);const inventory=(actor as EquippedActor).inventory;if(inventory){unbindItemStatInvalidation(inventory);for(const item of inventory.items)unbindItemStatInvalidation(item);} }
export function markStatsDirty(actor:Creature):void { revisions.set(actor,(revisions.get(actor)??0)+1); bindings.get(actor)?.dirty(); }
export function nativeStatRevision(actor:Creature):number { return revisions.get(actor)??0; }
/** Ingredients of every native formula/DAG node, excluding current resources.
 * Admission memoization remains valid across HP/clock-only writes. */
export function nativeStatSignature(actor:Creature):string {
  const a=actor as EquippedActor;
  const scalar=(value:unknown)=>[typeof value,String(value)],env=environments.get(actor);
  return JSON.stringify([a.typeId,!!a.inventory,
    [a.maxHp,a.strength,a.weaknessAmount,a.accuracy,a.defense,a.damageString,a.regenTurns,a.attackSpeed,a.movementSpeed,
      a.getStatusDuration('donning'),a.getStatusDuration('aggravating')].map(scalar),
    a.hasStatus('regenerating'),a.hasStatus('invisible'),env?.darkness(),env?.shadow(),env?.rested(),
    nativeEquippedItems(actor).map(i=>[i.id,i.category,i.identityId,i.enchantment,i.strengthRequired,i.damage,i.armor,i.identified,i.timesEnchanted].map(scalar))]);
}
export function nativeStatFacts(actor:Creature,playerId:number):StatActorFacts {
  const a=actor as EquippedActor, player=actor.id===playerId, allied=player||a.isAlly===true;
  const bodyTags=[footprintOf(actor).length>1?'body.large':'body.single',...(actor.spatial?.bodyMember?['body.composite',actor.spatial.bodyMember.groupId===actor.id?'body.core':'body.member']:[])];
  return Object.freeze({id:actor.id,name:actor.name,hp:actor.hp,maxHp:actor.maxHp,x:actor.loc.x,y:actor.loc.y,player,allied,hostile:!allied&&!a.isCaged,monsterId:a.typeId??null,statuses:Object.freeze(Object.keys(actor.statusDurations).filter(s=>actor.hasStatus(s as Parameters<Creature['hasStatus']>[0]))),tags:Object.freeze([...bodyTags,...Object.entries(MONSTER_CLASS_MEMBERS).filter(([,members])=>members.includes(a.typeId??'')).map(([key])=>key)])});
}
export function nativeEquippedItems(actor:Creature,change?:EquipChange):readonly Item[] {
  const a=actor as EquippedActor, slots=[a.equippedWeapon,a.equippedArmor,a.ringLeft,a.ringRight].filter((i):i is Item=>!!i&&(!bindings.has(actor)||a.inventory?.items.includes(i)===true));
  if(bindings.has(actor))for(const item of slots)bindItemStatInvalidation(item,()=>markStatsDirty(actor));
  if(!change)return slots.map(item=>projectItem(actor,item));
  const remove=new Set(Array.isArray(change.unequip)?change.unequip:change.unequip?[change.unequip]:[]);
  let items=slots.filter(i=>!remove.has(i.id));
  if(change.equip!==undefined){ const item=a.inventory?.items.find(i=>i.id===change.equip);if(!item)throw new StatValidationError('source');
    if(item.category===8){if(!items.some(i=>i.id===item.id)&&items.filter(i=>i.category===8).length>=2)throw new StatValidationError('source');}
    else items=items.filter(i=>i.category!==item.category);
    if(!items.some(i=>i.id===item.id))items.push(item);
  }
  return items.map(item=>projectItem(actor,item));
}
function projectItem(actor:Creature,item:Item):Item {
  const proposal=itemProposals.get(actor)?.get(item.id);
  return proposal?Object.assign(Object.create(Object.getPrototypeOf(item)),item,proposal) as Item:item;
}
/** Engine UI projection of a mechanical enchantment proposal; no live Item writes. */
export function hypotheticalItemFields(actor:Creature,itemId:number,fields:Readonly<Pick<Item,'enchantment'|'strengthRequired'>>,knownOnly:boolean):Readonly<Record<string,number>> {
  if(!Number.isSafeInteger(fields.enchantment!*4)||!Number.isSafeInteger(fields.strengthRequired)||fields.strengthRequired!<0)throw new StatValidationError('source');
  const previous=itemProposals.get(actor);itemProposals.set(actor,new Map([[itemId,{...fields}]]));
  try{return statQuery(actor).hypothetical(actor.id,{equip:itemId},knownOnly);}finally{if(previous)itemProposals.set(actor,previous);else itemProposals.delete(actor);}
}
function damageRange(a:EquippedActor,weapon?:Item){ const text=weapon?.damage??a.damageString??'1d2', dice=/^(\d+)d(\d+)(?:\+(\d+))?$/.exec(text), range=/^(\d+)-(\d+)$/.exec(text);
  return dice?{min:Number(dice[1])+Number(dice[3]??0),max:Number(dice[1])*Number(dice[2])+Number(dice[3]??0)}:range?{min:Number(range[1]),max:Number(range[2])}:{min:Number.isNaN(parseInt(text,10))?1:parseInt(text,10),max:Number.isNaN(parseInt(text,10))?1:parseInt(text,10)}; }
export function nativeBase(actor:Creature,key:string,dep:(key:string)=>number,facts:PairFacts={},change?:EquipChange,knownOnly=false,bonus:(key:string)=>number=()=>0):number|StatRational {
  const a=actor as EquippedActor, items=nativeEquippedItems(actor,change),weapon=items.find(i=>i.category===0),armor=items.find(i=>i.category===1),rings=items.filter(i=>i.category===8);
  const enchant=(i:Item|undefined)=>i?(knownOnly&&!i.isIdentified?0:i.enchantment):0;
  const ring=(id:string)=>ringBonus(rings.filter(i=>!knownOnly||i.isIdentified),`ring_of_${id}`);
  switch(key){
    case 'native.strength':return a.strength===undefined?12:a.strength-bonus(key);
    case 'native.max-hp':return a.maxHp-bonus(key);
    case 'native.effective-strength':return dep('native.strength');
    case 'native.weapon-enchant':return facts.projectileEnchant??enchant(weapon)*4;
    case 'native.armor-enchant':return enchant(armor)*4;
    case 'native.accuracy':return a.inventory?(weapon||facts.projectileEnchant!==undefined?Math.trunc(100*accuracyFraction(dep('native.weapon-enchant')/4)):monsterAccuracyAdjusted(100,a.weaknessAmount)):monsterAccuracyAdjusted(a.accuracy??100,a.weaknessAmount);
    case 'native.defense':return a.inventory?(armor?.armor?Math.max(0,Math.trunc((armor.armor+dep('native.armor-enchant')/4-a.getStatusDuration('donning'))*10)):0):monsterDefenseAdjusted(a.defense??0,a.weaknessAmount);
    case 'native.damage-min':case 'native.damage-max':{const d=damageRange(a,weapon),v=facts.baseValue??(key.endsWith('min')?d.min:d.max);if(facts.projectileEnchant!==undefined)return enchantedDamage(v,dep('native.weapon-enchant')/4);return weapon?Math.max(1,enchantedDamage(v,dep('native.weapon-enchant')/4)):v;}
    case 'native.hit-chance':case 'native.physical-damage-dealt':case 'native.physical-damage-taken':return facts.baseValue??0;
    case 'native.evasion':return 0;
    case 'native.runic-power':return dep('native.weapon-enchant');
    case 'native.armor-runic-power':return dep('native.armor-enchant');
    case 'native.attack-speed':return a.attackSpeed-speedDelta(a,true);
    case 'native.move-speed':{if(!Number.isSafeInteger(a.movementSpeed)||a.movementSpeed<=0)throw new RangeError('Movement speed must be positive');return a.movementSpeed-speedDelta(a,false);}
    case 'native.awareness':return 0;
    case 'native.search-strength':return facts.baseValue??0;
    case 'native.clairvoyance':return 0;
    case 'native.light':return 1;
    case 'native.reaping':return 0;
    case 'native.transference':return 0;
    case 'native.wisdom':return 0;
    case 'native.regeneration-bonus':return ring('regeneration');
    case 'native.stealth-range':{if(facts.baseValue!==undefined)return facts.baseValue;if(a.hasStatus('invisible'))return 1;let r=14;const env=environments.get(actor);if(env?.darkness())r=Math.floor(r/2);if(env?.shadow())r=Math.floor(r/2);if(armor)r+=armorStealthAdjustment(armor.strengthRequired??0);if(env?.rested())r=Math.ceil(r/2);r+=a.getStatusDuration('aggravating')+ringStealthAdjustment(ring('stealth'));return Math.max(env?.rested()?1:2,r);}
    case 'native.regeneration':{
      if(!a.inventory){const interval=a.regenTurns??0;if(interval<=0)return {numerator:0,denominator:1};
        if(a.typeId==='player_clone')for(const scale of [300,180]){const hp=Math.round(scale/interval);if(hp>0&&Math.abs(scale/hp-interval)<=Number.EPSILON*Math.max(1,interval)*4)return safeStatRational({numerator:BigInt(hp),denominator:BigInt(scale)});}
        const [digits,exponent='0']=String(interval).split('e'),parts=digits!.split('.'),places=parts[1]?.length??0;
        let n=BigInt(parts.join('')),d=10n**BigInt(places),e=Number(exponent);if(e>0)n*=10n**BigInt(e);else if(e<0)d*=10n**BigInt(-e);
        return safeStatRational({numerator:d,denominator:n});} 
      const full=BigInt(turnsForFullRegenInThousandths(dep('native.regeneration-bonus'))),whole=full/1000n,hp=BigInt(a.maxHp),per=whole>0n?(hp-1n)/whole:0n,left=hp-per*whole,interval=full/left;
      let d=interval>0n?interval:1n,n=per*d+(interval>0n?1000n:0n);
      if(a.hasStatus('regenerating')){n*=5n;d*=3n;}return safeStatRational({numerator:n,denominator:d});
    }
    default:if(key.startsWith('native.resist.'))return 0;throw new StatValidationError('declaration');
  }
}
export function nativeRows(actor:Creature,change?:EquipChange,knownOnly=false):readonly OwnedStatRow[]{
 const a=actor as EquippedActor,rows:OwnedStatRow[]=[{owner:'native',stat:'native.stealth-range',category:'clamp',value:a.hasStatus('invisible')||environments.get(actor)?.rested()?1:2,maximum:1_000_000,layer:'intrinsic',sourceKind:'native-state',sourceId:'native.stealth-minimum'}];
 const row=(stat:string,value:number,sourceId:string,layer:'intrinsic'|'temporary'='intrinsic'):void=>{rows.push({owner:'native',stat,category:'flat',value,layer,sourceKind:layer==='temporary'?'native-status':'native-ring',sourceId});};
 for(const [key,attack] of [['native.attack-speed',true],['native.move-speed',false]] as const){const delta=speedDelta(a,attack);if(delta)row(key,delta,attack?'native.status.attack-speed':'native.status.move-speed','temporary');}
 if(a.weaknessAmount)row('native.effective-strength',-a.weaknessAmount,'native.weakened','temporary');
 const rings=nativeEquippedItems(actor,change).filter(i=>i.category===8&&(!knownOnly||i.isIdentified));
 for(const ring of rings)for(const name of ['clairvoyance','light','reaping','transference','wisdom','awareness'])if(ring.identityId===`ring_of_${name}`)row(`native.${name}`,name==='awareness'?ringAwarenessBonus(effectiveRingEnchant(ring)):effectiveRingEnchant(ring),`native.item.${ring.id}`);
 if(1+ringBonus(rings,'ring_of_light')<=0)row('native.light',-1,'native.light-zero');
 return rows;
}
export function nativeNodeRows(actor:Creature,key:string,dep:(key:string)=>number,_facts:PairFacts={},change?:EquipChange,knownOnly=false):readonly OwnedStatRow[]{
 if(key!=='native.weapon-enchant'&&key!=='native.armor-enchant')return [];
 const item=key==='native.weapon-enchant'&&_facts.projectileEnchant!==undefined?{enchantment:_facts.projectileEnchant/4,strengthRequired:_facts.projectileStrength??0,isIdentified:true,id:0}:nativeEquippedItems(actor,change).find(i=>i.category===(key==='native.weapon-enchant'?0:1));if(!item)return [];
 const enchant=knownOnly&&!item.isIdentified?0:item.enchantment;
 return [{owner:'native',stat:key,category:'flat',value:Math.round(netEnchant(enchant,dep('native.effective-strength'),item.strengthRequired??0)*4)-enchant*4,layer:'intrinsic',sourceKind:'strength-adjustment',sourceId:`native.item.${item.id}`}];
}
const nativeSessions=new WeakMap<Creature,{pipeline:StatPipeline;target?:Creature}>();
function standalone(actor:Creature,target?:Creature):StatPipeline {
 let session=nativeSessions.get(actor);
 if(!session){session={pipeline:null!};nativeSessions.set(actor,session);const view=session;
  const resolve=(id:number)=>id===actor.id?actor:view.target!;
  session.pipeline=new StatPipeline({actor:id=>nativeStatFacts(resolve(id),actor.id),revision:id=>nativeStatRevision(resolve(id)),base:(id,key,dep,facts,change,known)=>nativeBase(resolve(id),key,dep,facts,change,known),collect:(id,_facts,change,known)=>nativeRows(resolve(id),change,known),nativeRows:(id,key,dep,facts,change,known)=>nativeNodeRows(resolve(id),key,dep,facts,change,known)},NATIVE_STAT_KEYS,NATIVE_STAT_DAG);
 }
 if(target)session.target=target;
 return session.pipeline;
}
export function statQuery(actor:Creature):StatQuery{return bindings.get(actor)?.pipeline??standalone(actor);}
export function nativeStat(actor:Creature,key:string,facts:PairFacts={}):number{const pipeline=bindings.get(actor)?.pipeline??standalone(actor);if(!bindings.has(actor))pipeline.clear();return pipeline.value(actor.id,key,facts);}
export function nativeRational(actor:Creature,key='native.regeneration'):StatRational{const pipeline=bindings.get(actor)?.pipeline??standalone(actor);if(!bindings.has(actor))pipeline.clear();return pipeline.rational(actor.id,key);}
export function nativePair(attacker:Creature,defender:Creature,kind:'physical-damage'|'hit',facts:PairFacts):number{const bound=bindings.get(attacker)?.pipeline??bindings.get(defender)?.pipeline,pipeline=bound??standalone(attacker,defender);if(!bound)pipeline.clear();return pipeline.evaluatePair(attacker.id,defender.id,kind,facts);}
export function nativeHitBase(attacker:Creature,defender:Creature):number{return hitProbability(nativeStat(attacker,'native.accuracy'),nativeStat(defender,'native.defense'));}
export function nativeHitChance(attacker:Creature,defender:Creature,attackKind:'melee'|'thrown'='melee'):number {
 const base=nativeHitBase(attacker,defender)*100;if(base===0||base>=10000)return base/100;
 return Math.floor(nativePair(attacker,defender,'hit',{baseValue:base,attackKind,adjacent:Math.max(Math.abs(attacker.loc.x-defender.loc.x),Math.abs(attacker.loc.y-defender.loc.y))===1})/100);
}

/** Monster weakness acts on the rolled value, preserving CE's truncation boundary. */
export function nativeRolledDamage(actor:Creature,value:number):number{return Math.trunc(value*monsterDamageAdjustmentAmount(actor.weaknessAmount));}
/** Detached equipment projection used by native item prose and tests without a world. */
export function equipmentStats(item:Pick<Item,'category'|'enchantment'|'strengthRequired'|'damage'|'armor'>,strength:number):Readonly<Record<string,number>> {
 const snapshot={...item,isIdentified:true} as Item;
 const actor={id:1,name:'',hp:30,maxHp:30,strength,weaknessAmount:0,loc:{x:0,y:0},statusDurations:{},attackSpeed:100,movementSpeed:100,inventory:{items:[snapshot]},equippedWeapon:item.category===0?snapshot:null,equippedArmor:item.category===1?snapshot:null,hasStatus:()=>false,getStatusDuration:()=>0} as unknown as Creature;
 return standalone(actor).hypothetical(1,{},false);
}
export function ringWisdom(rings:readonly Item[]):number {return ringBonus(rings,'ring_of_wisdom');}

export const nativeRingEnchant=effectiveRingEnchant;

/** CE table nodes, shared by detached projections and per-roll consumers. */
export function nativeProbability(accuracy:number,defense:number,enchant=0):number{return hitProbability(accuracy,defense,enchant);}
export function nativeEnchantedRoll(value:number,enchant:number):number{return enchantedDamage(value,enchant);}
export function nativeMeanDamage(min:number,max:number,enchant:number):number{return (min+max)/2*damageFraction(enchant);}
export function nativeWeaknessFactor(actor:Creature):number{return monsterDamageAdjustmentAmount(actor.weaknessAmount);}
export function nativeStrengthAdjustment(strength:number,required:number):number{return strengthModifier(strength,required);}

export function projectileFacts(item:Pick<Item,'enchantment'|'strengthRequired'>):PairFacts{return {attackKind:'thrown',projectileEnchant:item.enchantment*4,projectileStrength:item.strengthRequired??0};}
export function nativeProjectileProbability(actor:Creature,target:Creature,item:Item):number{return nativeProbability(nativeStat(actor,'native.accuracy',projectileFacts(item)),nativeStat(target,'native.defense'));}
export function nativeProjectileRoll(actor:Creature,item:Item,roll:number):number{return nativeStat(actor,'native.damage-min',{...projectileFacts(item),baseValue:roll});}
export function nativeProjectileRunic(actor:Creature,item:Item):number{return nativeStat(actor,'native.runic-power',projectileFacts(item))/4;}
