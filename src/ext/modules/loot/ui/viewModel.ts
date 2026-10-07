import weapons from '../../../../data/weapons.json';
import armors from '../../../../data/armors.json';
import { computeRarityWeights } from '../rarity';
import { enhancementCap, ringImplicit } from '../economy';
import type { EffectiveLootCatalog, LootModifierDraft, LootPack, LootPreset, ModifierSpec } from '../types';
import type { LootAffixRowView, LootBaseStatView, LootChipView, LootCompareRowView, LootCompareView,
  LootItemView, LootKnownAffix, LootKnownItem, LootModLineView, LootNameView, LootPickupFilterDraft,
  LootPresetOptionView, LootSalvageView, LootTextRef, LootUiOptions } from './types';
import { assertLootKnownItem, knownAffixModifiers, knownModifierDrafts } from './knowledge';
import { exactLootKeys, freezeLootUi, isPlainLootObject, LootUiError } from './errors';
import { formatLootModifierRange, formatLootModifierValue, lootDecimal, lootSigned } from './format';
import { LOOT_UI_BASE_NAMES, LOOT_UI_CLASS_GLYPHS, LOOT_UI_CLASS_NAMES, LOOT_UI_FILTER_DEFAULTS,
  LOOT_UI_RUNICS, LOOT_UI_STATS } from './tables';

const BASE_LABELS = {
  damage: { nameKey: 'ext.loot.ui.base.damage', params: {} },
  armor: { nameKey: 'ext.loot.ui.base.armor', params: {} },
  strength: { nameKey: 'ext.loot.ui.base.strength', params: {} },
  implicit: { nameKey: 'ext.loot.ui.base.implicit', params: {} },
  enhancement: { nameKey: 'ext.loot.ui.base.enhancement', params: {} },
} satisfies Record<LootBaseStatView['key'], LootTextRef>;
const UNKNOWN_NAMES = {
  prefix: { nameKey: 'ext.loot.ui.unknown.prefix', params: {} },
  suffix: { nameKey: 'ext.loot.ui.unknown.suffix', params: {} },
  row: { nameKey: 'ext.loot.ui.unknown.row', params: {} },
} satisfies Record<LootKnownAffix['position'], LootTextRef>;

function ref(value: { readonly nameKey: string }, params: LootTextRef['params'] = {}): LootTextRef {
  return { nameKey: value.nameKey, params: { ...params } };
}
function getPreset(catalog: EffectiveLootCatalog, presetId: string): LootPreset {
  const preset = catalog.pack.presets.presets.find(p => p.id === presetId);
  if (!preset) throw new LootUiError('UNKNOWN_PRESET', 'presetId');
  return preset;
}
function checkOptions(options: LootUiOptions, catalog: EffectiveLootCatalog): void {
  if (!isPlainLootObject(options) || typeof options.presetId !== 'string'
    || (options.showTiers !== undefined && typeof options.showTiers !== 'boolean')
    || (options.attributeLabels !== undefined && (!isPlainLootObject(options.attributeLabels)
      || Object.values(options.attributeLabels).some(v => typeof v !== 'string')))) throw new LootUiError('INVALID_INPUT', 'options');
  getPreset(catalog, options.presetId);
}
function unknownCount(item: LootKnownItem): number { return item.affixes.filter(a => !a.known).length; }

export function buildLootChipView(item: LootKnownItem, catalog: EffectiveLootCatalog): LootChipView {
  assertLootKnownItem(item, catalog);
  const rarity = catalog.pack.rarities.rarities.find(r => r.id === item.rarity);
  const parts: Record<keyof LootNameView['parts'], LootTextRef | null> = { base: null, prefix: null, suffix: null, first: null, second: null, unique: null };
  if (item.rarity === null) parts.base = ref(LOOT_UI_CLASS_NAMES[item.itemClass]);
  else if (item.baseId === null) parts.base = { nameKey: 'ext.loot.ui.name.unknown-ring', params: {} };
  else {
    const base = LOOT_UI_BASE_NAMES.find(base => base.baseId === item.baseId);
    if (!base) throw new LootUiError('UNKNOWN_BASE', 'item.baseId');
    parts.base = ref(base);
  }
  let template = { nameKey: 'ext.loot.ui.name.normal' };
  if (item.rarity !== null && item.baseId !== null) {
    if (item.rarity === 'magic') {
      template = { nameKey: 'ext.loot.ui.name.magic' };
      for (const row of item.affixes) if (row.known && row.position !== 'row') {
        const def = catalog.affixes.find(def => def.id === row.id);
        if (!def) throw new LootUiError('UNKNOWN_AFFIX', 'item.affixes.id');
        parts[row.position] = ref(def);
      }
    } else if (item.rarity === 'rare') {
      if (item.rareName !== null) {
        template = { nameKey: 'ext.loot.ui.name.rare' };
        parts.first = ref(catalog.pack.rareNames.first[item.rareName[0]]!);
        parts.second = ref(catalog.pack.rareNames.second[item.rareName[1]]!);
      } else template = { nameKey: 'ext.loot.ui.name.rare-unidentified' };
    } else if (item.rarity === 'unique') {
      if (item.uniqueId !== null) {
        template = { nameKey: 'ext.loot.ui.name.unique' };
        parts.unique = ref(catalog.pack.uniques.uniques.find(unique => unique.id === item.uniqueId)!);
      } else template = { nameKey: 'ext.loot.ui.name.unique-unidentified' };
    }
  }
  return freezeLootUi({ glyph: LOOT_UI_CLASS_GLYPHS[item.itemClass], rarity: rarity ? {
    id: rarity.id, colorDark: rarity.colorDark, colorLight: rarity.colorLight, marker: rarity.marker, label: ref(rarity),
  } : { id: null, colorDark: 'var(--loot-dim)', colorLight: 'var(--loot-dim)', marker: '?', label: null },
  name: { nameKey: template.nameKey, parts, enhancement: item.enhancement },
  corrupted: item.corrupted, unknownCount: unknownCount(item), countHidden: item.location === 'floor' });
}

function statDefinition(mod: Pick<ModifierSpec, 'stat' | 'unit'>) {
  const stat = mod.stat.startsWith('growth.attribute:') ? 'growth.attribute:{attribute}' : mod.stat;
  const result = LOOT_UI_STATS.find(def => def.stat === stat && def.unit === mod.unit);
  if (!result) throw new LootUiError('INVALID_INPUT', 'modifier.stat');
  return result;
}
function statRef(mod: Pick<ModifierSpec, 'stat' | 'unit'>, options: LootUiOptions): LootTextRef {
  const def = statDefinition(mod);
  if (mod.stat.startsWith('growth.attribute:')) {
    const id = mod.stat.slice('growth.attribute:'.length);
    return ref(def, { name: options.attributeLabels?.[id] ?? id });
  }
  return ref(def);
}
function modifierLine(mod: ModifierSpec, value: number, polarity: 1 | -1, options: LootUiOptions,
  rangeMax?: number): LootModLineView {
  const direction = statDefinition(mod).better === 'higher' ? 1 : -1;
  const score = (rangeMax === undefined ? value : (value + rangeMax) / 2) * direction;
  const rune = mod.runicType ? LOOT_UI_RUNICS.find(r => r.runicType === mod.runicType) : null;
  return { value: rangeMax === undefined ? formatLootModifierValue(mod, value) : formatLootModifierRange(mod, value, rangeMax),
    stat: statRef(mod, options), condition: mod.conditions?.some(c => c.tag === 'body.large')
      ? { nameKey: 'ext.loot.ui.condition.body-large', params: {} } : null,
    runic: rune ? ref(rune) : null, tone: polarity === -1 ? 'bad' : score > 0 ? 'good' : score < 0 ? 'bad' : 'neutral' };
}
function affixRow(row: LootKnownAffix, index: number, catalog: EffectiveLootCatalog, options: LootUiOptions): LootAffixRowView {
  if (!row.known) return { key: `${index}:unknown`, known: false, position: row.position,
    name: ref(UNKNOWN_NAMES[row.position]), tier: null, lines: [], negative: false };
  const mods = knownAffixModifiers(row, catalog);
  const lines: LootModLineView[] = [];
  const consumed = new Set<number>();
  mods.forEach((mod, i) => {
    if (consumed.has(i)) return;
    const paired = mod.category === 'local-flat' ? mods.findIndex((other, j) => j > i && !consumed.has(j)
      && other.category === mod.category && other.stat === mod.stat && other.unit === mod.unit) : -1;
    if (paired >= 0) consumed.add(paired);
    lines.push(modifierLine(mod, row.values[mod.valueIndex]!, row.polarity, options,
      paired >= 0 ? row.values[mods[paired]!.valueIndex] : undefined));
  });
  const def = row.position === 'row' ? null : catalog.affixes.find(a => a.id === row.id)!;
  return { key: `${index}:${row.id}`, known: true, position: row.position, name: def ? ref(def) : null,
    tier: def && options.showTiers !== false ? row.tier : null, lines, negative: row.polarity === -1 };
}

type NumericBase = { key: 'damage' | 'armor' | 'strength' | 'implicit'; values: readonly number[] | null; partial: boolean };
function numericBase(item: LootKnownItem, catalog: EffectiveLootCatalog): NumericBase[] {
  const floor = item.location === 'floor';
  const partial = unknownCount(item) > 0;
  const drafts = knownModifierDrafts(item, catalog);
  const sum = (stat: string, category: ModifierSpec['category'], unit: ModifierSpec['unit']) => drafts
    .filter(m => m.stat === stat && m.category === category && m.unit === unit).reduce((total, m) => total + m.value, 0);
  if (item.itemClass === 'weapon') {
    const base = weapons.find(w => w.id === item.baseId);
    if (!base) throw new LootUiError('UNKNOWN_BASE', 'item.baseId');
    const strength: NumericBase = { key: 'strength', values: [base.strengthRequired], partial: false };
    if (floor) return [strength];
    const dice = /^(\d+)d(\d+)([+-]\d+)?$/.exec(base.damage)!;
    let min = Number(dice[1]) + Number(dice[3] ?? 0), max = Number(dice[1]) * Number(dice[2]) + Number(dice[3] ?? 0);
    for (const row of item.affixes) if (row.known) {
      const flat = knownAffixModifiers(row, catalog).filter(m => m.stat === 'loot.local.damage' && m.category === 'local-flat');
      if (flat.length) { min += row.values[flat[0]!.valueIndex]!; max += row.values[flat[1]?.valueIndex ?? flat[0]!.valueIndex]!; }
    }
    const bp = Math.max(0, 10000 + sum('loot.local.damage', 'local-increased', 'bp'));
    return [{ key: 'damage', values: [Math.floor(min * bp / 10000), Math.floor(max * bp / 10000)], partial }, strength];
  }
  if (item.itemClass === 'armor') {
    const base = armors.find(a => a.id === item.baseId);
    if (!base) throw new LootUiError('UNKNOWN_BASE', 'item.baseId');
    const strength: NumericBase = { key: 'strength', values: [base.strengthRequired], partial: false };
    if (floor) return [strength];
    const value = Math.min(22, base.armor * (10000 + sum('loot.local.armor', 'local-increased', 'bp')) / 10000
      + sum('native.defense', 'flat', 'display-armor') + sum('native.defense', 'flat', 'int') / 10);
    return [{ key: 'armor', values: [Math.floor(value * 10 + 1e-9) / 10], partial }, strength];
  }
  if (floor) return [];
  const hiddenUnique = item.rarity === 'unique' && partial;
  const override = drafts.find(m => m.stat === 'loot.ring-implicit' && m.category === 'override');
  const base = override?.value ?? ringImplicit(item.ilvl!, catalog.pack);
  const enhancement = Math.floor(item.enhancement / catalog.pack.enhancement.ring.implicitEveryLevels);
  return [{ key: 'implicit', values: hiddenUnique ? null : [base + enhancement], partial: hiddenUnique }];
}
function baseValue(row: NumericBase): string {
  return row.values === null ? '?' : row.values.map(value => lootDecimal(value, 1)).join('–');
}
export function buildLootItemView(item: LootKnownItem, catalog: EffectiveLootCatalog, options: LootUiOptions): LootItemView {
  assertLootKnownItem(item, catalog); checkOptions(options, catalog);
  const chip = buildLootChipView(item, catalog);
  const subtitle: LootTextRef[] = [];
  if (chip.rarity.label) subtitle.push(chip.rarity.label);
  if (item.ilvl !== null) subtitle.push({ nameKey: 'ext.loot.ui.subtitle.ilvl', params: { ilvl: item.ilvl } });
  subtitle.push(ref(LOOT_UI_CLASS_NAMES[item.itemClass]));
  const baseStats: LootBaseStatView[] = numericBase(item, catalog).map(row => ({ key: row.key,
    label: ref(BASE_LABELS[row.key]), value: baseValue(row), partial: row.partial }));
  if (item.enhancement > 0 && item.location !== 'floor') baseStats.push({ key: 'enhancement', label: ref(BASE_LABELS.enhancement),
    value: `${item.enhancement}/${enhancementCap({ rarity: item.rarity! }, catalog.pack)}`, partial: false });
  const order = { prefix: 0, suffix: 1, row: 2 };
  const rows = item.affixes.map((row, i) => affixRow(row, i, catalog, options)).sort((a, b) => order[a.position] - order[b.position]);
  const notices: LootTextRef[] = [];
  if (item.location === 'floor') notices.push({ nameKey: 'ext.loot.ui.notice.floor-count-hidden', params: {} });
  if (item.location !== 'floor' && unknownCount(item)) notices.push({ nameKey: 'ext.loot.ui.notice.unknown-active', params: {} });
  if (item.polarity === 'malevolent' && item.corrupted !== true) notices.push({ nameKey: 'ext.loot.ui.notice.malevolent', params: {} });
  if (item.polarity === 'benign' && !item.identified) notices.push({ nameKey: 'ext.loot.ui.notice.benign', params: {} });
  if (item.corrupted === true) notices.push({ nameKey: 'ext.loot.ui.notice.corrupted', params: {} });
  if (item.familiarity) notices.push(item.familiarity.unit === 'kills'
    ? { nameKey: 'ext.loot.ui.notice.familiarity-kills', params: { remaining: item.familiarity.remaining } }
    : { nameKey: 'ext.loot.ui.notice.familiarity-turns', params: { remaining: item.familiarity.remaining } });
  const unique = item.uniqueId ? catalog.pack.uniques.uniques.find(u => u.id === item.uniqueId) : null;
  return freezeLootUi({ chip, subtitle, baseStats, rows, notices,
    flavor: unique ? { nameKey: unique.descriptionKey, params: {} } : null });
}

function groupKey(mod: LootModifierDraft): string {
  return JSON.stringify([mod.stat, mod.category, mod.unit, mod.conditions ?? [], mod.runicType]);
}
function aggregate(item: LootKnownItem | null, catalog: EffectiveLootCatalog): Map<string, LootModifierDraft> {
  const groups = new Map<string, LootModifierDraft>();
  for (const mod of item ? knownModifierDrafts(item, catalog) : []) {
    const key = groupKey(mod), previous = groups.get(key);
    groups.set(key, { ...mod, value: (previous?.value ?? 0) + mod.value });
  }
  return groups;
}
function compareTone(delta: number, lower = false): LootCompareRowView['tone'] {
  const value = delta * (lower ? -1 : 1);
  return value > 0 ? 'better' : value < 0 ? 'worse' : 'same';
}
export function buildLootCompareView(candidate: LootKnownItem, equipped: readonly (LootKnownItem | null)[],
  catalog: EffectiveLootCatalog, options: LootUiOptions & { readonly playerStrength: number | null }): LootCompareView {
  assertLootKnownItem(candidate, catalog); checkOptions(options, catalog);
  if (!Array.isArray(equipped) || !(options.playerStrength === null || (Number.isSafeInteger(options.playerStrength) && options.playerStrength >= 0))) throw new LootUiError('INVALID_INPUT', 'compare');
  for (const item of equipped) if (item !== null) {
    assertLootKnownItem(item, catalog);
    if (item.itemClass !== candidate.itemClass) throw new LootUiError('CLASS_MISMATCH', 'equipped');
    if (item.location === 'floor') throw new LootUiError('INVALID_INPUT', 'equipped.location');
  }
  const chip = buildLootChipView(candidate, catalog);
  if (candidate.location === 'floor') return freezeLootUi({ candidate: chip, available: false, columns: [],
    notices: [{ nameKey: 'ext.loot.ui.compare.pickup-first', params: {} }] });
  const count = candidate.itemClass === 'ring' ? 2 : 1;
  if (equipped.length > count) throw new LootUiError('INVALID_INPUT', 'equipped.length');
  const afterBase = numericBase(candidate, catalog), afterMods = aggregate(candidate, catalog);
  const columns = Array.from({ length: count }, (_, i) => {
    const item = equipped[i] ?? null;
    const beforeBase = item ? numericBase(item, catalog) : [], beforeMods = aggregate(item, catalog);
    const rows: LootCompareRowView[] = afterBase.map(after => {
      const before = beforeBase.find(row => row.key === after.key);
      if (after.values === null || before?.values === null) return { key: after.key, label: ref(BASE_LABELS[after.key]),
        before: before ? baseValue(before) : '0', after: baseValue(after), delta: '?', tone: 'same' };
      const previous = before?.values ?? after.values.map(() => 0);
      const delta = after.values.map((v, j) => v - (previous[j] ?? 0));
      return { key: after.key, label: ref(BASE_LABELS[after.key]), before: previous.map(v => lootDecimal(v, 1)).join('–') + (before?.partial ? '?' : ''),
        after: baseValue(after) + (after.partial ? '?' : ''), delta: delta.map(v => lootSigned(v, 1)).join('–') + (before?.partial || after.partial ? '?' : ''),
        tone: compareTone(delta.reduce((a, b) => a + b, 0) / delta.length, after.key === 'strength') };
    });
    const keys = [...new Set([...beforeMods.keys(), ...afterMods.keys()])];
    keys.sort((a, b) => {
      const am = afterMods.get(a) ?? beforeMods.get(a)!, bm = afterMods.get(b) ?? beforeMods.get(b)!;
      return LOOT_UI_STATS.indexOf(statDefinition(am)) - LOOT_UI_STATS.indexOf(statDefinition(bm)) || a.localeCompare(b);
    });
    for (const key of keys) {
      const mod = afterMods.get(key) ?? beforeMods.get(key)!;
      const before = beforeMods.get(key)?.value ?? 0, after = afterMods.get(key)?.value ?? 0;
      // A delta is arithmetic, never an assignment or an unsigned runic magnitude.
      const deltaMod = { ...mod, category: 'flat' as const, unit: mod.unit === 'runic-strength' ? 'int' as const : mod.unit };
      rows.push({ key, label: statRef(mod, options), before: formatLootModifierValue(mod, before), after: formatLootModifierValue(mod, after),
        delta: formatLootModifierValue(deltaMod, after - before), tone: compareTone(after - before, statDefinition(mod).better === 'lower') });
    }
    const slot = candidate.itemClass === 'weapon' ? { nameKey: 'ext.loot.ui.slot.weapon', params: {} }
      : candidate.itemClass === 'armor' ? { nameKey: 'ext.loot.ui.slot.armor', params: {} }
        : i === 0 ? { nameKey: 'ext.loot.ui.slot.left-ring', params: {} } : { nameKey: 'ext.loot.ui.slot.right-ring', params: {} };
    return { slot, equipped: item ? buildLootChipView(item, catalog) : null, rows };
  });
  const notices: LootTextRef[] = [];
  const unknown = unknownCount(candidate) + equipped.reduce((n, item) => n + (item ? unknownCount(item) : 0), 0);
  if (unknown) notices.push({ nameKey: 'ext.loot.ui.compare.unknown-excluded', params: { count: unknown } });
  const strength = afterBase.find(row => row.key === 'strength')?.values?.[0] ?? 0;
  if (options.playerStrength !== null && options.playerStrength < strength) notices.push({ nameKey: 'ext.loot.ui.compare.strength-short', params: { short: strength - options.playerStrength } });
  notices.push({ nameKey: 'ext.loot.ui.compare.provisional', params: {} });
  return freezeLootUi({ candidate: chip, available: true, columns, notices });
}

export function buildLootSalvageView(entries: readonly { readonly key: string; readonly item: LootKnownItem }[],
  catalog: EffectiveLootCatalog, presetId: string): LootSalvageView {
  const preset = getPreset(catalog, presetId), rules = catalog.pack.salvage;
  if (!Array.isArray(entries)) throw new LootUiError('INVALID_INPUT', 'entries');
  const seen = new Set<string>();
  const views = entries.map(entry => {
    if (!isPlainLootObject(entry) || !exactLootKeys(entry, ['key', 'item']) || typeof entry.key !== 'string' || !entry.key || seen.has(entry.key)) throw new LootUiError('INVALID_INPUT', 'entries.key');
    seen.add(entry.key); assertLootKnownItem(entry.item, catalog);
    const item = entry.item;
    const blocked = item.location === 'floor' ? { nameKey: 'ext.loot.ui.salvage.blocked-floor', params: {} }
      : item.location === 'equipped' ? { nameKey: 'ext.loot.ui.salvage.blocked-equipped', params: {} } : null;
    const yieldFor = (corrupted: boolean): number => {
      if (item.ilvl === null || item.rarity === null) return 0;
      const base = rules.base[item.rarity as keyof typeof rules.base];
      if (base === undefined) throw new LootUiError('INVALID_INPUT', 'item.rarity');
      let q = Math.floor(base * (1 + Math.floor(item.ilvl / rules.ilvlStep)) * preset.salvageMultiplierBp / 10000);
      if (corrupted) q = Math.floor(q * rules.corruptedMultiplierBp / 10000);
      return Math.max(rules.minimum, q);
    };
    const range = item.corrupted === null && item.rarity !== null && catalog.pack.corruption.eligibleRarities.includes(item.rarity);
    const min = yieldFor(item.corrupted === true), max = range ? yieldFor(true) : min;
    const warnings: LootTextRef[] = [];
    if (item.rarity === 'unique') warnings.push({ nameKey: 'ext.loot.ui.salvage.warn-unique', params: {} });
    if (range && min !== max) warnings.push({ nameKey: 'ext.loot.ui.salvage.warn-range', params: {} });
    return { key: entry.key, chip: buildLootChipView(item, catalog), shards: { min, max }, blocked, warnings };
  });
  return freezeLootUi({ entries: views, total: views.filter(v => !v.blocked).reduce((sum, v) => ({ min: sum.min + v.shards.min, max: sum.max + v.shards.max }), { min: 0, max: 0 }),
    exchange: { nameKey: 'ext.loot.ui.salvage.exchange', params: { shards: rules.exchange.shards } }, confirmable: views.some(v => !v.blocked) });
}

export function defaultLootPickupFilter(presetId: string): LootPickupFilterDraft {
  const value = Object.prototype.hasOwnProperty.call(LOOT_UI_FILTER_DEFAULTS, presetId) ? LOOT_UI_FILTER_DEFAULTS[presetId] : undefined;
  if (!value) throw new LootUiError('UNKNOWN_PRESET', 'presetId');
  return freezeLootUi({ ...value, classes: [...value.classes] });
}
export function normalizeLootPickupFilter(value: unknown): LootPickupFilterDraft {
  if (!isPlainLootObject(value) || !exactLootKeys(value, ['v', 'minRarity', 'classes', 'autoPickupGold'])
    || value.v !== 1 || !['normal', 'magic', 'rare', 'unique'].includes(value.minRarity as string)
    || typeof value.autoPickupGold !== 'boolean' || !Array.isArray(value.classes)
    || Array.from(value.classes).some(c => !['weapon', 'armor', 'ring'].includes(c))
    || new Set(value.classes).size !== value.classes.length) throw new LootUiError('INVALID_INPUT', 'filter');
  const classes = (['weapon', 'armor', 'ring'] as const).filter(c => (value.classes as string[]).includes(c));
  return freezeLootUi({ v: 1, minRarity: value.minRarity as LootPickupFilterDraft['minRarity'], classes, autoPickupGold: value.autoPickupGold });
}
export function buildLootPresetOptions(pack: LootPack): readonly LootPresetOptionView[] {
  if (!isPlainLootObject(pack) || !isPlainLootObject(pack.presets) || !Array.isArray(pack.presets.presets)) throw new LootUiError('INVALID_INPUT', 'pack');
  return freezeLootUi(pack.presets.presets.map(preset => {
    const rarity = (ilvl: number) => {
      const weights = computeRarityWeights(preset, ilvl, 0, 10000, 0, 'normal');
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      return { magic: `${(weights.magic / sum * 100).toFixed(1)}%`, rare: `${(weights.rare / sum * 100).toFixed(1)}%`, unique: `${(weights.unique / sum * 100).toFixed(1)}%` };
    };
    const low = rarity(1), high = rarity(30);
    const multiplier = (bp: number) => `×${bp % 10000 === 0 ? (bp / 10000).toFixed(1) : lootDecimal(bp / 10000)}`;
    return { id: preset.id, name: ref(preset), description: { nameKey: preset.descriptionKey, params: {} }, metrics: [
      { key: 'kill-drop', label: { nameKey: 'ext.loot.ui.preset.kill-drop', params: {} }, value: multiplier(preset.killDropMultiplierBp) },
      { key: 'max-per-kill', label: { nameKey: 'ext.loot.ui.preset.max-per-kill', params: {} }, value: String(preset.maxPerKill) },
      { key: 'rarity-ilvl1', label: { nameKey: 'ext.loot.ui.preset.rarity-ilvl1', params: low }, value: '' },
      { key: 'rarity-ilvl30', label: { nameKey: 'ext.loot.ui.preset.rarity-ilvl30', params: high }, value: '' },
      { key: 'corrupt', label: { nameKey: 'ext.loot.ui.preset.corrupt', params: {} }, value: `${lootDecimal(preset.corruptChanceBp / 100)}%` },
      { key: 'gold', label: { nameKey: 'ext.loot.ui.preset.gold', params: {} }, value: multiplier(preset.goldMultiplierBp) },
      { key: 'monster-peak', label: { nameKey: 'ext.loot.ui.preset.monster-peak', params: {} },
        value: `${lootSigned(Math.max(...preset.monsterScaling.map(s => s.hpBp)) / 100)}% / ${lootSigned(Math.max(...preset.monsterScaling.map(s => s.damageBp)) / 100)}%` },
    ] };
  }));
}
