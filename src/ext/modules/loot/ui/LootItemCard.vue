<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import LootItemChip from './LootItemChip.vue';
import LootAffixRow from './LootAffixRow.vue';
import type { LootItemView } from './types';
type Action = 'compare' | 'salvage' | 'close';
const props = withDefaults(defineProps<{ view: LootItemView; maxRows?: number; actions?: readonly Action[]; initiallyExpanded?: boolean }>(), { maxRows: 8, actions: () => [], initiallyExpanded: false });
const emit = defineEmits<{ action: [id: Action] }>();
const { t } = useTranslation();
const titleId = useId();
const expanded = ref(props.initiallyExpanded);
watch(() => props.view, () => { expanded.value = false; });
const limit = computed(() => Math.max(0, Math.floor(props.maxRows)));
const visibleRows = computed(() => expanded.value ? props.view.rows : props.view.rows.slice(0, limit.value));
function actionText(action: Action) { return t(action === 'compare' ? 'ext.loot.ui.card.compare' : action === 'salvage' ? 'ext.loot.ui.card.salvage' : 'ext.loot.ui.card.close'); }
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.actions.includes('close')) { event.preventDefault(); event.stopPropagation(); emit('action', 'close'); }
}
</script>
<template>
  <section class="loot-item-card" role="dialog" :aria-labelledby="titleId" @keydown="keydown">
    <h2 :id="titleId" class="loot-card-title"><LootItemChip :view="view.chip" /></h2>
    <div class="loot-card-subtitle"><span v-for="(item, index) in view.subtitle" :key="index">{{ t(item.nameKey, item.params) }}</span></div>
    <dl class="loot-card-base-stats"><div v-for="stat in view.baseStats" :key="stat.key" class="loot-card-base-stat"><dt>{{ t(stat.label.nameKey, stat.label.params) }}</dt><dd>{{ stat.value }}<span v-if="stat.partial" class="loot-card-partial" :aria-label="t('ext.loot.ui.card.partial')"> ?</span></dd></div></dl>
    <ul class="loot-card-affixes"><LootAffixRow v-for="row in visibleRows" :key="row.key" :row="row" /></ul>
    <button v-if="view.rows.length > limit" type="button" class="loot-card-button loot-card-toggle" :aria-expanded="expanded" data-action="toggle-rows" @click="expanded = !expanded">{{ expanded ? t('ext.loot.ui.card.less') : t('ext.loot.ui.card.more', { count: view.rows.length - limit }) }}</button>
    <ul v-if="view.notices.length" class="loot-card-notices"><li v-for="(notice, index) in view.notices" :key="index">{{ t(notice.nameKey, notice.params) }}</li></ul>
    <p v-if="view.flavor" class="loot-card-flavor">{{ t(view.flavor.nameKey, view.flavor.params) }}</p>
    <div v-if="actions.length" class="loot-card-actions"><button v-for="action in actions" :key="action" class="loot-card-button" type="button" :data-action="action" @click="emit('action', action)">{{ actionText(action) }}</button></div>
  </section>
</template>
<style>
.loot-item-card {
  --loot-bg: var(--th-panel, #0d0d0c); --loot-raised: var(--th-raised, #181815);
  --loot-fg: var(--th-fg, #e4dfd1); --loot-dim: var(--th-dim, #9e998d);
  --loot-line: var(--th-line, #34322c); --loot-good: var(--th-ok, #8fbf6a);
  --loot-bad: var(--th-hp, #d9503f); --loot-focus: var(--th-accent, #e4dfd1);
  box-sizing: border-box; min-width: 0; max-width: 100%; container-type: inline-size;
  color: var(--loot-fg); background: var(--loot-bg); font-family: var(--th-font, monospace);
  border-radius: var(--th-r, 0); overflow-wrap: anywhere; line-height: 1.5;
}
.loot-item-card:is([data-loot-theme="light"], [data-loot-theme="light"] *) {
  --loot-bg: #f4f1e8; --loot-raised: #ebe6d8; --loot-fg: #1f1d18; --loot-dim: #5d584c;
  --loot-line: #b9b2a0; --loot-good: #2f6b1f; --loot-bad: #a3271b; --loot-focus: #1f1d18;
}
.loot-item-card { padding: 12px; border: 1px solid var(--loot-line); }
.loot-card-title { margin: 0 0 8px; font-size: 1.1rem; }
.loot-card-subtitle { display: flex; flex-wrap: wrap; gap: 6px 12px; color: var(--loot-dim); font-size: .85em; }
.loot-card-base-stats { margin: 16px 0 8px; display: grid; gap: 8px; }
.loot-card-base-stat { min-width: 0; display: flex; justify-content: space-between; gap: 12px; }
.loot-card-base-stat dd { margin: 0; font-variant-numeric: tabular-nums; text-align: right; }
.loot-card-partial, .loot-card-notices { color: var(--loot-dim); }
.loot-card-affixes { padding: 0; margin: 0; }
.loot-card-notices { padding-left: 20px; font-size: .85em; }
.loot-card-flavor { font-style: italic; border-left: 2px solid var(--loot-line); padding-left: 12px; }
.loot-card-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.loot-card-button { min-height: 44px; min-width: 44px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--loot-line); background: var(--loot-raised); color: var(--loot-fg); font: inherit; border-radius: var(--th-r, 0); cursor: pointer; overflow-wrap: anywhere; }
.loot-card-button:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-card-button:disabled { opacity: .55; cursor: default; }
.loot-card-toggle { width: 100%; margin-top: 8px; }
@container (max-width: 359px) { .loot-card-actions { display: grid; grid-template-columns: minmax(0, 1fr); } }
@container (min-width: 360px) and (max-width: 639px) { .loot-card-base-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (min-width: 640px) { .loot-card-base-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

</style>
