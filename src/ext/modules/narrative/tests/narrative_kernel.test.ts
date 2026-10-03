import { describe, expect, it, vi } from 'vitest';
import definitions from '../data/definitions.json';
import portraits from '../data/portraits.json';
import locales from '../locales/zh_CN.json';
import { loadNarrativePack } from '../schema';
import { NarrativeError } from '../errors';
import { evaluateNarrativeCondition, queryNarrativePlayer, validateNarrativeFact } from '../conditions';
import { commitNarrativePlan, planNarrativeChoice, planNarrativeEffects, planNarrativeFact } from '../effects';
import { initialNarrativeState, isNarrativeState, validateNarrativeState } from '../state';
import { validateNarrativeInput } from '../input';
import type { NarrativePack, Trigger } from '../types';

const sample = () => loadNarrativePack(definitions, portraits, locales);
const entry = (factId = 1, depth = 1, turn = 0) => ({ kind: 'entered-level', firstVisit: true, factId, depth, turn } as const);
function error(run: () => unknown, code: string, path?: string) {
    try { run(); throw new Error('Expected narrative rejection'); }
    catch (caught) { expect(caught).toBeInstanceOf(NarrativeError); expect((caught as NarrativeError).code).toBe(code); if (path) expect((caught as NarrativeError).path).toBe(path); }
}
function fixture(change: (raw: any) => void): NarrativePack {
    const raw = structuredClone(definitions); change(raw); return loadNarrativePack(raw, portraits, locales);
}
const trigger = (id: string, priority = 0, extra: Partial<Trigger> = {}): Trigger => ({ id, priority, on: { kind: 'entered-level' }, condition: { op: 'true' }, repeat: { kind: 'once-per-run' }, effects: [], ...extra });

describe('narrative 2a1 detached execution kernel', () => {
    it('completes the sample without growth, world entities, sessions, or side effects', () => {
        const pack = sample(), state = initialNarrativeState(pack), before = structuredClone(state);
        const plan = planNarrativeChoice(pack, state, { kind: 'dialogue-choice', dialogueId: 'archive.greeting', choiceId: 'read-note', factId: 1, depth: 1, turn: 0 },
            { dialogueId: 'archive.greeting', nodeId: 'hello', choiceId: 'read-note', transitions: 0 });
        expect(state).toEqual(before); expect(plan.nextState.flags['archive.read']).toBe(true);
        expect(plan.nextState.journal).toEqual([{ entryId: 'archive.note', order: 1 }]);
        expect(plan.nextState.rewardReceipts).toEqual([{ id: 'archive.reward', instanceKey: 'narrative.archive.reward.run', result: 'skipped', reason: 'absent' }]);
        expect(plan.choice).toEqual({ dialogueId: 'archive.greeting', nextNodeId: null, transitions: 1 });
        expect(plan.events.map(event => event.factId)).toEqual([1,2]);
        const committed = commitNarrativePlan(pack, state, plan);
        expect(committed.lastFactId).toBe(2); expect(committed.revision).toBe(1); expect(isNarrativeState(committed, pack)).toBe(true);
        expect(Object.isFrozen(plan.nextState.flags)).toBe(true); expect(Object.keys(state)).not.toContain('active');
        expect(state).toEqual(before);
    });
    it('orders triggers by priority descending then ID ascending, independent of registration order', () => {
        const pack = fixture(raw => { raw.triggers = [trigger('z.last', 0), trigger('b.second', 1), trigger('a.first', 1)]; });
        const first = planNarrativeFact(pack, initialNarrativeState(pack), entry());
        const reversed = fixture(raw => { raw.triggers = [...pack.triggers].reverse(); });
        const second = planNarrativeFact(reversed, initialNarrativeState(reversed), entry());
        expect(first.triggered.map(item => item.triggerId)).toEqual(['a.first','b.second','z.last']);
        expect(first.nextState).toEqual(second.nextState);
    });
    it('deduplicates the same local fact even with changed payload and rejects backwards IDs', () => {
        const pack = fixture(raw => { raw.counters = [{ id: 'count', initial: 0, min: 0, max: 10 }]; raw.triggers = [trigger('count.entry', 0, { repeat: { kind: 'bounded', maxFirings: 5, cooldownTurns: 0 }, effects: [{ kind: 'add-counter', id: 'count', amount: 1 }] })]; });
        const state = initialNarrativeState(pack), one = commitNarrativePlan(pack, state, planNarrativeFact(pack, state, entry(2)));
        const duplicate = planNarrativeFact(pack, one, entry(2, 2, 1));
        expect(duplicate.nextState).toEqual(one); expect(duplicate.usage).toEqual({ conditions: 0, effects: 0, events: 0 });
        error(() => planNarrativeFact(pack, one, entry(1)), 'INVALID_FACT', '$fact.factId');
    });
    it('enforces once-per-run, once-per-depth, bounded firings and objective turn cooldown', () => {
        const pack = fixture(raw => { raw.triggers = [trigger('once'), trigger('per.depth', 0, { repeat: { kind: 'once-per-depth' } }), trigger('cooldown', 0, { repeat: { kind: 'bounded', maxFirings: 2, cooldownTurns: 3 } })]; });
        let state = initialNarrativeState(pack);
        const run = (id: number, depth: number, turn: number) => { const plan = planNarrativeFact(pack, state, entry(id, depth, turn)); state = commitNarrativePlan(pack, state, plan); return plan.triggered.map(item => item.triggerId); };
        expect(run(1,1,0)).toEqual(['cooldown','once','per.depth']);
        expect(run(2,1,0)).toEqual([]); expect(run(3,2,2)).toEqual(['per.depth']);
        expect(run(4,2,3)).toEqual(['cooldown']); expect(run(5,2,99)).toEqual([]);
        expect(state.triggerReceipts.find(item => item.triggerId === 'cooldown')?.firings).toBe(2);
    });
    it('keeps all earlier mutations and planned messages private when a later counter overflows', () => {
        const pack = fixture(raw => {
            raw.counters = [{ id: 'count', initial: 1, min: 0, max: 1 }];
            raw.triggers = [trigger('fail', 0, { effects: [{ kind: 'set-flag', id: 'archive.read', value: true }, { kind: 'message', textKey: 'ext.narrative.choice.read' }, { kind: 'add-counter', id: 'count', amount: 1 }] })];
        });
        const state = initialNarrativeState(pack), before = structuredClone(state);
        error(() => planNarrativeFact(pack, state, entry()), 'COUNTER_RANGE'); expect(state).toEqual(before);
    });
    it('shares effect, condition and derived-event budgets across the entire causal chain', () => {
        const pack = fixture(raw => {
            raw.storyEvents = [{ id: 'story.one' }, { id: 'story.two' }];
            raw.dialogues.forEach((dialogue: any) => dialogue.nodes.forEach((node: any) => node.choices.forEach((choice: any) => { choice.effects = []; })));
            raw.triggers = [trigger('start', 0, { effects: [{ kind: 'emit-story', eventId: 'story.one' }] }),
                trigger('middle', 0, { on: { kind: 'story', eventId: 'story.one' }, effects: [{ kind: 'emit-story', eventId: 'story.two' }] }),
                trigger('end', 0, { on: { kind: 'story', eventId: 'story.two' }, effects: [{ kind: 'message', textKey: 'ext.narrative.choice.read' }] })];
        });
        const state = initialNarrativeState(pack);
        for (const [limit, value, code] of [['effectsPerCommand',1,'EFFECT_LIMIT'], ['conditionOpsPerCommand',1,'CONDITION_LIMIT'], ['eventsPerCommand',1,'EVENT_LIMIT']] as const) {
            const raw = structuredClone(pack) as any; raw.config.limits[limit] = value;
            const limited = loadNarrativePack(raw, portraits, locales);
            error(() => planNarrativeFact(limited, state, entry()), code); expect(state).toEqual(initialNarrativeState(pack));
        }
    });
    it('plans ready external rewards honestly and prevents partial or forged commits', () => {
        const pack = sample(), state = initialNarrativeState(pack), fact = { kind: 'story', eventId: 'archive.read-done', factId: 1, depth: 1, turn: 0 };
        const prepare = vi.fn(() => ({ status: 'ready' as const }));
        const plan = planNarrativeFact(pack, state, fact, { prepareReward: prepare });
        expect(prepare).toHaveBeenCalledOnce(); expect(plan.rewardIntents[0]?.status).toBe('prepared'); expect(plan.nextState.rewardReceipts).toEqual([]);
        error(() => commitNarrativePlan(pack, state, plan), 'REWARD_COMMIT_REQUIRED');
        error(() => commitNarrativePlan(pack, state, structuredClone(plan)), 'STALE_PLAN');
        expect(state).toEqual(initialNarrativeState(pack));
        error(() => planNarrativeFact(pack, state, fact, { prepareReward: () => { throw new Error('provider failed'); } }), 'INVALID_OPTIONAL_RESULT');
    });
    it('records skip only once and rejects stale plans after another transaction', () => {
        const pack = sample(), state = initialNarrativeState(pack), event = (id: number) => ({ kind: 'story', eventId: 'archive.read-done', factId: id, depth: 1, turn: 0 });
        const old = planNarrativeFact(pack, state, event(1));
        const next = commitNarrativePlan(pack, state, old);
        error(() => commitNarrativePlan(pack, next, old), 'STALE_PLAN');
        const repeat = planNarrativeFact(pack, next, event(2)); expect(repeat.nextState.rewardReceipts).toEqual(next.rewardReceipts);
    });
    it('checks strict optional-player DTOs and null identities without treating null as absence', () => {
        const pack = sample(), state = initialNarrativeState(pack), fact = validateNarrativeFact(entry(), pack);
        const base = { pack, state, fact };
        const identity = { op: 'optional-player', capability: 'growth.public-character.v1', field: 'professionId', compare: 'eq', value: 'scholar', onUnavailable: true } as const;
        expect(evaluateNarrativeCondition(identity, base)).toBe(true);
        const query = vi.fn(() => ({ status: 'available' as const, value: { level: 3, professionId: null, lineageId: null, faithId: null } }));
        expect(evaluateNarrativeCondition(identity, { ...base, queryOptional: query })).toBe(false);
        expect(query).toHaveBeenCalledWith('growth.public-character.v1', { v: 1 });
        expect(evaluateNarrativeCondition({ ...identity, field: 'level', compare: 'gte', value: 3 }, { ...base, queryOptional: query })).toBe(true);
        for (const value of [{ level: Infinity, professionId: null, lineageId: null, faithId: null }, { level: 1, professionId: null, lineageId: null, faithId: null, secret: 1 }])
            error(() => queryNarrativePlayer((() => ({ status: 'available', value })) as any), 'INVALID_OPTIONAL_RESULT');
        error(() => queryNarrativePlayer(() => ({ status: 'unavailable', reason: 'disabled' } as any)), 'INVALID_OPTIONAL_RESULT');
        expect(evaluateNarrativeCondition({ op: 'any', args: [{ op: 'true' }, identity] }, { ...base, queryOptional: () => { throw new Error('must short circuit'); } })).toBe(true);
    });
    it('shares a single pure optional-player snapshot across matching triggers', () => {
        const pack = fixture(raw => { const condition = { op: 'optional-player', capability: 'growth.public-character.v1', field: 'level', compare: 'gte', value: 1, onUnavailable: false } as const; raw.triggers = [trigger('a', 1, { condition }), trigger('b', 0, { condition })]; });
        const query = vi.fn(() => ({ status: 'available' as const, value: { level: 1, professionId: null, lineageId: null, faithId: null } }));
        const plan = planNarrativeFact(pack, initialNarrativeState(pack), entry(), { queryOptional: query });
        expect(plan.triggered).toHaveLength(2); expect(query).toHaveBeenCalledOnce();
    });
    it('validates state and future input strictly without creating executable game commands', () => {
        const pack = sample(), state = initialNarrativeState(pack);
        expect(validateNarrativeState(state, pack)).toEqual(state);
        for (const corrupt of [{ ...state, active: null }, { ...state, flags: {} }, { ...state, flags: { 'archive.read': 1 } }, { ...state, lastFactId: 1 }]) {
            expect(isNarrativeState(corrupt, pack)).toBe(false); error(() => planNarrativeFact(pack, corrupt, entry()), 'INVALID_STATE');
        }
        error(() => validateNarrativeState({ ...state, revision: 0.5 }, pack), 'INVALID_INTEGER', '$state.revision');
        const input = { module: 'narrative', action: 'choose', payload: { v: 1, revision: 0, sessionId: 1, nodeId: 'hello', choiceId: 'read-note' } };
        expect(validateNarrativeInput(input)).toEqual(input);
        error(() => validateNarrativeInput({ ...input, payload: { ...input.payload, effects: [] } }), 'INVALID_INPUT');
        error(() => validateNarrativeInput({ ...input, payload: { ...input.payload, v: 2 } }), 'INVALID_VERSION');
        error(() => validateNarrativeInput({ ...input, payload: { ...input.payload, sessionId: -1 } }), 'INVALID_INPUT');
        error(() => validateNarrativeFact({ ...entry(), actorId: 4 }, pack), 'INVALID_FACT');
        expect(state).toEqual(initialNarrativeState(pack));
    });
    it('rejects manual transitions at the bound while close syntax remains valid', () => {
        const pack = sample(), state = initialNarrativeState(pack);
        error(() => planNarrativeChoice(pack, state, { kind: 'dialogue-choice', dialogueId: 'archive.greeting', choiceId: 'leave', factId: 1, depth: 1, turn: 0 },
            { dialogueId: 'archive.greeting', nodeId: 'hello', choiceId: 'leave', transitions: pack.config.limits.transitionsPerSession }), 'TRANSITION_LIMIT');
        expect(validateNarrativeInput({ module: 'narrative', action: 'close', payload: { v: 1, revision: 1, sessionId: 1 } }).action).toBe('close');
        error(() => planNarrativeEffects(pack, state, entry(), [{ kind: 'set-flag', id: 'archive.read', value: false }]), 'UNKNOWN_REFERENCE');
    });
    it('snapshots external effect aliases and provider function references before callbacks', () => {
        const pack = fixture(raw => {
            raw.triggers = [trigger('reward.first', 0, { on: { kind: 'story', eventId: 'archive.read-done' }, effects: [
                { kind: 'optional-reward', capability: 'growth.story-reward.v1', rewardId: 'archive.read', receiptId: 'archive.reward', onUnavailable: 'skip' },
                { kind: 'set-flag', id: 'archive.read', value: true },
            ] })];
        });
        const effects = structuredClone(pack.triggers[0]!.effects) as any;
        const options = { prepareReward: () => {
            effects[1].value = false;
            options.prepareReward = () => { throw new Error('must keep callback snapshot'); };
            return { status: 'skipped' as const, reason: 'absent' as const };
        } };
        const plan = planNarrativeEffects(pack, initialNarrativeState(pack), entry(), effects, options);
        expect(effects[1].value).toBe(false); expect(plan.nextState.flags['archive.read']).toBe(true);
        expect(() => { (pack.triggers[0]!.effects[1] as any).value = false; }).toThrow();
        error(() => planNarrativeFact(structuredClone(pack), initialNarrativeState(pack), entry()), 'INVALID_STATE');
    });
    it('rejects duplicate manual choices without returning a second cursor transition', () => {
        const pack = sample(), initial = initialNarrativeState(pack);
        const fact = { kind: 'dialogue-choice', dialogueId: 'archive.greeting', choiceId: 'leave', factId: 1, depth: 1, turn: 0 };
        const selection = { dialogueId: 'archive.greeting', nodeId: 'hello', choiceId: 'leave', transitions: 0 };
        const state = commitNarrativePlan(pack, initial, planNarrativeChoice(pack, initial, fact, selection));
        error(() => planNarrativeChoice(pack, state, fact, selection), 'INVALID_FACT', '$fact.factId');
        error(() => planNarrativeChoice(pack, state, { ...fact, choiceId: 'read-note' }, { ...selection, choiceId: 'read-note' }), 'INVALID_FACT', '$fact.factId');
    });
    it('rejects and retires both resolved and rejected asynchronous providers', async () => {
        const pack = sample(), state = initialNarrativeState(pack), fact = { kind: 'story', eventId: 'archive.read-done', factId: 1, depth: 1, turn: 0 };
        for (const reject of [false, true]) {
            error(() => queryNarrativePlayer((() => reject ? Promise.reject(new Error('query')) : Promise.resolve({ status: 'unavailable', reason: 'absent' })) as any), 'INVALID_OPTIONAL_RESULT');
            error(() => planNarrativeFact(pack, state, fact, { prepareReward: (() => reject ? Promise.reject(new Error('reward')) : Promise.resolve({ status: 'ready' })) as any }), 'INVALID_OPTIONAL_RESULT');
        }
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(state).toEqual(initialNarrativeState(pack));
    });
    it('rejects impossible trigger counts and validates each persisted receipt field', () => {
        const pack = fixture(raw => { raw.triggers = [trigger('bounded', 0, { repeat: { kind: 'bounded', maxFirings: 100, cooldownTurns: 0 } })]; });
        const initial = initialNarrativeState(pack), state = commitNarrativePlan(pack, initial, planNarrativeFact(pack, initial, entry()));
        for (const change of [{ firings: 100 }, { lastFactId: 2 }, { scopeKey: 'depth.1' }, { lastTurn: -1 }, { triggerId: 'missing' }]) {
            const corrupt = structuredClone(state); Object.assign(corrupt.triggerReceipts[0]!, change);
            error(() => validateNarrativeState(corrupt, pack), 'INVALID_STATE');
        }
    });
    it('excludes the root from the derived-event budget and accepts the exact bound', () => {
        const pack = fixture(raw => {
            raw.config.limits.eventsPerCommand = 1;
            raw.triggers.push(trigger('start', 0, { effects: [{ kind: 'emit-story', eventId: 'archive.read-done' }] }));
        });
        const plan = planNarrativeFact(pack, initialNarrativeState(pack), entry());
        expect(plan.usage.events).toBe(1); expect(plan.events.map(event => event.kind)).toEqual(['entered-level','story']);
    });
    it('deduplicates journal entries and rejects overcapacity content before planning', () => {
        const pack = fixture(raw => {
            raw.journal.push({ id: 'second.note', titleKey: 'ext.narrative.journal.note.title', textKey: 'ext.narrative.journal.note.body' });
            raw.config.limits.maxJournalEntries = 2;
            raw.triggers = [trigger('notes', 0, { effects: [{ kind: 'journal', entryId: 'archive.note' }, { kind: 'journal', entryId: 'second.note' }] })];
        });
        const state = initialNarrativeState(pack);
        const overcapacity = structuredClone(pack) as any; overcapacity.config.limits.maxJournalEntries = 1;
        error(() => loadNarrativePack(overcapacity, portraits, locales), 'JOURNAL_LIMIT'); expect(state.journal).toEqual([]);
        const duplicate = planNarrativeEffects(pack, state, { kind: 'story', eventId: 'archive.read-done', factId: 1, depth: 1, turn: 0 },
            [pack.triggers[0]!.effects[0]!, pack.triggers[0]!.effects[0]!]);
        expect(duplicate.nextState.journal).toHaveLength(1);
    });
    it('reads counter comparisons, declared scalar flags, and event fields with fixed short-circuiting', () => {
        const pack = fixture(raw => {
            raw.counters = [{ id: 'count', initial: 3, min: 0, max: 10 }];
            raw.flags.push({ id: 'number', type: 'integer', initial: 2, min: 0, max: 2, values: null });
            raw.flags.push({ id: 'text', type: 'string', initial: 'a', min: null, max: null, values: ['a','b'] });
        });
        const context = { pack, state: initialNarrativeState(pack), fact: validateNarrativeFact(entry(), pack) };
        for (const [compare, value] of [['eq',3],['ne',2],['lt',4],['lte',3],['gt',2],['gte',3]] as const)
            expect(evaluateNarrativeCondition({ op: 'counter', id: 'count', compare, value }, context)).toBe(true);
        expect(evaluateNarrativeCondition({ op: 'all', args: [{ op: 'flag', id: 'number', equals: 2 }, { op: 'flag', id: 'text', equals: 'a' }, { op: 'depth', min: 1, max: 1 }, { op: 'event-field', field: 'firstVisit', equals: true }] }, context)).toBe(true);
        expect(evaluateNarrativeCondition({ op: 'not', arg: { op: 'flag', id: 'number', equals: 1 } }, context)).toBe(true);
        error(() => evaluateNarrativeCondition({ op: 'event-field', field: 'npcId', equals: 'archive.keeper' }, context), 'INVALID_EVENT_FIELD');
        expect(evaluateNarrativeCondition({ op: 'all', args: [{ op: 'flag', id: 'number', equals: 1 }, { op: 'event-field', field: 'npcId', equals: 'archive.keeper' }] }, context)).toBe(false);
    });

    it('rejects optional result accessors without invoking them', () => {
        const getter = vi.fn(() => { throw new Error('must not read'); });
        const result = { status: 'unavailable', reason: 'absent' };
        Object.defineProperty(result, 'then', { enumerable: true, get: getter });
        error(() => queryNarrativePlayer((() => result) as any), 'INVALID_OPTIONAL_RESULT');
        const pack = sample();
        error(() => planNarrativeFact(pack, initialNarrativeState(pack), { kind: 'story', eventId: 'archive.read-done', factId: 1, depth: 1, turn: 0 }, { prepareReward: (() => result) as any }), 'INVALID_OPTIONAL_RESULT');
        expect(getter).not.toHaveBeenCalled();
    });
    it('executes renamed and expanded content entirely from data', () => {
        const raw: any = JSON.parse(JSON.stringify(definitions).split('archive.').join('new.'));
        const art = JSON.parse(JSON.stringify(portraits).split('archive.').join('new.'));
        raw.flags.push({ id: 'second.flag', type: 'boolean', initial: false, min: null, max: null, values: null });
        raw.npcs.push({ ...structuredClone(raw.npcs[0]), id: 'second.npc', placements: [{ ...raw.npcs[0].placements[0], id: 'second.placement' }] });
        raw.dialogues[0].nodes[0].choices.push({ id: 'continue', textKey: 'ext.narrative.choice.read', condition: { op: 'true' }, unavailable: 'disable', unavailableKey: null, effects: [], next: 'second' });
        raw.dialogues[0].nodes.push({ id: 'second', textKey: 'ext.narrative.dialogue.keeper.hello', portraitId: null, choices: [
            { id: 'finish', textKey: 'ext.narrative.choice.leave', condition: { op: 'true' }, unavailable: 'disable', unavailableKey: null, effects: [{ kind: 'set-flag', id: 'second.flag', value: true }], next: null },
            { id: 'second.exit', textKey: 'ext.narrative.choice.leave', condition: { op: 'true' }, unavailable: 'disable', unavailableKey: null, effects: [], next: null },
        ] });
        const pack = loadNarrativePack(raw, art, locales);
        let state = initialNarrativeState(pack);
        const first = planNarrativeChoice(pack, state, { kind: 'dialogue-choice', dialogueId: 'new.greeting', choiceId: 'continue', factId: 1, depth: 1, turn: 0 }, { dialogueId: 'new.greeting', nodeId: 'hello', choiceId: 'continue', transitions: 0 });
        state = commitNarrativePlan(pack, state, first); expect(first.choice?.nextNodeId).toBe('second');
        const second = planNarrativeChoice(pack, state, { kind: 'dialogue-choice', dialogueId: 'new.greeting', choiceId: 'finish', factId: 2, depth: 1, turn: 0 }, { dialogueId: 'new.greeting', nodeId: 'second', choiceId: 'finish', transitions: 1 });
        state = commitNarrativePlan(pack, state, second); expect(state.flags['second.flag']).toBe(true); expect(second.choice?.nextNodeId).toBe(null);
        const minimal = fixture(value => { value.npcs = []; value.dialogues = []; value.flags = []; value.triggers = []; value.journal = []; value.storyEvents = []; });
        expect(commitNarrativePlan(minimal, initialNarrativeState(minimal), planNarrativeFact(minimal, initialNarrativeState(minimal), entry())).revision).toBe(1);
    });

    it('detaches shared input containers using serialized JSON tree semantics', () => {
        const pack = sample(), state = initialNarrativeState(pack);
        state.rewardReceipts = state.triggerReceipts as any;
        const loaded = validateNarrativeState(state, pack);
        expect(loaded.rewardReceipts).not.toBe(loaded.triggerReceipts);
        const plan = planNarrativeFact(pack, state, { kind: 'story', eventId: 'archive.read-done', factId: 1, depth: 1, turn: 0 });
        expect(plan.nextState.triggerReceipts).toHaveLength(1); expect(plan.nextState.rewardReceipts).toHaveLength(1);
        expect(state.triggerReceipts).toEqual([]); expect(state.rewardReceipts).toEqual([]);
    });
    it('allows one explicit step per manual loop until the configured transition bound', () => {
        const pack = fixture(raw => {
            raw.config.limits.transitionsPerSession = 2;
            raw.dialogues[0].nodes[0].choices.push({ id: 'again', textKey: 'ext.narrative.choice.read', condition: { op: 'true' }, unavailable: 'disable', unavailableKey: null, effects: [], next: 'hello' });
        });
        let state = initialNarrativeState(pack);
        const fact = (id: number) => ({ kind: 'dialogue-choice', dialogueId: 'archive.greeting', choiceId: 'again', factId: id, depth: 1, turn: 0 });
        const choice = (transitions: number) => ({ dialogueId: 'archive.greeting', nodeId: 'hello', choiceId: 'again', transitions });
        for (let index = 0; index < 2; index++) {
            const plan = planNarrativeChoice(pack, state, fact(index + 1), choice(index));
            state = commitNarrativePlan(pack, state, plan); expect(plan.choice?.nextNodeId).toBe('hello'); expect(plan.choice?.transitions).toBe(index + 1);
            expect(plan.events).toHaveLength(1); expect(plan.usage.events).toBe(0);
        }
        error(() => planNarrativeChoice(pack, state, fact(3), choice(2)), 'TRANSITION_LIMIT');
    });

    it('binds a prepared plan to the exact loaded package instance', () => {
        const pack = sample(), identicalPack = sample(), state = initialNarrativeState(pack);
        const plan = planNarrativeFact(pack, state, entry());
        expect(identicalPack).toEqual(pack); expect(identicalPack).not.toBe(pack);
        error(() => commitNarrativePlan(identicalPack, state, plan), 'STALE_PLAN', '$plan');
        expect(state).toEqual(initialNarrativeState(pack));
    });
    it('evaluates standalone conditions against entry snapshots despite callback mutations', () => {
        const pack = fixture(raw => { raw.counters = [{ id: 'count', initial: 0, min: 0, max: 10 }]; });
        const state = initialNarrativeState(pack), fact: { kind: 'entered-level'; firstVisit: boolean; factId: number; depth: number; turn: number } = { ...entry() };
        const optional = { op: 'optional-player', capability: 'growth.public-character.v1', field: 'level', compare: 'gte', value: 1, onUnavailable: false } as const;
        const query = vi.fn(() => {
            state.flags['archive.read'] = true; state.counters.count = 10;
            fact.depth = 2; fact.firstVisit = false;
            context.queryOptional = () => { throw new Error('must not replace captured provider'); };
            return { status: 'available' as const, value: { level: 1, professionId: null, lineageId: null, faithId: null } };
        });
        const context = { pack, state, fact, queryOptional: query as import('../conditions').NarrativeQuery };
        expect(evaluateNarrativeCondition({ op: 'all', args: [optional,
            { op: 'flag', id: 'archive.read', equals: false }, { op: 'counter', id: 'count', compare: 'eq', value: 0 },
            { op: 'depth', min: 1, max: 1 }, { op: 'event-field', field: 'firstVisit', equals: true }, optional,
        ] }, context)).toBe(true);
        expect(query).toHaveBeenCalledOnce();
        // These source changes were made explicitly by the adversarial callback, not by the reader.
        expect(state.flags['archive.read']).toBe(true); expect(state.counters.count).toBe(10); expect(fact.depth).toBe(2);
    });

});
