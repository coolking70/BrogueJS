import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import i18next from 'i18next';
import '../../../../i18n';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import type { ModuleUiHost } from '../../../ui/types';
import type { DisplayFrame } from '../../../../ui/displayProjection';
import locale from '../locales/zh_CN.json';
import { buildFeedCommand, buildHarvestCommand, buildRoastCommand } from '../ui/commands';
import { emptyForagingDraft, foragingCompanionCards, foragingErrorKey, foragingNodeCards, readForagingUiView,
  type ForagingDraft, type ForagingUiView } from '../ui/view';
import { useForagingUi } from '../ui/useForagingUi';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { loadForagingPack } from '../definitions';
import { makeHarness, scene, game, addFood, addAlly, eat, feed, roast, hearth, native, moveNodeBeside, harvest, view as liveView, knowledgeState, logger } from './mechanicsHelpers';

function fixture(): ForagingUiView {
  return { v: 1, available: true, inventoryStamp: 'inventory:1', activeTicket: { ticketId: 7, remainingTicks: 100 },
    nodes: [{ interactableId: 1, remaining: 3, capacity: 3, available: 3, nodeRevision: 0, canHarvest: true, reason: null }],
    foods: [{ itemId: 2, displayName: '星屑菌', quantity: 3, source: 'foraging', knowledge: 'unknown', satiety: null, roastable: true },
      { itemId: 3, displayName: '口粮', quantity: 1, source: 'native', knowledge: null, satiety: 1800, roastable: false },
      { itemId: 4, displayName: '焦炭', quantity: 1, source: 'foraging', knowledge: 'known', satiety: 20, roastable: true }],
    companions: [{ actorId: 5, targetRevision: 3, band: 'hungry', departing: false }, { actorId: 6, targetRevision: 0, band: 'fed', departing: false }],
    heatSources: [{ interactableId: 9, kind: 'bonfire' }, { interactableId: 8, kind: 'hearth-station' }] };
}
function display(): DisplayFrame {
  return { depth: 1, player: { x: 10, y: 10 }, interactables: [{ id: 1, displayName: '星屑菌丛' }],
    rows: [{ kind: 'monster', id: 5, name: '哥布林', loc: { x: 11, y: 11 } }, { kind: 'monster', id: 6, name: '食人魔', loc: { x: 13, y: 10 } }],
    moduleViews: { foraging: fixture() } } as unknown as DisplayFrame;
}
const scopes: Vue.EffectScope[] = [], apps: { unmount(): void }[] = [];
afterEach(() => { apps.splice(0).forEach(app => app.unmount()); scopes.splice(0).forEach(scope => scope.stop()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function session() {
  let state = fixture(), frame = display(), identity: object = {}, manage = true;
  const runtime = { readModuleView: vi.fn(() => ({ session: identity, state, canManageCharacter: manage })) };
  const raw = { extensionRuntime: runtime, replayRecording: null as object | null, replayCursor: 0, isGameOver: false,
    pendingCommandConfirmation: null as { ownerCommandId: number } | null, recordedInputEvents: [] as { decisions?: boolean[] }[],
    executeCommand: vi.fn((_action: string, _data: string) => { state.inventoryStamp += ':next'; }) };
  let game = raw as unknown as ReturnType<ModuleUiHost['game']>, busy = false, present = true, canOpen = true;
  const keyboard = vi.fn(), unregister = vi.fn();
  const host: ModuleUiHost = { game: () => game, tick: Vue.ref(0), immersive: Vue.ref(false), readDisplayFrame: () => frame,
    isPresentationBusy: () => busy, canPresentInteraction: () => present, canOpenPanel: () => canOpen,
    beforeOpenPanel: vi.fn(), afterClosePanel: vi.fn(), cancelHeldKeys: vi.fn(),
    registerKeyHandler: handler => { keyboard.mockImplementation(handler); return unregister; } };
  const scope = Vue.effectScope(); scopes.push(scope);
  const loader = vi.fn(async () => ({ render: () => Vue.h('div') }));
  const ui = scope.run(() => useForagingUi(host, loader))!;
  return { ui, raw, runtime, host, scope, keyboard, unregister, loader, state: () => state, frame: () => frame,
    open: async () => { ui.commands.value[0]!.invoke(); await Vue.nextTick(); await Vue.nextTick(); },
    busy: (value: boolean) => { busy = value; }, present: (value: boolean) => { present = value; }, canOpen: (value: boolean) => { canOpen = value; },
    identity: () => { identity = {}; }, manage: (value: boolean) => { manage = value; },
    replace: (value: ForagingUiView) => { state = value; }, replaceFrame: (value: DisplayFrame) => { frame = value; },
    retire: () => { game = { ...raw } as unknown as typeof game; }, props: () => ui.panel.value!.props as Record<string, any> };
}
function paths(value: unknown, path: (string | number)[] = []): (string | number)[][] {
  return value && typeof value === 'object' ? Object.entries(value).flatMap(([key, entry]) => paths(entry, [...path, Array.isArray(value) ? Number(key) : key])) : [path];
}
describe('foraging strict UI DTO', () => {
  it('returns detached frozen data, rejects unavailable and permits empty lists', () => {
    const source = fixture(), parsed = readForagingUiView(source)!;
    expect(parsed).toEqual(source); expect(parsed).not.toBe(source); expect(Object.isFrozen(parsed.foods[0])).toBe(true);
    source.foods[0]!.displayName = 'changed'; expect(parsed.foods[0]!.displayName).toBe('星屑菌');
    expect(readForagingUiView({ v: 1, available: false })).toBeNull();
    expect(readForagingUiView({ ...fixture(), activeTicket: null, nodes: [], foods: [], companions: [], heatSources: [] })).not.toBeNull();
  });
  it.each(paths(fixture()).map(path => [path.join('.'), path] as const))('fails closed for invalid leaf %s', (_label, path) => {
    const value: any = fixture(); let target = value;
    for (const key of path.slice(0, -1)) target = target[key];
    const key = path[path.length - 1]!; target[key] = typeof target[key] === 'number' ? 'invalid' : 0;
    expect(readForagingUiView(value)).toBeNull();
  });
  it.each([
    (v: any) => { v.extra = true; }, (v: any) => { delete v.foods; }, (v: any) => { v.activeTicket.extra = true; },
    (v: any) => { v.nodes[0].interactableId = 0; }, (v: any) => { v.nodes[0].remaining = 4; }, (v: any) => { v.nodes[0].available = 4; },
    (v: any) => { v.nodes[0].nodeRevision = -1; }, (v: any) => { v.nodes[0].canHarvest = false; }, (v: any) => { v.nodes[0].reason = 'C5_FAKE'; },
    (v: any) => { v.nodes.push(v.nodes[0]); }, (v: any) => { v.foods[0].satiety = 200; }, (v: any) => { v.foods[0].quantity = 21; },
    (v: any) => { v.foods[0].definitionId = 'foraging.mend'; }, (v: any) => { v.foods[0].knowledge = null; },
    (v: any) => { v.foods[1].knowledge = 'known'; }, (v: any) => { v.foods[1].roastable = true; }, (v: any) => { v.foods[2].satiety = null; },
    (v: any) => { v.foods[0].displayName = ''; }, (v: any) => { v.companions[0].targetRevision = NaN; },
    (v: any) => { v.companions.push(v.companions[0]); }, (v: any) => { v.heatSources[0].kind = 'fire'; },
    (v: any) => { v.heatSources.length = 4; }, (v: any) => { v.inventoryStamp = ''; },
  ])('rejects corrupt shape, references, enums, ranges and hidden values %#', mutate => {
    const value = fixture(); mutate(value); expect(readForagingUiView(value)).toBeNull();
  });
  it('never evaluates getters and rejects non-JSON prototypes, symbols and proxy exceptions', () => {
    const source = fixture(), getter = vi.fn(() => 3);
    Object.defineProperty(source.nodes[0], 'remaining', { get: getter, enumerable: true });
    expect(readForagingUiView(source)).toBeNull(); expect(getter).not.toHaveBeenCalled();
    expect(readForagingUiView(Object.assign(Object.create({ leaked: true }), fixture()))).toBeNull();
    expect(readForagingUiView({ ...fixture(), [Symbol('secret')]: 1 })).toBeNull();
    expect(readForagingUiView(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error('trap'); } }))).toBeNull();
  });
  it('uses only display frame node names and companion locations, with safe missing-data behavior', () => {
    const frame = display(); expect(foragingNodeCards(fixture(), frame)[0]!.displayName).toBe('星屑菌丛');
    expect(foragingNodeCards(fixture(), null)).toEqual([]);
    const companions = foragingCompanionCards(fixture(), frame, '同伴');
    expect(companions.map(row => row.adjacent)).toEqual([true, false]);
    expect(foragingCompanionCards(fixture(), null, '同伴')[0]).toMatchObject({ adjacent: false, displayName: '同伴' });
  });
  it('selects finite translated errors without exposing codes or fields', () => {
    expect(foragingErrorKey('C5_DISTANCE', () => true)).toBe('ext.foraging.error.distance');
    expect(foragingErrorKey('C5_ROOM', key => key.startsWith('ext.foundation'))).toBe('ext.foundation.world.error.room');
    expect(foragingErrorKey('C5_ROOM', () => false)).toBe('ext.foraging.ui.rejected');
    expect(foragingErrorKey('C5_FAKE' as never, () => true)).toBe('ext.foraging.ui.rejected');
  });
});
describe('foraging UI command contracts', () => {
  it('builds the exact three versioned payloads from displayed stamps and revisions', () => {
    const data = fixture();
    expect(JSON.parse(buildHarvestCommand(data, 1)!)).toEqual({ module: 'foraging', action: 'harvest', payload: { v: 1, nodeId: 1, nodeRevision: 0, inventoryStamp: 'inventory:1', destinationId: null, destinationRevision: null } });
    expect(JSON.parse(buildFeedCommand(data, 5, 2)!)).toEqual({ module: 'foraging', action: 'feed', payload: { v: 1, targetId: 5, targetRevision: 3, itemId: 2, inventoryStamp: 'inventory:1' } });
    expect(JSON.parse(buildRoastCommand(data, 8, 2)!)).toEqual({ module: 'foraging', action: 'roast', payload: { v: 1, heatSourceId: 8, itemId: 2, inventoryStamp: 'inventory:1' } });
  });
  it('refuses unknown, malformed and unavailable choices without filtering unknown foods', () => {
    const data = fixture(); expect(buildHarvestCommand(data, 99)).toBeNull(); expect(buildFeedCommand(data, 99, 2)).toBeNull();
    expect(buildFeedCommand(data, 5, 99)).toBeNull(); expect(buildRoastCommand(data, 99, 2)).toBeNull(); expect(buildRoastCommand(data, 8, 3)).toBeNull();
    expect(buildRoastCommand(data, 8, 2)).not.toBeNull(); data.companions[0]!.departing = true; expect(buildFeedCommand(data, 5, 2)).toBeNull();
    data.nodes[0]!.reason = 'C5_RESOURCE_EMPTY'; data.nodes[0]!.canHarvest = false; expect(buildHarvestCommand(data, 1)).toBeNull();
  });
});
describe('foraging session lifecycle', () => {
  it('loads the panel lazily once and pairs shell lifecycle callbacks', async () => {
    const f = session(); expect(f.loader).not.toHaveBeenCalled(); expect(f.ui.commands.value[0]).toMatchObject({ id: 'foraging.open', glyph: '菌' });
    await f.open(); expect(f.ui.panelOpen.value).toBe(true); expect(f.host.beforeOpenPanel).toHaveBeenCalledOnce();
    f.ui.close(); f.ui.close(); expect(f.host.afterClosePanel).toHaveBeenCalledOnce(); await f.open(); expect(f.loader).toHaveBeenCalledOnce();
  });
  it('selects the lowest heat source and the sole adjacent eligible companion, keeps selection display-only', async () => {
    const f = session(), before = JSON.stringify(f.state()); await f.open();
    expect(f.props().draft).toMatchObject({ nodeId: 1, heatSourceId: 8, targetId: 5 });
    f.props().onTab('feed'); f.props().onChoose('targetId', 6, { detail: 1 }); expect(f.props().draft.targetId).toBe(5);
    f.props().onChoose('itemId', 2, { detail: 1 }); expect(f.props().draft.itemId).toBe(2);
    expect(JSON.stringify(f.state())).toBe(before); expect(f.raw.executeCommand).not.toHaveBeenCalled();
  });
  it('does not auto-select when multiple adjacent companions are eligible', async () => {
    const f = session(); (f.frame().rows[1]!.loc as { x: number; y: number }).x = 9; await f.open(); expect(f.props().draft.targetId).toBeNull();
    f.props().onChoose('targetId', 6, { detail: 1 }); expect(f.props().draft.targetId).toBe(6);
  });
  it('locks synchronous repeats and ignores double-click events', async () => {
    const f = session(); await f.open(); const submit = f.props().onHarvest;
    submit(1, { detail: 1 }); submit(1, { detail: 1 }); await Vue.nextTick(); f.props().onHarvest(1, { detail: 2 });
    expect(f.raw.executeCommand).toHaveBeenCalledTimes(1);
  });
  it('refuses stale callbacks after inventory, session, frame location, game or runtime changes', async () => {
    for (const change of ['inventory', 'session', 'position', 'game', 'runtime'] as const) {
      const f = session(); await f.open(); const submit = f.props().onHarvest;
      if (change === 'inventory') f.state().inventoryStamp = 'changed';
      if (change === 'session') f.identity();
      if (change === 'position') f.replaceFrame({ ...f.frame(), player: { ...f.frame().player, x: 4 } });
      if (change === 'game') f.retire(); if (change === 'runtime') f.raw.extensionRuntime = { ...f.runtime };
      await submit(1); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    }
  });
  it('invalidates callbacks from a previous opening even when the data is unchanged', async () => {
    const f = session(); await f.open(); const old = f.props().onHarvest;
    f.ui.close(); await f.open(); await old(1); expect(f.raw.executeCommand).not.toHaveBeenCalled();
  });
  it('requires displayed harvest names and adjacent non-departing feeding targets', async () => {
    const f = session(); await f.open(); f.props().onFeed(6, 2); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    f.state().companions[0]!.departing = true; f.ui.refresh(); f.props().onFeed(5, 2); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    f.replaceFrame({ ...f.frame(), interactables: [] }); f.ui.refresh(); expect(f.props().nodes).toEqual([]);
    f.props().onHarvest(1); expect(f.raw.executeCommand).not.toHaveBeenCalled();
  });
  it('is read-only during replay and clears all draft selections after seek', async () => {
    const f = session(); await f.open(); f.props().onTab('feed'); f.props().onChoose('itemId', 2);
    f.raw.replayRecording = {}; f.ui.refresh(); expect(f.props().draft).toEqual(emptyForagingDraft());
    expect(f.props().readOnly).toBe(true); f.props().onFeed(5, 2); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    f.props().onTab('roast'); f.raw.replayCursor = 3; f.ui.refresh(); expect(f.props().draft).toEqual(emptyForagingDraft());
    f.ui.close(); await f.open(); expect(f.props().replay).toBe(true);
  });
  it('busy closes the panel and uses only historical HUD rows without any live DTO read', async () => {
    const f = session(); await f.open(); const count = f.runtime.readModuleView.mock.calls.length;
    f.busy(true); f.ui.refresh(); expect(f.ui.panelOpen.value).toBe(false); expect(f.runtime.readModuleView).toHaveBeenCalledTimes(count);
    expect(f.ui.hud.value!.props.companions).toEqual(foragingCompanionCards(fixture(), display(), '同伴'));
    f.replaceFrame({ ...f.frame(), moduleViews: {} }); f.ui.refresh(); expect(f.ui.hud.value).toBeNull();
  });
  it('only shows HUD for hunger or departure and keeps immersive/replay entry reachable', async () => {
    const f = session(); expect(f.ui.hud.value).not.toBeNull(); f.state().companions[0]!.band = 'fed'; f.ui.refresh(); expect(f.ui.hud.value).toBeNull();
    f.state().companions[0]!.departing = true; f.ui.refresh(); expect(f.ui.hud.value).not.toBeNull();
    expect(f.ui.bar.value).toBeNull(); (f.host.immersive as Vue.Ref<boolean>).value = true; expect(f.ui.bar.value).not.toBeNull();
    await f.open(); expect(f.ui.bar.value).toBeNull();
  });
  it('handles blur, shell lifecycle suppression, invalid DTO, reset and retirement safely', async () => {
    const browser = new EventTarget(); vi.stubGlobal('window', browser); const f = session(); await f.open(); const old = f.props().onHarvest;
    browser.dispatchEvent(new Event('blur')); expect(f.ui.panelOpen.value).toBe(false); old(1); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    await f.open(); f.present(false); f.ui.refresh(); expect(f.ui.panelOpen.value).toBe(false);
    f.present(true); await f.open(); f.replace({ v: 1, available: false } as never); f.ui.refresh(); expect(f.ui.commands.value[0]!.disabled).toBe(true);
    f.scope.stop(); expect(f.unregister).toHaveBeenCalledOnce();
  });
  it('uses the shared keyboard owner and cancels in-flight panel open requests', async () => {
    const f = session(); f.canOpen(false); await f.open(); expect(f.loader).not.toHaveBeenCalled();
    f.canOpen(true); f.ui.commands.value[0]!.invoke(); f.ui.close(); await Vue.nextTick(); expect(f.ui.panelOpen.value).toBe(false);
    await f.open(); const preventDefault = vi.fn(); f.keyboard({ key: 'ArrowRight', preventDefault }); expect(preventDefault).toHaveBeenCalledOnce();
    f.keyboard({ key: 'Escape', preventDefault }); expect(f.ui.panelOpen.value).toBe(false); expect(f.raw.executeCommand).not.toHaveBeenCalled();
  });
  it('keeps pending confirmation locked, treats No as intentional and uses generic rejected fallback', async () => {
    const f = session(); f.raw.executeCommand.mockImplementation(() => {}); await f.open(); await f.props().onHarvest(1);
    expect(f.props().error).toBe('ext.foraging.ui.rejected');
    f.raw.executeCommand.mockImplementation(() => { f.raw.pendingCommandConfirmation = { ownerCommandId: 4 }; });
    await f.props().onFeed(5, 2); expect(f.props().submitting).toBe(true); f.props().onFeed(5, 2); expect(f.raw.executeCommand).toHaveBeenCalledTimes(2);
    f.raw.recordedInputEvents.push({ decisions: [false] }); f.raw.pendingCommandConfirmation = null; f.ui.refresh();
    expect(f.props().submitting).toBe(false); expect(f.props().error).toBeNull();
    f.raw.executeCommand.mockImplementation(() => { f.raw.recordedInputEvents.push({ decisions: [false] }); });
    await f.props().onFeed(5, 2); expect(f.props().error).toBeNull();
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
  const model = Vue.ref(fixture()), frame = Vue.ref(display()), draft = Vue.ref<ForagingDraft>({ ...emptyForagingDraft(), nodeId: 1, heatSourceId: 8, targetId: 5 }),
    readOnly = Vue.ref(false), hidden = Vue.ref(false), error = Vue.ref<string | null>(null), action = vi.fn();
  const component = await createSfcHarness({ baseURL: import.meta.url }).load('../ui/ForagingPanel.vue');
  const app = renderer.createApp({ render: () => Vue.h(component, { model: model.value, nodes: foragingNodeCards(model.value, frame.value),
    companions: foragingCompanionCards(model.value, frame.value, '同伴'), draft: draft.value, readOnly: readOnly.value, replay: readOnly.value,
    submitting: false, error: error.value, presentationHidden: hidden.value, onHarvest: action, onRoast: action, onFeed: action,
    onTab: (tab: ForagingDraft['tab']) => { draft.value = { ...draft.value, tab }; },
    onChoose: (kind: keyof Omit<ForagingDraft, 'tab'>, id: number) => { draft.value = { ...draft.value, [kind]: id }; } }) });
  apps.push(app); app.mount(node('root')); await Vue.nextTick();
  return { model, frame, draft, readOnly, hidden, error, action,
    tab: async (tab: string) => { all(body).find(n => n.props['data-tab'] === tab)!.props.onClick(); await Vue.nextTick(); } };
}
describe('foraging SFCs with shared harness', () => {
  it('renders all three tabs, public node names, all roastable foods and precise native satiety only', async () => {
    const f = await panel(); expect(all(body).filter(n => n.props['data-tab'])).toHaveLength(3); expect(text(body)).toContain('星屑菌丛');
    await f.tab('roast'); expect(all(body).filter(n => n.props['data-food'])).toHaveLength(2);
    expect(all(body).filter(n => n.props['data-heat']).map(n => n.props['data-heat'])).toEqual([8, 9]);
    await f.tab('feed'); expect(text(body)).toContain('哥布林'); expect(text(body)).toContain('需要站在它旁边');
    expect(text(body)).toContain('少量'); expect(text(body)).toContain('饱腹 1800'); expect(text(body)).toContain('饱腹 20');
    expect(text(body)).not.toContain('foraging.'); expect(text(body)).not.toContain('蚀骨菌');
  });
  it('omits nameless nodes, handles empty lists and shows no-heat without hiding unknown foods', async () => {
    const f = await panel(); f.frame.value = { ...f.frame.value, interactables: [] }; await Vue.nextTick();
    expect(all(body).filter(n => n.props['data-node'])).toHaveLength(0); expect(text(body)).toContain('附近没有可采集的菌丛');
    f.model.value.heatSources = []; await f.tab('roast'); expect(text(body)).toContain('附近没有可以烤东西的篝火或火炉');
    expect(all(body).filter(n => n.props['data-food'])).toHaveLength(2); expect(all(body).find(n => n.props['data-action'] === 'confirm')!.props.disabled).toBe(true);
  });
  it('shows departure, disables ineligible companions and submits only explicit usable food choices', async () => {
    const f = await panel(); await f.tab('feed');
    const confirm = () => all(body).find(n => n.props['data-action'] === 'confirm')!;
    expect(confirm().props.disabled).toBe(true);
    all(all(body).find(n => n.props['data-food'] === 2)!).find(n => n.type === 'button')!.props.onClick({ detail: 1 }); await Vue.nextTick();
    expect(confirm().props.disabled).toBe(false); confirm().props.onClick({ detail: 1 }); confirm().props.onClick({ detail: 2 }); expect(f.action).toHaveBeenCalledOnce();
    f.model.value.companions[0]!.departing = true; await Vue.nextTick(); expect(text(body)).toContain('即将离开'); expect(confirm().props.disabled).toBe(true);
  });
  it('replay and historical hiding disable mutations and render a safe actual root', async () => {
    const f = await panel(); f.readOnly.value = true; await Vue.nextTick();
    expect(text(body)).toContain('回放中，仅可查看'); expect(all(body).find(n => n.props['data-action'] === 'confirm')!.props.disabled).toBe(true);
    all(body).find(n => n.props['data-action'] === 'confirm')!.props.onClick({ detail: 1 }); expect(f.action).not.toHaveBeenCalled();
    f.hidden.value = true; await Vue.nextTick(); expect(all(body).find(n => n.props.role === 'dialog')!.props.inert).toBe(true);
  });
  it('translates errors through finite labels without rendering arbitrary raw keys', async () => {
    const f = await panel(); const alert = () => all(body).find(n => n.props.role === 'alert')!;
    f.error.value = 'ext.foraging.error.stale'; await Vue.nextTick(); expect(text(alert())).toBe('情况已经变化，请重新查看');
    f.error.value = 'ext.foundation.world.error.bad_payload'; await Vue.nextTick(); expect(text(alert())).toBe('世界请求格式有误。');
    f.error.value = 'ext.foraging.secret.kind'; await Vue.nextTick(); expect(text(alert())).toBe('操作未执行，请重新查看');
  });
  it('renders the supplied companion HUD and immersive entry, with touch-sized click semantics and hidden suppression', async () => {
    i18next.addResourceBundle(i18next.language, 'translation', locale, true, true);
    const harness = createSfcHarness({ baseURL: import.meta.url }), hud = await harness.load('../ui/ForagingCompanionHud.vue'), entry = await harness.load('../ui/ForagingEntry.vue');
    const root = node('root'), open = vi.fn(), hidden = Vue.ref(false);
    const app = renderer.createApp({ render: () => Vue.h('div', [Vue.h(hud, { companions: foragingCompanionCards(fixture(), display(), '同伴'), presentationHidden: hidden.value }),
      Vue.h(entry, { blocked: false, presentationHidden: hidden.value, onOpen: open })]) });
    apps.push(app); app.mount(root); await Vue.nextTick(); expect(text(root)).toContain('哥布林'); expect(text(root)).toContain('饥饿');
    const button = () => all(root).find(n => n.type === 'button')!;
    button().props.onClick({ detail: 1 }); button().props.onClick({ detail: 2 }); expect(open).toHaveBeenCalledOnce();
    hidden.value = true; await Vue.nextTick(); expect(button().props.disabled).toBe(true); button().props.onClick({ detail: 1 }); expect(open).toHaveBeenCalledOnce();
  });
});


describe('foraging live Game SFC privacy after real commands', () => {
  it.each(['eat', 'throw', 'drop', 'equip', 'call', 'harvest', 'roast', 'feed', 'explosion', 'save-load'] as const)(
    '%s renders only observed names and suppresses unknown nutrition in every tab', async action => {
      const h = makeHarness(51020001, ['foraging', ...(action === 'roast' || action === 'explosion' ? ['fgheat'] : [])]);
      scene(h);
      const food = addFood(h, action === 'explosion' ? 'blast' : 'mend', 2);
      if (action === 'eat') eat(h, food);
      if (action === 'throw') { native(h, 'item:execute', `throw|${food.inventoryLetter}`); h.command('mouse_travel', { x: 13, y: 10 }); }
      if (action === 'drop') native(h, 'item:execute', `drop|${food.inventoryLetter}`);
      if (action === 'equip') native(h, 'item:execute', `equip|${food.inventoryLetter}`);
      if (action === 'call') native(h, 'item:execute', `call|${food.inventoryLetter}|月下回声`);
      if (action === 'harvest') expect(harvest(h, moveNodeBeside(h)).error).toBeNull();
      if (action === 'roast' || action === 'explosion') { hearth(h); expect(roast(h, food).error).toBeNull(); }
      if (action === 'feed') expect(feed(h, addAlly(h), food, [true]).error).toBeNull();
      if (action === 'save-load') { native(h, 'item:execute', `call|${food.inventoryLetter}|远钟`); h.load(h.save()); }
      const current = game(h), model = readForagingUiView(liveView(h));
      expect(model).not.toBeNull();
      const frame = observeDisplayFrame(current, logger), draft = Vue.ref<ForagingDraft>(emptyForagingDraft());
      const component = await createSfcHarness({ baseURL: import.meta.url }).load('../ui/ForagingPanel.vue');
      const app = renderer.createApp({ render: () => Vue.h(component, { model: model!, nodes: foragingNodeCards(model!, frame),
        companions: foragingCompanionCards(model!, frame, '同伴'), draft: draft.value, readOnly: false, replay: false, submitting: false, error: null }) });
      apps.push(app); app.mount(node('root'));
      for (const tab of ['harvest', 'roast', 'feed'] as const) {
        draft.value = { ...emptyForagingDraft(), tab }; await Vue.nextTick();
        const rendered = text(body);
        expect(rendered).not.toContain('ext.foraging.'); expect(rendered).not.toContain('foraging.');
        for (const kind of loadForagingPack().kinds) if (knowledgeState(current, `foraging.${kind.id}`) !== 'known')
          expect(rendered).not.toContain((locale as Record<string, string>)[`ext.foraging.kind.${kind.id}.name`]);
        if (tab === 'feed') for (const food of model!.foods) if (food.source === 'foraging' && food.knowledge !== 'known') {
          const card = all(body).find(n => n.props['data-food'] === food.itemId);
          expect(card).toBeDefined(); expect(text(card!)).toContain('少量'); expect(text(card!)).not.toContain('饱腹');
          expect(food.satiety).toBeNull();
        }
      }
    });
});
