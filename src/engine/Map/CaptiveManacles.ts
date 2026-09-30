import { Grid, DungeonLayer, TerrainType } from './Grid';
import type { Pos } from '../../types';

/** CE Monsters.c:767-785. These are persistent surface anchors, not an
 * attachment to the monster. Freeing/moving/killing it leaves them in place.
 * Ordered fallback only reads DUNGEON/LIQUID, so selection can stay pure.
 * The existing generation owner applies the ordered surface writes. No RNG. */
export interface ManaclePlacement extends Pos { tile: TerrainType }

export function captiveManaclePlacements(grid: Grid, origin: Pos): ManaclePlacement[] {
    const placements: ManaclePlacement[] = [];
    const anchors = [
        [[-1, -1, TerrainType.MANACLE_TL], [0, -1, TerrainType.MANACLE_T], [-1, 0, TerrainType.MANACLE_L]],
        [[-1, 1, TerrainType.MANACLE_BL], [0, 1, TerrainType.MANACLE_B], [-1, 0, TerrainType.MANACLE_L]],
        [[1, -1, TerrainType.MANACLE_TR], [0, -1, TerrainType.MANACLE_T], [1, 0, TerrainType.MANACLE_R]],
        [[1, 1, TerrainType.MANACLE_BR], [0, 1, TerrainType.MANACLE_B], [1, 0, TerrainType.MANACLE_R]],
    ] as const;
    for (const quadrant of anchors) {
        for (const [dx, dy, tile] of quadrant) {
            const x = origin.x + dx, y = origin.y + dy;
            const cell = grid.getCell(x, y);
            if (cell?.layers[DungeonLayer.DUNGEON] !== TerrainType.FLOOR
                || cell.layers[DungeonLayer.LIQUID] !== TerrainType.NOTHING) continue;
            placements.push({ x, y, tile });
            break;
        }
    }
    return placements;
}
