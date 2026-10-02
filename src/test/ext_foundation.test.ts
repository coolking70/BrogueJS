import { describe, expect, it, vi, afterEach } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime, type ExtensionPorts } from '../ext/runtime';
import { createExampleModule, EXAMPLE_VERSION } from '../ext/modules/example';
import * as catalog from '../ext/catalog';
import { createExtensionRegistry } from '../ext/catalog';
import { validateDefinitionPack, isAttributes, isProfession, isProgression } from '../ext/definitions';
import definitions from '../ext/modules/example/definitions.json';
import translations from '../locales/zh_CN.json';
import classicRng from './fixtures/ext-classic-rng.json';
import { Game, type GameRecording } from '../engine/Core/Game';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { Creature } from '../entities/Creature';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { createHeadlessGame } from './harness';
import monsters from '../data/monsters.json';
import { creatureView, type ExtensionModule, type Json, type HookName } from '../ext/types';

const ports = (): ExtensionPorts => ({ depth: () => 1, playerId: () => 1, randomInt: vi.fn(() => 7), message: vi.fn() });
const probe = (id: string, hooks: ExtensionModule['hooks'] = {}): ExtensionModule => ({ id, version: '1.0.0', hooks,
    initialState: () => ({}), validateState: (value: unknown): value is Json => typeof value === 'object' && value !== null });
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function extended(seed = 4101, mode: 'normal' | 'wizard' | 'test' = 'test'): Game {
    const game = createHeadlessGame(seed, 'test');
    game.startNewGame({ seed, mode, ruleSet: 'extended', extensions: ['example'] });
    return game;
}
const rat = (game: Game): Monster => new Monster(game.player.x + 1, game.player.y,
    (monsters as MonsterData[]).find(monster => monster.id === 'rat')!);
const kills = (game: Game): number => (game.extensionRuntime!.snapshot().modules.example as { kills: number }).kills;
afterEach(() => vi.restoreAllMocks());

describe('EXT-0 registry and lifecycle', () => {
    it('defers factories until enable, rejects duplicates/missing versions and dependency cycles', () => {
        const registry = new ExtensionRegistry(), factory = vi.fn(() => probe('alpha'));
        registry.register('alpha', '1.0.0', factory); expect(factory).not.toHaveBeenCalled();
        expect(() => registry.register('alpha', '1.0.0', factory)).toThrow('Duplicate');
        expect(() => registry.manifest(['alpha', 'alpha'])).toThrow('Duplicate');
        expect(() => registry.manifest(['missing'])).toThrow('Unavailable');
        expect(() => registry.validateManifest({ schema: 1, modules: [{ id: 'alpha', version: '2.0.0' }] })).toThrow('mismatch');
        expect(registry.create(registry.manifest(['alpha']))[0]!.id).toBe('alpha');
        registry.register('beta', '1.0.0', () => ({ ...probe('beta'), dependencies: ['gamma'] }));
        registry.register('gamma', '1.0.0', () => ({ ...probe('gamma'), dependencies: ['beta'] }));
        expect(() => registry.create(registry.manifest(['beta', 'gamma']))).toThrow('cycle');
        expect(() => registry.create(registry.manifest(['beta']))).toThrow('dependency');
    });
    it('orders hooks by dependencies then ID; reverses unload; rejects mutations/RNG outside simulation', () => {
        const registry = new ExtensionRegistry(), events: string[] = [];
        for (const id of ['zeta', 'alpha']) registry.register(id, '1.0.0', () => ({ ...probe(id),
            ...(id === 'alpha' ? { dependencies: ['zeta'] } : {}),
            onNewGame: context => { events.push(`init:${id}`); context.setState({ value: context.randomInt(1, 9) }); },
            onLoad: context => { expect(() => context.randomInt(1, 9)).toThrow('outside'); },
            onUnload: () => { events.push(`unload:${id}`); },
            hooks: { enteredLevel: (_event, context) => { events.push(`entry:${id}`); expect(context.state).toEqual({ value: 7 }); } },
        }));
        const runtime = new ExtensionRuntime(registry, registry.manifest(['alpha', 'zeta']), ports());
        runtime.newGame(); runtime.loaded(); runtime.emit('enteredLevel', { depth: 1, firstVisit: true }); runtime.unload(); runtime.unload();
        expect(events).toEqual(['init:zeta', 'init:alpha', 'entry:zeta', 'entry:alpha', 'unload:alpha', 'unload:zeta']);
        expect(() => runtime.emit('enteredLevel', { depth: 1, firstVisit: true })).toThrow('unloaded');
    });
    it('roundtrips module state and components for any creature, with detached snapshots and namespace validation', () => {
        const registry = new ExtensionRegistry(); registry.register('alpha', '1.0.0', () => ({ ...probe('alpha'),
            onNewGame: context => { context.setComponent(1, 'progression', { level: 2, experience: 12 }); context.setComponent(99, 'progression', { level: 3, experience: 30 }); },
        }));
        const manifest = registry.manifest(['alpha']), runtime = new ExtensionRuntime(registry, manifest, ports()); runtime.newGame();
        const snapshot = runtime.snapshot(), loaded = new ExtensionRuntime(registry, manifest, ports(), copy(snapshot));
        loaded.loaded(); expect(loaded.snapshot()).toEqual(snapshot);
        snapshot.components['99']!['alpha:progression'] = { level: 4, experience: 90 };
        expect(loaded.snapshot().components['99']!['alpha:progression']).toEqual({ level: 3, experience: 30 });
        const invalid = loaded.snapshot(); invalid.components['99']!['unknown:progression'] = {};
        expect(() => new ExtensionRuntime(registry, manifest, ports(), invalid)).toThrow('namespace');
    });
    it('validates JSON+TS definition packs and references without consuming randomness', () => {
        const before = rng.getState();
        const hasText = (key: string): boolean => Object.prototype.hasOwnProperty.call(translations, key);
        expect(() => validateDefinitionPack(definitions, hasText)).not.toThrow();
        for (const mutate of [(value: any) => { value.definitions[0].cost = -1; },
            (value: any) => { value.definitions[1].startingSkills = ['missing']; },
            (value: any) => { value.definitions[2].footprint.width = 0; },
            (value: any) => { value.definitions[3].nodes[0].choices[0].next = 'missing'; },
            (value: any) => { value.definitions[4].nameKey = 'missing.text'; }]) {
            const invalid = copy(definitions); mutate(invalid); expect(() => validateDefinitionPack(invalid, hasText)).toThrow();
        }
        expect(isProgression({ level: 1, experience: 0 })).toBe(true); expect(isAttributes({ might: 1, agility: 2, insight: 3 })).toBe(true);
        expect(isProfession({ professionId: 'example.wanderer', skillIds: [] })).toBe(true); expect(isProgression({ level: 0, experience: 0 })).toBe(false);
        expect(rng.getState()).toEqual(before);
    });
});

describe('EXT-0 live game integration', () => {
    it('orders first generation/entry hooks and reports committed pickup/use without rejected uses', () => {
        const emit = vi.spyOn(ExtensionRuntime.prototype, 'emit');
        extended(1141, 'wizard');
        const calls = emit.mock.calls.map(([name]) => name);
        const before = calls.indexOf('beforeLevelGeneration'), after = calls.indexOf('afterLevelGeneration');
        expect(before).toBeGreaterThanOrEqual(0); expect(after).toBeGreaterThan(before);
        expect(calls.indexOf('enteredLevel')).toBeGreaterThan(after);
        expect(calls.slice(before + 1, after)).toContain('creatureSpawned');
        const game = extended(); emit.mockClear(); game.monsters = []; game.dormantMonsters = [];
        const gold = ItemLoader.spawnGold(5, game.player.x, game.player.y)!; game.items = [gold];
        game.executeCommand('pickup');
        const food = game.player.inventory.items[0]!;
        expect(emit.mock.calls.filter(([name]) => name === 'itemPickedUp')).toHaveLength(1);
        expect(game.stats.gold).toBe(5);
        game.onConfirmRequest = () => false; emit.mockClear();
        game.executeItemCommand('eat', food); expect(emit.mock.calls.some(([name]) => name === 'itemUsed')).toBe(false);
        game.player.nutrition = 0; game.executeItemCommand('eat', food);
        expect(emit.mock.calls.filter(([name]) => name === 'itemUsed').map(([, event]) => event)).toEqual([
            { creature: creatureView(game.player, game.player.id), item: { id: food.id, category: food.category, quantity: food.quantity }, operation: 'eat' },
        ]);
    });
    it('uses the engine substantive stream for extension randomness and reproduces it on replay', () => {
        const registry = new ExtensionRegistry(); registry.register('randomprobe', '1.0.0', () => ({ ...probe('randomprobe'),
            onNewGame: context => context.setState({ draw: context.randomInt(1, 1000) }),
            hooks: { playerTurnEnded: (_event, context) => context.setState({ draw: context.randomInt(1, 1000) }) },
        }));
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        const game = createHeadlessGame(93, 'test'); game.startNewGame({ seed: 93, mode: 'test', ruleSet: 'extended', extensions: ['randomprobe'] });
        const before = rng.randomNumbersGenerated; game.executeCommand('wait');
        expect(rng.randomNumbersGenerated).toBeGreaterThan(before);
        const recording = game.exportRecording(), expected = rng.getState(), state = game.extensionRuntime!.snapshot();
        const replay = createHeadlessGame(5, 'test'); expect(replay.loadReplay(recording)).toBe(true); replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(rng.getState()).toEqual(expected); expect(replay.extensionRuntime!.snapshot()).toEqual(state);
    });
    it('emits spawn once on ownership, attack/damage/kill/turn in simulation order and unloads old creatures', () => {
        const game = extended(), runtime = game.extensionRuntime!, trace: HookName[] = [];
        const spy = vi.spyOn(runtime, 'emit').mockImplementation((name) => { trace.push(name); });
        const target = rat(game); target.hp = 1; target.defense = 0; target.state = MonsterState.ASLEEP;
        game.monsters = [target]; game.monsters = [...game.monsters];
        expect(trace).toEqual(['creatureSpawned']); trace.length = 0;
        game.executeCommand('move', { x: 1, y: 0 });
        expect(trace.slice(0, 4)).toEqual(['beforeAttack', 'damage', 'kill', 'afterAttack']);
        expect(trace[trace.length - 1]).toBe('playerTurnEnded');
        spy.mockRestore(); game.startNewGame({ seed: 4101, mode: 'test' });
        expect(target.extensionHooks).toBeUndefined(); expect(game.extensionRuntime).toBeNull();
    });
    it('demonstrates example kill message/count, administrative exclusion and exact save/load without replayed spawn hooks', () => {
        const game = extended(), target = rat(game); game.monsters = [target];
        const messages = vi.spyOn(logger, 'log'); target.takeDamage(target.hp, true); game.killMonster(target);
        expect(kills(game)).toBe(1); expect(messages.mock.calls.some(([text]) => text.includes('total kills 1'))).toBe(true);
        const admin = rat(game); game.monsters.push(admin); game.killMonster(admin, true); expect(kills(game)).toBe(1);
        const snapshot = copy(game.toSnapshot()), before = rng.getState(), loaded = createHeadlessGame(52, 'test');
        expect(loaded.loadSnapshot(snapshot)).toBe(true); expect(kills(loaded)).toBe(1); expect(rng.getState()).toEqual(before);
        expect(loaded.toSnapshot().extensions).toEqual(snapshot.extensions);
        const second = rat(loaded); loaded.monsters.push(second); second.takeDamage(second.hp, true); expect(kills(loaded)).toBe(2);
    });
    it('rejects unavailable sets, wrong module versions/state and stripped extended headers before retiring the current game', () => {
        const game = extended(), recording = game.exportRecording(), current = game.player;
        for (const mutate of [(r: GameRecording) => { r.extensions!.modules[0]!.version = '9.0.0'; },
            (r: GameRecording) => { r.extensions!.modules.push({ id: 'missing', version: '1.0.0' }); }]) {
            const bad = copy(recording); mutate(bad); expect(game.loadReplay(bad)).toBe(false); expect(game.player).toBe(current);
        }
        const invalid = copy(game.toSnapshot()); invalid.extensions!.modules.example = { kills: -1 };
        expect(game.loadSnapshot(invalid)).toBe(false); expect(game.player).toBe(current);
        for (const events of [{}, 'invalid', null]) {
            expect(game.loadReplay({ version: 2, seed: 4101, mode: 'test', events })).toBe(false);
            expect(game.player).toBe(current);
        }
        game.executeCommand('wait'); const stripped = game.exportRecording(); delete stripped.extensions;
        expect(game.loadReplay(stripped)).toBe(false);
    });
    it('replays a natural example kill, seek and save continuation with exact extension/RNG checkpoints', () => {
        const game = extended(1141, 'wizard');
        for (let i = 0; i < 600 && kills(game) === 0; i++) {
            while (logger.pendingAcknowledgment) logger.acknowledgeNext();
            const adjacent = game.monsters.find(monster => monster.hp > 0 && !monster.isAlly && !monster.isCaged
                && Math.max(Math.abs(monster.x - game.player.x), Math.abs(monster.y - game.player.y)) === 1);
            if (adjacent) game.executeCommand('move', { x: adjacent.x - game.player.x, y: adjacent.y - game.player.y });
            else if (game.autoPath.length) game.executeCommand('auto_step');
            else game.executeCommand('auto_explore');
        }
        expect(kills(game)).toBeGreaterThan(0);
        const recording = copy(game.exportRecording()), expected = game.extensionRuntime!.snapshot(), expectedRng = rng.getState();
        const saved = copy(game.toSaveSnapshot()), loaded = createHeadlessGame(1, 'test');
        expect(loaded.loadSnapshot(saved)).toBe(true); expect(loaded.hasCompleteRecording).toBe(true);
        expect(loaded.exportRecording().extensions).toEqual(recording.extensions);
        while (logger.pendingAcknowledgment) logger.acknowledgeNext(); loaded.executeCommand('wait');
        const continued = loaded.exportRecording(), continuedExtensions = loaded.extensionRuntime!.snapshot();
        const replay = createHeadlessGame(3, 'test'); expect(replay.loadReplay(recording)).toBe(true);
        for (let i = 0; i < recording.events.length; i++) replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(replay.extensionRuntime!.snapshot()).toEqual(expected); expect(rng.getState()).toEqual(expectedRng);
        replay.replaySeek(recording.events.length); expect(replay.replayError).toBeNull(); expect(replay.extensionRuntime!.snapshot()).toEqual(expected);
        expect(replay.loadReplay(continued)).toBe(true);
        for (let i = 0; i < continued.events.length; i++) replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(replay.extensionRuntime!.snapshot()).toEqual(continuedExtensions);
        const tampered = copy(recording); tampered.events[tampered.events.length - 1]!.extensions!.modules.example = { kills: 999 };
        expect(replay.loadReplay(tampered)).toBe(true);
        for (let i = 0; i < tampered.events.length; i++) replay.replayStep(true);
        expect(replay.replayError).toContain('extension state mismatch');
    });
    it('routes extension commands through executeCommand and refuses missing commands in classic mode', () => {
        const game = extended(), registry = new ExtensionRegistry(); registry.register('alpha', '1.0.0', () => ({ ...probe('alpha'),
            commands: { add: (payload, context) => context.setState({ value: payload }) },
        }));
        game.extensionRuntime!.unload(); game.extensionRuntime = new ExtensionRuntime(registry, registry.manifest(['alpha']), ports());
        game.executeCommand('ext:command', JSON.stringify({ module: 'alpha', action: 'add', payload: 2 }));
        expect(game.extensionRuntime.snapshot().modules.alpha).toEqual({ value: 2 });
        expect(game.recordedInputEvents[0]!.action).toBe('ext:command');
        game.startNewGame({ seed: 2, mode: 'test' }); expect(() => game.executeCommand('ext:command', '{}')).toThrow('classic');
    });
    it('classic mode never enables example/factory/hooks, carries no ext state and uses unchanged substantive RNG', () => {
        const module = vi.spyOn(ExtensionRuntime.prototype, 'newGame'), hook = vi.spyOn(ExtensionRuntime.prototype, 'emit');
        const create = vi.spyOn(ExtensionRegistry.prototype, 'create'), initial = vi.spyOn(ExtensionRegistry.prototype, 'manifest');
        const game = createHeadlessGame(4101, 'test');
        expect(rng.getState()).toEqual(classicRng.initial);
        const target = rat(game); target.hp = 1; target.defense = 0; target.state = MonsterState.ASLEEP;
        game.monsters = [target]; game.executeCommand('move', { x: 1, y: 0 });
        expect(rng.getState()).toEqual(classicRng.combat);
        for (let i = 0; i < 3; i++) game.executeCommand('wait');
        expect(rng.getState()).toEqual(classicRng.afterWait);
        const snapshot = game.toSaveSnapshot(), recording = game.exportRecording();
        expect(game.loadReplay(recording)).toBe(true); game.replayStep(true);
        expect(game.extensionRuntime).toBeNull(); expect(target.extensionHooks).toBeUndefined();
        expect(snapshot.extensions).toBeUndefined(); expect(recording.extensions).toBeUndefined();
        expect(module).not.toHaveBeenCalled(); expect(hook).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled(); expect(initial).not.toHaveBeenCalled();
    });
    it('example hooks may use no RNG, including repeated dispatch outside game fixtures', () => {
        const registry = createExtensionRegistry(), p = ports(), runtime = new ExtensionRuntime(registry, registry.manifest(['example']), p);
        runtime.newGame(); const creature = new Creature(3, 3, 'rat', 'r', 1);
        runtime.emit('kill', { creature: creatureView(creature, 1), sourceId: 1, administrative: false });
        expect(p.randomInt).not.toHaveBeenCalled(); expect(runtime.snapshot().modules.example).toEqual({ kills: 1 });
        expect(createExampleModule().version).toBe(EXAMPLE_VERSION);
    });
});
