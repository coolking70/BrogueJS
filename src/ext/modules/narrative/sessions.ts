import type { ExtensionContext, Json, WorldInteractable } from '../../types';
import { NarrativeError } from './errors';
import { validateNarrativeInput, type NarrativeInput } from './input';
import { commitNarrativePlan, planNarrativeChoice, planNarrativeFact } from './effects';
import { narrativeInteger, narrativePlacementDefinition, validateNarrativeState, type NarrativeState } from './state';
import type { NarrativePack } from './types';

export interface NarrativeCommandPlan {
    readonly nextState: NarrativeState;
    readonly messages: readonly { readonly textKey: string }[];
}
export function narrativeNextRevision(state: NarrativeState): void {
    if (!narrativeInteger(state.revision + 1, 1)) throw new NarrativeError('INVALID_STATE', '$state.revision');
    state.revision++;
}
/** The foundation owns distance, visibility, safe-boundary eligibility and owner filtering. */
export function narrativeBoundTarget(pack: NarrativePack, state: NarrativeState, entity: WorldInteractable | null) {
    if (!entity || entity.owner !== 'narrative') throw new NarrativeError('INVALID_INPUT', '$input.targetEntityId');
    const binding = state.npcBindings[entity.id];
    const definition = binding && narrativePlacementDefinition(pack, binding);
    if (!definition || entity.contentId !== definition.npc.id || entity.instanceKey !== binding!.instanceKey) throw new NarrativeError('INVALID_INPUT', '$input.targetEntityId');
    return definition.npc;
}
/** Complete side-effect-free preflight. Expected rejections never enter a command transaction. */
export function planNarrativeCommand(pack: NarrativePack, raw: unknown, context: ExtensionContext): NarrativeCommandPlan {
    const input = validateNarrativeInput(raw), state = validateNarrativeState(context.state, pack);
    if (input.payload.revision !== state.revision) throw new NarrativeError('STALE_PLAN', '$input.payload.revision');
    const actor = context.creature(context.playerId);
    if (!actor || actor.hp <= 0) throw new NarrativeError('INVALID_INPUT', '$input');
    if (input.action === 'open') {
        if (state.active !== null || !narrativeInteger(state.nextSessionId + 1, 2)) throw new NarrativeError('INVALID_INPUT', '$state.active');
        const npc = narrativeBoundTarget(pack, state, context.interactionTarget(input.payload.targetEntityId));
        const dialogue = pack.dialogues.find(dialogue => dialogue.id === npc.dialogueId)!;
        const plan = planNarrativeFact(pack, state, { kind: 'npc-interacted', npcId: npc.id,
            factId: state.lastFactId + 1, depth: context.depth, turn: context.turn }, { queryOptional: context.queryOptional });
        const nextState = commitNarrativePlan(pack, state, plan);
        nextState.active = { sessionId: state.nextSessionId, targetEntityId: input.payload.targetEntityId,
            dialogueId: dialogue.id, nodeId: dialogue.entry, transitions: 0 };
        nextState.nextSessionId++;
        return { nextState: validateNarrativeState(nextState, pack), messages: plan.messages };
    }
    const active = state.active;
    if (!active || active.sessionId !== input.payload.sessionId) throw new NarrativeError('INVALID_INPUT', '$input.payload.sessionId');
    if (input.action === 'close') {
        state.active = null; narrativeNextRevision(state);
        return { nextState: validateNarrativeState(state, pack), messages: [] };
    }
    if (active.nodeId !== input.payload.nodeId) throw new NarrativeError('INVALID_INPUT', '$input.payload.nodeId');
    narrativeBoundTarget(pack, state, context.interactionTarget(active.targetEntityId));
    const plan = planNarrativeChoice(pack, state, { kind: 'dialogue-choice', dialogueId: active.dialogueId, choiceId: input.payload.choiceId,
        factId: state.lastFactId + 1, depth: context.depth, turn: context.turn },
    { dialogueId: active.dialogueId, nodeId: active.nodeId, choiceId: input.payload.choiceId, transitions: active.transitions },
    { queryOptional: context.queryOptional });
    const nextState = commitNarrativePlan(pack, state, plan);
    nextState.active = plan.choice!.nextNodeId === null ? null : { ...active, nodeId: plan.choice!.nextNodeId, transitions: plan.choice!.transitions };
    return { nextState: validateNarrativeState(nextState, pack), messages: plan.messages };
}
export function narrativeCommandInput(action: NarrativeInput['action'], payload: Json): NarrativeInput {
    return validateNarrativeInput({ module: 'narrative', action, payload });
}
