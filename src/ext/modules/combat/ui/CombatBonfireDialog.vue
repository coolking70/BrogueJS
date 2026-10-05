<script setup lang="ts">
import type { CombatUiBonfire } from './view';
defineProps<{ bonfire: CombatUiBonfire }>();
</script>
<template>
  <section class="combat-bonfire-dialog" data-testid="combat-bonfire-dialog" :data-combat-bonfire="bonfire.entityId">
    <header>
      <h2>{{ $t(bonfire.nameKey) }}</h2>
      <button type="button" data-dialog-action="close">{{ $t('ext.combat.ui.cancel') }}</button>
    </header>
    <p>{{ $t(bonfire.descriptionKey) }}</p>
    <p class="combat-rest-duration">{{ $t('ext.combat.ui.rest_duration', { ticks: bonfire.restTicks }) }}</p>
    <p>{{ $t('ext.combat.ui.rest_time_hint') }}</p>
    <p>{{ $t('ext.combat.ui.rest_interrupt_hint') }}</p>
    <p class="combat-note">{{ $t('ext.combat.ui.rest_restore_hint') }}</p>
    <footer>
      <button type="button" data-dialog-action="choice:confirm">{{ $t('ext.combat.ui.perform_rest') }}</button>
      <small>{{ $t('ext.combat.ui.rest_keyboard_hint') }}</small>
    </footer>
  </section>
</template>
<style scoped>
.combat-bonfire-dialog{display:flex;flex-direction:column;gap:12px;min-width:0;min-height:0;overflow:auto;color:var(--text-primary,#d8c9a1);font:15px/1.5 var(--font-main,monospace)}header,footer{display:flex;flex-wrap:wrap;align-items:center;gap:8px}header h2{flex:1 1 0;margin:0;font-size:1.1rem;overflow-wrap:anywhere}p{margin:0;overflow-wrap:anywhere}.combat-rest-duration{color:var(--color-accent,#d8b86a)}button{box-sizing:border-box;min-width:44px;min-height:44px;padding:8px 12px;border:1px solid var(--border-color,#615638);background:var(--btn-bg,#282b21);color:inherit;font:inherit;touch-action:manipulation;cursor:pointer}button:focus-visible{outline:2px solid var(--color-accent,#d8b86a);outline-offset:-3px}.combat-note,small{font-size:12px;color:var(--text-secondary,#a5a18e)}footer{border-top:1px solid var(--border-color,#615638);padding-top:12px}footer small{flex:1 1 160px}@media(max-width:350px){.combat-bonfire-dialog{font-size:14px;gap:10px}button{padding:8px}}
</style>
