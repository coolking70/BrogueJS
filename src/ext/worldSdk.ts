/** Frozen content-only C5-1 SDK. Trusted engine entry points are deliberately absent. */
import type { World5Snapshot } from './world5';
export type WorldId = number;
export type EntityId = number;
export type RegionId = EntityId;
export type CampSlotId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Revision = number;
export type ContentStamp = string;
export type Tick = number;
export type DefinitionId = string;
export type ModuleId = string;
export type Position = Readonly<{ x: number; y: number }>;
export type Bounds = Readonly<{ x: number; y: number; width: number; height: number }>;
export type LevelRef =
  | Readonly<{ kind: 'dungeon'; depth: number }>
  | Readonly<{ kind: 'site'; id: string }>;
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | Readonly<{ [key: string]: JsonValue }>;
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer U)[]
    ? readonly DeepReadonly<U>[]
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;
export type WorldErrorCode =
  | 'C5_BAD_PAYLOAD'
  | 'C5_BAD_DEFINITION'
  | 'C5_BAD_VERSION'
  | 'C5_DISABLED'
  | 'C5_UNSUPPORTED'
  | 'C5_SCOPE'
  | 'C5_STALE'
  | 'C5_PLAN_USED'
  | 'C5_BUSY'
  | 'C5_DEAD'
  | 'C5_GATE'
  | 'C5_UNKNOWN_TARGET'
  | 'C5_WRONG_LEVEL'
  | 'C5_DISTANCE'
  | 'C5_THREAT'
  | 'C5_TOOL'
  | 'C5_INPUT'
  | 'C5_CAPACITY'
  | 'C5_RESOURCE_EMPTY'
  | 'C5_RESERVED'
  | 'C5_BUDGET'
  | 'C5_OVERLAP'
  | 'C5_PROTECTED'
  | 'C5_BLOCKED'
  | 'C5_ROOM'
  | 'C5_NEEDS_RESUPPLY'
  | 'C5_BAD_TIME'
  | 'C5_BAD_OWNERSHIP'
  | 'C5_BAD_REFERENCE'
  | 'C5_PROVIDER'
  | 'C5_TRANSACTION'
  | 'C5_OVERFLOW'
  | 'C5_TERMINAL';
export type WorldResult<T> =
  | Readonly<{ ok: true; value: DeepReadonly<T> }>
  | Readonly<{ ok: false; code: WorldErrorCode; field: string | null }>;
export const C5_CONTRACT_VERSION = '1.0.0' as const;
export const WORLD_SDK_VERSION = 1 as const;
export { levelKey, compareLevelRefs } from './worldBasics';

declare const scopeBrand: unique symbol;
declare const planBrand: unique symbol;
export type WorldActorScope = Readonly<{
  [scopeBrand]: true;
  owner: ModuleId;
  actorId: EntityId;
  kind: 'player-command' | 'npc-decision' | 'trusted-world';
}>;
export type CasKey =
  | Readonly<{ kind: 'node'; interactableId: EntityId; revision: Revision }>
  | Readonly<{ kind: 'station'; interactableId: EntityId; revision: Revision }>
  | Readonly<{ kind: 'rest-point'; interactableId: EntityId; revision: Revision }>
  | Readonly<{ kind: 'container'; containerId: WorldId; revision: Revision }>
  | Readonly<{ kind: 'ticket'; ticketId: WorldId; revision: Revision }>
  | Readonly<{ kind: 'order'; orderId: WorldId; revision: Revision }>
  | Readonly<{ kind: 'component'; componentId: WorldId; revision: Revision }>
  | Readonly<{ kind: 'region'; regionId: RegionId; revision: Revision }>
  | Readonly<{ kind: 'inventory'; actorId: EntityId; stamp: ContentStamp }>;
export interface WorldPlanHandle {
  readonly [planBrand]: true;
  contract: 'C5-1';
  sessionId: string;
  owner: ModuleId;
  actorId: EntityId;
  operation: string;
  casKeys: readonly CasKey[];
}
export interface WorldCommit {
  operation: string;
  receiptIdentity: string;
  ticketId: WorldId | null;
  chargedTicks: Tick;
}
export interface ItemAmount {
  itemDefinitionId: DefinitionId;
  count: number;
}
export interface ItemDefinitionContribution {
  owner: ModuleId;
  id: DefinitionId;
  nameKey: string;
  descriptionKey: string;
  category: 'material' | 'tool' | 'kit' | 'native';
  glyph: string;
  color: string;
  maxStack: number;
  nativeTemplate: 'dagger' | 'leather_armor' | 'ration_of_food' | null;
  tags: readonly string[];
  tool: Readonly<{ tag: string; maxDurability: number; durabilityPerBatch: number }> | null;
}
export interface WorldItemFields {
  definitionId: DefinitionId;
  quality: 'basic';
  toolDurability: number | null;
}
export type NativeItemCategoryName =
  | 'weapon'
  | 'armor'
  | 'potion'
  | 'scroll'
  | 'food'
  | 'gold'
  | 'wand'
  | 'staff'
  | 'ring'
  | 'charm'
  | 'key'
  | 'amulet'
  | 'gem';
export type ItemOwnerRef =
  | Readonly<{ kind: 'inventory'; actorId: EntityId }>
  | Readonly<{ kind: 'floor'; levelRef: LevelRef; at: Position }>
  | Readonly<{ kind: 'carrier'; actorId: EntityId }>
  | Readonly<{ kind: 'container'; containerId: WorldId }>;
export type WorldPositionRef =
  | Readonly<{ kind: 'interactable'; interactableId: EntityId }>
  | Readonly<{ kind: 'structure'; componentId: WorldId }>;
export interface ContainerRecord {
  id: WorldId;
  owner: ModuleId;
  kind: 'chest' | 'escrow' | 'refund' | 'remains';
  levelRef: LevelRef;
  position: WorldPositionRef | null;
  capacity: number;
  itemIds: readonly EntityId[];
  revision: Revision;
  ticketId: WorldId | null;
}
export interface ItemRead {
  id: EntityId;
  category: 'material' | 'tool' | 'kit' | 'native';
  nativeCategory: NativeItemCategoryName | null;
  definitionId: DefinitionId | null;
  quantity: number;
  available: number;
  packSlots: number;
  tags: readonly string[];
  toolDurability: number | null;
}
export interface ContainerRead {
  id: WorldId;
  levelRef: LevelRef;
  at: Position | null;
  kind: ContainerRecord['kind'];
  revision: Revision;
  capacity: number;
  occupiedSlots: number;
  reservedSlots: number;
  items: readonly ItemRead[];
}
export interface ResourceDefinition {
  owner: ModuleId;
  id: DefinitionId;
  nameKey: string;
  descriptionKey: string;
  glyph: string;
  color: string;
  kind: 'wood' | 'stone' | 'ore' | 'fiber' | 'fungus';
  yield: readonly ItemAmount[];
  capacity: number;
  harvestTicks: Tick;
  unitsPerHarvest: number;
  requiredToolTag: string | null;
  regeneration:
    | Readonly<{ kind: 'none' }>
    | Readonly<{ kind: 'periodic'; units: number; intervalTicks: Tick }>;
  placement: Readonly<{
    dungeon: Readonly<{
      minDepth: number;
      maxDepth: number;
      maxPerDepth: number;
      maxPerRun: number;
      onNoSpace: 'skip' | 'defer';
    }> | null;
    site: Readonly<{
      siteTags: readonly string[];
      maxPerSite: number;
      maxPerRun: number;
      onNoSpace: 'skip' | 'defer';
    }> | null;
  }>;
}
export interface ResourceNodeRecord {
  interactableId: EntityId;
  owner: ModuleId;
  definitionId: DefinitionId;
  instanceKey: string;
  levelRef: LevelRef;
  at: Position;
  capacity: number;
  remaining: number;
  reservedUnits: number;
  regenRemainder: Tick;
  lastSettledTick: Tick;
  revision: Revision;
}
export interface StationDefinition {
  owner: ModuleId;
  id: DefinitionId;
  nameKey: string;
  descriptionKey: string;
  glyph: string;
  color: string;
  interactionDistance: number;
  stationTags: readonly string[];
  placementCost: readonly ItemAmount[];
  placementTicks: Tick;
  workPositionPolicy: 'adjacent-passable';
  kitDefinitionId: DefinitionId | null;
}
export interface StationRecord {
  interactableId: EntityId;
  owner: ModuleId;
  definitionId: DefinitionId;
  levelRef: LevelRef;
  boundComponentId: WorldId | null;
  revision: Revision;
}
export interface StationRead {
  interactableId: EntityId;
  definitionId: DefinitionId;
  levelRef: LevelRef;
  at: Position;
  revision: Revision;
  tags: readonly string[];
  workPositions: readonly Position[];
}
export interface RecipeDefinition {
  owner: ModuleId;
  id: DefinitionId;
  nameKey: string;
  descriptionKey: string;
  inputs: readonly ItemAmount[];
  outputs: readonly ItemAmount[];
  stationTags: readonly string[];
  toolTag: string | null;
  workTicks: Tick;
  offlineEligible: boolean;
}
export interface OutputReservation {
  destination: ItemOwnerRef;
  slots: number;
  mergeTargets: readonly EntityId[];
  counts: readonly ItemAmount[];
}
export interface WorkTicket {
  ticketId: WorldId;
  owner: ModuleId;
  actorId: EntityId;
  levelRef: LevelRef;
  kind: 'harvest' | 'craft' | 'station' | 'build';
  nodeId: EntityId | null;
  stationId: EntityId | null;
  sourceContainerId: WorldId | null;
  definitionId: DefinitionId;
  inputEscrowId: WorldId | null;
  outputReservation: OutputReservation | null;
  refundReservation: OutputReservation | null;
  resourceReservation: Readonly<{ nodeId: EntityId; units: number }> | null;
  totalBatches: number;
  completedBatches: number;
  remainingTicks: Tick;
  laborCreditTicks: Tick;
  bundleActionId: number | null;
  revision: Revision;
  status: 'working' | 'suspended' | 'completed' | 'cancelled';
  stopReason: string | null;
  lastCompletionOrdinal: number;
}
export interface StartupItemsDeclaration {
  instanceKey: string;
  items: readonly ItemAmount[];
  overflow: 'floor-then-skip';
}
export interface WorldDefinitionPack {
  schema: 1;
  worldSdk: 1;
  items: readonly ItemDefinitionContribution[];
  resourceNodes: readonly ResourceDefinition[];
  stations: readonly StationDefinition[];
  recipes: readonly RecipeDefinition[];
  startupItems: StartupItemsDeclaration | null;
}
export interface StartupGrantReceipt {
  owner: ModuleId;
  instanceKey: string;
  result: 'granted' | 'partial' | 'skipped';
  toInventory: readonly ItemAmount[];
  toFloor: readonly ItemAmount[];
  skipped: readonly ItemAmount[];
  tick: Tick;
}
export type KnownWorkQuery =
  | Readonly<{ kind: 'node'; interactableId: EntityId }>
  | Readonly<{ kind: 'station'; interactableId: EntityId }>
  | Readonly<{ kind: 'inventory' }>;
export interface WorkContext {
  contract: 'C5-1';
  owner: ModuleId;
  actorId: EntityId;
  levelRef: LevelRef;
  at: Position;
  inventoryStamp: ContentStamp;
  available: boolean;
  node: ResourceNodeRecord | null;
  stations: readonly StationRead[];
  inventory: readonly ItemRead[];
  containers: readonly ContainerRead[];
  activeTicket: WorkTicket | null;
}
export interface RecipePreview {
  recipeId: DefinitionId;
  batchCount: number;
  ok: boolean;
  reason: WorldErrorCode | null;
  inputs: readonly ItemAmount[];
  outputs: readonly ItemAmount[];
  totalTicks: Tick;
  outputSlots: number;
  refundSlots: number;
  stationTags: readonly string[];
  toolTag: string | null;
}
export type TimedWorkRequest =
  | Readonly<{
      kind: 'harvest';
      nodeId: EntityId;
      nodeRevision: Revision;
      inventoryStamp: ContentStamp;
      destinationId: WorldId | null;
      destinationRevision: Revision | null;
    }>
  | Readonly<{
      kind: 'craft';
      recipeId: DefinitionId;
      batchCount: number;
      stationId: EntityId | null;
      stationRevision: Revision | null;
      sourceContainerId: WorldId | null;
      sourceRevision: Revision | null;
      inventoryStamp: ContentStamp;
    }>;
export interface StationPlacementRequest {
  definitionId: DefinitionId;
  at: Position;
  inventoryStamp: ContentStamp;
}
export interface CancelWorkRequest {
  ticketId: WorldId;
  ticketRevision: Revision;
}
export interface WorldWorkPrepareSDK {
  readonly owner: ModuleId;
  readonly actorId: EntityId;
  readWorkContext(query: KnownWorkQuery): WorldResult<WorkContext>;
  planTimedWork(request: TimedWorkRequest): WorldResult<WorldPlanHandle>;
  planStationPlacement(request: StationPlacementRequest): WorldResult<WorldPlanHandle>;
  planCancelWork(request: CancelWorkRequest): WorldResult<WorldPlanHandle>;
}
export interface WorldWorkCommand {
  prepare(payload: JsonValue, sdk: WorldWorkPrepareSDK): WorldResult<WorldPlanHandle>;
}
export interface CommittedWorkFact {
  owner: ModuleId;
  factId: number;
  ticketId: WorldId | null;
  completionOrdinal: number;
  operation: 'harvest' | 'craft-batch' | 'place-station' | 'cancel' | 'startup';
  definitionId: DefinitionId;
  actorId: EntityId;
  completedBatches: number;
  result: 'accepted' | 'completed' | 'interrupted' | 'skipped';
  reason: string | null;
  tick: Tick;
}
/** Recently retired diagnostics; never a live ticket or budget owner. */
export type TerminalWorkTicket = Pick<
  WorkTicket,
  | 'ticketId'
  | 'owner'
  | 'actorId'
  | 'kind'
  | 'definitionId'
  | 'totalBatches'
  | 'completedBatches'
  | 'stopReason'
  | 'lastCompletionOrdinal'
> &
  Readonly<{ status: 'completed' | 'cancelled' }>;
export interface ModuleStateTransaction {
  readonly state: JsonValue;
  replaceState(next: JsonValue): void;
}
export interface WorldWorkParticipant {
  onCommitted(fact: DeepReadonly<CommittedWorkFact>, tx: ModuleStateTransaction): void;
}
export interface WorldWorkReadSDK {
  readonly contractVersion: '1.0.0';
  readonly worldSdk: 1;
  readonly owner: ModuleId;
  readWorkContext(query: KnownWorkQuery): WorldResult<WorkContext>;
  queryStations(): WorldResult<readonly StationRead[]>;
  queryContainers(): WorldResult<readonly ContainerRead[]>;
  previewRecipe(
    recipeId: DefinitionId,
    batchCount: number,
    stationId: EntityId | null,
    sourceContainerId: WorldId | null
  ): WorldResult<RecipePreview>;
  recentFacts(afterFactId: number): WorldResult<readonly CommittedWorkFact[]>;
}
export type CraftingAction = 'harvest' | 'craft' | 'place-station' | 'cancel-work';
export interface WorldModuleFields {
  worldDefinitions?: WorldDefinitionPack;
  worldWorkCommands?: Readonly<Partial<Record<CraftingAction, WorldWorkCommand>>>;
  worldWorkParticipant?: WorldWorkParticipant;
}
export interface WorldProjectionFields {
  readonly worldWork?: WorldWorkReadSDK;
}
export interface WorldDescriptorFields {
  readonly worldSdk: 1;
}
export type CraftingCommand =
  | Readonly<{
      module: 'crafting';
      action: 'harvest';
      payload: Readonly<{
        v: 1;
        nodeId: EntityId;
        nodeRevision: Revision;
        inventoryStamp: ContentStamp;
        destinationId: WorldId | null;
        destinationRevision: Revision | null;
      }>;
    }>
  | Readonly<{
      module: 'crafting';
      action: 'craft';
      payload: Readonly<{
        v: 1;
        recipeId: DefinitionId;
        batchCount: number;
        stationId: EntityId | null;
        stationRevision: Revision | null;
        sourceContainerId: WorldId | null;
        sourceRevision: Revision | null;
        inventoryStamp: ContentStamp;
      }>;
    }>
  | Readonly<{
      module: 'crafting';
      action: 'place-station';
      payload: Readonly<{
        v: 1;
        definitionId: DefinitionId;
        x: number;
        y: number;
        inventoryStamp: ContentStamp;
      }>;
    }>
  | Readonly<{
      module: 'crafting';
      action: 'cancel-work';
      payload: Readonly<{ v: 1; ticketId: WorldId; ticketRevision: Revision }>;
    }>;
export interface WorldHarnessOptions {
  seed: number;
  mode?: 'normal' | 'easy';
  modules: readonly string[];
  fixtures?: readonly ('world-work-basic' | 'crafting-skeleton')[];
}
export interface WorldHarness {
  ext(
    module: string,
    action: string,
    payload: JsonValue,
    answers?: readonly boolean[]
  ): Readonly<{ recorded: boolean; error: WorldErrorCode | null }>;
  command(action: string, data?: JsonValue): void;
  runAutoUntilIdle(maxCommands: number): number;
  readWorkContext(owner: ModuleId, query: KnownWorkQuery): WorldResult<WorkContext>;
  world5(): DeepReadonly<World5Snapshot> | null;
  save(): string;
  load(save: string): void;
  exportRecording(): string;
  replay(recording: string): Readonly<{ ok: boolean; firstMismatch: number | null }>;
  seek(recording: string, afterCommand: number): void;
  digest(): string;
  dispose(): void;
}
