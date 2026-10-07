import { describe, expect, it } from 'vitest';
import { enhancementCap } from '../economy';
import { validateLootItemData } from '../item';
import {
  findLootUiFixture, getLootUiFixture, LOOT_UI_FIXTURE_IDS, LOOT_UI_FIXTURE_RECIPES,
  LOOT_UI_FIXTURE_SEEDS, transformLootUiFixture,
} from '../tools/preview/fixtures';
import type { LootUiFixtureTransform } from '../tools/preview/fixtures';

describe('loot UI genuine first-hit fixtures', () => {
  it('records precisely the 21 prescribed recipes', () => {
    expect(LOOT_UI_FIXTURE_RECIPES.map(recipe => recipe.id)).toEqual(LOOT_UI_FIXTURE_IDS);
    expect(Object.keys(LOOT_UI_FIXTURE_SEEDS)).toEqual(LOOT_UI_FIXTURE_IDS);
  });
  for (const recipe of LOOT_UI_FIXTURE_RECIPES) {
    it(`${recipe.id}: independently searches the first seed and itemIndex`, () => {
      const found = findLootUiFixture(recipe);
      expect({ seed: found.seed, itemIndex: found.itemIndex }).toEqual(LOOT_UI_FIXTURE_SEEDS[recipe.id]);
      const fixture = getLootUiFixture(recipe.id);
      expect(fixture.data).toEqual(found.data);
      expect(recipe.matches(fixture.data, fixture.catalog)).toBe(true);
      expect(validateLootItemData(fixture.data, fixture.catalog)).toBe(true);
      expect(fixture.data.affixes.every(affix => !affix.known)).toBe(true);
      expect(Object.isFrozen(fixture.data.affixes)).toBe(true);
    });
    it(`${recipe.id}: reveal and enhancement are the only changed fields`, () => {
      const { data, catalog } = getLootUiFixture(recipe.id);
      const cap = enhancementCap(data, catalog.pack);
      const transformed = transformLootUiFixture(recipe.id, { reveal: 'all', enhancement: cap });
      expect(validateLootItemData(transformed, catalog)).toBe(true);
      expect(transformed.affixes.every(affix => affix.known)).toBe(true);
      expect(transformed.enhancement).toBe(cap);
      expect(() => transformLootUiFixture(recipe.id, { enhancement: cap + 1 })).toThrow(RangeError);
      expect({ ...transformed, enhancement: data.enhancement, affixes: transformed.affixes.map(affix => ({ ...affix, known: false })) }).toEqual(data);
      expect(transformLootUiFixture(recipe.id)).toEqual(data);
      expect(Object.isFrozen(transformed)).toBe(true);
      expect(data.affixes.every(affix => !affix.known)).toBe(true);
    });
  }
  it('accepts partial reveal with exactly the requested indices', () => {
    const partial = transformLootUiFixture('R06', { reveal: [0, 1] });
    expect(partial.affixes.map(affix => affix.known)).toEqual([true, true, false, false]);
    expect(transformLootUiFixture('R06', { reveal: [] }).affixes.every(affix => !affix.known)).toBe(true);
  });
  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 9])('rejects out-of-range magic enhancement %s', enhancement => {
    expect(() => transformLootUiFixture('R04', { enhancement })).toThrow(RangeError);
  });
  it.each([[-1], [0.5], [2], [Number.NaN], [0, 0]])('rejects invalid reveal indices %j', (...reveal) => {
    expect(() => transformLootUiFixture('R04', { reveal })).toThrow(RangeError);
  });
  it('rejects unsupported changes and unknown reveal modes', () => {
    expect(() => transformLootUiFixture('R04', { rarity: 'rare' } as LootUiFixtureTransform)).toThrow(TypeError);
    expect(() => transformLootUiFixture('R04', { reveal: 'partial' } as unknown as LootUiFixtureTransform)).toThrow(RangeError);
    expect(() => transformLootUiFixture('R04', { reveal: null } as unknown as LootUiFixtureTransform)).toThrow(RangeError);
    expect(() => transformLootUiFixture('R04', { enhancement: null } as unknown as LootUiFixtureTransform)).toThrow(RangeError);
  });
});
