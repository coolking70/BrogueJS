import { installRecordingScene, rechain } from './support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { Game } from '../engine/Core/Game';
import { TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { Item, ItemCategory } from '../engine/Items/Item';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { LightKind } from '../engine/Map/LightCatalog';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { logger } from '../engine/Systems/Logger';
import { DialogService } from '../ui/dialogService';
import { bindDialogCommands } from '../ui/dialogAcknowledgments';
import { recordingJsonAtBoundary } from '../ui/recordingExport';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function room(g: Game) {
    g.monsters = []; g.dormantMonsters = []; g.items = [];
    g.visibleMonsters.clear(); g.visibleItems.clear();
    for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) {
        g.grid.setTerrain(x, y, x >= 8 && x <= 16 && y >= 8 && y <= 12 ? T.FLOOR : T.GRANITE);
        const c = g.grid.getCell(x, y)!;
        Object.assign(c, { hasMemory: true, isVisible: true, isExplored: true,
            isClairvoyantVisible: false, isMagicMapped: false, isDiscovered: false,
            machineNumber: 0, rememberedLayers: [...c.layers] });
    }
    g.player.loc = { x: 10, y: 10 }; g.player.hp = g.player.maxHp = 500;
    g.player.equippedWeapon = null; g.player.equippedArmor = null;
    g.animationEnabled = false;
}
function mob(g: Game, id = 'acid_mound', x = 11, y = 10) {
    const m = new Monster(x, y, { ...monsters.find(row => row.id === id)!, hp: 500, defense: 0 } as MonsterData);
    m.state = MonsterState.ASLEEP; m.ticksUntilTurn = 10000; g.monsters.push(m); return m;
}
function weapon(g: Game, id = 'sword') {
    const w = ItemLoader.spawnWeapon(id, -1, -1)!;
    Object.assign(w, { enchantment: 0, runicType: undefined, runicKnown: false, isProtected: false });
    g.player.inventory.addItem(w); g.player.equippedWeapon = w; g.player.strength = 100;
    return w;
}
const move = (g: Game) => g.executeCommand('move', { x: 1, y: 0 });
interface Scenario { id: string; setup(g: Game): void; enter(g: Game): void; message: string }
const scenarios: Scenario[] = [
    { id: 'Q1', setup(g) { g.player.setStatusDuration('confused', 100); g.grid.setTerrain(9, 10, T.LAVA); }, enter: move, message: 'Risk stumbling into lava?' },
    { id: 'Q2', setup(g) {
        const m = mob(g, 'monkey'); m.isCaged = true;
        g.grid.setTerrain(11, 10, T.MONSTER_CAGE_CLOSED);
        const key = new Item('key', '⚿', 0xffffff, ItemCategory.KEY);
        key.keyLoc = [{ loc: { x: 11, y: 10 }, machine: 0, disposableHere: true }];
        g.player.inventory.addItem(key);
    }, enter: move, message: 'Free the captive' },
    { id: 'Q3', setup() {}, enter(g) { g.executeItemCommand('eat', g.player.inventory.items.find(i => i.category === ItemCategory.FOOD)!); }, message: "You're not hungry enough" },
    { id: 'Q4', setup(g) { const w = weapon(g); g.enterThrowMode(w); }, enter(g) { g.executeCommand('mouse_travel', { x: 15, y: 10 }); }, message: 'Are you sure you want to throw' },
    { id: 'Q5', setup(g) { const m = mob(g, 'monkey'); m.isAlly = true; m.setStatusDuration('discordant', 100); }, enter: move, message: 'Are you sure you want to attack' },
    { id: 'Q6', setup(g) { weapon(g); mob(g); }, enter: move, message: 'Degrade your' },
    { id: 'Q7', setup(g) { g.grid.setTerrain(11, 10, T.CHASM); g.grid.getCell(11, 10)!.isDiscovered = true; }, enter: move, message: 'Dive into the depths?' },
    { id: 'Q8', setup(g) { g.grid.setTerrain(11, 10, T.PLAIN_FIRE); }, enter: move, message: 'Venture into flame?' },
    { id: 'Q9', setup(g) { g.grid.setTerrain(11, 10, T.CONFUSION_GAS); }, enter: move, message: 'Venture into dangerous gas?' },
    { id: 'Q10', setup(g) { g.grid.setTerrain(11, 10, T.PRESSURE_PLATE); }, enter: move, message: 'Step onto the pressure plate?' },
];
function scene(scenario: Pick<Scenario, 'setup'>) {
    installRecordingScene(g => { room(g); scenario.setup(g); });
    return createHeadlessGame(33201);
}
/** No getState/toSnapshot/vision calls while a command is suspended. */
function world(g: Game) {
    return structuredClone({ loc: g.player.loc, hp: g.player.hp, nutrition: g.player.nutrition,
        status: g.player.statusDurations, turn: g.absoluteTurnNumber, tick: timeSystem.currentTick,
        depth: g.depth, rng: rng.getState(), stats: g.stats,
        inventory: g.player.inventory.items.map(i => ({ id: i.id, qty: i.quantity, charges: i.charges,
            enchantment: i.enchantment, letter: i.inventoryLetter, keyLoc: i.keyLoc })),
        equipment: [g.player.equippedWeapon?.id, g.player.equippedArmor?.id],
        monsters: g.monsters.map(m => ({ id: m.id, hp: m.hp, loc: m.loc, ally: m.isAlly, captive: m.isCaged, status: m.statusDurations })),
        cells: Array.from({ length: g.grid.width }, (_, x) => Array.from({ length: g.grid.height }, (_, y) => g.grid.getCell(x, y)!.layers)),
    });
}
function answer(g: Game, decision: boolean) {
    const spec = g.pendingCommandConfirmation!;
    expect(Object.isFrozen(spec)).toBe(true);
    expect(g.resolveCommandDecision(spec.token, decision)).toBe(true);
    expect(g.resolveCommandDecision(spec.token, !decision)).toBe(false);
}
function drain(g: Game) { while (g.isAdvancing) g.tickAdvancement(25); }

describe('D2 Q1–Q10 use the actual command boundary and resume original suffixes', () => {
    for (const scenario of scenarios) it.each([false, true])(`${scenario.id} answer %s matches the synchronous world and replays without Host/OOS`, decision => {
        const sync = scene(scenario), ask = vi.fn(() => decision);
        sync.onConfirmRequest = ask; scenario.enter(sync); drain(sync);
        expect(ask).toHaveBeenCalledTimes(1);
        const expected = world(sync);
        const g = scene(scenario), before = world(g), index = (g as any).recordedInputIndex;
        const prefix = vi.spyOn(g as any, 'finishTransientDisplay');
        const notify = vi.fn(); g.onCommandConfirmRequest = notify;
        g.onConfirmRequest = () => { throw new Error('classic native hook'); };
        scenario.enter(g);
        expect(g.pendingCommandConfirmation?.message).toContain(scenario.message);
        expect(world(g)).toEqual(before);
        expect((g as any).recordedInputIndex).toBe(index);
        expect(g.recordedInputEvents).toHaveLength(index);
        expect(g.canExportRecording).toBe(false);
        expect(() => g.exportRecording()).toThrow('during a command');
        expect(() => g.toSaveSnapshot()).toThrow('during a command');
        g.executeCommand('wait'); g.executeItemCommand('drop', g.player.inventory.items[0]);
        g.handlePlayerAction('move', { x: 0, y: 1 }, 'system'); g.stepAutoPath();
        g.tickAdvancement(100000);
        expect(world(g)).toEqual(before);
        const callsAtBoundary = prefix.mock.calls.length;
        answer(g, decision); drain(g);
        expect(g.hasPendingConfirmation).toBe(false);
        // Q7's original falling suffix performs its own level-transition cleanup.
        if (scenario.id !== 'Q7') expect(prefix).toHaveBeenCalledTimes(callsAtBoundary);
        expect(world(g)).toEqual(expected);
        expect((g as any).recordedInputIndex).toBe(index + 1);
        expect(g.recordedInputEvents[g.recordedInputEvents.length - 1]!.decisions).toEqual([decision]);
        const recording = g.exportRecording();
        notify.mockClear();
        expect(g.loadReplay(recording)).toBe(true);
        g.replayStep(true); drain(g);
        expect(g.replayError).toBeNull(); expect(g.replayCursor).toBe(1);
        expect(g.hasPendingConfirmation).toBe(false);
        // Lifecycle notifications may occur; no question capability is published.
        expect(g.pendingCommandConfirmation).toBeNull();
        expect(world(g)).toEqual(expected);
        g.replayRestart(); g.replaySeek(1);
        expect(g.replayError).toBeNull(); expect(g.replayCursor).toBe(1);
    });
});

describe('D2 multi-question, geometry, automatic scope and prefix contracts', () => {
    it.each(['sword', 'whip', 'spear', 'axe'])('%s keeps hitList and acid→ally question cursor; No on second question never attacks', id => {
        const g = scene({ setup(g) { weapon(g, id); const m = mob(g); m.isAlly = true; m.setStatusDuration('discordant', 100); } });
        g.onCommandConfirmRequest = () => {};
        const original = world(g); move(g);
        expect(g.pendingCommandConfirmation?.message).toContain('Degrade your');
        answer(g, true);
        expect(g.pendingCommandConfirmation?.message).toContain('Are you sure you want to attack');
        expect(world(g)).toEqual(original);
        answer(g, false); expect(world(g)).toEqual(original);
        expect(g.recordedInputEvents[g.recordedInputEvents.length - 1]!.decisions).toEqual([true, false]);
    });
    it.each(['whip', 'spear', 'axe'])('%s executes the frozen multi-target list once after both approvals', id => {
        const setup = (g: Game) => { weapon(g, id); const first = mob(g); first.isAlly = true; first.setStatusDuration('discordant', 100); mob(g, 'monkey', id === 'axe' ? 10 : 12, id === 'axe' ? 11 : 10); };
        const sync = scene({ setup }); sync.onConfirmRequest = () => true; move(sync); const expected = world(sync);
        const g = scene({ setup }); g.onCommandConfirmRequest = () => {}; move(g); answer(g, true); answer(g, true);
        expect(world(g)).toEqual(expected); expect(g.recordedInputEvents[g.recordedInputEvents.length - 1]!.decisions).toEqual([true, true]);
    });
    it.each([0, 1, 2, 3, 4])('keeps chasm→fire→gas→plate risk chain; refuse at position %s', stop => {
        const setup = (g: Game) => {
            g.grid.setTerrainLayer(11, 10, L.LIQUID, T.CHASM);
            g.grid.getCell(11, 10)!.isDiscovered = true;
            g.grid.setTerrainLayer(11, 10, L.SURFACE, T.PLAIN_FIRE);
            g.grid.setTerrainLayer(11, 10, L.GAS, T.CONFUSION_GAS);
            g.grid.setTerrainLayer(11, 10, L.DUNGEON, T.PRESSURE_PLATE);
        };
        const sync = scene({ setup }); let cursor = 0; sync.onConfirmRequest = () => cursor++ !== stop;
        move(sync); const expected = world(sync);
        const g = scene({ setup });
        const before = world(g); g.onCommandConfirmRequest = () => {}; move(g);
        const messages = ['Dive into the depths?', 'Venture into flame?', 'Venture into dangerous gas?', 'Step onto the pressure plate?'];
        const decisions: boolean[] = [];
        for (let i = 0; i < messages.length && g.hasPendingConfirmation; i++) {
            expect(g.pendingCommandConfirmation!.message).toBe(messages[i]);
            expect(world(g)).toEqual(before);
            decisions.push(i !== stop); answer(g, i !== stop);
        }
        expect(decisions).toHaveLength(Math.min(stop + 1, 4));
        expect(g.recordedInputEvents[g.recordedInputEvents.length - 1]!.decisions).toEqual(decisions);
        if (stop < 4) expect(world(g)).toEqual(before);
        expect(world(g)).toEqual(expected);
    });
    it.each([false, true])('auto_step restores only its selected step and releases Logger scope, answer %s', decision => {
        const g = scene({ setup(g) { g.grid.setTerrain(10, 10, T.PLAIN_FIRE); g.grid.setTerrain(11, 10, T.PLAIN_FIRE); } });
        // Leaving an existing fire for another fire passes the route policy; stage resumes
        // its latched next/origin after requestConfirm clears the route.
        g.autoPath = [{ x: 11, y: 10 }, { x: 12, y: 10 }]; g.disturbed = false;
        g.onCommandConfirmRequest = () => {}; logger.blockCombatText = false;
        g.executeCommand('auto_step');
        expect(g.hasPendingConfirmation).toBe(true); expect(g.autoPath).toEqual([]);
        expect(logger.blockCombatText).toBe(false); expect((g as any).inAutoTravelStep).toBe(false);
        answer(g, decision); drain(g);
        expect(logger.blockCombatText).toBe(false); expect((g as any).inAutoTravelStep).toBe(false);
        expect(g.player.loc).toEqual({ x: decision ? 11 : 10, y: 10 });
        expect(g.recordedInputEvents.map(e => e.action)).toEqual(['auto_step']);
        g.stepAutoPath(); expect(g.recordedInputEvents).toHaveLength(1);
    });
    it.each([false, true])('auto_explore restores combat blocking only while resuming, answer %s', decision => {
        const g = scene({ setup(g) { weapon(g); mob(g); } });
        const attack = (g as any).resolvePlayerMeleeAttackOn.bind(g);
        const blocks: boolean[] = [];
        vi.spyOn(g as any, 'resolvePlayerMeleeAttackOn').mockImplementation((target: unknown) => {
            blocks.push(logger.blockCombatText); return attack(target);
        });
        g.onCommandConfirmRequest = () => {}; logger.blockCombatText = false;
        g.executeCommand('auto_explore');
        expect(g.hasPendingConfirmation).toBe(true);
        expect(logger.blockCombatText).toBe(false); expect(g.isAutoTraveling()).toBe(false);
        answer(g, decision); drain(g);
        expect(blocks).toEqual(decision ? [true] : []);
        expect(logger.blockCombatText).toBe(false); expect(g.isAutoTraveling()).toBe(false);
        expect(g.recordedInputEvents).toHaveLength(1);
    });
    it('P1 stale seize clearing and P3 throw exit survive refusal without repeating the prefix', () => {
        const g = scene(scenarios[7]!); g.player.seized = true; g.onCommandConfirmRequest = () => {};
        const random = rng.getState(); move(g);
        expect(g.player.seized).toBe(false); answer(g, false);
        expect(g.player.seized).toBe(false); expect(rng.getState()).toEqual(random);
        const thrown = scene(scenarios[3]!); thrown.onCommandConfirmRequest = () => {};
        expect(thrown.isThrowing).toBe(true); scenarios[3]!.enter(thrown);
        expect(thrown.isThrowing).toBe(false); expect(thrown.throwItemTarget).toBeNull();
        answer(thrown, false); expect(thrown.isThrowing).toBe(false);
    });
    it.each([false, true])('Q1 direction draw occurs zero/one time after answer %s', decision => {
        const g = scene(scenarios[0]!); g.onCommandConfirmRequest = () => {};
        const draw = vi.spyOn(rng, 'randRange'); move(g);
        expect(draw).not.toHaveBeenCalled(); answer(g, decision);
        const directionDraws = draw.mock.calls.filter(([min, max]) => min === 0 && max === 7);
        expect(directionDraws).toHaveLength(decision ? 1 : 0);
    });
    it('unsampled P0 flare consumes cosmetic only, once, matching synchronous refusal', () => {
        const setup = (g: Game) => g.createFlare(10, 10, LightKind.SCROLL_ENCHANTMENT_LIGHT);
        const sync = scene({ setup }); const initial = rng.getState(); sync.onConfirmRequest = () => false;
        scenarios[2]!.enter(sync); const expected = world(sync);
        expect(expected.rng.streams[1]).not.toEqual(initial.streams[1]);
        expect(expected.rng.streams[0]).toEqual(initial.streams[0]);
        const g = scene({ setup }); g.onCommandConfirmRequest = () => {}; scenarios[2]!.enter(g);
        const pending = world(g); expect(pending).toEqual(expected);
        answer(g, false); expect(world(g)).toEqual(pending);
    });
});

describe('D2 asynchronous lifecycle, save/export and resolver contracts', () => {
    it.each(['captive', 'key', 'throw-item', 'throw-target', 'hit-list', 'player'])('invalidates changed %s without charging or a replacement approval', kind => {
        const scenario = scenarios[kind === 'captive' || kind === 'key' ? 1 : kind.startsWith('throw') ? 3 : kind === 'hit-list' ? 5 : 2]!;
        const g = scene(scenario); const notify = vi.fn(); g.onCommandConfirmRequest = notify; scenario.enter(g);
        const token = g.pendingCommandConfirmation!.token;
        if (kind === 'captive') g.monsters[0]!.isCaged = false;
        if (kind === 'key') g.player.inventory.removeItem(g.player.inventory.items.find(i => i.category === ItemCategory.KEY)!);
        if (kind === 'throw-item') g.player.inventory.removeItem(g.player.equippedWeapon!);
        if (kind === 'throw-target') g.grid.setTerrain(15, 10, T.GRANITE);
        if (kind === 'hit-list') g.monsters[0]!.loc = { x: 12, y: 10 };
        if (kind === 'player') g.player.nutrition--;
        const changed = world(g);
        expect(g.resolveCommandDecision(token, true)).toBe(true);
        expect(world(g)).toEqual(changed); expect(g.hasPendingConfirmation).toBe(false);
        expect(g.recordedInputEvents).toHaveLength(0); expect(g.hasCompleteRecording).toBe(false);
        expect(notify).toHaveBeenLastCalledWith('The situation has changed. Please enter the command again.');
    });
    it.each(['new', 'load', 'cancel', 'reset', 'unmount'])('%s invalidates the old capability without recording a manufactured No', lifecycle => {
        const g = createHeadlessGame(33202), saved = g.toSaveSnapshot();
        const service = new DialogService(), unbind = bindDialogCommands(service, g);
        g.executeItemCommand('eat', g.player.inventory.items.find(i => i.category === ItemCategory.FOOD)!);
        const spec = g.pendingCommandConfirmation!, uiToken = service.current!.token;
        expect(service.current).toMatchObject({ kind: 'confirm', danger: true, defaultAction: 'no' });
        if (lifecycle === 'new') g.startNewGame({ seed: 33203 });
        if (lifecycle === 'load') expect(g.loadSnapshot(saved)).toBe(true);
        if (lifecycle === 'cancel') g.cancelPendingCommand();
        if (lifecycle === 'reset') service.reset();
        if (lifecycle === 'unmount') unbind();
        expect(g.resolveCommandDecision(spec.token, true)).toBe(false);
        expect(service.answer(uiToken, 'yes')).toBe(false);
        expect(g.recordedInputEvents).toHaveLength(0); expect(g.hasPendingConfirmation).toBe(false);
        unbind(); service.dispose();
    });
    it('save/export waits beyond animation timeout, resolves once, and saves a resumable recorder', async () => {
        vi.useFakeTimers(); vi.stubGlobal('window', { setTimeout: globalThis.setTimeout });
        const g = createHeadlessGame(33204); g.onCommandConfirmRequest = () => {};
        g.executeItemCommand('eat', g.player.inventory.items.find(i => i.category === ItemCategory.FOOD)!);
        let exported = false;
        const result = recordingJsonAtBoundary(g, () => true).then(raw => { exported = true; return JSON.parse(raw); });
        await vi.advanceTimersByTimeAsync(6000);
        expect(exported).toBe(false); expect(g.hasPendingConfirmation).toBe(true); expect(g.isAdvancing).toBe(false);
        answer(g, false); await vi.advanceTimersByTimeAsync(25);
        expect((await result).events[0].decisions).toEqual([false]);
        const save = g.toSaveSnapshot(); expect(save.run.recordingOrigin).toBeDefined();
        expect(g.loadSnapshot(save)).toBe(true); expect(g.hasCompleteRecording).toBe(true);
        g.executeItemCommand('eat', g.player.inventory.items.find(i => i.category === ItemCategory.FOOD)!);
        answer(g, true);
        const recording = g.exportRecording(); expect(recording.events.map(e => e.decisions)).toEqual([[false], [true]]);
        expect(g.loadReplay(recording)).toBe(true);
        g.replayStep(); g.replayStep(); expect(g.replayError).toBeNull(); expect(g.replayCursor).toBe(2);
    });
    it('normal rendering while pending keeps the capability valid without a rule or RNG advance', () => {
        const g = createHeadlessGame(33210); g.onCommandConfirmRequest = () => {};
        g.onRenderRequested = vi.fn();
        g.executeItemCommand('eat', g.player.inventory.items.find(i => i.category === ItemCategory.FOOD)!);
        const random = rng.getState();
        (g as any).needsRender = true; g.update();
        expect(rng.getState()).toEqual(random);
        answer(g, true); drain(g);
        expect(g.recordedInputEvents[0]!.decisions).toEqual([true]);
    });
    it.each(['missing', 'surplus'])('replay keeps strict %s decision OOS checks and never asks the Host', kind => {
        const g = createHeadlessGame(33211); g.onConfirmRequest = () => false;
        g.executeItemCommand('eat', g.player.inventory.items.find(i => i.category === ItemCategory.FOOD)!);
        const recording = g.exportRecording(); recording.events[0]!.decisions = kind === 'missing' ? [] : [false, true];
        rechain(recording);
        g.onCommandConfirmRequest = () => { expect(g.pendingCommandConfirmation).toBeNull(); };
        expect(g.loadReplay(recording)).toBe(true); g.replayStep();
        expect(g.replayError).toContain('OOS at command 1'); expect(g.replayCursor).toBe(0);
    });
    it('headless null approves synchronously; explicit resolver rejects synchronously; observer failure cannot approve', () => {
        const g = createHeadlessGame(33205), food = g.player.inventory.items.find(i => i.category === ItemCategory.FOOD)!;
        g.onConfirmRequest = () => false; g.executeItemCommand('eat', food);
        g.onConfirmRequest = null; g.executeItemCommand('eat', food);
        expect(g.recordedInputEvents.map(e => e.decisions)).toEqual([[false], [true]]);
        const pending = createHeadlessGame(33206); pending.onCommandConfirmRequest = () => { throw new Error('UI failed'); };
        pending.executeItemCommand('eat', pending.player.inventory.items.find(i => i.category === ItemCategory.FOOD)!);
        expect(pending.hasPendingConfirmation).toBe(true); expect(pending.hasCompleteRecording).toBe(true);
        answer(pending, false); expect(pending.recordedInputEvents[0]!.decisions).toEqual([false]);
    });
});
