<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import type { MissionActivity } from '../../../engine/Simulation/MissionRuntime';
const props = defineProps<{ reloadRemaining: number; reloadTotal: number; activity: MissionActivity | null; paused: boolean }>();
const { t } = useTranslation();
const activityLabel = computed(() => {
    const activity = props.activity;
    if (!activity) return '';
    if (activity.kind === 'arrival') return t('shooter.progress.arrival');
    if (activity.kind === 'boarding') return t('shooter.progress.boarding');
    if (activity.kind === 'demolition') return t('shooter.progress.demolition');
    return t(activity.labelKey);
});
function remaining(ticks: number, paused: boolean, precise = false): string {
    const seconds = precise ? (ticks / 30).toFixed(1) : Math.ceil(ticks / 30);
    if (paused) return t('shooter.progress.paused', { seconds });
    return t('shooter.progress.seconds', { seconds });
}
</script>

<template>
  <div class="player-progress">
    <div v-if="reloadRemaining > 0" class="activity reload" data-testid="player-progress-reload" :class="{ paused }">
      <div class="caption"><span>{{ t('shooter.progress.reload') }}</span><span>{{ remaining(reloadRemaining, paused, true) }}</span></div>
      <progress :value="reloadTotal - reloadRemaining" :max="reloadTotal" />
    </div>
    <div v-if="activity" class="activity region" data-testid="player-progress-region" :data-kind="activity.kind" :class="{ paused: paused || activity.paused }">
      <div class="caption"><span>{{ activityLabel }}</span><span>{{ remaining(activity.total - activity.progress, paused || activity.paused) }}</span></div>
      <progress :value="activity.progress" :max="activity.total" />
    </div>
  </div>
</template>

<style scoped>
.player-progress { width: 176px; display: grid; gap: 4px; pointer-events: none; }
.activity { --fill: #9dbce8; padding: 5px 7px 6px; border: 1px solid #536258; border-radius: 6px; background: #08130fed; box-shadow: 0 2px 5px #0006; color: #e8efe5; }
.reload { --fill: #e8cf85; }
.caption { display: flex; justify-content: space-between; gap: 4px; font-size: 12px; line-height: 16px; white-space: nowrap; }
progress { display: block; width: 100%; height: 5px; margin-top: 3px; border: none; border-radius: 3px; overflow: hidden; background: #293a31; appearance: none; }
progress::-webkit-progress-bar { background: #293a31; }
progress::-webkit-progress-value { background: var(--fill); }
progress::-moz-progress-bar { background: var(--fill); }
.paused { --fill: #8b9990; color: #bbc8be; border-style: dashed; }
</style>
