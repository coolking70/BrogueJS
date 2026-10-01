<script setup lang="ts">
// DESIGN-2：命令线性图标（纯 SVG 路径，无文字）。未知动作不渲染。
import { computed } from 'vue';
const props = defineProps<{ action: string; direction?: unknown }>();
const PATHS: Record<string, string> = {
  auto_explore: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M15.5 8.5l-2 5-5 2 2-5z',
  search: 'M11 5a6 6 0 1 0 0 12a6 6 0 1 0 0-12M20 20l-4.5-4.5',
  search_long: 'M10 6a5 5 0 1 0 0 10a5 5 0 1 0 0-10M17.5 17.5l-3.5-3.5M18 4v4M16 6h4',
  wait: 'M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z',
  auto_rest: 'M17 13.5A6.5 6.5 0 0 1 8.5 5a6.5 6.5 0 1 0 8.5 8.5zM16 4h4l-4 4h4',
  pickup: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14',
  toggle_inventory: 'M6 8h12v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zM9 8V6a3 3 0 0 1 6 0v2M9 13h6',
  throw_item: 'M4 20L18 6M12 6h6v6',
  escape: 'M6 6l12 12M18 6L6 18',
  discoveries: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h5',
  help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  stairs_up: 'M4 19h4v-4h4v-4h4V7h4M14 5l3-3 3 3',
  stairs_down: 'M4 7h4v4h4v4h4v4h4M14 19l3 3 3-3',
};
const d = computed(() => props.action === 'travel_stairs' ? PATHS[props.direction === 'up' ? 'stairs_up' : 'stairs_down'] : PATHS[props.action]);
</script>

<template>
  <svg v-if="d" class="cmd-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path :d="d" /></svg>
</template>

<style scoped>
.cmd-icon { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
</style>
