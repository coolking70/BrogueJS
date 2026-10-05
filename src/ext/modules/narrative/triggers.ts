import { NarrativeError } from './errors';
import { assertLoadedNarrativePack } from './schema';
import type { NarrativeFact } from './conditions';
import type { NarrativePack, Trigger } from './types';
import { narrativeReceiptCount, type NarrativeState, type TriggerReceipt } from './state';

export function narrativeTriggerMatches(trigger: Trigger, fact: NarrativeFact): boolean {
    const on = trigger.on;
    if (on.kind !== fact.kind) return false;
    switch (on.kind) {
        case 'entered-level': return fact.kind === 'entered-level';
        case 'npc-interacted': return fact.kind === 'npc-interacted' && on.npcId === fact.npcId;
        case 'dialogue-choice': return fact.kind === 'dialogue-choice' && on.dialogueId === fact.dialogueId && on.choiceId === fact.choiceId;
        case 'story': return fact.kind === 'story' && on.eventId === fact.eventId;
        case 'combat-event': return fact.kind === 'combat-event' && on.eventKind === fact.eventKind
            && (on.actorRole === 'any' || on.actorRole === fact.actor.role)
            && on.actorTags.every(tag => fact.actor.tags.includes(tag));
    }
}
/** Never relies on array/registration order or locale collation. */
export function orderedNarrativeTriggers(pack: NarrativePack, fact: NarrativeFact): readonly Trigger[] {
    assertLoadedNarrativePack(pack);
    return pack.triggers.filter(trigger => narrativeTriggerMatches(trigger, fact)).sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function narrativeTriggerScope(trigger: Trigger, fact: NarrativeFact): string {
    return trigger.repeat.kind === 'once-per-depth' ? `depth.${fact.depth}` : 'run';
}
export function narrativeTriggerEligible(state: NarrativeState, trigger: Trigger, fact: NarrativeFact): boolean {
    const receipt = state.triggerReceipts.find(receipt => receipt.triggerId === trigger.id && receipt.scopeKey === narrativeTriggerScope(trigger, fact));
    if (!receipt) return true;
    if (receipt.lastFactId === fact.factId) return false;
    if (trigger.repeat.kind !== 'bounded') return false;
    return receipt.firings < trigger.repeat.maxFirings && fact.turn >= receipt.lastTurn
        && fact.turn - receipt.lastTurn >= trigger.repeat.cooldownTurns;
}
/** Mutates only a planner-owned detached scratch state. No callback or engine port is accepted. */
export function recordNarrativeTrigger(state: NarrativeState, pack: NarrativePack, trigger: Trigger, fact: NarrativeFact): void {
    assertLoadedNarrativePack(pack);
    const scopeKey = narrativeTriggerScope(trigger, fact);
    const existing = state.triggerReceipts.find(receipt => receipt.triggerId === trigger.id && receipt.scopeKey === scopeKey);
    if (existing) {
        existing.firings++;
        existing.lastTurn = fact.turn;
        existing.lastFactId = fact.factId;
        return;
    }
    if (narrativeReceiptCount(state) >= pack.config.limits.maxReceipts) throw new NarrativeError('RECEIPT_LIMIT', '$state.triggerReceipts');
    const receipt: TriggerReceipt = { triggerId: trigger.id, scopeKey, firings: 1, lastTurn: fact.turn, lastFactId: fact.factId,
        ...(trigger.on.kind === 'combat-event' ? { receiptId: trigger.receiptId! } : {}) };
    state.triggerReceipts.push(receipt);
    state.triggerReceipts.sort((a, b) => {
        const left = `${a.triggerId}:${a.scopeKey}`, right = `${b.triggerId}:${b.scopeKey}`;
        return left < right ? -1 : left > right ? 1 : 0;
    });
}
