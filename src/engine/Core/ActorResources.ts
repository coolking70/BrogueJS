/** Pure fixed-point resource arithmetic. The foreground scheduler supplies the
 * sole elapsed delta; cached actors are never passed to this helper. */
import type { ActorAttackFacing, ActorResourcePhase, ActorResourcePolicy, ActorResourceState } from '../../ext/actorActions';
import { MAX_ACTOR_ACTION_TICKS } from './ActorActionScheduler';

const MAX_RESOURCE = 1_000_000;
const PHASES: readonly ActorResourcePhase[] = ['idle', 'windup', 'inter-segment', 'recovery', 'break-recovery'];
const FACINGS: readonly ActorAttackFacing[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
function integer(value: number, min: number, max: number): void {
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error('Actor resources: invalid integer');
}
function validatePolicy(policy: Readonly<ActorResourcePolicy>): void {
    integer(policy.staminaCapacity, 1, MAX_RESOURCE);
    integer(policy.initialStamina, 0, policy.staminaCapacity);
    integer(policy.regenPerTickNumerator, 0, MAX_RESOURCE);
    integer(policy.regenPerTickDenominator, 1, MAX_RESOURCE);
    integer(policy.regenDelayTicks, 0, MAX_ACTOR_ACTION_TICKS);
    integer(policy.nativeAttackCost, 0, MAX_RESOURCE);
    integer(policy.poiseCapacity, 1, MAX_RESOURCE);
    integer(policy.poiseRecoveryNumerator, 0, MAX_RESOURCE);
    integer(policy.poiseRecoveryDenominator, 1, MAX_RESOURCE);
    integer(policy.poiseRecoveryDelayTicks, 0, MAX_ACTOR_ACTION_TICKS);
    integer(policy.poiseBreakRecoveryValue, 1, policy.poiseCapacity);
    integer(policy.nativePoiseDamage, 0, MAX_RESOURCE);
    if (typeof policy.poiseImmune !== 'boolean') throw new Error('Actor resources: invalid poise immunity');
    if (!Array.isArray(policy.regenPhases) || policy.regenPhases.length > PHASES.length
        || new Set(policy.regenPhases).size !== policy.regenPhases.length
        || policy.regenPhases.some(phase => !PHASES.includes(phase))) throw new Error('Actor resources: invalid regeneration phases');
}
/** A new body starts with its declared stamina and a full poise pool. Loading
 * an existing body must validate its state rather than invoking this helper. */
export function initialActorResources(policy: Readonly<ActorResourcePolicy>): ActorResourceState {
    validatePolicy(policy);
    return { stamina: policy.initialStamina, regenRemainder: 0, regenDelayRemaining: 0,
        dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0,
        poise: policy.poiseCapacity, poiseRecoveryRemainder: 0, poiseRecoveryDelayRemaining: 0,
        parryRemainingTicks: 0, parryRecoveryRemainingTicks: 0, parryFacing: null, staggerRemainingTicks: 0 };
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
    integer(resource.poise, 0, MAX_RESOURCE);
    integer(resource.poiseRecoveryRemainder, 0, policy.poiseRecoveryDenominator - 1);
    integer(resource.poiseRecoveryDelayRemaining, 0, policy.poiseRecoveryDelayTicks);
    integer(resource.parryRemainingTicks, 0, MAX_ACTOR_ACTION_TICKS);
    integer(resource.parryRecoveryRemainingTicks, 0, MAX_ACTOR_ACTION_TICKS);
    integer(resource.staggerRemainingTicks, 0, MAX_ACTOR_ACTION_TICKS);
    if (resource.parryRemainingTicks > resource.parryRecoveryRemainingTicks) throw new Error('Actor resources: invalid parry clock');
    if (resource.parryRemainingTicks > 0 ? !FACINGS.includes(resource.parryFacing as ActorAttackFacing) : resource.parryFacing !== null)
        throw new Error('Actor resources: invalid or expired parry facing');
    if (Number(resource.dodgeRecoveryRemainingTicks > 0) + Number(resource.parryRecoveryRemainingTicks > 0)
        + Number(resource.staggerRemainingTicks > 0) > 1) throw new Error('Actor resources: overlapping defense or stagger recovery');
    // Immunity prevents future breaks; a policy change must not discard an
    // already accepted stagger or make its remaining recovery unloadable.
    if (resource.staggerRemainingTicks > 0 && (resource.poise !== 0 || resource.poiseRecoveryRemainder !== 0))
        throw new Error('Actor resources: invalid stagger state');
    const stamina = Math.min(resource.stamina, policy.staminaCapacity);
    const poise = Math.min(resource.poise, policy.poiseCapacity);
    return { stamina, regenRemainder: stamina === policy.staminaCapacity ? 0 : resource.regenRemainder,
        regenDelayRemaining: resource.regenDelayRemaining, dodgeRemainingTicks: resource.dodgeRemainingTicks,
        dodgeRecoveryRemainingTicks: resource.dodgeRecoveryRemainingTicks,
        poise, poiseRecoveryRemainder: poise === policy.poiseCapacity ? 0 : resource.poiseRecoveryRemainder,
        poiseRecoveryDelayRemaining: resource.poiseRecoveryDelayRemaining,
        parryRemainingTicks: resource.parryRemainingTicks, parryRecoveryRemainingTicks: resource.parryRecoveryRemainingTicks,
        parryFacing: resource.parryFacing, staggerRemainingTicks: resource.staggerRemainingTicks };
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
 * ['idle']; native dodge/parry recovery supplies ['recovery'], native stagger
 * ['break-recovery']. The caller must split
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
    const staggerTicks = result.staggerRemainingTicks;
    const poiseRecoveryTicks = Math.max(0, elapsedTicks - Math.max(result.poiseRecoveryDelayRemaining, staggerTicks));
    result.regenDelayRemaining = Math.max(0, result.regenDelayRemaining - elapsedTicks);
    result.poiseRecoveryDelayRemaining = Math.max(0, result.poiseRecoveryDelayRemaining - elapsedTicks);
    // Endpoints are exclusive: protection at zero is gone before same-tick hits.
    result.dodgeRemainingTicks = Math.max(0, result.dodgeRemainingTicks - elapsedTicks);
    result.dodgeRecoveryRemainingTicks = Math.max(0, result.dodgeRecoveryRemainingTicks - elapsedTicks);
    result.parryRemainingTicks = Math.max(0, result.parryRemainingTicks - elapsedTicks);
    result.parryRecoveryRemainingTicks = Math.max(0, result.parryRecoveryRemainingTicks - elapsedTicks);
    if (result.parryRemainingTicks === 0) result.parryFacing = null;
    result.staggerRemainingTicks = Math.max(0, staggerTicks - elapsedTicks);
    if (staggerTicks > 0 && result.staggerRemainingTicks === 0) {
        result.poise = policy.poiseBreakRecoveryValue;
        result.poiseRecoveryRemainder = 0;
    }
    if (regenerationTicks > 0 && result.stamina < policy.staminaCapacity
        && phases.every(phase => policy.regenPhases.includes(phase))) {
        // Each factor is <= 1e6: multiplication remains an exact safe integer.
        const accumulated = result.regenRemainder + regenerationTicks * policy.regenPerTickNumerator;
        result.stamina = Math.min(policy.staminaCapacity, result.stamina + Math.floor(accumulated / policy.regenPerTickDenominator));
        result.regenRemainder = result.stamina === policy.staminaCapacity ? 0 : accumulated % policy.regenPerTickDenominator;
    }
    // Scheduler-owned break recovery has no duplicate resource timer. Its
    // terminal handler performs the same explicit poise reset; none of its
    // elapsed interval contributes poise regeneration, even for a mixed bundle.
    if (poiseRecoveryTicks > 0 && result.poise < policy.poiseCapacity && !phases.includes('break-recovery')) {
        const accumulated = result.poiseRecoveryRemainder + poiseRecoveryTicks * policy.poiseRecoveryNumerator;
        result.poise = Math.min(policy.poiseCapacity, result.poise + Math.floor(accumulated / policy.poiseRecoveryDenominator));
        result.poiseRecoveryRemainder = result.poise === policy.poiseCapacity ? 0 : accumulated % policy.poiseRecoveryDenominator;
    }
    return result;
}
