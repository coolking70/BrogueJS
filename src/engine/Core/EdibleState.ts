/** Foundation food roots. No root exists before a first mechanical write. */
import type { ExtensionRuntime } from '../../ext/runtime';
import type { KindKnowledgeState } from '../../ext/kindKnowledge';
export interface KindKnowledgeRow {
  groupId: string;
  definitionId: string;
  state: KindKnowledgeState;
  title: string | null;
}
export interface KindKnowledgeSnapshot {
  schema: 1;
  rows: KindKnowledgeRow[];
}
export interface ActorNeedRow {
  actorId: number;
  needId: string;
  value: number;
  remainderTicks: number;
  lastSettledTick: number;
  zeroSinceTick: number | null;
  deadlineFired: boolean;
  band: string;
  revision: number;
}
export interface ActorNeedsSnapshot {
  schema: 1;
  rows: ActorNeedRow[];
}
export interface TimedStatRow {
  actorId: number;
  owner: string;
  key: string;
  category: 'flat' | 'increased' | 'more';
  value: number;
  untilTick: number;
}
export interface TimedStatsSnapshot {
  schema: 1;
  rows: TimedStatRow[];
}
export interface DepartureRow {
  actorId: number;
  owner: string;
  reason: string;
  startedTick: number;
  untilTick: number;
}
export interface DepartureReceipt {
  ordinal: number;
  actorId: number;
  owner: string;
  reason: string;
  tick: number;
  result: 'retired';
}
export interface DeparturesSnapshot {
  schema: 1;
  nextOrdinal: number;
  active: DepartureRow[];
  receipts: DepartureReceipt[];
}
export interface EdibleState {
  kindKnowledge?: KindKnowledgeSnapshot;
  actorNeeds?: ActorNeedsSnapshot;
  timedStats?: TimedStatsSnapshot;
  departures?: DeparturesSnapshot;
}
const roots = new WeakMap<ExtensionRuntime, EdibleState>();
const empty: EdibleState = Object.freeze({});
export function peekEdibleState(runtime: ExtensionRuntime): Readonly<EdibleState> {
  return roots.get(runtime) ?? empty;
}
export function edibleState(runtime: ExtensionRuntime): EdibleState {
  let s = roots.get(runtime);
  if (!s) {
    s = {};
    roots.set(runtime, s);
  }
  return s;
}
export function edibleSnapshot(runtime: ExtensionRuntime): EdibleState {
  return structuredClone(roots.get(runtime) ?? {});
}
export function restoreEdibleState(runtime: ExtensionRuntime, state: EdibleState): void {
  const before = roots.get(runtime);
  if (!before) {
    if (Object.keys(state).length) roots.set(runtime, structuredClone(state));
    return;
  }
  const adopt = (target: any, source: any): any => {
    if (!source || typeof source !== 'object') return source;
    if (Array.isArray(source)) {
      if (!Array.isArray(target)) target = [];
      for (let i = 0; i < source.length; i++) target[i] = adopt(target[i], source[i]);
      target.length = source.length;
      return target;
    }
    if (!target || typeof target !== 'object' || Array.isArray(target)) target = {};
    for (const key of Object.keys(target)) if (!(key in source)) delete target[key];
    for (const [k, v] of Object.entries(source)) target[k] = adopt(target[k], v);
    return target;
  };
  adopt(before, state);
}
export function cleanEdibleState(runtime: ExtensionRuntime): void {
  const s = roots.get(runtime);
  if (!s) return;
  for (const k of ['kindKnowledge', 'actorNeeds', 'timedStats'] as const)
    if (s[k]?.rows.length === 0) delete s[k];
  if (s.departures && !s.departures.active.length && !s.departures.receipts.length)
    delete s.departures;
}
