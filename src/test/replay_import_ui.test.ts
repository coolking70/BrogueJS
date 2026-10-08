import { beforeAll, beforeEach, afterEach, afterAll, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import i18next from 'i18next';
import { Game, type GameRecording } from '../engine/Core/Game';
import { Logger, logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { createSfcHarness } from './support/sfcHarness';

// Original public UI2 browser export: keep the complete file byte-for-byte.
const raw = readFileSync(new URL('./fixtures/foraging-ui2-import.json', import.meta.url), 'utf8');
const recording = JSON.parse(raw) as GameRecording;
const saved = (game: Game) => ({ ...game.toSaveSnapshot(), savedAt: 0 });

interface HostNode {
    type: string; text: string; props: Record<string, any>; children: HostNode[]; parent: HostNode | null;
    contains(target: unknown): boolean; closest(selector: string): HostNode | null;
    hasAttribute(name: string): boolean; getAttribute(name: string): string | null;
    querySelector<T>(selector: string): T | null; querySelectorAll<T>(selector: string): T[];
    focus(): void; readonly isConnected: boolean;
}
let documentStub: { activeElement: HostNode | null; hidden: boolean; querySelector(): null; addEventListener(): void; removeEventListener(): void };
const all = (root: HostNode): HostNode[] => [root, ...root.children.flatMap(all)];
const node = (type: string, text = ''): HostNode => Vue.markRaw({ type, text, props: {} as Record<string, any>, children: [], parent: null,
    contains(target) { return all(this).includes(target as HostNode); },
    closest(selector) { if (selector === '[data-dialog-action]' && this.props['data-dialog-action']) return this; return this.parent?.closest(selector) ?? null; },
    hasAttribute(name) { return this.props[name] !== undefined && this.props[name] !== false; },
    getAttribute(name) { return this.props[name] ?? null; },
    querySelector<T>(selector: string) { const action = selector.match(/data-dialog-action="([^"]+)"/)?.[1]; return (all(this).find(n => n.props['data-dialog-action'] === action) ?? null) as T | null; },
    querySelectorAll<T>(selector: string) { return all(this).filter(n => selector === 'button, [tabindex="0"]' ? n.type === 'button' || n.props.tabindex === '0' : n.type === selector) as T[]; },
    focus() { documentStub.activeElement = this; }, get isConnected() { return !!this.parent; },
});
let body: HostNode, app: ReturnType<typeof renderer.createApp> | undefined;
const renderer = Vue.createRenderer<HostNode, HostNode>({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, child); },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _old, value) => { n.props[key] = value; }, querySelector: () => body,
});
const gameModule = { activeGame: {} as Game };
let menu: Record<string, any>, hud: Record<string, any>, App: Vue.Component;
beforeAll(async () => {
    vi.stubGlobal('window', Object.assign(new EventTarget(), { innerWidth: 1440, innerHeight: 900, setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval }));
    documentStub = { activeElement: null, hidden: false, querySelector: () => null, addEventListener() {}, removeEventListener() {} };
    vi.stubGlobal('document', documentStub);
    await import('../i18n');
    const empty = Vue.defineComponent({ render: () => null });
    // Isolate Pixi/visual siblings. Menu/HUD forward their public component events;
    // App, its module sessions, DialogHost, Inventory and the engine are genuine.
    const Menu = Vue.defineComponent({ inheritAttrs: false, setup(_, { attrs }) { return () => { menu = attrs; return Vue.h('div'); }; } });
    const Hud = Vue.defineComponent({ inheritAttrs: false, setup(_, { attrs }) { return () => { hud = attrs; return Vue.h('div'); }; } });
    const harness = createSfcHarness({ baseURL: import.meta.url, stubs: { '../engine/Core/Game': gameModule } });
    const Host = await harness.load('../components/DialogHost.vue'), Inventory = await harness.load('../components/InventoryOverlay.vue');
    App = await createSfcHarness({ baseURL: import.meta.url, stubs: { '../engine/Core/Game': gameModule }, stubComponents: empty,
        components: { '../components/DialogHost.vue': Host, '../components/InventoryOverlay.vue': Inventory,
            '../components/MainMenu.vue': Menu, '../components/theme/ThemeHud.vue': Hud } }).load('../App.vue');
});
beforeEach(() => { vi.useFakeTimers(); logger.reset(); body = node('body'); documentStub.activeElement = null; });
afterEach(() => { app?.unmount(); app = undefined; logger.presentAcknowledgments(null); logger.observeMessages(null); vi.useRealTimers(); vi.restoreAllMocks(); });
afterAll(async () => { (await import('../ui/dialogInput')).dialogInput.dispose(); vi.unstubAllGlobals(); });

describe('public replay import with mounted App', () => {
    it('accepts the original 39-event file, settles reactive rendering and preserves seek/load/continuation', async () => {
        expect(Buffer.byteLength(raw)).toBe(39402);
        expect(createHash('sha256').update(raw).digest('hex')).toBe('f2a22fc3b3b7eb81ae68630c8f0c760ad83342b444bc780dc3f161b908daca9e');
        expect(recording.events).toHaveLength(39);
        const game = new Game({ seed: 2 }); gameModule.activeGame = game;
        const root = node('root'); body.children.push(root); root.parent = body;
        app = renderer.createApp(App).use(I18NextVue, { i18next }); app.mount(root); await Vue.nextTick();
        menu.onNewGame({ seed: '2', mode: 'normal', ruleSet: 'extended', extensions: ['foraging'] }); await Vue.nextTick();
        // Reconstruct the real pre-import live run through public commands. Only
        // the confirmation presenter is replaced with the file's observed answers.
        for (const event of recording.events) {
            let cursor = 0; const previous = game.onCommandConfirmRequest;
            try { game.onCommandConfirmRequest = null; game.onConfirmRequest = () => event.decisions[cursor++] ?? true;
                game.executeCommand(event.action, event.data === null ? undefined : event.data); }
            finally { game.onCommandConfirmRequest = previous; }
        }
        expect(game.exportRecording().events).toEqual(recording.events);
        hud.onMenu(); await Vue.nextTick();
        await menu.onImportReplayJson(new File([raw], 'recording.json', { type: 'application/json' })); await Vue.nextTick();
        expect(game.replayRecording).toBeTruthy(); expect(game.replayCursor).toBe(0); expect(game.replayEvents).toEqual(recording.events);
        expect(game.replayError).toBeNull();
        const baseline = saved(game), random = rng.getState(), nextId = getNextEntityId(), archive = logger.peekState();
        for (let i = 0; i < 5; i++) { vi.advanceTimersByTime(100); await Vue.nextTick(); }
        expect(saved(game)).toEqual(baseline); expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(nextId); expect(logger.peekState()).toEqual(archive);
        game.replaySeek(39); expect(game.replayCursor).toBe(39); expect(game.replayError).toBeNull();
        expect(rng.getState()).toEqual(recording.events[38]!.rng);
        const end = saved(game), endRng = rng.getState();
        game.replaySeek(0); expect(game.replayCursor).toBe(0); game.replaySeek(39);
        expect(game.replayError).toBeNull(); expect(saved(game)).toEqual(end); expect(rng.getState()).toEqual(endRng);
        expect(game.loadSnapshot(end)).toBe(true); expect(game.replayRecording).toBeNull(); expect(game.hasCompleteRecording).toBe(true);
        vi.advanceTimersByTime(100); await Vue.nextTick(); expect(rng.getState()).toEqual(endRng);
        game.executeCommand('escape'); const continued = game.exportRecording(), continuedSave = saved(game), continuedRng = rng.getState();
        expect(continued.events).toHaveLength(40);
        expect(game.loadReplay(continued)).toBe(true); game.replaySeek(40);
        // Export's public header may carry a fresh recordedAt. The loaded
        // origin must use that exact header; all world/prefix fields stay equal.
        const expected = structuredClone(continuedSave);
        expected.run.recordingOrigin!.header.recordedAt = continued.recordedAt;
        expect(game.replayCursor).toBe(40); expect(game.replayError).toBeNull(); expect(saved(game)).toEqual(expected); expect(rng.getState()).toEqual(continuedRng);
        vi.advanceTimersByTime(100); await Vue.nextTick();
    });
});

describe('replay ACK observation is quiet after retirement', () => {
    it('does not notify or alter archives/RNG/IDs on repeated empty disabled reads', () => {
        const log = new Logger(), changed = vi.fn(); log.presentAcknowledgments(() => false, changed);
        const archive = log.peekState(), random = rng.getState(), nextId = getNextEntityId();
        for (let i = 0; i < 50; i++) { expect(log.pendingAcknowledgment).toBeUndefined(); expect(log.pendingAcknowledgments).toEqual([]); }
        expect(changed).not.toHaveBeenCalled(); expect(log.peekState()).toEqual(archive); expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(nextId);
    });
    it('retires stale pending/unread/terminal display once while preserving mechanical archives', () => {
        const log = new Logger(), changed = vi.fn(); let enabled = true; log.presentAcknowledgments(() => enabled, changed);
        log.log('old live warning', '#fff', { acknowledge: true }); expect(log.pendingAcknowledgment).toBeDefined();
        log.showTerminalAcknowledgments(); expect(log.unreadAcknowledgments).toHaveLength(1);
        const archive = log.peekState(); changed.mockClear(); enabled = false;
        expect(log.pendingAcknowledgment).toBeUndefined(); expect(changed).toHaveBeenCalledTimes(1); expect(log.unreadAcknowledgments).toEqual([]);
        for (let i = 0; i < 50; i++) { expect(log.pendingAcknowledgment).toBeUndefined(); expect(log.pendingAcknowledgments).toEqual([]); }
        expect(changed).toHaveBeenCalledTimes(1); expect(log.peekState()).toEqual(archive);
    });
});
