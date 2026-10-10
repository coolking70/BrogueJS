import type { World5Snapshot } from './world5';
import { exact, uint, World5Error } from './worldBasics';
export function validateRaidRoots(w: World5Snapshot, owners: readonly string[]): void {
  const bad = (): never => {
    throw new World5Error('C5_BAD_REFERENCE', 'raid');
  };
  if (
    !Array.isArray(w.raidCamps) ||
    w.raidCamps.length > 8 ||
    new Set(w.raidCamps.map((r) => r.slot)).size !== w.raidCamps.length
  )
    bad();
  uint(w.raidAdmissionCursor, 'raidAdmissionCursor');
  let active = 0;
  const ids = new Set<number>();
  for (const r of w.raidCamps) {
    exact(
      r,
      'owner,campId,slot,createdTick,lastPressureTick,pressure,admissionReason,lastOrdinal,cooldownUntil,reportedTick,report,noiseEpoch,noiseBatches,excludedTicks,pauseBaseExcludedTicks,lastPauseStart,pauseFrom,pauseThrough,event',
      'raidCamp'
    );
    if (!owners.includes(r.owner) || !(r.admissionReason === null || r.admissionReason === 'slots'))
      bad();
    for (const k of [
      'campId',
      'slot',
      'createdTick',
      'lastPressureTick',
      'pressure',
      'lastOrdinal',
      'cooldownUntil',
      'reportedTick',
      'noiseEpoch',
      'noiseBatches',
      'excludedTicks',
      'pauseBaseExcludedTicks',
      'lastPauseStart',
      'pauseThrough'
    ] as const)
      uint(r[k], k, k === 'campId' ? 1 : 0);
    if (
      r.noiseEpoch > Math.floor(w.simulationTicks / 1000) ||
      r.noiseBatches > 4 ||
      r.slot > 7 ||
      r.pressure > 256 ||
      r.createdTick > w.simulationTicks ||
      r.lastPressureTick > w.simulationTicks ||
      r.reportedTick > w.simulationTicks ||
      r.lastPauseStart > r.pauseThrough ||
      r.excludedTicks !== r.pauseBaseExcludedTicks + r.pauseThrough - r.lastPauseStart ||
      r.excludedTicks > r.pauseThrough ||
      r.pauseThrough > w.simulationTicks
    )
      bad();
    if (r.pauseFrom !== null) {
      uint(r.pauseFrom, 'pauseFrom');
      if (
        r.pauseFrom !== r.lastPauseStart ||
        r.pauseFrom > r.pauseThrough ||
        r.event?.phase !== 'active'
      )
        bad();
    }
    if (!w.offline.some((l) => l.campSlotId === r.slot && l.lastSettledTick >= r.pauseThrough))
      bad();
    if (r.report !== null) {
      exact(r.report, 'phase,reason,lostUnits,damagedHp', 'raidReport');
      if (
        !(
          r.report.phase === null ||
          ['warning', 'deferred', 'active', 'aftermath', 'closed'].includes(r.report.phase)
        ) ||
        !(
          r.report.reason === null ||
          ['slots', 'landing', 'summary', 'combat'].includes(r.report.reason)
        )
      )
        bad();
      uint(r.report.lostUnits, 'report.lostUnits');
      uint(r.report.damagedHp, 'report.damagedHp');
      if (
        ['warning', 'deferred', 'active'].includes(r.report.phase ?? '') &&
        (r.report.lostUnits || r.report.damagedHp)
      )
        bad();
    }
    const e = r.event;
    if (r.admissionReason !== null && e && e.phase !== 'closed') bad();
    if (!e) {
      if (r.lastOrdinal || r.pauseFrom !== null) bad();
      continue;
    }
    exact(
      e,
      'id,ordinal,phase,triggerTick,dueTick,lastAttemptTick,population,facilities,depthBonus,severity,mergedPressure,budget,actorIds,defeatedIds,actors,reason,endedTick,lostUnits,damagedHp',
      'raidEvent'
    );
    for (const k of [
      'ordinal',
      'triggerTick',
      'dueTick',
      'lastAttemptTick',
      'population',
      'facilities',
      'depthBonus',
      'severity',
      'mergedPressure',
      'budget',
      'lostUnits',
      'damagedHp'
    ] as const)
      uint(e[k], k);
    if (
      e.id !== `raid.${r.campId}.${e.ordinal}` ||
      e.ordinal !== r.lastOrdinal ||
      e.ordinal < 1 ||
      !['warning', 'deferred', 'active', 'aftermath', 'closed'].includes(e.phase) ||
      e.population < 1 ||
      e.population > 16 ||
      e.facilities > 4 ||
      e.depthBonus > 3 ||
      e.severity > 2 ||
      e.severity !== Math.min(2, Math.floor(e.mergedPressure / 64)) ||
      e.mergedPressure > 128 ||
      e.budget < 1 ||
      e.budget > 8 ||
      e.budget !==
        Math.min(
          8,
          1 +
            Math.ceil(e.population / 4) +
            Math.min(2, Math.floor(e.facilities / 2)) +
            Math.min(1, e.depthBonus) +
            e.severity
        ) ||
      e.triggerTick > w.simulationTicks ||
      e.dueTick !== e.triggerTick + 2000 ||
      e.lastAttemptTick > w.simulationTicks ||
      e.lastAttemptTick < e.triggerTick ||
      !(e.reason === null || ['slots', 'landing', 'summary', 'combat'].includes(e.reason))
    )
      bad();
    if (
      !Array.isArray(e.actorIds) ||
      e.actorIds.length > 8 ||
      new Set(e.actorIds).size !== e.actorIds.length
    )
      bad();
    for (const id of e.actorIds) {
      uint(id, 'raidActor', 1);
      if (ids.has(id)) bad();
      ids.add(id);
    }
    if (
      !Array.isArray(e.defeatedIds) ||
      new Set(e.defeatedIds).size !== e.defeatedIds.length ||
      e.defeatedIds.some((id) => !e.actorIds.includes(id))
    )
      bad();
    if (!Array.isArray(e.actors) || e.actors.length !== e.actorIds.length ||
        new Set(e.actors.map(a => a.actorId)).size !== e.actors.length) bad();
    for (const a of e.actors) {
      exact(a, 'actorId,birthTypeId,currentTypeId,departed', 'raidLifecycle');
      uint(a.actorId, 'raidLifecycle.actorId', 1);
      if (!e.actorIds.includes(a.actorId) || typeof a.birthTypeId !== 'string' ||
          typeof a.currentTypeId !== 'string') bad();
      if (a.departed !== null) {
        exact(a.departed, 'depth,tick', 'raidDeparture');
        uint(a.departed.depth, 'raidDeparture.depth', 1);
        uint(a.departed.tick, 'raidDeparture.tick');
        if (a.departed.tick < e.lastAttemptTick || a.departed.tick > w.simulationTicks) bad();
      }
    }
    if (
      (e.phase === 'active' && e.actorIds.length !== e.budget) ||
      (['warning', 'deferred', 'aftermath', 'closed'].includes(e.phase) && e.actorIds.length) ||
      (e.phase === 'warning' && (e.reason !== null || e.lastAttemptTick !== e.triggerTick)) ||
      (e.phase === 'deferred' && (e.reason !== 'landing' || e.lastAttemptTick < e.dueTick)) ||
      (e.phase === 'active' && (e.reason !== null || e.lastAttemptTick < e.dueTick)) ||
      (e.phase === 'aftermath' && e.reason !== 'summary') ||
      (['warning', 'deferred', 'active'].includes(e.phase) && (e.lostUnits || e.damagedHp)) ||
      (e.phase === 'closed' && ![null, 'summary', 'combat'].includes(e.reason)) ||
      (['warning', 'deferred', 'active'].includes(e.phase) && e.endedTick !== null)
    )
      bad();
    if (['aftermath', 'closed'].includes(e.phase)) {
      uint(e.endedTick, 'endedTick');
      if (e.endedTick! > w.simulationTicks || e.endedTick! < e.triggerTick) bad();
    }
    if (['warning', 'deferred', 'active'].includes(e.phase)) active++;
  }
  if (active > 4) bad();
}
