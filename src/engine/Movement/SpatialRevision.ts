import type { Grid } from '../Map/Grid';

/** Derived session revisions. Ordinary worlds never allocate revision entries
 * or scan cells. Watching starts when a spatial plan/graph requests a token.
 * Cells retain their existing own object graph (including save/trace fields). */
const revisions = new WeakMap<object, number>();
const cells = new WeakMap<object, { grid: Grid; observedTypes: number[] }>();
const owners = new WeakMap<Grid, Set<object>>();
const ownerGrids = new WeakMap<object, Grid>();
// Retain the existing watch entries as a unit for actor/list transactions which
// can dispose a session but cannot write terrain. Checkpointing that association
// is O(subscribers); restoring a disposed watch scans only on rollback.
const watchEntries = new WeakMap<Grid, Map<object, { grid: Grid; observedTypes: number[] }>>();
export function spatialTerrainRevision(grid: Grid, owner?: object): number {
    if (owner && ownerGrids.get(owner) !== grid) releaseSpatialTerrain(owner);
    if (!owners.has(grid)) {
        // New watch epoch differs even when a released Grid changed off-watch.
        // Keep only a weak scalar tombstone so an old graph cannot match it.
        revisions.set(grid, (revisions.get(grid) ?? -1) + 1);
        owners.set(grid, new Set(owner ? [] : [grid])); // explicit standalone observer
        const entries = new Map<object, { grid: Grid; observedTypes: number[] }>();
        watchEntries.set(grid, entries);
        for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
            const cell = grid.getCell(x, y)!;
            cells.set(cell, { grid, observedTypes: [...cell.layers] });
            entries.set(cell, cells.get(cell)!);
        }
    }
    if (owner) { owners.get(grid)!.add(owner); ownerGrids.set(owner, grid); }
    return revisions.get(grid)!;
}
/** Release at a spatial lifecycle boundary. Shared services on the same Grid
 * retain their own subscription; the last release discards all derived tokens.
 * The one-time detach scan is not a normal-turn capability scan. */
export function releaseSpatialTerrain(owner: object): void {
    const grid = ownerGrids.get(owner);
    if (!grid) return;
    ownerGrids.delete(owner);
    const subscribed = owners.get(grid)!; subscribed.delete(owner);
    if (subscribed.size) return;
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) cells.delete(grid.getCell(x, y)!);
    owners.delete(grid);
    watchEntries.delete(grid);
}

/** Only for transactions that own spatial session/list writes and no terrain
 * changes. Unlike checkpointSpatialTerrain, no cell values/types are copied. */
export function checkpointSpatialTerrainSubscriptions(grids: readonly Grid[]): () => void {
    const rows = [...new Set(grids)].map(grid => ({ grid, revision: revisions.get(grid), set: owners.get(grid),
        subscribers: [...(owners.get(grid) ?? [])], entries: watchEntries.get(grid) }));
    return () => {
        for (const row of rows) for (const owner of owners.get(row.grid) ?? [])
            if (!row.subscribers.includes(owner)) ownerGrids.delete(owner);
        for (const row of rows) {
            const current = watchEntries.get(row.grid);
            if (current !== row.entries) {
                current?.forEach((_entry, cell) => cells.delete(cell));
                row.entries?.forEach((entry, cell) => cells.set(cell, entry));
            }
            if (row.entries) watchEntries.set(row.grid, row.entries); else watchEntries.delete(row.grid);
            if (row.revision === undefined) revisions.delete(row.grid); else revisions.set(row.grid, row.revision);
            if (row.set) {
                row.set.clear(); row.subscribers.forEach(owner => { row.set!.add(owner); if (owner !== row.grid) ownerGrids.set(owner, row.grid); });
                owners.set(row.grid, row.set);
            } else owners.delete(row.grid);
        }
    };
}
/** All direct layer writers already refresh Cell's terrain union before rule
 * consumption. Observe type changes there, including Promotion/DF and Gas.
 * Volume-only changes and no-op refreshes do not alter traversal eligibility. */
export function notifySpatialCellRefresh(cell: { layers: readonly number[] }): void {
    const watched = cells.get(cell);
    if (!watched || watched.observedTypes.every((t, i) => t === cell.layers[i])) return;
    watched.observedTypes = [...cell.layers];
    invalidateSpatialTerrain(watched.grid);
}
export function invalidateSpatialTerrain(grid: object): void {
    const value = revisions.get(grid);
    if (value !== undefined && owners.has(grid as Grid)) revisions.set(grid, value + 1);
}

/** A failed native fact transaction restores the watcher epoch as well as grid
 * values, so retained placement/scheduler sources do not observe a false move. */
export function checkpointSpatialTerrain(grids:readonly Grid[]):()=>void {
    const saved=[...new Set(grids)].map(grid=>({grid,revision:revisions.get(grid),ownerSet:owners.get(grid),
        watch:watchEntries.get(grid),
        subscribers:[...(owners.get(grid)??[])],entries:Array.from({length:grid.height},(_,y)=>
            Array.from({length:grid.width},(_,x)=>{const cell=grid.getCell(x,y)!,entry=cells.get(cell);return {cell,entry,types:entry?[...entry.observedTypes]:null};})).flat()}));
    return()=>{
        // Remove all post-checkpoint associations before restoring any old one:
        // an owner can have moved from an earlier grid to a later grid.
        for(const row of saved)for(const owner of owners.get(row.grid)??[])if(!row.subscribers.includes(owner))ownerGrids.delete(owner);
        for(const row of saved){
        if(row.revision===undefined)revisions.delete(row.grid);else revisions.set(row.grid,row.revision);
        if(row.ownerSet){row.ownerSet.clear();row.subscribers.forEach(owner=>{row.ownerSet!.add(owner);if(owner!==row.grid)ownerGrids.set(owner,row.grid);});owners.set(row.grid,row.ownerSet);}
        else owners.delete(row.grid);
        if(row.watch)watchEntries.set(row.grid,row.watch);else watchEntries.delete(row.grid);
        for(const {cell,entry,types} of row.entries)if(entry){entry.observedTypes=types!;cells.set(cell,entry);}else cells.delete(cell);
    }};
}
