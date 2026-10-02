import { describe, expect, it } from 'vitest';
import data from '../ext/modules/growth/definitions.json';
import { canonical } from '../ext/json';
import type { GrowthDefinitionPack, GrowthSchedule } from '../ext/modules/growth/types';
import { isGrowthDerived, isGrowthFocus, isGrowthProgression, isGrowthSkills } from '../ext/modules/growth/components';
import { addGrowthIntegers, automaticGrowthDerived, automaticMaxHpBonus, createExperienceThresholds, experienceThreshold,
    grantExperience, initialGrowthProgression, levelForExperience, reconcileGrowthMaximum, reconcileGrowthResources,
    recoverGrowthResource, scheduleGrantAtLevel, scheduledGrantTotal, type GrowthResourceInput } from '../ext/modules/growth/experience';

const fresh = (): GrowthDefinitionPack => structuredClone(data) as unknown as GrowthDefinitionPack;
const max = Number.MAX_SAFE_INTEGER;
const resources = (): GrowthResourceInput => ({ hp: 3, maxHp: 20, nextMaxHp: 23, focus: { current: 2, remainder: 5 },
    focusCapacity: 8, nextFocusCapacity: 10, skills: { readyAt: { 'growth.skill.brace': 40, 'growth.skill.sure-strike': 100 } } });

describe('EXT-1a exact config-driven progression math', () => {
    it('builds the frozen accepted default curve by safe integer accumulation', () => {
        const levels = fresh().config.levels, thresholds = createExperienceThresholds(levels);
        expect(Object.isFrozen(thresholds)).toBe(true); expect(thresholds).toHaveLength(levels.cap);
        expect([1, 3, 5, 8, 11, 14, 17, 18, 20].map(level => thresholds[level - 1])).toEqual([0, 160, 480, 1400, 3040, 5616, 9344, 10880, 14440]);
        let total = 0;
        for (let level = 1; level <= levels.cap; level++) {
            expect(experienceThreshold(levels, level)).toBe(total);
            if (level < levels.cap) total += 40 + 20 * level + 4 * level * level;
        }
    });
    it('resolves every cumulative threshold and its adjacent integers without floating boundaries', () => {
        const levels = fresh().config.levels;
        for (let level = 1; level <= levels.cap; level++) {
            const threshold = experienceThreshold(levels, level);
            expect(levelForExperience(levels, threshold)).toBe(level);
            if (level > 1) expect(levelForExperience(levels, threshold - 1)).toBe(level - 1);
            if (level < levels.cap) expect(levelForExperience(levels, threshold + 1)).toBe(level);
        }
    });
    it('aggregates each crossed level once and caps experience before unsafe addition', () => {
        const levels = fresh().config.levels, initial = initialGrowthProgression(levels), before = canonical(initial);
        const jump = grantExperience(levels, initial, experienceThreshold(levels, 8));
        expect(jump).toEqual({ progression: { level: 8, experience: 1400, attributePoints: 7, skillPoints: 4 },
            gainedExperience: 1400, levelsGained: 7, attributePointsGranted: 7, skillPointsGranted: 4, maxHpDelta: 4 });
        const capped = grantExperience(levels, jump.progression, max);
        expect(capped.progression).toEqual({ level: 20, experience: 14440, attributePoints: 19, skillPoints: 10 });
        expect(capped.maxHpDelta).toBe(6); expect(capped.gainedExperience).toBe(13040);
        expect(grantExperience(levels, capped.progression, max)).toEqual({ progression: capped.progression,
            gainedExperience: 0, levelsGained: 0, attributePointsGranted: 0, skillPointsGranted: 0, maxHpDelta: 0 });
        expect(canonical(initial)).toBe(before);
    });
    it('keeps partial-level experience and existing unspent pools', () => {
        const levels = fresh().config.levels;
        const progression = { level: 3, experience: 170, attributePoints: 1, skillPoints: 0 };
        expect(grantExperience(levels, progression, 13).progression).toEqual({ ...progression, experience: 183 });
        expect(grantExperience(levels, progression, experienceThreshold(levels, 4) - 170).progression)
            .toEqual({ level: 4, experience: 296, attributePoints: 2, skillPoints: 1 });
    });
    it('uses alternative cumulative tables, L1 grants, sparse point schedules, and a capped HP schedule', () => {
        const levels = fresh().config.levels;
        levels.cap = 5; levels.experience = { kind: 'table', cumulative: [0, 1, 9, 10, 12] };
        levels.attributePoints = { kind: 'table', grants: [7, 0, 5, 2, 0] };
        levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 3, amount: 4 };
        levels.maxHp = { grants: { kind: 'table', grants: [2, 0, 3, 6, 4] }, cap: 7 };
        expect(createExperienceThresholds(levels)).toEqual([0, 1, 9, 10, 12]);
        const initial = initialGrowthProgression(levels);
        expect(initial).toEqual({ level: 1, experience: 0, attributePoints: 7, skillPoints: 4 });
        expect(automaticGrowthDerived(levels, 1)).toEqual({ appliedStrength: 0, appliedMaxHp: 2 });
        const jump = grantExperience(levels, initial, 10);
        expect(jump).toEqual({ progression: { level: 4, experience: 10, attributePoints: 14, skillPoints: 8 },
            gainedExperience: 10, levelsGained: 3, attributePointsGranted: 7, skillPointsGranted: 4, maxHpDelta: 5 });
        expect(grantExperience(levels, jump.progression, 2).maxHpDelta).toBe(0);
    });
    it.each([
        { kind: 'periodic', firstLevel: 3, every: 4, amount: 9 },
        { kind: 'periodic', firstLevel: 1, every: 1, amount: 0 },
        { kind: 'table', grants: [3, 2, 0, 7, 5, 0, 1, 3, 8, 0] },
    ] as GrowthSchedule[])('matches grant-by-grant accumulation for $kind', schedule => {
        let sum = 0; expect(scheduledGrantTotal(schedule, 0)).toBe(0);
        for (let level = 1; level <= 10; level++) {
            sum += scheduleGrantAtLevel(schedule, level);
            expect(scheduledGrantTotal(schedule, level)).toBe(sum);
        }
    });
    it('handles a one-level pack without XP cost, level-up or division by zero', () => {
        const levels = fresh().config.levels;
        levels.cap = 1; levels.experience = { kind: 'curve', base: 0, linear: 0, quadratic: 0 };
        levels.attributePoints = levels.skillPoints = levels.maxHp.grants = { kind: 'table', grants: [2] };
        expect(createExperienceThresholds(levels)).toEqual([0]);
        expect(levelForExperience(levels, 0)).toBe(1);
        expect(grantExperience(levels, initialGrowthProgression(levels), max)).toMatchObject({ gainedExperience: 0, levelsGained: 0, maxHpDelta: 0 });
    });
    it('uses exact arithmetic close to the safe-integer limit for both tables and curves', () => {
        const levels = fresh().config.levels; levels.cap = 3;
        levels.experience = { kind: 'table', cumulative: [0, max - 1, max] };
        expect(levelForExperience(levels, max - 2)).toBe(1);
        expect(levelForExperience(levels, max - 1)).toBe(2);
        expect(levelForExperience(levels, max)).toBe(3);
        expect(grantExperience(levels, { level: 2, experience: max - 1, attributePoints: 1, skillPoints: 1 }, max).progression.experience).toBe(max);
        levels.experience = { kind: 'curve', base: 0, linear: 0, quadratic: 1801439850948198 };
        expect(createExperienceThresholds(levels)).toEqual([0, 1801439850948198, max - 1]);
        expect(levelForExperience(levels, max - 2)).toBe(2);
        expect(levelForExperience(levels, max - 1)).toBe(3);
        levels.experience.quadratic++;
        expect(() => experienceThreshold(levels, 3)).toThrow(RangeError);
    });
    it('supports valid huge constant-cost scalar queries without allocating a gigantic array', () => {
        const levels = fresh().config.levels; levels.cap = max;
        levels.experience = { kind: 'curve', base: 1, linear: 0, quadratic: 0 };
        expect(experienceThreshold(levels, max)).toBe(max - 1);
        expect(levelForExperience(levels, max - 2)).toBe(max - 1);
        expect(levelForExperience(levels, max - 1)).toBe(max);
        expect(scheduledGrantTotal({ kind: 'periodic', firstLevel: 1, every: 1, amount: 1 }, max)).toBe(max);
        expect(() => createExperienceThresholds(levels)).toThrow(/array length/);
    });
    it('rejects unsafe grants and totals before returning a partial progression proposal', () => {
        const levels = fresh().config.levels, initial = initialGrowthProgression(levels);
        for (const amount of [-1, 0.5, Infinity, NaN, max + 1]) expect(() => grantExperience(levels, initial, amount)).toThrow(RangeError);
        expect(() => grantExperience(levels, { ...initial, level: 2 }, 1)).toThrow(/disagree/);
        expect(() => grantExperience(levels, { ...initial, attributePoints: max }, 64)).toThrow(/overflow/);
        expect(() => scheduledGrantTotal({ kind: 'periodic', firstLevel: 1, every: 1, amount: max }, 2)).toThrow(/overflow/);
        expect(() => scheduledGrantTotal({ kind: 'table', grants: [max, 1] }, 2)).toThrow(/overflow/);
        expect(() => addGrowthIntegers(max, 1)).toThrow(/overflow/);
        expect(() => levelForExperience(levels, 14441)).toThrow(/cap/);
        expect(() => experienceThreshold(levels, 0)).toThrow(); expect(() => experienceThreshold(levels, 21)).toThrow();
        levels.experience = { kind: 'table', cumulative: [0, 0] }; levels.cap = 2;
        expect(() => createExperienceThresholds(levels)).toThrow(/increase/);
    });
});

describe('EXT-1a strict serialized growth components', () => {
    it('accepts exact progression including cap, and rejects every inconsistent or extra field', () => {
        const levels = fresh().config.levels, progression = initialGrowthProgression(levels);
        expect(isGrowthProgression(progression, levels)).toBe(true);
        expect(isGrowthProgression(grantExperience(levels, progression, max).progression, levels)).toBe(true);
        for (const bad of [null, [], {}, { ...progression, level: 2 }, { ...progression, experience: 64 },
            { ...progression, attributePoints: -1 }, { ...progression, skillPoints: 0.1 }, { ...progression, experience: max + 1 },
            { ...progression, level: 20, experience: 14441 }, { ...progression, extra: true },
            { ...progression, skillPoints: Infinity }, { ...progression, attributePoints: NaN }]) expect(isGrowthProgression(bad, levels)).toBe(false);
        for (const key of Object.keys(progression)) {
            const missing: Record<string, number> = { ...progression }; delete missing[key];
            expect(isGrowthProgression(missing, levels)).toBe(false);
        }
    });
    it('rejects foreign prototypes, prototype keys, nonenumerable/symbol fields and accessors without invoking them', () => {
        const levels = fresh().config.levels, progression = initialGrowthProgression(levels);
        expect(isGrowthProgression(Object.assign(Object.create(null), progression), levels)).toBe(true);
        const inherited = Object.assign(Object.create({ injected: true }), progression);
        const symbol = { ...progression, [Symbol('extra')]: 1 };
        const hidden = Object.defineProperty({ ...progression }, 'hidden', { value: 1 });
        const prototype = JSON.parse(JSON.stringify(progression).replace('"level":1', '"level":1,"__proto__":{}'));
        let calls = 0;
        const accessor = Object.defineProperty({ ...progression }, 'experience', { enumerable: true, get: () => { calls++; return 0; } });
        for (const bad of [inherited, symbol, hidden, prototype, accessor]) expect(isGrowthProgression(bad, levels)).toBe(false);
        expect(calls).toBe(0);
    });
    it('checks derived bonuses against independently calculated state and never stores a second HP pool', () => {
        const levels = fresh().config.levels, expected = automaticGrowthDerived(levels, 8);
        expect(expected).toEqual({ appliedStrength: 0, appliedMaxHp: 4 }); expect(isGrowthDerived(expected, expected)).toBe(true);
        for (const bad of [{ ...expected, appliedMaxHp: 5 }, { ...expected, appliedStrength: 1 }, { ...expected, hp: 20 },
            { ...expected, appliedMaxHp: max + 1 }, { ...expected, appliedMaxHp: -1 }, { appliedMaxHp: 4 }]) expect(isGrowthDerived(bad, expected)).toBe(false);
    });
    it('bounds focus and its fractional recovery carry using runtime capacity and interval', () => {
        expect(isGrowthFocus({ current: 8, remainder: 7 }, 8, 8)).toBe(true);
        for (const value of [{ current: 9, remainder: 0 }, { current: 1, remainder: 8 }, { current: 1, remainder: -1 },
            { current: 0.5, remainder: 0 }, { current: 1, remainder: 1, maximum: 8 }, { current: 1 }]) expect(isGrowthFocus(value, 8, 8)).toBe(false);
        expect(isGrowthFocus({ current: 0, remainder: 0 }, 0, 1)).toBe(true);
        expect(isGrowthFocus({ current: 1, remainder: 0 }, 8, 0)).toBe(false);
    });
    it('allows only declared active skill IDs with safe cooldown deadlines', () => {
        const ids = ['growth.skill.brace', 'growth.skill.sure-strike'];
        expect(isGrowthSkills({ readyAt: {} }, ids)).toBe(true);
        expect(isGrowthSkills({ readyAt: { 'growth.skill.brace': max } }, ids)).toBe(true);
        for (const value of [{}, { readyAt: [] }, { readyAt: { 'growth.skill.unknown': 1 } }, { readyAt: { 'growth.skill.brace': -1 } },
            { readyAt: { 'growth.skill.brace': 1.1 } }, { readyAt: { 'growth.skill.brace': max + 1 } }, { readyAt: {}, slots: [] },
            { readyAt: JSON.parse('{"__proto__":1}') }]) expect(isGrowthSkills(value, ids)).toBe(false);
    });
});

describe('EXT-1a pure derived/resource commit basis', () => {
    it('keeps native life-potion gains and makes repeated bonus synchronization idempotent', () => {
        const levels = fresh().config.levels;
        const bonus = automaticMaxHpBonus(levels, 8);
        expect(reconcileGrowthMaximum(30, 0, bonus)).toBe(34);
        expect(reconcileGrowthMaximum(34, bonus, bonus)).toBe(34);
        expect(reconcileGrowthMaximum(34, bonus, 2)).toBe(32);
        expect(reconcileGrowthMaximum(max, max - 1, max - 1)).toBe(max);
        expect(() => reconcileGrowthMaximum(max, 0, 1)).toThrow(/overflow/);
        expect(() => reconcileGrowthMaximum(1, 2, 0)).toThrow();
        expect(() => reconcileGrowthMaximum(1, 2, 3)).toThrow();
    });
    it.each(['none', 'increase', 'full'] as const)('applies configured %s level recovery to health and focus without mutating inputs', policy => {
        const { levels, focus } = fresh().config, input = resources(), before = canonical(input);
        levels.recovery.levelHp = policy; levels.recovery.levelFocus = policy;
        const result = reconcileGrowthResources(levels, focus, 'level', input);
        expect(result.hp).toBe(policy === 'none' ? 3 : policy === 'increase' ? 6 : 23);
        expect(result.focus.current).toBe(policy === 'none' ? 2 : policy === 'increase' ? 4 : 10);
        expect(result.focus.remainder).toBe(policy === 'full' ? 0 : 5);
        expect(result.skills).toEqual(input.skills); expect(result.skills).not.toBe(input.skills);
        expect(result.skills.readyAt).not.toBe(input.skills.readyAt); expect(canonical(input)).toBe(before);
    });
    it('obeys allocation recovery and resets existing cooldowns only for the configured reason', () => {
        const { levels, focus } = fresh().config, input = resources();
        levels.recovery.allocationHp = 'increase'; levels.recovery.allocationFocus = 'full'; levels.recovery.clearCooldownOnAllocation = true;
        expect(reconcileGrowthResources(levels, focus, 'allocation', input)).toEqual({ hp: 6, maxHp: 23,
            focus: { current: 10, remainder: 0 }, skills: { readyAt: { 'growth.skill.brace': 0, 'growth.skill.sure-strike': 0 } } });
        expect(reconcileGrowthResources(levels, focus, 'level', input).skills).toEqual(input.skills);
        levels.recovery.clearCooldownOnLevel = true;
        expect(Object.values(reconcileGrowthResources(levels, focus, 'level', input).skills.readyAt)).toEqual([0, 0]);
    });
    it('clamps a reduced maximum without extra healing and optionally preserves carry at full focus', () => {
        const { levels, focus } = fresh().config, input = resources();
        input.hp = 18; input.nextMaxHp = 12; input.focus = { ...input.focus, current: 7 }; input.nextFocusCapacity = 4;
        for (const policy of ['none', 'increase', 'full'] as const) {
            levels.recovery.levelHp = policy; levels.recovery.levelFocus = policy;
            expect(reconcileGrowthResources(levels, focus, 'level', input)).toMatchObject({ hp: 12, focus: { current: 4, remainder: 0 } });
        }
        focus.resetRemainderWhenFull = false;
        expect(reconcileGrowthResources(levels, focus, 'level', input).focus.remainder).toBe(5);
    });
    it('performs creation healing only when requested by configuration', () => {
        const { levels, focus } = fresh().config, input = resources();
        expect(reconcileGrowthResources(levels, focus, 'creation', input)).toMatchObject({ hp: 23, focus: input.focus, skills: input.skills });
        levels.recovery.creationHp = 'native';
        expect(reconcileGrowthResources(levels, focus, 'creation', input).hp).toBe(3);
    });
    it.each(['level', 'allocation', 'creation'] as const)('never revives a dead creature during %s', reason => {
        const { levels, focus } = fresh().config, input = resources(); input.hp = 0;
        levels.recovery.levelHp = levels.recovery.allocationHp = levels.recovery.creationHp = 'full';
        expect(reconcileGrowthResources(levels, focus, reason, input).hp).toBe(0);
        levels.recovery.levelHp = levels.recovery.allocationHp = 'increase';
        expect(reconcileGrowthResources(levels, focus, reason, input).hp).toBe(0);
    });
    it('recovers exactly near integer limits and rejects invalid native resource bounds', () => {
        expect(recoverGrowthResource(max - 2, max - 1, max, 'increase')).toBe(max - 1);
        expect(recoverGrowthResource(1, 1, max, 'increase')).toBe(max);
        expect(() => recoverGrowthResource(2, 1, 3, 'none')).toThrow();
        expect(() => recoverGrowthResource(1, 1, max + 1, 'full')).toThrow();
    });
});
