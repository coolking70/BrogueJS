import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import * as translation from 'i18next-vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { parse, compileScript } from '@vue/compiler-sfc';
import ts from 'typescript';
import postcss from 'postcss';
import { readFileSync } from 'node:fs';
import zhCN from '../locales/zh_CN.json';
import species from '../data/monsters.json';
import { activeGame as game } from '../engine/Core/Game';
import { Monster, type MonsterData } from '../entities/Monster';
import { TerrainType as T } from '../engine/Map/Grid';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { sidebarEntityRows, type SidebarEntityRow } from '../engine/UI/MonsterSidebar';
import { nearbyDetail } from '../ui/nearbyInspection';
import { describeTerrain } from '../engine/UI/TerrainTextCatalog';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { displaySettings } from '../engine/Settings';

// Real client SFC scripts/templates/lifecycles, with a deterministic host instead
// of a browser. CSS/rectangle contracts below are not screenshot acceptance.
interface Node {
    type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null;
    rect: { top: number; right: number }; scrollTop: number; scrollHeight: number; isConnected: boolean;
    focus(): void; blur(): void; contains(target: Node): boolean; getBoundingClientRect(): object;
}
const doc = { activeElement: null as Node | null, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    querySelector: (_selector: string) => body, documentElement: { dataset: {}, style: { setProperty() {} } } };
const node = (type: string, text = ''): Node => Vue.markRaw({ type, text, props: {}, children: [], parent: null,
    rect: { top: 754, right: 1280 }, scrollTop: 999, scrollHeight: 138, isConnected: true,
    focus() { doc.activeElement = this; }, blur() { if (doc.activeElement === this) doc.activeElement = null; },
    contains(target) { return all(this).includes(target); }, getBoundingClientRect() { return this.rect; } });
const body = node('body');
const renderer = Vue.createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; child.isConnected = false; },
    setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _previous, value) => { n.props[key] = value; }, querySelector: () => body,
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const hasClass = (n: Node, cls: string) => String(n.props.class).split(' ').includes(cls);
const find = (root: Node, cls: string) => all(root).find(n => hasClass(n, cls))!;
const click = (n: Node) => n.props.onClick({ target: n, currentTarget: n, stopPropagation() {}, preventDefault() {} });
const source = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const shell = postcss.parse(source('assets/theme-shells.css'));
const layout = postcss.parse(source('assets/gameplay-layout.css'));
function declaration(css: postcss.Root, selector: string, property: string) {
    let value: string | undefined;
    css.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(property, d => { value = d.value; }); });
    return value;
}
const mounted: Array<ReturnType<typeof renderer.createApp>> = [];
function mount(component: Vue.Component, props = {}) {
    const root = node('root');
    const app = renderer.createApp(component, props); app.use(I18NextVue, { i18next });
    app.mount(root); mounted.push(app); return root;
}
async function tick() { await Vue.nextTick(); await Vue.nextTick(); }
let CommandBar: Vue.Component, Log: Vue.Component, Nearby: Vue.Component, Context: Vue.Component;
let Journal: Vue.Component, Drawer: Vue.Component, Detail: Vue.Component, App: Vue.Component;
let position!: (anchor: { top: number; right: number }, height: number,
    viewport: { width: number; height: number; left?: number; top?: number }) => { left: number; top: number; width: number; maxHeight: number };
let input: typeof import('../engine/Input').inputManager;
let viewport: typeof import('../ui/layout').viewport;
const resize = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
const win = { innerWidth: 1280, innerHeight: 800, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false }),
    setInterval: (callback: () => void, ms: number) => globalThis.setInterval(callback, ms),
    clearInterval: (id: ReturnType<typeof setInterval>) => globalThis.clearInterval(id), confirm: () => true };

beforeAll(async () => {
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc);
    vi.stubGlobal('ResizeObserver', class { observe = resize; unobserve = unobserve; disconnect = disconnect; });
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    const inputModule = await import('../engine/Input'); input = inputModule.inputManager;
    const layoutModule = await import('../ui/layout'); viewport = layoutModule.viewport;
    const modules: Record<string, unknown> = {
        vue: { ...Vue, Transition: { props: ['name'], setup: (_props: unknown, { slots }: any) => () => slots.default?.() } },
        'i18next-vue': translation, i18next: { default: i18next, __esModule: true },
        '../engine/Input': inputModule, '../engine/Core/Game': { activeGame: game },
        '../../engine/Core/Game': { activeGame: game },
        '../ui/commands': await import('../ui/commands'),
        '../../ui/useGameHud': await import('../ui/useGameHud'), '../ui/useGameHud': await import('../ui/useGameHud'),
        '../../ui/mapGlyph': await import('../ui/mapGlyph'),
        '../../engine/UI/MonsterSidebar': await import('../engine/UI/MonsterSidebar'),
        '../engine/UI/MonsterSidebar': await import('../engine/UI/MonsterSidebar'),
        '../ui/nearbyInspection': { nearbyDetail }, '../../ui/nearbyInspection': { nearbyDetail },
        '../../entities/Player': await import('../entities/Player'),
        '../engine/Systems/Logger': await import('../engine/Systems/Logger'),
        './engine/Settings': await import('../engine/Settings'), './engine/Input': inputModule,
        './engine/Core/Game': { activeGame: game }, './ui/layout': layoutModule,
        './engine/Core/SaveStorage': await import('../engine/Core/SaveStorage'),
        './ui/immersiveMode': await import('../ui/immersiveMode'), './ui/recordingExport': await import('../ui/recordingExport'),
    };
    function compile(file: string) {
        const { descriptor } = parse(source(file));
        const script = compileScript(descriptor, { id: file, inlineTemplate: true });
        const code = ts.transpileModule(script.content, { compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
        } }).outputText;
        const exports: any = {};
        new Function('require', 'exports', code)((key: string) => {
            if (!(key in modules)) throw new Error(`Unresolved UI-4 component import: ${key}`);
            return modules[key];
        }, exports);
        return exports;
    }
    const bar = compile('components/CommandBar.vue'); CommandBar = bar.default; position = bar.commandOverflowPosition;
    Log = compile('components/theme/ThemeLog.vue').default;
    Nearby = compile('components/theme/ThemeNearby.vue').default; Context = compile('components/ContextPanel.vue').default;
    Journal = compile('components/MessageJournal.vue').default; Drawer = compile('components/SideDrawer.vue').default;
    Detail = compile('components/DetailPanel.vue').default;
    const empty = { default: { render: () => null }, __esModule: true };
    for (const name of ['GameCanvas', 'MessageAcknowledgment', 'InventoryOverlay', 'GameEndOverlay', 'ReplayControls',
        'AgentControls', 'ReferenceOverlay', 'MapZoomControls', 'CommandBar', 'DPad', 'TargetBar']) modules[`./components/${name}.vue`] = empty;
    modules['./components/theme/RadialCommands.vue'] = empty;
    modules['./components/theme/ThemeNearby.vue'] = { default: Nearby, __esModule: true };
    modules['./components/theme/ThemeHud.vue'] = { default: compile('components/theme/ThemeHud.vue').default, __esModule: true };
    modules['./components/theme/ThemeLog.vue'] = { default: Log, __esModule: true };
    for (const [name, component] of [['ContextPanel', Context], ['MessageJournal', Journal], ['SideDrawer', Drawer], ['DetailPanel', Detail]] as const) {
        modules[`./components/${name}.vue`] = { default: component, __esModule: true };
    }
    modules['./components/MainMenu.vue'] = { default: Vue.defineComponent({ emits: ['new-game'], setup(_props, { emit }) {
        return () => Vue.h('start', { onClick: () => emit('new-game', { seed: 33005, mode: 'test' }) });
    } }), __esModule: true };
    App = compile('App.vue').default;
});
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-02T00:00:00Z'));
    game.startNewGame({ seed: 33005, mode: 'test' }); game.animationEnabled = false;
    game.monsters = []; game.dormantMonsters = []; game.items = []; logger.reset();
    game.hoveredText = ''; game.flavorText = '';
    displaySettings.immersiveMode = false; doc.activeElement = null;
    win.innerWidth = 1280; win.innerHeight = 800;
    doc.addEventListener.mockClear(); doc.removeEventListener.mockClear();
    win.addEventListener.mockClear(); win.removeEventListener.mockClear();
    input.setCallback(vi.fn()); input.setUnboundKeyCallback(vi.fn());
});
afterEach(() => {
    for (const app of mounted.splice(0)) app.unmount();
    body.children = []; displaySettings.immersiveMode = false;
    vi.useRealTimers(); vi.restoreAllMocks();
});
afterAll(() => vi.unstubAllGlobals());

function state() {
    return { snapshot: game.toSaveSnapshot(), rng: rng.getState(), events: structuredClone(game.recordedInputEvents),
        inspectTarget: game.inspectTarget, hoveredCell: game.hoveredCell, hoveredText: game.hoveredText,
        flavorText: game.flavorText, examined: [...game.examinedEntityIds], disturbed: game.disturbed };
}
function entities(): SidebarEntityRow[] {
    game.player.loc = { x: 10, y: 10 };
    for (let x = 10; x <= 13; x++) {
        game.grid.setTerrain(x, 10, T.FLOOR);
        const cell = game.grid.getCell(x, 10)!;
        cell.isVisible = cell.isExplored = cell.hasMemory = true; cell.isClairvoyantVisible = false;
    }
    const monster = new Monster(11, 10, species.find(m => m.id === 'rat')! as MonsterData);
    game.monsters.push(monster);
    game.items.push(ItemLoader.spawnFood('ration_of_food', 12, 10)!);
    game.grid.setTerrain(13, 10, T.STAIRS_DOWN);
    return sidebarEntityRows(game.player, game.grid, game.monsters, game.items, null, game.depth);
}

describe('UI-4 command popup', () => {
    it.each([[1280, 800], [768, 1024], [390, 844], [844, 390]])(
        'keeps the entire popup above More within %i×%i, including a high immersive dock', (width, height) => {
            for (const anchor of [{ top: height - 60, right: width }, { top: 104, right: width }]) {
                const p = position(anchor, 140, { width, height });
                const actualHeight = Math.min(140, p.maxHeight);
                expect(p.left).toBeGreaterThanOrEqual(8); expect(p.top).toBeGreaterThanOrEqual(8);
                expect(p.left + p.width).toBeLessThanOrEqual(width - 8);
                expect(p.top + actualHeight).toBe(anchor.top - 8);
                expect(p.top + actualHeight).toBeLessThanOrEqual(height - 8);
            }
        });
    it('uses the visual viewport offsets and clips a tall popup to available space', () => {
        const p = position({ top: 140, right: 370 }, 700, { width: 320, height: 400, left: 40, top: 30 });
        expect(p).toEqual({ left: 62, top: 38, width: 290, maxHeight: 94 });
        const narrow = position({ top: 250, right: 110 }, 140, { width: 220, height: 300 });
        expect(narrow.width).toBe(204); expect(narrow.left).toBe(8);
    });
    it('wires real button rectangles, resize, outside click and Escape, and removes listeners', async () => {
        const root = mount(CommandBar, { mode: 'desktop' });
        click(find(root, 'command-more')); await tick();
        expect(find(root, 'command-overflow').props.style).toMatchObject({ left: '982px', top: '606px', width: '290px', visibility: 'visible' });
        find(root, 'command-more').rect = { top: 300, right: 380 }; win.innerWidth = 390; win.innerHeight = 844;
        win.addEventListener.mock.calls.find(args => args[0] === 'resize')![1](); await tick();
        expect(find(root, 'command-overflow').props.style).toMatchObject({ left: '90px', top: '152px' });
        doc.addEventListener.mock.calls.find(args => args[0] === 'pointerdown')![1]({ target: root }); await tick();
        expect(find(root, 'command-overflow')).toBeUndefined();
        click(find(root, 'command-more')); await tick();
        (input as any).handleKeyDown({ key: 'Escape', target: null, stopImmediatePropagation() {} }); await tick();
        expect(find(root, 'command-overflow')).toBeUndefined();
        mounted.pop()!.unmount();
        expect(disconnect).toHaveBeenCalled();
        expect(doc.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
        expect(win.removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), true);
    });
    it('uses viewport positioning with a bounded scroll container rather than a parent percentage', () => {
        const selector = 'html[data-ui-concept=glyph] .command-overflow';
        expect(declaration(layout, selector, 'position')).toBe('fixed');
        expect(declaration(layout, selector, 'bottom')).toBe('auto');
        expect(declaration(layout, selector, 'box-sizing')).toBe('border-box');
        expect(declaration(layout, selector, 'overflow-y')).toBe('auto');
    });
});

describe('UI-4 log and journal', () => {
    it.each([false, true])('preserves the flavor node and fixed rows as text/messages change (singleLine=%s)', async singleLine => {
        const opened = vi.fn();
        const root = mount(Log, { lines: singleLine ? 1 : 3, singleLine, onOpenJournal: opened });
        await tick(); const flavor = find(root, 'tl-flavor'), section = find(root, 'theme-log');
        const styles = { ...section.props.style };
        for (const count of [0, 1, 3, 0]) {
            logger.reset(); for (let i = 0; i < count; i++) logger.log(`message ${i}`);
            game.flavorText = count % 2 ? 'a location description' : '';
            await vi.advanceTimersByTimeAsync(100);
            expect(find(root, 'tl-flavor')).toBe(flavor); expect(section.props.style).toEqual(styles);
            expect(flavor.props['aria-hidden']).toBe(singleLine && count > 0);
            const before = state(); click(section);
            expect(state()).toEqual(before);
        }
        expect(opened).toHaveBeenCalledTimes(4);
        const stopPropagation = vi.fn(); find(root, singleLine ? 'tl-open' : 'tl-head').props.onClick({ stopPropagation });
        expect(stopPropagation).toHaveBeenCalledOnce(); expect(opened).toHaveBeenCalledTimes(5);
    });
    it('fixes multiline row heights and overlays the single-line flavor/message in the same cell', () => {
        const base = 'html[data-ui-concept=glyph] .theme-log';
        expect(declaration(shell, base + ' .tl-lines', 'height')).toBe('calc(var(--log-lines,3) * 22px)');
        expect(declaration(shell, base + ' .tl-flavor', 'height')).toBe('25px');
        expect(declaration(shell, base + ' .tl-flavor.empty', 'visibility')).toBe('hidden');
        expect(declaration(shell, base + ' .tl-flavor.empty', 'display')).toBeUndefined();
        const single = 'html[data-ui-concept=glyph] .immersive-mode .theme-log.single-line';
        for (const cls of ['tl-lines', 'tl-flavor']) expect(declaration(shell, single + ' .' + cls, 'grid-area')).toBe('1/1');
        expect(declaration(shell, single + '.has-messages .tl-flavor', 'visibility')).toBe('hidden');
        expect(declaration(shell, 'html[data-ui-concept=glyph] .app-layout.theme-shell.immersive-mode>.area-log', 'height'))
            .toBe('calc(32px + env(safe-area-inset-bottom))');
        expect(source('components/theme/ThemeLog.vue')).not.toMatch(/<p\s+v-if/);
    });
    it('reopens at the newest message, keeps a scrolled reading position during polling and fits its drawer', async () => {
        const open = Vue.ref(false);
        mount({ setup: () => () => Vue.h(Drawer, { open: open.value, variant: 'journal', onClose: () => { open.value = false; } },
            () => Vue.h(Journal)) });
        for (const msg of ['first', 'middle', 'latest']) logger.log(msg);
        open.value = true; await tick();
        let entries = find(body, 'journal-entries');
        expect(entries.scrollTop).toBe(0); expect(text(find(entries, 'latest'))).toContain('latest');
        entries.scrollTop = 150; logger.log('new latest'); await vi.advanceTimersByTimeAsync(100);
        expect(entries.scrollTop).toBe(150);
        open.value = false; await tick(); open.value = true; await tick();
        entries = find(body, 'journal-entries'); expect(entries.scrollTop).toBe(0);
        expect(declaration(layout, '.message-journal', 'box-sizing')).toBe('border-box');
        expect(declaration(layout, '.journal-entries', 'overflow-y')).toBe('scroll');
        expect(declaration(layout, '.journal-entries', 'scrollbar-gutter')).toBe('stable');
        expect(declaration(layout, '.journal-entries', 'touch-action')).toBe('pan-y');
        expect(declaration(layout, '.journal-entries::-webkit-scrollbar', 'width')).toBe('12px');
        expect(declaration(layout, '.journal-entries::-webkit-scrollbar-thumb', 'background')).toBe('var(--th-dim)');
    });
    it.each(['Escape', 'outside', 'close'])('closes the existing journal drawer with %s without a game command', async method => {
        const open = Vue.ref(true), command = vi.fn(); input.setCallback(command);
        mount({ setup: () => () => Vue.h(Drawer, { open: open.value, variant: 'journal', onClose: () => { open.value = false; } }, () => Vue.h(Journal)) });
        await tick(); const before = state();
        if (method === 'Escape') (input as any).handleKeyDown({ key: 'Escape', target: null, preventDefault() {}, stopImmediatePropagation() {} });
        else click(find(body, method === 'outside' ? 'drawer-backdrop' : 'drawer-close'));
        await tick(); expect(open.value).toBe(false); expect(command).not.toHaveBeenCalled(); expect(state()).toEqual(before);
    });
});

describe('UI-4 panels and nearby inspection', () => {
    it('hides the redundant desktop button, retains compact/immersive toggles and opens the journal from its whole area', async () => {
        const root = mount(App); all(root).find(n => n.type === 'start')!.props.onClick(); await tick();
        expect(find(root, 'th-panel')).toBeUndefined();
        for (const immersive of [false, true]) for (const mode of ['desktop', 'portrait', 'landscape'] as const) {
            displaySettings.immersiveMode = immersive; viewport.mode = mode; await tick();
            const button = find(root, 'th-panel');
            if (mode === 'desktop' && !immersive) { expect(button).toBeUndefined(); continue; }
            expect(text(button)).toBe(zhCN['theme.panel']); const before = state();
            click(button); await tick(); expect(text(button)).toBe(zhCN['theme.panel_close']);
            expect(state()).toEqual(before); click(button); await tick();
        }
        const before = state(); click(find(root, 'theme-log')); await tick();
        expect(find(body, 'message-journal')).toBeDefined(); expect(state()).toEqual(before);
    });
    it.each(['monster', 'item', 'terrain'] as const)('opens the %s detail with no world, turn, recording or RNG change', kind => {
        const row = entities().find(row => row.kind === kind)!;
        expect(row).toBeDefined();
        let expected;
        if (kind !== 'terrain') {
            game.handleInspectAt(row.loc.x, row.loc.y); expected = game.inspectTarget; game.inspectTarget = null;
        } else expected = describeTerrain({ visible: { layers: game.grid.getCell(row.loc.x, row.loc.y)!.layers, atDungeonExit: game.depth === 1 } });
        const before = state(); const detail = nearbyDetail(game, row);
        expect(detail).toBeTruthy();
        if (kind === 'terrain') expect(detail?.name).toBe(expected && 'description' in expected ? expected.description : null);
        else expect(detail).toEqual(expected);
        expect(state()).toEqual(before);
    });
    it.each([false, true])('connects App sidebar/immersive entities to the existing detail overlay and restores focus on pointer close (immersive=%s)', async immersive => {
        const root = mount(App); all(root).find(n => n.type === 'start')!.props.onClick(); await tick();
        entities(); await vi.advanceTimersByTimeAsync(100);
        displaySettings.immersiveMode = immersive; await tick();
        if (immersive) { click(find(root, 'th-panel')); await tick(); }
        const button = all(root).find(n => n.type === 'button' && n.props['data-entity-kind'] === 'monster')!;
        const before = state();
        for (const method of ['close', 'outside']) {
            click(button); await tick(); expect(find(body, 'detail-panel')).toBeDefined();
            click(find(body, method === 'close' ? 'detail-close' : 'detail-overlay'));
            await tick(); expect(find(body, 'detail-panel')).toBeUndefined();
            expect(doc.activeElement).toBe(button); expect(state()).toEqual(before);
        }
    });
    it('rejects stale identities/positions, hidden cells and removed entities without leaking details', () => {
        const rows = entities();
        const monster = rows.find(row => row.kind === 'monster')!;
        game.monsters[0]!.loc.x++;
        expect(nearbyDetail(game, monster)).toBeNull();
        const item = rows.find(row => row.kind === 'item')!; game.items = [];
        expect(nearbyDetail(game, item)).toBeNull();
        const terrain = rows.find(row => row.kind === 'terrain')!;
        game.grid.getCell(terrain.loc.x, terrain.loc.y)!.isVisible = false;
        expect(nearbyDetail(game, terrain)).toBeNull();
        expect(nearbyDetail(game, { ...terrain, kind: 'terrain', id: 'another location' })).toBeNull();
    });
    it.each([false, true])('renders native entity buttons, isolates Enter, and restores focus after closing detail (drawer=%s)', async inDrawer => {
        const rows = entities(), displayed = Vue.ref<ReturnType<typeof nearbyDetail>>(null);
        const command = vi.fn(); input.setCallback(command);
        const list = () => Vue.h(inDrawer ? Context : Nearby, { onInspect: (detail: ReturnType<typeof nearbyDetail>) => { displayed.value = detail; } });
        const root = mount({ setup: () => () => [
            inDrawer ? Vue.h(Drawer, { open: true }, list) : list(),
            Vue.h(Detail, { displayDetail: displayed.value, onClose: () => { displayed.value = null; } }),
        ] });
        await tick();
        const scope = inDrawer ? body : root;
        for (const kind of ['monster', 'item', 'terrain']) {
            const row = rows.find(row => row.kind === kind)!;
            const button = all(scope).find(n => n.type === 'button' && n.props['data-entity-kind'] === kind && n.props['data-entity-id'] === row.id)!;
            expect(button.props.type).toBe('button');
            const before = state(), stopPropagation = vi.fn();
            button.focus(); button.props.onKeydown({ key: 'Enter', stopPropagation });
            expect(stopPropagation).toHaveBeenCalledOnce();
            // Native Enter on a button produces one click; the host drives that
            // native activation separately from the actual key isolation handler.
            click(button); await tick();
            expect(find(body, 'detail-name')).toBeDefined(); expect(doc.activeElement).toBe(find(body, 'detail-panel'));
            (input as any).handleKeyDown({ key: 's', target: null, stopImmediatePropagation() {} });
            (input as any).handleKeyDown({ key: 'Escape', target: null, preventDefault() {}, stopImmediatePropagation() {} });
            await tick(); expect(displayed.value).toBeNull(); expect(doc.activeElement).toBe(button);
            expect(command).not.toHaveBeenCalled(); expect(state()).toEqual(before);
        }
    });
});
