<script setup lang="ts">
import type { NarrativeUiView } from './view';
const props = defineProps<{ model: NarrativeUiView; blocked: boolean; submitting: boolean; error: 'ext.narrative.ui.command_rejected' | null }>();
const emit = defineEmits<{ open: [id: number, event: MouseEvent]; choose: [id: string, event: MouseEvent]; close: [event?: MouseEvent | KeyboardEvent] }>();
const usable = (event: MouseEvent) => !props.model.readOnly && !props.submitting && event.detail <= 1;
function closeKey(event: KeyboardEvent) {
    if (event.key === 'Escape' && props.model.active && !props.model.readOnly) {
        event.preventDefault();
        if (!event.repeat && !props.submitting) emit('close', event);
    }
}
</script>
<template>
  <section class="narrative-interaction-bar" data-testid="narrative-interaction-bar"
    @pointerdown.stop @pointerup.stop @touchstart.stop @touchend.stop @click.stop @dblclick.prevent.stop @keydown.stop="closeKey" @keyup.stop>
    <span v-if="model.readOnly" class="narrative-read-only">{{ $t('ext.narrative.ui.read_only') }}</span>
    <template v-if="model.active">
      <header><strong>{{ $t(model.active.speakerNameKey) }}</strong>
        <button data-action="narrative-close" :disabled="submitting || model.readOnly" @click="usable($event) && emit('close', $event)">{{ $t('ext.narrative.ui.close') }}</button>
      </header>
      <p>{{ $t(model.active.textKey) }}</p>
      <div class="narrative-choices">
        <button v-for="choice in model.active.choices" :key="`${model.active.sessionId}:${model.active.nodeId}:${choice.id}`"
          :data-narrative-choice="choice.id" :disabled="!choice.enabled || submitting || model.readOnly"
          :title="!choice.enabled && choice.unavailableKey ? $t(choice.unavailableKey) : undefined"
          @click="usable($event) && emit('choose', choice.id, $event)">{{ $t(choice.textKey) }}<small v-if="!choice.enabled && choice.unavailableKey">{{ $t(choice.unavailableKey) }}</small></button>
      </div>
    </template>
    <div v-else class="narrative-nearby">
      <strong>{{ $t('ext.narrative.ui.nearby') }}</strong>
      <button v-for="target in model.nearby" :key="target.targetEntityId" :data-narrative-target="target.targetEntityId"
        :disabled="blocked || submitting || model.readOnly" :title="$t(target.descriptionKey)"
        @click="usable($event) && emit('open', target.targetEntityId, $event)"><span :style="{ color: target.color }">{{ target.glyph }}</span> {{ $t(target.nameKey) }} · {{ $t('ext.narrative.ui.open') }}</button>
    </div>
    <p v-if="error" class="narrative-error">{{ $t(error) }}</p>
  </section>
</template>
<style scoped>
.narrative-interaction-bar{box-sizing:border-box;max-height:28vh;overflow-y:auto;padding:6px 8px;border-top:1px solid var(--th-line,#555);background:var(--th-panel,#171918);color:var(--th-fg,#eee);font:12px var(--th-font,monospace)}
header,.narrative-nearby,.narrative-choices{display:flex;align-items:center;flex-wrap:wrap;gap:6px}header{justify-content:space-between}.narrative-interaction-bar p{margin:6px 0;line-height:1.5}.narrative-interaction-bar button{min-height:40px;padding:6px 9px;max-width:100%;border:1px solid var(--th-line,#555);background:var(--th-raised,#222);color:inherit;font:inherit;text-align:left;touch-action:manipulation;cursor:pointer}.narrative-interaction-bar button:disabled{opacity:.5;cursor:default}.narrative-interaction-bar small{display:block}.narrative-read-only{color:var(--th-dim,#aaa)}.narrative-error{color:var(--th-warning,#dba)}
@media(max-width:700px){.narrative-interaction-bar button{min-height:44px}}
</style>
