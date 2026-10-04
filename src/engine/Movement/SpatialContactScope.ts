import type { Grid } from '../Map/Grid';

// Synchronous contact bookkeeping, never mechanical ownership or persistent
// state. Native contacts do not create a set; nested square contacts share it.
const scopes = new WeakMap<Grid, Set<string>>();
export function squareContactScope(grid: Grid): Set<string> | undefined { return scopes.get(grid); }
export function withSquareContactScope<T>(grid: Grid, scope: Set<string>, run: () => T): T {
    const previous = scopes.get(grid); scopes.set(grid, scope);
    try { return run(); }
    finally { if (previous) scopes.set(grid, previous); else scopes.delete(grid); }
}
