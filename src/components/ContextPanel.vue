<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { activeGame } from '../engine/Core/Game';
import { publicSidebarEntityRows, bodyMemberSummary } from '../engine/UI/MonsterGroups';
import { useGameHud, displayedFrame } from '../ui/useGameHud';
import { nearbyDetail } from '../ui/nearbyInspection';
import type { DetailInfo } from '../engine/UI/DetailGenerator';
const emit = defineEmits<{ close: []; inspect: [detail: DetailInfo] }>();
const rows = ref<ReturnType<typeof publicSidebarEntityRows>>([]);
const { hoverText } = useGameHud(0);
let timer = 0;
function poll() {
 const game = activeGame;
 if (!game?.player) return;
 rows.value = displayedFrame(game)?.rows ?? publicSidebarEntityRows(game);
}
onMounted(() => { poll(); timer = window.setInterval(poll, 100); });
onUnmounted(() => window.clearInterval(timer));
function inspect(entity: ReturnType<typeof publicSidebarEntityRows>[number], event: MouseEvent) {
 const detail = nearbyDetail(activeGame, entity);
 if (!detail) return;
 (event.currentTarget as HTMLElement).focus({ preventScroll: true });
 emit('inspect', detail);
}
</script>
<template>
 <aside class="context-panel">
  <header class="context-heading"><span>{{ $t('sidebar.monsters') }}</span><button :aria-label="$t('mobile.close')" @click="emit('close')">×</button></header>
  <div class="context-entities">
   <button type="button" v-for="entity in rows" :key="`${entity.kind}:${entity.id}`" class="context-entity" :class="{ 'entity-focused': entity.focused }" :data-entity-kind="entity.kind" :data-entity-id="entity.id"
           :title="$t('theme.entity_inspect', { name: entity.name })" @click="inspect(entity, $event)" @keydown.stop @keyup.stop>
    <div class="context-line"><span class="context-dot" :style="{ background: entity.color }"></span><span class="context-name">{{ entity.name }}<small v-if="entity.kind === 'monster' && entity.bodySize" class="body-size">{{ $t('sidebar.body_size', { size: entity.bodySize }) }}</small><small v-else-if="entity.kind === 'monster' && entity.bodyCellCount" class="body-size">{{ $t('sidebar.body_cells', { count: entity.bodyCellCount }) }}</small></span></div>
    <template v-if="entity.kind === 'monster'">
     <div class="context-vital"><div class="context-hp"><i :style="{ width: `${Math.max(0, Math.min(100, entity.hp / Math.max(1, entity.maxHp) * 100))}%`, background: entity.ally ? '#75b89b' : '#be7161' }"></i></div><span>{{ entity.hp }}/{{ entity.maxHp }}</span></div>
     <div v-if="entity.bodyGroup" class="context-members">{{ bodyMemberSummary(entity.bodyGroup) }}</div>
     <div class="context-status"><span v-if="entity.negated">{{ $t('negation.label') }}</span>{{ entity.behavior }}<span v-for="status in entity.statuses" :key="status.id" :style="{ color: status.color }">{{ status.label }} {{ status.value }}</span></div>
    </template>
   </button>
   <p v-if="!rows.length" class="context-empty">{{ $t('theme.context_empty') }}</p>
  </div>
  <div v-if="hoverText" class="context-inspection"><span class="inspection-mark">⌖</span><p>{{ hoverText }}</p></div>
  <footer>{{ $t('theme.inspect_hint') }}</footer>
 </aside>
</template>
