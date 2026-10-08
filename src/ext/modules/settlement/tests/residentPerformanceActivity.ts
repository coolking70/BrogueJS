import { vi, expect } from 'vitest';
import type { Game } from '../../../../engine/Core/Game';
import type { WorldHarness } from '../../../worldSdk';
import { residentComponent, candidateSource } from '../../../../engine/Core/ResidentWorld';
import { residentPathMetrics, residentPathRebuilds } from '../../../../engine/Core/ResidentPathing';
import * as travel from '../../../../engine/Movement/LevelTravel';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
type Role = 'plant' | 'haul' | 'guard';
type Period = 'warmup' | 'ordinary' | 'summary';
const counts = () => ({
  commands: 0,
  ticketCommands: 0,
  pickupCommands: 0,
  carryingCommands: 0,
  plantingCommands: 0,
  deliveryCommands: 0,
  creditTicks: 0,
  completions: 0,
  moves: 0,
  positiveWaits: 0
});
export function residentPerformanceOrigin(g: Game) {
  const s = g.toSnapshot();
  return {
    seed: g.currentSeed,
    depth: g.depth,
    worldTick: g.world5!.simulationTicks,
    nativeTick: s.run.currentTick,
    turn: s.run.absoluteTurnNumber,
    player: s.player,
    rng: s.rngState,
    workers: s.monsters
      .filter((a) => candidateSource(g, a.id)?.source.kind === 'rescue')
      .map((a) => {
        const row = { ...a } as Record<string, unknown>;
        delete row.doesNotTrackLeader;
        delete row.leaderId;
        delete row.boundToLeader;
        return row;
      }),
    structures: s.run.world5!.structures,
    containers: s.run.world5!.containers.filter((c) => c.kind === 'chest'),
    items: s.entityGraph.items,
    intentionalDifferences: [
      'resident component/home index/ledger population',
      'doesNotTrackLeader; native allies follow instead of executing economic jobs'
    ]
  };
}
export function sampleResidentPerformance(
  h: WorldHarness,
  g: Game,
  registered: boolean,
  timed: boolean
) {
  const workers = g.monsters
    .filter((a) => candidateSource(g, a.id)?.source.kind === 'rescue')
    .sort((a, b) => a.id - b.id);
  expect(workers).toHaveLength(16);
  const cohort = new Map(
    workers.map((a, n) => [a.id, n < 4 ? 'plant' : n < 8 ? 'haul' : 'guard'] as [number, Role])
  );
  const native = new Map(workers.map((a) => [a.id, vi.spyOn(a, 'prepareNativeDecision')]));
  const path = vi.spyOn(travel, 'travelDistanceMap'),
    pathBefore = residentPathMetrics(g),
    pathTotalBefore = residentPathRebuilds(g);
  const activity = Object.fromEntries(
    (['warmup', 'ordinary', 'summary'] as Period[]).map((p) => [
      p,
      Object.fromEntries((['plant', 'haul', 'guard'] as Role[]).map((r) => [r, counts()]))
    ])
  ) as Record<Period, Record<Role, ReturnType<typeof counts>>>;
  const ordinary: number[] = [],
    summaries: { index: number; ms: number | null }[] = [],
    jobs = new Set<number>(),
    bundles = new Set<number>();
  const first = g.recordedInputEvents.length,
    start = g.world5!.simulationTicks;
  let ticketPeak = 0,
    creditPeak = 0;
  for (let n = 0; n < 320; n++) {
    const tick = g.world5!.simulationTicks,
      index = g.recordedInputEvents.length,
      ordinal = g.world5!.receipts[g.world5!.receipts.length - 1]?.ordinal ?? 0;
    const before = new Map(g.world5!.residentJobs.map((j) => [j.actorId, { ...j }]));
    const positions = new Map(workers.map((a) => [a.id, { ...a.loc }])),
      calls = new Map(workers.map((a) => [a.id, native.get(a.id)!.mock.calls.length]));
    expect(g.isGameOver).toBe(false);
    expect(g.hasPendingConfirmation).toBe(false);
    const t = timed ? performance.now() : 0;
    h.command('wait');
    const dt = timed ? performance.now() - t : null;
    expect(g.recordedInputEvents.length).toBe(index + 1);
    expect(g.world5!.simulationTicks).toBeGreaterThan(tick);
    if (dt !== null) expect(Number.isFinite(dt)).toBe(true);
    const event = g.recordedInputEvents[index]!,
      period: Period = n < 32 ? 'warmup' : event.fullCheckpoint !== null ? 'summary' : 'ordinary';
    if (event.fullCheckpoint !== null) summaries.push({ index: event.index, ms: dt });
    else if (n >= 32 && dt !== null) ordinary.push(dt);
    const after = new Map(g.world5!.residentJobs.map((j) => [j.actorId, j])),
      receipts = g.world5!.receipts.filter((r) => r.ordinal > ordinal);
    for (const a of workers) {
      const role = cohort.get(a.id)!,
        metric = activity[period][role],
        old = before.get(a.id),
        next = after.get(a.id),
        pos = positions.get(a.id)!;
      metric.commands++;
      const phases = new Set([old?.phase, next?.phase]);
      if (old || next) metric.ticketCommands++;
      for (const phase of ['pickup', 'carrying', 'planting', 'delivery'] as const)
        if (phases.has(phase)) metric[(phase + 'Commands') as 'pickupCommands']++;
      if (a.x !== pos.x || a.y !== pos.y) metric.moves++;
      else if (native.get(a.id)!.mock.calls.length > calls.get(a.id)! && a.ticksUntilTurn > 0)
        metric.positiveWaits++;
      if (
        old &&
        old.kind === role &&
        receipts.some((r) => r.identity === 'resident.' + old.id && r.result === 'completed')
      ) {
        metric.completions++;
        if (role === 'plant')
          metric.creditTicks += (100000 - old.creditTicks * 100 - old.creditRemainder) / 100;
      } else if (old?.phase === 'planting' && next?.id === old.id)
        metric.creditTicks += Math.max(
          0,
          next.creditTicks - old.creditTicks + (next.creditRemainder - old.creditRemainder) / 100
        );
    }
    for (const j of [...before.values(), ...after.values()]) {
      jobs.add(j.id);
      creditPeak = Math.max(creditPeak, j.creditTicks);
    }
    ticketPeak = Math.max(ticketPeak, before.size, after.size);
    for (const b of g.actorActions!.bundles) bundles.add(b.actionId);
  }
  expect(g.recordedInputEvents.length - first).toBe(320);
  expect(summaries.length).toBeGreaterThan(0);
  const pathAfter = residentPathMetrics(g),
    c = g.extensionRuntime!.worldCampState('settlement').camps.find((c) => c.depth === g.depth)!;
  const boxes = g.world5!.containers.filter(
    (b) =>
      b.kind === 'chest' &&
      b.id !== c.supplyId &&
      b.levelRef.kind === 'dungeon' &&
      b.levelRef.depth === g.depth
  );
  const crops = boxes
    .flatMap((b) => containerItems(g, b.id))
    .filter((i) => i.worldItem?.definitionId === 'settlement.crop')
    .reduce((n, i) => n + i.quantity, 0);
  const deliveredWood = boxes
    .flatMap((b) => containerItems(g, b.id))
    .filter((i) => i.worldItem?.definitionId === 'settlement.wood')
    .reduce((n, i) => n + i.quantity, 0);
  if (registered) {
    expect(g.world5!.residents).toHaveLength(16);
    expect(g.world5!.residents.every((r) => residentComponent(g, r.actorId)!.bedId !== null)).toBe(
      true
    );
    expect(crops).toBeGreaterThan(0);
    expect(deliveredWood).toBe(32);
    expect(activity.ordinary.plant.creditTicks).toBeGreaterThan(0);
    expect(activity.ordinary.haul.completions).toBeGreaterThan(0);
    expect(activity.ordinary.guard.moves).toBeGreaterThan(0);
    expect(activity.ordinary.guard.positiveWaits).toBeGreaterThan(0);
  }
  return {
    registered,
    start,
    end: g.world5!.simulationTicks,
    commands: 320,
    warmup: 32,
    ordinary,
    summaries,
    activity,
    crops,
    deliveredWood,
    pathRebuilds: residentPathRebuilds(g) - pathTotalBefore,
    cacheMisses: pathAfter.cacheMisses - pathBefore.cacheMisses,
    blockedBfs: pathAfter.blockedRebuilds - pathBefore.blockedRebuilds,
    nativeDistanceCalls: path.mock.calls.length,
    creditPeak,
    ticketPeak,
    jobs: [...jobs],
    bundles: [...bundles],
    worldBytes: Buffer.byteLength(JSON.stringify(g.world5)),
    saveBytes: Buffer.byteLength(h.save())
  };
}
