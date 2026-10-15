<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { LootPresetOptionView } from './types';
const props = withDefaults(defineProps<{ options: readonly LootPresetOptionView[]; modelValue: string; disabled?: boolean }>(), { disabled: false });
const emit = defineEmits<{ 'update:modelValue': [id: string]; confirm: [id: string] }>();
const { t } = useTranslation();
const titleId = useId();
const root = ref<HTMLElement | null>(null);
const selected = computed(() => Math.max(0, props.options.findIndex(option => option.id === props.modelValue)));
function choose(id: string) { if (!props.disabled) emit('update:modelValue', id); }
function confirm() { if (!props.disabled && props.options.some(option => option.id === props.modelValue)) emit('confirm', props.modelValue); }
function keydown(event: KeyboardEvent) {
  if (props.disabled || !props.options.length) return;
  let index = selected.value;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index = (index + props.options.length - 1) % props.options.length;
  else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % props.options.length;
  else if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = props.options.length - 1;
  else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); confirm(); return; }
  else if (event.key !== ' ') return;
  event.preventDefault(); event.stopPropagation();
  const option = props.options[index];
  if (option) { choose(option.id); void nextTick(() => root.value?.querySelector?.<HTMLButtonElement>(`[data-preset="${option.id}"]`)?.focus()); }
}
</script>
<template>
  <section ref="root" class="loot-preset" role="dialog" :aria-labelledby="titleId">
    <h2 :id="titleId" class="loot-preset-title">{{ t('ext.loot.ui.preset.title') }}</h2>
    <div class="loot-preset-options" role="radiogroup" @keydown="keydown" :aria-label="t('ext.loot.ui.preset.title')"><button v-for="(option, index) in options" :key="option.id" class="loot-preset-option" type="button" role="radio" :aria-checked="modelValue === option.id" :tabindex="selected === index ? 0 : -1" :disabled="disabled" :data-preset="option.id" @click="choose(option.id)">
      <span class="loot-preset-name">{{ t(option.name.nameKey, option.name.params) }}</span>
      <span class="loot-preset-description">{{ t(option.description.nameKey, option.description.params) }}</span>
      <span class="loot-preset-metrics"><span v-for="metric in option.metrics" :key="metric.key" class="loot-preset-metric"><span>{{ t(metric.label.nameKey, metric.label.params) }}</span><span class="loot-preset-value">{{ metric.value }}</span></span></span>
    </button></div>
    <button class="loot-preset-confirm" type="button" data-action="confirm" :disabled="disabled || !options.some(option => option.id === modelValue)" @click="confirm">{{ t('ext.loot.ui.preset.confirm') }}</button>
  </section>
</template>
<style>
.loot-preset {
  --loot-bg: var(--th-panel, #0d0d0c); --loot-raised: var(--th-raised, #181815);
  --loot-fg: var(--th-fg, #e4dfd1); --loot-dim: var(--th-dim, #9e998d);
  --loot-line: var(--th-line, #34322c); --loot-good: var(--th-ok, #8fbf6a);
  --loot-bad: var(--th-hp, #d9503f); --loot-focus: var(--th-accent, #e4dfd1);
  box-sizing: border-box; min-width: 0; max-width: 100%; container-type: inline-size;
  color: var(--loot-fg); background: var(--loot-bg); font-family: var(--th-font, monospace);
  border-radius: var(--th-r, 0); overflow-wrap: anywhere; line-height: 1.5;
}
.loot-preset:is([data-loot-theme="light"], [data-loot-theme="light"] *) {
  --loot-bg: #f4f1e8; --loot-raised: #ebe6d8; --loot-fg: #1f1d18; --loot-dim: #5d584c;
  --loot-line: #b9b2a0; --loot-good: #2f6b1f; --loot-bad: #a3271b; --loot-focus: #1f1d18;
}
.loot-preset { padding: 12px; border: 1px solid var(--loot-line); }
.loot-preset-title { margin: 0 0 16px; font-size: 1.1rem; }
.loot-preset-options { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.loot-preset-option { min-height: 44px; min-width: 44px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--loot-line); background: var(--loot-raised); color: var(--loot-fg); font: inherit; border-radius: var(--th-r, 0); cursor: pointer; overflow-wrap: anywhere; }
.loot-preset-option:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-preset-option:disabled { opacity: .55; cursor: default; }
.loot-preset-confirm { min-height: 44px; min-width: 44px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--loot-line); background: var(--loot-raised); color: var(--loot-fg); font: inherit; border-radius: var(--th-r, 0); cursor: pointer; overflow-wrap: anywhere; }
.loot-preset-confirm:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-preset-confirm:disabled { opacity: .55; cursor: default; }
.loot-preset-option { display: flex; flex-direction: column; gap: 12px; text-align: left; min-width: 44px; }
.loot-preset-option[aria-checked="true"] { border-color: var(--loot-focus); box-shadow: inset 0 0 0 1px var(--loot-focus); }
.loot-preset-name { font-weight: 600; font-size: 1.05em; }
.loot-preset-description { color: var(--loot-dim); font-size: .9em; }
.loot-preset-metrics { display: grid; gap: 8px; width: 100%; }
.loot-preset-metric { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px; min-width: 0; font-size: .85em; }
.loot-preset-value { font-variant-numeric: tabular-nums; }
.loot-preset-confirm { width: 100%; margin-top: 16px; }
@container (max-width: 359px) { .loot-preset-metric { flex-direction: column; } }
@container (min-width: 360px) and (max-width: 639px) { .loot-preset-option { padding: 12px 16px; } }
@container (min-width: 640px) { .loot-preset-options { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

</style>
