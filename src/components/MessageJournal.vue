<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue';
import { activeGame } from '../engine/Core/Game';
import { displayedFrame } from '../ui/useGameHud';
import { foldCombatMessages, logger, type LogMessage } from '../engine/Systems/Logger';
const logs = ref<LogMessage[]>([]);
const entries = ref<HTMLElement>();
let timer = 0;
function poll() { logs.value = foldCombatMessages(displayedFrame(activeGame)?.logs ?? logger.messages).slice().reverse(); }
onMounted(async () => {
 poll(); timer = window.setInterval(poll, 100);
 await nextTick();
 // Newest-first journal: reopen at the latest entry, without moving the reader
 // back to the top on every subsequent message poll.
 if (entries.value) entries.value.scrollTop = 0;
});
onUnmounted(() => window.clearInterval(timer));
</script>
<template>
 <section class="message-journal">
  <h2>{{ $t('sidebar.log') }}</h2>
  <div ref="entries" class="journal-entries" role="log" tabindex="0">
   <p v-if="!logs.length">{{ $t('theme.journal_empty') }}</p>
   <div v-for="(msg,index) in logs" :key="msg.id" :class="{ latest:index === 0, acknowledge:msg.acknowledge }" :style="{ color:msg.color }"><span class="journal-tick">{{ String(logs.length-index).padStart(2, '0') }}</span><span>{{ msg.text }}<small v-if="msg.count > 1"> ×{{ msg.count }}</small></span></div>
  </div>
 </section>
</template>
