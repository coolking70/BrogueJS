import { assertTick } from './SimulationProfile';

/** An engine-owned synchronous tick boundary, shared by local input and replay.
 * The core owns authoritative state; snapshots must be detached plain data.
 */
export interface SimulationCore<Input, Snapshot> {
    readonly tick: number;
    advanceTick(input: Input): void;
    snapshot(): Snapshot;
}

export class SimulationHost<Input, Snapshot> {
    private prior: Snapshot;
    private current: Snapshot;
    private advancing = false;
    private fault: unknown = null;

    constructor(private readonly core: SimulationCore<Input, Snapshot>) {
        assertTick(core.tick);
        this.prior = this.current = core.snapshot();
    }

    get tick(): number { return this.core.tick; }

    step(input: Input): void {
        if (this.fault) throw this.fault;
        if (this.advancing) throw new Error('Reentrant simulation tick');
        const expected = this.tick + 1;
        assertTick(expected);
        this.advancing = true;
        try {
            const result: unknown = this.core.advanceTick(input);
            if (result && typeof result === 'object' && 'then' in result) throw new Error('Asynchronous simulation tick');
            if (this.tick !== expected) throw new Error('Simulation must advance exactly one tick');
            this.prior = this.current;
            this.current = this.core.snapshot();
        } catch (error) {
            // An engine failure is not rolled back. Never resume or export this host as valid.
            this.fault = error instanceof Error ? error : new Error(String(error));
            throw this.fault;
        } finally { this.advancing = false; }
    }

    snapshots(): { previous: Snapshot; current: Snapshot } {
        if (this.fault) throw this.fault;
        return { previous: structuredClone(this.prior), current: structuredClone(this.current) };
    }
}
