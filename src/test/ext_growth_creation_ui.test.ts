import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import * as translation from 'i18next-vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import postcss from 'postcss';
import { readFileSync } from 'node:fs';
import zhCN from '../locales/zh_CN.json';
import { Game, activeGame } from '../engine/Core/Game';
import { rng } from '../engine/Random';
import * as view from '../ext/modules/growth/view';
import { logger } from '../engine/Systems/Logger';
import { displaySettings } from '../engine/Settings';

interface Node {
    tag: string; tagName: string; type: string; text: string; value: string | number; selected: boolean; selectedIndex: number;
    props: Record<string, any>; children: Node[]; parent: Node | null; readonly options: Node[];
    listeners: Record<string, ((event: any) => void)[]>;
    addEventListener(name: string, listener: (event: any) => void): void; focus(): void; querySelectorAll(selector: string): Node[];
}
const node = (tag: string, text = ''): Node => Vue.markRaw<Node>({ tag, tagName: tag.toUpperCase(), type: '', text, value: '', selected: false, selectedIndex: -1,
    props: {}, children: [], parent: null, listeners: {}, get options() { return this.children.filter((child: Node) => child.tag === 'option'); },
    addEventListener(name, listener) { (this.listeners[name] ??= []).push(listener); }, focus() { doc.activeElement = this; }, querySelectorAll() { return all(this).filter(child => child.tag === 'button' && !child.props.disabled); } });
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const body = node('body'); let root = node('root');
const doc = { querySelector: () => all(root).find(n => String(n.props.class).split(' ').includes('game-view')) ?? body, activeElement: null as Node | null, documentElement: { dataset: {}, style: { setProperty() {} } } };
const renderer = Vue.createRenderer<Node, Node>({
    createElement: tag => node(tag), createText: value => node('#text', value), createComment: value => node('#comment', value),
    insert(child, parent, anchor) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, child); },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText(n, value) { n.text = value; }, setElementText(n, value) { n.text = value; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp(n, key, _old, value) { n.props[key] = value; if (key === 'type') n.type = value; if (key === 'value') n.value = value; }, querySelector: () => body,
});
const event = (n: Node, key = '') => ({ target: n, currentTarget: n, key, preventDefault: vi.fn(), stopPropagation: vi.fn(), stopImmediatePropagation: vi.fn() });
const click = (n: Node) => { expect(n).toBeTruthy(); if (!n.props.disabled) n.props.onClick?.(event(n)); };
const find = (key: string, value: string, scope = body) => all(scope).find(n => n.props[key] === value)!;
const button = (label: string, scope = root) => all(scope).find(n => n.tag === 'button' && text(n).includes(label))!;
async function tick() { await Vue.nextTick(); await Vue.nextTick(); }
let MainMenu: Vue.Component, App: Vue.Component, app: ReturnType<typeof renderer.createApp> | undefined;
let input: typeof import('../engine/Input')['inputManager'];
const source = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

beforeAll(async () => {
    vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900, addEventListener() {}, removeEventListener() {}, localStorage: { getItem: () => null, setItem() {} },
        setInterval: (fn: () => void, ms: number) => globalThis.setInterval(fn, ms), clearInterval: (id: ReturnType<typeof setInterval>) => globalThis.clearInterval(id) });
    vi.stubGlobal('document', doc);
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    input = (await import('../engine/Input')).inputManager;
    const empty = { default: { render: () => null }, __esModule: true };
    const modules: Record<string, unknown> = { vue: Vue, 'i18next-vue': translation, '../engine/Input': { inputManager: input }, '../../engine/Input': { inputManager: input },
        './MapTileLegend.vue': empty, './theme/TitleFx.vue': empty, '../ui/mapTiles': await import('../ui/mapTiles'),
        '../engine/Seed': await import('../engine/Seed'), '../engine/Settings': await import('../engine/Settings'), '../ext/modules/growth/view': view };
    const compile = (file: string) => {
        const script = compileScript(parse(source(file)).descriptor, { id: file, inlineTemplate: true });
        const code = ts.transpileModule(script.content, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
        const exports: any = {};
        new Function('require', 'exports', code)((key: string) => { if (!(key in modules)) throw new Error(`Missing creation SFC import: ${key}`); return modules[key]; }, exports);
        return exports.default;
    };
    modules['./growth/GrowthCreationPanel.vue'] = { default: compile('components/growth/GrowthCreationPanel.vue'), __esModule: true };
    MainMenu = compile('components/MainMenu.vue');
    Object.assign(modules, {
        i18next: { default: i18next, __esModule: true }, './engine/Settings': await import('../engine/Settings'),
        './engine/Input': { inputManager: input }, './engine/Systems/Logger': await import('../engine/Systems/Logger'),
        './engine/Core/Game': { activeGame }, './engine/Core/SaveStorage': await import('../engine/Core/SaveStorage'),
        './ui/layout': await import('../ui/layout'), './ui/immersiveMode': await import('../ui/immersiveMode'),
        './ui/recordingExport': await import('../ui/recordingExport'), './ui/heldInput': await import('../ui/heldInput'),
        './ui/useGrowthCharacter': await import('../ui/useGrowthCharacter'), './ext/modules/growth/view': view,
        './components/MainMenu.vue': { default: MainMenu, __esModule: true },
        './components/GameCanvas.vue': { default: { props: ['displayModalOpen'], setup: (props: any) => () => Vue.h('div', { 'data-canvas-modal': props.displayModalOpen }) }, __esModule: true },
    });
    for (const name of ['ContextPanel', 'MessageJournal', 'MessageAcknowledgment', 'InventoryOverlay', 'GameEndOverlay', 'ReplayControls', 'AgentControls', 'DetailPanel', 'ReferenceOverlay', 'MapZoomControls', 'SideDrawer', 'CommandBar', 'DPad', 'TargetBar']) modules[`./components/${name}.vue`] = empty;
    for (const name of ['ThemeHud', 'ThemeLog', 'ThemeNearby', 'RadialCommands']) modules[`./components/theme/${name}.vue`] = empty;
    modules['./components/growth/GrowthCharacterPanel.vue'] = empty;
    App = compile('App.vue');
});
afterEach(() => { app?.unmount(); app = undefined; root.children = []; body.children = []; input.setCallback(vi.fn()); vi.restoreAllMocks(); vi.useRealTimers(); displaySettings.immersiveMode = false; });
afterAll(() => vi.unstubAllGlobals());
async function mount() {
    vi.useFakeTimers();
    root = node('root'); const submitted = vi.fn();
    app = renderer.createApp(MainMenu, { inGame: false, hasSave: false, hasReplay: false, saveInfo: null, replayInfo: null, onNewGame: submitted }).use(I18NextVue, { i18next });
    app.mount(root); click(button(i18next.t('menu.actions.new_game'))); await tick();
    return submitted;
}
async function openExtended() {
    const select = find('data-testid', 'rule-set', root);
    for (const option of select.options) option.selected = option.value === 'extended';
    for (const listener of select.listeners.change!) listener(event(select));
    await tick(); click(button(i18next.t('title.begin'))); await tick();
}
// A deliberate single-step fixture waits for the presentation-only navigation lock.
async function next() { click(find('data-creation', 'next')); await tick(); vi.advanceTimersByTime(600); await tick(); }
async function summary() { await next(); await next(); await next(); }

describe('EXT-1e mounted new-game identity chooser', () => {
    it('keeps classic start free of extension factory calls and chooser DOM', async () => {
        const factory = vi.spyOn(view, 'loadGrowthCreationContext'), submitted = await mount();
        click(button(i18next.t('title.begin'))); await tick();
        expect(factory).not.toHaveBeenCalled(); expect(find('data-creation', 'submit')).toBeUndefined();
        expect(submitted).toHaveBeenCalledExactlyOnceWith({ seed: undefined, mode: 'normal' });
    });
    it('opens/cancels/reopens without creating a run, changing RNG or retaining an abandoned selection', async () => {
        const game = new Game(); game.startNewGame({ seed: '985', mode: 'test' });
        vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
        const state = game.toSaveSnapshot(), random = rng.getState(), execute = vi.spyOn(game, 'executeCommand'), start = vi.spyOn(game, 'startNewGame');
        const submitted = await mount(); await openExtended();
        click(find('data-select-identity', 'growth.profession.scout')); await tick();
        expect(find('data-select-identity', 'growth.profession.scout').props['aria-pressed']).toBe(true);
        click(find('data-creation', 'cancel')); await tick(); expect(find('data-creation', 'submit')).toBeUndefined();
        click(button(i18next.t('title.begin'))); await tick();
        expect(find('data-select-identity', 'growth.profession.guardian').props['aria-pressed']).toBe(true);
        expect(submitted).not.toHaveBeenCalled(); expect(start).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled();
        expect(game.toSaveSnapshot()).toEqual(state); expect(rng.getState()).toEqual(random);
    });
    it('uses real choice buttons, summary, stable navigation and exactly one selected creation command under double click', async () => {
        const submitted = await mount(); await openExtended();
        expect(all(body).filter(n => n.props['data-select-identity'])).toHaveLength(4);
        await next();
        const chosen = all(body).find(n => n.props['data-choice-attribute'] && text(n).includes('1'))!;
        const decrease = find('data-creation', 'decrease', chosen); click(decrease); await tick();
        expect(find('data-creation', 'next').props.disabled).toBe(true);
        const will = find('data-choice-attribute', 'growth.attribute.will'); click(find('data-creation', 'increase', will)); await tick();
        await next(); click(find('data-select-identity', 'growth.faith.path')); await tick();
        const nextButton = find('data-creation', 'next'); await next();
        expect(find('data-creation', 'next')).toBe(nextButton); expect(nextButton.props.disabled).toBe(true);
        expect(text(body)).toContain('寻路誓约'); expect(text(body)).toContain('首次到达深度 2–26');
        const start = find('data-creation', 'submit'); click(start); click(start); await tick(); click(start);
        expect(submitted).toHaveBeenCalledTimes(1);
        const payload = submitted.mock.calls[0]![0], command = JSON.parse(payload.initialCommands[0]);
        expect(command).toMatchObject({ module: 'growth', action: 'create-character', payload: { revision: 0, professionId: 'growth.profession.guardian', lineageId: 'growth.lineage.human', faithId: 'growth.faith.path', choices: [{ attributes: { 'growth.attribute.will': 1 } }] } });
        expect(start.props.disabled).toBe(true); expect(find('data-creation', 'cancel').props.disabled).toBe(true);
    });
    it('accepts one Next/Previous step per physical double-click and releases the shared lock without commands or RNG', async () => {
        const game = new Game(); game.startNewGame({ seed: '985', mode: 'test' });
        const submitted = await mount(); await openExtended();
        const snapshot = game.toSaveSnapshot(), random = rng.getState(), execute = vi.spyOn(game, 'executeCommand');
        const current = () => all(body).find(n => String(n.props.class).split(' ').includes('current'))!;
        const invoke = (button: Node, detail: number) => button.props.onClick({ ...event(button), detail });
        const forward = find('data-creation', 'next');
        invoke(forward, 1); invoke(forward, 2); await tick();
        expect(text(current())).toBe(i18next.t('ext.growth.view.identity.lineage'));
        expect(forward.props.disabled).toBe(true); expect(find('data-creation', 'previous').props.disabled).toBe(true);
        // Repeated callbacks across Vue updates, including the opposite direction,
        // cannot move again even when a test invokes disabled handlers directly.
        invoke(forward, 1); invoke(find('data-creation', 'previous'), 0); await tick();
        vi.advanceTimersByTime(599); await tick();
        expect(text(current())).toBe(i18next.t('ext.growth.view.identity.lineage')); expect(forward.props.disabled).toBe(true);
        vi.advanceTimersByTime(1); await tick(); expect(forward.props.disabled).toBe(false);
        invoke(forward, 2); await tick(); expect(text(current())).toBe(i18next.t('ext.growth.view.identity.lineage'));
        invoke(forward, 0); await tick(); expect(text(current())).toBe(i18next.t('ext.growth.view.identity.faith'));
        vi.advanceTimersByTime(600); await tick();
        const backward = find('data-creation', 'previous');
        invoke(backward, 1); invoke(backward, 2); await tick();
        expect(text(current())).toBe(i18next.t('ext.growth.view.identity.lineage'));
        vi.advanceTimersByTime(600); await tick(); invoke(backward, 0); await tick();
        expect(text(current())).toBe(i18next.t('ext.growth.view.identity.profession'));
        expect(submitted).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
        const after = game.toSaveSnapshot(); expect({ ...after, savedAt: snapshot.savedAt }).toEqual(snapshot);
    });
    it('clears navigation timers on cancel/unmount and reopens immediately without a stale lock', async () => {
        await mount(); await openExtended(); click(find('data-creation', 'next')); await tick();
        expect(vi.getTimerCount()).toBe(1);
        click(find('data-creation', 'cancel')); await tick(); expect(vi.getTimerCount()).toBe(0);
        click(button(i18next.t('title.begin'))); await tick(); expect(find('data-creation', 'next').props.disabled).toBe(false);
        click(find('data-creation', 'next')); await tick(); expect(vi.getTimerCount()).toBe(1);
        app!.unmount(); app = undefined; expect(vi.getTimerCount()).toBe(0);
    });
    it('recovers after repeated start rejection without losing the draft or permanently latching buttons', async () => {
        const submitted = await mount(); await openExtended(); await summary();
        for (let index = 0; index < 2; index++) {
            click(find('data-creation', 'submit')); await tick();
            expect(submitted).toHaveBeenCalledTimes(index + 1); submitted.mock.calls[index]![0].onRejected(); await tick();
            expect(find('data-creation', 'submit').props.disabled).toBe(false); expect(text(body)).toContain(i18next.t('ext.growth.creation.start_failed'));
        }
        click(find('data-creation', 'cancel')); await tick(); expect(find('data-creation', 'submit')).toBeUndefined();
    });
    it('isolates keys and Escape from the map, closes only the chooser, and restores menu focus', async () => {
        const submitted = await mount(); await openExtended(); const action = vi.fn(); input.setCallback(action);
        for (const key of ['ArrowUp', 'x', '`', 'i']) (input as any).handleKeyDown(event(doc.activeElement!, key));
        expect(action).not.toHaveBeenCalled(); expect(submitted).not.toHaveBeenCalled();
        for (let index = 0; index < 18; index++) {
            const tab = event(doc.activeElement!, 'Tab'); (input as any).handleKeyDown(tab);
            expect(tab.preventDefault).toHaveBeenCalled(); expect(all(body)).toContain(doc.activeElement);
        }
        expect(all(root).find(n => String(n.props.class).includes('title-screen'))!.props.inert).toBe(true);
        (input as any).handleKeyDown(event(doc.activeElement!, 'Escape')); await tick();
        expect(find('data-creation', 'submit')).toBeUndefined(); expect(find('data-testid', 'rule-set', root)).toBeTruthy();
        expect(doc.activeElement?.props.class).toContain('title-screen');
    });
    it('absorbs a selected-start double-click transition for 600ms without simulation/RNG or keyboard dispatch, then restores focus', async () => {
        vi.useFakeTimers(); root = node('root');
        app = renderer.createApp(App).use(I18NextVue, { i18next }); app.mount(root);
        click(button(i18next.t('menu.actions.new_game'))); await tick();
        const mode = all(root).filter(n => n.tag === 'select')[1]!; mode.props['onUpdate:modelValue']('test'); await tick();
        await openExtended(); await summary(); click(find('data-creation', 'submit')); await tick();
        const shield = find('data-testid', 'creation-transition', root); expect(shield).toBeTruthy();
        expect(all(root).find(n => 'data-canvas-modal' in n.props)!.props['data-canvas-modal']).toBe(true);
        const action = vi.fn(), execute = vi.spyOn(activeGame, 'executeCommand'); input.setCallback(action);
        vi.spyOn(Date, 'now').mockReturnValue(1800000000000);
        const before = activeGame.toSaveSnapshot(), random = rng.getState(), recorded = activeGame.recordedInputEvents.length;
        const canvas = all(root).find(n => 'data-canvas-modal' in n.props)!;
        const canvasSource = source('components/GameCanvas.vue'), begin = canvasSource.indexOf('    let pathingTimer = 0;'), end = canvasSource.indexOf('    const resetDisplayClock =', begin);
        const loopCode = ts.transpileModule(canvasSource.slice(begin, end), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
        const frame = new Function('game', 'props', 'logger', 'syncHeldInputContext', 'renders', 'render', 'frameProfile', 'document', `${loopCode}; return displayFrame;`)
            (activeGame, { get displayModalOpen() { return canvas.props['data-canvas-modal']; } }, logger, () => {}, { flush: (paint: () => void) => paint() }, () => {}, null, { hidden: false });
        for (let index = 0; index < 20; index++) frame(30, 30);
        const pointer = event(shield); shield.props.onPointerup(pointer);
        expect(pointer.preventDefault).toHaveBeenCalled(); expect(pointer.stopPropagation).toHaveBeenCalled();
        for (const key of ['ArrowUp', 'x', '`', 'Enter']) (input as any).handleKeyDown(event(shield, key));
        vi.advanceTimersByTime(599); await tick();
        expect(action).not.toHaveBeenCalled(); expect(execute).not.toHaveBeenCalled(); expect(find('data-testid', 'creation-transition', root)).toBeTruthy();
        expect(activeGame.recordedInputEvents).toHaveLength(recorded); expect(activeGame.toSaveSnapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
        vi.advanceTimersByTime(1); await tick();
        expect(find('data-testid', 'creation-transition', root)).toBeUndefined();
        expect(all(root).find(n => 'data-canvas-modal' in n.props)!.props['data-canvas-modal']).toBe(false);
        expect(String(doc.activeElement?.props.class)).toContain('game-view');
        (input as any).handleKeyDown(event(doc.activeElement!, 'ArrowUp')); expect(action).toHaveBeenCalledTimes(1);
    });
    it('disposes the selected-start shield timer and keyboard owner on App unmount', async () => {
        vi.useFakeTimers(); root = node('root'); app = renderer.createApp(App).use(I18NextVue, { i18next }); app.mount(root);
        click(button(i18next.t('menu.actions.new_game'))); await tick();
        all(root).filter(n => n.tag === 'select')[1]!.props['onUpdate:modelValue']('test'); await tick();
        await openExtended(); await summary(); click(find('data-creation', 'submit')); await tick();
        expect(find('data-testid', 'creation-transition', root)).toBeTruthy();
        app.unmount(); app = undefined; const action = vi.fn(); input.setCallback(action);
        (input as any).handleKeyDown(event(root, 'ArrowUp')); expect(action).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });
    it.each([false, true])('retains independently scrolling content and reachable fixed actions in ordinary/immersive mode=%s', async immersive => {
        displaySettings.immersiveMode = immersive; await mount(); await openExtended(); await summary();
        expect(find('data-creation', 'submit').props.disabled).toBe(false);
        const styles = parse(source('components/growth/GrowthCreationPanel.vue')).descriptor.styles;
        const css = styles.map(style => { const compiled = compileStyle({ source: style.content, filename: 'GrowthCreationPanel.vue', id: 'creation-test', scoped: true }); expect(compiled.errors).toEqual([]); return compiled.code; }).join('\n');
        const ast = postcss.parse(css), rule = (selector: string) => ast.nodes.filter(node => node.type === 'rule' && node.selector.startsWith(selector)).map(node => node.toString()).join('\n');
        expect(rule('.growth-creation-body')).toContain('overflow:auto'); expect(rule('.growth-creation-panel')).toContain('height:min(820px,calc(100dvh - 48px))');
        expect(rule('.growth-creation-body')).toContain('flex:1');
        expect(rule('.growth-creation-footer')).toContain('flex-shrink:0');
        const media: string[] = []; ast.walkAtRules('media', entry => { media.push(entry.params); });
        expect(media).toContain('(max-width:600px)'); expect(media).toContain('(max-width:350px)');
        // Pixel dimensions/real scroll gestures at 1440x900, 390x844 and 320x844 require separate browser verification.
    });
});
