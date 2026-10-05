import type { Creature } from '../../entities/Creature';
import { Monster, MonsterState } from '../../entities/Monster';
import { actorSourceRevision, spatialOf } from '../Movement/CreatureSpatial';
import { sourceFootprintVersion } from '../Movement/AttackShape';
import type { Game } from './Game';
import type { ActorActionScope } from './ActorActionScope';
import { bindProductionActorActionSession, invalidateProductionActorActionSession, isProductionActorActionRunInvalid, unbindProductionActorActionSession } from './ActorActionSession';
import {
    actorSubactionHasPendingSegments, createActorActionScheduler, validateActorActionSchedulerBinding, validateActorActionSchedulerState,
    type ActorActionBoundary, type ActorActionDispatch, type ActorActionScheduler,
    type ActorActionSchedulerHost, type ActorActionSchedulerState, type ActorSubaction, type ReadonlyActorActionBundle,
} from './ActorActionScheduler';

export interface ActorActionProductionWorld {
    depth: number;
    player: Creature;
    levels: readonly { depth: number; actors: readonly Creature[] }[];
}
export type ActorActionInterruptionReason = 'source-changed' | 'incapacitated' | 'layer-change';
export interface ProductionActorActionOptions {
    /** The module-owned state object is the sole mechanical clock. */
    state: ActorActionSchedulerState;
    select?: (actorId: number, scope: ActorActionScope) => ActorActionDispatch;
    resolveSegment: (boundary: Readonly<ActorActionBoundary>) => void;
    finishAction?: (bundle: ReadonlyActorActionBundle, reason: 'completed' | 'source-invalid') => void;
    shouldSweep?: (bundle: ReadonlyActorActionBundle) => boolean;
    breakRecoveryTicks: (source: ReadonlyActorActionBundle['subactions'][number], bundle: ReadonlyActorActionBundle) => number;
    interrupted?: (source: ReadonlyActorActionBundle['subactions'][number], bundle: ReadonlyActorActionBundle, reason: ActorActionInterruptionReason) => void;
    elapsed?: (delta: number, depth: number) => void;
}
interface ProductionBinding { options: ProductionActorActionOptions; scheduler: ActorActionScheduler; suspendedDepth: number | null; interruption: ActorActionInterruptionReason; resolving: boolean; changedSources: Set<number>; resumePending: boolean }
const bindings = new WeakMap<Game, ProductionBinding>();
function actorMap(world: ActorActionProductionWorld): Map<number, { actor: Creature; depth: number }> {
    const actors = new Map<number, { actor: Creature; depth: number }>([[world.player.id, { actor: world.player, depth: world.depth }]]);
    for (const level of world.levels) for (const actor of level.actors) {
        if (actors.has(actor.id) && actors.get(actor.id)!.actor !== actor) throw new Error('Duplicate action world actor');
        actors.set(actor.id, { actor, depth: level.depth });
    }
    return actors;
}
function aliveSource(actor: Creature): boolean {
    return actor.hp > 0 && !(actor instanceof Monster && (actor.deathProcessed || actor.isDormant));
}
function incapacitatedSource(actor: Creature): boolean {
    return actor.hasStatus('paralyzed') || actor.hasStatus('entranced')
        || (actor instanceof Monster && (actor.isCaged || actor.state === MonsterState.ASLEEP));
}
function validSource(actor: Creature, source: Readonly<ActorSubaction>): boolean {
    const view = spatialOf(actor);
    return (view.partId ?? 'body') === source.sourcePartId && sourceFootprintVersion(view) === source.sourceFootprintVersion;
}
/** Candidate-world-only validation. It never reads or mutates the previous Game. */
export function validateProductionActorActionState(state: unknown, world: ActorActionProductionWorld): void {
    validateActorActionSchedulerState(state);
    const actors = actorMap(world);
    const host: ActorActionSchedulerHost = {
        decisionOwnerId: id => id,
        readActor: id => { const actor = actors.get(id)?.actor; return actor ? { ticksUntilTurn: actor.ticksUntilTurn, alive: aliveSource(actor) } : null; },
        writeOwnerTicks: () => { throw new Error('Validation cannot write action clocks'); },
        resolveSegment: () => { throw new Error('Validation cannot resolve actions'); },
        finishAction: () => { throw new Error('Validation cannot finish actions'); },
        isSourceValid: (source, depth) => { const row = actors.get(source.sourceEntityId); return !!row && row.depth === depth && validSource(row.actor, source); },
        onFault: error => { throw error; },
    };
    validateActorActionSchedulerBinding(state, host);
    for (const bundle of state.bundles) {
        if (actors.get(bundle.decisionOwnerId)?.depth !== bundle.depth) throw new Error('Action owner depth mismatch');
        for (const source of bundle.subactions) {
            if (source.phaseIndex >= source.phases.length) continue;
            const entity = actors.get(source.sourceEntityId);
            if (entity?.depth !== bundle.depth) throw new Error('Action source depth mismatch');
            const identity = spatialOf(entity.actor);
            if (identity.groupId !== bundle.decisionOwnerId || (identity.partId ?? 'body') !== source.sourcePartId)
                throw new Error('Action source identity mismatch');
            if (actorSubactionHasPendingSegments(source)) {
                if (bundle.depth !== world.depth) throw new Error('Cached action contains an unreleased attack');
                if (incapacitatedSource(entity.actor)) throw new Error('Incapacitated source contains an unreleased attack');
            }
        }
    }
}

export function createProductionActorActionSession(game: Game, options: ProductionActorActionOptions): ActorActionScheduler {
    validateProductionActorActionState(options.state, game.actorActionWorld());
    const binding: ProductionBinding = { options, scheduler: null!, suspendedDepth: null, interruption: 'source-changed', resolving: false, changedSources: new Set(), resumePending: false };
    const row = (id: number) => actorMap(game.actorActionWorld()).get(id);
    const sourceBindings = new WeakMap<object, { actor: Creature; revision: number }>();
    const liveSourceValid = (source: Readonly<ActorSubaction>, actor: Creature): boolean => {
        let baseline = sourceBindings.get(source);
        if (!baseline) { baseline = { actor, revision: actorSourceRevision(actor) }; sourceBindings.set(source, baseline); }
        return baseline.actor === actor && baseline.revision === actorSourceRevision(actor) && validSource(actor, source);
    };
    const host: ActorActionSchedulerHost = {
        decisionOwnerId: id => id,
        readActor: id => { const actor = row(id)?.actor; return actor ? { ticksUntilTurn: actor.ticksUntilTurn, alive: aliveSource(actor) } : null; },
        writeOwnerTicks: (id, ticks) => { const actor = row(id)?.actor; if (actor?.hp && actor.hp > 0) actor.ticksUntilTurn = ticks; },
        resolveSegment: boundary => {
            binding.resolving = true;
            try { options.resolveSegment(boundary); } finally { binding.resolving = false; }
        },
        finishAction: (bundle, reason) => {
            const shouldSweep = options.shouldSweep?.(bundle) ?? true;
            options.finishAction?.(bundle, reason);
            if (shouldSweep) game.finishActorActionSweep(bundle.decisionOwnerId, bundle.depth, bundle.elapsedActionTicks);
        },
        leftDepth: bundle => {
            for (const source of bundle.subactions) if (source.phaseIndex < source.phases.length)
                options.interrupted?.(source, bundle, 'layer-change');
        },
        abandoned: bundle => options.finishAction?.(bundle, 'source-invalid'),
        isDepthActive: depth => depth === game.depth && binding.suspendedDepth !== depth,
        actorDepth: id => row(id)?.depth ?? null,
        isSourceValid: (source, depth) => { const entity = row(source.sourceEntityId); return !!entity && entity.depth === depth && liveSourceValid(source, entity.actor); },
        sourceInterruption: (source, bundle) => {
            if (source.phases[source.phaseIndex]?.kind === 'break-recovery') return null;
            const entity = row(source.sourceEntityId);
            let reason: ActorActionInterruptionReason | null = null;
            if (binding.suspendedDepth === bundle.depth || entity?.depth !== bundle.depth) reason = 'layer-change';
            else if (entity && incapacitatedSource(entity.actor)) reason = 'incapacitated';
            else if (binding.changedSources.has(source.sourceEntityId) || (entity && actorSubactionHasPendingSegments(source) && !liveSourceValid(source, entity.actor))) reason = 'source-changed';
            if (!reason) return null;
            binding.interruption = reason;
            return { recoveryTicks: options.breakRecoveryTicks(source, bundle) };
        },
        interrupted: (source, bundle) => {
            binding.changedSources.delete(source.sourceEntityId);
            options.interrupted?.(source, bundle, binding.interruption);
        },
        elapsed: delta => options.elapsed?.(delta, game.depth),
        onFault: error => { invalidateProductionActorActionSession(game); game.invalidateActorActionRun(error); },
    };
    binding.scheduler = createActorActionScheduler(options.state, host);
    bindings.set(game, binding);
    bindProductionActorActionSession(game, binding.scheduler, options.select);
    return binding.scheduler;
}
export function productionActorActionScheduler(game: Game): ActorActionScheduler | undefined { return bindings.get(game)?.scheduler; }
export function productionActorActionInputLocked(game: Game): boolean {
    return isProductionActorActionRunInvalid(game) || !!bindings.get(game)?.options.state.bundles.some(bundle => bundle.decisionOwnerId === game.player.id && bundle.depth === game.depth);
}
/** Load binds only; the first explicit simulation update resumes the pending work. */
export function markProductionActorActionResume(game: Game): void {
    const binding = bindings.get(game); if (binding) binding.resumePending = productionActorActionInputLocked(game);
}
export function consumeProductionActorActionResume(game: Game): boolean {
    const binding = bindings.get(game);
    if (!binding?.resumePending) return false;
    binding.resumePending = false;
    return productionActorActionInputLocked(game) && game.player.hp > 0 && !game.isGameOver;
}
export function disposeProductionActorActionSession(game: Game): void { bindings.delete(game); unbindProductionActorActionSession(game); }
export function reconcileProductionActorActions(game: Game): void {
    const binding = bindings.get(game);
    if (binding && !binding.resolving) binding.scheduler.cancelDeadActions();
}
/** Called after a native displacement/identity change commits. Nested native
 * hits defer cancellation only until their indivisible resolver returns. */
export function notifyProductionActorSourceChanged(game: Game, sourceEntityId: number): void {
    const binding = bindings.get(game); if (!binding) return;
    const source = binding.options.state.bundles.flatMap(bundle => bundle.subactions)
        .find(child => child.sourceEntityId === sourceEntityId && child.phaseIndex < child.phases.length);
    if (!source) return;
    if (source.phases[source.phaseIndex]?.kind !== 'break-recovery') binding.changedSources.add(sourceEntityId);
    if (!binding.resolving) binding.scheduler.cancelDeadActions();
}
export function validateProductionActorActionSession(game: Game): void { bindings.get(game)?.scheduler.snapshot(); }
export function suspendProductionActorActions(game: Game, fromDepth: number): void {
    const binding = bindings.get(game); if (!binding) return;
    binding.suspendedDepth = fromDepth;
    binding.scheduler.interruptDepth(fromDepth);
}
export function resumeProductionActorActions(game: Game): void {
    const binding = bindings.get(game); if (!binding) return;
    const actors = actorMap(game.actorActionWorld());
    for (const bundle of binding.options.state.bundles) {
        const owner = actors.get(bundle.decisionOwnerId);
        // A travelling owner carries recovery, never a pending release, to its new layer.
        if (owner && owner.depth !== bundle.depth) {
            binding.suspendedDepth = bundle.depth;
            binding.scheduler.interruptDepth(bundle.depth);
            bundle.depth = owner.depth;
        }
    }
    binding.suspendedDepth = null;
    // Native cached-level catch-up may update native timers, but must never
    // consume combat recovery or make it a second independent clock.
    binding.scheduler.refreshMirrors();
}
