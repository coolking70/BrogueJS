import { describe, expect, it, vi } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime, type ExtensionPorts } from '../ext/runtime';
import { isJson } from '../ext/json';
import { PART_BREAK_CAPABILITY, validatePartBreakRequest, type PartBreakProvider, type PartBreakRequest,
    type PartBreakPreparation, type PartBreakPrepareContext, type PartBreakCommitContext } from '../ext/partBreak';
import type { ExtensionModule } from '../ext/types';
import { rng } from '../engine/Random';
import { resolveFixedZoneHit } from '../engine/Combat/FixedZoneHealth';
import { serializeMonsterRow } from '../engine/Core/EntitySnapshot';
import { getNextEntityId } from '../entities/Creature';
import { fixedZoneScene } from './fixtures/fixedZones';

const base = (id = 'fixture'): ExtensionModule => ({ id, version: '1.0.0', initialState: () => ({}), validateState: isJson });
const provider = (overrides: Partial<PartBreakProvider> = {}): PartBreakProvider => ({
    prepare: () => ({ status: 'ready', plan: { loss: 6 } }),
    commit: (request, _plan, context) => {
        context.setState({ lastZone: request.zoneId });
        context.setComponent(request.actorId, 'poise', { remaining: 4 });
    }, ...overrides,
});
const module = (p = provider(), id = 'fixture'): ExtensionModule => ({ ...base(id), optionalPartBreaks: { [PART_BREAK_CAPABILITY]: p } });
function setup(modules: ExtensionModule[] = [module()]) {
    const scene = fixedZoneScene(), registry = new ExtensionRegistry();
    for (const m of modules) registry.register(m.id, m.version, () => m);
    const ports: ExtensionPorts = { depth: () => 1, playerId: () => scene.actor.id + 1, randomInt: vi.fn(() => 0), message: vi.fn(),
        checkpointRandom: () => { const before = rng.getState(); return () => rng.setState(before); } };
    const runtime = new ExtensionRuntime(registry, registry.manifest(modules.map(m => m.id)), ports);
    runtime.attachCreature(scene.actor, false);
    const request = (): PartBreakRequest => ({ schema: 1, resolutionId: 1, actorId: scene.actor.id, sourceId: null,
        groupId: scene.actor.id, partId: 'self', zoneId: 'shell', generation: 0, balanceLoss: 6, fallbackStunTicks: 25 });
    const hit = () => resolveFixedZoneHit(scene.spatial, scene.target(), scene.input(), runtime.commitPartBreak.bind(runtime));
    return { ...scene, runtime, ports, request, hit };
}

describe('4c-0 combat.part-break.v1 bottom-side protocol (fixture provider, no combat-module change)', () => {
    it.each(['absent', 'disabled', 'unsupported-target'] as const)('%s selects one declared fallback, never commits a provider', reason => {
        const commit = vi.fn(), p = provider({ prepare: () => ({ status: 'unsupported', reason: reason === 'absent' ? 'disabled' : reason }), commit });
        const { actor, runtime, ports, hit } = setup(reason === 'absent' ? [] : [module(p)]), before = runtime.snapshot();
        expect(hit().breakHandling).toBe('fallback'); expect(actor.spatial!.actionLockInTicks).toBe(25);
        expect(commit).not.toHaveBeenCalled(); expect(runtime.snapshot()).toEqual(before); expect(ports.randomInt).not.toHaveBeenCalled();
    });
    it('handled provider receives frozen detached pre-hit facts/plan, runs once, and suppresses fallback', () => {
        let savedPrepare!: PartBreakPrepareContext, savedCommit!: PartBreakCommitContext;
        const prepare = vi.fn((request: PartBreakRequest, context: PartBreakPrepareContext): PartBreakPreparation => {
            savedPrepare = context;
            expect(context.actor.hp).toBe(100); expect(context.actor.id).toBe(request.actorId);
            expect(Object.isFrozen(request)).toBe(true); expect(Object.isFrozen(context.actor)).toBe(true);
            expect(Object.isFrozen(context.state)).toBe(true); return { status: 'ready', plan: { nested: { loss: request.balanceLoss } } };
        });
        const commit = vi.fn<PartBreakProvider['commit']>((request, plan, context) => {
            savedCommit = context; expect(Object.isFrozen(plan)).toBe(true);
            expect(context).not.toHaveProperty('executeAction'); expect(context).not.toHaveProperty('randomInt'); expect(context).not.toHaveProperty('commitResources');
            context.setState({ handled: request.zoneId }); context.setComponent(request.actorId, 'poise', { remaining: 4 });
        });
        const { runtime, actor, hit, ports, spatial, target, input } = setup([module(provider({ prepare, commit }))]);
        expect(hit().breakHandling).toBe('handled'); expect(actor.spatial).not.toHaveProperty('actionLockInTicks');
        expect(runtime.snapshot().modules.fixture).toEqual({ handled: 'shell' });
        expect(runtime.snapshot().components[String(actor.id)]?.['fixture:poise']).toEqual({ remaining: 4 });
        expect(resolveFixedZoneHit(spatial, target(), input(14, 2), runtime.commitPartBreak.bind(runtime)).breakReceipt).toBeNull();
        expect(prepare).toHaveBeenCalledTimes(1); expect(commit).toHaveBeenCalledTimes(1); expect(ports.randomInt).not.toHaveBeenCalled();
        expect(() => savedPrepare.getComponent(actor.id, 'poise')).toThrow('Expired');
        expect(() => savedCommit.setState({ late: true })).toThrow('outside');
    });
    it('keeps an unrelated pre-existing action lock when provider handles the break', () => {
        const { actor, hit } = setup(); actor.spatial!.actionLockInTicks = 7; hit(); expect(actor.spatial!.actionLockInTicks).toBe(7);
    });
    it.each(['prepare', 'commit'] as const)('%s exception rolls back native HP/zone/lock identity, provider data, messages and both RNG', phase => {
        const p = provider(phase === 'prepare' ? { prepare: () => { throw new Error('prepare fault'); } } : {
            commit: (request, _plan, context) => {
                context.setState({ broken: true }); context.setComponent(request.actorId, 'poise', { remaining: 0 });
                context.message('buffered'); throw new Error('commit fault');
            },
        });
        const { actor, runtime, ports, hit } = setup([module(p)]), spatial = actor.spatial!, states = spatial.zoneState!, local = states[0]!, anchor = actor.loc;
        spatial.actionLockInTicks = 9;
        const before = { native: serializeMonsterRow(actor), extension: runtime.snapshot(), rng: rng.getState(), next: getNextEntityId() };
        expect(hit).toThrow(`${phase} fault`);
        expect({ native: serializeMonsterRow(actor), extension: runtime.snapshot(), rng: rng.getState(), next: getNextEntityId() }).toEqual(before);
        expect(actor.spatial).toBe(spatial); expect(actor.spatial!.zoneState).toBe(states); expect(states[0]).toBe(local); expect(actor.loc).toBe(anchor);
        expect(ports.message).not.toHaveBeenCalled(); expect(ports.randomInt).not.toHaveBeenCalled();
    });
    it('restores absence of a fallback lock on failure and permits a clean same-resolution retry', () => {
        let fail = true;
        const { actor, hit, runtime } = setup([module(provider({ commit: (request, _plan, context) => {
            context.setComponent(request.actorId, 'poise', { remaining: 0 }); if (fail) throw new Error('fault');
        } }))]);
        expect(hit).toThrow('fault'); expect(actor.spatial).not.toHaveProperty('actionLockInTicks'); expect(actor.hp).toBe(100);
        fail = false; expect(hit().breakHandling).toBe('handled'); expect(actor.hp).toBe(88); expect(runtime.snapshot().foundation.deaths).toEqual({});
    });
    it('provider transaction does not publish kill/reward/native physical or attack hooks for part break/conduction', () => {
        const hooks = { physicalResolved: vi.fn(), beforeAttack: vi.fn(), afterAttack: vi.fn(), deathCaptured: vi.fn(), rewardGranted: vi.fn() };
        const { hit, actor, runtime } = setup([{ ...module(), hooks }]);
        const damage = vi.spyOn(actor.extensionHooks!, 'damage'), causeBefore = runtime.snapshot().foundation.causality; hit();
        Object.values(hooks).forEach(hook => expect(hook).not.toHaveBeenCalled()); expect(damage).not.toHaveBeenCalled();
        expect(runtime.snapshot().foundation.deaths).toEqual({}); expect(runtime.snapshot().foundation.causality).toEqual(causeBefore);
    });
    it.each([null, {}, { status: 'ready' }, { status: 'ready', plan: undefined }, { status: 'ready', plan: NaN },
        { status: 'ready', plan: null, extra: true }, { status: 'unsupported', reason: 'absent' },
        { status: 'unsupported', reason: 'disabled', plan: null }, Promise.resolve({ status: 'ready', plan: null })])('rejects malformed/asynchronous preparation %# without fallback or HP writes', preparation => {
        const commit = vi.fn(), { hit, actor, runtime } = setup([module(provider({ prepare: () => preparation as PartBreakPreparation, commit }))]);
        const before = { native: serializeMonsterRow(actor), extension: runtime.snapshot() };
        expect(hit).toThrow(); expect(commit).not.toHaveBeenCalled();
        expect({ native: serializeMonsterRow(actor), extension: runtime.snapshot() }).toEqual(before);
    });
    it.each([Promise.resolve(), true])('rejects asynchronous/non-void commit %# and rolls back all tentative writes', result => {
        const { hit, actor, runtime } = setup([module(provider({ commit: ((request, _plan, context) => {
            context.setState({ fail: true }); context.setComponent(request.actorId, 'poise', { remaining: 0 }); return result;
        }) as PartBreakProvider['commit'] }))]), before = { native: serializeMonsterRow(actor), extension: runtime.snapshot() };
        expect(hit).toThrow(); expect({ native: serializeMonsterRow(actor), extension: runtime.snapshot() }).toEqual(before);
    });
    it('rejects two providers and unsupported versions at installation before any gameplay', () => {
        expect(() => setup([module(provider(), 'one'), module(provider(), 'two')])).toThrow('Conflicting');
        expect(() => setup([{ ...base(), optionalPartBreaks: { 'combat.part-break.v2': provider() } } as ExtensionModule])).toThrow('Invalid');
        expect(() => setup([{ ...base(), optionalPartBreaks: {} }])).toThrow('Invalid');
    });
    it('rejects recursive provider entry', () => {
        let recursive: () => void;
        const { runtime, hit, request } = setup([module(provider({ prepare: () => { recursive(); return { status: 'ready', plan: null }; } }))]);
        recursive = () => runtime.commitPartBreak(request(), { apply: vi.fn(), rollback: vi.fn() });
        expect(hit).toThrow('recursive');
    });
    it.each([
        (r: PartBreakRequest) => Object.assign(r, { actorId: 0 }),
        (r: PartBreakRequest) => Object.assign(r, { groupId: r.groupId + 1 }),
        (r: PartBreakRequest) => Object.assign(r, { partId: 'leg' }),
        (r: PartBreakRequest) => Object.assign(r, { zoneId: 'body' }),
        (r: PartBreakRequest) => Object.assign(r, { generation: 1 }),
        (r: PartBreakRequest) => Object.assign(r, { resolutionId: .5 }),
        (r: PartBreakRequest) => Object.assign(r, { fallbackStunTicks: -1 }),
        (r: PartBreakRequest) => Object.assign(r, { extra: true }),
    ])('rejects malformed fixed-zone receipt request %#', mutate => {
        const { runtime, request } = setup(), r = request(); mutate(r); const apply = vi.fn();
        expect(() => validatePartBreakRequest(r)).toThrow(); expect(() => runtime.commitPartBreak(r, { apply, rollback: vi.fn() })).toThrow(); expect(apply).not.toHaveBeenCalled();
    });
    it('native apply fault rolls back native and provider state together; actor missing/unloaded cannot commit', () => {
        const { runtime, request, actor } = setup(), hp = actor.hp, before = runtime.snapshot(), rollback = vi.fn(() => { actor.hp = hp; });
        expect(() => runtime.commitPartBreak(request(), { apply: () => { actor.hp = 1; throw new Error('native fault'); }, rollback })).toThrow('native fault');
        expect(rollback).toHaveBeenCalledTimes(1); expect(actor.hp).toBe(hp); expect(runtime.snapshot()).toEqual(before);
        const unknown = { ...request(), actorId: 999999, groupId: 999999 };
        expect(() => runtime.commitPartBreak(unknown, { apply: vi.fn(), rollback: vi.fn() })).toThrow('actor');
        runtime.unload(); expect(() => runtime.commitPartBreak(request(), { apply: vi.fn(), rollback: vi.fn() })).toThrow('Unavailable');
    });
});
