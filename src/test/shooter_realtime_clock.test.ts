import { describe, expect, it, vi } from 'vitest';
import { RealtimeSimulationDriver } from '../engine/Simulation/RealtimeSimulationDriver';
import { SimulationHost } from '../engine/Simulation/SimulationHost';
import { advanceActorActionsOneTick } from '../engine/Simulation/ActorActionTick';
import { SHOOTER_PROFILE } from '../products/shooter/profile';
import { ShooterSession } from '../products/shooter/ShooterSession';
import { idleInput } from '../products/shooter/input/InputFrame';
import { InputFrameAssembler } from '../products/shooter/input/InputFrameAssembler';
import { createActorActionBundle, createActorActionScheduler } from '../engine/Core/ActorActionScheduler';

const profile = SHOOTER_PROFILE.simulation;
describe('S0 fixed tick driver', () => {
    it('retains fractional credit, has an exact one-second boundary, and never steps at initialization', () => {
        const step = vi.fn(), driver = new RealtimeSimulationDriver(profile, step);
        expect(driver.pump(900000).steps).toBe(0);
        expect(driver.pump(933333).steps).toBe(0);
        expect(driver.pump(933334).steps).toBe(1);
        for (let frame = 3; frame <= 60; frame++) driver.pump(900000 + Math.round(frame * 1e6 / 60));
        expect(step).toHaveBeenCalledTimes(30);
        expect(driver.sample()).toMatchObject({ alpha: 0, backlogTicks: 0 });
    });
    it('bounds catch-up work and exposes every retained tick of debt', () => {
        const step = vi.fn(), driver = new RealtimeSimulationDriver(profile, step, 4);
        driver.pump(0);
        expect(driver.pump(1e6)).toMatchObject({ steps: 4, backlogTicks: 26, alpha: 1 });
        for (let i = 0; i < 7; i++) driver.pump(1e6);
        expect(step).toHaveBeenCalledTimes(30);
        expect(driver.sample()).toMatchObject({ backlogTicks: 0, alpha: 0 });
    });
    it('excludes paused wall time and preserves the already earned fraction and debt', () => {
        const step = vi.fn(), driver = new RealtimeSimulationDriver(profile, step, 1);
        driver.pump(0); driver.pump(50000); driver.pause();
        driver.pump(10000000); driver.resume(); driver.pump(20000000);
        expect(step).toHaveBeenCalledTimes(1);
        expect(driver.pump(20016667).steps).toBe(1);
        driver.pump(20116667); driver.pause();
        const debt = driver.sample().backlogTicks;
        expect(debt).toBeGreaterThan(0);
        driver.resume(); driver.pump(30000000);
        expect(driver.sample().backlogTicks).toBe(debt);
        driver.pump(30000000);
        expect(driver.sample().backlogTicks).toBe(debt - 1);
    });
    it('rejects invalid clocks atomically, and permanently stops on a tick failure', () => {
        const step = vi.fn(), driver = new RealtimeSimulationDriver(profile, step);
        driver.pump(100);
        for (const stamp of [99, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) expect(() => driver.pump(stamp)).toThrow();
        expect(driver.pump(33434).steps).toBe(1);
        const bad = new RealtimeSimulationDriver(profile, () => { throw new Error('fault'); });
        bad.pump(0);
        expect(() => bad.pump(40000)).toThrow('fault');
        expect(() => bad.pump(80000)).toThrow('fault');
        expect(() => bad.resume()).toThrow('fault');
        const asynchronous = new RealtimeSimulationDriver(profile, () => Promise.resolve());
        asynchronous.pump(0);
        expect(() => asynchronous.pump(40000)).toThrow('Asynchronous');
    });
    it('honors a final-tick budget during catch-up without advancing beyond a recording horizon', () => {
        let tick = 99;
        const driver = new RealtimeSimulationDriver(profile, () => { tick++; if (tick > 100) throw new Error('past horizon'); });
        driver.pump(0); expect(driver.pump(1e6, 1).steps).toBe(1); expect(tick).toBe(100);
        expect(driver.pump(1e6, 0).steps).toBe(0); driver.pause(); expect(driver.sample().paused).toBe(true);
        expect(() => driver.pump(2e6, 9)).toThrow();
    });
    it('rejects reentrant pumping without double advancement', () => {
        let driver: RealtimeSimulationDriver;
        driver = new RealtimeSimulationDriver(profile, () => { driver.pump(40000); });
        driver.pump(0);
        expect(() => driver.pump(40000)).toThrow('Reentrant');
        expect(() => driver.pump(50000)).toThrow('Reentrant');
    });
});

describe('S0 production scheduler integration', () => {
    it('resolves production scheduler phases on exact ticks without further input', () => {
        const actor = { ticks: 0, resolved: 0 };
        const actions = createActorActionScheduler({ schema: 1, bundles: [] }, {
            decisionOwnerId: id => id, readActor: () => ({ alive: true, ticksUntilTurn: actor.ticks }),
            writeOwnerTicks: (_id, ticks) => { actor.ticks = ticks; }, isSourceValid: () => true,
            resolveSegment: () => { actor.resolved++; }, finishAction: () => {}, onFault: error => { throw error; },
        });
        actions.commitBundle(createActorActionBundle({ actionId: 1, depth: 1, decisionOwnerId: 1, timeChargeOwnerId: 1,
            subactions: [{ sourceEntityId: 1, sourcePartId: 'body', sourceFootprintVersion: 'fixture-v1', phases: [
                { kind: 'windup', durationTicks: 6, segmentIndex: 0 }, { kind: 'inter-segment', durationTicks: 3, segmentIndex: 1 },
                { kind: 'recovery', durationTicks: 18, segmentIndex: null },
            ] }] }));
        for (let tick = 1; tick <= 27; tick++) {
            advanceActorActionsOneTick(actions, [1]);
            expect(actor.resolved).toBe(tick < 6 ? 0 : tick < 9 ? 1 : 2);
            if (tick === 9) expect(actor.ticks).toBe(18);
        }
        expect(actor.ticks).toBe(0); expect(actions.snapshot().bundles).toEqual([]);
    });
    it('orders core owners once and never double-decrements native mirrors or dispatches members', () => {
        const calls: string[] = [];
        advanceActorActionsOneTick({
            isDecisionOwner: id => id !== 3,
            isBusy: () => true, nextActionBoundary: () => 1,
            cancelDeadActions: () => { calls.push('cancel'); },
            advanceActionTime: delta => { calls.push(`advance:${delta}`); },
            dispatchActorBoundary: id => { calls.push(`dispatch:${id}`); return 'handled'; },
        }, [3, 2, 1, 2]);
        expect(calls).toEqual(['cancel', 'advance:1', 'dispatch:1', 'dispatch:2']);
    });
    it('rejects malformed, duplicate and unsupported input before mechanical mutation', () => {
        const session = new ShooterSession(7301, { modules: [] }), before = session.snapshot();
        const getter = vi.fn(() => 1), accessor = { ...idleInput(1) };
        Object.defineProperty(accessor, 'tick', { get: getter, enumerable: true });
        for (const input of [idleInput(2), { ...idleInput(1), moveX: 128 }, { ...idleInput(1), buttons: 2 }, accessor]) {
            expect(() => session.advanceTick(input)).toThrow();
            expect(session.snapshot()).toEqual(before);
        }
        expect(getter).not.toHaveBeenCalled();
        session.advanceTick(idleInput(1));
        const after = session.snapshot();
        expect(() => session.advanceTick(idleInput(1))).toThrow();
        expect(session.snapshot()).toEqual(after);
    });
    it('captures a short fire press once, retains held fire, and clears commands on blur', () => {
        const a = new InputFrameAssembler(); a.setFire(true); a.setFire(false);
        expect(a.next(1).buttons).toBe(1); expect(a.next(2).buttons).toBe(0);
        a.setFire(true); expect(a.next(3).buttons).toBe(1); expect(a.next(4).buttons).toBe(1);
        a.requestReload(); a.requestEquip(2); a.clear();
        expect(a.next(5).buttons).toBe(0); expect(a.nextCommands(5)).toEqual([]);
    });
    it('exposes detached previous/current snapshots and poisons a failed host', () => {
        const session = new ShooterSession(7301, { modules: [] }), host = new SimulationHost(session);
        host.step(idleInput(1));
        const pair = host.snapshots();
        expect([pair.previous.tick, pair.current.tick]).toEqual([0, 1]);
        pair.current.actors[0]!.lastHitTick = 100;
        expect(host.snapshots().current.actors[0]!.lastHitTick).toBe(0);
        expect(() => host.step(idleInput(1))).toThrow();
        expect(() => host.snapshots()).toThrow();
        expect(() => host.step(idleInput(2))).toThrow();
    });
});
