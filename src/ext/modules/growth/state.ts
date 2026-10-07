import type { ActorFacts, ExtensionSnapshot } from '../../types';
import type { EffectOrigin } from '../../causality';
import { validEffectOrigin } from '../../causality';
import { isJson, canonical, validId } from '../../json';
import type { CreatureBirth } from '../../birth';
import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack } from './types';
import { scheduledGrantTotal } from './experience';
import { isGrowthFocus, isGrowthProgression, isGrowthSkills } from './components';
import { growthAllocatedCost, growthFocusCapacity, growthFocusInterval, growthRuleActor, isGrowthAttributes } from './attributes';
import { isGrowthItemLedger, growthItemPointGrants } from './items';
import { growthIdentityAttributeValues, growthIdentityGiftIds, growthIdentityEffects, isGrowthIdentityBuild } from './identities';
import { growthSkillScopes, growthLearnedCost, isGrowthSkillBuild, validGrowthCooldowns } from './skills';

export type GrowthActor = { player: boolean; allied: boolean; hostile: boolean; alive: boolean; relation: number };
export type GrowthReward = CreatureBirth & { rewardId: string; threatRank: number; amount: number };
export type GrowthPending = { kind: 'kill'; actor: ActorFacts; origin: EffectOrigin | null; administrative: boolean }
    | { kind: 'visit'; depth: number; actorIds: number[] }
    | { kind: 'story'; recipientId: number; rewardKey: string; definitionId: string; amount: number; reasonKey: string };
export type GrowthState = {
    created: boolean; playerId: number; revision: number; objectiveClock: number; objectiveRemainder: number; nextEffectId: number; nextActionId: number;
    visitedDepths: number[]; identifiedKinds: string[]; identificationAwarded: number; visitAwarded: number;
    rewardReceipts: string[]; storyReceipts: string[]; resourceReceipts: string[];
    actors: Record<string, GrowthActor>; pending: GrowthPending[];
};
export function initialGrowthState(): GrowthState {
    return { created: false, playerId: 0, revision: 0, objectiveClock: 0, objectiveRemainder: 0, nextEffectId: 1, nextActionId: 1, visitedDepths: [], identifiedKinds: [], identificationAwarded: 0,
        visitAwarded: 0, rewardReceipts: [], storyReceipts: [], resourceReceipts: [], actors: {}, pending: [] };
}
const integer = (value: unknown, min = 0): value is number => Number.isSafeInteger(value) && (value as number) >= min;
function record(value: unknown, keys?: string[]): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
        && (!keys || canonical(Object.keys(value).sort()) === canonical([...keys].sort()));
}
function sorted<T extends string | number>(value: unknown, valid: (item: unknown) => item is T): value is T[] {
    return Array.isArray(value) && value.every(valid) && value.every((item, index) => index === 0 || value[index - 1]! < item);
}
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
export function isGrowthReward(value: unknown): value is GrowthReward {
    if (!isJson(value) || !record(value, ['creationReason','originalMonsterType','initiallyHostile','sourceId','rewardId','threatRank','amount','nativeStatsCopied'])) return false;
    return ['natural','summoned','split','clone','periodic','scripted','test'].includes(value.creationReason as string)
        && (value.originalMonsterType === null || text(value.originalMonsterType)) && typeof value.initiallyHostile === 'boolean'
        && (value.sourceId === null || integer(value.sourceId, 1)) && text(value.rewardId)
        && integer(value.threatRank) && integer(value.amount) && typeof value.nativeStatsCopied === 'boolean';
}
export function isGrowthState(value: unknown, pack: DeepReadonly<GrowthDefinitionPack>): value is GrowthState {
    if (!isJson(value) || !record(value, Object.keys(initialGrowthState())) || typeof value.created !== 'boolean'
        || !integer(value.objectiveClock) || !integer(value.objectiveRemainder) || value.objectiveRemainder >= pack.config.focus.objectiveTicksPerBlock
        || !integer(value.nextEffectId,1) || !integer(value.nextActionId,1) || !integer(value.playerId) || !integer(value.revision) || (value.created && (value.playerId === 0 || value.revision < 1))
        || !sorted(value.visitedDepths, (v): v is number => integer(v, 1)) || !sorted(value.identifiedKinds, text)
        || !integer(value.identificationAwarded) || value.identificationAwarded > pack.config.experience.identification.totalCap
        || !integer(value.visitAwarded) || (pack.config.experience.firstVisits.cap !== null && value.visitAwarded > pack.config.experience.firstVisits.cap)
        || !sorted(value.rewardReceipts,text) || !sorted(value.storyReceipts,text) || !sorted(value.resourceReceipts,text)
        || !record(value.actors) || !Array.isArray(value.pending)) return false;
    // An issuer may no longer be installed, and disabled legacy story grants still leave quoted receipts.
    // The provider owns the reward definition, so each durable key must name one of its own quotes.
    const storyQuote = (receipt: unknown) => {
        if (typeof receipt !== 'string') return undefined;
        const parts = receipt.split(':');
        return parts.length === 3 && parts.every(validId)
            ? pack.config.experience.story.rewards.find(quote=>quote.id === parts[1]) : undefined;
    };
    if (value.storyReceipts.some(receipt=>!storyQuote(receipt))) return false;
    for (const [id, actor] of Object.entries(value.actors)) if (!/^[1-9]\d*$/.test(id) || !integer(Number(id),1)
        || !record(actor,['player','allied','hostile','alive','relation']) || !integer(actor.relation)
        || ['player','allied','hostile','alive'].some(key => typeof actor[key] !== 'boolean')
        || (actor.player !== (Number(id) === value.playerId)) || (actor.player && (!actor.allied || actor.hostile))
        || (actor.allied && actor.hostile)) return false;
    for (const receipt of value.resourceReceipts) {
        const match = /^([a-z][a-z0-9]*(?:[.-][a-z0-9]+)*):([1-9]\d*):([1-9]\d*)$/.exec(receipt);
        if (!match || !integer(Number(match[2]),1) || !integer(Number(match[3]),1) || !value.visitedDepths.includes(Number(match[3]))) return false;
        const effect = pack.definitions.flatMap(definition => definition.kind === 'skill' ? [] : [...definition.effects,...definition.oaths.flatMap(oath=>oath.effects)])
            .find(effect=>effect.kind === 'resource' && effect.id === match[1]);
        if (!effect || effect.kind !== 'resource' || Number(match[3]) < effect.trigger.minDepth || Number(match[3]) > effect.trigger.maxDepth) return false;
    }
    return value.pending.every(pending => {
        if (!record(pending)) return false;
        if (pending.kind === 'visit') return record(pending,['kind','depth','actorIds']) && integer(pending.depth,1) && sorted(pending.actorIds,(id): id is number=>integer(id,1));
        if (pending.kind === 'story') {
            const quote = storyQuote(pending.rewardKey);
            return record(pending,['kind','recipientId','rewardKey','definitionId','amount','reasonKey'])
                && integer(pending.recipientId,1) && !!quote && pending.definitionId === quote.id
                && pending.amount === quote.amount && pending.reasonKey === quote.reasonKey;
        }
        if (pending.kind !== 'kill' || !record(pending,['kind','actor','origin','administrative']) || typeof pending.administrative !== 'boolean'
            || (pending.origin !== null && !validEffectOrigin(pending.origin))
            || !record(pending.actor,['id','name','hp','maxHp','x','y','player','monsterId','allied','hostile'])) return false;
        const actor = pending.actor;
        return integer(actor.id,1) && typeof actor.name === 'string' && ['hp','maxHp','x','y'].every(key => Number.isSafeInteger(actor[key]))
            && ['player','allied','hostile'].every(key => typeof actor[key] === 'boolean') && (actor.monsterId === null || text(actor.monsterId));
    });
}
/** Cross-component checks happen before a live run is retired; every point has a grant, allocation, or irreversible-fee owner. */
export function validGrowthComponents(state: GrowthState, components: ExtensionSnapshot['components'], pack: DeepReadonly<GrowthDefinitionPack>, applied?: readonly {actorId:number;key:string;bonus:number}[]): boolean {
    try {
    const config = pack.config, effectIds = new Set<number>();
    for (const [id, entries] of Object.entries(components)) {
        const own = Object.keys(entries).filter(key => key.startsWith('growth:')).sort();
        if (!own.length) continue;
        const summary = state.actors[id], reward = entries['growth:reward'], build = entries['growth:skill-build'];
        if (!summary || !isGrowthReward(reward) || reward.rewardId !== `birth:${id}`) return false;
        const quote = config.experience.kills.monsterQuotes.find(quote => quote.monsterId === reward.originalMonsterType);
        if (reward.threatRank !== (quote?.threatRank ?? 0) || reward.amount !== (quote ? quote.amount ?? config.experience.kills.base + config.experience.kills.perThreatRank * quote.threatRank : 0)) return false;
        const disabledNpc = !summary.player && !config.monsters.enabled;
        const identity = entries['growth:identity'];
        if (!disabledNpc && !isGrowthIdentityBuild(identity,pack,true)) return false;
        if (!isGrowthSkillBuild(build,pack,Number(id),state.objectiveClock,state.nextEffectId,disabledNpc ? undefined : identity as never)) return false;
        for (const effect of build.effects) { if (effectIds.has(effect.instanceId)) return false;effectIds.add(effect.instanceId); }
        if (disabledNpc) {
            if (own.join(',') !== 'growth:reward,growth:skill-build' || build.learned.length || build.inherited.length || build.gifted.length || build.active.length || build.passive.length) return false;
            continue;
        }
        if (own.join(',') !== 'growth:attributes,growth:focus,growth:identity,growth:items,growth:progression,growth:reward,growth:skill-build,growth:skills') return false;
        if (!isGrowthIdentityBuild(identity,pack,true)) return false;
        const progression = entries['growth:progression'], attributes = entries['growth:attributes'], items = entries['growth:items'];
        const clone = reward.nativeStatsCopied;
        if (!isGrowthProgression(progression,config.levels) || !isGrowthAttributes(attributes,pack,clone && config.monsters.clone.inheritBuild,growthIdentityAttributeValues(pack,identity))
            || !isGrowthItemLedger(items,config.itemGrowth)) return false;
        const template = !clone && identity.templateId !== null ? config.monsters.templates.find(template=>template.id === identity.templateId) : undefined;
        if (template && (progression.level < template.level || progression.experience < template.experience)) return false;
        if (!clone) {
            if (canonical(build.inherited) !== canonical([...(template?.skills ?? [])].sort())) return false;
            const gifts = growthIdentityGiftIds(pack,identity).filter(id=>!template || template.skills.includes(id));
            if (canonical(build.gifted) !== canonical(gifts)) return false;
        } else if (!config.monsters.clone.inheritBuild && (build.inherited.length || build.gifted.length || identity.professionId || identity.lineageId || identity.faithId || identity.templateId)) return false;
        if ((!clone || !config.monsters.clone.inheritUnspentPoints) && (attributes.inheritedAttributePoints || attributes.inheritedSkillPoints)
            || (clone && !config.monsters.clone.progression && (progression.level !== 1 || progression.experience !== 0))) return false;
        const actor = growthRuleActor(Number(id),progression,attributes), scopes = growthSkillScopes(pack,build,state.objectiveClock,'actor',identity);
        const grants = growthItemPointGrants(config.itemGrowth,items);
        const focus = entries['growth:focus'], capacity = applied ? pack.config.focus.base+(applied.find(row=>row.actorId===Number(id)&&row.key==='growth.focus-capacity')?.bonus??0) : growthFocusCapacity(pack,actor,scopes), interval = growthFocusInterval(pack,actor,scopes);
        if (!isGrowthFocus(focus,capacity,applied?1_000_000:interval) || (config.focus.resetRemainderWhenFull && focus.current === capacity && focus.remainder !== 0)) return false;
        const baseLevel = clone ? 1 : template?.level ?? 0;
        const attributeGrants = BigInt(scheduledGrantTotal(config.levels.attributePoints,progression.level))
            - BigInt(scheduledGrantTotal(config.levels.attributePoints,baseLevel)) + BigInt(template?.unspentAttributePoints ?? attributes.inheritedAttributePoints);
        const skillGrants = BigInt(scheduledGrantTotal(config.levels.skillPoints,progression.level))
            - BigInt(scheduledGrantTotal(config.levels.skillPoints,baseLevel)) + BigInt(template?.unspentSkillPoints ?? attributes.inheritedSkillPoints);
        if (BigInt(progression.attributePoints) + BigInt(growthAllocatedCost(pack,attributes)) + BigInt(attributes.attributePointsSpent)
                !== attributeGrants + BigInt(grants.attributePoints)
            || BigInt(progression.skillPoints) + BigInt(attributes.skillPointsSpent) + BigInt(growthLearnedCost(pack,build)) !== skillGrants + BigInt(grants.skillPoints)

            || !isGrowthSkills(entries['growth:skills'],pack.definitions.filter(def => def.kind === 'skill' && def.mode === 'active').map(def => def.id)) || !validGrowthCooldowns(entries['growth:skills'] as never,build)) return false;
    }
    for (const receipt of state.resourceReceipts) {
        const [effectId,id] = receipt.split(':');
        const entries = components[id!];
        // Collected bodies keep their exact receipt but not an unbounded identity graph.
        if (!entries?.['growth:reward']) continue;
        const identity = entries['growth:identity'];
        if (!isGrowthIdentityBuild(identity,pack,true) || !growthIdentityEffects(pack,identity).some(effect=>effect.kind === 'resource' && effect.id === effectId)) return false;
    }
    return !state.created || !!components[String(state.playerId)]?.['growth:progression'];
    } catch { return false; }
}
export function growthPartyId(state: GrowthState, id: number): string | null {
    const actor = state.actors[id];
    return actor?.allied ? `player:${state.playerId}:actor:${id}:relation:${actor.relation}` : null;
}

/** Sources survive their live body only while a persisted effect/death refers to them. */
export function validGrowthSources(state: GrowthState, foundation: ExtensionSnapshot['foundation']): boolean {
    const causes = foundation.causality;
    const origins = [...Object.values(causes.statusOrigins).flatMap(Object.values),...Object.values(causes.fatalOrigins),
        ...Object.values(causes.pendingDisplacements),...Object.values(foundation.deaths).map(death => death.origin)];
    for (const origin of origins) {
        if (!origin?.creditActorId) continue;
        const actor = state.actors[origin.creditActorId];
        if (!actor) return false;
        if (origin.creditPartyId === null) continue;
        const match = /^player:([1-9]\d*):actor:([1-9]\d*):relation:(0|[1-9]\d*)$/.exec(origin.creditPartyId);
        if (!match || Number(match[1]) !== state.playerId || Number(match[2]) !== origin.creditActorId
            || !Number.isSafeInteger(Number(match[3])) || Number(match[3]) > actor.relation) return false;
        if (Number(match[3]) === actor.relation && !actor.allied) return false;
    }
    return true;
}
