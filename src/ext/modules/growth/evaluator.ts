import { evaluateStat, decimalStatFraction, roundStatFraction, safeStatRational, type StatKeyDeclaration } from '../../stats';
import type { DeepReadonly } from './definitions';
import type { GrowthBounds, GrowthCondition, GrowthDamageInput, GrowthDefinitionPack, GrowthHitInput, GrowthMagnitude,
    GrowthModifier, GrowthPrerequisite, GrowthRounding, GrowthRuleActor, GrowthRuleConfig, GrowthRuleInput,
    GrowthRulePort, GrowthTaggedModifier } from './types';

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
    readonly tags?: readonly string[];
    readonly source?: GrowthRuleActor;
    readonly taggedModifiers?: readonly DeepReadonly<GrowthTaggedModifier>[];
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
    /** Actors without growth still receive explicit debuffs, but never configured attribute effects. */
    readonly inactiveAttributeActorIds?: readonly number[];
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
    const a=decimalStatFraction(source),b=decimalStatFraction(magnitude.coefficient),c=decimalStatFraction(magnitude.divisor);
    let n=a.numerator*b.numerator*c.denominator,d=a.denominator*b.denominator*c.numerator;
    const lo=decimalStatFraction(magnitude.min),hi=decimalStatFraction(magnitude.max);
    if(n*lo.denominator<lo.numerator*d)return magnitude.min;
    if(n*hi.denominator>hi.numerator*d)return magnitude.max;
    if(magnitude.rounding==='nearest'&&n<0n){return clamp(roundStatFraction({numerator:n*2n+d,denominator:d*2n},'floor'),magnitude);}
    const mode=magnitude.rounding==='nearest'?'nearest-half-away':magnitude.rounding==='truncate'?(n<0n?'ceil':'floor'):magnitude.rounding;
    return clamp(roundStatFraction({numerator:n,denominator:d},mode),magnitude);
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
    const budget=rules.budgets.find(b=>b.id===rule.budgetId);if(!budget)throw new RangeError('Unknown growth additive budget');
    if(rule.preserveZero&&baseValue===0)return 0;
    let minimum=rule.globalClamp.min;
    if(baseValue>0&&rule.minimumPositive!==null)minimum=Math.max(minimum,rule.minimumPositive);
    if(baseRatioValue>0&&rule.minimumBaseRatio!==null){const a=decimalStatFraction(baseRatioValue),b=decimalStatFraction(rule.minimumBaseRatio);minimum=Math.max(minimum,roundStatFraction({numerator:a.numerator*b.numerator,denominator:a.denominator*b.denominator},'ceil'));}
    const bp=(value:number)=>{const a=decimalStatFraction(value);let n=a.numerator*10000n;const limit=BigInt(Number.MAX_SAFE_INTEGER);if(n>limit*a.denominator)n=limit*a.denominator;if(n< -limit*a.denominator)n= -limit*a.denominator;return roundStatFraction({numerator:n,denominator:a.denominator},'nearest-half-away');};
    const key:StatKeyDeclaration={id:'growth.preview',owner:'growth',unit:'scalar',kind:'query',minimum:Math.ceil(minimum),maximum:Math.floor(rule.globalClamp.max),rounding:rule.rounding==='nearest'?'nearest-half-away':rule.rounding==='truncate'?(baseValue<0?'ceil':'floor'):rule.rounding,categories:['flat','increased','more'],increased:{minimum:budget.min,maximum:budget.max},moreSlots:rule.multiplierSlots.map(slot=>({id:slot.id,minimum:bp(slot.min)-10000,maximum:bp(slot.max)-10000}))};
    if(key.minimum>key.maximum)throw new RangeError('Growth scalar bounds contain no integer');
    const rows=modifiers.map((m,index)=>{
        finite(m.magnitude);
        if(m.operation==='add'&&m.slot!==null)throw new RangeError('An additive growth modifier cannot use a multiplier slot');
        if(m.operation==='multiply'&&(m.slot===null||!rule.multiplierSlots.some(slot=>slot.id===m.slot)||m.magnitude<0))throw new RangeError('Invalid growth multiplier slot');
        return {owner:'growth',stat:key.id,category:m.operation==='multiply'?'more' as const:rule.additiveMode==='flat'?'flat' as const:'increased' as const,value:m.operation==='multiply'?bp(m.magnitude)-10000:m.magnitude,layer:'character' as const,sourceKind:'growth-preview',sourceId:`growth.preview.${index}`,...(m.operation==='multiply'?{slot:m.slot!}:{budget:{minimum:budget.min,maximum:budget.max}})};
    });
    const exactMore=new Map<string,{numerator:bigint;denominator:bigint}>();
    for(const m of modifiers)if(m.operation==='multiply'){const a=decimalStatFraction(m.magnitude),old=exactMore.get(m.slot!)??{numerator:1n,denominator:1n};exactMore.set(m.slot!,{numerator:old.numerator*a.denominator+(a.numerator-a.denominator)*old.denominator,denominator:old.denominator*a.denominator});}
    return evaluateStat(key,Number.isSafeInteger(baseValue)?baseValue:safeStatRational(decimalStatFraction(baseValue)),rows,exactMore).value;
}

function inputFacts(input: GrowthEvaluationInput, facts: GrowthEvaluationFacts): GrowthEvaluationFacts {
    return { attackKind: input.attackKind, damageKind: input.damageKind ?? (input.rollMode === undefined ? undefined : 'physical'),
        adjacent: input.adjacent, probabilityRoll: input.rollMode === undefined ? undefined : input.rollMode === 'roll-probability',
        searchMode: input.mode, directDamage: input.direct, tags: input.tags, ...facts };
}
export function collectModifiers(pack: GrowthEvaluationPack, input: GrowthEvaluationInput, effects: readonly GrowthScopedModifiers[],
    ports: readonly { port: GrowthRulePort; owner: GrowthEvaluationOwner }[], facts: GrowthEvaluationFacts): GrowthEvaluatedModifier[] {
    const result: GrowthEvaluatedModifier[] = [], attributes = growthAttributeModifiers(pack), common = inputFacts(input, facts);
    for (const scope of ports) {
        const owner = scope.owner === 'actor' ? input.actor : input.target;
        if (!owner) continue;
        const groups: readonly GrowthScopedModifiers[] = [...(input.inactiveAttributeActorIds?.includes(owner.id) ? [] : [{owner:scope.owner,modifiers:attributes}]),...effects.filter(effect=>effect.owner === scope.owner)];
        for (const group of groups) for (const modifier of group.modifiers) {
            const facts = { ...common, role: scope.owner, tags:[...(common.tags ?? []),...(group.tags ?? [])] };
            if (modifier.port === scope.port && matchesGrowthConditions(modifier.conditions, facts)) {
                const source = group.source ?? owner;
                let magnitude = evaluateGrowthMagnitude(modifier.magnitude, source);
                if (group.taggedModifiers?.length) {
                    const tags = group.taggedModifiers.filter(item=>item.property === 'intensity' && group.tags?.includes(item.tag)
                        && matchesGrowthConditions(item.conditions,facts)).map(item=>({operation:item.operation,slot:item.slot,magnitude:evaluateGrowthMagnitude(item.magnitude,source)}));
                    magnitude = evaluateGrowthModifiers(pack.config.rules,pack.config.rules.taggedProperties.intensity,magnitude,tags);
                }
                result.push({ operation: modifier.operation, slot: modifier.slot, magnitude });
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
    const bounds = port === 'focusCapacity' ? {min:pack.config.focus.min,max:pack.config.focus.cap}
        : port === 'staminaCapacity' ? pack.config.combatStats?.stamina
        : port === 'poiseCapacity' ? pack.config.combatStats?.poise : undefined;
    const rule = bounds ? { ...configured, globalClamp: {
        min: Math.max(configured.globalClamp.min, bounds.min),
        max: Math.min(configured.globalClamp.max, bounds.max),
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
