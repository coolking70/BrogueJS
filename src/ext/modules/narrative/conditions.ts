import type { ExtensionContext, OptionalQueryResult } from '../../types';
import { validId } from '../../json';
import { NarrativeError } from './errors';
import { assertNarrativeJson, assertLoadedNarrativePack, freezeNarrative, NARRATIVE_LIMITS } from './schema';
import { narrativeInteger, narrativeRecord, validFlagValue, type NarrativeState } from './state';
import type { Condition, NarrativePack } from './types';

/** Explicit pure-kernel facts. These IDs are not subscribed to the engine's event stream in 2a1. */
export type NarrativeFact = { readonly factId: number; readonly depth: number; readonly turn: number } & (
    { readonly kind: 'entered-level'; readonly firstVisit: boolean }
    | { readonly kind: 'npc-interacted'; readonly npcId: string }
    | { readonly kind: 'dialogue-choice'; readonly dialogueId: string; readonly choiceId: string }
    | { readonly kind: 'story'; readonly eventId: string });
export type NarrativeQuery = ExtensionContext['queryOptional'];
export interface NarrativeBudgetUsage { conditions: number; effects: number; events: number }
export function createNarrativeBudget(): NarrativeBudgetUsage { return { conditions: 0, effects: 0, events: 0 }; }
export interface PublicNarrativePlayer { readonly level: number; readonly professionId: string | null; readonly lineageId: string | null; readonly faithId: string | null }
export type NarrativePlayerResult = { readonly status: 'unavailable'; readonly reason: 'absent' | 'unsupported-input' }
    | { readonly status: 'available'; readonly value: PublicNarrativePlayer };
export interface NarrativeConditionContext {
    readonly pack: NarrativePack; readonly state: Pick<NarrativeState, 'flags' | 'counters'>; readonly fact: NarrativeFact;
    readonly queryOptional?: NarrativeQuery;
}
export function validateNarrativeFact(raw: unknown, pack: NarrativePack): NarrativeFact {
    assertLoadedNarrativePack(pack);
    assertNarrativeJson(raw, '$fact');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new NarrativeError('INVALID_FACT', '$fact');
    const kind = (raw as Record<string, unknown>).kind;
    const specific = kind === 'entered-level' ? ['firstVisit'] : kind === 'npc-interacted' ? ['npcId']
        : kind === 'dialogue-choice' ? ['dialogueId','choiceId'] : kind === 'story' ? ['eventId'] : null;
    if (!specific) throw new NarrativeError('INVALID_FACT', '$fact.kind');
    const value = narrativeRecord(raw, ['factId','depth','turn','kind',...specific], '$fact', 'INVALID_FACT');
    for (const [key, min, max] of [['factId',1,Number.MAX_SAFE_INTEGER], ['depth',1,NARRATIVE_LIMITS.maxWorldDepth], ['turn',0,Number.MAX_SAFE_INTEGER]] as const)
        if (!narrativeInteger(value[key], min, max)) throw new NarrativeError('INVALID_FACT', `$fact.${key}`);
    if (kind === 'entered-level' && typeof value.firstVisit !== 'boolean') throw new NarrativeError('INVALID_FACT', '$fact.firstVisit');
    if (kind === 'npc-interacted' && !pack.npcs.some(npc => npc.id === value.npcId)) throw new NarrativeError('UNKNOWN_REFERENCE', '$fact.npcId');
    if (kind === 'story' && !pack.storyEvents.some(event => event.id === value.eventId)) throw new NarrativeError('UNKNOWN_REFERENCE', '$fact.eventId');
    if (kind === 'dialogue-choice') {
        const dialogue = pack.dialogues.find(dialogue => dialogue.id === value.dialogueId);
        if (!dialogue) throw new NarrativeError('UNKNOWN_REFERENCE', '$fact.dialogueId');
        if (!dialogue.nodes.some(node => node.choices.some(choice => choice.id === value.choiceId))) throw new NarrativeError('UNKNOWN_REFERENCE', '$fact.choiceId');
    }
    return freezeNarrative(structuredClone(raw) as NarrativeFact);
}
/** Reject and retire asynchronous providers so a rejected promise cannot escape as unhandled. */
export function requireNarrativeSynchronous(value: unknown, path: string): void {
    if (!value || typeof value !== 'object' && typeof value !== 'function') return;
    let owner: object | null = value as object;
    while (owner) {
        const descriptor = Object.getOwnPropertyDescriptor(owner, 'then');
        if (descriptor) {
            if (!('value' in descriptor)) throw new NarrativeError('INVALID_OPTIONAL_RESULT', path);
            if (typeof descriptor.value === 'function') {
                void Promise.resolve(value).catch(() => undefined);
                throw new NarrativeError('INVALID_OPTIONAL_RESULT', path);
            }
            return;
        }
        owner = Object.getPrototypeOf(owner);
    }
}
/** Consume only the existing foundation query result and this protocol's four public player fields. */
export function queryNarrativePlayer(query?: NarrativeQuery): NarrativePlayerResult {
    if (!query) return Object.freeze({ status: 'unavailable', reason: 'absent' });
    let raw: OptionalQueryResult;
    try { raw = query('growth.public-character.v1', Object.freeze({ v: 1 })); requireNarrativeSynchronous(raw, '$optional.player'); }
    catch { throw new NarrativeError('INVALID_OPTIONAL_RESULT', '$optional.player'); }
    try {
        assertNarrativeJson(raw, '$optional.player');
        const value = narrativeRecord(raw, raw.status === 'available' ? ['status','value'] : ['status','reason'], '$optional.player', 'INVALID_OPTIONAL_RESULT');
        if (value.status === 'unavailable') {
            if (value.reason !== 'absent' && value.reason !== 'unsupported-input') throw new NarrativeError('INVALID_OPTIONAL_RESULT', '$optional.player.reason');
            return Object.freeze({ status: 'unavailable', reason: value.reason });
        }
        if (value.status !== 'available') throw new NarrativeError('INVALID_OPTIONAL_RESULT', '$optional.player.status');
        const player = narrativeRecord(value.value, ['level','professionId','lineageId','faithId'], '$optional.player.value', 'INVALID_OPTIONAL_RESULT');
        if (!narrativeInteger(player.level, 1)) throw new NarrativeError('INVALID_OPTIONAL_RESULT', '$optional.player.value.level');
        for (const field of ['professionId','lineageId','faithId']) if (player[field] !== null && !validId(player[field])) throw new NarrativeError('INVALID_OPTIONAL_RESULT', `$optional.player.value.${field}`);
        return freezeNarrative(structuredClone(raw) as NarrativePlayerResult);
    } catch (error) {
        if (error instanceof NarrativeError && error.code === 'INVALID_OPTIONAL_RESULT') throw error;
        throw new NarrativeError('INVALID_OPTIONAL_RESULT', '$optional.player');
    }
}
/** Reads a validated package/fact and detached scratch state; no world, RNG, time, or message port is accepted. */
export function evaluateNarrativeCondition(condition: Condition, context: NarrativeConditionContext, budget = createNarrativeBudget(), path = '$condition'): boolean {
    const pack = context.pack, query = context.queryOptional;
    assertLoadedNarrativePack(pack);
    assertNarrativeJson(condition, path);
    const readState = { flags: context.state.flags, counters: context.state.counters };
    assertNarrativeJson(readState, '$condition.state');
    narrativeRecord(readState.flags, pack.flags.map(flag => flag.id), '$condition.state.flags', 'INVALID_STATE');
    narrativeRecord(readState.counters, pack.counters.map(counter => counter.id), '$condition.state.counters', 'INVALID_STATE');
    for (const definition of pack.flags) if (!validFlagValue(definition, readState.flags[definition.id])) throw new NarrativeError('INVALID_STATE', `$condition.state.flags.${definition.id}`);
    for (const definition of pack.counters) if (!narrativeInteger(readState.counters[definition.id], definition.min, definition.max)) throw new NarrativeError('INVALID_STATE', `$condition.state.counters.${definition.id}`);
    // Snapshot only fields this reader uses; large receipt/journal collections are never cloned per trigger.
    let player: NarrativePlayerResult | undefined;
    const snapshot: EvaluatedContext = { pack, state: freezeNarrative(structuredClone(readState)),
        fact: validateNarrativeFact(context.fact, pack), readPlayer: () => player ??= queryNarrativePlayer(query) };
    return evaluateCondition(freezeNarrative(structuredClone(condition)), snapshot, budget, path, 1);
}
type EvaluatedContext = Omit<NarrativeConditionContext, 'queryOptional'> & { readonly readPlayer: () => NarrativePlayerResult };
function evaluateCondition(condition: Condition, context: EvaluatedContext, budget: NarrativeBudgetUsage, path: string, depth: number): boolean {
    if (depth > context.pack.config.limits.conditionDepth) throw new NarrativeError('CONDITION_DEPTH', path);
    if (++budget.conditions > context.pack.config.limits.conditionOpsPerCommand) throw new NarrativeError('CONDITION_LIMIT', path);
    switch (condition.op) {
        case 'true': return true;
        case 'all': return condition.args.every((arg, index) => evaluateCondition(arg, context, budget, `${path}.args[${index}]`, depth + 1));
        case 'any': return condition.args.some((arg, index) => evaluateCondition(arg, context, budget, `${path}.args[${index}]`, depth + 1));
        case 'not': return !evaluateCondition(condition.arg, context, budget, `${path}.arg`, depth + 1);
        case 'flag': {
            const definition = context.pack.flags.find(flag => flag.id === condition.id);
            if (!definition) throw new NarrativeError('UNKNOWN_REFERENCE', `${path}.id`);
            if (!validFlagValue(definition, condition.equals)) throw new NarrativeError('FLAG_VALUE', `${path}.equals`);
            return context.state.flags[condition.id] === condition.equals;
        }
        case 'counter': {
            if (!context.pack.counters.some(counter => counter.id === condition.id)) throw new NarrativeError('UNKNOWN_REFERENCE', `${path}.id`);
            const value = context.state.counters[condition.id]!;
            switch (condition.compare) {
                case 'eq': return value === condition.value;
                case 'ne': return value !== condition.value;
                case 'lt': return value < condition.value;
                case 'lte': return value <= condition.value;
                case 'gt': return value > condition.value;
                case 'gte': return value >= condition.value;
            }
            throw new NarrativeError('INVALID_CONDITION', `${path}.compare`);
        }
        case 'depth': return context.fact.depth >= condition.min && context.fact.depth <= condition.max;
        case 'event-field': {
            const fact = context.fact;
            if (condition.field === 'firstVisit' && fact.kind === 'entered-level') return fact.firstVisit === condition.equals;
            if (condition.field === 'npcId' && fact.kind === 'npc-interacted') return fact.npcId === condition.equals;
            if (condition.field === 'choiceId' && fact.kind === 'dialogue-choice') return fact.choiceId === condition.equals;
            throw new NarrativeError('INVALID_EVENT_FIELD', `${path}.field`);
        }
        case 'optional-player': {
            const result = context.readPlayer();
            if (result.status === 'unavailable') return condition.onUnavailable;
            const value = result.value[condition.field];
            if (value === null) return false;
            return condition.compare === 'eq' ? value === condition.value : typeof value === 'number' && typeof condition.value === 'number' && value >= condition.value;
        }
    }
    throw new NarrativeError('INVALID_CONDITION', `${path}.op`);
}
