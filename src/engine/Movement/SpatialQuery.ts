import { sweepCircle, type CollisionWorld, type SweepHit } from './KinematicCollision';
import type { CircleBody, WorldAabb, WorldPoint } from './WorldUnits';

export function queryAabb(world: CollisionWorld, bounds: WorldAabb): CircleBody[] {
    return world.bodies?.queryAabb(bounds) ?? [];
}
export function queryCircle(world: CollisionWorld, center: WorldPoint, radius: number): CircleBody[] {
    return queryAabb(world, { minX: center.x - radius, minY: center.y - radius, maxX: center.x + radius, maxY: center.y + radius })
        .filter(body => (body.pose.x - center.x) ** 2 + (body.pose.y - center.y) ** 2 <= (radius + body.radius) ** 2);
}
/** S1 rays share the sweep's 4096 WU per-axis range; long firearm rays are S2. */
export function raycast(world: CollisionWorld, from: WorldPoint, delta: WorldPoint, exceptId?: number): SweepHit | null {
    return sweepCircle(world, from, 0, delta, exceptId);
}
