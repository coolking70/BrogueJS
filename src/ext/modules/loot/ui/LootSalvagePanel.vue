<script setup lang="ts">
import { computed, useId } from 'vue';
import { useTranslation } from 'i18next-vue';
import LootItemChip from './LootItemChip.vue';
import type { LootSalvageView } from './types';
const props = withDefaults(defineProps<{ view: LootSalvageView; submitting?: boolean }>(), { submitting: false });
const emit = defineEmits<{ confirm: [keys: string[]]; cancel: [] }>();
const { t } = useTranslation();
const titleId = useId();
const keys = computed(() => props.view.entries.filter(entry => !entry.blocked).map(entry => entry.key));
const range = (value: { readonly min: number; readonly max: number }) => value.min === value.max ? String(value.min) : `${value.min}–${value.max}`;
function confirm() { if (props.view.confirmable && !props.submitting) emit('confirm', [...keys.value]); }
function cancel() { emit('cancel'); }
function keydown(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } }
</script>
<template>
  <section class="loot-salvage" role="dialog" :aria-labelledby="titleId" :aria-busy="submitting" @keydown="keydown">
    <h2 :id="titleId" class="loot-salvage-title">{{ t('ext.loot.ui.salvage.title') }}</h2>
    <ul class="loot-salvage-entries"><li v-for="entry in view.entries" :key="entry.key" class="loot-salvage-entry" :class="{ 'loot-salvage-blocked': entry.blocked !== null }" :data-entry="entry.key">
      <div class="loot-salvage-item"><LootItemChip :view="entry.chip" /><span class="loot-salvage-yield">{{ t('ext.loot.ui.salvage.yield', { amount: range(entry.shards) }) }}</span></div>
      <p v-if="entry.blocked" class="loot-salvage-reason">{{ t(entry.blocked.nameKey, entry.blocked.params) }}</p>
      <p v-for="(warning, index) in entry.warnings" :key="index" class="loot-salvage-warning">{{ t(warning.nameKey, warning.params) }}</p>
    </li></ul>
    <p class="loot-salvage-total">{{ t('ext.loot.ui.salvage.total', { amount: range(view.total) }) }}</p>
    <p class="loot-salvage-exchange">{{ t(view.exchange.nameKey, view.exchange.params) }}</p>
    <div class="loot-salvage-actions"><button class="loot-salvage-button" type="button" data-action="confirm" :disabled="!view.confirmable || submitting" @click="confirm">{{ submitting ? t('ext.loot.ui.salvage.submitting') : t('ext.loot.ui.salvage.confirm', { count: keys.length, amount: range(view.total) }) }}</button><button class="loot-salvage-button" type="button" data-action="cancel" @click="cancel">{{ t('ext.loot.ui.salvage.cancel') }}</button></div>
  </section>
</template>
<style>
.loot-salvage {
  --loot-bg: var(--th-panel, #0d0d0c); --loot-raised: var(--th-raised, #181815);
  --loot-fg: var(--th-fg, #e4dfd1); --loot-dim: var(--th-dim, #9e998d);
  --loot-line: var(--th-line, #34322c); --loot-good: var(--th-ok, #8fbf6a);
  --loot-bad: var(--th-hp, #d9503f); --loot-focus: var(--th-accent, #e4dfd1);
  box-sizing: border-box; min-width: 0; max-width: 100%; container-type: inline-size;
  color: var(--loot-fg); background: var(--loot-bg); font-family: var(--th-font, monospace);
  border-radius: var(--th-r, 0); overflow-wrap: anywhere; line-height: 1.5;
}
.loot-salvage:is([data-loot-theme="light"], [data-loot-theme="light"] *) {
  --loot-bg: #f4f1e8; --loot-raised: #ebe6d8; --loot-fg: #1f1d18; --loot-dim: #5d584c;
  --loot-line: #b9b2a0; --loot-good: #2f6b1f; --loot-bad: #a3271b; --loot-focus: #1f1d18;
}
.loot-salvage { padding: 12px; border: 1px solid var(--loot-line); }
.loot-salvage-title { font-size: 1.1rem; margin: 0 0 16px; }
.loot-salvage-entries { padding: 0; margin: 0; list-style: none; }
.loot-salvage-entry { padding: 12px 0; border-bottom: 1px solid var(--loot-line); }
.loot-salvage-item { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.loot-salvage-yield { font-variant-numeric: tabular-nums; }
.loot-salvage-reason { color: var(--loot-bad); }
.loot-salvage-warning, .loot-salvage-exchange { color: var(--loot-dim); font-size: .85em; }
.loot-salvage-total { font-weight: 600; }
.loot-salvage-actions { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.loot-salvage-button { min-height: 44px; min-width: 44px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--loot-line); background: var(--loot-raised); color: var(--loot-fg); font: inherit; border-radius: var(--th-r, 0); cursor: pointer; overflow-wrap: anywhere; }
.loot-salvage-button:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-salvage-button:disabled { opacity: .55; cursor: default; }
@container (min-width: 360px) and (max-width: 639px) { .loot-salvage-actions { grid-template-columns: minmax(0, 1fr) auto; } }
@container (min-width: 640px) { .loot-salvage-item { grid-template-columns: minmax(0, 1fr) auto; } .loot-salvage-actions { display: flex; flex-wrap: wrap; } }

</style>
