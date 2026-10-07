import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { createHeadlessGame } from './harness';
import { Player } from '../entities/Player';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { Item, ItemCategory } from '../engine/Items/Item';
import { nativeStat, nativeRational, statQuery, markStatsDirty, nativeRolledDamage, nativeStatRevision, hypotheticalItemFields } from '../engine/Stats/NativeStatSources';
import { netEnchant, playerDefense, enchantedDamage, hitProbability, legacyRegeneration } from './support/legacyStats';
import { effectiveRingEnchant, ringBonus, ringLightMultiplier, turnsForFullRegenInThousandths } from '../engine/Items/RingBonuses';
import { monsterAccuracyAdjusted, monsterDefenseAdjusted, monsterDamageAdjustmentAmount } from '../engine/Combat/CombatFormulas';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
const weapon=(enchantment:number,required=12)=>{const i=new Item('test',')',0xffffff,ItemCategory.WEAPON);Object.assign(i,{damage:'2d4+1',enchantment,strengthRequired:required,identified:true});return i;};
const ring=(identity:string,enchantment:number,identified=true)=>{const i=new Item('test','=',0xffffff,ItemCategory.RING);Object.assign(i,{identityId:identity,enchantment,identified});return i;};
afterEach(()=>logger.reset());
describe('native zero-source numerical shadow',()=>{
 it.each([12,15,8])('matches equipment DAG for strength %i across quarter-enchant boundaries',strength=>{
  const p=new Player(4,4);p.strength=strength;
  for(const enchant of [-3,0,2,9]){const w=weapon(enchant,13),a=new Item('test',']',0xffffff,ItemCategory.ARMOR);Object.assign(a,{enchantment:enchant,armor:5,strengthRequired:15,identified:true});p.inventory.items.push(w,a);p.equip(w);p.equip(a);p.weaken(5);p.setStatusDuration('donning',2);
   const e=netEnchant(enchant,strength-p.weaknessAmount,13);
   expect(nativeStat(p,'native.weapon-enchant')).toBe(e*4);
   expect(nativeStat(p,'native.defense')).toBe(playerDefense(5,enchant,strength-p.weaknessAmount,15,2));
   expect(nativeStat(p,'native.damage-min')).toBe(Math.max(1,enchantedDamage(3,e)));
   expect(nativeStat(p,'native.damage-max')).toBe(Math.max(1,enchantedDamage(9,e)));
   expect(nativeStat(p,'native.runic-power')).toBe(nativeStat(p,'native.weapon-enchant'));
  }
 });
 it.each(['rat','ogre','dragon','vampire'])('matches %s accuracy/defense/rolled weakness/regen/speeds',id=>{
  const m=new Monster(5,4,(monsters as MonsterData[]).find(r=>r.id===id)!);
  for(let weakness=0;weakness<=10;weakness++){m.weaknessAmount=weakness;markStatsDirty(m);
   expect(nativeStat(m,'native.accuracy')).toBe(monsterAccuracyAdjusted(m.accuracy,weakness));expect(nativeStat(m,'native.defense')).toBe(monsterDefenseAdjusted(m.defense,weakness));
   for(const roll of [0,1,3,11,50])expect(nativeRolledDamage(m,roll)).toBe(Math.trunc(roll*monsterDamageAdjustmentAmount(weakness)));
  }
  for(const status of ['hasted','slowed'] as const){m.applyStatus(status,4);expect(nativeStat(m,'native.move-speed')).toBe(m.movementSpeed);expect(nativeStat(m,'native.attack-speed')).toBe(m.attackSpeed);m.setStatusDuration(status,0);m.refreshSpeeds();}
  const rate=nativeRational(m);expect(rate.numerator/rate.denominator).toBe(m.regenTurns>0?1/m.regenTurns:0);
 });
 it.each([-10,-3,0,1,4,10,50])('keeps reduced exact regeneration for ring %i',enchant=>{
  const p=new Player(4,4),r=ring('ring_of_regeneration',enchant);p.inventory.items.push(r);p.equip(r);
  for(const hp of [1,30,47,301,1001]){p.maxHp=hp;markStatsDirty(p);for(const boosted of [false,true]){p.setStatusDuration('regenerating',boosted?4:0);
   let left=hp,per=0;const full=turnsForFullRegenInThousandths(enchant),whole=Math.floor(full/1000);while(whole>0&&left>whole){per++;left-=whole;}const interval=Math.floor(full/left);
   let n=BigInt(per)*BigInt(interval>0?interval:1)+(interval>0?1000n:0n),d=BigInt(interval>0?interval:1);if(boosted){n*=5n;d*=3n;}let a=n,b=d;while(b){const rem=a%b;a=b;b=rem;}const expected={numerator:Number(n/a),denominator:Number(d/a)};
   expect(nativeRational(p)).toEqual(expected);expect(Math.abs(expected.numerator/expected.denominator-legacyRegeneration(p))).toBeLessThan(1e-10);
  }}
 });
 it.each(['clairvoyance','light','reaping','transference','wisdom'])('matches identified and observable unknown %s rings',name=>{
  const p=new Player(4,4),a=ring(`ring_of_${name}`,5,false),b=ring(`ring_of_${name}`,-2,true);p.inventory.items.push(a,b);p.equip(a);p.equip(b);
  expect(nativeStat(p,`native.${name}`)).toBe(name==='light'?ringLightMultiplier(p.rings()):ringBonus(p.rings(),`ring_of_${name}`));
  const before=rng.getState(),revision=nativeStatRevision(p),keys=Object.keys(p);const cache=statQuery(p) as {diagnostics?:unknown};const diagnostic=JSON.stringify(cache.diagnostics);
  const projection=statQuery(p).hypothetical(p.id,{unequip:b.id},true);expect(projection[`native.${name}`]).toBe(name==='light'?1:0);
  expect(rng.getState()).toEqual(before);expect(nativeStatRevision(p)).toBe(revision);expect(Object.keys(p)).toEqual(keys);expect(JSON.stringify(cache.diagnostics)).toBe(diagnostic);expect(effectiveRingEnchant(a)).toBe(1);
 });
 it.each([51001,51002,51003])('checks real Game sources for seed %i without rules RNG',seed=>{
  const g=createHeadlessGame(seed,'test');g.startNewGame({seed,mode:'test',ruleSet:'extended',extensions:[]});
  const before=rng.getState();const p=g.player;
  expect(nativeStat(p,'native.strength')).toBe(p.strength);expect(nativeStat(p,'native.max-hp')).toBe(p.maxHp);expect(nativeStat(p,'native.effective-strength')).toBe(p.strength-p.weaknessAmount);
  for(const m of g.monsters){expect(nativeStat(m,'native.accuracy')).toBe(monsterAccuracyAdjusted(m.accuracy,m.weaknessAmount));expect(nativeStat(m,'native.defense')).toBe(monsterDefenseAdjusted(m.defense,m.weaknessAmount));expect(nativeStat(m,'native.move-speed')).toBe(m.movementSpeed);}
  for(const kind of ['physical','fire','poison','other'])expect(nativeStat(p,`native.resist.${kind}`)).toBe(0);
  expect(rng.getState()).toEqual(before);expect(hitProbability(100,0)).toBe(100);g.extensionRuntime!.assertStats();
 });
 it('projects quarter-enchant Item proposals without live writes or RNG',()=>{
  const p=new Player(4,4),w=weapon(2.25,12);p.inventory.items.push(w);p.equip(w);const before=rng.getState(),revision=nativeStatRevision(p);
  const projected=hypotheticalItemFields(p,w.id,{enchantment:3.25,strengthRequired:12},false);expect(projected['native.weapon-enchant']).toBe(13);expect(w.enchantment).toBe(2.25);expect(nativeStatRevision(p)).toBe(revision);expect(rng.getState()).toEqual(before);
 });
 it('forbids bypassing migrated formula entry points in production readers',()=>{
  const forbidden=/\b(?:netEnchant|playerDefense|ringBonus|effectiveRingEnchant|accuracyFraction|damageFraction|enchantedDamage|monsterAccuracyAdjusted|monsterDefenseAdjusted|monsterDamageAdjustmentAmount)\s*\(/g;
  const allowed=new Set(['src/engine/Stats/NativeStatSources.ts','src/engine/Items/RingBonuses.ts','src/engine/Combat/CombatFormulas.ts']);
  const findings:string[]=[];
  for(const f of globSync('src/{engine,entities,ext}/**/*.ts')){if(allowed.has(f)||f.includes('/tests/')||f.endsWith('.test.ts'))continue;const text=readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');if(forbidden.test(text))findings.push(f);forbidden.lastIndex=0;}
  expect(findings).toEqual([]);
 });
});
