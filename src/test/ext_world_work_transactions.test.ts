import { afterEach, describe, expect, it, vi } from 'vitest';
import { workGame } from './support/worldWorkFixture';
import { readWorkContext, materializedNode, containerRead, nearbyCells, stableGround, distance } from '../engine/Core/WorldWorkWorld';
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
import { hasInteractionLine } from '../ext/worldSpatial';
import { productionActorActionScheduler, createProductionActorActionSession } from '../engine/Core/ActorActionProduction';
import { bindPhasedAttackProduction, preparePhasedAttackCommand, commitPhasedAttackCommand } from '../engine/Core/PhasedAttackProduction';
import { isProductionActorActionRunInvalid, selectNativeActorAction } from '../engine/Core/ActorActionSession';
import { validateProductionActorAttackState } from '../ext/actorActionValidation';
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
  it.each([{modules: []}, {modules: ['combat']}])('starts NPC work before a later same-tick due work owner (modules=$modules)', ({modules}) => {
    const g = workGame({ modules }), node = g.world5!.nodes[0]!,
      chest = g.world5!.containers.find(c => c.kind === 'chest')!, chestAt = containerRead(g, chest.id).at!;
    g.monsters = []; g.dormantMonsters = [];
    const positions = nearbyCells(g).filter(at => stableGround(g, at)
      && distance(at, node.at) <= 1 && distance(at, chestAt) <= 1
      && hasInteractionLine(g.grid, at, node.at) && hasInteractionLine(g.grid, at, chestAt));
    expect(positions.length).toBeGreaterThanOrEqual(2);
    g.player.loc = { ...nearbyCells(g).find(at => stableGround(g, at) && distance(at, positions[0]!) > 2)! };
    const workers = positions.slice(0, 2).map(at => {
      const m = new Monster(at.x, at.y, monsters.find(m => m.id === 'rat') as MonsterData);
      m.isAlly = true; m.state = MonsterState.WANDERING; m.ticksUntilTurn = 0;
      g.monsters.push(m); g.extensionRuntime!.attachCreature(m); return m;
    });
    for (const m of workers) {
      const plan = prepareTrustedWorldWork(g, 'craftskel', m.id, {
        kind: 'harvest', nodeId: node.interactableId, nodeRevision: node.revision,
        destinationId: chest.id, destinationRevision: chest.revision, inventoryStamp: inventoryStamp([])
      });
      if (!plan.ok) throw new Error(plan.code);
      withWorldActorScope(g, 'craftskel', m.id, 'trusted-world', scope =>
        expect(commitWorldWork(g, plan.value, scope).ok).toBe(true));
    }
    const [earlier, later] = workers as [Monster, Monster];
    expect(earlier.id).toBeLessThan(later.id);
    expect(selectNativeActorAction(g, later.id)).toBe('handled');
    const scheduler = productionActorActionScheduler(g)!, due = g.actorActions!.bundles[0]!;
    expect(due.owner).toBe('foundation');
    expect(due.subactions[0]!.phaseRemainingTicks).toBe(100);
    earlier.ticksUntilTurn = 100;
    const commit = scheduler.commitBundle.bind(scheduler), sweep = vi.spyOn(g, 'finishActorActionSweep');
    const onCommit = vi.spyOn(scheduler, 'commitBundle').mockImplementation(bundle => {
      expect(bundle.decisionOwnerId).toBe(earlier.id);
      expect(due.subactions[0]!.phaseRemainingTicks).toBe(0);
      expect(later.ticksUntilTurn).toBe(0);
      const before = structuredClone(due), root = structuredClone(g.actorActions), random = rng.getState(), tick = timeSystem.currentTick;
      expect(() => bindPhasedAttackProduction(g)).not.toThrow();
      expect(productionActorActionScheduler(g)).toBe(scheduler);
      expect(g.actorActions).toEqual(root);
      expect(() => scheduler.snapshot()).toThrow('inconsistent phase clock');
      expect(() => createProductionActorActionSession(g, {
        state: g.actorActions!, resolveSegment: () => {}, breakRecoveryTicks: () => 0
      })).toThrow('inconsistent phase clock');
      commit(bundle);
      expect(due).toEqual(before); expect(later.ticksUntilTurn).toBe(0);
      expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
    });
    const turn = g.absoluteTurnNumber, tick = timeSystem.currentTick;
    expect(() => g.executeCommand('wait')).not.toThrow();
    expect(g.absoluteTurnNumber).toBe(turn + 1); expect(timeSystem.currentTick).toBe(tick + 100);
    expect(onCommit).toHaveBeenCalledTimes(1); onCommit.mockRestore();
    expect(isProductionActorActionRunInvalid(g)).toBe(false); expect(sweep).not.toHaveBeenCalled();
    expect(g.world5!.terminalTickets.map(t => [t.actorId, t.completedBatches, t.status, t.stopReason])).toEqual([[later.id, 1, 'completed', null]]);
    expect(g.actorActions!.bundles.map(b => [b.decisionOwnerId, b.subactions[0]!.phaseRemainingTicks])).toEqual([[earlier.id, 100]]);
    expect(containerRead(g, chest.id).items[0]!.quantity).toBe(2);
    expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
    g.executeCommand('wait');
    expect(g.actorActions!.bundles).toEqual([]); expect(g.actorActions!.nextActionId).toBe(3);
    expect(g.world5!.terminalTickets.map(t => [t.actorId, t.completedBatches, t.status])).toEqual([
      [later.id, 1, 'completed'], [earlier.id, 1, 'completed']
    ]);
    expect(g.world5!.receipts.filter(r => r.kind === 'work')).toHaveLength(2);
    expect(containerRead(g, chest.id).items[0]!.quantity).toBe(4); expect(sweep).not.toHaveBeenCalled();
    expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
  });
  it.each([0, 1, 2])('commits world work while combat phase %i is due without rebinding its live clock', phaseIndex => {
    const g = workGame({ modules: ['combat'] }), at = { ...g.player.loc },
      node = g.world5!.nodes[0]!, chest = g.world5!.containers.find(c => c.kind === 'chest')!;
    g.monsters = []; g.dormantMonsters = [];
    g.player.loc = { ...nearbyCells(g).find(p => stableGround(g, p) && distance(p, at) > 2)! };
    g.player.ticksUntilTurn = 0;
    const worker = new Monster(at.x, at.y, monsters.find(m => m.id === 'rat') as MonsterData);
    worker.isAlly = true; worker.state = MonsterState.WANDERING; worker.ticksUntilTurn = 0;
    g.monsters.push(worker); g.extensionRuntime!.attachCreature(worker);
    const work = prepareTrustedWorldWork(g, 'craftskel', worker.id, {
      kind: 'harvest', nodeId: node.interactableId, nodeRevision: node.revision,
      destinationId: chest.id, destinationRevision: chest.revision, inventoryStamp: inventoryStamp([])
    });
    if (!work.ok) throw new Error(work.code);
    withWorldActorScope(g, 'craftskel', worker.id, 'trusted-world', scope =>
      expect(commitWorldWork(g, work.value, scope).ok).toBe(true));
    const attack = preparePhasedAttackCommand(g, JSON.stringify({
      module: 'combat', action: 'attack', payload: { attackId: 'fixture.double-thrust', facing: 'e' }
    }));
    expect(attack).not.toBeNull(); expect(commitPhasedAttackCommand(g, attack!)).toBe(true);
    const scheduler = productionActorActionScheduler(g)!;
    for (let index = 0; index < phaseIndex; index++) {
      scheduler.advanceActionTime(scheduler.nextActionBoundary()!); scheduler.dispatchActorBoundary(g.player.id);
    }
    scheduler.advanceActionTime(scheduler.nextActionBoundary()!);
    const due = g.actorActions!.bundles[0]!, before = structuredClone(due), random = rng.getState(), tick = timeSystem.currentTick,
      binding = g.extensionRuntime!.actorActionBinding()!;
    expect(due.subactions[0]!.phaseRemainingTicks).toBe(0);
    expect(() => validateProductionActorAttackState(binding.state, binding.definition, new Set(), g.actorActions!)).toThrow('inconsistent phase clock');
    expect(() => g.toSaveSnapshot()).toThrow('inconsistent phase clock');
    expect(() => bindPhasedAttackProduction(g)).not.toThrow();
    expect(selectNativeActorAction(g, worker.id)).toBe('handled');
    expect(() => bindPhasedAttackProduction(g)).not.toThrow();
    expect(productionActorActionScheduler(g)).toBe(scheduler);
    expect(due).toEqual(before); expect(g.player.ticksUntilTurn).toBe(0);
    expect(g.actorActions!.bundles[1]).toMatchObject({ owner: 'foundation', decisionOwnerId: worker.id, elapsedActionTicks: 0 });
    expect(worker.ticksUntilTurn).toBe(100); expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
    expect(scheduler.dispatchActorBoundary(g.player.id)).toBe(phaseIndex === 2 ? 'native-fallback' : 'handled');
    const saved = g.toSaveSnapshot(); expect(g.loadSnapshot(saved)).toBe(true);
    expect(g.actorActions).toEqual(saved.run.actorActions);
    const loaded = productionActorActionScheduler(g)!;
    while (loaded.nextActionBoundary() !== null) {
      loaded.advanceActionTime(loaded.nextActionBoundary()!);
      for (const bundle of [...g.actorActions!.bundles]) loaded.dispatchActorBoundary(bundle.decisionOwnerId);
    }
    expect(g.actorActions!.bundles).toEqual([]); expect(g.actorActions!.nextActionId).toBe(3);
    expect(g.world5!.terminalTickets[0]).toMatchObject({ actorId: worker.id, completedBatches: 1, status: 'completed' });
    expect(g.world5!.nodes.find(n => n.interactableId === node.interactableId)!.reservedUnits).toBe(0);
    expect(g.world5!.receipts.filter(r => r.kind === 'work')).toHaveLength(1);
    expect(containerRead(g, chest.id).items[0]!.quantity).toBe(2);
    expect(isProductionActorActionRunInvalid(g)).toBe(false); expect(g.loadSnapshot(g.toSaveSnapshot())).toBe(true);
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
