import type { WorldInteractableView } from '../ext/types';
import { DungeonLayer, TerrainType, type Cell } from '../engine/Map/Grid';
import { TERRAIN_FLAGS, TM_IS_SECRET, T_PATHING_BLOCKER, T_HARMFUL_TERRAIN, T_ENTANGLES, T_CAUSES_NAUSEA, T_OBSTRUCTS_PASSABILITY } from '../engine/Map/TerrainCatalog';
import { glyphSemantic, type TileSemantic } from './mapTileSemantics';

interface MapContext {
    readonly depth: number;
    readonly player: { readonly x: number; readonly y: number };
    /** Already displayed items/creatures only; hidden occupants must not leak. */
    readonly occupied: ReadonlySet<string>;
    cellAt(x: number, y: number): Pick<Cell, 'layers' | 'isVisible'> | null | undefined;
}
export interface InteractableMapMarker {
    readonly id: number; readonly x: number; readonly y: number;
    readonly glyph: string; readonly color: string; readonly semantic: TileSemantic;
}
const hazardFlags = T_PATHING_BLOCKER | T_HARMFUL_TERRAIN | T_ENTANGLES | T_CAUSES_NAUSEA;
/** A display-only layer. Never paint over a visible hazard or actor, never retain
 * an entity as fog-of-war memory, and never inspect another module's state. */
export function readInteractableMapMarkers(entities: readonly WorldInteractableView[], context: MapContext): readonly InteractableMapMarker[] {
    const covered = new Set(context.occupied);
    covered.add(`${context.player.x},${context.player.y}`);
    const result: InteractableMapMarker[] = [];
    for (const entity of [...entities].sort((a, b) => b.priority - a.priority || a.id - b.id)) {
        const key = `${entity.x},${entity.y}`;
        if (entity.depth !== context.depth || covered.has(key)) continue;
        const cell = context.cellAt(entity.x, entity.y);
        if (!cell?.isVisible) continue;
        // Hidden traps remain hidden: their private flags cannot decide whether
        // a visible marker disappears. Discovery replaces the secret terrain.
        const dangerous = cell.layers.some((terrain, layer) => {
            const entry = TERRAIN_FLAGS[terrain];
            if (entry.mechFlags & TM_IS_SECRET) return !!(entry.flags & T_OBSTRUCTS_PASSABILITY);
            return !!(entry.flags & hazardFlags) || (layer === DungeonLayer.GAS && terrain !== TerrainType.NOTHING);
        });
        if (dangerous) continue;
        covered.add(key);
        result.push({ id: entity.id, x: entity.x, y: entity.y, glyph: entity.glyph, color: entity.color,
            semantic: glyphSemantic(entity.glyph, 'marker') });
    }
    return result;
}
