import { describe, it, expect } from 'vitest';
import { residentScene } from './residentHelpers';
import { current, base } from './helpers';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { residentOrder, residentOrderTicket } from '../../../../engine/Core/ResidentOrders';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { payload } from './residentProductionHelpers';

describe('5D2 real public production', () => {
  it('public hunter uses paid native labor, daily cap, unique custody, save/load and cancellation', () => {
    const { h, g, a } = residentScene();
    g.player.loc = { x: 20, y: 14 };
    g.refreshStructureDerivedState();
    const accepted = h.ext('settlement', 'order-work', payload(g, a.id));
    expect(accepted.error).toBeNull();
    expect(residentOrder(g, a.id)?.remainingEpochs).toBe(32);
    const id = residentOrder(g, a.id)!.ticketId!;
    for (let n = 0; n < 100; n++) h.command('wait');
    expect(
      containerItems(g, current(g).supplyId)
        .filter((i) => i.worldItem?.definitionId === 'settlement.meat')
        .reduce((n, i) => n + i.quantity, 0)
    ).toBe(2);
    expect(residentOrderTicket(g, a.id)?.ticketId).toBe(id);
    expect(residentOrderTicket(g, a.id)?.completedBatches).toBe(2);
    h.load(JSON.stringify(g.toSnapshot()));
    expect(residentOrderTicket(g, a.id)?.completedBatches).toBe(2);
    const o = residentOrder(g, a.id)!,
      c = current(g),
      r = residentComponent(g, a.id)!;
    g.player.loc = { x: a.x - 1, y: a.y };
    g.refreshStructureDerivedState();
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
    expect(residentOrder(g, a.id)).toBeUndefined();
    expect(g.world5!.tickets).toHaveLength(0);
  });
  it('No, bad input, duplicate and stale revisions do not reserve or charge', () => {
    const { h, g, a } = residentScene();
    const p = payload(g, a.id);
    const before = JSON.stringify(g.world5);
    expect(h.ext('settlement', 'order-work', { ...p, batchCount: 17 }).error).not.toBeNull();
    expect(JSON.stringify(g.world5)).toBe(before);
    expect(h.ext('settlement', 'order-work', p).error).toBeNull();
    const after = JSON.stringify(g.world5);
    expect(h.ext('settlement', 'order-work', p).error).not.toBeNull();
    expect(JSON.stringify(g.world5)).toBe(after);
  });
});
it('No and a suspended Yes with changed container CAS consume no input, time, ID or RNG', () => {
  const { h, g, a } = residentScene();
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  const p = payload(g, a.id);
  const world = JSON.stringify(g.world5);
  expect(h.ext('settlement', 'order-work', p, [false]).error).toBeNull();
  expect(JSON.stringify(g.world5)).toBe(world);
  g.onCommandConfirmRequest = () => {};
  g.executeCommand(
    'ext:command',
    JSON.stringify({ module: 'settlement', action: 'order-work', payload: p })
  );
  expect(g.pendingCommandConfirmation).not.toBeNull();
  g.world5!.containers.find((b) => b.id === current(g).supplyId)!.revision++;
  const next = JSON.stringify(g.world5);
  g.resolveCommandDecision(g.pendingCommandConfirmation!.token, true);
  expect(JSON.stringify(g.world5)).toBe(next);
  expect(residentOrder(g, a.id)).toBeUndefined();
});
it('32 epochs exhaust one persistent plan; public resupply retains progress/ticket and daily high-water', () => {
  const { h, g, a } = residentScene();
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'order-work', payload(g, a.id, 'settlement.hunt', 16)).error
  ).toBeNull();
  const first = residentOrder(g, a.id)!.planId,
    ticket = residentOrder(g, a.id)!.ticketId;
  for (let n = 0; n < 330; n++) h.command('wait');
  const o = residentOrder(g, a.id)!,
    r = residentComponent(g, a.id)!,
    c = current(g),
    box = g.world5!.containers.find((b) => b.id === c.supplyId)!;
  expect(o.status).toBe('needs-resupply');
  expect(o.remainingEpochs).toBe(0);
  const completed = residentOrderTicket(g, a.id)!.completedBatches;
  g.player.loc = { x: a.x - 1, y: a.y };
  g.refreshStructureDerivedState();
  expect(
    h.ext('settlement', 'resupply-work', {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId,
      campRevision: c.revision,
      targetId: a.id,
      targetRevision: r.revision,
      orderId: o.id,
      orderRevision: o.revision,
      sourceRevision: box.revision,
      destinationRevision: box.revision,
      stationRevision: null,
      plotRevisions: [],
      inventoryStamp: base(g).inventoryStamp
    }).error
  ).toBeNull();
  expect(o.planId).toBeGreaterThan(first);
  expect(o.remainingEpochs).toBe(32);
  expect(o.ticketId).toBe(ticket);
  expect(residentOrderTicket(g, a.id)!.completedBatches).toBe(completed);
  for (let n = 0; n < 10; n++) h.command('wait');
  expect(residentOrderTicket(g, a.id)!.completedBatches).toBe(completed);
});
it('public farmer keeps one seed escrow through repeated harvests and absolute plot-day limits', async () => {
  const { scene } = await import('./residentJobHelpers');
  const { residentPlotReason } = await import('../../../../engine/Core/ResidentJobs');
  const { advanceWorldClock } = await import('../../../world5');
  const { settleResidentNeeds } = await import('../../../../engine/Core/ResidentNeeds');
  const { h, g, a, src, dst, plot } = scene();
  g.player.loc = { x: 25, y: 11 };
  a.loc = { x: 24, y: 11 };
  g.refreshStructureDerivedState();
  expect(residentPlotReason(g, plot)).toBeNull();
  expect(
    h.ext('settlement', 'order-work', {
      ...payload(g, a.id, 'settlement.farm', 2),
      sourceId: src,
      destinationId: dst,
      sourceRevision: g.world5!.containers.find((b) => b.id === src)!.revision,
      destinationRevision: g.world5!.containers.find((b) => b.id === dst)!.revision,
      plotIds: [plot],
      plotRevisions: [g.world5!.structures.find((s) => s.fixture?.id === plot)!.fixture!.revision]
    }).error
  ).toBeNull();
  const ticket = residentOrder(g, a.id)!.ticketId;
  g.player.loc = { x: 29, y: 9 };
  g.refreshStructureDerivedState();
  for (let n = 0; n < 50; n++) h.command('wait');
  expect(
    containerItems(g, dst)
      .filter((i) => i.worldItem?.definitionId === 'settlement.crop')
      .reduce((n, i) => n + i.quantity, 0)
  ).toBe(1);
  expect(residentOrderTicket(g, a.id)?.ticketId).toBe(ticket);
  advanceWorldClock(g.world5!, 32000 - g.world5!.simulationTicks);
  settleResidentNeeds(g);
  for (let n = 0; n < 25; n++) h.command('wait');
  expect(
    containerItems(g, dst)
      .filter((i) => i.worldItem?.definitionId === 'settlement.crop')
      .reduce((n, i) => n + i.quantity, 0)
  ).toBe(2);
  expect(residentOrder(g, a.id)?.stopReason).toBe('completed');
  const digest = h.digest();
  h.load(h.save());
  expect(h.digest()).toBe(digest);
});
it('full output capacity refuses the public order before custody or time changes', async () => {
  const { h, g, a } = residentScene();
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  const box = g.world5!.containers.find((b) => b.id === current(g).supplyId)!;
  const { putContainer, itemDefinition, containerRead } =
    await import('../../../../engine/Core/WorldWorkWorld');
  const { assembleWorldItem } = await import('../../../../engine/Items/WorldItems');
  while (containerRead(g, box.id).occupiedSlots < box.capacity)
    putContainer(g, box.id, assembleWorldItem(itemDefinition(g, 'settlement.wood')!, 99));
  const before = h.digest(),
    tick = g.world5!.simulationTicks;
  expect(h.ext('settlement', 'order-work', payload(g, a.id)).error).toBe('C5_CAPACITY');
  expect(h.digest()).toBe(before);
  expect(g.world5!.simulationTicks).toBe(tick);
  expect(g.world5!.orders).toHaveLength(0);
  expect(g.world5!.tickets).toHaveLength(0);
});
it('native incapacity stops production without refund or credit and permits explicit resupply', () => {
  const { h, g, a } = residentScene();
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(h.ext('settlement', 'order-work', payload(g, a.id)).error).toBeNull();
  const ticket = residentOrderTicket(g, a.id)!.ticketId;
  a.applyStatus('confused', 1000);
  for (let n = 0; n < 10; n++) h.command('wait');
  const o = residentOrder(g, a.id)!;
  expect(o.status).toBe('stopped');
  expect(o.stopReason).toBe('danger');
  expect(residentOrderTicket(g, a.id)!.ticketId).toBe(ticket);
  expect(residentOrderTicket(g, a.id)!.completedBatches).toBe(0);
  a.setStatusDuration('confused', 0);
  g.player.loc = { x: a.x - 1, y: a.y };
  g.refreshStructureDerivedState();
  const c = current(g),
    r = residentComponent(g, a.id)!,
    box = g.world5!.containers.find((b) => b.id === c.supplyId)!;
  expect(
    h.ext('settlement', 'resupply-work', {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId,
      campRevision: c.revision,
      targetId: a.id,
      targetRevision: r.revision,
      orderId: o.id,
      orderRevision: o.revision,
      sourceRevision: box.revision,
      destinationRevision: box.revision,
      stationRevision: null,
      plotRevisions: [],
      inventoryStamp: base(g).inventoryStamp
    }).error
  ).toBeNull();
  expect(o.status).toBe('working');
  expect(o.ticketId).toBe(ticket);
});
it('production view refresh and replay order callbacks preserve all mechanical roots, IDs and RNG', async () => {
  const { effectScope, ref } = await import('vue');
  const { useSettlementUi } = await import('../ui/useSettlementUi');
  const { rng } = await import('../../../../engine/Random');
  const { getNextEntityId } = await import('../../../../entities/Creature');
  const { h, g, a } = residentScene();
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(h.ext('settlement', 'order-work', payload(g, a.id)).error).toBeNull();
  // A controlled presentation fixture retains the visible actual order. The
  // independent normal-game test covers genuine replay reconstruction/seek.
  g.replayRecording = g.exportRecording();
  const scope = effectScope(),
    host = {
      game: () => g,
      tick: ref(0),
      immersive: ref(false),
      canOpenPanel: () => true,
      beforeOpenPanel() {},
      afterClosePanel() {},
      registerKeyHandler() {
        return () => {};
      },
      selectMapCells() {
        return () => {};
      }
    };
  const ui = scope.run(() => useSettlementUi(host))!;
  const digest = h.digest(),
    random = rng.getState(),
    id = getNextEntityId(),
    tick = g.world5!.simulationTicks;
  ui.commands.value[0]!.invoke();
  for (let n = 0; n < 20; n++) ui.refresh();
  const props = ui.panel.value!.props as any;
  expect(props.model.production.orders).toHaveLength(1);
  props.onResident('cancel-order', a.id);
  props.onResident('resupply-work', a.id);
  expect(h.digest()).toBe(digest);
  expect(rng.getState()).toEqual(random);
  expect(getNextEntityId()).toBe(id);
  expect(g.world5!.simulationTicks).toBe(tick);
  scope.stop();
});
