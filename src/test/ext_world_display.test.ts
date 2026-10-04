import { describe, expect, it } from 'vitest';
import { readInteractableMapMarkers } from '../ui/worldInteractableMap';
import { DungeonLayer, TerrainType, Cell } from '../engine/Map/Grid';
import type { WorldInteractableView } from '../ext/types';
import { rng } from '../engine/Random';

describe('EXT-2b generic visible map markers', () => {
    const entity: WorldInteractableView = { id: 21, owner: 'fixture', depth: 1, x: 4, y: 5, nameKey: 'ext.fixture.name', descriptionKey: 'ext.fixture.description', glyph: '人', color: '#c3ad80', interactionDistance: 1, priority: 0 };
    function markers(cell: Cell, occupied = new Set<string>(), player = { x: 0, y: 0 }) {
        return readInteractableMapMarkers([entity], { depth: 1, player, occupied, cellAt: () => cell });
    }
    it('shows only current visible markers and never overwrites player, displayed monsters or items', () => {
        const cell = new Cell(4, 5); cell.layers[DungeonLayer.DUNGEON] = TerrainType.FLOOR; cell.isVisible = true;
        expect(markers(cell)[0]).toMatchObject({ id: 21, glyph: '人', semantic: { original: '人', hanzi: '人' } });
        expect(markers(cell, new Set(['4,5']))).toEqual([]); expect(markers(cell, new Set(), { x: 4, y: 5 })).toEqual([]);
        cell.isVisible = false; expect(markers(cell)).toEqual([]);
    });
    it.each([TerrainType.PLAIN_FIRE, TerrainType.LAVA, TerrainType.CHASM, TerrainType.WATER_DEEP, TerrainType.NET_TRAP])('preserves hazardous terrain %s', terrain => {
        const cell = new Cell(4, 5); cell.isVisible = true; cell.layers[DungeonLayer.DUNGEON] = terrain;
        expect(markers(cell)).toEqual([]);
    });
    it('preserves visible gas, does not disclose hidden traps and resolves overlaps deterministically without RNG', () => {
        const cell = new Cell(4, 5); cell.isVisible = true; cell.layers[DungeonLayer.DUNGEON] = TerrainType.NET_TRAP_HIDDEN;
        expect(markers(cell)).toHaveLength(1);
        cell.layers[DungeonLayer.GAS] = TerrainType.STEAM; expect(markers(cell)).toEqual([]);
        cell.layers[DungeonLayer.GAS] = TerrainType.NOTHING;
        cell.layers[DungeonLayer.DUNGEON] = TerrainType.SECRET_DOOR; expect(markers(cell)).toEqual([]);
        cell.layers[DungeonLayer.DUNGEON] = TerrainType.FLOOR;
        const before = rng.getState();
        const entries = readInteractableMapMarkers([entity, { ...entity, id: 22, priority: 1 }], { depth: 1, player: { x: 0, y: 0 }, occupied: new Set(), cellAt: () => cell });
        expect(entries.map(entry => entry.id)).toEqual([22]); expect(rng.getState()).toEqual(before);
    });
});
