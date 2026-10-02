import type { ActorFacts, ExtensionSnapshot } from '../../types';
import type { EffectOrigin } from '../../causality';
import { validEffectOrigin } from '../../causality';
import { isJson, canonical } from '../../json';
import type { CreatureBirth } from '../../birth';
import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack } from './types';
import { scheduledGrantTotal } from './experience';
import { isGrowthDerived, isGrowthFocus, isGrowthProgression, isGrowthSkills } from './components';
import { growthAllocatedCost, growthDerived, growthFocusCapacity, growthFocusInterval, growthRuleActor, isGrowthAttributes } from './attributes';
import { isGrowthItemLedger, growthItemPointGrants } from './items';

export type GrowthActor = { player: boolean; allied: boolean; hostile: boolean; alive: boolean; relation: number };
export type GrowthReward = CreatureBirth & { rewardId: string; threatRank: number; amount: number };
export type GrowthPending = { kind: 'kill'; actor: ActorFacts; origin: EffectOrigin | null; administrative: boolean }
    | { kind: 'visit'; depth: number }
    | { kind: 'story'; recipientId: number; rewardKey: string; definitionId: string; amount: number; reasonKey: string };
export type GrowthState = {
    created: boolean; playerId: number; revision: number;
    visitedDepths: number[]; identifiedKinds: string[]; identificationAwarded: number; visitAwarded: number;
    rewardReceipts: string[]; storyReceipts: string[]; resourceReceipts: string[];
    actors: Record<string, GrowthActor>; pending: GrowthPending[];
};
export function initialGrowthState(): GrowthState {
    return { created: false, playerId: 0, revision: 0, visitedDepths: [], identifiedKinds: [], identificationAwarded: 0,
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
        || !integer(value.playerId) || !integer(value.revision) || (value.created && (value.playerId === 0 || value.revision < 1))
        || !sorted(value.visitedDepths, (v): v is number => integer(v, 1)) || !sorted(value.identifiedKinds, text)
        || !integer(value.identificationAwarded) || value.identificationAwarded > pack.config.experience.identification.totalCap
        || !integer(value.visitAwarded) || (pack.config.experience.firstVisits.cap !== null && value.visitAwarded > pack.config.experience.firstVisits.cap)
        || !sorted(value.rewardReceipts,text) || !sorted(value.storyReceipts,text) || !sorted(value.resourceReceipts,text)
        || !record(value.actors) || !Array.isArray(value.pending)) return false;
    for (const [id, actor] of Object.entries(value.actors)) if (!/^[1-9]\d*$/.test(id) || !integer(Number(id),1)
        || !record(actor,['player','allied','hostile','alive','relation']) || !integer(actor.relation)
        || ['player','allied','hostile','alive'].some(key => typeof actor[key] !== 'boolean')
        || (actor.player !== (Number(id) === value.playerId)) || (actor.player && (!actor.allied || actor.hostile))
        || (actor.allied && actor.hostile)) return false;
    return value.pending.every(pending => {
        if (!record(pending)) return false;
        if (pending.kind === 'visit') return record(pending,['kind','depth']) && integer(pending.depth,1);
        if (pending.kind === 'story') return record(pending,['kind','recipientId','rewardKey','definitionId','amount','reasonKey'])
            && integer(pending.recipientId,1) && text(pending.rewardKey) && text(pending.definitionId) && integer(pending.amount) && text(pending.reasonKey);
        if (pending.kind !== 'kill' || !record(pending,['kind','actor','origin','administrative']) || typeof pending.administrative !== 'boolean'
            || (pending.origin !== null && !validEffectOrigin(pending.origin))
            || !record(pending.actor,['id','name','hp','maxHp','x','y','player','monsterId','allied','hostile'])) return false;
        const actor = pending.actor;
        return integer(actor.id,1) && typeof actor.name === 'string' && ['hp','maxHp','x','y'].every(key => Number.isSafeInteger(actor[key]))
            && ['player','allied','hostile'].every(key => typeof actor[key] === 'boolean') && (actor.monsterId === null || text(actor.monsterId));
    });
}
/** Cross-component checks happen before a live run is retired; every point has a grant, allocation, or irreversible-fee owner. */
export function validGrowthComponents(state: GrowthState, components: ExtensionSnapshot['components'], pack: DeepReadonly<GrowthDefinitionPack>): boolean {
    const config = pack.config;
    for (const [id, entries] of Object.entries(components)) {
        const own = Object.keys(entries).filter(key => key.startsWith('growth:'));
        if (!own.length) continue;
        if (!state.actors[id] || own.sort().join(',') !== 'growth:attributes,growth:derived,growth:focus,growth:items,growth:progression,growth:reward,growth:skills') return false;
        const progression = entries['growth:progression'], reward = entries['growth:reward'], attributes = entries['growth:attributes'], items = entries['growth:items'];
        if (!isGrowthProgression(progression,config.levels) || !isGrowthReward(reward)
            || !isGrowthAttributes(attributes,pack,reward.nativeStatsCopied && config.monsters.clone.inheritBuild)
            || !isGrowthItemLedger(items,config.itemGrowth)) return false;
        const actor = growthRuleActor(Number(id),progression,attributes), grants = growthItemPointGrants(config.itemGrowth,items);
        const clone = reward.nativeStatsCopied;
        if ((!clone || !config.monsters.clone.inheritUnspentPoints) && (attributes.inheritedAttributePoints || attributes.inheritedSkillPoints)
            || (clone && !config.monsters.clone.progression && (progression.level !== 1 || progression.experience !== 0))) return false;
        const attributeGrants = BigInt(scheduledGrantTotal(config.levels.attributePoints,progression.level))
            - BigInt(clone ? scheduledGrantTotal(config.levels.attributePoints,1) : 0) + BigInt(attributes.inheritedAttributePoints);
        const skillGrants = BigInt(scheduledGrantTotal(config.levels.skillPoints,progression.level))
            - BigInt(clone ? scheduledGrantTotal(config.levels.skillPoints,1) : 0) + BigInt(attributes.inheritedSkillPoints);
        if (BigInt(progression.attributePoints) + BigInt(growthAllocatedCost(pack,attributes)) + BigInt(attributes.attributePointsSpent)
                !== attributeGrants + BigInt(grants.attributePoints)
            || BigInt(progression.skillPoints) + BigInt(attributes.skillPointsSpent) !== skillGrants + BigInt(grants.skillPoints)
            || !isGrowthDerived(entries['growth:derived'],growthDerived(pack,actor))
            || !isGrowthFocus(entries['growth:focus'],growthFocusCapacity(pack,actor),growthFocusInterval(pack,actor))
            || !isGrowthSkills(entries['growth:skills'],pack.definitions.filter(def => def.kind === 'skill' && def.mode === 'active').map(def => def.id))) return false;
        if (reward.rewardId !== `birth:${id}`) return false;
        const quote = config.experience.kills.monsterQuotes.find(quote => quote.monsterId === reward.originalMonsterType);
        if (reward.threatRank !== (quote?.threatRank ?? 0) || reward.amount !== (quote ? quote.amount ?? config.experience.kills.base + config.experience.kills.perThreatRank * quote.threatRank : 0)) return false;
    }
    return !state.created || !!components[String(state.playerId)]?.['growth:progression'];
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
