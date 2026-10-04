import type { ExtensionContext, Json } from '../../types';
import { NarrativeError } from './errors';
import type { NarrativePlan } from './effects';
import type { NarrativePack } from './types';
import { validateNarrativeState, type NarrativeState } from './state';

/** Called only after the complete causal plan has passed. The foundation owns rollback
 * of both modules, native resources, messages and fact allocation on any later error. */
export function commitNarrativeStoryPlan(pack: NarrativePack, plan: NarrativePlan, next: NarrativeState, context: ExtensionContext): void {
    const state = validateNarrativeState(next, pack);
    const intents = [...plan.rewardIntents].sort((a, b) => a.factId - b.factId || a.effectIndex - b.effectIndex
        || (a.receiptId < b.receiptId ? -1 : a.receiptId > b.receiptId ? 1 : 0));
    for (const intent of intents) {
        const result = context.commitOptionalReward(intent.capability, intent.rewardId, intent.instanceKey);
        if (result.status !== 'applied') throw new NarrativeError('INVALID_OPTIONAL_RESULT', '$commit.reward');
        state.rewardReceipts.push({ id: intent.receiptId, instanceKey: intent.instanceKey, result: 'applied', reason: null });
    }
    state.rewardReceipts.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    if (plan.events.length) context.commitFactRange(plan.events[0]!.factId, plan.events.length);
    context.setState(validateNarrativeState(state, pack) as unknown as Json);
}
