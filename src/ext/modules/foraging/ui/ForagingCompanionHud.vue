<script setup lang="ts">
import i18next from 'i18next';
import type { ForagingCompanionCard } from './view';
defineProps<{ companions: ForagingCompanionCard[]; presentationHidden?: boolean }>();
const t = (key: string) => i18next.t(key);
</script>
<template>
  <section class="foraging-hud" :class="{ 'presentation-hidden': presentationHidden }" :aria-label="t('ext.foraging.ui.hud.title')" :inert="presentationHidden || undefined" :aria-hidden="presentationHidden || undefined">
    <div v-for="companion in companions" :key="companion.actorId" class="foraging-hud-row"><span class="foraging-hud-name">{{ companion.displayName }}</span><span> · {{ t(`ext.foraging.band.${companion.band}`) }}<template v-if="companion.departing"> · {{ t('ext.foraging.band.departing') }}</template></span></div>
  </section>
</template>
<style scoped>
.foraging-hud{min-width:0;max-height:96px;overflow:auto;padding:3px 8px;border-bottom:1px solid var(--th-line,#555);color:var(--th-fg,#e4dfd1);background:var(--th-panel,#171918);font:12px var(--th-font,monospace)}.foraging-hud-row{display:flex;gap:2px;min-width:0;line-height:1.5}.foraging-hud-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.foraging-hud-row>span:last-child{flex:none;color:var(--th-warn,#e3aa76)}.presentation-hidden{visibility:hidden;pointer-events:none}
</style>
