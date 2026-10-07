import type { Game } from '../../engine/Core/Game';
import { TerrainType } from '../../engine/Map/Grid';
/** Controlled scene at the recording origin; this helper has no content owner. */
export function prepareCanvasInputScene(g: Game, quiet = false): void {
  for (let y = 1; y < 28; y++) for (let x = 1; x < 78; x++) {
    g.grid.setTerrain(x, y, TerrainType.FLOOR);
    const cell = g.grid.getCell(x, y)!;
    cell.machineNumber = 0; cell.isExplored = cell.hasMemory = true;
    cell.isVisible = Math.max(Math.abs(x - 20), Math.abs(y - 12)) <= 8;
  }
  g.grid.impregnableCells.clear(); g.grid.setTerrain(2, 2, TerrainType.STAIRS_UP);
  g.player.loc = { x: 20, y: 12 };
  g.monsters.forEach((m, i) => { m.loc = { x: 60 + i % 10, y: 20 }; m.ticksUntilTurn = 100000; });
  g.dormantMonsters.forEach(m => { m.loc = { x: 60, y: 22 }; });
  g.items.forEach(i => { i.loc = { x: 65, y: 24 }; });
  // New discoveries legitimately interrupt automation; isolate a quiet room.
  if (quiet) for (let y = 1; y < 28; y++) for (const x of [10, 40]) g.grid.setTerrain(x, y, TerrainType.WALL);
}
