import { shallowRef, watch, type Ref } from 'vue';
import type { Game } from '../../../../engine/Core/Game';
import { readGrowthCharacterView, type GrowthAllocationDraft, type GrowthCharacterViewModel } from '../view';

/** Display-only refresh owned by the enabled session scope. No RNG or commands. */
export function useGrowthCharacter(draft: Ref<GrowthAllocationDraft | null>, game: () => Game, live: () => boolean) {
    const view = shallowRef<GrowthCharacterViewModel | null>(null);
    const poll = () => { if (!live()) return; view.value = readGrowthCharacterView(game(), draft.value); };
    watch(draft, poll, { flush: 'sync', immediate: true });
    return { view, poll };
}
