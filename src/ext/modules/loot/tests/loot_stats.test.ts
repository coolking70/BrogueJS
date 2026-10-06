import { describe, expect, it } from 'vitest';
import { bestConsistentDefense, computeLootStats, mulberry32, renderLootStatsMarkdown } from '../tools/stats';
import type { DefenseOption } from '../tools/stats';
import { FIRST_TIER_TARGETS, LAYER_TARGETS, POWER_TARGETS, RARITY_IDS, RARITY_TARGETS, rarityTolerancePp } from '../tools/doc-targets';

// Independent integer hand-calculation from taskbook §7.4. Taskbook/source example correction:
// v1.1 B3 corrects the old ±0.15 pp integer-cell audit to half the printed unit.
// Keep the independent exact weights and every discrepancy assertion unchanged.
const exactWeights = {
  scarce: [
    [[850, 121, 27, 3], [850, 181, 40, 4]],
    [[850, 138, 33, 3], [850, 207, 49, 4]],
    [[850, 156, 39, 4], [850, 234, 58, 6]],
    [[850, 166, 42, 4], [850, 249, 63, 6]],
  ],
  standard: [
    [[700, 223, 71, 10], [700, 334, 106, 15]],
    [[700, 269, 96, 13], [700, 403, 144, 19]],
    [[700, 319, 122, 17], [700, 478, 183, 25]],
    [[700, 348, 138, 19], [700, 522, 207, 28]],
  ],
  bountiful: [
    [[480, 334, 164, 30], [480, 501, 246, 45]],
    [[480, 404, 232, 43], [480, 606, 348, 64]],
    [[480, 478, 304, 57], [480, 717, 456, 85]],
    [[480, 523, 347, 65], [480, 784, 520, 97]],
  ],
};

describe('real-generator statistics §10', () => {
  it('is fully deterministic for five full runs per preset, validates every item, and reports complete evidence', () => {
    const first = computeLootStats({ runs: 5 });
    expect(computeLootStats({ runs: 5 })).toEqual(first);
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(first.options).toEqual({ runs: 5, seedBase: 1, presets: ['scarce', 'standard', 'bountiful'], depths: Array.from({ length: 26 }, (_, i) => i + 1) });
    expect(first.packFingerprint.length).toBeGreaterThan(12);
    expect(first.catalogFingerprint.length).toBeGreaterThan(12);
    expect(first.presets).toHaveLength(3);
    expect(first.rarity).toHaveLength(24);
    expect(first.comparisons).toHaveLength(15 * 11 + 3 + 6 * 5);
    expect(first.summary.validationFailures).toBe(0);
    expect(first.summary.maxItemDraws).toBeLessThanOrEqual(64);
    expect(first.summary.maxEventDraws).toBeLessThanOrEqual(512);
    for (const preset of first.presets) {
      expect(preset.layers).toHaveLength(26);
      expect(preset.checkpoints.map(c => c.depth)).toEqual([1, 5, 10, 15, 20, 26]);
      expect(preset.unique.distribution && Object.keys(preset.unique.distribution)).toHaveLength(8);
      expect(preset.totals.validationFailures).toBe(0);
      expect(preset.unique.itemsPerRun).toBeLessThanOrEqual(8);
      expect(preset.unique.itemsPerRun).toBeLessThanOrEqual(preset.unique.opportunitiesPerRun);
      expect(preset.unique.downgradeRate).toBeGreaterThanOrEqual(0);
      expect(preset.unique.downgradeRate).toBeLessThanOrEqual(1);
      expect(preset.layers.reduce((n, layer) => n + layer.uniqueOpportunities, 0)).toBeCloseTo(preset.unique.opportunitiesPerRun, 12);
      for (const layer of preset.layers) {
        expect(Object.values(layer.sources).reduce((a, b) => a + b, 0)).toBeCloseTo(layer.items, 12);
        expect(Object.values(layer.rarities).reduce((a, b) => a + b, 0)).toBeCloseTo(layer.items, 12);
        expect(layer.uniqueDowngrades).toBeCloseTo(layer.uniqueOpportunities - layer.rarities.unique, 12);
        expect(layer.netRare).toBeCloseTo(layer.rarities.rare - layer.uniqueDowngrades, 12);
        expect(layer.netRare).toBeGreaterThanOrEqual(0);
        const unique = first.comparisons.find(c => c.preset === preset.id && c.depth === layer.depth && c.metric === 'unique');
        const rare = first.comparisons.find(c => c.preset === preset.id && c.depth === layer.depth && c.metric === 'rare');
        if (unique) expect(unique.actual).toBe(layer.uniqueOpportunities);
        if (rare) expect(rare.actual).toBe(layer.netRare);
        const totalAffixes = Object.values(layer.tierCounts).reduce((a, b) => a + b, 0);
        expect(Object.values(layer.tierShares).reduce((a, b) => a + b, 0)).toBeCloseTo(totalAffixes ? 1 : 0, 12);
      }
    }
    expect(first.presets.find(p => p.id === 'standard')!.power).toHaveLength(26);
    for (const row of first.rarity) {
      const expected = exactWeights[row.preset as keyof typeof exactWeights][[1, 15, 30, 39].indexOf(row.ilvl)]![row.monsterClass === 'ordinary' ? 0 : 1]!;
      expect(RARITY_IDS.map(r => row.weights[r])).toEqual(expected);
      expect(row.weights.set).toBe(0);
      const total = expected.reduce((a, b) => a + b, 0);
      RARITY_IDS.forEach((r, i) => expect(row.actual[r]).toBeCloseTo(100 * expected[i]! / total, 12));
      if (row.target) {
        const mismatches = RARITY_IDS.filter(r => Math.abs(row.actual[r] - row.target![r]) > row.tolerancePp![r]);
        expect(row.mismatchedCells).toEqual(mismatches);
        for (const r of RARITY_IDS) expect(row.discrepancyPp![r]).toBeCloseTo(row.actual[r] - row.target[r], 12);
      } else {
        expect(row.monsterClass).toBe('elite'); expect([15, 30]).toContain(row.ilvl);
      }
    }
    expect(first.summary.rarityMismatchedCells).toBe(first.rarity.reduce((n, r) => n + r.mismatchedCells.length, 0));
    expect(first.summary.rarityMismatchedCells).toBe(0);
    const markdown = renderLootStatsMarkdown(first);
    expect(markdown).toContain('全部目标比较'); expect(markdown).toContain('保持数据'); expect(markdown).toContain('理论首次可得阶梯核对');
    expect(markdown).toContain('未刊');
    expect(markdown).toContain('一致装备HP/减伤%/EHP');
    expect(markdown).toContain('唯一机会/降级/净稀有');
  }, 30000);
  it('uses published tables without fabricating missing targets', () => {
    expect(Object.values(LAYER_TARGETS).flat()).toHaveLength(15);
    expect(POWER_TARGETS).toHaveLength(6);
    expect(FIRST_TIER_TARGETS).toHaveLength(6);
    expect(Object.values(RARITY_TARGETS).flat().filter(r => r.elite === null)).toHaveLength(6);
  });
  it('preserves half-unit tolerances, including printed trailing zeroes', () => {
    expect(rarityTolerancePp('70')).toBe(.5);
    expect(rarityTolerancePp('1.0')).toBe(.05);
    expect(rarityTolerancePp('0.30')).toBe(.005);
    expect(RARITY_TARGETS.standard[0]!.tolerancePp.ordinary).toEqual([.5, .5, .05, .05]);
    expect(RARITY_TARGETS.scarce[3]!.tolerancePp.ordinary).toEqual([.5, .05, .05, .05]);
  });
  it('chooses one armor and distinct rings by EHP instead of combining incompatible maxima', () => {
    // At 100 base HP, life armor =>200 EHP; warding armor =>100/.6=166.67 EHP.
    // The optimistic 200/.6=333.33 combines two armors and is impossible.
    expect(bestConsistentDefense(100, [{ hp: 100, mitigationBp: 0 }, { hp: 0, mitigationBp: 4000 }], []))
      .toEqual({ hp: 200, mitigation: 0, ehp: 200 });
    // A individually dominates B but the best legal pair is A+B, not A twice.
    expect(bestConsistentDefense(100, [], [{ hp: 30, mitigationBp: 1000 }, { hp: 20, mitigationBp: 500 }]))
      .toEqual({ hp: 150, mitigation: 15, ehp: 150 / .85 });
    expect(bestConsistentDefense(100, [], [{ hp: 30, mitigationBp: 1000 }]))
      .toEqual({ hp: 130, mitigation: 10, ehp: 130 / .9 });
    expect(bestConsistentDefense(100, [{ hp: -20, mitigationBp: -1000 }], [{ hp: -10, mitigationBp: 0 }]))
      .toEqual({ hp: 100, mitigation: 0, ehp: 100 });
    expect(bestConsistentDefense(100, [{ hp: 0, mitigationBp: 6000 }], []))
      .toEqual({ hp: 100, mitigation: 50, ehp: 200 });
  });
  it('matches exhaustive loadout selection, with no ring candidate cutoff', () => {
    const random = mulberry32(710);
    for (let run = 0; run < 30; run++) {
      const option = (): DefenseOption => ({ hp: random.randomInt(-40, 100), mitigationBp: random.randomInt(-1000, 6000) });
      const armors = Array.from({ length: 4 }, option);
      const rings = Array.from({ length: 16 }, option);
      let maximum = 100;
      const empty = { hp: 0, mitigationBp: 0 };
      const slots = [empty, empty, ...rings];
      for (const armor of [empty, ...armors]) for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
        maximum = Math.max(maximum, Math.max(1, 100 + armor.hp + slots[i]!.hp + slots[j]!.hp)
          / (1 - Math.min(5000, armor.mitigationBp + slots[i]!.mitigationBp + slots[j]!.mitigationBp) / 10000));
      }
      expect(bestConsistentDefense(100, armors, rings).ehp).toBe(maximum);
    }
  });
  it('simulates intervening depths when requesting sparse checkpoints', () => {
    const full = computeLootStats({ runs: 1, presets: ['standard'] });
    const subset = computeLootStats({ runs: 1, presets: ['standard'], depths: [26, 1, 10] });
    expect(subset.presets[0]!.layers).toEqual(full.presets[0]!.layers.filter(l => [1, 10, 26].includes(l.depth)));
    expect(subset.presets[0]!.totals).toEqual(full.presets[0]!.totals);
  });
  it.each([{ runs: 0 }, { runs: 1.5 }, { seedBase: -1 }, { depths: [] }, { depths: [0] }, { depths: [27] }, { depths: [1, 1] }, { presets: [] }])('rejects invalid options %j', options => expect(() => computeLootStats(options)).toThrow(RangeError));
  it('mulberry32 has stable known words and obeys inclusive interval conversion', () => {
    const a = mulberry32(1); const b = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const x = a.randomInt(-4, 17); expect(x).toBe(b.randomInt(-4, 17)); expect(x).toBeGreaterThanOrEqual(-4); expect(x).toBeLessThanOrEqual(17);
    }
    expect(mulberry32(1).randomInt(0, 0xffffffff)).toBe(2693262067);
  });
});
