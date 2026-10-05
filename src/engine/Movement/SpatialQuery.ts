import { SWEEP_TIME, sweepCircle, type CollisionWorld, type SweepHit } from './KinematicCollision';
import { assertWorldPoint, circleTouchesAabb, type CircleBody, type WorldAabb, type WorldPoint } from './WorldUnits';

export function queryAabb(world: CollisionWorld, bounds: WorldAabb): CircleBody[] {
    return world.bodies?.queryAabb(bounds) ?? [];
}
export function queryCircle(world: CollisionWorld, center: WorldPoint, radius: number): CircleBody[] {
    return queryAabb(world, { minX: center.x - radius, minY: center.y - radius, maxX: center.x + radius, maxY: center.y + radius })
        .filter(body => (body.pose.x - center.x) ** 2 + (body.pose.y - center.y) ** 2 <= (radius + body.radius) ** 2);
}
/** Bounded long traces use short integer sweeps. Terrain wins coincident hits;
 * bodies retain sorted identity order. Embedded origins stop at time zero. */
export function traceCircle(world: CollisionWorld, from: WorldPoint, delta: WorldPoint, radius: number, exceptId?: number): SweepHit | null {
    assertWorldPoint(from); assertWorldPoint(delta);
    if (!Number.isInteger(radius) || radius < 0 || radius > 1024 || Math.max(Math.abs(delta.x), Math.abs(delta.y)) > 65536)
        throw new Error('Invalid trace budget');
    const parts = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / 4096));
    for (let i = 0; i < parts; i++) {
        const p = { x: from.x + Math.trunc(delta.x * i / parts), y: from.y + Math.trunc(delta.y * i / parts) };
        for (let y = Math.floor((p.y - radius) / 1024); y <= Math.floor((p.y + radius) / 1024); y++)
            for (let x = Math.floor((p.x - radius) / 1024); x <= Math.floor((p.x + radius) / 1024); x++) {
                if (!world.grid.getCell(x, y)?.isPassable && (radius === 0 || circleTouchesAabb(p, radius,
                    { minX: x * 1024, minY: y * 1024, maxX: (x + 1) * 1024, maxY: (y + 1) * 1024 }, false)))
                    return { time: Math.floor(i * SWEEP_TIME / parts), normal: { x: 0, y: 0 }, tile: { x, y } };
            }
        const embedded = queryCircle(world, p, radius).find(b => b.id !== exceptId
            && (b.pose.x - p.x) ** 2 + (b.pose.y - p.y) ** 2 < (radius + b.radius) ** 2);
        if (embedded) return { time: Math.floor(i * SWEEP_TIME / parts), normal: { x: 0, y: 0 }, bodyId: embedded.id };
        const step = { x: from.x + Math.trunc(delta.x * (i + 1) / parts) - p.x,
            y: from.y + Math.trunc(delta.y * (i + 1) / parts) - p.y };
        const hit = sweepCircle(world, p, radius, step, exceptId);
        if (hit) return { ...hit, time: Math.floor((i * SWEEP_TIME + hit.time) / parts) };
    }
    return null;
}
export function raycast(world: CollisionWorld, from: WorldPoint, delta: WorldPoint, exceptId?: number): SweepHit | null {
    return traceCircle(world, from, delta, 0, exceptId);
}
