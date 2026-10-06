import { installRecordingScene } from './support/recordingV4';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import * as Pixi from 'pixi.js';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import '../i18n';
import { activeGame as game } from '../engine/Core/Game';
import { squareDisplayScene } from './support/squareDisplayScene';
import { createSfcHarness } from './support/sfcHarness';
import { logger } from '../engine/Systems/Logger';
import { PresentationTimeline } from '../ui/presentationTimeline';
import { observeDisplayFrame } from '../ui/displayProjection';
import { observePresentation } from '../engine/Core/PresentationObserver';
import { footprintOf, commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import { canSeeMonsterAt } from '../engine/UI/MonsterVisibility';
import { bodyEdges } from '../ui/bodyDrawing';
import { rng } from '../engine/Random';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { targetingState } from '../ui/targeting';
import { mapMode, mapModes } from '../ui/mapTiles';
import { displaySettings } from '../engine/Settings';
import { useModuleUi } from '../ext/ui/useModuleUi';
import type { ModuleUiHost } from '../ext/ui/types';
import { readFileSync } from 'node:fs';

interface Node { type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null;
    clientWidth: number; clientHeight: number; appendChild(child: unknown): void; focus(): void }
const node = (type = '', text = ''): Node => Vue.markRaw({ type, text, props: {}, children: [], parent: null,
    clientWidth: 1440, clientHeight: 900, appendChild() {}, focus() {} });
const renderer = Vue.createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('text', text), createComment: () => node('comment'),
    insert(child, parent, anchor) { child.parent?.children.splice(child.parent.children.indexOf(child), 1);
        const i = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(i < 0 ? parent.children.length : i, 0, child); child.parent = parent; },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, value) => { n.text = value; }, setElementText: (n, value) => { n.text = value; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _old, value) => { n.props[key] = value; },
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const apps: ReturnType<typeof renderer.createApp>[] = [];
const cleanups: (() => void)[] = [];
const win = Object.assign(new EventTarget(), { innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    location: { search: '' }, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
class Canvas extends EventTarget {
    style: Record<string, string> = {}; setPointerCapture() {} releasePointerCapture() {}
    getBoundingClientRect() { return { left: 0, top: 0, right: 1440, bottom: 900 }; }
}
class TextFixture extends Pixi.Container {
    text: string; style: Pixi.TextStyle; anchor = new Pixi.Point(); resolution = 1;
    constructor(options: { text: string; style: Pixi.TextStyle }) { super(); this.text = options.text; this.style = options.style; }
}
let application: ApplicationFixture;
class ApplicationFixture {
    stage = new Pixi.Container(); canvas = new Canvas(); ticker = { add: vi.fn() };
    renderer = { screen: { width: 1440, height: 900 }, resize() {} };
    constructor() { application = this; }
    async init() {} destroy() { this.stage.destroy({ children: true }); }
}
const doc = Object.assign(new EventTarget(), { hidden: false, fonts: { load: async () => [] }, documentElement: { dataset: {} } });
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] });
    Object.assign(win, { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval,
        setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout });
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc); vi.stubGlobal('navigator', { vibrate: vi.fn() });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    game.startNewGame({ seed: 403004, mode: 'test' }); squareDisplayScene(game);
    displaySettings.immersiveMode = false; mapMode.value = 'refined';
});
afterEach(() => {
    apps.splice(0).forEach(app => app.unmount()); cleanups.splice(0).forEach(remove => remove());
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); logger.observeMessages(null); logger.presentAcknowledgments(null); targetingState.aim = null;
});
async function mount(path: string, props: Record<string, unknown> = {}) {
    const harness = createSfcHarness({ baseURL: import.meta.url, stubs: { 'pixi.js': { ...Pixi, Text: TextFixture, Application: ApplicationFixture } } });
    const root = node('root'), app = renderer.createApp(await harness.load(path), props);
    app.use(I18NextVue, { i18next }); apps.push(app); app.mount(root);
    for (let i = 0; i < 8; i++) await Vue.nextTick();
    await vi.advanceTimersByTimeAsync(100); await Vue.nextTick(); return root;
}
const geometry = () => bodyGraphics().context.instructions.map(i => i.action === 'fill' || i.action === 'stroke' ? { action: i.action, path: i.data.path.instructions, color: i.data.style.color, alpha: i.data.style.alpha } : { action: i.action });
function draw() { game.onRenderRequested?.(); (window as any).advanceTime(1); }
const entityLayer = () => application.stage.children[2] as Pixi.Container;
const bodyGraphics = () => entityLayer().children[0] as Pixi.Graphics;
const hoverGraphics = () => entityLayer().children[entityLayer().children.length - 1] as Pixi.Graphics;
const targetGraphics = () => entityLayer().children[entityLayer().children.length - 2] as Pixi.Graphics;
const globalCell = (x: number, y: number) => application.stage.children[1]!.toGlobal(new Pixi.Point((x + .5) * 16, (y + .5) * 16));
function mouse(type: string, x: number, y: number, button = 0) {
    const pos = globalCell(x, y);
    const native = (name: string) => application.canvas.dispatchEvent(Object.assign(new Event(name), { pointerType: 'mouse', pointerId: 7, clientX: pos.x, clientY: pos.y, button }));
    if (type === 'pointerup') native('pointerdown');
    application.stage.emit(type, { pointerType: 'mouse', global: pos, button });
    if (type === 'pointerup') native('pointerup');
}
function touch(type: string, x: number, y: number) {
    const pos = globalCell(x, y);
    application.canvas.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerType: 'touch', pointerId: 1, clientX: pos.x, clientY: pos.y }));
}

describe('4a-3 real client SFC paths via shared harness', () => {
    it.each(['../components/Sidebar.vue', '../components/theme/ThemeNearby.vue', '../components/ContextPanel.vue'])('%s renders one public size/HP row, then keeps the old ACK row', async path => {
        const root = await mount(path); const monster = game.monsters[0]!;
        expect(text(root)).toContain('3×3'); expect(text(root)).toContain('300/300');
        expect(all(root).filter(n => n.props['data-entity-id'] === monster.id)).toHaveLength(1);
        const t = new PresentationTimeline(game, logger); cleanups.push(() => t.dispose()); logger.presentAcknowledgments(() => true);
        logger.log('old body HP', '#fff', { acknowledge: true }); monster.hp = 17; commitCreatureAnchor(monster, { x: 20, y: 11 }); observePresentation(game, 'command-complete');
        await vi.advanceTimersByTimeAsync(100); await Vue.nextTick(); expect(text(root)).toContain('300/300'); expect(text(root)).not.toContain('17/300');
        t.acknowledge(t.acknowledgment!); await vi.advanceTimersByTimeAsync(100); await Vue.nextTick(); expect(text(root)).toContain('17/300');
    });
    it('GameCanvas shares mask geometry in four modes, one glyph, clears absent bodies and leaves ordinary sprite count', async () => {
        await mount('../components/GameCanvas.vue'); const before = rng.getState(), monster = game.monsters[0]!;
        for (const mode of mapModes) {
            mapMode.value = mode; await Vue.nextTick(); draw();
            const paints = bodyGraphics().context.instructions;
            expect(paints).toHaveLength(2); expect(paints[0]!.action).toBe('fill'); expect(paints[1]!.action).toBe('stroke');
            const glyphs = entityLayer().children.filter(n => n instanceof TextFixture && n.visible && n !== entityLayer().children[258]);
            if (mode !== 'tiles') expect(glyphs).toHaveLength(2); // player + one body, no per-cell sprites
        }
        expect(rng.getState()).toEqual(before); mapMode.value = 'refined'; delete monster.spatial; draw();
        expect(bodyGraphics().context.instructions).toHaveLength(0);
        expect(entityLayer().children.filter(n => n instanceof TextFixture && n.visible)).toHaveLength(2);
    });
    it('GameCanvas mouse hover and right click resolve a tail, with public-mask hover and target edges only', async () => {
        await mount('../components/GameCanvas.vue'); const monster = game.monsters[0]!;
        for (const p of footprintOf(monster)) game.grid.getCell(p.x, p.y)!.isVisible = p.x === 14;
        mouse('pointermove', 14, 13); expect(game.hoveredText).toContain(monster.name);
        const lines = hoverGraphics().context.instructions.find(i => i.action === 'stroke'); expect(lines).toBeDefined();
        expect(bodyEdges(observeDisplayFrame(game, logger).map.bodies[0]!.cells)).toHaveLength(8);
        mouse('pointerup', 14, 13, 2); expect(game.inspectTarget?.name).toBe(monster.name);
        game.inspectTarget = null; const dart = ItemLoader.spawnWeapon('dart', -1, -1)!; game.player.inventory.addItem(dart);
        game.executeItemCommand('throw', dart); expect(game.isThrowing, 'throw mode entered').toBe(true); expect(canSeeMonsterAt(game.player, game.grid, monster, { x: 14, y: 13 })).toBe(true); mouse('pointerup', 14, 13); draw();
        expect(targetingState.aim).toEqual({ x: 14, y: 13 }); expect(targetGraphics().context.instructions.some(i => i.action === 'stroke')).toBe(true);
    });
    it.each(['throw', 'arcana'] as const)('GameCanvas mouse %s clicks on another body cell only re-aim; same-cell third click confirms', async mode => {
        await mount('../components/GameCanvas.vue');
        const item = mode === 'throw' ? ItemLoader.spawnWeapon('dart', -1, -1)! : ItemLoader.spawnStaff('staff_of_lightning', -1, -1)!;
        item.charges = 10; game.player.inventory.addItem(item); game.executeItemCommand(mode === 'throw' ? 'throw' : 'use', item);
        const before = game.recordedInputEvents.length;
        expect(mode === 'throw' ? game.isThrowing : !!game.pendingArcana, 'target mode entered').toBe(true);
        expect(canSeeMonsterAt(game.player, game.grid, game.monsters[0]!, { x: 12, y: 11 }), 'public target').toBe(true);
        mouse('pointerup', 12, 11);
        expect(mode === 'throw' ? targetingState.aim : game.pendingArcana?.cursor, 'first aim').toEqual({ x: 12, y: 11 });
        mouse('pointerup', 14, 13);
        expect(mode === 'throw' ? game.isThrowing : !!game.pendingArcana).toBe(true);
        if (mode === 'throw') { expect(targetingState.aim).toEqual({ x: 14, y: 13 }); expect(game.recordedInputEvents).toHaveLength(before); }
        else { expect(game.pendingArcana?.cursor).toEqual({ x: 14, y: 13 }); expect(item.charges).toBe(10); }
        mouse('pointerup', 14, 13); expect(mode === 'throw' ? game.isThrowing : !!game.pendingArcana).toBe(false);
        if (mode === 'throw') expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]).toMatchObject({ action: 'mouse_travel', data: { x: 14, y: 13 } });
        else expect(item.charges).toBe(9);
    });
    it('GameCanvas mobile long press at the tail inspects the same creature without a command or RNG', async () => {
        await mount('../components/GameCanvas.vue'); const monster = game.monsters[0]!, before = rng.getState(), commands = game.recordedInputEvents.length;
        touch('pointerdown', 14, 13); await vi.advanceTimersByTimeAsync(500); touch('pointerup', 14, 13);
        expect(game.inspectTarget?.name).toBe(monster.name); expect(game.recordedInputEvents).toHaveLength(commands); expect(rng.getState()).toEqual(before);
    });
    it('GameCanvas renders old ACK body geometry, then clears the old group, hover and target on a frame reset', async () => {
        await mount('../components/GameCanvas.vue'); const monster = game.monsters[0]!;
        const t = new PresentationTimeline(game, logger); cleanups.push(() => t.dispose()); logger.presentAcknowledgments(() => true);
        mouse('pointermove', 14, 13); logger.log('old body', '#fff', { acknowledge: true }); draw();
        const instructions = JSON.stringify(geometry());
        commitCreatureAnchor(monster, { x: 20, y: 11 }); monster.hp = 7; observePresentation(game, 'command-complete'); draw();
        expect(JSON.stringify(geometry())).toBe(instructions);
        game.monsters = []; game.clearHover(); t.clear(); draw();
        expect(bodyGraphics().context.instructions).toHaveLength(0); expect(hoverGraphics().context.instructions).toHaveLength(0); expect(targetGraphics().context.instructions).toHaveLength(0);
    });
    it('GameCanvas real replay seek replaces the old body drawing and removes hover/throw focus', async () => {
        installRecordingScene(squareDisplayScene);
        game.startNewGame({ seed: 403004, mode: 'test' });
        game.executeCommand('wait'); const recording = game.exportRecording();
        await mount('../components/GameCanvas.vue');
        const t = new PresentationTimeline(game, logger); cleanups.push(() => t.dispose());
        expect(game.loadReplay(recording)).toBe(true);
        for (const index of [1, 0]) {
            game.hoveredCell = { x: 14, y: 13 }; targetingState.aim = { x: 14, y: 13 };
            commitCreatureAnchor(game.monsters[0]!, { x: 30, y: 12 }); draw(); const old = JSON.stringify(geometry());
            game.replaySeek(index); draw();
            expect(game.replayError).toBeNull(); expect(JSON.stringify(geometry())).not.toBe(old);
            expect(bodyGraphics().context.instructions).toHaveLength(2);
            expect(hoverGraphics().context.instructions).toHaveLength(0); expect(targetGraphics().context.instructions).toHaveLength(0);
            expect(game.hoveredCell).toBeNull(); expect(targetingState.aim).toBeNull();
        }
    });
    it('generic module HUD can consume historical public frame rows and respects existing D3/retirement gates', () => {
        const t = new PresentationTimeline(game, logger); cleanups.push(() => t.dispose()); logger.presentAcknowledgments(() => true);
        const dto = observeDisplayFrame(game, logger); logger.log('old HUD', '#fff', { acknowledge: true }); game.monsters[0]!.hp = 7;
        const sessionGame = { extensionRuntime: { manifest: { modules: [{ id: 'probe' }] } }, replayRecording: null };
        const host = { game: () => sessionGame, tick: Vue.ref(0), immersive: Vue.ref(false), canOpenPanel: () => true,
            beforeOpenPanel() {}, afterClosePanel() {}, isPresentationBusy: () => t.busy,
            readDisplayFrame: () => t.projection ?? observeDisplayFrame(game, logger) } as unknown as ModuleUiHost;
        const hud = Vue.ref<any>(null), scope = Vue.effectScope(); cleanups.push(() => scope.stop());
        const ui = scope.run(() => useModuleUi(host, [{ moduleId: 'probe', useSession: h => ({ hud,
            bar: Vue.ref(null), panel: Vue.ref(null), commands: Vue.ref([]), panelOpen: Vue.ref(false), close() {},
            refresh() { const row = h.readDisplayFrame!().rows[0]!; hud.value = { component: { render: () => null }, props: { row } }; },
        }) }]))!;
        ui.refresh(); expect(ui.hudSlots.value[0]?.props.row).toMatchObject({ name: dto.rows[0]?.name, hp: 300 });
        expect(ui.hudSlots.value[0]?.props.presentationHidden).toBe(true);
        t.acknowledge(t.acknowledgment!); ui.refresh(); expect(ui.hudSlots.value[0]?.props.row).toMatchObject({ hp: 7 });
        expect(ui.hudSlots.value[0]?.props.presentationHidden).toBe(false);
        const shell = readFileSync('src/App.vue', 'utf8'); expect(shell).toContain('readDisplayFrame: () => displayedFrame(activeGame) ?? observeDisplayFrame(activeGame, logger)');
    });
});
