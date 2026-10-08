import { residentDistanceMap, residentBlockedMap } from './ResidentPathing';
/** Resident jobs share run.actorActions. Job rows own only material custody and earned credit. */
import type { Game } from './Game';
import type { ResidentWork } from '../../ext/residentSdk';
import type { ReadonlyActorActionBundle } from './ActorActionScheduler';
import { createActorActionBundle } from './ActorActionScheduler';
import { productionActorActionScheduler } from './ActorActionProduction';
import { assertNativeActorDecisionScope, type ActorActionScope } from './ActorActionScope';
import { sourceFootprintVersion } from '../Movement/AttackShape';
import {
  residentComponent,
  residentRecord,
  residentCamp,
  campBox,
  residentDisabled,
  unsafeResidentCell,
  transactResidentWorld,
  publishResident,
  failResident
} from './ResidentWorld';
import { residentEfficiency } from './ResidentEconomy';
import {
  updateWorldReasons,
  recordWorldReceipt,
  allocateWorldId,
  containerItems,
  containerRead,
  putContainer,
  reservedContainerSlots,
  checkItemBudget,
  createOutputs
} from './WorldWorkWorld';
import { Item, ItemCategory } from '../Items/Item';
import { serializeItem } from './EntitySnapshot';
import { Monster } from '../../entities/Monster';
import { playerTravelDiagonalBlocked } from '../Movement/PlayerTravel';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { World5Error } from '../../ext/worldBasics';
import { checkedAdd } from '../../ext/worldBasics';
import { markRecordingRoot } from '../../ext/recordingRevisions';
import { readCellProperties } from '../Map/CellProperties';
import {
  TM_ALLOWS_SUBMERGING,
  TM_EXTINGUISHES_FIRE,
  TM_VANISHES_UPON_PROMOTION
} from '../Map/TerrainCatalog';
import { TRAVEL_DIRECTIONS } from '../Movement/LevelTravel';
class ResidentStop extends Error {}
const work = (g: Game, id: number) => g.world5?.residentJobs.find((j) => j.actorId === id);
function source(g: Game, id: number) {
  return g.monsters.find((a) => a.id === id);
}
function efficiency(g: Game, id: number) {
  const r = residentComponent(g, id),
    n = g.world5!.offline.flatMap((l) => l.residentStates).find((s) => s.actorId === id);
  if (!r || !n || r.mode !== 'stay') return 0;
  const phase = Math.floor(g.world5!.simulationTicks / 1000) % 32;
  return phase < r.schedule[0] ? residentEfficiency(n) : 0;
}
export function residentHasNativePriority(g: Game, a: Monster): boolean {
  return residentDisabled(a) || unsafeResidentCell(g, a.loc) || a.hasNativeResidentPriority(g);
}

function plot(g: Game, id: number) {
  const row = g.world5!.structures.find((s) => s.fixture?.id === id && s.fixture.hp > 0);
  return row?.fixture?.definitionId.endsWith('.plot') ? row : null;
}
export function residentPlotReason(g: Game, id: number): string | null {
  const p = plot(g, id);
  if (!p) return 'plot-removed';
  const policy = g.extensionRuntime!.residentPolicy(p.owner)!;
  if (g.lightMap.lightSumAt(p.at.x, p.at.y) > policy.lowLightChannels) return 'light';
  let water = false;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const cell = g.grid.getCell(p.at.x + dx, p.at.y + dy);
      if (!cell || !(cell.isVisible || cell.hasMemory || cell.isExplored) || cell.machineNumber)
        continue;
      const properties = readCellProperties(cell);
      const wet = TM_ALLOWS_SUBMERGING | TM_EXTINGUISHES_FIRE;
      // Use the composition kernel: safe shallow water is stable ground with
      // aquatic/fire-extinguishing mechanics; temporary flood tiles do not qualify.
      if (
        properties.stableFloor &&
        !properties.blocksMovement &&
        (properties.baseMechFlags & wet) === wet &&
        !(properties.baseMechFlags & TM_VANISHES_UPON_PROMOTION)
      )
        water = true;
    }
  }
  return water ? null : 'water';
}
function near(a: Monster, p: { x: number; y: number }) {
  return Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y)) <= 1;
}
function step(
  g: Game,
  a: Monster,
  target: { x: number; y: number },
  adjacent = true,
  targetRevision = 0
): boolean {
  if (
    (adjacent && near(a, target) && hasInteractionLine(g.grid, a.loc, target)) ||
    (!adjacent && a.x === target.x && a.y === target.y)
  )
    return false;
  const choices = TRAVEL_DIRECTIONS.map(([dx, dy]) => ({ x: a.x + dx, y: a.y + dy }))
    .filter(
      (p) =>
        g.grid.isValidPos(p.x, p.y) &&
        !unsafeResidentCell(g, p) &&
        !playerTravelDiagonalBlocked(g.grid, a.loc, p, false) &&
        a.canEnterMovementTerrain(g, p.x, p.y) &&
        !g.getMonsterAt(p.x, p.y) &&
        (g.player.x !== p.x || g.player.y !== p.y)
    );
  // Every actual neighbor has already passed the live occupancy/terrain checks.
  // A new gradient cannot supply a move when that list is empty.
  if (!choices.length) {
    a.ticksUntilTurn = a.movementSpeed;
    return true;
  }
  let map = residentDistanceMap(g, target, targetRevision);
  choices.sort(
    (p, q) => (map[p.x]?.[p.y] ?? 30000) - (map[q.x]?.[q.y] ?? 30000) || p.y - q.y || p.x - q.x
  );
  if ((map[choices[0]!.x]?.[choices[0]!.y] ?? 30000) >= (map[a.x]?.[a.y] ?? 30000)) {
    map = residentBlockedMap(
      g,
      a.id,
      target,
      map,
      (p) => !unsafeResidentCell(g, p) && a.canEnterMovementTerrain(g, p.x, p.y),
      a.loc
    );
    choices.sort(
      (p, q) => (map[p.x]?.[p.y] ?? 30000) - (map[q.x]?.[q.y] ?? 30000) || p.y - q.y || p.x - q.x
    );
  }
  if (choices[0] && (map[choices[0].x]?.[choices[0].y] ?? 30000) < (map[a.x]?.[a.y] ?? 30000)) {
    a.moveResidentStep(choices[0], g);
    if (a.ticksUntilTurn <= 0) a.ticksUntilTurn = a.movementSpeed;
    return true;
  }
  a.ticksUntilTurn = a.movementSpeed;
  return true;
}
function slots(i: Item, q = i.quantity) {
  return [ItemCategory.MATERIAL, ItemCategory.WEAPON, ItemCategory.GEM].includes(i.category)
    ? 1
    : q;
}
function startPhase(g: Game, j: ResidentWork, ticks: number) {
  const a = source(g, j.actorId)!;
  const scheduler = productionActorActionScheduler(g)!;
  const id = g.actorActions!.nextActionId;
  g.actorActions!.nextActionId = checkedAdd(id, 1);
  markRecordingRoot(g.world5!);
  j.actionId = id;
  j.status = 'working';
  j.pendingCompletion = false;
  j.anchor = { ...a.loc };
  j.hp = a.hp;
  scheduler.commitBundle(
    createActorActionBundle({
      owner: 'foundation',
      actionId: id,
      depth: g.depth,
      decisionOwnerId: a.id,
      timeChargeOwnerId: a.id,
      subactions: [
        {
          sourceEntityId: a.id,
          sourcePartId: 'body',
          sourceFootprintVersion: sourceFootprintVersion(g.spatialOf(a)),
          phases: [{ kind: 'recovery', durationTicks: ticks, segmentIndex: null }]
        }
      ]
    })
  );
}
function accept(
  g: Game,
  a: Monster,
  kind: 'plant' | 'haul',
  item: Item,
  quantity: number,
  sourceId: number,
  destinationId: number,
  plotId: number | null
): ResidentWork {
  const r = residentComponent(g, a.id)!,
    rec = residentRecord(g, a.id)!,
    c = residentCamp(g, rec.owner, r.campId),
    src = campBox(g, c, sourceId),
    dst = campBox(g, c, destinationId),
    needed = kind === 'plant' ? 1 : slots(item, quantity);
  if (
    containerRead(g, dst.id).occupiedSlots + reservedContainerSlots(g, dst.id) + needed >
    dst.capacity
  )
    failResident('C5_CAPACITY');
  const freed =
    quantity === item.quantity ? slots(item) : item.category === ItemCategory.FOOD ? quantity : 0;
  if (
    containerRead(g, src.id).occupiedSlots -
      freed +
      reservedContainerSlots(g, src.id) +
      slots(item, quantity) +
      (src.id === dst.id ? needed : 0) >
    src.capacity
  )
    failResident('C5_CAPACITY');
  if (g.extensionRuntime!.worldCampLockedQuantity(item.id) > item.quantity - quantity)
    failResident('C5_RESERVED');
  checkItemBudget(g, kind === 'plant' ? 1 : 0);
  if (r.stopReason !== null) {
    r.stopReason = null;
    publishResident(g, rec.owner, a.id, r);
  }
  const id = allocateWorldId(g),
    cargoId = allocateWorldId(g);
  let moved = item;
  if (quantity < item.quantity) {
    checkItemBudget(g, 1);
    const newItem = new Item(item.name, item.char, item.color, item.category);
    moved = Object.assign(newItem, serializeItem(item), { id: newItem.id, quantity });
    item.quantity -= quantity;
  } else src.itemIds = src.itemIds.filter((id) => id !== item.id);
  src.revision++;
  g.worldContainerItems!.set(moved.id, moved);
  g.world5!.containers.push({
    id: cargoId,
    owner: rec.owner,
    kind: 'escrow',
    levelRef: { kind: 'dungeon', depth: g.depth },
    position: null,
    capacity: 64,
    itemIds: [moved.id],
    revision: 0,
    ticketId: id
  });
  const j: ResidentWork = {
    id,
    owner: rec.owner,
    actorId: a.id,
    campId: c.regionId,
    depth: g.depth,
    kind,
    actionId: null,
    sourceId,
    destinationId,
    cargoId,
    plotId,
    phase: 'pickup',
    anchor: { ...a.loc },
    hp: a.hp,
    reservedSlots: needed,
    creditTicks: 0,
    creditRemainder: 0,
    status: 'working',
    pendingCompletion: false,
    day: Math.floor(g.world5!.simulationTicks / 32000)
  };
  g.world5!.residentJobs.push(j);
  startPhase(g, j, 100);
  updateWorldReasons(g);
  return j;
}
export function cancelResidentWork(g: Game, id: number, reason: string): void {
  const j = work(g, id);
  if (!j) return;
  transactResidentWorld(g, () => {
    const actionId = j.actionId;
    j.actionId = null;
    if (actionId !== null) productionActorActionScheduler(g)?.retireBundle(actionId);
    const cargo = g.world5!.containers.find((c) => c.id === j.cargoId)!;
    g.world5!.residentJobs = g.world5!.residentJobs.filter((x) => x !== j);
    const origin = g.world5!.containers.find((c) => c.id === j.sourceId);
    if (origin) {
      for (const item of containerItems(g, cargo.id).slice()) putContainer(g, origin.id, item);
      g.world5!.containers = g.world5!.containers.filter((c) => c.id !== cargo.id);
    } else {
      // Missing source fallback owns the existing Item on its real home
      // floor; it allocates no synthetic remains interactable or container.
      const camp = residentCamp(g, j.owner, j.campId);
      const marker = g.extensionRuntime!.worldWorkEntities().find((e) => e.id === camp.markerId);
      if (!marker) failResident('C5_BAD_REFERENCE');
      const items = j.depth === g.depth ? g.items : g.levels.get(j.depth)?.items;
      if (!items) failResident('C5_BAD_REFERENCE');
      for (const item of containerItems(g, cargo.id).slice()) {
        item.loc = { x: marker!.x, y: marker!.y };
        items!.push(item);
        g.worldContainerItems!.delete(item.id);
      }
      g.world5!.containers = g.world5!.containers.filter((c) => c.id !== cargo.id);
    }
    const r = residentComponent(g, id);
    updateWorldReasons(g);
    recordWorldReceipt(g, j.owner, 'work', `resident.${j.id}`, 'interrupted', reason);
    if (r) {
      r.job = { kind: 'idle' };
      r.stopReason = reason;
      publishResident(g, j.owner, id, r);
    }
    markRecordingRoot(g.world5!);
  });
}
/** Called once from the existing scheduler's elapsed callback, while world time is still t0. */
export function advanceResidentLabor(g: Game, dt: number): void {
  const w = g.world5;
  if (!w || dt <= 0) return;
  const t0 = w.simulationTicks,
    t1 = checkedAdd(t0, dt);
  for (const j of w.residentJobs) {
    if (
      j.actionId === null ||
      j.depth !== g.depth ||
      j.phase !== 'planting' ||
      j.status !== 'working'
    )
      continue;
    const r = residentComponent(g, j.actorId),
      n = w.offline.flatMap((l) => l.residentStates).find((s) => s.actorId === j.actorId);
    const actor = source(g, j.actorId);
    if (
      !r ||
      !n ||
      !actor ||
      actor.hp < j.hp ||
      residentDisabled(actor) ||
      actor.x !== j.anchor.x ||
      actor.y !== j.anchor.y
    )
      continue;
    for (let at = t0; at < t1; ) {
      const end = Math.min(t1, (Math.floor(at / 1000) + 1) * 1000),
        phase = Math.floor(at / 1000) % 32,
        eff = r.mode === 'stay' && phase < r.schedule[0] ? residentEfficiency(n) : 0;
      const credit = j.creditRemainder + (end - at) * eff;
      j.creditTicks = Math.min(1000, j.creditTicks + Math.floor(credit / 100));
      j.creditRemainder = j.creditTicks === 1000 ? 0 : credit % 100;
      at = end;
    }
  }
  markRecordingRoot(w);
}
/** A finish only seals the elapsed interval. WorldClock/needs publish before job effects. */
export function residentWorkClockFinished(
  g: Game,
  b: ReadonlyActorActionBundle,
  reason: string
): boolean {
  const j = g.world5?.residentJobs.find((j) => j.actionId === b.actionId);
  if (!j) return false;
  markRecordingRoot(g.world5!);
  j.actionId = null;
  j.pendingCompletion = reason === 'completed';
  if (reason !== 'completed') cancelResidentWork(g, j.actorId, reason);
  return true;
}
export function settleResidentWork(g: Game): void {
  if (!g.world5 || g.isGameOver) return;
  for (const j of [...g.world5.residentJobs]) {
    const a = source(g, j.actorId),
      r = residentComponent(g, j.actorId);
    if (
      !a ||
      !r ||
      a.hp <= 0 ||
      a.hp < j.hp ||
      residentDisabled(a) ||
      r.mode !== 'stay' ||
      ((j.phase === 'planting' || j.phase === 'pickup' || j.phase === 'delivery') &&
        (a.x !== j.anchor.x || a.y !== j.anchor.y)) ||
      residentHasNativePriority(g, a) ||
      (j.phase === 'planting' && residentPlotReason(g, j.plotId!) !== null)
    ) {
      cancelResidentWork(g, j.actorId, 'interrupted');
      continue;
    }
    if (j.actionId !== null) continue;
    if (j.pendingCompletion) {
      transactResidentWorld(g, () => {
        j.pendingCompletion = false;
        if (j.phase === 'pickup') {
          j.phase = 'carrying';
          return;
        }
        if (j.phase === 'planting' && j.creditTicks < 1000) {
          j.status = 'suspended';
          return;
        }
        if (j.phase === 'planting' || j.phase === 'delivery') {
          const state = g.extensionRuntime!.worldCampState(j.owner);
          if (j.kind === 'plant') {
            if (j.phase !== 'planting' || j.creditTicks !== 1000 || j.creditRemainder !== 0)
              failResident('C5_BAD_REFERENCE');
            const day = Math.floor(g.world5!.simulationTicks / 32000);
            if (state.plotDays.some((p) => p.componentId === j.plotId && p.day === day))
              failResident('C5_RESERVED');
            state.plotDays = state.plotDays.filter((p) => p.componentId !== j.plotId);
            state.plotDays.push({ componentId: j.plotId!, day });
          }
          const items = containerItems(g, j.cargoId).slice();
          g.world5!.residentJobs = g.world5!.residentJobs.filter((x) => x !== j);
          if (j.kind === 'plant') {
            for (const i of items) g.worldContainerItems!.delete(i.id);
            createOutputs(
              g,
              [{ itemDefinitionId: j.owner + '.crop', count: 1 }],
              j.destinationId,
              true
            );
          } else for (const i of items) putContainer(g, j.destinationId, i);
          g.world5!.containers = g.world5!.containers.filter((c) => c.id !== j.cargoId);
          updateWorldReasons(g);
          recordWorldReceipt(g, j.owner, 'work', `resident.${j.id}`, 'completed', null);
          r.job = { kind: 'idle' };
          r.stopReason = null;
          publishResident(g, j.owner, j.actorId, r);
          state.revision++;
          g.extensionRuntime!.worldCampReplace(j.owner, state);
        }
      });
    }
  }
}
export function selectResidentDecision(
  g: Game,
  id: number,
  scope: ActorActionScope
): 'handled' | 'native-fallback' {
  const a = source(g, id);
  if (!a) return 'native-fallback';
  assertNativeActorDecisionScope(scope, g, id);
  const r = residentComponent(g, id);
  if (!r) {
    const s = g.extensionRuntime?.residentOwners().some((owner) => {
      const q = g.extensionRuntime!.residentComponent<{ kind: string; consumed: boolean }>(
        owner,
        id,
        'source'
      );
      return q?.kind === 'spawn' && !q.consumed;
    });
    if (s && !residentHasNativePriority(g, a)) {
      a.ticksUntilTurn = a.movementSpeed;
      return 'handled';
    }
    return 'native-fallback';
  }
  if (r.mode === 'escort' || residentHasNativePriority(g, a)) {
    if (work(g, id)) cancelResidentWork(g, id, 'native-priority');
    return 'native-fallback';
  }
  const rec = residentRecord(g, id)!,
    c = residentCamp(g, rec.owner, r.campId);
  if (g.depth !== c.depth) {
    a.ticksUntilTurn = a.movementSpeed;
    return 'handled';
  }
  let j = work(g, id);
  if (j) {
    if (j.phase === 'carrying') {
      // Travel is work too. Keep the accepted ticket and cargo through rest
      // or a zero-efficiency need state; native danger still wins above.
      if (efficiency(g, id) === 0) {
        j.status = 'suspended';
        a.ticksUntilTurn = a.movementSpeed;
        return 'handled';
      }
      j.status = 'working';
      const target =
        j.kind === 'plant' ? plot(g, j.plotId!)?.at : containerRead(g, j.destinationId).at;
      if (!target) {
        cancelResidentWork(g, id, 'target-removed');
        a.ticksUntilTurn = a.movementSpeed;
        return 'handled';
      }
      if (
        step(
          g,
          a,
          target,
          true,
          j.kind === 'plant'
            ? plot(g, j.plotId!)!.fixture!.revision
            : containerRead(g, j.destinationId).revision
        )
      )
        return 'handled';
      if (!hasInteractionLine(g.grid, a.loc, target)) {
        a.ticksUntilTurn = a.movementSpeed;
        return 'handled';
      }
      if (j.kind === 'haul') {
        j.phase = 'delivery';
        startPhase(g, j, 100);
      } else {
        j.phase = 'planting';
        j.status = 'suspended';
        if (efficiency(g, id) > 0)
          startPhase(
            g,
            j,
            Math.min(
              1000 - (g.world5!.simulationTicks % 1000),
              Math.ceil(100000 / efficiency(g, id))
            )
          );
        else a.ticksUntilTurn = a.movementSpeed;
      }
      return 'handled';
    }
    if (j.phase === 'planting' && j.actionId === null) {
      if (efficiency(g, id) > 0)
        startPhase(
          g,
          j,
          Math.max(
            1,
            Math.min(
              1000 - (g.world5!.simulationTicks % 1000),
              Math.ceil(((1000 - j.creditTicks) * 100 - j.creditRemainder) / efficiency(g, id))
            )
          )
        );
      else a.ticksUntilTurn = a.movementSpeed;
      return 'handled';
    }
  }
  if (
    r.job.kind === 'guard' &&
    Math.floor(g.world5!.simulationTicks / 1000) % 32 >= r.schedule[0] &&
    Math.floor(g.world5!.simulationTicks / 1000) % 32 < r.schedule[0] + r.schedule[1]
  ) {
    const bed = g.world5!.structures.find((s) => s.fixture?.id === r.bedId)?.at;
    if (bed) step(g, a, bed);
    if (a.ticksUntilTurn <= 0) a.ticksUntilTurn = a.movementSpeed;
    return 'handled';
  }
  if (r.job.kind === 'guard') {
    step(g, a, r.job.at, false, r.revision);
    if (a.ticksUntilTurn <= 0) a.ticksUntilTurn = a.movementSpeed;
    return 'handled';
  }
  if (r.job.kind === 'plant' || r.job.kind === 'haul') {
    if (efficiency(g, id) === 0) {
      a.ticksUntilTurn = a.movementSpeed;
      return 'handled';
    }
    const job = r.job,
      src = campBox(g, c, job.sourceId),
      target = containerRead(g, src.id).at!;
    if (step(g, a, target, true, src.revision)) return 'handled';
    if (!hasInteractionLine(g.grid, a.loc, target)) {
      a.ticksUntilTurn = a.movementSpeed;
      return 'handled';
    }
    try {
      // Expected waits are pure reads: take the broad checkpoint only when
      // there is material to accept, then revalidate inside the transaction.
      const input = (): { item: Item; quantity: number; plotId: number | null } => {
        if (job.kind === 'plant') {
          const plotDays = g.extensionRuntime!.worldCampPlotDays(rec.owner),
            plotId = job.plotIds.find(
              (id) =>
                !plotDays.some(
                  (p) =>
                    p.componentId === id && p.day === Math.floor(g.world5!.simulationTicks / 32000)
                ) && !g.world5!.residentJobs.some((j) => j.plotId === id)
            );
          if (plotId === undefined) failResident('C5_RESERVED');
          const reason = residentPlotReason(g, plotId!);
          if (reason) throw new ResidentStop(reason);
          const seed = containerItems(g, src.id).find(
            (i) => i.worldItem?.definitionId === rec.owner + '.seed'
          );
          if (!seed) failResident('C5_INPUT');
          return { item: seed!, quantity: 1, plotId: plotId! };
        } else {
          const item = containerItems(g, src.id).find((i) => i.id === job.itemId);
          if (!item || item.quantity < job.quantity) failResident('C5_INPUT');
          return { item: item!, quantity: job.quantity, plotId: null };
        }
      };
      input();
      transactResidentWorld(g, () => {
        const accepted = input();
        accept(g, a, job.kind, accepted.item, accepted.quantity, src.id, job.destinationId, accepted.plotId);
      });
    } catch (e) {
      if (
        !(e instanceof ResidentStop) &&
        !(
          e instanceof World5Error &&
          ['C5_RESERVED', 'C5_CAPACITY', 'C5_INPUT', 'C5_BLOCKED'].includes(e.code)
        )
      )
        throw e;
      const reason = e instanceof Error ? e.message : 'blocked';
      if (r.stopReason !== reason) {
        r.stopReason = reason;
        publishResident(g, rec.owner, id, r);
      }
      a.ticksUntilTurn = a.movementSpeed;
    }
    return 'handled';
  }
  const bed = g.world5!.structures.find((s) => s.fixture?.id === r.bedId)?.at;
  if (bed) step(g, a, bed);
  if (a.ticksUntilTurn <= 0) a.ticksUntilTurn = a.movementSpeed;
  return 'handled';
}
