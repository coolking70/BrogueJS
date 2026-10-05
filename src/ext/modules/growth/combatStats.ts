import type { Json, OptionalActorQueryProvider, ReadonlyJson } from '../../types';
import { isJson } from '../../json';
import { extensionDataFingerprint } from '../../fingerprint';
import type { GrowthPack } from './attributes';
import { growthRuleActor, growthScalarInput, isGrowthAttributes } from './attributes';
import { isGrowthProgression } from './components';
import type { GrowthCombatCapacityMap } from './types';
import { isGrowthIdentityBuild } from './identities';
import { growthSkillScopes, projectGrowthSkillBuild, type GrowthSkillBuild } from './skills';
import { evaluateGrowthPort } from './evaluator';
import type { GrowthState } from './state';

const CAPACITY_LIMIT = 1000000;
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
    Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const record = (value: unknown, keys: string): value is Record<string, unknown> =>
    isJson(value) && !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys;
export type GrowthCombatStatsInput = { v: 1; baseStaminaCapacity: number; basePoiseCapacity: number };
export type GrowthCombatStats = { status: 'unsupported' } | {
    status: 'supported'; staminaCapacity: number; poiseCapacity: number; revision: string;
};
export function isGrowthCombatStatsInput(input: unknown): input is GrowthCombatStatsInput {
    return record(input,'basePoiseCapacity,baseStaminaCapacity,v') && input.v === 1
        && integer(input.baseStaminaCapacity,1,CAPACITY_LIMIT) && integer(input.basePoiseCapacity,1,CAPACITY_LIMIT);
}
/** Exact integer arithmetic before saturation: a large legal coefficient cannot overflow or lose a rank. */
export function mapGrowthCombatCapacity(base: number, rank: number, map: Readonly<GrowthCombatCapacityMap>): number {
    if (!integer(base,1,CAPACITY_LIMIT) || !integer(rank) || !integer(map.baseline) || !integer(map.coefficient)
        || !integer(map.denominator,1) || map.rounding !== 'floor' || !integer(map.min,1,CAPACITY_LIMIT)
        || !integer(map.max,map.min,CAPACITY_LIMIT)) throw new RangeError('Invalid growth combat capacity input');
    const investment = BigInt(Math.max(0,rank - map.baseline));
    const value = BigInt(base) + investment * BigInt(map.coefficient) / BigInt(map.denominator);
    return Number(value < BigInt(map.min) ? BigInt(map.min) : value > BigInt(map.max) ? BigInt(map.max) : value);
}
/** Pure actor-scoped protocol. Foundation selects the actor and exposes only this module's own components.
 * Neither player UI query permissions nor a payload actor ID can authorize an NPC read. */
export function createGrowthCombatStatsProvider(pack: GrowthPack): OptionalActorQueryProvider {
    const config = pack.config.combatStats, packFingerprint = extensionDataFingerprint(pack);
    if (!config) return {
        accepts:isGrowthCombatStatsInput,
        query(input): Json {
            if (!isGrowthCombatStatsInput(input)) throw new RangeError('Invalid growth combat stats request');
            return {status:'unsupported'};
        },
        validate:(value): value is Json => record(value,'status') && value.status === 'unsupported',
    };
    const validate = (value: unknown): value is Json => {
        if (record(value,'status')) return value.status === 'unsupported';
        return record(value,'poiseCapacity,revision,staminaCapacity,status') && value.status === 'supported'
            && integer(value.staminaCapacity,config.stamina.min,config.stamina.max)
            && integer(value.poiseCapacity,config.poise.min,config.poise.max)
            && typeof value.revision === 'string' && /^sha256:[a-f0-9]{64}$/.test(value.revision);
    };
    return {
        accepts: isGrowthCombatStatsInput,
        query(input: ReadonlyJson, context): Json {
            if (!isGrowthCombatStatsInput(input)) throw new RangeError('Invalid growth combat stats request');
            const state = context.state as unknown as GrowthState, actor = context.actor;
            if (!integer(actor.id,1) || !integer(state.objectiveClock) || !integer(state.revision))
                throw new RangeError('Invalid growth combat stats context');
            if (!state.created || (actor.player && !config.playerEnabled)) return {status:'unsupported'};
            const progression = context.getActorComponent('progression'), attributes = context.getActorComponent('attributes');
            const identity = context.getActorComponent('identity'), rawBuild = context.getActorComponent('skill-build');
            // Growth-disabled NPCs legitimately retain only reward and received-effect components.
            if (progression === undefined && attributes === undefined && identity === undefined) return {status:'unsupported'};
            if (!isGrowthProgression(progression,pack.config.levels) || !isGrowthAttributes(attributes,pack,true)
                || !isGrowthIdentityBuild(identity,pack,true) || !record(rawBuild,'active,effects,gifted,inherited,learned,passive'))
                throw new RangeError('Invalid growth combat actor build');
            if (actor.player !== (actor.id === state.playerId)) throw new RangeError('Invalid growth combat actor identity');
            if (!actor.player && (identity.templateId === null || !config.allowedTemplateIds.includes(identity.templateId))) return {status:'unsupported'};
            const build = rawBuild as unknown as GrowthSkillBuild;
            // This projection validates effect references without imposing save-only restrictions on live action effects.
            projectGrowthSkillBuild(pack,build);
            const ruleActor = growthRuleActor(actor.id,progression,attributes);
            const scopes = growthSkillScopes(pack,build,state.objectiveClock,'actor',identity).flatMap(scope => {
                const modifiers = scope.modifiers.filter(modifier => modifier.port === 'staminaCapacity' || modifier.port === 'poiseCapacity');
                return modifiers.length ? [{...scope,modifiers}] : [];
            });
            const capacity = (resource: 'stamina' | 'poise', base: number): number => {
                const map = config[resource], port = resource === 'stamina' ? 'staminaCapacity' : 'poiseCapacity';
                const mapped = mapGrowthCombatCapacity(base,attributes.values[map.attributeId]!,map);
                const value = evaluateGrowthPort(pack,port,growthScalarInput(ruleActor,mapped),scopes);
                if (!integer(value,0)) throw new RangeError('Invalid growth combat capacity result');
                return Math.max(map.min,Math.min(map.max,value));
            };
            const result: GrowthCombatStats = {status:'supported',
                staminaCapacity:capacity('stamina',input.baseStaminaCapacity),poiseCapacity:capacity('poise',input.basePoiseCapacity),
                revision:extensionDataFingerprint({v:1,packFingerprint,actorId:actor.id,player:actor.player,templateId:identity.templateId,
                    input,level:progression.level,attributes:attributes.values,scopes})};
            if (!validate(result)) throw new RangeError('Invalid growth combat stats result');
            return result;
        },
        validate,
    };
}
