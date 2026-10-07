/** Trusted foundation declarations. The frozen crafting SDK stays byte-identical. */
import type {
  WorldDefinitionPack as WorkPack,
  ItemAmount,
  LevelRef,
  Position,
  WorldActorScope,
  WorldPlanHandle,
  WorldResult
} from './worldSdk';
export type StructureSlot = 'floor' | 'barrier' | 'roof' | 'fixture';
export interface StructureDefinition {
  owner: string;
  id: string;
  slot: StructureSlot;
  barrierKind: 'wall' | 'door' | 'window' | null;
  nameKey: string;
  descriptionKey: string;
  maxHp: number;
  blocks: Readonly<{
    movement: boolean;
    vision: boolean;
    physicalProjectile: boolean;
    magicProjectile: boolean;
    gas: boolean;
    liquid: boolean;
  }>;
  flammable: boolean;
  resistances: Readonly<{ physical: number; fire: number }>;
  constructionCost: readonly ItemAmount[];
  constructionTicks: number;
  refundNumerator: number;
  refundDenominator: number;
  containerCapacity: number | null;
  stationDefinitionId: string | null;
  restPointDefinitionId: string | null;
  tags: readonly string[];
}
export interface StructureComponent {
  id: number;
  definitionId: string;
  hp: number;
  doorOpen: boolean | null;
  revision: number;
}
export interface StructureCell {
  owner: string;
  regionId: number;
  levelRef: LevelRef;
  at: Position;
  floor: StructureComponent | null;
  barrier: StructureComponent | null;
  roof: StructureComponent | null;
  fixture: StructureComponent | null;
}
export interface CellProperties {
  baseTerrainFlags: number;
  baseMechFlags: number;
  blocksMovement: boolean;
  blocksVision: boolean;
  blocksScent: boolean;
  blocksPhysicalProjectile: boolean;
  blocksMagicProjectile: boolean;
  blocksGas: boolean;
  blocksLiquid: boolean;
  stableFloor: boolean;
  usableRoof: boolean;
  roofBlocksSunlight: boolean;
  flammable: boolean;
  terrainRevision: number;
}
export interface RoomRead {
  sessionRoomId: string;
  levelRef: LevelRef;
  structureRevision: number;
  cells: readonly Position[];
  closedBoundary: boolean;
  completeRoof: boolean;
  tags: readonly ('bedroom' | 'warehouse' | 'workshop')[];
  bedIds: readonly number[];
  containerIds: readonly number[];
  stationIds: readonly number[];
  ventilated: boolean;
}
export type RegionChange =
  | Readonly<{
      kind: 'create';
      instanceKey: string;
      levelRef: LevelRef;
      bounds: { x: number; y: number; width: number; height: number };
    }>
  | Readonly<{
      kind: 'expand';
      regionId: number;
      revision: number;
      bounds: { x: number; y: number; width: number; height: number };
    }>
  | Readonly<{ kind: 'retire'; regionId: number; revision: number }>;
export type StructureChange =
  | Readonly<{
      kind: 'build';
      regionId: number;
      levelRef: LevelRef;
      at: Position;
      definitionId: string;
    }>
  | Readonly<{ kind: 'door'; componentId: number; revision: number; open: boolean }>
  | Readonly<{ kind: 'dismantle'; componentId: number; revision: number }>
  | Readonly<{
      kind: 'damage';
      componentId: number;
      revision: number;
      amount: number;
      damageKind: 'physical' | 'fire';
    }>;
export interface RestPointDefinition {
  owner: string;
  id: string;
  nameKey: string;
  descriptionKey: string;
  glyph: string;
  color: string;
  maxRestTicks: number;
  interactionDistance: number;
  restorePolicy: Readonly<{ hp: 'native-over-time' | 'none'; optionalCombatResources: 'none' }>;
  resetPolicy: 'none';
}
export interface RestPoint {
  interactableId: number;
  owner: string;
  definitionId: string;
  levelRef: LevelRef;
  boundComponentId: number | null;
  revision: number;
  lastUseOrdinal: number;
}
export interface RestRequest {
  restPointId: number;
  revision: number;
}
export interface RestPointPlacementRequest {
  definitionId: string;
  levelRef: LevelRef;
  at: Position;
}
export interface WorldDefinitionPack extends WorkPack {
  structures?: readonly StructureDefinition[];
  restPoints?: readonly RestPointDefinition[];
}
export interface RestPointAction {
  kind: 'rest_point';
  restPointId: number;
  revision: number;
  ordinal: number;
  remaining: number;
  hp: number;
  depth: number;
  anchor: Position;
}
// Keep signatures on the trusted engine entrance, never in a module SDK.
export type TrustedPlanner<T> = (
  request: T,
  scope: WorldActorScope
) => WorldResult<WorldPlanHandle>;
