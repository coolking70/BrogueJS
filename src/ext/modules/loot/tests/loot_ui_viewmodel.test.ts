import { describe, expect, it, vi } from 'vitest';
import weapons from '../../../../data/weapons.json';
import armors from '../../../../data/armors.json';
import arcana from '../../../../data/arcana.json';
import mainLocale from '../../../../locales/zh_CN.json';
import { loadLootPack } from '../definitions';
import { enhancementCap, ringImplicit, salvageYield } from '../economy';
import type { LootPack, ModifierSpec } from '../types';
import { freezeLootUi, LootUiError } from '../ui/errors';
import { formatLootModifierRange, formatLootModifierValue, lootDecimal } from '../ui/format';
import { knownModifierDrafts, projectLootKnowledge } from '../ui/knowledge';
import { LOOT_UI_BASE_NAMES, LOOT_UI_CLASS_GLYPHS, LOOT_UI_RUNICS, LOOT_UI_STATS } from '../ui/tables';
import type { LootKnowledgeFacts, LootKnownItem, LootUiOptions } from '../ui/types';
import { buildLootChipView, buildLootCompareView, buildLootItemView, buildLootPresetOptions, buildLootSalvageView,
  defaultLootPickupFilter, normalizeLootPickupFilter } from '../ui/viewModel';
import { getLootUiFixture, LOOT_UI_CATALOGS, LOOT_UI_FIXTURE_IDS, transformLootUiFixture,
  type LootUiFixtureId, type LootUiFixtureTransform } from '../tools/preview/fixtures';

const options: LootUiOptions = { presetId: 'standard' };
const facts = (overrides: Partial<LootKnowledgeFacts> = {}): LootKnowledgeFacts => ({ v: 1, location: 'pack', ringKindKnown: true,
  magicPolarity: 'unknown', curseRevealed: false, hallucinating: false, familiarity: null, ...overrides });
function known(id: LootUiFixtureId, transform: LootUiFixtureTransform = { reveal: 'all' }, factOverrides: Partial<LootKnowledgeFacts> = {}) {
  const f = getLootUiFixture(id), data = transformLootUiFixture(id, transform);
  return { ...f, data, item: projectLootKnowledge(data, f.catalog, facts(factOverrides)) };
}
function card(id: LootUiFixtureId, transform: LootUiFixtureTransform = { reveal: 'all' }, factOverrides: Partial<LootKnowledgeFacts> = {}, opts = options) {
  const f = known(id, transform, factOverrides); return buildLootItemView(f.item, f.catalog, opts);
}
function allFrozen(value: unknown): boolean { return !value || typeof value !== 'object' || Object.isFrozen(value) && Object.values(value).every(allFrozen); }
const mod = (stat: string, unit: ModifierSpec['unit'], category: ModifierSpec['category'] = 'flat') => ({ stat, unit, category });

describe('loot numeric formats and literal tables', () => {
  it.each([
    [mod('native.accuracy', 'bp', 'increased'), 5200, '+52%'], [mod('native.accuracy', 'bp'), 1250, '+12.5%'],
    [mod('native.attack-speed', 'bp', 'more'), -600, '-6%'], [mod('native.resist.fire', 'bp'), 1, '+0.01%'],
    [mod('native.max-hp', 'int'), 3, '+3'], [mod('native.max-hp', 'int'), -10, '-10'],
    [mod('native.light', 'ring-point'), 2, '+2'], [mod('native.light', 'ring-point'), -2, '-2'],
    [mod('native.defense', 'display-armor'), 4, '+4'], [mod('native.defense', 'display-armor'), -1, '-1'],
    [mod('native.defense', 'int'), 25, '+2.5'], [mod('native.defense', 'int'), -10, '-1'],
    [mod('loot.ring-implicit', 'ring-point', 'override'), 3, '=3'], [mod('loot.ring-implicit', 'ring-point', 'override'), 2, '=2'],
    [mod('native.runic-power', 'runic-strength'), 4, '4'], [mod('native.armor-runic-power', 'runic-strength'), 8, '8'],
    [mod('native.accuracy', 'bp'), 0, '0%'], [mod('native.max-hp', 'int'), 0, '0'],
  ] as const)('formats %# deterministically', (spec, value, expected) => expect(formatLootModifierValue(spec, value)).toBe(expected));
  it.each([[2, 4, '+2–4'], [8, 14, '+8–14'], [-4, -2, '-4–-2']] as const)('formats range %i/%i', (lo, hi, expected) => {
    expect(formatLootModifierRange(mod('loot.local.damage', 'int', 'local-flat'), lo, hi)).toBe(expected);
  });
  it('rejects nonfinite or fractional modifier values', () => {
    for (const v of [NaN, Infinity, 1.5]) expect(() => formatLootModifierValue(mod('native.max-hp', 'int'), v)).toThrow(/INVALID_INPUT/);
    expect(() => lootDecimal(Infinity)).toThrow(/INVALID_INPUT/);
  });
  it('covers every stat/unit pair including disabled rune families and enhancement, once with no extras', () => {
    const p = loadLootPack();
    const actual = LOOT_UI_STATS.map(s => `${s.stat}/${s.unit}`);
    const wanted = [...new Set([...p.affixes.affixes.flatMap(a => a.modifiers), ...p.uniques.uniques.flatMap(u => u.rows.flatMap(r => r.modifiers))]
      .map(s => `${s.stat}/${s.unit}`).concat(['native.defense/int', 'native.max-hp/int', 'loot.ring-implicit/ring-point']))];
    expect([...actual].sort()).toEqual(wanted.sort()); expect(new Set(actual).size).toBe(actual.length);
    for (const s of LOOT_UI_STATS) expect(s.better).toBe(['native.attack-speed', 'native.physical-damage-taken'].includes(s.stat) ? 'lower' : 'higher');
  });
  it('covers every native base with existing literal main-locale names and exact glyphs', () => {
    const p = loadLootPack(), bases = [...p.bases.weapons, ...p.bases.armors, ...p.bases.rings];
    expect(LOOT_UI_BASE_NAMES).toHaveLength(26);
    const native = [...weapons, ...armors, ...arcana.rings];
    for (const b of bases) {
      const entry = LOOT_UI_BASE_NAMES.find(x => x.baseId === b.baseId)!;
      expect(entry.nameKey).toBe(`name.${native.find(x => x.id === b.baseId)!.name}`);
      expect((mainLocale as Record<string, string>)[entry.nameKey]).toBeTruthy();
    }
    expect(LOOT_UI_CLASS_GLYPHS).toEqual({ weapon: ')', armor: ']', ring: '=' });
  });
  it('covers every rune name in both affix families and unique rows without extra entries', () => {
    const p = loadLootPack();
    const wanted = [...new Set([...p.affixes.affixes.flatMap(a => a.rune ? [a.rune.runicType] : []),
      ...p.uniques.uniques.flatMap(u => u.rows.flatMap(r => r.modifiers.flatMap(m => m.runicType ? [m.runicType] : [])))])].sort();
    expect(LOOT_UI_RUNICS.map(r => r.runicType).sort()).toEqual(wanted);
    for (const r of LOOT_UI_RUNICS) expect((mainLocale as Record<string, string>)[r.nameKey]).toBeTruthy();
  });
});

describe('loot chip and item views', () => {
  it.each([
    ['R01', 'all', 'normal'], ['R04', 'none', 'magic'], ['R04', 'all', 'magic'], ['R07', 'none', 'rare-unidentified'],
    ['R07', 'all', 'rare'], ['R12', 'none', 'unique-unidentified'], ['R12', 'all', 'unique'],
  ] as const)('chooses the name template %s/%s', (id, reveal, template) => {
    expect(card(id, { reveal }).chip.name.nameKey).toBe(`ext.loot.ui.name.${template}`);
  });
  it('uses only known magic prefix/suffix names, including partially revealed names', () => {
    const f = known('R04', { reveal: [0] }), chip = buildLootChipView(f.item, f.catalog);
    const pos = f.item.affixes[0]!.position as 'prefix' | 'suffix';
    expect(chip.name.parts[pos]).not.toBeNull(); expect(chip.name.parts[pos === 'prefix' ? 'suffix' : 'prefix']).toBeNull();
    expect(card('R04', { reveal: 'none' }).chip.name.parts.prefix).toBeNull();
  });
  it('uses category during floor hallucination and unknown ring name regardless of rarity', () => {
    const c = card('R06', {}, { location: 'floor', hallucinating: true });
    expect(c.chip.rarity).toMatchObject({ id: null, marker: '?', label: null });
    expect(c.chip.name.parts.base!.nameKey).toBe('ext.loot.ui.name.class-armor');
    expect(c.chip.name.nameKey).toBe('ext.loot.ui.name.normal');
    const ring = card('R13', { reveal: 'all' }, { ringKindKnown: false });
    expect(ring.chip.name.parts.base!.nameKey).toBe('ext.loot.ui.name.unknown-ring');
    expect(ring.chip.name.parts.unique).toBeNull();
  });
  it('shows only floor strength and category/rarity, with hidden count and no identity or flavor', () => {
    const c = card('R12', { reveal: 'all' }, { location: 'floor' });
    expect(c.baseStats.map(r => r.key)).toEqual(['strength']); expect(c.subtitle).toHaveLength(2);
    expect(c.chip.countHidden).toBe(true); expect(c.rows).toEqual([]); expect(c.flavor).toBeNull();
    expect(c.notices.map(r => r.nameKey)).toEqual(['ext.loot.ui.notice.floor-count-hidden']);
    expect(card('R03', {}, { location: 'floor' }).baseStats).toEqual([]);
  });
  it('calculates weapon known-only min/max, local percent, brutal flats, and enhancement exactly', () => {
    const f = known('R07', { reveal: 'all', enhancement: 3 });
    const base = weapons.find(w => w.id === f.item.baseId)!;
    const [, x, y, z] = /^(\d+)d(\d+)([+-]\d+)?$/.exec(base.damage)!;
    const drafts = knownModifierDrafts(f.item, f.catalog), flats = drafts.filter(d => d.stat === 'loot.local.damage' && d.category === 'local-flat');
    const bp = drafts.filter(d => d.stat === 'loot.local.damage' && d.category === 'local-increased').reduce((s, d) => s + d.value, 10000);
    const expected = [Math.floor((Number(x) + Number(z ?? 0) + (flats[0]?.value ?? 0)) * bp / 10000),
      Math.floor((Number(x) * Number(y) + Number(z ?? 0) + (flats[1]?.value ?? 0)) * bp / 10000)].join('–');
    const c = buildLootItemView(f.item, f.catalog, options);
    expect(c.baseStats.find(r => r.key === 'damage')).toMatchObject({ value: expected, partial: false });
    expect(c.baseStats.find(r => r.key === 'enhancement')!.value).toBe(`3/${enhancementCap(f.data, f.catalog.pack)}`);
    expect(c.chip.name.enhancement).toBe(3);
    expect(card('R07', { reveal: 'none' }).baseStats[0]!.partial).toBe(true);
  });
  it('calculates armor display units, floor-to-tenth and enhancement, capped at22', () => {
    for (const id of ['R06', 'R17'] as const) {
      const original = getLootUiFixture(id), f = known(id, { reveal: 'all', enhancement: enhancementCap(original.data, original.catalog.pack) });
      const base = armors.find(a => a.id === f.item.baseId)!, drafts = knownModifierDrafts(f.item, f.catalog);
      const sum = (stat: string, unit: string) => drafts.filter(d => d.stat === stat && d.unit === unit).reduce((s, d) => s + d.value, 0);
      const expected = Math.floor(Math.min(22, base.armor * (10000 + sum('loot.local.armor', 'bp')) / 10000
        + sum('native.defense', 'display-armor') + sum('native.defense', 'int') / 10) * 10 + 1e-9) / 10;
      expect(buildLootItemView(f.item, f.catalog, options).baseStats[0]!.value).toBe(String(expected));
    }
    expect(card('R06', { reveal: [0, 1] }).baseStats[0]!.partial).toBe(true);
  });
  it('renders ring implicit, known unique override and uncertainty without hidden fixed effects', () => {
    const f = known('R03'); expect(card('R03').baseStats[0]!.value).toBe(String(ringImplicit(f.item.ilvl!, f.catalog.pack)));
    const u = known('R13'), override = knownModifierDrafts(u.item, u.catalog).find(d => d.category === 'override')!;
    expect(card('R13').baseStats[0]!.value).toBe(String(override.value));
    expect(card('R13', { reveal: [0] }).baseStats[0]).toMatchObject({ value: '?', partial: true });
    expect(card('R03', { enhancement: 2 }).baseStats[0]!.value).toBe(String(ringImplicit(f.item.ilvl!, f.catalog.pack) + 1));
  });
  it('sorts prefix then suffix then fixed rows stably and controls tiers', () => {
    const f = known('R10'), c = buildLootItemView(f.item, f.catalog, options);
    const order = { prefix: 0, suffix: 1, row: 2 };
    expect(c.rows.map(r => r.key)).toEqual(f.item.affixes.map((r, i) => ({ r, i })).sort((a, b) => order[a.r.position] - order[b.r.position]).map(({ r, i }) => `${i}:${r.known ? r.id : 'unknown'}`));
    expect(card('R17').rows.some(r => r.tier === 6)).toBe(true);
    expect(card('R17', { reveal: 'all' }, {}, { ...options, showTiers: false }).rows.every(r => r.tier === null)).toBe(true);
    expect(card('R12').rows.every(r => r.name === null && r.tier === null && r.position === 'row')).toBe(true);
  });
  it('merges real brutal/colossus flat pairs into one interval and displays condition/runic/override', () => {
    for (const [id, suffix] of [['R07', 'loot.affix.brutal'], ['R12', 'loot.unique.colossus-maul.r0']] as const) {
      const row = card(id).rows.find(r => r.key.endsWith(suffix))!;
      expect(row.lines).toHaveLength(1); expect(row.lines[0]!.value).toMatch(/^\+\d+–\d+$/);
    }
    const maul = card('R12');
    expect(maul.rows.flatMap(r => r.lines).some(l => l.condition?.nameKey === 'ext.loot.ui.condition.body-large')).toBe(true);
    expect(maul.rows.flatMap(r => r.lines).find(l => l.runic)?.runic!.nameKey).toBe('runic.name.force');
    expect(card('R14').rows.flatMap(r => r.lines).find(l => l.runic)?.value).toBe('4');
    expect(card('R13').rows.flatMap(r => r.lines).some(l => /^=\d+$/.test(l.value))).toBe(true);
  });
  it('assigns negative-row tone, harmful unique tone and lower-is-better signs', () => {
    const corrupt = card('R10');
    expect(corrupt.rows.filter(r => r.negative).length).toBeGreaterThan(0);
    expect(corrupt.rows.filter(r => r.negative).every(r => r.lines.every(l => l.tone === 'bad'))).toBe(true);
    expect(card('R13').rows.flatMap(r => r.lines).find(l => l.stat.nameKey === 'ext.loot.ui.stat.native-max-hp')!.tone).toBe('bad');
    expect(card('R12').rows.flatMap(r => r.lines).find(l => l.stat.nameKey === 'ext.loot.ui.stat.native-attack-speed')!.tone).toBe('bad');
  });
  it('supports adept host labels and an attribute-id fallback', () => {
    const f = known('R16'), id = knownModifierDrafts(f.item, f.catalog).find(d => d.stat.startsWith('growth.attribute:'))!.stat.split(':')[1]!;
    const line = (opts: LootUiOptions) => buildLootItemView(f.item, f.catalog, opts).rows.flatMap(r => r.lines).find(l => l.stat.nameKey === 'ext.loot.ui.stat.growth-attribute')!;
    expect(line(options).stat.params).toEqual({ name: id });
    expect(line({ ...options, attributeLabels: { [id]: '属性名称' } }).stat.params).toEqual({ name: '属性名称' });
  });
  it('orders notices and displays unique flavor only after full identification', () => {
    expect(card('R10', {}, { magicPolarity: 'malevolent', familiarity: { unit: 'turns', remaining: 3 } }).notices.map(n => n.nameKey)).toEqual([
      'ext.loot.ui.notice.unknown-active', 'ext.loot.ui.notice.malevolent', 'ext.loot.ui.notice.familiarity-turns']);
    expect(card('R04', {}, { magicPolarity: 'benign', familiarity: { unit: 'kills', remaining: 2 } }).notices.map(n => n.nameKey)).toEqual([
      'ext.loot.ui.notice.unknown-active', 'ext.loot.ui.notice.benign', 'ext.loot.ui.notice.familiarity-kills']);
    expect(card('R10', {}, { curseRevealed: true }).notices.map(n => n.nameKey)).toEqual(['ext.loot.ui.notice.unknown-active', 'ext.loot.ui.notice.corrupted']);
    expect(card('R12', {}).flavor).toBeNull(); expect(card('R12').flavor?.nameKey).toBe('ext.loot.unique.colossus-maul.description');
  });
});

describe('loot comparisons and salvage', () => {
  it('compares weapon bases, beneficial lower strength and signed damage interval deltas', () => {
    const a = known('R07'), b = known('E-W');
    const c = buildLootCompareView(a.item, [b.item], a.catalog, { ...options, playerStrength: 12 });
    expect(c.columns).toHaveLength(1); expect(c.columns[0]!.rows.find(r => r.key === 'strength')).toMatchObject({ before: '19', after: '13', delta: '-6', tone: 'better' });
    expect(c.columns[0]!.rows.find(r => r.key === 'damage')!.delta).toMatch(/^[+-]?\d+–[+-]?\d+$/);
    expect(c.notices.map(n => n.nameKey)).toEqual(['ext.loot.ui.compare.strength-short', 'ext.loot.ui.compare.provisional']);
    expect(c.notices[0]!.params).toEqual({ short: 1 });
  });
  it('marks both partial estimates and counts unknown rows across candidate/equipped exactly', () => {
    const a = known('R06', { reveal: [0, 1] }), b = known('E-A', {});
    const c = buildLootCompareView(a.item, [b.item], a.catalog, { ...options, playerStrength: null });
    const armor = c.columns[0]!.rows.find(r => r.key === 'armor')!;
    expect(armor.before.endsWith('?')).toBe(true); expect(armor.after.endsWith('?')).toBe(true); expect(armor.delta.endsWith('?')).toBe(true);
    expect(c.notices[0]!.params.count).toBe(a.item.affixes.filter(r => !r.known).length + b.item.affixes.length);
  });
  it('builds ring replacement columns, empty slots and unknown unique implicit comparison', () => {
    const a = known('R05'), b = known('E-R1'), c = known('E-R2');
    const view = buildLootCompareView(a.item, [b.item, c.item], a.catalog, { ...options, playerStrength: null });
    expect(view.columns.map(c => c.slot.nameKey)).toEqual(['ext.loot.ui.slot.left-ring', 'ext.loot.ui.slot.right-ring']);
    const empty = known('R02');
    expect(buildLootCompareView(empty.item, [null], empty.catalog, { ...options, playerStrength: null }).columns[0]!.equipped).toBeNull();
    const unique = known('R13', {});
    expect(buildLootCompareView(unique.item, [null, null], unique.catalog, { ...options, playerStrength: null }).columns[0]!.rows[0]).toMatchObject({ after: '?', delta: '?', tone: 'same' });
  });
  it('aggregates each modifier tuple and uses signed delta for runic/override quantities', () => {
    const a = known('R12'), c = buildLootCompareView(a.item, [null], a.catalog, { ...options, playerStrength: null });
    const grouped = new Map<string, number>();
    for (const m of knownModifierDrafts(a.item, a.catalog)) {
      const key = JSON.stringify([m.stat, m.category, m.unit, m.conditions ?? [], m.runicType]); grouped.set(key, (grouped.get(key) ?? 0) + m.value);
    }
    for (const [key, value] of grouped) {
      const row = c.columns[0]!.rows.find(r => r.key === key)!;
      const [stat, category, unit] = JSON.parse(key) as [string, ModifierSpec['category'], ModifierSpec['unit']];
      expect(row.after).toBe(formatLootModifierValue({ stat, category, unit }, value));
      if (unit === 'runic-strength') expect(row.delta).toBe(`+${value}`);
      if (stat === 'native.attack-speed') expect(row.tone).toBe('worse');
    }
    const ring = known('R13');
    expect(buildLootCompareView(ring.item, [null, null], ring.catalog, { ...options, playerStrength: null }).columns[0]!.rows.find(r => r.key.includes('override'))!.delta).toMatch(/^\+\d+$/);
  });
  it('floor comparison is unavailable, and mismatch/invalid counts/strength reject', () => {
    const floor = known('R06', {}, { location: 'floor' });
    expect(buildLootCompareView(floor.item, [], floor.catalog, { ...options, playerStrength: null })).toMatchObject({ available: false, columns: [], notices: [{ nameKey: 'ext.loot.ui.compare.pickup-first', params: {} }] });
    const armor = known('R02'), weapon = known('R01');
    expect(() => buildLootCompareView(armor.item, [weapon.item], armor.catalog, { ...options, playerStrength: null })).toThrow(/CLASS_MISMATCH/);
    expect(() => buildLootCompareView(armor.item, [null, null], armor.catalog, { ...options, playerStrength: null })).toThrow(/INVALID_INPUT/);
    expect(() => buildLootCompareView(armor.item, [], armor.catalog, { ...options, playerStrength: NaN })).toThrow(/INVALID_INPUT/);
  });
  it.each(LOOT_UI_FIXTURE_IDS)('salvage fully known oracle for all presets: %s', id => {
    const f = known(id);
    for (const preset of f.catalog.pack.presets.presets) {
      const view = buildLootSalvageView([{ key: id, item: f.item }], f.catalog, preset.id), expected = salvageYield(f.data, preset, f.catalog.pack);
      expect(view.total).toEqual({ min: expected, max: expected }); expect(view.confirmable).toBe(true);
      expect(view.exchange.params).toEqual({ shards: f.catalog.pack.salvage.exchange.shards });
    }
  });
  it('corruption uncertainty yields a bounded interval; only eligible rarity and real intervals warn', () => {
    const f = known('R10', {}), view = buildLootSalvageView([{ key: 'a', item: f.item }], f.catalog, 'standard');
    const rules = f.catalog.pack.salvage, p = f.catalog.pack.presets.presets.find(p => p.id === 'standard')!;
    const normal = Math.max(rules.minimum, Math.floor(rules.base.rare * (1 + Math.floor(f.item.ilvl! / rules.ilvlStep)) * p.salvageMultiplierBp / 10000));
    expect(view.total).toEqual({ min: normal, max: Math.max(rules.minimum, Math.floor(normal * rules.corruptedMultiplierBp / 10000)) });
    expect(view.entries[0]!.warnings.map(w => w.nameKey)).toEqual(['ext.loot.ui.salvage.warn-range']);
    const unique = known('R14', {}), uv = buildLootSalvageView([{ key: 'u', item: unique.item }], unique.catalog, 'standard');
    expect(uv.entries[0]!.warnings.map(w => w.nameKey)).toEqual(['ext.loot.ui.salvage.warn-unique']); expect(uv.total.min).toBe(uv.total.max);
  });
  it('blocks floor/equipped, sums only allowed items, handles empty batch and duplicate keys', () => {
    const floor = known('R04', {}, { location: 'floor' }), equipped = known('E-W', {}, { location: 'equipped' }), allowed = known('R02');
    const view = buildLootSalvageView([{ key: 'floor', item: floor.item }, { key: 'equipped', item: equipped.item }, { key: 'allowed', item: allowed.item }], allowed.catalog, 'standard');
    expect(view.entries.slice(0, 2).map(e => e.blocked!.nameKey)).toEqual(['ext.loot.ui.salvage.blocked-floor', 'ext.loot.ui.salvage.blocked-equipped']);
    expect(view.total).toEqual(view.entries[2]!.shards); expect(view.entries[0]!.shards).toEqual({ min: 0, max: 0 });
    expect(buildLootSalvageView([], allowed.catalog, 'standard')).toMatchObject({ total: { min: 0, max: 0 }, confirmable: false });
    expect(() => buildLootSalvageView([{ key: 'a', item: allowed.item }, { key: 'a', item: allowed.item }], allowed.catalog, 'standard')).toThrow(/INVALID_INPUT/);
  });
});

describe('loot filters, data-derived presets and pure outputs', () => {
  it.each([['scarce', 'normal'], ['standard', 'magic'], ['bountiful', 'magic']] as const)('defaults %s to %s', (preset, minRarity) => {
    expect(defaultLootPickupFilter(preset)).toEqual({ v: 1, minRarity, classes: ['weapon', 'armor', 'ring'], autoPickupGold: true });
  });
  it('normalizes category order, permits empty classes, and rejects unknown presets', () => {
    expect(normalizeLootPickupFilter({ ...defaultLootPickupFilter('standard'), classes: ['ring', 'weapon'] }).classes).toEqual(['weapon', 'ring']);
    expect(normalizeLootPickupFilter({ ...defaultLootPickupFilter('standard'), classes: [] }).classes).toEqual([]);
    for (const id of ['missing', '__proto__', 'constructor']) expect(() => defaultLootPickupFilter(id)).toThrow(/UNKNOWN_PRESET/);
  });
  it.each([null, {}, { ...defaultLootPickupFilter('standard'), extra: true }, { ...defaultLootPickupFilter('standard'), minRarity: 'set' },
    { ...defaultLootPickupFilter('standard'), classes: ['ring', 'ring'] }, { ...defaultLootPickupFilter('standard'), classes: ['wand'] },
    { ...defaultLootPickupFilter('standard'), autoPickupGold: 1 }, { ...defaultLootPickupFilter('standard'), v: 2 }])('rejects malformed filter %#', value => {
    expect(() => normalizeLootPickupFilter(value)).toThrow(/INVALID_INPUT/);
  });
  it('derives all standard metrics from the package, with independently hand-calculated rarity weights', () => {
    const p = loadLootPack(), all = buildLootPresetOptions(p);
    expect(all.map(o => o.id)).toEqual(p.presets.presets.map(p => p.id));
    const metrics = all.find(p => p.id === 'standard')!.metrics;
    const metric = (key: string) => metrics.find(m => m.key === key)!;
    // standard kill multiplier10000/10000 =1.0; corrupt600/100=6%; gold10000/10000=1.0.
    expect(metric('kill-drop').value).toBe('×1.0'); expect(metric('corrupt').value).toBe('6%'); expect(metric('gold').value).toBe('×1.0');
    expect(metric('max-per-kill').value).toBe('2'); expect(metric('monster-peak').value).toBe('+50% / +100%');
    // ilvl1: weights700, floor(220*1.015)=223, floor(70*1.025)=71, floor(10*1.025)=10; sum1004.
    expect(metric('rarity-ilvl1').label.params).toEqual({ magic: '22.2%', rare: '7.1%', unique: '1.0%' });
    // ilvl30: weights700,319,122,17 sum1158; percentages round individually to one decimal.
    expect(metric('rarity-ilvl30').label.params).toEqual({ magic: '27.5%', rare: '10.5%', unique: '1.5%' });
    for (const option of all) expect(option.metrics.map(m => m.key)).toEqual(['kill-drop', 'max-per-kill', 'rarity-ilvl1', 'rarity-ilvl30', 'corrupt', 'gold', 'monster-peak']);
  });
  it('responds to input package metrics rather than embedding current numbers', () => {
    const pack = structuredClone(loadLootPack());
    const p = pack.presets.presets[1]!; p.killDropMultiplierBp = 12500; p.goldMultiplierBp = 17500; p.corruptChanceBp = 125;
    p.maxPerKill = 7; p.monsterScaling[0]!.hpBp = 12345; p.monsterScaling[0]!.damageBp = 23456;
    const metrics = buildLootPresetOptions(pack)[1]!.metrics;
    expect(metrics.find(m => m.key === 'kill-drop')!.value).toBe('×1.25'); expect(metrics.find(m => m.key === 'gold')!.value).toBe('×1.75');
    expect(metrics.find(m => m.key === 'corrupt')!.value).toBe('1.25%'); expect(metrics.find(m => m.key === 'max-per-kill')!.value).toBe('7');
    expect(metrics.find(m => m.key === 'monster-peak')!.value).toBe('+123.45% / +234.56%');
  });
  it('rejects malformed public DTO/base/affix, unknown preset and malformed options', () => {
    const f = known('R04');
    expect(() => buildLootChipView(f.data as unknown as LootKnownItem, f.catalog)).toThrow(/INVALID_INPUT/);
    expect(() => buildLootChipView({ ...f.item, baseId: 'missing' }, f.catalog)).toThrow(/UNKNOWN_BASE/);
    const row = f.item.affixes.find(r => r.known)!;
    expect(() => buildLootChipView({ ...f.item, affixes: [{ ...row, id: 'missing' }, ...f.item.affixes.slice(1)] } as LootKnownItem, f.catalog)).toThrow(/UNKNOWN_AFFIX/);
    expect(() => buildLootItemView(f.item, f.catalog, { presetId: 'missing' })).toThrow(/UNKNOWN_PRESET/);
    expect(() => buildLootItemView(f.item, f.catalog, { presetId: 'standard', showTiers: 1 } as unknown as LootUiOptions)).toThrow(/INVALID_INPUT/);
    expect(() => buildLootSalvageView([], f.catalog, 'missing')).toThrow(/UNKNOWN_PRESET/);
    expect(() => buildLootPresetOptions(null as unknown as LootPack)).toThrowError(new LootUiError('INVALID_INPUT', 'pack'));
  });
  it.each(['R07', 'R12'] as const)('rejects forged identification exposing hidden identity on held/equipped %s', id => {
    for (const location of ['pack', 'equipped'] as const) {
      const f = known(id, {}, { location });
      const forged = { ...f.item, identified: true, rareName: f.data.nameParts, uniqueId: f.data.uniqueId };
      expect(f.item.affixes.some(row => !row.known)).toBe(true);
      expect(() => buildLootChipView(forged, f.catalog)).toThrowError(new LootUiError('INVALID_INPUT', 'item.identified'));
      expect(() => buildLootItemView(forged, f.catalog, options)).toThrow(/INVALID_INPUT/);
      expect(() => knownModifierDrafts(forged, f.catalog)).toThrow(/INVALID_INPUT/);
    }
  });
  it.each(['R07', 'R12'] as const)('rejects reverse identification mismatch and missing fully known identity for %s', id => {
    const f = known(id);
    expect(() => buildLootChipView({ ...f.item, identified: false, rareName: null, uniqueId: null }, f.catalog)).toThrow(/INVALID_INPUT/);
    expect(() => buildLootChipView({ ...f.item, rareName: null, uniqueId: null }, f.catalog)).toThrow(/INVALID_INPUT/);
    const floor = known(id, { reveal: 'all' }, { location: 'floor' });
    expect(() => buildLootChipView(floor.item, floor.catalog)).not.toThrow();
  });
  it('rejects a known unique identity that disagrees with the disclosed base or fixed rows', () => {
    const f = known('R12');
    expect(() => buildLootChipView({ ...f.item, uniqueId: 'loot.unique.whisper' }, f.catalog)).toThrow(/INVALID_INPUT/);
    expect(() => buildLootChipView({ ...f.item, affixes: [...f.item.affixes].reverse() }, f.catalog)).toThrow(/INVALID_INPUT/);
  });
  it('every builder freezes output, leaves frozen input unchanged and never calls random', () => {
    const f = known('R04', { reveal: [0] }), item = freezeLootUi(f.item), opts = freezeLootUi({ ...options, playerStrength: null });
    const before = JSON.stringify({ item, opts, pack: f.catalog.pack }), random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('unexpected random'); });
    try {
      const results = [buildLootChipView(item, f.catalog), buildLootItemView(item, f.catalog, opts), buildLootCompareView(item, [null], f.catalog, opts),
        buildLootSalvageView([{ key: 'x', item }], f.catalog, 'standard'), defaultLootPickupFilter('standard'),
        normalizeLootPickupFilter(defaultLootPickupFilter('standard')), buildLootPresetOptions(LOOT_UI_CATALOGS.none.pack)];
      expect(results.every(allFrozen)).toBe(true); expect(JSON.stringify({ item, opts, pack: f.catalog.pack })).toBe(before); expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });
});
