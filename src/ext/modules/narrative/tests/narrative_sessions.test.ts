import { describe, expect, it, vi } from 'vitest';
import type { ExtensionContext, Json, WorldInteractable } from '../../../types';
import { createNarrativeModuleFromPack } from '../module';
import { loadNarrativePack } from '../schema';
import { validateNarrativeState, type NarrativeState } from '../state';
import { validateNarrativeWorldBindings, validateNarrativeRecording } from '../validation';
import { projectNarrativeView } from '../view';
import { keeperOnlyContentFixture } from './contentFixture';
import portraits from '../data/portraits.json';
import locale from '../locales/zh_CN.json';
import type { NarrativePack } from '../types';

type Mutable<T> = { -readonly [P in keyof T]: T[P] extends readonly (infer U)[] ? Mutable<U>[] : T[P] extends object ? Mutable<T[P]> : T[P] };
const clone = <T>(value: T): T => structuredClone(value);
const raw = keeperOnlyContentFixture();
function fixture(pack = loadNarrativePack(keeperOnlyContentFixture(), portraits, locale)) {
    const module = createNarrativeModuleFromPack(pack);
    let state = module.initialState() as unknown as NarrativeState, depth = 1, nextId = 10;
    let gate: { owner: string; targetEntityId: number; sessionId: number } | null = null;
    const entities: WorldInteractable[] = [];
    const message = vi.fn(), randomInt = vi.fn();
    let reachable = true, space = true, nextFactId = 1;
    const context = {
        moduleId: 'narrative', playerId: 1, turn: 0,
        get nextFactId() { return nextFactId; },
        commitFactRange(first: number, count: number) { expect(first).toBe(nextFactId); nextFactId += count; },
        prepareOptionalReward: () => ({ status: 'skipped', reason: 'absent' }),
        commitOptionalReward: () => { throw new Error('Unexpected reward commit'); },
        get state() { return clone(state) as unknown as Json; }, get depth() { return depth; },
        setState(value: Json) { state = validateNarrativeState(value, pack); },
        creature: () => ({ id: 1, hp: 20, maxHp: 20, name: 'player', x: 1, y: 1, player: true, monsterId: null, allied: true, hostile: false }),
        queryOptional: () => ({ status: 'unavailable', reason: 'absent' }),
        interactables: () => clone(entities),
        interactionTarget(id: number) { return reachable ? entities.find(entity => entity.id === id && entity.depth === depth) ?? null : null; },
        placeInteractables(requests: Parameters<ExtensionContext['placeInteractables']>[0]) {
            return requests.map(request => {
                const { minStairDistance: _stairs, maxEntranceDistance: _entrance, ...content } = request;
                const entity = space ? { ...content, id: nextId++, owner: 'narrative', depth, x: 2, y: 1 } : null;
                if (entity) entities.push(entity);
                return { instanceKey: request.instanceKey, entity };
            });
        },
        interactionGate(active: { targetEntityId: number; sessionId: number } | null) { gate = active ? { owner: 'narrative', ...active } : null; },
        message, randomInt,
    } as unknown as ExtensionContext;
    function enter(value = 1, firstVisit = true) { depth = value; module.hooks!.enteredLevel!({ depth, firstVisit }, context); module.hooks!.storyFact!({ kind: 'entered-level', depth, firstVisit, turn: 0, factId: nextFactId }, context); }
    function input(action: string, payload: object) { return JSON.stringify({ module: 'narrative', action, payload: { v: 2, revision: state.revision, ...payload } }); }
    function execute(data: string) {
        if (!module.allowInput!('ext:command', data, context)) return false;
        const command = JSON.parse(data); module.commands![command.action]!(command.payload, context); return true;
    }
    return { pack, module, context, entities, message, randomInt, enter, input, execute,
        state: () => clone(state), world: () => ({ entities: clone(entities), gate: clone(gate) }),
        reachable(value: boolean) { reachable = value; }, space(value: boolean) { space = value; },
    };
}
function open(f: ReturnType<typeof fixture>) { return f.execute(f.input('open', { targetEntityId: f.entities[0]!.id })); }
function choose(f: ReturnType<typeof fixture>, choiceId = 'read-note') {
    const active = f.state().active!;
    return f.execute(f.input('choose', { sessionId: active.sessionId, nodeId: active.nodeId, choiceId }));
}

describe('EXT-2b narrative sessions and private projections', () => {
    it('places content once and commits open/choice/close as versioned zero-time state changes', () => {
        const f = fixture(); f.enter(); expect(f.entities).toHaveLength(1);
        expect(f.state().placementReceipts[0]).toMatchObject({ instanceKey: 'archive.first.slot.1', result: 'placed', depth: 1 });
        const before = f.state(), input = f.input('open', { targetEntityId: f.entities[0]!.id });
        expect(f.execute(input)).toBe(true); expect(f.execute(input)).toBe(false);
        expect(f.state().revision).toBe(before.revision + 1); expect(f.state().nextSessionId).toBe(2);
        expect(f.world().gate).toEqual({ owner: 'narrative', targetEntityId: 10, sessionId: 1 });
        expect(choose(f)).toBe(true); expect(f.state().active).toBeNull(); expect(f.world().gate).toBeNull();
        expect(f.state().flags['archive.read']).toBe(true); expect(f.state().journal).toHaveLength(1);
        expect(f.state().rewardReceipts[0]).toMatchObject({ result: 'skipped', reason: 'absent' });
        expect(open(f)).toBe(true); expect(f.state().active!.sessionId).toBe(2);
        expect(choose(f)).toBe(false);
        const close = f.input('close', { sessionId: 2 }); const fact = f.state().lastFactId;
        expect(f.execute(close)).toBe(true); expect(f.state().lastFactId).toBe(fact); expect(f.execute(close)).toBe(false);
        f.enter(1, false); f.enter(1, true); expect(f.entities).toHaveLength(1);
        expect(f.context.turn).toBe(0); expect(f.randomInt).not.toHaveBeenCalled();
    });
    it('selects the exact data-bound target among multiple nearby entities sharing a cell', () => {
        const data = clone(raw);
        const second = clone(data.npcs[0]!); second.id = 'archive.second-keeper'; second.dialogueId = 'archive.second-dialogue';
        second.placements[0]!.id = 'archive.second-placement';
        data.npcs.push(second);
        data.dialogues.push({ id: 'archive.second-dialogue', entry: 'hello', nodes: [{ id: 'hello', textKey: 'ext.narrative.dialogue.keeper.hello', portraitId: null,
            choices: [{ id: 'second-leave', textKey: 'ext.narrative.choice.leave', condition: { op: 'true' }, unavailable: 'disable', unavailableKey: null, effects: [], next: null }] }] });
        const f = fixture(loadNarrativePack(data, portraits, locale)); f.enter(); expect(f.entities).toHaveLength(2);
        expect(f.entities.map(entity => [entity.x,entity.y])).toEqual([[2,1],[2,1]]);
        const target = f.entities.find(entity => entity.contentId === 'archive.second-keeper')!;
        expect(f.execute(f.input('open', { targetEntityId: target.id }))).toBe(true);
        expect(f.state().active).toMatchObject({ targetEntityId: target.id, dialogueId: 'archive.second-dialogue' });
        expect(choose(f, 'read-note')).toBe(false); expect(choose(f, 'second-leave')).toBe(true);
        expect(f.execute(f.input('open', { targetEntityId: f.entities.find(entity => entity.id !== target.id)!.id }))).toBe(true);
        expect(f.state().active!.dialogueId).toBe('archive.greeting');
    });
    it('rejects inaccessible, wrong-owner, unknown, stale, forged and mismatched session targets without side effects', () => {
        const f = fixture(); f.enter(); f.reachable(false);
        const before = f.state(); expect(open(f)).toBe(false); expect(f.state()).toEqual(before); f.reachable(true);
        expect(f.execute(f.input('open', { targetEntityId: 999 }))).toBe(false);
        expect(f.execute(f.input('open', { targetEntityId: 10, effect: [] }))).toBe(false);
        expect(open(f)).toBe(true); const active = f.state();
        for (const payload of [{ sessionId: 9, nodeId: 'hello', choiceId: 'leave' }, { sessionId: 1, nodeId: 'bad', choiceId: 'leave' },
            { sessionId: 1, nodeId: 'hello', choiceId: 'bad' }, { sessionId: 1, nodeId: 'hello', choiceId: 'leave', revision: 0 }]) {
            expect(f.execute(f.input('choose', payload))).toBe(false); expect(f.state()).toEqual(active);
        }
        f.reachable(false); expect(choose(f, 'leave')).toBe(false);
        expect(f.execute(f.input('close', { sessionId: 1 }))).toBe(true);
    });
    it('exposes only nearby names, the active node, visible choices and published journal', () => {
        const f = fixture(); f.enter(); open(f);
        const project = () => projectNarrativeView(f.pack, { state: f.state() as unknown as Json, depth: 1, turn: 0,
            visibleInteractables: f.entities, nearbyInteractables: f.entities, queryOptional: f.context.queryOptional }) as Record<string, any>;
        const view = project();
        expect(Object.keys(view).sort()).toEqual(['active', 'journal', 'nearby', 'revision']);
        expect(view.active.textKey).toBe('ext.narrative.dialogue.keeper.hello');
        expect(view.active.choices.map((choice: any) => choice.id)).toEqual(['read-note', 'leave']);
        for (const key of ['flags','counters','effects','condition','placementReceipts','rewardReceipts','definitions']) expect(JSON.stringify(view)).not.toContain(`"${key}"`);
        expect(Object.isFrozen(view.active.choices)).toBe(true);
        choose(f); open(f); const after = project();
        expect(after.active.choices[0].enabled).toBe(false); expect(after.journal).toHaveLength(1);
        expect(f.randomInt).not.toHaveBeenCalled();
    });
    it('preflights the full node preview at the exact shared condition budget', () => {
        const data = clone(raw); data.config.limits.conditionOpsPerCommand = 1;
        expect(() => loadNarrativePack(data, portraits, locale)).toThrow('CONDITION_LIMIT');
        data.config.limits.conditionOpsPerCommand = 2;
        const f = fixture(loadNarrativePack(data, portraits, locale)); f.enter(); open(f);
        const view = projectNarrativeView(f.pack, { state: f.state() as unknown as Json, depth: 1, turn: 0,
            visibleInteractables: f.entities, nearbyInteractables: f.entities, queryOptional: f.context.queryOptional }) as any;
        expect(view.active.choices[0].enabled).toBe(true);
        expect(view.active.choices[1]).toMatchObject({ enabled: true, unavailableKey: null });
        expect(choose(f, 'leave')).toBe(true);
    });
    it('uses the same pure optional query for previews and command conditions', () => {
        const data = clone(raw) as unknown as Mutable<NarrativePack>;
        data.dialogues[0]!.nodes[0]!.choices[0]!.condition = { op: 'optional-player', capability: 'growth.public-character.v1', field: 'level', compare: 'gte', value: 2, onUnavailable: false };
        const f = fixture(loadNarrativePack(data, portraits, locale));
        f.context.queryOptional = () => ({ status: 'available', value: { level: 2, professionId: null, lineageId: null, faithId: null } });
        f.enter(); open(f);
        const view = projectNarrativeView(f.pack, { state: f.state() as unknown as Json, depth: 1, turn: 0,
            visibleInteractables: f.entities, nearbyInteractables: f.entities, queryOptional: f.context.queryOptional }) as any;
        expect(view.active.choices[0].enabled).toBe(true); expect(choose(f)).toBe(true);
    });
    it('allows close at the session transition budget and rejects another choice atomically', () => {
        const data = clone(raw) as unknown as Mutable<NarrativePack>;
        data.config.limits.transitionsPerSession = 1;
        data.dialogues[0]!.nodes[0]!.choices.push({ id: 'again', textKey: 'ext.narrative.choice.leave', condition: { op: 'true' }, unavailable: 'disable', unavailableKey: null, effects: [], next: 'hello' });
        const f = fixture(loadNarrativePack(data, portraits, locale)); f.enter(); open(f);
        expect(choose(f, 'again')).toBe(true); const before = f.state(); expect(choose(f, 'again')).toBe(false); expect(f.state()).toEqual(before);
        expect(f.execute(f.input('close', { sessionId: 1 }))).toBe(true);
    });
    it('never special-cases sample NPC IDs, placement IDs or dialogue IDs', () => {
        const renamed = JSON.parse(JSON.stringify(raw).split('archive.').join('custom.'));
        // Localized text keys stay unchanged: only mechanical IDs are renamed.
        const renamedPortraits = JSON.parse(JSON.stringify(portraits).split('archive.').join('custom.'));
        const f = fixture(loadNarrativePack(renamed, renamedPortraits, locale)); f.enter();
        expect(f.entities[0]!.contentId).toBe('custom.keeper'); expect(open(f)).toBe(true); expect(choose(f)).toBe(true);
        expect(f.state().flags['custom.read']).toBe(true);
    });
});

describe('EXT-2b bounded placement and load/recording validation', () => {
    it('retries deferred slots only on new eligible depths and finalizes no-space at the upper bound', () => {
        const data = clone(raw); Object.assign(data.npcs[0]!.placements[0]!, { maxDepth: 3, onNoSpace: 'defer' });
        const f = fixture(loadNarrativePack(data, portraits, locale)); f.space(false); f.enter();
        expect(f.state().pendingPlacements[0]!.attemptedDepths).toEqual([1]);
        f.enter(1, false); f.enter(1, true); expect(f.state().pendingPlacements[0]!.attemptedDepths).toEqual([1]);
        f.enter(2); expect(f.state().pendingPlacements[0]!.attemptedDepths).toEqual([1, 2]);
        f.enter(3); expect(f.state().pendingPlacements).toEqual([]); expect(f.state().placementReceipts[0]!.result).toBe('skipped');
        f.space(true); f.enter(1, false); expect(f.entities).toEqual([]);
    });
    it('fills run slots across depth limits and terminates deferred slots if the eligible interval is skipped', () => {
        const data = clone(raw); Object.assign(data.npcs[0]!.placements[0]!, { maxDepth: 3, maxPerRun: 3, maxPerDepth: 1 });
        const f = fixture(loadNarrativePack(data, portraits, locale)); f.enter(); f.enter(2); f.enter(3); f.enter(3, true);
        expect(f.entities).toHaveLength(3); expect(f.state().placementReceipts.map(receipt => receipt.depth)).toEqual([1, 2, 3]);
        const deferred = clone(raw); Object.assign(deferred.npcs[0]!.placements[0]!, { maxDepth: 3, onNoSpace: 'defer' });
        const g = fixture(loadNarrativePack(deferred, portraits, locale)); g.space(false); g.enter(); g.enter(4);
        expect(g.state().pendingPlacements).toEqual([]); expect(g.state().placementReceipts[0]).toMatchObject({ depth: 4, result: 'skipped' });
    });
    it('strictly validates active, placement, binding, schema, gate, owner and world content references', () => {
        const f = fixture(); f.enter(); open(f); const before = f.state();
        expect(validateNarrativeWorldBindings(f.pack, before, f.world())).toBe(true);
        const invalid = [
            (state: any) => { state.schema = 1; }, (state: any) => { state.nextSessionId = 1; },
            (state: any) => { state.active.targetEntityId = 999; }, (state: any) => { state.active.nodeId = 'bad'; },
            (state: any) => { state.active.dialogueId = 'bad'; }, (state: any) => { state.active.transitions = 999; },
            (state: any) => { state.placementReceipts.push(clone(state.placementReceipts[0])); },
            (state: any) => { state.placementReceipts[0].instanceKey = 'archive.first.slot.2'; },
            (state: any) => { state.npcBindings[10].npcId = 'missing'; }, (state: any) => { state.extra = true; },
        ];
        for (const mutate of invalid) { const state = clone(before); mutate(state); expect(() => validateNarrativeState(state, f.pack)).toThrow(); }
        for (const mutate of [(world: any) => { world.entities = []; }, (world: any) => { world.gate = null; },
            (world: any) => { world.gate.sessionId = 9; }, (world: any) => { world.entities[0].owner = 'other'; },
            (world: any) => { world.entities[0].contentId = 'bad'; }, (world: any) => { world.entities[0].nameKey = 'bad'; }]) {
            const world = f.world(); mutate(world); expect(validateNarrativeWorldBindings(f.pack, before, world)).toBe(false);
        }
        expect(f.state()).toEqual(before);
    });
    it('clears only the exact closed session and preserves placement receipts on world removal', () => {
        const f = fixture(); f.enter(); open(f); const before = f.state();
        f.module.hooks!.interactionClosed!({ owner: 'narrative', targetEntityId: 10, sessionId: 99, reason: 'target-removed' }, f.context);
        expect(f.state()).toEqual(before);
        f.module.hooks!.interactionClosed!({ owner: 'narrative', targetEntityId: 10, sessionId: 1, reason: 'target-removed' }, f.context);
        f.module.hooks!.interactablesRemoved!({ owner: 'narrative', entityIds: [10] }, f.context);
        expect(f.state().active).toBeNull(); expect(f.state().npcBindings).toEqual({});
        expect(f.state().placementReceipts).toEqual(before.placementReceipts);
        f.entities.splice(0); f.enter(1, true); expect(f.entities).toEqual([]);
    });
    it('refuses replacing a recorded session continuation with a native action', () => {
        const f = fixture(); f.enter(); const command = f.input('open', { targetEntityId: 10 }); f.execute(command);
        const opened = { modules: { narrative: f.state() }, foundation: { world: f.world() } } as any;
        const close = f.input('close', { sessionId: 1 }); f.execute(close);
        const closed = { modules: { narrative: f.state() }, foundation: { world: f.world() } } as any;
        expect(validateNarrativeRecording(f.pack, [{ action: 'ext:command', data: command, extensions: opened },
            { action: 'wait', data: null, extensions: closed }])).toBe(false);
        expect(validateNarrativeRecording(f.pack, [{ action: 'ext:command', data: close, extensions: closed }])).toBe(false);
    });
    it('rejects old input versions and malformed recording references before replay starts', () => {
        const f = fixture(); f.enter(); const command = f.input('open', { targetEntityId: 10 }); f.execute(command);
        const extensions = { modules: { narrative: f.state() }, foundation: { world: f.world() } } as any;
        expect(validateNarrativeRecording(f.pack, [{ action: 'ext:command', data: command, extensions }])).toBe(true);
        const old = JSON.parse(command); old.payload.v = 1;
        expect(validateNarrativeRecording(f.pack, [{ action: 'ext:command', data: JSON.stringify(old), extensions }])).toBe(false);
        const bad = clone(extensions); bad.foundation.world.entities = [];
        expect(validateNarrativeRecording(f.pack, [{ action: 'ext:command', data: command, extensions: bad }])).toBe(false);
    });
});
