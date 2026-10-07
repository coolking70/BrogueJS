import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import data from '../data/definitions.json';
import zhCN from '../locales/zh_CN.json';
import { assertCraftingPack } from '../schema';
import { getCraftingPackIdentity, loadCraftingPack, toWorldDefinitionPack } from '../definitions';
import { extensionDataFingerprint } from '../../../fingerprint';
import { assertWorldDefinitionPack } from '../../../../engine/Core/WorldDefinitions';

type Path = (string | number)[];
function clone(): Record<string, unknown> {
  return structuredClone(data) as unknown as Record<string, unknown>;
}
function at(value: unknown, path: Path): unknown {
  return path.reduce<unknown>((row, key) => (row as Record<string | number, unknown>)[key], value);
}
function set(value: unknown, path: Path, replacement: unknown): void {
  (at(value, path.slice(0, -1)) as Record<string | number, unknown>)[path[path.length - 1]!] = replacement;
}
function entries(value: unknown, path: Path = []): { path: Path; value: unknown }[] {
  const rows = [{ path, value }];
  if (value && typeof value === 'object')
    for (const [key, child] of Object.entries(value))
      rows.push(...entries(child, [...path, Array.isArray(value) ? Number(key) : key]));
  return rows;
}

const invalid: [string, unknown][] = [
  ['schema', 2], ['moduleId', 'other'], ['moduleVersion', '1.0.1'], ['rulesVersion', '1.0.1'],
  ['materials', null], ['tools', {}], ['recipes', 'recipes'], ['stations', false], ['resourceNodes', 1],
  ['materials.0.owner', 'other'], ['materials.0.id', 'other.wood'], ['materials.0.id', 'crafting.Wood'],
  ['materials.0.id', 'crafting.'], ['materials.0.id', 'crafting.' + 'a'.repeat(120)],
  ['materials.0.nameKey', 'ext.other.item.wood.name'], ['materials.0.descriptionKey', 'ext.crafting.missing'],
  ['materials.0.glyph', ''], ['materials.0.glyph', 'xx'], ['materials.0.glyph', '\n'],
  ['materials.0.glyph', '\u0085'], ['materials.0.glyph', '\u200b'], ['materials.0.glyph', '\ud800'],
  ['materials.0.color', '#123'], ['materials.0.color', '#GGGGGG'], ['materials.0.color', 123456],
  ['materials.0.maxStack', 0], ['materials.0.maxStack', 100], ['materials.0.maxStack', 1.5],
  ['materials.0.maxStack', Number.MAX_SAFE_INTEGER + 1], ['materials.0.maxStack', '99'],
  ['materials.0.category', 'food'], ['materials.0.category', 'tool'], ['tools.0.category', 'material'],
  ['materials.0.nativeTemplate', 'dagger'], ['materials.0.tool', { tag: 'basic.wood', maxDurability: 1, durabilityPerBatch: 1 }],
  ['materials.9.nativeTemplate', 'ration_of_food'], ['materials.9.nativeTemplate', null],
  ['materials.9.maxStack', 2], ['materials.9.tool', { tag: 'basic.pick', maxDurability: 1, durabilityPerBatch: 1 }],
  ['tools.0.maxStack', 2], ['tools.0.tool', null], ['tools.0.tool.tag', 'missing'],
  ['tools.0.tool.maxDurability', 0], ['tools.0.tool.maxDurability', 1000001],
  ['tools.0.tool.durabilityPerBatch', 0], ['tools.0.tool.durabilityPerBatch', 41],
  ['materials.0.tags', ['z', 'a']], ['materials.0.tags', ['a', 'a']], ['materials.0.tags', ['Bad']],
  ['materials.0.tags', Array.from({ length: 17 }, (_, i) => `tag.${String(i).padStart(2, '0')}`)],
  ['materials.0.tags', null],
  ['resourceNodes.0.id', 'crafting.wood'], ['stations.0.id', 'crafting.wood-node'],
  ['recipes.0.id', 'crafting.table'], ['resourceNodes.0.kind', 'fungus'], ['resourceNodes.0.kind', 'unknown'],
  ['resourceNodes.0.yield.0.itemDefinitionId', 'crafting.pick'], ['resourceNodes.0.requiredToolTag', 'basic.axe'],
  ['resourceNodes.0.capacity', 0], ['resourceNodes.0.capacity', 10000],
  ['resourceNodes.0.harvestTicks', 0], ['resourceNodes.0.harvestTicks', 10001],
  ['resourceNodes.0.unitsPerHarvest', 0], ['resourceNodes.0.unitsPerHarvest', 21],
  ['resourceNodes.0.regeneration', null], ['resourceNodes.0.regeneration.kind', 'daily'],
  ['resourceNodes.0.regeneration.units', 0], ['resourceNodes.0.regeneration.units', 100],
  ['resourceNodes.0.regeneration.intervalTicks', 0], ['resourceNodes.0.regeneration.intervalTicks', 1000001],
  ['resourceNodes.0.placement.site', { siteTags: [], maxPerSite: 1, maxPerRun: 1, onNoSpace: 'skip' }],
  ['resourceNodes.0.placement.dungeon.minDepth', 0], ['resourceNodes.0.placement.dungeon.minDepth', 41],
  ['resourceNodes.0.placement.dungeon.maxDepth', 0], ['resourceNodes.0.placement.dungeon.maxDepth', 41],
  ['resourceNodes.0.placement.dungeon.maxPerDepth', 0], ['resourceNodes.0.placement.dungeon.maxPerDepth', 33],
  ['resourceNodes.0.placement.dungeon.maxPerRun', 0], ['resourceNodes.0.placement.dungeon.maxPerRun', 513],
  ['resourceNodes.0.placement.dungeon.onNoSpace', 'retry'],
  ['stations.0.stationTags', []], ['stations.0.kitDefinitionId', null], ['stations.0.kitDefinitionId', 'crafting.wood'],
  ['stations.0.placementCost.0.itemDefinitionId', 'crafting.kit-table'],
  ['stations.0.placementTicks', 0], ['stations.0.placementTicks', 10001],
  ['stations.0.interactionDistance', -1], ['stations.0.interactionDistance', 17],
  ['stations.0.workPositionPolicy', 'anywhere'],
  ['recipes.0.inputs', []], ['recipes.0.outputs', []],
  ['recipes.0.inputs.0.count', 0], ['recipes.0.inputs.0.count', 100], ['recipes.0.inputs.0.count', 1.5],
  ['recipes.0.inputs.0.itemDefinitionId', 'crafting.missing'],
  ['recipes.0.inputs.0.itemDefinitionId', 'crafting.plain-dagger'],
  ['recipes.0.inputs.0.itemDefinitionId', 'crafting.pick'],
  ['recipes.0.outputs.0.itemDefinitionId', 'crafting.missing'], ['recipes.0.outputs.0.count', 2],
  ['recipes.0.stationTags', ['station.missing']], ['recipes.0.stationTags', ['station.hearth', 'station.table']],
  ['recipes.0.toolTag', 'basic.axe'], ['recipes.0.workTicks', 99], ['recipes.0.workTicks', 10001],
  ['recipes.0.offlineEligible', 'false'], ['startupItems', null],
  ['startupItems.instanceKey', 'crafting.other'], ['startupItems.overflow', 'skip'],
  ['startupItems.items', []], ['startupItems.items.0.itemDefinitionId', 'crafting.unknown'],
  ['limits.recipes', 6], ['limits.itemAndStationDefinitions', 13], ['limits.nodeDefinitions', 4],
  ['limits.nodesPerLevel', 7], ['limits.nodesPerRun', 143], ['limits.stack', 98]
];

describe('crafting schema rejects malformed data before registration (T1)', () => {
  it('accepts the complete package and the frozen world SDK validator', () => {
    const pack = loadCraftingPack();
    expect(() => assertCraftingPack(pack)).not.toThrow();
    expect(() => assertWorldDefinitionPack(toWorldDefinitionPack(pack), 'crafting', new Set(Object.keys(zhCN)))).not.toThrow();
  });
  it.each(invalid)('rejects %s = %j', (path, replacement) => {
    const value = clone(); set(value, path.split('.'), replacement);
    expect(() => assertCraftingPack(value)).toThrow();
  });
  const objects = entries(data).filter(row => row.value && typeof row.value === 'object' && !Array.isArray(row.value));
  it.each(objects.map(row => [row.path.join('.') || 'root', row.path] as const))('requires exact keys for every object: %s', (_label, path) => {
    const extra = clone();
    (at(extra, path) as Record<string, unknown>).unexpected = 1;
    expect(() => assertCraftingPack(extra)).toThrow();
    const missing = clone();
    const target = at(missing, path) as Record<string, unknown>;
    delete target[Object.keys(target)[0]!];
    expect(() => assertCraftingPack(missing)).toThrow();
  });
  it.each(Object.entries(data.limits))('does not relax, fractionalize or zero limit %s', (key, maximum) => {
    for (const invalidValue of [maximum + 1, 0, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const value = clone(); set(value, ['limits', key], invalidValue);
      expect(() => assertCraftingPack(value)).toThrow();
    }
  });
  it('allows stricter limits when all static data still fits them', () => {
    const value = clone(); set(value, ['limits', 'recipes'], 7); set(value, ['limits', 'stationsPerLevel'], 1);
    expect(() => assertCraftingPack(value)).not.toThrow();
  });
  it('checks aggregate node budgets at every depth and across the run', () => {
    for (const [key, amount] of [['maxPerDepth', 32], ['maxPerRun', 512]] as const) {
      const value = clone(); set(value, ['resourceNodes', 0, 'placement', 'dungeon', key], amount);
      expect(() => assertCraftingPack(value)).toThrow();
    }
    const value = clone(); set(value, ['resourceNodes', 3, 'placement', 'dungeon', 'minDepth'], 3);
    set(value, ['resourceNodes', 3, 'placement', 'dungeon', 'maxDepth'], 2);
    expect(() => assertCraftingPack(value)).toThrow();
  });
  it('checks every ItemAmount list length, duplicate reference and integer count', () => {
    const amountLists = entries(data).filter(row => Array.isArray(row.value) && row.value[0] && typeof row.value[0] === 'object' && 'itemDefinitionId' in row.value[0]);
    for (const { path, value } of amountLists) {
      const amount = (value as unknown[])[0];
      for (const replacement of [[], Array(9).fill(amount), [amount, amount]]) {
        const pack = clone(); set(pack, path, replacement); expect(() => assertCraftingPack(pack)).toThrow();
      }
      const pack = clone(); set(pack, [...path, 0, 'count'], 1.5); expect(() => assertCraftingPack(pack)).toThrow();
    }
  });
  it('rejects invalid JSON, holes, special prototypes, symbols and hidden properties', () => {
    const replacements: unknown[] = [undefined, () => 1, 1n, Symbol('x'), NaN, Infinity, -Infinity, new Date(0), new Map(), Object.create({ inherited: 1 })];
    for (const replacement of replacements) {
      const value = clone(); set(value, ['materials', 0, 'maxStack'], replacement);
      expect(() => assertCraftingPack(value)).toThrow();
    }
    for (const change of [
      (value: Record<string, unknown>) => { value.self = value; },
      (value: Record<string, unknown>) => { Object.defineProperty(value, '__proto__', { value: {}, enumerable: true }); },
      (value: Record<string, unknown>) => { Object.defineProperty(value, 'hidden', { value: true }); },
      (value: Record<string, unknown>) => { Object.defineProperty(value, Symbol('hidden'), { value: true }); },
      (value: Record<string, unknown>) => { Object.setPrototypeOf(value, { polluted: true }); },
      (value: Record<string, unknown>) => { delete (value.materials as unknown[])[0]; },
      (value: Record<string, unknown>) => { Object.assign(value.materials as object, { extra: true }); },
      (value: Record<string, unknown>) => { Object.defineProperty(value.materials, Symbol('extra'), { value: true }); }
    ]) {
      const value = clone(); change(value); expect(() => assertCraftingPack(value)).toThrow();
    }
  });
  it('never invokes a getter during validation', () => {
    for (const path of [['schema'], ['materials', 0, 'maxStack'], ['materials', 0]] as Path[]) {
      const value = clone(); let calls = 0;
      Object.defineProperty(at(value, path.slice(0, -1)), path[path.length - 1]!, { enumerable: true, get() { calls++; return 99; } });
      expect(() => assertCraftingPack(value)).toThrow(); expect(calls).toBe(0);
    }
  });
  it('requires every localized mechanical key and rejects foreign locale keys', () => {
    for (const row of [...data.materials, ...data.tools, ...data.resourceNodes, ...data.stations, ...data.recipes]) {
      for (const key of [row.nameKey, row.descriptionKey]) {
        const locale: Record<string, string> = { ...zhCN }; delete locale[key];
        expect(() => assertCraftingPack(clone(), locale)).toThrow();
      }
    }
    expect(() => assertCraftingPack(clone(), { ...zhCN, 'ext.foreign.name': 'wrong' })).toThrow();
    expect(() => assertCraftingPack(clone(), { ...zhCN, 'ext.crafting.item.wood.name': '\ud800' })).toThrow();
    expect(() => assertCraftingPack(clone(), { ...zhCN, 'ext.crafting.\udfff': 'wrong' })).toThrow();
    expect(Object.keys(zhCN).every(key => key.startsWith('ext.crafting.'))).toBe(true);
  });
});

describe('crafting pack identity (T2)', () => {
  it('is stable on fresh loads and covers the full validated pack', () => {
    const a = loadCraftingPack(), b = loadCraftingPack();
    expect(a).not.toBe(b); expect(a.materials).not.toBe(b.materials);
    expect(getCraftingPackIdentity(a)).toEqual(getCraftingPackIdentity(b));
    expect(getCraftingPackIdentity(a)).toEqual({ schema: 1, version: '1.0.0', fingerprint: extensionDataFingerprint(a) });
  });
  it('covers the order of every reorderable mechanical array', () => {
    const fingerprint = extensionDataFingerprint(data);
    const arrays = entries(data).filter(row => Array.isArray(row.value) && row.value.length > 1);
    expect(arrays.length).toBeGreaterThan(10);
    for (const { path, value } of arrays) {
      const reordered = clone(); set(reordered, path, [...value as unknown[]].reverse());
      expect(extensionDataFingerprint(reordered), path.join('.')).not.toBe(fingerprint);
    }
  });
  it('covers every numeric leaf including metadata and limits', () => {
    const fingerprint = extensionDataFingerprint(data);
    for (const { path, value } of entries(data).filter(row => typeof row.value === 'number')) {
      const changed = clone(); set(changed, path, (value as number) + 1);
      expect(extensionDataFingerprint(changed), path.join('.')).not.toBe(fingerprint);
    }
  });
  it('the public identity wrapper includes valid array and numeric mutations', () => {
    const original = loadCraftingPack(), expected = getCraftingPackIdentity(original).fingerprint;
    const reordered = loadCraftingPack(); reordered.materials.reverse();
    expect(getCraftingPackIdentity(reordered).fingerprint).not.toBe(expected);
    const changed = loadCraftingPack(); changed.recipes[0]!.workTicks += 100;
    expect(getCraftingPackIdentity(changed).fingerprint).not.toBe(expected);
    const tighter = loadCraftingPack(); tighter.limits.recipes--;
    expect(getCraftingPackIdentity(tighter).fingerprint).not.toBe(expected);
  });
  it('does not fingerprint locale text', () => {
    const pack = loadCraftingPack();
    const before = getCraftingPackIdentity(pack);
    const locale = { ...zhCN, 'ext.crafting.item.wood.name': '测试木材' };
    assertCraftingPack(pack, locale);
    expect(getCraftingPackIdentity(pack)).toEqual(before);
  });
  it('matches both native display constructors without invoking RNG', () => {
    const source = readFileSync(new URL('../../../../engine/Items/ItemLoader.ts', import.meta.url), 'utf8');
    const appearance = readFileSync(new URL('../../../../engine/UI/Appearance.ts', import.meta.url), 'utf8');
    for (const [id, category] of [['crafting.plain-dagger', 'WEAPON'], ['crafting.plain-leather-armor', 'ARMOR']] as const) {
      const match = source.match(new RegExp(`new Item\\(tn\\(data.name\\), '([^']+)', (0x[0-9a-fA-F]+), ItemCategory\\.${category}\\)`));
      expect(match).not.toBeNull();
      const row = data.materials.find(item => item.id === id)!;
      expect(row.glyph).toBe(match![1]);
      expect(row.color).toBe('#' + Number(match![2]).toString(16).padStart(6, '0').toUpperCase());
    }
    expect(appearance).toContain("char: halledChar ? '!' : item.char");
    expect(appearance).toContain('color: halledColor ? ctx.cosmetic.pick(HALLUCINATION_COLORS) : item.color');
  });
});
