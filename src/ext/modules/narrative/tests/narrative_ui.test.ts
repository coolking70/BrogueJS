import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import { parse, compileScript } from '@vue/compiler-sfc';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { computed, createRenderer, effectScope, h, nextTick, ref, type Component, type EffectScope } from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import type { Game } from '../../../../engine/Core/Game';
import type { ModuleUiHost } from '../../../ui/types';
import { buildNarrativeUiCommand, readNarrativeUiView, type NarrativeActiveView, type NarrativeUiView } from '../ui/view';
let NarrativeInteractionBar: Component;
import locale from '../locales/zh_CN.json';
import { rng } from '../../../../engine/Random';

const listeners = new Map<string, Set<{ fn: (event: any) => void; capture: boolean }>>();
const win = {
    addEventListener(name: string, fn: (event: any) => void, capture = false) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name)!.add({ fn, capture });
    },
    removeEventListener(name: string, fn: (event: any) => void) {
        for (const item of listeners.get(name) ?? []) if (item.fn === fn) listeners.get(name)!.delete(item);
    },
    setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(timer),
};
function event(extra: Record<string, unknown> = {}) {
    const e = { detail: 1, clientX: 30, clientY: 50, key: '', repeat: false, target: null,
        defaultPrevented: false, stopped: false, preventDefault() { e.defaultPrevented = true; },
        stopPropagation: vi.fn(), stopImmediatePropagation() { e.stopped = true; }, ...extra };
    return e;
}
function dispatch(name: string, value: ReturnType<typeof event>) {
    for (const listener of [...listeners.get(name) ?? []].sort((a, b) => Number(b.capture) - Number(a.capture))) {
        listener.fn(value); if (value.stopped) break;
    }
}
const nearby = [{ targetEntityId: 21, nameKey: 'ext.narrative.npc.keeper.name', descriptionKey: 'ext.narrative.npc.keeper.description', glyph: '人', color: '#c3ad80' }];
function active(sessionId = 1): NarrativeActiveView {
    return { sessionId, targetEntityId: 21, nodeId: 'hello', speakerNameKey: nearby[0]!.nameKey,
        textKey: 'ext.narrative.dialogue.keeper.hello', portraitId: null, transitionLimitReached: false,
        choices: [{ id: 'read-note', textKey: 'ext.narrative.choice.read', enabled: true, unavailableKey: null },
            { id: 'leave', textKey: 'ext.narrative.choice.leave', enabled: false, unavailableKey: 'ext.narrative.choice.already_read' }] };
}
function fixture() {
    const state = { revision: 0, nearby, active: null as NarrativeActiveView | null, journal: [] };
    const runtime = { readModuleView: () => ({ session: token, state }) }, token = {};
    const raw = { extensionRuntime: runtime, replayRecording: null as object | null, isGameOver: false,
        executeCommand: vi.fn((_type: string, raw: string) => {
            const input = JSON.parse(raw); state.revision++;
            state.active = input.action === 'open' ? active() : null;
        }) };
    return { game: raw as unknown as Game, raw, runtime, state };
}
const scopes: EffectScope[] = [];
let useNarrativeUi: typeof import('../ui/useNarrativeUi').useNarrativeUi;
let testInput: typeof import('../../../../engine/Input').inputManager;
function session(f = fixture()) {
    const host: ModuleUiHost = { registerKeyHandler: (handler, priority) => testInput.registerModalKeyHandler(handler, priority), cancelHeldKeys: () => testInput.cancelHeldKeys(), game: () => f.game, tick: ref(0), immersive: ref(false), canOpenPanel: vi.fn(() => true), beforeOpenPanel: vi.fn(), afterClosePanel: vi.fn() };
    const scope = effectScope(); scopes.push(scope);
    return { ...f, host, scope, ui: scope.run(() => useNarrativeUi(host))! };
}
beforeAll(async () => {
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', { hidden: false, addEventListener() {}, removeEventListener() {} });
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: locale } }, initImmediate: false });
    testInput = (await import('../../../../engine/Input')).inputManager;
    useNarrativeUi = (await import('../ui/useNarrativeUi')).useNarrativeUi;
    // Compile the real client template, rather than Vite's node/SSR transform.
    const source = readFileSync(new URL('../ui/NarrativeInteractionBar.vue', import.meta.url), 'utf8');
    const script = compileScript(parse(source).descriptor, { id: 'narrative-interaction', inlineTemplate: true });
    const code = ts.transpileModule(script.content, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: { default?: Component } = {};
    new Function('require', 'exports', code)((name: string) => { if (name === 'vue') return Vue; throw new Error(`Unexpected UI import: ${name}`); }, exports);
    NarrativeInteractionBar = exports.default!;
});
beforeEach(() => vi.useFakeTimers());
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop(); vi.useRealTimers(); vi.restoreAllMocks(); });
afterAll(() => vi.unstubAllGlobals());

describe('EXT-2b temporary inline interaction session', () => {
    it('uses only the installed bar slot, issues strict versioned commands, and rejects a repeated callback', async () => {
        const f = session(); const props = f.ui.bar.value!.props;
        expect(f.ui.panelOpen.value).toBe(false); expect(f.ui.panel.value).toBeNull(); expect(f.ui.commands.value).toEqual([]);
        const before = rng.getState();
        await (props.onOpen as Function)(21); await (props.onOpen as Function)(21);
        expect(f.raw.executeCommand).toHaveBeenCalledTimes(1);
        expect(JSON.parse(f.raw.executeCommand.mock.calls[0]![1])).toEqual({ module: 'narrative', action: 'open', payload: { v: 2, revision: 0, targetEntityId: 21 } });
        expect(f.host.beforeOpenPanel).not.toHaveBeenCalled(); expect(f.ui.panelOpen.value).toBe(false);
        expect(rng.getState()).toEqual(before);
        const choices = f.ui.bar.value!.props;
        await (choices.onChoose as Function)('leave'); expect(f.raw.executeCommand).toHaveBeenCalledTimes(1);
        await (choices.onChoose as Function)('read-note'); await (choices.onChoose as Function)('read-note');
        expect(f.raw.executeCommand).toHaveBeenCalledTimes(2); expect(f.host.afterClosePanel).toHaveBeenCalledOnce();
    });
    it('rejects unavailable targets, stale revisions and runtime/session replacements before command submission', async () => {
        for (const change of ['revision', 'session', 'runtime', 'dispose'] as const) {
            const f = session(); const props = f.ui.bar.value!.props;
            await (props.onOpen as Function)(999); expect(f.raw.executeCommand).not.toHaveBeenCalled();
            if (change === 'revision') f.state.revision++;
            if (change === 'session') f.runtime.readModuleView = () => ({ session: {}, state: f.state });
            if (change === 'runtime') f.raw.extensionRuntime = { readModuleView: () => ({ session: {}, state: f.state }) };
            if (change === 'dispose') f.scope.stop();
            await (props.onOpen as Function)(21); f.ui.close();
            expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(f.host.afterClosePanel).not.toHaveBeenCalled();
        }
    });
    it('never turns host closePanels into a mechanical close, and clears held inputs when a session appears', async () => {
        const held = await import('../../../../ui/heldInput');
        const stop = vi.fn(), unregister = held.registerHeldInput(stop);
        const f = session(); f.state.active = active(); f.ui.refresh();
        expect(stop).toHaveBeenCalled(); f.ui.close();
        expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(f.state.active).not.toBeNull(); unregister();
    });
    it('Escape closes once and its repeat cannot become a world action after the inline row disappears', async () => {
        const f = session(); f.state.active = active(); f.ui.refresh();
        const escape = event({ key: 'Escape' }); dispatch('keydown', escape); await nextTick();
        expect(escape.defaultPrevented).toBe(true); expect(f.raw.executeCommand).toHaveBeenCalledOnce();
        const repeat = event({ key: 'Escape', repeat: true }); dispatch('keydown', repeat);
        expect(repeat.defaultPrevented).toBe(true); expect(f.raw.executeCommand).toHaveBeenCalledOnce();
        dispatch('keyup', event({ key: 'Escape' }));
    });
    it('a focused inline Escape also suppresses repeat after focus returns to the map', async () => {
        const f = session(); f.state.active = active(); f.ui.refresh();
        await (f.ui.bar.value!.props.onClose as Function)(event({ key: 'Escape', detail: 0 }));
        const repeat = event({ key: 'Escape', repeat: true }); dispatch('keydown', repeat);
        expect(repeat.defaultPrevented).toBe(true); expect(f.raw.executeCommand).toHaveBeenCalledOnce();
        dispatch('keyup', event({ key: 'Escape' }));
    });
    it('requires a physical release for movement held across open and close, including release inside the inline bar', async () => {
        const f = session(), { inputManager } = await import('../../../../engine/Input');
        const accepted: string[] = [];
        inputManager.setCallback(action => { if (!f.state.active) accepted.push(action); });
        dispatch('keydown', event({ key: 'ArrowRight', code: 'ArrowRight' }));
        await (f.ui.bar.value!.props.onOpen as Function)(21);
        dispatch('keydown', event({ key: 'ArrowRight', code: 'ArrowRight', repeat: true }));
        await (f.ui.bar.value!.props.onClose as Function)();
        dispatch('keydown', event({ key: 'ArrowRight', code: 'ArrowRight', repeat: true }));
        expect(accepted).toEqual(['move']);
        // Native section stops bubbling; physical keyup capture must still clear the barrier.
        const release = event({ key: 'ArrowRight', code: 'ArrowRight' });
        for (const listener of listeners.get('keyup') ?? []) if (listener.capture) listener.fn(release);
        dispatch('keydown', event({ key: 'ArrowRight', code: 'ArrowRight' }));
        expect(accepted).toEqual(['move','move']);
        dispatch('keyup', release); inputManager.setCallback(() => {});
    });
    it('recovers a key released outside the window on its next fresh non-repeat press', async () => {
        const f = session(), { inputManager } = await import('../../../../engine/Input');
        const accepted: string[] = [];
        inputManager.setCallback(action => { if (!f.state.active) accepted.push(action); });
        dispatch('keydown', event({ key: 'ArrowLeft', code: 'ArrowLeft', repeat: false }));
        await (f.ui.bar.value!.props.onOpen as Function)(21);
        await (f.ui.bar.value!.props.onClose as Function)();
        dispatch('keydown', event({ key: 'ArrowLeft', code: 'ArrowLeft', repeat: true }));
        expect(accepted).toEqual(['move']);
        // No keyup was delivered while the window was unfocused.
        dispatch('keydown', event({ key: 'ArrowLeft', code: 'ArrowLeft', repeat: false }));
        expect(accepted).toEqual(['move','move']);
        dispatch('keyup', event({ key: 'ArrowLeft', code: 'ArrowLeft' })); inputManager.setCallback(() => {});
    });
    it('swallows a dismissed button double-click at the original coordinates, without blocking a replacement runtime', async () => {
        const f = session(); f.state.active = active(); f.ui.refresh();
        await (f.ui.bar.value!.props.onClose as Function)(event());
        const duplicate = event({ detail: 2 }); dispatch('pointerup', duplicate);
        expect(duplicate.defaultPrevented).toBe(true);
        const elsewhere = event({ clientX: 100 }); dispatch('pointerup', elsewhere); expect(elsewhere.defaultPrevented).toBe(false);
        f.raw.extensionRuntime = { readModuleView: () => ({ session: {}, state: f.state }) };
        const afterLoad = event(); dispatch('pointerup', afterLoad); expect(afterLoad.defaultPrevented).toBe(false);
        vi.advanceTimersByTime(500);
        const afterDelay = event(); dispatch('pointerup', afterDelay); expect(afterDelay.defaultPrevented).toBe(false);
    });
    it('replay remains read-only and does not intercept Escape or pause the display for a seek', async () => {
        const f = session(); f.state.active = active(); f.raw.replayRecording = {}; f.ui.refresh();
        const props = f.ui.bar.value!.props;
        expect((props.model as NarrativeUiView).readOnly).toBe(true);
        await (props.onClose as Function)(); await (props.onChoose as Function)('read-note');
        const e = event({ key: 'Escape' }); dispatch('keydown', e);
        expect(e.defaultPrevented).toBe(false); expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(f.ui.panelOpen.value).toBe(false);
    });
    it('a pure builder does not refresh an old node callback into a later node or newly opened session', () => {
        const f = fixture(); f.state.active = active(); const old = readNarrativeUiView(f.game)!;
        f.state.active = { ...active(), nodeId: 'next' };
        expect(buildNarrativeUiCommand(f.game, old, 'choose', 'read-note')).toBeNull();
        f.state.active = active(2); expect(buildNarrativeUiCommand(f.game, old, 'close')).toBeNull();
    });
});

interface Node { type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null }
const node = (type: string, text = ''): Node => ({ type, text, props: {}, children: [], parent: null });
const renderer = createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) { child.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, child); },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); },
    setText(n, text) { n.text = text; }, setElementText(n, text) { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp(n, key, _old, value) { n.props[key] = value; },
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
describe('EXT-2b real inline component', () => {
    it('renders localized nearby targets, current node and disabled reasons without a dialog or portrait', async () => {
        const f = fixture(), model = ref(readNarrativeUiView(f.game)!), onOpen = vi.fn(), onChoose = vi.fn(), onClose = vi.fn();
        const props = computed(() => ({ model: model.value, blocked: false, submitting: false, error: null, onOpen, onChoose, onClose }));
        const root = node('root'), app = renderer.createApp({ render: () => h(NarrativeInteractionBar as Component, props.value) });
        app.use(I18NextVue, { i18next }); app.mount(root);
        expect(text(root)).toContain(i18next.t(nearby[0]!.nameKey));
        const target = all(root).find(n => n.props['data-narrative-target'] === 21)!;
        target.props.onClick(event()); target.props.onClick(event({ detail: 2 })); expect(onOpen).toHaveBeenCalledOnce();
        model.value = { ...model.value, active: active() }; await nextTick();
        expect(text(root)).toContain(i18next.t('ext.narrative.dialogue.keeper.hello'));
        expect(all(root).find(n => n.props['data-narrative-choice'] === 'leave')!.props.disabled).toBe(true);
        expect(text(root)).toContain(i18next.t('ext.narrative.choice.already_read'));
        expect(all(root).some(n => n.type === 'img' || n.props.role === 'dialog')).toBe(false);
        model.value = { ...model.value, readOnly: true }; await nextTick();
        expect(all(root).filter(n => n.type === 'button').every(n => n.props.disabled)).toBe(true);
        const close = all(root).find(n => n.props['data-action'] === 'narrative-close')!;
        close.props.onClick(event()); expect(onClose).not.toHaveBeenCalled(); app.unmount();
    });
});
