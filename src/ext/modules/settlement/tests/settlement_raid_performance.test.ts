import { it, expect, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { prepareResidentPerformance } from './residentPerformanceScene';
import { travelScenes } from './helpers';
import { campRaid } from '../../../../engine/Core/SettlementRaids';
import { advanceWorldClock } from '../../../world5';
const p95 = (times: number[]) => times.sort((a, b) => a - b)[Math.ceil(times.length * 0.95) - 1]!;
it('affected 16-resident Game: paid public inputs and a long frozen interval remain bounded with native actors and immutable ticket ownership', () => {
  const samples: { enabled: boolean; p95: number; long: number }[] = [];
  for (const enabled of [false, true]) {
    vi.restoreAllMocks();
    const { h, g } = prepareResidentPerformance(true, 1, enabled);
    travelScenes();
    try {
      expect(g.world5!.residents).toHaveLength(16);
      if (enabled) {
        h.command('wait');
        for (let n = 0; n < 100 && campRaid(g, 0)!.event?.phase !== 'active'; n++)
          h.command('wait');
        expect(campRaid(g, 0)!.event?.phase).toBe('active');
      }
      g.player.loc = { x: 30, y: 25 };
      g.refreshStructureDerivedState();
      h.command('stairs_down');
      expect(g.depth).toBe(2);
      const tickets = structuredClone(g.world5!.tickets),
        times: number[] = [];
      for (let n = 0; n < 160; n++) {
        const start = performance.now();
        h.command('wait');
        const ms = performance.now() - start;
        if (n >= 32 && !g.recordedInputEvents[g.recordedInputEvents.length-1]!.fullCheckpoint) times.push(ms);
      }
      if (enabled) expect(g.world5!.tickets).toEqual(tickets);
      advanceWorldClock(g.world5!, 32000 * 1000);
      const start = performance.now();
      h.command('wait');
      const long = performance.now() - start;
      if (enabled) {
        expect(g.world5!.tickets).toEqual(tickets);
        expect(g.world5!.residents).toHaveLength(16);
        expect(campRaid(g, 0)!.pauseFrom).not.toBeNull();
      }
      samples.push({ enabled, p95: p95(times), long });
    } finally {
      h.dispose();
      vi.restoreAllMocks();
    }
  }
  if (process.env.RAID_PERF_OUT)
    writeFileSync(
      process.env.RAID_PERF_OUT,
      JSON.stringify(
        { runtime: process.version, samples, p95Added: samples[1]!.p95 - samples[0]!.p95 },
        null,
        2
      ) + '\n'
    );
  expect(samples[1]!.p95 - samples[0]!.p95).toBeLessThanOrEqual(5);
  expect(samples[1]!.long).toBeLessThanOrEqual(50);
});
