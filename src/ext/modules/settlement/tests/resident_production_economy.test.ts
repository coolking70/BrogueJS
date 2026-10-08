import { it, expect } from 'vitest';
import {
  planResidentProductionEpoch,
  scheduledWorkTicks
} from '../../../../engine/Core/ResidentOrderEconomy';
import { initialResidentNeed } from '../../../../engine/Core/ResidentEconomy';
import { loadSettlementPack } from '../definitions';
import type { EconomicOrder, MutableWorld } from '../../../world5';
import type { WorkTicket } from '../../../worldSdk';
function scene(recipeId = 'settlement.hunt') {
  const recipe = loadSettlementPack().world.recipes.find((r) => r.id === recipeId)!;
  const order: EconomicOrder = {
    id: 1,
    owner: 'settlement',
    actorId: 7,
    levelRef: { kind: 'dungeon', depth: 1 },
    definitionId: recipeId,
    priority: 0,
    planId: 1,
    remainingEpochs: 32,
    ticketId: 2,
    status: 'working',
    stopReason: null,
    revision: 0,
    production: {
      sourceId: 3,
      destinationId: 4,
      stationId: null,
      plotIds: recipeId === 'settlement.farm' ? [11, 12] : [],
      batchCount: 16,
      paidTicks: 1000,
      creditRemainder: 0,
      travelRemainingTicks: 0,
      travelPerBatchTicks: 0,
      qualified: true,
      reason: null
    }
  };
  const ticket: MutableWorld<WorkTicket> = {
    ticketId: 2,
    owner: 'settlement',
    actorId: 7,
    levelRef: { kind: 'dungeon', depth: 1 },
    kind: 'craft',
    nodeId: null,
    stationId: null,
    sourceContainerId: 3,
    definitionId: recipeId,
    inputEscrowId: 5,
    outputReservation: null,
    refundReservation: null,
    resourceReservation: null,
    totalBatches: 16,
    completedBatches: 0,
    remainingTicks: recipe.workTicks,
    laborCreditTicks: 0,
    bundleActionId: null,
    revision: 0,
    status: 'suspended',
    stopReason: null,
    lastCompletionOrdinal: 0
  };
  return {
    epoch: 1,
    order,
    ticket,
    recipe,
    need: initialResidentNeed(7),
    quota: { actorId: 7, day: 0, meat: 0, plots: [] as number[] },
    escrow: recipe.inputs.map((a, index) => ({
      id: index + 20,
      definitionId: a.itemDefinitionId,
      tags: recipeId.includes('cook-')
        ? ['food.ingredient.' + recipeId.slice('settlement.cook-'.length)]
        : [],
      quantity: a.count * 16
    }))
  };
}
it.each([0, 50, 100] as const)(
  'effective labor %s%% respects the fixed denominator and remainder',
  (eff) => {
    const s = scene('settlement.cook-crop');
    s.need.foodShortage = eff === 100 ? 0 : eff === 50 ? 1 : 2;
    const p = planResidentProductionEpoch(s);
    expect(p.ticket.completedBatches).toBe(eff / 50);
    expect(p.debits.reduce((n, d) => n + d.quantity, 0)).toBe((eff / 50) * 3);
    expect(s.ticket.completedBatches).toBe(0);
    expect(s.escrow[0]!.quantity).toBe(48);
  }
);
it('farmer pays seeds and labor, at most six plots and once per absolute day even with new plans', () => {
  const s = scene('settlement.farm');
  s.order.production!.paidTicks = 10000;
  const one = planResidentProductionEpoch(s);
  expect(one.ticket.completedBatches).toBe(2);
  expect(one.debits.reduce((n, d) => n + d.quantity, 0)).toBe(2);
  expect(one.quota.plots).toEqual([11, 12]);
  const next = scene('settlement.farm');
  next.quota = one.quota;
  next.order.planId = 99;
  expect(planResidentProductionEpoch(next).ticket.completedBatches).toBe(0);
  next.epoch = 32;
  next.order.production!.paidTicks = 2000;
  expect(planResidentProductionEpoch(next).ticket.completedBatches).toBe(2);
});
it('hunter absolute daily cap never invents unpaid meat', () => {
  const s = scene();
  s.order.production!.paidTicks = 10000;
  const p = planResidentProductionEpoch(s);
  expect(p.ticket.completedBatches).toBe(2);
  expect(p.quota.meat).toBe(2);
  const n = scene();
  n.quota = p.quota;
  n.order.planId = 2;
  expect(planResidentProductionEpoch(n).outputs).toHaveLength(0);
  n.epoch = 32;
  n.order.production!.paidTicks = 999;
  expect(planResidentProductionEpoch(n).outputs).toHaveLength(0);
  n.order.production!.paidTicks = 1000;
  expect(planResidentProductionEpoch(n).outputs).toHaveLength(1);
});
it.each([31, 32, 33])(
  'order total lifetime stops at %s absolute periods, not each call',
  (count) => {
    let s = scene();
    for (let n = 1; n <= count; n++) {
      s.epoch = n;
      s.order.production!.paidTicks = 0;
      const p = planResidentProductionEpoch(s);
      s = { ...s, ...p };
    }
    expect(s.order.remainingEpochs).toBe(Math.max(0, 32 - count));
    if (count >= 32) expect(s.order.status).toBe('needs-resupply');
  }
);
it('work/rest split and extreme absolute ticks do not replay individual days', () => {
  expect(scheduledWorkTicks(0, 32000, 16)).toBe(16000);
  expect(scheduledWorkTicks(15999, 16001, 16)).toBe(1);
  const from = Number.MAX_SAFE_INTEGER - 64000,
    to = Number.MAX_SAFE_INTEGER;
  const whole = scheduledWorkTicks(from, to, 16),
    cuts = Array.from({ length: 17 }, (_, i) => from + Math.floor(((to - from) * (i + 1)) / 17));
  let previous = from,
    total = 0;
  for (const end of cuts) {
    total += scheduledWorkTicks(previous, end, 16);
    previous = end;
  }
  expect(total).toBe(whole);
  expect(whole).toBe(32000);
});
it('bounded economic kernel retains the ordinary and maximum budgets without a tick loop', () => {
  const ordinary = Array.from({ length: 16 }, () => scene('settlement.cook-crop'));
  const max = Array.from({ length: 64 }, () => scene('settlement.cook-crop'));
  // Warm only the pure value transition; this is not the full Game/frame budget.
  for (const s of ordinary) planResidentProductionEpoch(s);
  let start = performance.now();
  for (const s of ordinary) planResidentProductionEpoch(s);
  const ordinaryMs = performance.now() - start;
  start = performance.now();
  for (let epoch = 1; epoch <= 32; epoch++)
    for (let i = 0; i < max.length; i++) {
      const s = max[i]!;
      s.epoch = epoch;
      s.order.production!.paidTicks = 1000;
      max[i] = { ...s, ...planResidentProductionEpoch(s) };
    }
  const maximumMs = performance.now() - start;
  console.log(
    JSON.stringify({
      probe: 'production-value-kernel',
      ordinary16Ms: ordinaryMs,
      maximum64x32Ms: maximumMs
    })
  );
  expect(ordinaryMs).toBeLessThanOrEqual(5);
  expect(maximumMs).toBeLessThanOrEqual(50);
  expect(max.every((s) => s.order.remainingEpochs === 0)).toBe(true);
});
it('frozen farm route travel reduces output and retains the remaining trip budget', () => {
  const s = scene('settlement.farm');
  s.order.production!.paidTicks = 2000;
  s.order.production!.travelPerBatchTicks = 300;
  const p = planResidentProductionEpoch({ ...s, offline: true });
  expect(p.ticket.completedBatches).toBe(1);
  expect(p.ticket.laborCreditTicks).toBe(700);
  expect(p.order.production!.travelRemainingTicks).toBe(0);
  s.order.production!.paidTicks = 1000;
  const noSurplus = planResidentProductionEpoch({ ...s, offline: true });
  expect(noSurplus.ticket.completedBatches).toBe(1);
  expect(noSurplus.order.production!.travelRemainingTicks).toBe(300);
});
