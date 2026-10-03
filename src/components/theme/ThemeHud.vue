<script setup lang="ts">
// 刻符状态区：只读轮询（useGameHud），沉浸模式只收起信息，不发游戏命令。
import { computed, ref, onUnmounted } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useGameHud, nutritionStatus } from '../../ui/useGameHud';
import { STOMACH_SIZE } from '../../entities/Player';

const props = withDefaults(defineProps<{ panelOpen?: boolean; showPanelButton?: boolean; hasModuleHud?: boolean; immersive?: boolean }>(), { panelOpen: false, showPanelButton: true });
const emit = defineEmits<{ (e: 'menu'): void; (e: 'panel'): void }>();
const { t } = useTranslation();
const panelHint = computed(() => props.panelOpen
  ? t('theme.panel_close', { defaultValue: 'Collapse nearby information' })
  : t('theme.panel_hint', { defaultValue: 'Expand nearby entities and inspection information' }));
const { stats, hp, maxHp, depth, turns, nutrition, statuses } = useGameHud(0);
const searching = computed(() => statuses.value.some(status => status.id === 'searching'));
// Reserve the first progress badge's intrinsic width, never a guessed character count.
// The rest of the status row can still scroll. These DOM reads never touch simulation.
const searchBadgeWidth = ref(0);
let searchBadge: HTMLElement | null = null;
const measureSearchBadgeWidth = () => {
    if (!searchBadge || typeof searchBadge.getBoundingClientRect !== 'function' || searchBadge.isConnected === false) return;
    const width = Math.ceil(Math.max(searchBadge.getBoundingClientRect().width, searchBadge.scrollWidth || 0));
    if (Number.isFinite(width) && width > 0) searchBadgeWidth.value = width;
};
const searchObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureSearchBadgeWidth);
function bindSearchBadge(element: unknown) {
    // A non-DOM renderer or a retiring ref has no measurable live element.
    // Keep the CSS fallback instead of observing or measuring that value.
    const candidate = element as HTMLElement | null;
    const next = candidate && typeof candidate.getBoundingClientRect === 'function' && candidate.isConnected !== false ? candidate : null;
    if (next !== searchBadge) { searchObserver?.disconnect(); searchBadge = next; if (next) searchObserver?.observe(next); }
    if (next) measureSearchBadgeWidth(); else searchBadgeWidth.value = 0;
}
onUnmounted(() => searchObserver?.disconnect());

const fraction = computed(() => Math.max(0, Math.min(1, hp.value / Math.max(1, maxHp.value))));
const low = computed(() => fraction.value < 0.3);
const food = computed(() => nutritionStatus(nutrition.value));
const foodFraction = computed(() => Math.max(0, Math.min(1, nutrition.value / STOMACH_SIZE)));
const chars = (f: number) => { const n = Math.round(f * 10); return { on: '█'.repeat(n), off: '░'.repeat(10 - n) }; };
const hpChars = computed(() => chars(fraction.value));
const foodChars = computed(() => chars(foodFraction.value));
void props;
</script>

<template>
  <header class="theme-hud" :class="{ 'hp-low': low, 'has-module-hud': hasModuleHud, 'has-search-progress': searching }" @keydown.stop @keyup.stop
          @click="($event.target as HTMLElement).closest('button')?.blur()">
    <button class="th-menu th-btn" @click="emit('menu')">{{ $t('menu.actions.menu') }}</button>
    <div class="th-depth"><span class="th-label">{{ $t('theme.depth') }}</span><b class="th-num">{{ depth }}</b><span class="th-turn"><span class="th-label">{{ $t('theme.turn') }}</span><b class="th-num">{{ turns }}</b></span></div>
    <div class="th-hp" :aria-label="$t('sidebar.health')">
      <span class="th-label">{{ $t('sidebar.health') }}</span>
      <span class="th-hp-value th-num"><b class="th-hp-cur">{{ hp }}</b><span class="th-hp-max">/{{ maxHp }}</span></span>
      <span class="th-hp-bar"><i class="th-hp-fill" :style="{ width: `${fraction * 100}%` }"></i></span>
      <span class="th-chars" aria-hidden="true"><span class="on">{{ hpChars.on }}</span><span class="off">{{ hpChars.off }}</span></span>
    </div>
    <div class="th-food" :style="{ '--food': food.color }">
      <span class="th-label">{{ $t('theme.hunger') }}</span>
      <span class="th-food-word">{{ food.text }}</span>
      <span class="th-food-num th-num">{{ nutrition }}</span>
      <span class="th-food-bar"><i :style="{ width: `${foodFraction * 100}%` }"></i></span>
      <span class="th-chars th-food-chars" aria-hidden="true"><span class="on">{{ foodChars.on }}</span><span class="off">{{ foodChars.off }}</span></span>
    </div>
    <dl v-if="stats" class="th-stats">
      <div class="th-stat"><dt>{{ $t('theme.strength') }}</dt><dd class="th-num">{{ stats.strength }}<small v-if="stats.strength !== stats.maxStrength">/{{ stats.maxStrength }}</small></dd></div>
      <div class="th-stat"><dt>{{ $t('theme.armor') }}</dt><dd class="th-num">{{ stats.armor }}</dd></div>
      <div class="th-stat"><dt>{{ $t('theme.gold') }}</dt><dd class="th-num">{{ stats.gold }}</dd></div>
      <div class="th-stat th-stealth"><dt>{{ $t('theme.stealth') }}</dt><dd class="th-num">{{ stats.stealthRange }}</dd></div>
    </dl>
    <div v-if="statuses.length" class="th-statuses" :style="searching ? { minInlineSize: searchBadgeWidth ? `${searchBadgeWidth}px` : '6em' } : undefined">
      <span v-for="status in statuses" :key="status.id" :ref="status.id === 'searching' ? bindSearchBadge : undefined" class="th-status" :class="{ 'th-search-progress': status.id === 'searching' }" :style="{ color: status.color }">
        {{ status.label }} {{ status.value }}
        <span class="th-status-fill" :style="{ width: `${status.fraction * 100}%` }"></span>
      </span>
    </div>
    <slot />
    <button v-if="showPanelButton" class="th-panel th-btn" :aria-expanded="panelOpen" :title="panelHint" @click="emit('panel')">{{ immersive && hasModuleHud ? (panelOpen ? $t('theme.panel_close_short') : $t('theme.panel_short')) : (panelOpen ? $t('theme.panel_close') : $t('theme.panel')) }}</button>
  </header>
</template>

<style scoped>
@media(max-width:420px){:global(html[data-ui-concept=glyph] .app-layout.immersive-mode .theme-hud.has-module-hud .th-turn){display:none!important}:global(.immersive-mode .theme-hud.has-module-hud){gap:4px!important}}
</style>
