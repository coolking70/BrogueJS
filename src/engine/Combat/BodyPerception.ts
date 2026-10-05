import type { Pos } from '../../types';
import type { Grid } from '../Map/Grid';
import { footprintOf, nearestContact, type FootprintActor } from '../Movement/CreatureSpatial';
import { entrancementDiagonalBlocked } from '../Movement/Entrancement';

export type SightLine = (x0: number, y0: number, x1: number, y1: number) => boolean;

/** Trusted native geometry only; never writes player discovery or builds a
 * multi-source player FOV. Ordinary sight retains its existing exact path. */
export function bodySightContact(grid: Grid, observer: FootprintActor, target: FootprintActor,
    line: SightLine, forceBodyGeometry = false): ReturnType<typeof nearestContact> | null {
    if (!forceBodyGeometry && !observer.spatial && !target.spatial) return line(observer.loc.x, observer.loc.y, target.loc.x, target.loc.y)
        ? nearestContact(observer, target) : null;
    const pairs = footprintOf(observer).flatMap(from => footprintOf(target).map(to => ({ from, to,
        distance: Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) })));
    pairs.sort((a, b) => a.distance - b.distance); // stable footprint order for ties
    return pairs.find(p => !grid.getCell(p.from.x, p.from.y)?.isOpaque && !grid.getCell(p.to.x, p.to.y)?.isOpaque
        && line(p.from.x, p.from.y, p.to.x, p.to.y) && bodySightCornerClear(grid, p.from, p.to)) ?? null;
}

/** Apply the native diagonal gate along a spatial sight/ray candidate. */
export function bodySightCornerClear(grid: Grid, from: Pos, to: Pos): boolean {
    let at = from;
    const dx = Math.abs(to.x - from.x), dy = Math.abs(to.y - from.y);
    const sx = Math.sign(to.x - from.x), sy = Math.sign(to.y - from.y);
    let error = dx - dy;
    while (at.x !== to.x || at.y !== to.y) {
        const twice = 2 * error, next = { ...at };
        if (twice > -dy) { error -= dy; next.x += sx; }
        if (twice < dx) { error += dx; next.y += sy; }
        if (entrancementDiagonalBlocked(grid, at, next)) return false;
        at = next;
    }
    return true;
}

/** One stable central occupied cell (y/x tie-break), not one source per tile. */
export function bodyLightOrigin(actor: FootprintActor): Readonly<Pos> {
    if (!actor.spatial) return actor.loc;
    const cells = footprintOf(actor), x = cells.reduce((n, p) => n + p.x, 0) / cells.length,
        y = cells.reduce((n, p) => n + p.y, 0) / cells.length;
    return cells.reduce((best, p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (best.x - x) ** 2 + (best.y - y) ** 2 ? p : best, cells[0]!);
}
