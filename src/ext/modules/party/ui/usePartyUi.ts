import i18next from 'i18next';
import {computed,ref} from 'vue';
import type {ModuleUiHost,ModuleUiSession} from '../../../ui/types';
import PartyHud from './PartyHud.vue';
export function usePartyUi(host:ModuleUiHost):ModuleUiSession{
 const feedback=ref<string|null>(null);
 const revision=ref(0),game=host.game(),refresh=()=>{revision.value++;};
 const hud=computed(()=>{host.tick.value;revision.value;const root=game.party;if(!root)return null;
 const act=(work:()=>void)=>{if(host.game()!==game)return;try{work();feedback.value=null;}catch{feedback.value=i18next.t('ext.party.unavailable');}refresh();};
 return {component:PartyHud,props:{feedback:feedback.value,items:game.focusedActor.inventory.items.map(i=>({id:i.id,name:i.displayName,quantity:i.quantity})),
 travel:(direction:number,leave:number[])=>act(()=>game.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:root.state.revision,issuerSlot:'local:0',actorId:game.focusedActor.id,change:(direction===-1&&game.depth===1||direction===1&&game.depth===40)?{kind:'exit-party'}:{kind:'travel-party',destination:{kind:'dungeon',depth:game.depth+direction},leavingBehind:leave.filter(id=>id!==game.focusedActor.id)}})),
 exchange:(to:number,item:number,quantity:number)=>act(()=>game.submitPartyIntent({kind:'exchange',toActorId:to,itemId:item,quantity})),focused:game.focusedActor.id,ready:game.readyPartyActorId,members:root.state.members.map(m=>{const actor=game.controlledActors.find(a=>a.id===m.actorId)!;return {id:m.actorId,hp:actor.hp,maxHp:actor.maxHp,life:m.life,depth:m.level.kind==='dungeon'?m.level.depth:0};}),
 focus:(id:number)=>{if(host.game()!==game)return;game.focusPartyMember(id);refresh();},recover:(depth:number)=>act(()=>{const member=root.state.members.find(m=>m.life==='frozen'&&m.level.kind==='dungeon'&&m.level.depth===depth);if(member)game.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:root.state.revision,issuerSlot:'local:0',actorId:member.actorId,change:{kind:'recover-level',destination:{kind:'dungeon',depth}}});})}};});
 return {hud,bar:ref(null),panel:ref(null),commands:ref([]),panelOpen:ref(false),refresh,close(){}};
}
