/** Independent production structures SDK v1. Content receives detached views only. */
import type { ItemAmount } from './worldSdk';
export interface CampPolicy {
  markerDefinitionId: string;
  nameKey: string;
  descriptionKey: string;
  glyph: string;
  color: string;
  createCost: readonly ItemAmount[];
  expandCost: readonly ItemAmount[];
  createTicks: number;
  expandTicks: number;
  dismantleTicks: number;
  retireTicks: number;
  supplyCapacity: number;
  requiredFood: number;
}
export interface CampRecord {
  regionId: number;
  depth: number;
  slot: number;
  ordinal: number;
  revision: number;
  markerId: number;
  supplyId: number;
  consumedLockedUnits: number;
  granaryIds: number[];
  locked: { itemId: number; quantity: number }[];
  reportTick: number;
  reportItems: { itemId: number; quantity: number; name: string }[];
}
export interface ConstructionReceipt {
  componentId: number;
  materials: { itemDefinitionId: string; count: number }[];
}
export interface CampState {
  schema: 2;
  spawnSlots: import("./residentSdk").ResidentSpawnSlot[];
  plotDays: {componentId:number;day:number}[];
  revision: number;
  camps: CampRecord[];
  constructions: ConstructionReceipt[];
  history: { regionId: number; slot: number; ordinal: number; tick: number; operation: string }[];
}
export interface StructureReadSDK {
  read(): unknown;
}
export const STRUCTURE_ACTIONS = [
  'establish',
  'expand',
  'retire',
  'build',
  'dismantle',
  'door',
  'transfer',
  'rest'
] as const;
export type StructureAction = (typeof STRUCTURE_ACTIONS)[number];
