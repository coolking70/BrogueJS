/** Trusted C5-1 foundation authority. No production catalog or public command. */
import type { Game } from '../Core/Game';
import type {
  WorldActorScope,
  WorldPlanHandle,
  WorldResult,
  WorldCommit,
  LevelRef,
  Position
} from '../../ext/worldSdk';
import type {
  StructureCell,
  StructureComponent,
  StructureDefinition,
  RegionChange,
  StructureChange,
  RestPointPlacementRequest,
  RestRequest,
  RoomRead,
  CellProperties,
  RestPointDefinition
} from '../../ext/structureTypes';
export type * from '../../ext/structureTypes';
import { World5Error, checkedAdd, levelKey, requireDungeon, exact, uint } from '../../ext/world5';
import { STRUCTURE_SLOTS } from '../../ext/structureSchema';
import { validId } from '../../ext/json';
import { regionContains, regionsOverlap, type OwnedRegion } from '../../ext/regions';
import {
  worldActorAuthority,
  withWorldActorScope,
  transactWorldWork,
  cancelWorldWork
} from '../Core/WorldWork';
import {
  allocateWorldId,
  worldPack,
  result,
  workPositions,
  distance,
  threat,
  activeTicket,
  checkInteractableBudget,
  recordWorldReceipt,
  updateWorldReasons,
  itemDefinition,
  putInventory,
  putContainer,
  amountStacks,
  outputSlots,
  reservedInventorySlots,
  clearWorldCell,
  reservedContainerSlots,
  checkItemBudget
} from '../Core/WorldWorkWorld';
import { allocateEntityId } from '../../entities/Creature';
import { inventoryStamp, markStructureDigestDirty } from '../Core/RecordingDigest';
import { c5Canonical } from '../Core/WorldCanonical';
import { deepFreeze } from '../Movement/SpatialSchema';
import { playerTravelDiagonalBlocked } from '../Movement/PlayerTravel';
import { hasInteractionLine } from '../../ext/worldSpatial';
import {
  bindStructureCell,
  clearStructureBindings,
  readCellProperties,
  isStableBaseFloor,
  baseCellFlags,
  composedCellFlags,
  watchStructureTerrain,
  isOpenableStructureDoor,
  unbindStructureCell,
  hasStructureCellBinding
} from './CellProperties';
import {
  spatialTerrainRevision,
  invalidateSpatialTerrain,
  checkpointSpatialTerrain
} from '../Movement/SpatialRevision';
import { TerrainType, type Grid } from './Grid';
import {
  T_OBSTRUCTS_PASSABILITY,
  T_IS_FIRE,
  T_AUTO_DESCENT,
  T_LAVA_INSTA_DEATH,
  T_IS_DEEP_WATER,
  T_IS_DF_TRAP,
  T_CAUSES_DAMAGE,
  T_CAUSES_PARALYSIS
} from './TerrainCatalog';
import { generationReserved } from '../Generator/GenerationReservation';
import { assembleWorldItem } from '../Items/WorldItems';

type Request =
  | { family: 'region'; change: RegionChange }
  | { family: 'structure'; change: StructureChange }
  | { family: 'placement'; change: RestPointPlacementRequest }
  | { family: 'rest'; change: RestRequest };
type Plan = {
  game: Game;
  owner: string;
  actorId: number;
  request: Request;
  stamp: string;
  epoch: number;
  used: boolean;
};
const plans = new WeakMap<object, Plan>(),
  rooms = new WeakMap<Grid, readonly RoomRead[]>(),
  updating = new WeakSet<Game>(),
  transactions = new WeakSet<Game>();
const fail = (
  code: import('../../ext/worldSdk').WorldErrorCode,
  field: string | null = null
): never => {
  throw new World5Error(code, field);
};
const ref = (game: Game, level: LevelRef) => {
  if (requireDungeon(level) !== game.depth) fail('C5_WRONG_LEVEL');
};
const definitionTables = new WeakMap<
  object,
  { structures: Map<string, StructureDefinition>; rest: Map<string, RestPointDefinition> }
>();
function definitionTable(game: Game) {
  const runtime = game.extensionRuntime!;
  let table = definitionTables.get(runtime);
  if (!table) {
    const packs = runtime.worldDefinitionPacks();
    table = {
      structures: new Map(packs.flatMap((p) => p.structures ?? []).map((d) => [d.id, d])),
      rest: new Map(packs.flatMap((p) => p.restPoints ?? []).map((d) => [d.id, d]))
    };
    definitionTables.set(runtime, table);
  }
  return table;
}
export const structureDefinition = (game: Game, id: string): StructureDefinition => {
  const d = definitionTable(game).structures.get(id);
  if (!d) fail('C5_BAD_DEFINITION');
  return d!;
};
export const restPointDefinition = (game: Game, id: string): RestPointDefinition => {
  const d = definitionTable(game).rest.get(id);
  if (!d) fail('C5_BAD_DEFINITION');
  return d!;
};
function component(
  game: Game,
  id: number
): { row: StructureCell; c: StructureComponent; slot: (typeof STRUCTURE_SLOTS)[number] } {
  for (const row of game.world5!.structures)
    for (const slot of STRUCTURE_SLOTS)
      if (row[slot]?.id === id) return { row, c: row[slot]!, slot };
  return fail('C5_UNKNOWN_TARGET');
}
function levelGrid(game: Game, level: LevelRef): Grid {
  const depth = requireDungeon(level),
    grid = depth === game.depth ? game.grid : game.levels.get(depth)?.grid;
  if (!grid) fail('C5_BAD_REFERENCE');
  return grid!;
}
export function cellProperties(
  level: LevelRef,
  at: Position,
  scope: WorldActorScope
): WorldResult<CellProperties> {
  return result(() => {
    const { game } = worldActorAuthority(scope);
    exact(at, 'x,y', 'at');
    uint(at.x, 'x');
    uint(at.y, 'y');
    const grid = levelGrid(game, level),
      cell = grid.getCell(at.x, at.y);
    if (!cell) fail('C5_BLOCKED');
    return readCellProperties(cell!, spatialTerrainRevision(grid));
  });
}
const roomDirty = new WeakSet<Grid>(),
  roofTables = new WeakMap<Grid, Uint8Array>();
const published = new WeakMap<
  Grid,
  Map<number, { row: StructureCell; tokens: readonly unknown[] }>
>();
type DirtyCell = { before: readonly number[]; topology: boolean };
const terrainDirty = new WeakMap<Grid, Map<number, DirtyCell>>();
const topologyMask =
  T_OBSTRUCTS_PASSABILITY | T_AUTO_DESCENT | T_LAVA_INSTA_DEATH | T_IS_DEEP_WATER;
const stableFlags = (f: number) => !(f & topologyMask);
/** Recompute only a dirty layer, using dense numeric geometry and O(1) roofs. */
export function computeRooms(game: Game, level: LevelRef): readonly RoomRead[] {
  const grid = levelGrid(game, level),
    cached = rooms.get(grid);
  if (cached && !roomDirty.has(grid) && (published.get(grid)?.size ?? 0) > 0) return cached;
  const W = grid.width,
    H = grid.height,
    N = W * H,
    index = new Array<StructureCell | undefined>(N),
    stable = new Uint8Array(N),
    boundary = new Uint8Array(N),
    seen = new Uint8Array(N),
    roofs = new Uint8Array(N),
    out: RoomRead[] = [];
  // Structure roots are validated at publication/load. Validate the requested
  // level once; do not repeat strict schema validation per row on a hot read.
  const depth = requireDungeon(level),
    rows = game.world5?.structures.filter(
      (s) => s.levelRef.kind === 'dungeon' && s.levelRef.depth === depth
    ) ?? [];
  for (const row of rows) index[row.at.y * W + row.at.x] = row;
  for (let n = 0; n < N; n++) {
    const c = grid.getCell(n % W, Math.floor(n / W))!,
      f = baseCellFlags(c),
      r = index[n];
    stable[n] = +stableFlags(f);
    boundary[n] = +!!(
      f & T_OBSTRUCTS_PASSABILITY ||
      r?.barrier ||
      (r?.fixture && structureDefinition(game, r.fixture.definitionId).blocks.movement)
    );
  }
  const entities = new Map(
    game.extensionRuntime
      ?.worldWorkEntities()
      .filter((e) => e.depth === requireDungeon(level))
      .map((e) => [e.id, e]) ?? []
  );
  const dirs = [-W, -1, 1, W];
  for (let start = 0; start < N; start++) {
    if (seen[start] || boundary[start] || !stable[start]) continue;
    const cells = [start],
      edge = new Set<number>();
    seen[start] = 1;
    let closed = true;
    for (let head = 0; head < cells.length; head++) {
      const n = cells[head]!,
        x = n % W,
        y = Math.floor(n / W);
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
        closed = false;
        continue;
      }
      for (const delta of dirs) {
        const q = n + delta;
        if (boundary[q]) {
          edge.add(q);
          continue;
        }
        if (!stable[q]) {
          closed = false;
          continue;
        }
        if (!seen[q]) {
          seen[q] = 1;
          cells.push(q);
        }
      }
    }
    if (!closed || cells.length < 2 || cells.length > 128) continue;
    cells.sort((a, b) => a - b);
    const inside = new Set(cells),
      completeRoof = cells.every((n) => !!index[n]?.roof),
      ventilated = [...edge].some((n) => {
        const c = index[n]?.barrier;
        if (!c || c.hp <= 0) return false;
        const d = structureDefinition(game, c.definitionId);
        return (
          (d.barrierKind === 'window' || (d.barrierKind === 'door' && c.doorOpen)) &&
          dirs.some((delta) => {
            const q = n + delta;
            return (
              q >= 0 &&
              q < N &&
              !inside.has(q) &&
              !boundary[q] &&
              !!stable[q] &&
              Math.abs((q % W) - (n % W)) <= 1
            );
          })
        );
      });
    const bedIds: number[] = [],
      furnaces = new Set<number>();
    for (const n of cells) {
      const c = index[n]?.fixture;
      if (!c) continue;
      const d = structureDefinition(game, c.definitionId);
      if (d.tags.includes('bed')) bedIds.push(c.id);
      if (d.tags.includes('furnace')) furnaces.add(c.id);
    }
    const containerIds =
      game.world5?.containers
        .filter(
          (c) =>
            c.kind === 'chest' &&
            requireDungeon(c.levelRef) === requireDungeon(level) &&
            c.position?.kind === 'interactable' &&
            (() => {
              const e = entities.get((c.position as { interactableId: number }).interactableId);
              return !!e && inside.has(e.y * W + e.x);
            })()
        )
        .map((c) => c.id) ?? [];
    const stationIds =
      game.world5?.stations
        .filter(
          (s) =>
            requireDungeon(s.levelRef) === requireDungeon(level) &&
            (() => {
              const e = entities.get(s.interactableId);
              return (
                !!e &&
                inside.has(e.y * W + e.x) &&
                workPositions(game, e).some((p) => inside.has(p.y * W + p.x)) &&
                (!furnaces.has(s.boundComponentId!) || ventilated)
              );
            })()
        )
        .map((s) => s.interactableId) ?? [];
    if (completeRoof) for (const n of cells) roofs[n] = 1;
    out.push({
      sessionRoomId: `${levelKey(level)}.${Math.floor(cells[0]! / W)}.${cells[0]! % W}`,
      levelRef: { ...level },
      structureRevision: spatialTerrainRevision(grid),
      cells: cells.map((n) => ({ x: n % W, y: Math.floor(n / W) })),
      closedBoundary: true,
      completeRoof,
      ventilated,
      bedIds,
      containerIds,
      stationIds,
      tags: completeRoof
        ? [
            ...(bedIds.length ? ['bedroom' as const] : []),
            ...(containerIds.length ? ['warehouse' as const] : []),
            ...(stationIds.length ? ['workshop' as const] : [])
          ]
        : []
    });
  }
  const value = deepFreeze(out);
  rooms.set(grid, value);
  roofTables.set(grid, roofs);
  roomDirty.delete(grid);
  return value;
}
export function identifyRooms(
  level: LevelRef,
  scope: WorldActorScope
): WorldResult<readonly RoomRead[]> {
  return result(() => computeRooms(worldActorAuthority(scope).game, level));
}
const gameGrids = new WeakMap<Game, Set<Grid>>();
export function bindWorldStructures(game: Game, onlyDepth?: number): void {
  if (onlyDepth === undefined) {
    const live = new Set([game.grid, ...[...game.levels.values()].map((l) => l.grid)]);
    for (const old of gameGrids.get(game) ?? [])
      if (!live.has(old)) {
        clearStructureBindings(old);
        published.delete(old);
        rooms.delete(old);
        roofTables.delete(old);
        terrainDirty.delete(old);
      }
    gameGrids.set(game, live);
  }

  updating.add(game);
  try {
    for (const [depth, grid] of [
      [game.depth, game.grid] as const,
      ...[...game.levels].map(([d, l]) => [d, l.grid] as const)
    ]) {
      if (!grid || (onlyDepth !== undefined && onlyDepth !== depth)) continue;
      const rows =
          game.world5?.structures.filter(
            (s) => s.levelRef.kind === 'dungeon' && s.levelRef.depth === depth
          ) ?? [],
        prior = published.get(grid) ?? new Map(),
        next = new Map<number, { row: StructureCell; tokens: readonly unknown[] }>();
      let changed = false;
      for (const row of rows) {
        const n = row.at.y * grid.width + row.at.x,
          tokens = [
            row,
            ...STRUCTURE_SLOTS.flatMap((slot) => {
              const c = row[slot];
              return [c?.id, c?.revision, c?.hp, c?.doorOpen];
            })
          ];
        next.set(n, { row, tokens });
        const old = prior.get(n);
        if (
          old &&
          hasStructureCellBinding(grid.getCell(row.at.x, row.at.y)!, row) &&
          tokens.length === old.tokens.length &&
          tokens.every((v, i) => v === old.tokens[i])
        )
          continue;
        changed = true;
        bindStructureCell(grid, grid.getCell(row.at.x, row.at.y)!, {
          row,
          definition: (id) => structureDefinition(game, id),
          revision: () => spatialTerrainRevision(grid),
          roof: () => {
            computeRooms(game, { kind: 'dungeon', depth });
            return !!roofTables.get(grid)?.[n];
          }
        });
      }
      for (const n of prior.keys())
        if (!next.has(n)) {
          changed = true;
          unbindStructureCell(grid, grid.getCell(n % grid.width, Math.floor(n / grid.width))!);
        }
      published.set(grid, next);
      if (changed) {
        roomDirty.add(grid);
        if (game.world5) markStructureDigestDirty(game.world5, depth);
      }
      if (!rows.length) {
        clearStructureBindings(grid);
        rooms.delete(grid);
        roofTables.delete(grid);
        terrainDirty.delete(grid);
        continue;
      }
      watchStructureTerrain(grid, (cell, before) => {
        if (updating.has(game)) return;
        const n = cell.y * grid.width + cell.x,
          now = baseCellFlags(cell),
          topology = !!((baseCellFlags({ layers: before } as any) ^ now) & topologyMask);
        if (!topology && !(!stableFlags(now) && published.get(grid)?.has(n))) return;
        if (topology) roomDirty.add(grid);
        let dirty = terrainDirty.get(grid);
        if (!dirty) {
          dirty = new Map();
          terrainDirty.set(grid, dirty);
        }
        const old = dirty.get(n);
        dirty.set(n, { before: old?.before ?? before, topology: topology || !!old?.topology });
      });
    }
  } finally {
    updating.delete(game);
  }
}
export function invalidateStructureWorld(game: Game, depth = game.depth): void {
  const grid = levelGrid(game, { kind: 'dungeon', depth });
  invalidateSpatialTerrain(grid);
  roomDirty.add(grid);
  bindWorldStructures(game, depth);
  if (depth === game.depth) game.refreshStructureDerivedState();
}
/** One settlement after the native loop. Failed economic/derived publication
 * rolls back that settlement, retains elapsed time, and emits an owner receipt.
 * Failed R9 cells retain their previous stable native foundation for retry. */
export function settleStructureFoundations(game: Game, burn = false, depth = game.depth): void {
  const grid = levelGrid(game, { kind: 'dungeon', depth }),
    dirty = terrainDirty.get(grid);
  if (!game.world5?.structures.length && !dirty?.size) return;
  const changed = [...(dirty ?? [])];
  dirty?.clear();
  const rows = game.world5?.structures.filter(
    (s) => s.levelRef.kind === 'dungeon' && s.levelRef.depth === depth
  ) ?? [];
  const failed = rows.filter((r) => !stableFlags(baseCellFlags(grid.getCell(r.at.x, r.at.y)!))),
    fires = burn
      ? rows.filter((r) => !!(baseCellFlags(grid.getCell(r.at.x, r.at.y)!) & T_IS_FIRE))
      : [];
  if (!changed.length && !failed.length && !fires.length) return;
  try {
    if (!changed.length && !failed.length && fires.length) {
      const updates = fires.flatMap((row) =>
        STRUCTURE_SLOTS.flatMap((slot) => {
          const c = row[slot];
          if (!c) return [];
          const d = structureDefinition(game, c.definitionId);
          if (!d.flammable) return [];
          const loss = Math.max(1, Math.floor((d.maxHp * (100 - d.resistances.fire)) / 1000));
          return [
            {
              c,
              hp: c.hp,
              revision: c.revision,
              nextHp: c.hp - loss,
              nextRevision: checkedAdd(c.revision, 1)
            }
          ];
        })
      );
      if (updates.every((u) => u.nextHp > 0)) {
        try {
          for (const u of updates) {
            u.c.hp = u.nextHp;
            u.c.revision = u.nextRevision;
          }
          if (updates.length) markStructureDigestDirty(game.world5!, depth);
        } catch (error) {
          for (const u of updates) {
            u.c.hp = u.hp;
            u.c.revision = u.revision;
          }
          throw error;
        }
        return;
      }
    }
    const work = () => {
      for (const row of failed)
        for (const slot of STRUCTURE_SLOTS)
          if (row[slot]) destroyComponent(game, row[slot]!.id, false, 'foundation-failed');
      for (const row of fires)
        for (const slot of STRUCTURE_SLOTS) {
          const c = row[slot];
          if (!c) continue;
          const d = structureDefinition(game, c.definitionId);
          if (!d.flammable) continue;
          const n = Math.max(1, Math.floor((d.maxHp * (100 - d.resistances.fire)) / 1000));
          if (n >= c.hp) destroyComponent(game, c.id, false, 'fire');
          else {
            c.hp -= n;
            c.revision = checkedAdd(c.revision, 1);
          }
        }
      if (failed.length || fires.length) updateWorldReasons(game);
      invalidateStructureWorld(game, depth);
    };
    if (failed.length || fires.length) transactStructureWorld(game, work);
    else work();
  } catch {
    updating.add(game);
    try {
      for (const row of failed) {
        const n = row.at.y * grid.width + row.at.x,
          old = changed.find(([at]) => at === n)?.[1];
        if (old) {
          const c = grid.getCell(row.at.x, row.at.y)!;
          for (let layer = 0; layer < 4; layer++)
            if (!stableFlags(baseCellFlags({ layers: [c.layers[layer]!, 0, 0, 0] } as any)))
              c.layers.splice(layer, 1, old.before[layer]!);
          c.refreshTerrainProperties();
        }
      }
    } finally {
      updating.delete(game);
    }
    bindWorldStructures(game, depth);
    roomDirty.add(grid);
    for (const owner of new Set(rows.map((r) => r.owner)))
      recordWorldReceipt(
        game,
        owner,
        'structure',
        `environment.${depth}.${game.world5!.revision}`,
        'interrupted',
        'C5_TRANSACTION'
      );
  }
  terrainDirty.get(grid)?.clear();
}
export function transactStructureWorld<T>(game: Game, work: () => T): T {
  if (transactions.has(game)) return work();
  const grids = [game.grid, ...[...game.levels.values()].map((l) => l.grid)],
    restore = game.checkpointStructureWorld(),
    terrain = checkpointSpatialTerrain(grids),
    oldRooms = grids.map(
      (grid) => [grid, rooms.get(grid), roofTables.get(grid), roomDirty.has(grid)] as const
    );
  transactions.add(game);
  try {
    return transactWorldWork(game, work);
  } catch (error) {
    restore();
    bindWorldStructures(game);
    terrain();
    for (const [grid, value, roof, dirty] of oldRooms) {
      if (value) rooms.set(grid, value);
      else rooms.delete(grid);
      if (roof) roofTables.set(grid, roof);
      else roofTables.delete(grid);
      if (dirty) roomDirty.add(grid);
      else roomDirty.delete(grid);
    }
    throw error;
  } finally {
    transactions.delete(game);
  }
}
function escapes(game: Game, at: Position, blocked: Position | null): boolean {
  const queue = [at],
    seen = new Set([`${at.x},${at.y}`]);
  for (let h = 0; h < queue.length; h++) {
    const p = queue[h]!,
      c = game.grid.getCell(p.x, p.y)!;
    if (
      c.layers.some((t) =>
        [TerrainType.STAIRS_UP, TerrainType.STAIRS_DOWN, TerrainType.DUNGEON_PORTAL].includes(t)
      )
    )
      return true;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const q = { x: p.x + dx, y: p.y + dy },
          key = `${q.x},${q.y}`,
          cell = game.grid.getCell(q.x, q.y);
        if (
          seen.has(key) ||
          !(cell && (cell.isPassable || isOpenableStructureDoor(cell))) ||
          (blocked?.x === q.x && blocked.y === q.y && !isOpenableStructureDoor(cell!)) ||
          playerTravelDiagonalBlocked(game.grid, p, q, false)
        )
          continue;
        // Hypothetical barrier participates in the same native diagonal gate.
        if (
          blocked &&
          dx &&
          dy &&
          ((blocked.x === p.x && blocked.y === q.y) || (blocked.x === q.x && blocked.y === p.y))
        )
          continue;
        seen.add(key);
        queue.push(q);
      }
  }
  return false;
}
function protectedCell(
  game: Game,
  at: Position,
  blocking: boolean,
  allowStationId?: number,
  plannedDoor = false
): void {
  const cell = game.grid.getCell(at.x, at.y);
  if (!cell || !cell.isVisible) return fail('C5_BLOCKED');
  if (
    !isStableBaseFloor(cell) ||
    generationReserved(game.grid, at.x, at.y) ||
    cell.machineNumber ||
    game.grid.isImpregnable(at.x, at.y) ||
    game.depth === 40 ||
    game.extensionRuntime!.worldWorkPlacementProtected(at, game.depth) ||
    cell.layers.some((t) =>
      [
        TerrainType.STAIRS_UP,
        TerrainType.STAIRS_DOWN,
        TerrainType.DUNGEON_PORTAL,
        TerrainType.SECRET_DOOR,
        TerrainType.LOCKED_DOOR
      ].includes(t)
    )
  )
    fail('C5_PROTECTED');
  if (
    [game.player, ...game.monsters, ...game.dormantMonsters].some(
      (a) => a.hp > 0 && game.footprintOf(a).some((p) => p.x === at.x && p.y === at.y)
    ) ||
    game.items.some((i) => i.x === at.x && i.y === at.y)
  )
    fail('C5_PROTECTED');
  const entities = game.extensionRuntime!.worldWorkEntities().filter((e) => e.depth === game.depth);
  if (entities.some((e) => e.id !== allowStationId && e.x === at.x && e.y === at.y))
    fail('C5_PROTECTED');
  if (
    entities.some((e) => {
      const positions = workPositions(game, e, e.interactionDistance);
      return positions.length === 1 && positions[0]!.x === at.x && positions[0]!.y === at.y;
    })
  )
    fail('C5_PROTECTED');
  if (blocking) {
    for (const actor of [
      game.player,
      ...[...game.monsters, ...game.dormantMonsters].filter(
        (m) => m.hp > 0 && game.world5!.residents.some((r) => r.actorId === m.id)
      )
    ])
      if (!escapes(game, actor.loc, plannedDoor ? null : at)) fail('C5_PROTECTED');
  }
}
function jobInRegion(
  game: Game,
  r: OwnedRegion,
  actorId: number,
  ticketId: number | null
): boolean {
  const actor = [game.player, ...game.monsters, ...game.dormantMonsters].find(
      (a) => a.id === actorId
    ),
    ticket = game.world5!.tickets.find((t) => t.ticketId === ticketId);
  const target = ticket && (ticket.stationId ?? ticket.nodeId),
    entity =
      target &&
      game
        .extensionRuntime!.worldWorkEntities()
        .find((e) => e.id === target && e.depth === r.depth);
  if (entity) return regionContains(r, entity);
  return !!(
    game.world5!.residents.some((v) => v.actorId === actorId && v.campSlotId === r.campSlotId) ||
    (actor && regionContains(r, actor.loc))
  );
}
function adjacent(game: Game, at: Position): void {
  if (
    distance(game.player.loc, at) !== 1 ||
    playerTravelDiagonalBlocked(game.grid, game.player.loc, at, false)
  )
    fail('C5_DISTANCE');
}
function validate(game: Game, owner: string, request: Request): string {
  worldPack(game, owner);
  const runtime = game.extensionRuntime!,
    world = game.world5!;
  if (request.family === 'region') {
    const c = request.change;
    if (!['create', 'expand', 'retire'].includes(c.kind)) fail('C5_BAD_PAYLOAD');
    exact(
      c,
      c.kind === 'create'
        ? 'kind,instanceKey,levelRef,bounds'
        : c.kind === 'expand'
          ? 'kind,regionId,revision,bounds'
          : 'kind,regionId,revision',
      'regionChange'
    );
    const all = runtime.worldStructureRegions();
    let old: OwnedRegion | undefined;
    if (c.kind !== 'create') {
      uint(c.regionId, 'regionId', 1);
      uint(c.revision, 'revision');
      old = all.find((r) => r.id === c.regionId);
      if (!old || old.owner !== owner) fail('C5_UNKNOWN_TARGET');
      if (old!.revision !== c.revision) fail('C5_STALE');
      if (old!.depth !== game.depth) fail('C5_WRONG_LEVEL');
      if (old!.campSlotId === undefined) fail('C5_PROTECTED');
    }
    if (c.kind === 'retire') {
      const r = old!;
      if (
        world.structures.some((s) => s.regionId === r.id) ||
        runtime
          .worldWorkEntities()
          .some(
            (e) =>
              e.owner === r.owner &&
              e.depth === r.depth &&
              regionContains(r, e) &&
              !world.nodes.some((n) => n.interactableId === e.id) &&
              !world.containers.some(
                (v) =>
                  v.kind === 'remains' &&
                  v.position?.kind === 'interactable' &&
                  v.position.interactableId === e.id
              )
          ) ||
        world.residents.some((v) => v.campSlotId === r.campSlotId) ||
        world.offline.some((v) => v.campSlotId === r.campSlotId) ||
        world.orders.some(
          (o) =>
            o.owner === r.owner &&
            levelKey(o.levelRef) === `dungeon.${r.depth}` &&
            jobInRegion(game, r, o.actorId, o.ticketId)
        ) ||
        world.tickets.some(
          (t) =>
            t.owner === r.owner &&
            levelKey(t.levelRef) === `dungeon.${r.depth}` &&
            jobInRegion(game, r, t.actorId, t.ticketId)
        )
      )
        fail('C5_RESERVED');
      return c5Canonical(c);
    }
    const b = c.bounds;
    exact(b, 'x,y,width,height', 'bounds');
    for (const n of Object.values(b)) uint(n, 'bounds');
    if (
      b.x < 1 ||
      b.y < 1 ||
      b.x + b.width >= game.grid.width ||
      b.y + b.height >= game.grid.height
    )
      fail('C5_BLOCKED');
    for (let y = b.y; y < b.y + b.height; y++)
      for (let x = b.x; x < b.x + b.width; x++)
        if (!game.grid.getCell(x, y)?.isVisible) fail('C5_BLOCKED');
    if (c.kind === 'create') {
      ref(game, c.levelRef);
      if (!validId(c.instanceKey)) fail('C5_BAD_PAYLOAD');
      if (b.width !== 9 || b.height !== 9) fail('C5_BLOCKED');
      if (all.length >= 128 || all.filter((r) => r.campSlotId !== undefined).length >= 8)
        fail('C5_BUDGET');
      if (all.some((r) => r.campSlotId !== undefined && r.depth === game.depth)) fail('C5_OVERLAP');
      if (all.some((r) => r.owner === owner && r.instanceKey === c.instanceKey)) fail('C5_OVERLAP');
    } else if (
      b.width > 24 ||
      b.height > 20 ||
      b.x > old!.bounds.x ||
      b.y > old!.bounds.y ||
      b.x + b.width < old!.bounds.x + old!.bounds.width ||
      b.y + b.height < old!.bounds.y + old!.bounds.height
    )
      fail('C5_BLOCKED');
    if (
      all.some(
        (r) =>
          r !== old &&
          r.depth === game.depth &&
          regionsOverlap(r, { instanceKey: 'candidate', bounds: b })
      )
    )
      fail('C5_OVERLAP');
    if (game.depth === 40) fail('C5_PROTECTED');
    if (
      world.containers.filter(
        (v) =>
          v.kind === 'chest' &&
          v.position?.kind === 'interactable' &&
          runtime
            .worldWorkEntities()
            .some(
              (e) =>
                e.id === (v.position as { interactableId: number }).interactableId &&
                e.depth === game.depth &&
                e.x >= b.x &&
                e.y >= b.y &&
                e.x < b.x + b.width &&
                e.y < b.y + b.height
            )
      ).length > 16
    )
      fail('C5_BUDGET');
    for (let y = b.y; y < b.y + b.height; y++)
      for (let x = b.x; x < b.x + b.width; x++) {
        const cell = game.grid.getCell(x, y)!;
        if (
          cell.machineNumber ||
          game.grid.isImpregnable(x, y) ||
          generationReserved(game.grid, x, y) ||
          cell.layers.some((t) =>
            [TerrainType.STAIRS_UP, TerrainType.STAIRS_DOWN, TerrainType.DUNGEON_PORTAL].includes(t)
          )
        )
          fail(cell.isVisible ? 'C5_PROTECTED' : 'C5_BLOCKED');
      }
    if (
      runtime
        .worldWorkEntities()
        .filter((e) => e.depth === game.depth)
        .some((e) => {
          const positions = [e, ...workPositions(game, e, e.interactionDistance)];
          const inside = positions.filter(
            (p) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height
          ).length;
          return inside > 0 && inside !== positions.length;
        })
    )
      fail('C5_PROTECTED');
    if (
      [game.player, ...game.monsters, ...game.dormantMonsters].some((a) => {
        const f = game.footprintOf(a),
          inside = f.filter(
            (p) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height
          ).length;
        return inside > 0 && inside !== f.length;
      })
    )
      fail('C5_PROTECTED');
    if (!escapes(game, game.player.loc, null)) fail('C5_PROTECTED');
    return c5Canonical([c, old?.revision ?? null]);
  }
  if (request.family === 'placement') {
    const c = request.change;
    exact(c, 'definitionId,levelRef,at', 'placement');
    exact(c.at, 'x,y', 'at');
    uint(c.at.x, 'x');
    uint(c.at.y, 'y');
    ref(game, c.levelRef);
    const d = restPointDefinition(game, c.definitionId);
    if (d.owner !== owner) fail('C5_BAD_OWNERSHIP');
    if (world.restPoints.length >= 64) fail('C5_BUDGET');
    checkInteractableBudget(game);
    protectedCell(game, c.at, false);
    adjacent(game, c.at);
    return c5Canonical(c);
  }
  if (request.family === 'rest') {
    const c = request.change;
    exact(c, 'restPointId,revision', 'rest');
    uint(c.restPointId, 'restPointId', 1);
    uint(c.revision, 'revision');
    const r = world.restPoints.find((r) => r.interactableId === c.restPointId);
    if (!r || r.owner !== owner) fail('C5_UNKNOWN_TARGET');
    if (r!.revision !== c.revision) fail('C5_STALE');
    ref(game, r!.levelRef);
    const d = restPointDefinition(game, r!.definitionId),
      e = runtime.worldWorkEntities().find((e) => e.id === r!.interactableId)!;
    if (game.player.hp <= 0 || game.isGameOver) fail('C5_DEAD');
    if (
      activeTicket(game) ||
      game.actorActions?.bundles.some((b) => b.decisionOwnerId === game.player.id) ||
      game.hasFoundationRestPoint()
    )
      fail('C5_BUSY');
    if (
      distance(game.player.loc, e) > d.interactionDistance ||
      !hasInteractionLine(game.grid, game.player.loc, e)
    )
      fail('C5_DISTANCE');
    if (threat(game)) fail('C5_THREAT');
    return c5Canonical([c, r!.lastUseOrdinal]);
  }
  const c = request.change;
  if (!['build', 'door', 'dismantle', 'damage'].includes(c.kind)) fail('C5_BAD_PAYLOAD');
  exact(
    c,
    c.kind === 'build'
      ? 'kind,regionId,levelRef,at,definitionId'
      : c.kind === 'door'
        ? 'kind,componentId,revision,open'
        : c.kind === 'damage'
          ? 'kind,componentId,revision,amount,damageKind'
          : 'kind,componentId,revision',
    'structureChange'
  );
  if (c.kind === 'build') {
    exact(c.at, 'x,y', 'at');
    uint(c.at.x, 'x');
    uint(c.at.y, 'y');
    uint(c.regionId, 'regionId', 1);
    ref(game, c.levelRef);
    const r = runtime.worldStructureRegions().find((r) => r.id === c.regionId);
    if (
      !r ||
      r.owner !== owner ||
      r.campSlotId === undefined ||
      r.depth !== game.depth ||
      !regionContains(r, c.at)
    )
      fail('C5_BAD_REFERENCE');
    const d = structureDefinition(game, c.definitionId);
    if (d.owner !== owner) fail('C5_BAD_OWNERSHIP');
    const row = world.structures.find(
      (s) => levelKey(s.levelRef) === levelKey(c.levelRef) && s.at.x === c.at.x && s.at.y === c.at.y
    );
    if (row?.[d.slot]) fail('C5_OVERLAP');
    if (
      (!row &&
        (world.structures.length >= 3072 ||
          world.structures.filter((s) => s.regionId === c.regionId).length >= 384)) ||
      world.structures.reduce((n, s) => n + STRUCTURE_SLOTS.filter((k) => s[k]).length, 0) >= 12288
    )
      fail('C5_BUDGET');
    const station = d.stationDefinitionId
      ? world.stations.find(
          (s) =>
            s.definitionId === d.stationDefinitionId &&
            s.boundComponentId === null &&
            runtime
              .worldWorkEntities()
              .some(
                (e) =>
                  e.id === s.interactableId &&
                  e.depth === game.depth &&
                  e.x === c.at.x &&
                  e.y === c.at.y
              )
        )
      : undefined;
    protectedCell(game, c.at, d.blocks.movement, station?.interactableId, d.barrierKind === 'door');
    adjacent(game, c.at);
    if (d.stationDefinitionId && !station && world.stations.length >= 128) fail('C5_BUDGET');
    if (d.stationDefinitionId && !workPositions(game, c.at).length) fail('C5_BLOCKED');
    if (d.restPointDefinitionId && world.restPoints.length >= 64) fail('C5_BUDGET');
    const extraEntities =
      Number(d.containerCapacity !== null) +
      Number(!!d.stationDefinitionId && !station) +
      Number(!!d.restPointDefinitionId) +
      Number(
        d.containerCapacity !== null &&
          !world.containers.some(
            (v) => v.kind === 'remains' && levelKey(v.levelRef) === levelKey(c.levelRef)
          )
      );
    if (extraEntities) checkInteractableBudget(game, extraEntities);
    if (d.containerCapacity !== null) {
      if (
        world.containers.filter((v) => v.kind === 'chest').length >= 112 ||
        world.containers.filter(
          (v) =>
            v.kind === 'chest' &&
            v.position?.kind === 'interactable' &&
            runtime
              .worldWorkEntities()
              .some(
                (e) =>
                  e.id === (v.position as { interactableId: number }).interactableId &&
                  e.depth === r!.depth &&
                  regionContains(r!, e)
              )
        ).length >= 16
      )
        fail('C5_BUDGET');
      if (
        !world.containers.some(
          (v) => v.kind === 'remains' && levelKey(v.levelRef) === levelKey(c.levelRef)
        ) &&
        (world.containers.filter((v) => v.kind === 'remains').length >= 16 ||
          !remainsPosition(game, c.at))
      )
        fail('C5_BUDGET');
    }
    for (const a of d.constructionCost)
      if (
        game.player.inventory.items
          .filter((i) => i.worldItem?.definitionId === a.itemDefinitionId)
          .reduce((n, i) => n + i.quantity, 0) < a.count
      )
        fail('C5_INPUT');
    return c5Canonical([
      c,
      r!.revision,
      inventoryStamp(game.player.inventory.items),
      station?.revision ?? null
    ]);
  }
  uint(c.componentId, 'componentId', 1);
  uint(c.revision, 'revision');
  const v = component(game, c.componentId);
  if (v.row.owner !== owner) fail('C5_BAD_OWNERSHIP');
  ref(game, v.row.levelRef);
  if (v.c.revision !== c.revision) fail('C5_STALE');
  if (c.kind === 'door') {
    if (typeof c.open !== 'boolean' || v.c.doorOpen === null) fail('C5_BAD_PAYLOAD');
    if (!c.open) protectedCell(game, v.row.at, true);
    if (distance(game.player.loc, v.row.at) > 1) fail('C5_DISTANCE');
  }
  if (c.kind === 'dismantle') {
    if (!game.grid.getCell(v.row.at.x, v.row.at.y)?.isVisible) fail('C5_BLOCKED');
    if (distance(game.player.loc, v.row.at) > 1) fail('C5_DISTANCE');
  }
  if (c.kind === 'damage') {
    uint(c.amount, 'amount', 1);
    if (!['physical', 'fire'].includes(c.damageKind)) fail('C5_BAD_PAYLOAD');
  }
  return c5Canonical([c, v.c.hp]);
}
function plan(
  request: Request,
  scope: WorldActorScope
): WorldResult<{ handle: WorldPlanHandle; stamp: string; request: Request }> {
  return result(() => {
    const a = worldActorAuthority(scope);
    if (a.actorId !== a.game.player.id) fail('C5_SCOPE');
    const stamp = validate(a.game, a.owner, request);
    const change = request.change as any,
      casKeys: import('../../ext/worldSdk').CasKey[] = [];
    if ('revision' in change) {
      if (request.family === 'region')
        casKeys.push({ kind: 'region', regionId: change.regionId, revision: change.revision });
      else if (request.family === 'rest')
        casKeys.push({
          kind: 'rest-point',
          interactableId: change.restPointId,
          revision: change.revision
        });
      else
        casKeys.push({
          kind: 'component',
          componentId: change.componentId,
          revision: change.revision
        });
    }
    if (request.family === 'structure' && request.change.kind === 'build') {
      const c = request.change,
        runtime = a.game.extensionRuntime!,
        d = structureDefinition(a.game, c.definitionId);
      const r = runtime.worldStructureRegions().find((r) => r.id === c.regionId)!;
      casKeys.push(
        { kind: 'region', regionId: r.id, revision: r.revision },
        {
          kind: 'inventory',
          actorId: a.actorId,
          stamp: inventoryStamp(a.game.player.inventory.items)
        }
      );
      const station = a.game.world5!.stations.find(
        (s) =>
          s.definitionId === d.stationDefinitionId &&
          s.boundComponentId === null &&
          runtime
            .worldWorkEntities()
            .some(
              (e) =>
                e.id === s.interactableId &&
                e.depth === a.game.depth &&
                e.x === c.at.x &&
                e.y === c.at.y
            )
      );
      if (station)
        casKeys.push({
          kind: 'station',
          interactableId: station.interactableId,
          revision: station.revision
        });
    }
    const handle = deepFreeze({
      contract: 'C5-1',
      sessionId: `structure.${a.game.worldWorkCommandEpoch}`,
      owner: a.owner,
      actorId: a.actorId,
      operation: request.family,
      casKeys
    }) as unknown as WorldPlanHandle;
    // result() clones DTOs, so its returned handle is registered below.
    return { handle, stamp, request };
  });
}
function prepare(request: Request, scope: WorldActorScope): WorldResult<WorldPlanHandle> {
  const r = plan(request, scope);
  if (!r.ok) return r;
  const a = worldActorAuthority(scope),
    handle = r.value.handle;
  plans.set(handle, {
    game: a.game,
    owner: a.owner,
    actorId: a.actorId,
    request: structuredClone(request),
    stamp: r.value.stamp,
    epoch: a.game.worldWorkCommandEpoch,
    used: false
  });
  return { ok: true, value: handle };
}
export const planRegionChange = (change: RegionChange, scope: WorldActorScope) =>
  prepare({ family: 'region', change }, scope);
export const planStructureChange = (change: StructureChange, scope: WorldActorScope) =>
  prepare({ family: 'structure', change }, scope);
export const planRestPointPlacement = (change: RestPointPlacementRequest, scope: WorldActorScope) =>
  prepare({ family: 'placement', change }, scope);
export const planRest = (change: RestRequest, scope: WorldActorScope) =>
  prepare({ family: 'rest', change }, scope);
function placeRestPoint(
  game: Game,
  d: RestPointDefinition,
  at: Position,
  bound: number | null
): number {
  const e = game.extensionRuntime!.worldWorkPlace({
    owner: d.owner,
    depth: game.depth,
    ...at,
    instanceKey: `rest.${game.world5!.nextWorldId}.${game.world5!.revision}`,
    contentId: d.id,
    nameKey: d.nameKey,
    descriptionKey: d.descriptionKey,
    glyph: d.glyph,
    color: d.color,
    interactionDistance: d.interactionDistance,
    priority: 0
  });
  game.world5!.restPoints.push({
    interactableId: e.id,
    owner: d.owner,
    definitionId: d.id,
    levelRef: { kind: 'dungeon', depth: game.depth },
    boundComponentId: bound,
    revision: 0,
    lastUseOrdinal: 0
  });
  return e.id;
}
function remainsPosition(
  game: Game,
  origin: Position,
  ignoreEntityId?: number
): Position | undefined {
  const grid = game.grid,
    W = grid.width,
    seen = new Uint8Array(W * grid.height),
    queue = [origin.y * W + origin.x],
    candidates: Position[] = [],
    regions = game
      .extensionRuntime!.worldStructureRegions()
      .filter((r) => r.depth === game.depth && r.campSlotId !== undefined);
  seen[queue[0]!] = 1;
  const stairs: Position[] = [];
  for (let y = 1; y < grid.height - 1; y++)
    for (let x = 1; x < W - 1; x++)
      if (grid.getCell(x, y)!.layers.includes(TerrainType.STAIRS_UP)) stairs.push({ x, y });
  for (let h = 0; h < queue.length; h++) {
    const n = queue[h]!,
      p = { x: n % W, y: Math.floor(n / W) },
      cell = grid.getCell(p.x, p.y)!;
    if (
      (cell.hasMemory || cell.isVisible || cell.isExplored) &&
      !regions.some((r) => regionContains(r, p)) &&
      clearWorldCell(game, p, ignoreEntityId)
    )
      candidates.push(p);
    for (const [dx, dy] of [
      [0, -1],
      [-1, 0],
      [1, 0],
      [0, 1]
    ]) {
      const x = p.x + dx!,
        y = p.y + dy!,
        q = y * W + x,
        c = grid.getCell(x, y);
      if (
        x < 1 ||
        y < 1 ||
        x >= W - 1 ||
        y >= grid.height - 1 ||
        seen[q] ||
        !c ||
        !(c.isPassable || isOpenableStructureDoor(c)) ||
        !stableFlags(baseCellFlags(c))
      )
        continue;
      seen[q] = 1;
      queue.push(q);
    }
  }
  const up = (p: Position) =>
    stairs.length ? Math.min(...stairs.map((s) => Math.abs(s.x - p.x) + Math.abs(s.y - p.y))) : 0;
  candidates.sort(
    (a, b) => up(a) - up(b) || distance(a, origin) - distance(b, origin) || a.y - b.y || a.x - b.x
  );
  return candidates[0];
}
function ensureRemains(game: Game, d: StructureDefinition, origin: Position): void {
  const existing = game.world5!.containers.find(
    (c) => c.kind === 'remains' && levelKey(c.levelRef) === `dungeon.${game.depth}`
  );
  if (existing) {
    const e = game
      .extensionRuntime!.worldWorkEntities()
      .find((e) => e.id === (existing.position as { interactableId: number }).interactableId)!;
    const at = remainsPosition(game, origin, e.id);
    if (!at) fail('C5_BLOCKED');
    if (e.x !== at!.x || e.y !== at!.y) {
      game.extensionRuntime!.worldStructureRelocateInteractable(e.id, at!);
      existing.revision = checkedAdd(existing.revision, 1);
    }
    return;
  }
  const at = remainsPosition(game, origin);
  if (!at) fail('C5_BLOCKED');
  const id = allocateWorldId(game),
    e = game.extensionRuntime!.worldWorkPlace({
      owner: d.owner,
      depth: game.depth,
      ...at!,
      instanceKey: `remains.${id}`,
      contentId: d.id,
      nameKey: d.nameKey,
      descriptionKey: d.descriptionKey,
      glyph: '▣',
      color: '#bbbbbb',
      interactionDistance: 1,
      priority: 0
    });
  game.world5!.containers.push({
    id,
    owner: d.owner,
    kind: 'remains',
    levelRef: { kind: 'dungeon', depth: game.depth },
    position: { kind: 'interactable', interactableId: e.id },
    capacity: 1024,
    itemIds: [],
    revision: 0,
    ticketId: null
  });
}
function build(game: Game, owner: string, c: Extract<StructureChange, { kind: 'build' }>): void {
  const w = game.world5!,
    d = structureDefinition(game, c.definitionId);
  for (const a of d.constructionCost) {
    let remaining = a.count;
    for (const i of [...game.player.inventory.items])
      if (i.worldItem?.definitionId === a.itemDefinitionId) {
        const n = Math.min(remaining, i.quantity);
        remaining -= n;
        i.quantity -= n;
        if (!i.quantity) game.player.inventory.removeItem(i);
        if (!remaining) break;
      }
  }
  let row = w.structures.find(
    (s) => levelKey(s.levelRef) === levelKey(c.levelRef) && s.at.x === c.at.x && s.at.y === c.at.y
  );
  if (!row) {
    row = {
      owner,
      regionId: c.regionId,
      levelRef: { ...c.levelRef },
      at: { ...c.at },
      floor: null,
      barrier: null,
      roof: null,
      fixture: null
    };
    w.structures.push(row);
    w.structures.sort(
      (a, b) =>
        requireDungeon(a.levelRef) - requireDungeon(b.levelRef) ||
        a.at.y - b.at.y ||
        a.at.x - b.at.x
    );
  }
  if (d.containerCapacity !== null) ensureRemains(game, d, c.at);
  const id = allocateWorldId(game);
  row[d.slot] = {
    id,
    definitionId: d.id,
    hp: d.maxHp,
    doorOpen: d.barrierKind === 'door' ? false : null,
    revision: 0
  };
  if (d.restPointDefinitionId)
    placeRestPoint(game, restPointDefinition(game, d.restPointDefinitionId), c.at, id);
  if (d.stationDefinitionId) {
    const station = w.stations.find(
      (s) =>
        s.definitionId === d.stationDefinitionId &&
        s.boundComponentId === null &&
        game
          .extensionRuntime!.worldWorkEntities()
          .some(
            (e) =>
              e.id === s.interactableId &&
              e.depth === game.depth &&
              e.x === c.at.x &&
              e.y === c.at.y
          )
    );
    if (station) {
      station.boundComponentId = id;
      station.revision = checkedAdd(station.revision, 1);
    } else {
      const sd = worldPack(game, owner).stations.find((s) => s.id === d.stationDefinitionId)!;
      const e = game.extensionRuntime!.worldWorkPlace({
        owner,
        depth: game.depth,
        ...c.at,
        instanceKey: `structure.station.${id}`,
        contentId: sd.id,
        nameKey: sd.nameKey,
        descriptionKey: sd.descriptionKey,
        glyph: sd.glyph,
        color: sd.color,
        interactionDistance: sd.interactionDistance,
        priority: 0
      });
      w.stations.push({
        interactableId: e.id,
        owner,
        definitionId: sd.id,
        levelRef: { ...c.levelRef },
        boundComponentId: id,
        revision: 0
      });
    }
  }
  if (d.containerCapacity !== null) {
    const e = game.extensionRuntime!.worldWorkPlace({
      owner,
      depth: game.depth,
      ...c.at,
      instanceKey: `structure.chest.${id}`,
      contentId: d.id,
      nameKey: d.nameKey,
      descriptionKey: d.descriptionKey,
      glyph: '□',
      color: '#bbbbbb',
      interactionDistance: 1,
      priority: 0
    });
    w.containers.push({
      id: allocateWorldId(game),
      owner,
      kind: 'chest',
      levelRef: { ...c.levelRef },
      position: { kind: 'interactable', interactableId: e.id },
      capacity: d.containerCapacity,
      itemIds: [],
      revision: 0,
      ticketId: null
    });
  }
}
export function destroyComponent(game: Game, id: number, refund: boolean, reason: string): void {
  const { row, c, slot } = component(game, id),
    d = structureDefinition(game, c.definitionId),
    w = game.world5!,
    runtime = game.extensionRuntime!,
    depth = requireDungeon(row.levelRef),
    grid = levelGrid(game, row.levelRef),
    items = depth === game.depth ? game.items : game.levels.get(depth)!.items;
  const stations = w.stations.filter((s) => s.boundComponentId === id),
    rest = w.restPoints.filter((r) => r.boundComponentId === id),
    entities = runtime
      .worldWorkEntities()
      .filter(
        (e) =>
          e.depth === requireDungeon(row.levelRef) &&
          e.x === row.at.x &&
          e.y === row.at.y &&
          (stations.some((s) => s.interactableId === e.id) ||
            rest.some((r) => r.interactableId === e.id) ||
            e.contentId === d.id)
      ),
    ids = new Set(entities.map((e) => e.id)),
    chests = w.containers.filter(
      (v) => v.position?.kind === 'interactable' && ids.has(v.position.interactableId)
    );
  for (const t of [...w.tickets])
    if (
      stations.some((s) => s.interactableId === t.stationId) ||
      chests.some(
        (ch) =>
          ch.id === t.sourceContainerId ||
          [t.outputReservation, t.refundReservation].some(
            (r) => r?.destination.kind === 'container' && r.destination.containerId === ch.id
          )
      )
    )
      cancelWorldWork(game, t.ticketId, reason);
  if (rest.some((r) => game.foundationRestPointId() === r.interactableId))
    game.stopFoundationRestPoint(reason);
  row[slot] = null;
  if (STRUCTURE_SLOTS.every((s) => row[s] === null))
    w.structures.splice(w.structures.indexOf(row), 1);
  for (const chest of chests) {
    for (const itemId of [...chest.itemIds]) {
      const item = game.worldContainerItems!.get(itemId)!;
      const candidates: Array<Position> = [];
      for (let y = row.at.y - 1; y <= row.at.y + 1; y++)
        for (let x = row.at.x - 1; x <= row.at.x + 1; x++)
          if (
            (x !== row.at.x || y !== row.at.y) &&
            !!grid.getCell(x, y) &&
            isStableBaseFloor(grid.getCell(x, y)!) &&
            !(
              composedCellFlags(grid.getCell(x, y)!) &
              (T_IS_FIRE |
                T_IS_DF_TRAP |
                T_CAUSES_DAMAGE |
                T_CAUSES_PARALYSIS |
                T_OBSTRUCTS_PASSABILITY)
            ) &&
            !generationReserved(grid, x, y) &&
            !grid
              .getCell(x, y)!
              .layers.some((t) =>
                [
                  TerrainType.SECRET_DOOR,
                  TerrainType.LOCKED_DOOR,
                  TerrainType.STAIRS_UP,
                  TerrainType.STAIRS_DOWN
                ].includes(t)
              ) &&
            !grid.getCell(x, y)!.machineNumber &&
            !grid.isImpregnable(x, y) &&
            !items.some((i) => i.x === x && i.y === y) &&
            !runtime.worldWorkEntities().some((e) => e.depth === depth && e.x === x && e.y === y) &&
            !(
              depth === game.depth
                ? [game.player, ...game.monsters, ...game.dormantMonsters]
                : [
                    ...game.levels.get(depth)!.monsters,
                    ...(game.levels.get(depth)!.dormantMonsters ?? [])
                  ]
            ).some((a) => game.footprintOf(a).some((p) => p.x === x && p.y === y)) &&
            hasInteractionLine(grid, row.at, { x, y })
          )
            candidates.push({ x, y });
      const at = candidates[0];
      if (at) {
        item.loc = { ...at };
        items.push(item);
        game.worldContainerItems!.delete(itemId);
      } else {
        const remains = w.containers.find(
          (r) => r.kind === 'remains' && levelKey(r.levelRef) === levelKey(row.levelRef)
        );
        if (
          remains &&
          remains.itemIds.length + reservedContainerSlots(game, remains.id) < remains.capacity
        )
          putContainer(game, remains.id, item);
        else {
          // Overflow is a native floor owner, never a capacity exception.
          const e =
            remains?.position?.kind === 'interactable'
              ? runtime
                  .worldWorkEntities()
                  .find(
                    (e) => e.id === (remains!.position as { interactableId: number }).interactableId
                  )
              : undefined;
          item.loc = e ? { x: e.x, y: e.y } : { ...row.at };
          items.push(item);
          game.worldContainerItems!.delete(itemId);
        }
      }
      chest.itemIds.splice(chest.itemIds.indexOf(itemId), 1);
    }
    w.containers.splice(w.containers.indexOf(chest), 1);
  }
  w.stations = w.stations.filter((s) => !stations.includes(s));
  w.restPoints = w.restPoints.filter((r) => !rest.includes(r));
  for (const e of entities) runtime.worldStructureRemoveInteractable(e.id);
  if (refund) {
    const amounts = d.constructionCost
      .map((a) => ({ ...a, count: Math.floor((((a.count * c.hp) / d.maxHp) * 1) / 2) }))
      .filter((a) => a.count > 0);
    if (
      outputSlots(game, game.player.inventory.items, amounts) +
        game.player.inventory.packCount() +
        reservedInventorySlots(game) >
      game.player.inventory.capacity
    )
      fail('C5_CAPACITY');
    for (const fake of amountStacks(game, amounts)) {
      checkItemBudget(game, 1);
      putInventory(
        game,
        assembleWorldItem(itemDefinition(game, fake.worldItem!.definitionId), fake.quantity)
      );
    }
  }
}
export function commitStructureWorld(
  game: Game,
  handle: WorldPlanHandle,
  scope: WorldActorScope
): WorldResult<WorldCommit> {
  return result(() => {
    const a = worldActorAuthority(scope),
      p = plans.get(handle);
    if (a.game !== game || a.owner !== handle.owner || a.actorId !== handle.actorId)
      fail('C5_SCOPE');
    if (!p || p.game !== game || p.epoch !== game.worldWorkCommandEpoch) fail('C5_STALE');
    if (p!.used) fail('C5_PLAN_USED');
    p!.used = true;
    if (validate(game, p!.owner, p!.request) !== p!.stamp) fail('C5_STALE');
    return transactStructureWorld(game, () => {
      const w = game.world5!,
        r = p!.request;
      let ticks = 0;
      if (r.family === 'region') {
        const c = r.change,
          all = [...game.extensionRuntime!.worldStructureRegions()];
        if (c.kind === 'create') {
          const slot = Array.from({ length: 8 }, (_, i) => i).find(
            (i) => !all.some((r) => r.campSlotId === i)
          )!;
          w.campSlotOrdinals ??= Array(8).fill(0);
          w.campSlotOrdinals[slot] = checkedAdd(w.campSlotOrdinals[slot]!, 1);
          all.push({
            id: allocateEntityId(),
            owner: p!.owner,
            depth: game.depth,
            revision: 0,
            campSlotId: slot as any,
            instanceKey: c.instanceKey,
            bounds: { ...c.bounds }
          });
        } else {
          const index = all.findIndex((v) => v.id === c.regionId);
          if (c.kind === 'retire') all.splice(index, 1);
          else
            all[index] = {
              ...all[index]!,
              bounds: { ...c.bounds },
              revision: checkedAdd(c.revision, 1)
            };
        }
        game.extensionRuntime!.worldStructureSetRegions(all.sort((a, b) => a.id - b.id));
        if (c.kind !== 'retire')
          for (const container of w.containers) {
            if (
              container.kind !== 'remains' ||
              requireDungeon(container.levelRef) !== game.depth ||
              container.position?.kind !== 'interactable'
            )
              continue;
            const e = game
              .extensionRuntime!.worldWorkEntities()
              .find(
                (e) => e.id === (container.position as { interactableId: number }).interactableId
              )!;
            if (
              all.some(
                (r) => r.campSlotId !== undefined && r.depth === game.depth && regionContains(r, e)
              )
            ) {
              const at = remainsPosition(game, e);
              if (!at) fail('C5_BLOCKED');
              game.extensionRuntime!.worldStructureRelocateInteractable(e.id, at!);
              container.revision = checkedAdd(container.revision, 1);
            }
          }
      } else if (r.family === 'placement')
        placeRestPoint(game, restPointDefinition(game, r.change.definitionId), r.change.at, null);
      else if (r.family === 'rest') {
        const rp = w.restPoints.find((v) => v.interactableId === r.change.restPointId)!;
        rp.lastUseOrdinal = checkedAdd(rp.lastUseOrdinal, 1);
        rp.revision = checkedAdd(rp.revision, 1);
        game.beginFoundationRestPoint(
          rp.interactableId,
          rp.revision,
          rp.lastUseOrdinal,
          restPointDefinition(game, rp.definitionId).maxRestTicks / 100
        );
      } else {
        const c = r.change;
        if (c.kind === 'build') {
          build(game, p!.owner, c);
          ticks = structureDefinition(game, c.definitionId).constructionTicks;
        } else if (c.kind === 'dismantle')
          destroyComponent(game, c.componentId, true, 'dismantled');
        else if (c.kind === 'door') {
          const v = component(game, c.componentId);
          v.c.doorOpen = c.open;
          v.c.revision = checkedAdd(v.c.revision, 1);
        } else {
          const v = component(game, c.componentId),
            d = structureDefinition(game, v.c.definitionId),
            amount = Math.floor((c.amount * (100 - d.resistances[c.damageKind])) / 100);
          if (amount >= v.c.hp) destroyComponent(game, c.componentId, false, 'destroyed');
          else if (amount) {
            v.c.hp -= amount;
            v.c.revision = checkedAdd(v.c.revision, 1);
          }
        }
      }
      updateWorldReasons(game);
      const identity = `${r.family}.${w.revision}.${w.nextWorldId}`;
      if (r.family !== 'rest')
        recordWorldReceipt(
          game,
          p!.owner,
          r.family === 'region' ? 'region' : r.family === 'placement' ? 'placement' : 'structure',
          identity,
          'completed',
          null
        );
      if (r.family === 'structure') invalidateStructureWorld(game);
      return {
        operation: r.family,
        receiptIdentity: identity,
        ticketId: null,
        chargedTicks: ticks
      };
    });
  });
}
/** Foundation rule r8: one dose per native objective 100-tick block. */
export const STRUCTURE_FIRE_RULE = 'max(1,floor(maxHp*(100-fireResistance)/1000))';
export function advanceStructureFire(game: Game): void {
  settleStructureFoundations(game, true);
}
/** Native shattering/tunneling own this damage, never module/UI raw writes. */
export function excavateStructures(game: Game, positions: readonly Position[]): boolean {
  const targets =
    game.world5?.structures
      .filter(
        (r) =>
          requireDungeon(r.levelRef) === game.depth &&
          positions.some((p) => p.x === r.at.x && p.y === r.at.y)
      )
      .flatMap((r) =>
        [r.barrier, r.fixture]
          .filter((c) => !!c && structureDefinition(game, c.definitionId).blocks.movement)
          .map((c) => c!.id)
      ) ?? [];
  if (!targets.length) return false;
  transactStructureWorld(game, () => {
    for (const id of targets) destroyComponent(game, id, false, 'excavated');
    updateWorldReasons(game);
    invalidateStructureWorld(game);
  });
  return true;
}

export function isStructureFixtureCommand(game: Game, data: unknown): boolean {
  try {
    const v = typeof data === 'string' ? JSON.parse(data) : data;
    return (
      !!v &&
      game.extensionRuntime?.isWorldStructureFixture(v.module) === true &&
      ['fixture-region', 'fixture-structure', 'fixture-rest-placement', 'fixture-rest'].includes(
        v.action
      )
    );
  } catch {
    return false;
  }
}
export function executeStructureFixtureCommand(
  game: Game,
  data: unknown
): WorldResult<WorldCommit> {
  const v = typeof data === 'string' ? JSON.parse(data) : (data as any);
  exact(v, 'module,action,payload', 'fixture');
  const input = v as any;
  return withStructureFixtureScope(game, input.module, (scope) => {
    const p =
      input.action === 'fixture-region'
        ? planRegionChange(input.payload, scope)
        : input.action === 'fixture-structure'
          ? planStructureChange(input.payload, scope)
          : input.action === 'fixture-rest-placement'
            ? planRestPointPlacement(input.payload, scope)
            : planRest(input.payload, scope);
    return p.ok ? commitStructureWorld(game, p.value, scope) : p;
  });
}
function withStructureFixtureScope<T>(
  game: Game,
  owner: string,
  work: (scope: WorldActorScope) => T
): T {
  if (!game.extensionRuntime?.isWorldStructureFixture(owner) || !game.isExecutingRecordedCommand())
    fail('C5_SCOPE');
  return withWorldActorScope(game, owner, game.player.id, 'player-command', work);
}
