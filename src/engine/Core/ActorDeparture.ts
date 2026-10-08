/** Non-lethal retirement shared by companion needs and future residents. */
import { checkedAdd } from '../../ext/world5';
import type { Game } from './Game';
import { edibleState, peekEdibleState } from './EdibleState';
import { detachActorNeeds, invalidateNeeds } from './ActorNeeds';
import { canDirectlySeeMonster } from '../UI/MonsterVisibility';
import { TerrainType } from '../Map/Grid';
import { travelDistanceMap, TRAVEL_DIRECTIONS } from '../Movement/LevelTravel';
import { T_PATHING_BLOCKER } from '../Map/TerrainCatalog';
import type { Monster } from '../../entities/Monster';
import { isIncapacitated } from '../Status/Incapacitation';
import { bodyStatusDisables } from '../Status/BodyStatuses';
import { markRecordingRoot } from '../../ext/recordingRevisions';
export function isDeparting(game: Game, id: number): boolean {
  return (
    !!game.extensionRuntime &&
    !!peekEdibleState(game.extensionRuntime).departures?.active.some((r) => r.actorId === id)
  );
}
export function beginDeparture(
  game: Game,
  actorId: number,
  options: { owner: string; reason: string; visibleGraceTicks: number; occurredTick?: number },
  deferred = false,
  holdRetirement = false
): void {
  const actor = game.departureActor(actorId);
  if (!actor || actor.hp <= 0 || actorId === game.player.id) return;
  if (
    !Number.isSafeInteger(options.visibleGraceTicks) ||
    options.visibleGraceTicks < 0 ||
    options.visibleGraceTicks > 100000 ||
    options.visibleGraceTicks % 100 ||
    !(
      game.extensionRuntime?.edibleModule(options.owner) ||
      game.extensionRuntime?.residentOwners().includes(options.owner)
    )
  )
    throw new Error('C5_BAD_PAYLOAD');
  if (isDeparting(game, actorId)) return;
  const now = options.occurredTick ?? game.world5!.simulationTicks,
    s = edibleState(game.extensionRuntime!);
  const root = (s.departures ??= { schema: 1, nextOrdinal: 1, active: [], receipts: [] });
  root.active.push({
    actorId,
    ...{ owner: options.owner, reason: options.reason },
    startedTick: now,
    untilTick: checkedAdd(now, options.visibleGraceTicks)
  });
  root.active.sort((a, b) => a.actorId - b.actorId);
  game.beginActorDeparture(actor);
  for (const r of s.actorNeeds?.rows.filter((r) => r.actorId === actorId) ?? [])
    r.revision = checkedAdd(r.revision, 1);
  invalidateNeeds(game);
  if (
    !holdRetirement &&
    (game.world5!.simulationTicks >= now + options.visibleGraceTicks ||
      !canDirectlySeeMonster(game.player, game.grid, actor))
  )
    retireActor(
      game,
      actorId,
      deferred,
      game.world5!.simulationTicks >= now + options.visibleGraceTicks
        ? now + options.visibleGraceTicks
        : now
    );
}
export function retireActor(
  game: Game,
  actorId: number,
  deferred = false,
  occurredTick?: number
): void {
  const runtime = game.extensionRuntime!,
    s = edibleState(runtime),
    r = s.departures?.active.find((r) => r.actorId === actorId);
  const actor = game.departureActor(actorId);
  if (!r || !actor) return;
  const group = game.bodyGroups?.find((g) => g.coreId === actorId),
    ids = new Set([
      actorId,
      ...(group?.members.flatMap((m) => (m.entityId === null ? [] : [m.entityId])) ?? [])
    ]);
  for (const id of [...ids].sort((a, b) => a - b)) {
    detachActorNeeds(game, id, 'departed', deferred);
    if (s.timedStats) s.timedStats.rows = s.timedStats.rows.filter((r) => r.actorId !== id);
  }
  const facts = {
    id: actor.id,
    name: actor.name,
    hp: actor.hp,
    maxHp: actor.maxHp,
    x: actor.x,
    y: actor.y,
    player: false,
    allied: actor.isAlly,
    hostile: !actor.isAlly,
    monsterId: actor.typeId
  };
  game.retireDepartingActors(ids);
  s.departures!.active = s.departures!.active.filter((r) => !ids.has(r.actorId));
  const ordinal = s.departures!.nextOrdinal;
  s.departures!.nextOrdinal = checkedAdd(ordinal, 1);
  s.departures!.receipts.push({
    ordinal,
    actorId,
    owner: r.owner,
    reason: r.reason,
    tick: occurredTick ?? game.world5!.simulationTicks,
    result: 'retired'
  });
  s.departures!.receipts.splice(0, Math.max(0, s.departures!.receipts.length - 128));
  // A hook's buffered module writes can fail without undoing retirement.
  if (runtime.hasHook('actorDeparted')) {
    try {
      runtime.worldWorkTransaction(() =>
        runtime.emit('actorDeparted', { actor: facts, owner: r.owner, reason: r.reason, deferred })
      );
    } catch {
      runtime.noteEdibleDiagnostic(r.owner, 'actorDeparted');
    }
  } else markRecordingRoot(runtime);
  invalidateNeeds(game);
}
export function settleDepartures(game: Game, leaving = false, asOfTick?: number): void {
  const runtime = game.extensionRuntime;
  if (!runtime || !game.world5) return;
  const cutoff = asOfTick ?? game.world5.simulationTicks;
  for (const r of [...(peekEdibleState(runtime).departures?.active ?? [])].sort(
    (a, b) => Math.min(cutoff, a.untilTick) - Math.min(cutoff, b.untilTick) || a.actorId - b.actorId
  )) {
    const a = game.departureActor(r.actorId);
    if (!a || cutoff < r.startedTick) continue;
    // E26 base-type reader is pinned by the structure audit.
    // prettier-ignore
    const stairs=game.grid.getCell(a.x,a.y)?.layers.some(t=>t===TerrainType.STAIRS_UP||t===TerrainType.STAIRS_DOWN);
    if (
      leaving ||
      (!game.monsters.includes(a) && !game.dormantMonsters.includes(a)) ||
      stairs ||
      cutoff >= r.untilTick ||
      !canDirectlySeeMonster(game.player, game.grid, a)
    )
      retireActor(
        game,
        a.id,
        leaving || !game.monsters.includes(a),
        cutoff >= r.untilTick ? r.untilTick : cutoff
      );
  }
}
export function departureStep(game: Game, actor: Monster): boolean {
  if (!isDeparting(game, actor.id)) return false;
  if (
    isIncapacitated(actor) ||
    actor.hasStatus('entranced') ||
    actor.isCaged ||
    bodyStatusDisables(actor, 'decision')
  ) {
    actor.ticksUntilTurn = actor.movementSpeed;
    return true;
  }
  const stairs: { x: number; y: number; distance: number[][] }[] = [];
  for (let y = 0; y < game.grid.height; y++)
    for (let x = 0; x < game.grid.width; x++)
      // E26 base-type reader is pinned by the structure audit.
      // prettier-ignore
      if(game.grid.getCell(x,y)?.layers.some(t=>t===TerrainType.STAIRS_UP||t===TerrainType.STAIRS_DOWN))stairs.push({x,y,distance:travelDistanceMap(game.grid,game.monsters,{x,y},T_PATHING_BLOCKER,false)});
  const best = stairs.sort(
    (a, b) =>
      a.distance[actor.x]![actor.y]! - b.distance[actor.x]![actor.y]! || a.y - b.y || a.x - b.x
  )[0];
  const candidates = TRAVEL_DIRECTIONS.map(([dx, dy]) => ({
    x: actor.x + dx,
    y: actor.y + dy
  })).filter(
    (p) =>
      game.grid.isValidPos(p.x, p.y) &&
      !(p.x === game.player.x && p.y === game.player.y) &&
      game.canMoveDepartingActor(
        actor,
        p,
        stairs.some((s) => s.x === p.x && s.y === p.y)
      )
  );
  candidates.sort((a, b) =>
    best && best.distance[actor.x]![actor.y]! < 30000
      ? best.distance[a.x]![a.y]! - best.distance[b.x]![b.y]! || a.y - b.y || a.x - b.x
      : Math.max(Math.abs(b.x - game.player.x), Math.abs(b.y - game.player.y)) -
          Math.max(Math.abs(a.x - game.player.x), Math.abs(a.y - game.player.y)) ||
        a.y - b.y ||
        a.x - b.x
  );
  const p = candidates[0];
  if (p)
    game.moveDepartingActor(
      actor,
      p,
      stairs.some((s) => s.x === p.x && s.y === p.y)
    );
  actor.ticksUntilTurn = actor.movementSpeed;
  settleDepartures(game);
  return true;
}
