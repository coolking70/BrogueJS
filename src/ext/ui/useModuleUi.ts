import { computed, effectScope, onScopeDispose, shallowRef, watch, type EffectScope } from 'vue';
import { getInstalledModuleUiContributions } from './registry';
import type { ModuleUiContribution, ModuleUiHost, ModuleUiSession } from './types';

/** Sessions follow the exact live runtime, including load/restart/seek replacements. */
export function useModuleUi(host: ModuleUiHost, contributions: readonly ModuleUiContribution[] = getInstalledModuleUiContributions()) {
    const sessions = shallowRef<readonly { id: string; session: ModuleUiSession; scope: EffectScope; live(): boolean }[]>([]);
    let runtime = host.game().extensionRuntime;
    let initialized = false;
    function dispose() { for (const entry of sessions.value) entry.scope.stop(); sessions.value = []; }
    function refresh() {
        const next = host.game().extensionRuntime;
        if (!initialized || runtime !== next) {
            dispose(); runtime = next; initialized = true;
            const enabled = new Set(next?.manifest.modules.map(entry => entry.id) ?? []);
            sessions.value = contributions.filter(entry => enabled.has(entry.moduleId) && entry.useSession).map(entry => {
                const scope = effectScope(), game = host.game();
                let retired = false;
                const session = scope.run(() => {
                    onScopeDispose(() => { retired = true; });
                    return entry.useSession!(host);
                })!;
                return { id: entry.moduleId, session, scope, live: () => !retired && host.game() === game && game.extensionRuntime === next };
            });
        }
        for (const entry of sessions.value) entry.session.refresh();
    }
    watch(host.tick, refresh, { flush: 'sync' });
    onScopeDispose(dispose);
    const slots = (kind: 'hud' | 'bar' | 'panel') => computed(() => sessions.value.flatMap(entry => {
        const slot = entry.session[kind].value;
        return slot ? [{ id: entry.id, component: slot.component, props: Object.fromEntries(Object.entries(slot.props).map(([key, value]) => [
            key, typeof value === 'function' ? (...args: unknown[]) => { if (entry.live()) return value(...args); } : value,
        ])) }] : [];
    }));
    return {
        hudSlots: slots('hud'), barSlots: slots('bar'), panelSlots: slots('panel'),
        commands: computed(() => {
            const seen = new Set<string>();
            return sessions.value.flatMap(entry => entry.session.commands.value.map(command => {
                if (!command.id.startsWith(`${entry.id}:`) || command.id.length <= entry.id.length + 1 || seen.has(command.id))
                    throw new Error('Invalid module UI command ownership');
                seen.add(command.id);
                return { ...command, invoke: () => { if (entry.live()) command.invoke(); } };
            }));
        }),
        panelOpen: computed(() => sessions.value.some(entry => entry.session.panelOpen.value)),
        closePanels: () => { for (const entry of sessions.value) entry.session.close(); },
        refresh,
    };
}
