import { it, expect, vi } from 'vitest';
import { forage, ally, grant, closedLoop } from './support/forageFixture';
import { isDeparting } from '../engine/Core/ActorDeparture';
import { rng } from '../engine/Random';
it('visible departure retains ally, drops stable carried item, never death/XP/RNG and cannot resurrect', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h),
    item = grant(h);
  g.player.inventory.removeItem(item);
  a.carriedItem = item;
  const r = rng.getState(),
    hp = a.hp;
  h.fixture({ kind: 'departure', actorId: a.id, grace: 300 });
  expect(isDeparting(g, a.id)).toBe(true);
  expect(a.isAlly).toBe(true);
  expect(a.leader).toBeNull();
  expect(a.boundToLeader).toBe(false);
  h.fixture({ kind: 'advance', ticks: 300 });
  expect(g.monsters).not.toContain(a);
  expect(g.purgatory).not.toContain(a);
  expect(g.items).toContain(item);
  expect(a.carriedItem).toBeNull();
  expect(a.hp).toBe(hp);
  expect(rng.getState()).toEqual(r);
  expect(g.extensionRuntime!.snapshot().foundation.deaths[String(a.id)]).toBeUndefined();
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds).toBeUndefined();
  expect(g.extensionRuntime!.snapshot().foundation.departures!.receipts).toHaveLength(1);
});
it('departure grace zero retires synchronously and receipt save/replay/seek', () => {
  const h = forage(),
    a = ally(h);
  h.fixture({ kind: 'departure', actorId: a.id, grace: 0 });
  expect(h.game().monsters).not.toContain(a);
  closedLoop(h);
});
it('departure deadline persisted and resumed', () => {
  const h = forage(),
    a = ally(h);
  h.fixture({ kind: 'departure', actorId: a.id, grace: 300 });
  closedLoop(h);
  h.fixture({ kind: 'advance', ticks: 300 });
  expect(h.game().extensionRuntime!.snapshot().foundation.departures!.active).toHaveLength(0);
  closedLoop(h);
});

import { TerrainType } from '../engine/Map/Grid';
it.each(['stairs', 'unseen', 'leaving'] as const)(
  'departure retires on %s without native death facts',
  (condition) => {
    const h = forage(),
      a = ally(h),
      g = h.game();
    const death = vi.spyOn(g.extensionRuntime!, 'captureDeath');
    h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
    if (condition === 'stairs') g.grid.setTerrain(a.x, a.y, TerrainType.STAIRS_UP);
    if (condition === 'unseen')
      h.fixture({ kind: 'relocate', actorId: a.id, at: { x: 65, y: 25 } });
    h.fixture({ kind: 'departure-settle', leaving: condition === 'leaving' });
    expect(g.monsters).not.toContain(a);
    expect(death).not.toHaveBeenCalled();
    expect(g.extensionRuntime!.snapshot().foundation.departures!.receipts).toHaveLength(1);
  }
);
it('departure AI chooses the nearest stairs, cannot attack and cannot follow', () => {
  const h = forage(),
    a = ally(h),
    g = h.game();
  g.grid.setTerrain(14, 10, TerrainType.STAIRS_UP);
  g.grid.setTerrain(7, 14, TerrainType.STAIRS_DOWN);
  const hp = g.player.hp;
  h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
  for (let n = 0; n < 4 && g.monsters.includes(a); n++)
    h.fixture({ kind: 'departure-step', actorId: a.id });
  expect(g.monsters).not.toContain(a);
  expect(g.player.hp).toBe(hp);
  expect(a.loc).toEqual({ x: 14, y: 10 });
  expect(a.entersLevelIn).toBe(0);
});
it('real giants group gives only its core a need and retires all members together', () => {
  const h = forage(['combat', 'giants']),
    g = h.game();
  expect(h.fixture({ kind: 'group', at: { x: 11, y: 10 } }).error).toBeNull();
  const group = g.bodyGroups![0]!,
    ids = group.members.flatMap((m) => (m.entityId === null ? [] : [m.entityId]));
  expect(ids.length).toBeGreaterThan(1);
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds!.rows.map((r) => r.actorId)).toEqual([
    group.coreId
  ]);
  const death = vi.spyOn(g.extensionRuntime!, 'captureDeath');
  h.fixture({ kind: 'departure', actorId: group.coreId, grace: 0 });
  expect(g.monsters.every((a) => !ids.includes(a.id))).toBe(true);
  expect(g.bodyGroups).toBeUndefined();
  expect(death).not.toHaveBeenCalled();
  closedLoop(h);
});
it('retirement clears a trusted cached alias after load and preserves recording', () => {
  const h = forage(),
    id = ally(h).id;
  closedLoop(h);
  const g = h.game(),
    a = g.monsters.find((a) => a.id === id)!;
  (g as any).levels.set(g.depth, (g as any).activeLevelState());
  expect((g as any).levels.get(g.depth).monsters).toContain(a);
  h.fixture({ kind: 'departure', actorId: id, grace: 0 });
  expect((g as any).levels.get(g.depth).monsters).not.toContain(a);
  // The staged alias deliberately shares the active Grid. Tear down that
  // test-only alias before the independent physical ownership guard runs.
  (g as any).levels.delete(g.depth);
  expect(g.toSnapshot().entityGraph.monsters.some((a) => a.id === id)).toBe(false);
  closedLoop(h);
});

it.each(['slumber', 'paralyzed'] as const)(
  'departing %s actor cannot move through either decision entry',
  (status) => {
    const h = forage(),
      a = ally(h),
      g = h.game();
    g.grid.setTerrain(14, 10, TerrainType.STAIRS_UP);
    h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
    h.fixture({ kind: 'status', actorId: a.id, status, turns: 20 });
    const at = { ...a.loc };
    expect(a.prepareNativeDecision(g, 0)).toBe(true);
    expect(a.loc).toEqual(at);
    h.fixture({ kind: 'departure-step', actorId: a.id });
    expect(a.loc).toEqual(at);
    expect(g.player.hp).toBe(g.player.maxHp);
  }
);

import { descriptor } from '../ext/testing/fixtures/forageFixture';
it('actorDeparted provider failure drops its writes and preserves non-death retirement and receipt', () => {
  const bad = {
    ...descriptor,
    create: () => {
      const m = descriptor.create();
      m.hooks = {
        actorDeparted: (_fact, ctx) => {
          ctx.setState({ history: ['uncommitted'] });
          throw Error('departed provider');
        }
      };
      return m;
    }
  };
  const h = forage([], [bad]),
    g = h.game(),
    a = ally(h);
  const before = g.extensionRuntime!.snapshot().modules.fgfixture;
  const death = vi.spyOn(g.extensionRuntime!, 'captureDeath');
  h.fixture({ kind: 'departure', actorId: a.id, grace: 0 });
  expect(g.monsters).not.toContain(a);
  expect(death).not.toHaveBeenCalled();
  expect(g.extensionRuntime!.snapshot().modules.fgfixture).toEqual({
    ...(before as any),
    history: [
      ...(before as any).history,
      {
        owner: 'fgfixture',
        factId: 2,
        actorId: a.id,
        needId: 'fgfixture.satiety',
        kind: 'detached',
        band: 'full',
        previousBand: null,
        value: 50,
        crossedAtTick: 0,
        tick: 0,
        deferred: false,
        visibleToPlayer: true,
        reason: 'departed'
      }
    ]
  });
  expect(g.extensionRuntime!.snapshot().foundation.departures!.receipts).toHaveLength(1);
  expect(g.extensionRuntime!.readEdibleDiagnostics()).toContainEqual({
    owner: 'fgfixture',
    method: 'actorDeparted'
  });
  closedLoop(h);
});
