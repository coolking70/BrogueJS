<script setup lang="ts">
import {ref, watch} from 'vue';
import PartyRosterPanel from './PartyRosterPanel.vue';
import PartyAiPanel from './PartyAiPanel.vue';
import PartyWindowPanel from './PartyWindowPanel.vue';
import PartyWindowControls from './PartyWindowControls.vue';
import type { PartyPlan } from '../../../partyWindow';
import {useTranslation} from 'i18next-vue';
const props = defineProps<{rosterProps:InstanceType<typeof PartyRosterPanel>['$props'];aiProps:InstanceType<typeof PartyAiPanel>['$props'];windowProps:InstanceType<typeof PartyWindowPanel>['$props'];items:readonly {id:number;name:string;quantity:number}[];travel:(direction:number,leave:number[])=>void;exchange:(to:number,item:number,quantity:number)=>void;feedback:string|null;presentationHidden?:boolean;focused:number;ready:number|null;members:readonly {id:number;color:number;hp:number;maxHp:number;life:string;depth:number;controller:string;pendingController:string|null;temporaryAi:boolean;remaining:number;actionBusy:boolean;source:string;plan:PartyPlan|null|undefined;cursor:number;draft:boolean}[];focus:(id:number)=>void;recover:(depth:number)=>void;drawerOpen:boolean;setDrawer:(open:boolean)=>void}>();
const {t}=useTranslation();
const leave=ref<number[]>([]),to=ref(0),item=ref(0),quantity=ref(1);
watch(() => props.focused, () => {to.value=0;item.value=0;quantity.value=1;});
watch(() => props.windowProps.state.decision?.id, value => {if(value)props.setDrawer(true);});
function close() { props.setDrawer(false);props.aiProps.cancelMap(); }
function pickTravel() { props.setDrawer(false);props.windowProps.pickTravel(); }
function pickMap(select:(at:{x:number;y:number})=>void) {props.setDrawer(false);props.aiProps.pickMap(at=>{select(at);props.setDrawer(true);});}
</script>
<template><div v-show="!presentationHidden" class="party-hud">
<div class="party-members" data-party-members>
<button v-for="(member,index) in members" :key="member.id" :class="{selected:focused===member.id,interrupted:windowProps.state.receipt?.interrupts.some(f=>f.actorId===member.id)}" :style="{borderLeft: '3px solid #'+member.color.toString(16).padStart(6,'0')}" :data-party-actor="member.id" @click="focus(member.id)">
{{t('ext.party.member',{number:index+1})}} · {{member.hp}}/{{member.maxHp}}
<small>{{t('ext.party.ai.'+member.controller)}}<span v-if="member.pendingController"> · {{t('ext.party.ai.pending')}}{{t('ext.party.ai.'+member.pendingController)}}</span><span v-if="member.temporaryAi"> · {{t('ext.party.ai.temporary')}}</span></small>
<small>{{member.life==='frozen'?t('ext.party.frozen'):member.life==='dead'?t('ext.party.dead'):member.actionBusy?t('ext.party.actionBusy'):member.remaining>0?t('ext.party.busy',{ticks:member.remaining}):ready===member.id?t('ext.party.ready'):t('ext.party.idle')}} · {{t('ext.party.source.'+member.source)}}</small>
<small>{{t(member.draft?'ext.party.plan.draft':'ext.party.plan.accepted')}} · {{member.plan?.kind==='queue'?t('ext.party.plan.steps',{count:member.plan.actions.length-member.cursor}):member.plan?.kind==='travel'?t('ext.party.plan.travel',member.plan.target):member.plan?.kind==='ai-this-window'?t('ext.party.ai.temporary'):t('ext.party.plan.none')}}</small>
</button></div>
<div class="party-toolbar"><PartyWindowControls :disabled="windowProps.busy || !!windowProps.state.decision || windowProps.state.phase==='failed'" :advance="windowProps.advance" :rehearse="windowProps.rehearse"/><button data-party-drawer-toggle @click="setDrawer(!drawerOpen)">{{t('ext.party.drawer')}}</button></div>
<button v-if="windowProps.state.decision" class="pending" @click="setDrawer(true)">{{t('ext.party.pendingActor',{id:windowProps.state.decision.actorId})}}</button>
<div v-if="drawerOpen" class="drawer-backdrop" @click.self="close()"></div>
<div class="party-editor" :class="{open:drawerOpen}" data-party-editor>
<header><strong>{{t('ext.party.drawer')}} · #{{focused}}</strong><button data-party-drawer-close @click="close()">{{t('ext.party.close')}}</button></header>
<template v-if="members.every(m=>m.life!=='active')"><button v-for="member in members.filter(m=>m.life==='frozen')" :key="member.id" @click="recover(member.depth)">{{t('ext.party.recover')}} · {{t('ext.party.depth',{depth:member.depth})}}</button></template>
<PartyWindowPanel v-bind="windowProps" :hide-controls="true" :pick-travel="pickTravel"/>
<PartyAiPanel v-bind="aiProps" :pick-map="pickMap"/>
<PartyRosterPanel v-bind="rosterProps"/>
<details><summary>{{t('ext.party.controls')}}</summary>
<div v-for="member in members.filter(m=>m.life==='active'&&m.id!==focused)" :key="member.id"><label><input v-model="leave" type="checkbox" :value="member.id">{{t('ext.party.leave',{number:members.findIndex(m=>m.id===member.id)+1})}}</label></div>
<button @click="travel(-1,leave)">{{t('ext.party.up')}}</button><button @click="travel(1,leave)">{{t('ext.party.down')}}</button>
<label>{{t('ext.party.recipient')}}<select v-model.number="to"><option :value="0">—</option><option v-for="member in members.filter(m=>m.life==='active'&&m.id!==focused)" :key="member.id" :value="member.id">{{t('ext.party.member',{number:members.findIndex(m=>m.id===member.id)+1})}}</option></select></label>
<select v-model.number="item"><option :value="0">—</option><option v-for="entry in items" :key="entry.id" :value="entry.id">{{entry.name}} × {{entry.quantity}}</option></select><input v-model.number="quantity" type="number" min="1" :aria-label="t('ext.party.quantity')">
<button :disabled="!to||!item||ready!==focused" @click="exchange(to,item,quantity)">{{t('ext.party.exchange')}}</button>
</details></div><p v-if="feedback" role="status">{{feedback}}</p>
</div></template>
<style scoped>
.party-hud{display:flex;flex-wrap:wrap;gap:4px;padding:4px;min-width:0;max-width:100%}.party-hud button{font:inherit;color:inherit;background:#232923;border:1px solid #777;padding:6px;min-height:44px}.party-members{display:flex;gap:4px;overflow-x:auto;flex:1 1 100%;min-width:0;touch-action:pan-x}.party-members>button{flex:1 0 180px;text-align:left}.party-hud .selected{border-color:#ebd37a;background:#394136}.party-hud .interrupted,.pending{outline:2px solid #c96752}small{display:block;font-size:11px}.party-toolbar{display:flex;gap:4px;width:100%;min-width:0;align-items:stretch}.party-toolbar>:first-child{flex:1}.party-editor{width:100%;min-width:0;max-height:55dvh;overflow-y:auto;overflow-wrap:anywhere}.party-editor header{display:none}.party-editor input[type=number]{width:5em}.party-editor select{max-width:100%}.drawer-backdrop{display:none}
@media(max-width:900px){.party-members>button{flex:0 0 168px}.party-editor{display:none}.party-editor.open{display:block;position:fixed;z-index:91;inset:auto 0 0;box-sizing:border-box;max-height:78dvh;overflow-y:auto;overscroll-behavior:contain;background:#171d19;border-top:2px solid #ebd37a;padding:10px;padding-bottom:calc(10px + env(safe-area-inset-bottom));touch-action:pan-y}.party-editor header{display:flex;justify-content:space-between;align-items:center;position:sticky;top:-10px;background:#171d19;z-index:1}.drawer-backdrop{display:block;position:fixed;inset:0;z-index:90;background:#0008}.party-toolbar{font-size:12px}.party-hud{padding:2px}.pending{width:100%}}
</style>
