import { circleIsFree } from '../../../engine/Movement/KinematicCollision';
import type { PopulationHost } from '../../../engine/Simulation/PopulationRuntime';
import type { WorldPoint } from '../../../engine/Movement/WorldUnits';
import { HORDE_DATA } from './definitions';
export interface SwarmUnitState { id: number; generation: number; readyTick: number; attackReadyTick: number; hp: number }
/** Stateless per-slot/per-life candidate order; it never touches global RNG. */
export function spawnCandidates(host: PopulationHost, id: number, generation: number): WorldPoint[] {
    const width = host.world.grid.width, height = host.world.grid.height, count = (width - 2) * (height - 2);
    let value = (host.seed ^ Math.imul(id, 0x9e3779b1) ^ Math.imul(generation + 1, 0x85ebca6b)) >>> 0;
    value = Math.imul(value ^ value >>> 16, 0x7feb352d) >>> 0;
    return Array.from({ length: count }, (_, i) => {
        const slot = (i + value % count) % count;
        return { x: (slot % (width - 2) + 1.5) * 1024, y: (Math.floor(slot / (width - 2)) + 1.5) * 1024 };
    });
}
export function findReinforcement(host: PopulationHost, id: number, generation: number, radius: number): WorldPoint | null {
    const player = host.body!(host.ownerId)!;
    return spawnCandidates(host, id, generation).find(p => (p.x - player.pose.x) ** 2 + (p.y - player.pose.y) ** 2 >= HORDE_DATA.director.minimumDistance ** 2
        && circleIsFree(host.world, p, radius)) ?? null;
}
