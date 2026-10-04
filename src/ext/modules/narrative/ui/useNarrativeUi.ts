import { computed, defineAsyncComponent, nextTick, onScopeDispose, ref, shallowRef } from 'vue';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
import { presentationTimeline, type DialogAction, type DialogRequest } from '../../../../ui/dialogService';
import { buildNarrativeUiCommand, readNarrativeUiView, type NarrativeUiView } from './view';
const NarrativeInteractionBar = defineAsyncComponent(() => import('./NarrativeInteractionBar.vue'));
const NarrativeDialogue = defineAsyncComponent(() => import('./NarrativeDialogue.vue'));

/** The adapter alone owns command capability. The component sees the current
 * public projection, never Game, definitions, effects or future story state.
 * DialogInput owns all physical release/pointer arbitration; no local barriers. */
export function useNarrativeUi(host: ModuleUiHost): ModuleUiSession {
    const game = host.game(), runtime = game.extensionRuntime, service = host.dialogs;
    let retired = false, reconciling = false, request: DialogRequest | undefined;
    let page: 'dialogue' | 'journal' | 'portrait' = 'dialogue';
    const live = () => !retired && host.game() === game && game.extensionRuntime === runtime;
    const view = shallowRef<NarrativeUiView | null>(null), submitting = ref(false), error = ref<'ext.narrative.ui.command_rejected' | null>(null);
    let shown: NarrativeUiView | null = null;
    let shownError: typeof error.value = null;
    function retireRequest() { request?.cancel(); request = undefined; shown = null; }
    function refresh() {
        if (reconciling) return;
        reconciling = true;
        try { refreshCurrent(); } finally { reconciling = false; }
    }
    function refreshCurrent() {
        if (!live()) { retireRequest(); return; }
        const next = readNarrativeUiView(game);
        if (next?.active?.sessionId !== view.value?.active?.sessionId) page = 'dialogue';
        view.value = next;
        // Replay has an inline read-only projection. A display wait must never
        // pause playback or block seek, even if the mechanical session is open.
        if (!next?.active || next.readOnly || host.canPresentInteraction?.() === false) { retireRequest(); return; }
        if (shown && (shown.session !== next.session || shown.revision !== next.revision || shownError !== error.value)) retireRequest();
        syncDialog();
    }
    function submit(expected: NarrativeUiView, action: 'open' | 'choose' | 'close', id?: number | string): boolean {
        if (!live() || submitting.value || (action === 'open' && (!host.canOpenPanel() || host.canOpenInteraction?.() === false || !!service?.current))) return false;
        const command = buildNarrativeUiCommand(game, expected, action, id);
        if (!command) return false;
        submitting.value = true; error.value = null;
        try {
            game.executeCommand('ext:command', command);
            const current = readNarrativeUiView(game);
            if (current?.revision === expected.revision) { error.value = 'ext.narrative.ui.command_rejected'; return false; }
            if (expected.active && !current?.active) host.afterClosePanel();
            return true;
        } catch { if (live()) error.value = 'ext.narrative.ui.command_rejected'; return false; }
        finally {
            // Answer settles its token before source sync creates the next node.
            void nextTick(() => { if (live()) { submitting.value = false; refresh(); } });
        }
    }
    function syncDialog() {
        if (!service || !live()) return;
        const expected = view.value;
        if (!expected?.active || expected.readOnly || host.canPresentInteraction?.() === false || submitting.value || presentationTimeline(game)?.busy) return;
        if (request && service.isPending(request.token)) return;
        const actions: DialogAction[] = page === 'dialogue'
            ? ['close', 'journal', 'portrait', ...expected.active.choices.filter(choice => choice.enabled).map(choice => `choice:${choice.id}` as const)]
            : ['back', 'close'];
        const choices = page === 'dialogue' ? expected.active.choices.map(choice => ({ action: `choice:${choice.id}` as const, enabled: choice.enabled })) : [];
        shown = expected; shownError = error.value;
        request = service.request({ kind: 'dialogue', owner: 'narrative', text: '',
            content: { component: NarrativeDialogue, props: { model: expected, page, submitting: false, error: error.value } },
            actions, choices, defaultAction: page === 'dialogue' ? choices.find(choice => choice.enabled)?.action ?? 'close' : 'back',
            onAnswer: action => {
                if (!live() || shown !== expected) return false;
                if (action === 'journal' || action === 'portrait' || action === 'back') {
                    page = action === 'back' ? 'dialogue' : action;
                    request = undefined; shown = null;
                    return true;
                }
                const accepted = action === 'close' ? submit(expected, 'close')
                    : action.startsWith('choice:') && submit(expected, 'choose', action.slice(7));
                if (accepted) { request = undefined; shown = null; }
                return accepted;
            } });
    }
    const removeSource = service?.registerSource(refresh, -10) ?? (() => {});
    onScopeDispose(() => { retired = true; removeSource(); retireRequest(); });
    refresh();
    return {
        hud: computed(() => null), panel: computed(() => null), commands: computed(() => []),
        panelOpen: computed(() => !!view.value?.active && !view.value.readOnly && host.canPresentInteraction?.() !== false), refresh,
        // Lifecycle cleanup never silently records a mechanical close.
        close: () => { reconciling = true; try { retireRequest(); error.value = null; } finally { reconciling = false; } },
        bar: computed(() => {
            host.tick.value;
            const expected = view.value;
            if (!expected || (!expected.readOnly && presentationTimeline(game)?.busy) || (!expected.readOnly && expected.active) || (!expected.active && !expected.nearby.length && !expected.journal.length)) return null;
            return { component: NarrativeInteractionBar, props: { model: expected, submitting: submitting.value, error: error.value,
                blocked: !host.canOpenPanel() || host.canOpenInteraction?.() === false || !!service?.current,
                onOpen: (id: number, event?: MouseEvent) => { if ((event?.detail ?? 0) <= 1) submit(expected, 'open', id); },
            } };
        }),
    };
}
