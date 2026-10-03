<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import GrowthCreationPanel from './GrowthCreationPanel.vue';
import { loadGrowthCreationContext, createGrowthCreationDraft, selectGrowthCreationIdentity, adjustGrowthCreationChoice, readGrowthCreationView, buildGrowthCreationCommands } from '../view';
import type { GrowthIdentity } from '../types';
const props = defineProps<{ submitting: boolean; error: string | null }>();
const emit = defineEmits<{ cancel: []; complete: [commands: readonly string[]] }>();
const context = loadGrowthCreationContext();
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
  if (commands) emit('complete', commands);
}
</script>
<template>
  <GrowthCreationPanel :model="model" :submitting="submitting" :error="error" @cancel="emit('cancel')" @select="selectIdentity" @adjust="adjustIdentityChoice" @submit="submit" />
</template>
