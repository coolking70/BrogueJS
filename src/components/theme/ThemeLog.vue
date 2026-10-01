<script setup lang="ts">
// DESIGN-2：位置描述行 + 最近消息。只读；点标题打开完整日志抽屉。
import { useGameHud } from '../../ui/useGameHud';
const props = withDefaults(defineProps<{ lines?: number; singleLine?: boolean }>(), { lines: 5, singleLine: false });
const emit = defineEmits<{ (e: 'open-journal'): void }>();
const { logs, hoverText } = useGameHud(() => props.lines);
</script>

<template>
  <section class="theme-log" :class="{ 'single-line': singleLine }" role="log" aria-live="polite">
    <button class="tl-head" @click="emit('open-journal')" @keydown.stop @keyup.stop><span>{{ $t('sidebar.log') }}</span><span class="tl-more" aria-hidden="true">↗</span></button>
    <p v-if="!singleLine || !logs.length" class="tl-flavor" :class="{ empty: !hoverText }">{{ hoverText }}</p>
    <ol class="tl-lines">
      <li v-for="(msg, index) in logs" :key="msg.id" :class="[`age-${Math.min(index, 4)}`, { acknowledge: msg.acknowledge }]" :style="{ color: msg.color }">
        <span class="tl-turn">{{ msg.turn }}</span><span class="tl-text">{{ msg.text }}<span v-if="msg.count > 1" class="tl-count">×{{ msg.count }}</span></span>
      </li>
    </ol>
    <button v-if="singleLine" class="tl-open" :aria-label="$t('sidebar.log')" @click="emit('open-journal')" @keydown.stop @keyup.stop><span aria-hidden="true">↗</span></button>
  </section>
</template>
