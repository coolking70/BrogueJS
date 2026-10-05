<script setup lang="ts">
import type { CombatUiResources } from './view';
defineProps<{ resources: CombatUiResources | null; entries: readonly { key: string; name: string | null; phase: 'windup' | 'inter-segment' }[]; focused: boolean }>();
</script>
<template>
  <aside class="combat-telegraph-hud" data-testid="combat-telegraph-hud">
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
    <span v-for="entry in entries" :key="entry.key" :class="entry.phase">
      {{ entry.name ?? $t('ext.combat.ui.public_source') }} · {{ $t(entry.phase === 'windup' ? 'ext.combat.ui.phase.windup' : 'ext.combat.ui.phase.inter-segment') }}
    </span>
  </aside>
</template>
<style scoped>
.combat-telegraph-hud{display:flex;flex-wrap:wrap;gap:4px 10px;max-height:72px;min-width:0;overflow:auto;padding:4px 8px;box-sizing:border-box;font:11px/1.5 var(--th-font,monospace);background:var(--th-panel,#171913);color:var(--th-fg,#d8c9a1)}.combat-stamina,.combat-poise{display:flex;align-items:center;gap:6px;flex:0 1 auto;min-width:0;flex-wrap:wrap}.stamina-track{display:block;width:64px;height:5px;background:var(--th-line,#615638)}.stamina-fill{display:block;height:100%;background:#aacb83}.combat-defense{color:#aacb83}.combat-stagger{color:#e89b67}strong{font-weight:normal;color:var(--th-dim,#a5a18e)}.windup{color:#e89b67}.inter-segment{color:#e2cc80}
</style>
