import { describe, expect, it, vi } from 'vitest';
import { rng } from '../../../../engine/Random';
import { extensionDataFingerprint } from '../../../fingerprint';
import { loadCombatDefinitionPack } from '../definitions';
import { initialCombatResources, validateCombatAction, validateCombatResources, validateCombatSource, validateLockedCells, attackTiming } from '../components';
import { initialCombatState, validateCombatState } from '../state';
import { deduplicatePartContacts, planCombatBundle, type BundleRequest, type ShapeProjection } from '../planner';
import type { CombatAction, CombatSource } from '../types';

const pack = loadCombatDefinitionPack();
const clone = <T>(value: T): T => structuredClone(value);
function source(entityId = 1, partId = 'body'): CombatSource {
    return { entityId, partId, generation: 1, footprintId: 'builtin.single', pose: 'r0',
        sourceFootprintVersion: extensionDataFingerprint({ entityId, partId, generation: 1, footprintId: 'builtin.single', pose: 'r0', cells: [{ x: entityId, y: 1 }] }) };
}
function request(): BundleRequest {
    return { schema: 1, revision: 0, sessionRevision: 7, coreEntityId: 1, decisionOwnerId: 1, timeChargeOwnerId: 1,
        groupId: 1, depth: 1, profileId: 'fixture.profile', eligible: true,
        resources: initialCombatResources(pack, 'fixture.resources'), groupFootprint: [{ x: 1, y: 1 }],
        subactions: [{ source: source(), attackId: 'fixture.slash', facing: 'e', footprint: [{ x: 1, y: 1 }] }] };
}
// A deterministic geometry *test double*. Production geometry remains foundation-owned.
const projection: ShapeProjection = () => [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }];
function action(attackId = 'fixture.slash'): CombatAction {
    const input = request(); input.subactions[0]!.attackId = attackId;
    const result = planCombatBundle(pack, initialCombatState(), input, projection);
    if (result.status !== 'ready') throw new Error('fixture rejected');
    return clone({ ...result.plan.action, actionId: 1 });
}

describe('combat pure bundle preflight', () => {
    it('plans a detached frozen single-member action without IDs, costs, state writes or RNG', () => {
        const input = request(), state = initialCombatState(), before = { input: clone(input), state: clone(state), rng: rng.getState() };
        const result = planCombatBundle(pack, state, input, projection);
        expect(result.status).toBe('ready');
        if (result.status !== 'ready') return;
        expect(result.plan.action).not.toHaveProperty('actionId');
        expect(result.plan.durationTicks).toBe(90); expect(result.plan.nextBoundaryTicks).toBe(50);
        expect(result.plan.action.paidCost).toBe(4);
        expect(result.plan.action.decisionOwnerId).toBe(1); expect(result.plan.action.timeChargeOwnerId).toBe(1);
        expect(result.plan.sessionRevision).toBe(7); expect(result.plan.action).not.toHaveProperty('sessionRevision');
        expect(Object.isFrozen(result.plan.action.subactions[0]!.lockedCells[0])).toBe(true);
        expect(input).toEqual(before.input); expect(state).toEqual(before.state); expect(rng.getState()).toEqual(before.rng);
        input.subactions[0]!.source.generation = 2;
        expect(result.plan.action.subactions[0]!.source.generation).toBe(1);
        expect(validateCombatAction({ ...result.plan.action, actionId: 1 }, pack)).toEqual({ ...result.plan.action, actionId: 1 });
    });
    it('uses member footprint plus relative shape, stable part order, one core, summed costs and MAX duration', () => {
        const input = request(); input.groupFootprint = [1, 2, 3, 4].map(x => ({ x, y: 1 }));
        input.subactions = ['z-tail', 'c-head', 'a-arm', 'b-arm'].map((partId, i) => ({ source: source(i + 1, partId),
            attackId: i === 1 ? 'fixture.stomp' : i === 2 ? 'fixture.double-thrust' : 'fixture.slash', facing: 'ne', footprint: [{ x: i + 1, y: 1 }] }));
        const adapter = vi.fn(projection), before = clone(input);
        const result = planCombatBundle(pack, initialCombatState(), input, adapter);
        if (result.status !== 'ready') throw new Error('expected plan');
        expect(result.plan.action.subactions.map(sub => [sub.source.partId, sub.sourceSubactionId])).toEqual([['a-arm', 1], ['b-arm', 2], ['c-head', 3], ['z-tail', 4]]);
        expect(result.plan.durationTicks).toBe(170); expect(result.plan.nextBoundaryTicks).toBe(40); expect(result.plan.action.paidCost).toBe(21);
        expect(adapter).toHaveBeenCalledTimes(4);
        for (const [call] of adapter.mock.calls) {
            expect(call.footprint).toHaveLength(1); expect(call.groupFootprint).toHaveLength(4);
            expect(call.shape.kind).toBe('footprint-offset-union'); expect(call.shape.selfExclusion).toBe('whole-group');
            expect(call.shape.offsets.ne.length).toBeGreaterThan(0); expect(Object.isFrozen(call.footprint[0])).toBe(true);
        }
        expect(input).toEqual(before);
        expect(validateCombatAction({ ...result.plan.action, actionId: 1 }, pack)).toBeDefined();
        const reordered = clone(input); reordered.subactions.reverse();
        expect(planCombatBundle(pack, initialCombatState(), reordered, projection)).toEqual(result);
    });
    it('does not project future segments and cannot enable live geometry without a foundation adapter', () => {
        const input = request(); input.subactions[0]!.attackId = 'fixture.double-thrust';
        expect(planCombatBundle(pack, initialCombatState(), input)).toEqual({ status: 'rejected', reason: 'foundation-unavailable' });
        const adapter = vi.fn(projection); const result = planCombatBundle(pack, initialCombatState(), input, adapter);
        expect(adapter).toHaveBeenCalledTimes(1);
        if (result.status !== 'ready') throw new Error('expected plan');
        expect(result.plan.durationTicks).toBe(130); expect(result.plan.nextBoundaryTicks).toBe(40);
        expect(result.plan.action.subactions[0]!.nextSegmentIndex).toBe(0);
    });
    it.each(['stale', 'ineligible', 'insufficient-stamina'] as const)('rejects %s without projection or state/RNG changes', reason => {
        const input = request(); if (reason === 'stale') input.revision = 1;
        if (reason === 'ineligible') input.eligible = false; if (reason === 'insufficient-stamina') input.resources.stamina = 0;
        const adapter = vi.fn(projection), before = clone(input), rngBefore = rng.getState();
        expect(planCombatBundle(pack, initialCombatState(), input, adapter)).toEqual({ status: 'rejected', reason });
        expect(adapter).not.toHaveBeenCalled(); expect(input).toEqual(before); expect(rng.getState()).toEqual(rngBefore);
    });
    it('allows a valid empty telegraph without inventing an alternative target', () => {
        const result = planCombatBundle(pack, initialCombatState(), request(), () => []);
        if (result.status !== 'ready') throw new Error('expected empty swing');
        expect(result.plan.action.subactions[0]!.lockedCells).toEqual([]); expect(validateCombatAction({ ...result.plan.action, actionId: 1 }, pack)).toBeDefined();
    });
    it.each([
        (v: BundleRequest) => { v.timeChargeOwnerId = 2; },
        (v: BundleRequest) => { v.decisionOwnerId = 2; },
        (v: BundleRequest) => { v.coreEntityId = 0; },
        (v: BundleRequest) => { v.sessionRevision = 0; },
        (v: BundleRequest) => { v.depth = 41; },
        (v: BundleRequest) => { v.profileId = 'absent'; },
        (v: BundleRequest) => { v.resources.policyId = 'absent'; },
        (v: BundleRequest) => { v.subactions[0]!.attackId = 'absent'; },
        (v: BundleRequest) => { v.subactions[0]!.facing = 'up' as never; },
        (v: BundleRequest) => { v.subactions[0]!.source.sourceFootprintVersion = '1'; },
        (v: BundleRequest) => { v.subactions[0]!.source.generation = 0; },
        (v: BundleRequest) => { v.subactions[0]!.footprint[0]!.x = 99; },
        (v: BundleRequest) => { v.subactions.push(clone(v.subactions[0]!)); },
        (v: BundleRequest) => { v.subactions = Array(5).fill(v.subactions[0]); },
        (v: BundleRequest) => { v.subactions = []; },
        (v: BundleRequest) => { (v as unknown as Record<string, unknown>).provider = 'combat.part-break.v1'; },
    ])('strictly rejects malformed request %# before invoking geometry', mutate => {
        const input = request(); mutate(input); const adapter = vi.fn(projection);
        expect(() => planCombatBundle(pack, initialCombatState(), input, adapter)).toThrow(); expect(adapter).not.toHaveBeenCalled();
    });
    it.each([null, undefined, Promise.resolve([]), [{ x: NaN, y: 1 }], [{ x: 1, y: 0 }, { x: 1, y: 0 }],
        [{ x: 2, y: 1 }, { x: 1, y: 1 }], Array.from({ length: 1025 }, (_, x) => ({ x, y: 1 })), [{ x: 1, y: 0, secret: 1 }]])('rejects illegal projection reply %# instead of falling back', reply => {
        const input = request(), before = clone(input), state = initialCombatState();
        expect(() => planCombatBundle(pack, state, input, () => reply as never)).toThrow();
        expect(input).toEqual(before); expect(state).toEqual(initialCombatState());
    });
    it('propagates adapter exceptions and rejects getters without invoking them', () => {
        const input = request(), getter = vi.fn(); Object.defineProperty(input, 'eligible', { get: getter, enumerable: true });
        expect(() => planCombatBundle(pack, initialCombatState(), input, projection)).toThrow(); expect(getter).not.toHaveBeenCalled();
        expect(() => planCombatBundle(pack, initialCombatState(), request(), () => { throw new Error('adapter failed'); })).toThrow('adapter failed');
    });
});

describe('combat mechanical state/component contracts', () => {
    it('rejects malformed empty locked-cell arrays at the direct helper boundary', () => {
        const extra = Object.assign([], { secret: true });
        const symbol: unknown[] = []; Object.defineProperty(symbol, Symbol('secret'), { value: 1 });
        const getter = vi.fn(), accessor: unknown[] = []; Object.defineProperty(accessor, 'secret', { get: getter, enumerable: true });
        class DerivedArray extends Array {}
        for (const value of [extra, symbol, accessor, new DerivedArray()]) expect(() => validateLockedCells(value)).toThrow();
        expect(getter).not.toHaveBeenCalled(); expect(() => validateLockedCells([])).not.toThrow();
    });
    it('validates independent resource remainders and exact revisions without mutating inputs', () => {
        const resource = initialCombatResources(pack, 'fixture.resources');
        expect(validateCombatResources(resource, pack)).toEqual(resource);
        expect(validateCombatState(initialCombatState())).toEqual(initialCombatState());
        expect(validateCombatState({ schema: 1, revision: 1, nextActionId: 2 })).toEqual({ schema: 1, revision: 1, nextActionId: 2 });
        for (const patch of [{ schema: 2 }, { revision: -1 }, { nextActionId: 2 }, { sessionRevision: 1 }, { revision: Number.MAX_SAFE_INTEGER }]) {
            expect(() => validateCombatState({ ...initialCombatState(), ...patch })).toThrow();
        }
        for (const patch of [{ stamina: -1 }, { stamina: 25 }, { regenRemainder: 20 }, { regenRemainder: 1 }, { poise: 13 },
            { poiseRecoveryRemainder: 30 }, { poiseRecoveryRemainder: 1 }, { regenDelayRemaining: 41 }, { defenseWindowRemaining: 1 }, { policyId: 'absent' }]) {
            expect(() => validateCombatResources({ ...resource, ...patch }, pack)).toThrow();
        }
        expect(validateCombatResources({ ...resource, stamina: 23, poise: 11, regenRemainder: 19, poiseRecoveryRemainder: 29 }, pack)).toBeDefined();
    });
    it('roundtrips every legal phase while keeping sessionRevision out of persistent action', () => {
        const saved = action('fixture.double-thrust');
        for (const [phase, elapsedTicks, phaseRemainingTicks, nextSegmentIndex] of [
            ['windup', 0, 40, 0], ['windup', 39, 1, 0], ['inter-segment', 40, 30, 1], ['inter-segment', 69, 1, 1], ['recovery', 70, 60, 2], ['recovery', 129, 1, 2],
        ] as const) {
            const value = clone(saved); Object.assign(value.subactions[0]!, { phase, elapsedTicks, phaseRemainingTicks, nextSegmentIndex,
                lockedCells: phase === 'recovery' ? [] : saved.subactions[0]!.lockedCells });
            expect(validateCombatAction(JSON.parse(JSON.stringify(value)), pack)).toEqual(value);
        }
        expect(() => validateCombatAction({ ...saved, sessionRevision: 7 }, pack)).toThrow();
        const sourceWithSession = { ...source(), sessionRevision: 7 };
        expect(() => validateCombatSource(sourceWithSession)).toThrow();
        expect(saved.subactions[0]!.source.sourceFootprintVersion).toMatch(/^sha256:/);
    });
    it.each([
        (v: CombatAction) => { v.paidCost++; }, (v: CombatAction) => { v.timeChargeOwnerId++; },
        (v: CombatAction) => { v.actionId = 0; }, (v: CombatAction) => { v.depth = 0; },
        (v: CombatAction) => { v.subactions[0]!.sourceSubactionId = 2; },
        (v: CombatAction) => { v.subactions[0]!.phaseRemainingTicks = 0; },
        (v: CombatAction) => { v.subactions[0]!.elapsedTicks = 40; },
        (v: CombatAction) => { v.subactions[0]!.nextSegmentIndex = 1; },
        (v: CombatAction) => { v.subactions[0]!.phase = 'recovery'; },
        (v: CombatAction) => { v.subactions[0]!.attackId = 'absent'; },
        (v: CombatAction) => { v.subactions[0]!.source.generation = -1; },
        (v: CombatAction) => { v.subactions[0]!.lockedCells.reverse(); },
    ])('rejects inconsistent persistent action %#', mutate => { const value = action('fixture.double-thrust'); mutate(value); expect(() => validateCombatAction(value, pack)).toThrow(); });
    it('validates shared elapsed time with shorter completed members and rejects whole-bundle completion', () => {
        const input = request(); input.groupFootprint.push({ x: 2, y: 1 }); input.subactions.push({ source: source(2, 'head'), attackId: 'fixture.stomp', facing: 'e', footprint: [{ x: 2, y: 1 }] });
        const result = planCombatBundle(pack, initialCombatState(), input, projection); if (result.status !== 'ready') throw new Error('expected plan');
        const value = clone({ ...result.plan.action, actionId: 1 });
        Object.assign(value.subactions[0]!, { phase: 'complete', elapsedTicks: 90, phaseRemainingTicks: 0, nextSegmentIndex: 1, lockedCells: [] });
        Object.assign(value.subactions[1]!, { phase: 'windup', elapsedTicks: 90, phaseRemainingTicks: 10 });
        expect(validateCombatAction(value, pack)).toEqual(value);
        Object.assign(value.subactions[1]!, { elapsedTicks: 89, phaseRemainingTicks: 11 }); expect(() => validateCombatAction(value, pack)).toThrow();
        Object.assign(value.subactions[1]!, { phase: 'complete', elapsedTicks: 170, phaseRemainingTicks: 0, nextSegmentIndex: 1, lockedCells: [] });
        expect(() => validateCombatAction(value, pack)).toThrow();
    });
    it('uses explicit positive segment boundaries, never zero-time loops', () => {
        expect(attackTiming(pack.attacks.find(a => a.id === 'fixture.double-thrust')!)).toEqual({ releases: [40, 70], duration: 130 });
    });
});

describe('part target deduplication contract', () => {
    it('preserves foundation contact order, hits distinct parts and new generations separately', () => {
        const a = { entityId: 9, groupId: 1, partId: 'tail', generation: 1 }, b = { entityId: 2, groupId: 1, partId: 'head', generation: 1 };
        const input = [a, b, clone(a), { ...a, generation: 2 }], before = clone(input);
        expect(deduplicatePartContacts(input)).toEqual([a, b, { ...a, generation: 2 }]); expect(input).toEqual(before);
        // Each invocation is one source-subaction/segment scope; later scopes still hit.
        expect(deduplicatePartContacts([a])).toEqual([a]); expect(deduplicatePartContacts([a])).toEqual([a]);
    });
    it('rejects over-budget, group-only, invalid and extra-field contact records', () => {
        const contact = { entityId: 1, groupId: 1, partId: 'body', generation: 1 };
        for (const value of [Array(1025).fill(contact), [{ groupId: 1 }], [{ ...contact, generation: 0 }], [{ ...contact, partId: 'constructor' }], [{ ...contact, targetPolicy: 'group' }]]) {
            expect(() => deduplicatePartContacts(value)).toThrow();
        }
    });
});
