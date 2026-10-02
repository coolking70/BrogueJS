import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack, GrowthSchedule } from './types';
import type { GrowthDerived, GrowthFocus, GrowthProgression, GrowthSkills } from './components';

export type GrowthLevelsConfig = DeepReadonly<GrowthDefinitionPack['config']['levels']>;
export type GrowthFocusConfig = DeepReadonly<GrowthDefinitionPack['config']['focus']>;
export type GrowthRecoveryPolicy = GrowthLevelsConfig['recovery']['levelHp'];
const MAX = BigInt(Number.MAX_SAFE_INTEGER);

function integer(value: number, minimum = 0): void {
    if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError('Growth requires a safe integer within bounds');
}
function safe(value: bigint): number {
    if (value < 0n || value > MAX) throw new RangeError('Growth integer overflow');
    return Number(value);
}
/** Add only after checking the exact integer result; never round a save boundary. */
export function addGrowthIntegers(left: number, right: number): number {
    integer(left); integer(right); return safe(BigInt(left) + BigInt(right));
}
function levelBounds(levels: GrowthLevelsConfig, level: number): void {
    integer(levels.cap, 1); integer(level, 1);
    if (level > levels.cap) throw new RangeError('Growth level exceeds the configured cap');
}

/** T(level), with T(1)=0. Curve costs leaving L are base + linear*L + quadratic*L².
 * BigInt keeps the accepted formula exact even when its intermediate products exceed MAX_SAFE_INTEGER.
 * The scalar path also avoids allocating a cap-sized table for a large, valid constant-cost curve. */
export function experienceThreshold(levels: GrowthLevelsConfig, level: number): number {
    levelBounds(levels, level);
    const xp = levels.experience;
    if (xp.kind === 'table') {
        if (xp.cumulative.length !== levels.cap || xp.cumulative[0] !== 0) throw new RangeError('Invalid growth experience table');
        const amount = xp.cumulative[level - 1]!; integer(amount);
        if (level > 1 && amount <= xp.cumulative[level - 2]!) throw new RangeError('Growth thresholds must increase');
        return amount;
    }
    integer(xp.base); integer(xp.linear); integer(xp.quadratic);
    if (levels.cap > 1 && xp.base === 0 && xp.linear === 0 && xp.quadratic === 0) throw new RangeError('Growth costs must be positive');
    const n = BigInt(level - 1);
    return safe(n * BigInt(xp.base) + BigInt(xp.linear) * n * (n + 1n) / 2n
        + BigInt(xp.quadratic) * n * (n + 1n) * (2n * n + 1n) / 6n);
}

/** Optional frozen display/test table, indexed by level - 1. Runtime queries need no materialization. */
export function createExperienceThresholds(levels: GrowthLevelsConfig): readonly number[] {
    // Reject impossible JS array lengths before iterating; this is a representation limit, not a balance cap.
    levelBounds(levels, levels.cap);
    if (levels.cap > 0xffffffff) throw new RangeError('Growth threshold table exceeds the array length limit');
    const thresholds: number[] = [0];
    experienceThreshold(levels, levels.cap);
    const xp = levels.experience;
    for (let level = 1; level < levels.cap; level++) {
        const threshold = xp.kind === 'table' ? experienceThreshold(levels, level + 1)
            : safe(BigInt(thresholds[level - 1]!) + BigInt(xp.base) + BigInt(xp.linear) * BigInt(level)
                + BigInt(xp.quadratic) * BigInt(level) * BigInt(level));
        if (threshold <= thresholds[level - 1]!) throw new RangeError('Growth thresholds must increase');
        thresholds.push(threshold);
    }
    return Object.freeze(thresholds);
}

/** Lookup accepts only the capped cumulative XP persisted in a progression component. */
export function levelForExperience(levels: GrowthLevelsConfig, experience: number): number {
    integer(experience);
    if (experience > experienceThreshold(levels, levels.cap)) throw new RangeError('Growth experience exceeds the configured cap');
    let low = 1, high = levels.cap;
    while (low < high) {
        const middle = low + Math.ceil((high - low) / 2);
        if (experienceThreshold(levels, middle) <= experience) low = middle;
        else high = middle - 1;
    }
    return low;
}

export function scheduleGrantAtLevel(schedule: DeepReadonly<GrowthSchedule>, level: number): number {
    integer(level, 1);
    if (schedule.kind === 'table') {
        if (level > schedule.grants.length) throw new RangeError('Growth schedule has no entry for this level');
        const grant = schedule.grants[level - 1]!; integer(grant); return grant;
    }
    integer(schedule.firstLevel, 1); integer(schedule.every, 1); integer(schedule.amount);
    return level >= schedule.firstLevel && (level - schedule.firstLevel) % schedule.every === 0 ? schedule.amount : 0;
}

/** Includes a configured L1 grant; zero is accepted for the empty prefix. */
export function scheduledGrantTotal(schedule: DeepReadonly<GrowthSchedule>, level: number): number {
    integer(level);
    if (schedule.kind === 'table') {
        if (level > schedule.grants.length) throw new RangeError('Growth schedule has no entry for this level');
        let total = 0n;
        for (let index = 0; index < level; index++) { integer(schedule.grants[index]!); total += BigInt(schedule.grants[index]!); }
        return safe(total);
    }
    integer(schedule.firstLevel, 1); integer(schedule.every, 1); integer(schedule.amount);
    if (level < schedule.firstLevel) return 0;
    const count = (BigInt(level) - BigInt(schedule.firstLevel)) / BigInt(schedule.every) + 1n;
    return safe(count * BigInt(schedule.amount));
}

export function automaticMaxHpBonus(levels: GrowthLevelsConfig, level: number): number {
    levelBounds(levels, level); integer(levels.maxHp.cap);
    return Math.min(levels.maxHp.cap, scheduledGrantTotal(levels.maxHp.grants, level));
}

export function initialGrowthProgression(levels: GrowthLevelsConfig): GrowthProgression {
    experienceThreshold(levels, levels.cap);
    return { level: 1, experience: 0, attributePoints: scheduleGrantAtLevel(levels.attributePoints, 1),
        skillPoints: scheduleGrantAtLevel(levels.skillPoints, 1) };
}

export type GrowthExperienceResult = {
    progression: GrowthProgression; gainedExperience: number; levelsGained: number;
    attributePointsGranted: number; skillPointsGranted: number; maxHpDelta: number;
};
/** Pure reward proposal. The engine commits it at a safe boundary together with derived/resource changes. */
export function grantExperience(levels: GrowthLevelsConfig, progression: Readonly<GrowthProgression>, amount: number): GrowthExperienceResult {
    integer(amount); integer(progression.attributePoints); integer(progression.skillPoints);
    if (levelForExperience(levels, progression.experience) !== progression.level) throw new RangeError('Growth level and experience disagree');
    const remaining = experienceThreshold(levels, levels.cap) - progression.experience;
    // Clamp before adding: amount + experience is allowed to exceed MAX_SAFE_INTEGER mathematically.
    const gainedExperience = Math.min(remaining, amount), experience = addGrowthIntegers(progression.experience, gainedExperience);
    const level = levelForExperience(levels, experience);
    // Prefix differences are exactly equivalent to granting every crossed level in ascending order.
    const attributePointsGranted = scheduledGrantTotal(levels.attributePoints, level) - scheduledGrantTotal(levels.attributePoints, progression.level);
    const skillPointsGranted = scheduledGrantTotal(levels.skillPoints, level) - scheduledGrantTotal(levels.skillPoints, progression.level);
    return { progression: { level, experience, attributePoints: addGrowthIntegers(progression.attributePoints, attributePointsGranted),
        skillPoints: addGrowthIntegers(progression.skillPoints, skillPointsGranted) }, gainedExperience,
        levelsGained: level - progression.level, attributePointsGranted, skillPointsGranted,
        maxHpDelta: automaticMaxHpBonus(levels, level) - automaticMaxHpBonus(levels, progression.level) };
}

/** Reconcile the previously applied bonus without overwriting native gains (e.g. life potions). */
export function reconcileGrowthMaximum(nativeMaximum: number, previousBonus: number, nextBonus: number): number {
    integer(nativeMaximum, 1); integer(previousBonus); integer(nextBonus);
    const nativeBase = BigInt(nativeMaximum) - BigInt(previousBonus);
    if (nativeBase < 1n) throw new RangeError('Growth reconciliation would erase the native maximum');
    return safe(nativeBase + BigInt(nextBonus));
}

export function recoverGrowthResource(current: number, previousMaximum: number, nextMaximum: number, policy: GrowthRecoveryPolicy): number {
    integer(current); integer(previousMaximum); integer(nextMaximum);
    if (current > previousMaximum) throw new RangeError('Growth resource exceeds its maximum');
    if (policy === 'full') return nextMaximum;
    if (policy === 'none') return Math.min(current, nextMaximum);
    if (policy !== 'increase') throw new RangeError('Unknown growth recovery policy');
    const increase = Math.max(0, nextMaximum - previousMaximum);
    return safe(BigInt(current) + BigInt(increase) > BigInt(nextMaximum) ? BigInt(nextMaximum) : BigInt(current) + BigInt(increase));
}

export type GrowthResourceInput = {
    hp: number; maxHp: number; nextMaxHp: number;
    focus: Readonly<GrowthFocus>; focusCapacity: number; nextFocusCapacity: number;
    skills: Readonly<GrowthSkills>;
};
export type GrowthResourceResult = { hp: number; maxHp: number; focus: GrowthFocus; skills: GrowthSkills };
/** Generic resource/cooldown commit basis, not an attribute evaluator or skill executor.
 * Even a configured full recovery cannot resurrect a dead creature. */
export function reconcileGrowthResources(levels: GrowthLevelsConfig, focusConfig: GrowthFocusConfig,
    reason: 'level' | 'allocation' | 'creation', input: Readonly<GrowthResourceInput>): GrowthResourceResult {
    integer(input.hp); integer(input.maxHp, 1); integer(input.nextMaxHp, 1); integer(input.focus.remainder);
    if (input.hp > input.maxHp) throw new RangeError('Growth health exceeds its maximum');
    const recovery = levels.recovery;
    const hpPolicy = reason === 'creation' ? recovery.creationHp === 'full' ? 'full' : 'none'
        : reason === 'level' ? recovery.levelHp : recovery.allocationHp;
    const focusPolicy = reason === 'creation' ? 'none' : reason === 'level' ? recovery.levelFocus : recovery.allocationFocus;
    const current = recoverGrowthResource(input.focus.current, input.focusCapacity, input.nextFocusCapacity, focusPolicy);
    const clear = reason === 'level' ? recovery.clearCooldownOnLevel : reason === 'allocation' && recovery.clearCooldownOnAllocation;
    const readyAt: Record<string, number> = {};
    for (const [skillId, time] of Object.entries(input.skills.readyAt).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
        integer(time); readyAt[skillId] = clear ? 0 : time;
    }
    return { hp: input.hp === 0 ? 0 : recoverGrowthResource(input.hp, input.maxHp, input.nextMaxHp, hpPolicy), maxHp: input.nextMaxHp,
        focus: { current, remainder: current === input.nextFocusCapacity && focusConfig.resetRemainderWhenFull ? 0 : input.focus.remainder },
        skills: { readyAt } };
}

/** Phase 1a only applies the configured automatic maximum-health schedule. */
export function automaticGrowthDerived(levels: GrowthLevelsConfig, level: number): GrowthDerived {
    return { appliedStrength: 0, appliedMaxHp: automaticMaxHpBonus(levels, level) };
}
