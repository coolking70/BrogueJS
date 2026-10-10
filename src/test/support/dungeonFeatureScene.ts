/** Test-only environmental staging; actual player actions remain public commands. */
import { spawnDungeonFeature, catalogFeature } from '../../engine/Map/DungeonFeature';
import type { DF } from '../../engine/Map/DungeonFeatureCatalog';
import type { Grid } from '../../engine/Map/Grid';
export function stageDungeonFeature(grid: Grid, at: {x: number; y: number}, type: DF): void {
    spawnDungeonFeature(grid, at.x, at.y, catalogFeature(type), false);
}
