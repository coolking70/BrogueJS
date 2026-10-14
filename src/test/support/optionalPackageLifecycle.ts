import { expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { createHeadlessGame } from '../harness';
import { createExtensionRegistry } from '../../ext/catalog';
import type { Game, GameRecording, GameSnapshot } from '../../engine/Core/Game';
import { logger } from '../../engine/Systems/Logger';
import { rng } from '../../engine/Random';
import { getNextEntityId } from '../../entities/Creature';
import { installedOptionalModules } from './installedExtensions';
import { continuingPrefix } from './recordingV4';

export const integrationPackages = ['narrative', 'growth', 'combat', 'giants', 'crafting', 'foraging', 'settlement'];
export const missingPackages = (ids: readonly string[]) => ids.filter(id => !installedOptionalModules(ids).includes(id));
export function installedRelatedCombinations(owner: string, optional: readonly string[]) {
    const others = installedOptionalModules(optional);
    const rows = [[], [owner], ...others.map(id => [owner, id]), [owner, ...others]];
    return rows.filter((ids, index) => rows.findIndex(row => JSON.stringify(row) === JSON.stringify(ids)) === index);
}
const copy = <T>(value: T): T => structuredClone(value);
const settle = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
const world = (game: Game) => { const snapshot = copy(game.toSnapshot()); snapshot.savedAt = 0; return snapshot; };
// exportRecording creates a fresh wall-clock export timestamp on every call.
// All identity, origin, events, checkpoints, decisions and RNG remain compared.
const recordingState = (game: Game) => ({ ...copy(game.exportRecording()), recordedAt: 0 });
const wait = (game: Game) => {
    settle(); const index = game.recordedInputEvents.length;
    game.executeCommand('wait'); settle();
    expect(game.lastAdvancementError).toBeNull(); expect(game.recordedInputEvents).toHaveLength(index + 1);
};

/** Complete installed-world equality and genuine origin continuation. Works with
 * a named owner-side diagnostic registry too; never adds missing packages. */
export function verifyGameLifecycle(game: Game) {
    const prefix = game.recordedInputEvents.length;
    wait(game); const middle = world(game), mid = game.recordedInputEvents.length;
    wait(game); const final = world(game), saved = copy(game.toSaveSnapshot()), recording = copy(game.exportRecording());
    expect(saved.run.recordingOrigin).toBeDefined();
    expect(game.loadSnapshot(copy(saved))).toBe(true); game.animationEnabled = false;
    expect(world(game)).toEqual(final); expect(game.exportRecording().events).toEqual(recording.events);
    expect(game.loadReplay(copy(recording))).toBe(true); game.animationEnabled = false;
    const zero = world(game);
    for (const event of recording.events) {
        game.replayStep(true); expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(event.index + 1);
        expect(rng.getState()).toEqual(event.rng);
        if (event.index + 1 === mid) expect(world(game)).toEqual(middle);
    }
    expect(world(game)).toEqual(final);
    for (const [index, expected] of [[recording.events.length, final], [0, zero], [mid, middle], [recording.events.length, final]] as const) {
        game.replaySeek(index); expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(index); expect(world(game)).toEqual(expected);
    }
    expect(game.loadSnapshot(copy(saved))).toBe(true); game.animationEnabled = false; expect(world(game)).toEqual(final);
    wait(game); const continued = copy(game.exportRecording()), continuedWorld = world(game);
    expect(continued.events.slice(0, recording.events.length)).toEqual(continuingPrefix(recording));
    expect(continued.events).toHaveLength(recording.events.length + 1);
    expect(game.loadReplay(continued)).toBe(true); game.animationEnabled = false;
    for (const event of continued.events) { game.replayStep(true); expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(event.index + 1); }
    expect(world(game)).toEqual(continuedWorld);
    expect(game.loadSnapshot(copy(saved))).toBe(true); game.animationEnabled = false;
    return { prefix, events: recording.events.length, seek: [recording.events.length, 0, mid, recording.events.length], continued: continued.events.length };
}

/** A genuine seven-package save/recording captured once in the normal tree.
 * Compression only keeps the complete raw fixture below 1MB; neither manifest,
 * world nor recording events are edited to manufacture a missing dependency. */
export function rejectOriginalSevenPackageInput(game: Game) {
    const fixture = JSON.parse(readFileSync(new URL('../fixtures/modules/narrative2-combat2-seven-origin.fixture.json', import.meta.url), 'utf8'));
    const raw = gunzipSync(Buffer.from(fixture.payload, 'base64'));
    expect(raw.length).toBe(fixture.rawBytes); expect(createHash('sha256').update(raw).digest('hex')).toBe(fixture.rawSha256);
    const { save, recording } = JSON.parse(raw.toString()) as { save: GameSnapshot; recording: GameRecording };
    expect(save.extensions!.manifest).toEqual(recording.extensions);
    expect(recording.extensions!.modules.map(module => module.id).sort()).toEqual([...integrationPackages].sort());
    expect(save.run.recordingOrigin).toBeDefined(); expect(recording.events.length).toBeGreaterThanOrEqual(3);
    const missing = missingPackages(integrationPackages); expect(missing.length).toBeGreaterThan(0);
    expect(() => createExtensionRegistry().validateManifest(recording.extensions!)).toThrow(expect.objectContaining({ code: 'missing' }));
    settle(); const before = world(game), events = recordingState(game), player = game.player, runtime = game.extensionRuntime,
        random = rng.getState(), allocator = getNextEntityId(), levels = game.levels;
    for (const load of [() => game.loadSnapshot(copy(save)), () => game.loadReplay(copy(recording))]) {
        expect(load()).toBe(false); expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); expect(game.levels).toBe(levels);
        expect(world(game)).toEqual(before); expect(recordingState(game)).toEqual(events); expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(allocator);
    }
}

/** Deletion layouts execute all remaining actual packages, with ordinary public
 * inputs, full persistence/replay/seek and refusal of the original seven-pack data. */
export function verifyInstalledPackageFallback(required: readonly string[]) {
    expect(missingPackages(required).length).toBeGreaterThan(0);
    const ids = installedOptionalModules(integrationPackages), registry = createExtensionRegistry();
    expect(() => registry.manifest(required)).toThrow(/Unavailable extension:/);
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    const game = createHeadlessGame(2, 'test');
    game.startNewGame({ seed: 2, mode: 'wizard', ruleSet: 'extended', extensions: ids, initialCommands }); game.animationEnabled = false; settle();
    expect(Object.keys(game.extensionRuntime!.snapshot().modules).sort()).toEqual([...ids].sort());
    for (const id of missingPackages(integrationPackages)) expect(game.extensionRuntime!.readModuleView(id)).toBeNull();
    verifyGameLifecycle(game); rejectOriginalSevenPackageInput(game);
    return game;
}
