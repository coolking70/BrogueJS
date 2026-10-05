import type { Json, ReadonlyJson } from '../../types';
import type { ActorAttackDefinitions, ProductionActorAttackState } from '../../actorActions';
/** Display projection is detached. The shell applies public visibility before rendering. */
export function projectCombatView(value?: ReadonlyJson, definitions?: ActorAttackDefinitions, depth?:number, playerId?:number): Json {
    if (!value || !definitions) return {schema:1,telegraphs:[],resources:null,actions:[]};
    const state=value as unknown as ProductionActorAttackState;
    const telegraphs=state.scheduler.bundles.filter(bundle=>bundle.depth===depth).flatMap(bundle=>{
        const metadata=state.actions.find(action=>action.actionId===bundle.actionId);
        return bundle.subactions.flatMap(source=>{
            const phase=source.phases[source.phaseIndex];
            const sub=metadata?.subactions.find(item=>item.sourceSubactionId===source.sourceSubactionId);
            if (!phase || !sub || (phase.kind!=='windup'&&phase.kind!=='inter-segment') || !sub.lockedCells.length) return [];
            return [{actionId:bundle.actionId,sourceSubactionId:source.sourceSubactionId,sourceEntityId:source.sourceEntityId,
                cells:sub.lockedCells.map(cell=>({...cell})),phase:phase.kind}];
        });
    });
    const profile=definitions.profiles.find(profile=>profile.id===definitions.playerProfileId)!;
    const policy=definitions.resourcePolicies.find(policy=>policy.id===profile.resourcePolicyId)!;
    const actor=state.actors.find(actor=>actor.actorId===playerId);
    const stamina=actor?.stamina??policy.initialStamina;
    const busy=state.scheduler.bundles.some(bundle=>bundle.decisionOwnerId===playerId)
        || (actor?.dodgeRecoveryRemainingTicks??0)>0;
    const availability=(cost:number)=>({cost,canUse:!busy&&stamina>=cost,
        ...(!busy&&stamina>=cost?{}:{unavailableKey:busy?'ext.combat.ui.busy':'ext.combat.ui.insufficient_stamina'})});
    return {schema:1,revision:state.revision,telegraphs,
        resources:{stamina,capacity:policy.staminaCapacity,regenDelayRemaining:actor?.regenDelayRemaining??0,
            dodgeRemainingTicks:actor?.dodgeRemainingTicks??0,dodgeRecoveryRemainingTicks:actor?.dodgeRecoveryRemainingTicks??0},
        actions:[...profile.attackIds.map(id=>{
            const attack=definitions.attacks.find(attack=>attack.id===id)!;
            return {id,nameKey:attack.nameKey,...availability(attack.cost)};
        }),{id:'dodge',nameKey:'ext.combat.dodge.name',...availability(definitions.dodge.cost)}]} as Json;
}
