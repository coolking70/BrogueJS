<script setup lang="ts">
// DESIGN-2（军械）：装备与随身消耗品一览。只读；点按打开背包（经 dispatch 进入命令边界）。
import { ref, onMounted, onUnmounted } from 'vue';
import { activeGame } from '../../engine/Core/Game';
import { ItemCategory } from '../../engine/Items/Item';
import { dispatch } from '../../ui/commands';
import { normalizeMapGlyph } from '../../ui/mapGlyph';
import { useTranslation } from 'i18next-vue';
const { t } = useTranslation();
interface Slot { key: string; label: string; name: string; char: string; color: string; count: number }
const slots = ref<Slot[]>([]);
const hex = (c: number) => `#${(c >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
// i18n 键必须是字面量（p1_30 扫描器要求首参可静态解析）
const CATS: Array<[ItemCategory, () => string]> = [[ItemCategory.POTION, () => t('inventory.category.potions')], [ItemCategory.SCROLL, () => t('inventory.category.scrolls')], [ItemCategory.FOOD, () => t('inventory.category.food')], [ItemCategory.WAND, () => t('inventory.category.wands')], [ItemCategory.STAFF, () => t('inventory.category.staffs')]];
let timer = 0;
function poll() {
  const p = activeGame?.player;
  if (!p) return;
  const items = p.inventory.items;
  const eq = [p.equippedWeapon, p.equippedArmor, ...p.rings()].filter(Boolean);
  const out: Slot[] = eq.map((it, i) => ({ key: `eq${i}`, label: '', name: it!.displayName, char: it!.char, color: hex(it!.color), count: it!.quantity }));
  for (const [cat, label] of CATS) {
    const list = items.filter(it => it.category === cat);
    if (list.length) out.push({ key: `c${cat}`, label: label(), name: '', char: list[0]!.char, color: hex(list[0]!.color), count: list.reduce((n, it) => n + it.quantity, 0) });
  }
  slots.value = out;
}
onMounted(() => { poll(); timer = window.setInterval(poll, 250); });
onUnmounted(() => window.clearInterval(timer));
function open() { (document.activeElement as HTMLElement)?.blur(); dispatch('toggle_inventory'); }
</script>

<template>
  <section class="theme-kit">
    <header class="tk-head"><span>{{ $t('theme.kit') }}</span></header>
    <button v-for="s in slots" :key="s.key" class="tk-slot" :class="{ equipped: s.key.startsWith('eq') }" @click="open" @keydown.stop @keyup.stop>
      <span class="tk-glyph" :style="{ color: s.color }">{{ normalizeMapGlyph(s.char) }}</span>
      <span class="tk-name">{{ s.label || s.name }}</span>
      <span class="tk-count th-num">{{ s.count }}</span>
    </button>
  </section>
</template>
