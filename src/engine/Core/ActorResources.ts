/** Pure fixed-point resource arithmetic. The foreground scheduler supplies the
 * sole elapsed delta; cached actors are never passed to this helper. */
import type { ActorResourcePhase, ActorResourcePolicy, ActorResourceState } from '../../ext/actorActions';
import { MAX_ACTOR_ACTION_TICKS } from './ActorActionScheduler';

const MAX_RESOURCE = 1_000_000;
const PHASES: readonly ActorResourcePhase[] = ['idle', 'windup', 'inter-segment', 'recovery', 'break-recovery'];
function integer(value: number, min: number, max: number): void {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Actor resources: invalid integer');
}
function validatePolicy(policy: Readonly<ActorResourcePolicy>): void {
    integer(policy.staminaCapacity, 1, MAX_RESOURCE);
    integer(policy.initialStamina, 0, policy.staminaCapacity);
    integer(policy.regenPerTickNumerator, 0, MAX_RESOURCE);
    integer(policy.regenPerTickDenominator, 1, MAX_RESOURCE);
    integer(policy.regenDelayTicks, 0, MAX_ACTOR_ACTION_TICKS);
    integer(policy.nativeAttackCost, 0, policy.staminaCapacity);
    if (!Array.isArray(policy.regenPhases) || policy.regenPhases.length > PHASES.length
        || new Set(policy.regenPhases).size !== policy.regenPhases.length
        || policy.regenPhases.some(phase => !PHASES.includes(phase))) throw new Error('Actor resources: invalid regeneration phases');
}
/** A reduced capacity clamps existing resources; raising it never fills the gap.
 * Remainders cannot bank regeneration while the pool is full. */
function normalized(resource: Readonly<ActorResourceState>, policy: Readonly<ActorResourcePolicy>): ActorResourceState {
    validatePolicy(policy);
    integer(resource.stamina, 0, MAX_RESOURCE);
    integer(resource.regenRemainder, 0, policy.regenPerTickDenominator - 1);
    integer(resource.regenDelayRemaining, 0, policy.regenDelayTicks);
    integer(resource.dodgeRemainingTicks, 0, MAX_ACTOR_ACTION_TICKS);
    integer(resource.dodgeRecoveryRemainingTicks, 0, MAX_ACTOR_ACTION_TICKS);
    if (resource.dodgeRemainingTicks > resource.dodgeRecoveryRemainingTicks) throw new Error('Actor resources: invalid dodge clock');
    const stamina = Math.min(resource.stamina, policy.staminaCapacity);
    return { stamina, regenRemainder: stamina === policy.staminaCapacity ? 0 : resource.regenRemainder,
        regenDelayRemaining: resource.regenDelayRemaining, dodgeRemainingTicks: resource.dodgeRemainingTicks,
        dodgeRecoveryRemainingTicks: resource.dodgeRecoveryRemainingTicks };
}
/** Charge once at an accepted action's commit point. No input is mutated and a
 * failed payment does not reset delay or repair the caller's state. */
export function chargeActorResources(
    resource: Readonly<ActorResourceState>, policy: Readonly<ActorResourcePolicy>, cost: number,
): ActorResourceState | null {
    integer(cost, 0, MAX_RESOURCE);
    const result = normalized(resource, policy);
    if (result.stamina < cost) return null;
    result.stamina -= cost;
    result.regenDelayRemaining = policy.regenDelayTicks;
    return result;
}
/** All unfinished child phases must allow regeneration. An idle owner supplies
 * ['idle']; a native dodge recovery supplies ['recovery']. The caller must split
 * deltas at phase boundaries, exactly as for the authoritative action clock. */
export function advanceActorResources(
    resource: Readonly<ActorResourceState>, policy: Readonly<ActorResourcePolicy>, elapsedTicks: number,
    phases: readonly ActorResourcePhase[],
): ActorResourceState {
    integer(elapsedTicks, 1, MAX_ACTOR_ACTION_TICKS);
    if (!Array.isArray(phases) || !phases.length || phases.length > 4
        || phases.some(phase => !PHASES.includes(phase)) || (phases.length > 1 && phases.includes('idle')))
        throw new Error('Actor resources: invalid active phases');
    const result = normalized(resource, policy);
    const regenerationTicks = Math.max(0, elapsedTicks - result.regenDelayRemaining);
    result.regenDelayRemaining = Math.max(0, result.regenDelayRemaining - elapsedTicks);
    // Endpoints are exclusive: protection at zero is gone before same-tick hits.
    result.dodgeRemainingTicks = Math.max(0, result.dodgeRemainingTicks - elapsedTicks);
    result.dodgeRecoveryRemainingTicks = Math.max(0, result.dodgeRecoveryRemainingTicks - elapsedTicks);
    if (regenerationTicks > 0 && result.stamina < policy.staminaCapacity
        && phases.every(phase => policy.regenPhases.includes(phase))) {
        // Each factor is <= 1e6: multiplication remains an exact safe integer.
        const accumulated = result.regenRemainder + regenerationTicks * policy.regenPerTickNumerator;
        result.stamina = Math.min(policy.staminaCapacity, result.stamina + Math.floor(accumulated / policy.regenPerTickDenominator));
        result.regenRemainder = result.stamina === policy.staminaCapacity ? 0 : accumulated % policy.regenPerTickDenominator;
    }
    return result;
}
