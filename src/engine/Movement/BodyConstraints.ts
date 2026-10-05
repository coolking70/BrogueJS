import type { Grid } from '../Map/Grid';
import { TERRAIN_FLAGS, T_OBSTRUCTS_PASSABILITY } from '../Map/TerrainCatalog';
import type { Pos } from '../../types';
import { SpatialValidationError, type BodyDefinition, type Pose, type SpatialCatalog } from './SpatialSchema';

export interface BodyPose { anchor: Readonly<Pos>; footprintId: string; pose: Pose }
export const comparePartId = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** A rooted tree, with parents before children and lexical partId ties. This
 * order is independent of definition, member-table and entity-list order. */
export function bodyConstraintOrder(definition: BodyDefinition): readonly string[] {
    const core = definition.parts.find(p => p.role === 'core');
    if (!core) throw new SpatialValidationError('Missing body core');
    const out = [core.partId], remaining = new Set(definition.parts.filter(p => p !== core).map(p => p.partId));
    while (remaining.size) {
        const next = [...remaining].filter(id => definition.constraints.some(c => c.childPartId === id && out.includes(c.parentPartId))).sort(comparePartId)[0];
        if (!next) throw new SpatialValidationError('Disconnected or cyclic body tree');
        remaining.delete(next); out.push(next);
    }
    return Object.freeze(out);
}

/** Conservative integer supercover. A diagonal link cannot pass through either
 * wall touching its corner. Links are not occupants, hit targets or terrain. */
export function clearBodyLink(grid: Grid, from: Pos, to: Pos): boolean {
    const blocked = (x: number, y: number) => {
        const cell = grid.getCell(x, y);
        return !cell || cell.layers.some(t => !!(TERRAIN_FLAGS[t].flags & T_OBSTRUCTS_PASSABILITY));
    };
    if (blocked(from.x, from.y)) return false;
    let x = from.x, y = from.y;
    const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y), sx = Math.sign(to.x - x), sy = Math.sign(to.y - y);
    let ix = 0, iy = 0;
    while (ix < dx || iy < dy) {
        const decision = (1 + 2 * ix) * dy - (1 + 2 * iy) * dx;
        if (decision === 0) {
            if (blocked(x + sx, y) || blocked(x, y + sy)) return false;
            x += sx; y += sy; ix++; iy++;
        } else if (decision < 0) { x += sx; ix++; }
        else { y += sy; iy++; }
        if (blocked(x, y)) return false;
    }
    return true;
}

/** Check the nearest, stable y/x contact pair, not anchor distance. A missing
 * child is a retired subtree; a live child with a missing parent is invalid. */
export function bodyConstraintsSatisfied(catalog: SpatialCatalog, definition: Pick<BodyDefinition, 'constraints'>,
    poses: ReadonlyMap<string, BodyPose>, grid?: Grid): boolean {
    for (const constraint of definition.constraints) {
        const child = poses.get(constraint.childPartId), parent = poses.get(constraint.parentPartId);
        if (!child) continue;
        if (!parent) return false;
        let nearest: { from: Pos; to: Pos; distance: number } | undefined;
        for (const a of catalog.cells(parent.footprintId, parent.pose)) for (const b of catalog.cells(child.footprintId, child.pose)) {
            const from = { x: a.x + parent.anchor.x, y: a.y + parent.anchor.y }, to = { x: b.x + child.anchor.x, y: b.y + child.anchor.y };
            const distance = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
            if (!nearest || distance < nearest.distance) nearest = { from, to, distance };
        }
        if (!nearest || nearest.distance < constraint.minDistance || nearest.distance > constraint.maxDistance
            || grid && constraint.requiresClearLink && !clearBodyLink(grid, nearest.from, nearest.to)) return false;
    }
    return true;
}
