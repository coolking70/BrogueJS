<script setup lang="ts">
import { computed, shallowRef, ref } from 'vue';
import GrowthCreationPanel from './GrowthCreationPanel.vue';
import { loadGrowthCreationContext, createGrowthCreationDraft, selectGrowthCreationIdentity, adjustGrowthCreationChoice, readGrowthCreationView, buildGrowthCreationCommands } from '../view';
import type { GrowthIdentity } from '../types';
const props = defineProps<{ submitting: boolean; error: string | null; roster?: readonly number[]; definitions?: import('../../../types').ReadonlyJson }>();
const emit = defineEmits<{ cancel: []; complete: [commands: readonly string[]] }>();
const context = props.definitions ? {pack:props.definitions as unknown as import('../attributes').GrowthPack,otherInitialCommands:[]} : loadGrowthCreationContext();
const slot=ref(0),completed:import('../../../types').Json[]=[];
const draft = shallowRef(createGrowthCreationDraft(context.pack));
const model = computed(() => readGrowthCreationView(context.pack, draft.value));
const error = computed(() => props.error === 'ext.creation.start_failed' ? 'ext.growth.creation.start_failed' : props.error);
function selectIdentity(kind: GrowthIdentity['kind'], id: string) {
  if (!props.submitting) draft.value = selectGrowthCreationIdentity(context.pack, draft.value, kind, id);
}
function adjustIdentityChoice(identityId: string, choiceIndex: number, attributeId: string, delta: number) {
  if (!props.submitting) draft.value = adjustGrowthCreationChoice(context.pack, draft.value, identityId, choiceIndex, attributeId, delta);
}
function submit() {
  if (props.submitting || !model.value.valid) return;
  const commands = buildGrowthCreationCommands(context, draft.value);
  if(!commands)return;
  if(!props.roster){emit('complete',commands);return;}
  completed[slot.value]=JSON.parse(commands[0]!).payload;
  if(slot.value+1<props.roster.length){slot.value++;draft.value=createGrowthCreationDraft(context.pack);return;}
  emit('complete',[JSON.stringify({module:'growth',action:'create-party',payload:{schema:1,members:props.roster.map((stableSlot,index)=>({slot:stableSlot,creation:completed[index]}))}})]);
}
</script>
<template>
  <GrowthCreationPanel :key="slot" :member-number="roster ? slot+1 : undefined" :model="model" :submitting="submitting" :error="error" @cancel="emit('cancel')" @select="selectIdentity" @adjust="adjustIdentityChoice" @submit="submit" />
</template>
