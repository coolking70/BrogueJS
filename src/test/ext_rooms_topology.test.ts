import { afterEach, it, expect, vi } from 'vitest';
import { structureHarness, createCamp, build, fixture } from './support/structureFixture';
import { readCellProperties } from '../engine/Map/CellProperties';
import { TerrainType } from '../engine/Map/Grid';
import { allocateWorldId } from '../engine/Core/WorldWorkWorld';
import { bindWorldStructures, identifyRooms } from '../engine/Map/StructureWorld';
import { withWorldActorScope } from '../engine/Core/WorldWork';
import { rng } from '../engine/Random';
import type { Game } from '../engine/Core/Game';
afterEach(() => vi.restoreAllMocks());
const read = (g: Game) =>
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (s) => {
    const r = identifyRooms({ kind: 'dungeon', depth: 1 }, s);
    if (!r.ok) throw new Error(r.code);
    return r.value;
  });
function cabin(g: Game, width: number, height: number, roof = true) {
  const region = createCamp(g);
  fixture(g, 'region', {
    kind: 'expand',
    regionId: region.id,
    revision: 0,
    bounds: { x: 17, y: 6, width: 24, height: 20 }
  });
  for (let y = 7; y <= 8 + height; y++)
    for (let x = 18; x <= 19 + width; x++)
      g.grid.setTerrain(
        x,
        y,
        x === 18 || y === 7 || x === 19 + width || y === 8 + height
          ? TerrainType.WALL
          : TerrainType.FLOOR
      );
  if (roof)
    for (let y = 8; y < 8 + height; y++)
      for (let x = 19; x < 19 + width; x++)
        g.world5!.structures.push({
          owner: 'c5fixture',
          regionId: region.id,
          levelRef: { kind: 'dungeon', depth: 1 },
          at: { x, y },
          floor: null,
          barrier: null,
          fixture: null,
          roof: {
            id: allocateWorldId(g),
            definitionId: 'c5fixture.roof',
            hp: 100,
            revision: 0,
            doorOpen: null
          }
        });
  g.world5!.structures.sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
  bindWorldStructures(g);
}
it.each([
  [1, 1, false],
  [2, 1, true],
  [16, 8, true],
  [13, 10, false]
])('room size %i x %i obeys 2..128 bounds', (w, h, valid) => {
  const { g } = structureHarness();
  cabin(g, w as number, h as number);
  const rooms = read(g);
  expect(rooms.some((r) => r.cells.length === (w as number) * (h as number))).toBe(valid);
});
it('one tile and open corridors are excluded; natural underground cover is not a roof', () => {
  const { g } = structureHarness();
  cabin(g, 2, 1, false);
  expect(read(g)).toMatchObject([{ completeRoof: false, tags: [] }]);
  g.grid.setTerrain(18, 8, TerrainType.FLOOR);
  expect(read(g)).toHaveLength(0);
});
it('missing roofs invalidate qualification; deterministic read changes no time or RNG', () => {
  const { g } = structureHarness();
  cabin(g, 2, 1);
  const before = rng.getState(),
    ticks = g.world5!.simulationTicks,
    a = read(g);
  expect(read(g)).toEqual(a);
  expect(rng.getState()).toEqual(before);
  expect(g.world5!.simulationTicks).toBe(ticks);
  expect(a[0]!.completeRoof).toBe(true);
  expect(readCellProperties(g.grid.getCell(19, 8)!)).toMatchObject({
    usableRoof: true,
    roofBlocksSunlight: true
  });
  g.world5!.structures[0]!.roof = null;
  g.world5!.structures.shift();
  bindWorldStructures(g);
  expect(read(g)[0]!.completeRoof).toBe(false);
  expect(readCellProperties(g.grid.getCell(20, 8)!)).toMatchObject({
    usableRoof: false,
    roofBlocksSunlight: false
  });
});
it('door state does not change topology and an exterior opening/window provides ventilation', () => {
  const { g } = structureHarness();
  cabin(g, 2, 1);
  const region = g.extensionRuntime!.worldStructureRegions()[0]!;
  g.grid.setTerrain(18, 8, TerrainType.FLOOR);
  const door = {
    id: allocateWorldId(g),
    definitionId: 'c5fixture.door',
    hp: 100,
    revision: 0,
    doorOpen: false
  };
  g.world5!.structures.push({
    owner: 'c5fixture',
    regionId: region.id,
    levelRef: { kind: 'dungeon', depth: 1 },
    at: { x: 18, y: 8 },
    floor: null,
    roof: null,
    fixture: null,
    barrier: door
  });
  bindWorldStructures(g);
  const closed = read(g)[0]!;
  expect(closed.ventilated).toBe(false);
  door.doorOpen = true;
  bindWorldStructures(g);
  const open = read(g)[0]!;
  expect(open.cells).toEqual(closed.cells);
  expect(open.sessionRoomId).toBe(closed.sessionRoomId);
  expect(open.ventilated).toBe(true);
  door.definitionId = 'c5fixture.window';
  door.doorOpen = null as any;
  bindWorldStructures(g);
  expect(read(g)[0]!.ventilated).toBe(true);
});
it('diagonal corner holes do not connect room flood fills', () => {
  const { g } = structureHarness();
  cabin(g, 2, 1);
  g.grid.setTerrain(18, 7, TerrainType.FLOOR);
  expect(read(g)[0]!.cells).toHaveLength(2);
});
it('bed, chest and station share complete room tags without creating duplicate facilities', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'bed', { x: 21, y: 10 });
  build(g, 'chest', { x: 20, y: 11 });
  build(g, 'bound-table', { x: 21, y: 11 });
  const r = g.extensionRuntime!.worldStructureRegions()[0]!;
  for (let y = 9; y <= 12; y++)
    for (let x = 19; x <= 22; x++)
      if (x === 19 || x === 22 || y === 9 || y === 12) g.grid.setTerrain(x, y, TerrainType.WALL);
  for (let y = 10; y <= 11; y++)
    for (let x = 20; x <= 21; x++) {
      let row = g.world5!.structures.find((s) => s.at.x === x && s.at.y === y);
      if (!row) {
        row = {
          owner: 'c5fixture',
          regionId: r.id,
          levelRef: { kind: 'dungeon', depth: 1 },
          at: { x, y },
          floor: null,
          barrier: null,
          roof: null,
          fixture: null
        };
        g.world5!.structures.push(row);
      }
      row.roof = {
        id: allocateWorldId(g),
        definitionId: 'c5fixture.roof',
        hp: 100,
        doorOpen: null,
        revision: 0
      };
    }
  bindWorldStructures(g);
  expect(read(g)[0]!.tags).toEqual(['bedroom', 'warehouse', 'workshop']);
});

it('exactly 129 connected roofed cells are excluded', () => {
  const { g } = structureHarness();
  cabin(g, 13, 10);
  g.grid.setTerrain(19, 8, TerrainType.WALL);
  g.world5!.structures = g.world5!.structures.filter((s) => s.at.x !== 19 || s.at.y !== 8);
  bindWorldStructures(g);
  expect(read(g)).toHaveLength(0);
});
it('furnace workshop requires an intact boundary ventilation opening', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'furnace');
  const region = g.extensionRuntime!.worldStructureRegions()[0]!;
  for (let y = 9; y <= 12; y++)
    for (let x = 19; x <= 22; x++)
      if (x === 19 || x === 22 || y === 9 || y === 12) g.grid.setTerrain(x, y, TerrainType.WALL);
  for (let y = 10; y <= 11; y++)
    for (let x = 20; x <= 21; x++) {
      let row = g.world5!.structures.find((s) => s.at.x === x && s.at.y === y);
      if (!row) {
        row = {
          owner: 'c5fixture',
          regionId: region.id,
          levelRef: { kind: 'dungeon', depth: 1 },
          at: { x, y },
          floor: null,
          barrier: null,
          roof: null,
          fixture: null
        };
        g.world5!.structures.push(row);
      }
      row.roof = {
        id: allocateWorldId(g),
        definitionId: 'c5fixture.roof',
        hp: 100,
        revision: 0,
        doorOpen: null
      };
    }
  bindWorldStructures(g);
  expect(read(g)[0]!.tags).not.toContain('workshop');
  g.grid.setTerrain(22, 10, TerrainType.FLOOR);
  g.world5!.structures.push({
    owner: 'c5fixture',
    regionId: region.id,
    levelRef: { kind: 'dungeon', depth: 1 },
    at: { x: 22, y: 10 },
    floor: null,
    roof: null,
    fixture: null,
    barrier: {
      id: allocateWorldId(g),
      definitionId: 'c5fixture.window',
      hp: 100,
      revision: 0,
      doorOpen: null
    }
  });
  bindWorldStructures(g);
  expect(read(g)[0]!.tags).toContain('workshop');
});
