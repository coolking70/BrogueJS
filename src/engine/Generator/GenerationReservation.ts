import type { Grid } from '../Map/Grid';
/** Floor-attempt-only derived mask. No persistent mechanical root; ownership
 * is local to the Architect/coordinator and discarded before publication. */
const masks = new WeakMap<Grid, ReadonlySet<number>>();
export function bindGenerationReservation(grid: Grid, mask?: ReadonlySet<number>): void {
  if (mask?.size) masks.set(grid, mask);
  else masks.delete(grid);
}
export function generationReserved(grid: Grid, x: number, y: number): boolean {
  return masks.get(grid)?.has(y * grid.width + x) ?? false;
}
export function generationReservedCells(grid: Grid): readonly number[] {
  return [...(masks.get(grid) ?? [])];
}
