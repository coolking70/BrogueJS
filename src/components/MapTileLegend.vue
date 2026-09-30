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
 {id:'common',label:t('lab.map_group_common')}, {id:'terrain',label:t('lab.map_group_terrain')}, {id:'monster',label:t('lab.map_group_monster')}, {id:'item',label:t('lab.map_group_item')},
]);
const itemLabels = computed(() => [t('lab.map_item_0'),t('lab.map_item_1'),t('lab.map_item_2'),t('lab.map_item_3'),t('lab.map_item_4'),t('lab.map_item_5'),t('lab.map_item_6'),t('lab.map_item_7'),t('lab.map_item_8'),t('lab.map_item_9'),t('lab.map_item_10'),t('lab.map_item_11'),t('lab.map_item_12')]);
const rows = computed(() => {
 const terrain = Object.entries(mapText.terrain).map(([id, glyph]) => {
   const key = TERRAIN_TEXT_IDS[TerrainType[id as keyof typeof TerrainType]];
   const entry = key in content.terrain ? content.terrain[key as keyof typeof content.terrain] : content.webTerrain[key as keyof typeof content.webTerrain];
   return { id, glyph, kind:'terrain' as TileKind, label: entry?.description ?? t('lab.map_unknown') };
 });
 const creature = monsters.map(m => ({id:m.id.toLowerCase(), kind:'monster' as TileKind, glyph:mapText.monsters[m.id.toLowerCase() as keyof typeof mapText.monsters], label:ItemLoader.translateName(m.name)}));
 const items = Object.entries(mapText.items).map(([id,glyph]) => ({id, glyph, kind:'item' as TileKind, label:itemLabels.value[Number(id)] ?? t('lab.map_unknown')}));
 const commonIds = ['WALL','FLOOR','DOOR','OPEN_DOOR','LOCKED_DOOR','WATER_SHALLOW','WATER_DEEP','STAIRS_UP','STAIRS_DOWN','LAVA','CHASM','GRASS','WEB','ALTAR','TRAP','BRIDGE'];
 const common = [{id:'player',kind:'player' as TileKind,glyph:mapText.special.player,label:t('lab.map_player')}, ...terrain.filter(x=>commonIds.includes(x.id)), ...items.slice(0,6), ...creature.slice(0,5)];
 const list = group.value === 'terrain' ? terrain : group.value === 'monster' ? creature : group.value === 'item' ? items : common;
 return list.filter(row => !query.value || (row.glyph + row.label).includes(query.value));
});
</script>
<template>
 <section class="map-legend" role="dialog" :aria-label="t('lab.map_legend')" @keydown.stop @keyup.stop @keydown.esc="emit('close')">
  <div class="map-legend-head"><strong>{{ t('lab.map_legend') }}</strong><button @click="emit('close')" :aria-label="t('mobile.close')">×</button></div>
  <p>{{ t('lab.map_legend_note') }}</p>
  <nav><button v-for="tab in tabs" :key="tab.id" :aria-pressed="group === tab.id" @click="group = tab.id">{{ tab.label }}</button></nav>
  <input v-model="query" :placeholder="t('lab.map_search')" :aria-label="t('lab.map_search')" />
  <div class="map-legend-grid"><div v-for="row in rows" :key="row.id" :title="row.label"><b><MapVectorIcon v-if="mapMode === 'tiles'" :value="{ id:row.id, kind:row.kind, hanzi:row.glyph, original:'' }" /><template v-else>{{ row.glyph }}</template></b><span>{{ row.label }}</span></div></div>
  <p class="map-legend-foot">{{ mapMode === 'tiles' ? t('lab.map_coverage_tiles') : t('lab.map_coverage') }}</p>
 </section>
</template>
