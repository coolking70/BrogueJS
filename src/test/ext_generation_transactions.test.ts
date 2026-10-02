import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../engine/Core/Game';
import { BlueprintEngine, type BlueprintDef, type FeatureDef, type MachineEntityRuntime, type MachineResult } from '../engine/Generator/BlueprintEngine';
import { Architect } from '../engine/Generator/Architect';
import { Grid, TerrainType, DungeonLayer, DCOLS, DROWS } from '../engine/Map/Grid';
import { Monster, type MonsterData } from '../entities/Monster';
import { getNextEntityId } from '../entities/Creature';
import monsterData from '../data/monsters.json';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import { type Json, type HookName, type ExtensionModule } from '../ext/types';
import { rng, RNGType, type RandomState } from '../engine/Random';
import { logger, Logger } from '../engine/Systems/Logger';
import { createHeadlessGame } from './harness';
import { dyingMonsters } from '../engine/Core/MonsterLifecycle';
import { buildHordeMachine } from '../engine/Core/GenerationCoordinator';
import { setDungeonFeatureEffects, setDormantAwakener, setAllyResurrector, spawnDungeonFeature, type DungeonFeature } from '../engine/Map/DungeonFeature';
import { DFF_ACTIVATE_DORMANT_MONSTER, DFF_RESURRECT_ALLY } from '../engine/Map/DungeonFeatureCatalog';

afterEach(() => vi.restoreAllMocks());

function setup(hooks: ExtensionModule['hooks'] = {}) {
    const game = createHeadlessGame(517, 'test');
    game.monsters = []; game.dormantMonsters = [];
    const registry = new ExtensionRegistry();
    const facts: Array<{ name: HookName; id?: number }> = [];
    const randomStates: RandomState[] = [];
    const randomInt = vi.fn((min: number, max: number) => {
        randomStates.push(rng.getState());
        const stream = rng.getState().currentRNG;
        rng.setRNG(RNGType.RNG_SUBSTANTIVE);
        try { return rng.randRange(min, max); } finally { rng.setRNG(stream); }
    });
    registry.register('generation-probe', '1.0.0', () => ({
        id: 'generation-probe', version: '1.0.0',
        initialState: () => ({ births: 0, damage: 0, kills: 0 }),
        validateState: (value: unknown): value is Json => value !== null && typeof value === 'object',
        hooks: {
            creatureSpawned: ({ creature }, context) => {
                facts.push({ name: 'creatureSpawned', id: creature.id });
                const state = context.state as { births: number; damage: number; kills: number };
                context.setState({ ...state, births: state.births + 1 });
                context.setComponent(creature.id, 'birth', { draw: context.randomInt(1, 9999) });
                context.message(`birth:${creature.id}`);
            },
            damage: ({ creature }, context) => {
                facts.push({ name: 'damage', id: creature.id });
                const state = context.state as { births: number; damage: number; kills: number };
                context.setState({ ...state, damage: state.damage + 1 });
            },
            kill: ({ creature }, context) => {
                facts.push({ name: 'kill', id: creature.id });
                const state = context.state as { births: number; damage: number; kills: number };
                context.setState({ ...state, kills: state.kills + 1 });
            },
            generationRolledBack: (_event, context) => {
                expect(() => context.randomInt(1, 2)).toThrow('outside');
                expect(() => context.message('speculative')).toThrow('outside');
                expect(() => context.setState({})).toThrow('outside');
            },
            ...hooks,
        },
    }));
    const runtime = new ExtensionRuntime(registry, registry.manifest(['generation-probe']), {
        depth: () => game.depth, playerId: () => game.player.id, randomInt,
        message: message => logger.log(message),
    });
    game.extensionRuntime = runtime;
    runtime.attachCreature(game.player, false);
    return { game, runtime, randomInt, randomStates, facts };
}

const spawnFeature = (): FeatureDef => ({ instanceCount: [1, 1], flags: [], monsterId: 'rat' });
function machine(game: Game, features: FeatureDef[], runtime?: MachineEntityRuntime) {
    const cells = [];
    for (let x = 4; x < 30; x++) for (let y = 4; y < 20; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR); cells.push({ x, y });
    }
    const adapter = runtime ?? (game as any).createMachineRuntime(game.depth) as MachineEntityRuntime;
    const engine: any = new BlueprintEngine(game.grid, game.depth, [], adapter);
    const bp: BlueprintDef = { id: 'transaction-fixture', name: 'transaction-fixture', category: 'thematic',
        depthRange: [1, 26], roomSize: [1, 900], frequency: 1, flags: ['BP_NO_INTERIOR_FLAG'], features };
    const room = { cells, center: { x: 16, y: 12 }, door: null };
    let count = 0;
    engine.findFeaturePosition = () => ({ x: 7 + count++, y: 8 });
    return { engine, adapter, bp, room, apply: () => engine.applyBlueprint(bp, room) as MachineResult | null };
}

function generate(game: Game, depth: number): void {
    game.depth = depth;
    (game as any).generateDepth(false, false);
}

function stableWorld(game: Game): unknown {
    const snapshot = game.toSnapshot();
    const { savedAt: _time, ...world } = snapshot;
    // Failed construction retains CE's monotonic entity/machine allocation.
    delete (world.run as any).nextEntityId;
    delete (world.run as any).nextMachineNumber;
    return JSON.parse(JSON.stringify(world));
}

describe('extension blueprint generation transactions', () => {
    it('the horde-machine entry point outside floor generation publishes its actual blueprint once', () => {
        const { game, runtime, facts, randomInt } = setup();
        const fixture = machine(game, [spawnFeature()]);
        vi.spyOn(BlueprintEngine.prototype, 'buildAMachine').mockImplementation(function (this: BlueprintEngine) {
            return (this as any).applyBlueprint(fixture.bp, fixture.room);
        });
        const built = buildHordeMachine((game as any).makeGenerationPorts(), 900, fixture.room.center, 1);
        expect(built).not.toBeNull();
        expect(facts).toEqual([{ name: 'creatureSpawned', id: game.monsters[0]!.id }]);
        expect(randomInt).toHaveBeenCalledTimes(1);
        expect(() => runtime.snapshot()).not.toThrow();
    });

    it('failed top-level horde-machine publication restores disturbance, module RNG, messages and the existing world', () => {
        const { game, runtime, randomInt } = setup({ creatureSpawned: ({ creature }, context) => {
            context.setState({ speculative: true });
            context.setComponent(creature.id, 'birth', { draw: context.randomInt(1, 9999) });
            context.message('failed top-level publication');
            throw new Error('horde publication failed');
        } });
        const original = new Monster(40, 20, (monsterData as MonsterData[]).find(row => row.id === 'rat')!);
        runtime.attachCreature(original, false); game.monsters.push(original);
        const fixture = machine(game, [spawnFeature()]);
        vi.spyOn(BlueprintEngine.prototype, 'buildAMachine').mockImplementation(function (this: BlueprintEngine) {
            return (this as any).applyBlueprint(fixture.bp, fixture.room);
        });
        game.disturbed = false;
        const before = stableWorld(game) as { rngState: RandomState };
        const messages = logger.getState(), state = runtime.snapshot();
        const commit = runtime.commitGeneration.bind(runtime);
        let beforePublication: RandomState | undefined;
        vi.spyOn(runtime, 'commitGeneration').mockImplementation(token => {
            beforePublication = rng.getState();
            commit(token);
        });
        expect(() => buildHordeMachine((game as any).makeGenerationPorts(), 900, fixture.room.center, 1))
            .toThrow('horde publication failed');
        expect(randomInt).toHaveBeenCalledTimes(1);
        expect(game.disturbed).toBe(false);
        expect(game.monsters).toEqual([original]); expect(game.monsters[0]).toBe(original);
        expect(logger.getState()).toEqual(messages); expect(runtime.snapshot()).toEqual(state);
        expect(rng.getState()).toEqual(beforePublication);
        // The machine's original engine construction draws are retained; only
        // failed module publication is reversed at this nested engine boundary.
        before.rngState = beforePublication!;
        expect(stableWorld(game)).toEqual(before);
    });

    it('discards real failed blueprint births, damage, death and module RNG; successful retry publishes once', () => {
        const { game, runtime, randomInt, facts } = setup();
        const failed = spawnFeature();
        const fixture = machine(game, [spawnFeature(), failed]);
        const made: Monster[] = [];
        const spawn = fixture.adapter.spawn.bind(fixture.adapter);
        vi.spyOn(fixture.adapter, 'spawn').mockImplementation((request, number) => {
            const monsters = spawn(request, number); made.push(...monsters);
            monsters[0]!.takeDamage(monsters[0]!.hp, true);
            expect(facts).toEqual([]); expect(randomInt).not.toHaveBeenCalled();
            return monsters;
        });
        fixture.engine.findFeaturePosition = (_a: unknown, _b: unknown, _c: unknown, _d: unknown, feature: FeatureDef) => feature === failed ? null : { x: 8, y: 8 };
        const state = runtime.snapshot(), messages = logger.getState(), counter = rng.randomNumbersGenerated;
        expect(fixture.apply()).toBeNull();
        expect(runtime.snapshot()).toEqual(state);
        expect(facts).toEqual([]); expect(randomInt).not.toHaveBeenCalled();
        expect(logger.getState()).toEqual(messages);
        expect(rng.randomNumbersGenerated).toBeGreaterThan(counter);
        expect(made).toHaveLength(1); expect(made[0]!.extensionHooks).toBeUndefined();
        vi.mocked(fixture.adapter.spawn).mockRestore();
        fixture.bp.features = [spawnFeature()];
        expect(fixture.apply()).not.toBeNull();
        expect(randomInt).toHaveBeenCalledTimes(1);
        expect(facts).toEqual([{ name: 'creatureSpawned', id: game.monsters[0]!.id }]);
        expect(runtime.snapshot().components[String(made[0]!.id)]).toBeUndefined();
        expect(Object.keys(runtime.snapshot().components)).toEqual([String(game.monsters[0]!.id)]);
    });

    for (const failParent of [false, true]) it(`real nested blueprint commit ${failParent ? 'is discarded with its failed parent' : 'only publishes at parent success'}`, () => {
        const { game, runtime, randomInt, facts } = setup();
        const failure = spawnFeature();
        const fixture = machine(game, [spawnFeature(), { instanceCount: [1, 1], flags: ['MF_BUILD_VESTIBULE'] }, ...(failParent ? [failure] : [])]);
        let position = 0;
        fixture.engine.findFeaturePosition = (_a: unknown, _b: unknown, _c: unknown, _d: unknown, feature: FeatureDef) => feature === failure ? null : { x: 7 + position++, y: 8 };
        const child = { ...fixture.bp, id: 'nested-child', features: [spawnFeature()] };
        const childCalls = vi.spyOn(fixture.engine, 'buildAMachine').mockImplementation(() => {
            const result = fixture.engine.applyBlueprint(child, fixture.room);
            expect(result).not.toBeNull(); expect(facts).toEqual([]); expect(randomInt).not.toHaveBeenCalled();
            return result;
        });
        const before = runtime.snapshot();
        const result = fixture.apply();
        expect(childCalls).toHaveBeenCalledTimes(1);
        if (failParent) {
            expect(result).toBeNull(); expect(game.monsters).toEqual([]);
            expect(runtime.snapshot()).toEqual(before); expect(randomInt).not.toHaveBeenCalled(); expect(facts).toEqual([]);
        } else {
            expect(result).not.toBeNull(); expect(randomInt).toHaveBeenCalledTimes(2);
            const ids = game.monsters.map(monster => monster.id).sort((a, b) => a - b);
            expect(facts.map(fact => fact.id)).toEqual(ids);
            expect(Object.keys(runtime.snapshot().components).map(Number)).toEqual(ids);
        }
    });

    it('initializes stable IDs first and preserves the original order of the remaining nested facts', () => {
        const { game, runtime, facts } = setup();
        const outer = runtime.beginGeneration('outer');
        const data = (monsterData as MonsterData[]).find(monster => monster.id === 'rat')!;
        const low = new Monster(6, 6, data), high = new Monster(7, 6, data);
        game.monsters.push(high); high.takeDamage(1, true);
        const inner = runtime.beginGeneration('inner');
        game.monsters.push(low); low.takeDamage(1, true);
        runtime.commitGeneration(inner);
        high.takeDamage(1, true);
        expect(facts).toEqual([]);
        expect(() => runtime.snapshot()).toThrow();
        runtime.commitGeneration(outer);
        expect(facts).toEqual([
            { name: 'creatureSpawned', id: low.id }, { name: 'creatureSpawned', id: high.id },
            { name: 'damage', id: high.id }, { name: 'damage', id: low.id }, { name: 'damage', id: high.id },
        ]);
        expect(() => runtime.snapshot()).not.toThrow();
    });

    it('does not try to close an already rolled-back blueprint if a read-only diagnostic throws', () => {
        const { game, runtime } = setup({ generationRolledBack: () => { throw new Error('diagnostic failed'); } });
        const fixture = machine(game, [spawnFeature()]);
        fixture.engine.findFeaturePosition = () => null;
        expect(() => fixture.apply()).toThrow('diagnostic failed');
        expect(() => runtime.snapshot()).not.toThrow();
    });
});

describe('extension floor generation transactions', () => {
    it('checkpoints pending combat and acknowledgments without observing or flushing them', () => {
        const log = new Logger(), disturb = vi.fn();
        log.onDisturb = disturb;
        log.presentAcknowledgments(() => true);
        log.log('existing', '#123456', { acknowledge: true });
        log.hearCombat('unflushed');
        const messages = structuredClone(log.messages), acknowledgment = { ...log.pendingAcknowledgment! };
        disturb.mockClear();
        const restore = log.checkpoint();
        expect(log.messages).toEqual(messages); expect(disturb).not.toHaveBeenCalled();
        expect(log.pendingAcknowledgment).toEqual(acknowledgment);
        log.log('speculative', '#ffffff', { acknowledge: true });
        log.acknowledgeNext(); log.endCombatTurn(); log.turn = 12; log.blockCombatText = true;
        restore();
        expect(log.messages).toEqual(messages); expect(log.pendingAcknowledgment).toEqual(acknowledgment);
        expect(log.turn).toBe(0); expect(log.blockCombatText).toBe(false);
        log.hearCombat('should still be suppressed');
        log.flushCombat();
        expect(log.messages.map(message => message.text)).toEqual(['existing', 'unflushed']);
        log.log('next'); expect(log.messages.map(message => message.id)).toEqual([0, 1, 2]);
    });

    it('real generation discards the first stair attempt and dispatches committed births only after the run RNG is restored', () => {
        const { game, runtime, facts, randomInt, randomStates } = setup();
        game.mode = 'normal';
        const place = (game as any).placeStairs.bind(game);
        const dig = Architect.prototype.generateLevel;
        vi.spyOn(Architect.prototype, 'generateLevel').mockImplementation(function (this: Architect, ...args) {
            const grid = dig.apply(this, args);
            // Guarantee a real machine birth even when this seed's natural
            // geometry has no creature-bearing machine before stair placement.
            const fixture = machine(game, [spawnFeature()], (this as any).machineEntities);
            const built = fixture.apply();
            expect(built).not.toBeNull();
            this.machineResults.push(built!);
            return grid;
        });
        const discarded: Monster[] = [];
        let attempts = 0;
        vi.spyOn(game as any, 'placeStairs').mockImplementation((...args: unknown[]) => {
            expect(facts).toEqual([]); expect(randomInt).not.toHaveBeenCalled();
            attempts++;
            if (attempts === 1) { discarded.push(...game.monsters, ...game.dormantMonsters); return false; }
            return place(...args);
        });
        const commit = runtime.commitGeneration.bind(runtime);
        let beforeCommit: RandomState | undefined;
        const render = vi.fn(() => {
            expect(randomInt).toHaveBeenCalled(); expect(() => runtime.snapshot()).not.toThrow();
        });
        game.onRenderRequested = render;
        vi.spyOn(runtime, 'commitGeneration').mockImplementation(token => {
            if (token.label === 'floor') beforeCommit = rng.getState();
            commit(token);
        });
        generate(game, 2);
        expect(attempts).toBeGreaterThanOrEqual(2); expect(discarded.length).toBeGreaterThan(0);
        const births = facts.filter(fact => fact.name === 'creatureSpawned').map(fact => fact.id!);
        expect(births.length).toBeGreaterThan(0); expect(new Set(births).size).toBe(births.length);
        expect(births).toEqual([...births].sort((a, b) => a - b));
        expect(births.some(id => discarded.some(monster => monster.id === id))).toBe(false);
        expect(discarded.every(monster => monster.extensionHooks === undefined)).toBe(true);
        expect(randomInt).toHaveBeenCalledTimes(births.length);
        expect(randomStates[0]).toEqual(beforeCommit);
        expect(render).toHaveBeenCalledTimes(1);
        expect(() => runtime.snapshot()).not.toThrow();
    });

    for (const duringAdvancement of [false, true]) it(`50 failed stair attempts preserve the old world, runtime and RNG${duringAdvancement ? ' during turn advancement' : ''}`, () => {
        const { game, runtime, facts, randomInt } = setup();
        game.mode = 'normal';
        const before = stableWorld(game), oldGrid = game.grid, oldPlayer = game.player, oldMonsters = game.monsters;
        const nextId = getNextEntityId();
        const made: Monster[] = [];
        vi.spyOn(Architect.prototype, 'generateLevel').mockImplementation(function (this: Architect) {
            const grid = (this as any).grid as Grid;
            for (let x = 1; x < DCOLS - 1; x++) for (let y = 1; y < DROWS - 1; y++) grid.setTerrain(x, y, TerrainType.FLOOR);
            const mon = new Monster(8, 8, (monsterData as MonsterData[]).find(row => row.id === 'rat')!);
            game.monsters.push(mon); made.push(mon);
            return grid;
        });
        vi.spyOn(game as any, 'placeStairs').mockReturnValue(false);
        (game as any).isAdvancing = duringAdvancement;
        expect(() => generate(game, 2)).toThrow('after 50 attempts');
        expect((game as any).isAdvancing).toBe(duringAdvancement);
        (game as any).isAdvancing = false;
        expect(game.grid).toBe(oldGrid); expect(game.player).toBe(oldPlayer); expect(game.monsters).toBe(oldMonsters);
        expect(game.extensionRuntime).toBe(runtime); expect(game.depth).toBe(1);
        expect(stableWorld(game)).toEqual(before);
        expect(made).toHaveLength(50); expect(getNextEntityId()).toBeGreaterThan(nextId);
        expect(made.every(monster => monster.extensionHooks === undefined)).toBe(true);
        expect(facts).toEqual([]); expect(randomInt).not.toHaveBeenCalled();
    });

    it('a failing committed hook restores module state, world identity, messages and RNG without unloading the old runtime', () => {
        const { game, runtime } = setup({ enteredLevel: (_event, context) => {
            context.setState({ replaced: true }); context.randomInt(1, 99); context.message('failed publication');
            throw new Error('publication failed');
        } });
        game.mode = 'normal';
        const before = stableWorld(game), player = game.player, grid = game.grid;
        const unload = vi.spyOn(runtime, 'unload');
        expect(() => generate(game, 2)).toThrow('publication failed');
        expect(game.player).toBe(player); expect(game.grid).toBe(grid); expect(game.extensionRuntime).toBe(runtime);
        expect(unload).not.toHaveBeenCalled(); expect(stableWorld(game)).toEqual(before);
    });

    it('a presentation callback throwing after commit cannot roll back the completed transition', () => {
        const { game, runtime, facts } = setup();
        game.mode = 'normal';
        game.onRenderRequested = () => { throw new Error('render failed'); };
        expect(() => generate(game, 2)).toThrow('render failed');
        expect(game.depth).toBe(2); expect(game.levelSeeds[1]!.visited).toBe(true);
        expect(facts.some(fact => fact.name === 'creatureSpawned')).toBe(true);
        expect(() => runtime.snapshot()).not.toThrow();
    });

    it('restores the death-processing WeakSet for a pre-existing creature killed by a failed transition', () => {
        const { game, facts } = setup();
        game.mode = 'normal';
        const target = new Monster(game.player.x + 1, game.player.y,
            (monsterData as MonsterData[]).find(monster => monster.id === 'rat')!);
        game.monsters.push(target); facts.length = 0;
        const hp = target.hp;
        vi.spyOn(game as any, 'catchUpEnvironment').mockImplementation(() => {
            game.monsters.push(target);
            target.takeDamage(target.hp, true);
            expect(dyingMonsters.has(target)).toBe(true);
            throw new Error('failed catch-up');
        });
        expect(() => generate(game, 2)).toThrow('failed catch-up');
        expect(game.monsters).toContain(target); expect(target.hp).toBe(hp);
        expect(target.deathProcessed).toBe(false); expect(dyingMonsters.has(target)).toBe(false);
        expect(facts).toEqual([]);
        target.takeDamage(target.hp, true);
        expect(target.deathProcessed).toBe(true);
        expect(facts.filter(fact => fact.name === 'kill')).toEqual([{ name: 'kill', id: target.id }]);
    });

    it('restores cached-grid callback bindings and description eligibility after a failed revisit', () => {
        const { game } = setup();
        game.mode = 'normal';
        const cachedGrid = game.grid;
        generate(game, 2);
        const activeGrid = game.grid;
        const describe = vi.fn(() => true), awaken = vi.fn(), resurrect = vi.fn(() => true);
        setDungeonFeatureEffects(cachedGrid, { describe });
        setDormantAwakener(cachedGrid, awaken); setAllyResurrector(cachedGrid, resurrect);
        const feature: DungeonFeature = { tile: TerrainType.NOTHING, layer: DungeonLayer.SURFACE,
            startProbability: 0, probabilityDecrement: 0, flags: 0, propagationTerrain: TerrainType.NOTHING,
            subsequentDF: null, description: 'pending description', lightFlare: '', flashColor: '', effectRadius: 0 };
        const alreadySeen = { ...feature, description: 'earlier description' };
        spawnDungeonFeature(cachedGrid, 8, 8, alreadySeen, false);
        expect(describe).toHaveBeenCalledTimes(1);
        vi.spyOn(game as any, 'catchUpEnvironment').mockImplementation(() => {
            spawnDungeonFeature(game.grid, 8, 8, feature, false, { effects: { describe: () => true } });
            throw new Error('failed cached catch-up');
        });
        expect(() => generate(game, 1)).toThrow('failed cached catch-up');
        expect(game.grid).toBe(activeGrid); expect((game as any).levels.get(1).grid).toBe(cachedGrid);
        spawnDungeonFeature(cachedGrid, 8, 8, alreadySeen, false);
        expect(describe).toHaveBeenCalledTimes(1);
        spawnDungeonFeature(cachedGrid, 8, 8, feature, false);
        expect(describe).toHaveBeenCalledTimes(2);
        spawnDungeonFeature(cachedGrid, 8, 8, { ...feature, description: '',
            flags: DFF_ACTIVATE_DORMANT_MONSTER | DFF_RESURRECT_ALLY }, false);
        expect(awaken).toHaveBeenCalledTimes(1); expect(resurrect).toHaveBeenCalledTimes(1);
    });
});
