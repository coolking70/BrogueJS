<script lang="ts">
/** Viewport coordinates: keep the popup above the actual More button, even
 * when an immersive dock or a scrolling landscape bar changes its parent. */
export function commandOverflowPosition(anchor: { top: number; right: number }, height: number,
  viewport: { width: number; height: number; left?: number; top?: number }) {
  const margin = 8, gap = 8;
  const leftEdge = (viewport.left ?? 0) + margin;
  const topEdge = (viewport.top ?? 0) + margin;
  const width = Math.max(0, Math.min(290, viewport.width - margin * 2));
  const bottom = Math.min(anchor.top - gap, (viewport.top ?? 0) + viewport.height - margin);
  const maxHeight = Math.max(0, bottom - topEdge);
  return {
    left: Math.max(leftEdge, Math.min(anchor.right - width, leftEdge + viewport.width - margin * 2 - width)),
    top: Math.max(topEdge, bottom - Math.min(height, maxHeight)),
    width, maxHeight,
  };
}
</script>

<script setup lang="ts">
// FE-1：触屏常用命令栏。每个按钮 = 一个键盘命令，经 ui/commands.dispatch
// （inputManager.triggerAction → game.handlePlayerAction）进入录制边界。
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useTranslation } from 'i18next-vue';
import { inputManager } from '../engine/Input';
import { dispatch } from '../ui/commands';
import type { ModuleUiCommand } from '../ext/ui/types';

const props = defineProps<{ mode: 'portrait' | 'landscape' | 'desktop'; moduleCommands?: readonly ModuleUiCommand[] }>();
const emit = defineEmits<{ 'modal-open': [] }>();
const expanded = ref(false);
watch(expanded, open => { if (open) emit('modal-open'); }, { flush: 'sync' });
const root = ref<HTMLElement>();
const more = ref<HTMLElement>();
const overflow = ref<HTMLElement>();
const overflowStyle = ref<Record<string, string>>({ visibility: 'hidden' });
let observedOverflow: HTMLElement | undefined;
function positionOverflow() {
  if (!expanded.value) return;
  const anchor = more.value?.getBoundingClientRect?.();
  const popup = overflow.value;
  if (!anchor || !popup?.getBoundingClientRect) return;
  const visual = window.visualViewport;
  const position = commandOverflowPosition(anchor, popup.scrollHeight + 2, {
    width: visual?.width ?? window.innerWidth, height: visual?.height ?? window.innerHeight,
    left: visual?.offsetLeft, top: visual?.offsetTop,
  });
  overflowStyle.value = {
    left: `${position.left}px`, top: `${position.top}px`, width: `${position.width}px`,
    maxHeight: `${position.maxHeight}px`, visibility: 'visible',
  };
}
watch([expanded, () => props.mode], async () => {
  if (observedOverflow) resizeObserver?.unobserve?.(observedOverflow);
  observedOverflow = undefined;
  overflowStyle.value = { visibility: 'hidden' };
  await nextTick();
  if (overflow.value) { observedOverflow = overflow.value; resizeObserver?.observe(observedOverflow); }
  positionOverflow();
});
const closeOutside = (event: PointerEvent) => { if (expanded.value && !root.value?.contains(event.target as Node)) expanded.value = false; };
const primary = new Set(['auto_explore', 'search', 'wait', 'pickup', 'toggle_inventory', 'throw_item', 'escape']);
function invoke(action: string, data?: unknown) { expanded.value = false; (document.activeElement as HTMLElement)?.blur(); const command = props.moduleCommands?.find(entry => entry.id === action); if (command) { if (!command.disabled) command.invoke(); } else dispatch(action, data); }
let removeKeyboard: (() => void) | undefined;
let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
 document.addEventListener('pointerdown', closeOutside);
 window.addEventListener('resize', positionOverflow);
 window.addEventListener('scroll', positionOverflow, true);
 window.visualViewport?.addEventListener('resize', positionOverflow);
 window.visualViewport?.addEventListener('scroll', positionOverflow);
 if (typeof ResizeObserver !== 'undefined') {
   resizeObserver = new ResizeObserver(positionOverflow);
   if (root.value) resizeObserver.observe(root.value);
 }
 removeKeyboard = inputManager.registerModalKeyHandler(event => {
 if (!expanded.value) return false;
 if (event.key === 'Escape') { expanded.value = false; (document.activeElement as HTMLElement)?.blur(); }
 return true;
}, 350); });
onUnmounted(() => {
 removeKeyboard?.(); resizeObserver?.disconnect();
 document.removeEventListener('pointerdown', closeOutside);
 window.removeEventListener('resize', positionOverflow);
 window.removeEventListener('scroll', positionOverflow, true);
 window.visualViewport?.removeEventListener('resize', positionOverflow);
 window.visualViewport?.removeEventListener('scroll', positionOverflow);
});

// key：与 Input.ts 同一动作名；label：i18n 键；glyph：CE 的按键字符，作为图标提示
const { t } = useTranslation();
// i18n 键必须是字面量（p1_30 扫描器要求首参可静态解析）
const commands = computed<{ action: string; label: string; glyph?: string; data?: string; disabled?: boolean }[]>(() => [
  { action: 'search', label: t('mobile.cmd.search'), glyph: 's' },
  { action: 'search_long', label: t('mobile.cmd.search_long'), glyph: 'Ctrl-S' },
  { action: 'wait', label: t('mobile.cmd.rest'), glyph: 'z' },
  { action: 'auto_rest', label: t('mobile.cmd.auto_rest'), glyph: 'Z' },
  { action: 'pickup', label: t('mobile.cmd.pickup'), glyph: 'g' },
  { action: 'toggle_inventory', label: t('mobile.cmd.inventory'), glyph: 'i' },
  ...(props.moduleCommands ?? []).map(command => ({ action: command.id, label: command.label, glyph: command.glyph, disabled: command.disabled })),
  { action: 'throw_item', label: t('mobile.cmd.throw'), glyph: 't' },
  { action: 'auto_explore', label: t('mobile.cmd.explore'), glyph: 'x' },
  { action: 'travel_stairs', data: 'up', label: t('mobile.cmd.stairs_up'), glyph: '<' },
  { action: 'travel_stairs', data: 'down', label: t('mobile.cmd.stairs_down'), glyph: '>' },
  { action: 'discoveries', label: t('mobile.cmd.discoveries'), glyph: 'D' },
  { action: 'help', label: t('mobile.cmd.help'), glyph: '?' },
  { action: 'escape', label: t('mobile.cmd.cancel'), glyph: 'Esc' },
]);
</script>

<template>
  <nav ref="root" class="command-bar" :class="[`cmd-${mode}`, { expanded }]" @keydown.stop @keyup.stop @keydown.esc="expanded = false; ($event.target as HTMLElement)?.blur()" :aria-label="$t('controls.title')">
    <button v-for="cmd in commands.filter(c => (primary.has(c.action) || props.moduleCommands?.some(entry => entry.id === c.action)))" :key="cmd.action + (cmd.data ?? '')" class="cmd-btn" :data-action="cmd.action"
            :data-direction="cmd.data" :title="cmd.label" :disabled="cmd.disabled" @click="invoke(cmd.action, cmd.data)">
      <span class="cmd-label">{{ cmd.label }}</span>
      <kbd v-if="cmd.glyph" class="cmd-key" aria-hidden="true">{{ cmd.glyph }}</kbd>
    </button>
    <button ref="more" class="cmd-btn command-more" :aria-expanded="expanded" @click="expanded = !expanded; ($event.currentTarget as HTMLElement).blur()"><span class="cmd-label">{{ expanded ? $t('theme.command_less') : $t('theme.command_more') }}</span><span>···</span></button>
    <div v-if="expanded" ref="overflow" class="command-overflow" :style="overflowStyle">
      <button v-for="cmd in commands.filter(c => !(primary.has(c.action) || props.moduleCommands?.some(entry => entry.id === c.action)))" :key="cmd.action + (cmd.data ?? '')" class="cmd-btn" :data-action="cmd.action" :data-direction="cmd.data" @click="invoke(cmd.action, cmd.data)"><span class="cmd-label">{{ cmd.label }}</span><kbd class="cmd-key">{{ cmd.glyph }}</kbd></button>
    </div>
  </nav>
</template>

<style scoped>
.command-bar {
  display: grid;
  gap: 6px;
  padding: 6px;
  box-sizing: border-box;
  background: var(--panel-bg-strong, #0f1115f2);
}
.cmd-portrait {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding-left: max(6px, env(safe-area-inset-left));
  padding-bottom: max(6px, env(safe-area-inset-bottom));
  align-content: center;
}
.cmd-landscape {
  grid-template-columns: repeat(2, 58px);
  grid-auto-rows: minmax(40px, 1fr);
  align-content: center;
  padding-left: max(6px, env(safe-area-inset-left));
  border-right: 1px solid var(--panel-border, #ffffff1f);
  overflow-y: auto;
}
.cmd-desktop {
  grid-template-columns: repeat(6, 64px);
  margin: 0 0 12px 12px;
  border-radius: 12px;
  border: 1px solid var(--panel-border, #ffffff1f);
  background: #0f1115cc;
  z-index: 12;
}
.cmd-btn {
  position: relative;
  min-height: 44px;
  min-width: 0;
  padding: 11px 3px 3px;
  border-radius: 10px;
  border: 1px solid var(--panel-border, #ffffff26);
  background: var(--btn-bg, #1f2430);
  color: var(--text-primary);
  font-family: var(--font-main);
  font-size: 0.85rem;
  line-height: 1.1;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
}
.cmd-landscape .cmd-btn { min-height: 40px; font-size: 0.8rem; }
.cmd-portrait .cmd-btn { font-size: 0.8rem; }
.cmd-btn:active { background: var(--btn-bg-active, #2d3445); transform: translateY(1px); }
.cmd-label { display: block; white-space: normal; overflow-wrap: anywhere; }
.cmd-key {
  position: absolute;
  top: 2px;
  right: 4px;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  color: var(--text-secondary);
  opacity: 0.8;
}
</style>
