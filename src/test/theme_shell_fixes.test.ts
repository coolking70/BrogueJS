import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRenderer, nextTick, type Component } from 'vue';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { createSfcHarness } from './support/sfcHarness';
import { computeMapCamera } from '../ui/mapCamera';
import { readMapOcclusions, observeMapOcclusions, unobstructedMapBand, type MapOcclusion } from '../ui/mapOcclusion';
import { DCOLS, DROWS } from '../types';
import { activeGame } from '../engine/Core/Game';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import '../i18n';

const tile = 16;
const base = (w: number, h: number) => {
    const scale = Math.min(1, w / (DCOLS * tile), h / (DROWS * tile));
    return { scaleX: scale, scaleY: scale, offsetX: (w - DCOLS * tile * scale) / 2,
        offsetY: (h - DROWS * tile * scale) / 2 };
};

describe('DESIGN-2 map presentation regressions', () => {
    it.each([[1280, 800], [1280, 410], [390, 844], [390, 430]])(
        'covers a %i×%i map viewport at the center and at every map edge', (w, h) => {
            for (const focus of [{ x: 40, y: 14 }, { x: 0, y: 0 }, { x: DCOLS - 1, y: DROWS - 1 }]) {
                const c = computeMapCamera(w, h, base(w, h), DCOLS, DROWS, tile, focus, 1,
                    { x: 0, y: 0 }, false, { fillViewport: true });
                expect(c.scaleX).toBe(c.scaleY);
                expect(c.offsetX).toBeLessThanOrEqual(1e-6);
                expect(c.offsetY).toBeLessThanOrEqual(1e-6);
                expect(c.offsetX + DCOLS * tile * c.scaleX).toBeGreaterThanOrEqual(w - 1e-6);
                expect(c.offsetY + DROWS * tile * c.scaleY).toBeGreaterThanOrEqual(h - 1e-6);
            }
        });

    it.each([[920, 640], [920, 480], [390, 530], [390, 300]])(
        'leaves three tiles around an edge player in a %i×%i padded viewport, including after resize', (w, h) => {
            for (const focus of [{ x: 0, y: 0 }, { x: DCOLS - 1, y: DROWS - 1 }]) {
                const c = computeMapCamera(w, h, base(w, h), DCOLS, DROWS, tile, focus, 2,
                    { x: 0, y: 0 }, true, { edgePaddingTiles: 3 });
                const px = c.offsetX + (focus.x + 0.5) * tile * c.scaleX;
                const py = c.offsetY + (focus.y + 0.5) * tile * c.scaleY;
                expect(Math.min(px, w - px)).toBeGreaterThanOrEqual(3 * tile * c.scaleX - 1e-6);
                expect(Math.min(py, h - py)).toBeGreaterThanOrEqual(3 * tile * c.scaleY - 1e-6);
                expect([c.panX, c.panY]).toEqual([0, 0]);
                const resized = computeMapCamera(w, h - 30, base(w, h - 30), DCOLS, DROWS, tile,
                    focus, 2, { x: c.panX, y: c.panY }, true, { edgePaddingTiles: 3 });
                const fresh = computeMapCamera(w, h - 30, base(w, h - 30), DCOLS, DROWS, tile,
                    focus, 2, { x: 0, y: 0 }, true, { edgePaddingTiles: 3 });
                expect(resized).toEqual(fresh);
            }
        });

    it('centers a codex player away from the edges and retains default full-map layouts', () => {
        const c = computeMapCamera(920, 640, base(920, 640), DCOLS, DROWS, tile,
            { x: 40, y: 14 }, 2, { x: 0, y: 0 }, false, { edgePaddingTiles: 3 });
        expect(c.offsetX + 40.5 * tile * c.scaleX).toBeCloseTo(460);
        expect(c.offsetY + 14.5 * tile * c.scaleY).toBeCloseTo(320);
        for (const [w, h] of [[920, 640], [1280, 800]]) {
            expect(computeMapCamera(w!, h!, base(w!, h!), DCOLS, DROWS, tile,
                { x: 78, y: 28 }, 1, { x: 0, y: 0 }, false))
                .toEqual({ ...base(w!, h!), follow: false, panX: 0, panY: 0 });
        }
    });

    it('keeps a compact full-width map readable when an expanded toolbar reduces its height', () => {
        const c = computeMapCamera(390, 220, base(390, 220), DCOLS, DROWS, tile,
            { x: 40, y: 14 }, 1, { x: 0, y: 0 }, true, { fillViewport: true });
        expect(c.scaleX * tile).toBeGreaterThanOrEqual(12);
        expect(c.offsetX).toBeLessThanOrEqual(0);
        expect(c.offsetY).toBeLessThanOrEqual(0);
        expect(c.offsetX + DCOLS * tile * c.scaleX).toBeGreaterThanOrEqual(390);
        expect(c.offsetY + DROWS * tile * c.scaleY).toBeGreaterThanOrEqual(220);
    });

    it.each([[1280, 800], [390, 844]])(
        'keeps an edge player and three adjacent rows clear of umbra overlays at %i×%i', (w, h) => {
            const occlusions: MapOcclusion[] = w === 1280 ? [
                { left: 12, right: 680, top: 12, bottom: 84 }, // HUD
                { left: 990, right: 1220, top: 12, bottom: 360 }, // nearby entities
                { left: 240, right: 1040, top: h - 82, bottom: h - 14 }, // dock
                { left: 16, right: 636, top: h - 154, bottom: h - 86 }, // log
                { left: 12, right: 190, top: h - 126, bottom: h - 86 }, // zoom
            ] : [
                { left: 8, right: w - 58, top: 8, bottom: 178 },
                { left: 8, right: w - 8, top: h - 76, bottom: h - 8 },
                { left: w - 152, right: w - 8, top: h - 224, bottom: h - 80 },
                { left: 10, right: w - 10, top: h - 338, bottom: h - 228 },
                { left: w - 48, right: w - 8, top: 64, bottom: 242 },
            ];
            for (const x of [0, 40, DCOLS - 1]) for (const y of [0, 14, DROWS - 2, DROWS - 1]) {
                const focus = { x, y };
                const c = computeMapCamera(w, h, base(w, h), DCOLS, DROWS, tile, focus, 1,
                    { x: 0, y: 0 }, true, { fillViewport: true, edgePaddingTiles: 3, occlusions });
                const size = tile * c.scaleX;
                const px = c.offsetX + (x + .5) * size, py = c.offsetY + (y + .5) * size;
                const band = unobstructedMapBand(h, px, 3.5 * size, occlusions);
                expect(Math.min(py - band.top, band.bottom - py)).toBeGreaterThanOrEqual(3.5 * size - 1e-6);
                expect(c.offsetX).toBeLessThanOrEqual(1e-6);
                expect(c.offsetX + DCOLS * size).toBeGreaterThanOrEqual(w - 1e-6);
                expect(c.follow).toBe(true);
                expect([c.panX, c.panY]).toEqual([0, 0]);
                // Floating panels changing height must not retain yesterday's automatic clamp as pan.
                const resizedOverlays = occlusions.map(r => ({ ...r, bottom: r.bottom + 12 }));
                const resized = computeMapCamera(w, h, base(w, h), DCOLS, DROWS, tile, focus, 1,
                    { x: c.panX, y: c.panY }, true, { fillViewport: true, edgePaddingTiles: 3, occlusions: resizedOverlays });
                const fresh = computeMapCamera(w, h, base(w, h), DCOLS, DROWS, tile, focus, 1,
                    { x: 0, y: 0 }, true, { fillViewport: true, edgePaddingTiles: 3, occlusions: resizedOverlays });
                expect(resized).toEqual(fresh);
            }
        });

    it('uses space below a landscape side dock rather than reserving its whole width', () => {
        const w = 844, h = 390;
        const occlusions: MapOcclusion[] = [
            { left: 6, right: 704, top: 6, bottom: 44 },
            { left: 718, right: 838, top: 58, bottom: 256 },
            { left: 568, right: 712, top: 240, bottom: 384 },
            { left: 8, right: 420, top: 344, bottom: 382 },
        ];
        const focus = { x: DCOLS - 1, y: DROWS - 2 };
        const c = computeMapCamera(w, h, base(w, h), DCOLS, DROWS, tile, focus, 1,
            { x: 0, y: 0 }, true, { fillViewport: true, edgePaddingTiles: 3, occlusions });
        const size = tile * c.scaleX, py = c.offsetY + (focus.y + .5) * size;
        expect(py - 256).toBeGreaterThanOrEqual(2.5 * size);
        expect(h - py).toBeGreaterThanOrEqual(2.5 * size);
        expect(c.offsetX + DCOLS * size).toBeCloseTo(w);
    });

    it('keeps the seed 12345 opening player clear of the floating dock without consuming RNG', () => {
        activeGame.startNewGame({ seed: '12345', mode: 'wizard' });
        const focus = activeGame.player.loc, w = 1280, h = 800;
        const occlusions = [
            { left: 12, right: 680, top: 12, bottom: 84 },
            { left: 990, right: 1220, top: 12, bottom: 360 },
            { left: 240, right: 1040, top: 718, bottom: 786 },
            { left: 16, right: 636, top: 646, bottom: 714 },
        ];
        const state = rng.getState();
        const c = computeMapCamera(w, h, base(w, h), DCOLS, DROWS, tile, focus, 1,
            { x: 0, y: 0 }, false, { fillViewport: true, edgePaddingTiles: 3, occlusions });
        const size = tile * c.scaleX;
        const px = c.offsetX + (focus.x + .5) * size, py = c.offsetY + (focus.y + .5) * size;
        for (const r of occlusions) {
            const intersectsX = r.right > px - 3.5 * size && r.left < px + 3.5 * size;
            if (intersectsX) expect(py + 3.5 * size <= r.top + 1e-6 || py - 3.5 * size >= r.bottom - 1e-6).toBe(true);
        }
        expect(c.follow).toBe(true); // map height equals viewport, but floating HUD still requires vertical movement
        expect(rng.getState()).toEqual(state);
    });

    it('merges overlapping occlusions and prefers a central gap when lengths tie', () => {
        expect(unobstructedMapBand(800, 500, 50, [
            { left: 0, right: 600, top: -20, bottom: 100 },
            { left: 0, right: 600, top: 60, bottom: 180 },
            { left: 0, right: 600, top: 680, bottom: 900 },
            { left: 700, right: 900, top: 0, bottom: 800 },
        ])).toEqual({ top: 180, bottom: 680 });
        expect(unobstructedMapBand(400, 500, 50, [
            { left: 0, right: 600, top: 100, bottom: 150 },
            { left: 0, right: 600, top: 250, bottom: 300 },
        ])).toEqual({ top: 150, bottom: 250 });
    });
});

describe('DESIGN-2 floating overlay geometry', () => {
    it('measures canvas-relative occlusions, ignores hidden/outside overlays and observes resize/mount/removal', () => {
        const previousResize = globalThis.ResizeObserver, previousMutation = globalThis.MutationObserver;
        const observe = vi.fn(), unobserve = vi.fn(), disconnectResize = vi.fn(), disconnectMutation = vi.fn();
        let onResize!: () => void, onMutation!: () => void;
        vi.stubGlobal('ResizeObserver', class {
            constructor(callback: () => void) { onResize = callback; }
            observe = observe; unobserve = unobserve; disconnect = disconnectResize;
        });
        vi.stubGlobal('MutationObserver', class {
            constructor(callback: () => void) { onMutation = callback; }
            observe() {} disconnect = disconnectMutation;
        });
        const hud = { getBoundingClientRect: () => ({ left: 22, right: 650, top: 84, bottom: 156 }) };
        const dock = { getBoundingClientRect: () => ({ left: 250, right: 1050, top: 790, bottom: 858 }) };
        const hidden = { getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
        const outside = { getBoundingClientRect: () => ({ left: 1400, right: 1450, top: 0, bottom: 300 }) };
        let elements = [hud, hidden, outside];
        const root = { querySelectorAll: () => elements };
        const canvas = { closest: () => root, getBoundingClientRect: () => ({ left: 10, top: 72, width: 1280, height: 800 }) } as unknown as HTMLElement;
        const changed = vi.fn();
        try {
            const stop = observeMapOcclusions(canvas, changed);
            expect(readMapOcclusions(canvas)).toEqual([{ left: 12, right: 640, top: 12, bottom: 84 }]);
            expect(observe).toHaveBeenCalledWith(hud);
            onResize(); expect(changed).toHaveBeenCalledOnce();
            elements = [dock, hidden];
            onMutation();
            expect(unobserve).toHaveBeenCalledWith(hud);
            expect(observe).toHaveBeenCalledWith(dock);
            expect(changed).toHaveBeenCalledTimes(2);
            expect(readMapOcclusions(canvas)).toEqual([{ left: 240, right: 1040, top: 718, bottom: 786 }]);
            stop();
            expect(disconnectResize).toHaveBeenCalledOnce(); expect(disconnectMutation).toHaveBeenCalledOnce();
        } finally {
            vi.stubGlobal('ResizeObserver', previousResize); vi.stubGlobal('MutationObserver', previousMutation);
        }
    });
});

// Vue's custom renderer runs the real components/lifecycles without a browser.
// CSS/Pixi screenshot QA remains separate.
interface Node {
    type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null;
    getBoundingClientRect(): { height: number }; blur(): void;
}
let measuredHeight = 72;
const node = (type: string, text = ''): Node => ({ type, text, props: {}, children: [], parent: null,
    getBoundingClientRect: () => ({ height: measuredHeight }), blur() {} });
const renderer = createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = parent;
        const i = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(i < 0 ? parent.children.length : i, 0, child);
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, text) => { n.text = text; },
    setElementText: (n, text) => { n.text = text; n.children = []; },
    parentNode: n => n.parent,
    nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _prev, value) => { n.props[key] = value; },
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const findClass = (root: Node, cls: string) => all(root).find(n => String(n.props.class).split(' ').includes(cls))!;
const mounted: Array<ReturnType<typeof renderer.createApp>> = [];
function mount(component: Component, props = {}) {
    const root = node('root');
    const app = renderer.createApp(component, props);
    app.use(I18NextVue, { i18next });
    app.mount(root); mounted.push(app);
    return root;
}
const css = new Map<string, string>();
let RadialCommands: Component;
let ThemeHud: Component;
let ThemeLog: Component;
beforeAll(async () => {
    vi.stubGlobal('window', {
        setInterval: (callback: () => void, ms: number) => globalThis.setInterval(callback, ms),
        clearInterval: (id: ReturnType<typeof setInterval>) => globalThis.clearInterval(id),
        addEventListener() {}, removeEventListener() {},
    });
    vi.stubGlobal('document', { activeElement: null, addEventListener() {}, removeEventListener() {},
        documentElement: { dataset: {}, style: {
            setProperty: (key: string, value: string) => css.set(key, value), removeProperty: (key: string) => css.delete(key),
        } } });
    vi.stubGlobal('ResizeObserver', class {
        observe() {} disconnect() {}
    });
    const harness = createSfcHarness({ baseURL: import.meta.url });
    ThemeHud = await harness.load('../components/theme/ThemeHud.vue');
    ThemeLog = await harness.load('../components/theme/ThemeLog.vue');
    RadialCommands = await harness.load('../components/theme/RadialCommands.vue');
});
afterEach(() => {
    for (const app of mounted.splice(0)) app.unmount();
    vi.useRealTimers();
});
afterAll(() => vi.unstubAllGlobals());

const displayedTurn = (root: Node) => text(all(findClass(root, 'th-turn')).find(n => n.type === 'b')!);

describe('DESIGN-2 live component regressions', () => {
    it('refreshes the visible log count when theme or panel props change without remounting', async () => {
        vi.useFakeTimers();
        logger.reset();
        for (const message of ['first', 'second', 'third']) logger.log(message);
        const lines = Vue.ref(1);
        const root = mount({ setup: () => () => Vue.h(ThemeLog, { lines: lines.value }) });
        await nextTick();
        const visibleLogs = () => all(root).filter(n => n.type === 'li').map(text);
        expect(visibleLogs()).toHaveLength(1);
        expect(visibleLogs()[0]).toContain('third');
        lines.value = 3; await nextTick();
        await vi.advanceTimersByTimeAsync(100);
        expect(visibleLogs()).toHaveLength(3);
        expect(visibleLogs()[2]).toContain('first');
        lines.value = 1; await nextTick();
        await vi.advanceTimersByTimeAsync(100);
        expect(visibleLogs()).toHaveLength(1);
    });

    it('updates displayed player turns without an HP change, uses the CE clock and polls without RNG consumption', async () => {
        vi.useFakeTimers();
        activeGame.startNewGame({ seed: '12345', mode: 'wizard' });
        const root = mount(ThemeHud);
        const hp = activeGame.player.hp;
        expect(displayedTurn(root)).toBe('0');
        for (let i = 1; i <= 3; i++) {
            activeGame.executeCommand('wait');
            await vi.advanceTimersByTimeAsync(100);
            expect(activeGame.player.hp).toBe(hp);
            expect(displayedTurn(root)).toBe(String(i));
        }
        activeGame.player.setStatusDuration('paralyzed', 2);
        activeGame.executeCommand('wait');
        await vi.advanceTimersByTimeAsync(100);
        expect(activeGame.stats.turns).toBeGreaterThan(logger.turn);
        expect(displayedTurn(root)).toBe(String(logger.turn));
        const state = rng.getState();
        await vi.advanceTimersByTimeAsync(400);
        expect(rng.getState()).toEqual(state);
    });

    it('executes a desktop radial command through dispatch exactly once and closes the ring', async () => {
        const { inputManager } = await import('../engine/Input');
        const command = vi.fn();
        inputManager.setCallback(command);
        const root = mount(RadialCommands);
        findClass(root, 'rc-hub').props.onPointerdown({ pointerId: 1, currentTarget: { setPointerCapture() {} } });
        await nextTick();
        const rest = all(root).find(n => n.props['data-radial-action'] === 'wait')!;
        expect(rest.props['aria-hidden']).toBe('false');
        rest.props.onClick(); await nextTick();
        expect(command).toHaveBeenCalledExactlyOnceWith('wait', undefined);
        expect(findClass(root, 'rc-hub').props['aria-expanded']).toBe(false);
    });
});
