<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { partyFailureText } from './feedback';
const props = defineProps<{
  settlementAvailable: boolean;
  candidates: {id:number;name:string;source:'rescue'|'narrative'|'resident';reason:string|null}[];
  camps: {id:number;name:string}[];
  focused: number;
  stationReason: string | null;
  join: (id:number)=>void;
  station: (campId:number)=>void;
}>();
const { t } = useTranslation();
const camp = ref(0);
watch(() => [props.focused,props.camps.map(c=>c.id).join(',')],()=>{camp.value=props.camps[0]?.id??0;},{immediate:true});
</script>
<template><details class="party-roster" data-party-roster><summary>{{t('ext.party.roster.title')}}</summary>
<p>{{t('ext.party.roster.hint')}}</p>
<p v-if="!candidates.length">{{t('ext.party.roster.none')}}</p>
<div v-for="candidate in candidates" :key="candidate.id" class="candidate" :data-party-candidate="candidate.id"><span>{{candidate.name}} · {{t('ext.party.roster.source.'+candidate.source)}}</span><button :disabled="!!candidate.reason" @click="join(candidate.id)">{{t('ext.party.roster.join')}}</button><small v-if="candidate.reason">{{partyFailureText(candidate.reason)}}</small></div>
<fieldset v-if="settlementAvailable"><legend>{{t('ext.party.roster.station',{id:focused})}}</legend><p>{{t('ext.party.roster.residentHint')}}</p><select v-model.number="camp" :aria-label="t('ext.party.roster.campLabel')"><option :value="0">{{t('ext.party.roster.selectCamp')}}</option><option v-for="entry in camps" :key="entry.id" :value="entry.id">{{entry.name}}</option></select><button :disabled="!camp||!!stationReason" @click="station(camp)">{{t('ext.party.roster.stationAction')}}</button><small v-if="stationReason">{{partyFailureText(stationReason)}}</small><small v-else-if="!camps.length">{{t('ext.party.roster.noCamp')}}</small></fieldset>
</details></template>
<style scoped>.party-roster{max-width:100%;overflow-wrap:anywhere}.candidate{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:8px 0}.candidate>span{flex:1}.party-roster small{display:block;flex-basis:100%}.party-roster button,.party-roster select{font:inherit;min-height:44px;max-width:100%;color:inherit;background:#232923;border:1px solid #777;padding:4px}.party-roster fieldset{min-width:0}.party-roster button:disabled{opacity:.45}</style>
