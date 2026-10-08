import { exact, uint, levelKey, World5Error } from './worldBasics';
import type { World5Snapshot } from './world5';
const fail = (field: string): never => {
  throw new World5Error('C5_BAD_REFERENCE', field);
};
export function validateWorldWorkRoots(w: World5Snapshot, owners: readonly string[]): void {
  const list = (v: unknown, n: number) => {
    if (!Array.isArray(v) || v.length > n) throw new World5Error('C5_BAD_PAYLOAD');
  };
  list(w.containers, 8192);
  list(w.nodes, 512);
  list(w.stations, 128);
  list(w.tickets, 8192);
  list(w.terminalTickets, 64);
  if (
    !w.definitionsFingerprint ||
    typeof w.definitionsFingerprint !== 'object' ||
    Array.isArray(w.definitionsFingerprint) ||
    Object.entries(w.definitionsFingerprint).some(
      ([owner, hash]) =>
        !owners.includes(owner) || typeof hash !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(hash)
    )
  )
    fail('definitionsFingerprint');
  list(w.pendingPlacements, 512);
  list(w.startupGrants, owners.length);
  const identity = (row: { owner: string; levelRef?: any }) => {
    if (
      !owners.includes(row.owner) ||
      (row.levelRef && !w.levels.some((l) => levelKey(l.levelRef) === levelKey(row.levelRef)))
    )
      fail('owner/level');
  };
  const unique = new Set<number>(w.orders.map((o) => o.id));
  const wid = (id: number) => {
    uint(id, 'id', 1);
    if (id >= w.nextWorldId || unique.has(id)) fail('worldId');
    unique.add(id);
  };
  for (const job of w.residentJobs) {
    identity({owner:job.owner,levelRef:{kind:'dungeon',depth:job.depth}});
    wid(job.id);
  }
  for (const t of w.terminalTickets) {
    exact(
      t,
      'ticketId,owner,actorId,kind,definitionId,totalBatches,completedBatches,status,stopReason,lastCompletionOrdinal',
      'terminalTicket'
    );
    identity(t);
    wid(t.ticketId);
    uint(t.actorId, 'actorId', 1);
    uint(t.totalBatches, 'totalBatches', 1);
    uint(t.completedBatches, 'completedBatches');
    uint(t.lastCompletionOrdinal, 'completionOrdinal', 1);
    if (
      t.totalBatches > 16 ||
      t.completedBatches > t.totalBatches ||
      !['completed', 'cancelled'].includes(t.status) ||
      !['harvest', 'craft', 'station', 'build'].includes(t.kind) ||
      typeof t.definitionId !== 'string' ||
      (t.stopReason !== null && typeof t.stopReason !== 'string') ||
      (t.status === 'completed' && t.completedBatches !== t.totalBatches)
    )
      fail('terminalTicket');
  }
  let previousReceipt = -1;
  for (const r of w.receipts) {
    if (r.ordinal <= previousReceipt) fail('receipt.ordinal');
    previousReceipt = r.ordinal;
  }
  const itemIds = new Set<number>();
  for (const c of w.containers) {
    exact(c, 'id,owner,kind,levelRef,position,capacity,itemIds,revision,ticketId', 'container');
    identity(c);
    wid(c.id);
    uint(c.revision, 'revision');
    uint(c.capacity, 'capacity', 1);
    if (
      !['chest', 'escrow', 'refund', 'remains'].includes(c.kind) ||
      c.capacity > (c.kind === 'remains' ? 1024 : 64)
    )
      fail('capacity');
    list(c.itemIds, c.capacity);
    for (const id of c.itemIds) {
      uint(id, 'itemId', 1);
      if (itemIds.has(id)) throw new World5Error('C5_BAD_OWNERSHIP');
      itemIds.add(id);
    }
    if (c.ticketId !== null) uint(c.ticketId, 'ticketId', 1);
    if (c.position !== null) {
      if (c.position.kind !== 'interactable') throw new World5Error('C5_UNSUPPORTED');
      exact(c.position, 'kind,interactableId', 'position');
      uint(c.position.interactableId, 'interactableId', 1);
    }
    if (
      ['chest', 'remains'].includes(c.kind)
        ? c.position === null || c.ticketId !== null
        : c.position !== null || c.ticketId === null
    )
      fail('container.kind');
  }
  if (itemIds.size > 7168) throw new World5Error('C5_BUDGET');
  const interactables = new Set<number>();
  for (const n of w.nodes) {
    exact(
      n,
      'interactableId,owner,definitionId,instanceKey,levelRef,at,capacity,remaining,reservedUnits,regenRemainder,lastSettledTick,revision',
      'node'
    );
    identity(n);
    uint(n.interactableId, 'node', 1);
    if (interactables.has(n.interactableId)) fail('node');
    interactables.add(n.interactableId);
    exact(n.at, 'x,y', 'at');
    uint(n.at.x, 'x');
    uint(n.at.y, 'y');
    for (const k of [
      'capacity',
      'remaining',
      'reservedUnits',
      'regenRemainder',
      'lastSettledTick',
      'revision'
    ] as const)
      uint(n[k], k);
    if (
      n.capacity < 1 ||
      n.capacity > 9999 ||
      n.reservedUnits > n.remaining ||
      n.remaining > n.capacity ||
      n.lastSettledTick > w.simulationTicks
    )
      fail('node.amount');
  }
  for (const level of w.levels)
    if (w.nodes.filter((n) => levelKey(n.levelRef) === levelKey(level.levelRef)).length > 32)
      throw new World5Error('C5_BUDGET');
  for (const s of w.stations) {
    exact(s, 'interactableId,owner,definitionId,levelRef,boundComponentId,revision', 'station');
    identity(s);
    uint(s.interactableId, 'station', 1);
    uint(s.revision, 'revision');
    if (interactables.has(s.interactableId) || (s.boundComponentId !== null && (!Number.isSafeInteger(s.boundComponentId)||s.boundComponentId<1))) fail('station');
    interactables.add(s.interactableId);
  }
  const actorIds = new Set<number>(w.residentJobs.map(j => j.actorId));
  for (const t of w.tickets) {
    exact(
      t,
      'ticketId,owner,actorId,levelRef,kind,nodeId,stationId,sourceContainerId,definitionId,inputEscrowId,outputReservation,refundReservation,resourceReservation,totalBatches,completedBatches,remainingTicks,laborCreditTicks,bundleActionId,revision,status,stopReason,lastCompletionOrdinal',
      'ticket'
    );
    identity(t);
    wid(t.ticketId);
    uint(t.actorId, 'actor', 1);
    for (const k of [
      'totalBatches',
      'completedBatches',
      'remainingTicks',
      'laborCreditTicks',
      'revision',
      'lastCompletionOrdinal'
    ] as const)
      uint(t[k], k);
    if (
      t.totalBatches < 1 ||
      t.totalBatches > 16 ||
      t.completedBatches > t.totalBatches ||
      t.remainingTicks > 10000 ||
      !['harvest', 'craft', 'station', 'build'].includes(t.kind) ||
      !['working', 'suspended'].includes(t.status) ||
      (t.stopReason !== null && typeof t.stopReason !== 'string')
    )
      fail('ticket');
    for (const k of [
      'nodeId',
      'stationId',
      'sourceContainerId',
      'inputEscrowId',
      'bundleActionId'
    ] as const)
      if (t[k] !== null) uint(t[k], k, 1);
    const active = ['working', 'suspended'].includes(t.status);
    if (active) {
      if (actorIds.has(t.actorId)) throw new World5Error('C5_BUSY');
      actorIds.add(t.actorId);
    } else if (
      t.inputEscrowId !== null ||
      t.outputReservation !== null ||
      t.refundReservation !== null ||
      t.resourceReservation !== null ||
      t.bundleActionId !== null ||
      t.remainingTicks !== 0
    )
      fail('terminal reservations');
    if (t.status === 'completed' && t.completedBatches !== t.totalBatches) fail('progress');
    for (const r of [t.outputReservation, t.refundReservation])
      if (r) {
        exact(r, 'destination,slots,mergeTargets,counts', 'reservation');
        uint(r.slots, 'slots');
        list(r.mergeTargets, 26);
        list(r.counts, 8);
        const dest = r.destination;
        if (dest.kind === 'inventory') {
          exact(dest, 'kind,actorId', 'destination');
          uint(dest.actorId, 'actorId', 1);
        } else if (dest.kind === 'container') {
          exact(dest, 'kind,containerId', 'destination');
          uint(dest.containerId, 'containerId', 1);
        } else fail('reservation destination');
        const ids = new Set<string>();
        for (const id of r.mergeTargets) uint(id, 'mergeTarget', 1);
        if (new Set(r.mergeTargets).size !== r.mergeTargets.length) fail('mergeTargets');
        for (const a of r.counts) {
          exact(a, 'itemDefinitionId,count', 'count');
          uint(a.count, 'count', 1);
          if (
            typeof a.itemDefinitionId !== 'string' ||
            ids.has(a.itemDefinitionId) ||
            a.count > 1584
          )
            fail('reservation count');
          ids.add(a.itemDefinitionId);
        }
      }
    if (
      t.inputEscrowId !== null &&
      !w.containers.some(
        (c) => c.id === t.inputEscrowId && c.kind === 'escrow' && c.ticketId === t.ticketId
      )
    )
      fail('escrow');
    if (t.resourceReservation) {
      exact(t.resourceReservation, 'nodeId,units', 'resourceReservation');
      uint(t.resourceReservation.units, 'units', 1);
      if (t.resourceReservation.nodeId !== t.nodeId) fail('reservation');
    }
  }
  for (const c of w.containers)
    if (
      c.ticketId !== null &&
      !w.tickets.some(
        (t) =>
          t.ticketId === c.ticketId &&
          t.inputEscrowId === c.id &&
          ['working', 'suspended'].includes(t.status)
      )
    )
      if(!w.residentJobs.some(j=>j.id===c.ticketId&&j.cargoId===c.id))fail('orphan escrow');
  for (const n of w.nodes)
    if (
      n.reservedUnits !==
      w.tickets.reduce(
        (sum, t) =>
          sum +
          (t.resourceReservation?.nodeId === n.interactableId ? t.resourceReservation.units : 0),
        0
      )
    )
      fail('reservedUnits');
  for (const p of w.pendingPlacements) {
    exact(p, 'owner,definitionId,levelRef,ordinal,retriesLeft', 'pendingPlacement');
    identity(p);
    uint(p.ordinal, 'ordinal');
    if (p.retriesLeft !== 0 && p.retriesLeft !== 1) fail('retries');
  }
  const grants = new Set<string>();
  for (const g of w.startupGrants) {
    exact(g, 'owner,instanceKey,result,toInventory,toFloor,skipped,tick', 'grant');
    identity(g);
    if (grants.has(g.owner) || !['granted', 'partial', 'skipped'].includes(g.result)) fail('grant');
    grants.add(g.owner);
    uint(g.tick, 'tick');
    for (const list of [g.toInventory, g.toFloor, g.skipped])
      for (const a of list) {
        exact(a, 'itemDefinitionId,count', 'grant.amount');
        uint(a.count, 'count', 1);
      }
  }
  const count =
    w.nodes.length + w.stations.length + w.containers.filter((c) => c.position !== null).length;
  if (
    count > 832 ||
    w.containers.filter((c) => c.kind === 'chest').length > 112 ||
    w.containers.filter((c) => c.kind === 'remains').length > 16
  )
    throw new World5Error('C5_BUDGET');
}
