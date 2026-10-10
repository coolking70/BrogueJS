import { expect } from 'vitest';
import { residentScene } from './residentHelpers';
import { build, base, current } from './helpers';
import type { ResidentJob } from '../../../residentSdk';
import { worldHarnessGame } from '../../../testing/worldHarness';
import { residentHasNativePriority } from '../../../../engine/Core/ResidentJobs';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { TerrainType } from '../../../../engine/Map/Grid';
import type { Game } from '../../../../engine/Core/Game';
import type { WorldHarness } from '../../../worldSdk';
export function assign(h: WorldHarness, g: Game, id: number, job: ResidentJob) {
  const c = current(g),
    r = residentComponent(g, id)!;
  return h.ext('settlement', 'assign-job', {
    v: 1,
    stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
    campId: c.regionId,
    campRevision: c.revision,
    targetId: id,
    targetRevision: r.revision,
    job,
    inventoryStamp: base(g).inventoryStamp,
    sourceRevision:
      job.kind === 'plant' || job.kind === 'haul'
        ? g.world5!.containers.find((b) => b.id === job.sourceId)!.revision
        : null,
    destinationRevision:
      job.kind === 'plant' || job.kind === 'haul'
        ? g.world5!.containers.find((b) => b.id === job.destinationId)!.revision
        : null,
    componentRevisions:
      job.kind === 'plant'
        ? job.plotIds.map(
            (id) => g.world5!.structures.find((s) => s.fixture?.id === id)!.fixture!.revision
          )
        : []
  });
}
export function scene() {
  const { h, g, a } = residentScene();
  g.player.loc = { x: 20, y: 14 };
  g.refreshStructureDerivedState();
  expect(h.ext('settlement', 'build', build(g, 'plot', { x: 19, y: 15 })).error).toBeNull();
  expect(h.ext('settlement', 'build', build(g, 'chest', { x: 20, y: 15 })).error).toBeNull();
  const dst = g.world5!.containers.find((b) => b.id !== current(g).supplyId && b.kind === 'chest')!;
  const plot = g.world5!.structures.find(
    (s) => s.fixture?.definitionId === 'settlement.plot'
  )!.fixture!;
  g.grid.setTerrain(19, 17, TerrainType.WATER_SHALLOW);
  g.player.loc = { x: 22, y: 12 };
  g.refreshStructureDerivedState();
  const seed = g.player.inventory.items.find(
      (i) => i.worldItem?.definitionId === 'settlement.seed'
    )!,
    c = current(g);
  expect(
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: c.supplyId,
      containerRevision: g.world5!.containers.find((b) => b.id === c.supplyId)!.revision,
      direction: 'deposit',
      items: [{ itemId: seed.id, quantity: 6 }]
    }).error
  ).toBeNull();
  g.player.loc = { x: 19, y: 13 };
  g.refreshStructureDerivedState();
  h.load(JSON.stringify(g.toSnapshot()));
  return {
    h,
    g,
    a: g.monsters.find((m) => m.id === a.id)!,
    src: current(g).supplyId,
    dst: dst.id,
    plot: plot.id
  };
}
export function waitUntil(h: WorldHarness, check: () => boolean, limit = 100) {
  for (let n = 0; n < limit && !check(); n++) h.command('wait');
  if (!check()) {
    const g = worldHarnessGame(h);
    console.log(
      JSON.stringify({
        tick: g.world5!.simulationTicks,
        rows: g.world5!.residents.map((r) => {
          const a = g.monsters.find((a) => a.id === r.actorId)!;
          return {
            at: a.loc,
            timer: a.ticksUntilTurn,
            component: residentComponent(g, a.id),
            priority: residentHasNativePriority(g, a)
          };
        }),
        needs: g.world5!.offline.map((l) => l.residentStates),
        jobs: g.world5!.residentJobs,
        light: g.lightMap.lightSumAt(19, 15)
      })
    );
  }
  expect(check()).toBe(true);
}
