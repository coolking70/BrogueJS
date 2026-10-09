import { knownPolymorphSpecies } from '../Combat/Polymorph';
import { footprintOf } from '../Movement/CreatureSpatial';
import { planRaidLoss } from './SettlementRaidPlan';
/** Real event orchestration. Pure derived draws; native actors and structures retain ownership. */
import type { Game } from './Game';
import type { CampRecord } from '../../ext/structureSdk';
import type { CampRaidState } from '../../ext/settlementRaids';
import { checkedAdd, World5Error } from '../../ext/worldBasics';
import {
  inResidentCamp,
  residentComponent,
  residentActors,
  transactResidentWorld
} from './ResidentWorld';
import {
  containerItems,
  containerRead,
  itemRead,
  reservedContainerSlots,
  recordWorldReceipt
} from './WorldWorkWorld';
import { STRUCTURE_SLOTS } from '../../ext/structureSchema';
import { structureDefinition, applyRaidStructureDamage } from '../Map/StructureWorld';
import { regionContains } from '../../ext/regions';
import { travelDistanceMap } from '../Movement/LevelTravel';
import { T_PATHING_BLOCKER } from '../Map/TerrainCatalog';
import { unsafeResidentCell } from './ResidentWorld';
import { sha256 } from '../../ext/fingerprint';
import { markRecordingRoot } from '../../ext/recordingRevisions';
import { ItemCategory } from '../Items/Item';
import i18next from 'i18next';
import { logger } from '../Systems/Logger';
export function campRaid(g: Game, slot: number) {
  return g.world5?.raidCamps.find((r) => r.slot === slot);
}
export function campEconomicTick(g: Game, slot: number, tick = g.world5!.simulationTicks): number {
  return tick - (campRaid(g, slot)?.excludedTicks ?? 0);
}
export function residentEconomicTick(
  g: Game,
  id: number,
  tick = g.world5!.simulationTicks
): number {
  const rec = g.world5!.residents.find((r) => r.actorId === id);
  return rec ? campEconomicTick(g, rec.campSlotId, tick) : tick;
}
export function isRaidActor(g: Game, id: number): boolean {
  return !!g.world5?.raidCamps.some(
    (r) => r.event?.phase === 'active' && r.event.actors.some(a => a.actorId === id && a.departed === null)
  );
}
export function raidState(g: Game, owner: string, c: CampRecord): CampRaidState | undefined {
  if (!g.extensionRuntime?.worldRaidRules(owner)) return undefined;
  let r = campRaid(g, c.slot);
  if (!r) {
    r = {
      owner,
      campId: c.regionId,
      slot: c.slot,
      createdTick: g.world5!.offline.find((l) => l.campSlotId === c.slot)!.lastSettledTick,
      lastPressureTick: g.world5!.offline.find((l) => l.campSlotId === c.slot)!.lastSettledTick,
      pressure: 0,
      admissionReason: null,
      lastOrdinal: 0,
      cooldownUntil: 0,
      reportedTick: 0,
      report: null,
      noiseEpoch: 0,
      noiseBatches: 0,
      excludedTicks: 0,
      pauseBaseExcludedTicks: 0,
      lastPauseStart: 0,
      pauseFrom: null,
      pauseThrough: 0,
      event: null
    };
    g.world5!.raidCamps.push(r);
    g.world5!.raidCamps.sort((a, b) => a.campId - b.campId);
  }
  return r;
}
/** Exclude elapsed cached time without advancing any economic ticket, quota or Item. */
export function excludeRaidTime(g: Game, r: CampRaidState, to: number): void {
  if (r.pauseFrom === null || to <= r.pauseThrough) return;
  const l = g.world5!.offline.find((l) => l.campSlotId === r.slot)!;
  const elapsed = to - r.pauseThrough;
  r.excludedTicks = checkedAdd(r.excludedTicks, elapsed);
  r.pauseThrough = to;
  l.lastSettledTick = to;
  l.epochRemainder = to % 1000;
  l.revision = checkedAdd(l.revision, elapsed);
  r.lastPressureTick = to;
  g.world5!.revision = checkedAdd(g.world5!.revision, elapsed);
  const state = g.extensionRuntime!.worldCampState(r.owner);
  state.revision = checkedAdd(state.revision, elapsed);
  g.extensionRuntime!.worldCampReplace(r.owner, state);
  markRecordingRoot(g.world5!);
}
export function freezeRaidLevel(g: Game, depth: number): void {
  if (g.isGameOver) return;
  for (const r of g.world5?.raidCamps ?? [])
    if (
      r.event?.phase === 'active' &&
      g.world5!.offline.some(
        (l) =>
          l.campSlotId === r.slot && l.levelRef.kind === 'dungeon' && l.levelRef.depth === depth
      )
    ) {
      r.pauseBaseExcludedTicks = r.excludedTicks;
      r.lastPauseStart = g.world5!.simulationTicks;
      r.pauseFrom = r.lastPauseStart;
      r.pauseThrough = r.pauseFrom;
      markRecordingRoot(g.world5!);
    }
}
export function resumeRaidLevel(g: Game): void {
  if (g.isGameOver) return;
  for (const r of g.world5?.raidCamps ?? [])
    if (
      r.pauseFrom !== null &&
      g.world5!.offline.some(
        (l) =>
          l.campSlotId === r.slot && l.levelRef.kind === 'dungeon' && l.levelRef.depth === g.depth
      )
    ) {
      excludeRaidTime(g, r, g.world5!.simulationTicks);
      r.pauseFrom = null;
      markRecordingRoot(g.world5!);
    }
}
export function finishRaidEvents(g: Game): void {
  if (
    g.isGameOver ||
    !g.world5 ||
    !g.extensionRuntime ||
    !g.world5.raidCamps.some((r) => r.event?.phase === 'active' && r.pauseFrom === null)
  )
    return;
  const actors = residentActors(g);
  for (const r of g.world5.raidCamps) {
    const e = r.event;
    if (e?.phase !== 'active' || r.pauseFrom !== null) continue;
    if (
      !e.actorIds.every((id) => {
        const a = actors.find((a) => a.id === id);
        return (e.actors.find(row => row.actorId === id)!.departed !== null &&
          !!a && raidActorAwayFromCamp(g, a, g.extensionRuntime!.worldCampRecords(r.owner).find(c => c.slot === r.slot)!.depth)) ||
          (a ? (a.hp <= 0 && a.deathProcessed) || a.isAlly : e.defeatedIds.includes(id));
      })
    )
      continue;
    transactResidentWorld(g, () => {
      // No cached time is settled here. The preceding exclusion watermark is already paid.
      e.phase = 'closed';
      e.actorIds = [];
      e.defeatedIds = [];
      e.actors = [];
      e.reason = 'combat';
      e.endedTick = g.world5!.simulationTicks;
      r.cooldownUntil = checkedAdd(
        e.endedTick,
        g.extensionRuntime!.worldRaidRules(r.owner)!.cooldown
      );
      r.lastPressureTick = e.endedTick;
      r.pressure = 0;
      r.reportedTick = e.endedTick;
      r.report = { phase: 'closed', reason: 'combat', lostUnits: 0, damagedHp: 0 };
      const state = g.extensionRuntime!.worldCampState(r.owner);
      state.revision = checkedAdd(state.revision, 1);
      g.extensionRuntime!.worldCampReplace(r.owner, state);
      recordWorldReceipt(g, r.owner, 'offline', e.id + '.closed', 'completed', 'combat');
      markRecordingRoot(g.world5!);
      logger.log(i18next.t('ext.settlement.raid.closed'), '#c4b78e');
    });
  }
}
const population = (g: Game, c: CampRecord) =>
  g.world5!.residents.filter(
    (a) =>
      a.campSlotId === c.slot &&
      residentComponent(g, a.actorId)?.mode === 'stay' &&
      g
        .world5!.offline.find((l) => l.campSlotId === c.slot)!
        .residentStates.some((s) => s.actorId === a.actorId && s.alive && !s.departed)
  ).length;
const facilities = (g: Game, c: CampRecord) =>
  Math.min(
    4,
    g.world5!.structures.filter(
      (s) =>
        s.regionId === c.regionId &&
        s.fixture &&
        s.fixture.hp === structureDefinition(g, s.fixture.definitionId).maxHp &&
        (structureDefinition(g, s.fixture.definitionId).tags.includes('plot') ||
          g.world5!.stations.some((station) => station.boundComponentId === s.fixture!.id))
    ).length
  );
function notify(g: Game, r: CampRaidState, c: CampRecord, key: string, tick: number) {
  if (c.depth === g.depth && inResidentCamp(g, c, g.player.loc)) {
    r.reportedTick = tick;
    if (key === 'slots') r.report = { phase: 'deferred', reason: 'slots', lostUnits: 0, damagedHp: 0 };
    if (r.event && key !== 'slots')
      r.report = {
        phase: r.event.phase,
        reason: r.event.reason,
        lostUnits: r.event.lostUnits,
        damagedHp: r.event.damagedHp
      };
    const ledger = g.world5!.offline.find((l) => l.campSlotId === c.slot)!;
    logger.log(
      i18next.t('ext.settlement.raid.' + key, {
        units: r.event?.lostUnits ?? 0,
        hp: r.event?.damagedHp ?? 0,
        shortage: Math.max(0, ...ledger.residentStates.map((n) => n.foodShortage)),
        stopped: g.world5!.orders.filter(
          (o) =>
            o.levelRef.kind === 'dungeon' && o.levelRef.depth === c.depth && o.status !== 'working'
        ).length
      }),
      '#dfab7a'
    );
  }
}
export function raidBoundary(g: Game, c: CampRecord, r: CampRaidState, final: number): number {
  if (r.pauseFrom !== null) return final;
  const rules = g.extensionRuntime!.worldRaidRules(r.owner)!;
  const e = r.event;
  if (e && ['warning', 'deferred'].includes(e.phase))
    return Math.max(e.dueTick, e.lastAttemptTick + rules.period);
  if (e && e.phase !== 'closed') return final;
  if (!population(g, c)) return final;
  const start = Math.max(r.lastPressureTick, r.createdTick + rules.grace, r.cooldownUntil);
  const rate = 1 + Math.ceil(population(g, c) / 4) + Math.min(3, Math.floor((c.depth - 1) / 5));
  return (
    (Math.floor(start / rules.period) +
      Math.max(1, Math.ceil((rules.threshold + 8 * (r.lastOrdinal % 3) - r.pressure) / rate))) *
    rules.period
  );
}
function landing(g: Game, c: CampRecord, count: number): { x: number; y: number }[] {
  if (
    g.monsters.length + g.dormantMonsters.length + count > 128 ||
    [g.player, ...g.monsters, ...g.dormantMonsters].reduce(
      (n, a) => n + g.footprintOf(a).length,
      0
    ) +
      count >
      512
  )
    return [];
  const rt = g.extensionRuntime!,
    region = rt.worldStructureRegions().find((r) => r.id === c.regionId)!;
  const marker = rt.worldWorkEntities().find((e) => e.id === c.markerId)!;
  const map = travelDistanceMap(g.grid, [], marker, T_PATHING_BLOCKER),
    spots: { x: number; y: number }[] = [];
  const b = region.bounds;
  for (let y = Math.max(1, b.y - 1); y <= Math.min(g.grid.height - 2, b.y + b.height); y++)
    for (let x = Math.max(1, b.x - 1); x <= Math.min(g.grid.width - 2, b.x + b.width); x++) {
      const p = { x, y },
        cell = g.grid.getCell(x, y)!;
      if (
        regionContains(region, p) ||
        !cell.isExplored ||
        !cell.isPassable ||
        unsafeResidentCell(g, p) ||
        map[x]?.[y]! >= 30000 ||
        rt.worldStructureRegions().some((r) => r.depth === g.depth && regionContains(r, p)) ||
        g.world5!.structures.some(
          (s) =>
            s.levelRef.kind === 'dungeon' &&
            s.levelRef.depth === g.depth &&
            s.at.x === x &&
            s.at.y === y
        ) ||
        [g.player, ...g.monsters, ...g.dormantMonsters].some((a) =>
          g.footprintOf(a).some((q) => q.x === x && q.y === y)
        ) ||
        rt.worldWorkEntities().some((e) => e.depth === g.depth && e.x === x && e.y === y)
      )
        continue;
      spots.push(p);
    }
  return spots.slice(0, count);
}
function summary(g: Game, c: CampRecord, r: CampRaidState, tick: number): void {
  const w = g.world5!,
    e = r.event!;
  const l = w.offline.find((l) => l.campSlotId === c.slot)!;
  const guards = w.residents.filter(
    (a) =>
      a.campSlotId === c.slot &&
      residentComponent(g, a.actorId)?.mode === 'stay' &&
      residentComponent(g, a.actorId)?.job.kind === 'guard' &&
      (() => {
        const r = residentComponent(g, a.actorId)!,
          phase = Math.floor(campEconomicTick(g, c.slot, tick) / 1000) % 32;
        return phase < r.schedule[0] || phase >= r.schedule[0] + r.schedule[1];
      })() &&
      l.residentStates.some(
        (s) => s.actorId === a.actorId && s.alive && !s.departed && s.foodShortage === 0
      ) &&
      (() => {
        const job = residentComponent(g, a.actorId)?.job;
        return (
          job?.kind === 'guard' &&
          inResidentCamp(g, c, job.at, c.depth) &&
          !!g.residentGridAt(c.depth)?.getCell(job.at.x, job.at.y)?.isPassable
        );
      })()
  ).length;
  const rows = w.structures.filter((s) => s.regionId === c.regionId),
    components = rows
      .flatMap((s) => STRUCTURE_SLOTS.flatMap((slot) => (s[slot] ? [{ row: s, c: s[slot]! }] : [])))
      .sort((a, b) => a.c.id - b.c.id);
  const barriers = Math.min(
    8,
    components.filter(({ c }) => {
      const d = structureDefinition(g, c.definitionId);
      return ['wall', 'door'].includes(d.barrierKind ?? '') && c.hp === d.maxHp;
    }).length
  );
  const stocks: import('./SettlementRaidPlan').RaidLossInput['stocks'] = [];
  for (const box of w.containers.filter(
    (b) =>
      b.kind === 'chest' &&
      b.owner === r.owner &&
      b.levelRef.kind === 'dungeon' &&
      b.levelRef.depth === c.depth
  )) {
    const at = containerRead(g, box.id).at;
    if (!at || !inResidentCamp(g, c, at, c.depth) || reservedContainerSlots(g, box.id)) continue;
    for (const item of containerItems(g, box.id)) {
      const read = itemRead(g, item),
        key =
          item.category === ItemCategory.FOOD
            ? 'food.' + (item.consumableId ?? item.identityId)
            : read.tags.find((t) => t.startsWith('basic.'));
      if (!key || c.locked.some((l) => l.itemId === item.id)) continue;
      stocks.push({
        key,
        boxId: box.id,
        boxRevision: box.revision,
        itemId: item.id,
        quantity: item.quantity
      });
    }
  }
  const plan = planRaidLoss({
    eventId: e.id,
    seedKey: l.seedKey,
    attack: e.budget,
    defense: guards * 2 + barriers,
    stocks,
    components: components.map(({ c }) => {
      const d = structureDefinition(g, c.definitionId);
      return {
        id: c.id,
        revision: c.revision,
        hp: c.hp,
        maxHp: d.maxHp,
        resistance: d.resistances.physical
      };
    })
  });
  // Validate the complete write set before the first debit; the outer shared transaction covers every writer.
  for (const debit of plan.debits) {
    const box = w.containers.find((b) => b.id === debit.boxId),
      item = g.worldContainerItems!.get(debit.itemId);
    if (
      !box ||
      box.revision !== debit.boxRevision ||
      !item ||
      !box.itemIds.includes(item.id) ||
      item.quantity !== debit.expectedQuantity
    )
      throw new World5Error('C5_STALE');
  }
  for (const damage of plan.damage) {
    const component = components.find((x) => x.c.id === damage.id)?.c;
    if (!component || component.revision !== damage.revision || component.hp !== damage.hp)
      throw new World5Error('C5_STALE');
  }
  for (const debit of plan.debits) {
    const item = g.worldContainerItems!.get(debit.itemId)!,
      box = w.containers.find((b) => b.id === debit.boxId)!;
    item.quantity -= debit.quantity;
    box.revision = checkedAdd(box.revision, 1);
    if (!item.quantity) {
      box.itemIds = box.itemIds.filter((id) => id !== item.id);
      g.worldContainerItems!.delete(item.id);
    }
  }
  for (const damage of plan.damage)
    if (applyRaidStructureDamage(g, damage.id, damage.amount) !== damage.actual)
      throw new World5Error('C5_TRANSACTION');
  e.lostUnits = plan.lostUnits;
  e.damagedHp = plan.damagedHp;
  e.phase = 'aftermath';
  e.reason = 'summary';
  e.endedTick = tick;
  r.cooldownUntil = checkedAdd(tick, g.extensionRuntime!.worldRaidRules(r.owner)!.cooldown);
  r.pressure = 0;
  const state = g.extensionRuntime!.worldCampState(r.owner);
  state.revision = checkedAdd(state.revision, 1);
  g.extensionRuntime!.worldCampReplace(r.owner, state);
  recordWorldReceipt(g, r.owner, 'offline', e.id + '.summary', 'completed', 'summary');
  markRecordingRoot(w);
}
export function settleCampRaid(
  g: Game,
  owner: string,
  c: CampRecord,
  l: import('../../ext/world5').OfflineLedger,
  tick: number
): void {
  const rules = g.extensionRuntime!.worldRaidRules(owner);
  if (!rules) return;
  const r = raidState(g, owner, c)!;
  if (r.pauseFrom !== null || g.isGameOver) return;
  let e = r.event;
  if (e?.phase === 'aftermath' && c.depth === g.depth && inResidentCamp(g, c, g.player.loc)) {
    e.phase = 'closed';
    notify(g, r, c, 'summary', tick);
    r.lastPressureTick = tick;
    return;
  }
  const p = population(g, c),
    d = Math.min(3, Math.floor((c.depth - 1) / 5));
  const start = Math.max(r.lastPressureTick, r.createdTick + rules.grace, r.cooldownUntil),
    epochs = Math.max(0, Math.floor(tick / rules.period) - Math.floor(start / rules.period));
  if (p && epochs && (!e || ['closed', 'warning', 'deferred'].includes(e.phase))) {
    const noise = r.noiseEpoch === Math.floor(tick / 1000) - 1 ? r.noiseBatches : 0;
    const rate = 1 + Math.ceil(p / 4) + d + noise,
      threshold = rules.threshold + 8 * (r.lastOrdinal % 3);
    r.pressure = Math.min(256, r.pressure + epochs * rate);
    if (e && ['warning', 'deferred'].includes(e.phase)) {
      e.mergedPressure = Math.min(128, e.mergedPressure + epochs * rate);
      e.severity = Math.min(2, Math.floor(e.mergedPressure / 64));
      e.budget = Math.min(
        rules.maxActors,
        1 +
          Math.ceil(e.population / 4) +
          Math.min(2, Math.floor(e.facilities / 2)) +
          Math.min(1, e.depthBonus) +
          e.severity
      );
    } else if (r.pressure >= threshold) {
      const slots = g.world5!.raidCamps.filter(
        (r) => r.event && ['warning', 'deferred', 'active'].includes(r.event.phase)
      ).length;
      if (slots >= rules.maxEvents) {
        r.admissionReason = 'slots';
        notify(g, r, c, 'slots', tick);
      } else {
        r.admissionReason = null;
        g.world5!.raidAdmissionCursor = c.regionId;
        r.lastOrdinal = checkedAdd(r.lastOrdinal, 1);
        e = r.event = {
          id: `raid.${c.regionId}.${r.lastOrdinal}`,
          ordinal: r.lastOrdinal,
          phase: 'warning',
          triggerTick: tick,
          dueTick: checkedAdd(tick, rules.warning),
          lastAttemptTick: tick,
          population: p,
          facilities: facilities(g, c),
          depthBonus: d,
          severity: 0,
          mergedPressure: 0,
          budget: Math.min(
            rules.maxActors,
            1 + Math.ceil(p / 4) + Math.min(2, Math.floor(facilities(g, c) / 2)) + Math.min(1, d)
          ),
          actorIds: [],
          defeatedIds: [],
          actors: [],
          reason: null,
          endedTick: null,
          lostUnits: 0,
          damagedHp: 0
        };
        r.pressure = 0;
        notify(g, r, c, 'warning', tick);
      }
    }
  }
  r.lastPressureTick = tick;
  if (
    e &&
    ['warning', 'deferred'].includes(e.phase) &&
    tick >= e.dueTick &&
    tick >= e.lastAttemptTick + rules.period
  ) {
    e.lastAttemptTick = tick;
    if (c.depth !== g.depth) {
      summary(g, c, r, tick);
    } else if (!p) {
      e.phase = 'closed';
      e.endedTick = tick;
      r.cooldownUntil = checkedAdd(tick, rules.cooldown);
    } else {
      const spots = landing(g, c, e.budget);
      if (spots.length !== e.budget) {
        e.phase = 'deferred';
        e.reason = 'landing';
        notify(g, r, c, 'deferred', tick);
      } else {
        const roster = [...rules.rosters].reverse().find((t) => t.minDepth <= c.depth)!.ids;
        for (let n = 0; n < spots.length; n++) {
          const draw = parseInt(sha256(l.seedKey + e.id + '.' + n).slice(0, 8), 16);
          const a = g.createRaidMonster(roster[draw % roster.length]!, spots[n]!);
          if (!a) throw new World5Error('C5_TRANSACTION');
          e.actorIds.push(a.id);
          e.actors.push({ actorId: a.id, birthTypeId: a.typeId, currentTypeId: a.typeId, departed: null });
        }
        e.phase = 'active';
        e.reason = null;
        notify(g, r, c, 'active', tick);
      }
    }
  }
  markRecordingRoot(g.world5!);
}
export function validateRaidReferences(g: Game): void {
  const w = g.world5!,
    rt = g.extensionRuntime!,
    actors = residentActors(g);
  for (const owner of rt.worldCampOwners())
    for (const c of rt.worldCampRecords(owner))
      if (rt.worldRaidRules(owner) && !campRaid(g, c.slot))
        throw new World5Error('C5_BAD_REFERENCE', 'missingRaid');
  for (const r of w.raidCamps) {
    const c = rt
      .worldCampRecords(r.owner)
      .find((c) => c.slot === r.slot && c.regionId === r.campId);
    if (
      !c ||
      !rt.worldRaidRules(r.owner) ||
      (r.pauseFrom !== null && (c.depth === g.depth || r.event?.phase !== 'active')) ||
      (r.event?.phase === 'active' && c.depth !== g.depth && r.pauseFrom === null)
    )
      throw new World5Error('C5_BAD_REFERENCE', 'raidHome');
    const rules = rt.worldRaidRules(r.owner)!, e = r.event;
    if (r.lastPressureTick < r.createdTick || r.reportedTick > 0 && r.reportedTick < r.createdTick ||
        r.lastPauseStart > 0 && r.lastPauseStart < r.createdTick)
      throw new World5Error('C5_BAD_REFERENCE', 'raidTime');
    if (!e) continue;
    // Installed run rules are authority, before any root can permit cached attacks.
    if (e.triggerTick - r.createdTick < rules.grace ||
        e.dueTick - e.triggerTick !== rules.warning ||
        e.triggerTick > r.lastPressureTick || e.lastAttemptTick > r.lastPressureTick ||
        e.depthBonus !== Math.min(3, Math.floor((c.depth - 1) / 5)) ||
        (['warning', 'deferred', 'active'].includes(e.phase) && e.triggerTick < r.cooldownUntil) ||
        (r.pauseFrom !== null && (r.pauseFrom < e.lastAttemptTick || r.pauseThrough < e.dueTick)) ||
        (['aftermath', 'closed'].includes(e.phase) &&
          (e.endedTick! < e.dueTick || r.cooldownUntil - e.endedTick! !== rules.cooldown)))
      throw new World5Error('C5_BAD_REFERENCE', 'raidTime');
    const roster = [...rules.rosters].reverse().find(row => row.minDepth <= c.depth)!.ids;
    for (const row of e.actors) {
      const id = row.actorId, a = actors.find(a => a.id === id), atDepth = a && raidActorDepth(g, a);
      if (!roster.includes(row.birthTypeId) ||
          !(knownPolymorphSpecies(row.currentTypeId) || rt.nativeForms().some(form => form.id === row.currentTypeId)) ||
          (!a && !e.defeatedIds.includes(id)) ||
          (a && (a.typeId !== row.currentTypeId || w.residents.some(s => s.actorId === id) ||
            e.defeatedIds.includes(id) && a.hp > 0 ||
            row.departed === null && a.hp > 0 && atDepth !== c.depth ||
            row.departed !== null && a.hp > 0 && !raidActorAwayFromCamp(g, a, c.depth) ||
            a.spatial?.bodyMember && a.spatial.bodyMember.groupId !== id)) ||
          (row.departed && (row.departed.depth !== c.depth + 1 || row.departed.tick < e.dueTick)))
        throw new World5Error('C5_BAD_REFERENCE', 'raidActor');
    }
  }
}

/** Actual owned layer, including native pending fall queues; never inferred from species. */
function raidActorDepth(g: Game, a: import('../../entities/Monster').Monster): number | undefined {
  const host = g as unknown as { currentLevelDepth?: number; pendingFallenByDepth: Map<number, import('../../entities/Monster').Monster[]> };
  if (g.monsters.includes(a) || g.dormantMonsters.includes(a)) return host.currentLevelDepth ?? g.depth;
  return [...g.levels].find(([, l]) => l.monsters.includes(a) || l.dormantMonsters?.includes(a))?.[0] ??
    [...host.pendingFallenByDepth].find(([, actors]) => actors.includes(a))?.[0];
}
/** Pending queues own travellers, not present invaders, even when a later fall targets home. */
function raidActorAwayFromCamp(g: Game, a: import('../../entities/Monster').Monster, campDepth: number): boolean {
  const depth = raidActorDepth(g, a);
  const pending = g as unknown as { pendingFallenByDepth: Map<number, import('../../entities/Monster').Monster[]> };
  return depth !== undefined && (depth !== campDepth || [...pending.pendingFallenByDepth.values()].some(actors => actors.includes(a)));
}
/** Native publication back home restores effective membership; never called from load or UI. */
export function recordRaidLevelEntry(g: Game, a: import('../../entities/Monster').Monster): void {
  if (!g.monsters.includes(a)) return;
  for (const r of g.world5?.raidCamps ?? []) {
    const row = r.event?.phase === 'active' && r.event.actors.find(row => row.actorId === a.id);
    const camp = row ? g.extensionRuntime!.worldCampRecords(r.owner).find(c => c.slot === r.slot) : undefined;
    if (row && row.departed && camp?.depth === g.depth) {
      row.departed = null;
      markRecordingRoot(g.world5!);
    }
  }
}
/** Derived permission stays narrower than lifecycle membership: no traveller or multi-part source. */
export function frozenRaidActors(g: Game): number[] {
  if (!g.world5 || !g.extensionRuntime || !g.world5.raidCamps.some(r => r.pauseFrom !== null && r.event?.phase === 'active')) return [];
  const actors = residentActors(g);
  return g.world5.raidCamps.flatMap(r => {
    if (r.pauseFrom === null || r.event?.phase !== 'active') return [];
    const c = g.extensionRuntime!.worldCampRecords(r.owner).find(c => c.regionId === r.campId);
    if (!c) return [];
    return r.event.actors.flatMap(row => {
      const a = actors.find(a => a.id === row.actorId);
      return row.departed === null && a && a.hp > 0 && !a.deathProcessed &&
        a.typeId === row.currentTypeId && !a.spatial?.bodyMember && footprintOf(a).length === 1 &&
        raidActorDepth(g, a) === c.depth ? [a.id] : [];
    });
  });
}
/** Only the native committed replacement path publishes a new form for the same identity. */
export function recordRaidForm(g: Game, a: import('../../entities/Monster').Monster): void {
  for (const r of g.world5?.raidCamps ?? []) {
    const row = r.event?.actors.find(row => row.actorId === a.id);
    if (row && row.currentTypeId !== a.typeId) {
      row.currentTypeId = a.typeId;
      markRecordingRoot(g.world5!);
    }
  }
}
/** Surviving native fall retires membership only; entity, HP, rewards and custody stay native. */
export function recordRaidFall(g: Game, id: number, depth: number): void {
  for (const r of g.world5?.raidCamps ?? []) {
    const row = r.event?.phase === 'active' && r.event.actors.find(row => row.actorId === id);
    if (row && row.departed === null) {
      row.departed = { depth, tick: g.world5!.simulationTicks };
      markRecordingRoot(g.world5!);
    }
  }
}

/** Native death fact, inside the original kill transaction; never awards raid rewards. */
export function recordRaidDeath(g: Game, id: number): void {
  for (const r of g.world5?.raidCamps ?? []) {
    const e = r.event;
    if (e?.phase === 'active' && e.actorIds.includes(id) && !e.defeatedIds.includes(id)) {
      e.defeatedIds.push(id);
      e.defeatedIds.sort((a, b) => a - b);
      markRecordingRoot(g.world5!);
    }
  }
}

/** Mechanical region entry publishes an aftermath once; UI/load never call this. */
export function reportRaidVisits(g: Game): void {
  if (g.isGameOver || !g.world5 || !g.extensionRuntime) return;
  for (const r of g.world5.raidCamps) {
    const c = g.extensionRuntime.worldCampRecords(r.owner).find((c) => c.regionId === r.campId);
    if (r.event?.phase !== 'aftermath' || !c || !inResidentCamp(g, c, g.player.loc)) continue;
    transactResidentWorld(g, () => {
      r.event!.phase = 'closed';
      r.lastPressureTick = g.world5!.simulationTicks;
      const state = g.extensionRuntime!.worldCampState(r.owner);
      state.revision = checkedAdd(state.revision, 1);
      g.extensionRuntime!.worldCampReplace(r.owner, state);
      notify(g, r, c, 'summary', g.world5!.simulationTicks);
      markRecordingRoot(g.world5!);
    });
  }
}

export function recordRaidProduction(g: Game, slot: number, tick: number, batches: number): void {
  const r = campRaid(g, slot);
  if (!r || !batches) return;
  const epoch = Math.floor(tick / 1000);
  if (r.noiseEpoch !== epoch) {
    r.noiseEpoch = epoch;
    r.noiseBatches = 0;
  }
  r.noiseBatches = Math.min(4, r.noiseBatches + batches);
  markRecordingRoot(g.world5!);
}
