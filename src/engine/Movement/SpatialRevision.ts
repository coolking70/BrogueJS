/** Derived session revisions. Ordinary worlds never allocate revision entries;
 * watching starts only when a spatial placement plan needs a terrain token. */
const revisions = new WeakMap<object, number>();
export function spatialTerrainRevision(grid: object): number {
    if (!revisions.has(grid)) revisions.set(grid, 0);
    return revisions.get(grid)!;
}
export function invalidateSpatialTerrain(grid: object): void {
    const value = revisions.get(grid);
    if (value !== undefined) revisions.set(grid, value + 1);
}
