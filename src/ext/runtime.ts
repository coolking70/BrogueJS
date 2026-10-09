import { assertResidentPolicy } from './residentSchema';
import { validateEdibleSnapshot } from '../engine/Core/EdibleValidation';
import i18next from 'i18next';
import { worldText } from './worldText';
import { edibleSnapshot, peekEdibleState, restoreEdibleState, cleanEdibleState, type EdibleState } from '../engine/Core/EdibleState';
import { FOUNDATION_EDIBLE_RULES, hasEdibleDeclarations } from '../engine/Core/EdibleDefinitions';
import { FOUNDATION_STRUCTURE_RULES } from './structureSchema';
import { StatPipeline } from '../engine/Stats/StatPipeline';
import { NATIVE_STAT_KEYS, NATIVE_STAT_DAG } from '../engine/Stats/NativeStatKeys';
import { MaterializedStats, validateMaterializedStats } from '../engine/Stats/MaterializedStats';
import { bindStats, markStatsDirty, nativeStatRevision, nativeStatSignature, nativeStatFacts, nativeBase, nativeEquippedItems, nativeRows, nativeNodeRows, unbindStats } from '../engine/Stats/NativeStatSources';
import { StatValidationError, validateStatRows } from './stats';
import type { PairFacts, StatQuery } from './stats';
import { markRecordingRoot, recordingRootRevision } from './recordingRevisions';
import { World5Error } from './world5';
import { c5Hash, c5Canonical } from './worldJson';
import { RESIDENT_ACTIONS } from './residentSdk';
import {STRUCTURE_ACTIONS} from './structureSdk';
import { isWorld5Fixture, isWorld5StructureFixture, isWorld5WorkFixture, world5FixtureConfiguration } from './world5Fixture';
import { FOUNDATION_PROTOCOL } from './descriptor';
import { resolveActorQueryScope } from './actorQuery';
import type { ActorActionProductionWorld } from '../engine/Core/ActorActionProduction';
import type { OptionalActorQueryProvider, CommittedFact, CombatEventFact, CombatEventPayload, CombatEventActor, CommittedFactConsumer, CombatEventKind } from './types';
import { validateProductionActorAttackTransactionState } from './actorActionValidation';
import type { ActorAttackDefinitions, ProductionActorAttackState } from './actorActions';
import { SpatialCatalog, nativeSpatialCatalog } from '../engine/Movement/SpatialSchema';
import { rigidFootprint } from '../engine/Movement/RigidFootprint';
import { bindNativeForms, nativeFormFootprint, nativeFormSpatial, validNativeForm, type NativeFormDefinition } from './nativeForms';
import { validActiveBodyTransitions } from './bodyTransitions';
import { validGenerationContribution } from './generation';
import type { Creature } from '../entities/Creature';
import { Player } from '../entities/Player';
import { allocateEntityId, getNextEntityId, restoreNextEntityId } from '../entities/Creature';
import { setOwnedRegions, validWorldPlacement, validWorldSnapshot, publicInteractable, sortInteractables, WORLD_INTERACTABLE_LIMIT, type WorldInteractable, type WorldInteractablePlacement, type WorldInteractablePlacementResult, type WorldInteractionSnapshot, type WorldInteractionValidation } from './world';
import type { ExtensionRegistry } from './registry';
import type { ExtensionModule, ExtensionContext, ExtensionManifest, ExtensionSnapshot, HookEvents, HookName, Json, ActorFacts, ResourceCommit, ReadonlyJson, CharacterResources, CharacterResourceCommit, ExtensionRuleContext, ItemGrowthInput, ExtensionViewDescriptor, ExtensionModuleView, ExtensionCreationResources, ControlledCommandPreparationContext, PreparedControlledCommand } from './types';
import { creatureView } from './types';
import { readCreatureBirth } from './birth';
import { OWNED_REGION_LIMIT, validRegionPlacement, regionContains, regionsOverlap, type OwnedRegion, type OwnedRegionPlacement } from './regions';
import { clearMovementRegion } from '../engine/Movement/CreatureSpatial';
import { footprintOf } from '../engine/Movement/CreatureSpatial';
import { hasBodyContact, physicalContactOf, isWholeBodyDamage } from '../engine/Combat/BodyCombat';
import { resolveFixedZoneContact } from '../engine/Combat/FixedZoneHealth';
import { canonical, cloneJson, isJson, validId } from './json';
import { actorActionIdentityCheckpoint, adoptActorActionJson } from './actorActionIdentity';
import { EffectCausality, validEffectOrigin, type EffectOrigin } from './causality';
import { ExtensionCompatibilityError } from './compatibility';
import { PART_BREAK_CAPABILITY, validatePartBreakRequest, type PartBreakRequest, type PartBreakProvider,
    type PartBreakPreparation, type PartBreakNativeCommit, type PartBreakChoice, type PartBreakCommitContext, type PartBreakMemberIdentity } from './partBreak';
import type { DeathFact, GenerationToken, ControlledActionRequest, ControlledActionResult, ControlledActionOutcome, PhysicalResolutionFact, OptionalQueryResult, OptionalQueryProvider, OptionalRewardProvider, OptionalRewardRequest, OptionalRewardPreparation, OptionalRewardPrepareResult, OptionalRewardResult, PendingStoryFact } from './types';

// Pure geometry authority is session-derived. No own field/catalog allocation
// is added to a runtime with no arbitrary-shape declarations.
const spatialCatalogs = new WeakMap<ExtensionRuntime, SpatialCatalog>();
// No new own runtime field in existing worlds (4a0 full-object differential).
const partBreakProviders = new WeakMap<ExtensionRuntime, { module: ExtensionModule; provider: PartBreakProvider }>();
const zoneBreakCheckpoints = new WeakMap<ExtensionRuntime, () => () => void>();
const zoneBreakHandlers = new WeakMap<ExtensionRuntime, NonNullable<ExtensionPorts['zoneBroken']>>();
const bodyHandlers = new WeakMap<ExtensionRuntime, Pick<ExtensionPorts, 'memberDamage' | 'memberDamageCommitted' | 'validateMemberBreak' | 'memberBroken'>>();
const actorQueryProviders = new WeakMap<ExtensionRuntime, Map<string, {module: ExtensionModule; provider: OptionalActorQueryProvider}>>();
const committedTransactions = new WeakMap<ExtensionRuntime, { events: Omit<CombatEventFact,'factId'>[]; publishing: boolean; allocated:number; actors:Map<Creature,{depth:number;actor:CombatEventActor}> }>();
const allocatingFacts = new WeakSet<ExtensionRuntime>();
const world5Runtimes = new WeakSet<ExtensionRuntime>();
const factConsumers = new WeakMap<ExtensionRuntime, Map<string, readonly {module:ExtensionModule;consumer:CommittedFactConsumer}[]>>();
const restHandlers = new WeakMap<ExtensionRuntime, Pick<ExtensionPorts,'nativeDamageCommitted'|'worldRestUnavailable'>>();
const actorQueryScopes=new WeakMap<ExtensionRuntime,NonNullable<ExtensionPorts['actorQueryScope']>>();
const nativeFactCheckpoints=new WeakMap<ExtensionRuntime,NonNullable<ExtensionPorts['checkpointCommittedFacts']>>();
interface StatProposal {hp?:number;maxHp?:number;strength?:number;oldMaxBonus:number;oldStrengthBonus:number}
interface StatSession { pipeline:StatPipeline; ledger:MaterializedStats; actors:Map<number,Creature>; simulationTicks:number|null; inProgress:boolean; writes:boolean; overrides:Map<string,number>; proposals:Map<number,StatProposal>|null; moduleViews:Map<string,{state:ReadonlyJson;components:Record<string,ReadonlyJson>}>; previewComponents:Readonly<Record<string,Json>>|null; materialSignatures:Map<number,string>; materialValues:Map<number,Map<string,number>>; collecting:boolean; dirty:Set<number>; reconciling:boolean }
const statSessions=new WeakMap<ExtensionRuntime,StatSession>();
const edibleDiagnostics=new WeakMap<ExtensionRuntime,{owner:string;method:string}[]>();
const statQueries=new WeakMap<ExtensionRuntime,StatQuery>();
function isCreatureView(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const v = value as Record<string, unknown>;
    return Object.keys(v).length === 7 && typeof v.name === 'string' && typeof v.player === 'boolean'
        && ['id', 'hp', 'maxHp', 'x', 'y'].every(key => Number.isSafeInteger(v[key]))
        && (v.id as number) > 0 && (v.maxHp as number) >= 0;
}
export interface ExtensionPorts {
    edibleRead?(owner:string): NonNullable<import('./world').ExtensionProjectionContext['edible']>;
    simulationTicks?(): number;
    needTrigger?(creature:Creature,trigger:import('./actorNeeds').NeedTrigger):void;
    /** Engine verifies native identity, owned depth, and active group slot. */
    actorQueryScope?(actor: Creature): { depth: number; partId: string | null; generation: number | null } | null;
    checkpointCommittedFacts?(): () => void;
    interruptActorAction?(actorId: number): void;
    nativeDamageCommitted?(actor: Creature, hpLost: number): void;
    worldRestUnavailable?(bonfireId: number): import('./worldRest').WorldRestUnavailableReason | null;
    zoneBroken?(actor: Creature, zoneId: string): void;
    memberDamage?(actor: Creature, amount: number, kind: import('./causality').DamageKind): number | undefined;
    memberDamageCommitted?(actor: Creature): void;
    validateMemberBreak?(request: PartBreakRequest): PartBreakMemberIdentity | false;
    memberBroken?(core: Creature, member: Readonly<PartBreakMemberIdentity>): void;
    checkpointZoneBreak?(): () => void;
    depth(): number;
    turn?(): number;
    interactableCandidates?(request: WorldInteractablePlacement): readonly { x: number; y: number }[];
    isInteractableVisible?(entity: WorldInteractable): boolean;
    canInteractWith?(entity: WorldInteractable): boolean;
    visibleActorActionCells?(sourceEntityId: number, cells: readonly {x:number;y:number}[]): {x:number;y:number}[];
    actorActions?(): import('../engine/Core/ActorActionsRoot').ActorActionsRoot | undefined;
    structureRead?(owner:string): import('./structureSdk').StructureReadSDK | undefined;
    worldWorkRead?(owner:string): import('./worldSdk').WorldWorkReadSDK | undefined;
    playerId(): number;
    canManageCharacter?(): boolean;
    validateAction?(request: ControlledActionRequest): boolean;
    executeAction?(request: ControlledActionRequest, callbacks: { beforeCommit(): void; afterResolve(outcome: ControlledActionOutcome): void }): boolean;
    gold?(): number;
    setGold?(value: number): void;
    randomInt(min: number, max: number): number;
    /** Native RNG rollback for a failed synchronous extension commit. */
    checkpointRandom?(): () => void;
    message(text: string): void;
    knownKinds?(): { id: string; category: string }[];
    testMode?(): boolean;
}
function safeStateField(value: unknown): value is string {
    return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.-]*$/.test(value)
        && !['constructor', 'prototype', '__proto__'].includes(value);
}
function freezeView<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.values(value).forEach(freezeView); Object.freeze(value);
    }
    return value;
}
function requireSynchronous(result: unknown): void {
    if (result && typeof (result as { then?: unknown }).then === 'function') {
        // Reject the handler and retire its result; context capabilities expire
        // synchronously, so a continuation cannot write world state later.
        void Promise.resolve(result).catch(() => undefined);
        throw new Error('Async extension handlers are forbidden');
    }
}
interface BufferedFact { name: HookName; event: HookEvents[HookName]; readonly?: boolean }
interface GenerationFrame {
    edible: EdibleState;
    token: GenerationToken;
    world: WorldInteractionSnapshot;
    placementNextEntityId: number | null;
    nextFactId: number;
    pendingStoryFacts: PendingStoryFact[];
    resources: ResourceCheckpoint[];
    stats: ReturnType<MaterializedStats['snapshot']>;
    states: Record<string, Json>;
    components: ExtensionSnapshot['components'];
    causality: ReturnType<EffectCausality['snapshot']>;
    deaths: Record<string, DeathFact>;
    creatures: Set<Creature>;
    facts: BufferedFact[];
    births: Set<Creature>;
}
interface ResourceCheckpoint { actor: Creature; hp: number; maxHp: number; strength: number | null; gold: number | null }
const STORY_FACT_LIMIT = 4096;
function validPendingStoryFact(value: unknown): value is PendingStoryFact {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const fact = value as PendingStoryFact;
    return Object.keys(fact).sort().join(',') === 'depth,firstVisit,kind,turn' && fact.kind === 'entered-level'
        && Number.isSafeInteger(fact.depth) && fact.depth >= 1 && typeof fact.firstVisit === 'boolean'
        && Number.isSafeInteger(fact.turn) && fact.turn >= 0;
}
function validateCombatPayload(value: CombatEventPayload): void {
    if (!isJson(value) || Object.keys(value).sort().join(',') !== 'actionId,bonfireId,eventKind,hitCount,hpLost,resolutionId,segmentIndex,sourceSubactionId,visit'
        || !['attack-resolved','staggered','parried','rest-completed'].includes(value.eventKind)
        || !Number.isSafeInteger(value.actionId) || value.actionId < 0
        || !Number.isSafeInteger(value.hitCount) || value.hitCount < 0 || value.hitCount > 4096
        || !Number.isSafeInteger(value.hpLost) || value.hpLost < 0) throw new Error('Invalid combat event');
    for (const key of ['sourceSubactionId','segmentIndex','resolutionId','bonfireId','visit'] as const)
        if (value[key] !== null && (!Number.isSafeInteger(value[key]) || value[key]! < 0)) throw new Error('Invalid combat event identity');
    if (value.eventKind === 'attack-resolved' && (value.actionId < 1 || value.sourceSubactionId === null || value.segmentIndex === null)
        || value.eventKind === 'parried' && (value.resolutionId === null || value.resolutionId < 1)
        || value.eventKind === 'rest-completed' && (value.actionId < 1 || !value.bonfireId || !value.visit)) throw new Error('Missing combat event identity');
}
export class ExtensionRuntime {
    private readonly modules: ExtensionModule[];
    private readonly optionalRewards = new Map<string, { module: ExtensionModule; provider: OptionalRewardProvider }>();
    private readonly optionalQueries = new Map<string, { module: ExtensionModule; provider: OptionalQueryProvider }>();
    private readonly viewSession: object = Object.freeze({});
    private readonly views = new Map<string, ExtensionViewDescriptor>();
    private states: Record<string, Json> = {};
    private components: ExtensionSnapshot['components'] = {};
    private readonly creatures = new Set<Creature>();
    private readonly spawned = new WeakSet<Creature>();
    private readonly attacks: number[] = [];
    private activeScope: object | null = null;
    private disposed = false;
    private resourcePhase = false;
    private commandModule: ExtensionModule | null = null;
    private commandActionUsed = false;
    private commandScope: object | null = null;
    private controlledAction = false;
    private nativeActionRevision = 0;
    private actionActorId: number | null = null;
    private actionResolutions: PhysicalResolutionFact[] | null = null;
    readonly manifest: ExtensionManifest;
    readonly causality: EffectCausality;
    private deaths: Record<string, DeathFact> = {};
    private readonly generations: GenerationFrame[] = [];
    private publishingGeneration = false;
    private world: WorldInteractionSnapshot = { entities: [], gate: null };
    private currentHook: HookName | null = null;
    private nextFactId = 1;
    private pendingStoryFacts: PendingStoryFact[] = [];
    private flushingStoryFacts = false;
    private rewardProviderPhase = false;
    private pureProviderPhase = false;
    private readonly messageBuffers: string[][] = [];
    get needsWorld5(): boolean { return world5Runtimes.has(this); }
    /** Trusted foundation fixture only; never part of a module context or catalog. */
    world5SettlementFixture() {
        const module = this.modules.find(m => world5FixtureConfiguration(m));
        return module ? { owner: module.id, configuration: world5FixtureConfiguration(module)! } : null;
    }
    prepareWorld5Settlement(plan: import('../engine/Core/WorldSettlement').OfflinePlan): () => void {
        const fixture = this.world5SettlementFixture();
        if (!fixture || !this.generations.length) throw new Error('World fixture requires an engine transaction');
        const module = this.modules.find(m => m.id === fixture.owner)!;
        const next = fixture.configuration.prepareState(freezeView(cloneJson(this.states[module.id]!)), freezeView(structuredClone(plan)));
        requireSynchronous(next);
        if (!isJson(next) || !module.validateState(next)) throw new Error('Invalid world fixture participant');
        return () => { this.states[module.id] = cloneJson(next); };
    }
    get spatialCatalog(): SpatialCatalog { return spatialCatalogs.get(this) ?? nativeSpatialCatalog; }
    constructor(registry: ExtensionRegistry, manifest: ExtensionManifest, private readonly ports: ExtensionPorts, snapshot?: ExtensionSnapshot) {
        if(ports.actorQueryScope||ports.checkpointCommittedFacts){
            if(ports.actorQueryScope)actorQueryScopes.set(this,ports.actorQueryScope);
            if(ports.checkpointCommittedFacts)nativeFactCheckpoints.set(this,ports.checkpointCommittedFacts);
            const {actorQueryScope:_scope,checkpointCommittedFacts:_checkpoint,...existingPorts}=this.ports;this.ports=existingPorts;
        }
        if (ports.nativeDamageCommitted || ports.worldRestUnavailable) {
            const {nativeDamageCommitted,worldRestUnavailable,...existingPorts}=this.ports;
            restHandlers.set(this,{nativeDamageCommitted,worldRestUnavailable});this.ports=existingPorts;
        }
        if (ports.zoneBroken) {
            zoneBreakHandlers.set(this, ports.zoneBroken);
            if (ports.checkpointZoneBreak) zoneBreakCheckpoints.set(this, ports.checkpointZoneBreak);
            const { zoneBroken: _handler, checkpointZoneBreak: _checkpoint, ...existingPorts } = this.ports;
            this.ports = existingPorts;
        }
        if (ports.memberDamage || ports.memberDamageCommitted || ports.validateMemberBreak || ports.memberBroken) {
            const { memberDamage, memberDamageCommitted, validateMemberBreak, memberBroken, ...existingPorts } = this.ports;
            bodyHandlers.set(this, { memberDamage, memberDamageCommitted, validateMemberBreak, memberBroken });
            this.ports = existingPorts;
        }
        this.manifest = structuredClone(manifest);
        for (const entry of this.manifest.modules) { if (entry.rules) Object.freeze(entry.rules); Object.freeze(entry); }
        Object.freeze(this.manifest.modules); Object.freeze(this.manifest);
        this.modules = registry.create(manifest);
        if (this.modules.some(m => isWorld5Fixture(m) || m.worldDefinitions)) world5Runtimes.add(this);
        for (const module of this.modules) if (module.optionalPartBreaks !== undefined) {
            const providers = module.optionalPartBreaks, names = Object.keys(providers);
            const provider = providers[PART_BREAK_CAPABILITY];
            if (names.length !== 1 || names[0] !== PART_BREAK_CAPABILITY || !provider
                || Object.keys(provider).sort().join(',') !== 'commit,prepare'
                || typeof provider.prepare !== 'function' || typeof provider.commit !== 'function') throw new Error('Invalid part break provider');
            if (partBreakProviders.has(this)) throw new Error('Conflicting part break providers');
            partBreakProviders.set(this, { module, provider });
        }
        if (this.modules.filter(module => module.actorActions).length > 1) throw new Error('Conflicting actor action providers');
        for (const module of this.modules) if (module.actorActions && (!isJson(module.actorActions.definitions))) throw new Error('Invalid actor action declaration');
        for (const module of this.modules) if (module.ownedRegions !== undefined && module.ownedRegions !== true) throw new Error('Invalid owned region declaration');
        for (const module of this.modules) {
            if (module.nativeForms && (!Array.isArray(module.nativeForms) || !module.nativeForms.length || module.nativeForms.length > 16
                || new Set(module.nativeForms.map(f => f.id)).size !== module.nativeForms.length || !module.nativeForms.every(f => validNativeForm(f, module.id)))) throw new Error('Invalid native form declarations');
            if (module.generationContributions && (!module.ownedRegions || !Array.isArray(module.generationContributions) || !module.generationContributions.length || module.generationContributions.length > 16
                || new Set(module.generationContributions.map(t => t.id)).size !== module.generationContributions.length
                || !module.generationContributions.every(t => validGenerationContribution(t, module.id) && module.nativeForms?.some(f => f.id === t.formId && (f.size === 2 || t.width >= 16 && t.height >= 12))))) throw new Error('Invalid generation declarations');
            if (module.publicActorTags && (!Array.isArray(module.publicActorTags) || module.publicActorTags.length > 8 || module.publicActorTags.some(t => !validId(t.component) || !validId(t.tag) || t.groupKey !== undefined && (typeof t.groupKey !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(t.groupKey)) || !module.componentValidators?.[t.component]))) throw new Error('Invalid public actor tags');
            if (module.nativeForms) Object.defineProperty(module, 'nativeForms', { value: freezeView(structuredClone(module.nativeForms)), writable: false });
            if (module.generationContributions) Object.defineProperty(module, 'generationContributions', { value: freezeView(structuredClone(module.generationContributions)), writable: false });
        }
        if (this.modules.some(m => m.nativeBodies || m.nativeForms?.some(f => f.footprint))) spatialCatalogs.set(this, new SpatialCatalog(false, this.modules.map(m => m.id)));
        for (const module of this.modules) for (const form of module.nativeForms ?? []) {
            const definition = nativeFormFootprint(form, module.id);
            for (const rule of form.breakRules ?? []) this.spatialCatalog.registerBreakRule(rule);
            if (definition) { this.spatialCatalog.registerFootprint(definition); rigidFootprint(this.spatialCatalog, definition.id); }
        }
        for (const module of this.modules) if (module.nativeBodies) {
            const declarations = module.nativeBodies;
            if (!isJson(declarations) || Object.keys(declarations).filter(k => !['statusProfiles', 'attackProfiles'].includes(k)).sort().join(',') !== 'breakRules,definitions'
                || !Array.isArray(declarations.definitions) || !declarations.definitions.length || declarations.definitions.length > 16
                || !Array.isArray(declarations.breakRules) || declarations.breakRules.length > 16 || !module.nativeForms?.length)
                throw new Error('Invalid native body declarations');
            if (declarations.statusProfiles !== undefined && (!Array.isArray(declarations.statusProfiles) || declarations.statusProfiles.length > 16)) throw new Error('Invalid status profile declarations');
            if (declarations.attackProfiles !== undefined && (!Array.isArray(declarations.attackProfiles) || declarations.attackProfiles.length > 16)) throw new Error('Invalid attack profile declarations');
            for (const profile of declarations.statusProfiles ?? []) this.spatialCatalog.registerStatusProfile(profile);
            for (const profile of declarations.attackProfiles ?? []) this.spatialCatalog.registerAttackProfile(profile);
            const provider = this.modules.find(m => m.actorActions)?.actorActions?.definitions as unknown as import('./actorActions').ActorAttackDefinitions | undefined;
            if (provider && (declarations.attackProfiles ?? []).some(p => !provider.profiles.some(ref => ref.id === p.providerProfileId))) throw new Error('Unresolved body attack provider profile');
            for (const rule of declarations.breakRules) this.spatialCatalog.registerMemberBreakRule(rule);
            for (const form of module.nativeForms) this.spatialCatalog.registerForm({ id: form.id, owner: module.id,
                footprintId: nativeFormSpatial(form).footprintId });
            for (const body of declarations.definitions) {
                if (body.owner !== module.id || body.parts.some((p: import('../engine/Movement/SpatialSchema').PartDefinition) => !module.nativeForms!.some(f => f.id === p.formId)))
                    throw new Error('Invalid native body form ownership');
                this.spatialCatalog.registerBody(body);
            }
            Object.defineProperty(module, 'nativeBodies', { value: freezeView(structuredClone(declarations)), writable: false });
        }
        for (const module of this.modules) for (const t of module.generationContributions ?? []) if (t.bodyId !== undefined) {
            if (!module.nativeBodies?.definitions.some(b => b.id === t.bodyId
                && b.parts.find(p => p.role === 'core')?.formId === t.formId)) throw new Error('Invalid generation body ownership');
        }
        for (const module of this.modules) for (const [capability, consumer] of Object.entries(module.committedFacts ?? {})) {
            if (!['foundation.story.v1', 'combat.event.v1'].includes(capability) || !consumer
                || !Number.isSafeInteger(consumer.maxDerivedFacts) || consumer.maxDerivedFacts < 0 || consumer.maxDerivedFacts > 4095
                || typeof consumer.prepare !== 'function' || typeof consumer.commit !== 'function'
                || consumer.eventKinds !== undefined && (capability !== 'combat.event.v1' || !Array.isArray(consumer.eventKinds)
                    || consumer.eventKinds.length<1 || consumer.eventKinds.length>4 || new Set(consumer.eventKinds).size!==consumer.eventKinds.length
                    || consumer.eventKinds.some(kind=>!['attack-resolved','staggered','parried','rest-completed'].includes(kind)))) throw new Error('Invalid committed fact consumer');
            let registry=factConsumers.get(this);if(!registry)factConsumers.set(this,registry=new Map());
            const entry={module,consumer:Object.freeze({maxDerivedFacts:consumer.maxDerivedFacts,prepare:consumer.prepare,commit:consumer.commit,...(consumer.eventKinds?{eventKinds:Object.freeze([...consumer.eventKinds])}:{})})};
            registry.set(capability,Object.freeze([...(registry.get(capability)??[]),entry].sort((a,b)=>a.module.id<b.module.id?-1:a.module.id>b.module.id?1:0)));
        }
        for(const module of this.modules)if(module.residentPolicy){assertResidentPolicy(module.residentPolicy,module.id);Object.defineProperty(module,"residentPolicy",{value:freezeView(structuredClone(module.residentPolicy)),writable:false});}
        for (const module of this.modules) for (const [capability, provider] of Object.entries(module.optionalActorQueries ?? {})) {
            if (!validId(capability) || !/\.v[1-9]\d*$/.test(capability) || !provider
                || typeof provider.accepts !== 'function' || typeof provider.query !== 'function' || typeof provider.validate !== 'function') throw new Error('Invalid actor query provider');
            let providers = actorQueryProviders.get(this);
            if (!providers) actorQueryProviders.set(this, providers = new Map());
            if (providers.has(capability)) throw new Error('Conflicting actor query providers');
            providers.set(capability, {module, provider});
        }
        for (const module of this.modules) if (module.bodyTransitions !== undefined) {
            if (!validActiveBodyTransitions(module.bodyTransitions, module.id, module.nativeForms ?? [], module.nativeBodies?.definitions ?? []))
                throw new Error('Invalid active body transition declarations');
            Object.defineProperty(module, 'bodyTransitions', { value: freezeView(structuredClone(module.bodyTransitions)), writable: false });
        }
        for (const module of this.modules) for (const [capability, provider] of Object.entries(module.optionalQueries ?? {})) {
            if (!validId(capability) || !/\.v[1-9]\d*$/.test(capability) || !provider
                || typeof provider.accepts !== 'function' || typeof provider.query !== 'function' || typeof provider.validate !== 'function') throw new Error('Invalid optional query provider');
            if (this.optionalQueries.has(capability)) throw new Error(`Conflicting optional query providers: ${capability}`);
            this.optionalQueries.set(capability, { module, provider });
        }
        for (const module of this.modules) for (const [capability, provider] of Object.entries(module.optionalRewards ?? {})) {
            if (!validId(capability) || !/\.v[1-9]\d*$/.test(capability) || !provider
                || Object.keys(provider).sort().join(',') !== 'commit,prepare'
                || typeof provider.prepare !== 'function' || typeof provider.commit !== 'function') throw new Error('Invalid optional reward provider');
            if (this.optionalRewards.has(capability)) throw new Error(`Conflicting optional reward providers: ${capability}`);
            this.optionalRewards.set(capability, { module, provider });
        }
        for (const module of this.modules) if (module.interactionCommands && (!Array.isArray(module.interactionCommands)
            || new Set(module.interactionCommands).size !== module.interactionCommands.length
            || module.interactionCommands.some(action => !validId(action) || typeof module.commands?.[action] !== 'function')))
            throw new Error('Invalid interaction command declaration');
        for (const module of this.modules) if (module.view) {
            if (!isJson(module.view.definitions) || !module.view.stateFields.every(safeStateField)
                || !module.view.playerComponents.every(validId)) throw new Error('Invalid extension display descriptor');
            if (module.view.componentFields && (!isJson(module.view.componentFields) || Array.isArray(module.view.componentFields)
                || Object.entries(module.view.componentFields).some(([name,fields])=>!module.view!.playerComponents.includes(name)
                    || !Array.isArray(fields) || new Set(fields).size !== fields.length || !fields.every(safeStateField))))
                throw new Error('Invalid extension component projection');
            this.views.set(module.id, freezeView(structuredClone(module.view)));
        }
        if (this.modules.filter(module => module.commitItemGrowth).length > 1) throw new Error('Conflicting item growth providers');
        this.causality = new EffectCausality();
        if (snapshot) this.validateSnapshot(snapshot);
        this.states = snapshot ? structuredClone(snapshot.modules) : Object.fromEntries(this.modules.map(module => [module.id, cloneJson(module.initialState())]));
        this.components = snapshot ? structuredClone(snapshot.components) : {};
        if (snapshot) {
            this.causality.restore(snapshot.foundation.causality);
            this.deaths = structuredClone(snapshot.foundation.deaths);
            this.world = structuredClone(snapshot.foundation.world);
            this.nextFactId = snapshot.foundation.nextFactId;
            this.pendingStoryFacts = structuredClone(snapshot.foundation.pendingStoryFacts);
        }
        restoreEdibleState(this, snapshot ? Object.fromEntries(['kindKnowledge','actorNeeds','timedStats','departures'].filter(k=>k in snapshot.foundation).map(k=>[k,(snapshot.foundation as any)[k]])) : {});
        this.initializeStats(snapshot);
        this.validateSnapshot(this.snapshot());
    }
    get stats():StatPipeline{return statSessions.get(this)!.pipeline;}
    private get statQuery():StatQuery{
        let query=statQueries.get(this);if(!query){const pipeline=this.stats;query=Object.freeze({applied:pipeline.applied.bind(pipeline),value:pipeline.value.bind(pipeline),rational:pipeline.rational.bind(pipeline),breakdown:pipeline.breakdown.bind(pipeline),hypothetical:pipeline.hypothetical.bind(pipeline)});statQueries.set(this,query);}return query;
    }
    private initializeStats(snapshot?:ExtensionSnapshot):void{
        const session:StatSession={pipeline:null!,ledger:new MaterializedStats(()=>markRecordingRoot(this)),actors:new Map(),simulationTicks:null,inProgress:false,writes:false,overrides:new Map(),proposals:null,moduleViews:new Map(),previewComponents:null,materialSignatures:new Map(),materialValues:new Map(),collecting:false,dirty:new Set(),reconciling:false};
        statSessions.set(this,session);session.ledger.restore(snapshot?.foundation.stats);
        const actor=(id:number)=>{const a=session.actors.get(id);if(!a)throw new StatValidationError('source');return a;};
        session.pipeline=new StatPipeline({nativeSignature:id=>JSON.stringify([nativeStatSignature(actor(id)),this.actorActionBinding()?.state.actors.find(row=>row.actorId===id)?.profileId]),beforeRead:id=>{if(session.dirty.has(id)&&!session.inProgress&&!session.reconciling&&!this.pureProviderPhase)this.reconcileMaterialized(id);},debug:this.ports.testMode?.()===true,applied:(id,key)=>session.ledger.bonus(id,key),actor:id=>nativeStatFacts(actor(id),this.ports.playerId()),revision:id=>nativeStatRevision(actor(id)),
            base:(id,key,dep,facts,change,known)=>{
                const override=session.overrides.get(`${id}:${key}`);if(override!==undefined)return override;
                if(key.startsWith('native.'))return nativeBase(actor(id),key,dep,facts,change,known,k=>session.ledger.bonus(id,k));
                if(key.startsWith('combat.'))return this.combatStatBase(actor(id),key,facts);
                return facts.baseValue??session.pipeline.keys.get(key)?.base??0;
            },collect:(id,facts,change,known,queryStat)=>{
                if(session.collecting)throw new StatValidationError('source');
                session.collecting=true;try{
                const all:import('../engine/Stats/StatPipeline').OwnedStatRow[]=[...nativeRows(actor(id),change,known)];
                for(const r of peekEdibleState(this).timedStats?.rows??[])if(r.actorId===id&&(session.simulationTicks??this.ports.simulationTicks?.()??0)<r.untilTick)all.push({stat:r.key,category:r.category,value:r.value,layer:'temporary',sourceKind:'edible',sourceId:`${r.owner}.${r.key}`,owner:r.owner,...(r.category==='more'?{slot:'temporary'}:{})});
                for(const module of this.modules){const provider=module.statSources;if(!provider)continue;
                    const previous=this.pureProviderPhase;this.pureProviderPhase=true;
                    try{let view=!change?session.moduleViews.get(module.id):undefined;if(!view){view={state:freezeView(cloneJson(this.states[module.id]!)),components:{}};if(!change)session.moduleViews.set(module.id,view);}const context=Object.freeze({playerId:this.ports.playerId(),state:view.state,facts:freezeView(structuredClone(facts)),
                        getComponent:(actorId:number,name:string)=>{const key=`${actorId}:${name}`,value=session.previewComponents?.[`${actorId}:${module.id}:${name}`]??this.components[String(actorId)]?.[`${module.id}:${name}`];return value===undefined?undefined:view!.components[key]??(view!.components[key]=freezeView(cloneJson(value)));},
                        equippedItems:()=>freezeView(nativeEquippedItems(actor(id),change).filter(item=>actor(id) instanceof Player&&(actor(id) as Player).inventory.items.some(owned=>owned.id===item.id)).map(item=>({id:item.id,category:item.category,kindKey:item.identityId??item.name,enchant:known&&!item.isIdentified?0:item.enchantment,identified:item.isIdentified,runic:{kind:item.runicType??null,identified:item.runicKnown}}))),
                        base:(key:string)=>{if(!session.pipeline.keys.has(key))throw new StatValidationError('declaration');const {baseValue:_,...otherFacts}=facts,baseFacts:PairFacts=key===queryStat?facts:otherFacts;const value=key.startsWith('native.')?nativeBase(actor(id),key,()=>{throw new StatValidationError('declaration');},baseFacts,change,known,k=>session.ledger.bonus(id,k)):key.startsWith('combat.')?this.combatStatBase(actor(id),key,baseFacts):baseFacts.baseValue??session.pipeline.keys.get(key)?.base??0;if(typeof value!=='number')throw new StatValidationError('source');return value;}});
                        const rows=provider.collect(nativeStatFacts(actor(id),this.ports.playerId()),context);validateStatRows(rows,module.id,session.pipeline.keys);
                        if(provider.revisionHint){const revision=provider.revisionHint(nativeStatFacts(actor(id),this.ports.playerId()),context);if(!Number.isSafeInteger(revision)||revision<0)throw new StatValidationError('source');}
                        all.push(...structuredClone(rows).map(row=>({...row,owner:module.id})));
                    }finally{this.pureProviderPhase=previous;}
                }return all;}finally{session.collecting=false;}
            },nativeRows:(id,key,dep,facts,change,known)=>nativeNodeRows(actor(id),key,dep,facts,change,known)} ,NATIVE_STAT_KEYS,NATIVE_STAT_DAG);
        for(const module of this.modules){if(module.statSources){if(typeof module.statSources.collect!=='function')throw new StatValidationError('declaration');session.pipeline.registerProviderKeys(module.statSources.keys??[],module.id);}}
    }
    /** Engine UI only: detached own-component proposal, never a module write port. */
    hypotheticalComponents(moduleId:string, actorId:number, components:Readonly<Record<string,Json>>, knownOnly=true):Readonly<Record<string,number>> {
        if (!this.modules.some(module=>module.id===moduleId) || !isJson(components)) throw new StatValidationError('source');
        const session=statSessions.get(this)!,previous=session.previewComponents;
        session.previewComponents=Object.fromEntries(Object.entries(components).map(([name,value])=>[`${actorId}:${moduleId}:${name}`,freezeView(cloneJson(value))]));
        try { return session.pipeline.hypothetical(actorId,{},knownOnly); }
        finally { session.previewComponents=previous; }
    }
    private combatStatBase(actor:Creature,key:string,facts:PairFacts):number{
        if(facts.baseValue!==undefined)return facts.baseValue;
        const binding=this.actorActionBinding();if(!binding)return this.stats.keys.get(key)?.base??(key.endsWith('-capacity')?1:0);
        const definitions=binding.definition,row=binding.state.actors.find(r=>r.actorId===actor.id);
        const profileId=row?.profileId??(actor instanceof Player?definitions.playerProfileId:definitions.nativeProfiles.find(p=>p.monsterId===('typeId' in actor?actor.typeId:null))?.profileId??definitions.playerProfileId);
        const profile=definitions.profiles.find(p=>p.id===profileId)!;const policy=definitions.resourcePolicies.find(p=>p.id===profile.resourcePolicyId)!;
        if(key==='combat.stamina-capacity')return policy.staminaCapacity;if(key==='combat.poise-capacity')return policy.poiseCapacity;
        if(key==='combat.stamina-regen')return policy.regenPerTickNumerator;if(key==='combat.poise-recovery')return policy.poiseRecoveryNumerator;
        if(key==='combat.native-attack-cost')return policy.nativeAttackCost;return 0;
    }
    private invalidateStats():void{const session=statSessions.get(this);if(session){session.writes=true;session.pipeline.clear();session.moduleViews.clear();for(const actor of this.creatures)markStatsDirty(actor);}}
    reconcileMaterialized(actorId:number):void{
        const session=statSessions.get(this)!;if(this.pureProviderPhase)return;
        const actor=session.actors.get(actorId);if(!actor)return;
        const previousReconcile=session.reconciling;session.reconciling=true;
        try {
        const signature=session.pipeline.sourceSignature(actorId);
        if(session.materialSignatures.get(actorId)===signature&&!session.proposals?.has(actorId)){
            for(const [key,value] of session.materialValues.get(actorId)??[]){
                const row=this.actorActionBinding()?.state.actors.find(row=>row.actorId===actorId);
                if(key==='combat.stamina-capacity'&&row)row.stamina=Math.min(row.stamina,value);
                if(key==='combat.poise-capacity'&&row)row.poise=Math.min(row.poise,value);
                if(key==='growth.focus-capacity'){const focus=this.components[String(actorId)]?.['growth:focus'] as {current:number}|undefined;if(focus)focus.current=Math.min(focus.current,value);}
            }
            return;
        }
        const values=new Map<string,number>();
        session.ledger.reconcile(actorId,session.pipeline,key=>key==='native.max-hp'?actor.maxHp:key==='native.strength'&&actor instanceof Player?actor.strength:undefined,(key,value,refill)=>{
            values.set(key,value);
            if(key==='native.max-hp'){const previous=actor.maxHp;actor.maxHp=value;if(value<previous&&!(session.proposals?.get(actorId)?.hp!==undefined&&session.proposals.get(actorId)!.hp!>value&&session.proposals.get(actorId)!.maxHp===value))actor.hp=Math.min(actor.hp,value);else if(value>previous&&refill&&actor.hp>0&&session.proposals?.get(actorId)?.hp===undefined)actor.hp=Math.min(value,actor.hp+refill);}
            else if(key==='native.strength'&&actor instanceof Player)actor.strength=value;
            else if(key.startsWith('combat.')){const row=this.actorActionBinding()?.state.actors.find(r=>r.actorId===actorId);if(row){if(key==='combat.stamina-capacity')row.stamina=Math.min(row.stamina,value);if(key==='combat.poise-capacity')row.poise=Math.min(row.poise,value);}}
            else if(key==='growth.focus-capacity'){const focus=this.components[String(actorId)]?.['growth:focus'] as {current:number}|undefined;if(focus)focus.current=Math.min(focus.current+refill,value);}
        });
        session.materialSignatures.set(actorId,session.pipeline.sourceSignature(actorId));session.materialValues.set(actorId,values);
        } finally {session.dirty.delete(actorId);session.reconciling=previousReconcile;}
    }
    private assertResourceBounds(actors:readonly Creature[]):void {
        for(const actor of actors){const focus=this.components[String(actor.id)]?.['growth:focus'] as {current:number;remainder:number}|undefined;
            if(focus){const capacity=this.stats.value(actor.id,'growth.focus-capacity'),interval=this.stats.value(actor.id,'growth.focus-recovery-interval');
                if(focus.current>capacity||focus.remainder>=interval)throw new StatValidationError('source');}
        }
    }
    assertStats():void{const session=statSessions.get(this)!;session.ledger.assert([...session.actors.keys()],session.pipeline,(id,key)=>{const a=session.actors.get(id)!;return key==='native.max-hp'?a.maxHp:key==='native.strength'&&a instanceof Player?a.strength:undefined;});}
    /** Engine preflight only: nested actor scopes inherit the candidate clock. */
    withStatWorld<T>(actors:readonly Creature[],work:()=>T,simulationTicks?:number):T{
        const s=statSessions.get(this)!,previousActors=s.actors,previousTicks=s.simulationTicks;
        s.actors=new Map(actors.map(a=>[a.id,a]));
        s.simulationTicks=simulationTicks??previousTicks;
        s.pipeline.clear();
        try{return work();}
        finally{s.actors=previousActors;s.simulationTicks=previousTicks;s.pipeline.clear();}
    }
    private context(module: ExtensionModule, scope: object | null): ExtensionContext {
        const runtime = this;
        const writable = (): void => { if (!scope || runtime.activeScope !== scope || runtime.disposed || runtime.pureProviderPhase) throw new Error('Extension mutation outside lifecycle/command/hook'); markRecordingRoot(runtime); };
        const ordinaryCapability = (): void => { writable(); if (runtime.rewardProviderPhase) throw new Error('Capability forbidden in optional reward provider'); };
        const componentKey = (name: string): string => {
            if (!validId(name)) throw new Error('Invalid component name');
            return `${module.id}:${name}`;
        };
        const creatureKey = (id: number): string => {
            if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid creature ID');
            return String(id);
        };
        return {
            moduleId: module.id,
            stats: runtime.statQuery,
            previewStats:(id,components)=>runtime.hypotheticalComponents(module.id,id,components,false),
            get depth() { return runtime.ports.depth(); },
            get turn() { return runtime.ports.turn?.() ?? 0; },
            get nextFactId() { return runtime.nextFactId; },
            commitFactRange(first, count) {
                ordinaryCapability();
                if (allocatingFacts.has(runtime)) throw new Error('Fact range already assigned by foundation');
                if (!Number.isSafeInteger(first) || first !== runtime.nextFactId || !Number.isSafeInteger(count) || count < 1
                    || !Number.isSafeInteger(first + count)) throw new Error('Invalid story fact range');
                runtime.nextFactId += count;
            },
            interactables() { return freezeView(structuredClone(runtime.world.entities.filter(entity => entity.owner === module.id))); },
            interactionTarget(id) {
                const entity = runtime.world.entities.find(entity => entity.id === id && entity.owner === module.id);
                return entity && runtime.ports.canInteractWith?.(entity) ? freezeView(structuredClone(entity)) : null;
            },
            placeInteractables(requests) {
                ordinaryCapability();
                if (!module.worldInteractables || runtime.currentHook !== 'enteredLevel' || !runtime.publishingGeneration) throw new Error('World placement outside committed level entry');
                return runtime.placeInteractables(module.id, requests);
            },
            interactionGate(active) {
                ordinaryCapability();
                if (runtime.commandModule !== module || runtime.activeScope !== runtime.commandScope) throw new Error('Interaction gate outside module command');
                if (active === null) {
                    if (runtime.world.gate && runtime.world.gate.owner !== module.id) throw new Error('Interaction gate owner mismatch');
                    runtime.world.gate = null; return;
                }
                if (!active || Object.keys(active).sort().join(',') !== 'sessionId,targetEntityId'
                    || !Number.isSafeInteger(active.sessionId) || active.sessionId < 1
                    || !Number.isSafeInteger(active.targetEntityId) || !module.interactionCommands?.length
                    || (runtime.world.gate && (runtime.world.gate.owner !== module.id
                        || runtime.world.gate.sessionId !== active.sessionId || runtime.world.gate.targetEntityId !== active.targetEntityId))) throw new Error('Invalid interaction gate');
                const entity = runtime.world.entities.find(entity => entity.id === active.targetEntityId && entity.owner === module.id);
                if (!entity || !runtime.ports.canInteractWith?.(entity)) throw new Error('Unavailable interaction target');
                runtime.world.gate = { owner: module.id, ...active };
            },
            get playerId() { return runtime.ports.playerId(); },
            get state() { return cloneJson(runtime.states[module.id]!); },
            isInitialCommand(action, data) { return runtime.isInitialCommand(action, data); },
            queryOptional(capability, input) { return runtime.queryOptional(capability, input); },
            prepareOptionalReward(capability, rewardId, instanceId) {
                return runtime.prepareOptionalReward(module.id, capability, rewardId, instanceId);
            },
            commitOptionalReward(capability, rewardId, instanceId) {
                ordinaryCapability();
                return runtime.commitOptionalReward(module.id, capability, rewardId, instanceId);
            },
            setState(value) {
                writable(); if (!module.validateState(value)) throw new Error(`Invalid module state: ${module.id}`);
                // An entered-level/GC hook may update the same ledger while a
                // native action carries recovery across floors. Preserve its
                // scheduler/actor object graph just like a part-break commit.
                const current=runtime.states[module.id]!;
                // Distinct finite own revision values already prove unequal JSON.
                // Stored state is detached JSON; only its comparison can be skipped.
                // Incoming serialization still runs (including reads/errors), even
                // for a permissive generic module with accessor-backed input.
                const a=!Array.isArray(current)&&current&&typeof current==='object'?Object.getOwnPropertyDescriptor(current,'revision'):undefined;
                const b=!Array.isArray(value)&&value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'revision'):undefined;
                const changed=a?.enumerable&&b?.enumerable&&'value' in a&&'value' in b
                    &&typeof a.value==='number'&&typeof b.value==='number'&&Number.isFinite(a.value)&&Number.isFinite(b.value)&&a.value!==b.value;
                if(changed)canonical(value);
                else if(canonical(current)===canonical(value))return;
                runtime.states[module.id]=module.actorActions?adoptActorActionJson(current,value):cloneJson(value); if(module.statSources||module.actorActions)runtime.invalidateStats();
            },
            getComponent(id, name) { const value = runtime.components[creatureKey(id)]?.[componentKey(name)]; return value === undefined ? undefined : cloneJson(value); },
            setComponent(id, name, value) { writable(); if (module.componentValidators?.[name] && !module.componentValidators[name]!(value)) throw new Error('Invalid component value'); const key = creatureKey(id),nameKey=componentKey(name),current=runtime.components[key]?.[nameKey];if(current!==undefined&&canonical(current)===canonical(value))return; (runtime.components[key] ??= {})[nameKey] = cloneJson(value); if(module.statSources||module.actorActions)runtime.invalidateStats(); },
            removeComponent(id, name) { writable(); const key = creatureKey(id),nameKey=componentKey(name);if(runtime.components[key]?.[nameKey]===undefined)return; delete runtime.components[key]?.[nameKey]; if (runtime.components[key] && !Object.keys(runtime.components[key]!).length) delete runtime.components[key]; if(module.statSources||module.actorActions)runtime.invalidateStats(); },
            creature(id) { const actor = [...runtime.creatures].find(creature => creature.id === id); return actor ? runtime.actorFacts(actor) : null; },
            grantReward(request) {
                ordinaryCapability();
                if (!request || Object.keys(request).sort().join(',') !== 'instanceId,recipientId,rewardId'
                    || !Number.isSafeInteger(request.recipientId) || request.recipientId < 1 || !validId(request.rewardId) || !validId(request.instanceId))
                    throw new Error('Invalid trusted reward request');
                runtime.emit('rewardGranted',{issuerId:module.id,...request});
            },
            knownKinds() { return structuredClone(runtime.ports.knownKinds?.() ?? []); },
            commitResources(id, value) { writable(); if (!module.resourceCommits || !runtime.resourcePhase) throw new Error('Resource commit outside authorized growth boundary'); runtime.commitResources(id, value); },
            canManageCharacter() { return runtime.ports.canManageCharacter?.() ?? true; },
            validateAction(request) { return runtime.ports.validateAction?.(request) ?? false; },
            executeAction(request, callbacks) {
                ordinaryCapability();
                if (runtime.commandModule !== module || runtime.activeScope !== runtime.commandScope || runtime.controlledAction || runtime.commandActionUsed || !runtime.ports.executeAction)
                    throw new Error('Controlled action outside module command');
                if (!callbacks || typeof callbacks.beforeCommit !== 'function' || typeof callbacks.afterResolve !== 'function')
                    throw new Error('Invalid controlled action callbacks');
                const input = freezeView(structuredClone(request));
                runtime.controlledAction = true; runtime.commandActionUsed = true; runtime.nativeActionRevision++; runtime.actionActorId = input.actorId;
                let committed = false, resolved = false;
                try {
                    return runtime.ports.executeAction(input, {
                        beforeCommit() {
                            if (committed) throw new Error('Duplicate controlled action commit');
                            committed = true; runtime.actionResolutions = [];
                            runtime.invoke(module, context => callbacks.beforeCommit(context));
                        },
                        afterResolve(outcome) {
                            if (!committed || resolved) throw new Error('Invalid controlled action resolution');
                            resolved = true;
                            const resolutions = runtime.actionResolutions ?? [];
                            const selectedTarget = input.target.kind === 'creature' ? input.target.id : null;
                            const selected = resolutions.filter(fact => selectedTarget === null || fact.defender.id === selectedTarget);
                            const result: ControlledActionResult = { ...input, moved: outcome.moved, actorId: input.actorId, resolutions,
                                hit: selected.some(fact => fact.result.hit), hpLost: selected.reduce((sum, fact) => sum + fact.hpLost, 0) };
                            runtime.actionResolutions = null;
                            runtime.invoke(module, context => callbacks.afterResolve(freezeView(structuredClone(result)), context));
                        },
                    });
                } finally { runtime.actionResolutions = null; runtime.actionActorId = null; runtime.controlledAction = false; }
            },
            characterResources(id) { return runtime.characterResources(id); },
            commitCharacterResources(id, value) { writable(); if (!module.resourceCommits || !runtime.resourcePhase) throw new Error('Character commit outside authorized growth boundary'); runtime.commitCharacterResources(id, value); },
            randomInt(min, max) {
                ordinaryCapability();
                const span = max - min + 1;
                // The engine's rejection sampler requires a nonzero divisor.
                if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max
                    || !Number.isSafeInteger(span) || span > 0xffffffff) throw new Error('Invalid extension random range');
                return runtime.ports.randomInt(min, max);
            },
            message(text) {
                writable();
                if (typeof text !== 'string') throw new Error('Invalid extension message');
                const buffer = runtime.messageBuffers[runtime.messageBuffers.length - 1];
                if (buffer) buffer.push(text); else runtime.ports.message(text);
            },
        };
    }
    private actorFacts(creature: Creature, playerId = this.ports.playerId()): ActorFacts {
        const player = creature.id === playerId;
        const allied = player || ('isAlly' in creature && creature.isAlly === true);
        return Object.freeze({ ...creatureView(creature, playerId),
            ...(creature.spatial?.movementRegionId!==undefined?{movementRegionId:creature.spatial.movementRegionId}:{}), allied,
            hostile: !player && !allied && !('isCaged' in creature && creature.isCaged === true),
            monsterId: 'typeId' in creature && typeof creature.typeId === 'string' ? creature.typeId : null });
    }
    observeCreature(creature: Creature): void {
        if (this.modules.some(module => module.hooks?.actorObserved)) this.emit('actorObserved', { actor: this.actorFacts(creature) });
    }
    private commitResources(id: number, value: ResourceCommit): void {
        const actor = [...this.creatures].find(creature => creature.id === id);
        if (!actor || Object.keys(value).sort().join(',') !== 'expectedHp,expectedMaxHp,hp,maxHp'
            || !Object.values(value).every(Number.isSafeInteger) || value.maxHp < 1 || value.hp < 0
            || (value.hp > value.maxHp && (actor instanceof Player || actor.hp <= actor.maxHp || value.hp > actor.hp))
            || value.expectedHp !== actor.hp || value.expectedMaxHp !== actor.maxHp
            || (actor.hp <= 0 && value.hp > 0)) throw new Error('Invalid extension resource commit');
        const session=statSessions.get(this)!;
        if(session.proposals){const old=session.proposals.get(id)??{oldMaxBonus:session.ledger.bonus(id,'native.max-hp'),oldStrengthBonus:session.ledger.bonus(id,'native.strength')};session.proposals.set(id,{...old,hp:value.hp,maxHp:value.maxHp});}
        else {actor.maxHp=value.maxHp;actor.hp=value.hp;}
        this.stats.clear(id);
    }
    private characterResources(id: number): CharacterResources {
        const actor = [...this.creatures].find(creature => creature.id === id);
        if (!actor) throw new Error('Unknown character resource owner');
        return actor instanceof Player ? { strength: actor.strength, gold: this.ports.gold?.() ?? 0 } : { strength: null, gold: null };
    }
    private commitCharacterResources(id: number, value: CharacterResourceCommit): void {
        const actor = [...this.creatures].find(creature => creature.id === id), current = this.characterResources(id);
        if (Object.keys(value).sort().join(',') !== 'expectedGold,expectedStrength,gold,strength'
            || value.expectedStrength !== current.strength || value.expectedGold !== current.gold
            || (actor instanceof Player ? (!Number.isSafeInteger(value.strength) || value.strength! < 1
                || !Number.isSafeInteger(value.gold) || value.gold! < 0) : value.strength !== null || value.gold !== null))
            throw new Error('Invalid extension character resource commit');
        if (actor instanceof Player) {
            if (!this.ports.setGold && value.gold !== current.gold) throw new Error('Native currency port unavailable');
            const session=statSessions.get(this)!;
            if(session.proposals){const old=session.proposals.get(id)??{oldMaxBonus:session.ledger.bonus(id,'native.max-hp'),oldStrengthBonus:session.ledger.bonus(id,'native.strength')};session.proposals.set(id,{...old,strength:value.strength!});}
            else actor.strength=value.strength!;
            this.ports.setGold?.(value.gold!);this.stats.clear(id);
        }
    }
    private ruleContext(module: ExtensionModule): ExtensionRuleContext {
        const freeze = <T>(value: T): T => {
            if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
            return value;
        };
        const runtime = this;
        return Object.freeze({ playerId: this.ports.playerId(),
            get state() { return freeze(cloneJson(runtime.states[module.id]!)); },
            getComponent: (id: number, name: string): Json | undefined => {
                if (!Number.isSafeInteger(id) || id < 1 || !validId(name)) throw new Error('Invalid rule component query');
                const value = this.components[String(id)]?.[`${module.id}:${name}`];
                return value === undefined ? undefined : freeze(cloneJson(value));
            } });
    }
    /** Trusted native reference, never a module/UI supplied actor ID. */
    queryOptionalActor(capability: string, actor: Creature, input: Json): OptionalQueryResult {
        if(this.disposed||!validId(capability)||!/\.v[1-9]\d*$/.test(capability)||!isJson(input))throw new Error('Invalid optional actor query');
        // No provider means no actor data is read or transmitted. Fixture/native
        // callers without this optional seam retain the original template path.
        if(!actorQueryProviders.get(this)?.has(capability))return Object.freeze({status:'unavailable',reason:'absent'});
        if (!this.creatures.has(actor) || !actorQueryScopes.get(this)?.(actor)) throw new Error('Untrusted actor query scope');
        return this.queryActorProvider(capability,actor,input,this.ports.playerId());
    }
    queryOptionalActorInWorld(capability:string,actor:Creature,input:Json,world:ActorActionProductionWorld):OptionalQueryResult {
        if (!resolveActorQueryScope(world,actor)) throw new Error('Untrusted candidate actor query scope');
        return this.queryActorProvider(capability,actor,input,world.player.id);
    }
    private queryActorProvider(capability:string,actor:Creature,input:Json,playerId:number):OptionalQueryResult {
        if (this.disposed || this.pureProviderPhase || !validId(capability) || !/\.v[1-9]\d*$/.test(capability) || !isJson(input))
            throw new Error('Invalid optional actor query');
        const entry = actorQueryProviders.get(this)?.get(capability);
        if (!entry) return Object.freeze({status: 'unavailable', reason: 'absent'});
        const {module, provider} = entry, value = freezeView(cloneJson(input));
        let open = true; this.pureProviderPhase = true;
        try {
            const accepted = provider.accepts(value); requireSynchronous(accepted);
            if (typeof accepted !== 'boolean') throw new Error('Invalid actor query acceptance');
            if (!accepted) return Object.freeze({status:'unavailable',reason:'unsupported-input'});
            const result = provider.query(value, Object.freeze({playerId, actor:freezeView(this.actorFacts(actor,playerId)),
                state:freezeView(cloneJson(this.states[module.id]!)), getActorComponent: (name: string) => {
                    if (!open || !validId(name)) throw new Error('Closed or invalid actor component scope');
                    const component = this.components[String(actor.id)]?.[`${module.id}:${name}`];
                    return component === undefined ? undefined : freezeView(cloneJson(component));
                }}));
            requireSynchronous(result);
            if (!isJson(result)) throw new Error('Invalid actor query result');
            const valid = provider.validate(result); requireSynchronous(valid);
            if (valid !== true) throw new Error('Invalid actor query result');
            return freezeView({status:'available' as const,value:cloneJson(result)});
        } finally {open = false; this.pureProviderPhase = false;}
    }
    hasCommittedFactConsumer(capability: string,eventKind?:CombatEventKind): boolean { return (factConsumers.get(this)?.get(capability)??[]).some(({consumer})=>!eventKind||!consumer.eventKinds||consumer.eventKinds.includes(eventKind)); }
    private publishCommittedFact(capability: string, pending: Omit<CombatEventFact, 'factId'> | PendingStoryFact): void {
        const consumers = (factConsumers.get(this)?.get(capability)??[]).filter(({consumer})=>pending.kind!=='combat-event'||!consumer.eventKinds||consumer.eventKinds.includes(pending.eventKind));
        if (!consumers.length) return;
        const count = 1 + consumers.reduce((sum,{consumer})=>sum+consumer.maxDerivedFacts,0);
        if (count > STORY_FACT_LIMIT || !Number.isSafeInteger(this.nextFactId + count)) throw new Error('Committed fact budget exhausted');
        const frame=committedTransactions.get(this);
        if(frame && frame.allocated+count>STORY_FACT_LIMIT)throw new Error('Committed transaction fact budget exhausted');
        if(frame)frame.allocated+=count;
        const fact = freezeView({...pending,factId:this.nextFactId}) as Readonly<CommittedFact>;
        let next = this.nextFactId + 1;
        const plans = consumers.map(({module,consumer}) => {
            const allocation = Object.freeze({firstDerivedFactId:next,maxDerivedFacts:consumer.maxDerivedFacts});
            next += consumer.maxDerivedFacts;
            let open = true;
            const read = () => { if (!open) throw new Error('Closed committed fact preparation'); };
            const priorPure=this.pureProviderPhase;this.pureProviderPhase=true;
            try {
                const plan = consumer.prepare(fact,allocation,Object.freeze({playerId:this.ports.playerId(),state:freezeView(cloneJson(this.states[module.id]!)),
                    queryOptional:(capability:string,input:Json)=>{read();return this.queryOptional(capability,input);},
                    prepareOptionalReward:(capability:string,rewardId:string,instanceId:string)=>{read();this.pureProviderPhase=false;try{return this.prepareOptionalReward(module.id,capability,rewardId,instanceId);}finally{this.pureProviderPhase=true;}}}));
                requireSynchronous(plan); return {module,consumer,plan};
            } finally {open=false;this.pureProviderPhase=priorPure;}
        });
        this.nextFactId = next;
        allocatingFacts.add(this);
        try { for (const {module,consumer,plan} of plans) this.invoke(module,context=>consumer.commit(plan,context)); }
        finally {allocatingFacts.delete(this);}
    }
    /** Native writes and all consumers commit as one synchronous outer transaction. */
    withCommittedFacts<T>(work: () => T,eventKinds:readonly CombatEventKind[]=['attack-resolved','staggered','parried','rest-completed']): T {
        if (this.disposed || this.pureProviderPhase) throw new Error('Unavailable committed fact transaction');
        if (committedTransactions.has(this) || !eventKinds.some(kind=>this.hasCommittedFactConsumer('combat.event.v1',kind))) {
            const result=work();requireSynchronous(result);return result;
        }
        const restoreNative = nativeFactCheckpoints.get(this)?.();
        if (!restoreNative) throw new Error('Missing native committed fact checkpoint');
        const identities=new Map<Creature,{depth:number;actor:CombatEventActor}>();
        for(const actor of this.creatures){const identity=this.combatFactActor(actor);if(identity)identities.set(actor,identity);}
        const frame = {events:[] as Omit<CombatEventFact,'factId'>[],publishing:false,allocated:0,actors:identities};
        committedTransactions.set(this,frame);
        const causes = this.causality.snapshot(), deaths = structuredClone(this.deaths), allocator = getNextEntityId(), restoreRandom = this.ports.checkpointRandom?.();
        const members=new Map([...this.creatures].map(actor=>[actor,{hooks:actor.extensionHooks,spawned:this.spawned.has(actor)}]));
        const nativeRevision=this.nativeActionRevision;
        try { return this.transaction(()=>{
            const result = work(); requireSynchronous(result); frame.publishing=true;
            for (const event of frame.events) {
                const source=[...frame.actors].find(([,identity])=>identity.actor.entityId===event.actor.entityId)?.[0]
                    ??[...this.creatures].find(actor=>actor.id===event.actor.entityId);
                // A zone break can exhaust poise before the same contact's
                // member-to-core transfer becomes lethal. Only committed live
                // stagger starts are facts; death still owns its native fact.
                if(event.eventKind==='staggered'&&source&&source.hp<=0)continue;
                this.publishCommittedFact('combat.event.v1',event);
            }
            return result;
        }); } catch(error) {
            restoreNative();this.causality.restore(causes);this.deaths=deaths;this.nativeActionRevision=nativeRevision;
            for(const actor of this.creatures)if(!members.has(actor)){bindNativeForms(actor);actor.extensionHooks=undefined;this.spawned.delete(actor);this.creatures.delete(actor);}
            for(const [actor,entry] of members){this.creatures.add(actor);actor.extensionHooks=entry.hooks;if(entry.spawned)this.spawned.add(actor);else this.spawned.delete(actor);}
            restoreNextEntityId(allocator);restoreRandom?.();throw error;
        }
        finally {committedTransactions.delete(this);}
    }
    commitCombatEvent(actor: Creature, payload: CombatEventPayload): void {
        if (!this.hasCommittedFactConsumer('combat.event.v1',payload.eventKind)) return;
        const frame = committedTransactions.get(this);
        if (!frame || frame.publishing) throw new Error('Combat fact outside native transaction');
        if (frame.events.length >= STORY_FACT_LIMIT) throw new Error('Combat fact event budget exhausted');
        validateCombatPayload(payload);
        const identity=frame.actors.get(actor)??this.combatFactActor(actor);
        if (!identity) throw new Error('Untrusted combat event actor');
        frame.events.push(freezeView({...structuredClone(payload),kind:'combat-event',depth:identity.depth,turn:this.ports.turn?.()??0,
            actor:structuredClone(identity.actor)}));
    }
    private combatFactActor(actor:Creature):{depth:number;actor:CombatEventActor}|null {
        const scope=actorQueryScopes.get(this)?.(actor);
        if(!scope||!this.creatures.has(actor))return null;
        const coreId=actor.spatial?.bodyMember?.groupId;
        const roleActor=coreId?[...this.creatures].find(candidate=>candidate.id===coreId):actor;
        if(!roleActor)return null;
        const facts=this.actorFacts(roleActor);
        return {depth:scope.depth,actor:{entityId:actor.id,role:facts.player?'player':facts.allied?'ally':facts.hostile?'hostile':'neutral',
            tags:[...this.publicActorTags(actor.id)].sort(),partId:scope.partId,generation:scope.generation}};
    }
    /** Pure engine adapter: one provider per slot, finite synchronous bounded scalars. */
    queryOptional(capability: string, input: Json): OptionalQueryResult {
        if (this.disposed) throw new Error('Extension runtime unloaded');
        if (!validId(capability) || !/\.v[1-9]\d*$/.test(capability) || !isJson(input)) throw new Error('Invalid optional query');
        const entry = this.optionalQueries.get(capability);
        if (!entry) return Object.freeze({ status: 'unavailable', reason: 'absent' });
        const value = freezeView(cloneJson(input)), { module, provider } = entry;
        const accepted = provider.accepts(value);
        requireSynchronous(accepted);
        if (typeof accepted !== 'boolean') throw new Error('Invalid optional query acceptance');
        if (!accepted) return Object.freeze({ status: 'unavailable', reason: 'unsupported-input' });
        const result = provider.query(value, Object.freeze({
            playerId: this.ports.playerId(), state: freezeView(cloneJson(this.states[module.id]!)),
            getComponent:(id:number,name:string)=>{if(!Number.isSafeInteger(id)||id<1||!validId(name))throw new Error('Invalid component query');const c=this.components[String(id)]?.[`${module.id}:${name}`];return c===undefined?undefined:freezeView(cloneJson(c));},
            getPlayerComponent: (name: string) => {
                if (!validId(name)) throw new Error('Invalid optional player component');
                const component = this.components[String(this.ports.playerId())]?.[`${module.id}:${name}`];
                return component === undefined ? undefined : freezeView(cloneJson(component));
            },
        }));
        requireSynchronous(result);
        const valid = provider.validate(result);
        requireSynchronous(valid);
        if (valid !== true || !isJson(result)) throw new Error('Invalid optional query result');
        return freezeView({ status: 'available' as const, value: cloneJson(result) });
    }
    /** Engine-only atomic seam. No public input/context can issue a break. The
     * caller owns native HP/zone/plan rollback; this runtime owns provider state,
     * components, buffered messages and RNG. Unsupported and absent providers
     * select fallback, never both. Native callers cancel plans only after this
     * transaction succeeds, so failed providers leave prepared work intact. */
    commitPartBreak<T>(request: PartBreakRequest, native: PartBreakNativeCommit<T>): T {
        if (this.disposed || this.pureProviderPhase || this.rewardProviderPhase) throw new Error('Unavailable or recursive part break commit');
        return this.actorActionBinding()?this.withCommittedFacts(()=>this.commitPartBreakWithin(request,native),['staggered']):this.commitPartBreakWithin(request,native);
    }
    private commitPartBreakWithin<T>(request: PartBreakRequest, native: PartBreakNativeCommit<T>): T {
        if (this.disposed || this.pureProviderPhase || this.rewardProviderPhase) throw new Error('Unavailable or recursive part break commit');
        const member = request.partId === 'self' ? undefined : bodyHandlers.get(this)?.validateMemberBreak?.(request);
        if(request.partId!=='self' && !member)throw new Error('Unavailable member break identity');
        validatePartBreakRequest(request,member||undefined);
        const actor = [...this.creatures].find(c => c.id === request.actorId);
        if (!actor || actor.hp <= 0) throw new Error('Unavailable part break actor');
        if (request.partId !== 'self' && (!member || member.groupId !== request.groupId || member.partId !== request.partId
            || member.generation !== request.generation || member.entityId === actor.id && request.zoneId === 'body'
            || ![...this.creatures].some(c => c.id === member.entityId && c.hp > 0
                && c.spatial?.bodyMember?.groupId === actor.id && c.spatial.bodyMember.partId === member.partId)))
            throw new Error('Unavailable member break identity');
        const value = freezeView(structuredClone(request)), entry = partBreakProviders.get(this);
        const actionBinding=this.actorActionBinding();
        const oldBundle=this.ports.actorActions?.()?.bundles.find(bundle=>bundle.owner==='combat'&&bundle.decisionOwnerId===actor.id);
        const oldStagger=(actionBinding?.state.actors.find(row=>row.actorId===actor.id)?.staggerRemainingTicks??0)>0
            ||!!oldBundle?.subactions.some(child=>child.phases[child.phaseIndex]?.kind==='break-recovery');
        const actionState=actionBinding?.state as unknown as Json|undefined;
        const liveState = entry?.module.actorActions ? this.states[entry.module.id] : undefined;
        const identityCheckpoint = actionState ? actorActionIdentityCheckpoint(actionState) : undefined;
        const restoreNative = zoneBreakCheckpoints.get(this)?.();
        let providerCommitActive=false;
        let applied = false;
        try {
            return this.transaction(() => {
                let preparation: PartBreakPreparation | undefined;
                if (entry) {
                    const context = this.ruleContext(entry.module);
                    let active = true;
                    const getComponent = (id: number, name: string) => {
                        if (!active) throw new Error('Expired part break preparation');
                        return context.getComponent(id, name);
                    };
                    this.pureProviderPhase = true;
                    try {
                        preparation = entry.provider.prepare(value, Object.freeze({ ...context, actor: this.actorFacts(actor), getComponent, stats:this.statQuery, actorActionBundles: freezeView(structuredClone(this.ports.actorActions?.()?.bundles ?? [])),
                            queryActor:(capability:string,input:Json)=>{if(!active)throw new Error('Expired part break actor query');
                                this.pureProviderPhase=false;try{return this.queryOptionalActor(capability,actor,input);}finally{this.pureProviderPhase=true;}},
                            ...(member ? { member: freezeView(structuredClone(member)) } : {}) }));
                        requireSynchronous(preparation);
                        if (!isJson(preparation) || !preparation || typeof preparation !== 'object' || Array.isArray(preparation)
                            || (preparation.status === 'ready' ? Object.keys(preparation).sort().join(',') !== 'plan,status'
                                : preparation.status !== 'unsupported' || Object.keys(preparation).sort().join(',') !== 'reason,status'
                                    || !['disabled', 'unsupported-target'].includes(preparation.reason))) throw new Error('Invalid part break preparation');
                        preparation = freezeView(structuredClone(preparation));
                    } finally { active = false; this.pureProviderPhase = false; }
                }
                const choice: PartBreakChoice = Object.freeze(preparation?.status === 'ready'
                    ? { status: 'handled' } : { status: 'fallback', reason: preparation?.reason ?? 'absent' });
                applied = true;
                const result = native.apply(choice);
                requireSynchronous(result);
                if (entry && preparation?.status === 'ready') {
                    const plan = preparation.plan;
                    this.rewardProviderPhase = true;providerCommitActive=true;
                    try {
                        this.invoke(entry.module, context => {
                            const narrow: PartBreakCommitContext = {
                                get state() { return context.state; }, setState: next => {
                                    if(!providerCommitActive)throw new Error('Expired part break commit outside synchronous scope');
                                    if (liveState) {
                                        // This narrow provider may run inside a native release,
                                        // while other unchanged owners are also due at zero.
                                        validateProductionActorAttackTransactionState(next,entry.module.actorActions!.definitions as unknown as ActorAttackDefinitions,
                                            liveState as unknown as ProductionActorAttackState);
                                        this.states[entry.module.id] = adoptActorActionJson(liveState,cloneJson(next));
                                    } else context.setState(next);
                                },
                                getComponent: context.getComponent, setComponent: context.setComponent,
                                ...(member ? { member: freezeView({ ...member }) } : {}),
                                removeComponent: context.removeComponent, message: context.message,
                            };
                            const committed = entry.provider.commit(value, plan, Object.freeze(narrow));
                            requireSynchronous(committed);
                            if (committed !== undefined) throw new Error('Invalid part break commit result');
                        });
                    } finally { this.rewardProviderPhase = false;providerCommitActive=false; }
                }
                if (this.actorActionBinding()?.state.actors.find(row => row.actorId === actor.id)?.poise === 0 && oldBundle)
                    this.ports.interruptActorAction?.(actor.id);
                if (member && request.zoneId === 'body') bodyHandlers.get(this)?.memberBroken?.(actor, member);
                else if (member) zoneBreakHandlers.get(this)?.([...this.creatures].find(c => c.id === member.entityId)!, request.zoneId);
                else zoneBreakHandlers.get(this)?.(actor, request.zoneId);
                const nextState=this.actorActionBinding()?.state;
                const nowStagger=(nextState?.actors.find(row=>row.actorId===actor.id)?.staggerRemainingTicks??0)>0
                    ||!!this.ports.actorActions?.()?.bundles.find(bundle=>bundle.owner==='combat'&&bundle.decisionOwnerId===actor.id)?.subactions.some(child=>child.phases[child.phaseIndex]?.kind==='break-recovery');
                if(actor.hp>0&&!oldStagger&&nowStagger)this.commitCombatEvent(actor,{eventKind:'staggered',actionId:oldBundle?.actionId??0,
                    sourceSubactionId:null,segmentIndex:null,resolutionId:request.resolutionId,bonfireId:null,visit:null,hitCount:0,hpLost:0});
                return result;
            });
        } catch (error) {
            if (applied) native.rollback();
            if (actionState && actionBinding) { identityCheckpoint!.restore(); this.states[actionBinding.moduleId] = actionState; }
            restoreNative?.();
            throw error;
        }
    }
    private prepareReward(issuerId: string, capability: string, rewardId: string, instanceId: string):
        { request: Readonly<OptionalRewardRequest>; entry: { module: ExtensionModule; provider: OptionalRewardProvider }; preparation: OptionalRewardPreparation }
        | { preparation: { status: 'skipped'; reason: 'absent' } } {
        if (this.disposed || !validId(capability) || !/\.v[1-9]\d*$/.test(capability)
            || !validId(issuerId) || !validId(rewardId) || !validId(instanceId)) throw new Error('Invalid optional reward request');
        if (this.pureProviderPhase || this.rewardProviderPhase) throw new Error('Recursive optional reward provider');
        const entry = this.optionalRewards.get(capability);
        if (!entry) return { preparation: { status: 'skipped', reason: 'absent' } };
        const request: Readonly<OptionalRewardRequest> = Object.freeze({ issuerId, rewardId, instanceId, recipient: 'player' });
        const { module, provider } = entry, playerId = this.ports.playerId();
        const actor = [...this.creatures].find(creature => creature.id === playerId);
        let active = true;
        const check = (): void => { if (!active) throw new Error('Expired optional reward preparation'); };
        const context = Object.freeze({
            stats:this.statQuery, previewStats:(id:number,components:Readonly<Record<string,Json>>)=>{check();return this.hypotheticalComponents(module.id,id,components,false);}, playerId, player: actor ? this.actorFacts(actor) : null,
            resources: freezeView(actor ? this.characterResources(playerId) : { strength: null, gold: null }),
            state: freezeView(cloneJson(this.states[module.id]!)),
            getComponent:(id:number,name:string)=>{if(!Number.isSafeInteger(id)||id<1||!validId(name))throw new Error('Invalid component query');const c=this.components[String(id)]?.[`${module.id}:${name}`];return c===undefined?undefined:freezeView(cloneJson(c));},
            getPlayerComponent: (name: string) => {
                check();
                if (!validId(name)) throw new Error('Invalid optional player component');
                const component = this.components[String(playerId)]?.[`${module.id}:${name}`];
                return component === undefined ? undefined : freezeView(cloneJson(component));
            },
        });
        this.pureProviderPhase = true;
        try {
            const preparation = provider.prepare(request, context);
            requireSynchronous(preparation);
            if (!isJson(preparation) || !preparation || typeof preparation !== 'object' || Array.isArray(preparation)
                || (preparation.status === 'ready' ? Object.keys(preparation).sort().join(',') !== 'plan,status'
                    : preparation.status !== 'skipped' || Object.keys(preparation).sort().join(',') !== 'reason,status'
                        || !['disabled', 'unsupported-key'].includes(preparation.reason))) throw new Error('Invalid optional reward preparation');
            return { request, entry, preparation: freezeView(structuredClone(preparation)) };
        } finally { active = false; this.pureProviderPhase = false; }
    }
    private prepareOptionalReward(issuerId: string, capability: string, rewardId: string, instanceId: string): OptionalRewardPrepareResult {
        const { preparation } = this.prepareReward(issuerId, capability, rewardId, instanceId);
        return Object.freeze(preparation.status === 'ready' ? { status: 'ready' } : { ...preparation });
    }
    private commitOptionalReward(issuerId: string, capability: string, rewardId: string, instanceId: string): OptionalRewardResult {
        // Re-preflight against the exact current state. No plan token can escape,
        // be forged, survive a command, or be replayed after another grant.
        const prepared = this.prepareReward(issuerId, capability, rewardId, instanceId);
        if (prepared.preparation.status === 'skipped') return Object.freeze({ ...prepared.preparation });
        if (!('entry' in prepared)) throw new Error('Missing optional reward provider');
        const { module, provider } = prepared.entry, plan = prepared.preparation.plan;
        return this.transaction(() => {
            const priorResources = this.resourcePhase; this.resourcePhase = true; this.rewardProviderPhase = true;
            try { this.invoke(module, context => provider.commit(prepared.request, plan, context)); }
            finally { this.resourcePhase = priorResources; this.rewardProviderPhase = false; }
            return Object.freeze({ status: 'applied' as const });
        });
    }
    private resourceCheckpoint(): ResourceCheckpoint[] {
        return [...this.creatures].map(actor => ({ actor, hp: actor.hp, maxHp: actor.maxHp,
            strength: actor instanceof Player ? actor.strength : null,
            gold: actor instanceof Player ? this.ports.gold?.() ?? 0 : null }));
    }
    private restoreResources(resources: readonly ResourceCheckpoint[]): void {
        for (const { actor, hp, maxHp, strength, gold } of resources) {
            actor.hp = hp; actor.maxHp = maxHp;
            if (actor instanceof Player) { actor.strength = strength!; this.ports.setGold?.(gold!); }
        }
    }
    private bufferMessages<T>(work: () => T): T {
        const messages: string[] = []; this.messageBuffers.push(messages);
        let result: T;
        try { result = work(); } catch (error) { this.messageBuffers.pop(); throw error; }
        this.messageBuffers.pop();
        const parent = this.messageBuffers[this.messageBuffers.length - 1];
        if (parent) parent.push(...messages); else for (const message of messages) this.ports.message(message);
        return result;
    }
    /** Extension-owned state and native resource ports form one synchronous commit. */
    /** Generic hooks can update an actor ledger in place. Failed outer scopes
     * must restore the retained native scheduler graph, not only its JSON copy. */
    private checkpointActorStateIdentity():()=>void {
        const binding=this.actorActionBinding();if(!binding)return()=>{};
        const state=binding.state as unknown as Json,checkpoint=actorActionIdentityCheckpoint(state);
        return()=>{checkpoint.restore();this.states[binding.moduleId]=state;};
    }
    private transaction<T>(work: () => T): T {
        const edibleBefore=edibleSnapshot(this);
        const statsBefore=statSessions.get(this)!.ledger.snapshot();
        const restoreActorState=this.checkpointActorStateIdentity();
        const states = structuredClone(this.states), components = structuredClone(this.components), world = structuredClone(this.world);
        const deaths = structuredClone(this.deaths), causes = this.causality.snapshot(), resources = this.resourceCheckpoint();
        const nextFactId = this.nextFactId, pending = structuredClone(this.pendingStoryFacts), nativeActionRevision = this.nativeActionRevision;
        const creatures = new Map([...this.creatures].map(actor => [actor, actor.extensionHooks]));
        const restoreRandom = this.ports.checkpointRandom?.();
        try { return this.bufferMessages(work); }
        catch (error) {
            restoreEdibleState(this,edibleBefore);
            statSessions.get(this)!.ledger.restore(statsBefore);statSessions.get(this)!.materialSignatures.clear();statSessions.get(this)!.materialValues.clear();statSessions.get(this)!.moduleViews.clear();this.stats.clear();
            this.states = states; restoreActorState(); this.components = components; this.world = world;
            this.nextFactId = nextFactId; this.pendingStoryFacts = pending; this.restoreResources(resources);
            for (const [actor, hooks] of creatures) { this.creatures.add(actor); actor.extensionHooks = hooks; }
            // Controlled native actions are not full-world transactions. Never
            // rewind their RNG, causal ledgers or entity allocator while their
            // spawned/moved world objects still exist. Generation owns its own
            // allocator rollback; pure reward/creation/settlement can rewind RNG.
            if (nativeActionRevision === this.nativeActionRevision) {
                this.deaths = deaths; this.causality.restore(causes); restoreRandom?.();
            }
            throw error;
        } finally { markRecordingRoot(this); }
    }
    private initializationReadyFor(snapshot?: ExtensionSnapshot): boolean {
        return this.modules.every(module => {
            // Creation modules should explicitly expose readiness independently
            // of temporary settlement/save work; legacy gates remain compatible.
            // A candidate may belong to another run. Readiness may inspect only
            // its persisted namespace, never the still-live game's native ports.
            const candidate = snapshot ? Object.freeze({
                moduleId: module.id, nextFactId: snapshot.foundation.nextFactId,
                get state() { return freezeView(cloneJson(snapshot.modules[module.id]!)); },
                getComponent(id: number, name: string) {
                    if (!Number.isSafeInteger(id) || id < 1 || !validId(name)) throw new Error('Invalid initialization component query');
                    const value = snapshot.components[String(id)]?.[`${module.id}:${name}`];
                    return value === undefined ? undefined : freezeView(cloneJson(value));
                },
            }) : null;
            const context = candidate ? new Proxy(candidate, { get(target, key, receiver) {
                if (!(key in target)) throw new Error('Initialization readiness must use persisted state/components');
                return Reflect.get(target, key, receiver);
            } }) as unknown as ExtensionContext : this.context(module, null);
            const ready = module.initializationReady?.(context) ?? module.readyToSave?.(context) ?? true;
            requireSynchronous(ready);
            if (typeof ready !== 'boolean') throw new Error('Invalid extension initialization readiness');
            return ready;
        });
    }
    private get initializationReady(): boolean { return this.initializationReadyFor(); }
    private flushStoryFacts(): void {
        if (this.flushingStoryFacts || !this.pendingStoryFacts.length || !this.initializationReady) return;
        this.flushingStoryFacts = true;
        try {
            let count = 0;
            while (this.pendingStoryFacts.length) {
                if (++count > STORY_FACT_LIMIT) throw new Error('Story fact flush budget exceeded');
                const pending = this.pendingStoryFacts[0]!, first = this.nextFactId;
                if (this.hasCommittedFactConsumer('foundation.story.v1')) this.publishCommittedFact('foundation.story.v1',pending);
                else this.dispatch('storyFact', { ...pending, factId: first });
                // A consumer can reserve root + derived facts as one atomic range.
                // Even an uninterested subscriber consumes the native root once.
                if (this.nextFactId === first) {
                    if (!Number.isSafeInteger(first + 1)) throw new Error('Story fact sequence exhausted');
                    this.nextFactId++;
                }
                this.pendingStoryFacts.shift();
            }
        } finally { this.flushingStoryFacts = false; }
    }
    /** Pure engine adapter: one provider per slot, finite synchronous bounded scalars. */

    commitItemGrowth(actor: Creature, itemId: string, nativeDestination: ItemGrowthInput['nativeDestination'], nativeAmount: number,
        nativeCommit?: { apply(amount: number): void; rollback?(): void }): number {
        const module = this.modules.find(module => module.commitItemGrowth);
        if (!module) { nativeCommit?.apply(nativeAmount); return nativeAmount; }
        if (!this.creatures.has(actor) || !Number.isSafeInteger(nativeAmount) || nativeAmount < 0) throw new Error('Invalid item growth owner or amount');
        const states = structuredClone(this.states), components = structuredClone(this.components),stats=statSessions.get(this)!.ledger.snapshot();
        const resources = [...this.creatures].map(creature => ({ creature, hp: creature.hp, maxHp: creature.maxHp,
            strength: creature instanceof Player ? creature.strength : null, gold: creature instanceof Player ? this.ports.gold?.() ?? 0 : null }));
        const prior = this.resourcePhase; this.resourcePhase = true;
        let result: { nativeAmount: number } | undefined;
        try {
            this.invoke(module, context => { result = module.commitItemGrowth!(Object.freeze({ actor: this.actorFacts(actor), itemId, nativeDestination, nativeAmount }), context); });
            requireSynchronous(result);
            if (!result || Object.keys(result).join(',') !== 'nativeAmount' || !Number.isSafeInteger(result.nativeAmount) || result.nativeAmount < 0)
                throw new Error('Invalid item growth result');
            nativeCommit?.apply(result.nativeAmount);
            return result.nativeAmount;
        } catch (error) {
            try { nativeCommit?.rollback?.(); } finally {
                this.states = states; this.components = components;statSessions.get(this)!.ledger.restore(stats);statSessions.get(this)!.materialSignatures.clear();statSessions.get(this)!.materialValues.clear();statSessions.get(this)!.moduleViews.clear();this.stats.clear();
                for (const saved of resources) {
                    saved.creature.hp = saved.hp; saved.creature.maxHp = saved.maxHp;
                    if (saved.creature instanceof Player) { saved.creature.strength = saved.strength!; this.ports.setGold?.(saved.gold!); }
                }
            }
            throw error;
        } finally { this.resourcePhase = prior; }
    }
    private nativeMaximumBase(actor: Creature): number { return actor.maxHp-statSessions.get(this)!.ledger.bonus(actor.id,'native.max-hp'); }

    /** Static envelope/registration check; safe for historical inputs without
     * consulting the current run's state-dependent allowInput gates. */
    private hasRegisteredCommand(data: unknown): boolean {
        try {
            const input = typeof data==='string'?JSON.parse(data):data;
            if (!isJson(input) || !input || typeof input !== 'object' || Array.isArray(input)
                || Object.keys(input).sort().join(',') !== 'action,module,payload' || typeof input.module !== 'string'
                || typeof input.action !== 'string' || !validId(input.module)) return false;
            const module = this.modules.find(module => module.id === input.module);
            if (module?.actorActions && (module.actorActions.definitions as unknown as ActorAttackDefinitions).bonfires && input.action === 'rest') return !!input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
                && Object.keys(input.payload).join(',') === 'bonfireId' && Number.isSafeInteger(input.payload.bonfireId) && (input.payload.bonfireId as number) > 0;
            if (module?.actorActions && (input.action === 'dodge' || input.action === 'parry')) return !!input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
                && Object.keys(input.payload).join(',') === 'facing' && typeof input.payload.facing === 'string';
            if (module?.actorActions && input.action === 'attack') return !!input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
                && Object.keys(input.payload).sort().join(',') === 'attackId,facing' && typeof input.payload.attackId === 'string' && typeof input.payload.facing === 'string';
            if(module?.residentPolicy&&(RESIDENT_ACTIONS as readonly string[]).includes(input.action))return true;
            if(module?.campPolicy&&[...STRUCTURE_ACTIONS,'repair'].includes(input.action))return true;
            if(module?.worldWorkCommands?.[input.action as import('./worldSdk').CraftingAction]||module?.edibleCommands?.[input.action as 'feed'|'roast'])return true;
            return !!module?.commands && Object.prototype.hasOwnProperty.call(module.commands, input.action)
                && typeof module.commands[input.action] === 'function';
        } catch { return false; }
    }
    allowsInput(action: string, data?: unknown): boolean {
        if (this.disposed) return false;
        if (!this.initializationReady && !this.isInitialCommand(action, data)) return false;
        if (this.world.gate) {
            try {
                if (action !== 'ext:command' || typeof data !== 'string') return false;
                const input = JSON.parse(data), owner = this.modules.find(module => module.id === this.world.gate!.owner);
                if (!owner || input.module !== owner.id || !owner.interactionCommands?.includes(input.action)) return false;
            } catch { return false; }
        }
        if (action === 'ext:command' && !this.hasRegisteredCommand(data)) return false;
        return this.modules.every(module => module.allowInput?.(action, data, this.context(module, null)) !== false);
    }
    get readyToSave(): boolean { return this.pendingStoryFacts.length === 0 && this.initializationReady && this.modules.every(module => module.readyToSave?.(this.context(module, null)) !== false); }
    /** V4 stores historical states as digests. Input-only initialization guards
     * still run before replacing a live game; state guards run during replay. */
    validateRecordingInputPrefix(events: readonly {action:string;data:unknown}[]): boolean {
        if (events.some(event => event.action === 'ext:command' && !this.hasRegisteredCommand(event.data))) return false;
        const count = this.modules.filter(module => module.initialCommand).length;
        return events.length >= count && events.slice(0, count).every(event => event.action === 'ext:command' && typeof event.data === 'string')
            && this.validateInitialCommands(events.slice(0, count).map(event => event.data as string))
            && !events.slice(count).some(event => this.isInitialAction(event.action, event.data));
    }
    validateRecording(events: readonly {action:string;data:unknown;extensions?:ExtensionSnapshot}[]): boolean {
        if (events.some(event => event.action === 'ext:command' && !this.hasRegisteredCommand(event.data))) return false;
        // Check historical gates against their own previous checkpoint, never
        // against the live run. A forged ordinary input cannot close a gate and
        // retire the old run before replay discovers the mismatch.
        let previousGate: WorldInteractionSnapshot['gate'] = null;
        for (const event of events) {
            const currentGate = event.extensions?.foundation.world.gate ?? null;
            let input: {module?:string;action?:string} | null = null;
            if (event.action === 'ext:command' && typeof event.data === 'string') {
                try { input = JSON.parse(event.data); } catch { return false; }
            }
            if (previousGate) {
                const owner = this.modules.find(module => module.id === previousGate!.owner);
                if (input?.module !== owner?.id || !owner?.interactionCommands?.includes(input?.action ?? '')) return false;
                if (currentGate && canonical(currentGate) !== canonical(previousGate)) return false;
            } else if (currentGate && input?.module !== currentGate.owner) return false;
            previousGate = currentGate;
        }
        const count = this.modules.filter(module => module.initialCommand).length;
        if (events.length < count || !events.slice(0, count).every(event => event.action === 'ext:command' && typeof event.data === 'string')
            || !this.validateInitialCommands(events.slice(0, count).map(event => event.data as string))
            || events.slice(count).some(event => this.isInitialAction(event.action, event.data))) return false;
        return this.modules.every(module => !module.validateRecording || module.validateRecording(events));
    }
    /** Recognition, deliberately independent of payload validity: a malformed
     * duplicate creation input must not evade pre-load prefix rejection. */
    private isInitialAction(action: string, data: unknown): boolean {
        if (action !== 'ext:command' || typeof data !== 'string') return false;
        try {
            const input = JSON.parse(data);
            return !!input && typeof input === 'object' && this.modules.some(module => module.initialCommand
                && input.module === module.id && input.action === module.initialCommand.action);
        } catch { return false; }
    }
    isInitialCommand(action: string, data: unknown): boolean {
        if (action !== 'ext:command' || typeof data !== 'string') return false;
        try {
            const input = JSON.parse(data);
            if (!isJson(input) || !input || typeof input !== 'object' || Array.isArray(input)
                || Object.keys(input).sort().join(',') !== 'action,module,payload') return false;
            const module = this.modules.find(module => module.id === input.module);
            if (!module?.initialCommand || input.action !== module.initialCommand.action
                || !Object.prototype.hasOwnProperty.call(module.commands ?? {}, input.action)) return false;
            const accepted = module.validateInitialCommand ? module.validateInitialCommand(input.action, input.payload!)
                : canonical(input) === canonical({ module: module.id, ...module.initialCommand });
            requireSynchronous(accepted);
            return accepted === true;
        } catch { return false; }
    }
    initialCommands(): string[] {
        return this.modules.flatMap(module => module.initialCommand ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    }
    /** A complete, ordered creation batch is validated without touching world/state/RNG. */
    validateInitialCommands(commands: readonly string[], native?: ExtensionCreationResources): boolean {
        try {
            if (!Array.isArray(commands)) return false;
            if (native && (![native.maxHp,native.strength].every(value=>Number.isSafeInteger(value) && value > 0))) return false;
            const resources = native ? Object.freeze({...native}) : undefined;
            const expected = this.modules.filter(module => module.initialCommand);
            if (commands.length !== expected.length) return false;
            return commands.every((command,index) => {
                if (typeof command !== 'string') return false;
                const input = JSON.parse(command), module = expected[index]!;
                if (!isJson(input) || !input || typeof input !== 'object' || Array.isArray(input)
                    || Object.keys(input).sort().join(',') !== 'action,module,payload' || input.module !== module.id
                    || typeof input.action !== 'string' || !Object.prototype.hasOwnProperty.call(module.commands ?? {}, input.action)) return false;
                const accepted = module.validateInitialCommand ? module.validateInitialCommand(input.action,input.payload!,resources)
                    : canonical(input) === canonical({module:module.id,...module.initialCommand!});
                requireSynchronous(accepted);
                return accepted === true;
            });
        } catch { return false; }
    }
    creditParty(creature: Creature): string | null {
        this.observeCreature(creature);
        const actor = this.actorFacts(creature);
        const provider = this.modules.find(module => module.creditParty);
        return provider ? provider.creditParty!(actor, this.context(provider, null))
            : actor.allied ? `player:${this.ports.playerId()}` : null;
    }
    /** Actual command/animation commit point, before GC and recording comparison. */
    settle(reachable: readonly Creature[]): void {
        if (!this.hasHook('simulationSettled') && !this.pendingStoryFacts.length) return;
        if (this.generations.length || this.activeScope) throw new Error('Extension settlement outside safe boundary');
        this.transaction(() => {
            this.flushStoryFacts();
            for (const actor of [...this.creatures].sort((a, b) => a.id - b.id)) this.observeCreature(actor);
            const causes = this.causality.snapshot();
            const origins = [...Object.values(causes.statusOrigins).flatMap(Object.values), ...Object.values(causes.fatalOrigins),
                ...Object.values(causes.pendingDisplacements), ...Object.values(this.deaths).map(death => death.origin)];
            const sourceIds = [...new Set(origins.flatMap(origin => origin?.creditActorId ? [origin.creditActorId] : []))].sort((a,b) => a-b);
            this.emit('simulationSettled', { knownKinds: this.ports.knownKinds?.() ?? [],
                reachableIds: reachable.map(actor => actor.id).sort((a,b) => a-b), sourceIds });
        });
    }
    validateWorld(creatures: readonly Creature[], world?: Omit<WorldInteractionValidation, 'entities' | 'gate'>): void {
        const moves = this.bodyTransitions();
        for (const creature of creatures) {
            const history = (creature as Creature & { bodyTransitionHistory?: string[] }).bodyTransitionHistory;
            if (history && history.some(id => !moves.some(move => move.id === id))) throw new Error('Uninstalled body transition history');
        }
        const depth = world?.depth ?? this.ports.depth(), turn = world?.turn ?? this.ports.turn?.() ?? 0;
        if (this.pendingStoryFacts.some(fact => fact.depth !== depth || fact.turn > turn))
            throw new Error('Invalid pending story fact world references');
        this.withStatWorld(creatures,()=>{this.assertResourceBounds(creatures);const session=statSessions.get(this)!;session.ledger.assert(creatures.map(a=>a.id),session.pipeline,(id,key)=>{const a=creatures.find(a=>a.id===id)!;return key==='native.max-hp'?a.maxHp:key==='native.strength'&&a instanceof Player?a.strength:undefined;});});
        const actors = creatures.map(actor => this.actorFacts(actor,creatures[0]!.id));
        for (const module of this.modules) if (module.validateWorld && !module.validateWorld(this.states[module.id]!, this.components, actors, freezeView({ ...world, depth: world?.depth ?? this.ports.depth(), turn: world?.turn ?? this.ports.turn?.() ?? 0, isGameOver: world?.isGameOver ?? false, nextEntityId: world?.nextEntityId ?? getNextEntityId(), entities: structuredClone(this.world.entities), gate: structuredClone(this.world.gate), ...(this.world.regions ? { regions: structuredClone(this.world.regions) } : {}) })))
            throw new Error('Invalid extension world references');
    }
    private invoke(module: ExtensionModule, callback: (context: ExtensionContext) => void, command = false): void {
        if (this.disposed) throw new Error('Extension runtime unloaded');
        const prior = this.activeScope, priorCommandScope = this.commandScope, scope = {};
        this.activeScope = scope;
        if (command) this.commandScope = scope;
        const statSession=statSessions.get(this)!;
        const outer=statSession.inProgress;
        const previousProposals=statSession.proposals,previousWrites=statSession.writes;
        statSession.writes=false;
        statSession.proposals=module.statSources&&module.resourceCommits?new Map():null;
        statSession.inProgress=true;
        try {
            requireSynchronous(callback(this.context(module,scope)));
            if(!statSession.writes&&!statSession.proposals?.size)return;
            this.stats.clear();
            // Resource owners propose current-resource recovery. Foundation alone
            // writes modified maxima/strength, once after the complete source set.
            for(const [id,proposal] of statSession.proposals??[]){
                const actor=statSession.actors.get(id)!;
                for(const key of ['native.max-hp','native.strength']){
                    const desired=key==='native.max-hp'?proposal.maxHp:proposal.strength;if(desired===undefined)continue;
                    const oldBonus=key==='native.max-hp'?proposal.oldMaxBonus:proposal.oldStrengthBonus;
                    const current=key==='native.max-hp'?actor.maxHp:(actor as Player).strength;
                    const base=current-statSession.ledger.bonus(id,key),nextBonus=this.stats.value(id,key)-base;
                    // An unchanged contribution makes this an intentional native
                    // base gain (e.g. an item), rather than a second bonus write.
                    if(nextBonus===oldBonus)statSession.overrides.set(`${id}:${key}`,desired-oldBonus);
                }
            }
            this.stats.clear();
            for(const [id,proposal] of statSession.proposals??[])if(proposal.hp!==undefined)statSession.actors.get(id)!.hp=proposal.hp;
            for(const actor of this.creatures)this.stats.validateSources(actor.id);
            for(const actor of this.creatures)this.reconcileMaterialized(actor.id);
        }finally{statSession.writes=previousWrites||statSession.writes;statSession.proposals=previousProposals;statSession.inProgress=outer;statSession.overrides.clear();this.activeScope=prior;this.commandScope=priorCommandScope;}
    }

    newGame(): void { for (const module of this.modules) if (module.onNewGame) this.invoke(module, context => module.onNewGame!(context)); }
    loaded(): void {
        const before = canonical(this.snapshot());
        // Load callbacks have read-only contexts: no RNG or mutation.
        for (const module of this.modules) requireSynchronous(module.onLoad?.(this.context(module, null)));
        if (canonical(this.snapshot()) !== before) throw new Error('Load handler changed extension state');
    }
    /** New optional facts must remain invisible to modules that never subscribed. */
    hasHook(name: HookName): boolean { return this.modules.some(module => typeof module.hooks?.[name] === 'function'); }
    notifyCommittedAction(event: HookEvents['committedAction']): void {
        if (this.hasHook('committedAction')) this.emit('committedAction', event);
    }
    /** A defense has a unique causal identity but no hit/damage/growth resolution. */
    notifyActorParried(sourceEntityId:number,targetEntityId:number,depth:number):number | void {
        const origin=this.causality.create('melee',sourceEntityId,null,null);
        if(this.hasHook('defended'))this.emit('defended',{resolutionId:origin.effectId,depth,sourceEntityId,targetEntityId,defense:'parry'});
        return origin.effectId;
    }
    emit<K extends HookName>(name: K, event: HookEvents[K]): void {
        if (this.generations.length && !this.publishingGeneration) {
            this.generations[this.generations.length - 1]!.facts.push({ name, event: structuredClone(event) });
            return;
        }
        this.dispatch(name, event);
    }
    private dispatch<K extends HookName>(name: K, event: HookEvents[K], readOnly = false): void {
        // Detached deeply frozen input prevents a module changing the next one's event.
        const freeze = (value: unknown): void => {
            if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
        };
        const input = structuredClone(event); freeze(input);
        for (const module of this.modules) {
            const handler = module.hooks?.[name];
            if (handler) {
                if (readOnly) requireSynchronous(handler(input, this.context(module, null)));
                else {
                    const prior = this.resourcePhase;
                    this.resourcePhase = ['creatureSpawned','simulationSettled','nativeMaximumReset','objectiveTime','committedAction','physicalResolved'].includes(name);
                    const priorHook = this.currentHook; this.currentHook = name;
                    try { this.invoke(module, context => handler(input, context)); } finally { this.resourcePhase = prior; this.currentHook = priorHook; }
                }
            }
        }
        if (name === 'enteredLevel' && !readOnly && (this.hasHook('storyFact') || this.hasCommittedFactConsumer('foundation.story.v1'))) {
            const entered = event as HookEvents['enteredLevel'];
            const pending: PendingStoryFact = { kind: 'entered-level', depth: entered.depth, firstVisit: entered.firstVisit, turn: this.ports.turn?.() ?? 0 };
            if (!validPendingStoryFact(pending) || this.pendingStoryFacts.length >= STORY_FACT_LIMIT) throw new Error('Invalid pending story fact');
            this.pendingStoryFacts.push(pending);
        }
    }
    /** Pure preparation has no transaction, command handler, RNG or write capability.
     * Every context accessor is revoked before the detached plan can reach a UI wait. */
    prepareControlledCommand(data: unknown): PreparedControlledCommand | null {
        if (this.disposed || this.activeScope || this.commandModule || this.pureProviderPhase)
            throw new Error('Controlled preparation outside safe boundary');
        if (!this.hasRegisteredCommand(data) || typeof data !== 'string') throw new Error('Invalid extension command');
        const input = JSON.parse(data) as { module: string; action: string; payload: Json };
        const module = this.modules.find(entry => entry.id === input.module)!;
        if (!module.prepareControlledCommand) return null;
        let open = true;
        const read = (): void => { if (!open || this.disposed) throw new Error('Closed controlled preparation context'); };
        const source = this.context(module, null);
        const context: ControlledCommandPreparationContext = Object.freeze({
            get playerId() { read(); return source.playerId; },
            get state() { read(); return source.state; },
            get stats() { read(); return source.stats; },
            getComponent(id: number, name: string) { read(); return source.getComponent(id, name); },
            creature(id: number) { read(); return source.creature(id); },
            canManageCharacter() { read(); return source.canManageCharacter(); },
            validateAction(request: ControlledActionRequest) { read(); return source.validateAction(request); },
        });
        this.pureProviderPhase = true;
        try {
            const result = module.prepareControlledCommand(input.action, cloneJson(input.payload), context);
            requireSynchronous(result);
            if (result === null) return null;
            if (!isJson(result) || Object.keys(result).sort().join(',') !== 'request,revision'
                || !Number.isSafeInteger(result.revision) || result.revision < 0
                || !this.ports.validateAction?.(result.request)) throw new Error('Invalid controlled command preparation');
            return freezeView(structuredClone({ command: data, revision: result.revision, request: result.request }));
        } finally { open = false; this.pureProviderPhase = false; }
    }

    command(data: unknown, settle?: () => void): void {
        if (this.world.gate && !this.allowsInput('ext:command', data)) throw new Error('Interaction gate rejects command');
        if (typeof data !== 'string') throw new Error('Extension command requires JSON string');
        const input = JSON.parse(data) as { module: string; action: string; payload: Json };
        if (!isJson(input) || !input || typeof input !== 'object' || Array.isArray(input)
            || Object.keys(input).length !== 3 || !Object.prototype.hasOwnProperty.call(input, 'payload')
            || !validId(input.module) || typeof input.action !== 'string' || !input.action.length
            || Object.keys(input).some(key => !['module', 'action', 'payload'].includes(key))) throw new Error('Invalid extension command');
        const module = this.modules.find(entry => entry.id === input.module);
        const handler = module?.commands && Object.prototype.hasOwnProperty.call(module.commands, input.action) ? module.commands[input.action] : undefined;
        if (!module || typeof handler !== 'function') throw new Error('Unknown extension command');
        const prior = this.resourcePhase; this.resourcePhase = true;
        const priorCommandModule = this.commandModule, priorActionUsed = this.commandActionUsed;
        this.commandModule = module; this.commandActionUsed = false;
        try {
            this.transaction(() => {
                this.invoke(module, context => handler(input.payload, context), true);
                this.flushStoryFacts();
                if (settle) requireSynchronous(settle());
            });
        } finally { this.resourcePhase = prior; this.commandModule = priorCommandModule; this.commandActionUsed = priorActionUsed; }
    }
    attachCreature(creature: Creature, notifySpawn = true): void {
        if (this.disposed || this.creatures.has(creature)) return;
        this.creatures.add(creature);
        const session=statSessions.get(this)!; session.actors.set(creature.id,creature);
        const birth=readCreatureBirth(creature);if(birth?.nativeStatsCopied&&birth.sourceId!==null){const copied=session.ledger.bonus(birth.sourceId,'native.max-hp');if(copied)session.ledger.set(creature.id,'native.max-hp',copied);}
        bindStats(creature,session.pipeline,()=>{session.dirty.add(creature.id);},key=>session.ledger.bonus(creature.id,key),work=>{const previous=session.inProgress,ledger=session.ledger.snapshot(),resources=this.resourceCheckpoint();session.inProgress=true;try{const value=work();session.pipeline.validateSources(creature.id);this.reconcileMaterialized(creature.id);return value;}catch(error){session.ledger.restore(ledger);session.materialSignatures.clear();session.materialValues.clear();this.restoreResources(resources);session.pipeline.clear();throw error;}finally{session.inProgress=previous;}});
        const forms = this.nativeForms();
        if (forms.length) bindNativeForms(creature, forms, this.spatialCatalog);
        creature.extensionHooks = {
            ...(this.actorActionBinding()&&this.hasCommittedFactConsumer('combat.event.v1','staggered')?{withNativeDamage:(work:()=>void)=>this.withCommittedFacts(work,['staggered'])}:{}),
            zoneDamage: (target, amount, kind) => {
                const memberDamage = bodyHandlers.get(this)?.memberDamage?.(target, amount, kind);
                if (memberDamage !== undefined) return memberDamage;
                if (!target.spatial || !hasBodyContact(target) || isWholeBodyDamage(target) || target.hp <= 0
                    || !this.spatialCatalog.definition(target.spatial.footprintId).zones?.length
                    || ['administrative','negation','transference','reprisal','status'].includes(this.causality.current?.kind ?? '')) return undefined;
                const contact = physicalContactOf(target), zoneId = footprintOf(target).find(p => p.x === contact.x && p.y === contact.y)?.zoneId;
                if (!zoneId) throw new Error('Invalid native zone contact');
                const origin = this.causality.current;
                const result = resolveFixedZoneContact(this.spatialCatalog, { entity: target, entityId: target.id, groupId: target.id,
                    partId: null, zoneId, contact, dedupKey: `part:${target.id}:${zoneId}` }, {
                    resolutionId: origin?.effectId ?? this.causality.create('administrative', null).effectId,
                    sourceId: origin?.actorId ?? null, hit: true, damage: amount, kind: kind === 'physical' ? 'physical' : 'other',
                }, (request, native) => this.commitPartBreak(request, native));
                return result.nativeHpLost;
            },
            causality: this.causality,
            partyId: actor => this.creditParty(actor),
            relationshipChanged: actor => {markStatsDirty(actor);this.observeCreature(actor);this.ports.needTrigger?.(actor,'ally-lost');},
            nativeMaximumReset: (actor, preserveOverhealth = false) => {
                const session=statSessions.get(this)!;session.ledger.set(actor.id,'native.max-hp',0);session.pipeline.clear(actor.id);
                this.reconcileMaterialized(actor.id);if(!preserveOverhealth)actor.hp=Math.min(actor.hp,actor.maxHp);this.emit('nativeMaximumReset',{actor:this.actorFacts(actor),...(preserveOverhealth?{preserveOverhealth:true}:{})});
            },
            nativeMaximumBase: actor => this.nativeMaximumBase(actor),

            beforeAttack: (attacker, defender) => {
                if (attacker.id !== this.ports.playerId() && this.causality.current?.kind === 'melee')
                    this.notifyCommittedAction({ actorId: attacker.id, action: 'attack' });
                this.attacks.push(attacker.id);
                try { this.emit('beforeAttack', { attacker: creatureView(attacker, this.ports.playerId()), defender: creatureView(defender, this.ports.playerId()) }); }
                catch (error) { this.attacks.pop(); throw error; }
            },
            afterAttack: (attacker, defender, result) => {
                try { if (result) this.emit('afterAttack', { attacker: creatureView(attacker, this.ports.playerId()), defender: creatureView(defender, this.ports.playerId()), result }); }
                finally { this.attacks.pop(); }
            },
            wantsPhysicalResolution: () => this.actionResolutions !== null || this.hasHook('physicalResolved'),
            physicalResolved: (attacker, defender, detail) => {
                const fact: PhysicalResolutionFact = { ...detail, attacker: creatureView(attacker, this.ports.playerId()),
                    defender: creatureView(defender, this.ports.playerId()) };
                if (attacker.id === this.actionActorId) this.actionResolutions?.push(structuredClone(fact));
                if (this.hasHook('physicalResolved')) this.emit('physicalResolved', fact);
            },
            damage: (target, amount, hpBefore, damageKind = 'other') => {
                const fact = this.causality.recordDamage(target.id, hpBefore, target.hp, damageKind);
                restHandlers.get(this)?.nativeDamageCommitted?.(target, fact.hpLost);
                this.emit('damage', { creature: creatureView(target, this.ports.playerId()), amount, hpBefore,
                    sourceId: this.sourceId, origin: fact.origin, hpLost: fact.hpLost, damageKind });
                bodyHandlers.get(this)?.memberDamageCommitted?.(target);
            },
        };
        if (notifySpawn && !this.spawned.has(creature)) {
            this.spawned.add(creature);
            if (this.generations.length) this.generations[this.generations.length - 1]!.births.add(creature);
            this.emit('creatureSpawned', this.spawnFact(creature));
        }
        if(notifySpawn&&!this.generations.length){
            const saved=this.resourceCheckpoint(),ledger=session.ledger.snapshot();
            try{session.pipeline.validateSources(creature.id);this.reconcileMaterialized(creature.id);}catch(error){this.restoreResources(saved);session.ledger.restore(ledger);session.materialSignatures.clear();session.materialValues.clear();session.actors.delete(creature.id);this.creatures.delete(creature);unbindStats(creature);creature.extensionHooks=undefined;session.pipeline.clear();throw error;}
        }

    }
    private spawnFact(creature: Creature): HookEvents['creatureSpawned'] {
        const actor = this.actorFacts(creature);
        return { creature: creatureView(creature, this.ports.playerId()), birth: readCreatureBirth(creature) ?? {
            creationReason: this.ports.testMode?.() ? 'test' : 'scripted', originalMonsterType: actor.monsterId,
            initiallyHostile: actor.hostile, sourceId: null, nativeStatsCopied: false } };
    }
    /** Engine-only transaction handles. Module contexts do not expose these APIs. */
    beginGeneration(label: string): GenerationToken {
        if (this.disposed || this.publishingGeneration || !label.length) throw new Error('Invalid generation transaction');
        const token = Object.freeze({ label });
        this.generations.push({ edible:edibleSnapshot(this), token, nextFactId: this.nextFactId, pendingStoryFacts: structuredClone(this.pendingStoryFacts), resources: this.resourceCheckpoint(), stats:statSessions.get(this)!.ledger.snapshot(), world: structuredClone(this.world), placementNextEntityId: null, states: structuredClone(this.states), components: structuredClone(this.components),
            causality: this.causality.snapshot(), deaths: structuredClone(this.deaths), creatures: new Set(this.creatures), facts: [], births: new Set() });
        return token;
    }
    private generation(token: GenerationToken): GenerationFrame {
        const frame = this.generations[this.generations.length - 1];
        if (!frame || frame.token !== token) throw new Error('Generation transaction must close in LIFO order');
        return frame;
    }
    commitGeneration(token: GenerationToken): void {
        const frame = this.generation(token);
        if (this.generations.length > 1) {
            this.generations.pop();
            const parent = this.generations[this.generations.length - 1]!;
            parent.facts.push(...frame.facts, { name: 'generationCommitted', event: { label: token.label, creatureIds: [...frame.births].map(c => c.id).sort((a, b) => a - b) } });
            for (const creature of frame.births) parent.births.add(creature);
            return;
        }
        // Keep the token alive until all synchronous handlers succeed. The engine
        // can restore its own world/RNG/logs and call rollbackGeneration on failure.
        this.publishingGeneration = true;
        try { this.bufferMessages(() => {
            for (const creature of [...frame.births].sort((a, b) => a.id - b.id)) {
                this.dispatch('creatureSpawned', this.spawnFact(creature));
            }
            for (const fact of frame.facts) if (fact.name !== 'creatureSpawned') this.dispatch<HookName>(fact.name, fact.event, fact.readonly);
            this.dispatch('generationCommitted', { label: token.label, creatureIds: [...frame.births].map(c => c.id).sort((a, b) => a - b) });
            this.generations.pop();
        }); } finally { this.publishingGeneration = false; }
    }
    rollbackGeneration(token: GenerationToken): void {
        const frame = this.generation(token);
        restoreEdibleState(this,frame.edible);
        this.states = frame.states; this.components = frame.components; this.world = frame.world;
        this.nextFactId = frame.nextFactId; this.pendingStoryFacts = frame.pendingStoryFacts; this.restoreResources(frame.resources);
        if (frame.placementNextEntityId !== null) restoreNextEntityId(frame.placementNextEntityId);
        this.causality.restore(frame.causality); this.deaths = frame.deaths;
        const session=statSessions.get(this)!;session.ledger.restore(frame.stats);session.materialSignatures.clear();session.materialValues.clear();session.pipeline.clear();session.moduleViews.clear();
        for (const creature of this.creatures) if (!frame.creatures.has(creature)) {
            bindNativeForms(creature); creature.extensionHooks = undefined; this.spawned.delete(creature); this.creatures.delete(creature);unbindStats(creature);session.actors.delete(creature.id);
        }
        this.generations.pop();
        const fact: BufferedFact = { name: 'generationRolledBack', event: { label: token.label }, readonly: true };
        const parent = this.generations[this.generations.length - 1];
        if (parent) parent.facts.push(fact);
        else this.dispatch(fact.name, fact.event, true);
    }
    /** Capture before recursive death effects; a later kill notification cannot overwrite it. */
    captureDeath(creature: Creature, administrative: boolean, origin: EffectOrigin | null): DeathFact {
        this.observeCreature(creature);
        if (this.modules.some(module => module.hooks?.deathCaptured)) this.emit('deathCaptured', { actor: this.actorFacts(creature), origin: structuredClone(origin), administrative,
            ...((creature as Creature & { bodyTransitionRewardless?: true }).bodyTransitionRewardless ? { rewardEligible: false as const } : {}) });
        const fact = { creature: creatureView(creature, this.ports.playerId()), origin: structuredClone(origin), administrative };
        this.deaths[String(creature.id)] = fact; markRecordingRoot(this);
        return structuredClone(fact);
    }
    nativeForms(): readonly NativeFormDefinition[] { return this.disposed ? [] : this.modules.flatMap(module => module.nativeForms ?? []); }
    bodyTransitions(): readonly import('./bodyTransitions').ActiveBodyTransition[] { return this.disposed ? [] : this.modules.flatMap(module => module.bodyTransitions ?? []); }
    generationContributions(depth: number) {
        return freezeView(this.disposed ? [] : this.modules.flatMap(module => (module.generationContributions ?? [])
            .filter(t => depth >= t.minDepth && depth <= t.maxDepth).map(t => ({ ...t, owner: module.id })))
            .sort((a,b) => a.priority-b.priority || (a.owner<b.owner?-1:a.owner>b.owner?1:0) || (a.id<b.id?-1:a.id>b.id?1:0)));
    }
    /** Only an active native transaction may opt into full allocator rollback. */
    reserveGenerationAllocator(token: GenerationToken): void {
        this.generation(token);
        for (const frame of this.generations) frame.placementNextEntityId ??= getNextEntityId();
    }
    get hasPublicActorTags(): boolean { return this.modules.some(module=>module.publicActorTags?.length); }
    publicActorGroup(id: number): string | null {
        for (const module of this.modules) for (const tag of module.publicActorTags ?? []) if (tag.groupKey) {
            const value = this.components[String(id)]?.[`${module.id}:${tag.component}`];
            const key = value && typeof value === 'object' && !Array.isArray(value) ? value[tag.groupKey] : undefined;
            if (typeof key === 'string') return `${module.id}:${key}`;
        }
        return null;
    }
    publicActorTags(id: number): readonly string[] {
        return this.modules.flatMap(module => (module.publicActorTags ?? []).filter(t => this.components[String(id)]?.[`${module.id}:${t.component}`] !== undefined).map(t => `${module.id}.${t.tag}`));
    }
    get hasOwnedRegions(): boolean { return !this.disposed && (!!this.world.regions?.length || this.modules.some(module => module.ownedRegions)); }
    /** Native generation-only capability; not exposed to hook/command contexts.
     * Full batch preflight precedes IDs and ledger writes. Nested aborts restore
     * both geometry and allocator, even after an inner transaction commits. */
    installOwnedRegions(token: GenerationToken, owner: string, requests: readonly OwnedRegionPlacement[], dimensions: { width: number; height: number }): readonly OwnedRegion[] {
        this.generation(token);
        const depth = this.ports.depth(), existing = this.world.regions ?? [];
        if (this.disposed || this.publishingGeneration || !this.modules.find(module => module.id === owner)?.ownedRegions
            || !Number.isSafeInteger(depth) || depth < 1 || depth > 40
            || !Number.isSafeInteger(dimensions.width) || !Number.isSafeInteger(dimensions.height)
            || dimensions.width < 1 || dimensions.width > 1024 || dimensions.height < 1 || dimensions.height > 1024
            || !Array.isArray(requests) || existing.length + requests.length > OWNED_REGION_LIMIT
            || !Number.isSafeInteger(getNextEntityId() + requests.length)
            || requests.some((request, index) => !validRegionPlacement(request)
                || request.bounds.x + request.bounds.width > dimensions.width || request.bounds.y + request.bounds.height > dimensions.height
                || existing.some(region => region.owner === owner && region.instanceKey === request.instanceKey
                    || region.depth === depth && regionsOverlap(region, request))
                || requests.slice(0, index).some(prior => prior.instanceKey === request.instanceKey || regionsOverlap(prior, request)))) {
            throw new Error('Invalid owned region generation batch');
        }
        if (!requests.length) return Object.freeze([]);
        for (const frame of this.generations) frame.placementNextEntityId ??= getNextEntityId();
        const placed = [...requests].sort((a, b) => a.instanceKey < b.instanceKey ? -1 : 1)
            .map(request => ({ ...structuredClone(request), id: allocateEntityId(), owner, depth, revision:0 }));
        this.world.regions = [...existing, ...placed].sort((a, b) => a.id - b.id);
        return freezeView(structuredClone(placed));
    }
    ownedRegion(id: number, depth: number): Readonly<OwnedRegion> | null {
        if (this.disposed) return null;
        const region = this.world.regions?.find(region => region.id === id && region.depth === depth);
        return region ? freezeView(structuredClone(region)) : null;
    }
    containsOwnedRegion(id: number, depth: number, at: { readonly x: number; readonly y: number }): boolean {
        const region = !this.disposed && this.world.regions?.find(region => region.id === id && region.depth === depth);
        return !!region && regionContains(region, at);
    }
    releaseFallenMovementRegion(creature: Creature, depth: number): void {
        const regionId = creature.spatial?.movementRegionId;
        if (regionId === undefined) return;
        if (creature.hp <= 0 || !this.creatures.has(creature) || !this.ownedRegion(regionId, depth)) throw new Error('Invalid falling movement region');
        clearMovementRegion(creature);
        this.emit('movementRegionExited', { actor: this.actorFacts(creature), regionId, depth, reason: 'fell' });
    }
    reportRegionFollowBlocked(creature: Creature, depth: number): void {
        const regionId=creature.spatial?.movementRegionId;
        if (regionId===undefined || !this.ownedRegion(regionId,depth)) return;
        this.emit('movementRegionFollowBlocked', { actor:this.actorFacts(creature),regionId,depth,reason:'hard-boundary' });
    }
    /** Trusted rest executor may inspect only its declared target, never mutate it. */
    worldRestTarget(owner: string, id: number): Readonly<WorldInteractable> | null {
        const entity = !this.disposed && this.world.entities.find(entity => entity.owner === owner && entity.id === id);
        return entity ? Object.freeze({ ...entity }) : null;
    }
    /** World capability is inert unless a selected module actually owns objects. */
    get interactionActive(): boolean { return !this.disposed && this.world.gate !== null; }
    visibleInteractables(owner?: string) {
        if (this.disposed) return [];
        return Object.freeze(sortInteractables(this.world.entities.filter(entity => (!owner || entity.owner === owner)
            && entity.depth === this.ports.depth() && this.ports.isInteractableVisible?.(entity))).map(publicInteractable));
    }
    nearbyInteractables(owner?: string) {
        if (this.disposed) return [];
        return Object.freeze(sortInteractables(this.world.entities.filter(entity => (!owner || entity.owner === owner)
            && entity.depth === this.ports.depth() && this.ports.canInteractWith?.(entity))).map(publicInteractable));
    }
    private placeInteractables(owner: string, requests: readonly WorldInteractablePlacement[]): readonly WorldInteractablePlacementResult[] {
        if (!Array.isArray(requests) || requests.length > 256 || !requests.every(request => validWorldPlacement(request, owner))
            || new Set(requests.map(request => request.instanceKey)).size !== requests.length) throw new Error('Invalid world placement batch');
        if (requests.length && !this.ports.interactableCandidates) throw new Error('World placement capability unavailable');
        const depth = this.ports.depth(), occupied = new Set(this.world.entities.filter(entity => entity.depth === depth).map(entity => `${entity.x},${entity.y}`));
        const selected = requests.map(request => {
            const existing = this.world.entities.find(entity => entity.owner === owner && entity.instanceKey === request.instanceKey);
            if (existing) throw new Error('Duplicate world placement instance');
            const candidates = this.ports.interactableCandidates!(freezeView(structuredClone(request)));
            const cell = candidates.find(cell => !occupied.has(`${cell.x},${cell.y}`));
            if (cell) occupied.add(`${cell.x},${cell.y}`);
            return { request, cell };
        });
        const count = selected.filter(row => row.cell).length;
        if (this.world.entities.length + count > WORLD_INTERACTABLE_LIMIT || !Number.isSafeInteger(getNextEntityId() + count)) throw new Error('World entity budget exceeded');
        const frame = this.generations[this.generations.length - 1];
        if (count && frame && frame.placementNextEntityId === null) frame.placementNextEntityId = getNextEntityId();
        const results = selected.map(({request,cell}) => {
            if (!cell) return { instanceKey: request.instanceKey, entity: null };
            const { minStairDistance: _stairs, maxEntranceDistance: _entrance, ...content } = request;
            const entity: WorldInteractable = { ...content, id: allocateEntityId(), owner, depth, x: cell.x, y: cell.y };
            this.world.entities.push(entity);
            return { instanceKey: request.instanceKey, entity };
        });
        return freezeView(structuredClone(results));
    }
    /** Rooted by both active and cached levels, never by observation history.
     * Terminal runs keep their objects for inspection/save; only their gate closes. */
    collectWorld(depths: readonly number[], isGameOver: boolean): void {
        if (this.generations.length || this.activeScope) throw new Error('World collection outside safe boundary');
        const removed = this.world.entities.filter(entity => !depths.includes(entity.depth));
        const gate = this.world.gate;
        if (!removed.length && !(gate && isGameOver)) return;
        const beforeWorld = structuredClone(this.world), beforeStates = structuredClone(this.states), beforeComponents = structuredClone(this.components);
        const restoreActorState=this.checkpointActorStateIdentity();
        try {
            markRecordingRoot(this);
            this.world.entities = this.world.entities.filter(entity => depths.includes(entity.depth));
            if (gate && (isGameOver || removed.some(entity => entity.id === gate.targetEntityId))) {
                this.world.gate = null;
                this.emit('interactionClosed', { ...gate, reason: isGameOver ? 'game-over' : 'target-removed' });
            }
            for (const owner of [...new Set(removed.map(entity => entity.owner))].sort())
                this.emit('interactablesRemoved', { owner, entityIds: removed.filter(entity => entity.owner === owner).map(entity => entity.id) });
        } catch (error) { this.world = beforeWorld; this.states = beforeStates; restoreActorState(); this.components = beforeComponents; throw error; }
    }
    /** Mechanical roots only: observation/history sets must not pin dead components. */
    collectComponents(reachable: Iterable<Creature>): void {
        if (this.generations.length || this.activeScope) throw new Error('Component collection outside safe boundary');
        const keep = new Set([...reachable].map(creature => creature.id));
        for (const id of Object.keys(this.components)) if (!keep.has(Number(id))) { delete this.components[id]; markRecordingRoot(this); }
        for (const id of Object.keys(this.deaths)) if (!keep.has(Number(id))) { delete this.deaths[id]; markRecordingRoot(this); }
        this.causality.retainCreatures(keep);
        for (const creature of this.creatures) if (!keep.has(creature.id)) {
            bindNativeForms(creature); creature.extensionHooks = undefined; this.creatures.delete(creature); unbindStats(creature);statSessions.get(this)!.actors.delete(creature.id);statSessions.get(this)!.ledger.remove(creature.id);statSessions.get(this)!.materialSignatures.delete(creature.id);statSessions.get(this)!.materialValues.delete(creature.id);this.stats.clear(creature.id);
        }
        // Module-owned reward receipts are deliberately not collected with bodies.
    }
    /** Trusted engine-only binding. Never exposed through module contexts or views. */
    actorActionBinding(): { moduleId: string; state: import('./actorActions').ProductionActorAttackState; definition: import('./actorActions').ActorAttackDefinitions } | null {
        if (this.disposed) return null;
        const module = this.modules.find(value => value.actorActions);
        return module ? { moduleId: module.id, state: this.states[module.id]! as unknown as import('./actorActions').ProductionActorAttackState, definition: module.actorActions!.definitions as unknown as import('./actorActions').ActorAttackDefinitions } : null;
    }
    isWorldWorkFixture(owner:string):boolean { const module=this.modules.find(m=>m.id===owner);return !!module&&isWorld5WorkFixture(module); }
    worldDefinitionPacks(): readonly import('./structureTypes').WorldDefinitionPack[] { return this.modules.flatMap(m=>m.worldDefinitions?[m.worldDefinitions]:[]); }
    worldDefinitionFingerprints():Record<string,string> {return Object.fromEntries(this.modules.filter(m=>m.worldDefinitions).map(m=>[m.id,`sha256:${c5Hash(hasEdibleDeclarations(m.worldDefinitions)?{pack:m.worldDefinitions,foundationEdibleRules:FOUNDATION_EDIBLE_RULES,...(m.worldDefinitions!.structures!==undefined||m.worldDefinitions!.restPoints!==undefined?{foundationStructureRules:FOUNDATION_STRUCTURE_RULES}:{})}:m.worldDefinitions!.structures!==undefined||m.worldDefinitions!.restPoints!==undefined?{pack:m.worldDefinitions,foundationStructureRules:FOUNDATION_STRUCTURE_RULES}:m.worldDefinitions)}`]));}
    worldWorkCommand(owner:string,action:string): import('./worldSdk').WorldWorkCommand | undefined { return this.modules.find(m=>m.id===owner)?.worldWorkCommands?.[action as import('./worldSdk').CraftingAction]; }
    edibleCommand(owner:string,action:string) { return this.modules.find(m=>m.id===owner)?.edibleCommands?.[action as 'feed'|'roast']; }
    edibleModule(owner:string) { return this.modules.find(m=>m.id===owner); }
    edibleDirty(actorId?:number):void {cleanEdibleState(this);markRecordingRoot(this);this.invalidateStats();if(actorId!==undefined)this.reconcileMaterialized(actorId);}
    edibleFactId():number {if(this.nextFactId>=Number.MAX_SAFE_INTEGER)throw new World5Error('C5_OVERFLOW');markRecordingRoot(this);return this.nextFactId++;}
    ediblePure<T>(work:()=>T):T {const before=this.pureProviderPhase;this.pureProviderPhase=true;try{return work();}finally{this.pureProviderPhase=before;}}
    edibleParticipate(owner:string,method:'onConsumed'|'onFireContact'|'onNeedEvent',fact:unknown,
      extras:Readonly<Record<string,unknown>>,degrade=false):boolean {
        const module=this.modules.find(m=>m.id===owner), participant=method==='onNeedEvent'?module?.actorNeedParticipant:module?.edibleParticipant;
        const callback=(participant as any)?.[method];if(!module||!callback)return true;
        let active=true;const check=()=>{if(!active)throw new World5Error('C5_SCOPE');};
        try { this.transaction(()=>this.invoke(module,context=>{
            const wrap=Object.fromEntries(Object.entries(extras).map(([key,v])=>[key,typeof v==='function'? (...args:unknown[])=>{check();return (v as Function)(...args);}:v]));
            const tx=Object.freeze({...wrap,get state(){check();return freezeView(context.state);},
                replaceState:(value:Json)=>{check();if(!isJson(value))throw new World5Error('C5_PROVIDER');context.setState(value);},
                setOwnComponent:(id:number,name:string,value:Json)=>{check();if(id!==(fact as any).actorId||![...this.creatures].some(c=>c.id===id&&c.hp>0))throw new World5Error('C5_SCOPE');context.setComponent(id,name,value);},
                removeOwnComponent:(id:number,name:string)=>{check();if(id!==(fact as any).actorId)throw new World5Error('C5_SCOPE');context.removeComponent(id,name);},
                message:(key:string,params?:Record<string,string|number>)=>{
                    check();if(!key.startsWith(`ext.${owner}.`))throw new World5Error('C5_PROVIDER');
                    context.message(worldText(key,{
                        defaultValue:i18next.t('ext.foundation.edible.message_unavailable',{
                            defaultValue:'The event could not be described.',skipInterpolation:true
                        }),...params
                    }));
                }
            });
            const result=callback(freezeView(structuredClone(fact)),tx);requireSynchronous(result);if(result!==undefined)throw new World5Error('C5_PROVIDER');
        }));return true; } catch {if(!degrade)throw new World5Error('C5_PROVIDER');this.edibleDiagnostics.push({owner,method});return false;} finally {active=false;}
    }
    private get edibleDiagnostics():{owner:string;method:string}[] {let rows=edibleDiagnostics.get(this);if(!rows){rows=[];edibleDiagnostics.set(this,rows);}return rows;}
    noteEdibleDiagnostic(owner:string,method:string):void {this.edibleDiagnostics.push({owner,method});}
    readEdibleDiagnostics():readonly {owner:string;method:string}[] {return freezeView(structuredClone(edibleDiagnostics.get(this)??[]));}
    retireEdibleActor(actor:Creature):void {delete this.components[String(actor.id)];this.creatures.delete(actor);statSessions.get(this)!.actors.delete(actor.id);statSessions.get(this)!.ledger.remove(actor.id);unbindStats(actor);actor.extensionHooks=undefined;this.invalidateStats();markRecordingRoot(this);}
    worldWorkTransaction<T>(work:()=>T):T { return this.transaction(work); }
    worldWorkEntities(): readonly WorldInteractable[] { return this.world.entities; }
    worldWorkPlacementProtected(at:{x:number;y:number},depth:number):boolean {
        return !!this.world.regions?.some(r=>r.depth===depth && regionContains(r,at) && !!this.modules.find(m=>m.id===r.owner)?.generationContributions?.length);
    }
    worldWorkPlace(entity: Omit<WorldInteractable,'id'>): WorldInteractable {
        if (!this.modules.some(m=>m.id===entity.owner&&m.worldDefinitions) || this.world.entities.length>=WORLD_INTERACTABLE_LIMIT) throw new Error('C5_BUDGET');
        markRecordingRoot(this);const placed={...entity,id:allocateEntityId()};this.world.entities.push(placed);this.world.entities.sort((a,b)=>a.id-b.id);return placed;
    }
    residentComponentIds(owner:string,name:'resident'|'source'):number[] {return Object.entries(this.components).filter(([,rows])=>rows[`${owner}:${name}`]!==undefined).map(([id])=>Number(id)).sort((a,b)=>a-b);}
    residentOwners():string[] {return this.modules.filter(m=>m.residentPolicy).map(m=>m.id);}
    /** Only a closed native retirement stage may coalesce unobservable camp writes. */
    residentRetirementBatchSafe():boolean {return this.modules.every(m=>!m.statSources&&!m.actorActions&&!m.resourceCommits&&!m.actorNeedParticipant&&!m.edibleParticipant&&!m.worldWorkParticipant&&!Object.values(m.hooks??{}).some(h=>typeof h==='function'));}
    residentPolicy(owner:string){return this.modules.find(m=>m.id===owner)?.residentPolicy;}
    residentComponent<T>(owner:string,id:number,name:'resident'|'source'):T|undefined {const c=this.components[String(id)]?.[`${owner}:${name}`];return c===undefined?undefined:cloneJson(c) as T;}
    replaceResidentComponent(owner:string,id:number,name:'resident'|'source',value:import('./residentSdk').ResidentComponent|import('./residentSdk').ResidentSource|null):void {const m=this.modules.find(m=>m.id===owner&&m.residentPolicy);if(!m)throw new World5Error('C5_SCOPE');this.invoke(m,c=>{if(value===null)c.removeComponent(id,name);else c.setComponent(id,name,value as unknown as Json);});}
    worldCampOwners():string[] {return this.modules.filter(m=>m.campPolicy).map(m=>m.id);}
    worldRaidRules(owner:string) { return this.modules.find(m=>m.id===owner)?.raidRules; }
    worldCampPolicy(owner:string) {return this.modules.find(m=>m.id===owner)?.campPolicy;}
    worldCampState(owner:string):import('./structureSdk').CampState {
        return cloneJson(this.states[owner]!) as unknown as import('./structureSdk').CampState;
    }
    worldCampRecords(owner:string):import('./structureSdk').CampRecord[] {
        return cloneJson((this.states[owner] as unknown as import('./structureSdk').CampState).camps as unknown as Json) as unknown as import('./structureSdk').CampRecord[];
    }
    worldCampRecord(owner:string,id:number):import('./structureSdk').CampRecord|undefined {
        const camp=(this.states[owner] as unknown as import('./structureSdk').CampState).camps.find(c=>c.regionId===id);
        return camp?cloneJson(camp as unknown as Json) as unknown as import('./structureSdk').CampRecord:undefined;
    }
    worldCampPlotDays(owner:string):import('./structureSdk').CampState['plotDays'] {
        return cloneJson((this.states[owner] as unknown as import('./structureSdk').CampState).plotDays as unknown as Json) as unknown as import('./structureSdk').CampState['plotDays'];
    }
    worldCampLockedQuantity(itemId:number):number {
        let count=0;for(const module of this.modules)if(module.campPolicy){const s=this.states[module.id] as unknown as import('./structureSdk').CampState;
            for(const c of s.camps)for(const lock of c.locked)if(lock.itemId===itemId)count+=lock.quantity;}
        return count;
    }
    worldCampReplace(owner:string,state:import('./structureSdk').CampState):void {
        const module=this.modules.find(m=>m.id===owner&&m.campPolicy);if(!module)throw new World5Error('C5_SCOPE');
        this.invoke(module,context=>context.setState(state as unknown as Json));
    }
    isWorldStructureFixture(owner:string):boolean {const module=this.modules.find(m=>m.id===owner);return !!module&&isWorld5StructureFixture(module);}
    worldStructureRegions(): readonly OwnedRegion[] { return this.world.regions??[]; }
    worldStructureSetRegions(regions:readonly OwnedRegion[]):void { markRecordingRoot(this);setOwnedRegions(this.world,[...regions]); }
    worldStructureRelocateInteractable(id:number,at:{x:number;y:number}):void { const e=this.world.entities.find(e=>e.id===id);if(!e)throw new Error('C5_UNKNOWN_TARGET');markRecordingRoot(this);Object.assign(e,at); }
    worldStructureRemoveInteractable(id:number):void { markRecordingRoot(this);this.world.entities=this.world.entities.filter(e=>e.id!==id); }
    worldWorkFact(value: Omit<import('./worldSdk').CommittedWorkFact,'factId'>, participant=true): import('./worldSdk').CommittedWorkFact {
        if (this.nextFactId>=Number.MAX_SAFE_INTEGER) throw new Error('C5_OVERFLOW');
        const fact=freezeView({...value,factId:this.nextFactId++});const module=this.modules.find(m=>m.id===fact.owner);
        if(participant&&module?.worldWorkParticipant) {
            let active=true, writerFailed=false;
            try { const runtime=this; const result=module.worldWorkParticipant.onCommitted(fact,Object.freeze({
                get state(){if(!active)throw new Error('Expired participant');return freezeView(cloneJson(runtime.states[module.id]!));},
                replaceState(next:import('./worldSdk').JsonValue){
                    try {if(!active||!isJson(next))throw new Error('Invalid participant state');runtime.invoke(module,context=>context.setState(cloneJson(next as Json)));}
                    catch(error){writerFailed=true;throw error;}
                }
            }));requireSynchronous(result);if(writerFailed||result!==undefined)throw new Error('Invalid participant result'); }
            catch {throw new World5Error('C5_PROVIDER');} finally {active=false;}
        }
        return fact;
    }
    /** Engine body rollback captures this ledger's complete value graph. After
     * buffered rollback restores equal JSON, retain the old live clock identity
     * so its paid scheduler/session cannot keep a discarded mutated ledger. */
    checkpointActorActionBindingIdentity(): () => void {
        const binding = this.actorActionBinding(); if (!binding) return () => {};
        return () => {
            if (canonical(this.states[binding.moduleId]) !== canonical(binding.state)) throw new Error('Incomplete body action rollback');
            this.states[binding.moduleId] = binding.state as unknown as Json;
        };
    }
    get sourceId(): number | null { return this.attacks[this.attacks.length - 1] ?? null; }
    /** Pure player-only projection. Never snapshots causal ledgers, NPCs, rewards, or the world. */
    readModuleView(moduleId: string, displayQuery?: Json): ExtensionModuleView | null {
        const descriptor = this.views.get(moduleId), module = this.modules.find(entry => entry.id === moduleId);
        if (this.disposed || !module) return null;
        if (module.projectView) {
            const projection = module.projectView(freezeView({ ...(displayQuery === undefined ? {} : { displayQuery: JSON.parse(c5Canonical(displayQuery)) as Json }), ...(module.campPolicy?{structures:this.ports.structureRead?.(moduleId)}:{}), stats:this.statQuery, queryOptional: (capability: string, input: Json) => this.queryOptional(capability,input), ...(hasEdibleDeclarations(module.worldDefinitions)?{edible:this.ports.edibleRead?.(moduleId)}:{}), ...(module.worldDefinitions ? {worldWork:this.ports.worldWorkRead?.(moduleId)} : {}), state: cloneJson(this.states[moduleId]!), playerId:this.ports.playerId(), depth: this.ports.depth(), turn: this.ports.turn?.() ?? 0,
                visibleInteractables: this.visibleInteractables(moduleId), actorActionBundles: structuredClone(this.ports.actorActions?.()?.bundles ?? []), nearbyInteractables: this.nearbyInteractables(moduleId),
                worldRestUnavailable: id=>this.world.entities.some(entity=>entity.id===id&&entity.owner===moduleId)
                    ?restHandlers.get(this)?.worldRestUnavailable?.(id)??null:'unavailable' }));
            requireSynchronous(projection);
            if (!isJson(projection) || !projection || typeof projection !== 'object' || Array.isArray(projection)) throw new Error('Invalid module display projection');
            const publicProjection = cloneJson(projection) as Record<string, Json>;
            if (module.actorActions && Array.isArray(publicProjection.telegraphs)) publicProjection.telegraphs = publicProjection.telegraphs.flatMap(value => {
                if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.sourceEntityId !== 'number' || !Array.isArray(value.cells)) return [];
                const cells = value.cells.filter((cell): cell is {x:number;y:number} => !!cell && typeof cell === 'object' && !Array.isArray(cell) && typeof cell.x === 'number' && typeof cell.y === 'number');
                const visible = this.ports.visibleActorActionCells?.(value.sourceEntityId,cells) ?? [];
                return visible.length ? [{...value,cells:visible}] : [];
            });
            return freezeView({ session: this.viewSession, definitions: {}, playerId: this.ports.playerId(), state: publicProjection, components: {},
                canManageCharacter: this.ports.canManageCharacter?.() ?? true });
        }
        if (!descriptor) return null;
        const state = this.states[moduleId], playerId = this.ports.playerId();
        const projector = this.modules.find(module=>module.id === moduleId)?.projectPlayerComponent;
        const fields: Record<string, Json> = {}, components: Record<string, Json> = {};
        if (state && typeof state === 'object' && !Array.isArray(state)) for (const name of descriptor.stateFields) {
            const value = Object.prototype.hasOwnProperty.call(state, name) ? state[name] : undefined;
            if (value !== undefined) fields[name] = cloneJson(value);
        }
        for (const name of descriptor.playerComponents) {
            let value = this.components[String(playerId)]?.[`${moduleId}:${name}`];
            if (value !== undefined && projector) {
                const projected = projector(name,freezeView(cloneJson(value)));requireSynchronous(projected);
                if (!isJson(projected)) throw new Error('Invalid extension display projection');
                value = projected;
            }
            if (value !== undefined) {
                const selectedFields = descriptor.componentFields?.[name];
                if (!selectedFields) components[name] = cloneJson(value);
                else if (value && typeof value === 'object' && !Array.isArray(value)) components[name] = Object.fromEntries(selectedFields
                    .filter(field=>Object.prototype.hasOwnProperty.call(value,field)).map(field=>[field,cloneJson(value[field]!)]) );
            }
        }
        return freezeView({ session: this.viewSession, definitions: descriptor.definitions, playerId,
            state: fields, components, canManageCharacter: this.ports.canManageCharacter?.() ?? true });
    }
    recordingDigestToken(): readonly unknown[] {
        return [this, recordingRootRevision(this), recordingRootRevision(this.causality), this.nextFactId,
            this.states, this.components, this.world, peekEdibleState(this), this.pendingStoryFacts.length,
            this.actorActionBinding()?.state.revision];
    }
    snapshot(): ExtensionSnapshot {
        if (this.generations.length) throw new Error('Cannot snapshot an open generation transaction');
        return structuredClone({ manifest: this.manifest, modules: this.states, components: this.components,
            foundation: { ...edibleSnapshot(this), version: FOUNDATION_PROTOCOL, ...(statSessions.get(this)?.ledger.snapshot()?{stats:statSessions.get(this)!.ledger.snapshot()}:{}), nextFactId: this.nextFactId, pendingStoryFacts: this.pendingStoryFacts, causality: this.causality.snapshot(), deaths: this.deaths, world: this.world } });
    }
    validateSnapshot(value: ExtensionSnapshot): void {
        if (!value || !isJson(value) || canonical(value.manifest) !== canonical(this.manifest)
            || !value.modules || typeof value.modules !== 'object' || !value.components || typeof value.components !== 'object'
            || Array.isArray(value.modules) || Array.isArray(value.components)
            || Object.keys(value).some(key => !['manifest', 'modules', 'components', 'foundation'].includes(key))
            || canonical(Object.keys(value.modules).sort()) !== canonical(this.modules.map(module => module.id).sort())) throw new Error('Invalid extension snapshot');
        const foundation = value.foundation;
        if (!foundation || foundation.version !== FOUNDATION_PROTOCOL || Object.keys(foundation).filter(k=>!['stats','kindKnowledge','actorNeeds','timedStats','departures'].includes(k)).sort().join(',') !== 'causality,deaths,nextFactId,pendingStoryFacts,version,world'
            || !Number.isSafeInteger(foundation.nextFactId) || foundation.nextFactId < 1
            || !Array.isArray(foundation.pendingStoryFacts) || foundation.pendingStoryFacts.length > STORY_FACT_LIMIT
            || !foundation.pendingStoryFacts.every(validPendingStoryFact)
            || (foundation.pendingStoryFacts.length > 0 && !this.hasHook('storyFact') && !this.hasCommittedFactConsumer('foundation.story.v1'))
            || !validWorldSnapshot(foundation.world, this.modules.map(module => module.id))
            || !EffectCausality.validateSnapshot(foundation.causality) || !foundation.deaths || Array.isArray(foundation.deaths)
            || typeof foundation.deaths !== 'object') throw new Error('Invalid extension foundation snapshot');
        validateEdibleSnapshot(this,foundation);
        if(foundation.stats!==undefined)validateMaterializedStats(foundation.stats);
        if (foundation.world.entities.some(entity => !this.modules.find(module => module.id === entity.owner)?.worldInteractables && !this.modules.find(module => module.id === entity.owner)?.worldDefinitions)
            || foundation.world.regions?.some(region => {const m=this.modules.find(module => module.id === region.owner);return region.campSlotId!==undefined?!m?.worldDefinitions:!m?.ownedRegions;})
            || (foundation.world.gate && !this.modules.find(module => module.id === foundation.world.gate!.owner)?.interactionCommands?.length))
            throw new Error('Undeclared world interaction capability');
        for (const [id, fact] of Object.entries(foundation.deaths)) {
            if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !fact || fact.creature?.id !== Number(id)
                || typeof fact.administrative !== 'boolean' || !Object.prototype.hasOwnProperty.call(fact, 'origin')
                || (fact.origin !== null && !validEffectOrigin(fact.origin, foundation.causality.nextEffectId))
                || !isCreatureView(fact.creature)
                || Object.keys(fact).some(key => !['creature', 'origin', 'administrative'].includes(key))) throw new Error('Invalid death fact');
        }
        for (const module of this.modules) if (!module.validateState(value.modules[module.id]))
            throw new ExtensionCompatibilityError('state-invalid', module.id, `Invalid module state: ${module.id}`);
        // Persistent queues are only valid in a not-yet-ready recording origin
        // or intermediate initialization checkpoint. Ready runs must be drained.
        if (foundation.pendingStoryFacts.length && this.initializationReadyFor(value))
            throw new Error('Pending story facts in initialized snapshot');
        for (const module of this.modules) if (module.validateComponents && !module.validateComponents(value.modules[module.id]!, value.components, value.foundation))
            throw new ExtensionCompatibilityError('state-invalid', module.id, `Invalid module component references: ${module.id}`);
        for (const [id, components] of Object.entries(value.components)) {
            if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !components || typeof components !== 'object' || Array.isArray(components)) throw new Error('Invalid creature components');
            for (const [key, value] of Object.entries(components)) {
                const [module, component, extra] = key.split(':');
                const definition = this.modules.find(entry => entry.id === module);
                if (extra !== undefined || !definition || !validId(component)) throw new Error('Invalid component namespace');
                if (definition.componentValidators?.[component] && !definition.componentValidators[component]!(value))
                    throw new ExtensionCompatibilityError('state-invalid', definition.id, `Invalid component value: ${definition.id}`);
            }
        }
    }
    unload(): void {
        if (this.disposed) return;
        this.disposed = true;
        try { for (const module of [...this.modules].reverse()) requireSynchronous(module.onUnload?.()); }
        finally { bodyHandlers.delete(this); for (const creature of this.creatures) { bindNativeForms(creature); creature.extensionHooks = undefined; } this.creatures.clear(); }
    }
}
