import type { Creature } from '../entities/Creature';
import type { ExtensionRegistry } from './registry';
import type { ExtensionModule, ExtensionContext, ExtensionManifest, ExtensionSnapshot, HookEvents, HookName, Json } from './types';
import { creatureView } from './types';
import { canonical, cloneJson, isJson, validId } from './json';

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
export class ExtensionRuntime {
    private readonly modules: ExtensionModule[];
    private states: Record<string, Json> = {};
    private components: ExtensionSnapshot['components'] = {};
    private readonly creatures = new Set<Creature>();
    private readonly spawned = new WeakSet<Creature>();
    private readonly attacks: number[] = [];
    private active = false;
    private disposed = false;
    readonly manifest: ExtensionManifest;
    constructor(registry: ExtensionRegistry, manifest: ExtensionManifest, private readonly ports: ExtensionPorts, snapshot?: ExtensionSnapshot) {
        this.manifest = structuredClone(manifest);
        for (const entry of this.manifest.modules) Object.freeze(entry);
        Object.freeze(this.manifest.modules); Object.freeze(this.manifest);
        this.modules = registry.create(manifest);
        if (snapshot) this.validateSnapshot(snapshot);
        this.states = snapshot ? structuredClone(snapshot.modules) : Object.fromEntries(this.modules.map(module => [module.id, cloneJson(module.initialState())]));
        this.components = snapshot ? structuredClone(snapshot.components) : {};
        this.validateSnapshot(this.snapshot());
    }
    private context(module: ExtensionModule): ExtensionContext {
        const runtime = this;
        const writable = (): void => { if (!runtime.active || runtime.disposed) throw new Error('Extension mutation outside lifecycle/command/hook'); };
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
            randomInt(min, max) { writable(); if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) throw new Error('Invalid extension random range'); return runtime.ports.randomInt(min, max); },
            message(text) { writable(); runtime.ports.message(text); },
        };
    }
    private invoke(callback: () => void): void {
        if (this.disposed) throw new Error('Extension runtime unloaded');
        const prior = this.active; this.active = true;
        try {
            requireSynchronous(callback());
        } finally { this.active = prior; }
    }
    newGame(): void { for (const module of this.modules) if (module.onNewGame) this.invoke(() => module.onNewGame!(this.context(module))); }
    loaded(): void {
        const before = canonical(this.snapshot());
        // Load callbacks have read-only contexts: no RNG or mutation.
        for (const module of this.modules) requireSynchronous(module.onLoad?.(this.context(module)));
        if (canonical(this.snapshot()) !== before) throw new Error('Load handler changed extension state');
    }
    emit<K extends HookName>(name: K, event: HookEvents[K]): void {
        // Detached deeply frozen input prevents a module changing the next one's event.
        const freeze = (value: unknown): void => {
            if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
        };
        const input = structuredClone(event); freeze(input);
        for (const module of this.modules) {
            const handler = module.hooks?.[name];
            if (handler) this.invoke(() => handler(input, this.context(module)));
        }
    }
    command(data: unknown): void {
        if (typeof data !== 'string') throw new Error('Extension command requires JSON string');
        const input = JSON.parse(data) as { module: string; action: string; payload: Json };
        if (!isJson(input)) throw new Error('Invalid extension command');
        const module = this.modules.find(entry => entry.id === input.module);
        const handler = module?.commands?.[input.action];
        if (!module || !handler) throw new Error('Unknown extension command');
        this.invoke(() => handler(input.payload, this.context(module)));
    }
    attachCreature(creature: Creature, notifySpawn = true): void {
        if (this.disposed || this.creatures.has(creature)) return;
        this.creatures.add(creature);
        creature.extensionHooks = {
            beforeAttack: (attacker, defender) => {
                this.attacks.push(attacker.id);
                try { this.emit('beforeAttack', { attacker: creatureView(attacker, this.ports.playerId()), defender: creatureView(defender, this.ports.playerId()) }); }
                catch (error) { this.attacks.pop(); throw error; }
            },
            afterAttack: (attacker, defender, result) => {
                try { if (result) this.emit('afterAttack', { attacker: creatureView(attacker, this.ports.playerId()), defender: creatureView(defender, this.ports.playerId()), result }); }
                finally { this.attacks.pop(); }
            },
            damage: (target, amount, hpBefore) => this.emit('damage', { creature: creatureView(target, this.ports.playerId()), amount, hpBefore, sourceId: this.sourceId }),
        };
        if (notifySpawn && !this.spawned.has(creature)) {
            this.spawned.add(creature);
            this.emit('creatureSpawned', { creature: creatureView(creature, this.ports.playerId()) });
        }
    }
    get sourceId(): number | null { return this.attacks[this.attacks.length - 1] ?? null; }
    snapshot(): ExtensionSnapshot {
        return structuredClone({ manifest: this.manifest, modules: this.states, components: this.components });
    }
    validateSnapshot(value: ExtensionSnapshot): void {
        if (!value || !isJson(value) || canonical(value.manifest) !== canonical(this.manifest)
            || !value.modules || typeof value.modules !== 'object' || !value.components || typeof value.components !== 'object'
            || Array.isArray(value.modules) || Array.isArray(value.components)
            || Object.keys(value).some(key => !['manifest', 'modules', 'components'].includes(key))
            || canonical(Object.keys(value.modules).sort()) !== canonical(this.modules.map(module => module.id).sort())) throw new Error('Invalid extension snapshot');
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
        try { for (const module of [...this.modules].reverse()) requireSynchronous(module.onUnload?.()); }
        finally { for (const creature of this.creatures) creature.extensionHooks = undefined; this.creatures.clear(); this.disposed = true; }
    }
}
