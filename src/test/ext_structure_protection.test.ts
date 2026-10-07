import { afterEach, it, expect, vi } from 'vitest';
import { structureHarness, createCamp, fixture, build } from './support/structureFixture';
import { TerrainType } from '../engine/Map/Grid';
import { allocateWorldId } from '../engine/Core/WorldWorkWorld';
import { bindWorldStructures } from '../engine/Map/StructureWorld';
import { validOwnedRegions } from '../ext/regions';
import { validateStructureRoots } from '../ext/structureSchema';
import { withWorldActorScope, worldWorkLastError } from '../engine/Core/WorldWork';
import { planStructureChange, planRegionChange } from '../engine/Map/StructureWorld';
import { assembleWorldItem } from '../engine/Items/WorldItems';
import { itemDefinition } from '../engine/Core/WorldWorkWorld';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
afterEach(() => vi.restoreAllMocks());
it.each([
  'stairs',
  'machine',
  'impregnable',
  'actor',
  'footprint',
  'item',
  'interactable',
  'unseen',
  'escape'
])('protects %s without consuming construction inputs', (kind) => {
  const { g } = structureHarness();
  const r = createCamp(g),
    at = { x: 21, y: 10 },
    cell = g.grid.getCell(at.x, at.y)!;
  if (kind === 'stairs') g.grid.setTerrain(at.x, at.y, TerrainType.STAIRS_UP);
  if (kind === 'machine') cell.machineNumber = 99;
  if (kind === 'impregnable') g.grid.impregnableCells.add(at.y * g.grid.width + at.x);
  if (kind === 'item') {
    const i = assembleWorldItem(itemDefinition(g, 'c5fixture.stone'), 1);
    i.loc = at;
    g.items.push(i);
  }
  if (kind === 'actor' || kind === 'footprint') {
    const m = new Monster(
      kind === 'actor' ? 21 : 22,
      kind === 'actor' ? 10 : 9,
      (monsters as MonsterData[]).find((m) => m.id === 'rat')!
    );
    if (kind === 'footprint') {
      m.loc = { x: 21, y: 9 };
      m.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' };
    }
    g.monsters.push(m);
  }
  if (kind === 'interactable')
    g.extensionRuntime!.worldWorkPlace({
      owner: 'c5fixture',
      depth: 1,
      ...at,
      instanceKey: 'protected',
      contentId: 'c5fixture.table',
      nameKey: 'ext.c5fixture.table.name',
      descriptionKey: 'ext.c5fixture.table.description',
      glyph: 'T',
      color: '#aaaaaa',
      interactionDistance: 1,
      priority: 0
    });
  if (kind === 'unseen') cell.isVisible = false;
  if (kind === 'escape') {
    for (let y = 9; y <= 11; y++)
      for (let x = 19; x <= 21; x++)
        if (!(x === 20 && y === 10) && !(x === 21 && y === 10))
          g.grid.setTerrain(x, y, TerrainType.WALL);
  }
  const inventory = g.player.inventory.items.map((i) => ({ id: i.id, q: i.quantity }));
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
    expect(
      planStructureChange(
        {
          kind: 'build',
          regionId: r.id,
          levelRef: { kind: 'dungeon', depth: 1 },
          at,
          definitionId: 'c5fixture.wall'
        },
        scope
      )
    ).toMatchObject({ ok: false, code: kind === 'unseen' ? 'C5_BLOCKED' : 'C5_PROTECTED' })
  );
  expect(g.player.inventory.items.map((i) => ({ id: i.id, q: i.quantity }))).toEqual(inventory);
  expect(g.world5!.structures).toHaveLength(0);
});
it('barrier slots are mutually exclusive and a standalone station binds atomically', () => {
  const { g } = structureHarness();
  createCamp(g);
  const row = build(g, 'door')!;
  build(g, 'window');
  expect(worldWorkLastError(g)).toBe('C5_OVERLAP');
  expect(row.barrier!.definitionId).toBe('c5fixture.door');
  fixture(g, 'structure', { kind: 'dismantle', componentId: row.barrier!.id, revision: 0 });
  const e = g.extensionRuntime!.worldWorkPlace({
    owner: 'c5fixture',
    depth: 1,
    x: 21,
    y: 10,
    instanceKey: 'standalone',
    contentId: 'c5fixture.table',
    nameKey: 'ext.c5fixture.table.name',
    descriptionKey: 'ext.c5fixture.table.description',
    glyph: 'T',
    color: '#aaaaaa',
    interactionDistance: 1,
    priority: 0
  });
  const s = {
    owner: 'c5fixture',
    interactableId: e.id,
    definitionId: 'c5fixture.table',
    levelRef: { kind: 'dungeon' as const, depth: 1 },
    boundComponentId: null as number | null,
    revision: 0
  };
  g.world5!.stations.push(s);
  const count = g.extensionRuntime!.worldWorkEntities().length;
  const fixturePart = build(g, 'bound-table')!.fixture!;
  expect(worldWorkLastError(g)).toBeNull();
  expect(s.boundComponentId).toBe(fixturePart.id);
  expect(s.revision).toBe(1);
  expect(g.extensionRuntime!.worldWorkEntities()).toHaveLength(count);
});
it('actual work cells reject protected machines and native D40 stairs', () => {
  const { g } = structureHarness();
  createCamp(g);
  g.grid.getCell(21, 10)!.machineNumber = 1;
  build(g, 'floor');
  expect(worldWorkLastError(g)).toBe('C5_PROTECTED');
  const { g: deep } = structureHarness();
  deep.depth = 40;
  const r = createCamp(deep);
  deep.grid.setTerrain(21, 10, TerrainType.STAIRS_DOWN);
  withWorldActorScope(deep, 'c5fixture', deep.player.id, 'trusted-world', (scope) =>
    expect(planStructureChange({
      kind: 'build', regionId: r.id, definitionId: 'c5fixture.floor',
      levelRef: {kind: 'dungeon', depth: 40}, at: {x: 21, y: 10}
    }, scope)).toMatchObject({ ok: false, code: 'C5_PROTECTED' })
  );
});

it('the unique station work cell is protected even for a nonblocking floor', () => {
  const { g } = structureHarness();
  const r = createCamp(g),
    e = g.extensionRuntime!.worldWorkPlace({
      owner: 'c5fixture',
      depth: 1,
      x: 22,
      y: 10,
      instanceKey: 'single-work',
      contentId: 'c5fixture.table',
      nameKey: 'ext.c5fixture.table.name',
      descriptionKey: 'ext.c5fixture.table.description',
      glyph: 'T',
      color: '#aaaaaa',
      interactionDistance: 1,
      priority: 0
    });
  g.world5!.stations.push({
    owner: 'c5fixture',
    interactableId: e.id,
    definitionId: 'c5fixture.table',
    levelRef: { kind: 'dungeon', depth: 1 },
    boundComponentId: null,
    revision: 0
  });
  for (let y = 9; y <= 11; y++)
    for (let x = 21; x <= 23; x++)
      if ((x !== 21 || y !== 10) && (x !== 22 || y !== 10))
        g.grid.setTerrain(x, y, TerrainType.WALL);
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
    expect(
      planStructureChange(
        {
          kind: 'build',
          regionId: r.id,
          levelRef: { kind: 'dungeon', depth: 1 },
          at: { x: 21, y: 10 },
          definitionId: 'c5fixture.floor'
        },
        scope
      )
    ).toMatchObject({ ok: false, code: 'C5_PROTECTED' })
  );
});
it('384 cells in one camp are accepted and the 385th plan is rejected', () => {
  const { g } = structureHarness();
  const r = createCamp(g);
  for (let y = 1; y < 28; y++) for (let x = 1; x < 78; x++) g.grid.getCell(x, y)!.isVisible = true;
  fixture(g, 'region', {
    kind: 'expand',
    regionId: r.id,
    revision: 0,
    bounds: { x: 17, y: 7, width: 24, height: 20 }
  });
  for (let y = 7; y < 23; y++)
    for (let x = 17; x < 41; x++)
      g.world5!.structures.push({
        owner: 'c5fixture',
        regionId: r.id,
        levelRef: { kind: 'dungeon', depth: 1 },
        at: { x, y },
        floor: {
          id: allocateWorldId(g),
          definitionId: 'c5fixture.floor',
          hp: 100,
          revision: 0,
          doorOpen: null
        },
        barrier: null,
        roof: null,
        fixture: null
      });
  validateStructureRoots(g.world5!, ['c5fixture']);
  bindWorldStructures(g);
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
    expect(
      planStructureChange(
        {
          kind: 'build',
          regionId: r.id,
          levelRef: { kind: 'dungeon', depth: 1 },
          at: { x: 21, y: 23 },
          definitionId: 'c5fixture.floor'
        },
        scope
      )
    ).toMatchObject({ ok: false, code: 'C5_BUDGET' })
  );
});
it('camp global eight and same-level one limits are checked before mutation', () => {
  const { g } = structureHarness();
  createCamp(g);
  for (let y = 1; y < 28; y++) for (let x = 1; x < 78; x++) g.grid.getCell(x, y)!.isVisible = true;
  fixture(g, 'region', {
    kind: 'create',
    instanceKey: 'same-layer',
    levelRef: { kind: 'dungeon', depth: 1 },
    bounds: { x: 4, y: 7, width: 9, height: 9 }
  });
  expect(worldWorkLastError(g)).toBe('C5_OVERLAP');
  const regions = Array.from({ length: 8 }, (_, i) => ({
    owner: 'c5fixture',
    id: 1000 + i,
    depth: i + 2,
    revision: 0,
    campSlotId: i as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
    instanceKey: `camp.${i}`,
    bounds: { x: 17, y: 7, width: 9, height: 9 }
  }));
  g.extensionRuntime!.worldStructureSetRegions(regions);
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
    expect(
      planRegionChange(
        {
          kind: 'create',
          instanceKey: 'ninth',
          levelRef: { kind: 'dungeon', depth: 1 },
          bounds: { x: 17, y: 7, width: 9, height: 9 }
        },
        scope
      )
    ).toMatchObject({ ok: false, code: 'C5_BUDGET' })
  );
});
it('shared region schema accepts 128 generated rows, requires revision, and rejects 129', () => {
  const regions = Array.from({ length: 128 }, (_, i) => ({
    owner: 'fixture',
    id: i + 1,
    depth: 1 + Math.floor(i / 4),
    revision: 0,
    instanceKey: `g.${i}`,
    bounds: { x: 1 + (i % 4) * 10, y: 1, width: 9, height: 9 }
  }));
  expect(validOwnedRegions(regions, ['fixture'])).toBe(true);
  expect(
    validOwnedRegions(
      [...regions, { ...regions[0]!, id: 129, depth: 40, instanceKey: 'extra' }],
      ['fixture']
    )
  ).toBe(false);
  const bad = structuredClone(regions) as any[];
  delete bad[0].revision;
  expect(validOwnedRegions(bad, ['fixture'])).toBe(false);
});

it('the serialized global maximum is 3072 cells and 12288 independently identified parts', () => {
  const { g } = structureHarness();
  const w = structuredClone(g.world5!);
  w.structures = [];
  for (let depth = 2; depth <= 8; depth++)
    w.levels.push({ ...structuredClone(w.levels[0]!), levelRef: { kind: 'dungeon', depth } });
  for (let depth = 1; depth <= 8; depth++)
    for (let y = 7; y < 23; y++)
      for (let x = 17; x < 41; x++) {
        const part = (name: string) => ({
          id: w.nextWorldId++,
          definitionId: `c5fixture.${name}`,
          hp: 100,
          revision: 0,
          doorOpen: null
        });
        w.structures.push({
          owner: 'c5fixture',
          regionId: 1000 + depth,
          levelRef: { kind: 'dungeon', depth },
          at: { x, y },
          floor: part('floor'),
          barrier: part('wall'),
          roof: part('roof'),
          fixture: part('fixture')
        });
      }
  expect(w.structures).toHaveLength(3072);
  expect(
    new Set(w.structures.flatMap((s) => [s.floor!.id, s.barrier!.id, s.roof!.id, s.fixture!.id]))
      .size
  ).toBe(12288);
  expect(() => validateStructureRoots(w, ['c5fixture'])).not.toThrow();
  w.structures.push({
    ...structuredClone(w.structures[w.structures.length - 1]!),
    regionId: 2000,
    at: { x: 41, y: 23 }
  });
  expect(() => validateStructureRoots(w, ['c5fixture'])).toThrow();
});

it('a giant generation arena cannot be appropriated by a runtime camp', () => {
  const { g } = structureHarness(['giants']);
  g.startNewGame({
    seed: 7306,
    mode: 'wizard',
    ruleSet: 'extended',
    extensions: ['c5fixture', 'giants']
  });
  for (let depth = 2; depth <= 3; depth++) {
    g.depth = depth;
    (g as any).generateDepth();
  }
  const arena = g.extensionRuntime!.worldStructureRegions().find((r) => r.owner === 'giants')!;
  expect(arena).toBeDefined();
  expect(arena.revision).toBe(0);
  const bounds = {
    x: Math.max(1, Math.min(68, arena.bounds.x)),
    y: Math.max(1, Math.min(19, arena.bounds.y)),
    width: 9,
    height: 9
  };
  for (let y = 1; y < 28; y++) for (let x = 1; x < 78; x++) g.grid.getCell(x, y)!.isVisible = true;
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
    expect(
      planRegionChange(
        {
          kind: 'create',
          instanceKey: 'arena-camp',
          levelRef: { kind: 'dungeon', depth: 3 },
          bounds
        },
        scope
      )
    ).toMatchObject({ ok: false, code: 'C5_OVERLAP' })
  );
});

it('sixteen camp chests fit and the seventeenth is refused without spending materials', () => {
  const { g } = structureHarness();
  const r = createCamp(g);
  for (let y = 8; y <= 9; y++)
    for (let x = 18; x <= 25; x++) {
      g.player.loc = { x: x - 1, y };
      build(g, 'chest', { x, y });
      expect(worldWorkLastError(g)).toBeNull();
    }
  g.player.loc = { x: 20, y: 10 };
  const items = g.player.inventory.items.map((i) => ({ id: i.id, q: i.quantity }));
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
    expect(
      planStructureChange(
        {
          kind: 'build',
          regionId: r.id,
          levelRef: { kind: 'dungeon', depth: 1 },
          at: { x: 21, y: 10 },
          definitionId: 'c5fixture.chest'
        },
        scope
      )
    ).toMatchObject({ ok: false, code: 'C5_BUDGET' })
  );
  expect(g.player.inventory.items.map((i) => ({ id: i.id, q: i.quantity }))).toEqual(items);
});
it('structure stations share the existing global 128 station budget', () => {
  const { g } = structureHarness();
  const r = createCamp(g);
  for (let i = 0; i < 128; i++) {
    const e = g.extensionRuntime!.worldWorkPlace({
      owner: 'c5fixture',
      depth: 1,
      x: 40 + (i % 30),
      y: 2 + Math.floor(i / 30),
      instanceKey: `station.${i}`,
      contentId: 'c5fixture.table',
      nameKey: 'ext.c5fixture.table.name',
      descriptionKey: 'ext.c5fixture.table.description',
      glyph: 'T',
      color: '#aaaaaa',
      interactionDistance: 1,
      priority: 0
    });
    g.world5!.stations.push({
      owner: 'c5fixture',
      interactableId: e.id,
      definitionId: 'c5fixture.table',
      levelRef: { kind: 'dungeon', depth: 1 },
      boundComponentId: null,
      revision: 0
    });
  }
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
    expect(
      planStructureChange(
        {
          kind: 'build',
          regionId: r.id,
          levelRef: { kind: 'dungeon', depth: 1 },
          at: { x: 21, y: 10 },
          definitionId: 'c5fixture.bound-table'
        },
        scope
      )
    ).toMatchObject({ ok: false, code: 'C5_BUDGET' })
  );
});
