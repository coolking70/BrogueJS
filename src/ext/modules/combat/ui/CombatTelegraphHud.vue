<script setup lang="ts">
import type { CombatUiResources, CombatUiRest } from './view';
import type { DisplayTelegraph } from '../../../../ui/combatDrawing';
defineProps<{ resources: CombatUiResources | null; rest?: CombatUiRest | null; entries: readonly (Pick<DisplayTelegraph, 'phase' | 'parryable' | 'remainingTicks'> & { key: string; name: string | null })[]; focused: boolean }>();
</script>
<template>
  <aside class="combat-telegraph-hud" data-testid="combat-telegraph-hud">
    <span v-if="rest" class="combat-rest" data-testid="combat-rest" :data-combat-rest-status="rest.status">
      {{ $t(rest.status === 'resting' ? 'ext.combat.ui.rest_active' : 'ext.combat.ui.rest_interrupted', { ticks: rest.remainingTicks }) }}
    </span>
    <div v-if="resources" class="combat-stamina" data-testid="combat-stamina" :title="$t('ext.combat.ui.stamina_hint')">
      <span>{{ $t('ext.combat.ui.stamina_value', { current: resources.stamina, capacity: resources.capacity }) }}</span>
      <span class="stamina-track"><span class="stamina-fill" :style="{ width: `${100 * resources.stamina / resources.capacity}%` }" /></span>
      <span v-if="resources.dodgeRemainingTicks > 0" class="combat-defense">{{ $t('ext.combat.ui.dodge_active') }}</span>
      <span v-else-if="resources.dodgeRecoveryRemainingTicks > 0">{{ $t('ext.combat.ui.dodge_recovery') }}</span>
    </div>
    <div v-if="resources?.poise !== undefined" class="combat-poise" data-testid="combat-poise" :title="$t('ext.combat.ui.poise_hint')">
      <span>{{ $t('ext.combat.ui.poise_value', { current: resources.poise, capacity: resources.poiseCapacity }) }}</span>
      <span v-if="(resources.staggerRemainingTicks ?? 0) > 0" class="combat-stagger">{{ $t('ext.combat.ui.stagger_active', { ticks: resources.staggerRemainingTicks }) }}</span>
      <span v-else-if="(resources.poiseRecoveryDelayRemaining ?? 0) > 0">{{ $t('ext.combat.ui.poise_recovery', { ticks: resources.poiseRecoveryDelayRemaining }) }}</span>
      <span v-if="(resources.parryRemainingTicks ?? 0) > 0" class="combat-defense">{{ $t('ext.combat.ui.parry_active', { ticks: resources.parryRemainingTicks }) }}</span>
      <span v-else-if="(resources.parryRecoveryRemainingTicks ?? 0) > 0">{{ $t('ext.combat.ui.parry_recovery', { ticks: resources.parryRecoveryRemainingTicks }) }}</span>
    </div>
    <strong v-if="entries.length">{{ $t(focused ? 'ext.combat.ui.cell_threats' : 'ext.combat.ui.visible_threats') }}</strong>
    <span v-for="entry in entries" :key="entry.key" :class="entry.phase" :title="$t('ext.combat.ui.telegraph_hint') + ' ' + $t(entry.parryable === true ? 'ext.combat.ui.telegraph_map_parryable_legend' : entry.parryable === false ? 'ext.combat.ui.telegraph_map_unparryable_legend' : 'ext.combat.ui.telegraph_map_unknown_legend')">
      {{ entry.name ?? $t('ext.combat.ui.public_source') }} · {{ $t(entry.phase === 'windup' ? 'ext.combat.ui.phase.windup' : 'ext.combat.ui.phase.inter-segment') }}
      · {{ $t(entry.parryable === true ? 'ext.combat.ui.telegraph_parryable' : entry.parryable === false ? 'ext.combat.ui.telegraph_unparryable' : 'ext.combat.ui.telegraph_parry_unknown') }}
      · {{ entry.remainingTicks === undefined ? $t('ext.combat.ui.telegraph_timing_unknown') : $t('ext.combat.ui.telegraph_remaining', { ticks: entry.remainingTicks }) }}
    </span>
  </aside>
</template>
<style scoped>
.combat-telegraph-hud{display:flex;flex-wrap:wrap;gap:4px 10px;height:auto;width:100%;max-width:100%;max-height:min(144px,20dvh);flex-shrink:0;min-width:0;overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere;padding:4px 8px;box-sizing:border-box;font:11px/1.5 var(--th-font,monospace);background:var(--th-panel,#171913);color:var(--th-fg,#d8c9a1)}.combat-stamina,.combat-poise{display:flex;align-items:center;gap:6px;flex:0 1 auto;min-width:0;flex-wrap:wrap}.stamina-track{display:block;width:64px;height:5px;background:var(--th-line,#615638)}.stamina-fill{display:block;height:100%;background:#aacb83}.combat-defense{color:#aacb83}.combat-stagger{color:#e89b67}strong{font-weight:normal;color:var(--th-dim,#a5a18e)}.windup{color:#e89b67}.inter-segment{color:#e2cc80}
:global(.app-layout.immersive-mode) .combat-telegraph-hud{width:auto;flex:0 1 auto}
</style>
