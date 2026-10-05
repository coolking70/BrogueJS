<script setup lang="ts">
defineProps<{ entries: readonly { key: string; name: string | null; phase: 'windup' | 'inter-segment' }[]; focused: boolean }>();
</script>
<template>
  <aside class="combat-telegraph-hud" data-testid="combat-telegraph-hud">
    <strong>{{ $t(focused ? 'ext.combat.ui.cell_threats' : 'ext.combat.ui.visible_threats') }}</strong>
    <span v-for="entry in entries" :key="entry.key" :class="entry.phase">
      {{ entry.name ?? $t('ext.combat.ui.public_source') }} · {{ $t(entry.phase === 'windup' ? 'ext.combat.ui.phase.windup' : 'ext.combat.ui.phase.inter-segment') }}
    </span>
  </aside>
</template>
<style scoped>
.combat-telegraph-hud{display:flex;flex-wrap:wrap;gap:4px 10px;max-height:72px;min-width:0;overflow:auto;padding:4px 8px;box-sizing:border-box;font:11px/1.5 var(--th-font,monospace);background:var(--th-panel,#171913);color:var(--th-fg,#d8c9a1)}strong{font-weight:normal;color:var(--th-dim,#a5a18e)}.windup{color:#e89b67}.inter-segment{color:#e2cc80}
</style>
