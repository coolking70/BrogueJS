/** Trusted C5-1 offline economy. This module has no Game, RNG or presentation imports. */
import { c5Canonical, c5Hash } from './WorldCanonical';
import { sha256 } from '../../ext/fingerprint';
import { validId } from '../../ext/json';
import { isSeed } from '../Seed';
import {
  checkedAdd,
  exact,
  levelKey,
  requireDungeon,
  uint,
  World5Error,
  type CampSlotId,
  type EconomicOrder,
  type LevelRecord,
  type LevelRef,
  type OfflineLedger,
  type World5Snapshot,
  type WorldReceipt
} from '../../ext/world5';

export interface ItemAmount {
  itemDefinitionId: string;
  count: number;
}
export interface DeferredOutput {
  ticketId: number;
  availableEpoch: number;
  destinationId: number;
  items: ItemAmount[];
}
export interface OfflineItem {
  id: number;
  category: 'material' | 'tool' | 'kit' | 'native';
  nativeCategory: string | null;
  definitionId: string | null;
  quantity: number;
  available: number;
  packSlots: number;
  tags: string[];
  toolDurability: number | null;
}
export interface ContainerRead {
  id: number;
  levelRef: LevelRef;
  at: { x: number; y: number } | null;
  kind: 'chest' | 'escrow' | 'refund' | 'remains';
  revision: number;
  capacity: number;
  occupiedSlots: number;
  reservedSlots: number;
  items: OfflineItem[];
}
export interface ResourceNodeRecord {
  interactableId: number;
  owner: string;
  definitionId: string;
  instanceKey: string;
  levelRef: LevelRef;
  at: { x: number; y: number };
  capacity: number;
  remaining: number;
  reservedUnits: number;
  regenRemainder: number;
  lastSettledTick: number;
  revision: number;
}
export interface ResourceDefinition {
  owner: string;
  id: string;
  capacity: number;
  regeneration: { kind: 'none' } | { kind: 'periodic'; units: number; intervalTicks: number };
}
export interface RecipeDefinition {
  owner: string;
  id: string;
  inputs: ItemAmount[];
  outputs: ItemAmount[];
  stationTags: string[];
  toolTag: string | null;
  workTicks: number;
  offlineEligible: boolean;
}
export interface WorkTicket {
  ticketId: number;
  owner: string;
  actorId: number;
  levelRef: LevelRef;
  definitionId: string;
  sourceContainerId: number | null;
  totalBatches: number;
  completedBatches: number;
  remainingTicks: number;
  laborCreditTicks: number;
  status: string;
  outputReservation: {
    destination: { kind: 'container'; containerId: number };
    slots: number;
    counts: ItemAmount[];
  } | null;
}
export interface OfflineRules {
  epochTicks: 1000;
  maxPlanEpochs: 32;
  maxCompletionsPerEpoch: 1024;
  foodUnitsPerResident: 1;
  rationDefinitions: string[];
  nodeDefinitions: ResourceDefinition[];
  recipes: RecipeDefinition[];
  shortageEfficiencyNumerators: [number, number, number, number];
  efficiencyDenominator: number;
}
export interface OfflineEvent {
  id: string;
  absoluteEpoch: number;
  ordinal: number;
  kind: 'raid' | 'work-stop';
  policy: { remainingBudget: number };
}
export interface OfflineInput {
  schema: 1;
  rulesFingerprint: string;
  runSeed: string;
  campSlotId: CampSlotId;
  level: LevelRecord;
  fromTick: number;
  toTick: number;
  ledger: OfflineLedger;
  rules: OfflineRules;
  containers: ContainerRead[];
  nodes: ResourceNodeRecord[];
  tickets: WorkTicket[];
  orders: EconomicOrder[];
  pendingEvents: OfflineEvent[];
}
export type OfflineEffect =
  | {
      kind: 'item-delta';
      containerId: number;
      definitionId: string;
      delta: number;
      availableEpoch: number;
    }
  | { kind: 'ticket-progress'; ticketId: number; laborTicks: number; completedBatches: number }
  | { kind: 'structure-damage'; componentId: number; hpLost: number }
  | { kind: 'pending-encounter'; eventId: string; remainingBudget: number };
export interface OfflinePlan {
  contract: 'C5-1';
  planId: number;
  levelRef: LevelRef;
  fromTick: number;
  toTick: number;
  sourceRevision: number;
  inputDigest: string;
  nextLedger: OfflineLedger;
  nextOrders: EconomicOrder[];
  nextNodes: ResourceNodeRecord[];
  effects: OfflineEffect[];
  receipts: WorldReceipt[];
}
export type WorldResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: World5Error['code']; readonly field: string | null };
const hex = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const clone = <T>(v: T): T => structuredClone(v);
export function offlineDraw(
  seedKey: string,
  absoluteEpoch: number,
  eventKind: string,
  ordinal: number
): number {
  if (!hex(seedKey) || !validId(eventKind) || eventKind.length > 128)
    throw new World5Error('C5_BAD_PAYLOAD');
  uint(absoluteEpoch, 'absoluteEpoch');
  uint(ordinal, 'ordinal');
  return parseInt(
    sha256(c5Canonical(['c5-offline-v1', seedKey, absoluteEpoch, eventKind, ordinal])).slice(0, 8),
    16
  );
}
export function offlineSeedKey(
  runSeed: string,
  campSlotId: CampSlotId,
  domainId: string,
  rulesFingerprint: string
): string {
  if (!isSeed(runSeed) || !validId(domainId) || domainId.length > 128 || !hex(rulesFingerprint))
    throw new World5Error('C5_BAD_PAYLOAD');
  uint(campSlotId, 'campSlotId');
  if (campSlotId > 7) throw new World5Error('C5_BAD_PAYLOAD');
  return sha256(c5Canonical(['c5-seed-v1', runSeed, campSlotId, domainId, rulesFingerprint]));
}
function validate(input: OfflineInput): void {
  c5Canonical(input);
  exact(
    input,
    'schema,rulesFingerprint,runSeed,campSlotId,level,fromTick,toTick,ledger,rules,containers,nodes,tickets,orders,pendingEvents',
    'offline.input'
  );
  if (
    input.schema !== 1 ||
    !hex(input.rulesFingerprint) ||
    input.ledger.frozen.rulesFingerprint !== input.rulesFingerprint
  )
    throw new World5Error('C5_BAD_VERSION');
  offlineSeedKey(input.runSeed, input.campSlotId, 'raid', input.rulesFingerprint);
  exact(
    input.level,
    'levelRef,generatedBy,residence,revision,lastDepartedTick,policy,persistenceReasons',
    'level'
  );
  if (
    input.level.generatedBy !== 'native-dungeon' ||
    input.level.policy !== 'frozen-ecology-economy-v1'
  )
    throw new World5Error('C5_BAD_PAYLOAD');
  uint(input.level.revision, 'level.revision');
  requireDungeon(input.level.levelRef);
  uint(input.fromTick, 'fromTick');
  uint(input.toTick, 'toTick');
  if (
    input.toTick < input.fromTick ||
    input.fromTick !== input.ledger.lastSettledTick ||
    input.ledger.epochRemainder !== input.fromTick % 1000 ||
    input.campSlotId !== input.ledger.campSlotId ||
    levelKey(input.level.levelRef) !== levelKey(input.ledger.levelRef)
  )
    throw new World5Error('C5_BAD_TIME');
  if (!hex(input.ledger.seedKey)) throw new World5Error('C5_BAD_PAYLOAD');
  const r = input.rules;
  exact(
    r,
    'epochTicks,maxPlanEpochs,maxCompletionsPerEpoch,foodUnitsPerResident,rationDefinitions,nodeDefinitions,recipes,shortageEfficiencyNumerators,efficiencyDenominator',
    'offline.rules'
  );
  if (
    r.epochTicks !== 1000 ||
    r.maxPlanEpochs !== 32 ||
    r.maxCompletionsPerEpoch !== 1024 ||
    r.foodUnitsPerResident !== 1
  )
    throw new World5Error('C5_BAD_VERSION');
  uint(r.efficiencyDenominator, 'efficiencyDenominator', 1);
  if (
    r.shortageEfficiencyNumerators.length !== 4 ||
    r.shortageEfficiencyNumerators[0] !== r.efficiencyDenominator ||
    r.shortageEfficiencyNumerators[2] !== 0 ||
    r.shortageEfficiencyNumerators[3] !== 0
  )
    throw new World5Error('C5_BAD_PAYLOAD');
  r.shortageEfficiencyNumerators.forEach((v) => {
    uint(v, 'efficiency');
    if (v > r.efficiencyDenominator) throw new World5Error('C5_BAD_PAYLOAD');
  });
  for (const [rows, limit] of [
    [input.orders, 32],
    [input.containers, 128],
    [input.nodes, 256],
    [input.tickets, 64],
    [input.pendingEvents, 128],
    [input.ledger.residentStates, 16]
  ] as const)
    if (!Array.isArray(rows) || rows.length > limit) throw new World5Error('C5_BAD_PAYLOAD');
  exact(
    input.ledger,
    'levelRef,campSlotId,lastSettledTick,epochRemainder,revision,seedKey,lastEventOrdinal,residentStates,pendingOutputs,needsResupply,frozen',
    'ledger'
  );
  const l = input.ledger,
    f = l.frozen;
  exact(
    f,
    'capturedTick,rulesFingerprint,structureRevision,residents,facilities,knownThreats',
    'frozen'
  );
  for (const v of [l.revision, l.lastEventOrdinal, f.capturedTick, f.structureRevision])
    uint(v, 'ledger.integer');
  if (
    f.capturedTick > input.fromTick ||
    typeof l.needsResupply !== 'boolean' ||
    f.residents.length > 16 ||
    f.facilities.length > 256 ||
    f.knownThreats.length > 128
  )
    throw new World5Error('C5_BAD_PAYLOAD');
  const unique = (rows: readonly any[], key: string) => {
    const seen = new Set<unknown>();
    for (const row of rows) {
      if (seen.has(row[key])) throw new World5Error('C5_BAD_REFERENCE');
      seen.add(row[key]);
    }
  };
  for (const [rows, key] of [
    [input.orders, 'id'],
    [input.containers, 'id'],
    [input.nodes, 'interactableId'],
    [input.tickets, 'ticketId'],
    [l.residentStates, 'actorId'],
    [f.residents, 'actorId'],
    [input.pendingEvents, 'ordinal']
  ] as const)
    unique(rows, key);
  for (const a of l.residentStates) {
    exact(a, 'actorId,alive,shortage', 'resident');
    uint(a.actorId, 'actorId', 1);
    uint(a.shortage, 'shortage');
    if (a.shortage > 3 || typeof a.alive !== 'boolean') throw new World5Error('C5_BAD_PAYLOAD');
  }
  for (const a of f.residents) {
    exact(a, 'actorId,bedComponentId,route', 'frozen.resident');
    exact(a.route, 'reachable,distance,travelTicks', 'route');
    uint(a.actorId, 'actorId', 1);
    uint(a.route.distance, 'distance');
    uint(a.route.travelTicks, 'travelTicks');
    if (
      typeof a.route.reachable !== 'boolean' ||
      !l.residentStates.some((s) => s.actorId === a.actorId)
    )
      throw new World5Error('C5_BAD_REFERENCE');
  }
  for (const o of input.orders) {
    exact(
      o,
      'id,owner,actorId,levelRef,definitionId,priority,planId,remainingEpochs,ticketId,status,stopReason,revision',
      'order'
    );
    for (const v of [o.id, o.actorId, o.planId]) uint(v, 'order.id', 1);
    for (const v of [o.priority, o.revision, o.remainingEpochs]) uint(v, 'order.integer');
    if (
      o.remainingEpochs > 32 ||
      !validId(o.owner) ||
      !validId(o.definitionId) ||
      !['working', 'stopped', 'needs-resupply'].includes(o.status) ||
      (o.stopReason !== null && typeof o.stopReason !== 'string') ||
      levelKey(o.levelRef) !== levelKey(l.levelRef) ||
      !l.residentStates.some((s) => s.actorId === o.actorId) ||
      (o.ticketId !== null && !input.tickets.some((t) => t.ticketId === o.ticketId))
    )
      throw new World5Error('C5_BAD_PAYLOAD');
  }
  const amounts = (rows: ItemAmount[]) => {
    if (!Array.isArray(rows) || rows.length > 128) throw new World5Error('C5_BAD_PAYLOAD');
    unique(rows, 'itemDefinitionId');
    for (const a of rows) {
      exact(a, 'itemDefinitionId,count', 'amount');
      if (!validId(a.itemDefinitionId)) throw new World5Error('C5_BAD_PAYLOAD');
      uint(a.count, 'count', 1);
    }
  };
  for (const c of input.containers) {
    exact(
      c,
      'id,levelRef,at,kind,revision,capacity,occupiedSlots,reservedSlots,items',
      'container'
    );
    uint(c.id, 'containerId', 1);
    for (const n of [c.revision, c.capacity, c.occupiedSlots, c.reservedSlots])
      uint(n, 'container.integer');
    if (
      levelKey(c.levelRef) !== levelKey(l.levelRef) ||
      checkedAdd(c.occupiedSlots, c.reservedSlots) > c.capacity ||
      c.capacity > 1024 ||
      c.items.length > 1024
    )
      throw new World5Error('C5_BAD_PAYLOAD');
    for (const i of c.items) {
      exact(
        i,
        'id,category,nativeCategory,definitionId,quantity,available,packSlots,tags,toolDurability',
        'item'
      );
      uint(i.id, 'itemId');
      uint(i.quantity, 'quantity');
      uint(i.available, 'available');
      uint(i.packSlots, 'packSlots');
      if (
        i.available > i.quantity ||
        !['material', 'tool', 'kit', 'native'].includes(i.category) ||
        (i.definitionId !== null && !validId(i.definitionId)) ||
        !Array.isArray(i.tags) ||
        i.tags.length > 128
      )
        throw new World5Error('C5_BAD_PAYLOAD');
    }
  }
  unique(r.nodeDefinitions, 'id');
  unique(r.recipes, 'id');
  for (const d of r.nodeDefinitions) {
    if (!validId(d.id) || !validId(d.owner)) throw new World5Error('C5_BAD_PAYLOAD');
    uint(d.capacity, 'capacity', 1);
    if (d.regeneration.kind === 'periodic') {
      uint(d.regeneration.units, 'units', 1);
      uint(d.regeneration.intervalTicks, 'intervalTicks', 1);
    } else if (d.regeneration.kind !== 'none') throw new World5Error('C5_BAD_PAYLOAD');
  }
  for (const n of input.nodes) {
    uint(n.interactableId, 'interactableId', 1);
    for (const v of [
      n.capacity,
      n.remaining,
      n.reservedUnits,
      n.regenRemainder,
      n.lastSettledTick,
      n.revision
    ])
      uint(v, 'node.integer');
    const d = r.nodeDefinitions.find((d) => d.id === n.definitionId);
    if (
      !d ||
      n.capacity !== d.capacity ||
      n.remaining > n.capacity ||
      n.reservedUnits > n.remaining ||
      n.lastSettledTick > input.fromTick ||
      (d.regeneration.kind === 'periodic' && n.regenRemainder >= d.regeneration.intervalTicks)
    )
      throw new World5Error('C5_BAD_REFERENCE');
  }
  for (const recipe of r.recipes) {
    if (
      !validId(recipe.id) ||
      !validId(recipe.owner) ||
      typeof recipe.offlineEligible !== 'boolean'
    )
      throw new World5Error('C5_BAD_PAYLOAD');
    uint(recipe.workTicks, 'workTicks', 1);
    amounts(recipe.inputs);
    amounts(recipe.outputs);
    for (const amount of recipe.inputs)
      for (const c of input.containers)
        for (const i of c.items)
          if (
            i.definitionId === amount.itemDefinitionId &&
            !['material', 'kit'].includes(i.category)
          )
            throw new World5Error('C5_BAD_PAYLOAD');
  }
  for (const t of input.tickets) {
    uint(t.ticketId, 'ticketId', 1);
    uint(t.actorId, 'actorId', 1);
    for (const v of [t.totalBatches, t.completedBatches, t.remainingTicks, t.laborCreditTicks])
      uint(v, 'ticket.integer');
    if (
      t.completedBatches > t.totalBatches ||
      !r.recipes.some((r) => r.id === t.definitionId) ||
      levelKey(t.levelRef) !== levelKey(l.levelRef) ||
      (t.sourceContainerId !== null && !input.containers.some((c) => c.id === t.sourceContainerId))
    )
      throw new World5Error('C5_BAD_REFERENCE');
    if (t.outputReservation) {
      uint(t.outputReservation.slots, 'slots');
      amounts(t.outputReservation.counts);
      if (!input.containers.some((c) => c.id === t.outputReservation!.destination.containerId))
        throw new World5Error('C5_BAD_REFERENCE');
    }
  }
  if (l.pendingOutputs.length > 32768) throw new World5Error('C5_BAD_PAYLOAD');
  for (const output of l.pendingOutputs) {
    exact(output, 'ticketId,availableEpoch,destinationId,items', 'pendingOutput');
    uint(output.availableEpoch, 'availableEpoch');
    amounts(output.items);
    if (
      !input.containers.some((c) => c.id === output.destinationId) ||
      !input.tickets.some((t) => t.ticketId === output.ticketId)
    )
      throw new World5Error('C5_BAD_REFERENCE');
  }

  for (const e of input.pendingEvents) {
    exact(e, 'id,absoluteEpoch,ordinal,kind,policy', 'offline.event');
    exact(e.policy, 'remainingBudget', 'offline.policy');
    uint(e.absoluteEpoch, 'epoch');
    uint(e.ordinal, 'ordinal', 1);
    uint(e.policy.remainingBudget, 'budget');
    if (!validId(e.id) || !['raid', 'work-stop'].includes(e.kind))
      throw new World5Error('C5_BAD_PAYLOAD');
  }
}
/** Canonical epoch transition, also used by the independent test reference's DTO adapter.
 * The production planner bounds this loop by finite jobs/food/events, then skips the saturated tail. */
function compute(input: OfflineInput): OfflinePlan {
  validate(input);
  const ledger = clone(input.ledger),
    orders = clone(input.orders),
    nodes = clone(input.nodes),
    tickets = clone(input.tickets),
    containers = clone(input.containers);
  const effects: OfflineEffect[] = [],
    receipts: WorldReceipt[] = [];
  const start = Math.floor(input.fromTick / 1000) + 1,
    end = Math.floor(input.toTick / 1000);
  const sortedOrders = orders
    .slice()
    .sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.definitionId < b.definitionId ? -1 : a.definitionId > b.definitionId ? 1 : 0) ||
        a.actorId - b.actorId ||
        a.id - b.id
    );
  const events = input.pendingEvents
    .slice()
    .sort((a, b) => a.absoluteEpoch - b.absoluteEpoch || a.ordinal - b.ordinal);
  const itemDelta = (
    container: ContainerRead,
    definitionId: string,
    delta: number,
    epoch: number
  ) => {
    const row = container.items.find((i) => i.definitionId === definitionId);
    if (row) {
      row.available = delta > 0 ? checkedAdd(row.available, delta) : row.available + delta;
      row.quantity = delta > 0 ? checkedAdd(row.quantity, delta) : row.quantity + delta;
      if (row.available < 0 || row.quantity < 0) throw new World5Error('C5_BAD_PAYLOAD');
    } else if (delta > 0)
      container.items.push({
        id: 0,
        category: 'material',
        nativeCategory: null,
        definitionId,
        quantity: delta,
        available: delta,
        packSlots: 1,
        tags: [],
        toolDurability: null
      });
    effects.push({
      kind: 'item-delta',
      containerId: container.id,
      definitionId,
      delta,
      availableEpoch: epoch
    });
  };
  const regenerate = (through: number) => {
    for (const n of nodes) {
      const d = input.rules.nodeDefinitions.find((d) => d.id === n.definitionId);
      if (!d) throw new World5Error('C5_BAD_REFERENCE');
      if (d.regeneration.kind === 'periodic') {
        const elapsed = through - n.lastSettledTick;
        if (elapsed < 0) throw new World5Error('C5_BAD_TIME');
        const time = checkedAdd(n.regenRemainder, elapsed),
          count = Math.floor(time / d.regeneration.intervalTicks);
        const room = n.capacity - n.remaining;
        n.remaining +=
          count >= Math.ceil(room / d.regeneration.units) ? room : count * d.regeneration.units;
        n.regenRemainder = time % d.regeneration.intervalTicks;
      }
      n.lastSettledTick = through;
    }
  };
  let epoch = start;
  while (epoch <= end) {
    // After finite jobs are exhausted, at most finite food and registered events remain.
    const food = containers.reduce(
      (n, c) =>
        checkedAdd(
          n,
          c.items
            .filter((i) => input.rules.rationDefinitions.includes(i.definitionId ?? ''))
            .reduce((s, i) => checkedAdd(s, i.available), 0)
        ),
      0
    );
    const future =
      events.find(
        (e) =>
          e.absoluteEpoch >= epoch && e.absoluteEpoch <= end && e.ordinal > ledger.lastEventOrdinal
      )?.absoluteEpoch ?? end + 1;
    if (
      !orders.some((o) => o.status === 'working' && o.remainingEpochs > 0) &&
      ledger.pendingOutputs.length === 0
    ) {
      const stop = Math.min(end + 1, future),
        count = stop - epoch;
      if (count > 0) {
        const alive = ledger.residentStates
            .filter((s) => s.alive)
            .sort((a, b) => a.actorId - b.actorId),
          need = alive.length * count,
          used = Math.min(food, need);
        let remaining = used;
        for (const c of containers.slice().sort((a, b) => a.id - b.id))
          for (const i of c.items) {
            if (remaining && input.rules.rationDefinitions.includes(i.definitionId ?? '')) {
              const take = Math.min(remaining, i.available);
              if (take) {
                itemDelta(c, i.definitionId!, -take, stop - 1);
                remaining -= take;
              }
            }
          }
        alive.forEach((s, i) => {
          const full = Math.floor(used / alive.length),
            last = full + (i < used % alive.length ? 1 : 0);
          s.shortage = Math.min(3, last > 0 ? count - last : s.shortage + count) as 0 | 1 | 2 | 3;
        });
        epoch = stop;
        if (epoch > end) break;
      }
    }
    for (const output of [...ledger.pendingOutputs])
      if (output.availableEpoch <= epoch) {
        const c = containers.find((c) => c.id === output.destinationId);
        if (!c) throw new World5Error('C5_BAD_REFERENCE');
        for (const amount of output.items)
          itemDelta(c, amount.itemDefinitionId, amount.count, epoch);
        ledger.pendingOutputs.splice(ledger.pendingOutputs.indexOf(output), 1);
      }
    for (const s of ledger.residentStates.slice().sort((a, b) => a.actorId - b.actorId))
      if (s.alive) {
        const food = containers
          .slice()
          .sort((a, b) => a.id - b.id)
          .flatMap((c) => c.items.map((i) => ({ c, i })))
          .find(
            ({ i }) =>
              input.rules.rationDefinitions.includes(i.definitionId ?? '') && i.available > 0
          );
        if (food) {
          itemDelta(food.c, food.i.definitionId!, -1, epoch);
          s.shortage = 0;
        } else s.shortage = Math.min(3, s.shortage + 1) as 0 | 1 | 2 | 3;
      }
    let completions = 0;
    for (const o of sortedOrders)
      if (o.status === 'working' && o.remainingEpochs > 0) {
        const resident = ledger.residentStates.find((s) => s.actorId === o.actorId),
          frozen = ledger.frozen.residents.find((s) => s.actorId === o.actorId);
        o.remainingEpochs--;
        o.revision = checkedAdd(o.revision, 1);
        const ticket = tickets.find((t) => t.ticketId === o.ticketId),
          recipe = ticket && input.rules.recipes.find((r) => r.id === ticket.definitionId);
        if (resident?.alive && frozen?.route.reachable && recipe?.offlineEligible && ticket) {
          const numerator = 1000 * input.rules.shortageEfficiencyNumerators[resident.shortage];
          if (!Number.isSafeInteger(numerator)) throw new World5Error('C5_OVERFLOW');
          const credit = Math.floor(numerator / input.rules.efficiencyDenominator);
          ticket.laborCreditTicks = checkedAdd(ticket.laborCreditTicks, credit);
          let done = 0;
          const source = containers.find((c) => c.id === ticket.sourceContainerId),
            reservation = ticket.outputReservation;
          while (
            ticket.laborCreditTicks >= recipe.workTicks &&
            ticket.completedBatches < ticket.totalBatches &&
            completions < 1024 &&
            source &&
            reservation
          ) {
            if (
              recipe.inputs.some(
                (a) =>
                  (source.items.find((i) => i.definitionId === a.itemDefinitionId)?.available ??
                    0) < a.count
              )
            )
              break;
            const dest = containers.find((c) => c.id === reservation.destination.containerId);
            if (!dest || dest.occupiedSlots + dest.reservedSlots > dest.capacity) break;
            for (const a of recipe.inputs) itemDelta(source, a.itemDefinitionId, -a.count, epoch);
            ticket.laborCreditTicks -= recipe.workTicks;
            ticket.completedBatches++;
            done++;
            completions++;
            ledger.pendingOutputs.push({
              ticketId: ticket.ticketId,
              availableEpoch: epoch + 1,
              destinationId: dest.id,
              items: clone(recipe.outputs)
            });
          }
          effects.push({
            kind: 'ticket-progress',
            ticketId: ticket.ticketId,
            laborTicks: credit,
            completedBatches: done
          });
        }
        if (o.remainingEpochs === 0) {
          o.status = 'needs-resupply';
          o.stopReason = 'needs-resupply';
        }
      }
    // One registered window, deterministic draw; ordinal is a persistent high-water mark.
    const e = events.find((e) => e.absoluteEpoch === epoch && e.ordinal > ledger.lastEventOrdinal);
    if (e) {
      offlineDraw(ledger.seedKey, epoch, e.kind, e.ordinal);
      ledger.lastEventOrdinal = e.ordinal;
      if (e.kind === 'work-stop') {
        for (const o of orders)
          if (o.status === 'working') {
            o.status = 'stopped';
            o.stopReason = e.id;
            o.revision = checkedAdd(o.revision, 1);
          }
      } else
        effects.push({
          kind: 'pending-encounter',
          eventId: e.id,
          remainingBudget: e.policy.remainingBudget
        });
      receipts.push({
        owner: orders[0]?.owner ?? 'world5-fixture',
        ordinal: e.ordinal,
        identity: 'offline.' + input.campSlotId + '.' + e.id + '.' + epoch,
        kind: 'offline',
        levelRef: clone(input.level.levelRef),
        tick: epoch * 1000,
        result: 'completed',
        reason: null
      });
    }
    regenerate(epoch * 1000);
    epoch++;
  }
  if (end >= start) regenerate(end * 1000);
  ledger.lastSettledTick = input.toTick;
  ledger.epochRemainder = input.toTick % 1000;
  ledger.revision = checkedAdd(ledger.revision, Math.max(0, end - start + 1));
  ledger.needsResupply = orders.some((o) => o.status === 'needs-resupply');
  return {
    contract: 'C5-1',
    planId: Math.max(1, ...orders.map((o) => o.planId)),
    levelRef: clone(input.level.levelRef),
    fromTick: input.fromTick,
    toTick: input.toTick,
    sourceRevision: input.ledger.revision,
    inputDigest: c5Hash(input),
    nextLedger: ledger,
    nextOrders: orders,
    nextNodes: nodes,
    effects,
    receipts
  };
}
export function planOfflineSettlement(input: Readonly<OfflineInput>): WorldResult<OfflinePlan> {
  try {
    return { ok: true, value: compute(input as OfflineInput) };
  } catch (e) {
    return {
      ok: false,
      code: e instanceof World5Error ? e.code : 'C5_BAD_PAYLOAD',
      field: e instanceof World5Error ? e.field : null
    };
  }
}
export interface SettlementParticipant {
  prepare(plan: Readonly<OfflinePlan>): () => void;
  checkpoint(): () => void;
}
function jsonCheckpoint(root: object): () => void {
  const seen = new Set<object>(),
    restore: (() => void)[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    restore.push(() => {
      for (const k of Reflect.ownKeys(value))
        if (!Object.prototype.hasOwnProperty.call(descriptors, k)) Reflect.deleteProperty(value, k);
      Object.defineProperties(value, descriptors);
    });
    for (const d of Object.values(descriptors)) if ('value' in d) visit(d.value);
  };
  visit(root);
  return () => restore.forEach((apply) => apply());
}
function requireSynchronousSettlement(value: unknown): void {
  if (value && typeof (value as { then?: unknown }).then === 'function') {
    void Promise.resolve(value).catch(() => undefined);
    throw new World5Error('C5_PROVIDER');
  }
}
/** The caller's level-entry transaction additionally owns map/session/RNG publication. */
export function commitOfflineSettlement(
  world: World5Snapshot,
  plan: OfflinePlan,
  participant?: SettlementParticipant,
  fixtureEffects = false,
  terminal = false
): WorldResult<{ committed: boolean }> {
  try {
    if (terminal) throw new World5Error('C5_TERMINAL');
    const ledger = world.offline.find((l) => levelKey(l.levelRef) === levelKey(plan.levelRef));
    if (!ledger) throw new World5Error('C5_BAD_REFERENCE');
    if (plan.toTick > world.simulationTicks || plan.toTick < plan.fromTick)
      throw new World5Error('C5_BAD_TIME');
    if (
      ledger.lastSettledTick === plan.toTick &&
      c5Hash(ledger) === c5Hash(plan.nextLedger) &&
      plan.nextOrders.every((o) => c5Hash(world.orders.find((x) => x.id === o.id)) === c5Hash(o))
    )
      return { ok: true, value: { committed: false } };
    if (ledger.revision !== plan.sourceRevision) throw new World5Error('C5_STALE');
    if (ledger.lastSettledTick !== plan.fromTick) throw new World5Error('C5_BAD_TIME');
    if (!fixtureEffects && plan.effects.some((e) => e.kind !== 'pending-encounter'))
      throw new World5Error('C5_UNSUPPORTED');
    if (plan.nextNodes.length && !fixtureEffects) throw new World5Error('C5_UNSUPPORTED');
    const restoreWorld = jsonCheckpoint(world);
    let restore: (() => void) | undefined;
    try {
      const checkpoint = participant?.checkpoint();
      requireSynchronousSettlement(checkpoint);
      if (checkpoint !== undefined && typeof checkpoint !== 'function')
        throw new World5Error('C5_PROVIDER');
      restore = checkpoint;
      const publish = participant?.prepare(plan);
      requireSynchronousSettlement(publish);
      if (publish !== undefined && typeof publish !== 'function')
        throw new World5Error('C5_PROVIDER');
      const revision = checkedAdd(world.revision, 1);
      const previousOrdinal = ledger.lastEventOrdinal;
      Object.assign(ledger, clone(plan.nextLedger));
      for (const next of plan.nextOrders) {
        const order = world.orders.find((o) => o.id === next.id);
        if (!order) throw new World5Error('C5_BAD_REFERENCE');
        Object.assign(order, clone(next));
      }
      for (const receipt of plan.receipts)
        if (receipt.ordinal > previousOrdinal && receipt.ordinal <= ledger.lastEventOrdinal) {
          world.receipts.push({...clone(receipt),ordinal:checkedAdd(world.receipts[world.receipts.length-1]?.ordinal??0,1)});
        }
      if (world.receipts.length > 128) world.receipts.splice(0, world.receipts.length - 128);
      world.revision = revision;
      requireSynchronousSettlement(publish?.());
    } catch (e) {
      restoreWorld();
      restore?.();
      throw e;
    }
    return { ok: true, value: { committed: true } };
  } catch (e) {
    return {
      ok: false,
      code: e instanceof World5Error ? e.code : 'C5_TRANSACTION',
      field: e instanceof World5Error ? e.field : null
    };
  }
}
