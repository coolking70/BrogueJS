import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import * as translation from 'i18next-vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import zhCN from '../locales/zh_CN.json';
import type { ModuleCreationPlan } from '../ext/ui/creation';
import type { ExtensionModule } from '../ext/types';

// Foundation-owned MainMenu behavior, tested with synthetic installed modules.
// This renderer and its catalog/creation fixtures have no concrete module imports.
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
let prepareOverride: ((ids: readonly string[]) => ModuleCreationPlan) | undefined;
let MainMenu: Vue.Component, app: ReturnType<typeof renderer.createApp> | undefined;
const source = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

beforeAll(async () => {
    vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900, addEventListener() {}, removeEventListener() {}, localStorage: { getItem: () => null, setItem() {} },
        setInterval: (fn: () => void, ms: number) => globalThis.setInterval(fn, ms), clearInterval: (id: ReturnType<typeof setInterval>) => globalThis.clearInterval(id) });
    vi.stubGlobal('document', doc);
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    const empty = { default: { render: () => null }, __esModule: true };
    const { buildModuleCreationCommands } = await import('../ext/ui/creation');
    const modules: Record<string, unknown> = {
        vue: Vue, 'i18next-vue': translation,
        '../engine/Input': { inputManager: { registerModalKeyHandler: () => () => {} } },
        '../ext/catalog': { DEFAULT_EXTENSIONS: ['alpha', 'beta'], getInstalledModuleDescriptors: () => [
            { id: 'alpha', labelKey: 'ext.modules.label' }, { id: 'beta', labelKey: 'ext.modules.label' },
        ] },
        '../ext/ui/defaults': await import('../ext/ui/defaults'),
        '../ext/ui/creation': { prepareModuleCreation: (ids: readonly string[]) => prepareOverride!(ids), buildModuleCreationCommands },
        './MapTileLegend.vue': empty, './theme/TitleFx.vue': empty,
        '../ui/mapTiles': await import('../ui/mapTiles'), '../engine/Seed': await import('../engine/Seed'),
        '../engine/Settings': await import('../engine/Settings'),
    };
    const script = compileScript(parse(source('components/MainMenu.vue')).descriptor, { id: 'foundation-creation-menu', inlineTemplate: true });
    const code = ts.transpileModule(script.content, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const exports: any = {};
    new Function('require', 'exports', code)((key: string) => {
        if (!(key in modules)) throw new Error(`Missing foundation creation SFC import: ${key}`);
        return modules[key];
    }, exports);
    MainMenu = exports.default;
});
afterEach(() => { prepareOverride = undefined; app?.unmount(); app = undefined; root.children = []; body.children = []; vi.restoreAllMocks(); vi.useRealTimers(); });
afterAll(() => vi.unstubAllGlobals());
async function mount() {
    vi.useFakeTimers(); root = node('root'); const submitted = vi.fn();
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

function deferred<T>() {
    let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function creationFixture(ids: readonly string[], loads: Readonly<Record<string, () => Promise<Vue.Component>>>) {
    const callbacks: { moduleId: string; cancel(): void; complete(commands: readonly string[]): void }[] = [];
    const component = (moduleId: string) => Vue.defineComponent({
        emits: ['cancel', 'complete'], setup() {
            const props = Vue.getCurrentInstance()!.vnode.props!;
            callbacks.push({ moduleId, cancel: props.onCancel, complete: props.onComplete });
            return () => Vue.h('section', { 'data-step-ui': moduleId });
        },
    });
    const plan: ModuleCreationPlan = {
        extensions: ids,
        modules: ids.map(id => ({ id, version: '1.0.0', initialState: () => ({}), initialCommand: { action: 'initialize', payload: {} } }) as ExtensionModule),
        steps: ids.map(moduleId => ({ moduleId, ...(loads[moduleId] ? { load: loads[moduleId] } : { component: component(moduleId) }) })),
    };
    return { plan, component, callbacks };
}
const initialChoice = (module: string, choice: string) => JSON.stringify({ module, action: 'initialize', payload: { choice } });

describe('foundation module creation loading and session ownership', () => {
    it('keeps native menu cancellation/retry usable when a creation chunk rejects', async () => {
        const first = deferred<Vue.Component>(), retry = deferred<Vue.Component>();
        const load = vi.fn().mockImplementationOnce(() => first.promise).mockImplementationOnce(() => retry.promise);
        const fixture = creationFixture(['alpha'], { alpha: load }); prepareOverride = () => fixture.plan;
        const submitted = await mount(); await openExtended();
        expect(all(root).find(n => String(n.props.class).includes('title-screen'))!.props.inert).toBe(false);
        expect(find('data-creation-load', 'cancel', root)).toBeTruthy(); expect(text(root)).toContain(i18next.t('ext.creation.loading'));
        first.reject(new Error('offline chunk')); await tick();
        expect(text(root)).toContain(i18next.t('ext.creation.unavailable'));
        expect(find('data-creation-load', 'retry', root)).toBeTruthy();
        click(find('data-creation-load', 'retry', root)); await tick();
        retry.resolve(fixture.component('alpha')); await tick();
        expect(find('data-step-ui', 'alpha', root)).toBeTruthy();
        expect(all(root).find(n => String(n.props.class).includes('title-screen'))!.props.inert).toBe(true);
        fixture.callbacks[0]!.cancel(); await tick();
        expect(find('data-step-ui', 'alpha', root)).toBeUndefined(); expect(submitted).not.toHaveBeenCalled();
    });
    it('freezes setup controls during loading and Back cancels before a late result can cover Home', async () => {
        const pending = deferred<Vue.Component>(), fixture = creationFixture(['alpha'], { alpha: () => pending.promise });
        prepareOverride = () => fixture.plan;
        const submitted = await mount(); await openExtended();
        expect(find('data-testid', 'rule-set', root).props.disabled).toBe(true);
        expect(find('data-testid', 'module-selector', root).props.disabled).toBe(true);
        expect(all(root).filter(n => n.tag === 'select').every(n => n.props.disabled)).toBe(true);
        expect(all(root).find(n => n.tag === 'input' && n.type === 'text')!.props.disabled).toBe(true);
        const back = all(root).find(n => String(n.props.class).split(' ').includes('back-button'))!;
        click(back); await tick(); expect(find('data-creation-load', 'cancel', root)).toBeUndefined();
        click(back); await tick();
        pending.resolve(fixture.component('late')); await tick();
        expect(find('data-step-ui', 'late', root)).toBeUndefined(); expect(submitted).not.toHaveBeenCalled();
        expect(find('data-testid', 'rule-set', root)).toBeUndefined();
    });
    it('discards cancelled pending loads and stale callbacks after cancelling and reopening creation', async () => {
        const old = deferred<Vue.Component>(), current = deferred<Vue.Component>();
        const load = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
        const fixture = creationFixture(['alpha'], { alpha: load }); prepareOverride = () => fixture.plan;
        const submitted = await mount(); await openExtended();
        click(find('data-creation-load', 'cancel', root)); await tick();
        await openExtended(); old.resolve(fixture.component('old')); await tick();
        expect(find('data-step-ui', 'old', root)).toBeUndefined(); expect(fixture.callbacks).toHaveLength(0);
        current.resolve(fixture.component('alpha')); await tick();
        const oldCallbacks = fixture.callbacks[0]!;
        oldCallbacks.cancel(); await tick();
        prepareOverride = () => creationFixture(['alpha'], {}).plan;
        await openExtended(); oldCallbacks.complete([initialChoice('alpha', 'stale')]); oldCallbacks.cancel(); await tick();
        expect(find('data-step-ui', 'alpha', root)).toBeTruthy(); expect(submitted).not.toHaveBeenCalled();
    });
    it('binds completion/cancel/rejection to the exact creation session and module step', async () => {
        const second = deferred<Vue.Component>(), fixture = creationFixture(['alpha', 'beta'], { beta: () => second.promise });
        prepareOverride = () => fixture.plan;
        const submitted = await mount(); await openExtended();
        const alpha = fixture.callbacks[0]!;
        alpha.complete([initialChoice('alpha', 'selected')]); await tick();
        vi.advanceTimersByTime(600); await tick();
        alpha.complete([initialChoice('beta', 'injected')]); alpha.cancel(); await tick();
        expect(find('data-creation-load', 'cancel', root)).toBeTruthy(); expect(submitted).not.toHaveBeenCalled();
        second.resolve(fixture.component('beta')); await tick();
        alpha.complete([initialChoice('beta', 'injected')]); alpha.cancel(); await tick();
        expect(find('data-step-ui', 'beta', root)).toBeTruthy();
        fixture.callbacks[1]!.complete([initialChoice('beta', 'selected')]); await tick();
        expect(submitted).toHaveBeenCalledTimes(1);
        expect(submitted.mock.calls[0]![0].initialCommands).toEqual([initialChoice('alpha', 'selected'), initialChoice('beta', 'selected')]);
        const rejected = submitted.mock.calls[0]![0].onRejected;
        rejected(); await tick(); fixture.callbacks[1]!.cancel(); await tick();
        await openExtended(); rejected(); await tick();
        expect(find('data-step-ui', 'alpha', root)).toBeTruthy(); expect(text(root)).not.toContain(i18next.t('ext.creation.start_failed'));
    });
});
