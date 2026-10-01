import { describe, expect, it } from 'vitest';
import { isJson } from '../ext/json';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import type { ExtensionModule, Json } from '../ext/types';
const module = (): ExtensionModule => ({ id: 'alpha', version: '1.0.0', initialState: () => ({}), validateState: (value: unknown): value is Json => isJson(value) });
const ports = { depth: () => 1, playerId: () => 1, randomInt: () => 1, message: () => {} };
function make(definition: ExtensionModule = module()): ExtensionRuntime {
    const registry = new ExtensionRegistry(); registry.register('alpha', '1.0.0', () => definition);
    return new ExtensionRuntime(registry, registry.manifest(['alpha']), ports);
}
describe('EXT-0 strict data and synchronous lifecycle boundaries', () => {
    it('rejects sparse arrays, array properties, prototypes, cycles and non-finite values', () => {
        expect(isJson(new Array(2))).toBe(false);
        const array: unknown[] & { extra?: number } = [1]; array.extra = 2; expect(isJson(array)).toBe(false);
        expect(isJson(JSON.parse('{"__proto__":{}}'))).toBe(false);
        const cycle: any = {}; cycle.self = cycle; expect(isJson(cycle)).toBe(false);
        expect(isJson(new Date())).toBe(false); expect(isJson({ amount: Infinity })).toBe(false);
        expect(isJson([null, { value: 2 }, true])).toBe(true);
    });
    it('requires object state containers, including empty enabled sets', () => {
        const runtime = make(), valid = runtime.snapshot();
        for (const value of [1, true, 'value', [], null]) {
            expect(() => runtime.validateSnapshot({ ...valid, components: value } as any)).toThrow();
            expect(() => runtime.validateSnapshot({ ...valid, modules: value } as any)).toThrow();
        }
        const registry = new ExtensionRegistry(), empty = new ExtensionRuntime(registry, registry.manifest([]), ports);
        expect(() => empty.validateSnapshot({ ...empty.snapshot(), modules: 1 } as any)).toThrow();
    });
    it('enforces declared component validators at mutation and restore', () => {
        const runtime = make({ ...module(), componentValidators: { progression: value => !!value && typeof value === 'object' && (value as {level:number}).level >= 1 },
            onNewGame: context => {
                expect(() => context.setComponent(1, 'progression', { level: 0 })).toThrow('component');
                context.setComponent(1, 'progression', { level: 1 });
            },
        });
        runtime.newGame(); const invalid = runtime.snapshot(); invalid.components['1']!['alpha:progression'] = { level: 0 };
        expect(() => runtime.validateSnapshot(invalid)).toThrow('component');
    });
    it('rejects asynchronous event/init/load/unload handlers', () => {
        expect(() => make({ ...module(), onNewGame: async () => {} }).newGame()).toThrow('Async');
        expect(() => make({ ...module(), hooks: { enteredLevel: async () => {} } }).emit('enteredLevel', { depth: 1, firstVisit: true })).toThrow('Async');
        expect(() => make({ ...module(), onLoad: async () => {} }).loaded()).toThrow('Async');
        expect(() => make({ ...module(), onUnload: async () => {} }).unload()).toThrow('Async');
    });
});
