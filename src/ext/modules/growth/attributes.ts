import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack, GrowthRuleActor, GrowthRuleInput } from './types';
import type { GrowthAttributes, GrowthDerived, GrowthProgression } from './components';
import { automaticMaxHpBonus } from './experience';
import { evaluateGrowthPort } from './evaluator';

export type GrowthPack = DeepReadonly<GrowthDefinitionPack>;
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
function safe(value: bigint): number {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('Growth attribute budget overflow');
    return Number(value);
}
export function initialGrowthAttributes(pack: GrowthPack, inherited?: Readonly<Record<string, number>>): GrowthAttributes {
    return { values: Object.fromEntries(pack.config.attributes.map(attribute => [attribute.id, inherited?.[attribute.id] ?? attribute.initial])),
        allocated: Object.fromEntries(pack.config.attributes.map(attribute => [attribute.id, 0])), attributePointsSpent: 0, skillPointsSpent: 0,
        inheritedAttributePoints: 0, inheritedSkillPoints: 0 };
}
export function growthRuleActor(id: number, progression: Readonly<GrowthProgression>, attributes: Readonly<GrowthAttributes>): GrowthRuleActor {
    return { id, level: progression.level, attributes: { ...attributes.values } };
}
export function growthScalarInput(actor: GrowthRuleActor, baseValue: number): GrowthRuleInput {
    return { actor, target: null, baseValue, actionId: 0, resolutionId: 0, tags: [] };
}
export function growthDerived(pack: GrowthPack, actor: GrowthRuleActor): GrowthDerived {
    return { appliedStrength: evaluateGrowthPort(pack, 'strengthBonus', growthScalarInput(actor, 0)),
        appliedMaxHp: evaluateGrowthPort(pack, 'maxHpBonus', growthScalarInput(actor, automaticMaxHpBonus(pack.config.levels, actor.level))) };
}
export function growthFocusCapacity(pack: GrowthPack, actor: GrowthRuleActor): number {
    return Math.max(pack.config.focus.min, Math.min(pack.config.focus.cap,
        evaluateGrowthPort(pack, 'focusCapacity', growthScalarInput(actor, pack.config.focus.base))));
}
export function growthFocusInterval(pack: GrowthPack, actor: GrowthRuleActor): number {
    return evaluateGrowthPort(pack, 'focusRecoveryInterval', growthScalarInput(actor, pack.config.focus.recoveryInterval));
}
export function growthAllocatedCost(pack: GrowthPack, attributes: Readonly<GrowthAttributes>): number {
    return safe(pack.config.attributes.reduce((sum, attribute) => sum + BigInt(attributes.allocated[attribute.id]!) * BigInt(attribute.pointCost), 0n));
}
export function isGrowthAttributes(value: unknown, pack: GrowthPack, inherited = false): value is GrowthAttributes {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const build = value as GrowthAttributes;
    if (Object.keys(build).sort().join(',') !== 'allocated,attributePointsSpent,inheritedAttributePoints,inheritedSkillPoints,skillPointsSpent,values'
        || !integer(build.attributePointsSpent) || !integer(build.skillPointsSpent)
        || !integer(build.inheritedAttributePoints) || !integer(build.inheritedSkillPoints)) return false;
    const ids = pack.config.attributes.map(attribute => attribute.id).sort().join(',');
    if (![build.values, build.allocated].every(values => values && typeof values === 'object' && !Array.isArray(values)
        && Object.keys(values).sort().join(',') === ids && Object.values(values).every(integer))) return false;
    let total = 0n;
    for (const attribute of pack.config.attributes) {
        const rank = build.values[attribute.id]!, paid = build.allocated[attribute.id]!;
        if (rank < attribute.min || rank > attribute.cap || paid > rank - attribute.min
            || (attribute.id === pack.config.strengthTraining.attributeId && rank > pack.config.strengthTraining.cap)
            || (!inherited && rank - paid !== attribute.initial)
            || (!pack.config.strengthTraining.enabled && attribute.id === pack.config.strengthTraining.attributeId && paid > 0)) return false;
        total += BigInt(rank);
    }
    return pack.config.attributeTotalCap === null || total <= BigInt(pack.config.attributeTotalCap);
}
/** Preflight only. The command writes all resources/components after every branch succeeds. */
export function allocateGrowthAttributes(pack: GrowthPack, old: Readonly<GrowthAttributes>, available: number,
    increments: unknown): { attributes: GrowthAttributes; cost: number } {
    if (!increments || typeof increments !== 'object' || Array.isArray(increments)) throw new RangeError('Invalid growth allocation');
    const attributes: GrowthAttributes = structuredClone(old), config = pack.config;
    let cost = 0n, count = 0n;
    for (const [id, amount] of Object.entries(increments).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
        const definition = config.attributes.find(attribute => attribute.id === id);
        if (!definition || !integer(amount) || (!config.strengthTraining.enabled && id === config.strengthTraining.attributeId && amount > 0))
            throw new RangeError('Invalid growth allocation');
        attributes.values[id] = safe(BigInt(attributes.values[id]!) + BigInt(amount));
        attributes.allocated[id] = safe(BigInt(attributes.allocated[id]!) + BigInt(amount));
        cost += BigInt(amount) * BigInt(definition.pointCost); count += BigInt(amount);
    }
    if (!count || cost > BigInt(available) || !isGrowthAttributes(attributes, pack)) throw new RangeError('Invalid growth allocation');
    return { attributes, cost: safe(cost) };
}
export function respecGrowthAttributes(pack: GrowthPack, old: Readonly<GrowthAttributes>): { attributes: GrowthAttributes; refund: number } {
    const attributes: GrowthAttributes = structuredClone(old), paid = growthAllocatedCost(pack, old);
    const refund = safe(BigInt(paid) * BigInt(pack.config.respec.refundBasisPoints) / 10000n);
    for (const attribute of pack.config.attributes) {
        attributes.values[attribute.id]! -= attributes.allocated[attribute.id]!; attributes.allocated[attribute.id] = 0;
    }
    attributes.attributePointsSpent = safe(BigInt(attributes.attributePointsSpent) + BigInt(paid - refund));
    return { attributes, refund };
}
