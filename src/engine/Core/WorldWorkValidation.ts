import { exact, uint, World5Error } from '../../ext/world5';
import type { Game } from './Game';
import { forEachItemRoot } from './WorldItemRoots';
import { bindWorldItem } from '../Items/WorldItems';
import { ItemCategory } from '../Items/Item';
const fail = (field: string): never => {
  throw new World5Error('C5_BAD_REFERENCE', field);
};
/** Use exactly the same native root enumeration on save and candidate load. */
export function validateWorldWorkReferences(game: Game): void {
  const w = game.world5;
  if (!w) return;
  const runtime = game.extensionRuntime!,
    packs = runtime.worldDefinitionPacks(),
    entities = runtime.worldWorkEntities();
  if (
    JSON.stringify(Object.entries(w.definitionsFingerprint).sort()) !==
    JSON.stringify(Object.entries(runtime.worldDefinitionFingerprints()).sort())
  )
    fail('definitionsFingerprint');
  for (const t of w.terminalTickets) {
    const pack = packs.find((p) => p.items.some((i) => i.owner === t.owner));
    const definitions =
      t.kind === 'craft'
        ? pack?.recipes
        : t.kind === 'harvest'
          ? pack?.resourceNodes
          : t.kind === 'station'
            ? pack?.stations
            : undefined;
    if (!definitions?.some((d) => d.id === t.definitionId && d.owner === t.owner))
      fail('terminal definition');
  }
  const auto = (game as unknown as { autoAction: unknown }).autoAction as any;
  if (auto?.kind === 'auto_work') {
    exact(auto, 'kind,ticketId', 'auto_work');
    uint(auto.ticketId, 'ticketId', 1);
    const t = w.tickets.find((t) => t.ticketId === auto.ticketId);
    if (
      !t ||
      t.status !== 'working' ||
      t.actorId !== game.player.id ||
      t.totalBatches <= 1 ||
      t.completedBatches >= t.totalBatches
    )
      fail('auto_work');
  }
  if (
    w.tickets.some(
      (t) =>
        t.actorId === game.player.id &&
        t.status === 'working' &&
        t.totalBatches > 1 &&
        (!auto || auto.kind !== 'auto_work' || auto.ticketId !== t.ticketId)
    )
  )
    fail('missing auto_work');
  const internal = game as unknown as {
    levels: Map<number, { monsters: any[]; dormantMonsters?: any[] }>;
    pendingFallenByDepth: Map<number, any[]>;
  };
  const actors = [
    game.player,
    ...game.monsters,
    ...(game.dormantMonsters ?? []),
    ...[...internal.levels].flatMap(([, l]) => [...l.monsters, ...(l.dormantMonsters ?? [])]),
    ...[...internal.pendingFallenByDepth].flatMap(([, a]) => a),
    ...game.purgatory
  ];
  const definitions = packs.flatMap((p) => p.items),
    seen = new Set<number>();
  forEachItemRoot(game, (item) => {
    if (seen.has(item.id)) throw new World5Error('C5_BAD_OWNERSHIP');
    seen.add(item.id);
    if (item.category === ItemCategory.MATERIAL) {
      const f = item.worldItem,
        d = definitions.find((d) => d.id === f?.definitionId);
      if (!f || !d) throw new World5Error('C5_BAD_REFERENCE', 'worldItem');
      exact(f, 'definitionId,quality,toolDurability', 'worldItem');
      if (
        f.quality !== 'basic' ||
        d.category === 'native' ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > d.maxStack ||
        (d.tool
          ? f.toolDurability === null ||
            !Number.isSafeInteger(f.toolDurability) ||
            f.toolDurability < 0 ||
            f.toolDurability > d.tool!.maxDurability
          : f.toolDurability !== null)
      )
        fail('worldItem fields');
      bindWorldItem(item, d);
    } else if (Object.prototype.hasOwnProperty.call(item, 'worldItem')) fail('native.worldItem');
  });
  for (const n of w.nodes) {
    const d = packs
        .flatMap((p) => p.resourceNodes)
        .find((d) => d.id === n.definitionId && d.owner === n.owner),
      e = entities.find((e) => e.id === n.interactableId);
    if (
      !d ||
      !e ||
      e.owner !== n.owner ||
      e.contentId !== n.definitionId ||
      e.depth !== (n.levelRef as any).depth ||
      e.x !== n.at.x ||
      e.y !== n.at.y ||
      n.capacity !== d.capacity ||
      (n.remaining === n.capacity && n.regenRemainder !== 0) ||
      (d.regeneration.kind === 'none' && n.regenRemainder !== 0) ||
      (d.regeneration.kind === 'periodic' && n.regenRemainder >= d.regeneration.intervalTicks)
    )
      fail('node closure');
  }
  for (const s of w.stations)
    if (
      !packs
        .flatMap((p) => p.stations)
        .some((d) => d.id === s.definitionId && d.owner === s.owner) ||
      !entities.some(
        (e) =>
          e.id === s.interactableId &&
          e.owner === s.owner &&
          e.contentId === s.definitionId &&
          e.depth === (s.levelRef as any).depth
      )
    )
      fail('station closure');
  for (const c of w.containers) {
    if (
      containerItemsForValidation(game, c.id).reduce(
        (sum, item) =>
          sum +
          (item.category === 13 || item.category === 0 || item.category === 12 ? 1 : item.quantity),
        0
      ) > c.capacity
    )
      fail('container slots');
  }
  for (const c of w.containers)
    if (
      c.position &&
      !entities.some(
        (e) =>
          e.id === (c.position as { interactableId: number }).interactableId &&
          e.owner === c.owner &&
          e.depth === (c.levelRef as any).depth
      )
    )
      fail('container closure');
  if (
    !Array.isArray(game.worldWorkDetails) ||
    !Array.isArray(game.worldWorkFacts) ||
    game.worldWorkFacts.length > 128 * packs.length
  )
    fail('world work roots');
  const detailIds = new Set<number>();
  for (const d of game.worldWorkDetails!) {
    exact(d, 'ticketId,at,anchor,hp,toolId,workTicks,interrupted', 'workDetail');
    uint(d.ticketId, 'ticketId', 1);
    uint(d.hp, 'hp', 1);
    uint(d.workTicks, 'workTicks', 1);
    if (
      d.workTicks > 10000 ||
      detailIds.has(d.ticketId) ||
      !w.tickets.some(
        (t) => t.ticketId === d.ticketId && ['working', 'suspended'].includes(t.status)
      )
    )
      fail('workDetail');
    detailIds.add(d.ticketId);
    exact(d.anchor, 'x,y', 'anchor');
    uint(d.anchor.x, 'x');
    uint(d.anchor.y, 'y');
    if (d.at) {
      exact(d.at, 'x,y', 'at');
      uint(d.at.x, 'x');
      uint(d.at.y, 'y');
    }
    if (d.toolId !== null) uint(d.toolId, 'toolId', 1);
    if (d.interrupted !== null && typeof d.interrupted !== 'string') fail('interruption');
  }
  const nextFactId = runtime.snapshot().foundation.nextFactId;
  let previousFact = 0;
  const ownerFacts = new Map<string, number>();
  for (const f of game.worldWorkFacts!) {
    exact(
      f,
      'factId,owner,ticketId,completionOrdinal,operation,definitionId,actorId,completedBatches,result,reason,tick',
      'workFact'
    );
    uint(f.factId, 'factId', 1);
    if (
      f.factId <= previousFact ||
      f.factId >= nextFactId ||
      !packs.some((p) => p.items.some((i) => i.owner === f.owner))
    )
      fail('workFact');
    previousFact = f.factId;
    ownerFacts.set(f.owner, (ownerFacts.get(f.owner) ?? 0) + 1);
    if (ownerFacts.get(f.owner)! > 128) fail('owner facts');
    uint(f.actorId, 'actorId', 1);
    uint(f.completionOrdinal, 'completionOrdinal');
    uint(f.completedBatches, 'completedBatches');
    if (
      !['harvest', 'craft-batch', 'place-station', 'cancel', 'startup'].includes(f.operation) ||
      !['accepted', 'completed', 'interrupted', 'skipped'].includes(f.result) ||
      (f.reason !== null && typeof f.reason !== 'string')
    )
      fail('workFact values');
    const pack = packs.find((p) => p.items.some((i) => i.owner === f.owner))!;
    const definition =
      f.operation === 'startup'
        ? pack.items
        : f.operation === 'harvest'
          ? pack.resourceNodes
          : f.operation === 'craft-batch'
            ? pack.recipes
            : f.operation === 'place-station'
              ? pack.stations
              : [...pack.resourceNodes, ...pack.recipes, ...pack.stations];
    if (!definition.some((d) => d.id === f.definitionId && d.owner === f.owner))
      fail('workFact definition');
    if (
      f.result === 'accepted' &&
      (f.ticketId === null ||
        f.operation === 'cancel' ||
        f.completedBatches !== 0 ||
        f.completionOrdinal !== 0 ||
        f.reason !== null)
    )
      fail('accepted fact');
    if (f.ticketId === null) {
      if (
        f.operation !== 'startup' ||
        f.completedBatches !== 0 ||
        f.completionOrdinal !== 0 ||
        !w.startupGrants.some((g) => g.owner === f.owner) ||
        !definitions.some((d) => d.id === f.definitionId && d.owner === f.owner)
      )
        fail('startup fact');
    } else {
      uint(f.ticketId, 'ticketId', 1);
      const t =
        w.tickets.find((t) => t.ticketId === f.ticketId) ??
        w.terminalTickets.find((t) => t.ticketId === f.ticketId);
      if (
        f.ticketId >= w.nextWorldId ||
        (t &&
          (f.owner !== t.owner ||
            f.actorId !== t.actorId ||
            f.definitionId !== t.definitionId ||
            f.completedBatches > t.completedBatches ||
            f.completionOrdinal > t.lastCompletionOrdinal)) ||
        f.operation === 'startup'
      )
        fail('workFact closure');
    }
    uint(f.tick, 'factTick');
    if (f.tick > w.simulationTicks) fail('workFact');
  }
  for (const t of w.tickets) {
    const pack = packs.find((p) =>
      [...p.items, ...p.resourceNodes, ...p.stations, ...p.recipes].some((d) => d.owner === t.owner)
    );
    if (
      !pack ||
      (t.kind === 'craft'
        ? !pack.recipes.some((r) => r.id === t.definitionId)
        : t.kind === 'harvest'
          ? !pack.resourceNodes.some((r) => r.id === t.definitionId)
          : t.kind === 'station'
            ? !pack.stations.some((r) => r.id === t.definitionId)
            : true)
    )
      fail('ticket definition');
    if (
      ['working', 'suspended'].includes(t.status) &&
      (!detailIds.has(t.ticketId) || !actors.some((a) => a.id === t.actorId && a.hp > 0))
    )
      fail('missing workDetail');
    for (const r of [t.outputReservation, t.refundReservation])
      if (r) {
        const destination = r.destination;
        const items =
          destination.kind === 'inventory'
            ? game.player.inventory.items
            : w.containers
                .find(
                  (c) => c.id === (destination.kind === 'container' ? destination.containerId : -1)
                )
                ?.itemIds.map((id) => game.worldContainerItems!.get(id)!);
        if (
          !items ||
          (r.destination.kind === 'inventory' && r.destination.actorId !== t.actorId) ||
          r.mergeTargets.some((id) => !items.some((i) => i.id === id)) ||
          r.counts.some((a) => !definitions.some((d) => d.id === a.itemDefinitionId))
        )
          fail('reservation closure');
      }
    if (t.inputEscrowId !== null && t.refundReservation) {
      const items = containerItemsForValidation(game, t.inputEscrowId);
      const amounts = new Map<string, number>();
      for (const i of items) {
        if (!i.worldItem) fail('escrow native');
        const id = i.worldItem!.definitionId;
        amounts.set(id, (amounts.get(id) ?? 0) + i.quantity);
      }
      if (
        amounts.size !== t.refundReservation.counts.length ||
        t.refundReservation.counts.some((a) => amounts.get(a.itemDefinitionId) !== a.count)
      )
        fail('escrow amounts');
    }
    const bundle = game.actorActions?.bundles.find((b) => b.actionId === t.bundleActionId);
    if (
      t.bundleActionId !== null &&
      (!bundle ||
        bundle.owner !== 'foundation' ||
        bundle.decisionOwnerId !== t.actorId ||
        bundle.subactions.length !== 1 ||
        bundle.depth !== (t.levelRef as any).depth ||
        bundle.subactions[0]!.phaseRemainingTicks !== t.remainingTicks)
    )
      fail('ticket clock mirror');
    if (
      (t.sourceContainerId !== null && !w.containers.some((c) => c.id === t.sourceContainerId)) ||
      (t.nodeId !== null && !w.nodes.some((n) => n.interactableId === t.nodeId)) ||
      (t.stationId !== null && !w.stations.some((s) => s.interactableId === t.stationId))
    )
      fail('ticket reference');
  }
  for (const b of game.actorActions?.bundles ?? [])
    if (
      b.owner === 'foundation' &&
      !w.tickets.some((t) => t.bundleActionId === b.actionId && t.status === 'working')
    )
      fail('orphan world clock');
}

function containerItemsForValidation(game: Game, id: number) {
  return game
    .world5!.containers.find((c) => c.id === id)!
    .itemIds.map((id) => game.worldContainerItems!.get(id)!);
}
