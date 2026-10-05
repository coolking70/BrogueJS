<script setup lang="ts">
import i18next from 'i18next';
import type { BossHudModel } from './view';
defineProps<{ model: BossHudModel; presentationHidden?: boolean }>();
</script>
<template>
  <div class="giants-boss-hud" :class="{ 'presentation-hidden': presentationHidden }">
    <div class="boss-summary">
      <span class="boss-name" :style="{ color: model.color }">{{ model.name }}</span
      ><span class="boss-hp">{{
        i18next.t('ext.giants.ui.hp', { current: model.hp, maximum: model.maxHp })
      }}</span>
    </div>
    <div class="boss-health" :title="i18next.t('ext.giants.ui.health', { name: model.name })">
      <div
        :style="{
          width: `${Math.max(0, Math.min(100, (model.hp / model.maxHp) * 100))}%`,
          background: model.color
        }"
      />
    </div>
  </div>
</template>
<style scoped>
.giants-boss-hud {
  width: min(100%, 26rem);
  min-width: 0;
  box-sizing: border-box;
  padding: 0.35rem 0.5rem;
  background: rgba(20, 18, 16, 0.92);
  border: 1px solid #685847;
}
.boss-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  font-size: 0.82rem;
  line-height: 1.3;
}
.boss-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.boss-hp {
  flex: none;
  font-variant-numeric: tabular-nums;
}
.boss-health {
  margin-top: 0.25rem;
  height: 5px;
  background: #25211d;
}
.boss-health > div {
  height: 100%;
}
.presentation-hidden {
  visibility: hidden;
  pointer-events: none;
}
</style>
