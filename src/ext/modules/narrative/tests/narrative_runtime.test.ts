import { afterEach, describe, expect, it, vi } from 'vitest';
import { descriptor } from '../descriptor';
import { createNarrativeModule } from '../index';
import { createNarrativeModuleFromPack } from '../module';
import { loadNarrativePack } from '../schema';
import rawPack from '../data/definitions.json';
import portraits from '../data/portraits.json';
import locale from '../locales/zh_CN.json';
import { loadNarrativeDefinitionPack, getNarrativePackIdentity, NARRATIVE_VERSION } from '../definitions';
import { ExtensionRuntime, type ExtensionPorts } from '../../../runtime';
import { registryFromDescriptors } from '../../../descriptor';
import * as catalog from '../../../catalog';
import { createHeadlessGame } from '../../../../test/harness';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import type { Game } from '../../../../engine/Core/Game';
import type { Json } from '../../../types';

const clone = <T>(value: T): T => structuredClone(value);
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
function start(ids: string[], seed = 8201): Game {
    const game = createHeadlessGame(seed, 'test');
    const registry = catalog.createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    game.startNewGame({ seed, mode: 'test', ruleSet: 'extended', extensions: ids, initialCommands });
    game.animationEnabled = false;
    return game;
}
function play(game: Game): void { acknowledge(); game.executeCommand('wait'); }
function checkpoint(game: Game) {
    const snap = game.toSnapshot();
    return { turn: snap.run.absoluteTurnNumber, tick: snap.run.currentTick, depth: snap.depth,
        player: snap.player, rng: snap.rngState, extensions: snap.extensions };
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-2a1 narrative installed contract', () => {
    it('owns a precise data/input/state identity and opts in without a creation command, UI, or growth dependency', () => {
        const before = rng.getState(), module = createNarrativeModule(), pack = loadNarrativeDefinitionPack();
        expect(module.id).toBe('narrative');
        expect(module.version).toBe(NARRATIVE_VERSION);
        expect(module.rules).toEqual(getNarrativePackIdentity());
        expect(pack.inputVersion).toBe(1);
        expect(pack.stateVersion).toBe(1);
        expect(descriptor.defaultEnabled).toBe(false);
        expect(module.dependencies).toBeUndefined();
        expect(module.initialCommand).toBeUndefined();
        expect(module.commands).toBeUndefined();
        expect(module.hooks).toBeUndefined();
        expect(module.view).toBeUndefined();
        expect(module.optionalQueries).toBeUndefined();
        expect(module.validateState(module.initialState())).toBe(true);
        expect(rng.getState()).toEqual(before);
    });

    it('derives identities from the validated mechanical package and refuses a cast mutable lookalike', () => {
        const pack = loadNarrativeDefinitionPack();
        expect(() => createNarrativeModuleFromPack(clone(pack))).toThrow();
        const changed = clone(rawPack); changed.flags[0]!.initial = true;
        const changedModule = createNarrativeModuleFromPack(loadNarrativePack(changed, portraits, locale));
        expect(changedModule.rules!.fingerprint).not.toBe(getNarrativePackIdentity().fingerprint);
        const display = clone(portraits); display.displayVersion = '1.1.0'; display.portraits[0]!.width = 480;
        const displayModule = createNarrativeModuleFromPack(loadNarrativePack(rawPack, display, locale));
        expect(displayModule.rules).toEqual(getNarrativePackIdentity());
    });

    it('instantiates alone, detached from all world/RNG ports, and owns no creature components', () => {
        const services: ExtensionPorts = { depth: () => 1, playerId: () => 1,
            randomInt: vi.fn(() => { throw new Error('unexpected RNG'); }), message: vi.fn() };
        const registry = registryFromDescriptors([descriptor]);
        const runtime = new ExtensionRuntime(registry, registry.manifest(['narrative']), services);
        const before = runtime.snapshot();
        runtime.newGame(); runtime.loaded();
        runtime.emit('enteredLevel', { depth: 1, firstVisit: true });
        runtime.emit('playerTurnEnded', { turn: 1 });
        expect(runtime.snapshot()).toEqual(before);
        expect(Object.keys(before.modules)).toEqual(['narrative']);
        expect(before.components).toEqual({});
        expect(services.randomInt).not.toHaveBeenCalled();
        expect(services.message).not.toHaveBeenCalled();
        runtime.unload();
    });

    it('keeps narrative-only save/load, every replay checkpoint, seek and continued recording deterministic', () => {
        const game = start(['narrative']);
        const origin = clone(game.toSaveSnapshot().run.recordingOrigin!.initial);
        play(game); play(game);
        const saved = clone(game.toSaveSnapshot()), expected = checkpoint(game), recording = clone(game.exportRecording());
        expect(Object.keys(saved.extensions!.modules)).toEqual(['narrative']);
        expect(Object.keys(saved.extensions!.components)).toHaveLength(0);
        expect(game.loadSnapshot(saved)).toBe(true);
        game.animationEnabled = false;
        expect(checkpoint(game)).toEqual(expected);
        expect(game.hasCompleteRecording).toBe(true);
        play(game);
        const continuation = clone(game.exportRecording()), continued = checkpoint(game);
        expect(continuation.events.slice(0, recording.events.length)).toEqual(recording.events);
        expect(game.loadReplay(continuation)).toBe(true);
        game.animationEnabled = false;
        for (const event of continuation.events) {
            game.replayStep(true);
            expect(game.replayError).toBeNull();
            const snapshot = game.toSnapshot();
            expect(snapshot.rngState).toEqual(event.rng);
            expect(snapshot.extensions).toEqual(event.extensions);
            expect(snapshot.run.absoluteTurnNumber).toBe(event.turn);
            expect(snapshot.run.currentTick).toBe(event.tick);
        }
        expect(checkpoint(game)).toEqual(continued);
        for (const index of [0, 1, continuation.events.length]) {
            game.replaySeek(index);
            expect(game.replayError).toBeNull();
            expect(game.replayCursor).toBe(index);
            const target = index ? continuation.events[index - 1]! : origin;
            expect(game.toSnapshot().rngState).toEqual(target.rng);
            expect(game.extensionRuntime!.snapshot()).toEqual(target.extensions);
        }
    }, 30000);

    it('rejects malformed state and every not-yet-implemented narrative player command before retiring or recording', () => {
        const game = start(['narrative']); play(game);
        const saved = clone(game.toSaveSnapshot()), recording = clone(game.exportRecording());
        const player = game.player, runtime = game.extensionRuntime, before = checkpoint(game);
        for (const state of [null, {}, { schema: 2 }, { ...(saved.extensions!.modules.narrative as object), extra: true },
            { ...(saved.extensions!.modules.narrative as object), revision: Number.MAX_SAFE_INTEGER + 1 }]) {
            const malformed = clone(saved);
            malformed.extensions!.modules.narrative = state as Json;
            expect(game.loadSnapshot(malformed)).toBe(false);
            expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
            expect(checkpoint(game)).toEqual(before);
        }
        const payloads = [
            { action: 'open', payload: { v: 1, revision: 0, targetEntityId: 1 } },
            { action: 'choose', payload: { v: 0, revision: 0, sessionId: 1, nodeId: 'hello', choiceId: 'read-note' } },
            { action: 'close', payload: { v: 1, revision: 0, sessionId: 1 } },
            { action: 'toString', payload: {} },
        ];
        for (const input of payloads) {
            acknowledge();
            const data = JSON.stringify({ module: 'narrative', ...input });
            game.executeCommand('ext:command', data);
            expect(game.exportRecording().events).toEqual(recording.events);
            expect(checkpoint(game)).toEqual(before);
            const badRecording = clone(recording);
            badRecording.events[0]!.action = 'ext:command'; badRecording.events[0]!.data = data;
            expect(game.loadReplay(badRecording)).toBe(false);
            expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
            expect(checkpoint(game)).toEqual(before);
        }
    }, 30000);

    it('never creates narrative state when disabled and introduces no simulation/RNG work in this kernel-only release', () => {
        const disabled = start([]); play(disabled); play(disabled);
        const empty = checkpoint(disabled);
        expect(empty.extensions!.modules).toEqual({});
        const enabled = start(['narrative']); play(enabled); play(enabled);
        const withNarrative = checkpoint(enabled);
        expect(withNarrative.rng).toEqual(empty.rng);
        expect(withNarrative.player).toEqual(empty.player);
        expect(withNarrative.turn).toEqual(empty.turn);
        expect(withNarrative.tick).toEqual(empty.tick);
        expect(withNarrative.extensions!.modules.narrative).toEqual(createNarrativeModule().initialState());
    }, 30000);
});
