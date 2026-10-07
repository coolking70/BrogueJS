import type {
  DefinitionId,
  ModuleId,
  EntityId,
  Revision,
  ContentStamp,
  Tick,
  Position,
  JsonValue,
  DeepReadonly,
  WorldResult
} from './worldSdk';
export const EDIBLE_SDK_VERSION = 1 as const;
export type EdibleStatusId =
  | 'poisoned'
  | 'hallucinating'
  | 'confused'
  | 'nauseous'
  | 'telepathy'
  | 'darkness'
  | 'haste'
  | 'paralyzed'
  | 'slumber';
export type EffectIntent =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'heal-fraction'; percent: number; min: number }> // 1..100 / 0..1000
  | Readonly<{ kind: 'status'; status: EdibleStatusId; turns: number }> // 1..1000
  | Readonly<{
      kind: 'status-and-satiety';
      status: 'nauseous';
      turns: number;
      satietyLoss: number;
      floor: number;
    }> // 1..2150 / 0..2150
  | Readonly<{
      kind: 'temp-stat';
      turns: number; // 1..2000
      player: Readonly<{ key: string; value: number }>; // flat，物化键
      other: Readonly<{ key: string; category: 'increased' | 'more'; valueBp: number }>;
    }>
  | Readonly<{ kind: 'explosive' }>; // 吃/喂无效果
export type EdibleEffect =
  | EffectIntent
  | Readonly<{
      kind: 'derived-choice';
      domainId: string;
      ordinal: number;
      options: readonly EffectIntent[];
    }>; // 2..8，不可嵌套
export type FireBehavior =
  | Readonly<{ onContact: 'transform'; to: DefinitionId; messageKey: string }>
  | Readonly<{ onContact: 'burn-up'; messageKey: string }>
  | Readonly<{ onContact: 'explode'; largeAtQuantity: number; messageKey: string }>; // 1..20
export interface EdibleItemDefinition {
  owner: ModuleId;
  id: DefinitionId;
  nameKey: string;
  descriptionKey: string;
  glyph: string;
  color: string;
  maxStack: number; // 1..20
  tags: readonly string[]; // ≤16，去重码点序
  satiety: number; // 0..2150
  effect: EdibleEffect;
  fire: FireBehavior;
}

export type EdibleAction = 'feed' | 'roast';
export interface FeedRequest {
  targetId: EntityId;
  targetRevision: Revision; // = 目标需求行 revision
  itemId: EntityId;
  inventoryStamp: ContentStamp;
}
export interface RoastRequest {
  heatSourceId: EntityId;
  itemId: EntityId;
  inventoryStamp: ContentStamp;
}
declare const ediblePlanBrand: unique symbol;
export interface EdiblePlanHandle {
  readonly [ediblePlanBrand]: true;
  operation: EdibleAction;
  owner: ModuleId;
  actorId: EntityId;
}
export interface EdibleItemRead {
  itemId: EntityId;
  definitionId: DefinitionId | null;
  nativeFood: 'ration_of_food' | 'mango' | null;
  quantity: number;
  displayName: string;
  knowledge: 'unknown' | 'tasted' | 'known' | null;
  satiety: number | null; // 非 known 时 null
  tags: readonly string[];
}
export interface FeedTargetRead {
  actorId: EntityId;
  needId: string;
  targetRevision: Revision;
  band: string;
  value: number;
  departing: boolean;
}
export interface HeatSourceRead {
  interactableId: EntityId;
  kind: 'bonfire' | 'hearth-station';
  at: Position;
  interactionDistance: number;
}
export interface EdibleContext {
  actorId: EntityId;
  at: Position;
  inventoryStamp: ContentStamp;
  inventory: readonly EdibleItemRead[];
  feedTargets: readonly FeedTargetRead[];
  heatSources: readonly HeatSourceRead[];
}
export interface EdiblePrepareSDK {
  readonly owner: ModuleId;
  readonly actorId: EntityId;
  readEdibleContext(): WorldResult<EdibleContext>;
  planFeed(request: FeedRequest): WorldResult<EdiblePlanHandle>;
  planRoast(request: RoastRequest): WorldResult<EdiblePlanHandle>;
}
export interface EdibleCommand {
  prepare(payload: JsonValue, sdk: EdiblePrepareSDK): WorldResult<EdiblePlanHandle>;
}

export interface EffectOutcome {
  intent: EffectIntent['kind'];
  applied: boolean;
  newlyStarted: boolean;
  immune: boolean;
  notApplicable: boolean;
  hpGained: number;
  satietyGained: number;
  satietyLost: number;
}
export interface EdibleConsumedFact {
  owner: ModuleId;
  factId: number;
  operation: 'eat' | 'feed';
  eaterId: EntityId;
  feederId: EntityId | null;
  definitionId: DefinitionId | null;
  nativeFood: 'ration_of_food' | 'mango' | null;
  resolvedIntent: EffectIntent;
  outcome: EffectOutcome;
  hpBefore: number;
  maxHp: number;
  visibleToPlayer: boolean;
  tick: Tick;
}
export interface EdibleTransaction {
  readonly state: JsonValue;
  replaceState(next: JsonValue): void;
  markKnowledge(definitionId: DefinitionId, state: 'tasted' | 'known'): boolean;
  message(key: string, params?: Readonly<Record<string, string | number>>): void;
}
export interface EdibleParticipant {
  onConsumed?(fact: DeepReadonly<EdibleConsumedFact>, tx: EdibleTransaction): void;
  onFireContact?(fact: DeepReadonly<FireContactFact>, tx: EdibleTransaction): void;
}

export type FireContactCause =
  | 'spawn-fire'
  | 'thrown'
  | 'floor-burning'
  | 'carrier-ignited'
  | 'roast-command'
  | 'heat-source-throw'
  | 'lava';
export interface FireContactFact {
  owner: ModuleId;
  factId: number;
  itemId: EntityId;
  definitionId: DefinitionId;
  quantity: number;
  cause: FireContactCause;
  location: 'floor' | 'inventory';
  at: Position;
  result: 'transformed' | 'burned-up' | 'exploded' | 'destroyed';
  toDefinitionId: DefinitionId | null;
  explosion: 'explosion-fire' | 'bloat-explosion' | null;
  visibleToPlayer: boolean;
  tick: Tick;
}
