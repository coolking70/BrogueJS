import type { Pos } from '../../types';
import type { Grid } from '../Map/Grid';
import { collectBodyTargets, type SpatialWorld, type EffectTargetCategory } from '../Movement/CreatureSpatial';
import type { SightLine } from './BodyPerception';

/** Generate the original Euclidean/LOS area, then intersect ACTUAL body cells.
 * D08 routing stays with the caller; a new independent segment owns a new scope.
 * This is trusted mechanical geometry, never a source of public target knowledge. */
export function collectAreaBodyTargets(world: SpatialWorld, origin: Pos, radius: number,
    effect: EffectTargetCategory, line: SightLine, scope = new Set<string>()) {
    const cells: Pos[] = [];
    const grid: Grid = world.grid;
    for (let y = Math.max(0, origin.y - radius); y <= Math.min(grid.height - 1, origin.y + radius); y++) {
        for (let x = Math.max(0, origin.x - radius); x <= Math.min(grid.width - 1, origin.x + radius); x++) {
            if ((x - origin.x) ** 2 + (y - origin.y) ** 2 <= radius ** 2 && line(origin.x, origin.y, x, y)) cells.push({ x, y });
        }
    }
    return collectBodyTargets(world, cells, { effect }, scope);
}
