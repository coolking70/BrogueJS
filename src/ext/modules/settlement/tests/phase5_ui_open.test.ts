import '../../../../i18n';
import { it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import * as Vue from 'vue';
import * as Pixi from 'pixi.js';
import { effectScope, ref } from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import { cameraState, recenterCamera } from '../../../../ui/mapCamera';
import { viewport, computeLayoutMode } from '../../../../ui/layout';
import { displaySettings } from '../../../../engine/Settings';
import { prepareCanvasInputScene } from '../../../../test/support/canvasInputScene';
type N = {
  tag: string;
  text: string;
  props: Record<string, any>;
  children: N[];
  parent: N | null;
  focus(): void;
  clientWidth: number;
  clientHeight: number;
  getBoundingClientRect(): { left: number; top: number; right: number; bottom: number };
  appendChild(): void;
  closest(): null;
};
const node = (tag = '', text = ''): N =>
  Vue.markRaw({
    tag,
    text,
    props: {},
    children: [],
    parent: null,
    focus() {},
    clientWidth: 800,
    clientHeight: 400,
    getBoundingClientRect() {
      return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight };
    },
    appendChild() {},
    closest() {
      return null;
    }
  });
const body = node('body');
const renderer = Vue.createRenderer<N, N>({
  createElement: (tag) => node(tag),
  createText: (t) => node('', t),
  createComment: () => node(),
  insert(child, parent, anchor) {
    child.parent?.children.splice(child.parent.children.indexOf(child), 1);
    const i = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(i < 0 ? parent.children.length : i, 0, child);
    child.parent = parent;
  },
  remove(child) {
    child.parent?.children.splice(child.parent.children.indexOf(child), 1);
    child.parent = null;
  },
  setText(n, t) {
    n.text = t;
  },
  setElementText(n, t) {
    n.text = t;
    n.children = [];
  },
  parentNode: (n) => n.parent,
  nextSibling: (n) => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp(n, k, _old, v) {
    n.props[k] = v;
  },
  querySelector: () => body
});

import { Game } from '../../../../engine/Core/Game';
import { prepareModuleCreation, buildModuleCreationCommands } from '../../../ui/creation';
import {
  loadGrowthCreationContext,
  createGrowthCreationDraft,
  buildGrowthCreationCommands
} from '../../growth/view';
import { useSettlementUi } from '../ui/useSettlementUi';
import { registerModuleMapSelection, moduleMapSelection } from '../../../../ui/moduleMapSelection';
import { useModuleUi } from '../../../ui/useModuleUi';
import {
  bindDialogAcknowledgments,
  bindDialogCommands,
  presentationTimeline
} from '../../../../ui/dialogAcknowledgments';
import { logger } from '../../../../engine/Systems/Logger';
import { DialogService } from '../../../../ui/dialogService';
import { scene, establish } from './helpers';
import { useCraftingUi } from '../../crafting/ui/useCraftingUi';
import { useForagingUi } from '../../foraging/ui/useForagingUi';
import { useGrowthUi } from '../../growth/ui/useGrowthUi';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';

const cases = [
  { extensions: ['combat', 'crafting', 'foraging', 'giants', 'growth', 'narrative', 'settlement'] },
  { extensions: ['settlement'] }
];
beforeAll(() => {
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), {
      innerWidth: 800,
      innerHeight: 991,
      devicePixelRatio: 1,
      location: { search: '' },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval
    })
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal('navigator', { vibrate() {} });
  vi.stubGlobal('document', {
    hidden: false,
    fonts: { load: async () => [] },
    documentElement: { dataset: {} },
    activeElement: null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {}
  });
});
afterAll(async () => {
  (await import('../../../../ui/dialogInput')).dialogInput.dispose();
  vi.unstubAllGlobals();
});
afterEach(() => {
  moduleMapSelection.value = null;
  vi.restoreAllMocks();
});
const harness = createSfcHarness({ baseURL: new URL('../../../../test/harness.ts',import.meta.url).href });
const panels = {
  settlement: () => harness.load('../ext/modules/settlement/ui/SettlementPanel.vue'),
  crafting: () => harness.load('../ext/modules/crafting/ui/CraftingPanel.vue'),
  foraging: () => harness.load('../ext/modules/foraging/ui/ForagingPanel.vue'),
  growth: () => harness.load('../ext/modules/growth/ui/GrowthCharacterPanel.vue')
};
function start(modules: string[], camp: boolean) {
  const plan = prepareModuleCreation(modules),
    selected = new Map<string, readonly string[]>();
  if (modules.includes('growth')) {
    const c = loadGrowthCreationContext();
    selected.set('growth', buildGrowthCreationCommands(c, createGrowthCreationDraft(c.pack))!);
  }
  const g = new Game();
  g.startNewGame({
    seed: '7306',
    mode: 'wizard',
    ruleSet: 'extended',
    extensions: modules,
    initialCommands: buildModuleCreationCommands(plan, selected)
  });
  g.animationEnabled = false;
  expect(g.player.inventory.items.filter(i => i.consumableId === 'ration_of_food').reduce((n,i) => n+i.quantity,0)).toBe(2);
  if (camp) {
    // Keep real startup/creation, then stage a legal camp scene. Establish itself
    // remains a real paid public command; no fake module view or camp DTO.
    scene(g);
    g.onConfirmRequest = () => true;
    g.executeCommand(
      'ext:command',
      JSON.stringify({ module: 'settlement', action: 'establish', payload: establish(g) })
    );
    expect(g.extensionRuntime!.worldCampState('settlement').camps).toHaveLength(1);
  }
  return g;
}
function state(g: Game) {
  return {
    world: structuredClone(g.world5),
    random: rng.getState(),
    id: getNextEntityId(),
    events: g.recordedInputEvents.length,
    turn: g.absoluteTurnNumber
  };
}
function host(g: Game, dialogs: DialogService): ModuleUiHost {
  return {
    game: () => g,
    tick: ref(0),
    immersive: ref(false),
    dialogs,
    selectMapCells: registerModuleMapSelection,
    canOpenPanel: () => true,
    beforeOpenPanel() {},
    afterClosePanel() {}
  };
}
async function renderPanel(session: ModuleUiSession, Panel: Vue.Component, dialogs: DialogService) {
  const app = renderer
    .createApp({
      setup: () => () => (session.panel.value ? Vue.h(Panel, session.panel.value.props) : null)
    })
    .use(I18NextVue, { i18next });
  const root = node('root');
  app.mount(root);
  await Vue.nextTick();
  expect(body.children.some((n) => n.tag === 'section' || n.tag === 'div')).toBe(true);
  try {
    for (let i = 0; i < 10; i++) {
      dialogs.sync();
      session.refresh();
      await Vue.nextTick();
    }
  } finally {
    app.unmount();
  }
}
for (const { extensions } of cases)
  for (const camp of [false, true]) {
    it(`camp panel seed 7306: ${extensions.join('+')}, camp=${camp}`, async () => {
      const g = start(extensions, camp),
        scope = effectScope(),
        dialogs = new DialogService();
      const Panel = await panels.settlement(),
        before = state(g),
        startTime = performance.now();
      try {
        const session = scope.run(() => useSettlementUi(host(g, dialogs)))!;
        session.commands.value[0]!.invoke();
        expect(session.panelOpen.value).toBe(true);
        expect(moduleMapSelection.value?.cells.length ?? 0).toBe(camp ? 0 : 81);
        await renderPanel(session, Panel, dialogs);
        const props = session.panel.value!.props as any;
        props.onTab('build');
        props.onCursor(1, 0);
        props.onAppend();
        expect(moduleMapSelection.value?.cells.length).toBe(2);
        props.onTab('residents');
        await renderPanel(session, Panel, dialogs);
        session.close();
        expect(moduleMapSelection.value).toBeNull();
        const elapsed = performance.now() - startTime;
        process.stdout.write(
          JSON.stringify({ panel: 'settlement', modules: extensions, camp, elapsedMs: elapsed }) +
            '\n'
        );
        expect(elapsed).toBeLessThan(1000);
        expect(state(g)).toEqual(before);
      } finally {
        scope.stop();
        dialogs.dispose();
        g.disposeRecording();
      }
    }, 20000);
  }
it.each(['crafting', 'foraging', 'growth'] as const)(
  'all modules seed 7306 opens %s panel',
  async (id) => {
    const g = start(cases[0]!.extensions, false),
      scope = effectScope(),
      dialogs = new DialogService();
    const Panel = await panels[id](),
      before = state(g),
      startTime = performance.now();
    try {
      const use = { crafting: useCraftingUi, foraging: useForagingUi, growth: useGrowthUi }[id];
      const session = scope.run(() => use(host(g, dialogs), async () => Panel))!;
      session.commands.value[0]!.invoke();
      for (let i = 0; i < 10 && !session.panelOpen.value; i++) await Vue.nextTick();
      expect(session.panelOpen.value).toBe(true);
      await renderPanel(session, Panel, dialogs);
      session.close();
      expect(session.panelOpen.value).toBe(false);
      const elapsed = performance.now() - startTime;
      process.stdout.write(JSON.stringify({ panel: id, elapsedMs: elapsed }) + '\n');
      expect(elapsed).toBeLessThan(1000);
      expect(state(g)).toEqual(before);
    } finally {
      scope.stop();
      dialogs.dispose();
      g.disposeRecording();
    }
  },
  20000
);

it('shared seven-module shell settles after opening camp through the real command bar', async () => {
  const g = start(cases[0]!.extensions, false),
    scope = effectScope(),
    dialogs = new DialogService();
  const h = host(g, dialogs);
  let ui: ReturnType<typeof useModuleUi>;
  h.beforeOpenPanel = () => ui.closePanels();
  h.isPresentationBusy = () => !!presentationTimeline(g)?.busy || !!logger.pendingAcknowledgment;
  h.canOpenPanel = () =>
    !(
      g.interactionActive ||
      g.isInventoryOpen ||
      g.isThrowing ||
      g.pendingArcana ||
      g.pendingEnchantment ||
      g.pendingIdentify ||
      g.pendingUseConfirm ||
      logger.pendingAcknowledgment ||
      g.referenceScreen ||
      g.isGameOver ||
      g.isAdvancing ||
      g.isInputLocked()
    );
  h.canPresentInteraction = () => !g.isInventoryOpen && !g.referenceScreen && !g.pendingArcana;
  h.canOpenInteraction = () =>
    !ui.panelOpen.value && !dialogs.current && !presentationTimeline(g)?.busy;
  ui = scope.run(() => useModuleUi(h))!;
  ui.refresh();
  const removeCommands = bindDialogCommands(dialogs, g),
    removeAcks = bindDialogAcknowledgments(dialogs, g, logger);
  const Bar = await harness.load('../components/CommandBar.vue'),
    Panel = await panels.settlement();
  const root = node('root'),
    before = state(g);
  const app = renderer
    .createApp({
      setup: () => () =>
        Vue.h('div', [
          Vue.h(Bar, { mode: 'portrait', moduleCommands: ui.commands.value }),
          ...ui.panelSlots.value.map((slot) => Vue.h(Panel, slot.props))
        ])
    })
    .use(I18NextVue, { i18next });
  const walk = (n: N): N[] => [n, ...n.children.flatMap(walk)];
  try {
    app.mount(root);
    await Vue.nextTick();
    const button = walk(root).find((n) => n.props['data-action'] === 'settlement.open')!;
    expect(button).toBeDefined();
    expect(button.props.disabled).toBe(false);
    const t = performance.now();
    button.props.onClick();
    await Vue.nextTick();
    expect(ui.panelOpen.value).toBe(true);
    for (let k = 0; k < 10; k++) {
      dialogs.sync();
      ui.refresh();
      await Vue.nextTick();
    }
    expect(performance.now() - t).toBeLessThan(1000);
    expect(state(g)).toEqual(before);
  } finally {
    app.unmount();
    scope.stop();
    removeCommands();
    removeAcks();
    dialogs.dispose();
    g.disposeRecording();
  }
}, 20000);

class TextFixture extends Pixi.Container {
  text: string;
  style: Pixi.TextStyle;
  anchor = new Pixi.Point();
  resolution = 1;
  constructor(options: { text: string; style: Pixi.TextStyle }) {
    super();
    this.text = options.text;
    this.style = options.style;
  }
}
class CanvasFixture extends EventTarget {
  style: Record<string, string> = {};
  setPointerCapture() {}
  releasePointerCapture() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 800, bottom: 400 };
  }
}
class ApplicationFixture {
  static latest: ApplicationFixture;
  constructor() { ApplicationFixture.latest = this; }
  stage = new Pixi.Container();
  canvas = new CanvasFixture();
  ticker = {
    frame: undefined as undefined | ((time: { elapsedMS: number; deltaMS: number }) => void),
    add(frame: (time: { elapsedMS: number; deltaMS: number }) => void) { this.frame = frame; }
  };
  renderer = {
    screen: { width: 800, height: 400 },
    resize(width: number, height: number) {
      this.screen = { width, height };
    }
  };
  async init() {}
  destroy() {
    this.stage.destroy({ children: true });
  }
}
for (const { extensions } of cases)
  for (const camp of [false, true]) {
    it(`actual GameCanvas camp: ${extensions.join('+')}, camp=${camp}`, async () => {
      const g = start(extensions, camp),
        scope = effectScope(),
        dialogs = new DialogService(),
        h = host(g, dialogs);
      const { dialogInput } = await import('../../../../ui/dialogInput');
      let ui: ReturnType<typeof useModuleUi>;
      h.beforeOpenPanel = () => ui.closePanels();
      ui = scope.run(() => useModuleUi(h))!;
      ui.refresh();
      const remove = dialogInput.attach({ service: dialogs, contains: () => false, hint() {} });
      const removeCommands = bindDialogCommands(dialogs, g),
        removeAcks = bindDialogAcknowledgments(dialogs, g, logger);
      const Canvas = await createSfcHarness({
        baseURL: new URL('../../../../test/harness.ts',import.meta.url).href,
        stubs: {
          'pixi.js': { ...Pixi, Text: TextFixture, Application: ApplicationFixture },
          '../engine/Core/Game': { activeGame: g }
        }
      }).load('../components/GameCanvas.vue');
      const Panel = await panels.settlement(),
        root = node('root');
      const app = renderer
        .createApp({
          setup: () => () =>
            Vue.h('div', [
              Vue.h(Canvas, { pauseAutomaticActions: ui.panelOpen.value }),
              ...ui.panelSlots.value.map((slot) => Vue.h(Panel, slot.props))
            ])
        })
        .use(I18NextVue, { i18next });
      try {
        app.mount(root);
        for (let n = 0; n < 12; n++) await Vue.nextTick();
        expect((window as any).advanceTime).toBeTypeOf('function');
        const before = state(g),
          t = performance.now();
        const read = g.extensionRuntime!.readModuleView.bind(g.extensionRuntime);
        let depth = 0,
          maxDepth = 0,
          reads = 0;
        vi.spyOn(g.extensionRuntime!, 'readModuleView').mockImplementation((...args) => {
          depth++;
          maxDepth = Math.max(maxDepth, depth);
          reads++;
          try {
            return read(...args);
          } finally {
            depth--;
          }
        });
        ui.commands.value.find((c) => c.id === 'settlement.open')!.invoke();
        await Vue.nextTick();
        for (let n = 0; n < 10; n++) {
          g.onRenderRequested?.();
          (window as any).advanceTime(1);
          await Vue.nextTick();
        }
        expect(ui.panelOpen.value).toBe(true);
        expect(moduleMapSelection.value?.cells.length ?? 0).toBe(camp ? 0 : 81);
        expect(maxDepth).toBe(1);
        expect(reads).toBeLessThan(1000);
        const elapsed = performance.now() - t;
        process.stdout.write(
          JSON.stringify({
            canvas: true,
            modules: extensions,
            camp,
            elapsedMs: elapsed,
            reads,
            maxDepth
          }) + '\n'
        );
        expect(elapsed).toBeLessThan(1000);
        expect(state(g)).toEqual(before);
        ui.closePanels();
        await Vue.nextTick();
        expect(ui.panelOpen.value).toBe(false);
        expect(moduleMapSelection.value).toBeNull();
      } finally {
        app.unmount();
        scope.stop();
        remove();
        removeCommands();
        removeAcks();
        dialogs.dispose();
        g.disposeRecording();
      }
    }, 20000);
  }

// Real SFC layout/watch/display loop; only DOM geometry and GPU text are fixtures.
it.each([[320,844],[390,844],[800,991],[1440,900]])(
  'GameCanvas follows resize/drawer/movement and preserves manual camera controls at %i×%i',
  async (width, height) => {
    const g = start(['settlement'], false);
    prepareCanvasInputScene(g, true);
    const oldViewport = { ...viewport }, oldCamera = { ...cameraState };
    const oldImmersive = displaySettings.immersiveMode;
    Object.assign(viewport, { width, height, mode: computeLayoutMode(width!, height!) });
    Object.assign(window, { innerWidth: width, innerHeight: height });
    Object.assign(cameraState, { zoom: 2, fit: false, panX: 0, panY: 0 });
    displaySettings.immersiveMode = false;
    const callbacks: Array<() => void> = [], frames: FrameRequestCallback[] = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { callbacks.push(cb); }
      observe() {} disconnect() {}
    });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const Canvas = await createSfcHarness({ baseURL: new URL('../../../../test/harness.ts',import.meta.url).href, stubs: {
      'pixi.js': { ...Pixi, Text: TextFixture, Application: ApplicationFixture },
      '../engine/Core/Game': { activeGame: g }
    }}).load('../components/GameCanvas.vue');
    const root = node('root'), panelOpen = ref(false);
    const app = renderer.createApp({ setup: () => () => Vue.h(Canvas, { pauseAutomaticActions: panelOpen.value }) })
      .use(I18NextVue, { i18next });
    const flush = async () => {
      for (const cb of callbacks) cb();
      for (const cb of frames.splice(0)) cb(0);
      await Vue.nextTick();
      (window as any).advanceTime(1);
      await Vue.nextTick();
    };
    try {
      app.mount(root);
      for (let n=0;n<12;n++) await Vue.nextTick();
      const el = root.children[0]!;
      const read = () => JSON.parse((window as any).render_game_to_text());
      const visible = () => {
        const { player, mapLayout: m } = read();
        const x = m.offsetX + (player.x + 0.5) * m.tile * m.scaleX;
        const y = m.offsetY + (player.y + 0.5) * m.tile * m.scaleY;
        expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(el.clientWidth);
        expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(el.clientHeight);
      };
      const before = state(g);
      for (const [w,h] of [[width!,height!*0.6],[width!,height!*0.4],[height!,width!*0.4],[width!,height!*0.6]] as const) {
        // A user pan must survive ordinary frames, then reset for new geometry.
        cameraState.panX = -300; cameraState.panY = -150;
        await Vue.nextTick();
        const pan = { x: cameraState.panX, y: cameraState.panY };
        (window as any).advanceTime(1); await Vue.nextTick();
        expect({ x: cameraState.panX, y: cameraState.panY }).toEqual(pan);
        Object.assign(el, { clientWidth: w, clientHeight: h });
        const windowHeight = w === height! ? width! : height!;
        Object.assign(window, { innerWidth: w, innerHeight: windowHeight });
        Object.assign(viewport, { width: w, height: windowHeight, mode: computeLayoutMode(w,windowHeight) });
        panelOpen.value = !panelOpen.value;
        await flush(); visible();
        expect(cameraState.panX).toBe(0); expect(cameraState.panY).toBe(0);
        expect(cameraState.zoom).toBe(2); expect(cameraState.fit).toBe(false);
      }
      cameraState.panX = -100; await Vue.nextTick(); recenterCamera(); await Vue.nextTick(); visible();
      // A drawer may clip the canvas without resizing its container. The post-DOM
      // panel watcher must still measure and center in the remaining map band.
      const cutHeight = Math.floor(el.clientHeight / 2);
      const drawer = { getClientRects: () => [1], getBoundingClientRect: () => ({
        left: 0, right: el.clientWidth, top: cutHeight, bottom: height!
      }) };
      const query = vi.spyOn(document, 'querySelectorAll').mockImplementation(() =>
        (panelOpen.value ? [drawer] : []) as unknown as NodeListOf<Element>);
      vi.stubGlobal('getComputedStyle', () => ({ visibility: 'visible' }));
      panelOpen.value = false; await Vue.nextTick();
      cameraState.zoom = 1; await Vue.nextTick();
      panelOpen.value = true; await Vue.nextTick();
      const clipped = read();
      expect(clipped.mapLayout.offsetY + (clipped.player.y + 0.5) * clipped.mapLayout.tile * clipped.mapLayout.scaleY)
        .toBeLessThanOrEqual(cutHeight);
      panelOpen.value = false; await Vue.nextTick(); visible(); query.mockRestore();
      cameraState.fit = true; await Vue.nextTick();
      el.clientHeight -= 10; await flush(); visible(); expect(cameraState.fit).toBe(true);
      cameraState.fit = false; await Vue.nextTick();
      expect(state(g)).toEqual(before);
      // Paused automatic actions must not pause following accepted native moves.
      panelOpen.value = true; await Vue.nextTick();
      g.executeCommand('move', { x: 1, y: 0 });
      await flush(); visible();
      expect(g.player.loc).toEqual({ x: 21, y: 12 });
    } finally {
      app.unmount(); g.disposeRecording();
      Object.assign(viewport, oldViewport); Object.assign(cameraState, oldCamera);
      displaySettings.immersiveMode = oldImmersive;
    }
  }, 20000);

it('seven-module canvas expires frozen combat labels during ACK/drawers and clears the actual sprite pool', async () => {
  const g = start(cases[0]!.extensions, false), dialogs = new DialogService();
  const removeAcks = bindDialogAcknowledgments(dialogs, g, logger);
  const paused = ref(false);
  const Canvas = await createSfcHarness({ baseURL: new URL('../../../../test/harness.ts',import.meta.url).href, stubs: {
    'pixi.js': { ...Pixi, Text: TextFixture, Application: ApplicationFixture },
    '../engine/Core/Game': { activeGame: g }
  } }).load('../components/GameCanvas.vue');
  const app = renderer.createApp({ setup: () => () => Vue.h(Canvas, { pauseAutomaticActions: paused.value }) });
  const read = () => JSON.parse((window as any).render_game_to_text()).floatingTexts;
  const sprites = (): TextFixture[] => {
    const walk = (c: Pixi.Container): Pixi.Container[] => [c, ...c.children.flatMap(walk)];
    return walk(ApplicationFixture.latest.stage).filter(c => c instanceof TextFixture && c.text === '未命中' && c.visible) as TextFixture[];
  };
  try {
    app.mount(node('root')); for (let n = 0; n < 12; n++) await Vue.nextTick();
    g.spawnFloatingText('未命中', g.player.x, g.player.y);
    logger.log('hold first frame', '#fff', { acknowledge: true });
    logger.log('same effect, later frame', '#fff', { acknowledge: true });
    const before = state(g);
    (window as any).advanceTime(1);
    expect(read()).toHaveLength(1); expect(sprites()).toHaveLength(1);
    const y = sprites()[0]!.y;
    paused.value = true; g.isInventoryOpen = true; await Vue.nextTick();
    (window as any).advanceTime(250);
    expect(sprites()[0]!.alpha).toBeCloseTo(0.5, 1); expect(sprites()[0]!.y).toBeLessThan(y);
    (window as any).advanceTime(300);
    expect(read()).toEqual([]); expect(sprites()).toEqual([]); expect(g.floatingTexts).toEqual([]);
    expect(state(g)).toEqual(before);
    const timeline = presentationTimeline(g)!;
    timeline.acknowledge(timeline.acknowledgment!); (window as any).advanceTime(1);
    expect(read()).toEqual([]); expect(sprites()).toEqual([]);
    timeline.acknowledge(timeline.acknowledgment!);
    paused.value = false; g.isInventoryOpen = false; await Vue.nextTick();
    g.spawnFloatingText('未命中', g.player.x, g.player.y, '#aaa', 60);
    (window as any).advanceTime(1); (window as any).advanceTime(550);
    expect(sprites()).toHaveLength(1);
    (window as any).advanceTime(500); expect(sprites()).toEqual([]);
    // Pixi clamps deltaMS on a slow frame. Cosmetic expiry uses elapsed wall
    // display time so low FPS cannot stretch a 500ms label over many turns.
    g.spawnFloatingText('未命中', g.player.x, g.player.y);
    (window as any).advanceTime(1); expect(sprites()).toHaveLength(1);
    ApplicationFixture.latest.ticker.frame!({ elapsedMS: 1000, deltaMS: 100 });
    expect(sprites()).toEqual([]);
    g.spawnFloatingText('未命中', g.player.x, g.player.y);
    (window as any).advanceTime(1); expect(sprites()).toHaveLength(1);
    g.startNewGame({ seed: '7306', mode: 'wizard' });
    (window as any).advanceTime(1); expect(read()).toEqual([]); expect(sprites()).toEqual([]);
  } finally { app.unmount(); removeAcks(); dialogs.dispose(); g.disposeRecording(); }
}, 20000);

it('DEV wait uses real canvas input, awaits animation, and reports ACK/modal/overlay/lock blockers without extra commands', async () => {
  const g = start(cases[0]!.extensions, false), modal = ref(false), dialogs = new DialogService();
  prepareCanvasInputScene(g, true);
  const removeAcks = bindDialogAcknowledgments(dialogs, g, logger), removeCommands = bindDialogCommands(dialogs, g);
  const Canvas = await createSfcHarness({ baseURL: new URL('../../../../test/harness.ts',import.meta.url).href, stubs: {
    'pixi.js': { ...Pixi, Text: TextFixture, Application: ApplicationFixture },
    '../engine/Core/Game': { activeGame: g }
  } }).load('../components/GameCanvas.vue');
  const app = renderer.createApp({ setup: () => () => Vue.h(Canvas, { displayModalOpen: modal.value }) });
  try {
    app.mount(node('root')); for (let n = 0; n < 12; n++) await Vue.nextTick();
    const debug = (window as any).debug_game;
    expect(debug?.wait).toBeTypeOf('function');
    const turn = g.absoluteTurnNumber, count = g.recordedInputEvents.length;
    g.executeCommand('wait');
    expect(g.isAdvancing).toBe(true); expect(g.absoluteTurnNumber).toBe(turn);
    g.executeCommand('wait'); // locked: no second command
    (window as any).advanceTime(100);
    expect(g.absoluteTurnNumber).toBeGreaterThan(turn); expect(g.recordedInputEvents.length).toBe(count + 1);
    for (let i = 0; i < 2; i++) {
      const before = g.stats.turns, commands = g.recordedInputEvents.length;
      const pending = debug.wait(); await Promise.resolve();
      (window as any).advanceTime(100);
      const result = await pending;
      expect(result.after.turn).toBe(before + 1); expect(g.recordedInputEvents.length).toBe(commands + 1);
      expect(g.recordedInputEvents[g.recordedInputEvents.length - 1]!.action).toBe('wait');
    }
    const before = state(g);
    logger.log('read before resting', '#fff', { acknowledge: true });
    await expect(debug.wait()).rejects.toThrow('acknowledgment'); expect(state(g)).toEqual(before);
    presentationTimeline(g)!.acknowledge(presentationTimeline(g)!.acknowledgment!);
    modal.value = true; await Vue.nextTick();
    await expect(debug.wait()).rejects.toThrow('display modal'); expect(state(g)).toEqual(before);
    modal.value = false; await Vue.nextTick(); g.isInventoryOpen = true;
    await expect(debug.wait()).rejects.toThrow('overlay'); expect(state(g)).toEqual(before); g.isInventoryOpen = false;
    const lock = vi.spyOn(g, 'isInputLocked').mockReturnValue(true);
    await expect(debug.wait()).rejects.toThrow('input locked'); expect(state(g)).toEqual(before); lock.mockRestore();
    const food = g.player.inventory.items.find(item => item.consumableId === 'ration_of_food')!;
    g.executeItemCommand('eat', food);
    expect(g.hasPendingConfirmation).toBe(true);
    const confirmationState = state(g), confirmation = g.pendingCommandConfirmation!;
    await expect(debug.wait()).rejects.toThrow('confirmation'); expect(state(g)).toEqual(confirmationState);
    expect(g.pendingCommandConfirmation).toBe(confirmation);
    g.resolveCommandDecision(confirmation.token, false);
    (window as any).advanceTime(100);
    const timeoutBefore = g.recordedInputEvents.length;
    await expect(debug.wait({ timeoutMs: 1 })).rejects.toThrow('timed out');
    (window as any).advanceTime(100);
    expect(g.recordedInputEvents.length).toBe(timeoutBefore + 1); // no retry after timeout
    const pending = debug.wait(); await Promise.resolve();
    await expect(debug.wait()).rejects.toThrow('another wait is pending');
    (window as any).advanceTime(100); await pending;
    app.unmount(); expect((window as any).debug_game).toBeUndefined();
    await expect(debug.wait()).rejects.toThrow('canvas disposed');
  } finally { app.unmount(); removeCommands(); removeAcks(); dialogs.dispose(); g.disposeRecording(); }
}, 20000);
