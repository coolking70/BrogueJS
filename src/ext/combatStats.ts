/** Optional actor-scoped combat capacity consumer. Growth owns all attribute
 * interpretation; this codec accepts only bounded, already-derived integers. */
import type { OptionalQueryResult } from './types';
import type { ActorCombatStats, ActorResourcePolicy } from './actorActions';

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('Invalid combat stat DTO');
    const own = Reflect.ownKeys(value);
    if (own.length !== keys.length || own.some(key => typeof key !== 'string' || !keys.includes(key))) throw new Error('Invalid combat stat DTO');
    for (const key of own) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!descriptor.enumerable || !('value' in descriptor)) throw new Error('Invalid combat stat DTO');
    }
    return value as Record<string, unknown>;
}
export function validateActorCombatStats(value: unknown): asserts value is ActorCombatStats {
    const row = record(value, ['staminaCapacity', 'poiseCapacity', 'revision']);
    for (const capacity of [row.staminaCapacity, row.poiseCapacity])
        if (typeof capacity !== 'number' || !Number.isSafeInteger(capacity) || capacity < 1 || capacity > 1_000_000)
            throw new Error('Invalid combat stat capacity');
    if (typeof row.revision !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(row.revision))
        throw new Error('Invalid combat stat revision');
}
export function resolveCombatStats(result: OptionalQueryResult): ActorCombatStats | undefined {
    const envelope = record(result, Object.getOwnPropertyDescriptor(result, 'status')?.value === 'available' ? ['status', 'value'] : ['status', 'reason']);
    if (envelope.status === 'unavailable') {
        if (envelope.reason !== 'absent' && envelope.reason !== 'unsupported-input') throw new Error('Invalid combat stat availability');
        return undefined;
    }
    if (envelope.status !== 'available') throw new Error('Invalid combat stat availability');
    const value = envelope.value;
    if (value && typeof value === 'object' && !Array.isArray(value)
        && Object.getOwnPropertyDescriptor(value, 'status')?.value === 'unsupported') {
        record(value, ['status']); return undefined;
    }
    const supported = record(value, ['status', 'staminaCapacity', 'poiseCapacity', 'revision']);
    if (supported.status !== 'supported') throw new Error('Invalid combat stat support');
    const stats = { staminaCapacity: supported.staminaCapacity, poiseCapacity: supported.poiseCapacity, revision: supported.revision };
    validateActorCombatStats(stats);
    return stats;
}
/** Capacity-only adaptation never changes fees, recovery rates, phases or clocks. */
export function combatCapacityPolicy(base: ActorResourcePolicy, stats?: ActorCombatStats): ActorResourcePolicy {
    if (!stats) return base;
    return { ...base, staminaCapacity: stats.staminaCapacity, poiseCapacity: stats.poiseCapacity,
        initialStamina: Math.min(base.initialStamina, stats.staminaCapacity),
        poiseBreakRecoveryValue: Math.min(base.poiseBreakRecoveryValue, stats.poiseCapacity) };
}
