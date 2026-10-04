import { describe, expect, it } from 'vitest';
import { CreatureSpatial, commitCreatureAnchor, footprintContains, distanceBetweenFootprints } from '../engine/Movement/CreatureSpatial';
import { SpatialCatalog } from '../engine/Movement/SpatialSchema';
import { spatialTerrainRevision, releaseSpatialTerrain } from '../engine/Movement/SpatialRevision';
import { FootprintPathing, type FootprintGoal } from '../engine/Map/FootprintPathing';
import { Grid, TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { cellTerrainFlags, catalogFeature, spawnDungeonFeature } from '../engine/Map/DungeonFeature';
import { DF } from '../engine/Map/DungeonFeatureCatalog';
import { promoteTile } from '../engine/Map/Promotion';
import { T_CAUSES_DAMAGE, T_IS_FIRE, T_OBSTRUCTS_PASSABILITY } from '../engine/Map/TerrainCatalog';
import { EnvironmentManager, GasType } from '../engine/Environment/Gas';
import { Monster, type MonsterData } from '../entities/Monster';
import { rng } from '../engine/Random';
import monsters from '../data/monsters.json';

const rat = (x: number, y: number) => new Monster(x, y, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
function scene(size = 2, width = 18, height = 16) {
    const grid = new Grid(width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        grid.setTerrain(x, y, x && y && x < width - 1 && y < height - 1 ? T.FLOOR : T.WALL);
    }
    const actor = rat(3, 3), world = { grid, monsters: [actor], dormantMonsters: [] as Monster[] };
    if (size > 1) actor.spatial = { schema: 1, footprintId: `builtin:square-${size}`, pose: 'r0' };
    const spatial = new CreatureSpatial(world, new SpatialCatalog(true)), pathing = new FootprintPathing(spatial);
    return { grid, actor, world, spatial, pathing };
}
function walk(s: ReturnType<typeof scene>, goal: FootprintGoal, max = 100): { x: number; y: number }[] {
    const steps = [];
    for (let i = 0; i < max; i++) {
        const result = s.pathing.planStep(s.actor, goal);
        if (result.kind === 'arrived') return steps;
        expect(result.kind).toBe('step');
        const plan = s.spatial.planStepPlacement(s.actor, result.at!);
        expect(plan).not.toBeNull(); expect(s.spatial.commitPlacement(plan!)).toBe(true);
        steps.push({ ...s.actor.loc });
    }
    throw new Error('bounded fixture walk did not arrive');
}

describe('4a-1 square movement submilestone (production Game remains gated)', () => {
    it.each([2, 3])('%s-square keeps self-overlap and rejects an undersized corridor', size => {
        const s = scene(size);
        for (let y = 1; y < s.grid.height - 1; y++) s.grid.setTerrain(8, y, T.WALL);
        for (let y = 5; y < 5 + size - 1; y++) s.grid.setTerrain(8, y, T.FLOOR);
        const goal = { kind: 'anchors' as const, anchors: [{ x: 12, y: 5 }] };
        expect(s.pathing.planStep(s.actor, goal).kind).toBe('unreachable');
        s.grid.setTerrain(8, 5 + size - 1, T.FLOOR);
        const steps = walk(s, goal);
        expect(steps).toContainEqual({ x: 8, y: 5 }); expect(s.actor.loc).toEqual(goal.anchors[0]);
        for (let y = 5; y < 5 + size; y++) for (let x = 12; x < 12 + size; x++) expect(s.spatial.creatureAtCell({ x, y })).toBe(s.actor);
    });
    it.each([2, 3])('%s-square conservative diagonal rejects terrain OR occupancy in either intermediate body', size => {
        const s = scene(size), to = { x: 4, y: 4 };
        expect(s.spatial.canStepFootprint(s.actor, to)).toBe(true);
        for (const blocker of [{ x: 3 + size, y: 3 }, { x: 3, y: 3 + size }]) {
            s.grid.setTerrain(blocker.x, blocker.y, T.WALL);
            expect(s.spatial.canFitAt(s.actor, to)).toBe(true);
            expect(s.spatial.planStepPlacement(s.actor, to)).toBeNull();
            s.grid.setTerrain(blocker.x, blocker.y, T.FLOOR);
            s.world.monsters.push(rat(blocker.x, blocker.y)); s.spatial.replaceWorld(s.world);
            expect(s.spatial.canFitAt(s.actor, to)).toBe(true);
            expect(s.spatial.canStepFootprint(s.actor, to)).toBe(false);
            s.world.monsters.pop(); s.spatial.replaceWorld(s.world);
        }
        expect(s.spatial.canStepBetween(s.actor, { x: 7, y: 7 }, { x: 8, y: 8 })).toBe(true);
        expect(s.actor.loc).toEqual({ x: 3, y: 3 });
    });
    it('single-cell fixture keeps its original diagonal flags, without full intermediate occupancy fit', () => {
        const s = scene(1), to = { x: 4, y: 4 };
        s.world.monsters.push(rat(4, 3)); s.spatial.replaceWorld(s.world);
        expect(s.spatial.canStepFootprint(s.actor, to)).toBe(true);
        s.grid.setTerrain(4, 3, T.WALL); expect(s.spatial.canStepFootprint(s.actor, to)).toBe(false);
    });
    it('step plans are atomic, single-use, and recheck intermediate eligibility even without a position revision', () => {
        const s = scene(), corpse = rat(5, 3); corpse.hp = 0;
        s.world.monsters.push(corpse); s.spatial.replaceWorld(s.world);
        const loc = s.actor.loc, before = rng.getState(), to = { x: 4, y: 4 };
        const plan = s.spatial.planStepPlacement(s.actor, to)!;
        expect(plan).not.toBeNull(); const revision = s.spatial.occupancyRevision;
        corpse.hp = 1; expect(s.spatial.occupancyRevision).toBe(revision);
        expect(s.spatial.commitPlacement(plan)).toBe(false); expect(s.actor.loc).toBe(loc);
        expect(s.actor.loc).toEqual({ x: 3, y: 3 }); expect(rng.getState()).toEqual(before);
        corpse.hp = 0;
        const next = s.spatial.planStepPlacement(s.actor, to)!;
        expect(s.spatial.commitPlacement(next)).toBe(true); expect(s.actor.loc).toBe(loc);
        expect(s.spatial.commitPlacement(next)).toBe(false);
        expect(s.spatial.occupancyRevision).toBeGreaterThan(revision);
    });
    it('a direct tail-terrain refresh invalidates a prepared step without half publication', () => {
        const s = scene(), loc = s.actor.loc;
        const plan = s.spatial.planStepPlacement(s.actor, { x: 4, y: 4 })!;
        s.grid.getCell(5, 3)!.layers[L.DUNGEON] = T.WALL;
        s.grid.getCell(5, 3)!.refreshTerrainProperties();
        expect(s.spatial.commitPlacement(plan)).toBe(false); expect(s.actor.loc).toBe(loc); expect(s.actor.loc).toEqual({ x: 3, y: 3 });
    });
    it('new executable step capability refuses a fixture mask, body member, lock and single-cell component', () => {
        const s = scene();
        for (const spatial of [
            { schema: 1 as const, footprintId: 'builtin:single', pose: 'r0' as const },
            { ...s.actor.spatial!, actionLockInTicks: 0 },
            { ...s.actor.spatial!, bodyMember: { groupId: s.actor.id, partId: 'core' } },
        ]) {
            s.actor.spatial = spatial;
            expect(() => s.spatial.planStepPlacement(s.actor, { x: 4, y: 3 })).toThrow('Square movement');
            expect(() => s.pathing.planStep(s.actor, { kind: 'anchors', anchors: [{ x: 5, y: 5 }] })).toThrow('Square movement');
        }
        s.spatial.catalog.registerFootprint({ id: 'fixture:L', owner: 'foundation', poses: ['r0'], geometry: { kind: 'mask', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] } });
        s.actor.spatial = { schema: 1, footprintId: 'fixture:L', pose: 'r0' };
        expect(() => s.spatial.planStepPlacement(s.actor, { x: 4, y: 3 })).toThrow('Square movement');
    });
    it('does not move dead or reserved square actors', () => {
        const s = scene(), goal = { kind: 'anchors' as const, anchors: [{ x: 5, y: 5 }] };
        s.actor.hp = 0; expect(s.spatial.planStepPlacement(s.actor, { x: 4, y: 3 })).toBeNull();
        expect(() => s.pathing.planStep(s.actor, goal)).toThrow('Inactive');
        s.actor.hp = 1; s.world.monsters = []; s.world.dormantMonsters = [s.actor]; s.spatial.replaceWorld(s.world);
        expect(s.spatial.planStepPlacement(s.actor, { x: 4, y: 3 })).toBeNull();
        expect(() => s.pathing.planStep(s.actor, goal)).toThrow('Inactive');
    });
});

describe('4a-1 square graphs, dynamic replan and revisions', () => {
    it.each([2, 3])('%s-square contact goals stop at a body boundary instead of routing to the occupied target anchor', size => {
        const s = scene(size), target = rat(13, 9);
        s.world.monsters.push(target); s.spatial.replaceWorld(s.world);
        const before = rng.getState(); walk(s, { kind: 'contact', target });
        expect(distanceBetweenFootprints(s.actor, target)).toBe(1);
        expect(footprintContains(s.actor, target.loc)).toBe(false); expect(rng.getState()).toEqual(before);
        expect(s.pathing.stats.terrainBuilds).toBe(1); expect(s.pathing.stats.distanceBuilds).toBe(1);
    });
    it('contact to a square target uses its tail, and target movement/death refreshes only the target map', () => {
        const s = scene(), target = rat(12, 7); target.spatial = { schema: 1, footprintId: 'builtin:square-3', pose: 'r0' };
        s.world.monsters.push(target); s.spatial.replaceWorld(s.world);
        const goal = { kind: 'contact' as const, target }; s.pathing.planStep(s.actor, goal);
        const initial = s.pathing.stats;
        commitCreatureAnchor(target, { x: 11, y: 9 }, 'mutate', true);
        s.pathing.planStep(s.actor, goal);
        expect(s.pathing.stats.terrainBuilds).toBe(initial.terrainBuilds);
        expect(s.pathing.stats.distanceBuilds).toBe(initial.distanceBuilds + 1);
        walk(s, goal); expect(distanceBetweenFootprints(s.actor, target)).toBe(1);
        target.hp = 0; expect(s.pathing.planStep(s.actor, goal).kind).toBe('unreachable');
    });
    it('blocked optimistic step replans once, detours and does not cache a moving blocker into terrain', () => {
        const s = scene(), goal = { kind: 'anchors' as const, anchors: [{ x: 12, y: 3 }] };
        const optimistic = s.pathing.planStep(s.actor, goal); expect(optimistic.kind).toBe('step');
        const blocker = rat(optimistic.at!.x + 1, optimistic.at!.y + 1);
        s.world.monsters.push(blocker); s.spatial.replaceWorld(s.world);
        const previous = s.pathing.stats;
        const blocked = s.pathing.planStep(s.actor, goal);
        expect(blocked).toMatchObject({ kind: 'step', replanned: true }); expect(blocked.at).not.toEqual(optimistic.at);
        expect(s.spatial.canStepFootprint(s.actor, blocked.at!)).toBe(true);
        expect(s.pathing.stats.dynamicReplans).toBe(previous.dynamicReplans + 1);
        expect(s.pathing.stats.terrainBuilds).toBe(previous.terrainBuilds);
        expect(s.pathing.stats.visitedNodes - previous.visitedNodes).toBeLessThanOrEqual(s.grid.width * s.grid.height);
        commitCreatureAnchor(blocker, { x: 14, y: 12 }, 'mutate', true);
        expect(s.pathing.planStep(s.actor, goal)).toEqual(optimistic);
    });
    it('sealed dynamic bottleneck waits after one bounded replan and resumes when its reservation leaves', () => {
        const s = scene();
        for (let y = 1; y < 15; y++) s.grid.setTerrain(8, y, T.WALL);
        s.grid.setTerrain(8, 3, T.FLOOR); s.grid.setTerrain(8, 4, T.FLOOR);
        commitCreatureAnchor(s.actor, { x: 6, y: 3 }, 'mutate', true);
        const sleeper = rat(8, 4); s.world.dormantMonsters.push(sleeper); s.spatial.replaceWorld(s.world);
        const goal = { kind: 'anchors' as const, anchors: [{ x: 12, y: 3 }] };
        const before = s.pathing.stats;
        expect(s.pathing.planStep(s.actor, goal)).toEqual({ kind: 'blocked', replanned: true });
        expect(s.pathing.stats.dynamicReplans).toBe(before.dynamicReplans + 1);
        expect(s.actor.loc).toEqual({ x: 6, y: 3 });
        s.world.dormantMonsters = []; s.spatial.replaceWorld(s.world);
        expect(s.pathing.planStep(s.actor, goal)).toMatchObject({ kind: 'step', replanned: false });
        expect(s.pathing.stats.terrainBuilds).toBe(1);
    });
    it('Grid writes, door promotion, DF and gas TYPE notify the same cache; volume/no-op does not', () => {
        const s = scene(), goal = { kind: 'anchors' as const, anchors: [{ x: 12, y: 3 }] };
        const builds = () => { s.pathing.planStep(s.actor, goal); return s.pathing.stats.terrainBuilds; };
        expect(builds()).toBe(1);
        s.grid.setTerrain(7, 8, T.DOOR); expect(builds()).toBe(2);
        const revision = spatialTerrainRevision(s.grid);
        promoteTile(s.grid, 7, 8, L.DUNGEON, false);
        expect(spatialTerrainRevision(s.grid)).toBeGreaterThan(revision); expect(builds()).toBe(3);
        const before = spatialTerrainRevision(s.grid);
        spawnDungeonFeature(s.grid, 7, 8, catalogFeature(DF.DF_POISON_GAS_CLOUD), false);
        expect(spatialTerrainRevision(s.grid)).toBeGreaterThan(before); expect(builds()).toBe(4);
        const environment = new EnvironmentManager(s.grid);
        environment.clearGasAt(6, 8); builds(); const b = s.pathing.stats.terrainBuilds;
        environment.addGas(6, 8, GasType.POISON, 20); expect(builds()).toBe(b + 1);
        const poisonRevision = spatialTerrainRevision(s.grid);
        environment.addGas(6, 8, GasType.POISON, 30); s.grid.getCell(6, 8)!.refreshTerrainProperties();
        expect(spatialTerrainRevision(s.grid)).toBe(poisonRevision); expect(builds()).toBe(b + 1);
        environment.addGas(6, 8, GasType.CONFUSION, 20); expect(builds()).toBe(b + 2);
        environment.clearGasAt(6, 8); expect(builds()).toBe(b + 3);
        s.grid.setTerrain(6, 8, T.FLOOR); builds(); const last = s.pathing.stats.terrainBuilds;
        s.grid.setTerrain(6, 8, T.FLOOR); expect(builds()).toBe(last);
    });
    it('gas in a tail cell blocks an averse body; changing the immunity policy produces a separate graph', () => {
        const s = scene(), to = { x: 4, y: 3 }, goal = { kind: 'anchors' as const, anchors: [to] };
        s.grid.setTerrainLayer(5, 4, L.GAS, T.POISON_GAS);
        const before = rng.getState();
        expect(s.pathing.planStep(s.actor, goal, { forbiddenFlags: T_CAUSES_DAMAGE }).kind).toBe('unreachable');
        expect(s.pathing.planStep(s.actor, goal, { forbiddenFlags: 0 })).toMatchObject({ kind: 'step', at: to });
        expect(s.pathing.stats.terrainBuilds).toBe(2); expect(rng.getState()).toEqual(before);
    });
    it('eight-entry LRU, clear and grid replacement change speed only, with deterministic y/x ties', () => {
        const s = scene(), goal = { kind: 'anchors' as const, anchors: [{ x: 12, y: 9 }] };
        const first = s.pathing.planStep(s.actor, goal);
        for (let i = 2; i <= 11; i++) s.pathing.planStep(s.actor, goal, { costs: [{ flags: T_IS_FIRE, cost: i }] });
        expect(s.pathing.stats.cachedGraphs).toBe(8); const b = s.pathing.stats.terrainBuilds;
        expect(s.pathing.planStep(s.actor, goal)).toEqual(first); expect(s.pathing.stats.terrainBuilds).toBe(b + 1);
        s.pathing.clear(); expect(s.pathing.stats.cachedGraphs).toBe(0);
        expect(s.pathing.planStep(s.actor, goal)).toEqual(first);
        const other = scene(); s.world.grid = other.grid; s.spatial.replaceWorld(s.world);
        const old = s.pathing.stats.terrainBuilds; expect(s.pathing.planStep(s.actor, goal)).toEqual(first);
        expect(s.pathing.stats.terrainBuilds).toBe(old + 1);
    });
    it('single-cell fallback scans no cells, builds no graphs and changes no counters/RNG/own state', () => {
        const s = scene(1), before = rng.getState(), cell = s.grid.getCell(4, 4)!;
        const keys = Reflect.ownKeys(cell), stats = s.pathing.stats;
        let reads = 0; const get = s.grid.getCell.bind(s.grid);
        s.grid.getCell = (x, y) => { reads++; return get(x, y); };
        for (let i = 0; i < 100; i++) expect(s.pathing.planStep(s.actor, { kind: 'anchors', anchors: [{ x: 10, y: 3 }] }).kind).toBe('unsupported');
        expect(reads).toBe(0); expect(s.pathing.stats).toEqual(stats); expect(s.spatial.hasIndex).toBe(false);
        expect(Reflect.ownKeys(cell)).toEqual(keys); expect(rng.getState()).toEqual(before);
    });
    it('invalid policies and fractional costs are rejected, unreachable searches finish within the map bound', () => {
        const s = scene(), goal = { kind: 'anchors' as const, anchors: [] };
        expect(s.pathing.planStep(s.actor, goal)).toEqual({ kind: 'unreachable', replanned: false });
        expect(s.pathing.stats.visitedNodes).toBe(0);
        for (const cost of [0, -1, .5, Infinity]) expect(() => s.pathing.planStep(s.actor, goal, { costs: [{ flags: T_IS_FIRE, cost }] })).toThrow('cost');
    });
    it('terrain subscriptions are shared, release at zero users and begin a distinct epoch after off-watch changes', () => {
        const grid = new Grid(6, 6), a = {}, b = {}, c = {};
        expect(spatialTerrainRevision(grid, a)).toBe(0);
        expect(spatialTerrainRevision(grid, b)).toBe(0);
        releaseSpatialTerrain(a); grid.setTerrain(2, 2, T.FLOOR);
        expect(spatialTerrainRevision(grid, b)).toBe(1);
        releaseSpatialTerrain(b);
        grid.setTerrain(2, 2, T.WALL); grid.setTerrain(3, 3, T.FLOOR);
        expect(spatialTerrainRevision(grid, c)).toBe(2); // new epoch, no inactive mutation count
        releaseSpatialTerrain(c);
        const s = scene(), goal = { kind: 'anchors' as const, anchors: [{ x: 12, y: 3 }] };
        s.pathing.planStep(s.actor, goal); expect(s.pathing.stats.cachedGraphs).toBe(1);
        s.spatial.setSpatial(s.actor, undefined);
        expect(s.pathing.planStep(s.actor, goal).kind).toBe('unsupported'); expect(s.pathing.stats.cachedGraphs).toBe(0);
        s.grid.setTerrain(5, 4, T.WALL);
        s.spatial.setSpatial(s.actor, { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' });
        const step = s.pathing.planStep(s.actor, goal);
        expect(s.spatial.canStepFootprint(s.actor, step.at!)).toBe(true);
        expect(s.pathing.stats.terrainBuilds).toBe(2);
    });
});

/** Independent forward, linear-frontier shortest-path oracle. It expands raw
 * square cells and intermediate rectangles rather than calling either spatial
 * predicate/graph builder, and compares the cost of actual committed routes. */
function oracle(grid: Grid, size: number, start: { x: number; y: number }, goal: { x: number; y: number }, hazardCost: number) {
    const fit = (x: number, y: number) => {
        for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) {
            if (!grid.isValidPos(xx, yy) || (cellTerrainFlags(grid, xx, yy) & T_OBSTRUCTS_PASSABILITY)) return false;
        }
        return true;
    };
    const cost = (x: number, y: number) => {
        for (let yy = y; yy < y + size; yy++) for (let xx = x; xx < x + size; xx++) if (cellTerrainFlags(grid, xx, yy) & T_IS_FIRE) return hazardCost;
        return 1;
    };
    const d = new Map<string, number>([[`${start.x},${start.y}`, 0]]), open = [{ ...start }];
    while (open.length) {
        open.sort((a, b) => d.get(`${a.x},${a.y}`)! - d.get(`${b.x},${b.y}`)!);
        const p = open.shift()!, distance = d.get(`${p.x},${p.y}`)!;
        if (p.x === goal.x && p.y === goal.y) return { distance, cost };
        for (let y = p.y - 1; y <= p.y + 1; y++) for (let x = p.x - 1; x <= p.x + 1; x++) {
            if (x === p.x && y === p.y || !fit(x, y) || (x !== p.x && y !== p.y && (!fit(x, p.y) || !fit(p.x, y)))) continue;
            const key = `${x},${y}`, next = distance + cost(x, y);
            if (next < (d.get(key) ?? Infinity)) { d.set(key, next); if (!open.some(p => p.x === x && p.y === y)) open.push({ x, y }); }
        }
    }
    return { distance: Infinity, cost };
}
describe('square route oracle', () => {
    it.each([2, 3])('%s-square routes match forward optimal action costs across weighted/unweighted maps', size => {
        for (let map = 0; map < 6; map++) {
            const s = scene(size, 16, 13), goal = { x: 11, y: 8 };
            for (let y = 1; y < 12; y++) for (let x = 6; x < 9; x++) {
                if ((x * 11 + y * 7 + map * 13) % 9 === 0) s.grid.setTerrain(x, y, T.WALL);
                else if ((x * 3 + y + map) % 4 === 0) s.grid.setTerrainLayer(x, y, L.SURFACE, T.PLAIN_FIRE);
            }
            for (const hazardCost of [1, 7]) {
                commitCreatureAnchor(s.actor, { x: 3, y: 3 }, 'mutate', true);
                const expected = oracle(s.grid, size, s.actor.loc, goal, hazardCost);
                let total = 0, arrived = false;
                for (let i = 0; i < 16 * 13; i++) {
                    const step = s.pathing.planStep(s.actor, { kind: 'anchors', anchors: [goal] }, { costs: [{ flags: T_IS_FIRE, cost: hazardCost }] });
                    if (step.kind === 'unreachable') { expect(expected.distance).toBe(Infinity); break; }
                    if (step.kind === 'arrived') { arrived = true; break; }
                    expect(step.kind).toBe('step'); total += expected.cost(step.at!.x, step.at!.y);
                    const plan = s.spatial.planStepPlacement(s.actor, step.at!)!; expect(s.spatial.commitPlacement(plan)).toBe(true);
                }
                if (Number.isFinite(expected.distance)) { expect(arrived).toBe(true); expect(total).toBe(expected.distance); }
            }
        }
    });
});
