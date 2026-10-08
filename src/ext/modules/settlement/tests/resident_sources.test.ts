import { afterEach, expect, it, vi } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import legacyRoute from './resident-candidate-prefix.json';
import { writeFileSync } from 'node:fs';
import * as blink from '../../../../engine/Combat/MonsterBlink';
import { setup, current, travelScenes, stairs } from './helpers';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsterData from '../../../../data/monsters.json';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { candidateSource } from '../../../../engine/Core/ResidentWorld';
import { getBoltForItem } from '../../../../engine/Combat/Bolt';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { logger } from '../../../../engine/Systems/Logger';
import { timeSystem } from '../../../../engine/Systems/Time';
import { prepareResidentCommand } from '../../../../engine/Core/ResidentProduction';
import { bedroom } from './residentHelpers';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';
import type { Game } from '../../../../engine/Core/Game';
import type { ResidentSource } from '../../../residentSdk';
afterEach(() => vi.restoreAllMocks());

function recruitPayload(g: Game, id: number) {
  const c = current(g);
  return {
    v: 1,
    stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
    campId: c.regionId,
    campRevision: c.revision,
    targetId: id,
    targetRevision: 0
  };
}
it('trusted new-game entry creates one real friendly single actor and persistent finite source', () => {
  const { g } = setup();
  const s = g.extensionRuntime!.worldCampState('settlement').spawnSlots;
  expect(s).toHaveLength(1);
  expect(s[0]).toMatchObject({ depth: 1, attempts: 1, status: 'placed' });
  const a = g.departureActors().find((a) => a.id === s[0]!.actorId)!;
  expect(a).toMatchObject({
    isAlly: true,
    doesNotTrackLeader: true,
    leader: null,
    boundToLeader: false
  });
  expect(a.spatial).toBeUndefined();
  expect(
    g.extensionRuntime!.residentComponent<ResidentSource>('settlement', a.id, 'source')
  ).toMatchObject({ key: 'settlement.spawn.1', consumed: false });
});
it('real recruitment retains actor identity; No/stale are pure and publication faults restore identity', () => {
  const { h, g } = setup();
  bedroom(h, g);
  const a = g.departureActors().find((a) => a.typeId === 'settlement.wayfarer')!;
  a.loc = { x: 20, y: 13 };
  g.refreshStructureDerivedState();
  a.ticksUntilTurn = 0;
  a.hp = a.maxHp - 3;
  const p = recruitPayload(g, a.id);
  expect(
    prepareResidentCommand(g, { module: 'settlement', action: 'recruit', payload: p })
  ).toMatchObject({ ok: true });
  const world = structuredClone(g.world5),
    random = rng.getState(),
    id = getNextEntityId();
  expect(h.ext('settlement', 'recruit', p, [false])).toEqual({ recorded: true, error: null });
  expect(g.world5).toEqual(world);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(id);
  expect(h.ext('settlement', 'recruit', { ...p, targetRevision: 1 }).error).toBe('C5_STALE');
  expect(g.world5).toEqual(world);
  const replace = g.extensionRuntime!.replaceResidentComponent.bind(g.extensionRuntime!);
  const fault = vi
    .spyOn(g.extensionRuntime!, 'replaceResidentComponent')
    .mockImplementation((...args) => {
      replace(...args);
      if (args[2] === 'resident') throw Error('publication fault');
    });
  expect(h.ext('settlement', 'recruit', p).error).toBe('C5_TRANSACTION');
  expect(g.world5).toEqual(world);
  expect(g.monsters.find((m) => m.id === a.id)).toBe(a);
  expect(a.hp).toBe(a.maxHp - 3);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(id);
  fault.mockRestore();
  const tick = g.world5!.simulationTicks;
  expect(h.ext('settlement', 'recruit', p).error).toBeNull();
  expect(g.world5!.simulationTicks - tick).toBe(100);
  expect(g.monsters.find((m) => m.id === a.id)).toBe(a);
  expect(a.hp).toBe(a.maxHp - 3);
  expect(g.world5!.residents[0]?.actorId).toBe(a.id);
  expect(
    g.extensionRuntime!.queryOptional('settlement.resident-status.v1', { actorId: a.id })
  ).toEqual({ status: 'available', value: { resident: true } });
  expect(worldWorkLastError(g)).toBeNull();
});

// Controlled native actors are explicit scene inputs. Rescue/recruit use the
// actual public movement/item entries; these cases are not natural-route proof.
function captive(g: Game, type = 'goblin', x = 20, y = 13) {
  const actor = new Monster(x, y, (monsterData as MonsterData[]).find((m) => m.id === type)!);
  actor.isCaged = true;
  actor.ticksUntilTurn = 100000;
  g.monsters.push(actor);
  g.extensionRuntime!.attachCreature(actor);
  return actor;
}
it('A rescue: actual captive bump No/Yes and recruitment preserve the post-rescue actor and original dropped loot', () => {
  const { h, g } = setup();
  bedroom(h, g);
  const actor = captive(g),
    loot = ItemLoader.spawnFood('mango', actor.x, actor.y)!;
  actor.carriedItem = loot;
  actor.hp -= 2;
  actor.setStatusDuration('weakened', 500);
  const before = {
    world: structuredClone(g.world5),
    random: rng.getState(),
    id: getNextEntityId(),
    time: timeSystem.currentTick
  };
  g.onConfirmRequest = () => false;
  h.command('move', { x: 1, y: 0 });
  expect(actor.isCaged).toBe(true);
  expect(actor.carriedItem).toBe(loot);
  expect(candidateSource(g, actor.id)).toBeUndefined();
  expect({
    world: g.world5,
    random: rng.getState(),
    id: getNextEntityId(),
    time: timeSystem.currentTick
  }).toEqual(before);
  g.onConfirmRequest = () => true;
  try {
    h.command('move', { x: 1, y: 0 });
  } finally {
    g.onConfirmRequest = null;
  }
  expect(actor.isAlly).toBe(true);
  expect(actor.isCaged).toBe(false);
  expect(candidateSource(g, actor.id)?.source).toMatchObject({
    key: 'settlement.rescue.' + actor.id,
    consumed: false
  });
  expect(g.items.filter((i) => i.id === loot.id)).toEqual([loot]);
  expect(g.items.find((i) => i.id === loot.id)).toBe(loot);
  expect(actor.carriedItem).toBeNull();
  const hp = actor.hp,
    statuses = structuredClone(actor.statusDurations),
    payload = recruitPayload(g, actor.id);
  expect(h.ext('settlement', 'recruit', payload, [false]).error).toBeNull();
  expect(actor.hp).toBe(hp);
  expect(actor.statusDurations).toEqual(statuses);
  expect(h.ext('settlement', 'recruit', payload).error).toBeNull();
  expect(g.monsters.find((a) => a.id === actor.id)).toBe(actor);
  expect(actor.hp).toBe(hp);
  // Paid native time may decrement a status; recruitment never resets/heals it.
  expect(actor.getStatusDuration('weakened')).toBeGreaterThan(0);
  expect(g.items.filter((i) => i.id === loot.id)).toEqual([loot]);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});
it('A magic rescue: real teleport-wand use shares wasCaged registration and ordinary domination does not', () => {
  const { g } = setup(),
    actor = captive(g, 'goblin', 23, 12);
  const loot = ItemLoader.spawnFood('mango', actor.x, actor.y)!;
  actor.carriedItem = loot;
  const wand = ItemLoader.spawnWand('wand_of_teleportation', -1, -1)!;
  expect(getBoltForItem('wand_of_teleportation')).toBeDefined();
  expect(g.player.inventory.addItem(wand)).toBeTruthy();
  g.executeItemCommand('use', wand);
  expect(g.setArcanaTarget(actor.x, actor.y)).toBe(true);
  g.executeCommand('confirm_target');
  expect(actor.isCaged).toBe(false);
  expect(actor.isAlly).toBe(true);
  expect(candidateSource(g, actor.id)?.source.kind).toBe('rescue');
  expect(g.items.filter((i) => i.id === loot.id)).toEqual([loot]);
  const ordinary = captive(g, 'goblin', 24, 12);
  ordinary.isCaged = false;
  g.executeCommand('wait', undefined, () => g.becomeAllyWith(ordinary));
  expect(ordinary.isAlly).toBe(true);
  expect(candidateSource(g, ordinary.id)).toBeUndefined();
});
it.each(['monkey', 'rat'])(
  'A animal rescue: %s remains an ordinary ally without worker source',
  (type) => {
    const { g } = setup(),
      actor = captive(g, type, 21, 12);
    g.executeCommand('wait', undefined, () => g.freeCaptive(actor));
    expect(actor.isAlly).toBe(true);
    expect(candidateSource(g, actor.id)).toBeUndefined();
  }
);
it.each(['hostile', 'caged', 'lifespan', 'clone'] as const)(
  'A strict codec: unconsumed rescue source with %s actor is rejected before live retirement',
  (invalid) => {
    const { h, g } = setup(),
      actor = captive(g, 'goblin', 21, 12);
    g.executeCommand('wait', undefined, () => g.freeCaptive(actor));
    expect(candidateSource(g, actor.id)).toBeDefined();
    const snapshot = g.toSnapshot();
    const savedActors = [
      snapshot.monsters,
      snapshot.entityGraph.monsters,
      ...snapshot.levels.map((l) => l.monsters)
    ].flat();
    for (const saved of savedActors.filter((a) => a.id === actor.id)) {
      if (invalid === 'hostile') saved.isAlly = false;
      if (invalid === 'caged') saved.isCaged = true;
      if (invalid === 'clone') saved.isClone = true;
      if (invalid === 'lifespan') saved.statusDurations.lifespan_remaining = 100;
    }
    const audit = auditFullObjectGraph({ g, logger }),
      random = rng.getState(),
      id = getNextEntityId();
    expect(g.loadSnapshot(snapshot)).toBe(false);
    expect(audit.differences()).toEqual([]);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    const digest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(digest);
  }
);

it.each([false, true])(
  'A public command: getter envelopes are rejected without evaluation, pending=%s',
  (pending) => {
    const { h, g } = setup();
    bedroom(h, g);
    if (pending) {
      const snapshot = g.toSnapshot();
      snapshot.run.world5!.simulationTicks = 32000;
      for (const l of snapshot.run.world5!.offline) {
        l.lastSettledTick = 31999;
        l.epochRemainder = 999;
        l.frozen.capturedTick = 31999;
      }
      h.load(JSON.stringify(snapshot));
    }
    let getters = 0;
    const envelope = {
      get module() {
        getters++;
        return 'settlement';
      },
      action: 'recruit',
      payload: {}
    };
    const before = {
      world: structuredClone(g.world5),
      random: rng.getState(),
      id: getNextEntityId(),
      time: timeSystem.currentTick
    };
    try {
      g.executeCommand('ext:command', envelope);
    } catch (error) {
      expect((error as Error).message).toContain('C5_BUSY');
    }
    expect(getters).toBe(0);
    expect({
      world: g.world5,
      random: rng.getState(),
      id: getNextEntityId(),
      time: timeSystem.currentTick
    }).toEqual(before);
  }
);

it('A source budgets: 64 real rescued candidates, refused 65th, immediate terminal GC and bounded unique receipts', () => {
  const { h, g } = setup();
  const actors: Monster[] = [];
  for (let n = 0; n < 65; n++) {
    const a = captive(g, 'goblin', 40 + (n % 30), 3 + Math.floor(n / 30));
    actors.push(a);
    g.executeCommand('wait', undefined, () => g.freeCaptive(a));
  }
  expect(actors.slice(0, 64).every((a) => candidateSource(g, a.id)?.source.kind === 'rescue')).toBe(
    true
  );
  expect(actors[64]!.isAlly).toBe(true);
  expect(candidateSource(g, actors[64]!.id)).toBeUndefined();
  expect(g.world5!.residents).toHaveLength(0);
  const rescueReceipts = () =>
    g.world5!.receipts.filter((r) => r.identity.startsWith('settlement.rescue.'));
  expect(rescueReceipts()).toHaveLength(65);
  expect(
    rescueReceipts().find((r) => r.identity === 'settlement.rescue.' + actors[64]!.id)
  ).toMatchObject({ result: 'skipped', reason: 'source-budget' });
  const rejected = g.monsters.find((a) => a.id === actors[64]!.id)!;
  const tick = g.world5!.simulationTicks;
  g.executeCommand('wait', undefined, () => g.freeCaptive(rejected));
  expect(rescueReceipts()).toHaveLength(65);
  expect(g.world5!.simulationTicks).toBe(tick);
  for (const a of actors) g.executeCommand('wait', undefined, () => g.killMonster(a));
  h.command('wait');
  expect(actors.every((a) => candidateSource(g, a.id) === undefined)).toBe(true);
  const ids = [];
  for (let n = 0; n < 64; n++) {
    const a = captive(g, 'goblin', 40 + (n % 30), 3 + Math.floor(n / 30));
    ids.push(a.id);
    g.executeCommand('wait', undefined, () => g.freeCaptive(a));
  }
  expect(ids.every((id) => candidateSource(g, id)?.source.kind === 'rescue')).toBe(true);
  expect(g.world5!.receipts).toHaveLength(128);
  expect(new Set(rescueReceipts().map((r) => r.identity)).size).toBe(rescueReceipts().length);
  // The rolling presentation tail cannot erase the first live source authority.
  expect(candidateSource(g, ids[0]!)?.source.consumed).toBe(false);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});

it('an unregistered original spawn stays on its birth floor across real stairs rather than scheduling an ally escort', () => {
  travelScenes();
  const { h, g } = setup();
  const id = g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId!,
    a = g.monsters.find((m) => m.id === id)!;
  stairs(h, g, true);
  expect(g.depth).toBe(2);
  const at = { ...a.loc };
  for (let n = 0; n < 180; n++) h.command('wait');
  expect(g.levels.get(1)!.monsters).toContain(a);
  expect(g.monsters).not.toContain(a);
  expect(a.loc).toEqual(at);
  expect(a.entersLevelIn).toBe(0);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});

it('I36: a peaceful unconsumed spawn holds its controlled starting cell, yields only to real native danger, and ordinary allies keep native decisions', () => {
  const { h, g } = setup();
  const id = g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId!;
  const a = g.monsters.find((m) => m.id === id)!;
  a.loc = { x: 19, y: 11 };
  const birth = { ...a.loc };
  a.ticksUntilTurn = a.movementSpeed;
  const ordinary = captive(g, 'goblin', 27, 14);
  ordinary.isCaged = false;
  ordinary.isAlly = true;
  ordinary.doesNotTrackLeader = false;
  ordinary.ticksUntilTurn = 0;
  const prepare = vi.spyOn(a, 'prepareNativeDecision'),
    native = vi.spyOn(a, 'takeNativeDecision'),
    otherNative = vi.spyOn(ordinary, 'takeNativeDecision');
  for (let n = 0; n < 20; n++) {
    h.command('wait');
    expect(a.loc).toEqual(birth);
    expect(a.ticksUntilTurn).toBeGreaterThan(0);
  }
  expect(native).not.toHaveBeenCalled();
  expect(prepare).toHaveBeenCalledTimes(20);
  expect(otherNative.mock.calls.length).toBeGreaterThan(0);
  const at = [
    { x: a.x + 1, y: a.y },
    { x: a.x - 1, y: a.y },
    { x: a.x, y: a.y + 1 },
    { x: a.x, y: a.y - 1 }
  ].find((p) => !g.getMonsterAt(p.x, p.y) && (p.x !== g.player.x || p.y !== g.player.y))!;
  const enemy = captive(g, 'kobold', at.x, at.y);
  enemy.isCaged = false;
  enemy.ticksUntilTurn = 100000;
  const before = prepare.mock.calls.length;
  h.command('wait');
  expect(prepare.mock.calls.length).toBe(before + 1);
  expect(native).toHaveBeenCalledTimes(1);
  expect(candidateSource(g, a.id)?.source.consumed).toBe(false);
});

it('I36: normal seed28 fixed material prefix attributes candidate movement to the actual native danger selector', () => {
  vi.restoreAllMocks();
  const h = createWorldHarness({ seed: 28, mode: 'normal', modules: ['settlement'] }),
    g = worldHarnessGame(h);
  const a = g.monsters.find(
    (m) => m.id === g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId
  )!;
  const priority = a.hasNativeResidentPriority.bind(a),
    take = a.takeNativeDecision.bind(a);
  let last = false,
    selecting = false;
  let danger: unknown = null;
  const closest = blink.closestBlinkEnemy;
  vi.spyOn(blink, 'closestBlinkEnemy').mockImplementation((game, m) => {
    const target = closest(game, m);
    if (selecting && m === a)
      danger = target
        ? { id: target.id, type: target.typeId, at: { ...target.loc }, state: target.state }
        : null;
    return target;
  });
  const decisions: {
    tick: number;
    at: { x: number; y: number };
    priority: boolean;
    danger?: unknown;
    nativeMove?: { x: number; y: number };
  }[] = [];
  vi.spyOn(a, 'hasNativeResidentPriority').mockImplementation((game) => {
    selecting = true;
    danger = null;
    try {
      last = priority(game);
    } finally {
      selecting = false;
    }
    decisions.push({ tick: g.world5!.simulationTicks, at: { ...a.loc }, priority: last, danger });
    return last;
  });
  vi.spyOn(a, 'takeNativeDecision').mockImplementation((game) => {
    const before = { ...a.loc };
    take(game);
    if (a.x !== before.x || a.y !== before.y) {
      expect(last).toBe(true);
      decisions[decisions.length - 1]!.nativeMove = { ...a.loc };
    }
  });
  const birth = { ...a.loc };
  try {
    outer: for (const step of legacyRoute.steps)
      for (let n = 0; n < step.count; n++) {
        if (g.recordedInputEvents.length === 141) break outer;

        const answers = [...step.decisions];
        g.onConfirmRequest = () => answers.shift() ?? true;
        h.command(step.action, step.data);
        while (g.pendingCommandConfirmation)
          g.resolveCommandDecision(g.pendingCommandConfirmation.token, answers.shift() ?? true);
        expect(g.isGameOver).toBe(false);
        if (step.action === 'ext:command') expect(worldWorkLastError(g)).toBeNull();
      }
    expect(g.recordedInputEvents).toHaveLength(141);
    expect(decisions.some((d) => !d.priority)).toBe(true);
    if (process.env.RESIDENT_POLICY_AUDIT)
      writeFileSync(
        process.env.RESIDENT_POLICY_AUDIT,
        JSON.stringify({ birth, end: { ...a.loc }, tick: g.world5!.simulationTicks, decisions })
      );
  } finally {
    h.dispose();
  }
});
