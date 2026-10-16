/** 6B1-alpha contracts. Native item integration and stat collection are intentionally deferred. */
export type ItemClass = 'weapon' | 'armor' | 'ring';
export type RarityId = 'normal' | 'magic' | 'rare' | 'unique' | 'set' | 'runeword';
export type LootSource = 'floor' | 'kill' | 'encounter' | 'vault';
export type MonsterClassId = 'none' | 'fodder' | 'splitter' | 'standard' | 'elite';
export type Range = [number, number];
export interface ModifierSpec {
  stat: string;
  category: 'flat' | 'increased' | 'more' | 'local-increased' | 'local-flat' | 'override';
  slot?: 'speed';
  valueIndex: number;
  unit: 'bp' | 'int' | 'display-armor' | 'ring-point' | 'runic-strength';
  runicType?: string;
  conditions?: { kind: 'target-tag'; tag: 'body.large' }[];
}
export interface AffixDefinition {
  id: string; nameKey: string; position: 'prefix' | 'suffix';
  itemClasses: ItemClass[]; group: string; weight: number; polarity: 1 | -1; maxTier: number;
  tiers: { tier: number; ranges: Range[] }[];
  modifiers: ModifierSpec[];
  requires: { module: 'combat' | 'growth'; key: string } | null;
  fallback: { kind: 'replace'; affixId: string } | { kind: 'omit' } | null;
  expand: { kind: 'growth-attributes' } | null;
  rune: { slot: 'weapon' | 'armor'; runicType: string } | null;
  tags: string[];
}
export interface AffixesFile { schema: 1; runeFamilyEnabled: boolean; affixes: AffixDefinition[] }
export interface UniqueDefinition {
  id: string; nameKey: string; descriptionKey: string; baseId: string; minIlvl: number; weight: number;
  rows: { rowId: string; ranges: Range[]; modifiers: ModifierSpec[] }[];
}
export interface SetDefinition {
  id: string; nameKey: string; descriptionKey: string; pieces: UniqueDefinition[];
  bonuses: { count: number; rows: UniqueDefinition['rows'] }[];
}
export interface UniquesFile {
  schema: 1; uniques: UniqueDefinition[];
  bossUniqueBias: { formId: string; uniqueId: string; multiplierBp: number }[];
}
export interface DropTable {
  id: string; priority: number;
  match: { source: LootSource; monsterClass?: MonsterClassId; monsterId?: string; formId?: string; depth?: Range };
  chanceBp: number; count: Range | 'preset-encounter';
  classWeights: Record<ItemClass, number>; rarityBonusBp: number; minRarity: RarityId | null; ilvlBonus: number;
}
export interface DropTablesFile { schema: 1; tables: DropTable[] }
export interface RarityDefinition {
  id: RarityId; order: number; nameKey: string; colorDark: string; colorLight: string; marker: string;
  affixes: { prefixMax: number; suffixMax: number } | null; enhancementCap: number; droppable: boolean;
}
export interface RaritiesFile { schema: 1; rarities: RarityDefinition[] }
export type RarityWeights = Record<Exclude<RarityId, 'runeword'>, number>;
export interface LootPreset {
  id: string; nameKey: string; descriptionKey: string;
  floorConversionBp: number; killDropMultiplierBp: number; maxPerKill: number;
  rarityWeights: RarityWeights; rarityIlvlScalingBp: RarityWeights;
  affixCount: { magic: { n: number; w: number }[]; rare: { n: number; w: number }[];
    rareHighIlvl: { minIlvl: number; table: { n: number; w: number }[] } };
  encounter: { count: number; firstMinRarity: RarityId; restMinRarity: RarityId; uniqueWeightBp: number };
  vault: { minRarity: RarityId; highValueMinRarity: RarityId };
  rarityFind: { k: number; cap: number }; corruptChanceBp: number;
  familiarity: { weaponKills: number; armorTurns: number; ringTurns: number };
  goldMultiplierBp: number; salvageMultiplierBp: number;
  monsterScaling: { depth: number; hpBp: number; damageBp: number; accuracyBp: number }[];
}
export interface PresetsFile { schema: 1; presets: LootPreset[] }
export interface LootPack {
  ilvl: { schema: 1; ilvlPerDepthBp: number; min: number; max: number; siteIlvl: number;
    sourceBonus: Record<LootSource | 'part' | 'craft', number>; classBonus: Record<MonsterClassId, number>; championBonus: number };
  tiers: { schema: 1; tiers: { tier: number; minIlvl: number; enabled: boolean }[];
    window: { size: number; weightsHighToLow: number[] } };
  bases: { schema: 1; ilvlBands: { minIlvl: number; maxIlvl: number }[];
    weaponTierWeights: Record<'light' | 'medium' | 'heavy', number[]>;
    weapons: { baseId: string; tier: 'light' | 'medium' | 'heavy' }[];
    armors: { baseId: string; weights: number[] }[]; rings: { baseId: string; weight: number }[];
    ringImplicit: { base: number; ilvlStep: number; min: number; max: number } };
  rarities: RaritiesFile;
  affixes: AffixesFile;
  uniques: UniquesFile;
  sets: { schema: 1; sets: SetDefinition[] };
  monsterClasses: { schema: 1; defaultClass: MonsterClassId; classes: MonsterClassId[];
    members: { typeId: string; class: MonsterClassId }[];
    modifiers: { leader: { chanceBonusBp: number }; champion: { chanceBonusBp: number; rarityBonusBp: number } } };
  dropTables: DropTablesFile;
  gold: { schema: 1; amount: { minBase: number; minPerDepth: number; maxBase: number; maxPerDepth: number };
    byClass: Record<Exclude<MonsterClassId, 'none'>, { chanceBp: number; multiplier: number }>;
    encounter: { chanceBp: number; multiplier: number } };
  presets: PresetsFile;
  enhancement: { schema: 1; caps: Record<RarityId, number>;
    weapon: { localDamageBpPerLevel: number; weaponEnchantEveryLevels: number };
    armor: { maxHpPerLevel: number; defenseInternalPerLevel: number }; ring: { implicitEveryLevels: number };
    atCap: { kind: 'refine'; target: 'random-positive-affix'; keep: 'higher'; rejectWhenAllAtTierMax: true };
    nonLootItems: 'native-plus-one' };
  identify: { schema: 2; familiarityMultiplierBp: Record<RarityId, number>;
    familiarityRounding: 'ceil'; scrollRevealsAll: true; firstTriggerReveal: { enabled: true; excludedStats: string[] } };
  corruption: { schema: 1; eligibleRarities: RarityId[]; maxTotalAffixes: number; negativeRuneFallback: boolean;
    compensation: { tierStep: number; maxTier: number }; nativeCursed: true };
  salvage: { schema: 2; shardItemId: string; nameKey: string; maxStack: number;
    base: Record<RarityId, number>; ilvlStep: number;
    corruptedMultiplierBp: number; minimum: number; exchange: { shards: number; effect: 'identify-one' } };
  caps: { schema: 1; caps: { stat: string; scope: 'loot-sources' | 'final'; min?: number; max?: number; unit: ModifierSpec['unit'] }[] };
  rareNames: { schema: 1; first: { nameKey: string }[]; second: { nameKey: string }[] };
}
export type LootRawFiles = { [K in keyof LootPack]: unknown };
export interface LootAffixRoll { id: string; tier: number; values: number[]; known: boolean }
export interface LootItemDataV1 {
  v: 3; targetClass?: string; baseId: string; ilvl: number; rarity: RarityId; uniqueId: string | null; setId: string | null; pieceId: string | null; identityKnown: boolean;
  affixes: LootAffixRoll[]; corrupted: boolean; enhancement: number; sockets: 0; socketed: [];
  nameParts: [number, number] | null; origin: { source: LootSource; depth: number };
}
export interface LootNativeFacts {
  kind: string; category: ItemClass; enchantment: number;
  runicType: string | null; runicStrength: number | null; isCursed: boolean; identified: boolean;
}
export interface LootGeneratedItem { data: LootItemDataV1; native: LootNativeFacts }
export interface LootRandom { randomInt(lo: number, hi: number): number; beginItem?(index: number): void }
export interface LootRequestBase { v: 1; depth: number; presetId: string; rarityFindBp: number; claimedUniqueIds: readonly string[] }
export type LootRollRequest =
  | (LootRequestBase & { source: 'kill'; monster: { typeId: string; leader: boolean; champion: boolean; encounterSubject: boolean } })
  | (LootRequestBase & { source: 'floor'; itemClass: ItemClass })
  | (LootRequestBase & { source: 'vault'; itemClass: ItemClass; baseId: string | null; highValue: boolean })
  | (LootRequestBase & { source: 'encounter'; formId: string | null });
export interface LootRollResult { v: 1; converted: boolean; items: LootGeneratedItem[]; gold: number; newUniqueIds: string[]; draws: number }
export interface LootModifierDraft {
  sourceId: string; stat: string; category: ModifierSpec['category']; slot: 'speed' | null;
  unit: ModifierSpec['unit']; value: number; conditions: ModifierSpec['conditions']; runicType: string | null; known: boolean;
}
export interface LootAvailability {
  combat: { stats: readonly string[] } | null;
  growth: { stats: readonly string[]; attributes: readonly string[]; fingerprint?: string } | null;
  giants: { formIds: readonly string[] } | null;
}
export interface EffectiveLootCatalog {
  pack: LootPack; availability: LootAvailability; affixes: AffixDefinition[];
  setsById: Readonly<Record<string, SetDefinition>>;
  piecesById: Readonly<Record<string, { setId: string; piece: UniqueDefinition }>>;
  piecesByBase: Readonly<Record<string, readonly { setId: string; piece: UniqueDefinition }[]>>;
  pieceIds: readonly string[];
  effectiveWeight: Record<string, Partial<Record<ItemClass, number>>>;
  bossUniqueBias: UniquesFile['bossUniqueBias']; fingerprint: string;
}
