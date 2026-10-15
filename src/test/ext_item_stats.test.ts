import { CombatSystem } from '../engine/Combat/Combat';
import { expect, it, vi } from 'vitest';
import { createItemHarness } from '../ext/testing/itemHarness';
import { descriptor, createItemStatsFixture, createItemFixture } from '../ext/testing/fixtures/itemFixture';
import { assembleDropItem } from '../engine/Items/FixedItemAssembly';
import { equippedStatItems, nativeStat, nativeStatRevision, markStatsDirty, nativeRational, nativePair } from '../engine/Stats/NativeStatSources';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { Item } from '../engine/Items/Item';
import { rng } from '../engine/Random';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { enchantedDamage, netEnchant } from './support/legacyStats';
import type { ItemClass } from '../ext/itemSdk';
import { itemStatPolicy } from '../engine/Stats/ItemStatPolicy';
import type { StatModifierRow } from '../ext/stats';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { markCreatureBirth } from '../ext/birth';
function setup(){const h=createItemHarness({},[{...descriptor,create:createItemStatsFixture}]),g=h.game();for(const item of [...g.player.inventory.items])g.player.unequip(item,true);return {h,g,p:g.player,r:g.extensionRuntime!};}
function item(category:ItemClass,power:number,known=false,kind?:string):Item {return assembleDropItem({native:{kind:kind??(category==='weapon'?'dagger':category==='armor'?'leather_armor':'ring_of_regeneration'),category,enchantment:0,runicType:null,isCursed:false,identified:known,familiarityRemaining:20},moduleData:{c6fixture:{v:1,power,known}}});}
it.each([8,12,20])('evaluates local flat then local percentage before enchant and strength penalty at strength %i',strength=>{
  const {h,p,r}=setup();p.strength=strength;markStatsDirty(p);
  const w=item('weapon',2);p.inventory.addItem(w);p.equip(w);
  const enchant=netEnchant(0,strength,12)+2;
  expect(nativeStat(p,'native.weapon-base-min')).toBe(5);expect(nativeStat(p,'native.weapon-base-max')).toBe(6);
  expect(nativeStat(p,'native.damage-min')).toBe(Math.max(1,enchantedDamage(5,enchant)));
  expect(nativeStat(p,'native.damage-max')).toBe(Math.max(1,enchantedDamage(6,enchant)));
  const armor=item('armor',2);p.inventory.addItem(armor);p.equip(armor);p.setStatusDuration('donning',0);
  expect(nativeStat(p,'native.armor-base')).toBe(55);
  expect(nativeStat(p,'native.defense')).toBe(Math.max(0,Math.trunc(55+(netEnchant(0,strength,10)+2)*10)));
  r.assertStats();h.dispose();
});
it('uses the same frozen facts in four slots and replaces same-kind rings by entity identity',()=>{
  const {h,p,r}=setup(),a=item('ring',2),b=item('ring',-1),c=item('ring',4);
  for(const i of [a,b,c])p.inventory.addItem(i);p.equip(a);p.equip(b);
  const facts=equippedStatItems(p);expect(facts.map(i=>i.slot)).toEqual(['left-ring','right-ring']);expect(Object.isFrozen(facts[0]!.moduleData!.c6fixture)).toBe(true);
  expect(facts[0]!.moduleData).not.toBe(a.moduleData);
  expect(nativeStat(p,'native.regeneration-bonus')).toBe(1);
  const revision=nativeStatRevision(p),cache=r.stats.cacheSize(p.id),random=rng.getState(),audit=auditFullObjectGraph([p,rng]);
  expect(r.stats.hypothetical(p.id,{unequip:a.id,equip:c.id},false)['native.regeneration-bonus']).toBe(3);
  expect(r.stats.hypothetical(p.id,{unequip:b.id,equip:c.id},false)['native.regeneration-bonus']).toBe(6);
  expect(r.stats.hypothetical(p.id,{},true)['native.regeneration-bonus']).toBe(0);
  expect(equippedStatItems(p,{unequip:a.id,equip:c.id}).find(i=>i.id===c.id)!.slot).toBe('left-ring');
  expect(nativeStatRevision(p)).toBe(revision);expect(r.stats.cacheSize(p.id)).toBe(cache);expect(rng.getState()).toEqual(random);expect(audit.differences()).toEqual([]);h.dispose();
});
it.each([-2,-1,0,3,8,20])('aggregates ring points before stealth/zero-light rules and multiplies awareness once at %i',power=>{
  const {h,p}=setup(),ring=item('ring',power);p.inventory.addItem(ring);p.equip(ring);
  expect(nativeStat(p,'native.stealth-range')).toBe(Math.max(2,14+(power<0?-4*power:-power)));
  expect(nativeStat(p,'native.light')).toBe(1+power<=0?power:1+power);
  expect(nativeStat(p,'native.awareness')).toBe(Math.min(160,power*20));
  expect(nativeStat(p,'native.regeneration-bonus')).toBe(power);
  expect(nativeRational(p).denominator).toBeGreaterThan(0);h.dispose();
});
it('bounds the item owner pool separately, clamps speed and rejects per-item source budget excess',()=>{
  const {h,p}=setup(),w=item('weapon',20);p.inventory.addItem(w);p.equip(w);
  expect(nativeStat(p,'native.weapon-enchant')).toBe(40);expect(nativeStat(p,'native.attack-speed')).toBe(60);
  const row:StatModifierRow={stat:'native.light-points',category:'flat',value:1,layer:'equipment',sourceKind:'item-affix',sourceId:`c6fixture.item.${w.id}.affix.0`};
  expect(()=>itemStatPolicy(Array.from({length:24},(_,i)=>({...row,sourceId:`c6fixture.item.${w.id}.affix.${i}`})),'c6fixture')).not.toThrow();
  expect(()=>itemStatPolicy(Array.from({length:25},(_,i)=>({...row,sourceId:`c6fixture.item.${w.id}.affix.${i}`})),'c6fixture')).toThrow();h.dispose();
});
it('knowledge-only weapon identification refreshes caches without changing mechanical revision',()=>{
  const {h,p}=setup();const w=ItemLoader.spawnWeapon('dagger',0,0,1)!;w.isCursed=false;p.inventory.addItem(w);p.equip(w);
  const value=nativeStat(p,'native.damage-min'),revision=nativeStatRevision(p),random=rng.getState();ItemLoader.identifyInstance(w);
  expect(nativeStatRevision(p)).toBe(revision);expect(nativeStat(p,'native.damage-min')).toBe(value);expect(rng.getState()).toEqual(random);h.dispose();
});
it('raises capacities without filling, clamps on removal, and initializes only genuine full-health births',()=>{
  const {h,p}=setup(),hp=p.hp,w=item('weapon',3);p.inventory.addItem(w);p.equip(w);expect(p.maxHp).toBe(33);expect(p.hp).toBe(hp);p.hp=33;p.unequip(w);expect(p.hp).toBe(30);h.dispose();
  const birth=createItemHarness({},[{...descriptor,create:()=>({...createItemFixture(),statSources:{initializeHealthOnBirth:true,collect(actor){return actor.player?[]:[{stat:'native.max-hp',category:'increased',value:10000,layer:'environment',sourceKind:'environment',sourceId:'c6fixture.birth'}];}}})}]);
  const g=birth.game(),m=new Monster(1,1,(monsters as MonsterData[]).find(m=>m.id==='rat')!),base=m.maxHp;
  markCreatureBirth(m,'natural');g.monsters.push(m);g.extensionRuntime!.attachCreature(m);expect(m.maxHp).toBe(base*2);expect(m.hp).toBe(m.maxHp);
  m.hp--;markStatsDirty(m);g.extensionRuntime!.reconcileMaterialized(m.id);expect(m.hp).toBe(m.maxHp-1);birth.dispose();
});
it('discovers real registered keys with a normalized fingerprint; absent growth attributes remain unavailable',()=>{
  const {h,r}=setup();const a=r.queryOptional('foundation.stats.v1',{keys:['native.weapon-base-min','combat.stamina-capacity','native.weapon-base-min']}),b=r.queryOptional('foundation.stats.v1',{keys:['combat.stamina-capacity','native.weapon-base-min']});
  expect(a).toEqual(b);expect(a).toMatchObject({status:'available',value:{v:1,keys:[{id:'combat.stamina-capacity',available:false},{id:'native.weapon-base-min',available:true}]}});
  expect(r.queryOptional('growth.attributes.v1',{})).toEqual({status:'unavailable',reason:'absent'});expect(r.queryOptional('foundation.item-encounters.v1',{})).toEqual({status:'unavailable',reason:'absent'});h.dispose();
});

it('actual melee rolls use the modified endpoints and native clumping',()=>{
  const {h,g,p}=setup(),w=item('weapon',2);p.inventory.addItem(w);p.equip(w);
  const target=new Monster(p.x+1,p.y,(monsters as MonsterData[]).find(m=>m.id==='ogre')!);target.isCaged=true;g.monsters.push(target);g.extensionRuntime!.attachCreature(target);
  const min=nativeStat(p,'native.damage-min'),max=nativeStat(p,'native.damage-max'),roll=vi.spyOn(rng,'randRange');
  CombatSystem.attack(p,target);expect(roll.mock.calls).toContainEqual([min,max]);roll.mockRestore();h.dispose();
});
it('item owner caps leave a second owner pool intact',()=>{
  const h=createItemHarness({modules:['foreign']},[{...descriptor,create:createItemStatsFixture},{...descriptor,id:'foreign',labelKey:'ext.foreign.name',create:()=>({id:'foreign',version:'1.0.0',initialState:()=>({}),validateState:(v):v is import('../ext/types').Json=>!!v&&typeof v==='object',statSources:{collect(a){return a.player?[
    {stat:'native.weapon-enchant',category:'flat',value:20,layer:'equipment',sourceKind:'fixture',sourceId:'foreign.enchant'},
    {stat:'native.attack-speed',category:'more',value:-1000,slot:'equipment',layer:'equipment',sourceKind:'fixture',sourceId:'foreign.speed'},
    {stat:'native.physical-damage-taken',category:'increased',value:-1000,layer:'equipment',sourceKind:'fixture',sourceId:'foreign.damage'}]:[];}}})}]);
  const g=h.game(),p=g.player;for(const old of [...p.inventory.items])p.unequip(old,true);const w=item('weapon',20);p.inventory.addItem(w);p.equip(w);
  expect(nativeStat(p,'native.weapon-enchant')).toBe(60);expect(nativeStat(p,'native.attack-speed')).toBe(50);
  const attacker=new Monster(1,1,(monsters as MonsterData[]).find(m=>m.id==='rat')!);g.monsters.push(attacker);g.extensionRuntime!.attachCreature(attacker);
  expect(nativePair(attacker,p,'physical-damage',{baseValue:100})).toBe(40);h.dispose();
});
it('combat capability discovery reports actual keys while absent growth attribute mapping remains unavailable',()=>{
  const h=createItemHarness({modules:['combat']}),r=h.game().extensionRuntime!;
  expect(r.queryOptional('foundation.stats.v1',{keys:['combat.stamina-capacity','combat.poise-capacity','combat.stamina-regen']})).toMatchObject({status:'available',value:{keys:[{available:true},{available:true},{available:true}]}});
  expect(r.queryOptional('growth.attributes.v1',{})).toEqual({status:'unavailable',reason:'absent'});expect(r.queryOptional('foundation.item-encounters.v1',{})).toEqual({status:'unavailable',reason:'absent'});h.dispose();
});

it('review: hypothetical shares one provider collection and detached equipment view across the complete DAG',()=>{
 let armed=false,calls=0;
 const h=createItemHarness({},[{...descriptor,create:()=>{const m=createItemStatsFixture();return {...m,statSources:{...m.statSources!,collect(a,c){if(armed){calls++;expect(c.equippedItems()).toBe(c.equippedItems());}return m.statSources!.collect(a,c);}}};}}]),g=h.game(),r=g.extensionRuntime!,w=item('weapon',2);g.player.inventory.addItem(w);g.player.equip(w);
 armed=true;const audit=auditFullObjectGraph([g,rng]),size=r.stats.cacheSize(g.player.id),revision=nativeStatRevision(g.player);
 const result=r.stats.hypothetical(g.player.id,{},false);expect(result['native.weapon-base-min']).toBe(5);expect(calls).toBe(1);expect(r.stats.cacheSize(g.player.id)).toBe(size);expect(nativeStatRevision(g.player)).toBe(revision);expect(audit.differences()).toEqual([]);h.dispose();
});

it('review: validation reuse cannot mask changed rows or policy budgets at an unchanged revision',()=>{
 let mode='valid';
 const h=createItemHarness({},[{...descriptor,create:()=>{const m=createItemStatsFixture();return {...m,statSources:{...m.statSources!,collect(a,c){const rows=m.statSources!.collect(a,c);if(!a.player)return rows;
  if(mode==='invalid')return [{...rows[0]!,value:Infinity}];
  if(mode==='budget')return Array.from({length:25},(_,n)=>({...rows[0]!,sourceId:`c6fixture.item.${c.equippedItems()[0]!.id}.affix.${n}`}));
  if(mode==='accessor'){const poisoned={...rows[0]!};Object.defineProperty(poisoned,'value',{get(){throw Error('getter ran');},enumerable:true});return [poisoned];}
  return rows;}}};}}]),g=h.game(),r=g.extensionRuntime!,w=item('weapon',2);g.player.inventory.addItem(w);g.player.equip(w);
 const expected=nativeStat(g.player,'native.damage-min'),revision=nativeStatRevision(g.player);
 for(const bad of ['invalid','budget','accessor']){mode=bad;r.stats.clear();expect(()=>r.stats.value(g.player.id,'native.damage-min')).toThrowError(expect.not.stringContaining('getter ran'));expect(nativeStatRevision(g.player)).toBe(revision);}
 mode='valid';r.stats.clear();expect(nativeStat(g.player,'native.damage-min')).toBe(expected);h.dispose();
});
