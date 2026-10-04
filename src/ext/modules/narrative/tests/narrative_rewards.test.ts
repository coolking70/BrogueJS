import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionRuntime, type ExtensionPorts } from '../../../runtime';
import { ExtensionRegistry } from '../../../registry';
import type { ExtensionContext, ExtensionModule, Json, OptionalRewardPrepareContext, OptionalRewardPreparation, OptionalRewardRequest, ReadonlyJson } from '../../../types';
import * as catalog from '../../../catalog';
import { Player } from '../../../../entities/Player';
import { getNextEntityId, restoreNextEntityId } from '../../../../entities/Creature';
import { createHeadlessGame } from '../../../../test/harness';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import type { Game } from '../../../../engine/Core/Game';
import { createNarrativeModuleFromPack } from '../module';
import { loadNarrativePack } from '../schema';
import { validateNarrativeState, type NarrativeState } from '../state';
import type { Effect, NarrativePack, Trigger } from '../types';
import rawPack from '../data/definitions.json';
import portraits from '../data/portraits.json';
import locale from '../locales/zh_CN.json';

const clone = <T>(value: T): T => structuredClone(value);
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? Mutable<U>[] : T[K] extends object ? Mutable<T[K]> : T[K] };
type ProviderState = { created: boolean; total: number; receipts: string[] };
type ProviderMode = 'ready' | 'disabled' | 'unsupported-key';
const capability = 'growth.story-reward.v1';
const reward = (receiptId = 'archive.reward', rewardId = 'archive.read'): Effect => ({
    kind: 'optional-reward', capability, rewardId, receiptId, onUnavailable: 'skip',
});
const entryTrigger = (id: string, effects: readonly Effect[], priority = 0): Trigger => ({
    id, on: { kind: 'entered-level' }, priority, condition: { op: 'true' }, repeat: { kind: 'once-per-run' }, effects,
});
function pack(change?: (data: Mutable<NarrativePack>) => void): NarrativePack {
    const data = clone(rawPack) as unknown as Mutable<NarrativePack>;
    change?.(data);
    return loadNarrativePack(data, portraits, locale);
}

/** A foundation-protocol test provider, deliberately independent of any installed stage module. */
function rewardProvider(options: { mode?: ProviderMode; requiresInitialization?: boolean } = {}) {
    const control = { mode: options.mode ?? 'ready', failPrepare: false, failCommit: false, failSettlement: false };
    const prepare = vi.fn((request: Readonly<OptionalRewardRequest>, context: OptionalRewardPrepareContext): OptionalRewardPreparation => {
        if (control.failPrepare) throw new Error('fixture prepare failed');
        if (!(context.state as unknown as ProviderState).created) throw new Error('reward before initialization');
        if (control.mode !== 'ready') return { status: 'skipped', reason: control.mode };
        return { status: 'ready', plan: { amount: 20, instanceId: request.instanceId } };
    });
    const commit = vi.fn((request: Readonly<OptionalRewardRequest>, plan: ReadonlyJson, context: ExtensionContext) => {
        const state = context.state as unknown as ProviderState;
        if (state.receipts.includes(request.instanceId)) throw new Error('duplicate provider commit');
        const amount = (plan as { amount: number }).amount;
        state.total += amount; state.receipts.push(request.instanceId);
        context.setState(state as unknown as Json);
        context.setComponent(context.playerId, 'character', { xp: state.total });
        const actor = context.creature(context.playerId)!;
        context.commitResources(actor.id, { expectedHp: actor.hp, expectedMaxHp: actor.maxHp, hp: actor.hp + 2, maxHp: actor.maxHp + 2 });
        const resources = context.characterResources(actor.id);
        context.commitCharacterResources(actor.id, { expectedStrength: resources.strength, expectedGold: resources.gold,
            strength: resources.strength! + 1, gold: resources.gold! + 5 });
        context.message('fixture reward committed');
        if (control.failCommit) throw new Error('fixture commit failed after writes');
    });
    const create = (): ExtensionModule => ({
        id: 'reward-fixture', version: '1.0.0', resourceCommits: true,
        initialState: () => ({ created: !options.requiresInitialization, total: 0, receipts: [] }),
        validateState: (value): value is Json => {
            const state = value as ProviderState | null;
            return !!state && typeof state.created === 'boolean' && Number.isSafeInteger(state.total) && state.total >= 0
                && Array.isArray(state.receipts) && state.receipts.every(receipt => typeof receipt === 'string');
        },
        componentValidators: { character: value => !!value && typeof value === 'object' && Number.isSafeInteger((value as { xp: number }).xp) },
        optionalRewards: { [capability]: { prepare, commit } },
        initializationReady: context => (context.state as unknown as ProviderState).created,
        readyToSave: context => (context.state as unknown as ProviderState).created,
        ...(options.requiresInitialization ? {
            initialCommand: { action: 'create', payload: { v: 1 } },
            validateInitialCommand: (action: string, payload: Json) => action === 'create' && JSON.stringify(payload) === '{"v":1}',
        } : {}),
        commands: { create(_payload, context) {
            const state = context.state as unknown as ProviderState;
            if (state.created) throw new Error('already initialized');
            state.created = true; context.setState(state as unknown as Json);
            context.setComponent(context.playerId, 'character', { xp: 0 });
        } },
        hooks: { simulationSettled(_event, context) {
            if (control.failSettlement && (context.state as unknown as ProviderState).total > 0) {
                context.message('fixture settlement must not escape');
                throw new Error('fixture settlement failed after reward');
            }
        } },
    });
    return { control, prepare, commit, create };
}
function registryFor(content: NarrativePack, provider?: ReturnType<typeof rewardProvider>, reverse = false): ExtensionRegistry {
    const registry = new ExtensionRegistry();
    const narrative = createNarrativeModuleFromPack(content);
    const entries = [{ id: narrative.id, version: narrative.version, create: () => createNarrativeModuleFromPack(content), rules: narrative.rules },
        ...(provider ? [{ id: 'reward-fixture', version: '1.0.0', create: provider.create, rules: undefined }] : [])];
    for (const entry of reverse ? entries.reverse() : entries) registry.register(entry.id, entry.version, entry.create, entry.rules);
    return registry;
}
function fixture(options: { content?: NarrativePack; provider?: ReturnType<typeof rewardProvider>; reverse?: boolean } = {}) {
    restoreNextEntityId(1);
    const player = new Player(1, 1), content = options.content ?? pack();
    const registry = registryFor(content, options.provider, options.reverse), ids = ['narrative', ...(options.provider ? ['reward-fixture'] : [])];
    let depth = 1, gold = 10;
    const message = vi.fn(), randomInt = vi.fn(() => { throw new Error('unexpected narrative RNG'); });
    const ports: ExtensionPorts = { depth: () => depth, turn: () => 0, playerId: () => player.id,
        gold: () => gold, setGold: value => { gold = value; }, randomInt, message,
        interactableCandidates: () => [{ x: 2, y: 1 }], isInteractableVisible: () => true, canInteractWith: () => true };
    const runtime = new ExtensionRuntime(registry, registry.manifest(options.reverse ? ids.reverse() : ids), ports);
    runtime.attachCreature(player); runtime.newGame();
    const state = () => runtime.snapshot().modules.narrative as unknown as NarrativeState;
    const resources = () => ({ hp: player.hp, maxHp: player.maxHp, strength: player.strength, gold });
    const checkpoint = () => ({ snapshot: runtime.snapshot(), resources: resources(), nextEntityId: getNextEntityId(), rng: rng.getState() });
    const settle = () => runtime.settle([player]);
    function enter(value = 1, firstVisit = true, flush = true) {
        depth = value;
        const token = runtime.beginGeneration('reward-test-entry');
        runtime.emit('enteredLevel', { depth, firstVisit }); runtime.commitGeneration(token);
        if (flush) settle();
    }
    function input(action: string, payload: object) {
        return JSON.stringify({ module: 'narrative', action, payload: { v: 2, revision: state().revision, ...payload } });
    }
    function execute(data: string) {
        if (!runtime.allowsInput('ext:command', data)) return false;
        runtime.command(data, settle); return true;
    }
    const open = () => execute(input('open', { targetEntityId: runtime.snapshot().foundation.world.entities[0]!.id }));
    const choiceInput = () => { const active = state().active!; return input('choose', { sessionId: active.sessionId, nodeId: active.nodeId, choiceId: 'read-note' }); };
    return { runtime, registry, ports, player, content, state, resources, checkpoint, settle, enter, input, execute, open, choiceInput, message, randomInt };
}
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
function gameCheckpoint(game: Game) {
    const snapshot = game.toSnapshot();
    return { turn: snapshot.run.absoluteTurnNumber, tick: snapshot.run.currentTick, depth: snapshot.depth,
        player: snapshot.player, rng: snapshot.rngState, extensions: snapshot.extensions };
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-2c narrative optional reward transactions', () => {
    it.each(['absent', 'disabled', 'unsupported-key', 'ready'] as const)('commits the complete story with the %s provider result in the same boundary', mode => {
        const provider = mode === 'absent' ? undefined : rewardProvider({ mode });
        const f = fixture({ provider }); f.enter(); expect(f.open()).toBe(true);
        const before = f.resources(), nextFactId = f.runtime.snapshot().foundation.nextFactId, random = rng.getState();
        expect(f.execute(f.choiceInput())).toBe(true);
        expect(f.state().flags['archive.read']).toBe(true);
        expect(f.state().journal).toEqual([{ entryId: 'archive.note', order: 1 }]);
        expect(f.state().active).toBeNull(); expect(f.runtime.interactionActive).toBe(false);
        expect(f.state().rewardReceipts).toEqual([{ id: 'archive.reward', instanceKey: 'narrative.archive.reward.run',
            result: mode === 'ready' ? 'applied' : 'skipped', reason: mode === 'ready' ? null : mode }]);
        expect(f.runtime.snapshot().foundation.nextFactId).toBe(nextFactId + 2);
        expect(f.runtime.snapshot().foundation.pendingStoryFacts).toEqual([]);
        expect(f.state().lastFactId).toBe(nextFactId + 1);
        if (mode === 'ready') {
            expect(provider!.commit).toHaveBeenCalledOnce();
            expect(f.runtime.snapshot().modules['reward-fixture']).toMatchObject({ total: 20, receipts: ['narrative.archive.reward.run'] });
            expect(f.runtime.snapshot().components[f.player.id]!['reward-fixture:character']).toEqual({ xp: 20 });
            expect(f.resources()).toEqual({ hp: before.hp + 2, maxHp: before.maxHp + 2, strength: before.strength + 1, gold: before.gold + 5 });
        } else {
            expect(f.resources()).toEqual(before);
            if (provider) expect(provider.commit).not.toHaveBeenCalled();
        }
        expect(rng.getState()).toEqual(random); expect(f.randomInt).not.toHaveBeenCalled();
        const committed = f.checkpoint();
        f.settle(); f.runtime.snapshot(); f.runtime.loaded(); f.settle();
        expect(f.checkpoint()).toEqual(committed);
    });

    it('never retries an applied receipt or a skipped receipt after its provider becomes available', () => {
        const content = pack(data => {
            data.dialogues[0]!.nodes[0]!.choices[0]!.condition = { op: 'true' };
            data.triggers[0]!.repeat = { kind: 'bounded', maxFirings: 8, cooldownTurns: 0 };
        });
        for (const mode of ['ready', 'disabled', 'unsupported-key'] as const) {
            const provider = rewardProvider({ mode }), f = fixture({ content, provider }); f.enter(); f.open();
            expect(f.execute(f.choiceInput())).toBe(true);
            const receipt = clone(f.state().rewardReceipts), before = f.resources(), commits = provider.commit.mock.calls.length;
            provider.control.mode = 'ready';
            expect(f.open()).toBe(true); const second = f.choiceInput();
            expect(f.execute(second)).toBe(true); expect(f.execute(second)).toBe(false);
            expect(f.state().rewardReceipts).toEqual(receipt); expect(f.resources()).toEqual(before);
            expect(provider.commit).toHaveBeenCalledTimes(commits);
            expect(f.state().journal).toHaveLength(1);
        }
    });

    it('gives preparation only deeply frozen own-state, player-component, actor and resource inputs', () => {
        const provider = rewardProvider({ requiresInitialization: true }), f = fixture({ provider });
        f.enter();
        f.runtime.command(JSON.stringify({ module: 'reward-fixture', action: 'create', payload: { v: 1 } }), f.settle);
        f.open(); const before = f.checkpoint();
        let component: ReadonlyJson | undefined;
        const originalPrepare = provider.prepare.getMockImplementation()!;
        provider.prepare.mockImplementation((request, context) => {
            component = context.getPlayerComponent('character');
            expect(context.getPlayerComponent('private')).toBeUndefined();
            expect(() => context.getPlayerComponent('narrative:private')).toThrow();
            return originalPrepare(request, context);
        });
        expect(f.runtime.allowsInput('ext:command', f.choiceInput())).toBe(true);
        expect(f.checkpoint()).toEqual(before); expect(provider.commit).not.toHaveBeenCalled();
        const [request, context] = provider.prepare.mock.calls[provider.prepare.mock.calls.length - 1]!;
        expect(Object.isFrozen(request)).toBe(true); expect(Object.isFrozen(context)).toBe(true);
        expect(Object.isFrozen(context.state)).toBe(true); expect(Object.isFrozen((context.state as unknown as ProviderState).receipts)).toBe(true);
        expect(Object.isFrozen(context.player)).toBe(true); expect(Object.isFrozen(context.resources)).toBe(true);
        expect(component).toEqual({ xp: 0 }); expect(Object.isFrozen(component)).toBe(true);
        expect(() => context.getPlayerComponent('character')).toThrow('Expired optional reward preparation');
        expect(Object.keys(context).sort()).toEqual(['getPlayerComponent', 'player', 'playerId', 'resources', 'state']);
        expect(() => { (context.state as unknown as ProviderState).receipts.push('forged'); }).toThrow();
        expect(f.checkpoint()).toEqual(before);
    });

    it('preflights all later effects before committing an earlier ready reward, message, journal or flag', () => {
        const content = pack(data => {
            data.triggers = [];
            data.counters = [{ id: 'full', initial: 1, min: 0, max: 1 }];
            data.dialogues[0]!.nodes[0]!.choices[0]!.effects = [reward(), { kind: 'message', textKey: 'ext.narrative.choice.read' },
                { kind: 'set-flag', id: 'archive.read', value: true }, { kind: 'journal', entryId: 'archive.note' },
                { kind: 'add-counter', id: 'full', amount: 1 }];
        });
        const provider = rewardProvider(), f = fixture({ content, provider }); f.enter(); f.open();
        const before = f.checkpoint(), messages = f.message.mock.calls.length;
        expect(f.execute(f.choiceInput())).toBe(false);
        expect(provider.prepare).toHaveBeenCalled(); expect(provider.commit).not.toHaveBeenCalled();
        expect(f.checkpoint()).toEqual(before); expect(f.message).toHaveBeenCalledTimes(messages);
    });

    it('rejects a throwing or malformed declared provider without degrading it to a normal skip', () => {
        const provider = rewardProvider(), f = fixture({ provider }); f.enter(); f.open();
        const before = f.checkpoint(); provider.control.failPrepare = true;
        expect(f.execute(f.choiceInput())).toBe(false); expect(f.checkpoint()).toEqual(before);
        provider.control.failPrepare = false;
        provider.prepare.mockImplementation(() => ({ status: 'ready', plan: undefined } as unknown as OptionalRewardPreparation));
        expect(f.execute(f.choiceInput())).toBe(false); expect(f.checkpoint()).toEqual(before);
        expect(provider.commit).not.toHaveBeenCalled(); expect(f.state().rewardReceipts).toEqual([]);
    });

    it.each(['commit', 'settlement'] as const)('rolls back states, components, native resources, gate, messages and IDs after %s fails', failure => {
        const provider = rewardProvider(), f = fixture({ provider }); f.enter(); f.open();
        const before = f.checkpoint(), messages = f.message.mock.calls.length, data = f.choiceInput();
        if (failure === 'commit') provider.control.failCommit = true;
        else provider.control.failSettlement = true;
        expect(() => f.execute(data)).toThrow(failure === 'commit' ? 'fixture commit failed after writes' : 'fixture settlement failed after reward');
        expect(provider.commit).toHaveBeenCalledOnce(); expect(f.checkpoint()).toEqual(before);
        expect(f.message).toHaveBeenCalledTimes(messages); expect(f.runtime.interactionActive).toBe(true);
        provider.control.failCommit = false; provider.control.failSettlement = false;
        expect(f.execute(data)).toBe(true);
        expect(f.state().rewardReceipts).toEqual([{ id: 'archive.reward', instanceKey: 'narrative.archive.reward.run', result: 'applied', reason: null }]);
        expect(f.runtime.snapshot().modules['reward-fixture']).toMatchObject({ total: 20, receipts: ['narrative.archive.reward.run'] });
        expect(f.message).toHaveBeenCalledTimes(messages + 1);
    });

    it('retains deferred native facts and their IDs after failed initialization settlement, then consumes them once on retry', () => {
        const content = pack(data => { data.triggers = [entryTrigger('entry.reward', [reward()])] as Mutable<Trigger>[]; });
        const provider = rewardProvider({ requiresInitialization: true }), f = fixture({ content, provider }); f.enter();
        const create = JSON.stringify({ module: 'reward-fixture', action: 'create', payload: { v: 1 } });
        const before = f.checkpoint();
        expect(before.snapshot.foundation.pendingStoryFacts).toEqual([{ kind: 'entered-level', depth: 1, firstVisit: true, turn: 0 }]);
        expect(before.snapshot.foundation.nextFactId).toBe(1);
        provider.control.failSettlement = true;
        expect(() => f.runtime.command(create, f.settle)).toThrow('fixture settlement failed after reward');
        expect(f.checkpoint()).toEqual(before); expect(f.message).not.toHaveBeenCalled();
        provider.control.failSettlement = false; f.runtime.command(create, f.settle);
        expect(f.runtime.snapshot().foundation.pendingStoryFacts).toEqual([]);
        expect(f.runtime.snapshot().foundation.nextFactId).toBe(2);
        expect(f.state().rewardReceipts[0]).toMatchObject({ result: 'applied', reason: null });
        expect(f.runtime.snapshot().modules['reward-fixture']).toMatchObject({ total: 20 });
        const after = f.checkpoint(); f.settle(); expect(f.checkpoint()).toEqual(after);
    });

    it('defers first entry until the final creation command and rewards inside that same checkpoint', () => {
        const content = pack(data => { data.triggers = [entryTrigger('entry.reward', [reward()])] as Mutable<Trigger>[]; });
        const provider = rewardProvider({ requiresInitialization: true }), f = fixture({ content, provider }); f.enter();
        expect(provider.prepare).not.toHaveBeenCalled(); expect(f.state().lastFactId).toBe(0);
        expect(f.runtime.snapshot().foundation.nextFactId).toBe(1); expect(f.runtime.snapshot().foundation.pendingStoryFacts).toHaveLength(1);
        f.runtime.command(JSON.stringify({ module: 'reward-fixture', action: 'create', payload: { v: 1 } }), f.settle);
        expect(provider.commit).toHaveBeenCalledOnce(); expect(f.runtime.readyToSave).toBe(true);
        expect(f.runtime.snapshot().modules['reward-fixture']).toMatchObject({ created: true, total: 20 });
        expect(f.state().lastFactId).toBe(1); expect(f.runtime.snapshot().foundation.nextFactId).toBe(2);
        expect(f.runtime.snapshot().foundation.pendingStoryFacts).toEqual([]);
    });

    it('orders native and derived reward intents independently of module registration and repeated checkpoints', () => {
        const content = pack(data => {
            data.triggers = [entryTrigger('z.last', [reward('receipt.last')]),
                entryTrigger('b.second', [reward('receipt.second')], 5),
                entryTrigger('a.first', [reward('receipt.first'), { kind: 'emit-story', eventId: 'archive.read-done' }], 5),
                { ...entryTrigger('derived', [reward('receipt.derived')]), on: { kind: 'story', eventId: 'archive.read-done' } }] as Mutable<Trigger>[];
        });
        const run = (reverse: boolean) => {
            const provider = rewardProvider(), f = fixture({ content, provider, reverse }); f.enter();
            expect(provider.commit.mock.calls.map(([request]) => request.instanceId)).toEqual([
                'narrative.receipt.first.run', 'narrative.receipt.second.run', 'narrative.receipt.last.run', 'narrative.receipt.derived.run',
            ]);
            expect(f.runtime.snapshot().foundation.nextFactId).toBe(3);
            const expected = f.checkpoint(); f.settle(); f.runtime.loaded(); f.runtime.snapshot(); f.settle();
            expect(f.checkpoint()).toEqual(expected); expect(provider.commit).toHaveBeenCalledTimes(4);
            return expected;
        };
        expect(run(true)).toEqual(run(false));
    });

    it('strictly persists final applied and skipped receipts and rejects impossible receipt/fact combinations', () => {
        const provider = rewardProvider(), f = fixture({ provider }); f.enter(); f.open(); f.execute(f.choiceInput());
        const saved = f.runtime.snapshot();
        const restored = new ExtensionRuntime(f.registry, saved.manifest, f.ports, clone(saved));
        restored.attachCreature(f.player, false); restored.loaded(); restored.settle([f.player]);
        expect(restored.snapshot()).toEqual(saved); expect(provider.commit).toHaveBeenCalledOnce();
        for (const mutate of [
            (state: NarrativeState) => { (state.rewardReceipts[0] as { reason: unknown }).reason = 'absent'; },
            (state: NarrativeState) => { state.rewardReceipts.push(clone(state.rewardReceipts[0]!)); },
            (state: NarrativeState) => { state.rewardReceipts[0]!.instanceKey = 'forged'; },
        ]) {
            const bad = clone(f.state()); mutate(bad); expect(() => validateNarrativeState(bad, f.content)).toThrow();
        }
        const badFact = clone(saved); badFact.foundation.nextFactId = f.state().lastFactId;
        expect(() => new ExtensionRuntime(f.registry, saved.manifest, f.ports, badFact)).toThrow();
    });
});

describe('EXT-2c real Game reward checkpoint ownership', () => {
    it('includes deferred startup rewards in creation recording and preserves them through load, step, seek and continued recording', () => {
        const content = pack(data => { data.triggers = [entryTrigger('entry.reward', [reward(), { kind: 'journal', entryId: 'archive.note' }])] as Mutable<Trigger>[]; });
        const provider = rewardProvider({ requiresInitialization: true }), registry = registryFor(content, provider);
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        const seed = 8223, game = createHeadlessGame(seed, 'test');
        game.startNewGame({ seed, mode: 'test', ruleSet: 'extended', extensions: ['narrative', 'reward-fixture'],
            initialCommands: [JSON.stringify({ module: 'reward-fixture', action: 'create', payload: { v: 1 } })] });
        game.animationEnabled = false;
        const initial = clone(game.toSaveSnapshot().run.recordingOrigin!.initial), recording = clone(game.exportRecording());
        expect(recording.events).toHaveLength(1);
        expect(initial.extensions!.foundation.nextFactId).toBe(1);
        expect(initial.extensions!.foundation.pendingStoryFacts).toHaveLength(1);
        expect(recording.events[0]!.extensions!.modules['reward-fixture']).toMatchObject({ created: true, total: 20 });
        expect(recording.events[0]!.extensions!.foundation.pendingStoryFacts).toEqual([]);
        expect((recording.events[0]!.extensions!.modules.narrative as unknown as NarrativeState).rewardReceipts[0]).toMatchObject({ result: 'applied', reason: null });
        // A precreation checkpoint is structurally valid, but its queued fact must
        // still agree with this recorded event's own native depth and turn.
        const livePlayer = game.player, liveRuntime = game.extensionRuntime, live = gameCheckpoint(game);
        for (const field of ['depth', 'turn'] as const) {
            const bad = clone(recording);
            bad.events[0]!.extensions = clone(initial.extensions!);
            bad.events[0]!.extensions!.foundation.pendingStoryFacts[0]![field]++;
            expect(game.loadReplay(bad)).toBe(false);
            expect(game.player).toBe(livePlayer); expect(game.extensionRuntime).toBe(liveRuntime);
            expect(gameCheckpoint(game)).toEqual(live);
        }
        acknowledge(); game.executeCommand('wait');
        const save = clone(game.toSaveSnapshot()), expected = gameCheckpoint(game), prior = clone(game.exportRecording());
        expect(game.loadSnapshot(save)).toBe(true); game.animationEnabled = false;
        expect(gameCheckpoint(game)).toEqual(expected); expect(game.hasCompleteRecording).toBe(true);
        acknowledge(); game.executeCommand('wait');
        const continued = clone(game.exportRecording()), endpoint = gameCheckpoint(game);
        expect(continued.events.slice(0, prior.events.length)).toEqual(prior.events);
        expect(game.loadReplay(continued)).toBe(true); game.animationEnabled = false;
        for (const event of continued.events) {
            game.replayStep(true); expect(game.replayError).toBeNull();
            expect(game.toSnapshot().extensions).toEqual(event.extensions); expect(game.toSnapshot().rngState).toEqual(event.rng);
            expect(game.toSnapshot().run.absoluteTurnNumber).toBe(event.turn); expect(game.toSnapshot().run.currentTick).toBe(event.tick);
        }
        expect(gameCheckpoint(game)).toEqual(endpoint);
        for (const index of [0, 1, continued.events.length, 1, 0, continued.events.length]) {
            game.replaySeek(index); expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(index);
            const target = index === 0 ? initial : continued.events[index - 1]!;
            expect(game.toSnapshot().extensions).toEqual(target.extensions); expect(game.toSnapshot().rngState).toEqual(target.rng);
        }
        expect(gameCheckpoint(game)).toEqual(endpoint);
        const finalState = game.extensionRuntime!.snapshot();
        expect(finalState.modules['reward-fixture']).toMatchObject({ total: 20, receipts: ['narrative.archive.reward.run'] });
        expect((finalState.modules.narrative as unknown as NarrativeState).journal).toHaveLength(1);
    }, 30000);
});
