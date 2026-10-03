import type { Creature } from '../entities/Creature';
import { Player } from '../entities/Player';
import type { ExtensionRegistry } from './registry';
import type { ExtensionModule, ExtensionContext, ExtensionManifest, ExtensionSnapshot, HookEvents, HookName, Json, ActorFacts, ResourceCommit, CharacterResources, CharacterResourceCommit, ExtensionRuleContext, ExtensionRuleInput, ExtensionRulePolicies, ItemGrowthInput, ExtensionViewDescriptor, ExtensionModuleView, ExtensionCreationResources } from './types';
import { creatureView } from './types';
import { readCreatureBirth } from './birth';
import { canonical, cloneJson, isJson, validId } from './json';
import { EffectCausality, validEffectOrigin, type EffectOrigin } from './causality';
import type { DeathFact, GenerationToken, ControlledActionRequest, ControlledActionResult, ControlledActionOutcome, PhysicalResolutionFact, OptionalQueryResult, OptionalQueryProvider } from './types';

function isCreatureView(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const v = value as Record<string, unknown>;
    return Object.keys(v).length === 7 && typeof v.name === 'string' && typeof v.player === 'boolean'
        && ['id', 'hp', 'maxHp', 'x', 'y'].every(key => Number.isSafeInteger(v[key]))
        && (v.id as number) > 0 && (v.maxHp as number) >= 0;
}
export interface ExtensionPorts {
    depth(): number;
    playerId(): number;
    canManageCharacter?(): boolean;
    validateAction?(request: ControlledActionRequest): boolean;
    executeAction?(request: ControlledActionRequest, callbacks: { beforeCommit(): void; afterResolve(outcome: ControlledActionOutcome): void }): boolean;
    gold?(): number;
    setGold?(value: number): void;
    randomInt(min: number, max: number): number;
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
    token: GenerationToken;
    states: Record<string, Json>;
    components: ExtensionSnapshot['components'];
    causality: ReturnType<EffectCausality['snapshot']>;
    deaths: Record<string, DeathFact>;
    creatures: Set<Creature>;
    facts: BufferedFact[];
    births: Set<Creature>;
}
export class ExtensionRuntime {
    private readonly modules: ExtensionModule[];
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
    private actionActorId: number | null = null;
    private actionResolutions: PhysicalResolutionFact[] | null = null;
    readonly manifest: ExtensionManifest;
    readonly causality: EffectCausality;
    private deaths: Record<string, DeathFact> = {};
    private readonly generations: GenerationFrame[] = [];
    private publishingGeneration = false;
    constructor(registry: ExtensionRegistry, manifest: ExtensionManifest, private readonly ports: ExtensionPorts, snapshot?: ExtensionSnapshot) {
        this.manifest = structuredClone(manifest);
        for (const entry of this.manifest.modules) { if (entry.rules) Object.freeze(entry.rules); Object.freeze(entry); }
        Object.freeze(this.manifest.modules); Object.freeze(this.manifest);
        this.modules = registry.create(manifest);
        for (const module of this.modules) for (const [capability, provider] of Object.entries(module.optionalQueries ?? {})) {
            if (!validId(capability) || !/\.v[1-9]\d*$/.test(capability) || !provider
                || typeof provider.accepts !== 'function' || typeof provider.query !== 'function' || typeof provider.validate !== 'function') throw new Error('Invalid optional query provider');
            if (this.optionalQueries.has(capability)) throw new Error(`Conflicting optional query providers: ${capability}`);
            this.optionalQueries.set(capability, { module, provider });
        }
        for (const module of this.modules) if (module.view) {
            if (!isJson(module.view.definitions) || !module.view.stateFields.every(safeStateField)
                || !module.view.playerComponents.every(validId)) throw new Error('Invalid extension display descriptor');
            if (module.view.componentFields && (!isJson(module.view.componentFields) || Array.isArray(module.view.componentFields)
                || Object.entries(module.view.componentFields).some(([name,fields])=>!module.view!.playerComponents.includes(name)
                    || !Array.isArray(fields) || new Set(fields).size !== fields.length || !fields.every(safeStateField))))
                throw new Error('Invalid extension component projection');
            this.views.set(module.id, freezeView(structuredClone(module.view)));
        }
        for (const port of ['hitChance', 'physicalDamage', 'stealthRange', 'searchStrength', 'strengthBonus', 'maxHpBonus', 'focusCapacity', 'focusRecoveryInterval', 'cooldownDuration', 'nativeBonuses'] as const) {
            if (this.modules.filter(module => module.rulePolicies?.[port]).length > 1) throw new Error('Conflicting extension rule providers');
        }
        if (this.modules.filter(module => module.commitItemGrowth).length > 1) throw new Error('Conflicting item growth providers');
        this.causality = new EffectCausality();
        if (snapshot) this.validateSnapshot(snapshot);
        this.states = snapshot ? structuredClone(snapshot.modules) : Object.fromEntries(this.modules.map(module => [module.id, cloneJson(module.initialState())]));
        this.components = snapshot ? structuredClone(snapshot.components) : {};
        if (snapshot) {
            this.causality.restore(snapshot.foundation.causality);
            this.deaths = structuredClone(snapshot.foundation.deaths);
        }
        this.validateSnapshot(this.snapshot());
    }
    private context(module: ExtensionModule, scope: object | null): ExtensionContext {
        const runtime = this;
        const writable = (): void => { if (!scope || runtime.activeScope !== scope || runtime.disposed) throw new Error('Extension mutation outside lifecycle/command/hook'); };
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
            get depth() { return runtime.ports.depth(); },
            get playerId() { return runtime.ports.playerId(); },
            get state() { return cloneJson(runtime.states[module.id]!); },
            isInitialCommand(action, data) { return runtime.isInitialCommand(action, data); },
            queryOptional(capability, input) { return runtime.queryOptional(capability, input); },
            setState(value) { writable(); if (!module.validateState(value)) throw new Error(`Invalid module state: ${module.id}`); runtime.states[module.id] = cloneJson(value); },
            getComponent(id, name) { const value = runtime.components[creatureKey(id)]?.[componentKey(name)]; return value === undefined ? undefined : cloneJson(value); },
            setComponent(id, name, value) { writable(); if (module.componentValidators?.[name] && !module.componentValidators[name]!(value)) throw new Error('Invalid component value'); const key = creatureKey(id); (runtime.components[key] ??= {})[componentKey(name)] = cloneJson(value); },
            removeComponent(id, name) { writable(); const key = creatureKey(id); delete runtime.components[key]?.[componentKey(name)]; if (runtime.components[key] && !Object.keys(runtime.components[key]!).length) delete runtime.components[key]; },
            creature(id) { const actor = [...runtime.creatures].find(creature => creature.id === id); return actor ? runtime.actorFacts(actor) : null; },
            grantReward(request) {
                writable();
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
                writable();
                if (runtime.commandModule !== module || runtime.activeScope !== runtime.commandScope || runtime.controlledAction || runtime.commandActionUsed || !runtime.ports.executeAction)
                    throw new Error('Controlled action outside module command');
                if (!callbacks || typeof callbacks.beforeCommit !== 'function' || typeof callbacks.afterResolve !== 'function')
                    throw new Error('Invalid controlled action callbacks');
                const input = freezeView(structuredClone(request));
                runtime.controlledAction = true; runtime.commandActionUsed = true; runtime.actionActorId = input.actorId;
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
                writable();
                const span = max - min + 1;
                // The engine's rejection sampler requires a nonzero divisor.
                if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max
                    || !Number.isSafeInteger(span) || span > 0xffffffff) throw new Error('Invalid extension random range');
                return runtime.ports.randomInt(min, max);
            },
            message(text) { writable(); runtime.ports.message(text); },
        };
    }
    private actorFacts(creature: Creature, playerId = this.ports.playerId()): ActorFacts {
        const player = creature.id === playerId;
        const allied = player || ('isAlly' in creature && creature.isAlly === true);
        return Object.freeze({ ...creatureView(creature, playerId), allied,
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
        actor.maxHp = value.maxHp; actor.hp = value.hp;
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
            actor.strength = value.strength!; this.ports.setGold?.(value.gold!);
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
    /** Pure engine adapter: one provider per slot, finite synchronous bounded scalars. */
    rule(port: Exclude<keyof ExtensionRulePolicies, 'nativeBonuses'>, input: ExtensionRuleInput): number {
        const module = this.modules.find(module => module.rulePolicies?.[port]);
        if (!module) return input.baseValue;
        const result = module.rulePolicies![port]!(Object.freeze({ ...input }), this.ruleContext(module));
        requireSynchronous(result);
        if (!Number.isSafeInteger(result) || result < 0 || (port === 'hitChance' && result > 10000)) throw new Error('Invalid extension rule result');
        return result;
    }
    commitItemGrowth(actor: Creature, itemId: string, nativeDestination: ItemGrowthInput['nativeDestination'], nativeAmount: number,
        nativeCommit?: { apply(amount: number): void; rollback?(): void }): number {
        const module = this.modules.find(module => module.commitItemGrowth);
        if (!module) { nativeCommit?.apply(nativeAmount); return nativeAmount; }
        if (!this.creatures.has(actor) || !Number.isSafeInteger(nativeAmount) || nativeAmount < 0) throw new Error('Invalid item growth owner or amount');
        const states = structuredClone(this.states), components = structuredClone(this.components);
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
                this.states = states; this.components = components;
                for (const saved of resources) {
                    saved.creature.hp = saved.hp; saved.creature.maxHp = saved.maxHp;
                    if (saved.creature instanceof Player) { saved.creature.strength = saved.strength!; this.ports.setGold?.(saved.gold!); }
                }
            }
            throw error;
        } finally { this.resourcePhase = prior; }
    }
    private nativeMaximumBase(actor: Creature): number {
        const module = this.modules.find(module => module.rulePolicies?.nativeBonuses);
        if (!module) return actor.maxHp;
        const bonuses = module.rulePolicies!.nativeBonuses!(actor.id, this.ruleContext(module));
        requireSynchronous(bonuses);
        if (!bonuses || !Number.isSafeInteger(bonuses.maxHp) || bonuses.maxHp < 0
            || !Number.isSafeInteger(bonuses.strength) || bonuses.strength < 0
            || actor.maxHp - bonuses.maxHp < 1
            || (actor instanceof Player && actor.strength - bonuses.strength < 1)) throw new Error('Invalid native extension bonuses');
        return actor.maxHp - bonuses.maxHp;
    }
    allowsInput(action: string, data?: unknown): boolean {
        if (action === 'ext:command') {
            try {
                if (typeof data !== 'string') return false;
                const input = JSON.parse(data);
                if (!isJson(input) || !input || typeof input !== 'object' || Array.isArray(input)
                    || Object.keys(input).sort().join(',') !== 'action,module,payload' || typeof input.module !== 'string'
                    || typeof input.action !== 'string' || !validId(input.module)) return false;
                const module = this.modules.find(module => module.id === input.module);
                if (!module?.commands || !Object.prototype.hasOwnProperty.call(module.commands,input.action)) return false;
            } catch { return false; }
        }
        return this.modules.every(module => module.allowInput?.(action, data, this.context(module, null)) !== false);
    }
    get readyToSave(): boolean { return this.modules.every(module => module.readyToSave?.(this.context(module, null)) !== false); }
    validateRecording(events: readonly {action:string;data:unknown;extensions?:ExtensionSnapshot}[]): boolean {
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
        if (!this.modules.some(module => module.hooks?.simulationSettled)) return;
        if (this.generations.length || this.activeScope) throw new Error('Extension settlement outside safe boundary');
        const beforeStates = structuredClone(this.states), beforeComponents = structuredClone(this.components);
        const resources = [...this.creatures].map(actor => [actor, actor.hp, actor.maxHp,
            actor instanceof Player ? actor.strength : null, actor instanceof Player ? this.ports.gold?.() ?? 0 : null] as const);
        try {
            for (const actor of [...this.creatures].sort((a, b) => a.id - b.id)) this.observeCreature(actor);
            const causes = this.causality.snapshot();
            const origins = [...Object.values(causes.statusOrigins).flatMap(Object.values), ...Object.values(causes.fatalOrigins),
                ...Object.values(causes.pendingDisplacements), ...Object.values(this.deaths).map(death => death.origin)];
            const sourceIds = [...new Set(origins.flatMap(origin => origin?.creditActorId ? [origin.creditActorId] : []))].sort((a,b) => a-b);
            this.emit('simulationSettled', { knownKinds: this.ports.knownKinds?.() ?? [],
                reachableIds: reachable.map(actor => actor.id).sort((a,b) => a-b), sourceIds });
        } catch (error) {
            this.states = beforeStates; this.components = beforeComponents;
            for (const [actor, hp, maxHp, strength, gold] of resources) {
                actor.hp = hp; actor.maxHp = maxHp;
                if (actor instanceof Player) { actor.strength = strength!; this.ports.setGold?.(gold!); }
            }
            throw error;
        }
    }
    validateWorld(creatures: readonly Creature[]): void {
        for (const actor of creatures) this.nativeMaximumBase(actor);
        const actors = creatures.map(actor => this.actorFacts(actor,creatures[0]!.id));
        for (const module of this.modules) if (module.validateWorld && !module.validateWorld(this.states[module.id]!, this.components, actors))
            throw new Error('Invalid extension world references');
    }
    private invoke(module: ExtensionModule, callback: (context: ExtensionContext) => void, command = false): void {
        if (this.disposed) throw new Error('Extension runtime unloaded');
        const prior = this.activeScope, priorCommandScope = this.commandScope, scope = {};
        this.activeScope = scope;
        if (command) this.commandScope = scope;
        try {
            requireSynchronous(callback(this.context(module, scope)));
        } finally { this.activeScope = prior; this.commandScope = priorCommandScope; }
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
                    try { this.invoke(module, context => handler(input, context)); } finally { this.resourcePhase = prior; }
                }
            }
        }
    }
    command(data: unknown): void {
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
        const states = structuredClone(this.states), components = structuredClone(this.components);
        const resources = [...this.creatures].map(actor => ({ actor, hp: actor.hp, maxHp: actor.maxHp,
            strength: actor instanceof Player ? actor.strength : null, gold: actor instanceof Player ? this.ports.gold?.() ?? 0 : null }));
        const priorCommandModule = this.commandModule, priorActionUsed = this.commandActionUsed;
        this.commandModule = module; this.commandActionUsed = false;
        try { this.invoke(module, context => handler(input.payload, context), true); }
        catch (error) {
            this.states = states; this.components = components;
            for (const saved of resources) {
                saved.actor.hp = saved.hp; saved.actor.maxHp = saved.maxHp;
                if (saved.actor instanceof Player) { saved.actor.strength = saved.strength!; this.ports.setGold?.(saved.gold!); }
            }
            throw error;
        } finally { this.resourcePhase = prior; this.commandModule = priorCommandModule; this.commandActionUsed = priorActionUsed; }
    }
    attachCreature(creature: Creature, notifySpawn = true): void {
        if (this.disposed || this.creatures.has(creature)) return;
        this.creatures.add(creature);
        creature.extensionHooks = {
            causality: this.causality,
            partyId: actor => this.creditParty(actor),
            relationshipChanged: actor => this.observeCreature(actor),
            nativeMaximumReset: (actor, preserveOverhealth = false) => this.emit('nativeMaximumReset', { actor: this.actorFacts(actor),
                ...(preserveOverhealth ? { preserveOverhealth: true } : {}) }),
            nativeMaximumBase: actor => this.nativeMaximumBase(actor),
            rule: (port, input) => this.rule(port, input),
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
                this.emit('damage', { creature: creatureView(target, this.ports.playerId()), amount, hpBefore,
                    sourceId: this.sourceId, origin: fact.origin, hpLost: fact.hpLost, damageKind });
            },
        };
        if (notifySpawn && !this.spawned.has(creature)) {
            this.spawned.add(creature);
            if (this.generations.length) this.generations[this.generations.length - 1]!.births.add(creature);
            this.emit('creatureSpawned', this.spawnFact(creature));
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
        this.generations.push({ token, states: structuredClone(this.states), components: structuredClone(this.components),
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
        try {
            for (const creature of [...frame.births].sort((a, b) => a.id - b.id)) {
                this.dispatch('creatureSpawned', this.spawnFact(creature));
            }
            for (const fact of frame.facts) if (fact.name !== 'creatureSpawned') this.dispatch<HookName>(fact.name, fact.event, fact.readonly);
            this.dispatch('generationCommitted', { label: token.label, creatureIds: [...frame.births].map(c => c.id).sort((a, b) => a - b) });
            this.generations.pop();
        } finally { this.publishingGeneration = false; }
    }
    rollbackGeneration(token: GenerationToken): void {
        const frame = this.generation(token);
        this.states = frame.states; this.components = frame.components;
        this.causality.restore(frame.causality); this.deaths = frame.deaths;
        for (const creature of this.creatures) if (!frame.creatures.has(creature)) {
            creature.extensionHooks = undefined; this.spawned.delete(creature); this.creatures.delete(creature);
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
        if (this.modules.some(module => module.hooks?.deathCaptured)) this.emit('deathCaptured', { actor: this.actorFacts(creature), origin: structuredClone(origin), administrative });
        const fact = { creature: creatureView(creature, this.ports.playerId()), origin: structuredClone(origin), administrative };
        this.deaths[String(creature.id)] = fact;
        return structuredClone(fact);
    }
    /** Mechanical roots only: observation/history sets must not pin dead components. */
    collectComponents(reachable: Iterable<Creature>): void {
        if (this.generations.length || this.activeScope) throw new Error('Component collection outside safe boundary');
        const keep = new Set([...reachable].map(creature => creature.id));
        for (const id of Object.keys(this.components)) if (!keep.has(Number(id))) delete this.components[id];
        for (const id of Object.keys(this.deaths)) if (!keep.has(Number(id))) delete this.deaths[id];
        this.causality.retainCreatures(keep);
        for (const creature of this.creatures) if (!keep.has(creature.id)) {
            creature.extensionHooks = undefined; this.creatures.delete(creature);
        }
        // Module-owned reward receipts are deliberately not collected with bodies.
    }
    get sourceId(): number | null { return this.attacks[this.attacks.length - 1] ?? null; }
    /** Pure player-only projection. Never snapshots causal ledgers, NPCs, rewards, or the world. */
    readModuleView(moduleId: string): ExtensionModuleView | null {
        const descriptor = this.views.get(moduleId);
        if (this.disposed || !descriptor) return null;
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
    snapshot(): ExtensionSnapshot {
        if (this.generations.length) throw new Error('Cannot snapshot an open generation transaction');
        return structuredClone({ manifest: this.manifest, modules: this.states, components: this.components,
            foundation: { version: 1, causality: this.causality.snapshot(), deaths: this.deaths } });
    }
    validateSnapshot(value: ExtensionSnapshot): void {
        if (!value || !isJson(value) || canonical(value.manifest) !== canonical(this.manifest)
            || !value.modules || typeof value.modules !== 'object' || !value.components || typeof value.components !== 'object'
            || Array.isArray(value.modules) || Array.isArray(value.components)
            || Object.keys(value).some(key => !['manifest', 'modules', 'components', 'foundation'].includes(key))
            || canonical(Object.keys(value.modules).sort()) !== canonical(this.modules.map(module => module.id).sort())) throw new Error('Invalid extension snapshot');
        const foundation = value.foundation;
        if (!foundation || foundation.version !== 1 || Object.keys(foundation).some(key => !['version', 'causality', 'deaths'].includes(key))
            || !EffectCausality.validateSnapshot(foundation.causality) || !foundation.deaths || Array.isArray(foundation.deaths)
            || typeof foundation.deaths !== 'object') throw new Error('Invalid extension foundation snapshot');
        for (const [id, fact] of Object.entries(foundation.deaths)) {
            if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !fact || fact.creature?.id !== Number(id)
                || typeof fact.administrative !== 'boolean' || !Object.prototype.hasOwnProperty.call(fact, 'origin')
                || (fact.origin !== null && !validEffectOrigin(fact.origin, foundation.causality.nextEffectId))
                || !isCreatureView(fact.creature)
                || Object.keys(fact).some(key => !['creature', 'origin', 'administrative'].includes(key))) throw new Error('Invalid death fact');
        }
        for (const module of this.modules) if (!module.validateState(value.modules[module.id])) throw new Error(`Invalid module state: ${module.id}`);
        for (const module of this.modules) if (module.validateComponents && !module.validateComponents(value.modules[module.id]!, value.components, value.foundation)) throw new Error('Invalid module component references');
        for (const [id, components] of Object.entries(value.components)) {
            if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !components || typeof components !== 'object' || Array.isArray(components)) throw new Error('Invalid creature components');
            for (const [key, value] of Object.entries(components)) {
                const [module, component, extra] = key.split(':');
                const definition = this.modules.find(entry => entry.id === module);
                if (extra !== undefined || !definition || !validId(component)) throw new Error('Invalid component namespace');
                if (definition.componentValidators?.[component] && !definition.componentValidators[component]!(value)) throw new Error('Invalid component value');
            }
        }
    }
    unload(): void {
        if (this.disposed) return;
        this.disposed = true;
        try { for (const module of [...this.modules].reverse()) requireSynchronous(module.onUnload?.()); }
        finally { for (const creature of this.creatures) creature.extensionHooks = undefined; this.creatures.clear(); }
    }
}
