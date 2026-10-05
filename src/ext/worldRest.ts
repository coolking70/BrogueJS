/** Foundation-owned DTO contract for finite nonblocking rest points. No module
 * imports, world writes, recovery effects, clocks, or random draws live here. */
export interface BonfireDefinition {
    id: string; nameKey: string; descriptionKey: string; glyph: string; color: string;
    interactionDistance: number;
    placement: { minDepth: number; maxDepth: number; maxPerDepth: number; maxPerRun: number;
        minStairDistance: number; maxEntranceDistance: number; onNoSpace: 'skip' | 'defer' };
    restTicks: number;
    restorePolicy: { hp: 'full' | 'none'; stamina: 'full' | 'none'; poise: 'full' | 'none' };
    resetPolicy: 'none';
}
export type WorldRestUnavailableReason='unavailable'|'busy'|'gate'|'distance'|'threatened';
export interface BonfireConfig {
    definitions: BonfireDefinition[];
    limits: { maxActive: number; maxPlacements: number; maxRestReceipts: number };
}
export interface BonfireBinding { definitionId: string; instanceKey: string }
export interface BonfirePlacement extends BonfireBinding {
    depth: number; result: 'placed' | 'skipped'; visits: number; completedRests: number;
}
export interface BonfirePendingPlacement extends BonfireBinding { attemptedDepths: number[] }
export type BonfireInterruptReason = 'damage' | 'moved' | 'dead' | 'threat' | 'level-exit' | 'target-removed' | 'invalid' | 'incapacitated';
export interface BonfireRestActive extends BonfireBinding {
    actionId: number; bonfireId: number; visit: number; actorId: number; depth: number;
    phase: 'resting' | 'settling'; startHp: number; anchor: { x: number; y: number }; interrupted: BonfireInterruptReason | null;
}
export interface BonfireRestReceipt extends BonfireBinding {
    actionId: number; bonfireId: number; visit: number; actorId: number; depth: number;
    result: 'completed' | 'interrupted'; reason: BonfireInterruptReason | null;
}
export interface BonfireState {
    bindings: Record<string, BonfireBinding>;
    placements: BonfirePlacement[]; pending: BonfirePendingPlacement[];
    active: BonfireRestActive | null;
    /** Oldest-first rolling history. Eviction never resets placement totals or
     * permits a completed action/visit to be applied again. */
    receipts: BonfireRestReceipt[];
}
export const BONFIRE_LIMITS = Object.freeze({ maxDefinitions: 128, maxPlacements: 1024,
    maxActive: 1024, maxRestReceipts: 4096, maxWorldDepth: 40, maxTicks: 1_000_000 });
const reasons: readonly BonfireInterruptReason[] = ['damage','moved','dead','threat','level-exit','target-removed','invalid','incapacitated'];
const fail = (field: string): never => { throw new Error(`Bonfire data: ${field}`); };
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail('invalid integer');
    return value as number;
};
const id = (value: unknown): string => {
    if (typeof value !== 'string' || value.length > 128 || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value)
        || ['constructor','prototype'].includes(value)) fail('invalid ID');
    return value as string;
};
/** Never inspect a getter. Charge aliases at every occurrence and cap JSON before
 * traversing a definition or state supplied by a save or content pack. */
function json(value: unknown): void {
    let count = 0, text = 0;
    const visiting = new Set<object>();
    const charge = (value: string) => { text += value.length; if (value.length > 4096 || text > 8_000_000) fail('text budget'); };
    const visit = (part: unknown, depth: number): void => {
        if (++count > 1_000_000 || depth > 24) fail('JSON budget');
        if (part === null || typeof part === 'boolean') return;
        if (typeof part === 'number') { integer(part, Number.MIN_SAFE_INTEGER); return; }
        if (typeof part === 'string') { charge(part); return; }
        if (typeof part !== 'object' || visiting.has(part)) fail('invalid JSON');
        const object = part as object, array = Array.isArray(object), prototype = Object.getPrototypeOf(object), keys = Reflect.ownKeys(object);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('JSON prototype');
        if (array && ((object as unknown[]).length > 1_000_000 || keys.length !== (object as unknown[]).length + 1)) fail('JSON array');
        if (keys.length > 1_000_000 - count + (array ? 1 : 0)) fail('JSON budget');
        visiting.add(object);
        for (const key of keys) {
            if (typeof key !== 'string' || ['__proto__','constructor','prototype'].includes(key as string)) fail('JSON key');
            if (array && key === 'length') continue;
            charge(key as string);
            if (array && (!/^(0|[1-9][0-9]*)$/.test(key as string) || Number(key) >= (object as unknown[]).length)) fail('JSON index');
            const descriptor = Object.getOwnPropertyDescriptor(object, key)!;
            if (!descriptor.enumerable || !('value' in descriptor)) fail('JSON descriptor');
            visit(descriptor.value, depth + 1);
        }
        visiting.delete(object);
    };
    visit(value, 0);
}
function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).length !== fields.length || fields.some(key => !Object.prototype.hasOwnProperty.call(value, key))) fail('object shape');
    return value as Record<string, unknown>;
}
function list(value: unknown, max: number, min = 0): unknown[] {
    if (!Array.isArray(value) || value.length < min || value.length > max) fail('array budget');
    return value as unknown[];
}
function oneOf(value: unknown, choices: readonly unknown[]): void { if (!choices.includes(value)) fail('unsupported policy'); }
export function validateBonfireConfig(raw: unknown): BonfireConfig {
    json(raw);
    const root = record(raw, ['definitions','limits']);
    const limits = record(root.limits, ['maxActive','maxPlacements','maxRestReceipts']);
    integer(limits.maxPlacements, 1, BONFIRE_LIMITS.maxPlacements);
    integer(limits.maxActive, 1, Math.min(limits.maxPlacements as number, BONFIRE_LIMITS.maxActive));
    integer(limits.maxRestReceipts, 1, BONFIRE_LIMITS.maxRestReceipts);
    const ids = new Set<string>(); let placements = 0;
    for (const rawDefinition of list(root.definitions, BONFIRE_LIMITS.maxDefinitions, 1)) {
        const definition = record(rawDefinition, ['id','nameKey','descriptionKey','glyph','color','interactionDistance','placement','restTicks','restorePolicy','resetPolicy']);
        const key = id(definition.id); if (ids.has(key)) fail('duplicate definition'); ids.add(key);
        // Include the longest instance suffix in the foundation ID budget.
        if (`${key}.slot.${BONFIRE_LIMITS.maxPlacements}`.length > 128) fail('instance ID budget');
        for (const name of ['nameKey','descriptionKey']) if (typeof definition[name] !== 'string'
            || (definition[name] as string).length > 256 || !/^ext\.[a-z][a-z0-9.-]*\.[a-zA-Z0-9_.-]+$/.test(definition[name] as string)) fail('text key');
        if (typeof definition.glyph !== 'string' || [...definition.glyph].length !== 1 || /[\x00-\x1f\x7f]/.test(definition.glyph)) fail('glyph');
        if (typeof definition.color !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(definition.color)) fail('color');
        integer(definition.interactionDistance, 0, 16); integer(definition.restTicks, 1, BONFIRE_LIMITS.maxTicks);
        const placement = record(definition.placement, ['minDepth','maxDepth','maxPerDepth','maxPerRun','minStairDistance','maxEntranceDistance','onNoSpace']);
        integer(placement.minDepth, 1, BONFIRE_LIMITS.maxWorldDepth);
        integer(placement.maxDepth, placement.minDepth as number, BONFIRE_LIMITS.maxWorldDepth);
        integer(placement.maxPerRun, 1, limits.maxPlacements as number);
        integer(placement.maxPerDepth, 1, placement.maxPerRun as number);
        integer(placement.minStairDistance, 0, 256);
        integer(placement.maxEntranceDistance, placement.minStairDistance as number, 256);
        oneOf(placement.onNoSpace, ['skip','defer']);
        placements += placement.maxPerRun as number;
        const restore = record(definition.restorePolicy, ['hp','stamina','poise']);
        for (const value of Object.values(restore)) oneOf(value, ['full','none']);
        oneOf(definition.resetPolicy, ['none']);
    }
    if (placements > (limits.maxPlacements as number)) fail('aggregate placement budget');
    return JSON.parse(JSON.stringify(raw)) as BonfireConfig;
}
export function initialBonfireState(): BonfireState { return { bindings: {}, placements: [], pending: [], active: null, receipts: [] }; }
export function bonfireInstanceKey(definitionId: string, ordinal: number): string { return `${definitionId}.slot.${ordinal}`; }
export function bonfireBindingDefinition(config: BonfireConfig, binding: BonfireBinding): { definition: BonfireDefinition; ordinal: number } | null {
    const definition = config.definitions.find(row => row.id === binding.definitionId), prefix = `${binding.definitionId}.slot.`;
    if (!definition || !binding.instanceKey.startsWith(prefix)) return null;
    const suffix = binding.instanceKey.slice(prefix.length), ordinal = Number(suffix);
    return /^[1-9][0-9]*$/.test(suffix) && Number.isSafeInteger(ordinal) && ordinal <= definition.placement.maxPerRun ? { definition, ordinal } : null;
}
/** Returns a detached tree; never repairs a save or finishes a rest during load.
 * The caller validates the sole scheduler clock and the live actor separately. */
export function validateBonfireState(raw: unknown, config: BonfireConfig, nextActionId?: number): BonfireState {
    validateBonfireConfig(config); json(raw);
    if (nextActionId !== undefined) integer(nextActionId, 1);
    const root = record(raw, ['bindings','placements','pending','active','receipts']);
    const placements = list(root.placements, config.limits.maxPlacements), pending = list(root.pending, config.limits.maxPlacements);
    if (placements.length + pending.length > config.limits.maxPlacements) fail('aggregate state budget');
    const used = new Set<string>(), ordinals = new Map<string, number[]>(), byInstance = new Map<string, BonfirePlacement>();
    const depthCounts = new Map<string, number>();
    const binding = (row: Record<string, unknown>) => {
        id(row.definitionId); id(row.instanceKey);
        const found = bonfireBindingDefinition(config, row as unknown as BonfireBinding); if (!found) fail('unknown binding');
        return found!;
    };
    let totalVisits = 0, totalCompleted = 0;
    for (const [name, collection] of [['placements', placements], ['pending', pending]] as const) {
        let previous = '';
        for (const rawRow of collection) {
            const row = record(rawRow, name === 'placements' ? ['definitionId','instanceKey','depth','result','visits','completedRests'] : ['definitionId','instanceKey','attemptedDepths']);
            const { definition, ordinal } = binding(row), key = row.instanceKey as string, placement = definition.placement;
            if (key <= previous || used.has(key)) fail('duplicate/unordered placement'); previous = key; used.add(key);
            const slots = ordinals.get(definition.id) ?? []; slots.push(ordinal); ordinals.set(definition.id, slots);
            if (name === 'placements') {
                integer(row.depth, placement.minDepth, BONFIRE_LIMITS.maxWorldDepth); oneOf(row.result, ['placed','skipped']);
                if ((row.depth as number) > placement.maxDepth && (row.result === 'placed' || placement.onNoSpace !== 'defer')) fail('placement depth');
                integer(row.visits); integer(row.completedRests, 0, row.visits as number);
                if (row.result === 'skipped' && (row.visits !== 0 || row.completedRests !== 0)) fail('skipped rest');
                totalVisits += row.visits as number; totalCompleted += row.completedRests as number; integer(totalVisits); integer(totalCompleted);
                byInstance.set(key, rawRow as BonfirePlacement);
                if ((row.depth as number) <= placement.maxDepth) {
                    const depthKey = `${definition.id}:${row.depth}`, count = (depthCounts.get(depthKey) ?? 0) + 1;
                    if (count > placement.maxPerDepth) fail('depth placement budget'); depthCounts.set(depthKey, count);
                }
            } else {
                if (placement.onNoSpace !== 'defer') fail('unsupported pending placement');
                let previousDepth = 0;
                for (const depth of list(row.attemptedDepths, BONFIRE_LIMITS.maxWorldDepth, 1)) {
                    integer(depth, Math.max(placement.minDepth, previousDepth + 1), placement.maxDepth - 1); previousDepth = depth as number;
                    const depthKey = `${definition.id}:${depth}`, count = (depthCounts.get(depthKey) ?? 0) + 1;
                    if (count > placement.maxPerDepth) fail('depth attempt budget'); depthCounts.set(depthKey, count);
                }
            }
        }
    }
    if (nextActionId !== undefined && totalVisits >= nextActionId) fail('visits exceed allocated actions');
    for (const slots of ordinals.values()) { slots.sort((a,b) => a-b); if (slots.some((slot,index) => slot !== index + 1)) fail('slot gap'); }
    if (!root.bindings || typeof root.bindings !== 'object' || Array.isArray(root.bindings)) fail('bindings');
    const bindings = root.bindings as Record<string, BonfireBinding>, bound = new Set<string>(), entityInstances = new Map<number, string>(), instanceEntities = new Map<string, number>();
    if (Object.keys(bindings).length > config.limits.maxActive) fail('active budget');
    for (const [entityId, rawBinding] of Object.entries(bindings)) {
        if (!/^[1-9][0-9]*$/.test(entityId)) fail('entity ID'); integer(Number(entityId), 1);
        const row = record(rawBinding, ['definitionId','instanceKey']); binding(row);
        const placement = byInstance.get(rawBinding.instanceKey);
        if (!placement || placement.result !== 'placed' || placement.definitionId !== rawBinding.definitionId || bound.has(rawBinding.instanceKey)) fail('orphan binding');
        bound.add(rawBinding.instanceKey); entityInstances.set(Number(entityId), rawBinding.instanceKey); instanceEntities.set(rawBinding.instanceKey, Number(entityId));
    }
    const rest = (rawRow: unknown, active: boolean): Record<string, unknown> => {
        const row = record(rawRow, ['actionId','bonfireId','definitionId','instanceKey','visit','actorId','depth', ...(active ? ['phase','startHp','anchor','interrupted'] : ['result','reason'])]);
        binding(row); integer(row.actionId, 1, nextActionId === undefined ? Number.MAX_SAFE_INTEGER : nextActionId - 1);
        integer(row.bonfireId, 1); integer(row.actorId, 1); integer(row.depth, 1, BONFIRE_LIMITS.maxWorldDepth);
        const placement = byInstance.get(row.instanceKey as string);
        if (!placement || placement.result !== 'placed' || placement.depth !== row.depth || placement.definitionId !== row.definitionId) fail('orphan rest');
        integer(row.visit, 1, placement!.visits);
        const instance = entityInstances.get(row.bonfireId as number);
        if (instance && instance !== row.instanceKey || instanceEntities.has(row.instanceKey as string) && instanceEntities.get(row.instanceKey as string) !== row.bonfireId) fail('reused entity ID');
        entityInstances.set(row.bonfireId as number, row.instanceKey as string); instanceEntities.set(row.instanceKey as string, row.bonfireId as number);
        if (active) {
            if (row.visit !== placement!.visits) fail('stale active visit');
            oneOf(row.phase, ['resting','settling']);
            integer(row.startHp, 1); const anchor = record(row.anchor, ['x','y']); integer(anchor.x, 0, 1023); integer(anchor.y, 0, 1023);
            oneOf(row.interrupted, [null,...reasons]);
            if (row.interrupted === null && (bindings[row.bonfireId as number]?.instanceKey !== row.instanceKey)) fail('missing active binding');
        } else {
            oneOf(row.result, ['completed','interrupted']);
            oneOf(row.reason, row.result === 'completed' ? [null] : reasons);
        }
        return row;
    };
    const active = root.active === null ? null : rest(root.active, true);
    const receipts = list(root.receipts, config.limits.maxRestReceipts);
    if (receipts.length !== Math.min(config.limits.maxRestReceipts, totalVisits - (active ? 1 : 0))) fail('receipt count');
    let previousAction = 0; const previousVisits = new Map<string, number>(), completed = new Map<string, number>(), interrupted = new Map<string, number>();
    for (const rawReceipt of receipts) {
        const row = rest(rawReceipt, false), key = row.instanceKey as string;
        if ((row.actionId as number) <= previousAction
            || previousVisits.has(key) && row.visit !== previousVisits.get(key)! + 1
            || active && row.actionId === active.actionId) fail('duplicate/unordered receipt');
        previousAction = row.actionId as number; previousVisits.set(key, row.visit as number);
        const counts = row.result === 'completed' ? completed : interrupted; counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (active && (active.actionId as number) <= previousAction) fail('stale active action');
    for (const placement of byInstance.values()) {
        const activeHere = active?.instanceKey === placement.instanceKey ? 1 : 0;
        if (placement.completedRests < (completed.get(placement.instanceKey) ?? 0)
            || placement.completedRests > placement.visits - (interrupted.get(placement.instanceKey) ?? 0) - activeHere) fail('rest totals');
        const last = previousVisits.get(placement.instanceKey);
        if (last !== undefined && last !== placement.visits - activeHere) fail('stale receipt');
        if (totalVisits - (active ? 1 : 0) <= config.limits.maxRestReceipts
            && placement.completedRests !== (completed.get(placement.instanceKey) ?? 0)) fail('completion total');
    }
    return JSON.parse(JSON.stringify(raw)) as BonfireState;
}
