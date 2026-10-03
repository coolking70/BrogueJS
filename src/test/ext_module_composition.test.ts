import { afterEach, describe, expect, it, vi } from 'vitest';
import * as catalog from '../ext/catalog';
import { validateModuleDescriptors, type ModuleDescriptor } from '../ext/descriptor';
import { ExtensionRegistry } from '../ext/registry';
import type { ExtensionManifest } from '../ext/types';
import { Game, type GameRecording, type RecordedInputEvent } from '../engine/Core/Game';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { logger } from '../engine/Systems/Logger';
import { createHeadlessGame } from './harness';
import { compositionDescriptor } from './fixtures/modules/composition';

const copy = <T>(value: T): T => structuredClone(value);
const installed = catalog.getInstalledModuleDescriptors();
const installedIds = installed.map(descriptor => descriptor.id);
const subsets = <T>(values: readonly T[]): T[][] => values.reduce<T[][]>(
    (sets, value) => [...sets, ...sets.map(set => [...set, value])], [[]],
);
const actualCombinations = subsets(installedIds);
afterEach(() => vi.restoreAllMocks());

function initialCommands(registry: ExtensionRegistry, ids: readonly string[]): string[] {
    return registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
}
function open(ids: readonly string[], seed = 7201): Game {
    const registry = catalog.createExtensionRegistry();
    const commands = initialCommands(registry, ids);
    const game = createHeadlessGame(seed, 'test');
    game.startNewGame({ seed, mode: 'test', ruleSet: 'extended', extensions: ids, initialCommands: commands });
    game.animationEnabled = false;
    expect(game.extensionRuntime!.manifest).toEqual(registry.manifest(ids));
    expect(game.recordedInputEvents.slice(0, commands.length).map(event => event.data)).toEqual(commands);
    return game;
}
function acknowledge(): void {
    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
}
function play(game: Game, turns = 3): void {
    for (let index = 0; index < turns; index++) {
        acknowledge();
        const previous = game.absoluteTurnNumber;
        game.executeCommand('wait');
        expect(game.absoluteTurnNumber).toBeGreaterThan(previous);
    }
}
function checkpoint(game: Game) {
    return { tick: timeSystem.currentTick, turn: game.absoluteTurnNumber, depth: game.depth,
        player: { ...game.player.loc }, rng: rng.getState(), extensions: game.extensionRuntime!.snapshot() };
}
function eventCheckpoint(event: RecordedInputEvent) {
    return { tick: event.tick, turn: event.turn, depth: event.depth, player: event.player,
        rng: event.rng, extensions: event.extensions };
}
function replayEveryCheckpoint(game: Game, recording: GameRecording): void {
    expect(game.loadReplay(copy(recording))).toBe(true);
    game.animationEnabled = false;
    for (const event of recording.events) {
        game.replayStep(true);
        expect(game.replayError).toBeNull();
        expect(game.replayCursor).toBe(event.index + 1);
        expect(checkpoint(game)).toEqual(eventCheckpoint(event));
    }
    expect(game.replayStatus).toBe('finished');
}

/** Real Game path, reused for each discovered set and synthetic combinations. */
function verifyRoundTrip(ids: readonly string[]): void {
    const game = open(ids);
    const origin = copy(game.toSaveSnapshot().run.recordingOrigin!.initial);
    play(game);
    const expected = checkpoint(game), saved = copy(game.toSaveSnapshot()), recording = copy(game.exportRecording());
    expect(Object.keys(saved.extensions!.modules).sort()).toEqual([...ids].sort());
    expect(saved.extensions!.manifest).toEqual(recording.extensions);
    expect(saved.run.recordingOrigin).toBeDefined();
    expect(recording.events.length).toBeGreaterThanOrEqual(3);
    for (const event of recording.events) expect(event.extensions!.manifest).toEqual(recording.extensions);

    const loaded = createHeadlessGame(81, 'test');
    expect(loaded.loadSnapshot(saved)).toBe(true);
    loaded.animationEnabled = false;
    expect(checkpoint(loaded)).toEqual(expected);
    expect(loaded.hasCompleteRecording).toBe(true);
    expect(loaded.exportRecording().events).toEqual(recording.events);
    play(loaded, 2);
    const continuation = copy(loaded.exportRecording()), continued = checkpoint(loaded);
    expect(continuation.events.slice(0, recording.events.length)).toEqual(recording.events);
    expect(continuation.events.length).toBe(recording.events.length + 2);

    const replay = createHeadlessGame(82, 'test');
    replayEveryCheckpoint(replay, recording);
    expect(checkpoint(replay)).toEqual(expected);
    for (const index of [0, 1, Math.floor(recording.events.length / 2), recording.events.length]) {
        replay.replaySeek(index);
        expect(replay.replayError).toBeNull();
        expect(replay.replayCursor).toBe(index);
        expect(checkpoint(replay)).toEqual(index === 0 ? origin : eventCheckpoint(recording.events[index - 1]!));
    }
    replayEveryCheckpoint(replay, continuation);
    expect(checkpoint(replay)).toEqual(continued);
}

function fixtureRegistry(descriptors: readonly ModuleDescriptor[]) {
    const registry = catalog.createExtensionRegistry(descriptors);
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
    return registry;
}
function assertCurrentRun(game: Game, current: { player: Game['player']; runtime: Game['extensionRuntime']; rng: ReturnType<typeof rng.getState>; turn: number }): void {
    expect(game.player).toBe(current.player);
    expect(game.extensionRuntime).toBe(current.runtime);
    expect(rng.getState()).toEqual(current.rng);
    expect(game.absoluteTurnNumber).toBe(current.turn);
}

describe('EXT-2a0 installed module combinations', () => {
    it('derives every subset and defaults solely from this build’s installed descriptors', () => {
        expect(new Set(actualCombinations.map(ids => JSON.stringify(ids))).size).toBe(2 ** installed.length);
        expect(actualCombinations).toContainEqual([]);
        expect(actualCombinations).toContainEqual(installedIds);
        expect(installedIds).toEqual([...installedIds].sort());
        expect(catalog.DEFAULT_EXTENSIONS).toEqual(installed.filter(descriptor => descriptor.defaultEnabled).map(descriptor => descriptor.id));
    });
    for (const ids of actualCombinations) {
        it(`opens, plays, saves, loads, replays, seeks and continues ${ids.length ? ids.join('+') : '(empty)'}`, () => {
            verifyRoundTrip(ids);
        }, 30000);
    }
    it('accepts an arbitrary initializing descriptor alongside all discovered gameplay modules', () => {
        fixtureRegistry([...installed, compositionDescriptor('alpha', { initialize: true })]);
        verifyRoundTrip(['alpha', ...installedIds]);
    }, 30000);
});

describe('EXT-2a0 descriptor contract', () => {
    it('sorts and freezes detached declarations without executing factories or taking RNG', () => {
        const alpha = compositionDescriptor('alpha'), beta = compositionDescriptor('beta');
        const alphaFactory = vi.fn(alpha.create), betaFactory = vi.fn(beta.create);
        const before = rng.getState();
        const result = validateModuleDescriptors([{ ...beta, create: betaFactory }, { ...alpha, create: alphaFactory }]);
        expect(result.map(descriptor => descriptor.id)).toEqual(['alpha', 'beta']);
        expect(Object.isFrozen(result)).toBe(true);
        for (const descriptor of result) {
            expect(Object.isFrozen(descriptor)).toBe(true);
            expect(Object.isFrozen(descriptor.rules)).toBe(true);
            expect(Object.isFrozen(descriptor.locales)).toBe(true);
            expect(Object.isFrozen(descriptor.locales!.en)).toBe(true);
        }
        alpha.rules!.fingerprint = `sha256:${'f'.repeat(64)}`;
        expect(result[0]!.rules!.fingerprint).toBe(`sha256:${'a'.repeat(64)}`);
        catalog.createExtensionRegistry(result).manifest(['beta', 'alpha']);
        expect(alphaFactory).not.toHaveBeenCalled();
        expect(betaFactory).not.toHaveBeenCalled();
        expect(rng.getState()).toEqual(before);
    });
    it('rejects duplicate identities, invalid declarations and unsupported foundation before factories run', () => {
        const descriptor = compositionDescriptor('alpha'), factory = vi.fn(descriptor.create);
        const good = { ...descriptor, create: factory };
        expect(() => validateModuleDescriptors([good, good])).toThrow();
        for (const patch of [
            { id: '../alpha' }, { version: 'next' }, { foundation: 2 }, { create: null },
            { labelKey: '' }, { labelKey: 'ext.beta.name' }, { defaultEnabled: 'yes' },
            { locales: { en: { 'ext.beta.name': 'Other owner' } } },
            { rules: { ...good.rules!, version: '9.0.0' } },
            { rules: { ...good.rules!, fingerprint: 'sha256:invalid' } },
        ]) expect(() => validateModuleDescriptors([{ ...good, ...patch } as unknown as ModuleDescriptor])).toThrow();
        expect(factory).not.toHaveBeenCalled();
    });
    it('rejects descriptor-created cross-module dependencies and factory identity substitution', () => {
        const alpha = compositionDescriptor('alpha'), beta = compositionDescriptor('beta');
        const dependent = { ...alpha, create: () => ({ ...alpha.create(), dependencies: ['beta'] }) };
        const registry = catalog.createExtensionRegistry([beta, dependent]);
        expect(() => registry.create(registry.manifest(['alpha', 'beta']))).toThrow();
        const substitute = catalog.createExtensionRegistry([{ ...alpha, create: () => beta.create() }]);
        expect(() => substitute.create(substitute.manifest(['alpha']))).toThrow('identity');
    });
});

describe('EXT-2a0 foundation-owned composition fixtures', () => {
    for (const ids of subsets(['alpha', 'beta'])) {
        it(`keeps unselected factories dormant and roundtrips ${ids.length ? ids.join('+') : '(empty)'}`, () => {
            const alpha = compositionDescriptor('alpha', { initialize: true }), beta = compositionDescriptor('beta');
            const factories = { alpha: vi.fn(alpha.create), beta: vi.fn(beta.create) };
            fixtureRegistry([{ ...beta, create: factories.beta }, { ...alpha, create: factories.alpha }]);
            verifyRoundTrip(ids);
            for (const [id, factory] of Object.entries(factories)) {
                if (ids.includes(id)) expect(factory).toHaveBeenCalled();
                else expect(factory).not.toHaveBeenCalled();
            }
        }, 30000);
    }
    it('makes declaration and selection permutations equivalent with stable lifecycle and command order', () => {
        const results: { checkpoint: ReturnType<typeof checkpoint>; events: RecordedInputEvent[]; trace: string[] }[] = [];
        for (const reverse of [false, true]) {
            vi.restoreAllMocks();
            const trace: string[] = [];
            const descriptors = ['alpha', 'beta'].map(id => compositionDescriptor(id, { initialize: true, trace }));
            fixtureRegistry(reverse ? [...descriptors].reverse() : descriptors);
            const game = open(reverse ? ['beta', 'alpha'] : ['alpha', 'beta']);
            expect(trace).toEqual(['new:alpha', 'new:beta', 'initialize:alpha', 'initialize:beta']);
            play(game, 1);
            results.push({ checkpoint: checkpoint(game), events: copy(game.exportRecording().events), trace: [...trace] });
        }
        expect(results[0]).toEqual(results[1]);
    });
    it('isolates same-named components and rejects non-selected commands without recording or RNG changes', () => {
        fixtureRegistry(['alpha', 'beta'].map(id => compositionDescriptor(id)));
        const game = open(['alpha', 'beta']);
        for (const id of ['alpha', 'beta']) game.executeCommand('ext:command', JSON.stringify({ module: id, action: 'pulse', payload: null }));
        expect(game.extensionRuntime!.snapshot().components[String(game.player.id)]).toEqual({
            'alpha:counter': { value: 1 }, 'beta:counter': { value: 1 },
        });
        const selected = open(['alpha']);
        const before = checkpoint(selected), events = copy(selected.recordedInputEvents);
        for (const id of ['beta', 'absent']) {
            selected.executeCommand('ext:command', JSON.stringify({ module: id, action: 'pulse', payload: null }));
            expect(checkpoint(selected)).toEqual(before);
            expect(selected.recordedInputEvents).toEqual(events);
        }
    });
    it('rejects incomplete, reordered or invalid initialization before retiring the previous run', () => {
        const descriptors = ['alpha', 'beta'].map(id => compositionDescriptor(id, { initialize: true }));
        const registry = fixtureRegistry(descriptors), game = open(['alpha', 'beta']);
        const commands = initialCommands(registry, ['alpha', 'beta']);
        const current = { player: game.player, runtime: game.extensionRuntime, rng: rng.getState(), turn: game.absoluteTurnNumber };
        const unload = vi.spyOn(current.runtime!, 'unload');
        for (const invalid of [[], commands.slice(0, 1), [...commands].reverse(), [commands[0]!, commands[0]!], ['{}', commands[1]!]]) {
            expect(() => game.startNewGame({ seed: 18, mode: 'test', ruleSet: 'extended', extensions: ['beta', 'alpha'], initialCommands: invalid })).toThrow('creation');
            assertCurrentRun(game, current);
        }
        expect(unload).not.toHaveBeenCalled();
    });
    it('rejects missing, reordered and repeated initialization in recordings before replacing the old run', () => {
        fixtureRegistry(['alpha', 'beta'].map(id => compositionDescriptor(id, { initialize: true })));
        const game = open(['alpha', 'beta']);
        play(game, 1);
        const recording = copy(game.exportRecording());
        const current = { player: game.player, runtime: game.extensionRuntime, rng: rng.getState(), turn: game.absoluteTurnNumber };
        const unload = vi.spyOn(current.runtime!, 'unload');
        const variants = [
            recording.events.slice(1),
            [recording.events[1]!, recording.events[0]!, ...recording.events.slice(2)],
            [...recording.events, recording.events[0]!],
        ];
        for (const events of variants) {
            const invalid = { ...copy(recording), events: copy(events).map((event, index) => ({ ...event, index })) };
            expect(game.loadReplay(invalid)).toBe(false);
            assertCurrentRun(game, current);
        }
        expect(unload).not.toHaveBeenCalled();
    });
    it('recognizes malformed later initializers independently of payload validity before retiring the old run', () => {
        const descriptor = compositionDescriptor('alpha', { initialize: true });
        // No module-specific recording validator may hide a foundation recognition regression.
        expect(descriptor.create().validateRecording).toBeUndefined();
        fixtureRegistry([descriptor]);
        const game = open(['alpha']);
        play(game, 1);
        const saved = copy(game.toSaveSnapshot()), recording = copy(game.exportRecording());
        expect(saved.run.recordingOrigin).toBeDefined();
        expect(game.hasCompleteRecording).toBe(true);
        expect(saved.run.recordedInputEvents).toEqual(recording.events);
        expect(game.extensionRuntime!.validateRecording(recording.events)).toBe(true);
        const current = { player: game.player, runtime: game.extensionRuntime, rng: rng.getState(), turn: game.absoluteTurnNumber };
        const unload = vi.spyOn(current.runtime!, 'unload');
        const malformed = [
            { module: 'alpha', action: 'initialize', payload: { revision: 999 } },
            { module: 'alpha', action: 'initialize', payload: null },
            { module: 'alpha', action: 'initialize' },
            { module: 'alpha', action: 'initialize', payload: { revision: 1, extra: true } },
            { module: 'alpha', action: 'initialize', payload: { revision: 1 }, extra: true },
        ];
        for (const input of malformed) {
            expect(current.runtime!.isInitialCommand('ext:command', JSON.stringify(input))).toBe(false);
            const invalid = copy(recording);
            invalid.events.push({ ...copy(recording.events[recording.events.length - 1]!),
                index: recording.events.length, action: 'ext:command', data: JSON.stringify(input) });
            expect(current.runtime!.validateRecording(invalid.events)).toBe(false);
            expect(game.loadReplay(invalid)).toBe(false);
            assertCurrentRun(game, current);
            expect(game.recordedInputEvents).toEqual(recording.events);
        }
        expect(unload).not.toHaveBeenCalled();
    });
    it('rejects missing modules, precise version/data/foundation mismatches and foreign namespaces before old-run retirement', () => {
        const alpha = compositionDescriptor('alpha'), beta = compositionDescriptor('beta');
        fixtureRegistry([alpha, beta]);
        const game = open(['alpha', 'beta']);
        play(game, 1);
        const saved = copy(game.toSaveSnapshot()), recording = copy(game.exportRecording());
        const current = { player: game.player, runtime: game.extensionRuntime, rng: rng.getState(), turn: game.absoluteTurnNumber };
        const unload = vi.spyOn(current.runtime!, 'unload');
        const mutations: ((manifest: ExtensionManifest) => void)[] = [
            manifest => { manifest.modules[0]!.version = '9.0.0'; },
            manifest => { manifest.modules[0]!.rules!.fingerprint = `sha256:${'f'.repeat(64)}`; },
            manifest => { delete manifest.modules[0]!.rules; },
            manifest => { delete manifest.foundation; },
        ];
        for (const mutate of mutations) {
            const invalidSave = copy(saved), invalidRecording = copy(recording);
            mutate(invalidSave.extensions!.manifest); mutate(invalidRecording.extensions!);
            expect(game.loadSnapshot(invalidSave)).toBe(false);
            assertCurrentRun(game, current);
            expect(game.loadReplay(invalidRecording)).toBe(false);
            assertCurrentRun(game, current);
        }
        const foreignSave = copy(saved), foreignRecording = copy(recording);
        foreignSave.extensions!.components[String(game.player.id)]!['missing:counter'] = { value: 1 };
        foreignRecording.events[0]!.extensions!.components[String(game.player.id)]!['missing:counter'] = { value: 1 };
        expect(game.loadSnapshot(foreignSave)).toBe(false);
        expect(game.loadReplay(foreignRecording)).toBe(false);
        assertCurrentRun(game, current);
        // Physical-removal equivalent: exact old manifests cannot silently drop the missing package.
        const remaining = new ExtensionRegistry(); remaining.register(alpha.id, alpha.version, alpha.create, alpha.rules);
        vi.mocked(catalog.createExtensionRegistry).mockReturnValue(remaining);
        expect(game.loadSnapshot(saved)).toBe(false);
        expect(game.loadReplay(recording)).toBe(false);
        expect(() => game.startNewGame({ seed: 19, mode: 'test', ruleSet: 'extended', extensions: ['beta'] })).toThrow('Unavailable');
        assertCurrentRun(game, current);
        expect(unload).not.toHaveBeenCalled();
    });
});
