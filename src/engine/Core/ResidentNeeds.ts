import type { Game } from './Game';
import {
  planOfflineSettlement,
  offlineOwnershipSignature,
  RESIDENT_OFFLINE_RULES
} from './WorldSettlement';
import { containerRead } from './WorldWorkWorld';
import { structureDefinition } from '../Map/StructureWorld';
import { checkedAdd } from '../../ext/worldBasics';
import {
  residentComponent,
  residentRecord,
  residentBedIds,
  residentRations,
  residentActors,
  transactResidentWorld,
  publishResident
} from './ResidentWorld';
import { settleDepartures } from './ActorDeparture';
import { removeResident, batchResidentSourceTerminations } from './ResidentProduction';
import { invalidateNeeds } from './ActorNeeds';
import { markRecordingRoot } from '../../ext/recordingRevisions';
/** Ledger high water survives both synchronous and animated failures. */
export function hasPendingResidentNeeds(g: Game): boolean {
  const w = g.world5,
    runtime = g.extensionRuntime;
  if (!w || !runtime || g.isGameOver) return false;
  return runtime.residentOwners().some((owner) =>
    runtime.worldCampRecords(owner).some((camp) => {
      const ledger = w.offline.find((l) => l.campSlotId === camp.slot);
      return (
        !!ledger && Math.floor(ledger.lastSettledTick / 1000) < Math.floor(w.simulationTicks / 1000)
      );
    })
  );
}
/** Due-only global home accounting: escort and cached actors never switch food authorities. */
export function settleResidentNeeds(g: Game, force = false): void {
  const w = g.world5,
    runtime = g.extensionRuntime;
  if (!w || !runtime || g.isGameOver) return;
  const dueCamps = runtime
    .residentOwners()
    .flatMap((owner) =>
      runtime.worldCampRecords(owner).map((camp) => ({
        owner,
        camp,
        ledger: w.offline.find((l) => l.campSlotId === camp.slot)!
      }))
    )
    .filter(
      ({ ledger }) =>
        ledger &&
        (force || Math.floor(ledger.lastSettledTick / 1000) < Math.floor(w.simulationTicks / 1000))
    )
    .sort((a, b) => a.camp.slot - b.camp.slot);
  if (!dueCamps.length) return;
  transactResidentWorld(g, () => {
    const facts: {
      owner: string;
      slot: number;
      ordinal: number;
      actorId: number;
      atTick: number;
      kind: 'ration' | 'departure';
    }[] = [];
    let factCount = 0;
    const departures: { actorId: number; atTick: number; slot: number }[] = [];
    for (const { owner, camp: c, ledger: l } of dueCamps) {
      const state = runtime.worldCampState(owner),
        camp = state.camps.find((x) => x.regionId === c.regionId)!;
      const beds = residentBedIds(g, camp);
      const homeInstance = `${owner}.home.${camp.slot}.${camp.ordinal}`;
      const rations = residentRations(g, camp);
      const food = rations.map((r) => ({
        containerId: r.containerId,
        itemId: r.itemId,
        quantity: r.quantity,
        lockedQuantity: r.lockedQuantity,
        containerRevision: w.containers.find((b) => b.id === r.containerId)!.revision,
        consumableId: (g.worldContainerItems!.get(r.itemId)!.consumableId ??
          g.worldContainerItems!.get(r.itemId)!.identityId) as 'ration_of_food' | 'mango'
      }));
      const frozenResidents = l.residentStates.map((s) => {
        const resident = residentComponent(g, s.actorId);
        return {
          actorId: s.actorId,
          bedComponentId: resident?.bedId ?? null,
          bedEligible: beds.includes(resident?.bedId ?? -1),
          route: { reachable: true, distance: 0, travelTicks: 0 }
        };
      });
      const facilities = w.structures
        .filter((s) => s.fixture && beds.includes(s.fixture.id))
        .map((s) => ({
          componentId: s.fixture!.id,
          definitionId: s.fixture!.definitionId,
          hp: s.fixture!.hp,
          maxHp: structureDefinition(g, s.fixture!.definitionId).maxHp,
          roomEligible: true,
          ventilated: false,
          reachable: true,
          tags: ['bed']
        }));
      const outcome = planOfflineSettlement({
        schema: 2,
        homeInstance,
        granaryIds: [...camp.granaryIds],
        food,
        ownershipSignature: offlineOwnershipSignature(homeInstance, camp.granaryIds, food),
        rulesFingerprint: l.frozen.rulesFingerprint,
        runSeed: g.currentSeed,
        campSlotId: l.campSlotId,
        level: w.levels.find(
          (level) => level.levelRef.kind === 'dungeon' && level.levelRef.depth === camp.depth
        )!,
        fromTick: l.lastSettledTick,
        toTick: w.simulationTicks,
        ledger: { ...l, frozen: { ...l.frozen, residents: frozenResidents, facilities } },
        rules: RESIDENT_OFFLINE_RULES,
        containers: camp.granaryIds.map((id) => {
          const box = containerRead(g, id);
          return { ...box, items: box.items.map((item) => ({ ...item, tags: [...item.tags] })) };
        }),
        nodes: [],
        tickets: [],
        orders: [],
        pendingEvents: []
      });
      if (!outcome.ok) throw new Error(outcome.code);
      const p = outcome.value;
      const epochCount = Math.floor(p.toTick / 1000) - Math.floor(p.fromTick / 1000);
      for (const e of p.effects) {
        if (e.kind !== 'ration-consume') continue;
        const box = w.containers.find((b) => b.id === e.containerId)!,
          item = g.worldContainerItems!.get(e.itemId)!;
        if (!box || !item || !box.itemIds.includes(item.id) || item.quantity < e.quantity)
          throw new Error('C5_BAD_OWNERSHIP');
        item.quantity -= e.quantity;
        if (e.lockedQuantity) {
          const lock = camp.locked.find((l) => l.itemId === item.id);
          if (!lock || lock.quantity < e.lockedQuantity) throw new Error('C5_BAD_OWNERSHIP');
          lock.quantity -= e.lockedQuantity;
          camp.consumedLockedUnits += e.lockedQuantity;
          camp.locked = camp.locked.filter((l) => l.quantity > 0);
        }
        if (item.quantity === 0) {
          box.itemIds = box.itemIds.filter((id) => id !== item.id);
          g.worldContainerItems!.delete(item.id);
        }
        box.revision = checkedAdd(box.revision, e.quantity);
        camp.revision = checkedAdd(camp.revision, e.quantity);
        state.revision = checkedAdd(state.revision, e.quantity);
        factCount = checkedAdd(factCount, e.quantity);
        // A bounded display tail; quantity and stable daily identities remain
        // authoritative even when the complete rounds were consumed in bulk.
        for (let n = Math.max(0, e.quantity - 128); n < e.quantity; n++)
          facts.push({
            owner,
            slot: camp.slot,
            ordinal: camp.ordinal,
            actorId: e.actorId,
            atTick: e.firstTick + n * 32000,
            kind: 'ration'
          });
      }
      l.residentStates = p.nextLedger.residentStates;
      l.lastSettledTick = p.toTick;
      l.epochRemainder = p.toTick % 1000;
      l.revision = checkedAdd(l.revision, epochCount);
      w.revision = checkedAdd(w.revision, epochCount);
      for (const bed of p.nextBeds) {
        const r = residentComponent(g, bed.actorId),
          rec = residentRecord(g, bed.actorId);
        if (r && rec && r.bedId !== bed.bedId) {
          r.bedId = bed.bedId;
          publishResident(g, rec.owner, bed.actorId, r);
        }
      }
      runtime.worldCampReplace(owner, state);
      for (const e of p.effects)
        if (e.kind === 'resident-departure') {
          factCount = checkedAdd(factCount, 1);
          facts.push({
            owner,
            slot: camp.slot,
            ordinal: camp.ordinal,
            actorId: e.actorId,
            atTick: e.atTick,
            kind: 'departure'
          });
          departures.push({ actorId: e.actorId, atTick: e.atTick, slot: camp.slot });
        }
    }
    // Publish all homes on one logical timeline, including the grace deadlines
    // between their daily transitions. The already paid world clock stays at b.
    departures.sort((a, b) => a.atTick - b.atTick || a.slot - b.slot || a.actorId - b.actorId);
    let cut = -1;
    for (const d of departures) {
      if (d.atTick !== cut) {
        batchResidentSourceTerminations(g, () => settleDepartures(g, false, d.atTick));
        cut = d.atTick;
      }
      removeResident(g, d.actorId, 'starvation', true, d.atTick, true);
    }
    for (const { camp } of dueCamps) freezeResidentCamps(g, camp.depth);
    batchResidentSourceTerminations(g, () => settleDepartures(g));
    facts.sort((a, b) => a.atTick - b.atTick || a.slot - b.slot || a.actorId - b.actorId);
    const tail = facts.slice(-128),
      before = w.receipts[w.receipts.length - 1]?.ordinal ?? 0;
    w.receipts.push(
      ...tail.map((f, index) => ({
        owner: f.owner,
        ordinal: checkedAdd(before, factCount - tail.length + index + 1),
        identity: `${f.kind}.${f.slot}.${f.ordinal}.${f.actorId}.${f.atTick}`,
        kind: 'offline' as const,
        levelRef: {
          kind: 'dungeon' as const,
          depth: dueCamps.find((c) => c.camp.slot === f.slot)!.camp.depth
        },
        tick: f.atTick,
        result: 'completed' as const,
        reason: f.kind === 'departure' ? 'starvation' : null
      }))
    );
    w.receipts.splice(0, Math.max(0, w.receipts.length - 128));
    markRecordingRoot(w);
    invalidateNeeds(g);
  });
}
/** Refresh qualification snapshots only after the preceding interval has been accounted. */
export function freezeResidentCamps(g: Game, depth: number): void {
  const w = g.world5,
    runtime = g.extensionRuntime;
  if (!w || !runtime) return;
  const actors = new Map(residentActors(g).map(actor => [actor.id, actor]));
  for (const owner of runtime.residentOwners())
    for (const c of runtime.worldCampRecords(owner).filter((c) => c.depth === depth)) {
      const l = w.offline.find((l) => l.campSlotId === c.slot);
      if (!l) continue;
      const beds = residentBedIds(g, c);
      l.residentStates.sort((a, b) => a.actorId - b.actorId);
      l.frozen.capturedTick = w.simulationTicks;
      l.frozen.residents = l.residentStates.map((s) => {
        const a = actors.get(s.actorId),
          r = residentComponent(g, s.actorId);
        return {
          actorId: s.actorId,
          bedComponentId: r?.bedId ?? null,
          bedEligible: r?.bedId !== null && beds.includes(r?.bedId ?? -1),
          route: {
            reachable: !!a && g.monsters.includes(a) && r?.mode === 'stay',
            distance: 0,
            travelTicks: 0
          }
        };
      });
      l.frozen.facilities = w.structures
        .filter(
          (s) =>
            s.levelRef.kind === 'dungeon' &&
            s.levelRef.depth === depth &&
            s.fixture &&
            beds.includes(s.fixture.id)
        )
        .map((s) => ({
          componentId: s.fixture!.id,
          definitionId: s.fixture!.definitionId,
          hp: s.fixture!.hp,
          maxHp: structureDefinition(g, s.fixture!.definitionId).maxHp,
          roomEligible: true,
          ventilated: false,
          reachable: true,
          tags: ['bed']
        }));
    }
}
