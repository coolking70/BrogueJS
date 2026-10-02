import type { DeepReadonly } from './definitions';
import type { GrowthBounds, GrowthCondition, GrowthDamageInput, GrowthDefinitionPack, GrowthHitInput, GrowthMagnitude,
    GrowthModifier, GrowthPrerequisite, GrowthRounding, GrowthRuleActor, GrowthRuleConfig, GrowthRuleInput,
    GrowthRulePolicies, GrowthRulePort } from './types';

export type GrowthEvaluationPack = DeepReadonly<GrowthDefinitionPack>;
export type GrowthEvaluationOwner = 'actor' | 'target';
/** Finite, already-known facts only. A missing fact never satisfies even a false condition. */
export interface GrowthEvaluationFacts {
    readonly role?: GrowthEvaluationOwner;
    readonly attackKind?: 'melee' | 'thrown' | 'bolt' | 'reprisal' | 'other';
    readonly damageKind?: 'physical' | 'fire' | 'poison' | 'other';
    readonly searchMode?: 'manual' | 'automatic';
    readonly adjacent?: boolean;
    readonly probabilityRoll?: boolean;
    readonly hit?: boolean;
    readonly hpLost?: number;
    readonly directDamage?: boolean;
    readonly tags?: readonly string[];
}
/** Explicitly supplied active modifiers, not skill/identity activation or a mutable effect store. */
export interface GrowthScopedModifiers {
    readonly owner: GrowthEvaluationOwner;
    readonly modifiers: readonly DeepReadonly<GrowthModifier>[];
}
export interface GrowthEvaluatedModifier {
    readonly operation: 'add' | 'multiply';
    readonly slot: string | null;
    readonly magnitude: number;
}
export type GrowthEvaluationInput = Readonly<GrowthRuleInput> & {
    readonly attackKind?: GrowthEvaluationFacts['attackKind'];
    readonly damageKind?: GrowthEvaluationFacts['damageKind'];
    readonly adjacent?: boolean;
    readonly rollMode?: GrowthHitInput['rollMode'];
    readonly direct?: boolean;
    readonly immune?: boolean;
    readonly mode?: GrowthEvaluationFacts['searchMode'];
    readonly nativeMinimum?: number;
    readonly invisible?: boolean;
    readonly baseCooldown?: number;
};
export interface GrowthPrerequisiteFacts {
    readonly level: number;
    readonly attributes: Readonly<Record<string, number>>;
    readonly skills?: readonly string[];
    readonly professionId?: string | null;
    readonly lineageId?: string | null;
    readonly faithId?: string | null;
}

function finite(value: number): number {
    if (!Number.isFinite(value)) throw new RangeError('Growth evaluation requires finite numbers');
    return value;
}
function clamp(value: number, bounds: DeepReadonly<GrowthBounds>): number {
    finite(bounds.min); finite(bounds.max);
    if (bounds.min > bounds.max || Number.isNaN(value)) throw new RangeError('Invalid growth evaluation bounds');
    return Math.max(bounds.min, Math.min(bounds.max, value));
}
export function roundGrowthValue(value: number, rounding: GrowthRounding): number {
    if (Number.isNaN(value)) throw new RangeError('Invalid growth scalar');
    switch (rounding) {
        case 'floor': return Math.floor(value);
        case 'ceil': return Math.ceil(value);
        case 'nearest': return Math.round(value);
        case 'truncate': return Math.trunc(value);
        default: throw new RangeError('Unknown growth rounding');
    }
}

/** clamp(round(source * coefficient / divisor), min, max), without ID-specific arithmetic. */
export function evaluateGrowthMagnitude(magnitude: DeepReadonly<GrowthMagnitude>, owner: Readonly<GrowthRuleActor>): number {
    finite(magnitude.coefficient); finite(magnitude.divisor);
    if (magnitude.divisor <= 0) throw new RangeError('Growth magnitude divisor must be positive');
    let source: number;
    switch (magnitude.source.kind) {
        case 'constant': source = 1; break;
        case 'attribute': source = owner.attributes[magnitude.source.attributeId]!; break;
        case 'level': source = owner.level; break;
        default: throw new RangeError('Unknown growth magnitude source');
    }
    finite(source);
    // An overflowing quotient is safely saturated by the declared magnitude bounds.
    return clamp(roundGrowthValue(source * magnitude.coefficient / magnitude.divisor, magnitude.rounding), magnitude);
}

export function matchesGrowthConditions(conditions: readonly DeepReadonly<GrowthCondition>[], facts: GrowthEvaluationFacts): boolean {
    if (facts.hpLost !== undefined) finite(facts.hpLost);
    return conditions.every(condition => {
        switch (condition.kind) {
            case 'attack-kind': return facts.attackKind !== undefined && condition.values.includes(facts.attackKind);
            case 'damage-kind': return facts.damageKind !== undefined && condition.values.includes(facts.damageKind);
            case 'role': return facts.role === condition.value;
            case 'search-mode': return facts.searchMode === condition.value;
            case 'adjacent': return facts.adjacent === condition.value;
            case 'probability-roll': return facts.probabilityRoll === condition.value;
            case 'hit': return facts.hit === condition.value;
            case 'positive-hp-damage': return facts.hpLost !== undefined && (facts.hpLost > 0) === condition.value;
            case 'direct-damage': return facts.directDamage === condition.value;
            case 'tag': return facts.tags?.includes(condition.tag) === true;
            default: throw new RangeError('Unknown growth condition');
        }
    });
}

/** Reusable attribute lookup. The caller decides which owner is relevant to the current port. */
export function growthAttributeModifiers(pack: GrowthEvaluationPack): readonly DeepReadonly<GrowthModifier>[] {
    return pack.config.attributes.flatMap(attribute => attribute.effects);
}

/** Only a proposal: this helper neither learns a skill nor grants identity prerequisite waivers. */
export function meetsGrowthPrerequisites(prerequisites: readonly DeepReadonly<GrowthPrerequisite>[], facts: GrowthPrerequisiteFacts): boolean {
    finite(facts.level);
    return prerequisites.every(prerequisite => {
        switch (prerequisite.kind) {
            case 'level': return facts.level >= prerequisite.min;
            case 'attribute': {
                const value = facts.attributes[prerequisite.attributeId];
                return value !== undefined && finite(value) >= prerequisite.min;
            }
            case 'skill': return facts.skills?.includes(prerequisite.skillId) === true;
            case 'profession': return facts.professionId === prerequisite.professionId;
            case 'lineage': return facts.lineageId === prerequisite.lineageId;
            case 'faith': return facts.faithId === prerequisite.faithId;
            default: throw new RangeError('Unknown growth prerequisite');
        }
    });
}

/** Pure scalar kernel, also reusable by later bounded tagged-property evaluation.
 * Factors sharing a named slot compose as 1 + sum(factor - 1), are clamped once, and multiply once.
 * Absent slots have neutral factor 1; they do not apply an otherwise non-neutral slot minimum.
 * This preserves all contributions, independent of last-writer ordering or repeated multiplication. */
export function evaluateGrowthModifiers(rules: GrowthEvaluationPack['config']['rules'], rule: DeepReadonly<GrowthRuleConfig>,
    baseValue: number, modifiers: readonly GrowthEvaluatedModifier[], baseRatioValue = baseValue): number {
    finite(baseValue); finite(baseRatioValue);
    const budget = rules.budgets.find(candidate => candidate.id === rule.budgetId);
    if (!budget) throw new RangeError('Unknown growth additive budget');
    const slots = new Map(rule.multiplierSlots.map(slot => [slot.id, slot]));
    const factors = new Map<string, number>();
    let additive = 0;
    for (const modifier of modifiers) {
        finite(modifier.magnitude);
        if (modifier.operation === 'add') {
            if (modifier.slot !== null) throw new RangeError('An additive growth modifier cannot use a multiplier slot');
            additive += modifier.magnitude;
        } else if (modifier.operation === 'multiply') {
            if (modifier.slot === null || !slots.has(modifier.slot) || modifier.magnitude < 0) throw new RangeError('Invalid growth multiplier slot');
            const previous = factors.get(modifier.slot);
            factors.set(modifier.slot, previous === undefined ? modifier.magnitude : previous + (modifier.magnitude - 1));
        } else throw new RangeError('Unknown growth modifier operation');
    }
    if (rule.preserveZero && baseValue === 0) return 0;
    let value = baseValue, minimum = rule.globalClamp.min;
    for (const operation of rules.order) {
        switch (operation) {
            case 'add': {
                const amount = clamp(additive, budget);
                value = rule.additiveMode === 'flat' ? value + amount : value + baseValue * amount / 10000;
                break;
            }
            case 'multiply':
                for (const slot of rule.multiplierSlots) {
                    const factor = factors.get(slot.id);
                    if (factor !== undefined) {
                        const bounded = clamp(factor, slot);
                        value = bounded === 0 ? 0 : value * bounded;
                    }
                }
                break;
            case 'global-clamp': {
                if (baseValue > 0 && rule.minimumPositive !== null) minimum = Math.max(minimum, finite(rule.minimumPositive));
                if (baseRatioValue > 0 && rule.minimumBaseRatio !== null) minimum = Math.max(minimum, baseRatioValue * finite(rule.minimumBaseRatio));
                value = Math.max(value, minimum);
                value = clamp(value, rule.globalClamp);
                break;
            }
            case 'round': value = roundGrowthValue(value, rule.rounding); break;
            default: throw new RangeError('Unknown growth evaluation operation');
        }
    }
    finite(value);
    // A fractional clamp endpoint must not let the rounding step escape the configured bounds.
    const integerBounds = { min: Math.ceil(minimum), max: Math.floor(rule.globalClamp.max) };
    if (integerBounds.min > integerBounds.max) throw new RangeError('Growth scalar bounds contain no integer');
    value = clamp(value, integerBounds);
    return value === 0 ? 0 : value;
}

function inputFacts(input: GrowthEvaluationInput, facts: GrowthEvaluationFacts): GrowthEvaluationFacts {
    return { attackKind: input.attackKind, damageKind: input.damageKind ?? (input.rollMode === undefined ? undefined : 'physical'),
        adjacent: input.adjacent, probabilityRoll: input.rollMode === undefined ? undefined : input.rollMode === 'roll-probability',
        searchMode: input.mode, directDamage: input.direct, tags: input.tags, ...facts };
}
function collectModifiers(pack: GrowthEvaluationPack, input: GrowthEvaluationInput, effects: readonly GrowthScopedModifiers[],
    ports: readonly { port: GrowthRulePort; owner: GrowthEvaluationOwner }[], facts: GrowthEvaluationFacts): GrowthEvaluatedModifier[] {
    const result: GrowthEvaluatedModifier[] = [], attributes = growthAttributeModifiers(pack), common = inputFacts(input, facts);
    for (const scope of ports) {
        const owner = scope.owner === 'actor' ? input.actor : input.target;
        if (!owner) continue;
        const modifiers = [...attributes, ...effects.filter(effect => effect.owner === scope.owner).flatMap(effect => effect.modifiers)];
        for (const modifier of modifiers) {
            if (modifier.port === scope.port && matchesGrowthConditions(modifier.conditions, { ...common, role: scope.owner })) {
                result.push({ operation: modifier.operation, slot: modifier.slot, magnitude: evaluateGrowthMagnitude(modifier.magnitude, owner) });
            }
        }
    }
    return result;
}

/** Evaluate one port, with actor-only scalar ownership, bilateral hit ownership, and target-only received ownership.
 * Use evaluateGrowthPhysicalDamage for an actual damage resolution; do not sequentially scale both damage ports. */
export function evaluateGrowthPort(pack: GrowthEvaluationPack, port: GrowthRulePort, input: GrowthEvaluationInput,
    effects: readonly GrowthScopedModifiers[] = [], facts: GrowthEvaluationFacts = {}): number {
    finite(input.baseValue);
    if (port === 'hitChance' && input.rollMode !== undefined && input.rollMode !== 'roll-probability') return input.baseValue;
    if ((port === 'physicalDamage' || port === 'receivedPhysicalDamage') && input.immune) return input.baseValue;
    if (port === 'stealthRange' && input.invisible) return input.baseValue;
    const owners: readonly GrowthEvaluationOwner[] = port === 'hitChance' ? ['actor', 'target']
        : port === 'receivedPhysicalDamage' ? ['target'] : ['actor'];
    const modifiers = collectModifiers(pack, input, effects, owners.map(owner => ({ port, owner })), facts);
    const configured = pack.config.rules.ports[port];
    // Capacity has one answer for read-only policies and persisted resource ownership alike.
    const rule = port === 'focusCapacity' ? { ...configured, globalClamp: {
        min: Math.max(configured.globalClamp.min, pack.config.focus.min),
        max: Math.min(configured.globalClamp.max, pack.config.focus.cap),
    } } : configured;
    let value = evaluateGrowthModifiers(pack.config.rules, rule, input.baseValue, modifiers,
        port === 'cooldownDuration' ? input.baseCooldown ?? input.baseValue : input.baseValue);
    if (port === 'stealthRange' && input.nativeMinimum !== undefined) {
        value = Math.max(value, finite(input.nativeMinimum));
        if (value > pack.config.rules.ports.stealthRange.globalClamp.max) throw new RangeError('Native stealth minimum exceeds growth bounds');
    }
    return value;
}

function sameDamageRule(left: DeepReadonly<GrowthRuleConfig>, right: DeepReadonly<GrowthRuleConfig>): boolean {
    return left.additiveMode === right.additiveMode && left.budgetId === right.budgetId
        && left.globalClamp.min === right.globalClamp.min && left.globalClamp.max === right.globalClamp.max
        && left.rounding === right.rounding && left.preserveZero === right.preserveZero
        && left.minimumPositive === right.minimumPositive && left.minimumBaseRatio === right.minimumBaseRatio
        && left.multiplierSlots.length === right.multiplierSlots.length && left.multiplierSlots.every((slot, index) => {
            const other = right.multiplierSlots[index]!;
            return slot.id === other.id && slot.min === other.min && slot.max === other.max;
        });
}

/** Native physical damage is the base once: combine attacker outgoing and defender received contributions,
 * apply their shared additive budget and each shared multiplier slot once, then clamp and round once. */
export function evaluateGrowthPhysicalDamage(pack: GrowthEvaluationPack, input: Readonly<GrowthDamageInput>,
    effects: readonly GrowthScopedModifiers[] = [], facts: GrowthEvaluationFacts = {}): number {
    finite(input.baseValue);
    if (input.immune) return input.baseValue;
    const rules = pack.config.rules;
    if (!sameDamageRule(rules.ports.physicalDamage, rules.ports.receivedPhysicalDamage)) {
        throw new RangeError('Physical growth ports must share one evaluation rule');
    }
    const modifiers = collectModifiers(pack, input, effects,
        [{ port: 'physicalDamage', owner: 'actor' }, { port: 'receivedPhysicalDamage', owner: 'target' }], facts);
    return evaluateGrowthModifiers(rules, rules.ports.physicalDamage, input.baseValue, modifiers);
}

/** Phase 1b activates configured attributes only. Definitions, skill slots, identities and timers are not read. */
export function createGrowthRulePolicies(pack: GrowthEvaluationPack): GrowthRulePolicies {
    return Object.freeze({
        hitChance: input => evaluateGrowthPort(pack, 'hitChance', input),
        physicalDamage: input => evaluateGrowthPhysicalDamage(pack, input),
        receivedPhysicalDamage: input => evaluateGrowthPort(pack, 'receivedPhysicalDamage', input),
        stealthRange: input => evaluateGrowthPort(pack, 'stealthRange', input),
        searchStrength: input => evaluateGrowthPort(pack, 'searchStrength', input),
        strengthBonus: input => evaluateGrowthPort(pack, 'strengthBonus', input),
        maxHpBonus: input => evaluateGrowthPort(pack, 'maxHpBonus', input),
        focusCapacity: input => evaluateGrowthPort(pack, 'focusCapacity', input),
        focusRecoveryInterval: input => evaluateGrowthPort(pack, 'focusRecoveryInterval', input),
        cooldownDuration: input => evaluateGrowthPort(pack, 'cooldownDuration', input),
    } satisfies GrowthRulePolicies);
}
