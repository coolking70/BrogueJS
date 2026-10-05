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
    const stamina=state.actors.find(actor=>actor.actorId===playerId)?.stamina??policy.initialStamina;
    const busy=state.scheduler.bundles.some(bundle=>bundle.decisionOwnerId===playerId);
    return {schema:1,revision:state.revision,telegraphs,resources:null,
        actions:definitions.profiles.find(profile=>profile.id===definitions.playerProfileId)!.attackIds.map(id=>({
            id,nameKey:definitions.attacks.find(attack=>attack.id===id)!.nameKey,canUse:!busy&&stamina>=definitions.attacks.find(attack=>attack.id===id)!.cost}))} as Json;
}
