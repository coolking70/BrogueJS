import { describe, expect, it } from 'vitest';
import { loadLootPack } from '../definitions';
import { enhancementCap, familiarityThresholds, goldRange, monsterScalingAt, ringImplicit, salvageYield } from '../economy';
import type { LootItemDataV1 } from '../types';
const item = (rarity: LootItemDataV1['rarity'], ilvl = 1, corrupted = false): LootItemDataV1 => ({ v: 1, baseId: 'dagger', ilvl, rarity, uniqueId: null, setId: null, affixes: [], corrupted, enhancement: 0, sockets: 0, socketed: [], nameParts: null, origin: { source: 'floor', depth: 1 } });
const preset = (id = 'standard') => loadLootPack().presets.presets.find(p => p.id === id)!;

describe('pure loot economy §9', () => {
  it.each([[1, 0, 0], [7, 3500, 8200], [23, 4500, 7750], [26, 4000, 6500], [30, 4000, 6500]])('standard scaling D%i', (d, hpBp, damageBp) => {
    expect(monsterScalingAt(preset(), d)).toEqual({ hpBp, damageBp, accuracyBp: 0 });
  });
  it('floors descending interpolation rather than truncating negative fractions', () => expect(monsterScalingAt(preset(), 21)).toEqual({ hpBp: 4833, damageBp: 8583, accuracyBp: 0 }));
  it('clamps before first and after last anchors and retains every anchor exactly', () => {
    expect(monsterScalingAt(preset(), 0)).toEqual({ hpBp: 0, damageBp: 0, accuracyBp: 0 });
    for (const p of loadLootPack().presets.presets) for (const a of p.monsterScaling) expect(monsterScalingAt(p, a.depth)).toEqual({ hpBp: a.hpBp, damageBp: a.damageBp, accuracyBp: a.accuracyBp });
  });
  it('gold D10 is [35,75]', () => expect(goldRange(10)).toEqual([35, 75]));
  it('salvage stage floors, corruption multiplier and minimum', () => {
    expect(salvageYield(item('rare', 16, true), preset())).toBe(24);
    expect(salvageYield(item('normal'), preset('bountiful'))).toBe(1);
    expect(salvageYield(item('magic', 1, true), preset('bountiful'))).toBe(3);
    expect(salvageYield(item('unique', 20), preset())).toBe(60);
  });
  it('familiarity rarity multipliers round upward', () => {
    expect(familiarityThresholds(item('magic'), preset())).toEqual({ weaponKills: 5, armorTurns: 300, ringTurns: 400 });
    expect(familiarityThresholds(item('unique'), preset()).armorTurns).toBe(900);
    expect(familiarityThresholds(item('unique'), { ...preset(), familiarity: { weaponKills: 1, armorTurns: 1, ringTurns: 1 } })).toEqual({ weaponKills: 2, armorTurns: 2, ringTurns: 2 });
  });
  it.each([['normal', 10], ['magic', 8], ['rare', 6], ['unique', 4], ['set', 4], ['runeword', 0]] as const)('enhancement %s cap %i', (rarity, cap) => expect(enhancementCap(item(rarity))).toBe(cap));
  it.each([[1, 1], [14, 1], [15, 2], [30, 3], [45, 4], [99, 4]])('ring implicit ilvl%i = %i', (ilvl, expected) => expect(ringImplicit(ilvl)).toBe(expected));
});
