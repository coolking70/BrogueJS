<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { activeGame } from '../engine/Core/Game';
import { logger } from '../engine/Systems/Logger';
import { DialogService, type DialogEntry } from '../ui/dialogService';
import { dialogInput } from '../ui/dialogInput';
import { bindDialogAcknowledgments, bindDialogCommands, presentationTimeline } from '../ui/dialogAcknowledgments';
import { registerHeldInputContext } from '../ui/heldInput';

const props = defineProps<{ service?: DialogService; epoch?: number }>();
const service = props.service ?? new DialogService();
const current = shallowRef<DialogEntry>();
const panel = ref<HTMLElement | null>(null);
const invalidAnswer = ref(false);
const resultAvailable = ref(false);
const viewResult = () => presentationTimeline(activeGame)?.showResult();
let sourceFocus: HTMLElement | null = null;
let removeInput: (() => void) | undefined;
let removeCommands: (() => void) | undefined;
let removeAcknowledgments: (() => void) | undefined;
let removeContext: (() => void) | undefined;
let timer = 0;

const visible = (element: HTMLElement) => !element.hasAttribute?.('disabled') && !element.closest('[style*="display: none"]');
const focusableElements = () => [...(panel.value?.querySelectorAll<HTMLElement>('button, [tabindex="0"]') ?? [])].filter(visible);
const focusableButtons = () => [...(panel.value?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
    .filter(button => !button.disabled && visible(button));
const focusAction = (action: string | undefined) => {
    const buttons = focusableButtons();
    (buttons.find(button => button.getAttribute('data-dialog-action') === action) ?? buttons[0])?.focus();
};
const refresh = () => {
    resultAvailable.value = !!presentationTimeline(activeGame)?.resultAvailable;
    const next = service.current;
    if (current.value?.token !== next?.token) {
        invalidAnswer.value = false;
        if (!current.value && next) sourceFocus = document.activeElement as HTMLElement | null;
        const token = next?.token;
        void nextTick(() => {
            if (service.current?.token !== token) return;
            if (next) focusAction(next.kind === 'confirm' ? next.defaultAction ?? 'no' : next.kind === 'dialogue' ? next.defaultAction : 'more');
            else {
                if (sourceFocus?.isConnected) sourceFocus.focus();
                else document.querySelector<HTMLElement>('.game-view canvas')?.focus();
                sourceFocus = null;
            }
        });
    }
    current.value = next;
    // Lazy module content may mount after the token's first nextTick.
    if (next && panel.value && !panel.value.contains(document.activeElement))
        focusAction(next.kind === 'dialogue' ? next.defaultAction : next.kind === 'confirm' ? next.defaultAction ?? 'no' : 'more');
};
const unsubscribe = service.subscribe(refresh);
watch(() => props.epoch, () => service.reset(), { flush: 'sync' });
onMounted(() => {
    dialogInput.install(window);
    removeInput = dialogInput.attach({ service, contains: target => !!panel.value?.contains(target as Node),
        blocked: () => !!presentationTimeline(activeGame)?.busy,
        resultAvailable: () => !!presentationTimeline(activeGame)?.resultAvailable, viewResult,
        hint: () => { invalidAnswer.value = true; }, navigate: event => {
            const buttons = focusableButtons().filter(button => button.getAttribute('data-dialog-action')?.startsWith('choice:'));
            if (!buttons.length) return;
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            buttons[index < 0 ? (event.key === 'ArrowUp' ? buttons.length - 1 : 0)
                : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        }, scroll: event => {
            const regions = [...(panel.value?.querySelectorAll<HTMLElement>('[data-dialog-scroll]') ?? [])].filter(visible);
            const region = regions.find(item => item.contains(document.activeElement)) ?? regions[0];
            if (!region) return;
            const page = Math.max(44, region.clientHeight - 24);
            region.scrollTop = event.key === 'Home' ? 0 : event.key === 'End' ? region.scrollHeight
                : Math.max(0, region.scrollTop + (event.key === 'PageUp' ? -page : page));
        }, tab: event => {
            const buttons = focusableElements();
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
    <button v-if="!current && resultAvailable" type="button" class="timeline-result view-result-btn" data-dialog-action="view-result">
      {{ $t('messages.view_result', { defaultValue: 'View Results' }) }}
    </button>
    <div v-if="current" class="dialog-backdrop message-ack-backdrop" @contextmenu.prevent>
      <section ref="panel" class="dialog-panel" :class="{ 'dialog-danger': current.danger, 'dialog-content-panel': current.kind === 'dialogue' }"
        role="alertdialog" aria-modal="true" :data-dialog-kind="current.kind"
        :data-dialog-id="current.token.id" :data-dialog-owner="current.owner">
        <component v-if="current.kind === 'dialogue' && current.content" :is="current.content.component" v-bind="current.content.props" />
        <template v-else>
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
        </template>
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
.dialog-content-panel { width: min(100%, 920px); min-width: 0; max-height: calc(100dvh - 24px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
@media (max-width: 700px) { .dialog-content-panel { padding: 12px; } }
.dialog-danger { border-color: #db7878; }
.timeline-result { position: fixed; bottom: max(16px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); z-index: 10000; }
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
