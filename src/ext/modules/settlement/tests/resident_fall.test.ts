import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { it, expect, vi } from 'vitest';
import { residentScene } from './residentHelpers';
import { current, travelScenes, stairs } from './helpers';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { TerrainType } from '../../../../engine/Map/Grid';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { advanceWorldClock } from '../../../world5';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';

// Controlled map/status prerequisites; falls and travel run the real public
// native command path. These cases do not claim natural route provenance.
it.each(['stay', 'escort'] as const)(
  'D: player falling leaves the %s resident at home without group teleportation',
  (mode) => {
    travelScenes();
    const { h, g, a } = residentScene(),
      c = current(g),
      r = residentComponent(g, a.id)!;
    if (mode === 'escort')
      expect(
        h.ext('settlement', 'set-residence', {
          v: 1,
          stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
          campId: c.regionId,
          campRevision: c.revision,
          targetId: a.id,
          targetRevision: r.revision,
          mode
        }).error
      ).toBeNull();
    const home = { ...a.loc };
    a.setStatusDuration('paralyzed', 1000);
    g.player.loc = { x: 27, y: 20 };
    g.grid.setTerrain(28, 20, TerrainType.CHASM);
    g.onConfirmRequest = () => true;
    h.command('move', { x: 1, y: 0 });
    g.onConfirmRequest = null;
    expect(g.depth).toBe(2);
    expect(g.monsters).not.toContain(a);
    expect(g.levels.get(1)!.monsters).toContain(a);
    expect(a.loc).toEqual(home);
    expect(a.entersLevelIn).toBe(0);
    expect(residentComponent(g, a.id)).toMatchObject({ campId: c.regionId, mode });
    const digest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(digest);
  }
);

it.each([false, true])(
  'D: real resident fall retains one home record through pending/cached destination=%s and actual reentry',
  (cached) => {
    travelScenes();
    const { h, g, a } = residentScene(),
      home = current(g),
      bed = residentComponent(g, a.id)!.bedId;
    if (cached) {
      h.command('move', { x: 0, y: -1 });
      h.command('move', { x: 0, y: -1 });
      h.command('move', { x: 1, y: 0 });
      stairs(h, g, true);
      stairs(h, g, false);
    }
    const actor = g.departureActors().find((m) => m.id === a.id)!;
    actor.loc = { x: 27, y: 20 };
    actor.ticksUntilTurn = 10000;
    const hp = actor.hp,
      loot = ItemLoader.spawnFood('mango', 27, 20)!;
    actor.carriedItem = loot;
    g.grid.setTerrain(27, 20, TerrainType.CHASM);
    for (let n = 0; n < 3 && g.monsters.includes(actor); n++) h.command('wait');
    expect(g.monsters).not.toContain(actor);
    expect(hp - actor.hp).toBeGreaterThanOrEqual(6);
    expect(hp - actor.hp).toBeLessThanOrEqual(12);
    expect(g.departureActors().filter((m) => m.id === actor.id)).toHaveLength(1);
    expect(actor.carriedItem).toBe(loot);
    expect(residentComponent(g, actor.id)).toMatchObject({
      campId: home.regionId,
      bedId: bed,
      mode: 'stay'
    });
    const pending = g.toSnapshot();
    const queue = pending.pendingFallenByDepth
      .filter((p) => p.depth === 2)
      .flatMap((p) => p.monsters);
    const cache = pending.levels.filter((l) => l.depth === 2).flatMap((l) => l.monsters);
    expect([...queue, ...cache].filter((m) => m.id === actor.id)).toHaveLength(1);
    expect(cached ? cache : queue).toContainEqual(expect.objectContaining({ id: actor.id }));
    const digest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(digest);
    stairs(h, g, true);
    const landed = g.monsters.find((m) => m.id === actor.id)!;
    expect(landed).toBeDefined();
    expect(g.departureActors().filter((m) => m.id === actor.id)).toHaveLength(1);
    expect(landed.preplaced).toBe(false);
    expect(landed.carriedItem?.id).toBe(loot.id);
    expect(landed.hp).toBe(actor.hp);
    expect(residentComponent(g, actor.id)?.campId).toBe(home.regionId);
    const end = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(end);
  }
);

it('D: starvation of a pending fallen worker retires it on the pending destination, drops original loot once and saves', () => {
  const { h, g, a } = residentScene();
  a.loc = { x: 27, y: 20 };
  a.ticksUntilTurn = 10000;
  const loot = ItemLoader.spawnFood('mango', 27, 20)!;
  a.carriedItem = loot;
  g.grid.setTerrain(27, 20, TerrainType.CHASM);
  for (let n = 0; n < 3 && g.monsters.includes(a); n++) h.command('wait');
  expect(g.monsters).not.toContain(a);
  const items = [...g.items];
  advanceWorldClock(g.world5!, 192000 - g.world5!.simulationTicks);
  settleResidentNeeds(g);
  expect(g.world5!.residents).toHaveLength(0);
  expect(g.departureActors()).not.toContain(a);
  expect(a.hp).toBeGreaterThan(0);
  expect(g.items).toEqual(items);
  expect(
    g
      .toSnapshot()
      .pendingFallenItemsByDepth.find((p) => p.depth === 2)!
      .items.filter((i) => i.id === loot.id)
  ).toHaveLength(1);
  expect(g.world5!.receipts.filter((r) => r.identity.startsWith('departure.'))).toHaveLength(1);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});

it('D/F2: native fall publication failure restores injury, RNG, ownership and full original object identities before retry', () => {
  const { h, g, a } = residentScene();
  a.loc = { x: 27, y: 20 };
  a.ticksUntilTurn = 10000;
  g.grid.setTerrain(27, 20, TerrainType.CHASM);
  const native = (g as any).displaceWorldResident.bind(g),
    hp = a.hp;
  let audit: ReturnType<typeof auditFullObjectGraph> | undefined,
    random: ReturnType<typeof rng.getState> | undefined,
    id: number | undefined;
  const checkpoint = g.checkpointResidentWorld.bind(g);
  vi.spyOn(g, 'checkpointResidentWorld').mockImplementation(() => {
    audit = auditFullObjectGraph({ g, logger });
    random = rng.getState();
    id = getNextEntityId();
    const restore = checkpoint();
    return () => {
      restore();
      expect(audit!.differences()).toEqual([]);
    };
  });
  const fault = vi
    .spyOn(g as any, 'displaceWorldResident')
    .mockImplementation((...args: unknown[]) => {
      native(...args);
      throw Error('fall publication');
    });
  expect(() => h.command('wait')).toThrow('fall publication');
  expect(audit, 'outer fall entry checkpoint').toBeDefined();
  expect(a.hp).toBe(hp);
  expect(g.monsters).toContain(a);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(id);
  fault.mockRestore();
  h.command('wait');
  expect(g.monsters).not.toContain(a);
  expect(hp - a.hp).toBeGreaterThanOrEqual(6);
  expect(hp - a.hp).toBeLessThanOrEqual(12);
  expect(g.departureActors().filter((m) => m.id === a.id)).toHaveLength(1);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});
