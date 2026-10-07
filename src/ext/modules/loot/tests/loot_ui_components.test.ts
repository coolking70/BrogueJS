import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRenderer, h, nextTick, shallowReactive, type Component } from 'vue';
import i18next from 'i18next';
import I18NextVue from 'i18next-vue';
import mainZh from '../../../../locales/zh_CN.json';
import coreZh from '../locales/zh_CN.json';
import uiZh from '../locales/ui.zh_CN.json';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { LOOT_UI_STATES, getLootUiState, type LootUiState } from '../tools/preview/states';
import { buildLootItemView } from '../ui/viewModel';
import { projectLootKnowledge } from '../ui/knowledge';
import { transformLootUiFixture } from '../tools/preview/fixtures';
import type { LootAffixRowView, LootPickupFilterDraft } from '../ui/types';

interface HostNode {
  kind: 'element' | 'text' | 'comment' | 'root'; tag: string; text: string;
  props: Record<string, any>; children: HostNode[]; parent: HostNode | null;
  focus(): void; querySelector<T>(selector: string): T | null;
}
let focused: HostNode | null = null;
function node(kind: HostNode['kind'], tag = '', text = ''): HostNode {
  const result: HostNode = { kind, tag, text, props: {}, children: [], parent: null,
    focus() { focused = result; },
    querySelector<T>(selector: string): T | null {
      const match = /^\[([^=]+)="([^"]+)"\]$/.exec(selector);
      return (match ? descendants(result).find(child => String(child.props[match[1]!]) === match[2]) ?? null : null) as T | null;
    },
  };
  return result;
}
const renderer = createRenderer<HostNode, HostNode>({
  createElement: tag => node('element', tag), createText: text => node('text', '', text), createComment: text => node('comment', '', text),
  insert(child, parent, anchor) {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child); child.parent = parent;
  },
  remove(child) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
  setText(target, text) { target.text = text; }, setElementText(target, text) { target.text = text; target.children = []; },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp(target, key, _old, value) { target.props[key] = value; },
});
const descendants = (root: HostNode): HostNode[] => [root, ...root.children.flatMap(descendants)];
const renderedText = (root: HostNode): string => (root.kind === 'comment' ? '' : root.text) + root.children.map(renderedText).join(' ');
const hasClass = (target: HostNode, value: string) => String(target.props.class ?? '').split(/\s+/).includes(value);
function find(root: HostNode, prop: string, value: unknown): HostNode {
  const found = descendants(root).find(target => target.props[prop] === value);
  expect(found, `${prop}=${String(value)}`).toBeTruthy(); return found!;
}
function findClass(root: HostNode, name: string): HostNode { const found = descendants(root).find(target => hasClass(target, name)); expect(found, name).toBeTruthy(); return found!; }
function serialize(root: HostNode): string {
  if (root.kind === 'comment') return '';
  if (root.kind === 'text') return root.text.trim() ? JSON.stringify(root.text) : '';
  if (root.kind === 'root') return root.children.map(serialize).filter(Boolean).join('\n');
  const attributes = Object.entries(root.props).filter(([key, value]) => value !== undefined && value !== null && (['class', 'id', 'role', 'disabled', 'tabindex'].includes(key) || key.startsWith('aria-') || key.startsWith('data-'))).sort(([a], [b]) => a.localeCompare(b));
  const opening = `<${root.tag}${attributes.map(([key, value]) => ` ${key}=${JSON.stringify(value)}`).join('')}>`;
  const children = [...(root.text ? [JSON.stringify(root.text)] : []), ...root.children.map(serialize).filter(Boolean)];
  return children.length ? `${opening}\n${children.map(child => child.split('\n').map(line => `  ${line}`).join('\n')).join('\n')}\n</${root.tag}>` : `${opening}</${root.tag}>`;
}
async function click(target: HostNode) {
  if (!target.props.disabled) target.props.onClick?.({ target, currentTarget: target, preventDefault() {}, stopPropagation() {} });
  await nextTick();
}
async function key(target: HostNode, value: string) {
  const event = { key: value, target, currentTarget: target, preventDefault: vi.fn(), stopPropagation: vi.fn() };
  target.props.onKeydown?.(event); await nextTick(); await nextTick(); return event;
}
const files = { chip: 'LootItemChip', card: 'LootItemCard', compare: 'LootComparePanel', salvage: 'LootSalvagePanel', filter: 'LootPickupFilterForm', preset: 'LootPresetPicker' } as const;
const components = {} as Record<LootUiState['component'], Component>;
const mounted: Array<ReturnType<typeof renderer.createApp>> = [];
const locale = i18next.createInstance();
beforeAll(async () => {
  await locale.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: { ...mainZh, ...coreZh, ...uiZh } } } });
  const harness = createSfcHarness({ baseURL: import.meta.url });
  for (const name of Object.keys(files) as LootUiState['component'][]) components[name] = await harness.load(`../ui/${files[name]}.vue`);
});
afterEach(() => { mounted.splice(0).forEach(app => app.unmount()); focused = null; });
function mountState(state: LootUiState, overrides: Record<string, unknown> = {}) {
  const props = shallowReactive<Record<string, any>>({ ...state.props, ...overrides });
  const events: Record<string, unknown[][]> = {};
  const record = (event: string, ...args: unknown[]) => { (events[event] ??= []).push(args); };
  const root = node('root');
  const app = renderer.createApp({ render: () => h(components[state.component], {
    ...props, onActivate: () => record('activate'), onAction: (id: string) => record('action', id),
    onClose: () => record('close'), onCancel: () => record('cancel'), onConfirm: (value: unknown) => record('confirm', value),
    onSubmit: (draft: LootPickupFilterDraft) => record('submit', draft),
    'onUpdate:modelValue': (id: string) => { record('update:modelValue', id); props.modelValue = id; },
  }) });
  app.use(I18NextVue, { i18next: locale }); app.mount(root); mounted.push(app);
  return { root, props, events };
}
async function setupState(state: LootUiState, root: HostNode) {
  if (state.setup === 'unfold') await click(find(root, 'data-action', 'toggle-rows'));
  if (state.setup === 'dirty') await click(find(root, 'data-rarity', 'rare'));
  if (state.setup === 'keyboard') await key(find(root, 'role', 'radiogroup'), 'ArrowRight');
}
function submitForm(root: HostNode) { findClass(root, 'loot-filter').props.onSubmit({ preventDefault() {} }); }

describe('loot UI complete state snapshots', () => {
  for (const state of LOOT_UI_STATES) it(state.id, async () => {
    const { root } = mountState(state); await setupState(state, root);
    expect(renderedText(root)).not.toMatch(/ext\.loot\.|runic\.name\.|name\.[A-Z]/);
    expect(serialize(root)).toMatchSnapshot();
  });
});

describe('loot UI local interactions', () => {
  it('keeps preset confirm button Space activation and arrows outside the radio group native', async () => {
    const preset = mountState(getLootUiState('preset.standard'));
    const button = find(preset.root, 'data-action', 'confirm');
    const bubble = async (value: string) => {
      const event = { key: value, target: button, currentTarget: button,
        preventDefault: vi.fn(), stopPropagation: vi.fn() };
      for (let current: HostNode | null = button; current; current = current.parent) {
        event.currentTarget = current;
        current.props.onKeydown?.(event);
        if (event.stopPropagation.mock.calls.length) break;
      }
      await nextTick();
      return event;
    };
    expect((await bubble('ArrowRight')).preventDefault).not.toHaveBeenCalled();
    expect(preset.props.modelValue).toBe('standard');
    const space = await bubble(' ');
    expect(space.preventDefault).not.toHaveBeenCalled();
    // A browser dispatches the focused button's click on Space keyup unless canceled.
    if (!space.preventDefault.mock.calls.length) await click(button);
    expect(preset.events.confirm).toEqual([['standard']]);
  });
  it('emits chip activation only when interactive, exactly once per click/Enter/Space', async () => {
    const plain = mountState(getLootUiState('chip.normal'));
    await click(findClass(plain.root, 'loot-item-chip')); await key(findClass(plain.root, 'loot-item-chip'), 'Enter');
    expect(plain.events.activate).toBeUndefined();
    const active = mountState(getLootUiState('chip.selected'));
    const chip = findClass(active.root, 'loot-item-chip'); expect(chip.tag).toBe('button'); expect(chip.props['aria-pressed']).toBe(true);
    await click(chip); await key(chip, 'Enter'); await key(chip, ' ');
    expect(active.events.activate).toEqual([[], [], []]);
  });
  it('folds and unfolds card rows, resets for a changed view, and gates Escape by actions', async () => {
    const state = getLootUiState('card.folded'); if (state.component !== 'card') throw new Error('fixture component');
    const mountedCard = mountState(state);
    const rows = () => descendants(mountedCard.root).filter(item => hasClass(item, 'loot-affix-row'));
    expect(rows()).toHaveLength(4);
    await click(find(mountedCard.root, 'data-action', 'toggle-rows')); expect(rows()).toHaveLength(state.props.view.rows.length);
    await click(find(mountedCard.root, 'data-action', 'toggle-rows')); expect(rows()).toHaveLength(4);
    await key(findClass(mountedCard.root, 'loot-item-card'), 'Escape'); expect(mountedCard.events.action).toEqual([['close']]);
    await click(find(mountedCard.root, 'data-action', 'compare')); await click(find(mountedCard.root, 'data-action', 'salvage'));
    expect(mountedCard.events.action).toEqual([['close'], ['compare'], ['salvage']]);
    mountedCard.props.actions = []; await nextTick(); await key(findClass(mountedCard.root, 'loot-item-card'), 'Escape');
    expect(mountedCard.events.action).toHaveLength(3);
    await click(find(mountedCard.root, 'data-action', 'toggle-rows')); mountedCard.props.view = { ...state.props.view }; await nextTick(); expect(rows()).toHaveLength(4);
    const initially = mountState(state, { initiallyExpanded: true }); expect(descendants(initially.root).filter(item => hasClass(item, 'loot-affix-row'))).toHaveLength(state.props.view.rows.length);
  });
  it('expands compare columns independently and emits close for its button and Escape', async () => {
    const state = getLootUiState('compare.folded'); if (state.component !== 'compare') throw new Error('fixture component');
    const mountedCompare = mountState(state);
    const rows = () => descendants(mountedCompare.root).filter(item => hasClass(item, 'loot-compare-row'));
    expect(rows()).toHaveLength(6);
    await click(find(mountedCompare.root, 'data-action', 'toggle-compare')); expect(rows()).toHaveLength(state.props.view.columns[0]!.rows.length);
    await click(find(mountedCompare.root, 'data-action', 'toggle-compare')); expect(rows()).toHaveLength(6);
    await key(findClass(mountedCompare.root, 'loot-compare'), 'Escape'); await click(find(mountedCompare.root, 'data-action', 'close'));
    expect(mountedCompare.events.close).toEqual([[], []]);
  });
  it('confirms only unblocked salvage keys in entry order and guards blocked/submitting states', async () => {
    const state = getLootUiState('salvage.blocked'); if (state.component !== 'salvage') throw new Error('fixture component');
    const salvage = mountState(state);
    await click(find(salvage.root, 'data-action', 'confirm'));
    expect(salvage.events.confirm).toEqual([[state.props.view.entries.filter(entry => !entry.blocked).map(entry => entry.key)]]);
    salvage.props.submitting = true; await nextTick(); expect(find(salvage.root, 'data-action', 'confirm').props.disabled).toBe(true);
    find(salvage.root, 'data-action', 'confirm').props.onClick(); expect(salvage.events.confirm).toHaveLength(1);
    await key(findClass(salvage.root, 'loot-salvage'), 'Escape'); await click(find(salvage.root, 'data-action', 'cancel')); expect(salvage.events.cancel).toEqual([[], []]);
    salvage.props.view = { ...state.props.view, confirmable: false }; salvage.props.submitting = false; await nextTick();
    expect(find(salvage.root, 'data-action', 'confirm').props.disabled).toBe(true);
  });
  it('edits a private filter draft, normalizes submission, resets defaults, and tracks incoming value', async () => {
    const state = getLootUiState('filter.standard'); if (state.component !== 'filter') throw new Error('fixture component');
    const filter = mountState(state);
    expect(find(filter.root, 'data-action', 'submit').props.disabled).toBe(true);
    submitForm(filter.root); expect(filter.events.submit).toBeUndefined();
    await click(find(filter.root, 'data-rarity', 'rare'));
    await click(find(filter.root, 'data-class', 'weapon')); await click(find(filter.root, 'data-class', 'weapon'));
    await click(find(filter.root, 'data-action', 'gold'));
    expect(state.props.value).toEqual(state.props.defaults);
    submitForm(filter.root);
    expect(filter.events.submit).toEqual([[{ v: 1, minRarity: 'rare', classes: ['weapon', 'armor', 'ring'], autoPickupGold: false }]]);
    expect(Object.isFrozen(filter.events.submit![0]![0])).toBe(true);
    await click(find(filter.root, 'data-action', 'reset')); expect(find(filter.root, 'data-action', 'submit').props.disabled).toBe(true);
    filter.props.value = { ...state.props.value, minRarity: 'unique', classes: [] }; await nextTick();
    expect(find(filter.root, 'data-rarity', 'unique').props['aria-checked']).toBe(true);
    expect(find(filter.root, 'data-class', 'weapon').props['aria-checked']).toBe(false);
    expect(find(filter.root, 'data-action', 'submit').props.disabled).toBe(true);
    await key(findClass(filter.root, 'loot-filter'), 'Escape'); await click(find(filter.root, 'data-action', 'cancel')); expect(filter.events.cancel).toEqual([[], []]);
  });
  it('supports filter roving keyboard selection, Home/End, activation, and seeded dirty preview', async () => {
    const state = getLootUiState('filter.standard'); if (state.component !== 'filter') throw new Error('fixture component');
    const filter = mountState(state);
    const group = find(filter.root, 'role', 'radiogroup');
    for (const [press, rarity] of [['ArrowRight', 'rare'], ['End', 'unique'], ['Home', 'normal'], ['ArrowLeft', 'unique'], ['ArrowUp', 'rare'], ['ArrowDown', 'unique']] as const) {
      await key(group, press); expect(find(filter.root, 'data-rarity', rarity).props.tabindex).toBe(0); expect(focused).toBe(find(filter.root, 'data-rarity', rarity));
    }
    await key(group, ' '); await key(group, 'Enter'); expect(filter.events.submit).toBeUndefined();
    const initial = mountState(state, { initialDraft: { ...state.props.value, minRarity: 'rare' } });
    expect(find(initial.root, 'data-action', 'submit').props.disabled).toBe(false);
    initial.props.value = { ...state.props.value, minRarity: 'normal' }; await nextTick();
    expect(find(initial.root, 'data-rarity', 'normal').props['aria-checked']).toBe(true);
  });
  it('disables filter controls in read-only/submitting modes and blocks direct mutation handlers', async () => {
    for (const extra of [{ readOnly: true }, { submitting: true }]) {
      const filter = mountState(getLootUiState('filter.standard'), extra);
      expect(descendants(filter.root).filter(item => item.tag === 'button').every(item => item.props.disabled)).toBe(true);
      find(filter.root, 'data-rarity', 'rare').props.onClick(); find(filter.root, 'data-class', 'weapon').props.onClick(); find(filter.root, 'data-action', 'gold').props.onClick(); find(filter.root, 'data-action', 'reset').props.onClick(); submitForm(filter.root); await nextTick();
      expect(find(filter.root, 'data-rarity', 'magic').props['aria-checked']).toBe(true); expect(filter.events.submit).toBeUndefined();
      await key(find(filter.root, 'role', 'radiogroup'), 'ArrowRight'); expect(find(filter.root, 'data-rarity', 'magic').props['aria-checked']).toBe(true);
    }
  });
  it('changes preset with arrows/Home/End/Space and confirms on Enter/button without global handlers', async () => {
    const preset = mountState(getLootUiState('preset.standard'));
    const panel = find(preset.root, 'role', 'radiogroup');
    for (const [press, id] of [['ArrowRight', 'bountiful'], ['Home', 'scarce'], ['End', 'bountiful'], ['ArrowDown', 'scarce'], ['ArrowLeft', 'bountiful'], ['ArrowUp', 'standard']] as const) {
      await key(panel, press); expect(preset.props.modelValue).toBe(id); expect(find(preset.root, 'data-preset', id).props.tabindex).toBe(0); expect(focused).toBe(find(preset.root, 'data-preset', id));
    }
    await key(panel, ' '); await key(panel, 'Enter'); await click(find(preset.root, 'data-action', 'confirm'));
    expect(preset.events.confirm).toEqual([['standard'], ['standard']]);
    await click(find(preset.root, 'data-preset', 'scarce')); expect(preset.props.modelValue).toBe('scarce');
    preset.props.disabled = true; await nextTick(); await key(panel, 'ArrowRight'); await key(panel, 'Enter'); find(preset.root, 'data-preset', 'bountiful').props.onClick();
    expect(preset.props.modelValue).toBe('scarce'); expect(preset.events.confirm).toHaveLength(2);
  });
});

function rowTokens(row: LootAffixRowView): string[] {
  return [row.key.slice(row.key.indexOf(':') + 1), ...(row.name ? [String(locale.t(row.name.nameKey, row.name.params))] : []), ...row.lines.map(line => line.value)].filter(Boolean);
}
describe('loot UI knowledge boundary has no hidden affix disclosure', () => {
  const unknownStates = LOOT_UI_STATES.filter(state => state.fixtures.some(fixture => fixture.facts.location === 'floor' || fixture.data.affixes.some(affix => !affix.known)));
  for (const state of unknownStates) it(`does not disclose hidden data in ${state.id}`, async () => {
    const { root } = mountState(state); await setupState(state, root);
    const attributeText = descendants(root).flatMap(item => Object.entries(item.props).filter(([name, value]) => typeof value === 'string' && (name.startsWith('aria-') || name.startsWith('data-'))).map(([, value]) => value as string)).join(' ');
    const text = `${renderedText(root)} ${attributeText}`, json = JSON.stringify(state.props);
    const publicTokens = new Set<string>();
    const hiddenTokens = new Set<string>();
    for (const fixture of state.fixtures) {
      const projected = projectLootKnowledge(fixture.data, fixture.catalog, fixture.facts);
      const publicView = buildLootItemView(projected, fixture.catalog, { presetId: 'standard' });
      for (const row of publicView.rows.filter(row => row.known)) rowTokens(row).forEach(token => publicTokens.add(token));
      // Base values and shard totals are independently public and can collide with an affix's formatted value.
      for (const stat of publicView.baseStats) publicTokens.add(stat.value);
      const fullyKnown = transformLootUiFixture(fixture.id, { reveal: 'all', enhancement: fixture.data.enhancement });
      const full = buildLootItemView(projectLootKnowledge(fullyKnown, fixture.catalog, { ...fixture.facts, location: 'pack', familiarity: null }), fixture.catalog, { presetId: 'standard' });
      const hidden = new Set(fixture.data.affixes.map((affix, index) => fixture.facts.location === 'floor' || !affix.known ? index : -1).filter(index => index >= 0));
      for (const row of full.rows) if (hidden.has(Number(row.key.slice(0, row.key.indexOf(':'))))) {
        rowTokens(row).forEach(token => hiddenTokens.add(token));
      }
    }
    const stringLeaves = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(stringLeaves) : [];
    const propStrings = stringLeaves(state.props);
    const badgeCounts = descendants(root).filter(item => hasClass(item, 'loot-chip-unknown-badge')).flatMap(item => [renderedText(item), String(item.props['aria-label'] ?? '')]).filter(Boolean);
    for (const token of hiddenTokens) {
      // Equal text legitimately revealed by another equipped/known row is not a disclosure.
      if (publicTokens.has(token)) continue;
      if (/^\d+$/.test(token)) {
        // Runic strengths are unsigned integers: search exact string leaves, not color hex digits
        // or public numeric counts. In visible text remove only the independently public ?×N badges.
        expect(propStrings, `${state.id} hidden numeric value ${token}`).not.toContain(token);
        const withoutBadges = badgeCounts.reduce((result, badge) => result.replace(badge, ''), text);
        expect(withoutBadges, `${state.id} hidden numeric value ${token}`).not.toMatch(new RegExp(`(?<![\\d])${token}(?![\\d])`));
      } else {
        expect(json, `${state.id} hidden token ${token}`).not.toContain(token);
        expect(text, `${state.id} hidden token ${token}`).not.toContain(token);
      }
    }
    // Every unknown row structurally has no identity, tier, effect values, or negative-polarity hint.
    const audit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      if ('known' in value && value.known === false) {
        const row = value as LootAffixRowView;
        expect(Object.keys(row).sort()).toEqual(['key', 'known', 'lines', 'name', 'negative', 'position', 'tier']);
        expect(row.key).toMatch(/^\d+:unknown$/); expect(row.tier).toBeNull(); expect(row.lines).toEqual([]); expect(row.negative).toBe(false);
        expect(row.name).toEqual({ nameKey: `ext.loot.ui.unknown.${row.position}`, params: {} });
      }
      Object.values(value).forEach(audit);
    };
    audit(state.props);
  });
});
