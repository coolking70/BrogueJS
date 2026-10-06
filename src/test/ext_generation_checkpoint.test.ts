import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, type LevelState, type RecordedInputEvent } from '../engine/Core/Game';
import * as generation from '../engine/Core/GenerationCoordinator';
import { Architect } from '../engine/Generator/Architect';
import { DungeonLayer, TerrainType } from '../engine/Map/Grid';
import { catalogFeature, spawnDungeonFeature } from '../engine/Map/DungeonFeature';
import { DF } from '../engine/Map/DungeonFeatureCatalog';
import { GasType } from '../engine/Environment/Gas';
import { Item, ItemCategory } from '../engine/Items/Item';
import { Monster, type MonsterData } from '../entities/Monster';
import monsterData from '../data/monsters.json';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import type { Json } from '../ext/types';
import { rng, RNGType } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { dyingMonsters } from '../engine/Core/MonsterLifecycle';
import { createHeadlessGame } from './harness';

afterEach(() => vi.restoreAllMocks());

function setup() {
    const game = createHeadlessGame(517, 'test');
    game.monsters = []; game.dormantMonsters = [];
    game.mode = 'normal';
    let failPublication = false;
    const published = vi.fn();
    const registry = new ExtensionRegistry();
    registry.register('checkpoint-probe', '1.0.0', () => ({
        id: 'checkpoint-probe', version: '1.0.0', initialState: () => ({ entered: 0 }),
        validateState: (value: unknown): value is Json => value !== null && typeof value === 'object',
        hooks: { enteredLevel: (_event, context) => {
            published();
            if (!failPublication) return;
            context.setState({ entered: 999 });
            context.setComponent(game.player.id, 'speculation', { draw: context.randomInt(1, 999) });
            context.message('checkpoint publication failed');
            throw new Error('checkpoint publication failed');
        } },
    }));
    const runtime = new ExtensionRuntime(registry, registry.manifest(['checkpoint-probe']), {
        depth: () => game.depth, playerId: () => game.player.id,
        randomInt: (min, max) => {
            const stream = rng.getState().currentRNG;
            rng.setRNG(RNGType.RNG_SUBSTANTIVE);
            try { return rng.randRange(min, max); } finally { rng.setRNG(stream); }
        },
        message: text => logger.log(text),
    });
    game.extensionRuntime = runtime;
    runtime.attachCreature(game.player, false);
    return { game, runtime, published, failPublication: () => { failPublication = true; } };
}

function enter(game: Game, depth: number, fell = false): void {
    const goingUp = depth < game.depth;
    game.depth = depth;
    (game as any).generateDepth(goingUp, false, fell);
}

function rat(runtime: ExtensionRuntime, x = 10, y = 10): Monster {
    const monster = new Monster(x, y, (monsterData as MonsterData[]).find(row => row.id === 'rat')!);
    runtime.attachCreature(monster, false);
    return monster;
}

/** Failed outer entry does not rewind entity allocation or the generation path's machine-counter allocation/reset behavior. */
function projection(game: Game): unknown {
    const { savedAt: _savedAt, ...snapshot } = game.toSnapshot();
    delete (snapshot.run as any).nextEntityId;
    delete (snapshot.run as any).nextMachineNumber;
    return JSON.parse(JSON.stringify(snapshot));
}

function remember(game: Game, runtime: ExtensionRuntime) {
    const world = projection(game), state = runtime.snapshot(), random = rng.getState(), messages = logger.getState();
    const names = ['player', 'grid', 'environment', 'fov', 'lightMap', 'scent', 'waypoints',
        'monsters', 'dormantMonsters', 'items', 'visibleMonsters', 'visibleItems', 'machineCells',
        'levels', 'levelSeeds', 'stats', 'pendingFallenByDepth', 'pendingFallenItemsByDepth',
        'purgatory', 'recordedInputEvents', 'replayEvents'] as const;
    const roots = names.map(name => [name, (game as any)[name]] as const);
    const cached = [...game.levels].map(([depth, level]) => ({ depth, level,
        entries: Object.entries(level).filter(([, value]) => value !== null && typeof value === 'object') }));
    return () => {
        for (const [name, root] of roots) expect((game as any)[name], `${name} identity`).toBe(root);
        for (const { depth, level, entries } of cached) {
            expect(game.levels.get(depth), `cached floor ${depth} identity`).toBe(level);
            for (const [name, root] of entries) expect((level as any)[name], `floor ${depth} ${name} identity`).toBe(root);
        }
        expect(game.extensionRuntime).toBe(runtime);
        expect(rng.getState()).toEqual(random);
        expect(logger.getState()).toEqual(messages);
        expect(runtime.snapshot()).toEqual(state);
        expect(projection(game)).toEqual(world);
    };
}

function emptyResidents(game: Game): void {
    game.monsters = []; game.dormantMonsters = [];
    for (const level of game.levels.values()) { level.monsters = []; level.dormantMonsters = []; }
}

function floorCell(level: Pick<LevelState, 'grid'>, x: number, y: number): void {
    for (const layer of [DungeonLayer.DUNGEON, DungeonLayer.LIQUID, DungeonLayer.SURFACE, DungeonLayer.GAS]) {
        level.grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON ? TerrainType.FLOOR : TerrainType.NOTHING);
    }
    level.grid.getCell(x, y)!.machineNumber = 0;
}

describe('narrow extension generation checkpoints', () => {
    for (const failure of ['coordinator', 'publication'] as const) {
        it(`restores real new-floor generation and consumed fallen queues after ${failure} failure`, () => {
            const fixture = setup(), { game, runtime } = fixture;
            const fallen = rat(runtime); fallen.hp = 100; fallen.maxHp = 100; fallen.falling = true;
            game.monsters.push(fallen);
            const item = new Item('queued gold', '$', 0xffff00, ItemCategory.GOLD); item.loc = { x: 11, y: 10 };
            floorCell(game, 11, 10);
            game.grid.setTerrainLayer(11, 10, DungeonLayer.SURFACE, TerrainType.HOLE);
            game.items.push(item);
            // Populate both queues through the same ownership operations used by catch-up.
            (game as any).monstersFall(); (game as any).fallFloorItems();
            const monsterQueues = (game as any).pendingFallenByDepth as Map<number, Monster[]>;
            const itemQueues = (game as any).pendingFallenItemsByDepth as Map<number, Item[]>;
            const monsters = monsterQueues.get(2)!, items = itemQueues.get(2)!;
            expect(monsters).toContain(fallen); expect(items).toContain(item);
            const fallenLoc = fallen.loc, itemLoc = item.loc;
            const verify = remember(game, runtime);
            const catchUp = (game as any).catchUpEnvironment.bind(game);
            const reached = vi.spyOn(game as any, 'catchUpEnvironment').mockImplementation((timeAway: unknown) => {
                expect(game.depth).toBe(2);
                expect(monsterQueues.has(2)).toBe(false); expect(itemQueues.has(2)).toBe(false);
                expect(game.monsters).toContain(fallen); expect(game.items).toContain(item);
                expect(fallen.preplaced).toBe(false);
                catchUp(timeAway);
                if (failure === 'coordinator') throw new Error('checkpoint coordinator failed');
            });
            if (failure === 'publication') fixture.failPublication();
            expect(() => enter(game, 2)).toThrow(`checkpoint ${failure} failed`);
            expect(reached).toHaveBeenCalledTimes(1);
            expect(monsterQueues.get(2)).toBe(monsters); expect(itemQueues.get(2)).toBe(items);
            expect(monsters).toEqual([fallen]); expect(items).toEqual([item]);
            expect(fallen.loc).toBe(fallenLoc); expect(item.loc).toBe(itemLoc);
            expect(fallen.preplaced).toBe(true);
            verify();
        });
    }

    it('restores actual revisit gas catch-up, waypoint rebuild and nested cached object identities', () => {
        const fixture = setup(), { game, runtime } = fixture;
        enter(game, 2); enter(game, 3);
        emptyResidents(game);
        const target = game.levels.get(2)!;
        floorCell(target, 10, 10);
        target.environment.addGas(10, 10, GasType.POISON, 300);
        game.absoluteTurnNumber += 2;
        const cell = target.grid.getCell(10, 10)!, layers = cell.layers;
        const gas = target.environment.gasGrid, gasColumn = gas[10];
        const waypoints = target.waypoints!, coordinates = waypoints.coordinates, maps = waypoints.distanceMaps;
        const originalGas = cell.volume;
        const verify = remember(game, runtime);
        const catchUp = (game as any).catchUpEnvironment.bind(game);
        vi.spyOn(game as any, 'catchUpEnvironment').mockImplementation((timeAway: unknown) => {
            expect(game.grid).toBe(target.grid); expect(game.waypoints).toBe(waypoints);
            expect(waypoints.coordinates).not.toBe(coordinates);
            catchUp(timeAway);
            expect(cell.volume).not.toBe(originalGas);
        });
        fixture.failPublication();
        expect(() => enter(game, 2)).toThrow('checkpoint publication failed');
        expect(target.grid.getCell(10, 10)).toBe(cell); expect(cell.layers).toBe(layers);
        expect(target.environment.gasGrid).toBe(gas); expect(gas[10]).toBe(gasColumn);
        expect(waypoints.coordinates).toBe(coordinates); expect(waypoints.distanceMaps).toBe(maps);
        verify();
    });

    it('restores same-depth entry after actual catch-up mutates the active grid', () => {
        const fixture = setup(), { game, runtime } = fixture;
        floorCell(game, 10, 10);
        game.environment.addGas(10, 10, GasType.POISON, 300);
        game.absoluteTurnNumber = 2;
        const grid = game.grid, cell = grid.getCell(10, 10)!, layers = cell.layers;
        const environment = game.environment, gas = environment.gasGrid, originalVolume = cell.volume;
        const verify = remember(game, runtime);
        const catchUp = (game as any).catchUpEnvironment.bind(game);
        const caughtUp = vi.spyOn(game as any, 'catchUpEnvironment').mockImplementation((timeAway: unknown) => {
            expect(timeAway).toBe(2); expect(game.grid).toBe(grid); expect(game.environment).toBe(environment);
            catchUp(timeAway);
            expect(cell.volume).not.toBe(originalVolume);
        });
        fixture.failPublication();
        expect(() => enter(game, game.depth)).toThrow('checkpoint publication failed');
        expect(caughtUp).toHaveBeenCalledTimes(1);
        expect(grid.getCell(10, 10)).toBe(cell); expect(cell.layers).toBe(layers);
        expect(environment.gasGrid).toBe(gas); expect(cell.volume).toBe(originalVolume);
        verify();
    });

    it('restores test-mode maps and visible/machine sets after their real generation clear', () => {
        const fixture = setup(), { game, runtime } = fixture;
        enter(game, 2);
        game.mode = 'test';
        const monster = rat(runtime), item = new Item('visible gold', '$', 0xffff00, ItemCategory.GOLD);
        game.monsters.push(monster); game.items.push(item);
        game.visibleMonsters.add(monster); game.visibleItems.add(item);
        game.signTexts.set('checkpoint-sign', 'original sign');
        game.resetPlateRoomByPos.set('checkpoint-reset', 999);
        const originalRoom = [...game.testRooms.values()][0]!;
        expect(originalRoom).toBeDefined();
        game.testRooms.set(999, originalRoom);
        const machines = (game as any).machineCells as Set<number>;
        machines.add(765432);
        const maps = [game.signTexts, game.resetPlateRoomByPos, game.testRooms] as const;
        const contents = maps.map(map => [...map]);
        const visibleMonsters = game.visibleMonsters, visibleItems = game.visibleItems;
        const visibleMonsterContents = [...visibleMonsters], visibleItemContents = [...visibleItems], machineContents = [...machines];
        const verify = remember(game, runtime);
        const generateTestDepth = (game as any).generateTestDepth.bind(game);
        const generated = vi.spyOn(game as any, 'generateTestDepth').mockImplementation((isFirstLevel: unknown) => {
            generateTestDepth(isFirstLevel);
            expect(game.levels.size).toBe(0);
            expect(game.signTexts.has('checkpoint-sign')).toBe(false);
            expect(game.resetPlateRoomByPos.has('checkpoint-reset')).toBe(false);
            expect(game.testRooms.has(999)).toBe(false);
            expect(visibleMonsters.has(monster)).toBe(false); expect(visibleItems.has(item)).toBe(false);
            expect(machines.size).toBe(0);
        });
        fixture.failPublication();
        expect(() => enter(game, 2)).toThrow('checkpoint publication failed');
        expect(generated).toHaveBeenCalledTimes(1);
        [game.signTexts, game.resetPlateRoomByPos, game.testRooms].forEach((map, index) => {
            expect(map).toBe(maps[index]); expect([...map]).toEqual(contents[index]);
        });
        expect(game.testRooms.get(999)).toBe(originalRoom);
        expect(game.visibleMonsters).toBe(visibleMonsters); expect([...visibleMonsters]).toEqual(visibleMonsterContents);
        expect(game.visibleItems).toBe(visibleItems); expect([...visibleItems]).toEqual(visibleItemContents);
        expect((game as any).machineCells).toBe(machines); expect([...machines]).toEqual(machineContents);
        verify();
    });

    it('undoes real catch-up falls into a third cached floor and restores the existing destination array', () => {
        const fixture = setup(), { game, runtime } = fixture;
        enter(game, 2); enter(game, 3); enter(game, 1);
        emptyResidents(game);
        const target = game.levels.get(2)!, below = game.levels.get(3)!;
        const survivor = rat(runtime); survivor.hp = 100; survivor.maxHp = 100;
        const resident = rat(runtime, 12, 10);
        floorCell(target, 10, 10);
        target.grid.setTerrainLayer(10, 10, DungeonLayer.SURFACE, TerrainType.HOLE);
        target.monsters.push(survivor); below.monsters.push(resident);
        const targetMonsters = target.monsters, belowMonsters = below.monsters, location = survivor.loc;
        game.absoluteTurnNumber += 1;
        const verify = remember(game, runtime);
        const catchUp = (game as any).catchUpEnvironment.bind(game);
        vi.spyOn(game as any, 'catchUpEnvironment').mockImplementation((timeAway: unknown) => {
            catchUp(timeAway);
            expect(game.monsters).not.toContain(survivor);
            expect(below.monsters).toBe(belowMonsters);
            expect(below.monsters).toEqual([resident, survivor]);
            expect(survivor.hp).toBeLessThan(100); expect(survivor.preplaced).toBe(true);
            throw new Error('cached fall failed');
        });
        expect(() => enter(game, 2, true)).toThrow('cached fall failed');
        expect(target.monsters).toBe(targetMonsters); expect(target.monsters).toEqual([survivor]);
        expect(below.monsters).toBe(belowMonsters); expect(below.monsters).toEqual([resident]);
        expect(survivor.loc).toBe(location); expect(survivor.hp).toBe(100); expect(survivor.preplaced).toBe(false);
        verify();
    });

    for (const failure of ['coordinator', 'publication'] as const) {
        it(`restores cross-depth leader demotion, dormant links and visited flags after ${failure} failure`, () => {
            const fixture = setup(), { game, runtime } = fixture;
            enter(game, 2); enter(game, 3);
            emptyResidents(game);
            const distant = game.levels.get(1)!, target = game.levels.get(2)!;
            const leader = rat(runtime, 10, 10), replacement = rat(runtime, 11, 10), follower = rat(runtime, 12, 10);
            const bound = rat(runtime, 13, 10), dormant = rat(runtime, 14, 10);
            leader.targetWaypointIndex = 3;
            for (const monster of [replacement, follower, bound, dormant]) {
                monster.leader = leader; monster.targetWaypointIndex = 1;
                monster.waypointAlreadyVisited = [true, true, true, true, true];
            }
            bound.boundToLeader = true; dormant.isDormant = true;
            target.monsters.push(leader);
            distant.monsters.push(replacement, follower, bound);
            distant.dormantMonsters!.push(dormant);
            const visited = follower.waypointAlreadyVisited;
            const verify = remember(game, runtime);
            vi.spyOn(game as any, 'catchUpEnvironment').mockImplementation(() => {
                // A real death invokes leadership demotion across detached floors.
                game.killMonster(leader);
                expect(dyingMonsters.has(leader)).toBe(true);
                expect(replacement.leader).toBeNull(); expect(replacement.leaderlessAfterDemotion).toBe(true);
                expect(follower.leader).toBe(replacement); expect(follower.targetWaypointIndex).toBe(3);
                expect(visited![3]).toBe(false);
                expect(bound.leader).toBeNull(); expect(dormant.leader).toBeNull();
                if (failure === 'coordinator') throw new Error('checkpoint coordinator failed');
            });
            if (failure === 'publication') fixture.failPublication();
            expect(() => enter(game, 2)).toThrow(`checkpoint ${failure} failed`);
            expect(dyingMonsters.has(leader)).toBe(false); expect(leader.deathProcessed).toBe(false);
            expect(follower.waypointAlreadyVisited).toBe(visited); expect(visited).toEqual([true, true, true, true, true]);
            for (const monster of [replacement, follower, bound, dormant]) {
                expect(monster.leader).toBe(leader); expect(monster.targetWaypointIndex).toBe(1);
                expect(monster.leaderlessAfterDemotion).toBe(false);
            }
            verify();
        });
    }

    it('restores outgoing waypoint maps, scanner and scent after an aggravating DF during a failed dig', () => {
        const { game, runtime } = setup();
        const waypoints = game.waypoints, coordinates = waypoints.coordinates;
        const maps = waypoints.distanceMaps, first = maps[0]!, scanner = (waypoints as any).scanner;
        const firstValues = first.map(column => [...column]), scent = game.scent, scentValues = (scent as any).values;
        const scannerLinks = scanner.links, scannerFront = scanner.front;
        const scannerBefore = scannerLinks.map((column: any[]) => column.map(link => ({ link, state: { ...link } })));
        expect(waypoints.count).toBeGreaterThan(0);
        const verify = remember(game, runtime), originalScent = scent.getState();
        vi.spyOn(Architect.prototype, 'generateLevel').mockImplementation(function (this: Architect) {
            // Before new floor subsystems exist, generation DFs use the live
            // outgoing scent/waypoint objects through the normal bound effects.
            for (let x = 4; x < 18; x++) for (let y = 4; y < 18; y++) floorCell(game, x, y);
            const outcome = spawnDungeonFeature(game.grid, 8, 8, catalogFeature(DF.DF_AGGRAVATE_TRAP), false,
                { refreshSideEffects: false });
            expect(outcome.aggravateRadius).toBe(39);
            expect(game.waypoints).toBe(waypoints); expect(game.scent).toBe(scent);
            expect(waypoints.coordinates[0]).toEqual({ x: 8, y: 8 });
            expect(first).not.toEqual(firstValues); expect(scent.getState()).not.toEqual(originalScent);
            throw new Error('aggravated dig failed');
        });
        expect(() => enter(game, 2)).toThrow('aggravated dig failed');
        expect(waypoints.coordinates).toBe(coordinates); expect(waypoints.distanceMaps).toBe(maps);
        expect(maps[0]).toBe(first); expect(first).toEqual(firstValues);
        expect((waypoints as any).scanner).toBe(scanner); expect((scent as any).values).toBe(scentValues);
        expect(scanner.links).toBe(scannerLinks); expect(scanner.front).toBe(scannerFront);
        scannerBefore.forEach((column: any[], x: number) => column.forEach(({ link, state }, y: number) => {
            expect(scannerLinks[x][y]).toBe(link);
            for (const [key, value] of Object.entries(state)) expect(link[key]).toBe(value);
        }));
        verify();
    });

    it('never invokes the extension checkpoint on real classic generation or revisit', () => {
        const game = createHeadlessGame(517, 'test'); game.mode = 'normal';
        const checkpoint = vi.spyOn(generation, 'checkpointGenerationWorld').mockImplementation(() => {
            throw new Error('classic checkpoint must not run');
        });
        expect(game.extensionRuntime).toBeNull();
        enter(game, 2); enter(game, 1);
        expect(game.depth).toBe(1); expect(game.levelSeeds[1]!.visited).toBe(true);
        expect(checkpoint).not.toHaveBeenCalled();
    });

    it('restores cached light source replay before any post-failure vision refresh', () => {
        const fixture = setup(), { game, runtime } = fixture;
        enter(game, 2); enter(game, 3);
        const target = game.levels.get(2)!, light = target.lightMap;
        floorCell(target, 10, 10);
        light.clearLighting();
        light.paintLight({ x: 10, y: 10, light: {
            color: { red: 17, green: 31, blue: 79, redRand: 0, greenRand: 0, blueRand: 0, rand: 0 },
            radius: { lowerBound: 0, upperBound: 0, clumpFactor: 1 },
            radialFadeToPercent: 0, passThroughCreatures: true,
        } });
        light.dance();
        const channels = { r: 17, g: 31, b: 79 };
        expect(light.renderLightAt(10, 10)).toEqual(channels);
        const visual = (light as any).visualMap, backing = (light as any).lightGrid;
        const verify = remember(game, runtime);
        const descriptorReads = vi.spyOn(Object, 'getOwnPropertyDescriptors');
        const updateVision = (game as any).updateVision.bind(game);
        const refreshed = vi.spyOn(game as any, 'updateVision').mockImplementation(() => {
            updateVision();
            expect(game.lightMap).toBe(light);
            expect(light.lightAt(10, 10)).not.toEqual(channels);
        });
        fixture.failPublication();
        expect(() => enter(game, 2)).toThrow('checkpoint publication failed');
        expect(refreshed).toHaveBeenCalledTimes(1);
        expect(descriptorReads.mock.calls.some(([object]) => object === visual || object === visual.lightGrid)).toBe(false);
        expect((light as any).visualMap).toBe(visual); expect((light as any).lightGrid).toBe(backing);
        verify();
        // Replaying after rollback must use the old weakly stored source list,
        // even though updateVision cleared/replaced it during failed entry.
        const random = rng.getState();
        light.dance();
        expect(light.renderLightAt(10, 10)).toEqual(channels);
        expect(light.renderLightAt(11, 10)).toEqual({ r: 0, g: 0, b: 0 });
        expect(rng.getState()).toEqual(random);
    });

    it('does not recursively capture untouched cached geometry or accumulated recording payloads', () => {
        const fixture = setup(), { game } = fixture;
        enter(game, 2); enter(game, 3);
        const untouched = game.levels.get(1)!;
        const event: RecordedInputEvent = { index: 0, tick: 0, depth: 1, player: { x: 1, y: 1 }, action: 'wait', data: null } as unknown as RecordedInputEvent;
        const history = Array.from({ length: 512 }, (_, index) => ({ ...event, index, player: { ...event.player }, rng: rng.getState() }));
        game.recordedInputEvents.push(...history);
        game.replayEvents.push(...history);
        game.replayRecording = { version: 1, recordedAt: 1, seed: game.currentSeed, mode: 'normal', startDepth: 1, events: history } as unknown as import('../engine/Core/Game').GameRecording;
        const forbidden = new Set<object>([
            untouched.grid, untouched.environment, untouched.fov, untouched.lightMap, untouched.scent!, untouched.waypoints!,
            (untouched.grid as any).cells, untouched.environment.gasGrid, (untouched.lightMap as any).lightGrid,
            untouched.waypoints!.coordinates, untouched.waypoints!.distanceMaps, game.replayRecording,
            game.recordedInputEvents, game.replayEvents, history, ...history,
            ...history.map(row => row.player), ...history.map(row => row.rng),
        ]);
        const visited: object[] = [];
        const descriptors = Object.getOwnPropertyDescriptors;
        vi.spyOn(Object, 'getOwnPropertyDescriptors').mockImplementation(<T>(object: T) => {
            if (forbidden.has(object as object)) visited.push(object as object);
            return descriptors(object);
        });
        fixture.failPublication();
        expect(() => enter(game, 4)).toThrow('checkpoint publication failed');
        expect(visited).toEqual([]);
        expect(game.levels.get(1)).toBe(untouched);
        expect(game.recordedInputEvents).toHaveLength(512); expect(game.recordedInputEvents[0]).toBe(history[0]);
        expect(game.replayEvents).toHaveLength(512); expect(game.replayRecording!.events).toBe(history);
    });
});

describe('generation checkpoint root contract', () => {
    it('retains cycles, aliases, descriptors, shallow memberships and append-only queue identity', () => {
        const child: { value: number; parent?: object } = { value: 1 };
        const root = { child, alias: child, replacement: child };
        child.parent = root;
        const symbol = Symbol('retained descriptor');
        Object.defineProperty(child, symbol, { value: 9, enumerable: false, configurable: true, writable: false });
        const untouched = { value: 7 };
        const map = new Map<object, object>([[child, untouched]]), set = new Set<object>([untouched]);
        const queue = [untouched];
        const bytes = new Uint16Array([11, 22, 33]);
        const restore = generation.checkpointGenerationWorld(() => ({
            shallow: [map, set], deep: [root, bytes], references: [untouched], appendOnly: [queue],
        }));
        child.value = 2; delete child.parent;
        Object.defineProperty(child, symbol, { value: 99, enumerable: true, configurable: true, writable: true });
        Object.assign(child, { speculative: true });
        root.replacement = { value: 8 };
        map.clear(); map.set(root, child); set.clear(); set.add(root);
        untouched.value = 99; queue.push(child); bytes.fill(0);
        restore();
        expect(root.child).toBe(child); expect(root.alias).toBe(child); expect(root.replacement).toBe(child);
        expect(child.parent).toBe(root); expect(child.value).toBe(1);
        expect(Object.prototype.hasOwnProperty.call(child, 'speculative')).toBe(false);
        expect(Object.getOwnPropertyDescriptor(child, symbol)).toEqual({
            value: 9, enumerable: false, configurable: true, writable: false,
        });
        expect([...map]).toEqual([[child, untouched]]); expect(map.get(child)).toBe(untouched);
        expect([...set]).toEqual([untouched]); expect([...bytes]).toEqual([11, 22, 33]);
        expect(queue).toEqual([untouched]); expect(queue[0]).toBe(untouched);
        expect(untouched.value).toBe(99);
    });
});
