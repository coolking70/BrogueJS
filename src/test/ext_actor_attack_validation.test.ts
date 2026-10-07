import type {ActorActionsRoot} from '../engine/Core/ActorActionsRoot';
type AttackFixture=ProductionActorAttackState & {actorActions:ActorActionsRoot};
import { describe, expect, it, vi } from 'vitest';
import { createActorActionBundle } from '../engine/Core/ActorActionScheduler';
import type { ActorAttackDefinitions, ActorAttackFacing, ProductionActorAttackState } from '../ext/actorActions';
import { validateActorAttackDefinitions, validateProductionActorAttackState } from '../ext/actorActionValidation';

const facings: ActorAttackFacing[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
function definitions(): ActorAttackDefinitions {
    return {
        attacks: [{ id: 'fixture.attack', nameKey: 'fixture.attack.name', cost: 4, windupTicks: 10, recoveryTicks: 7,
            segments: [1, 2].map((x, index) => ({ delayTicks: index === 0 ? 0 : 5,
                shape: { kind: 'footprint-offset-union', offsets: Object.fromEntries(facings.map(facing => [facing, [{ x, y: 0 }]])) as Record<ActorAttackFacing, {x:number;y:number}[]>,
                    selfExclusion: 'whole-group', occlusion: 'line-of-effect' },
                locationPolicy: 'locked-world', targetPolicy: 'part', damageProfile: 'native-melee', poiseDamage: 2, dodgeable: true, parryable: false })) }],
        profiles: [{ id: 'fixture.profile', resourcePolicyId: 'fixture.resource', attackIds: ['fixture.attack'] }],
        resourcePolicies: [{ id: 'fixture.resource', initialStamina: 24, staminaCapacity: 24, regenPerTickNumerator: 1,
            regenPerTickDenominator: 20, regenDelayTicks: 40, nativeAttackCost: 2, regenPhases: ['idle', 'recovery', 'break-recovery'],
            poiseCapacity: 12, poiseRecoveryNumerator: 1, poiseRecoveryDenominator: 30, poiseRecoveryDelayTicks: 40,
            poiseBreakRecoveryValue: 12, nativePoiseDamage: 2, poiseImmune: false }],
        nativeProfiles: [{ monsterId: 'rat', profileId: 'fixture.profile' }], playerProfileId: 'fixture.profile', breakRecoveryTicks: 50,
        dodge: { cost: 4, windowTicks: 40, recoveryTicks: 80 },
        parry: { cost: 3, windowTicks: 60, recoveryTicks: 100, poiseDamage: 12, contactRange: 1 },
    };
}
function fixture(): { definitions: ActorAttackDefinitions; state: AttackFixture } {
    const pack = definitions();
    return { definitions: pack, state: {
        schema: 4, revision: 1,
        actorActions: { schema: 1,nextActionId:2, bundles: [createActorActionBundle({owner:'combat',  actionId: 1, depth: 1, decisionOwnerId: 10, timeChargeOwnerId: 10,
            subactions: [{ sourceEntityId: 10, sourcePartId: 'body', sourceFootprintVersion: 'fixture:source-v1', phases: [
                { kind: 'windup', durationTicks: 10, segmentIndex: 0 },
                { kind: 'inter-segment', durationTicks: 5, segmentIndex: 1 },
                { kind: 'recovery', durationTicks: 7, segmentIndex: null },
            ] }] })] },
        actions: [{ actionId: 1, profileId: 'fixture.profile', paidCost: 4,
            subactions: [{ sourceSubactionId: 1, attackId: 'fixture.attack', facing: 'e', lockedCells: [{ x: 11, y: 10 }],
                shape: { schema: 1, kind: 'footprint-offset-union', offsets: [{ x: 1, y: 0 }], selfExclusion: 'whole-group' }, approvedRisks: [] }] }],
        actors: [{ actorId: 10, profileId: 'fixture.profile', stamina: 20, regenRemainder: 0, regenDelayRemaining: 40,
            dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0,
            poise: 12, poiseRecoveryRemainder: 0, poiseRecoveryDelayRemaining: 0,
            parryRemainingTicks: 0, parryRecoveryRemainingTicks: 0, parryFacing: null, staggerRemainingTicks: 0 }],
    } };
}
function check(value: unknown, pack = definitions()): void {
    const actorActions=(value as AttackFixture).actorActions;
    const combat=Object.create(Object.getPrototypeOf(value),Object.getOwnPropertyDescriptors(value));delete combat.actorActions;
    // This fixture has no stat modifiers. 5A2-S obtains effective capacities
    // from the trusted world rather than treating template limits as maxima.
    validateProductionActorAttackState(combat,pack,new Set(),actorActions,(_actorId,policy)=>({
        staminaCapacity:policy.staminaCapacity,poiseCapacity:policy.poiseCapacity,
    }));
}

describe('generic production attack state codec', () => {
    it('validates declarations and a lazy empty binding without module state or a second clock', () => {
        const pack = definitions();
        expect(() => validateActorAttackDefinitions(pack)).not.toThrow();
        expect(() => check({ schema: 4, revision: 0, actorActions: { schema: 1,nextActionId:1, bundles: [] }, actions: [], actors: [] }, pack)).not.toThrow();
        const { state } = fixture(), before = structuredClone(state);
        expect(() => check(state, pack)).not.toThrow();
        expect(state).toEqual(before);
    });

    it('rejects the previous production schema and incomplete resource rows', () => {
        const { state } = fixture();
        expect(() => check({ ...state, schema: 2 }, definitions())).toThrow(/schema/);
        const actor = { ...state.actors[0]! } as Partial<AttackFixture['actors'][number]>;
        delete actor.regenRemainder;
        expect(() => check({ ...state, actors: [actor] }, definitions())).toThrow();
    });

    it('validates dodge remaining time without accepting an attack scheduler bundle', () => {
        const { state } = fixture(), row = state.actors[0]!;
        row.dodgeRemainingTicks = 40; row.dodgeRecoveryRemainingTicks = 80;
        expect(() => check(state)).toThrow(/dodge cannot share/);
        state.actorActions.bundles = []; state.actions = [];
        expect(() => check(state)).not.toThrow();
        row.dodgeRemainingTicks = 20; row.dodgeRecoveryRemainingTicks = 60;
        expect(() => check(state)).not.toThrow();
        row.dodgeRecoveryRemainingTicks = 40;
        expect(() => check(state)).toThrow(/dodge clock/);
        // A displacement may cancel protection early while paid recovery persists.
        row.dodgeRemainingTicks = 0;
        expect(() => check(state)).not.toThrow();
    });

    it.each([
        { regenRemainder: -1 }, { regenRemainder: 20 }, { stamina: 24, regenRemainder: 1 },
        { regenDelayRemaining: -1 }, { regenDelayRemaining: 41 }, { dodgeRemainingTicks: -1 },
        { dodgeRemainingTicks: 41 }, { dodgeRecoveryRemainingTicks: -1 }, { dodgeRecoveryRemainingTicks: 81 },
    ])('rejects invalid fixed-point resource fields %j', patch => {
        const { state } = fixture();
        Object.assign(state.actors[0]!, patch);
        expect(() => check(state)).toThrow();
    });

    it('cross-checks the current segment shape and keeps recovery previews empty', () => {
        const { state } = fixture(), bundle = state.actorActions.bundles[0]!, child = bundle.subactions[0]!, meta = state.actions[0]!.subactions[0]!;
        bundle.elapsedActionTicks = 12; child.phaseIndex = 1; child.phaseRemainingTicks = 3;
        expect(() => check(state)).toThrow(/shape mismatch/);
        meta.shape.offsets = [{ x: 2, y: 0 }];
        expect(() => check(state)).not.toThrow();
        bundle.elapsedActionTicks = 17; child.phaseIndex = 2; child.phaseRemainingTicks = 5;
        expect(() => check(state)).toThrow(/preview/);
        meta.lockedCells = [];
        expect(() => check(state)).not.toThrow();
        meta.shape.offsets = [{ x: 1, y: 0 }];
        expect(() => check(state)).toThrow(/shape mismatch/);
    });

    it('accepts elapsed-preserving break recovery and validates its immutable prefix', () => {
        const { state } = fixture(), bundle = state.actorActions.bundles[0]!, child = bundle.subactions[0]!, meta = state.actions[0]!.subactions[0]!;
        bundle.elapsedActionTicks = 13;
        child.phases = [child.phases[0]!, { kind: 'break-recovery', durationTicks: 53, segmentIndex: null }];
        child.phaseIndex = 1; child.phaseRemainingTicks = 50; meta.lockedCells = []; meta.shape.offsets = [{ x: 2, y: 0 }];
        expect(() => check(state)).not.toThrow();
        bundle.elapsedActionTicks += 10; child.phaseRemainingTicks -= 10;
        expect(() => check(state)).not.toThrow();
        child.phases[0]!.durationTicks++; bundle.elapsedActionTicks++;
        expect(() => check(state)).toThrow(/timing mismatch/);
    });

    it('permits break recovery before the first release and after the final release', () => {
        const before = fixture().state, bundle = before.actorActions.bundles[0]!, child = bundle.subactions[0]!;
        bundle.elapsedActionTicks = 3; child.phases = [{ kind: 'break-recovery', durationTicks: 53, segmentIndex: null }];
        child.phaseRemainingTicks = 50; before.actions[0]!.subactions[0]!.lockedCells = [];
        expect(() => check(before)).not.toThrow();
        const after = fixture().state, other = after.actorActions.bundles[0]!, next = other.subactions[0]!;
        other.elapsedActionTicks = 17; next.phaseIndex = 2; next.phaseRemainingTicks = 50;
        next.phases[2] = { kind: 'break-recovery', durationTicks: 52, segmentIndex: null };
        after.actions[0]!.subactions[0]!.lockedCells = []; after.actions[0]!.subactions[0]!.shape.offsets = [{ x: 2, y: 0 }];
        expect(() => check(after)).not.toThrow();
        next.phases[2]!.durationTicks = 58; other.elapsedActionTicks = 23;
        expect(() => check(after)).toThrow(/break recovery/);
    });

    it('allows a cancelled source to retain inert geometry while a sibling continues', () => {
        const { state } = fixture(), bundle = state.actorActions.bundles[0]!, child = bundle.subactions[0]!;
        const sibling = structuredClone(child); sibling.sourceEntityId = 20; sibling.sourcePartId = 'leg'; sibling.sourceSubactionId = 2;
        bundle.subactions.push(sibling); child.cancelled = true; child.phaseIndex = child.phases.length; child.phaseRemainingTicks = 0;
        const metadata = structuredClone(state.actions[0]!.subactions[0]!); metadata.sourceSubactionId = 2;
        state.actions[0]!.subactions.push(metadata); state.actions[0]!.paidCost = 8;
        expect(() => check(state)).not.toThrow();
        sibling.sourceEntityId = 10;
        expect(() => check(state)).toThrow(/identity/);
    });

    it.each([
        (state: AttackFixture) => { state.actions = []; },
        (state: AttackFixture) => { state.actions.push(structuredClone(state.actions[0]!)); },
        (state: AttackFixture) => { state.actions[0]!.actionId = 2; },
        (state: AttackFixture) => { state.actorActions.nextActionId = 1; },
        (state: AttackFixture) => { state.revision = -1; },
        (state: AttackFixture) => { state.actions[0]!.paidCost++; },
        (state: AttackFixture) => { state.actions[0]!.subactions[0]!.sourceSubactionId = 2; },
        (state: AttackFixture) => { state.actors = []; },
        (state: AttackFixture) => { state.actors[0]!.profileId = 'missing'; },
        (state: AttackFixture) => { state.actors[0]!.stamina = 25; },
        (state: AttackFixture) => { state.actors.push(structuredClone(state.actors[0]!)); },
        (state: AttackFixture) => { state.actorActions.bundles[0]!.elapsedActionTicks = 1; },
        (state: AttackFixture) => { state.actorActions.bundles[0]!.subactions[0]!.phases[1]!.durationTicks++; },
        (state: AttackFixture) => { state.actions[0]!.subactions[0]!.lockedCells.push({ x: 11, y: 10 }); },
        (state: AttackFixture) => { state.actions[0]!.subactions[0]!.lockedCells.push({ x: 10, y: 10 }); },
        (state: AttackFixture) => { state.actions[0]!.subactions[0]!.lockedCells[0]!.x = 1_000_001; },
    ])('rejects mismatched identities, timing, resources or cell bounds %#', mutate => {
        const { state } = fixture(); mutate(state);
        expect(() => check(state)).toThrow();
    });

    it('accepts only unique attack-risk approvals bound to the stated target', () => {
        const { state } = fixture(), approvals = state.actions[0]!.subactions[0]!.approvedRisks;
        approvals.push({ targetId: 30, risks: [] });
        expect(() => check(state)).not.toThrow();
        approvals.length = 0;
        approvals.push({ targetId: 20, risks: [{ kind: 'acid', target: { kind: 'creature', id: 20 }, message: 'fixture-risk' }] });
        expect(() => check(state)).not.toThrow();
        approvals[0]!.risks[0] = { kind: 'fire', target: { kind: 'cell', x: 1, y: 1 }, message: 'fixture-risk' };
        expect(() => check(state)).toThrow(/risk/);
        approvals[0]!.risks[0] = { kind: 'acid', target: { kind: 'creature', id: 21 }, message: 'fixture-risk' };
        expect(() => check(state)).toThrow(/target/);
        approvals[0]!.risks[0] = { kind: 'acid', target: { kind: 'creature', id: 20 }, message: 'fixture-risk' };
        approvals[0]!.risks.push(structuredClone(approvals[0]!.risks[0]!));
        expect(() => check(state)).toThrow(/risk/);
    });

    it('rejects hidden state and nested accessors without invoking getters', () => {
        const { state } = fixture(), getter = vi.fn(() => 1);
        Object.defineProperty(state.actions[0]!.subactions[0]!.shape.offsets[0]!, 'x', { enumerable: true, get: getter });
        expect(() => check(state)).toThrow(/descriptor/); expect(getter).not.toHaveBeenCalled();
        const pack = definitions(); Object.defineProperty(pack.attacks[0]!, 'cost', { enumerable: true, get: getter });
        expect(() => validateActorAttackDefinitions(pack)).toThrow(/descriptor/); expect(getter).not.toHaveBeenCalled();
        const other = fixture().state;
        Object.assign(other.actions[0]!.subactions[0]!, { phaseRemainingTicks: 10 });
        expect(() => check(other)).toThrow(/DTO/);
    });

    it('rejects non-JSON objects, array prototypes, symbols, sparse data and cycles', () => {
        const mutations: ((state: AttackFixture) => void)[] = [
            state => { Object.setPrototypeOf(state.actors, { inherited: true }); },
            state => { Object.defineProperty(state, 'hidden', { value: true }); },
            state => { Object.assign(state, { [Symbol('hidden')]: true }); },
            state => { state.actors = Array(1); },
            state => { Object.assign(state, { cycle: state }); },
            state => { Object.setPrototypeOf(state, { inherited: true }); },
        ];
        for (const mutate of mutations) { const { state } = fixture(); mutate(state); expect(() => check(state)).toThrow(); }
    });

    it.each([
        (pack: ActorAttackDefinitions) => { pack.profiles[0]!.attackIds.push('fixture.attack'); },
        (pack: ActorAttackDefinitions) => { pack.profiles[0]!.resourcePolicyId = 'missing'; },
        (pack: ActorAttackDefinitions) => { pack.playerProfileId = 'missing'; },
        (pack: ActorAttackDefinitions) => { pack.nativeProfiles.push(structuredClone(pack.nativeProfiles[0]!)); },
        (pack: ActorAttackDefinitions) => { pack.attacks[0]!.segments[0]!.delayTicks = 1; },
        (pack: ActorAttackDefinitions) => { pack.attacks[0]!.segments[1]!.delayTicks = 0; },
        (pack: ActorAttackDefinitions) => { pack.attacks[0]!.segments[0]!.shape.offsets.e[0]!.x = 33; },
        (pack: ActorAttackDefinitions) => { pack.attacks[0]!.cost = 25; },
        (pack: ActorAttackDefinitions) => { pack.resourcePolicies[0]!.initialStamina = 25; },
        (pack: ActorAttackDefinitions) => { pack.breakRecoveryTicks = 0; },
        (pack: ActorAttackDefinitions) => { pack.resourcePolicies[0]!.nativeAttackCost = 25; },
        (pack: ActorAttackDefinitions) => { pack.resourcePolicies[0]!.regenPerTickNumerator = -1; },
        (pack: ActorAttackDefinitions) => { pack.resourcePolicies[0]!.regenPerTickDenominator = 0; },
        (pack: ActorAttackDefinitions) => { pack.resourcePolicies[0]!.regenDelayTicks = 1_000_001; },
        (pack: ActorAttackDefinitions) => { pack.resourcePolicies[0]!.regenPhases = ['idle', 'idle']; },
        (pack: ActorAttackDefinitions) => { pack.dodge.cost = 25; },
        (pack: ActorAttackDefinitions) => { pack.dodge.windowTicks = 0; },
        (pack: ActorAttackDefinitions) => { pack.dodge.windowTicks = 81; },
        (pack: ActorAttackDefinitions) => { pack.dodge.recoveryTicks = 1_000_001; },

    ])('rejects malformed declaration references, timing and geometry %#', mutate => {
        const pack = definitions(); mutate(pack); expect(() => validateActorAttackDefinitions(pack)).toThrow();
    });
});
