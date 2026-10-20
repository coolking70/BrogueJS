<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import PartyWindowControls from './PartyWindowControls.vue';
import type { PlanProjection } from './planProjection';
import { useTranslation } from 'i18next-vue';
import type { PartyWindowState, PartyPlan, WindowLength } from '../../../partyWindow';
import type { PartyPreviewResult } from '../../../../engine/Core/PartyPlanning';
const props = defineProps<{
  state: PartyWindowState;
  hideControls?: boolean;
  pickTravel: () => void;
  cancelMap: () => void;
  paths: PlanProjection[];
  focused: number;
  draft: PartyPlan | null | undefined;
  busy: boolean;
  preview: PartyPreviewResult | null;
  advance: (length: WindowLength, automatic: boolean) => void;
  append: (kind: 'wait' | 'search' | 'move', dx?: number, dy?: number) => void;
  clear: () => void;
  keep: () => void;
  undo: () => void;
  rehearse: (length: WindowLength, automatic: boolean) => void;
  cancelPreview: () => void;
  choose: (choice: string) => void;
  policy: (empty: 'wait' | 'interrupt', reaction: 'stop' | 'continue' | 'ai-this-window') => void;
}>();
const { t } = useTranslation();
const plan = computed(() => {
  const m = props.state.members.find((m) => m.actorId === props.focused);
  const p = props.draft === undefined ? m?.plan : props.draft;
  return p?.kind === 'queue'
    ? { ...p, actions: p.actions.slice(props.draft === undefined ? m!.cursor : 0) }
    : p;
});
const empty = ref<'wait' | 'interrupt'>('wait'), reaction = ref<'stop' | 'continue' | 'ai-this-window'>('stop');
watch(() => [props.focused, props.state.members], () => {
  const member = props.state.members.find(m => m.actorId === props.focused);
  if (member) { empty.value = member.emptyPlan; reaction.value = member.reactions['new-hostile']; }
}, { immediate: true });
const choices = ref('');
const dirs = [
  [-1, -1, '↖'],
  [0, -1, '↑'],
  [1, -1, '↗'],
  [-1, 0, '←'],
  [1, 0, '→'],
  [-1, 1, '↙'],
  [0, 1, '↓'],
  [1, 1, '↘']
] as const;
</script>
<template>
  <section class="party-window" data-party-window>
    <div>
      {{ t('ext.party.plan.for') }} #{{ focused }} ·
      {{
        draft === undefined
          ? t('ext.party.plan.keep')
          : draft === null
            ? t('ext.party.plan.empty')
            : draft.kind === 'queue'
              ? t('ext.party.plan.steps', { count: draft.actions.length })
              : draft.kind==='travel' ? t('ext.party.plan.travel', { x: draft.target.x, y: draft.target.y }) : t('ext.party.ai.temporary')
      }}
    </div>
    <ol v-if="plan?.kind === 'queue'" class="steps">
      <li v-for="(intent, index) in plan.actions" :key="index">
        {{ t('ext.party.plan.intent.' + intent.kind)
        }}<span v-if="intent.kind === 'move'"> {{ intent.dx }},{{ intent.dy }}</span
        ><span v-else-if="intent.kind === 'item'"> #{{ intent.itemId }}</span>
      </li>
    </ol>
    <div class="row">
      <button
        v-for="[dx, dy, label] in dirs"
        :key="label"
        :disabled="busy || !!state.decision"
        @click="append('move', dx, dy)"
      >
        {{ label }}</button
      ><button :disabled="busy || !!state.decision" @click="append('wait')">
        {{ t('ext.party.plan.wait') }}</button
      ><button :disabled="busy || !!state.decision" @click="append('search')">
        {{ t('ext.party.plan.search') }}
      </button>
    </div>
    <div class="row">
      <button :disabled="busy || !!state.decision" @click="undo()">
        {{ t('ext.party.plan.undo') }}</button
      ><button :disabled="busy || !!state.decision" @click="clear()">
        {{ t('ext.party.plan.clear') }}</button
      ><button :disabled="busy || !!state.decision" @click="keep()">
        {{ t('ext.party.plan.keep') }}
      </button>
    </div>
    <div class="row"><button data-party-travel :disabled="busy || !!state.decision" @click="pickTravel()">{{t('ext.party.plan.pickTravel')}}</button><button @click="cancelMap()">{{t('ext.party.ai.cancel_map')}}</button></div>
    <PartyWindowControls v-if="!hideControls" :disabled="busy || !!state.decision || state.phase === 'failed'" :advance="advance" :rehearse="rehearse"/>
    <p>{{t('ext.party.plan.mapLegend')}}</p>
    <ul data-party-paths><li v-for="path in paths" :key="path.actorId">#{{path.actorId}} · {{t(path.draft ? 'ext.party.plan.draft' : 'ext.party.plan.accepted')}} · {{t('ext.party.plan.path.'+path.status)}}<span v-if="path.target"> · {{path.target.x}},{{path.target.y}}</span></li></ul>
    <details>
      <summary>{{ t('ext.party.window.policy') }}</summary>
      <select v-model="empty" @change="policy(empty, reaction)">
        <option value="wait">{{ t('ext.party.plan.emptyWait') }}</option>
        <option value="interrupt">{{ t('ext.party.plan.emptyStop') }}</option></select
      ><select v-model="reaction" @change="policy(empty, reaction)">
        <option value="stop">{{ t('ext.party.window.stop') }}</option>
        <option value="ai-this-window">{{t('ext.party.ai.temporary')}}</option><option value="continue">{{ t('ext.party.window.continue') }}</option>
      </select>
    </details>
    <ol v-if="state.receipt?.interrupts.length">
      <li
        v-for="(fact, i) in state.receipt.interrupts"
        :key="i"
        :data-interrupted-actor="fact.actorId"
      >
        {{ t('ext.party.interrupt.' + fact.kind) }} <span v-if="fact.actorId">#{{ fact.actorId }}</span>
      </li>
    </ol>
    <div v-if="state.decision" class="decision" data-party-decision>
      {{ state.decision.prompt || t('ext.party.decision.' + state.decision.kind) }} #{{ state.decision.actorId }}
      <template v-if="state.decision.allowedChoiceIds.includes('yes')"
        ><button :disabled="busy" @click="choose('yes')">{{ t('ext.party.choice.yes') }}</button
        ><button :disabled="busy" @click="choose('no')">
          {{ t('ext.party.choice.no') }}
        </button></template
      >
      <template v-else
        ><select v-model="choices">
          <option value="">{{ t('ext.party.choice.select') }}</option>
          <option v-for="choice in state.decision.allowedChoiceIds" :key="choice" :value="choice">
            {{
              choice === 'cancel' || choice === 'close'
                ? t('ext.party.choice.cancel')
                : choice.startsWith('choice:')
                  ? t('ext.party.choice.dialogue', { id: choice.slice(7) })
                  : choice.startsWith('item:')
                    ? t('ext.party.choice.item', { id: choice.slice(5) })
                    : t('ext.party.choice.cell', { position: choice.slice(5) })
            }}
          </option></select
        ><button
          :disabled="busy || !state.decision.allowedChoiceIds.includes(choices)"
          @click="choose(choices)"
        >
          {{ t('ext.party.choice.apply') }}
        </button></template
      >
    </div>
    <div v-if="preview" data-party-preview-result>
      {{ t('ext.party.preview.uncertain') }}
      <div v-for="member in preview.members" :key="member.id">
        #{{ member.id }} → {{ member.x }},{{ member.y }} ·
        {{ t('ext.party.plan.steps', { count: member.actions }) }}
        {{ member.blocked ? t('ext.party.preview.blocked') : '' }}
      </div>
      <div v-for="warning in preview.warnings" :key="warning">
        {{ t('ext.party.preview.' + warning) }}
      </div>
      <button @click="cancelPreview()">{{ t('ext.party.choice.cancel') }}</button>
    </div>
  </section>
</template>
<style scoped>
.party-window {
  flex: 1 1 100%;
  max-width: 100%;
  font-size: 12px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 4px 0;
}
button,
select {
  font: inherit;
  min-height: 44px;
  max-width: 100%;
  color: inherit;
  background: #232923;
  border: 1px solid #777;
  padding: 4px;
}
button:disabled {
  opacity: 0.45;
}
.decision {
  border: 1px solid #ebd37a;
  padding: 6px;
}
ol {
  padding-left: 20px;
  max-height: 100px;
  overflow: auto;
}
</style>
