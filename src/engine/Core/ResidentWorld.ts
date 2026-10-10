/** Trusted resident ownership and synchronous transaction; content never imports this module. */
import type { Game } from './Game';
import { Monster } from '../../entities/Monster';
import type { ResidentComponent, ResidentSource } from '../../ext/residentSdk';
import type { CampRecord } from '../../ext/structureSdk';
import { World5Error, checkedAdd } from '../../ext/worldBasics';
import { regionContains } from '../../ext/regions';
import { computeRooms } from '../Map/StructureWorld';
import { travelDistanceMap } from '../Movement/LevelTravel';
import {
  T_PATHING_BLOCKER,
  T_HARMFUL_TERRAIN,
  T_AUTO_DESCENT,
  T_LAVA_INSTA_DEATH,
  T_IS_DEEP_WATER,
  T_IS_DF_TRAP,
  T_SPONTANEOUSLY_IGNITES
} from '../Map/TerrainCatalog';
import { cellTerrainFlags } from '../Map/DungeonFeature';
import { isIncapacitated } from '../Status/Incapacitation';
import { isDeparting } from './ActorDeparture';
import { containerItems, containerRead } from './WorldWorkWorld';
import { ItemCategory } from '../Items/Item';
import type { Grid } from '../Map/Grid';
import { spatialTerrainRevision } from '../Movement/SpatialRevision';
type BedPath = { grid: Grid; revision: number; map: number[][] };
const bedPaths = new WeakMap<Game, Map<string, BedPath>>();
export function checkpointResidentBeds(g: Game): () => void {
  const cache = bedPaths.get(g), entries = cache ? [...cache] : [];
  return () => {
    if (!cache) { bedPaths.delete(g); return; }
    bedPaths.set(g, cache); cache.clear();
    for (const [key, path] of entries) cache.set(key, path);
  };
}
export const failResident = (code: World5Error['code'], field: string | null = null): never => {
  throw new World5Error(code, field);
};
export const residentActors = (g: Game) =>
  typeof g.departureActors === 'function'
    ? g.departureActors()
    : [
        ...g.monsters,
        ...g.dormantMonsters,
        ...(g as unknown as { purgatory: Monster[] }).purgatory,
        ...[...g.levels.values()].flatMap((l) => [...l.monsters, ...(l.dormantMonsters ?? [])]),
        ...[
          ...(
            g as unknown as { pendingFallenByDepth: Map<number, Monster[]> }
          ).pendingFallenByDepth.values()
        ].flat()
      ];
export function residentRecord(g: Game, id: number) {
  return g.world5?.residents.find((r) => r.actorId === id);
}
export function residentComponent(g: Game, id: number): ResidentComponent | undefined {
  const r = residentRecord(g, id);
  return r
    ? g.extensionRuntime?.residentComponent<ResidentComponent>(r.owner, id, 'resident')
    : undefined;
}
export function candidateSource(
  g: Game,
  id: number
): { owner: string; source: ResidentSource } | undefined {
  for (const owner of g.extensionRuntime?.residentOwners() ?? []) {
    const source = g.extensionRuntime!.residentComponent<ResidentSource>(owner, id, 'source');
    if (source) return { owner, source };
  }
  return undefined;
}
export function residentEligible(g: Game, a: Monster): boolean {
  return (
    (g.extensionRuntime?.residentOwners().some((o) => {
      const p = g.extensionRuntime!.residentPolicy(o)!;
      return p.templates.some((t) => t.id === a.typeId) || p.rescuedTemplates.includes(a.typeId);
    }) ??
      false) &&
    a.hp > 0 &&
    a.isAlly &&
    !a.isCaged &&
    !a.isClone &&
    !a.hasStatus('lifespan_remaining') &&
    !a.hasBehavior('MONST_INANIMATE') &&
    !a.hasBehavior('MONST_RESTRICTED_TO_LIQUID') &&
    !a.hasBehavior('MONST_WILL_NOT_USE_STAIRS') &&
    !isDeparting(g, a.id) &&
    (!a.spatial ||
      (a.spatial.footprintId === 'builtin:single' &&
        a.spatial.pose === 'r0' &&
        !a.spatial.bodyMember))
  );
}
export const residentDisabled = (a: Monster) =>
  isIncapacitated(a) ||
  a.hasStatus('entranced') ||
  a.hasStatus('confused') ||
  a.hasStatus('nauseous') ||
  a.hasStatus('magical_fear') ||
  a.hasStatus('discordant') ||
  a.hasStatus('stuck') ||
  a.seized ||
  (a.spatial?.actionLockInTicks ?? 0) > 0;
export const unsafeResidentCell = (g: Game, p: { x: number; y: number }) =>
  !!(
    cellTerrainFlags(g.grid, p.x, p.y) &
    (T_HARMFUL_TERRAIN |
      T_AUTO_DESCENT |
      T_LAVA_INSTA_DEATH |
      T_IS_DEEP_WATER |
      T_IS_DF_TRAP |
      T_SPONTANEOUSLY_IGNITES)
  );
export function residentCamp(g: Game, owner: string, campId: number): CampRecord {
  const c = g.extensionRuntime?.worldCampRecord(owner, campId);
  if (!c) failResident('C5_BAD_REFERENCE', 'camp');
  return c!;
}
export function inResidentCamp(
  g: Game,
  c: CampRecord,
  p: { x: number; y: number },
  depth = g.depth
): boolean {
  return (
    depth === c.depth &&
    !!g.extensionRuntime
      ?.worldStructureRegions()
      .some((r) => r.id === c.regionId && regionContains(r, p))
  );
}
export function residentBedIds(g: Game, c: CampRecord): number[] {
  const liveDepth =
    (g as unknown as { currentLevelDepth: number | null }).currentLevelDepth ?? g.depth;
  const grid =
    g.levels.get(c.depth)?.grid ?? (c.depth === g.depth || c.depth === liveDepth ? g.grid : null);
  if (!grid) return [];
  const marker = g.extensionRuntime!.worldWorkEntities().find((e) => e.id === c.markerId)!;
  const revision = spatialTerrainRevision(grid), key = `${c.depth}/${marker.x},${marker.y}`;
  let cache = bedPaths.get(g);
  if (!cache) { cache = new Map(); bedPaths.set(g, cache); }
  let path = cache.get(key);
  if (!path || path.grid !== grid || path.revision !== revision) {
    path = { grid, revision, map: travelDistanceMap(grid, [], marker, T_PATHING_BLOCKER) };
    if (cache.size >= 8 && !cache.has(key)) cache.delete(cache.keys().next().value!);
    cache.set(key, path);
  }
  const map = path.map;
  const ids = computeRooms(g, { kind: 'dungeon', depth: c.depth })
    .filter((r) => r.completeRoof && r.closedBoundary && r.tags.includes('bedroom'))
    .flatMap((r) => r.bedIds);
  return ids
    .filter((id) => {
      const row = g.world5!.structures.find((s) => s.fixture?.id === id);
      return (
        !!row &&
        row.fixture!.hp > 0 &&
        inResidentCamp(g, c, row.at, c.depth) &&
        [-1, 0, 1].some((dx) =>
          [-1, 0, 1].some((dy) => (dx || dy) && map[row.at.x + dx]?.[row.at.y + dy]! < 30000)
        )
      );
    })
    .sort((a, b) => a - b);
}
export function residentRations(g: Game, c: CampRecord) {
  return c.granaryIds
    .slice()
    .sort((a, b) => a - b)
    .flatMap((id) =>
      g.world5!.containers.some((x) => x.id === id)
        ? containerItems(g, id)
            .filter(
              (i) =>
                i.category === ItemCategory.FOOD &&
                ['ration_of_food', 'mango'].includes(i.consumableId ?? i.identityId ?? '')
            )
            .map((i) => ({
              containerId: id,
              itemId: i.id,
              quantity: i.quantity,
              lockedQuantity: c.locked.find((l) => l.itemId === i.id)?.quantity ?? 0
            }))
        : []
    );
}
export function campBox(g: Game, c: CampRecord, id: number) {
  const box = g.world5?.containers.find(
    (x) =>
      x.id === id &&
      x.kind === 'chest' &&
      x.owner ===
        g.extensionRuntime!.worldStructureRegions().find((r) => r.id === c.regionId)?.owner
  );
  const at = box ? containerRead(g, id).at : null;
  if (
    !box ||
    !at ||
    !inResidentCamp(g, c, at, c.depth) ||
    box.levelRef.kind !== 'dungeon' ||
    box.levelRef.depth !== c.depth
  )
    failResident('C5_BAD_REFERENCE', 'box');
  return box!;
}
const transactions = new WeakSet<Game>();
const nativeTransactions = new WeakSet<Game>();
/** Only a trusted synchronous native caller expands the economic write set. */
export const residentTransactionOwnsNativeWrites = (g: Game): boolean => nativeTransactions.has(g);
export function transactResidentWorld<T>(g: Game, work: () => T, nativeWrites = false): T {
  if (transactions.has(g)) return work();
  if (nativeWrites) nativeTransactions.add(g);
  try {
    const restore = g.checkpointResidentWorld();
    transactions.add(g);
    try {
      return g.extensionRuntime!.worldWorkTransaction(() => {
        const v = work();
        if (v && typeof (v as { then?: unknown }).then === 'function')
          throw new World5Error('C5_PROVIDER');
        return v;
      });
    } catch (e) {
      restore();
      throw e;
    } finally {
      transactions.delete(g);
    }
  } finally {
    if (nativeWrites) nativeTransactions.delete(g);
  }
}
export function publishResident(g: Game, owner: string, id: number, r: ResidentComponent) {
  r.revision = checkedAdd(r.revision, 1);
  g.extensionRuntime!.replaceResidentComponent(owner, id, 'resident', r);
}
