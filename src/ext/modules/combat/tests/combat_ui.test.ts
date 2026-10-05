import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import type { Game } from '../../../../engine/Core/Game';
import type { ModuleUiHost } from '../../../ui/types';
import { DialogService } from '../../../../ui/dialogService';
import { DialogInput } from '../../../../ui/dialogInput';
import { useCombatUi } from '../ui/useCombatUi';
import { buildCombatUiCommand, combatDirections, readCombatUiView } from '../ui/view';
import { rng } from '../../../../engine/Random';

function fixture() {
    const state = { schema: 1, revision: 0, actions: [
        { id: 'fixture.slash', nameKey: 'ext.combat.attack.slash.name', canUse: true },
        { id: 'fixture.stomp', nameKey: 'ext.combat.attack.stomp.name', canUse: true },
        { id: 'fixture.double-thrust', nameKey: 'ext.combat.attack.double-thrust.name', canUse: true },
    ] };
    const token = {}, runtime = { readModuleView: vi.fn(() => ({ session: token, state, canManageCharacter: true })) };
    const raw = { extensionRuntime: runtime, replayRecording: null as object | null, isGameOver: false,
        executeCommand: vi.fn(() => { state.revision++; }) };
    return { game: raw as unknown as Game, raw, state, runtime };
}
const scopes: EffectScope[] = [], inputs: DialogInput[] = [], services: DialogService[] = [];
function session() {
    const f = fixture(), dialogs = new DialogService(); services.push(dialogs);
    const host: ModuleUiHost = { game: () => f.game, tick: ref(0), immersive: ref(false), dialogs,
        canOpenPanel: vi.fn(() => true), beforeOpenPanel: vi.fn(), afterClosePanel: vi.fn(),
        isPresentationBusy: vi.fn(() => false) };
    const scope = effectScope(); scopes.push(scope);
    const ui = scope.run(() => useCombatUi(host))!;
    const input = new DialogInput(); inputs.push(input); input.attach({ service: dialogs, contains: () => true, hint: vi.fn() });
    const open = (id = 'fixture.slash', event?: MouseEvent) => (ui.bar.value!.props.onAttack as Function)(id, event);
    return { ...f, host, scope, ui, input, dialogs, open };
}
const key = (name: string, repeat = false) => ({ key: name, code: name, repeat, target: null,
    preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }) as unknown as KeyboardEvent;
const pointer = (action: string, extra: Record<string, unknown> = {}) => ({ pointerId: 1, button: 0, detail: 1,
    clientX: 30, clientY: 50, target: { closest: () => ({ getAttribute: () => action, hasAttribute: () => false }) },
    preventDefault: vi.fn(), stopImmediatePropagation: vi.fn(), ...extra }) as unknown as PointerEvent;
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); inputs.splice(0).forEach(input => input.dispose()); services.splice(0).forEach(service => service.dispose()); vi.restoreAllMocks(); });

describe('EXT-3b shared combat direction/confirmation UI', () => {
    it.each(['fixture.slash', 'fixture.stomp', 'fixture.double-thrust'])('%s submits only after choosing direction and explicit confirmation', async attackId => {
        const f = session(), before = rng.getState(); f.open(attackId);
        expect(f.dialogs.current!.owner).toBe('combat'); expect(f.dialogs.queueLength).toBe(1);
        const directionToken = f.dialogs.current!.token;
        expect(f.dialogs.answer(directionToken, 'choice:e')).toBe(true);
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
        expect(f.dialogs.current!.content!.props.facing).toBe('e');
        expect(f.dialogs.answer(directionToken, 'choice:e')).toBe(false);
        expect(f.dialogs.answer(f.dialogs.current!.token, 'choice:confirm')).toBe(true); await nextTick();
        expect(f.raw.executeCommand).toHaveBeenCalledExactlyOnceWith('ext:command', JSON.stringify({ module: 'combat', action: 'attack', payload: { attackId, facing: 'e' } }));
        expect(f.dialogs.queueLength).toBe(0); expect(f.ui.panelOpen.value).toBe(false);
        expect(rng.getState()).toEqual(before);
    });
    it('direction selection, back, cancel and repeated opening are display-only', () => {
        const f = session(), before = rng.getState();
        for (const direction of combatDirections) {
            f.open(); f.dialogs.answer(f.dialogs.current!.token, `choice:${direction.facing}`);
            f.dialogs.answer(f.dialogs.current!.token, 'back');
            expect(f.dialogs.current!.content!.props.facing).toBeNull();
            f.dialogs.answer(f.dialogs.current!.token, 'close');
        }
        expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(f.state.revision).toBe(0); expect(rng.getState()).toEqual(before);
    });
    it('rejects stale session/revision, unusable attacks, replay, terminal and retired callbacks', () => {
        for (const change of ['revision', 'session', 'disabled', 'replay', 'terminal', 'retired'] as const) {
            const f = session(); f.open(); f.dialogs.answer(f.dialogs.current!.token, 'choice:n');
            const old = f.dialogs.current!.token;
            if (change === 'revision') f.state.revision++;
            if (change === 'session') f.runtime.readModuleView.mockImplementation(() => ({ session: {}, state: f.state, canManageCharacter: true }));
            if (change === 'disabled') f.state.actions[0]!.canUse = false;
            if (change === 'replay') f.raw.replayRecording = {};
            if (change === 'terminal') f.raw.isGameOver = true;
            if (change === 'retired') f.scope.stop();
            f.dialogs.answer(old, 'choice:confirm');
            expect(f.raw.executeCommand).not.toHaveBeenCalled();
        }
    });
    it('unknown attacks and invalid directions never serialize and another modal keeps priority', () => {
        const f = session(), view = readCombatUiView(f.game)!;
        expect(buildCombatUiCommand(f.game, view, 'missing', 'n')).toBeNull();
        expect(buildCombatUiCommand(f.game, view, 'fixture.slash', 'bad' as never)).toBeNull();
        f.dialogs.request({ kind: 'confirm', owner: 'other', text: '', onAnswer: () => true }); f.open();
        expect(f.dialogs.queueLength).toBe(1); expect(f.dialogs.current!.owner).toBe('other');
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('historical presentation never reads live combat or keeps a targeting modal', () => {
        const f = session(); f.open();
        const reads = f.runtime.readModuleView.mock.calls.length;
        f.host.isPresentationBusy = () => true; f.ui.refresh();
        expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads);
        expect(f.dialogs.queueLength).toBe(0); expect(f.ui.panelOpen.value).toBe(false);
        f.open(); expect(f.dialogs.queueLength).toBe(0); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('DialogInput quarantines held movement through opening, back/cancel and release', () => {
        const f = session(); f.input.keydown(key('ArrowRight')); f.open();
        const held = key('ArrowRight', true); f.input.keydown(held); expect(held.preventDefault).toHaveBeenCalled();
        f.dialogs.answer(f.dialogs.current!.token, 'choice:n');
        f.input.keydown(key('Escape')); f.input.keyup(key('Escape'));
        expect(f.dialogs.current!.content!.props.facing).toBeNull();
        f.input.keydown(key('Escape')); f.input.keyup(key('Escape'));
        const tail = key('ArrowRight', true); f.input.keydown(tail); expect(tail.preventDefault).toHaveBeenCalled();
        f.input.keyup(key('ArrowRight')); const fresh = key('ArrowRight'); f.input.keydown(fresh);
        expect(fresh.preventDefault).not.toHaveBeenCalled(); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('host reset and shell transitions retire targeting without reopening or sending commands', () => {
        const f = session(); f.open(); const old = f.dialogs.current!.token;
        f.dialogs.reset(); f.dialogs.sync();
        expect(f.ui.panelOpen.value).toBe(false); expect(f.dialogs.queueLength).toBe(0);
        expect(f.dialogs.answer(old, 'choice:e')).toBe(false);
        f.open(); f.host.canPresentInteraction = () => false; f.ui.refresh(); f.dialogs.sync();
        expect(f.ui.panelOpen.value).toBe(false); expect(f.dialogs.queueLength).toBe(0);
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('double-click and adjacent pointer cluster cannot release the new confirmation', () => {
        const f = session(); f.open();
        f.input.pointerdown(pointer('choice:e')); f.input.pointerup(pointer('choice:e'));
        expect(f.dialogs.current!.content!.props.facing).toBe('e');
        f.input.pointerdown(pointer('choice:confirm')); f.input.pointerup(pointer('choice:confirm'));
        f.input.click(pointer('choice:confirm', { detail: 2 }));
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
        f.ui.close(); f.open('fixture.slash', { detail: 2 } as MouseEvent);
        expect(f.ui.panelOpen.value).toBe(false);
    });
});
