import { canonical, validId } from '../../json';
import { NarrativeError, type NarrativeErrorCode } from './errors';
import { assertNarrativeJson, assertLoadedNarrativePack, NARRATIVE_LIMITS } from './schema';
import type { FlagDefinition, NarrativePack, Scalar } from './types';

export type TriggerReceipt = { triggerId: string; scopeKey: string; firings: number; lastTurn: number; lastFactId: number };
/** 2a1 never claims external rewards were applied. Ready rewards remain outside serializable state. */
export type RewardReceipt = { id: string; instanceKey: string; result: 'skipped'; reason: 'absent' | 'disabled' | 'unsupported-key' };
export type NarrativeState = {
    schema: 1; revision: number;
    /** Local planner sequence only, NOT an engine/global fact ID. No engine hooks feed this in 2a1. */
    lastFactId: number;
    flags: Record<string, Scalar>; counters: Record<string, number>;
    triggerReceipts: TriggerReceipt[]; rewardReceipts: RewardReceipt[];
    journal: { entryId: string; order: number }[];
};
export function narrativeRecord(value: unknown, keys: readonly string[], path: string, code: NarrativeErrorCode): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NarrativeError(code, path);
    const record = value as Record<string, unknown>;
    if (Object.keys(record).some(key => !keys.includes(key)) || keys.some(key => !Object.prototype.hasOwnProperty.call(record, key))) throw new NarrativeError(code, path);
    return record;
}
export function narrativeInteger(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
    return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}
export function validFlagValue(definition: FlagDefinition, value: unknown): value is Scalar {
    if (definition.type === 'boolean') return typeof value === 'boolean';
    if (definition.type === 'integer') return narrativeInteger(value, definition.min!, definition.max!);
    return typeof value === 'string' && !!definition.values?.includes(value);
}
export function narrativeRewardInstance(receiptId: string): string { return `narrative.${receiptId}.run`; }
export function initialNarrativeState(pack: NarrativePack): NarrativeState {
    assertLoadedNarrativePack(pack);
    return { schema: 1, revision: 0, lastFactId: 0,
        flags: Object.fromEntries(pack.flags.map(flag => [flag.id, flag.initial])),
        counters: Object.fromEntries(pack.counters.map(counter => [counter.id, counter.initial])),
        triggerReceipts: [], rewardReceipts: [], journal: [] };
}
export function narrativeRewardEffects(pack: NarrativePack) {
    return [...pack.triggers.flatMap(trigger => trigger.effects), ...pack.dialogues.flatMap(dialogue => dialogue.nodes.flatMap(node => node.choices.flatMap(choice => choice.effects)))]
        .filter(effect => effect.kind === 'optional-reward');
}
/** Strict load validation returns a detached copy and never repairs, executes, or mutates the supplied state. */
export function validateNarrativeState(raw: unknown, pack: NarrativePack): NarrativeState {
    assertLoadedNarrativePack(pack);
    assertNarrativeJson(raw, '$state');
    const value = narrativeRecord(raw, ['schema','revision','lastFactId','flags','counters','triggerReceipts','rewardReceipts','journal'], '$state', 'INVALID_STATE');
    const fail = (path: string): never => { throw new NarrativeError('INVALID_STATE', path); };
    if (value.schema !== 1) fail('$state.schema');
    if (!narrativeInteger(value.revision, 0)) fail('$state.revision');
    if (!narrativeInteger(value.lastFactId, 0) || (value.lastFactId === 0) !== (value.revision === 0)
        || (value.revision as number) > (value.lastFactId as number)) fail('$state.lastFactId');
    const flags = narrativeRecord(value.flags, pack.flags.map(flag => flag.id), '$state.flags', 'INVALID_STATE');
    for (const definition of pack.flags) if (!validFlagValue(definition, flags[definition.id])) fail(`$state.flags.${definition.id}`);
    const counters = narrativeRecord(value.counters, pack.counters.map(counter => counter.id), '$state.counters', 'INVALID_STATE');
    for (const definition of pack.counters) if (!narrativeInteger(counters[definition.id], definition.min, definition.max)) fail(`$state.counters.${definition.id}`);
    if (!Array.isArray(value.triggerReceipts)) fail('$state.triggerReceipts');
    if (!Array.isArray(value.rewardReceipts)) fail('$state.rewardReceipts');
    const triggers = value.triggerReceipts as unknown[], rewards = value.rewardReceipts as unknown[];
    if (triggers.length + rewards.length > pack.config.limits.maxReceipts) throw new NarrativeError('RECEIPT_LIMIT', '$state');
    let previous = '';
    for (let index = 0; index < triggers.length; index++) {
        const path = `$state.triggerReceipts[${index}]`;
        const receipt = narrativeRecord(triggers[index], ['triggerId','scopeKey','firings','lastTurn','lastFactId'], path, 'INVALID_STATE');
        const trigger = pack.triggers.find(trigger => trigger.id === receipt.triggerId);
        if (!trigger) fail(`${path}.triggerId`);
        const repeat = trigger!.repeat;
        if (typeof receipt.scopeKey !== 'string') fail(`${path}.scopeKey`);
        if (repeat.kind === 'once-per-depth') {
            const depth = /^depth\.([1-9][0-9]*)$/.exec(receipt.scopeKey as string);
            if (!depth || !narrativeInteger(Number(depth[1]), 1, NARRATIVE_LIMITS.maxWorldDepth)) fail(`${path}.scopeKey`);
        } else if (receipt.scopeKey !== 'run') fail(`${path}.scopeKey`);
        const key = `${receipt.triggerId}:${receipt.scopeKey}`;
        if (key <= previous) fail(path);
        previous = key;
        if (!narrativeInteger(receipt.firings, 1, repeat.kind === 'bounded' ? repeat.maxFirings : 1)) fail(`${path}.firings`);
        if (!narrativeInteger(receipt.lastTurn, 0)) fail(`${path}.lastTurn`);
        if (!narrativeInteger(receipt.lastFactId, 1, value.lastFactId as number)) fail(`${path}.lastFactId`);
        if ((receipt.firings as number) > (receipt.lastFactId as number)) fail(`${path}.firings`);
    }
    previous = '';
    const rewardDefinitions = narrativeRewardEffects(pack);
    for (let index = 0; index < rewards.length; index++) {
        const path = `$state.rewardReceipts[${index}]`;
        const receipt = narrativeRecord(rewards[index], ['id','instanceKey','result','reason'], path, 'INVALID_STATE');
        if (!validId(receipt.id) || receipt.id <= previous || !rewardDefinitions.some(effect => effect.receiptId === receipt.id)) fail(`${path}.id`);
        previous = receipt.id as string;
        if (receipt.instanceKey !== narrativeRewardInstance(receipt.id as string)) fail(`${path}.instanceKey`);
        if (receipt.result !== 'skipped') fail(`${path}.result`);
        if (!['absent','disabled','unsupported-key'].includes(receipt.reason as string)) fail(`${path}.reason`);
    }
    if (!Array.isArray(value.journal)) fail('$state.journal');
    const journal = value.journal as unknown[];
    if (journal.length > pack.config.limits.maxJournalEntries) throw new NarrativeError('JOURNAL_LIMIT', '$state.journal');
    const seen = new Set<string>();
    for (let index = 0; index < journal.length; index++) {
        const path = `$state.journal[${index}]`;
        const entry = narrativeRecord(journal[index], ['entryId','order'], path, 'INVALID_STATE');
        if (!validId(entry.entryId) || seen.has(entry.entryId) || !pack.journal.some(definition => definition.id === entry.entryId)) fail(`${path}.entryId`);
        seen.add(entry.entryId as string);
        if (entry.order !== index + 1) fail(`${path}.order`);
    }
    if (value.revision === 0 && canonical(raw) !== canonical(initialNarrativeState(pack))) fail('$state');
    // JSON state is a tree: rebuild aliases rather than preserving shared mutable arrays from JS input.
    return JSON.parse(JSON.stringify(raw)) as NarrativeState;
}
export function isNarrativeState(raw: unknown, pack: NarrativePack): raw is NarrativeState {
    try { validateNarrativeState(raw, pack); return true; } catch { return false; }
}
