<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import type { LootAffixRowView } from './types';
defineProps<{ row: LootAffixRowView }>();
const { t } = useTranslation();
</script>
<template>
  <li class="loot-affix-row" :class="{ 'loot-affix-unknown': !row.known, 'loot-affix-negative': row.negative }" :data-position="row.position" :data-known="row.known">
    <div class="loot-affix-heading">
      <span v-if="row.name">{{ t(row.name.nameKey, row.name.params) }}</span>
      <span v-else-if="!row.known">{{ t(row.position === 'prefix' ? 'ext.loot.ui.unknown.prefix' : row.position === 'suffix' ? 'ext.loot.ui.unknown.suffix' : 'ext.loot.ui.unknown.row') }}</span>
      <span v-if="row.tier !== null" class="loot-affix-tier">{{ t('ext.loot.ui.tier', { tier: row.tier }) }}</span>
    </div>
    <div v-for="(line, index) in row.lines" :key="index" class="loot-affix-line" :class="`loot-affix-tone-${line.tone}`">
      <span class="loot-affix-value">{{ line.value }}</span>
      <span>{{ t(line.stat.nameKey, line.stat.params) }}</span>
      <span v-if="line.runic">{{ t(line.runic.nameKey, line.runic.params) }}</span>
      <span v-if="line.condition" class="loot-affix-condition">{{ t(line.condition.nameKey, line.condition.params) }}</span>
    </div>
  </li>
</template>
<style>
.loot-affix-row {
  --loot-bg: var(--th-panel, #0d0d0c); --loot-raised: var(--th-raised, #181815);
  --loot-fg: var(--th-fg, #e4dfd1); --loot-dim: var(--th-dim, #9e998d);
  --loot-line: var(--th-line, #34322c); --loot-good: var(--th-ok, #8fbf6a);
  --loot-bad: var(--th-hp, #d9503f); --loot-focus: var(--th-accent, #e4dfd1);
  box-sizing: border-box; min-width: 0; max-width: 100%; container-type: inline-size;
  color: var(--loot-fg); background: var(--loot-bg); font-family: var(--th-font, monospace);
  border-radius: var(--th-r, 0); overflow-wrap: anywhere; line-height: 1.5;
}
.loot-affix-row:is([data-loot-theme="light"], [data-loot-theme="light"] *) {
  --loot-bg: #f4f1e8; --loot-raised: #ebe6d8; --loot-fg: #1f1d18; --loot-dim: #5d584c;
  --loot-line: #b9b2a0; --loot-good: #2f6b1f; --loot-bad: #a3271b; --loot-focus: #1f1d18;
}
.loot-affix-row { list-style: none; padding: 10px 0; border-bottom: 1px solid var(--loot-line); }
.loot-affix-heading, .loot-affix-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; min-width: 0; }
.loot-affix-heading { font-weight: 600; }
.loot-affix-tier, .loot-affix-condition { color: var(--loot-dim); font-size: .85em; }
.loot-affix-value { font-variant-numeric: tabular-nums; }
.loot-affix-tone-good { color: var(--loot-good); }
.loot-affix-tone-bad, .loot-affix-negative .loot-affix-heading, .loot-affix-negative .loot-affix-line { color: var(--loot-bad); }
.loot-affix-unknown { color: var(--loot-dim); font-style: italic; }
@container (max-width: 359px) { .loot-affix-condition { flex-basis: 100%; } }

</style>
