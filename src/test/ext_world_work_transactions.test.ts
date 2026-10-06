import { afterEach, describe, expect, it, vi } from 'vitest';
import { workGame } from './support/worldWorkFixture';
import { readWorkContext, materializedNode, containerRead } from '../engine/Core/WorldWorkWorld';
import {
  prepareWorldWorkCommand,
  commitWorldWork,
  withWorldActorScope,
  transactWorldWork,
  worldWorkLastError,
  prepareTrustedWorldWork,
  cancelWorldWork
} from '../engine/Core/WorldWork';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { getNextEntityId } from '../entities/Creature';
import { timeSystem } from '../engine/Systems/Time';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { inventoryStamp } from '../engine/Core/RecordingDigest';
import { setOwnedRegions } from '../ext/world';
import * as sdkExports from '../ext/worldSdk';
import type { Game } from '../engine/Core/Game';
const read = (g: Game) => {
  const r = readWorkContext(g, 'craftskel', { kind: 'inventory' });
  if (!r.ok) throw new Error(r.code);
  return r.value;
};
const payload = (g: Game, count = 2) => {
  const r = read(g),
    s = r.stations.find((s) => s.workPositions.some((p) => p.x === r.at.x && p.y === r.at.y))!;
  return {
    v: 1,
    recipeId: 'craftskel.dagger-recipe',
    batchCount: count,
    stationId: s.interactableId,
    stationRevision: s.revision,
    sourceContainerId: null,
    sourceRevision: null,
    inventoryStamp: r.inventoryStamp
  };
};
const ext = (g: Game, action: string, p: any) => {
  g.executeCommand('ext:command', JSON.stringify({ module: 'craftskel', action, payload: p }));
  while (g.pendingCommandConfirmation)
    g.resolveCommandDecision(g.pendingCommandConfirmation.token, true);
};
const mechanical = (g: Game) => ({
  w: structuredClone(g.world5),
  root: structuredClone(g.actorActions),
  ids: getNextEntityId(),
  rng: rng.getState(),
  tick: timeSystem.currentTick,
  log: logger.getState(),
  state: g.extensionRuntime!.snapshot(),
  items: g.player.inventory.items.map((i) => ({ id: i.id, q: i.quantity, world: i.worldItem }))
});
afterEach(() => vi.restoreAllMocks());
describe('C5 scoped transactions and real clocks', () => {
  it('SDK runtime exposes only constants and layer helpers', () => {
    expect(Object.keys(sdkExports).sort()).toEqual([
      'C5_CONTRACT_VERSION',
      'WORLD_SDK_VERSION',
      'compareLevelRefs',
      'levelKey'
    ]);
  });
  it('prepare is detached, deeply frozen and virtual regen is pure', () => {
    const g = workGame(),
      before = mechanical(g),
      p = prepareWorldWorkCommand(
        g,
        JSON.stringify({ module: 'craftskel', action: 'craft', payload: payload(g) })
      );
    expect(p.outcome.ok).toBe(true);
    expect(mechanical(g)).toEqual(before);
    if (p.outcome.ok) expect(Object.isFrozen(p.outcome.value.casKeys)).toBe(true);
    const dto = read(g);
    expect(Object.isFrozen(dto)).toBe(true);
    expect(Object.isFrozen(dto.inventory[0])).toBe(true);
  });
  it.each([0, 1, 999, 1000, 2000, 5000])(
    'integer regeneration at %i ticks without revision writes',
    (tick) => {
      const g = workGame(),
        n = g.world5!.nodes[0]!;
      n.remaining = 2;
      n.lastSettledTick = 0;
      g.world5!.simulationTicks = tick;
      const old = structuredClone(n),
        next = materializedNode(g, n);
      expect(n).toEqual(old);
      expect(next.remaining).toBe(Math.min(n.capacity, 2 + Math.floor(tick / 1000)));
      expect(next.regenRemainder).toBe(next.remaining === n.capacity ? 0 : tick % 1000);
      expect(next.revision).toBe(old.revision);
    }
  );
  it('bad CAS rejects before any root, RNG, ID, message or plan allocation', () => {
    const g = workGame(),
      p = payload(g);
    p.stationRevision++;
    const before = mechanical(g);
    ext(g, 'craft', p);
    expect(worldWorkLastError(g)).toBe('C5_STALE');
    expect(mechanical(g)).toEqual(before);
  });
  it('expired/counterfeit scope and handle are rejected', () => {
    const g = workGame(),
      p = prepareWorldWorkCommand(
        g,
        JSON.stringify({ module: 'craftskel', action: 'craft', payload: payload(g) })
      );
    expect(p.outcome.ok).toBe(true);
    if (!p.outcome.ok) return;
    let scope: any;
    withWorldActorScope(g, 'craftskel', g.player.id, 'trusted-world', (s) => {
      scope = s;
    });
    const before = mechanical(g);
    expect(commitWorldWork(g, p.outcome.value, scope)).toEqual({
      ok: false,
      code: 'C5_SCOPE',
      field: null
    });
    expect(commitWorldWork(g, p.outcome.value, {} as any).ok).toBe(false);
    expect(mechanical(g)).toEqual(before);
  });
  it('one handle is consumed once, across owners and neutral IDs', () => {
    const g = workGame(),
      p = prepareWorldWorkCommand(
        g,
        JSON.stringify({ module: 'craftskel', action: 'craft', payload: payload(g) })
      );
    if (!p.outcome.ok) throw new Error(p.outcome.code);
    const handle = p.outcome.value;
    withWorldActorScope(g, 'craftskel', g.player.id, 'trusted-world', (s) => {
      expect(commitWorldWork(g, handle, s).ok).toBe(true);
      expect(commitWorldWork(g, handle, s)).toEqual({
        ok: false,
        code: 'C5_PLAN_USED',
        field: null
      });
    });
    expect(g.actorActions!.bundles[0]!.owner).toBe('foundation');
    expect(g.actorActions!.nextActionId).toBe(2);
  });
  it('accept participant exception rolls back live identities and allocators', () => {
    let reject = false;
    const g = workGame({
        participant: (f, c) => {
          c.replaceState({ history: [f] as any });
          if (reject) throw new Error('injected');
        }
      }),
      p = prepareWorldWorkCommand(
        g,
        JSON.stringify({ module: 'craftskel', action: 'craft', payload: payload(g) })
      );
    if (!p.outcome.ok) throw new Error(p.outcome.code);
    const handle = p.outcome.value;
    const roots = {
        player: g.player,
        world: g.world5,
        actions: g.actorActions,
        containers: g.worldContainerItems,
        details: g.worldWorkDetails,
        facts: g.worldWorkFacts,
        grid: g.grid,
        items: g.items
      },
      audit = auditFullObjectGraph(roots),
      before = mechanical(g);
    reject = true;
    withWorldActorScope(g, 'craftskel', g.player.id, 'trusted-world', (s) =>
      expect(commitWorldWork(g, handle, s)).toEqual({ ok: false, code: 'C5_PROVIDER', field: null })
    );
    expect(audit.differences()).toEqual([]);
    expect(mechanical(g)).toEqual(before);
  });
  it.each(['exception', 'promise'])(
    'batch participant %s cancels without output or tool charge',
    (failure) => {
      let enabled = false;
      const g = workGame({
        participant: (f, c) => {
          if (enabled && f.ticketId !== null && f.completedBatches === 1) {
            if (failure === 'promise') return Promise.resolve();
            throw new Error('injected');
          }
          c.replaceState({ history: [f] as any });
        }
      });
      enabled = true;
      g.onConfirmRequest = () => true;
      const tool = g.player.inventory.items.find(
        (i) => i.worldItem?.toolDurability !== null && i.worldItem
      )!;
      const original = tool.worldItem!.toolDurability;
      ext(g, 'craft', payload(g));
      expect(g.world5!.terminalTickets[0]!.status).toBe('cancelled');
      expect(g.world5!.terminalTickets[0]!.stopReason).toBe('provider');
      expect(tool.worldItem!.toolDurability).toBe(original);
      expect(g.actorActions!.bundles).toHaveLength(0);
      expect(
        g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.fiber')!
          .quantity
      ).toBe(20);
    }
  );
  it('every publication rolls back the complete independent object graph', () => {
    const g = workGame(),
      roots = {
        player: g.player,
        world: g.world5,
        actions: g.actorActions,
        containers: g.worldContainerItems,
        details: g.worldWorkDetails,
        facts: g.worldWorkFacts,
        grid: g.grid,
        items: g.items
      };
    for (const point of [
      'id',
      'input',
      'escrow',
      'output',
      'durability',
      'fact',
      'message',
      'budget'
    ]) {
      const audit = auditFullObjectGraph(roots),
        before = mechanical(g);
      expect(() =>
        transactWorldWork(g, () => {
          g.world5!.nextWorldId++;
          g.player.inventory.items[0]!.quantity++;
          g.worldContainerItems!.set(999, g.player.inventory.items[0]!);
          g.world5!.tickets.push({ ticketId: 999 } as any);
          g.actorActions!.nextActionId++;
          g.worldWorkFacts!.push({ factId: 999 } as any);
          logger.log('injection');
          rng.randRange(0, 100);
          throw new Error(point);
        })
      ).toThrow(point);
      expect(audit.differences(), point).toEqual([]);
      expect(mechanical(g), point).toEqual(before);
    }
  });
  it('NPC fixture starts one batch at one real native free decision', () => {
    const g = workGame(),
      node = g.world5!.nodes[0]!,
      chest = g.world5!.containers.find((c) => c.kind === 'chest')!,
      at = { ...g.player.loc };
    g.player.loc = { x: at.x + 2, y: at.y + 2 };
    const m = new Monster(at.x, at.y, monsters.find((m) => m.id === 'rat') as MonsterData);
    m.isAlly = true;
    m.state = MonsterState.WANDERING;
    m.ticksUntilTurn = 0;
    g.monsters.push(m);
    const p = prepareTrustedWorldWork(g, 'craftskel', m.id, {
      kind: 'harvest',
      nodeId: node.interactableId,
      nodeRevision: node.revision,
      destinationId: chest.id,
      destinationRevision: chest.revision,
      inventoryStamp: inventoryStamp([])
    });
    if (!p.ok) throw new Error(p.code);
    withWorldActorScope(g, 'craftskel', m.id, 'trusted-world', (s) =>
      expect(commitWorldWork(g, p.value, s).ok).toBe(true)
    );
    expect(g.actorActions!.bundles).toHaveLength(0);
    const before = g.actorActions!.nextActionId;
    g.executeCommand('wait');
    expect(g.actorActions!.nextActionId).toBe(before + 1);
    expect(g.world5!.terminalTickets[0]!.completedBatches).toBe(1);
    expect(containerRead(g, chest.id).items[0]!.quantity).toBe(2);
  });
  it('regions helper deletes an empty key and survives a real round trip', () => {
    const g = workGame();
    setOwnedRegions((g.extensionRuntime as any).world, []);
    expect(g.extensionRuntime!.snapshot().foundation.world).not.toHaveProperty('regions');
    expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
  });
  it('retiring a live NPC work bundle publishes cancellation and releases its reservation once', () => {
    const g = workGame({ pack: (p) => (p.resourceNodes[0].harvestTicks = 300) }),
      node = g.world5!.nodes[0]!,
      chest = g.world5!.containers.find((c) => c.kind === 'chest')!,
      at = { ...g.player.loc };
    g.monsters = [];
    g.dormantMonsters = [];
    g.player.loc = { x: at.x + 2, y: at.y + 2 };
    const m = new Monster(at.x, at.y, monsters.find((m) => m.id === 'rat') as MonsterData);
    m.isAlly = true;
    m.state = MonsterState.WANDERING;
    m.ticksUntilTurn = 0;
    g.monsters.push(m);
    const p = prepareTrustedWorldWork(g, 'craftskel', m.id, {
      kind: 'harvest',
      nodeId: node.interactableId,
      nodeRevision: node.revision,
      destinationId: chest.id,
      destinationRevision: chest.revision,
      inventoryStamp: inventoryStamp([])
    });
    if (!p.ok) throw new Error(p.code);
    withWorldActorScope(g, 'craftskel', m.id, 'trusted-world', (s) =>
      expect(commitWorldWork(g, p.value, s).ok).toBe(true)
    );
    g.executeCommand('wait');
    const t = g.world5!.tickets[0]!;
    expect(t.remainingTicks).toBe(200);
    expect(t.bundleActionId).not.toBeNull();
    cancelWorldWork(g, t.ticketId, 'damage');
    cancelWorldWork(g, t.ticketId, 'damage');
    expect(
      g.worldWorkFacts!.filter((f) => f.ticketId === t.ticketId && f.operation === 'cancel')
    ).toHaveLength(1);
    expect(g.world5!.receipts.filter((r) => r.identity === `cancel.${t.ticketId}`)).toHaveLength(1);
    expect(t.status).toBe('cancelled');
    expect(t.lastCompletionOrdinal).toBe(1);
    expect(node.reservedUnits).toBe(0);
    expect(node.remaining).toBe(node.capacity);
    expect(t.bundleActionId).toBeNull();
    expect(g.actorActions!.bundles).toHaveLength(0);
    expect(containerRead(g, chest.id).items).toHaveLength(0);
    expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
  });
});

it('combat bonfire and foundation crafting share one clock, reject each other while busy, and keep separate receipts', async () => {
  const { prepareWorldRest, commitWorldRest, settleWorldRest, worldRestUnavailable } =
    await import('../engine/Core/WorldRestProduction');
  const { productionActorActionScheduler } = await import('../engine/Core/ActorActionProduction');
  const { settleWorldWork } = await import('../engine/Core/WorldWork');
  const { nearbyCells, clearWorldCell, workPositions, distance } =
    await import('../engine/Core/WorldWorkWorld');
  const g = workGame({ modules: ['combat'] });
  g.monsters = [];
  g.dormantMonsters = [];
  const world = (g.extensionRuntime as any).world,
    bonfire = world.entities.find((e: any) => e.owner === 'combat');
  expect(bonfire).toBeDefined();
  g.player.loc = { x: bonfire.x, y: bonfire.y };
  const station = g.world5!.stations[0]!,
    at = nearbyCells(g).find(
      (p) =>
        distance(p, g.player.loc) === 1 &&
        clearWorldCell(g, p) &&
        workPositions(g, p).some((w) => w.x === g.player.x && w.y === g.player.y)
    )!;
  expect(at).toBeDefined();
  Object.assign(
    world.entities.find((e: any) => e.id === station.interactableId),
    at
  );
  const prepared = prepareWorldWorkCommand(
    g,
    JSON.stringify({ module: 'craftskel', action: 'craft', payload: payload(g, 1) })
  );
  if (!prepared.outcome.ok) throw new Error(prepared.outcome.code);
  const handle = prepared.outcome.value;
  withWorldActorScope(g, 'craftskel', g.player.id, 'trusted-world', (s) =>
    expect(commitWorldWork(g, handle, s).ok).toBe(true)
  );
  expect(g.actorActions!.bundles[0]!.owner).toBe('foundation');
  expect(worldRestUnavailable(g, bonfire.id)).toBe('busy');
  const scheduler = productionActorActionScheduler(g)!;
  scheduler.advanceActionTime(100);
  scheduler.dispatchActorBoundary(g.player.id);
  settleWorldWork(g);
  expect(g.world5!.terminalTickets[0]!.status).toBe('completed');
  const plan = prepareWorldRest(
    g,
    JSON.stringify({ module: 'combat', action: 'rest', payload: { bonfireId: bonfire.id } })
  );
  expect(plan).not.toBeNull();
  expect(commitWorldRest(g, plan!)).toBe(true);
  expect(g.actorActions!.bundles[0]!.owner).toBe('combat');
  const before = mechanical(g);
  expect(
    prepareWorldWorkCommand(
      g,
      JSON.stringify({ module: 'craftskel', action: 'craft', payload: payload(g, 1) })
    ).outcome
  ).toMatchObject({ ok: false, code: 'C5_BUSY' });
  expect(mechanical(g)).toEqual(before);
  scheduler.advanceActionTime(plan!.restTicks);
  scheduler.dispatchActorBoundary(g.player.id);
  settleWorldRest(g);
  expect(g.actorActions).toEqual({ schema: 1, nextActionId: 3, bundles: [] });
  const restReceipts = g.extensionRuntime!.actorActionBinding()!.state.bonfires!.receipts;
  expect(restReceipts[restReceipts.length - 1]!.result).toBe('completed');
  expect(g.world5!.receipts.filter((r) => r.kind === 'work')).toHaveLength(1);
  expect(g.world5!.receipts.filter((r) => r.kind === 'work')[0]!.result).toBe('completed');
  expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
});

it('a real NPC batch survives mid-bundle save/load, replay, seek and continued recording', async () => {
  const { installRecordingScene } = await import('./support/recordingV4');
  const { nearbyCells, stableGround, distance } = await import('../engine/Core/WorldWorkWorld');
  installRecordingScene((g) => {
    if (!g.extensionRuntime?.isWorldWorkFixture('craftskel')) return;
    g.monsters = [];
    g.dormantMonsters = [];
    const at = { ...g.player.loc },
      away = nearbyCells(g).find((p) => distance(p, at) > 1 && stableGround(g, p))!;
    g.player.loc = { ...away };
    const m = new Monster(at.x, at.y, monsters.find((m) => m.id === 'rat') as MonsterData);
    m.isAlly = true;
    m.state = MonsterState.WANDERING;
    m.ticksUntilTurn = 0;
    g.monsters.push(m);
    const n = g.world5!.nodes[0]!,
      c = g.world5!.containers.find((c) => c.kind === 'chest')!;
    const p = prepareTrustedWorldWork(g, 'craftskel', m.id, {
      kind: 'harvest',
      nodeId: n.interactableId,
      nodeRevision: n.revision,
      destinationId: c.id,
      destinationRevision: c.revision,
      inventoryStamp: inventoryStamp([])
    });
    if (!p.ok) throw new Error(p.code);
    withWorldActorScope(g, 'craftskel', m.id, 'trusted-world', (s) => {
      const r = commitWorldWork(g, p.value, s);
      if (!r.ok) throw new Error(r.code);
    });
  });
  const g = workGame({ pack: (p) => (p.resourceNodes[0].harvestTicks = 300) });
  g.executeCommand('wait');
  const t = g.world5!.tickets[0]!;
  expect(t.status).toBe('working');
  expect(t.bundleActionId).not.toBeNull();
  expect(t.remainingTicks).toBe(200);
  const actionId = t.bundleActionId,
    save = g.toSaveSnapshot();
  expect(g.loadSnapshot(save)).toBe(true);
  expect(g.world5!.tickets[0]!.bundleActionId).toBe(actionId);
  expect(g.world5!.tickets[0]!.remainingTicks).toBe(200);
  g.executeCommand('wait');
  g.executeCommand('wait');
  expect(g.world5!.terminalTickets[0]!.status).toBe('completed');
  expect(g.actorActions!.nextActionId).toBe(2);
  const recording = g.exportRecording();
  expect(g.loadReplay(recording)).toBe(true);
  while (g.replayCursor < g.replayEvents.length && !g.replayError) g.replayStep(true);
  expect(g.replayError).toBeNull();
  g.replaySeek(1);
  expect(g.replayError).toBeNull();
  expect(g.world5!.tickets[0]!.remainingTicks).toBe(200);
  expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
  g.executeCommand('wait');
  g.executeCommand('wait');
  expect(g.exportRecording().events).toEqual(recording.events);
}, 60000);
