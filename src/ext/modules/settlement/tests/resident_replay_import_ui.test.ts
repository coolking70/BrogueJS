import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { Game, type GameRecording } from '../../../../engine/Core/Game';
import { Logger, logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { displaySettings } from '../../../../engine/Settings';
import { residentScene } from './residentHelpers';

// Ordinary TS async imports use Vitest's SSR transform. Substitute only the
// transform with the same production SFC compiled for this client renderer.
let Entry: Vue.Component, Panel: Vue.Component, Residents: Vue.Component;
vi.mock('../ui/SettlementEntry.vue', () => ({ default: Entry, __esModule: true }));
vi.mock('../ui/SettlementPanel.vue', () => ({ default: Panel, __esModule: true }));

// I33: actual App/session regression adapted to P5 foundation11; visuals
// are isolated, engine actions and a freshly captured settlement file are real.
import route from './resident-captive-route.json';
import naturalRoute from './resident-natural-route.json';
import { useSettlementUi } from '../ui/useSettlementUi';
import type { SettlementView } from '../ui/view';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';
const saved = (game: Game) => ({ ...game.toSaveSnapshot(), savedAt: 0 });

interface HostNode {
  type: string;
  text: string;
  props: Record<string, any>;
  children: HostNode[];
  parent: HostNode | null;
  contains(target: unknown): boolean;
  closest(selector: string): HostNode | null;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  querySelector<T>(selector: string): T | null;
  querySelectorAll<T>(selector: string): T[];
  focus(): void;
  listeners: Record<string, Array<(event: any) => void>>;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(): void;
  readonly options: HostNode[];
  readonly tagName: string;
  value?: unknown;
  readonly isConnected: boolean;
}
let documentStub: {
  activeElement: HostNode | null;
  hidden: boolean;
  documentElement: { style: { setProperty(): void } };
  querySelector(): null;
  addEventListener(): void;
  removeEventListener(): void;
};
const all = (root: HostNode): HostNode[] => [root, ...root.children.flatMap(all)];
const node = (type: string, text = ''): HostNode =>
  Vue.markRaw({
    type,
    text,
    props: {} as Record<string, any>,
    children: [],
    parent: null,
    contains(target) {
      return all(this).includes(target as HostNode);
    },
    closest(selector) {
      if (selector === '[data-dialog-action]' && this.props['data-dialog-action']) return this;
      return this.parent?.closest(selector) ?? null;
    },
    hasAttribute(name) {
      return this.props[name] !== undefined && this.props[name] !== false;
    },
    getAttribute(name) {
      return this.props[name] ?? null;
    },
    querySelector<T>(selector: string) {
      const action = selector.match(/data-dialog-action="([^"]+)"/)?.[1];
      return (all(this).find((n) => n.props['data-dialog-action'] === action) ?? null) as T | null;
    },
    querySelectorAll<T>(selector: string) {
      return all(this).filter((n) =>
        selector === 'button, [tabindex="0"]'
          ? n.type === 'button' || n.props.tabindex === '0'
          : n.type === selector
      ) as T[];
    },
    listeners: {} as Record<string, Array<(event: any) => void>>,
    addEventListener(type, listener) { (this.listeners[type] ??= []).push(listener); },
    removeEventListener() {},
    get options() { return all(this).filter(n => n.type === 'option'); },
    get tagName() { return this.type.toUpperCase(); },
    focus() {
      documentStub.activeElement = this;
    },
    get isConnected() {
      return !!this.parent;
    }
  });
let body: HostNode, app: ReturnType<typeof renderer.createApp> | undefined;
const renderer = Vue.createRenderer<HostNode, HostNode>({
  createElement: (type) => node(type),
  createText: (text) => node('#text', text),
  createComment: (text) => node('#comment', text),
  insert(child, parent, anchor) {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
    child.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
  },
  remove(child) {
    child.parent?.children.splice(child.parent.children.indexOf(child), 1);
    child.parent = null;
  },
  setText: (n, text) => {
    n.text = text;
  },
  setElementText: (n, text) => {
    n.text = text;
    n.children = [];
  },
  parentNode: (n) => n.parent,
  nextSibling: (n) => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp: (n, key, _old, value) => {
    n.props[key] = value;
    if (key === 'value') n.value = value;
  },
  querySelector: () => body
});
const gameModule = { activeGame: {} as Game };
let menu: Record<string, any>, hud: Record<string, any>, App: Vue.Component;
beforeAll(async () => {
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), {
      innerWidth: 1440,
      innerHeight: 900,
      setInterval: (...args: Parameters<typeof setInterval>) => globalThis.setInterval(...args),
      clearInterval: (...args: Parameters<typeof clearInterval>) => globalThis.clearInterval(...args)
    })
  );
  documentStub = {
    activeElement: null,
    hidden: false,
    documentElement: { style: { setProperty() {} } },
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {}
  };
  vi.stubGlobal('document', documentStub);
  await import('../../../../i18n');
  const empty = Vue.defineComponent({ render: () => null });
  // Isolate Pixi/visual siblings. Menu/HUD forward their public component events;
  // App, its module sessions, DialogHost, Inventory and the engine are genuine.
  const Menu = Vue.defineComponent({
    inheritAttrs: false,
    setup(_, { attrs }) {
      return () => {
        menu = attrs;
        return Vue.h('div');
      };
    }
  });
  const Hud = Vue.defineComponent({
    inheritAttrs: false,
    setup(_, { attrs }) {
      return () => {
        hud = attrs;
        return Vue.h('div');
      };
    }
  });
  const harness = createSfcHarness({
    baseURL: import.meta.url,
    stubs: { '../../../../engine/Core/Game': gameModule }
  });
  Entry = await harness.load('../ui/SettlementEntry.vue');
  Panel = await harness.load('../ui/SettlementPanel.vue');
  Residents = await harness.load('../ui/ResidentsPanel.vue');
  const Bar = await harness.load('../../../../components/CommandBar.vue');
  const Host = await harness.load('../../../../components/DialogHost.vue'),
    Inventory = await harness.load('../../../../components/InventoryOverlay.vue');
  App = await createSfcHarness({
    baseURL: import.meta.url,
    stubs: { '../../../../engine/Core/Game': gameModule },
    stubComponents: empty,
    components: {
      '../../../../components/CommandBar.vue': Bar,
      '../../../../components/DialogHost.vue': Host,
      '../../../../components/InventoryOverlay.vue': Inventory,
      '../../../../components/MainMenu.vue': Menu,
      '../../../../components/theme/ThemeHud.vue': Hud
    }
  }).load('../../../../App.vue');
});
beforeEach(() => {
  vi.useFakeTimers();
  logger.reset();
  displaySettings.immersiveMode = false;
  body = node('body');
  documentStub.activeElement = null;
});
afterEach(() => {
  app?.unmount();
  app = undefined;
  displaySettings.immersiveMode = false;
  logger.presentAcknowledgments(null);
  logger.observeMessages(null);
  vi.useRealTimers();
  vi.restoreAllMocks();
});
afterAll(async () => {
  (await import('../../../../ui/dialogInput')).dialogInput.dispose();
  vi.unstubAllGlobals();
});

describe('public replay import with mounted App', () => {
  it('accepts a newly captured foundation11 settlement file, settles reactive rendering and preserves seek/load/continuation', async () => {
    const game = new Game({ seed: 3 });
    gameModule.activeGame = game;
    const root = node('root');
    body.children.push(root);
    root.parent = body;
    app = renderer.createApp(App).use(I18NextVue, { i18next });
    app.mount(root);
    await Vue.nextTick();
    menu.onNewGame({ seed: '3', mode: 'normal', ruleSet: 'extended', extensions: ['settlement'] });
    await Vue.nextTick();
    let count = 0;
    for (const step of route.steps) {
      for (let n = 0; n < step.count && count < 20; n++, count++) {
        let cursor = 0;
        const previous = game.onCommandConfirmRequest;
        try {
          game.onCommandConfirmRequest = null;
          game.onConfirmRequest = () => step.decisions[cursor++] ?? true;
          game.executeCommand(step.action, step.data === null ? undefined : step.data);
        } finally {
          game.onCommandConfirmRequest = previous;
        }
      }
      if (count === 20) break;
    }
    const recording: GameRecording = game.exportRecording(),
      raw = JSON.stringify(recording);
    expect(recording.events).toHaveLength(20);
    expect(game.exportRecording().events).toEqual(recording.events);
    hud.onMenu();
    await Vue.nextTick();
    await menu.onImportReplayJson(new File([raw], 'recording.json', { type: 'application/json' }));
    await Vue.nextTick();
    expect(game.replayRecording).toBeTruthy();
    expect(game.replayCursor).toBe(0);
    expect(game.replayEvents).toEqual(recording.events);
    expect(game.replayError).toBeNull();
    const baseline = saved(game),
      random = rng.getState(),
      nextId = getNextEntityId(),
      archive = logger.peekState();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(100);
      await Vue.nextTick();
    }
    expect(saved(game)).toEqual(baseline);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(nextId);
    expect(logger.peekState()).toEqual(archive);
    game.replaySeek(20);
    expect(game.replayCursor).toBe(20);
    expect(game.replayError).toBeNull();
    expect(rng.getState()).toEqual(recording.events[19]!.rng);
    const end = saved(game),
      endRng = rng.getState();
    game.replaySeek(0);
    expect(game.replayCursor).toBe(0);
    game.replaySeek(20);
    expect(game.replayError).toBeNull();
    expect(saved(game)).toEqual(end);
    expect(rng.getState()).toEqual(endRng);
    expect(game.loadSnapshot(end)).toBe(true);
    expect(game.replayRecording).toBeNull();
    expect(game.hasCompleteRecording).toBe(true);
    vi.advanceTimersByTime(100);
    await Vue.nextTick();
    expect(rng.getState()).toEqual(endRng);
    game.executeCommand('escape');
    const continued = game.exportRecording(),
      continuedSave = saved(game),
      continuedRng = rng.getState();
    expect(continued.events).toHaveLength(21);
    expect(game.loadReplay(continued)).toBe(true);
    game.replaySeek(21);
    // Export's public header may carry a fresh recordedAt. The loaded
    // origin must use that exact header; all world/prefix fields stay equal.
    const expected = structuredClone(continuedSave);
    expected.run.recordingOrigin!.header.recordedAt = continued.recordedAt;
    expect(game.replayCursor).toBe(21);
    expect(game.replayError).toBeNull();
    expect(saved(game)).toEqual(expected);
    expect(rng.getState()).toEqual(continuedRng);
    vi.advanceTimersByTime(100);
    await Vue.nextTick();
  });
});

// Freshly capture only the first 20 native inputs; this is an App composition
// regression, not a full natural or browser captive route claim.
it.each([false, true])('mounted replay has an actionable read-only camp entry (immersive=%s)', async immersive => {
  const game = new Game({ seed: 3 });
  gameModule.activeGame = game;
  displaySettings.immersiveMode = immersive;
  const root = node('root');
  body.children.push(root);
  root.parent = body;
  app = renderer.createApp(App).use(I18NextVue, { i18next });
  app.mount(root);
  await Vue.nextTick();
  menu.onNewGame({ seed: '3', mode: 'normal', ruleSet: 'extended', extensions: ['settlement'] });
  await Vue.nextTick();
  let count = 0;
  for (const step of route.steps) {
    for (let n = 0; n < step.count && count < 20; n++, count++)
      game.executeCommand(step.action, step.data === null ? undefined : step.data);
    if (count === 20) break;
  }
  const liveSave = saved(game), recording = game.exportRecording();
  expect(recording.events).toHaveLength(20);
  const poll = async () => {
    vi.advanceTimersByTime(100);
    await vi.dynamicImportSettled();
    await Vue.nextTick();
  };
  await poll();
  hud.onMenu();
  await Vue.nextTick();
  await menu.onImportReplayJson(new File([JSON.stringify(recording)], 'short-settlement.json', { type: 'application/json' }));
  await poll();
  const entry = () => all(body).find(n => n.type === 'button' && n.props.class === 'settlement-entry');
  const panels = () => all(body).filter(n => n.type === 'section' && String(n.props.class).includes('settlement-panel'));
  const commandBar = () => all(body).some(n => n.props['data-action'] === 'toggle_inventory');
  const text = (n: HostNode): string => n.text + n.children.map(text).join('');
  const click = (n: HostNode | undefined) => {
    expect(n).toBeDefined();
    expect(n!.props.disabled).not.toBe(true);
    n!.props.onClick();
  };
  expect(game.replayRecording).toBeTruthy();
  expect(commandBar()).toBe(false); // The actual App hides gameplay CommandBar.
  expect(entry()).toBeDefined(); // Old production fails here in ordinary mode.
  const staleEntry = entry()!;
  click(staleEntry);
  await poll();
  expect(panels()).toHaveLength(1);
  expect(entry()).toBeUndefined();
  const panel = panels()[0]!;
  expect(text(panel)).toContain(i18next.t('ext.settlement.ui.replay_readonly'));
  const main = all(panel).find(n => n.type === 'main')!;
  const before = saved(game), random = rng.getState(), nextId = getNextEntityId(), archive = logger.peekState();
  // Initial camp-target/establish controls and their callbacks remain inert.
  const campWrites = all(main).filter(n => n.type === 'button');
  expect(campWrites.length).toBeGreaterThan(0);
  expect(campWrites.every(n => n.props.disabled === true)).toBe(true);
  campWrites.forEach(n => n.props.onClick?.());
  const nav = all(panel).find(n => n.type === 'nav')!;
  click(nav.children.find(n => text(n) === i18next.t('ext.settlement.resident.title')));
  await poll();
  expect(all(panel).some(n => n.props['data-residents'] !== undefined)).toBe(true);
  // Try the actually mounted camp/build write-control handlers.
  // Browser-disabled inputs must remain inert even if their closures are called.
  for (const tab of ['build']) {
    click(nav.children.find(n => text(n) === i18next.t('ext.settlement.ui.tab.' + tab)));
    await poll();
    const writes = all(main).filter(n => n.type === 'button' && n.props.disabled === true);
    expect(writes.length).toBeGreaterThan(0);
    writes.forEach(n => n.props.onClick?.());
  }
  click(nav.children.find(n => text(n) === i18next.t('ext.settlement.ui.tab.harvest')));
  await poll();
  // This short prefix has no visible resource nodes; do not claim harvest coverage.
  expect(all(main).filter(n => n.type === 'button')).toHaveLength(0);
  // Even a raw public command bypassing disabled DOM is rejected by Game.
  game.executeCommand('wait');
  game.executeCommand('ext:command', { module: 'settlement', action: 'dismiss-resident', payload: { v: 1, targetId: 1 } });
  expect(saved(game)).toEqual(before);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(nextId);
  expect(logger.peekState()).toEqual(archive);
  const close = all(panel).find(n => n.type === 'footer')!.children.find(n => n.type === 'button')!;
  click(close);
  await poll();
  expect(panels()).toHaveLength(0);
  click(entry());
  await poll();
  expect(panels()).toHaveLength(1);
  game.replaySeek(20);
  await poll();
  expect(panels()).toHaveLength(0);
  staleEntry.props.onClick(); // Retired callback cannot open the new session.
  close.props.onClick();
  await poll();
  expect(panels()).toHaveLength(0);
  click(entry());
  await poll();
  expect(panels()).toHaveLength(1);
  expect(text(panels()[0]!)).toContain(i18next.t('ext.settlement.ui.replay_readonly'));
  game.replaySeek(0);
  await poll();
  expect(panels()).toHaveLength(0);
  click(entry());
  await poll();
  expect(panels()).toHaveLength(1);
  expect(game.loadSnapshot(liveSave)).toBe(true);
  await poll();
  expect(game.replayRecording).toBeNull();
  expect(panels()).toHaveLength(0);
  expect(commandBar()).toBe(true);
  expect(!!entry()).toBe(immersive);
  // Return to live UI follows the existing mode's public camp command.
  click(immersive ? entry() : all(body).find(n => n.props['data-action'] === 'settlement.open'));
  await poll();
  expect(panels()).toHaveLength(1);
  expect(text(panels()[0]!)).not.toContain(i18next.t('ext.settlement.ui.replay_readonly'));
});

// Independently cover populated resident controls with a real resident view.
// This is component rendering of a controlled fixture, not replay reconstruction.
it('read-only resident roster permits selection and disables every resident/granary write', async () => {
  const { g, a } = residentScene();
  const model = g.extensionRuntime!.readModuleView('settlement')!.state;
  const command = vi.fn();
  const root = node('root');
  body.children.push(root);
  root.parent = body;
  app = renderer.createApp({ render: () => Vue.h(Residents, { model, blocked: true, onCommand: command }) }).use(I18NextVue, { i18next });
  app.mount(root);
  await Vue.nextTick();
  const select = all(root).find(n => n.props['data-select-resident'] === a.id)!;
  expect(select.props.disabled).not.toBe(true);
  select.props.onClick();
  await Vue.nextTick();
  expect(all(root).find(n => n.type === 'fieldset')!.props.disabled).toBe(true);
  const resident = all(root).find(n => n.props['data-resident'] === a.id)!;
  expect(resident).toBeDefined();
  const writes = all(resident).filter(n => n.type === 'button');
  expect(writes).toHaveLength(8);
  expect(writes.every(n => n.props.disabled === true)).toBe(true);
  const granaries = all(root).filter(n => n.props['data-granary'] !== undefined);
  expect(granaries.length).toBeGreaterThan(0);
  expect(granaries.every(n => n.props.disabled === true)).toBe(true);
  expect(command).not.toHaveBeenCalled();
});

describe('replay ACK observation is quiet after retirement', () => {
  it('does not notify or alter archives/RNG/IDs on repeated empty disabled reads', () => {
    const log = new Logger(),
      changed = vi.fn();
    log.presentAcknowledgments(() => false, changed);
    const archive = log.peekState(),
      random = rng.getState(),
      nextId = getNextEntityId();
    for (let i = 0; i < 50; i++) {
      expect(log.pendingAcknowledgment).toBeUndefined();
      expect(log.pendingAcknowledgments).toEqual([]);
    }
    expect(changed).not.toHaveBeenCalled();
    expect(log.peekState()).toEqual(archive);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(nextId);
  });
  it('retires stale pending/unread/terminal display once while preserving mechanical archives', () => {
    const log = new Logger(),
      changed = vi.fn();
    let enabled = true;
    log.presentAcknowledgments(() => enabled, changed);
    log.log('old live warning', '#fff', { acknowledge: true });
    expect(log.pendingAcknowledgment).toBeDefined();
    log.showTerminalAcknowledgments();
    expect(log.unreadAcknowledgments).toHaveLength(1);
    const archive = log.peekState();
    changed.mockClear();
    enabled = false;
    expect(log.pendingAcknowledgment).toBeUndefined();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(log.unreadAcknowledgments).toEqual([]);
    for (let i = 0; i < 50; i++) {
      expect(log.pendingAcknowledgment).toBeUndefined();
      expect(log.pendingAcknowledgments).toEqual([]);
    }
    expect(changed).toHaveBeenCalledTimes(1);
    expect(log.peekState()).toEqual(archive);
  });
});

it('normal seed28 source398: trusted home metadata offers hidden box30/plot31 and actual SFC submits source399', async () => {
  vi.restoreAllMocks();
  const started = performance.now();
  const game = new Game({ seed: 1 });
  game.animationEnabled = false;
  game.startNewGame({ seed: naturalRoute.seed, mode: 'normal', ruleSet: 'extended', extensions: ['settlement'] });
  let count = 0;
  for (const step of naturalRoute.steps) {
    for (let n = 0; n < step.count && count < 398; n++, count++) {
      const decisions = [...step.decisions];
      game.onConfirmRequest = () => decisions.shift() ?? true;
      game.executeCommand(step.action, step.data);
      while (game.pendingCommandConfirmation)
        game.resolveCommandDecision(game.pendingCommandConfirmation.token, decisions.shift() ?? true);
      expect(decisions).toHaveLength(0);
    }
    if (count === 398) break;
  }
  expect(performance.now() - started).toBeLessThan(15000);
  expect(game.recordedInputEvents).toHaveLength(398);
  expect(game.player.loc).toEqual({ x: 29, y: 22 });
  expect(game.grid.getCell(24, 20)!.isVisible).toBe(false);
  expect(game.grid.getCell(23, 20)!.isVisible).toBe(false);
  const before = saved(game), random = rng.getState(), id = getNextEntityId();
  const read = () => game.extensionRuntime!.readModuleView('settlement')!.state as unknown as SettlementView;
  const model = read();
  expect(model.boxes.map(b => b.id)).toEqual([21]);
  expect(model.components.some(c => c.id === 31)).toBe(false);
  const home = model.jobTargets!.find(t => t.campId === 45)!;
  expect(home.boxes.map(b => b.id)).toEqual([21, 30]);
  expect(home.plots.map(p => p.id)).toEqual([31]);
  expect(Object.keys(home.boxes.find(b => b.id === 30)!)).toEqual(['id', 'at', 'revision']);
  const sessionScope = Vue.effectScope();
  const session = sessionScope.run(() => useSettlementUi({ game: () => game, tick: Vue.ref(0), immersive: Vue.ref(false), canOpenPanel: () => true, beforeOpenPanel() {}, afterClosePanel() {} }))!;
  try {
    session.commands.value[0]!.invoke();
    const props = () => session.panel.value!.props as any;
    props().onTab('residents');
    const root = node('root'); root.parent = body; body.children.push(root);
    const displayed = Vue.shallowRef<SettlementView | null>(null);
    app = renderer.createApp({ render: () => session.panel.value ? Vue.h(Residents, {
      model: displayed.value ?? props().model, blocked: props().blocked || displayed.value?.available === false, onCommand: props().onResident
    }) : null }).use(I18NextVue, { i18next });
    app.mount(root); await Vue.nextTick();
    all(root).find(n => n.props['data-select-resident'] === 24)!.props.onClick(); await Vue.nextTick();
    const selects = () => all(root).filter(n => n.type === 'select');
    expect(selects()[1]!.options.map(n => n.value)).toContain(30);
    const plot = all(root).find(n => n.type === 'input' && n.props.type === 'checkbox' && n.value === 31)!;
    expect(plot).toBeDefined();
    const select = (n: HostNode, value: number) => {
      for (const option of n.options) (option as any).selected = option.value === value;
      for (const listener of n.listeners.change ?? []) listener({ target: n });
    };
    select(selects()[0]!, 21); select(selects()[1]!, 30);
    (plot as any).checked = true;
    for (const listener of plot.listeners.change ?? []) listener({ target: plot });
    await Vue.nextTick();
    expect(saved(game)).toEqual(before); expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(id);
    const plant = all(root).find(n => n.type === 'button' && n.text === i18next.t('ext.settlement.resident.job.plant'))!;
    expect(plant).toBeDefined(); plant.props.onClick(); await Vue.nextTick();
    expect(game.recordedInputEvents).toHaveLength(399);
    const last = game.recordedInputEvents[game.recordedInputEvents.length - 1]!;
    expect(last.action).toBe('ext:command');
    expect(JSON.parse(last.data as string)).toEqual({ module: 'settlement', action: 'assign-job', payload: {
      v: 1, stateRevision: 14, campId: 45, campRevision: 2, targetId: 24, targetRevision: 1,
      job: { kind: 'plant', plotIds: [31], sourceId: 21, destinationId: 30 },
      sourceRevision: 2, destinationRevision: 0, componentRevisions: [0], inventoryStamp: '3d2c627d9bc2e163'
    } });
    expect(worldWorkLastError(game)).toBeNull();
    expect(residentComponent(game, 24)!.job).toEqual({ kind: 'plant', plotIds: [31], sourceId: 21, destinationId: 30 });
    expect(game.world5!.simulationTicks).toBe(41000); expect(game.player.hp).toBe(30);
    expect(selects()[0]!.value).not.toBe(21); // CAS refresh retired the previous draft.
    const events = game.recordedInputEvents.length;
    for (const job of [
      { kind: 'plant', sourceId: 21, destinationId: 999, plotIds: [31] },
      { kind: 'plant', sourceId: 21, destinationId: 30, plotIds: [999] },
      { kind: 'haul', sourceId: 30, destinationId: 21, itemId: 53, quantity: 1 }
    ]) props().onResident('assign-job', 24, { job });
    expect(game.recordedInputEvents).toHaveLength(events);
    // Fixture-only adverse edits below: the natural prefix above never stages
    // visibility/actors/items/IDs. Mutate individual authorization prerequisites.
    const fixture = game.world5!.structures.find(r => r.fixture?.id === 31)!;
    const originalLevel = fixture.levelRef;
    fixture.levelRef = { kind: 'dungeon', depth: 2 };
    expect(read().jobTargets!.find(t => t.campId === 45)!.plots).toEqual([]);
    fixture.levelRef = originalLevel;
    const originalOwner = fixture.owner; fixture.owner = 'other';
    expect(read().jobTargets!.find(t => t.campId === 45)!.plots).toEqual([]); fixture.owner = originalOwner;
    const originalRegion = fixture.regionId; fixture.regionId = 999;
    expect(read().jobTargets!.find(t => t.campId === 45)!.plots).toEqual([]); fixture.regionId = originalRegion;
    const state = game.extensionRuntime!.worldCampState('settlement');
    const originalConstruction = state.constructions;
    state.constructions = state.constructions.filter(c => c.componentId !== 31);
    game.extensionRuntime!.worldCampReplace('settlement', state);
    const cell = game.grid.getCell(23, 20)!, explored = cell.isExplored; cell.isExplored = false;
    expect(read().jobTargets!.find(t => t.campId === 45)!.plots).toEqual([]);
    cell.isExplored = explored; state.constructions = originalConstruction;
    game.extensionRuntime!.worldCampReplace('settlement', state);
    const chest = game.world5!.containers.find(c => c.id === 30)!;
    const kind = chest.kind; chest.kind = 'escrow';
    expect(read().jobTargets!.find(t => t.campId === 45)!.boxes.map(b => b.id)).toEqual([21]); chest.kind = kind;
    // Deleted targets, native CAS changes, unavailable and replay state retire
    // UI drafts/old actions; they never widen the command authority.
    session.refresh(); await Vue.nextTick();
    select(selects()[0]!, 21); select(selects()[1]!, 30); await Vue.nextTick();
    const revision = chest.revision; chest.revision++;
    session.refresh(); await Vue.nextTick(); expect(selects()[1]!.value).not.toBe(30); chest.revision = revision;
    // Updating only display prerequisites cannot keep an old job draft alive.
    for (const change of ['camp', 'unavailable', 'depth'] as const) {
      displayed.value = read(); await Vue.nextTick();
      const resident = all(root).find(n => n.props['data-select-resident'] === 24)!;
      resident.props.onClick(); await Vue.nextTick();
      select(selects()[0]!, 21); select(selects()[1]!, 30); await Vue.nextTick();
      const changed = structuredClone(read());
      if (change === 'camp') changed.residents!.residents[0]!.campId = 999;
      if (change === 'unavailable') changed.available = false;
      if (change === 'depth') changed.depth++;
      displayed.value = changed; await Vue.nextTick();
      if (change === 'depth') expect(all(root).filter(n => n.type === 'fieldset')).toHaveLength(0);
      else expect(selects()[1]!.value).not.toBe(30);
      expect(game.recordedInputEvents).toHaveLength(events);
    }
    displayed.value = null;
    const oldAction = props().onResident;
    expect(game.loadReplay(game.exportRecording())).toBe(true);
    session.refresh(); await Vue.nextTick();
    oldAction('assign-job', 24, { job: { kind: 'plant', plotIds: [31], sourceId: 21, destinationId: 30 } });
    expect(game.replayCursor).toBe(0); expect(game.replayError).toBeNull();
  } finally { sessionScope.stop(); game.extensionRuntime?.unload(); }
}, 15000);

describe('resident draft survives unchanged DTO refresh', () => {
  let game: Game, nativeModel: SettlementView;
  const scopes: Vue.EffectScope[] = [];
  beforeAll(() => {
    game = new Game({ seed: 1 });
    game.animationEnabled = false;
    game.startNewGame({ seed: naturalRoute.seed, mode: 'normal', ruleSet: 'extended', extensions: ['settlement'] });
    let count = 0;
    for (const step of naturalRoute.steps) {
      for (let n = 0; n < step.count && count < 398; n++, count++) {
        const decisions = [...step.decisions];
        game.onConfirmRequest = () => decisions.shift() ?? true;
        game.executeCommand(step.action, step.data);
        while (game.pendingCommandConfirmation)
          game.resolveCommandDecision(game.pendingCommandConfirmation.token, decisions.shift() ?? true);
        expect(decisions).toHaveLength(0);
      }
      if (count === 398) break;
    }
    expect(game.recordedInputEvents).toHaveLength(398);
    nativeModel = game.extensionRuntime!.readModuleView('settlement')!.state as unknown as SettlementView;
  }, 15000);
  afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));
  afterAll(() => game.extensionRuntime?.unload());

  async function editedDraft(live: boolean) {
    const model = Vue.ref(structuredClone(nativeModel)), blocked = Vue.ref(false);
    const command = vi.fn();
    let session: ReturnType<typeof useSettlementUi> | undefined;
    if (live) {
      const scope = Vue.effectScope(); scopes.push(scope);
      session = scope.run(() => useSettlementUi({ game: () => game, tick: Vue.ref(0), immersive: Vue.ref(false), canOpenPanel: () => true, beforeOpenPanel() {}, afterClosePanel() {} }))!;
      session.commands.value[0]!.invoke();
    }
    const root = node('root'); root.parent = body; body.children.push(root);
    // Read emitted drafts through a spy: editing/readback never sends a command.
    app = renderer.createApp({ render: () => Vue.h(Residents, {
      model: session ? session.panel.value!.props.model : model.value,
      blocked: blocked.value, onCommand: command
    }) }).use(I18NextVue, { i18next });
    app.mount(root); await Vue.nextTick();
    all(root).find(n => n.props['data-select-resident'] === 24)!.props.onClick();
    await Vue.nextTick();
    const selects = () => all(root).filter(n => n.type === 'select');
    const select = (element: HostNode, value: number) => {
      for (const option of element.options) (option as any).selected = option.value === value;
      (element as any).selectedIndex = element.options.findIndex(option => option.value === value);
      for (const listener of element.listeners.change ?? []) listener({ target: element });
    };
    select(selects()[0]!, 21); select(selects()[1]!, 30);
    await Vue.nextTick(); // Source changes retire the previous item selection.
    const item = nativeModel.boxes.find(b => b.id === 21)!.items.find(i => i.quantity - i.lockedQuantity >= 4)!;
    expect(item).toBeDefined(); select(selects()[2]!, item.id);
    const plot = all(root).find(n => n.type === 'input' && n.props.type === 'checkbox' && n.value === 31)!;
    (plot as any).checked = true;
    for (const listener of plot.listeners.change ?? []) listener({ target: plot });
    const numbers = all(root).filter(n => n.type === 'input' && n.props.type === 'number');
    [4, 12, 6].forEach((value, index) => {
      numbers[index]!.value = String(value);
      for (const listener of numbers[index]!.listeners.input ?? []) listener({ target: numbers[index] });
    });
    await Vue.nextTick(); await Vue.nextTick();
    const button = (key: string) => all(root).find(n => n.type === 'button' && n.text === i18next.t(key));
    const snapshot = () => {
      const plant = button('ext.settlement.resident.job.plant');
      const haul = button('ext.settlement.resident.job.haul');
      command.mockClear();
      plant?.props.onClick(); haul?.props.onClick(); button('ext.settlement.resident.set_schedule')?.props.onClick();
      return {
        fields: JSON.parse(JSON.stringify(command.mock.calls)), plantDisabled: plant?.props.disabled, haulDisabled: haul?.props.disabled,
        selectedIndices: selects().map(n => (n as any).selectedIndex),
        numbers: all(root).filter(n => n.type === 'input' && n.props.type === 'number').map(n => Number(n.value)),
        selectedResidents: all(root).filter(n => n.props['data-select-resident'] && n.props['aria-pressed']).map(n => n.props['data-select-resident']),
        fieldsets: all(root).filter(n => n.type === 'fieldset').length
      };
    };
    const initial = snapshot();
    expect(initial).toMatchObject({ plantDisabled: false, haulDisabled: false, numbers: [4, 12, 6], selectedResidents: [24], fieldsets: 1 });
    expect(initial.fields).toEqual([
      ['assign-job', 24, { job: { kind: 'plant', sourceId: 21, destinationId: 30, plotIds: [31] } }],
      ['assign-job', 24, { job: { kind: 'haul', sourceId: 21, destinationId: 30, itemId: item.id, quantity: 4 } }],
      ['set-schedule', 24, { schedule: [12, 6, 14] }]
    ]);
    return { model, blocked, root, session, initial, snapshot };
  }

  it.each(['fresh DTO', 'native session'] as const)('preserves every edited field on identical %s refresh', async mode => {
    const before = saved(game), random = rng.getState(), nextId = getNextEntityId();
    const f = await editedDraft(mode === 'native session');
    for (let i = 0; i < 2; i++) {
      const previous = f.session ? f.session.panel.value!.props.model : f.model.value;
      if (f.session) f.session.refresh();
      else f.model.value = JSON.parse(JSON.stringify(f.model.value));
      const next = f.session ? f.session.panel.value!.props.model : f.model.value;
      expect(next).not.toBe(previous); expect(next).toEqual(previous);
      await Vue.nextTick(); await Vue.nextTick();
      expect(f.snapshot()).toEqual(f.initial);
    }
    expect(saved(game)).toEqual(before); expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(nextId);
  });

  it.each(['target-CAS', 'resident-CAS', 'target-deletion', 'camp', 'depth', 'blocked', 'unavailable', 'resident-switch', 'resident-deletion'] as const)
  ('still retires stale job selections after %s', async change => {
    const before = saved(game), random = rng.getState(), nextId = getNextEntityId();
    const f = await editedDraft(false);
    // Adverse DTO fixtures only; never mutate the natural world or its inputs.
    if (change === 'target-CAS') f.model.value.jobTargets![0]!.boxes.find(b => b.id === 30)!.revision++;
    if (change === 'resident-CAS') f.model.value.residents!.residents[0]!.revision++;
    if (change === 'target-deletion') f.model.value.jobTargets![0]!.boxes = f.model.value.jobTargets![0]!.boxes.filter(b => b.id !== 30);
    if (change === 'camp') f.model.value.residents!.residents[0]!.campId = 999;
    if (change === 'depth') f.model.value.depth++;
    if (change === 'blocked') f.blocked.value = true;
    if (change === 'unavailable') f.model.value.available = false;
    if (change === 'resident-deletion') f.model.value.residents!.residents = [];
    if (change === 'resident-switch') {
      f.model.value.residents!.residents.push({ ...f.model.value.residents!.residents[0]!, id: 25 });
      await Vue.nextTick();
      all(f.root).find(n => n.props['data-select-resident'] === 25)!.props.onClick();
    }
    await Vue.nextTick(); await Vue.nextTick();
    const after = f.snapshot();
    if (change === 'depth' || change === 'resident-deletion') {
      expect(after.fieldsets).toBe(0); expect(after.selectedResidents).toEqual([]); expect(after.fields).toEqual([]);
    } else {
      expect(after.plantDisabled).toBe(true); expect(after.haulDisabled).toBe(true);
      expect(after.fields[0]).toEqual(['assign-job', change === 'resident-switch' ? 25 : 24, { job: { kind: 'plant', sourceId: null, destinationId: null, plotIds: [] } }]);
      expect(after.fields[1]![2]).toEqual({ job: { kind: 'haul', sourceId: null, destinationId: null, itemId: null, quantity: 4 } });
    }
    expect(saved(game)).toEqual(before); expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(nextId);
  });
});
