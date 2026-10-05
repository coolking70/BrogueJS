import { dataArray, integer, record } from '../../engine/Simulation/Protocol';
import { DungeonLayer, TerrainType, type Grid } from '../../engine/Map/Grid';
import type { WorldPoint } from '../../engine/Movement/WorldUnits';
import { raycast } from '../../engine/Movement/SpatialQuery';
/** Persistent changes to authored hazards. Geometry remains engine-owned. */
export function restoreClearedHazards(grid: Grid, value: unknown): asserts value is WorldPoint[] {
    if (!dataArray(value, grid.width * grid.height)) throw new Error('Invalid cleared hazards');
    const seen = new Set<string>();
    for (const p of value) {
        if (!record(p, ['x','y']) || !integer(p.x, 1, grid.width-2) || !integer(p.y, 1, grid.height-2)
            || seen.has(`${p.x},${p.y}`)) throw new Error('Invalid cleared hazard cell');
        const cell = grid.getCell(p.x,p.y)!;
        if (!cell.layers.includes(TerrainType.PLAIN_FIRE) && !cell.layers.includes(TerrainType.POISON_GAS)) throw new Error('Foreign hazard change');
        seen.add(`${p.x},${p.y}`); clearCell(grid,p.x,p.y);
    }
}
function clearCell(grid: Grid, x: number, y: number) {
    const cell=grid.getCell(x,y)!;
    if (cell.layers.includes(TerrainType.PLAIN_FIRE)) grid.setTerrainLayer(x,y,DungeonLayer.SURFACE,TerrainType.NOTHING);
    if (cell.layers.includes(TerrainType.POISON_GAS)) grid.setTerrainLayer(x,y,DungeonLayer.GAS,TerrainType.NOTHING);
}
export function clearHazards(grid: Grid, changes: WorldPoint[], center: WorldPoint, radius: number): void {
    for(let y=Math.max(1,Math.floor((center.y-radius)/1024));y<=Math.min(grid.height-2,Math.floor((center.y+radius)/1024));y++)
        for(let x=Math.max(1,Math.floor((center.x-radius)/1024));x<=Math.min(grid.width-2,Math.floor((center.x+radius)/1024));x++) {
            if ((x*1024+512-center.x)**2+(y*1024+512-center.y)**2>radius**2) continue;
            if(raycast({grid},center,{x:x*1024+512-center.x,y:y*1024+512-center.y}))continue;
            const cell=grid.getCell(x,y)!;
            if (!cell.layers.includes(TerrainType.PLAIN_FIRE) && !cell.layers.includes(TerrainType.POISON_GAS)) continue;
            clearCell(grid,x,y); changes.push({x,y});
        }
}
