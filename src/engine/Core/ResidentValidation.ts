/** Strict production references, evaluated on a decoded candidate before live retirement. */
import type { Game } from './Game';
import { ItemCategory } from '../Items/Item';
import type { ResidentComponent, ResidentSource } from '../../ext/residentSdk';
import { uint, exact, World5Error } from '../../ext/worldBasics';
import {
  residentActors,
  residentEligible,
  residentBedIds,
  inResidentCamp,
  campBox
} from './ResidentWorld';
const fail = (field: string): never => {
  throw new World5Error('C5_BAD_REFERENCE', 'resident.' + field);
};
export function validateResidentReferences(g: Game): void {
  const rt = g.extensionRuntime,
    w = g.world5;
  if (!rt || !w) return;
  const actors = residentActors(g),
    owners = rt.residentOwners(),
    seenBeds = new Set<number>(),
    granaries = new Set<number>();
  for (const owner of owners) {
    const state = rt.worldCampState(owner),
      policy = rt.residentPolicy(owner)!;
    let rescues = 0;
    for (const id of rt.residentComponentIds(owner, 'source')) {
      const a = actors.find((a) => a.id === id),
        source = rt.residentComponent<ResidentSource>(owner, id, 'source')!;
      if (!a || a.hp <= 0 || a.isClone) fail('source.actor');
      if (source.kind === 'spawn') {
        const slot = state.spawnSlots.find((s) => s.actorId === id && s.status === 'placed');
        if (
          !slot ||
          source.key !== `${owner}.spawn.${slot.depth}` ||
          (!source.consumed && !residentEligible(g, a!))
        )
          fail('source.spawn');
      } else {
        if (
          source.key !== `${owner}.rescue.${id}` ||
          (!source.consumed &&
            (!policy.rescuedTemplates.includes(a!.typeId) || !residentEligible(g, a!)))
        )
          fail('source.rescue');
        if (!source.consumed) rescues++;
      }
    }
    if (rescues > 64) fail('source.budget');
    for (const slot of state.spawnSlots)
      if (slot.status === 'placed' && !rt.residentComponent(owner, slot.actorId!, 'source'))
        fail('source.slot');
    for (const c of state.camps) {
      for (const id of c.granaryIds) {
        if (granaries.has(id)) fail('granary.duplicate');
        granaries.add(id);
        campBox(g, c, id);
      }
      const rows = w.residents.filter((r) => r.owner === owner && r.campSlotId === c.slot),
        legalBeds = residentBedIds(g, c);
      if (rows.length > 16) fail('population');
      if (
        w.structures.filter(
          (s) => s.regionId === c.regionId && s.fixture?.definitionId === owner + '.plot'
        ).length > 12
      )
        fail('plots.budget');
      for (const row of rows) {
        const a = actors.find((a) => a.id === row.actorId),
          r = rt.residentComponent<ResidentComponent>(owner, row.actorId, 'resident'),
          source = rt.residentComponent<ResidentSource>(owner, row.actorId, 'source');
        if (
          !a ||
          !residentEligible(g, a) ||
          !r ||
          !source?.consumed ||
          r.campId !== c.regionId ||
          r.campOrdinal !== c.ordinal ||
          row.levelRef.kind !== 'dungeon' ||
          row.levelRef.depth !== c.depth
        )
          fail('home');
        if (r!.bedId !== null) {
          if (seenBeds.has(r!.bedId) || !legalBeds.includes(r!.bedId)) fail('bed');
          seenBeds.add(r!.bedId);
        }
        const need = w.offline
          .find((l) => l.campSlotId === c.slot)
          ?.residentStates.find((s) => s.actorId === row.actorId);
        if (!need?.alive || need.departed) fail('needs');
        if (
          r!.job.kind === 'plant' &&
          r!.job.plotIds.some(
            (id) =>
              !w.structures.some(
                (s) =>
                  s.regionId === c.regionId &&
                  s.fixture?.id === id &&
                  s.fixture.definitionId === owner + '.plot'
              )
          )
        )
          fail('job.plot');
        if (r!.job.kind === 'plant' || r!.job.kind === 'haul') {
          campBox(g, c, r!.job.sourceId);
          campBox(g, c, r!.job.destinationId);
        }
        if (r!.job.kind === 'guard' && !inResidentCamp(g, c, r!.job.at, c.depth)) fail('guard');
      }
    }
    for (const id of rt.residentComponentIds(owner, 'resident'))
      if (!w.residents.some((r) => r.owner === owner && r.actorId === id)) fail('orphan.component');
    for (const p of state.plotDays)
      if (
        !w.structures.some(
          (s) => s.fixture?.id === p.componentId && s.fixture.definitionId === owner + '.plot'
        )
      )
        fail('plotDay');
  }
  for (const j of w.residentJobs) {
    exact(
      j,
      'id,owner,actorId,campId,depth,kind,actionId,sourceId,destinationId,cargoId,plotId,phase,anchor,hp,reservedSlots,creditTicks,creditRemainder,status,pendingCompletion,day',
      'residentJob'
    );
    for (const n of [
      'id',
      'actorId',
      'campId',
      'depth',
      'sourceId',
      'destinationId',
      'cargoId',
      'hp',
      'reservedSlots'
    ] as const)
      uint(j[n], n, 1);
    for (const n of ['creditTicks', 'creditRemainder', 'day'] as const) uint(j[n], n);
    if (
      j.creditTicks > 1000 ||
      j.creditRemainder >= 100 ||
      !['plant', 'haul'].includes(j.kind) ||
      !['pickup', 'carrying', 'planting', 'delivery'].includes(j.phase) ||
      !['working', 'suspended'].includes(j.status) ||
      typeof j.pendingCompletion !== 'boolean'
    )
      fail('ticket.shape');
    const r = rt.residentComponent<ResidentComponent>(j.owner, j.actorId, 'resident'),
      camp = rt.worldCampState(j.owner).camps.find((c) => c.regionId === j.campId),
      cargo = w.containers.find((c) => c.id === j.cargoId);
    if (
      !owners.includes(j.owner) ||
      !r ||
      r.mode !== 'stay' ||
      !camp ||
      camp.depth !== g.depth ||
      j.depth !== camp.depth ||
      !cargo ||
      cargo.owner !== j.owner ||
      cargo.kind !== 'escrow' ||
      cargo.ticketId !== j.id ||
      cargo.itemIds.length !== 1
    )
      fail('ticket.owner');
    campBox(g, camp!, j.sourceId);
    campBox(g, camp!, j.destinationId);
    const item = g.worldContainerItems!.get(cargo!.itemIds[0]!);
    if (
      !item ||
      item.quantity < 1 ||
      (j.kind === 'plant' &&
        (item.quantity !== 1 ||
          item.worldItem?.definitionId !== j.owner + '.seed' ||
          !w.structures.some(
            (s) => s.fixture?.id === j.plotId && s.fixture.definitionId === j.owner + '.plot'
          ))) ||
      (j.kind === 'haul' && (item.quantity > 8 || j.plotId !== null))
    )
      fail('ticket.item');
    if (
      r!.job.kind !== j.kind ||
      (r!.job.kind === 'plant' &&
        (!r!.job.plotIds.includes(j.plotId!) ||
          r!.job.sourceId !== j.sourceId ||
          r!.job.destinationId !== j.destinationId)) ||
      (r!.job.kind === 'haul' &&
        (r!.job.sourceId !== j.sourceId ||
          r!.job.destinationId !== j.destinationId ||
          r!.job.quantity !== item!.quantity))
    )
      fail('ticket.plan');
    if (
      (j.kind === 'plant' && j.phase === 'delivery') ||
      (j.kind === 'haul' && j.phase === 'planting') ||
      (j.phase !== 'planting' && (j.creditTicks !== 0 || j.creditRemainder !== 0)) ||
      (j.creditTicks === 1000 && j.creditRemainder !== 0) ||
      j.day > Math.floor(w.simulationTicks / 32000)
    )
      fail('ticket.phase');
    const reserved =
      j.kind === 'plant' ||
      [ItemCategory.MATERIAL, ItemCategory.WEAPON, ItemCategory.GEM].includes(item!.category)
        ? 1
        : item!.quantity;
    if (j.reservedSlots !== reserved) fail('ticket.reservation');
    if (
      (j.pendingCompletion && (j.status !== 'working' || j.phase === 'carrying')) ||
      (j.actionId !== null && j.phase === 'carrying')
    )
      fail('ticket.pending');
    exact(j.anchor, 'x,y', 'anchor');
    uint(j.anchor.x, 'x', 1);
    uint(j.anchor.y, 'y', 1);
    if (!g.grid.isValidPos(j.anchor.x, j.anchor.y)) fail('ticket.anchor');
    if (j.actionId !== null) {
      uint(j.actionId, 'actionId', 1);
      const b = g.actorActions?.bundles.find((b) => b.actionId === j.actionId);
      if (
        !b ||
        b.owner !== 'foundation' ||
        b.decisionOwnerId !== j.actorId ||
        b.timeChargeOwnerId !== j.actorId ||
        b.subactions.length !== 1 ||
        b.subactions[0]!.sourceEntityId !== j.actorId ||
        b.subactions[0]!.sourcePartId !== 'body' ||
        b.subactions[0]!.phases.length !== 1 ||
        b.subactions[0]!.phases[0]!.kind !== 'recovery' ||
        b.subactions[0]!.phases[0]!.segmentIndex !== null ||
        b.depth !== j.depth ||
        j.status !== 'working' ||
        j.pendingCompletion
      )
        fail('ticket.clock');
    } else if (
      !j.pendingCompletion &&
      j.phase !== 'carrying' &&
      (j.phase !== 'planting' || j.status !== 'suspended' || j.creditTicks >= 1000)
    )
      fail('ticket.missingClock');
  }
}
