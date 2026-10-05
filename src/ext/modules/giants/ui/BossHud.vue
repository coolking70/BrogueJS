<script setup lang="ts">
import i18next from 'i18next';
import type { BossHudModel } from './view';
import { zoneStatusText } from '../../../../engine/UI/MonsterZones';
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
    <div v-if="model.zone" class="boss-zone">{{ zoneStatusText(model.zone) }}</div>
    <div v-if="model.descendants" class="boss-members">{{ i18next.t('ext.giants.ui.descendants', { count: model.descendants }) }}</div>
    <div v-if="model.members" class="boss-members">{{ model.members.broken === undefined
      ? i18next.t('ext.giants.ui.members_visible', { alive: model.members.alive })
      : i18next.t('ext.giants.ui.members', { alive: model.members.alive, broken: model.members.broken }) }}</div>
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
.boss-zone, .boss-members {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  line-height: 1.2;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.presentation-hidden {
  visibility: hidden;
  pointer-events: none;
}
</style>
