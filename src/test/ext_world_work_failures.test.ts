import { afterEach, describe, expect, it, vi } from 'vitest';
import { workGame } from './support/worldWorkFixture';
import { readWorkContext, allocateWorldId } from '../engine/Core/WorldWorkWorld';
import * as publication from '../engine/Core/WorldWorkWorld';
import * as items from '../engine/Items/WorldItems';
import { Inventory } from '../engine/Items/Inventory';
import {
  prepareWorldWorkCommand,
  commitWorldWork,
  withWorldActorScope,
  settleWorldWork,
  cancelWorldWork
} from '../engine/Core/WorldWork';
import { getNextEntityId } from '../entities/Creature';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { logger } from '../engine/Systems/Logger';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
const request = (g: ReturnType<typeof workGame>, batchCount = 2) => {
  const r = readWorkContext(g, 'craftskel', { kind: 'inventory' });
  if (!r.ok) throw new Error(r.code);
  const s = r.value.stations[0]!;
  return {
    module: 'craftskel',
    action: 'craft',
    payload: {
      v: 1,
      recipeId: 'craftskel.dagger-recipe',
      batchCount,
      stationId: s.interactableId,
      stationRevision: s.revision,
      sourceContainerId: null,
      sourceRevision: null,
      inventoryStamp: r.value.inventoryStamp
    }
  };
};
const roots = (g: ReturnType<typeof workGame>) => ({
  bag: g.player.inventory,
  world: g.world5,
  clock: g.actorActions,
  containerItems: g.worldContainerItems,
  facts: g.worldWorkFacts,
  details: g.worldWorkDetails,
  grid: g.grid,
  floor: g.items
});
const external = (g: ReturnType<typeof workGame>) => ({
  id: getNextEntityId(),
  rng: rng.getState(),
  time: timeSystem.currentTick,
  log: logger.getState(),
  runtime: g.extensionRuntime!.snapshot()
});
function accept(g: ReturnType<typeof workGame>, count = 2) {
  const p = prepareWorldWorkCommand(g, request(g, count));
  if (!p.outcome.ok) throw new Error(p.outcome.code);
  const handle = p.outcome.value;
  return withWorldActorScope(g, 'craftskel', g.player.id, 'trusted-world', (s) =>
    commitWorldWork(g, handle, s)
  );
}
afterEach(() => vi.restoreAllMocks());
describe('C5 actual publication and interruption paths', () => {
  it.each(['id', 'split', 'remove', 'fact'] as const)(
    'accept %s publication fault restores live graph and allocators',
    (point) => {
      const g = workGame({
          pack: (p) => {
            if (point === 'remove') p.startupItems.items[0].count = 2;
          }
        }),
        p = prepareWorldWorkCommand(g, request(g));
      if (!p.outcome.ok) throw new Error(p.outcome.code);
      const handle = p.outcome.value;
      const graph = auditFullObjectGraph(roots(g)),
        before = external(g);
      if (point === 'id') {
        const original = allocateWorldId;
        vi.spyOn(publication, 'allocateWorldId').mockImplementationOnce((g) => {
          original(g);
          throw new Error(point);
        });
      }
      if (point === 'split') {
        const original = items.assembleWorldItem;
        vi.spyOn(items, 'assembleWorldItem').mockImplementationOnce((...a) => {
          original(...a);
          throw new Error(point);
        });
      }
      if (point === 'remove') {
        const original = Inventory.prototype.removeItem;
        vi.spyOn(Inventory.prototype, 'removeItem').mockImplementationOnce(function (
          this: Inventory,
          i
        ) {
          original.call(this, i);
          throw new Error(point);
        });
      }
      if (point === 'fact') {
        const original = publication.recordWorldFact;
        vi.spyOn(publication, 'recordWorldFact').mockImplementationOnce((...a) => {
          original(...a);
          throw new Error(point);
        });
      }
      withWorldActorScope(g, 'craftskel', g.player.id, 'trusted-world', (s) =>
        expect(commitWorldWork(g, handle, s)).toMatchObject({
          ok: false,
          code: 'C5_PROVIDER'
        })
      );
      expect(graph.differences()).toEqual([]);
      expect(external(g)).toEqual(before);
    }
  );
  it.each(['throw', 'promise'] as const)(
    'cancel participant %s restores the accepted work graph',
    (failure) => {
      let enabled = false;
      const g = workGame({
        participant: (f) => {
          if (enabled && f.operation === 'cancel') {
            if (failure === 'promise') return Promise.resolve();
            throw new Error('cancel');
          }
        }
      });
      expect(accept(g).ok).toBe(true);
      enabled = true;
      const graph = auditFullObjectGraph(roots(g)),
        before = external(g);
      expect(() => cancelWorldWork(g, g.world5!.tickets[0]!.ticketId, 'input')).toThrow(
        'C5_PROVIDER'
      );
      expect(graph.differences()).toEqual([]);
      expect(external(g)).toEqual(before);
    }
  );
  it.each(['output', 'durability', 'message'] as const)(
    'batch %s publication fault rolls back completion then refunds without participant',
    (point) => {
      let fail = false;
      const g = workGame({
        participant: (f) => {
          if (fail && point === 'durability' && f.completedBatches === 1) throw new Error(point);
        }
      });
      const tool = g.player.inventory.items.find(
        (i) => i.worldItem?.definitionId === 'craftskel.knife'
      )!;
      if (point === 'output') {
        const original = items.assembleWorldItem;
        vi.spyOn(items, 'assembleWorldItem').mockImplementation((...a) => {
          if (a[0].category === 'native') {
            original(...a);
            throw new Error(point);
          }
          return original(...a);
        });
      }
      if (point === 'message') {
        const original = logger.log.bind(logger);
        vi.spyOn(logger, 'log').mockImplementationOnce((...a) => {
          original(...a);
          throw new Error(point);
        });
      }
      fail = true;
      g.onConfirmRequest = () => true;
      g.executeCommand('ext:command', JSON.stringify(request(g)));
      while (g.pendingCommandConfirmation)
        g.resolveCommandDecision(g.pendingCommandConfirmation.token, true);
      const t = g.world5!.terminalTickets[0]!;
      expect(t.status).toBe('cancelled');
      expect(t.stopReason).toBe(point === 'durability' ? 'provider' : 'transaction');
      expect(tool.worldItem!.toolDurability).toBe(2);
      expect(g.player.inventory.items.filter((i) => i.identityId === 'dagger')).toHaveLength(1);
      expect(
        g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.fiber')!
          .quantity
      ).toBe(20);
      expect(g.actorActions!.bundles).toHaveLength(0);
      expect(g.world5!.containers.some((c) => c.kind === 'escrow')).toBe(false);
    }
  );
  it.each([
    'damage',
    'moved',
    'level-exit',
    'paralyzed',
    'entranced',
    'confused',
    'stuck',
    'nauseous',
    'seized'
  ] as const)('live bundle %s interruption refunds all unfinished inputs once', (reason) => {
    const g = workGame();
    expect(accept(g).ok).toBe(true);
    if (reason === 'damage') g.player.hp--;
    else if (reason === 'moved') g.player.loc = { x: g.player.x + 1, y: g.player.y };
    else if (reason === 'level-exit') g.depth++;
    else if (reason === 'seized') g.player.seized = true;
    else g.player.applyStatus(reason, 3);
    settleWorldWork(g, false);
    const t = g.world5!.terminalTickets[0]!;
    expect(t.status).toBe('cancelled');
    expect(t.completedBatches).toBe(0);
    expect(g.actorActions!.bundles).toHaveLength(0);
    expect(
      g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.fiber')!
        .quantity
    ).toBe(20);
    const after = external(g);
    settleWorldWork(g, false);
    expect(external(g)).toEqual(after);
  });
  it('broken tool cancels the third batch, preserving two completed batches and one refund', () => {
    const g = workGame();
    g.onConfirmRequest = () => true;
    g.executeCommand('ext:command', JSON.stringify(request(g, 3)));
    while (g.pendingCommandConfirmation)
      g.resolveCommandDecision(g.pendingCommandConfirmation.token, true);
    expect(g.world5!.tickets[0]!.completedBatches).toBe(1);
    g.executeCommand('auto_step');
    expect(g.world5!.tickets[0]!.completedBatches).toBe(2);
    g.executeCommand('auto_step');
    expect(g.world5!.terminalTickets[0]).toMatchObject({
      status: 'cancelled',
      completedBatches: 2,
      stopReason: 'tool'
    });
    expect(
      g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.fiber')!
        .quantity
    ).toBe(18);
    expect(
      g.player.inventory.items.find((i) => i.worldItem?.definitionId === 'craftskel.knife')!
        .worldItem!.toolDurability
    ).toBe(0);
  });
  it('unitsPerHarvest reserves and consumes the definition amount', () => {
    const g = workGame({ pack: (p) => (p.resourceNodes[0].unitsPerHarvest = 3) }),
      n = g.world5!.nodes[0]!,
      r = readWorkContext(g, 'craftskel', { kind: 'inventory' });
    if (!r.ok) throw new Error(r.code);
    g.executeCommand(
      'ext:command',
      JSON.stringify({
        module: 'craftskel',
        action: 'harvest',
        payload: {
          v: 1,
          nodeId: n.interactableId,
          nodeRevision: n.revision,
          destinationId: null,
          destinationRevision: null,
          inventoryStamp: r.value.inventoryStamp
        }
      })
    );
    expect(n.remaining).toBe(3);
    expect(n.reservedUnits).toBe(0);
    expect(g.world5!.terminalTickets[0]!.status).toBe('completed');
  });
});

describe('C5 pre-accept rejection has zero mechanical cost', () => {
  it.each([
    'bad-payload',
    'definition',
    'owner',
    'level',
    'distance',
    'tool',
    'input',
    'capacity',
    'dead',
    'terminal',
    'gate',
    'busy'
  ] as const)('%s', (kind) => {
    const g = workGame(),
      q = request(g, 1);
    if (kind === 'bad-payload') q.payload.batchCount = 17;
    if (kind === 'definition') q.payload.recipeId = 'craftskel.missing';
    if (kind === 'owner') q.module = 'missing';
    if (kind === 'level') g.world5!.stations[0]!.levelRef = { kind: 'dungeon', depth: 2 };
    if (kind === 'distance') g.player.loc = { x: g.player.x + 10, y: g.player.y };
    if (kind === 'tool')
      g.player.inventory.items = g.player.inventory.items.filter(
        (i) => i.worldItem?.definitionId !== 'craftskel.knife'
      );
    if (kind === 'input')
      g.player.inventory.items.find(
        (i) => i.worldItem?.definitionId === 'craftskel.fiber'
      )!.quantity = 0;
    if (kind === 'capacity') g.player.inventory.capacity = 1;
    if (kind === 'dead') g.player.hp = 0;
    if (kind === 'terminal') g.isGameOver = true;
    if (kind === 'gate') vi.spyOn(g, 'interactionActive', 'get').mockReturnValue(true);
    if (kind === 'busy') g.player.ticksUntilTurn = 100;
    if (kind === 'tool' || kind === 'input') {
      const r = readWorkContext(g, 'craftskel', { kind: 'inventory' });
      if (r.ok) q.payload.inventoryStamp = r.value.inventoryStamp;
    }
    const expected = {
      'bad-payload': 'C5_BAD_PAYLOAD',
      definition: 'C5_BAD_DEFINITION',
      owner: 'C5_DISABLED',
      level: 'C5_WRONG_LEVEL',
      distance: 'C5_DISTANCE',
      tool: 'C5_TOOL',
      input: 'C5_INPUT',
      capacity: 'C5_CAPACITY',
      dead: 'C5_DEAD',
      terminal: 'C5_TERMINAL',
      gate: 'C5_GATE',
      busy: 'C5_BUSY'
    }[kind];
    const graph = auditFullObjectGraph(roots(g)),
      before = external(g);
    expect(prepareWorldWorkCommand(g, q).outcome).toMatchObject({ ok: false, code: expected });
    expect(graph.differences()).toEqual([]);
    expect(external(g)).toEqual(before);
  });
});
