<script setup lang="ts">
import { inputManager } from '../engine/Input';
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useTranslation } from "i18next-vue";
import { concept, selectConcept, registerConceptTool, isShellConcept } from "../ui/concept";
import type { Concept } from "../ui/concept";
import MapTileLegend from './MapTileLegend.vue';
import { mapMode, selectMapMode } from '../ui/mapTiles';
import type { MapMode } from '../ui/mapTiles';
defineProps<{ inGame?: boolean }>();
const legendOpen = ref(false);
/** DESIGN-2 主题里切换栏默认收成一个小按钮，展开后浮在游戏上方，不占布局。 */
const collapsed = ref(true);
const shell = computed(() => isShellConcept(concept.value));
const mapOptions = computed(() => [
 { id:'original' as MapMode, name:t('lab.map_original'), tip:t('lab.map_original_tip') },
 { id:'refined' as MapMode, name:t('lab.map_refined'), tip:t('lab.map_refined_tip') },
 { id:'hanzi' as MapMode, name:t('lab.map_hanzi'), tip:t('lab.map_hanzi_tip') },
 { id:'tiles' as MapMode, name:t('lab.map_tiles'), tip:t('lab.map_tiles_tip') },
]);
function switchMap(value: MapMode, event: Event) {
 selectMapMode(value); (event.currentTarget as HTMLButtonElement).blur();
}
const { t } = useTranslation();
const chosen = ref("");
const infoOpen = ref(false);
let removeKeyboard: (() => void) | undefined;
let cleanupTool: (() => void) | undefined;
onMounted(() => {
  cleanupTool = registerConceptTool();
  removeKeyboard = inputManager.registerModalKeyHandler(event => {
    if (!legendOpen.value && !infoOpen.value && (collapsed.value || !shell.value)) return false;
    if (event.key === 'Escape') { legendOpen.value = false; infoOpen.value = false; collapsed.value = true; (document.activeElement as HTMLElement)?.blur(); }
    return true;
  }, 800);
});
onUnmounted(() => { cleanupTool?.(); removeKeyboard?.(); });
const concepts = computed(() => [
  { id: "classic" as Concept, number: "01", name: t("lab.classic"), code: t("lab.classic_code"), description: t("lab.classic_desc") },
  { id: "tactical" as Concept, number: "02", name: t("lab.tactical"), code: t("lab.tactical_code"), description: t("lab.tactical_desc") },
  { id: "immersive" as Concept, number: "03", name: t("lab.immersive"), code: t("lab.immersive_code"), description: t("lab.immersive_desc") },
  { id: "glyph" as Concept, number: "A", name: t("lab.glyph"), code: t("lab.glyph_code"), description: t("lab.glyph_desc") },
  { id: "umbra" as Concept, number: "B", name: t("lab.umbra"), code: t("lab.umbra_code"), description: t("lab.umbra_desc") },
  { id: "ember" as Concept, number: "C", name: t("lab.ember"), code: t("lab.ember_code"), description: t("lab.ember_desc") },
  { id: "codex" as Concept, number: "D", name: t("lab.codex"), code: t("lab.codex_code"), description: t("lab.codex_desc") },
  { id: "zen" as Concept, number: "E", name: t("lab.zen"), code: t("lab.zen_code"), description: t("lab.zen_desc") },
  { id: "manual" as Concept, number: "F", name: t("lab.manual"), code: t("lab.manual_code"), description: t("lab.manual_desc") },
]);
const current = computed(
  () => concepts.value.find((c) => c.id === concept.value)!,
);
onMounted(() => {
  try {
    chosen.value = localStorage.getItem("brogue-ui-choice") || "";
  } catch {}
});
function switchConcept(value: Concept, event: Event) {
  selectConcept(value);
  (event.currentTarget as HTMLButtonElement).blur();
}
function choose() {
  chosen.value = concept.value;
  try {
    localStorage.setItem("brogue-ui-choice", concept.value);
  } catch {}
}
</script>
<template>
  <header
    class="ui-lab-toolbar"
    :class="{ 'playing-toolbar': inGame, 'lab-shell': shell, 'lab-collapsed': shell && collapsed }"
    @keydown.stop
    @keyup.stop
    @keydown.esc="legendOpen = false; infoOpen = false"
  >
    <button v-if="shell" class="lab-collapse" :aria-expanded="!collapsed" :aria-label="t('lab.switch')" :title="t('lab.switch')" @click="collapsed = !collapsed; ($event.currentTarget as HTMLElement).blur()"><span aria-hidden="true">◈</span></button>
    <button
      class="lab-switch-trigger"
      @click="infoOpen = !infoOpen"
      :aria-expanded="infoOpen"
    >
      <span class="lab-switch-icon">◈</span>{{ t("lab.switch")
      }}<span class="lab-current">{{ current.name }}</span>
    </button>
    <nav class="lab-tabs" :aria-label="t('lab.switch')">
      <button
        v-for="item in concepts"
        :key="item.id"
        :aria-pressed="concept === item.id"
        :data-concept-button="item.id"
        @click="switchConcept(item.id, $event)"
      >
        <span class="lab-number">{{ item.number }}</span
        ><span>{{ item.name }}</span>
      </button>
    </nav>
    <div class="lab-map-bar">
      <span class="lab-map-label">{{ t('lab.map_style') }}</span>
      <nav :aria-label="t('lab.map_style')">
        <button v-for="style in mapOptions" :key="style.id" :data-map-button="style.id" :title="style.tip" :aria-pressed="mapMode === style.id" @click="switchMap(style.id, $event)">{{ style.name }}</button>
      </nav>
      <button class="lab-legend-button" :aria-expanded="legendOpen" @click="legendOpen = !legendOpen">{{ t('lab.map_legend') }}</button>
    </div>
    <MapTileLegend v-if="legendOpen" @close="legendOpen = false" />
    <section
      v-if="infoOpen"
      class="lab-info"
      role="dialog"
      :aria-label="t('lab.about')"
    >
      <button
        class="lab-info-close"
        @click="infoOpen = false"
        :aria-label="t('mobile.close')"
      >
        ×</button
      ><strong>{{ current.name }}</strong>
      <p>{{ current.description }}</p>
      <p>{{ t("lab.about_copy") }}</p>
      <p>{{ t("lab.save_notice") }}</p>
      <button class="lab-choose" @click="choose">
        {{ chosen === concept ? t("lab.selected") : t("lab.choose") }}
      </button>
      <p>{{ t("lab.choice_notice") }}</p>
      <a href="https://github.com/coolking70/BrogueJS/archive/refs/heads/main.tar.gz">{{ t("lab.source") }}</a
      ><span> · </span
      ><a href="./LICENSE.txt" target="_blank">{{ t("lab.license") }}</a>
    </section>
  </header>
</template>
