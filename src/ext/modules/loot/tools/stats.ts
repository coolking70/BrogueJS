import monsters from '../../../../data/monsters.json';
import weapons from '../../../../data/weapons.json';
import armors from '../../../../data/armors.json';
import { buildEffectiveLootCatalog } from '../catalog';
import { getLootPackIdentity, loadLootPack } from '../definitions';
import { enhancementCap } from '../economy';
import { rollLootWithTrace } from '../generator';
import { lootItemClass, projectItemModifiers, validateLootItemData } from '../item';
import { computeRarityWeights } from '../rarity';
import type { EffectiveLootCatalog, ItemClass, LootItemDataV1, LootModifierDraft, LootRandom, LootRollRequest, LootSource } from '../types';
import { CHECKPOINT_DEPTHS, FIRST_TIER_TARGETS, LAYER_TARGETS, POWER_TARGETS, PRESET_IDS, RARITY_IDS, RARITY_TARGETS, UNIQUE_OPPORTUNITY_TARGETS } from './doc-targets';
import type { StatsPresetId } from './doc-targets';

type RarityCounts = Record<typeof RARITY_IDS[number], number>;
type SourceCounts = Record<LootSource, number>;
type EventRequest = LootRollRequest extends infer T ? T extends LootRollRequest ? Omit<T, 'v' | 'depth' | 'presetId' | 'rarityFindBp' | 'claimedUniqueIds'> : never : never;
type Power = { weapon: number; hp: number; armor: number; mitigation: number };
export interface DefenseOption { hp: number; mitigationBp: number }
export interface ConsistentDefense { hp: number; mitigation: number; ehp: number }
export interface LootStatsOptions { runs?: number; presets?: readonly StatsPresetId[]; depths?: readonly number[]; seedBase?: number }
export interface StatsComparison { preset: string; depth: number | null; metric: string; target: number; actual: number; deviationPct: number | null; flagged: boolean; reason: string | null }
export interface RarityComparison {
  preset: string; ilvl: number; monsterClass: 'ordinary' | 'elite'; weights: Record<string, number>; actual: RarityCounts;
  target: RarityCounts | null; discrepancyPp: RarityCounts | null; mismatchedCells: string[];
  tolerancePp: RarityCounts | null;
}
export interface LayerStats {
  depth: number; items: number; sources: SourceCounts; rarities: RarityCounts; cumulative: number; killGold: number;
  uniqueOpportunities: number; uniqueDowngrades: number; netRare: number;
  tierShares: Record<string, number>; tierCounts: Record<string, number>; corruptedRate: number; eligibleCorruptedRate: number; averageAffixes: number;
}
export interface PresetStats {
  id: StatsPresetId; layers: LayerStats[]; checkpoints: LayerStats[];
  totals: { events: number; items: number; corrupted: number; eligible: number; averageAffixes: number; corruptedRate: number; eligibleCorruptedRate: number; maxItemDraws: number; maxEventDraws: number; validationFailures: number };
  unique: { opportunitiesPerRun: number; itemsPerRun: number; downgradeRate: number; distribution: Record<string, number> };
  firstObservedTier: Record<string, number | null>; firstUncorruptedTier: Record<string, number | null>;
  power: ({ depth: number } & Power)[];
  consistentDefense: ({ depth: number } & ConsistentDefense)[];
}
export interface LootStatsReport {
  schema: 1; options: { runs: number; presets: StatsPresetId[]; depths: number[]; seedBase: number };
  packFingerprint: string; catalogFingerprint: string; model: string[];
  presets: PresetStats[]; rarity: RarityComparison[]; comparisons: StatsComparison[];
  firstTier: { tier: number; minIlvl: number; ordinaryTarget: number; ordinaryActual: number | null; encounterTarget: number; encounterActual: number | null; vaultTarget: number | null; vaultActual: number | null; eliteActual: number | null }[];
  summary: { flaggedComparisons: number; rarityMismatchedCells: number; validationFailures: number; maxItemDraws: number; maxEventDraws: number };
}

/** Deterministic simulation RNG only. The production rules use caller-owned randomInt. */
export function mulberry32(seed: number): LootRandom {
  let state = seed >>> 0;
  return { randomInt(lo, hi) {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    const fraction = ((t ^ t >>> 14) >>> 0) / 4294967296;
    return lo + Math.floor(fraction * (hi - lo + 1));
  } };
}
const emptyRarities = (): RarityCounts => ({ normal: 0, magic: 0, rare: 0, unique: 0 });
const emptySources = (): SourceCounts => ({ kill: 0, floor: 0, vault: 0, encounter: 0 });
const emptyTiers = (): Record<string, number> => Object.fromEntries([1, 2, 3, 4, 5, 6].map(t => [t, 0]));
const chance = (random: LootRandom, bp: number): boolean => bp >= 10000 || (bp > 0 && random.randomInt(1, 10000) <= bp);
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const ratio = (n: number, d: number) => d === 0 ? 0 : n / d;
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
function category(random: LootRandom, other: boolean): ItemClass | null {
  const roll = random.randomInt(1, other ? 125 : 21);
  return roll <= 10 ? 'weapon' : roll <= 18 ? 'armor' : roll <= 21 ? 'ring' : null;
}
function startingItem(baseId: string): LootItemDataV1 {
  return { v: 1, baseId, ilvl: 1, rarity: 'normal', uniqueId: null, setId: null, affixes: [], corrupted: false, enhancement: 0, sockets: 0, socketed: [], nameParts: null, origin: { source: 'floor', depth: 1 } };
}
interface HeldItem { data: LootItemDataV1; category: ItemClass; modifiers: LootModifierDraft[] }
function held(data: LootItemDataV1, catalog: EffectiveLootCatalog): HeldItem {
  return { data, category: lootItemClass(data.baseId, catalog)!, modifiers: projectItemModifiers(data, catalog) };
}
const stat = (item: HeldItem, name: string, category?: string) => sum(item.modifiers.filter(m => m.stat === name && (category === undefined || m.category === category)).map(m => m.value));
const bestTwo = (values: number[]) => [...values, 0, 0].sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
function powerAt(depth: number, inventory: HeldItem[], catalog: EffectiveLootCatalog): Power {
  const scrolls = Math.floor(.6 * depth);
  const weaponScrolls = Math.ceil(scrolls / 2);
  const armorScrolls = Math.floor(scrolls / 2);
  const rings = inventory.filter(i => i.category === 'ring');
  let weapon = 0;
  let armor = 0;
  let armorHp = 0;
  let armorMitigation = 0;
  for (const item of inventory) {
    const e = Math.min(item.category === 'weapon' ? weaponScrolls : armorScrolls, enhancementCap(item.data, catalog.pack));
    if (item.category === 'weapon') {
      const damage = weapons.find(w => w.id === item.data.baseId)!.damage;
      const match = /^(\d+)d(\d+)(?:\+(\d+))?$/.exec(damage);
      if (!match) throw new Error(`Unsupported damage expression: ${damage}`);
      const x = Number(match[1]); const y = Number(match[2]); const z = Number(match[3] ?? 0);
      const flat = item.modifiers.filter(m => m.stat === 'loot.local.damage' && m.category === 'local-flat');
      const flatMin = flat[0]?.value ?? 0; const flatMax = flat[1]?.value ?? 0;
      const local = stat(item, 'loot.local.damage', 'local-increased');
      const enchantment = stat(item, 'native.weapon-enchant');
      const value = ((x + z + flatMin) + (x * y + z + flatMax)) / 2 * Math.max(0, 10000 + local + 1000 * e) / 10000 * 1.065 ** (enchantment + Math.floor(e / 3));
      weapon = Math.max(weapon, value);
    } else if (item.category === 'armor') {
      const base = armors.find(a => a.id === item.data.baseId)!.armor;
      const local = stat(item, 'loot.local.armor', 'local-increased');
      const plated = sum(item.modifiers.filter(m => m.stat === 'native.defense').map(m => m.value / (m.unit === 'int' ? 10 : 1)));
      armor = Math.max(armor, Math.min(22, base * (10000 + local) / 10000 + plated + .5 * e));
      armorHp = Math.max(armorHp, stat(item, 'native.max-hp') + 5 * e);
      armorMitigation = Math.max(armorMitigation, -stat(item, 'native.physical-damage-taken'));
    }
  }
  return { weapon, armor, hp: 30 + 10 * Math.floor(depth / 4) + armorHp + bestTwo(rings.map(i => stat(i, 'native.max-hp'))),
    mitigation: Math.min(5000, armorMitigation + bestTwo(rings.map(i => -stat(i, 'native.physical-damage-taken')))) / 100 };
}

/** Exact slot-constrained EHP proxy; empty slots are legal and never duplicate a real ring.
 * Pareto pruning is applied to completed pairs, not individual rings: a dominated ring
 * can still belong to the best pair when its dominator is the other equipped ring.
 */
export function bestConsistentDefense(baseHp: number, armors: readonly DefenseOption[], rings: readonly DefenseOption[], capBp = 5000): ConsistentDefense {
  const empty: DefenseOption = { hp: 0, mitigationBp: 0 };
  const slots = [empty, empty, ...rings];
  const pairs: DefenseOption[] = [];
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    pairs.push({ hp: slots[i]!.hp + slots[j]!.hp, mitigationBp: slots[i]!.mitigationBp + slots[j]!.mitigationBp });
  }
  pairs.sort((a, b) => b.hp - a.hp || b.mitigationBp - a.mitigationBp);
  let maxMitigation = -Infinity;
  const frontier = pairs.filter(pair => {
    if (pair.mitigationBp <= maxMitigation) return false;
    maxMitigation = pair.mitigationBp;
    return true;
  });
  let best: ConsistentDefense = { hp: baseHp, mitigation: 0, ehp: baseHp };
  for (const armor of [empty, ...armors]) for (const pair of frontier) {
    const hp = Math.max(1, baseHp + armor.hp + pair.hp);
    const mitigationBp = Math.min(capBp, armor.mitigationBp + pair.mitigationBp);
    const ehp = hp / (1 - mitigationBp / 10000);
    if (ehp > best.ehp) best = { hp, mitigation: mitigationBp / 100, ehp };
  }
  return best;
}
function consistentDefenseAt(depth: number, inventory: HeldItem[], catalog: EffectiveLootCatalog): ConsistentDefense {
  const armorScrolls = Math.floor(Math.floor(.6 * depth) / 2);
  const armors = inventory.filter(item => item.category === 'armor').map(item => ({
    hp: stat(item, 'native.max-hp') + 5 * Math.min(armorScrolls, enhancementCap(item.data, catalog.pack)),
    mitigationBp: -stat(item, 'native.physical-damage-taken'),
  }));
  const rings = inventory.filter(item => item.category === 'ring').map(item => ({
    hp: stat(item, 'native.max-hp'), mitigationBp: -stat(item, 'native.physical-damage-taken'),
  }));
  return bestConsistentDefense(30 + 10 * Math.floor(depth / 4), armors, rings);
}

function reasonFor(metric: string, preset: string): string {
  if (metric.startsWith('power.')) return 'D：乐观代理逐指标独立取最大，忽略力量/成长/鉴定；减伤另列按1甲+至多2戒的EHP最优一致装备代理。保持数据；武器/护甲目标留到6B2真实力量曲线复测。';
  if (metric.startsWith('consistentDefense.')) return 'D：一致装备按EHP而非单独减伤选装，仍忽略鉴定/成长/攻速/符文和护甲命中效应；保持数据，待6B2/6Z实测。';
  if (preset === 'bountiful') return 'A：v1粗模型遗漏elite[1,3]和寻宝反馈；v1.1接受D26约21件/层。当前净稀有/降级前机会口径已修正，残差为模型与有限样本差异；保持数据。';
  return 'A：文档粗模型/有限样本差异；当前唯一按降级前机会、稀有剔除唯一降级。保持数据，不以残差改掉率或抽取次序。';
}
function compare(preset: string, depth: number | null, metric: string, actual: number, target: number): StatsComparison {
  const absolute = Math.abs(actual - target);
  const deviationPct = target === 0 ? null : (actual - target) / target * 100;
  const flagged = absolute > .02 && (target === 0 ? absolute > 0 : absolute / Math.abs(target) > .2);
  return { preset, depth, metric, target, actual, deviationPct, flagged, reason: flagged ? reasonFor(metric, preset) : null };
}

export function computeLootStats(options: LootStatsOptions = {}): LootStatsReport {
  const runs = options.runs ?? 300;
  const seedBase = options.seedBase ?? 1;
  const presetIds = [...(options.presets ?? PRESET_IDS)];
  const depths = [...(options.depths ?? Array.from({ length: 26 }, (_, i) => i + 1))];
  if (!Number.isSafeInteger(runs) || runs < 1 || !Number.isSafeInteger(seedBase) || seedBase < 0 || seedBase > 0xffffffff
    || !presetIds.length || new Set(presetIds).size !== presetIds.length || presetIds.some(p => !PRESET_IDS.includes(p))
    || !depths.length || new Set(depths).size !== depths.length || depths.some(d => !Number.isInteger(d) || d < 1 || d > 26)) throw new RangeError('Invalid statistics options');
  depths.sort((a, b) => a - b);
  const maximumDepth = Math.max(...depths);
  const pack = loadLootPack();
  const catalog = buildEffectiveLootCatalog(pack, { combat: null, growth: null, giants: null });
  const monsterClasses = new Map(pack.monsterClasses.members.map(m => [m.typeId, m.class]));
  const excludedAllies = ['unicorn', 'ifrit', 'phoenix', 'mangrove_dryad'];
  const monsterPools = Array.from({ length: maximumDepth + 1 }, (_, d) => monsters.filter(m => m.minDepth <= d && d <= m.maxDepth && monsterClasses.get(m.id) !== 'none' && !excludedAllies.includes(m.id)));
  const presets: PresetStats[] = [];
  const rarity: RarityComparison[] = [];
  const comparisons: StatsComparison[] = [];
  for (const id of presetIds) {
    const preset = pack.presets.presets.find(p => p.id === id)!;
    const layers = Array.from({ length: maximumDepth }, (_, i) => ({ depth: i + 1, items: 0, sources: emptySources(), rarities: emptyRarities(), cumulative: 0, killGold: 0,
      uniqueOpportunities: 0,
      tierCounts: emptyTiers(), tierShares: emptyTiers(), corruptedRate: 0, eligibleCorruptedRate: 0, averageAffixes: 0, rawCorrupted: 0, rawEligible: 0, rawAffixes: 0 }));
    const totals = { events: 0, items: 0, corrupted: 0, eligible: 0, averageAffixes: 0, corruptedRate: 0, eligibleCorruptedRate: 0, maxItemDraws: 0, maxEventDraws: 0, validationFailures: 0 };
    const unique = { opportunitiesPerRun: 0, itemsPerRun: 0, downgradeRate: 0, distribution: Object.fromEntries(pack.uniques.uniques.map(u => [u.id, 0])) };
    const firstObservedTier: Record<string, number | null> = Object.fromEntries([1, 2, 3, 4, 5, 6].map(t => [t, null]));
    const firstUncorruptedTier = { ...firstObservedTier };
    const powers = Array.from({ length: maximumDepth }, () => ({ weapon: [] as number[], hp: [] as number[], armor: [] as number[], mitigation: [] as number[] }));
    const defenses = Array.from({ length: maximumDepth }, () => ({ hp: [] as number[], mitigation: [] as number[], ehp: [] as number[] }));
    for (let run = 0; run < runs; run++) {
      const random = mulberry32(seedBase + run);
      const claimed: string[] = [];
      const inventory = [held(startingItem('dagger'), catalog), held(startingItem('leather_armor'), catalog)];
      let rarityFindBp = 0;
      let cumulative = 0;
      for (let depth = 1; depth <= maximumDepth; depth++) {
        const layer = layers[depth - 1]!;
        const event = (eventRequest: EventRequest) => {
          const request = { v: 1, depth, presetId: id, rarityFindBp, claimedUniqueIds: [...claimed], ...eventRequest } as LootRollRequest;
          const { result, trace } = rollLootWithTrace(catalog, request, random);
          totals.events++;
          totals.maxEventDraws = Math.max(totals.maxEventDraws, result.draws);
          totals.maxItemDraws = Math.max(totals.maxItemDraws, ...trace.itemDraws);
          unique.opportunitiesPerRun += trace.uniqueOpportunities;
          layer.uniqueOpportunities += trace.uniqueOpportunities;
          if (request.source === 'kill') layer.killGold += result.gold;
          claimed.push(...result.newUniqueIds);
          for (const generated of result.items) {
            const data = generated.data;
            if (!validateLootItemData(data, catalog)) totals.validationFailures++;
            const item = held(data, catalog);
            inventory.push(item);
            layer.items++; cumulative++; totals.items++;
            layer.sources[request.source]++;
            layer.rarities[data.rarity as keyof RarityCounts]++;
            layer.rawAffixes += data.affixes.length; totals.averageAffixes += data.affixes.length;
            if (data.corrupted) { layer.rawCorrupted++; totals.corrupted++; }
            if (data.rarity === 'magic' || data.rarity === 'rare') { layer.rawEligible++; totals.eligible++; }
            if (data.uniqueId) { unique.itemsPerRun++; unique.distribution[data.uniqueId] = (unique.distribution[data.uniqueId] ?? 0) + 1; }
            for (const affix of data.affixes) if (affix.tier > 0) {
              layer.tierCounts[affix.tier] = (layer.tierCounts[affix.tier] ?? 0) + 1;
              if (firstObservedTier[affix.tier] === null || depth < firstObservedTier[affix.tier]!) firstObservedTier[affix.tier] = depth;
              if (!data.corrupted && (firstUncorruptedTier[affix.tier] === null || depth < firstUncorruptedTier[affix.tier]!)) firstUncorruptedTier[affix.tier] = depth;
            }
          }
          rarityFindBp = bestTwo(inventory.filter(i => i.category === 'ring').map(i => stat(i, 'loot.rarity-find')));
        };
        // K(d)=12+0.35d, implemented in integer hundredths to avoid float boundary drift.
        const kills = Math.floor((1200 + 35 * depth) / 100) + (chance(random, (35 * depth % 100) * 100) ? 1 : 0);
        const pool = monsterPools[depth]!;
        if (!pool.length) throw new Error(`Empty monster pool at depth ${depth}`);
        for (let k = 0; k < kills; k++) {
          const monster = pool[pool.length === 1 ? 0 : random.randomInt(0, pool.length - 1)]!;
          event({ source: 'kill', monster: { typeId: monster.id, leader: false, champion: false, encounterSubject: false } } as EventRequest);
        }
        let floorItems = 3 + (depth <= 2 ? 2 : depth <= 4 ? 1 : 0);
        while (chance(random, 6000)) floorItems++;
        for (let f = 0; f < floorItems; f++) {
          const itemClass = category(random, true);
          if (itemClass) event({ source: 'floor', itemClass } as EventRequest);
        }
        if (chance(random, 3000)) event({ source: 'vault', itemClass: category(random, false)!, baseId: null, highValue: false } as EventRequest);
        const encounterChance = depth <= 2 || depth >= 21 ? 0 : depth <= 6 ? 5000 : depth <= 8 ? 7000 : 10000;
        if (chance(random, encounterChance)) event({ source: 'encounter', formId: null } as EventRequest);
        layer.cumulative += cumulative;
        if (id === 'standard') {
          const power = powerAt(depth, inventory, catalog);
          for (const metric of ['weapon', 'hp', 'armor', 'mitigation'] as const) powers[depth - 1]![metric].push(power[metric]);
          const defense = consistentDefenseAt(depth, inventory, catalog);
          for (const metric of ['hp', 'mitigation', 'ehp'] as const) defenses[depth - 1]![metric].push(defense[metric]);
        }
      }
    }
    const outputLayers: LayerStats[] = layers.map(layer => {
      const affixes = sum(Object.values(layer.tierCounts));
      return { depth: layer.depth, items: layer.items / runs, sources: Object.fromEntries(Object.entries(layer.sources).map(([k, v]) => [k, v / runs])) as SourceCounts,
        rarities: Object.fromEntries(Object.entries(layer.rarities).map(([k, v]) => [k, v / runs])) as RarityCounts, cumulative: layer.cumulative / runs, killGold: layer.killGold / runs,
        uniqueOpportunities: layer.uniqueOpportunities / runs, uniqueDowngrades: (layer.uniqueOpportunities - layer.rarities.unique) / runs,
        netRare: (layer.rarities.rare - (layer.uniqueOpportunities - layer.rarities.unique)) / runs,
        tierCounts: layer.tierCounts, tierShares: Object.fromEntries(Object.entries(layer.tierCounts).map(([k, v]) => [k, ratio(v, affixes)])),
        corruptedRate: ratio(layer.rawCorrupted, layer.items), eligibleCorruptedRate: ratio(layer.rawCorrupted, layer.rawEligible), averageAffixes: ratio(layer.rawAffixes, layer.items) };
    }).filter(layer => depths.includes(layer.depth));
    totals.averageAffixes = ratio(totals.averageAffixes, totals.items);
    totals.corruptedRate = ratio(totals.corrupted, totals.items);
    totals.eligibleCorruptedRate = ratio(totals.corrupted, totals.eligible);
    unique.downgradeRate = ratio(unique.opportunitiesPerRun - unique.itemsPerRun, unique.opportunitiesPerRun);
    unique.opportunitiesPerRun /= runs; unique.itemsPerRun /= runs;
    for (const key of Object.keys(unique.distribution)) unique.distribution[key] = unique.distribution[key]! / runs;
    const power = id === 'standard' ? depths.map(depth => ({ depth, weapon: median(powers[depth - 1]!.weapon), hp: median(powers[depth - 1]!.hp), armor: median(powers[depth - 1]!.armor), mitigation: median(powers[depth - 1]!.mitigation) })) : [];
    const consistentDefense = id === 'standard' ? depths.map(depth => ({ depth, hp: median(defenses[depth - 1]!.hp), mitigation: median(defenses[depth - 1]!.mitigation), ehp: median(defenses[depth - 1]!.ehp) })) : [];
    presets.push({ id, layers: outputLayers, checkpoints: outputLayers.filter(l => (CHECKPOINT_DEPTHS as readonly number[]).includes(l.depth)), totals, unique, firstObservedTier, firstUncorruptedTier, power, consistentDefense });
    for (const target of LAYER_TARGETS[id]) {
      const layer = outputLayers.find(l => l.depth === target.depth);
      if (!layer) continue;
      for (const metric of ['items', 'cumulative', 'killGold'] as const) comparisons.push(compare(id, layer.depth, metric, layer[metric], target[metric]));
      for (const metric of ['kill', 'floor', 'vault', 'encounter'] as const) comparisons.push(compare(id, layer.depth, metric, layer.sources[metric], target[metric]));
      for (const metric of RARITY_IDS) comparisons.push(compare(id, layer.depth, metric,
        metric === 'unique' ? layer.uniqueOpportunities : metric === 'rare' ? layer.netRare : layer.rarities[metric], target[metric]));
    }
    if (maximumDepth === 26) comparisons.push(compare(id, null, 'unique.opportunities', unique.opportunitiesPerRun, UNIQUE_OPPORTUNITY_TARGETS[id]));
    if (id === 'standard') for (const target of POWER_TARGETS) {
      const p = power.find(p => p.depth === target.depth);
      if (p) for (const metric of ['weapon', 'hp', 'armor', 'mitigation'] as const) comparisons.push(compare(id, p.depth, `power.${metric}`, p[metric], target[metric]));
      const defense = consistentDefense.find(p => p.depth === target.depth);
      if (defense) comparisons.push(compare(id, defense.depth, 'consistentDefense.mitigation', defense.mitigation, target.mitigation));
    }
    for (const target of RARITY_TARGETS[id]) for (const monsterClass of ['ordinary', 'elite'] as const) {
      const weights = computeRarityWeights(preset, target.ilvl, monsterClass === 'elite' ? 5000 : 0, 10000, 0, null);
      const total = sum(Object.values(weights));
      const actual = Object.fromEntries(RARITY_IDS.map(r => [r, weights[r] / total * 100])) as RarityCounts;
      const source = target[monsterClass];
      const targetValues = source ? Object.fromEntries(RARITY_IDS.map((r, i) => [r, source[i]])) as RarityCounts : null;
      const discrepancies = targetValues ? Object.fromEntries(RARITY_IDS.map(r => [r, actual[r] - targetValues[r]])) as RarityCounts : null;
      const tolerancePp = source ? Object.fromEntries(RARITY_IDS.map((r, i) => [r, target.tolerancePp[monsterClass]![i]!])) as RarityCounts : null;
      rarity.push({ preset: id, ilvl: target.ilvl, monsterClass, weights, actual, target: targetValues, discrepancyPp: discrepancies,
        tolerancePp, mismatchedCells: discrepancies ? RARITY_IDS.filter(r => Math.abs(discrepancies[r]) > tolerancePp![r]) : [] });
    }
  }
  const earliest = (minIlvl: number, bonus: number): number | null => {
    for (let depth = 1; depth <= 99; depth++) if (Math.floor(depth * pack.ilvl.ilvlPerDepthBp / 10000) + bonus >= minIlvl) return depth;
    return null;
  };
  const firstTier = FIRST_TIER_TARGETS.map(t => ({ tier: t.tier, minIlvl: t.minIlvl, ordinaryTarget: t.ordinary, ordinaryActual: earliest(t.minIlvl, pack.ilvl.sourceBonus.floor),
    encounterTarget: t.encounter, encounterActual: earliest(t.minIlvl, pack.ilvl.sourceBonus.encounter), vaultTarget: t.vault, vaultActual: earliest(t.minIlvl, pack.ilvl.sourceBonus.vault),
    eliteActual: earliest(t.minIlvl, pack.ilvl.sourceBonus.kill + pack.ilvl.classBonus.elite) }));
  return { schema: 1, options: { runs, presets: presetIds, depths, seedBase }, packFingerprint: getLootPackIdentity().fingerprint, catalogFingerprint: catalog.fingerprint,
    model: [
      '任务书§10.2：mulberry32，seedBase+runIndex；三个预设独立使用同一种子集；模型与生成器共用每局随机流。',
      '每层按击杀→楼层→宝库→遭遇执行；唯一结果/0或100%模型事件不抽随机数；楼层完整几何件数先抽完，再逐件类别与生成。',
      'combat/growth/giants可用性均为空；击杀使用原生数据深度合法且非none、排除四种传说盟友的等权怪物池。',
      '每局唯一收据累积；寻宝取已获得戒指中fortune与gambler行总值最高两件，每个完整事件后更新。',
      '逐层unique比较降级前trace.uniqueOpportunities；rare比较净稀有=产出rare−(机会−产出unique)，产出稀有度另列且仍合计为件数。',
      '金币只统计kill来源，排除Boss金币；原生楼层金币仅转录为背景目标，不模拟原生金币调度。',
      '强度口径不同（独立取最大、忽略力量/成长/鉴定），仅作复核提示；包含起始匕首与皮甲，不计入掉落件数。',
      '强度每层假设E=floor(0.6d)张卷轴分配给被评估武器/护甲并分别截顶；各指标允许独立最优装备与两戒指，负收益可不装备。',
      '一致减伤代理精确枚举1甲+至多2件不同戒指（允许空槽），按EHP=HP/(1−减伤)选同一套装备；仅对已完成戒指对作Pareto去重，不截候选。生命/卷轴假设沿用乐观代理；不计护甲命中效应、力量、成长或鉴定，不代替真实生存倍率。',
      '阶分布计所有非唯一词缀（含腐化负面/补偿）；首次观察另列未腐化样本；理论首次层数不受该层事件概率为零影响。',
      '数值表v1.1：ilvl15/30的elite目标未刊，记null；稀有度容差为打印精度半单位：整数格±0.5百分点、一位小数格±0.05百分点（保留1.0等尾零），原19个整数打印超差消失。',
      '偏差阈值：绝对差>0.02且相对差>20%；目标为0时非零且绝对差>0.02标记，相对偏差记null。',
    ], presets, rarity, comparisons, firstTier,
    summary: { flaggedComparisons: comparisons.filter(c => c.flagged).length, rarityMismatchedCells: sum(rarity.map(r => r.mismatchedCells.length)),
      validationFailures: sum(presets.map(p => p.totals.validationFailures)), maxItemDraws: Math.max(...presets.map(p => p.totals.maxItemDraws)), maxEventDraws: Math.max(...presets.map(p => p.totals.maxEventDraws)) } };
}

const format = (n: number | null | undefined, digits = 3): string => n === null || n === undefined ? '—' : Number(n.toFixed(digits)).toString();
export function renderLootStatsMarkdown(report: LootStatsReport): string {
  const lines = ['# 6B1-α 真实生成器统计', '', `运行：${report.options.runs} 局 × ${report.options.presets.join('/')}；seedBase=${report.options.seedBase}；D${report.options.depths[0]}–${report.options.depths[report.options.depths.length - 1]}`, '',
    `数据指纹：${report.packFingerprint}；有效目录：${report.catalogFingerprint}`, '', ...report.model.map(s => `- ${s}`), '',
    `汇总：>±20% 标记 ${report.summary.flaggedComparisons} 项；稀有度超打印精度半单位 ${report.summary.rarityMismatchedCells} 格；生成物校验失败 ${report.summary.validationFailures}；单件/事件最大抽取 ${report.summary.maxItemDraws}/${report.summary.maxEventDraws}`, ''];
  for (const preset of report.presets) {
    lines.push(`## ${preset.id} 每层明细`, '', '| 深度 | 件数 | 击杀/楼层/宝库/Boss | 产出普/魔/稀/唯 | 唯一机会/降级/净稀有 | 累计 | 击杀金币 | T1/T2/T3/T4/T5/T6 % | 腐化/合资格 % | 平均词缀 |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const l of preset.layers) lines.push(`| ${l.depth} | ${format(l.items)} | ${Object.values(l.sources).map(v => format(v)).join('/')} | ${Object.values(l.rarities).map(v => format(v)).join('/')} | ${[l.uniqueOpportunities, l.uniqueDowngrades, l.netRare].map(v => format(v)).join('/')} | ${format(l.cumulative)} | ${format(l.killGold)} | ${Object.values(l.tierShares).map(v => format(v * 100, 2)).join('/')} | ${format(l.corruptedRate * 100)}/${format(l.eligibleCorruptedRate * 100)} | ${format(l.averageAffixes)} |`);
    lines.push('', `唯一机会/局 ${format(preset.unique.opportunitiesPerRun)}；实际唯一/局 ${format(preset.unique.itemsPerRun)}；降级 ${format(preset.unique.downgradeRate * 100)}%；全部物品腐化率 ${format(preset.totals.corruptedRate * 100)}%；合资格物品腐化率 ${format(preset.totals.eligibleCorruptedRate * 100)}%；平均词缀 ${format(preset.totals.averageAffixes)}`, '', '| 唯一ID | 件/局 |', '|---|---|');
    for (const [id, count] of Object.entries(preset.unique.distribution)) lines.push(`| ${id} | ${format(count)} |`);
    lines.push('', '| 阶 | 首次观察D | 首次未腐化D |', '|---|---|---|');
    for (const tier of Object.keys(preset.firstObservedTier)) lines.push(`| ${tier} | ${format(preset.firstObservedTier[tier])} | ${format(preset.firstUncorruptedTier[tier])} |`);
    lines.push('');
  }
  const standard = report.presets.find(p => p.id === 'standard');
  if (standard) {
    lines.push('## 标准减伤代理并列（中位数）', '', '| 深度 | 乐观HP/减伤% | 一致装备HP/减伤%/EHP |', '|---|---|---|');
    for (const p of standard.power) {
      const defense = standard.consistentDefense.find(d => d.depth === p.depth)!;
      lines.push(`| ${p.depth} | ${format(p.hp)}/${format(p.mitigation)} | ${format(defense.hp)}/${format(defense.mitigation)}/${format(defense.ehp)} |`);
    }
    lines.push('');
  }
  lines.push('## 稀有度精确权重与原表逐格审计', '', '每格：目标 → 实际（百分点差）；* = 超过打印精度半单位（整数±0.5、一位小数±0.05百分点，保留尾零）。测试另用独立手算权重逐格验证实现。ilvl15/30 elite原表无目标。', '', '| 预设 | ilvl/分级 | 权重 普/魔/稀/唯 | 普 % | 魔 % | 稀 % | 唯 % |', '|---|---|---|---|---|---|---|');
  for (const row of report.rarity) lines.push(`| ${row.preset} | ${row.ilvl}/${row.monsterClass} | ${RARITY_IDS.map(r => row.weights[r]).join('/')} | ${RARITY_IDS.map(r => `${row.target ? format(row.target[r]) : '未刊'} → ${format(row.actual[r])}${row.discrepancyPp ? ` (${format(row.discrepancyPp[r])})` : ''}${row.mismatchedCells.includes(r) ? '*' : ''}`).join(' | ')} |`);
  lines.push('', '## 全部目标比较', '', '| 预设 | 深度 | 指标 | 目标 | 实际 | 相对偏差% | 标记 |', '|---|---|---|---|---|---|---|');
  for (const c of report.comparisons) lines.push(`| ${c.preset} | ${c.depth ?? '全局'} | ${c.metric} | ${format(c.target)} | ${format(c.actual)} | ${format(c.deviationPct)} | ${c.flagged ? '偏差>20%' : '—'} |`);
  lines.push('', '### 标记逐项归因与可选建议（不改数据）', '');
  for (const c of report.comparisons.filter(c => c.flagged)) lines.push(`- ${c.preset} ${c.depth === null ? '全局' : `D${c.depth}`} ${c.metric}：目标 ${format(c.target)}，实际 ${format(c.actual)}，偏差 ${format(c.deviationPct)}%；${c.reason}`);
  lines.push('', '## 理论首次可得阶梯核对', '', '以下是未腐化解锁层数；腐化补偿可提前一阶。遭遇模型仅D3–20发生，理论D1/D24不代表该事件在统计模型中实际存在。elite +1令T6在D26可得。', '', '| 阶 | 普通目标/公式 | Boss目标/公式 | 宝库目标/公式 | elite公式 |', '|---|---|---|---|---|');
  for (const t of report.firstTier) lines.push(`| T${t.tier} | ${t.ordinaryTarget}/${t.ordinaryActual} | ${t.encounterTarget}/${t.encounterActual} | ${t.vaultTarget ?? '未刊'}/${t.vaultActual} | ${t.eliteActual} |`);
  lines.push('', '## 原生楼层金币参考（仅目标背景，未模拟）', '', '| 预设 | 深度 | 原生楼层金币 |', '|---|---|---|');
  for (const id of report.options.presets) for (const t of LAYER_TARGETS[id]) lines.push(`| ${id} | ${t.depth} | ${t.nativeFloorGold} |`);
  return lines.join('\n') + '\n';
}
