import type { Grid } from '../Map/Grid';
import type { Pos } from '../../types';

/** Derived grid/session association, not geometry or mechanical state. The
 * resolver reads the current foundation ledger, including after rollback.
 * All temporary world ports carrying the same grid share the same boundary. */
const resolvers = new WeakMap<Grid, (regionId: number, at: Readonly<Pos>) => boolean>();
export function bindMovementRegions(grid: Grid, resolver?: (regionId: number, at: Readonly<Pos>) => boolean): void {
    if (resolver) resolvers.set(grid, resolver); else resolvers.delete(grid);
}
export function inMovementRegion(grid: Grid, regionId: number, at: Readonly<Pos>): boolean {
    return resolvers.get(grid)?.(regionId, at) ?? false;
}
