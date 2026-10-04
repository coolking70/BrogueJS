import type { ExtensionModule, Json } from '../../types';
import { createNarrativeBudget, evaluateNarrativeCondition } from './conditions';
import { validateNarrativeState } from './state';
import { freezeNarrative } from './schema';
import type { NarrativePack } from './types';
import { NarrativeError } from './errors';

type ViewContext = Parameters<NonNullable<ExtensionModule['projectView']>>[0];
/** Pure disclosure boundary: no definitions, future nodes, ASTs, flags, counters or receipts escape. */
export function projectNarrativeView(pack: NarrativePack, context: ViewContext): Json {
    const state = validateNarrativeState(context.state, pack);
    const nearby = context.nearbyInteractables.filter(entity => !!state.npcBindings[entity.id]).map(entity => ({
        targetEntityId: entity.id, nameKey: entity.nameKey, descriptionKey: entity.descriptionKey, glyph: entity.glyph, color: entity.color,
    }));
    let active: Json = null;
    if (state.active) {
        const session = state.active;
        const npc = pack.npcs.find(npc => npc.id === state.npcBindings[session.targetEntityId]!.npcId)!;
        const node = pack.dialogues.find(dialogue => dialogue.id === session.dialogueId)!.nodes.find(node => node.id === session.nodeId)!;
        const transitionLimitReached = session.transitions >= pack.config.limits.transitionsPerSession;
        // The loader proves the full node's worst-case cost fits this shared budget.
        // Keep a defensive bounded fallback so a projection error never removes close.
        const usage = createNarrativeBudget();
        let budgetExhausted = false;
        const choices = node.choices.flatMap(choice => {
            let available = false;
            try {
                if (!budgetExhausted) available = evaluateNarrativeCondition(choice.condition, { pack, state, queryOptional: context.queryOptional,
                    fact: { kind: 'dialogue-choice', factId: Math.max(1, state.lastFactId), depth: context.depth, turn: context.turn,
                        dialogueId: session.dialogueId, choiceId: choice.id } }, usage);
            } catch (error) {
                if (!(error instanceof NarrativeError) || error.code !== 'CONDITION_LIMIT') throw error;
                budgetExhausted = true;
            }
            if (!available && choice.unavailable === 'hide') return [];
            return [{ id: choice.id, textKey: choice.textKey, enabled: available && !transitionLimitReached,
                unavailableKey: transitionLimitReached ? 'ext.narrative.error.TRANSITION_LIMIT' : budgetExhausted ? 'ext.narrative.error.CONDITION_LIMIT' : available ? null : choice.unavailableKey }];
        });
        active = { sessionId: session.sessionId, targetEntityId: session.targetEntityId, nodeId: session.nodeId,
            speakerNameKey: npc.nameKey, textKey: node.textKey, portraitId: node.portraitId ?? npc.portraitId, choices, transitionLimitReached };
    }
    const journal = state.journal.map(entry => {
        const definition = pack.journal.find(definition => definition.id === entry.entryId)!;
        return { entryId: entry.entryId, order: entry.order, titleKey: definition.titleKey, textKey: definition.textKey };
    });
    return freezeNarrative({ revision: state.revision, nearby, active, journal });
}
