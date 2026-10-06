<script setup lang="ts">
import { ref } from 'vue';
import type { NarrativeUiView } from './view';
import NarrativePortrait from './NarrativePortrait.vue';
import { resolveNarrativePortrait } from './portraits';
const props = defineProps<{ model: NarrativeUiView; blocked: boolean; submitting: boolean; error: 'ext.narrative.ui.command_rejected' | null }>();
const emit = defineEmits<{ open: [id: number, event: MouseEvent] }>();
const journalOpen = ref(false);
const usable = (event: MouseEvent) => !props.model.readOnly && !props.submitting && !props.blocked && event.detail <= 1;
</script>
<template>
  <section class="narrative-interaction-bar" data-testid="narrative-interaction-bar"
    @pointerdown.stop @pointerup.stop @touchstart.stop @touchend.stop @click.stop @dblclick.prevent.stop @keydown.stop @keyup.stop>
    <template v-if="model.readOnly && model.active">
      <header><strong>{{ $t(model.active.speakerNameKey) }}</strong><span>{{ $t('ext.narrative.ui.read_only') }}</span></header>
      <div class="narrative-replay-portrait"><NarrativePortrait :portrait="resolveNarrativePortrait(model.active.portraitId)" /></div>
      <p>{{ $t(model.active.textKey) }}</p>
      <ul><li v-for="choice in model.active.choices" :key="choice.id" :data-narrative-choice="choice.id">
        {{ $t(choice.textKey) }}<small v-if="choice.unavailableKey">{{ $t(choice.unavailableKey) }}</small>
      </li></ul>
    </template>
    <div v-else-if="!model.readOnly && model.nearby.length" class="narrative-nearby">
      <strong>{{ $t('ext.narrative.ui.nearby') }}</strong>
      <button v-for="target in model.nearby" :key="target.targetEntityId" :data-narrative-target="target.targetEntityId"
        :disabled="blocked || submitting" :title="$t(target.descriptionKey)"
        @click="usable($event) && emit('open', target.targetEntityId, $event)"><span :style="{ color: target.color }">{{ target.glyph }}</span> {{ $t(target.nameKey) }} · {{ $t('ext.narrative.ui.open') }}</button>
    </div>
    <button v-if="model.journal.length" data-action="narrative-inline-journal" @click="journalOpen = !journalOpen">{{ $t('ext.narrative.ui.journal') }}</button>
    <div v-if="journalOpen" data-testid="narrative-inline-journal"><article v-for="entry in model.journal" :key="entry.entryId"><strong>{{ $t(entry.titleKey) }}</strong><p>{{ $t(entry.textKey) }}</p></article></div>
    <p v-if="error" class="narrative-error">{{ $t(error) }}</p>
  </section>
</template>
<style scoped>
.narrative-interaction-bar{box-sizing:border-box;max-height:28vh;overflow-y:auto;overscroll-behavior:contain;padding:6px 8px;border-top:1px solid var(--th-line,#555);background:var(--th-panel,#171918);color:var(--th-fg,#eee);font:12px var(--th-font,monospace);overflow-wrap:anywhere}
.narrative-replay-portrait{float:left;width:48px;height:64px;margin:6px 10px 6px 0}
header,.narrative-nearby{display:flex;align-items:center;flex-wrap:wrap;gap:6px}header{justify-content:space-between}.narrative-interaction-bar p{margin:6px 0;line-height:1.5}.narrative-interaction-bar button{min-height:44px;padding:6px 9px;max-width:100%;border:1px solid var(--th-line,#555);background:var(--th-raised,#222);color:inherit;font:inherit;text-align:left;touch-action:manipulation;cursor:pointer}.narrative-interaction-bar button:disabled{opacity:.5;cursor:default}.narrative-interaction-bar small{display:block}.narrative-error{color:var(--th-warning,#dba)}
</style>
