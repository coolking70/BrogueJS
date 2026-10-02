import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime, type ExtensionPorts } from '../ext/runtime';
import { isJson } from '../ext/json';
import type { ExtensionContext, ExtensionModule, Json } from '../ext/types';
import { CombatSystem } from '../engine/Combat/Combat';
import { Creature } from '../entities/Creature';
import { createHeadlessGame } from './harness';
import { rng } from '../engine/Random';
import * as catalog from '../ext/catalog';

const ports = (): ExtensionPorts => ({ depth: () => 1, playerId: () => 1, randomInt: vi.fn(() => 7), message: vi.fn() });
const definition = (): ExtensionModule => ({ id: 'alpha', version: '1.0.0', initialState: () => ({}), validateState: (value: unknown): value is Json => isJson(value) });
function make(module: ExtensionModule, services = ports()): ExtensionRuntime {
    const registry = new ExtensionRegistry();
    registry.register(module.id, module.version, () => module);
    return new ExtensionRuntime(registry, registry.manifest([module.id]), services);
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-0 cloud boundary regressions', () => {
    it('never revives a completed or read-only context during a later writable hook', () => {
        let initialized!: ExtensionContext, loaded!: ExtensionContext, finished!: ExtensionContext;
        const services = ports();
        const runtime = make({ ...definition(),
            onNewGame: context => { initialized = context; },
            onLoad: context => { loaded = context; },
            hooks: {
                enteredLevel: (_event, context) => { finished = context; },
                playerTurnEnded: (_event, context) => {
                    for (const expired of [initialized, loaded, finished]) {
                        expect(() => expired.setState({ leaked: true })).toThrow('outside');
                        expect(() => expired.setComponent(1, 'counter', 1)).toThrow('outside');
                        expect(() => expired.removeComponent(1, 'counter')).toThrow('outside');
                        expect(() => expired.randomInt(1, 9)).toThrow('outside');
                        expect(() => expired.message('late')).toThrow('outside');
                    }
                    context.setState({ valid: true });
                },
            },
        }, services);
        runtime.newGame(); runtime.loaded();
        runtime.emit('enteredLevel', { depth: 1, firstVisit: true });
        runtime.emit('playerTurnEnded', { turn: 1 });
        expect(runtime.snapshot().modules.alpha).toEqual({ valid: true });
        expect(services.randomInt).not.toHaveBeenCalled();
        expect(services.message).not.toHaveBeenCalled();
    });

    it('accepts only complete command envelopes and explicitly declared command handlers', () => {
        const execute = vi.fn((payload: Json, context: ExtensionContext) => context.setState(payload));
        const runtime = make({ ...definition(), commands: { apply: execute } });
        for (const payload of [null, [], {}, { module: 'alpha', action: 'apply' },
            { module: 'alpha', action: 'apply', payload: 1, extra: true },
            { module: 'alpha', action: 'toString', payload: 1 },
            { module: 'alpha', action: 'constructor', payload: 1 },
            { module: 'alpha', action: '', payload: 1 },
            { module: 'alpha', action: ['apply'], payload: 1 }]) {
            expect(() => runtime.command(JSON.stringify(payload))).toThrow();
        }
        expect(execute).not.toHaveBeenCalled();
        expect(runtime.snapshot().modules.alpha).toEqual({});
        runtime.command(JSON.stringify({ module: 'alpha', action: 'apply', payload: { value: 2 } }));
        expect(execute).toHaveBeenCalledTimes(1);
        expect(runtime.snapshot().modules.alpha).toEqual({ value: 2 });
    });

    it('rejects ranges wider than the engine sampler supports before consuming random numbers', () => {
        const services = ports();
        const runtime = make({ ...definition(), onNewGame: context => {
            for (const [min, max] of [[0, 0xffffffff], [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], [2, 1]]) {
                expect(() => context.randomInt(min!, max!)).toThrow('range');
            }
            expect(services.randomInt).not.toHaveBeenCalled();
            expect(context.randomInt(0, 0xfffffffe)).toBe(7);
        } }, services);
        runtime.newGame();
        expect(services.randomInt).toHaveBeenCalledExactlyOnceWith(0, 0xfffffffe);
    });

    it('rejects malformed save event containers before replacing classic or extended live state', () => {
        for (const ruleSet of ['classic', 'extended'] as const) {
            const game = createHeadlessGame(4101, 'test');
            game.startNewGame({ seed: 4101, mode: 'test', ruleSet, ...(ruleSet === 'extended' ? { extensions: ['example'] } : {}) });
            const snapshot = game.toSaveSnapshot(), player = game.player, runtime = game.extensionRuntime, random = rng.getState();
            for (const events of [{}, null, [null], undefined]) {
                const malformed = structuredClone(snapshot);
                if (events === undefined) delete (malformed.run as Partial<typeof malformed.run>).recordedInputEvents;
                else (malformed.run as { recordedInputEvents: unknown }).recordedInputEvents = events;
                expect(game.loadSnapshot(malformed)).toBe(false);
                expect(game.player).toBe(player);
                expect(game.extensionRuntime).toBe(runtime);
                expect(rng.getState()).toEqual(random);
            }
        }
    });

    it('keeps unbound attack calls working with extension hooks attached', () => {
        const beforeAttack = vi.fn(), afterAttack = vi.fn();
        const runtime = make({ ...definition(), hooks: { beforeAttack, afterAttack } });
        const attacker = new Creature(1, 1, 'attacker', 'a', 10), defender = new Creature(2, 1, 'defender', 'd', 10);
        runtime.attachCreature(attacker); runtime.attachCreature(defender);
        const attack = CombatSystem.attack;
        const result = attack(attacker, defender, { lungeAttack: true });
        expect(beforeAttack).toHaveBeenCalledTimes(1);
        expect(afterAttack).toHaveBeenCalledTimes(1);
        expect(afterAttack.mock.calls[0]![0].result).toEqual(result);
        expect(runtime.sourceId).toBeNull();
        runtime.unload();
    });

    it('replays a declared extension command through the same dispatch and checkpoints', () => {
        const registry = new ExtensionRegistry();
        registry.register('alpha', '1.0.0', () => ({ ...definition(),
            commands: { apply: (payload, context) => context.setState({ payload, roll: context.randomInt(1, 99) }) },
        }));
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        const game = createHeadlessGame(41, 'test');
        game.startNewGame({ seed: 41, mode: 'test', ruleSet: 'extended', extensions: ['alpha'] });
        game.executeCommand('ext:command', JSON.stringify({ module: 'alpha', action: 'apply', payload: 2 }));
        const recording = game.exportRecording(), state = game.extensionRuntime!.snapshot(), random = rng.getState();
        expect(game.loadReplay(recording)).toBe(true);
        game.replayStep(true);
        expect(game.replayError).toBeNull();
        expect(game.extensionRuntime!.snapshot()).toEqual(state);
        expect(rng.getState()).toEqual(random);
    });
});
