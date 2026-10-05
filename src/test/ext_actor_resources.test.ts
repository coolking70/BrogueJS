import { describe, expect, it } from 'vitest';
import { advanceActorResources, chargeActorResources } from '../engine/Core/ActorResources';
import type { ActorResourcePhase, ActorResourcePolicy, ActorResourceState } from '../ext/actorActions';

function policy(patch: Partial<ActorResourcePolicy> = {}): ActorResourcePolicy {
    return { id: 'fixture.resource', initialStamina: 24, staminaCapacity: 24,
        regenPerTickNumerator: 1, regenPerTickDenominator: 20, regenDelayTicks: 40,
        nativeAttackCost: 2, regenPhases: ['idle', 'recovery', 'break-recovery'],
        poiseCapacity: 12, poiseRecoveryNumerator: 1, poiseRecoveryDenominator: 30, poiseRecoveryDelayTicks: 40,
        poiseBreakRecoveryValue: 12, nativePoiseDamage: 2, poiseImmune: false, ...patch };
}
function resource(patch: Partial<ActorResourceState> = {}): ActorResourceState {
    return { stamina: 20, regenRemainder: 0, regenDelayRemaining: 0,
        dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0,
        poise: 12, poiseRecoveryRemainder: 0, poiseRecoveryDelayRemaining: 0,
        parryRemainingTicks: 0, parryRecoveryRemainingTicks: 0, parryFacing: null, staggerRemainingTicks: 0, ...patch };
}

describe('foundation actor resource arithmetic', () => {
    it('charges once without mutating the input and restarts the declared delay', () => {
        const start = resource({ regenRemainder: 17, regenDelayRemaining: 3 }), before = structuredClone(start);
        expect(chargeActorResources(start, policy(), 4)).toEqual({ ...start, stamina: 16, regenDelayRemaining: 40 });
        expect(start).toEqual(before);
        expect(chargeActorResources(start, policy(), 0)).toEqual({ ...start, regenDelayRemaining: 40 });
        expect(chargeActorResources(start, policy(), 21)).toBeNull();
        expect(start).toEqual(before);
    });

    it('uses only the part of a delta after the regeneration delay expires', () => {
        const start = resource({ regenDelayRemaining: 40 });
        expect(advanceActorResources(start, policy(), 39, ['idle'])).toEqual({ ...start, regenDelayRemaining: 1 });
        expect(advanceActorResources(start, policy(), 40, ['idle'])).toEqual({ ...start, regenDelayRemaining: 0 });
        const almost = advanceActorResources(start, policy(), 59, ['idle']);
        expect(almost).toEqual({ ...start, regenRemainder: 19, regenDelayRemaining: 0 });
        expect(advanceActorResources(almost, policy(), 1, ['idle'])).toEqual({ ...start, stamina: 21, regenDelayRemaining: 0 });
    });

    it('requires every unfinished child phase to permit regeneration', () => {
        const start = resource({ regenDelayRemaining: 40 });
        for (const phases of [['windup'], ['inter-segment'], ['recovery', 'windup']] as ActorResourcePhase[][]) {
            expect(advanceActorResources(start, policy(), 100, phases)).toEqual({ ...start, regenDelayRemaining: 0 });
        }
        expect(advanceActorResources(start, policy(), 100, ['recovery', 'break-recovery']).stamina).toBe(23);
        expect(advanceActorResources(start, policy({ regenPhases: [] }), 100, ['idle']).stamina).toBe(20);
        expect(advanceActorResources(start, policy({ regenPhases: ['windup'] }), 100, ['windup']).stamina).toBe(23);
    });

    it('preserves fractional points through disallowed phases and zero-rate policies', () => {
        const start = resource({ regenRemainder: 19 });
        expect(advanceActorResources(start, policy(), 100, ['windup'])).toEqual(start);
        expect(advanceActorResources(start, policy({ regenPerTickNumerator: 0 }), 100, ['idle'])).toEqual(start);
        expect(advanceActorResources(start, policy(), 1, ['idle'])).toEqual({ ...start, stamina: 21, regenRemainder: 0 });
    });

    it('clamps smaller capacity without refilling larger pools or banking points at full', () => {
        const start = resource({ regenRemainder: 19 });
        expect(advanceActorResources(start, policy({ initialStamina: 10, staminaCapacity: 10 }), 1, ['windup']))
            .toEqual({ ...start, stamina: 10, regenRemainder: 0 });
        expect(advanceActorResources(start, policy({ staminaCapacity: 30 }), 1, ['windup'])).toEqual(start);
        expect(chargeActorResources(start, policy({ initialStamina: 10, staminaCapacity: 10 }), 2))
            .toEqual({ ...start, stamina: 8, regenRemainder: 0, regenDelayRemaining: 40 });
        expect(advanceActorResources(resource({ stamina: 23, regenRemainder: 19 }), policy(), 21, ['idle']))
            .toEqual(resource({ stamina: 24 }));
        expect(advanceActorResources(resource({ stamina: 24 }), policy(), 1_000_000, ['idle']))
            .toEqual(resource({ stamina: 24 }));
    });

    it('expires dodge protection before same-tick resolution and advances recovery only once', () => {
        const start = resource({ dodgeRemainingTicks: 40, dodgeRecoveryRemainingTicks: 80 });
        const at39 = advanceActorResources(start, policy(), 39, ['windup']);
        expect(at39.dodgeRemainingTicks).toBe(1); expect(at39.dodgeRecoveryRemainingTicks).toBe(41);
        const at40 = advanceActorResources(at39, policy(), 1, ['windup']);
        expect(at40.dodgeRemainingTicks).toBe(0); expect(at40.dodgeRecoveryRemainingTicks).toBe(40);
        const at80 = advanceActorResources(at40, policy(), 40, ['windup']);
        expect(at80.dodgeRemainingTicks).toBe(0); expect(at80.dodgeRecoveryRemainingTicks).toBe(0);
        expect(start.dodgeRemainingTicks).toBe(40);
    });

    it('is invariant to subdividing an elapsed delta within one phase (6150 cases)', () => {
        const currentPolicy = policy();
        for (let delay = 0; delay <= 40; delay++) {
            for (let delta = 1; delta <= 150; delta++) {
                const start = resource({ regenDelayRemaining: delay });
                let split = start;
                for (let tick = 0; tick < delta; tick++) split = advanceActorResources(split, currentPolicy, 1, ['idle']);
                expect(advanceActorResources(start, currentPolicy, delta, ['idle'])).toEqual(split);
            }
        }
    });

    it('keeps maximum bounded fixed-point multiplication exact', () => {
        const currentPolicy = policy({ staminaCapacity: 1_000_000, initialStamina: 1_000_000,
            regenPerTickNumerator: 999_999, regenPerTickDenominator: 1_000_000 });
        expect(advanceActorResources(resource({ stamina: 0, regenRemainder: 999_999 }), currentPolicy, 1_000_000, ['idle']))
            .toEqual(resource({ stamina: 999_999, regenRemainder: 999_999 }));
    });

    it.each([0, -1, 0.5, NaN, Infinity, 1_000_001, Number.MAX_SAFE_INTEGER])('rejects invalid elapsed delta %s', delta => {
        expect(() => advanceActorResources(resource(), policy(), delta, ['idle'])).toThrow();
    });

    it('rejects absent or impossible current phases and malformed resource fields', () => {
        for (const phases of [[], ['idle', 'windup'], ['idle', 'idle'], Array(5).fill('recovery'), ['unknown']])
            expect(() => advanceActorResources(resource(), policy(), 1, phases as ActorResourcePhase[])).toThrow();
        for (const patch of [{ stamina: -1 }, { regenRemainder: 20 }, { regenDelayRemaining: 41 },
            { dodgeRemainingTicks: 1, dodgeRecoveryRemainingTicks: 0 }, { dodgeRecoveryRemainingTicks: 1_000_001 }])
            expect(() => advanceActorResources(resource(patch), policy(), 1, ['idle'])).toThrow();
        for (const cost of [-1, 0.5, NaN, Infinity, 1_000_001])
            expect(() => chargeActorResources(resource(), policy(), cost)).toThrow();
    });
});
