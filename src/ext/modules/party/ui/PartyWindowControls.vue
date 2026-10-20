<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { WindowLength } from '../../../partyWindow';
defineProps<{ disabled: boolean; advance: (length: WindowLength, automatic: boolean) => void; rehearse: (length: WindowLength, automatic: boolean) => void }>();
const { t } = useTranslation();
const length = ref('100');
const selected = (): WindowLength => length.value === 'fine' ? { kind: 'fine' } : { kind: 'ticks', ticks: length.value === 'auto' ? 100 : Number(length.value) as 100 | 300 | 1000 };
</script>
<template><div class="window-controls">
<select v-model="length" :disabled="disabled" :aria-label="t('ext.party.window.length')">
<option value="fine">{{t('ext.party.window.fine')}}</option><option value="100">100</option><option value="300">300</option><option value="1000">1000</option><option value="auto">{{t('ext.party.window.auto')}}</option>
</select><button data-party-advance :disabled="disabled" @click="advance(selected(),length==='auto')">{{t('ext.party.window.advance')}}</button><button data-party-preview :disabled="disabled" @click="rehearse(selected(),length==='auto')">{{t('ext.party.window.preview')}}</button>
</div></template>
<style scoped>.window-controls{display:flex;flex-wrap:nowrap;gap:4px;min-width:0}.window-controls>*{min-width:0;min-height:44px;font:inherit;color:inherit;background:#232923;border:1px solid #777;padding:4px}.window-controls button:disabled{opacity:.45}</style>
