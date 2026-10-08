import { it, expect, vi } from 'vitest';
import { residentScene } from './residentHelpers';
import { payload } from './residentProductionHelpers';
import { current } from './helpers';
import { residentOrder, residentOrderTicket } from '../../../../engine/Core/ResidentOrders';
import { prepareResidentCommand } from '../../../../engine/Core/ResidentProduction';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';
import { advanceWorldClock } from '../../../world5';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
function production() {
  const s = residentScene();
  s.g.player.loc = { x: 20, y: 14 };
  s.g.refreshStructureDerivedState();
  expect(
    s.h.ext('settlement', 'order-work', payload(s.g, s.a.id, 'settlement.hunt', 16)).error
  ).toBeNull();
  return s;
}
it('missing resident production progress is rejected without replacing the live graph or session', () => {
  const { h, g } = production();
  const s = g.toSnapshot();
  delete s.run.world5!.orders[0]!.production;
  const before = h.digest(), rt = g.extensionRuntime, world = g.world5,
    audit = auditFullObjectGraph({ g, rt }), random = rng.getState(), id = getNextEntityId();
  expect(() => h.load(JSON.stringify(s))).toThrow();
  expect(audit.differences()).toEqual([]);
  expect(g.extensionRuntime).toBe(rt);
  expect(g.world5).toBe(world);
  expect(h.digest()).toBe(before);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(id);
});
it('inflated cancelled pending output after one delivery is rejected without replacing the live graph or session', () => {
  const { h, g, a } = production(), o = residentOrder(g, a.id)!;
  // Controlled earned-labor boundaries, using real public custody and cancellation.
  o.production!.paidTicks = 1000;
  advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
  settleResidentNeeds(g);
  o.production!.paidTicks = 1000;
  advanceWorldClock(g.world5!, 1000);
  settleResidentNeeds(g);
  const meat = () => containerItems(g, current(g).supplyId)
    .filter((i) => i.worldItem?.definitionId === 'settlement.meat')
    .reduce((n, i) => n + i.quantity, 0);
  expect(residentOrderTicket(g, a.id)!.completedBatches).toBe(2);
  expect(meat()).toBe(1);
  const c = current(g), r = g.extensionRuntime!.residentComponent<any>('settlement', a.id, 'resident')!;
  expect(h.ext('settlement', 'cancel-order', {
    v: 1, stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
    campId: c.regionId, campRevision: c.revision, targetId: a.id, targetRevision: r.revision,
    orderId: o.id, orderRevision: o.revision
  }).error).toBeNull();
  const retired = g.world5!.terminalTickets.find((t) => t.actorId === a.id)!;
  expect(retired.residentOutput!.counts).toEqual([{ itemDefinitionId: 'settlement.meat', count: 1 }]);
  expect(retired.residentOutput!.destinationId).toBe(c.supplyId);
  const s = g.toSnapshot();
  expect(s.run.world5!.offline[0]!.pendingOutputs[0]!.items[0]!.count).toBe(1);
  s.run.world5!.offline[0]!.pendingOutputs[0]!.items[0]!.count = 2;
  const before = h.digest(), rt = g.extensionRuntime, world = g.world5,
    audit = auditFullObjectGraph({ g, rt }), random = rng.getState(), id = getNextEntityId();
  expect(() => h.load(JSON.stringify(s))).toThrow();
  expect(audit.differences()).toEqual([]);
  expect(g.extensionRuntime).toBe(rt);
  expect(g.world5).toBe(world);
  expect(h.digest()).toBe(before);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(id);
  h.load(h.save());
  expect(h.digest()).toBe(before);
  advanceWorldClock(g.world5!, 1000);
  settleResidentNeeds(g);
  expect(meat()).toBe(2);
  expect(g.world5!.terminalTickets.find((t) => t.ticketId === retired.ticketId)!.residentOutput!.counts).toEqual([]);
  h.load(h.save());
  settleResidentNeeds(g);
  expect(meat()).toBe(2);
});
it.each([
  'old-schema',
  'quota',
  'orphan-ticket',
  'over-budget',
  'duplicate-order',
  'phantom-pending',
  'bad-escrow',
  'bad-output'
])('strict production load rejects %s before replacing the live session', (kind) => {
  const { h, g, a } = production(),
    before = h.digest(),
    session = g.extensionRuntime,
    w = g.world5,
    random = rng.getState(),
    id = getNextEntityId(),
    s = g.toSnapshot();
  const world = s.run.world5!,
    o = world.orders[0]!,
    t = world.tickets[0]!;
  switch (kind) {
    case 'old-schema':
      (world as any).schema = 2;
      break;
    case 'quota':
      world.offline[0]!.productionQuotas![0]!.meat = 3;
      break;
    case 'orphan-ticket':
      o.ticketId = 9999;
      break;
    case 'over-budget':
      o.remainingEpochs = 33;
      break;
    case 'duplicate-order':
      world.orders.push(structuredClone(o));
      break;
    case 'phantom-pending':
      world.offline[0]!.pendingOutputs.push({
        ticketId: t.ticketId,
        availableEpoch: 1,
        destinationId: current(g).supplyId,
        items: [{ itemDefinitionId: 'settlement.meat', count: 1 }]
      });
      break;
    case 'bad-escrow':
      world.containers = world.containers.filter((b) => b.id !== t.inputEscrowId);
      break;
    case 'bad-output':
      t.outputReservation!.counts[0]!.count = 999;
      break;
  }
  expect(() => h.load(JSON.stringify(s))).toThrow();
  expect(h.digest()).toBe(before);
  expect(g.extensionRuntime).toBe(session);
  expect(g.world5).toBe(w);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(id);
  expect(residentOrder(g, a.id)?.ticketId).toBe(
    o.ticketId === 9999 ? t.ticketId : residentOrderTicket(g, a.id)?.ticketId
  );
});
it.each(['throw', 'async', 'foreign', 'malformed'] as const)(
  'bad catalog %s is an explicit atomic prepare refusal',
  (kind) => {
    const { g, a } = residentScene(['settlement', 'crafting']);
    g.player.loc = { x: 20, y: 14 };
    g.refreshStructureDerivedState();
    const rt = g.extensionRuntime!,
      query = rt.queryOptional.bind(rt);
    vi.spyOn(rt, 'queryOptional').mockImplementation(((capability: string, input: any) => {
      if (capability !== 'crafting.recipe-catalog.v1') return query(capability, input);
      g.player.hp--;
      g.world5!.nextPlanId++;
      if (kind === 'throw') throw Error('bad provider');
      if (kind === 'async') return Promise.resolve({ schema: 1, recipes: [] });
      return {
        status: 'available',
        value:
          kind === 'foreign'
            ? { schema: 1, recipes: [{ owner: 'foraging', id: 'foraging.rogue' }] }
            : null
      };
    }) as any);
    const audit = auditFullObjectGraph({ g, rt }),
      random = rng.getState(),
      id = getNextEntityId();
    expect(
      prepareResidentCommand(g, {
        module: 'settlement',
        action: 'order-work',
        payload: payload(g, a.id)
      }).ok
    ).toBe(false);
    expect(audit.differences()).toEqual([]);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
  }
);
it.each(['before', 'after'] as const)(
  'production %s writer fault preserves the complete paid-b graph and retries once',
  (stage) => {
    const { g, a } = production(),
      rt = g.extensionRuntime!,
      o = residentOrder(g, a.id)!;
    // Narrow staged earned-labor boundary: public custody is real; advance/credit
    // qualification is separately verified by the native labor tests.
    o.production!.paidTicks = 1000;
    advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
    const write = rt.worldWorkFact.bind(rt);
    vi.spyOn(rt, 'worldWorkFact').mockImplementation((...args) => {
      if (stage === 'before') throw Error('writer fault');
      write(...args);
      throw Error('writer fault');
    });
    const audit = auditFullObjectGraph({ g, rt }),
      random = rng.getState(),
      id = getNextEntityId(),
      tick = g.world5!.simulationTicks;
    expect(() => settleResidentNeeds(g)).toThrow('writer fault');
    expect(audit.differences()).toEqual([]);
    expect(g.world5!.simulationTicks).toBe(tick);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    vi.restoreAllMocks();
    settleResidentNeeds(g);
    expect(residentOrderTicket(g, a.id)!.completedBatches).toBe(1);
    const ledger = g.world5!.offline[0]!;
    expect(ledger.pendingOutputs).toHaveLength(1);
    advanceWorldClock(g.world5!, 1000);
    settleResidentNeeds(g);
    expect(
      containerItems(g, current(g).supplyId)
        .filter((i) => i.worldItem?.definitionId === 'settlement.meat')
        .reduce((n, i) => n + i.quantity, 0)
    ).toBe(1);
  }
);
it('cancellation refunds once while earned output stays unavailable until the next epoch', () => {
  const { h, g, a } = production(),
    o = residentOrder(g, a.id)!;
  o.production!.paidTicks = 1000;
  advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
  settleResidentNeeds(g);
  const c = current(g),
    r = g.extensionRuntime!.residentComponent<any>('settlement', a.id, 'resident')!;
  expect(
    h.ext('settlement', 'cancel-order', {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId,
      campRevision: c.revision,
      targetId: a.id,
      targetRevision: r.revision,
      orderId: o.id,
      orderRevision: o.revision
    }).error
  ).toBeNull();
  expect(
    containerItems(g, c.supplyId).some((i) => i.worldItem?.definitionId === 'settlement.meat')
  ).toBe(false);
  expect(g.world5!.offline[0]!.pendingOutputs).toHaveLength(1);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
  advanceWorldClock(g.world5!, 1000);
  settleResidentNeeds(g);
  expect(
    containerItems(g, c.supplyId).find((i) => i.worldItem?.definitionId === 'settlement.meat')
      ?.quantity
  ).toBe(1);
  expect(g.world5!.offline[0]!.pendingOutputs).toHaveLength(0);
});
it.each([false, true])('destroyed destination retains earned output deadline and one save/load-safe floor owner (cancel first: %s)', async (cancelFirst) => {
  const { scene } = await import('./residentJobHelpers');
  const { base } = await import('./helpers');
  const { h, g, a, dst } = scene();
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'order-work', {
      ...payload(g, a.id),
      destinationId: dst,
      destinationRevision: g.world5!.containers.find((b) => b.id === dst)!.revision
    }).error
  ).toBeNull();
  residentOrder(g, a.id)!.production!.paidTicks = 1000;
  advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
  settleResidentNeeds(g);
  if (cancelFirst) {
    const o = residentOrder(g, a.id)!, c = current(g),
      r = g.extensionRuntime!.residentComponent<any>('settlement', a.id, 'resident')!;
    expect(h.ext('settlement', 'cancel-order', {
      v: 1, stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId, campRevision: c.revision, targetId: a.id, targetRevision: r.revision,
      orderId: o.id, orderRevision: o.revision
    }).error).toBeNull();
  }
  const component = g.world5!.structures.find(
    (s) => s.fixture?.definitionId === 'settlement.chest'
  )!.fixture!;
  expect(
    h.ext('settlement', 'dismantle', {
      ...base(g),
      componentId: component.id,
      componentRevision: component.revision
    }).error
  ).toBeNull();
  expect(residentOrder(g, a.id)).toBeUndefined();
  expect(g.world5!.offline[0]!.pendingOutputs[0]!.fallbackAt).toEqual({ x: 20, y: 15 });
  expect(g.world5!.terminalTickets.find((t) => t.actorId === a.id)!.residentOutput).toEqual({
    levelRef: { kind: 'dungeon', depth: g.depth }, destinationId: dst,
    counts: [{ itemDefinitionId: 'settlement.meat', count: 1 }], fallbackAt: { x: 20, y: 15 }
  });
  expect(g.items.some((i) => i.worldItem?.definitionId === 'settlement.meat')).toBe(false);
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
  advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
  settleResidentNeeds(g);
  const meat = g.items.filter((i) => i.worldItem?.definitionId === 'settlement.meat');
  expect(meat).toHaveLength(1);
  expect(meat[0]!.quantity).toBe(1);
  expect(g.world5!.offline[0]!.pendingOutputs).toHaveLength(0);
  const final = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(final);
  settleResidentNeeds(g);
  expect(g.items.filter((i) => i.worldItem?.definitionId === 'settlement.meat')).toHaveLength(1);
});
it.each([0, 999, 1000, 1001])(
  'real earned output observes the next availability boundary at +%i ticks without load production',
  (offset) => {
    const { h, g, a } = production();
    residentOrder(g, a.id)!.production!.paidTicks = 1000;
    advanceWorldClock(g.world5!, 1000 - (g.world5!.simulationTicks % 1000));
    settleResidentNeeds(g);
    expect(g.world5!.offline[0]!.pendingOutputs).toHaveLength(1);
    if (offset > 0) advanceWorldClock(g.world5!, offset);
    settleResidentNeeds(g);
    const meat = containerItems(g, current(g).supplyId)
      .filter((i) => i.worldItem?.definitionId === 'settlement.meat')
      .reduce((n, i) => n + i.quantity, 0);
    expect(meat).toBe(offset >= 1000 ? 1 : 0);
    expect(g.world5!.offline[0]!.pendingOutputs).toHaveLength(offset >= 1000 ? 0 : 1);
    const digest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(digest);
  }
);
