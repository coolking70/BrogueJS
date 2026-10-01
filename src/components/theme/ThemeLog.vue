<script setup lang="ts">
// UI-4：固定消息/描述行占位；整个消息区打开现有完整日志抽屉。
import { useGameHud } from '../../ui/useGameHud';
const props = withDefaults(defineProps<{ lines?: number; singleLine?: boolean }>(), { lines: 5, singleLine: false });
const emit = defineEmits<{ (e: 'open-journal'): void }>();
const { logs, hoverText } = useGameHud(() => props.lines);
function openJournal(event?: MouseEvent) { event?.stopPropagation(); emit('open-journal'); }
</script>

<template>
  <section class="theme-log" :class="{ 'single-line': singleLine, 'has-messages': logs.length > 0 }" :style="{ '--log-lines': lines }" role="log" aria-live="polite"
           tabindex="0" :title="$t('theme.journal_open')" @click="emit('open-journal')" @keydown.stop @keyup.stop @keydown.enter.self.prevent="emit('open-journal')">
    <button class="tl-head" @click="openJournal" @keydown.stop @keyup.stop><span>{{ $t('sidebar.log') }}</span><span class="tl-more" aria-hidden="true">↗</span></button>
    <p class="tl-flavor" :class="{ empty: !hoverText }" :aria-hidden="singleLine && logs.length > 0">{{ hoverText }}</p>
    <ol class="tl-lines">
      <li v-for="(msg, index) in logs" :key="msg.id" :class="[`age-${Math.min(index, 4)}`, { acknowledge: msg.acknowledge }]" :style="{ color: msg.color }">
        <span class="tl-turn">{{ msg.turn }}</span><span class="tl-text">{{ msg.text }}<span v-if="msg.count > 1" class="tl-count">×{{ msg.count }}</span></span>
      </li>
    </ol>
    <button v-if="singleLine" class="tl-open" :aria-label="$t('sidebar.log')" @click="openJournal" @keydown.stop @keyup.stop><span aria-hidden="true">↗</span></button>
  </section>
</template>
