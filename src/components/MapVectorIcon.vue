<script setup lang="ts">
import { computed } from 'vue';
import type { TileSemantic } from '../ui/mapTileSemantics';
import { vectorIconSvg } from '../ui/vectorIconSvg';
const props = defineProps<{ value: TileSemantic }>();
const markup = computed(() => vectorIconSvg(props.value));
</script>
<template><svg class="map-vector-icon" viewBox="0 0 16 16" aria-hidden="true" v-html="markup"></svg></template>
<style scoped>.map-vector-icon {display:block;width:26px;height:26px;flex:0 0 26px;overflow:visible}</style>
