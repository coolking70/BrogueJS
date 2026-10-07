import { afterEach, it, expect, vi } from 'vitest';
import { structureHarness, createCamp, build, fixture } from './support/structureFixture';
import { DungeonLayer, TerrainType } from '../engine/Map/Grid';
import { EnvironmentManager, GasType } from '../engine/Environment/Gas';
import { FOVSys } from '../engine/Lighting/FOV';
import { LightMap } from '../engine/Lighting/LightMap';
import { ScentMap } from '../engine/Map/Scent';
import { terrainBlocksScent, genericPathCost } from '../engine/Map/TerrainRules';
import { DijkstraMap } from '../engine/Map/Pathfinding';
import { cellTerrainFlags, spawnMapDF, createSpawnMap } from '../engine/Map/DungeonFeature';
import { T_AUTO_DESCENT, T_LAVA_INSTA_DEATH, T_IS_DEEP_WATER } from '../engine/Map/TerrainCatalog';
import { traceBolt } from '../engine/Combat/BoltTrajectory';
import { getBoltForItem } from '../engine/Combat/Bolt';
import { CreatureSpatial } from '../engine/Movement/CreatureSpatial';
import { SpatialCatalog } from '../engine/Movement/SpatialSchema';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { structureAppearance } from '../engine/Map/CellProperties';
import { clearStructureBindings } from '../engine/Map/CellProperties';
import { bindWorldStructures, settleStructureFoundations } from '../engine/Map/StructureWorld';
afterEach(() => vi.restoreAllMocks());

it.each(['wall', 'door', 'window'])(
  '%s reaches FOV/light, scent, path, gas, liquid, bolt and display consumers',
  (kind) => {
    const { g } = structureHarness();
    createCamp(g);
    build(g, kind);
    const opaque = kind !== 'window',
      cell = g.grid.getCell(21, 10)!;
    expect(
      cellTerrainFlags(g.grid, 21, 10) & (T_AUTO_DESCENT | T_LAVA_INSTA_DEATH | T_IS_DEEP_WATER)
    ).toBe(0);
    const fov = new FOVSys(g.grid);
    expect(fov.computeFOVMask(20, 10, 10, (c) => c.isOpaque)[22]![10]).toBe(!opaque);
    const scent = new ScentMap(g.grid.width, g.grid.height);
    scent.update(g.grid, 20, 10, fov.computeFOVMask(20, 10, 100, terrainBlocksScent));
    expect(scent.get(22, 10)).toBe(0);
    expect(genericPathCost(cell)).toBe(-2);
    const path = new DijkstraMap(g.grid.width, g.grid.height);
    path.calculateMap(g.grid, 22, 10);
    expect(path.links[21]![10]!.distance).toBe(30000);
    const light = new LightMap(g.grid);
    light.addLight(20, 10, 10, '#ffffff', 100);
    expect(light.getLight(22, 10)!.intensity > 0).toBe(!opaque);
    const nativeFire = getBoltForItem('staff_of_fire')!,
      blink = getBoltForItem('staff_of_blinking')!,
      world = { caster: g.player, creatureAt: () => undefined };
    expect(
      traceBolt(g.grid, nativeFire, g.player.loc, { x: 24, y: 10 }, world).path.some(
        (p) => p.x === 22 && p.y === 10
      )
    ).toBe(!opaque);
    expect(
      traceBolt(g.grid, blink, g.player.loc, { x: 24, y: 10 }, world).path.some(
        (p) => p.x === 22 && p.y === 10
      )
    ).toBe(false);
    expect(structureAppearance(cell)!.char).toBe(
      kind === 'wall' ? '#' : kind === 'door' ? '+' : '▤'
    );
    // Seal a one-cell channel: spread cannot go around the tested barrier.
    clearStructureBindings(g.grid);
    for (let y = 1; y < g.grid.height - 1; y++)
      for (let x = 1; x < g.grid.width - 1; x++)
        if (y !== 10 || x < 20 || x > 22) g.grid.setTerrain(x, y, TerrainType.WALL);
    bindWorldStructures(g);
    const env = new EnvironmentManager(g.grid);
    env.addGas(20, 10, GasType.METHANE, 900);
    env.updateGases();
    env.updateGases();
    expect(g.grid.getCell(22, 10)!.volume > 0).toBe(!opaque);
    const map = createSpawnMap(g.grid);
    spawnMapDF(g.grid, 20, 10, TerrainType.NOTHING, false, 100, 20, map, true);
    expect(map[10 * g.grid.width + 21]).toBe(0);
    expect(map[10 * g.grid.width + 22]).toBe(0);
  }
);

it('full square footprints and already prepared placements cannot cross a structure', () => {
  const { g } = structureHarness();
  createCamp(g);
  const actor = new Monster(20, 11, (monsters as MonsterData[]).find((m) => m.id === 'rat')!);
  actor.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' };
  const spatial = new CreatureSpatial(
    { grid: g.grid, monsters: [actor], dormantMonsters: [] },
    new SpatialCatalog(true)
  );
  const before = spatial.planStepPlacement(actor, { x: 20, y: 10 })!;
  expect(before).not.toBeNull();
  build(g, 'wall');
  expect(spatial.canFitAt(actor, { x: 20, y: 10 })).toBe(false);
  expect(spatial.commitPlacement(before)).toBe(false);
  // A fresh plan also rejects the changed footprint.
  actor.loc = { x: 20, y: 11 };
  const plan = spatial.planStepPlacement(actor, { x: 20, y: 10 });
  expect(plan).toBeNull();
  const c = g.world5!.structures[0]!.barrier!;
  fixture(g, 'structure', {
    kind: 'damage',
    componentId: c.id,
    revision: c.revision,
    amount: 100,
    damageKind: 'physical'
  });
  expect(spatial.canFitAt(actor, { x: 20, y: 10 })).toBe(true);
});

it('load restores composed opacity before rebuilding native lighting, without changing saved memory', () => {
  const { g, h } = structureHarness();
  createCamp(g);
  build(g, 'wall');
  const before = g.toSnapshot().grid,
    save = h.save();
  h.load(save);
  expect(g.grid.getCell(21, 10)!.isOpaque).toBe(true);
  expect(g.toSnapshot().grid).toEqual(before);
  bindWorldStructures(g);
});

it('native topology beside a structure rebuilds visibility after publishing the changed cell cache', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'floor');
  expect(g.grid.getCell(23, 10)!.isVisible).toBe(true);
  g.grid.setTerrainLayer(22, 10, DungeonLayer.DUNGEON, TerrainType.WALL);
  settleStructureFoundations(g);
  expect(g.grid.getCell(23, 10)!.isVisible).toBe(false);
  g.grid.setTerrainLayer(22, 10, DungeonLayer.DUNGEON, TerrainType.FLOOR);
  settleStructureFoundations(g);
  expect(g.grid.getCell(23, 10)!.isVisible).toBe(true);
});
