<script setup lang="ts">
// DESIGN-3（沉浸模式）：桌面/触屏命令环。轻点中心展开/收起，点选一项即执行；
// 按住中心拖到某项上松手也会执行。每项 = 一个键盘命令，经 ui/commands.dispatch。
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useTranslation } from 'i18next-vue';
import { inputManager } from '../../engine/Input';
import { dispatch } from '../../ui/commands';
import CmdIcon from './CmdIcon.vue';
const { t } = useTranslation();
const open = ref(false);
const emit = defineEmits<{ 'modal-open': [] }>();
watch(open, value => { if (value) emit('modal-open'); }, { flush: 'sync' });
// Client coordinates are CSS pixels. Ignore sub-8px touch jitter and layout
// relocation; selection requires movement of the same pointer from its origin.
const DRAG_THRESHOLD = 8;
let drag: { pointerId: number; x: number; y: number; moved: boolean; hub: HTMLElement } | null = null;
// Retain gesture ownership through implicit capture loss and compatibility click.
// The next real pointerdown starts a new gesture; keyboard clicks have detail=0.
let hubClickPointer: number | null = null;
let retired = false;
function onItemClick(event: PointerEvent | MouseEvent | undefined, action: string, data?: unknown) {
  if (event && event.detail !== 0 && 'pointerId' in event &&
      (event.pointerId === hubClickPointer || (drag && event.pointerId !== drag.pointerId))) return;
  run(action, data);
}
function clearDrag(release = true) {
  const previous = drag; drag = null;
  if (release && previous?.hub.hasPointerCapture?.(previous.pointerId))
    previous.hub.releasePointerCapture(previous.pointerId);
}
function close() { clearDrag(); open.value = false; }
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
function run(action: string, data?: unknown) {
  if (retired) return;
  close(); (document.activeElement as HTMLElement)?.blur(); dispatch(action, data);
}
function onHubDown(event: PointerEvent) {
  if (retired || (drag && drag.pointerId !== event.pointerId)) return;
  hubClickPointer = event.pointerId;
  if (open.value) { close(); return; }
  const hub = event.currentTarget as HTMLElement;
  drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, hub };
  open.value = true;
  // Capture keeps releases on the hub after the ring moves, without mistaking
  // the newly exposed item at the original coordinates for a deliberate drag.
  hub.setPointerCapture(event.pointerId);
}
function onMove(event: PointerEvent) {
  if (drag?.pointerId === event.pointerId
      && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= DRAG_THRESHOLD)
    drag.moved = true;
}
function onCancel(event: PointerEvent) {
  if (drag?.pointerId === event.pointerId) clearDrag();
}
function onRelease(event: PointerEvent) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  onMove(event);
  const moved = drag.moved;
  clearDrag(false); // Native pointerup releases capture after delivery.
  if (!open.value || !moved) return;
  const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-radial-action]') as HTMLElement | null;
  if (el && root.value?.contains(el)) { const i = Number(el.dataset.radialIndex); const it = items.value[i]; if (it) run(it.action, it.data); }
}
const closeOutside = (event: PointerEvent) => {
  // Capture phase precedes the hub handler, including subsequent direct taps.
  if (!drag || drag.pointerId === event.pointerId) hubClickPointer = null;
  if (open.value && !root.value?.contains(event.target as Node)) close();
};
let removeKeyboard: (() => void) | undefined;
onMounted(() => {
  document.addEventListener('pointerdown', closeOutside, true);
  removeKeyboard = inputManager.registerModalKeyHandler(event => {
    if (!open.value) return false;
    if (event.key === 'Escape') { close(); (document.activeElement as HTMLElement)?.blur(); }
    return true;
  }, 360);
});
onUnmounted(() => { retired = true; hubClickPointer = null; clearDrag(); removeKeyboard?.(); document.removeEventListener('pointerdown', closeOutside, true); });
</script>

<template>
  <div ref="root" class="radial-commands" :class="{ open }" @keydown.stop @keyup.stop @pointermove="onMove" @pointerup="onRelease" @pointercancel="onCancel" @lostpointercapture="onCancel">
    <button v-for="(it, i) in items" :key="it.action + (it.data ?? '')" class="rc-item" :data-radial-action="it.action" :data-radial-index="i"
            :tabindex="open ? 0 : -1" :aria-hidden="open ? 'false' : 'true'" :style="{ '--a': `${angle(i)}deg` }" @click="onItemClick($event, it.action, it.data)">
      <CmdIcon :action="it.action" :direction="it.data" /><span>{{ it.label }}</span>
    </button>
    <button class="rc-hub" :aria-expanded="open" :aria-label="$t('theme.commands')" @pointerdown="onHubDown" @click.prevent><span aria-hidden="true">✦</span></button>
  </div>
</template>
