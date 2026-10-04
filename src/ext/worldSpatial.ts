import { DungeonLayer, TerrainType, type Grid } from '../engine/Map/Grid';
import { cellTerrainFlags } from '../engine/Map/DungeonFeature';
import { T_HARMFUL_TERRAIN, T_PATHING_BLOCKER, T_IS_DF_TRAP, T_AUTO_DESCENT, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from '../engine/Map/TerrainCatalog';
import type { WorldInteractablePlacement } from './world';

/** Pure post-generation placement. It never edits terrain, retries generation,
 * scans hidden content for the UI, or draws RNG. Candidate order is contractual. */
export function interactablePlacementCells(grid: Grid, entrance: {x:number;y:number}, occupied: readonly {x:number;y:number}[], request: WorldInteractablePlacement) {
    const stairs: {x:number;y:number}[] = [], cells: {x:number;y:number}[] = [];
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
        const cell = grid.getCell(x,y)!;
        if (cell.layers.includes(TerrainType.STAIRS_UP) || cell.layers.includes(TerrainType.STAIRS_DOWN)) stairs.push({x,y});
    }
    const distance = (a:{x:number;y:number},b:{x:number;y:number}) => Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
        const cell = grid.getCell(x,y)!, point = {x,y};
        if (!cell.isVisible || !cell.isPassable || cell.isOpaque || !hasInteractionLine(grid,entrance,point) || cell.machineNumber || distance(point,entrance) > request.maxEntranceDistance
            || occupied.some(other => other.x===x && other.y===y)
            || stairs.some(stair => distance(point,stair) < request.minStairDistance)
            || cell.layers[DungeonLayer.DUNGEON] !== TerrainType.FLOOR
            || cell.layers[DungeonLayer.GAS] !== TerrainType.NOTHING
            || (cellTerrainFlags(grid,x,y) & (T_HARMFUL_TERRAIN|T_PATHING_BLOCKER|T_IS_DF_TRAP|T_AUTO_DESCENT))) continue;
        cells.push(point);
    }
    return cells.sort((a,b) => distance(a,entrance)-distance(b,entrance) || a.y-b.y || a.x-b.x);
}
/** Visibility is necessary but not enough: solid destinations and diagonally
 * touching blockers cannot be spoken through, even if a stale FOV says visible. */
export function hasInteractionLine(grid: Grid, start: {x:number;y:number}, end: {x:number;y:number}): boolean {
    const blocked = (x:number,y:number) => { const cell=grid.getCell(x,y); return !cell || cell.isOpaque || !cell.isPassable; };
    const corner = (x:number,y:number) => blocked(x,y) || !!(cellTerrainFlags(grid,x,y)&T_OBSTRUCTS_DIAGONAL_MOVEMENT);
    if (start.x === end.x && start.y === end.y) return !!grid.getCell(end.x,end.y)?.isPassable;
    if (blocked(end.x,end.y)) return false;
    let x=start.x,y=start.y;
    const dx=Math.abs(end.x-x),dy=Math.abs(end.y-y),sx=x<end.x?1:-1,sy=y<end.y?1:-1;
    let error=dx-dy;
    while (x!==end.x || y!==end.y) {
        const previousX=x,previousY=y,e=2*error;
        if (e>-dy) {error-=dy;x+=sx;}
        if (e<dx) {error+=dx;y+=sy;}
        if (x!==previousX && y!==previousY && corner(x,previousY) && corner(previousX,y)) return false;
        if (blocked(x,y)) return false;
    }
    return true;
}
