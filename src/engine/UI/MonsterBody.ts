import type { Player } from '../../entities/Player';
import type { Monster } from '../../entities/Monster';
import type { Grid } from '../Map/Grid';
import type { Pos } from '../../types';
import { footprintOf, isSquareFootprint } from '../Movement/CreatureSpatial';
import { canDisplayMonster, publicMonsterCells } from './MonsterVisibility';

export interface PublicMonsterBody {
    readonly entityId: number;
    readonly cells: readonly Pos[];
    readonly glyph: Pos;
    /** Shape is public only after the entire footprint is currently seen. */
    readonly size: number | null;
    readonly cellCount?: number | null;
}

/** No anchor/definition/zone escapes this knowledge projection. Reveal-only
 * telepathy/entrancement keeps the existing single marker, without geometry. */
export function publicMonsterBody(player: Player, grid: Grid, monster: Monster): PublicMonsterBody | null {
    if (!monster.spatial) return null;
    const cells = publicMonsterCells(player, grid, monster).filter(p => grid.getCell(p.x, p.y)?.isVisible);
    if (!cells.length) return null;
    const footprint = footprintOf(monster);
    const center = { x: (Math.min(...cells.map(p => p.x)) + Math.max(...cells.map(p => p.x))) / 2,
        y: (Math.min(...cells.map(p => p.y)) + Math.max(...cells.map(p => p.y))) / 2 };
    // Only the public mask participates in glyph placement. Fixed ordering, independent of hover, target, mode, RNG and frame count.
    const ranked = [...cells].sort((a, b) => (a.x - center.x) ** 2 + (a.y - center.y) ** 2
        - (b.x - center.x) ** 2 - (b.y - center.y) ** 2 || a.y - b.y || a.x - b.x);
    return { entityId: monster.id, cells, glyph: { ...ranked[0]! },
        size: isSquareFootprint(monster) && cells.length === footprint.length ? Math.sqrt(footprint.length) : null,
        ...(!isSquareFootprint(monster) ? { cellCount: cells.length === footprint.length ? footprint.length : null } : {}) };
}

export const bodyContains = (body: Pick<PublicMonsterBody, 'cells'>, at: Pos): boolean =>
    body.cells.some(p => p.x === at.x && p.y === at.y);

/** Actor/marker precedence for world icons, without claiming hidden topology. */
export function publicMonsterMapCells(player: Player, grid: Grid, monster: Monster): readonly Pos[] {
    if (!canDisplayMonster(player, grid, monster)) return [];
    if (!monster.spatial) return [monster.loc];
    const cells = publicMonsterCells(player, grid, monster);
    return cells.length ? cells : [{ ...monster.loc }];
}
