import type { ExtensionModule } from '../../types';
import type { ActorNeedDeclaration, EdibleItemDefinition, KindKnowledgeGroup } from '../../edibleSdk';
import type { ResourceDefinition, WorldErrorCode } from '../../worldSdk';

/** Derive trusted declarations from the public module contract, never implementation imports. */
export type ForagingWorldPack = NonNullable<ExtensionModule['worldDefinitions']>;
export type ForagingPlacementGroup = NonNullable<ForagingWorldPack['placementGroups']>[number];
export type ForagingStatSources = NonNullable<ExtensionModule['statSources']>;
export type ForagingStatContext = Parameters<ForagingStatSources['collect']>[1];
export type ForagingStatRow = ReturnType<ForagingStatSources['collect']>[number];
export type ForagingBand = 'fed' | 'hungry' | 'weak' | 'starving';
export type HungerBand = ForagingBand;

export interface ForagingKind {
  id: string;
  minDepth: number;
  weight: number;
  satiety: number;
  reveal: 'always' | 'if-injured' | 'if-not-already' | 'on-explosion';
  companionReveal: boolean;
}
export interface CompanionRules {
  needId: 'foraging.companion-satiety';
  component: 'hunger';
  penalties: { band: 'weak' | 'starving'; accuracyIncreasedBp: number; damageIncreasedBp: number }[];
  nonEaters: string[];
  residentQuery: 'settlement.resident-status.v1';
}
export interface ForagingLimits {
  kinds: number;
  appearancePool: number;
  edibleItems: number;
  maxStack: number;
  nodesPerLevel: number;
  nodesPerRun: number;
  nonEaters: number;
  history: number;
}
export interface ForagingPack {
  schema: 1;
  moduleId: 'foraging';
  moduleVersion: '1.0.0';
  rulesVersion: '1.0.0';
  kinds: ForagingKind[];
  edibleItems: EdibleItemDefinition[];
  resourceNodes: ResourceDefinition[];
  knowledgeGroups: KindKnowledgeGroup[];
  placementGroups: ForagingPlacementGroup[];
  actorNeeds: ActorNeedDeclaration[];
  companion: CompanionRules;
  limits: ForagingLimits;
}
export type ForagingHistoryEntry = {
  factId: number;
  kind: 'eat' | 'feed' | 'fire' | 'need';
  result: 'revealed' | 'tasted' | 'food' | 'transformed' | 'burned-up' | 'exploded' | 'destroyed' | 'attached' | 'band' | 'deadline' | 'detached';
  tick: number;
};
export type ForagingState = {
  schema: 1;
  lastFactId: number;
  totals: { eaten: number; fed: number; revealed: number; roasted: number; charred: number; burned: number; exploded: number; departed: number };
  history: ForagingHistoryEntry[];
};
export type ForagingAvailableView = {
  v: 1;
  available: true;
  inventoryStamp: string;
  activeTicket: null | { ticketId: number; remainingTicks: number };
  nodes: { interactableId: number; remaining: number; capacity: number; available: number; nodeRevision: number; canHarvest: boolean; reason: WorldErrorCode | null }[];
  foods: { itemId: number; displayName: string; quantity: number; source: 'foraging' | 'native'; knowledge: 'unknown' | 'tasted' | 'known' | null; satiety: number | null; roastable: boolean }[];
  companions: { actorId: number; targetRevision: number; band: ForagingBand; departing: boolean }[];
  heatSources: { interactableId: number; kind: 'bonfire' | 'hearth-station' }[];
};
export type ForagingView = ForagingAvailableView | { v: 1; available: false };
