import { canonical } from '../../json';
import { NarrativeError } from './errors';
import { assertNarrativeJson, freezeNarrative, assertLoadedNarrativePack } from './schema';
import { createNarrativeBudget, evaluateNarrativeCondition, validateNarrativeFact, queryNarrativePlayer, requireNarrativeSynchronous,
    type NarrativeBudgetUsage, type NarrativeConditionContext, type NarrativeFact, type NarrativePlayerResult, type NarrativeQuery } from './conditions';
import { initialNarrativeState, narrativeReceiptCount, narrativeInteger, narrativeRecord, narrativeRewardInstance, validateNarrativeState, validFlagValue, type NarrativeState } from './state';
import { narrativeTriggerEligible, orderedNarrativeTriggers, recordNarrativeTrigger } from './triggers';
import type { Condition, Effect, NarrativePack } from './types';

export interface NarrativeRewardIntent {
    readonly capability: 'growth.story-reward.v1'; readonly rewardId: string; readonly receiptId: string;
    readonly instanceKey: string; readonly recipient: 'player'; readonly factId: number; readonly effectIndex: number;
}
export type NarrativeRewardPreparation = { readonly status: 'ready' }
    | { readonly status: 'skipped'; readonly reason: 'absent' | 'disabled' | 'unsupported-key' };
export interface NarrativePlanOptions {
    readonly queryOptional?: NarrativeQuery;
    /** Pure preflight: ready is not an applied receipt. */
    readonly prepareReward?: (intent: Readonly<NarrativeRewardIntent>) => NarrativeRewardPreparation;
}
export interface NarrativeChoiceSelection { readonly dialogueId: string; readonly nodeId: string; readonly choiceId: string; readonly transitions: number }
export interface NarrativePlan {
    readonly kind: 'narrative-plan'; readonly baseRevision: number; readonly nextState: NarrativeState;
    readonly messages: readonly { readonly textKey: string; readonly factId: number; readonly effectIndex: number }[];
    /** Includes the explicit root; usage.events counts only derived story events. */
    readonly events: readonly NarrativeFact[]; readonly triggered: readonly { readonly triggerId: string; readonly factId: number }[];
    readonly rewardIntents: readonly (NarrativeRewardIntent & { readonly status: 'prepared' })[];
    readonly usage: Readonly<NarrativeBudgetUsage>;
    readonly choice?: { readonly dialogueId: string; readonly nextNodeId: string | null; readonly transitions: number };
}
// Plans are immutable, session-only capabilities. Serialized or fabricated lookalikes cannot be committed.
const plans = new WeakMap<NarrativePlan, { readonly pack: NarrativePack; readonly base: string }>();
function declaredEffects(pack: NarrativePack): ReadonlySet<string> {
    return new Set([...pack.triggers.flatMap(trigger => trigger.effects), ...pack.dialogues.flatMap(dialogue => dialogue.nodes.flatMap(node => node.choices.flatMap(choice => choice.effects)))].map(canonical));
}
function prepareReward(intent: NarrativeRewardIntent, prepare?: NarrativePlanOptions['prepareReward']): NarrativeRewardPreparation {
    if (!prepare) return { status: 'skipped', reason: 'absent' };
    try {
        const raw = prepare(freezeNarrative({ ...intent }));
        requireNarrativeSynchronous(raw, '$optional.reward');
        assertNarrativeJson(raw, '$optional.reward');
        const result = narrativeRecord(raw, raw.status === 'ready' ? ['status'] : ['status','reason'], '$optional.reward', 'INVALID_OPTIONAL_RESULT');
        if (result.status === 'ready') return { status: 'ready' };
        if (result.status !== 'skipped' || !['absent','disabled','unsupported-key'].includes(result.reason as string)) throw new NarrativeError('INVALID_OPTIONAL_RESULT', '$optional.reward');
        return { status: 'skipped', reason: result.reason as 'absent' | 'disabled' | 'unsupported-key' };
    } catch { throw new NarrativeError('INVALID_OPTIONAL_RESULT', '$optional.reward'); }
}
function buildPlan(pack: NarrativePack, rawState: unknown, rawFact: unknown, effects: readonly Effect[], options: NarrativePlanOptions,
    prerequisite?: { condition: Condition; path: string }, choice?: NarrativePlan['choice']): NarrativePlan {
    assertLoadedNarrativePack(pack);
    const state = validateNarrativeState(rawState, pack), base = canonical(state), root = validateNarrativeFact(rawFact, pack);
    assertNarrativeJson(effects, '$effects');
    const plannedEffects = freezeNarrative(structuredClone(effects));
    const providers = { queryOptional: options.queryOptional, prepareReward: options.prepareReward };
    if (providers.queryOptional !== undefined && typeof providers.queryOptional !== 'function' || providers.prepareReward !== undefined && typeof providers.prepareReward !== 'function') throw new NarrativeError('INVALID_OPTIONAL_RESULT', '$optional');
    const knownEffects = declaredEffects(pack);
    plannedEffects.forEach((effect, index) => { if (!knownEffects.has(canonical(effect))) throw new NarrativeError('UNKNOWN_REFERENCE', `$effects[${index}]`); });
    if (root.factId < state.lastFactId) throw new NarrativeError('INVALID_FACT', '$fact.factId');
    const baseRevision = state.revision;
    const usage = createNarrativeBudget(), messages: { textKey: string; factId: number; effectIndex: number }[] = [], events: NarrativeFact[] = [];
    const triggered: { triggerId: string; factId: number }[] = [], rewardIntents: (NarrativeRewardIntent & { status: 'prepared' })[] = [];
    const finish = (): NarrativePlan => {
        validateNarrativeState(state, pack);
        const result: NarrativePlan = freezeNarrative({ kind: 'narrative-plan', baseRevision, nextState: state, messages, events, triggered, rewardIntents, usage, ...(choice ? { choice } : {}) });
        plans.set(result, { pack, base });
        return result;
    };
    // Same-ID payloads cannot produce effects twice. Older IDs are rejected rather than silently discarding new input.
    if (root.factId === state.lastFactId) return finish();
    if (state.triggerReceipts.some(receipt => receipt.lastTurn > root.turn)) throw new NarrativeError('INVALID_FACT', '$fact.turn');
    if (!narrativeInteger(state.revision + 1, 1)) throw new NarrativeError('INVALID_STATE', '$state.revision');
    state.revision++;
    let playerSnapshot: NarrativePlayerResult | undefined;
    function condition(condition: Condition, fact: NarrativeFact, path: string): boolean {
        const context: NarrativeConditionContext = { pack, state, fact, queryOptional: () => {
            const result = playerSnapshot ??= queryNarrativePlayer(providers.queryOptional);
            return result.status === 'available' ? { status: 'available', value: { ...result.value } } : result;
        } };
        return evaluateNarrativeCondition(condition, context, usage, path);
    }
    function enqueue(fact: NarrativeFact, derived = true): void {
        if (derived && ++usage.events > pack.config.limits.eventsPerCommand) throw new NarrativeError('EVENT_LIMIT', '$plan.events');
        events.push(freezeNarrative(fact));
        state.lastFactId = fact.factId;
    }
    function apply(batch: readonly Effect[], fact: NarrativeFact, path: string): void {
        batch.forEach((effect, index) => {
            const effectPath = `${path}[${index}]`;
            if (++usage.effects > pack.config.limits.effectsPerCommand) throw new NarrativeError('EFFECT_LIMIT', effectPath);
            switch (effect.kind) {
                case 'set-flag': {
                    const definition = pack.flags.find(flag => flag.id === effect.id);
                    if (!definition) throw new NarrativeError('UNKNOWN_REFERENCE', `${effectPath}.id`);
                    if (!validFlagValue(definition, effect.value)) throw new NarrativeError('FLAG_VALUE', `${effectPath}.value`);
                    state.flags[effect.id] = effect.value;
                    break;
                }
                case 'add-counter': {
                    const definition = pack.counters.find(counter => counter.id === effect.id);
                    if (!definition) throw new NarrativeError('UNKNOWN_REFERENCE', `${effectPath}.id`);
                    const value = state.counters[effect.id]! + effect.amount;
                    if (!narrativeInteger(effect.amount, -Number.MAX_SAFE_INTEGER) || !narrativeInteger(value, definition.min, definition.max)) throw new NarrativeError('COUNTER_RANGE', effectPath);
                    state.counters[effect.id] = value;
                    break;
                }
                case 'journal':
                    if (!pack.journal.some(entry => entry.id === effect.entryId)) throw new NarrativeError('UNKNOWN_REFERENCE', `${effectPath}.entryId`);
                    if (!state.journal.some(entry => entry.entryId === effect.entryId)) {
                        if (state.journal.length >= pack.config.limits.maxJournalEntries) throw new NarrativeError('JOURNAL_LIMIT', '$state.journal');
                        state.journal.push({ entryId: effect.entryId, order: state.journal.length + 1 });
                    }
                    break;
                case 'message': messages.push({ textKey: effect.textKey, factId: fact.factId, effectIndex: usage.effects - 1 }); break;
                case 'emit-story':
                    if (!pack.storyEvents.some(event => event.id === effect.eventId)) throw new NarrativeError('UNKNOWN_REFERENCE', `${effectPath}.eventId`);
                    if (!narrativeInteger(state.lastFactId + 1, 1)) throw new NarrativeError('INVALID_FACT', '$fact.factId');
                    enqueue({ factId: state.lastFactId + 1, depth: fact.depth, turn: fact.turn, kind: 'story', eventId: effect.eventId });
                    break;
                case 'optional-reward': {
                    if (state.rewardReceipts.some(receipt => receipt.id === effect.receiptId) || rewardIntents.some(intent => intent.receiptId === effect.receiptId)) break;
                    // Prepared receipts also reserve capacity, although they cannot yet become persistent state.
                    if (narrativeReceiptCount(state) + rewardIntents.length >= pack.config.limits.maxReceipts) throw new NarrativeError('RECEIPT_LIMIT', '$state.rewardReceipts');
                    const intent: NarrativeRewardIntent = { capability: effect.capability, rewardId: effect.rewardId, receiptId: effect.receiptId,
                        instanceKey: narrativeRewardInstance(effect.receiptId), recipient: 'player', factId: fact.factId, effectIndex: usage.effects - 1 };
                    const result = prepareReward(intent, providers.prepareReward);
                    if (result.status === 'ready') rewardIntents.push({ ...intent, status: 'prepared' });
                    else {
                        state.rewardReceipts.push({ id: effect.receiptId, instanceKey: intent.instanceKey, result: 'skipped', reason: result.reason });
                        state.rewardReceipts.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
                    }
                    break;
                }
                default: throw new NarrativeError('UNKNOWN_REFERENCE', effectPath);
            }
        });
    }
    if (prerequisite && !condition(prerequisite.condition, root, prerequisite.path)) throw new NarrativeError('CONDITION_UNAVAILABLE', prerequisite.path);
    enqueue(root, false);
    apply(plannedEffects, root, '$effects');
    // FIFO causal events; each event uses priority descending, ID ascending trigger order.
    for (let cursor = 0; cursor < events.length; cursor++) {
        const fact = events[cursor]!;
        for (const trigger of orderedNarrativeTriggers(pack, fact)) {
            if (!narrativeTriggerEligible(state, trigger, fact)) continue;
            const triggerPath = `$pack.triggers[${pack.triggers.indexOf(trigger)}]`;
            if (!condition(trigger.condition, fact, `${triggerPath}.condition`)) continue;
            recordNarrativeTrigger(state, pack, trigger, fact);
            if (narrativeReceiptCount(state) + rewardIntents.length > pack.config.limits.maxReceipts) throw new NarrativeError('RECEIPT_LIMIT', '$state');
            triggered.push({ triggerId: trigger.id, factId: fact.factId });
            apply(trigger.effects, fact, `${triggerPath}.effects`);
        }
    }
    return finish();
}
export function planNarrativeFact(pack: NarrativePack, state: unknown, fact: unknown, options: NarrativePlanOptions = {}): NarrativePlan {
    return buildPlan(pack, state, fact, [], options);
}
/** Trusted package effects only, never effects supplied by an executable input payload. */
export function planNarrativeEffects(pack: NarrativePack, state: unknown, fact: unknown, effects: readonly Effect[], options: NarrativePlanOptions = {}): NarrativePlan {
    return buildPlan(pack, state, fact, effects, options);
}
/** A data-only cursor step for tests/tools. It neither opens a game session nor proves a world target is reachable. */
export function planNarrativeChoice(pack: NarrativePack, state: unknown, rawFact: unknown, rawSelection: NarrativeChoiceSelection, options: NarrativePlanOptions = {}): NarrativePlan {
    assertLoadedNarrativePack(pack);
    assertNarrativeJson(rawSelection, '$selection');
    const selection = narrativeRecord(rawSelection, ['dialogueId','nodeId','choiceId','transitions'], '$selection', 'INVALID_CHOICE');
    if (!narrativeInteger(selection.transitions, 0)) throw new NarrativeError('INVALID_CHOICE', '$selection.transitions');
    if ((selection.transitions as number) >= pack.config.limits.transitionsPerSession) throw new NarrativeError('TRANSITION_LIMIT', '$selection.transitions');
    const dialogue = pack.dialogues.find(dialogue => dialogue.id === selection.dialogueId);
    const node = dialogue?.nodes.find(node => node.id === selection.nodeId);
    const choice = node?.choices.find(choice => choice.id === selection.choiceId);
    if (!dialogue || !node || !choice) throw new NarrativeError('UNKNOWN_REFERENCE', '$selection');
    const fact = validateNarrativeFact(rawFact, pack);
    if (fact.factId <= validateNarrativeState(state, pack).lastFactId) throw new NarrativeError('INVALID_FACT', '$fact.factId');
    if (fact.kind !== 'dialogue-choice' || fact.dialogueId !== dialogue.id || fact.choiceId !== choice.id) throw new NarrativeError('INVALID_FACT', '$fact');
    return buildPlan(pack, state, fact, choice.effects, options, { condition: choice.condition, path: '$selection.condition' },
        { dialogueId: dialogue.id, nextNodeId: choice.next, transitions: (selection.transitions as number) + 1 });
}
/** Returns the sole supported write set (new narrative state). The caller owns any real command boundary. */
export function stagedNarrativeState(pack: NarrativePack, current: unknown, plan: NarrativePlan): NarrativeState {
    assertLoadedNarrativePack(pack);
    const registration = plans.get(plan);
    if (!registration || registration.pack !== pack) throw new NarrativeError('STALE_PLAN', '$plan');
    const state = validateNarrativeState(current, pack);
    if (state.revision !== plan.baseRevision || canonical(state) !== registration.base) throw new NarrativeError('STALE_PLAN', '$state');
    return validateNarrativeState(plan.nextState, pack);
}
export function commitNarrativePlan(pack: NarrativePack, current: unknown, plan: NarrativePlan): NarrativeState {
    const state = stagedNarrativeState(pack, current, plan);
    if (plan.rewardIntents.length) throw new NarrativeError('REWARD_COMMIT_REQUIRED', '$plan.rewardIntents');
    return state;
}
// Re-export the constructor to keep pure-tool callers independent of any module installation lifecycle.
export { initialNarrativeState };
