import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack, GrowthEffect, GrowthModifier, GrowthRuleActor, GrowthRulePort, GrowthSkill, GrowthTimedEffect, GrowthTaggedModifier } from './types';
import type { GrowthFocus, GrowthSkills } from './components';
import { evaluateGrowthMagnitude, evaluateGrowthModifiers, evaluateGrowthPort, matchesGrowthConditions, meetsGrowthPrerequisites,
    type GrowthEvaluationFacts, type GrowthPrerequisiteFacts, type GrowthScopedModifiers } from './evaluator';
import { growthScalarInput } from './attributes';
import { addGrowthIntegers } from './experience';
import { isJson } from '../../json';

type Pack = DeepReadonly<GrowthDefinitionPack>;
export type GrowthSkillDefinition = DeepReadonly<GrowthSkill>;
/** Immutable casting facts survive the source's departure; queries never need to keep a creature alive. */
export type GrowthEffectInstance = {
    instanceId: number; skillId: string; effectId: string; source: GrowthRuleActor; taggedSources: string[];
    startedAt: number; expiresAt: number | null; actionId: number | null; remaining: number;
};
export type GrowthSkillBuild = { inherited: string[]; learned: string[]; active: string[]; passive: string[]; effects: GrowthEffectInstance[] };
export function initialGrowthSkillBuild(): GrowthSkillBuild { return { inherited: [], learned: [], active: [], passive: [], effects: [] }; }
export function inheritGrowthSkillBuild(source: DeepReadonly<GrowthSkillBuild>): GrowthSkillBuild {
    return {inherited:[...source.learned],learned:[...source.learned],active:[...source.active],passive:[...source.passive],effects:[]};
}
export function growthSkillDefinition(pack: Pack, id: string): GrowthSkillDefinition | undefined {
    return pack.definitions.find((definition): definition is GrowthSkillDefinition => definition.kind === 'skill' && definition.id === id);
}
export function growthTimedDefinition(pack: Pack, instance: DeepReadonly<GrowthEffectInstance>): DeepReadonly<GrowthTimedEffect> | undefined {
    return growthSkillDefinition(pack,instance.skillId)?.effects.find((effect): effect is DeepReadonly<GrowthTimedEffect> => effect.kind === 'timed' && effect.id === instance.effectId);
}
export function growthPassiveEffects(pack: Pack, build: DeepReadonly<GrowthSkillBuild>): readonly DeepReadonly<GrowthEffect>[] {
    return build.passive.flatMap(id => growthSkillDefinition(pack,id)?.effects ?? []);
}
export function canLearnGrowthSkill(pack: Pack, skill: GrowthSkillDefinition, actor: GrowthRuleActor,
    build: DeepReadonly<GrowthSkillBuild>, identity: Pick<GrowthPrerequisiteFacts,'professionId'|'lineageId'|'faithId'> = {}): boolean {
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
export function growthSkillScopes(pack: Pack, build: DeepReadonly<GrowthSkillBuild>, clock = 0,
    owner: 'actor'|'target' = 'actor'): readonly GrowthScopedModifiers[] {
    const tagged = (effects: readonly DeepReadonly<GrowthEffect>[]) => effects.filter((effect): effect is DeepReadonly<GrowthTaggedModifier> => effect.kind === 'tagged-modifier');
    const passive = growthPassiveEffects(pack,build), taggedModifiers = tagged(passive);
    return [...build.passive.flatMap(id => {
        const skill = growthSkillDefinition(pack,id); return skill ? [{owner,tags:skill.tags,taggedModifiers,
            modifiers:skill.effects.filter((effect): effect is DeepReadonly<GrowthModifier> => effect.kind === 'modifier')}] : [];
    }),...build.effects.filter(instance=>instance.expiresAt === null || instance.expiresAt > clock).flatMap(instance=> {
        const effect = growthTimedDefinition(pack,instance);
        return effect ? [{owner,tags:effect.tags,source:instance.source,modifiers:effect.modifiers,
            taggedModifiers:tagged(instance.taggedSources.flatMap(id=>growthSkillDefinition(pack,id)?.effects ?? []))}] : [];
    })];
}
export function growthSkillScalar(pack: Pack, port: GrowthRulePort, actor: GrowthRuleActor,
    build: DeepReadonly<GrowthSkillBuild>, base: number, clock = 0): number {
    return evaluateGrowthPort(pack,port,growthScalarInput(actor,base),growthSkillScopes(pack,build,clock));
}
export function growthSkillCooldown(pack: Pack, skill: GrowthSkillDefinition, actor: GrowthRuleActor,
    build: DeepReadonly<GrowthSkillBuild>, clock = 0): number {
    const taggedBase = growthTaggedProperty(pack,'cooldown',skill.cooldown,skill.tags,actor,growthPassiveEffects(pack,build));
    return evaluateGrowthPort(pack,'cooldownDuration',{...growthScalarInput(actor,taggedBase),baseCooldown:taggedBase},growthSkillScopes(pack,build,clock));
}
export function growthEffectDuration(pack: Pack, effect: DeepReadonly<GrowthTimedEffect>, actor: GrowthRuleActor,
    taggedSources: readonly string[]): number | null {
    if (effect.duration.kind === 'action') return null;
    const effects = taggedSources.flatMap(id => growthSkillDefinition(pack,id)?.effects ?? []);
    return Math.min(effect.duration.cap,growthTaggedProperty(pack,'duration',effect.duration.blocks,effect.tags,actor,effects));
}
export function createGrowthEffectInstance(pack: Pack, skill: GrowthSkillDefinition, effect: DeepReadonly<GrowthTimedEffect>,
    source: GrowthRuleActor, build: DeepReadonly<GrowthSkillBuild>, clock: number, actionId: number, instanceId: number): GrowthEffectInstance {
    const taggedSources = [...build.passive].sort(), duration = growthEffectDuration(pack,effect,source,taggedSources);
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
    return build.learned.filter(id=>!build.inherited.includes(id)).reduce((sum,id) => addGrowthIntegers(sum,growthSkillDefinition(pack,id)!.cost),0);
}
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
const exact = (value: unknown, keys: string): value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === keys;
/** Stored action-scope instances are never valid at a public save/checkpoint boundary. */
export function isGrowthSkillBuild(value: unknown, pack: Pack, actorId: number, clock: number, nextEffectId: number): value is GrowthSkillBuild {
    try {
    if (!isJson(value) || !exact(value,'active,effects,inherited,learned,passive')) return false;
    const ids = (list: unknown): list is string[] => Array.isArray(list) && list.every(id => typeof id === 'string' && !!growthSkillDefinition(pack,id))
        && list.every((id,index) => index === 0 || list[index-1]! < id);
    const slotIds = (list: unknown): list is string[] => Array.isArray(list) && new Set(list).size === list.length && list.every(id=>typeof id === 'string' && !!growthSkillDefinition(pack,id));
    if (!ids(value.inherited) || !ids(value.learned) || value.inherited.some(id=>!(value.learned as string[]).includes(id)) || !slotIds(value.active) || !slotIds(value.passive) || !Array.isArray(value.effects)
        || value.active.length > pack.config.skills.activeSlots || value.passive.length > pack.config.skills.passiveSlots) return false;
    const learned = value.learned;
    if (value.active.some(id => !learned.includes(id) || growthSkillDefinition(pack,id)!.mode !== 'active')
        || value.passive.some(id => !learned.includes(id) || growthSkillDefinition(pack,id)!.mode !== 'passive')) return false;
    let last = 0;
    for (const item of value.effects) {
        if (!exact(item,'actionId,effectId,expiresAt,instanceId,remaining,skillId,source,startedAt,taggedSources') || !integer(item.instanceId,1)
            || item.instanceId <= last || item.instanceId >= nextEffectId || !integer(item.startedAt) || item.startedAt > clock
            || item.actionId !== null || !integer(item.expiresAt) || !integer(item.remaining)
            || typeof item.skillId !== 'string' || typeof item.effectId !== 'string' || !ids(item.taggedSources)
            || item.taggedSources.some(id => growthSkillDefinition(pack,id)!.mode !== 'passive')
            || !exact(item.source,'attributes,id,level') || !integer(item.source.id,1) || !integer(item.source.level,1)
            || item.source.level > pack.config.levels.cap || !exact(item.source.attributes,pack.config.attributes.map(a=>a.id).sort().join(','))) return false;
        const source = item.source as unknown as GrowthRuleActor;
        if (pack.config.attributes.some(a=>!integer(source.attributes[a.id]) || source.attributes[a.id]! < a.min || source.attributes[a.id]! > a.cap)) return false;
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
