<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useTranslation } from "i18next-vue";
import { inputManager } from "../engine/Input";
import MapTileLegend from './MapTileLegend.vue';
import { mapMode, selectMapMode, isMapMode } from '../ui/mapTiles';
import TitleFx from "./theme/TitleFx.vue";
import { normalizeSeed } from "../engine/Seed";
import type { RuleSet } from '../ext/types';
import GrowthCreationPanel from './growth/GrowthCreationPanel.vue';
import { loadGrowthCreationContext, createGrowthCreationDraft, selectGrowthCreationIdentity, adjustGrowthCreationChoice, readGrowthCreationView, buildGrowthCreationCommands, type GrowthCreationContext } from '../ext/modules/growth/view';
import type { GrowthIdentitySelection } from '../ext/modules/growth/identities';
import type { GrowthIdentity } from '../ext/modules/growth/types';
import type { GameMode } from "../engine/Core/Game";
import {
  displaySettings,
  isMapScaleMode,
  isSidebarWidthMode,
} from "../engine/Settings";

const props = defineProps<{
  hasSave: boolean;
  hasReplay: boolean;
  inGame: boolean;
  canSaveReplay?: boolean;
  replayBusy?: boolean;
  replayFeedback?: string;
  saveInfo: {
    depth: number;
    seed: string;
    mode: string;
    savedAt: number;
  } | null;
  replayInfo: {
    status: string;
    cursor: number;
    total: number;
  } | null;
}>();

const emit = defineEmits<{
  (e: "new-game", payload: { seed?: string; mode: GameMode; ruleSet?: RuleSet; initialCommands?: readonly string[]; onRejected?: () => void }): void;
  (e: "continue-game"): void;
  (e: "save-game"): void;
  (e: "delete-save"): void;
  (e: "save-replay"): void;
  (e: "load-replay"): void;
  (e: "delete-replay"): void;
  (e: "replay-play"): void;
  (e: "replay-pause"): void;
  (e: "replay-step"): void;
  (e: "replay-restart"): void;
  (e: "replay-seek", payload: number): void;
  (e: "export-replay-json"): void;
  (e: "export-current-replay-json"): void;
  (e: "import-replay-json", payload: File): void;
  (e: "close"): void;
}>();

const page = ref<"home" | "new" | "saves" | "records" | "settings">("home");
const legendOpen = ref(false);
/** The original wordmark bitmap; SVG grid cells replace font-dependent blocks. */
const glyphWordmark = [
  "11110011110001110001111010001011111",
  "10001010001010001010000010001010000",
  "11110011110010001010011010001011110",
  "10001010010010001010001010001010000",
  "11110010001001110001111001110011111",
];
const glyphColumns = glyphWordmark[0]!.length;
const glyphViewBox = `0 0 ${glyphColumns * 3} ${glyphWordmark.length * 5}`;
// 3:5 cells retain the old monospace silhouette, with exact shared boundaries.
const glyphPixels = glyphWordmark.flatMap((row, y) =>
  [...row].flatMap((pixel, x) => pixel === "1" ? [{ x: x * 3, y: y * 5 }] : []));
function goBack() {
  if (creationContext.value) { cancelCreation(); return; }
  if (legendOpen.value) { legendOpen.value = false; return; }
  if (page.value !== "home") page.value = "home";
  else if (props.inGame) emit("close");
}
const mode = ref<GameMode>("normal");
const ruleSet = ref<RuleSet>('classic');
const seedInput = ref("");
const replaySeekInput = ref<string | number>("");
const replayFileInput = ref<HTMLInputElement | null>(null);
const menuCard = ref<HTMLElement | null>(null);
let removeMenuKeyboard: (() => void) | undefined;
onMounted(() => {
  menuCard.value?.focus();
  removeMenuKeyboard = inputManager.registerModalKeyHandler((event) => {
    if (event.key === "Escape") { event.preventDefault(); goBack(); }
    return true;
  }, 1000);
});
onUnmounted(() => removeMenuKeyboard?.());
watch(page, async () => { legendOpen.value = false; await nextTick(); menuCard.value?.focus(); });
const { t } = useTranslation();
const editionText = computed(() => t("title.edition"));
const seedPlaceholder = computed(() => t("menu.seed.placeholder"));
const seekPlaceholder = computed(() => t("menu.replay.seek_placeholder"));

const parsedSeed = computed(() => {
  const trimmed = seedInput.value.trim();
  if (!trimmed || mode.value === "test") return undefined;
  try {
    return normalizeSeed(trimmed);
  } catch {
    return null;
  }
});

const creationContext = shallowRef<GrowthCreationContext | null>(null);
const creationDraft = shallowRef<GrowthIdentitySelection | null>(null);
const creationSubmitting = ref(false), creationError = ref<string | null>(null);
const creationModel = computed(() => creationContext.value && creationDraft.value ? readGrowthCreationView(creationContext.value.pack, creationDraft.value) : null);
function cancelCreation() {
  if (creationSubmitting.value) return;
  creationContext.value = null; creationDraft.value = null; creationError.value = null;
  void nextTick(() => menuCard.value?.focus({ preventScroll: true }));
}
function selectIdentity(kind: GrowthIdentity['kind'], id: string) {
  if (!creationContext.value || !creationDraft.value || creationSubmitting.value) return;
  creationDraft.value = selectGrowthCreationIdentity(creationContext.value.pack, creationDraft.value, kind, id); creationError.value = null;
}
function adjustIdentityChoice(identityId: string, choiceIndex: number, attributeId: string, delta: number) {
  if (!creationContext.value || !creationDraft.value || creationSubmitting.value) return;
  creationDraft.value = adjustGrowthCreationChoice(creationContext.value.pack, creationDraft.value, identityId, choiceIndex, attributeId, delta); creationError.value = null;
}
function submitCreation() {
  if (!creationContext.value || !creationDraft.value || creationSubmitting.value || parsedSeed.value === null || !creationModel.value?.valid) return;
  const initialCommands = buildGrowthCreationCommands(creationContext.value, creationDraft.value);
  if (!initialCommands) { creationError.value = 'ext.growth.creation.invalid'; return; }
  // Latch before emitting: repeated clicks/Enter cannot create a second run.
  creationSubmitting.value = true;
  emit('new-game', { seed: parsedSeed.value, mode: mode.value, ruleSet: 'extended', initialCommands,
    onRejected: () => { creationSubmitting.value = false; creationError.value = 'ext.growth.creation.start_failed'; } });
}
const startGame = () => {
  if (parsedSeed.value === null || creationSubmitting.value || creationContext.value) return;
  if (ruleSet.value === 'extended') {
    try {
      const context = loadGrowthCreationContext(), draft = createGrowthCreationDraft(context.pack);
      creationContext.value = context; creationDraft.value = draft; creationError.value = null;
    } catch { creationError.value = 'ext.growth.creation.unavailable'; }
    return;
  }
  emit('new-game', { seed: parsedSeed.value, mode: mode.value });
};

const modeLabel = (value: string) =>
  t(`menu.mode.${value}`, { defaultValue: value });

const triggerReplayImport = () => {
  replayFileInput.value?.click();
};

const onReplayFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  emit("import-replay-json", file);
  input.value = "";
};

const seekReplay = () => {
  const n = Number.parseInt(String(replaySeekInput.value).trim(), 10);
  if (!Number.isFinite(n)) return;
  emit("replay-seek", n);
};

watch(mode, (m) => {
  if (m === "test") {
    seedInput.value = "";
  }
});

// P2-6 显示设置：直接读写全局响应式 store（Settings.ts 内自动持久化），
// 变更即时生效（GameCanvas 的 watch / Sidebar 的 computed 均会跟随），
// 无需事件冒泡到 App.vue，也无需刷新页面。select 产出 string，
// 经类型守卫收窄后再写入，避免非法值进 store。
const mapScaleModel = computed({
  get: () => displaySettings.mapScaleMode,
  set: (v: string) => {
    if (isMapScaleMode(v)) displaySettings.mapScaleMode = v;
  },
});

const mapModeModel = computed({
  get: () => mapMode.value,
  set: (value: string) => { if (isMapMode(value)) selectMapMode(value); },
});

const sidebarWidthModel = computed({
  get: () => displaySettings.sidebarWidthMode,
  set: (v: string) => {
    if (isSidebarWidthMode(v)) displaySettings.sidebarWidthMode = v;
  },
});
</script>

<template>
  <div
    class="menu-overlay"
    :class="{ 'pause-overlay': inGame, 'subpage-open': page !== 'home', 'settings-open': page === 'settings' }"
    @keydown.stop
    @keyup.stop
    @keydown.esc.prevent="goBack"
  >
    <div v-if="!inGame" class="title-vignette" aria-hidden="true"></div>
    <TitleFx v-if="!inGame" />
    <div ref="menuCard" class="title-screen" tabindex="-1" :inert="!!creationContext">
      <div class="title-brand">
        <div class="title-edition">
          <span></span>{{ editionText }}<span></span>
        </div>
        <svg class="title-glyph" :viewBox="glyphViewBox"
             :width="glyphColumns * 3" :height="glyphWordmark.length * 5"
             preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"
             fill="currentColor" aria-hidden="true">
          <rect v-for="pixel in glyphPixels" :key="`${pixel.x},${pixel.y}`"
                :x="pixel.x" :y="pixel.y" width="3" height="5" />
        </svg>
        <h1>{{ t("title.brand") }}</h1>
      </div>
      <nav
        v-if="page === 'home'"
        class="title-menu"
        :aria-label="t('menu.actions.menu')"
      >
        <button
          v-if="inGame"
          class="title-action primary-action"
          @click="emit('close')"
        >
          <span class="action-mark">◆</span>{{ t("menu.actions.back")
          }}<kbd>{{ t("title.escape") }}</kbd>
        </button>
        <button
          class="title-action"
          :class="{ 'primary-action': !inGame }"
          @click="page = 'new'"
        >
          <span class="action-mark">◆</span>{{ t("menu.actions.new_game")
          }}<span class="action-detail">{{ t("title.new_detail") }}</span>
        </button>
        <button
          class="title-action"
          :disabled="!hasSave || replayBusy"
          @click="emit('continue-game')"
        >
          <span class="action-mark">◆</span>{{ t("menu.actions.continue")
          }}<span class="action-detail">{{
            hasSave
              ? t("sidebar.depth", { depth: saveInfo?.depth })
              : t("title.no_save")
          }}</span>
        </button>
        <button class="title-action" @click="page = 'saves'">
          <span class="action-mark">◆</span>{{ t("title.saves") }}
        </button>
        <button class="title-action" @click="page = 'records'">
          <span class="action-mark">◆</span>{{ t("menu.replay.title") }}
        </button>
        <button class="title-action" @click="page = 'settings'">
          <span class="action-mark">◆</span>{{ t("title.settings") }}
        </button>
      </nav>
      <section v-else class="menu-card" :class="{ 'settings-card': page === 'settings' }" :aria-label="t('menu.actions.menu')">
        <header class="menu-section-header">
          <button class="back-button" @click="page = 'home'">
            {{ t("title.back") }}</button
          >
        </header>
        <template v-if="page === 'new'">
          <h2>{{ t("menu.actions.new_game") }}</h2>
          <p class="section-description">{{ t("title.new_hint") }}</p>
          <label class="field">
            <span>{{ t("ext.mode.label") }}</span>
            <select v-model="ruleSet" data-testid="rule-set">
              <option value="classic">{{ t("ext.mode.classic") }}</option>
              <option value="extended">{{ t("ext.mode.extended") }}</option>
            </select>
          </label>
          <label class="field"
            ><span>{{ t("menu.mode.label") }}</span
            ><select v-model="mode">
              <option value="normal">{{ t("menu.mode.normal") }}</option>
              <option value="easy">{{ t("menu.mode.easy") }}</option>
              <option value="wizard">{{ t("menu.mode.wizard") }}</option>
              <option value="test">{{ t("menu.mode.test") }}</option>
            </select></label
          >
          <label class="field"
            ><span>{{ t("menu.seed.label") }}</span
            ><input
              v-model="seedInput"
              type="text"
              inputmode="numeric"
              :aria-invalid="parsedSeed === null"
              aria-describedby="seed-hint"
              :disabled="mode === 'test'"
              :placeholder="
                mode === 'test'
                  ? t('menu.seed.disabled_for_test')
                  : seedPlaceholder
              "
          /></label>
          <p
            id="seed-hint"
            class="field-hint"
            :role="parsedSeed === null ? 'alert' : undefined"
          >
            {{ t("menu.seed.range") }}
          </p>
          <p v-if="creationError && !creationContext" class="field-hint" role="alert">{{ t('ext.growth.creation.unavailable') }}</p>
          <button
            class="begin-button"
            :disabled="parsedSeed === null || replayBusy"
            @click="startGame"
          >
            {{ t("title.begin") }}<span>◆</span>
          </button>
        </template>
        <template v-if="page === 'saves'">
          <h2>{{ t("title.saves") }}</h2>
          <p class="section-description">{{ t("title.save_hint") }}</p>
          <div v-if="saveInfo" class="save-meta">
            <strong>{{ t("menu.save_meta.title") }}</strong>
            <div>{{ t("menu.save_meta.depth") }}: {{ saveInfo.depth }}</div>
            <div>
              {{ t("menu.save_meta.mode") }}: {{ modeLabel(saveInfo.mode) }}
            </div>
            <div>{{ t("menu.save_meta.seed") }}: {{ saveInfo.seed }}</div>
            <div>
              {{ t("menu.save_meta.saved_at") }}:
              {{ new Date(saveInfo.savedAt).toLocaleString() }}
            </div>
          </div>
          <p v-else class="empty-message">{{ t("title.no_save") }}</p>
          <div class="actions">
            <button v-if="inGame" @click="emit('save-game')">
              {{ t("menu.actions.save") }}</button
            ><button
              :disabled="!hasSave || replayBusy"
              @click="emit('continue-game')"
            >
              {{ t("menu.actions.continue") }}</button
            ><button
              v-if="hasSave"
              class="danger-btn"
              @click="emit('delete-save')"
            >
              {{ t("menu.actions.delete_save") }}
            </button>
          </div>
        </template>
        <template v-if="page === 'records'">
          <h2>{{ t("menu.replay.title") }}</h2>
          <p class="recording-hint">{{ t("menu.replay.automatic_hint") }}</p>
          <div class="actions">
            <button
              v-if="canSaveReplay"
              :disabled="replayBusy"
              @click="emit('save-replay')"
            >
              {{ t("menu.replay.save") }}</button
            ><button
              v-if="canSaveReplay"
              :disabled="replayBusy"
              @click="emit('export-current-replay-json')"
            >
              {{ t("menu.replay.export_current") }}</button
            ><button
              :disabled="!hasReplay || replayBusy"
              @click="emit('load-replay')"
            >
              {{ t("menu.replay.load") }}</button
            ><button :disabled="!hasReplay" @click="emit('export-replay-json')">
              {{ t("menu.replay.export_json") }}</button
            ><button :disabled="replayBusy" @click="triggerReplayImport">
              {{ t("menu.replay.import_json") }}</button
            ><button
              v-if="hasReplay"
              class="danger-btn"
              @click="emit('delete-replay')"
            >
              {{ t("menu.replay.delete") }}
            </button>
          </div>
          <p v-if="replayFeedback" class="recording-feedback" role="status">
            {{ replayFeedback }}
          </p>
          <div v-if="replayInfo" class="save-meta">
            <div>
              {{ t("menu.replay.status") }}:
              {{
                t(`menu.replay.status.${replayInfo.status}`, {
                  defaultValue: replayInfo.status,
                })
              }}
            </div>
            <div>
              {{ t("menu.replay.progress") }}: {{ replayInfo.cursor }} /
              {{ replayInfo.total }}
            </div>
            <div class="actions">
              <button @click="emit('replay-play')">
                {{ t("menu.replay.play") }}</button
              ><button @click="emit('replay-pause')">
                {{ t("menu.replay.pause") }}</button
              ><button @click="emit('replay-step')">
                {{ t("menu.replay.step") }}</button
              ><button @click="emit('replay-restart')">
                {{ t("menu.replay.restart") }}
              </button>
            </div>
            <div class="actions">
              <input
                v-model="replaySeekInput"
                type="number"
                min="0"
                :max="Math.max(0, replayInfo.total)"
                :placeholder="seekPlaceholder"
              /><button @click="seekReplay">{{ t("menu.replay.seek") }}</button>
            </div>
          </div>
        </template>
        <template v-if="page === 'settings'">
          <h2>{{ t("title.settings") }}</h2>
          <p class="section-description">{{ t("title.settings_hint") }}</p>
          <div class="display-group">
            <label class="field"><span>{{ t('menu.display.map_style') }}</span>
              <select v-model="mapModeModel" data-map-setting>
                <option value="original">{{ t('map.original') }}</option>
                <option value="refined">{{ t('map.refined') }}</option>
                <option value="hanzi">{{ t('map.hanzi') }}</option>
                <option value="tiles">{{ t('map.tiles') }}</option>
              </select>
            </label>
            <label class="field checkbox-field"><span>{{ t('menu.display.immersive_mode') }}</span>
              <input class="display-toggle" type="checkbox" v-model="displaySettings.immersiveMode" />
            </label>
            <p class="field-hint immersive-hint">{{ t('menu.display.immersive_hint') }}</p>
            <div class="field legend-field"><span>{{ t('map.legend') }}</span>
              <button class="legend-button" :aria-expanded="legendOpen" @click="legendOpen = !legendOpen">{{ t('map.legend_view') }}</button>
            </div>

            <label class="field"
              ><span>{{ t("menu.display.ui_scale") }}</span
              ><select v-model.number="displaySettings.uiScale">
                <option :value="0.8">80%</option>
                <option :value="1">100%</option>
                <option :value="1.25">125%</option>
                <option :value="1.5">150%</option>
              </select></label
            ><label class="field checkbox-field"
              ><span>{{ t("menu.display.damage_numbers") }}</span
              ><input
                class="damage-toggle"
                type="checkbox"
                v-model="displaySettings.showDamageNumbers" /></label
            ><label class="field"
              ><span>{{ t("menu.display.map_scale") }}</span
              ><select v-model="mapScaleModel">
                <option value="uniform">
                  {{ t("menu.display.map_scale.uniform") }}
                </option>
                <option value="stretch">
                  {{ t("menu.display.map_scale.stretch") }}
                </option>
              </select></label
            ><label class="field"
              ><span>{{ t("menu.display.sidebar_width") }}</span
              ><select v-model="sidebarWidthModel">
                <option value="fixed">
                  {{ t("menu.display.sidebar_width.fixed") }}
                </option>
                <option value="proportional">
                  {{ t("menu.display.sidebar_width.proportional") }}
                </option>
              </select></label
            >
          </div>
          <MapTileLegend v-if="legendOpen" @close="legendOpen = false" />
        </template>
      </section>
      <input
        ref="replayFileInput"
        type="file"
        accept="application/json,.json"
        class="file-input"
        @change="onReplayFileChange"
      />
      <footer v-if="!inGame" class="title-footer">
        <span>{{ t("title.footer") }}</span
        ><span>{{ t("title.version") }}</span>
      </footer>
    </div>
    <GrowthCreationPanel v-if="creationModel" :model="creationModel" :submitting="creationSubmitting" :error="creationError"
      @cancel="cancelCreation" @select="selectIdentity" @adjust="adjustIdentityChoice" @submit="submitCreation" />
  </div>
</template>
