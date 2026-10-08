/** Validate the unique production roots before decoding/publishing a save candidate. */
import type { Game } from './Game';
import { World5Error, levelKey } from '../../ext/worldBasics';
import { residentRecipeCatalog, residentOrderTicket } from './ResidentOrders';
import { residentComponent, residentRecord, campBox } from './ResidentWorld';
import { containerItems, itemRead, containerRead, reservedContainerSlots } from './WorldWorkWorld';
export function validateResidentOrderReferences(g: Game): void {
  const w = g.world5!,
    rt = g.extensionRuntime!;
  const fail = (field: string): never => {
    throw new World5Error('C5_BAD_REFERENCE', 'production.' + field);
  };
  const orders = w.orders.filter(
    (o) => o.production || residentRecord(g, o.actorId) || residentComponent(g, o.actorId)
  );
  // Identify resident orders before using their optional progress as a discriminator.
  for (const o of orders) if (!o.production) fail('progress');
  const actors = new Set<number>(),
    plots = new Set<number>(),
    catalog = orders.length ? residentRecipeCatalog(g) : [];
  for (const o of orders) {
    const p = o.production!,
      r = residentComponent(g, o.actorId),
      rec = residentRecord(g, o.actorId),
      c = rt.worldCampState(o.owner).camps.find((c) => c.regionId === r?.campId),
      l = w.offline.find((l) => l.campSlotId === rec?.campSlotId),
      recipe = catalog.find((r) => r.id === o.definitionId && r.offlineEligible) ?? fail('recipe');
    if (
      actors.has(o.actorId) ||
      !r ||
      !rec ||
      rec.owner !== o.owner ||
      !c ||
      r.mode !== 'stay' ||
      o.levelRef.kind !== 'dungeon' ||
      o.levelRef.depth !== c.depth ||
      !l?.productionQuotas?.some((q) => q.actorId === o.actorId)
    )
      fail('home');
    actors.add(o.actorId);
    campBox(g, c!, p.sourceId);
    campBox(g, c!, p.destinationId);
    if ((recipe.id === 'settlement.farm') !== p.plotIds.length > 0) fail('plots');
    for (const id of p.plotIds) {
      if (
        plots.has(id) ||
        !w.structures.some(
          (s) =>
            s.regionId === c!.regionId &&
            s.fixture?.id === id &&
            s.fixture.definitionId === 'settlement.plot'
        )
      )
        fail('plot');
      plots.add(id);
    }
    if (recipe.stationTags.length) {
      const s = w.stations.find((s) => s.interactableId === p.stationId),
        d = rt
          .worldDefinitionPacks()
          .flatMap((p) => p.stations)
          .find((d) => d.id === s?.definitionId);
      if (
        !s ||
        !d ||
        !recipe.stationTags.every((t) => d.stationTags.includes(t)) ||
        s.levelRef.kind !== 'dungeon' ||
        s.levelRef.depth !== c!.depth
      )
        fail('station');
    }
    if (
      (o.status === 'needs-resupply') !==
      (o.remainingEpochs === 0 && o.stopReason === 'needs-resupply')
    )
      fail('budget');
    const t = residentOrderTicket(g, o.actorId);
    if (!t) {
      if (o.stopReason !== 'completed') fail('ticket');
      continue;
    }
    if (
      t.owner !== recipe.owner ||
      t.definitionId !== recipe.id ||
      t.actorId !== o.actorId ||
      t.totalBatches !== p.batchCount ||
      t.kind !== 'craft' ||
      t.stationId !== p.stationId ||
      t.sourceContainerId !== p.sourceId ||
      t.inputEscrowId === null ||
      t.remainingTicks !== recipe.workTicks ||
      t.outputReservation?.destination.kind !== 'container' ||
      t.outputReservation.destination.containerId !== p.destinationId ||
      t.refundReservation?.destination.kind !== 'container' ||
      t.refundReservation.destination.containerId !== p.sourceId
    )
      fail('ticket');
    if (t.laborCreditTicks >= recipe.workTicks) fail('labor');
    if (t.outputReservation!.slots !== t.outputReservation!.counts.reduce((n, a) => n + a.count, 0))
      fail('slots');
    const cargo = containerItems(g, t.inputEscrowId!);
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
      if (quantity !== amount.count * (t.totalBatches - t.completedBatches)) fail('escrow');
    }
    for (const i of cargo) {
      const read = itemRead(g, i);
      if (
        !(recipe.toolTag && read.tags.includes(recipe.toolTag)) &&
        !recipe.inputs.some((a) =>
          recipe.id.startsWith('settlement.cook-')
            ? read.tags.includes('food.ingredient.' + recipe.id.slice('settlement.cook-'.length))
            : read.definitionId === a.itemDefinitionId
        )
      )
        fail('extraInput');
    }
    if (recipe.toolTag) {
      const d = g.worldWorkDetails!.find((d) => d.ticketId === t.ticketId);
      if (!cargo.some((i) => i.id === d?.toolId && itemRead(g, i).tags.includes(recipe.toolTag!)))
        fail('tool');
    }
    const pending = l!.pendingOutputs.filter((p) => p.ticketId === t.ticketId);
    for (const a of recipe.outputs) {
      const reserved =
        t.outputReservation!.counts.find((c) => c.itemDefinitionId === a.itemDefinitionId)?.count ??
        0;
      const delayed = pending.reduce(
        (n, p) =>
          n +
          p.items
            .filter((i) => i.itemDefinitionId === a.itemDefinitionId)
            .reduce((n, i) => n + i.count, 0),
        0
      );
      if (reserved !== a.count * (t.totalBatches - t.completedBatches) + delayed)
        fail('outputReservation');
    }
    for (const pending of l!.pendingOutputs.filter((p) => p.ticketId === t.ticketId))
      if (
        pending.destinationId !== p.destinationId ||
        pending.items.some(
          (a) => !recipe.outputs.some((o) => o.itemDefinitionId === a.itemDefinitionId)
        )
      )
        fail('pending');
  }
  for (const l of w.offline)
    for (const pending of l.pendingOutputs) {
      const t =
        w.tickets.find((t) => t.ticketId === pending.ticketId) ??
        w.terminalTickets.find((t) => t.ticketId === pending.ticketId);
      const retired = w.terminalTickets.find((t) => t.ticketId === pending.ticketId);
      if (retired) {
        const r = retired.residentOutput;
        if (
          !r ||
          levelKey(r.levelRef) !== levelKey(l.levelRef) ||
          r.destinationId !== pending.destinationId ||
          r.fallbackAt?.x !== pending.fallbackAt?.x ||
          r.fallbackAt?.y !== pending.fallbackAt?.y
        ) fail('pendingDestination');
      } else if (!orders.some((o) => o.ticketId === pending.ticketId)) fail('pendingOwner');
      if (pending.fallbackAt) {
        const depth = (l.levelRef as { depth: number }).depth,
          grid = depth === g.depth ? g.grid : g.levels.get(depth)?.grid;
        if (
          !grid?.isValidPos(pending.fallbackAt.x, pending.fallbackAt.y) ||
          w.containers.some((c) => c.id === pending.destinationId)
        )
          fail('fallback');
      }
      const recipe = rt
        .worldDefinitionPacks()
        .flatMap((p) => p.recipes)
        .find((r) => r.id === t?.definitionId && r.owner === t?.owner);
      if (
        !t ||
        !recipe ||
        !recipe.offlineEligible ||
        pending.items.some(
          (a) => !recipe.outputs.some((o) => o.itemDefinitionId === a.itemDefinitionId)
        )
      )
        fail('pendingOwner');
      const same = l.pendingOutputs.filter((p) => p.ticketId === pending.ticketId);
      for (const amount of recipe!.outputs) {
        const total = same.reduce(
          (n, p) =>
            n +
            p.items
              .filter((a) => a.itemDefinitionId === amount.itemDefinitionId)
              .reduce((n, a) => n + a.count, 0),
          0
        );
        if (total > amount.count * t!.completedBatches) fail('pendingQuantity');
      }
    }
  for (const t of w.terminalTickets) {
    const r = t.residentOutput;
    if (!r) continue;
    const recipe = rt.worldDefinitionPacks().flatMap((p) => p.recipes)
      .find((d) => d.id === t.definitionId && d.owner === t.owner && d.offlineEligible);
    if (!recipe || t.kind !== 'craft' || r.counts.some(
      (a) => !recipe.outputs.some((o) => o.itemDefinitionId === a.itemDefinitionId)
    )) fail('terminalRecipe');
    const pending = w.offline.flatMap((l) => l.pendingOutputs).filter((p) => p.ticketId === t.ticketId);
    for (const amount of recipe!.outputs) {
      const count = r.counts.find((a) => a.itemDefinitionId === amount.itemDefinitionId)?.count ?? 0;
      const delayed = pending.reduce((n, p) => n + p.items.reduce(
        (n, a) => n + (a.itemDefinitionId === amount.itemDefinitionId ? a.count : 0), 0
      ), 0);
      if (count !== delayed || count > amount.count * t.completedBatches) fail('terminalOutput');
    }
  }
  for (const b of w.containers.filter((b) => b.kind === 'chest'))
    if (containerRead(g, b.id).occupiedSlots + reservedContainerSlots(g, b.id) > b.capacity)
      fail('capacity');
}
