import { assertSimulationProfile, type SimulationProfile } from './SimulationProfile';

const MICROSECONDS_PER_SECOND = 1_000_000;
export interface ClockSample {
    readonly steps: number;
    readonly backlogTicks: number;
    readonly alpha: number;
    readonly paused: boolean;
}

/** Wall clock adapter only. Feed rounded absolute monotonic microseconds, not
 * rounded per-frame deltas. Integer tick credit avoids 30/60/144 Hz drift.
 * A bounded pump retains debt, making overload observable instead of losing ticks.
 * Neither wall time nor the interpolation remainder enters mechanical snapshots.
 */
export class RealtimeSimulationDriver {
    private lastUs: number | null = null;
    private credit = 0;
    private stopped = false;
    private pumping = false;
    private fault: Error | null = null;
    private readonly hz: number;

    constructor(profile: SimulationProfile, private readonly step: () => void, readonly maxTicksPerPump = 8) {
        assertSimulationProfile(profile);
        if (!Number.isSafeInteger(maxTicksPerPump) || maxTicksPerPump < 1 || maxTicksPerPump > 1000)
            throw new Error('Invalid tick pump budget');
        this.hz = profile.ticksPerSecond;
    }

    get paused(): boolean { return this.stopped; }
    pause(): void { this.check(); this.stopped = true; this.lastUs = null; }
    resume(): void { this.check(); if (this.stopped) { this.stopped = false; this.lastUs = null; } }

    sample(steps = 0): ClockSample {
        this.check();
        const backlogTicks = Math.floor(this.credit / MICROSECONDS_PER_SECOND);
        return { steps, backlogTicks, alpha: backlogTicks ? 1 : this.credit / MICROSECONDS_PER_SECOND, paused: this.stopped };
    }

    private check(): void {
        if (this.fault) throw this.fault;
        if (this.pumping) throw new Error('Reentrant clock operation');
    }

    /** A smaller per-pump budget lets a bounded recording stop exactly at its
     * final tick, even when this render frame has accumulated catch-up debt. */
    pump(nowUs: number, stepBudget = this.maxTicksPerPump): ClockSample {
        this.check();
        if (!Number.isInteger(stepBudget) || stepBudget < 0 || stepBudget > this.maxTicksPerPump) throw new Error('Invalid pump step budget');
        if (!Number.isSafeInteger(nowUs) || nowUs < 0) throw new Error('Invalid monotonic timestamp');
        if (this.stopped) return this.sample();
        if (this.lastUs === null) { this.lastUs = nowUs; return this.sample(); }
        const delta = nowUs - this.lastUs;
        if (delta < 0) throw new Error('Clock moved backwards');
        const credit = this.credit + delta * this.hz;
        if (!Number.isSafeInteger(credit)) throw new Error('Clock credit overflow');
        this.lastUs = nowUs;
        this.credit = credit;
        let steps = 0;
        this.pumping = true;
        try {
            while (this.credit >= MICROSECONDS_PER_SECOND && steps < stepBudget) {
                const result: unknown = this.step();
                if (result && typeof result === 'object' && 'then' in result) throw new Error('Asynchronous clock callback');
                this.credit -= MICROSECONDS_PER_SECOND;
                steps++;
            }
        } catch (error) {
            this.fault = error instanceof Error ? error : new Error(String(error));
            throw this.fault;
        } finally { this.pumping = false; }
        return this.sample(steps);
    }
}
