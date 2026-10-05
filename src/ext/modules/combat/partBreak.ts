import type { ActorAttackDefinitions, ActorResourcePolicy, ProductionActorAttackState } from '../../actorActions';
import { validateProductionActorAttackTransactionState } from '../../actorActionValidation';
import { canonical } from '../../json';
import { validatePartBreakRequest, type PartBreakProvider } from '../../partBreak';
import type { Json, ReadonlyJson } from '../../types';

type ActorRow = ProductionActorAttackState['actors'][number];
// The published production-state codec bounds these pools and scheduler tails.
const MAX_ACTORS = 4096;
const MAX_ACTION_TICKS = 1_000_000;

function initialRow(actorId: number, profileId: string, policy: ActorResourcePolicy): ActorRow {
    return { actorId, profileId, stamina: policy.initialStamina, regenRemainder: 0, regenDelayRemaining: 0,
        dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0,
        poise: policy.poiseCapacity, poiseRecoveryRemainder: 0, poiseRecoveryDelayRemaining: 0,
        parryRemainingTicks: 0, parryRecoveryRemainingTicks: 0, parryFacing: null, staggerRemainingTicks: 0 };
}

/** Prepare only detached module state. Native mirrors and source invalidation
 * remain the foundation's responsibility at the successful transaction boundary.
 * Native zoneState owns receipt deduplication; there is no second break ledger. */
export function createCombatPartBreakProvider(definitions: ActorAttackDefinitions): PartBreakProvider {
    return {
        prepare(request, context) {
            validatePartBreakRequest(request);
            if (context.actor.id !== request.actorId || context.actor.hp <= 0)
                return { status: 'unsupported', reason: 'unsupported-target' };
            if (request.partId !== 'self' && (!context.member || context.member.groupId !== request.groupId
                || context.member.partId !== request.partId || context.member.generation !== request.generation
                || context.member.entityId === request.actorId))
                return { status: 'unsupported', reason: 'unsupported-target' };
            const current = context.state as unknown as ProductionActorAttackState;
            validateProductionActorAttackTransactionState(current, definitions, current);
            const expectedState = canonical(context.state);
            const next = structuredClone(current);
            const row = next.actors.find(actor => actor.actorId === request.actorId);
            const bundle = next.scheduler.bundles.find(candidate => candidate.decisionOwnerId === request.actorId);
            // A busy actor's existing resource/profile pairing is authoritative.
            const profileId = bundle && row ? row.profileId : (context.actor.player ? definitions.playerProfileId
                : definitions.nativeProfiles.find(binding => binding.monsterId === context.actor.monsterId)?.profileId
                    ?? definitions.playerProfileId);
            const profile = definitions.profiles.find(candidate => candidate.id === profileId)!;
            const policy = definitions.resourcePolicies.find(candidate => candidate.id === profile.resourcePolicyId)!;
            let changed = false;
            if (row && row.profileId !== profile.id) {
                // A new native form takes effect at this safe, non-bundle boundary.
                // Pool growth never refills; elapsed defense/stagger stays intact.
                row.profileId = profile.id;
                row.stamina = Math.min(row.stamina, policy.staminaCapacity);
                row.regenRemainder = 0;
                row.regenDelayRemaining = Math.min(row.regenDelayRemaining, policy.regenDelayTicks);
                row.poise = Math.min(row.poise, policy.poiseCapacity);
                row.poiseRecoveryRemainder = 0;
                row.poiseRecoveryDelayRemaining = Math.min(row.poiseRecoveryDelayRemaining, policy.poiseRecoveryDelayTicks);
                changed = true;
            }
            const staggered = (row?.staggerRemainingTicks ?? 0) > 0
                || bundle?.subactions.some(child => child.phases[child.phaseIndex]?.kind === 'break-recovery');
            if (request.balanceLoss > 0 && !policy.poiseImmune && !staggered) {
                if (!row && next.actors.length >= MAX_ACTORS) throw new Error('Actor resource budget exhausted');
                const resource = row ?? initialRow(request.actorId, profile.id, policy);
                if (!row) {
                    next.actors.push(resource);
                    next.actors.sort((a, b) => a.actorId - b.actorId);
                }
                resource.poise = Math.max(0, resource.poise - request.balanceLoss);
                resource.poiseRecoveryDelayRemaining = policy.poiseRecoveryDelayTicks;
                resource.poiseRecoveryRemainder = 0;
                if (resource.poise === 0) {
                    const recovery = Math.max(resource.dodgeRecoveryRemainingTicks,
                        resource.parryRecoveryRemainingTicks, definitions.breakRecoveryTicks);
                    resource.dodgeRemainingTicks = resource.parryRemainingTicks = 0;
                    resource.dodgeRecoveryRemainingTicks = resource.parryRecoveryRemainingTicks = 0;
                    resource.parryFacing = null;
                    if (bundle) {
                        const metadata = next.actions.find(action => action.actionId === bundle.actionId)!;
                        for (const child of bundle.subactions) {
                            const phase = child.phases[child.phaseIndex];
                            if (!phase) continue;
                            // Same interruption formula as the sole foundation
                            // scheduler: keep elapsed prefix, never shorten recovery.
                            const consumed = phase.durationTicks - child.phaseRemainingTicks;
                            const remaining = phase.segmentIndex === null
                                ? Math.max(child.phaseRemainingTicks, definitions.breakRecoveryTicks)
                                : definitions.breakRecoveryTicks;
                            const duration = consumed + remaining;
                            const prefix = child.phases.slice(0, child.phaseIndex)
                                .reduce((sum, prior) => sum + prior.durationTicks, 0);
                            if (prefix + duration > MAX_ACTION_TICKS) throw new Error('Part break recovery budget exhausted');
                            child.phases.splice(child.phaseIndex, child.phases.length - child.phaseIndex,
                                { kind: 'break-recovery', durationTicks: duration, segmentIndex: null });
                            child.phaseRemainingTicks = remaining;
                            metadata.subactions.find(sub => sub.sourceSubactionId === child.sourceSubactionId)!.lockedCells = [];
                        }
                    } else resource.staggerRemainingTicks = recovery;
                }
                changed = true;
            }
            if (changed) {
                if (next.revision >= Number.MAX_SAFE_INTEGER - 1) throw new Error('Action revision exhausted');
                next.revision++;
            }
            validateProductionActorAttackTransactionState(next, definitions, current);
            return { status: 'ready', plan: { schema: 1, request: canonical(request), expectedState,
                next: next as unknown as Json } };
        },
        commit(request, plan, context) {
            validatePartBreakRequest(request);
            if (!plan || typeof plan !== 'object' || Array.isArray(plan)
                || Object.keys(plan).sort().join(',') !== 'expectedState,next,request,schema')
                throw new Error('Invalid combat part break plan');
            const prepared = plan as Readonly<Record<string, ReadonlyJson>>;
            if (prepared.schema !== 1 || prepared.request !== canonical(request) || typeof prepared.expectedState !== 'string')
                throw new Error('Invalid combat part break plan');
            const current = context.state as unknown as ProductionActorAttackState;
            validateProductionActorAttackTransactionState(current, definitions, current);
            if (canonical(context.state) !== prepared.expectedState) throw new Error('Stale combat part break plan');
            validateProductionActorAttackTransactionState(prepared.next, definitions, current);
            if (canonical(prepared.next) !== prepared.expectedState)
                context.setState(structuredClone(prepared.next) as unknown as Json);
        },
    };
}
