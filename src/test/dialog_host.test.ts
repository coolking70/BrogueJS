import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import * as translation from 'i18next-vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import ts from 'typescript';
import { parse, compileScript } from '@vue/compiler-sfc';
import { readFileSync } from 'node:fs';
import { DialogService, dialogServiceKey } from '../ui/dialogService';
import { dialogInput } from '../ui/dialogInput';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import { createHeadlessGame } from './harness';
import { ItemCategory } from '../engine/Items/Item';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { TerrainType } from '../engine/Map/Grid';
import type { Game } from '../engine/Core/Game';
import zhCN from '../locales/zh_CN.json';

// Compile real client SFCs and exercise their lifecycle/DOM input contracts.
// This renderer does not claim browser CSS geometry or physical touch coverage.
interface Node {
    type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null;
    contains(target: unknown): boolean; closest(selector: string): Node | null;
    getAttribute(name: string): string | null; querySelector<T>(selector: string): T | null;
    querySelectorAll<T>(selector: string): T[];
    focus(): void; readonly isConnected: boolean;
}
let documentStub: { activeElement: Node | null; querySelector: () => null; hidden: boolean };
const all = (root: Node): Node[] => [root, ...root.children.flatMap(all)];
const node = (type: string, text = ''): Node => Vue.markRaw({ type, text, props: {} as Record<string, any>, children: [], parent: null,
    contains(target) { return all(this).includes(target as Node); },
    closest(selector) {
        if (selector === '[data-dialog-action]' && this.props['data-dialog-action']) return this;
        if (selector === '[data-dialog-action="view-result"]' && this.props['data-dialog-action'] === 'view-result') return this;
        return this.parent?.closest(selector) ?? null;
    },
    getAttribute(name) { return this.props[name] ?? null; },
    querySelector<T>(selector: string) {
        const action = selector.match(/data-dialog-action="([^"]+)"/)?.[1];
        return (all(this).find(item => item.props['data-dialog-action'] === action) ?? null) as T | null;
    },
    querySelectorAll<T>(selector: string) { return all(this).filter(item => item.type === selector) as T[]; },
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
let Host: Vue.Component, Inventory: Vue.Component, Reference: Vue.Component;
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
    documentStub = { activeElement: null, querySelector: () => null, hidden: false };
    vi.stubGlobal('document', documentStub);
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    const modules: Record<string, unknown> = { vue: Vue, 'i18next-vue': translation,
        i18next: { default: i18next, __esModule: true }, '../engine/Core/Game': gameModule,
        '../ui/dialogService': await import('../ui/dialogService'), '../ui/dialogInput': await import('../ui/dialogInput'),
        '../ui/dialogAcknowledgments': await import('../ui/dialogAcknowledgments'), '../ui/heldInput': await import('../ui/heldInput'),
        '../engine/Systems/Logger': await import('../engine/Systems/Logger'), '../engine/Input': await import('../engine/Input'),
        '../engine/Items/Item': await import('../engine/Items/Item'), '../engine/Items/ItemLoader': { ItemLoader },
        '../engine/UI/DetailGenerator': await import('../engine/UI/DetailGenerator'),
        '../engine/UI/ItemDetailContext': await import('../engine/UI/ItemDetailContext'),
        '../engine/UI/Discoveries': await import('../engine/UI/Discoveries'),
    };
    function compile(name: string): Vue.Component {
        const { descriptor } = parse(readFileSync(new URL('../components/' + name + '.vue', import.meta.url), 'utf8'));
        const script = compileScript(descriptor, { id: name, inlineTemplate: true });
        const code = ts.transpileModule(script.content, { compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
        } }).outputText;
        const exports: any = {};
        new Function('require', 'exports', code)((key: string) => {
            if (!(key in modules)) throw new Error('Unresolved D1 component import: ' + key);
            return modules[key];
        }, exports);
        return exports.default;
    }
    Host = compile('DialogHost'); Inventory = compile('InventoryOverlay'); Reference = compile('ReferenceOverlay');
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
