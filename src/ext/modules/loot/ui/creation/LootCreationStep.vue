<script setup lang="ts">
import { ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import LootPresetPicker from '../LootPresetPicker.vue';
import { loadLootPack } from '../../definitions';
import { buildLootPresetOptions } from '../viewModel';
const props=defineProps<{submitting:boolean;error:string|null}>();
const emit=defineEmits<{complete:[commands:readonly string[]];cancel:[]}>();
const {t}=useTranslation();
const preset=ref('standard');
const options=buildLootPresetOptions(loadLootPack());
function confirm(presetId:string){if(!props.submitting)emit('complete',[JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId}})]);}
</script>
<template><div class="loot-creation"><p v-if="error" role="alert">{{ t(error === 'ext.creation.start_failed' ? 'ext.creation.start_failed' : 'ext.creation.unavailable') }}</p><LootPresetPicker v-model="preset" :options="options" :disabled="submitting" @confirm="confirm" @keydown.esc.stop="emit('cancel')" /></div></template>
