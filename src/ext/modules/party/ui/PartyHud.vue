<script setup lang="ts">
import {ref} from 'vue';
import {useTranslation} from 'i18next-vue';
defineProps<{items:readonly {id:number;name:string;quantity:number}[];travel:(direction:number,leave:number[])=>void;exchange:(to:number,item:number,quantity:number)=>void;feedback:string|null;presentationHidden?:boolean;focused:number;ready:number|null;members:readonly {id:number;hp:number;maxHp:number;life:string;depth:number}[];focus:(id:number)=>void;recover:(depth:number)=>void}>();
const {t}=useTranslation();
const leave=ref<number[]>([]),to=ref(0),item=ref(0),quantity=ref(1);
</script>
<template><div v-show="!presentationHidden" class="party-hud">
<button v-for="(member,index) in members" :key="member.id" :class="{selected:focused===member.id}" :data-party-actor="member.id" @click="focus(member.id)">
{{t('ext.party.member',{number:index+1})}} · {{member.hp}}/{{member.maxHp}}
<small>{{ready===member.id?t('ext.party.ready'):member.life==='frozen'?t('ext.party.frozen'):member.life==='dead'?t('ext.party.dead'):t('ext.party.waiting')}}</small>
</button>
<template v-if="members.every(m=>m.life!=='active')"><button v-for="member in members.filter(m=>m.life==='frozen')" :key="member.id" @click="recover(member.depth)">{{t('ext.party.recover')}} · D{{member.depth}}</button></template>
<details><summary>{{t('ext.party.controls')}}</summary>
<div v-for="member in members.filter(m=>m.life==='active'&&m.id!==focused)" :key="member.id"><label><input v-model="leave" type="checkbox" :value="member.id">{{t('ext.party.leave',{number:members.findIndex(m=>m.id===member.id)+1})}}</label></div>
<button @click="travel(-1,leave)">{{t('ext.party.up')}}</button><button @click="travel(1,leave)">{{t('ext.party.down')}}</button>
<label>{{t('ext.party.recipient')}}<select v-model.number="to"><option :value="0">—</option><option v-for="member in members.filter(m=>m.life==='active'&&m.id!==focused)" :key="member.id" :value="member.id">{{t('ext.party.member',{number:members.findIndex(m=>m.id===member.id)+1})}}</option></select></label>
<select v-model.number="item"><option :value="0">—</option><option v-for="entry in items" :key="entry.id" :value="entry.id">{{entry.name}} × {{entry.quantity}}</option></select><input v-model.number="quantity" type="number" min="1" :aria-label="t('ext.party.quantity')">
<button :disabled="!to||!item||ready!==focused" @click="exchange(to,item,quantity)">{{t('ext.party.exchange')}}</button>
<p v-if="feedback">{{feedback}}</p></details>
</div></template>
<style scoped>.party-hud{display:flex;flex-wrap:wrap;gap:4px;padding:4px}.party-hud button{font:inherit;color:inherit;background:#232923;border:1px solid #777;padding:6px;min-height:44px;flex:1}.party-hud .selected{border-color:#ebd37a;background:#394136}small{display:block;font-size:11px}</style>
