<script setup lang="ts">
import { computed, nextTick, ref, useId, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import rarities from '../data/rarities.json';
import { normalizeLootPickupFilter } from './viewModel';
import type { LootPickupFilterDraft, LootTextRef } from './types';
import type { ItemClass } from '../types';
const props = withDefaults(defineProps<{ value: LootPickupFilterDraft; defaults: LootPickupFilterDraft; presetName: LootTextRef; readOnly?: boolean; submitting?: boolean; initialDraft?: LootPickupFilterDraft }>(), { readOnly: false, submitting: false });
const emit = defineEmits<{ submit: [draft: LootPickupFilterDraft]; cancel: [] }>();
const { t } = useTranslation();
const titleId = useId();
const root = ref<HTMLFormElement | null>(null);
const clone = (value: LootPickupFilterDraft): LootPickupFilterDraft => ({ ...value, classes: [...value.classes] });
const draft = ref(clone(props.initialDraft ?? props.value));
watch(() => props.value, value => { draft.value = clone(value); }, { deep: true });
const disabled = computed(() => props.readOnly || props.submitting);
const dirty = computed(() => JSON.stringify(normalizeLootPickupFilter(draft.value)) !== JSON.stringify(normalizeLootPickupFilter(props.value)));
const rarityOptions = rarities.rarities.filter(value => ['normal', 'magic', 'rare', 'unique'].includes(value.id));
const classOptions: readonly ItemClass[] = ['weapon', 'armor', 'ring'];
function classLabel(id: ItemClass) { return t(id === 'weapon' ? 'ext.loot.ui.filter.weapon' : id === 'armor' ? 'ext.loot.ui.filter.armor' : 'ext.loot.ui.filter.ring'); }
function chooseRarity(id: string) { if (!disabled.value) draft.value = { ...draft.value, minRarity: id as LootPickupFilterDraft['minRarity'] }; }
function toggleClass(id: ItemClass) { if (!disabled.value) draft.value = { ...draft.value, classes: draft.value.classes.includes(id) ? draft.value.classes.filter(value => value !== id) : [...draft.value.classes, id] }; }
function toggleGold() { if (!disabled.value) draft.value = { ...draft.value, autoPickupGold: !draft.value.autoPickupGold }; }
function reset() { if (!disabled.value) draft.value = clone(props.defaults); }
function submit() { if (!disabled.value && dirty.value) emit('submit', normalizeLootPickupFilter(draft.value)); }
function cancel() { emit('cancel'); }
function keydown(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } }
function rarityKeydown(event: KeyboardEvent) {
  if (disabled.value) return;
  let index = rarityOptions.findIndex(value => value.id === draft.value.minRarity);
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') index = (index + rarityOptions.length - 1) % rarityOptions.length;
  else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') index = (index + 1) % rarityOptions.length;
  else if (event.key === 'Home') index = 0;
  else if (event.key === 'End') index = rarityOptions.length - 1;
  else if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault(); event.stopPropagation();
  const option = rarityOptions[index];
  if (option) { chooseRarity(option.id); void nextTick(() => root.value?.querySelector?.<HTMLButtonElement>(`[data-rarity="${option.id}"]`)?.focus()); }
}
</script>
<template>
  <form ref="root" class="loot-filter" role="dialog" :aria-labelledby="titleId" :aria-busy="submitting" @submit.prevent="submit" @keydown="keydown">
    <h2 :id="titleId" class="loot-filter-title">{{ t('ext.loot.ui.filter.title') }}</h2>
    <p class="loot-filter-preset">{{ t('ext.loot.ui.filter.preset', { name: t(presetName.nameKey, presetName.params) }) }}</p>
    <p v-if="readOnly" class="loot-filter-notice">{{ t('ext.loot.ui.filter.read-only') }}</p>
    <fieldset class="loot-filter-fieldset" :disabled="disabled"><legend>{{ t('ext.loot.ui.filter.minimum') }}</legend>
      <div class="loot-filter-rarities" role="radiogroup" :aria-label="t('ext.loot.ui.filter.minimum')" @keydown="rarityKeydown"><button v-for="option in rarityOptions" :key="option.id" class="loot-filter-radio" type="button" role="radio" :aria-checked="draft.minRarity === option.id" :tabindex="draft.minRarity === option.id ? 0 : -1" :disabled="disabled" :data-rarity="option.id" :style="{ '--loot-rarity-dark': option.colorDark, '--loot-rarity-light': option.colorLight }" @click="chooseRarity(option.id)"><span aria-hidden="true">{{ option.marker }}</span> {{ t(option.nameKey) }}</button></div>
    </fieldset>
    <fieldset class="loot-filter-fieldset" :disabled="disabled"><legend>{{ t('ext.loot.ui.filter.classes') }}</legend><div class="loot-filter-classes"><button v-for="option in classOptions" :key="option" class="loot-filter-check" type="button" role="checkbox" :aria-checked="draft.classes.includes(option)" :disabled="disabled" :data-class="option" @click="toggleClass(option)"><span aria-hidden="true">{{ draft.classes.includes(option) ? '☑' : '☐' }}</span> {{ classLabel(option) }}</button></div></fieldset>
    <button class="loot-filter-check loot-filter-gold" type="button" role="switch" :aria-checked="draft.autoPickupGold" :disabled="disabled" data-action="gold" @click="toggleGold"><span aria-hidden="true">{{ draft.autoPickupGold ? '☑' : '☐' }}</span> {{ t('ext.loot.ui.filter.auto-gold') }}</button>
    <div class="loot-filter-actions"><button class="loot-filter-button" type="button" :disabled="disabled" data-action="reset" @click="reset">{{ t('ext.loot.ui.filter.reset') }}</button><button class="loot-filter-button" type="submit" :disabled="disabled || !dirty" data-action="submit">{{ submitting ? t('ext.loot.ui.filter.submitting') : t('ext.loot.ui.filter.submit') }}</button><button class="loot-filter-button" type="button" :disabled="disabled" data-action="cancel" @click="cancel">{{ t('ext.loot.ui.filter.cancel') }}</button></div>
  </form>
</template>
<style>
.loot-filter {
  --loot-bg: var(--th-panel, #0d0d0c); --loot-raised: var(--th-raised, #181815);
  --loot-fg: var(--th-fg, #e4dfd1); --loot-dim: var(--th-dim, #9e998d);
  --loot-line: var(--th-line, #34322c); --loot-good: var(--th-ok, #8fbf6a);
  --loot-bad: var(--th-hp, #d9503f); --loot-focus: var(--th-accent, #e4dfd1);
  box-sizing: border-box; min-width: 0; max-width: 100%; container-type: inline-size;
  color: var(--loot-fg); background: var(--loot-bg); font-family: var(--th-font, monospace);
  border-radius: var(--th-r, 0); overflow-wrap: anywhere; line-height: 1.5;
}
.loot-filter:is([data-loot-theme="light"], [data-loot-theme="light"] *) {
  --loot-bg: #f4f1e8; --loot-raised: #ebe6d8; --loot-fg: #1f1d18; --loot-dim: #5d584c;
  --loot-line: #b9b2a0; --loot-good: #2f6b1f; --loot-bad: #a3271b; --loot-focus: #1f1d18;
}
.loot-filter { padding: 12px; border: 1px solid var(--loot-line); }
.loot-filter-title { font-size: 1.1rem; margin: 0 0 8px; }
.loot-filter-preset, .loot-filter-notice { color: var(--loot-dim); font-size: .85em; }
.loot-filter-fieldset { border: 0; min-width: 0; padding: 0; margin: 16px 0; }
.loot-filter-fieldset legend { padding: 0 0 8px; }
.loot-filter-rarities, .loot-filter-classes, .loot-filter-actions { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.loot-filter-radio { min-height: 44px; min-width: 44px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--loot-line); background: var(--loot-raised); color: var(--loot-fg); font: inherit; border-radius: var(--th-r, 0); cursor: pointer; overflow-wrap: anywhere; }
.loot-filter-radio:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-filter-radio:disabled { opacity: .55; cursor: default; }
.loot-filter-check { min-height: 44px; min-width: 44px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--loot-line); background: var(--loot-raised); color: var(--loot-fg); font: inherit; border-radius: var(--th-r, 0); cursor: pointer; overflow-wrap: anywhere; }
.loot-filter-check:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-filter-check:disabled { opacity: .55; cursor: default; }
.loot-filter-button { min-height: 44px; min-width: 44px; box-sizing: border-box; padding: 8px 12px; border: 1px solid var(--loot-line); background: var(--loot-raised); color: var(--loot-fg); font: inherit; border-radius: var(--th-r, 0); cursor: pointer; overflow-wrap: anywhere; }
.loot-filter-button:focus-visible { outline: 2px solid var(--loot-focus); outline-offset: 2px; }
.loot-filter-button:disabled { opacity: .55; cursor: default; }
.loot-filter-radio { color: var(--loot-rarity-dark); text-align: left; font-weight: 600; }
.loot-filter:is([data-loot-theme="light"], [data-loot-theme="light"] *) .loot-filter-radio { color: var(--loot-rarity-light); }
.loot-filter-radio[aria-checked="true"], .loot-filter-check[aria-checked="true"] { border-color: var(--loot-focus); box-shadow: inset 0 0 0 1px var(--loot-focus); }
.loot-filter-gold { text-align: left; width: 100%; margin-bottom: 16px; }
@container (min-width: 360px) and (max-width: 639px) { .loot-filter-rarities { grid-template-columns: repeat(2, minmax(0, 1fr)); } .loot-filter-classes { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@container (min-width: 640px) { .loot-filter-rarities { grid-template-columns: repeat(4, minmax(0, 1fr)); } .loot-filter-classes, .loot-filter-actions { grid-template-columns: repeat(3, minmax(0, 1fr)); } }

</style>
