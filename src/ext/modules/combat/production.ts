import type { ActorAttackDefinitions, ProductionActorAttackState } from '../../actorActions';
import type { CombatPack } from './types';
export function combatAttackDefinitions(pack: CombatPack): ActorAttackDefinitions {
    return {
        attacks: pack.attacks.map(({id,nameKey,cost,windupTicks,recoveryTicks,segments}) => ({id,nameKey,cost,windupTicks,recoveryTicks,
            segments: segments.map(({delayTicks,shape,locationPolicy,targetPolicy,damageProfile,dodgeable,parryable}) =>
                ({delayTicks,shape,locationPolicy,targetPolicy,damageProfile,dodgeable,parryable}))})),
        profiles: pack.profiles, resourcePolicies: pack.resourcePolicies.map(({id,initialStamina,staminaCapacity,regenPerTickNumerator,
            regenPerTickDenominator,regenDelayTicks,nativeAttackCost,regenPhases})=>({id,initialStamina,staminaCapacity,
            regenPerTickNumerator,regenPerTickDenominator,regenDelayTicks,nativeAttackCost,regenPhases})),
        nativeProfiles: pack.nativeProfiles,playerProfileId:pack.playerProfileId,breakRecoveryTicks:pack.breakRecoveryTicks,dodge:pack.dodge,
    };
}
export function initialProductionCombatState(): ProductionActorAttackState {
    return {schema:2,revision:0,nextActionId:1,scheduler:{schema:1,bundles:[]},actions:[],actors:[]};
}
