import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import * as translation from 'i18next-vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import zhCN from '../locales/zh_CN.json';
import { createHeadlessGame } from './harness';

// Mount the compiled production SFC with Vue's real vModelText directive.
// The host delivers input events, including Vue's type=number coercion; it does
// not replace v-model or call the seek handler through extracted source text.
interface HostNode {
    tag: string; type: string; text: string; value: string | number;
    props: Record<string, any>; children: HostNode[]; parent: HostNode | null;
    listeners: Record<string, ((event: { target: HostNode }) => void)[]>;
    addEventListener(name: string, listener: (event: { target: HostNode }) => void): void;
    focus(): void;
}
const node = (tag: string, text = ''): HostNode => Vue.markRaw<HostNode>({
    tag, type: '', text, value: '', props: {}, children: [], parent: null, listeners: {},
    addEventListener(name, listener) { (this.listeners[name] ??= []).push(listener); },
    focus() {},
});
const all = (n: HostNode): HostNode[] => [n, ...n.children.flatMap(all)];
const text = (n: HostNode): string => n.text + n.children.map(text).join('');
const renderer = Vue.createRenderer<HostNode, HostNode>({
    createElement: tag => node(tag), createText: value => node('#text', value), createComment: value => node('#comment', value),
    insert(child, parent, anchor) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, value) => { n.text = value; },
    setElementText: (n, value) => { n.text = value; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp(n, key, _old, value) { n.props[key] = value; if (key === 'type') n.type = value; },
});
let MainMenu: Vue.Component, app: ReturnType<typeof renderer.createApp> | undefined;
async function mountSeek(onReplaySeek = vi.fn((_target: number) => {})) {
    const root = node('root');
    app = renderer.createApp(MainMenu, {
        inGame: true, hasSave: false, hasReplay: true, saveInfo: null,
        replayInfo: { status: 'loaded', cursor: 0, total: 6 }, onReplaySeek,
    }).use(I18NextVue, { i18next });
    app.mount(root);
    all(root).find(n => n.tag === 'button' && text(n).includes(i18next.t('menu.replay.title')))!.props.onClick();
    await Vue.nextTick();
    const input = all(root).find(n => n.tag === 'input' && n.type === 'number')!;
    const button = all(root).find(n => n.tag === 'button' && text(n) === i18next.t('menu.replay.seek'))!;
    expect(input.listeners.input).toHaveLength(1);
    expect(input.props.min).toBe('0'); expect(input.props.max).toBe(6);
    return {
        onReplaySeek,
        async enter(value: string) {
            input.value = value;
            for (const listener of input.listeners.input!) listener({ target: input });
            await Vue.nextTick();
            button.props.onClick();
        },
        async assign(value: string | number) {
            input.props['onUpdate:modelValue'](value);
            await Vue.nextTick();
            button.props.onClick();
        },
    };
}

beforeAll(async () => {
    vi.stubGlobal('document', { activeElement: null, documentElement: { dataset: {} } });
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    const empty = { default: { render: () => null }, __esModule: true };
    const modules: Record<string, unknown> = {
        vue: Vue, 'i18next-vue': translation,
        '../engine/Input': { inputManager: { registerModalKeyHandler: () => () => {} } },
        './MapTileLegend.vue': empty, './theme/TitleFx.vue': empty,
        './growth/GrowthCreationPanel.vue': empty, '../ext/modules/growth/view': await import('../ext/modules/growth/view'),
        '../ui/mapTiles': await import('../ui/mapTiles'), '../engine/Seed': await import('../engine/Seed'),
        '../engine/Settings': await import('../engine/Settings'),
    };
    const source = readFileSync(new URL('../components/MainMenu.vue', import.meta.url), 'utf8');
    const script = compileScript(parse(source).descriptor, { id: 'main-menu-replay-seek', inlineTemplate: true });
    const code = ts.transpileModule(script.content, { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } }).outputText;
    const exports: any = {};
    new Function('require', 'exports', code)((key: string) => {
        if (!(key in modules)) throw new Error(`Unresolved replay menu import: ${key}`);
        return modules[key];
    }, exports);
    MainMenu = exports.default;
});
afterEach(() => { app?.unmount(); app = undefined; });
afterAll(() => vi.unstubAllGlobals());

describe('MainMenu mounted replay seek', () => {
    it('seeks a six-command recording through the numeric input and button, preserving engine clamping', async () => {
        const game = createHeadlessGame(517);
        game.animationEnabled = false;
        for (let i = 0; i < 6; i++) game.executeCommand('wait');
        const recording = game.exportRecording();
        expect(recording.events).toHaveLength(6);
        expect(game.loadReplay(recording)).toBe(true);
        const onSeek = vi.fn((target: number) => game.replaySeek(target));
        const menu = await mountSeek(onSeek);
        for (const [input, forwarded, cursor] of [
            ['3', 3, 3], ['0', 0, 0], ['6', 6, 6], ['3.75', 3, 3], ['-2', -2, 0], ['9', 9, 6],
        ] as const) {
            await menu.enter(input);
            expect(onSeek).toHaveBeenLastCalledWith(forwarded);
            expect(game.replayCursor).toBe(cursor);
            expect(game.replayError).toBeNull();
        }
        expect(onSeek).toHaveBeenCalledTimes(6);
    });

    it.each(['', ' ', 'not-a-number', 'Infinity', '-Infinity'])('does not dispatch invalid or empty input %j', async value => {
        const menu = await mountSeek();
        await menu.enter(value);
        expect(menu.onReplaySeek).not.toHaveBeenCalled();
    });

    it('accepts string or number model values without changing parseInt truncation and range forwarding', async () => {
        const menu = await mountSeek();
        for (const [value, expected] of [[' 3 ', 3], [3, 3], ['2.75', 2], [2.75, 2], ['-2', -2], ['9', 9]] as const) {
            await menu.assign(value);
            expect(menu.onReplaySeek).toHaveBeenLastCalledWith(expected);
        }
        expect(menu.onReplaySeek).toHaveBeenCalledTimes(6);
        for (const value of ['', ' ', 'invalid', NaN, Infinity, -Infinity]) await menu.assign(value);
        expect(menu.onReplaySeek).toHaveBeenCalledTimes(6);
    });
});
