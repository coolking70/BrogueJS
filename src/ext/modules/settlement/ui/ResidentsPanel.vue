<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { SettlementView } from './view';
const props = defineProps<{
  model: SettlementView;
  blocked: boolean;
  cursor?: { x: number; y: number };
}>();
const emit = defineEmits<{ command: [string, number, Record<string, unknown>] }>();
const { t } = useTranslation();
const source = ref<number | null>(null),
  destination = ref<number | null>(null),
  itemId = ref<number | null>(null),
  quantity = ref(1),
  plots = ref<number[]>([]),
  selectedId = ref<number | null>(null),
  recipeId = ref('settlement.hunt'),
  stationId = ref<number | null>(null),
  batches = ref(1),
  work = ref(16),
  rest = ref(8);
const visibleBoxes = computed(() => props.model.boxes.filter((b) => b.kind === 'chest'));
const targets = computed(() =>
  props.model.jobTargets?.find((t) => t.campId === active.value?.campId)
);
const boxes = computed(() => targets.value?.boxes ?? []);
const jobPlots = computed(() => targets.value?.plots ?? []);
// Haul Item IDs/quantities still come only from the ordinary visible projection.
const items = computed(() => props.model.boxes.find((b) => b.id === source.value)?.items ?? []);
const active = computed(() =>
  props.model.residents?.residents.find((a) => a.id === selectedId.value)
);
const guard = computed(() => props.cursor ?? props.model.at);
const productionOrder = computed(() =>
  props.model.production?.orders.find((o) => o.actorId === active.value?.id)
);
const resetDraft = () => {
  stationId.value = null;
  source.value = destination.value = itemId.value = null;
  plots.value = [];
};
watch([() => selectedId.value, () => active.value?.campId], () => {
  resetDraft();
  work.value = active.value?.schedule[0] ?? 16;
  rest.value = active.value?.schedule[1] ?? 8;
});
watch(source, () => {
  itemId.value = null;
});
watch(
  () => props.blocked,
  (b) => {
    if (b) resetDraft();
  }
);
// Retire drafts if a selected endpoint disappears or any target/resident CAS
// token changes. Model refreshes with identical tokens preserve user choices.
watch(
  () =>
    JSON.stringify([
      props.model.available,
      active.value?.revision,
      targets.value,
      props.model.boxes.map((b) => [b.id, b.items.map((i) => [i.id, i.quantity, i.lockedQuantity])])
    ]),
  resetDraft
);
const camp = computed(() => props.model.camps.find((c) => !c.remote));
const atHome = (a: { campId: number; at: { x: number; y: number } }) => {
  const c = props.model.camps.find((c) => c.regionId === a.campId);
  return (
    !!c &&
    c.depth === props.model.depth &&
    a.at.x >= c.bounds.x &&
    a.at.x < c.bounds.x + c.bounds.width &&
    a.at.y >= c.bounds.y &&
    a.at.y < c.bounds.y + c.bounds.height
  );
};
const nearby = (at: { x: number; y: number }) =>
  Math.max(Math.abs(at.x - props.model.at.x), Math.abs(at.y - props.model.at.y)) <= 1;
watch(
  () => props.model.depth,
  () => {
    selectedId.value = null;
    resetDraft();
  }
);
watch(
  () => props.model.residents?.residents.map((a) => a.id),
  (ids) => {
    if (selectedId.value !== null && !ids?.includes(selectedId.value)) selectedId.value = null;
  }
);
function order(id: number, kind: string) {
  const job =
    kind === 'plant'
      ? { kind, plotIds: plots.value, sourceId: source.value, destinationId: destination.value }
      : kind === 'haul'
        ? {
            kind,
            sourceId: source.value,
            destinationId: destination.value,
            itemId: itemId.value,
            quantity: quantity.value
          }
        : kind === 'guard'
          ? { kind, at: { ...guard.value } }
          : { kind: 'idle' };
  emit('command', 'assign-job', id, { job });
}
</script>
<template>
  <section class="residents" data-residents>
    <h3>{{ t('ext.settlement.resident.title') }}</h3>
    <p>
      {{
        t('ext.settlement.resident.clock', {
          day: Math.floor((model.residents?.tick ?? 0) / 32000),
          tick: model.residents?.tick ?? 0
        })
      }}
    </p>
    <p>{{ t('ext.settlement.resident.hint') }}</p>
    <article v-for="a in model.residents?.candidates ?? []" :key="a.id" :data-candidate="a.id">
      <strong>{{ a.name }}</strong>
      <button
        :disabled="blocked || !camp || !nearby(a.at)"
        data-action="recruit"
        @click="emit('command', 'recruit', a.id, {})"
      >
        {{ t('ext.settlement.resident.recruit') }}
      </button>
    </article>
    <p v-if="!model.residents?.residents.length">{{ t('ext.settlement.resident.empty') }}</p>
    <div class="roster">
      <button
        v-for="a in model.residents?.residents ?? []"
        :key="a.id"
        :data-select-resident="a.id"
        :aria-pressed="selectedId === a.id"
        @click="selectedId = a.id"
      >
        {{ a.name }} · {{ t('ext.settlement.resident.mode.' + a.mode) }}
      </button>
    </div>
    <p v-if="model.residents?.residents.length && !active">
      {{ t('ext.settlement.resident.select_hint') }}
    </p>
    <fieldset v-if="active" :disabled="blocked">
      <legend>{{ t('ext.settlement.resident.job_settings') }}</legend>
      <label
        >{{ t('ext.settlement.resident.source')
        }}<select v-model="source">
          <option :value="null">{{ t('ext.settlement.resident.choose') }}</option>
          <option v-for="b in boxes" :key="b.id" :value="b.id">
            {{ t('ext.settlement.ui.box', { id: b.id }) }}
          </option>
        </select></label
      >
      <label
        >{{ t('ext.settlement.resident.destination')
        }}<select v-model="destination">
          <option :value="null">{{ t('ext.settlement.resident.choose') }}</option>
          <option v-for="b in boxes" :key="b.id" :value="b.id">
            {{ t('ext.settlement.ui.box', { id: b.id }) }}
          </option>
        </select></label
      >
      <label
        >{{ t('ext.settlement.resident.item')
        }}<select v-model="itemId">
          <option :value="null">{{ t('ext.settlement.resident.choose') }}</option>
          <option v-for="i in items" :key="i.id" :value="i.id">
            {{ i.displayName }} ×{{ i.quantity - i.lockedQuantity }}
          </option>
        </select></label
      >
      <label
        >{{ t('ext.settlement.resident.quantity')
        }}<input v-model.number="quantity" type="number" min="1" max="8"
      /></label>
      <label v-for="p in jobPlots" :key="p.id"
        ><input v-model="plots" type="checkbox" :value="p.id" />{{ t(p.nameKey) }} ({{ p.at.x }},{{
          p.at.y
        }})</label
      >
      <label
        >{{ t('ext.settlement.production.recipe')
        }}<select v-model="recipeId">
          <option v-for="r in model.production?.recipes ?? []" :key="r.id" :value="r.id">
            {{ t(r.nameKey) }}
          </option>
        </select></label
      >
      <label
        >{{ t('ext.settlement.production.station')
        }}<select v-model="stationId">
          <option :value="null">{{ t('ext.settlement.resident.choose') }}</option>
          <option v-for="s in model.production?.stations ?? []" :key="s.id" :value="s.id">
            {{ s.id }} ·
            {{
              t(
                s.definitionId === 'settlement.hearth-station'
                  ? 'ext.settlement.hearth.name'
                  : 'ext.settlement.production.station'
              )
            }}
          </option>
        </select></label
      >
      <label
        >{{ t('ext.settlement.resident.quantity')
        }}<select v-model.number="batches">
          <option v-for="n in 16" :key="n" :value="n">{{ n }}</option>
        </select></label
      >
      <p>{{ t('ext.settlement.resident.guard_target', { x: guard.x, y: guard.y }) }}</p>
      <p>{{ t('ext.settlement.resident.guard_hint') }}</p>
      <label
        >{{ t('ext.settlement.resident.work')
        }}<input v-model.number="work" type="number" min="1" max="30"
      /></label>
      <label
        >{{ t('ext.settlement.resident.rest')
        }}<input v-model.number="rest" type="number" min="1" max="30"
      /></label>
      <p>{{ t('ext.settlement.resident.watch', { epochs: 32 - work - rest }) }}</p>
    </fieldset>
    <article v-for="a in active ? [active] : []" :key="a.id" :data-resident="a.id">
      <h4>{{ a.name }} · {{ t('ext.settlement.resident.mode.' + a.mode) }}</h4>
      <p>
        {{
          t('ext.settlement.resident.needs', {
            food: a.foodShortage,
            housing: a.housingShortage,
            efficiency: a.efficiency
          })
        }}
      </p>
      <p>
        {{
          t('ext.settlement.resident.bed', { bed: a.bedId ?? t('ext.settlement.resident.no_bed') })
        }}
        · {{ t('ext.settlement.resident.job.' + a.job.kind) }}
      </p>
      <p>
        {{
          t('ext.settlement.resident.schedule', {
            work: a.schedule[0],
            rest: a.schedule[1],
            watch: a.schedule[2]
          })
        }}
      </p>
      <p v-if="a.work">
        {{
          t('ext.settlement.resident.credit', {
            credit: a.work.creditTicks,
            phase: t('ext.settlement.resident.phase.' + a.work.phase)
          })
        }}
      </p>
      <p v-if="a.stopReason">
        {{
          t('ext.settlement.resident.stopped.' + a.stopReason, {
            defaultValue: t('ext.settlement.resident.stopped.blocked')
          })
        }}
      </p>
      <p v-if="productionOrder">
        {{
          t('ext.settlement.production.ticket', {
            id: productionOrder.id,
            ticket: productionOrder.ticketId ?? '—',
            status: t(
              'ext.settlement.production.' + (productionOrder.stopReason ?? productionOrder.status),
              { defaultValue: productionOrder.status }
            )
          })
        }}
      </p>
      <p v-if="productionOrder">
        {{
          t('ext.settlement.production.epochs', {
            epochs: productionOrder.remainingEpochs,
            done: productionOrder.completedBatches,
            total: productionOrder.batchCount
          })
        }}
      </p>
      <p v-if="productionOrder">
        {{
          t('ext.settlement.production.endpoints', {
            source: productionOrder.sourceId,
            destination: productionOrder.destinationId,
            station: productionOrder.stationId ?? '—'
          })
        }}
      </p>
      <div class="actions">
        <button
          data-action="order-work"
          :disabled="
            blocked ||
            !nearby(a.at) ||
            !atHome(a) ||
            !!productionOrder ||
            !source ||
            !destination ||
            batches < 1 ||
            batches > 16
          "
          @click="
            emit('command', 'order-work', a.id, {
              recipeId,
              batchCount: batches,
              sourceId: source,
              destinationId: destination,
              stationId,
              plotIds: recipeId === 'settlement.farm' ? plots : []
            })
          "
        >
          {{ t('ext.settlement.production.order') }}
        </button>
        <button
          v-if="productionOrder"
          data-action="resupply-work"
          :disabled="blocked || !nearby(a.at) || !atHome(a) || productionOrder.status === 'working'"
          @click="emit('command', 'resupply-work', a.id, {})"
        >
          {{ t('ext.settlement.production.resupply') }}
        </button>
        <button
          v-if="productionOrder"
          data-action="cancel-order"
          :disabled="blocked || !nearby(a.at) || !atHome(a)"
          @click="emit('command', 'cancel-order', a.id, {})"
        >
          {{ t('ext.settlement.production.cancel_order') }}
        </button>
        <button
          :disabled="blocked || !nearby(a.at) || (a.mode === 'escort' && !atHome(a))"
          @click="
            emit('command', 'set-residence', a.id, { mode: a.mode === 'stay' ? 'escort' : 'stay' })
          "
        >
          {{
            t(a.mode === 'stay' ? 'ext.settlement.resident.escort' : 'ext.settlement.resident.stay')
          }}
        </button>
        <button
          :disabled="blocked || !nearby(a.at) || !atHome(a)"
          @click="emit('command', 'return-home', a.id, {})"
        >
          {{ t('ext.settlement.resident.return') }}
        </button>
        <button
          v-for="kind in ['idle', 'plant', 'haul', 'guard']"
          :key="kind"
          :disabled="
            blocked ||
            !nearby(a.at) ||
            !atHome(a) ||
            (kind === 'plant' &&
              (!source || !destination || plots.length === 0 || plots.length > 6)) ||
            (kind === 'haul' && (!source || !destination || source === destination || !itemId))
          "
          @click="order(a.id, kind)"
        >
          {{ t('ext.settlement.resident.job.' + kind) }}
        </button>
        <button
          :disabled="blocked || !nearby(a.at) || work < 1 || rest < 1 || work + rest >= 32"
          @click="
            emit('command', 'set-schedule', a.id, { schedule: [work, rest, 32 - work - rest] })
          "
        >
          {{ t('ext.settlement.resident.set_schedule') }}
        </button>
        <button
          :disabled="blocked || !nearby(a.at)"
          @click="emit('command', 'dismiss-resident', a.id, {})"
        >
          {{ t('ext.settlement.resident.dismiss') }}
        </button>
      </div>
    </article>
    <h4>{{ t('ext.settlement.resident.granaries') }}</h4>
    <button
      v-for="b in visibleBoxes"
      :key="b.id"
      :disabled="blocked || !camp || !b.at || !nearby(b.at) || b.id === camp.supplyId"
      :data-granary="b.id"
      @click="emit('command', 'set-granary', b.id, { enabled: !camp?.granaryIds.includes(b.id) })"
    >
      {{ t('ext.settlement.ui.box', { id: b.id }) }} ·
      {{
        t(
          camp?.granaryIds.includes(b.id)
            ? 'ext.settlement.resident.granary_yes'
            : 'ext.settlement.resident.granary_no'
        )
      }}
    </button>
  </section>
</template>
<style scoped>
.residents {
  display: grid;
  gap: 12px;
  min-width: 0;
}
article,
fieldset {
  border: 1px solid var(--th-line);
  padding: 8px;
  min-width: 0;
  overflow-wrap: anywhere;
}
label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 6px 0;
}
.residents input,
.residents select {
  box-sizing: border-box;
  min-height: 44px;
  max-width: 65%;
  min-width: 44px;
  flex-shrink: 0;
  font: inherit;
}
.residents button {
  box-sizing: border-box;
  min-height: 44px;
  min-width: 44px;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  font: inherit;
  color: var(--th-fg);
  background: var(--th-panel);
  border: 1px solid var(--th-line);
  padding: 6px;
}
.actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
h4,
p {
  margin: 6px 0;
}
.roster {
  display: grid;
  gap: 6px;
}
.roster button {
  text-align: left;
  overflow-wrap: anywhere;
}
label {
  min-height: 44px;
  flex-wrap: wrap;
}
.residents input[type='checkbox'] {
  min-height: 24px;
  flex-shrink: 0;
  min-width: 24px;
}
button[aria-pressed='true'] {
  border-color: var(--th-accent);
}
button:disabled {
  opacity: 0.45;
}
</style>
