<script setup lang="ts">
import { combatDirections } from './view';
import type { CombatUiAction } from './view';
import type { Facing } from '../types';
defineProps<{ attack: CombatUiAction; facing: Facing | null }>();
</script>
<template>
  <section class="combat-attack-dialog" data-testid="combat-attack-dialog" :data-combat-step="facing ? 'confirm' : 'direction'">
    <header><h2>{{ $t(attack.nameKey) }}</h2><button type="button" data-dialog-action="close">{{ $t('ext.combat.ui.cancel') }}</button></header>
    <p v-if="attack.id === 'dodge'">{{ $t(facing ? 'ext.combat.ui.confirm_dodge' : 'ext.combat.ui.choose_dodge_direction') }}</p>
    <p v-else>{{ $t(facing ? 'ext.combat.ui.confirm_attack' : 'ext.combat.ui.choose_direction') }}</p>
    <div v-if="!facing" class="combat-directions">
      <button v-for="direction in combatDirections" :key="direction.facing" type="button"
        :class="`direction-${direction.facing}`" :data-dialog-action="`choice:${direction.facing}`">
        <span>{{ direction.glyph }}</span>{{ $t(direction.nameKey) }}
      </button>
    </div>
    <p v-else class="combat-facing"><template v-for="direction in combatDirections" :key="direction.facing"><span v-if="direction.facing === facing">{{ $t(direction.nameKey) }}</span></template></p>
    <p v-if="attack.cost !== undefined" class="combat-cost">{{ $t('ext.combat.ui.stamina_cost', { cost: attack.cost }) }}</p>
    <p class="combat-note">{{ $t(attack.id === 'dodge' ? 'ext.combat.ui.dodge_hint' : 'ext.combat.ui.locked_world_hint') }}</p>
    <footer>
      <button v-if="facing" type="button" data-dialog-action="back">{{ $t('ext.combat.ui.back') }}</button>
      <button v-if="facing" type="button" data-dialog-action="choice:confirm">{{ $t(attack.id === 'dodge' ? 'ext.combat.ui.perform_dodge' : 'ext.combat.ui.release') }}</button>
      <small>{{ $t('ext.combat.ui.keyboard_hint') }}</small>
    </footer>
  </section>
</template>
<style scoped>
.combat-attack-dialog{display:flex;flex-direction:column;gap:12px;min-height:0;min-width:0;overflow:auto;color:var(--text-primary,#d8c9a1);font:15px/1.5 var(--font-main,monospace)}header,footer{display:flex;align-items:center;flex-wrap:wrap;gap:8px}header h2{flex:1 1 0;margin:0;font-size:1.1rem;overflow-wrap:anywhere}p{margin:0}.combat-directions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-width:360px;width:100%;align-self:center}.combat-directions button{display:flex;flex-direction:column;align-items:center;gap:2px}.direction-e{grid-column:3}.combat-facing{font-size:1.3rem;color:var(--color-accent,#d8b86a)}button{box-sizing:border-box;min-width:44px;min-height:44px;padding:8px 12px;border:1px solid var(--border-color,#615638);background:var(--btn-bg,#282b21);color:inherit;font:inherit;touch-action:manipulation;cursor:pointer}button:focus-visible{outline:2px solid var(--color-accent,#d8b86a);outline-offset:-3px}.combat-note,small{font-size:12px;color:var(--text-secondary,#a5a18e)}footer{border-top:1px solid var(--border-color,#615638);padding-top:12px}footer small{flex:1 1 160px}@media(max-width:350px){.combat-attack-dialog{font-size:14px;gap:10px}button{padding:8px}.combat-directions{gap:6px}}
</style>
