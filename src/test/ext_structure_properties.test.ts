import { assertWorldDefinitionPack } from '../engine/Core/WorldDefinitions';
import { definitions } from '../ext/testing/fixtures/structureBasic';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { structureHarness, createCamp, build, fixture } from './support/structureFixture';
import {
  readCellProperties,
  baseCellFlags,
  baseCellMechFlags,
  composedCellFlags,
  knownCellFlags,
  cellProjectileBlocked,
  cellLiquidBlocked
} from '../engine/Map/CellProperties';
import { rng } from '../engine/Random';
import { TerrainType, DungeonLayer, Grid } from '../engine/Map/Grid';
import { TERRAIN_FLAGS, T_OBSTRUCTS_PASSABILITY } from '../engine/Map/TerrainCatalog';
import { terrainFlagsOfCell } from '../engine/Map/DungeonFeature';
import { worldWorkLastError, withWorldActorScope } from '../engine/Core/WorldWork';
import {
  cellProperties,
  advanceStructureFire,
  identifyRooms,
  settleStructureFoundations
} from '../engine/Map/StructureWorld';
import { playerTravelTerrainAllowed } from '../engine/Movement/PlayerTravel';
import { hasInteractionLine } from '../ext/worldSpatial';
import { exposeTileToFire } from '../engine/Map/Promotion';
afterEach(() => vi.restoreAllMocks());
describe('C5 mechanical composition', () => {
  it('zero structure flags preserve signed bit unions for every catalog tile and mixed layers', () => {
    const grid = new Grid(2, 2),
      cell = grid.getCell(0, 0)!;
    for (const t of Object.keys(TERRAIN_FLAGS).map(Number))
      for (let layer = 0; layer < 4; layer++) {
        cell.layers.fill(TerrainType.NOTHING);
        cell.layers[layer] = t;
        cell.refreshTerrainProperties();
        const flags = cell.layers.reduce((n, t) => n | TERRAIN_FLAGS[t]!.flags, 0);
        expect(composedCellFlags(cell)).toBe(flags);
        expect(terrainFlagsOfCell(cell)).toBe(flags);
        expect(baseCellFlags(cell)).toBe(flags);
      }
  });
  it.each(['wall', 'door', 'window', 'floor', 'roof', 'bed', 'bound-table'])(
    '%s composes movement, sight, gas, liquid and projectile independently',
    (kind) => {
      const { g } = structureHarness();
      createCamp(g);
      const row = build(g, kind);
      expect(worldWorkLastError(g)).toBeNull();
      expect(row).toBeDefined();
      const cell = g.grid.getCell(21, 10)!,
        p = readCellProperties(cell),
        block = ['wall', 'door', 'window'].includes(kind),
        opaque = ['wall', 'door'].includes(kind);
      expect(p.blocksMovement).toBe(block);
      expect(p.blocksVision).toBe(opaque);
      expect(p.blocksGas).toBe(opaque);
      expect(p.blocksLiquid).toBe(block);
      expect(cell.isPassable).toBe(!block);
      expect(cell.isOpaque).toBe(opaque);
      expect(p.blocksPhysicalProjectile).toBe(block);
      expect(p.blocksMagicProjectile).toBe(opaque);
      expect(cellProjectileBlocked(cell, false)).toBe(block);
      expect(cellLiquidBlocked(cell)).toBe(block);
      expect(playerTravelTerrainAllowed(cell, g.grid.getCell(20, 10)!, g.player)).toBe(!block);
      expect(hasInteractionLine(g.grid, g.player.loc, { x: 21, y: 10 })).toBe(!block);
      const read = withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
        cellProperties({ kind: 'dungeon', depth: 1 }, { x: 21, y: 10 }, scope)
      );
      expect(read.ok).toBe(true);
      if (read.ok) expect(Object.isFrozen(read.value)).toBe(true);
    }
  );
  it('door opens without writing the base stack and room topology is stable', () => {
    const { g } = structureHarness();
    createCamp(g);
    const row = build(g, 'door')!,
      cell = g.grid.getCell(21, 10)!,
      layers = [...cell.layers],
      c = row.barrier!;
    fixture(g, 'structure', { kind: 'door', componentId: c.id, revision: c.revision, open: true });
    expect(cell.isPassable).toBe(true);
    expect(cell.layers).toEqual(layers);
    fixture(g, 'structure', { kind: 'door', componentId: c.id, revision: c.revision, open: false });
    expect(cell.isPassable).toBe(false);
  });
  it('fire ignition uses native fire and damages flammable components once per block', () => {
    const { g } = structureHarness();
    createCamp(g);
    const c = build(g, 'wall')!.barrier!,
      cell = g.grid.getCell(21, 10)!;
    expect(readCellProperties(cell).flammable).toBe(true);
    expect(exposeTileToFire(g.grid, 21, 10, true).ignited).toBe(true);
    expect(cell.isBurning).toBe(true);
    advanceStructureFire(g);
    expect(c.hp).toBe(90);
  });
  it('stable DF-like base changes retain structures; unstable ground destroys all slots at the environment boundary', () => {
    const { g } = structureHarness();
    createCamp(g);
    build(g, 'floor');
    build(g, 'roof');
    expect(g.world5!.structures[0]!.roof).toBeTruthy();
    g.grid.setTerrainLayer(21, 10, DungeonLayer.SURFACE, TerrainType.GRASS);
    expect(g.world5!.structures).toHaveLength(1);
    g.grid.setTerrainLayer(21, 10, DungeonLayer.LIQUID, TerrainType.WATER_DEEP);
    expect(g.world5!.structures).toHaveLength(1);
    settleStructureFoundations(g);
    expect(g.world5!.structures).toHaveLength(0);
    expect(g.grid.getCell(21, 10)!.layers[DungeonLayer.LIQUID]).toBe(TerrainType.WATER_DEEP);
    expect(
      withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (s) =>
        identifyRooms({ kind: 'dungeon', depth: 1 }, s)
      ).ok
    ).toBe(true);
  });
});

it('known geometry never reveals an unseen live structure and retains saved structure movement bits', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'window');
  const cell = g.grid.getCell(21, 10)!;
  expect(knownCellFlags(cell) & T_OBSTRUCTS_PASSABILITY).not.toBe(0);
  cell.isVisible = false;
  cell.hasMemory = true;
  cell.rememberedLayers = [
    TerrainType.FLOOR,
    TerrainType.NOTHING,
    TerrainType.NOTHING,
    TerrainType.NOTHING
  ];
  cell.rememberedTerrainFlags = 0;
  expect(knownCellFlags(cell) & T_OBSTRUCTS_PASSABILITY).toBe(0);
  cell.rememberedTerrainFlags = T_OBSTRUCTS_PASSABILITY;
  expect(knownCellFlags(cell) & T_OBSTRUCTS_PASSABILITY).not.toBe(0);
});

it('256 deterministic mixed four-layer samples preserve flags, mech bits, caches and both RNG streams', () => {
  const cell = new Grid(2, 2).getCell(0, 0)!,
    tiles = Object.keys(TERRAIN_FLAGS).map(Number),
    before = rng.getState();
  let sampleSeed = 0x5a351020;
  for (let sample = 0; sample < 256; sample++) {
    for (let layer = 0; layer < 4; layer++) {
      sampleSeed = (Math.imul(sampleSeed, 1664525) + 1013904223) >>> 0;
      cell.layers[layer] = tiles[sampleSeed % tiles.length]!;
    }
    cell.refreshTerrainProperties();
    const flags = cell.layers.reduce((f, t) => f | TERRAIN_FLAGS[t]!.flags, 0),
      mech = cell.layers.reduce((f, t) => f | TERRAIN_FLAGS[t]!.mechFlags, 0);
    expect(composedCellFlags(cell)).toBe(flags);
    expect(baseCellMechFlags(cell)).toBe(mech);
    expect(readCellProperties(cell)).toMatchObject({
      baseTerrainFlags: flags,
      baseMechFlags: mech
    });
    expect(cell.isPassable).toBe(!(flags & T_OBSTRUCTS_PASSABILITY));
  }
  expect(rng.getState()).toEqual(before);
});

it('rejects structure definition bounds, empty material lists and broken facility references', () => {
  const invalid = [
    (d: any) => (d.maxHp = 0),
    (d: any) => (d.maxHp = 1000001),
    (d: any) => (d.resistances.physical = -1),
    (d: any) => (d.resistances.fire = 101),
    (d: any) => (d.refundNumerator = -1),
    (d: any) => (d.refundNumerator = d.refundDenominator + 1),
    (d: any) => (d.refundDenominator = 0),
    (d: any) => (d.refundDenominator = 10001),
    (d: any) => (d.containerCapacity = 0),
    (d: any) => (d.containerCapacity = 65),
    (d: any) => (d.stationDefinitionId = 'c5fixture.missing'),
    (d: any) => (d.restPointDefinitionId = 'c5fixture.missing'),
    (d: any) => (d.constructionTicks = 0),
    (d: any) => (d.constructionTicks = 10001),
    (d: any) => (d.constructionCost = []),
    (d: any) => (d.constructionCost[0].count = 0),
    (d: any) => (d.constructionCost[0].count = 100),
    (d: any) => d.constructionCost.push({ ...d.constructionCost[0] }),
    (d: any) => (d.blocks.gas = 'yes')
  ];
  for (const mutate of invalid) {
    const pack = structuredClone(definitions);
    mutate(pack.structures![1]);
    expect(() => assertWorldDefinitionPack(pack, 'c5fixture')).toThrow();
  }
});
