<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import type { CraftingUiView } from './view';
defineProps<{ ticket: NonNullable<CraftingUiView['activeTicket']>; presentationHidden?: boolean }>();
const { t } = useTranslation();
</script>
<template>
  <div class="crafting-work-hud" :class="{ 'presentation-hidden': presentationHidden }" :inert="presentationHidden || undefined" :aria-hidden="presentationHidden || undefined">
    <span class="crafting-work-name">{{ t(ticket.nameKey) }}</span>
    <span class="crafting-work-batch">{{ t('ext.crafting.ui.work.active', { name: '', done: Math.min(ticket.completedBatches + 1, ticket.totalBatches), total: ticket.totalBatches }) }}</span>
    <span>{{ t('ext.crafting.ui.work.remaining', { ticks: ticket.remainingTicks }) }}</span>
  </div>
</template>
<style scoped>
.crafting-work-hud{display:flex;align-items:center;gap:.6rem;min-width:0;max-width:100%;box-sizing:border-box;padding:.3rem .5rem;border:1px solid var(--th-line,#555);background:var(--th-panel,#171918);font:12px var(--th-font,monospace);color:var(--th-fg,#e4dfd1)}
.crafting-work-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.crafting-work-batch,.crafting-work-hud>span:last-child{flex:none;font-variant-numeric:tabular-nums}.presentation-hidden{visibility:hidden;pointer-events:none}
@media(max-width:700px){
:global(html[data-ui-concept=glyph] .app-layout.immersive-mode .theme-hud:has(.crafting-work-hud)){flex-wrap:wrap!important}
.crafting-work-hud{order:3;flex:1 0 100%;width:100%;font-size:11px;padding:.2rem .4rem;gap:.4rem}.crafting-work-name{flex:1}
}
</style>
