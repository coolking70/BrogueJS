<script setup lang="ts">
import i18next from 'i18next';
const props = defineProps<{ blocked: boolean; presentationHidden?: boolean }>();
const emit = defineEmits<{ open: [] }>();
function open(event: MouseEvent) { if (!props.blocked && !props.presentationHidden && event.detail <= 1) emit('open'); }
</script>
<template>
  <div class="foraging-entry" :class="{ 'presentation-hidden': presentationHidden }" :inert="presentationHidden || undefined" :aria-hidden="presentationHidden || undefined">
    <button :disabled="blocked || presentationHidden" data-action="foraging-open" @click="open">{{ i18next.t('ext.foraging.ui.open') }}</button>
  </div>
</template>
<style scoped>
.foraging-entry{display:flex;justify-content:flex-end;min-width:0;padding:3px 8px;background:var(--th-panel,#171918);border-top:1px solid var(--th-line,#555)}.foraging-entry button{min-width:72px;min-height:44px;padding:6px 12px;border:1px solid var(--th-line,#555);color:var(--th-fg,#e4dfd1);background:transparent;font:13px var(--th-font,monospace);touch-action:manipulation;cursor:pointer}.foraging-entry button:disabled{opacity:.42;cursor:default}.presentation-hidden{visibility:hidden;pointer-events:none}
</style>
