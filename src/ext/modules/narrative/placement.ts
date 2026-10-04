import type { ExtensionContext, HookEvents, Json, WorldInteractablePlacement } from '../../types';
import { commitNarrativePlan, planNarrativeFact } from './effects';
import { NarrativeError } from './errors';
import { narrativePlacementDefinition, narrativePlacementKey, narrativeReceiptCount, validateNarrativeState,
    type NarrativeState, type NpcBinding, type PendingPlacement } from './state';
import type { NarrativePack } from './types';
import i18next from 'i18next';

const order = (a: NpcBinding, b: NpcBinding) => a.instanceKey < b.instanceKey ? -1 : a.instanceKey > b.instanceKey ? 1 : 0;
/** A committed entry is the only installation point. The foundation rolls back the complete hook batch on failure. */
export function enterNarrativeLevel(pack: NarrativePack, event: Readonly<HookEvents['enteredLevel']>, context: ExtensionContext): void {
    const before = validateNarrativeState(context.state, pack);
    const fact = planNarrativeFact(pack, before, { kind: 'entered-level', factId: before.lastFactId + 1,
        depth: event.depth, turn: context.turn, firstVisit: event.firstVisit }, { queryOptional: context.queryOptional });
    const next = commitNarrativePlan(pack, before, fact);
    if (event.firstVisit) place(pack, next, event.depth, context);
    context.setState(validateNarrativeState(next, pack) as unknown as Json);
    for (const message of fact.messages) context.message(i18next.t(message.textKey));
}
function place(pack: NarrativePack, next: NarrativeState, depth: number, context: ExtensionContext): void {
    // Expiry is deterministic even if the player jumps over the final eligible depth.
    const retained: PendingPlacement[] = [];
    for (const pending of next.pendingPlacements) {
        const { placement } = narrativePlacementDefinition(pack, pending)!;
        if (depth > placement.maxDepth) next.placementReceipts.push({ npcId: pending.npcId, placementId: pending.placementId,
            instanceKey: pending.instanceKey, depth, result: 'skipped' });
        else retained.push(pending);
    }
    next.pendingPlacements = retained;
    const attempts: PendingPlacement[] = [];
    for (const npc of [...pack.npcs].sort((a, b) => a.id < b.id ? -1 : 1)) {
        for (const placement of [...npc.placements].sort((a, b) => a.id < b.id ? -1 : 1)) {
            if (depth < placement.minDepth || depth > placement.maxDepth) continue;
            const existing = [...next.placementReceipts, ...next.pendingPlacements].filter(item => item.placementId === placement.id);
            const usedHere = next.placementReceipts.filter(item => item.placementId === placement.id && item.depth === depth).length
                + next.pendingPlacements.filter(item => item.placementId === placement.id && item.attemptedDepths.includes(depth)).length;
            let available = Math.max(0, placement.maxPerDepth - usedHere);
            for (const pending of next.pendingPlacements.filter(item => item.placementId === placement.id).sort(order)) {
                if (available <= 0) break;
                // Forward-only attempts are bounded and immune to revisiting previous floors.
                if (pending.attemptedDepths.some(attempted => attempted >= depth)) continue;
                attempts.push(pending); available--;
            }
            let ordinal = existing.length + 1;
            while (available > 0 && ordinal <= placement.maxPerRun) {
                attempts.push({ npcId: npc.id, placementId: placement.id, instanceKey: narrativePlacementKey(placement.id, ordinal++), attemptedDepths: [] });
                available--;
            }
        }
    }
    attempts.sort(order);
    const attemptKeys = new Set(attempts.map(item => item.instanceKey));
    const newSlots = attempts.filter(item => !next.pendingPlacements.some(pending => pending.instanceKey === item.instanceKey)).length;
    if (narrativeReceiptCount(next) + newSlots > pack.config.limits.maxReceipts) throw new NarrativeError('RECEIPT_LIMIT', '$state.placementReceipts');
    const room = Math.max(0, pack.config.limits.maxActiveNpcs - Object.keys(next.npcBindings).length);
    const requests: WorldInteractablePlacement[] = attempts.slice(0, room).map(attempt => {
        const { npc, placement } = narrativePlacementDefinition(pack, attempt)!;
        return { instanceKey: attempt.instanceKey, contentId: npc.id, nameKey: npc.nameKey, descriptionKey: npc.descriptionKey,
            glyph: npc.glyph, color: npc.color, interactionDistance: npc.interactionDistance, priority: 0,
            minStairDistance: placement.minStairDistance, maxEntranceDistance: placement.maxEntranceDistance };
    });
    const results = requests.length ? context.placeInteractables(requests) : [];
    if (results.length !== requests.length || results.some((result, index) => result.instanceKey !== requests[index]!.instanceKey))
        throw new NarrativeError('INVALID_STATE', '$world.placements');
    next.pendingPlacements = next.pendingPlacements.filter(item => !attemptKeys.has(item.instanceKey));
    for (const attempt of attempts) {
        const { npc, placement } = narrativePlacementDefinition(pack, attempt)!;
        const entity = results.find(result => result.instanceKey === attempt.instanceKey)?.entity ?? null;
        const binding = { npcId: attempt.npcId, placementId: attempt.placementId, instanceKey: attempt.instanceKey };
        if (entity) {
            if (entity.owner !== 'narrative' || entity.contentId !== npc.id || entity.instanceKey !== attempt.instanceKey || entity.depth !== depth
                || next.npcBindings[entity.id]) throw new NarrativeError('INVALID_STATE', '$world.placements');
            next.npcBindings[entity.id] = binding;
            next.placementReceipts.push({ ...binding, depth, result: 'placed' });
        } else if (placement.onNoSpace === 'skip' || depth === placement.maxDepth) {
            next.placementReceipts.push({ ...binding, depth, result: 'skipped' });
        } else next.pendingPlacements.push({ ...binding, attemptedDepths: [...attempt.attemptedDepths, depth] });
    }
    next.placementReceipts.sort(order); next.pendingPlacements.sort(order);
}
