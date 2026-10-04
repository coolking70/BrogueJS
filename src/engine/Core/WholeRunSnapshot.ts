import { assertNativeSpatial, assertSingleCellPlayer, CreatureSpatial } from '../Movement/CreatureSpatial';
import { keys, nativeSpatialCatalog, SpatialValidationError, SPATIAL_LIMITS, validateSpatialComponent, type SpatialCatalog, type SpatialWorldSnapshot } from '../Movement/SpatialSchema';
/** Pure whole-run projection and world reconstruction. The live Game supplies
 * only the state and services consumed here; neither function receives Game. */
import { Item } from '../Items/Item';
import type { ItemLoader } from '../Items/ItemLoader';
import { Player } from '../../entities/Player';
import { Monster } from '../../entities/Monster';
import { DCOLS, DROWS } from '../Map/Grid';
import { ScentMap } from '../Map/Scent';
import { WaypointSystem } from '../Map/WaypointMap';
import { EnvironmentManager } from '../Environment/Gas';
import { FOVSys } from '../Lighting/FOV';
import { LightMap } from '../Lighting/LightMap';
import { collectMachineCells, machineCellsMatchGrid } from '../Map/MachineCells';
import { CE_DEEPEST_LEVEL } from '../Map/LakeSystem';
import { snapshotGrid, restoreGrid } from './LevelSnapshot';
import { copyFields, PLAYER_FIELDS, collectEntityGraph, restoreEntityGraph,
    serializeItem, serializeMonsterRow } from './EntitySnapshot';
import type { EntityCodecDeps } from './EntitySnapshot';
import { copyLevelSeeds, isLevelSeeds, type LevelSeed } from './LevelSeeds';
import { Random } from '../Random';
import { isSeed } from '../Seed';
import type { Game, GameRunSnapshot, LevelState, GameMode } from './Game';
import type { CellSnapshot } from './LevelSnapshot';
import type { GameSnapshotItem, GameSnapshotMonster, GameSnapshotPlayer, EntitySnapshotGraph } from './EntitySnapshot';
import type { RandomState } from '../Random';
import type { Pos } from '../../types';

export const WHOLE_RUN_SCHEMA = 'brogue-web-whole-run-v3' as const;

/** The run section is detached with the same JSON boundary as the original
 * Game method, including omission of undefined values. */
export function projectRunState<T>(state: T): T {
    return JSON.parse(JSON.stringify(state)) as T;
}

export interface LevelSnapshot {
    depth: number;
    width: number;
    height: number;
    grid: CellSnapshot[];
    impregnableCells?: number[];
    monsters: GameSnapshotMonster[];
    dormantMonsters: GameSnapshotMonster[];
    items: GameSnapshotItem[];
    scent: ReturnType<ScentMap['getState']>;
    waypoints: ReturnType<WaypointSystem['getState']>;
    environmentState: ReturnType<EnvironmentManager['getState']>;
    pendingCaughtFireCells: Pos[];
    trapDepressions: number[];
    machineCells: number[];
    visibleMonsterIds: number[];
    visibleItemIds: number[];
    /** CE absoluteTurnNumber at departure. */
    awaySince: number;
    playerExitedVia: Pos;
}

import type { ExtensionSnapshot } from '../../ext/types';

export interface GameSnapshot extends LevelSnapshot {
    extensions?: ExtensionSnapshot;
    /** U01 entity envelope version; schema discriminates whole-run saves. */
    version: number;
    schema: typeof WHOLE_RUN_SCHEMA;
    savedAt: number;
    seed: string;
    rngState: RandomState;
    levelSeeds: LevelSeed[];
    currentLevelDepth: number;
    /** Detached cached levels only. The active level is the top-level payload. */
    levels: LevelSnapshot[];
    pendingFallenItemsByDepth: Array<{ depth: number; items: GameSnapshotItem[] }>;
    pendingFallenByDepth: Array<{ depth: number; monsters: GameSnapshotMonster[] }>;
    purgatory: GameSnapshotMonster[];
    mode: GameMode;
    ticksTillUpdateEnvironment: number;
    pendingEnchantment: boolean;
    player: GameSnapshotPlayer;
    /** One graph across every floor, pending fall and ownership list. */
    entityGraph: EntitySnapshotGraph;
    identifiedItems: string[];
    wandFlavors?: Record<string, string>;
    staffFlavors?: Record<string, string>;
    flavors: ReturnType<typeof ItemLoader.snapshotFlavors>;
    callTitles: Record<string, string>;
    magicPolarityRevealed: string[];
    rewardRoomsGenerated: number;
    stats: Game['stats'];
    run: GameRunSnapshot;
}

export function snapshotLevel(depth: number, level: LevelState, trapDepressions: ReadonlySet<number> | undefined): LevelSnapshot {
    return {
        depth, width: level.grid.width, height: level.grid.height,
        grid: snapshotGrid(level.grid), impregnableCells: [...level.grid.impregnableCells],
        monsters: level.monsters.map(serializeMonsterRow),
        dormantMonsters: (level.dormantMonsters ?? []).map(serializeMonsterRow), items: level.items.map(serializeItem),
        scent: (level.scent ?? new ScentMap(level.grid.width, level.grid.height)).getState(),
        waypoints: (level.waypoints ?? new WaypointSystem()).getState(),
        environmentState: level.environment.getState(),
        pendingCaughtFireCells: (level.pendingCaughtFireCells ?? []).map(p => ({ ...p })),
        trapDepressions: [...(trapDepressions ?? [])],
        machineCells: [...collectMachineCells(level.grid)],
        visibleMonsterIds: [...level.visibleMonsters].map(m => m.id),
        visibleItemIds: [...level.visibleItems].map(i => i.id),
        awaySince: level.awaySince ?? 0,
        playerExitedVia: { ...(level.playerExitedVia ?? { x: 0, y: 0 }) },
    };
}

export interface WholeRunProjection {
    /** Deterministically initialized native fixture port. Production omits it. */
    nativeSpatial?: ReadonlyMap<number, CreatureSpatial>;
    depth: number;
    currentLevelDepth: number | null;
    active: LevelState;
    levels: ReadonlyMap<number, LevelState>;
    snapshotLevel: (depth: number, level: LevelState) => LevelSnapshot;
    pendingFallenByDepth: ReadonlyMap<number, Monster[]>;
    pendingFallenItemsByDepth: ReadonlyMap<number, Item[]>;
    purgatory: Monster[];
    monsters: Monster[];
    dormantMonsters: Monster[];
    items: Item[];
    player: Player;
    everSeenMonsters: ReadonlySet<Monster>;
    everSeenItems: ReadonlySet<Item>;
    visibleMonsters: ReadonlySet<Monster>;
    visibleItems: ReadonlySet<Item>;
    travelTargetItem: Item | null | undefined;
    isAdvancing: boolean;
    currentSeed: string;
    levelSeeds: LevelSeed[];
    mode: GameMode;
    ticksTillUpdateEnvironment: number;
    pendingEnchantment: boolean;
    stats: GameSnapshot['stats'];
    run: GameSnapshot['run'];
    services: {
        rngState: () => RandomState;
        identifiedItems: () => string[];
        callTitles: () => Record<string, string>;
        magicPolarityRevealed: () => string[];
        flavors: () => GameSnapshot['flavors'];
        staffFlavors: () => Record<string, string>;
        wandFlavors: () => Record<string, string>;
        rewardRoomsGenerated: () => number;
    };
}

export function toWholeRunSnapshot(source: WholeRunProjection): GameSnapshot {
    if (source.isAdvancing) throw new Error('Cannot save during turn advancement');
    assertSingleCellPlayer(source.player);
    const levels = [...source.levels].filter(([depth]) => depth !== source.currentLevelDepth)
        .sort(([a], [b]) => a - b);
    const levelRoots = levels.flatMap(([, l]) => [...l.monsters, ...(l.dormantMonsters ?? [])]);
    const pendingFallenByDepth = [...source.pendingFallenByDepth].sort(([a], [b]) => a - b)
        .map(([depth, monsters]) => ({ depth, monsters: monsters.map(serializeMonsterRow) }));
    const roots = [...source.monsters, ...source.dormantMonsters, ...source.purgatory, ...levelRoots, ...[...source.pendingFallenByDepth.values()].flat()];
    const pendingFallenItemsByDepth = [...source.pendingFallenItemsByDepth].sort(([a], [b]) => a - b)
        .map(([depth, items]) => ({ depth, items: items.map(serializeItem) }));
    const ownedItems = [...[...source.pendingFallenItemsByDepth.values()].flat(), ...source.items, ...source.player.inventory.items, ...levels.flatMap(([, l]) => l.items)];
    const graph = collectEntityGraph([...roots, ...source.everSeenMonsters,
        ...source.visibleMonsters, ...levels.flatMap(([, l]) => [...l.visibleMonsters])], [...ownedItems, ...source.everSeenItems,
        ...source.visibleItems, ...levels.flatMap(([, l]) => [...l.visibleItems]),
        ...[source.player.equippedWeapon, source.player.equippedArmor, source.player.ringLeft, source.player.ringRight, source.travelTargetItem]
            .filter((item): item is Item => item != null)]);
    const spatialWorld = source.nativeSpatial ? snapshotNativeSpatialWorld(source.nativeSpatial) : snapshotSquareWorld(graph.monsters);
    return {
        ...source.snapshotLevel(source.depth, source.active),
        version: 3, schema: WHOLE_RUN_SCHEMA, savedAt: Date.now(),
        seed: source.currentSeed, rngState: source.services.rngState(), levelSeeds: copyLevelSeeds(source.levelSeeds),
        currentLevelDepth: source.currentLevelDepth ?? source.depth,
        levels: levels.map(([depth, level]) => source.snapshotLevel(depth, level)), pendingFallenByDepth, pendingFallenItemsByDepth,
        purgatory: source.purgatory.map(serializeMonsterRow),
        mode: source.mode, ticksTillUpdateEnvironment: source.ticksTillUpdateEnvironment,
        pendingEnchantment: source.pendingEnchantment,
        player: {
            ...copyFields(source.player, PLAYER_FIELDS),
            statusImmunities: [...source.player.statusImmunities], hungerTransition: source.player.snapshotHungerTransition(),
            inventoryCapacity: source.player.inventory.capacity, inventory: source.player.inventory.items.map(serializeItem),
            equippedWeaponId: source.player.equippedWeapon?.id ?? null, equippedArmorId: source.player.equippedArmor?.id ?? null,
            ringLeftId: source.player.ringLeft?.id ?? null, ringRightId: source.player.ringRight?.id ?? null,
        },
        entityGraph: {
            monsters: graph.monsters.filter(m => !roots.includes(m)).map(serializeMonsterRow),
            items: graph.items.filter(item => !ownedItems.includes(item)).map(serializeItem),
        },
        identifiedItems: source.services.identifiedItems(), callTitles: source.services.callTitles(),
        magicPolarityRevealed: source.services.magicPolarityRevealed(), flavors: source.services.flavors(),
        staffFlavors: source.services.staffFlavors(),
        wandFlavors: source.services.wandFlavors(),
        rewardRoomsGenerated: source.services.rewardRoomsGenerated(), stats: { ...source.stats },
        run: spatialWorld ? { ...source.run, spatialWorld } : source.run,
    };
}

export function decodePlayer(saved: GameSnapshot['player'], items: Map<number, Item>): Player {
    assertSingleCellPlayer(saved);
    const player = new Player(saved.loc.x, saved.loc.y);
    Object.assign(player, copyFields(saved, PLAYER_FIELDS));
    player.statusImmunities = new Set(saved.statusImmunities);
    player.restoreHungerTransition(saved.hungerTransition);
    player.inventory.capacity = saved.inventoryCapacity;
    player.inventory.items = saved.inventory.map(it => items.get(it.id)!);
    const equipment = (id: number | null): Item | null => id === null ? null : items.get(id)!;
    player.equippedWeapon = equipment(saved.equippedWeaponId);
    player.equippedArmor = equipment(saved.equippedArmorId);
    player.ringLeft = equipment(saved.ringLeftId); player.ringRight = equipment(saved.ringRightId);
    return player;
}

export function decodeWholeRunWorld(snapshot: GameSnapshot, deps: EntityCodecDeps): {
    entityGraph: ReturnType<typeof restoreEntityGraph>;
    restored: Map<number, LevelState>;
    /** Explicit candidate mechanical ownership, never a hidden Game service. */
    spatialLevels?: Map<number, CreatureSpatial>;
} {
    if (Object.prototype.hasOwnProperty.call(snapshot.run, 'spatialWorld') && snapshot.run.spatialWorld === undefined) throw new SpatialValidationError('Spatial world absence must omit the property');
    const levelRows = [snapshot, ...snapshot.levels];
    const entityGraph = restoreEntityGraph(
        [...levelRows.flatMap(l => [...l.monsters, ...l.dormantMonsters]),
             ...snapshot.pendingFallenByDepth.flatMap(q => q.monsters), ...(snapshot.purgatory ?? []), ...snapshot.entityGraph.monsters],
        [...levelRows.flatMap(l => l.items), ...snapshot.pendingFallenItemsByDepth.flatMap(q => q.items), ...snapshot.player.inventory, ...snapshot.entityGraph.items],
        [], [], deps);
    const resolve = <T>(map: Map<number, T>, id: number): T => {
        const value = map.get(id);
        if (!value) throw new Error(`Missing snapshot entity ${id}`);
        return value;
    };
    const restored = new Map<number, LevelState>(levelRows.map(saved => {
        const grid = restoreGrid(saved.width, saved.height, saved.grid, saved.impregnableCells!);
        const environment = new EnvironmentManager(grid);
        environment.setState(saved.environmentState);
        const waypoints = new WaypointSystem(); waypoints.setState(saved.waypoints);
        return [saved.depth, {
            grid, environment, fov: new FOVSys(grid), lightMap: new LightMap(grid),
            monsters: saved.monsters.map(m => resolve(entityGraph.monsters, m.id)),
            dormantMonsters: saved.dormantMonsters.map(m => resolve(entityGraph.monsters, m.id)),
            items: saved.items.map(i => resolve(entityGraph.items, i.id)),
            visibleMonsters: new Set(saved.visibleMonsterIds.map(id => resolve(entityGraph.monsters, id))),
            visibleItems: new Set(saved.visibleItemIds.map(id => resolve(entityGraph.items, id))),
            machineCells: collectMachineCells(grid), scent: ScentMap.fromState(saved.scent), waypoints,
            awaySince: saved.awaySince, playerExitedVia: { ...saved.playerExitedVia }, pendingCaughtFireCells: saved.pendingCaughtFireCells.map(p => ({ ...p })),
        }];
    }));
    const result = { entityGraph, restored };
    if (snapshot.run.spatialWorld !== undefined) {
        if (!deps.spatialCatalog?.fixture) {
            const expected = snapshotSquareWorld([...entityGraph.monsters.values()]);
            if (canonicalSpatial(snapshot.run.spatialWorld) !== canonicalSpatial(expected)) throw new SpatialValidationError('Invalid square definition closure');
            const player = decodePlayer(snapshot.player, entityGraph.items);
            // Validate physical ownership and full footprints on each independent
            // layer. Pending/carry/purgatory retain component truth, with no index.
            const owned = new Set<number>();
            for (const [depth, level] of restored) {
                const cohort = [...level.monsters, ...(level.dormantMonsters ?? [])];
                for (const c of cohort) { if (owned.has(c.id)) throw new SpatialValidationError('Multiple square ownership'); owned.add(c.id); }
                if (!cohort.some(c => c.spatial)) continue;
                const service = new CreatureSpatial({ grid: level.grid, monsters: level.monsters, dormantMonsters: level.dormantMonsters,
                    ...(depth === snapshot.depth ? { player } : {}) });
                try {
                    for (const c of cohort) if (c.hp > 0 && !service.canFitAt(c, c.loc, { allowsTerrain: () => true })) throw new SpatialValidationError('Overlapping square footprints');
                } finally { service.dispose(); }
            }
            for (const queue of snapshot.pendingFallenByDepth) {
                if (!Number.isInteger(queue.depth) || queue.depth < 1 || queue.depth > CE_DEEPEST_LEVEL) throw new SpatialValidationError('Invalid pending square layer');
                const squares = queue.monsters.filter(c => c.spatial);
                if (squares.length > SPATIAL_LIMITS.entities || squares.reduce((n, c) => n + nativeSpatialCatalog.cells(c.spatial!.footprintId, 'r0').length, 0) > SPATIAL_LIMITS.occupiedCells) throw new SpatialValidationError('Pending square budget exceeded');
                for (const row of queue.monsters) {
                    if (row.spatial) {
                        const cells = nativeSpatialCatalog.cells(row.spatial.footprintId, 'r0');
                        if (cells.some(p => row.loc.x + p.x < 0 || row.loc.y + p.y < 0 || row.loc.x + p.x >= snapshot.width || row.loc.y + p.y >= snapshot.height)) throw new SpatialValidationError('Pending square anchor outside world');
                    }
                    if (owned.has(row.id)) throw new SpatialValidationError('Multiple pending square ownership'); owned.add(row.id);
                }
            }
            const claim = (c: Monster) => {
                if (!c.spatial) return;
                if (owned.has(c.id)) throw new SpatialValidationError('Multiple closed square ownership');
                owned.add(c.id);
            };
            for (const row of snapshot.purgatory) claim(entityGraph.monsters.get(row.id)!);
            for (const parent of entityGraph.monsters.values()) if (parent.carriedMonster) claim(parent.carriedMonster);
            if ([...entityGraph.monsters.values()].some(c => c.spatial && c.hp > 0 && !owned.has(c.id))) throw new SpatialValidationError('Unowned living square');
            return result;
        }
        return { ...result, spatialLevels: decodeNativeSpatialWorld(snapshot, entityGraph, restored, deps.spatialCatalog) };
    }
    if ([...entityGraph.monsters.values()].some(c => c.spatial)) throw new SpatialValidationError('Missing spatial world root');
    return result;
}

const canonicalSpatial = (v: unknown): string | undefined => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
/** Production uses only independently initialized builtin definitions. A saved
 * closure describes used geometry; it cannot grant capabilities or install data. */
function snapshotSquareWorld(monsters: readonly Monster[]): SpatialWorldSnapshot | undefined {
    const shapeIds = new Set<string>();
    for (const c of monsters) {
        assertNativeSpatial(c);
        if (c.spatial) shapeIds.add(c.spatial.footprintId);
    }
    if (!shapeIds.size) return undefined;
    return { schema: 1, definitions: nativeSpatialCatalog.definitionClosure([...shapeIds].sort(), []), groups: [] };
}

/** Merge only used native definitions. Ordinary worlds omit the root entirely. */
export function snapshotNativeSpatialWorld(levels: ReadonlyMap<number, CreatureSpatial>): SpatialWorldSnapshot | undefined {
    const snapshots = [...levels].sort(([a], [b]) => a - b).flatMap(([, service]) => {
        if (!service.catalog.fixture) throw new SpatialValidationError('Unopened native spatial fixture port');
        const snapshot = service.snapshotWorld(); return snapshot ? [snapshot] : [];
    });
    if (!snapshots.length) return undefined;
    const merge = <T extends { id: string }>(rows: readonly T[]): T[] => {
        const byId = new Map<string, T>();
        for (const row of rows) {
            const previous = byId.get(row.id);
            if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new SpatialValidationError('Conflicting native spatial definition');
            byId.set(row.id, row);
        }
        return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
    };
    const groups = snapshots.flatMap(s => s.groups).sort((a, b) => a.groupId - b.groupId);
    if (new Set(groups.map(g => g.groupId)).size !== groups.length) throw new SpatialValidationError('Shared native spatial group');
    const forms = merge(snapshots.flatMap(s => s.definitions.forms ?? []));
    const breakRules = merge(snapshots.flatMap(s => s.definitions.breakRules ?? []));
    const statusProfiles = merge(snapshots.flatMap(s => s.definitions.statusProfiles ?? []));
    return { schema: 1, definitions: { footprints: merge(snapshots.flatMap(s => s.definitions.footprints)), bodies: merge(snapshots.flatMap(s => s.definitions.bodies)),
        ...(forms.length ? { forms } : {}), ...(breakRules.length ? { breakRules } : {}), ...(statusProfiles.length ? { statusProfiles } : {}) }, groups };
}

/** Decode each physical layer separately: cached layers may occupy the same
 * coordinates, but no entity/group may be split or multiply owned. Pending,
 * carried and purgatory spatial lifecycles stay explicitly closed in 4a0. */
function decodeNativeSpatialWorld(snapshot: GameSnapshot, graph: ReturnType<typeof restoreEntityGraph>, restored: Map<number, LevelState>, catalog: SpatialCatalog): Map<number, CreatureSpatial> {
    const root = snapshot.run.spatialWorld!;
    keys(root, ['schema', 'definitions', 'groups']); keys(root.definitions, ['footprints', 'bodies', 'forms', 'breakRules', 'statusProfiles'], ['footprints', 'bodies']);
    if (!catalog.fixture || root.schema !== 1 || !Array.isArray(root.groups) || !Array.isArray(root.definitions.footprints) || !Array.isArray(root.definitions.bodies)
        || ['forms', 'breakRules', 'statusProfiles'].some(k => (root.definitions as any)[k] !== undefined && !Array.isArray((root.definitions as any)[k]))) throw new SpatialValidationError('Invalid native spatial world');
    const owner = new Set<number>(), spatialLevels = new Map<number, CreatureSpatial>();
    const player = decodePlayer(snapshot.player, graph.items);
    for (const [depth, level] of restored) {
        const cohort = [...level.monsters, ...(level.dormantMonsters ?? [])];
        for (const c of cohort) { if (owner.has(c.id)) throw new SpatialValidationError('Multiple spatial layer ownership'); owner.add(c.id); }
        const groups = root.groups.filter(g => cohort.some(c => c.id === g.coreId));
        const bodyIds = new Set(groups.map(g => g.bodyDefinitionId));
        const formIds = new Set(groups.flatMap(g => catalog.body(g.bodyDefinitionId).parts.map(p => p.formId)));
        const shapeIds = new Set([...cohort.flatMap(c => c.spatial ? [c.spatial.footprintId] : []), ...[...formIds].map(id => catalog.form(id).footprintId)]);
        if (!shapeIds.size && !groups.length) continue;
        const closure = catalog.definitionClosure([...shapeIds], [...bodyIds]);
        const service = new CreatureSpatial({ grid: level.grid, monsters: level.monsters, dormantMonsters: level.dormantMonsters,
            ...(depth === snapshot.currentLevelDepth ? { player } : {}) }, catalog);
        service.restoreWorld({ schema: 1, definitions: { footprints: root.definitions.footprints.filter(d => shapeIds.has(d.id)), bodies: root.definitions.bodies.filter(d => bodyIds.has(d.id)),
            ...(formIds.size ? { forms: (root.definitions.forms ?? []).filter(d => formIds.has(d.id)) } : {}),
            ...(closure.breakRules ? { breakRules: (root.definitions.breakRules ?? []).filter(d => closure.breakRules!.some(ref => ref.id === d.id)) } : {}),
            ...(closure.statusProfiles ? { statusProfiles: (root.definitions.statusProfiles ?? []).filter(d => closure.statusProfiles!.some(ref => ref.id === d.id)) } : {}) }, groups });
        spatialLevels.set(depth, service);
    }
    const closed = [...snapshot.purgatory, ...snapshot.pendingFallenByDepth.flatMap(q => q.monsters)].map(c => c.id);
    if ([...graph.monsters.values()].some(c => c.spatial && (!owner.has(c.id) || closed.includes(c.id) || [...graph.monsters.values()].some(parent => parent.carriedMonster === c)))) throw new SpatialValidationError('Unopened spatial lifecycle');
    const expected = snapshotNativeSpatialWorld(spatialLevels);
    const canonical = (v: unknown): string => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
    // Stored arrays are canonical; this also rejects duplicates, unused entries,
    // orphan groups and definitions which exist only in an untrusted snapshot.
    if (canonical(root) !== canonical(expected)) throw new SpatialValidationError('Invalid native spatial root closure');
    return spatialLevels;
}

export function isWholeRunSnapshot(value: unknown, spatialCatalog?: SpatialCatalog): value is GameSnapshot {
    const s = value as GameSnapshot | null;
    if (!s || s.version !== 3 || s.schema !== WHOLE_RUN_SCHEMA || !isSeed(s.seed)
        || !Random.isState(s.rngState) || !isLevelSeeds(s.levelSeeds)
        || s.currentLevelDepth !== s.depth || !s.run || !s.flavors || !s.player || !s.entityGraph
        || !Number.isFinite(s.ticksTillUpdateEnvironment) || typeof s.pendingEnchantment !== 'boolean'
        || (s.pendingEnchantment && typeof s.run.enchantmentScrollWasKnown !== 'boolean')
        || !Array.isArray(s.identifiedItems) || !Array.isArray(s.magicPolarityRevealed)
        || !s.callTitles || !s.stats || !Number.isFinite(s.rewardRoomsGenerated)
        || !Array.isArray(s.run.meteredItems) || !Number.isFinite(s.run.foodSpawned)
        || !Number.isFinite(s.run.goldGenerated) || !Number.isFinite(s.run.currentTick)
        || !Number.isSafeInteger(s.run.nextEntityId) || s.run.nextEntityId < 1
        || !Number.isFinite(s.run.monsterSpawnFuse) || !Number.isFinite(s.run.absoluteTurnNumber)
        || typeof s.run.pendingIdentify !== 'boolean' || !s.run.logger
        || !Array.isArray(s.levels) || !Array.isArray(s.pendingFallenByDepth) || !Array.isArray(s.pendingFallenItemsByDepth)
        || (s.purgatory !== undefined && !Array.isArray(s.purgatory))) return false;
    const depths = new Set<number>();
    for (const level of [s, ...s.levels]) {
        if (!level || !Number.isInteger(level.depth) || level.depth < 1 || level.depth > CE_DEEPEST_LEVEL
            || depths.has(level.depth) || !s.levelSeeds[level.depth - 1]?.visited
            || level.width !== DCOLS || level.height !== DROWS
            || !Array.isArray(level.grid) || level.grid.length !== level.width * level.height
            || !Array.isArray(level.impregnableCells)
            || !level.grid.every(c => c && c.layers?.length === 4 && typeof c.machineNumber === 'number'
                && typeof c.rememberedTerrain === 'number' && Array.isArray(c.rememberedLayers)
                && (c.rememberedLayers.length === 0 || c.rememberedLayers.length === 4)
                && typeof c.isMagicMapped === 'boolean' && typeof c.knownTrapFree === 'boolean'
                && typeof c.rememberedTerrainFlags === 'number' && typeof c.rememberedTMFlags === 'number'
                && c.rememberedAppearance !== undefined && c.rememberedItem !== undefined
                && c.rememberedItemCategory !== undefined && c.rememberedFlags !== undefined)
            || !machineCellsMatchGrid(level.machineCells, level.grid)
            || !level.scent || level.scent.values.length !== level.width * level.height
            || !level.waypoints || !level.environmentState || !Array.isArray(level.monsters)
            || !Number.isFinite(level.awaySince) || !level.playerExitedVia
            || !Number.isInteger(level.playerExitedVia.x) || !Number.isInteger(level.playerExitedVia.y)
            || !Array.isArray(level.dormantMonsters) || !Array.isArray(level.items)) return false;
        depths.add(level.depth);
    }
    if (!Array.isArray(s.entityGraph.monsters) || !Array.isArray(s.entityGraph.items)
        || s.pendingFallenByDepth.some(level => !level || !Array.isArray(level.monsters))) return false;
    if (s.pendingFallenItemsByDepth.some(q => !q || !Number.isInteger(q.depth) || q.depth < 1 || q.depth > CE_DEEPEST_LEVEL
        || !Array.isArray(q.items) || q.items.some(item => !Number.isFinite(item.spawnTurnNumber)))) return false;
    if (!Array.isArray(s.player.inventory)) return false;
    const items = [...s.items, ...s.player.inventory, ...s.entityGraph.items,
        ...s.levels.flatMap(l => l.items), ...s.pendingFallenItemsByDepth.flatMap(q => q.items)];
    // New required persisted knowledge, never synthesized from old recharge state.
    if (items.some(item => !Array.isArray(item.knownStaffUses) || item.knownStaffUses.length > 3
        || item.knownStaffUses.some((turn, i, uses) => !Number.isSafeInteger(turn) || turn < 0
            || (i > 0 && turn > uses[i - 1]!)))) return false;
    if (Object.prototype.hasOwnProperty.call(s.run, 'spatialWorld') && s.run.spatialWorld === undefined) return false;
    const rows = [...s.monsters, ...s.dormantMonsters, ...(s.purgatory ?? []), ...s.entityGraph.monsters,
        ...s.levels.flatMap(l => [...l.monsters, ...l.dormantMonsters]), ...s.pendingFallenByDepth.flatMap(l => l.monsters)];
    try {
        assertSingleCellPlayer(s.player);
        for (const row of rows) if (Object.prototype.hasOwnProperty.call(row, 'spatial')) {
            if (spatialCatalog?.fixture) validateSpatialComponent(row.spatial, spatialCatalog, false);
            else assertNativeSpatial(row as unknown as Monster);
        }
        if (rows.some(row => row.spatial) && !s.run.spatialWorld) return false;
        if (s.run.spatialWorld && !spatialCatalog?.fixture
            && canonicalSpatial(s.run.spatialWorld) !== canonicalSpatial(snapshotSquareWorld(rows as unknown as Monster[]))) return false;
    } catch { return false; }
    if (rows.some(m => !Number.isInteger(m.entersLevelIn) || m.entersLevelIn < 0 || m.entersLevelIn > 150
        || !Number.isInteger(m.approaching) || m.approaching < 0 || m.approaching > 7)) return false;
    if (s.mode !== 'test' && s.levelSeeds.some((level, i) => level.visited && !depths.has(i + 1))) return false;
    return true;
}
