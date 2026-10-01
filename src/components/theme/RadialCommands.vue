<script setup lang="ts">
// DESIGN-2（一线）：桌面/触屏命令环。轻点中心展开/收起，点选一项即执行；
// 按住中心拖到某项上松手也会执行。每项 = 一个键盘命令，经 ui/commands.dispatch。
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useTranslation } from 'i18next-vue';
import { inputManager } from '../../engine/Input';
import { dispatch } from '../../ui/commands';
import CmdIcon from './CmdIcon.vue';
const { t } = useTranslation();
const open = ref(false);
let dragFromHub: boolean = false;
const root = ref<HTMLElement>();
const items = computed<Array<{ action: string; label: string; data?: string }>>(() => [
  { action: 'auto_explore', label: t('mobile.cmd.explore') },
  { action: 'search', label: t('mobile.cmd.search') },
  { action: 'wait', label: t('mobile.cmd.rest') },
  { action: 'pickup', label: t('mobile.cmd.pickup') },
  { action: 'toggle_inventory', label: t('mobile.cmd.inventory') },
  { action: 'throw_item', label: t('mobile.cmd.throw') },
  { action: 'travel_stairs', data: 'down', label: t('mobile.cmd.stairs_down') },
  { action: 'escape', label: t('mobile.cmd.cancel') },
]);
const angle = (i: number) => -90 + i * (360 / items.value.length);
function run(action: string, data?: unknown) { open.value = false; (document.activeElement as HTMLElement)?.blur(); dispatch(action, data); }
function onHubDown(event: PointerEvent) {
  open.value = !open.value; dragFromHub = open.value;
  // 展开时圆环向视口内移动；保持抬起事件送到中心，继续支持拖选。
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function onRelease(event: PointerEvent) {
  const fromHub = dragFromHub; dragFromHub = false;
  if (!open.value || !fromHub) return;
  const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-radial-action]') as HTMLElement | null;
  if (el && root.value?.contains(el)) { const i = Number(el.dataset.radialIndex); const it = items.value[i]; if (it) run(it.action, it.data); }
}
const closeOutside = (event: PointerEvent) => { if (open.value && !root.value?.contains(event.target as Node)) open.value = false; };
let removeKeyboard: (() => void) | undefined;
onMounted(() => {
  document.addEventListener('pointerdown', closeOutside);
  removeKeyboard = inputManager.registerModalKeyHandler(event => {
    if (!open.value) return false;
    if (event.key === 'Escape') { open.value = false; (document.activeElement as HTMLElement)?.blur(); }
    return true;
  }, 360);
});
onUnmounted(() => { removeKeyboard?.(); document.removeEventListener('pointerdown', closeOutside); });
</script>

<template>
  <div ref="root" class="radial-commands" :class="{ open }" @keydown.stop @keyup.stop @pointerup="onRelease">
    <button v-for="(it, i) in items" :key="it.action + (it.data ?? '')" class="rc-item" :data-radial-action="it.action" :data-radial-index="i"
            :tabindex="open ? 0 : -1" :aria-hidden="open ? 'false' : 'true'" :style="{ '--a': `${angle(i)}deg` }" @click="run(it.action, it.data)">
      <CmdIcon :action="it.action" :direction="it.data" /><span>{{ it.label }}</span>
    </button>
    <button class="rc-hub" :aria-expanded="open" :aria-label="$t('theme.commands')" @pointerdown="onHubDown" @click.prevent><span aria-hidden="true">✦</span></button>
  </div>
</template>
