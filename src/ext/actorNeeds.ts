import type { ModuleId, EntityId, Tick, JsonValue, DeepReadonly } from './worldSdk';
export interface ActorNeedDeclaration {
  owner: ModuleId;
  id: string;
  role: 'satiety'; // owner. 前缀；每 owner ≤4
  max: number;
  initial: number;
  ticksPerPoint: number; // 1..1000000；0≤initial≤max
  bands: readonly Readonly<{ id: string; atOrBelow: number }>[]; // 1..8，严格递减，bands[0].atOrBelow = max
  zeroDeadlineTicks: number | null; // 1..10000000
  departure: Readonly<{ visibleGraceTicks: number }> | null; // 0..100000，100 的倍数
}
export interface ActorNeedFacts {
  actorId: EntityId;
  monsterId: string | null;
  allied: boolean;
  inanimate: boolean;
  timedSummon: boolean;
  groupRole: 'single' | 'core' | 'member';
}
export type NeedTrigger =
  | 'ally-gained'
  | 'ally-lost'
  | 'group-changed'
  | 'resident-changed'
  | 'trusted';
export interface NeedEventFact {
  owner: ModuleId;
  factId: number;
  actorId: EntityId;
  needId: string;
  kind: 'attached' | 'detached' | 'band' | 'deadline';
  band: string;
  previousBand: string | null;
  value: number;
  crossedAtTick: Tick;
  tick: Tick;
  deferred: boolean;
  visibleToPlayer: boolean;
  reason: 'ineligible' | 'death' | 'departed' | null;
}
export interface NeedTransaction {
  readonly state: JsonValue;
  replaceState(next: JsonValue): void;
  setOwnComponent(actorId: EntityId, name: string, value: JsonValue): void;
  removeOwnComponent(actorId: EntityId, name: string): void;
  depart(actorId: EntityId): void; // 按声明 departure 走 H7
  message(key: string, params?: Readonly<Record<string, string | number>>): void;
}
export interface ActorNeedParticipant {
  qualifies(
    needId: string,
    facts: DeepReadonly<ActorNeedFacts>,
    ctx: Readonly<{
      queryOptional(capability: string, input: JsonValue): import('./types').OptionalQueryResult;
    }>
  ): boolean;
  onNeedEvent?(fact: DeepReadonly<NeedEventFact>, tx: NeedTransaction): void;
}
