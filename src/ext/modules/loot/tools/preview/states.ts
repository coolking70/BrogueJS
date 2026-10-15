/** All §8 states are built from genuine fixture data through the knowledge boundary.
 * Raw fixture provenance is kept beside, and never inside, component props.
 */
import { freezeLootValue } from '../../catalog';
import { loadLootPack } from '../../definitions';
import { enhancementCap } from '../../economy';
import type { EffectiveLootCatalog, LootItemDataV1 } from '../../types';
import { projectLootKnowledge } from '../../ui/knowledge';
import {
  buildLootChipView, buildLootCompareView, buildLootItemView, buildLootPresetOptions,
  buildLootSalvageView, defaultLootPickupFilter,
} from '../../ui/viewModel';
import type {
  LootChipView, LootCompareView, LootItemView, LootKnowledgeFacts, LootKnownItem,
  LootPickupFilterDraft, LootPresetOptionView, LootSalvageView, LootTextRef, LootUiOptions,
} from '../../ui/types';
import { getLootUiFixture, transformLootUiFixture } from './fixtures';
import type { LootUiFixtureId, LootUiFixtureTransform } from './fixtures';

export interface LootUiFixtureProvenance {
  readonly id: LootUiFixtureId;
  readonly data: LootItemDataV1;
  readonly catalog: EffectiveLootCatalog;
  readonly facts: LootKnowledgeFacts;
}
interface StateBase {
  readonly id: string;
  readonly fixtures: readonly LootUiFixtureProvenance[];
  readonly setup?: 'unfold' | 'dirty' | 'keyboard';
}
export type LootUiState = StateBase & (
  | { readonly component: 'chip'; readonly props: { readonly view: LootChipView; readonly interactive?: boolean; readonly selected?: boolean; readonly compact?: boolean } }
  | { readonly component: 'card'; readonly props: { readonly view: LootItemView; readonly maxRows?: number; readonly actions?: readonly ('compare' | 'salvage' | 'close')[]; readonly initiallyExpanded?: boolean } }
  | { readonly component: 'compare'; readonly props: { readonly view: LootCompareView; readonly maxRows?: number } }
  | { readonly component: 'salvage'; readonly props: { readonly view: LootSalvageView; readonly submitting?: boolean } }
  | { readonly component: 'filter'; readonly props: { readonly value: LootPickupFilterDraft; readonly defaults: LootPickupFilterDraft; readonly presetName: LootTextRef; readonly readOnly?: boolean; readonly submitting?: boolean; readonly initialDraft?: LootPickupFilterDraft } }
  | { readonly component: 'preset'; readonly props: { readonly options: readonly LootPresetOptionView[]; readonly modelValue: string; readonly disabled?: boolean } }
);
export const LOOT_UI_COMPONENTS = ['chip', 'card', 'compare', 'salvage', 'filter', 'preset'] as const;
export const LOOT_UI_PREVIEW_WIDTHS = [320, 390, 1024] as const;
export const LOOT_UI_PREVIEW_THEMES = ['dark', 'light'] as const;

export function lootUiFacts(overrides: Partial<LootKnowledgeFacts> = {}): LootKnowledgeFacts {
  return freezeLootValue({ v: 1, location: 'pack', ringKindKnown: true, magicPolarity: 'unknown', curseRevealed: false, hallucinating: false, familiarity: null, ...overrides });
}
function source(id: LootUiFixtureId, transform: LootUiFixtureTransform = {}, facts: Partial<LootKnowledgeFacts> = {}): LootUiFixtureProvenance {
  return { id, data: transformLootUiFixture(id, transform), catalog: getLootUiFixture(id).catalog, facts: lootUiFacts(facts) };
}
function known(fixture: LootUiFixtureProvenance): LootKnownItem {
  return projectLootKnowledge(fixture.data, fixture.catalog, fixture.facts);
}
const all = (id: LootUiFixtureId, facts: Partial<LootKnowledgeFacts> = {}) => source(id, { reveal: 'all' }, facts);
const floor = (id: LootUiFixtureId) => source(id, {}, { location: 'floor' });
const equipped = (id: LootUiFixtureId) => all(id, { location: 'equipped' });
const options: LootUiOptions = { presetId: 'standard' };
function chip(id: string, fixture: LootUiFixtureProvenance, props: { interactive?: boolean; selected?: boolean } = {}): LootUiState {
  return { id, component: 'chip', fixtures: [fixture], props: { view: buildLootChipView(known(fixture), fixture.catalog), ...props } };
}
function card(id: string, fixture: LootUiFixtureProvenance, extra: { maxRows?: number } = {}, uiOptions: LootUiOptions = options, setup?: 'unfold'): LootUiState {
  return { id, component: 'card', fixtures: [fixture], props: { view: buildLootItemView(known(fixture), fixture.catalog, uiOptions), actions: ['compare', 'salvage', 'close'], ...extra }, ...(setup ? { setup } : {}) };
}
function compare(id: string, candidate: LootUiFixtureProvenance, current: readonly (LootUiFixtureProvenance | null)[], extra: { maxRows?: number; playerStrength?: number | null } = {}): LootUiState {
  return { id, component: 'compare', fixtures: [candidate, ...current.filter((entry): entry is LootUiFixtureProvenance => entry !== null)], props: {
    view: buildLootCompareView(known(candidate), current.map(entry => entry ? known(entry) : null), candidate.catalog, { ...options, playerStrength: extra.playerStrength ?? null }),
    ...(extra.maxRows === undefined ? {} : { maxRows: extra.maxRows }),
  } };
}
function salvage(id: string, fixtures: readonly LootUiFixtureProvenance[], presetId = 'standard'): LootUiState {
  return { id, component: 'salvage', fixtures, props: { view: buildLootSalvageView(fixtures.map((fixture, index) => ({ key: `${fixture.id}:${index}`, item: known(fixture) })), fixtures[0]!.catalog, presetId) } };
}
function filter(id: string, presetId = 'standard', extra: { readOnly?: boolean; noClasses?: boolean; setup?: 'dirty' } = {}): LootUiState {
  const defaults = defaultLootPickupFilter(presetId);
  const preset = loadLootPack().presets.presets.find(entry => entry.id === presetId)!;
  return { id, component: 'filter', fixtures: [], props: {
    value: extra.noClasses ? { ...defaults, classes: [] } : defaults,
    defaults, presetName: { nameKey: preset.nameKey, params: {} }, ...(extra.readOnly ? { readOnly: true } : {}),
  }, ...(extra.setup ? { setup: extra.setup } : {}) };
}
const presetOptions = buildLootPresetOptions(loadLootPack());
function preset(id: string, disabled = false, setup?: 'keyboard'): LootUiState {
  return { id, component: 'preset', fixtures: [], props: { options: presetOptions, modelValue: 'standard', disabled }, ...(setup ? { setup } : {}) };
}
const magicCap = enhancementCap(getLootUiFixture('R04').data);

export const LOOT_UI_STATES: readonly LootUiState[] = freezeLootValue([
  chip('chip.normal', all('R01')),
  chip('chip.magic-unknown', source('R04')),
  chip('chip.rare-identified', all('R07')),
  chip('chip.rare-unknown', source('R07')),
  chip('chip.unique-unknown', source('R14')),
  chip('chip.unique-identified', all('R14')),
  chip('chip.corrupted', all('R10')),
  chip('chip.enhanced', source('R04', { reveal: 'all', enhancement: 8 })),
  chip('chip.floor', floor('R06')),
  chip('chip.hallucinating', source('R06', {}, { location: 'floor', hallucinating: true })),
  chip('chip.ring-kind-unknown', source('R05', {}, { ringKindKnown: false })),
  chip('chip.selected', all('R07'), { interactive: true, selected: true }),

  card('card.floor', floor('R06')),
  card('card.magic-unknown', source('R04')),
  card('card.rare-partial', source('R06', { reveal: [0, 1] })),
  card('card.rare-brutal', all('R07')),
  card('card.giantsbane', all('R08')),
  card('card.unique-unknown', source('R12')),
  card('card.unique-maul', all('R12')),
  card('card.unique-ring', all('R13')),
  card('card.malevolent', source('R10', {}, { magicPolarity: 'malevolent' })),
  card('card.corrupted', all('R10')),
  card('card.combat-affix', all('R15')),
  card('card.growth-labels', all('R16'), {}, { ...options, attributeLabels: { strength: '力量', dexterity: '敏捷', wisdom: '智慧' } }),
  card('card.growth-fallback', all('R16')),
  card('card.enhanced-cap', source('R04', { reveal: 'all', enhancement: magicCap })),
  card('card.folded', all('R09'), { maxRows: 4 }),
  card('card.unfolded', all('R09'), { maxRows: 4 }, options, 'unfold'),
  card('card.ring-unknown-kind', source('R05', {}, { ringKindKnown: false })),
  card('card.familiarity', source('R04', {}, { familiarity: { unit: 'kills', remaining: 3 } })),
  card('card.t6', all('R17')),

  compare('compare.weapon', all('R07'), [equipped('E-W')]),
  compare('compare.partial', source('R06', { reveal: [0, 1] }), [equipped('E-A')]),
  compare('compare.empty-slot', all('R02'), [null]),
  compare('compare.rings', all('R05'), [equipped('E-R1'), equipped('E-R2')]),
  compare('compare.strength-short', all('R07'), [equipped('E-W')], { playerStrength: 12 }),
  compare('compare.folded', all('R09'), [equipped('E-W')], { maxRows: 6 }),
  compare('compare.floor', floor('R06'), [equipped('E-A')]),

  salvage('salvage.single', [all('R04')]),
  salvage('salvage.batch', [all('R04'), source('R10'), all('R03')]),
  salvage('salvage.unique', [all('R14')]),
  salvage('salvage.blocked', [equipped('E-W'), all('R02')]),
  salvage('salvage.corrupted', [all('R10')]),
  salvage('salvage.bountiful', [all('R04')], 'bountiful'),

  filter('filter.standard'),
  filter('filter.dirty', 'standard', { setup: 'dirty' }),
  filter('filter.no-classes', 'standard', { noClasses: true }),
  filter('filter.read-only', 'standard', { readOnly: true }),
  filter('filter.bountiful', 'bountiful'),
  preset('preset.standard'),
  preset('preset.disabled', true),
  preset('preset.keyboard', false, 'keyboard'),
]);

export function getLootUiState(id: string): LootUiState {
  const state = LOOT_UI_STATES.find(entry => entry.id === id);
  if (!state) throw new RangeError(`Unknown loot UI state ${id}`);
  return state;
}

/** SSR cannot dispatch browser events. Optional initial-state props give it the
 * exact interactive result; component tests still replay each setup action.
 */
export function lootUiPreviewProps(state: LootUiState): LootUiState['props'] {
  if (state.component === 'card' && state.setup === 'unfold') return { ...state.props, initiallyExpanded: true };
  if (state.component === 'filter' && state.setup === 'dirty') return { ...state.props, initialDraft: { ...state.props.value, minRarity: 'rare' } };
  if (state.component === 'preset' && state.setup === 'keyboard') return { ...state.props, modelValue: 'bountiful' };
  return state.props;
}
