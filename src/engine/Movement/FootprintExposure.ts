import type { Creature } from '../../entities/Creature';
import type { Pos } from '../../types';
import { DungeonLayer, type Cell, type Grid } from '../Map/Grid';
import { cellTerrainFlags, cellTerrainMechFlags } from '../Map/DungeonFeature';
import { T_AUTO_DESCENT, T_ENTANGLES, T_OBSTRUCTS_PASSABILITY, TERRAIN_FLAGS, TM_ALLOWS_SUBMERGING } from '../Map/TerrainCatalog';
import { assertNativeSpatial, footprintOf } from './CreatureSpatial';

/** A contact snapshot, never persisted. Order is the catalog's stable y/x
 * order. Entity reducers consume union flags once; individual mechanisms use
 * contacts. Water/submersion/support use AND, not an anchor or a majority. */
export interface FootprintExposure {
    readonly anchor: Readonly<Pos>;
    readonly contacts: readonly Readonly<{ at: Readonly<Pos>; cell: Cell; flags: number; terrainMechanics: number }>[];
    readonly flags: number;
    readonly gasFlags: number;
    readonly allSubmergible: boolean;
    readonly allUnsupported: boolean;
}
export function footprintExposure(grid: Grid, creature: Creature): FootprintExposure {
    assertNativeSpatial(creature);
    const contacts = footprintOf(creature).map(at => {
        const cell = grid.getCell(at.x, at.y);
        if (!cell) throw new Error('Exposure footprint outside its layer');
        return Object.freeze({ at: Object.freeze({ x: at.x, y: at.y }), cell,
            flags: cellTerrainFlags(grid, at.x, at.y), terrainMechanics: cellTerrainMechFlags(grid, at.x, at.y) });
    });
    return Object.freeze({ anchor: Object.freeze({ ...creature.loc }), contacts: Object.freeze(contacts),
        flags: contacts.reduce((f, c) => f | c.flags, 0),
        gasFlags: contacts.reduce((f, c) => f | TERRAIN_FLAGS[c.cell.layers[DungeonLayer.GAS]!].flags, 0),
        allSubmergible: contacts.every(c => !!(c.terrainMechanics & TM_ALLOWS_SUBMERGING)),
        allUnsupported: contacts.every(c => !!(c.flags & T_AUTO_DESCENT) && !(c.flags & (T_ENTANGLES | T_OBSTRUCTS_PASSABILITY))) });
}
