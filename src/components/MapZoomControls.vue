<script setup lang="ts">
// Map controls remain available at every viewport size, including at zoom limits.
import { cameraState, zoomBy, recenterCamera, fitMap, MAX_ZOOM, MIN_ZOOM } from '../ui/mapCamera';
</script>

<template>
  <div class="map-zoom">
    <button :aria-label="$t('mobile.zoom_in')" :title="$t('mobile.zoom_in')" :disabled="cameraState.zoom >= MAX_ZOOM" @click="zoomBy(1.25)">+</button>
    <button :aria-label="$t('mobile.zoom_out')" :title="$t('mobile.zoom_out')" :disabled="cameraState.fit || cameraState.zoom <= MIN_ZOOM || (!cameraState.follow && cameraState.zoom <= 1)" @click="zoomBy(1 / 1.25)">−</button>
    <button :aria-label="$t('mobile.fit_map', { defaultValue: 'Fit map' })" :title="$t('mobile.fit_map', { defaultValue: 'Fit map' })" @click="fitMap()">⛶</button>
    <button :aria-label="$t('mobile.recenter')" :title="$t('mobile.recenter')" :disabled="!cameraState.follow" @click="recenterCamera()">◎</button>
  </div>
</template>

<style scoped>
.map-zoom {
  position: absolute;
  top: 8px;
  right: max(8px, env(safe-area-inset-right));
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 15;
}
button {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--panel-border, #ffffff26);
  background: color-mix(in srgb, var(--btn-bg) 85%, transparent);
  color: var(--text-primary);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
}
button:active { background: var(--btn-bg-active, #2d3445); }
button:hover:not(:disabled) { background: var(--btn-bg-active, #2d3445); }
</style>
