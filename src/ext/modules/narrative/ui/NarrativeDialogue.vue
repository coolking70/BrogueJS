<script setup lang="ts">
import { computed } from 'vue';
import type { NarrativeUiView } from './view';
import NarrativePortrait from './NarrativePortrait.vue';
import { resolveNarrativePortrait } from './portraits';
const props = withDefaults(defineProps<{
    model: NarrativeUiView;
    page?: 'dialogue' | 'journal' | 'portrait';
    submitting?: boolean;
    error?: 'ext.narrative.ui.command_rejected' | null;
}>(), { page: 'dialogue', submitting: false, error: null });
const portrait = computed(() => resolveNarrativePortrait(props.model.active?.portraitId));
</script>
<template>
  <section class="narrative-dialogue" data-testid="narrative-dialogue" :data-narrative-page="page">
    <header class="narrative-header">
      <div class="narrative-heading">
        <h2>{{ model.active ? $t(model.active.speakerNameKey) : $t('ext.narrative.ui.dialogue_title') }}</h2>
        <span v-if="model.readOnly" class="narrative-status" data-testid="narrative-read-only">{{ $t('ext.narrative.ui.read_only') }}</span>
        <span v-else class="narrative-status">{{ $t('ext.narrative.ui.world_paused') }}</span>
      </div>
      <button v-if="model.readOnly || !model.active" type="button" data-dialog-action="view-close" data-testid="narrative-close">
        {{ $t('ext.narrative.ui.view_close') }}
      </button>
      <button v-else type="button" data-dialog-action="close" data-testid="narrative-close" :disabled="submitting">
        {{ $t('ext.narrative.ui.close') }}
      </button>
    </header>

    <!-- Keep each scroll container mounted while changing the display-only page. -->
    <div v-show="page === 'dialogue'" class="narrative-main" data-testid="narrative-dialogue-page">
      <aside class="narrative-speaker">
        <button type="button" class="narrative-portrait-button" data-dialog-action="portrait" :title="$t('ext.narrative.ui.portrait_open')">
          <NarrativePortrait :portrait="portrait" />
        </button>
        <div class="narrative-caption">
          <strong v-if="model.active">{{ $t(model.active.speakerNameKey) }}</strong>
          <span>{{ $t('ext.narrative.ui.portrait_open') }}</span>
        </div>
      </aside>
      <div class="narrative-conversation">
        <div :key="`${model.active?.sessionId}:${model.active?.nodeId}`" class="narrative-body" data-testid="narrative-body" data-dialog-scroll="body" tabindex="0">
          <p v-if="model.active">{{ $t(model.active.textKey) }}</p>
          <p v-else>{{ $t('ext.narrative.ui.no_active_dialogue') }}</p>
        </div>
        <div class="narrative-choices" data-testid="narrative-choices">
          <button v-for="(choice, index) in model.active?.choices ?? []" :key="`${model.active!.sessionId}:${model.active!.nodeId}:${choice.id}`"
            type="button" class="narrative-choice" :data-dialog-action="`choice:${choice.id}`"
            :data-narrative-choice="choice.id" data-testid="narrative-choice"
            :disabled="!choice.enabled || submitting || model.readOnly"
            :title="!choice.enabled && choice.unavailableKey ? $t(choice.unavailableKey) : undefined">
            <span v-if="index < 9" class="narrative-choice-number">{{ index + 1 }}</span>
            <span class="narrative-choice-text">{{ $t(choice.textKey) }}
              <small v-if="!choice.enabled && choice.unavailableKey">{{ $t(choice.unavailableKey) }}</small>
            </span>
          </button>
          <p v-if="model.active?.transitionLimitReached" class="narrative-warning">{{ $t('ext.narrative.error.TRANSITION_LIMIT') }}</p>
        </div>
      </div>
    </div>

    <section v-show="page === 'journal'" class="narrative-subpage narrative-journal" data-testid="narrative-journal-page">
      <h3>{{ $t('ext.narrative.ui.journal') }}</h3>
      <div class="narrative-journal-body" data-testid="narrative-journal-body" data-dialog-scroll="journal" tabindex="0">
        <article v-for="entry in model.journal" :key="entry.entryId" :data-narrative-journal="entry.entryId">
          <h4>{{ $t(entry.titleKey) }}</h4>
          <p>{{ $t(entry.textKey) }}</p>
        </article>
        <p v-if="!model.journal?.length">{{ $t('ext.narrative.ui.journal_empty') }}</p>
      </div>
    </section>

    <section v-show="page === 'portrait'" class="narrative-subpage narrative-portrait-page" data-testid="narrative-portrait-page">
      <h3>{{ $t('ext.narrative.ui.portrait_title') }}</h3>
      <div class="narrative-large-portrait"><NarrativePortrait :portrait="portrait" /></div>
      <p class="narrative-portrait-description">{{ $t(portrait.altKey) }}</p>
    </section>

    <p v-if="error" class="narrative-error" data-testid="narrative-error">{{ $t(error) }}</p>
    <footer class="narrative-footer" data-testid="narrative-footer">
      <button v-if="page === 'dialogue'" type="button" data-dialog-action="journal">{{ $t('ext.narrative.ui.journal') }}</button>
      <button v-else type="button" data-dialog-action="back">{{ $t('ext.narrative.ui.back') }}</button>
      <span v-if="!model.readOnly" class="narrative-time-policy">{{ $t('ext.narrative.ui.free_dialogue') }}</span>
      <small class="narrative-key-hint">{{ $t(model.readOnly ? 'ext.narrative.ui.read_only_hint' : 'ext.narrative.ui.keyboard_hint') }}</small>
    </footer>
  </section>
</template>
<style scoped>
.narrative-dialogue{box-sizing:border-box;display:flex;flex-direction:column;gap:14px;width:100%;max-width:920px;height:min(620px,calc(100dvh - 80px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));min-width:0;min-height:0;overflow:hidden;color:var(--text-primary,#d8c9a1);font:15px/1.55 var(--font-main,monospace)}
.narrative-header{display:flex;flex:0 0 auto;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding-bottom:12px;border-bottom:1px solid var(--border-color,#615638)}
.narrative-heading{min-width:0}.narrative-heading h2{margin:0;color:var(--color-accent,#d8b86a);font-size:1.15rem;overflow-wrap:anywhere}.narrative-status{display:block;color:var(--text-secondary,#a5a18e);font-size:12px}.narrative-header>button{flex:0 0 auto}
.narrative-main{display:grid;grid-template-columns:240px minmax(0,1fr);gap:24px;flex:1 1 auto;min-height:0;min-width:0;overflow:hidden}
.narrative-speaker{min-width:0;display:flex;flex-direction:column;align-items:center;gap:12px;overflow:hidden}.narrative-portrait-button{display:block;flex:0 1 320px;width:240px;height:320px;min-height:44px;max-height:100%;padding:0;overflow:hidden}.narrative-caption{display:flex;flex:0 0 auto;flex-direction:column;min-width:0;max-width:100%;text-align:center;overflow-wrap:anywhere}.narrative-caption>span{font-size:12px;color:var(--text-secondary,#a5a18e)}
.narrative-conversation{display:flex;flex-direction:column;gap:14px;min-width:0;min-height:0;overflow:hidden}.narrative-body{flex:1 1 auto;min-height:48px;overflow:auto;padding:0 8px 0 0}.narrative-body p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8}
.narrative-choices{display:flex;flex-direction:column;gap:8px;flex:0 1 auto;max-height:55%;min-height:44px;overflow-y:auto;padding:2px}.narrative-choice{display:flex;align-items:flex-start;gap:10px;width:100%;flex:0 0 auto;text-align:left;overflow-wrap:anywhere;white-space:normal}.narrative-choice-number{flex:0 0 18px;color:var(--color-accent,#d8b86a)}.narrative-choice-text{min-width:0}.narrative-choice-text small{display:block;color:var(--text-secondary,#a5a18e);font-size:12px}
.narrative-subpage{display:flex;flex-direction:column;flex:1 1 auto;gap:12px;min-width:0;min-height:0;overflow:hidden}.narrative-subpage h3{flex:0 0 auto;margin:0;font-size:1rem;color:var(--color-accent,#d8b86a)}.narrative-journal-body{flex:1 1 auto;min-height:0;overflow:auto}.narrative-journal article{padding:0 0 16px;margin-bottom:16px;border-bottom:1px solid var(--border-color,#615638)}.narrative-journal h4{margin:0 0 8px;font-size:1rem;overflow-wrap:anywhere}.narrative-journal p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.narrative-large-portrait{flex:1 1 auto;min-height:0;width:100%;max-width:420px;align-self:center}.narrative-portrait-description{flex:0 0 auto;margin:0;text-align:center;color:var(--text-secondary,#a5a18e);font-size:12px;overflow-wrap:anywhere}
.narrative-footer{display:flex;flex:0 0 auto;align-items:center;flex-wrap:wrap;gap:8px 12px;padding-top:12px;border-top:1px solid var(--border-color,#615638);min-width:0}.narrative-time-policy{font-size:12px;color:var(--text-secondary,#a5a18e)}.narrative-key-hint{margin-left:auto;font-size:11px;color:var(--text-secondary,#a5a18e)}
button{box-sizing:border-box;min-height:44px;min-width:44px;max-width:100%;padding:9px 12px;border:1px solid var(--border-color,#615638);background:var(--btn-bg,#282b21);color:inherit;font:inherit;line-height:1.45;cursor:pointer;touch-action:manipulation}button:disabled{opacity:.48;cursor:default}button:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--color-accent,#d8b86a);outline-offset:-3px}button:not(:disabled):hover{background:var(--bg-hover,#35392a)}
.narrative-body,.narrative-choices,.narrative-journal-body{overscroll-behavior:contain;touch-action:pan-y;scrollbar-width:thin}.narrative-warning,.narrative-error{margin:0;color:var(--color-danger,#db7878);font-size:12px;overflow-wrap:anywhere}.narrative-error{flex:0 0 auto}
@media(max-width:700px){.narrative-dialogue{gap:10px;height:calc(100dvh - 56px - env(safe-area-inset-top) - env(safe-area-inset-bottom));font-size:15px}.narrative-main{display:flex;flex-direction:column;gap:12px}.narrative-speaker{flex:0 0 auto;min-height:96px;flex-direction:row;justify-content:flex-start;gap:14px}.narrative-portrait-button{flex:0 0 72px;width:72px;height:96px}.narrative-caption{flex:1 1 0;align-items:stretch;text-align:left}.narrative-conversation{flex:1 1 auto;gap:10px}.narrative-choices{max-height:52%;gap:7px}.narrative-header{gap:8px;padding-bottom:10px}.narrative-heading h2{font-size:1.05rem}.narrative-footer{padding-top:10px;gap:8px}.narrative-key-hint{display:none}.narrative-choice-number{display:none}}
@media(max-width:350px){.narrative-speaker{min-height:64px;gap:10px}.narrative-portrait-button{flex-basis:48px;width:48px;height:64px}.narrative-dialogue{gap:8px}.narrative-main{gap:8px}.narrative-header>button{padding:8px}.narrative-footer>button{padding:8px}.narrative-time-policy{font-size:11px}}
@media(max-height:500px){.narrative-dialogue{height:calc(100dvh - 48px - env(safe-area-inset-top) - env(safe-area-inset-bottom));gap:6px}.narrative-header{padding-bottom:6px}.narrative-footer{padding-top:6px}.narrative-speaker{display:none}.narrative-main{grid-template-columns:minmax(0,1fr)}.narrative-choices{max-height:60%}}
</style>
