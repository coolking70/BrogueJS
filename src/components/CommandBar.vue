<script setup lang="ts">
// FE-1：触屏常用命令栏。每个按钮 = 一个键盘命令，经 ui/commands.dispatch
// （inputManager.triggerAction → game.handlePlayerAction）进入录制边界。
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useTranslation } from 'i18next-vue';
import { inputManager } from '../engine/Input';
import { dispatch } from '../ui/commands';

defineProps<{ mode: 'portrait' | 'landscape' | 'desktop' }>();
const expanded = ref(false);
const root = ref<HTMLElement>();
const closeOutside = (event: PointerEvent) => { if (expanded.value && !root.value?.contains(event.target as Node)) expanded.value = false; };
const primary = new Set(['auto_explore', 'search', 'wait', 'pickup', 'toggle_inventory', 'throw_item', 'escape']);
function invoke(action: string, data?: unknown) { expanded.value = false; (document.activeElement as HTMLElement)?.blur(); dispatch(action, data); }
let removeKeyboard: (() => void) | undefined;
onMounted(() => { document.addEventListener('pointerdown', closeOutside); removeKeyboard = inputManager.registerModalKeyHandler(event => {
 if (!expanded.value) return false;
 if (event.key === 'Escape') { expanded.value = false; (document.activeElement as HTMLElement)?.blur(); }
 return true;
}, 350); });
onUnmounted(() => { removeKeyboard?.(); document.removeEventListener('pointerdown', closeOutside); });

// key：与 Input.ts 同一动作名；label：i18n 键；glyph：CE 的按键字符，作为图标提示
const { t } = useTranslation();
// i18n 键必须是字面量（p1_30 扫描器要求首参可静态解析）
const commands = computed(() => [
  { action: 'search', label: t('mobile.cmd.search'), glyph: 's' },
  { action: 'search_long', label: t('mobile.cmd.search_long'), glyph: 'Ctrl-S' },
  { action: 'wait', label: t('mobile.cmd.rest'), glyph: 'z' },
  { action: 'auto_rest', label: t('mobile.cmd.auto_rest'), glyph: 'Z' },
  { action: 'pickup', label: t('mobile.cmd.pickup'), glyph: 'g' },
  { action: 'toggle_inventory', label: t('mobile.cmd.inventory'), glyph: 'i' },
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
    <button v-for="cmd in commands.filter(c => primary.has(c.action))" :key="cmd.action + (cmd.data ?? '')" class="cmd-btn" :data-action="cmd.action"
            :data-direction="cmd.data" @click="invoke(cmd.action, cmd.data)">
      <span class="cmd-label">{{ cmd.label }}</span>
      <kbd v-if="cmd.glyph" class="cmd-key" aria-hidden="true">{{ cmd.glyph }}</kbd>
    </button>
    <button class="cmd-btn command-more" :aria-expanded="expanded" @click="expanded = !expanded; ($event.currentTarget as HTMLElement).blur()"><span class="cmd-label">{{ expanded ? $t('lab.command_less') : $t('lab.command_more') }}</span><span>···</span></button>
    <div v-if="expanded" class="command-overflow">
      <button v-for="cmd in commands.filter(c => !primary.has(c.action))" :key="cmd.action + (cmd.data ?? '')" class="cmd-btn" :data-action="cmd.action" :data-direction="cmd.data" @click="invoke(cmd.action, cmd.data)"><span class="cmd-label">{{ cmd.label }}</span><kbd class="cmd-key">{{ cmd.glyph }}</kbd></button>
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
