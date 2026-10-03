import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack, GrowthEffect, GrowthModifier, GrowthRuleActor, GrowthRulePort, GrowthSkill, GrowthTimedEffect, GrowthTaggedModifier, GrowthMagnitude } from './types';
import type { GrowthFocus, GrowthSkills } from './components';
import { evaluateGrowthMagnitude, evaluateGrowthModifiers, evaluateGrowthPort, matchesGrowthConditions, meetsGrowthPrerequisites,
    type GrowthEvaluationFacts, type GrowthPrerequisiteFacts, type GrowthScopedModifiers } from './evaluator';
import { growthScalarInput } from './attributes';
import { addGrowthIntegers } from './experience';
import { isJson } from '../../json';
import { growthIdentityDefinitions, growthIdentityEffects, growthIdentityGiftIds, growthIdentityDefinition, type GrowthIdentityFacts } from './identities';

type Pack = DeepReadonly<GrowthDefinitionPack>;
export type GrowthSkillDefinition = DeepReadonly<GrowthSkill>;
/** Immutable casting facts survive the source's departure; queries never need to keep a creature alive. */
export type GrowthEffectInstance = {
    instanceId: number; skillId: string; effectId: string; source: GrowthRuleActor; taggedSources: string[];
    startedAt: number; expiresAt: number | null; actionId: number | null; remaining: number;
};
export type GrowthSkillBuild = { inherited: string[]; gifted: string[]; learned: string[]; active: string[]; passive: string[]; effects: GrowthEffectInstance[] };
/** Display-only effect math. Casting provenance and source attributes never cross this boundary. */
export type GrowthPublicEffect = {
    expiresAt: number | null; tags: string[]; modifiers: GrowthModifier[]; taggedModifiers: GrowthTaggedModifier[];
};
export type GrowthPublicSkillBuild = {
    learned: string[]; inherited: string[]; active: string[]; passive: string[]; effects: GrowthPublicEffect[];
};
export function initialGrowthSkillBuild(): GrowthSkillBuild { return { inherited: [], gifted: [], learned: [], active: [], passive: [], effects: [] }; }
export function inheritGrowthSkillBuild(source: DeepReadonly<GrowthSkillBuild>): GrowthSkillBuild {
    return {inherited:[...source.learned],gifted:[],learned:[...source.learned],active:[...source.active],passive:[...source.passive],effects:[]};
}
export function growthSkillDefinition(pack: Pack, id: string): GrowthSkillDefinition | undefined {
    return pack.definitions.find((definition): definition is GrowthSkillDefinition => definition.kind === 'skill' && definition.id === id);
}
export function growthTimedDefinition(pack: Pack, instance: DeepReadonly<GrowthEffectInstance>): DeepReadonly<GrowthTimedEffect> | undefined {
    return growthSkillDefinition(pack,instance.skillId)?.effects.find((effect): effect is DeepReadonly<GrowthTimedEffect> => effect.kind === 'timed' && effect.id === instance.effectId);
}
export function growthPassiveEffects(pack: Pack, build: DeepReadonly<Pick<GrowthSkillBuild,'passive'>>, identity?: GrowthIdentityFacts): readonly DeepReadonly<GrowthEffect>[] {
    return [...build.passive.flatMap(id => growthSkillDefinition(pack,id)?.effects ?? []),...growthIdentityEffects(pack,identity)];
}
/** Immutable definition IDs capture casting-time tags without retaining a departed creature. */
export function growthTaggedSources(pack: Pack, build: DeepReadonly<GrowthSkillBuild>, identity?: GrowthIdentityFacts): string[] {
    return [...build.passive,...growthIdentityDefinitions(pack,identity).map(definition=>definition.id)].sort();
}
function effectsForSources(pack: Pack, sources: readonly string[]): readonly DeepReadonly<GrowthEffect>[] {
    return sources.flatMap(id => {
        const definition = growthSkillDefinition(pack,id) ?? growthIdentityDefinition(pack,id);
        return !definition ? [] : definition.kind === 'skill' ? definition.effects
            : [...definition.effects,...definition.oaths.flatMap(oath=>oath.effects)];
    });
}
export function canLearnGrowthSkill(pack: Pack, skill: GrowthSkillDefinition, actor: GrowthRuleActor,
    build: DeepReadonly<Pick<GrowthSkillBuild,'learned'>>, identity: Pick<GrowthPrerequisiteFacts,'professionId'|'lineageId'|'faithId'> = {}): boolean {
    if (build.learned.includes(skill.id) || !meetsGrowthPrerequisites(skill.prerequisites,{...actor,...identity,skills:build.learned})) return false;
    // min(global, per-skill); soft is deliberately only a recommendation.
    if (pack.config.skills.lockMode !== 'hard' || skill.lock.mode !== 'hard') return true;
    return (!skill.lock.professionIds.length || skill.lock.professionIds.includes(identity.professionId ?? ''))
        && (!skill.lock.lineageIds.length || skill.lock.lineageIds.includes(identity.lineageId ?? ''))
        && (!skill.lock.faithIds.length || skill.lock.faithIds.includes(identity.faithId ?? ''));
}
/** Bounded property evaluator; callers select declared targets, never arbitrary object paths. */
export function growthTaggedProperty(pack: Pack, property: 'duration'|'intensity'|'cooldown', base: number,
    tags: readonly string[], actor: GrowthRuleActor, effects: readonly DeepReadonly<GrowthEffect>[], facts: GrowthEvaluationFacts = {}): number {
    const modifiers = effects.flatMap(effect => effect.kind === 'tagged-modifier' && effect.property === property && tags.includes(effect.tag)
        && matchesGrowthConditions(effect.conditions,{role:'actor',...facts,tags})
        ? [{operation:effect.operation,slot:effect.slot,magnitude:evaluateGrowthMagnitude(effect.magnitude,actor)}] : []);
    return evaluateGrowthModifiers(pack.config.rules,pack.config.rules.taggedProperties[property],base,modifiers);
}
function taggedModifiers(effects: readonly DeepReadonly<GrowthEffect>[]): readonly DeepReadonly<GrowthTaggedModifier>[] {
    return effects.filter((effect): effect is DeepReadonly<GrowthTaggedModifier> => effect.kind === 'tagged-modifier');
}
function permanentSkillScopes(pack: Pack, build: DeepReadonly<Pick<GrowthSkillBuild,'passive'>>, owner: 'actor'|'target',
    identity?: GrowthIdentityFacts): readonly GrowthScopedModifiers[] {
    const tags = taggedModifiers(growthPassiveEffects(pack,build,identity));
    return [{owner,modifiers:growthIdentityEffects(pack,identity).filter((effect): effect is DeepReadonly<GrowthModifier> => effect.kind === 'modifier'),taggedModifiers:tags},...build.passive.flatMap(id => {
        const skill = growthSkillDefinition(pack,id); return skill ? [{owner,tags:skill.tags,taggedModifiers:tags,
            modifiers:skill.effects.filter((effect): effect is DeepReadonly<GrowthModifier> => effect.kind === 'modifier')}] : [];
    })];
}
export function growthSkillScopes(pack: Pack, build: DeepReadonly<GrowthSkillBuild>, clock = 0,
    owner: 'actor'|'target' = 'actor', identity?: GrowthIdentityFacts): readonly GrowthScopedModifiers[] {
    return [...permanentSkillScopes(pack,build,owner,identity),...build.effects.filter(instance=>instance.expiresAt === null || instance.expiresAt > clock).flatMap(instance=> {
        const effect = growthTimedDefinition(pack,instance);
        return effect ? [{owner,tags:effect.tags,source:instance.source,modifiers:effect.modifiers,
            taggedModifiers:taggedModifiers(effectsForSources(pack,instance.taggedSources))}] : [];
    })];
}
function constantMagnitude(magnitude: DeepReadonly<GrowthMagnitude>, source: GrowthRuleActor): GrowthMagnitude {
    const value = evaluateGrowthMagnitude(magnitude,source);
    // Equal bounds preserve exact fractional clamp endpoints as well as integer magnitudes.
    return {source:{kind:'constant'},coefficient:value,divisor:1,rounding:magnitude.rounding,min:value,max:value};
}
/** Detached player DTO. Keep conditional modifier evaluation deferred until the actual preview facts are known. */
export function projectGrowthSkillBuild(pack: Pack, build: DeepReadonly<GrowthSkillBuild>): GrowthPublicSkillBuild {
    return {learned:[...build.learned],inherited:[...build.inherited],active:[...build.active],passive:[...build.passive],effects:build.effects.map(instance=> {
        const effect = growthTimedDefinition(pack,instance);
        if (!effect) throw new RangeError('Invalid growth effect projection');
        return {expiresAt:instance.expiresAt,tags:[...effect.tags],
            modifiers:effect.modifiers.map(modifier=>({...structuredClone(modifier) as GrowthModifier,magnitude:constantMagnitude(modifier.magnitude,instance.source)})),
            taggedModifiers:taggedModifiers(effectsForSources(pack,instance.taggedSources)).map(modifier=>({...structuredClone(modifier) as GrowthTaggedModifier,
                magnitude:constantMagnitude(modifier.magnitude,instance.source)}))};
    })};
}
export function growthPublicSkillScopes(pack: Pack, build: DeepReadonly<GrowthPublicSkillBuild>, clock = 0,
    owner: 'actor'|'target' = 'actor', identity?: GrowthIdentityFacts): readonly GrowthScopedModifiers[] {
    return [...permanentSkillScopes(pack,build,owner,identity),...build.effects.filter(effect=>effect.expiresAt === null || effect.expiresAt > clock)
        .map(effect=>({owner,tags:effect.tags,modifiers:effect.modifiers,taggedModifiers:effect.taggedModifiers}))];
}
export function growthPublicSkillScalar(pack: Pack, port: GrowthRulePort, actor: GrowthRuleActor,
    build: DeepReadonly<GrowthPublicSkillBuild>, base: number, clock = 0, identity?: GrowthIdentityFacts): number {
    return evaluateGrowthPort(pack,port,growthScalarInput(actor,base),growthPublicSkillScopes(pack,build,clock,'actor',identity));
}
export function growthPublicSkillCooldown(pack: Pack, skill: GrowthSkillDefinition, actor: GrowthRuleActor,
    build: DeepReadonly<GrowthPublicSkillBuild>, clock = 0, identity?: GrowthIdentityFacts): number {
    const taggedBase = growthTaggedProperty(pack,'cooldown',skill.cooldown,skill.tags,actor,growthPassiveEffects(pack,build,identity));
    return evaluateGrowthPort(pack,'cooldownDuration',{...growthScalarInput(actor,taggedBase),baseCooldown:taggedBase},growthPublicSkillScopes(pack,build,clock,'actor',identity));
}
export function growthSkillScalar(pack: Pack, port: GrowthRulePort, actor: GrowthRuleActor,
    build: DeepReadonly<GrowthSkillBuild>, base: number, clock = 0, identity?: GrowthIdentityFacts): number {
    return evaluateGrowthPort(pack,port,growthScalarInput(actor,base),growthSkillScopes(pack,build,clock,'actor',identity));
}
export function growthSkillCooldown(pack: Pack, skill: GrowthSkillDefinition, actor: GrowthRuleActor,
    build: DeepReadonly<GrowthSkillBuild>, clock = 0, identity?: GrowthIdentityFacts): number {
    const taggedBase = growthTaggedProperty(pack,'cooldown',skill.cooldown,skill.tags,actor,growthPassiveEffects(pack,build,identity));
    return evaluateGrowthPort(pack,'cooldownDuration',{...growthScalarInput(actor,taggedBase),baseCooldown:taggedBase},growthSkillScopes(pack,build,clock,'actor',identity));
}
export function growthEffectDuration(pack: Pack, effect: DeepReadonly<GrowthTimedEffect>, actor: GrowthRuleActor,
    taggedSources: readonly string[]): number | null {
    if (effect.duration.kind === 'action') return null;
    const effects = effectsForSources(pack,taggedSources);
    return Math.min(effect.duration.cap,growthTaggedProperty(pack,'duration',effect.duration.blocks,effect.tags,actor,effects));
}
export function createGrowthEffectInstance(pack: Pack, skill: GrowthSkillDefinition, effect: DeepReadonly<GrowthTimedEffect>,
    source: GrowthRuleActor, build: DeepReadonly<GrowthSkillBuild>, clock: number, actionId: number, instanceId: number, identity?: GrowthIdentityFacts): GrowthEffectInstance {
    const taggedSources = growthTaggedSources(pack,build,identity), duration = growthEffectDuration(pack,effect,source,taggedSources);
    return {instanceId,skillId:skill.id,effectId:effect.id,source:structuredClone(source),taggedSources,startedAt:clock,
        expiresAt:duration === null ? null : addGrowthIntegers(clock,duration),actionId:duration === null ? actionId : null,remaining:effect.consume.count};
}
/** Normalize elapsed credit at a commit, including after an interval change; never from a getter. */
export function advanceGrowthFocus(pack: Pack, focus: Readonly<GrowthFocus>, capacity: number, interval: number, blocks: number): GrowthFocus {
    const credit = addGrowthIntegers(focus.remainder,blocks), count = Math.floor(credit / interval);
    const total = BigInt(focus.current) + BigInt(count) * BigInt(pack.config.focus.recoveryAmount);
    const current = Number(total > BigInt(capacity) ? BigInt(capacity) : total);
    return {current,remainder:current === capacity && pack.config.focus.resetRemainderWhenFull ? 0 : credit % interval};
}
export function growthLearnedCost(pack: Pack, build: DeepReadonly<GrowthSkillBuild>): number {
    return build.learned.filter(id=>!build.inherited.includes(id) && !build.gifted.includes(id)).reduce((sum,id) => addGrowthIntegers(sum,growthSkillDefinition(pack,id)!.cost),0);
}
function validTaggedSources(pack: Pack, value: unknown): value is string[] {
    if (!Array.isArray(value) || !value.every((id,index)=>typeof id === 'string' && (index === 0 || value[index-1]! < id))) return false;
    const dimensions = new Set<string>();
    return value.every(id=> {
        const skill = growthSkillDefinition(pack,id);
        if (skill) return skill.mode === 'passive';
        const identity = growthIdentityDefinition(pack,id);
        if (!identity || !pack.config.identities.enabled[`${identity.kind}s`] || dimensions.has(identity.kind)) return false;
        dimensions.add(identity.kind); return true;
    });
}
function sameIdentitySources(pack: Pack, sources: readonly string[], identity: GrowthIdentityFacts): boolean {
    return sources.filter(id=>!!growthIdentityDefinition(pack,id)).join(',') === growthIdentityDefinitions(pack,identity).map(definition=>definition.id).sort().join(',');
}
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
const exact = (value: unknown, keys: string): value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === keys;
function dataProperties(value: unknown, seen = new Set<object>()): boolean {
    if (value === null || typeof value !== 'object') return true;
    if (seen.has(value)) return false;
    seen.add(value);
    const valid = Reflect.ownKeys(value).every(key=> {
        if (typeof key !== 'string') return false;
        if (Array.isArray(value) && key === 'length') return true;
        const descriptor = Object.getOwnPropertyDescriptor(value,key)!;
        return descriptor.enumerable && Object.prototype.hasOwnProperty.call(descriptor,'value') && dataProperties(descriptor.value,seen);
    });
    seen.delete(value); return valid;
}
/** Stored action-scope instances are never valid at a public save/checkpoint boundary. */
export function isGrowthSkillBuild(value: unknown, pack: Pack, actorId: number, clock: number, nextEffectId: number, identity?: GrowthIdentityFacts): value is GrowthSkillBuild {
    try {
    if (!dataProperties(value) || !isJson(value) || !exact(value,'active,effects,gifted,inherited,learned,passive')) return false;
    const ids = (list: unknown): list is string[] => Array.isArray(list) && list.every(id => typeof id === 'string' && !!growthSkillDefinition(pack,id))
        && list.every((id,index) => index === 0 || list[index-1]! < id);
    const slotIds = (list: unknown): list is string[] => Array.isArray(list) && new Set(list).size === list.length && list.every(id=>typeof id === 'string' && !!growthSkillDefinition(pack,id));
    if (!ids(value.inherited) || !ids(value.gifted) || !ids(value.learned) || value.inherited.some(id=>!(value.learned as string[]).includes(id))
        || value.gifted.some(id=>!(value.learned as string[]).includes(id) || !growthIdentityGiftIds(pack,identity).includes(id)) || !slotIds(value.active) || !slotIds(value.passive) || !Array.isArray(value.effects)
        || value.active.length > pack.config.skills.activeSlots || value.passive.length > pack.config.skills.passiveSlots) return false;
    const learned = value.learned;
    if (value.active.some(id => !learned.includes(id) || growthSkillDefinition(pack,id)!.mode !== 'active')
        || value.passive.some(id => !learned.includes(id) || growthSkillDefinition(pack,id)!.mode !== 'passive')) return false;
    let last = 0;
    for (const item of value.effects) {
        if (!exact(item,'actionId,effectId,expiresAt,instanceId,remaining,skillId,source,startedAt,taggedSources') || !integer(item.instanceId,1)
            || item.instanceId <= last || item.instanceId >= nextEffectId || !integer(item.startedAt) || item.startedAt > clock
            || item.actionId !== null || !integer(item.expiresAt) || !integer(item.remaining)
            || typeof item.skillId !== 'string' || typeof item.effectId !== 'string' || !validTaggedSources(pack,item.taggedSources)
            || !exact(item.source,'attributes,id,level') || !integer(item.source.id,1) || !integer(item.source.level,1)
            || item.source.level > pack.config.levels.cap || !exact(item.source.attributes,pack.config.attributes.map(a=>a.id).sort().join(','))) return false;
        const source = item.source as unknown as GrowthRuleActor;
        if (source.id === actorId && identity !== undefined && !sameIdentitySources(pack,item.taggedSources,identity)) return false;
        if (pack.config.attributes.some(a=>!integer(source.attributes[a.id]) || source.attributes[a.id]! < a.min || source.attributes[a.id]! > a.cap
            || a.id === pack.config.strengthTraining.attributeId && source.attributes[a.id]! > pack.config.strengthTraining.cap)
            || pack.config.attributeTotalCap !== null && Object.values(source.attributes).reduce((sum,value)=>sum+BigInt(value),0n) > BigInt(pack.config.attributeTotalCap)) return false;
        const instance = item as unknown as GrowthEffectInstance, effect = growthTimedDefinition(pack,instance);
        if (!effect || effect.duration.kind !== 'objective-blocks' || (effect.recipient === 'self' && source.id !== actorId)
            || (effect.consume.event === 'none' ? instance.remaining !== 0 : instance.remaining < 1 || instance.remaining > effect.consume.count)) return false;
        const duration = growthEffectDuration(pack,effect,source,instance.taggedSources)!;
        if (instance.expiresAt !== addGrowthIntegers(instance.startedAt,duration)) return false;
        last = item.instanceId;
    }
    return true;
    } catch { return false; }
}
export function validGrowthCooldowns(skills: Readonly<GrowthSkills>, build: DeepReadonly<GrowthSkillBuild>): boolean {
    return Object.keys(skills.readyAt).every(id=>build.learned.includes(id));
}
