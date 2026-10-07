import {
  planStructureChange,
  planRegionChange,
  planRestPointPlacement,
  commitStructureWorld,
  settleStructureFoundations
} from '../engine/Map/StructureWorld';
import { DungeonLayer, TerrainType } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { logger } from '../engine/Systems/Logger';
import { afterEach, it, expect, vi } from 'vitest';
import { structureHarness, createCamp, build, fixture } from './support/structureFixture';
import {
  worldWorkLastError,
  withWorldActorScope,
  prepareTrustedWorldWork,
  commitWorldWork
} from '../engine/Core/WorldWork';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { spatialTerrainRevision } from '../engine/Movement/SpatialRevision';
import { assembleWorldItem } from '../engine/Items/WorldItems';
import { itemDefinition, putContainer, readWorkContext } from '../engine/Core/WorldWorkWorld';
afterEach(() => vi.restoreAllMocks());
it.each([100, 50, 1])('dismantle at %i HP refunds floor(original*hp/maxHp/2)', (hp) => {
  const { g } = structureHarness();
  createCamp(g);
  const c = build(g, 'floor')!.floor!;
  if (hp < 100)
    fixture(g, 'structure', {
      kind: 'damage',
      componentId: c.id,
      revision: 0,
      amount: 100 - hp,
      damageKind: 'physical'
    });
  const stone = () =>
      g.player.inventory.items
        .filter((i) => i.worldItem?.definitionId === 'c5fixture.stone')
        .reduce((n, i) => n + i.quantity, 0),
    before = stone();
  fixture(g, 'structure', { kind: 'dismantle', componentId: c.id, revision: c.revision });
  expect(worldWorkLastError(g)).toBeNull();
  expect(stone() - before).toBe(Math.floor((4 * hp) / 100 / 2));
  expect(g.world5!.structures).toHaveLength(0);
});
it('all slots share one structure coordinate and survive save/load; wrong mirror is refused', () => {
  const { g, h } = structureHarness();
  createCamp(g);
  for (const name of ['floor', 'roof', 'door', 'bed']) build(g, name);
  expect(g.world5!.structures).toHaveLength(1);
  const row = g.world5!.structures[0]!;
  expect([row.floor, row.roof, row.barrier, row.fixture].every(Boolean)).toBe(true);
  const save = h.save();
  h.load(save);
  expect(g.grid.getCell(21, 10)!.isPassable).toBe(false);
  const invalid = JSON.parse(save),
    e = invalid.extensions.foundation.world.entities.find(
      (e: any) => e.id === invalid.run.world5.restPoints[0].interactableId
    );
  e.x++;
  expect(g.loadSnapshot(invalid)).toBe(false);
});
it('destruction drops chest contents or moves them to remains, preserving item IDs', () => {
  const { g } = structureHarness();
  createCamp(g);
  const c = build(g, 'chest')!.fixture!,
    chest = g.world5!.containers.find(
      (ch) =>
        ch.kind === 'chest' &&
        g
          .extensionRuntime!.worldWorkEntities()
          .some((e) => e.id === (ch.position as any).interactableId && e.x === 21 && e.y === 10)
    )!;
  const item = assembleWorldItem(itemDefinition(g, 'c5fixture.stone'), 7);
  putContainer(g, chest.id, item);
  fixture(g, 'structure', {
    kind: 'damage',
    componentId: c.id,
    revision: 0,
    amount: 100,
    damageKind: 'physical'
  });
  expect(worldWorkLastError(g)).toBeNull();
  expect(g.world5!.containers.some((ch) => ch.id === chest.id)).toBe(false);
  expect(g.items.find((i) => i.id === item.id)?.quantity).toBe(7);
  expect(g.worldContainerItems!.has(item.id)).toBe(false);
});
it('publication failure restores the independent object graph, IDs, RNG and spatial revisions', () => {
  const { g } = structureHarness();
  createCamp(g);
  const grid = g.grid,
    revision = spatialTerrainRevision(grid),
    runtime = g.extensionRuntime!;
  const native = runtime.worldWorkPlace.bind(runtime);
  vi.spyOn(runtime, 'worldWorkPlace').mockImplementation((e) => {
    native(e);
    throw new Error('publication-fault');
  });
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) => {
    const p = planStructureChange(
      {
        kind: 'build',
        regionId: runtime.worldStructureRegions()[0]!.id,
        levelRef: { kind: 'dungeon', depth: 1 },
        at: { x: 21, y: 10 },
        definitionId: 'c5fixture.bed'
      },
      scope
    );
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const before = auditFullObjectGraph({ game: g, logger }),
      id = getNextEntityId(),
      random = rng.getState();
    expect(commitStructureWorld(g, p.value, scope)).toMatchObject({
      ok: false,
      code: 'C5_PROVIDER'
    });
    expect(before.differences()).toEqual([]);
    expect(getNextEntityId()).toBe(id);
    expect(rng.getState()).toEqual(random);
  });
  expect(g.grid).toBe(grid);
  expect(spatialTerrainRevision(grid)).toBe(revision);
  expect(g.world5!.structures).toHaveLength(0);
});

it.each(['region', 'rest-placement', 'derived'])(
  'publication failure at %s restores the independent complete graph',
  (kind) => {
    const { g } = structureHarness();
    const runtime = g.extensionRuntime!;
    if (kind !== 'region') createCamp(g);
    const method = kind === 'region' ? 'worldStructureSetRegions' : 'worldWorkPlace';
    if (kind === 'derived') {
      const native = g.refreshStructureDerivedState.bind(g);
      vi.spyOn(g, 'refreshStructureDerivedState').mockImplementation(() => {
        native();
        throw new Error('after-derived-publication');
      });
    } else {
      const native = (runtime[method] as (...args: any[]) => any).bind(runtime);
      vi.spyOn(runtime, method).mockImplementation((...args: any[]) => {
        native(...args);
        throw new Error('after-publication');
      });
    }
    withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) => {
      const plan =
        kind === 'region'
          ? planRegionChange(
              {
                kind: 'create',
                instanceKey: 'rollback',
                levelRef: { kind: 'dungeon', depth: 1 },
                bounds: { x: 17, y: 7, width: 9, height: 9 }
              },
              scope
            )
          : kind === 'rest-placement'
            ? planRestPointPlacement(
                {
                  definitionId: 'c5fixture.rest',
                  levelRef: { kind: 'dungeon', depth: 1 },
                  at: { x: 21, y: 10 }
                },
                scope
              )
            : planStructureChange(
                {
                  kind: 'build',
                  regionId: runtime.worldStructureRegions()[0]!.id,
                  levelRef: { kind: 'dungeon', depth: 1 },
                  at: { x: 21, y: 10 },
                  definitionId: 'c5fixture.floor'
                },
                scope
              );
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;
      const before = auditFullObjectGraph({ game: g, logger }),
        id = getNextEntityId(),
        random = rng.getState();
      expect(commitStructureWorld(g, plan.value, scope)).toMatchObject({
        ok: false,
        code: 'C5_PROVIDER'
      });
      expect(before.differences()).toEqual([]);
      expect(getNextEntityId()).toBe(id);
      expect(rng.getState()).toEqual(random);
    });
  }
);

it('failed foundation destruction restores the original native layers and all linked item roots', () => {
  const { g } = structureHarness();
  createCamp(g);
  build(g, 'chest');
  const runtime = g.extensionRuntime!,
    remove = runtime.worldStructureRemoveInteractable.bind(runtime);
  vi.spyOn(runtime, 'worldStructureRemoveInteractable').mockImplementation((id) => {
    remove(id);
    throw new Error('after-remove');
  });
  const before = auditFullObjectGraph({ game: g, logger }),
    random = rng.getState(),
    native = g.grid.getCell(21, 10)!.layers.slice();
  g.grid.setTerrainLayer(21, 10, DungeonLayer.LIQUID, TerrainType.WATER_DEEP);
  expect(() => settleStructureFoundations(g)).not.toThrow();
  expect(g.grid.getCell(21, 10)!.layers).toEqual(native);
  expect(
    before
      .differences()
      .filter(
        (p) =>
          !p.startsWith('world.game.world5.receipts') && !p.startsWith('world.game.world5.revision')
      )
  ).toEqual([]);
  expect(g.world5!.receipts[g.world5!.receipts.length - 1]).toMatchObject({
    result: 'interrupted',
    reason: 'C5_TRANSACTION'
  });
  expect(rng.getState()).toEqual(random);
});

it('blocked neighboring ground transfers every chest stack to remains without losing quantity', () => {
  const { g } = structureHarness();
  createCamp(g);
  const c = build(g, 'chest')!.fixture!;
  const chest = g.world5!.containers.find(
      (ch) =>
        ch.kind === 'chest' &&
        g
          .extensionRuntime!.worldWorkEntities()
          .some((e) => e.id === (ch.position as any).interactableId && e.x === 21 && e.y === 10)
    )!,
    item = assembleWorldItem(itemDefinition(g, 'c5fixture.stone'), 7);
  putContainer(g, chest.id, item);
  for (let y = 9; y <= 11; y++)
    for (let x = 20; x <= 22; x++)
      if (x !== 21 || y !== 10) g.grid.setTerrain(x, y, TerrainType.WALL);
  fixture(g, 'structure', {
    kind: 'damage',
    componentId: c.id,
    revision: 0,
    amount: 100,
    damageKind: 'physical'
  });
  expect(worldWorkLastError(g)).toBeNull();
  const remains = g.world5!.containers.find((c) => c.kind === 'remains')!;
  expect(remains.itemIds).toContain(item.id);
  expect(g.worldContainerItems!.get(item.id)!.quantity).toBe(7);
  expect(g.items.some((i) => i.id === item.id)).toBe(false);
});

it('one fixture owns independently identified chest, station and RestPoint mirrors through load and destruction', () => {
  const { g, h } = structureHarness();
  createCamp(g);
  const c = build(g, 'combined')!.fixture!;
  expect(worldWorkLastError(g)).toBeNull();
  const station = g.world5!.stations.find((s) => s.boundComponentId === c.id)!,
    rest = g.world5!.restPoints.find((s) => s.boundComponentId === c.id)!;
  const chest = g.world5!.containers.find(
    (s) =>
      s.kind === 'chest' &&
      g
        .extensionRuntime!.worldWorkEntities()
        .some((e) => e.id === (s.position as any).interactableId && e.x === 21 && e.y === 10)
  )!;
  const ids = [station.interactableId, rest.interactableId, (chest.position as any).interactableId];
  expect(new Set(ids).size).toBe(3);
  expect(
    ids.every((id) =>
      g.extensionRuntime!.worldWorkEntities().some((e) => e.id === id && e.x === 21 && e.y === 10)
    )
  ).toBe(true);
  h.load(h.save());
  fixture(g, 'structure', {
    kind: 'damage',
    componentId: c.id,
    revision: 0,
    amount: 100,
    damageKind: 'physical'
  });
  expect(worldWorkLastError(g)).toBeNull();
  expect(g.world5!.stations.some((s) => s.boundComponentId === c.id)).toBe(false);
  expect(g.world5!.restPoints).toHaveLength(0);
  expect(g.world5!.containers.some((s) => s.id === chest.id)).toBe(false);
  expect(g.extensionRuntime!.worldWorkEntities().some((e) => ids.includes(e.id))).toBe(false);
  h.load(h.save());
});

it('station destruction cancels a live work ticket and refunds its unconsumed input once', () => {
  const { g } = structureHarness();
  createCamp(g);
  const c = build(g, 'bound-table')!.fixture!,
    station = g.world5!.stations.find((s) => s.boundComponentId === c.id)!;
  const context = readWorkContext(g, 'c5fixture', { kind: 'inventory' });
  expect(context.ok).toBe(true);
  if (!context.ok) return;
  const prepared = prepareTrustedWorldWork(g, 'c5fixture', g.player.id, {
    kind: 'craft',
    recipeId: 'c5fixture.stone-work',
    batchCount: 1,
    stationId: station.interactableId,
    stationRevision: station.revision,
    sourceContainerId: null,
    sourceRevision: null,
    inventoryStamp: context.value.inventoryStamp
  });
  expect(prepared.ok).toBe(true);
  if (!prepared.ok) return;
  const stone = () =>
      g.player.inventory.items
        .filter((i) => i.worldItem?.definitionId === 'c5fixture.stone')
        .reduce((n, i) => n + i.quantity, 0),
    before = stone();
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) => {
    expect(commitWorldWork(g, prepared.value, scope).ok).toBe(true);
    expect(stone()).toBe(before - 1);
    const p = planStructureChange(
      { kind: 'damage', componentId: c.id, revision: 0, amount: 100, damageKind: 'physical' },
      scope
    );
    expect(p.ok).toBe(true);
    if (p.ok) expect(commitStructureWorld(g, p.value, scope).ok).toBe(true);
  });
  expect(g.world5!.tickets).toHaveLength(0);
  expect(stone()).toBe(before);
  expect(g.world5!.terminalTickets).toMatchObject([{ status: 'cancelled' }]);
  fixture(g, 'structure', {
    kind: 'damage',
    componentId: c.id,
    revision: 0,
    amount: 100,
    damageKind: 'physical'
  });
  expect(stone()).toBe(before);
});

it.each(['foundation', 'neighbor'])(
  'failed batch publication is contained and the next no-op refresh is inert: %s',
  (kind) => {
    const { g } = structureHarness();
    createCamp(g);
    build(g, 'floor');
    const x = kind === 'foundation' ? 21 : 22,
      cell = g.grid.getCell(x, 10)!,
      native = g.refreshStructureDerivedState.bind(g);
    vi.spyOn(g, 'refreshStructureDerivedState').mockImplementation(() => {
      native();
      throw Error('terrain-cache-publication');
    });
    g.grid.setTerrainLayer(x, 10, DungeonLayer.DUNGEON, TerrainType.WALL);
    expect(() => settleStructureFoundations(g)).not.toThrow();
    const before = auditFullObjectGraph({ game: g, logger }),
      random = rng.getState(),
      revision = spatialTerrainRevision(g.grid);
    expect(() => cell.refreshTerrainProperties()).not.toThrow();
    expect(before.differences()).toEqual([]);
    expect(rng.getState()).toEqual(random);
    expect(spatialTerrainRevision(g.grid)).toBe(revision);
    expect(g.world5!.receipts[g.world5!.receipts.length - 1]).toMatchObject({
      result: 'interrupted',
      reason: 'C5_TRANSACTION'
    });
  }
);
