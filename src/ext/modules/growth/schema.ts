import { experienceThreshold, scheduledGrantTotal } from './experience';
import { canonical, isJson, validId } from '../../json';
import { GROWTH_RULE_PORTS, type GrowthDefinitionPack, type GrowthEffect, type GrowthIdentity,
    type GrowthMagnitude, type GrowthPrerequisite, type GrowthSchedule, type GrowthSkill } from './types';

/** Deliberately finite JSON Schema subset: a machine-readable, exhaustive field catalog. */
export interface GrowthSchemaNode {
    type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
    properties?: Record<string, GrowthSchemaNode>; required?: string[]; additionalProperties?: false;
    items?: GrowthSchemaNode; minItems?: number; maxItems?: number; uniqueItems?: boolean;
    minimum?: number; maximum?: number; minLength?: number; pattern?: string;
    enum?: readonly (string | number | boolean | null)[]; oneOf?: GrowthSchemaNode[];
}
const LIMIT = Number.MAX_SAFE_INTEGER;
const object = (properties: Record<string, GrowthSchemaNode>): GrowthSchemaNode => ({ type: 'object', properties,
    required: Object.keys(properties), additionalProperties: false });
const list = (items: GrowthSchemaNode, minItems = 0, uniqueItems = false): GrowthSchemaNode => ({ type: 'array', items, minItems, uniqueItems });
const integer = (minimum = 0, maximum = LIMIT): GrowthSchemaNode => ({ type: 'integer', minimum, maximum });
const number = (minimum = -LIMIT, maximum = LIMIT): GrowthSchemaNode => ({ type: 'number', minimum, maximum });
const enumeration = (...values: string[]): GrowthSchemaNode => ({ type: 'string', enum: values });
const literal = (value: string | number): GrowthSchemaNode => ({ enum: [value] });
const union = (...oneOf: GrowthSchemaNode[]): GrowthSchemaNode => ({ oneOf });
const nullable = (value: GrowthSchemaNode): GrowthSchemaNode => union(value, { type: 'null' });
function buildGrowthSchema(): GrowthSchemaNode {
const bool: GrowthSchemaNode = { type: 'boolean' };
const id: GrowthSchemaNode = { type: 'string', pattern: '^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$' };
const externalId: GrowthSchemaNode = { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_.:-]*$' };
const textKey: GrowthSchemaNode = { type: 'string', pattern: '^ext\\.growth\\.[a-zA-Z0-9_.-]+$' };
const version: GrowthSchemaNode = { type: 'string', pattern: '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$' };
const rounding = enumeration('floor', 'ceil', 'nearest', 'truncate');
const lockMode = enumeration('none', 'soft', 'hard');
const bounds = object({ min: number(), max: number() });
const nonnegativeBounds = object({ min: integer(), max: integer() });
const ids = list(id, 0, true);
const magnitude = object({ source: union(object({ kind: literal('constant') }),
    object({ kind: literal('attribute'), attributeId: id }), object({ kind: literal('level') })),
coefficient: number(), divisor: number(Number.MIN_VALUE), rounding, min: number(), max: number() });
const condition = union(
    object({ kind: literal('attack-kind'), values: list(enumeration('melee', 'thrown', 'bolt', 'reprisal', 'other'), 1, true) }),
    object({ kind: literal('damage-kind'), values: list(enumeration('physical', 'fire', 'poison', 'other'), 1, true) }),
    object({ kind: literal('role'), value: enumeration('actor', 'target') }),
    object({ kind: literal('search-mode'), value: enumeration('manual', 'automatic') }),
    object({ kind: enumeration('adjacent', 'probability-roll', 'hit', 'positive-hp-damage', 'direct-damage'), value: bool }),
    object({ kind: literal('tag'), tag: id }),
);
const modifier = object({ kind: literal('modifier'), port: enumeration(...GROWTH_RULE_PORTS),
    operation: enumeration('add', 'multiply'), slot: nullable(id), magnitude, conditions: list(condition, 0, true) });
const tagged = object({ kind: literal('tagged-modifier'), tag: id, property: enumeration('duration', 'intensity', 'cooldown'),
    operation: enumeration('add', 'multiply'), slot: nullable(id), magnitude, conditions: list(condition, 0, true) });
const timed = object({ kind: literal('timed'), id, tags: ids, recipient: enumeration('self', 'target'),
    application: enumeration('action-start', 'action-result'), conditions: list(condition, 0, true),
    duration: union(object({ kind: literal('action') }), object({ kind: literal('objective-blocks'), blocks: integer(1), cap: integer(1) })),
    modifiers: list(modifier, 1), consume: object({ event: enumeration('none', 'positive-direct-physical', 'physical-probability-roll'),
        count: integer(), phase: literal('per-resolution-commit'), includesShieldAbsorbed: bool }),
    interruptions: list(enumeration('attack', 'projectile', 'cast', 'move', 'search', 'wait'), 0, true) });
const resource = object({ kind: literal('resource'), id, resource: enumeration('focus', 'hp'), amount: integer(-LIMIT),
    trigger: object({ kind: literal('first-visit'), minDepth: integer(1), maxDepth: integer(1), receipt: literal('depth') }), clamp: literal('resource-bounds') });
const effect = union(modifier, tagged, timed, resource);
const prerequisite = union(object({ kind: literal('level'), min: integer(1) }),
    object({ kind: literal('attribute'), attributeId: id, min: integer() }),
    ...(['skill', 'profession', 'lineage', 'faith'] as const).map(kind => object({ kind: literal(kind), [`${kind}Id`]: id })));
const named = { id, nameKey: textKey, descriptionKey: textKey };
const attributeGrant = object({ attributeId: id, amount: integer() });
const action = union(object({ kind: literal('attack'), target: literal('adjacent-creature'), attackKind: literal('melee'), time: literal('native-attack') }),
    object({ kind: literal('move'), target: literal('adjacent-cell'), occupied: literal('reject'), time: literal('native-move') }),
    object({ kind: literal('wait'), target: literal('self'), time: literal('native-wait') }),
    object({ kind: literal('search'), target: literal('self'), mode: literal('manual'), time: literal('native-search') }));
const skill = object({ ...named, kind: literal('skill'), mode: enumeration('active', 'passive'), tags: ids, cost: integer(),
    prerequisites: list(prerequisite, 0, true), lock: object({ mode: lockMode, professionIds: ids, lineageIds: ids, faithIds: ids }),
    focusCost: integer(), cooldown: integer(), action: nullable(action), effects: list(effect) });
const identity = object({ ...named, kind: enumeration('profession', 'lineage', 'faith'), attributes: list(attributeGrant),
    choices: list(object({ attributeIds: list(id, 1, true), points: integer(1), perAttributeCap: integer(1) })),
    gifts: list(object({ skillId: id, waivePrerequisites: bool })), effects: list(effect),
    oaths: list(object({ id, descriptionKey: textKey, effects: list(effect) })), recommendedAttributes: ids, recommendedSkills: ids });
const schedule = union(object({ kind: literal('periodic'), firstLevel: integer(1), every: integer(1), amount: integer() }),
    object({ kind: literal('table'), grants: list(integer(), 1) }));
const port = object({ additiveMode: enumeration('flat', 'base-basis-points'), budgetId: id,
    multiplierSlots: list(object({ id, min: number(0), max: number(0) })), globalClamp: bounds, rounding,
    preserveZero: bool, minimumPositive: nullable(number(0)), minimumBaseRatio: nullable(number(0)) });
const template = object({ ...named, level: integer(1), experience: integer(), attributes: list(attributeGrant),
    professionId: nullable(id), lineageId: nullable(id), faithId: nullable(id), skills: ids, activeSlots: ids, passiveSlots: ids,
    unspentAttributePoints: integer(), unspentSkillPoints: integer() });

return object({ schema: literal(1), moduleId: literal('growth'), moduleVersion: version, rulesVersion: version,
    config: object({
        experience: object({ sources: object({ kills: bool, firstVisits: bool, identification: bool, story: bool }),
            kills: object({ base: integer(), perThreatRank: integer(), threatRank: nonnegativeBounds,
                eligibleCreationReasons: list(enumeration('natural', 'summoned', 'split', 'clone', 'periodic', 'scripted', 'test'), 0, true),
                requireInitiallyHostile: bool, requireHostileAtDeath: bool,
                monsterQuotes: list(object({ monsterId: externalId, threatRank: integer(), amount: nullable(integer()) })) }),
            firstVisits: object({ minDepth: integer(1), maxDepth: integer(1), base: integer(), perDepth: integer(), cap: nullable(integer()) }),
            identification: object({ perKind: integer(), totalCap: integer(), categories: list(externalId, 0, true) }),
            story: object({ rewards: list(object({ id, amount: integer(), reasonKey: textKey })) }),
            allySplit: object({ playerBasisPoints: integer(0, 10000), remainder: literal('credited-actor'), rounding }) }),
        levels: object({ cap: integer(1), experience: union(object({ kind: literal('table'), cumulative: list(integer(), 1) }),
            object({ kind: literal('curve'), base: integer(), linear: integer(), quadratic: integer() })),
            attributePoints: schedule, skillPoints: schedule, maxHp: object({ grants: schedule, cap: integer() }),
            recovery: object({ levelHp: enumeration('none', 'increase', 'full'), allocationHp: enumeration('none', 'increase', 'full'),
                levelFocus: enumeration('none', 'increase', 'full'), allocationFocus: enumeration('none', 'increase', 'full'),
                clearCooldownOnLevel: bool, clearCooldownOnAllocation: bool, creationHp: enumeration('native', 'full') }) }),
        attributes: list(object({ ...named, min: integer(), cap: integer(), initial: integer(), pointCost: integer(1), effects: list(modifier) })),
        attributeTotalCap: nullable(integer()),
        strengthTraining: object({ enabled: bool, attributeId: nullable(id), pointCost: integer(1), cap: integer() }),
        respec: object({ enabled: bool, cost: object({ resource: enumeration('gold', 'attribute-points', 'skill-points', 'focus'), amount: integer() }),
            refundBasisPoints: integer(0, 10000), clearCooldowns: bool }),
        skills: object({ activeSlots: integer(), passiveSlots: integer(), equipTime: enumeration('native-wait', 'none'),
            lockMode, prerequisites: literal('all'), equipPreservesCooldowns: bool, equipPreservesFocus: bool }),
        focus: object({ base: integer(), min: integer(), cap: integer(), recoveryAmount: integer(), recoveryInterval: integer(1),
            objectiveTicksPerBlock: integer(1), resetRemainderWhenFull: bool }),
        rules: object({ budgets: list(object({ id, min: number(), max: number() }), 1),
            ports: object(Object.fromEntries(GROWTH_RULE_PORTS.map(key => [key, port]))),
            taggedProperties: object({ duration: port, intensity: port, cooldown: port }),
            order: { ...list(enumeration('add', 'multiply', 'global-clamp', 'round'), 4, true), maxItems: 4 },
            hitPrecedence: object({ guaranteedHit: literal('preserve'), guaranteedMiss: literal('preserve'), guaranteedRoll: literal('preserve-roll') }) }),
        identities: object({ enabled: object({ professions: bool, lineages: bool, faiths: bool }),
            defaults: object({ professionId: id, lineageId: id, faithId: id }),
            budgets: object({ profession: integer(), lineage: integer(), faith: integer() }),
            giftLimits: object({ active: integer(), passive: integer() }), changeFaith: bool }),
        itemGrowth: object({ rules: list(object({ itemId: externalId, nativeEffect: enumeration('preserve', 'replace'),
            destination: enumeration('strengthBonus', 'maxHpBonus', 'attribute-points', 'skill-points', 'enchantment'),
            conversion: number(0), perItemCap: nullable(number(0)), runCap: nullable(number(0)) })) }),
        monsters: object({ enabled: bool, defaultTemplateId: id, alliesGrow: bool,
            clone: object({ inheritBuild: bool, inheritUnspentPoints: bool, rewards: bool, progression: bool }),
            templates: list(template, 1), depthTemplates: list(object({ minDepth: integer(1), maxDepth: integer(1), templateId: id, priority: integer() })) }),
    }), definitions: list(union(skill, identity)),
});

}
let cachedSchema: GrowthSchemaNode | undefined;
/** Built only at an explicitly extended validation boundary, never during classic module import. */
export function getGrowthSchema(): GrowthSchemaNode {
    if (!cachedSchema) {
        cachedSchema = buildGrowthSchema();
        const freeze = (value: unknown): void => {
            if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
        };
        freeze(cachedSchema);
    }
    return cachedSchema;
}

export type GrowthValidationCode = 'json' | 'shape' | 'field' | 'range' | 'duplicate' | 'reference' | 'cycle' | 'version' | 'text' | 'budget';
export class GrowthValidationError extends Error {
    readonly key: `ext.growth.error.${GrowthValidationCode}`;
    constructor(readonly code: GrowthValidationCode, readonly path: string, readonly detail = '') {
        super(`ext.growth.error.${code}: ${path}${detail ? ` (${detail})` : ''}`);
        this.name = 'GrowthValidationError'; this.key = `ext.growth.error.${code}`;
    }
}
const fail = (code: GrowthValidationCode, path: string, detail = ''): never => { throw new GrowthValidationError(code, path, detail); };
const structural = (value: unknown, schema: GrowthSchemaNode, path: string): void => {
    if (schema.oneOf) {
        let matches = 0;
        for (const branch of schema.oneOf) {
            try { structural(value, branch, path); matches++; } catch (error) { if (!(error instanceof GrowthValidationError)) throw error; }
        }
        if (matches !== 1) fail('shape', path, 'oneOf');
        return;
    }
    if (schema.enum && !schema.enum.includes(value as string)) fail('shape', path, 'enum');
    if (schema.type === 'null') { if (value !== null) fail('shape', path, 'null'); return; }
    if (schema.type === 'object') {
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail('shape', path, 'object');
        const record = value as Record<string, unknown>;
        for (const key of Object.keys(record)) if (!Object.prototype.hasOwnProperty.call(schema.properties!, key)) fail('field', `${path}.${key}`);
        for (const key of schema.required!) if (!Object.prototype.hasOwnProperty.call(record, key)) fail('field', `${path}.${key}`);
        for (const [key, field] of Object.entries(schema.properties!)) structural(record[key], field, `${path}.${key}`);
    } else if (schema.type === 'array') {
        if (!Array.isArray(value)) fail('shape', path, 'array');
        const array = value as unknown[];
        if (array.length < (schema.minItems ?? 0) || array.length > (schema.maxItems ?? LIMIT)) fail('range', path, 'length');
        if (schema.uniqueItems && new Set(array.map(entry => canonical(entry))).size !== array.length) fail('duplicate', path);
        array.forEach((entry, index) => structural(entry, schema.items!, `${path}[${index}]`));
    } else if (schema.type === 'string') {
        if (typeof value !== 'string' || (schema.pattern && !new RegExp(schema.pattern).test(value))) fail('shape', path, 'string');
    } else if (schema.type === 'number' || schema.type === 'integer') {
        if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isSafeInteger(value))) fail('shape', path, schema.type);
        if ((value as number) < schema.minimum! || (value as number) > schema.maximum!) fail('range', path);
    } else if (schema.type === 'boolean' && typeof value !== 'boolean') fail('shape', path, 'boolean');
};
export interface GrowthValidationOptions {
    moduleVersion: string; hasText: (key: string) => boolean;
    /** When supplied, quotes must cover this exact engine catalog once; no engine import is needed. */
    monsterIds?: readonly string[];
    itemIds?: readonly string[];
    categoryIds?: readonly string[];
}
/** Strict two-pass pure validation. Never repairs/coerces content or runs a data-provided callback. */
export function validateGrowthDefinitionPack(value: unknown, options: GrowthValidationOptions): asserts value is GrowthDefinitionPack {
    if (!isJson(value)) fail('json', '$');
    structural(value, getGrowthSchema(), '$');
    const pack = value as GrowthDefinitionPack, config = pack.config;
    if (pack.moduleVersion !== options.moduleVersion || pack.rulesVersion !== pack.moduleVersion) fail('version', '$.moduleVersion');
    const unique = <T>(values: readonly T[], key: (value: T) => string, path: string): Map<string, T> => {
        const map = new Map<string, T>();
        for (const entry of values) { const name = key(entry); if (map.has(name)) fail('duplicate', path, name); map.set(name, entry); }
        return map;
    };
    const attrs = unique(config.attributes, entry => entry.id, '$.config.attributes');
    const defs = unique(pack.definitions, entry => entry.id, '$.definitions');
    const templates = unique(config.monsters.templates, entry => entry.id, '$.config.monsters.templates');
    const budgets = unique(config.rules.budgets, entry => entry.id, '$.config.rules.budgets');
    const checkText = (key: string, path: string): void => { if (!options.hasText(key)) fail('text', path, key); };
    const reference = (id: string, kind: 'skill' | 'profession' | 'lineage' | 'faith', path: string): void => {
        if (defs.get(id)?.kind !== kind) fail('reference', path, id);
    };
    const attribute = (id: string, path: string): NonNullable<ReturnType<typeof attrs.get>> => {
        const found = attrs.get(id); if (!found) return fail('reference', path, id); return found;
    };
    const range = (min: number, max: number, path: string): void => { if (min > max) fail('range', path, 'min > max'); };
    const safe = (amount: number, path: string): void => { if (!Number.isSafeInteger(amount) || amount < 0) fail('range', path, 'safe integer'); };
    const namedText = (item: { nameKey: string; descriptionKey: string }, path: string): void => {
        checkText(item.nameKey, `${path}.nameKey`); checkText(item.descriptionKey, `${path}.descriptionKey`);
    };
    const scheduleCheck = (item: GrowthSchedule, path: string): void => {
        if (item.kind === 'table') { if (item.grants.length !== config.levels.cap) fail('range', path, 'one entry per level'); }
        else if (item.firstLevel > config.levels.cap) fail('range', path, 'firstLevel > cap');
    };
    const levels = config.levels, xp = levels.experience;
    if (xp.kind === 'table') {
        if (xp.cumulative.length !== levels.cap || xp.cumulative[0] !== 0) fail('range', '$.config.levels.experience');
        xp.cumulative.forEach((amount, index) => { if (index && amount <= xp.cumulative[index - 1]!) fail('range', '$.config.levels.experience', 'strictly increasing'); });
    } else {
        // Per-level cost for leaving level L: base + linear*L + quadratic*L^2.
        if (levels.cap > 1 && xp.base + xp.linear + xp.quadratic <= 0) fail('range', '$.config.levels.experience', 'positive costs');
        try { experienceThreshold(levels, levels.cap); } catch { fail('range', '$.config.levels.experience', 'safe integer'); }
    }
    scheduleCheck(levels.attributePoints, '$.config.levels.attributePoints'); scheduleCheck(levels.skillPoints, '$.config.levels.skillPoints');
    scheduleCheck(levels.maxHp.grants, '$.config.levels.maxHp.grants');
    const scheduleTotal = (schedule: GrowthSchedule, level: number): number => {
        try { return scheduledGrantTotal(schedule, level); } catch { return fail('range', '$.config.levels', 'safe integer'); }
    };
    for (const item of [levels.attributePoints, levels.skillPoints, levels.maxHp.grants]) safe(scheduleTotal(item, levels.cap), '$.config.levels');
    range(config.focus.min, config.focus.cap, '$.config.focus');
    if (config.focus.base < config.focus.min || config.focus.base > config.focus.cap) fail('range', '$.config.focus.base');
    if (config.strengthTraining.enabled && config.strengthTraining.attributeId === null) fail('reference', '$.config.strengthTraining.attributeId');
    if (config.strengthTraining.attributeId !== null) {
        const training = attribute(config.strengthTraining.attributeId, '$.config.strengthTraining.attributeId');
        if (config.strengthTraining.cap > training.cap || config.strengthTraining.pointCost !== training.pointCost) fail('range', '$.config.strengthTraining');
    }
    if (config.attributeTotalCap !== null && config.attributes.reduce((sum, attr) => sum + attr.initial, 0) > config.attributeTotalCap) fail('budget', '$.config.attributeTotalCap');
    const tags = new Set<string>();
    const durationTags = new Set<string>(), intensityTags = new Set<string>(), cooldownTags = new Set<string>();
    const timedIds = new Set<string>();
    const gather = (effects: GrowthEffect[]): void => { for (const item of effects) if (item.kind === 'timed' || item.kind === 'resource') {
        if (timedIds.has(item.id)) fail('duplicate', '$.definitions.effects', item.id);
        timedIds.add(item.id);
        if (item.kind === 'timed') item.tags.forEach(tag => { tags.add(tag); intensityTags.add(tag);
            if (item.duration.kind === 'objective-blocks') durationTags.add(tag); });
    } };
    for (const def of pack.definitions) {
        if (def.kind === 'skill') def.tags.forEach(tag => { tags.add(tag); if (def.mode === 'active') cooldownTags.add(tag);
            if (def.effects.some(effect => effect.kind === 'modifier')) intensityTags.add(tag); });
        gather(def.effects); if (def.kind !== 'skill') def.oaths.forEach(oath => gather(oath.effects));
    }
    const magnitudeCheck = (item: GrowthMagnitude, path: string): void => {
        range(item.min, item.max, path);
        let maxSource = 1;
        if (item.source.kind === 'attribute') maxSource = attribute(item.source.attributeId, path).cap;
        if (item.source.kind === 'level') maxSource = levels.cap;
        if (!Number.isFinite(maxSource * item.coefficient / item.divisor) || Math.abs(maxSource * item.coefficient / item.divisor) > LIMIT) fail('range', path, 'scalar overflow');
    };
    const effectsCheck = (effects: GrowthEffect[], path: string): void => {
        for (const [index, item] of effects.entries()) {
            const at = `${path}[${index}]`;
            if ('conditions' in item) for (const condition of item.conditions) if (condition.kind === 'tag' && !tags.has(condition.tag)) fail('reference', at, condition.tag);
            if (item.kind === 'modifier') {
                magnitudeCheck(item.magnitude, at);
                if (item.operation === 'add' ? item.slot !== null : item.slot === null || !config.rules.ports[item.port].multiplierSlots.some(slot => slot.id === item.slot)) fail('reference', `${at}.slot`);
                if (item.operation === 'multiply' && item.magnitude.min < 0) fail('range', at, 'negative multiplier');
            } else if (item.kind === 'tagged-modifier') {
                const propertyTags = item.property === 'duration' ? durationTags : item.property === 'cooldown' ? cooldownTags : intensityTags;
                if (!propertyTags.has(item.tag)) fail('reference', `${at}.tag`, `${item.tag}:${item.property}`);
                magnitudeCheck(item.magnitude, at);
                if (item.operation === 'add' ? item.slot !== null : item.slot === null || !config.rules.taggedProperties[item.property].multiplierSlots.some(slot => slot.id === item.slot)) fail('reference', `${at}.slot`);
                if (item.operation === 'multiply' && item.magnitude.min < 0) fail('range', at, 'negative multiplier');
            } else if (item.kind === 'timed') {
                if (item.duration.kind === 'objective-blocks' && item.duration.blocks > item.duration.cap) fail('range', `${at}.duration`);
                if (item.consume.event === 'none' ? item.consume.count !== 0 || item.consume.includesShieldAbsorbed : item.consume.count < 1) fail('range', `${at}.consume`);
                if (item.consume.event === 'physical-probability-roll' && item.consume.includesShieldAbsorbed) fail('range', `${at}.consume`);
                effectsCheck(item.modifiers, `${at}.modifiers`);
            } else range(item.trigger.minDepth, item.trigger.maxDepth, `${at}.trigger`);
        }
    };
    for (const [index, attr] of config.attributes.entries()) {
        const path = `$.config.attributes[${index}]`; namedText(attr, path); range(attr.min, attr.cap, path);
        if (attr.initial < attr.min || attr.initial > attr.cap) fail('range', path, 'initial'); effectsCheck(attr.effects, `${path}.effects`);
    }
    for (const [index, budget] of config.rules.budgets.entries()) range(budget.min, budget.max, `$.config.rules.budgets[${index}]`);
    for (const [path, rule] of [...Object.entries(config.rules.ports).map(([name, rule]) => [`$.config.rules.ports.${name}`, rule] as const),
        ...Object.entries(config.rules.taggedProperties).map(([name, rule]) => [`$.config.rules.taggedProperties.${name}`, rule] as const)]) {
        if (!budgets.has(rule.budgetId)) fail('reference', `${path}.budgetId`, rule.budgetId);
        range(rule.globalClamp.min, rule.globalClamp.max, `${path}.globalClamp`);
        unique(rule.multiplierSlots, slot => slot.id, `${path}.multiplierSlots`);
        rule.multiplierSlots.forEach(slot => range(slot.min, slot.max, `${path}.multiplierSlots`));
        if (rule.minimumPositive !== null && rule.minimumPositive > rule.globalClamp.max) fail('range', `${path}.minimumPositive`);
    }
    if (config.rules.order.join(',') !== 'add,multiply,global-clamp,round') fail('shape', '$.config.rules.order', 'fixed evaluation order');
    const grantsCheck = (grants: GrowthIdentity['attributes'], path: string): number => {
        unique(grants, grant => grant.attributeId, path);
        let spent = 0;
        for (const grant of grants) { const attr = attribute(grant.attributeId, path);
            if (attr.initial + grant.amount > attr.cap) fail('range', path, grant.attributeId); spent += grant.amount * attr.pointCost; }
        safe(spent, path);
        if (config.attributeTotalCap !== null && config.attributes.reduce((sum, attr) => sum + attr.initial, 0) + grants.reduce((sum, grant) => sum + grant.amount, 0) > config.attributeTotalCap) fail('budget', path, 'total attribute cap');
        return spent;
    };
    const prereqCheck = (requirements: GrowthPrerequisite[], path: string): void => {
        const seen = new Set<string>();
        for (const requirement of requirements) {
            const key = requirement.kind === 'level' ? 'level'
                : requirement.kind === 'attribute' ? `attribute:${requirement.attributeId}`
                : requirement.kind === 'skill' ? `skill:${requirement.skillId}`
                : requirement.kind === 'profession' ? `profession:${requirement.professionId}`
                : requirement.kind === 'lineage' ? `lineage:${requirement.lineageId}` : `faith:${requirement.faithId}`;
            if (seen.has(key)) fail('duplicate', path, key); seen.add(key);
            if (requirement.kind === 'level') { if (requirement.min > levels.cap) fail('range', path); }
            else if (requirement.kind === 'attribute') { if (requirement.min > attribute(requirement.attributeId, path).cap) fail('range', path); }
            else if (requirement.kind === 'skill') reference(requirement.skillId, 'skill', path);
            else if (requirement.kind === 'profession') reference(requirement.professionId, 'profession', path);
            else if (requirement.kind === 'lineage') reference(requirement.lineageId, 'lineage', path);
            else reference(requirement.faithId, 'faith', path);
        }
    };
    for (const [index, def] of pack.definitions.entries()) {
        const path = `$.definitions[${index}]`; namedText(def, path); effectsCheck(def.effects, `${path}.effects`);
        if (def.kind === 'skill') {
            if (def.mode === 'passive' ? def.action !== null || def.focusCost !== 0 || def.cooldown !== 0 : def.action === null) fail('shape', path, 'skill mode/action');
            prereqCheck(def.prerequisites, `${path}.prerequisites`);
            for (const kind of ['profession', 'lineage', 'faith'] as const) for (const id of def.lock[`${kind}Ids`]) reference(id, kind, `${path}.lock`);
            if (def.lock.mode === 'none' && (def.lock.professionIds.length || def.lock.lineageIds.length || def.lock.faithIds.length)) fail('shape', `${path}.lock`, 'none has no restrictions');
            if (def.lock.mode === 'hard' && !(def.lock.professionIds.length || def.lock.lineageIds.length || def.lock.faithIds.length)) fail('shape', `${path}.lock`, 'hard needs restrictions');
        } else {
            let spent = grantsCheck(def.attributes, `${path}.attributes`);
            for (const choice of def.choices) {
                let capacity = 0;
                for (const id of choice.attributeIds) { const attr = attribute(id, `${path}.choices`); capacity += Math.min(choice.perAttributeCap, attr.cap - attr.initial) * attr.pointCost; }
                if (choice.points > capacity) fail('budget', `${path}.choices`); spent += choice.points;
            }
            if (spent > config.identities.budgets[def.kind]) fail('budget', path, 'identity attributes');
            unique(def.gifts, gift => gift.skillId, `${path}.gifts`);
            const giftCounts = { active: 0, passive: 0 };
            for (const gift of def.gifts) { reference(gift.skillId, 'skill', `${path}.gifts`); giftCounts[(defs.get(gift.skillId) as GrowthSkill).mode]++; }
            for (const mode of ['active', 'passive'] as const) if (giftCounts[mode] > config.identities.giftLimits[mode]) fail('budget', `${path}.gifts`, mode);
            def.recommendedAttributes.forEach(id => attribute(id, `${path}.recommendedAttributes`));
            def.recommendedSkills.forEach(id => reference(id, 'skill', `${path}.recommendedSkills`));
            unique(def.oaths, oath => oath.id, `${path}.oaths`);
            for (const oath of def.oaths) { checkText(oath.descriptionKey, `${path}.oaths`); effectsCheck(oath.effects, `${path}.oaths.effects`); }
        }
    }
    const visited = new Set<string>(), visiting = new Set<string>();
    const visit = (id: string): void => {
        if (visiting.has(id)) fail('cycle', '$.definitions.prerequisites', id);
        if (visited.has(id)) return;
        visiting.add(id);
        const def = defs.get(id)!;
        if (def.kind === 'skill') for (const requirement of def.prerequisites) if (requirement.kind === 'skill') visit(requirement.skillId);
        visiting.delete(id); visited.add(id);
    };
    pack.definitions.forEach(def => visit(def.id));
    for (const kind of ['profession', 'lineage', 'faith'] as const) reference(config.identities.defaults[`${kind}Id`], kind, '$.config.identities.defaults');
    const defaults = config.identities.defaults;
    const defaultGrants = new Map<string, number>();
    for (const kind of ['profession', 'lineage', 'faith'] as const) {
        if (!config.identities.enabled[`${kind}s`]) continue;
        const identity = defs.get(defaults[`${kind}Id`]) as GrowthIdentity;
        identity.attributes.forEach(grant => defaultGrants.set(grant.attributeId, (defaultGrants.get(grant.attributeId) ?? 0) + grant.amount));
    }
    grantsCheck([...defaultGrants].map(([attributeId, amount]) => ({ attributeId, amount })), '$.config.identities.defaults');
    const kills = config.experience.kills;
    range(kills.threatRank.min, kills.threatRank.max, '$.config.experience.kills.threatRank');
    unique(kills.monsterQuotes, quote => quote.monsterId, '$.config.experience.kills.monsterQuotes');
    for (const quote of kills.monsterQuotes) {
        if (quote.threatRank < kills.threatRank.min || quote.threatRank > kills.threatRank.max) fail('range', '$.config.experience.kills.monsterQuotes', quote.monsterId);
        safe(quote.amount ?? kills.base + kills.perThreatRank * quote.threatRank, '$.config.experience.kills.monsterQuotes');
    }
    if (options.monsterIds) {
        const expected = new Set(options.monsterIds), actual = new Set(kills.monsterQuotes.map(quote => quote.monsterId));
        if (expected.size !== actual.size || [...expected].some(id => !actual.has(id))) fail('reference', '$.config.experience.kills.monsterQuotes', 'exact monster catalog');
    }
    const first = config.experience.firstVisits;
    range(first.minDepth, first.maxDepth, '$.config.experience.firstVisits');
    const firstQuote = BigInt(first.base) + BigInt(first.perDepth) * BigInt(first.maxDepth);
    const depthCount = BigInt(first.maxDepth) - BigInt(first.minDepth) + 1n;
    const firstTotal = depthCount * BigInt(first.base) + BigInt(first.perDepth) * depthCount * (BigInt(first.minDepth) + BigInt(first.maxDepth)) / 2n;
    if (firstQuote > BigInt(LIMIT) || (first.cap === null && firstTotal > BigInt(LIMIT))) fail('range', '$.config.experience.firstVisits', 'safe integer');
    unique(config.experience.story.rewards, reward => reward.id, '$.config.experience.story.rewards');
    config.experience.story.rewards.forEach(reward => checkText(reward.reasonKey, '$.config.experience.story.rewards'));
    unique(config.itemGrowth.rules, item => item.itemId, '$.config.itemGrowth.rules');
    if (options.itemIds) for (const item of config.itemGrowth.rules) if (!options.itemIds.includes(item.itemId)) fail('reference', '$.config.itemGrowth.rules', item.itemId);
    if (options.categoryIds) for (const category of config.experience.identification.categories) if (!options.categoryIds.includes(category)) fail('reference', '$.config.experience.identification.categories', category);
    for (const item of config.itemGrowth.rules) if (item.perItemCap !== null && item.runCap !== null && item.perItemCap > item.runCap) fail('range', '$.config.itemGrowth.rules');
    if (!templates.has(config.monsters.defaultTemplateId)) fail('reference', '$.config.monsters.defaultTemplateId');
    const cumulative = (level: number): number => {
        if (xp.kind === 'table') return xp.cumulative[level - 1]!;
        return experienceThreshold(levels,level);
    };
    for (const [index, template] of config.monsters.templates.entries()) {
        const path = `$.config.monsters.templates[${index}]`; namedText(template, path);
        if (template.level > levels.cap || template.experience < cumulative(template.level)
            || template.experience > cumulative(levels.cap) || (template.level < levels.cap && template.experience >= cumulative(template.level + 1))) fail('range', path, 'level/experience');
        const spent = grantsCheck(template.attributes, `${path}.attributes`);
        let identityBudget = 0;
        const gifts = new Set<string>();
        for (const kind of ['profession', 'lineage', 'faith'] as const) {
            const id = template[`${kind}Id`]; if (id !== null) { reference(id, kind, path); identityBudget += config.identities.budgets[kind];
                (defs.get(id) as GrowthIdentity).gifts.forEach(gift => gifts.add(gift.skillId)); }
        }
        if (spent + template.unspentAttributePoints > scheduleTotal(levels.attributePoints, template.level) + identityBudget) fail('budget', path, 'attribute points');
        let skillCost = 0;
        for (const id of template.skills) { reference(id, 'skill', path); if (!gifts.has(id)) skillCost += (defs.get(id) as GrowthSkill).cost; }
        if (skillCost + template.unspentSkillPoints > scheduleTotal(levels.skillPoints, template.level)) fail('budget', path, 'skill points');
        const templateAttributes = new Map(config.attributes.map(attr => [attr.id, attr.initial + (template.attributes.find(grant => grant.attributeId === attr.id)?.amount ?? 0)]));
        for (const id of template.skills) {
            const skill = defs.get(id) as GrowthSkill;
            const identities = [template.professionId, template.lineageId, template.faithId].filter((id): id is string => id !== null).map(id => defs.get(id) as GrowthIdentity);
            const waived = identities.some(identity => identity.gifts.some(gift => gift.skillId === id && gift.waivePrerequisites));
            if (!waived) for (const requirement of skill.prerequisites) {
                const valid = requirement.kind === 'level' ? template.level >= requirement.min
                    : requirement.kind === 'attribute' ? (templateAttributes.get(requirement.attributeId) ?? 0) >= requirement.min
                    : requirement.kind === 'skill' ? template.skills.includes(requirement.skillId)
                    : requirement.kind === 'profession' ? template.professionId === requirement.professionId
                    : requirement.kind === 'lineage' ? template.lineageId === requirement.lineageId : template.faithId === requirement.faithId;
                if (!valid) fail('reference', path, `unmet prerequisite: ${id}`);
            }
            if (!waived && config.skills.lockMode === 'hard' && skill.lock.mode === 'hard') for (const kind of ['profession', 'lineage', 'faith'] as const) {
                const allowed = skill.lock[`${kind}Ids`];
                if (allowed.length && (template[`${kind}Id`] === null || !allowed.includes(template[`${kind}Id`]!))) fail('reference', path, `hard lock: ${id}`);
            }
        }
        for (const mode of ['active', 'passive'] as const) {
            const slots = template[`${mode}Slots`]; if (slots.length > config.skills[`${mode}Slots`]) fail('budget', path, 'slots');
            for (const id of slots) if (!template.skills.includes(id) || (defs.get(id) as GrowthSkill)?.mode !== mode) fail('reference', path, id);
        }
    }
    for (const [index, depth] of config.monsters.depthTemplates.entries()) {
        range(depth.minDepth, depth.maxDepth, '$.config.monsters.depthTemplates');
        if (!templates.has(depth.templateId)) fail('reference', '$.config.monsters.depthTemplates', depth.templateId);
        for (const other of config.monsters.depthTemplates.slice(0, index)) if (other.priority === depth.priority && depth.minDepth <= other.maxDepth && other.minDepth <= depth.maxDepth) fail('duplicate', '$.config.monsters.depthTemplates', 'ambiguous priority');
    }
    // Explicit qualified IDs are data references, never property access paths or executable text.
    if (!validId(pack.moduleId)) fail('shape', '$.moduleId');
}
