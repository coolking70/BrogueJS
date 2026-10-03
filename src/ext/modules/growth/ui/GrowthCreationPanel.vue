<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { inputManager } from '../../../../engine/Input';
import type { GrowthCreationView } from '../view';
import type { GrowthIdentity } from '../types';

const props = defineProps<{ model: GrowthCreationView; submitting: boolean; error: string | null }>();
const emit = defineEmits<{ cancel: []; select: [kind: GrowthIdentity['kind'], id: string]; adjust: [identityId: string, choiceIndex: number, attributeId: string, delta: number]; submit: [] }>();
const { t } = useTranslation();
const text = (key: string) => t(`ext.growth.${key.slice('ext.growth.'.length)}`);
const navigationLocked = ref(false);
let navigationTimer: ReturnType<typeof setTimeout> | undefined;
const step = ref(0), panel = ref<HTMLElement | null>(null), content = ref<HTMLElement | null>(null);
const group = computed(() => props.model.groups[step.value]);
const selected = computed(() => group.value?.definitions.find(identity => identity.id === group.value!.selectedId));
const choices = computed(() => props.model.choices.filter(choice => choice.identityId === selected.value?.id));
const completeStep = computed(() => !group.value || !group.value.enabled || (!!selected.value && choices.value.every(choice => choice.spent === choice.points)));
const summary = computed(() => step.value === props.model.groups.length);
const canNext = computed(() => !summary.value && completeStep.value && !props.submitting && !navigationLocked.value);
let removeKeyboard: (() => void) | undefined;
function cycleFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab') return;
  const buttons = Array.from(panel.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
  if (!buttons.length) return;
  event.preventDefault();
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  buttons[index < 0 ? (event.shiftKey ? buttons.length - 1 : 0) : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]!.focus({ preventScroll: true });
}
function clearNavigationLock() {
  if (navigationTimer !== undefined) globalThis.clearTimeout(navigationTimer);
  navigationTimer = undefined; navigationLocked.value = false;
}
function lockNavigation() {
  navigationLocked.value = true;
  navigationTimer = globalThis.setTimeout(clearNavigationLock, 600);
}
function cancel() { if (!props.submitting) { clearNavigationLock(); emit('cancel'); } }
function previous(event?: MouseEvent) {
  if (props.submitting || navigationLocked.value || step.value <= 0 || (event?.detail ?? 0) > 1) return;
  lockNavigation(); step.value--;
}
function next(event?: MouseEvent) {
  if (!canNext.value || (event?.detail ?? 0) > 1) return;
  // A dblclick event arrives after both click handlers. Lock synchronously
  // before changing step, including across Vue redraw and direction changes.
  lockNavigation(); step.value++;
}
watch(step, async () => { await nextTick(); if (content.value) content.value.scrollTop = 0; panel.value?.focus({ preventScroll: true }); });
onMounted(() => {
  panel.value?.focus({ preventScroll: true });
  removeKeyboard = inputManager.registerModalKeyHandler(event => {
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
    cycleFocus(event); return true;
  }, 1100);
});
onUnmounted(() => { clearNavigationLock(); removeKeyboard?.(); });
</script>

<template>
  <Teleport to="body">
    <div class="growth-creation-backdrop" @click.self="cancel" @pointerdown.stop @pointerup.stop @touchstart.stop @touchend.stop @keydown.esc.prevent.stop="cancel" @keydown.stop="cycleFocus" @keyup.stop @dblclick.prevent.stop>
      <section ref="panel" class="growth-creation-panel" tabindex="-1" role="dialog" aria-modal="true" :aria-label="t('ext.growth.creation.title')">
        <header class="growth-creation-header">
          <div><p>{{ t('ext.growth.creation.eyebrow') }}</p><h2>{{ t('ext.growth.creation.title') }}</h2></div>
          <button data-creation="cancel" :disabled="submitting" @click="cancel">{{ t('ext.growth.creation.cancel') }}</button>
        </header>
        <nav class="growth-creation-steps" :aria-label="t('ext.growth.creation.steps')">
          <span v-for="(entry, index) in model.groups" :key="entry.kind" :class="{ current: step === index, completed: step > index }">{{ text(entry.nameKey) }}</span>
          <span :class="{ current: summary }">{{ t('ext.growth.creation.summary') }}</span>
        </nav>
        <main ref="content" class="growth-creation-body">
          <template v-if="group">
            <h3>{{ text(group.nameKey) }}</h3>
            <p v-if="!group.enabled" class="growth-creation-notice">{{ t('ext.growth.creation.disabled') }}</p>
            <template v-else>
              <div class="growth-creation-cards">
                <button v-for="identity in group.definitions" :key="identity.id" class="growth-creation-card" :class="{ selected: group.selectedId === identity.id }"
                  :data-select-identity="identity.id" :aria-pressed="group.selectedId === identity.id" :disabled="submitting" @click="emit('select', group.kind, identity.id)">
                  <strong>{{ text(identity.nameKey) }}</strong><span>{{ text(identity.descriptionKey) }}</span>
                </button>
              </div>
              <section v-for="choice in choices" :key="choice.choiceIndex" class="growth-creation-choice" :data-choice="`${choice.identityId}:${choice.choiceIndex}`">
                <h4>{{ t('ext.growth.creation.choice', { spent: choice.spent, points: choice.points }) }}</h4>
                <div v-for="attribute in choice.attributes" :key="attribute.id" class="growth-creation-attribute" :data-choice-attribute="attribute.id">
                  <div><strong>{{ text(attribute.nameKey) }}</strong><small>{{ t('ext.growth.creation.choice_cost', { cost: attribute.cost, cap: attribute.cap }) }}</small></div>
                  <div class="growth-creation-adjust">
                    <button data-creation="decrease" :disabled="!attribute.canDecrease || submitting" :aria-label="t('ext.growth.creation.decrease', { name: text(attribute.nameKey) })" @click="emit('adjust', choice.identityId, choice.choiceIndex, attribute.id, -1)">−</button>
                    <output>{{ attribute.amount }}</output>
                    <button data-creation="increase" :disabled="!attribute.canIncrease || submitting" :aria-label="t('ext.growth.creation.increase', { name: text(attribute.nameKey) })" @click="emit('adjust', choice.identityId, choice.choiceIndex, attribute.id, 1)">+</button>
                  </div>
                </div>
              </section>
              <section v-if="selected" class="growth-creation-details" :data-creation-details="selected.id">
                <h4>{{ t('ext.growth.creation.details') }}</h4>
                <ul><li v-for="(line, index) in selected.description" :key="index">{{ line }}</li></ul>
              </section>
            </template>
          </template>
          <template v-else>
            <h3>{{ t('ext.growth.creation.summary') }}</h3>
            <p class="growth-creation-notice">{{ t('ext.growth.creation.summary_hint') }}</p>
            <dl class="growth-creation-summary">
              <div v-for="entry in model.groups" :key="entry.kind"><dt>{{ text(entry.nameKey) }}</dt><dd>{{ entry.enabled ? text(entry.definitions.find(identity => identity.id === entry.selectedId)?.nameKey ?? 'ext.growth.creation.unselected') : t('ext.growth.creation.disabled_short') }}</dd></div>
              <div v-for="attribute in model.attributes" :key="attribute.id"><dt>{{ text(attribute.nameKey) }}</dt><dd>{{ attribute.value }}</dd></div>
            </dl>
            <dl v-if="model.resources" class="growth-creation-summary">
              <div><dt>{{ t('ext.growth.creation.max_hp_bonus') }}</dt><dd>+{{ model.resources.maxHpBonus }}</dd></div>
              <div><dt>{{ t('ext.growth.creation.strength_bonus') }}</dt><dd>+{{ model.resources.strengthBonus }}</dd></div>
              <div><dt>{{ t('ext.growth.ui.focus_capacity') }}</dt><dd>{{ model.resources.focusCapacity }}</dd></div>
              <div><dt>{{ t('ext.growth.creation.focus_interval') }}</dt><dd>{{ model.resources.focusInterval }}</dd></div>
            </dl>
            <h4>{{ t('ext.growth.ui.identity_gifts') }}</h4>
            <p v-if="!model.gifts.length">{{ t('ext.growth.creation.no_gifts') }}</p>
            <ul v-else><li v-for="gift in model.gifts" :key="gift.id">{{ text(gift.nameKey) }} · {{ t(`ext.growth.ui.${gift.mode}`) }}</li></ul>
            <p>{{ t('ext.growth.creation.slots', { active: model.activeSlots, passive: model.passiveSlots }) }}</p>
            <p>{{ t('ext.growth.creation.gift_equip') }}</p><p>{{ t('ext.growth.creation.gift_limits', model.giftLimits) }}</p>
            <section v-for="entry in model.groups.filter(entry => entry.enabled)" :key="entry.kind" class="growth-creation-details">
              <h4>{{ text(entry.definitions.find(identity => identity.id === entry.selectedId)?.nameKey ?? entry.nameKey) }}</h4>
              <ul><li v-for="(line, index) in entry.definitions.find(identity => identity.id === entry.selectedId)?.description ?? []" :key="index">{{ line }}</li></ul>
            </section>
          </template>
        </main>
        <footer class="growth-creation-footer">
          <p v-if="error || (summary && !model.valid)" class="growth-creation-error" role="alert">{{ text(error ?? 'ext.growth.creation.invalid') }}</p>
          <div class="growth-creation-actions">
            <button data-creation="previous" :disabled="step === 0 || submitting || navigationLocked" @click="previous">{{ t('ext.growth.creation.previous') }}</button>
            <button data-creation="next" :disabled="!canNext" @click="next">{{ t('ext.growth.creation.next') }}</button>
            <button class="growth-creation-start" data-creation="submit" :disabled="!summary || !model.valid || submitting || navigationLocked" @click="emit('submit')">{{ t('ext.growth.creation.begin') }}</button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.growth-creation-backdrop{position:fixed;inset:0;z-index:2200;background:rgba(8,10,8,.88);display:flex;align-items:center;justify-content:center;padding:24px;color:var(--th-text,#e2dece);font-family:var(--th-font,monospace);box-sizing:border-box}
.growth-creation-panel{display:flex;flex-direction:column;width:min(940px,100%);height:min(820px,calc(100dvh - 48px));max-height:min(820px,calc(100dvh - 48px));min-height:0;min-width:0;background:var(--th-base,#1b201c);border:1px solid var(--th-line,#57614e);box-shadow:0 20px 90px #0009;outline:none;overflow:hidden}
.growth-creation-panel *{box-sizing:border-box}.growth-creation-panel h2,.growth-creation-panel h3,.growth-creation-panel h4,.growth-creation-panel p{margin:0}.growth-creation-panel button{font:inherit;color:inherit;background:var(--th-raised,#293026);border:1px solid var(--th-line,#57614e);cursor:pointer;min-height:42px;padding:9px 14px}.growth-creation-panel button:disabled{opacity:.4;cursor:default}.growth-creation-panel button:focus-visible{outline:2px solid var(--th-accent,#dbc689);outline-offset:-3px}
.growth-creation-header{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 24px;flex-shrink:0}.growth-creation-header p{font-size:10px;letter-spacing:3px;color:var(--th-dim,#aaa)}.growth-creation-header h2{font-size:23px;font-weight:400;letter-spacing:3px;margin-top:7px}.growth-creation-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-block:1px solid var(--th-line,#57614e);flex-shrink:0}.growth-creation-steps span{text-align:center;padding:12px 4px;font-size:12px;color:var(--th-dim,#aaa)}.growth-creation-steps .current{color:var(--th-accent,#dbc689);background:var(--th-raised,#293026);box-shadow:inset 0 -2px var(--th-accent,#dbc689)}.growth-creation-steps .completed{color:var(--th-text,#e2dece)}
.growth-creation-body{flex:1;overflow:auto;overscroll-behavior:contain;min-height:0;padding:22px 24px;line-height:1.65;overflow-wrap:anywhere}.growth-creation-body>h3{font-size:18px;margin-bottom:16px}.growth-creation-body>p,.growth-creation-body>h4{margin-top:14px}.growth-creation-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.growth-creation-card{display:flex;flex-direction:column;gap:7px;text-align:left;min-width:0!important}.growth-creation-card strong{font-size:16px;color:var(--th-accent,#dbc689)}.growth-creation-card span{font-size:12px;font-weight:400;color:var(--th-dim,#aaa);line-height:1.6}.growth-creation-card.selected{border-color:var(--th-accent,#dbc689);box-shadow:inset 3px 0 var(--th-accent,#dbc689)}.growth-creation-choice,.growth-creation-details{margin-top:20px;padding-top:16px;border-top:1px solid var(--th-line,#57614e)}.growth-creation-details ul{padding-left:20px;margin:10px 0 0;font-size:12px}.growth-creation-details li{margin-top:6px}.growth-creation-choice h4{font-size:14px;margin-bottom:8px}.growth-creation-attribute{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px dotted var(--th-line,#57614e)}.growth-creation-attribute strong{font-size:13px}.growth-creation-attribute small{display:block;font-size:10px;color:var(--th-dim,#aaa)}.growth-creation-adjust{display:flex;gap:6px;align-items:center;flex-shrink:0}.growth-creation-adjust button{min-width:38px;padding:8px}.growth-creation-adjust output{min-width:22px;text-align:center}.growth-creation-notice{padding:10px 12px;border-left:2px solid var(--th-accent,#dbc689);background:var(--th-raised,#293026);font-size:12px}.growth-creation-summary{margin:16px 0}.growth-creation-summary>div{display:flex;justify-content:space-between;gap:14px;padding:7px 0;border-bottom:1px dotted var(--th-line,#57614e)}.growth-creation-summary dd{margin:0;color:var(--th-accent,#dbc689)}
.growth-creation-footer{padding:16px 24px;border-top:1px solid var(--th-line,#57614e);flex-shrink:0}.growth-creation-actions{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:10px}.growth-creation-start{color:var(--th-accent,#dbc689)!important}.growth-creation-error{font-size:12px;color:var(--th-warn,#efb278);padding-bottom:12px}
@media(max-width:600px){.growth-creation-backdrop{padding:12px}.growth-creation-panel{height:calc(100dvh - 24px);max-height:calc(100dvh - 24px);width:100%}.growth-creation-header{padding:14px;gap:10px}.growth-creation-header h2{font-size:19px}.growth-creation-body{padding:16px 14px}.growth-creation-cards{gap:8px}.growth-creation-card{padding:11px!important}.growth-creation-card strong{font-size:14px}.growth-creation-card span{font-size:11px}.growth-creation-footer{padding:12px 14px}.growth-creation-actions{gap:6px;grid-template-columns:1fr 1fr}.growth-creation-start{grid-column:1/-1}.growth-creation-steps span{font-size:11px;padding:10px 2px}}
@media(max-width:350px){.growth-creation-backdrop{padding:8px}.growth-creation-panel{height:calc(100dvh - 16px);max-height:calc(100dvh - 16px)}.growth-creation-header,.growth-creation-body,.growth-creation-footer{padding-left:12px;padding-right:12px}.growth-creation-cards{grid-template-columns:minmax(0,1fr)}.growth-creation-card{gap:3px}.growth-creation-header h2{font-size:17px}.growth-creation-header button{padding:8px 10px}}
</style>
