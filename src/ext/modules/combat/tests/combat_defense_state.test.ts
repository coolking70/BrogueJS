import { describe, expect, it } from 'vitest';
import { createActorActionBundle } from '../../../../engine/Core/ActorActionScheduler';
import { advanceActorResources, chargeActorResources, initialActorResources } from '../../../../engine/Core/ActorResources';
import { validateActorAttackDefinitions, validateProductionActorAttackState } from '../../../actorActionValidation';
import type { ActorAttackDefinitions, ActorResourcePolicy, ActorResourceState, ProductionActorAttackState } from '../../../actorActions';
import { COMBAT_VERSION, loadCombatDefinitionPack } from '../definitions';
import { combatAttackDefinitions, initialProductionCombatState } from '../production';
import { loadCombatPack } from '../schema';
import data from '../data/definitions.json';
import locale from '../locales/zh_CN.json';
import type { CombatPack } from '../types';

const definitions = (): ActorAttackDefinitions => structuredClone(combatAttackDefinitions(loadCombatDefinitionPack()));
const policy = (patch: Partial<ActorResourcePolicy> = {}): ActorResourcePolicy => ({ ...definitions().resourcePolicies[0]!, ...patch });
const resource = (patch: Partial<ActorResourceState> = {}): ActorResourceState => ({ ...initialActorResources(policy()), ...patch });
function state(patch: Partial<ActorResourceState> = {}): ProductionActorAttackState {
    return { ...initialProductionCombatState(), actors: [{ actorId: 10, profileId: definitions().playerProfileId, ...resource(patch) }] };
}
const validate = (value: unknown, pack = definitions()): void => validateProductionActorAttackState(value, pack);
function attackState(): ProductionActorAttackState {
    const result = state(), pack = definitions(), attack = pack.attacks[0]!, segment = attack.segments[0]!;
    result.nextActionId = 2;
    result.scheduler.bundles.push(createActorActionBundle({ actionId: 1, depth: 1, decisionOwnerId: 10, timeChargeOwnerId: 10,
        subactions: [{ sourceEntityId: 10, sourcePartId: 'body', sourceFootprintVersion: 'fixture-v1',
            phases: [{ kind: 'windup', durationTicks: attack.windupTicks, segmentIndex: 0 },
                { kind: 'recovery', durationTicks: attack.recoveryTicks, segmentIndex: null }] }] }));
    result.actions.push({ actionId: 1, profileId: pack.playerProfileId, paidCost: attack.cost,
        subactions: [{ sourceSubactionId: 1, attackId: attack.id, facing: 'e', lockedCells: [{ x: 11, y: 10 }],
            shape: { schema: 1, kind: 'footprint-offset-union', offsets: structuredClone(segment.shape.offsets.e),
                selfExclusion: segment.shape.selfExclusion }, approvedRisks: [] }] });
    return result;
}

describe('combat 3d data and strict defense state', () => {
    it('exposes versioned data-driven parry, poise policy and segment damage through the foundation DTO', () => {
        const pack = loadCombatDefinitionPack(), dto = combatAttackDefinitions(pack);
        expect(COMBAT_VERSION).toBe('1.4.0'); expect(initialProductionCombatState().schema).toBe(3);
        expect(dto.parry).toEqual({ cost: 3, windowTicks: 60, recoveryTicks: 100, poiseDamage: 12, contactRange: 1 });
        expect(dto.resourcePolicies).toEqual(pack.resourcePolicies);
        expect(dto.attacks.map(attack => attack.segments.map(segment => segment.poiseDamage)))
            .toEqual(pack.attacks.map(attack => attack.segments.map(segment => segment.poiseDamage)));
        expect(() => validateActorAttackDefinitions(dto)).not.toThrow();
        expect(() => validate(initialProductionCombatState(), dto)).not.toThrow();
        expect(() => validate(state(), dto)).not.toThrow();
    });
    it.each([
        ['cost', -1], ['cost', 25], ['windowTicks', 0], ['windowTicks', 101], ['windowTicks', 1.5],
        ['recoveryTicks', 0], ['recoveryTicks', 1_000_001], ['poiseDamage', -1], ['poiseDamage', 1_000_001],
        ['contactRange', 0], ['contactRange', 33], ['contactRange', Infinity],
    ])('rejects malformed parry %s=%s in both loaders', (key, value) => {
        const pack = structuredClone(data) as CombatPack, dto = definitions();
        Object.assign(pack.parry, { [key!]: value }); Object.assign(dto.parry, { [key!]: value });
        expect(() => loadCombatPack(pack, locale)).toThrow();
        expect(() => validateActorAttackDefinitions(dto)).toThrow();
    });
    it.each([
        ['poiseCapacity', 0], ['poiseRecoveryNumerator', -1], ['poiseRecoveryDenominator', 0],
        ['poiseRecoveryDelayTicks', -1], ['poiseRecoveryDelayTicks', 1_000_001], ['poiseBreakRecoveryValue', 0],
        ['poiseBreakRecoveryValue', 13], ['nativePoiseDamage', -1], ['nativePoiseDamage', 1_000_001],
        ['poiseImmune', 1], ['poiseImmune', 'false'],
    ])('rejects malformed poise policy %s=%s in both loaders', (key, value) => {
        const pack = structuredClone(data) as CombatPack, dto = definitions();
        Object.assign(pack.resourcePolicies[0]!, { [key!]: value }); Object.assign(dto.resourcePolicies[0]!, { [key!]: value });
        expect(() => loadCombatPack(pack, locale)).toThrow();
        expect(() => validateActorAttackDefinitions(dto)).toThrow();
    });
    it('rejects omitted and extra defense keys and the previous schema without repairing anything', () => {
        const current = state();
        expect(() => validate({ ...current, schema: 2 })).toThrow(/schema/);
        for (const key of ['poise', 'poiseRecoveryRemainder', 'poiseRecoveryDelayRemaining', 'parryRemainingTicks',
            'parryRecoveryRemainingTicks', 'parryFacing', 'staggerRemainingTicks']) {
            const broken = structuredClone(current);
            delete (broken.actors[0] as unknown as Record<string, unknown>)[key];
            expect(() => validate(broken)).toThrow();
        }
        const extra = structuredClone(current); Object.assign(extra.actors[0]!, { defenseDeadline: 100 });
        expect(() => validate(extra)).toThrow();
        expect(current).toEqual(state());
    });
    it.each([
        { poise: -1 }, { poise: 13 }, { poiseRecoveryRemainder: -1 }, { poiseRecoveryRemainder: 30 },
        { poise: 12, poiseRecoveryRemainder: 1 }, { poiseRecoveryDelayRemaining: -1 }, { poiseRecoveryDelayRemaining: 41 },
        { parryRemainingTicks: -1 }, { parryRemainingTicks: 61 }, { parryRecoveryRemainingTicks: -1 },
        { parryRecoveryRemainingTicks: 101 }, { staggerRemainingTicks: -1 }, { staggerRemainingTicks: 1_000_001 },
    ])('rejects bounded-resource and clock violations %j', patch => {
        expect(() => validate(state(patch))).toThrow();
    });
    it('requires a live canonical window and valid frozen facing, clearing it on consumption or expiry', () => {
        const current = state({ parryRemainingTicks: 60, parryRecoveryRemainingTicks: 100, parryFacing: 'e' });
        expect(() => validate(current)).not.toThrow();
        Object.assign(current.actors[0]!, { parryRemainingTicks: 1, parryRecoveryRemainingTicks: 41 });
        expect(() => validate(current)).not.toThrow();
        current.actors[0]!.parryRecoveryRemainingTicks = 40; expect(() => validate(current)).toThrow(/parry clock/);
        current.actors[0]!.parryRemainingTicks = 0; expect(() => validate(current)).toThrow(/facing/);
        current.actors[0]!.parryFacing = null; expect(() => validate(current)).not.toThrow();
        Object.assign(current.actors[0]!, { parryRemainingTicks: 60, parryRecoveryRemainingTicks: 100, parryFacing: 'east' });
        expect(() => validate(current)).toThrow(/facing/);
        current.actors[0]!.parryFacing = null; expect(() => validate(current)).toThrow(/facing/);
    });
    it('rejects concurrent defense clocks and an already recovered stagger', () => {
        expect(() => validate(state({ parryRemainingTicks: 60, parryRecoveryRemainingTicks: 100, parryFacing: 'e',
            dodgeRecoveryRemainingTicks: 20 }))).toThrow(/overlapping/);
        expect(() => validate(state({ poise: 0, staggerRemainingTicks: 50, parryRecoveryRemainingTicks: 10 }))).toThrow(/overlapping/);
        expect(() => validate(state({ poise: 0, staggerRemainingTicks: 50, dodgeRecoveryRemainingTicks: 10 }))).toThrow(/overlapping/);
        expect(() => validate(state({ staggerRemainingTicks: 50 }))).toThrow(/stagger/);
        expect(() => validate(state({ poise: 0, poiseRecoveryRemainder: 1, staggerRemainingTicks: 50 }))).toThrow(/stagger/);
        const immune = definitions(); immune.resourcePolicies[0]!.poiseImmune = true;
        expect(() => validate(state({ poise: 0, staggerRemainingTicks: 50 }), immune)).not.toThrow();
        expect(() => validate(state({ poise: 0, staggerRemainingTicks: 500 }))).not.toThrow();
    });
    it('rejects separate defense/stagger clocks overlapping any attack bundle', () => {
        const current = attackState(); expect(() => validate(current)).not.toThrow();
        Object.assign(current.actors[0]!, { parryRemainingTicks: 60, parryRecoveryRemainingTicks: 100, parryFacing: 'e' });
        expect(() => validate(current)).toThrow(/parry cannot share/);
        Object.assign(current.actors[0]!, { parryRemainingTicks: 0, parryRecoveryRemainingTicks: 0, parryFacing: null,
            staggerRemainingTicks: 50, poise: 0 });
        expect(() => validate(current)).toThrow(/stagger cannot share/);
        // The existing scheduler may own an interrupted attack's break recovery;
        // resource state must not retain another countdown for that recovery.
        current.actors[0]!.staggerRemainingTicks = 0;
        const child = current.scheduler.bundles[0]!.subactions[0]!;
        child.phases = [{ kind: 'break-recovery', durationTicks: 50, segmentIndex: null }];
        child.phaseRemainingTicks = 50; current.actions[0]!.subactions[0]!.lockedCells = [];
        expect(() => validate(current)).not.toThrow();
    });
    it('rejects phantom zero-poise idle and windup rows, accepting only an owned active break tail', () => {
        expect(() => validate(state({ poise: 0 }))).toThrow(/zero poise without stagger/);
        const current = attackState();
        current.actors[0]!.poise = 0;
        expect(() => validate(current)).toThrow(/zero poise without stagger/);
        const child = current.scheduler.bundles[0]!.subactions[0]!;
        // A future break tail cannot legitimize a zero-poise windup.
        child.phases[1] = { kind: 'break-recovery', durationTicks: 50, segmentIndex: null };
        expect(() => validate(current)).toThrow(/zero poise without stagger/);
        child.phases = [{ kind: 'break-recovery', durationTicks: 50, segmentIndex: null }];
        child.phaseRemainingTicks = 50; current.actions[0]!.subactions[0]!.lockedCells = [];
        expect(() => validate(current)).not.toThrow();
        // Another actor's valid recovery cannot own this row's poise break.
        current.actors.push({ actorId: 20, profileId: definitions().playerProfileId, ...resource({ poise: 0 }) });
        expect(() => validate(current)).toThrow(/zero poise without stagger/);
    });
});

describe('shared pure poise and defense arithmetic', () => {
    it('initializes at capacity and preserves every defense field when charging stamina', () => {
        expect(initialActorResources(policy())).toEqual(resource());
        const start = resource({ poise: 8, poiseRecoveryRemainder: 17, poiseRecoveryDelayRemaining: 3,
            parryRemainingTicks: 60, parryRecoveryRemainingTicks: 100, parryFacing: 'nw' });
        const before = structuredClone(start);
        expect(chargeActorResources(start, policy(), 3)).toEqual({ ...start, stamina: 21, regenDelayRemaining: 40 });
        expect(chargeActorResources(start, policy(), 25)).toBeNull(); expect(start).toEqual(before);
    });
    it('recovers only the fixed-point portion after poise delay and never banks while full', () => {
        const start = resource({ poise: 5, poiseRecoveryRemainder: 29, poiseRecoveryDelayRemaining: 40 });
        expect(advanceActorResources(start, policy(), 40, ['windup'])).toEqual({ ...start, poiseRecoveryDelayRemaining: 0 });
        expect(advanceActorResources(start, policy(), 41, ['windup']))
            .toEqual({ ...start, poise: 6, poiseRecoveryRemainder: 0, poiseRecoveryDelayRemaining: 0 });
        expect(advanceActorResources(resource({ poise: 11, poiseRecoveryRemainder: 29 }), policy(), 50, ['idle'])).toEqual(resource());
    });
    it('expires parry before same-tick hits, clears its frozen facing and advances recovery once', () => {
        const start = resource({ parryRemainingTicks: 60, parryRecoveryRemainingTicks: 100, parryFacing: 's' });
        const oneLeft = advanceActorResources(start, policy(), 59, ['recovery']);
        expect(oneLeft).toEqual({ ...start, parryRemainingTicks: 1, parryRecoveryRemainingTicks: 41 });
        const expired = advanceActorResources(oneLeft, policy(), 1, ['recovery']);
        expect(expired).toEqual({ ...start, parryRemainingTicks: 0, parryRecoveryRemainingTicks: 40, parryFacing: null });
        expect(advanceActorResources(expired, policy(), 40, ['recovery'])).toEqual(resource());
        expect(start.parryRemainingTicks).toBe(60);
    });
    it('does not regenerate during either kind of stagger and resets native poise at the exact terminal boundary', () => {
        const start = resource({ poise: 0, staggerRemainingTicks: 50, poiseRecoveryDelayRemaining: 40 });
        const almost = advanceActorResources(start, policy(), 49, ['break-recovery']);
        expect(almost).toEqual({ ...start, staggerRemainingTicks: 1, poiseRecoveryDelayRemaining: 0 });
        expect(advanceActorResources(almost, policy(), 1, ['break-recovery'])).toEqual(resource());
        const schedulerOwned = resource({ poise: 0, poiseRecoveryDelayRemaining: 20 });
        expect(advanceActorResources(schedulerOwned, policy(), 50, ['break-recovery']))
            .toEqual({ ...schedulerOwned, poiseRecoveryDelayRemaining: 0 });
        expect(advanceActorResources(schedulerOwned, policy(), 50, ['recovery', 'break-recovery']).poise).toBe(0);
    });
    it('preserves existing stagger across an immunity policy change and uses the new terminal reset', () => {
        const start = resource({ poise: 0, staggerRemainingTicks: 50 });
        const immune = policy({ poiseImmune: true, poiseBreakRecoveryValue: 6 });
        const almost = advanceActorResources(start, immune, 49, ['break-recovery']);
        expect(almost).toEqual({ ...start, staggerRemainingTicks: 1 });
        expect(advanceActorResources(almost, immune, 1, ['break-recovery'])).toEqual(resource({ poise: 6 }));
        expect(start.staggerRemainingTicks).toBe(50);
    });
    it('uses the configured break reset value and only post-expiry elapsed for further recovery', () => {
        const lowReset = policy({ poiseBreakRecoveryValue: 1 });
        const start = resource({ poise: 0, staggerRemainingTicks: 50 });
        expect(advanceActorResources(start, lowReset, 79, ['idle']))
            .toEqual(resource({ poise: 1, poiseRecoveryRemainder: 29 }));
        expect(advanceActorResources(start, lowReset, 80, ['idle'])).toEqual(resource({ poise: 2 }));
        const delayed = policy({ poiseBreakRecoveryValue: 1, poiseRecoveryDelayTicks: 100 });
        expect(advanceActorResources({ ...start, poiseRecoveryDelayRemaining: 100 }, delayed, 80, ['idle']))
            .toEqual(resource({ poise: 1, poiseRecoveryDelayRemaining: 20 }));
    });
    it('clamps reduced poise without filling expanded capacity or dropping defense state', () => {
        const start = resource({ poise: 10, poiseRecoveryRemainder: 29, parryRemainingTicks: 10,
            parryRecoveryRemainingTicks: 50, parryFacing: 'e' });
        expect(chargeActorResources(start, policy({ poiseCapacity: 8, poiseBreakRecoveryValue: 8 }), 0))
            .toEqual({ ...start, poise: 8, poiseRecoveryRemainder: 0, regenDelayRemaining: 40 });
        expect(chargeActorResources(start, policy({ poiseCapacity: 20 }), 0)).toEqual({ ...start, regenDelayRemaining: 40 });
    });
    it('preserves fixed-point additivity across delay, stagger, and parry endpoints', () => {
        const currentPolicy = policy({ poiseBreakRecoveryValue: 1 });
        for (const start of [resource({ poise: 2, poiseRecoveryRemainder: 17, poiseRecoveryDelayRemaining: 23 }),
            resource({ poise: 0, staggerRemainingTicks: 50, poiseRecoveryDelayRemaining: 40 }),
            resource({ poise: 3, parryRemainingTicks: 60, parryRecoveryRemainingTicks: 100, parryFacing: 'e' })]) {
            for (let delta = 1; delta <= 150; delta++) {
                let split = start;
                for (let tick = 0; tick < delta; tick++) split = advanceActorResources(split, currentPolicy, 1, ['idle']);
                expect(advanceActorResources(start, currentPolicy, delta, ['idle'])).toEqual(split);
            }
        }
    });
    it('keeps maximum bounded poise multiplication exact', () => {
        const large = policy({ poiseCapacity: 1_000_000, poiseRecoveryNumerator: 999_999, poiseRecoveryDenominator: 1_000_000 });
        const start = resource({ poise: 0, poiseRecoveryRemainder: 999_999 });
        expect(advanceActorResources(start, large, 1_000_000, ['idle']))
            .toEqual({ ...start, poise: 999_999, poiseRecoveryRemainder: 999_999 });
    });
});
