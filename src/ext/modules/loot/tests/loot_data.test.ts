import { describe, expect, it } from 'vitest';
import { extensionDataFingerprint } from '../../../fingerprint';
import { getLootPackIdentity, loadLootPack, LOOT_VERSION } from '../definitions';
import { assertLootPack } from '../schema';
import weapons from '../../../../data/weapons.json';
import armors from '../../../../data/armors.json';
import arcana from '../../../../data/arcana.json';
import monsters from '../../../../data/monsters.json';
import locale from '../locales/zh_CN.json';

// Independent hand transcription from taskbook §5.5. Never derived from production JSON or the taskbook at runtime.
const AFFIX_RANGES: Record<string,string> = {
  keen:'1500:2500 2600:4000 4100:6000 6100:8500 8600:11500 11600:15000',
  brutal:'1:1,2:3 1:2,3:5 2:3,5:7 3:5,8:11 5:7,12:15 7:9,16:20',
  honed:'1:1 1:2 2:2 2:3 3:4 4:5',
  giantsbane:'2000:3000 3100:4500 4600:6500 6600:9000 9100:12000 12100:16000',
  reinforced:'1000:1500 1600:2200 2300:3000 3100:4000 4100:5000 5100:6000',
  plated:'1:1 1:2 2:2 2:3 3:4 4:5',
  warding:'-400:-300 -600:-500 -800:-700 -1100:-900 -1400:-1200 -1800:-1500',
  radiant:'1:1 1:1 1:2 2:2 2:2 3:3',
  precise:'800:1200 1300:1800 1900:2500 2600:3300 3400:4200 4300:5200',
  swift:'-600:-400 -900:-700 -1200:-1000 -1500:-1300 -1800:-1600 -2200:-1900',
  vital:'5:9 10:16 17:25 26:36 37:50 51:68',
  mending:'1:1 1:1 1:2 2:2 2:3 3:3',
  titan:'1:1 1:1 1:2 2:2 2:3 3:4',
  shadow:'1:1 1:1 1:2 2:2 2:3 3:3',
  seeker:'1:1 1:2 2:2 2:3 3:3 3:4',
  clairvoyant:'1:1 1:2 2:2 2:3 3:3 3:4',
  wisdom:'1:1 1:1 1:2 2:2 2:3 3:3',
  fireward:'800:1200 1300:1800 1900:2500 2600:3300 3400:4200 4300:5000',
  antivenom:'800:1200 1300:1800 1900:2500 2600:3300 3400:4200 4300:5000',
  leech:'1:1 1:1 1:2 2:2 2:3 3:3',
  reaper:'1:1 1:2 2:2 2:3 3:4 4:5',
  fortune:'500:1000 1000:1500 1500:2200 2200:3000 3000:4000 4000:5000',
  enduring:'2:3 3:4 4:6 6:8 8:10 10:12',
  steadfast:'1:1 1:2 2:2 2:3 3:4 4:5',
  tireless:'500:800 800:1200 1200:1600 1600:2000 2000:2500 2500:3000',
  sage:'1:1 1:1 1:2 2:2 2:3 3:3',
  adept:'1:1 1:1 1:2 2:2 2:3 3:3',
  scholar:'400:600 600:900 900:1200 1200:1600 1600:2000 2000:2500',
  stalwart:'600:1000 1000:1400 1400:1900 1900:2500 2500:3200 3200:4000',
  dull:'-1000:-1000 -1500:-1500 -2000:-2000 -2500:-2500 -3000:-3000 -3500:-3500',
  brittle:'-1000:-1000 -1500:-1500 -2000:-2000 -2500:-2500 -3000:-3000 -3500:-3500',
  frail:'-4:-4 -11:-11 -18:-18 -26:-26 -33:-33 -40:-40',
  // D-16 fixed table is authoritative; do not recompute the discrepant clumsy values from prose interpolation.
  clumsy:'-800:-800 -1200:-1200 -1700:-1700 -2100:-2100 -2600:-2600 -3000:-3000',
  noisy:'-1:-1 -1:-1 -1:-1 -2:-2 -2:-2 -2:-2',
  sluggish:'500:500 700:700 900:900 1100:1100 1300:1300 1500:1500',
};
const META = [
  'prefix weapon dmg-pct 1000 loot.local.damage local-increased bp',
  'prefix weapon dmg-flat 1000 loot.local.damage local-flat int',
  'prefix weapon enchant 600 native.weapon-enchant flat int',
  'prefix weapon slayer 500 native.physical-damage-dealt increased bp',
  'prefix armor def-pct 1000 loot.local.armor local-increased bp',
  'prefix armor def-flat 800 native.defense flat display-armor',
  'prefix armor dr 700 native.physical-damage-taken increased bp',
  'prefix armor,ring light 300 native.light flat ring-point',
  'suffix weapon,ring accuracy 900 native.accuracy increased bp',
  'suffix weapon speed 500 native.attack-speed more bp',
  'suffix armor,ring life 1200 native.max-hp flat int',
  'suffix armor,ring regen 500 native.regeneration flat ring-point',
  'suffix weapon,armor,ring strength 600 native.strength flat int',
  'suffix armor,ring stealth 400 native.stealth-range flat ring-point',
  'suffix ring search 400 native.awareness flat ring-point',
  'suffix ring clairvoyance 250 native.clairvoyance flat ring-point',
  'suffix ring wisdom 300 native.wisdom flat ring-point',
  'suffix armor,ring res-fire 700 native.resist.fire flat bp',
  'suffix armor,ring res-poison 700 native.resist.poison flat bp',
  'suffix weapon leech 500 native.transference flat ring-point',
  'suffix weapon reaping 400 native.reaping flat ring-point',
  'suffix ring find 400 loot.rarity-find flat bp',
  'prefix armor stamina 600 combat.stamina-capacity flat int',
  'suffix armor poise 500 combat.poise-capacity flat int',
  'suffix ring stamina-regen 400 combat.stamina-regen increased bp',
  'suffix ring focus 400 growth.focus-capacity flat int',
  'suffix weapon,armor,ring attribute 600 growth.attribute:{attribute} flat int',
  'suffix ring xp 300 growth.xp-gain increased bp',
  'prefix armor poise-recovery 300 combat.poise-recovery increased bp',
  'prefix weapon dmg-pct 1000 loot.local.damage local-increased bp',
  'prefix armor def-pct 1000 loot.local.armor local-increased bp',
  'suffix armor,ring life 1000 native.max-hp flat int',
  'suffix weapon,ring accuracy 800 native.accuracy increased bp',
  'suffix armor,ring stealth 600 native.stealth-range flat ring-point',
  'suffix weapon speed 600 native.attack-speed more bp',
];
const parseRanges=(text:string)=>text ? text.split(',').map(pair=>pair.split(':').map(Number)) : [];
const pack=loadLootPack();
describe('loot data double transcription',()=>{
  it('loads exactly sixteen rule files and recursively freezes every object',()=>{
    expect(Object.keys(pack)).toEqual(['ilvl','tiers','bases','rarities','affixes','uniques','monsterClasses','dropTables','gold','presets','enhancement','identify','corruption','salvage','caps','rareNames']);
    const check=(v:unknown):void=>{if(v&&typeof v==='object'){expect(Object.isFrozen(v)).toBe(true);Object.values(v).forEach(check);}};check(pack);
    expect(LOOT_VERSION).toBe('0.1.1');expect(getLootPackIdentity()).toEqual({schema:1,version:'0.1.1',fingerprint:extensionDataFingerprint(pack)});
    // v1.1 four-field data patch; regenerated independently alongside the literal tapes.
    expect(getLootPackIdentity().fingerprint).toBe('sha256:7785d8e68e6486bd422e40c6a3f0d317b102683116dcea8e483f2256d9c84fd2');
  });
  it('independently transcribes all 35 ordinary affix rows, exact intervals, metadata and dependencies',()=>{
    expect(pack.affixes.affixes).toHaveLength(56);expect(pack.affixes.runeFamilyEnabled).toBe(false);
    const entries=Object.entries(AFFIX_RANGES);
    entries.forEach(([id,values],i)=>{
      const a=pack.affixes.affixes[i]!, [position,classes,group,weight,stat,category,unit]=META[i]!.split(' ');
      expect(a.id).toBe(`loot.affix.${id}`);expect(a.maxTier).toBe(6);expect(a.polarity).toBe(i<29?1:-1);
      expect([a.position,a.itemClasses.join(','),a.group,a.weight]).toEqual([position,classes,group,Number(weight)]);
      expect(a.tiers).toEqual(values.split(' ').map((s,j)=>({tier:j+1,ranges:parseRanges(s)})));
      expect(a.modifiers).toEqual(parseRanges(values.split(' ')[0]!).map((_,valueIndex)=>({stat,category,valueIndex,unit,
        ...(category==='more'?{slot:'speed'}:{}),...(id==='giantsbane'?{conditions:[{kind:'target-tag',tag:'body.large'}]}:{})})));
      expect(a.rune).toBeNull();expect(a.tags).toEqual([]);
      expect(a.expand).toEqual(id==='adept'?{kind:'growth-attributes'}:null);
      if(i<22||i>=29){expect(a.requires).toBeNull();expect(a.fallback).toBeNull();}
    });
    const deps=[['combat','combat.stamina-capacity','vital'],['combat','combat.poise-capacity','omit'],['combat','combat.stamina-regen','mending'],['growth','growth.focus-capacity','mending'],['growth','growth.attribute','titan'],['growth','growth.xp-gain','omit'],['combat','combat.poise-recovery','warding']];
    deps.forEach(([module,key,target],i)=>{
      expect(pack.affixes.affixes[i+22]!.requires).toEqual({module,key});
      expect(pack.affixes.affixes[i+22]!.fallback).toEqual(target==='omit'?{kind:'omit'}:{kind:'replace',affixId:`loot.affix.${target}`});
    });
  });
  it('independently transcribes all twenty-one runes, weights, order and caps',()=>{
    const specs=[
      ['weapon','speed',50,6],['weapon','quietus',15,4],['weapon','paralyzing',35,5],['weapon','multiplicity',40,6],
      ['weapon','slowing',50,6],['weapon','confusion',40,6],['weapon','force',40,6],['weapon','slaying',25,6],
      ['armor','multiplicity',40,6],['armor','mutuality',40,6],['armor','absorption',50,6],['armor','reprisal',50,6],
      ['armor','immunity',25,6],['armor','reflection',40,6],['armor','respiration',30,6],['armor','dampening',30,6],
      ['weapon','mercy',10,1],['weapon','plenty',10,1],['armor','burden',10,1],['armor','vulnerability',10,1],['armor','immolation',10,1],
    ] as const;
    const tiers=[[[2,2]],[[3,3]],[[4,4]],[[5,6]],[[7,8]],[[9,10]]];
    specs.forEach(([slot,runicType,weight,maxTier],i)=>{
      const a=pack.affixes.affixes[35+i]!;
      expect(a).toMatchObject({id:`loot.affix.rune-${slot[0]}-${runicType}`,itemClasses:[slot],rune:{slot,runicType},group:'rune',position:'suffix',weight,maxTier,polarity:i<16?1:-1,requires:null,fallback:null,expand:null,tags:[]});
      expect(a.tiers).toEqual(i<16?tiers.slice(0,maxTier).map((ranges,j)=>({tier:j+1,ranges})):[{tier:1,ranges:[]}]);
      expect(a.modifiers).toEqual(i<16?[{stat:slot==='weapon'?'native.runic-power':'native.armor-runic-power',category:'flat',valueIndex:0,unit:'runic-strength',runicType}]:[]);
    });
  });
  it('independently transcribes every unique fixed row and modifier',()=>{
    // stat category unit ranges [rune/large]; slash separates fixed rows.
    const specs:[string,string,number,number,string][]=[
      ['whisper','dagger',5,100,'native.weapon-enchant flat int 3:3/native.accuracy increased bp 2000:3000/native.transference flat ring-point 2:2/native.runic-power flat runic-strength 4:4 quietus'],
      ['ember-fang','sword',15,100,'loot.local.damage local-increased bp 7000:10000/native.resist.fire flat bp 3000:3000/native.light flat ring-point 2:2/native.regeneration flat ring-point 1:1'],
      ['penitent','ring_of_regeneration',12,80,'loot.ring-implicit override ring-point 3:3/native.max-hp flat int -10:-10/native.physical-damage-taken increased bp -1000:-1000/native.resist.poison flat bp 4000:4000'],
      ['shadowweave','leather_armor',8,100,'native.stealth-range flat ring-point 3:3/native.attack-speed more bp -1200:-1200/native.max-hp flat int 25:35/native.accuracy increased bp 1500:1500'],
      ['cinder-mail','chain_mail',18,80,'loot.local.armor local-increased bp 4000:4000/native.resist.fire flat bp 5000:5000/native.armor-runic-power flat runic-strength 6:6 reflection/native.max-hp flat int -15:-15'],
      ['colossus-maul','war_hammer',25,60,'loot.local.damage local-flat int 8:8,14:14/native.strength flat int 4:4/native.physical-damage-dealt increased bp 10000:13000 large/native.attack-speed more bp 1500:1500/native.runic-power flat runic-strength 8:8 force'],
      ['vigil-plate','plate_mail',30,60,'loot.local.armor local-increased bp 4500:5500/native.max-hp flat int 60:80/native.physical-damage-taken increased bp -1500:-1500/native.stealth-range flat ring-point -2:-2/native.armor-runic-power flat runic-strength 8:8 absorption'],
      ['gambler','ring_of_awareness',20,60,'loot.ring-implicit override ring-point 2:2/loot.rarity-find flat bp 6000:8000/native.max-hp flat int -20:-20/native.accuracy increased bp -1000:-1000'],
    ];
    expect(pack.uniques.uniques).toHaveLength(8);
    specs.forEach(([id,baseId,minIlvl,weight,rows],i)=>{
      const u=pack.uniques.uniques[i]!;expect(u).toMatchObject({id:`loot.unique.${id}`,baseId,minIlvl,weight});
      expect(u.rows).toEqual(rows.split('/').map((row,j)=>{
        const [stat,category,unit,values,extra]=row.split(' '),ranges=parseRanges(values!);
        return {rowId:`loot.unique.${id}.r${j}`,ranges,modifiers:ranges.map((_,valueIndex)=>({stat,category,unit,valueIndex,
          ...(category==='more'?{slot:'speed'}:{}),...(extra==='large'?{conditions:[{kind:'target-tag',tag:'body.large'}]}:extra?{runicType:extra}:{})}))};
      }));
    });
    expect(pack.uniques.bossUniqueBias).toEqual([{formId:'giants.abyssal-colossus',uniqueId:'loot.unique.colossus-maul',multiplierBp:50000}]);
  });
  it('independently transcribes all preset numerical fields and table orders',()=>{
    const rows=pack.presets.presets;expect(rows.map(p=>p.id)).toEqual(['scarce','standard','bountiful']);
    const columns={floorConversionBp:[10000,10000,10000],killDropMultiplierBp:[6000,10000,20000],maxPerKill:[1,2,3],corruptChanceBp:[1000,600,400],goldMultiplierBp:[5000,10000,15000],salvageMultiplierBp:[10000,10000,7500]} as const;
    for(const [k,v]of Object.entries(columns))expect(rows.map(p=>p[k as keyof typeof columns])).toEqual(v);
    expect(rows.map(p=>Object.values(p.rarityWeights))).toEqual([[850,120,27,3,0],[700,220,70,10,0],[480,330,160,30,0]]);
    expect(rows.map(p=>Object.values(p.rarityIlvlScalingBp))).toEqual([[0,100,150,150,0],[0,150,250,250,0],[0,150,300,300,0]]);
    const parse=(s:string)=>s.split(' ').map(x=>{const[n,w]=x.split(':').map(Number);return {n,w};});
    expect(rows.map(p=>p.affixCount.magic)).toEqual(['1:60 2:40','1:55 2:45','1:40 2:60'].map(parse));
    expect(rows.map(p=>p.affixCount.rare)).toEqual(['3:55 4:35 5:10','3:45 4:35 5:20','4:50 5:35 6:15'].map(parse));
    expect(rows.map(p=>p.affixCount.rareHighIlvl)).toEqual(['4:60 5:30 6:10','4:45 5:35 6:20','4:30 5:40 6:30'].map(s=>({minIlvl:40,table:parse(s)})));
    expect(rows.map(p=>p.encounter)).toEqual([{count:1,firstMinRarity:'magic',restMinRarity:'magic',uniqueWeightBp:5000},{count:2,firstMinRarity:'rare',restMinRarity:'magic',uniqueWeightBp:10000},{count:3,firstMinRarity:'rare',restMinRarity:'magic',uniqueWeightBp:5000}]);
    expect(rows.map(p=>p.vault)).toEqual([{minRarity:'magic',highValueMinRarity:'magic'},{minRarity:'magic',highValueMinRarity:'rare'},{minRarity:'rare',highValueMinRarity:'rare'}]);
    expect(rows.map(p=>p.rarityFind)).toEqual([{k:25000,cap:10000},{k:25000,cap:20000},{k:25000,cap:30000}]);
    expect(rows.map(p=>p.familiarity)).toEqual([{weaponKills:20,armorTurns:1000,ringTurns:1500},{weaponKills:10,armorTurns:600,ringTurns:800},{weaponKills:6,armorTurns:400,ringTurns:500}]);
    expect(rows.map(p=>p.monsterScaling.map(x=>[x.depth,x.hpBp,x.damageBp,x.accuracyBp]))).toEqual([
      [[1,0,0,0],[5,2000,5000,0],[10,3500,6500,0],[20,3500,5000,0],[26,2500,3000,0]],
      [[1,0,0,0],[5,2500,7000,0],[10,5000,10000,0],[20,5000,9000,0],[26,4000,6500,0]],
      [[1,0,0,0],[5,2500,9000,0],[10,5000,14000,0],[20,5000,12000,0],[26,4500,9000,0]],
    ]);
  });
  it('independently transcribes monster classes and exactly covers all 67 native monsters in native order',()=>{
    const groups:Record<string,string>={
      none:'goblin_totem ogre_totem eldritch_totem mirrored_totem spectral_blade spectral_sword stone_guardian winged_guardian guardian_spirit Warden_of_Yendor sentinel arrow_turret spark_turret dart_turret flame_turret phylactery phoenix_egg',
      fodder:'rat kobold jackal eel monkey bloat pit_bloat explosive_bloat toad acid_mound wisp pixie',
      splitter:'pink_jelly acidic_jelly black_jelly',
      elite:'ogre troll naga underworm kraken lich tentacle_horror golem dragon vampire goblin_warlord unicorn ifrit phoenix mangrove_dryad',
      standard:'goblin goblin_conjurer goblin_mystic vampire_bat centipede bog_monster spider wraith zombie ogre_shaman salamander dar_blademaster dar_priestess dar_battlemage centaur phantom imp fury revenant flamedancer',
    };
    for(const [cls,ids]of Object.entries(groups))expect(pack.monsterClasses.members.filter(m=>m.class===cls).map(m=>m.typeId).sort()).toEqual(ids.split(' ').sort());
    expect(pack.monsterClasses.members.map(m=>m.typeId)).toEqual(monsters.map(m=>m.id));expect(monsters).toHaveLength(67);
    expect(pack.monsterClasses.defaultClass).toBe('standard');expect(pack.monsterClasses.classes).toEqual(['none','fodder','splitter','standard','elite']);
    expect(pack.monsterClasses.modifiers).toEqual({leader:{chanceBonusBp:500},champion:{chanceBonusBp:1000,rarityBonusBp:5000}});
  });
  it('independently transcribes all drop tables and gold values',()=>{
    expect(pack.dropTables.tables).toEqual([
      {id:'loot.drop.kill-fodder',match:{source:'kill',monsterClass:'fodder'},chanceBp:300,count:[1,1],classWeights:{weapon:40,armor:35,ring:25},rarityBonusBp:0},
      {id:'loot.drop.kill-splitter',match:{source:'kill',monsterClass:'splitter'},chanceBp:100,count:[1,1],classWeights:{weapon:40,armor:35,ring:25},rarityBonusBp:0},
      {id:'loot.drop.kill-standard',match:{source:'kill',monsterClass:'standard'},chanceBp:700,count:[1,1],classWeights:{weapon:40,armor:35,ring:25},rarityBonusBp:0},
      {id:'loot.drop.kill-elite',match:{source:'kill',monsterClass:'elite'},chanceBp:3000,count:[1,3],classWeights:{weapon:40,armor:35,ring:25},rarityBonusBp:5000},
      {id:'loot.drop.encounter',match:{source:'encounter'},chanceBp:10000,count:'preset-encounter',classWeights:{weapon:35,armor:35,ring:30},rarityBonusBp:0},
    ].map(t=>({...t,priority:100,minRarity:null,ilvlBonus:0})));
    expect(pack.gold).toEqual({schema:1,amount:{minBase:5,minPerDepth:3,maxBase:15,maxPerDepth:6},byClass:{fodder:{chanceBp:1500,multiplier:1},splitter:{chanceBp:500,multiplier:1},standard:{chanceBp:2000,multiplier:1},elite:{chanceBp:4000,multiplier:3}},encounter:{chanceBp:10000,multiplier:10}});
  });
  it('transcribes all base weights and validates their native category',()=>{
    expect(pack.bases.ilvlBands).toEqual([{minIlvl:1,maxIlvl:11},{minIlvl:12,maxIlvl:26},{minIlvl:27,maxIlvl:99}]);
    expect(pack.bases.weaponTierWeights).toEqual({light:[10,8,6],medium:[6,10,9],heavy:[3,8,12]});
    expect(pack.bases.weapons.map(x=>[x.baseId,x.tier])).toEqual([['dagger','light'],['whip','light'],['spear','light'],['rapier','light'],['sword','light'],['mace','medium'],['axe','light'],['flail','medium'],['broadsword','heavy'],['war_pike','heavy'],['war_hammer','heavy'],['war_axe','heavy']]);
    expect(pack.bases.armors.map(x=>[x.baseId,...x.weights])).toEqual([['leather_armor',12,6,4],['scale_mail',10,8,6],['chain_mail',8,10,8],['banded_mail',5,10,10],['splint_mail',3,8,10],['plate_mail',2,6,10]]);
    expect(pack.bases.rings.map(x=>[x.baseId,x.weight])).toEqual(['clairvoyance','stealth','regeneration','transference','light','awareness','wisdom','reaping'].map(x=>[`ring_of_${x}`,10]));
    expect(pack.bases.ringImplicit).toEqual({base:1,ilvlStep:15,min:1,max:4});
    pack.bases.weapons.forEach(b=>expect(weapons.some(w=>w.id===b.baseId)).toBe(true));
    pack.bases.armors.forEach(b=>expect(armors.some(a=>a.id===b.baseId)).toBe(true));
    pack.bases.rings.forEach(b=>expect(arcana.rings.some(r=>r.id===b.baseId)).toBe(true));
  });
  it('transcribes ilvl, tiers, rarities, enhancement, identify, corruption, salvage and caps',()=>{
    expect(pack.ilvl).toEqual({schema:1,ilvlPerDepthBp:15000,min:1,max:99,siteIlvl:1,sourceBonus:{floor:0,kill:0,vault:3,encounter:5,part:2,craft:0},classBonus:{none:0,fodder:0,splitter:0,standard:0,elite:1},championBonus:2});
    expect(pack.tiers).toEqual({schema:1,tiers:[1,6,12,20,30,40,55].map((minIlvl,i)=>({tier:i+1,minIlvl,enabled:i<6})),window:{size:3,weightsHighToLow:[25,40,35]}});
    expect(pack.rarities.rarities.map(({id,order,colorDark,colorLight,marker,affixes,enhancementCap,droppable})=>({id,order,colorDark,colorLight,marker,affixes,enhancementCap,droppable}))).toEqual([
      ['normal','#c8c8c8','#4a4a4a','',0,10,true],['magic','#6a8cff','#2b4fd1','◇',1,8,true],['rare','#ffd94a','#9c7a00','◆',3,6,true],['unique','#c7a046','#7a5a14','★',null,4,true],['set','#3fd36b','#16803a','✦',null,4,false],['runeword','#b8a77a','#6b5c33','⊕',null,0,false],
    ].map(([id,colorDark,colorLight,marker,n,enhancementCap,droppable],order)=>({id,order,colorDark,colorLight,marker,affixes:n===null?null:{prefixMax:n,suffixMax:n},enhancementCap,droppable})));
    expect(pack.enhancement).toEqual({schema:1,caps:{normal:10,magic:8,rare:6,unique:4,set:4,runeword:0},weapon:{localDamageBpPerLevel:1000,weaponEnchantEveryLevels:3},armor:{maxHpPerLevel:5,defenseInternalPerLevel:5},ring:{implicitEveryLevels:2},atCap:{kind:'refine',target:'random-positive-affix',keep:'higher',rejectWhenAllAtTierMax:true},nonLootItems:'native-plus-one'});
    expect(pack.identify).toEqual({schema:1,familiarityMultiplierBp:{normal:10000,magic:5000,rare:10000,unique:15000},familiarityRounding:'ceil',scrollRevealsAll:true,firstTriggerReveal:{enabled:true,excludedStats:['native.stealth-range','native.awareness','native.clairvoyance','native.light','native.wisdom','loot.rarity-find','growth.xp-gain']}});
    expect(pack.corruption).toEqual({schema:1,eligibleRarities:['magic','rare'],maxTotalAffixes:6,negativeRuneFallback:true,compensation:{tierStep:1,maxTier:6},nativeCursed:true});
    expect(pack.salvage).toEqual({schema:1,shardItemId:'loot.shard',nameKey:'ext.loot.shard.name',maxStack:99,base:{normal:1,magic:3,rare:8,unique:20},ilvlStep:10,corruptedMultiplierBp:15000,minimum:1,exchange:{shards:10,effect:'identify-one'}});
    expect(pack.caps.caps).toEqual([
      ['max-hp','final',9999,'int'],['resist.fire','final',7500,'bp'],['resist.poison','final',7500,'bp'],['weapon-enchant','loot-sources',10,'int'],['defense','final',220,'int'],
      ['regeneration','loot-sources',8,'ring-point'],['stealth-range','loot-sources',5,'ring-point'],['transference','loot-sources',6,'ring-point'],['reaping','loot-sources',8,'ring-point'],['wisdom','loot-sources',6,'ring-point'],['light','loot-sources',6,'ring-point'],['clairvoyance','loot-sources',6,'ring-point'],['awareness','loot-sources',8,'ring-point'],['attack-speed','loot-sources',-4000,'bp'],['physical-damage-taken','loot-sources',-5000,'bp'],
    ].map(([stat,scope,n,unit])=>({stat:`native.${stat}`,scope,...(Number(n)<0?{min:n}:{max:n}),unit})));
    expect(pack.rareNames.first).toHaveLength(32);expect(pack.rareNames.second).toHaveLength(32);
  });
  it('changes identity for an edit to every individual numerical rule leaf',()=>{
    const mutable=structuredClone(pack), original=extensionDataFingerprint(mutable);
    let checked=0;
    const visit=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      const object=value as Record<string,unknown>;
      for(const [k,v]of Object.entries(object)){
        if(typeof v==='number'){
          object[k]=v+1;expect(extensionDataFingerprint(mutable)).not.toBe(original);object[k]=v;checked++;
        } else visit(v);
      }
    };
    visit(mutable);expect(checked).toBeGreaterThan(1000);expect(mutable).toEqual(pack);
  });
  it('has stable identity; numeric edits change fingerprint and locale edits never do',()=>{
    expect(extensionDataFingerprint(structuredClone(pack))).toBe(getLootPackIdentity().fingerprint);
    const changed=structuredClone(pack);changed.gold.amount.minBase+=1;expect(extensionDataFingerprint(loadLootPack(changed))).not.toBe(getLootPackIdentity().fingerprint);
    const display={...locale,'ext.loot.affix.keen':'锋芒的'};assertLootPack(pack,display);expect(extensionDataFingerprint(pack)).toBe(getLootPackIdentity().fingerprint);
  });
});
