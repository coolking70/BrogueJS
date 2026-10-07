import { it, expect } from 'vitest';
import { forage, ally, grant, read, history, closedLoop } from './support/forageFixture';
import { projectNeed } from '../engine/Core/ActorNeeds';
import { definitions, descriptor } from '../ext/testing/fixtures/forageFixture';
import { edibleState } from '../engine/Core/EdibleState';
import { rng } from '../engine/Random';
const d = definitions.actorNeeds![0]!;
it('lazy integer materialization is identical in 1/2/17 partitions with exact zero point', () => {
  const row: import('../engine/Core/EdibleState').ActorNeedRow = {
    actorId: 2,
    needId: d.id,
    value: 50,
    remainderTicks: 3,
    lastSettledTick: 0,
    zeroSinceTick: null,
    deadlineFired: false,
    band: 'full',
    revision: 1
  };
  const want = projectNeed(row, d, 777);
  for (const segments of [
    [777],
    [123, 777],
    Array.from({ length: 17 }, (_, i) => Math.floor((777 * (i + 1)) / 17))
  ]) {
    let r = { ...row };
    for (const tick of segments) r = projectNeed(r, d, tick);
    expect(r).toEqual(want);
  }
  expect(want.zeroSinceTick).toBe(497);
  expect(want.remainderTicks).toBe(0);
});
it('qualifications attach/detach fixed triggers and projection is pure', () => {
  const h = forage(),
    a = ally(h),
    g = h.game();
  const s = g.extensionRuntime!.snapshot(),
    r = rng.getState();
  for (let n = 0; n < 40; n++) read(h);
  expect(g.extensionRuntime!.snapshot()).toEqual(s);
  expect(rng.getState()).toEqual(r);
  for (const trigger of ['resident-changed', 'trusted', 'group-changed', 'ally-lost']) {
    h.fixture({ kind: 'trigger', actorId: a.id, allied: false, trigger });
    expect(g.extensionRuntime!.snapshot().foundation.actorNeeds).toBeUndefined();
    h.fixture({ kind: 'trigger', actorId: a.id, allied: true, trigger });
    expect(g.extensionRuntime!.snapshot().foundation.actorNeeds!.rows).toHaveLength(1);
  }
  closedLoop(h);
});
it('band crossing exact tick, one deadline and deferred entry persisted', () => {
  const h = forage(),
    a = ally(h);
  h.fixture({ kind: 'advance', ticks: 301 });
  let events = history(h).filter((f) => f.kind === 'band');
  expect(events.slice(-1)[0]).toMatchObject({ crossedAtTick: 300, band: 'low', deferred: false });
  h.fixture({ kind: 'advance', ticks: 199, deferred: true });
  expect(
    history(h)
      .filter((f) => f.kind === 'band')
      .slice(-1)[0]
  ).toMatchObject({ crossedAtTick: 500, band: 'empty', deferred: true });
  h.fixture({ kind: 'advance', ticks: 200 });
  expect(history(h).filter((f) => f.kind === 'deadline')).toHaveLength(1);
  expect(h.game().extensionRuntime!.snapshot().foundation.departures!.active[0]!.actorId).toBe(
    a.id
  );
  h.fixture({ kind: 'advance', ticks: 100 });
  expect(history(h).filter((f) => f.kind === 'deadline')).toHaveLength(1);
  closedLoop(h);
});
it('feed native food accepted, saturates and clear zero deadline; rejection has zero costs', () => {
  const h = forage(),
    a = ally(h),
    g = h.game();
  grant(h, 'sample4');
  let c = read(h),
    item = c.inventory.find((i) => i.definitionId === 'fgfixture.sample4')!;
  let result = h.ext('fgfixture', 'feed', {
    targetId: a.id,
    targetRevision: c.feedTargets[0]!.targetRevision,
    itemId: item.itemId,
    inventoryStamp: c.inventoryStamp
  });
  expect(result.error).toBeNull();
  expect(a.hasStatus('telepathy')).toBe(false);
  expect(history(h).find((f) => f.operation === 'feed')).toMatchObject({
    outcome: { notApplicable: true }
  });
  for (const nativeFood of ['ration_of_food', 'mango']) {
    h.fixture({ kind: 'food', nativeFood });
    c = read(h);
    item = c.inventory.find((i) => i.nativeFood === nativeFood)!;
    const before = edibleState(g.extensionRuntime!).actorNeeds!.rows[0]!.revision;
    result = h.ext(
      'fgfixture',
      'feed',
      {
        targetId: a.id,
        targetRevision: c.feedTargets[0]!.targetRevision,
        itemId: item.itemId,
        inventoryStamp: c.inventoryStamp
      },
      [true]
    );
    expect(result.error).toBeNull();
    expect(edibleState(g.extensionRuntime!).actorNeeds!.rows[0]!.revision).toBeGreaterThan(before);
    expect(history(h).find((f) => f.nativeFood === nativeFood)).toBeDefined();
  }
  closedLoop(h);
});
it.each(['C5_STALE', 'C5_UNKNOWN_TARGET', 'C5_INPUT', 'C5_BAD_PAYLOAD', 'C5_GATE'])(
  '%s rejection zero write sets/time/RNG',
  (code) => {
    const h = forage(),
      a = ally(h),
      i = grant(h),
      g = h.game();
    if (code === 'C5_GATE')
      h.fixture({ kind: 'status', actorId: a.id, status: 'slumber', turns: 10 });
    const c = read(h),
      request: any = {
        targetId: a.id,
        targetRevision: c.feedTargets[0]!.targetRevision,
        itemId: i.id,
        inventoryStamp: c.inventoryStamp
      };
    if (code === 'C5_STALE') request.targetRevision++;
    if (code === 'C5_UNKNOWN_TARGET') request.targetId = 999999;
    if (code === 'C5_INPUT') request.itemId = 999999;
    if (code === 'C5_BAD_PAYLOAD') request.extra = 1;
    const before = g.toSnapshot(),
      r = rng.getState();
    expect(h.ext('fgfixture', 'feed', request).error).toBe(code);
    expect(g.player.inventory.items).toContain(i);
    expect(g.toSnapshot().run.currentTick).toBe(before.run.currentTick);
    expect(g.extensionRuntime!.snapshot()).toEqual(before.extensions);
    expect(rng.getState()).toEqual(r);
  }
);
it('time callback failure retains mechanical event/deadline once and drops module writes', () => {
  const bad = {
    ...descriptor,
    create: () => {
      const m = descriptor.create();
      m.actorNeedParticipant!.onNeedEvent = (f, tx) => {
        if (f.kind === 'band') {
          tx.replaceState({ history: [1] });
          throw Error('inject');
        }
      };
      return m;
    }
  };
  const h = forage([], [bad]);
  ally(h);
  h.fixture({ kind: 'advance', ticks: 301 });
  expect(edibleState(h.game().extensionRuntime!).actorNeeds!.rows[0]!.band).toBe('low');
  expect(history(h)).toEqual([]);
  expect(h.game().extensionRuntime!.readEdibleDiagnostics()).toHaveLength(1);
  h.fixture({ kind: 'advance', ticks: 1 });
  expect(h.game().extensionRuntime!.readEdibleDiagnostics()).toHaveLength(1);
});

import { prepareEdibleCommand } from '../engine/Core/EdibleCommands';
it.each(['C5_DISTANCE', 'C5_BUSY', 'C5_WRONG_LEVEL'] as const)(
  '%s feed plan refuses without allocations or writes',
  (code) => {
    const h = forage(),
      a = ally(h),
      i = grant(h),
      g = h.game(),
      c = read(h);
    const request = {
      targetId: a.id,
      targetRevision: c.feedTargets[0]!.targetRevision,
      itemId: i.id,
      inventoryStamp: c.inventoryStamp
    };
    if (code === 'C5_DISTANCE')
      h.fixture({ kind: 'relocate', actorId: a.id, at: { x: 14, y: 10 } });
    if (code === 'C5_BUSY') g.player.setStatusDuration('slumber', 2);
    if (code === 'C5_WRONG_LEVEL') {
      g.monsters = g.monsters.filter((m) => m !== a);
      (g as any).levels.set(2, { monsters: [a], dormantMonsters: [] });
    }
    const before = g.extensionRuntime!.snapshot(),
      tick = g.world5!.simulationTicks,
      r = rng.getState();
    expect(
      prepareEdibleCommand(g, { module: 'fgfixture', action: 'feed', payload: request }).outcome
    ).toMatchObject({ ok: false, code });
    expect(g.extensionRuntime!.snapshot()).toEqual(before);
    expect(g.world5!.simulationTicks).toBe(tick);
    expect(rng.getState()).toEqual(r);
    expect(g.player.inventory.items).toContain(i);
  }
);
it('overfeed No records one decision without consumption or need changes', () => {
  const h = forage(),
    a = ally(h),
    g = h.game();
  h.fixture({ kind: 'food' });
  const c = read(h),
    i = c.inventory.find((i) => i.nativeFood === 'ration_of_food')!,
    before = g.extensionRuntime!.snapshot(),
    tick = g.world5!.simulationTicks,
    r = rng.getState(),
    n = g.recordedInputEvents.length;
  expect(
    h.ext(
      'fgfixture',
      'feed',
      {
        targetId: a.id,
        targetRevision: c.feedTargets[0]!.targetRevision,
        itemId: i.itemId,
        inventoryStamp: c.inventoryStamp
      },
      [false]
    ).error
  ).toBeNull();
  expect(g.recordedInputEvents.length).toBe(n + 1);
  expect(g.player.inventory.items.some((v) => v.id === i.itemId)).toBe(true);
  expect(g.extensionRuntime!.snapshot()).toEqual(before);
  expect(g.world5!.simulationTicks).toBe(tick);
  expect(rng.getState()).toEqual(r);
  closedLoop(h);
});
it('events are actorId ordered and death detaches without requalifying', () => {
  const h = forage(),
    a = ally(h);
  h.fixture({ kind: 'ally', at: { x: 12, y: 10 } });
  const b = h.game().monsters.slice(-1)[0]!;
  h.fixture({ kind: 'advance', ticks: 301 });
  expect(
    history(h)
      .filter((f) => f.kind === 'band')
      .map((f) => f.actorId)
  ).toEqual([a.id, b.id]);
  h.fixture({ kind: 'damage', actorId: a.id, amount: 10000 });
  h.command('wait');
  expect(
    h
      .game()
      .extensionRuntime!.snapshot()
      .foundation.actorNeeds!.rows.map((r) => r.actorId)
  ).toEqual([b.id]);
  expect(history(h).find((f) => f.kind === 'detached' && f.actorId === a.id)).toMatchObject({
    reason: 'death'
  });
});

import { extensionDataFingerprint } from '../ext/fingerprint';
import { confirmationSatiety, markKnowledge } from '../engine/Core/KindKnowledge';
it('unknown eat/feed confirmation uses the same group-wide maximum rather than the hidden kind satiety', () => {
  const p = structuredClone(definitions);
  p.edibleItems![1]!.satiety = 40;
  p.edibleItems![3]!.satiety = 80;
  const rules = { schema: 1, version: '1.0.0', fingerprint: extensionDataFingerprint(p) },
    override = {
      ...descriptor,
      rules,
      create: () => Object.assign(descriptor.create(), { rules, worldDefinitions: p })
    },
    h = forage([], [override]),
    a = ally(h),
    i = grant(h),
    g = h.game(),
    c = read(h),
    data = {
      module: 'fgfixture',
      action: 'feed',
      payload: {
        targetId: a.id,
        targetRevision: c.feedTargets[0]!.targetRevision,
        itemId: i.id,
        inventoryStamp: c.inventoryStamp
      }
    };
  expect(confirmationSatiety(g, p.edibleItems![0]!)).toBe(80);
  expect(prepareEdibleCommand(g, data).confirm).toBe(true);
  markKnowledge(g, 'fgfixture', 'fgfixture.raw', 'known');
  expect(confirmationSatiety(g, p.edibleItems![0]!)).toBe(20);
  expect(prepareEdibleCommand(g, data).confirm).toBe(false);
});
