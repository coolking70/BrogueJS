<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import LootItemChip from './LootItemChip.vue';
import type { LootCompareView } from './types';
const props = withDefaults(defineProps<{ view: LootCompareView; maxRows?: number }>(), { maxRows: 6 });
const emit = defineEmits<{ close: [] }>();
const { t } = useTranslation();
const titleId = useId();
const expanded = ref<readonly number[]>([]);
const limit = computed(() => Math.max(0, Math.floor(props.maxRows)));
watch(() => props.view, () => { expanded.value = []; });
function toggle(index: number) { expanded.value = expanded.value.includes(index) ? expanded.value.filter(value => value !== index) : [...expanded.value, index]; }
function keydown(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); emit('close'); } }
</script>
<template>
  <section class="loot-compare" role="dialog" :aria-labelledby="titleId" @keydown="keydown">
    <div class="loot-compare-heading"><h2 :id="titleId" class="loot-compare-title">{{ t('ext.loot.ui.compare.title') }}</h2><button class="loot-compare-button" type="button" data-action="close" @click="emit('close')">{{ t('ext.loot.ui.compare.close') }}</button></div>
    <LootItemChip :view="view.candidate" />
    <div v-if="view.available" class="loot-compare-columns">
      <section v-for="(column, index) in view.columns" :key="index" class="loot-compare-column">
        <h3 class="loot-compare-slot">{{ t(column.slot.nameKey, column.slot.params) }}</h3>
        <LootItemChip v-if="column.equipped" :view="column.equipped" compact />
        <p v-else class="loot-compare-empty">{{ t('ext.loot.ui.slot.empty') }}</p>
        <table class="loot-compare-table">
          <thead><tr><th scope="col">{{ t('ext.loot.ui.compare.attribute') }}</th><th scope="col">{{ t('ext.loot.ui.compare.before') }}</th><th scope="col">{{ t('ext.loot.ui.compare.after') }}</th><th scope="col">{{ t('ext.loot.ui.compare.delta') }}</th></tr></thead>
          <tbody><tr v-for="row in (expanded.includes(index) ? column.rows : column.rows.slice(0, limit))" :key="row.key" class="loot-compare-row" :class="`loot-compare-${row.tone}`"><th scope="row">{{ t(row.label.nameKey, row.label.params) }}</th><td :data-label="t('ext.loot.ui.compare.before')">{{ row.before }}</td><td :data-label="t('ext.loot.ui.compare.after')">{{ row.after }}</td><td class="loot-compare-delta" :data-label="t('ext.loot.ui.compare.delta')">{{ row.delta }}</td></tr></tbody>
        </table>
        <button v-if="column.rows.length > limit" class="loot-compare-button loot-compare-toggle" type="button" :data-column="index" data-action="toggle-compare" :aria-expanded="expanded.includes(index)" @click="toggle(index)">{{ expanded.includes(index) ? t('ext.loot.ui.compare.less') : t('ext.loot.ui.compare.all') }}</button>
      </section>
    </div>
    <ul class="loot-compare-notices"><li v-for="(notice, index) in view.notices" :key="index">{{ t(notice.nameKey, notice.params) }}</li></ul>
  </section>
</template>
<style>
.loot-compare {
  --loot-bg: var(--th-panel, #0d0d0c); --loot-raised: var(--th-raised, #181815);
  --loot-fg: var(--th-fg, #e4dfd1); --loot-dim: var(--th-dim, #9e998d);
  --loot-line: var(--th-line, #34322c); --loot-good: var(--th-ok, #8fbf6a);
  --loot-bad: var(--th-hp, #d9503f); --loot-focus: var(--th-accent, #e4dfd1);
  box-sizing: border-box; min-width: 0; max-width: 100%; container-type: inline-size;
  color: var(--loot-fg); background: var(--loot-bg); font-family: var(--th-font, monospace);
  border-radius: var(--th-r, 0); overflow-wrap: anywhere; line-height: 1.5;
}
.loot-compare:is([data-loot-theme="light"], [data-loot-theme="light"] *) {
  --loot-bg: #f4f1e8; --loot-raised: #ebe6d8; --loot-fg: #1f1d18; --loot-dim: #5d584c;
  --loot-line: #b9b2a0; --loot-good: #2f6b1f; --loot-bad: #a3271b; --loot-focus: #1f1d18;
}
.loot-compare { padding: 12px; border: 1px solid var(--loot-line); }
.loot-compare-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.loot-compare-title { font-size: 1.1rem; margin: 0; }
.loot-compare-columns { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; margin-top: 16px; }
.loot-compare-column { min-width: 0; }
.loot-compare-slot { font-size: 1rem; margin: 0 0 8px; }
.loot-compare-empty, .loot-compare-notices { color: var(--loot-dim); }
.loot-compare-table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-top: 12px; font-size: .9em; }
.loot-compare-table th, .loot-compare-table td { min-width: 0; padding: 8px 4px; text-align: right; border-bottom: 1px solid var(--loot-line); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.loot-compare-table th:first-child { width: 38%; text-align: left; font-weight: 400; }
.loot-compare-table thead { color: var(--loot-dim); }
.loot-compare-better .loot-compare-delta { color: var(--loot-good); }
.loot-compare-worse .loot-compare-delta { color: var(--loot-bad); }
.loot-compare-same .loot-compare-delta { color: var(--loot-dim); }
.loot-compare-notices { padding-left: 20px; font-size: .85em; }
.loot-compare-button { min-height: 44px; min-width: 44px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--loot-line); background: var(--loot-raised); color: var(--loot-fg); font: inherit; border-radius: var(--th-r, 0); cursor: pointer; overflow-wrap: anywhere; }
.loot-compare-button:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-compare-button:disabled { opacity: .55; cursor: default; }
.loot-compare-toggle { margin-top: 8px; width: 100%; }
@container (max-width: 359px) {
  .loot-compare-table thead { display: none; }
  .loot-compare-table tbody, .loot-compare-row { display: block; }
  .loot-compare-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 8px; }
  .loot-compare-table .loot-compare-row th { grid-column: 1 / -1; width: auto; }
  .loot-compare-row td::before { display: block; content: attr(data-label); color: var(--loot-dim); font-size: .85em; }
}
@container (min-width: 360px) and (max-width: 639px) { .loot-compare-columns { gap: 24px; } }
@container (min-width: 640px) { .loot-compare-columns { grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); } }

</style>
