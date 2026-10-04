import { spatialTerrainRevision } from './SpatialRevision';
import type { Creature } from '../../entities/Creature';
import type { Pos } from '../../types';
import type { Grid } from '../Map/Grid';
import { T_OBSTRUCTS_PASSABILITY, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from '../Map/TerrainCatalog';
import { TERRAIN_FLAGS } from '../Map/TerrainCatalog';
import { nativeSpatialCatalog, validateSpatialComponent, SpatialValidationError,
    deepFreeze, integer, keys, SPATIAL_LIMITS, type CreatureSpatialComponent, type CreatureSpatialView,
    type FootprintCell, type BodyGroupState, type SpatialWorldSnapshot } from './SpatialSchema';

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
}
export interface BodyTarget {
    readonly entity: Creature; readonly entityId: number; readonly groupId: number;
    readonly partId: string | null; readonly zoneId: string; readonly dedupKey: string; readonly contact: Readonly<Pos>;
}
export type FootprintActor = Pick<Creature, 'loc' | 'spatial'>;
const listeners = new WeakMap<Creature, Set<() => void>>();
/** The only anchor publication primitive. Existing callers own their CE
 * destination policy and contact ordering. mode preserves their old reference
 * semantics. Unpublished construction/restore is deliberately separate from
 * a checked live placement. Native paths reject all unopened components. */
export function commitCreatureAnchor(creature: Creature, at: Pos, mode: 'replace' | 'mutate' = 'replace', fixture = false): void {
    if (!integer(at.x, -32768, 32767) || !integer(at.y, -32768, 32767)) throw new SpatialValidationError('Invalid creature anchor');
    if (!fixture) assertNativeSpatial(creature);
    if (mode === 'mutate') { creature.loc.x = at.x; creature.loc.y = at.y; }
    else creature.loc = at;
    listeners.get(creature)?.forEach(invalidate => invalidate());
}
export function assertNativeSpatial(creature: Creature): void {
    if (Object.prototype.hasOwnProperty.call(creature, 'spatial')) validateSpatialComponent(creature.spatial);
}
/** Ordinary 1x1 queries retain the old constant geometry path, without a
 * compiled shape lookup, index, group record or scan for capability users. */
export function footprintOf(creature: FootprintActor, catalog = nativeSpatialCatalog): readonly FootprintCell[] {
    if (!creature.spatial) return [{ x: creature.loc.x, y: creature.loc.y, zoneId: 'body' }];
    return catalog.cells(creature.spatial.footprintId, creature.spatial.pose).map(p => ({ x: p.x + creature.loc.x, y: p.y + creature.loc.y, zoneId: p.zoneId }));
}
export function footprintContains(creature: FootprintActor, at: Pos, catalog = nativeSpatialCatalog): boolean {
    if (!creature.spatial) return creature.loc.x === at.x && creature.loc.y === at.y;
    return catalog.cells(creature.spatial.footprintId, creature.spatial.pose).some(p => p.x + creature.loc.x === at.x && p.y + creature.loc.y === at.y);
}
export function distanceBetweenFootprints(a: FootprintActor, b: FootprintActor, catalog = nativeSpatialCatalog): number {
    if (!a.spatial && !b.spatial) return Math.max(Math.abs(a.loc.x - b.loc.x), Math.abs(a.loc.y - b.loc.y));
    return nearestContact(a, b, catalog).distance;
}
export function distanceToFootprint(creature: FootprintActor, at: Pos, catalog = nativeSpatialCatalog): number {
    if (!creature.spatial) return Math.max(Math.abs(creature.loc.x - at.x), Math.abs(creature.loc.y - at.y));
    return Math.min(...footprintOf(creature, catalog).map(p => Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y))));
}
export function nearestContact(a: FootprintActor, b: FootprintActor, catalog = nativeSpatialCatalog): Readonly<{ from: FootprintCell; to: FootprintCell; distance: number }> {
    let result: { from: FootprintCell; to: FootprintCell; distance: number } | undefined;
    for (const from of footprintOf(a, catalog)) for (const to of footprintOf(b, catalog)) {
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
    private readonly invalidate = () => { this.revision++; this.activeIndex = this.reservedIndex = undefined; };
    readonly groups: BodyGroupState[] = [];
    constructor(private world: SpatialWorld, readonly catalog = nativeSpatialCatalog) { this.replaceWorld(world); }
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
                validateSpatialComponent(c.spatial, this.catalog, !this.catalog.fixture);
                // Region geometry remains extension-owned. Native fixtures do
                // not have a region resolver; never accept a dangling reference.
                if (c.spatial.movementRegionId !== undefined) throw new SpatialValidationError('Spatial region capability is not open in native fixtures');
                users++; occupiedCells += footprintOf(c, this.catalog).length;
            }
            if (footprintOf(c, this.catalog).some(p => !world.grid.isValidPos(p.x, p.y))) throw new SpatialValidationError('Spatial footprint outside its layer');
        }
        if (users > SPATIAL_LIMITS.entities || occupiedCells > SPATIAL_LIMITS.occupiedCells) throw new SpatialValidationError('Spatial layer budget exceeded');
        for (const c of this.cohort) listeners.get(c)?.delete(this.invalidate);
        this.world = world; this.cohort = cohort; this.users = users;
        for (const c of cohort) {
            let ports = listeners.get(c); if (!ports) { ports = new Set(); listeners.set(c, ports); } ports.add(this.invalidate);
        }
        this.invalidate();
    }
    setSpatial(c: Creature, component?: CreatureSpatialComponent): void {
        if (component !== undefined) validateSpatialComponent(component, this.catalog, !this.catalog.fixture);
        if (!this.cohort.includes(c)) throw new SpatialValidationError('Unowned spatial entity');
        const previous = c.spatial;
        if (component === undefined) delete c.spatial; else c.spatial = structuredClone(component);
        try { this.replaceWorld(this.world); } catch (error) {
            if (previous === undefined) delete c.spatial; else c.spatial = previous;
            this.replaceWorld(this.world); throw error;
        }
    }
    get hasIndex(): boolean { return this.activeIndex !== undefined; }
    get capabilityUsers(): number { return this.users; }
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
    canFitAt(c: Creature, at: Pos, options: FitOptions = {}, pose = c.spatial?.pose): boolean {
        const offsets = c.spatial ? this.catalog.cells(c.spatial.footprintId, pose!) : [{ x: 0, y: 0, zoneId: 'body' }];
        if (!integer(at.x, -32768, 32767) || !integer(at.y, -32768, 32767)) return false;
        for (const offset of offsets) {
            const p = { x: at.x + offset.x, y: at.y + offset.y };
            if (!this.world.grid.isValidPos(p.x, p.y) || !(options.allowsTerrain?.(p) ?? !(flagsAt(this.world.grid, p) & T_OBSTRUCTS_PASSABILITY))) return false;
            if (c.spatial?.movementRegionId !== undefined && !options.inRegion?.(c.spatial.movementRegionId, p)) return false;
            if (this.occupantsAtCell(p, options.policy ?? 'active-or-reserved').some(hit => hit.entity !== c && !options.ignore?.has(hit.entity))) return false;
        }
        return true;
    }
    canStepFootprint(c: Creature, at: Pos, options: FitOptions = {}): boolean {
        const dx = at.x - c.x, dy = at.y - c.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1 || !this.canFitAt(c, at, options)) return false;
        if (dx && dy) for (const p of this.footprintOf(c)) {
            if ((flagsAt(this.world.grid, { x: p.x + dx, y: p.y }) | flagsAt(this.world.grid, { x: p.x, y: p.y + dy })) & T_OBSTRUCTS_DIAGONAL_MOVEMENT) return false;
        }
        return true;
    }
    planPlacement(changes: readonly PlacementChange[], options: FitOptions = {}): PlacementPlan | null {
        if (changes.some(change => change.creature.spatial?.bodyMember)) throw new SpatialValidationError('Composite body action capability is not open in 4a0');
        if (options.ignore && [...options.ignore].some(c => !changes.some(change => change.creature === c))) return null;
        if (!changes.length || changes.some(p => !this.cohort.includes(p.creature) || ['x', 'y'].some(k => !Object.getOwnPropertyDescriptor(p.creature.loc, k)?.writable)) || new Set(changes.map(p => p.creature)).size !== changes.length) return null;
        const ignore = new Set([...(options.ignore ?? []), ...changes.map(p => p.creature)]), occupied = new Set<string>();
        for (const change of changes) {
            if (change.pose !== undefined && change.pose !== change.creature.spatial?.pose) throw new SpatialValidationError('Rotation action capability is not open in 4a0');
            if (!this.canFitAt(change.creature, change.at, { ...options, ignore })) return null;
            for (const p of this.footprintOf(change.creature)) {
                const key = `${p.x + change.at.x - change.creature.x},${p.y + change.at.y - change.creature.y}`;
                if (occupied.has(key)) return null; occupied.add(key);
            }
        }
        const plan: PlacementPlan = Object.freeze({ changes: Object.freeze(changes.map(c => Object.freeze({ ...c, at: Object.freeze({ ...c.at }) }))),
            previous: Object.freeze(changes.map(({ creature }) => Object.freeze({ creature, loc: creature.loc, x: creature.x, y: creature.y, spatial: JSON.stringify(creature.spatial) }))),
            revision: this.revision, terrainRevision: spatialTerrainRevision(this.world.grid), grid: this.world.grid, options: Object.freeze({ ...options, ignore: options.ignore ? new Set(options.ignore) : undefined }) });
        this.plans.add(plan); return plan;
    }
    commitPlacement(plan: PlacementPlan): boolean {
        const options = plan.options;
        if (!this.plans.delete(plan) || plan.revision !== this.revision || plan.grid !== this.world.grid || plan.terrainRevision !== spatialTerrainRevision(this.world.grid)
            || plan.previous.some(p => p.creature.loc !== p.loc || p.creature.x !== p.x || p.creature.y !== p.y || JSON.stringify(p.creature.spatial) !== p.spatial)) return false;
        const recheck = this.planPlacement(plan.changes, options);
        if (!recheck) return false;
        this.plans.delete(recheck);
        for (const c of plan.changes) commitCreatureAnchor(c.creature, { ...c.at }, 'mutate', this.catalog.fixture);
        return true;
    }
    /** Decode definitions against an independently initialized native catalog;
     * the snapshot is NEVER permission to install unknown module/fixture data. */
    snapshotWorld(): SpatialWorldSnapshot | undefined {
        if (!this.users && !this.groups.length) return undefined;
        return structuredClone({ schema: 1, definitions: this.catalog.definitionClosure(this.cohort.flatMap(c => c.spatial ? [c.spatial.footprintId] : []), this.groups.map(g => g.bodyDefinitionId)), groups: this.groups });
    }
    restoreWorld(snapshot: SpatialWorldSnapshot): void {
        keys(snapshot, ['schema', 'definitions', 'groups']); keys(snapshot.definitions, ['footprints', 'bodies', 'forms', 'breakRules', 'statusProfiles'], ['footprints', 'bodies']);
        if (!this.catalog.fixture || snapshot.schema !== 1 || !Array.isArray(snapshot.groups) || snapshot.groups.length > SPATIAL_LIMITS.entities
            || !Array.isArray(snapshot.definitions.footprints) || !Array.isArray(snapshot.definitions.bodies)
            || ['forms', 'breakRules', 'statusProfiles'].some(k => (snapshot.definitions as any)[k] !== undefined && !Array.isArray((snapshot.definitions as any)[k]))) throw new SpatialValidationError('Unopened spatial world');
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
            if (group.schema !== 1 || !integer(group.groupId, 1) || group.coreId !== group.groupId || groups.has(group.groupId)
                || !Array.isArray(group.members) || group.members.length !== def.parts.length || !Array.isArray(group.appliedBreaks) || group.appliedBreaks.length) throw new SpatialValidationError('Invalid body group');
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
        }
        if (this.cohort.some(c => c.spatial?.bodyMember && !used.has(c.id))) throw new SpatialValidationError('Orphan body member');
        const expected = this.catalog.definitionClosure(this.cohort.flatMap(c => c.spatial ? [c.spatial.footprintId] : []), snapshot.groups.map(g => g.bodyDefinitionId));
        if (canonical(expected) !== canonical(defs)) throw new SpatialValidationError('Invalid spatial definition closure');
        this.invalidate(); this.buildIndex(); // validate overlap before publishing mechanical groups
        this.groups.splice(0, this.groups.length, ...structuredClone(snapshot.groups));
    }
}

export function spatialOf(c: Creature, catalog = nativeSpatialCatalog): CreatureSpatialView {
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
    return integer(at.x, -32768, 32767) && integer(at.y, -32768, 32767) && world.grid.isValidPos(at.x, at.y)
        && (options.allowsTerrain?.(at) ?? !(flagsAt(world.grid, at) & T_OBSTRUCTS_PASSABILITY))
        && !creatureAtCell(world, at, options.policy ?? 'active-or-reserved', new Set([c, ...(options.ignore ?? [])]));
}
export function canStepFootprint(world: SpatialWorld, c: Creature, at: Pos, options: FitOptions = {}): boolean {
    const dx = at.x - c.x, dy = at.y - c.y;
    return Math.max(Math.abs(dx), Math.abs(dy)) === 1 && canFitAt(world, c, at, options)
        && (!(dx && dy) || !((flagsAt(world.grid, { x: c.x + dx, y: c.y }) | flagsAt(world.grid, { x: c.x, y: c.y + dy })) & T_OBSTRUCTS_DIAGONAL_MOVEMENT));
}
export function collectBodyTargets(world: SpatialWorld, cells: readonly Pos[], policy: { occupancy?: OccupancyPolicy; dedup?: TargetKey; effect?: EffectTargetCategory } = {}, scope = new Set<string>()): readonly BodyTarget[] {
    const dedup = policy.dedup ?? EFFECT_TARGET_POLICY[policy.effect ?? 'direct'];
    if (!['entity', 'part', 'group'].includes(dedup)) throw new SpatialValidationError('Invalid effect target policy');
    const out: BodyTarget[] = [];
    for (const at of cells) {
        const c = creatureAtCell(world, at, policy.occupancy); if (!c) continue;
        assertNativeSpatial(c); const groupId = c.id, zoneId = 'body';
        const dedupKey = dedup === 'entity' ? `entity:${c.id}` : dedup === 'group' ? `group:${groupId}` : `part:${c.id}:${zoneId}`;
        if (!scope.has(dedupKey)) { scope.add(dedupKey); out.push(Object.freeze({ entity: c, entityId: c.id, groupId, partId: null, zoneId, dedupKey, contact: Object.freeze({ ...at }) })); }
    }
    return Object.freeze(out);
}

/** Explicit native 1x1 physical contact port. 4a0 does not advertise multi-cell
 * environmental reducers/path maps; those callers reject a component before
 * reading a single contact, rather than silently treating its anchor as a body. */
export function nativeContactOf(c: Creature): Readonly<Pos> { assertNativeSpatial(c); return c.loc; }
