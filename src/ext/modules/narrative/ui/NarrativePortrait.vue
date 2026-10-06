<script setup lang="ts">
import { computed, ref } from 'vue';
import type { NarrativePortraitView } from './portraits';
const props = defineProps<{ portrait: NarrativePortraitView }>();
const failedUrl = ref<string | null>(null), loadedUrl = ref<string | null>(null);
// Capture this image's URL: a late error from a removed image cannot blank a
// newer expression. Error handling changes only this local presentation ref.
const image = computed(() => {
    const url = props.portrait.url;
    return { url, load: () => { if (props.portrait.url === url) loadedUrl.value = url; },
        fail: () => { if (props.portrait.url === url) failedUrl.value = url; } };
});
</script>
<template>
  <span class="narrative-portrait" data-testid="narrative-portrait" :data-portrait-id="portrait.id"
    :data-portrait-fallback="!image.url || failedUrl === image.url || loadedUrl !== image.url">
    <img v-if="image.url && failedUrl !== image.url" :key="image.url" :src="image.url" :alt="$t(portrait.altKey)"
      :width="portrait.width" :height="portrait.height" draggable="false" :class="{ 'portrait-loading': loadedUrl !== image.url }" v-on="{ error: image.fail, load: image.load }">
    <span v-if="!image.url || failedUrl === image.url || loadedUrl !== image.url" class="narrative-portrait-fallback" role="img" :aria-label="$t(portrait.altKey)">{{ portrait.fallbackGlyph }}</span>
  </span>
</template>
<style scoped>
.narrative-portrait{display:flex;position:relative;width:100%;height:100%;min-width:0;min-height:0;align-items:flex-end;justify-content:center;overflow:hidden;background:var(--bg-deep,#11130f)}
.narrative-portrait img{display:block;width:100%;height:100%;object-fit:contain;object-position:bottom center;image-rendering:crisp-edges;image-rendering:pixelated;pointer-events:none;user-select:none}
.narrative-portrait img.portrait-loading{position:absolute;opacity:0}
.narrative-portrait-fallback{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font:clamp(24px,5vw,72px) var(--font-main,monospace);line-height:1;color:var(--text-secondary,#a5a18e)}
</style>
