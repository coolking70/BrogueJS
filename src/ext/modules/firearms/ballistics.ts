import { angleVector } from '../../../engine/Movement/QuantizedAngle';
import { raycast, traceCircle } from '../../../engine/Movement/SpatialQuery';
import { SWEEP_TIME } from '../../../engine/Movement/KinematicCollision';
import { integerSqrt, type WorldPoint } from '../../../engine/Movement/WorldUnits';
import type { RangedHost } from '../../../engine/Simulation/RangedRuntime';
import { WEAPONS, type WeaponDefinition } from './definitions';
import type { Projectile } from './state';

const endPoint = (from: WorldPoint, delta: WorldPoint, time: number) =>
    ({ x: from.x + Math.trunc(delta.x * time / SWEEP_TIME), y: from.y + Math.trunc(delta.y * time / SWEEP_TIME) });
export function hitscan(host: RangedHost, sourceId: number, from: WorldPoint, angle: number, weapon: WeaponDefinition): void {
    const delta = angleVector(angle, weapon.range), hit = raycast(host.world, from, delta, sourceId);
    const to = endPoint(from, delta, hit?.time ?? SWEEP_TIME);
    const receipt = hit?.bodyId ? host.damage({ sourceId, targetId: hit.bodyId, amount: weapon.damage, kind: 'kinetic', friendlyFire: weapon.friendlyFire }) : null;
    host.emit({ tick: host.tick(), kind: 'tracer', from: { x: from.x, y: from.y }, to, radius: 0, hit: !!receipt });
    if (hit) host.emit({ tick: host.tick(), kind: 'impact', from: to, to, radius: 100, hit: !!receipt });
}
export function explode(host: RangedHost, projectile: Projectile): void {
    const w = WEAPONS[projectile.slot]!, from = projectile.pose;
    // A blast touches each entity once. Solid Grid cells occlude blast damage.
    for (const body of host.bodies()) {
        const dx = body.pose.x - from.x, dy = body.pose.y - from.y;
        const distance = Number(integerSqrt(BigInt(dx * dx + dy * dy)));
        if (distance > w.blastRadius + body.radius || body.hp === 0) continue;
        if (raycast({ grid: host.world.grid }, from, { x: dx, y: dy })) continue;
        const amount = Math.max(1, Math.floor(w.damage * (w.blastRadius - Math.min(w.blastRadius, Math.max(0, distance - body.radius))) / w.blastRadius));
        host.damage({ sourceId: projectile.sourceId, targetId: body.id, amount, kind: 'explosive', friendlyFire: w.friendlyFire });
    }
    host.emit({ tick: host.tick(), kind: 'explosion', from: { ...from }, to: { ...from }, radius: w.blastRadius, hit: false });
}
export function advanceProjectiles(host: RangedHost, projectiles: Projectile[]): Projectile[] {
    return projectiles.filter(p => {
        const delta = angleVector(p.angle, WEAPONS[p.slot]!.speed), hit = traceCircle(host.world, p.pose, delta, 64, p.sourceId);
        p.pose = endPoint(p.pose, delta, hit?.time ?? SWEEP_TIME); p.remainingTicks--;
        if (hit || p.remainingTicks === 0) { explode(host, p); return false; }
        return true;
    });
}
