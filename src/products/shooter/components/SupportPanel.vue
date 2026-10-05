<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import type { SupportView } from '../../../engine/Simulation/SupportRuntime';
defineProps<{ view: SupportView; disabled: boolean; selected: number | null; valid: boolean }>();
const emit=defineEmits<{select:[slot:number];confirm:[];cancel:[]}>();
const {t}=useTranslation();
</script>
<template>
  <section class="support-panel" data-testid="support-panel">
    <div class="support-heading"><strong>{{ t('shooter.support.title') }}</strong><span>{{ t('shooter.support.keys') }}</span></div>
    <div class="support-grid">
      <button v-for="a in view.abilities" :key="a.slot" :data-testid="'support-' + a.slot" :class="{selected: selected===a.slot, danger:a.dangerous}"
        :disabled="disabled || a.remaining>0" @click="emit('select',a.slot)">
        <strong>{{ a.slot+5 }} · {{ t(a.labelKey) }}</strong><small>{{ a.remaining ? t('shooter.support.cooldown',{seconds:Math.ceil(a.remaining/30)}) : t('shooter.support.ready',{seconds:a.delay/30}) }}</small>
        <progress :value="a.cooldown-a.remaining" :max="a.cooldown" />
      </button>
    </div>
    <div v-if="selected!==null" class="target-controls" data-testid="support-target-controls">
      <span>{{ t('shooter.support.targetHelp') }} <b v-if="view.abilities[selected]!.dangerous">{{ t('shooter.support.danger') }}</b></span>
      <button class="primary" data-testid="support-confirm" :disabled="disabled || !valid" @click="emit('confirm')">{{ t('shooter.support.confirm') }}</button>
      <button data-testid="support-cancel" @click="emit('cancel')">{{ t('shooter.support.cancel') }}</button>
    </div>
    <p v-if="view.notice" class="support-notice" data-testid="support-notice" aria-live="polite">{{ t('shooter.support.notice.'+view.notice.code) }}</p>
    <p class="support-help">{{ t('shooter.support.help') }}</p>
  </section>
</template>
<style scoped>
.support-panel{margin:12px 0;padding:12px;border:1px solid #355449;border-radius:10px;background:#14251e}.support-heading{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:10px}.support-heading span{color:#91b2a5;font-size:11px}.support-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.support-grid button{text-align:left;padding:10px;min-width:0}.support-grid strong{font-size:12px}.support-grid small{display:block;color:#a7c9b5;margin-top:5px;font-size:11px}.support-grid progress{width:100%;height:3px;accent-color:#8bddd0;margin-top:7px}.support-grid .selected{border-color:#8bddd0;background:#244239}.support-grid .danger{color:#f7c4ae}.target-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.target-controls span{flex:1;font-size:12px;line-height:1.7;min-width:180px}.target-controls b{color:#ffae8d}.support-help,.support-notice{font-size:11px;line-height:1.7;color:#96b3a2;margin:8px 0 0}.support-notice{color:#d2ef9b}
@media(max-width:600px){.support-grid{grid-template-columns:repeat(2,1fr);gap:6px}.support-heading{flex-wrap:wrap}.support-panel{padding:10px}.target-controls span{flex-basis:100%}}
</style>
