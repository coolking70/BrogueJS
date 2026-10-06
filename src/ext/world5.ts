import { validateWorldWorkRoots } from './worldWorkSchema';
import {
  World5Error,
  uint,
  checkedAdd,
  exact,
  compareLevelRefs,
  levelKey,
  requireDungeon
} from './worldBasics';
export {
  World5Error,
  uint,
  checkedAdd,
  exact,
  validateLevelRef,
  levelKey,
  compareLevelRefs,
  requireDungeon
} from './worldBasics';
import type {
  ContainerRecord,
  ResourceNodeRecord,
  StationRecord,
  WorkTicket,
  TerminalWorkTicket,
  StartupGrantReceipt
} from './worldSdk';
export type MutableWorld<T> = T extends readonly (infer U)[]
  ? MutableWorld<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: MutableWorld<T[K]> }
    : T;
/** C5-1/1.0.0 r2: foundation-owned identities and persistent economic roots. */
import { validId } from './json';
import { c5Canonical } from './worldJson';
import type { DeferredOutput } from '../engine/Core/WorldSettlement';
export type LevelRef =
  | Readonly<{ kind: 'dungeon'; depth: number }>
  | Readonly<{ kind: 'site'; id: string }>;
export type CampSlotId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type WorldId = number;
export type PersistenceReason = 'camp' | 'container' | 'resident' | 'work' | 'event';
export interface LevelRecord {
  levelRef: LevelRef;
  generatedBy: 'native-dungeon' | `site-generator.${string}`;
  residence: 'active' | 'cached';
  revision: number;
  lastDepartedTick: number | null;
  policy: 'native' | 'frozen-ecology-economy-v1';
  persistenceReasons: PersistenceReason[];
}
export interface ResidentRecord {
  actorId: number;
  owner: string;
  campSlotId: CampSlotId;
  /** Economic home, not the native actor's current carrier. Native travel/pending is legal. */
  levelRef: LevelRef;
  revision: number;
}
export interface EconomicOrder {
  id: WorldId;
  owner: string;
  actorId: number;
  levelRef: LevelRef;
  definitionId: string;
  priority: number;
  planId: number;
  remainingEpochs: number;
  ticketId: WorldId | null;
  status: 'working' | 'stopped' | 'needs-resupply';
  stopReason: string | null;
  revision: number;
}
export interface OfflineResidentState {
  actorId: number;
  alive: boolean;
  shortage: 0 | 1 | 2 | 3;
}
export interface OfflineFrozenSummary {
  capturedTick: number;
  rulesFingerprint: string;
  structureRevision: number;
  residents: {
    actorId: number;
    bedComponentId: WorldId | null;
    route: { reachable: boolean; distance: number; travelTicks: number };
  }[];
  facilities: never[];
  knownThreats: string[];
}
export interface OfflineLedger {
  levelRef: LevelRef;
  campSlotId: CampSlotId;
  lastSettledTick: number;
  epochRemainder: number;
  revision: number;
  seedKey: string;
  lastEventOrdinal: number;
  residentStates: OfflineResidentState[];
  pendingOutputs: DeferredOutput[];
  needsResupply: boolean;
  frozen: OfflineFrozenSummary;
}
export interface WorldReceipt {
  owner: string;
  ordinal: number;
  identity: string;
  kind: 'startup' | 'transfer' | 'work' | 'placement' | 'offline' | 'region' | 'structure' | 'rest';
  levelRef: LevelRef;
  tick: number;
  result: 'completed' | 'interrupted' | 'skipped';
  reason: string | null;
}
export interface World5Snapshot {
  schema: 1;
  revision: number;
  simulationTicks: number;
  nextWorldId: WorldId;
  nextPlanId: number;
  levels: LevelRecord[];
  orders: EconomicOrder[];
  residents: ResidentRecord[];
  offline: OfflineLedger[];
  receipts: WorldReceipt[];
  structures: never[];
  containers: MutableWorld<ContainerRecord>[];
  nodes: MutableWorld<ResourceNodeRecord>[];
  stations: MutableWorld<StationRecord>[];
  tickets: MutableWorld<WorkTicket>[];
  terminalTickets: MutableWorld<TerminalWorkTicket>[];
  definitionsFingerprint: Record<string, string>;
  restPoints: never[];
  pendingPlacements: {
    owner: string;
    definitionId: string;
    levelRef: LevelRef;
    ordinal: number;
    retriesLeft: 0 | 1;
  }[];
  startupGrants: MutableWorld<StartupGrantReceipt>[];
}
export function createWorld5(): World5Snapshot {
  return {
    schema: 1,
    revision: 0,
    simulationTicks: 0,
    nextWorldId: 1,
    nextPlanId: 1,
    levels: [],
    orders: [],
    residents: [],
    offline: [],
    receipts: [],
    structures: [],
    containers: [],
    nodes: [],
    stations: [],
    tickets: [],
    terminalTickets: [],
    definitionsFingerprint: {},
    restPoints: [],
    pendingPlacements: [],
    startupGrants: []
  };
}
export function validateWorldClockAdvance(world: World5Snapshot, elapsed: number): void {
  uint(elapsed, 'elapsed', 1);
  checkedAdd(world.simulationTicks, elapsed);
  checkedAdd(world.revision, 1);
}
export function advanceWorldClock(world: World5Snapshot, elapsed: number): void {
  uint(elapsed, 'elapsed', 1);
  const ticks = checkedAdd(world.simulationTicks, elapsed),
    revision = checkedAdd(world.revision, 1);
  world.simulationTicks = ticks;
  world.revision = revision;
}
/** Update only the index; no Grid/Creature/Item is duplicated here. */
export function indexWorldLevels(
  world: World5Snapshot,
  visited: readonly { visited: boolean }[],
  active: number
): void {
  let changed = false;
  for (let i = 0; i < visited.length; i++)
    if (visited[i]!.visited) {
      let record = world.levels.find(
        (l) => l.levelRef.kind === 'dungeon' && l.levelRef.depth === i + 1
      );
      if (!record) {
        record = {
          levelRef: { kind: 'dungeon', depth: i + 1 },
          generatedBy: 'native-dungeon',
          residence: 'cached',
          revision: 0,
          lastDepartedTick: null,
          policy: 'native',
          persistenceReasons: []
        };
        world.levels.push(record);
        changed = true;
      }
      const residence = i + 1 === active ? 'active' : 'cached';
      if (record.residence === 'active' && residence === 'cached')
        record.lastDepartedTick = world.simulationTicks;
      if (record.residence !== residence) {
        record.revision = checkedAdd(record.revision, 1);
        changed = true;
      }
      record.residence = residence;
    }
  world.levels.sort((a, b) => compareLevelRefs(a.levelRef, b.levelRef));
  if (changed) world.revision = checkedAdd(world.revision, 1);
}

/** 5A1 codec: future roots stay empty, never silently accept 5A2/5A3 data. */
export function validateWorld5(
  value: unknown,
  context: {
    active: number;
    visited: readonly { visited: boolean }[];
    cachedDepths: readonly number[];
    owners: readonly string[];
    actors: ReadonlyMap<number, number>;
    rulesFingerprint?: string;
    nextEntityId?: number;
    occupiedEntityIds?: ReadonlySet<number>;
  }
): asserts value is World5Snapshot {
  try {
    c5Canonical(value);
  } catch {
    throw new World5Error('C5_BAD_PAYLOAD', 'world5');
  }
  exact(
    value,
    'schema,revision,simulationTicks,nextWorldId,nextPlanId,levels,orders,residents,offline,receipts,structures,containers,nodes,stations,tickets,terminalTickets,definitionsFingerprint,restPoints,pendingPlacements,startupGrants',
    'world5'
  );
  const w = value as unknown as World5Snapshot;
  if (w.schema !== 1) throw new World5Error('C5_BAD_VERSION', 'world5.schema');
  for (const name of ['revision', 'simulationTicks', 'nextWorldId', 'nextPlanId'] as const)
    uint(w[name], name, name.startsWith('next') ? 1 : 0);
  for (const name of ['structures', 'restPoints'] as const)
    if (!Array.isArray(w[name]) || w[name].length) throw new World5Error('C5_UNSUPPORTED', name);
  validateWorldWorkRoots(w, context.owners);
  const list = (v: unknown, n: number, f: string): void => {
    if (!Array.isArray(v) || v.length > n) throw new World5Error('C5_BAD_PAYLOAD', f);
  };
  const owner = (v: string): void => {
    if (!context.owners.includes(v)) throw new World5Error('C5_BAD_REFERENCE', 'owner');
  };
  const ref = (v: LevelRef): void => {
    requireDungeon(v);
    if (!w.levels.some((l) => levelKey(l.levelRef) === levelKey(v)))
      throw new World5Error('C5_BAD_REFERENCE', 'levelRef');
  };
  const unique = (v: readonly unknown[], f: string): void => {
    if (new Set(v).size !== v.length) throw new World5Error('C5_BAD_OWNERSHIP', f);
  };
  list(w.levels, 40, 'levels');
  list(w.residents, 64, 'residents');
  list(w.orders, 256, 'orders');
  list(w.offline, 8, 'offline');
  list(w.receipts, 128, 'receipts');
  const depths = w.levels.map((l) => requireDungeon(l.levelRef));
  unique(depths, 'levels');
  const expected = context.visited.flatMap((v, i) => (v.visited ? [i + 1] : []));
  if (
    JSON.stringify(depths) !== JSON.stringify(expected) ||
    context.cachedDepths.includes(context.active) ||
    expected.some((d) => d !== context.active && !context.cachedDepths.includes(d))
  )
    throw new World5Error('C5_BAD_OWNERSHIP', 'levels');
  for (const l of w.levels) {
    exact(
      l,
      'levelRef,generatedBy,residence,revision,lastDepartedTick,policy,persistenceReasons',
      'level'
    );
    uint(l.revision, 'level.revision');
    if (l.lastDepartedTick !== null) {
      uint(l.lastDepartedTick, 'lastDepartedTick');
      if (l.lastDepartedTick > w.simulationTicks)
        throw new World5Error('C5_BAD_TIME', 'lastDepartedTick');
    }
    if (
      l.generatedBy !== 'native-dungeon' ||
      l.residence !== (requireDungeon(l.levelRef) === context.active ? 'active' : 'cached') ||
      !['native', 'frozen-ecology-economy-v1'].includes(l.policy)
    )
      throw new World5Error('C5_BAD_OWNERSHIP', 'level');
  }
  unique(
    w.residents.map((r) => r.actorId),
    'residents'
  );
  unique(
    w.orders.map((o) => o.id),
    'orders'
  );
  unique(
    w.offline.map((l) => levelKey(l.levelRef)),
    'offline'
  );
  unique(
    w.offline.map((l) => l.campSlotId),
    'campSlotId'
  );
  for (const r of w.residents) {
    exact(r, 'actorId,owner,campSlotId,levelRef,revision', 'resident');
    uint(r.actorId, 'actorId', 1);
    uint(r.revision, 'revision');
    uint(r.campSlotId, 'campSlotId');
    owner(r.owner);
    ref(r.levelRef);
    if (
      r.campSlotId > 7 ||
      (!context.actors.has(r.actorId) &&
        !(
          !context.actors.has(r.actorId) &&
          !context.occupiedEntityIds?.has(r.actorId) &&
          context.nextEntityId &&
          r.actorId < context.nextEntityId &&
          w.offline.some(
            (l) =>
              l.campSlotId === r.campSlotId &&
              l.residentStates.some((s) => s.actorId === r.actorId && !s.alive)
          )
        )) ||
      !w.offline.some(
        (l) => l.campSlotId === r.campSlotId && levelKey(l.levelRef) === levelKey(r.levelRef)
      )
    )
      throw new World5Error('C5_BAD_REFERENCE', 'resident');
  }
  for (const o of w.orders) {
    exact(
      o,
      'id,owner,actorId,levelRef,definitionId,priority,planId,remainingEpochs,ticketId,status,stopReason,revision',
      'order'
    );
    owner(o.owner);
    ref(o.levelRef);
    for (const n of ['id', 'actorId', 'priority', 'planId', 'remainingEpochs', 'revision'] as const)
      uint(o[n], `order.${n}`, ['id', 'actorId', 'planId'].includes(n) ? 1 : 0);
    if (
      o.id >= w.nextWorldId ||
      o.planId >= w.nextPlanId ||
      o.remainingEpochs > 32 ||
      o.ticketId !== null ||
      !validId(o.definitionId) ||
      !o.definitionId.startsWith(o.owner + '.') ||
      !['working', 'stopped', 'needs-resupply'].includes(o.status) ||
      !(o.stopReason === null || typeof o.stopReason === 'string') ||
      !w.residents.some(
        (r) => r.actorId === o.actorId && levelKey(r.levelRef) === levelKey(o.levelRef)
      )
    )
      throw new World5Error('C5_BAD_REFERENCE', 'order');
  }
  for (const l of w.offline) {
    exact(
      l,
      'levelRef,campSlotId,lastSettledTick,epochRemainder,revision,seedKey,lastEventOrdinal,residentStates,pendingOutputs,needsResupply,frozen',
      'ledger'
    );
    ref(l.levelRef);
    for (const n of [
      'campSlotId',
      'lastSettledTick',
      'epochRemainder',
      'revision',
      'lastEventOrdinal'
    ] as const)
      uint(l[n], `ledger.${n}`);
    if (
      l.campSlotId > 7 ||
      l.lastSettledTick > w.simulationTicks ||
      l.epochRemainder !== l.lastSettledTick % 1000
    )
      throw new World5Error('C5_BAD_TIME', 'ledger');
    if (
      !/^[a-f0-9]{64}$/.test(l.seedKey) ||
      typeof l.needsResupply !== 'boolean' ||
      !Array.isArray(l.pendingOutputs) ||
      l.pendingOutputs.length
    )
      throw new World5Error('C5_BAD_PAYLOAD', 'ledger');
    list(l.residentStates, 16, 'residentStates');
    unique(
      l.residentStates.map((r) => r.actorId),
      'residentStates'
    );
    const ids = w.residents
      .filter((r) => r.campSlotId === l.campSlotId)
      .map((r) => r.actorId)
      .sort((a, b) => a - b);
    if (JSON.stringify(ids) !== JSON.stringify(l.residentStates.map((r) => r.actorId)))
      throw new World5Error('C5_BAD_REFERENCE', 'residentStates');
    for (const r of l.residentStates) {
      exact(r, 'actorId,alive,shortage', 'residentState');
      if (typeof r.alive !== 'boolean' || ![0, 1, 2, 3].includes(r.shortage))
        throw new World5Error('C5_BAD_PAYLOAD', 'residentState');
    }
    const f = l.frozen;
    exact(
      f,
      'capturedTick,rulesFingerprint,structureRevision,residents,facilities,knownThreats',
      'frozen'
    );
    uint(f.capturedTick, 'capturedTick');
    uint(f.structureRevision, 'structureRevision');
    if (
      f.capturedTick > w.simulationTicks ||
      !/^([a-f0-9]{64}|sha256:[a-f0-9]{64})$/.test(f.rulesFingerprint) ||
      (context.rulesFingerprint !== undefined && f.rulesFingerprint !== context.rulesFingerprint) ||
      !Array.isArray(f.facilities) ||
      f.facilities.length ||
      !Array.isArray(f.knownThreats) ||
      f.knownThreats.length > 128 ||
      f.knownThreats.some((t) => !validId(t))
    )
      throw new World5Error('C5_BAD_VERSION', 'frozen');
    if (
      !Array.isArray(f.residents) ||
      JSON.stringify(f.residents.map((r) => r.actorId)) !== JSON.stringify(ids)
    )
      throw new World5Error('C5_BAD_REFERENCE', 'frozen.residents');
    for (const r of f.residents) {
      exact(r, 'actorId,bedComponentId,route', 'frozen.resident');
      exact(r.route, 'reachable,distance,travelTicks', 'route');
      uint(r.route.distance, 'distance');
      uint(r.route.travelTicks, 'travelTicks');
      if (r.bedComponentId !== null || typeof r.route.reachable !== 'boolean')
        throw new World5Error('C5_BAD_PAYLOAD', 'route');
    }
  }
  for (const l of w.levels) {
    const k = levelKey(l.levelRef),
      ledger = w.offline.some((o) => levelKey(o.levelRef) === k);
    const reasons: PersistenceReason[] = [
      ...(ledger ? ['camp' as const] : []),
      ...(w.containers.some((r) => levelKey(r.levelRef) === k) ? ['container' as const] : []),
      ...(w.residents.some((r) => levelKey(r.levelRef) === k) ? ['resident' as const] : []),
      ...(w.orders.some((o) => levelKey(o.levelRef) === k) ||
      w.tickets.some(
        (t) => levelKey(t.levelRef) === k && ['working', 'suspended'].includes(t.status)
      )
        ? ['work' as const]
        : [])
    ];
    if (
      JSON.stringify(l.persistenceReasons) !== JSON.stringify(reasons) ||
      ledger !== (l.policy === 'frozen-ecology-economy-v1')
    )
      throw new World5Error('C5_BAD_REFERENCE', 'persistenceReasons');
  }
  unique(
    w.receipts.map((r) => r.identity),
    'receipts'
  );
  for (const r of w.receipts) {
    exact(r, 'owner,ordinal,identity,kind,levelRef,tick,result,reason', 'receipt');
    owner(r.owner);
    ref(r.levelRef);
    uint(r.ordinal, 'ordinal');
    uint(r.tick, 'tick');
    if (
      typeof r.identity !== 'string' ||
      r.identity.length > 256 ||
      !r.identity.length ||
      r.tick > w.simulationTicks ||
      !['offline', 'work', 'startup', 'placement', 'transfer'].includes(r.kind) ||
      !['completed', 'interrupted', 'skipped'].includes(r.result) ||
      (r.reason !== null && typeof r.reason !== 'string')
    )
      throw new World5Error('C5_BAD_PAYLOAD', 'receipt');
  }
}

interface WorldLayerCarrier {
  grid: object;
  monsters: readonly { id: number }[];
  dormantMonsters?: readonly { id: number }[];
  items: readonly { id: number }[];
}
export function assertWorldLevelOwnership(
  active: WorldLayerCarrier,
  cached: ReadonlyMap<number, WorldLayerCarrier>,
  pending: { monsters: readonly { id: number }[]; items: readonly { id: number }[] } = {
    monsters: [],
    items: []
  }
): void {
  const grids = new Set<object>(),
    actors = new Set<number>(),
    items = new Set<number>();
  for (const l of [active, ...cached.values()]) {
    if (grids.has(l.grid)) throw new World5Error('C5_BAD_OWNERSHIP', 'grid');
    grids.add(l.grid);
    for (const [rows, ids] of [
      [[...l.monsters, ...(l.dormantMonsters ?? [])], actors],
      [l.items, items]
    ] as const)
      for (const r of rows) {
        if (ids.has(r.id)) throw new World5Error('C5_BAD_OWNERSHIP', 'entity');
        ids.add(r.id);
      }
  }
  for (const [rows, ids] of [
    [pending.monsters, actors],
    [pending.items, items]
  ] as const)
    for (const r of rows) {
      if (ids.has(r.id)) throw new World5Error('C5_BAD_OWNERSHIP', 'pending.entity');
      ids.add(r.id);
    }
}
