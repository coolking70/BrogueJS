import type { Grid } from '../Map/Grid';
import { TerrainType } from '../Map/TerrainType';
import { circleTouchesAabb, WORLD_UNITS_PER_TILE as TILE, type WorldPoint } from './WorldUnits';

export interface EnvironmentContact { x: number; y: number; water: boolean; fire: boolean; gas: boolean }
/** All terrain layers are read, never just the topmost display tile. Positive
 * area circle contact; sorted y/x. Tangency alone does not apply an effect. */
export function gridEnvironmentContacts(grid: Grid, p: WorldPoint, radius: number): EnvironmentContact[] {
    const result: EnvironmentContact[] = [];
    for (let y = Math.max(0, Math.floor((p.y - radius) / TILE)); y <= Math.min(grid.height - 1, Math.floor((p.y + radius) / TILE)); y++)
        for (let x = Math.max(0, Math.floor((p.x - radius) / TILE)); x <= Math.min(grid.width - 1, Math.floor((p.x + radius) / TILE)); x++) {
            if (!circleTouchesAabb(p, radius, { minX: x * TILE, minY: y * TILE, maxX: (x + 1) * TILE, maxY: (y + 1) * TILE }, false)) continue;
            const layers = grid.getCell(x, y)!.layers;
            result.push({ x, y, water: layers.includes(TerrainType.WATER_SHALLOW) || layers.includes(TerrainType.WATER_DEEP),
                fire: layers.includes(TerrainType.PLAIN_FIRE), gas: layers.includes(TerrainType.POISON_GAS) });
        }
    return result;
}
