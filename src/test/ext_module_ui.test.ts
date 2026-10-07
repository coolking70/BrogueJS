import { describe, expect, it, vi } from 'vitest';
import { effectScope, onScopeDispose, ref } from 'vue';
import type { Game } from '../engine/Core/Game';
import { ExtensionRegistry } from '../ext/registry';
import type { ExtensionModule } from '../ext/types';
import { prepareModuleCreation, buildModuleCreationCommands } from '../ext/ui/creation';
import { collectModuleUiContributions } from '../ext/ui/registry';
import { DialogService } from '../ui/dialogService';
import { useModuleUi } from '../ext/ui/useModuleUi';
import type { ModuleUiContribution, ModuleUiHost, ModuleUiSession } from '../ext/ui/types';

const component = { render: () => null };
function registry() {
    const result = new ExtensionRegistry();
    for (const [id, initial] of [['alpha', true], ['beta', false], ['gamma', true]] as const) result.register(id, '1.0.0', () => ({
        id, version: '1.0.0', initialState: () => ({}),
        ...(initial ? { initialCommand: { action: 'initialize', payload: { revision: 0 } } } : {}),
    } as ExtensionModule));
    return result;
}
describe('module UI selection and creation ownership', () => {
    it('supports an empty subset with no steps and no invented input', () => {
        const plan = prepareModuleCreation([], [], registry());
        expect(plan.extensions).toEqual([]); expect(plan.steps).toEqual([]);
        expect(buildModuleCreationCommands(plan, new Map())).toEqual([]);
    });
    it('uses the exact stable selected set, optional creation steps and no-UI declared defaults', () => {
        const ids = ['gamma', 'beta', 'alpha'];
        const plan = prepareModuleCreation(ids, [{ moduleId: 'alpha', creationStep: component }], registry());
        ids.pop();
        expect(plan.extensions).toEqual(['alpha', 'beta', 'gamma']);
        expect(plan.steps.map(step => step.moduleId)).toEqual(['alpha']);
        const selected = JSON.stringify({ module: 'alpha', action: 'initialize', payload: { revision: 0, choice: 7 } });
        const commands = buildModuleCreationCommands(plan, new Map([['alpha', [selected]]]));
        expect(commands.map(command => JSON.parse(command))).toEqual([
            { module: 'alpha', action: 'initialize', payload: { revision: 0, choice: 7 } },
            { module: 'gamma', action: 'initialize', payload: { revision: 0 } },
        ]);
    });
    it('rejects incomplete, duplicate, foreign-owner and wrong-action input batches', () => {
        const plan = prepareModuleCreation(['alpha'], [{ moduleId: 'alpha', creationStep: component }], registry());
        const valid = JSON.stringify({ module: 'alpha', action: 'initialize', payload: { revision: 0 } });
        expect(() => buildModuleCreationCommands(plan, new Map())).toThrow();
        for (const values of [[valid, valid], [valid.replace('alpha', 'gamma')], [valid.replace('initialize', 'other')], ['null']]) {
            expect(() => buildModuleCreationCommands(plan, new Map([['alpha', values]]))).toThrow();
        }
        expect(() => buildModuleCreationCommands(plan, new Map([['alpha', [valid]], ['gamma', []]]))).toThrow();
    });
    it('validates UI descriptor ownership and uses stable module order', () => {
        const entry = (moduleId: string) => ({ moduleId, creationStep: component });
        const at = (moduleId: string) => `../modules/${moduleId}/ui/descriptor.ts`;
        expect(collectModuleUiContributions({ [at('gamma')]: entry('gamma'), [at('alpha')]: entry('alpha') }, ['alpha', 'gamma']).map(item => item.moduleId)).toEqual(['alpha', 'gamma']);
        expect(() => collectModuleUiContributions({ [at('missing')]: entry('missing') }, ['alpha'])).toThrow();
        expect(() => collectModuleUiContributions({ [at('alpha')]: entry('gamma') }, ['alpha', 'gamma'])).toThrow();
        expect(() => collectModuleUiContributions({ [at('alpha')]: entry('alpha'), [at('gamma')]: entry('alpha') }, ['alpha'])).toThrow();
    });
    it('rejects native-action hijacking, foreign command owners and duplicate command IDs', () => {
        for (const ids of [['wait'], ['beta:open'], ['alpha:'], ['alpha:open', 'alpha:open']]) {
            const scope = effectScope();
            const game = { extensionRuntime: { manifest: { modules: [{ id: 'alpha' }] } } } as unknown as Game;
            const ui = scope.run(() => useModuleUi({ game: () => game, tick: ref(0), immersive: ref(false), canOpenPanel: () => true, beforeOpenPanel() {}, afterClosePanel() {} }, [
                { moduleId: 'alpha', useSession: () => ({ hud: ref(null), bar: ref(null), panel: ref(null), panelOpen: ref(false),
                    commands: ref(ids.map(id => ({ id, label: id, invoke: vi.fn() }))), refresh() {}, close() {} }) },
            ]))!;
            ui.refresh(); expect(() => ui.commands.value).toThrow('ownership'); scope.stop();
        }
    });
    it.each(['alpha.open', 'alpha:open'])('accepts the owned SDK1 UI command %s', id => {
        const scope = effectScope(), invoke = vi.fn();
        const game = { extensionRuntime: { manifest: { modules: [{ id: 'alpha' }] } } } as unknown as Game;
        const ui = scope.run(() => useModuleUi({ game: () => game, tick: ref(0), immersive: ref(false), canOpenPanel: () => true, beforeOpenPanel() {}, afterClosePanel() {} }, [
            { moduleId: 'alpha', useSession: () => ({ hud: ref(null), bar: ref(null), panel: ref(null), panelOpen: ref(false),
                commands: ref([{ id, label: id, invoke }]), refresh() {}, close() {} }) },
        ]))!;
        try { ui.refresh(); ui.commands.value[0]!.invoke(); expect(invoke).toHaveBeenCalledOnce(); }
        finally { scope.stop(); }
    });
    it('retires exposed command and panel callbacks on replacement and scope disposal', () => {
        const called = vi.fn(), game = { extensionRuntime: { manifest: { modules: [{ id: 'alpha' }] } } } as unknown as Game;
        const scope = effectScope();
        const ui = scope.run(() => useModuleUi({ game: () => game, tick: ref(0), immersive: ref(false), canOpenPanel: () => true, beforeOpenPanel() {}, afterClosePanel() {} }, [
            { moduleId: 'alpha', useSession: () => ({ hud: ref(null), bar: ref(null), panel: ref({ component, props: { onSubmit: called } }), panelOpen: ref(true),
                commands: ref([{ id: 'alpha:open', label: 'open', invoke: called }]), refresh() {}, close() {} }) },
        ]))!;
        ui.refresh(); const command = ui.commands.value[0]!, submit = ui.panelSlots.value[0]!.props.onSubmit as () => void;
        command.invoke(); submit(); expect(called).toHaveBeenCalledTimes(2); called.mockClear();
        game.extensionRuntime = { manifest: { modules: [{ id: 'alpha' }] } } as Game['extensionRuntime'];
        command.invoke(); submit(); expect(called).not.toHaveBeenCalled();
        ui.refresh(); const nextCommand = ui.commands.value[0]!, nextSubmit = ui.panelSlots.value[0]!.props.onSubmit as () => void;
        scope.stop(); nextCommand.invoke(); nextSubmit(); expect(called).not.toHaveBeenCalled();
    });
    it('suspends all generic slots without replacing sessions or drafts and immediately resumes the latest view', () => {
        const dialogs = new DialogService(), tick = ref(0), scope = effectScope();
        let busy = false, current = 1;
        const game = { extensionRuntime: { manifest: { modules: [{ id: 'alpha' }] } }, replayRecording: null } as unknown as Game;
        const invoke = vi.fn(), dispose = vi.fn(), draft = { selection: 'kept' }, model = ref({ value: current });
        const slot = ref({ component, props: { model, draft, onSubmit: invoke, style: { color: 'red' } } });
        const factory = vi.fn((): ModuleUiSession => {
            onScopeDispose(dispose);
            return { hud: slot, bar: slot, panel: slot, panelOpen: ref(true), commands: ref([{ id: 'alpha:open', label: 'open', glyph: '●', invoke }]),
                refresh() { model.value = { value: current }; }, close: vi.fn() };
        });
        const ui = scope.run(() => useModuleUi({ dialogs, game: () => game, tick, immersive: ref(false),
            isPresentationBusy: () => busy, canOpenPanel: () => true, beforeOpenPanel() {}, afterClosePanel() {},
        }, [{ moduleId: 'alpha', useSession: factory }]))!;
        ui.refresh(); const submit = ui.panelSlots.value[0]!.props.onSubmit as () => void;
        busy = true; current = 2; dialogs.sync();
        for (const slots of [ui.hudSlots, ui.barSlots, ui.panelSlots]) expect(slots.value[0]!.props.presentationHidden).toBe(true);
        expect(ui.hudSlots.value[0]!.props.style).toEqual([{ color: 'red' }, { visibility: 'hidden' }]);
        expect(ui.hudSlots.value[0]!.props.inert).toBe(true); expect(ui.barSlots.value[0]!.props['aria-hidden']).toBe(true);
        expect(ui.commands.value[0]).toMatchObject({ disabled: true, glyph: '' });
        submit(); ui.commands.value[0]!.invoke(); expect(invoke).not.toHaveBeenCalled();
        expect(ui.panelOpen.value).toBe(true); expect(factory).toHaveBeenCalledTimes(1); expect(dispose).not.toHaveBeenCalled();
        const sameDraft = ui.panelSlots.value[0]!.props.draft;
        busy = false; dialogs.sync();
        expect(tick.value).toBe(0); expect(model.value.value).toBe(2); expect(ui.panelSlots.value[0]!.props.draft).toBe(sameDraft);
        expect(ui.panelSlots.value[0]!.props.presentationHidden).toBe(false); submit(); expect(invoke).toHaveBeenCalledTimes(1);
        // Replay/seek inspection cannot be suppressed by a stale live gate.
        busy = true; Object.defineProperty(game, 'replayRecording', { value: {}, configurable: true }); dialogs.sync();
        expect(ui.hudSlots.value[0]!.props.presentationHidden).toBe(false); expect(ui.commands.value[0]!.disabled).toBe(false);
        scope.stop(); expect(dispose).toHaveBeenCalledTimes(1); dialogs.dispose();
    });
    it('starts only enabled UI sessions and disposes on manifest runtime replacement and unmount', () => {
        const tick = ref(0), dispose = vi.fn(), refresh = vi.fn(), factory = vi.fn((): ModuleUiSession => {
            onScopeDispose(dispose);
            return { hud: ref(null), bar: ref(null), panel: ref(null), commands: ref([]), panelOpen: ref(false), refresh, close: vi.fn() };
        });
        const contribution: ModuleUiContribution = { moduleId: 'alpha', useSession: factory };
        const game = { extensionRuntime: null } as unknown as Game;
        const host: ModuleUiHost = { game: () => game, tick, immersive: ref(false), canOpenPanel: () => true, beforeOpenPanel() {}, afterClosePanel() {} };
        const scope = effectScope(), ui = scope.run(() => useModuleUi(host, [contribution]))!;
        ui.refresh(); tick.value++; expect(factory).not.toHaveBeenCalled();
        game.extensionRuntime = { manifest: { modules: [{ id: 'beta' }] } } as Game['extensionRuntime'];
        ui.refresh(); expect(factory).not.toHaveBeenCalled();
        game.extensionRuntime = { manifest: { modules: [{ id: 'alpha' }] } } as Game['extensionRuntime'];
        ui.refresh(); expect(factory).toHaveBeenCalledTimes(1); expect(refresh).toHaveBeenCalledTimes(1);
        tick.value++; expect(factory).toHaveBeenCalledTimes(1); expect(refresh).toHaveBeenCalledTimes(2);
        game.extensionRuntime = { manifest: { modules: [{ id: 'alpha' }] } } as Game['extensionRuntime'];
        ui.refresh(); expect(factory).toHaveBeenCalledTimes(2); expect(dispose).toHaveBeenCalledTimes(1);
        game.extensionRuntime = null; ui.refresh(); expect(dispose).toHaveBeenCalledTimes(2);
        expect(ui.hudSlots.value).toEqual([]); expect(ui.commands.value).toEqual([]); expect(ui.panelOpen.value).toBe(false);
        game.extensionRuntime = { manifest: { modules: [{ id: 'alpha' }] } } as Game['extensionRuntime'];
        ui.refresh(); scope.stop(); expect(dispose).toHaveBeenCalledTimes(3);
    });
});
