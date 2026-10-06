import { describe, expect, it } from 'vitest';
import { loadLootPack } from '../definitions';
import { buildEffectiveLootCatalog } from '../catalog';
import { deriveNativeFacts, projectItemModifiers, validateLootItemData } from '../item';
import type { LootAffixRoll, LootItemDataV1 } from '../types';

const catalog = () => buildEffectiveLootCatalog(loadLootPack(), { combat: null, growth: null, giants: null });
const affix = (id: string, tier: number, values: number[], known = false): LootAffixRoll => ({ id: `loot.affix.${id}`, tier, values, known });
function magic(): LootItemDataV1 {
  return { v: 1, baseId: 'dagger', ilvl: 16, rarity: 'magic', uniqueId: null, setId: null, affixes: [affix('keen', 3, [5000]), affix('precise', 2, [1500])], corrupted: false,
    enhancement: 0, sockets: 0, socketed: [], nameParts: null, origin: { source: 'floor', depth: 10 } };
}
function unique(id = 'whisper'): LootItemDataV1 {
  const definition = loadLootPack().uniques.uniques.find(u => u.id === `loot.unique.${id}`)!;
  return { ...magic(), rarity: 'unique', baseId: definition.baseId, ilvl: Math.max(16, definition.minIlvl), uniqueId: definition.id,
    affixes: definition.rows.map(row => ({ id: row.rowId, tier: 0, values: row.ranges.map(r => r[0]), known: false })) };
}
function rare(): LootItemDataV1 { return { ...magic(), rarity: 'rare', nameParts: [0, 31] }; }
function corrupted(): LootItemDataV1 {
  return { ...magic(), ilvl: 1, corrupted: true, affixes: [affix('keen', 2, [3000]), affix('precise', 1, [1000]), affix('sluggish', 1, [500])] };
}
// Test mutators intentionally build values outside the public TypeScript type.
type MutableInvalid = Record<string, any>;
const negatives: [string, () => LootItemDataV1, (value: MutableInvalid) => void][] = [
  ['version', magic, x => x.v = 2], ['unknown field', magic, x => x.extra = 0], ['missing field', magic, x => delete x.setId],
  ['unknown base', magic, x => x.baseId = 'halberd'], ['ilvl low', magic, x => x.ilvl = 0], ['ilvl high', magic, x => x.ilvl = 100],
  ['ilvl noninteger', magic, x => x.ilvl = 1.5], ['ilvl infinity', magic, x => x.ilvl = Infinity], ['set rarity', magic, x => x.rarity = 'set'], ['runeword rarity', magic, x => x.rarity = 'runeword'],
  ['unknown rarity', magic, x => x.rarity = 'mythic'], ['unique missing ID', unique, x => x.uniqueId = null], ['nonunique ID', magic, x => x.uniqueId = 'loot.unique.whisper'],
  ['unknown unique ID', unique, x => x.uniqueId = 'loot.unique.unknown'], ['unique base mismatch', unique, x => x.baseId = 'sword'], ['unique below minimum', unique, x => x.ilvl = 1],
  ['normal affixes', magic, x => x.rarity = 'normal'], ['magic total limit', magic, x => x.affixes.push(affix('titan', 1, [1]))],
  ['rare total limit', rare, x => x.affixes = Array.from({ length: 7 }, () => affix('keen', 1, [2000]))],
  ['positive prefixes limit', magic, x => x.affixes[1] = affix('brutal', 1, [1, 2])], ['positive suffixes limit', magic, x => x.affixes[0] = affix('titan', 1, [1])],
  ['duplicate group', rare, x => { x.corrupted = true; x.affixes.push(affix('dull', 3, [-2000])); }],
  ['unknown affix', magic, x => x.affixes[0].id = 'loot.affix.unknown'], ['wrong class', magic, x => x.affixes[0] = affix('vital', 1, [5])],
  ['unavailable module affix', magic, x => x.affixes[1] = affix('adept.strength', 1, [1])], ['disabled rune', magic, x => x.affixes[1] = affix('rune-w-speed', 1, [2])],
  ['tier above max', magic, x => x.affixes[0].tier = 7], ['zero tier', magic, x => x.affixes[0].tier = 0], ['fractional tier', magic, x => x.affixes[0].tier = 1.5],
  ['locked normal tier', magic, x => { x.ilvl = 1; x.affixes = [affix('keen', 2, [3000])]; }],
  ['two corruption upgrades', corrupted, x => x.affixes[1] = affix('precise', 2, [1500])], ['corruption plus two tiers', corrupted, x => x.affixes[0] = affix('keen', 3, [5000])],
  ['negative locked tier', corrupted, x => x.affixes[2] = affix('sluggish', 2, [700])],
  ['values missing', magic, x => x.affixes[0].values = []], ['values extra', magic, x => x.affixes[0].values = [5000, 5000]],
  ['values below range', magic, x => x.affixes[0].values = [4099]], ['values above range', magic, x => x.affixes[0].values = [6001]],
  ['noninteger value', magic, x => x.affixes[0].values = [5000.5]], ['NaN value', magic, x => x.affixes[0].values = [NaN]],
  ['corrupted missing negative', magic, x => x.corrupted = true], ['uncorrupted has negative', magic, x => x.affixes[1] = affix('sluggish', 1, [500])],
  ['two negatives', corrupted, x => x.affixes[1] = affix('clumsy', 1, [-800])], ['corruption not boolean', magic, x => x.corrupted = 1],
  ['unique corrupted', unique, x => x.corrupted = true], ['unique missing row', unique, x => x.affixes.pop()], ['unique reordered rows', unique, x => x.affixes.reverse()],
  ['unique wrong row ID', unique, x => x.affixes[0].id = 'loot.unique.whisper.r9'], ['unique wrong tier', unique, x => x.affixes[0].tier = 1], ['unique out-of-range row', unique, x => x.affixes[0].values[0] = 4],
  ['rare missing name', rare, x => x.nameParts = null], ['nonrare name', magic, x => x.nameParts = [0, 0]], ['name negative index', rare, x => x.nameParts[0] = -1],
  ['name high index', rare, x => x.nameParts[1] = 32], ['name extra index', rare, x => x.nameParts.push(0)], ['name noninteger', rare, x => x.nameParts[0] = .5],
  ['known nonboolean', magic, x => x.affixes[0].known = 0], ['unknown roll field', magic, x => x.affixes[0].extra = 0],
  ['negative enhancement', magic, x => x.enhancement = -1], ['over cap enhancement', magic, x => x.enhancement = 9], ['noninteger enhancement', magic, x => x.enhancement = .5],
  ['sockets nonzero', magic, x => x.sockets = 1], ['socketed nonempty', magic, x => x.socketed = [null]], ['socketed nonarray', magic, x => x.socketed = {}], ['setID nonnull', magic, x => x.setId = 'set'],
  ['unknown origin field', magic, x => x.origin.extra = 0], ['origin unknown source', magic, x => x.origin.source = 'craft'], ['origin low depth', magic, x => x.origin.depth = 0], ['origin high depth', magic, x => x.origin.depth = 100],
  ['origin fractional depth', magic, x => x.origin.depth = .5], ['origin null', magic, x => x.origin = null],
  ['sparse unique affixes', unique, x => delete x.affixes[1]], ['sparse magic affixes', magic, x => delete x.affixes[0]], ['sparse values', magic, x => delete x.affixes[0].values[0]],
  ['sparse name', rare, x => delete x.nameParts[0]], ['sparse socketed', magic, x => x.socketed.length = 1],
  ['affixes array extra property', magic, x => x.affixes.extra = 1], ['values array extra property', magic, x => x.affixes[0].values.extra = 1], ['socketed extra property', magic, x => x.socketed.extra = 1],
  ['hidden required field', magic, x => Object.defineProperty(x, 'baseId', { value: x.baseId, enumerable: false })],
  ['hidden array element', magic, x => Object.defineProperty(x.affixes, '0', { value: x.affixes[0], enumerable: false })],
  ['array getter', magic, x => Object.defineProperty(x.affixes[0].values, '0', { get() { throw new Error('must not read getter'); } })],
  ['object getter', magic, x => Object.defineProperty(x, 'ilvl', { get() { throw new Error('must not read getter'); } })],
];

describe('strict LootItemData V1 boundary (§8.2)', () => {
  it.each(negatives)('rejects %s', (_name, create, change) => {
    const value = create(); change(value);
    expect(validateLootItemData(value, catalog())).toBe(false);
  });
  it.each([null, undefined, true, [], 1, 'loot'])('rejects non-object %s', value => expect(validateLootItemData(value, catalog())).toBe(false));
  it('accepts normal, magic, rare, all unique rows, and the single corruption compensation exception', () => {
    const normal = { ...magic(), rarity: 'normal' as const, affixes: [] };
    expect(validateLootItemData(normal, catalog())).toBe(true);
    expect(validateLootItemData(magic(), catalog())).toBe(true);
    expect(validateLootItemData(rare(), catalog())).toBe(true);
    expect(validateLootItemData(corrupted(), catalog())).toBe(true);
    for (const u of loadLootPack().uniques.uniques) expect(validateLootItemData(unique(u.id.replace('loot.unique.', '')), catalog())).toBe(true);
  });
  it('allows a negative beyond positive position quota and permits compensation remaining within unlocked tiers', () => {
    const value = corrupted(); value.ilvl = 16;
    expect(validateLootItemData(value, catalog())).toBe(true);
  });
  it('is read-only with frozen nested data', () => {
    const value = magic(); Object.freeze(value.affixes[0]!.values); Object.freeze(value.affixes[0]); Object.freeze(value.affixes); Object.freeze(value.origin); Object.freeze(value);
    expect(validateLootItemData(value, catalog())).toBe(true);
  });
});

describe('native facts and modifier drafts', () => {
  it('derives ring implicit and enhancement, weapon zero enchantment, identification and corruption', () => {
    const ring = { ...magic(), baseId: 'ring_of_light', affixes: [], rarity: 'normal' as const, ilvl: 45, enhancement: 4 };
    expect(deriveNativeFacts(ring, catalog())).toEqual({ kind: 'ring_of_light', category: 'ring', enchantment: 6, runicType: null, runicStrength: null, isCursed: false, identified: true });
    expect(deriveNativeFacts({ ...magic(), enhancement: 8 }, catalog()).enchantment).toBe(0);
    expect(deriveNativeFacts(corrupted(), catalog()).isCursed).toBe(true);
    expect(deriveNativeFacts(magic(), catalog()).identified).toBe(false);
    const known = magic(); known.affixes.forEach(a => a.known = true);
    expect(deriveNativeFacts(known, catalog()).identified).toBe(true);
  });
  it('unique implicit override replaces high-ilvl implicit before enhancement', () => {
    const ring = unique('gambler'); ring.ilvl = 99; ring.enhancement = 4;
    expect(deriveNativeFacts(ring, catalog()).enchantment).toBe(4);
    const penitent = unique('penitent'); penitent.enhancement = 2;
    expect(deriveNativeFacts(penitent, catalog()).enchantment).toBe(4);
  });
  it.each([['whisper', 'quietus', 4], ['cinder-mail', 'reflection', 6], ['colossus-maul', 'force', 8], ['vigil-plate', 'absorption', 8]])('derives %s unique rune', (id, rune, strength) => {
    expect(deriveNativeFacts(unique(id as string), catalog())).toMatchObject({ runicType: rune, runicStrength: strength });
  });
  it('projects raw units, both brutal values, more speed slot, conditions and known flags without collecting/clamping', () => {
    const value = rare(); value.affixes = [affix('brutal', 2, [2, 4], true), affix('swift', 2, [-800]), affix('giantsbane', 2, [4000])];
    const drafts = projectItemModifiers(value, catalog());
    expect(drafts.filter(d => d.sourceId === 'loot.affix.brutal').map(d => d.value)).toEqual([2, 4]);
    expect(drafts.find(d => d.sourceId === 'loot.affix.swift')).toMatchObject({ value: -800, slot: 'speed', unit: 'bp', known: false });
    expect(drafts.find(d => d.sourceId === 'loot.affix.giantsbane')?.conditions).toEqual([{ kind: 'target-tag', tag: 'body.large' }]);
    expect(drafts[0]!.known).toBe(true);
  });
  it('projects weapon, armor and ring enhancement rows plus raw implicit without unit conversion', () => {
    const weapon = projectItemModifiers({ ...magic(), enhancement: 4 }, catalog()).filter(d => d.sourceId.endsWith('#enhancement'));
    expect(weapon.map(d => [d.stat, d.unit, d.value])).toEqual([['loot.local.damage', 'bp', 4000], ['native.weapon-enchant', 'int', 1]]);
    const armor = projectItemModifiers({ ...magic(), baseId: 'leather_armor', affixes: [affix('plated', 1, [1])], enhancement: 3 }, catalog());
    expect(armor.map(d => [d.stat, d.unit, d.value])).toEqual([['native.defense', 'display-armor', 1], ['native.max-hp', 'int', 15], ['native.defense', 'int', 15]]);
    const ring = projectItemModifiers({ ...magic(), baseId: 'ring_of_light', affixes: [], ilvl: 15, enhancement: 3 }, catalog());
    expect(ring.map(d => [d.sourceId, d.value])).toEqual([['ring_of_light#enhancement', 1], ['ring_of_light#implicit', 2]]);
  });
  it('projects unique rows and adept expanded stat IDs without importing growth', () => {
    expect(projectItemModifiers(unique('gambler'), catalog())[0]).toMatchObject({ stat: 'loot.ring-implicit', category: 'override', value: 2 });
    const expanded = buildEffectiveLootCatalog(loadLootPack(), { combat: null, growth: { stats: ['growth.attribute'], attributes: ['might'] }, giants: null });
    const value = { ...magic(), affixes: [affix('adept.might', 1, [1])] };
    expect(validateLootItemData(value, expanded)).toBe(true);
    expect(projectItemModifiers(value, expanded)[0]).toMatchObject({ sourceId: 'loot.affix.adept.might', stat: 'growth.attribute:might', value: 1 });
  });
});
