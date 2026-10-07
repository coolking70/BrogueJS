<script setup lang="ts">
import { computed, shallowReactive, ref } from 'vue';
import LootItemChip from '../../ui/LootItemChip.vue';
import LootItemCard from '../../ui/LootItemCard.vue';
import LootComparePanel from '../../ui/LootComparePanel.vue';
import LootSalvagePanel from '../../ui/LootSalvagePanel.vue';
import LootPickupFilterForm from '../../ui/LootPickupFilterForm.vue';
import LootPresetPicker from '../../ui/LootPresetPicker.vue';
import { LOOT_UI_COMPONENTS, LOOT_UI_PREVIEW_THEMES, LOOT_UI_PREVIEW_WIDTHS, LOOT_UI_STATES, lootUiPreviewProps } from './states';
import type { LootUiState } from './states';

const props = withDefaults(defineProps<{ mode?: 'live' | 'static' }>(), { mode: 'live' });
const theme = ref<'dark' | 'light'>('dark');
const width = ref<number | 'all'>('all');
const componentFilter = ref('all');
const lastEvent = ref('');
const changes = shallowReactive<Record<string, Record<string, unknown>>>({});
const componentMap = { chip: LootItemChip, card: LootItemCard, compare: LootComparePanel, salvage: LootSalvagePanel, filter: LootPickupFilterForm, preset: LootPresetPicker };
const themes = computed(() => props.mode === 'static' ? LOOT_UI_PREVIEW_THEMES : [theme.value]);
const widths = computed(() => props.mode === 'static' || width.value === 'all' ? LOOT_UI_PREVIEW_WIDTHS : [width.value]);
const states = computed(() => LOOT_UI_STATES.filter(state => componentFilter.value === 'all' || state.component === componentFilter.value));
const frameKey = (id: string, theme: string, width: number) => `${id}:${theme}:${width}`;
function frameProps(state: LootUiState, frame: string) {
  return { ...lootUiPreviewProps(state), ...changes[frame] };
}
function change(frame: string, field: string, value: unknown) {
  changes[frame] = { ...changes[frame], [field]: value };
  lastEvent.value = `${frame} → ${field}: ${JSON.stringify(value)}`;
}
function event(frame: string, name: string, value?: unknown) {
  lastEvent.value = `${frame} → ${name}${value === undefined ? '' : `: ${JSON.stringify(value)}`}`;
}
</script>
<template>
  <main class="loot-gallery" :data-loot-theme="theme" :data-preview-mode="mode">
    <header class="loot-gallery-heading">
      <h1 class="loot-gallery-title">Loot UI · 纯展示组件预览</h1>
      <p class="loot-gallery-description">固定种子真实夹具 · {{ LOOT_UI_STATES.length }} 个状态 · 320 / 390 / 1024 px · 不连接游戏</p>
    </header>
    <div v-if="mode === 'live'" class="loot-gallery-toolbar">
      <label class="loot-gallery-control">主题
        <select v-model="theme" class="loot-gallery-select"><option value="dark">深色</option><option value="light">浅色</option></select>
      </label>
      <label class="loot-gallery-control">容器宽度
        <select v-model="width" class="loot-gallery-select"><option value="all">三种宽度</option><option v-for="size in LOOT_UI_PREVIEW_WIDTHS" :key="size" :value="size">{{ size }} px</option></select>
      </label>
      <label class="loot-gallery-control">组件
        <select v-model="componentFilter" class="loot-gallery-select"><option value="all">全部组件</option><option v-for="component in LOOT_UI_COMPONENTS" :key="component" :value="component">{{ component }}</option></select>
      </label>
      <output class="loot-gallery-event">{{ lastEvent || '组件事件会显示在这里；可直接操作按钮、选择与方向键' }}</output>
    </div>
    <section v-for="state in states" :key="state.id" class="loot-gallery-state" :data-loot-state="state.id">
      <h2 class="loot-gallery-state-title">{{ state.id }}</h2>
      <div class="loot-gallery-frames">
        <template v-for="frameTheme in themes" :key="frameTheme">
          <section v-for="size in widths" :key="frameKey(state.id, frameTheme, size)" class="loot-gallery-frame" :data-loot-theme="frameTheme" :data-loot-width="size" :data-loot-frame="frameKey(state.id, frameTheme, size)" :style="{ width: `${size}px` }">
            <h3 class="loot-gallery-frame-title">{{ frameTheme === 'light' ? '浅色' : '深色' }} · {{ size }} px</h3>
            <component :is="componentMap[state.component]" v-bind="frameProps(state, frameKey(state.id, frameTheme, size))"
              @update:model-value="change(frameKey(state.id, frameTheme, size), 'modelValue', $event)"
              @submit="change(frameKey(state.id, frameTheme, size), 'value', $event)"
              @activate="event(frameKey(state.id, frameTheme, size), 'activate')"
              @action="event(frameKey(state.id, frameTheme, size), 'action', $event)"
              @confirm="event(frameKey(state.id, frameTheme, size), 'confirm', $event)"
              @cancel="event(frameKey(state.id, frameTheme, size), 'cancel')"
              @close="event(frameKey(state.id, frameTheme, size), 'close')" />
          </section>
        </template>
      </div>
    </section>
  </main>
</template>
<style>
.loot-gallery { --loot-bg: #0d0d0c; --loot-fg: #e4dfd1; --loot-dim: #9e998d; --loot-line: #34322c; --loot-raised: #181815; --loot-focus: #e4dfd1; margin: 0; padding: 24px; min-height: 100vh; box-sizing: border-box; font-family: monospace; background: var(--loot-bg); color: var(--loot-fg); }
.loot-gallery[data-loot-theme="light"], .loot-gallery-frame[data-loot-theme="light"] { --loot-bg: #f4f1e8; --loot-fg: #1f1d18; --loot-dim: #5d584c; --loot-line: #b9b2a0; --loot-raised: #ebe6d8; --loot-focus: #1f1d18; }
.loot-gallery-heading { margin-bottom: 20px; }
.loot-gallery-title { font-size: 24px; margin: 0 0 8px; }
.loot-gallery-description { color: var(--loot-dim); margin: 0; }
.loot-gallery-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; padding: 16px 0; border-block: 1px solid var(--loot-line); }
.loot-gallery-control { display: grid; gap: 6px; }
.loot-gallery-select { min-height: 44px; min-width: 44px; padding: 8px 12px; font: inherit; color: var(--loot-fg); background: var(--loot-raised); border: 1px solid var(--loot-line); }
.loot-gallery-select:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-gallery-event { min-width: 0; flex: 1 1 100%; overflow-wrap: anywhere; color: var(--loot-dim); }
.loot-gallery-state { padding-block: 20px 28px; border-bottom: 1px solid var(--loot-line); }
.loot-gallery-state-title { font-size: 16px; margin: 0 0 12px; }
.loot-gallery-frames { display: flex; flex-wrap: wrap; align-items: start; gap: 16px; }
.loot-gallery-frame { flex: none; box-sizing: border-box; max-width: none; min-width: 0; color: var(--loot-fg); background: var(--loot-bg); outline: 1px dashed var(--loot-line); }
.loot-gallery-frame-title { font-size: 12px; font-weight: normal; margin: 0; padding: 8px; color: var(--loot-dim); background: var(--loot-raised); }
</style>
