import { describe, expect, it, vi } from 'vitest';
import { FlowField } from '../flowField';
import { CreatureBase, getNextEntityId } from '../../../../entities/CreatureBase';
import { fullActor, snapshotActor } from '../fullActor';
import { HORDE_ACTORS } from '../definitions';
import { findReinforcement } from '../spawnDirector';
import { SpatialHash } from '../../../../engine/Movement/SpatialHash';
import type { PopulationHost } from '../../../../engine/Simulation/PopulationRuntime';

const grid = { width: 18, height: 16, getCell(x: number, y: number) {
    return { isPassable: x > 0 && y > 0 && x < 17 && y < 15 && !(x === 8 && y !== 11) };
} };
describe('Horde shared navigation and full actors', () => {
    it('routes a small unit around a wall through its only doorway', () => {
        const field = new FlowField(grid, 240), target = { x: 13.5 * 1024, y: 3.5 * 1024 };
        field.update(target); let at = { x: 3.5 * 1024, y: 3.5 * 1024 }, crossed = false;
        for (let n = 0; n < 40; n++) {
            const next = field.waypoint(at, target, 0)!; expect(next).not.toBeNull();
            if (Math.floor(next.x / 1024) === 8) { expect(Math.floor(next.y / 1024)).toBe(11); crossed = true; }
            if (next.x === target.x && next.y === target.y) break;
            expect(field.distance(next)).toBeLessThan(field.distance(at)); at = next;
        }
        expect(crossed).toBe(true);
    });
    it('keeps a diameter-two-tile Boss out of a one-tile doorway', () => {
        const field = new FlowField(grid, 1024); field.update({ x: 13.5 * 1024, y: 3.5 * 1024 });
        expect(field.waypoint({ x: 3.5 * 1024, y: 3.5 * 1024 }, { x: 13.5 * 1024, y: 3.5 * 1024 }, 0)).toBeNull();
    });
    it('rebuilds from the current target cell with identical derived directions', () => {
        const a = new FlowField(grid, 240), b = new FlowField(grid, 240), from = { x: 3.5 * 1024, y: 3.5 * 1024 };
        a.update({ x: 14.5 * 1024, y: 12.5 * 1024 });
        const target = { x: 13.5 * 1024, y: 3.5 * 1024 }; a.update(target); b.update(target);
        expect(a.waypoint(from, target, 1)).toEqual(b.waypoint(from, target, 1)); expect(a.distance(from)).toBe(b.distance(from));
    });
    it('shares complete Creature state/status behavior without consuming global IDs', () => {
        const before = getNextEntityId(), d = HORDE_ACTORS[200]!, body = { id: d.id, radius: d.radius, pose: { x: 5120, y: 4096, facing: 0 }, hp: d.maxHp, team: 1 };
        const actor = fullActor(d, body); expect(actor).toBeInstanceOf(CreatureBase);
        actor.applyStatus('paralyzed', 15); actor.tickStatuses(); actor.ticksUntilTurn = 24;
        const save = snapshotActor(actor), restored = fullActor(d, body, save);
        expect(snapshotActor(restored)).toEqual(save); expect(restored.hasStatus('paralyzed')).toBe(true);
        expect(getNextEntityId()).toBe(before);
        for (const mutate of [(v: any) => v.hp--, (v: any) => v.loc.x++, (v: any) => v.mapToMe = [[1]], (v: any) => v.extra = 1, (v: any) => v.maxStatus.paralyzed = 15]) {
            const bad = structuredClone(save); mutate(bad); expect(() => fullActor(d, body, bad)).toThrow();
        }
    });
    it('selects deterministic reinforcements away from the player and actual occupied bodies', () => {
        const bodies = new SpatialHash(); bodies.upsert({ id: 1, radius: 280, pose: { x: 4608, y: 4608, facing: 0 } });
        const host = { seed: 7, ownerId: 1, world: { grid, bodies }, body: () => ({ pose: { x: 4608, y: 4608 } }) } as unknown as PopulationHost;
        const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('global randomness'); });
        try {
            const p = findReinforcement(host, 2, 1, 240)!; expect(p).not.toBeNull();
            expect((p.x - 4608) ** 2 + (p.y - 4608) ** 2).toBeGreaterThanOrEqual(8192 ** 2);
            expect(findReinforcement(host, 2, 1, 240)).toEqual(p);
            bodies.upsert({ id: 2, radius: 240, pose: { ...p, facing: 0 } });
            expect(findReinforcement(host, 2, 1, 240)).not.toEqual(p);
        } finally { random.mockRestore(); }
    });
});
