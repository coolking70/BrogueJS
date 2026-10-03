import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack, GrowthEffect, GrowthIdentity, GrowthResourceEffect, GrowthRuleActor } from './types';
import type { GrowthPrerequisiteFacts } from './evaluator';
import { canLearnGrowthSkill, growthSkillDefinition, type GrowthSkillBuild } from './skills';
import { addGrowthIntegers } from './experience';

export type GrowthIdentityPack = DeepReadonly<GrowthDefinitionPack>;
export type GrowthIdentityDefinition = DeepReadonly<GrowthIdentity>;
export type GrowthIdentityFacts = Pick<GrowthPrerequisiteFacts, 'professionId' | 'lineageId' | 'faithId'>;
/** Choice indexes refer to the selected definition's immutable, versioned choices list. Amounts are ranks; points pay pointCost. */
export type GrowthIdentityChoice = { identityId: string; choiceIndex: number; attributes: Record<string, number> };
export type GrowthIdentitySelection = { professionId: string | null; lineageId: string | null; faithId: string | null; choices: GrowthIdentityChoice[] };
/** Shared player/NPC component. Template attributes already include the identity budget, so grants are never applied twice. */
export type GrowthIdentityBuild = GrowthIdentitySelection & { templateId: string | null };
export type GrowthCreateCharacterPayload = GrowthIdentitySelection & { revision: number };
const kinds = ['profession', 'lineage', 'faith'] as const;
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
const invalid = (): never => { throw new RangeError('Invalid growth identity selection'); };
function record(value: unknown, keys?: readonly string[]): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value), own = Reflect.ownKeys(value);
    if (prototype !== Object.prototype && prototype !== null || keys && own.length !== keys.length) return false;
    return own.every(key => {
        if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key) || keys && !keys.includes(key)) return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        return descriptor.enumerable && Object.prototype.hasOwnProperty.call(descriptor, 'value');
    });
}
function list(value: unknown): value is unknown[] {
    return Array.isArray(value) && Reflect.ownKeys(value).length === value.length + 1 && Object.keys(value).length === value.length
        && Object.keys(value).every((key, index) => key === String(index)
            && Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value,key)!, 'value'));
}
export function initialGrowthIdentityBuild(): GrowthIdentityBuild {
    return { professionId: null, lineageId: null, faithId: null, choices: [], templateId: null };
}
export function growthIdentityDefinition(pack: GrowthIdentityPack, id: string): GrowthIdentityDefinition | undefined {
    return pack.definitions.find((definition): definition is GrowthIdentityDefinition => definition.kind !== 'skill' && definition.id === id);
}
export function growthIdentityDefinitions(pack: GrowthIdentityPack, identity?: GrowthIdentityFacts): readonly GrowthIdentityDefinition[] {
    return kinds.flatMap(kind => {
        const id = identity?.[`${kind}Id`], definition = id ? growthIdentityDefinition(pack,id) : undefined;
        return definition?.kind === kind && pack.config.identities.enabled[`${kind}s`] ? [definition] : [];
    });
}
export function growthIdentityEffects(pack: GrowthIdentityPack, identity?: GrowthIdentityFacts): readonly DeepReadonly<GrowthEffect>[] {
    return growthIdentityDefinitions(pack,identity).flatMap(definition => [...definition.effects,...definition.oaths.flatMap(oath=>oath.effects)]);
}
export function growthIdentityGiftIds(pack: GrowthIdentityPack, identity?: GrowthIdentityFacts): string[] {
    return [...new Set(growthIdentityDefinitions(pack,identity).flatMap(definition=>definition.gifts.map(gift=>gift.skillId)))].sort();
}
function giftBudget(pack: GrowthIdentityPack, ids: readonly string[]): boolean {
    const counts = {active:0,passive:0};
    for (const id of new Set(ids)) {
        const skill = growthSkillDefinition(pack,id);
        if (!skill) return false;
        counts[skill.mode]++;
    }
    return counts.active <= pack.config.identities.giftLimits.active && counts.passive <= pack.config.identities.giftLimits.passive;
}
function validValues(pack: GrowthIdentityPack, values: Readonly<Record<string, number>>): boolean {
    let total = 0n;
    for (const attribute of pack.config.attributes) {
        const value = values[attribute.id];
        if (!integer(value) || value < attribute.min || value > attribute.cap
            || attribute.id === pack.config.strengthTraining.attributeId && value > pack.config.strengthTraining.cap) return false;
        total += BigInt(value);
    }
    return pack.config.attributeTotalCap === null || total <= BigInt(pack.config.attributeTotalCap);
}
function selectionValues(pack: GrowthIdentityPack, selection: GrowthIdentitySelection): Record<string, number> {
    const values = Object.fromEntries(pack.config.attributes.map(attribute=>[attribute.id,attribute.initial]));
    const definitions = growthIdentityDefinitions(pack,selection);
    for (const definition of definitions) for (const grant of definition.attributes) values[grant.attributeId] = addGrowthIntegers(values[grant.attributeId]!,grant.amount);
    for (const choice of selection.choices) for (const [id,amount] of Object.entries(choice.attributes)) values[id] = addGrowthIntegers(values[id]!,amount);
    return values;
}
function validateSelection(pack: GrowthIdentityPack, selection: unknown, allowNeutral: boolean): selection is GrowthIdentitySelection {
    if (!record(selection,['professionId','lineageId','faithId','choices']) || !list(selection.choices)) return false;
    if (allowNeutral && kinds.every(kind=>selection[`${kind}Id`] === null) && selection.choices.length === 0) return true;
    const definitions: GrowthIdentityDefinition[] = [];
    for (const kind of kinds) {
        const id = selection[`${kind}Id`];
        if (!pack.config.identities.enabled[`${kind}s`]) { if (id !== null) return false; continue; }
        if (typeof id !== 'string') return false;
        const definition = growthIdentityDefinition(pack,id);
        if (definition?.kind !== kind) return false;
        definitions.push(definition);
    }
    // Exactly one entry per declared choice, in definition dimension/index order. No discarded/unknown choices.
    const expected = definitions.flatMap(definition=>definition.choices.map((choice,index)=>({definition,choice,index})));
    if (selection.choices.length !== expected.length) return false;
    for (const [index,item] of selection.choices.entries()) {
        const target = expected[index]!;
        if (!record(item,['identityId','choiceIndex','attributes']) || item.identityId !== target.definition.id || item.choiceIndex !== target.index
            || !record(item.attributes)) return false;
        let cost = 0n;
        for (const [id,amount] of Object.entries(item.attributes)) {
            if (!target.choice.attributeIds.includes(id) || !integer(amount,1) || amount > target.choice.perAttributeCap) return false;
            const attribute = pack.config.attributes.find(attribute=>attribute.id === id);
            if (!attribute) return false;
            cost += BigInt(amount) * BigInt(attribute.pointCost);
        }
        if (cost !== BigInt(target.choice.points)) return false;
    }
    for (const definition of definitions) {
        const cost = definition.attributes.reduce((total,grant)=>total + BigInt(grant.amount) * BigInt(pack.config.attributes.find(attribute=>attribute.id === grant.attributeId)!.pointCost),0n)
            + definition.choices.reduce((total,choice)=>total + BigInt(choice.points),0n);
        if (cost > BigInt(pack.config.identities.budgets[definition.kind])) return false;
    }
    return giftBudget(pack,growthIdentityGiftIds(pack,selection as GrowthIdentitySelection)) && validValues(pack,selectionValues(pack,selection as GrowthIdentitySelection));
}
/** Atomic preflight: no caller-owned input is changed and no resource/derived bonus is committed here. */
export function createGrowthIdentityBuild(pack: GrowthIdentityPack, selection: unknown): GrowthIdentityBuild {
    if (!validateSelection(pack,selection,false)) return invalid();
    return { ...structuredClone(selection), templateId: null };
}
export function isGrowthIdentityBuild(value: unknown, pack: GrowthIdentityPack, allowNeutral = false): value is GrowthIdentityBuild {
    try {
        if (!record(value,['professionId','lineageId','faithId','choices','templateId'])) return false;
        if (value.templateId === null) {
            const { templateId: _, ...selection } = value;
            return validateSelection(pack,selection,allowNeutral);
        }
        if (typeof value.templateId !== 'string' || !list(value.choices) || value.choices.length) return false;
        const template = pack.config.monsters.templates.find(template=>template.id === value.templateId);
        return !!template && kinds.every(kind=>value[`${kind}Id`] === template[`${kind}Id`]
            && (value[`${kind}Id`] === null || pack.config.identities.enabled[`${kind}s`]));
    } catch { return false; }
}
export function growthIdentityAttributeValues(pack: GrowthIdentityPack, identity: DeepReadonly<GrowthIdentityBuild>): Record<string, number> {
    if (!isGrowthIdentityBuild(identity,pack,true)) return invalid();
    if (identity.templateId === null) return selectionValues(pack,identity as GrowthIdentityBuild);
    const template = pack.config.monsters.templates.find(template=>template.id === identity.templateId)!;
    return Object.fromEntries(pack.config.attributes.map(attribute=>[attribute.id,addGrowthIntegers(attribute.initial,
        template.attributes.find(grant=>grant.attributeId === attribute.id)?.amount ?? 0)]));
}
function gcd(left: bigint, right: bigint): bigint {
    while (right) { const remainder = left % right; left = right; right = remainder; }
    return left;
}
/** Extended Euclid gives a modular inverse without iterating over a configured rank/point budget. */
function inverse(value: bigint, modulus: bigint): bigint {
    let previous = 1n, current = 0n, left = value, right = modulus;
    while (right) {
        const quotient = left / right;
        [left,right] = [right,left-quotient*right]; [previous,current] = [current,previous-quotient*current];
    }
    return ((previous % modulus) + modulus) % modulus;
}
/** Reversible default preview. Bounded data-order proposal search respects weighted budgets and overlapping caps.
 * Complex custom packs may return explicitly unfilled choices; only createGrowthIdentityBuild authorizes a selection.
 * The search limit bounds preview work, never playable attribute values or valid explicit player choices. */
export function defaultGrowthIdentitySelection(pack: GrowthIdentityPack): GrowthIdentitySelection {
    const selection: GrowthIdentitySelection = { professionId:null,lineageId:null,faithId:null,choices:[] };
    for (const kind of kinds) if (pack.config.identities.enabled[`${kind}s`]) selection[`${kind}Id`] = pack.config.identities.defaults[`${kind}Id`];
    const definitions = growthIdentityDefinitions(pack,selection), values = selectionValues(pack,selection);
    const choices = definitions.flatMap(definition=>definition.choices.map((choice,choiceIndex)=>({definition,choice,choiceIndex})));
    const unfilled = (): GrowthIdentitySelection => ({...selection,choices:choices.map(({definition,choiceIndex})=>({identityId:definition.id,choiceIndex,attributes:{}}))});
    if (!validValues(pack,values)) return unfilled();
    let proposals = 0;
    const visit = (index: number): boolean => {
        if (index === choices.length) return true;
        const {definition,choice,choiceIndex} = choices[index]!, attributes: Record<string,number> = {};
        const choose = (attributeIndex: number, remaining: number): boolean => {
            if (!remaining) {
                selection.choices.push({identityId:definition.id,choiceIndex,attributes:{...attributes}});
                if (visit(index+1)) return true;
                selection.choices.pop(); return false;
            }
            if (attributeIndex === choice.attributeIds.length) return false;
            const id = choice.attributeIds[attributeIndex]!, attribute = pack.config.attributes.find(attribute=>attribute.id === id)!;
            const totalRemaining = pack.config.attributeTotalCap === null ? Number.MAX_SAFE_INTEGER
                : pack.config.attributeTotalCap - Object.values(values).reduce((sum,value)=>sum+value,0);
            const cap = attribute.id === pack.config.strengthTraining.attributeId ? Math.min(attribute.cap,pack.config.strengthTraining.cap) : attribute.cap;
            const maximum = Math.min(choice.perAttributeCap,cap-values[id]!,Math.floor(remaining/attribute.pointCost),totalRemaining);
            const suffix = choice.attributeIds.slice(attributeIndex+1).map(id=> {
                const definition = pack.config.attributes.find(attribute=>attribute.id === id)!;
                const cap = definition.id === pack.config.strengthTraining.attributeId ? Math.min(definition.cap,pack.config.strengthTraining.cap) : definition.cap;
                return {cost:BigInt(definition.pointCost),capacity:BigInt(Math.min(choice.perAttributeCap,cap-values[id]!))};
            });
            const points = BigInt(remaining), cost = BigInt(attribute.pointCost), suffixCapacity = suffix.reduce((sum,item)=>sum+item.cost*item.capacity,0n);
            const needed = points > suffixCapacity ? points-suffixCapacity : 0n, minimum = (needed+cost-1n)/cost;
            const divisor = suffix.reduce((sum,item)=>gcd(sum,item.cost),0n);
            let candidate: bigint, stride: bigint;
            if (!divisor) {
                if (points % cost) return false;
                candidate = points/cost; stride = candidate+1n;
            } else {
                const common = gcd(cost,divisor);
                if (points % common) return false;
                stride = divisor/common;
                const residue = stride === 1n ? 0n : (points/common * inverse(cost/common,stride)) % stride;
                const upper = BigInt(maximum);
                if (upper < residue) return false;
                candidate = upper - (upper-residue) % stride;
            }
            if (candidate > BigInt(maximum)) return false;
            for (; candidate >= minimum && proposals < 512; candidate -= stride) {
                proposals++;
                const amount = Number(candidate);
                if (amount) attributes[id] = amount;
                values[id]! += amount;
                if (choose(attributeIndex+1,remaining-amount*attribute.pointCost)) return true;
                values[id]! -= amount; delete attributes[id];
            }
            return false;
        };
        return choose(0,choice.points);
    };
    if (!visit(0)) return unfilled();
    return selection;
}
/** Gifts are distinct from clone inheritance; prerequisite waivers apply only at this explicit grant boundary. */
export function grantGrowthIdentitySkills(pack: GrowthIdentityPack, identity: GrowthIdentityFacts, actor: GrowthRuleActor,
    build: DeepReadonly<GrowthSkillBuild>, equip = true): GrowthSkillBuild {
    const result = structuredClone(build) as GrowthSkillBuild;
    const gifts = new Map<string,boolean>();
    for (const definition of growthIdentityDefinitions(pack,identity)) for (const gift of definition.gifts)
        gifts.set(gift.skillId,(gifts.get(gift.skillId) ?? false) || gift.waivePrerequisites);
    if (!giftBudget(pack,[...gifts.keys()])) return invalid();
    // All declared gift IDs are available to prerequisite checks, independent of definition/list ordering.
    const learned = [...new Set([...build.learned,...gifts.keys()])].sort();
    for (const [id,waived] of gifts) {
        const skill = growthSkillDefinition(pack,id);
        if (!skill || !waived && !build.learned.includes(id) && !canLearnGrowthSkill(pack,skill,actor,
            {...result,learned:learned.filter(other=>other !== id)},identity)) return invalid();
        if (result.learned.includes(id) && !result.gifted.includes(id) && !result.inherited.includes(id)) return invalid();
        if (!result.learned.includes(id)) { result.learned.push(id); result.gifted.push(id); }
        const slots = skill.mode === 'active' ? result.active : result.passive;
        if (equip && !slots.includes(id) && slots.length < pack.config.skills[`${skill.mode}Slots`]) slots.push(id);
    }
    result.learned.sort(); result.gifted.sort();
    return result;
}
/** Receipts are actor/effect/depth scoped; the runtime commits them even when resource bounds absorb the grant. */
export function growthIdentityFirstVisitEffects(pack: GrowthIdentityPack, identity: GrowthIdentityFacts | undefined, actorId: number,
    depth: number, receipts: readonly string[]): { receiptKey: string; effect: DeepReadonly<GrowthResourceEffect> }[] {
    if (!integer(actorId,1) || !integer(depth,1)) return invalid();
    return growthIdentityEffects(pack,identity).flatMap(effect => {
        if (effect.kind !== 'resource' || depth < effect.trigger.minDepth || depth > effect.trigger.maxDepth) return [];
        const receiptKey = `${effect.id}:${actorId}:${depth}`;
        return receipts.includes(receiptKey) ? [] : [{receiptKey,effect}];
    });
}
