import { computed, defineAsyncComponent, nextTick, onScopeDispose, ref, shallowRef } from 'vue';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
import { cancelHeldInputs } from '../../../../ui/heldInput';
import { buildNarrativeUiCommand, readNarrativeUiView, type NarrativeUiView } from './view';
const NarrativeInteractionBar = defineAsyncComponent(() => import('./NarrativeInteractionBar.vue'));

/** Temporary 2b inline controls. No modal host or display pause: the engine's
 * active interaction owns the zero-tick world gate, including headless runs. */
export function useNarrativeUi(host: ModuleUiHost): ModuleUiSession {
    const game = host.game(), runtime = game.extensionRuntime;
    let retired = false, escapeHeld = false;
    const live = () => !retired && host.game() === game && game.extensionRuntime === runtime;
    const view = shallowRef<NarrativeUiView | null>(null), submitting = ref(false), error = ref<'ext.narrative.ui.command_rejected' | null>(null);
    const cancelHeld = () => { cancelHeldInputs(); host.cancelHeldKeys?.(); };
    function refresh() {
        if (!live()) return;
        const next = readNarrativeUiView(game);
        if (next?.active && next.active.sessionId !== view.value?.active?.sessionId) cancelHeld();
        view.value = next;
    }
    // A closing button may disappear before a physical double-click's second
    // pointerup. Swallow only that same-position gesture, never another run.
    let removeDismissal: (() => void) | undefined;
    function guardDismissal(event?: MouseEvent | KeyboardEvent) {
        removeDismissal?.();
        if (!event || !('clientX' in event) || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
        const names = ['pointerdown', 'pointerup', 'click', 'dblclick'] as const;
        const stop = (candidate: Event) => {
            const pointer = candidate as MouseEvent;
            if (!live() || Math.abs(pointer.clientX - event.clientX) > 6 || Math.abs(pointer.clientY - event.clientY) > 6) return;
            candidate.preventDefault(); candidate.stopImmediatePropagation();
        };
        const clear = () => { for (const name of names) window.removeEventListener(name, stop, true); window.clearTimeout(timer); removeDismissal = undefined; };
        for (const name of names) window.addEventListener(name, stop, true);
        const timer = window.setTimeout(clear, 500);
        removeDismissal = clear;
    }
    async function submit(expected: NarrativeUiView, action: 'open' | 'choose' | 'close', id?: number | string, event?: MouseEvent | KeyboardEvent) {
        if (!live() || submitting.value || (event?.detail ?? 0) > 1 || (action === 'open' && !host.canOpenPanel())) return;
        const command = buildNarrativeUiCommand(game, expected, action, id);
        if (!command) return;
        if (event && 'key' in event && event.key === 'Escape') escapeHeld = true;
        submitting.value = true; error.value = null;
        cancelHeld();
        try {
            game.executeCommand('ext:command', command);
            refresh();
            if (view.value?.revision === expected.revision) error.value = 'ext.narrative.ui.command_rejected';
            if (expected.active && !view.value?.active) {
                guardDismissal(event);
                host.afterClosePanel();
            }
        } catch { if (live()) { error.value = 'ext.narrative.ui.command_rejected'; refresh(); } }
        finally { await nextTick(); if (live()) submitting.value = false; }
    }
    const releaseEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') escapeHeld = false; };
    window.addEventListener('keyup', releaseEscape, true);
    const removeKeyboard = host.registerKeyHandler?.(event => {
        if (!live() || game.replayRecording || event.key !== 'Escape') return false;
        if (escapeHeld && event.repeat) { event.preventDefault(); return true; }
        refresh();
        if (!view.value?.active) return false;
        event.preventDefault(); escapeHeld = true;
        if (!event.repeat) void submit(view.value, 'close');
        return true;
    }, 550) ?? (() => {});
    onScopeDispose(() => { retired = true; removeKeyboard(); removeDismissal?.(); window.removeEventListener('keyup', releaseEscape, true); });
    refresh();
    return {
        hud: computed(() => null), panel: computed(() => null), commands: computed(() => []),
        panelOpen: computed(() => false), refresh,
        // Host display cleanup must never silently submit a mechanical close.
        close: () => { if (live()) { cancelHeld(); error.value = null; } },
        bar: computed(() => {
            host.tick.value;
            const expected = view.value;
            if (!expected || (!expected.active && !expected.nearby.length)) return null;
            return { component: NarrativeInteractionBar, props: { model: expected, submitting: submitting.value, error: error.value,
                blocked: !expected.active && !host.canOpenPanel(),
                onOpen: (id: number, event?: MouseEvent) => submit(expected, 'open', id, event),
                onChoose: (id: string, event?: MouseEvent) => submit(expected, 'choose', id, event),
                onClose: (event?: MouseEvent | KeyboardEvent) => submit(expected, 'close', undefined, event),
            } };
        }),
    };
}
