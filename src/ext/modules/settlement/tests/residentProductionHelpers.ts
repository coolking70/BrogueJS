import { current, base } from './helpers';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import type { Game } from '../../../../engine/Core/Game';
export function payload(g: Game, id: number, recipeId = 'settlement.hunt', batchCount = 4) {
  const c = current(g),
    r = residentComponent(g, id)!;
  return {
    v: 1,
    stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
    campId: c.regionId,
    campRevision: c.revision,
    targetId: id,
    targetRevision: r.revision,
    recipeId,
    batchCount,
    sourceId: c.supplyId,
    sourceRevision: g.world5!.containers.find((b) => b.id === c.supplyId)!.revision,
    destinationId: c.supplyId,
    destinationRevision: g.world5!.containers.find((b) => b.id === c.supplyId)!.revision,
    stationId: null,
    stationRevision: null,
    plotIds: [],
    plotRevisions: [],
    inventoryStamp: base(g).inventoryStamp
  };
}
