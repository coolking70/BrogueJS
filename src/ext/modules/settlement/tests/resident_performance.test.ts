import { it, expect, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { prepareResidentPerformance } from './residentPerformanceScene';
import {
  residentPerformanceOrigin,
  sampleResidentPerformance
} from './residentPerformanceActivity';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';
import { advanceWorldClock } from '../../../world5';
import { ItemCategory } from '../../../../engine/Items/Item';
import { candidateSource } from '../../../../engine/Core/ResidentWorld';
const quantile = (v: number[], q: number) =>
  v.slice().sort((a, b) => a - b)[Math.ceil(v.length * q) - 1]!;

// Execute this timing suite only in the parent's arranged quiet window.
// Scene construction, strict load validation and persistence are outside timing.
it('measures 320 actual recorded inputs with positive plant/haul/guard/needs load against the matched native origin', () => {
  let baseline: ReturnType<typeof residentPerformanceOrigin> | undefined;
  const sample = (registered: boolean) => {
    vi.restoreAllMocks();
    const { h, g } = prepareResidentPerformance(registered);
    try {
      const origin = residentPerformanceOrigin(g);
      if (!registered) baseline = origin;
      else expect(origin).toEqual(baseline);
      const result = sampleResidentPerformance(h, g, registered, true);
      return {
        origin,
        ...result,
        p95: quantile(result.ordinary, 0.95),
        median: quantile(result.ordinary, 0.5),
        ordinaryPeak: Math.max(...result.ordinary),
        summaryPeak: Math.max(...result.summaries.map((s) => s.ms!))
      };
    } finally {
      h.dispose();
      vi.restoreAllMocks();
    }
  };
  const control = sample(false),
    residents = sample(true),
    report = {
      runtime: process.version,
      heapLimitMiB: 3072,
      control,
      residents,
      ordinaryP95Difference: residents.p95 - control.p95
    };
  if (process.env.RESIDENT_PERF_OUT)
    writeFileSync(process.env.RESIDENT_PERF_OUT, JSON.stringify(report, null, 2) + '\n');
  expect(report.ordinaryP95Difference).toBeLessThanOrEqual(5);
});

it('measures real four-camp/64-worker long needs commits with native FOOD, bounded facts and source GC', () => {
  vi.restoreAllMocks();
  const { h, g } = prepareResidentPerformance(true, 4);
  try {
    const initial = h.save(),
      start = g.world5!.simulationTicks,
      target = 1000000000;
    const stock = g.extensionRuntime!.worldCampState('settlement').camps.map((c) => ({
      slot: c.slot,
      quantity: containerItems(g, c.supplyId)
        .filter((i) => i.category === ItemCategory.FOOD)
        .reduce((n, i) => n + i.quantity, 0)
    }));
    expect(stock.every((c) => c.quantity > 0 && c.quantity <= 64)).toBe(true);
    expect(g.world5!.residents).toHaveLength(64);
    const workerIds = g.world5!.residents.map((r) => r.actorId);
    const samples: number[] = [],
      digests: string[] = [];
    for (let n = 0; n < 8; n++) {
      h.load(initial);
      advanceWorldClock(g.world5!, target - start);
      const t = performance.now();
      settleResidentNeeds(g);
      samples.push(performance.now() - t);
      expect(Number.isFinite(samples[n])).toBe(true);
      expect(g.world5!.residents).toHaveLength(0);
      expect(g.world5!.residentJobs).toHaveLength(0);
      expect(workerIds.every((id) => candidateSource(g, id) === undefined)).toBe(true);
      expect(g.world5!.receipts.length).toBeLessThanOrEqual(128);
      for (const c of g.extensionRuntime!.worldCampState('settlement').camps) {
        expect(
          containerItems(g, c.supplyId).filter((i) => i.category === ItemCategory.FOOD)
        ).toHaveLength(0);
        expect(c.consumedLockedUnits).toBe(2);
      }
      digests.push(h.digest());
    }
    expect(new Set(digests).size).toBe(1);
    const digest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(digest);
    const report = {
      runtime: process.version,
      heapLimitMiB: 3072,
      start,
      target,
      stock,
      retiredWorkerSources: workerIds.length,
      cold: samples[0],
      warm: samples.slice(1),
      peak: Math.max(...samples),
      worldBytes: Buffer.byteLength(JSON.stringify(g.world5)),
      saveBytes: Buffer.byteLength(h.save()),
      digest
    };
    if (process.env.RESIDENT_PERF_OUT)
      writeFileSync(
        process.env.RESIDENT_PERF_OUT + '.64.json',
        JSON.stringify(report, null, 2) + '\n'
      );
    expect(report.peak).toBeLessThanOrEqual(50);
  } finally {
    h.dispose();
    vi.restoreAllMocks();
  }
});
