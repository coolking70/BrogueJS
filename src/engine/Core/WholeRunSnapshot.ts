import {c5Canonical} from '../../ext/worldJson';
import { effectivePartyCodec, hasPartyIdentity } from '../../ext/partyIdentity';
import { validatePartyState, type PartyState } from '../../ext/party';
import { PartyMember } from './PartyRuntime';
import type { ControlledActor } from '../../entities/ControlledActor';
import { validateWorld5, assertWorldLevelOwnership } from '../../ext/world5';
import { isLoggerSnapshot } from '../Systems/Logger';
import { getNextEntityId, restoreNextEntityId } from '../../entities/Creature';
import { assertNativeSpatial, assertSingleCellPlayer, CreatureSpatial, footprintOf, spatialCatalogFor } from '../Movement/CreatureSpatial';
import { regionContains, validOwnedRegions } from '../../ext/regions';
import { keys, nativeSpatialCatalog, SpatialValidationError, SPATIAL_LIMITS, validateSpatialComponent, type SpatialCatalog, type SpatialWorldSnapshot } from '../Movement/SpatialSchema';
import { validateBodyGroup } from '../Movement/BodyGroups';
import { bodyConstraintsSatisfied } from '../Movement/BodyConstraints';
import type { BodyGroupState } from '../Movement/SpatialSchema';
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
import { Direction, type Pos } from '../../types';

export const WHOLE_RUN_SCHEMA = 'brogue-web-whole-run-v7' as const;

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
    /** Shared whole-run envelope; entity row/graph codec has no independent version slot. */
    version: number;
    schema: typeof WHOLE_RUN_SCHEMA | 'brogue-web-whole-run-v9';
    party?: { state: PartyState; actors: GameSnapshotPlayer[]; native: import('./PartyRuntime').PartyRuntime['native'] };
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
    bodyGroups?: readonly BodyGroupState[];
    spatialCatalog?: SpatialCatalog;
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
    controlledActors?: readonly ControlledActor[];
    containerItems?: readonly Item[];
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
    const ownedItems = [...[...source.pendingFallenItemsByDepth.values()].flat(), ...source.items, ...(source.controlledActors??[source.player]).flatMap(a=>a.inventory.items), ...levels.flatMap(([, l]) => l.items)];
    const graph = collectEntityGraph([...roots, ...source.everSeenMonsters,
        ...source.visibleMonsters, ...levels.flatMap(([, l]) => [...l.visibleMonsters])], [...ownedItems, ...(source.containerItems??[]), ...source.everSeenItems,
        ...source.visibleItems, ...levels.flatMap(([, l]) => [...l.visibleItems]),
        ...[source.player.equippedWeapon, source.player.equippedArmor, source.player.ringLeft, source.player.ringRight, source.travelTargetItem]
            .filter((item): item is Item => item != null)]);
    const spatialWorld = source.nativeSpatial ? snapshotNativeSpatialWorld(source.nativeSpatial)
        : snapshotSquareWorld(graph.monsters, source.spatialCatalog, source.bodyGroups);
    if (source.bodyGroups?.length) validateProductionGroupOwnership(source.bodyGroups, source.spatialCatalog!, [
        { grid: source.active.grid, monsters: source.monsters, dormantMonsters: source.dormantMonsters, player: source.player },
        ...levels.map(([, level]) => ({ grid: level.grid, monsters: level.monsters, dormantMonsters: level.dormantMonsters })),
    ], [...source.pendingFallenByDepth.values()]);
    return {
        ...source.snapshotLevel(source.depth, source.active),
        version: 7, schema: WHOLE_RUN_SCHEMA, savedAt: Date.now(),
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

export function decodePlayer(saved: GameSnapshot['player'], items: Map<number, Item>, member = false): Player {
    assertSingleCellPlayer(saved);
    const nextId = getNextEntityId();
    let player: Player;
    // Detached validation must not advance the live allocator, including a
    // rejection later in pending/cached-layer footprint validation.
    try { player = member ? new PartyMember(saved.loc.x, saved.loc.y) : new Player(saved.loc.x, saved.loc.y); }
    finally { restoreNextEntityId(nextId); }
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
        [...levelRows.flatMap(l => l.items), ...snapshot.pendingFallenItemsByDepth.flatMap(q => q.items), ...snapshot.player.inventory, ...(snapshot.party?.actors.flatMap(a=>a.inventory)??[]), ...snapshot.entityGraph.items],
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
    // Validate party occupancy on each owned floor before any live publication.
    // Dormant 1x1 creatures retain CE's non-occupying policy; spatial reservations do not.
    if (snapshot.party) for (const member of snapshot.party.state.members) {
        if (member.life === 'dead' || member.level.kind !== 'dungeon') continue;
        const actor = member.actorId === snapshot.player.id ? snapshot.player : snapshot.party.actors.find(a=>a.id===member.actorId)!;
        const level = restored.get(member.level.depth)!;
        if ([...level.monsters, ...(level.dormantMonsters ?? []).filter(m=>m.spatial)].some(m=>m.hp>0
            && footprintOf(m, deps.spatialCatalog ?? nativeSpatialCatalog).some(p=>p.x===actor.loc.x&&p.y===actor.loc.y)))
            throw new SpatialValidationError('Overlapping party and monster footprints');
    }
    const result = { entityGraph, restored };
    const regions = snapshot.extensions?.foundation.world.regions;
    if (regions !== undefined) {
        if (!validOwnedRegions(regions, snapshot.extensions!.manifest.modules.map(module => module.id))) throw new SpatialValidationError('Invalid owned regions');
        for (const region of regions) {
            const grid = restored.get(region.depth)?.grid, b = region.bounds;
            if (!grid || b.x + b.width > grid.width || b.y + b.height > grid.height || region.id >= snapshot.run.nextEntityId
                || region.id === snapshot.player.id || entityGraph.monsters.has(region.id) || entityGraph.items.has(region.id)
                || snapshot.extensions!.foundation.world.entities.some(entity => entity.id === region.id)) throw new SpatialValidationError('Invalid owned region layer or allocator');
        }
    }
    const inRegion = (id: number, depth: number, at: Readonly<Pos>): boolean => {
        const region = regions?.find(region => region.id === id && region.depth === depth);
        return !!region && regionContains(region, at);
    };
    for (const monster of entityGraph.monsters.values()) if (monster.spatial?.movementRegionId !== undefined) {
        const region = regions?.find(region => region.id === monster.spatial!.movementRegionId);
        if (!region || snapshot.pendingFallenByDepth.some(queue => queue.monsters.some(row => row.id === monster.id))) throw new SpatialValidationError('Missing or stale movement region');
        for (const [depth, level] of restored) if (level.monsters.includes(monster) || level.dormantMonsters?.includes(monster)) {
            if (region.depth !== depth || !footprintOf(monster, deps.spatialCatalog ?? nativeSpatialCatalog).every(at => inRegion(region.id, depth, at))) throw new SpatialValidationError('Creature outside movement region');
        }
    }
    if (snapshot.run.spatialWorld !== undefined) {
        if (!deps.spatialCatalog?.fixture) {
            const expected = snapshotSquareWorld([...entityGraph.monsters.values()], deps.spatialCatalog, snapshot.run.spatialWorld.groups);
            if (canonicalSpatial(snapshot.run.spatialWorld) !== canonicalSpatial(expected)) throw new SpatialValidationError('Invalid square definition closure');
            const player = decodePlayer(snapshot.player, entityGraph.items);
            if (snapshot.run.spatialWorld.groups.length) validateProductionGroupOwnership(snapshot.run.spatialWorld.groups, deps.spatialCatalog!,
                [...restored].map(([depth, level]) => ({ grid: level.grid, monsters: level.monsters, dormantMonsters: level.dormantMonsters,
                    ...(depth === snapshot.depth && (!snapshot.party || snapshot.party.state.members.some(m=>m.actorId===player.id&&m.life==='active')) ? { player } : {}), inRegion: (id: number, at: Readonly<Pos>) => inRegion(id, depth, at) })),
                snapshot.pendingFallenByDepth.map(q => q.monsters.map(m => resolve(entityGraph.monsters, m.id))));
            // Validate physical ownership and full footprints on each independent
            // layer. Pending/carry/purgatory retain component truth, with no index.
            const owned = new Set<number>();
            for (const [depth, level] of restored) {
                const cohort = [...level.monsters, ...(level.dormantMonsters ?? [])];
                for (const c of cohort) { if (owned.has(c.id)) throw new SpatialValidationError('Multiple square ownership'); owned.add(c.id); }
                if (!cohort.some(c => c.spatial)) continue;
                const service = new CreatureSpatial({ grid: level.grid, monsters: level.monsters, dormantMonsters: level.dormantMonsters, inRegion: (id, at) => inRegion(id, depth, at),
                    ...(depth === snapshot.depth && (!snapshot.party || snapshot.party.state.members.some(m=>m.actorId===player.id&&m.life==='active')) ? { player } : {}) }, deps.spatialCatalog);
                try {
                    for (const c of cohort) if (c.hp > 0 && !service.canFitAt(c, c.loc, { allowsTerrain: () => true, inRegion: (id, at) => inRegion(id, depth, at) })) throw new SpatialValidationError('Overlapping square footprints');
                } finally { service.dispose(); }
            }
            for (const queue of snapshot.pendingFallenByDepth) {
                if (!Number.isInteger(queue.depth) || queue.depth < 1 || queue.depth > CE_DEEPEST_LEVEL) throw new SpatialValidationError('Invalid pending square layer');
                const squares = queue.monsters.filter(c => c.spatial);
                if (squares.length > SPATIAL_LIMITS.entities || squares.reduce((n, c) => n + (deps.spatialCatalog ?? nativeSpatialCatalog).cells(c.spatial!.footprintId, c.spatial!.pose).length, 0) > SPATIAL_LIMITS.occupiedCells) throw new SpatialValidationError('Pending square budget exceeded');
                for (const row of queue.monsters) {
                    if (row.spatial) {
                        const cells = (deps.spatialCatalog ?? nativeSpatialCatalog).cells(row.spatial.footprintId, row.spatial.pose);
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
/** Production uses only independently initialized installed definitions. A saved
 * closure describes used geometry; it cannot grant capabilities or install data. */
function snapshotSquareWorld(monsters: readonly Monster[], catalog?: SpatialCatalog, groups: readonly BodyGroupState[] = []): SpatialWorldSnapshot | undefined {
    if (!Array.isArray(groups) || groups.length > SPATIAL_LIMITS.entities || new Set(groups.map(g => g.groupId)).size !== groups.length)
        throw new SpatialValidationError('Invalid production group root');
    const owned = new Set<number>();
    for (const group of groups) {
        if (!catalog || catalog.fixture) throw new SpatialValidationError('Unavailable production group catalog');
        validateBodyGroup(group, catalog, id => monsters.find(c => c.id === id));
        for (const slot of group.members) if (slot.entityId !== null) {
            if (owned.has(slot.entityId)) throw new SpatialValidationError('Shared production member');
            owned.add(slot.entityId);
        }
    }
    if (monsters.some(c => c.spatial?.bodyMember && !owned.has(c.id))) throw new SpatialValidationError('Orphan production member');
    const definitions = new Map<string, ReturnType<SpatialCatalog['definition']>>();
    const breaks = new Map<string, ReturnType<SpatialCatalog['breakRule']>>();
    for (const c of monsters) {
        const trusted = catalog ?? spatialCatalogFor(c);
        assertNativeSpatial(c, trusted);
        if (c.spatial) {
            const definition = trusted.definition(c.spatial.footprintId);
            definitions.set(c.spatial.footprintId, definition);
            for (const zone of definition.zones ?? []) breaks.set(zone.breakRuleId, trusted.breakRule(zone.breakRuleId));
        }
    }
    if (!definitions.size) return undefined;
    if (groups.length) return { schema: 1, definitions: catalog!.definitionClosure([...definitions.keys()], groups.map(g => g.bodyDefinitionId)),
        groups: structuredClone([...groups].sort((a, b) => a.groupId - b.groupId)) };
    return { schema: 1, definitions: { footprints: [...definitions.values()].sort((a,b) => a.id.localeCompare(b.id)), bodies: [],
        ...(breaks.size ? { breakRules: [...breaks.values()].sort((a,b) => a.id.localeCompare(b.id)) } : {}) }, groups: [] };
}

function validateProductionGroupOwnership(groups: readonly BodyGroupState[], catalog: SpatialCatalog,
    worlds: readonly import('../Movement/CreatureSpatial').SpatialWorld[], pending: readonly (readonly Monster[])[] = []): void {
    for (const group of groups) {
        const owners = worlds.filter(world => world.monsters.some(c => c.id === group.coreId) || world.dormantMonsters?.some(c => c.id === group.coreId));
        const queues = pending.filter(q => q.some(c => c.id === group.coreId));
        if (owners.length + queues.length !== 1) throw new SpatialValidationError('Missing or multiply owned group core');
        if (queues.length) {
            const cohort = queues[0]!, definition = catalog.body(group.bodyDefinitionId);
            const actors = group.members.flatMap(s => s.entityId === null ? [] : [cohort.find(c => c.id === s.entityId)]);
            if (actors.some(a => !a || !a.preplaced || a.falling || a.entersLevelIn || a.approaching)
                || !bodyConstraintsSatisfied(catalog, definition, new Map(actors.map(a => [a!.spatial!.bodyMember!.partId,
                    { anchor: a!.loc, footprintId: a!.spatial!.footprintId, pose: a!.spatial!.pose }]))))
                throw new SpatialValidationError('Invalid pending group ownership or geometry');
            const occupied = new Set<string>();
            for (const actor of actors) for (const cell of footprintOf(actor!, catalog)) {
                const key = `${cell.x},${cell.y}`;
                if (occupied.has(key)) throw new SpatialValidationError('Overlapping pending group');
                occupied.add(key);
            }
            continue; // pending has no terrain/index and no independent member clocks
        }
        const world = owners[0]!;
        const service = new CreatureSpatial(world, catalog);
        try {
            const cohort = [...world.monsters, ...(world.dormantMonsters ?? [])];
            const localGroups = groups.filter(g => cohort.some(c => c.id === g.coreId));
            service.restoreWorld({ schema: 1, definitions: catalog.definitionClosure(cohort.flatMap(c => c.spatial ? [c.spatial.footprintId] : []),
                localGroups.map(g => g.bodyDefinitionId)), groups: structuredClone(localGroups) });
        } finally { service.dispose(); }
    }
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
    const attackProfiles = merge(snapshots.flatMap(s => s.definitions.attackProfiles ?? []));
    return { schema: 1, definitions: { footprints: merge(snapshots.flatMap(s => s.definitions.footprints)), bodies: merge(snapshots.flatMap(s => s.definitions.bodies)),
        ...(forms.length ? { forms } : {}), ...(breakRules.length ? { breakRules } : {}), ...(statusProfiles.length ? { statusProfiles } : {}), ...(attackProfiles.length ? { attackProfiles } : {}) }, groups };
}

/** Decode each physical layer separately: cached layers may occupy the same
 * coordinates, but no entity/group may be split or multiply owned. Pending,
 * carried and purgatory spatial lifecycles stay explicitly closed in 4a0. */
function decodeNativeSpatialWorld(snapshot: GameSnapshot, graph: ReturnType<typeof restoreEntityGraph>, restored: Map<number, LevelState>, catalog: SpatialCatalog): Map<number, CreatureSpatial> {
    const root = snapshot.run.spatialWorld!;
    keys(root, ['schema', 'definitions', 'groups']); keys(root.definitions, ['footprints', 'bodies', 'forms', 'breakRules', 'statusProfiles', 'attackProfiles'], ['footprints', 'bodies']);
    if (!catalog.fixture || root.schema !== 1 || !Array.isArray(root.groups) || !Array.isArray(root.definitions.footprints) || !Array.isArray(root.definitions.bodies)
        || ['forms', 'breakRules', 'statusProfiles', 'attackProfiles'].some(k => (root.definitions as any)[k] !== undefined && !Array.isArray((root.definitions as any)[k]))) throw new SpatialValidationError('Invalid native spatial world');
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
            ...(closure.attackProfiles ? { attackProfiles: (root.definitions.attackProfiles ?? []).filter(d => closure.attackProfiles!.some(ref => ref.id === d.id)) } : {}),
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

/** Native ownership facts for economic home references. Pending actors resolve
 * by their actual native identity, as do actors on other floors. Unresolved
 * historical IDs cannot borrow Items/Player or an unrelated live graph node.
 * No IDs or persistent state are allocated. */
export function world5SnapshotContext(s: GameSnapshot) {
    const layers = [s, ...s.levels];
    const actors = new Map(layers.flatMap(l => [...l.monsters, ...l.dormantMonsters].map(m => [m.id, l.depth] as const)));
    for (const pending of s.pendingFallenByDepth) for (const actor of pending.monsters) actors.set(actor.id, pending.depth);
    for(const member of s.party?.state.members??[])if(member.level.kind==='dungeon'&&member.life!=='dead')actors.set(member.actorId,member.level.depth);
    const occupiedEntityIds = new Set([s.player.id, ...(s.party?.actors.flatMap(a=>[a.id,...a.inventory.map(i=>i.id)])??[]), ...s.entityGraph.items.map(i => i.id),
        ...s.items.map(i => i.id), ...s.player.inventory.map(i => i.id), ...s.levels.flatMap(l => l.items.map(i => i.id)),
        ...s.pendingFallenItemsByDepth.flatMap(q => q.items.map(i => i.id)),
        ...[...s.entityGraph.monsters, ...(s.purgatory ?? []), ...s.pendingFallenByDepth.flatMap(q => q.monsters)]
            .filter(m => m.hp > 0).map(m => m.id)]);
    return { active: s.depth, visited: s.levelSeeds, cachedDepths: s.levels.map(l => l.depth),
        campDepths: s.extensions?.foundation.world.regions?.filter(r=>r.campSlotId!==undefined).map(r=>r.depth)??[],
        owners: s.extensions?.manifest.modules.map(m => m.id) ?? [], actors, occupiedEntityIds, nextEntityId: s.run.nextEntityId };
}

export function isWholeRunSnapshot(value: unknown, spatialCatalog?: SpatialCatalog): value is GameSnapshot {
    const s = value as GameSnapshot | null;
    if (!s || s.version !== effectivePartyCodec(s.extensions?.manifest).wholeRun || s.schema !== effectivePartyCodec(s.extensions?.manifest).schema || !isSeed(s.seed)
        || !Random.isState(s.rngState) || !isLevelSeeds(s.levelSeeds)
        || s.currentLevelDepth !== s.depth || !s.run || !s.flavors || !s.player || !s.entityGraph
        || !Number.isFinite(s.ticksTillUpdateEnvironment) || typeof s.pendingEnchantment !== 'boolean'
        || (s.pendingEnchantment && typeof s.run.enchantmentScrollWasKnown !== 'boolean')
        || (s.run.enchantmentScrollId!==undefined&&(!s.pendingEnchantment||!Number.isSafeInteger(s.run.enchantmentScrollId)||s.run.enchantmentScrollId<1))
        || !Array.isArray(s.identifiedItems) || !Array.isArray(s.magicPolarityRevealed)
        || !s.callTitles || !s.stats || !Number.isFinite(s.rewardRoomsGenerated)
        || !Array.isArray(s.run.meteredItems) || !Number.isFinite(s.run.foodSpawned)
        || !Number.isFinite(s.run.goldGenerated) || !Number.isFinite(s.run.currentTick)
        || !Number.isSafeInteger(s.run.nextEntityId) || s.run.nextEntityId < 1
        || !Number.isFinite(s.run.monsterSpawnFuse) || !Number.isFinite(s.run.absoluteTurnNumber)
        || typeof s.run.pendingIdentify !== 'boolean' || !isLoggerSnapshot(s.run.logger)
        || (s.run.seenBodyCoreIds !== undefined && (!Array.isArray(s.run.seenBodyCoreIds)
            || new Set(s.run.seenBodyCoreIds).size !== s.run.seenBodyCoreIds.length
            || s.run.seenBodyCoreIds.some(id => !Number.isSafeInteger(id) || id < 1 || id >= s.run.nextEntityId)))
        || !Array.isArray(s.levels) || !Array.isArray(s.pendingFallenByDepth) || !Array.isArray(s.pendingFallenItemsByDepth)
        || (s.purgatory !== undefined && !Array.isArray(s.purgatory))) return false;
    if (hasPartyIdentity(s.extensions?.manifest) !== Object.prototype.hasOwnProperty.call(s,'party')) return false;
    if (s.party) {
        try {
            if(Object.keys(s.party).sort().join(',')!=='actors,native,state')return false;
            validatePartyState(s.party.state);
            const configuration=s.extensions?.manifest.modules.find(m=>m.id==='party')?.configuration as {members?:number}|undefined;
            if(configuration?.members!==s.party.state.members.length)return false;
            if(s.party.state.primaryActorId!==s.player.id || !Array.isArray(s.party.actors)
                || s.party.actors.length!==s.party.state.members.length-1)return false;
            if(!s.party.native||Object.keys(s.party.native).sort().join(',')!==s.party.state.members.map(m=>String(m.actorId)).sort().join(','))return false;
            for(const row of Object.values(s.party.native))if(!row||Object.keys(row).sort().join(',')!=='falling,justRested,justSearched,lastDamageSource,modal,pendingTurn,poisonedDuringTurn,receivedLevitationWarning,searchingCharge'||typeof row.justRested!=='boolean'||typeof row.lastDamageSource!=='string'||typeof row.receivedLevitationWarning!=='boolean'||typeof row.modal!=='boolean'||typeof row.falling!=='boolean'||typeof row.pendingTurn!=='boolean'||typeof row.poisonedDuringTurn!=='boolean'||typeof row.justSearched!=='boolean'||!Number.isSafeInteger(row.searchingCharge)||row.searchingCharge<0)return false;
            const ids=new Set<number>([s.player.id]);
            for(const actor of s.party.actors){
                if(ids.has(actor.id)||actor.id>=s.run.nextEntityId)return false;
                ids.add(actor.id);
                if(!s.party.state.members.some(m=>m.actorId===actor.id))return false;
                if(!validControlledSnapshot(actor))return false;
            }
            const itemIds=new Set(s.player.inventory.map(i=>i.id));
            for(const actor of s.party.actors)for(const item of actor.inventory){if(itemIds.has(item.id))return false;itemIds.add(item.id);}
            const memberCells=new Set<string>();
            for(const m of s.party.state.members){const actor=m.actorId===s.player.id?s.player:s.party.actors.find(a=>a.id===m.actorId);
                if(!actor||actor.spatial||(actor.statusDurations.lifespan_remaining??0)>0
                    ||!s.levelSeeds[m.level.kind==='dungeon'?m.level.depth-1:-1]?.visited
                    ||m.level.kind==='dungeon'&&m.level.depth!==s.depth&&!s.levels.some(l=>l.depth===(m.level as {depth:number}).depth)
                    ||m.life==='frozen'&&m.level.kind==='dungeon'&&m.level.depth===s.depth
                    ||s.run.world5?.residents.some(r=>r.actorId===m.actorId)
                    ||s.run.world5?.raidCamps.some(c=>c.event?.actorIds.includes(m.actorId))
                    ||actor.loc.x<0||actor.loc.y<0||actor.loc.x>=s.width||actor.loc.y>=s.height
                    ||(m.life==='dead')!==(actor.hp<=0)||m.level.kind!=='dungeon'
                    ||m.life==='active'&&m.level.depth!==s.depth)return false;
                if(m.life!=='dead'){
                    const key=`${m.level.depth}:${actor.loc.x},${actor.loc.y}`;
                    if(memberCells.has(key))return false;
                    memberCells.add(key);
                }
            }
            if(s.party.state.members.every(m=>m.life==='dead')&&!s.run.isGameOver)return false;
        } catch {return false;}
    }
    const identities = s.flavors.identities;
    const flavorId = (v: unknown) => typeof v === 'string' && /^(?:(potion|wand|staff|ring|charm)\.(0|[1-9][0-9]*)|scroll\.(0|[1-9][0-9]*)(\.(0|[1-9][0-9]*)){2,3})$/.test(v);
    if (!identities || !Array.isArray(identities.kinds) || !Array.isArray(identities.staffSlots)
        || !identities.kinds.every(row => Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && flavorId(row[1]))
        || new Set(identities.kinds.map(row => row[0])).size !== identities.kinds.length
        || !identities.staffSlots.every(flavorId)) return false;
    const flavorKinds = new Map(identities.kinds);
    for (const [key, prefix] of [['potions', 'potion.'], ['scrolls', 'scroll.'], ['arcana', null]] as const) {
        const rows = s.flavors[key];
        if (!Array.isArray(rows) || !rows.every(row => Array.isArray(row) && row.length === 2
            && typeof row[0] === 'string' && flavorKinds.has(row[0])
            && (!prefix || flavorKinds.get(row[0])!.startsWith(prefix)))) return false;
    }
    if (!Array.isArray(s.flavors.staffSlots) || s.flavors.staffSlots.length !== identities.staffSlots.length
        || identities.staffSlots.some(id => !id.startsWith('staff.'))) return false;
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
    if (s.run.world5) {
        try { assertWorldLevelOwnership(s, new Map(s.levels.map(l => [l.depth,l])), { monsters: s.pendingFallenByDepth.flatMap(q => q.monsters), items: s.pendingFallenItemsByDepth.flatMap(q => q.items) }); }
        catch { return false; }
    }
    const items = [...s.items, ...s.player.inventory, ...(s.party?.actors.flatMap(a=>a.inventory)??[]), ...s.entityGraph.items,
        ...s.levels.flatMap(l => l.items), ...s.pendingFallenItemsByDepth.flatMap(q => q.items)];
    if(items.some(item=>item.category===13?(!s.run.world5||!Object.prototype.hasOwnProperty.call(item,'worldItem')||!item.worldItem):Object.prototype.hasOwnProperty.call(item,'worldItem')))return false;
    for(const key of ['actorActions','worldWorkFacts','worldWorkDetails'] as const)if(Object.prototype.hasOwnProperty.call(s.run,key)&&(s.run as any)[key]===undefined)return false;
    const auto=s.run.autoAction as any;
    if(auto!==undefined){
        if(!auto||typeof auto!=='object'||Array.isArray(auto))return false;
        if(auto.kind==='auto_work'){if(!s.run.world5||Object.keys(auto).sort().join(',')!=='kind,ticketId'||!Number.isSafeInteger(auto.ticketId)||auto.ticketId<1)return false;}
        else if(auto.kind==='rest_point'){
          if(!s.run.world5||Object.keys(auto).sort().join(',')!=='anchor,depth,hp,kind,ordinal,remaining,restPointId,revision'||['restPointId','revision','ordinal','remaining','hp','depth'].some(k=>!Number.isSafeInteger(auto[k])||auto[k]<0)||auto.remaining>300||auto.depth!==s.depth||!auto.anchor||Object.keys(auto.anchor).sort().join(',')!=='x,y'||!Number.isSafeInteger(auto.anchor.x)||!Number.isSafeInteger(auto.anchor.y))return false;
        }
        else {const keys=['kind','remaining','cardinalPassability','untilRecovered','initiallyEmbedded',...(Object.prototype.hasOwnProperty.call(auto,'direction')?['direction']:[])].sort();
            if(!['auto_rest','search_long','run'].includes(auto.kind)||Object.keys(auto).sort().join(',')!==keys.join(',')||!Number.isSafeInteger(auto.remaining)||auto.remaining<0||!Array.isArray(auto.cardinalPassability)||auto.cardinalPassability.length!==4||auto.cardinalPassability.some((v:unknown)=>typeof v!=='boolean')||typeof auto.untilRecovered!=='boolean'||typeof auto.initiallyEmbedded!=='boolean')return false;
            if(auto.kind==='run' ? !Number.isInteger(auto.direction)||auto.direction<Direction.UP||auto.direction>Direction.DOWNRIGHT : Object.prototype.hasOwnProperty.call(auto,'direction'))return false;
        }
    }
    if(!s.run.world5&&('worldWorkFacts' in s.run||'worldWorkDetails' in s.run))return false;
    // New required persisted knowledge, never synthesized from old recharge state.
    if (items.some(item => !Array.isArray(item.knownStaffUses) || item.knownStaffUses.length > 3
        || item.knownStaffUses.some((turn, i, uses) => !Number.isSafeInteger(turn) || turn < 0
            || (i > 0 && turn > uses[i - 1]!)))) return false;
    if (Object.prototype.hasOwnProperty.call(s.run, 'spatialWorld') && s.run.spatialWorld === undefined) return false;
    const rows = [...s.monsters, ...s.dormantMonsters, ...(s.purgatory ?? []), ...s.entityGraph.monsters,
        ...s.levels.flatMap(l => [...l.monsters, ...l.dormantMonsters]), ...s.pendingFallenByDepth.flatMap(l => l.monsters)];
    if(s.party){const memberIds=new Set(s.party.state.members.map(m=>m.actorId));if(rows.some(row=>memberIds.has(row.id))||new Set(items.map(i=>i.id)).size!==items.length||items.some(i=>memberIds.has(i.id)))return false;}
    try {
        assertSingleCellPlayer(s.player);
        for (const row of rows) if (Object.prototype.hasOwnProperty.call(row, 'spatial')) {
            if (spatialCatalog?.fixture) validateSpatialComponent(row.spatial, spatialCatalog, false);
            else assertNativeSpatial(row as unknown as Monster, spatialCatalog);
        }
        if (rows.some(row => row.spatial) && !s.run.spatialWorld) return false;
        if (s.run.spatialWorld && !spatialCatalog?.fixture
            && canonicalSpatial(s.run.spatialWorld) !== canonicalSpatial(snapshotSquareWorld(rows as unknown as Monster[], spatialCatalog, s.run.spatialWorld.groups))) return false;
    } catch { return false; }
    if (rows.some(m => !Number.isInteger(m.entersLevelIn) || m.entersLevelIn < 0 || m.entersLevelIn > 150
        || !Number.isInteger(m.approaching) || m.approaching < 0 || m.approaching > 7)) return false;
    if (Object.prototype.hasOwnProperty.call(s.run, 'world5')) {
        try { validateWorld5(s.run.world5, world5SnapshotContext(s)); }
        catch { return false; }
    }
    if (s.mode !== 'test' && s.levelSeeds.some((level, i) => level.visited && !depths.has(i + 1))) return false;
    return true;
}

/** Same entity codec for each member; roster contains references only. */
export function serializeControlledActor(actor: ControlledActor): GameSnapshotPlayer {
    return JSON.parse(JSON.stringify({...copyFields(actor,PLAYER_FIELDS),statusImmunities:[...actor.statusImmunities],
        hungerTransition:actor.snapshotHungerTransition(),inventoryCapacity:actor.inventory.capacity,
        inventory:actor.inventory.items.map(serializeItem),equippedWeaponId:actor.equippedWeapon?.id??null,
        equippedArmorId:actor.equippedArmor?.id??null,ringLeftId:actor.ringLeft?.id??null,ringRightId:actor.ringRight?.id??null}));
}

/** Member native roots are validated directly, without inventing a second whole world. */
function validControlledSnapshot(actor:GameSnapshotPlayer):boolean {
    try{c5Canonical(actor,true);assertSingleCellPlayer(actor);}catch{return false;}
    const allowed=new Set<string>([...PLAYER_FIELDS,'statusImmunities','hungerTransition','inventoryCapacity','inventory','equippedWeaponId','equippedArmorId','ringLeftId','ringRightId']);
    if(Object.keys(actor).some(key=>!allowed.has(key))||!Array.isArray(actor.inventory)||!Array.isArray(actor.statusImmunities))return false;
    if(!['id','hp','maxHp','strength','nutrition','maxNutrition','ticksUntilTurn','movementSpeed','attackSpeed','inventoryCapacity'].every(key=>Number.isSafeInteger((actor as unknown as Record<string,unknown>)[key])))return false;
    if(actor.id<1||actor.hp<0||actor.hp>actor.maxHp||actor.maxHp<1||actor.inventoryCapacity<0||actor.inventory.length>actor.inventoryCapacity||actor.ticksUntilTurn<0||actor.nutrition<0||actor.nutrition>actor.maxNutrition||actor.movementSpeed<1||actor.attackSpeed<1)return false;
    if(!actor.loc||!Number.isSafeInteger(actor.loc.x)||!Number.isSafeInteger(actor.loc.y))return false;
    for(const values of [actor.statusDurations,actor.maxStatus,actor.temporaryImmunities])if(!values||typeof values!=='object'||Array.isArray(values)||Object.values(values).some(v=>!Number.isSafeInteger(v)||Number(v)<0))return false;
    if(!Number.isFinite(actor.regenCarry)||actor.regenCarry<0||actor.loc.x<0||actor.loc.y<0||actor.loc.x>=DCOLS||actor.loc.y>=DROWS)return false;
    const ids=new Set(actor.inventory.map(item=>item.id));if(ids.size!==actor.inventory.length)return false;
    const equipment=[actor.equippedWeaponId,actor.equippedArmorId,actor.ringLeftId,actor.ringRightId].filter(id=>id!==null);
    return new Set(equipment).size===equipment.length&&equipment.every(id=>ids.has(id));
}
