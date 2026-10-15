/** Genuine first-hit generator fixtures shared by the gallery and the tests.
 * The only supported edits simulate later reveal/enhancement commands.
 */
import { buildEffectiveLootCatalog, freezeLootValue } from '../../catalog';
import { loadLootPack } from '../../definitions';
import { enhancementCap } from '../../economy';
import { rollLoot } from '../../generator';
import { lootItemClass, validateLootItemData } from '../../item';
import type { EffectiveLootCatalog, LootItemDataV1, LootRollRequest } from '../../types';
import { mulberry32 } from '../stats';

export const LOOT_UI_FIXTURE_IDS = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'E-W', 'E-A', 'E-R1', 'E-R2'] as const;
export type LootUiFixtureId = typeof LOOT_UI_FIXTURE_IDS[number];
export type LootUiCatalogId = 'none' | 'full';
export interface LootUiFixtureRecipe {
  readonly id: LootUiFixtureId;
  readonly catalogId: LootUiCatalogId;
  readonly request: LootRollRequest;
  readonly matches: (data: LootItemDataV1, catalog: EffectiveLootCatalog) => boolean;
}
export interface LootUiFixture {
  readonly id: LootUiFixtureId;
  readonly seed: number;
  readonly itemIndex: number;
  readonly catalog: EffectiveLootCatalog;
  readonly data: LootItemDataV1;
}
export interface LootUiFixtureTransform {
  readonly reveal?: 'none' | 'all' | readonly number[];
  readonly enhancement?: number;
}

const pack = loadLootPack();
export const LOOT_UI_CATALOGS = freezeLootValue({
  none: buildEffectiveLootCatalog(pack, { combat: null, growth: null, giants: null }),
  full: buildEffectiveLootCatalog(pack, {
    combat: { stats: ['combat.stamina-capacity', 'combat.poise-capacity', 'combat.stamina-regen', 'combat.poise-recovery'] },
    growth: { stats: ['growth.focus-capacity', 'growth.attribute', 'growth.xp-gain'], attributes: ['strength', 'dexterity', 'wisdom'] },
    giants: { formIds: ['giants.abyssal-colossus'] },
  }),
});
const base = (depth: number, presetId = 'standard') => ({ v: 1 as const, depth, presetId, rarityFindBp: 0, claimedUniqueIds: [] });
const floor = (depth: number, itemClass: 'weapon' | 'armor' | 'ring', presetId = 'standard'): LootRollRequest => ({ ...base(depth, presetId), source: 'floor', itemClass });
const kill = (depth: number, presetId = 'standard'): LootRollRequest => ({ ...base(depth, presetId), source: 'kill', monster: { typeId: 'ogre', leader: false, champion: false, encounterSubject: false } });
const vault = (depth: number, itemClass: 'weapon' | 'armor'): LootRollRequest => ({ ...base(depth, 'bountiful'), source: 'vault', itemClass, baseId: null, highValue: true });
const encounter = (depth: number, formId: string | null = null): LootRollRequest => ({ ...base(depth), source: 'encounter', formId });
const has = (data: LootItemDataV1, id: string): boolean => data.affixes.some(affix => affix.id === id);

export const LOOT_UI_FIXTURE_RECIPES: readonly LootUiFixtureRecipe[] = freezeLootValue([
  { id: 'R01', catalogId: 'none', request: floor(1, 'weapon'), matches: d => d.rarity === 'normal' },
  { id: 'R02', catalogId: 'none', request: floor(3, 'armor'), matches: d => d.rarity === 'normal' },
  { id: 'R03', catalogId: 'none', request: floor(3, 'ring'), matches: d => d.rarity === 'normal' },
  { id: 'R04', catalogId: 'none', request: floor(8, 'weapon'), matches: (d, c) => d.rarity === 'magic' && !d.corrupted && d.affixes.length === 2 && ['prefix', 'suffix'].every(position => d.affixes.filter(a => c.affixes.find(def => def.id === a.id)?.position === position).length === 1) },
  { id: 'R05', catalogId: 'none', request: floor(4, 'ring'), matches: d => d.rarity === 'magic' && !d.corrupted && d.affixes.length === 1 },
  { id: 'R06', catalogId: 'none', request: kill(12), matches: (d, c) => d.rarity === 'rare' && lootItemClass(d.baseId, c) === 'armor' && d.affixes.length >= 4 && !d.corrupted },
  { id: 'R07', catalogId: 'none', request: kill(16), matches: (d, c) => d.rarity === 'rare' && lootItemClass(d.baseId, c) === 'weapon' && has(d, 'loot.affix.brutal') && !d.corrupted },
  { id: 'R08', catalogId: 'none', request: kill(16), matches: (d, c) => d.rarity === 'rare' && lootItemClass(d.baseId, c) === 'weapon' && has(d, 'loot.affix.giantsbane') },
  { id: 'R09', catalogId: 'none', request: vault(30, 'weapon'), matches: d => d.rarity === 'rare' && d.affixes.length === 6 },
  { id: 'R10', catalogId: 'none', request: kill(16, 'scarce'), matches: d => d.rarity === 'rare' && d.corrupted },
  { id: 'R11', catalogId: 'none', request: floor(10, 'weapon', 'scarce'), matches: d => d.rarity === 'magic' && d.corrupted },
  { id: 'R12', catalogId: 'full', request: encounter(20, 'giants.abyssal-colossus'), matches: d => d.uniqueId === 'loot.unique.colossus-maul' },
  { id: 'R13', catalogId: 'none', request: encounter(14), matches: d => d.uniqueId === 'loot.unique.penitent' || d.uniqueId === 'loot.unique.gambler' },
  { id: 'R14', catalogId: 'none', request: encounter(6), matches: d => d.uniqueId === 'loot.unique.whisper' },
  { id: 'R15', catalogId: 'full', request: kill(16), matches: (d, c) => lootItemClass(d.baseId, c) === 'armor' && ['loot.affix.enduring', 'loot.affix.steadfast', 'loot.affix.stalwart'].some(id => has(d, id)) },
  { id: 'R16', catalogId: 'full', request: kill(16), matches: d => d.affixes.some(a => a.id.startsWith('loot.affix.adept.')) },
  { id: 'R17', catalogId: 'none', request: vault(40, 'armor'), matches: d => d.rarity === 'rare' && d.affixes.some(a => a.tier === 6) },
  { id: 'E-W', catalogId: 'none', request: kill(12), matches: (d, c) => d.rarity === 'magic' && lootItemClass(d.baseId, c) === 'weapon' },
  { id: 'E-A', catalogId: 'none', request: floor(12, 'armor'), matches: d => d.rarity === 'magic' },
  { id: 'E-R1', catalogId: 'none', request: floor(12, 'ring'), matches: d => d.rarity === 'rare' },
  { id: 'E-R2', catalogId: 'none', request: floor(12, 'ring'), matches: d => d.rarity === 'magic' },
] satisfies LootUiFixtureRecipe[]);

/** Search seed first, then result index: no hand-picking among later matching rolls. */
export function findLootUiFixture(recipe: LootUiFixtureRecipe): { seed: number; itemIndex: number; data: LootItemDataV1 } {
  const catalog = LOOT_UI_CATALOGS[recipe.catalogId];
  for (let seed = 1; seed <= 20000; seed++) {
    const result = rollLoot(catalog, recipe.request, mulberry32(seed));
    const itemIndex = result.items.findIndex(item => recipe.matches(item.data, catalog));
    if (itemIndex >= 0) return { seed, itemIndex, data: result.items[itemIndex]!.data };
  }
  throw new RangeError(`No first-hit fixture found for ${recipe.id} within seeds 1–20000`);
}

/** Literal first-hit provenance, verified by a fresh search in loot_ui_fixtures. */
export const LOOT_UI_FIXTURE_SEEDS: Readonly<Record<LootUiFixtureId, { readonly seed: number; readonly itemIndex: number }>> = freezeLootValue({
  'R01': { seed: 1, itemIndex: 0 },
  'R02': { seed: 1, itemIndex: 0 },
  'R03': { seed: 1, itemIndex: 0 },
  'R04': { seed: 25, itemIndex: 0 },
  'R05': { seed: 5, itemIndex: 0 },
  'R06': { seed: 218, itemIndex: 0 },
  'R07': { seed: 272, itemIndex: 1 },
  'R08': { seed: 146, itemIndex: 0 },
  'R09': { seed: 7, itemIndex: 0 },
  'R10': { seed: 146, itemIndex: 0 },
  'R11': { seed: 46, itemIndex: 0 },
  'R12': { seed: 707, itemIndex: 0 },
  'R13': { seed: 150, itemIndex: 0 },
  'R14': { seed: 7, itemIndex: 0 },
  'R15': { seed: 79, itemIndex: 0 },
  'R16': { seed: 9, itemIndex: 1 },
  'R17': { seed: 1, itemIndex: 0 },
  'E-W': { seed: 8, itemIndex: 0 },
  'E-A': { seed: 5, itemIndex: 0 },
  'E-R1': { seed: 10, itemIndex: 0 },
  'E-R2': { seed: 5, itemIndex: 0 },
});

export function getLootUiFixture(id: LootUiFixtureId): LootUiFixture {
  const recipe = LOOT_UI_FIXTURE_RECIPES.find(entry => entry.id === id);
  if (!recipe) throw new RangeError(`Unknown fixture ${id}`);
  const { seed, itemIndex } = LOOT_UI_FIXTURE_SEEDS[id];
  const catalog = LOOT_UI_CATALOGS[recipe.catalogId];
  const data = rollLoot(catalog, recipe.request, mulberry32(seed)).items[itemIndex]?.data;
  if (!data || !recipe.matches(data, catalog) || !validateLootItemData(data, catalog)) throw new RangeError(`Invalid fixture seed ${id}`);
  return freezeLootValue({ id, seed, itemIndex, catalog, data });
}

export function transformLootUiFixture(id: LootUiFixtureId, options: LootUiFixtureTransform = {}): LootItemDataV1 {
  if (!options || typeof options !== 'object' || Array.isArray(options) || Reflect.ownKeys(options).some(key => key !== 'reveal' && key !== 'enhancement')) throw new TypeError('Only reveal/enhancement fixture transforms are supported');
  const fixture = getLootUiFixture(id);
  const data = structuredClone(fixture.data);
  const reveal = options.reveal === undefined ? 'none' : options.reveal;
  if (reveal !== 'none' && reveal !== 'all' && (!Array.isArray(reveal) || reveal.some(index => !Number.isSafeInteger(index) || index < 0 || index >= data.affixes.length) || new Set(reveal).size !== reveal.length)) throw new RangeError('Reveal indices must be distinct valid affix indices');
  const enhancement = options.enhancement === undefined ? data.enhancement : options.enhancement;
  if (!Number.isSafeInteger(enhancement) || enhancement < 0 || enhancement > enhancementCap(data, fixture.catalog.pack)) throw new RangeError('Enhancement outside rarity cap');
  data.affixes.forEach((affix, index) => { affix.known = reveal === 'all' || (Array.isArray(reveal) && reveal.includes(index)); });
  data.enhancement = enhancement;
  if (!validateLootItemData(data, fixture.catalog)) throw new RangeError('Fixture transform failed validation');
  return freezeLootValue(data);
}
