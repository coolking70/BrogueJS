import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { createSfcHarness } from './support/sfcHarness';
import zhCN from '../locales/zh_CN.json';
import { Direction } from '../types';
import { commandConfirmationFixture } from './support/commandConfirmation';

// Compile the real client template and invoke its bound pointer handlers.
// This host exercises timers/lifecycles without claiming browser acceptance.
interface Node {
    type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null;
    setPointerCapture: ReturnType<typeof vi.fn>; releasePointerCapture: ReturnType<typeof vi.fn>;
    getBoundingClientRect(): { left: number; top: number; right: number; bottom: number };
    blur(): void;
}
const node = (type: string, text = ''): Node => ({ type, text, props: {}, children: [], parent: null,
    setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 46, bottom: 46 }), blur() {} });
const renderer = Vue.createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _previous, value) => { n.props[key] = value; },
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const moves = vi.fn();
const mounted: Array<ReturnType<typeof renderer.createApp>> = [];
let win: EventTarget;
let doc: EventTarget & { hidden: boolean };
let DPad: Vue.Component;
let App: Vue.Component, Bar: Vue.Component, Radial: Vue.Component;
const settings = Vue.reactive({ immersiveMode: false, sidebarWidthMode: 'fixed' });
const saveSnapshot = vi.fn();
const toSaveSnapshot = vi.fn();
const gameStub = { hasPendingConfirmation: false, toSaveSnapshot, replayStatus: 'idle', replayRecording: null, isGameOver: false, currentSeed: 123,
    hasCompleteRecording: false, onConfirmRequest: null, startNewGame() {}, isAutoTraveling: () => false };
let heldInput: typeof import('../ui/heldInput');

beforeAll(async () => {
    vi.stubGlobal('window', new EventTarget());
    await import('./harness');
    heldInput = await import('../ui/heldInput');
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    const stubs = { '../ui/commands': { dispatch: moves } };
    const harness = createSfcHarness({ baseURL: import.meta.url, stubs: {
        ...stubs, '../engine/Input': { inputManager: { registerModalKeyHandler: () => () => {} } },
    }, components: { '../components/theme/CmdIcon.vue': { render: () => null } } });
    DPad = await harness.load('../components/DPad.vue'); Bar = await harness.load('../components/CommandBar.vue');
    Radial = await harness.load('../components/theme/RadialCommands.vue');
    const emitter = (type: string, event: string, payload?: unknown) => Vue.defineComponent({
        emits: [event], setup(_props, { emit }) { return () => Vue.h(type, { onActivate: () => emit(event, payload) }); },
    });
    const appHarness = createSfcHarness({ baseURL: import.meta.url, stubComponents: { render: () => null }, stubs: {
        ...stubs, '../engine/Input': { inputManager: { triggerAction: moves } },
        '../engine/Settings': { displaySettings: settings }, '../engine/Core/Game': { activeGame: gameStub },
        '../engine/Core/SaveStorage': { readSaveSummary: async () => null, saveSnapshot },
        '../ui/immersiveMode': { registerImmersiveShortcut: () => () => {} }, '../ui/recordingExport': {},
        '../ui/layout': { viewport: { mode: 'portrait', coarsePointer: true }, startViewportTracking() {}, shouldShowTouchControls: () => true },
    }, components: {
        '../components/MainMenu.vue': emitter('start', 'new-game', { mode: 'test' }),
        '../components/theme/ThemeHud.vue': Vue.defineComponent({ emits: ['menu', 'panel'], setup(_props, { emit }) {
            return () => Vue.h('hud', { onMenu: () => emit('menu'), onPanel: () => emit('panel') });
        } }),
        '../components/theme/ThemeLog.vue': emitter('journal', 'open-journal'),
        '../components/theme/ThemeNearby.vue': emitter('nearby', 'inspect', { name: 'detail' }),
        '../components/DPad.vue': DPad,
        '../components/CommandBar.vue': emitter('commands', 'modal-open'),
        '../components/theme/RadialCommands.vue': emitter('radial', 'modal-open'),
    } });
    App = await appHarness.load('../App.vue');
});
beforeEach(() => {
    vi.useFakeTimers(); moves.mockReset(); saveSnapshot.mockReset(); toSaveSnapshot.mockReset(); gameStub.hasPendingConfirmation = false;
    settings.immersiveMode = false;
    win = Object.assign(new EventTarget(), {
        setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
        setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval });
    doc = Object.assign(new EventTarget(), { hidden: false });
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc);
});
afterEach(() => {
    mounted.splice(0).forEach(app => app.unmount());
    vi.useRealTimers(); vi.unstubAllGlobals();
});
function pad() {
    const root = node('root'); const app = renderer.createApp(DPad, { mode: 'portrait' });
    app.use(I18NextVue, { i18next }); app.mount(root); mounted.push(app);
    return all(root).find(n => n.text === '↓')!;
}
function press(button: Node) {
    button.props.onPointerdown({ preventDefault() {}, currentTarget: button, pointerId: 7, clientX: 20, clientY: 20 });
}
function confirmation(answer: boolean, atMove: number) {
    const confirm = commandConfirmationFixture();
    moves.mockImplementation(() => {
        if (moves.mock.calls.length === atMove) { confirm.publish('flame?'); confirm.answer(answer); }
    });
    return confirm;
}

describe('DPad held input', () => {
    it('正常按住仍按 350ms 延迟 + 140ms 间隔独立派发，松手停止', () => {
        const button = pad(); press(button); expect(moves.mock.calls).toEqual([['move', Direction.DOWN]]);
        vi.advanceTimersByTime(489); expect(moves).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(281); expect(moves).toHaveBeenCalledTimes(4);
        button.props.onPointerup(); vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(4);
    });
    it.each([false, true])('首条 move 受控确认返回 %s 后不重新创建计时器', answer => {
        const button = pad(); const confirm = confirmation(answer, 1); press(button);
        expect(confirm.resolved).toHaveBeenCalledTimes(1);
        confirm.dispose();
        vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(1);
        moves.mockReset(); press(button); vi.advanceTimersByTime(490); expect(moves).toHaveBeenCalledTimes(2);
    });
    it.each([false, true])('重复 move 确认返回 %s 后永久停止旧按住', answer => {
        const button = pad(); const confirm = confirmation(answer, 2); press(button); vi.advanceTimersByTime(490);
        expect(confirm.resolved).toHaveBeenCalledTimes(1);
        confirm.dispose();
        vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(2);
    });
    it.each(['blur', 'visibilitychange'])('%s 在延迟及重复阶段都停止，恢复焦点不重启', event => {
        const button = pad();
        for (const elapsed of [100, 490]) {
            moves.mockReset(); press(button); vi.advanceTimersByTime(elapsed);
            const count = moves.mock.calls.length;
            if (event === 'blur') win.dispatchEvent(new Event('blur'));
            else { doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange')); }
            doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange')); win.dispatchEvent(new Event('focus'));
            vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(count);
        }
    });
    it('pointercancel 停止重复', () => {
        const button = pad(); press(button); vi.advanceTimersByTime(490); button.props.onPointercancel();
        vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(2);
    });
    it.each(['onPointerup', 'onPointercancel', 'onPointerleave', 'onLostpointercapture'])('%s 停止延迟及重复，捕获在停止后释放', handler => {
        const button = pad();
        for (const elapsed of [100, 490]) {
            moves.mockReset(); press(button); vi.advanceTimersByTime(elapsed);
            expect(button.setPointerCapture).toHaveBeenCalledWith(7);
            const count = moves.mock.calls.length; button.props[handler]();
            expect(button.releasePointerCapture).toHaveBeenCalledWith(7);
            vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(count);
        }
    });
    it('捕获时移出原按钮仍停止', () => {
        const button = pad(); press(button);
        button.props.onPointermove({ pointerId: 7, clientX: 47, clientY: 20 });
        vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(1);
    });
    it('可见页面的 visibilitychange 不影响正常重复；休息只派发一次', () => {
        const button = pad(); press(button); doc.dispatchEvent(new Event('visibilitychange'));
        vi.advanceTimersByTime(490); expect(moves).toHaveBeenCalledTimes(2);
        const center = all(button.parent!).find(n => n.text === '·')!;
        press(center); vi.advanceTimersByTime(5000);
        expect(moves.mock.calls).toEqual([['move', Direction.DOWN], ['move', Direction.DOWN], ['wait']]);
    });
    it('模态打开取消旧按住，关闭不恢复；新按住仍能连续移动瞄准光标', () => {
        let target: object | null = null;
        const removeContext = heldInput.registerHeldInputContext(() => [target]);
        try {
            const button = pad(); press(button); target = {}; heldInput.syncHeldInputContext();
            vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(1);
            press(button); vi.advanceTimersByTime(490); expect(moves).toHaveBeenCalledTimes(3);
            heldInput.cancelHeldInputs(); target = null; heldInput.syncHeldInputContext();
            vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(3);
        } finally { removeContext(); }
    });
    it('卸载清计时器并移除全局监听器', () => {
        const removeWin = vi.spyOn(win, 'removeEventListener'), removeDoc = vi.spyOn(doc, 'removeEventListener');
        const button = pad(); press(button); mounted.pop()!.unmount();
        vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(1);
        expect(removeWin).toHaveBeenCalledWith('blur', heldInput.cancelHeldInputs);
        expect(removeDoc).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
        expect(vi.getTimerCount()).toBe(0);
    });
    it.each(['menu', 'panel', 'journal', 'nearby', 'commands', 'radial'])('实际 App 打开 %s 同步停止 DPad', async kind => {
        settings.immersiveMode = kind === 'radial';
        const root = node('root'); const app = renderer.createApp(App); app.use(I18NextVue, { i18next });
        app.mount(root); mounted.push(app);
        all(root).find(n => n.type === 'start')!.props.onActivate(); await Vue.nextTick();
        const button = all(root).find(n => n.text === '↓')!; press(button); vi.advanceTimersByTime(490);
        if (kind === 'menu' || kind === 'panel') all(root).find(n => n.type === 'hud')!.props[kind === 'menu' ? 'onMenu' : 'onPanel']();
        else all(root).find(n => n.type === kind)!.props.onActivate();
        vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(2);
    });
    it('actual App menu gives pending confirmation feedback before invoking any save projection/storage', async () => {
        const root = node('root'); const app = renderer.createApp(App); app.use(I18NextVue, { i18next });
        app.mount(root); mounted.push(app);
        all(root).find(n => n.type === 'start')!.props.onActivate(); await Vue.nextTick();
        gameStub.hasPendingConfirmation = true;
        all(root).find(n => n.type === 'hud')!.props.onMenu(); await Vue.nextTick();
        const menu = all(root).find(n => n.type === 'start')!;
        await menu.props.onSaveGame(); await Vue.nextTick();
        expect(toSaveSnapshot).not.toHaveBeenCalled(); expect(saveSnapshot).not.toHaveBeenCalled();
        expect(menu.props['replay-feedback']).toBe('请先回答当前确认，再保存或导出。');
    });
    it.each(['bar', 'radial'])('实际 %s 展开通知同步取消旧按住', kind => {
        const button = pad(); press(button);
        const root = node('root'), component = kind === 'bar' ? Bar : Radial;
        const app = renderer.createApp(component, { mode: 'portrait', onModalOpen: heldInput.cancelHeldInputs });
        app.use(I18NextVue, { i18next }); app.mount(root); mounted.push(app);
        const trigger = all(root).find(n => String(n.props.class).includes(kind === 'bar' ? 'command-more' : 'rc-hub'))!;
        if (kind === 'bar') trigger.props.onClick({ currentTarget: trigger });
        else trigger.props.onPointerdown({ currentTarget: trigger, pointerId: 8 });
        vi.advanceTimersByTime(5000); expect(moves).toHaveBeenCalledTimes(1);
    });
    it('每次正常重复仍是一条独立录制命令，导出后可零 OOS 回放', async () => {
        const { createHeadlessGame } = await import('./harness');
        const game = createHeadlessGame(33005, 'test');
        moves.mockImplementation((action, data) => game.handlePlayerAction(action, data));
        const button = pad(); press(button); vi.advanceTimersByTime(770); button.props.onPointerup();
        const recording = game.exportRecording();
        expect(recording.events).toHaveLength(4);
        expect(recording.events.map(event => [event.index, event.action, event.data, event.decisions]))
            .toEqual([0, 1, 2, 3].map(index => [index, 'move', Direction.DOWN, []]));
        const position = { ...game.player.loc }, turn = game.absoluteTurnNumber;
        const replay = createHeadlessGame(1, 'test'); expect(replay.loadReplay(recording)).toBe(true);
        while (replay.replayCursor < recording.events.length && !replay.replayError) replay.replayStep();
        expect(replay.replayError).toBeNull(); expect(replay.replayCursor).toBe(4);
        expect(replay.player.loc).toEqual(position); expect(replay.absoluteTurnNumber).toBe(turn);
    });
});


describe('foundation CommandBar module and native action partitions', () => {
    it.each(['portrait', 'landscape', 'desktop'] as const)('keeps every %s action reachable exactly once and routes module callbacks separately', async mode => {
        const alpha = vi.fn(), beta = vi.fn(), blocked = vi.fn();
        const root = node('root');
        const app = renderer.createApp(Bar, { mode, moduleCommands: [
            { id: 'alpha:open', label: 'Alpha', invoke: alpha },
            { id: 'beta:open', label: 'Beta', invoke: beta },
            { id: 'alpha:blocked', label: 'Blocked', disabled: true, invoke: blocked },
        ] });
        app.use(I18NextVue, { i18next }); app.mount(root); mounted.push(app);
        const tick = async () => { await Vue.nextTick(); await Vue.nextTick(); };
        const hasClass = (entry: Node, value: string) => String(entry.props.class).split(' ').includes(value);
        const commandButtons = () => all(root).filter(entry => entry.type === 'button' && typeof entry.props['data-action'] === 'string');
        const identity = (entry: Node) => `${entry.props['data-action']}:${entry.props['data-direction'] ?? ''}`;
        const click = (entry: Node) => entry.props.onClick({ target: entry, currentTarget: entry });
        const expand = async () => {
            if (!all(root).some(entry => hasClass(entry, 'command-overflow'))) {
                click(all(root).find(entry => hasClass(entry, 'command-more'))!); await tick();
            }
        };
        const native: readonly (readonly [string, string?])[] = [
            ['search'], ['search_long'], ['wait'], ['auto_rest'], ['pickup'], ['toggle_inventory'],
            ['throw_item'], ['auto_explore'], ['travel_stairs', 'up'], ['travel_stairs', 'down'],
            ['discoveries'], ['help'], ['escape'],
        ];
        const primaryNative = ['search:', 'wait:', 'pickup:', 'toggle_inventory:', 'throw_item:', 'auto_explore:', 'escape:'];
        const moduleIds = ['alpha:open:', 'beta:open:', 'alpha:blocked:'];
        expect(commandButtons().map(identity).sort()).toEqual([...primaryNative, ...moduleIds].sort());
        await expand();
        const nav = all(root).find(entry => entry.type === 'nav')!;
        const overflow = all(root).find(entry => hasClass(entry, 'command-overflow'))!;
        const primary = commandButtons().filter(entry => entry.parent === nav).map(identity);
        const secondary = commandButtons().filter(entry => entry.parent === overflow).map(identity);
        expect(primary.sort()).toEqual([...primaryNative, ...moduleIds].sort());
        expect(secondary.sort()).toEqual(['search_long:', 'auto_rest:', 'travel_stairs:up', 'travel_stairs:down', 'discoveries:', 'help:'].sort());
        expect(primary.filter(id => secondary.includes(id))).toEqual([]);
        const allIds = commandButtons().map(identity);
        expect(allIds.sort()).toEqual([...native.map(([action, data]) => `${action}:${data ?? ''}`), ...moduleIds].sort());
        expect(new Set(allIds).size).toBe(allIds.length);
        expect(commandButtons().filter(entry => entry.props['data-action'] === 'travel_stairs').map(entry => entry.props['data-direction']).sort()).toEqual(['down', 'up']);

        // Module entries invoke only their own callbacks, never the native input path.
        for (const action of ['alpha:open', 'beta:open']) {
            click(commandButtons().find(entry => entry.props['data-action'] === action)!); await tick();
        }
        expect(alpha).toHaveBeenCalledTimes(1); expect(beta).toHaveBeenCalledTimes(1); expect(moves).not.toHaveBeenCalled();
        const disabled = commandButtons().find(entry => entry.props['data-action'] === 'alpha:blocked')!;
        expect(disabled.props.disabled).toBe(true);
        // Invoke the bound handler directly too: the dispatch guard must reject it
        // even if a stale event bypasses the browser's disabled-button behavior.
        click(disabled); await tick(); expect(blocked).not.toHaveBeenCalled(); expect(moves).not.toHaveBeenCalled();

        // Reopen the real overflow after every click, so each assertion uses a
        // currently mounted reachable button rather than a retired DOM listener.
        for (const [action, data] of native) {
            let button = commandButtons().find(entry => entry.props['data-action'] === action && entry.props['data-direction'] === data);
            if (!button) { await expand(); button = commandButtons().find(entry => entry.props['data-action'] === action && entry.props['data-direction'] === data); }
            expect(button).toBeTruthy(); click(button!); await tick();
        }
        expect(moves.mock.calls).toEqual(native.map(([action, data]) => [action, data]));
        expect(alpha).toHaveBeenCalledTimes(1); expect(beta).toHaveBeenCalledTimes(1); expect(blocked).not.toHaveBeenCalled();
    });
});
