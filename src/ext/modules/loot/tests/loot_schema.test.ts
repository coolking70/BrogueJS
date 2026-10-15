import { describe, expect, it } from 'vitest';
import { loadLootPack } from '../definitions';
import { assertLootPack, computeStaticDrawBudget, validateLootLocale } from '../schema';
import { LootDataError } from '../errors';
import type { LootDataErrorCode } from '../errors';
import locale from '../locales/zh_CN.json';

type Mutable = Record<string, any>;
type Negative = [string, (p:Mutable,l:Mutable)=>void, LootDataErrorCode, string];
const negatives: Negative[] = [
  ['missing file',p=>delete p.gold,'MISSING_FILE','gold'],
  ['wrong schema',p=>p.ilvl.schema=2,'INVALID_SCHEMA','ilvl.schema'],
  ['unknown root file',p=>p.extra={},'UNKNOWN_FIELD','extra'],
  ['unknown file field',p=>p.ilvl.extra=0,'UNKNOWN_FIELD','ilvl.extra'],
  ['unknown inherited-name field',p=>p.ilvl.toString='bad','UNKNOWN_FIELD','ilvl.toString'],
  ['unknown nested field',p=>p.affixes.affixes[0].tiers[0].surprise=1,'UNKNOWN_FIELD','affixes.affixes[0].tiers[0].surprise'],
  ['unsafe integer',p=>p.ilvl.championBonus=Number.MAX_SAFE_INTEGER+1,'INVALID_TYPE','ilvl.championBonus'],
  ['fraction',p=>p.ilvl.championBonus=1.5,'INVALID_TYPE','ilvl.championBonus'],
  ['NaN',p=>p.ilvl.championBonus=NaN,'INVALID_TYPE','ilvl.championBonus'],
  ['negative weight',p=>p.affixes.affixes[0].weight=-1,'INVALID_VALUE','affixes.affixes[0].weight'],
  ['weight above 10000',p=>p.affixes.affixes[0].weight=10001,'INVALID_VALUE','affixes.affixes[0].weight'],
  ['257 affixes',p=>p.affixes.affixes=Array(257).fill(p.affixes.affixes[0]),'BUDGET','affixes.affixes'],
  ['9 affix tiers',p=>p.affixes.affixes[0].tiers=Array(9).fill(p.affixes.affixes[0].tiers[0]),'BUDGET','affixes.affixes[0].tiers'],
  ['max tier seven',p=>p.affixes.affixes[0].maxTier=7,'INVALID_VALUE','affixes.affixes[0].maxTier'],
  ['five values',p=>p.affixes.affixes[0].tiers[0].ranges=Array(5).fill([1,2]),'BUDGET','affixes.affixes[0].tiers[0].ranges'],
  ['129 unique items',p=>p.uniques.uniques=Array(129).fill(p.uniques.uniques[0]),'BUDGET','uniques.uniques'],
  ['nine unique rows',p=>p.uniques.uniques[0].rows=Array(9).fill(p.uniques.uniques[0].rows[0]),'BUDGET','uniques.uniques[0].rows'],
  ['257 drop tables',p=>p.dropTables.tables=Array(257).fill(p.dropTables.tables[0]),'BUDGET','dropTables.tables'],
  ['nine presets',p=>p.presets.presets=Array(9).fill(p.presets.presets[0]),'BUDGET','presets.presets'],
  ['zero maxPerKill',p=>p.presets.presets[0].maxPerKill=0,'INVALID_VALUE','presets.presets[0].maxPerKill'],
  ['nine maxPerKill',p=>p.presets.presets[0].maxPerKill=9,'INVALID_VALUE','presets.presets[0].maxPerKill'],
  ['zero encounter count',p=>p.presets.presets[0].encounter.count=0,'INVALID_VALUE','presets.presets[0].encounter.count'],
  ['nine encounter count',p=>p.presets.presets[0].encounter.count=9,'INVALID_VALUE','presets.presets[0].encounter.count'],
  ['drop max count nine',p=>p.dropTables.tables[0].count=[1,9],'INVALID_VALUE','dropTables.tables[0].count[1]'],
  ['reversed range',p=>p.affixes.affixes[0].tiers[0].ranges[0]=[9,1],'INVALID_RANGE','affixes.affixes[0].tiers[0].ranges[0]'],
  ['non-contiguous tiers',p=>p.affixes.affixes[0].tiers[1].tier=3,'INVALID_RANGE','affixes.affixes[0].tiers[1].tier'],
  ['repeated tier',p=>p.affixes.affixes[0].tiers[1].tier=1,'INVALID_RANGE','affixes.affixes[0].tiers[1].tier'],
  ['repeated unlock threshold',p=>p.tiers.tiers[1].minIlvl=1,'INVALID_RANGE','tiers.tiers[1].minIlvl'],
  ['gap in bands',p=>p.bases.ilvlBands[1].minIlvl=13,'INVALID_RANGE','bases.ilvlBands[1]'],
  ['bands end before 99',p=>p.bases.ilvlBands[2].maxIlvl=98,'INVALID_RANGE','bases.ilvlBands[2].maxIlvl'],
  ['scaling repeated anchor',p=>p.presets.presets[0].monsterScaling[1].depth=1,'INVALID_RANGE','presets.presets[0].monsterScaling[1].depth'],
  ['scaling starts at two',p=>p.presets.presets[0].monsterScaling[0].depth=2,'INVALID_RANGE','presets.presets[0].monsterScaling[0].depth'],
  ['unknown native base',p=>p.bases.weapons[0].baseId='missing','INVALID_REFERENCE','bases.weapons[0].baseId'],
  ['unique unknown base',p=>p.uniques.uniques[0].baseId='missing','INVALID_REFERENCE','uniques.uniques[0].baseId'],
  ['unique wrong class',p=>p.uniques.uniques[0].baseId='leather_armor','INVALID_COMBINATION','uniques.uniques[0].rows[0].modifiers[0].stat'],
  ['boss unknown unique',p=>p.uniques.bossUniqueBias[0].uniqueId='loot.unique.missing','INVALID_REFERENCE','uniques.bossUniqueBias[0].uniqueId'],
  ['fallback unknown affix',p=>p.affixes.affixes[22].fallback.affixId='loot.affix.missing','INVALID_REFERENCE','affixes.affixes[22].fallback.affixId'],
  ['fallback negative target',p=>p.affixes.affixes[22].fallback.affixId='loot.affix.brittle','INVALID_REFERENCE','affixes.affixes[22].fallback.affixId'],
  ['fallback dependent target',p=>p.affixes.affixes[22].fallback.affixId='loot.affix.steadfast','INVALID_REFERENCE','affixes.affixes[22].fallback.affixId'],
  ['fallback disjoint class',p=>p.affixes.affixes[22].fallback.affixId='loot.affix.keen','INVALID_REFERENCE','affixes.affixes[22].fallback.affixId'],
  ['fallback rune target',p=>p.affixes.affixes[22].fallback.affixId='loot.affix.rune-a-reflection','INVALID_REFERENCE','affixes.affixes[22].fallback.affixId'],
  ['requires without fallback',p=>p.affixes.affixes[22].fallback=null,'INVALID_COMBINATION','affixes.affixes[22].fallback'],
  ['fallback without requires',p=>p.affixes.affixes[22].requires=null,'INVALID_COMBINATION','affixes.affixes[22].fallback'],
  ['expand outside adept',p=>p.affixes.affixes[0].expand={kind:'growth-attributes'},'INVALID_COMBINATION','affixes.affixes[0].expand'],
  ['duplicate affix ID',p=>p.affixes.affixes[1].id=p.affixes.affixes[0].id,'DUPLICATE_ID','affixes.affixes[1].id'],
  ['group position mismatch',p=>p.affixes.affixes[29].position='suffix','INVALID_COMBINATION','affixes.affixes[29].position'],
  ['rune group lacking rune',p=>p.affixes.affixes[35].rune=null,'INVALID_COMBINATION','affixes.affixes[35].rune'],
  ['rune metadata outside group',p=>p.affixes.affixes[35].group='other','INVALID_COMBINATION','affixes.affixes[35].rune'],
  ['negative group orphan',p=>p.affixes.affixes[29].group='orphan','INVALID_REFERENCE','affixes.affixes[29].group'],
  ['empty item classes',p=>p.affixes.affixes[0].itemClasses=[],'INVALID_VALUE','affixes.affixes[0].itemClasses'],
  ['duplicate item classes',p=>p.affixes.affixes[0].itemClasses=['weapon','weapon'],'DUPLICATE_ID','affixes.affixes[0].itemClasses[1]'],
  ['unknown class',p=>p.affixes.affixes[0].itemClasses=['shield'],'INVALID_VALUE','affixes.affixes[0].itemClasses[0]'],
  ['no positive eligible weapon',p=>p.affixes.affixes.forEach((a:Mutable)=>{if(a.polarity===1&&a.itemClasses.includes('weapon'))a.weight=0;}),'MISSING_CANDIDATE','affixes.itemClasses.weapon.ilvlBands[0]'],
  ['seven affix slots',p=>p.rarities.rarities[2].affixes.prefixMax=4,'BUDGET','rarities.rarities[2].affixes'],
  ['magic count exceeds slots',p=>p.presets.presets[0].affixCount.magic[1].n=3,'INVALID_COMBINATION','presets.presets[0].affixCount.magic[1].n'],
  ['affix count zero',p=>p.presets.presets[0].affixCount.magic[0].n=0,'INVALID_VALUE','presets.presets[0].affixCount.magic[0].n'],
  ['set positive drop weight',p=>p.presets.presets[0].rarityWeights.set=1,'INVALID_VALUE','presets.presets[0].rarityWeights.set'],
  ['enabled rune family',p=>p.affixes.runeFamilyEnabled=true,'INVALID_VALUE','affixes.runeFamilyEnabled'],
  ['monster repeated ID',p=>p.monsterClasses.members[1].typeId=p.monsterClasses.members[0].typeId,'DUPLICATE_ID','monsterClasses.members[1].typeId'],
  ['unknown monster class',p=>p.monsterClasses.members[0].class='boss','INVALID_VALUE','monsterClasses.members[0].class'],
  ['unknown rarity',p=>p.dropTables.tables[0].minRarity='mythic','INVALID_VALUE','dropTables.tables[0].minRarity'],
  ['unknown preset field',p=>p.presets.presets[0].rarityWeights.mythic=1,'UNKNOWN_FIELD','presets.presets[0].rarityWeights.mythic'],
  ['missing locale key',(_p,l)=>delete l['ext.loot.affix.keen'],'LOCALE_MISSING','locale.ext.loot.affix.keen'],
  ['unused locale key',(_p,l)=>l['ext.loot.unused']='多余','LOCALE_UNUSED','locale.ext.loot.unused'],
  ['locale namespace',(_p,l)=>l['alien.key']='多余','INVALID_VALUE','locale.alien.key'],
  ['data key namespace',p=>p.affixes.affixes[0].nameKey='alien.key','INVALID_VALUE','affixes.affixes[0].nameKey'],
  ['invalid modifier value reference',p=>p.affixes.affixes[0].modifiers[0].valueIndex=1,'INVALID_REFERENCE','affixes.affixes[0].modifiers[0].valueIndex'],
  ['unknown stat',p=>p.affixes.affixes[0].modifiers[0].stat='native.unknown','INVALID_VALUE','affixes.affixes[0].modifiers[0].stat'],
  ['incompatible modifier unit',p=>p.affixes.affixes[0].modifiers[0].unit='int','INVALID_COMBINATION','affixes.affixes[0].modifiers[0].unit'],
  ['speed without slot',p=>delete p.affixes.affixes[9].modifiers[0].slot,'INVALID_COMBINATION','affixes.affixes[9].modifiers[0].slot'],
  ['negative random range',p=>p.affixes.affixes[29].tiers[0].ranges[0]=[-1100,-1000],'INVALID_COMBINATION','affixes.affixes[29].tiers[0].ranges'],
  ['zero class weights',p=>p.dropTables.tables[0].classWeights={weapon:0,armor:0,ring:0},'MISSING_CANDIDATE','dropTables.tables[0].classWeights'],
  ['kill inverted by preset cap',p=>p.dropTables.tables[0].count=[2,3],'INVALID_COMBINATION','dropTables.tables[0].count'],
  ['kill uses encounter count',p=>p.dropTables.tables[0].count='preset-encounter','INVALID_COMBINATION','dropTables.tables[0].count'],
  ['empty rarity pool after truncation',p=>p.presets.presets[0].rarityWeights={normal:100,magic:0,rare:0,unique:0,set:0},'MISSING_CANDIDATE','presets.presets[0].rarityWeights'],
  ['unique multiplier erases encounter pool',p=>{p.presets.presets[0].rarityWeights={normal:0,magic:0,rare:0,unique:1,set:0};p.presets.presets[0].encounter.uniqueWeightBp=1;},'MISSING_CANDIDATE','presets.presets[0].encounter.uniqueWeightBp'],
  ['array symbol field',p=>p.bases.weapons[Symbol('unknown')]=1,'UNKNOWN_FIELD','bases.weapons.Symbol(unknown)'],
  ['field accessor',p=>Object.defineProperty(p.ilvl,'championBonus',{enumerable:true,get(){throw new Error('Must never invoke accessor');}}),'INVALID_TYPE','ilvl.championBonus'],
  ['array accessor',p=>Object.defineProperty(p.bases.weapons,'0',{enumerable:true,get(){throw new Error('Must never invoke accessor');}}),'INVALID_TYPE','bases.weapons[0]'],
  ['root accessor',p=>Object.defineProperty(p,'ilvl',{enumerable:true,get(){throw new Error('Must never invoke accessor');}}),'INVALID_TYPE','ilvl'],
  ['array hole',p=>delete p.bases.weapons[0],'INVALID_TYPE','bases.weapons'],
  ['own symbol field',p=>p.ilvl[Symbol('hidden')]=1,'UNKNOWN_FIELD','ilvl.Symbol(hidden)'],
  ['non-enumerable field',p=>Object.defineProperty(p.ilvl,'championBonus',{value:2,enumerable:false}),'INVALID_TYPE','ilvl.championBonus'],
  ['zero tier-window high weight',p=>p.tiers.window.weightsHighToLow[0]=0,'MISSING_CANDIDATE','tiers.window.weightsHighToLow[0]'],
  ['zero ring weights',p=>p.bases.rings.forEach((r:Mutable)=>r.weight=0),'MISSING_CANDIDATE','bases.rings'],
  ['unsafe gold intermediate',p=>{p.gold.amount={minBase:1000000,maxBase:1000000,minPerDepth:1000000,maxPerDepth:1000000};p.gold.encounter.multiplier=1000000;p.presets.presets[0].goldMultiplierBp=1000000;},'INVALID_VALUE','presets.presets[0].goldMultiplierBp'],
  ['draw budget over limit',p=>{
    // Legal dimensions (four values, eight unique rows) still exceed the mandated conservative sum.
    p.affixes.affixes[0].tiers.forEach((t:Mutable)=>t.ranges=[[1,2],[1,2],[1,2],[1,2]]);
    p.uniques.uniques[0].rows=Array.from({length:8},(_,i)=>({rowId:`loot.unique.whisper.r${i}`,ranges:[[1,2],[1,2],[1,2],[1,2]],modifiers:[{stat:'native.weapon-enchant',category:'flat',valueIndex:0,unit:'int'}]}));
  },'DRAW_BUDGET','pack.drawBudget'],
];
describe('strict loot pack schema',()=>{
  it.each(negatives)('%s',(_name,mutate,code,path)=>{
    const p=structuredClone(loadLootPack()) as Mutable,l=structuredClone(locale) as Mutable;
    mutate(p,l);
    let caught:unknown;try{assertLootPack(p,l);}catch(error){caught=error;}
    expect(caught).toBeInstanceOf(LootDataError);expect(caught).toMatchObject({code,path});
  });
  it('covers at least forty-five independent negatives',()=>expect(negatives.length).toBeGreaterThanOrEqual(45));
  it('provides the literal conservative 45 / 364 draw bound',()=>expect(computeStaticDrawBudget(loadLootPack())).toEqual({perItem:45,perEvent:364}));
  it('never freezes or mutates caller data',()=>{
    const raw=structuredClone(loadLootPack()),before=structuredClone(raw),pack=loadLootPack(raw);
    expect(raw).toEqual(before);expect(Object.isFrozen(raw)).toBe(false);expect(pack).not.toBe(raw);
  });
  it('rejects empty locale text',()=>{
    const l={...locale,'ext.loot.affix.keen':''};
    expect(()=>validateLootLocale(loadLootPack(),l)).toThrow(LootDataError);
  });
});
