import { describe, expect, it } from 'vitest';
import { Grid, DungeonLayer, TerrainType } from '../engine/Map/Grid';
import { circleIsFree, moveCircle, sweepCircle, SWEEP_TIME } from '../engine/Movement/KinematicCollision';
import { SpatialHash } from '../engine/Movement/SpatialHash';
import { queryAabb, queryCircle, raycast } from '../engine/Movement/SpatialQuery';
import { gridEnvironmentContacts } from '../engine/Movement/KinematicSpatial';
import { integerSqrt, movementDelta, worldToCell } from '../engine/Movement/WorldUnits';

function arena() {
    const grid = new Grid(12, 12);
    for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++)
        grid.setTerrain(x, y, x === 0 || y === 0 || x === 11 || y === 11 ? TerrainType.WALL : TerrainType.FLOOR);
    grid.setTerrain(4, 4, TerrainType.WALL);
    return { grid, bodies: new SpatialHash() };
}
describe('S1 fixed point and continuous collision', () => {
    it('uses integer square roots and floors negative cell projections', () => {
        for (const n of [0n, 1n, 2n, 16n, 99n, 2n ** 180n + 700n]) {
            const root = integerSqrt(n); expect(root * root <= n && (root + 1n) ** 2n > n).toBe(true);
        }
        expect(worldToCell({ x: -1, y: 2047 })).toEqual({ x: -1, y: 1 });
    });
    it('retains fractional motion, limits diagonal speed, and stops on release', () => {
        const credit = { x: 0, y: 0 }; let moved = 0;
        for (let i = 0; i < 127; i++) moved += movementDelta(1, 0, 160, credit).x;
        expect(moved).toBeGreaterThanOrEqual(159); expect(moved).toBeLessThanOrEqual(160);
        const diagonal = movementDelta(127, 127, 160, { x: 0, y: 0 });
        expect(Math.hypot(diagonal.x, diagonal.y)).toBeLessThanOrEqual(160);
        expect(Math.hypot(diagonal.x, diagonal.y)).toBeGreaterThan(157);
        expect(movementDelta(0, 0, 160, credit)).toEqual({ x: 0, y: 0 }); expect(credit).toEqual({ x: 0, y: 0 });
    });
    it.each([256, 280, 450])('sweeps through four tiles without tunneling, radius %i', radius => {
        const world = arena(), p = { x: 2048, y: 4608 }, delta = { x: 4096, y: 0 };
        const hit = sweepCircle(world, p, radius, delta)!;
        expect(hit.tile).toEqual({ x: 4, y: 4 });
        expect(hit.time).toBe(Math.floor((4096 - radius - p.x) * SWEEP_TIME / delta.x));
        expect(moveCircle(world, p, radius, delta)).toEqual({ x: 4096 - radius, y: p.y });
    });
    it('slides tangentially along a wall and can move away from exact contact', () => {
        const world = arena(); for (let y = 1; y < 11; y++) world.grid.setTerrain(4, y, TerrainType.WALL);
        const p = { x: 3840, y: 3000 };
        expect(moveCircle(world, p, 256, { x: 500, y: 1500 })).toEqual({ x: 3840, y: 4500 });
        expect(moveCircle(world, p, 256, { x: 0, y: 1500 })).toEqual({ x: 3840, y: 4500 });
        expect(moveCircle(world, p, 256, { x: -500, y: 0 })).toEqual({ x: 3340, y: 3000 });
    });
    it('keeps rounded corners accessible and blocks a direct diagonal corner approach', () => {
        const world = arena();
        expect(circleIsFree(world, { x: 3900, y: 3900 }, 256)).toBe(true);
        expect(circleIsFree(world, { x: 4000, y: 4000 }, 256)).toBe(false);
        const end = moveCircle(world, { x: 3500, y: 3500 }, 256, { x: 1200, y: 1200 });
        expect(end.x).toBe(end.y); expect(end.x).toBeGreaterThan(3900); expect(end.x).toBeLessThan(3916);
        expect((4096 - end.x) ** 2 + (4096 - end.y) ** 2).toBeGreaterThanOrEqual(256 ** 2);
    });
    it('does not squeeze through diagonal wall seams or a corridor narrower than its diameter', () => {
        const world = arena(); world.grid.setTerrain(5, 3, TerrainType.WALL);
        let p = { x: 5500, y: 5500 };
        for (let i = 0; i < 40; i++) p = moveCircle(world, p, 280, { x: -160, y: -160 });
        expect(p.y).toBeGreaterThanOrEqual(4096 + 280);
        for (let y = 1; y < 11; y++) { world.grid.setTerrain(7, y, TerrainType.WALL); world.grid.setTerrain(9, y, TerrainType.WALL); }
        expect(circleIsFree(world, { x: 8704, y: 2500 }, 600)).toBe(false);
    });
    it('blocks closed doors using actual Grid passability and allows open doors', () => {
        const world = arena(); world.grid.setTerrain(4, 4, TerrainType.LOCKED_DOOR);
        const start = { x: 3500, y: 4608 }, delta = { x: 2200, y: 0 };
        expect(moveCircle(world, start, 256, delta).x).toBe(3840);
        world.grid.setTerrain(4, 4, TerrainType.OPEN_DOOR);
        expect(moveCircle(world, start, 256, delta).x).toBe(5700);
    });
    it('rejects penetration, invalid positions and excessive sweep ranges', () => {
        const world = arena();
        expect(() => moveCircle(world, { x: 4608, y: 4608 }, 256, { x: 1, y: 0 })).toThrow('penetration');
        expect(() => sweepCircle(world, { x: NaN, y: 2048 }, 256, { x: 1, y: 0 })).toThrow();
        expect(() => sweepCircle(world, { x: 2048, y: 2048 }, 256, { x: 4097, y: 0 })).toThrow();
        expect(circleIsFree(world, { x: -5, y: 2048 }, 256)).toBe(false);
    });
    it('handles a deterministic adversarial sequence around walls without penetration or teleport', () => {
        const world = arena(); let p = { x: 2048, y: 2048 }, random = 81723;
        const sample = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random % 8193 - 4096; };
        for (let i = 0; i < 1200; i++) {
            const delta = { x: sample(), y: sample() }, next = moveCircle(world, p, 280, delta);
            // Independent rectangle-distance oracle over every blocking cell.
            for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) if (!world.grid.getCell(x, y)!.isPassable) {
                const dx = Math.max(x * 1024 - next.x, 0, next.x - (x + 1) * 1024);
                const dy = Math.max(y * 1024 - next.y, 0, next.y - (y + 1) * 1024);
                expect(dx * dx + dy * dy).toBeGreaterThanOrEqual(280 ** 2);
            }
            expect(Math.hypot(next.x - p.x, next.y - p.y)).toBeLessThanOrEqual(Math.hypot(delta.x, delta.y) + 2);
            p = next;
        }
    });
});

describe('S1 spatial facade and terrain contact', () => {
    it('sorts and deduplicates spatial hash queries, updates/removes bodies without stale buckets', () => {
        const world = arena();
        for (const id of [3, 1, 2]) world.bodies.upsert({ id, pose: { x: 2500 + id * 200, y: 2500, facing: 0 }, radius: 400 });
        expect(queryAabb(world, { minX: 2000, minY: 2000, maxX: 3500, maxY: 3500 }).map(b => b.id)).toEqual([1, 2, 3]);
        const found = queryCircle(world, { x: 2200, y: 2500 }, 300); expect(found.map(b => b.id)).toEqual([1, 2]);
        found[0]!.pose.x = 0;
        world.bodies.upsert({ id: 1, pose: { x: 9000, y: 9000, facing: 0 }, radius: 400 }); world.bodies.remove(2);
        expect(queryCircle(world, { x: 2800, y: 2500 }, 500).map(b => b.id)).toEqual([3]);
    });
    it('sweeps into a stationary circle and excludes the moving owner', () => {
        const world = arena();
        world.bodies.upsert({ id: 1, pose: { x: 2048, y: 2048, facing: 0 }, radius: 280 });
        world.bodies.upsert({ id: 2, pose: { x: 4096, y: 2048, facing: 0 }, radius: 280 });
        const hit = sweepCircle(world, { x: 2048, y: 2048 }, 280, { x: 4096, y: 0 }, 1)!;
        expect(hit.bodyId).toBe(2);
        expect(moveCircle(world, { x: 2048, y: 2048 }, 280, { x: 4096, y: 0 }, 1).x).toBe(3536);
        expect(raycast(world, { x: 2048, y: 2048 }, { x: 4096, y: 0 }, 1)?.bodyId).toBe(2);
    });
    it('uses positive-area circle contact across all terrain layers, with a stable cell order', () => {
        const world = arena(); world.grid.setTerrain(4, 4, TerrainType.FLOOR);
        world.grid.setTerrainLayer(3, 3, DungeonLayer.LIQUID, TerrainType.WATER_SHALLOW);
        world.grid.setTerrainLayer(3, 3, DungeonLayer.GAS, TerrainType.POISON_GAS);
        world.grid.setTerrainLayer(3, 3, DungeonLayer.SURFACE, TerrainType.PLAIN_FIRE);
        const contacts = gridEnvironmentContacts(world.grid, { x: 4096, y: 4096 }, 280);
        expect(contacts.map(c => [c.x, c.y])).toEqual([[3, 3], [4, 3], [3, 4], [4, 4]]);
        expect(contacts[0]).toMatchObject({ water: true, fire: true, gas: true });
        expect(gridEnvironmentContacts(world.grid, { x: 4096 + 280, y: 3500 }, 280).some(c => c.x === 3)).toBe(false);
    });
});
