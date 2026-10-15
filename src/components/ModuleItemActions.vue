<script setup lang="ts">
import { computed, inject } from 'vue';
import { moduleItemActions } from '../ext/ui/itemActions';
const props = defineProps<{ itemId: number }>();
const read = inject(moduleItemActions, () => []);
const actions = computed(() => read(props.itemId));
</script>
<template><button v-for="action in actions" :key="action.id" class="module-item-action" type="button" :disabled="action.disabled" @click.stop="action.invoke">{{ action.label }}</button></template>
<style scoped>.module-item-action { min-width:44px; min-height:44px; padding:8px; color:var(--th-fg); background:var(--th-panel); border:1px solid var(--th-line); overflow-wrap:anywhere; }</style>
