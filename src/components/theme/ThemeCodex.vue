<script setup lang="ts">
// DESIGN-2（夜读）：分页手记。四个页签只切换显示；「背包」页经 dispatch 打开背包。
import { ref } from 'vue';
import ThemeHud from './ThemeHud.vue';
import ThemeLog from './ThemeLog.vue';
import ThemeNearby from './ThemeNearby.vue';
import ThemeKit from './ThemeKit.vue';
const emit = defineEmits<{ (e: 'menu'): void; (e: 'open-journal'): void; (e: 'tab', same: boolean): void }>();
function pick(name: Tab) { const same = tab.value === name; tab.value = name; emit('tab', same); }
type Tab = 'status' | 'log' | 'nearby' | 'pack';
const tab = ref<Tab>('status');
const tabs: Tab[] = ['status', 'log', 'nearby', 'pack'];
</script>

<template>
  <aside class="theme-codex" :data-tab="tab">
    <nav class="tc-tabs" role="tablist" @keydown.stop @keyup.stop>
      <button v-for="name in tabs" :key="name" role="tab" :aria-selected="tab === name" :data-tab-button="name" @click="pick(name); ($event.currentTarget as HTMLElement).blur()">
        <template v-if="name === 'status'">{{ $t('theme.tab_status') }}</template>
        <template v-else-if="name === 'log'">{{ $t('theme.tab_log') }}</template>
        <template v-else-if="name === 'nearby'">{{ $t('theme.tab_nearby') }}</template>
        <template v-else>{{ $t('theme.tab_pack') }}</template>
      </button>
    </nav>
    <div class="tc-page">
      <div v-show="tab === 'status'" class="tc-status"><ThemeHud :show-panel-button="false" @menu="emit('menu')" /><ThemeNearby class="tc-near-mini" /></div>
      <ThemeLog v-if="tab === 'log'" :lines="40" @open-journal="emit('open-journal')" />
      <ThemeNearby v-if="tab === 'nearby'" />
      <ThemeKit v-if="tab === 'pack'" />
    </div>
  </aside>
</template>
