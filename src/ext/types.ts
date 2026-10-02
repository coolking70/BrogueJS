import type { Creature } from '../entities/Creature';
import type { AttackResult } from '../engine/Combat/Combat';
import type { Item } from '../engine/Items/Item';
import type { EffectCausality, EffectOrigin, DamageKind, CausalitySnapshot } from './causality';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export interface ExtensionRulesIdentity { schema: number; version: string; fingerprint: string }
export interface ExtensionVersion { id: string; version: string; rules?: ExtensionRulesIdentity }
export interface ExtensionManifest { schema: 1; foundation?: 1; modules: ExtensionVersion[] }
export interface ExtensionSnapshot {
    manifest: ExtensionManifest;
    modules: Record<string, Json>;
    /** Run-local creature ID -> module-qualified component ID -> JSON. */
    components: Record<string, Record<string, Json>>;
    foundation: { version: 1; causality: CausalitySnapshot; deaths: Record<string, DeathFact> };
}
export interface DeathFact { creature: CreatureView; origin: EffectOrigin | null; administrative: boolean; }
export interface GenerationToken { readonly label: string; }
export type RuleSet = 'classic' | 'extended';
export interface CreatureView {
    readonly id: number; readonly name: string; readonly hp: number; readonly maxHp: number;
    readonly x: number; readonly y: number; readonly player: boolean;
}
export interface ItemView { readonly id: number; readonly category: number; readonly quantity: number }
/** Narrow detached facts; no live object or arbitrary field-write capability. */
export interface ActorFacts extends CreatureView {
    readonly monsterId: string | null; readonly allied: boolean; readonly hostile: boolean;
}
export interface ResourceCommit { expectedHp: number; expectedMaxHp: number; hp: number; maxHp: number }
export interface HookEvents {
    actorObserved: { actor: ActorFacts };
    nativeMaximumReset: { actor: ActorFacts };
    itemKnowledgeChanged: { kindId: string };
    rewardGranted: { issuerId: string; recipientId: number; rewardId: string; instanceId: string };
    deathCaptured: { actor: ActorFacts; origin: EffectOrigin | null; administrative: boolean };
    simulationSettled: { knownKinds: { id: string; category: string }[]; reachableIds: number[]; sourceIds: number[] };

    beforeLevelGeneration: { depth: number };
    afterLevelGeneration: { depth: number };
    creatureSpawned: { creature: CreatureView; birth?: import('./birth').CreatureBirth };
    playerTurnEnded: { turn: number };
    beforeAttack: { attacker: CreatureView; defender: CreatureView };
    afterAttack: { attacker: CreatureView; defender: CreatureView; result: Readonly<AttackResult> };
    damage: { creature: CreatureView; amount: number; hpBefore: number; sourceId: number | null; origin?: EffectOrigin | null; damageKind?: DamageKind; hpLost?: number };
    kill: { creature: CreatureView; sourceId: number | null; administrative: boolean; origin?: EffectOrigin | null };
    playerDied: DeathFact;
    generationCommitted: { label: string; creatureIds: number[] };
    generationRolledBack: { label: string };
    itemPickedUp: { creature: CreatureView; item: ItemView };
    itemUsed: { creature: CreatureView; item: ItemView; operation: string };
    enteredLevel: { depth: number; firstVisit: boolean };
}
export type HookName = keyof HookEvents;
export interface ExtensionContext {
    readonly moduleId: string;
    readonly depth: number;
    readonly playerId: number;
    readonly state: Json;
    setState(state: Json): void;
    getComponent(creatureId: number, name: string): Json | undefined;
    setComponent(creatureId: number, name: string, value: Json): void;
    removeComponent(creatureId: number, name: string): void;
    creature(id: number): ActorFacts | null;
    knownKinds(): { id: string; category: string }[];
    grantReward(request: { recipientId: number; rewardId: string; instanceId: string }): void;
    commitResources(id: number, value: ResourceCommit): void;
    randomInt(min: number, max: number): number;
    message(text: string): void;
}
export type HookHandlers = { [K in HookName]?: (event: Readonly<HookEvents[K]>, context: ExtensionContext) => void };
export interface ExtensionModule extends ExtensionVersion {
    dependencies?: readonly string[];
    initialState(): Json;
    validateState(state: unknown): state is Json;
    hooks?: HookHandlers;
    componentValidators?: Record<string, (value: unknown) => boolean>;
    onNewGame?(context: ExtensionContext): void;
    /** Rebuild session resources only; do not change serialized state. */
    onLoad?(context: ExtensionContext): void;
    onUnload?(): void;
    /** Pure gates share live/replay input; rejection must not become a recorded action. */
    allowInput?(action: string, data: unknown, context: ExtensionContext): boolean;
    readyToSave?(context: ExtensionContext): boolean;
    resourceCommits?: boolean;
    initialCommand?: { action: string; payload: Json };
    creditParty?(actor: ActorFacts, context: ExtensionContext): string | null;
    validateComponents?(state: Json, components: ExtensionSnapshot['components'], foundation: ExtensionSnapshot['foundation']): boolean;
    validateRecording?(events: readonly { action: string; data: unknown; extensions?: ExtensionSnapshot }[]): boolean;
    validateWorld?(state: Json, components: ExtensionSnapshot['components'], actors: readonly ActorFacts[]): boolean;
    commands?: Record<string, (payload: Json, context: ExtensionContext) => void>;
}
/** Session-only wiring. Never serialized as part of a creature. */
export interface CreatureExtensionHooks {
    beforeAttack(attacker: Creature, defender: Creature): void;
    afterAttack(attacker: Creature, defender: Creature, result?: AttackResult): void;
    readonly causality: EffectCausality;
    partyId(creature: Creature): string | null;
    relationshipChanged?(creature: Creature): void;
    nativeMaximumReset?(creature: Creature): void;
    damage(creature: Creature, amount: number, hpBefore: number, damageKind?: DamageKind): void;
}
export function creatureView(creature: Creature, playerId: number): CreatureView {
    return Object.freeze({ id: creature.id, name: creature.name, hp: creature.hp, maxHp: creature.maxHp,
        x: creature.x, y: creature.y, player: creature.id === playerId });
}
export function itemView(item: Item): ItemView {
    return Object.freeze({ id: item.id, category: item.category, quantity: item.quantity });
}
