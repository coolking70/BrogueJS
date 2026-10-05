import { computed, defineAsyncComponent, nextTick, onScopeDispose, ref, shallowRef } from 'vue';
import i18next from 'i18next';
import type { ModuleUiHost, ModuleUiSession } from '../../../ui/types';
import type { DialogAction, DialogRequest } from '../../../../ui/dialogService';
import { buildCombatUiCommand, combatDirections, readCombatUiView, type CombatUiView } from './view';
import type { Facing } from '../types';
import { telegraphsAt } from '../../../../ui/combatDrawing';
import type { DisplayFrame } from '../../../../ui/displayProjection';
import { installCombatDiagnostics } from './diagnostics';
const CombatAttackBar = defineAsyncComponent(() => import('./CombatAttackBar.vue'));
const CombatAttackDialog = defineAsyncComponent(() => import('./CombatAttackDialog.vue'));
const CombatTelegraphHud = defineAsyncComponent(() => import('./CombatTelegraphHud.vue'));

/** DialogHost/DialogInput own pointer and held-key barriers for every transition. */
export function useCombatUi(host: ModuleUiHost): ModuleUiSession {
    const game = host.game(), runtime = game.extensionRuntime, service = host.dialogs;
    const live = () => !retired && host.game() === game && game.extensionRuntime === runtime;
    let retired = false, refreshing = false, request: DialogRequest | undefined;
    const view = shallowRef<CombatUiView | null>(null), submitting = ref(false), error = ref<string | null>(null);
    const frame = shallowRef<DisplayFrame | null>(null);
    const selected = shallowRef<{ expected: CombatUiView; attackId: string; facing: Facing | null } | null>(null);
    const blocked = () => !live() || !service || submitting.value || !!host.isPresentationBusy?.()
        || !host.canOpenPanel() || host.canOpenInteraction?.() === false || !!service.current;
    function close() {
        const wasOpen = !!selected.value;
        selected.value = null; request?.cancel(); request = undefined;
        if (wasOpen) host.afterClosePanel();
    }
    function refresh() {
        if (refreshing) return;
        refreshing = true;
        try {
            if (!live()) { close(); return; }
            frame.value = host.readDisplayFrame?.() ?? null;
            // No live combat query while a historical presentation owns the screen.
            if (host.isPresentationBusy?.()) { close(); return; }
            view.value = readCombatUiView(game);
            const current = view.value, pending = selected.value;
            if (pending && (!current || current.readOnly || current.session !== pending.expected.session
                || current.revision !== pending.expected.revision || host.canPresentInteraction?.() === false)) close();
            syncDialog();
        } finally { refreshing = false; }
    }
    function open(attackId: string, event?: MouseEvent) {
        if ((event?.detail ?? 0) > 1 || blocked()) return;
        refresh(); const expected = view.value;
        if (!expected || expected.readOnly || !expected.actions.some(action => action.id === attackId && action.canUse)) return;
        host.beforeOpenPanel(); error.value = null;
        selected.value = { expected, attackId, facing: null }; refresh();
    }
    function submit(expected: CombatUiView, attackId: string, facing: Facing) {
        const command = buildCombatUiCommand(game, expected, attackId, facing);
        if (!command || submitting.value || !live()) { error.value = 'ext.combat.ui.command_rejected'; return; }
        submitting.value = true;
        try {
            game.executeCommand('ext:command', command);
            if (live() && !game.pendingCommandConfirmation && readCombatUiView(game)?.revision === expected.revision)
                error.value = 'ext.combat.ui.command_rejected';
        }
        catch { error.value = 'ext.combat.ui.command_rejected'; }
        finally { void nextTick(() => { if (live()) { submitting.value = false; refresh(); } }); }
    }
    function syncDialog() {
        const pending = selected.value;
        if (!live() || !service || !pending || submitting.value || host.isPresentationBusy?.()
            || (request && service.isPending(request.token))) return;
        const attack = pending.expected.actions.find(action => action.id === pending.attackId)!;
        const choices = pending.facing ? [{ action: 'choice:confirm' as const, enabled: true }]
            : combatDirections.map(direction => ({ action: `choice:${direction.facing}` as DialogAction, enabled: true }));
        const actions: DialogAction[] = ['close', ...(pending.facing ? ['back' as const] : []), ...choices.map(choice => choice.action)];
        request = service.request({ kind: 'dialogue', owner: 'combat', text: '', actions, choices,
            defaultAction: pending.facing ? 'back' : 'close',
            content: { component: CombatAttackDialog, props: { attack, facing: pending.facing } },
            onAnswer: action => {
                if (!live() || selected.value !== pending) return false;
                request = undefined;
                if (action === 'close') { selected.value = null; host.afterClosePanel(); }
                else if (action === 'back') selected.value = { ...pending, facing: null };
                else if (action === 'choice:confirm' && pending.facing) {
                    selected.value = null; host.afterClosePanel(); submit(pending.expected, pending.attackId, pending.facing);
                } else {
                    const direction = combatDirections.find(entry => action === `choice:${entry.facing}`);
                    if (!direction) return false;
                    selected.value = { ...pending, facing: direction.facing };
                }
                return true;
            },
        });
    }
    const removeDiagnostics = installCombatDiagnostics(game);
    const removeSource = service?.registerSource(refresh, -20) ?? (() => {});
    const removeReset = service?.onReset(close) ?? (() => {});
    onScopeDispose(() => { retired = true; removeSource(); removeReset(); removeDiagnostics(); close(); });
    refresh();
    return {
        hud: computed(() => {
            const current = frame.value;
            if (!current?.telegraphs.length) return null;
            // Hover is an optional inspection filter, never a condition for
            // showing danger. A stale ordinary/unknown cell must not erase the
            // overview after a direction dialog opens or is cancelled. While
            // aiming, keep the complete current-frame overview behind the dialog.
            const inspected = !selected.value && current.hoverCell ? telegraphsAt(current.telegraphs, current.hoverCell) : [];
            const threats = inspected.length ? inspected : current.telegraphs;
            return { component: CombatTelegraphHud, props: { focused: inspected.length > 0,
                entries: threats.map(threat => ({ key: `${threat.actionId}:${threat.sourceSubactionId}`,
                    name: current.rows.find(row => row.kind === 'monster' && row.id === threat.sourceEntityId)?.name ?? null,
                    phase: threat.phase })) } };
        }), panel: computed(() => null), panelOpen: computed(() => !!selected.value),
        refresh, close,
        commands: computed(() => {
            host.tick.value;
            return view.value?.actions.map(action => ({ id: `combat:${action.id}`, label: i18next.t(action.nameKey),
                disabled: blocked() || view.value!.readOnly || !action.canUse, invoke: () => open(action.id) })) ?? [];
        }),
        bar: computed(() => {
            host.tick.value;
            return view.value?.actions.length ? { component: CombatAttackBar, props: {
                model: view.value, blocked: blocked(), error: error.value, onAttack: open,
            } } : null;
        }),
    };
}
