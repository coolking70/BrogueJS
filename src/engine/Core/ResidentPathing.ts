/** Derived resident distance maps; occupancy is checked anew at each actual step. */
import type { Game } from './Game';
import type { Grid } from '../Map/Grid';
import type { Pos } from '../../types';
import { playerTravelDiagonalBlocked } from '../Movement/PlayerTravel';
import { travelDistanceMap, TRAVEL_DIRECTIONS } from '../Movement/LevelTravel';
import { spatialTerrainRevision } from '../Movement/SpatialRevision';
import { T_PATHING_BLOCKER } from '../Map/TerrainCatalog';
interface Paths {
  grid: Grid;
  revision: number;
  blockers: string;
  maps: Map<string, number[][]>;
  rebuilds: number;
  blockedRebuilds: number;
}
const paths = new WeakMap<Game, Paths>();
export function residentDistanceMap(g: Game, target: Pos, _targetRevision: number): number[][] {
  const revision = spatialTerrainRevision(g.grid);
  // The native distance kernel blocks only these stationary immortal actors.
  // Mobile actors and the player are checked by the selector before moving.
  const blockers = JSON.stringify(
    g.monsters
      .filter(
        (m) =>
          m.hp > 0 &&
          (m.hasCEBehavior('MONST_IMMUNE_TO_WEAPONS') || m.hasCEBehavior('MONST_INVULNERABLE')) &&
          (m.hasCEBehavior('MONST_IMMOBILE') || m.hasCEBehavior('MONST_GETS_TURN_ON_ACTIVATION'))
      )
      .map((m) => [m.id, g.footprintOf(m)])
  );
  let cache = paths.get(g);
  if (!cache || cache.grid !== g.grid) {
    cache = { grid: g.grid, revision, blockers, maps: new Map(), rebuilds: 0, blockedRebuilds: 0 };
    paths.set(g, cache);
  } else if (cache.revision !== revision || cache.blockers !== blockers) {
    cache.maps.clear();
    cache.revision = revision;
    cache.blockers = blockers;
  }
  // Inventory/component revisions are rechecked on job acceptance. This pure
  // geometry map depends only on the target, terrain, and permanent blockers.
  const key = `${target.x},${target.y}`;
  let map = cache.maps.get(key);
  if (!map) {
    map = travelDistanceMap(g.grid, g.monsters, target, T_PATHING_BLOCKER);
    // Bounded session data, never part of saves or recording identity.
    if (cache.maps.size >= 32) cache.maps.delete(cache.maps.keys().next().value!);
    cache.maps.set(key, map);
    cache.rebuilds++;
  }
  return map;
}
export const residentPathRebuilds = (g: Game): number => paths.get(g)?.rebuilds ?? 0;
export function residentPathMetrics(g: Game) {
  const cache = paths.get(g);
  return {
    rebuilds: cache?.rebuilds ?? 0,
    blockedRebuilds: cache?.blockedRebuilds ?? 0,
    cacheMisses: (cache?.rebuilds ?? 0) - (cache?.blockedRebuilds ?? 0)
  };
}
/** Retain original map/cache identities through a failed resident publication. */
export function checkpointResidentPaths(g: Game): () => void {
  const cache = paths.get(g);
  if (!cache)
    return () => {
      paths.delete(g);
    };
  const { grid, revision, blockers, rebuilds, blockedRebuilds } = cache,
    entries = [...cache.maps];
  return () => {
    paths.set(g, cache);
    cache.grid = grid;
    cache.revision = revision;
    cache.blockers = blockers;
    cache.rebuilds = rebuilds;
    cache.blockedRebuilds = blockedRebuilds;
    cache.maps.clear();
    for (const [key, map] of entries) cache.maps.set(key, map);
  };
}

/** One bounded occupied-cell replan after the cached native gradient is blocked. */
export function residentBlockedMap(
  g: Game,
  actorId: number,
  target: Pos,
  base: number[][],
  allowed: (p: Pos) => boolean,
  origin?: Pos
): number[][] {
  const cache = paths.get(g);
  if (cache) {
    cache.rebuilds++;
    cache.blockedRebuilds++;
  }
  const distance = Array.from({ length: g.grid.width }, () =>
    Array<number>(g.grid.height).fill(30000)
  );
  const key = (p: Pos) => p.y * g.grid.width + p.x;
  const blocked = new Set(
    [...g.monsters, ...g.dormantMonsters]
      .filter((a) => a.hp > 0 && a.id !== actorId)
      .flatMap((a) => g.footprintOf(a).map(key))
  );
  if (g.player.hp > 0) blocked.add(key(g.player.loc));
  distance[target.x]![target.y] = 0;
  const queue = [target];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    // The step selector only accepts neighbors strictly below the origin.
    // FIFO BFS has finalized all such distances once this frontier is reached;
    // undiscovered cells cannot win either the gradient or its coordinate tie.
    // Without an origin, callers still receive the complete distance map.
    if (origin && distance[at.x]![at.y]! >= distance[origin.x]![origin.y]!) break;
    for (const [dx, dy] of TRAVEL_DIRECTIONS) {
      const p = { x: at.x + dx, y: at.y + dy };
      if (
        !g.grid.isValidPos(p.x, p.y) ||
        distance[p.x]![p.y] !== 30000 ||
        (base[p.x]?.[p.y] ?? 30000) === 30000 ||
        blocked.has(key(p)) ||
        !allowed(p) ||
        playerTravelDiagonalBlocked(g.grid, at, p, false)
      )
        continue;
      distance[p.x]![p.y] = distance[at.x]![at.y]! + 1;
      queue.push(p);
    }
  }
  return distance;
}
