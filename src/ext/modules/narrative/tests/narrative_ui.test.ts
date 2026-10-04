import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import type { Game } from '../../../../engine/Core/Game';
import type { ModuleUiHost } from '../../../ui/types';
import { DialogService } from '../../../../ui/dialogService';
import * as dialogPresentation from '../../../../ui/dialogService';
import { DialogInput } from '../../../../ui/dialogInput';
import { useNarrativeUi } from '../ui/useNarrativeUi';
import { buildNarrativeUiCommand, readNarrativeUiView, type NarrativeActiveView } from '../ui/view';
import { rng } from '../../../../engine/Random';

const nearby = [{ targetEntityId: 21, nameKey: 'ext.narrative.npc.keeper.name', descriptionKey: 'ext.narrative.npc.keeper.description', glyph: '人', color: '#c3ad80' }];
function active(sessionId = 1): NarrativeActiveView {
    return { sessionId, targetEntityId: 21, nodeId: 'hello', speakerNameKey: nearby[0]!.nameKey,
        textKey: 'ext.narrative.dialogue.keeper.hello', portraitId: null, transitionLimitReached: false,
        choices: [{ id: 'read-note', textKey: 'ext.narrative.choice.read', enabled: true, unavailableKey: null },
            { id: 'leave', textKey: 'ext.narrative.choice.leave', enabled: false, unavailableKey: 'ext.narrative.choice.already_read' }] };
}
function fixture() {
    const state = { revision: 0, nearby, active: null as NarrativeActiveView | null, journal: [] };
    const runtime = { readModuleView: () => ({ session: token, state }) }, token = {};
    const raw = { extensionRuntime: runtime, replayRecording: null as object | null, isGameOver: false,
        executeCommand: vi.fn((_type: string, raw: string) => {
            const input = JSON.parse(raw); state.revision++;
            state.active = input.action === 'open' ? active() : null;
        }) };
    return { game: raw as unknown as Game, raw, runtime, state };
}
const scopes: EffectScope[] = [], inputs: DialogInput[] = [], services: DialogService[] = [];
function session(f = fixture()) {
    const dialogs = new DialogService(); services.push(dialogs);
    const tick = ref(0);
    const host: ModuleUiHost = { dialogs, game: () => f.game, tick, immersive: ref(false),
        canOpenPanel: vi.fn(() => true), beforeOpenPanel: vi.fn(), afterClosePanel: vi.fn() };
    const scope = effectScope(); scopes.push(scope);
    const ui = scope.run(() => useNarrativeUi(host))!;
    const input = new DialogInput(); inputs.push(input);
    input.attach({ service: dialogs, contains: () => true, hint: vi.fn() });
    return { ...f, host, tick, dialogs, input, scope, ui };
}
function key(name: string, repeat = false) {
    return { key: name, code: name, repeat, target: null, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() } as unknown as KeyboardEvent;
}
function pointer(action: string, extra: Record<string, unknown> = {}) {
    const button = { getAttribute: () => action, hasAttribute: () => false };
    return { pointerId: 1, button: 0, detail: 1, clientX: 30, clientY: 50,
        target: { closest: () => button }, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn(), ...extra } as unknown as PointerEvent;
}
afterEach(() => { for (const scope of scopes.splice(0)) scope.stop(); for (const input of inputs.splice(0)) input.dispose(); for (const service of services.splice(0)) service.dispose(); vi.restoreAllMocks(); });

describe('EXT-2d shared dialog adapter', () => {
    it('opens through the public nearby bar, uses one host token and only strict module commands', async () => {
        const f = session(), old = f.ui.bar.value!.props, before = rng.getState();
        (old.onOpen as Function)(21); await nextTick(); (old.onOpen as Function)(21);
        expect(f.raw.executeCommand).toHaveBeenCalledOnce();
        expect(JSON.parse(f.raw.executeCommand.mock.calls[0]![1])).toEqual({ module: 'narrative', action: 'open', payload: { v: 2, revision: 0, targetEntityId: 21 } });
        expect(f.ui.bar.value).toBeNull(); expect(f.ui.panel.value).toBeNull(); expect(f.ui.panelOpen.value).toBe(true);
        expect(f.dialogs.current?.kind).toBe('dialogue'); expect(f.dialogs.queueLength).toBe(1);
        const token = f.dialogs.current!.token;
        expect(f.dialogs.answer(token, 'choice:leave')).toBe(false);
        expect(f.dialogs.answer(token, 'choice:read-note')).toBe(true);
        expect(f.dialogs.answer(token, 'choice:read-note')).toBe(false);
        await nextTick(); expect(f.raw.executeCommand).toHaveBeenCalledTimes(2); expect(f.host.afterClosePanel).toHaveBeenCalledOnce();
        expect(rng.getState()).toEqual(before);
    });
    it('rejects unavailable targets, stale revision, changed runtime and disposed callbacks', async () => {
        for (const change of ['revision', 'session', 'runtime', 'dispose'] as const) {
            const f = session(), props = f.ui.bar.value!.props;
            (props.onOpen as Function)(999); expect(f.raw.executeCommand).not.toHaveBeenCalled();
            if (change === 'revision') f.state.revision++;
            if (change === 'session') f.runtime.readModuleView = () => ({ session: {}, state: f.state });
            if (change === 'runtime') f.raw.extensionRuntime = { readModuleView: () => ({ session: {}, state: f.state }) };
            if (change === 'dispose') f.scope.stop();
            (props.onOpen as Function)(21); f.ui.close(); await nextTick();
            expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(f.host.afterClosePanel).not.toHaveBeenCalled();
        }
    });
    it('does not compete with another modal or change the mechanical session on lifecycle cleanup', () => {
        const f = session(); f.dialogs.request({ kind: 'confirm', owner: 'test', text: '', onAnswer: () => true });
        (f.ui.bar.value!.props.onOpen as Function)(21); expect(f.raw.executeCommand).not.toHaveBeenCalled();
        f.state.active = active(); f.ui.refresh(); f.ui.close();
        expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(f.state.active).not.toBeNull();
        f.scope.stop(); expect(f.dialogs.queueLength).toBe(1);
    });
    it('does not steal the shell while another module panel owns its modal context', () => {
        const f = session(); f.host.canOpenInteraction = () => false;
        expect(f.ui.bar.value!.props.blocked).toBe(true);
        (f.ui.bar.value!.props.onOpen as Function)(21);
        expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(f.dialogs.queueLength).toBe(0);
    });
    it('does not recreate a persisted interaction over an interrupted shell transition', () => {
        const f = session(); f.state.active = active(); f.ui.refresh();
        const old = f.dialogs.current!.token;
        f.host.canPresentInteraction = () => false; f.ui.close(); f.dialogs.sync();
        expect(f.dialogs.queueLength).toBe(0); expect(f.ui.panelOpen.value).toBe(false);
        expect(f.state.active).not.toBeNull(); expect(f.raw.executeCommand).not.toHaveBeenCalled();
        f.host.canPresentInteraction = () => true; f.dialogs.sync();
        expect(f.dialogs.current!.token).not.toBe(old); expect(f.dialogs.answer(old, 'close')).toBe(false);
    });
    it('uses pure same-host journal and portrait navigation, never recording a command', () => {
        const f = session(); f.state.active = active(); f.ui.refresh(); const before = rng.getState();
        const initial = f.dialogs.current!.token;
        expect(f.dialogs.answer(initial, 'journal')).toBe(true);
        expect(f.dialogs.current!.content!.props.page).toBe('journal');
        expect(f.dialogs.answer(initial, 'close')).toBe(false);
        f.dialogs.answer(f.dialogs.current!.token, 'back'); f.dialogs.answer(f.dialogs.current!.token, 'portrait');
        expect(f.dialogs.current!.content!.props.page).toBe('portrait'); expect(f.dialogs.queueLength).toBe(1);
        expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(before);
    });
    it('DialogInput consumes Escape through release even after mechanical close', async () => {
        const f = session(); f.state.active = active(); f.ui.refresh();
        const e = key('Escape'); f.input.keydown(e); await nextTick();
        expect(e.preventDefault).toHaveBeenCalled(); expect(f.raw.executeCommand).toHaveBeenCalledOnce();
        const repeated = key('Escape', true); f.input.keydown(repeated); expect(repeated.preventDefault).toHaveBeenCalled();
        f.input.keyup(key('Escape')); const fresh = key('Escape'); f.input.keydown(fresh);
        expect(fresh.preventDefault).not.toHaveBeenCalled();
    });
    it('quarantines movement held across opening and closing, with no adapter release barrier', async () => {
        const f = session(); f.input.keydown(key('ArrowRight'));
        (f.ui.bar.value!.props.onOpen as Function)(21); await nextTick();
        const held = key('ArrowRight', true); f.input.keydown(held); expect(held.preventDefault).toHaveBeenCalled();
        f.dialogs.answer(f.dialogs.current!.token, 'close'); await nextTick();
        const later = key('ArrowRight', true); f.input.keydown(later); expect(later.preventDefault).toHaveBeenCalled();
        f.input.keyup(key('ArrowRight')); const fresh = key('ArrowRight'); f.input.keydown(fresh); expect(fresh.preventDefault).not.toHaveBeenCalled();
    });
    it('does not pass a close release, repeated click or drag gesture into the next context', async () => {
        const f = session(); f.state.active = active(); f.ui.refresh();
        f.input.pointerdown(pointer('close')); f.input.pointerup(pointer('close', { clientX: 80 }));
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
        f.input.pointerdown(pointer('close')); f.input.pointerup(pointer('close')); await nextTick();
        expect(f.raw.executeCommand).toHaveBeenCalledOnce();
        const click = pointer('close', { detail: 2 }); f.input.click(click); expect(click.preventDefault).toHaveBeenCalled();
        f.state.active = active(2); f.state.revision++; f.ui.refresh();
        f.input.pointerdown(pointer('close')); f.input.pointerup(pointer('close'));
        expect(f.raw.executeCommand).toHaveBeenCalledOnce();
    });
    it('does not reveal live nearby names behind a previous presentation frame', () => {
        const f = session();
        const timeline = vi.spyOn(dialogPresentation, 'presentationTimeline').mockReturnValue({ busy: true } as any);
        f.tick.value++; f.ui.refresh(); expect(f.ui.bar.value).toBeNull();
        timeline.mockReturnValue(undefined); f.tick.value++; f.ui.refresh();
        expect(f.ui.bar.value).not.toBeNull();
    });
    it('keeps replay projection read-only and no modal wait survives a seek', async () => {
        const f = session(); f.state.active = active(); f.ui.refresh(); expect(f.dialogs.current).toBeDefined();
        f.raw.replayRecording = {}; f.ui.refresh();
        expect(f.dialogs.current).toBeUndefined(); expect(f.ui.panelOpen.value).toBe(false);
        expect((f.ui.bar.value!.props.model as { readOnly: boolean }).readOnly).toBe(true);
        const e = key('Escape'); f.input.keydown(e); expect(e.preventDefault).not.toHaveBeenCalled();
        const old = readNarrativeUiView(f.game)!; expect(buildNarrativeUiCommand(f.game, old, 'close')).toBeNull();
        f.state.active = { ...active(), nodeId: 'next' }; f.state.revision++; f.ui.refresh();
        expect(f.dialogs.queueLength).toBe(0); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('keeps the mechanical session on rejected execution and exposes retry feedback through a fresh token', async () => {
        const f = session(); f.state.active = active(); f.ui.refresh();
        f.raw.executeCommand.mockImplementation(() => {});
        const old = f.dialogs.current!.token;
        expect(f.dialogs.answer(old, 'choice:read-note')).toBe(false);
        await nextTick();
        expect(f.state.active).not.toBeNull();
        expect(f.dialogs.current!.token).not.toBe(old);
        expect(f.dialogs.current!.content!.props.error).toBe('ext.narrative.ui.command_rejected');
        expect(f.dialogs.answer(old, 'close')).toBe(false);
    });
    it('never refreshes a stale node capability into a later node or session', () => {
        const f = fixture(); f.state.active = active(); const old = readNarrativeUiView(f.game)!;
        f.state.active = { ...active(), nodeId: 'next' }; expect(buildNarrativeUiCommand(f.game, old, 'choose', 'read-note')).toBeNull();
        f.state.active = active(2); expect(buildNarrativeUiCommand(f.game, old, 'close')).toBeNull();
        expect(Object.keys(old).sort()).toEqual(['active','journal','nearby','readOnly','revision','session']);
    });
});
