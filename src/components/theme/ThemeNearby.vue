<script setup lang="ts">
// DESIGN-2：周围实体。读取与 ContextPanel 相同的可见性模型，只读。
import { ref, onMounted, onUnmounted } from 'vue';
import { activeGame } from '../../engine/Core/Game';
import { sidebarEntityRows } from '../../engine/UI/MonsterSidebar';
import { normalizeMapGlyph } from '../../ui/mapGlyph';
type Row = ReturnType<typeof sidebarEntityRows>[number] & { distance: number };
const rows = ref<Row[]>([]);
let timer = 0;
function poll() {
  const game = activeGame;
  if (!game?.player) return;
  const p = game.player;
  rows.value = sidebarEntityRows(game.player, game.grid, game.monsters, game.items, game.hoveredCell, game.depth)
    .map(row => ({ ...row, distance: Math.max(Math.abs(row.loc.x - p.x), Math.abs(row.loc.y - p.y)) }));
}
onMounted(() => { poll(); timer = window.setInterval(poll, 100); });
onUnmounted(() => window.clearInterval(timer));
const pct = (row: Row) => row.kind === 'monster' ? Math.max(0, Math.min(100, row.hp / Math.max(1, row.maxHp) * 100)) : 0;
</script>

<template>
  <section class="theme-nearby">
    <header class="tn-head"><span>{{ $t('sidebar.monsters') }}</span><span class="tn-count th-num">{{ rows.length }}</span></header>
    <ul class="tn-list">
      <li v-for="row in rows" :key="`${row.kind}:${row.id}`" class="tn-row" :class="[`kind-${row.kind}`, { focused: row.focused }]">
        <span class="tn-glyph" :style="{ color: row.color }">{{ normalizeMapGlyph(row.char) }}</span>
        <span class="tn-name">{{ row.name }}<small v-if="row.kind === 'monster'" class="tn-behavior">{{ row.behavior }}</small></span>
        <span v-if="row.kind === 'monster'" class="tn-hp"><i :style="{ width: `${pct(row)}%`, background: row.ally ? 'var(--th-ok)' : 'var(--th-hp)' }"></i></span>
        <span v-if="row.kind === 'monster'" class="tn-hpnum th-num">{{ row.hp }}/{{ row.maxHp }}</span>
        <span class="tn-dist th-num">{{ row.distance }}</span>
        <span v-if="row.kind === 'monster' && row.statuses.length" class="tn-statuses"><span v-for="s in row.statuses" :key="s.id" :style="{ color: s.color }">{{ s.label }} {{ s.value }}</span></span>
      </li>
    </ul>
    <p v-if="!rows.length" class="tn-empty">{{ $t('theme.context_empty') }}</p>
  </section>
</template>
