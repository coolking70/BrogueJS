<script setup lang="ts">
import {ref} from 'vue';
import {useTranslation} from 'i18next-vue';
const props=defineProps<{submitting:boolean;error:string|null;definitions?:unknown}>();
const emit=defineEmits<{cancel:[];complete:[commands:readonly string[]]}>();
const {t}=useTranslation(),count=ref(2);
function submit(){if(!props.submitting)emit('complete',[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:count.value}})]);}
</script>
<template><Teleport to="body"><div class="party-create"><section role="dialog" aria-modal="true">
<h2>{{t('ext.party.creation.title')}}</h2><p>{{t('ext.party.creation.hint')}}</p>
<label>{{t('ext.party.creation.count')}} <select v-model="count" :disabled="submitting" data-party-count><option v-for="n in 4" :key="n" :value="n">{{n}}</option></select></label>
<p v-if="error" role="alert">{{t(error)}}</p><footer><button :disabled="submitting" @click="emit('cancel')">{{t('ext.creation.cancel')}}</button><button :disabled="submitting" data-party-next @click="submit">{{t('ext.party.creation.next')}}</button></footer>
</section></div></Teleport></template>
<style scoped>.party-create{position:fixed;inset:0;z-index:3000;background:#000b;display:grid;place-items:center;color:#eee}.party-create section{background:#171d18;border:1px solid #666;padding:24px;max-width:480px;width:calc(100% - 48px)}footer{display:flex;gap:12px;margin-top:24px}button,select{min-height:44px;background:#30382e;color:inherit;font:inherit;padding:8px 16px;border:1px solid #888}</style>
