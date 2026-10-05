import { describe, expect, it, vi } from 'vitest';
import { createActorActionBundle } from '../../../../engine/Core/ActorActionScheduler';
import { initialActorResources } from '../../../../engine/Core/ActorResources';
import type { ActorAttackDefinitions, ActorResourceState, ProductionActorAttackState } from '../../../actorActions';
import { validateProductionActorAttackState, validateProductionActorAttackTransactionState } from '../../../actorActionValidation';
import type { PartBreakCommitContext, PartBreakProvider, PartBreakRequest } from '../../../partBreak';
import type { ActorFacts, Json } from '../../../types';
import { loadCombatDefinitionPack } from '../definitions';
import { createCombatModuleFromPack } from '../module';
import { createCombatPartBreakProvider } from '../partBreak';
import { combatAttackDefinitions, initialProductionCombatState } from '../production';

const definitions = (): ActorAttackDefinitions => structuredClone(combatAttackDefinitions(loadCombatDefinitionPack()));
const json = (value: unknown): Json => value as Json;
const request = (patch: Partial<PartBreakRequest> = {}): PartBreakRequest => ({ schema: 1, resolutionId: 1,
    actorId: 10, sourceId: 20, groupId: 10, partId: 'self', zoneId: 'shell', generation: 0,
    balanceLoss: 6, fallbackStunTicks: 999, ...patch });
const actor = (patch: Partial<ActorFacts> = {}): ActorFacts => ({ id: 10, name: 'fixture', hp: 30, maxHp: 30,
    x: 5, y: 5, player: false, monsterId: 'rat', allied: false, hostile: true, ...patch });
function state(patch: Partial<ActorResourceState> = {}, pack = definitions()): ProductionActorAttackState {
    return { ...initialProductionCombatState(), actors: [{ actorId: 10, profileId: 'combat.fan-edge',
        ...initialActorResources(pack.resourcePolicies[0]!), ...patch }] };
}
function freeze<T>(value: T): T {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
}
function prepare(provider: PartBreakProvider, before: ProductionActorAttackState,
    hit = request(), target = actor()): Json {
    const result = provider.prepare(freeze(structuredClone(hit)), { playerId: 1,
        state: json(freeze(structuredClone(before))), actor: freeze(structuredClone(target)),
        getComponent: () => { throw new Error('Unexpected component read'); } });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected ready provider');
    return freeze(result.plan);
}
function commitContext(before: ProductionActorAttackState) {
    let current = before;
    const setState = vi.fn((next: Json) => { current = next as unknown as ProductionActorAttackState; });
    const forbidden = () => { throw new Error('Unexpected component/message write'); };
    const context: PartBreakCommitContext = { get state() { return json(current); }, setState,
        getComponent: forbidden, setComponent: forbidden, removeComponent: forbidden, message: forbidden };
    return { context, setState, current: () => current };
}
function apply(before: ProductionActorAttackState, hit = request(), target = actor(), pack = definitions()) {
    const provider = createCombatPartBreakProvider(pack), original = structuredClone(before);
    const plan = prepare(provider, before, hit, target), result = commitContext(before);
    expect(before).toEqual(original);
    provider.commit(hit, plan, result.context);
    expect(before).toEqual(original);
    validateProductionActorAttackState(result.current(), pack);
    return result;
}
function busy(pack = definitions(), stage: 'windup' | 'inter-segment' | 'recovery' = 'windup', elapsed = 0) {
    const result = state({}, pack), attack = pack.attacks.find(attack => attack.id === 'fixture.double-thrust')!;
    result.actors[0]!.profileId = pack.playerProfileId;
    const phases = attack.segments.map((segment, index) => ({ kind: index === 0 ? 'windup' as const : 'inter-segment' as const,
        durationTicks: index === 0 ? attack.windupTicks : segment.delayTicks, segmentIndex: index as number | null }));
    const phaseIndex = stage === 'windup' ? 0 : stage === 'inter-segment' ? 1 : phases.length;
    const bundle = createActorActionBundle({ actionId: 1, depth: 1, decisionOwnerId: 10, timeChargeOwnerId: 10,
        subactions: [{ sourceEntityId: 10, sourcePartId: 'self', sourceFootprintVersion: 'fixture-v1',
            phases: [...phases, { kind: 'recovery', durationTicks: attack.recoveryTicks, segmentIndex: null }] }] });
    const child = bundle.subactions[0]!;
    child.phaseIndex = phaseIndex; child.phaseRemainingTicks = child.phases[phaseIndex]!.durationTicks - elapsed;
    bundle.elapsedActionTicks = child.phases.slice(0, phaseIndex).reduce((sum, phase) => sum + phase.durationTicks, 0) + elapsed;
    const segment = attack.segments[Math.min(phaseIndex, attack.segments.length - 1)]!;
    result.nextActionId = 2; result.scheduler.bundles.push(bundle);
    result.actions.push({ actionId: 1, profileId: pack.playerProfileId, paidCost: attack.cost,
        subactions: [{ sourceSubactionId: 1, attackId: attack.id, facing: 'e',
            lockedCells: stage === 'recovery' ? [] : [{ x: 6, y: 5 }],
            shape: { schema: 1, kind: 'footprint-offset-union', offsets: structuredClone(segment.shape.offsets.e),
                selfExclusion: segment.shape.selfExclusion }, approvedRisks: [] }] });
    validateProductionActorAttackState(result, pack);
    return result;
}

describe('combat published part-break provider', () => {
    it('registers only the published optional capability', () => {
        const module = createCombatModuleFromPack(loadCombatDefinitionPack());
        expect(Object.keys(module.optionalPartBreaks!)).toEqual(['combat.part-break.v1']);
        expect(module.optionalPartBreaks!['combat.part-break.v1']).toMatchObject({ prepare: expect.any(Function), commit: expect.any(Function) });
    });
    it.each([{ id: 11 }, { hp: 0 }])('declines an unavailable target %j without touching state', patch => {
        const provider = createCombatPartBreakProvider(definitions()), before = state();
        expect(provider.prepare(request(), { playerId: 1, state: json(before), actor: actor(patch), getComponent: () => undefined }))
            .toEqual({ status: 'unsupported', reason: 'unsupported-target' });
        expect(before).toEqual(state());
    });
    it.each([{ groupId: 11 }, { partId: 'member' }, { generation: 1 }])('rejects unpublished target identity %j', patch => {
        const provider = createCombatPartBreakProvider(definitions());
        expect(() => prepare(provider, state(), { ...request(), ...patch } as PartBreakRequest)).toThrow('fixed zone break request');
    });
    it('uses the existing row without changing stamina, profile, defenses or action IDs', () => {
        const before = state({ stamina: 17, regenRemainder: 3, regenDelayRemaining: 12,
            poise: 9, poiseRecoveryRemainder: 4, parryRemainingTicks: 20, parryRecoveryRemainingTicks: 60, parryFacing: 'w' });
        const result = apply(before).current();
        expect(result).toEqual({ ...before, revision: 1, actors: [{ ...before.actors[0]!,
            poise: 3, poiseRecoveryRemainder: 0, poiseRecoveryDelayRemaining: 40 }] });
    });
    it.each([
        [actor(), 'combat.fan-edge'], [actor({ monsterId: 'unmapped-monster' }), 'fixture.profile'],
        [actor({ player: true, monsterId: 'rat' }), 'fixture.profile'],
    ])('creates a complete row from the appropriate resource profile %j', (target, profileId) => {
        const result = apply(initialProductionCombatState(), request(), target as ActorFacts).current();
        expect(result.actors).toEqual([{ actorId: 10, profileId,
            ...initialActorResources(definitions().resourcePolicies[0]!), poise: 6, poiseRecoveryDelayRemaining: 40 }]);
    });
    it('sorts a newly added resource row without touching unrelated actors', () => {
        const before = state(); before.actors[0]!.actorId = 20;
        const result = apply(before).current();
        expect(result.actors.map(row => row.actorId)).toEqual([10, 20]);
        expect(result.actors[1]).toEqual(before.actors[0]);
    });
    it.each([false, true])('handles zero loss without a write or revision change, existing=%s', existing => {
        const before = existing ? state() : initialProductionCombatState();
        const result = apply(before, request({ balanceLoss: 0 }));
        expect(result.current()).toBe(before); expect(result.setState).not.toHaveBeenCalled();
    });
    it.each([false, true])('handles immune actors without fallback or new state, existing=%s', existing => {
        const pack = definitions(); pack.resourcePolicies[0]!.poiseImmune = true;
        const before = existing ? state({}, pack) : initialProductionCombatState();
        const result = apply(before, request({ balanceLoss: 100 }), actor(), pack);
        expect(result.current()).toBe(before); expect(result.setState).not.toHaveBeenCalled();
    });
    it('does not extend an existing native stagger or reset its recovery delay', () => {
        const before = state({ poise: 0, staggerRemainingTicks: 7, poiseRecoveryDelayRemaining: 3 });
        const result = apply(before, request({ balanceLoss: 1_000_000 }));
        expect(result.current()).toBe(before); expect(result.setState).not.toHaveBeenCalled();
    });
    it.each([
        [{ parryRemainingTicks: 20, parryRecoveryRemainingTicks: 60, parryFacing: 'w' }, 60],
        [{ dodgeRemainingTicks: 20, dodgeRecoveryRemainingTicks: 60 }, 60],
        [{}, 50],
    ])('clears native defense and uses max existing recovery on zero poise %j', (patch, ticks) => {
        const before = state(patch as Partial<ActorResourceState>), result = apply(before, request({ balanceLoss: 12 })).current();
        expect(result.actors[0]).toEqual({ ...before.actors[0]!, poise: 0, poiseRecoveryDelayRemaining: 40,
            parryRemainingTicks: 0, parryRecoveryRemainingTicks: 0, parryFacing: null,
            dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0, staggerRemainingTicks: ticks });
        expect(result.scheduler.bundles).toEqual([]);
    });
    it.each(['windup', 'inter-segment', 'recovery'] as const)('cancels a %s tail with the existing scheduler formula', stage => {
        const before = busy(definitions(), stage, 7), result = apply(before, request({ balanceLoss: 12 })).current();
        const oldChild = before.scheduler.bundles[0]!.subactions[0]!, child = result.scheduler.bundles[0]!.subactions[0]!;
        const remaining = stage === 'recovery' ? Math.max(oldChild.phaseRemainingTicks, 50) : 50;
        expect(child.phases).toEqual([...oldChild.phases.slice(0, oldChild.phaseIndex),
            { kind: 'break-recovery', durationTicks: 7 + remaining, segmentIndex: null }]);
        expect(child.phaseRemainingTicks).toBe(remaining); expect(child.phaseIndex).toBe(oldChild.phaseIndex);
        expect(result.scheduler.bundles[0]!.elapsedActionTicks).toBe(before.scheduler.bundles[0]!.elapsedActionTicks);
        expect(result.actions[0]!.subactions[0]!.lockedCells).toEqual([]);
        expect(result.actions[0]!.paidCost).toBe(before.actions[0]!.paidCost);
        expect(result.actors[0]).toMatchObject({ profileId: before.actors[0]!.profileId, poise: 0, staggerRemainingTicks: 0 });
        expect(result.nextActionId).toBe(before.nextActionId); expect(result.revision).toBe(before.revision + 1);
    });
    it('does not shorten a longer existing scheduler recovery', () => {
        const pack = definitions(); pack.attacks.find(attack => attack.id === 'fixture.double-thrust')!.recoveryTicks = 200;
        const before = busy(pack, 'recovery', 7), result = apply(before, request({ balanceLoss: 12 }), actor(), pack).current();
        expect(result.scheduler.bundles[0]!.subactions[0]!.phaseRemainingTicks).toBe(193);
    });
    it('replaces its own due release while another due owner stays unchanged until dispatch', () => {
        const pack = definitions(), before = busy(pack), other = busy(pack);
        other.actors[0]!.actorId = 20;
        const otherBundle = other.scheduler.bundles[0]!;
        otherBundle.actionId = 2; otherBundle.decisionOwnerId = otherBundle.timeChargeOwnerId = 20;
        otherBundle.subactions[0]!.sourceEntityId = 20; other.actions[0]!.actionId = 2;
        before.scheduler.bundles.push(otherBundle); before.actions.push(other.actions[0]!);
        before.actors.push(other.actors[0]!); before.nextActionId = 3;
        for (const bundle of before.scheduler.bundles) {
            bundle.elapsedActionTicks = bundle.subactions[0]!.phases[0]!.durationTicks;
            bundle.subactions[0]!.phaseRemainingTicks = 0;
        }
        // Due zeroes exist only within synchronous dispatch, never a saved state.
        expect(() => validateProductionActorAttackState(before, pack)).toThrow('phase clock');
        const original = structuredClone(before), provider = createCombatPartBreakProvider(pack);
        const hit = request({ balanceLoss: 12 }), plan = prepare(provider, before, hit), target = commitContext(before);
        provider.commit(hit, plan, target.context);
        const result = target.current();
        expect(before).toEqual(original);
        expect(result.scheduler.bundles[0]!.subactions[0]!).toMatchObject({ phaseRemainingTicks: 50,
            phases: [{ kind: 'break-recovery', durationTicks: original.scheduler.bundles[0]!.elapsedActionTicks + 50, segmentIndex: null }] });
        expect(result.scheduler.bundles[1]).toEqual(original.scheduler.bundles[1]);
        expect(result.actions[1]).toEqual(original.actions[1]); expect(result.actors[1]).toEqual(original.actors[1]);
        expect(() => validateProductionActorAttackTransactionState(result, pack, before)).not.toThrow();
        expect(() => validateProductionActorAttackState(result, pack)).toThrow('phase clock');
    });
    it.each([0, 6])('handles an already broken bundle at poise %s without another stun or new ledger', poise => {
        const before = apply(busy(), request({ balanceLoss: 12 })).current();
        before.actors[0]!.poise = poise;
        const result = apply(before, request({ resolutionId: 2, zoneId: 'leg', balanceLoss: 12 }));
        expect(result.current()).toBe(before); expect(result.setState).not.toHaveBeenCalled();
        expect(Object.keys(result.current()).sort()).toEqual(['actions', 'actors', 'nextActionId', 'revision', 'scheduler', 'schema']);
    });
    it('does not rebind a busy profile to the actor monster mapping', () => {
        const pack = definitions();
        pack.resourcePolicies.push({ ...pack.resourcePolicies[0]!, id: 'combat.immune-resources', poiseImmune: true,
            initialStamina: 6, staminaCapacity: 6, poiseCapacity: 4, poiseBreakRecoveryValue: 4 });
        pack.profiles.find(profile => profile.id === 'combat.fan-edge')!.resourcePolicyId = 'combat.immune-resources';
        const result = apply(busy(pack), request(), actor(), pack).current();
        expect(result.actors[0]).toMatchObject({ profileId: pack.playerProfileId, stamina: 24, poise: 6 });
    });
    it.each([false, true])('normalizes a changed idle form before its current immunity=%s policy', immune => {
        const pack = definitions();
        pack.resourcePolicies.push({ ...pack.resourcePolicies[0]!, id: 'combat.changed-resources', poiseImmune: immune,
            initialStamina: 8, staminaCapacity: 8, regenPerTickDenominator: 3, regenDelayTicks: 7,
            poiseCapacity: 5, poiseBreakRecoveryValue: 5, poiseRecoveryDenominator: 4, poiseRecoveryDelayTicks: 8 });
        pack.profiles.find(profile => profile.id === 'combat.follow-thrust')!.resourcePolicyId = 'combat.changed-resources';
        const before = state({ stamina: 17, regenRemainder: 19, regenDelayRemaining: 30,
            poise: 9, poiseRecoveryRemainder: 29, poiseRecoveryDelayRemaining: 30,
            parryRemainingTicks: 20, parryRecoveryRemainingTicks: 60, parryFacing: 'w' }, pack);
        const result = apply(before, request({ balanceLoss: 2 }), actor({ monsterId: 'kobold' }), pack).current();
        expect(result.actors[0]).toEqual({ ...before.actors[0]!, profileId: 'combat.follow-thrust',
            stamina: 8, regenRemainder: 0, regenDelayRemaining: 7,
            poise: immune ? 5 : 3, poiseRecoveryRemainder: 0, poiseRecoveryDelayRemaining: 8 });
        expect(result.revision).toBe(before.revision + 1);
    });
    it('never refills pools when an idle form gains capacity, including zero-loss receipts', () => {
        const pack = definitions();
        pack.resourcePolicies.push({ ...pack.resourcePolicies[0]!, id: 'combat.larger-resources',
            initialStamina: 100, staminaCapacity: 100, poiseCapacity: 100, poiseBreakRecoveryValue: 100 });
        pack.profiles.find(profile => profile.id === 'combat.follow-thrust')!.resourcePolicyId = 'combat.larger-resources';
        const before = state({ stamina: 7, poise: 3, dodgeRemainingTicks: 20, dodgeRecoveryRemainingTicks: 60 }, pack);
        const result = apply(before, request({ balanceLoss: 0 }), actor({ monsterId: 'kobold' }), pack).current();
        expect(result.actors[0]).toEqual({ ...before.actors[0]!, profileId: 'combat.follow-thrust' });
        expect(result.revision).toBe(before.revision + 1);
    });
    it('a new immune form retains an existing native stagger with no extension', () => {
        const pack = definitions();
        pack.resourcePolicies.push({ ...pack.resourcePolicies[0]!, id: 'combat.immune-resources', poiseImmune: true });
        pack.profiles.find(profile => profile.id === 'combat.follow-thrust')!.resourcePolicyId = 'combat.immune-resources';
        const before = state({ poise: 0, staggerRemainingTicks: 7, poiseRecoveryDelayRemaining: 3 }, pack);
        const result = apply(before, request(), actor({ monsterId: 'kobold' }), pack).current();
        expect(result.actors[0]).toEqual({ ...before.actors[0]!, profileId: 'combat.follow-thrust' });
        expect(result.revision).toBe(before.revision + 1);
    });
    it('normalization-only revision exhaustion leaves the original row unchanged', () => {
        const before = state(), original = structuredClone(before);
        before.revision = original.revision = Number.MAX_SAFE_INTEGER - 1;
        expect(() => prepare(createCombatPartBreakProvider(definitions()), before,
            request({ balanceLoss: 0 }), actor({ monsterId: 'kobold' }))).toThrow('revision exhausted');
        expect(before).toEqual(original);
    });
    it('rejects stale state even when the concurrent writer forgot to change revision', () => {
        const provider = createCombatPartBreakProvider(definitions()), before = state(), plan = prepare(provider, before);
        const altered = structuredClone(before); altered.actors[0]!.stamina--;
        const target = commitContext(altered);
        expect(() => provider.commit(request(), plan, target.context)).toThrow('Stale');
        expect(target.setState).not.toHaveBeenCalled(); expect(target.current()).toBe(altered);
    });
    it('accepts canonically identical detached state with different object key order', () => {
        const provider = createCombatPartBreakProvider(definitions()), before = state(), plan = prepare(provider, before);
        const reordered = Object.fromEntries(Object.entries(before).reverse()) as unknown as ProductionActorAttackState;
        const target = commitContext(reordered); provider.commit(request(), plan, target.context);
        expect(target.current().actors[0]!.poise).toBe(6);
    });
    it('a consumed damaging plan cannot be committed twice and adds no receipt ledger', () => {
        const provider = createCombatPartBreakProvider(definitions()), before = state(), plan = prepare(provider, before);
        const target = commitContext(before); provider.commit(request(), plan, target.context);
        expect(() => provider.commit(request(), plan, target.context)).toThrow('Stale');
        expect(target.current().actors[0]!.poise).toBe(6); expect(target.setState).toHaveBeenCalledTimes(1);
        expect(Object.keys(target.current()).sort()).toEqual(Object.keys(before).sort());
    });
    it('binds the plan to the exact native request', () => {
        const provider = createCombatPartBreakProvider(definitions()), before = state(), plan = prepare(provider, before);
        const target = commitContext(before);
        expect(() => provider.commit(request({ resolutionId: 2 }), plan, target.context)).toThrow('Invalid');
        expect(target.setState).not.toHaveBeenCalled();
    });
    it('a rejected setState cannot mutate caller state or its reusable frozen plan', () => {
        const provider = createCombatPartBreakProvider(definitions()), before = state(), original = structuredClone(before);
        const plan = prepare(provider, before), planBefore = structuredClone(plan), target = commitContext(before);
        target.context.setState = next => { (next as unknown as ProductionActorAttackState).revision = 999; throw new Error('setState failed'); };
        expect(() => provider.commit(request(), plan, target.context)).toThrow('setState failed');
        expect(before).toEqual(original); expect(plan).toEqual(planBefore);
    });
    it('rejects malformed next state before attempting a commit', () => {
        const provider = createCombatPartBreakProvider(definitions()), before = state();
        const plan = structuredClone(prepare(provider, before)) as { [key: string]: Json };
        (plan.next as unknown as ProductionActorAttackState).actors[0]!.poise = -1;
        const target = commitContext(before);
        expect(() => provider.commit(request(), plan, target.context)).toThrow(); expect(target.setState).not.toHaveBeenCalled();
    });
    it('throws atomically when actor resources are full rather than selecting fallback', () => {
        const before = initialProductionCombatState(), resource = state().actors[0]!;
        before.actors = Array.from({ length: 4096 }, (_, index) => ({ ...resource, actorId: index + 20 }));
        const original = structuredClone(before);
        expect(() => prepare(createCombatPartBreakProvider(definitions()), before)).toThrow('budget exhausted');
        expect(before).toEqual(original);
    });
    it('throws atomically on revision exhaustion', () => {
        const before = state(); before.revision = Number.MAX_SAFE_INTEGER - 1;
        expect(() => prepare(createCombatPartBreakProvider(definitions()), before)).toThrow('revision exhausted');
        expect(before.actors[0]!.poise).toBe(12);
    });
    it('throws atomically when interruption would exceed the scheduler total duration budget', () => {
        const pack = definitions(), attack = pack.attacks.find(attack => attack.id === 'fixture.double-thrust')!;
        attack.windupTicks = 999_900; attack.segments[1]!.delayTicks = 50; attack.recoveryTicks = 50;
        pack.breakRecoveryTicks = 100;
        const before = busy(pack, 'recovery', 1), original = structuredClone(before);
        expect(() => prepare(createCombatPartBreakProvider(pack), before, request({ balanceLoss: 12 }))).toThrow('budget exhausted');
        expect(before).toEqual(original);
    });
});
