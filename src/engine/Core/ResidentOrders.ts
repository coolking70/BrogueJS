/** Native resident authority. Public commands address resident IDs; actor scopes are internal. */
import type { Game } from './Game';
import type { CampRecord } from '../../ext/structureSdk';
import type { EconomicOrder, OfflineLedger, WorldReceipt } from '../../ext/world5';
import type { RecipeDefinition, ItemAmount } from '../../ext/worldSdk';
import { checkedAdd, uint, World5Error } from '../../ext/worldBasics';
import { c5Canonical } from '../../ext/worldJson';
import {
  residentActors,
  residentComponent,
  residentRecord,
  campBox,
  inResidentCamp,
  residentDisabled,
  unsafeResidentCell,
  transactResidentWorld,
  failResident
} from './ResidentWorld';
import { residentDistanceMap } from './ResidentPathing';
import { residentPlotReason, residentHasNativePriority, stepResident } from './ResidentJobs';
import {
  containerRead,
  containerItems,
  itemRead,
  allocateWorldId,
  reservedContainerSlots,
  checkItemBudget,
  createOutputs,
  putContainer,
  withPublishingTicket,
  updateWorldReasons,
  itemDefinition,
  recordWorldFact
} from './WorldWorkWorld';
import { Item, ItemCategory } from '../Items/Item';
import { serializeItem } from './EntitySnapshot';
import { amountStacks } from './WorldWorkWorld';
import { assembleWorldItem, bindWorldItem } from '../Items/WorldItems';
import { createActorActionBundle, type ReadonlyActorActionBundle } from './ActorActionScheduler';
import { productionActorActionScheduler } from './ActorActionProduction';
import { sourceFootprintVersion } from '../Movement/AttackShape';
import { markRecordingRoot } from '../../ext/recordingRevisions';
import { planResidentProductionEpoch, scheduledWorkTicks } from './ResidentOrderEconomy';
import { residentEfficiency } from './ResidentEconomy';
const activeResidentDepth = (g: Game) => {
  const l = g.world5!.levels.find((l) => l.residence === 'active');
  return l?.levelRef.kind === 'dungeon' ? l.levelRef.depth : g.depth;
};
export const residentOrder = (g: Game, id: number) =>
  g.world5?.orders.find((o) => o.actorId === id && o.production);
export const residentOrderTicket = (g: Game, id: number) => {
  const o = residentOrder(g, id);
  return o?.ticketId === null
    ? undefined
    : g.world5?.tickets.find((t) => t.ticketId === o?.ticketId);
};
export function residentRecipeCatalog(g: Game): RecipeDefinition[] {
  const guarded =
    g.extensionRuntime!.manifest.modules.some((m) => m.id === 'crafting') &&
    typeof g.checkpointResidentWorld === 'function';
  const restore = guarded ? g.checkpointResidentWorld() : () => {};
  try {
    return queryResidentRecipeCatalog(g);
  } finally {
    restore();
  }
}
function queryResidentRecipeCatalog(g: Game): RecipeDefinition[] {
  const base = g
    .extensionRuntime!.worldDefinitionPacks()
    .flatMap((p) => p.recipes)
    .filter(
      (r) =>
        r.owner === 'settlement' &&
        (r.id !== 'settlement.cook-mushroom' ||
          g
            .extensionRuntime!.worldDefinitionPacks()
            .some((p) => p.edibleItems?.some((i) => i.tags.includes('food.ingredient.mushroom'))))
    );
  let result: ReturnType<NonNullable<Game['extensionRuntime']>['queryOptional']>;
  try {
    result = g.extensionRuntime!.queryOptional('crafting.recipe-catalog.v1', {});
  } catch {
    throw new World5Error('C5_PROVIDER');
  }
  if (result && typeof (result as unknown as { then?: unknown }).then === 'function') {
    void Promise.resolve(result).catch(() => undefined);
    failResident('C5_PROVIDER');
  }
  if (
    !result ||
    typeof result !== 'object' ||
    !['available', 'unavailable'].includes(result.status)
  )
    failResident('C5_PROVIDER');
  if (result.status === 'unavailable') {
    if (
      Object.keys(result).sort().join(',') !== 'reason,status' ||
      !['absent', 'unsupported-input'].includes(result.reason)
    )
      failResident('C5_PROVIDER');
    return structuredClone(base);
  }
  if (Object.keys(result).sort().join(',') !== 'status,value') failResident('C5_PROVIDER');
  const v = result.value as unknown as { schema: number; recipes: RecipeDefinition[] };
  const registered = g
    .extensionRuntime!.worldDefinitionPacks()
    .flatMap((p) => p.recipes)
    .filter((r) => r.owner === 'crafting')
    .sort((a, b) => a.id.localeCompare(b.id));
  if (
    !v ||
    v.schema !== 1 ||
    Object.keys(v).sort().join(',') !== 'recipes,schema' ||
    c5Canonical(v.recipes) !== c5Canonical(registered)
  )
    failResident('C5_PROVIDER');
  return structuredClone([...base, ...registered]).sort(
    (a, b) => a.owner.localeCompare(b.owner) || a.id.localeCompare(b.id)
  );
}
export function orderRecipe(g: Game, o: Pick<EconomicOrder, 'definitionId'>): RecipeDefinition {
  const d = residentRecipeCatalog(g).find((r) => r.id === o.definitionId && r.offlineEligible);
  if (!d) failResident('C5_BAD_DEFINITION');
  return d!;
}
function orderTarget(g: Game, o: EconomicOrder) {
  const p = o.production!;
  if (o.definitionId === 'settlement.farm') {
    const day = Math.floor(g.world5!.simulationTicks / 32000),
      state = g.extensionRuntime!.worldCampState(o.owner),
      id =
        p.plotIds.find(
          (id) => !state.plotDays.some((q) => q.componentId === id && q.day === day)
        ) ?? p.plotIds[0];
    return g.world5!.structures.find((s) => s.fixture?.id === id)?.at ?? null;
  }
  if (p.stationId !== null) {
    const e = g.extensionRuntime!.worldWorkEntities().find((e) => e.id === p.stationId);
    return e ? { x: e.x, y: e.y } : null;
  }
  return containerRead(g, p.destinationId).at;
}
function selectedInputs(g: Game, recipe: RecipeDefinition, sourceId: number, batches: number) {
  const items = containerItems(g, sourceId).map((i) => ({
    item: i,
    available: i.quantity - g.extensionRuntime!.worldCampLockedQuantity(i.id),
    read: itemRead(g, i)
  }));
  const selections: { item: Item; quantity: number }[] = [];
  for (const amount of recipe.inputs) {
    let left = amount.count * batches;
    const tag = recipe.id.startsWith('settlement.cook-')
      ? 'food.ingredient.' + recipe.id.slice('settlement.cook-'.length)
      : null;
    for (const row of items) {
      if (tag ? !row.read.tags.includes(tag) : row.read.definitionId !== amount.itemDefinitionId)
        continue;
      const n = Math.min(left, row.available);
      if (n) selections.push({ item: row.item, quantity: n });
      row.available -= n;
      left -= n;
      if (!left) break;
    }
    if (left) failResident('C5_INPUT');
  }
  if (recipe.toolTag) {
    const tool = items.find(
      (i) =>
        i.read.tags.includes(recipe.toolTag!) &&
        i.read.toolDurability !== null &&
        i.read.toolDurability >=
          batches * (itemDefinition(g, i.read.definitionId!).tool?.durabilityPerBatch ?? 1)
    );
    if (!tool) failResident('C5_TOOL');
    selections.push({ item: tool!.item, quantity: 1 });
  }
  return selections;
}
export function prepareResidentOrder(g: Game, c: CampRecord, action: string, p: any): void {
  if (action === 'cancel-order' || action === 'resupply-work') {
    uint(p.orderId, 'orderId', 1);
    uint(p.orderRevision, 'orderRevision');
    const order = residentOrder(g, p.targetId);
    if (!order || order.id !== p.orderId) failResident('C5_BAD_REFERENCE');
    if (order!.revision !== p.orderRevision) failResident('C5_STALE');
    if (action === 'cancel-order') return;
    if (order!.status === 'working') failResident('C5_BUSY');
    p = { ...order!.production, ...p, recipeId: order!.definitionId };
  } else if (
    g.world5!.orders.length >= 256 ||
    g.world5!.orders.filter((o) => o.levelRef.kind === 'dungeon' && o.levelRef.depth === c.depth)
      .length >= 32
  )
    failResident('C5_BUDGET');
  else if (
    residentOrder(g, p.targetId) ||
    g.world5!.residentJobs.some((j) => j.actorId === p.targetId) ||
    g.world5!.tickets.some((t) => t.actorId === p.targetId)
  )
    failResident('C5_BUSY');
  if (residentComponent(g, p.targetId)?.mode !== 'stay') failResident('C5_GATE');
  const actor = g.monsters.find((a) => a.id === p.targetId)!;
  if (residentHasNativePriority(g, actor)) failResident('C5_THREAT');
  uint(p.batchCount, 'batchCount', 1);
  if (p.batchCount > 16) failResident('C5_BAD_PAYLOAD');
  const recipe = orderRecipe(g, { definitionId: p.recipeId });
  const source = campBox(g, c, p.sourceId),
    dest = campBox(g, c, p.destinationId);
  if (source.revision !== p.sourceRevision || dest.revision !== p.destinationRevision)
    failResident('C5_STALE');
  if (p.stationId !== null) {
    uint(p.stationId, 'stationId', 1);
    uint(p.stationRevision, 'stationRevision');
    const s = g.world5!.stations.find((s) => s.interactableId === p.stationId),
      e = g.extensionRuntime!.worldWorkEntities().find((e) => e.id === p.stationId),
      d = g
        .extensionRuntime!.worldDefinitionPacks()
        .flatMap((p) => p.stations)
        .find((d) => d.id === s?.definitionId);
    if (
      !s ||
      !e ||
      !d ||
      e.depth !== c.depth ||
      !inResidentCamp(g, c, e) ||
      !g.grid.getCell(e.x, e.y)?.hasMemory ||
      !recipe.stationTags.every((t) => d.stationTags.includes(t))
    )
      failResident('C5_BAD_REFERENCE');
    if (s!.revision !== p.stationRevision) failResident('C5_STALE');
  } else if (recipe.stationTags.length || p.stationRevision !== null) failResident('C5_GATE');
  if (
    !Array.isArray(p.plotIds) ||
    p.plotIds.length > 6 ||
    new Set(p.plotIds).size !== p.plotIds.length ||
    !Array.isArray(p.plotRevisions) ||
    p.plotRevisions.length !== p.plotIds.length
  )
    failResident('C5_BAD_PAYLOAD');
  if ((recipe.id === 'settlement.farm') !== p.plotIds.length > 0) failResident('C5_BAD_PAYLOAD');
  for (const [index, id] of p.plotIds.entries()) {
    const row = g.world5!.structures.find((s) => s.fixture?.id === id);
    if (
      !row ||
      row.fixture!.definitionId !== 'settlement.plot' ||
      !inResidentCamp(g, c, row.at) ||
      residentPlotReason(g, id)
    )
      failResident('C5_GATE');
    if (row!.fixture!.revision !== p.plotRevisions[index]) failResident('C5_STALE');
    if (
      g.world5!.residentJobs.some((j) => j.plotId === id) ||
      g.world5!.orders.some((o) => o.production?.plotIds.includes(id) && o.actorId !== p.targetId)
    )
      failResident('C5_RESERVED');
  }
  const existing = residentOrderTicket(g, p.targetId);
  if (existing && existing.completedBatches === existing.totalBatches) failResident('C5_BUSY');
  if (existing && existing.completedBatches < existing.totalBatches) {
    if (
      existing.inputEscrowId === null ||
      !g.world5!.containers.some((b) => b.id === existing.inputEscrowId)
    )
      failResident('C5_INPUT');
    const cargo = containerItems(g, existing.inputEscrowId!);
    for (const amount of recipe.inputs) {
      const tag = recipe.id.startsWith('settlement.cook-')
        ? 'food.ingredient.' + recipe.id.slice('settlement.cook-'.length)
        : null;
      const quantity = cargo.reduce(
        (n, i) =>
          n +
          ((
            tag
              ? itemRead(g, i).tags.includes(tag)
              : itemRead(g, i).definitionId === amount.itemDefinitionId
          )
            ? i.quantity
            : 0),
        0
      );
      if (quantity !== amount.count * (existing.totalBatches - existing.completedBatches))
        failResident('C5_INPUT');
    }
    if (
      recipe.toolTag &&
      !cargo.some(
        (i) =>
          itemRead(g, i).tags.includes(recipe.toolTag!) &&
          (i.worldItem?.toolDurability ?? 0) >=
            (existing.totalBatches - existing.completedBatches) *
              (itemDefinition(g, i.worldItem!.definitionId).tool?.durabilityPerBatch ?? 1)
      )
    )
      failResident('C5_TOOL');
  } else {
    const selections = selectedInputs(g, recipe, source.id, p.batchCount);
    if (
      selections.reduce(
        (n, s) => n + (s.item.category === ItemCategory.MATERIAL ? 1 : s.quantity),
        0
      ) > 64
    )
      failResident('C5_CAPACITY');
    const outputSlots = recipe.outputs.reduce((n, a) => n + a.count * p.batchCount, 0),
      refundSlots = selections.reduce(
        (n, s) => n + (s.item.category === ItemCategory.MATERIAL ? 1 : s.quantity),
        0
      );
    const freed = selections.reduce(
      (n, s) =>
        n +
        (s.quantity === s.item.quantity
          ? itemRead(g, s.item).packSlots
          : s.item.category === ItemCategory.MATERIAL
            ? 0
            : s.quantity),
      0
    );
    if (
      containerRead(g, dest.id).occupiedSlots +
        reservedContainerSlots(g, dest.id) +
        outputSlots +
        (source.id === dest.id ? refundSlots - freed : 0) >
        dest.capacity ||
      containerRead(g, source.id).occupiedSlots -
        freed +
        reservedContainerSlots(g, source.id) +
        refundSlots +
        (source.id === dest.id ? outputSlots : 0) >
        source.capacity
    )
      failResident('C5_CAPACITY');
    checkItemBudget(
      g,
      selections.length + recipe.outputs.reduce((n, a) => n + a.count * p.batchCount, 0)
    );
  }
}
function reserveOrderTicket(g: Game, o: EconomicOrder, recipe: RecipeDefinition) {
  const w = g.world5!,
    p = o.production!,
    selections = selectedInputs(g, recipe, p.sourceId, p.batchCount),
    id = allocateWorldId(g),
    escrow = allocateWorldId(g),
    source = w.containers.find((b) => b.id === p.sourceId)!;
  const moved: Item[] = [];
  for (const s of selections) {
    let item = s.item;
    if (s.quantity < item.quantity) {
      const next = new Item(item.name, item.char, item.color, item.category);
      Object.assign(next, serializeItem(item), { id: next.id, quantity: s.quantity });
      if (next.worldItem) bindWorldItem(next, itemDefinition(g, next.worldItem.definitionId));
      item.quantity -= s.quantity;
      item = next;
    } else source.itemIds = source.itemIds.filter((id) => id !== item.id);
    moved.push(item);
    g.worldContainerItems!.set(item.id, item);
  }
  source.revision = checkedAdd(source.revision, 1);
  w.containers.push({
    id: escrow,
    owner: recipe.owner,
    kind: 'escrow',
    levelRef: structuredClone(o.levelRef),
    position: null,
    capacity: 64,
    itemIds: moved.map((i) => i.id),
    revision: 0,
    ticketId: id
  });
  const counts = (amounts: readonly ItemAmount[]) =>
    amounts.map((a) => ({ ...a, count: a.count * p.batchCount }));
  const refundCounts = new Map<string, number>();
  for (const i of moved) {
    const id = itemRead(g, i).definitionId;
    if (!id) failResident('C5_BAD_REFERENCE');
    refundCounts.set(id!, checkedAdd(refundCounts.get(id!) ?? 0, i.quantity));
  }
  w.tickets.push({
    ticketId: id,
    owner: recipe.owner,
    actorId: o.actorId,
    levelRef: structuredClone(o.levelRef),
    kind: 'craft',
    nodeId: null,
    stationId: p.stationId,
    sourceContainerId: p.sourceId,
    definitionId: recipe.id,
    inputEscrowId: escrow,
    outputReservation: {
      destination: { kind: 'container', containerId: p.destinationId },
      slots: recipe.outputs.reduce((n, a) => n + a.count * p.batchCount, 0),
      mergeTargets: [],
      counts: counts(recipe.outputs)
    },
    refundReservation: {
      destination: { kind: 'container', containerId: p.sourceId },
      slots: moved.reduce((n, i) => n + itemRead(g, i).packSlots, 0),
      mergeTargets: [],
      counts: [...refundCounts].map(([itemDefinitionId, count]) => ({ itemDefinitionId, count }))
    },
    resourceReservation: null,
    totalBatches: p.batchCount,
    completedBatches: 0,
    remainingTicks: recipe.workTicks,
    laborCreditTicks: 0,
    bundleActionId: null,
    revision: 0,
    status: 'suspended',
    stopReason: null,
    lastCompletionOrdinal: 0
  });
  o.ticketId = id;
  const actor = residentActors(g).find((a) => a.id === o.actorId)!;
  g.worldWorkDetails!.push({
    ticketId: id,
    at: orderTarget(g, o),
    anchor: { ...actor.loc },
    hp: actor.hp,
    toolId: recipe.toolTag
      ? moved.find((i) => itemRead(g, i).tags.includes(recipe.toolTag!))!.id
      : null,
    workTicks: recipe.workTicks,
    interrupted: null
  });
}
export function commitResidentOrder(g: Game, c: CampRecord, action: string, p: any): void {
  const w = g.world5!;
  if (action === 'cancel-order') {
    cancelResidentOrder(g, p.targetId, 'cancelled');
    return;
  }
  let order = residentOrder(g, p.targetId);
  if (action === 'order-work') {
    order = {
      id: allocateWorldId(g),
      owner: residentRecord(g, p.targetId)!.owner,
      actorId: p.targetId,
      levelRef: { kind: 'dungeon', depth: c.depth },
      definitionId: p.recipeId,
      priority: 0,
      planId: w.nextPlanId,
      remainingEpochs: 32,
      ticketId: null,
      status: 'working',
      stopReason: null,
      revision: 0,
      production: {
        sourceId: p.sourceId,
        destinationId: p.destinationId,
        stationId: p.stationId,
        plotIds: [...p.plotIds],
        batchCount: p.batchCount,
        paidTicks: 0,
        creditRemainder: 0,
        travelRemainingTicks: 0,
        travelPerBatchTicks: 0,
        qualified: true,
        reason: null
      }
    };
    w.orders.push(order);
  } else {
    order!.planId = w.nextPlanId;
    order!.remainingEpochs = 32;
    order!.status = 'working';
    order!.stopReason = null;
    order!.revision++;
    order!.production!.reason = null;
  }
  w.nextPlanId = checkedAdd(w.nextPlanId, 1);
  if (!residentOrderTicket(g, p.targetId)) reserveOrderTicket(g, order!, orderRecipe(g, order!));
  const l = w.offline.find((l) => l.campSlotId === c.slot)!;
  l.productionQuotas ??= [];
  if (!l.productionQuotas.some((q) => q.actorId === p.targetId))
    l.productionQuotas.push({
      actorId: p.targetId,
      day: Math.floor(w.simulationTicks / 32000),
      meat: 0,
      plots: []
    });
  l.productionQuotas.sort((a, b) => a.actorId - b.actorId);
  l.needsResupply = w.orders.some(
    (o) =>
      o.levelRef.kind === 'dungeon' && o.levelRef.depth === c.depth && o.status === 'needs-resupply'
  );
  updateWorldReasons(g);
  markRecordingRoot(w);
}
const receiptBuffers = new WeakMap<Game, WorldReceipt[]>();
const receiptActors = new WeakMap<WorldReceipt, number>();
export const residentReceiptActor = (receipt: WorldReceipt) => receiptActors.get(receipt) ?? 0;
export function withResidentReceiptBuffer<T>(g: Game, buffer: WorldReceipt[], work: () => T): T {
  const old = receiptBuffers.get(g);
  receiptBuffers.set(g, buffer);
  try {
    return work();
  } finally {
    if (old) receiptBuffers.set(g, old);
    else receiptBuffers.delete(g);
  }
}
function receipt(
  g: Game,
  o: EconomicOrder,
  ticketId: number,
  batch: number,
  tick: number,
  result: 'completed' | 'interrupted',
  reason: string | null,
  out?: WorldReceipt[]
) {
  const w = g.world5!,
    receipts = out ?? receiptBuffers.get(g) ?? w.receipts;
  receipts.push({
    owner: o.owner,
    ordinal: checkedAdd(w.receipts[w.receipts.length - 1]?.ordinal ?? 0, 1),
    identity: `production.${ticketId}.${batch}.${result}`,
    kind: 'offline',
    levelRef: structuredClone(o.levelRef),
    tick,
    result,
    reason
  });
  receiptActors.set(receipts[receipts.length - 1]!, o.actorId);
  if (!out && !receiptBuffers.has(g)) w.receipts.splice(0, Math.max(0, w.receipts.length - 128));
}
function retireTicket(g: Game, o: EconomicOrder, cancelled = false) {
  const w = g.world5!,
    t = residentOrderTicket(g, o.actorId);
  if (!t) return;
  const action = t.bundleActionId;
  t.bundleActionId = null;
  if (action !== null) productionActorActionScheduler(g)?.retireBundle(action);
  if (t.inputEscrowId !== null) w.containers = w.containers.filter((b) => b.id !== t.inputEscrowId);
  {
    const recipe = g.extensionRuntime!.worldDefinitionPacks().flatMap((p) => p.recipes)
      .find((r) => r.id === t.definitionId && r.owner === t.owner)!;
    const counts = t.outputReservation!.counts.map((a) => ({
      ...a,
      count: a.count - (recipe.outputs.find((o) => o.itemDefinitionId === a.itemDefinitionId)?.count ?? 0) *
        (t.totalBatches - t.completedBatches)
    }));
    if (counts.some((a) => a.count < 0)) failResident('C5_BAD_REFERENCE');
    const fallbackAt = w.offline.flatMap((l) => l.pendingOutputs)
      .find((p) => p.ticketId === t.ticketId)?.fallbackAt;
    w.terminalTickets.push({
      ticketId: t.ticketId,
      owner: t.owner,
      actorId: t.actorId,
      kind: t.kind,
      definitionId: t.definitionId,
      totalBatches: t.totalBatches,
      completedBatches: t.completedBatches,
      status: cancelled ? 'cancelled' : 'completed',
      stopReason: cancelled ? 'cancelled' : null,
      lastCompletionOrdinal: Math.max(1, t.lastCompletionOrdinal),
      residentOutput: {
        levelRef: structuredClone(o.levelRef),
        destinationId: o.production!.destinationId,
        counts: counts.filter((a) => a.count > 0),
        ...(fallbackAt ? { fallbackAt: { ...fallbackAt } } : {})
      }
    });
    const pending = new Set(w.offline.flatMap((l) => l.pendingOutputs.map((p) => p.ticketId)));
    while (w.terminalTickets.length > 64) {
      const index = w.terminalTickets.findIndex((t) => !pending.has(t.ticketId));
      if (index < 0) failResident('C5_BUDGET');
      w.terminalTickets.splice(index, 1);
    }
  }
  w.tickets = w.tickets.filter((x) => x !== t);
  g.worldWorkDetails = g.worldWorkDetails!.filter((d) => d.ticketId !== t.ticketId);
  o.ticketId = null;
}
export function publishResidentOutputs(g: Game, l: OfflineLedger, epoch: number): void {
  const due = l.pendingOutputs.filter((p) => p.availableEpoch <= epoch);
  for (const p of due) {
    const o = g.world5!.orders.find((o) => o.ticketId === p.ticketId && o.production);
    const t = g.world5!.tickets.find((t) => t.ticketId === p.ticketId);
    const retired = g.world5!.terminalTickets.find((t) => t.ticketId === p.ticketId);
    const outstanding = t?.outputReservation?.counts ?? retired?.residentOutput?.counts;
    if (
      (!o && !retired?.residentOutput) || !outstanding ||
      p.items.some((a) => (outstanding.find((c) => c.itemDefinitionId === a.itemDefinitionId)?.count ?? 0) < a.count)
    )
      failResident('C5_BAD_REFERENCE');
    if (p.fallbackAt) {
      const depth = (l.levelRef as { depth: number }).depth,
        items = depth === activeResidentDepth(g) ? g.items : g.levels.get(depth)?.items;
      if (!items) failResident('C5_BAD_REFERENCE');
      for (const amount of p.items)
        for (const fake of amountStacks(g, [amount])) {
          const item = assembleWorldItem(itemDefinition(g, amount.itemDefinitionId), fake.quantity);
          item.loc = { ...p.fallbackAt };
          items!.push(item);
        }
    } else
      withPublishingTicket(g, p.ticketId, () => createOutputs(g, p.items, p.destinationId, true));
    for (const a of p.items)
      outstanding!.find((c) => c.itemDefinitionId === a.itemDefinitionId)!.count -= a.count;
    if (t) {
      t.outputReservation!.counts = outstanding!.filter((c) => c.count > 0);
      t.outputReservation!.slots = Math.max(
        0,
        t.outputReservation!.slots - p.items.reduce((n, a) => n + a.count, 0)
      );
    } else retired!.residentOutput!.counts = outstanding!.filter((c) => c.count > 0);
  }
  l.pendingOutputs = l.pendingOutputs.filter((p) => p.availableEpoch > epoch);
  for (const o of g.world5!.orders.filter(
    (o) =>
      o.production &&
      o.ticketId !== null &&
      o.levelRef.kind === 'dungeon' &&
      l.levelRef.kind === 'dungeon' &&
      o.levelRef.depth === l.levelRef.depth
  )) {
    const t = residentOrderTicket(g, o.actorId)!;
    if (
      t.completedBatches === t.totalBatches &&
      !l.pendingOutputs.some((p) => p.ticketId === t.ticketId)
    ) {
      // Tools and unused escrow have one refund owner, even on successful completion.
      refundOrder(g, o);
      retireTicket(g, o);
    }
  }
}
function refundOrder(g: Game, o: EconomicOrder) {
  const t = residentOrderTicket(g, o.actorId);
  if (!t || t.inputEscrowId === null) return;
  const cargo = g.world5!.containers.find((b) => b.id === t.inputEscrowId)!;
  withPublishingTicket(g, t.ticketId, () => {
    const source = g.world5!.containers.find((b) => b.id === o.production!.sourceId);
    for (const i of containerItems(g, cargo.id).slice()) {
      if (source) putContainer(g, source.id, i);
      else {
        const items =
          o.levelRef.kind === 'dungeon' && o.levelRef.depth === g.depth
            ? g.items
            : g.levels.get((o.levelRef as { depth: number }).depth)?.items;
        if (!items) failResident('C5_BAD_REFERENCE');
        i.loc = { ...g.worldWorkDetails!.find((d) => d.ticketId === t.ticketId)!.anchor };
        items!.push(i);
        g.worldContainerItems!.delete(i.id);
      }
    }
  });
  cargo.itemIds = [];
}
export function cancelResidentOrder(
  g: Game,
  id: number,
  reason: string,
  occurredTick?: number
): void {
  const o = residentOrder(g, id);
  if (!o) return;
  transactResidentWorld(g, () => {
    const l = g.world5!.offline.find((l) => l.residentStates.some((s) => s.actorId === id));
    // Cancellation never makes this epoch's output available early.
    void l;
    const t = residentOrderTicket(g, id);
    if (t) {
      refundOrder(g, o);
      receipt(
        g,
        o,
        t.ticketId,
        t.completedBatches,
        occurredTick ?? g.world5!.simulationTicks,
        'interrupted',
        reason
      );
      retireTicket(g, o, true);
    }
    g.world5!.orders = g.world5!.orders.filter((x) => x !== o);
    if (l)
      l.needsResupply = g.world5!.orders.some(
        (o) =>
          o.levelRef.kind === 'dungeon' &&
          l.levelRef.kind === 'dungeon' &&
          o.levelRef.depth === l.levelRef.depth &&
          o.status === 'needs-resupply'
      );
    updateWorldReasons(g);
    markRecordingRoot(g.world5!);
  });
}
export function settleResidentOrderEpoch(
  g: Game,
  c: CampRecord,
  l: OfflineLedger,
  from: number,
  to: number,
  catalog: readonly RecipeDefinition[]
): void {
  const w = g.world5!,
    boundary = Math.floor(to / 1000) > Math.floor(from / 1000);
  for (const o of w.orders
    .filter((o) => o.production && o.levelRef.kind === 'dungeon' && o.levelRef.depth === c.depth)
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        a.definitionId.localeCompare(b.definitionId) ||
        a.actorId - b.actorId ||
        a.id - b.id
    )) {
    const t = residentOrderTicket(g, o.actorId);
    if (!t || !o.remainingEpochs || o.stopReason === 'completed') continue;
    const p = o.production!,
      r = residentComponent(g, o.actorId),
      need = l.residentStates.find((n) => n.actorId === o.actorId)!;
    if (
      c.depth !== activeResidentDepth(g) &&
      o.status === 'working' &&
      p.qualified &&
      r?.mode === 'stay'
    ) {
      let ticks = scheduledWorkTicks(from, to, r.schedule[0]);
      const travel = Math.min(ticks, p.travelRemainingTicks);
      p.travelRemainingTicks -= travel;
      ticks -= travel;
      p.paidTicks = checkedAdd(p.paidTicks, ticks);
    }
    if (!boundary) continue;
    if (c.depth === activeResidentDepth(g)) qualifyOrder(g, o);
    const recipe =
      catalog.find((r) => r.id === o.definitionId && r.offlineEligible) ??
      failResident('C5_PROVIDER');
    const quota = l.productionQuotas!.find((q) => q.actorId === o.actorId)!;
    if (recipe.id === 'settlement.farm') {
      const state = g.extensionRuntime!.worldCampState(o.owner),
        day = Math.floor(to / 32000);
      if (quota.day !== day) {
        quota.day = day;
        quota.meat = 0;
        quota.plots = [];
      }
      quota.plots = [
        ...new Set([
          ...quota.plots,
          ...state.plotDays
            .filter((q) => q.day === day && p.plotIds.includes(q.componentId))
            .map((q) => q.componentId)
        ])
      ];
    }
    const plan = planResidentProductionEpoch({
      epoch: Math.floor(to / 1000),
      offline: c.depth !== activeResidentDepth(g),
      order: o,
      ticket: t,
      recipe,
      need,
      quota,
      escrow: containerItems(g, t.inputEscrowId!).map((i) => ({
        id: i.id,
        quantity: i.quantity,
        definitionId: itemRead(g, i).definitionId,
        tags: [...itemRead(g, i).tags]
      }))
    });
    Object.assign(o, plan.order);
    Object.assign(t, plan.ticket);
    Object.assign(quota, plan.quota);
    const cargo = w.containers.find((b) => b.id === t.inputEscrowId)!;
    for (const debit of plan.debits) {
      const item = g.worldContainerItems!.get(debit.itemId)!;
      item.quantity -= debit.quantity;
      if (!item.quantity) {
        cargo.itemIds = cargo.itemIds.filter((id) => id !== item.id);
        g.worldContainerItems!.delete(item.id);
      }
    }
    if (plan.outputs.length) {
      if (recipe.id === 'settlement.farm') {
        const state = g.extensionRuntime!.worldCampState(o.owner);
        for (const id of quota.plots) {
          state.plotDays = state.plotDays.filter((q) => q.componentId !== id);
          state.plotDays.push({ componentId: id, day: quota.day });
        }
        state.revision = checkedAdd(state.revision, 1);
        g.extensionRuntime!.worldCampReplace(o.owner, state);
      }
      if (recipe.toolTag) {
        const detail = g.worldWorkDetails!.find((d) => d.ticketId === t.ticketId)!,
          tool = g.worldContainerItems!.get(detail.toolId!)!,
          cost = itemDefinition(g, tool.worldItem!.definitionId).tool!.durabilityPerBatch;
        tool.worldItem!.toolDurability! -= cost * (plan.outputs.length / recipe.outputs.length);
      }
      cargo.revision = checkedAdd(cargo.revision, 1);
      const counts = new Map<string, number>();
      for (const item of containerItems(g, cargo.id)) {
        const id = itemRead(g, item).definitionId!;
        counts.set(id, checkedAdd(counts.get(id) ?? 0, item.quantity));
      }
      t.refundReservation!.counts = [...counts].map(([itemDefinitionId, count]) => ({
        itemDefinitionId,
        count
      }));
      l.pendingOutputs.push({
        ticketId: t.ticketId,
        availableEpoch: Math.floor(to / 1000) + 1,
        destinationId: p.destinationId,
        items: plan.outputs
      });
      receipt(g, o, t.ticketId, t.completedBatches, to, 'completed', null);
      recordWorldFact(g, {
        owner: t.owner,
        ticketId: t.ticketId,
        completionOrdinal: t.lastCompletionOrdinal,
        operation: 'craft-batch',
        definitionId: t.definitionId,
        actorId: t.actorId,
        completedBatches: t.completedBatches,
        result: 'completed',
        reason: null,
        tick: to
      });
    }
    if (o.status !== 'working') suspendOrderClock(g, o);
  }
  l.needsResupply = w.orders.some(
    (o) =>
      o.production &&
      o.levelRef.kind === 'dungeon' &&
      o.levelRef.depth === c.depth &&
      o.status === 'needs-resupply'
  );
  markRecordingRoot(w);
}
export function stopResidentOrder(g: Game, id: number, reason: string): void {
  const o = residentOrder(g, id);
  if (!o || (o.status === 'stopped' && o.stopReason === reason)) return;
  transactResidentWorld(g, () => {
    o.status = 'stopped';
    o.stopReason = reason;
    o.revision = checkedAdd(o.revision, 1);
    o.production!.paidTicks = 0;
    o.production!.qualified = false;
    o.production!.reason = reason;
    suspendOrderClock(g, o);
    markRecordingRoot(g.world5!);
  });
}
function suspendOrderClock(g: Game, o: EconomicOrder) {
  const t = residentOrderTicket(g, o.actorId);
  if (!t) return;
  const id = t.bundleActionId;
  t.bundleActionId = null;
  t.status = 'suspended';
  if (id !== null) productionActorActionScheduler(g)?.retireBundle(id);
}
export function qualifyOrder(g: Game, o: EconomicOrder): void {
  const p = o.production!,
    a = g.monsters.find((a) => a.id === o.actorId),
    r = residentComponent(g, o.actorId),
    target = orderTarget(g, o);
  let reason: string | null = null;
  if (!a || !r || r.mode !== 'stay' || residentDisabled(a)) reason = 'resident-unavailable';
  else if (residentHasNativePriority(g, a)) reason = 'danger';
  else if (!target) reason = 'target-removed';
  else if (p.plotIds.some((id) => residentPlotReason(g, id))) reason = 'plot';
  else if (
    p.stationId !== null &&
    !g.world5!.stations.some((s) => s.interactableId === p.stationId)
  )
    reason = 'target-removed';
  p.qualified = reason === null;
  p.reason = reason;
}
export function freezeResidentOrders(g: Game, depth: number): void {
  for (const o of g.world5?.orders.filter(
    (o) => o.production && o.levelRef.kind === 'dungeon' && o.levelRef.depth === depth
  ) ?? []) {
    qualifyOrder(g, o);
    const a = g.monsters.find((a) => a.id === o.actorId),
      target = orderTarget(g, o);
    const distance =
      a && target ? Math.max(Math.abs(a.x - target.x), Math.abs(a.y - target.y)) : 30000;
    o.production!.travelRemainingTicks = Math.max(0, distance - 1) * (a?.movementSpeed ?? 100);
    if (a && target) {
      o.production!.travelPerBatchTicks = 0;
      const points = o
        .production!.plotIds.map((id) => g.world5!.structures.find((s) => s.fixture?.id === id)?.at)
        .filter((p): p is { x: number; y: number } => !!p);
      for (const to of points) {
        const map = residentDistanceMap(g, to, 0);
        for (const from of points) {
          const d = map[from.x]?.[from.y] ?? 30000;
          if (d >= 30000) {
            o.production!.qualified = false;
            o.production!.reason = 'route';
          } else
            o.production!.travelPerBatchTicks = Math.max(
              o.production!.travelPerBatchTicks,
              Math.max(0, d - 2) * a.movementSpeed
            );
        }
      }
      const map = residentDistanceMap(g, target, 0);
      const distance = map[a.x]?.[a.y] ?? 30000;
      if (distance >= 30000) {
        o.production!.qualified = false;
        o.production!.reason = 'route';
      }
      o.production!.travelRemainingTicks = Math.max(0, distance - 1) * a.movementSpeed;
    }
  }
}
export function suspendResidentOrdersForExit(g: Game, depth: number): void {
  for (const o of g.world5?.orders.filter(
    (o) => o.production && o.levelRef.kind === 'dungeon' && o.levelRef.depth === depth
  ) ?? [])
    suspendOrderClock(g, o);
}
export function selectResidentOrderDecision(g: Game, id: number): boolean {
  const o = residentOrder(g, id);
  if (!o) return false;
  const a = g.monsters.find((a) => a.id === id)!,
    t = residentOrderTicket(g, id),
    r = residentComponent(g, id)!;
  if (
    !t ||
    o.status !== 'working' ||
    t.bundleActionId !== null ||
    !o.remainingEpochs ||
    Math.floor(g.world5!.simulationTicks / 1000) % 32 >= r.schedule[0]
  ) {
    a.ticksUntilTurn = a.movementSpeed;
    return true;
  }
  qualifyOrder(g, o);
  if (!o.production!.qualified) {
    o.status = 'stopped';
    o.stopReason = o.production!.reason;
    a.ticksUntilTurn = a.movementSpeed;
    return true;
  }
  const need = g.world5!.offline.flatMap((l) => l.residentStates).find((n) => n.actorId === id)!;
  if (!residentEfficiency(need)) {
    a.ticksUntilTurn = a.movementSpeed;
    return true;
  }
  const target = orderTarget(g, o)!;
  if (stepResident(g, a, target)) {
    return true;
  }
  const d = g.worldWorkDetails!.find((d) => d.ticketId === t.ticketId)!;
  d.anchor = { ...a.loc };
  d.hp = a.hp;
  d.at = { ...target };
  d.interrupted = null;
  const duration = 1000 - (g.world5!.simulationTicks % 1000),
    action = g.actorActions!.nextActionId;
  g.actorActions!.nextActionId = checkedAdd(action, 1);
  t.bundleActionId = action;
  t.status = 'working';
  productionActorActionScheduler(g)!.commitBundle(
    createActorActionBundle({
      owner: 'foundation',
      actionId: action,
      depth: g.depth,
      decisionOwnerId: id,
      timeChargeOwnerId: id,
      subactions: [
        {
          sourceEntityId: id,
          sourcePartId: 'body',
          sourceFootprintVersion: sourceFootprintVersion(g.spatialOf(a)),
          phases: [{ kind: 'recovery', durationTicks: duration, segmentIndex: null }]
        }
      ]
    })
  );
  markRecordingRoot(g.world5!);
  return true;
}
export function advanceResidentOrderLabor(g: Game, dt: number): void {
  for (const o of g.world5?.orders.filter((o) => o.production && o.status === 'working') ?? []) {
    const t = residentOrderTicket(g, o.actorId),
      a = g.monsters.find((a) => a.id === o.actorId),
      d = t && g.worldWorkDetails!.find((d) => d.ticketId === t.ticketId),
      r = residentComponent(g, o.actorId);
    if (
      t?.bundleActionId === null ||
      !t ||
      !a ||
      !d ||
      !r ||
      residentDisabled(a) ||
      a.hp < d.hp ||
      a.x !== d.anchor.x ||
      a.y !== d.anchor.y ||
      unsafeResidentCell(g, a.loc)
    )
      continue;
    o.production!.paidTicks = checkedAdd(
      o.production!.paidTicks,
      scheduledWorkTicks(g.world5!.simulationTicks, g.world5!.simulationTicks + dt, r.schedule[0])
    );
  }
}
export function residentOrderClockFinished(
  g: Game,
  b: ReadonlyActorActionBundle,
  reason: string
): boolean {
  const o = g.world5?.orders.find(
    (o) => o.production && residentOrderTicket(g, o.actorId)?.bundleActionId === b.actionId
  );
  if (!o) return false;
  const t = residentOrderTicket(g, o.actorId)!;
  t.bundleActionId = null;
  t.status = 'suspended';
  if (reason !== 'completed') {
    o.status = 'stopped';
    o.stopReason = reason;
    o.production!.paidTicks = 0;
  }
  markRecordingRoot(g.world5!);
  return true;
}
