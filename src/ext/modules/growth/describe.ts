import i18next from 'i18next';
import type { DeepReadonly } from './definitions';
import type { GrowthPack } from './attributes';
import type { GrowthAttribute, GrowthCondition, GrowthEffect, GrowthModifier, GrowthPrerequisite, GrowthRulePort, GrowthSkill } from './types';

const describeText = (key: string, values: Record<string, unknown> = {}) => i18next.t(`ext.growth.describe.${key}`, { ...values, interpolation: { escapeValue: false } });
const name = (pack: GrowthPack, id: string) => {
    const definition = [...pack.config.attributes, ...pack.definitions].find(item => item.id === id);
    return definition ? i18next.t(`ext.growth.${definition.nameKey.slice('ext.growth.'.length)}`) : id;
};
function tagName(pack: GrowthPack | undefined, tag: string): string {
    if (!pack) return tag;
    const owners = pack.definitions.filter(definition => (definition.kind === 'skill' && definition.tags.includes(tag))
        || definition.effects.some(effect => effect.kind === 'timed' && effect.tags.includes(tag)));
    return owners.length ? owners.map(owner => name(pack, owner.id)).join(describeText('or')) : tag;
}
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;

/** Vocabulary branches on schema kinds/ports only, never on a content ID. */
export function describeGrowthConditions(conditions: readonly DeepReadonly<GrowthCondition>[], pack?: GrowthPack): string {
    return conditions.map(condition => {
        const label = i18next.t(`ext.growth.ui.condition.${condition.kind}`);
        const value = condition.kind === 'tag' ? tagName(pack, condition.tag) : 'values' in condition
            ? condition.values.map(item => i18next.t(`ext.growth.ui.value.${item}`)).join(describeText('or'))
            : typeof condition.value === 'boolean' ? (condition.value ? i18next.t('ext.growth.ui.condition_true') : i18next.t('ext.growth.ui.condition_false'))
            : i18next.t(`ext.growth.ui.value.${condition.value}`);
        return i18next.t('ext.growth.ui.condition', { name: label, value, interpolation: { escapeValue: false } });
    }).join(describeText('separator'));
}
function modifierDescription(pack: GrowthPack, effect: DeepReadonly<GrowthModifier>, ownerId?: string): string {
    const magnitude = effect.magnitude;
    const percentage = effect.operation === 'add' && (effect.port === 'hitChance' || pack.config.rules.ports[effect.port].additiveMode === 'base-basis-points');
    const amount = (value: number) => effect.operation === 'multiply' ? describeText('multiply', { value })
        : `${signed(percentage ? value / 100 : value)}${percentage ? describeText(effect.port === 'hitChance' ? 'percentage_points' : 'percent') : ''}`;
    const source = magnitude.source;
    const scaled = source.kind !== 'constant';
    const prefix = !scaled ? '' : source.kind === 'attribute' && source.attributeId === ownerId
        ? describeText(magnitude.divisor === 1 ? 'per_point' : 'per_points', { count: magnitude.divisor })
        : describeText(magnitude.divisor === 1 ? 'per_source' : 'per_sources', { count: magnitude.divisor,
            name: source.kind === 'level' ? i18next.t('ext.growth.view.level') : name(pack, source.attributeId) });
    const raw = magnitude.coefficient / (scaled ? 1 : magnitude.divisor);
    const rounded = magnitude.rounding === 'floor' ? Math.floor(raw) : magnitude.rounding === 'ceil' ? Math.ceil(raw)
        : magnitude.rounding === 'nearest' ? Math.round(raw) : Math.trunc(raw);
    const value = scaled ? raw : Math.max(magnitude.min, Math.min(magnitude.max, rounded));
    const bounds: string[] = [];
    if (scaled) {
        if (magnitude.min === 0) bounds.push(describeText('cap', { value: amount(magnitude.max) }));
        else if (magnitude.max === 0) bounds.push(describeText('cap', { value: amount(magnitude.min) }));
        else bounds.push(describeText('range', { min: amount(magnitude.min), max: amount(magnitude.max) }));
        if (magnitude.divisor !== 1 || !Number.isInteger(magnitude.coefficient)) bounds.push(describeText(`rounding.${magnitude.rounding}`));
    }
    const conditions = describeGrowthConditions(effect.conditions, pack);
    return describeText('modifier', { prefix, port: i18next.t(`ext.growth.describe.port.${effect.port}`), value: amount(value),
        detail: bounds.length ? describeText('parenthesis', { value: bounds.join(describeText('separator')) }) : '',
        conditions: conditions ? describeText('conditional', { value: conditions }) : '' });
}
/** A modifier's clamp is not the shared additive budget or the final port clamp.
 * Describe each in its own units (e.g. physical basis points versus final HP damage). */
export function describeGrowthPortConstraints(pack: GrowthPack, port: GrowthRulePort): string[] {
    const config = pack.config.rules.ports[port], budget = pack.config.rules.budgets.find(item => item.id === config.budgetId)!;
    const siblings = Object.entries(pack.config.rules.ports).filter(([, entry]) => entry.budgetId === config.budgetId)
        .map(([key]) => i18next.t(`ext.growth.describe.port.${key}`)).join(describeText('or'));
    const percentage = config.additiveMode === 'base-basis-points' || port === 'hitChance';
    const additive = (value: number) => `${signed(percentage ? value / 100 : value)}${percentage ? describeText(port === 'hitChance' ? 'percentage_points' : 'percent') : ''}`;
    const final = (value: number) => `${port === 'hitChance' ? value / 100 : value}${port === 'hitChance' ? describeText('percent') : ''}`;
    const bounds = (min: number, max: number, format: (value: number) => string): string => {
        const lower = min > -Number.MAX_SAFE_INTEGER, upper = max < Number.MAX_SAFE_INTEGER;
        return lower && upper ? describeText('constraint_range', { min: format(min), max: format(max) })
            : lower ? describeText('constraint_min', { value: format(min) })
            : upper ? describeText('constraint_max', { value: format(max) }) : '';
    };
    const result: string[] = [], budgetBounds = bounds(budget.min, budget.max, additive);
    if (budgetBounds) result.push(describeText('shared_budget', { ports: siblings, bounds: budgetBounds }));
    const minimum = port === 'focusCapacity' ? Math.max(config.globalClamp.min, pack.config.focus.min) : config.globalClamp.min;
    const maximum = port === 'focusCapacity' ? Math.min(config.globalClamp.max, pack.config.focus.cap) : config.globalClamp.max;
    const finalBounds = bounds(minimum, maximum, final);
    if (finalBounds) result.push(describeText(port === 'hitChance' ? 'probability_bounds' : 'final_bounds', { port: i18next.t(`ext.growth.view.port.${port}`), bounds: finalBounds }));
    if (config.minimumBaseRatio !== null) result.push(describeText('base_ratio', { port: i18next.t(`ext.growth.view.port.${port}`), percent: config.minimumBaseRatio * 100 }));
    if (config.preserveZero) result.push(describeText('preserve_zero', { port: i18next.t(`ext.growth.view.port.${port}`) }));
    if (config.minimumPositive !== null) result.push(describeText('minimum_positive', { port: i18next.t(`ext.growth.view.port.${port}`), value: config.minimumPositive }));
    return result;
}
export function describeGrowthEffects(pack: GrowthPack, effects: readonly DeepReadonly<GrowthEffect>[], ownerId?: string): string[] {
    const lines = effects.flatMap(effect => {
        if (effect.kind === 'modifier') return [modifierDescription(pack, effect, ownerId)];
        if (effect.kind === 'resource') return [describeText('resource', { resource: describeText(`resource_name.${effect.resource}`), amount: signed(effect.amount),
            min: effect.trigger.minDepth, max: effect.trigger.maxDepth })];
        if (effect.kind === 'tagged-modifier') return [describeText('tagged', { tag: tagName(pack, effect.tag), property: describeText(`property.${effect.property}`),
            operation: describeText(`operation.${effect.operation}`), coefficient: effect.magnitude.coefficient, divisor: effect.magnitude.divisor,
            min: effect.magnitude.min, max: effect.magnitude.max, rounding: describeText(`rounding.${effect.magnitude.rounding}`),
            source: effect.magnitude.source.kind === 'attribute' ? name(pack, effect.magnitude.source.attributeId) : describeText(`source.${effect.magnitude.source.kind}`),
            conditions: describeGrowthConditions(effect.conditions, pack) || describeText('unconditional') })];
        const duration = effect.duration.kind === 'action' ? describeText('duration_action') : describeText('duration_blocks', { blocks: effect.duration.blocks, cap: effect.duration.cap });
        const conditions = describeGrowthConditions(effect.conditions, pack);
        const lines = [describeText('timed', { recipient: describeText(`recipient.${effect.recipient}`), application: describeText(`application.${effect.application}`), duration,
            conditions: conditions ? describeText('conditional', { value: conditions }) : '' }), ...effect.modifiers.map(modifier => modifierDescription(pack, modifier, ownerId))];
        if (effect.consume.event !== 'none') lines.push(describeText('consume', { event: describeText(`consume_event.${effect.consume.event}`), count: effect.consume.count,
            shield: effect.consume.event === 'positive-direct-physical' ? describeText('parenthesis', { value: effect.consume.includesShieldAbsorbed ? describeText('includes_shield') : describeText('excludes_shield') }) : '' }));
        if (effect.interruptions.length) lines.push(describeText('interruptions', { actions: effect.interruptions.map(kind => describeText(`action.${kind}`)).join(describeText('or')) }));
        return lines;
    });
    const ports = new Set(effects.flatMap(effect => effect.kind === 'modifier' ? [effect.port]
        : effect.kind === 'timed' ? effect.modifiers.map(modifier => modifier.port) : []));
    const constraints = [...new Set([...ports].flatMap(port => describeGrowthPortConstraints(pack, port)))];
    const modifiers = effects.flatMap(effect => effect.kind === 'modifier' ? [effect] : effect.kind === 'timed' ? effect.modifiers : []);
    for (const modifier of modifiers) if (modifier.operation === 'multiply') {
        const slot = pack.config.rules.ports[modifier.port].multiplierSlots.find(entry => entry.id === modifier.slot);
        if (slot) constraints.push(describeText('multiplier_bounds', { port: i18next.t(`ext.growth.view.port.${modifier.port}`), min: slot.min, max: slot.max }));
    }
    return [...lines, ...constraints];
}
export function describeGrowthPrerequisite(pack: GrowthPack, requirement: DeepReadonly<GrowthPrerequisite>): string {
    if (requirement.kind === 'level') return describeText('minimum', { name: i18next.t('ext.growth.view.level'), min: requirement.min });
    if (requirement.kind === 'attribute') return describeText('minimum', { name: name(pack, requirement.attributeId), min: requirement.min });
    const id = requirement.kind === 'skill' ? requirement.skillId : requirement.kind === 'profession' ? requirement.professionId
        : requirement.kind === 'lineage' ? requirement.lineageId : requirement.faithId;
    return name(pack, id);
}
export function describeGrowthAttribute(pack: GrowthPack, attribute: DeepReadonly<GrowthAttribute>): string[] {
    return describeGrowthEffects(pack, attribute.effects, attribute.id);
}
export function describeGrowthSkill(pack: GrowthPack, skill: DeepReadonly<GrowthSkill>, cooldown = skill.cooldown): string[] {
    return [describeText('learning_cost', { cost: skill.cost }), ...(skill.action ? [describeText('use', { focus: skill.focusCost, cooldown,
        action: describeText(`action.${skill.action.kind}`), target: describeText(`target.${skill.action.target}`) }), ...describeGrowthPortConstraints(pack, 'cooldownDuration')] : [describeText('passive')]),
        ...describeGrowthEffects(pack, skill.effects), describeText('prerequisites', { value: skill.prerequisites.length
            ? skill.prerequisites.map(requirement => describeGrowthPrerequisite(pack, requirement)).join(describeText('separator')) : describeText('none') })];
}
