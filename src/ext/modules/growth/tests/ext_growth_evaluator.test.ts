import { createGrowthRulePolicies } from './legacyRulePolicies';
import { describe, expect, it, vi } from 'vitest';
import data from '../data/definitions.json';
import { evaluateGrowthMagnitude, evaluateGrowthModifiers, evaluateGrowthPhysicalDamage,
    evaluateGrowthPort, growthAttributeModifiers, matchesGrowthConditions, meetsGrowthPrerequisites, roundGrowthValue,
    type GrowthEvaluatedModifier, type GrowthEvaluationFacts, type GrowthScopedModifiers } from '../evaluator';
import { GrowthValidationError, validateGrowthDefinitionPack } from '../schema';
import { growthFocusCapacity } from '../attributes';
import { GROWTH_RULE_PORTS, type GrowthCondition, type GrowthDamageInput, type GrowthDefinitionPack, type GrowthHitInput, type GrowthMagnitude, type GrowthModifier,
    type GrowthPrerequisite, type GrowthRounding, type GrowthRuleActor, type GrowthRuleInput, type GrowthRulePort } from '../types';

const fresh = (): GrowthDefinitionPack => structuredClone(data) as unknown as GrowthDefinitionPack;
const max = Number.MAX_SAFE_INTEGER;
function actor(pack: GrowthDefinitionPack, values: Record<string, number> = {}, level = 1, id = 1): GrowthRuleActor {
    return { id, level, attributes: Object.fromEntries(pack.config.attributes.map(attribute => [attribute.id, values[attribute.id] ?? attribute.initial])) };
}
function input(pack: GrowthDefinitionPack, baseValue = 0, values: Record<string, number> = {}): GrowthRuleInput {
    return { actor: actor(pack, values), target: null, baseValue, actionId: 1, resolutionId: 1, tags: [] };
}
function damage(pack: GrowthDefinitionPack, baseValue = 100): GrowthDamageInput {
    return { ...input(pack, baseValue), target: actor(pack, {}, 1, 2), attackKind: 'melee', damageKind: 'physical', direct: true, immune: false };
}
function hit(pack: GrowthDefinitionPack, baseValue = 5000): GrowthHitInput {
    return { ...input(pack, baseValue), target: actor(pack, {}, 1, 2), attackKind: 'melee', adjacent: true, rollMode: 'roll-probability' };
}
function magnitude(value: number, overrides: Partial<GrowthMagnitude> = {}): GrowthMagnitude {
    return { source: { kind: 'constant' }, coefficient: value, divisor: 1, rounding: 'floor', min: value, max: value, ...overrides };
}
function modifier(port: GrowthRulePort, value: number, conditions: GrowthCondition[] = [], operation: 'add' | 'multiply' = 'add', slot = 'growth.slot.final'): GrowthModifier {
    return { kind: 'modifier', port, operation, slot: operation === 'multiply' ? slot : null, magnitude: magnitude(value), conditions };
}
function effects(...modifiers: GrowthModifier[]): GrowthScopedModifiers[] { return [{ owner: 'actor', modifiers }]; }
function frozen<T>(value: T): T {
    if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
    return value;
}

describe('EXT-1b pure magnitude and prerequisite vocabulary', () => {
    it.each([
        ['floor', 2.6, 2], ['ceil', 2.2, 3], ['nearest', 2.5, 3], ['truncate', 2.8, 2],
        ['floor', -2.2, -3], ['ceil', -2.8, -2], ['nearest', -2.5, -2], ['truncate', -2.8, -2],
    ] as [GrowthRounding, number, number][])('rounds %s(%s) as %s', (rounding, value, expected) => {
        expect(roundGrowthValue(value, rounding)).toBe(expected);
    });
    it('uses constant one, the named attribute, or level, and rounds before magnitude clamps', () => {
        const owner = actor(fresh(), { 'growth.attribute.agility': 7 }, 9);
        expect(evaluateGrowthMagnitude(magnitude(8, { coefficient: 5, divisor: 2, min: -10, max: 10 }), owner)).toBe(2);
        expect(evaluateGrowthMagnitude(magnitude(0, { source: { kind: 'attribute', attributeId: 'growth.attribute.agility' }, coefficient: -1,
            divisor: 3, rounding: 'ceil', min: -2, max: 0 }), owner)).toBe(-2);
        expect(evaluateGrowthMagnitude(magnitude(0, { source: { kind: 'level' }, coefficient: 3, divisor: 2, min: 2, max: 10 }), owner)).toBe(10);
        expect(evaluateGrowthMagnitude(magnitude(0, { coefficient: 0.1, min: 0.25, max: 1 }), owner)).toBe(0.25);
    });
    it('bounds a valid extreme quotient but rejects absent or non-finite source facts and illegal divisor', () => {
        const owner = actor(fresh());
        expect(evaluateGrowthMagnitude(magnitude(0, { coefficient: max, divisor: Number.MIN_VALUE, min: 0, max: 7 }), owner)).toBe(7);
        expect(() => evaluateGrowthMagnitude(magnitude(0, { source: { kind: 'attribute', attributeId: 'missing' } }), owner)).toThrow(RangeError);
        expect(() => evaluateGrowthMagnitude(magnitude(0, { source: { kind: 'level' } }), { ...owner, level: NaN })).toThrow(RangeError);
        for (const divisor of [0, -1, NaN, Infinity]) expect(() => evaluateGrowthMagnitude(magnitude(1, { divisor }), owner)).toThrow(RangeError);
    });
    it('checks all prerequisite variants together using current proposed facts', () => {
        const prerequisites: GrowthPrerequisite[] = [{ kind: 'level', min: 3 }, { kind: 'attribute', attributeId: 'custom.attribute', min: 4 },
            { kind: 'skill', skillId: 'custom.skill' }, { kind: 'profession', professionId: 'custom.profession' },
            { kind: 'lineage', lineageId: 'custom.lineage' }, { kind: 'faith', faithId: 'custom.faith' }];
        const facts = { level: 3, attributes: { 'custom.attribute': 4 }, skills: ['custom.skill'],
            professionId: 'custom.profession', lineageId: 'custom.lineage', faithId: 'custom.faith' };
        expect(meetsGrowthPrerequisites(prerequisites, facts)).toBe(true);
        expect(meetsGrowthPrerequisites(prerequisites, { ...facts, level: 2 })).toBe(false);
        expect(meetsGrowthPrerequisites(prerequisites, { ...facts, attributes: {} })).toBe(false);
        expect(meetsGrowthPrerequisites(prerequisites, { ...facts, skills: [] })).toBe(false);
        expect(meetsGrowthPrerequisites(prerequisites, { ...facts, professionId: null })).toBe(false);
        expect(meetsGrowthPrerequisites(prerequisites, { ...facts, lineageId: null })).toBe(false);
        expect(meetsGrowthPrerequisites(prerequisites, { ...facts, faithId: null })).toBe(false);
        expect(meetsGrowthPrerequisites([], facts)).toBe(true);
    });
});

describe('EXT-1b AND fact conditions', () => {
    const pairs: [GrowthCondition, GrowthEvaluationFacts][] = [
        [{ kind: 'attack-kind', values: ['melee', 'thrown'] }, { attackKind: 'thrown' }],
        [{ kind: 'damage-kind', values: ['physical'] }, { damageKind: 'physical' }],
        [{ kind: 'role', value: 'target' }, { role: 'target' }],
        [{ kind: 'search-mode', value: 'manual' }, { searchMode: 'manual' }],
        [{ kind: 'adjacent', value: false }, { adjacent: false }],
        [{ kind: 'probability-roll', value: true }, { probabilityRoll: true }],
        [{ kind: 'hit', value: true }, { hit: true }],
        [{ kind: 'positive-hp-damage', value: true }, { hpLost: 2 }],
        [{ kind: 'positive-hp-damage', value: false }, { hpLost: 0 }],
        [{ kind: 'direct-damage', value: false }, { directDamage: false }],
        [{ kind: 'tag', tag: 'custom.tag' }, { tags: ['custom.tag'] }],
    ];
    it.each(pairs)('evaluates $0.kind without inventing absent facts', (condition, facts) => {
        expect(matchesGrowthConditions([condition], facts)).toBe(true);
        expect(matchesGrowthConditions([condition], {})).toBe(false);
    });
    it('requires every condition; a hit with shield-only damage is not positive HP damage', () => {
        const conditions: GrowthCondition[] = [{ kind: 'hit', value: true }, { kind: 'positive-hp-damage', value: true }];
        expect(matchesGrowthConditions(conditions, { hit: true, hpLost: 0 })).toBe(false);
        expect(matchesGrowthConditions(conditions, { hit: false, hpLost: 4 })).toBe(false);
        expect(matchesGrowthConditions(conditions, { hit: true, hpLost: 4 })).toBe(true);
        expect(() => matchesGrowthConditions(conditions, { hit: true, hpLost: NaN })).toThrow(RangeError);
        expect(matchesGrowthConditions([], {})).toBe(true);
    });
});

describe('EXT-1b bounded scalar composition', () => {
    it('clamps the summed additive budget once, then applies the slot before the global clamp and rounding', () => {
        const pack = fresh(), rules = pack.config.rules, rule = rules.ports.searchStrength;
        rule.globalClamp.max = 60;
        const modifiers: GrowthEvaluatedModifier[] = [{ operation: 'add', slot: null, magnitude: 50 },
            { operation: 'add', slot: null, magnitude: -20 }, { operation: 'multiply', slot: 'growth.slot.final', magnitude: 2 }];
        expect(evaluateGrowthModifiers(rules, rule, 5, modifiers)).toBe(60);
        rule.globalClamp.max = 100;
        expect(evaluateGrowthModifiers(rules, rule, 5, modifiers)).toBe(70); // (5 + (50 - 20)) * 2
        modifiers[0] = { operation: 'add', slot: null, magnitude: 100 };
        expect(evaluateGrowthModifiers(rules, rule, 5, modifiers)).toBe(90); // (5 + budget cap 40) * 2
    });
    it('composes named-slot factor deltas around one, clamps once, and never uses last-writer or repeated products', () => {
        const pack = fresh(), rules = pack.config.rules, rule = rules.ports.searchStrength;
        const modifiers: GrowthEvaluatedModifier[] = [1.5, 1.5].map(magnitude => ({ operation: 'multiply', slot: 'growth.slot.final', magnitude }));
        expect(evaluateGrowthModifiers(rules, rule, 10, modifiers)).toBe(20);
        expect(evaluateGrowthModifiers(rules, rule, 10, [...modifiers].reverse())).toBe(20);
        expect(evaluateGrowthModifiers(rules, rule, 10, [4, 4].map(magnitude => ({ operation: 'multiply', slot: 'growth.slot.final', magnitude })))).toBe(40);
        expect(evaluateGrowthModifiers(rules, rule, 10, [0, 0].map(magnitude => ({ operation: 'multiply', slot: 'growth.slot.final', magnitude })))).toBe(0);
        rule.multiplierSlots.push({ id: 'custom.slot.second', min: 0, max: 3 });
        expect(evaluateGrowthModifiers(rules, rule, 10, [...modifiers, { operation: 'multiply', slot: 'custom.slot.second', magnitude: 3 }])).toBe(60);
        rule.multiplierSlots[0]!.min = 2;
        expect(evaluateGrowthModifiers(rules, rule, 10, [])).toBe(10); // absent slots remain neutral
    });
    it('preserves configured zero before floors; enforces positive and base-ratio minima', () => {
        const pack = fresh(), rules = pack.config.rules;
        expect(evaluateGrowthModifiers(rules, rules.ports.physicalDamage, 0, [{ operation: 'add', slot: null, magnitude: 2000 }])).toBe(0);
        expect(evaluateGrowthModifiers(rules, rules.ports.physicalDamage, 1, [{ operation: 'add', slot: null, magnitude: -2500 }])).toBe(1);
        expect(evaluateGrowthModifiers(rules, rules.ports.cooldownDuration, 3, [{ operation: 'add', slot: null, magnitude: -9 }])).toBe(3);
        expect(evaluateGrowthModifiers(rules, rules.ports.cooldownDuration, 10, [{ operation: 'add', slot: null, magnitude: -9 }], 8)).toBe(6);
        rules.ports.physicalDamage.preserveZero = false;
        rules.ports.physicalDamage.globalClamp.min = 2;
        expect(evaluateGrowthModifiers(rules, rules.ports.physicalDamage, 0, [])).toBe(2);
    });
    it('keeps fractional positive/base-ratio floors even when rounding down is configured', () => {
        const pack = fresh(), rules = pack.config.rules;
        rules.ports.physicalDamage.minimumPositive = 1.5;
        expect(evaluateGrowthModifiers(rules, rules.ports.physicalDamage, 1, [])).toBe(2);
        rules.ports.cooldownDuration.rounding = 'floor';
        expect(evaluateGrowthModifiers(rules, rules.ports.cooldownDuration, 3, [{ operation: 'add', slot: null, magnitude: -9 }])).toBe(3);
        rules.ports.cooldownDuration.globalClamp.max = 2;
        expect(() => evaluateGrowthModifiers(rules, rules.ports.cooldownDuration, 3, [])).toThrow(RangeError);
    });
    it.each([['floor', 2], ['ceil', 3], ['nearest', 3], ['truncate', 2]] as [GrowthRounding, number][])('supports port rounding %s', (rounding, expected) => {
        const pack = fresh(), rule = pack.config.rules.ports.searchStrength;
        rule.rounding = rounding;
        expect(evaluateGrowthModifiers(pack.config.rules, rule, 2.7, [])).toBe(expected);
    });
    it('keeps fractional bounds integer-feasible after final rounding and rejects an empty integer interval', () => {
        const pack = fresh(), rule = pack.config.rules.ports.searchStrength;
        rule.globalClamp = { min: 1.2, max: 4.8 }; rule.rounding = 'floor';
        expect(evaluateGrowthModifiers(pack.config.rules, rule, 0, [])).toBe(2);
        rule.rounding = 'ceil';
        expect(evaluateGrowthModifiers(pack.config.rules, rule, 9, [])).toBe(4);
        rule.globalClamp = { min: 1.2, max: 1.8 };
        expect(() => evaluateGrowthModifiers(pack.config.rules, rule, 1.5, [])).toThrow(RangeError);
    });
    it('rejects malformed contributions instead of silently using an undeclared slot or non-finite number', () => {
        const pack = fresh(), rule = pack.config.rules.ports.searchStrength;
        for (const entry of [{ operation: 'add', slot: 'growth.slot.final', magnitude: 1 },
            { operation: 'multiply', slot: 'missing', magnitude: 2 }, { operation: 'multiply', slot: 'growth.slot.final', magnitude: -1 },
            { operation: 'add', slot: null, magnitude: NaN }] as GrowthEvaluatedModifier[]) {
            expect(() => evaluateGrowthModifiers(pack.config.rules, rule, 1, [entry])).toThrow(RangeError);
        }
        expect(() => evaluateGrowthModifiers(pack.config.rules, rule, Infinity, [])).toThrow(RangeError);
    });
    it('retains a tiny factor and safely handles an overflowing chain followed by a zero factor', () => {
        const pack = fresh(), rules = pack.config.rules, rule = rules.ports.searchStrength;
        rule.rounding = 'ceil';
        expect(evaluateGrowthModifiers(rules, rule, max, [{ operation: 'multiply', slot: 'growth.slot.final', magnitude: 1e-16 }])).toBe(1);
        rule.multiplierSlots = Array.from({ length: 30 }, (_, index) => ({ id: `custom.slot.s${index}`, min: 0, max }));
        const modifiers: GrowthEvaluatedModifier[] = rule.multiplierSlots.map(slot => ({ operation: 'multiply', slot: slot.id, magnitude: max }));
        modifiers[modifiers.length - 1] = { ...modifiers[modifiers.length - 1]!, magnitude: 0 };
        expect(evaluateGrowthModifiers(rules, rule, max, modifiers)).toBe(0);
    });
});

describe('EXT-1b shared-kernel configuration validation', () => {
    const validate = (pack: GrowthDefinitionPack): void => validateGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    it('accepts changed matching physical kernels, fractionally bounded scalar intervals and custom slot factors', () => {
        const pack = fresh();
        pack.config.rules.ports.physicalDamage.globalClamp.max = 99.8;
        pack.config.rules.ports.physicalDamage.multiplierSlots[0]!.max = 2.5;
        pack.config.rules.ports.receivedPhysicalDamage = structuredClone(pack.config.rules.ports.physicalDamage);
        pack.config.rules.ports.searchStrength.globalClamp = { min: 0.2, max: 7.8 };
        expect(() => validate(pack)).not.toThrow();
    });
    it.each(['additiveMode', 'budgetId', 'multiplierSlots', 'globalClamp', 'rounding', 'preserveZero', 'minimumPositive', 'minimumBaseRatio'] as const)(
        'rejects ambiguous physical direction %s settings', key => {
            const pack = fresh(), received = pack.config.rules.ports.receivedPhysicalDamage;
            switch (key) {
                case 'additiveMode': received.additiveMode = 'flat'; break;
                case 'budgetId': received.budgetId = 'growth.budget.hitchance'; break;
                case 'multiplierSlots': received.multiplierSlots[0]!.max = 3; break;
                case 'globalClamp': received.globalClamp.max = 100; break;
                case 'rounding': received.rounding = 'ceil'; break;
                case 'preserveZero': received.preserveZero = false; break;
                case 'minimumPositive': received.minimumPositive = 2; break;
                case 'minimumBaseRatio': received.minimumBaseRatio = 0.5; break;
            }
            expect(() => validate(pack)).toThrow(GrowthValidationError);
            expect(() => evaluateGrowthPhysicalDamage(pack, damage(pack))).toThrow(RangeError);
        });
    it('rejects empty integer ranges and a positive floor above the last feasible integer', () => {
        const pack = fresh();
        pack.config.rules.ports.searchStrength.globalClamp = { min: 1.2, max: 1.8 };
        expect(() => validate(pack)).toThrow(GrowthValidationError);
        pack.config.rules.ports.searchStrength.globalClamp = { min: 0, max: 1.8 };
        pack.config.rules.ports.searchStrength.minimumPositive = 1.5;
        expect(() => validate(pack)).toThrow(GrowthValidationError);
    });
    it('rejects stealth caps that conflict with the native normal minimum at load and pure evaluation', () => {
        const pack = fresh();
        pack.config.rules.ports.stealthRange.globalClamp.max = 1;
        expect(() => validate(pack)).toThrow(GrowthValidationError);
        const query = { ...input(pack, 1), nativeMinimum: 2, invisible: false };
        expect(() => evaluateGrowthPort(pack, 'stealthRange', query)).toThrow(RangeError);
        expect(evaluateGrowthPort(pack, 'stealthRange', { ...query, invisible: true })).toBe(1);
        pack.config.rules.ports.stealthRange.globalClamp.max = 2;
        expect(() => validate(pack)).not.toThrow();
        expect(evaluateGrowthPort(pack, 'stealthRange', query)).toBe(2);
    });
    it.each(GROWTH_RULE_PORTS)('rejects a negative native %s result domain at load', port => {
        const pack = fresh();
        pack.config.rules.ports[port].globalClamp.min = -1;
        expect(() => validate(pack)).toThrow(GrowthValidationError);
    });
    it('rejects out-of-domain probability and recovery intervals while retaining signed tagged intensity', () => {
        const pack = fresh();
        pack.config.rules.ports.hitChance.globalClamp.max = 10001;
        expect(() => validate(pack)).toThrow(GrowthValidationError);
        pack.config.rules.ports.hitChance.globalClamp.max = 10000;
        pack.config.rules.ports.focusRecoveryInterval.globalClamp.min = 0;
        expect(() => validate(pack)).toThrow(GrowthValidationError);
        pack.config.rules.ports.focusRecoveryInterval.globalClamp.min = 1;
        pack.config.rules.taggedProperties.intensity.globalClamp.min = -5000;
        expect(() => validate(pack)).not.toThrow();
    });
    it('rejects focus resource/port intervals without an integer in their intersection', () => {
        const pack = fresh();
        pack.config.focus.cap = 10;
        pack.config.rules.ports.focusCapacity.globalClamp.min = 10.2;
        expect(() => validate(pack)).toThrow(GrowthValidationError);
        expect(() => evaluateGrowthPort(pack, 'focusCapacity', input(pack, 8))).toThrow(RangeError);
        pack.config.rules.ports.focusCapacity.globalClamp.min = 0;
        pack.config.rules.ports.focusCapacity.minimumPositive = 10.2;
        expect(() => validate(pack)).toThrow(GrowthValidationError);
    });
});

describe('EXT-1b configurable owner-scoped ports', () => {
    it('gives policies and actual resources one focus-capacity value across both configured bound sets', () => {
        const pack = fresh(), validate = (): void => validateGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
        pack.config.focus.cap = 10;
        const query = input(pack, pack.config.focus.base, { 'growth.attribute.will': 8 });
        expect(validate).not.toThrow();
        expect(evaluateGrowthPort(pack, 'focusCapacity', query)).toBe(10);
        expect(createGrowthRulePolicies(pack).focusCapacity(query)).toBe(10);
        expect(growthFocusCapacity(pack, query.actor)).toBe(10);
        pack.config.rules.ports.focusCapacity.globalClamp.max = 9;
        expect(validate).not.toThrow();
        expect(createGrowthRulePolicies(pack).focusCapacity(query)).toBe(9);
        expect(growthFocusCapacity(pack, query.actor)).toBe(9);
        pack.config.focus.min = 5;
        expect(validate).not.toThrow();
        expect(evaluateGrowthPort(pack, 'focusCapacity', input(pack, 8), effects(modifier('focusCapacity', -8)))).toBe(5);
    });
    it('evaluates every default attribute benefit without activating definitions or identity effects', () => {
        const pack = fresh(), policies = createGrowthRulePolicies(pack);
        const values = Object.fromEntries(pack.config.attributes.map(attribute => [attribute.id, attribute.cap]));
        const base = input(pack, 0, values);
        expect(policies.strengthBonus(base)).toBe(4);
        expect(policies.maxHpBonus({ ...base, baseValue: 10 })).toBe(34);
        expect(policies.focusCapacity({ ...base, baseValue: 8 })).toBe(12);
        expect(policies.focusRecoveryInterval({ ...base, baseValue: 8 })).toBe(8);
        expect(policies.searchStrength({ ...base, baseValue: 10, mode: 'manual' })).toBe(26);
        expect(policies.searchStrength({ ...base, baseValue: 10, mode: 'automatic' })).toBe(26);
        expect(policies.stealthRange({ ...base, baseValue: 5, invisible: false, nativeMinimum: 2 })).toBe(3);
        expect(policies.cooldownDuration({ ...base, baseValue: 10, baseCooldown: 10, skillId: 'any.skill' })).toBe(8);
        expect(policies.cooldownDuration({ ...base, baseValue: 3, baseCooldown: 3, skillId: 'any.skill' })).toBe(3);
        expect(policies.hitChance({ ...hit(pack), actor: base.actor })).toBe(5800);
        expect(policies.physicalDamage({ ...damage(pack), actor: base.actor })).toBe(100);
        expect(growthAttributeModifiers(pack)).toHaveLength(pack.config.attributes.reduce((total, attribute) => total + attribute.effects.length, 0));
    });
    it('reads changed coefficients and newly added/removed attribute definitions without attribute-ID branches', () => {
        const pack = fresh();
        const validate = (): void => validateGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
        const perception = pack.config.attributes.find(attribute => attribute.id === 'growth.attribute.perception')!;
        perception.effects[0]!.magnitude.coefficient = 3;
        expect(validate).not.toThrow();
        expect(evaluateGrowthPort(pack, 'searchStrength', input(pack, 10, { [perception.id]: 4 }))).toBe(22);
        pack.config.attributes.push({ ...structuredClone(perception), id: 'custom.attribute.craft', effects: [modifier('searchStrength', 0)] });
        const craft = pack.config.attributes[pack.config.attributes.length - 1]!;
        craft.effects[0]!.magnitude = magnitude(0, { source: { kind: 'attribute', attributeId: craft.id }, coefficient: 2, min: 0, max: 20 });
        expect(validate).not.toThrow();
        expect(evaluateGrowthPort(pack, 'searchStrength', input(pack, 10, { [perception.id]: 4, [craft.id]: 3 }))).toBe(28);
        pack.config.attributes = pack.config.attributes.filter(attribute => attribute.id !== craft.id);
        expect(validate).not.toThrow();
        expect(evaluateGrowthPort(pack, 'searchStrength', input(pack, 10, { [perception.id]: 4 }))).toBe(22);
    });
    it('combines attacker and defender hit effects with each owner’s own attributes and role facts', () => {
        const pack = fresh(), query = hit(pack);
        const withOwners = { ...query, actor: actor(pack, { 'growth.attribute.agility': 8 }), target: actor(pack, { 'growth.attribute.agility': 6 }, 1, 2) };
        expect(evaluateGrowthPort(pack, 'hitChance', withOwners)).toBe(5500);
        expect(evaluateGrowthPort(pack, 'hitChance', { ...withOwners, baseValue: 9400 })).toBe(9500);
        expect(evaluateGrowthPort(pack, 'hitChance', { ...withOwners, baseValue: 0, actor: query.actor })).toBe(500);
        expect(evaluateGrowthPort(pack, 'hitChance', withOwners, [{ owner: 'target', modifiers: [modifier('hitChance', -300,
            [{ kind: 'role', value: 'target' }, { kind: 'adjacent', value: true }, { kind: 'probability-roll', value: true }])] }])).toBe(5200);
    });
    it.each(['skip-guaranteed-hit', 'skip-guaranteed-miss', 'roll-guaranteed'] as const)('preserves %s before probability clamps and effects', rollMode => {
        const pack = fresh(), query = { ...hit(pack, rollMode === 'skip-guaranteed-miss' ? 0 : 10000), rollMode };
        expect(evaluateGrowthPort(pack, 'hitChance', query, effects(modifier('hitChance', -9000)))).toBe(query.baseValue);
    });
    it('never applies target scalar attributes or irrelevant owner-direction damage modifiers', () => {
        const pack = fresh(), values = Object.fromEntries(pack.config.attributes.map(attribute => [attribute.id, attribute.cap]));
        const query = { ...input(pack, 0), target: actor(pack, values, 20, 2) };
        expect(evaluateGrowthPort(pack, 'strengthBonus', query)).toBe(0);
        expect(evaluateGrowthPort(pack, 'searchStrength', query, [{ owner: 'target', modifiers: [modifier('searchStrength', 10)] }])).toBe(0);
        expect(evaluateGrowthPhysicalDamage(pack, damage(pack), [{ owner: 'target', modifiers: [modifier('physicalDamage', 2000)] },
            { owner: 'actor', modifiers: [modifier('receivedPhysicalDamage', -2000)] }])).toBe(100);
    });
    it('preserves invisibility and native stealth minima without changing the native input', () => {
        const pack = fresh(), query = { ...input(pack, 2, { 'growth.attribute.agility': 8 }), nativeMinimum: 2, invisible: false };
        expect(evaluateGrowthPort(pack, 'stealthRange', query)).toBe(2);
        expect(evaluateGrowthPort(pack, 'stealthRange', { ...query, nativeMinimum: 1 })).toBe(1);
        expect(evaluateGrowthPort(pack, 'stealthRange', { ...query, baseValue: 1, invisible: true }, effects(modifier('stealthRange', 5)))).toBe(1);
    });
    it('merges outgoing/received additive damage before one budget and one native-base scale', () => {
        const pack = fresh(), query = damage(pack, 100);
        const scoped: GrowthScopedModifiers[] = [{ owner: 'actor', modifiers: [modifier('physicalDamage', 2000)] },
            { owner: 'target', modifiers: [modifier('receivedPhysicalDamage', -2000)] }];
        expect(evaluateGrowthPhysicalDamage(pack, query, scoped)).toBe(100); // sequential 1.2 * 0.8 would incorrectly be 96
        scoped[0] = { owner: 'actor', modifiers: [modifier('physicalDamage', 5000)] };
        expect(evaluateGrowthPhysicalDamage(pack, query, scoped)).toBe(120); // clamp the combined +3000 to +2000, not each side
        scoped[0] = { owner: 'actor', modifiers: [modifier('physicalDamage', -2000)] };
        expect(evaluateGrowthPhysicalDamage(pack, query, scoped)).toBe(75);
        expect(evaluateGrowthPhysicalDamage(pack, { ...query, baseValue: 1 }, scoped)).toBe(1);
        expect(evaluateGrowthPhysicalDamage(pack, { ...query, baseValue: 0 }, scoped)).toBe(0);
        expect(evaluateGrowthPhysicalDamage(pack, { ...query, baseValue: 0, immune: true }, scoped)).toBe(0);
        expect(evaluateGrowthPhysicalDamage(pack, { ...query, target: null }, scoped)).toBe(80);
    });
    it('merges outgoing/received factors in the same single shared slot', () => {
        const pack = fresh();
        expect(evaluateGrowthPhysicalDamage(pack, damage(pack), [{ owner: 'actor', modifiers: [modifier('physicalDamage', 1.5, [], 'multiply')] },
            { owner: 'target', modifiers: [modifier('receivedPhysicalDamage', 1.5, [], 'multiply')] }])).toBe(200);
    });
    it('filters reusable effect conditions from explicit facts without consuming the source', () => {
        const pack = fresh(), query = { ...input(pack, 10), mode: 'manual' as const, tags: ['custom.survey'] };
        const scoped = effects(modifier('searchStrength', 7, [{ kind: 'tag', tag: 'custom.survey' }, { kind: 'search-mode', value: 'manual' },
            { kind: 'hit', value: true }, { kind: 'positive-hp-damage', value: true }]));
        expect(evaluateGrowthPort(pack, 'searchStrength', query, scoped)).toBe(10);
        expect(evaluateGrowthPort(pack, 'searchStrength', query, scoped, { hit: true, hpLost: 0 })).toBe(10);
        expect(evaluateGrowthPort(pack, 'searchStrength', query, scoped, { hit: true, hpLost: 2 })).toBe(17);
        expect(evaluateGrowthPort(pack, 'searchStrength', { ...query, mode: 'automatic' }, scoped, { hit: true, hpLost: 2 })).toBe(10);
    });
    it('is repeatable on deeply frozen snapshots and never calls RNG, writes components, or activates a skill', () => {
        const pack = frozen(fresh()), query = frozen(damage(pack, 17)), scoped = frozen(effects(modifier('physicalDamage', 1000)));
        const before = JSON.stringify([pack, query, scoped]);
        const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('RNG forbidden'); });
        try {
            const policies = createGrowthRulePolicies(pack);
            for (let repeat = 0; repeat < 10; repeat++) {
                expect(evaluateGrowthPhysicalDamage(pack, query, scoped)).toBe(18);
                expect(policies.physicalDamage(query)).toBe(17);
            }
            expect(random).not.toHaveBeenCalled();
            expect(JSON.stringify([pack, query, scoped])).toBe(before);
        } finally { random.mockRestore(); }
    });
});
