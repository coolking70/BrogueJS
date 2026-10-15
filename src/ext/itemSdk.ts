/** C6-1 item capabilities. Candidate until the integration report freezes v1. */
import type { ReadonlyJson } from './types';
export const ITEM_SDK_VERSION = 1 as const;
export type ItemModuleData = Readonly<Record<string, ReadonlyJson>>;
export type ItemDataPhase = 'create' | 'update' | 'save' | 'load';
export interface ItemFacts {
  readonly id: number;
  readonly category: number;
  readonly kindKey: string;
  readonly materialDefinitionId?: string;
  readonly quantity: number;
  readonly identified: boolean;
  readonly enchantment: number;
  readonly isCursed: boolean;
  readonly moduleData?: ItemModuleData;
}
export interface ItemDataValidationContext {
  readonly owner: string;
  readonly enabledModules: readonly string[];
  readonly item: ItemFacts;
  readonly phase: ItemDataPhase;
}
export type ItemDataValidator = (value: ReadonlyJson, context: ItemDataValidationContext) => boolean;
export interface ItemContribution {
  readonly itemPickup?: (item:ItemFacts,state:ReadonlyJson)=>boolean;
  readonly itemCommands?: Readonly<Record<string,ItemCommandProvider>>;
  readonly itemPresentation?: ItemPresentationProvider;
  readonly itemKnowledge?: ItemKnowledgeProvider;
  readonly itemDrops?: DropProvider;
  /** IDs of this owner’s generation templates that constitute encounters. */
  readonly itemEncounters?: readonly string[];
  readonly itemDataValidators?: Readonly<Record<string, ItemDataValidator>>;
}

export type ItemClass = 'weapon' | 'armor' | 'ring';
export type DropSource = 'floor' | 'kill' | 'encounter' | 'vault';
export type At = Readonly<{ x: number; y: number }>;
interface DropBase {
  readonly v: 1;
  readonly eventId: number;
  readonly level: Readonly<{ kind: 'dungeon'; depth: number }>;
  readonly at: At;
  readonly playerId: number;
}
export type DropEvent = DropBase & (
  | { readonly source: 'floor'; readonly itemClass: ItemClass }
  | { readonly source: 'vault'; readonly itemClass: ItemClass;
      readonly baseId: string | null; readonly highValue: boolean;
      readonly qualifiers?: readonly string[] }
  | { readonly source: 'kill'; readonly actorId: number;
      readonly monster: Readonly<{ typeId: string; leader: boolean;
        champion: boolean; encounterSubject: boolean }> }
  | { readonly source: 'encounter'; readonly encounterKey: string;
      readonly encounterOrdinal: number; readonly formId: string | null }
);
export interface NativeAssembly {
  readonly kind: string;
  readonly category: ItemClass;
  readonly enchantment: number;
  readonly runicType: string | null;
  readonly isCursed: boolean;
  readonly identified: boolean;
  readonly familiarityRemaining: number;
}
export interface DropItemSpec {
  readonly native: NativeAssembly;
  readonly moduleData: ItemModuleData;
}
export interface DropRollContext {
  readonly owner: string;
  readonly state: ReadonlyJson;
  readonly event: DropEvent;
  /** Switch to a monotonically increasing item draw bucket (0..7); gold uses bucket 8. */
  beginItem(index: number): void;
  randomInt(lo: number, hi: number): number;
  stat(actorId: number, key: string): number;
}
export interface DropProposal {
  readonly v: 1;
  readonly converted: boolean;
  readonly items: readonly DropItemSpec[];
  readonly gold: number;
  // Parallel to items; null means no unique receipt, never a free-form state patch.
  readonly uniqueIds: readonly (string | null)[];
}
export interface DropAcceptance {
  readonly v: 1;
  readonly eventId: number;
  readonly accepted: readonly { readonly index: number; readonly itemId: number }[];
  readonly skipped: readonly { readonly index: number; readonly reason: 'capacity' | 'placement' }[];
  readonly acceptedGold: number;
  readonly newUniqueIds: readonly string[];
}
declare const planBrand: unique symbol;
export interface DropPlanHandle { readonly [planBrand]: true; readonly contract: 'C6-1' }
export interface DropProvider {
  /** Cross-check compact module receipts against host-owned accepted receipts. */
  validateReceipts?(state: ReadonlyJson, uniqueIds: readonly string[], watermark: number): boolean;
  /** Query keys captured by the host before roll (at most 16). */
  readonly statKeys?: readonly string[];
  readonly uniqueCatalog?: readonly string[];
  readonly sources: readonly DropSource[];
  roll(event: DropEvent, context: DropRollContext): DropProposal;
  // Pure next-state calculation, applied only with the native commit.
  settle(state: ReadonlyJson, event: DropEvent, accepted: DropAcceptance): ReadonlyJson;
}
// Host-owned safe-point authority; never exposed to UI or ordinary event callbacks.
export interface DropAuthority {
  prepare(event: DropEvent): DropPlanHandle;
  commit(plan: DropPlanHandle): DropAcceptance;
}

export interface KnownItemFacts {
  readonly v: 1;
  readonly location: 'floor' | 'pack' | 'equipped' | 'container';
  readonly baseName: string;
  readonly nativeGlyph: string;
  readonly hallucinating: boolean;
  readonly data: ReadonlyJson; // owner projection, already stripped of hidden fields
}
export interface TextRef {
  readonly nameKey: string;
  readonly params: Readonly<Record<string, string | number>>;
}
export interface ItemPresentationProvider {
  // Pure trusted projection, kept inside runtime; raw data never goes to Vue props.
  project(item: ItemFacts, knowledge: ReadonlyJson): ReadonlyJson;
  name(item: KnownItemFacts): TextRef | null;
  appearance(item: KnownItemFacts): Readonly<{ colorToken: string; marker: string }> | null;
}
/** Detached command facts; eligibility includes native instance, kind and rune knowledge. */
export interface ItemCommandFacts extends ItemFacts {
  readonly canBeIdentified: boolean;
}
export interface ItemCommandRead {
  readonly owner: string;
  readonly playerId: number;
  readonly revision: number;
  readonly state: ReadonlyJson;
  readonly inventory: readonly ItemCommandFacts[];
  readonly configuration: ReadonlyJson;
  readonly equippedIds: readonly number[];
}
export interface ItemCommandProposal {
  readonly v: 1;
  readonly revision: number;
  readonly consume: readonly { readonly itemId: number; readonly quantity: number }[];
  readonly updateOwnData: readonly { readonly itemId: number; readonly data: ReadonlyJson }[];
  readonly materials: readonly { readonly definitionId: string; readonly quantity: number }[];
  readonly nextState: ReadonlyJson;
  readonly chargedTicks: number;
  readonly confirmation: TextRef | null;
}
export interface ItemCommandProvider {
  readonly kind: 'create' | 'filter' | 'salvage' | 'identify';
  /** Identify consumes ten units of this owner's existing C5 material definition. */
  readonly materialDefinitionId?: string;
  // Pure, detached preflight. Host owns confirmation, revalidation and commit.
  prepare(payload: ReadonlyJson, context: ItemCommandRead): ItemCommandProposal | null;
}

export interface ItemTriggerFact {
  readonly kind: 'physical-hit';
  readonly role: 'attacker' | 'defender';
  readonly targetTags: readonly string[];
}
export interface ItemKnowledgeProvider {
  /** Pure partial reveal, called only after a successful native melee damage settlement. */
  trigger?(data: ReadonlyJson, context: Readonly<{item: ItemFacts; fact: ItemTriggerFact}>): ReadonlyJson;
  known(data:ReadonlyJson):boolean;
  unique(data:ReadonlyJson):boolean;
  reveal(data:ReadonlyJson,context:Readonly<{item:ItemFacts;reason:'native-identify'|'command'|'trigger'}>):ReadonlyJson;
}

/** `queryOptional('foundation.item-encounters.v1', {})`: declared public forms,
 * never private encounter state. Unavailable/absent when no owner declares encounters. */
export interface ItemEncounterCapability {
  readonly v:1;
  readonly owners:readonly {readonly owner:string;readonly templateIds:readonly string[];readonly formIds:readonly string[]}[];
  readonly fingerprint:string;
}
