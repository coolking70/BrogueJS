import { appendFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Game } from '../../../../engine/Core/Game';
import { footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { cellTerrainFlags } from '../../../../engine/Map/DungeonFeature';
import { T_IS_FIRE, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from '../../../../engine/Map/TerrainCatalog';
import { logger } from '../../../../engine/Systems/Logger';
import { ItemCategory } from '../../../../engine/Items/Item';
import { readCreatureBirth } from '../../../birth';
import { canonical } from '../../../json';
import { startGiants, giantsState, json } from './naturalFixture';
export type Species = 'lantern' | 'copper';
type Pos = { x: number; y: number };
export let lastSearchAttempt:
  | {
      seed: number;
      species: Species;
      depth: number;
      events: number;
      placements: unknown;
      detail?: string;
    }
  | undefined;
const progress = (game: Game, detail: string) => {
  if (lastSearchAttempt) {
    lastSearchAttempt = {
      ...lastSearchAttempt,
      depth: game.depth,
      events: game.exportRecording().events.length,
      placements: giantsState(game).placements,
      detail
    };
    if (process.env.BROGUE_CAPTURE_GIANTS2_TRACE === '1')
      appendFileSync('/tmp/giants2-progress.ndjson', JSON.stringify(lastSearchAttempt) + '\n');
  }
};
export const formOf = (species: Species) =>
  species === 'lantern' ? 'giants.blind-lantern' : 'giants.copper-tendril';
const directions = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1]
] as const;
const key = (p: Pos) => `${p.x},${p.y}`;
export const world = (game: Game) => {
  const snapshot = json(game.toSnapshot());
  snapshot.savedAt = 0;
  return canonical(snapshot);
};
export const digest = (value: unknown) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : canonical(value))
    .digest('hex');
export function settle(game: Game) {
  if (game.pendingCommandConfirmation)
    game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
  while (logger.pendingAcknowledgment) logger.acknowledgeNext();
}
/** Full-map read-only planning; every mutation is a public command. */
export function routeCommand(
  game: Game,
  target: Pos,
  attackCells?: readonly Pos[],
  stairs: 'stairs_down' | 'stairs_up' = 'stairs_down'
) {
  const at = game.player.loc;
  const occupied = new Set(
    game.monsters.filter((m) => m.hp > 0 && m.spatial).flatMap((m) => footprintOf(m).map(key))
  );
  const valid = (p: Pos) => {
    const c = game.grid.getCell(p.x, p.y);
    return (
      !!c &&
      !occupied.has(key(p)) &&
      (c.isPassable || [T.DOOR, T.SECRET_DOOR].includes(c.terrain)) &&
      !c.layers.some((t) => [T.LAVA, T.CHASM, T.WATER_DEEP].includes(t)) &&
      !(cellTerrainFlags(game.grid, p.x, p.y) & T_IS_FIRE)
    );
  };
  const diagonal = (p: Pos, n: Pos) =>
    p.x === n.x ||
    p.y === n.y ||
    (valid({ x: n.x, y: p.y }) &&
      valid({ x: p.x, y: n.y }) &&
      !(cellTerrainFlags(game.grid, n.x, p.y) & T_OBSTRUCTS_DIAGONAL_MOVEMENT) &&
      !(cellTerrainFlags(game.grid, p.x, n.y) & T_OBSTRUCTS_DIAGONAL_MOVEMENT));
  const contact = (p: Pos) =>
    (attackCells ?? [])
      .filter((c) => Math.max(Math.abs(c.x - p.x), Math.abs(c.y - p.y)) === 1)
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .find((c) => diagonal(p, c));
  const touch = contact(at);
  if (touch) {
    game.executeCommand('move', { x: touch.x - at.x, y: touch.y - at.y });
    settle(game);
    return;
  }
  const q = [{ ...at }],
    prev = new Map<string, Pos | null>([[key(at), null]]);
  let goal: Pos | undefined;
  for (let i = 0; i < q.length; i++) {
    const p = q[i]!;
    if (attackCells ? !!contact(p) : key(p) === key(target)) {
      goal = p;
      break;
    }
    for (const [dx, dy] of directions) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (valid(n) && diagonal(p, n) && !prev.has(key(n))) {
        prev.set(key(n), p);
        q.push(n);
      }
    }
  }
  if (!goal) throw Error(`No natural ${attackCells ? 'contact' : 'stair'} route D${game.depth}`);
  let next = goal,
    p = goal;
  while (prev.get(key(p))) {
    next = p;
    p = prev.get(key(p))!;
  }
  if (game.grid.getCell(next.x, next.y)!.terrain === T.SECRET_DOOR) game.executeCommand('search');
  else if (key(next) === key(at)) game.executeCommand(stairs);
  else game.executeCommand('move', { x: next.x - at.x, y: next.y - at.y });
  settle(game);
}
export function descendNatural(game: Game, depth: number, budget = 3000) {
  try {
    for (let n = 0; game.depth < depth && !game.isGameOver && n < budget; n++) {
      if (n % 100 === 0) progress(game, `descending-to-${depth} command-${n}`);
      const food =
        game.player.nutrition < 400
          ? game.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)
          : undefined;
      if (food) {
        game.executeItemCommand('eat', food);
        settle(game);
      } else routeCommand(game, game.levelSeeds[game.depth - 1]!.downStairsLoc);
    }
  } finally {
    progress(game, `descent-target-${depth} stopped-depth-${game.depth}`);
  }
  if (game.depth !== depth || game.isGameOver)
    throw Error(`Descent incomplete D${game.depth}, HP${game.player.hp}`);
}
export function arriveNatural(
  species: Species,
  seed: number,
  ids: readonly string[] = ['giants'],
  mode: 'wizard' | 'normal' = 'wizard',
  onStart?: (game: Game) => void
) {
  lastSearchAttempt = { seed, species, depth: 1, events: 0, placements: [] };
  const game = startGiants(ids, seed, mode);
  settle(game);
  progress(game, 'start');
  onStart?.(game);
  const max = species === 'lantern' ? 4 : 8;
  for (let depth = 2; depth <= max; depth++) {
    const before = game.exportRecording().events.length;
    descendNatural(game, depth, 3000 - before);
    if (game.exportRecording().events.length > 3000) throw Error('Descent command budget exceeded');
    const boss = game.monsters.find((m) => m.typeId === formOf(species));
    if (boss) {
      const state = giantsState(game),
        record = state.bosses.find((b) => b.primaryId === boss.id),
        placement = state.placements.find((p) => p.instanceKey === record?.instanceKey);
      if (
        !record ||
        placement?.result !== 'placed' ||
        readCreatureBirth(boss)?.creationReason !== 'natural'
      )
        throw Error('Invalid natural birth');
      return { game, boss, record, placement };
    }
  }
  throw Error(`No ${species} placement through D${max}`);
}
export function attackNatural(game: Game, species: Species, id: number) {
  const core = game.monsters.find((m) => m.id === id);
  if (!core) throw Error('Missing living core');
  if (species === 'copper') {
    const target =
      game.monsters
        .filter((m) => m.id !== id && m.spatial?.bodyMember?.groupId === id)
        .sort(
          (a, b) =>
            Math.max(Math.abs(a.x - game.player.x), Math.abs(a.y - game.player.y)) -
              Math.max(Math.abs(b.x - game.player.x), Math.abs(b.y - game.player.y)) ||
            a.spatial!.bodyMember!.partId.localeCompare(b.spatial!.bodyMember!.partId) ||
            a.id - b.id
        )[0] ?? core;
    routeCommand(game, target.loc, footprintOf(target));
  } else {
    const zone =
      core.typeId === 'giants.blind-lantern' && !core.spatial?.zoneState?.[0]?.broken
        ? 'mantle'
        : 'wick';
    const cells = footprintOf(core).filter((p) => p.zoneId === zone);
    if (!cells.length) throw Error(`Missing ${zone} cells`);
    routeCommand(game, core.loc, cells);
  }
}
export interface Checkpoint {
  index: number;
  worldHash: string;
  label: string;
}
export function captureNatural(species: Species, seed: number) {
  let initialHash = '';
  let initialSave: ReturnType<Game['toSaveSnapshot']> | undefined;
  const { game, boss, record, placement } = arriveNatural(
      species,
      seed,
      ['giants'],
      'wizard',
      (initial) => {
        initialHash = digest(world(initial));
        initialSave = json(initial.toSaveSnapshot());
      }
    ),
    id = boss.id;
  progress(game, 'arrived');
  const birth = {
    id,
    depth: game.depth,
    placement: json(placement),
    encounter: json(record),
    birth: json(readCreatureBirth(boss)),
    spatial: json(boss.spatial)
  };
  const checkpoints: Checkpoint[] = [{ index: 0, label: 'initial', worldHash: initialHash }];
  const snapshots = new Map<number, ReturnType<Game['toSaveSnapshot']>>([[0, initialSave!]]);
  const save = (label: string) => {
    const index = game.exportRecording().events.length;
    checkpoints.push({ index, label, worldHash: digest(world(game)) });
    snapshots.set(index, json(game.toSaveSnapshot()));
  };
  save('arrival');
  let broken = false,
    phased = false,
    limbs = 0;
  for (let n = 0; n < 800 && !game.isGameOver; n++) {
    const core = game.monsters.find((m) => m.id === id);
    if (!core) break;
    const beforeIndex = game.exportRecording().events.length,
      beforeWorld = digest(world(game));
    progress(
      game,
      `before-command-${n} player-${game.player.x},${game.player.y} core-${core.x},${core.y} HP-${core.hp}`
    );
    attackNatural(game, species, id);
    progress(
      game,
      `after-command-${n} player-${game.player.x},${game.player.y} tick-${game.exportRecording().events.slice(-1)[0]?.tick} error-${game.lastAdvancementError}`
    );
    if (game.lastAdvancementError)
      throw Error(`Natural advancement failed: ${game.lastAdvancementError}`);
    const after = game.monsters.find((m) => m.id === id);
    if (after && game.visibleMonsters.has(after) && !checkpoints.some((p) => p.label === 'contact'))
      save('contact');
    const brokenNow = !!after?.spatial?.zoneState?.[0]?.broken,
      phaseNow = after?.typeId === 'giants.blind-lantern-open';
    const breaks = game.bodyGroups?.find((g) => g.coreId === id)?.appliedBreaks.length ?? limbs;
    const change =
      species === 'lantern'
        ? !broken && brokenNow
          ? 'break'
          : !phased && phaseNow
            ? 'phase'
            : undefined
        : breaks > limbs
          ? `limb-${breaks}`
          : undefined;
    if (change) {
      checkpoints.push({ index: beforeIndex, label: `before-${change}`, worldHash: beforeWorld });
      save(change);
    }
    broken ||= brokenNow;
    phased ||= phaseNow;
    limbs = breaks;
    if (species === 'lantern' && phased && !broken)
      throw Error('Natural phase preceded mantle break');
    if (
      species === 'copper' &&
      limbs >= 3 &&
      after &&
      after.hp > 0 &&
      !checkpoints.some((c) => c.label === 'immobile')
    )
      save('immobile');
    if (!after || after.hp <= 0) {
      checkpoints.push({ index: beforeIndex, label: 'before-defeat', worldHash: beforeWorld });
      save('defeat');
      break;
    }
  }
  if (giantsState(game).bosses.find((b) => b.primaryId === id)?.status !== 'defeated')
    throw Error(`Combat budget/death incomplete ${species}, HP${game.player.hp}`);
  if (species === 'lantern' && (!broken || !phased)) throw Error('Missing natural break/phase');
  if (species === 'copper' && !checkpoints.some((c) => c.label === 'immobile'))
    throw Error('Missing three-limb living core');
  save('final');
  const recording = json(game.exportRecording());
  const trace = {
    schema: 1,
    seed,
    mode: 'wizard' as const,
    modules: ['giants'],
    species,
    birth,
    commands: recording.events.map((e) => ({
      action: e.action,
      data: e.data,
      decisions: e.decisions
    })),
    checkpoints,
    finalHash: digest(world(game)),
    finalRng: game.toSnapshot().rngState,
    events: recording.events.length,
    recordingBytes: Buffer.byteLength(JSON.stringify(recording)),
    lastTick: recording.events.slice(-1)[0]?.tick
  };
  return { trace, recording, snapshots, final: world(game) };
}
