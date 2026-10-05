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
        initialState:()=>initialProductionCombatState() as unknown as Json,
        validateState:(value):value is Json=>{try {validateProductionActorAttackState(value,definitions);return true;}catch{return false;}},
        // Mechanical actor state is one module-owned ledger; no second component clock.
        validateComponents:(_state,components)=>Object.values(components).every(values=>Object.keys(values).every(name=>!name.startsWith('combat:'))),
        validateWorld:(value,_components,actors,world)=>{
            const state=value as unknown as ProductionActorAttackState;
            return state.actors.every(row=>row.actorId<world.nextEntityId && actors.some(actor=>actor.id===row.actorId))
                && state.actions.every(action=>action.subactions.every(sub=>sub.approvedRisks.every(approval=>approval.targetId<world.nextEntityId)));
        },
        projectView:context=>projectCombatView(context.state,definitions,context.depth,context.playerId),
    };
}
