<script setup lang="ts">
import i18next from 'i18next';
import type { CombatUiAction, CombatUiBonfire, CombatUiView } from './view';
const props = defineProps<{ model: CombatUiView; blocked: boolean; error: string | null }>();
function actionTitle(action: CombatUiAction): string {
    if (props.model.readOnly) return i18next.t('ext.combat.ui.read_only');
    if (props.blocked) return i18next.t('ext.combat.ui.unavailable');
    if (!action.canUse) {
        if (action.unavailableKey === 'ext.combat.ui.busy') return i18next.t('ext.combat.ui.busy');
        if (action.unavailableKey === 'ext.combat.ui.insufficient_stamina') return i18next.t('ext.combat.ui.insufficient_stamina');
        if (action.unavailableKey === 'ext.combat.ui.staggered') return i18next.t('ext.combat.ui.staggered');
        return i18next.t('ext.combat.ui.unavailable');
    }
    if (action.id === 'parry') return i18next.t('ext.combat.ui.choose_parry_direction');
    return i18next.t(action.id === 'dodge' ? 'ext.combat.ui.choose_dodge_direction' : 'ext.combat.ui.choose_direction');
}
function bonfireTitle(bonfire: CombatUiBonfire): string {
    if (props.model.readOnly) return i18next.t('ext.combat.ui.read_only');
    if (props.blocked) return i18next.t('ext.combat.ui.unavailable');
    if (!bonfire.canUse) {
        if (bonfire.unavailableKey === 'ext.combat.ui.bonfire_busy') return i18next.t('ext.combat.ui.bonfire_busy');
        if (bonfire.unavailableKey === 'ext.combat.ui.bonfire_gate') return i18next.t('ext.combat.ui.bonfire_gate');
        if (bonfire.unavailableKey === 'ext.combat.ui.bonfire_distance') return i18next.t('ext.combat.ui.bonfire_distance');
        if (bonfire.unavailableKey === 'ext.combat.ui.bonfire_threatened') return i18next.t('ext.combat.ui.bonfire_threatened');
        return i18next.t('ext.combat.ui.bonfire_unavailable');
    }
    return i18next.t('ext.combat.ui.inspect_bonfire');
}
const emit = defineEmits<{ attack: [id: string, event: MouseEvent]; bonfire: [id: number, event: MouseEvent] }>();
</script>
<template>
  <section class="combat-attack-bar" data-testid="combat-attack-bar" @keydown.stop @keyup.stop @pointerdown.stop @touchstart.stop>
    <span class="combat-label">{{ $t('ext.combat.ui.attacks') }}</span>
    <div class="combat-attacks">
      <button v-for="action in model.actions" :key="action.id" type="button" :data-combat-attack="action.id" :data-combat-action="action.id"
        :disabled="blocked || model.readOnly || !action.canUse"
        :title="actionTitle(action)"
        @click="emit('attack', action.id, $event)">{{ $t(action.nameKey) }}</button>
      <button v-for="bonfire in model.bonfires ?? []" :key="`bonfire:${bonfire.entityId}`" type="button"
        class="combat-bonfire-button" :data-combat-bonfire="bonfire.entityId"
        :disabled="blocked || model.readOnly || !bonfire.canUse" :title="`${bonfireTitle(bonfire)} · ${$t('ext.combat.ui.rest_duration', { ticks: bonfire.restTicks })}`"
        @click="emit('bonfire', bonfire.entityId, $event)">
        <span>{{ $t(bonfire.nameKey) }}</span>
        <small v-if="blocked || model.readOnly || !bonfire.canUse">{{ bonfireTitle(bonfire) }}</small>
      </button>
    </div>
    <span v-if="error" class="combat-error" :title="$t('ext.combat.ui.command_rejected')">{{ $t('ext.combat.ui.command_rejected') }}</span>
  </section>
</template>
<style scoped>
.combat-bonfire-button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.combat-bonfire-button small{font-size:10px;max-width:4em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.combat-attack-bar{display:flex;align-items:center;gap:6px;min-width:0;max-width:100%;overflow:hidden;padding:4px 8px;border-top:1px solid var(--th-line,#615638);background:var(--th-panel,#171913);color:var(--th-fg,#d8c9a1);font:12px var(--th-font,monospace);box-sizing:border-box}.combat-label{flex:0 0 auto;color:var(--th-dim,#a5a18e)}.combat-attacks{display:flex;flex:1 1 0;flex-wrap:nowrap;gap:6px;min-width:0;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin}button{flex:0 0 auto;min-height:44px;padding:6px 9px;border:1px solid var(--th-line,#615638);background:var(--th-raised,#282b21);color:inherit;font:inherit;white-space:nowrap;touch-action:manipulation;cursor:pointer}button:disabled{opacity:.48;cursor:default}button:focus-visible{outline:2px solid var(--color-accent,#d8b86a);outline-offset:-3px}.combat-error{flex:0 1 auto;max-width:35%;color:var(--color-danger,#db7878);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(max-width:700px){.combat-attack-bar{gap:4px;padding:3px 6px;font-size:11px}.combat-attacks{gap:4px}button{padding:5px 7px}.combat-label{display:none}}
</style>
