import { computed, defineAsyncComponent, ref, onScopeDispose } from 'vue';
import type { ModuleUiContribution, ModuleUiSession } from '../../../ui/types';
import { selectBossHud } from './view';
const BossHud = defineAsyncComponent(() => import('./BossHud.vue'));
export default {
  moduleId: 'giants',
  useSession(host): ModuleUiSession {
    const game = host.game(),
      runtime = game.extensionRuntime;
    let retired = false;
    onScopeDispose(() => {
      retired = true;
    });
    return {
      hud: computed(() => {
        host.tick.value;
        if (
          retired ||
          host.game() !== game ||
          game.extensionRuntime !== runtime ||
          !host.readDisplayFrame
        )
          return null;
        const model = selectBossHud(host.readDisplayFrame());
        return model ? { component: BossHud, props: { model } } : null;
      }),
      bar: ref(null),
      panel: ref(null),
      commands: ref([]),
      panelOpen: ref(false),
      refresh() {},
      close() {}
    };
  }
} satisfies ModuleUiContribution;
