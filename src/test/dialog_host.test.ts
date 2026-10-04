import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { createSfcHarness } from './support/sfcHarness';
import { DialogService, dialogServiceKey } from '../ui/dialogService';
import { dialogInput } from '../ui/dialogInput';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import { createHeadlessGame } from './harness';
import { ItemCategory } from '../engine/Items/Item';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { TerrainType } from '../engine/Map/Grid';
import type { Game } from '../engine/Core/Game';
import { setupDialogD3Scene } from './support/dialogD3Scene';
import { setupDialogD4Scene } from './support/dialogD4Scene';
import { activeGame } from '../engine/Core/Game';
import { displayedFrame, presentationTimeline } from '../ui/presentationTimeline';
import zhCN from '../locales/zh_CN.json';
import { targetingTapCommand } from '../ui/targeting';
let inputManager: (typeof import('../engine/Input'))['inputManager'];
import { registerHeldInput } from '../ui/heldInput';

// Compile real client SFCs and exercise their lifecycle/DOM input contracts.
// This renderer does not claim browser CSS geometry or physical touch coverage.
interface Node {
    type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null;
    contains(target: unknown): boolean; closest(selector: string): Node | null;
    hasAttribute(name: string): boolean; getAttribute(name: string): string | null; querySelector<T>(selector: string): T | null;
    querySelectorAll<T>(selector: string): T[];
    focus(): void; readonly isConnected: boolean; scrollTop: number; clientHeight: number; scrollHeight: number;
}
let documentStub: { activeElement: Node | null; querySelector: () => null; hidden: boolean };
const all = (root: Node): Node[] => [root, ...root.children.flatMap(all)];
const node = (type: string, text = ''): Node => Vue.markRaw({ type, text, props: {} as Record<string, any>, children: [], parent: null, scrollTop: 0, clientHeight: 200, scrollHeight: 1000,
    contains(target) { return all(this).includes(target as Node); },
    closest(selector) {
        if (selector === '[style*="display: none"]' && this.props.style?.display === 'none') return this;
        if (selector === '[data-dialog-action]' && this.props['data-dialog-action']) return this;
        if (selector === '[data-dialog-action="view-result"]' && this.props['data-dialog-action'] === 'view-result') return this;
        return this.parent?.closest(selector) ?? null;
    },
    hasAttribute(name) { return this.props[name] !== undefined && this.props[name] !== false; },
    getAttribute(name) { return this.props[name] ?? null; },
    querySelector<T>(selector: string) {
        const action = selector.match(/data-dialog-action="([^"]+)"/)?.[1];
        return (all(this).find(item => item.props['data-dialog-action'] === action) ?? null) as T | null;
    },
    querySelectorAll<T>(selector: string) { return all(this).filter(item => selector === 'button, [tabindex="0"]' ? item.type === 'button' || item.props.tabindex === '0'
        : selector === '[data-dialog-scroll]' ? !!item.props['data-dialog-scroll'] : item.type === selector) as T[]; },
    focus() { documentStub.activeElement = this; },
    get isConnected() { return !!this.parent; },
});
let body: Node;
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
    patchProp: (n, key, _old, value) => { n.props[key] = value; }, querySelector: () => body,
});
let Host: Vue.Component, Inventory: Vue.Component, Reference: Vue.Component, Hud: Vue.Component, End: Vue.Component, Journal: Vue.Component, Nearby: Vue.Component, Target: Vue.Component;
const gameModule = { activeGame: {} as Game };
let app: ReturnType<typeof renderer.createApp> | undefined;
let root: Node, service: DialogService;
const epoch = Vue.ref(0);
let clock = 10000;
const findAction = (action: string) => all(body).find(n => n.props['data-dialog-action'] === action);
const findDialog = () => all(body).find(n => !!n.props['data-dialog-kind']);
const event = (key: string, repeat = false, target: unknown = documentStub.activeElement) => ({ key, code: key === ' ' ? 'Space' : key,
    repeat, target, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }) as unknown as KeyboardEvent;
const release = (key: string) => dialogInput.keyup(event(key));
const press = (key: string, repeat = false) => dialogInput.keydown(event(key, repeat));
const click = (target: Node, id = 1) => {
    const pointer = { target, pointerId: id, button: 0, clientX: 0, clientY: 0,
        preventDefault() {}, stopImmediatePropagation() {} } as unknown as PointerEvent;
    dialogInput.pointerdown(pointer); dialogInput.pointerup(pointer);
};
const settle = async () => { vi.advanceTimersByTime(100); await Vue.nextTick(); };
function mount(inventory = false, reference = false) {
    root = node('root'); body.children.push(root); root.parent = body;
    app = renderer.createApp({ render: () => Vue.h('main', [
        inventory ? Vue.h(Inventory) : null, reference ? Vue.h(Reference) : null, Vue.h(Host, { service, epoch: epoch.value }),
    ]) });
    app.use(I18NextVue, { i18next }); app.provide(dialogServiceKey, service); app.mount(root);
}
beforeAll(async () => {
    vi.stubGlobal('window', Object.assign(new EventTarget(), { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval }));
    ({ inputManager } = await import('../engine/Input'));
    documentStub = { activeElement: null, querySelector: () => null, hidden: false };
    vi.stubGlobal('document', documentStub);
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    const harness = createSfcHarness({ baseURL: import.meta.url, stubs: { '../engine/Core/Game': gameModule } });
    Host = await harness.load('../components/DialogHost.vue'); Inventory = await harness.load('../components/InventoryOverlay.vue');
    Reference = await harness.load('../components/ReferenceOverlay.vue'); Hud = await harness.load('../components/theme/ThemeHud.vue');
    End = await harness.load('../components/GameEndOverlay.vue'); Journal = await harness.load('../components/MessageJournal.vue');
    Nearby = await harness.load('../components/theme/ThemeNearby.vue'); Target = await harness.load('../components/TargetBar.vue');
});
beforeEach(() => {
    vi.useFakeTimers(); logger.reset(); service = new DialogService(); epoch.value = 0;
    body = node('body'); documentStub.activeElement = null;
    gameModule.activeGame = { player: {}, replayRecording: null, isGameOver: false } as unknown as Game;
    clock += 1000;
    vi.spyOn(performance, 'now').mockReturnValue(clock);
});
afterEach(() => {
    for (const key of ['Enter', ' ', 'Escape', 'y', 'Y', 'n', 'N', 'ArrowRight', 'Tab', 'r']) release(key);
    app?.unmount(); app = undefined; service.dispose();
    logger.presentAcknowledgments(null); vi.useRealTimers(); vi.restoreAllMocks();
});
afterAll(() => { dialogInput.dispose(); vi.unstubAllGlobals(); });

describe('D1 real DialogHost', () => {
    it('renders stable selectors, danger, Chinese long text and both buttons, focuses no, and keeps CE Enter=yes', async () => {
        mount(); const source = node('button'); root.children.push(source); source.parent = root; source.focus();
        const answer = vi.fn(), text = '确认内容\n'.repeat(300);
        service.request({ kind: 'confirm', text, owner: 'inventory:use', danger: true, defaultAction: 'no', onAnswer: answer });
        await Vue.nextTick();
        expect(findDialog()?.props).toMatchObject({ 'data-dialog-kind': 'confirm', 'data-dialog-owner': 'inventory:use', 'data-dialog-id': 1 });
        expect(findDialog()?.props.class).toContain('dialog-danger');
        expect(all(body).some(n => n.text === text)).toBe(true);
        expect(findAction('yes')?.text).toBe('是'); expect(findAction('no')?.text).toBe('否');
        expect(documentStub.activeElement).toBe(findAction('no'));
        press('Enter'); await Vue.nextTick();
        expect(answer).toHaveBeenCalledWith('yes'); expect(documentStub.activeElement).toBe(source);
    });
    it('MORE keeps invalid movement keys and emits a hint without logging; advancing does not disable its pointer input', async () => {
        mount(); logger.log('first warning', '#fff', { acknowledge: true });
        gameModule.activeGame.isAdvancing = true; await Vue.nextTick();
        const archive = logger.getState(), random = rng.getState();
        press('ArrowRight'); await Vue.nextTick();
        expect(logger.pendingAcknowledgment?.text).toBe('first warning');
        expect(all(body).some(n => n.props.class === 'dialog-invalid')).toBe(true);
        expect(logger.getState()).toEqual(archive); expect(rng.getState()).toEqual(random);
        click(findAction('more')!); await Vue.nextTick();
        expect(findDialog()).toBeUndefined(); expect(logger.getState()).toEqual(archive);
    });
    it('epoch invalidates the old answer and destroyed source focus returns without throwing', async () => {
        mount(); const answer = vi.fn();
        const request = service.request({ kind: 'confirm', text: 'old', owner: 'test', onAnswer: answer });
        await Vue.nextTick(); epoch.value++; await settle();
        expect(await request.result).toEqual({ status: 'cancelled' });
        expect(service.answer(request.token, 'yes')).toBe(false); expect(findDialog()).toBeUndefined();
        expect(answer).not.toHaveBeenCalled();
    });
    it('Host captures before the real Reference handler and returns ownership after a fresh key', async () => {
        const game = gameModule.activeGame;
        game.referenceScreen = 'help';
        game.executeCommand = vi.fn(() => { game.referenceScreen = null; });
        mount(false, true); logger.log('warning', '#fff', { acknowledge: true }); await settle();
        press('ArrowRight'); release('ArrowRight');
        expect(game.executeCommand).not.toHaveBeenCalled(); expect(game.referenceScreen).toBe('help');
        press(' '); release(' '); press('ArrowRight');
        expect(game.executeCommand).toHaveBeenCalledWith('escape');
    });
    it('the real triggerAction admission blocks agent/touch commands while Host owns input', async () => {
        const { inputManager } = await import('../engine/Input');
        const command = vi.fn(); inputManager.setCallback(command); mount();
        service.request({ kind: 'confirm', text: 'question', owner: 'test', onAnswer() {} });
        inputManager.triggerAction('move', 0); expect(command).not.toHaveBeenCalled();
        press('n'); release('n'); inputManager.triggerAction('move', 0);
        expect(command).toHaveBeenCalledExactlyOnceWith('move', 0);
        inputManager.setCallback(() => {});
    });
});

describe('D1 real inventory command adapter', () => {
    function scene(kind: 'potion' | 'scroll', animated = false) {
        const game = createHeadlessGame(33006, 'test'); gameModule.activeGame = game;
        game.monsters = []; game.dormantMonsters = []; game.items = []; game.player.loc = { x: 10, y: 10 };
        for (let x = 5; x < 16; x++) for (let y = 5; y < 16; y++) game.grid.setTerrain(x, y, TerrainType.FLOOR);
        game.player.inventory.items = []; game.player.statusDurations = {};
        const item = kind === 'potion' ? ItemLoader.spawnPotion('potion_of_darkness', -1, -1)!
            : ItemLoader.spawnScroll('scroll_of_aggravate_monsters', -1, -1)!;
        expect(item).toBeDefined(); game.player.inventory.addItem(item); ItemLoader.detectMagicOnItem(item);
        expect(game.requiresMalevolentUseConfirmation(item)).toBe(true);
        game.animationEnabled = animated; game.executeCommand('toggle_inventory');
        mount(true, true);
        return { game, item };
    }
    it.each(['potion', 'scroll'] as const)('%s cancel keeps item, time, both RNGs and original cancel event semantics', async kind => {
        const { game, item } = scene(kind);
        press('ArrowRight'); // The trigger key is still physically held when the question opens.
        game.executeItemCommand(kind === 'potion' ? 'quaff' : 'read', item);
        service.sync(); await Vue.nextTick();
        expect(findDialog()?.props['data-dialog-kind']).toBe('confirm');
        const random = rng.getState(), turn = game.absoluteTurnNumber, events = game.recordedInputEvents.length;
        const world = game.toSnapshot(); world.savedAt = 0;
        press('ArrowRight', true); expect(game.recordedInputEvents).toHaveLength(events);
        click(findAction('no')!); await Vue.nextTick();
        const after = game.toSnapshot(); after.savedAt = 0;
        // Cancel keeps the whole world and appends only the existing recorder event/index.
        expect(game.player.inventory.items).toContain(item); expect(game.absoluteTurnNumber).toBe(turn);
        expect(rng.getState()).toEqual(random);
        const differences: string[] = [];
        const compare = (left: unknown, right: unknown, path = '') => {
            if (Object.is(left, right)) return;
            if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
                differences.push(`${path}: ${String(left)} => ${String(right)}`); return;
            }
            for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
                compare((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key], path + '/' + key);
            }
        };
        compare(world, after); expect(differences).toEqual([
            `/run/recordedInputEvents/${events}: undefined => [object Object]`,
            `/run/recordedInputIndex: ${events} => ${events + 1}`,
        ]);
        expect(game.recordedInputEvents).toHaveLength(events + 1);
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]).toMatchObject({ action: 'item:command', data: 'cancel||', decisions: [] });
        expect(game.pendingUseConfirm).toBeNull();
    });
    it('approval consumes once and preserves deferred inventory close', async () => {
        const { game, item } = scene('potion', true);
        game.executeItemCommand('quaff', item); service.sync(); await Vue.nextTick();
        press('Enter'); press('Enter', true); await Vue.nextTick();
        expect(game.pendingUseConfirm).toBeNull();
        expect(game.player.inventory.items).not.toContain(item);
        expect(game.recordedInputEvents.filter(event => event.data === 'confirm||')).toHaveLength(1);
        while (game.isAdvancing) game.tickAdvancement(25);
        await settle(); expect(game.isInventoryOpen).toBe(false);
    });
    it('unmount cancels the UI request and cannot issue a late item command', async () => {
        const { game, item } = scene('potion'); game.executeItemCommand('quaff', item); service.sync();
        const token = service.current!.token, count = game.recordedInputEvents.length;
        app!.unmount(); app = undefined;
        expect(service.answer(token, 'yes')).toBe(false);
        expect(game.recordedInputEvents).toHaveLength(count); expect(game.player.inventory.items).toContain(item);
    });
});


describe('D2 real Host resumes engine command capabilities', () => {
    it.each([false, true])('inventory food answer %s keeps waiting command unrecorded and closes only after completion', async decision => {
        const game = createHeadlessGame(33207); gameModule.activeGame = game;
        game.animationEnabled = true;
        const food = game.player.inventory.items.find(item => item.category === ItemCategory.FOOD)!;
        game.executeCommand('toggle_inventory'); mount(true); await Vue.nextTick();
        const native = vi.fn(() => { throw new Error('native classic confirmation'); });
        game.onConfirmRequest = native;
        const row = all(body).find(n => n.props.class === 'item-letter' && n.text.startsWith(food.inventoryLetter!))!.parent!;
        row.props.onClick(); await Vue.nextTick();
        const eat = all(body).find(n => n.type === 'button' && n.text === '食用');
        expect(eat).toBeDefined(); eat!.props.onClick(); await Vue.nextTick();
        const count = game.recordedInputEvents.length;
        expect(game.hasPendingConfirmation).toBe(true);
        expect(game.isInventoryOpen).toBe(true);
        expect(findDialog()?.props['data-dialog-owner']).toMatch(/^command:/);
        game.executeCommand('wait'); expect(game.recordedInputEvents).toHaveLength(count);
        vi.advanceTimersByTime(6000); expect(game.hasPendingConfirmation).toBe(true);
        click(findAction(decision ? 'yes' : 'no')!); await Vue.nextTick();
        while (game.isAdvancing) game.tickAdvancement(25);
        await settle();
        expect(native).not.toHaveBeenCalled(); expect(game.hasPendingConfirmation).toBe(false);
        expect(game.recordedInputEvents[count]!.decisions).toEqual([decision]);
        expect(game.player.inventory.items.includes(food)).toBe(!decision);
        expect(game.isInventoryOpen).toBe(false);
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.action).toBe('escape');
    });
    it('engine multi-question risk chain requires a fresh keyboard lifecycle for the next question', async () => {
        const game = createHeadlessGame(33208); gameModule.activeGame = game;
        game.monsters = []; game.player.loc = { x: 10, y: 10 }; game.player.hp = 500;
        game.grid.setTerrain(10, 10, TerrainType.FLOOR);
        game.grid.setTerrain(11, 10, TerrainType.PRESSURE_PLATE);
        game.grid.setTerrainLayer(11, 10, 3, TerrainType.PLAIN_FIRE);
        Object.assign(game.grid.getCell(11, 10)!, { isVisible: true, hasMemory: true });
        mount(); game.executeCommand('move', { x: 1, y: 0 }); await Vue.nextTick();
        const first = service.current!.token;
        press('Enter'); await Vue.nextTick();
        expect(service.current?.token).not.toBe(first);
        expect(service.current?.text).toContain('压力板');
        press('Enter', true); expect(game.hasPendingConfirmation).toBe(true);
        release('Enter'); press('n'); release('n'); await Vue.nextTick();
        expect(game.player.loc).toEqual({ x: 10, y: 10 });
        expect(game.recordedInputEvents[0]!.decisions).toEqual([true, false]);
        expect(findDialog()).toBeUndefined();
    });
    it('Host unmount invalidates a real engine continuation without committing a No', async () => {
        const game = createHeadlessGame(33209); gameModule.activeGame = game; mount();
        const food = game.player.inventory.items.find(item => item.category === ItemCategory.FOOD)!;
        game.executeItemCommand('eat', food); await Vue.nextTick();
        const spec = game.pendingCommandConfirmation!, token = service.current!.token;
        app!.unmount(); app = undefined;
        expect(game.resolveCommandDecision(spec.token, true)).toBe(false);
        expect(service.answer(token, 'yes')).toBe(false);
        expect(game.recordedInputEvents).toEqual([]); expect(game.player.inventory.items).toContain(food);
    });
});


// D3 runs the real Host/HUD/journal/nearby/target/end SFCs against the same
// cursor. Geometry, WebGL and physical touch remain browser acceptance work.
const byClass = (name: string) => all(root).find(n => n.props.class?.split(' ').includes(name));
const textOf = (root: Node): string => root.text + root.children.map(textOf).join('');

describe('D4 actual TargetBar and Host input', () => {
    it.each(['target-bar', 'touch', 'keyboard'] as const)('%s opens the same risk capability, stops held input and rejects stale releases/repeats', async entry => {
        window.setInterval = ((...args: Parameters<typeof setInterval>) => globalThis.setInterval(...args)) as typeof window.setInterval;
        window.clearInterval = (id => globalThis.clearInterval(id)) as typeof window.clearInterval;
        activeGame.startNewGame({ seed: 33441 });
        const { item, aim } = setupDialogD4Scene(activeGame, false);
        gameModule.activeGame = activeGame;
        activeGame.executeItemCommand('use', item);
        for (let i = 0; i < 10; i++) activeGame.executeCommand('move', { x: 1, y: 0 });
        root = node('root'); body.children.push(root); root.parent = body;
        app = renderer.createApp({ render: () => Vue.h('main', [Vue.h(Target), Vue.h(Host, { service, epoch: epoch.value })]) });
        app.use(I18NextVue, { i18next }); app.provide(dialogServiceKey, service); app.mount(root);
        await Vue.nextTick();
        const stop = vi.fn();
        // This document is a renderer fixture; provide only listener methods for
        // the actual shared held-input registry.
        Object.assign(documentStub, { addEventListener() {}, removeEventListener() {} });
        const removeHold = registerHeldInput(stop);
        inputManager.setCallback((action, data) => activeGame.handlePlayerAction(action, data));
        const resolver = vi.fn(() => { throw new Error('native blink resolver'); }); activeGame.onConfirmRequest = resolver;
        const random = rng.getState(), turn = activeGame.absoluteTurnNumber, index = activeGame.recordedInputEvents.length;
        try {
            press('ArrowRight');
            if (entry === 'target-bar') byClass('tb-btn')!.props.onClick();
            if (entry === 'touch') {
                const command = targetingTapCommand('arcana', aim, null, activeGame.pendingArcana!.cursor, activeGame.player.loc);
                expect(command.kind).toBe('dispatch');
                if (command.kind === 'dispatch') inputManager.triggerAction(command.action, 'data' in command ? command.data : undefined);
            }
            if (entry === 'keyboard') {
                press('Enter'); inputManager.triggerAction('confirm_target');
            }
            await Vue.nextTick();
            expect(stop).toHaveBeenCalled(); expect(findDialog()?.props['data-dialog-kind']).toBe('confirm');
            expect(service.current?.text).toBe(zhCN['arcana.blink_unknown_lava']);
            expect(activeGame.recordedInputEvents).toHaveLength(index); expect(item.charges).toBe(2);
            press('ArrowRight', true); inputManager.triggerAction('wait');
            // An old pointerup never approves; a fresh Host press is required.
            dialogInput.pointerup({ pointerId: 87, button: 0, target: findAction('yes'), clientX: 0, clientY: 0,
                preventDefault() {}, stopImmediatePropagation() {} } as unknown as PointerEvent);
            press('Enter', true); vi.advanceTimersByTime(6000);
            expect(activeGame.hasPendingConfirmation).toBe(true); expect(rng.getState()).toEqual(random);
            if (entry === 'keyboard') { release('Enter'); press('Enter'); }
            else if (entry === 'target-bar') click(findAction('no')!);
            else press('Escape');
            await Vue.nextTick();
            expect(activeGame.hasPendingConfirmation).toBe(false); expect(resolver).not.toHaveBeenCalled();
            const approved = entry === 'keyboard';
            expect(item.charges).toBe(approved ? 1 : 2); expect(activeGame.absoluteTurnNumber).toBe(turn + (approved ? 1 : 0));
            expect(activeGame.recordedInputEvents[index]).toMatchObject({ action: 'arcana:risk-confirm', decisions: [approved] });
            press('ArrowRight', true); expect(activeGame.recordedInputEvents).toHaveLength(index + 1);
            release('ArrowRight');
            if (!approved) expect(rng.getState()).toEqual(random);
        } finally { inputManager.setCallback(() => {}); removeHold(); activeGame.onConfirmRequest = null; }
    });
});

const settleTimeline = async () => { vi.advanceTimersByTime(250); await Vue.nextTick(); };
function mountTimeline(automatic = false, animation = true) {
    window.setInterval = ((...args: Parameters<typeof setInterval>) => globalThis.setInterval(...args)) as typeof window.setInterval;
    window.clearInterval = (id => globalThis.clearInterval(id)) as typeof window.clearInterval;
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    activeGame.startNewGame({ seed: 33421 }); setupDialogD3Scene(activeGame, animation);
    gameModule.activeGame = activeGame;
    root = node('root'); body.children.push(root); root.parent = body;
    app = renderer.createApp({ render: () => Vue.h('main', [Vue.h(Hud), Vue.h(Nearby), Vue.h(Journal), Vue.h(Target),
        Vue.h(End, { canSaveReplay: true }), Vue.h(Host, { service, epoch: epoch.value })]) });
    app.use(I18NextVue, { i18next }); app.provide(dialogServiceKey, service); app.mount(root);
    if (automatic) { activeGame.autoPath = [{ x: 11, y: 10 }]; activeGame.executeCommand('auto_step'); }
    else activeGame.executeCommand('move', { x: 1, y: 0 });
    while (activeGame.isAdvancing) activeGame.tickAdvancement(25);
    return presentationTimeline(activeGame)!;
}

describe('D3 actual client projections and terminal input', () => {
    it.each([false, true])('animation=%s: HUD/journal/nearby freeze with MORE and resume together', async animation => {
        const timeline = mountTimeline(false, animation); await settleTimeline();
        expect(activeGame.isGameOver).toBe(true);
        expect(byClass('th-hp-cur')?.text).toBe('36');
        const first = displayedFrame(activeGame)!;
        expect(textOf(byClass('message-journal')!)).not.toContain('被麻痹');
        expect(textOf(byClass('theme-nearby')!)).toContain(first.rows.find(row => row.kind === 'monster')!.name);
        expect(byClass('game-end-overlay')).toBeUndefined();
        vi.advanceTimersByTime(60_000); timeline.tick(60_000); await Vue.nextTick();
        expect(byClass('th-hp-cur')?.text).toBe('36'); expect(displayedFrame(activeGame)).toBe(first);
        click(findAction('more')!); await settleTimeline();
        expect(displayedFrame(activeGame)).not.toBe(first); expect(byClass('th-hp-cur')?.text).toBe(String(displayedFrame(activeGame)!.player.hp));
        expect(textOf(byClass('message-journal')!)).toContain('被麻痹');
        for (let i = 0; timeline.busy && i < 100; i++) {
            clock += 1000;
            if (findAction('more')) click(findAction('more')!);
            else timeline.tick(25);
            await settleTimeline();
        }
        expect(byClass('th-hp-cur')?.text).toBe('0');
        expect(byClass('game-end-overlay')).toBeDefined(); expect(findDialog()).toBeUndefined();
    });
    it('automatic action: explicit results preserve unread occurrences, final save and return are available', async () => {
        const timeline = mountTimeline(true); await settleTimeline();
        const archive = structuredClone(logger.messages), pending = logger.pendingAcknowledgments.map(message => ({ ...message }));
        click(findAction('view-result')!); await settleTimeline();
        expect(timeline.busy).toBe(false); expect(findDialog()).toBeUndefined();
        expect(byClass('game-end-overlay')).toBeDefined();
        expect(logger.unreadAcknowledgments).toEqual(pending); expect(logger.messages).toEqual(archive);
        expect(byClass('return-btn')?.props.disabled).toBe(false);
        expect(byClass('save-replay-btn')?.props.disabled).toBe(false);
        expect(() => activeGame.toSaveSnapshot()).not.toThrow();
        byClass('return-btn')!.props.onClick(); epoch.value++; await settleTimeline();
        expect(logger.unreadAcknowledgments).toHaveLength(0); expect(displayedFrame(activeGame)).toBeUndefined();
    });
    it('results stay reachable during the animation interval between ACKs, with matching physical release', async () => {
        const timeline = mountTimeline(); await settleTimeline();
        // Consume through the first forced-turn frame, leaving a 25ms delay.
        for (let i = 0; timeline.acknowledgment && i < 100; i++) {
            clock += 1000; click(findAction('more')!); await settleTimeline();
        }
        expect(timeline.busy).toBe(true); expect(findDialog()).toBeUndefined();
        expect(findAction('view-result')).toBeDefined();
        clock += 1000; click(findAction('view-result')!); await settleTimeline();
        expect(timeline.terminalReady).toBe(true); expect(byClass('game-end-overlay')).toBeDefined();
    });
});

describe('D3 inventory presentation boundaries', () => {
    function inventoryScene(animated = false) {
        window.setInterval = ((...args: Parameters<typeof setInterval>) => globalThis.setInterval(...args)) as typeof window.setInterval;
        window.clearInterval = (id => globalThis.clearInterval(id)) as typeof window.clearInterval;
        vi.spyOn(performance, 'now').mockImplementation(() => clock);
        const game = createHeadlessGame(33422); gameModule.activeGame = game;
        game.monsters = []; game.dormantMonsters = []; game.items = [];
        game.player.loc = { x: 10, y: 10 }; game.player.statusDurations = {};
        for (let x = 5; x < 16; x++) for (let y = 5; y < 16; y++) game.grid.setTerrain(x, y, TerrainType.FLOOR);
        game.animationEnabled = animated; game.executeCommand('toggle_inventory');
        mount(true);
        return game;
    }
    it.each(['scroll_of_identify', 'scroll_of_enchantment'])('%s opens mandatory targets only after its reveal ACK', async kind => {
        const game = inventoryScene(), scroll = ItemLoader.spawnScroll(kind, -1, -1)!;
        game.player.inventory.addItem(ItemLoader.spawnPotion('potion_of_strength', -1, -1)!);
        game.player.inventory.addItem(scroll); await settleTimeline();
        expect(byClass('inventory-overlay')).toBeDefined();
        game.executeItemCommand('read', scroll); await settleTimeline();
        expect(game.pendingIdentify || game.pendingEnchantment).toBe(true);
        expect(findAction('more')).toBeDefined();
        expect(byClass('inventory-overlay')).toBeUndefined();
        clock += 1000; click(findAction('more')!); await settleTimeline();
        expect(presentationTimeline(game)!.busy).toBe(false);
        expect(byClass('inventory-overlay')).toBeDefined();
        expect(byClass('identify-banner')).toBeDefined();
        game.executeCommand('escape');
        expect(game.pendingIdentify || game.pendingEnchantment).toBe(true);
        expect(game.isInventoryOpen).toBe(true);
    });
    it('quaff keeps its deferred close across an ACK-free animation interval', async () => {
        const game = inventoryScene(true), potion = ItemLoader.spawnPotion('potion_of_paralysis', -1, -1)!;
        game.player.inventory.addItem(potion); await settleTimeline();
        const row = all(body).find(n => n.props.class === 'item-letter' && n.text.startsWith(potion.inventoryLetter!))!.parent!;
        row.props.onClick(); await Vue.nextTick();
        const quaff = all(body).find(n => n.type === 'button' && n.text === i18next.t('Quaff'))!;
        expect(quaff).toBeDefined(); quaff.props.onClick();
        while (game.isAdvancing) game.tickAdvancement(25);
        const timeline = presentationTimeline(game)!; await settleTimeline();
        expect(timeline.busy).toBe(true); expect(game.isInventoryOpen).toBe(true);
        for (let i = 0; timeline.acknowledgment && i < 100; i++) {
            clock += 1000; click(findAction('more')!); await settleTimeline();
        }
        expect(timeline.busy).toBe(true); expect(findDialog()).toBeUndefined();
        // The deferred-close poll runs here, when no Host request is visible.
        await settleTimeline(); expect(game.isInventoryOpen).toBe(true);
        for (let i = 0; timeline.busy && i < 100; i++) {
            clock += 1000;
            if (findAction('more')) click(findAction('more')!); else timeline.tick(25);
            await settleTimeline();
        }
        expect(timeline.busy).toBe(false); expect(game.isInventoryOpen).toBe(false);
        expect(game.recordedInputEvents.filter(event => event.action === 'escape')).toHaveLength(1);
    });
});


describe('Shared Host module-owned dialogue content', () => {
    it('focuses enabled content actions and cycles only visible choices, with digits using projected indexes', async () => {
        mount();
        const Content = Vue.defineComponent({ render: () => Vue.h('div', [
            Vue.h('button', { 'data-dialog-action': 'close' }, 'close'),
            Vue.h('button', { 'data-dialog-action': 'choice:first' }, 'first'),
            Vue.h('button', { 'data-dialog-action': 'choice:disabled', disabled: true }, 'disabled'),
            Vue.h('button', { 'data-dialog-action': 'choice:last' }, 'last'),
            Vue.h('div', { style: { display: 'none' } }, [Vue.h('button', { 'data-dialog-action': 'choice:hidden' }, 'hidden')]),
        ]) });
        const answer = vi.fn();
        service.request({ kind: 'dialogue', owner: 'test-module', text: '', content: { component: Content, props: {} },
            actions: ['close','choice:first','choice:last'], defaultAction: 'choice:first',
            choices: [{ action: 'choice:first', enabled: true }, { action: 'choice:disabled', enabled: false }, { action: 'choice:last', enabled: true }], onAnswer: answer });
        await Vue.nextTick();
        expect(documentStub.activeElement).toBe(findAction('choice:first'));
        press('ArrowDown'); release('ArrowDown'); expect(documentStub.activeElement).toBe(findAction('choice:last'));
        press('ArrowDown'); release('ArrowDown'); expect(documentStub.activeElement).toBe(findAction('choice:first'));
        press('2'); release('2'); expect(answer).not.toHaveBeenCalled();
        press('3'); release('3'); expect(answer).toHaveBeenCalledWith('choice:last');
    });
    it('Escape on a nested display page returns within the same host without invoking close', async () => {
        mount(); const answer = vi.fn();
        service.request({ kind: 'dialogue', owner: 'test-module', text: '', actions: ['back','close'],
            content: { component: Vue.defineComponent({ render: () => Vue.h('button', { 'data-dialog-action': 'back' }, 'back') }), props: {} }, onAnswer: answer });
        await Vue.nextTick(); press('Escape'); release('Escape');
        expect(answer).toHaveBeenCalledExactlyOnceWith('back');
    });
});


describe('Shared Host readable long dialogue', () => {
    it('scrolls the visible text with captured paging keys and traps Tab after the text region', async () => {
        mount();
        service.request({ kind: 'dialogue', owner: 'test-module', text: '', actions: ['close'], defaultAction: 'close',
            content: { component: Vue.defineComponent({ render: () => Vue.h('div', [
                Vue.h('button', { 'data-dialog-action': 'close' }, 'close'),
                Vue.h('div', { 'data-dialog-scroll': 'body', tabindex: '0' }, 'long text'),
            ]) }), props: {} }, onAnswer: () => true });
        await Vue.nextTick();
        const region = all(body).find(n => n.props['data-dialog-scroll'])!;
        region.focus(); press('PageDown'); release('PageDown'); expect(region.scrollTop).toBe(176);
        press('End'); release('End'); expect(region.scrollTop).toBe(1000);
        press('Home'); release('Home'); expect(region.scrollTop).toBe(0);
        press('Tab'); release('Tab'); expect(documentStub.activeElement).toBe(findAction('close'));
        expect(service.current?.kind).toBe('dialogue');
    });
});
