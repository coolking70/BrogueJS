<script setup lang="ts">
import type { GrowthCharacterViewModel } from '../view';
defineProps<{ model: GrowthCharacterViewModel; blocked: boolean; immersive: boolean; loadStatus?: 'loading' | 'failed' | null }>();
const emit = defineEmits<{ open: [] }>();
</script>
<template>
    <div  class="th-growth" :class="{ 'th-growth-compact': immersive }">
      <div class="th-growth-heading"><strong v-if="!immersive">{{ $t('ext.growth.ui.level_short', { level: model.level }) }}</strong><button class="th-growth-entry th-btn" :disabled="blocked" :aria-label="$t('ext.growth.ui.character')" :title="$t('ext.growth.ui.character')" @click="emit('open')">{{ loadStatus === 'loading' ? $t('ext.growth.ui.loading_panel') : loadStatus === 'failed' ? $t('ext.growth.ui.load_panel_failed') : immersive ? $t('ext.growth.ui.level_short', { level: model.level }) : $t('ext.growth.ui.character') }}<span v-if="model.hasUnspentPoints" class="th-growth-dot" :title="$t('ext.growth.ui.unspent')">●</span></button></div>
      <template v-if="!immersive"><progress v-if="!model.atLevelCap" :value="model.experienceInLevel" :max="model.experienceToNext ?? 1" :aria-label="$t('ext.growth.ui.experience_label')" /><span class="th-growth-xp">{{ model.atLevelCap ? $t('ext.growth.ui.level_cap') : $t('ext.growth.ui.experience', { current: model.experienceInLevel, next: model.experienceToNext }) }}</span><span class="th-growth-points">{{ $t('ext.growth.ui.points', { attributes: model.attributePoints, skills: model.skillPoints }) }}</span></template>
    </div>
</template>
<style scoped>
.th-growth{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding-top:8px;border-top:1px solid var(--th-line,#555);font-size:11px;width:100%;box-sizing:border-box}
.th-growth-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%}.th-growth-heading strong,.th-growth-dot{color:var(--th-accent,#dcc88d)}.th-growth-dot{margin-left:4px}.th-growth progress{height:5px;min-width:35px;width:60px;flex:1;accent-color:var(--th-accent,#dcc88d)}.th-growth-points{width:100%;color:var(--th-dim,#aaa)}.th-growth-compact{width:auto;flex:0 0 auto;border:0;padding:0;font-size:12px}.th-growth-compact .th-growth-heading{gap:4px}.th-growth-compact .th-growth-entry{padding:0 2px!important;font-size:12px}.th-growth-entry:disabled{opacity:.4}
@media(max-width:700px){.th-growth:not(.th-growth-compact){flex-basis:100%;gap:4px 8px;padding-top:4px}.th-growth:not(.th-growth-compact) .th-growth-heading{width:auto;gap:7px}.th-growth:not(.th-growth-compact) .th-growth-points{width:auto}.th-growth:not(.th-growth-compact) .th-growth-entry{min-height:34px!important;font-size:12px!important;padding:0 6px!important}.th-growth:not(.th-growth-compact) .th-growth-xp{font-size:10px}}
</style>
