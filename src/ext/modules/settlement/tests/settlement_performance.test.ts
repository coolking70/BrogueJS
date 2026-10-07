import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { setup, establish, build } from './helpers';
const quantile = (v: number[], q: number) =>
  [...v].sort((a, b) => a - b)[Math.ceil(v.length * q) - 1]!;
it('records ordinary command costs separately from the existing 256-command full summary', () => {
  const sample = (built: boolean) => {
    const { h, g } = setup();
    if (built) {
      expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
      for (const name of ['wood-floor', 'roof', 'door', 'bed'])
        expect(h.ext('settlement', 'build', build(g, name, { x: 20, y: 13 })).error).toBeNull();
    }
    const ordinary: number[] = [],
      full: number[] = [],
      ticks: number[] = [];
    for (let i = 0; i < 320; i++) {
      const index = g.recordedInputEvents.length;
      const t = performance.now();
      h.command('wait');
      const dt = performance.now() - t;
      ticks.push(g.world5!.simulationTicks);
      if ((index + 1) % 256 === 0) full.push(dt);
      else if (i >= 32) ordinary.push(dt);
    }
    expect(ticks.every((t, i) => i === 0 || t > ticks[i - 1]!)).toBe(true);
    return {
      ordinary,
      full,
      p95: quantile(ordinary, 0.95),
      median: quantile(ordinary, 0.5),
      max: Math.max(...ordinary),
      summaryPeak: Math.max(...full)
    };
  };
  const control = sample(false),
    camp = sample(true),
    report = {
      runtime: process.version,
      heap: process.env.NODE_OPTIONS,
      control,
      camp,
      ordinaryP95Difference: camp.p95 - control.p95,
      browserFPS: null
    };
  if (process.env.SETTLEMENT_PERF_OUT)
    writeFileSync(process.env.SETTLEMENT_PERF_OUT, JSON.stringify(report, null, 2) + '\n');
  expect(report.ordinaryP95Difference).toBeLessThanOrEqual(5);
});
