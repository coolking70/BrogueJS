import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import type { Game } from '../../../../engine/Core/Game';
import type { ModuleUiHost } from '../../../ui/types';
import type { ReadonlyJson } from '../../../types';
import { DialogService } from '../../../../ui/dialogService';
import { DialogInput } from '../../../../ui/dialogInput';
import { rng } from '../../../../engine/Random';
import type { DisplayFrame } from '../../../../ui/displayProjection';
import { combatAttackDefinitions, initialProductionCombatState } from '../production';
import { loadCombatDefinitionPack } from '../definitions';
import { projectCombatView } from '../view';
import { useCombatUi } from '../ui/useCombatUi';
import { buildCombatUiCommand, combatDirections, readCombatUiResources, readCombatUiView } from '../ui/view';

const resources = (stamina = 20) => ({ stamina, capacity: 24, regenDelayRemaining: 30, dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
const scopes: EffectScope[] = [], services: DialogService[] = [], inputs: DialogInput[] = [];
function session() {
    const state = { schema: 1, revision: 0, resources: resources(), actions: [
        { id: 'fixture.slash', nameKey: 'ext.combat.attack.slash.name', canUse: true, cost: 4 },
        { id: 'dodge', nameKey: 'ext.combat.dodge.name', canUse: true, cost: 6 },
    ] };
    const token = {}, runtime = { readModuleView: vi.fn(() => ({ session: token, state, canManageCharacter: true })) };
    const raw = { extensionRuntime: runtime, replayRecording: null as object | null, isGameOver: false,
        executeCommand: vi.fn(() => { state.revision++; }) };
    const game = raw as unknown as Game, dialogs = new DialogService(); services.push(dialogs);
    const host: ModuleUiHost = { game: () => game, tick: ref(0), immersive: ref(false), dialogs,
        canOpenPanel: vi.fn(() => true), beforeOpenPanel: vi.fn(), afterClosePanel: vi.fn(),
        isPresentationBusy: vi.fn(() => false) };
    const scope = effectScope(); scopes.push(scope);
    const ui = scope.run(() => useCombatUi(host))!;
    const input = new DialogInput(); inputs.push(input); input.attach({ service: dialogs, contains: () => true, hint: vi.fn() });
    const open = (event?: MouseEvent) => (ui.bar.value!.props.onAttack as (id: string, event?: MouseEvent) => void)('dodge', event);
    return { state, runtime, raw, game, dialogs, host, scope, ui, input, open };
}
const key = (name: string, repeat = false) => ({ key: name, code: name, repeat, target: null,
    preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }) as unknown as KeyboardEvent;
const pointer = (action: string, extra: Record<string, unknown> = {}) => ({ pointerId: 1, button: 0, detail: 1,
    clientX: 30, clientY: 50, target: { closest: () => ({ getAttribute: () => action, hasAttribute: () => false }) },
    preventDefault: vi.fn(), stopImmediatePropagation: vi.fn(), ...extra }) as unknown as PointerEvent;
afterEach(() => {
    scopes.splice(0).forEach(scope => scope.stop()); inputs.splice(0).forEach(input => input.dispose());
    services.splice(0).forEach(service => service.dispose()); vi.restoreAllMocks();
});

describe('EXT-3c public stamina and dodge controls', () => {
    it('projects the same player resource ledger and shared costs without mutating state or RNG', () => {
        const definitions = combatAttackDefinitions(loadCombatDefinitionPack()), state = initialProductionCombatState();
        const policy = definitions.resourcePolicies[0]!;
        const observe = () => projectCombatView(state as unknown as ReadonlyJson, definitions, 1, 7) as unknown as {
            schema: number; resources: ReturnType<typeof resources>; actions: { id: string; cost: number; canUse: boolean; unavailableKey?: string }[];
        };
        const before = { state: JSON.stringify(state), rng: rng.getState() }, initial = observe();
        expect(initial.schema).toBe(1); expect(initial.resources).toEqual({ ...resources(policy.initialStamina), capacity: policy.staminaCapacity, regenDelayRemaining: 0 });
        expect(initial.actions[initial.actions.length - 1]).toEqual({ id: 'dodge', nameKey: 'ext.combat.dodge.name', cost: definitions.dodge.cost, canUse: true });
        expect({ state: JSON.stringify(state), rng: rng.getState() }).toEqual(before);
        state.actors.push({ actorId: 7, profileId: definitions.playerProfileId, stamina: definitions.dodge.cost - 1,
            regenRemainder: 3, regenDelayRemaining: 21, dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
        const low = observe(); expect(low.resources.stamina).toBe(definitions.dodge.cost - 1);
        expect(low.resources.regenDelayRemaining).toBe(21);
        expect(low.actions[low.actions.length - 1]).toMatchObject({ canUse: false, unavailableKey: 'ext.combat.ui.insufficient_stamina' });
        state.actors[0]!.stamina = policy.staminaCapacity; state.actors[0]!.dodgeRemainingTicks = 10; state.actors[0]!.dodgeRecoveryRemainingTicks = 20;
        const recovering = observe();
        expect(recovering.resources.dodgeRemainingTicks).toBe(10);
        expect(recovering.actions.every(action => !action.canUse && action.unavailableKey === 'ext.combat.ui.busy')).toBe(true);
        state.actors[0]!.dodgeRecoveryRemainingTicks = 0; state.actors[0]!.dodgeRemainingTicks = 0;
        state.scheduler.bundles.push({ actionId: 1, depth: 1, decisionOwnerId: 7, timeChargeOwnerId: 7, elapsedActionTicks: 0, subactions: [] });
        expect(observe().actions.every(action => !action.canUse)).toBe(true);
        expect(projectCombatView()).toEqual({ schema: 1, telegraphs: [], resources: null, actions: [] });
    });
    it('validates and detaches finite resource DTOs rather than displaying malformed values', () => {
        const source = resources(), copy = readCombatUiResources(source)!;
        expect(copy).toEqual(source); expect(Object.isFrozen(copy)).toBe(true);
        source.stamina = 0; expect(copy.stamina).toBe(20);
        for (const bad of [null, [], {}, { ...resources(), stamina: Infinity }, { ...resources(), capacity: 0 },
            { ...resources(), stamina: 25 }, { ...resources(), dodgeRemainingTicks: -1 }, { ...resources(), regenDelayRemaining: .5 }])
            expect(readCombatUiResources(bad)).toBeNull();
    });
    it.each(combatDirections)('submits $facing only after direction and confirmation through the original command boundary', async direction => {
        const f = session(), before = { resources: { ...f.state.resources }, rng: rng.getState() }; f.open();
        expect(f.dialogs.current!.content!.props.attack).toMatchObject({ id: 'dodge', cost: 6 });
        expect(f.dialogs.answer(f.dialogs.current!.token, `choice:${direction.facing}`)).toBe(true);
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
        expect({ resources: f.state.resources, rng: rng.getState() }).toEqual(before);
        expect(f.dialogs.answer(f.dialogs.current!.token, 'choice:confirm')).toBe(true); await nextTick();
        expect(f.raw.executeCommand).toHaveBeenCalledExactlyOnceWith('ext:command', JSON.stringify({ module: 'combat', action: 'dodge', payload: { facing: direction.facing } }));
        expect(f.dialogs.queueLength).toBe(0); expect(f.ui.panelOpen.value).toBe(false);
    });
    it('Back and Cancel remain display-only and repeated directions never spend or execute', () => {
        const f = session(), before = { state: JSON.stringify(f.state), rng: rng.getState() };
        for (const direction of combatDirections) {
            f.open(); f.dialogs.answer(f.dialogs.current!.token, `choice:${direction.facing}`);
            f.dialogs.answer(f.dialogs.current!.token, 'back');
            expect(f.dialogs.current!.content!.props.facing).toBeNull();
            f.dialogs.answer(f.dialogs.current!.token, 'close');
        }
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
        expect({ state: JSON.stringify(f.state), rng: rng.getState() }).toEqual(before);
    });
    it('blocks insufficient stamina, stale capabilities, replay, terminal and retired dodge confirmations', () => {
        for (const change of ['revision', 'session', 'disabled', 'replay', 'terminal', 'retired'] as const) {
            const f = session(); f.open(); f.dialogs.answer(f.dialogs.current!.token, 'choice:n');
            const old = f.dialogs.current!.token;
            if (change === 'revision') f.state.revision++;
            if (change === 'session') f.runtime.readModuleView.mockImplementation(() => ({ session: {}, state: f.state, canManageCharacter: true }));
            if (change === 'disabled') { f.state.resources.stamina = 0; f.state.actions[1]!.canUse = false; }
            if (change === 'replay') f.raw.replayRecording = {};
            if (change === 'terminal') f.raw.isGameOver = true;
            if (change === 'retired') f.scope.stop();
            f.dialogs.answer(old, 'choice:confirm'); expect(f.raw.executeCommand).not.toHaveBeenCalled();
        }
        const f = session(); f.state.actions[1]!.canUse = false; f.ui.refresh(); f.open();
        expect(f.dialogs.current).toBeUndefined(); expect(f.ui.commands.value.find(action => action.id === 'combat:dodge')!.disabled).toBe(true);
        expect(buildCombatUiCommand(f.game, readCombatUiView(f.game)!, 'dodge', 'n')).toBeNull();
    });
    it('honors competing dialogs, D3 busy, shell transitions and reset without reopening dodge', () => {
        const f = session(); f.dialogs.request({ kind: 'confirm', owner: 'other', text: '', onAnswer: () => true }); f.open();
        expect(f.dialogs.current!.owner).toBe('other'); expect(f.dialogs.queueLength).toBe(1);
        f.dialogs.reset(); f.host.canOpenInteraction = () => false; f.open(); expect(f.ui.panelOpen.value).toBe(false);
        f.host.canOpenInteraction = () => true; f.open(); const old = f.dialogs.current!.token;
        f.host.isPresentationBusy = () => true; f.ui.refresh();
        expect(f.ui.panelOpen.value).toBe(false); expect(f.dialogs.answer(old, 'choice:n')).toBe(false);
        f.open(); expect(f.ui.panelOpen.value).toBe(false);
        f.host.isPresentationBusy = () => false; f.open(); f.host.canPresentInteraction = () => false; f.ui.refresh();
        expect(f.ui.panelOpen.value).toBe(false); f.host.canPresentInteraction = () => true;
        f.open(); f.dialogs.reset(); f.dialogs.sync(); expect(f.ui.panelOpen.value).toBe(false);
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('preserves held-key and adjacent-pointer release barriers across dodge direction and cancel', () => {
        const f = session(); f.input.keydown(key('ArrowRight')); f.open();
        f.input.pointerdown(pointer('choice:e')); f.input.pointerup(pointer('choice:e'));
        expect(f.dialogs.current!.content!.props.facing).toBe('e');
        f.input.pointerdown(pointer('choice:confirm')); f.input.pointerup(pointer('choice:confirm'));
        f.input.click(pointer('choice:confirm', { detail: 2 })); expect(f.raw.executeCommand).not.toHaveBeenCalled();
        f.input.keydown(key('Escape')); f.input.keyup(key('Escape'));
        expect(f.dialogs.current!.content!.props.facing).toBeNull();
        f.input.keydown(key('Escape')); f.input.keyup(key('Escape'));
        const tail = key('ArrowRight', true); f.input.keydown(tail); expect(tail.preventDefault).toHaveBeenCalled();
        f.input.keyup(key('ArrowRight')); const fresh = key('ArrowRight'); f.input.keydown(fresh); expect(fresh.preventDefault).not.toHaveBeenCalled();
        f.open({ detail: 2 } as MouseEvent); expect(f.ui.panelOpen.value).toBe(false);
    });
    it('renders only captured stamina during ACK without querying live state or leaking missing historical values', () => {
        const f = session();
        let captured = { telegraphs: [], rows: [], hoverCell: null, moduleViews: { combat: { resources: resources(11) } } };
        f.host.readDisplayFrame = () => captured as unknown as DisplayFrame;
        f.host.isPresentationBusy = () => true;
        const reads = f.runtime.readModuleView.mock.calls.length; f.state.resources.stamina = 3; f.ui.refresh();
        expect(f.ui.hud.value!.props.resources).toEqual(resources(11)); expect(f.ui.hud.value!.props.entries).toEqual([]);
        expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads);
        f.host.readDisplayFrame = () => ({ ...captured, moduleViews: {} }) as unknown as DisplayFrame; f.ui.refresh();
        expect(f.ui.hud.value).toBeNull(); expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads);
        captured = { ...captured, moduleViews: { combat: { resources: resources(3) } } };
        f.host.readDisplayFrame = () => captured as unknown as DisplayFrame; f.host.isPresentationBusy = () => false; f.ui.refresh();
        expect(f.ui.hud.value!.props.resources).toEqual(resources(3));
    });
});
