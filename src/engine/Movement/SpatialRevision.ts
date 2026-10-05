import type { Grid } from '../Map/Grid';

/** Derived session revisions. Ordinary worlds never allocate revision entries
 * or scan cells. Watching starts when a spatial plan/graph requests a token.
 * Cells retain their existing own object graph (including save/trace fields). */
const revisions = new WeakMap<object, number>();
const cells = new WeakMap<object, { grid: Grid; observedTypes: number[] }>();
const owners = new WeakMap<Grid, Set<object>>();
const ownerGrids = new WeakMap<object, Grid>();
export function spatialTerrainRevision(grid: Grid, owner?: object): number {
    if (owner && ownerGrids.get(owner) !== grid) releaseSpatialTerrain(owner);
    if (!owners.has(grid)) {
        // New watch epoch differs even when a released Grid changed off-watch.
        // Keep only a weak scalar tombstone so an old graph cannot match it.
        revisions.set(grid, (revisions.get(grid) ?? -1) + 1);
        owners.set(grid, new Set(owner ? [] : [grid])); // explicit standalone observer
        for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
            const cell = grid.getCell(x, y)!;
            cells.set(cell, { grid, observedTypes: [...cell.layers] });
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
/** Narrow native transaction: preserve the existing watch epoch and per-cell
 * observed types, so a restored map does not invalidate an already paid plan. */
export function checkpointSpatialTerrain(grids: readonly Grid[]): () => void {
    const saved = [...new Set(grids)].map(grid => ({ grid, revision: revisions.get(grid),
        observed: Array.from({ length: grid.height }, (_, y) => Array.from({ length: grid.width }, (_, x) => {
            const cell = grid.getCell(x,y)!, watch = cells.get(cell);
            return { cell, watch: watch && { grid: watch.grid, observedTypes: [...watch.observedTypes] } };
        })).flat() }));
    return () => { for (const row of saved) {
        if (row.revision !== undefined) revisions.set(row.grid, row.revision); else revisions.delete(row.grid);
        for (const { cell, watch } of row.observed) { if (watch) cells.set(cell, watch); else cells.delete(cell); }
    } };
}
