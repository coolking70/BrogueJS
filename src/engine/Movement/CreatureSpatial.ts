import { bodyStatusOwner } from '../Status/BodyStatuses';
import { spatialTerrainRevision, releaseSpatialTerrain } from './SpatialRevision';
import { bodyConstraintsSatisfied, type BodyPose } from './BodyConstraints';
import { validateBodyGroup } from './BodyGroups';
import { inMovementRegion } from './MovementRegions';
import { rigidFootprint, rotationStages, type CompiledRigidFootprint, type QuarterTurns, type RigidPose } from './RigidFootprint';
import type { Creature } from '../../entities/Creature';
import type { Pos } from '../../types';
import type { Grid } from '../Map/Grid';
import { T_OBSTRUCTS_PASSABILITY, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from '../Map/TerrainCatalog';
import { TERRAIN_FLAGS } from '../Map/TerrainCatalog';
import { nativeSpatialCatalog, validateSpatialComponent, SpatialValidationError,
    deepFreeze, integer, keys, SPATIAL_LIMITS, type CreatureSpatialComponent, type CreatureSpatialView,
    type Pose, type SpatialCatalog, type FootprintCell, type BodyGroupState, type SpatialWorldSnapshot } from './SpatialSchema';

export type OccupancyPolicy = 'active' | 'active-or-reserved' | 'death-contact';
export type TargetKey = 'entity' | 'part' | 'group';
export type EffectTargetCategory = 'direct' | 'geometry' | 'area-damage' | 'mental' | 'identity' | 'healing' | 'environment' | 'death';
/** D08: area DAMAGE hits every contacted part; whole identity/healing/death uses
 * group. A scope owns deduplication; legacy reflected 1x1 rays keep revisits. */
export const EFFECT_TARGET_POLICY: Readonly<Record<EffectTargetCategory, TargetKey>> = Object.freeze({
    direct: 'part', geometry: 'part', 'area-damage': 'part', mental: 'group', identity: 'group', healing: 'group', environment: 'entity', death: 'group',
});
export interface SpatialWorld {
    grid: Grid; player?: Creature; monsters: readonly Creature[]; dormantMonsters?: readonly Creature[];
    /** CE clears HAS_MONSTER after the death DF/drop window, not at zero HP. */
    inDeathWindow?: (creature: Creature) => boolean;
    /** Pure decode/fixture port; live grids carry their session resolver. */
    inRegion?: (regionId: number, at: Readonly<Pos>) => boolean;
}
export interface BodyTarget {
    readonly entity: Creature; readonly entityId: number; readonly groupId: number;
    readonly partId: string | null; readonly zoneId: string; readonly dedupKey: string; readonly contact: Readonly<Pos>;
}
export type FootprintActor = Pick<Creature, 'loc' | 'spatial'>;
// Session authority follows the component, including hypothetical anchor DTOs.
// Saved geometry never creates an entry; decode binds only an installed catalog.
const catalogs = new WeakMap<CreatureSpatialComponent, SpatialCatalog>();
export function bindSpatialCatalog(c: Pick<Creature, 'spatial'>, catalog?: SpatialCatalog): void {
    if (c.spatial) { if (catalog) catalogs.set(c.spatial, catalog); else catalogs.delete(c.spatial); }
}
export function spatialCatalogFor(c: Pick<Creature, 'spatial'>): SpatialCatalog {
    return c.spatial && catalogs.get(c.spatial) || nativeSpatialCatalog;
}
export function isSquareFootprint(c: Pick<Creature, 'spatial'>): boolean {
    return !c.spatial || c.spatial.footprintId.startsWith('builtin:');
}
const listeners = new WeakMap<Creature, Set<() => void>>();
const squareAnchorRevisions = new WeakMap<Creature, number>();
const actorSourceRevisions = new WeakMap<Creature, number>();
const bodyAnchorPublications = new WeakSet<Creature>();
/** Derived source identity for a live action only. Never saved or compared across load. */
export function actorSourceRevision(creature: Creature): number { return actorSourceRevisions.get(creature) ?? 0; }
/** Native transition rollback must also restore the off-graph revisions used
 * by an already paid action. Reverting loc alone would invalidate its source. */
export function checkpointSpatialActorRevisions(actors: readonly Creature[]): () => void {
    const rows = actors.map(actor => ({ actor, source: actorSourceRevisions.get(actor), anchor: squareAnchorRevisions.get(actor),
        listenerSet:listeners.get(actor), callbacks:[...(listeners.get(actor)??[])], spatial:actor.spatial,catalog:actor.spatial?catalogs.get(actor.spatial):undefined }));
    return () => { for (const row of rows) {
        if(row.listenerSet){row.listenerSet.clear();row.callbacks.forEach(callback=>row.listenerSet!.add(callback));listeners.set(row.actor,row.listenerSet);}else listeners.delete(row.actor);
        if(row.spatial){if(row.catalog)catalogs.set(row.spatial,row.catalog);else catalogs.delete(row.spatial);}
        if (row.source === undefined) actorSourceRevisions.delete(row.actor); else actorSourceRevisions.set(row.actor, row.source);
        if (row.anchor === undefined) squareAnchorRevisions.delete(row.actor); else squareAnchorRevisions.set(row.actor, row.anchor);
    } };
}
/** Short-lived contact sequences can detect even a nested out-and-back move.
 * Derived, square-only bookkeeping; ordinary creatures never get an entry. */
export function squareAnchorRevision(creature: Creature): number { return squareAnchorRevisions.get(creature) ?? 0; }
/** The only anchor publication primitive. Existing callers own their CE
 * destination policy and contact ordering. mode preserves their old reference
 * semantics. Unpublished construction/restore is deliberately separate from
 * a checked live placement. Native paths reject all unopened components. */
export function commitCreatureAnchor(creature: Creature, at: Pos, mode: 'replace' | 'mutate' = 'replace', fixture = false): void {
    if (!integer(at.x, -32768, 32767) || !integer(at.y, -32768, 32767)) throw new SpatialValidationError('Invalid creature anchor');
    if (!fixture) assertNativeSpatial(creature);
    if (!fixture && creature.spatial?.bodyMember && !bodyAnchorPublications.has(creature))
        throw new SpatialValidationError('Composite anchors require a whole-group publication');
    if (creature.loc.x !== at.x || creature.loc.y !== at.y)
        actorSourceRevisions.set(creature, actorSourceRevision(creature) + 1);
    if (mode === 'mutate') { creature.loc.x = at.x; creature.loc.y = at.y; }
    else creature.loc = at;
    if (creature.spatial) squareAnchorRevisions.set(creature, squareAnchorRevision(creature) + 1);
    listeners.get(creature)?.forEach(invalidate => invalidate());
}
/** Trusted planner primitive, after its complete trajectory/staleness preflight.
 * Native single-actor displacement paths cannot tear one member off its body. */
export function commitCompositeAnchors(changes: readonly { creature: Creature; at: Readonly<Pos>; pose?: Pose }[], fixture = false): void {
    const groupId = changes[0]?.creature.spatial?.bodyMember?.groupId;
    if (!groupId || !changes.some(c => c.creature.id === groupId) || new Set(changes.map(c => c.creature)).size !== changes.length
        || changes.some(c => c.creature.spatial?.bodyMember?.groupId !== groupId
            || !integer(c.at.x, -32768, 32767) || !integer(c.at.y, -32768, 32767)
            || !Object.getOwnPropertyDescriptor(c.creature, 'loc')?.writable
            || ['x', 'y'].some(k => !Object.getOwnPropertyDescriptor(c.creature.loc, k)?.writable)))
        throw new SpatialValidationError('Invalid composite anchor publication');
    if (!fixture) changes.forEach(c => assertNativeSpatial(c.creature));
    changes.forEach(c => { if (c.pose !== undefined) spatialCatalogFor(c.creature).cells(c.creature.spatial!.footprintId, c.pose); });
    const prior = new Set(changes.filter(c => bodyAnchorPublications.has(c.creature)).map(c => c.creature));
    changes.forEach(c => bodyAnchorPublications.add(c.creature));
    try { changes.forEach(c => {
        if (c.pose !== undefined && c.pose !== c.creature.spatial?.pose) {
            spatialCatalogFor(c.creature).cells(c.creature.spatial!.footprintId, c.pose);
            c.creature.spatial!.pose = c.pose;
            actorSourceRevisions.set(c.creature, actorSourceRevision(c.creature) + 1);
            commitCreatureAnchor(c.creature, { ...c.at }, 'mutate', fixture);
        } else if (c.creature.x !== c.at.x || c.creature.y !== c.at.y) commitCreatureAnchor(c.creature, { ...c.at }, 'mutate', fixture);
    }); }
    finally { changes.forEach(c => { if (!prior.has(c.creature)) bodyAnchorPublications.delete(c.creature); }); }
}
export function assertNativeSpatial(creature: Creature, catalog = spatialCatalogFor(creature)): void {
    if (Object.prototype.hasOwnProperty.call(creature, 'spatial')) {
        if (creature.spatial?.bodyMember) {
            validateSpatialComponent(creature.spatial, catalog, false);
            const s = creature.spatial;
            if (catalog.fixture || !catalog.permitsMember(s.footprintId, s.bodyMember!.partId)
                || s.pose.startsWith('m') || Object.keys(s).some(k => !['schema', 'footprintId', 'pose', 'movementRegionId', 'bodyMember', 'actionLockInTicks', 'zoneState'].includes(k)))
                throw new SpatialValidationError('Composite member capability is not open');
            return;
        }
        try { if (isSquareFootprint(creature)) squareMovementSize(creature, catalog); else rigidMovementFootprint(creature, catalog); }
        catch (error) { throw new SpatialValidationError(`Spatial capability is not open: ${(error as Error).message}`); }
    }
}
export function assertSingleCellPlayer(creature: Pick<Creature, 'spatial'>): void {
    if (Object.prototype.hasOwnProperty.call(creature, 'spatial')) throw new SpatialValidationError('Player spatial capability is not open');
}
/** Ownership transfer retires a local movement binding. A polymorphed single
 * body returns to ordinary absence semantics when its region is cleared. */
export function clearMovementRegion(creature: Creature): number | undefined {
    const id = creature.spatial?.movementRegionId;
    if (id === undefined) return undefined;
    if (creature.spatial!.footprintId === 'builtin:single') delete creature.spatial;
    else delete creature.spatial!.movementRegionId;
    listeners.get(creature)?.forEach(invalidate => invalidate());
    return id;
}
/** Executable independent r0 squares, plus a bounded single body produced by
 * polymorph. This compatibility path accepts only the builtin square IDs. */
export function squareMovementSize(creature: Creature, catalog = spatialCatalogFor(creature)): number {
    if (!Object.prototype.hasOwnProperty.call(creature, 'spatial')) return 1;
    validateSpatialComponent(creature.spatial, catalog, false);
    const s = creature.spatial!;
    const conversionLock = !catalog.fixture && !!(creature as Creature & { bodyTransitionHistory?: readonly string[] }).bodyTransitionHistory?.length;
    const boundedSingle = s.footprintId === 'builtin:single' && s.movementRegionId !== undefined;
    if (!(boundedSingle || ['builtin:square-2', 'builtin:square-3'].includes(s.footprintId)) || s.pose !== 'r0'
        || Object.keys(s).some(k => !['schema', 'footprintId', 'pose', 'movementRegionId', ...(conversionLock ? ['actionLockInTicks'] : [])].includes(k))) {
        throw new SpatialValidationError('Spatial capability is not open: Square movement requires an independent unzoned r0 square');
    }
    return s.footprintId === 'builtin:single' ? 1 : s.footprintId === 'builtin:square-2' ? 2 : 3;
}
/** Registered independent rigid capability. Catalog authority comes from the
 * installed session. Fixed zone HP/locks require declared zones; mirrors and
 * composite groups remain closed. */
export function rigidMovementFootprint(creature: Creature, catalog = spatialCatalogFor(creature)): CompiledRigidFootprint {
    try { validateSpatialComponent(creature.spatial, catalog, false); }
    catch (error) { if (!catalog.fixture) throw new SpatialValidationError(`Spatial capability is not open: ${(error as Error).message}`); throw error; }
    const definition = catalog.definition(creature.spatial!.footprintId), zoned = !!definition.zones?.length;
    const conversionLock = !catalog.fixture && !!(creature as Creature & { bodyTransitionHistory?: readonly string[] }).bodyTransitionHistory?.length;
    if (catalog.fixture && definition.zones?.some(z => z.health.kind === 'local')) throw new SpatialValidationError('Fixture local zones are not open for native actions');
    if (Object.keys(creature.spatial!).some(k => !['schema', 'footprintId', 'pose', 'movementRegionId',
        ...(zoned && !catalog.fixture ? ['zoneState', 'actionLockInTicks'] : []), ...(conversionLock ? ['actionLockInTicks'] : [])].includes(k)))
        throw new SpatialValidationError('Rigid movement requires an independent body without locks or local health');
    return rigidFootprint(catalog, creature.spatial!.footprintId);
}
/** Shared graph/live-motion edge; fit includes the caller's terrain, region and
 * (for a live step) occupancy policy. Swept intermediate poses never trigger
 * environmental effects themselves. */
export function conservativeSquareStep(from: Pos, to: Pos, fit: (at: Pos) => boolean): boolean {
    const dx = to.x - from.x, dy = to.y - from.y;
    return Math.max(Math.abs(dx), Math.abs(dy)) === 1 && fit(to)
        && (!(dx && dy) || (fit({ x: from.x + dx, y: from.y }) && fit({ x: from.x, y: from.y + dy })));
}
/** Ordinary 1x1 queries retain the old constant geometry path, without a
 * compiled shape lookup, index, group record or scan for capability users. */
export function footprintOf(creature: FootprintActor, catalog = spatialCatalogFor(creature)): readonly FootprintCell[] {
    if (!creature.spatial) return [{ x: creature.loc.x, y: creature.loc.y, zoneId: 'body' }];
    return catalog.cells(creature.spatial.footprintId, creature.spatial.pose).map(p => ({ x: p.x + creature.loc.x, y: p.y + creature.loc.y, zoneId: p.zoneId }));
}
export function footprintContains(creature: FootprintActor, at: Pos, catalog = spatialCatalogFor(creature)): boolean {
    if (!creature.spatial) return creature.loc.x === at.x && creature.loc.y === at.y;
    return catalog.cells(creature.spatial.footprintId, creature.spatial.pose).some(p => p.x + creature.loc.x === at.x && p.y + creature.loc.y === at.y);
}
export function distanceBetweenFootprints(a: FootprintActor, b: FootprintActor, catalog?: SpatialCatalog): number {
    if (!a.spatial && !b.spatial) return Math.max(Math.abs(a.loc.x - b.loc.x), Math.abs(a.loc.y - b.loc.y));
    return nearestContact(a, b, catalog).distance;
}
export function distanceToFootprint(creature: FootprintActor, at: Pos, catalog = spatialCatalogFor(creature)): number {
    if (!creature.spatial) return Math.max(Math.abs(creature.loc.x - at.x), Math.abs(creature.loc.y - at.y));
    return Math.min(...footprintOf(creature, catalog).map(p => Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y))));
}
export function nearestContact(a: FootprintActor, b: FootprintActor, catalog?: SpatialCatalog): Readonly<{ from: FootprintCell; to: FootprintCell; distance: number }> {
    let result: { from: FootprintCell; to: FootprintCell; distance: number } | undefined;
    for (const from of footprintOf(a, catalog ?? spatialCatalogFor(a))) for (const to of footprintOf(b, catalog ?? spatialCatalogFor(b))) {
        const distance = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
        if (!result || distance < result.distance) result = { from, to, distance };
    }
    return deepFreeze(result!);
}
function eligible(world: SpatialWorld, c: Creature, policy: OccupancyPolicy, reserved: boolean): boolean {
    if (reserved) return policy === 'active-or-reserved' && c.hp > 0;
    return c.hp > 0 || (policy === 'death-contact' && !!world.inDeathWindow?.(c));
}
/** Generic lightweight native port; the indexed fixture facade below adds the
 * same policy, with a separate reserved table and dynamic death eligibility. */
export function creatureAtCell(world: SpatialWorld, at: Pos, policy: OccupancyPolicy = 'active', ignore?: ReadonlySet<Creature>): Creature | undefined {
    const candidates = world.player ? [world.player, ...world.monsters] : world.monsters;
    const active = candidates.find(c => !ignore?.has(c) && eligible(world, c, policy, false) && footprintContains(c, at));
    return active ?? (policy === 'active-or-reserved' ? world.dormantMonsters?.find(c => !ignore?.has(c) && eligible(world, c, policy, true) && footprintContains(c, at)) : undefined);
}
const flagsAt = (grid: Grid, p: Pos) => grid.getCell(p.x, p.y)?.layers.reduce((flags, t) => flags | TERRAIN_FLAGS[t].flags, 0) ?? T_OBSTRUCTS_PASSABILITY;
export interface FitOptions {
    policy?: OccupancyPolicy; ignore?: ReadonlySet<Creature>;
    allowsTerrain?: (at: Pos) => boolean;
    inRegion?: (regionId: number, at: Pos) => boolean;
}
export interface PlacementChange { creature: Creature; at: Pos; pose?: CreatureSpatialComponent['pose'] }
export interface PlacementPlan {
    readonly changes: readonly PlacementChange[];
    readonly previous: readonly { creature: Creature; loc: Pos; x: number; y: number; spatial: string }[];
    readonly revision: number; readonly terrainRevision: number; readonly grid: Grid; readonly options: FitOptions;
    /** Rotation caller MUST submit this positive cost to its actor clock.
     * A half turn contains two quarter actions and pays both. */
    readonly actionCost?: number;
}
/** Derived facade is owned by the session. Mechanical groups live in this
 * explicit world instance, never in a hidden WeakMap, Cell or module state.
 * replaceWorld/setSpatial/publish are the fixture lifecycle boundary. */
export class CreatureSpatial {
    private activeIndex?: Map<string, Creature[]>;
    private reservedIndex?: Map<string, Creature[]>;
    private users = 0;
    private revision = 0;
    private cohort: Creature[] = [];
    private readonly plans = new WeakSet<PlacementPlan>();
    private readonly stepPlans = new WeakMap<PlacementPlan, Readonly<Pos>>();
    private readonly rotationPlans = new WeakMap<PlacementPlan, QuarterTurns>();
    private readonly invalidate = () => { this.revision++; this.activeIndex = this.reservedIndex = undefined; };
    readonly groups: BodyGroupState[] = [];
    constructor(private world: SpatialWorld, readonly catalog = spatialCatalogFor(world.monsters.find(c => c.spatial) ?? {})) { this.replaceWorld(world); }
    replaceWorld(world: SpatialWorld): void {
        // Preflight before publishing ownership/listener/count changes.
        const ownership = [...(world.player ? [world.player] : []), ...world.monsters, ...(world.dormantMonsters ?? [])];
        const cohort = [...new Set(ownership)];
        if (cohort.length !== ownership.length) throw new SpatialValidationError('Multiple spatial ownership');
        let users = 0, occupiedCells = 0;
        const ids = new Set<number>();
        for (const c of cohort) {
            if (!integer(c.id, 1) || ids.has(c.id)) throw new SpatialValidationError('Duplicate or invalid spatial entity ID');
            ids.add(c.id);
            if (!integer(c.loc.x, -32768, 32767) || !integer(c.loc.y, -32768, 32767)) throw new SpatialValidationError('Invalid spatial anchor');
            if (c === world.player && Object.prototype.hasOwnProperty.call(c, 'spatial')) throw new SpatialValidationError('Player spatial capability is not open');
            if (Object.prototype.hasOwnProperty.call(c, 'spatial')) {
                if (this.catalog.fixture) validateSpatialComponent(c.spatial, this.catalog, false);
                else assertNativeSpatial(c, this.catalog);
                // Unresolved regions are never implicit permission to move.
                // Decode supplies a detached ledger; live grids share a resolver.
                if (c.spatial!.movementRegionId !== undefined && !footprintOf(c, this.catalog).every(at =>
                    world.inRegion?.(c.spatial!.movementRegionId!, at) ?? inMovementRegion(world.grid, c.spatial!.movementRegionId!, at))) {
                    throw new SpatialValidationError('Missing movement region or body outside bounds');
                }
                users++; occupiedCells += footprintOf(c, this.catalog).length;
            }
            if (footprintOf(c, this.catalog).some(p => !world.grid.isValidPos(p.x, p.y))) throw new SpatialValidationError('Spatial footprint outside its layer');
        }
        if (users > SPATIAL_LIMITS.entities || occupiedCells > SPATIAL_LIMITS.occupiedCells) throw new SpatialValidationError('Spatial layer budget exceeded');
        if (this.world.grid !== world.grid || (this.users > 0 && users === 0)) releaseSpatialTerrain(this);
        for (const c of this.cohort) listeners.get(c)?.delete(this.invalidate);
        this.world = world; this.cohort = cohort; this.users = users;
        for (const c of cohort) {
            if (c.spatial) bindSpatialCatalog(c, this.catalog);
            let ports = listeners.get(c); if (!ports) { ports = new Set(); listeners.set(c, ports); } ports.add(this.invalidate);
        }
        this.invalidate();
    }
    setSpatial(c: Creature, component?: CreatureSpatialComponent): void {
        if (!this.catalog.fixture) throw new SpatialValidationError('Spatial conversion capability is not open');
        if (component !== undefined) {
            validateSpatialComponent(component, this.catalog, false);
        }
        if (!this.cohort.includes(c)) throw new SpatialValidationError('Unowned spatial entity');
        const previous = c.spatial;
        if (component === undefined) delete c.spatial; else c.spatial = structuredClone(component);
        try { this.replaceWorld(this.world); } catch (error) {
            if (previous === undefined) delete c.spatial; else c.spatial = previous;
            this.replaceWorld(this.world); throw error;
        }
    }
    get hasIndex(): boolean { return this.activeIndex !== undefined; }
    dispose(): void {
        releaseSpatialTerrain(this);
        for (const c of this.cohort) listeners.get(c)?.delete(this.invalidate);
        this.invalidate(); // plans from the retired session cannot publish anchors
    }
    get capabilityUsers(): number { return this.users; }
    get grid(): Grid { return this.world.grid; }
    get occupancyRevision(): number { return this.revision; }
    get terrainRevision(): number { return spatialTerrainRevision(this.world.grid, this); }
    /** Trusted engine/fixture lookup. Never exposed through module contexts. */
    entityById(id: number): Creature | undefined { return this.cohort.find(c => c.id === id); }
    isActive(c: Creature): boolean { return c.hp > 0 && (c === this.world.player || this.world.monsters.includes(c)); }
    footprintOf(c: Creature): readonly FootprintCell[] { return footprintOf(c, this.catalog); }
    spatialOf(id: number | Creature): CreatureSpatialView {
        const c = typeof id === 'number' ? this.cohort.find(c => c.id === id) : id;
        if (!c) throw new SpatialValidationError('Unknown spatial entity');
        return deepFreeze({ entityId: c.id, groupId: c.spatial?.bodyMember?.groupId ?? c.id,
            partId: c.spatial?.bodyMember?.partId ?? null, anchor: { ...c.loc }, footprintId: c.spatial?.footprintId ?? 'builtin:single',
            pose: c.spatial?.pose ?? 'r0', cells: this.footprintOf(c) });
    }
    membersOf(groupId: number): readonly CreatureSpatialView[] {
        const group = this.groups.find(g => g.groupId === groupId);
        return Object.freeze(group ? group.members.filter(m => m.entityId !== null).map(m => this.spatialOf(m.entityId!)) : [this.spatialOf(groupId)]);
    }
    nearestContact(a: Creature, b: Creature) { return nearestContact(a, b, this.catalog); }
    private buildIndex(): void {
        if (!this.users || this.activeIndex) return;
        const active = new Map<string, Creature[]>(), reserved = new Map<string, Creature[]>();
        const add = (map: Map<string, Creature[]>, c: Creature) => {
            for (const p of this.footprintOf(c)) { const key = `${p.x},${p.y}`, list = map.get(key) ?? []; list.push(c); map.set(key, list); }
        };
        if (this.world.player) add(active, this.world.player);
        this.world.monsters.forEach(c => add(active, c)); this.world.dormantMonsters?.forEach(c => add(reserved, c));
        for (const list of active.values()) if (list.filter(c => c.hp > 0).length > 1) throw new SpatialValidationError('Overlapping active footprints');
        this.activeIndex = active; this.reservedIndex = reserved;
    }
    occupantsAtCell(at: Pos, policy: OccupancyPolicy = 'active'): readonly BodyTarget[] {
        this.buildIndex(); const key = `${at.x},${at.y}`;
        const active = this.activeIndex?.get(key) ?? (this.activeIndex ? [] : [...(this.world.player ? [this.world.player] : []), ...this.world.monsters].filter(c => footprintContains(c, at, this.catalog)));
        const reserved = policy === 'active-or-reserved' ? (this.reservedIndex?.get(key) ?? (this.reservedIndex ? [] : this.world.dormantMonsters?.filter(c => footprintContains(c, at, this.catalog)) ?? [])) : [];
        return Object.freeze([...active.filter(c => eligible(this.world, c, policy, false)), ...reserved.filter(c => eligible(this.world, c, policy, true))].map(c => this.target(c, at, 'part')));
    }
    creatureAtCell(at: Pos, policy: OccupancyPolicy = 'active'): Creature | undefined { return this.occupantsAtCell(at, policy)[0]?.entity; }
    private target(c: Creature, at: Pos, dedup: TargetKey): BodyTarget {
        const view = this.spatialOf(c), zoneId = view.cells.find(p => p.x === at.x && p.y === at.y)?.zoneId ?? 'body';
        const dedupKey = dedup === 'entity' ? `entity:${c.id}` : dedup === 'group' ? `group:${view.groupId}` : `part:${c.id}:${zoneId}`;
        // Freeze DTO without freezing the live Creature.
        return Object.freeze({ entity: c, entityId: c.id, groupId: view.groupId, partId: view.partId, zoneId, dedupKey, contact: Object.freeze({ ...at }) });
    }
    collectBodyTargets(cells: readonly Pos[], policy: { occupancy?: OccupancyPolicy; dedup?: TargetKey; effect?: EffectTargetCategory } = {}, scope = new Set<string>()): readonly BodyTarget[] {
        const dedup = policy.dedup ?? EFFECT_TARGET_POLICY[policy.effect ?? 'direct'];
        if (!['entity', 'part', 'group'].includes(dedup)) throw new SpatialValidationError('Invalid effect target policy');
        const out: BodyTarget[] = [];
        for (const at of cells) for (const hit of this.occupantsAtCell(at, policy.occupancy)) {
            const target = this.target(hit.entity, at, dedup);
            if (!scope.has(target.dedupKey)) { scope.add(target.dedupKey); out.push(target); }
        }
        return Object.freeze(out);
    }
    /** The same pure region predicate used by live fits and compiled graphs. */
    allowsRegionAt(c: Creature, at: Pos): boolean {
        const id = c.spatial?.movementRegionId;
        return id === undefined || (this.world.inRegion?.(id, at) ?? inMovementRegion(this.world.grid, id, at));
    }
    /** Static graph predicate: no index/occupancy reads; live steps also recheck occupancy. */
    canFitTerrainAt(c: Creature, at: Pos, options: FitOptions = {}, pose = c.spatial?.pose): boolean {
        const offsets = c.spatial ? this.catalog.cells(c.spatial.footprintId, pose!) : [{ x: 0, y: 0, zoneId: 'body' }];
        if (!integer(at.x, -32768, 32767) || !integer(at.y, -32768, 32767)) return false;
        for (const offset of offsets) {
            const p = { x: at.x + offset.x, y: at.y + offset.y };
            if (!this.world.grid.isValidPos(p.x, p.y) || !(options.allowsTerrain?.(p) ?? !(flagsAt(this.world.grid, p) & T_OBSTRUCTS_PASSABILITY))) return false;
            if (c.spatial?.movementRegionId !== undefined && !(options.inRegion?.(c.spatial.movementRegionId, p) ?? this.world.inRegion?.(c.spatial.movementRegionId, p)
                ?? inMovementRegion(this.world.grid, c.spatial.movementRegionId, p))) return false;
        }
        return true;
    }
    canFitAt(c: Creature, at: Pos, options: FitOptions = {}, pose = c.spatial?.pose): boolean {
        if (!this.canFitTerrainAt(c, at, options, pose)) return false;
        const offsets = c.spatial ? this.catalog.cells(c.spatial.footprintId, pose!) : [{ x: 0, y: 0 }];
        return offsets.every(p => !this.occupantsAtCell({ x: at.x + p.x, y: at.y + p.y }, options.policy ?? 'active-or-reserved')
            .some(hit => hit.entity !== c && !options.ignore?.has(hit.entity)));
    }
    canStepFootprint(c: Creature, at: Pos, options: FitOptions = {}): boolean {
        return this.canStepBetween(c, c.loc, at, options);
    }
    /** Hypothetical graph edge without temporarily moving a live entity. For
     * multi-cell bodies BOTH orthogonal intermediate anchors must fit, including
     * dynamic occupancy. The native single-cell diagonal flags remain unchanged. */
    canStepBetween(c: Creature, from: Pos, at: Pos, options: FitOptions = {}, pose = c.spatial?.pose): boolean {
        const dx = at.x - from.x, dy = at.y - from.y;
        if (this.footprintOf(c).length > 1) return conservativeSquareStep(from, at, p => this.canFitAt(c, p, options, pose));
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1 || !this.canFitAt(c, at, options, pose)) return false;
        if (dx && dy) {
            if ((flagsAt(this.world.grid, { x: from.x + dx, y: from.y }) | flagsAt(this.world.grid, { x: from.x, y: from.y + dy })) & T_OBSTRUCTS_DIAGONAL_MOVEMENT) return false;
        }
        return true;
    }
    /** Checked one-anchor square step in the native or fixture world. The
     * caller owns turn costs and environmental contact after its commit. */
    planStepPlacement(c: Creature, at: Pos, options: FitOptions = {}): PlacementPlan | null {
        squareMovementSize(c, this.catalog);
        if (!this.isActive(c)) return null;
        if (!this.canStepFootprint(c, at, options)) return null;
        const plan = this.planPlacement([{ creature: c, at }], options);
        if (plan) this.stepPlans.set(plan, Object.freeze({ ...c.loc }));
        return plan;
    }
    planRigidStepPlacement(c: Creature, at: Pos, options: FitOptions = {}): PlacementPlan | null {
        rigidMovementFootprint(c, this.catalog);
        if (!this.isActive(c) || !this.canStepFootprint(c, at, options)) return null;
        const plan = this.planPlacement([{ creature: c, at }], options);
        if (plan) this.stepPlans.set(plan, Object.freeze({ ...c.loc }));
        return plan;
    }
    /** Hypothetical rotation edge. No temporary pose/anchor changes, no contact
     * effects. Half turns validate BOTH quarter sweeps and intermediate fits. */
    canRotateBetween(c: Creature, at: Pos, from: RigidPose, turns: QuarterTurns, options: FitOptions = {}, terrainOnly = false): boolean {
        const shape = c.spatial?.bodyMember ? (assertNativeSpatial(c, this.catalog), rigidFootprint(this.catalog, c.spatial.footprintId)) : rigidMovementFootprint(c, this.catalog);
        const stages = rotationStages(from, turns);
        if (!shape.poses.includes(from)) return false;
        let previous = from;
        for (const pose of stages) {
            const sweep = shape.sweeps.get(`${previous}:${pose}`);
            if (!sweep || !(terrainOnly ? this.canFitTerrainAt(c, at, options, pose) : this.canFitAt(c, at, options, pose))) return false;
            for (const offset of sweep) {
                const p = { x: at.x + offset.x, y: at.y + offset.y };
                if (!this.world.grid.isValidPos(p.x, p.y) || !(options.allowsTerrain?.(p) ?? !(flagsAt(this.world.grid, p) & T_OBSTRUCTS_PASSABILITY))
                    || c.spatial?.movementRegionId !== undefined && !(options.inRegion?.(c.spatial.movementRegionId, p)
                        ?? this.world.inRegion?.(c.spatial.movementRegionId, p) ?? inMovementRegion(this.world.grid, c.spatial.movementRegionId, p))
                    || !terrainOnly && this.occupantsAtCell(p, options.policy ?? 'active-or-reserved')
                        .some(hit => hit.entity !== c && !options.ignore?.has(hit.entity))) return false;
            }
            previous = pose;
        }
        return true;
    }
    canRotateFootprint(c: Creature, turns: QuarterTurns, options: FitOptions = {}): boolean {
        return this.canRotateBetween(c, c.loc, c.spatial?.pose as RigidPose, turns, options);
    }
    planRotationPlacement(c: Creature, turns: QuarterTurns, options: FitOptions = {}): PlacementPlan | null {
        rigidMovementFootprint(c, this.catalog);
        const stages = rotationStages(c.spatial!.pose, turns);
        if (!this.isActive(c) || !Object.getOwnPropertyDescriptor(c.spatial, 'pose')?.writable
            || !integer(c.movementSpeed, 1, 1000000) || !this.canRotateFootprint(c, turns, options)) return null;
        const plan = this.preparePlacement([{ creature: c, at: c.loc, pose: stages[stages.length - 1]! }], options, c.movementSpeed * stages.length);
        if (plan) this.rotationPlans.set(plan, turns);
        return plan;
    }
    planPlacement(changes: readonly PlacementChange[], options: FitOptions = {}): PlacementPlan | null {
        return this.preparePlacement(changes, options);
    }
    private preparePlacement(changes: readonly PlacementChange[], options: FitOptions, actionCost?: number): PlacementPlan | null {
        if (changes.some(change => change.creature.spatial?.bodyMember)) throw new SpatialValidationError('Composite body action capability is not open in 4a0');
        if (options.ignore && [...options.ignore].some(c => !changes.some(change => change.creature === c))) return null;
        if (!changes.length || changes.some(p => !this.cohort.includes(p.creature) || ['x', 'y'].some(k => !Object.getOwnPropertyDescriptor(p.creature.loc, k)?.writable)) || new Set(changes.map(p => p.creature)).size !== changes.length) return null;
        const ignore = new Set([...(options.ignore ?? []), ...changes.map(p => p.creature)]), occupied = new Set<string>();
        for (const change of changes) {
            if (actionCost === undefined && change.pose !== undefined && change.pose !== change.creature.spatial?.pose) throw new SpatialValidationError('Rotation requires an explicit checked action plan');
            if (!this.canFitAt(change.creature, change.at, { ...options, ignore }, change.pose ?? change.creature.spatial?.pose)) return null;
            const cells = change.creature.spatial ? this.catalog.cells(change.creature.spatial.footprintId, change.pose ?? change.creature.spatial.pose) : [{ x: 0, y: 0 }];
            for (const p of cells) {
                const key = `${p.x + change.at.x},${p.y + change.at.y}`;
                if (occupied.has(key)) return null; occupied.add(key);
            }
        }
        const plan: PlacementPlan = Object.freeze({ changes: Object.freeze(changes.map(c => Object.freeze({ ...c, at: Object.freeze({ ...c.at }) }))),
            previous: Object.freeze(changes.map(({ creature }) => Object.freeze({ creature, loc: creature.loc, x: creature.x, y: creature.y, spatial: JSON.stringify(creature.spatial) }))),
            revision: this.revision, terrainRevision: this.terrainRevision, grid: this.world.grid, options: Object.freeze({ ...options, ignore: options.ignore ? new Set(options.ignore) : undefined }),
            ...(actionCost !== undefined ? { actionCost } : {}) });
        this.plans.add(plan); return plan;
    }
    commitPlacement(plan: PlacementPlan): boolean {
        const options = plan.options;
        if (!this.plans.delete(plan) || plan.revision !== this.revision || plan.grid !== this.world.grid || plan.terrainRevision !== this.terrainRevision
            || plan.previous.some(p => p.creature.loc !== p.loc || p.creature.x !== p.x || p.creature.y !== p.y || JSON.stringify(p.creature.spatial) !== p.spatial)) return false;
        const from = this.stepPlans.get(plan);
        if (from && (!this.isActive(plan.changes[0]!.creature)
            || !this.canStepBetween(plan.changes[0]!.creature, from, plan.changes[0]!.at, options))) return false;
        const turns = this.rotationPlans.get(plan);
        if (plan.actionCost !== undefined && turns === undefined) return false;
        if (turns !== undefined) {
            const actor = plan.changes[0]!.creature;
            if (!this.isActive(actor) || !Object.getOwnPropertyDescriptor(actor.spatial, 'pose')?.writable
                || plan.actionCost !== actor.movementSpeed * Math.abs(turns) || !this.canRotateFootprint(actor, turns, options)) return false;
        }
        const recheck = this.preparePlacement(plan.changes, options, plan.actionCost);
        if (!recheck) return false;
        this.plans.delete(recheck);
        for (const c of plan.changes) {
            if (turns !== undefined) c.creature.spatial!.pose = c.pose!;
            commitCreatureAnchor(c.creature, { ...c.at }, 'mutate', this.catalog.fixture);
        }
        return true;
    }
    /** Decode definitions against an independently initialized native catalog;
     * the snapshot is NEVER permission to install unknown module/fixture data. */
    snapshotWorld(): SpatialWorldSnapshot | undefined {
        if (!this.users && !this.groups.length) return undefined;
        return structuredClone({ schema: 1, definitions: this.catalog.definitionClosure(this.cohort.flatMap(c => c.spatial ? [c.spatial.footprintId] : []), this.groups.map(g => g.bodyDefinitionId)), groups: this.groups });
    }
    restoreWorld(snapshot: SpatialWorldSnapshot): void {
        keys(snapshot, ['schema', 'definitions', 'groups']); keys(snapshot.definitions, ['footprints', 'bodies', 'forms', 'breakRules', 'statusProfiles', 'attackProfiles'], ['footprints', 'bodies']);
        if ((!this.catalog.fixture && !this.catalog.hasBodies) || snapshot.schema !== 1 || !Array.isArray(snapshot.groups) || snapshot.groups.length > SPATIAL_LIMITS.entities
            || !Array.isArray(snapshot.definitions.footprints) || !Array.isArray(snapshot.definitions.bodies)
            || ['forms', 'breakRules', 'statusProfiles', 'attackProfiles'].some(k => (snapshot.definitions as any)[k] !== undefined && !Array.isArray((snapshot.definitions as any)[k]))) throw new SpatialValidationError('Unopened spatial world');
        const canonical = (v: unknown): string => JSON.stringify(v, (_k, value) => value && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
        const defs = snapshot.definitions;
        if (new Set(defs.footprints.map(d => d.id)).size !== defs.footprints.length || new Set(defs.bodies.map(d => d.id)).size !== defs.bodies.length
            || defs.footprints.some(d => canonical(d) !== canonical(this.catalog.definition(d.id))) || defs.bodies.some(d => canonical(d) !== canonical(this.catalog.body(d.id)))
            || new Set((defs.forms ?? []).map(d => d.id)).size !== (defs.forms ?? []).length || (defs.forms ?? []).some(d => canonical(d) !== canonical(this.catalog.form(d.id)))) throw new SpatialValidationError('Spatial definition identity mismatch');
        const used = new Set<number>(), groups = new Set<number>();
        for (const group of snapshot.groups) {
            keys(group, ['schema', 'groupId', 'coreId', 'bodyDefinitionId', 'members', 'appliedBreaks']);
            const def = this.catalog.body(group.bodyDefinitionId);
            if (!this.catalog.fixture) validateBodyGroup(group, this.catalog, id => this.entityById(id));
            if (group.schema !== 1 || !integer(group.groupId, 1) || group.coreId !== group.groupId || groups.has(group.groupId)
                || !Array.isArray(group.members) || group.members.length !== def.parts.length || !Array.isArray(group.appliedBreaks) || this.catalog.fixture && group.appliedBreaks.length) throw new SpatialValidationError('Invalid body group');
            groups.add(group.groupId); const parts = new Set<string>();
            for (const m of group.members) {
                keys(m, ['partId', 'entityId', 'life', 'generation', 'readyInTicks', 'regenerateInTicks'], ['partId', 'entityId', 'life', 'generation', 'readyInTicks']);
                const part = def.parts.find(p => p.partId === m.partId), c = this.cohort.find(c => c.id === m.entityId);
                if (!part || parts.has(m.partId) || !integer(m.generation) || !integer(m.readyInTicks, 0, 1000000) || m.regenerateInTicks !== undefined
                    || !['active', 'broken', 'removed'].includes(m.life) || (m.entityId === null && m.life !== 'removed')) throw new SpatialValidationError('Invalid body slot');
                parts.add(m.partId);
                if (m.entityId !== null) {
                    if (!integer(m.entityId, 1) || used.has(m.entityId) || !c || c === this.world.player || c.spatial?.bodyMember?.groupId !== group.groupId
                        || c.spatial.bodyMember.partId !== m.partId || c.spatial.footprintId !== this.catalog.form(part.formId).footprintId || (part.role === 'core' && m.entityId !== group.coreId)) throw new SpatialValidationError('Invalid member reference');
                    used.add(m.entityId);
                    const core = this.cohort.find(c => c.id === group.coreId);
                    if (!core || this.world.monsters.includes(c) !== this.world.monsters.includes(core)
                        || (this.world.dormantMonsters?.includes(c) ?? false) !== (this.world.dormantMonsters?.includes(core) ?? false)) throw new SpatialValidationError('Split group ownership');
                } else if (part.role === 'core') throw new SpatialValidationError('Missing core');
            }
            const poses = new Map<string, BodyPose>(group.members.flatMap(m => {
                const c = this.cohort.find(c => c.id === m.entityId);
                return c ? [[m.partId, { anchor: c.loc, footprintId: c.spatial!.footprintId, pose: c.spatial!.pose }] as const] : [];
            }));
            if (!bodyConstraintsSatisfied(this.catalog, def, poses, this.world.grid)) throw new SpatialValidationError('Invalid body constraints');
        }
        if (this.cohort.some(c => c.spatial?.bodyMember && !used.has(c.id))) throw new SpatialValidationError('Orphan body member');
        const expected = this.catalog.definitionClosure(this.cohort.flatMap(c => c.spatial ? [c.spatial.footprintId] : []), snapshot.groups.map(g => g.bodyDefinitionId));
        if (canonical(expected) !== canonical(defs)) throw new SpatialValidationError('Invalid spatial definition closure');
        this.invalidate(); this.buildIndex(); // validate overlap before publishing mechanical groups
        this.groups.splice(0, this.groups.length, ...structuredClone(snapshot.groups));
    }
}

export function spatialOf(c: Creature, catalog = spatialCatalogFor(c)): CreatureSpatialView {
    return deepFreeze({ entityId: c.id, groupId: c.spatial?.bodyMember?.groupId ?? c.id,
        partId: c.spatial?.bodyMember?.partId ?? null, anchor: { ...c.loc }, footprintId: c.spatial?.footprintId ?? 'builtin:single',
        pose: c.spatial?.pose ?? 'r0', cells: footprintOf(c, catalog) });
}
export function footprintSome(c: FootprintActor, predicate: (p: Readonly<Pos>) => boolean): boolean {
    return c.spatial ? footprintOf(c).some(predicate) : predicate(c.loc);
}
export function footprintEvery(c: FootprintActor, predicate: (p: Readonly<Pos>) => boolean): boolean {
    return c.spatial ? footprintOf(c).every(predicate) : predicate(c.loc);
}
export function canFitAt(world: SpatialWorld, c: Creature, at: Pos, options: FitOptions = {}): boolean {
    assertNativeSpatial(c);
    if (c.spatial) {
        if (!integer(at.x, -32768, 32767) || !integer(at.y, -32768, 32767)) return false;
        const ignore = new Set([c, ...(options.ignore ?? [])]);
        return spatialCatalogFor(c).cells(c.spatial.footprintId, c.spatial.pose).every(o => {
            const p = { x: at.x + o.x, y: at.y + o.y };
            return world.grid.isValidPos(p.x, p.y)
                && (c.spatial!.movementRegionId === undefined || (options.inRegion?.(c.spatial!.movementRegionId, p) ?? world.inRegion?.(c.spatial!.movementRegionId, p)
                    ?? inMovementRegion(world.grid, c.spatial!.movementRegionId, p)))
                && (options.allowsTerrain?.(p) ?? !(flagsAt(world.grid, p) & T_OBSTRUCTS_PASSABILITY))
                && !creatureAtCell(world, p, options.policy ?? 'active-or-reserved', ignore);
        });
    }
    return integer(at.x, -32768, 32767) && integer(at.y, -32768, 32767) && world.grid.isValidPos(at.x, at.y)
        && (options.allowsTerrain?.(at) ?? !(flagsAt(world.grid, at) & T_OBSTRUCTS_PASSABILITY))
        && !creatureAtCell(world, at, options.policy ?? 'active-or-reserved', new Set([c, ...(options.ignore ?? [])]));
}
export function canStepFootprint(world: SpatialWorld, c: Creature, at: Pos, options: FitOptions = {}): boolean {
    if (c.spatial) return conservativeSquareStep(c.loc, at, p => canFitAt(world, c, p, options));
    const dx = at.x - c.x, dy = at.y - c.y;
    return Math.max(Math.abs(dx), Math.abs(dy)) === 1 && canFitAt(world, c, at, options)
        && (!(dx && dy) || !((flagsAt(world.grid, { x: c.x + dx, y: c.y }) | flagsAt(world.grid, { x: c.x, y: c.y + dy })) & T_OBSTRUCTS_DIAGONAL_MOVEMENT));
}
export function collectBodyTargets(world: SpatialWorld, cells: readonly Pos[], policy: { occupancy?: OccupancyPolicy; dedup?: TargetKey; effect?: EffectTargetCategory; statusId?: import('../../entities/Creature').StatusId } = {}, scope = new Set<string>()): readonly BodyTarget[] {
    const dedup = policy.dedup ?? EFFECT_TARGET_POLICY[policy.effect ?? 'direct'];
    if (!['entity', 'part', 'group'].includes(dedup)) throw new SpatialValidationError('Invalid effect target policy');
    const out: BodyTarget[] = [];
    for (const at of cells) {
        const c = creatureAtCell(world, at, policy.occupancy); if (!c) continue;
        assertNativeSpatial(c); const groupId = c.spatial?.bodyMember?.groupId ?? c.id, zoneId = footprintOf(c).find(p => p.x === at.x && p.y === at.y)?.zoneId ?? 'body';
        const statusOwner = policy.statusId ? bodyStatusOwner(c,policy.statusId) : undefined;
        const dedupKey = statusOwner ? `status:${policy.statusId}:${statusOwner.id}`
            : dedup === 'entity' ? `entity:${c.id}` : dedup === 'group' ? `group:${groupId}` : `part:${c.id}:${zoneId}`;
        if (!scope.has(dedupKey)) { scope.add(dedupKey); out.push(Object.freeze({ entity: c, entityId: c.id, groupId, partId: c.spatial?.bodyMember?.partId ?? null, zoneId, dedupKey, contact: Object.freeze({ ...at }) })); }
    }
    return Object.freeze(out);
}

/** Explicit native 1x1 physical contact port. 4a0 does not advertise multi-cell
 * environmental reducers/path maps; those callers reject a component before
 * reading a single contact, rather than silently treating its anchor as a body. */
export function nativeContactOf(c: Creature): Readonly<Pos> {
    if (c.spatial) throw new SpatialValidationError('Single-cell contact cannot reduce a square body');
    assertNativeSpatial(c); return c.loc;
}
