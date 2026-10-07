import type { CommittedWorkFact } from '../../worldSdk';
import { loadCraftingPack } from './definitions';
import type { CraftingPack } from './types';

export type PlacementReceipt = {
  factId: number;
  definitionId: string;
  result: 'completed' | 'interrupted';
  tick: number;
};
export type HistoryEntry = {
  factId: number;
  operation: CommittedWorkFact['operation'];
  definitionId: string;
  completedBatches: number;
  result: 'completed' | 'interrupted' | 'skipped';
  reason: string | null;
  tick: number;
};
export type CraftingState = {
  schema: 1;
  lastFactId: number;
  totals: { harvest: number; craftBatches: number; placements: number; cancels: number; startup: number };
  placements: PlacementReceipt[];
  history: HistoryEntry[];
};

const operations = ['harvest', 'craft-batch', 'place-station', 'cancel', 'startup'];
const results = ['completed', 'interrupted', 'skipped'];
const totalKeys = ['harvest', 'craftBatches', 'placements', 'cancels', 'startup'];
const uint = (value: unknown, min = 0): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min;
function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && own.every(key => {
    if (typeof key !== 'string' || !keys.includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !!descriptor && descriptor.enumerable === true && 'value' in descriptor;
  });
}
function array(value: unknown, limit: number): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > limit)
    return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) return false;
  return keys.every(key => {
    if (key === 'length') return true;
    if (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !!descriptor && descriptor.enumerable === true && 'value' in descriptor;
  });
}
const definitionIds = (pack: CraftingPack) => new Set([
  ...pack.materials, ...pack.tools, ...pack.resourceNodes, ...pack.stations, ...pack.recipes
].map(row => row.id));

export function initialCraftingState(): CraftingState {
  return {
    schema: 1,
    lastFactId: 0,
    totals: { harvest: 0, craftBatches: 0, placements: 0, cancels: 0, startup: 0 },
    placements: [],
    history: []
  };
}

/** Fail closed even for non-JSON callers; persisted state is never repaired silently. */
export function validateCraftingState(value: unknown, inputPack?: CraftingPack): value is CraftingState {
  try {
    const pack = inputPack ?? loadCraftingPack();
    if (!record(value, ['schema', 'lastFactId', 'totals', 'placements', 'history']) ||
        value.schema !== 1 || !uint(value.lastFactId) || !record(value.totals, totalKeys) ||
        !totalKeys.every(key => uint(value.totals && (value.totals as Record<string, unknown>)[key])) ||
        !array(value.placements, pack.limits.placementReceipts) ||
        !array(value.history, pack.limits.workHistory)) return false;
    const ids = definitionIds(pack), stations = new Set(pack.stations.map(row => row.id));
    let previous = 0;
    for (const row of value.placements) {
      if (!record(row, ['factId', 'definitionId', 'result', 'tick']) ||
          !uint(row.factId, 1) || row.factId <= previous || row.factId > value.lastFactId ||
          typeof row.definitionId !== 'string' || !stations.has(row.definitionId) ||
          (row.result !== 'completed' && row.result !== 'interrupted') || !uint(row.tick)) return false;
      previous = row.factId;
    }
    previous = 0;
    for (const row of value.history) {
      if (!record(row, ['factId', 'operation', 'definitionId', 'completedBatches', 'result', 'reason', 'tick']) ||
          !uint(row.factId, 1) || row.factId <= previous || row.factId > value.lastFactId ||
          typeof row.operation !== 'string' || !operations.includes(row.operation) ||
          typeof row.definitionId !== 'string' || !ids.has(row.definitionId) ||
          !uint(row.completedBatches) || row.completedBatches > pack.limits.batchMax ||
          typeof row.result !== 'string' || !results.includes(row.result) ||
          (row.reason !== null && typeof row.reason !== 'string') || !uint(row.tick)) return false;
      previous = row.factId;
    }
    return true;
  } catch {
    return false;
  }
}

function validFact(value: unknown, pack: CraftingPack): value is CommittedWorkFact {
  return record(value, [
    'owner', 'factId', 'ticketId', 'completionOrdinal', 'operation', 'definitionId',
    'actorId', 'completedBatches', 'result', 'reason', 'tick'
  ]) && value.owner === 'crafting' && uint(value.factId, 1) &&
    (value.ticketId === null || uint(value.ticketId, 1)) && uint(value.completionOrdinal) &&
    typeof value.operation === 'string' && operations.includes(value.operation) &&
    typeof value.definitionId === 'string' && definitionIds(pack).has(value.definitionId) &&
    uint(value.actorId, 1) && uint(value.completedBatches) && value.completedBatches <= pack.limits.batchMax &&
    typeof value.result === 'string' && (value.result === 'accepted' || results.includes(value.result)) &&
    (value.reason === null || typeof value.reason === 'string') && uint(value.tick);
}
const increment = (value: number) => value < Number.MAX_SAFE_INTEGER ? value + 1 : value;

export function applyFact(state: CraftingState, fact: unknown, pack?: CraftingPack): CraftingState;
export function applyFact<T>(state: T, fact: unknown, pack?: CraftingPack): T | CraftingState;
export function applyFact(state: unknown, fact: unknown, inputPack?: CraftingPack): unknown {
  try {
    const pack = inputPack ?? loadCraftingPack();
    if (!validateCraftingState(state, pack) || !validFact(fact, pack) || fact.factId <= state.lastFactId)
      return state;
    if (fact.result === 'accepted') return { ...state, lastFactId: fact.factId };
    const totals = { ...state.totals };
    if (fact.operation === 'cancel') totals.cancels = increment(totals.cancels);
    else if (fact.operation === 'startup') totals.startup = increment(totals.startup);
    else if (fact.result === 'completed') {
      const key = fact.operation === 'harvest' ? 'harvest' :
        fact.operation === 'craft-batch' ? 'craftBatches' : 'placements';
      totals[key] = increment(totals[key]);
    }
    const placements = [...state.placements];
    if ((fact.operation === 'place-station' && fact.result === 'completed') ||
        (fact.operation === 'cancel' && pack.stations.some(row => row.id === fact.definitionId))) {
      placements.push({
        factId: fact.factId, definitionId: fact.definitionId,
        result: fact.operation === 'cancel' ? 'interrupted' : 'completed', tick: fact.tick
      });
    }
    const history: HistoryEntry[] = [...state.history, {
      factId: fact.factId, operation: fact.operation, definitionId: fact.definitionId,
      completedBatches: fact.completedBatches, result: fact.result, reason: fact.reason, tick: fact.tick
    }];
    const next: CraftingState = {
      schema: 1, lastFactId: fact.factId, totals,
      placements: placements.slice(Math.max(0, placements.length - pack.limits.placementReceipts)),
      history: history.slice(Math.max(0, history.length - pack.limits.workHistory))
    };
    return validateCraftingState(next, pack) ? next : state;
  } catch {
    return state;
  }
}
