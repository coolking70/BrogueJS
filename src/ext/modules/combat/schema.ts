import { validateBonfireConfig } from '../../worldRest';
import type { AttackDefinition, Cell, CombatPack, ResourcePolicy } from './types';

/** Independent hard ceilings. The aggregate JSON budgets also apply when several
 * individually bounded arrays are combined; content cannot raise these limits. */
export const COMBAT_LIMITS = Object.freeze({
    maxSubactions: 4, maxSegments: 8, maxOffsets: 256, maxLockedCells: 1024,
    maxDefinitions: 128, maxTicks: 1_000_000, maxResource: 1_000_000,
    maxCoordinate: 1_000_000, maxOffsetCoordinate: 32,
    maxJsonDepth: 32, maxJsonValues: 1_000_000, maxJsonStringUnits: 8_000_000,
    maxStringLength: 4096, maxIdLength: 128,
});
export const COMBAT_ERROR_CODES = [
    'INVALID_JSON', 'INVALID_TYPE', 'UNKNOWN_KEY', 'INVALID_INTEGER', 'INVALID_RANGE',
    'INVALID_ID', 'INVALID_VERSION', 'INVALID_TEXT', 'DUPLICATE_ID', 'UNKNOWN_REFERENCE',
    'INVALID_STATE', 'BUDGET',
] as const;
export type CombatErrorCode = typeof COMBAT_ERROR_CODES[number];
/** Stable diagnostic codes and paths; a future display adapter can localize textKey. */
export class CombatValidationError extends Error {
    readonly name = 'CombatValidationError';
    readonly textKey: string;
    constructor(readonly code: CombatErrorCode, readonly path: string) {
        super(`Combat ${code} at ${path}`);
        this.textKey = `ext.combat.error.${code}`;
    }
}
const fail = (code: CombatErrorCode, path = '$'): never => { throw new CombatValidationError(code, path); };
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const facings = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
// Provenance is transient validation metadata, never a second simulation state.
const loadedPacks = new WeakSet<object>();

/** Inspect descriptors before reading values, so getters are rejected, never run.
 * Aliases are allowed but charged at every occurrence, matching serialized size. */
export function assertCombatJson(value: unknown): void {
    const visiting = new Set<object>();
    let values = 0, stringUnits = 0;
    const textBudget = (text: string, path: string): void => {
        stringUnits += text.length;
        if (text.length > COMBAT_LIMITS.maxStringLength || stringUnits > COMBAT_LIMITS.maxJsonStringUnits) fail('BUDGET', path);
    };
    const visit = (part: unknown, depth: number, path: string): void => {
        if (++values > COMBAT_LIMITS.maxJsonValues || depth > COMBAT_LIMITS.maxJsonDepth) fail('BUDGET', path);
        if (part === null || typeof part === 'boolean') return;
        if (typeof part === 'string') { textBudget(part, path); return; }
        if (typeof part === 'number') { integer(part, Number.MIN_SAFE_INTEGER); return; }
        if (typeof part !== 'object' || visiting.has(part)) return fail('INVALID_JSON', path);
        const array = Array.isArray(part), prototype = Object.getPrototypeOf(part);
        if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) fail('INVALID_JSON', path);
        visiting.add(part);
        const keys = Reflect.ownKeys(part);
        // Array length is an own, non-accessor built-in. Bound before iteration.
        if (array && (part.length >= COMBAT_LIMITS.maxJsonValues || keys.length !== part.length + 1)) fail('INVALID_JSON', path);
        if (keys.length > COMBAT_LIMITS.maxJsonValues - values + (array ? 1 : 0)) fail('BUDGET', path);
        for (const key of keys) {
            if (typeof key !== 'string' || forbidden.has(key)) return fail('INVALID_JSON', path);
            if (array && key === 'length') continue;
            textBudget(key, path);
            if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= part.length)) fail('INVALID_JSON', path);
            const descriptor = Object.getOwnPropertyDescriptor(part, key)!;
            if (!descriptor.enumerable || !('value' in descriptor)) fail('INVALID_JSON', `${path}.${key}`);
            visit(descriptor.value, depth + 1, `${path}.${key}`);
        }
        visiting.delete(part);
    };
    visit(value, 0, '$');
}

/** Exact local object shape. This helper itself never invokes an own accessor. */
export function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('INVALID_TYPE');
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) fail('INVALID_JSON');
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || forbidden.has(key)) return fail('INVALID_JSON');
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!descriptor.enumerable || !('value' in descriptor)) fail('INVALID_JSON', `$.${key}`);
        if (!keys.includes(key)) fail('UNKNOWN_KEY', `$.${key}`);
    }
    for (const key of keys) if (!Object.prototype.hasOwnProperty.call(value, key)) fail('INVALID_TYPE', `$.${key}`);
    return value as Record<string, unknown>;
}
export function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) return fail('INVALID_INTEGER');
    if (value < min || value > max) fail('INVALID_RANGE');
    return value;
}
export function id(value: unknown): string {
    if (typeof value !== 'string' || value.length > COMBAT_LIMITS.maxIdLength
        || !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(value) || forbidden.has(value)) return fail('INVALID_ID');
    return value;
}
function list(value: unknown, min: number, max: number): unknown[] {
    if (!Array.isArray(value)) return fail('INVALID_TYPE');
    if (value.length < min || value.length > max) fail('BUDGET');
    return value;
}
function checkCells(value: unknown, max: number, coordinateBound: number): Cell[] {
    const seen = new Set<string>();
    for (const item of list(value, 1, max)) {
        const cell = record(item, ['x', 'y']);
        const x = integer(cell.x, -coordinateBound, coordinateBound), y = integer(cell.y, -coordinateBound, coordinateBound);
        const key = `${x},${y}`;
        if (seen.has(key)) fail('DUPLICATE_ID');
        seen.add(key);
    }
    return value as Cell[];
}
/** Coordinates are a bounded DTO only; world bounds/occupancy belong to foundation. */
export function cells(value: unknown, max: number = COMBAT_LIMITS.maxLockedCells): Cell[] {
    integer(max, 1, COMBAT_LIMITS.maxLockedCells);
    assertCombatJson(value);
    return checkCells(value, max, COMBAT_LIMITS.maxCoordinate);
}
function freezeTree<T>(value: T): T {
    if (value !== null && typeof value === 'object') {
        for (const child of Object.values(value)) freezeTree(child);
        Object.freeze(value);
    }
    return value;
}
/** Explicitly freezes a caller-owned JSON tree; loaders first clone their input. */
export function freezeCombat<T>(value: T): T { assertCombatJson(value); return freezeTree(value); }
export function assertLoadedCombatPack(pack: CombatPack): void {
    if (!pack || typeof pack !== 'object' || !loadedPacks.has(pack)) fail('INVALID_STATE', '$pack');
}
function enumeration(value: unknown, values: readonly unknown[]): void {
    if (!values.includes(value)) fail('INVALID_TYPE');
}
function localeChecker(locale: unknown): (value: unknown) => void {
    assertCombatJson(locale);
    if (!locale || typeof locale !== 'object' || Array.isArray(locale)) fail('INVALID_TYPE', '$locale');
    const text = locale as Record<string, unknown>;
    if (Object.keys(text).length > COMBAT_LIMITS.maxDefinitions * 4) fail('BUDGET', '$locale');
    const textKey = (value: unknown): value is string => typeof value === 'string' && value.length <= 256
        && /^ext\.combat\.[a-zA-Z0-9_.-]+$/.test(value);
    for (const [key, value] of Object.entries(text)) {
        if (!textKey(key) || typeof value !== 'string' || !value.trim()
            || /[<>]|javascript\s*:|\beval\s*\(|\bnew\s+Function\s*\(/i.test(value)) fail('INVALID_TEXT', `$locale.${key}`);
    }
    return value => {
        if (!textKey(value) || !Object.prototype.hasOwnProperty.call(text, value)) fail('INVALID_TEXT');
    };
}

/** Pure inert fixture package: validate everything before cloning/freezing. No
 * providers, creature bindings, AI, scheduling, or world mutation are accepted. */
export function loadCombatPack(input: unknown, locale: unknown): CombatPack {
    assertCombatJson(input);
    const text = localeChecker(locale);
    const root = record(input, ['schema', 'moduleId', 'moduleVersion', 'rulesVersion', 'resourcePolicies', 'attacks', 'profiles', 'nativeProfiles', 'playerProfileId', 'breakRecoveryTicks', 'dodge', 'parry', 'bonfires']);
    if (root.schema !== 1 || root.moduleId !== 'combat' || root.moduleVersion !== '1.5.0' || root.rulesVersion !== '1.5.0') fail('INVALID_VERSION');
    const policies = list(root.resourcePolicies, 1, COMBAT_LIMITS.maxDefinitions);
    const attacks = list(root.attacks, 1, COMBAT_LIMITS.maxDefinitions);
    const profiles = list(root.profiles, 1, COMBAT_LIMITS.maxDefinitions);
    integer(root.breakRecoveryTicks, 1, COMBAT_LIMITS.maxTicks);
    const dodge = record(root.dodge, ['cost', 'windowTicks', 'recoveryTicks']);
    integer(dodge.cost, 0, COMBAT_LIMITS.maxResource);
    integer(dodge.recoveryTicks, 1, COMBAT_LIMITS.maxTicks);
    integer(dodge.windowTicks, 1, dodge.recoveryTicks as number);
    const parry = record(root.parry, ['cost', 'windowTicks', 'recoveryTicks', 'poiseDamage', 'contactRange']);
    integer(parry.cost, 0, COMBAT_LIMITS.maxResource);
    integer(parry.recoveryTicks, 1, COMBAT_LIMITS.maxTicks);
    integer(parry.windowTicks, 1, parry.recoveryTicks as number);
    integer(parry.poiseDamage, 0, COMBAT_LIMITS.maxResource);
    integer(parry.contactRange, 1, COMBAT_LIMITS.maxOffsetCoordinate);
    let bonfires: CombatPack['bonfires'];
    try { bonfires = validateBonfireConfig(root.bonfires); } catch { return fail('INVALID_STATE', '$.bonfires'); }
    id(root.playerProfileId);
    if (policies.length + attacks.length + profiles.length + bonfires.definitions.length > COMBAT_LIMITS.maxDefinitions) fail('BUDGET');
    const ids = new Set<string>(), policyById = new Map<string, ResourcePolicy>(), attackById = new Map<string, AttackDefinition>();
    const define = (value: unknown): string => {
        const key = id(value);
        if (ids.has(key)) fail('DUPLICATE_ID');
        ids.add(key); return key;
    };
    for (const bonfire of bonfires.definitions) {
        define(bonfire.id); text(bonfire.nameKey); text(bonfire.descriptionKey);
    }
    for (const item of policies) {
        const policy = record(item, ['id', 'staminaCapacity', 'initialStamina', 'regenPerTickNumerator', 'regenPerTickDenominator',
            'regenDelayTicks', 'nativeAttackCost', 'regenPhases', 'poiseCapacity', 'poiseRecoveryNumerator', 'poiseRecoveryDenominator',
            'poiseRecoveryDelayTicks', 'poiseBreakRecoveryValue', 'nativePoiseDamage', 'poiseImmune']);
        const key = define(policy.id);
        integer(policy.staminaCapacity, 1, COMBAT_LIMITS.maxResource);
        integer(policy.initialStamina, 0, policy.staminaCapacity as number);
        integer(policy.regenPerTickNumerator, 0, COMBAT_LIMITS.maxResource);
        integer(policy.regenPerTickDenominator, 1, COMBAT_LIMITS.maxResource);
        integer(policy.regenDelayTicks, 0, COMBAT_LIMITS.maxTicks);
        integer(policy.nativeAttackCost, 0, policy.staminaCapacity as number);
        const phases = list(policy.regenPhases, 0, 5);
        if (new Set(phases).size !== phases.length) fail('DUPLICATE_ID');
        for (const phase of phases) enumeration(phase, ['idle', 'windup', 'inter-segment', 'recovery', 'break-recovery']);
        integer(policy.poiseCapacity, 1, COMBAT_LIMITS.maxResource);
        integer(policy.poiseRecoveryNumerator, 0, COMBAT_LIMITS.maxResource);
        integer(policy.poiseRecoveryDenominator, 1, COMBAT_LIMITS.maxResource);
        integer(policy.poiseRecoveryDelayTicks, 0, COMBAT_LIMITS.maxTicks);
        integer(policy.poiseBreakRecoveryValue, 1, policy.poiseCapacity as number);
        integer(policy.nativePoiseDamage, 0, COMBAT_LIMITS.maxResource);
        enumeration(policy.poiseImmune, [true, false]);
        policyById.set(key, item as ResourcePolicy);
    }
    for (const item of attacks) {
        const attack = record(item, ['id', 'nameKey', 'cost', 'windupTicks', 'recoveryTicks', 'interruptPolicy', 'segments']);
        const key = define(attack.id); text(attack.nameKey);
        integer(attack.cost, 0, COMBAT_LIMITS.maxResource);
        let duration = integer(attack.windupTicks, 1, COMBAT_LIMITS.maxTicks) + integer(attack.recoveryTicks, 1, COMBAT_LIMITS.maxTicks);
        enumeration(attack.interruptPolicy, ['cancel-pending']);
        const segments = list(attack.segments, 1, COMBAT_LIMITS.maxSegments);
        segments.forEach((item, index) => {
            const segment = record(item, ['delayTicks', 'shape', 'locationPolicy', 'targetPolicy', 'damageProfile',
                'poiseDamage', 'parryable', 'dodgeable', 'friendlyFire']);
            duration += integer(segment.delayTicks, index === 0 ? 0 : 1, index === 0 ? 0 : COMBAT_LIMITS.maxTicks);
            enumeration(segment.locationPolicy, ['locked-world']); enumeration(segment.targetPolicy, ['part']);
            enumeration(segment.damageProfile, ['native-melee']); enumeration(segment.friendlyFire, [false]);
            enumeration(segment.parryable, [true, false]); enumeration(segment.dodgeable, [true, false]);
            integer(segment.poiseDamage, 0, COMBAT_LIMITS.maxResource);
            const shape = record(segment.shape, ['kind', 'offsets', 'selfExclusion', 'occlusion']);
            enumeration(shape.kind, ['footprint-offset-union']); enumeration(shape.selfExclusion, ['source-member', 'whole-group']);
            enumeration(shape.occlusion, ['line-of-effect']);
            const offsets = record(shape.offsets, facings);
            for (const facing of facings) checkCells(offsets[facing], COMBAT_LIMITS.maxOffsets, COMBAT_LIMITS.maxOffsetCoordinate);
        });
        integer(duration, 1, COMBAT_LIMITS.maxTicks);
        attackById.set(key, item as AttackDefinition);
    }
    for (const item of profiles) {
        const profile = record(item, ['id', 'resourcePolicyId', 'attackIds']);
        define(profile.id);
        const policy = policyById.get(id(profile.resourcePolicyId));
        if (!policy) fail('UNKNOWN_REFERENCE');
        if ((dodge.cost as number) > policy!.staminaCapacity || (parry.cost as number) > policy!.staminaCapacity) fail('INVALID_RANGE');
        const references = new Set<string>();
        for (const value of list(profile.attackIds, 1, COMBAT_LIMITS.maxDefinitions)) {
            const key = id(value), attack = attackById.get(key);
            if (!attack) fail('UNKNOWN_REFERENCE');
            if (references.has(key)) fail('DUPLICATE_ID');
            references.add(key);
            // A declared fixture profile must be able to pay each declared attack.
            if (attack!.cost > policy!.staminaCapacity) fail('INVALID_RANGE');
        }
    }
    const nativeIds = new Set<string>();
    for (const binding of list(root.nativeProfiles, 0, COMBAT_LIMITS.maxDefinitions)) {
        const entry = record(binding, ['monsterId','profileId']); id(entry.monsterId); id(entry.profileId);
        if (nativeIds.has(entry.monsterId as string)) fail('DUPLICATE_ID'); nativeIds.add(entry.monsterId as string);
        if (!(root.profiles as {id:string}[]).some(profile => profile.id === entry.profileId)) fail('UNKNOWN_REFERENCE');
    }
    if (!(root.profiles as {id:string}[]).some(profile => profile.id === root.playerProfileId)) fail('UNKNOWN_REFERENCE');
    const result = freezeTree(structuredClone(input as CombatPack));
    loadedPacks.add(result);
    return result;
}
