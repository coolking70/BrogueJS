import { describe, expect, it, vi } from 'vitest';
import { RealtimeSimulationDriver } from '../engine/Simulation/RealtimeSimulationDriver';
import { SimulationHost } from '../engine/Simulation/SimulationHost';
import { rng } from '../engine/Random';
import { ShooterSession } from '../products/shooter/ShooterSession';
import { idleInput } from '../products/shooter/input/InputFrame';
import { SHOOTER_PROFILE } from '../products/shooter/profile';

const input = (tick: number) => {
    const phase = Math.floor((tick - 1) % 480 / 120);
    const direction = [[127, 0], [0, 127], [-127, 0], [0, -127]][phase]!;
    return { ...idleInput(tick), moveX: direction[0]!, moveY: direction[1]!, buttons: (tick - 1) % 60 === 0 ? 1 : 0 };
};
const TICKS = 18_000;
function reference() {
    const session = new ShooterSession(42, { modules: [] });
    for (let tick = 1; tick <= TICKS; tick++) session.advanceTick(input(tick));
    return session.snapshot();
}
describe('S1 ten-minute movement and action determinism', () => {
    it.each([30, 60, 144])('matches headless after 600 simulated seconds at %i render FPS without backlog', fps => {
        const expected = reference(), session = new ShooterSession(42, { modules: [] }), host = new SimulationHost(session);
        const driver = new RealtimeSimulationDriver(SHOOTER_PROFILE.simulation, () => host.step(input(host.tick + 1)));
        driver.pump(0);
        let peakBacklog = 0;
        for (let frame = 1; frame <= 600 * fps; frame++) {
            const sample = driver.pump(Math.round(frame * 1e6 / fps));
            peakBacklog = Math.max(peakBacklog, sample.backlogTicks);
        }
        expect(host.tick).toBe(TICKS);
        expect(session.snapshot()).toEqual(expected);
        expect(expected.modules).toEqual([]);
        expect(expected.actors[0]!.contactTicks.water).toBeGreaterThan(0);
        expect(peakBacklog).toBe(0);
    });
    it('matches headless through jitter, catch-up and interleaved independent sessions without global RNG/wall time', () => {
        const globalBefore = rng.getState(), expected = reference();
        const now = vi.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Mechanical wall clock'); });
        const perf = vi.spyOn(performance, 'now').mockImplementation(() => { throw new Error('Mechanical performance clock'); });
        try {
            const a = new ShooterSession(42, { modules: [] }), b = new ShooterSession(99, { modules: [] });
            const driver = new RealtimeSimulationDriver(SHOOTER_PROFILE.simulation, () => {
                a.advanceTick(input(a.tick + 1)); b.advanceTick(idleInput(b.tick + 1));
            });
            driver.pump(0);
            let time = 0, frame = 0, peakBacklog = 0;
            const cadence = [4000, 7000, 31000, 800000, 9000];
            while (time < 600e6) {
                time = Math.min(600e6, time + cadence[frame++ % cadence.length]!);
                peakBacklog = Math.max(peakBacklog, driver.pump(time).backlogTicks);
            }
            while (driver.sample().backlogTicks) driver.pump(time);
            expect(peakBacklog).toBeGreaterThan(0);
            expect(a.snapshot()).toEqual(expected);
            expect(b.snapshot().actors[0]!.pose).toEqual({ x: 5632, y: 10752, facing: 0 });
            expect(rng.getState()).toEqual(globalBefore);
        } finally { now.mockRestore(); perf.mockRestore(); }
    });
});
