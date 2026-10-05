import { initialBonfireState } from '../../worldRest';
import type { ActorAttackDefinitions, ProductionActorAttackState } from '../../actorActions';
import type { CombatPack } from './types';
export function combatAttackDefinitions(pack: CombatPack): ActorAttackDefinitions {
    return {
        bonfires: pack.bonfires,
        attacks: pack.attacks.map(({id,nameKey,cost,windupTicks,recoveryTicks,segments}) => ({id,nameKey,cost,windupTicks,recoveryTicks,
            segments: segments.map(({delayTicks,shape,locationPolicy,targetPolicy,damageProfile,poiseDamage,dodgeable,parryable}) =>
                ({delayTicks,shape,locationPolicy,targetPolicy,damageProfile,poiseDamage,dodgeable,parryable}))})),
        profiles: pack.profiles, resourcePolicies: pack.resourcePolicies.map(({id,initialStamina,staminaCapacity,regenPerTickNumerator,
            regenPerTickDenominator,regenDelayTicks,nativeAttackCost,regenPhases,poiseCapacity,poiseRecoveryNumerator,
            poiseRecoveryDenominator,poiseRecoveryDelayTicks,poiseBreakRecoveryValue,nativePoiseDamage,poiseImmune})=>({id,initialStamina,staminaCapacity,
            regenPerTickNumerator,regenPerTickDenominator,regenDelayTicks,nativeAttackCost,regenPhases,poiseCapacity,poiseRecoveryNumerator,
            poiseRecoveryDenominator,poiseRecoveryDelayTicks,poiseBreakRecoveryValue,nativePoiseDamage,poiseImmune})),
        nativeProfiles: pack.nativeProfiles,playerProfileId:pack.playerProfileId,breakRecoveryTicks:pack.breakRecoveryTicks,dodge:pack.dodge,parry:pack.parry,
    };
}
export function initialProductionCombatState(): ProductionActorAttackState {
    return {schema:3,revision:0,nextActionId:1,bonfires:initialBonfireState(),scheduler:{schema:1,bundles:[]},actions:[],actors:[]};
}
