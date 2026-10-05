import { bodyStatusDisables } from '../Status/BodyStatuses';
import type { Creature } from '../../entities/Creature';
import type { Pos } from '../../types';
import { bodyConstraintOrder, bodyConstraintsSatisfied, type BodyPose } from './BodyConstraints';
import { trajectoriesCollide, trajectoryConstraintSatisfied, type BodyTrajectory } from './BodyTrajectory';
import { actorSourceRevision, commitCompositeAnchors, conservativeSquareStep, type CreatureSpatial, type FitOptions } from './CreatureSpatial';
import { deepFreeze, integer, keys, SpatialValidationError, type BodyDefinition, type BodyGroupState } from './SpatialSchema';
import { bodyMoveTicks, validateBodyGroup } from './BodyGroups';

export const COMPOSITE_MOVEMENT_LIMITS = Object.freeze({ candidates: 32, branchNodes: 128, memberStep: 2 });
export interface CompositeMovementOptions {
    /** Trusted engine predicates; no arbitrary ignored outsiders or target UI. */
    allowsTerrain?: (entityId: number, at: Readonly<Pos>) => boolean;
    /** Native far movement keeps feet near the declaration rather than dragging
     * stationary feet to the tether limit; diagnostic legacy ties stay stable. */
    preferFormation?: boolean;
    inRegion?: (regionId: number, at: Readonly<Pos>) => boolean;
    /** A lower diagnostic budget is allowed; the production ceiling is fixed. */
    branchBudget?: number;
    /** Trusted native magical displacement, not a voluntary status escape. */
    forced?: boolean;
}
export interface CompositeMovePlan {
    readonly groupId: number;
    readonly costTicks: number;
    readonly branchNodes: number;
    readonly trajectories: readonly (Readonly<BodyTrajectory> & { readonly entityId: number; readonly partId: string })[];
}
export type CompositeMoveResult = { readonly status: 'planned'; readonly plan: CompositeMovePlan }
    | { readonly status: 'blocked'; readonly reason: 'immobile' | 'terrain' | 'constraints' | 'budget'; readonly costTicks: number; readonly branchNodes: number };
interface Cohort {
    group: BodyGroupState; definition: BodyDefinition; order: readonly string[];
    actors: Map<string, Creature>; ignore: ReadonlySet<Creature>;
}
interface PlanBinding {
    cohort: Cohort; fingerprint: string; revision: number; terrainRevision: number;
    locations: Map<Creature, Pos>; options: CompositeMovementOptions;
}
const same = (a: Readonly<Pos>, b: Readonly<Pos>) => a.x === b.x && a.y === b.y;
const distance = (a: Readonly<Pos>, b: Readonly<Pos>) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Bounded 4d planner. Production requires an installed body declaration and
 * a validated live group; legacy 4d-0 fixtures keep their active-only contract.
 * Identity remains in the supplied CreatureSpatial.groups;
 * this planner owns only single-use, derived plans, never HP or group clocks.
 *
 * Planning chooses the core step first. Physical paths share two bounded unit
 * substeps (a shorter path then stays still). Constraints and collisions are
 * checked throughout each substep, allowing ordinary follow-the-parent motion
 * without teleporting a member or checking only a final arrangement. */
export class CompositeMovement {
    private readonly plans = new WeakMap<CompositeMovePlan, PlanBinding>();
    constructor(readonly spatial: CreatureSpatial) {
        if (!spatial.catalog.fixture && !spatial.catalog.hasBodies) throw new SpatialValidationError('Composite movement production capability is not open');
    }
    private cohort(groupId: number): Cohort {
        const group = this.spatial.groups.find(g => g.groupId === groupId);
        if (!group) throw new SpatialValidationError('Unknown composite group');
        keys(group, ['schema', 'groupId', 'coreId', 'bodyDefinitionId', 'members', 'appliedBreaks']);
        const definition = this.spatial.catalog.body(group.bodyDefinitionId);
        const order = bodyConstraintOrder(definition).filter(id => group.members.some(s => s.partId === id && s.life === 'active'));
        if (!this.spatial.catalog.fixture) validateBodyGroup(group, this.spatial.catalog, id => this.spatial.entityById(id));
        if (group.schema !== 1 || !integer(groupId, 1) || group.coreId !== groupId || !Array.isArray(group.members)
            || group.members.length !== definition.parts.length || !Array.isArray(group.appliedBreaks) || this.spatial.catalog.fixture && group.appliedBreaks.length
            || definition.noSupport !== 'immobile' || definition.coreDeath !== 'remove-members'
            || definition.constraints.some(c => c.maxStepPerAction > COMPOSITE_MOVEMENT_LIMITS.memberStep)) {
            throw new SpatialValidationError('Unopened composite movement lifecycle or step budget');
        }
        const actors = new Map<string, Creature>();
        for (const slot of group.members) {
            if (!this.spatial.catalog.fixture && slot.life === 'removed') continue;
            keys(slot, ['partId', 'entityId', 'life', 'generation', 'readyInTicks']);
            const part = definition.parts.find(p => p.partId === slot.partId), actor = slot.entityId === null ? undefined : this.spatial.entityById(slot.entityId);
            if (!part || actors.has(slot.partId) || slot.life !== 'active' || slot.generation !== 0 || !integer(slot.readyInTicks, 0, 1000000)
                || !actor || !this.spatial.isActive(actor) || actor.spatial?.bodyMember?.groupId !== groupId
                || actor.spatial.bodyMember.partId !== slot.partId || actor.spatial.footprintId !== this.spatial.catalog.form(part.formId).footprintId
                || part.role === 'core' && actor.id !== groupId || actor.spatial.pose.startsWith('m')) {
                throw new SpatialValidationError('Invalid or unopened moving body member');
            }
            // A fixture may not borrow a member from another table or reserve a
            // hidden duplicate entity. Production tombstones have no actor.
            if (this.spatial.groups.some(g => g !== group && g.members.some(m => m.entityId === actor.id))) throw new SpatialValidationError('Shared composite member');
            actors.set(slot.partId, actor);
        }
        if (new Set(actors.values()).size !== actors.size) throw new SpatialValidationError('Duplicate composite entity');
        const poses = new Map<string, BodyPose>([...actors].map(([partId, c]) => [partId, { anchor: c.loc, footprintId: c.spatial!.footprintId, pose: c.spatial!.pose }]));
        if (!bodyConstraintsSatisfied(this.spatial.catalog, definition, poses, this.spatial.grid)) throw new SpatialValidationError('Invalid initial body constraints');
        // Index validation also catches unrelated active overlaps. The planner
        // cannot silently repair an invalid published world.
        for (const actor of actors.values()) for (const cell of this.spatial.footprintOf(actor)) {
            if (this.spatial.occupantsAtCell(cell, 'active-or-reserved').some(hit => hit.entity !== actor)) throw new SpatialValidationError('Overlapping composite member');
        }
        return { group, definition, order, actors, ignore: new Set(actors.values()) };
    }
    private options(actor: Creature, cohort: Cohort, options: CompositeMovementOptions): FitOptions {
        return { ignore: cohort.ignore, policy: 'active-or-reserved',
            ...(options.allowsTerrain ? { allowsTerrain: (at: Pos) => options.allowsTerrain!(actor.id, at) } : {}),
            ...(options.inRegion ? { inRegion: options.inRegion } : {}) };
    }
    private canStep(actor: Creature, from: Readonly<Pos>, to: Readonly<Pos>, cohort: Cohort, options: CompositeMovementOptions): boolean {
        // Conservatively sweep translations of all member shapes, including
        // 1x1 legs. The two orthogonal anchors check diagonal terrain/outsiders.
        return conservativeSquareStep(from, to, at => this.spatial.canFitAt(actor, at, this.options(actor, cohort, options)));
    }
    private trajectory(actor: Creature, path: readonly Readonly<Pos>[]): BodyTrajectory {
        return { anchor: path[0]!, footprintId: actor.spatial!.footprintId, pose: actor.spatial!.pose, path };
    }
    private compatible(partId: string, candidate: BodyTrajectory, assigned: ReadonlyMap<string, BodyTrajectory>, cohort: Cohort): boolean {
        for (const other of assigned.values()) if (trajectoriesCollide(this.spatial.catalog, candidate, other)) return false;
        const constraint = cohort.definition.constraints.find(c => c.childPartId === partId);
        return !constraint || !!assigned.get(constraint.parentPartId)
            && trajectoryConstraintSatisfied(this.spatial.catalog, constraint, assigned.get(constraint.parentPartId)!, candidate, this.spatial.grid);
    }
    private candidates(partId: string, coreAt: Readonly<Pos>, cohort: Cohort, options: CompositeMovementOptions): readonly BodyTrajectory[] {
        const actor = cohort.actors.get(partId)!, constraint = cohort.definition.constraints.find(c => c.childPartId === partId)!;
        const paths: Readonly<Pos>[][] = [[{ ...actor.loc }]];
        if (options.forced || !(actor.spatial!.actionLockInTicks || actor.hasStatus('stuck') || actor.hasStatus('paralyzed') || bodyStatusDisables(actor,'movement'))) {
            // Enumerate simple paths, rather than discarding an alternative
            // two-step approach to the same anchor before crossing checks.
            for (let i = 0; i < paths.length; i++) {
                const path = paths[i]!;
                if (path.length > constraint.maxStepPerAction) continue;
                const from = path[path.length - 1]!;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const to = { x: from.x + dx, y: from.y + dy };
                    if (!path.some(p => same(p, to)) && this.canStep(actor, from, to, cohort, options)) paths.push([...path, to]);
                }
            }
        }
        const part = cohort.definition.parts.find(p => p.partId === partId)!, preferred = { x: coreAt.x + part.preferredOffset.x, y: coreAt.y + part.preferredOffset.y };
        paths.sort((a, b) => (!options.preferFormation ? Number(b.length === 1) - Number(a.length === 1) : 0)
            || distance(a[a.length - 1]!, preferred) - distance(b[b.length - 1]!, preferred)
            || a.length - b.length || a[a.length - 1]!.y - b[b.length - 1]!.y || a[a.length - 1]!.x - b[b.length - 1]!.x
            || a.reduce((out, p, i) => out || p.y - b[i]!.y || p.x - b[i]!.x, 0));
        const candidates=paths.slice(0, COMPOSITE_MOVEMENT_LIMITS.candidates);
        if(!candidates.some(path=>path.length===1))candidates[candidates.length-1]=[{...actor.loc}];
        return candidates.map(path => this.trajectory(actor, path));
    }
    private fingerprint(cohort: Cohort): string {
        return JSON.stringify({ group: cohort.group, actors: cohort.order.map(partId => {
            const actor = cohort.actors.get(partId)!;
            return { id: actor.id, loc: actor.loc, spatial: actor.spatial, hp: actor.hp, ticks: actor.ticksUntilTurn,
                moveTicks: actor.movementSpeed, statuses: actor.statusDurations, sourceRevision: actorSourceRevision(actor) };
        }) });
    }
    planStep(groupId: number, coreAt: Readonly<Pos>, options: CompositeMovementOptions = {}): CompositeMoveResult {
        const cohort = this.cohort(groupId), corePart = cohort.order[0]!, core = cohort.actors.get(corePart)!;
        if (!integer(coreAt.x, -32768, 32767) || !integer(coreAt.y, -32768, 32767) || distance(core.loc, coreAt) !== 1
            || !integer(core.movementSpeed, 1, 1000000)) throw new SpatialValidationError('Composite core needs one positive-cost step');
        const budget = options.branchBudget ?? COMPOSITE_MOVEMENT_LIMITS.branchNodes;
        if (!integer(budget, 1, COMPOSITE_MOVEMENT_LIMITS.branchNodes)) throw new SpatialValidationError('Composite branch budget exceeded');
        const costTicks = bodyMoveTicks(cohort.definition, cohort.group, this.spatial.catalog, core.movementSpeed);
        const blocked = (reason: Extract<CompositeMoveResult, { status: 'blocked' }>['reason'], branchNodes = 0): CompositeMoveResult =>
            Object.freeze({ status: 'blocked', reason, costTicks, branchNodes });
        if (!options.forced && (cohort.definition.parts.filter(p => p.providesSupport && cohort.actors.has(p.partId)).length < cohort.definition.minSupportParts
            || core.spatial!.actionLockInTicks || core.hasStatus('stuck') || core.hasStatus('paralyzed') || bodyStatusDisables(core,'movement'))) return blocked('immobile');
        // Staying is a real candidate, not permission to skip terrain/region
        // qualification. Validate the whole published starting configuration.
        if ([...cohort.actors.values()].some(actor => !this.spatial.canFitAt(actor, actor.loc, this.options(actor, cohort, options)))) return blocked('terrain');
        if (!this.canStep(core, core.loc, coreAt, cohort, options)) return blocked('terrain');
        const assigned = new Map<string, BodyTrajectory>([[corePart, this.trajectory(core, [{ ...core.loc }, { ...coreAt }])]]);
        let nodes = 0, exhausted = false;
        const search = (index: number): boolean => {
            if (index === cohort.order.length) return true;
            const partId = cohort.order[index]!;
            for (const candidate of this.candidates(partId, coreAt, cohort, options)) {
                if (nodes === budget) { exhausted = true; return false; }
                nodes++;
                if (!this.compatible(partId, candidate, assigned, cohort)) continue;
                assigned.set(partId, candidate);
                if (search(index + 1)) return true;
                assigned.delete(partId);
                if (exhausted) return false;
            }
            return false;
        };
        if (!search(1)) return blocked(exhausted ? 'budget' : 'constraints', nodes);
        const plan: CompositeMovePlan = deepFreeze({ groupId, costTicks, branchNodes: nodes,
            trajectories: cohort.order.map(partId => ({ ...assigned.get(partId)!, entityId: cohort.actors.get(partId)!.id, partId })) });
        this.plans.set(plan, { cohort, fingerprint: this.fingerprint(cohort), revision: this.spatial.occupancyRevision,
            terrainRevision: this.spatial.terrainRevision, locations: new Map([...cohort.actors.values()].map(c => [c, c.loc])), options: Object.freeze({ ...options }) });
        return Object.freeze({ status: 'planned', plan });
    }
    /** Preflight the complete trajectory. With a native environment callback,
     * publish one complete unit cohort at a time and stop on changed identity. */
    commit(plan: CompositeMovePlan, afterStep?: (actors: readonly Creature[], previous: ReadonlyMap<Creature, readonly Readonly<Pos>[]>) => boolean): boolean {
        const binding = this.plans.get(plan);
        if (!binding) return false;
        this.plans.delete(plan);
        if (binding.revision !== this.spatial.occupancyRevision || binding.terrainRevision !== this.spatial.terrainRevision
            || this.spatial.groups.find(g => g.groupId === plan.groupId) !== binding.cohort.group
            || binding.fingerprint !== this.fingerprint(binding.cohort)) return false;
        try { this.cohort(plan.groupId); } catch { return false; }
        const cohort = binding.cohort;
        const assigned = new Map<string, BodyTrajectory>();
        for (const trajectory of plan.trajectories) {
            const actor = cohort.actors.get(trajectory.partId)!;
            if (this.spatial.entityById(actor.id) !== actor || !this.spatial.isActive(actor) || actor.loc !== binding.locations.get(actor)
                || !Object.getOwnPropertyDescriptor(actor, 'loc')?.writable || ['x', 'y'].some(k => !Object.getOwnPropertyDescriptor(actor.loc, k)?.writable)
                || !this.spatial.canFitAt(actor, actor.loc, this.options(actor, cohort, binding.options))) return false;
            for (let i = 1; i < trajectory.path.length; i++) {
                if (!this.canStep(actor, trajectory.path[i - 1]!, trajectory.path[i]!, cohort, binding.options)) return false;
            }
            if (!this.compatible(trajectory.partId, trajectory, assigned, cohort)) return false;
            assigned.set(trajectory.partId, trajectory);
        }
        // All writable destinations are preflighted. The anchor primitive only
        // updates loc and derived revisions/listeners; no arbitrary callbacks.
        const steps = afterStep ? Math.max(...plan.trajectories.map(t => t.path.length)) - 1 : 1;
        for (let step = 1; step <= steps; step++) {
            const changes = plan.trajectories.map(t => ({ creature: cohort.actors.get(t.partId)!,
                at: t.path[afterStep ? Math.min(step, t.path.length - 1) : t.path.length - 1]! }));
            if (step > 1 && changes.some(({ creature, at }) => !this.spatial.canFitAt(creature, at, this.options(creature, cohort, binding.options))
                || !same(creature.loc,at) && !this.canStep(creature,creature.loc,at,cohort,binding.options))) break;
            const previous = new Map(changes.map(({ creature }) => [creature, this.spatial.footprintOf(creature)]));
            commitCompositeAnchors(changes, this.spatial.catalog.fixture);
            const revisions = changes.map(({ creature }) => actorSourceRevision(creature));
            if (afterStep && !afterStep(changes.map(c => c.creature), previous)) break;
            if (afterStep && (this.spatial.groups.find(g => g.groupId === plan.groupId) !== cohort.group
                || changes.some(({ creature, at },i) => !this.spatial.isActive(creature) || creature.hp <= 0 || !same(creature.loc, at) || actorSourceRevision(creature) !== revisions[i]
                    || creature.spatial?.bodyMember?.groupId !== plan.groupId || !binding.options.forced && bodyStatusDisables(creature,'movement'))
                || cohort.order.some(partId => !cohort.group.members.some(s => s.partId === partId && s.life === 'active')))) break;
            if (afterStep && !bodyConstraintsSatisfied(this.spatial.catalog, cohort.definition,
                new Map([...cohort.actors].map(([id,a]) => [id,{anchor:a.loc,footprintId:a.spatial!.footprintId,pose:a.spatial!.pose}])), this.spatial.grid)) break;
        }
        return true;
    }
}
