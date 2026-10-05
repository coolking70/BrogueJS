import { enterCombatLevel, removeCombatBonfires, validateCombatBonfireWorldBindings } from './bonfires';
import type { ExtensionModule, Json } from '../../types';
import { extensionDataFingerprint } from '../../fingerprint';
import { validateProductionActorAttackState } from '../../actorActionValidation';
import { assertLoadedCombatPack } from './schema';
import { projectCombatView } from './view';
import { combatAttackDefinitions, initialProductionCombatState } from './production';
import type { ProductionActorAttackState } from '../../actorActions';
import type { CombatPack } from './types';
import { createCombatPartBreakProvider } from './partBreak';

/** Data-only declaration; foundation owns scheduling, geometry and native effects. */
export function createCombatModuleFromPack(pack: CombatPack): ExtensionModule {
    assertLoadedCombatPack(pack);
    const definitions = combatAttackDefinitions(pack);
    return {
        id:'combat',version:pack.moduleVersion,
        rules:{schema:pack.schema,version:pack.rulesVersion,fingerprint:extensionDataFingerprint(pack)},
        actorActions:{stateField:'scheduler',definitions:definitions as unknown as Json},
        optionalPartBreaks:{'combat.part-break.v1':createCombatPartBreakProvider(definitions)},
        worldInteractables:true,
        hooks:{enteredLevel:(event,context)=>enterCombatLevel(pack,event,context),interactablesRemoved:(event,context)=>removeCombatBonfires(pack,event,context)},
        // Settlement is a transient save gate, never an unfinished creation step.
        initializationReady:()=>true,
        readyToSave:context=>(context.state as unknown as ProductionActorAttackState).bonfires?.active?.phase!=='settling',
        initialState:()=>initialProductionCombatState() as unknown as Json,
        validateState:(value):value is Json=>{try {validateProductionActorAttackState(value,definitions);return true;}catch{return false;}},
        // Mechanical actor state is one module-owned ledger; no second component clock.
        validateComponents:(state,components,foundation)=>validateCombatBonfireWorldBindings(pack,(state as unknown as ProductionActorAttackState).bonfires,foundation.world)&&Object.values(components).every(values=>Object.keys(values).every(name=>!name.startsWith('combat:'))),
        validateWorld:(value,_components,actors,world)=>{
            const state=value as unknown as ProductionActorAttackState;
            const rest=state.bonfires?.active;
            return validateCombatBonfireWorldBindings(pack,state.bonfires,world)
                && (!rest || rest.phase==='resting' && rest.depth===world.depth && !world.isGameOver && actors.some(actor=>actor.id===rest.actorId&&actor.player&&actor.hp>0)
                    && rest.bonfireId<world.nextEntityId && world.entities.some(entity=>entity.id===rest.bonfireId&&entity.owner==='combat'&&entity.depth===rest.depth
                        && entity.instanceKey===rest.instanceKey&&entity.contentId===rest.definitionId))
                && (!state.bonfires || state.bonfires.receipts.every(receipt=>receipt.bonfireId<world.nextEntityId&&receipt.actorId<world.nextEntityId&&actors.some(actor=>actor.id===receipt.actorId&&actor.player)))
                && state.actors.every(row=>row.actorId<world.nextEntityId && actors.some(actor=>actor.id===row.actorId))
                && state.actions.every(action=>action.subactions.every(sub=>sub.approvedRisks.every(approval=>approval.targetId<world.nextEntityId)));
        },
        projectView:context=>projectCombatView(context.state,definitions,context.depth,context.playerId,context.nearbyInteractables,context.worldRestUnavailable),
    };
}
