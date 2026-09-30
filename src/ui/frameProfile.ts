/** Opt-in, in-page diagnostics only. No storage, network, game state or RNG writes. */
export function timingSummary(values: readonly number[]) {
    const sorted = [...values].sort((a, b) => a - b);
    const at = (fraction: number) => Math.round((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0) * 100) / 100;
    return { n: sorted.length, median: at(.5), p95: at(.95), max: at(1), over50: values.filter(v => v > 50).length };
}
export class FrameProfile {
    private samples: Record<string, number[]> = {};
    private previousFrame = 0;
    private previousAuto = false;
    private lastReport = 0;
    private autoSteps = 0;
    private draws = 0;
    reset() { this.samples = {}; this.previousFrame = 0; this.previousAuto = false; this.lastReport = 0; this.autoSteps = 0; this.draws = 0; }
    record(kind: string, elapsed: number) {
        const values = this.samples[kind] ??= [];
        values.push(elapsed);
        if (values.length > 1800) values.shift();
        if (kind === 'drawCpuMs') this.draws++;
        if (kind === 'autoStepCpuMs') this.autoSteps++;
    }
    frame(now: number, auto: boolean) {
        if (this.previousFrame) {
            this.record('frameMs', now - this.previousFrame);
            if (auto && this.previousAuto) this.record('autoFrameMs', now - this.previousFrame);
        }
        this.previousFrame = now; this.previousAuto = auto;
    }
    report(now: number, state: Record<string, unknown>): string | null {
        if (now - this.lastReport < 1000) return null;
        this.lastReport = now;
        return JSON.stringify({ ...state, autoSteps: this.autoSteps, draws: this.draws, sampleLimit: 1800, timings: Object.fromEntries(Object.entries(this.samples).map(([key, samples]) => [key, timingSummary(samples)])) }, null, 1);
    }
}
