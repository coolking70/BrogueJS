import type { Game } from './Game';
import type { ActorNeedDeclaration, NeedEventFact, NeedTrigger } from '../../ext/actorNeeds';
import type { ActorNeedRow } from './EdibleState';
import { edibleState, peekEdibleState } from './EdibleState';
import { Monster } from '../../entities/Monster';
import { beginDeparture, isDeparting } from './ActorDeparture';
import { canDirectlySeeMonster } from '../UI/MonsterVisibility';
import { checkedAdd } from '../../ext/world5';
const due = new WeakMap<Game, { runtime: object; next: number }>();
export function needDeclarations(game: Game): readonly ActorNeedDeclaration[] {
  return game.extensionRuntime?.worldDefinitionPacks().flatMap((p) => p.actorNeeds ?? []) ?? [];
}
export function needBand(d: ActorNeedDeclaration, value: number): string {
  let band = d.bands[0]!.id;
  for (const b of d.bands) if (value <= b.atOrBelow) band = b.id;
  return band;
}
export function projectNeed(row: ActorNeedRow, d: ActorNeedDeclaration, now: number): ActorNeedRow {
  const elapsed = now - row.lastSettledTick + row.remainderTicks,
    points = Math.floor(elapsed / d.ticksPerPoint),
    value = Math.max(0, row.value - points);
  return {
    ...row,
    value,
    remainderTicks: value > 0 ? elapsed % d.ticksPerPoint : 0,
    lastSettledTick: now,
    zeroSinceTick:
      row.zeroSinceTick ??
      (value === 0 ? row.lastSettledTick - row.remainderTicks + row.value * d.ticksPerPoint : null)
  };
}
export function invalidateNeeds(game: Game): void {
  due.delete(game);
  game.extensionRuntime?.edibleDirty();
}
function event(
  game: Game,
  d: ActorNeedDeclaration,
  row: ActorNeedRow,
  kind: NeedEventFact['kind'],
  previousBand: string | null,
  crossedAtTick: number,
  deferred: boolean,
  reason: NeedEventFact['reason'] = null
): void {
  const actor = game.monsters.concat(game.dormantMonsters).find((a) => a.id === row.actorId),
    runtime = game.extensionRuntime!;
  const fact: NeedEventFact = {
    owner: d.owner,
    factId: runtime.edibleFactId(),
    actorId: row.actorId,
    needId: row.needId,
    kind,
    band: row.band,
    previousBand,
    value: row.value,
    crossedAtTick,
    tick: game.world5!.simulationTicks,
    deferred,
    visibleToPlayer: !!actor && canDirectlySeeMonster(game.player, game.grid, actor),
    reason
  };
  const departures: number[] = [];
  const ok = runtime.edibleParticipate(
    d.owner,
    'onNeedEvent',
    fact,
    {
      depart: (id: number) => {
        if (id !== row.actorId || !d.departure) throw new Error('C5_SCOPE');
        departures.push(id);
      }
    },
    true
  );
  if (ok)
    for (const id of departures)
      beginDeparture(
        game,
        id,
        { owner: d.owner, reason: d.id, visibleGraceTicks: d.departure!.visibleGraceTicks },
        deferred
      );
}
export function triggerActorNeeds(
  game: Game,
  actors: readonly Monster[],
  trigger: NeedTrigger
): void {
  if (!game.extensionRuntime || !game.world5) return;
  const declarations = needDeclarations(game);
  if (!declarations.length) return;
  const s = edibleState(game.extensionRuntime),
    now = game.world5.simulationTicks;
  for (const actor of [...actors].sort((a, b) => a.id - b.id)) {
    if (actor.hp <= 0 || actor.id === game.player.id) continue;
    const group = actor.spatial?.bodyMember,
      role = group
        ? game.bodyGroups?.find((g) => g.groupId === group.groupId)?.coreId === actor.id
          ? 'core'
          : 'member'
        : 'single';
    const facts = {
      actorId: actor.id,
      monsterId: actor.typeId,
      allied: actor.isAlly,
      inanimate: actor.hasBehavior('MONST_INANIMATE'),
      timedSummon: actor.hasStatus('lifespan_remaining'),
      groupRole: role
    } as const;
    for (const d of declarations) {
      const participant = game.extensionRuntime.edibleModule(d.owner)!.actorNeedParticipant!;
      let result = false;
      try {
        const supplied = game.extensionRuntime.ediblePure(() =>
          participant.qualifies(
            d.id,
            Object.freeze(facts),
            Object.freeze({
              queryOptional: (capability: string, input: any) =>
                game.extensionRuntime!.queryOptional(capability, input)
            })
          )
        );
        if (typeof supplied !== 'boolean') {
          if ((supplied as any)?.then) void Promise.resolve(supplied).catch(() => undefined);
          throw new Error('Non-boolean qualifies result');
        }
        result = supplied;
      } catch {
        game.extensionRuntime.noteEdibleDiagnostic(d.owner, 'qualifies');
      }
      let row = s.actorNeeds?.rows.find((r) => r.actorId === actor.id && r.needId === d.id);
      if (result && !row && !isDeparting(game, actor.id)) {
        row = {
          actorId: actor.id,
          needId: d.id,
          value: d.initial,
          remainderTicks: 0,
          lastSettledTick: now,
          zeroSinceTick: d.initial === 0 ? now : null,
          deadlineFired: false,
          band: needBand(d, d.initial),
          revision: 1
        };
        (s.actorNeeds ??= { schema: 1, rows: [] }).rows.push(row);
        event(game, d, row, 'attached', null, now, false);
      } else if (!result && row) {
        s.actorNeeds!.rows = s.actorNeeds!.rows.filter((r) => r !== row);
        event(game, d, projectNeed(row, d, now), 'detached', null, now, false, 'ineligible');
      }
    }
  }
  s.actorNeeds?.rows.sort((a, b) => a.actorId - b.actorId || (a.needId < b.needId ? -1 : 1));
  invalidateNeeds(game);
  void trigger;
}
export function detachActorNeeds(
  game: Game,
  actorId: number,
  reason: 'death' | 'departed',
  deferred = false
): void {
  const runtime = game.extensionRuntime;
  if (!runtime) return;
  const removed =
    peekEdibleState(runtime).actorNeeds?.rows.filter((r) => r.actorId === actorId) ?? [];
  if (!removed.length) return;
  const s = edibleState(runtime);
  s.actorNeeds!.rows = s.actorNeeds!.rows.filter((r) => r.actorId !== actorId);
  for (const row of removed) {
    const d = needDeclarations(game).find((d) => d.id === row.needId)!;
    event(
      game,
      d,
      projectNeed(row, d, game.world5!.simulationTicks),
      'detached',
      null,
      game.world5!.simulationTicks,
      deferred,
      reason
    );
  }
  invalidateNeeds(game);
}
export function feedNeed(
  game: Game,
  actorId: number,
  needId: string,
  amount: number,
  floor = 0
): number {
  const row = edibleState(game.extensionRuntime!).actorNeeds?.rows.find(
      (r) => r.actorId === actorId && r.needId === needId
    ),
    d = needDeclarations(game).find((d) => d.id === needId);
  if (!row || !d) throw new Error('C5_UNKNOWN_TARGET');
  Object.assign(row, projectNeed(row, d, game.world5!.simulationTicks));
  const before = row.value;
  if (amount >= 0) row.value = Math.min(d.max, row.value + amount);
  else if (row.value > floor) row.value = Math.max(floor, row.value + amount);
  if (row.value > 0) {
    row.zeroSinceTick = null;
    row.deadlineFired = false;
  } else row.zeroSinceTick ??= game.world5!.simulationTicks;
  const previousBand = row.band;
  row.band = needBand(d, row.value);
  row.revision = checkedAdd(row.revision, 1);
  if (row.band !== previousBand)
    event(game, d, row, 'band', previousBand, game.world5!.simulationTicks, false);
  invalidateNeeds(game);
  return row.value - before;
}
function nextDue(game: Game): number {
  const now = game.world5!.simulationTicks;
  let next = Infinity;
  for (const r of peekEdibleState(game.extensionRuntime!).actorNeeds?.rows ?? []) {
    // Cached and in-transit actors must keep their deadlines in the cache.
    // Publication can change without a qualification trigger.
    if (isDeparting(game, r.actorId)) continue;
    const d = needDeclarations(game).find((d) => d.id === r.needId)!;
    const v = projectNeed(r, d, now);
    if (v.band !== needBand(d, v.value)) next = now;
    for (const b of d.bands)
      if (
        b.atOrBelow < r.value &&
        d.bands.findIndex((x) => x.id === b.id) > d.bands.findIndex((x) => x.id === r.band)
      )
        next = Math.min(
          next,
          r.lastSettledTick - r.remainderTicks + (r.value - b.atOrBelow) * d.ticksPerPoint
        );
    if (d.zeroDeadlineTicks !== null && !r.deadlineFired)
      next = Math.min(
        next,
        (r.zeroSinceTick ?? r.lastSettledTick - r.remainderTicks + r.value * d.ticksPerPoint) +
          d.zeroDeadlineTicks
      );
  }
  return next;
}
export function settleActorNeeds(game: Game, deferred = false): void {
  const runtime = game.extensionRuntime;
  if (!runtime || !game.world5) return;
  const rows = peekEdibleState(runtime).actorNeeds?.rows;
  if (!rows?.length) return;
  const now = game.world5.simulationTicks,
    c = due.get(game);
  if (!deferred && c?.runtime === runtime && now < c.next) return;
  const active = new Set(game.monsters.concat(game.dormantMonsters).map((a) => a.id));
  for (const row of [...rows].sort(
    (a, b) => a.actorId - b.actorId || (a.needId < b.needId ? -1 : 1)
  )) {
    if (!active.has(row.actorId) || isDeparting(game, row.actorId)) continue;
    const d = needDeclarations(game).find((d) => d.id === row.needId)!;
    const v = projectNeed(row, d, now),
      band = needBand(d, v.value),
      previous = row.band;
    if (deferred || band !== row.band) {
      const old = { ...row };
      const from = d.bands.findIndex((b) => b.id === previous),
        to = d.bands.findIndex((b) => b.id === band);
      for (const crossing of d.bands.slice(from + 1, to + 1)) {
        const previousBand = row.band;
        const crossed =
          old.lastSettledTick -
          old.remainderTicks +
          (old.value - crossing.atOrBelow) * d.ticksPerPoint;
        const revision = checkedAdd(row.revision, 1);
        Object.assign(row, projectNeed(old, d, crossed), { band: crossing.id, revision });
        event(game, d, row, 'band', previousBand, crossed, deferred);
        if (
          isDeparting(game, row.actorId) ||
          !peekEdibleState(runtime).actorNeeds?.rows.includes(row)
        )
          break;
      }
      if (
        isDeparting(game, row.actorId) ||
        !peekEdibleState(runtime).actorNeeds?.rows.includes(row)
      )
        continue;
      Object.assign(row, v, { band, revision: row.revision });
    }
    if (isDeparting(game, row.actorId)) continue;
    if (
      v.zeroSinceTick !== null &&
      d.zeroDeadlineTicks !== null &&
      !row.deadlineFired &&
      now >= v.zeroSinceTick + d.zeroDeadlineTicks
    ) {
      const revision = checkedAdd(row.revision, 1);
      Object.assign(row, v, { band, deadlineFired: true, revision });
      event(game, d, row, 'deadline', null, v.zeroSinceTick + d.zeroDeadlineTicks, deferred);
    }
  }
  runtime.edibleDirty();
  due.set(game, { runtime, next: nextDue(game) });
}
