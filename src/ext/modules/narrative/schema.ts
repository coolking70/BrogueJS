import { validId } from '../../json';
import { NarrativeError, type NarrativeErrorCode } from './errors';
import type { Condition, FlagDefinition, NarrativeLimits, NarrativePack, PortraitManifest, TriggerEvent } from './types';

/** Implementation ceilings, independent of a content author's smaller per-pack budgets.
 * The shared JSON bound must cover state/plan as well as content: at most 65,536
 * shared receipts (a pending slot has at most 45 visited JSON values, including
 * 40 attempted depths), 2 * 4,096 flags/counters, 4,096 journal entries, 256
 * bindings and bounded plan traces total fewer than 3,100,000 values. The
 * 4,000,000-value ceiling leaves bounded headroom for all legal state/plan trees.
 */
export const NARRATIVE_LIMITS = Object.freeze({
    conditionDepth: 16, conditionOpsPerCommand: 1024, effectsPerCommand: 256,
    eventsPerCommand: 128, transitionsPerSession: 1024, maxActiveNpcs: 256,
    maxJournalEntries: 4096, maxReceipts: 65536,
    maxWorldDepth: 40, maxDefinitions: 4096, maxJsonDepth: 64, maxJsonValues: 4_000_000,
    maxStringLength: 16384, maxPortraitDimension: 8192, maxDistance: 256, maxInteractionDistance: 16,
});
const fail = (code: NarrativeErrorCode, path: string): never => { throw new NarrativeError(code, path); };
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);
// Ephemeral validation provenance only. No simulation state or persisted facts are hidden here.
const loadedPacks = new WeakSet<object>();
export function assertLoadedNarrativePack(pack: NarrativePack): void {
    if (!pack || typeof pack !== 'object' || !loadedPacks.has(pack)) fail('INVALID_STATE', '$pack');
}

/** Reject accessors without invoking them; JSON round-tripping is not a validator. */
export function assertNarrativeJson(value: unknown, path = '$'): void {
    const visiting = new Set<object>();
    let count = 0;
    const visit = (part: unknown, at: string, depth: number): void => {
        if (++count > NARRATIVE_LIMITS.maxJsonValues || depth > NARRATIVE_LIMITS.maxJsonDepth) fail('INVALID_JSON', at);
        if (part === null || typeof part === 'boolean') return;
        if (typeof part === 'number') {
            if (!Number.isSafeInteger(part)) fail('INVALID_INTEGER', at);
            return;
        }
        if (typeof part === 'string') {
            if (part.length > NARRATIVE_LIMITS.maxStringLength || /[<>]|javascript\s*:|\beval\s*\(|\bnew\s+Function\s*\(/i.test(part)) fail('INVALID_TEXT', at);
            return;
        }
        if (typeof part !== 'object' || visiting.has(part)) return fail('INVALID_JSON', at);
        const prototype = Object.getPrototypeOf(part);
        if (Array.isArray(part) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('INVALID_JSON', at);
        visiting.add(part);
        const keys = Reflect.ownKeys(part);
        if (Array.isArray(part) && (part.length > NARRATIVE_LIMITS.maxJsonValues || keys.length !== part.length + 1)) fail('INVALID_JSON', at);
        for (const key of keys) {
            if (typeof key !== 'string' || forbiddenKeys.has(key)) return fail('INVALID_JSON', at);
            if (Array.isArray(part) && key === 'length') continue;
            if (Array.isArray(part) && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= part.length)) fail('INVALID_JSON', `${at}.${key}`);
            const descriptor = Object.getOwnPropertyDescriptor(part, key)!;
            if (!descriptor.enumerable || !('value' in descriptor)) fail('INVALID_JSON', `${at}.${key}`);
            visit(descriptor.value, Array.isArray(part) ? `${at}[${key}]` : `${at}.${key}`, depth + 1);
        }
        visiting.delete(part);
    };
    visit(value, path, 0);
}
function freezeTree<T>(value: T): T {
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value)) freezeTree(child);
        Object.freeze(value);
    }
    return value;
}
/** Freeze a caller-owned validated JSON tree. Loaders clone before calling this helper. */
export function freezeNarrative<T>(value: T): T { assertNarrativeJson(value); return freezeTree(value); }
function object(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('INVALID_TYPE', path);
    const result = value as Record<string, unknown>;
    for (const key of Object.keys(result)) if (!keys.includes(key)) fail('UNKNOWN_KEY', `${path}.${key}`);
    for (const key of keys) if (!Object.prototype.hasOwnProperty.call(result, key)) fail('INVALID_TYPE', `${path}.${key}`);
    return result;
}
function list(value: unknown, path: string, min = 0, max: number = NARRATIVE_LIMITS.maxDefinitions): unknown[] {
    if (!Array.isArray(value)) return fail('INVALID_TYPE', path);
    if (value.length < min || value.length > max) fail('INVALID_RANGE', path);
    return value;
}
function integer(value: unknown, path: string, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER): number {
    if (!Number.isSafeInteger(value)) return fail('INVALID_INTEGER', path);
    if ((value as number) < min || (value as number) > max) fail('INVALID_RANGE', path);
    return value as number;
}
function enumeration(value: unknown, values: readonly unknown[], path: string): void {
    if (!values.includes(value)) fail('INVALID_TYPE', path);
}
function id(value: unknown, path: string): string {
    if (!validId(value) || value.length > 128 || forbiddenKeys.has(value)) return fail('INVALID_ID', path);
    return value;
}
function glyph(value: unknown, path: string): void {
    // One printable Unicode scalar, excluding combining/joiner/variation sequences.
    if (typeof value !== 'string' || Array.from(value).length !== 1 || /[\p{C}\p{M}\p{Z}]/u.test(value)) fail('INVALID_TEXT', path);
}
function nullableId(value: unknown, path: string): void { if (value !== null) id(value, path); }
function scalar(value: unknown, path: string): void {
    if (typeof value !== 'string' && typeof value !== 'boolean' && !Number.isSafeInteger(value)) fail('INVALID_TYPE', path);
}
function bounds(min: unknown, max: unknown, path: string): void {
    integer(min, `${path}.min`); integer(max, `${path}.max`);
    if ((min as number) > (max as number)) fail('INVALID_RANGE', path);
}
function checkFlagValue(value: unknown, flag: FlagDefinition, path: string): void {
    if (flag.type === 'boolean') { if (typeof value !== 'boolean') fail('FLAG_VALUE', path); }
    else if (flag.type === 'integer') {
        if (!Number.isSafeInteger(value) || (value as number) < flag.min! || (value as number) > flag.max!) fail('FLAG_VALUE', path);
    } else if (typeof value !== 'string' || !flag.values!.includes(value)) fail('FLAG_VALUE', path);
}
function localeChecker(raw: unknown): (value: unknown, path: string) => void {
    assertNarrativeJson(raw, '$locales');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('INVALID_TYPE', '$locales');
    const locales = raw as Record<string, unknown>;
    const validTextKey = (key: string): boolean => key.length <= 256 && /^ext\.narrative\.[a-zA-Z0-9_.-]+$/.test(key);
    for (const [key, value] of Object.entries(locales)) {
        if (!validTextKey(key) || typeof value !== 'string' || !value.trim()) fail('INVALID_TEXT', `$locales.${key}`);
    }
    return (value, path) => {
        if (typeof value !== 'string' || !validTextKey(value) || !Object.prototype.hasOwnProperty.call(locales, value)) fail('INVALID_TEXT', path);
    };
}
function portraits(raw: unknown, text: (value: unknown, path: string) => void): PortraitManifest {
    assertNarrativeJson(raw, '$portraits');
    const root = object(raw, ['schema', 'displayVersion', 'portraits'], '$portraits');
    if (root.schema !== 1) fail('INVALID_VERSION', '$portraits.schema');
    if (typeof root.displayVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(root.displayVersion)) fail('INVALID_VERSION', '$portraits.displayVersion');
    const ids = new Set<string>();
    list(root.portraits, '$portraits.portraits').forEach((entry, i) => {
        const path = `$portraits.portraits[${i}]`;
        const portrait = object(entry, ['id', 'asset', 'width', 'height', 'fit', 'anchor', 'altKey', 'fallbackGlyph'], path);
        const key = id(portrait.id, `${path}.id`);
        if (ids.has(key)) fail('DUPLICATE_ID', `${path}.id`);
        ids.add(key);
        if (portrait.asset !== null && (typeof portrait.asset !== 'string'
            || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(png|webp)$/.test(portrait.asset))) fail('INVALID_PORTRAIT', `${path}.asset`);
        integer(portrait.width, `${path}.width`, 1, NARRATIVE_LIMITS.maxPortraitDimension);
        integer(portrait.height, `${path}.height`, 1, NARRATIVE_LIMITS.maxPortraitDimension);
        enumeration(portrait.fit, ['contain'], `${path}.fit`);
        enumeration(portrait.anchor, ['bottom-center'], `${path}.anchor`);
        text(portrait.altKey, `${path}.altKey`); glyph(portrait.fallbackGlyph, `${path}.fallbackGlyph`);
    });
    return raw as PortraitManifest;
}
export function loadPortraitManifest(raw: unknown, locales: unknown): PortraitManifest {
    const result = portraits(raw, localeChecker(locales));
    return freezeTree(structuredClone(result));
}

/** Throws a path-specific NarrativeError. Returns an isolated, deeply frozen typed package. */
export function loadNarrativePack(raw: unknown, portraitData: unknown, locales: unknown): NarrativePack {
    assertNarrativeJson(raw);
    const text = localeChecker(locales);
    const portraitManifest = portraits(portraitData, text);
    const portraitIds = new Set(portraitManifest.portraits.map(p => p.id));
    const portraitRef = (value: unknown, path: string): void => {
        nullableId(value, path); if (value !== null && !portraitIds.has(value as string)) fail('UNKNOWN_REFERENCE', path);
    };
    const root = object(raw, ['schema', 'moduleId', 'moduleVersion', 'rulesVersion', 'stateVersion', 'inputVersion',
        'config', 'flags', 'counters', 'npcs', 'dialogues', 'journal', 'storyEvents', 'triggers'], '$');
    if (root.schema !== 1) fail('INVALID_VERSION', '$.schema');
    if (root.stateVersion !== 3) fail('INVALID_VERSION', '$.stateVersion');
    if (root.inputVersion !== 2) fail('INVALID_VERSION', '$.inputVersion');
    if (root.moduleId !== 'narrative') fail('INVALID_ID', '$.moduleId');
    for (const key of ['moduleVersion', 'rulesVersion']) if (root[key] !== '1.3.0') fail('INVALID_VERSION', `$.${key}`);
    const config = object(root.config, ['timePolicy', 'closePolicy', 'limits'], '$.config');
    enumeration(config.timePolicy, ['free-frozen'], '$.config.timePolicy');
    enumeration(config.closePolicy, ['close-session'], '$.config.closePolicy');
    const limitKeys = ['conditionDepth', 'conditionOpsPerCommand', 'effectsPerCommand', 'eventsPerCommand',
        'transitionsPerSession', 'maxActiveNpcs', 'maxJournalEntries', 'maxReceipts'] as const;
    const limitValues = object(config.limits, limitKeys, '$.config.limits');
    for (const key of limitKeys) integer(limitValues[key], `$.config.limits.${key}`, 1, NARRATIVE_LIMITS[key]);
    const limits = limitValues as unknown as NarrativeLimits;
    const globalIds = new Set<string>();
    const define = (value: unknown, path: string): string => {
        const key = id(value, path); if (globalIds.has(key)) fail('DUPLICATE_ID', path); globalIds.add(key); return key;
    };
    const flags = new Map<string, FlagDefinition>();
    const counters = new Set<string>();
    const npcs = new Set<string>();
    const dialogues = new Map<string, Set<string>>();
    const journal = new Set<string>();
    const events = new Set<string>();
    const reference = (value: unknown, set: { has(value: string): boolean }, path: string): void => {
        const key = id(value, path); if (!set.has(key)) fail('UNKNOWN_REFERENCE', path);
    };
    const arrays = new Map<string, unknown[]>();
    for (const key of ['flags', 'counters', 'npcs', 'dialogues', 'journal', 'storyEvents', 'triggers']) arrays.set(key, list(root[key], `$.${key}`));
    arrays.get('flags')!.forEach((entry, i) => {
        const path = `$.flags[${i}]`;
        const flag = object(entry, ['id', 'type', 'initial', 'min', 'max', 'values'], path);
        const key = define(flag.id, `${path}.id`);
        enumeration(flag.type, ['boolean', 'integer', 'string'], `${path}.type`);
        if (flag.type === 'integer') {
            bounds(flag.min, flag.max, path); enumeration(flag.values, [null], `${path}.values`);
        } else {
            enumeration(flag.min, [null], `${path}.min`); enumeration(flag.max, [null], `${path}.max`);
            if (flag.type === 'boolean') enumeration(flag.values, [null], `${path}.values`);
            else {
                const values = list(flag.values, `${path}.values`, 1);
                for (const value of values) if (typeof value !== 'string' || !value.trim()) fail('INVALID_TYPE', `${path}.values`);
                if (new Set(values).size !== values.length) fail('DUPLICATE_ID', `${path}.values`);
            }
        }
        checkFlagValue(flag.initial, flag as unknown as FlagDefinition, `${path}.initial`);
        flags.set(key, flag as unknown as FlagDefinition);
    });
    arrays.get('counters')!.forEach((entry, i) => {
        const path = `$.counters[${i}]`;
        const counter = object(entry, ['id', 'initial', 'min', 'max'], path);
        counters.add(define(counter.id, `${path}.id`)); bounds(counter.min, counter.max, path);
        integer(counter.initial, `${path}.initial`, counter.min as number, counter.max as number);
    });
    arrays.get('journal')!.forEach((entry, i) => {
        const path = `$.journal[${i}]`; const item = object(entry, ['id', 'titleKey', 'textKey'], path);
        journal.add(define(item.id, `${path}.id`)); text(item.titleKey, `${path}.titleKey`); text(item.textKey, `${path}.textKey`);
    });
    if (journal.size > limits.maxJournalEntries) fail('JOURNAL_LIMIT', '$.journal');
    arrays.get('storyEvents')!.forEach((entry, i) => {
        const path = `$.storyEvents[${i}]`; const event = object(entry, ['id'], path); events.add(define(event.id, `${path}.id`));
    });
    // Register all NPC/dialogue/choice identities before validating their cross references.
    arrays.get('npcs')!.forEach((entry, i) => {
        const path = `$.npcs[${i}]`;
        const npc = object(entry, ['id', 'nameKey', 'descriptionKey', 'glyph', 'color', 'portraitId', 'dialogueId', 'presence', 'interactionDistance', 'placements'], path);
        npcs.add(define(npc.id, `${path}.id`));
    });
    arrays.get('dialogues')!.forEach((entry, i) => {
        const path = `$.dialogues[${i}]`; const dialogue = object(entry, ['id', 'entry', 'nodes'], path);
        const key = define(dialogue.id, `${path}.id`); const choices = new Set<string>(); const nodes = new Set<string>();
        list(dialogue.nodes, `${path}.nodes`, 1).forEach((entryNode, ni) => {
            const nodePath = `${path}.nodes[${ni}]`; const node = object(entryNode, ['id', 'textKey', 'portraitId', 'choices'], nodePath);
            const nodeId = id(node.id, `${nodePath}.id`); if (nodes.has(nodeId)) fail('DUPLICATE_ID', `${nodePath}.id`); nodes.add(nodeId);
            list(node.choices, `${nodePath}.choices`, 1).forEach((entryChoice, ci) => {
                const choicePath = `${nodePath}.choices[${ci}]`;
                const choice = object(entryChoice, ['id', 'textKey', 'condition', 'unavailable', 'unavailableKey', 'effects', 'next'], choicePath);
                const choiceId = id(choice.id, `${choicePath}.id`); if (choices.has(choiceId)) fail('DUPLICATE_ID', `${choicePath}.id`); choices.add(choiceId);
            });
        });
        dialogues.set(key, choices);
    });
    const condition = (value: unknown, path: string, context: TriggerEvent, depth = 1, budget = { count: 0 }): void => {
        if (depth > limits.conditionDepth) fail('CONDITION_DEPTH', path);
        if (++budget.count > limits.conditionOpsPerCommand) fail('CONDITION_LIMIT', path);
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_CONDITION', path);
        const op = (value as Record<string, unknown>).op;
        const shapes: Record<string, string[]> = { true: ['op'], all: ['op', 'args'], any: ['op', 'args'], not: ['op', 'arg'],
            flag: ['op', 'id', 'equals'], counter: ['op', 'id', 'compare', 'value'], depth: ['op', 'min', 'max'],
            'event-field': ['op', 'field', 'equals'], 'optional-player': ['op', 'capability', 'field', 'compare', 'value', 'onUnavailable'] };
        if (typeof op !== 'string' || !Object.prototype.hasOwnProperty.call(shapes, op)) fail('INVALID_CONDITION', `${path}.op`);
        const c = object(value, shapes[op as string]!, path);
        switch (op) {
            case 'true': break;
            case 'all': case 'any': list(c.args, `${path}.args`, 1, NARRATIVE_LIMITS.conditionOpsPerCommand).forEach((arg, i) => condition(arg, `${path}.args[${i}]`, context, depth + 1, budget)); break;
            case 'not': condition(c.arg, `${path}.arg`, context, depth + 1, budget); break;
            case 'flag': reference(c.id, flags, `${path}.id`); checkFlagValue(c.equals, flags.get(c.id as string)!, `${path}.equals`); break;
            case 'counter': reference(c.id, counters, `${path}.id`); enumeration(c.compare, ['eq', 'ne', 'lt', 'lte', 'gt', 'gte'], `${path}.compare`); integer(c.value, `${path}.value`); break;
            case 'depth': integer(c.min, `${path}.min`, 1, NARRATIVE_LIMITS.maxWorldDepth); integer(c.max, `${path}.max`, c.min as number, NARRATIVE_LIMITS.maxWorldDepth); break;
            case 'event-field': {
                const field = context.kind === 'entered-level' ? 'firstVisit' : context.kind === 'npc-interacted' ? 'npcId' : context.kind === 'dialogue-choice' ? 'choiceId' : null;
                if (c.field !== field || field === null) fail('INVALID_EVENT_FIELD', `${path}.field`);
                if (field === 'firstVisit') enumeration(c.equals, [true, false], `${path}.equals`);
                else if (field === 'npcId') reference(c.equals, npcs, `${path}.equals`);
                else reference(c.equals, dialogues.get((context as Extract<TriggerEvent, { kind: 'dialogue-choice' }>).dialogueId)!, `${path}.equals`);
                break;
            }
            case 'optional-player':
                enumeration(c.capability, ['growth.public-character.v1'], `${path}.capability`);
                enumeration(c.field, ['level', 'professionId', 'lineageId', 'faithId'], `${path}.field`);
                enumeration(c.onUnavailable, [true, false], `${path}.onUnavailable`);
                if (c.field === 'level') { enumeration(c.compare, ['eq', 'gte'], `${path}.compare`); integer(c.value, `${path}.value`, 1); }
                else { enumeration(c.compare, ['eq'], `${path}.compare`); id(c.value, `${path}.value`); }
                break;
        }
    };
    const receiptIds = new Set<string>();
    const effects = (value: unknown, path: string): void => {
        const effectList = list(value, path, 0, NARRATIVE_LIMITS.effectsPerCommand);
        if (effectList.length > limits.effectsPerCommand) fail('EFFECT_LIMIT', path);
        let emitted = 0;
        effectList.forEach((entry, i) => {
            const ep = `${path}[${i}]`;
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail('INVALID_TYPE', ep);
            const kind = (entry as Record<string, unknown>).kind;
            const shapes: Record<string, string[]> = { 'set-flag': ['kind', 'id', 'value'], 'add-counter': ['kind', 'id', 'amount'],
                journal: ['kind', 'entryId'], message: ['kind', 'textKey'], 'emit-story': ['kind', 'eventId'],
                'optional-reward': ['kind', 'capability', 'rewardId', 'receiptId', 'onUnavailable'] };
            if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(shapes, kind)) fail('INVALID_TYPE', `${ep}.kind`);
            const effect = object(entry, shapes[kind as string]!, ep);
            switch (kind) {
                case 'set-flag': reference(effect.id, flags, `${ep}.id`); scalar(effect.value, `${ep}.value`); checkFlagValue(effect.value, flags.get(effect.id as string)!, `${ep}.value`); break;
                case 'add-counter': reference(effect.id, counters, `${ep}.id`); integer(effect.amount, `${ep}.amount`); break;
                case 'journal': reference(effect.entryId, journal, `${ep}.entryId`); break;
                case 'message': text(effect.textKey, `${ep}.textKey`); break;
                case 'emit-story': reference(effect.eventId, events, `${ep}.eventId`); if (++emitted > limits.eventsPerCommand) fail('EVENT_LIMIT', ep); break;
                case 'optional-reward': {
                    enumeration(effect.capability, ['growth.story-reward.v1'], `${ep}.capability`);
                    id(effect.rewardId, `${ep}.rewardId`); const receiptId = id(effect.receiptId, `${ep}.receiptId`);
                    if (receiptIds.has(receiptId)) fail('DUPLICATE_RECEIPT', `${ep}.receiptId`); receiptIds.add(receiptId);
                    enumeration(effect.onUnavailable, ['skip'], `${ep}.onUnavailable`); break;
                }
            }
        });
    };
    arrays.get('npcs')!.forEach((entry, i) => {
        const npc = entry as Record<string, unknown>; const path = `$.npcs[${i}]`;
        text(npc.nameKey, `${path}.nameKey`); text(npc.descriptionKey, `${path}.descriptionKey`); glyph(npc.glyph, `${path}.glyph`);
        if (typeof npc.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(npc.color)) fail('INVALID_TYPE', `${path}.color`);
        portraitRef(npc.portraitId, `${path}.portraitId`); reference(npc.dialogueId, dialogues, `${path}.dialogueId`);
        enumeration(npc.presence, ['stationary-interactable'], `${path}.presence`);
        integer(npc.interactionDistance, `${path}.interactionDistance`, 0, NARRATIVE_LIMITS.maxInteractionDistance);
        list(npc.placements, `${path}.placements`).forEach((placement, pi) => {
            const pp = `${path}.placements[${pi}]`;
            const p = object(placement, ['id', 'minDepth', 'maxDepth', 'maxPerRun', 'maxPerDepth', 'minStairDistance', 'maxEntranceDistance', 'onNoSpace'], pp);
            define(p.id, `${pp}.id`);
            integer(p.minDepth, `${pp}.minDepth`, 1, NARRATIVE_LIMITS.maxWorldDepth); integer(p.maxDepth, `${pp}.maxDepth`, p.minDepth as number, NARRATIVE_LIMITS.maxWorldDepth);
            integer(p.maxPerRun, `${pp}.maxPerRun`, 1, limits.maxActiveNpcs); integer(p.maxPerDepth, `${pp}.maxPerDepth`, 1, p.maxPerRun as number);
            integer(p.minStairDistance, `${pp}.minStairDistance`, 0, NARRATIVE_LIMITS.maxDistance);
            integer(p.maxEntranceDistance, `${pp}.maxEntranceDistance`, p.minStairDistance as number, NARRATIVE_LIMITS.maxDistance);
            enumeration(p.onNoSpace, ['skip', 'defer'], `${pp}.onNoSpace`);
        });
    });
    arrays.get('dialogues')!.forEach((entry, i) => {
        const dialogue = entry as Record<string, unknown>; const path = `$.dialogues[${i}]`;
        const nodes = dialogue.nodes as Record<string, unknown>[];
        const nodeIds = new Set(nodes.map(n => n.id as string)); reference(dialogue.entry, nodeIds, `${path}.entry`);
        nodes.forEach((node, ni) => {
            const np = `${path}.nodes[${ni}]`; text(node.textKey, `${np}.textKey`); portraitRef(node.portraitId, `${np}.portraitId`);
            // A complete public node is one bounded preview, including hidden choices.
            // Count worst-case AST visits rather than relying on dynamic short-circuiting.
            const previewBudget = { count: 0 };
            (node.choices as Record<string, unknown>[]).forEach((choice, ci) => {
                const cp = `${np}.choices[${ci}]`; text(choice.textKey, `${cp}.textKey`);
                condition(choice.condition, `${cp}.condition`, { kind: 'dialogue-choice', dialogueId: dialogue.id as string, choiceId: choice.id as string }, 1, previewBudget);
                enumeration(choice.unavailable, ['hide', 'disable'], `${cp}.unavailable`);
                if (choice.unavailableKey !== null) text(choice.unavailableKey, `${cp}.unavailableKey`);
                effects(choice.effects, `${cp}.effects`); if (choice.next !== null) reference(choice.next, nodeIds, `${cp}.next`);
            });
        });
        const reachable = new Set<string>(); const queue = [dialogue.entry as string];
        const nodeMap = new Map(nodes.map(node => [node.id as string, node]));
        while (queue.length) {
            const current = queue.pop()!; if (reachable.has(current)) continue; reachable.add(current);
            for (const choice of nodeMap.get(current)!.choices as { next: string | null }[]) if (choice.next !== null) queue.push(choice.next);
        }
        nodes.forEach((node, ni) => { if (!reachable.has(node.id as string)) fail('UNREACHABLE_NODE', `${path}.nodes[${ni}].id`); });
        // A safe exit may span nodes, but each edge must be provably unconditional and effect-free.
        const escapable = new Set<string>();
        let changed = true;
        while (changed) {
            changed = false;
            for (const node of nodes) {
                if (escapable.has(node.id as string)) continue;
                const exits = (node.choices as { condition: Condition; effects: unknown[]; next: string | null }[])
                    .some(choice => constantCondition(choice.condition) === true && choice.effects.length === 0
                        && (choice.next === null || escapable.has(choice.next)));
                if (exits) { escapable.add(node.id as string); changed = true; }
            }
        }
        nodes.forEach((node, ni) => { if (!escapable.has(node.id as string)) fail('MISSING_EXIT', `${path}.nodes[${ni}].choices`); });
    });
    let estimatedReceipts = 0;
    arrays.get('triggers')!.forEach((entry, i) => {
        const path = `$.triggers[${i}]`; const trigger = object(entry, ['id', 'on', 'priority', 'condition', 'repeat', 'effects'], path);
        define(trigger.id, `${path}.id`); integer(trigger.priority, `${path}.priority`, -1000000, 1000000);
        if (!trigger.on || typeof trigger.on !== 'object' || Array.isArray(trigger.on)) fail('INVALID_TRIGGER', `${path}.on`);
        const onKind = (trigger.on as Record<string, unknown>).kind;
        const shape = onKind === 'entered-level' ? ['kind'] : onKind === 'npc-interacted' ? ['kind', 'npcId']
            : onKind === 'dialogue-choice' ? ['kind', 'dialogueId', 'choiceId'] : onKind === 'story' ? ['kind', 'eventId'] : null;
        if (!shape) fail('INVALID_TRIGGER', `${path}.on.kind`);
        const on = object(trigger.on, shape!, `${path}.on`);
        if (onKind === 'npc-interacted') reference(on.npcId, npcs, `${path}.on.npcId`);
        if (onKind === 'dialogue-choice') { reference(on.dialogueId, dialogues, `${path}.on.dialogueId`); reference(on.choiceId, dialogues.get(on.dialogueId as string)!, `${path}.on.choiceId`); }
        if (onKind === 'story') reference(on.eventId, events, `${path}.on.eventId`);
        condition(trigger.condition, `${path}.condition`, trigger.on as TriggerEvent);
        if (!trigger.repeat || typeof trigger.repeat !== 'object' || Array.isArray(trigger.repeat)) fail('INVALID_TRIGGER', `${path}.repeat`);
        const kind = (trigger.repeat as Record<string, unknown>).kind;
        enumeration(kind, ['once-per-run', 'once-per-depth', 'bounded'], `${path}.repeat.kind`);
        const repeat = object(trigger.repeat, kind === 'bounded' ? ['kind', 'maxFirings', 'cooldownTurns'] : ['kind'], `${path}.repeat`);
        if (kind === 'bounded') { integer(repeat.maxFirings, `${path}.repeat.maxFirings`, 1, NARRATIVE_LIMITS.maxReceipts); integer(repeat.cooldownTurns, `${path}.repeat.cooldownTurns`, 0); }
        estimatedReceipts += kind === 'once-per-depth' ? NARRATIVE_LIMITS.maxWorldDepth : 1;
        effects(trigger.effects, `${path}.effects`);
    });
    estimatedReceipts += receiptIds.size + (raw as NarrativePack).npcs.reduce((total, npc) => total + npc.placements.reduce((count, placement) => count + placement.maxPerRun, 0), 0);
    if (estimatedReceipts > limits.maxReceipts) fail('RECEIPT_LIMIT', '$.config.limits.maxReceipts');
    const pack = raw as NarrativePack;
    // Condition-independent graph analysis: false guards/repeat limits never excuse an automatic cycle.
    const edges = new Map<string, string[]>(pack.storyEvents.map(event => [event.id, []]));
    for (const trigger of pack.triggers) if (trigger.on.kind === 'story') {
        for (const effect of trigger.effects) if (effect.kind === 'emit-story') edges.get(trigger.on.eventId)!.push(effect.eventId);
    }
    const inDegree = new Map<string, number>([...events].map(event => [event, 0]));
    for (const targets of edges.values()) for (const target of targets) inDegree.set(target, inDegree.get(target)! + 1);
    const ready = [...events].filter(event => inDegree.get(event) === 0); let visited = 0;
    while (ready.length) { const event = ready.pop()!; visited++;
        for (const next of edges.get(event)!) { inDegree.set(next, inDegree.get(next)! - 1); if (inDegree.get(next) === 0) ready.push(next); }
    }
    if (visited !== events.size) fail('AUTOMATIC_CYCLE', '$.triggers');
    const loaded = freezeTree(structuredClone(pack));
    loadedPacks.add(loaded);
    return loaded;
}
/** Validation is throw-or-return, deliberately identical to load, never a lossy boolean. */
export const validateNarrativePack = loadNarrativePack;

function constantCondition(condition: Condition): boolean | undefined {
    switch (condition.op) {
        case 'true': return true;
        case 'not': { const value = constantCondition(condition.arg); return value === undefined ? undefined : !value; }
        case 'all': { const values = condition.args.map(constantCondition); return values.includes(false) ? false : values.every(v => v === true) ? true : undefined; }
        case 'any': { const values = condition.args.map(constantCondition); return values.includes(true) ? true : values.every(v => v === false) ? false : undefined; }
        default: return undefined;
    }
}
