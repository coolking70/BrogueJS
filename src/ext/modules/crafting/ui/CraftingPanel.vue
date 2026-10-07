<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import i18next from 'i18next';
import { loadCraftingPack } from '../definitions';
import { craftingDirections, craftingErrorKey, type CraftingDirection, type CraftingDraft, type CraftingTab, type CraftingUiView } from './view';
const props = defineProps<{ model: CraftingUiView; draft: CraftingDraft; readOnly: boolean; replay: boolean; submitting: boolean;
  error: string | null; canStop: boolean; immersive?: boolean; presentationHidden?: boolean }>();
const emit = defineEmits<{ close: []; tab: [tab: CraftingTab]; adjust: [id: string, amount: number, event: MouseEvent];
  direction: [id: string, direction: CraftingDirection, event: MouseEvent]; harvest: [id: number, event: MouseEvent];
  craft: [id: string, event: MouseEvent]; place: [id: string, event: MouseEvent]; cancelWork: [event: MouseEvent] }>();
const { t } = useTranslation();
const pack = loadCraftingPack();
const names = new Map([...pack.materials, ...pack.tools, ...pack.resourceNodes, ...pack.stations, ...pack.recipes].map(row => [row.id, row.nameKey]));
const name = (id: string) => t(names.get(id) ?? 'ext.crafting.ui.unavailable');
const stationName = (tags: readonly string[]) => pack.stations.filter(row => tags.every(tag => row.stationTags.includes(tag))).map(row => t(row.nameKey)).join(' / ');
const stationBadge = (tags: readonly string[]) => tags.length ? t('ext.crafting.ui.station.need', { station: stationName(tags) }) : t('ext.crafting.ui.station.hand');
const toolName = (tag: string) => pack.tools.filter(row => row.tags.includes(tag)).map(row => t(row.nameKey)).join(' / ');
const kitName = (id: string) => name(pack.stations.find(row => row.id === id)?.kitDefinitionId ?? '');
const errorText = (code: CraftingUiView['nodes'][number]['reason']) => t(craftingErrorKey(code, key => i18next.exists(key)));
const tabs: readonly CraftingTab[] = ['harvest', 'craft', 'station', 'work'];
const panel = ref<HTMLElement>();
const selected = ref<string | number | null>(null);
const blocked = computed(() => props.readOnly || props.submitting || !!props.presentationHidden);
const batch = (id: string) => props.draft.batches[id] ?? 1;
const choices = computed(() => props.draft.tab === 'harvest' ? props.model.nodes.map(row => row.interactableId)
  : props.draft.tab === 'craft' ? props.model.recipes.map(row => row.recipeId)
    : props.draft.tab === 'station' ? props.model.placements.map(row => row.definitionId) : []);
watch([() => props.draft.tab, choices], () => {
  if (selected.value === null || !choices.value.includes(selected.value as never)) selected.value = choices.value[0] ?? null;
}, { immediate: true });
// Seek clears the parent draft. No target selection survives that replacement.
watch(() => props.draft, (draft, old) => {
  if (draft.tab === 'harvest' && !Object.keys(draft.batches).length && !Object.keys(draft.directions).length
    && (old.tab !== 'harvest' || Object.keys(old.batches).length || Object.keys(old.directions).length)) selected.value = choices.value[0] ?? null;
});
const selectedNode = computed(() => props.model.nodes.find(row => row.interactableId === selected.value));
const selectedRecipe = computed(() => props.model.recipes.find(row => row.recipeId === selected.value));
const selectedPlacement = computed(() => props.model.placements.find(row => row.definitionId === selected.value));
const footerLabel = computed(() => props.draft.tab === 'harvest' ? t('ext.crafting.ui.harvest.action', { ticks: 100 })
  : props.draft.tab === 'craft' ? t('ext.crafting.ui.recipe.start')
    : props.draft.tab === 'station' ? t('ext.crafting.ui.place.action', { ticks: selectedPlacement.value?.placementTicks ?? 300 }) : t('ext.crafting.ui.work.stop'));
const footerDisabled = computed(() => blocked.value || (props.draft.tab === 'harvest' ? !selectedNode.value?.canHarvest
  : props.draft.tab === 'craft' ? !selectedRecipe.value?.maxBatch
    : props.draft.tab === 'station' ? !selectedPlacement.value?.source || !props.draft.directions[selectedPlacement.value.definitionId]
      : !props.canStop));
function close() { if (!props.presentationHidden) emit('close'); }
function submitFooter(event: MouseEvent) {
  if (footerDisabled.value || event.detail > 1) return;
  if (props.draft.tab === 'harvest' && selectedNode.value) emit('harvest', selectedNode.value.interactableId, event);
  else if (props.draft.tab === 'craft' && selectedRecipe.value) emit('craft', selectedRecipe.value.recipeId, event);
  else if (props.draft.tab === 'station' && selectedPlacement.value) emit('place', selectedPlacement.value.definitionId, event);
  else if (props.draft.tab === 'work') emit('cancelWork', event);
}
function hiddenFocus(event: FocusEvent) { if (props.presentationHidden) (event.target as HTMLElement | null)?.blur?.(); }
watch(() => props.presentationHidden, hidden => { if (hidden && typeof document !== 'undefined') {
  const active = document.activeElement as HTMLElement | null; if (active && panel.value?.contains?.(active)) active.blur();
} });
onMounted(() => { void nextTick(() => { if (!props.presentationHidden) panel.value?.focus?.({ preventScroll: true }); }); });
</script>

<template>
  <Teleport to="body">
    <section ref="panel" class="crafting-panel" :class="{ 'presentation-hidden': presentationHidden, immersive }" role="dialog"
      :aria-label="t('ext.crafting.ui.title')" :inert="presentationHidden || undefined" :aria-hidden="presentationHidden || undefined" tabindex="-1"
      @focusin.capture="hiddenFocus" @keydown.stop @keyup.stop @keydown.esc.prevent="close" @pointerdown.stop @pointerup.stop @touchstart.stop @touchend.stop @click.stop>
      <header class="crafting-header"><h2>{{ t('ext.crafting.ui.title') }}</h2><button data-action="close" @click="close">{{ t('ext.crafting.ui.close') }}</button></header>
      <nav class="crafting-tabs"><button v-for="tab in tabs" :key="tab" :data-tab="tab" :class="{ selected: draft.tab === tab }"
        :aria-pressed="draft.tab === tab" @click="emit('tab', tab)">{{ t(`ext.crafting.ui.tab.${tab}`) }}</button></nav>
      <p v-if="replay" class="crafting-notice" data-readonly>{{ t('ext.crafting.ui.replay_readonly') }}</p>
      <p v-else-if="readOnly" class="crafting-notice">{{ t('ext.crafting.ui.unavailable') }}</p>
      <main class="crafting-body">
        <template v-if="draft.tab === 'harvest'">
          <p v-if="!model.nodes.length">{{ t('ext.crafting.ui.harvest.none') }}</p>
          <article v-for="row in model.nodes" :key="row.interactableId" class="crafting-card" :data-node="row.interactableId" :class="{ chosen: selected === row.interactableId }" @click="selected = row.interactableId">
            <button class="crafting-name" :aria-pressed="selected === row.interactableId" @click="selected = row.interactableId"><span :style="{ color: row.color }">{{ row.glyph }}</span><strong>{{ t(row.nameKey) }}</strong></button>
            <p>{{ t('ext.crafting.ui.harvest.remaining', { remaining: row.remaining, capacity: row.capacity }) }}</p>
            <p v-if="row.requiredToolTag" :class="{ unmet: row.reason === 'C5_TOOL' }">{{ t('ext.crafting.ui.tool.required', { tool: toolName(row.requiredToolTag) }) }}</p>
            <p v-if="row.reason" class="unmet">{{ errorText(row.reason) }}</p>
            <button class="card-action crafting-primary" data-action="harvest" :disabled="blocked || !row.canHarvest" @click="emit('harvest', row.interactableId, $event)">{{ t('ext.crafting.ui.harvest.action', { ticks: 100 }) }}</button>
          </article>
        </template>
        <template v-else-if="draft.tab === 'craft'">
          <article v-for="row in model.recipes" :key="row.recipeId" class="crafting-card" :data-recipe="row.recipeId" :class="{ chosen: selected === row.recipeId, unavailable: !row.maxBatch }" @click="selected = row.recipeId">
            <button class="crafting-name" :aria-pressed="selected === row.recipeId" @click="selected = row.recipeId"><strong>{{ t(row.nameKey) }}</strong></button>
            <p class="crafting-badge">{{ stationBadge(row.stationTags) }}</p><p>{{ t(row.descriptionKey) }}</p>
            <div v-for="input in row.inputs" :key="input.itemDefinitionId" class="crafting-amount" :class="{ unmet: input.have < input.perBatch * batch(row.recipeId) }">
              <span>{{ t(input.nameKey) }}</span><span>{{ t('ext.crafting.ui.recipe.need_have', { need: input.perBatch * batch(row.recipeId), have: input.have }) }}</span>
            </div>
            <p class="crafting-output"><span v-for="output in row.outputs" :key="output.itemDefinitionId">→ {{ t(output.nameKey) }} ×{{ output.perBatch * batch(row.recipeId) }}</span></p>
            <p>{{ t('ext.crafting.ui.recipe.per_batch', { ticks: row.workTicks }) }}</p>
            <div class="crafting-stepper"><button data-step="minus" :disabled="blocked || !row.maxBatch || batch(row.recipeId) <= 1" :aria-label="t('ext.crafting.ui.batch.decrease')" @click="emit('adjust', row.recipeId, -1, $event)">−</button>
              <output>{{ batch(row.recipeId) }}</output><button data-step="plus" :disabled="blocked || !row.maxBatch || batch(row.recipeId) >= row.maxBatch" :aria-label="t('ext.crafting.ui.batch.increase')" @click="emit('adjust', row.recipeId, 1, $event)">+</button></div>
            <p>{{ t('ext.crafting.ui.recipe.total', { batches: batch(row.recipeId), ticks: row.workTicks * batch(row.recipeId) }) }}</p>
            <p v-if="row.reason" class="unmet">{{ row.reason === 'C5_GATE' && row.stationTags.length ? stationBadge(row.stationTags) : errorText(row.reason) }}</p>
            <button class="card-action crafting-primary" data-action="craft" :disabled="blocked || !row.maxBatch" @click="emit('craft', row.recipeId, $event)">{{ t('ext.crafting.ui.recipe.start') }}</button>
          </article>
        </template>
        <template v-else-if="draft.tab === 'station'">
          <article v-for="row in model.placements" :key="row.definitionId" class="crafting-card" :data-placement="row.definitionId" :class="{ chosen: selected === row.definitionId }" @click="selected = row.definitionId">
            <button class="crafting-name" :aria-pressed="selected === row.definitionId" @click="selected = row.definitionId"><strong>{{ t(row.nameKey) }}</strong></button>
            <p v-if="row.source === 'kit'">{{ t('ext.crafting.ui.place.source_kit', { kit: kitName(row.definitionId) }) }}</p>
            <template v-else><p :class="{ unmet: !row.source }">{{ t(row.source ? 'ext.crafting.ui.place.source_materials' : 'ext.crafting.ui.place.source_none') }}</p>
              <div v-for="cost in row.cost" :key="cost.itemDefinitionId" class="crafting-amount" :class="{ unmet: cost.have < cost.need }"><span>{{ t(cost.nameKey) }}</span><span>{{ t('ext.crafting.ui.recipe.need_have', { need: cost.need, have: cost.have }) }}</span></div>
            </template>
            <p>{{ t('ext.crafting.ui.place.choose_direction') }}</p>
            <div class="crafting-directions"><button v-for="direction in craftingDirections" :key="direction.id" :data-direction="direction.id" :class="[`direction-${direction.id}`, { selected: draft.directions[row.definitionId] === direction.id }]"
              :disabled="blocked || !row.source" :aria-pressed="draft.directions[row.definitionId] === direction.id" :aria-label="t(`ext.crafting.ui.dir.${direction.id}`)" @click="emit('direction', row.definitionId, direction.id, $event)">{{ direction.glyph }}<small>{{ t(`ext.crafting.ui.dir.${direction.id}`) }}</small></button>
              <span class="direction-center" aria-hidden="true">@</span></div>
            <button class="card-action crafting-primary" data-action="place" :disabled="blocked || !row.source || !draft.directions[row.definitionId]" @click="emit('place', row.definitionId, $event)">{{ t('ext.crafting.ui.place.action', { ticks: row.placementTicks }) }}</button>
          </article>
        </template>
        <template v-else>
          <article class="crafting-card" data-work>
            <template v-if="model.activeTicket"><h3>{{ t('ext.crafting.ui.work.active', { name: t(model.activeTicket.nameKey), done: Math.min(model.activeTicket.completedBatches + 1, model.activeTicket.totalBatches), total: model.activeTicket.totalBatches }) }}</h3>
              <p>{{ t('ext.crafting.ui.work.remaining', { ticks: model.activeTicket.remainingTicks }) }}</p>
              <p v-if="!canStop">{{ t('ext.crafting.ui.work.stop_after_batch') }}</p>
              <button class="card-action" data-action="stop" :disabled="blocked || !canStop" @click="emit('cancelWork', $event)">{{ t('ext.crafting.ui.work.stop') }}</button>
            </template><p v-else>{{ t('ext.crafting.ui.work.none') }}</p>
          </article>
          <h3>{{ t('ext.crafting.ui.history.title') }}</h3><ol class="crafting-history"><li v-for="entry in model.history" :key="entry.factId">{{ t(`ext.crafting.ui.history.${entry.result}`, { name: name(entry.definitionId) }) }}</li></ol>
        </template>
      </main>
      <footer class="crafting-footer"><p v-if="error" class="unmet" role="alert">{{ t(error) }}</p><div>
        <button data-action="cancel" @click="close">{{ t('ext.crafting.ui.cancel') }}</button><button class="crafting-primary mobile-confirm" data-action="confirm" :disabled="footerDisabled" @click="submitFooter">{{ footerLabel }}</button>
      </div></footer>
    </section>
  </Teleport>
</template>

<style scoped>
/* The panel reserves space instead of covering the player or adjacent cells.
 * These selectors apply only while this module's actual visible root exists. */
:global(body:has(.crafting-panel:not(.presentation-hidden)) .app-layout){width:calc(100vw - 370px)!important}
.crafting-panel{position:fixed;right:0;top:0;bottom:0;width:370px;max-width:100vw;z-index:900;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;border-left:1px solid var(--th-line,#555);background:var(--th-panel,#171918);color:var(--th-fg,#e4dfd1);font:14px var(--th-font,monospace);outline:none;overscroll-behavior:contain;touch-action:pan-y}
.crafting-panel *{box-sizing:border-box;min-width:0}.crafting-panel button{min-height:44px;min-width:44px;padding:8px;border:1px solid var(--th-line,#555);background:transparent;color:inherit;font:inherit;cursor:pointer;touch-action:manipulation}.crafting-panel button:disabled{opacity:.42;cursor:default}.crafting-panel button:not(:disabled):hover,.crafting-panel button:focus-visible{border-color:var(--th-accent,#dcc88d);background:var(--th-raised,#2d2e26)}
.crafting-header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid var(--th-line,#555);flex:none}.crafting-header h2{font-size:18px;letter-spacing:3px;margin:0}.crafting-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:6px 8px;flex:none;border-bottom:1px solid var(--th-line,#555)}.crafting-tabs button{padding:6px 2px;white-space:nowrap}.selected{color:var(--th-accent,#dcc88d)!important;background:var(--th-raised,#2d2e26)!important;border-color:var(--th-accent,#dcc88d)!important}
.crafting-body{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;flex:1;padding:12px;scrollbar-gutter:stable}.crafting-card{border:1px solid var(--th-line,#555);padding:10px;margin-bottom:12px}.crafting-card.chosen{border-left:3px solid var(--th-accent,#dcc88d)}.crafting-card.unavailable{background:color-mix(in srgb,var(--th-panel,#171918),#777 10%)}.crafting-panel p{font-size:12px;line-height:1.55;margin:8px 0;overflow-wrap:anywhere;color:var(--th-dim,#aaa)}.crafting-name{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0!important;padding:0!important}.crafting-name strong,.crafting-panel h3{font-size:14px;line-height:1.45;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow-wrap:anywhere;margin:0}.crafting-name>span{flex:none;font-size:22px}.crafting-badge{color:var(--th-accent,#dcc88d)!important}.crafting-amount{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px;font-size:12px;line-height:1.6}.crafting-amount>span:first-child{overflow-wrap:anywhere}.crafting-output{display:flex;flex-direction:column}.crafting-stepper{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:10px 0}.crafting-stepper button{width:44px;font-size:19px;padding:0}.crafting-stepper output{min-width:32px;text-align:center;font-variant-numeric:tabular-nums}.crafting-primary{background:var(--th-accent,#dcc88d)!important;color:var(--th-bg,#171918)!important}.card-action{width:100%}.unmet{color:var(--th-warn,#e3aa76)!important}.crafting-notice{flex:none;margin:0!important;padding:6px 12px;border-bottom:1px solid var(--th-line,#555)}
.crafting-directions{display:grid;grid-template-columns:repeat(3,minmax(44px,1fr));gap:6px;max-width:250px;margin:10px auto}.crafting-directions button{min-height:50px;display:flex;gap:4px;align-items:center;justify-content:center}.crafting-directions small{font-size:11px}.direction-nw{grid-area:1/1}.direction-n{grid-area:1/2}.direction-ne{grid-area:1/3}.direction-w{grid-area:2/1}.direction-center{grid-area:2/2;display:grid;place-items:center;font-size:20px}.direction-e{grid-area:2/3}.direction-sw{grid-area:3/1}.direction-s{grid-area:3/2}.direction-se{grid-area:3/3}.crafting-history{padding-left:20px;font-size:12px;line-height:1.7;overflow-wrap:anywhere}
.crafting-footer{flex:none;border-top:1px solid var(--th-line,#555);padding:8px 12px max(8px,env(safe-area-inset-bottom));background:var(--th-panel,#171918)}.crafting-footer>div{display:flex;justify-content:flex-end;gap:8px}.crafting-footer p{margin:0 0 6px}.mobile-confirm{display:none}.presentation-hidden{visibility:hidden;pointer-events:none}
@media(max-width:700px){:global(body:has(.crafting-panel:not(.presentation-hidden)) .app-layout){width:100vw!important;height:52dvh!important;min-height:0!important}.crafting-panel{top:auto;height:48dvh;width:100vw;border-left:0;border-top:1px solid var(--th-line,#555)}.crafting-header{padding:3px 10px}.crafting-header h2{font-size:16px}.crafting-tabs{padding:4px 8px}.crafting-body{padding:10px;scrollbar-gutter:auto}.crafting-card{margin-bottom:10px}.crafting-footer{padding:6px 10px max(6px,env(safe-area-inset-bottom))}.crafting-footer>div>button{flex:1;font-size:12px}.mobile-confirm{display:block}.card-action{display:none}.crafting-notice{font-size:11px!important;padding:4px 10px}}
</style>
