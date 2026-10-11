import { expect, it, vi } from 'vitest';
import { forage, ally, grant } from './support/forageFixture';
import { installedOptionalModules } from './support/installedExtensions';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { beginDeparture, retireActor } from '../engine/Core/ActorDeparture';
import { TerrainType } from '../engine/Map/Grid';
import { actorSourceRevision, squareAnchorRevision, spatialCatalogFor } from '../engine/Movement/CreatureSpatial';
import { spatialTerrainRevision } from '../engine/Movement/SpatialRevision';
import { phasedAttackBoundaryIdentity } from '../engine/Core/PhasedAttackProduction';
import { productionActorActionScheduler } from '../engine/Core/ActorActionProduction';
import { nativeStat } from '../engine/Stats/NativeStatSources';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { timeSystem } from '../engine/Systems/Time';
import { logger } from '../engine/Systems/Logger';
import monsters from '../data/monsters.json';
import type { MonsterData } from '../entities/Monster';

// Neutral foundation owner, with the installed combat session when available.
// Controlled native geometry is accepted through the real save validator before
// each fault. No optional gameplay package is required for retirement coverage.
it.each([
  { cached: false, passenger: false, spatial: false }, { cached: false, passenger: true, spatial: false },
  { cached: true, passenger: false, spatial: false }, { cached: true, passenger: true, spatial: false },
  { cached: false, passenger: false, spatial: true }, { cached: false, passenger: true, spatial: true },
])('XR-02 outer late retirement restores native closure cached=$cached passenger=$passenger spatial=$spatial', ({ cached, passenger, spatial }) => {
  const h = forage(installedOptionalModules(['combat'])), g = h.game();
  let carrier = ally(h);
  for (let x = 25; x <= 36; x++) for (let y = 16; y <= 25; y++) {
    g.grid.setTerrain(x, y, TerrainType.FLOOR);
    const cell = g.grid.getCell(x, y)!;
    cell.layers[1] = cell.layers[2] = cell.layers[3] = TerrainType.NOTHING;
    cell.machineNumber = 0;
  }
  carrier.loc = { x: 30, y: 20 };
  if (spatial) carrier.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' };
  if (passenger) {
    const carried = g.createSquareMonster(monsters.find(m => m.id === 'rat')! as MonsterData, 2, { x: 28, y: 20 });
    expect(carried).not.toBeNull();
    g.monsters = g.monsters.filter(m => m !== carried);
    carrier.carriedMonster = carried;
  }
  const item = grant(h); g.player.inventory.removeItem(item); carrier.carriedItem = item;
  g.examinedEntityIds.add(carrier.id);
  if (carrier.carriedMonster) g.examinedEntityIds.add(carrier.carriedMonster.id);
  const id = carrier.id;
  if (cached) {
    g.grid.setTerrain(g.player.x, g.player.y, TerrainType.STAIRS_DOWN);
    h.command('stairs_down'); expect(g.depth).toBe(2);
    expect(g.levels.get(1)!.monsters).toContain(carrier);
  }
  beginDeparture(g, id, { owner: 'fgfixture', reason: 'starvation', visibleGraceTicks: 1000 }, false, true);
  expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
  carrier = g.departureActor(id)!;
  if (spatial) g.planSquareStep(carrier, { kind: 'anchors', anchors: [{ x: 32, y: 20, pose: 'r0' }] });
  const motion = (g as unknown as { squareMotion?: { spatial: { occupancyRevision: number; terrainRevision: number } } }).squareMotion;
  const occupancy = motion?.spatial.occupancyRevision, terrain = motion?.spatial.terrainRevision;
  const carried = carrier.carriedMonster;
  expect(!!carried).toBe(passenger);
  const before = structuredClone(g.toSnapshot()), actors = [carrier, ...(carried ? [carried] : [])];
  const source = actors.map(actorSourceRevision), anchor = actors.map(squareAnchorRevision), catalogs = actors.map(spatialCatalogFor);
  const hooks = actors.map(a => a.extensionHooks), phase = phasedAttackBoundaryIdentity(g), scheduler = productionActorActionScheduler(g);
  const roots = [g.player, g.grid, g.monsters, g.dormantMonsters, g.levels, g.purgatory, g.examinedEntityIds, g.extensionRuntime];
  const examined = [...g.examinedEntityIds], random = rng.getState(), allocator = getNextEntityId(), tick = timeSystem.currentTick;
  const native = g.retireDepartingActors.bind(g), original = Object.freeze({ failure: 'outer late retirement' });
  const death = vi.spyOn(g.extensionRuntime!, 'captureDeath');
  const fault = vi.spyOn(g, 'retireDepartingActors').mockImplementation(ids => { native(ids); throw original; });
  const graph = auditFullObjectGraph({ g, logger });
  try { retireActor(g, id); expect.unreachable(); } catch (error) { expect(error).toBe(original); }
  const after = g.toSnapshot(); after.savedAt = before.savedAt;
  expect.soft(after).toEqual(before);
  expect.soft(graph.differences()).toEqual([]);
  expect.soft(actors.map(actorSourceRevision)).toEqual(source);
  expect.soft(actors.map(squareAnchorRevision)).toEqual(anchor);
  expect.soft([...g.examinedEntityIds]).toEqual(examined);
  [g.player, g.grid, g.monsters, g.dormantMonsters, g.levels, g.purgatory, g.examinedEntityIds, g.extensionRuntime]
    .forEach((root, i) => expect(root).toBe(roots[i]));
  expect(g.departureActor(id)).toBe(carrier); expect(carrier.carriedMonster).toBe(carried);
  actors.forEach((a, i) => {
    expect(a.extensionHooks).toBe(hooks[i]); expect(spatialCatalogFor(a)).toBe(catalogs[i]);
    expect(nativeStat(a, 'native.max-hp')).toBe(a.maxHp);
  });
  phasedAttackBoundaryIdentity(g).forEach((binding, i) => expect(binding).toBe(phase[i]));
  expect(productionActorActionScheduler(g)).toBe(scheduler);
  expect((g as unknown as { squareMotion?: unknown }).squareMotion).toBe(motion);
  expect(motion?.spatial.occupancyRevision).toBe(occupancy); expect(motion?.spatial.terrainRevision).toBe(terrain);
  if (terrain !== undefined) expect(spatialTerrainRevision(g.grid)).toBe(terrain);
  expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(allocator); expect(timeSystem.currentTick).toBe(tick);
  expect(death).not.toHaveBeenCalled();
  fault.mockRestore(); retireActor(g, id); retireActor(g, id);
  expect(g.departureActor(id)).toBeUndefined(); expect(carrier.hp).toBeGreaterThan(0); expect(carrier.deathProcessed).toBe(false);
  if (carried) {
    expect(g.departureActor(carried.id)).toBe(carried); expect(carried.loc).toEqual({ x: 30, y: 20 });
    expect(cached ? g.levels.get(1)!.monsters : g.monsters).toContain(carried);
  }
  expect(g.extensionRuntime!.snapshot().foundation.departures!.receipts.filter(r => r.actorId === id)).toHaveLength(1);
  expect(g.stats).toEqual(before.stats); expect(death).not.toHaveBeenCalled();
  expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
});
