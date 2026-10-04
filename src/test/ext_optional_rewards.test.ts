import { describe, expect, it, vi } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime, type ExtensionPorts } from '../ext/runtime';
import { Player } from '../entities/Player';
import { Creature, getNextEntityId } from '../entities/Creature';
import { createHeadlessGame } from './harness';
import * as catalog from '../ext/catalog';
import type { ExtensionContext, ExtensionModule, ExtensionSnapshot, Json, OptionalRewardPreparation, OptionalRewardPrepareContext, OptionalRewardProvider } from '../ext/types';

const capability = 'foundation.sample-reward.v1';
const base = (id: string): ExtensionModule => ({ id, version: '1.0.0', initialState: () => ({}),
    validateState: (value): value is Json => !!value && typeof value === 'object' });
const command = (action = 'claim') => JSON.stringify({ module: 'consumer', action, payload: null });
function setup(modules: ExtensionModule[], saved?: ExtensionSnapshot) {
    const player = new Player(1, 1), registry = new ExtensionRegistry();
    let gold = 5;
    for (const module of modules) registry.register(module.id, module.version, () => module);
    const ports: ExtensionPorts = { depth: () => 1, turn: () => 7, playerId: () => player.id,
        randomInt: vi.fn(() => 0), message: vi.fn(), gold: () => gold, setGold: value => { gold = value; } };
    const runtime = new ExtensionRuntime(registry, registry.manifest(modules.map(module => module.id)), ports, saved);
    runtime.attachCreature(player);
    return { runtime, player, ports };
}
const provider = (overrides: Partial<OptionalRewardProvider> = {}): OptionalRewardProvider => ({
    prepare: () => ({ status: 'ready', plan: { amount: 3 } }),
    commit: (_request, _plan, context) => {
        const actor = context.creature(context.playerId)!, resources = context.characterResources(context.playerId);
        context.setState({ committed: true }); context.setComponent(context.playerId, 'reward', { awarded: true });
        context.commitResources(actor.id, { expectedHp: actor.hp, expectedMaxHp: actor.maxHp, hp: actor.hp + 3, maxHp: actor.maxHp + 3 });
        context.commitCharacterResources(actor.id, { expectedStrength: resources.strength, expectedGold: resources.gold,
            strength: resources.strength! + 1, gold: resources.gold! + 3 });
        context.message('reward committed');
    }, ...overrides,
});
const providerModule = (reward = provider()): ExtensionModule => ({ ...base('provider'), resourceCommits: true, optionalRewards: { [capability]: reward } });
const consumer = (run: (context: ExtensionContext) => void): ExtensionModule => ({ ...base('consumer'), commands: { claim: (_payload, context) => run(context) } });
const claim = (context: ExtensionContext) => context.commitOptionalReward(capability, 'known', 'once');
function enter(runtime: ExtensionRuntime) {
    const token = runtime.beginGeneration('entry'); runtime.emit('enteredLevel', { depth: 1, firstVisit: true });
    try { runtime.commitGeneration(token); } catch (error) { runtime.rollbackGeneration(token); throw error; }
}

describe('2c optional reward preparation and atomic commit', () => {
    it('distinguishes absent, disabled and unsupported rewards without state, dice or message effects', () => {
        for (const reason of ['absent', 'disabled', 'unsupported-key'] as const) {
            const commit = vi.fn(), module = providerModule(provider({ prepare: () => ({ status: 'skipped', reason: reason === 'absent' ? 'disabled' : reason }), commit }));
            const { runtime, ports } = setup([consumer(context => {
                expect(context.prepareOptionalReward(capability, 'known', 'once')).toEqual({ status: 'skipped', reason });
                expect(claim(context)).toEqual({ status: 'skipped', reason });
            }), ...(reason === 'absent' ? [] : [module])]);
            const before = runtime.snapshot(); runtime.command(command());
            expect(runtime.snapshot()).toEqual(before); expect(commit).not.toHaveBeenCalled();
            expect(ports.message).not.toHaveBeenCalled(); expect(ports.randomInt).not.toHaveBeenCalled();
        }
    });
    it('prepares frozen own player data, expires live access and reruns preparation before applying', () => {
        let prepared!: OptionalRewardPrepareContext;
        const prepare = vi.fn((_request, context: OptionalRewardPrepareContext): OptionalRewardPreparation => {
            prepared = context;
            expect(Object.keys(context).sort()).toEqual(['getPlayerComponent', 'player', 'playerId', 'resources', 'state']);
            expect(Object.isFrozen(context.player)).toBe(true); expect(Object.isFrozen(context.resources)).toBe(true);
            return { status: 'ready', plan: { amount: 3 } };
        });
        const { runtime, player, ports } = setup([providerModule(provider({ prepare })), consumer(context => {
            expect(context.prepareOptionalReward(capability, 'known', 'once')).toEqual({ status: 'ready' });
            expect(() => prepared.getPlayerComponent('reward')).toThrow('Expired');
            expect(claim(context)).toEqual({ status: 'applied' });
        })]);
        runtime.command(command()); expect(prepare).toHaveBeenCalledTimes(2);
        expect(player.maxHp).toBe(33); expect(player.hp).toBe(33); expect(player.strength).toBe(13); expect(ports.gold!()).toBe(8);
        expect(ports.message).toHaveBeenCalledExactlyOnceWith('reward committed'); expect(ports.randomInt).not.toHaveBeenCalled();
    });
    it('rejects duplicate providers and exact-shape/async preparation errors', () => {
        expect(() => setup([providerModule(), { ...providerModule(), id: 'other' }])).toThrow('Conflicting optional reward');
        for (const result of [{ status: 'ready' }, { status: 'ready', plan: {}, secret: true },
            { status: 'skipped', reason: 'absent' }, { status: 'skipped', reason: 'disabled', plan: {} }, { status: 'ready', plan: Infinity }, Promise.resolve({ status: 'ready', plan: {} })]) {
            const { runtime } = setup([providerModule(provider({ prepare: () => result as OptionalRewardPreparation })), consumer(context => { claim(context); })]);
            const before = runtime.snapshot(); expect(() => runtime.command(command())).toThrow(); expect(runtime.snapshot()).toEqual(before);
        }
    });
    it('rolls back provider resources, receipts, consumer facts, messages and counters after commit or later settlement failure', () => {
        for (const location of ['provider', 'consumer', 'settlement']) {
            const normal = provider();
            const { runtime, player, ports } = setup([providerModule(provider({ commit(request, plan, context) {
                normal.commit(request, plan, context); if (location === 'provider') throw new Error('failed provider');
            } })), consumer(context => {
                claim(context); context.commitFactRange(context.nextFactId, 4); context.setState({ claimed: true });
                context.message('consumer committed'); if (location === 'consumer') throw new Error('failed consumer');
            })]);
            const before = runtime.snapshot(), entityId = getNextEntityId();
            expect(() => runtime.command(command(), () => { if (location === 'settlement') throw new Error('failed settlement'); })).toThrow(`failed ${location}`);
            expect(runtime.snapshot()).toEqual(before); expect(getNextEntityId()).toBe(entityId);
            expect([player.hp, player.maxHp, player.strength, ports.gold!()]).toEqual([30, 30, 12, 5]); expect(ports.message).not.toHaveBeenCalled();
        }
    });
    it('forbids RNG, nested rewards, world/gate/action/fact mutation and captured consumer writes during prepare', () => {
        const attempts: Array<(context: ExtensionContext) => unknown> = [context => context.randomInt(0, 1), context => context.interactionGate(null),
            context => context.placeInteractables([]), context => context.grantReward({ recipientId: context.playerId, rewardId: 'known', instanceId: 'once' }),
            context => context.commitFactRange(context.nextFactId, 1), context => claim(context),
            context => context.executeAction({ actorId: context.playerId, action: 'wait', target: { kind: 'self' } }, { beforeCommit() {}, afterResolve() {} })];
        for (const attempt of attempts) {
            const { runtime, ports } = setup([providerModule(provider({ commit: (_request, _plan, context) => { attempt(context); } })), consumer(context => { claim(context); })]);
            const before = runtime.snapshot(); expect(() => runtime.command(command())).toThrow('forbidden');
            expect(runtime.snapshot()).toEqual(before); expect(ports.randomInt).not.toHaveBeenCalled();
        }
        let outer!: ExtensionContext;
        const { runtime } = setup([providerModule(provider({ prepare: () => { outer.setState({ leaked: true }); return { status: 'ready', plan: {} }; } })), consumer(context => { outer = context; claim(context); })]);
        const before = runtime.snapshot(); expect(() => runtime.command(command())).toThrow('outside'); expect(runtime.snapshot()).toEqual(before);
    });
    it('restores the native RNG checkpoint when final settlement draws and then fails', () => {
        let randomState = 12;
        const { runtime, ports } = setup([providerModule(), consumer(context => { claim(context); })]);
        ports.randomInt = vi.fn(() => ++randomState);
        ports.checkpointRandom = () => { const prior = randomState; return () => { randomState = prior; }; };
        const before = runtime.snapshot();
        expect(() => runtime.command(command(), () => { ports.randomInt(0, 100); throw new Error('late failure'); })).toThrow('late failure');
        expect(randomState).toBe(12); expect(runtime.snapshot()).toEqual(before); expect(ports.message).not.toHaveBeenCalled();
    });
    it('does not rewind native action allocators, RNG or causality without a complete native world rollback', () => {
        let randomState = 12, spawned!: Creature;
        const { runtime, ports } = setup([consumer(context => {
            context.executeAction({ actorId: context.playerId, action: 'wait', target: { kind: 'self' } }, { beforeCommit() {}, afterResolve() {} });
            throw new Error('after native action');
        })]);
        ports.randomInt = vi.fn(() => ++randomState);
        ports.checkpointRandom = () => { const prior = randomState; return () => { randomState = prior; }; };
        ports.executeAction = (_request, callbacks) => {
            callbacks.beforeCommit(); ports.randomInt(0, 100);
            spawned = new Creature(2, 2, 'native newborn', 'n', 1); runtime.attachCreature(spawned);
            const origin = runtime.causality.create('melee', spawned.id);
            runtime.captureDeath(spawned, false, origin); callbacks.afterResolve({ moved: false }); return true;
        };
        const entityId = getNextEntityId(), effectId = runtime.snapshot().foundation.causality.nextEffectId;
        expect(() => runtime.command(command())).toThrow('after native action');
        expect(getNextEntityId()).toBe(entityId + 1); expect(randomState).toBe(13);
        expect(runtime.snapshot().foundation.causality.nextEffectId).toBe(effectId + 1);
        expect(runtime.snapshot().foundation.deaths[String(spawned.id)]).toBeDefined();
    });
    it('retires an async commit context and rolls back synchronous writes', async () => {
        let continuation!: () => void, laterError: unknown;
        const { runtime, ports } = setup([providerModule(provider({ commit: (async (_request, _plan, context) => {
            context.setState({ leaked: true });
            await new Promise<void>(resolve => { continuation = resolve; });
            try { context.message('late'); } catch (error) { laterError = error; }
        }) as OptionalRewardProvider['commit'] })), consumer(context => { claim(context); })]);
        const before = runtime.snapshot(); expect(() => runtime.command(command())).toThrow('Async');
        continuation(); await Promise.resolve(); expect(laterError).toBeInstanceOf(Error);
        expect(runtime.snapshot()).toEqual(before); expect(ports.message).not.toHaveBeenCalled();
    });
});

describe('2c entered-level queue and global fact sequence', () => {
    it('leaves unsubscribed combinations inert and flushes ready entries once before settlement', () => {
        const inert = setup([base('consumer')]).runtime; enter(inert); expect(inert.snapshot().foundation).toMatchObject({ nextFactId: 1, pendingStoryFacts: [] });
        const calls: string[] = [];
        const { runtime } = setup([{ ...base('consumer'), hooks: {
            enteredLevel: () => { calls.push('placement'); },
            storyFact(event, context) { calls.push(`story:${event.factId}`); expect(event.turn).toBe(7); context.commitFactRange(event.factId, 3); },
            simulationSettled: () => { calls.push('settled'); },
        } }]);
        enter(runtime); expect(calls).toEqual(['placement']); runtime.settle([]); runtime.settle([]);
        expect(calls).toEqual(['placement', 'story:1', 'settled', 'settled']);
        expect(runtime.snapshot().foundation).toMatchObject({ nextFactId: 4, pendingStoryFacts: [] });
    });
    it('persists initialization facts and atomically restores the pending entry and sequence on failed final creation', () => {
        let fail = true;
        const module: ExtensionModule = { ...base('consumer'), initialState: () => ({ ready: false }),
            initializationReady: context => (context.state as { ready: boolean }).ready,
            commands: { claim: (_payload, context) => { context.setState({ ready: true }); } },
            hooks: { storyFact(event, context) { context.commitFactRange(event.factId, 2); context.setState({ ready: true, seen: event.factId }); context.message('story'); } } };
        const { runtime, ports } = setup([module]); enter(runtime); const initial = runtime.snapshot();
        expect(initial.foundation).toMatchObject({ nextFactId: 1, pendingStoryFacts: [{ kind: 'entered-level', depth: 1, firstVisit: true, turn: 7 }] });
        expect(() => runtime.command(command(), () => { if (fail) throw new Error('settle failed'); })).toThrow('settle failed');
        expect(runtime.snapshot()).toEqual(initial); expect(ports.message).not.toHaveBeenCalled();
        fail = false; runtime.command(command(), () => runtime.settle([]));
        expect(runtime.snapshot().foundation).toMatchObject({ nextFactId: 3, pendingStoryFacts: [] }); expect(ports.message).toHaveBeenCalledExactlyOnceWith('story');
        const restored = setup([module], initial).runtime; restored.command(command()); expect(restored.snapshot().foundation).toEqual(runtime.snapshot().foundation);
    });
    it('blocks ordinary inputs until creation and refuses save while a committed story entry remains queued', () => {
        const module: ExtensionModule = { ...base('consumer'), initialState: () => ({ ready: false }),
            initialCommand: { action: 'claim', payload: null },
            readyToSave: context => (context.state as { ready: boolean }).ready,
            commands: { claim: (_payload, context) => { context.setState({ ready: true }); } },
            hooks: { storyFact() {} } };
        const { runtime } = setup([module]); enter(runtime);
        expect(runtime.allowsInput('wait')).toBe(false); expect(runtime.allowsInput('ext:command', command())).toBe(true);
        expect(runtime.readyToSave).toBe(false); runtime.command(command());
        expect(runtime.readyToSave).toBe(true); expect(runtime.allowsInput('wait')).toBe(true);
        enter(runtime); expect(runtime.readyToSave).toBe(false); runtime.settle([]); expect(runtime.readyToSave).toBe(true);
    });
    it('rejects stale, invalid and overflowing ranges and invalid persisted queues', () => {
        for (const range of [[0, 1], [1, 0], [1, -1], [1, 1.5], [1, Number.MAX_SAFE_INTEGER]]) {
            const { runtime } = setup([consumer(context => { context.commitFactRange(range[0]!, range[1]!); })]);
            const before = runtime.snapshot(); expect(() => runtime.command(command())).toThrow('fact range'); expect(runtime.snapshot()).toEqual(before);
        }
        const { runtime } = setup([consumer(context => { context.commitFactRange(1, 1); context.commitFactRange(1, 1); })]);
        expect(() => runtime.command(command())).toThrow('fact range'); expect(runtime.snapshot().foundation.nextFactId).toBe(1);
        for (const change of [(snapshot: any) => { snapshot.foundation.version = 2; }, (snapshot: any) => { snapshot.foundation.nextFactId = 0; },
            (snapshot: any) => { snapshot.foundation.pendingStoryFacts = [{ kind: 'entered-level', depth: 1, firstVisit: true, turn: -1 }]; },
            (snapshot: any) => { snapshot.foundation.pendingStoryFacts = [{ kind: 'entered-level', depth: 1, firstVisit: true, turn: 0 }]; },
            (snapshot: any) => { snapshot.foundation.pendingStoryFacts = Array.from({ length: 4097 }, () => ({ kind: 'entered-level', depth: 1, firstVisit: true, turn: 0 })); }]) {
            const invalid = runtime.snapshot(); change(invalid); expect(() => runtime.validateSnapshot(invalid)).toThrow('foundation');
        }
    });
    it('validates queued origins against candidate readiness and candidate world instead of live state', () => {
        const module: ExtensionModule = { ...base('consumer'), initialState: () => ({ ready: false }),
            initializationReady: context => (context.state as { ready: boolean }).ready,
            commands: { claim: (_payload, context) => { context.setState({ ready: true }); } }, hooks: { storyFact() {} } };
        const { runtime } = setup([module]); enter(runtime); const origin = runtime.snapshot();
        runtime.command(command()); expect(runtime.readyToSave).toBe(true);
        // Validation on an already ready runtime still accepts a legitimate old origin.
        expect(() => runtime.validateSnapshot(origin)).not.toThrow();
        const initialized = structuredClone(origin); initialized.modules.consumer = { ready: true };
        expect(() => runtime.validateSnapshot(initialized)).toThrow('initialized snapshot');
        expect(() => setup([module], initialized)).toThrow('initialized snapshot');
        const valid = setup([module], origin);
        expect(() => valid.runtime.validateWorld([valid.player], { depth: 1, turn: 7, isGameOver: false, nextEntityId: getNextEntityId() })).not.toThrow();
        for (const [depth, turn] of [[2, 7], [1, 6]]) {
            expect(() => valid.runtime.validateWorld([valid.player], { depth: depth!, turn: turn!, isGameOver: false, nextEntityId: getNextEntityId() })).toThrow('world references');
        }
        // Own component readiness is likewise based on the candidate component set.
        const components: ExtensionModule = { ...module, initializationReady: context => context.getComponent(123, 'creation') !== undefined };
        const waiting = setup([components]); enter(waiting.runtime); const candidate = waiting.runtime.snapshot();
        candidate.components['123'] = { 'consumer:creation': { ready: true } };
        expect(() => waiting.runtime.validateSnapshot(candidate)).toThrow('initialized snapshot');
    });
    it('rejects injected post-initialization facts before replacing a live save or replay', () => {
        const registry = new ExtensionRegistry();
        registry.register('consumer', '1.0.0', () => ({ ...base('consumer'), initialState: () => ({ seen: 0 }), hooks: {
            storyFact(event, context) { context.commitFactRange(event.factId, 1); context.setState({ seen: (context.state as { seen: number }).seen + 1 }); },
        } }));
        const spy = vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        try {
            const game = createHeadlessGame(717, 'test');
            game.startNewGame({ seed: 717, mode: 'test', ruleSet: 'extended', extensions: ['consumer'] });
            game.executeCommand('wait');
            const active = game.extensionRuntime, player = game.player, before = active!.snapshot();
            const injected = { kind: 'entered-level' as const, depth: 2, firstVisit: true, turn: 999 };
            const save = game.toSaveSnapshot(); save.extensions!.foundation.pendingStoryFacts.push(injected);
            expect(game.loadSnapshot(save)).toBe(false); expect(game.extensionRuntime).toBe(active); expect(game.player).toBe(player);
            expect(active!.snapshot()).toEqual(before);
            const replay = game.exportRecording(); replay.events[0]!.extensions!.foundation.pendingStoryFacts.push(injected);
            expect(game.loadReplay(replay)).toBe(false); expect(game.extensionRuntime).toBe(active); expect(game.player).toBe(player);
            expect(active!.snapshot()).toEqual(before);
        } finally { spy.mockRestore(); }
    });
    it('restores committed entry queue and buffered messages when story settlement fails', () => {
        const { runtime, ports } = setup([{ ...base('consumer'), hooks: { storyFact(event, context) {
            context.commitFactRange(event.factId, 2); context.message('not committed'); throw new Error('story failed');
        } } }]);
        enter(runtime); const before = runtime.snapshot(); expect(() => runtime.settle([])).toThrow('story failed');
        expect(runtime.snapshot()).toEqual(before); expect(ports.message).not.toHaveBeenCalled();
    });
});
