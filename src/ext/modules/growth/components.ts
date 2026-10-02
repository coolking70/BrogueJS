import { validId } from '../../json';
import { levelForExperience, type GrowthLevelsConfig } from './experience';

export type GrowthProgression = { level: number; experience: number; attributePoints: number; skillPoints: number };
export type GrowthDerived = { appliedStrength: number; appliedMaxHp: number };
export type GrowthFocus = { current: number; remainder: number };
/** Minimal persisted cooldown substrate; learning/equipment/effect state is added in its own versioned step. */
export type GrowthSkills = { readyAt: Record<string, number> };

function integer(value: unknown, minimum = 0): value is number { return Number.isSafeInteger(value) && (value as number) >= minimum; }
/** Data properties only: validation must not call accessors, accept foreign prototypes, or ignore symbol/hidden keys. */
function record(value: unknown, keys?: readonly string[]): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const own = Reflect.ownKeys(value);
    if (keys && own.length !== keys.length) return false;
    return own.every(key => {
        if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key) || (keys && !keys.includes(key))) return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        return descriptor.enumerable && Object.prototype.hasOwnProperty.call(descriptor, 'value');
    });
}

/** Exact shape + cap + level/XP consistency; point provenance is checked by the committing operation. */
export function isGrowthProgression(value: unknown, levels: GrowthLevelsConfig): value is GrowthProgression {
    if (!record(value, ['level', 'experience', 'attributePoints', 'skillPoints']) || !integer(value.level, 1)
        || !integer(value.experience) || !integer(value.attributePoints) || !integer(value.skillPoints)) return false;
    try { return levelForExperience(levels, value.experience) === value.level; } catch { return false; }
}

/** Supply the independently calculated bonus on load to reject a duplicate/missing applied delta. */
export function isGrowthDerived(value: unknown, expected?: Readonly<GrowthDerived>): value is GrowthDerived {
    return record(value, ['appliedStrength', 'appliedMaxHp']) && integer(value.appliedStrength) && integer(value.appliedMaxHp)
        && (!expected || value.appliedStrength === expected.appliedStrength && value.appliedMaxHp === expected.appliedMaxHp);
}

/** Capacity/interval are supplied by the current rules; they are never duplicated in saved components. */
export function isGrowthFocus(value: unknown, capacity: number, recoveryInterval: number): value is GrowthFocus {
    return integer(capacity) && integer(recoveryInterval, 1) && record(value, ['current', 'remainder'])
        && integer(value.current) && value.current <= capacity && integer(value.remainder) && value.remainder < recoveryInterval;
}

/** Unknown/passive IDs must not become executable cooldown state. Empty maps remain legal before learning. */
export function isGrowthSkills(value: unknown, activeSkillIds: readonly string[]): value is GrowthSkills {
    return record(value, ['readyAt']) && record(value.readyAt) && Object.entries(value.readyAt).every(([id, time]) =>
        validId(id) && activeSkillIds.includes(id) && integer(time));
}
