<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import i18next from 'i18next';
import type { WorldErrorCode } from '../../../worldSdk';
import { foragingErrorKey, type ForagingCompanionCard, type ForagingDraft, type ForagingNodeCard, type ForagingTab, type ForagingUiView } from './view';
const props = defineProps<{ model: ForagingUiView; nodes: ForagingNodeCard[]; companions: ForagingCompanionCard[]; draft: ForagingDraft;
  readOnly: boolean; replay: boolean; submitting: boolean; error: string | null; immersive?: boolean; presentationHidden?: boolean }>();
const emit = defineEmits<{ close: []; tab: [tab: ForagingTab]; choose: [kind: 'nodeId' | 'heatSourceId' | 'itemId' | 'targetId', id: number, event: MouseEvent];
  harvest: [id: number, event: MouseEvent]; roast: [heat: number, item: number, event: MouseEvent]; feed: [target: number, item: number, event: MouseEvent] }>();
const t = (key: string, options?: Record<string, unknown>) => i18next.t(key, options);
const tabs: readonly ForagingTab[] = ['harvest', 'roast', 'feed'];
const panel = ref<HTMLElement>();
const blocked = computed(() => props.readOnly || props.submitting || !!props.presentationHidden);
const foods = computed(() => props.model.foods.filter(row => props.draft.tab !== 'roast' || row.roastable));
const heatSources = computed(() => [...props.model.heatSources].sort((a, b) => a.interactableId - b.interactableId));
const selectedNode = computed(() => props.nodes.find(row => row.interactableId === props.draft.nodeId));
const selectedFood = computed(() => foods.value.find(row => row.itemId === props.draft.itemId));
const selectedTarget = computed(() => props.companions.find(row => row.actorId === props.draft.targetId));
const selectedHeat = computed(() => heatSources.value.find(row => row.interactableId === props.draft.heatSourceId));
const footerLabel = computed(() => t(`ext.foraging.ui.${props.draft.tab}.action`, { ticks: 100 }));
const footerDisabled = computed(() => blocked.value || (props.draft.tab === 'harvest' ? !selectedNode.value?.canHarvest
  : props.draft.tab === 'roast' ? !selectedFood.value || !selectedHeat.value
    : !selectedFood.value || !selectedTarget.value?.adjacent || selectedTarget.value.departing));
const reason = (code: WorldErrorCode | null) => t(foragingErrorKey(code, key => i18next.exists(key)));
function errorText(key: string) {
  const match = /^ext\.(?:foraging\.error|foundation\.world\.error)\.([a-z_]+)$/.exec(key);
  const allowed = match && foragingErrorKey(`C5_${match[1]!.toUpperCase()}` as WorldErrorCode, candidate => candidate === key && i18next.exists(candidate)) === key;
  return t(allowed ? key : 'ext.foraging.ui.rejected');
}
function choose(kind: 'nodeId' | 'heatSourceId' | 'itemId' | 'targetId', id: number, event: MouseEvent) {
  if (!blocked.value && event.detail <= 1) emit('choose', kind, id, event);
}
function close() { if (!props.presentationHidden) emit('close'); }
function selectTab(tab: ForagingTab) { if (!props.presentationHidden && !props.submitting) emit('tab', tab); }
function confirm(event: MouseEvent) {
  if (footerDisabled.value || event.detail > 1) return;
  if (props.draft.tab === 'harvest' && selectedNode.value) emit('harvest', selectedNode.value.interactableId, event);
  else if (props.draft.tab === 'roast' && selectedHeat.value && selectedFood.value) emit('roast', selectedHeat.value.interactableId, selectedFood.value.itemId, event);
  else if (props.draft.tab === 'feed' && selectedTarget.value && selectedFood.value) emit('feed', selectedTarget.value.actorId, selectedFood.value.itemId, event);
}
function hiddenFocus(event: FocusEvent) { if (props.presentationHidden) (event.target as HTMLElement | null)?.blur?.(); }
watch(() => props.presentationHidden, hidden => {
  if (hidden && typeof document !== 'undefined') {
    const active = document.activeElement as HTMLElement | null;
    if (active && panel.value?.contains?.(active)) active.blur();
  }
});
onMounted(() => { void nextTick(() => { if (!props.presentationHidden) panel.value?.focus?.({ preventScroll: true }); }); });
</script>
<template>
  <Teleport to="body">
    <section ref="panel" class="foraging-panel" :class="{ 'presentation-hidden': presentationHidden, immersive }" role="dialog"
      :aria-label="t('ext.foraging.ui.title')" :inert="presentationHidden || undefined" :aria-hidden="presentationHidden || undefined" tabindex="-1"
      @focusin.capture="hiddenFocus" @keydown.stop @keyup.stop @keydown.esc.prevent="close" @pointerdown.stop @pointerup.stop @touchstart.stop @touchend.stop @click.stop>
      <header class="foraging-header"><h2>{{ t('ext.foraging.ui.title') }}</h2><button data-action="close" @click="close">{{ t('ext.foraging.ui.close') }}</button></header>
      <nav class="foraging-tabs"><button v-for="tab in tabs" :key="tab" :data-tab="tab" :class="{ selected: draft.tab === tab }" :aria-pressed="draft.tab === tab"
        :disabled="submitting || presentationHidden" @click="selectTab(tab)">{{ t(`ext.foraging.ui.tab.${tab}`) }}</button></nav>
      <p v-if="replay" class="foraging-notice" data-readonly>{{ t('ext.foraging.ui.replay_readonly') }}</p>
      <p v-else-if="readOnly" class="foraging-notice">{{ t('ext.foraging.ui.unavailable') }}</p>
      <main class="foraging-body">
        <template v-if="draft.tab === 'harvest'">
          <p v-if="!nodes.length">{{ t('ext.foraging.ui.harvest.none') }}</p>
          <article v-for="row in nodes" :key="row.interactableId" class="foraging-card" :class="{ chosen: draft.nodeId === row.interactableId }" :data-node="row.interactableId">
            <button class="foraging-name" :disabled="blocked" :aria-pressed="draft.nodeId === row.interactableId" @click="choose('nodeId', row.interactableId, $event)"><strong>{{ row.displayName }}</strong></button>
            <p>{{ t('ext.foraging.ui.harvest.remaining', { remaining: row.remaining, capacity: row.capacity }) }}</p>
            <p v-if="row.reason" class="unmet">{{ reason(row.reason) }}</p>
          </article>
        </template>
        <template v-else>
          <template v-if="draft.tab === 'roast'">
            <p v-if="!heatSources.length" data-no-heat>{{ t('ext.foraging.ui.roast.no_heat') }}</p>
            <div v-else class="foraging-heats"><button v-for="heat in heatSources" :key="heat.interactableId" :data-heat="heat.interactableId"
              :class="{ selected: draft.heatSourceId === heat.interactableId }" :disabled="blocked" :aria-pressed="draft.heatSourceId === heat.interactableId"
              @click="choose('heatSourceId', heat.interactableId, $event)">{{ t(heat.kind === 'bonfire' ? 'ext.foraging.ui.roast.heat.bonfire' : 'ext.foraging.ui.roast.heat.hearth') }}</button></div>
          </template>
          <template v-else>
            <h3>{{ t('ext.foraging.ui.feed.choose_companion') }}</h3>
            <p v-if="!companions.length">{{ t('ext.foraging.ui.feed.no_companion') }}</p>
            <article v-for="companion in companions" :key="companion.actorId" class="foraging-card" :data-companion="companion.actorId"
              :class="{ chosen: draft.targetId === companion.actorId, unavailable: !companion.adjacent || companion.departing }">
              <button class="foraging-name" :disabled="blocked || !companion.adjacent || companion.departing" :aria-pressed="draft.targetId === companion.actorId"
                @click="choose('targetId', companion.actorId, $event)"><strong>{{ companion.displayName }}</strong></button>
              <p>{{ t(`ext.foraging.band.${companion.band}`) }}<span v-if="companion.departing" class="unmet"> · {{ t('ext.foraging.band.departing') }}</span></p>
              <p v-if="!companion.adjacent" class="unmet">{{ t('ext.foraging.ui.feed.not_adjacent') }}</p>
            </article>
          </template>
          <p v-if="!foods.length">{{ t(draft.tab === 'roast' ? 'ext.foraging.ui.roast.none' : 'ext.foraging.ui.feed.none') }}</p>
          <article v-for="food in foods" :key="food.itemId" class="foraging-card" :data-food="food.itemId" :class="{ chosen: draft.itemId === food.itemId }">
            <button class="foraging-name" :disabled="blocked" :aria-pressed="draft.itemId === food.itemId" @click="choose('itemId', food.itemId, $event)"><strong>{{ food.displayName }}</strong><span>×{{ food.quantity }}</span></button>
            <p v-if="draft.tab === 'feed'" data-satiety>{{ food.satiety === null ? t('ext.foraging.ui.feed.satiety_small') : t('ext.foraging.ui.feed.satiety_value', { value: food.satiety }) }}</p>
          </article>
        </template>
      </main>
      <footer class="foraging-footer"><p v-if="error" class="unmet" role="alert">{{ errorText(error) }}</p><div>
        <button data-action="cancel" @click="close">{{ t('ext.foraging.ui.cancel') }}</button>
        <button class="foraging-primary" data-action="confirm" :disabled="footerDisabled" @click="confirm">{{ footerLabel }}</button>
      </div></footer>
    </section>
  </Teleport>
</template>
<style scoped>
/* Reserve the panel's area so the shell's map can resize and retain its player-centered view. */
:global(body:has(.foraging-panel:not(.presentation-hidden)) .app-layout){width:calc(100vw - 350px)!important}
.foraging-panel{position:fixed;right:0;top:0;bottom:0;width:350px;max-width:100vw;z-index:900;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;border-left:1px solid var(--th-line,#555);background:var(--th-panel,#171918);color:var(--th-fg,#e4dfd1);font:14px var(--th-font,monospace);outline:none;overscroll-behavior:contain;touch-action:pan-y}
.foraging-panel *{box-sizing:border-box;min-width:0}.foraging-panel button{min-width:44px;min-height:44px;padding:8px;border:1px solid var(--th-line,#555);background:transparent;color:inherit;font:inherit;cursor:pointer;touch-action:manipulation}.foraging-panel button:disabled{opacity:.42;cursor:default}.foraging-panel button:not(:disabled):hover,.foraging-panel button:focus-visible{border-color:var(--th-accent,#dcc88d);background:var(--th-raised,#2d2e26)}
.foraging-header{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--th-line,#555)}.foraging-header h2{font-size:18px;letter-spacing:3px;margin:0}.foraging-tabs{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;padding:6px 8px;border-bottom:1px solid var(--th-line,#555)}.foraging-tabs button{padding:6px 2px}.selected{color:var(--th-accent,#dcc88d)!important;background:var(--th-raised,#2d2e26)!important;border-color:var(--th-accent,#dcc88d)!important}
.foraging-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:12px;scrollbar-gutter:stable}.foraging-card{border:1px solid var(--th-line,#555);padding:8px;margin-bottom:10px}.foraging-card.chosen{border-left:3px solid var(--th-accent,#dcc88d)}.foraging-card.unavailable{opacity:.7}.foraging-panel p{font-size:12px;line-height:1.5;margin:8px 0;overflow-wrap:anywhere;color:var(--th-dim,#aaa)}.foraging-name{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:0!important;padding:0!important}.foraging-name strong,.foraging-panel h3{font-size:14px;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere;margin:0}.foraging-name>span{flex:none;white-space:nowrap;font-variant-numeric:tabular-nums}.foraging-heats{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}.foraging-heats button{flex:1}.unmet{color:var(--th-warn,#e3aa76)!important}.foraging-notice{flex:none;margin:0!important;padding:6px 12px;border-bottom:1px solid var(--th-line,#555)}
.foraging-footer{flex:none;border-top:1px solid var(--th-line,#555);padding:8px 12px max(8px,env(safe-area-inset-bottom));background:var(--th-panel,#171918)}.foraging-footer>div{display:flex;gap:8px}.foraging-footer button{flex:1}.foraging-footer p{margin:0 0 6px}.foraging-primary{background:var(--th-accent,#dcc88d)!important;color:var(--th-bg,#171918)!important}.presentation-hidden{visibility:hidden;pointer-events:none}
@media(max-width:700px){:global(body:has(.foraging-panel:not(.presentation-hidden)) .app-layout){width:100vw!important;height:calc(100dvh - min(36dvh,320px))!important;min-height:0!important}.foraging-panel{top:auto;height:min(36dvh,320px);width:100vw;border-left:0;border-top:1px solid var(--th-line,#555)}.foraging-header{padding:3px 10px}.foraging-header h2{font-size:16px}.foraging-tabs{padding:4px 8px}.foraging-body{padding:8px 10px;scrollbar-gutter:auto}.foraging-footer{padding:6px 10px max(6px,env(safe-area-inset-bottom))}.foraging-footer button{font-size:12px}.foraging-notice{font-size:11px!important;padding:4px 10px}}
</style>
