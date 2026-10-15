<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { LootChipView, LootTextRef } from './types';
const props = withDefaults(defineProps<{ view: LootChipView; interactive?: boolean; selected?: boolean; compact?: boolean }>(), { interactive: false, selected: false, compact: false });
const emit = defineEmits<{ activate: [] }>();
const { t } = useTranslation();
const part = (ref: LootTextRef | null) => ref ? t(ref.nameKey, ref.params) : '';
const name = computed(() => {
  const parts = props.view.name.parts;
  return t(props.view.name.nameKey, { base: part(parts.base), prefix: part(parts.prefix), suffix: part(parts.suffix), first: part(parts.first), second: part(parts.second), unique: part(parts.unique), interpolation: { escapeValue: false } });
});
const rarityStyle = computed(() => ({ '--loot-rarity-dark': props.view.rarity.colorDark, '--loot-rarity-light': props.view.rarity.colorLight }));
function activate() { if (props.interactive) emit('activate'); }
function keydown(event: KeyboardEvent) {
  if (props.interactive && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); event.stopPropagation(); activate(); }
}
</script>
<template>
  <component :is="interactive ? 'button' : 'span'" class="loot-item-chip" :class="{ 'loot-item-chip-interactive': interactive, 'loot-item-chip-selected': selected, 'loot-item-chip-compact': compact, 'loot-item-chip-unknown': view.rarity.id === null }" :type="interactive ? 'button' : undefined" :aria-pressed="interactive ? selected : undefined" :style="rarityStyle" @click="activate" @keydown="keydown">
    <span class="loot-chip-glyph" aria-hidden="true">{{ view.glyph }}</span>
    <span class="loot-chip-marker" aria-hidden="true">{{ view.rarity.marker }}</span>
    <span class="loot-chip-name">{{ name }}<span v-if="view.name.enhancement > 0">{{ t('ext.loot.ui.name.enhancement', { level: view.name.enhancement }) }}</span></span>
    <span v-if="!compact && view.rarity.label" class="loot-chip-rarity">{{ t(view.rarity.label.nameKey, view.rarity.label.params) }}</span>
    <span v-if="!compact && view.corrupted === true" class="loot-chip-corrupted" :aria-label="t('ext.loot.ui.chip.corrupted')">†</span>
    <span v-if="!compact && view.unknownCount > 0" class="loot-chip-unknown-badge" :aria-label="t('ext.loot.ui.chip.unknown-count', { count: view.unknownCount })">?×{{ view.unknownCount }}</span>
    <span v-if="!compact && view.countHidden" class="loot-chip-unknown-badge" :aria-label="t('ext.loot.ui.chip.count-hidden')">?</span>
  </component>
</template>
<style>
.loot-item-chip {
  --loot-bg: var(--th-panel, #0d0d0c); --loot-raised: var(--th-raised, #181815);
  --loot-fg: var(--th-fg, #e4dfd1); --loot-dim: var(--th-dim, #9e998d);
  --loot-line: var(--th-line, #34322c); --loot-good: var(--th-ok, #8fbf6a);
  --loot-bad: var(--th-hp, #d9503f); --loot-focus: var(--th-accent, #e4dfd1);
  box-sizing: border-box; min-width: 0; max-width: 100%; container-type: inline-size;
  color: var(--loot-fg); background: var(--loot-bg); font-family: var(--th-font, monospace);
  border-radius: var(--th-r, 0); overflow-wrap: anywhere; line-height: 1.5;
}
.loot-item-chip:is([data-loot-theme="light"], [data-loot-theme="light"] *) {
  --loot-bg: #f4f1e8; --loot-raised: #ebe6d8; --loot-fg: #1f1d18; --loot-dim: #5d584c;
  --loot-line: #b9b2a0; --loot-good: #2f6b1f; --loot-bad: #a3271b; --loot-focus: #1f1d18;
}
.loot-item-chip { width: 100%; display: inline-flex; align-items: baseline; flex-wrap: wrap; gap: 4px 7px; text-align: left; vertical-align: middle; }
.loot-chip-glyph, .loot-chip-marker, .loot-chip-name, .loot-chip-rarity { color: var(--loot-rarity-dark); }
.loot-item-chip:is([data-loot-theme="light"], [data-loot-theme="light"] *) .loot-chip-glyph, .loot-item-chip:is([data-loot-theme="light"], [data-loot-theme="light"] *) .loot-chip-marker, .loot-item-chip:is([data-loot-theme="light"], [data-loot-theme="light"] *) .loot-chip-name, .loot-item-chip:is([data-loot-theme="light"], [data-loot-theme="light"] *) .loot-chip-rarity { color: var(--loot-rarity-light); }
.loot-item-chip-unknown .loot-chip-glyph, .loot-item-chip-unknown .loot-chip-marker, .loot-item-chip-unknown .loot-chip-name { color: var(--loot-dim); }
.loot-chip-name { min-width: 0; font-weight: 600; }
.loot-chip-rarity { font-size: .8em; }
.loot-chip-corrupted { color: var(--loot-bad); font-weight: 600; }
.loot-chip-unknown-badge { color: var(--loot-dim); font-size: .85em; white-space: nowrap; }
.loot-item-chip-interactive { min-height: 44px; min-width: 44px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--loot-line); background: var(--loot-raised); color: var(--loot-fg); font: inherit; border-radius: var(--th-r, 0); cursor: pointer; overflow-wrap: anywhere; }
.loot-item-chip-interactive:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-item-chip-interactive:disabled { opacity: .55; cursor: default; }
.loot-item-chip-selected { border-color: var(--loot-focus); box-shadow: inset 0 0 0 1px var(--loot-focus); }
@container (max-width: 359px) { .loot-chip-name { flex: 1 1 120px; } }

</style>
