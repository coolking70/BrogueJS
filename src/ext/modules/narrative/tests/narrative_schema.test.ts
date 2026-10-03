import { describe, expect, it } from 'vitest';
import definitions from '../data/definitions.json';
import portraitData from '../data/portraits.json';
import locale from '../locales/zh_CN.json';
import { NarrativeError, NARRATIVE_ERROR_CODES, type NarrativeErrorCode } from '../errors';
import { assertLoadedNarrativePack, assertNarrativeJson, freezeNarrative, loadNarrativePack, loadPortraitManifest, NARRATIVE_LIMITS, validateNarrativePack } from '../schema';
import type { Condition, NarrativePack } from '../types';
import { initialNarrativeState, validateNarrativeState } from '../state';
import { planNarrativeFact } from '../effects';

type Mutable<T> = T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const fixture = (): Mutable<NarrativePack> => structuredClone(definitions) as Mutable<NarrativePack>;
const load = (value: unknown = fixture(), portraits: unknown = portraitData, locales: unknown = locale) => loadNarrativePack(value, portraits, locales);
function rejects(value: unknown, code: NarrativeErrorCode, path?: string, portraits: unknown = portraitData, locales: unknown = locale): void {
    let caught: unknown;
    try { load(value, portraits, locales); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(NarrativeError);
    expect((caught as NarrativeError).code).toBe(code);
    expect((caught as NarrativeError).path).toMatch(/^\$/);
    if (path !== undefined) expect((caught as NarrativeError).path).toBe(path);
}
const bad = (mutate: (pack: Mutable<NarrativePack>) => void, code: NarrativeErrorCode, path?: string): void => {
    const pack = fixture(); mutate(pack); rejects(pack, code, path);
};
const choice = (pack: Mutable<NarrativePack>) => pack.dialogues[0]!.nodes[0]!.choices[0]!;
const leave = (pack: Mutable<NarrativePack>) => pack.dialogues[0]!.nodes[0]!.choices[1]!;
const trigger = (pack: Mutable<NarrativePack>) => pack.triggers[0]!;
const text = 'ext.narrative.choice.leave';

describe('narrative 2a1 pure schema', () => {
    it('loads the complete original sample as isolated recursively frozen JSON', () => {
        const raw = fixture(); const result = load(raw);
        expect(result).toEqual(raw); expect(result).not.toBe(raw);
        expect(result.npcs[0]!.id).toBe('archive.keeper');
        expect(result.npcs[0]!.presence).toBe('stationary-interactable');
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.dialogues[0]!.nodes[0]!.choices[0]!.effects)).toBe(true);
        raw.flags[0]!.initial = true;
        expect(result.flags[0]!.initial).toBe(false);
        expect(validateNarrativePack(definitions, portraitData, locale)).toEqual(result);
    });
    it('brands only loader-produced immutable packs without writing state into JSON', () => {
        expect(() => assertLoadedNarrativePack(load())).not.toThrow();
        expect(() => assertLoadedNarrativePack(freezeNarrative(fixture()))).toThrow(NarrativeError);
        expect(() => assertLoadedNarrativePack(structuredClone(load()))).toThrow(NarrativeError);
    });
    it('requires no NPC and accepts a completely empty content package', () => {
        const raw = fixture(); for (const key of ['flags', 'counters', 'npcs', 'dialogues', 'journal', 'storyEvents', 'triggers'] as const) raw[key] = [];
        expect(load(raw).npcs).toEqual([]);
    });
    it('keeps display version and asset changes outside mechanical package identity', () => {
        const portraits = structuredClone(portraitData); portraits.displayVersion = '2.3.4'; portraits.portraits[0]!.width = 1024;
        Object.assign(portraits.portraits[0]!, { asset: 'art/keeper-new.webp' });
        expect(load(definitions, portraits)).toEqual(load());
        expect(loadPortraitManifest(portraits, locale).displayVersion).toBe('2.3.4');
        expect(Object.isFrozen(loadPortraitManifest(portraits, locale).portraits[0])).toBe(true);
    });
    it.each(['schema', 'moduleVersion', 'rulesVersion', 'stateVersion', 'inputVersion'])('rejects unsupported %s', key => {
        const raw = fixture(); Object.assign(raw, { [key]: key.endsWith('Version') && key !== 'stateVersion' && key !== 'inputVersion' ? '2.0.0' : 2 });
        rejects(raw, 'INVALID_VERSION', `$.${key}`);
    });
    it('rejects a different module owner', () => { const raw = fixture(); Object.assign(raw, { moduleId: 'growth' }); rejects(raw, 'INVALID_ID', '$.moduleId'); });
    it('uses stable machine codes with localized explanation keys', () => {
        for (const code of NARRATIVE_ERROR_CODES) expect(locale).toHaveProperty(`ext.narrative.error.${code}`);
        expect(new NarrativeError('INVALID_INPUT', '$input.v').message).toBe('Narrative INVALID_INPUT at $input.v');
        expect(new NarrativeError('INVALID_INPUT', '$input.v').textKey).toBe('ext.narrative.error.INVALID_INPUT');
    });
    it.each([
        ['root', (p: Mutable<NarrativePack>) => Object.assign(p, { surprise: true }), '$.surprise'],
        ['config', (p: Mutable<NarrativePack>) => Object.assign(p.config, { script: '' }), '$.config.script'],
        ['condition', (p: Mutable<NarrativePack>) => Object.assign(choice(p).condition, { eval: '' }), '$.dialogues[0].nodes[0].choices[0].condition.eval'],
        ['effect', (p: Mutable<NarrativePack>) => Object.assign(choice(p).effects[0]!, { actorId: 1 }), '$.dialogues[0].nodes[0].choices[0].effects[0].actorId'],
    ] as const)('rejects unknown keys at %s', (_label, mutate, path) => { bad(mutate, 'UNKNOWN_KEY', path); });
    it('rejects missing keys and wrong containers', () => {
        const raw = fixture(); delete (raw as unknown as Record<string, unknown>).stateVersion;
        rejects(raw, 'INVALID_TYPE', '$.stateVersion'); rejects([], 'INVALID_TYPE');
        bad(p => Object.assign(p, { flags: {} }), 'INVALID_TYPE', '$.flags');
        bad(p => Object.assign(p.dialogues[0]!.nodes[0]!, { choices: [] }), 'INVALID_RANGE');
    });

    it.each([undefined, () => 1, BigInt(1), Symbol('x'), Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1.5])('rejects non-JSON or unsafe numeric scalar %s', value => {
        const raw = fixture(); Object.assign(raw.flags[0]!, { initial: value });
        rejects(raw, typeof value === 'number' ? 'INVALID_INTEGER' : 'INVALID_JSON');
    });
    it.each(['__proto__', 'constructor', 'prototype'])('rejects dangerous own key %s', key => {
        const raw = fixture(); Object.defineProperty(raw, key, { value: {}, enumerable: true }); rejects(raw, 'INVALID_JSON');
    });
    it('rejects cyclic values, custom prototypes, sparse and augmented arrays', () => {
        const cyclic = fixture(); Object.assign(cyclic, { cycle: cyclic }); rejects(cyclic, 'INVALID_JSON');
        const inherited = fixture(); Object.setPrototypeOf(inherited, { hidden: true }); rejects(inherited, 'INVALID_JSON');
        const sparse = fixture(); sparse.flags.length = 3; rejects(sparse, 'INVALID_JSON');
        const extended = fixture(); Object.assign(extended.flags, { extra: 1 }); rejects(extended, 'INVALID_JSON');
        const arrayPrototype = fixture(); Object.setPrototypeOf(arrayPrototype.flags, null); rejects(arrayPrototype, 'INVALID_JSON');
    });
    it('never invokes getters and rejects symbol/non-enumerable properties', () => {
        let getterCalls = 0;
        const accessor = fixture(); Object.defineProperty(accessor, 'flags', { enumerable: true, get: () => { getterCalls++; return []; } });
        rejects(accessor, 'INVALID_JSON'); expect(getterCalls).toBe(0);
        const symbol = fixture(); Object.assign(symbol, { [Symbol('hidden')]: 1 }); rejects(symbol, 'INVALID_JSON');
        const hidden = fixture(); Object.defineProperty(hidden, 'secret', { value: 1 }); rejects(hidden, 'INVALID_JSON');
    });
    it('bounds generic recursion and content size before typed traversal', () => {
        let nested: unknown = true; for (let i = 0; i < NARRATIVE_LIMITS.maxJsonDepth + 1; i++) nested = { nested };
        const raw = fixture(); Object.assign(raw, { nested }); rejects(raw, 'INVALID_JSON');
        expect(() => assertNarrativeJson('a'.repeat(NARRATIVE_LIMITS.maxStringLength + 1))).toThrow(NarrativeError);
        expect(() => assertNarrativeJson(Array(NARRATIVE_LIMITS.maxJsonValues + 1).fill(null))).toThrow(NarrativeError);
    });
    it('supports null-prototype JSON objects, acyclic aliases, and pure explicit freezing', () => {
        const shared = { value: 1 }; const value = Object.assign(Object.create(null), { one: shared, two: shared });
        expect(() => assertNarrativeJson(value)).not.toThrow();
        expect(freezeNarrative(value)).toBe(value); expect(Object.isFrozen(shared)).toBe(true);
    });
    it.each(['<script>alert(1)</script>', 'javascript:alert(1)', 'eval("x")', 'new Function("x")'])('rejects markup/script strings: %s', unsafe => {
        const locales = { ...locale, [text]: unsafe }; rejects(definitions, 'INVALID_TEXT', undefined, portraitData, locales);
    });

    it.each(['', 'invalid id', '__proto__', 'constructor', 'prototype', 'Upper', 'a'.repeat(129)])('rejects malformed definition ID %s', value => { bad(p => { p.flags[0]!.id = value; }, 'INVALID_ID'); });
    it('rejects unsafe record IDs for counters before initial-state creation', () => {
        for (const reserved of ['constructor', 'prototype']) bad(p => { p.counters.push({ id: reserved, initial: 0, min: 0, max: 1 }); }, 'INVALID_ID');
    });
    it('requires global definition identity uniqueness across categories and placements', () => {
        bad(p => { p.counters.push({ id: p.flags[0]!.id, initial: 0, min: 0, max: 2 }); }, 'DUPLICATE_ID');
        bad(p => { p.npcs[0]!.placements[0]!.id = p.journal[0]!.id; }, 'DUPLICATE_ID');
        bad(p => { trigger(p).id = p.storyEvents[0]!.id; }, 'DUPLICATE_ID');
    });
    it('enforces node IDs and choice IDs across a dialogue while allowing local IDs in other dialogues', () => {
        bad(p => { p.dialogues[0]!.nodes.push(structuredClone(p.dialogues[0]!.nodes[0]!)); }, 'DUPLICATE_ID');
        bad(p => { leave(p).id = choice(p).id; }, 'DUPLICATE_ID');
        const raw = fixture(); const other = structuredClone(raw.dialogues[0]!); other.id = 'other.dialogue'; raw.dialogues.push(other);
        expect(load(raw).dialogues).toHaveLength(2);
    });
    it.each([
        ['NPC dialogue', (p: Mutable<NarrativePack>) => { p.npcs[0]!.dialogueId = 'missing'; }],
        ['portrait', (p: Mutable<NarrativePack>) => { p.npcs[0]!.portraitId = 'missing'; }],
        ['entry', (p: Mutable<NarrativePack>) => { p.dialogues[0]!.entry = 'missing'; }],
        ['next', (p: Mutable<NarrativePack>) => { choice(p).next = 'missing'; }],
        ['flag', (p: Mutable<NarrativePack>) => { choice(p).condition = { op: 'flag', id: 'missing', equals: true }; }],
        ['counter', (p: Mutable<NarrativePack>) => { choice(p).condition = { op: 'counter', id: 'missing', compare: 'eq', value: 0 }; }],
        ['journal', (p: Mutable<NarrativePack>) => { choice(p).effects = [{ kind: 'journal', entryId: 'missing' }]; }],
        ['event', (p: Mutable<NarrativePack>) => { choice(p).effects = [{ kind: 'emit-story', eventId: 'missing' }]; }],
        ['trigger NPC', (p: Mutable<NarrativePack>) => { trigger(p).on = { kind: 'npc-interacted', npcId: 'missing' }; }],
        ['trigger choice', (p: Mutable<NarrativePack>) => { trigger(p).on = { kind: 'dialogue-choice', dialogueId: p.dialogues[0]!.id, choiceId: 'missing' }; }],
    ] as const)('checks typed reference: %s', (_label, mutate) => { bad(mutate, 'UNKNOWN_REFERENCE'); });
    it('does not use arbitrary provider reward IDs as internal flag references', () => {
        const raw = fixture(); trigger(raw).effects = [{ kind: 'optional-reward', capability: 'growth.story-reward.v1', rewardId: 'provider.unknown-is-skipped', receiptId: 'unique.receipt', onUnavailable: 'skip' }];
        expect(load(raw)).toBeDefined();
    });

    it('checks bounded flag values/types and integer counters without coercion', () => {
        const raw = fixture(); raw.flags.push({ id: 'mood', type: 'string', initial: 'calm', min: null, max: null, values: ['calm', 'alert'] });
        raw.flags.push({ id: 'rank', type: 'integer', initial: 2, min: 0, max: 5, values: null });
        raw.counters.push({ id: 'visits', initial: 1, min: 0, max: Number.MAX_SAFE_INTEGER }); expect(load(raw)).toBeDefined();
        bad(p => { p.flags[0]!.initial = 'false'; }, 'FLAG_VALUE');
        const invalid = structuredClone(raw); invalid.flags[1]!.initial = 'absent'; rejects(invalid, 'FLAG_VALUE');
        invalid.flags[1]!.initial = 'calm'; invalid.flags[2]!.initial = 6; rejects(invalid, 'FLAG_VALUE');
        const overflow = structuredClone(raw); overflow.counters[0]!.initial = -1; rejects(overflow, 'INVALID_RANGE');
        const inverted = structuredClone(raw); inverted.counters[0]!.max = -1; rejects(inverted, 'INVALID_RANGE');
        bad(p => { choice(p).effects = [{ kind: 'set-flag', id: p.flags[0]!.id, value: 1 }]; }, 'FLAG_VALUE');
    });
    it('requires fixed string enums and range declarations', () => {
        const raw = fixture(); raw.flags[0] = { id: 'mode', type: 'string', initial: 'a', min: null, max: null, values: ['a', 'a'] }; rejects(raw, 'DUPLICATE_ID');
        raw.flags[0]!.values = []; rejects(raw, 'INVALID_RANGE');
        raw.flags[0] = { id: 'score', type: 'integer', initial: 0, min: null, max: 1, values: null }; rejects(raw, 'INVALID_INTEGER');
    });
    it('validates every configured ceiling and world placement range', () => {
        const keys = ['conditionDepth', 'conditionOpsPerCommand', 'effectsPerCommand', 'eventsPerCommand', 'transitionsPerSession', 'maxActiveNpcs', 'maxJournalEntries', 'maxReceipts'] as const;
        for (const key of keys) {
            const raw = fixture(); raw.config.limits[key] = NARRATIVE_LIMITS[key] + 1; rejects(raw, 'INVALID_RANGE', `$.config.limits.${key}`);
            raw.config.limits[key] = 0; rejects(raw, 'INVALID_RANGE', `$.config.limits.${key}`);
        }
        bad(p => { p.npcs[0]!.placements[0]!.maxDepth = NARRATIVE_LIMITS.maxWorldDepth + 1; }, 'INVALID_RANGE');
        bad(p => { p.npcs[0]!.placements[0]!.maxPerDepth = 2; }, 'INVALID_RANGE');
        bad(p => { p.npcs[0]!.interactionDistance = -1; }, 'INVALID_RANGE');
        bad(p => { p.npcs[0]!.placements[0]!.maxEntranceDistance = 0; }, 'INVALID_RANGE');
    });

    it('accepts all typed condition operators and validates optional capability fields', () => {
        const raw = fixture(); raw.counters.push({ id: 'count', initial: 0, min: -1, max: 1 });
        choice(raw).condition = { op: 'all', args: [
            { op: 'any', args: [{ op: 'true' }, { op: 'not', arg: { op: 'true' } }] },
            ...(['eq', 'ne', 'lt', 'lte', 'gt', 'gte'] as const).map(compare => ({ op: 'counter' as const, id: 'count', compare, value: 0 })),
            { op: 'depth', min: 1, max: 40 },
            { op: 'optional-player', capability: 'growth.public-character.v1', field: 'level', compare: 'gte', value: 2, onUnavailable: false },
            { op: 'optional-player', capability: 'growth.public-character.v1', field: 'faithId', compare: 'eq', value: 'any-faith', onUnavailable: true },
        ] }; expect(load(raw)).toBeDefined();
        bad(p => { choice(p).condition = { op: 'optional-player', capability: 'growth.public-character.v1', field: 'professionId', compare: 'gte', value: 'fighter', onUnavailable: false }; }, 'INVALID_TYPE');
        bad(p => { choice(p).condition = { op: 'optional-player', capability: 'growth.public-character.v1', field: 'level', compare: 'eq', value: '2', onUnavailable: false }; }, 'INVALID_INTEGER');
        bad(p => { Object.assign(choice(p), { condition: { op: 'optional-player', capability: 'pretend.v1', field: 'level', compare: 'gte', value: 2, onUnavailable: false } }); }, 'INVALID_TYPE');
    });
    it('narrows event-field by fact kind and validates value type/reference', () => {
        const raw = fixture(); trigger(raw).on = { kind: 'entered-level' }; trigger(raw).condition = { op: 'event-field', field: 'firstVisit', equals: true }; expect(load(raw)).toBeDefined();
        trigger(raw).condition = { op: 'event-field', field: 'npcId', equals: raw.npcs[0]!.id }; rejects(raw, 'INVALID_EVENT_FIELD');
        trigger(raw).on = { kind: 'npc-interacted', npcId: raw.npcs[0]!.id }; expect(load(raw)).toBeDefined();
        trigger(raw).on = { kind: 'story', eventId: raw.storyEvents[0]!.id }; rejects(raw, 'INVALID_EVENT_FIELD');
        choice(raw).condition = { op: 'event-field', field: 'choiceId', equals: choice(raw).id }; trigger(raw).condition = { op: 'true' }; expect(load(raw)).toBeDefined();
        bad(p => { trigger(p).on = { kind: 'entered-level' }; trigger(p).condition = { op: 'event-field', field: 'firstVisit', equals: 'true' }; }, 'INVALID_TYPE');
    });
    it('bounds condition recursion at the configured exact limit', () => {
        const raw = fixture(); raw.config.limits.conditionDepth = 8;
        let condition: Condition = { op: 'true' }; for (let i = 1; i < 8; i++) condition = { op: 'not', arg: condition };
        choice(raw).condition = condition as Mutable<Condition>; expect(load(raw)).toBeDefined();
        choice(raw).condition = { op: 'not', arg: choice(raw).condition }; rejects(raw, 'CONDITION_DEPTH');
    });
    it('checks static condition/effect/event budgets including exact boundaries', () => {
        const raw = fixture(); raw.config.limits.conditionOpsPerCommand = 3;
        choice(raw).condition = { op: 'all', args: [{ op: 'true' }, { op: 'true' }] }; expect(load(raw)).toBeDefined();
        raw.config.limits.conditionOpsPerCommand = 2; rejects(raw, 'CONDITION_LIMIT');
        bad(p => { p.config.limits.effectsPerCommand = 2; }, 'EFFECT_LIMIT');
        const effects = fixture(); effects.config.limits.effectsPerCommand = 3; expect(load(effects)).toBeDefined();
        effects.config.limits.eventsPerCommand = 1; choice(effects).effects = [
            { kind: 'emit-story', eventId: effects.storyEvents[0]!.id }, { kind: 'emit-story', eventId: effects.storyEvents[0]!.id },
        ]; rejects(effects, 'EVENT_LIMIT');
    });

    it('rejects unreachable nodes but permits explicit manual loops', () => {
        const raw = fixture(); choice(raw).next = raw.dialogues[0]!.entry; expect(load(raw)).toBeDefined();
        raw.dialogues[0]!.nodes.push({ id: 'unreachable', textKey: text, portraitId: null, choices: [{ id: 'other-leave', textKey: text, condition: { op: 'true' }, unavailable: 'hide', unavailableKey: null, effects: [], next: null }] });
        rejects(raw, 'UNREACHABLE_NODE');
    });
    it('requires a provably available effect-free exit, allowing multi-node exit paths', () => {
        bad(p => { p.dialogues[0]!.nodes[0]!.choices.pop(); }, 'MISSING_EXIT');
        bad(p => { leave(p).condition = { op: 'optional-player', capability: 'growth.public-character.v1', field: 'level', compare: 'gte', value: 1, onUnavailable: true }; }, 'MISSING_EXIT');
        const raw = fixture(); leave(raw).next = 'exit';
        raw.dialogues[0]!.nodes.push({ id: 'exit', textKey: text, portraitId: null, choices: [{ ...structuredClone(leave(raw)), id: 'finish', next: null }] });
        expect(load(raw)).toBeDefined();
        raw.dialogues[0]!.nodes[1]!.choices[0]!.next = raw.dialogues[0]!.entry; rejects(raw, 'MISSING_EXIT');
    });
    it('rejects self and indirect automatic cycles regardless of guards or receipt limits', () => {
        bad(p => { trigger(p).condition = { op: 'not', arg: { op: 'true' } }; trigger(p).effects = [{ kind: 'emit-story', eventId: p.storyEvents[0]!.id }]; }, 'AUTOMATIC_CYCLE');
        const raw = fixture(); raw.storyEvents.push({ id: 'next.event' });
        trigger(raw).effects = [{ kind: 'emit-story', eventId: 'next.event' }];
        raw.triggers.push({ id: 'back.trigger', on: { kind: 'story', eventId: 'next.event' }, priority: 1, condition: { op: 'true' }, repeat: { kind: 'once-per-run' }, effects: [{ kind: 'emit-story', eventId: raw.storyEvents[0]!.id }] });
        rejects(raw, 'AUTOMATIC_CYCLE'); raw.triggers[1]!.effects = []; expect(load(raw)).toBeDefined();
    });
    it('requires every optional reward receipt occurrence to be unique across all effects', () => {
        bad(p => { choice(p).effects.push(structuredClone(trigger(p).effects[0]!)); }, 'DUPLICATE_RECEIPT');
        bad(p => { trigger(p).effects.push(structuredClone(trigger(p).effects[0]!)); }, 'DUPLICATE_RECEIPT');
    });
    it('estimates once/per-depth scope storage and shared reward receipt capacity', () => {
        const raw = fixture(); raw.config.limits.maxReceipts = 2; expect(load(raw)).toBeDefined();
        raw.config.limits.maxReceipts = 1; rejects(raw, 'RECEIPT_LIMIT');
        trigger(raw).repeat = { kind: 'once-per-depth' }; raw.config.limits.maxReceipts = 41; expect(load(raw)).toBeDefined();
        raw.config.limits.maxReceipts = 40; rejects(raw, 'RECEIPT_LIMIT');
        trigger(raw).repeat = { kind: 'bounded', maxFirings: 2, cooldownTurns: 0 }; raw.config.limits.maxReceipts = 2; expect(load(raw)).toBeDefined();
        trigger(raw).repeat = { kind: 'bounded', maxFirings: 0, cooldownTurns: 0 }; rejects(raw, 'INVALID_RANGE');
    });
    it('requires adequate journal capacity without silent truncation', () => {
        const raw = fixture(); raw.config.limits.maxJournalEntries = 1;
        raw.journal.push({ id: 'another-note', titleKey: text, textKey: text }); rejects(raw, 'JOURNAL_LIMIT');
    });

    it('keeps shared JSON capacity above the maximum legal state and bounded plan traces', () => {
        // Every receipt shares one cap: trigger objects have 5 scalar fields (6 visits),
        // reward objects have 4 (5 visits), so the all-trigger case is the upper bound.
        const stateBound = 1 + 3 + (1 + 4096) * 2 + 2 + 65536 * 6 + 1 + 4096 * 3;
        const planBound = 1 + 2 + stateBound + (1 + 256 * 4) + (1 + 129 * 7)
            + (1 + 1024 * 3) + (1 + 256 * 9) + 4 + 4;
        expect(stateBound).toBe(413705);
        expect(planBound).toBe(421023);
        expect(planBound).toBeLessThan(NARRATIVE_LIMITS.maxJsonValues);
        const raw = fixture();
        raw.config.limits.maxReceipts = 65536;
        raw.config.limits.maxJournalEntries = 4096;
        raw.config.limits.conditionOpsPerCommand = 1024;
        raw.npcs = []; raw.dialogues = [];
        raw.flags = Array.from({ length: 4096 }, (_, i) => ({ id: `capacity.flag-${i}`, type: 'boolean', initial: false, min: null, max: null, values: null }));
        raw.counters = Array.from({ length: 4096 }, (_, i) => ({ id: `capacity.counter-${i}`, initial: 0, min: 0, max: 1 }));
        raw.journal = Array.from({ length: 4096 }, (_, i) => ({ id: `capacity.journal-${i}`, titleKey: text, textKey: text }));
        raw.storyEvents = [{ id: 'capacity.even' }, { id: 'capacity.odd' }];
        raw.triggers = Array.from({ length: 1638 }, (_, i) => ({ id: `capacity.depth-${String(i).padStart(4, '0')}`,
            on: { kind: 'story', eventId: i % 2 ? 'capacity.odd' : 'capacity.even' }, priority: 0,
            condition: { op: 'true' }, repeat: { kind: 'once-per-depth' }, effects: [] }));
        for (let i = 0; i < 16; i++) raw.triggers.push({ id: `capacity.once-${String(i).padStart(2, '0')}`, on: { kind: 'entered-level' }, priority: 0, condition: { op: 'true' }, repeat: { kind: 'once-per-run' }, effects: [] });
        const pack = load(raw); const state = initialNarrativeState(pack);
        state.revision = 81; state.lastFactId = 81;
        state.triggerReceipts = pack.triggers.flatMap(t => Array.from({ length: t.repeat.kind === 'once-per-depth' ? 40 : 1 }, (_, i) => ({ triggerId: t.id, scopeKey: t.repeat.kind === 'once-per-depth' ? `depth.${i + 1}` : 'run', firings: 1, lastTurn: 0, lastFactId: 81 })));
        state.triggerReceipts.sort((a, b) => `${a.triggerId}:${a.scopeKey}` < `${b.triggerId}:${b.scopeKey}` ? -1 : 1);
        state.journal = pack.journal.map((entry, i) => ({ entryId: entry.id, order: i + 1 }));
        expect(state.triggerReceipts).toHaveLength(65536);
        expect(validateNarrativeState(state, pack).triggerReceipts).toHaveLength(65536);
        const plan = planNarrativeFact(pack, state, { kind: 'entered-level', firstVisit: false, factId: 82, depth: 40, turn: 0 });
        expect(plan.nextState.triggerReceipts).toHaveLength(65536);
        expect(plan.nextState.journal).toHaveLength(4096);
        expect(plan.triggered).toEqual([]);
        expect(Object.isFrozen(plan)).toBe(true);
        expect(state.lastFactId).toBe(81);
    }, 30000);
    it('accepts the 800-per-depth receipt regression past the former generic JSON ceiling', () => {
        const raw = fixture(); raw.triggers = Array.from({ length: 800 }, (_, i) => ({
            id: `bulk.trigger-${String(i).padStart(3, '0')}`, on: { kind: 'entered-level' }, priority: 0,
            condition: { op: 'true' }, repeat: { kind: 'once-per-depth' }, effects: [],
        }));
        raw.config.limits.maxReceipts = 32000; raw.config.limits.conditionOpsPerCommand = 1024;
        const pack = load(raw); const state = initialNarrativeState(pack);
        state.revision = 20; state.lastFactId = 20;
        state.triggerReceipts = pack.triggers.flatMap(t => Array.from({ length: 20 }, (_, i) => ({ triggerId: t.id, scopeKey: `depth.${i + 1}`, firings: 1, lastTurn: 0, lastFactId: i + 1 })));
        state.triggerReceipts.sort((a, b) => `${a.triggerId}:${a.scopeKey}` < `${b.triggerId}:${b.scopeKey}` ? -1 : 1);
        const plan = planNarrativeFact(pack, state, { kind: 'entered-level', firstVisit: true, factId: 21, depth: 21, turn: 0 });
        expect(plan.nextState.triggerReceipts).toHaveLength(16800);
        expect(plan.triggered).toHaveLength(800);
        expect(plan.usage.conditions).toBe(800);
        expect(validateNarrativeState(plan.nextState, pack).triggerReceipts).toHaveLength(16800);
        expect(state.triggerReceipts).toHaveLength(16000);
    }, 30000);
    it('still rejects excess total JSON values spread over individually bounded arrays', () => {
        const half = NARRATIVE_LIMITS.maxJsonValues / 2;
        const value = { left: Array(half).fill(null), right: Array(half).fill(null) };
        expect(() => assertNarrativeJson(value)).toThrow(NarrativeError);
        try { assertNarrativeJson(value); } catch (error) { expect((error as NarrativeError).code).toBe('INVALID_JSON'); }
    });

    it('requires nonempty namespaced localized text and rejects absent keys', () => {
        bad(p => { choice(p).textKey = 'outside.key'; }, 'INVALID_TEXT');
        bad(p => { choice(p).textKey = 'ext.narrative.missing'; }, 'INVALID_TEXT');
        rejects(definitions, 'INVALID_TEXT', undefined, portraitData, { ...locale, [text]: '  ' });
        rejects(definitions, 'INVALID_TEXT', undefined, portraitData, { ...locale, other: 'text' });
    });
    it.each(['https://example.com/a.png', '/a.png', '../a.png', 'art/../a.png', 'data:image/png;x', 'a.svg', 'a.png?code=1', 'a\\b.png'])('rejects unsafe portrait path %s', asset => {
        const portraits = structuredClone(portraitData); Object.assign(portraits.portraits[0]!, { asset }); rejects(definitions, 'INVALID_PORTRAIT', undefined, portraits);
    });
    it('checks portrait uniqueness, size, glyph and text without requiring actual image files', () => {
        const portraits = structuredClone(portraitData); portraits.portraits.push(structuredClone(portraits.portraits[0]!)); rejects(definitions, 'DUPLICATE_ID', undefined, portraits);
        portraits.portraits.pop(); portraits.portraits[0]!.height = NARRATIVE_LIMITS.maxPortraitDimension + 1; rejects(definitions, 'INVALID_RANGE', undefined, portraits);
        portraits.portraits[0]!.height = 1; portraits.portraits[0]!.altKey = 'ext.narrative.no-alt'; rejects(definitions, 'INVALID_TEXT', undefined, portraits);
        portraits.portraits[0]!.altKey = text; Object.assign(portraits.portraits[0]!, { asset: 'not-installed/yet.png' }); expect(load(definitions, portraits)).toBeDefined();
        bad(p => { p.npcs[0]!.glyph = 'ab'; }, 'INVALID_TEXT');
        bad(p => { p.npcs[0]!.color = 'red'; }, 'INVALID_TYPE');
    });
});
