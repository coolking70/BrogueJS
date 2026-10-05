import type { Creature } from '../../entities/Creature';
import { Monster } from '../../entities/Monster';
import type { Pos } from '../../types';
import type { SpatialWorld } from './CreatureSpatial';
import { canFitAt, conservativeSquareStep, footprintOf } from './CreatureSpatial';
import { cellTerrainFlags, cellTerrainMechFlags } from '../Map/DungeonFeature';
import { T_DIVIDES_LEVEL, T_OBSTRUCTS_PASSABILITY, TM_ALLOWS_SUBMERGING } from '../Map/TerrainCatalog';
import { inMovementRegion } from './MovementRegions';

/** Bounded square anchor search. Native 1x1 CE searches stay at their existing
 * callers. Destination restrictions never become cached traversal walls. */
export function squarePlacementCandidates(world: SpatialWorld, target: Creature, origin: Pos,
    forbidden: number, forbiddenCell: (p: Pos) => boolean = () => false,
    destinationFits: (anchor: Pos) => boolean = () => true): Pos[] {
    const offsets = footprintOf(target).map(p => ({ x: p.x - target.loc.x, y: p.y - target.loc.y })), { grid } = world;
    const aquatic = target instanceof Monster && target.hasBehavior('MONST_RESTRICTED_TO_LIQUID');
    const cellsFit = (p: Pos, destination: boolean): boolean => {
        for (const offset of offsets) {
            const at = { x: p.x + offset.x, y: p.y + offset.y };
            if (!grid.isValidPos(at.x, at.y) || (cellTerrainFlags(grid, at.x, at.y) & (destination ? forbidden | T_OBSTRUCTS_PASSABILITY : (forbidden & T_DIVIDES_LEVEL) | T_OBSTRUCTS_PASSABILITY))
                || target.spatial?.movementRegionId !== undefined && !(world.inRegion?.(target.spatial.movementRegionId, at) ?? inMovementRegion(grid, target.spatial.movementRegionId, at))
                || (aquatic && !(cellTerrainMechFlags(grid, at.x, at.y) & TM_ALLOWS_SUBMERGING))
                || (destination && forbiddenCell(at))) return false;
        }
        return !destination || canFitAt(world, target, p);
    };
    const qualifies = (p: Pos) => cellsFit(p, true) && destinationFits(p);
    if (qualifies(origin)) return [{ ...origin }];
    const distances = new Int32Array(grid.width * grid.height).fill(-1), queue: Pos[] = [];
    if (grid.isValidPos(origin.x, origin.y)) {
        queue.push({ ...origin }); distances[origin.y * grid.width + origin.x] = 0;
    }
    for (let i = 0; i < queue.length; i++) {
        const from = queue[i]!;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const p = { x: from.x + dx, y: from.y + dy };
            if (!grid.isValidPos(p.x, p.y) || distances[p.y * grid.width + p.x] !== -1
                || !conservativeSquareStep(from, p, at => cellsFit(at, false))) continue;
            distances[p.y * grid.width + p.x] = distances[from.y * grid.width + from.x]! + 1;
            queue.push(p);
        }
    }
    let best = Infinity, result: Pos[] = [];
    for (let x = 0; x < grid.width; x++) for (let y = 0; y < grid.height; y++) {
        const distance = distances[y * grid.width + x]!;
        if (distance < 0 || distance > best || !qualifies({ x, y })) continue;
        if (distance < best) { best = distance; result = []; }
        result.push({ x, y });
    }
    if (result.length) return result;
    for (let radius = 1; radius < Math.max(grid.width, grid.height); radius++) {
        for (let x = origin.x - radius; x <= origin.x + radius; x++) for (let y = origin.y - radius; y <= origin.y + radius; y++) {
            if (Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) === radius && qualifies({ x, y })) result.push({ x, y });
        }
        if (result.length) return result;
    }
    return [];
}
