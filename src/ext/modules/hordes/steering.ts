import type { CombatBody } from '../../../engine/Simulation/RangedRuntime';
import type { PopulationHost } from '../../../engine/Simulation/PopulationRuntime';
import type { WorldPoint } from '../../../engine/Movement/WorldUnits';
export function steer(host: PopulationHost, body: CombatBody, toward: WorldPoint): { x: number; y: number } {
    let x = toward.x - body.pose.x, y = toward.y - body.pose.y;
    const scale = Math.max(1, Math.abs(x), Math.abs(y)); x = Math.trunc(x * 127 / scale); y = Math.trunc(y * 127 / scale);
    const radius = body.radius + 1200;
    for (const other of host.world.bodies?.queryAabb({ minX: body.pose.x - radius, maxX: body.pose.x + radius,
        minY: body.pose.y - radius, maxY: body.pose.y + radius }) ?? []) {
        if (other.id === body.id || other.id === host.ownerId) continue;
        const dx = body.pose.x - other.pose.x, dy = body.pose.y - other.pose.y, reach = body.radius + other.radius + 160;
        if (dx * dx + dy * dy >= reach * reach) continue;
        const length = Math.max(1, Math.abs(dx), Math.abs(dy));
        x += Math.trunc(dx * 45 / length); y += Math.trunc(dy * 45 / length);
    }
    const length = Math.max(127, Math.abs(x), Math.abs(y));
    return { x: Math.trunc(x * 127 / length), y: Math.trunc(y * 127 / length) };
}
