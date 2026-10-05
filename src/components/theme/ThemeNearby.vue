<script setup lang="ts">
// UI-4：周围实体。可见性与详情都通过只读显示模型；不派发游戏命令。
import { ref, onMounted, onUnmounted } from 'vue';
import { activeGame } from '../../engine/Core/Game';
import { publicSidebarEntityRows, bodyMemberSummary } from '../../engine/UI/MonsterGroups';
import { normalizeMapGlyph } from '../../ui/mapGlyph';
import { nearbyDetail } from '../../ui/nearbyInspection';
import { displayedFrame } from '../../ui/useGameHud';
import type { DetailInfo } from '../../engine/UI/DetailGenerator';
const emit = defineEmits<{ inspect: [detail: DetailInfo] }>();
type Row = ReturnType<typeof publicSidebarEntityRows>[number] & { distance: number };
const rows = ref<Row[]>([]);
let timer = 0;
function poll() {
  const game = activeGame;
  if (!game?.player) return;
  const frame = displayedFrame(game);
  const p = frame?.player ?? game.player;
  rows.value = (frame?.rows ?? publicSidebarEntityRows(game))
    .map(row => ({ ...row, distance: row.kind === 'monster' && row.distance !== undefined ? row.distance : Math.max(Math.abs(row.loc.x - p.x), Math.abs(row.loc.y - p.y)) }));
}
onMounted(() => { poll(); timer = window.setInterval(poll, 100); });
onUnmounted(() => window.clearInterval(timer));
const pct = (row: Row) => row.kind === 'monster' ? Math.max(0, Math.min(100, row.hp / Math.max(1, row.maxHp) * 100)) : 0;
function inspect(row: Row, event: MouseEvent) {
  const detail = nearbyDetail(activeGame, row);
  if (!detail) return;
  (event.currentTarget as HTMLElement).focus({ preventScroll: true });
  emit('inspect', detail);
}
</script>

<template>
  <section class="theme-nearby">
    <header class="tn-head"><span>{{ $t('sidebar.monsters') }}</span><span class="tn-count th-num">{{ rows.length }}</span></header>
    <ul class="tn-list">
      <li v-for="row in rows" :key="`${row.kind}:${row.id}`">
       <button type="button" class="tn-row" :class="[`kind-${row.kind}`, { focused: row.focused }]" :data-entity-kind="row.kind" :data-entity-id="row.id"
               :title="$t('theme.entity_inspect', { name: row.name })" @click="inspect(row, $event)" @keydown.stop @keyup.stop>
        <span class="tn-glyph" :style="{ color: row.color }">{{ normalizeMapGlyph(row.char) }}</span>
        <span class="tn-name">{{ row.name }}<small v-if="row.kind === 'monster' && row.bodySize" class="body-size">{{ $t('sidebar.body_size', { size: row.bodySize }) }}</small><small v-else-if="row.kind === 'monster' && row.bodyCellCount" class="body-size">{{ $t('sidebar.body_cells', { count: row.bodyCellCount }) }}</small><small v-if="row.kind === 'monster'" class="tn-behavior">{{ row.behavior }}</small></span>
        <span v-if="row.kind === 'monster'" class="tn-hp"><i :style="{ width: `${pct(row)}%`, background: row.ally ? 'var(--th-ok)' : 'var(--th-hp)' }"></i></span>
        <span v-if="row.kind === 'monster'" class="tn-hpnum th-num">{{ row.hp }}/{{ row.maxHp }}</span>
        <span class="tn-dist th-num">{{ row.distance }}</span>
        <span v-if="row.kind === 'monster' && row.bodyGroup" class="tn-members">{{ bodyMemberSummary(row.bodyGroup) }}</span>
        <span v-if="row.kind === 'monster' && row.statuses.length" class="tn-statuses"><span v-for="s in row.statuses" :key="s.id" :style="{ color: s.color }">{{ s.label }} {{ s.value }}</span></span>
       </button>
      </li>
    </ul>
    <p v-if="!rows.length" class="tn-empty">{{ $t('theme.context_empty') }}</p>
  </section>
</template>
