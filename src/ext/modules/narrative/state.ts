import { canonical, validId } from '../../json';
import { NarrativeError, type NarrativeErrorCode } from './errors';
import { assertNarrativeJson, assertLoadedNarrativePack, NARRATIVE_LIMITS } from './schema';
import type { FlagDefinition, NarrativePack, Scalar } from './types';

export type TriggerReceipt = { triggerId: string; scopeKey: string; firings: number; lastTurn: number; lastFactId: number };
/** Real reward adapters remain a later phase. Ready rewards cannot become persistent receipts. */
export type RewardReceipt = { id: string; instanceKey: string; result: 'skipped'; reason: 'absent' | 'disabled' | 'unsupported-key' };
export type NpcBinding = { npcId: string; placementId: string; instanceKey: string };
export type PlacementReceipt = NpcBinding & { depth: number; result: 'placed' | 'skipped' };
export type PendingPlacement = NpcBinding & { attemptedDepths: number[] };
export type NarrativeSession = { sessionId: number; targetEntityId: number; dialogueId: string; nodeId: string; transitions: number };
export type NarrativeState = {
    schema: 2; revision: number; nextSessionId: number;
    npcBindings: Record<string, NpcBinding>;
    placementReceipts: PlacementReceipt[]; pendingPlacements: PendingPlacement[];
    active: NarrativeSession | null;
    /** Module-local causal sequence, NOT an engine/global fact ID. */
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
    return { schema: 2, revision: 0, lastFactId: 0, nextSessionId: 1,
        npcBindings: {}, placementReceipts: [], pendingPlacements: [], active: null,
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
    const value = narrativeRecord(raw, ['schema','revision','lastFactId','nextSessionId','npcBindings','placementReceipts','pendingPlacements','active','flags','counters','triggerReceipts','rewardReceipts','journal'], '$state', 'INVALID_STATE');
    const fail = (path: string): never => { throw new NarrativeError('INVALID_STATE', path); };
    if (value.schema !== 2) fail('$state.schema');
    if (!narrativeInteger(value.revision, 0)) fail('$state.revision');
    if (!narrativeInteger(value.lastFactId, 0) || value.revision === 0 && value.lastFactId !== 0) fail('$state.lastFactId');
    if (!narrativeInteger(value.nextSessionId, 1) || (value.nextSessionId as number) - 1 > (value.revision as number)) fail('$state.nextSessionId');
    validatePlacementState(value, pack, fail);
    const flags = narrativeRecord(value.flags, pack.flags.map(flag => flag.id), '$state.flags', 'INVALID_STATE');
    for (const definition of pack.flags) if (!validFlagValue(definition, flags[definition.id])) fail(`$state.flags.${definition.id}`);
    const counters = narrativeRecord(value.counters, pack.counters.map(counter => counter.id), '$state.counters', 'INVALID_STATE');
    for (const definition of pack.counters) if (!narrativeInteger(counters[definition.id], definition.min, definition.max)) fail(`$state.counters.${definition.id}`);
    if (!Array.isArray(value.triggerReceipts)) fail('$state.triggerReceipts');
    if (!Array.isArray(value.rewardReceipts)) fail('$state.rewardReceipts');
    const triggers = value.triggerReceipts as unknown[], rewards = value.rewardReceipts as unknown[];
    if (triggers.length + rewards.length + (value.placementReceipts as unknown[]).length + (value.pendingPlacements as unknown[]).length > pack.config.limits.maxReceipts) throw new NarrativeError('RECEIPT_LIMIT', '$state');
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

/** Stable run-scoped slots cannot be reset by revisits, load, session changes or removal. */
export function narrativePlacementKey(placementId: string, ordinal: number): string { return `${placementId}.slot.${ordinal}`; }
export function narrativePlacementDefinition(pack: NarrativePack, binding: NpcBinding) {
    const npc = pack.npcs.find(npc => npc.id === binding.npcId);
    const placement = npc?.placements.find(placement => placement.id === binding.placementId);
    if (!npc || !placement) return null;
    const prefix = `${placement.id}.slot.`;
    if (!binding.instanceKey.startsWith(prefix)) return null;
    const suffix = binding.instanceKey.slice(prefix.length), ordinal = Number(suffix);
    if (!/^[1-9][0-9]*$/.test(suffix) || !narrativeInteger(ordinal, 1, placement.maxPerRun)) return null;
    return { npc, placement, ordinal };
}
export function narrativeReceiptCount(state: NarrativeState): number {
    return state.triggerReceipts.length + state.rewardReceipts.length + state.placementReceipts.length + state.pendingPlacements.length;
}
function validatePlacementState(value: Record<string, unknown>, pack: NarrativePack, fail: (path: string) => never): void {
    if (!Array.isArray(value.placementReceipts)) fail('$state.placementReceipts');
    if (!Array.isArray(value.pendingPlacements)) fail('$state.pendingPlacements');
    const receipts = value.placementReceipts as PlacementReceipt[], pending = value.pendingPlacements as PendingPlacement[];
    const keys = new Set<string>();
    const used = new Map<string, number[]>();
    const depths = new Map<string, number>();
    const bindingFields = ['npcId','placementId','instanceKey'];
    const binding = (raw: unknown, fields: string[], path: string) => {
        const item = narrativeRecord(raw, [...bindingFields, ...fields], path, 'INVALID_STATE');
        for (const field of bindingFields) if (!validId(item[field])) fail(`${path}.${field}`);
        const definition = narrativePlacementDefinition(pack, item as unknown as NpcBinding);
        if (!definition) fail(path);
        return { item, ...definition! };
    };
    for (const [name, collection] of [['placementReceipts', receipts], ['pendingPlacements', pending]] as const) {
        let previous = '';
        for (let index = 0; index < collection.length; index++) {
            const path = `$state.${name}[${index}]`;
            const { item, placement, ordinal } = binding(collection[index], name === 'placementReceipts' ? ['depth','result'] : ['attemptedDepths'], path);
            const key = item.instanceKey as string;
            if (key <= previous || keys.has(key)) fail(`${path}.instanceKey`);
            keys.add(key); previous = key;
            const ordinals = used.get(placement.id) ?? []; ordinals.push(ordinal); used.set(placement.id, ordinals);
            if (name === 'placementReceipts') {
                if (!narrativeInteger(item.depth, placement.minDepth, NARRATIVE_LIMITS.maxWorldDepth)) fail(`${path}.depth`);
                if (item.result !== 'placed' && item.result !== 'skipped') fail(`${path}.result`);
                if (item.result === 'placed' && (item.depth as number) > placement.maxDepth) fail(`${path}.depth`);
                if (item.result === 'placed') {
                    const depthKey = `${placement.id}:${item.depth}`;
                    const count = (depths.get(depthKey) ?? 0) + 1;
                    if (count > placement.maxPerDepth) fail(path);
                    depths.set(depthKey, count);
                }
            } else {
                if (placement.onNoSpace !== 'defer' || !Array.isArray(item.attemptedDepths) || !item.attemptedDepths.length) fail(`${path}.attemptedDepths`);
                let previousDepth = 0;
                for (const depth of item.attemptedDepths as unknown[]) {
                    if (!narrativeInteger(depth, placement.minDepth, placement.maxDepth) || depth <= previousDepth) fail(`${path}.attemptedDepths`);
                    previousDepth = depth;
                }
                if (previousDepth >= placement.maxDepth) fail(`${path}.attemptedDepths`);
            }
        }
    }
    for (const ordinals of used.values()) {
        ordinals.sort((a, b) => a - b);
        if (ordinals.some((ordinal, index) => ordinal !== index + 1)) fail('$state.placementReceipts');
    }
    if (!value.npcBindings || typeof value.npcBindings !== 'object' || Array.isArray(value.npcBindings)) fail('$state.npcBindings');
    const bindings = value.npcBindings as Record<string, NpcBinding>;
    if (Object.keys(bindings).length > pack.config.limits.maxActiveNpcs) fail('$state.npcBindings');
    const bound = new Set<string>();
    for (const [entityId, raw] of Object.entries(bindings)) {
        const path = `$state.npcBindings.${entityId}`;
        if (!/^[1-9][0-9]*$/.test(entityId) || !narrativeInteger(Number(entityId), 1)) fail(path);
        const { item } = binding(raw, [], path);
        if (bound.has(item.instanceKey as string) || !receipts.some(receipt => receipt.instanceKey === item.instanceKey && receipt.result === 'placed'
            && receipt.npcId === item.npcId && receipt.placementId === item.placementId)) fail(path);
        bound.add(item.instanceKey as string);
    }
    if (value.active !== null) {
        const path = '$state.active';
        const active = narrativeRecord(value.active, ['sessionId','targetEntityId','dialogueId','nodeId','transitions'], path, 'INVALID_STATE');
        if (!narrativeInteger(active.sessionId, 1) || active.sessionId !== (value.nextSessionId as number) - 1) fail(`${path}.sessionId`);
        if (!narrativeInteger(active.targetEntityId, 1) || !bindings[active.targetEntityId as number]) fail(`${path}.targetEntityId`);
        const npc = pack.npcs.find(npc => npc.id === bindings[active.targetEntityId as number]!.npcId);
        if (!npc || npc.dialogueId !== active.dialogueId) fail(`${path}.dialogueId`);
        const dialogue = pack.dialogues.find(dialogue => dialogue.id === active.dialogueId);
        if (!dialogue?.nodes.some(node => node.id === active.nodeId)) fail(`${path}.nodeId`);
        if (!narrativeInteger(active.transitions, 0, pack.config.limits.transitionsPerSession)) fail(`${path}.transitions`);
    }
}
