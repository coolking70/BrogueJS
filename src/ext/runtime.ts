import type { Creature } from '../entities/Creature';
import type { ExtensionRegistry } from './registry';
import type { ExtensionModule, ExtensionContext, ExtensionManifest, ExtensionSnapshot, HookEvents, HookName, Json } from './types';
import { creatureView } from './types';
import { canonical, cloneJson, isJson, validId } from './json';
import { EffectCausality, validEffectOrigin, type EffectOrigin } from './causality';
import type { DeathFact, GenerationToken } from './types';

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
    randomInt(min: number, max: number): number;
    message(text: string): void;
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
    private states: Record<string, Json> = {};
    private components: ExtensionSnapshot['components'] = {};
    private readonly creatures = new Set<Creature>();
    private readonly spawned = new WeakSet<Creature>();
    private readonly attacks: number[] = [];
    private activeScope: object | null = null;
    private disposed = false;
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
            setState(value) { writable(); if (!module.validateState(value)) throw new Error(`Invalid module state: ${module.id}`); runtime.states[module.id] = cloneJson(value); },
            getComponent(id, name) { const value = runtime.components[creatureKey(id)]?.[componentKey(name)]; return value === undefined ? undefined : cloneJson(value); },
            setComponent(id, name, value) { writable(); if (module.componentValidators?.[name] && !module.componentValidators[name]!(value)) throw new Error('Invalid component value'); const key = creatureKey(id); (runtime.components[key] ??= {})[componentKey(name)] = cloneJson(value); },
            removeComponent(id, name) { writable(); const key = creatureKey(id); delete runtime.components[key]?.[componentKey(name)]; if (runtime.components[key] && !Object.keys(runtime.components[key]!).length) delete runtime.components[key]; },
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
    private invoke(module: ExtensionModule, callback: (context: ExtensionContext) => void): void {
        if (this.disposed) throw new Error('Extension runtime unloaded');
        const prior = this.activeScope, scope = {};
        this.activeScope = scope;
        try {
            requireSynchronous(callback(this.context(module, scope)));
        } finally { this.activeScope = prior; }
    }
    newGame(): void { for (const module of this.modules) if (module.onNewGame) this.invoke(module, context => module.onNewGame!(context)); }
    loaded(): void {
        const before = canonical(this.snapshot());
        // Load callbacks have read-only contexts: no RNG or mutation.
        for (const module of this.modules) requireSynchronous(module.onLoad?.(this.context(module, null)));
        if (canonical(this.snapshot()) !== before) throw new Error('Load handler changed extension state');
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
                else this.invoke(module, context => handler(input, context));
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
        this.invoke(module, context => handler(input.payload, context));
    }
    attachCreature(creature: Creature, notifySpawn = true): void {
        if (this.disposed || this.creatures.has(creature)) return;
        this.creatures.add(creature);
        creature.extensionHooks = {
            causality: this.causality,
            partyId: actor => actor.id === this.ports.playerId() || ('isAlly' in actor && actor.isAlly === true) ? `player:${this.ports.playerId()}` : null,
            beforeAttack: (attacker, defender) => {
                this.attacks.push(attacker.id);
                try { this.emit('beforeAttack', { attacker: creatureView(attacker, this.ports.playerId()), defender: creatureView(defender, this.ports.playerId()) }); }
                catch (error) { this.attacks.pop(); throw error; }
            },
            afterAttack: (attacker, defender, result) => {
                try { if (result) this.emit('afterAttack', { attacker: creatureView(attacker, this.ports.playerId()), defender: creatureView(defender, this.ports.playerId()), result }); }
                finally { this.attacks.pop(); }
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
            this.emit('creatureSpawned', { creature: creatureView(creature, this.ports.playerId()) });
        }
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
                this.dispatch('creatureSpawned', { creature: creatureView(creature, this.ports.playerId()) });
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
