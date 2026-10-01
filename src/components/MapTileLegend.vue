<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import MapVectorIcon from './MapVectorIcon.vue';
import { mapMode } from '../ui/mapTiles';
import type { TileKind } from '../ui/mapTileSemantics';
import { mapText } from '../ui/mapTileSemantics';
import { TERRAIN_TEXT_IDS } from '../engine/UI/TerrainTextCatalog';
import { TerrainType } from '../engine/Map/Grid';
import content from '../locales/zh_CN.content.json';
import monsters from '../data/monsters.json';
import { ItemLoader } from '../engine/Items/ItemLoader';
const emit = defineEmits<{ close: [] }>();
const { t } = useTranslation();
const query = ref('');
const group = ref('common');
const tabs = computed(() => [
 {id:'common',label:t('map.group_common')}, {id:'terrain',label:t('map.group_terrain')}, {id:'monster',label:t('map.group_monster')}, {id:'item',label:t('map.group_item')},
]);
const itemLabels = computed(() => [t('map.item_0'),t('map.item_1'),t('map.item_2'),t('map.item_3'),t('map.item_4'),t('map.item_5'),t('map.item_6'),t('map.item_7'),t('map.item_8'),t('map.item_9'),t('map.item_10'),t('map.item_11'),t('map.item_12')]);
const rows = computed(() => {
 const terrain = Object.entries(mapText.terrain).map(([id, glyph]) => {
   const key = TERRAIN_TEXT_IDS[TerrainType[id as keyof typeof TerrainType]];
   const entry = key in content.terrain ? content.terrain[key as keyof typeof content.terrain] : content.webTerrain[key as keyof typeof content.webTerrain];
   return { id, glyph, kind:'terrain' as TileKind, label: entry?.description ?? t('map.unknown') };
 });
 const creature = monsters.map(m => ({id:m.id.toLowerCase(), kind:'monster' as TileKind, glyph:mapText.monsters[m.id.toLowerCase() as keyof typeof mapText.monsters], label:ItemLoader.translateName(m.name)}));
 const items = Object.entries(mapText.items).map(([id,glyph]) => ({id, glyph, kind:'item' as TileKind, label:itemLabels.value[Number(id)] ?? t('map.unknown')}));
 const commonIds = ['WALL','FLOOR','DOOR','OPEN_DOOR','LOCKED_DOOR','WATER_SHALLOW','WATER_DEEP','STAIRS_UP','STAIRS_DOWN','LAVA','CHASM','GRASS','WEB','ALTAR','TRAP','BRIDGE'];
 const common = [{id:'player',kind:'player' as TileKind,glyph:mapText.special.player,label:t('map.player')}, ...terrain.filter(x=>commonIds.includes(x.id)), ...items.slice(0,6), ...creature.slice(0,5)];
 const list = group.value === 'terrain' ? terrain : group.value === 'monster' ? creature : group.value === 'item' ? items : common;
 return list.filter(row => !query.value || (row.glyph + row.label).includes(query.value));
});
</script>
<template>
 <section class="map-legend" role="dialog" :aria-label="t('map.legend')" @keydown.stop @keyup.stop @keydown.esc="emit('close')">
  <div class="map-legend-head"><strong>{{ t('map.legend') }}</strong><button @click="emit('close')" :aria-label="t('mobile.close')">×</button></div>
  <p>{{ t('map.legend_note') }}</p>
  <nav><button v-for="tab in tabs" :key="tab.id" :aria-pressed="group === tab.id" @click="group = tab.id">{{ tab.label }}</button></nav>
  <input v-model="query" :placeholder="t('map.search')" :aria-label="t('map.search')" />
  <div class="map-legend-grid"><div v-for="row in rows" :key="row.id" :title="row.label"><b><MapVectorIcon v-if="mapMode === 'tiles'" :value="{ id:row.id, kind:row.kind, hanzi:row.glyph, original:'' }" /><template v-else>{{ row.glyph }}</template></b><span>{{ row.label }}</span></div></div>
  <p class="map-legend-foot">{{ mapMode === 'tiles' ? t('map.coverage_tiles') : t('map.coverage') }}</p>
 </section>
</template>
