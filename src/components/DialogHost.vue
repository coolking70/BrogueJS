<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { activeGame } from '../engine/Core/Game';
import { logger } from '../engine/Systems/Logger';
import { DialogService, type DialogEntry } from '../ui/dialogService';
import { dialogInput } from '../ui/dialogInput';
import { bindDialogAcknowledgments, bindDialogCommands } from '../ui/dialogAcknowledgments';
import { registerHeldInputContext } from '../ui/heldInput';

const props = defineProps<{ service?: DialogService; epoch?: number }>();
const service = props.service ?? new DialogService();
const current = shallowRef<DialogEntry>();
const panel = ref<HTMLElement | null>(null);
const invalidAnswer = ref(false);
let sourceFocus: HTMLElement | null = null;
let removeInput: (() => void) | undefined;
let removeCommands: (() => void) | undefined;
let removeAcknowledgments: (() => void) | undefined;
let removeContext: (() => void) | undefined;
let timer = 0;

const refresh = () => {
    const next = service.current;
    if (current.value?.token !== next?.token) {
        invalidAnswer.value = false;
        if (!current.value && next) sourceFocus = document.activeElement as HTMLElement | null;
        const token = next?.token;
        void nextTick(() => {
            if (service.current?.token !== token) return;
            if (next) panel.value?.querySelector<HTMLButtonElement>(`[data-dialog-action="${next.kind === 'confirm' ? next.defaultAction ?? 'no' : 'more'}"]`)?.focus();
            else {
                if (sourceFocus?.isConnected) sourceFocus.focus();
                else document.querySelector<HTMLElement>('.game-view canvas')?.focus();
                sourceFocus = null;
            }
        });
    }
    current.value = next;
};
const unsubscribe = service.subscribe(refresh);
watch(() => props.epoch, () => service.reset(), { flush: 'sync' });
onMounted(() => {
    dialogInput.install(window);
    removeInput = dialogInput.attach({ service, contains: target => !!panel.value?.contains(target as Node),
        hint: () => { invalidAnswer.value = true; }, tab: event => {
            const buttons = [...(panel.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (!buttons.length) return;
            if (index < 0 || (!event.shiftKey && index === buttons.length - 1) || (event.shiftKey && index === 0)) {
                event.preventDefault();
                buttons[event.shiftKey ? buttons.length - 1 : 0]?.focus();
            }
        } });
    removeCommands = bindDialogCommands(service, activeGame);
    removeAcknowledgments = bindDialogAcknowledgments(service, activeGame, logger);
    removeContext = registerHeldInputContext(() => { service.sync(); return [service.current?.token]; });
    timer = window.setInterval(() => { service.sync(); refresh(); }, 50);
    refresh();
});
onUnmounted(() => {
    window.clearInterval(timer);
    removeContext?.(); removeCommands?.(); removeAcknowledgments?.(); removeInput?.(); unsubscribe();
    service.dispose();
});
</script>

<template>
  <Teleport to="body">
    <div v-if="current" class="dialog-backdrop message-ack-backdrop" @contextmenu.prevent>
      <section ref="panel" class="dialog-panel" :class="{ 'dialog-danger': current.danger }"
        role="alertdialog" aria-modal="true" :data-dialog-kind="current.kind"
        :data-dialog-id="current.token.id" :data-dialog-owner="current.owner">
        <h2>{{ current.kind === 'confirm' ? $t('dialog.confirm_title', { defaultValue: 'Confirm' }) : $t('dialog.ack_title', { defaultValue: 'Message' }) }}</h2>
        <p class="dialog-message">{{ current.text }}</p>
        <div class="dialog-actions">
          <template v-if="current.kind === 'confirm'">
            <button type="button" data-dialog-action="yes" :class="{ danger: current.danger }">{{ $t('Yes') }}</button>
            <button type="button" data-dialog-action="no">{{ $t('No') }}</button>
          </template>
          <button v-else type="button" data-dialog-action="more">{{ $t('messages.more', { defaultValue: '--MORE--' }) }}</button>
          <button v-if="current.terminalAvailable" type="button" class="view-result-btn" data-dialog-action="view-result">
            {{ $t('messages.view_result', { defaultValue: 'View Results' }) }}
          </button>
        </div>
        <small v-if="invalidAnswer" class="dialog-invalid">{{ current.kind === 'confirm' ? $t('dialog.confirm_hint', { defaultValue: 'Y / Enter: Yes. N / Space / Esc: No.' }) : $t('messages.acknowledge_hint', { defaultValue: 'Press Space or Esc, or click to continue.' }) }}</small>
        <small v-else>{{ current.kind === 'confirm' ? $t('dialog.confirm_hint', { defaultValue: 'Y / Enter: Yes. N / Space / Esc: No.' }) : $t('messages.acknowledge_hint', { defaultValue: 'Press Space or Esc, or click to continue.' }) }}</small>
        <small v-if="current.terminalAvailable">{{ $t('messages.view_result_hint', { defaultValue: 'Press R to view results; unread messages are kept.' }) }}</small>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center;
  box-sizing: border-box; padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
  background: #000b;
}
.dialog-panel {
  width: min(100%, 560px); max-height: min(90dvh, 100%); min-height: 0;
  display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;
  padding: clamp(12px, 3vw, 24px); border: 1px solid var(--border-color, #615638);
  background: var(--bg-panel, #171913); color: var(--text-primary, #d8c9a1);
  font-family: var(--font-main, monospace); box-shadow: 0 12px 48px #000c;
}
.dialog-danger { border-color: #db7878; }
h2 { flex-shrink: 0; margin: 0 0 12px; font-size: 1rem; color: var(--color-accent, #d8b86a); }
.dialog-message { min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; overflow-wrap: anywhere; white-space: pre-wrap; margin: 0 0 16px; line-height: 1.65; }
.dialog-actions { display: flex; flex-wrap: wrap; gap: 8px; flex-shrink: 0; }
button { flex: 1 1 auto; min-height: 44px; min-width: 88px; padding: 8px 16px; border: 1px solid var(--border-color, #615638); background: var(--btn-bg, #282b21); color: inherit; font: inherit; cursor: pointer; touch-action: manipulation; }
button:focus-visible { outline: 2px solid var(--color-accent, #d8b86a); outline-offset: -4px; }
.danger { color: #db7878; }
small { flex-shrink: 0; display: block; margin-top: 10px; line-height: 1.4; color: var(--text-secondary, #a5a18e); }
.dialog-invalid { color: #db7878; }
@media (max-height: 599px) { .dialog-panel { max-height: 100%; } h2 { margin-bottom: 6px; } small { margin-top: 6px; } }
</style>
