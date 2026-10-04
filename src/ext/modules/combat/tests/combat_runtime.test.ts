import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { descriptor } from '../descriptor';
import { createCombatModule } from '../index';
import { COMBAT_VERSION, getCombatPackIdentity, loadCombatDefinitionPack } from '../definitions';
import { attackTiming, initialCombatResources } from '../components';
import { projectCombatView } from '../view';
import { ExtensionRuntime, type ExtensionPorts } from '../../../runtime';
import { registryFromDescriptors } from '../../../descriptor';
import * as catalog from '../../../catalog';
import { getInstalledModuleUiContributions } from '../../../ui/registry';
import type { ModuleUiHost } from '../../../ui/types';
import type { ExtensionSnapshot, Json } from '../../../types';
import type { CombatAction } from '../types';
import { createHeadlessGame } from '../../../../test/harness';
import { Creature, getNextEntityId } from '../../../../entities/Creature';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import type { Game } from '../../../../engine/Core/Game';

const clone = <T>(value: T): T => structuredClone(value);
const emptyView = { schema: 1, telegraphs: [], resources: null, actions: [] };
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
    return {
        turn: snap.run.absoluteTurnNumber, tick: snap.run.currentTick, depth: snap.depth,
        player: snap.player, monsters: snap.monsters, dormantMonsters: snap.dormantMonsters,
        items: snap.items, levels: snap.levels, pendingFallenByDepth: snap.pendingFallenByDepth,
        rng: snap.rngState, extensions: snap.extensions,
    };
}
function expectNoCombatComponents(snapshot: ExtensionSnapshot): void {
    expect(Object.values(snapshot.components).flatMap(values => Object.keys(values))
        .filter(name => name.startsWith('combat:'))).toEqual([]);
}
function actionFixture(entityId: number): CombatAction {
    const pack = loadCombatDefinitionPack(), profile = pack.profiles[0]!;
    const attack = pack.attacks.find(item => item.id === profile.attackIds[0])!;
    return {
        schema: 1, actionId: 1, decisionOwnerId: entityId, timeChargeOwnerId: entityId,
        groupId: entityId, profileId: profile.id, depth: 1, paidCost: attack.cost,
        subactions: [{
            sourceSubactionId: 1,
            source: { entityId, partId: 'body', generation: 1, footprintId: 'fixture.single', pose: 'r0',
                sourceFootprintVersion: `sha256:${'0'.repeat(64)}` },
            attackId: attack.id, facing: 'n', phase: 'windup',
            phaseRemainingTicks: attackTiming(attack).releases[0]!, elapsedTicks: 0,
            nextSegmentIndex: 0, lockedCells: [{ x: 1, y: 1 }],
        }],
    };
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-3a1 inert combat installed contract', () => {
    it('discovers its opt-in descriptor, localized labels, identity and empty UI contribution', () => {
        const before = rng.getState();
        const discovered = catalog.getInstalledModuleDescriptors().find(module => module.id === 'combat')!;
        expect(discovered).toBeDefined();
        expect(discovered.defaultEnabled).toBe(false);
        expect(catalog.DEFAULT_EXTENSIONS).not.toContain('combat');
        expect(discovered.foundation).toBe(3);
        expect(discovered.version).toBe(COMBAT_VERSION);
        expect(discovered.rules).toEqual(getCombatPackIdentity());
        expect(discovered.locales!.zh_CN![discovered.labelKey]).toBeTypeOf('string');
        expect(discovered.locales!.zh_CN![discovered.descriptionKey!]).toBeTypeOf('string');
        expect(Object.keys(discovered.locales!.zh_CN!).every(key => key.startsWith('ext.combat.'))).toBe(true);
        const registry = catalog.createExtensionRegistry();
        expect(registry.manifest(['combat'])).toEqual({ schema: 1, foundation: 3,
            modules: [{ id: 'combat', version: COMBAT_VERSION, rules: getCombatPackIdentity() }] });
        expect(registry.create(registry.manifest(['combat']))).toHaveLength(1);
        const ui = getInstalledModuleUiContributions().find(entry => entry.moduleId === 'combat')!;
        expect(ui).toBeDefined();
        expect(ui.creationStep).toBeUndefined();
        expect(ui.loadCreationStep).toBeUndefined();
        if (ui.useSession) {
            const unexpected = vi.fn(() => { throw new Error('inert UI accessed engine/input capability'); });
            const host: ModuleUiHost = { game: unexpected, tick: ref(0), immersive: ref(false),
                canOpenPanel: unexpected, beforeOpenPanel: unexpected, afterClosePanel: unexpected,
                registerKeyHandler: unexpected, cancelHeldKeys: unexpected };
            const session = ui.useSession(host);
            expect(session.hud.value).toBeNull(); expect(session.bar.value).toBeNull();
            expect(session.panel.value).toBeNull(); expect(session.commands.value).toEqual([]);
            expect(session.panelOpen.value).toBe(false);
            session.refresh(); session.close();
            expect(unexpected).not.toHaveBeenCalled();
        }
        expect(rng.getState()).toEqual(before);
    });

    it('registers validators and pure projection without lifecycle, commands, providers or native resource authority', () => {
        const before = rng.getState(), module = createCombatModule();
        expect(module.id).toBe('combat'); expect(module.version).toBe(COMBAT_VERSION);
        expect(module.rules).toEqual(getCombatPackIdentity());
        expect(module.initialState()).toEqual({ schema: 1, revision: 0, nextActionId: 1 });
        expect(module.validateState(module.initialState())).toBe(true);
        expect(Object.keys(module.componentValidators!).sort()).toEqual(['action', 'resources']);
        expect(module.projectView).toBeTypeOf('function');
        for (const capability of ['dependencies', 'hooks', 'commands', 'optionalQueries', 'optionalRewards',
            'initialCommand', 'validateInitialCommand', 'onNewGame', 'onLoad', 'onUnload', 'resourceCommits',
            'rulePolicies', 'commitItemGrowth', 'prepareControlledCommand', 'worldInteractables',
            'interactionCommands', 'view', 'projectPlayerComponent'] as const) {
            expect(module[capability], capability).toBeUndefined();
        }
        const first = module.initialState() as Record<string, Json>; first.revision = 42;
        expect(module.initialState()).toEqual({ schema: 1, revision: 0, nextActionId: 1 });
        expect(rng.getState()).toEqual(before);
    });

    it('runs independently without RNG, components or resource changes through birth, load and unload', () => {
        const creature = new Creature(2, 2, 'fixture', '@', 0xffffff);
        const services: ExtensionPorts = { depth: () => 1, playerId: () => creature.id,
            randomInt: vi.fn(() => { throw new Error('unexpected RNG'); }), message: vi.fn(),
            executeAction: vi.fn(() => { throw new Error('unexpected action'); }),
            setGold: vi.fn(() => { throw new Error('unexpected resource commit'); }) };
        const registry = registryFromDescriptors([descriptor]);
        const runtime = new ExtensionRuntime(registry, registry.manifest(['combat']), services);
        const before = runtime.snapshot(), random = rng.getState();
        const native = { hp: creature.hp, maxHp: creature.maxHp, ticks: creature.ticksUntilTurn };
        runtime.newGame(); runtime.attachCreature(creature); runtime.loaded();
        runtime.emit('playerTurnEnded', { turn: 1 });
        runtime.emit('objectiveTime', { ticks: 100, mode: 'realtime', actorIds: [creature.id] });
        runtime.emit('committedAction', { actorId: creature.id, action: 'wait' });
        const token = runtime.beginGeneration('inert-combat');
        runtime.emit('enteredLevel', { depth: 1, firstVisit: true }); runtime.commitGeneration(token);
        expect(runtime.snapshot()).toEqual(before);
        expect(before.modules).toEqual({ combat: { schema: 1, revision: 0, nextActionId: 1 } });
        expect(before.components).toEqual({}); expect(before.foundation.world.entities).toEqual([]);
        expect(runtime.queryOptional('combat.public-state.v1', {})).toEqual({ status: 'unavailable', reason: 'absent' });
        runtime.unload(); runtime.unload();
        expect(creature.extensionHooks).toBeUndefined();
        expect(runtime.snapshot()).toEqual(before);
        expect({ hp: creature.hp, maxHp: creature.maxHp, ticks: creature.ticksUntilTurn }).toEqual(native);
        expect(rng.getState()).toEqual(random);
        for (const callback of [services.randomInt, services.message, services.executeAction, services.setGold])
            expect(callback).not.toHaveBeenCalled();
        const loaded = new ExtensionRuntime(registry, registry.manifest(['combat']), services, before);
        loaded.attachCreature(creature, false); loaded.loaded();
        expect(loaded.snapshot()).toEqual(before); loaded.unload();
        expect(rng.getState()).toEqual(random);
        for (const callback of [services.randomInt, services.message, services.executeAction, services.setGold])
            expect(callback).not.toHaveBeenCalled();
    });

    it('repeatedly projects only detached empty public data without changing state or either random stream', () => {
        const services: ExtensionPorts = { depth: () => 1, playerId: () => 1,
            randomInt: vi.fn(() => { throw new Error('unexpected RNG'); }), message: vi.fn() };
        const registry = registryFromDescriptors([descriptor]);
        const runtime = new ExtensionRuntime(registry, registry.manifest(['combat']), services);
        const before = runtime.snapshot(), random = rng.getState(), first = runtime.readModuleView('combat')!;
        for (let i = 0; i < 25; i++) {
            const view = runtime.readModuleView('combat')!;
            expect(view.state).toEqual(emptyView); expect(view.components).toEqual({}); expect(view.definitions).toEqual({});
            expect(view.session).toBe(first.session); expect(Object.isFrozen(view.state)).toBe(true);
            expect(Object.isFrozen(view.state.telegraphs)).toBe(true);
            expect(runtime.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
        }
        const detached = projectCombatView() as { telegraphs: Json[] };
        detached.telegraphs.push('not-a-telegraph');
        expect(projectCombatView()).toEqual(emptyView);
        expect(services.randomInt).not.toHaveBeenCalled(); expect(services.message).not.toHaveBeenCalled();
        runtime.unload(); expect(runtime.readModuleView('combat')).toBeNull();
    });

    it('keeps disabled runs free of combat state and leaves real native waits and both RNG streams unchanged', () => {
        const disabled = start([]); play(disabled); play(disabled);
        const empty = checkpoint(disabled);
        expect(empty.extensions!.modules).toEqual({}); expect(empty.extensions!.components).toEqual({});
        expect(disabled.extensionRuntime!.readModuleView('combat')).toBeNull();
        const enabled = start(['combat']); play(enabled); play(enabled);
        const actual = checkpoint(enabled);
        expect({ ...actual, extensions: undefined }).toEqual({ ...empty, extensions: undefined });
        expect(actual.extensions!.modules).toEqual({ combat: { schema: 1, revision: 0, nextActionId: 1 } });
        expect(actual.extensions!.components).toEqual({});
        expect(actual.extensions!.foundation).toEqual(empty.extensions!.foundation);
        expect(enabled.exportRecording().events.every(event => event.action === 'wait')).toBe(true);
    }, 30000);

    it('rejects missing-module saves and recordings before retiring the current Game', () => {
        const game = start(['combat']); play(game);
        const saved = clone(game.toSaveSnapshot()), recording = clone(game.exportRecording());
        const player = game.player, runtime = game.extensionRuntime!, before = checkpoint(game), nextId = getNextEntityId();
        const unload = vi.spyOn(runtime, 'unload'), onError = vi.fn();
        const available = registryFromDescriptors(catalog.getInstalledModuleDescriptors().filter(module => module.id !== 'combat'));
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(available);
        expect(game.loadSnapshot(saved, onError)).toBe(false);
        expect(game.loadReplay(recording, onError)).toBe(false);
        expect(onError).toHaveBeenCalledTimes(2);
        for (const [message] of onError.mock.calls) { expect(message).toContain('combat'); expect(message).toContain('not installed'); }
        expect(unload).not.toHaveBeenCalled(); expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
        expect(checkpoint(game)).toEqual(before); expect(getNextEntityId()).toBe(nextId);
    }, 30000);

    it('rejects malformed or progressed state, incompatible identity and even valid fixture components before retirement', () => {
        const game = start(['combat']); play(game);
        const saved = clone(game.toSaveSnapshot()), recording = clone(game.exportRecording());
        const player = game.player, runtime = game.extensionRuntime!;
        const before = checkpoint(game), nextId = getNextEntityId(), unload = vi.spyOn(runtime, 'unload');
        const invalid = [null, {}, { schema: 2, revision: 0, nextActionId: 1 },
            { schema: 1, revision: 0, nextActionId: 1, extra: true },
            { schema: 1, revision: Number.MAX_SAFE_INTEGER + 1, nextActionId: 1 },
            { schema: 1, revision: 1, nextActionId: 2 }];
        const badSnapshots = invalid.map(state => {
            const bad = clone(saved); bad.extensions!.modules.combat = state as Json; return bad;
        });
        const pack = loadCombatDefinitionPack(), module = createCombatModule();
        const fixtures = { resources: initialCombatResources(pack, pack.resourcePolicies[0]!.id), action: actionFixture(player.id) };
        for (const [name, value] of Object.entries(fixtures)) {
            expect(module.componentValidators![name]!(value), `${name} fixture must be structurally valid`).toBe(true);
            const bad = clone(saved);
            bad.extensions!.components[String(player.id)] = { [`combat:${name}`]: value as unknown as Json };
            badSnapshots.push(bad);
        }
        for (const field of ['version', 'fingerprint'] as const) {
            const bad = clone(saved), identity = bad.extensions!.manifest.modules.find(module => module.id === 'combat')!;
            if (field === 'version') identity.version = '9.0.0';
            else identity.rules!.fingerprint = `sha256:${'f'.repeat(64)}`;
            badSnapshots.push(bad);
        }
        for (const bad of badSnapshots) {
            expect(game.loadSnapshot(bad)).toBe(false);
            const badRecording = clone(recording);
            badRecording.extensions = clone(bad.extensions!.manifest);
            badRecording.events[0]!.extensions = clone(bad.extensions!);
            expect(game.loadReplay(badRecording)).toBe(false);
            expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
            expect(checkpoint(game)).toEqual(before); expect(getNextEntityId()).toBe(nextId);
            expect(unload).not.toHaveBeenCalled();
        }
    }, 30000);

    it('rejects unknown combat player commands without recording, action IDs, resources or RNG and rejects their replays', () => {
        const game = start(['combat']); play(game);
        const before = checkpoint(game), recording = clone(game.exportRecording());
        const player = game.player, runtime = game.extensionRuntime!, unload = vi.spyOn(runtime, 'unload');
        for (const action of ['attack', 'start', 'dodge', 'parry', 'rest', 'toString', '__proto__']) {
            const data = JSON.stringify({ module: 'combat', action, payload: { v: 1, revision: 0, attackId: 'fixture.slash' } });
            acknowledge(); game.executeCommand('ext:command', data);
            expect(game.exportRecording().events).toEqual(recording.events);
            expect(checkpoint(game)).toEqual(before); expectNoCombatComponents(game.extensionRuntime!.snapshot());
            const bad = clone(recording); bad.events[0]!.action = 'ext:command'; bad.events[0]!.data = data;
            expect(game.loadReplay(bad)).toBe(false);
            expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
            expect(checkpoint(game)).toEqual(before); expect(unload).not.toHaveBeenCalled();
        }
    }, 30000);
});

// This small 3a1 smoke deliberately is not the full installed-module subset matrix.
// Companion modules are obtained through discovery only, so deleting their folders
// never leaves imports or requires this package's own tests to be edited.
const installedIds = new Set(catalog.getInstalledModuleDescriptors().map(module => module.id));
const smokeCombinations = [['combat'],
    ...(['growth', 'narrative'].every(id => installedIds.has(id)) ? [['combat', 'growth', 'narrative']] : [])];
describe.each(smokeCombinations)('EXT-3a1 actual Game with %j', (...ids: string[]) => {
    it('preserves exact save/load, every replay checkpoint, seek and continued recording while combat stays inert', () => {
        const game = start(ids), origin = clone(game.toSaveSnapshot().run.recordingOrigin!.initial);
        const expected = new Map<number, ReturnType<typeof checkpoint>>();
        const capture = () => {
            expected.set(game.exportRecording().events.length, checkpoint(game));
            const extensions = game.extensionRuntime!.snapshot();
            expect(extensions.modules.combat).toEqual({ schema: 1, revision: 0, nextActionId: 1 });
            expectNoCombatComponents(extensions);
            const random = rng.getState(), before = checkpoint(game);
            for (let i = 0; i < 5; i++) expect(game.extensionRuntime!.readModuleView('combat')!.state).toEqual(emptyView);
            expect(checkpoint(game)).toEqual(before); expect(rng.getState()).toEqual(random);
        };
        capture(); play(game); capture(); play(game); capture();
        const saved = clone(game.toSaveSnapshot()), savedCheckpoint = checkpoint(game), firstRecording = clone(game.exportRecording());
        expect(Object.keys(saved.extensions!.modules).sort()).toEqual([...ids].sort());
        expect(game.loadSnapshot(saved)).toBe(true); game.animationEnabled = false;
        expect(checkpoint(game)).toEqual(savedCheckpoint); expect(game.hasCompleteRecording).toBe(true);
        play(game); capture();
        const continued = checkpoint(game), recording = clone(game.exportRecording());
        expect(recording.events.slice(0, firstRecording.events.length)).toEqual(firstRecording.events);
        expect(recording.events.filter(event => event.action === 'wait')).toHaveLength(3);
        expect(recording.events.some(event => event.action === 'ext:command'
            && typeof event.data === 'string' && JSON.parse(event.data).module === 'combat')).toBe(false);
        expect(game.loadReplay(recording)).toBe(true); game.animationEnabled = false;
        for (const [index, event] of recording.events.entries()) {
            game.replayStep(true);
            expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(index + 1);
            const actual = checkpoint(game);
            expect(actual.rng).toEqual(event.rng); expect(actual.extensions).toEqual(event.extensions);
            expect(actual.turn).toBe(event.turn); expect(actual.tick).toBe(event.tick); expect(actual.depth).toBe(event.depth);
            if (expected.has(index + 1)) expect(actual).toEqual(expected.get(index + 1));
            expectNoCombatComponents(actual.extensions!);
        }
        expect(checkpoint(game)).toEqual(continued);
        for (const index of [0, 1, recording.events.length - 1, recording.events.length]) {
            game.replaySeek(index);
            expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(index);
            const target = index ? recording.events[index - 1]! : origin;
            expect(game.toSnapshot().rngState).toEqual(target.rng);
            expect(game.extensionRuntime!.snapshot()).toEqual(target.extensions);
            if (expected.has(index)) expect(checkpoint(game)).toEqual(expected.get(index));
        }
        expect(game.loadSnapshot(saved)).toBe(true); game.animationEnabled = false;
        play(game);
        expect(checkpoint(game)).toEqual(continued);
        expect(game.exportRecording().events).toEqual(recording.events);
    }, 30000);
});
