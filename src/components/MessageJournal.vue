<script setup lang="ts">
import { computed, ref, nextTick, onMounted, onUnmounted } from 'vue';
import { activeGame } from '../engine/Core/Game';
import { displayedFrame } from '../ui/useGameHud';
import { foldCombatMessages, logger, type LogMessage } from '../engine/Systems/Logger';
const logs = ref<LogMessage[]>([]);
const entries = ref<HTMLElement>();
let timer = 0;
const PAGE_SIZE = 100;
const page = ref(0);
const pageCount = computed(() => Math.max(1, Math.ceil(logs.value.length / PAGE_SIZE)));
const visibleLogs = computed(() => logs.value.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE));
let signature = '';
function poll() {
 const next = foldCombatMessages(displayedFrame(activeGame)?.logs ?? logger.messages).slice().reverse();
 const key = JSON.stringify(next);
 if (key === signature) return;
 signature = key; logs.value = next;
 page.value = Math.min(page.value, pageCount.value - 1);
}
async function turnPage(delta: number) {
 page.value = Math.max(0, Math.min(pageCount.value - 1, page.value + delta));
 await nextTick();
 if (entries.value) entries.value.scrollTop = 0;
}
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
  <nav v-if="pageCount > 1" class="journal-pages">
   <button :disabled="page === 0" @click="turnPage(-1)" @keydown.stop @keyup.stop>{{ $t('theme.journal_newer') }}</button>
   <span>{{ $t('theme.journal_page', { page: page + 1, pages: pageCount }) }}</span>
   <button :disabled="page + 1 >= pageCount" @click="turnPage(1)" @keydown.stop @keyup.stop>{{ $t('theme.journal_older') }}</button>
  </nav>
  <div ref="entries" class="journal-entries" role="log" tabindex="0">
   <p v-if="!logs.length">{{ $t('theme.journal_empty') }}</p>
   <div v-for="(msg,index) in visibleLogs" :key="msg.id" :class="{ latest:page === 0 && index === 0, acknowledge:msg.acknowledge }" :style="{ color:msg.color }"><span class="journal-tick">{{ String(logs.length-page*PAGE_SIZE-index).padStart(2, '0') }}</span><span>{{ msg.text }}<small v-if="msg.count > 1"> ×{{ msg.count }}</small></span></div>
  </div>
 </section>
</template>

<style scoped>
.journal-pages { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.journal-pages button { color: inherit; background: var(--th-raised); border: 1px solid var(--th-line); padding: 6px 12px; }
.journal-pages button:disabled { opacity: 0.4; }
</style>
