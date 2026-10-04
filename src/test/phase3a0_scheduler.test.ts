import { describe, expect, it, vi } from 'vitest';
import { advancementLoop, type TimePorts } from '../engine/Core/TimeCoordinator';
import {
    createActorActionBundle, createActorActionScheduler, snapshotActorActionSchedulerState,
    validateActorActionSchedulerState, type ActorActionBundleDefinition, type ActorActionPhase,
    type ActorActionSchedulerHost, type ActorActionSchedulerState, type ActorSubactionDefinition,
} from '../engine/Core/ActorActionScheduler';
import type { Monster } from '../entities/Monster';

function phases(windup = 20, recovery = 10): ActorActionPhase[] {
    return [{ kind: 'windup', durationTicks: windup, segmentIndex: 0 },
        { kind: 'recovery', durationTicks: recovery, segmentIndex: null }];
}
function child(sourceEntityId: number, sourcePartId = 'body', duration = phases()): ActorSubactionDefinition {
    return { sourceEntityId, sourcePartId, sourceFootprintVersion: `fixture:${sourceEntityId}`, phases: duration };
}
function definition(owner: number, subactions = [child(owner)], actionId = owner): ActorActionBundleDefinition {
    return { actionId, depth: 1, decisionOwnerId: owner, timeChargeOwnerId: owner, subactions };
}
function actor(id: number, ticksUntilTurn: number): Monster {
    return { id, hp: 10, ticksUntilTurn, movementSpeed: 100, isCaged: false, carriedItem: null,
        hasStatus: () => false, hasBehavior: () => false } as unknown as Monster;
}
function fixture(playerTicks = 100, others: Monster[] = [], ownerOf: (id: number) => number = id => id) {
    const player = actor(1, playerTicks);
    const actors = [player, ...others];
    const state: ActorActionSchedulerState = { schema: 1, bundles: [] };
    const events: string[] = [];
    const invalidSources = new Set<number>();
    const host: ActorActionSchedulerHost = {
        decisionOwnerId: ownerOf,
        readActor(id) { const found = actors.find(a => a.id === id); return found ? { alive: found.hp > 0, ticksUntilTurn: found.ticksUntilTurn } : null; },
        writeOwnerTicks(id, ticks) { actors.find(a => a.id === id)!.ticksUntilTurn = ticks; },
        isSourceValid(source, depth) { return depth === 1 && source.sourceFootprintVersion === `fixture:${source.sourceEntityId}` && !invalidSources.has(source.sourceEntityId); },
        resolveSegment: vi.fn(boundary => events.push(`resolve:${boundary.decisionOwnerId}:${boundary.sourceSubactionId}:${boundary.segmentIndex}`)),
        finishAction: vi.fn((bundle, reason) => events.push(`finish:${bundle.decisionOwnerId}:${bundle.elapsedActionTicks}:${reason}`)),
        onFault: vi.fn(),
    };
    const scheduler = createActorActionScheduler(state, host);
    const ports = {
        world: { player, monsters: others },
        clock: { ticksTillUpdateEnvironment: 100, isGameOver: false, playerFalling: false, animationPauseMs: 0, animationEnabled: false },
        effects: {
            objectiveTimeBlock: vi.fn(() => events.push('environment')),
            isAutoTraveling: () => false,
            monsterTakeTurn: vi.fn((m: Monster) => events.push(`native:${m.id}`)),
            monsterDropItem: vi.fn(),
            sweepDeepWaterItem: vi.fn((m: Monster, ticks: number) => events.push(`sweep:${m.id}:${ticks}`)),
        },
        actions: scheduler,
    } as unknown as TimePorts;
    return { player, actors, state, host, scheduler, ports, events, invalidSources,
        drain: () => { for (const _ of advancementLoop(ports, 0)) { /* deterministic animation acknowledgements */ } } };
}

describe('3a0 persistent actor action scheduler', () => {
    it('advances the supplied countdown once and derives native mirrors from the minimum child boundary', () => {
        const f = fixture(15, [actor(2, 100)]);
        f.scheduler.commitBundle(createActorActionBundle(definition(2)));
        f.drain();
        expect(f.state.bundles[0]!.elapsedActionTicks).toBe(15);
        expect(f.state.bundles[0]!.subactions[0]!.phaseRemainingTicks).toBe(5);
        expect(f.actors[1]!.ticksUntilTurn).toBe(5);
        expect(f.events).toEqual([]);
        expect(f.scheduler.snapshot()).toEqual(f.state);
    });

    it('keeps a player busy through all phases without opening input between them', () => {
        const f = fixture();
        f.scheduler.commitBundle(createActorActionBundle(definition(1, [child(1, 'body', [
            { kind: 'windup', durationTicks: 7, segmentIndex: 0 },
            { kind: 'inter-segment', durationTicks: 11, segmentIndex: 1 },
            { kind: 'recovery', durationTicks: 13, segmentIndex: null },
        ])])));
        f.drain();
        expect(f.events).toEqual(['resolve:1:1:0', 'resolve:1:1:1', 'finish:1:31:completed']);
        expect(f.player.ticksUntilTurn).toBe(0);
        expect(f.state.bundles).toEqual([]);
        expect(f.ports.clock.ticksTillUpdateEnvironment).toBe(69);
    });

    it('uses max complete duration for four parallel children, stable part IDs and min next boundary', () => {
        const f = fixture(100, [actor(2, 0), actor(3, 0), actor(4, 0)], () => 1);
        f.scheduler.commitBundle(createActorActionBundle(definition(1, [
            child(4, 'd', phases(11, 7)), child(2, 'b', phases(3, 8)),
            child(1, 'a', phases(3, 2)), child(3, 'c', phases(6, 7)),
        ])));
        expect(f.scheduler.nextActionBoundary()).toBe(3);
        expect(f.state.bundles[0]!.subactions.map(c => [c.sourcePartId, c.sourceSubactionId])).toEqual([['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
        f.drain();
        expect(f.events).toEqual(['resolve:1:1:0', 'resolve:1:2:0', 'resolve:1:3:0', 'resolve:1:4:0', 'finish:1:18:completed']);
        expect(f.ports.clock.ticksTillUpdateEnvironment).toBe(82);
        expect(f.actors.slice(1).map(a => a.ticksUntilTurn)).toEqual([0, 0, 0]);
    });

    it('filters non-core members in soonest, decrement and ready traversals', () => {
        const f = fixture(25, [actor(2, 50), actor(3, -99)], id => id === 3 ? 2 : id);
        f.drain();
        expect(f.actors[1]!.ticksUntilTurn).toBe(25);
        expect(f.actors[2]!.ticksUntilTurn).toBe(-99);
        expect(f.ports.effects.monsterTakeTurn).not.toHaveBeenCalled();
        expect(f.ports.clock.ticksTillUpdateEnvironment).toBe(75);
    });

    it('keeps exact native array order when no scheduler provider is present', () => {
        const f = fixture(10, [actor(3, 10), actor(2, 10)]);
        delete f.ports.actions;
        f.drain();
        expect(f.events).toEqual(['native:3', 'sweep:3:100', 'native:2', 'sweep:2:100']);
    });

    it('orders opt-in owners by ID and environmental effects before releases and player input', () => {
        const f = fixture(20, [actor(3, 30), actor(2, 30)]);
        f.ports.clock.ticksTillUpdateEnvironment = 20;
        f.scheduler.commitBundle(createActorActionBundle(definition(3)));
        f.scheduler.commitBundle(createActorActionBundle(definition(2)));
        f.drain();
        expect(f.events).toEqual(['environment', 'resolve:2:1:0', 'resolve:3:1:0']);
        expect(f.player.ticksUntilTurn).toBe(0);
        expect(f.state.bundles.map(b => b.subactions[0]!.phaseRemainingTicks)).toEqual([10, 10]);
    });

    it('suppresses releases after same-tick environment kills their owner', () => {
        const monster = actor(2, 30);
        const f = fixture(20, [monster]);
        f.ports.clock.ticksTillUpdateEnvironment = 20;
        f.ports.effects.objectiveTimeBlock = () => { f.events.push('environment-death'); monster.hp = 0; };
        f.scheduler.commitBundle(createActorActionBundle(definition(2)));
        f.drain();
        expect(f.events).toEqual(['environment-death']);
        expect(f.state.bundles).toEqual([]);
        expect(f.host.finishAction).not.toHaveBeenCalled();
    });

    it('does not run native AI or per-phase sweeps while busy; grants one decision on terminal readiness', () => {
        const f = fixture(35, [actor(2, 100)]);
        f.scheduler.commitBundle(createActorActionBundle(definition(2)));
        f.drain();
        expect(f.events).toEqual(['resolve:2:1:0', 'finish:2:30:completed', 'native:2', 'sweep:2:100']);
        expect(f.ports.effects.monsterTakeTurn).toHaveBeenCalledTimes(1);
        expect(f.actors[1]!.ticksUntilTurn).toBe(95);
        expect(f.host.finishAction).toHaveBeenCalledTimes(1);
    });

    it('checks source eligibility between same-tick child releases', () => {
        const f = fixture(100, [actor(2, 0)], () => 1);
        f.host.resolveSegment = boundary => {
            f.events.push(`resolve:${boundary.sourceSubactionId}`);
            f.invalidSources.add(2);
        };
        f.scheduler.commitBundle(createActorActionBundle(definition(1, [child(2, 'b'), child(1, 'a')])));
        f.drain();
        expect(f.events).toEqual(['resolve:1', 'finish:1:30:completed']);
    });

    it('serializes a cancelled source while a sibling continues and never revives its release', () => {
        const f = fixture(100, [actor(2, 0)], () => 1);
        f.scheduler.commitBundle(createActorActionBundle(definition(1, [child(1, 'a'), child(2, 'b')])));
        f.scheduler.advanceActionTime(5);
        f.invalidSources.add(2);
        f.scheduler.cancelDeadActions();
        const saved = f.scheduler.snapshot();
        expect(saved.bundles[0]!.subactions[1]!.cancelled).toBe(true);
        f.scheduler.rebind(saved);
        f.drain();
        expect(f.events).toEqual(['resolve:1:1:0', 'finish:1:30:completed']);
    });

    it('rebinds deterministic persistent phases without effects, timer repairs or random draws', () => {
        const f = fixture(5, [actor(2, 100)]);
        f.scheduler.commitBundle(createActorActionBundle(definition(2)));
        f.drain();
        const saved = JSON.parse(JSON.stringify(f.scheduler.snapshot())) as ActorActionSchedulerState;
        const write = vi.spyOn(f.host, 'writeOwnerTicks');
        const rebound = createActorActionScheduler(saved, f.host);
        rebound.rebind(saved);
        expect(write).not.toHaveBeenCalled();
        expect(f.host.resolveSegment).not.toHaveBeenCalled();
        expect(f.host.finishAction).not.toHaveBeenCalled();
        expect(rebound.nextActionBoundary()).toBe(15);
        rebound.advanceActionTime(15);
        rebound.dispatchActorBoundary(2);
        expect(f.events).toEqual(['resolve:2:1:0']);
    });

    it('rejects inconsistent saved mirrors and mechanical source identity without repairing the candidate', () => {
        const f = fixture(100, [actor(2, 100)]);
        f.scheduler.commitBundle(createActorActionBundle(definition(2)));
        const saved = f.scheduler.snapshot();
        f.actors[1]!.ticksUntilTurn = 19;
        const write = vi.spyOn(f.host, 'writeOwnerTicks');
        expect(() => f.scheduler.rebind(saved)).toThrow(/mirror/);
        expect(write).not.toHaveBeenCalled();
        f.actors[1]!.ticksUntilTurn = 20;
        saved.bundles[0]!.subactions[0]!.sourceFootprintVersion = 'other';
        expect(() => f.scheduler.rebind(saved)).toThrow(/source binding/);
        expect(f.scheduler.snapshot().bundles[0]!.subactions[0]!.sourceFootprintVersion).toBe('fixture:2');
    });

    it('fails closed on resolution exceptions and cannot replay or rebind the failed microstep', () => {
        const f = fixture(100, [actor(2, 100)]);
        f.scheduler.commitBundle(createActorActionBundle(definition(2)));
        f.host.resolveSegment = () => { throw new Error('injected resolution failure'); };
        f.scheduler.advanceActionTime(20);
        expect(() => f.scheduler.dispatchActorBoundary(2)).toThrow('injected resolution failure');
        expect(f.host.onFault).toHaveBeenCalledTimes(1);
        expect(() => f.scheduler.advanceActionTime(1)).toThrow('injected resolution failure');
        expect(() => f.scheduler.rebind({ schema: 1, bundles: [] })).toThrow('injected resolution failure');
        expect(() => f.scheduler.dispatchActorBoundary(2)).toThrow('injected resolution failure');
        expect(f.ports.effects.monsterTakeTurn).not.toHaveBeenCalled();
    });

    it('fails closed on mirror setter failure rather than continuing with split clocks', () => {
        const f = fixture();
        f.host.writeOwnerTicks = () => { throw new Error('mirror failed'); };
        expect(() => f.scheduler.commitBundle(createActorActionBundle(definition(1)))).toThrow('mirror failed');
        expect(f.host.onFault).toHaveBeenCalledOnce();
        expect(f.state.bundles).toEqual([]);
        expect(() => f.scheduler.nextActionBoundary()).toThrow('mirror failed');
    });

    it('rejects more than four members, mismatched owners, zero phases and malformed clocks', () => {
        expect(() => createActorActionBundle(definition(1, [1, 2, 3, 4, 5].map(id => child(id, String(id)))))).toThrow();
        expect(() => createActorActionBundle({ ...definition(1), timeChargeOwnerId: 2 })).toThrow();
        expect(() => createActorActionBundle(definition(1, [child(1, 'body', phases(0))]))).toThrow();
        const state: ActorActionSchedulerState = { schema: 1, bundles: [createActorActionBundle(definition(1))] };
        state.bundles[0]!.elapsedActionTicks = 1;
        expect(() => validateActorActionSchedulerState(state)).toThrow(/phase clock/);
        state.bundles[0]!.elapsedActionTicks = 0;
        expect(snapshotActorActionSchedulerState(state)).toEqual(state);
        state.bundles[0]!.subactions[0]!.sourceSubactionId = 2;
        expect(() => validateActorActionSchedulerState(state)).toThrow(/subaction/);
    });

    it('rejects asynchronous resolution and permanently closes the synchronous authority', () => {
        const f = fixture(100, [actor(2, 100)]);
        f.scheduler.commitBundle(createActorActionBundle(definition(2)));
        f.host.resolveSegment = async () => undefined;
        f.scheduler.advanceActionTime(20);
        expect(() => f.scheduler.dispatchActorBoundary(2)).toThrow(/asynchronous/);
        expect(f.host.onFault).toHaveBeenCalledOnce();
        expect(() => f.scheduler.snapshot()).toThrow(/asynchronous/);
    });

    it('restores the old mirror when a commit setter mutates and then throws', () => {
        const f = fixture(77);
        let first = true;
        f.host.writeOwnerTicks = (_owner, ticks) => {
            f.player.ticksUntilTurn = ticks;
            if (first) { first = false; throw new Error('partial setter failure'); }
        };
        expect(() => f.scheduler.commitBundle(createActorActionBundle(definition(1)))).toThrow('partial setter failure');
        expect(f.player.ticksUntilTurn).toBe(77);
        expect(f.state.bundles).toEqual([]);
        expect(f.host.onFault).toHaveBeenCalledOnce();
    });

    it('detaches saved data and preserves later-phase order when bound to a rebuilt index', () => {
        const f = fixture(100, [actor(2, 100)]);
        f.scheduler.commitBundle(createActorActionBundle(definition(2, [child(2, 'body', [
            { kind: 'windup', durationTicks: 3, segmentIndex: 0 },
            { kind: 'inter-segment', durationTicks: 5, segmentIndex: 1 },
            { kind: 'recovery', durationTicks: 7, segmentIndex: null },
        ])])));
        f.scheduler.advanceActionTime(3);
        f.scheduler.dispatchActorBoundary(2);
        const saved = f.scheduler.snapshot();
        const detachedCopy = f.scheduler.snapshot();
        detachedCopy.bundles[0]!.subactions[0]!.phaseRemainingTicks = 999;
        expect(f.scheduler.nextActionBoundary()).toBe(5);
        const rebuilt = createActorActionScheduler(saved, f.host);
        rebuilt.advanceActionTime(5);
        rebuilt.dispatchActorBoundary(2);
        const recovery = rebuilt.snapshot();
        const third = createActorActionScheduler(recovery, f.host);
        third.advanceActionTime(7);
        expect(third.dispatchActorBoundary(2)).toBe('native-fallback');
        expect(f.events).toEqual(['resolve:2:1:0', 'resolve:2:1:1', 'finish:2:15:completed']);
    });

    it('defers the native sweep when a free NPC decision commits a new action', () => {
        const f = fixture(10, [actor(2, 10)]);
        f.ports.effects.monsterTakeTurn = m => {
            f.events.push(`select:${m.id}`);
            f.scheduler.commitBundle(createActorActionBundle(definition(m.id)));
        };
        f.drain();
        expect(f.events).toEqual(['select:2']);
        expect(f.ports.effects.sweepDeepWaterItem).not.toHaveBeenCalled();
        expect(f.actors[1]!.ticksUntilTurn).toBe(20);
        expect(f.state.bundles[0]!.elapsedActionTicks).toBe(0);
    });

    it('rejects non-JSON descriptors without invoking getters or changing clocks', () => {
        const getter = vi.fn(() => 1);
        const malicious = definition(1);
        Object.defineProperty(malicious, 'actionId', { enumerable: true, get: getter });
        expect(() => createActorActionBundle(malicious)).toThrow(/definition/);
        expect(getter).not.toHaveBeenCalled();
        const valid = { schema: 1, bundles: [createActorActionBundle(definition(1))] };
        Object.defineProperty(valid.bundles[0]!, 'actionId', { enumerable: true, get: getter });
        expect(() => validateActorActionSchedulerState(valid)).toThrow();
        expect(getter).not.toHaveBeenCalled();
        const symbolState = { schema: 1, bundles: [], [Symbol('hidden')]: true };
        expect(() => validateActorActionSchedulerState(symbolState)).toThrow();
        class DecoratedState { schema = 1; bundles = []; }
        expect(() => validateActorActionSchedulerState(new DecoratedState())).toThrow();
        const sparse = { schema: 1, bundles: Array(1) };
        expect(() => validateActorActionSchedulerState(sparse)).toThrow();
    });

    it('rejects duplicate bundles before any owner timer write', () => {
        const f = fixture();
        f.scheduler.commitBundle(createActorActionBundle(definition(1)));
        const before = f.scheduler.snapshot();
        const write = vi.spyOn(f.host, 'writeOwnerTicks');
        expect(() => f.scheduler.commitBundle(createActorActionBundle(definition(1)))).toThrow(/duplicate/);
        expect(write).not.toHaveBeenCalled();
        expect(f.scheduler.snapshot()).toEqual(before);
    });
});
