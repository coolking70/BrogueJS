import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import * as translation from 'i18next-vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { parse, compileScript } from '@vue/compiler-sfc';
import ts from 'typescript';
import postcss from 'postcss';
import { readFileSync } from 'node:fs';
import { computeMapCamera } from '../ui/mapCamera';
import { observeMapOcclusions, readMapOcclusions, unobstructedMapBand, type MapOcclusion } from '../ui/mapOcclusion';
import { displaySettings } from '../engine/Settings';
import { activeGame } from '../engine/Core/Game';
import { rng } from '../engine/Random';
import { viewport } from '../ui/layout';
import { DCOLS, DROWS, Direction } from '../types';
import { logger } from '../engine/Systems/Logger';
import '../i18n';

const source = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const tile = 16;
const base = (w: number, h: number) => {
    const scale = Math.min(1, w / (DCOLS * tile), h / (DROWS * tile));
    return { scaleX: scale, scaleY: scale, offsetX: (w - DCOLS * tile * scale) / 2,
        offsetY: (h - DROWS * tile * scale) / 2 };
};
// Canvas-relative geometry fixtures: HUD/log occupy separate rows; open ring buttons
// use their transformed bounds, including the buttons outside the hub's 60px box.
function controls(w: number, h: number, touch: boolean, landscape: boolean, open: boolean): MapOcclusion[] {
    const result: MapOcclusion[] = [landscape
        ? { left: 8, right: 196, top: 8, bottom: 52 }
        : { left: w - 52, right: w - 8, top: 8, bottom: 196 }];
    if (touch) result.push({ left: 8, right: 168, top: h - 168, bottom: h - 8 });
    const inset = open ? (touch ? 84 : 106) : 14;
    const cx = w - inset - 30, cy = h - inset - 30;
    result.push({ left: cx - 30, right: cx + 30, top: cy - 30, bottom: cy + 30 });
    if (open) for (let i = 0; i < 8; i++) {
        const angle = (-90 + i * 45) * Math.PI / 180;
        const radius = touch ? 80 : 92, half = touch ? 24 : 26;
        const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
        result.push({ left: x - half, right: x + half, top: y - half, bottom: y + half });
    }
    return result;
}

describe('DESIGN-3b immersive camera and measured overlays', () => {
    it.each([[1280, 800], [768, 1024], [390, 844], [844, 390]])(
        'fills %i×%i without horizontal bars and protects two neighboring rows from pad/ring/zoom', (w, h) => {
            const touch = w < 1024, landscape = w > h;
            const mapH = h - (touch ? 52 : 40) - 32;
            const state = rng.getState();
            for (const open of [false, true]) {
                const occlusions = controls(w, mapH, touch, landscape, open);
                for (const x of [0, 40, DCOLS - 1]) for (const y of [0, 14, DROWS - 1]) {
                    const c = computeMapCamera(w, mapH, base(w, mapH), DCOLS, DROWS, tile,
                        { x, y }, 1, { x: 0, y: 0 }, touch,
                        { fillViewport: true, edgePaddingTiles: 2, occlusions });
                    const size = c.scaleX * tile;
                    const px = c.offsetX + (x + .5) * size, py = c.offsetY + (y + .5) * size;
                    const band = unobstructedMapBand(mapH, px, 2.5 * size, occlusions);
                    expect(c.scaleX).toBe(c.scaleY);
                    expect(c.offsetX).toBeLessThanOrEqual(1e-6);
                    expect(c.offsetX + DCOLS * size).toBeGreaterThanOrEqual(w - 1e-6);
                    expect(Math.min(py - band.top, band.bottom - py)).toBeGreaterThanOrEqual(2.5 * size - 1e-6);
                    expect([c.panX, c.panY]).toEqual([0, 0]);
                    if (touch) expect(size).toBeGreaterThanOrEqual(12);
                }
            }
            expect(rng.getState()).toEqual(state);
        });

    it('observes ring class changes, measures its expanded buttons and disconnects both observers', () => {
        let changed!: () => void;
        const mutationObserve = vi.fn(), disconnectResize = vi.fn(), disconnectMutation = vi.fn();
        vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect = disconnectResize; });
        vi.stubGlobal('MutationObserver', class {
            constructor(callback: () => void) { changed = callback; }
            observe = mutationObserve; disconnect = disconnectMutation;
        });
        const hub = { getBoundingClientRect: () => ({ left: 310, right: 370, top: 740, bottom: 800 }) };
        const item = { getBoundingClientRect: () => ({ left: 182, right: 230, top: 622, bottom: 670 }) };
        let open = false;
        const root = { querySelectorAll: (selector: string) => {
            expect(selector).toContain('.area-radial.open .rc-item');
            return open ? [hub, item] : [hub];
        } };
        const canvas = { closest: () => root, getBoundingClientRect: () => ({ left: 0, top: 52, width: 390, height: 760 }) } as unknown as HTMLElement;
        const onChange = vi.fn();
        const stop = observeMapOcclusions(canvas, onChange);
        expect(mutationObserve).toHaveBeenCalledWith(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        expect(readMapOcclusions(canvas)).toHaveLength(1);
        open = true; changed();
        expect(onChange).toHaveBeenCalledOnce();
        expect(readMapOcclusions(canvas)).toContainEqual({ left: 182, right: 230, top: 570, bottom: 618 });
        stop(); expect(disconnectResize).toHaveBeenCalledOnce(); expect(disconnectMutation).toHaveBeenCalledOnce();
    });

    it('wires immersive-only covering/observation and keeps the default desktop layout exact', () => {
        const canvas = source('components/GameCanvas.vue');
        expect(canvas).toContain('fillViewport: displaySettings.immersiveMode');
        expect(canvas).toContain('occlusions: displaySettings.immersiveMode ? readMapOcclusions(el) : undefined');
        expect(canvas).toContain('stopImmersiveWatch = watch(() => displaySettings.immersiveMode');
        expect(canvas).toContain('removeOcclusionObserver?.()');
        for (const size of [[920, 640], [1280, 800]]) {
            const [w, h] = size as [number, number];
            expect(computeMapCamera(w, h, base(w, h), DCOLS, DROWS, tile,
                { x: 78, y: 28 }, 1, { x: 0, y: 0 }, false, { fillViewport: false, edgePaddingTiles: 0 }))
                .toEqual({ ...base(w, h), follow: false, panX: 0, panY: 0 });
        }
    });
});

// Exercise production Vue scripts, events and lifecycles with a custom renderer.
// Geometry/CSS assertions are structural evidence; screenshot acceptance remains external.
interface Node {
    type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null;
    value: unknown; _value: unknown; options: Node[]; selectedIndex: number;
    focus(): void; blur(): void; addEventListener(): void;
}
const node = (type: string, text = ''): Node => ({ type, text, props: {}, children: [], parent: null,
    value: '', _value: '', selectedIndex: -1, get options() { return this.children.filter(n => n.type === 'option'); },
    focus() {}, blur() {}, addEventListener() {} });
const renderer = Vue.createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = parent;
        const i = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(i < 0 ? parent.children.length : i, 0, child);
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _previous, value) => {
        n.props[key] = value;
        if (key === 'value') { n.value = value; n._value = value; }
    },
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const hasClass = (n: Node, cls: string) => String(n.props.class).split(' ').includes(cls);
const find = (root: Node, cls: string) => all(root).find(n => hasClass(n, cls))!;
const mounted: Array<ReturnType<typeof renderer.createApp>> = [];
function mount(component: Vue.Component, props = {}) {
    const root = node('root');
    const app = renderer.createApp(component, props);
    app.use(I18NextVue, { i18next }); app.mount(root); mounted.push(app);
    return root;
}
let Menu: Vue.Component, Log: Vue.Component, Pad: Vue.Component, App: Vue.Component;
let canvasMounts = 0;
beforeAll(async () => {
    const storage = { getItem: () => null, setItem() {} };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { innerWidth: 390, innerHeight: 844, localStorage: storage,
        matchMedia: () => ({ matches: false }), location: { search: '', href: 'https://brogue.test/' },
        addEventListener() {}, removeEventListener() {}, confirm: () => true,
        setInterval: (callback: () => void, ms: number) => globalThis.setInterval(callback, ms),
        clearInterval: (id: ReturnType<typeof setInterval>) => globalThis.clearInterval(id),
        setTimeout: (callback: () => void, ms: number) => globalThis.setTimeout(callback, ms),
        clearTimeout: (id: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(id),
    });
    vi.stubGlobal('document', { activeElement: null, addEventListener() {}, removeEventListener() {},
        documentElement: { dataset: {}, style: { setProperty() {} } } });
    const empty = { default: { render: () => null }, __esModule: true };
    const modules: Record<string, unknown> = {
        vue: Vue, 'i18next-vue': translation, i18next: { default: i18next, __esModule: true },
        '../engine/Input': await import('../engine/Input'), './engine/Input': await import('../engine/Input'),
        '../engine/Settings': await import('../engine/Settings'), './engine/Settings': await import('../engine/Settings'),
        '../engine/Seed': await import('../engine/Seed'), '../ui/mapTiles': await import('../ui/mapTiles'),
        '../../ui/useGameHud': await import('../ui/useGameHud'), '../ui/commands': await import('../ui/commands'),
        '../types': await import('../types'), './ui/layout': await import('../ui/layout'),
        './ui/immersiveMode': await import('../ui/immersiveMode'), './ui/recordingExport': await import('../ui/recordingExport'),
        './engine/Core/Game': await import('../engine/Core/Game'), './engine/Core/SaveStorage': await import('../engine/Core/SaveStorage'),
        './MapTileLegend.vue': { default: { emits: ['close'], render: () => Vue.h('section', { class: 'map-legend' }) }, __esModule: true },
        './theme/TitleFx.vue': empty,
    };
    const compile = (file: string): Vue.Component => {
        const { descriptor } = parse(source(file));
        const script = compileScript(descriptor, { id: file, inlineTemplate: true });
        const code = ts.transpileModule(script.content, { compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
        } }).outputText;
        const exports: any = {};
        new Function('require', 'exports', code)((key: string) => {
            if (!(key in modules)) throw new Error(`Unresolved component import: ${key}`);
            return modules[key];
        }, exports);
        return exports.default;
    };
    Menu = compile('components/MainMenu.vue'); Log = compile('components/theme/ThemeLog.vue'); Pad = compile('components/DPad.vue');
    for (const component of ['ContextPanel', 'MessageJournal', 'MessageAcknowledgment', 'InventoryOverlay', 'GameEndOverlay',
        'ReplayControls', 'AgentControls', 'DetailPanel', 'ReferenceOverlay', 'MapZoomControls', 'SideDrawer', 'CommandBar', 'TargetBar']) {
        modules[`./components/${component}.vue`] = empty;
    }
    modules['./components/DPad.vue'] = { default: Pad, __esModule: true };
    modules['./components/GameCanvas.vue'] = { default: { setup() { canvasMounts++; return () => Vue.h('canvas'); } }, __esModule: true };
    modules['./components/MainMenu.vue'] = { default: { emits: ['new-game'], setup(_props: unknown, { emit }: any) {
        return () => Vue.h('button', { class: 'start-fixture', onClick: () => emit('new-game', { seed: '12345', mode: 'wizard' }) });
    } }, __esModule: true };
    for (const component of ['ThemeHud', 'ThemeNearby', 'RadialCommands']) modules[`./components/theme/${component}.vue`] = empty;
    modules['./components/theme/ThemeLog.vue'] = { default: Log, __esModule: true };
    App = compile('App.vue');
});
afterEach(() => {
    for (const app of mounted.splice(0)) app.unmount();
    displaySettings.immersiveMode = false;
    vi.useRealTimers(); vi.restoreAllMocks();
});
afterAll(() => vi.unstubAllGlobals());

describe('DESIGN-3b live display entry points', () => {
    it('shows a pad in compact immersive view even with a fine pointer, survives rotation/toggle, and hides it in replay', async () => {
        vi.useFakeTimers();
        displaySettings.immersiveMode = true;
        viewport.mode = 'portrait'; viewport.coarsePointer = false;
        const beforeMounts = canvasMounts;
        const root = mount(App);
        find(root, 'start-fixture').props.onClick(); await Vue.nextTick();
        expect(all(root).filter(n => hasClass(n, 'dpad'))).toHaveLength(1);
        const state = rng.getState(), commands = [...activeGame.recordedInputEvents];
        viewport.mode = 'landscape'; await Vue.nextTick();
        expect(find(root, 'dpad').props.class).toContain('pad-landscape');
        displaySettings.immersiveMode = false; await Vue.nextTick();
        expect(all(root).some(n => hasClass(n, 'dpad'))).toBe(false);
        viewport.coarsePointer = true; await Vue.nextTick();
        expect(all(root).filter(n => hasClass(n, 'dpad'))).toHaveLength(1);
        displaySettings.immersiveMode = true; await Vue.nextTick();
        expect(canvasMounts - beforeMounts).toBe(1);
        expect(rng.getState()).toEqual(state); expect(activeGame.recordedInputEvents).toEqual(commands);
        activeGame.replayRecording = activeGame.exportRecording();
        await vi.advanceTimersByTimeAsync(100);
        expect(all(root).some(n => hasClass(n, 'dpad'))).toBe(false);
        activeGame.replayRecording = null;
    });

    it('routes an immersive pad press through the command recorder exactly once', async () => {
        const { inputManager } = await import('../engine/Input');
        activeGame.startNewGame({ seed: '12345', mode: 'wizard' });
        inputManager.setCallback((action, data) => activeGame.handlePlayerAction(action, data));
        const before = activeGame.recordedInputEvents.length;
        const root = mount(Pad, { mode: 'portrait' });
        const right = all(root).find(n => n.type === 'button' && text(n) === '→')!;
        right.props.onPointerdown({ preventDefault() {} }); right.props.onPointerup();
        right.props.onClick({ detail: 1 });
        expect(activeGame.recordedInputEvents.slice(before)).toMatchObject([{ action: 'move', data: Direction.RIGHT }]);
    });

    it('keeps messages at one line, uses flavor only before a message, and opens the full journal', async () => {
        vi.useFakeTimers(); logger.reset(); activeGame.flavorText = 'opening flavor'; activeGame.hoveredText = '';
        const journal = vi.fn();
        const root = mount(Log, { lines: 1, singleLine: true, onOpenJournal: journal });
        await Vue.nextTick();
        expect(text(find(root, 'tl-flavor'))).toBe('opening flavor');
        logger.log('latest message'); await vi.advanceTimersByTimeAsync(100);
        // UI-4 keeps the flavor's fixed slot while the message covers it.
        // Visibility still switches to the message; DOM removal was an old premise.
        expect(find(root, 'tl-flavor').props['aria-hidden']).toBe(true);
        expect(all(root).filter(n => n.type === 'li').map(text)).toEqual([expect.stringContaining('latest message')]);
        find(root, 'tl-open').props.onClick(); expect(journal).toHaveBeenCalledOnce();
    });

    it('opens/closes the normal settings legend entry without replacing the brand and keeps Escape priority', async () => {
        const root = mount(Menu, { hasSave: false, hasReplay: false, inGame: false, saveInfo: null, replayInfo: null });
        all(root).find(n => n.type === 'button' && text(n).includes(i18next.t('title.settings')))!.props.onClick();
        await Vue.nextTick(); await Vue.nextTick();
        const brand = find(root, 'title-brand');
        expect(find(root, 'menu-overlay').props.class).toContain('settings-open');
        expect(find(root, 'menu-card').props.class).toContain('settings-card');
        expect(text(find(root, 'legend-field'))).toBe(i18next.t('map.legend') + i18next.t('map.legend_view'));
        find(root, 'legend-button').props.onClick(); await Vue.nextTick();
        expect(find(root, 'legend-button').props['aria-expanded']).toBe(true);
        expect(find(root, 'map-legend')).toBeTruthy(); expect(find(root, 'title-brand')).toBe(brand);
        const escape = () => {
            const event = { key: 'Escape', preventDefault() {}, stopPropagation() {} };
            for (const handler of find(root, 'menu-overlay').props.onKeydown) handler(event);
        };
        escape(); await Vue.nextTick();
        expect(all(root).some(n => hasClass(n, 'map-legend'))).toBe(false);
        expect(find(root, 'menu-card')).toBeTruthy(); expect(find(root, 'title-brand')).toBe(brand);
        find(root, 'legend-button').props.onClick(); await Vue.nextTick();
        find(root, 'legend-button').props.onClick(); await Vue.nextTick();
        expect(all(root).some(n => hasClass(n, 'map-legend'))).toBe(false);
        expect(find(root, 'title-brand')).toBe(brand);
        escape(); await Vue.nextTick();
        expect(all(root).some(n => hasClass(n, 'settings-card'))).toBe(false);
    });

    it('keeps compact labels, a 32px log row, visible pad and independently scrolling settings in the CSS contract', () => {
        const css = postcss.parse(source('assets/theme-shells.css'));
        const declarations = (selector: string) => {
            const values: Record<string, string> = {};
            css.walkRules(rule => { if (rule.selectors.includes(selector)) rule.walkDecls(d => { values[d.prop] = d.value; }); });
            return values;
        };
        const root = 'html[data-ui-concept=glyph] .app-layout.theme-shell.immersive-mode';
        expect(declarations(root + '>.area-pad')).toMatchObject({ display: 'grid', 'grid-area': 'map' });
        expect(declarations(root + '>.area-log')).toMatchObject({ height: 'calc(32px + env(safe-area-inset-bottom))', 'min-height': '0', 'text-align': 'left' });
        expect(source('assets/theme-shells.css')).not.toMatch(/immersive-mode[^{}]*\.th-label\{display:none/);
        expect(source('assets/title-screen.css')).toContain('.settings-open .title-brand{align-self:flex-start}');
        expect(source('assets/title-screen.css')).toContain('overflow-y:auto;scrollbar-gutter:stable');
        expect(source('assets/title-screen.css')).toContain('.menu-card .legend-button{align-self:flex-start;min-height:44px');
        const app = parse(source('App.vue')).descriptor.template!.content;
        expect(app.indexOf('<RadialCommands')).toBeGreaterThan(app.indexOf('<div class="map-area">'));
        expect(app.indexOf('<RadialCommands')).toBeLessThan(app.indexOf('<TargetBar'));
    });
});
