<script setup lang="ts">
// 刻符状态区：只读轮询（useGameHud），沉浸模式只收起信息，不发游戏命令。
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { useGameHud, nutritionStatus } from '../../ui/useGameHud';
import type { GrowthCharacterViewModel } from '../../ext/modules/growth/view';
import { STOMACH_SIZE } from '../../entities/Player';

const props = withDefaults(defineProps<{ panelOpen?: boolean; showPanelButton?: boolean; growth?: GrowthCharacterViewModel | null; growthBlocked?: boolean; immersive?: boolean }>(), { panelOpen: false, showPanelButton: true });
const emit = defineEmits<{ (e: 'menu'): void; (e: 'panel'): void; (e: 'character'): void }>();
const { t } = useTranslation();
const panelHint = computed(() => props.panelOpen
  ? t('theme.panel_close', { defaultValue: 'Collapse nearby information' })
  : t('theme.panel_hint', { defaultValue: 'Expand nearby entities and inspection information' }));
const { stats, hp, maxHp, depth, turns, nutrition, statuses } = useGameHud(0);
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
  <header class="theme-hud" :class="{ 'hp-low': low, 'has-growth': !!growth }" @keydown.stop @keyup.stop
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
    <div v-if="statuses.length" class="th-statuses">
      <span v-for="status in statuses" :key="status.id" class="th-status" :style="{ color: status.color }">{{ status.label }} {{ status.value }}</span>
    </div>
    <div v-if="growth" class="th-growth" :class="{ 'th-growth-compact': immersive }">
      <div class="th-growth-heading"><strong v-if="!immersive">{{ $t('ext.growth.ui.level_short', { level: growth.level }) }}</strong><button class="th-growth-entry th-btn" :disabled="growthBlocked" :aria-label="$t('ext.growth.ui.character')" :title="$t('ext.growth.ui.character')" @click="emit('character')">{{ immersive ? $t('ext.growth.ui.level_short', { level: growth.level }) : $t('ext.growth.ui.character') }}<span v-if="growth.hasUnspentPoints" class="th-growth-dot" :title="$t('ext.growth.ui.unspent')">●</span></button></div>
      <template v-if="!immersive"><progress v-if="!growth.atLevelCap" :value="growth.experienceInLevel" :max="growth.experienceToNext ?? 1" :aria-label="$t('ext.growth.ui.experience_label')" /><span class="th-growth-xp">{{ growth.atLevelCap ? $t('ext.growth.ui.level_cap') : $t('ext.growth.ui.experience', { current: growth.experienceInLevel, next: growth.experienceToNext }) }}</span><span class="th-growth-points">{{ $t('ext.growth.ui.points', { attributes: growth.attributePoints, skills: growth.skillPoints }) }}</span></template>
    </div>
    <button v-if="showPanelButton" class="th-panel th-btn" :aria-expanded="panelOpen" :title="panelHint" @click="emit('panel')">{{ panelOpen ? $t('theme.panel_close') : $t('theme.panel') }}</button>
  </header>
</template>

<style scoped>
.th-growth{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding-top:8px;border-top:1px solid var(--th-line,#555);font-size:11px;width:100%;box-sizing:border-box}
.th-growth-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%}.th-growth-heading strong,.th-growth-dot{color:var(--th-accent,#dcc88d)}.th-growth-dot{margin-left:4px}.th-growth progress{height:5px;min-width:35px;width:60px;flex:1;accent-color:var(--th-accent,#dcc88d)}.th-growth-points{width:100%;color:var(--th-dim,#aaa)}.th-growth-compact{width:auto;flex:0 0 auto;border:0;padding:0;font-size:12px}.th-growth-compact .th-growth-heading{gap:4px}.th-growth-compact .th-growth-entry{padding:0 2px!important;font-size:12px}.th-growth-entry:disabled{opacity:.4}
@media(max-width:700px){.th-growth:not(.th-growth-compact){flex-basis:100%;gap:4px 8px;padding-top:4px}.th-growth:not(.th-growth-compact) .th-growth-heading{width:auto;gap:7px}.th-growth:not(.th-growth-compact) .th-growth-points{width:auto}.th-growth:not(.th-growth-compact) .th-growth-entry{min-height:34px!important;font-size:12px!important;padding:0 6px!important}.th-growth:not(.th-growth-compact) .th-growth-xp{font-size:10px}}
@media(max-width:420px){:global(html[data-ui-concept=glyph] .app-layout.immersive-mode .theme-hud.has-growth .th-turn){display:none!important}:global(.immersive-mode .theme-hud.has-growth){gap:4px!important}}
</style>
