import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import * as catalog from '../ext/catalog';
import * as generation from '../engine/Core/GenerationCoordinator';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import { validRegionPlacement, validOwnedRegions, regionContains } from '../ext/regions';
import { validWorldSnapshot } from '../ext/world';
import type { Json } from '../ext/types';
import { MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { getNextEntityId } from '../entities/Creature';
import { TerrainType as T, DungeonLayer } from '../engine/Map/Grid';
import { commitCreatureAnchor, footprintOf, CreatureSpatial } from '../engine/Movement/CreatureSpatial';
import { canPlaceCreature, teleportCandidates } from '../engine/Movement/CreaturePlacement';
import { squarePlacementCandidates } from '../engine/Movement/SquarePlacement';
import { scheduleLevelFollowers } from '../engine/Movement/LevelTravel';
import { entityCodecDeps } from '../engine/Core/EntitySnapshot';
import { decodeWholeRunWorld } from '../engine/Core/WholeRunSnapshot';
import { FootprintPathing } from '../engine/Map/FootprintPathing';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';

const json = <V>(v: V): V => JSON.parse(JSON.stringify(v));
const rat = (monsters as MonsterData[]).find(row => row.id === 'rat')!;
afterEach(() => { vi.restoreAllMocks(); logger.presentAcknowledgments(null); });

/** A foundation-owned fixture package, independent of every official module.
 * Diagnostic construction is deliberately NOT called a natural/new-game trace. */
function scene(size: 2 | 3 = 2, bounds = { x: 10, y: 5, width: 12, height: 10 }) {
    const game = createHeadlessGame(441004, 'test');
    game.animationEnabled = false; game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 1; x < game.grid.width - 1; x++) for (let y = 1; y < game.grid.height - 1; y++) {
        for (const layer of [DungeonLayer.DUNGEON, DungeonLayer.LIQUID, DungeonLayer.SURFACE, DungeonLayer.GAS])
            game.grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON ? T.FLOOR : T.NOTHING);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    commitCreatureAnchor(game.player, { x: 5, y: 5 }); game.player.hp = game.player.maxHp = 10000;
    const registry = new ExtensionRegistry();
    registry.register('region-fixture', '1.0.0', () => ({ id: 'region-fixture', version: '1.0.0', ownedRegions: true,
        initialState: () => ({ exits: 0 }), validateState: (v: unknown): v is Json => !!v && typeof v === 'object' && Number.isSafeInteger((v as any).exits),
        hooks: { movementRegionExited: (event, context) => {
            expect(event.reason).toBe('fell'); expect(event.regionId).toBeGreaterThan(0);
            context.setState({ exits: (context.state as { exits: number }).exits + 1 });
        } } }));
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
    const runtime = new ExtensionRuntime(registry, registry.manifest(['region-fixture']), {
        depth: () => game.depth, turn: () => game.absoluteTurnNumber, playerId: () => game.player.id,
        randomInt: (min, max) => rng.randRange(min, max), message: text => logger.log(text),
    });
    game.extensionRuntime = runtime; runtime.attachCreature(game.player, false);
    const token = runtime.beginGeneration('fixture-region');
    const region = runtime.installOwnedRegions(token, 'region-fixture', [{ instanceKey: 'fixture.depth.1', bounds }], game.grid)[0]!;
    runtime.commitGeneration(token);
    const monster = game.createSquareMonster(rat, size, { x: bounds.x + 2, y: bounds.y + 2 }, region.id)!;
    expect(monster).not.toBeNull(); monster.hp = monster.maxHp = 1000; monster.state = MonsterState.HUNTING;
    monster.behaviorFlags.add('MONST_ALWAYS_HUNTING'); monster.givenUpOnScent = true;
    (game as any).bindDormantAwakener(); (game as any).updateVision();
    return { game, runtime, region, monster, registry };
}

describe('4a-4 foundation owned regions / movement bounds milestone', () => {
    it('strict region schema rejects malformed geometry, collisions and undeclared owners without repairing', () => {
        const placement = { instanceKey: 'fixture.depth.1', bounds: { x: 10, y: 5, width: 12, height: 10 } };
        expect(validRegionPlacement(placement)).toBe(true);
        for (const bad of [null, { ...placement, script: 'dig' }, { ...placement, bounds: { ...placement.bounds, width: 0 } },
            { ...placement, bounds: { ...placement.bounds, x: 0.5 } }, { ...placement, bounds: { ...placement.bounds, width: 1024 } }]) expect(validRegionPlacement(bad)).toBe(false);
        const region = { ...placement, id: 100, owner: 'fixture', depth: 1 };
        expect(validOwnedRegions([region], ['fixture'])).toBe(true);
        expect(validOwnedRegions([region], [])).toBe(false);
        expect(validOwnedRegions([region, { ...region, id: 101, instanceKey: 'other' }], ['fixture'])).toBe(false);
        expect(validOwnedRegions([region, { ...region, id: 101, instanceKey: 'other', depth: 2 }], ['fixture'])).toBe(true);
        expect(validWorldSnapshot({ entities: [], gate: null }, [])).toBe(true);
        expect(validWorldSnapshot({ entities: [], gate: null, regions: [] }, [])).toBe(false);
        expect(validWorldSnapshot({ entities: [], gate: null, regions: undefined }, [])).toBe(false);
        const entity = { id: region.id, owner: 'fixture', depth: 1, x: 1, y: 1, instanceKey: 'npc', contentId: 'npc',
            nameKey: 'ext.fixture.name', descriptionKey: 'ext.fixture.description', glyph: '?', color: '#aaaaaa', interactionDistance: 1, priority: 0 };
        expect(validWorldSnapshot({ entities: [entity], gate: null, regions: [region] }, ['fixture'])).toBe(false);
        expect(validWorldSnapshot({ entities: [{ ...entity, id: region.id + 1 }], gate: null, regions: [region] }, ['fixture'])).toBe(true);
    });
    it('generation publication requires a live token, declared owner and all-valid bounded batch', () => {
        const { game, runtime } = scene();
        const request = { instanceKey: 'extra', bounds: { x: 40, y: 5, width: 12, height: 10 } };
        expect(() => runtime.installOwnedRegions({ label: 'forged' }, 'region-fixture', [request], game.grid)).toThrow('LIFO');
        const token = runtime.beginGeneration('native-region'), before = getNextEntityId(), state = json(runtime['world']);
        expect(runtime.installOwnedRegions(token, 'region-fixture', [], game.grid)).toEqual([]);
        for (const [owner, requests] of [['missing', [request]], ['region-fixture', [request, { ...request, instanceKey: 'overlap' }]],
            ['region-fixture', [{ ...request, bounds: { ...request.bounds, x: game.grid.width - 1 } }]]] as const) {
            expect(() => runtime.installOwnedRegions(token, owner, requests, game.grid)).toThrow('Invalid');
            expect(getNextEntityId()).toBe(before); expect(runtime['world']).toEqual(state);
        }
        const placed = runtime.installOwnedRegions(token, 'region-fixture', [request], game.grid);
        expect(Object.isFrozen(placed[0]!.bounds)).toBe(true);
        runtime.rollbackGeneration(token); expect(getNextEntityId()).toBe(before); expect(runtime['world']).toEqual(state);
    });
    it('inner committed region is rolled back with its outer transaction and allocator', () => {
        const { game, runtime } = scene(), before = runtime.snapshot(), id = getNextEntityId();
        const outer = runtime.beginGeneration('outer'), inner = runtime.beginGeneration('inner');
        runtime.installOwnedRegions(inner, 'region-fixture', [{ instanceKey: 'inner', bounds: { x: 40, y: 5, width: 12, height: 10 } }], game.grid);
        runtime.commitGeneration(inner); runtime.rollbackGeneration(outer);
        expect(runtime.snapshot()).toEqual(before); expect(getNextEntityId()).toBe(id);
    });
    it.each([2, 3] as const)('%s-square rejects anchor-inside/tail-outside birth and motion without allocating', size => {
        const { game, monster, region } = scene(size), b = region.bounds;
        const at = { x: b.x + b.width - size + 1, y: monster.y }, id = getNextEntityId(), before = rng.getState();
        expect(game.createSquareMonster(rat, size, at, region.id)).toBeNull();
        expect(game.createSquareMonster(rat, size, { x: 40, y: 5 }, 999999)).toBeNull();
        expect(getNextEntityId()).toBe(id); expect(rng.getState()).toEqual(before);
        commitCreatureAnchor(monster, { x: b.x + b.width - size, y: monster.y });
        const old = { ...monster.loc };
        expect(game.canStepFootprint(monster, at)).toBe(false);
        expect(game.placeCreature(monster, at)).toBe(false);
        (monster as any).tryMoveTo(at.x, at.y, game); expect(monster.loc).toEqual(old);
        expect(canPlaceCreature({ grid: game.grid, player: game.player, monsters: game.monsters }, monster, at)).toBe(false);
    });
    it('terrain graph separates identical shapes in different regions; actual NPC turns stay inside', () => {
        const { game, monster, region, runtime } = scene();
        const token = runtime.beginGeneration('second');
        const other = runtime.installOwnedRegions(token, 'region-fixture', [{ instanceKey: 'second', bounds: { x: 40, y: 5, width: 12, height: 10 } }], game.grid)[0]!;
        runtime.commitGeneration(token);
        const second = game.createSquareMonster(rat, 2, { x: 42, y: 7 }, other.id)!;
        const spatial = new CreatureSpatial({ grid: game.grid, player: game.player, monsters: game.monsters });
        try {
            const pathing = new FootprintPathing(spatial), goal = { kind: 'anchors' as const, anchors: [{ x: 18, y: 10 }] };
            expect(pathing.planStep(monster, goal).kind).toBe('step'); expect(pathing.planStep(second, goal).kind).toBe('unreachable');
            expect(pathing.stats.cachedGraphs).toBe(2);
        } finally { spatial.dispose(); }
        for (let i = 0; i < 20; i++) { game.executeCommand('wait'); expect(footprintOf(monster).every(p => regionContains(region, p))).toBe(true); }
        monster.entersLevelIn = 0; monster.approaching = 0;
        scheduleLevelFollowers(game.grid, game.monsters, game.player.loc, 1);
        expect(monster.entersLevelIn).toBe(0); expect(monster.approaching).toBe(0);
    });
    it('blink and pull endpoints obey the same full-body boundary', () => {
        const { game, monster, region } = scene(), old = { ...monster.loc };
        expect((game as any).finishBlink({ caster: monster, landingPos: { x: 40, y: 7 } })).toBe(false); expect(monster.loc).toEqual(old);
        expect((game as any).finishBlink({ caster: monster, landingPos: { x: 18, y: 10 } })).toBe(true);
        commitCreatureAnchor(game.player, { x: 4, y: 10 });
        (game as any).beckonCreature(monster, game.player);
        expect(monster.x).toBe(region.bounds.x); expect(footprintOf(monster).every(p => regionContains(region, p))).toBe(true);
    });
    it('stagger and force knockback stop at the region edge', () => {
        const { game, monster, region } = scene(), b = region.bounds;
        game.player.equippedWeapon!.enchantment = 5;
        commitCreatureAnchor(game.player, { x: monster.x - 1, y: monster.y });
        const start = monster.x;
        (game as any).applyWeaponRunicEffect(monster, 10, 'force');
        expect(monster.x).toBeGreaterThan(start);
        commitCreatureAnchor(monster, { x: b.x + b.width - 2, y: 7 });
        commitCreatureAnchor(game.player, { x: monster.x - 1, y: monster.y });
        const old = { ...monster.loc };
        game.processStaggerHit(game.player, monster); expect(monster.loc).toEqual(old);
        (game as any).applyWeaponRunicEffect(monster, 10, 'force');
        expect(monster.loc).toEqual(old);
        expect(footprintOf(monster).every(p => regionContains(region, p))).toBe(true);
    });
    it('random teleport filters every destination; no legal endpoint consumes no RNG', () => {
        const { game, monster, region } = scene(2, { x: 10, y: 3, width: 60, height: 20 });
        // Native random teleport excludes direct LOS and nearby path distances.
        // A two-cell gate retains body reachability while hiding the far area.
        for (let y = 1; y < game.grid.height - 1; y++) if (y !== 21 && y !== 22) game.grid.setTerrain(30, y, T.WALL);
        const candidates = teleportCandidates(game, monster);
        expect(candidates.length).toBeGreaterThan(0);
        expect(candidates.every(at => footprintOf({ loc: at, spatial: monster.spatial }).every(p => regionContains(region, p)))).toBe(true);
        expect((game as any).teleportCreature(monster)).toBe(true); expect(footprintOf(monster).every(p => regionContains(region, p))).toBe(true);
        for (let x = region.bounds.x; x < region.bounds.x + region.bounds.width; x++) for (let y = region.bounds.y; y < region.bounds.y + region.bounds.height; y++)
            if (!footprintOf(monster).some(p => p.x === x && p.y === y)) game.grid.setTerrain(x, y, T.WALL);
        const old = { ...monster.loc }, before = rng.getState();
        expect((game as any).teleportCreature(monster)).toBe(false); expect(monster.loc).toEqual(old); expect(rng.getState()).toEqual(before);
    });
    it('clone search never escapes the source region and failed publication uses no ID', () => {
        const { game, monster, region } = scene();
        const clone = game.cloneMonster(monster)!; expect(clone).not.toBeNull(); expect(clone.spatial!.movementRegionId).toBe(region.id);
        expect(footprintOf(clone).every(p => regionContains(region, p))).toBe(true);
        for (let x = region.bounds.x; x < region.bounds.x + region.bounds.width; x++) for (let y = region.bounds.y; y < region.bounds.y + region.bounds.height; y++)
            if (!footprintOf(monster).some(p => p.x === x && p.y === y)) game.grid.setTerrain(x, y, T.WALL);
        const id = getNextEntityId(); expect(game.cloneMonster(monster)).toBeNull(); expect(getNextEntityId()).toBe(id);
        expect(squarePlacementCandidates(game, monster, { x: 50, y: 10 }, 0).every(at => footprintOf({ loc: at, spatial: monster.spatial }).every(p => regionContains(region, p)))).toBe(true);
    });
    it('polymorph retains a single-body binding and still rejects escape', () => {
        const { game, monster, region } = scene();
        expect((game as any).polymorphBoltTarget(monster)).toBe(true);
        expect(monster.spatial).toEqual({ schema: 1, footprintId: 'builtin:single', pose: 'r0', movementRegionId: region.id });
        expect(game.placeCreature(monster, { x: 40, y: 7 })).toBe(false);
        expect(game.placeCreature(monster, { x: 18, y: 10 })).toBe(true);
        const saved = json(game.toSnapshot()), random = rng.getState();
        expect(game.loadSnapshot(saved)).toBe(true); expect(rng.getState()).toEqual(random);
        const restored = game.monsters.find(row => row.id === monster.id)!;
        expect(restored.spatial).toEqual(monster.spatial); expect(game.placeCreature(restored, { x: 40, y: 7 })).toBe(false);
    });
    it('save-load reconstructs the region resolver without RNG; malformed layer/ref/allocator rejects before retiring live world', () => {
        const { game, monster, region } = scene(), saved = json(game.toSnapshot()), before = rng.getState();
        expect(game.loadSnapshot(saved)).toBe(true); expect(rng.getState()).toEqual(before);
        const restored = game.monsters.find(m => m.id === monster.id)!;
        expect(restored.spatial!.movementRegionId).toBe(region.id);
        expect(game.placeCreature(restored, { x: 40, y: 7 })).toBe(false);
        for (const change of [
            (s: typeof saved) => { delete s.extensions!.foundation.world.regions; },
            (s: typeof saved) => { s.extensions!.foundation.world.regions![0] = { ...region, depth: 2 }; },
            (s: typeof saved) => { s.extensions!.foundation.world.regions![0] = { ...region, bounds: { ...region.bounds, width: s.width } }; },
            (s: typeof saved) => { s.extensions!.foundation.world.regions![0] = { ...region, id: s.run.nextEntityId }; },
            (s: typeof saved) => { s.extensions!.foundation.world.regions![0] = { ...region, owner: 'missing' }; },
            (s: typeof saved) => { s.monsters.find(m => m.id === monster.id)!.spatial!.movementRegionId = 999999; },
            (s: typeof saved) => { s.monsters.find(m => m.id === monster.id)!.loc.x = region.bounds.x + region.bounds.width - 1; },
        ]) {
            const bad = json(saved); change(bad); const player = game.player, runtime = game.extensionRuntime, state = rng.getState();
            expect(game.loadSnapshot(bad)).toBe(false); expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); expect(rng.getState()).toEqual(state);
        }
        const withoutModule = json(saved); withoutModule.extensions!.manifest.modules = [];
        expect(game.loadSnapshot(withoutModule)).toBe(false);
    });
    it('fall clears old-depth region once and pending save cannot retain a stale binding', () => {
        const { game, monster, region, runtime } = scene();
        const saved = json(game.toSnapshot()); saved.pendingFallenByDepth.push({ depth: 2, monsters: [saved.monsters.find(m => m.id === monster.id)!] });
        saved.monsters = saved.monsters.filter(m => m.id !== monster.id);
        expect(() => decodeWholeRunWorld(saved, entityCodecDeps)).toThrow('stale');
        for (const p of footprintOf(monster)) game.grid.setTerrainLayer(p.x, p.y, DungeonLayer.LIQUID, T.CHASM);
        (game as any).monstersFall(); expect(game.monsters).not.toContain(monster);
        expect(monster.spatial).toEqual({ schema: 1, footprintId: 'builtin:square-2', pose: 'r0' });
        expect(game['pendingFallenByDepth'].get(2)).toContain(monster); expect(runtime.snapshot().modules['region-fixture']).toEqual({ exits: 1 });
        expect(runtime.ownedRegion(region.id, 1)).not.toBeNull();
        (game as any).monstersFall(); expect(runtime.snapshot().modules['region-fixture']).toEqual({ exits: 1 });
    });
    it('failed native generation restores region ledger, old objects, body binding, IDs and both streams', () => {
        const { game, runtime, monster } = scene(), oldGrid = game.grid, oldPlayer = game.player;
        const before = runtime.snapshot(), oldSpatial = monster.spatial, id = getNextEntityId(), random = rng.getState();
        vi.spyOn(generation, 'generateDepth').mockImplementation(() => {
            const inner = runtime.beginGeneration('fault-region');
            runtime.installOwnedRegions(inner, 'region-fixture', [{ instanceKey: 'fault', bounds: { x: 40, y: 5, width: 12, height: 10 } }], game.grid);
            runtime.commitGeneration(inner);
            monster.spatial!.movementRegionId = 99999; commitCreatureAnchor(monster, { x: 40, y: 5 }); rng.randRange(1, 100);
            throw new Error('region-generation-fault');
        });
        game.depth = 2;
        expect(() => (game as any).generateDepth()).toThrow('region-generation-fault');
        expect(game.depth).toBe(1); expect(game.grid).toBe(oldGrid); expect(game.player).toBe(oldPlayer);
        expect(monster.spatial).toBe(oldSpatial); expect(runtime.snapshot()).toEqual(before); expect(getNextEntityId()).toBe(id); expect(rng.getState()).toEqual(random);
        expect(game.placeCreature(monster, { x: 40, y: 7 })).toBe(false);
        expect(game.canStepFootprint(monster, { x: monster.x + 1, y: monster.y })).toBe(true);
        expect(game.placeCreature(monster, { x: monster.x + 1, y: monster.y })).toBe(true);
    });
    it('falling a bounded polymorphed single restores ordinary missing-component semantics', () => {
        const { game, monster, runtime } = scene();
        expect((game as any).polymorphBoltTarget(monster)).toBe(true);
        // The draw may fly; force the ownership-transfer flag rather than make
        // the terrain fixture silently depend on which native species was drawn.
        monster.falling = true;
        (game as any).monstersFall();
        expect(Object.prototype.hasOwnProperty.call(monster, 'spatial')).toBe(false);
        expect(runtime.snapshot().modules['region-fixture']).toEqual({ exits: 1 });
    });
    it('an ordinary/empty run omits regions entirely', () => {
        const g = createHeadlessGame(441004, 'test');
        vi.restoreAllMocks();
        g.startNewGame({ seed: 441004, mode: 'test', ruleSet: 'extended', extensions: [] }); g.animationEnabled = false;
        for (let i = 0; i < 5; i++) g.executeCommand('wait');
        expect(g.toSnapshot().extensions!.foundation.world).toEqual({ entities: [], gate: null });
        expect(g.squarePathingStats().terrainBuilds).toBe(0);
        const recording = g.exportRecording(); expect(g.loadReplay(recording)).toBe(true); g.replaySeek(recording.events.length);
        expect(g.replayError).toBeNull(); expect(g.toSnapshot().extensions!.foundation.world).toEqual({ entities: [], gate: null });
    });
});
