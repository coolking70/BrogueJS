import { isJson, validId } from '../../json';
import weapons from '../../../data/weapons.json';
import armors from '../../../data/armors.json';
import arcana from '../../../data/arcana.json';
import zhCN from './locales/zh_CN.json';
import { LootDataError } from './errors';
import { computeRarityWeights } from './rarity';
import type { LootDataErrorCode } from './errors';
import type { ItemClass, LootPack, ModifierSpec, RarityId } from './types';

export const LOOT_FILE_NAMES = ['ilvl','tiers','bases','rarities','affixes','uniques','sets','runes','runewords','sockets','runeDrops','monsterClasses','dropTables','gold','presets','enhancement','identify','corruption','salvage','caps','rareNames'] as const;
const CLASSES = ['weapon', 'armor', 'ring'] as const;
const RARITIES = ['normal', 'magic', 'rare', 'unique', 'set', 'runeword'] as const;
const MONSTER_CLASSES = ['none', 'fodder', 'splitter', 'standard', 'elite'] as const;
const SOURCES = ['floor', 'kill', 'encounter', 'vault'] as const;
const UNIT = ['bp', 'int', 'display-armor', 'ring-point', 'runic-strength'] as const;
const WEAPON_RUNES = ['speed','quietus','paralyzing','multiplicity','slowing','confusion','force','slaying','mercy','plenty'];
const ARMOR_RUNES = ['multiplicity','mutuality','absorption','reprisal','immunity','reflection','respiration','dampening','burden','vulnerability','immolation'];
const STATS = ['loot.local.damage','loot.local.armor','loot.ring-implicit','loot.rarity-find',
  'native.weapon-enchant','native.physical-damage-dealt','native.defense','native.physical-damage-taken',
  'native.move-speed','native.light','native.accuracy','native.attack-speed','native.max-hp','native.regeneration','native.strength',
  'native.stealth-range','native.awareness','native.clairvoyance','native.wisdom','native.resist.fire','native.resist.poison',
  'native.transference','native.reaping','native.runic-power','native.armor-runic-power',
  'combat.stamina-capacity','combat.poise-capacity','combat.stamina-regen','combat.poise-recovery',
  'growth.focus-capacity','growth.attribute:{attribute}','growth.xp-gain'];
function fail(code: LootDataErrorCode, path: string, message?: string): never { throw new LootDataError(code, path, message); }
type Check = (value: unknown, path: string) => void;
const integer = (min = -1000000, max = 1000000): Check => (v,p) => {
  if (!Number.isSafeInteger(v)) fail('INVALID_TYPE',p,'Expected safe integer');
  if ((v as number) < min || (v as number) > max) fail('INVALID_VALUE',p,`Expected ${min}…${max}`);
};
const num = integer(), nonnegative = integer(0), weight = integer(0,10000), bp = integer(0,10000);
const str: Check = (v,p) => { if (typeof v !== 'string' || v.length === 0 || v.length > 256) fail('INVALID_TYPE',p,'Expected nonempty string'); };
const nativeId: Check = (v,p) => { str(v,p); if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(v as string)) fail('INVALID_VALUE',p,'Invalid native identifier'); };
const id: Check = (v,p) => { if (!validId(v)) fail('INVALID_VALUE',p,'Invalid identifier'); };
const key: Check = (v,p) => { str(v,p); if (!(v as string).startsWith('ext.loot.')) fail('INVALID_VALUE',p,'Expected ext.loot text key'); };
const bool: Check = (v,p) => { if (typeof v !== 'boolean') fail('INVALID_TYPE',p,'Expected boolean'); };
const enumeration = (values: readonly unknown[]): Check => (v,p) => { if (!values.includes(v)) fail('INVALID_VALUE',p,`Expected one of ${values.join(', ')}`); };
const literal = (value: unknown): Check => enumeration([value]);
const nullable = (check: Check): Check => (v,p) => { if (v !== null) check(v,p); };
const array = (check: Check, min = 0, max = 256): Check => (v,p) => {
  if (!Array.isArray(v)) fail('INVALID_TYPE',p,'Expected array');
  if (v.length < min) fail('INVALID_VALUE',p,'Array too short');
  if (v.length > max) fail('BUDGET',p,'Array exceeds budget');
  const keys=Reflect.ownKeys(v);
  for(const k of keys){
    if(k==='length')continue;
    if(typeof k!=='string'||!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=v.length)fail('UNKNOWN_FIELD',`${p}.${String(k)}`);
    const descriptor=Object.getOwnPropertyDescriptor(v,k)!;
    if(!descriptor.enumerable||!('value' in descriptor))fail('INVALID_TYPE',`${p}[${k}]`,'Expected enumerable data property');
  }
  if(keys.length!==v.length+1)fail('INVALID_TYPE',p,'Expected dense JSON array');
  v.forEach((child,i) => check(child,`${p}[${i}]`));
};
const object = (required: Record<string,Check>, optional: Record<string,Check> = {}): Check => (v,p) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('INVALID_TYPE',p,'Expected object');
  const value = v as Record<string,unknown>;
  for (const k of Reflect.ownKeys(value)) {
    if (typeof k !== 'string' || (!Object.prototype.hasOwnProperty.call(required,k) && !Object.prototype.hasOwnProperty.call(optional,k))) fail('UNKNOWN_FIELD',`${p}.${String(k)}`);
    const descriptor=Object.getOwnPropertyDescriptor(value,k)!;
    if(!descriptor.enumerable||!('value' in descriptor))fail('INVALID_TYPE',`${p}.${k}`,'Expected enumerable data property');
  }
  for (const [k,c] of Object.entries(required)) {
    if (!Object.prototype.hasOwnProperty.call(value,k)) fail('INVALID_TYPE',`${p}.${k}`,'Missing field');
    c(value[k],`${p}.${k}`);
  }
  for (const [k,c] of Object.entries(optional)) if (Object.prototype.hasOwnProperty.call(value,k)) c(value[k],`${p}.${k}`);
};
const record = (keys: readonly string[], check: Check) => object(Object.fromEntries(keys.map(k => [k,check])));
const range: Check = (v,p) => {
  array(num,2,2)(v,p);
  const [lo,hi] = v as number[];
  if (lo! > hi!) fail('INVALID_RANGE',p,'Reversed range');
};
const countRange: Check = (v,p) => { range(v,p); (v as number[]).forEach((n,i) => integer(1,8)(n,`${p}[${i}]`)); };
const modifier = object({stat: enumeration(STATS), category: enumeration(['flat','increased','more','local-increased','local-flat','override']), valueIndex: integer(0,3), unit: enumeration(UNIT)}, {
  slot: literal('speed'), runicType: enumeration([...WEAPON_RUNES,...ARMOR_RUNES]),
  conditions: array(object({kind:literal('target-tag'),tag:literal('body.large')}),1,1),
});
const modifiers = array(modifier,0,4);
const rangeList = array(range,0,4);
const requirement = nullable(object({module:enumeration(['combat','growth']),key:str}));
const fallback: Check = (v,p) => {
  if (v === null) return;
  if (v && typeof v === 'object' && 'kind' in v && v.kind === 'replace') object({kind:literal('replace'),affixId:id})(v,p);
  else object({kind:literal('omit')})(v,p);
};
const affix = object({id, nameKey:key, position:enumeration(['prefix','suffix']),itemClasses:array(enumeration(CLASSES),1,3),
  group:id,weight,polarity:enumeration([1,-1]),maxTier:integer(1,6),tiers:array(object({tier:integer(1,8),ranges:rangeList}),1,8),
  modifiers, requires:requirement, fallback, expand:nullable(object({kind:literal('growth-attributes')})),
  rune:nullable(object({slot:enumeration(['weapon','armor']),runicType:enumeration([...WEAPON_RUNES,...ARMOR_RUNES])})),tags:array(id,0,32)});
const rarityWeights = record(RARITIES.filter(r => r !== 'runeword'),weight);
const affixCounts = array(object({n:integer(1,6),w:weight}),1,6);
const file = (shape: Record<string,Check>): Check => object({schema:(v,p)=>{if(v!==1) fail('INVALID_SCHEMA',p);},...shape});
const file2 = (shape: Record<string,Check>): Check => object({schema:literal(2),...shape});
const fixedRows = (max:number) => array(object({rowId:id,ranges:rangeList,modifiers}),1,max);
const schemas: Record<keyof LootPack,Check> = {
  ilvl:file({ilvlPerDepthBp:integer(0,1000000),min:integer(1,99),max:integer(1,99),siteIlvl:integer(1,99),
    sourceBonus:record([...SOURCES,'part','craft'],num),classBonus:record(MONSTER_CLASSES,num),championBonus:num}),
  tiers:file({tiers:array(object({tier:integer(1,8),minIlvl:integer(1,99),enabled:bool}),1,8),
    window:object({size:integer(1,8),weightsHighToLow:array(weight,1,8)})}),
  bases:file({ilvlBands:array(object({minIlvl:integer(1,99),maxIlvl:integer(1,99)}),1,99),
    weaponTierWeights:record(['light','medium','heavy'],array(weight,1,99)),
    weapons:array(object({baseId:nativeId,tier:enumeration(['light','medium','heavy'])}),1,256),
    armors:array(object({baseId:nativeId,weights:array(weight,1,99)}),1,256),
    rings:array(object({baseId:nativeId,weight}),1,256),ringImplicit:object({base:num,ilvlStep:integer(1,99),min:num,max:num})}),
  rarities:file({rarities:array(object({id:enumeration(RARITIES),order:integer(0,5),nameKey:key,
    colorDark:(v,p)=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/.test(v))fail('INVALID_VALUE',p);},
    colorLight:(v,p)=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/.test(v))fail('INVALID_VALUE',p);},
    marker:(v,p)=>{if(typeof v!=='string')fail('INVALID_TYPE',p);},
    affixes:nullable(object({prefixMax:integer(0,6),suffixMax:integer(0,6)})),enhancementCap:integer(0,100),droppable:bool}),6,6)}),
  affixes:file({runeFamilyEnabled:bool,affixes:array(affix,1,256)}),
  uniques:file({uniques:array(object({id,nameKey:key,descriptionKey:key,baseId:nativeId,minIlvl:integer(1,99),weight,
    rows:array(object({rowId:id,ranges:rangeList,modifiers}),1,8)}),0,128),
    bossUniqueBias:array(object({formId:id,uniqueId:id,multiplierBp:nonnegative}),0,128)}),
  sets:file({sets:array(object({id,nameKey:key,descriptionKey:key,
    pieces:array(object({id,nameKey:key,descriptionKey:key,baseId:nativeId,minIlvl:integer(1,99),weight,rows:fixedRows(8)}),1,4),
    bonuses:array(object({count:integer(2,4),rows:fixedRows(4)}),0,3)}),0,32)}),
  runes:file({runes:array(object({id,nameKey:key,descriptionKey:key,itemClasses:array(enumeration(['weapon','armor']),1,2),weight,minIlvl:integer(1,99),rows:fixedRows(4)}),1,33)}),
  runewords:file({words:array(object({id,nameKey:key,descriptionKey:key,baseClasses:array(enumeration(['weapon','armor']),1,2),sockets:integer(1,4),sequence:array(id,1,4),rows:fixedRows(8)}),0,64)}),
  sockets:file({bases:array(object({baseId:nativeId,bands:array(object({minIlvl:integer(1,99),maxIlvl:integer(1,99),weights:array(weight,5,5)}),1,99)}),1,512)}),
  runeDrops:file({rows:array(object({id,presetId:id,source:enumeration(['kill','encounter']),chanceBp:bp,count:array(literal(1),2,2),runeIds:array(id,1,33)}),0,16)}),
  monsterClasses:file({defaultClass:enumeration(MONSTER_CLASSES),classes:array(enumeration(MONSTER_CLASSES),5,5),
    members:array(object({typeId:nativeId,class:enumeration(MONSTER_CLASSES)}),0,4096),
    modifiers:object({leader:object({chanceBonusBp:bp}),champion:object({chanceBonusBp:bp,rarityBonusBp:nonnegative})})}),
  dropTables:file({tables:array(object({id,priority:num,
    match:object({source:enumeration(SOURCES)},{monsterClass:enumeration(MONSTER_CLASSES),monsterId:nativeId,formId:id,depth:countDepth}),
    chanceBp:bp,count:(v,p)=>{if(v!=='preset-encounter')countRange(v,p);},classWeights:record(CLASSES,weight),
    rarityBonusBp:nonnegative,minRarity:nullable(enumeration(RARITIES)),ilvlBonus:num}),0,256)}),
  gold:file({amount:object({minBase:nonnegative,minPerDepth:nonnegative,maxBase:nonnegative,maxPerDepth:nonnegative}),
    byClass:record(MONSTER_CLASSES.filter(c=>c!=='none'),object({chanceBp:bp,multiplier:nonnegative})),
    encounter:object({chanceBp:bp,multiplier:nonnegative})}),
  presets:file({presets:array(object({id,nameKey:key,descriptionKey:key,floorConversionBp:bp,killDropMultiplierBp:nonnegative,maxPerKill:integer(1,8),
    rarityWeights,rarityIlvlScalingBp:rarityWeights,
    affixCount:object({magic:affixCounts,rare:affixCounts,rareHighIlvl:object({minIlvl:integer(1,99),table:affixCounts})}),
    encounter:object({count:integer(1,8),firstMinRarity:enumeration(RARITIES),restMinRarity:enumeration(RARITIES),uniqueWeightBp:nonnegative}),
    vault:object({minRarity:enumeration(RARITIES),highValueMinRarity:enumeration(RARITIES)}),rarityFind:object({k:integer(1),cap:nonnegative}),corruptChanceBp:bp,
    familiarity:object({weaponKills:integer(1),armorTurns:integer(1),ringTurns:integer(1)}),goldMultiplierBp:nonnegative,salvageMultiplierBp:nonnegative,
    monsterScaling:array(object({depth:integer(1,99),hpBp:num,damageBp:num,accuracyBp:num}),1,99)}),1,8)}),
  enhancement:file({caps:record(RARITIES,integer(0,100)),weapon:object({localDamageBpPerLevel:nonnegative,weaponEnchantEveryLevels:integer(1)}),
    armor:object({maxHpPerLevel:nonnegative,defenseInternalPerLevel:nonnegative}),ring:object({implicitEveryLevels:integer(1)}),
    atCap:object({kind:literal('refine'),target:literal('random-positive-affix'),keep:literal('higher'),rejectWhenAllAtTierMax:literal(true)}),nonLootItems:literal('native-plus-one')}),
  identify:file2({familiarityMultiplierBp:record(RARITIES,nonnegative),familiarityRounding:literal('ceil'),scrollRevealsAll:literal(true),
    firstTriggerReveal:object({enabled:literal(true),excludedStats:array(enumeration(STATS),0,64)})}),
  corruption:file({eligibleRarities:array(enumeration(['magic','rare']),1,2),maxTotalAffixes:integer(1,6),negativeRuneFallback:bool,
    compensation:object({tierStep:literal(1),maxTier:integer(1,6)}),nativeCursed:literal(true)}),
  salvage:file2({shardItemId:id,nameKey:key,maxStack:integer(1,999),base:record(RARITIES,nonnegative),ilvlStep:integer(1,99),
    corruptedMultiplierBp:nonnegative,minimum:literal(1),exchange:object({shards:integer(1),effect:literal('identify-one')})}),
  caps:file({caps:array(object({stat:enumeration(STATS),scope:enumeration(['loot-sources','final']),unit:enumeration(UNIT)},{min:num,max:num}),1,64)}),
  rareNames:file({first:array(object({nameKey:key}),32,32),second:array(object({nameKey:key}),32,32)}),
};
function countDepth(v: unknown,p: string) { range(v,p); (v as number[]).forEach((n,i)=>integer(1,99)(n,`${p}[${i}]`)); }
function unique(values: readonly string[], path: string, suffix = '') {
  const seen = new Set<string>(); values.forEach((v,i)=> { if(seen.has(v))fail('DUPLICATE_ID',`${path}[${i}]${suffix}`); seen.add(v); });
}
function increasing(values: readonly number[], path: string, field: string) {
  values.forEach((v,i)=> { if(i>0 && v<=values[i-1]!)fail('INVALID_RANGE',`${path}[${i}].${field}`,'Must strictly increase'); });
}
function validateModifiers(mods: ModifierSpec[], ranges: [number,number][], path: string, classes: ItemClass[]) {
  mods.forEach((m,i)=>{
    const p = `${path}[${i}]`;
    const combinations: Record<string,string[]> = {
      'loot.local.damage':['local-increased/bp','local-flat/int'], 'loot.local.armor':['local-increased/bp'],
      'loot.ring-implicit':['override/ring-point','flat/ring-point'], 'loot.rarity-find':['flat/bp'],
      'native.weapon-enchant':['flat/int'], 'native.physical-damage-dealt':['increased/bp'],
      'native.defense':['flat/display-armor','flat/int'], 'native.physical-damage-taken':['increased/bp'],
      'native.move-speed':['increased/bp'], 'native.accuracy':['increased/bp'], 'native.attack-speed':['more/bp'],
      'native.max-hp':['flat/int'], 'native.strength':['flat/int'],
      'native.resist.fire':['flat/bp'], 'native.resist.poison':['flat/bp'],
      'native.runic-power':['flat/runic-strength'], 'native.armor-runic-power':['flat/runic-strength'],
      'combat.stamina-capacity':['flat/int'], 'combat.poise-capacity':['flat/int'],
      'combat.stamina-regen':['increased/bp'], 'combat.poise-recovery':['increased/bp'],
      'growth.focus-capacity':['flat/int'], 'growth.attribute:{attribute}':['flat/int'], 'growth.xp-gain':['increased/bp'],
    };
    const allowed = combinations[m.stat] ?? ['flat/ring-point'];
    if(!allowed.includes(`${m.category}/${m.unit}`))fail('INVALID_COMBINATION',`${p}.unit`);
    if(m.valueIndex>=ranges.length)fail('INVALID_REFERENCE',`${p}.valueIndex`);
    if((m.category==='more') !== (m.slot==='speed'))fail('INVALID_COMBINATION',`${p}.slot`);
    if(m.category==='more' && (m.stat!=='native.attack-speed'||m.unit!=='bp'))fail('INVALID_COMBINATION',`${p}.category`);
    if((m.category==='local-flat'||m.category==='local-increased') && !['loot.local.damage','loot.local.armor'].includes(m.stat))fail('INVALID_COMBINATION',`${p}.category`);
    if(m.category==='override' && m.stat!=='loot.ring-implicit')fail('INVALID_COMBINATION',`${p}.category`);
    if((m.stat==='loot.local.damage'||m.stat==='native.weapon-enchant'||m.stat==='native.runic-power') && !classes.includes('weapon'))fail('INVALID_COMBINATION',`${p}.stat`);
    if((m.stat==='loot.local.armor'||m.stat==='native.armor-runic-power') && !classes.includes('armor'))fail('INVALID_COMBINATION',`${p}.stat`);
    if(m.stat==='loot.ring-implicit' && !classes.includes('ring'))fail('INVALID_COMBINATION',`${p}.stat`);
    const isRunic = ['native.runic-power','native.armor-runic-power'].includes(m.stat);
    if(isRunic !== (m.runicType!==undefined))fail('INVALID_COMBINATION',`${p}.runicType`);
    if(isRunic && (m.unit!=='runic-strength'||m.category!=='flat'))fail('INVALID_COMBINATION',`${p}.unit`);
    if(m.runicType && !(m.stat==='native.runic-power'?WEAPON_RUNES:ARMOR_RUNES).includes(m.runicType))fail('INVALID_COMBINATION',`${p}.runicType`);
    if(['increased','more','local-increased'].includes(m.category) && m.unit!=='bp')fail('INVALID_COMBINATION',`${p}.unit`);
    if(m.conditions && m.stat!=='native.physical-damage-dealt')fail('INVALID_COMBINATION',`${p}.conditions`);
  });
}

/** Literal §8.1 conservative sum, including the mutually exclusive unique and affix paths. */
export function computeStaticDrawBudget(pack: LootPack): { perItem: number; perEvent: number } {
  const active = pack.affixes.affixes.filter(a=>a.rune===null);
  const maxValues = Math.max(0,...active.filter(a=>a.polarity===1).flatMap(a=>a.tiers.map(t=>t.ranges.filter(([l,h])=>l!==h).length)));
  const maxNegativeValues = Math.max(0,...active.filter(a=>a.polarity===-1).flatMap(a=>a.tiers.map(t=>t.ranges.filter(([l,h])=>l!==h).length)));
  const slots = Math.max(0,...pack.presets.presets.flatMap(p=>[...p.affixCount.magic,...p.affixCount.rare,...p.affixCount.rareHighIlvl.table].map(x=>x.n)));
  const uniqueValues = Math.max(0,...[...pack.uniques.uniques,...pack.sets.sets.flatMap(s=>s.pieces)].map(u=>u.rows.reduce((n,r)=>n+r.ranges.filter(([l,h])=>l!==h).length,0)));
  const affixPath = 1 + slots*(3+maxValues) + (4+maxNegativeValues+maxValues) + 2;
  const uniquePath = 1 + uniqueValues;
  const perItem = 3 + affixPath + uniquePath + 1; // terminal normal socket draw
  return { perItem, perEvent: 2+8*perItem+2+2 }; // conservative equipment bound + material probability/choice + gold
}

export function collectLootLocaleKeys(value: unknown, output = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach(child=>collectLootLocaleKeys(child,output));
  else if (value && typeof value==='object') for(const [k,v] of Object.entries(value)) {
    if(['nameKey','descriptionKey','textKey','titleKey','unavailableKey','altKey','reasonKey','labelKey'].includes(k) && typeof v==='string') output.add(v);
    else collectLootLocaleKeys(v,output);
  }
  return output;
}
export function validateLootLocale(pack: LootPack, locale: unknown): void {
  if(!locale || typeof locale!=='object'||Array.isArray(locale))fail('INVALID_TYPE','locale');
  const references=collectLootLocaleKeys(pack);
  references.add('ext.loot.module.name'); references.add('ext.loot.module.description');
  const values=locale as Record<string,unknown>;
  for(const key of references) if(!Object.prototype.hasOwnProperty.call(values,key))fail('LOCALE_MISSING',`locale.${key}`);
  for(const k of Reflect.ownKeys(values)){
    if(typeof k!=='string')fail('UNKNOWN_FIELD',`locale.${String(k)}`);
    const descriptor=Object.getOwnPropertyDescriptor(values,k)!;
    if(!descriptor.enumerable||!('value' in descriptor))fail('INVALID_TYPE',`locale.${k}`,'Expected enumerable data property');
  }
  for(const [k,v] of Object.entries(values)) {
    if(!k.startsWith('ext.loot.'))fail('INVALID_VALUE',`locale.${k}`);
    if(!references.has(k))fail('LOCALE_UNUSED',`locale.${k}`);
    if(typeof v!=='string'||!v.trim()||/TODO/i.test(v))fail('INVALID_VALUE',`locale.${k}`);
  }
}
export function assertLootPack(value: unknown, locale: unknown = zhCN): asserts value is LootPack {
  if(!value||typeof value!=='object'||Array.isArray(value))fail('INVALID_TYPE','pack');
  const raw=value as Record<string,unknown>;
  for(const k of LOOT_FILE_NAMES)if(!Object.prototype.hasOwnProperty.call(raw,k))fail('MISSING_FILE',k);
  for(const k of Reflect.ownKeys(raw)){
    if(typeof k!=='string'||!LOOT_FILE_NAMES.includes(k as keyof LootPack))fail('UNKNOWN_FIELD',String(k));
    const descriptor=Object.getOwnPropertyDescriptor(raw,k)!;
    if(!descriptor.enumerable||!('value' in descriptor))fail('INVALID_TYPE',k,'Expected enumerable data property');
  }
  // Validate structure before the JSON guard so callers receive the most precise field path.
  for(const k of LOOT_FILE_NAMES)schemas[k](raw[k],k);
  if(!isJson(value))fail('INVALID_TYPE','pack','Expected acyclic plain JSON');
  const p=value as unknown as LootPack;
  if(p.ilvl.min>p.ilvl.max)fail('INVALID_RANGE','ilvl.min');
  if(p.ilvl.siteIlvl<p.ilvl.min||p.ilvl.siteIlvl>p.ilvl.max)fail('INVALID_RANGE','ilvl.siteIlvl');
  increasing(p.tiers.tiers.map(t=>t.minIlvl),'tiers.tiers','minIlvl');
  p.tiers.tiers.forEach((t,i)=>{if(t.tier!==i+1)fail('INVALID_RANGE',`tiers.tiers[${i}].tier`);});
  if(p.tiers.window.weightsHighToLow[0]===0)fail('MISSING_CANDIDATE','tiers.window.weightsHighToLow[0]');
  if(p.tiers.window.weightsHighToLow.length!==p.tiers.window.size||!p.tiers.window.weightsHighToLow.some(w=>w>0))fail('INVALID_COMBINATION','tiers.window.weightsHighToLow');
  const bands=p.bases.ilvlBands;
  bands.forEach((b,i)=>{if(b.minIlvl!==(i===0?1:bands[i-1]!.maxIlvl+1)||b.maxIlvl<b.minIlvl)fail('INVALID_RANGE',`bases.ilvlBands[${i}]`);});
  if(bands[bands.length-1]!.maxIlvl!==99)fail('INVALID_RANGE',`bases.ilvlBands[${bands.length-1}].maxIlvl`);
  for(const [k,weights]of Object.entries(p.bases.weaponTierWeights))if(weights.length!==bands.length)fail('INVALID_COMBINATION',`bases.weaponTierWeights.${k}`);
  p.bases.armors.forEach((a,i)=>{if(a.weights.length!==bands.length)fail('INVALID_COMBINATION',`bases.armors[${i}].weights`);});
  if(p.bases.ringImplicit.min>p.bases.ringImplicit.max)fail('INVALID_RANGE','bases.ringImplicit.min');
  const baseClass=new Map<string,ItemClass>();
  const nativeBases: Record<ItemClass,Set<string>>={weapon:new Set(weapons.map(w=>w.id)),armor:new Set(armors.map(a=>a.id)),ring:new Set(arcana.rings.map(r=>r.id))};
  for(const [group,cls]of [['weapons','weapon'],['armors','armor'],['rings','ring']] as const) {
    p.bases[group].forEach((b,i)=>{if(!nativeBases[cls].has(b.baseId))fail('INVALID_REFERENCE',`bases.${group}[${i}].baseId`);if(baseClass.has(b.baseId))fail('DUPLICATE_ID',`bases.${group}[${i}].baseId`);baseClass.set(b.baseId,cls);});
  }
  bands.forEach((_,i)=>{
    if(!p.bases.weapons.some(w=>p.bases.weaponTierWeights[w.tier][i]!>0))fail('MISSING_CANDIDATE',`bases.weaponTierWeights[${i}]`);
    if(!p.bases.armors.some(a=>a.weights[i]!>0))fail('MISSING_CANDIDATE',`bases.armors[${i}].weights`);
  });
  if(!p.bases.rings.some(r=>r.weight>0))fail('MISSING_CANDIDATE','bases.rings');
  unique(p.rarities.rarities.map(r=>r.id),'rarities.rarities','.id');
  const rarityMap=new Map(p.rarities.rarities.map(r=>[r.id,r]));
  p.rarities.rarities.forEach((r,i)=>{
    if(r.id!==RARITIES[i]||r.order!==i)fail('INVALID_COMBINATION',`rarities.rarities[${i}].order`);
    if(r.affixes && r.affixes.prefixMax+r.affixes.suffixMax>6)fail('BUDGET',`rarities.rarities[${i}].affixes`);
    if((['normal','magic','rare'].includes(r.id)) !== (r.affixes!==null))fail('INVALID_COMBINATION',`rarities.rarities[${i}].affixes`);
    if(p.enhancement.caps[r.id]!==r.enhancementCap)fail('INVALID_COMBINATION',`enhancement.caps.${r.id}`);
    if(r.droppable!==(r.id!=='runeword'))fail('INVALID_COMBINATION',`rarities.rarities[${i}].droppable`);
  });
  unique(p.affixes.affixes.map(a=>a.id),'affixes.affixes','.id');
  const affixMap=new Map(p.affixes.affixes.map(a=>[a.id,a]));
  const groupPosition=new Map<string,string>();
  p.affixes.affixes.forEach((a,i)=>{
    const path=`affixes.affixes[${i}]`;
    if(!a.id.startsWith('loot.affix.'))fail('INVALID_VALUE',`${path}.id`);
    unique(a.itemClasses,`${path}.itemClasses`);
    if(a.itemClasses.some((c,j)=>j>0&&CLASSES.indexOf(c)<=CLASSES.indexOf(a.itemClasses[j-1]!)))fail('INVALID_COMBINATION',`${path}.itemClasses`);
    if(a.maxTier!==a.tiers.length)fail('INVALID_COMBINATION',`${path}.maxTier`);
    a.tiers.forEach((t,j)=>{
      if(t.tier!==j+1)fail('INVALID_RANGE',`${path}.tiers[${j}].tier`);
      if(!p.tiers.tiers.some(x=>x.tier===t.tier))fail('INVALID_REFERENCE',`${path}.tiers[${j}].tier`);
      if(t.ranges.length!==a.tiers[0]!.ranges.length)fail('INVALID_COMBINATION',`${path}.tiers[${j}].ranges`);
      validateModifiers(a.modifiers,t.ranges,`${path}.modifiers`,a.itemClasses);
      if(a.polarity===-1&&t.ranges.some(([lo,hi])=>lo!==hi))fail('INVALID_COMBINATION',`${path}.tiers[${j}].ranges`,'Negative values must be constant');
    });
    if((a.requires===null)!==(a.fallback===null))fail('INVALID_COMBINATION',`${path}.fallback`);
    if(a.requires && (!a.requires.key.startsWith(a.requires.module+'.') || ![...STATS,'growth.attribute'].includes(a.requires.key)))fail('INVALID_REFERENCE',`${path}.requires.key`);
    if(a.expand && a.id!=='loot.affix.adept')fail('INVALID_COMBINATION',`${path}.expand`);
    if(a.expand && (!a.requires||a.requires.module!=='growth'||a.requires.key!=='growth.attribute'))fail('INVALID_COMBINATION',`${path}.requires`);
    if(a.modifiers.some(m=>m.stat==='growth.attribute:{attribute}') && !a.expand)fail('INVALID_COMBINATION',`${path}.expand`);
    if(a.fallback?.kind==='replace') {
      const f=affixMap.get(a.fallback.affixId);
      if(!f||f.polarity!==1||f.requires!==null||f.rune!==null||!a.itemClasses.some(c=>f.itemClasses.includes(c)))fail('INVALID_REFERENCE',`${path}.fallback.affixId`);
    }
    if((a.group==='rune')!==(a.rune!==null))fail('INVALID_COMBINATION',`${path}.rune`);
    if(a.rune) {
      if(a.position!=='suffix'||a.itemClasses.length!==1||a.itemClasses[0]!==a.rune.slot)fail('INVALID_COMBINATION',`${path}.rune.slot`);
      if(!(a.rune.slot==='weapon'?WEAPON_RUNES:ARMOR_RUNES).includes(a.rune.runicType))fail('INVALID_COMBINATION',`${path}.rune.runicType`);
      if(a.modifiers.some(m=>m.runicType!==a.rune!.runicType))fail('INVALID_COMBINATION',`${path}.modifiers`);
    } else {
      if(groupPosition.has(a.group)&&groupPosition.get(a.group)!==a.position)fail('INVALID_COMBINATION',`${path}.position`);
      groupPosition.set(a.group,a.position);
      if(a.modifiers.some(m=>m.runicType!==undefined))fail('INVALID_COMBINATION',`${path}.modifiers`);
    }
    if(a.polarity===-1&&!p.affixes.affixes.some(other=>other.group===a.group&&other.polarity===1))fail('INVALID_REFERENCE',`${path}.group`);
  });
  for(const c of CLASSES)for(const [i,band]of bands.entries()) {
    const candidates=p.affixes.affixes.filter(a=>a.polarity===1&&a.rune===null&&a.itemClasses.includes(c)&&a.weight>0&&a.tiers.some(t=>p.tiers.tiers.some(g=>g.tier===t.tier&&g.enabled&&g.minIlvl<=band.minIlvl)));
    // Also require a candidate with optional modules absent: replacement resolves to an ordinary positive affix.
    if(!candidates.some(a=>a.requires===null || (a.fallback?.kind==='replace'&&affixMap.get(a.fallback.affixId)!.itemClasses.includes(c))))fail('MISSING_CANDIDATE',`affixes.itemClasses.${c}.ilvlBands[${i}]`);
  }
  unique(p.uniques.uniques.map(u=>u.id),'uniques.uniques','.id');
  const rowIds=new Set<string>();
  p.uniques.uniques.forEach((u,i)=>{
    const path=`uniques.uniques[${i}]`,cls=baseClass.get(u.baseId);
    if(!u.id.startsWith('loot.unique.'))fail('INVALID_VALUE',`${path}.id`);
    if(!cls)fail('INVALID_REFERENCE',`${path}.baseId`);
    u.rows.forEach((r,j)=>{
      if(rowIds.has(r.rowId))fail('DUPLICATE_ID',`${path}.rows[${j}].rowId`);rowIds.add(r.rowId);
      if(r.rowId!==`${u.id}.r${j}`)fail('INVALID_REFERENCE',`${path}.rows[${j}].rowId`);
      validateModifiers(r.modifiers,r.ranges,`${path}.rows[${j}].modifiers`,[cls]);
    });
  });
  unique(p.sets.sets.map(s=>s.id),'sets.sets');
  unique(p.sets.sets.flatMap(s=>s.pieces.map(p=>p.id)),'sets.pieces');
  if(p.uniques.uniques.length+p.sets.sets.reduce((n,s)=>n+s.pieces.length,0)>128)fail('BUDGET','sets.receipts');
  p.sets.sets.forEach((set,i)=>{
    const path=`sets.sets[${i}]`;
    if(!set.id.startsWith('loot.set.'))fail('INVALID_VALUE',path);
    const checkRows=(rows:typeof set.pieces[number]['rows'],prefix:string,classes:ItemClass[],constant:boolean)=>{
      rows.forEach((r,j)=>{
        if(rowIds.has(r.rowId))fail('DUPLICATE_ID',prefix);rowIds.add(r.rowId);
        if(r.rowId!==`${prefix}.r${j}`)fail('INVALID_REFERENCE',prefix);
        validateModifiers(r.modifiers,r.ranges,prefix,classes);
        if(r.modifiers.some(m=>m.runicType||m.stat.startsWith('growth.')||m.stat.startsWith('combat.')||m.stat==='loot.ring-implicit'))fail('INVALID_COMBINATION',prefix);
        if(constant&&r.ranges.some(([lo,hi])=>lo!==hi))fail('INVALID_RANGE',prefix);
      });
    };
    for(const piece of set.pieces){
      const cls=baseClass.get(piece.baseId);
      if(!cls)fail('INVALID_REFERENCE',path);
      if(!piece.id.startsWith('loot.piece.'))fail('INVALID_VALUE',path);
      checkRows(piece.rows,piece.id,[cls],false);
    }
    set.bonuses.forEach((bonus,j)=>{
      if(bonus.count>set.pieces.length||(j>0&&bonus.count<=set.bonuses[j-1]!.count))fail('INVALID_COMBINATION',path);
      checkRows(bonus.rows,`${set.id}.b${bonus.count}`,['weapon','armor','ring'],true);
      if(bonus.rows.some(r=>r.modifiers.some(m=>m.category.startsWith('local-')||m.stat==='native.weapon-enchant')))fail('INVALID_COMBINATION',path);
    });
    // Conservative worst anchor: all cumulative bonuses plus its fixed and enhancement rows.
    const expanded=(rows:typeof set.pieces[number]['rows'])=>rows.reduce((n,r)=>n+r.modifiers.reduce((n,m)=>n+(m.stat==='loot.local.damage'&&m.category==='local-increased'?2:1),0),0);
    const rewards=set.bonuses.reduce((n,b)=>n+expanded(b.rows),0);
    // projectItemModifiers -> lootStatSources: weapon damage-min/max + enchant;
    // armor max-hp + defense; ring implicit/enhancement stay in native enchant
    // and adaptLootModifier omits both. Even zero-valued weapon/armor rows count.
    const enhancementRows:Record<ItemClass,number>={weapon:3,armor:2,ring:0};
    if(set.pieces.some(piece=>expanded(piece.rows)+rewards
      +(p.enhancement.caps.set>0?enhancementRows[baseClass.get(piece.baseId)!]:0)>24))fail('BUDGET',path);
  });
  // C2 finite catalogs: validate once, then use immutable indexed lookup.
  unique(p.runes.runes.map(r=>r.id),'runes.runes');
  unique(p.runewords.words.map(w=>w.id),'runewords.words');
  unique(p.sockets.bases.map(b=>b.baseId),'sockets.bases');
  const runeMap=new Map(p.runes.runes.map(r=>[r.id,r]));
  const expandedRows=(rows:typeof p.runes.runes[number]['rows'])=>rows.reduce((n,r)=>n+r.modifiers.reduce((n,m)=>n+(m.stat==='loot.local.damage'&&m.category==='local-increased'?2:1),0),0);
  const socketRows=(rows:typeof p.runes.runes[number]['rows'],prefix:string,classes:ItemClass[])=>{
    rows.forEach((r,j)=>{
      if(rowIds.has(r.rowId))fail('DUPLICATE_ID',prefix);rowIds.add(r.rowId);
      if(r.rowId!==`${prefix}.r${j}`)fail('INVALID_REFERENCE',prefix);
      validateModifiers(r.modifiers,r.ranges,prefix,classes);
      if(r.ranges.some(([lo,hi])=>lo!==hi))fail('INVALID_RANGE',prefix);
      if(r.modifiers.some(m=>m.runicType||m.stat.startsWith('growth.')||m.stat.startsWith('combat.')||m.stat==='loot.ring-implicit'))fail('INVALID_COMBINATION',prefix);
    });
  };
  for(const rune of p.runes.runes){
    if(!rune.id.startsWith('loot.rune.'))fail('INVALID_VALUE',rune.id);
    unique(rune.itemClasses,rune.id);socketRows(rune.rows,rune.id,rune.itemClasses);
    if(expandedRows(rune.rows)*4>24)fail('BUDGET',rune.id);
  }
  const wordKeys=new Set<string>();
  for(const word of p.runewords.words){
    if(!word.id.startsWith('loot.word.'))fail('INVALID_VALUE',word.id);
    unique(word.baseClasses,word.id);
    if(word.sequence.length!==word.sockets)fail('INVALID_COMBINATION',word.id);
    if(word.sequence.some(id=>!runeMap.has(id)||word.baseClasses.some(c=>!runeMap.get(id)!.itemClasses.includes(c))))fail('INVALID_REFERENCE',word.id);
    for(const cls of word.baseClasses){const key=JSON.stringify([cls,word.sockets,word.sequence]);if(wordKeys.has(key))fail('INVALID_COMBINATION',word.id);wordKeys.add(key);}
    socketRows(word.rows,word.id,word.baseClasses);
    if(expandedRows(word.rows)>24)fail('BUDGET',word.id);
  }
  if(p.enhancement.caps.runeword!==0)fail('INVALID_COMBINATION','enhancement.caps.runeword');
  const socketBases=[...baseClass].filter(([,c])=>c!=='ring').map(([id])=>id);
  if(socketBases.length!==p.sockets.bases.length)fail('INVALID_REFERENCE','sockets.bases');
  for(const base of p.sockets.bases){
    if(!socketBases.includes(base.baseId))fail('INVALID_REFERENCE','sockets.bases');
    base.bands.forEach((b,i)=>{if(b.minIlvl!==(i===0?1:base.bands[i-1]!.maxIlvl+1)||b.maxIlvl<b.minIlvl||!b.weights.some(w=>w>0))fail('INVALID_RANGE',base.baseId);});
    if(base.bands[base.bands.length-1]!.maxIlvl!==99)fail('INVALID_RANGE',base.baseId);
  }
  unique(p.runeDrops.rows.map(r=>r.id),'runeDrops.rows');
  unique(p.runeDrops.rows.map(r=>`${r.presetId}/${r.source}`),'runeDrops.match');
  for(const row of p.runeDrops.rows){
    if(!p.presets.presets.some(p=>p.id===row.presetId)||row.runeIds.some(id=>!runeMap.has(id)))fail('INVALID_REFERENCE',row.id);
    unique(row.runeIds,row.id);
    if(row.runeIds.some((id,i)=>i>0&&id<=row.runeIds[i-1]!))fail('INVALID_COMBINATION',row.id);
    if(!row.runeIds.some(id=>runeMap.get(id)!.weight>0&&runeMap.get(id)!.minIlvl<=p.ilvl.min))fail('MISSING_CANDIDATE',row.id);
  }
  for(const preset of p.presets.presets){
    const material=(source:string)=>p.runeDrops.rows.some(r=>r.presetId===preset.id&&r.source===source&&r.chanceBp>0)?1:0;
    if(preset.encounter.count+material('encounter')>8||preset.maxPerKill+material('kill')>8)fail('BUDGET','runeDrops.proposals');
  }
  p.uniques.bossUniqueBias.forEach((b,i)=>{if(!p.uniques.uniques.some(u=>u.id===b.uniqueId))fail('INVALID_REFERENCE',`uniques.bossUniqueBias[${i}].uniqueId`);});
  unique(p.monsterClasses.classes,'monsterClasses.classes');
  unique(p.monsterClasses.members.map(m=>m.typeId),'monsterClasses.members','.typeId');
  p.monsterClasses.members.forEach((m,i)=>{if(!p.monsterClasses.classes.includes(m.class))fail('INVALID_REFERENCE',`monsterClasses.members[${i}].class`);});
  unique(p.dropTables.tables.map(t=>t.id),'dropTables.tables','.id');
  p.dropTables.tables.forEach((t,i)=>{
    const path=`dropTables.tables[${i}]`;
    if(!Object.values(t.classWeights).some(w=>w>0))fail('MISSING_CANDIDATE',`${path}.classWeights`);
    if(t.match.source==='kill'&&Array.isArray(t.count)&&p.presets.presets.some(pr=>(t.count as [number,number])[0] > pr.maxPerKill))fail('INVALID_COMBINATION',`${path}.count`);
    if(t.count==='preset-encounter'&&t.match.source!=='encounter')fail('INVALID_COMBINATION',`${path}.count`);
    if(t.minRarity!==null&&!rarityMap.get(t.minRarity)!.droppable)fail('INVALID_REFERENCE',`${path}.minRarity`);
  });
  for(const depth of [1,99])if(p.gold.amount.minBase+p.gold.amount.minPerDepth*depth>p.gold.amount.maxBase+p.gold.amount.maxPerDepth*depth)fail('INVALID_RANGE','gold.amount');
  unique(p.presets.presets.map(x=>x.id),'presets.presets','.id');
  p.presets.presets.forEach((preset,i)=>{
    const path=`presets.presets[${i}]`;
    if(!Object.values(preset.rarityWeights).some(w=>w>0))fail('MISSING_CANDIDATE',`${path}.rarityWeights`);
    for(const r of ['magic','rare'] as const) {
      const quota=rarityMap.get(r)!.affixes!;
      const check=(rows:{n:number;w:number}[],suffix:string)=>{
        unique(rows.map(x=>String(x.n)),`${path}.${suffix}`,'.n');
        if(!rows.some(x=>x.w>0))fail('MISSING_CANDIDATE',`${path}.${suffix}`);
        rows.forEach((x,j)=>{if(x.n>quota.prefixMax+quota.suffixMax)fail('INVALID_COMBINATION',`${path}.${suffix}[${j}].n`);});
      };
      check(preset.affixCount[r],`affixCount.${r}`);
      if(r==='rare')check(preset.affixCount.rareHighIlvl.table,'affixCount.rareHighIlvl.table');
    }
    for(const [where,r]of [['encounter.firstMinRarity',preset.encounter.firstMinRarity],['encounter.restMinRarity',preset.encounter.restMinRarity],['vault.minRarity',preset.vault.minRarity],['vault.highValueMinRarity',preset.vault.highValueMinRarity]] as [string,RarityId][])if(!rarityMap.get(r)!.droppable)fail('INVALID_REFERENCE',`${path}.${where}`);
    const minima = [preset.encounter.firstMinRarity,preset.encounter.restMinRarity,preset.vault.minRarity,preset.vault.highValueMinRarity,
      ...p.dropTables.tables.map(t=>t.minRarity).filter((r): r is RarityId=>r!==null)];
    for(const min of minima)if(!p.rarities.rarities.some(r=>r.droppable&&r.order>=rarityMap.get(min)!.order&&r.id!=='runeword'&&preset.rarityWeights[r.id]>0))fail('MISSING_CANDIDATE',`${path}.rarityWeights`);
    const requirePool=(min:RarityId|null,uniqueBp:number,bonus:number,where:string)=>{
      const weights=computeRarityWeights(preset,p.ilvl.min,bonus,uniqueBp,0,min);
      if(!Object.values(weights).some(w=>w>0))fail('MISSING_CANDIDATE',`${path}.${where}`);
    };
    requirePool(null,10000,0,'rarityWeights');
    requirePool(preset.vault.minRarity,10000,0,'vault.minRarity');
    requirePool(preset.vault.highValueMinRarity,10000,0,'vault.highValueMinRarity');
    requirePool(preset.encounter.firstMinRarity,preset.encounter.uniqueWeightBp,0,'encounter.uniqueWeightBp');
    requirePool(preset.encounter.restMinRarity,preset.encounter.uniqueWeightBp,0,'encounter.uniqueWeightBp');
    for(const table of p.dropTables.tables)requirePool(table.minRarity,table.match.source==='encounter'?preset.encounter.uniqueWeightBp:10000,table.rarityBonusBp,'rarityWeights');
    if(preset.monsterScaling[0]!.depth!==1)fail('INVALID_RANGE',`${path}.monsterScaling[0].depth`);
    increasing(preset.monsterScaling.map(a=>a.depth),`${path}.monsterScaling`,'depth');
  });
  unique(p.corruption.eligibleRarities,'corruption.eligibleRarities');
  unique(p.identify.firstTriggerReveal.excludedStats,'identify.firstTriggerReveal.excludedStats');
  unique(p.caps.caps.map(c=>c.stat),'caps.caps','.stat');
  p.caps.caps.forEach((c,i)=>{if(c.min===undefined&&c.max===undefined)fail('INVALID_COMBINATION',`caps.caps[${i}]`);if(c.min!==undefined&&c.max!==undefined&&c.min>c.max)fail('INVALID_RANGE',`caps.caps[${i}]`);});
  // Every multiplication executed before a floor must remain exact at maximal input depth.
  const safeProduct=(values:number[],path:string)=>{let n=1;for(const x of values){n*=x;if(!Number.isSafeInteger(n))fail('INVALID_VALUE',path,'Unsafe arithmetic intermediate');}return n;};
  p.presets.presets.forEach((preset,i)=>{
    const path=`presets.presets[${i}]`;
    const maxGold=Math.max(p.gold.amount.minBase+p.gold.amount.minPerDepth*99,p.gold.amount.maxBase+p.gold.amount.maxPerDepth*99);
    for(const entry of [...Object.values(p.gold.byClass),p.gold.encounter])safeProduct([maxGold,entry.multiplier,preset.goldMultiplierBp],`${path}.goldMultiplierBp`);
    const bonus=Math.max(0,...p.dropTables.tables.map(t=>t.rarityBonusBp))+p.monsterClasses.modifiers.champion.rarityBonusBp;
    const find=preset.rarityFind.cap===0?0:Math.floor(safeProduct([preset.rarityFind.cap,preset.rarityFind.k],`${path}.rarityFind`)/(preset.rarityFind.cap+preset.rarityFind.k));
    for(const r of ['normal','magic','rare','unique','set'] as const){
      let w=Math.floor(safeProduct([preset.rarityWeights[r],10000+preset.rarityIlvlScalingBp[r]*99],`${path}.rarityWeights.${r}`)/10000);
      if(r!=='normal')w=Math.floor(safeProduct([w,10000+bonus],`${path}.rarityWeights.${r}`)/10000);
      if(r==='unique')w=Math.floor(safeProduct([w,Math.max(10000,preset.encounter.uniqueWeightBp)],`${path}.encounter.uniqueWeightBp`)/10000);
      if(r!=='normal')safeProduct([w,10000+find],`${path}.rarityWeights.${r}`);
    }
  });
  const budget=computeStaticDrawBudget(p);
  if(budget.perItem>64||budget.perEvent>512)fail('DRAW_BUDGET','pack.drawBudget',`${budget.perItem}/${budget.perEvent}`);
  validateLootLocale(p,locale);
}
export function deepFreeze<T>(value: T): T {
  if(value && typeof value==='object' && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(child=>deepFreeze(child));
  }
  return value;
}
