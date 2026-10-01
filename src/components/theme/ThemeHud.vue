<script setup lang="ts">
// DESIGN-2：主题外壳的状态区。只读轮询（useGameHud），不发游戏命令；
// 每个主题用 html[data-ui-concept=…] 选择显示哪些部件与如何排布。
import { computed } from 'vue';
import { useGameHud, nutritionStatus } from '../../ui/useGameHud';
import { activeGame } from '../../engine/Core/Game';
import { STOMACH_SIZE } from '../../entities/Player';

const props = withDefaults(defineProps<{ panelOpen?: boolean; showPanelButton?: boolean }>(), { panelOpen: false, showPanelButton: true });
const emit = defineEmits<{ (e: 'menu'): void; (e: 'panel'): void }>();
const { stats, hp, maxHp, depth, nutrition, statuses } = useGameHud(0);
const fraction = computed(() => Math.max(0, Math.min(1, hp.value / Math.max(1, maxHp.value))));
const low = computed(() => fraction.value < 0.3);
const food = computed(() => nutritionStatus(nutrition.value));
const foodFraction = computed(() => Math.max(0, Math.min(1, nutrition.value / STOMACH_SIZE)));
/** 10 段刻度：满段、半段（按剩余比例）与空段。 */
const segments = computed(() => Array.from({ length: 10 }, (_, i) => Math.max(0, Math.min(1, fraction.value * 10 - i))));
const foodSegments = computed(() => Array.from({ length: 10 }, (_, i) => Math.max(0, Math.min(1, foodFraction.value * 10 - i))));
const chars = (f: number) => { const n = Math.round(f * 10); return { on: '█'.repeat(n), off: '░'.repeat(10 - n) }; };
const hpChars = computed(() => chars(fraction.value));
const foodChars = computed(() => chars(foodFraction.value));
const turns = computed(() => { void hp.value; return activeGame?.stats?.turns ?? 0; });
const depthBand = computed(() => depth.value <= 5 ? 1 : depth.value <= 12 ? 2 : depth.value <= 20 ? 3 : 4);
const depthMarks = Array.from({ length: 26 }, (_, i) => i + 1);
void props;
</script>

<template>
  <header class="theme-hud" :class="{ 'hp-low': low }" :data-depth-band="depthBand" @keydown.stop @keyup.stop
          @click="($event.target as HTMLElement).closest('button')?.blur()">
    <button class="th-menu th-btn" @click="emit('menu')">{{ $t('menu.actions.menu') }}</button>
    <div class="th-depth"><span class="th-label">{{ $t('theme.depth') }}</span><b class="th-num">{{ depth }}</b><span class="th-turn"><span class="th-label">{{ $t('theme.turn') }}</span><b class="th-num">{{ turns }}</b></span></div>
    <div class="th-hp" :aria-label="$t('sidebar.health')">
      <span class="th-label">{{ $t('sidebar.health') }}</span>
      <span class="th-hp-value th-num"><b class="th-hp-cur">{{ hp }}</b><span class="th-hp-max">/{{ maxHp }}</span></span>
      <span class="th-hp-bar"><i class="th-hp-fill" :style="{ width: `${fraction * 100}%` }"></i></span>
      <span class="th-segs" aria-hidden="true"><i v-for="(s, i) in segments" :key="i" :style="{ '--f': s }"></i></span>
      <span class="th-chars" aria-hidden="true"><span class="on">{{ hpChars.on }}</span><span class="off">{{ hpChars.off }}</span></span>
    </div>
    <div class="th-food" :style="{ '--food': food.color }">
      <span class="th-label">{{ $t('theme.hunger') }}</span>
      <span class="th-food-word">{{ food.text }}</span>
      <span class="th-food-num th-num">{{ nutrition }}</span>
      <span class="th-food-bar"><i :style="{ width: `${foodFraction * 100}%` }"></i></span>
      <span class="th-segs th-food-segs" aria-hidden="true"><i v-for="(s, i) in foodSegments" :key="i" :style="{ '--f': s }"></i></span>
      <span class="th-chars th-food-chars" aria-hidden="true"><span class="on">{{ foodChars.on }}</span><span class="off">{{ foodChars.off }}</span></span>
    </div>
    <dl v-if="stats" class="th-stats">
      <div class="th-stat"><dt>{{ $t('lab.hud_strength') }}</dt><dd class="th-num">{{ stats.strength }}<small v-if="stats.strength !== stats.maxStrength">/{{ stats.maxStrength }}</small></dd></div>
      <div class="th-stat"><dt>{{ $t('lab.hud_armor') }}</dt><dd class="th-num">{{ stats.armor }}</dd></div>
      <div class="th-stat"><dt>{{ $t('lab.hud_gold') }}</dt><dd class="th-num">{{ stats.gold }}</dd></div>
      <div class="th-stat th-stealth"><dt>{{ $t('lab.hud_stealth') }}</dt><dd class="th-num">{{ stats.stealthRange }}</dd></div>
    </dl>
    <div class="th-depthbar" aria-hidden="true"><i v-for="d in depthMarks" :key="d" :class="{ on: d <= depth, here: d === depth }"></i></div>
    <div v-if="statuses.length" class="th-statuses">
      <span v-for="status in statuses" :key="status.id" class="th-status" :style="{ color: status.color }">{{ status.label }} {{ status.value }}</span>
    </div>
    <button v-if="showPanelButton" class="th-panel th-btn" :aria-expanded="panelOpen" @click="emit('panel')">{{ $t('theme.panel') }}</button>
  </header>
</template>
