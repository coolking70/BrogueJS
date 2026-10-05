import type { MissionScenario } from '../../engine/Simulation/MissionRuntime';
import { Grid, DungeonLayer, TerrainType } from '../../engine/Map/Grid';

export const SHOOTER_ARENA_ID = 's3-horde-lab-v1';
export const ARENA_WIDTH = 40;
export const ARENA_HEIGHT = 28;
/** Authored diagnostic fixture, not a replacement for Brogue generation.
 * Real Grid / layered terrain / passability are reused; there is no global Game. */
export function createShooterArena(): Grid {
    const grid = new Grid(ARENA_WIDTH, ARENA_HEIGHT);
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
        const border = x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1;
        grid.setTerrain(x, y, border ? TerrainType.WALL : TerrainType.FLOOR);
    }
    for (let y = 3; y < 21; y++) if (y !== 10 && y !== 11 && y !== 12) grid.setTerrain(12, y, TerrainType.WALL);
    for (let x = 17; x <= 28; x++) if (x !== 23) grid.setTerrain(x, 8, TerrainType.WALL);
    grid.setTerrain(23, 8, TerrainType.OPEN_DOOR);
    for (let y = 16; y <= 20; y++) for (let x = 20; x <= 25; x++)
        if (x === 20 || y === 20) grid.setTerrain(x, y, TerrainType.WALL);
    for (let y = 9; y <= 12; y++) for (let x = 7; x <= 9; x++) grid.setTerrainLayer(x, y, DungeonLayer.LIQUID, TerrainType.WATER_SHALLOW);
    for (let y = 10; y <= 12; y++) for (let x = 16; x <= 18; x++) grid.setTerrainLayer(x, y, DungeonLayer.SURFACE, TerrainType.PLAIN_FIRE);
    for (let y = 17; y <= 19; y++) for (let x = 6; x <= 9; x++) grid.setTerrainLayer(x, y, DungeonLayer.GAS, TerrainType.POISON_GAS);
    return grid;
}

/** A module supplies inert authored geometry; the product owns the real Grid. */
export function createScenarioArena(scenario?: MissionScenario): Grid {
    if (!scenario) return createShooterArena();
    const grid = new Grid(scenario.width, scenario.height);
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++)
        grid.setTerrain(x, y, x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1 ? TerrainType.WALL : TerrainType.FLOOR);
    for (const r of scenario.walls) for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) grid.setTerrain(x, y, TerrainType.WALL);
    for (const r of scenario.terrain) for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++)
        grid.setTerrainLayer(x, y, r.kind === 'water' ? DungeonLayer.LIQUID : r.kind === 'fire' ? DungeonLayer.SURFACE : DungeonLayer.GAS,
            r.kind === 'water' ? TerrainType.WATER_SHALLOW : r.kind === 'fire' ? TerrainType.PLAIN_FIRE : TerrainType.POISON_GAS);
    return grid;
}
