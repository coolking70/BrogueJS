<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import LootAffixRow from '../LootAffixRow.vue';
import LootItemCard from '../LootItemCard.vue';
import LootComparePanel from '../LootComparePanel.vue';
import LootPickupFilterForm from '../LootPickupFilterForm.vue';
import LootSalvagePanel from '../LootSalvagePanel.vue';
import type { LootGameView } from '../../gameView';
import type { LootPickupFilterDraft } from '../types';
const props=defineProps<{view:LootGameView|null;tab:string;comparing:boolean;selectedIds:readonly number[];submitting:boolean;feedback:string;readOnly:boolean;presentationHidden?:boolean}>();
const emit=defineEmits<{close:[];back:[];compare:[value:boolean];tab:[value:string];select:[id:number];batch:[ids:number[]];filter:[draft:LootPickupFilterDraft];salvage:[];identify:[];enchant:[];equip:[unequip:boolean,replace?:'left'|'right']}>();
const {t}=useTranslation();
const filter=ref('all');
const entries=computed(()=>props.view?.entries.filter(e=>filter.value==='all'||e.itemClass===filter.value)??[]);
const disabled=computed(()=>!props.view||props.submitting||props.readOnly);
function toggle(id:number){emit('batch',props.selectedIds.includes(id)?props.selectedIds.filter(v=>v!==id):[...props.selectedIds,id]);}
function back(){emit('back');}
</script>
<template>
 <Teleport to="body"><div class="loot-game-overlay" :hidden="presentationHidden" @click.stop @pointerdown.stop @wheel.stop @touchmove.stop>
  <section class="loot-game-panel" role="dialog" tabindex="-1" @keydown.stop @keyup.stop @keydown.esc.prevent="back">
   <header class="loot-game-header"><h2>{{ t('ext.loot.ui.live.title') }}</h2><button @click="emit('close')">{{ t('ext.loot.ui.live.close') }}</button></header>
   <p v-if="!view" role="status">{{ t('ext.loot.ui.live.loading') }}</p>
   <template v-else>
   <p>{{ t('ext.loot.ui.live.shards',{count:view.shards}) }}</p><p v-if="readOnly">{{ t('ext.loot.ui.live.readonly') }}</p><p v-if="feedback" class="loot-game-feedback">{{ feedback }}</p>
   <nav class="loot-game-nav"><button @click="emit('tab','items')">{{ t('ext.loot.ui.live.items') }}</button><button @click="emit('tab','filter')">{{ t('ext.loot.ui.live.filter') }}</button><button @click="emit('tab','salvage')">{{ t('ext.loot.ui.live.salvage') }}</button><button @click="emit('tab','sources')">{{ t('ext.loot.ui.live.sources') }}</button></nav>
   <template v-if="tab==='filter'"><LootPickupFilterForm :value="view.filter" :defaults="view.defaults" :preset-name="view.presetName" :read-only="readOnly" :submitting="submitting" @submit="emit('filter',$event)" @cancel="emit('back')" /></template>
   <template v-else-if="tab==='sources'"><section v-for="set in view.sourceSets" :key="set.id" class="loot-card-set">
      <h3>{{ t('ext.loot.ui.set.count',{name:t(set.name.nameKey,set.name.params),count:set.count,total:set.total}) }}</h3>
      <div v-for="bonus in set.bonuses" :key="bonus.count"><p>{{ t('ext.loot.ui.set.threshold',{count:bonus.count}) }} · {{ t(bonus.active?'ext.loot.ui.set.active':'ext.loot.ui.set.inactive') }}</p><ul class="loot-card-affixes"><LootAffixRow v-for="row in bonus.rows" :key="row.key" :row="row" /></ul></div>
    </section><p>{{ t('ext.loot.ui.live.known-only') }}</p><section v-for="source in view.sourceItems" :key="source.id"><h3>{{ source.name }}</h3><ul><LootAffixRow v-for="row in source.rows" :key="row.key" :row="row" /></ul></section><p>{{ t('ext.loot.ui.live.runic') }}</p><ul><li v-for="(row,index) in view.sources" :key="index">{{ row.name }} · {{ t(row.label.nameKey,row.label.params) }}: {{ row.value }}</li></ul></template>
   <template v-else-if="view.selected&&tab==='items'">
    <h3>{{ view.selected.name }}</h3><p>{{ view.selected.location==='floor'?t('ext.loot.ui.live.floor'):view.selected.location==='container'?t('ext.loot.ui.live.container'):view.selected.location==='equipped'?t('ext.loot.ui.live.equipped'):t('ext.loot.ui.live.pack') }}</p>
    <template v-if="view.selected.enhancement">
     <p>{{ t('ext.loot.ui.enhancement.level',{level:view.selected.enhancement.level,cap:view.selected.enhancement.cap}) }}</p>
     <p>{{ view.selected.enhancement.level>=view.selected.enhancement.cap?t('ext.loot.ui.enhancement.refine'):t('ext.loot.ui.enhancement.next') }}</p>
     <p v-if="!view.selected.enhancement.allowed">{{ t('ext.loot.ui.enhancement.full') }}</p>
     <p v-else-if="!view.selected.enhancement.scroll">{{ t('ext.loot.ui.enhancement.no-scroll') }}</p>
     <button :disabled="disabled||!view.selected.enhancement.allowed||!view.selected.enhancement.scroll" @click="emit('enchant')">{{ t('ext.loot.ui.enhancement.read') }}</button>
    </template>
    <LootItemCard v-if="view.card&&!comparing" :view="view.card" />
    <LootComparePanel v-if="view.compare&&comparing" :view="view.compare" @close="emit('compare',false)" />
    <p>{{ t('ext.loot.ui.live.unknown') }}</p><p>{{ t('ext.loot.ui.live.runic') }}</p>
    <div class="loot-game-nav"><button v-if="view.compare" @click="emit('compare',!comparing)">{{ t('ext.loot.ui.card.compare') }}</button>
     <button v-if="view.selected.canIdentify" :disabled="disabled||view.shards<10" @click="emit('identify')">{{ t('ext.loot.ui.live.identify') }}</button>
     <button v-if="view.selected.canSalvage" :disabled="disabled" @click="emit('batch',[view.selected.id]);emit('tab','salvage')">{{ t('ext.loot.ui.card.salvage') }}</button>
     <template v-if="view.selected.canEquip"><button v-if="view.selected.itemClass!=='ring'" :disabled="disabled" @click="emit('equip',false)">{{ t('ext.loot.ui.live.equip') }}</button><button v-for="action in view.selected.ringEquipSlots" :key="action.slot" :disabled="disabled" @click="emit('equip',false,action.slot)">{{ action.replace?t(action.slot==='left'?'ext.loot.ui.live.left':'ext.loot.ui.live.right'):t(action.slot==='left'?'ext.loot.ui.live.wear-left':'ext.loot.ui.live.wear-right') }}</button></template>
     <button v-if="view.selected.canUnequip" :disabled="disabled" @click="emit('equip',true)">{{ t('ext.loot.ui.live.unequip') }}</button>
    </div><button @click="back">{{ t('ext.loot.ui.live.back') }}</button>
   </template>
   <template v-else>
    <label>{{ t('ext.loot.ui.live.local-filter') }}<select v-model="filter"><option value="all">{{ t('ext.loot.ui.live.all') }}</option><option value="weapon">{{ t('ext.loot.ui.live.weapon') }}</option><option value="armor">{{ t('ext.loot.ui.live.armor') }}</option><option value="ring">{{ t('ext.loot.ui.live.ring') }}</option></select></label>
    <div v-if="tab==='salvage'" class="loot-game-nav"><button :disabled="disabled" @click="emit('batch',view.entries.filter(e=>e.canSalvage).map(e=>e.id))">{{ t('ext.loot.ui.live.select-all') }}</button><button :disabled="disabled" @click="emit('batch',[])">{{ t('ext.loot.ui.live.select-none') }}</button></div>
    <p v-if="!entries.length">{{ t('ext.loot.ui.live.empty') }}</p>
    <ul class="loot-game-list"><li v-for="entry in entries" :key="entry.id"><label v-if="tab==='salvage'"><input type="checkbox" :checked="selectedIds.includes(entry.id)" :disabled="disabled||!entry.canSalvage" @change="toggle(entry.id)" />{{ entry.name }}<span v-if="!entry.canSalvage"> · {{ entry.location==='equipped'?t('ext.loot.ui.live.equipped'):entry.location==='floor'?t('ext.loot.ui.live.floor'):entry.location==='container'?t('ext.loot.ui.live.container'):t('ext.loot.ui.live.native') }}</span></label><button v-else @click="emit('select',entry.id)">{{ entry.name }}</button></li></ul>
    <template v-if="tab==='salvage'"><p>{{ t('ext.loot.ui.live.cost',{count:view.salvage.entries.length*100}) }}</p><LootSalvagePanel :view="view.salvage" :submitting="disabled" @confirm="emit('salvage')" @cancel="emit('back')" /></template>
   </template>
   </template>
  </section>
 </div></Teleport>
</template>
<style>
.loot-game-overlay { position:fixed; inset:0; z-index:1100; background:#000a; display:flex; justify-content:center; align-items:center; overscroll-behavior:contain; }
.loot-game-overlay[hidden] { display:none; }
.loot-game-panel { box-sizing:border-box; width:min(900px,100%); max-height:94dvh; overflow:auto; padding:12px; min-width:0; color:var(--th-fg,#e4dfd1); background:var(--th-panel,#0d0d0c); font-family:var(--th-font,monospace); overflow-wrap:anywhere; overscroll-behavior:contain; }
.loot-game-header,.loot-game-nav { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; }
.loot-game-panel button,.loot-game-panel select,.loot-game-list label { box-sizing:border-box; min-width:44px; min-height:44px; max-width:100%; padding:8px; color:inherit; background:var(--th-raised,#181815); border:1px solid var(--th-line,#34322c); font:inherit; overflow-wrap:anywhere; }
.loot-game-panel button:disabled { opacity:.5; }
.loot-game-list { padding:0; list-style:none; }
.loot-game-list li { margin:8px 0; }
.loot-game-list label { display:flex; align-items:center; gap:8px; }
.loot-game-feedback { border:1px solid var(--th-accent,#e4dfd1); padding:8px; }
</style>
