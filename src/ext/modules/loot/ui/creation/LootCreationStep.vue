<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import LootPresetPicker from '../LootPresetPicker.vue';
import { loadLootPack } from '../../definitions';
import { buildLootPresetOptions } from '../viewModel';
const props=defineProps<{submitting:boolean;error:string|null}>();
const emit=defineEmits<{complete:[commands:readonly string[]];cancel:[]}>();
const {t}=useTranslation();
const preset=ref('standard'),root=ref<HTMLElement|null>(null),sent=ref(false);
const disabled=computed(()=>props.submitting||sent.value);
const options=buildLootPresetOptions(loadLootPack());
function focusSelected(){void nextTick(()=>{if(!disabled.value)root.value?.querySelector<HTMLButtonElement>(`[data-preset="${preset.value}"]`)?.focus({preventScroll:true});});}
function confirm(presetId:string){
 if(disabled.value||!options.some(o=>o.id===presetId))return;
 // Lock synchronously: parent props update on the next Vue render.
 sent.value=true;emit('complete',[JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId}})]);
 // A synchronous rejection can leave the same error/props after a retry.
 void nextTick(()=>{if(props.error&&!props.submitting){sent.value=false;focusSelected();}});
}
function cancel(){if(!disabled.value)emit('cancel');}
function keydown(event:KeyboardEvent){
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();return;}
 if(event.key==='Tab'){
  const buttons=Array.from(root.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled):not([tabindex="-1"])')??[]);
  event.preventDefault();event.stopPropagation();if(!buttons.length)return;
  const index=buttons.indexOf(event.target as HTMLButtonElement);
  buttons[index<0?(event.shiftKey?buttons.length-1:0):(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length]!.focus();return;
 }
 if((event.key==='Enter'||event.key===' ')&&(event.target as HTMLElement|null)?.matches?.('[data-preset]')){
  event.preventDefault();event.stopPropagation();if(!event.repeat)confirm(preset.value);
 }else if(event.repeat&&(event.key==='Enter'||event.key===' '))event.preventDefault();
}
watch(()=>props.submitting,(value,previous)=>{if(!value&&previous){sent.value=false;focusSelected();}});
watch(()=>props.error,error=>{if(error){sent.value=false;focusSelected();}});
// MainMenu owns the global modal key gate. This child handles only events
// inside its own DOM and focuses the selected option once it is enabled.
onMounted(focusSelected);
</script>
<template>
 <Teleport to="body"><div ref="root" class="loot-creation" @pointerdown.stop @pointerup.stop @touchstart.stop @touchend.stop @click.stop @dblclick.prevent.stop @keydown.capture="keydown" @keydown.stop @keyup.stop>
  <section class="loot-creation-dialog" role="dialog" aria-modal="true" :aria-label="t('ext.loot.ui.preset.title')">
   <header class="loot-creation-header"><button type="button" data-action="cancel" :disabled="disabled" @click="cancel">{{ t('ext.creation.cancel') }}</button></header>
   <p v-if="error" role="alert">{{ t(error === 'ext.creation.start_failed' ? 'ext.creation.start_failed' : 'ext.creation.unavailable') }}</p>
   <LootPresetPicker v-model="preset" :options="options" :disabled="disabled" @confirm="confirm" />
  </section>
 </div></Teleport>
</template>
<style>
.loot-creation { position:fixed; inset:0; z-index:2200; display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box; background:#000d; color:var(--th-fg,#e4dfd1); font-family:var(--th-font,monospace); overscroll-behavior:contain; }
.loot-creation-dialog { width:min(940px,100%); max-height:calc(100dvh - 32px); min-width:0; overflow-y:auto; box-sizing:border-box; background:var(--th-panel,#0d0d0c); border:1px solid var(--th-line,#34322c); overscroll-behavior:contain; }
.loot-creation-header { display:flex; justify-content:flex-end; position:sticky; top:0; z-index:1; padding:8px; background:var(--th-panel,#0d0d0c); }
.loot-creation-header button { min-height:44px; min-width:44px; padding:8px 12px; font:inherit; color:inherit; background:var(--th-raised,#181815); border:1px solid var(--th-line,#34322c); }
.loot-creation-header button:disabled { opacity:.5; }
.loot-creation-dialog > [role="alert"] { margin:8px 12px; overflow-wrap:anywhere; }
</style>
