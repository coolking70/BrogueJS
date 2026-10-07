import { composedCellFlags } from '../Map/CellProperties';
import type { Pos } from '../../types';
import type { Grid } from '../Map/Grid';
import { T_OBSTRUCTS_PASSABILITY } from '../Map/TerrainCatalog';
import type { BodyConstraint, SpatialCatalog } from './SpatialSchema';
import { bodyConstraintsSatisfied, type BodyPose } from './BodyConstraints';

export interface BodyTrajectory extends BodyPose { readonly path: readonly Readonly<Pos>[] }
const at = (trajectory: BodyTrajectory, tick: number): Readonly<Pos> => trajectory.path[Math.min(tick, trajectory.path.length - 1)]!;
type Interval = { low: number; high: number };
/** Time interval for |r + v*t| <= distance (or < distance). Strict intervals
 * keep touching tile boundaries legal while rejecting overlapping interiors. */
function axisInterval(r: number, v: number, distance: number, strict: boolean): Interval | null {
    if (!v) return (strict ? Math.abs(r) < distance : Math.abs(r) <= distance) ? { low: -Infinity, high: Infinity } : null;
    const a = (-distance - r) / v, b = (distance - r) / v;
    return { low: Math.min(a, b), high: Math.max(a, b) };
}
function proximity(a0: Pos, a1: Pos, b0: Pos, b1: Pos, distance: number, strict: boolean): Interval | null {
    const x = axisInterval(b0.x - a0.x, b1.x - b0.x - a1.x + a0.x, distance, strict);
    const y = axisInterval(b0.y - a0.y, b1.y - b0.y - a1.y + a0.y, distance, strict);
    if (!x || !y) return null;
    const low = Math.max(0, x.low, y.low), high = Math.min(1, x.high, y.high);
    return (strict ? low < high : low <= high) ? { low, high } : null;
}
function pairs(catalog: SpatialCatalog, a: BodyTrajectory, b: BodyTrajectory, tick: number) {
    const a0 = at(a, tick), a1 = at(a, tick + 1), b0 = at(b, tick), b1 = at(b, tick + 1);
    return catalog.cells(a.footprintId, a.pose).flatMap(p => catalog.cells(b.footprintId, b.pose).map(q => ({
        a0: { x: a0.x + p.x, y: a0.y + p.y }, a1: { x: a1.x + p.x, y: a1.y + p.y },
        b0: { x: b0.x + q.x, y: b0.y + q.y }, b1: { x: b1.x + q.x, y: b1.y + q.y },
    })));
}
/** Relative motion of unit tile squares. This rejects leg swaps and diagonal
 * crossings, but permits a chain to follow its parent's vacated cells at the
 * same velocity. Checking only final cells or line segment endpoints cannot. */
export function trajectoriesCollide(catalog: SpatialCatalog, a: BodyTrajectory, b: BodyTrajectory): boolean {
    const steps = Math.max(a.path.length, b.path.length, 2) - 1;
    for (let tick = 0; tick < steps; tick++) for (const pair of pairs(catalog, a, b, tick)) {
        if (proximity(pair.a0, pair.a1, pair.b0, pair.b1, 1, true)) return true;
    }
    return false;
}

/** Whole continuous parent/child distance, not just integer anchors. The union
 * of per-cell intervals must cover the entire unit time interval for maxDistance;
 * no pair may enter the open minDistance interval. Velocities are bounded to
 * integral one-cell substeps, so interval endpoints have bounded denominators. */
export function trajectoryConstraintSatisfied(catalog: SpatialCatalog, constraint: BodyConstraint,
    parent: BodyTrajectory, child: BodyTrajectory, grid: Grid): boolean {
    const steps = Math.max(parent.path.length, child.path.length, 2) - 1;
    for (let tick = 0; tick < steps; tick++) {
        const allPairs = pairs(catalog, parent, child, tick), intervals: Interval[] = [];
        for (const pair of allPairs) {
            if (constraint.minDistance > 0 && proximity(pair.a0, pair.a1, pair.b0, pair.b1, constraint.minDistance, true)) return false;
            const interval = proximity(pair.a0, pair.a1, pair.b0, pair.b1, constraint.maxDistance, false);
            if (interval) intervals.push(interval);
        }
        intervals.sort((a, b) => a.low - b.low || a.high - b.high);
        let reached = 0;
        for (const interval of intervals) {
            if (interval.low > reached + 1e-12) break;
            reached = Math.max(reached, interval.high);
        }
        if (reached < 1 - 1e-12) return false;
        if (constraint.requiresClearLink) {
            // Conservative swept-link box: every possible intermediate nearest
            // contact segment lies here. It can reject tight bent corridors;
            // it cannot permit an intermediate link to cut through a wall.
            const points = allPairs.flatMap(p => [p.a0, p.a1, p.b0, p.b1]);
            for (let y = Math.min(...points.map(p => p.y)); y <= Math.max(...points.map(p => p.y)); y++) {
                for (let x = Math.min(...points.map(p => p.x)); x <= Math.max(...points.map(p => p.x)); x++) {
                    const cell = grid.getCell(x, y);
                    if (!cell || !!(composedCellFlags(cell)&T_OBSTRUCTS_PASSABILITY)) return false;
                }
            }
        }
    }
    // Also retain the published integer nearest-contact policy, including its
    // clear-link supercover, without a second discrete-distance formula.
    return [0, steps].every(tick => bodyConstraintsSatisfied(catalog, { constraints: [constraint] },
        new Map([[constraint.parentPartId, { ...parent, anchor: at(parent, tick) }], [constraint.childPartId, { ...child, anchor: at(child, tick) }]]), grid));
}
