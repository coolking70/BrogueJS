/** Pure finite production transition. All quantities are trusted read DTOs, never live Items. */
import type { EconomicOrder, OfflineResidentState } from '../../ext/world5';
import type { ResidentProductionQuota } from '../../ext/residentOrders';
import type { MutableWorld } from '../../ext/world5';
import type { WorkTicket, RecipeDefinition, ItemAmount } from '../../ext/worldSdk';
import { residentEfficiency } from './ResidentEconomy';
import { checkedAdd } from '../../ext/worldBasics';
export function scheduledWorkTicks(from: number, to: number, workEpochs: number): number {
  const prefix = (tick: number) =>
    Math.floor(tick / 32000) * (workEpochs * 1000) + Math.min(tick % 32000, workEpochs * 1000);
  // Callers bound production to its 32-epoch lifetime before evaluating this helper.
  return prefix(to) - prefix(from);
}
export interface ProductionEpochInput {
  epoch: number;
  offline?: boolean;
  order: EconomicOrder;
  ticket: MutableWorld<WorkTicket>;
  recipe: RecipeDefinition;
  need: OfflineResidentState;
  quota: ResidentProductionQuota;
  escrow: { id: number; definitionId: string | null; tags: string[]; quantity: number }[];
}
export function planResidentProductionEpoch(input: ProductionEpochInput) {
  const { epoch, recipe, need } = input;
  const order = structuredClone(input.order),
    ticket = structuredClone(input.ticket),
    quota = structuredClone(input.quota),
    p = order.production!;
  const debits: { itemId: number; quantity: number }[] = [],
    outputs: ItemAmount[] = [];
  if (quota.day !== Math.floor(epoch / 32)) {
    quota.day = Math.floor(epoch / 32);
    quota.meat = 0;
    quota.plots = [];
  }
  if (order.remainingEpochs === 0) return { order, ticket, quota, debits, outputs };
  order.remainingEpochs--;
  order.revision = checkedAdd(order.revision, 1);
  const efficiency = residentEfficiency(need);
  let reason = order.status === 'working' ? p.reason : order.stopReason;
  if (!need.alive || need.departed) reason = 'resident-unavailable';
  else if (!p.qualified) reason ??= 'blocked';
  else if (efficiency === 0) reason = 'needs';
  if (reason) {
    order.status = 'stopped';
    order.stopReason = reason;
    p.paidTicks = 0;
  } else {
    const units = p.creditRemainder + p.paidTicks * efficiency;
    ticket.laborCreditTicks = checkedAdd(ticket.laborCreditTicks, Math.floor(units / 100));
    p.creditRemainder = units % 100;
    p.paidTicks = 0;
    const stock = input.escrow.map((i) => ({ ...i }));
    while (
      ticket.completedBatches < ticket.totalBatches &&
      ticket.laborCreditTicks >= recipe.workTicks
    ) {
      const plot = p.plotIds.find((id) => !quota.plots.includes(id));
      if (recipe.id === 'settlement.farm' && plot === undefined) {
        order.stopReason = 'quota';
        break;
      }
      if (recipe.id === 'settlement.hunt' && quota.meat >= 2) {
        order.stopReason = 'quota';
        break;
      }
      const used: { itemId: number; quantity: number }[] = [];
      for (const amount of recipe.inputs) {
        let left = amount.count;
        const tag = recipe.id.startsWith('settlement.cook-')
          ? 'food.ingredient.' + recipe.id.slice('settlement.cook-'.length)
          : null;
        for (const item of stock) {
          if (tag ? !item.tags.includes(tag) : item.definitionId !== amount.itemDefinitionId)
            continue;
          const count = Math.min(left, item.quantity);
          item.quantity -= count;
          left -= count;
          if (count) used.push({ itemId: item.id, quantity: count });
          if (!left) break;
        }
        if (left) {
          order.status = 'stopped';
          order.stopReason = 'input';
          break;
        }
      }
      if (order.status === 'stopped') break;
      debits.push(...used);
      outputs.push(...recipe.outputs.map((a) => ({ ...a })));
      ticket.laborCreditTicks -= recipe.workTicks;
      ticket.completedBatches++;
      ticket.lastCompletionOrdinal++;
      if (recipe.id === 'settlement.farm') quota.plots.push(plot!);
      if (recipe.id === 'settlement.hunt') quota.meat++;
      if (input.offline && recipe.id === 'settlement.farm') {
        const available = ticket.laborCreditTicks * 100 + p.creditRemainder;
        const travelUnits = Math.min(available, p.travelPerBatchTicks * efficiency);
        p.travelRemainingTicks = p.travelPerBatchTicks - Math.floor(travelUnits / efficiency);
        const rest = available - travelUnits;
        ticket.laborCreditTicks = Math.floor(rest / 100);
        p.creditRemainder = rest % 100;
        if (p.travelRemainingTicks > 0) break;
      }
      order.stopReason = null;
    }
    // Labor cannot be banked through a daily cap to manufacture next-day batches.
    if (order.stopReason === 'quota') {
      ticket.laborCreditTicks = 0;
      p.creditRemainder = 0;
    }
    ticket.revision = checkedAdd(ticket.revision, 1);
    if (ticket.completedBatches === ticket.totalBatches) {
      order.status = 'stopped';
      order.stopReason = 'completed';
      ticket.laborCreditTicks = 0;
      p.creditRemainder = 0;
    }
  }
  if (order.remainingEpochs === 0 && ticket.completedBatches < ticket.totalBatches) {
    order.status = 'needs-resupply';
    order.stopReason = 'needs-resupply';
  }
  return { order, ticket, quota, debits, outputs };
}
