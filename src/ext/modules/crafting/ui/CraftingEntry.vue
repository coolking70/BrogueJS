<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
defineProps<{ blocked: boolean; presentationHidden?: boolean }>();
const emit = defineEmits<{ open: [] }>();
const { t } = useTranslation();
</script>
<template>
  <div class="crafting-entry" :class="{ 'presentation-hidden': presentationHidden }" :inert="presentationHidden || undefined" :aria-hidden="presentationHidden || undefined">
    <button :disabled="blocked || presentationHidden" data-action="crafting-open" @click="!presentationHidden && $event.detail <= 1 && emit('open')">{{ t('ext.crafting.ui.open') }}</button>
  </div>
</template>
<style scoped>
.crafting-entry{display:flex;justify-content:flex-end;min-width:0;padding:3px 8px;background:var(--th-panel,#171918);border-top:1px solid var(--th-line,#555)}
.crafting-entry button{min-width:72px;min-height:44px;padding:6px 12px;border:1px solid var(--th-line,#555);color:var(--th-fg,#e4dfd1);background:transparent;font:13px var(--th-font,monospace);touch-action:manipulation;cursor:pointer}.crafting-entry button:disabled{opacity:.42;cursor:default}.crafting-entry button:not(:disabled):hover{border-color:var(--th-accent,#dcc88d)}.crafting-entry span{color:var(--th-accent,#dcc88d)}.presentation-hidden{visibility:hidden;pointer-events:none}
</style>
