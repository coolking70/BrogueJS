import { onMounted, onUnmounted, shallowRef, watch, type Ref } from 'vue';
import { activeGame } from '../engine/Core/Game';
import { readGrowthCharacterView, type GrowthAllocationDraft, type GrowthCharacterViewModel } from '../ext/modules/growth/view';

/** One display-only poll for the HUD and the open draft. No snapshots, RNG or commands. */
export function useGrowthCharacter(draft: Ref<GrowthAllocationDraft | null>) {
    const view = shallowRef<GrowthCharacterViewModel | null>(null);
    const poll = () => { view.value = readGrowthCharacterView(activeGame, draft.value); };
    watch(draft, poll, { flush: 'sync' });
    let timer = 0;
    onMounted(() => { poll(); timer = window.setInterval(poll, 100); });
    onUnmounted(() => window.clearInterval(timer));
    return { view, poll };
}
