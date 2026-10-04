import { computed } from 'vue';
import type { ModuleUiContribution, ModuleUiSession } from '../../../ui/types';

/** A valid discovered contribution with no mounted slots, listeners or controls.
 * Even when opted in, 3a1 must not imply that combat is playable. */
export function useCombatUi(): ModuleUiSession {
    return {
        hud: computed(() => null), bar: computed(() => null), panel: computed(() => null),
        commands: computed(() => []), panelOpen: computed(() => false),
        refresh() { /* No live mechanics or projection to poll. */ },
        close() { /* No dialog or physical input ownership. */ },
    };
}
export default { moduleId: 'combat', useSession: useCombatUi } satisfies ModuleUiContribution;
