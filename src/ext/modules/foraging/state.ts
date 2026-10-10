import type { FireContactFact, NeedEventFact } from '../../edibleSdk';
import type { ForagingPack, ForagingState, HungerBand } from './types';
import { loadForagingPack } from './definitions';
import { dataRecord, inspectConsumedFact, safeUint } from './knowledge';
export type { ForagingState } from './types';
const totalKeys = ['eaten', 'fed', 'revealed', 'roasted', 'charred', 'burned', 'exploded', 'departed'] as const;
const results = {
  eat: ['revealed', 'tasted', 'food'], feed: ['revealed', 'tasted', 'food'],
  fire: ['transformed', 'burned-up', 'exploded', 'destroyed'], need: ['attached', 'band', 'deadline', 'detached']
} as const;
export function isHungerBand(v: unknown): v is HungerBand {
  return typeof v === 'string' && ['fed', 'hungry', 'weak', 'starving'].includes(v);
}
export function validateHunger(value: unknown): value is { band: HungerBand } {
  try { return dataRecord(value, ['band']) && isHungerBand(value.band); } catch { return false; }
}
function array(value: unknown, limit: number): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > limit) return false;
  const keys = Reflect.ownKeys(value);
  return keys.length === value.length + 1 && keys.every(key => {
    if (key === 'length') return true;
    const d = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length && !!d && d.enumerable && 'value' in d;
  });
}
export function initialForagingState(): ForagingState {
  return { schema: 1, lastFactId: 0, totals: { eaten: 0, fed: 0, revealed: 0, roasted: 0, charred: 0, burned: 0, exploded: 0, departed: 0 }, history: [] };
}
export function validateForagingState(value: unknown, pack: ForagingPack = loadForagingPack()): value is ForagingState {
  try {
    if (!dataRecord(value, ['schema', 'lastFactId', 'totals', 'history']) || value.schema !== 1 || !safeUint(value.lastFactId) ||
      !dataRecord(value.totals, totalKeys) || !totalKeys.every(k => safeUint((value.totals as Record<string, unknown>)[k])) ||
      !array(value.history, Math.min(64, pack.limits.history))) return false;
    let previous = 0;
    for (const row of value.history) {
      if (!dataRecord(row, ['factId', 'kind', 'result', 'tick']) || !safeUint(row.factId, 1) || row.factId <= previous ||
        row.factId > value.lastFactId || !safeUint(row.tick) || typeof row.kind !== 'string' || !Object.prototype.hasOwnProperty.call(results, row.kind) ||
        typeof row.result !== 'string' || !(results[row.kind as keyof typeof results] as readonly string[]).includes(row.result)) return false;
      previous = row.factId;
    }
    return true;
  } catch { return false; }
}
export function validFireFact(value: unknown, pack: ForagingPack): value is FireContactFact {
  try {
    return dataRecord(value, ['owner', 'factId', 'itemId', 'definitionId', 'quantity', 'cause', 'location', 'at', 'result', 'toDefinitionId', 'explosion', 'visibleToPlayer', 'tick']) &&
      value.owner === 'foraging' && safeUint(value.factId, 1) && safeUint(value.itemId, 1) && safeUint(value.quantity, 1) && value.quantity <= pack.limits.maxStack &&
      pack.edibleItems.some(d => d.id === value.definitionId) &&
      ['spawn-fire', 'thrown', 'floor-burning', 'carrier-ignited', 'roast-command', 'heat-source-throw', 'lava'].includes(value.cause as string) &&
      ['floor', 'inventory'].includes(value.location as string) && dataRecord(value.at, ['x', 'y']) && Number.isSafeInteger(value.at.x) && Number.isSafeInteger(value.at.y) &&
      (results.fire as readonly unknown[]).includes(value.result) && (value.toDefinitionId === null || pack.edibleItems.some(d => d.id === value.toDefinitionId)) &&
      [null, 'explosion-fire', 'bloat-explosion'].includes(value.explosion as string | null) && typeof value.visibleToPlayer === 'boolean' && safeUint(value.tick);
  } catch { return false; }
}
export function validNeedFact(value: unknown, pack: ForagingPack): value is NeedEventFact {
  try {
    return dataRecord(value, ['owner', 'factId', 'actorId', 'needId', 'kind', 'band', 'previousBand', 'value', 'crossedAtTick', 'tick', 'deferred', 'visibleToPlayer', 'reason']) &&
      value.owner === 'foraging' && value.needId === pack.companion.needId && safeUint(value.factId, 1) && safeUint(value.actorId, 1) &&
      (results.need as readonly unknown[]).includes(value.kind) && isHungerBand(value.band) && (value.previousBand === null || isHungerBand(value.previousBand)) &&
      safeUint(value.value) && value.value <= pack.actorNeeds[0]!.max && safeUint(value.crossedAtTick) && safeUint(value.tick) &&
      typeof value.deferred === 'boolean' && typeof value.visibleToPlayer === 'boolean' && [null, 'ineligible', 'death', 'departed'].includes(value.reason as string | null);
  } catch { return false; }
}
const increment = (value: number) => Math.min(Number.MAX_SAFE_INTEGER, value + 1);
export function applyFact(state: ForagingState, fact: unknown, pack?: ForagingPack, knowledgeChanged?: boolean): ForagingState;
export function applyFact<T>(state: T, fact: unknown, pack?: ForagingPack, knowledgeChanged?: boolean): T | ForagingState;
/** Only enum receipts survive into the module namespace; identity and knowledge stay in foundation. */
export function applyFact(state: unknown, fact: unknown, inputPack?: ForagingPack, knowledgeChanged = false): unknown {
  try {
    const pack = inputPack ?? loadForagingPack();
    if (!validateForagingState(state, pack)) return state;
    const consumed = inspectConsumedFact(fact, pack);
    const fire = validFireFact(fact, pack) ? fact : null;
    const need = validNeedFact(fact, pack) ? fact : null;
    const valid = consumed?.fact ?? fire ?? need;
    if (!valid || valid.factId <= state.lastFactId) return state;
    const totals = { ...state.totals };
    let kind: ForagingState['history'][number]['kind'];
    let result: ForagingState['history'][number]['result'];
    if (consumed) {
      kind = consumed.fact.operation;
      result = consumed.kind === null ? 'food' : consumed.revealed ? 'revealed' : 'tasted';
      const key = kind === 'eat' ? 'eaten' : 'fed'; totals[key] = increment(totals[key]);
    } else if (fire) {
      kind = 'fire'; result = fire.result;
      const key = fire.result === 'transformed'
        ? (pack.knowledgeGroups[0]!.kinds.some(k => k.raw === fire.definitionId) ? 'roasted' : 'charred')
        : fire.result === 'exploded' ? 'exploded' : 'burned';
      totals[key] = increment(totals[key]);
    } else {
      kind = 'need'; result = need!.kind;
      if (need!.kind === 'detached' && need!.reason === 'departed') totals.departed = increment(totals.departed);
    }
    if (knowledgeChanged) totals.revealed = increment(totals.revealed);
    const next: ForagingState = { schema: 1, lastFactId: valid.factId, totals,
      history: [...state.history, { factId: valid.factId, kind, result, tick: valid.tick }].slice(-pack.limits.history) };
    return validateForagingState(next, pack) ? next : state;
  } catch { return state; }
}
