<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { foldCombatMessages, logger, type LogMessage } from '../engine/Systems/Logger';
const logs = ref<LogMessage[]>([]);
let timer = 0;
function poll() { logs.value = foldCombatMessages(logger.messages).slice().reverse(); }
onMounted(() => { poll(); timer = window.setInterval(poll, 100); });
onUnmounted(() => window.clearInterval(timer));
</script>
<template>
 <section class="message-journal">
  <h2>{{ $t('sidebar.log') }}</h2>
  <div class="journal-entries" role="log">
   <p v-if="!logs.length">{{ $t('lab.journal_empty') }}</p>
   <div v-for="(msg,index) in logs" :key="msg.id" :class="{ latest:index === 0, acknowledge:msg.acknowledge }" :style="{ color:msg.color }"><span class="journal-tick">{{ String(logs.length-index).padStart(2, '0') }}</span><span>{{ msg.text }}<small v-if="msg.count > 1"> ×{{ msg.count }}</small></span></div>
  </div>
 </section>
</template>
