import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import i18next from 'i18next';
import I18NextVue from 'i18next-vue';
import '../../../../i18n';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import type { ModuleUiHost } from '../../../ui/types';
import { loadCraftingPack } from '../definitions';
import locale from '../locales/zh_CN.json';
import { readCraftingUiView, emptyCraftingDraft, craftingErrorKey, type CraftingUiView, type CraftingDraft } from '../ui/view';
import { buildCancelCommand, buildCraftCommand, buildHarvestCommand, buildPlaceCommand } from '../ui/commands';
import { useCraftingUi } from '../ui/useCraftingUi';

function fixture(active = false): CraftingUiView {
  const pack = loadCraftingPack(), items = [...pack.materials, ...pack.tools];
  const name = (id: string) => items.find(row => row.id === id)!.nameKey;
  return {
    v: 1, available: true, levelRef: { kind: 'dungeon', depth: 2 }, inventoryStamp: 'inventory:1', lastError: null, sourceContainerId: null, sourceRevision: null, containers: [{id:12,revision:2,at:{x:10,y:10},capacity:16,occupiedSlots:0,reservedSlots:0,inReach:true}],
    activeTicket: active ? { ticketId: 4, ticketRevision: 2, kind: 'craft', definitionId: 'crafting.make-pick',
      nameKey: 'ext.crafting.recipe.make-pick.name', totalBatches: 5, completedBatches: 1, remainingTicks: 500, status: 'working' } : null,
    nodes: [{ interactableId: 1, definitionId: 'crafting.metal-node', nameKey: 'ext.crafting.node.metal-node.name', glyph: '矿', color: '#B7C3CF',
      remaining: 20, capacity: 20, available: 20, nodeRevision: 0, requiredToolTag: 'basic.pick', canHarvest: true, reason: null }],
    stations: [{ interactableId: 2, definitionId: 'crafting.table', nameKey: 'ext.crafting.station.table.name', tags: ['station.table'], stationRevision: 1, inReach: true }],
    recipes: pack.recipes.map(row => ({ recipeId: row.id, nameKey: row.nameKey, descriptionKey: row.descriptionKey,
      inputs: row.inputs.map(input => ({ ...input, nameKey: name(input.itemDefinitionId), perBatch: input.count, have: 20 })).map(({ count: _count, ...input }) => input),
      outputs: row.outputs.map(output => ({ itemDefinitionId: output.itemDefinitionId, nameKey: name(output.itemDefinitionId), perBatch: output.count })),
      workTicks: row.workTicks, stationTags: [...row.stationTags], stationId: row.stationTags.length ? 2 : null,
      stationRevision: row.stationTags.length ? 1 : null, maxBatch: 2, reason: null })),
    placements: pack.stations.map(row => ({ definitionId: row.id, nameKey: row.nameKey, placementTicks: row.placementTicks, source: 'materials', kitHave: 0,
      cost: row.placementCost.map(input => ({ itemDefinitionId: input.itemDefinitionId, nameKey: name(input.itemDefinitionId), need: input.count, have: 20 })) })),
    history: [{ factId: 3, operation: 'harvest', definitionId: 'crafting.metal-node', completedBatches: 1, result: 'completed', reason: null, tick: 100 }],
  };
}
const scopes: Vue.EffectScope[] = [];
const apps: { unmount(): void }[] = [];
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); scopes.splice(0).forEach(scope => scope.stop()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function session(active = false) {
  let state = fixture(active), identity: object = {}, canManage = true;
  const runtime = { readModuleView: vi.fn(() => ({ session: identity, state, canManageCharacter: canManage })) };
  const raw = { extensionRuntime: runtime, player: { id: 20, x: 10, y: 11 }, actorActions: { bundles: [] }, replayRecording: null as object | null,
    replayCursor: 0, isGameOver: false, pendingCommandConfirmation: null as { ownerCommandId: number } | null,
    recordedInputEvents: [] as { decisions?: boolean[] }[], executeCommand: vi.fn((_action: string, _data: string) => { state.inventoryStamp += ':next'; }) };
  let game = raw as unknown as ReturnType<ModuleUiHost['game']>, busy = false, present = true, canOpen = true;
  const keyboard = vi.fn(), unregister = vi.fn();
  const host: ModuleUiHost = { game: () => game, tick: Vue.ref(0), immersive: Vue.ref(false),
    isPresentationBusy: () => busy, canPresentInteraction: () => present, canOpenPanel: () => canOpen,
    beforeOpenPanel: vi.fn(), afterClosePanel: vi.fn(), cancelHeldKeys: vi.fn(),
    registerKeyHandler: handler => { keyboard.mockImplementation(handler); return unregister; } };
  const scope = Vue.effectScope(); scopes.push(scope);
  const loader = vi.fn(async () => ({ render: () => Vue.h('div') }));
  const ui = scope.run(() => useCraftingUi(host, loader))!;
  async function open() { ui.commands.value[0]!.invoke(); await Vue.nextTick(); await Vue.nextTick(); }
  return { ui, raw, runtime, host, scope, keyboard, unregister, loader, open,
    state: () => state, replace: (value: CraftingUiView) => { state = value; },
    busy: (value: boolean) => { busy = value; }, present: (value: boolean) => { present = value; },
    canOpen: (value: boolean) => { canOpen = value; }, identity: () => { identity = {}; },
    manage: (value: boolean) => { canManage = value; }, retireGame: () => { game = { ...raw } as unknown as typeof game; },
    props: () => ui.panel.value!.props as Record<string, any> };
}

function leafPaths(value: unknown, path: (string | number)[] = []): (string | number)[][] {
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, entry]) => leafPaths(entry, [...path, Array.isArray(value) ? Number(key) : key]));
  return [path];
}
const invalidPaths = leafPaths(fixture(true)).map(path => [path.join('.'), path] as const);
describe('crafting strict UI DTO boundary', () => {
  it('accepts the complete available projection as a detached deeply frozen copy', () => {
    const value = fixture(true), parsed = readCraftingUiView(value)!;
    expect(parsed).toEqual(value); expect(parsed).not.toBe(value); expect(Object.isFrozen(parsed.recipes[0]!.inputs[0])).toBe(true);
    value.nodes[0]!.remaining = 4; expect(parsed.nodes[0]!.remaining).toBe(20);
    expect(readCraftingUiView({ v: 1, available: false })).toBeNull();
    const fastestPlacement = fixture(); fastestPlacement.placements[0]!.placementTicks = 1; expect(readCraftingUiView(fastestPlacement)).not.toBeNull();
  });
  it.each(invalidPaths)('fails closed when leaf %s has an invalid type', (_name, path) => {
    const value: any = fixture(true); let target = value;
    for (const key of path.slice(0, -1)) target = target[key];
    const key = path[path.length - 1]!; target[key] = typeof target[key] === 'string' || target[key] === null ? 42 : 'invalid';
    expect(readCraftingUiView(value)).toBeNull();
  });
  it.each([
    (v: any) => { v.extra = true; }, (v: any) => { delete v.history; },
    (v: any) => { v.activeTicket.extra = 1; }, (v: any) => { v.nodes[0].remaining = 21; },
    (v: any) => { v.nodes[0].available = 21; }, (v: any) => { v.nodes[0].canHarvest = false; },
    (v: any) => { v.nodes[0].glyph = 'ab'; }, (v: any) => { v.nodes[0].color = 'red'; },
    (v: any) => { v.nodes.push(v.nodes[0]); }, (v: any) => { v.stations[0].tags = ['z', 'a']; },
    (v: any) => { v.recipes[0].maxBatch = 17; }, (v: any) => { v.recipes[0].stationRevision = 1; },
    (v: any) => { v.recipes[0].inputs[0].perBatch = 1.1; }, (v: any) => { v.recipes[0].inputs[0].have = Infinity; },
    (v: any) => { v.placements[0].source = 'kit'; }, (v: any) => { v.activeTicket.completedBatches = 6; },
    (v: any) => { v.history.push({ ...v.history[0], factId: 4 }); }, (v: any) => { v.history[0].result = 'accepted'; },
    (v: any) => { v.recipes[0].nameKey = 'ext.other.name'; }, (v: any) => { v.history[0].reason = ''; },
    (v: any) => { v.nodes[0].reason = 'C5_FAKE'; }, (v: any) => { v.nodes[0].interactableId = 0; },
    (v: any) => { v.nodes[0].nodeRevision = -1; }, (v: any) => { v.levelRef.depth = 41; },
    (v: any) => { v.placements[0].cost[0].need = 0; }, (v: any) => { v.nodes.length = 2; },
    (v: any) => { v.nodes[0].capacity = 10000; }, (v: any) => { v.nodes[0].glyph = '\ud800'; },
    (v: any) => { v.nodes[0].definitionId = 'crafting.a__b'; },
    (v: any) => { v.recipes[0].nameKey = 'ext.crafting.item.unknown.name'; },
    (v: any) => { v.recipes[0].inputs[0].have = 0; }, (v: any) => { v.placements[0].cost[0].have = 0; },
  ])('rejects range, enum, identity, ordering, shape and paired-field corruption %#', mutate => {
    const value = fixture(true); mutate(value); expect(readCraftingUiView(value)).toBeNull();
  });
  it('rejects accessors, polluted prototypes, symbol fields and thrown proxies without invoking getters', () => {
    const value = fixture(), getter = vi.fn(() => 20);
    Object.defineProperty(value.nodes[0], 'remaining', { enumerable: true, get: getter });
    expect(readCraftingUiView(value)).toBeNull(); expect(getter).not.toHaveBeenCalled();
    expect(readCraftingUiView(Object.assign(Object.create({ injected: true }), fixture()))).toBeNull();
    expect(readCraftingUiView({ ...fixture(), [Symbol('extra')]: true })).toBeNull();
    expect(readCraftingUiView(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap'); } }))).toBeNull();
  });
  it('selects only translated finite error keys with foundation then generic fallback', () => {
    expect(craftingErrorKey('C5_STALE', () => true)).toBe('ext.crafting.error.stale');
    expect(craftingErrorKey('C5_ROOM', key => key.startsWith('ext.foundation.'))).toBe('ext.foundation.world.error.room');
    expect(craftingErrorKey('C5_ROOM', () => false)).toBe('ext.crafting.ui.rejected');
    expect(craftingErrorKey('C5_UNKNOWN' as never, () => true)).toBe('ext.crafting.ui.rejected');
  });
});

describe('crafting UI exact command payloads', () => {
  it('serializes all four commands with only v1 payload fields from displayed revisions', () => {
    const view = fixture(true);
    expect(JSON.parse(buildHarvestCommand(view, 1)!)).toEqual({ module: 'crafting', action: 'harvest', payload: { v: 1, nodeId: 1, nodeRevision: 0, inventoryStamp: 'inventory:1', destinationId: null, destinationRevision: null } });
    expect(JSON.parse(buildCraftCommand(view, 'crafting.make-dagger', 2)!)).toEqual({ module: 'crafting', action: 'craft', payload: { v: 1, recipeId: 'crafting.make-dagger', batchCount: 2, stationId: 2, stationRevision: 1, sourceContainerId: null, sourceRevision: null, inventoryStamp: 'inventory:1' } });
    expect(JSON.parse(buildPlaceCommand(view, 'crafting.table', { x: 11, y: 10 })!)).toEqual({ module: 'crafting', action: 'place-station', payload: { v: 1, definitionId: 'crafting.table', x: 11, y: 10, inventoryStamp: 'inventory:1' } });
    expect(JSON.parse(buildCancelCommand(view)!)).toEqual({ module: 'crafting', action: 'cancel-work', payload: { v: 1, ticketId: 4, ticketRevision: 2 } });
    expect(JSON.parse(buildHarvestCommand(view, 1, { id: 12, revision: 2 })!).payload).toMatchObject({ destinationId: 12, destinationRevision: 2 });
    view.containers = [{id:12,revision:2,at:{x:10,y:10},capacity:16,occupiedSlots:0,reservedSlots:0,inReach:true}]; view.sourceContainerId=12; view.sourceRevision=2;
    expect(JSON.parse(buildCraftCommand(view, 'crafting.make-pick', 1, { id: 12, revision: 2 })!).payload).toMatchObject({ sourceContainerId: 12, sourceRevision: 2, stationId: null, stationRevision: null });
  });
  it('rejects unknown targets, unusable rows, invalid counts, coordinates and container pairs', () => {
    const view = fixture();
    for (const count of [0, 3, 17, -1, 1.5, NaN]) expect(buildCraftCommand(view, 'crafting.make-pick', count)).toBeNull();
    expect(buildHarvestCommand(view, 999)).toBeNull(); expect(buildCraftCommand(view, 'missing', 1)).toBeNull();
    expect(buildPlaceCommand(view, 'missing', { x: 1, y: 1 })).toBeNull(); expect(buildPlaceCommand(view, 'crafting.table', { x: Infinity, y: 1 })).toBeNull();
    expect(buildCraftCommand(view, 'crafting.make-pick', 1, { id: 12, revision: 2 })).toBeNull();
    expect(buildHarvestCommand(view, 1, { id: 1, revision: null } as never)).toBeNull(); expect(buildCancelCommand(view)).toBeNull();
    view.nodes[0]!.canHarvest = false; view.nodes[0]!.reason = 'C5_TOOL'; expect(buildHarvestCommand(view, 1)).toBeNull();
  });
});

describe('crafting session lifecycle and command safety', () => {
  it('lazy-loads one panel, preserves command ownership and pairs shell open/close once', async () => {
    const f = session(); expect(f.loader).not.toHaveBeenCalled(); expect(f.ui.commands.value[0]!.id).toBe('crafting.open');
    await f.open(); expect(f.ui.panelOpen.value).toBe(true); expect(f.host.beforeOpenPanel).toHaveBeenCalledOnce();
    f.ui.close(); f.ui.close(); expect(f.host.afterClosePanel).toHaveBeenCalledOnce(); await f.open(); expect(f.loader).toHaveBeenCalledOnce();
  });
  it('tab changes, directions and bounded steppers stay display-only', async () => {
    const f = session(), before = JSON.stringify(f.state()); await f.open();
    f.props().onTab('craft'); for (let i = 0; i < 20; i++) f.props().onAdjust('crafting.make-pick', 1);
    expect(f.props().draft.batches['crafting.make-pick']).toBe(2);
    for (let i = 0; i < 20; i++) f.props().onAdjust('crafting.make-pick', -1);
    expect(f.props().draft.batches['crafting.make-pick']).toBe(1);
    f.props().onDirection('crafting.table', 'se'); expect(f.props().draft.directions['crafting.table']).toBe('se');
    expect(JSON.stringify(f.state())).toBe(before); expect(f.raw.executeCommand).not.toHaveBeenCalled();
  });
  it('locks synchronous repeated submits and rejects the later double-click event', async () => {
    const f = session(); await f.open(); const callback = f.props().onHarvest;
    callback(1, { detail: 1 }); callback(1, { detail: 1 }); await Vue.nextTick();
    f.props().onHarvest(1, { detail: 2 }); expect(f.raw.executeCommand).toHaveBeenCalledTimes(1);
  });
  it('places relative to the captured player coordinate only after a direction choice', async () => {
    const f = session(); await f.open(); f.props().onPlace('crafting.table'); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    f.props().onDirection('crafting.table', 'nw'); await f.props().onPlace('crafting.table');
    expect(JSON.parse(f.raw.executeCommand.mock.calls[0]![1] as unknown as string).payload).toMatchObject({ x: 9, y: 10 });
  });
  it('stale callbacks cannot submit after inventory, identity, coordinate or runtime changes', async () => {
    for (const change of ['inventory', 'identity', 'position', 'runtime', 'game'] as const) {
      const f = session(); await f.open(); const old = f.props().onHarvest;
      if (change === 'inventory') f.state().inventoryStamp = 'new';
      if (change === 'identity') f.identity();
      if (change === 'position') f.raw.player.x++;
      if (change === 'runtime') f.raw.extensionRuntime = { ...f.runtime };
      if (change === 'game') f.retireGame();
      await old(1); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    }
  });
  it('opens replay read-only, disables all edits and clears drafts on seek cursor change', async () => {
    const f = session(); await f.open(); f.props().onTab('station'); f.props().onDirection('crafting.table', 'n');
    f.raw.replayRecording = {}; f.ui.refresh(); expect(f.props().replay).toBe(true); expect(f.props().draft).toEqual(emptyCraftingDraft());
    f.props().onTab('craft'); f.props().onAdjust('crafting.make-pick', 1); f.props().onHarvest(1);
    expect(f.props().draft.batches).toEqual({}); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    f.raw.replayCursor = 4; f.ui.refresh(); expect(f.props().draft).toEqual(emptyCraftingDraft());
    f.ui.close(); await f.open(); expect(f.ui.panelOpen.value).toBe(true); expect(f.props().readOnly).toBe(true);
  });
  it('presentationBusy closes drafts without reading live DTO and never invents a historical HUD', async () => {
    const f = session(true); await f.open(); expect(f.ui.hud.value).not.toBeNull();
    const reads = f.runtime.readModuleView.mock.calls.length; f.busy(true); f.ui.refresh();
    expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads); expect(f.ui.panelOpen.value).toBe(false); expect(f.ui.hud.value).toBeNull();
    f.host.readDisplayFrame = () => ({ moduleViews: { crafting: fixture(true) } }) as never; f.ui.refresh();
    expect(f.ui.hud.value!.props.ticket).toEqual(fixture(true).activeTicket);
  });
  it('provides a reserved entry bar when immersive mode or replay hides the shell command strip', async () => {
    const f = session(); expect(f.ui.bar.value).toBeNull();
    (f.host.immersive as Vue.Ref<boolean>).value = true; expect(f.ui.bar.value).not.toBeNull();
    (f.host.immersive as Vue.Ref<boolean>).value = false; f.raw.replayRecording = {}; f.ui.refresh(); expect(f.ui.bar.value).not.toBeNull();
    await f.open(); expect(f.ui.bar.value).toBeNull();
  });
  it('HUD exists only with a valid active ticket; stop is unavailable during a player action bundle', async () => {
    const f = session(); expect(f.ui.hud.value).toBeNull(); f.replace(fixture(true)); f.ui.refresh(); expect(f.ui.hud.value).not.toBeNull();
    await f.open(); expect(f.props().canStop).toBe(true);
    (f.raw.actorActions.bundles as any[]).push({ decisionOwnerId: 20 }); f.ui.refresh(); expect(f.props().canStop).toBe(false);
    f.props().onCancelWork(); expect(f.raw.executeCommand).not.toHaveBeenCalled();
  });
  it('lifecycle closure, blur and scope retirement invalidate callbacks and remove handlers', async () => {
    const browser = new EventTarget(); vi.stubGlobal('window', browser);
    const f = session(); await f.open(); const old = f.props().onHarvest; browser.dispatchEvent(new Event('blur'));
    expect(f.ui.panelOpen.value).toBe(false); old(1); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    await f.open(); f.present(false); f.ui.refresh(); expect(f.ui.panelOpen.value).toBe(false);
    f.scope.stop(); expect(f.unregister).toHaveBeenCalledOnce();
  });
  it('uses the shared keyboard owner and Escape closes without submitting', async () => {
    const f = session(); await f.open(); const preventDefault = vi.fn();
    expect(f.keyboard({ key: 'ArrowRight', preventDefault })).toBe(true); expect(preventDefault).toHaveBeenCalledOnce();
    f.keyboard({ key: 'Escape', preventDefault }); expect(f.ui.panelOpen.value).toBe(false); expect(f.raw.executeCommand).not.toHaveBeenCalled();
  });
  it('no-change rejection is translated and pending foundation confirmation holds the submit lock', async () => {
    const f = session(); f.raw.executeCommand.mockImplementation(() => {}); await f.open(); await f.props().onHarvest(1);
    expect(f.props().error).toBe('ext.crafting.ui.rejected');
    f.raw.executeCommand.mockImplementation(() => { f.raw.pendingCommandConfirmation = { ownerCommandId: 15 }; });
    await f.props().onHarvest(1); expect(f.props().submitting).toBe(true); f.props().onHarvest(1); expect(f.raw.executeCommand).toHaveBeenCalledTimes(2);
    f.raw.pendingCommandConfirmation = null; f.raw.recordedInputEvents.push({ decisions: [false] }); f.ui.refresh();
    expect(f.props().submitting).toBe(false); expect(f.props().error).toBeNull();
  });
  it('cancels an in-flight panel load on close, busy transition or retirement', async () => {
    const f = session(); f.canOpen(false); await f.open(); expect(f.loader).not.toHaveBeenCalled();
    f.canOpen(true); f.ui.commands.value[0]!.invoke(); f.ui.close(); await Vue.nextTick(); expect(f.ui.panelOpen.value).toBe(false);
  });
});

interface Node { type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null; focus(): void }
const node = (type = '', text = ''): Node => ({ type, text, props: {}, children: [], parent: null, focus() {} });
const body = node('body');
const renderer = Vue.createRenderer<Node, Node>({
  createElement: type => node(type), createText: text => node('text', text), createComment: () => node('comment'), querySelector: () => body,
  insert(child, parent, anchor) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child); child.parent = parent; },
  remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
  setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp: (n, key, _old, value) => { n.props[key] = value; },
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
async function panel() {
  i18next.addResourceBundle(i18next.language, 'translation', locale, true, true);
  const model = Vue.ref(fixture(true)), draft = Vue.ref<CraftingDraft>(emptyCraftingDraft()), readOnly = Vue.ref(false), hidden = Vue.ref(false), error = Vue.ref<string | null>(null), action = vi.fn();
  const component = await createSfcHarness({ baseURL: import.meta.url }).load('../ui/CraftingPanel.vue');
  const app = renderer.createApp({ render: () => Vue.h(component, { model: model.value, draft: draft.value, readOnly: readOnly.value, replay: readOnly.value,
    submitting: false, error: error.value, canStop: true, presentationHidden: hidden.value, onHarvest: action, onCraft: action, onPlace: action, onCancelWork: action,
    onTab: (tab: CraftingDraft['tab']) => { draft.value = { ...draft.value, tab }; },
    onAdjust: (id: string, amount: number) => { draft.value = { ...draft.value, batches: { ...draft.value.batches, [id]: (draft.value.batches[id] ?? 1) + amount } }; },
    onDirection: (id: string, direction: 'n') => { draft.value = { ...draft.value, directions: { ...draft.value.directions, [id]: direction } }; } }) });
  app.use(I18NextVue, { i18next }); apps.push(app); app.mount(node('root')); await Vue.nextTick();
  return { model, draft, readOnly, hidden, error, action, tab: async (tab: string) => { all(body).find(n => n.props['data-tab'] === tab)!.props.onClick(); await Vue.nextTick(); } };
}

describe('crafting client SFCs through the shared harness', () => {
  it('renders all four tabs, seven recipes, placement directions and recent work', async () => {
    const f = await panel(); expect(text(body)).toContain('金属矿脉'); expect(all(body).filter(n => n.props['data-tab'])).toHaveLength(4);
    await f.tab('craft'); expect(all(body).filter(n => n.props['data-recipe'])).toHaveLength(7); expect(text(body)).toContain('需 2 / 拥有 20');
    await f.tab('station'); expect(all(body).filter(n => n.props['data-placement'])).toHaveLength(2); expect(all(body).filter(n => n.props['data-direction'])).toHaveLength(16);
    await f.tab('work'); expect(text(body)).toContain('最近记录'); expect(text(body)).toContain('第 2/5 批'); expect(text(body)).toContain('完成：金属矿脉');
  });
  it('renders batch bounds, replay disabled controls, safe error text and actual hidden root', async () => {
    const f = await panel(); await f.tab('craft');
    const recipe = () => all(body).find(n => n.props['data-recipe'] === 'crafting.make-pick')!;
    expect(all(recipe()).find(n => n.props['data-step'] === 'minus')!.props.disabled).toBe(true);
    all(recipe()).find(n => n.props['data-step'] === 'plus')!.props.onClick({ detail: 1 }); await Vue.nextTick();
    expect(all(recipe()).find(n => n.props['data-step'] === 'plus')!.props.disabled).toBe(true);
    f.readOnly.value = true; await Vue.nextTick(); expect(text(body)).toContain('回放中，仅可查看');
    expect(all(body).filter(n => ['craft', 'confirm'].includes(n.props['data-action'])).every(n => n.props.disabled)).toBe(true);
    f.hidden.value = true; await Vue.nextTick(); expect(all(body).find(n => n.props.role === 'dialog')!.props.inert).toBe(true);
    expect(text(body)).not.toContain('C5_');
  });
  it('renders precise module and foundation errors, with a safe fallback for an unknown label', async () => {
    const f = await panel();
    const alert = () => all(body).find(n => n.props.role === 'alert')!;
    f.error.value = 'ext.crafting.error.stale'; await Vue.nextTick();
    expect(text(alert())).toBe('情况已经变化，请重新查看');
    f.error.value = 'ext.foundation.world.error.bad_payload'; await Vue.nextTick();
    expect(text(alert())).toBe('世界请求格式有误。');
    f.error.value = 'ext.injected.value'; await Vue.nextTick();
    expect(text(alert())).toBe('操作未执行，请重新查看');
  });
  it('renders owned container selectors and a reversible narrow-screen drawer toggle', async () => {
    const f = await panel();
    const selector = () => all(body).find(n => n.props['data-container'])!;
    expect(selector().props['data-container']).toBe('destination'); expect(text(body)).toContain('采集存入');
    await f.tab('craft'); expect(selector().props['data-container']).toBe('source'); expect(text(body)).toContain('材料来源');
    const toggle = () => all(body).find(n => n.props['data-action'] === 'toggle-drawer')!;
    expect(toggle().props['aria-expanded']).toBe(true); toggle().props.onClick(); await Vue.nextTick();
    expect(toggle().props['aria-expanded']).toBe(false);
    expect(all(body).some(n => String(n.props.class).includes('is-collapsed'))).toBe(true);
    toggle().props.onClick(); await Vue.nextTick(); expect(toggle().props['aria-expanded']).toBe(true);
  });
  it('renders the fallback entry without adding a HUD and blocks double-click or historical input', async () => {
    i18next.addResourceBundle(i18next.language, 'translation', locale, true, true);
    const component = await createSfcHarness({ baseURL: import.meta.url }).load('../ui/CraftingEntry.vue'), root = node('root');
    const open = vi.fn(), hidden = Vue.ref(false);
    const app = renderer.createApp({ render: () => Vue.h(component, { blocked: false, presentationHidden: hidden.value, onOpen: open }) });
    app.use(I18NextVue, { i18next }); apps.push(app); app.mount(root); await Vue.nextTick();
    const button = () => all(root).find(n => n.type === 'button')!;
    button().props.onClick({ detail: 1 }); button().props.onClick({ detail: 2 }); expect(open).toHaveBeenCalledOnce();
    hidden.value = true; await Vue.nextTick(); expect(button().props.disabled).toBe(true);
    button().props.onClick({ detail: 1 }); expect(open).toHaveBeenCalledOnce();
  });
  it('renders ticket-only HUD from its supplied historical data and honors hiding', async () => {
    i18next.addResourceBundle(i18next.language, 'translation', locale, true, true);
    const component = await createSfcHarness({ baseURL: import.meta.url }).load('../ui/CraftingWorkHud.vue'), root = node('root');
    const app = renderer.createApp(component, { ticket: fixture(true).activeTicket, presentationHidden: true });
    app.use(I18NextVue, { i18next }); apps.push(app); app.mount(root); await Vue.nextTick();
    expect(text(root)).toContain('本批剩余 500 刻'); expect(all(root).some(n => String(n.props.class).includes('presentation-hidden'))).toBe(true);
  });
});
