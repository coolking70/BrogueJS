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
import type { NarrativeState } from '../state';

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

describe('EXT-2b narrative installed contract', () => {
    it('owns a precise data/input/state identity and opts in without a creation command or growth dependency', () => {
        const before = rng.getState(), module = createNarrativeModule(), pack = loadNarrativeDefinitionPack();
        expect(module.id).toBe('narrative');
        expect(module.version).toBe(NARRATIVE_VERSION);
        expect(module.rules).toEqual(getNarrativePackIdentity());
        expect(pack.inputVersion).toBe(2);
        expect(pack.stateVersion).toBe(2);
        expect(descriptor.defaultEnabled).toBe(false);
        expect(module.dependencies).toBeUndefined();
        expect(module.initialCommand).toBeUndefined();
        expect(Object.keys(module.commands!)).toEqual(['open', 'choose', 'close']);
        expect(Object.keys(module.hooks!)).toEqual(['enteredLevel', 'interactionClosed', 'interactablesRemoved']);
        expect(module.projectView).toBeTypeOf('function');
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

    it('uses only the committed foundation world port and owns no creature components', () => {
        const services: ExtensionPorts = { depth: () => 1, playerId: () => 1,
            randomInt: vi.fn(() => { throw new Error('unexpected RNG'); }), message: vi.fn(),
            interactableCandidates: () => [{ x: 2, y: 2 }], isInteractableVisible: () => true, canInteractWith: () => true };
        const registry = registryFromDescriptors([descriptor]);
        const runtime = new ExtensionRuntime(registry, registry.manifest(['narrative']), services);
        const before = runtime.snapshot();
        runtime.newGame(); runtime.loaded(); expect(runtime.snapshot()).toEqual(before);
        const token = runtime.beginGeneration('first-level');
        runtime.emit('enteredLevel', { depth: 1, firstVisit: true }); runtime.commitGeneration(token);
        const placed = runtime.snapshot(); runtime.emit('playerTurnEnded', { turn: 1 });
        expect(runtime.snapshot()).toEqual(placed); expect(placed.foundation.world.entities).toHaveLength(1);
        expect(Object.keys(before.modules)).toEqual(['narrative']);
        expect(before.components).toEqual({});
        expect(services.randomInt).not.toHaveBeenCalled();
        expect(services.message).not.toHaveBeenCalled();
        runtime.unload();
    });

    it('rejects an over-budget complete preview pack before retiring an existing run', () => {
        const game = start(['narrative']); const player = game.player, runtime = game.extensionRuntime, before = checkpoint(game);
        const invalid = clone(rawPack); invalid.config.limits.conditionOpsPerCommand = 1;
        const registry = registryFromDescriptors([{ ...descriptor, create: () => createNarrativeModuleFromPack(loadNarrativePack(invalid, portraits, locale)) }]);
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        expect(() => game.startNewGame({ seed: 123, mode: 'test', ruleSet: 'extended', extensions: ['narrative'] })).toThrow('CONDITION_LIMIT');
        expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); expect(checkpoint(game)).toEqual(before);
    });
    it('rejects a foundation-incompatible localized NPC key before retiring an existing run', () => {
        const game = start(['narrative']); const player = game.player, runtime = game.extensionRuntime, before = checkpoint(game);
        const invalid = clone(rawPack), key = 'ext.narrative.' + 'x'.repeat(257 - 'ext.narrative.'.length);
        invalid.npcs[0]!.nameKey = key;
        const registry = registryFromDescriptors([{ ...descriptor, create: () => createNarrativeModuleFromPack(loadNarrativePack(invalid, portraits, { ...locale, [key]: '名称' })) }]);
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        expect(() => game.startNewGame({ seed: 123, mode: 'test', ruleSet: 'extended', extensions: ['narrative'] })).toThrow('INVALID_TEXT');
        expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); expect(checkpoint(game)).toEqual(before);
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

    it('rejects malformed state and old-version and malformed narrative player commands before retiring or recording', () => {
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

    it('never creates narrative state when disabled and keeps post-generation placement free of simulation/RNG work', () => {
        const disabled = start([]); play(disabled); play(disabled);
        const empty = checkpoint(disabled);
        expect(empty.extensions!.modules).toEqual({});
        const enabled = start(['narrative']); play(enabled); play(enabled);
        const withNarrative = checkpoint(enabled);
        expect(withNarrative.rng).toEqual(empty.rng);
        expect(withNarrative.player).toEqual(empty.player);
        expect(withNarrative.turn).toEqual(empty.turn);
        expect(withNarrative.tick).toEqual(empty.tick);
        const state = withNarrative.extensions!.modules.narrative as unknown as { placementReceipts: unknown[]; npcBindings: object; active: null };
        expect(state.placementReceipts).toHaveLength(1);
        expect(Object.keys(state.npcBindings)).toHaveLength(1);
        expect(state.active).toBeNull();
    }, 30000);
});


const installedIds = catalog.getInstalledModuleDescriptors().map(descriptor => descriptor.id);
const conversationCombinations = [['narrative'], ...(installedIds.includes('growth') ? [['growth', 'narrative']] : [])];
function narrative(game: Game): NarrativeState { return game.extensionRuntime!.snapshot().modules.narrative as unknown as NarrativeState; }
function dialogueCommand(game: Game, action: string, fields: object): string {
    const data = JSON.stringify({ module: 'narrative', action, payload: { v: 2, revision: narrative(game).revision, ...fields } });
    acknowledge(); game.executeCommand('ext:command', data); return data;
}
function frozenWorld(game: Game) {
    const snapshot = game.toSnapshot();
    const otherModules = { ...snapshot.extensions!.modules }; delete otherModules.narrative;
    return { turn: snapshot.run.absoluteTurnNumber, tick: snapshot.run.currentTick, rng: snapshot.rngState, player: snapshot.player,
        monsters: snapshot.monsters, components: snapshot.extensions!.components, otherModules };
}
describe.each(conversationCombinations)('EXT-2b actual Game dialogue with %j', (...ids: string[]) => {
    it('uses a natural nearby NPC and freezes resources while preserving active-save, continuation, replay and seek checkpoints', () => {
        const game = start(ids, 8201); acknowledge();
        const target = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.owner === 'narrative')!;
        expect(target).toBeDefined();
        expect(Math.max(Math.abs(target.x - game.player.x), Math.abs(target.y - game.player.y))).toBeLessThanOrEqual(target.interactionDistance);
        const stable = frozenWorld(game), origin = clone(game.toSaveSnapshot().run.recordingOrigin!.initial);
        const count = () => game.exportRecording().events.length;
        const firstOpen = dialogueCommand(game, 'open', { targetEntityId: target.id });
        expect(narrative(game).active?.sessionId).toBe(1); expect(frozenWorld(game)).toEqual(stable);
        const activeSave = clone(game.toSaveSnapshot()), activeCheckpoint = checkpoint(game);
        const oldView = game.extensionRuntime!.readModuleView('narrative')!;
        const openCount = count(); game.executeCommand('ext:command', firstOpen);
        game.executeCommand('wait'); game.executeCommand('move', { x: 1, y: 0 });
        game.executeItemCommand('eat', game.player.inventory.items[0]);
        expect(count()).toBe(openCount); expect(frozenWorld(game)).toEqual(stable);
        dialogueCommand(game, 'close', { sessionId: 1 });
        dialogueCommand(game, 'open', { targetEntityId: target.id });
        dialogueCommand(game, 'choose', { sessionId: 2, nodeId: 'hello', choiceId: 'read-note' });
        expect(narrative(game).active).toBeNull(); expect(narrative(game).rewardReceipts).toHaveLength(1);
        const afterChoice = clone(game.toSaveSnapshot()), afterChoiceCheckpoint = checkpoint(game);
        expect(game.loadSnapshot(afterChoice)).toBe(true); game.animationEnabled = false;
        expect(checkpoint(game)).toEqual(afterChoiceCheckpoint); expect(frozenWorld(game)).toEqual(stable);
        dialogueCommand(game, 'open', { targetEntityId: target.id }); const beforeDuplicate = count();
        dialogueCommand(game, 'choose', { sessionId: 3, nodeId: 'hello', choiceId: 'read-note' });
        expect(count()).toBe(beforeDuplicate); expect(narrative(game).rewardReceipts).toHaveLength(1);
        dialogueCommand(game, 'close', { sessionId: 3 }); expect(frozenWorld(game)).toEqual(stable); play(game);
        expect(game.hasCompleteRecording).toBe(true);
        expect(game.loadSnapshot(activeSave)).toBe(true); game.animationEnabled = false;
        expect(checkpoint(game)).toEqual(activeCheckpoint);
        expect(game.extensionRuntime!.readModuleView('narrative')!.session).not.toBe(oldView.session);
        const afterLoad = frozenWorld(game);
        dialogueCommand(game, 'choose', { sessionId: 1, nodeId: 'hello', choiceId: 'read-note' });
        dialogueCommand(game, 'open', { targetEntityId: target.id });
        dialogueCommand(game, 'close', { sessionId: 2 }); expect(frozenWorld(game)).toEqual(afterLoad);
        play(game);
        const recording = clone(game.exportRecording()), terminal = checkpoint(game);
        expect(game.hasCompleteRecording).toBe(true); expect(game.loadReplay(recording)).toBe(true); game.animationEnabled = false;
        for (const event of recording.events) {
            game.replayStep(true); expect(game.replayError).toBeNull();
            const actual = game.toSnapshot(); expect(actual.extensions).toEqual(event.extensions);
            expect(actual.rngState).toEqual(event.rng); expect(actual.run.absoluteTurnNumber).toBe(event.turn); expect(actual.run.currentTick).toBe(event.tick);
        }
        expect(checkpoint(game)).toEqual(terminal);
        const activeIndex = recording.events.findIndex(event => event.action === 'ext:command' && String(event.data).includes('"action":"open"')) + 1;
        for (const index of [0, activeIndex, activeIndex + 1, recording.events.length]) {
            game.replaySeek(index); expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(index);
            const targetCheckpoint = index ? recording.events[index - 1]! : origin;
            expect(game.extensionRuntime!.snapshot()).toEqual(targetCheckpoint.extensions); expect(game.toSnapshot().rngState).toEqual(targetCheckpoint.rng);
        }
    }, 30000);
    it('rejects damaged active saves and recordings without retiring or mutating the live run', () => {
        const game = start(ids, 8201); const target = game.extensionRuntime!.snapshot().foundation.world.entities[0]!;
        dialogueCommand(game, 'open', { targetEntityId: target.id });
        const saved = clone(game.toSaveSnapshot()), recording = clone(game.exportRecording());
        const player = game.player, runtime = game.extensionRuntime, before = checkpoint(game);
        const mutations = [
            (save: typeof saved) => { const gate = save.extensions!.foundation.world.gate!; save.extensions!.foundation.world.gate = { ...gate, sessionId: gate.sessionId + 1 }; },
            (save: typeof saved) => { (save.extensions!.modules.narrative as unknown as NarrativeState).active!.targetEntityId++; },
            (save: typeof saved) => { save.extensions!.foundation.world.entities = []; },
            (save: typeof saved) => { save.extensions!.foundation.world.entities[0] = { ...save.extensions!.foundation.world.entities[0]!, owner: 'missing' }; },
            (save: typeof saved) => { save.extensions!.foundation.world.entities[0] = { ...save.extensions!.foundation.world.entities[0]!, depth: 40 }; },
            (save: typeof saved) => { save.run.nextEntityId = target.id; },
            (save: typeof saved) => { save.extensions!.foundation.world.entities[0] = { ...target, x: 0, y: 0 }; },
            (save: typeof saved) => { save.grid.find(cell => cell.x === target.x && cell.y === target.y)!.isVisible = false; },
            (save: typeof saved) => { save.extensions!.foundation.world.entities[0] = { ...target, x: save.width - 1, y: save.height - 1 }; },
        ];
        for (const mutate of mutations) {
            const bad = clone(saved); mutate(bad); expect(game.loadSnapshot(bad)).toBe(false);
            expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); expect(checkpoint(game)).toEqual(before);
        }
        for (const mutation of ['version', 'reference', 'gate']) {
            const bad = clone(recording), index = bad.events.findIndex(event => event.action === 'ext:command' && String(event.data).includes('"module":"narrative"'));
            const event = bad.events[index]!;
            if (mutation === 'gate') event.extensions!.foundation.world.gate = null;
            else { const input = JSON.parse(String(event.data)); if (mutation === 'version') input.payload.v = 1; else input.payload.targetEntityId = 999999; event.data = JSON.stringify(input); }
            expect(game.loadReplay(bad)).toBe(false); expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); expect(checkpoint(game)).toEqual(before);
        }
        dialogueCommand(game, 'close', { sessionId: 1 });
        const closed = checkpoint(game), counterfeit = clone(game.exportRecording());
        const missingOpen = clone(counterfeit);
        missingOpen.events = missingOpen.events.filter(event => event.action !== 'ext:command' || !String(event.data).includes('"action":"open"'));
        missingOpen.events.forEach((event, index) => { event.index = index; });
        expect(game.loadReplay(missingOpen)).toBe(false);
        expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); expect(checkpoint(game)).toEqual(closed);
        counterfeit.events[counterfeit.events.length - 1]!.action = 'wait';
        counterfeit.events[counterfeit.events.length - 1]!.data = null;
        expect(game.loadReplay(counterfeit)).toBe(false);
        expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); expect(checkpoint(game)).toEqual(closed);
    }, 30000);
});

function startNaturalNarrative(seed = 8201): Game {
    const game = createHeadlessGame(seed, 'normal');
    game.startNewGame({ seed, mode: 'normal', ruleSet: 'extended', extensions: ['narrative'] });
    game.animationEnabled = false;
    // The following helper-driven lifecycle probes intentionally do not claim
    // to be a normal-input recording; deterministic recordings are tested above.
    game.clearRecording();
    return game;
}
function enterWorldOnly(game: Game, depth: number): void {
    const up = depth < game.depth; game.depth = depth;
    (game as unknown as { generateDepth(up: boolean): void }).generateDepth(up);
    acknowledge();
}
describe('EXT-2b actual normal-world cache and terminal lifecycle', () => {
    it('retains the same stationary entity and placement receipt through cached-floor save/load and repeated visits', () => {
        const game = startNaturalNarrative();
        const initialWorld = clone(game.extensionRuntime!.snapshot().foundation.world.entities);
        const initialReceipts = clone(narrative(game).placementReceipts);
        expect(initialWorld).toHaveLength(1); expect(initialWorld[0]!.depth).toBe(1);
        enterWorldOnly(game, 2);
        expect(game.extensionRuntime!.snapshot().foundation.world.entities).toEqual(initialWorld);
        expect(narrative(game).placementReceipts).toEqual(initialReceipts);
        const cachedSave = clone(game.toSaveSnapshot());
        expect(cachedSave.depth).toBe(2); expect(cachedSave.levels.some(level => level.depth === 1)).toBe(true);
        expect(cachedSave.run.recordingOrigin).toBeUndefined();
        expect(game.loadSnapshot(cachedSave)).toBe(true); game.animationEnabled = false;
        expect(game.extensionRuntime!.snapshot().foundation.world.entities).toEqual(initialWorld);
        expect(narrative(game).placementReceipts).toEqual(initialReceipts);
        enterWorldOnly(game, 1); enterWorldOnly(game, 2); enterWorldOnly(game, 1);
        expect(game.extensionRuntime!.snapshot().foundation.world.entities).toEqual(initialWorld);
        expect(narrative(game).placementReceipts).toEqual(initialReceipts);
        expect(Object.keys(narrative(game).npcBindings)).toEqual([String(initialWorld[0]!.id)]);
        const revisitedSave = clone(game.toSaveSnapshot());
        expect(game.loadSnapshot(revisitedSave)).toBe(true);
        expect(game.extensionRuntime!.snapshot().foundation.world.entities).toEqual(initialWorld);
        expect(game.hasCompleteRecording).toBe(false);
    }, 30000);
    it('closes an actual active session on terminal state while keeping its NPC for terminal save/load inspection', () => {
        const game = startNaturalNarrative(); acknowledge();
        const target = game.extensionRuntime!.snapshot().foundation.world.entities[0]!;
        expect(Math.max(Math.abs(target.x - game.player.x), Math.abs(target.y - game.player.y))).toBeLessThanOrEqual(target.interactionDistance);
        dialogueCommand(game, 'open', { targetEntityId: target.id });
        expect(narrative(game).active).not.toBeNull(); expect(game.interactionActive).toBe(true);
        const before = narrative(game), entities = clone(game.extensionRuntime!.snapshot().foundation.world.entities);
        game.triggerGameOver(false, 'lifecycle fixture');
        expect(game.isGameOver).toBe(true); expect(game.interactionActive).toBe(false);
        expect(narrative(game).active).toBeNull(); expect(narrative(game).revision).toBe(before.revision + 1);
        expect(narrative(game).lastFactId).toBe(before.lastFactId); expect(narrative(game).placementReceipts).toEqual(before.placementReceipts);
        expect(game.extensionRuntime!.snapshot().foundation.world.entities).toEqual(entities);
        const terminalSave = clone(game.toSaveSnapshot()), terminalState = clone(game.extensionRuntime!.snapshot());
        expect(terminalSave.extensions!.foundation.world.gate).toBeNull();
        expect(game.loadSnapshot(terminalSave)).toBe(true); game.animationEnabled = false;
        expect(game.isGameOver).toBe(true); expect(game.interactionActive).toBe(false);
        expect(game.extensionRuntime!.snapshot()).toEqual(terminalState);
        expect(game.hasCompleteRecording).toBe(false);
    }, 30000);
});
