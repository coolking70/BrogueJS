import { computed, defineAsyncComponent, onScopeDispose, ref, shallowRef } from 'vue';
import i18next from 'i18next';
import type { ModuleUiHost, ModuleUiSession } from '../../ui/types';
import { readLootGameView, reachableLootItems } from './gameView';
import { lootRingEquipSlots } from './comparison';
import { ItemCategory } from '../../../engine/Items/Item';
import { stateOf } from './session';
import { normalizeLootPickupFilter } from './ui/viewModel';
import type { LootPickupFilterDraft } from './ui/types';
const Panel=defineAsyncComponent(()=>import('./ui/game/LootGamePanel.vue'));
export function useLootUi(host:ModuleUiHost):ModuleUiSession {
 const game=host.game(),runtime=game.extensionRuntime!;
 const opened=ref(false),comparing=ref(false),tab=ref('items'),selected=ref<number|null>(null),batch=ref<number[]>([]),submitting=ref(false),feedback=ref('');
 const view=shallowRef<ReturnType<typeof readLootGameView>|null>(null);
 let retired=false,pending:{revision:number;events:number;cancelled:boolean}|null=null,cursor=game.replayCursor,subject=game.party?game.focusedActor.id:game.player.id;
 const live=()=>!retired&&host.game()===game&&game.extensionRuntime===runtime;
 const readOnly=()=>!!game.replayRecording||game.isGameOver;
 function close(){const was=opened.value;opened.value=false;selected.value=null;batch.value=[];feedback.value='';view.value=null;tab.value='items';comparing.value=false;if(was){host.cancelHeldKeys?.();host.afterClosePanel();}}
 function back(){if(comparing.value){comparing.value=false;}else if(selected.value!==null){selected.value=null;refresh();}else if(tab.value!=='items'){tab.value='items';refresh();}else close();}
 function refresh(){
  const nextSubject=game.party?game.focusedActor.id:game.player.id;if(subject!==nextSubject){subject=nextSubject;close();pending=null;submitting.value=false;return;}
  if(!live()||game.isGameOver||cursor!==game.replayCursor){cursor=game.replayCursor,subject=game.party?game.focusedActor.id:game.player.id;close();pending=null;submitting.value=false;return;}
  if(!opened.value)return;
  if(host.canPresentInteraction?.()===false){close();return;}
  if(game.pendingCommandConfirmation&&pending)pending.cancelled=false;
  if(pending&&!game.isAdvancing&&!game.pendingCommandConfirmation&&!game.recordingInputBlocked){
   const after=stateOf(runtime.itemCommandState('loot')).revision;
   const events=game.recordedInputEvents.slice(pending.events);
   feedback.value=after>pending.revision?i18next.t('ext.loot.ui.live.success'):events.some(e=>e.decisions?.includes(false))?i18next.t('ext.loot.ui.live.cancelled'):i18next.t('ext.loot.ui.live.rejected');
   pending=null;submitting.value=false;batch.value=[];
  }
  if(host.isPresentationBusy?.()||game.isAdvancing)return;
  const next=readLootGameView(game,selected.value,batch.value);
  // Stable equivalent props preserve expanded rows and local drafts across polling.
  if(JSON.stringify(next)!==JSON.stringify(view.value))view.value=next;
 }
 function open(itemId?:number){
  if(!live()||opened.value||host.isPresentationBusy?.())return;
  if(itemId!==undefined){if(!reachableLootItems(game).some(e=>e.item.id===itemId)||host.beforeOpenItemPanel?.()===false)return;}
  if(!host.canOpenPanel())return;
  host.beforeOpenPanel();selected.value=itemId??null;opened.value=true;refresh();
 }
 function submit(action:string,payload:Record<string,unknown>){
  if(!live()||!opened.value||submitting.value||readOnly()||host.isPresentationBusy?.()||game.isAdvancing||game.isInputLocked()||game.pendingCommandConfirmation||!view.value)return;
  if(action==='set-filter'&&JSON.stringify(normalizeLootPickupFilter(payload))===JSON.stringify(normalizeLootPickupFilter(view.value.filter)))return;
  if(action==='salvage'&&!batch.value.length)return;
  if(action==='identify-shards'&&!view.value.selected?.canIdentify){feedback.value=i18next.t('ext.loot.ui.live.rejected');return;}
  const revision=view.value.revision;
  if(stateOf(runtime.itemCommandState('loot')).revision!==revision){feedback.value=i18next.t('ext.loot.ui.live.changed');return;}
  pending={revision,events:game.recordedInputEvents.length,cancelled:false};submitting.value=true;feedback.value=i18next.t('ext.loot.ui.live.pending');
  try{game.executeCommand('ext:command',JSON.stringify({module:'loot',action,payload:{v:1,revision,...payload}}));}catch{feedback.value=i18next.t('ext.loot.ui.live.rejected');pending=null;submitting.value=false;}refresh();
 }
 function work(operationId:string,rowId?:string){
  if(!live()||!opened.value||readOnly()||submitting.value||game.isAdvancing||game.isInputLocked()||host.isPresentationBusy?.())return;
  const choice=view.value?.workChoices.find(c=>c.operationId===operationId&&c.rowId===rowId);if(!choice)return;
  close();game.executeCommand('ext:command',JSON.stringify({module:'loot',action:'item-operation',payload:choice.payload}));
 }
 function enchant(){
  if(!live()||!opened.value||readOnly()||submitting.value||game.isAdvancing||game.isInputLocked()||host.isPresentationBusy?.())return;
  const target=(game.party?game.focusedActor:game.player).inventory.items.find(i=>i.id===selected.value),scroll=(game.party?game.focusedActor:game.player).inventory.items.find(i=>i.consumableId==='scroll_of_enchantment');
  if(!target||!scroll||!game.canEnchantTarget(target))return;
  submitting.value=true;close();
  try{game.executeItemCommand('read',scroll);}finally{submitting.value=false;}
 }
 function equip(unequip=false,replace?:'left'|'right'){
  if(!live()||readOnly()||submitting.value||game.isAdvancing||game.isInputLocked()||host.isPresentationBusy?.())return;
  const entry=reachableLootItems(game).find(e=>e.item.id===selected.value);if(!entry||!['pack','equipped'].includes(entry.location))return;
  if(unequip?entry.location!=='equipped':entry.location!=='pack')return;
  let replacement;
  if(!unequip&&entry.item.category===ItemCategory.RING){
   const rings=[(game.party?game.focusedActor:game.player).ringLeft,(game.party?game.focusedActor:game.player).ringRight],allowed=lootRingEquipSlots(entry.item.id,rings.map(i=>i?.id??null));
   const slot=replace==='left'?0:replace==='right'?1:allowed.length===1?allowed[0]:undefined;
   if(slot===undefined||!allowed.includes(slot)){feedback.value=i18next.t('ext.loot.ui.live.rejected');return;}
   replacement=rings[slot];
  }
  game.executeItemCommand(unequip?'unequip':'equip',entry.item,replacement?.inventoryLetter);refresh();
 }
 const remove=host.registerKeyHandler?.(event=>{if(!opened.value||game.pendingCommandConfirmation)return false;if(event.key==='Escape'){event.preventDefault();back();}return true;},450);
 onScopeDispose(()=>{close();retired=true;remove?.();});
 return {hud:ref(null),bar:ref(null),panelOpen:opened,
  commands:computed(()=>[{id:'loot:panel',label:i18next.t('ext.loot.ui.live.title'),invoke:()=>open()}]),
  itemActions:id=>reachableLootItems(game).some(e=>e.item.id===id)?[{id:'loot:details',label:i18next.t('ext.loot.ui.live.details'),invoke:()=>open(id)}]:[],
  // Keep an accepted open mounted while its first stable DTO is deferred.
  // The shared host tick / presentation-settled callback retries refresh.
  panel:computed(()=>opened.value?{component:Panel,props:{view:view.value,tab:tab.value,comparing:comparing.value,onCompare:(value:boolean)=>{comparing.value=value;},selectedIds:batch.value,submitting:submitting.value,feedback:feedback.value,readOnly:readOnly(),
   onClose:close,onBack:back,onTab:(value:string)=>{tab.value=value;selected.value=null;comparing.value=false;refresh();},onSelect:(id:number)=>{selected.value=id;refresh();},onBatch:(ids:number[])=>{batch.value=ids;refresh();},
   onFilter:(draft:LootPickupFilterDraft)=>submit('set-filter',{...draft}),onSalvage:()=>submit('salvage',{itemIds:batch.value}),onIdentify:()=>submit('identify-shards',{itemId:selected.value}),onWork:work,onEnchant:enchant,onSocket:(runeItemId:number)=>submit('socket',{itemId:selected.value,runeItemId}),onEquip:equip}}:null),refresh,close};
}
