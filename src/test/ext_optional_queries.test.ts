import { describe, expect, it, vi } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime, type ExtensionPorts } from '../ext/runtime';
import type { ExtensionModule, Json, OptionalQueryContext, OptionalQueryProvider } from '../ext/types';

const id = 'foundation.sample.v1';
const base = (id: string): ExtensionModule => ({ id, version: '1.0.0', initialState: () => ({ count: 3 }),
    validateState: (value): value is Json => !!value && typeof value === 'object' });
function setup(modules: ExtensionModule[], selected = modules.map(module => module.id)) {
    const registry = new ExtensionRegistry(), factories = modules.map(module => vi.fn(() => module));
    modules.forEach((module, index) => registry.register(module.id, module.version, factories[index]!));
    const ports: ExtensionPorts = { depth: () => 1, playerId: () => 7, randomInt: vi.fn(() => 1), message: vi.fn() };
    return { runtime: new ExtensionRuntime(registry, registry.manifest(selected), ports), ports, factories };
}
const provider = (override: Partial<OptionalQueryProvider> = {}): OptionalQueryProvider => ({
    accepts: input => input === 'known',
    query: (_input, context) => ({ count: (context.state as { count: number }).count }),
    validate: (value): value is Json => !!value && typeof value === 'object' && Object.keys(value).join(',') === 'count'
        && Number.isSafeInteger((value as { count: number }).count), ...override,
});

describe('2a0 optional read-only capabilities', () => {
    it('distinguishes absent/disabled providers and unsupported inputs without side effects', () => {
        const query = vi.fn(provider().query), accept = vi.fn(provider().accepts);
        const packageModule = { ...base('provider'), optionalQueries: { [id]: provider({ query, accepts: accept }) } };
        const disabled = setup([packageModule], []), before = disabled.runtime.snapshot();
        expect(disabled.runtime.queryOptional(id, 'known')).toEqual({ status: 'unavailable', reason: 'absent' });
        expect(disabled.factories[0]).not.toHaveBeenCalled();
        expect(query).not.toHaveBeenCalled(); expect(accept).not.toHaveBeenCalled();
        expect(disabled.runtime.snapshot()).toEqual(before); expect(disabled.ports.randomInt).not.toHaveBeenCalled();
        const active = setup([packageModule]), snapshot = active.runtime.snapshot();
        expect(active.runtime.queryOptional(id, 'unknown')).toEqual({ status: 'unavailable', reason: 'unsupported-input' });
        expect(query).not.toHaveBeenCalled();
        expect(active.runtime.queryOptional('foundation.sample.v2', 'known')).toEqual({ status: 'unavailable', reason: 'absent' });
        expect(active.runtime.queryOptional(id, 'known')).toEqual({ status: 'available', value: { count: 3 } });
        expect(active.runtime.snapshot()).toEqual(snapshot); expect(active.ports.message).not.toHaveBeenCalled();
        expect(active.ports.randomInt).not.toHaveBeenCalled();
    });
    it('exposes only frozen own state and selected player components, with detached frozen reply', () => {
        let context!: OptionalQueryContext;
        const reply = { count: 9 };
        const { runtime } = setup([{ ...base('provider'),
            onNewGame: ctx => { ctx.setComponent(7, 'public', { count: 5 }); ctx.setComponent(8, 'public', { secret: 88 }); },
            optionalQueries: { [id]: provider({ query: (_input, ctx) => { context = ctx; return reply; } }) } }]);
        runtime.newGame(); const before = runtime.snapshot();
        const result = runtime.queryOptional(id, 'known');
        expect(Object.keys(context).sort()).toEqual(['getPlayerComponent', 'playerId', 'state']);
        expect(context.getPlayerComponent('public')).toEqual({ count: 5 });
        expect(() => context.getPlayerComponent('../provider')).toThrow('component');
        expect(Object.isFrozen(context)).toBe(true); expect(Object.isFrozen(context.state)).toBe(true);
        expect(Object.isFrozen(context.getPlayerComponent('public'))).toBe(true);
        expect(Object.isFrozen(result)).toBe(true);
        if (result.status !== 'available') throw new Error('Expected available capability');
        expect(Object.isFrozen(result.value)).toBe(true);
        reply.count = 30; expect(result.value).toEqual({ count: 9 });
        expect(runtime.snapshot()).toEqual(before);
    });
    it('resolves only enabled providers and rejects ambiguous versions independently of registration order', () => {
        const modules = ['zeta', 'alpha'].map(name => ({ ...base(name), optionalQueries: { [id]: provider() } }));
        for (const order of [modules, [...modules].reverse()]) {
            expect(() => setup(order)).toThrow('Conflicting optional');
            expect(setup(order, ['alpha']).runtime.queryOptional(id, 'known').status).toBe('available');
        }
    });
    it('treats malformed declaration/results and asynchronous callbacks as errors, never absence', () => {
        for (const p of [provider({ query: () => ({ count: Infinity }) }), provider({ query: () => ({ count: 1, secret: 4 }) }),
            provider({ query: (async () => ({ count: 1 })) as any }), provider({ accepts: (async () => true) as any }),
            provider({ validate: (async () => true) as any })]) {
            expect(() => setup([{ ...base('provider'), optionalQueries: { [id]: p } }]).runtime.queryOptional(id, 'known')).toThrow();
        }
        expect(() => setup([{ ...base('provider'), optionalQueries: { unversioned: provider() } }])).toThrow('Invalid optional');
        const { runtime } = setup([]);
        expect(() => runtime.queryOptional(id, { count: NaN })).toThrow('Invalid optional');
        runtime.unload(); expect(() => runtime.queryOptional(id, null)).toThrow('unloaded');
    });
    it('allows a consumer to degrade without provider imports, writes, or random use', () => {
        const consumer: ExtensionModule = { ...base('consumer'), commands: { inspect(_payload, context) {
            const response = context.queryOptional(id, 'known');
            expect(response.status).toBe('unavailable');
        } } };
        const { runtime, ports } = setup([consumer]), before = runtime.snapshot();
        runtime.command(JSON.stringify({ module: 'consumer', action: 'inspect', payload: null }));
        expect(runtime.snapshot()).toEqual(before); expect(ports.randomInt).not.toHaveBeenCalled();
    });
});
