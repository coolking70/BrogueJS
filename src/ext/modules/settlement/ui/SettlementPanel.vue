<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { SettlementView } from './view';
import ResidentsPanel from './ResidentsPanel.vue';
import { loadSettlementPack } from '../definitions';
const props = defineProps<{
  model: SettlementView;
  tab: string;
  selected: string;
  cursor: { x: number; y: number };
  campTarget: { x: number; y: number };
  campBounds: {x: number; y: number; width: number; height: number};
  collapsed: boolean;
  draft: { x: number; y: number; definitionId: string }[];
  sourceId: number | null;
  materials: Record<string, string>;
  kitId: string | null;
  food: Record<number, number>;
  blocked: boolean;
  error: string | null;
  presentationHidden?: boolean;
  replayReadonly?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  collapse: [];
  campTarget: [number, number];
  tab: [string];
  select: [string];
  cursor: [number, number];
  append: [];
  clear: [];
  construct: [];
  food: [number, number];
  source: [number | null];
  material: [string, string];
  kit: [string | null];
  establish: [];
  expand: [string];
  retire: [];
  transfer: [number, number, number, 'deposit' | 'withdraw'];
  rest: [number];
  part: [string, number];
  harvest: [number];
  resident:[string,number,Record<string,unknown>];
}>();
const { t } = useTranslation(),
  boxId = ref<number | null>(null);
const panel = ref<HTMLElement | null>(null);
watch(
  () => props.presentationHidden,
  (hidden) => {
    if (hidden && typeof document !== 'undefined' && panel.value?.contains(document.activeElement))
      (document.activeElement as HTMLElement)?.blur();
  }
);
const pack = loadSettlementPack(),
  names = [...pack.world.items, ...pack.world.structures!];
const name = (id: string | null) => {
  const d = names.find((d) => d.id === id);
  return d ? t(d.nameKey) : t('ext.settlement.ui.item');
};
const camp = computed(() => props.model.camps.find((c) => !c.remote));
const box = computed(
  () => props.model.boxes.find((b) => b.id === boxId.value) ?? props.model.boxes[0]
);
const sourceItems = computed(() =>
  props.sourceId === null
    ? props.model.inventory
    : (props.model.boxes.find((b) => b.id === props.sourceId)?.items ?? [])
);
const costs = computed(() =>
  props.tab === 'build'
    ? (props.model.definitions.find((d) => d.id === props.selected)?.constructionCost ?? [])
    : camp.value
      ? props.model.policy.expandCost
      : props.model.policy.createCost
);
const options = (id: string) =>
  sourceItems.value
    .filter((i) => i.tags.includes('basic.' + id.split('.').pop()))
    .map((i) => ({ id: i.definitionId!, quantity: i.quantity, name: i.displayName }));
const totalFood = computed(() => Object.values(props.food).reduce((n, q) => n + q, 0));
const selectedDefinition = computed(() =>
  props.model.definitions.find((d) => d.id === props.selected)
);
const direction = [
  { id: 'n', dx: 0, dy: -1, glyph: '↑' },
  { id: 'w', dx: -1, dy: 0, glyph: '←' },
  { id: 'e', dx: 1, dy: 0, glyph: '→' },
  { id: 's', dx: 0, dy: 1, glyph: '↓' }
];
const tabs = computed(() => [
  { id: 'camp', label: t('ext.settlement.ui.tab.camp') },
  { id: 'build', label: t('ext.settlement.ui.tab.build') },
  { id: 'inventory', label: t('ext.settlement.ui.tab.inventory') },
  { id: 'harvest', label: t('ext.settlement.ui.tab.harvest') },
  { id: 'residents', label: t('ext.settlement.resident.title') }
]);
function number(event: Event) {
  return Number((event.target as HTMLInputElement).value);
}
</script>
<template>
  <Teleport to="body"
    ><section
      ref="panel"
      class="settlement-panel"
      data-map-drawer
      :class="{ 'is-collapsed': collapsed, 'presentation-hidden': presentationHidden }"
      :inert="presentationHidden || undefined"
      :aria-hidden="presentationHidden || undefined"
      tabindex="-1"
      @pointerdown.stop
      @pointerup.stop
      @click.stop
      @click.capture="
        if ($event.detail > 1) {
          $event.stopImmediatePropagation();
          $event.preventDefault();
        }
      "
      @touchstart.stop
      @touchend.stop
      @keydown.stop @keyup.stop @keydown.esc.prevent="emit('close')"
    >
      <header>
        <h2>{{ t('ext.settlement.ui.title') }}</h2>
        <button class="drawer-toggle" data-action="toggle-drawer" :aria-expanded="!collapsed" @click="emit('collapse')">
          {{ t(collapsed ? 'ext.settlement.ui.expand' : 'ext.settlement.ui.collapse') }}</button
        ><button @click="emit('close')">{{ t('ext.settlement.ui.close') }}</button>
      </header>
      <nav>
        <button
          v-for="a in tabs"
          :key="a.id"
          :class="{ chosen: tab === a.id }"
          @click="emit('tab', a.id)"
        >
          {{ a.label }}
        </button>
      </nav>
      <main>
        <template v-if="model.raids">
          <p v-for="r in model.raids.camps" :key="r.campId">{{ t('ext.settlement.raid.report', {id:r.campId,tick:r.reportedTick}) }} · {{ t(r.besieged ? 'ext.settlement.raid.besieged' : 'ext.settlement.raid.phase.'+(r.phase ?? 'quiet')) }}<span v-if="r.besieged"> · {{ t('ext.settlement.raid.paused') }}</span><span v-if="r.reason==='slots'"> · {{ t('ext.settlement.raid.slots') }}</span><span v-if="r.reason==='summary' && (r.phase==='aftermath' || r.phase==='closed')"> · {{ t('ext.settlement.raid.loss',{units:r.lostUnits,hp:r.damagedHp}) }}</span></p>
        </template>
        <p v-if="replayReadonly" class="replay-readonly">{{ t('ext.settlement.ui.replay_readonly') }}</p>
        <p v-if="error || model.lastError" class="error" role="alert">
          {{ t('ext.settlement.ui.rejected') }}
        </p>
        <template v-if="tab === 'camp' || tab === 'build'">
          <label
            >{{ t('ext.settlement.ui.source')
            }}<select
              :value="sourceId ?? ''"
              :disabled="blocked"
              @change="
                emit(
                  'source',
                  ($event.target as HTMLSelectElement).value === '' ? null : number($event)
                )
              "
            >
              <option value="">{{ t('ext.settlement.ui.backpack') }}</option>
              <option v-for="b in model.boxes" :key="b.id" :value="b.id">
                {{ t('ext.settlement.ui.box', { id: b.id }) }}
              </option>
            </select></label
          >
          <label v-for="cost in costs" :key="cost.itemDefinitionId"
            ><span>{{ name(cost.itemDefinitionId) }} ×{{ cost.count }}</span
            ><select
              :value="materials[cost.itemDefinitionId] ?? cost.itemDefinitionId"
              :disabled="blocked"
              @change="
                emit('material', cost.itemDefinitionId, ($event.target as HTMLSelectElement).value)
              "
            >
              <option :value="cost.itemDefinitionId">{{ name(cost.itemDefinitionId) }}</option>
              <option v-for="a in options(cost.itemDefinitionId)" :key="a.id" :value="a.id">
                {{ a.name }} ×{{ a.quantity }}
              </option>
            </select></label
          >
        </template>
        <template v-if="tab === 'camp'">
          <article v-if="!camp">
            <h3>{{ t('ext.settlement.ui.establish') }}</h3>
            <p>{{ t('ext.settlement.ui.food_rule') }}</p>
            <label v-for="i in model.inventory.filter((i) => i.food)" :key="i.id"
              ><span>{{
                t('ext.settlement.ui.food', { name: i.displayName, quantity: i.quantity })
              }}</span
              ><input
                type="number"
                min="0"
                :max="Math.min(2, i.quantity)"
                :value="food[i.id] ?? 0"
                :disabled="blocked"
                @input="emit('food', i.id, Math.max(0, Math.min(2, i.quantity, number($event))))"
            /></label>
            <p>{{ t('ext.settlement.ui.target', campTarget) }}</p>
            <label>{{ t('ext.settlement.ui.target_x') }}<input type="number" min="1" max="77" :value="campTarget.x" :disabled="blocked" @input="emit('campTarget', number($event), campTarget.y)" /></label>
            <label>{{ t('ext.settlement.ui.target_y') }}<input type="number" min="1" max="27" :value="campTarget.y" :disabled="blocked" @input="emit('campTarget', campTarget.x, number($event))" /></label>
            <p>{{ t('ext.settlement.ui.target_hint') }}</p>
            <p>{{ t('ext.settlement.ui.target_bounds', campBounds) }}</p>
            <div class="directions"><button v-for="d in direction" :key="d.id" :disabled="blocked" @click="emit('cursor', d.dx, d.dy)">{{ d.glyph }}</button></div>
            <button :disabled="blocked || totalFood !== 2" @click="emit('establish')">
              {{ t('ext.settlement.ui.establish_cost') }}
            </button>
          </article>
          <article v-else>
            <h3>{{ t('ext.settlement.ui.local', { depth: camp.depth }) }}</h3>
            <p>
              {{
                t('ext.settlement.ui.bounds', {
                  width: camp.bounds.width,
                  height: camp.bounds.height
                })
              }}
            </p>
            <p>
              {{
                t('ext.settlement.ui.locked', {
                  quantity: camp.locked.reduce((n, l) => n + l.quantity, 0)
                })
              }}
            </p>
            <div class="directions">
              <button
                v-for="d in direction"
                :key="d.id"
                :disabled="blocked"
                @click="emit('expand', d.id)"
              >
                {{ d.glyph }} {{ t('ext.settlement.ui.expand_cost') }}
              </button>
            </div>
            <button
              v-for="r in model.restPoints"
              :key="r.interactableId"
              :disabled="blocked"
              @click="emit('rest', r.interactableId)"
            >
              {{ t('ext.settlement.ui.rest') }}</button
            ><button :disabled="blocked" @click="emit('retire')">
              {{ t('ext.settlement.ui.retire') }}
            </button>
          </article>
          <article v-for="c in model.camps.filter((c) => c.remote)" :key="c.regionId">
            <h3>{{ t('ext.settlement.ui.remote', { depth: c.depth, tick: c.reportTick }) }}</h3>
            <p v-for="i in c.reportItems" :key="i.itemId">{{ i.name }} ×{{ i.quantity }}</p>
          </article>
        </template>
        <template v-else-if="tab === 'build'">
          <select
            :value="selected"
            :disabled="blocked"
            @change="emit('select', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="d in model.definitions" :key="d.id" :value="d.id">
              {{ t(d.nameKey) }} · {{ d.constructionTicks }}
            </option>
          </select>
          <label
            v-if="
              selectedDefinition?.tags.includes('bed') ||
              (selectedDefinition?.containerCapacity !== null &&
                selectedDefinition?.containerCapacity !== undefined)
            "
            >{{ t('ext.settlement.ui.kit')
            }}<select
              :value="kitId ?? ''"
              :disabled="blocked"
              @change="emit('kit', ($event.target as HTMLSelectElement).value || null)"
            >
              <option value="">{{ t('ext.settlement.ui.material_bill') }}</option>
              <option
                v-for="i in sourceItems.filter((i) =>
                  i.tags.includes(
                    selectedDefinition?.tags.includes('bed') ? 'kit.bed' : 'kit.chest'
                  )
                )"
                :key="i.id"
                :value="i.definitionId!"
              >
                {{ i.displayName }} ×{{ i.quantity }}
              </option>
            </select></label
          >
          <p>{{ t('ext.settlement.ui.build_hint') }}</p>
          <p>
            {{ t('ext.settlement.ui.target', { x: cursor.x, y: cursor.y }) }} ·
            {{
              t('ext.settlement.ui.ticks', { ticks: selectedDefinition?.constructionTicks ?? 0 })
            }}
          </p>
          <div class="directions">
            <button
              v-for="d in direction"
              :key="d.id"
              :disabled="blocked"
              @click="emit('cursor', d.dx, d.dy)"
            >
              {{ d.glyph }}
            </button>
          </div>
          <button :disabled="blocked || draft.length >= 16 || !camp" @click="emit('append')">
            {{ t('ext.settlement.ui.append', { count: draft.length }) }}
          </button>
          <ol>
            <li v-for="(p, index) in draft" :key="index">
              {{ name(p.definitionId) }} ({{ p.x }},{{ p.y }})
            </li>
          </ol>
          <div class="actions">
            <button @click="emit('clear')">{{ t('ext.settlement.ui.clear') }}</button
            ><button :disabled="blocked || !draft.length" @click="emit('construct')">
              {{ t('ext.settlement.ui.construct') }}
            </button>
          </div>
          <article v-for="c in model.components" :key="c.id">
            <h3>{{ t(c.nameKey) }} ({{ c.at.x }},{{ c.at.y }})</h3>
            <p>{{ t('ext.settlement.ui.hp', { hp: c.hp }) }}</p>
            <button
              v-if="c.doorOpen !== null"
              :disabled="blocked"
              @click="emit('part', 'door', c.id)"
            >
              {{
                t(c.doorOpen ? 'ext.settlement.ui.door.close' : 'ext.settlement.ui.door.open')
              }}</button
            ><button v-if="c.hp < (model.definitions.find(d=>d.id===c.definitionId)?.maxHp ?? c.hp)" :disabled="blocked" @click="emit('part','repair',c.id)">{{ t('ext.settlement.raid.repair') }}</button><button :disabled="blocked" @click="emit('part', 'dismantle', c.id)">
              {{ t('ext.settlement.ui.dismantle') }}
            </button>
          </article>
        </template>
        <template v-else-if="tab === 'inventory'">
          <select :value="box?.id ?? ''" @change="boxId = number($event)">
            <option v-for="b in model.boxes" :key="b.id" :value="b.id">
              {{ t('ext.settlement.ui.box', { id: b.id }) }} · {{ b.occupiedSlots }}/{{
                b.capacity
              }}
            </option>
          </select>
          <template v-if="box"
            ><h3>{{ t('ext.settlement.ui.withdraw') }}</h3>
            <article v-for="i in box.items" :key="i.id">
              <strong>{{ i.displayName }} ×{{ i.quantity }}</strong>
              <p v-if="i.lockedQuantity">
                {{ t('ext.settlement.ui.locked', { quantity: i.lockedQuantity }) }}
              </p>
              <button
                :disabled="blocked || i.quantity <= i.lockedQuantity"
                @click="emit('transfer', box.id, i.id, i.quantity - i.lockedQuantity, 'withdraw')"
              >
                {{ t('ext.settlement.ui.withdraw') }}
              </button>
            </article>
            <h3>{{ t('ext.settlement.ui.deposit') }}</h3>
            <article v-for="i in model.inventory" :key="i.id">
              <strong>{{ i.displayName }} ×{{ i.quantity }}</strong>
              <div class="actions">
                <button :disabled="blocked" @click="emit('transfer', box.id, i.id, 1, 'deposit')">
                  {{ t('ext.settlement.ui.one') }}</button
                ><button
                  :disabled="blocked"
                  @click="emit('transfer', box.id, i.id, i.quantity, 'deposit')"
                >
                  {{ t('ext.settlement.ui.all') }}
                </button>
              </div>
            </article></template
          >
          <p v-else>{{ t('ext.settlement.ui.no_box') }}</p>
        </template>
        <ResidentsPanel v-else-if="tab==='residents'" :model="model" :blocked="blocked" :cursor="cursor" @command="(action,id,extra)=>emit('resident',action,id,extra)" />
        <template v-else
          ><article v-for="n in model.nodes" :key="n.interactableId">
            <h3>{{ t(n.nameKey) }}</h3>
            <p>{{ n.remaining }}/{{ n.capacity }}</p>
            <button :disabled="blocked" @click="emit('harvest', n.interactableId)">
              {{ t('ext.settlement.ui.harvest') }}
            </button>
          </article></template
        >
      </main>
      <footer>
        <button @click="emit('close')">{{ t('ext.settlement.ui.close') }}</button>
      </footer>
    </section></Teleport
  >
</template>
<style scoped>
:global(html body:has(.settlement-panel:not(.presentation-hidden)) .app-layout.theme-shell) {
  width: calc(100vw - 370px) !important;
}
.settlement-panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 370px;
  max-width: 100vw;
  z-index: 900;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  border-left: 1px solid var(--th-line, #555);
  background: var(--th-panel, #171918);
  color: var(--th-fg, #e4dfd1);
  font: 14px var(--th-font, monospace);
  touch-action: pan-y;
}
.presentation-hidden {
  visibility: hidden;
  pointer-events: none;
}
.settlement-panel * {
  box-sizing: border-box;
  min-width: 0;
}
.settlement-panel button,
.settlement-panel select,
.settlement-panel input {
  min-height: 44px;
  max-width: 100%;
  padding: 8px;
  background: var(--th-panel, #171918);
  color: inherit;
  border: 1px solid var(--th-line, #555);
  font: inherit;
  touch-action: manipulation;
}
.settlement-panel button:disabled {
  opacity: 0.4;
}
header,
footer {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  flex: none;
}
header h2 {
  font-size: 16px;
  margin: 0;
  overflow-wrap: anywhere;
}
nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  flex: none;
}
nav button {
  padding: 4px;
}
.chosen {
  border-color: var(--th-accent, #d4bd79) !important;
}
main {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 10px;
  overscroll-behavior: contain;
}
article {
  border: 1px solid var(--th-line, #555);
  padding: 8px;
  margin: 8px 0;
}
h3 {
  font-size: 14px;
  margin: 4px 0;
}
p,
li,
strong,
label {
  overflow-wrap: anywhere;
  line-height: 1.5;
  font-size: 12px;
}
label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 5px 0;
}
label > span {
  flex: 1;
}
label select {
  width: 60%;
}
input {
  width: 70px;
}
main > select {
  width: 100%;
}
.actions,
.directions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.directions button {
  flex: 1;
}
.error {
  color: var(--th-warn, #e3aa76);
}
footer {
  border-top: 1px solid var(--th-line, #555);
}
.drawer-toggle { display: none; }
@media (max-width: 700px) {
  .drawer-toggle { display: block; }
  :global(html body:has(.settlement-panel:not(.presentation-hidden)) .app-layout.theme-shell) {
    width: 100vw !important;
    height: calc(100dvh - min(36dvh, 320px)) !important;
    min-height: 0 !important;
  }
  .settlement-panel {
    top: auto;
    bottom: 0;
    width: 100vw;
    height: min(36dvh, 320px);
    border-left: 0;
    border-top: 1px solid var(--th-line, #555);
  }
  header {
    padding: 3px 8px;
  }
  .settlement-panel.is-collapsed {
    height: 52px;
  }
  .settlement-panel.is-collapsed nav,
  .settlement-panel.is-collapsed main,
  .settlement-panel.is-collapsed footer {
    display: none;
  }
  :global(
    html body:has(.settlement-panel.is-collapsed:not(.presentation-hidden)) .app-layout.theme-shell
  ) {
    height: calc(100dvh - 52px) !important;
  }
}
</style>
