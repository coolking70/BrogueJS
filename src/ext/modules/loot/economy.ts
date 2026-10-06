import { loadLootPack } from './definitions';
import type { LootItemDataV1, LootPack, LootPreset } from './types';

/** The helpers use immutable rules only; no state or random stream is touched. */
export function monsterScalingAt(preset: LootPreset, depth: number): { hpBp: number; damageBp: number; accuracyBp: number } {
  const anchors = preset.monsterScaling;
  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;
  if (depth <= first.depth) return { hpBp: first.hpBp, damageBp: first.damageBp, accuracyBp: first.accuracyBp };
  if (depth >= last.depth) return { hpBp: last.hpBp, damageBp: last.damageBp, accuracyBp: last.accuracyBp };
  const high = anchors.findIndex(a => a.depth >= depth);
  const a = anchors[high - 1]!;
  const b = anchors[high]!;
  const interpolate = (key: 'hpBp' | 'damageBp' | 'accuracyBp') => a[key] + Math.floor((b[key] - a[key]) * (depth - a.depth) / (b.depth - a.depth));
  return { hpBp: interpolate('hpBp'), damageBp: interpolate('damageBp'), accuracyBp: interpolate('accuracyBp') };
}

export function goldRange(depth: number, pack: LootPack = loadLootPack()): [number, number] {
  const amount = pack.gold.amount;
  return [amount.minBase + amount.minPerDepth * depth, amount.maxBase + amount.maxPerDepth * depth];
}

export function salvageYield(data: LootItemDataV1, preset: LootPreset, pack: LootPack = loadLootPack()): number {
  const base = pack.salvage.base[data.rarity as keyof typeof pack.salvage.base];
  if (base === undefined) throw new RangeError('Unsupported salvage rarity');
  let q = base * (1 + Math.floor(data.ilvl / pack.salvage.ilvlStep));
  q = Math.floor(q * preset.salvageMultiplierBp / 10000);
  if (data.corrupted) q = Math.floor(q * pack.salvage.corruptedMultiplierBp / 10000);
  return Math.max(pack.salvage.minimum, q);
}

export function familiarityThresholds(data: LootItemDataV1, preset: LootPreset, pack: LootPack = loadLootPack()): { weaponKills: number; armorTurns: number; ringTurns: number } {
  const multiplier = pack.identify.familiarityMultiplierBp[data.rarity as keyof typeof pack.identify.familiarityMultiplierBp];
  if (multiplier === undefined) throw new RangeError('Unsupported familiarity rarity');
  return {
    weaponKills: Math.ceil(preset.familiarity.weaponKills * multiplier / 10000),
    armorTurns: Math.ceil(preset.familiarity.armorTurns * multiplier / 10000),
    ringTurns: Math.ceil(preset.familiarity.ringTurns * multiplier / 10000),
  };
}

export function enhancementCap(data: Pick<LootItemDataV1, 'rarity'>, pack: LootPack = loadLootPack()): number {
  const rarity = pack.rarities.rarities.find(r => r.id === data.rarity);
  if (!rarity) throw new RangeError('Unknown rarity');
  return rarity.enhancementCap;
}

export function ringImplicit(ilvl: number, pack: LootPack = loadLootPack()): number {
  const rules = pack.bases.ringImplicit;
  return Math.max(rules.min, Math.min(rules.max, rules.base + Math.floor(ilvl / rules.ilvlStep)));
}
