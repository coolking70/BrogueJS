import type { WorldInteractable, WorldInteractablePlacement, WorldInteractablePlacementResult, WorldInteractionSnapshot, WorldInteractionValidation, ExtensionProjectionContext } from './world';
import type { Creature } from '../entities/Creature';
import type { AttackResult } from '../engine/Combat/Combat';
import type { Item } from '../engine/Items/Item';
import type { EffectCausality, EffectOrigin, DamageKind, CausalitySnapshot } from './causality';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ReadonlyJson = null | boolean | number | string | readonly ReadonlyJson[] | { readonly [key: string]: ReadonlyJson };
/** Session-only display data. State/component selections never include other actors or world ledgers. */
export interface ExtensionViewDescriptor {
    readonly definitions: ReadonlyJson;
    readonly stateFields: readonly string[];
    readonly playerComponents: readonly string[];
    /** Optional shallow whitelist for public fields within a projected player component. */
    readonly componentFields?: Readonly<Record<string, readonly string[]>>;
}
export interface ExtensionModuleView {
    readonly session: object;
    readonly definitions: ReadonlyJson;
    readonly playerId: number;
    readonly state: Readonly<Record<string, ReadonlyJson>>;
    readonly components: Readonly<Record<string, ReadonlyJson>>;
    readonly canManageCharacter: boolean;
}
export interface ExtensionRulesIdentity { schema: number; version: string; fingerprint: string }
export interface ExtensionVersion { id: string; version: string; rules?: ExtensionRulesIdentity }
export interface ExtensionManifest { schema: 1; foundation?: 4; modules: ExtensionVersion[] }
export interface ExtensionSnapshot {
    manifest: ExtensionManifest;
    modules: Record<string, Json>;
    /** Run-local creature ID -> module-qualified component ID -> JSON. */
    components: Record<string, Record<string, Json>>;
    foundation: { version: 4; nextFactId: number; pendingStoryFacts: PendingStoryFact[]; causality: CausalitySnapshot; deaths: Record<string, DeathFact>; world: WorldInteractionSnapshot };
}
/** Native facts wait for run initialization; sequence numbers are reserved on commit. */
export interface PendingStoryFact { kind: 'entered-level'; depth: number; firstVisit: boolean; turn: number }
export interface StoryFact extends PendingStoryFact { factId: number }
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
    readonly movementRegionId?: number;
    readonly monsterId: string | null; readonly allied: boolean; readonly hostile: boolean;
}
export interface ResourceCommit { expectedHp: number; expectedMaxHp: number; hp: number; maxHp: number }
/** Frozen rule inputs have no engine objects or mutation capabilities. */
export interface ExtensionRuleContext {
    readonly playerId: number;
    readonly state: Json;
    getComponent(creatureId: number, name: string): Json | undefined;
}
/** Read-only optional protocol seam. IDs include an explicit version (e.g.
 * foundation.sample.v1); absence is normal, malformed provider output is not.
 * No mutation/reward preparation is promised by this query-only interface. */
export interface OptionalQueryContext {
    readonly playerId: number;
    readonly state: ReadonlyJson;
    getPlayerComponent(name: string): ReadonlyJson | undefined;
}
export interface OptionalQueryProvider {
    accepts(input: ReadonlyJson): boolean;
    query(input: ReadonlyJson, context: OptionalQueryContext): Json;
    validate(value: unknown): value is Json;
}
export type OptionalQueryResult = { readonly status: 'unavailable'; readonly reason: 'absent' | 'unsupported-input' }
    | { readonly status: 'available'; readonly value: ReadonlyJson };
/** Versioned synchronous optional reward seam; provider plans never leave this call. */
export interface OptionalRewardRequest { issuerId: string; rewardId: string; instanceId: string; recipient: 'player' }
export interface OptionalRewardPrepareContext extends OptionalQueryContext {
    readonly player: ActorFacts | null;
    readonly resources: Readonly<CharacterResources>;
}
export type OptionalRewardPreparation = { status: 'ready'; plan: Json }
    | { status: 'skipped'; reason: 'disabled' | 'unsupported-key' };
export type OptionalRewardPrepareResult = { readonly status: 'ready' }
    | { readonly status: 'skipped'; readonly reason: 'absent' | 'disabled' | 'unsupported-key' };
export type OptionalRewardResult = { readonly status: 'applied' }
    | { readonly status: 'skipped'; readonly reason: 'absent' | 'disabled' | 'unsupported-key' };
export interface OptionalRewardProvider {
    prepare(request: Readonly<OptionalRewardRequest>, context: OptionalRewardPrepareContext): OptionalRewardPreparation;
    commit(request: Readonly<OptionalRewardRequest>, plan: ReadonlyJson, context: ExtensionContext): void;
}
export interface ExtensionRuleInput {
    readonly actorId: number; readonly targetId: number | null; readonly baseValue: number;
    readonly attackKind?: 'melee' | 'thrown';
    readonly rollMode?: 'skip-guaranteed-hit' | 'skip-guaranteed-miss' | 'roll-guaranteed' | 'roll-probability';
    readonly adjacent?: boolean; readonly damageKind?: 'physical'; readonly direct?: boolean; readonly immune?: boolean;
    readonly nativeMinimum?: number; readonly invisible?: boolean; readonly mode?: 'manual' | 'automatic';
    readonly skillId?: string; readonly baseCooldown?: number;
}
export interface ExtensionRulePolicies {
    hitChance?(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number;
    /** Outgoing and received physical modifiers must be combined in this one slot. */
    physicalDamage?(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number;
    stealthRange?(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number;
    searchStrength?(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number;
    strengthBonus?(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number;
    maxHpBonus?(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number;
    focusCapacity?(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number;
    focusRecoveryInterval?(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number;
    cooldownDuration?(input: Readonly<ExtensionRuleInput>, context: ExtensionRuleContext): number;
    nativeBonuses?(actorId: number, context: ExtensionRuleContext): Readonly<{ maxHp: number; strength: number }>;
}
export interface ItemGrowthInput {
    readonly actor: ActorFacts; readonly itemId: string;
    readonly nativeDestination: 'strengthBonus' | 'maxHpBonus' | 'enchantment'; readonly nativeAmount: number;
}
export interface CharacterResources { strength: number | null; gold: number | null }
export interface CharacterResourceCommit extends CharacterResources { expectedStrength: number | null; expectedGold: number | null }
/** Data-only native primitives; the engine owns eligibility, confirmations and time. */
export type ControlledActionTarget = { kind: 'self' } | { kind: 'creature'; id: number } | { kind: 'cell'; x: number; y: number };
export interface ControlledActionRequest { actorId: number; action: 'attack' | 'move' | 'wait' | 'search'; target: ControlledActionTarget }
/** Pure, revocable preparation access: never a lifecycle/command context. */
export type ControlledCommandPreparationContext = Pick<ExtensionContext,
    'playerId' | 'state' | 'getComponent' | 'creature' | 'canManageCharacter' | 'validateAction'>;
export interface ControlledCommandPreparation {
    readonly revision: number;
    readonly request: ControlledActionRequest;
}
/** Session-only data, never written to a save or recording. */
export interface PreparedControlledCommand extends ControlledCommandPreparation {
    readonly command: string;
}
export interface PhysicalResolutionFact {
    resolutionId: number; attacker: CreatureView; defender: CreatureView;
    attackKind: 'melee' | 'thrown'; result: Readonly<AttackResult>;
    probabilityRolled: boolean; positivePhysicalDamage: boolean; hpLost: number;
}
/** Native core outcome, distinct from accepting a paid attempt. */
export interface ControlledActionOutcome { readonly moved: boolean }
export interface ControlledActionResult extends ControlledActionRequest, ControlledActionOutcome {
    actorId: number; resolutions: readonly PhysicalResolutionFact[]; hit: boolean; hpLost: number;
}
export interface ControlledActionCallbacks {
    beforeCommit(context: ExtensionContext): void;
    afterResolve(result: Readonly<ControlledActionResult>, context: ExtensionContext): void;
}
export interface HookEvents {
    storyFact: StoryFact;
    interactionClosed: { owner: string; targetEntityId: number; sessionId: number; reason: 'game-over' | 'target-removed' };
    interactablesRemoved: { owner: string; entityIds: number[] };
    actorObserved: { actor: ActorFacts };
    objectiveTime: { ticks: number; mode: 'realtime'; actorIds: number[] };
    committedAction: { actorId: number; action: 'attack' | 'throw' | 'cast' | 'move' | 'wait' | 'search' | 'parry' };
    defended: { resolutionId:number; depth:number; sourceEntityId:number; targetEntityId:number; defense:'parry' };
    physicalResolved: PhysicalResolutionFact;
    nativeMaximumReset: { actor: ActorFacts; preserveOverhealth?: boolean };
    itemKnowledgeChanged: { kindId: string };
    rewardGranted: { issuerId: string; recipientId: number; rewardId: string; instanceId: string };
    deathCaptured: { actor: ActorFacts; origin: EffectOrigin | null; administrative: boolean };
    simulationSettled: { knownKinds: { id: string; category: string }[]; reachableIds: number[]; sourceIds: number[] };

    generationPlacement: import('./generation').GenerationPlacementFact;
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
    enteredLevel: { depth: number; firstVisit: boolean; actorIds?: number[] };
    /** A local movement binding is cleared before a surviving actor falls. */
    movementRegionExited: { actor: ActorFacts; regionId: number; depth: number; reason: 'fell' };
    movementRegionFollowBlocked: { actor: ActorFacts; regionId: number; depth: number; reason: 'hard-boundary' };
}
export type HookName = keyof HookEvents;
export interface ExtensionContext {
    readonly moduleId: string;
    readonly depth: number;
    readonly turn: number;
    readonly nextFactId: number;
    commitFactRange(first: number, count: number): void;
    interactables(): readonly WorldInteractable[];
    interactionTarget(id: number): WorldInteractable | null;
    placeInteractables(requests: readonly WorldInteractablePlacement[]): readonly WorldInteractablePlacementResult[];
    interactionGate(active: { targetEntityId: number; sessionId: number } | null): void;
    readonly playerId: number;
    readonly state: Json;
    /** Pure recognition of a selected module's declared creation command.
     * Lets an uninitialized module permit another module's initialization. */
    isInitialCommand(action: string, data: unknown): boolean;
    queryOptional(capability: string, input: Json): OptionalQueryResult;
    prepareOptionalReward(capability: string, rewardId: string, instanceId: string): OptionalRewardPrepareResult;
    commitOptionalReward(capability: string, rewardId: string, instanceId: string): OptionalRewardResult;
    setState(state: Json): void;
    getComponent(creatureId: number, name: string): Json | undefined;
    setComponent(creatureId: number, name: string, value: Json): void;
    removeComponent(creatureId: number, name: string): void;
    creature(id: number): ActorFacts | null;
    knownKinds(): { id: string; category: string }[];
    grantReward(request: { recipientId: number; rewardId: string; instanceId: string }): void;
    commitResources(id: number, value: ResourceCommit): void;
    characterResources(id: number): CharacterResources;
    canManageCharacter(): boolean;
    validateAction(request: ControlledActionRequest): boolean;
    executeAction(request: ControlledActionRequest, callbacks: ControlledActionCallbacks): boolean;
    commitCharacterResources(id: number, value: CharacterResourceCommit): void;
    randomInt(min: number, max: number): number;
    message(text: string): void;
}
export type HookHandlers = { [K in HookName]?: (event: Readonly<HookEvents[K]>, context: ExtensionContext) => void };
/** Detached native newborn bases for safe composition before a current run is retired. */
export interface ExtensionCreationResources { readonly maxHp: number; readonly strength: number }
export interface ExtensionModule extends ExtensionVersion {
    dependencies?: readonly string[];
    readonly optionalRewards?: Readonly<Record<string, OptionalRewardProvider>>;
    readonly optionalQueries?: Readonly<Record<string, OptionalQueryProvider>>;
    readonly optionalPartBreaks?: Readonly<Partial<Record<'combat.part-break.v1', import('./partBreak').PartBreakProvider>>>;
    readonly view?: ExtensionViewDescriptor;
    readonly worldInteractables?: true;
    /** Only the native generation owner may install declared owned regions. */
    readonly ownedRegions?: true;
    /** One discovered data-only owner for persistent phased attacks. */
    readonly actorActions?: { readonly stateField: 'scheduler'; readonly definitions: Json };
    readonly nativeForms?: readonly import('./nativeForms').NativeFormDefinition[];
    readonly generationContributions?: readonly import('./generation').GenerationContribution[];
    readonly publicActorTags?: readonly { readonly component: string; readonly tag: string }[];
    readonly interactionCommands?: readonly string[];
    projectView?(context: ExtensionProjectionContext): Json;
    /** Pure projection receives only a detached selected player component, never a world/context capability. */
    projectPlayerComponent?(name: string, value: ReadonlyJson): Json;
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
    /** Pure run-ready gate derived from persisted own state/components, separate
     * from temporary settlement/save readiness. Candidate validation has no native ports. */
    initializationReady?(context: ExtensionContext): boolean;
    resourceCommits?: boolean;
    rulePolicies?: ExtensionRulePolicies;
    commitItemGrowth?(input: Readonly<ItemGrowthInput>, context: ExtensionContext): { nativeAmount: number };
    initialCommand?: { action: string; payload: Json };
    /** Pure creation preflight, before an existing run is retired; no live actor ports. */
    validateInitialCommand?(action: string, payload: Json, native?: ExtensionCreationResources): boolean;
    creditParty?(actor: ActorFacts, context: ExtensionContext): string | null;
    validateComponents?(state: Json, components: ExtensionSnapshot['components'], foundation: ExtensionSnapshot['foundation']): boolean;
    validateRecording?(events: readonly { action: string; data: unknown; extensions?: ExtensionSnapshot }[]): boolean;
    validateWorld?(state: Json, components: ExtensionSnapshot['components'], actors: readonly ActorFacts[], world: WorldInteractionValidation): boolean;
    /** Must only inspect the narrow context and return JSON; called before any writable command scope. */
    prepareControlledCommand?(action: string, payload: Json, context: ControlledCommandPreparationContext): ControlledCommandPreparation | null;
    commands?: Record<string, (payload: Json, context: ExtensionContext) => void>;
}
/** Session-only wiring. Never serialized as part of a creature. */
export interface CreatureExtensionHooks {
    /** Engine-only post-shield zone commit; undefined preserves native damage. */
    zoneDamage?(creature: Creature, amount: number, damageKind: DamageKind): number | undefined;
    beforeAttack(attacker: Creature, defender: Creature): void;
    afterAttack(attacker: Creature, defender: Creature, result?: AttackResult): void;
    wantsPhysicalResolution?(): boolean;
    physicalResolved?(attacker: Creature, defender: Creature, fact: Omit<PhysicalResolutionFact, 'attacker' | 'defender'>): void;
    readonly causality: EffectCausality;
    partyId(creature: Creature): string | null;
    relationshipChanged?(creature: Creature): void;
    nativeMaximumReset?(creature: Creature, preserveOverhealth?: boolean): void;
    nativeMaximumBase?(creature: Creature): number;
    rule?(port: 'hitChance' | 'physicalDamage', input: ExtensionRuleInput): number;
    damage(creature: Creature, amount: number, hpBefore: number, damageKind?: DamageKind): void;
}
export function creatureView(creature: Creature, playerId: number): CreatureView {
    return Object.freeze({ id: creature.id, name: creature.name, hp: creature.hp, maxHp: creature.maxHp,
        x: creature.x, y: creature.y, player: creature.id === playerId });
}
export function itemView(item: Item): ItemView {
    return Object.freeze({ id: item.id, category: item.category, quantity: item.quantity });
}

export type { WorldInteractable, WorldInteractablePlacement, WorldInteractablePlacementResult, WorldInteractableView, WorldInteractionSnapshot, WorldInteractionValidation, ExtensionProjectionContext } from './world';
