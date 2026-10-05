import { describe, expect, it, vi } from 'vitest';
import { RealtimeSimulationDriver } from '../engine/Simulation/RealtimeSimulationDriver';
import { SimulationHost } from '../engine/Simulation/SimulationHost';
import { advanceActorActionsOneTick } from '../engine/Simulation/ActorActionTick';
import { SHOOTER_PROFILE } from '../products/shooter/profile';
import { ShooterSession } from '../products/shooter/ShooterSession';
import { idleInput } from '../products/shooter/input/InputFrame';
import { InputFrameAssembler } from '../products/shooter/input/InputFrameAssembler';

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
    it('rejects reentrant pumping without double advancement', () => {
        let driver: RealtimeSimulationDriver;
        driver = new RealtimeSimulationDriver(profile, () => { driver.pump(40000); });
        driver.pump(0);
        expect(() => driver.pump(40000)).toThrow('Reentrant');
        expect(() => driver.pump(50000)).toThrow('Reentrant');
    });
});

describe('S0 production scheduler integration', () => {
    it('resolves actual phases on exact ticks without input on the intermediate boundaries', () => {
        const session = new ShooterSession();
        session.advanceTick({ ...idleInput(1), buttons: 1 });
        expect(session.snapshot().actors.map(a => a.ticksUntilTurn)).toEqual([5, 8]);
        for (let tick = 2; tick <= 5; tick++) session.advanceTick(idleInput(tick));
        expect(session.snapshot().actors.map(a => a.resolved)).toEqual([0, 0]);
        session.advanceTick(idleInput(6));
        expect(session.snapshot().actors.map(a => a.resolved)).toEqual([1, 0]);
        for (let tick = 7; tick <= 9; tick++) session.advanceTick(idleInput(tick));
        expect(session.snapshot().actors.map(a => [a.resolved, a.lastPulseTick, a.ticksUntilTurn])).toEqual([[2, 9, 18], [1, 9, 3]]);
        expect(session.snapshot().rng.randomNumbersGenerated).toBe(3);
        for (let tick = 10; tick <= 30; tick++) session.advanceTick(idleInput(tick));
        expect(session.snapshot().actions.bundles).toEqual([]);
        expect(session.snapshot().actors.map(a => a.ticksUntilTurn)).toEqual([0, 0]);
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
        const session = new ShooterSession(), before = session.snapshot();
        const getter = vi.fn(() => 1), accessor = { ...idleInput(1) };
        Object.defineProperty(accessor, 'tick', { get: getter, enumerable: true });
        for (const input of [idleInput(2), { ...idleInput(1), moveX: 1 }, { ...idleInput(1), buttons: 2 }, accessor]) {
            expect(() => session.advanceTick(input)).toThrow();
            expect(session.snapshot()).toEqual(before);
        }
        expect(getter).not.toHaveBeenCalled();
        session.advanceTick(idleInput(1));
        const after = session.snapshot();
        expect(() => session.advanceTick(idleInput(1))).toThrow();
        expect(session.snapshot()).toEqual(after);
    });
    it('captures input once across render frames and consumes busy pulses without queuing', () => {
        const assembler = new InputFrameAssembler(), session = new ShooterSession();
        assembler.requestPulse(); assembler.requestPulse();
        session.advanceTick(assembler.next(1));
        expect(assembler.next(2).buttons).toBe(0);
        session.advanceTick({ ...idleInput(2), buttons: 1 });
        for (let tick = 3; tick <= 31; tick++) session.advanceTick(idleInput(tick));
        expect(session.snapshot().actors[0]!.resolved).toBe(2);
        assembler.requestPulse(); assembler.clear();
        expect(assembler.next(32).buttons).toBe(0);
    });
    it('exposes detached previous/current snapshots and poisons a failed host', () => {
        const session = new ShooterSession(), host = new SimulationHost(session);
        host.step(idleInput(1));
        const pair = host.snapshots();
        expect([pair.previous.tick, pair.current.tick]).toEqual([0, 1]);
        pair.current.actors[0]!.resolved = 100;
        expect(host.snapshots().current.actors[0]!.resolved).toBe(0);
        expect(() => host.step(idleInput(1))).toThrow();
        expect(() => host.snapshots()).toThrow();
        expect(() => host.step(idleInput(2))).toThrow();
    });
});
