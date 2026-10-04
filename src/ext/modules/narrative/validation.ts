import type { ExtensionSnapshot, WorldInteractable } from '../../types';
import { canonical } from '../../json';
import { validateNarrativeInput } from './input';
import { narrativePlacementDefinition, validateNarrativeState, type NarrativeState } from './state';
import type { NarrativePack } from './types';

type World = { readonly entities: readonly WorldInteractable[]; readonly gate: ExtensionSnapshot['foundation']['world']['gate'] };
/** Mutual ownership/reference checks run before load retires the previous world. */
export function validateNarrativeWorldBindings(pack: NarrativePack, raw: unknown, world: World): boolean {
    try {
        const state = validateNarrativeState(raw, pack), owned = world.entities.filter(entity => entity.owner === 'narrative');
        if (owned.length !== Object.keys(state.npcBindings).length) return false;
        for (const entity of owned) {
            const binding = state.npcBindings[entity.id];
            const definition = binding && narrativePlacementDefinition(pack, binding);
            if (!definition) return false;
            const { npc } = definition;
            const receipt = state.placementReceipts.find(receipt => receipt.instanceKey === entity.instanceKey);
            if (!receipt || receipt.result !== 'placed' || receipt.depth !== entity.depth || entity.instanceKey !== binding!.instanceKey
                || entity.contentId !== npc.id || entity.nameKey !== npc.nameKey || entity.descriptionKey !== npc.descriptionKey
                || entity.glyph !== npc.glyph || entity.color !== npc.color || entity.interactionDistance !== npc.interactionDistance || entity.priority !== 0) return false;
        }
        const active = state.active, gate = world.gate;
        if (active) return !!gate && gate.owner === 'narrative' && gate.sessionId === active.sessionId && gate.targetEntityId === active.targetEntityId;
        return gate?.owner !== 'narrative';
    } catch { return false; }
}
/** Historical syntax/checkpoints are validated without consulting the live current-state command gate. */
export function validateNarrativeRecording(pack: NarrativePack, events: readonly { action: string; data: unknown; extensions?: ExtensionSnapshot }[]): boolean {
    try {
        let previous: NarrativeState | null = null;
        for (const event of events) {
            if (!event.extensions || !validateNarrativeWorldBindings(pack, event.extensions.modules.narrative, event.extensions.foundation.world)) return false;
            const current = validateNarrativeState(event.extensions.modules.narrative, pack);
            let narrativeCommand = false;
            if (event.action === 'ext:command') {
                if (typeof event.data !== 'string') return false;
                const raw: unknown = JSON.parse(event.data);
                if (raw && typeof raw === 'object' && 'module' in raw && raw.module === 'narrative') {
                    narrativeCommand = true;
                    const input = validateNarrativeInput(raw);
                    if (current.revision !== input.payload.revision + 1 || previous && previous.revision !== input.payload.revision) return false;
                    if (input.action === 'open') {
                        if (previous?.active || !current.active || current.active.targetEntityId !== input.payload.targetEntityId || current.active.transitions !== 0) return false;
                        if (current.active.sessionId !== (previous?.nextSessionId ?? 1) || current.nextSessionId !== (previous?.nextSessionId ?? 1) + 1) return false;
                        const npc = pack.npcs.find(npc => npc.id === current.npcBindings[current.active!.targetEntityId]!.npcId)!;
                        if (current.active.nodeId !== pack.dialogues.find(dialogue => dialogue.id === npc.dialogueId)!.entry) return false;
                    } else {
                        if (current.nextSessionId !== input.payload.sessionId + 1) return false;
                        if (!previous?.active || previous.active.sessionId !== input.payload.sessionId || previous.nextSessionId !== current.nextSessionId) return false;
                        if (input.action === 'close') {
                            if (current.active) return false;
                            if (previous) {
                                const closed = structuredClone(previous); closed.active = null; closed.revision++;
                                if (canonical(closed) !== canonical(current)) return false;
                            }
                        } else {
                            const prior = previous?.active;
                            if (prior && prior.nodeId !== input.payload.nodeId) return false;
                            const dialogues = prior ? pack.dialogues.filter(dialogue => dialogue.id === prior.dialogueId) : pack.dialogues;
                            const choice = dialogues.flatMap(dialogue => dialogue.nodes.filter(node => node.id === input.payload.nodeId))
                                .flatMap(node => node.choices).find(choice => choice.id === input.payload.choiceId);
                            if (!choice) return false;
                            if (choice.next === null ? current.active !== null : !current.active || current.active.sessionId !== input.payload.sessionId
                                || current.active.nodeId !== choice.next || prior && current.active.transitions !== prior.transitions + 1) return false;
                        }
                    }
                }
            }
            // With a live session only this owner's explicit continuation can be
            // recorded; substituting wait/move must fail before the old run retires.
            if (!narrativeCommand && (previous?.active || current.active)) return false;
            previous = current;
        }
        return true;
    } catch { return false; }
}
export function narrativeActiveWorldValid(state: NarrativeState, entities: readonly WorldInteractable[], depth: number, isGameOver: boolean): boolean {
    return !state.active || !isGameOver && entities.some(entity => entity.owner === 'narrative' && entity.id === state.active!.targetEntityId && entity.depth === depth);
}
