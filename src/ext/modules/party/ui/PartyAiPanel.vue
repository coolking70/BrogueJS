<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { PartyAiSettings, PartyAiInput, PartyOrder } from '../../../partyAi';
import type { PartyState } from '../../../party';
const props = defineProps<{
  state: PartyState;
  focused: number;
  depth: number;
  at: { x: number; y: number };
  companions: { id: number; name: string }[];
  enemies: { id: number; name: string }[];
  send: (change: PartyAiInput['change']) => void;
  temporary: () => void;
  step: () => void;
  leader: () => void;
  pickMap: (select: (at: { x: number; y: number }) => void) => void;
  cancelMap: () => void;
}>();
const { t } = useTranslation();
const settings = ref<PartyAiSettings>({
  tactic: 'follow',
  avoidDanger: true,
  autoPickup: false,
  consumables: false
});
const selected = ref<number[]>([]),
  kind = ref<PartyOrder['kind']>('gather'),
  x = ref(0),
  y = ref(0),
  target = ref(0);
watch(
  () => [props.focused, props.state.revision],
  () => {
    const m = props.state.members.find((m) => m.actorId === props.focused);
    if (m) settings.value = { ...m.ai.settings };
    x.value = props.at.x;
    y.value = props.at.y;
    selected.value = selected.value.filter(
      (id) =>
        props.state.members.some((m) => m.actorId === id) ||
        props.companions.some((m) => m.id === id)
    );
  },
  { immediate: true }
);
const member = () => props.state.members.find((m) => m.actorId === props.focused)!;
function control(ai: boolean) {
  props.send({
    kind: 'controller',
    actorId: props.focused,
    expectedEpoch: member().controlEpoch,
    controller: ai ? { kind: 'ai', policyId: 'party-ai-v1' } : { kind: 'human', slot: 'local:0' }
  });
}
function order(cancel = false) {
  props.send({
    kind: 'order',
    actorIds: [...selected.value],
    order: cancel
      ? null
      : kind.value === 'attack'
        ? { kind: 'attack', targetId: target.value }
        : kind.value === 'explore'
          ? { kind: 'explore', level: props.depth }
          : { kind: kind.value, level: props.depth, x: x.value, y: y.value }
  });
}
</script>
<template>
  <details class="party-ai" data-party-ai>
    <summary>{{ t('ext.party.ai.title') }} · #{{ focused }}</summary>
    <p>
      {{ t('ext.party.ai.' + member().controller.kind)
      }}<span v-if="member().pendingController">
        · {{ t('ext.party.ai.pending') }}
        {{ t('ext.party.ai.' + member().pendingController!.kind) }}</span
      ><span v-if="member().temporaryAiSeq !== null"> · {{ t('ext.party.ai.temporary') }}</span>
    </p>
    <button @click="leader()">{{ t('ext.party.ai.leader') }}</button
    ><button @click="control(true)">{{ t('ext.party.ai.delegate') }}</button
    ><button @click="control(false)">{{ t('ext.party.ai.takeover') }}</button
    ><button @click="temporary()">{{ t('ext.party.ai.temporary') }}</button>
    <label
      >{{ t('ext.party.ai.tactic')
      }}<select v-model="settings.tactic">
        <option
          v-for="v in ['follow', 'attack', 'distance', 'defend', 'still']"
          :key="v"
          :value="v"
        >
          {{ t('ext.party.ai.tactic.' + v) }}
        </option>
      </select></label
    >
    <label v-for="v in ['avoidDanger', 'autoPickup', 'consumables'] as const" :key="v"
      ><input v-model="settings[v]" type="checkbox" />{{ t('ext.party.ai.setting.' + v) }}</label
    >
    <button
      @click="
        send({
          kind: 'settings',
          actorId: focused,
          expectedEpoch: member().controlEpoch,
          settings: { ...settings }
        })
      "
    >
      {{ t('ext.party.ai.apply') }}
    </button>
    <p>{{ t('ext.party.ai.diagnostic.' + member().ai.diagnostic) }}</p>
    <fieldset>
      <legend>{{ t('ext.party.ai.recipients') }}</legend>
      <label v-for="m in state.members.filter((m) => m.life === 'active')" :key="m.actorId"
        ><input v-model="selected" type="checkbox" :value="m.actorId" />#{{ m.actorId }} ·
        {{ t('ext.party.ai.' + m.controller.kind) }}</label
      ><label v-for="m in companions" :key="m.id"
        ><input v-model="selected" type="checkbox" :value="m.id" />{{ m.name }} #{{ m.id }}</label
      >
    </fieldset>
    <select v-model="kind">
      <option v-for="v in ['gather', 'attack', 'guard', 'retreat', 'explore']" :key="v" :value="v">
        {{ t('ext.party.ai.order.' + v) }}
      </option>
    </select>
    <select v-if="kind === 'attack'" v-model.number="target">
      <option :value="0">—</option>
      <option v-for="e in enemies" :key="e.id" :value="e.id">{{ e.name }} #{{ e.id }}</option>
    </select>
    <template v-else-if="kind !== 'explore'"
      ><label>{{ t('ext.party.ai.x') }}<input v-model.number="x" type="number" min="0" /></label
      ><label>{{ t('ext.party.ai.y') }}<input v-model.number="y" type="number" min="0" /></label
      ><button
        @click="
          pickMap((at) => {
            x = at.x;
            y = at.y;
          })
        "
      >
        {{ t('ext.party.ai.pick_map') }}</button
      ><button @click="cancelMap()">{{ t('ext.party.ai.cancel_map') }}</button></template
    >
    <button :disabled="!selected.length" @click="order()">{{ t('ext.party.ai.issue') }}</button
    ><button :disabled="!selected.length" @click="order(true)">
      {{ t('ext.party.ai.cancel') }}
    </button>
    <button @click="step()">{{ t('ext.party.ai.step') }}</button>
    <p>{{ t('ext.party.ai.manual_hint') }}</p>
  </details>
</template>
<style scoped>
.party-ai {
  flex-basis: 100%;
  max-width: 100%;
  overflow-wrap: anywhere;
}
.party-ai label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 4px;
}
.party-ai input[type='number'] {
  width: 5em;
}
.party-ai button,
.party-ai select {
  min-height: 44px;
  max-width: 100%;
  font: inherit;
}
.party-ai fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}
</style>
