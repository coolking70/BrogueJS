import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, effectScope, nextTick, ref, type Component, type EffectScope } from 'vue';
import { renderToString } from '@vue/server-renderer';
import i18next from 'i18next';
import type { Game } from '../../../../engine/Core/Game';
import type { ModuleUiHost } from '../../../ui/types';
import type { DisplayFrame } from '../../../../ui/displayProjection';
import { DialogService } from '../../../../ui/dialogService';
import { DialogInput } from '../../../../ui/dialogInput';
import { rng } from '../../../../engine/Random';
import { useCombatUi } from '../ui/useCombatUi';
import { buildCombatRestCommand, readCombatUiBonfires, readCombatUiRest, readCombatUiView, type CombatUiRest } from '../ui/view';
import CombatAttackBar from '../ui/CombatAttackBar.vue';
import CombatBonfireDialog from '../ui/CombatBonfireDialog.vue';
import CombatTelegraphHud from '../ui/CombatTelegraphHud.vue';
import locale from '../locales/zh_CN.json';

const bonfire = (entityId = 31) => ({ entityId, nameKey: 'ext.combat.bonfire.name', descriptionKey: 'ext.combat.bonfire.description',
    restTicks: 500, canUse: true, unavailableKey: undefined as string | undefined });
const scopes: EffectScope[] = [], services: DialogService[] = [], inputs: DialogInput[] = [];
function session(headless = false) {
    const state = { schema: 1, revision: 0, resources: null, actions: [
        { id: 'parry', nameKey: 'ext.combat.parry.name', canUse: true },
    ], bonfires: [bonfire(), bonfire(32)], rest: null as CombatUiRest | null };
    const token = {}, runtime = { readModuleView: vi.fn(() => ({ session: token, state, canManageCharacter: true })) };
    const raw = { extensionRuntime: runtime, replayRecording: null as object | null, isGameOver: false,
        pendingCommandConfirmation: null as object | null,
        executeCommand: vi.fn(() => { state.revision++; state.rest = { bonfireId: 31, remainingTicks: 500, status: 'resting' }; }) };
    const game = raw as unknown as Game; let currentGame = game;
    const dialogs = new DialogService(); services.push(dialogs);
    const host: ModuleUiHost = { game: () => currentGame, tick: ref(0), immersive: ref(false), ...(headless ? {} : { dialogs }),
        canOpenPanel: vi.fn(() => true), beforeOpenPanel: vi.fn(), afterClosePanel: vi.fn(), isPresentationBusy: vi.fn(() => false) };
    const scope = effectScope(); scopes.push(scope); const ui = scope.run(() => useCombatUi(host))!;
    const input = new DialogInput(); inputs.push(input); input.attach({ service: dialogs, contains: () => true, hint: vi.fn() });
    const open = (id = 31, event?: MouseEvent) => (ui.bar.value!.props.onBonfire as (id: number, event?: MouseEvent) => void)(id, event);
    return { state, runtime, raw, game, dialogs, host, scope, ui, input, open,
        replaceGame: () => { currentGame = {} as Game; } };
}
async function render(component: Component, props: Record<string, unknown>) {
    await i18next.init({ lng: 'zh_CN', resources: { zh_CN: { translation: locale } } });
    const app = createSSRApp(component, props); app.config.globalProperties.$t = i18next.t.bind(i18next);
    return renderToString(app);
}
const key = (name: string, repeat = false) => ({ key: name, code: name, repeat, target: null,
    preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }) as unknown as KeyboardEvent;
const pointer = (action: string, extra: Record<string, unknown> = {}) => ({ pointerId: 1, button: 0, detail: 1,
    clientX: 30, clientY: 50, target: { closest: () => ({ getAttribute: () => action, hasAttribute: () => false }) },
    preventDefault: vi.fn(), stopImmediatePropagation: vi.fn(), ...extra }) as unknown as PointerEvent;
afterEach(() => {
    scopes.splice(0).forEach(scope => scope.stop()); services.splice(0).forEach(service => service.dispose());
    inputs.splice(0).forEach(input => input.dispose()); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('EXT-3e bonfire explanation and public rest UI', () => {
    it('renders each nearby world identity once in the existing toolbar with name, duration and visible disabled reason', async () => {
        const f = session(); f.state.bonfires[1]!.canUse = false;
        f.state.bonfires[1]!.unavailableKey = 'ext.combat.ui.bonfire_threatened'; f.ui.refresh();
        const html = await render(CombatAttackBar, f.ui.bar.value!.props);
        expect([...html.matchAll(/data-testid="combat-attack-bar"/g)]).toHaveLength(1);
        expect([...html.matchAll(/data-combat-bonfire="(\d+)"/g)].map(match => match[1])).toEqual(['31', '32']);
        expect(html).toContain('篝火'); expect(html).toContain('休息 500 时间刻');
        expect(html).toMatch(/data-combat-bonfire="32"[^>]*disabled/);
        expect(html).toMatch(/<small[^>]*>附近有敌情，不能休息<\/small>/);
        expect(html).not.toContain('ext.combat.'); expect(f.ui.commands.value).toEqual([]);
        f.open(32); expect(f.dialogs.current).toBeUndefined();
    });
    it('keeps the same bar when only nearby bonfires are present and uses read-only controls for replay', async () => {
        const f = session(); f.state.actions = []; f.raw.replayRecording = {}; f.ui.refresh();
        const html = await render(CombatAttackBar, f.ui.bar.value!.props);
        expect(html).toMatch(/data-combat-bonfire="31"[^>]*disabled/); expect(html).toContain('回放或当前状态只供查看');
        expect(f.ui.commands.value).toEqual([]); f.open(); expect(f.dialogs.current).toBeUndefined();
    });
    it('explains duration, interruption and recovery in localized read-only dialog content', async () => {
        const f = session(); f.open(); const content = f.dialogs.current!;
        expect(content.kind).toBe('dialogue'); expect(content.owner).toBe('combat'); expect(content.defaultAction).toBe('close');
        expect(Object.keys(content.content!.props)).toEqual(['bonfire']);
        const html = await render(CombatBonfireDialog, content.content!.props);
        for (const text of ['休息 500 时间刻', '敌人与环境照常行动', '中途打断不会获得篝火恢复', '不清除毒、饥饿等状态',
            '不重置成长资源或刷新敌人', '不能复活', '开始休息']) expect(html).toContain(text);
        expect([...html.matchAll(/data-dialog-action="choice:confirm"/g)]).toHaveLength(1);
        expect(html).not.toContain('ext.combat.'); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('opening, repeated clicks, cancel and reopening change neither mechanical state nor either RNG', () => {
        const f = session(), before = { state: JSON.stringify(f.state), random: rng.getState() };
        for (let i = 0; i < 4; i++) {
            f.open(); f.open(32); expect(f.dialogs.queueLength).toBe(1);
            expect(f.dialogs.current!.content!.props.bonfire).toEqual(bonfire());
            f.dialogs.answer(f.dialogs.current!.token, 'close'); expect(f.ui.panelOpen.value).toBe(false);
        }
        f.open(31, { detail: 2 } as MouseEvent); expect(f.dialogs.current).toBeUndefined();
        expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect({ state: JSON.stringify(f.state), random: rng.getState() }).toEqual(before);
    });
    it('issues exactly one world-identity rest command and never records UI explanation choices', async () => {
        const f = session(), random = rng.getState(); f.open(32); const token = f.dialogs.current!.token;
        expect(f.dialogs.answer(token, 'choice:confirm')).toBe(true);
        expect(f.dialogs.answer(token, 'choice:confirm')).toBe(false); f.open(); await nextTick();
        expect(f.raw.executeCommand).toHaveBeenCalledExactlyOnceWith('ext:command', JSON.stringify({ module: 'combat', action: 'rest', payload: { bonfireId: 32 } }));
        expect(f.ui.panelOpen.value).toBe(false); expect(f.dialogs.queueLength).toBe(0); expect(rng.getState()).toEqual(random);
    });
    it('leaves the canonical pending risk decision with Game without automatic acceptance', async () => {
        const f = session(); f.raw.executeCommand.mockImplementation(() => { f.raw.pendingCommandConfirmation = { kind: 'rest-risk' }; });
        f.open(); f.dialogs.answer(f.dialogs.current!.token, 'choice:confirm'); await nextTick();
        expect(f.raw.executeCommand).toHaveBeenCalledTimes(1); expect(f.state.revision).toBe(0); expect(f.state.rest).toBeNull();
        expect(f.raw.pendingCommandConfirmation).toEqual({ kind: 'rest-risk' }); expect(f.ui.bar.value!.props.error).toBeNull();
        expect(f.dialogs.current).toBeUndefined();
    });
    it('does not read future combat state when executing rest creates a historical presentation', async () => {
        const f = session(); let readsAtCommit = -1;
        f.raw.executeCommand.mockImplementation(() => {
            readsAtCommit = f.runtime.readModuleView.mock.calls.length;
            f.host.isPresentationBusy = () => true;
        });
        f.open(); f.dialogs.answer(f.dialogs.current!.token, 'choice:confirm'); await nextTick();
        expect(readsAtCommit).toBeGreaterThan(0); expect(f.runtime.readModuleView).toHaveBeenCalledTimes(readsAtCommit);
        expect(f.raw.executeCommand).toHaveBeenCalledTimes(1);
    });
    it.each(['revision', 'session', 'disabled', 'removed', 'replay', 'terminal', 'host', 'retired'] as const)(
        'rejects %s changed after opening without issuing any command', change => {
            const f = session(); f.open(); const token = f.dialogs.current!.token;
            if (change === 'revision') f.state.revision++;
            if (change === 'session') f.runtime.readModuleView.mockImplementation(() => ({ session: {}, state: f.state, canManageCharacter: true }));
            if (change === 'disabled') f.state.bonfires[0]!.canUse = false;
            if (change === 'removed') f.state.bonfires = [bonfire(32)];
            if (change === 'replay') f.raw.replayRecording = {};
            if (change === 'terminal') f.raw.isGameOver = true;
            if (change === 'host') f.replaceGame();
            if (change === 'retired') f.scope.stop();
            f.dialogs.answer(token, 'choice:confirm'); expect(f.raw.executeCommand).not.toHaveBeenCalled();
        });
    it('validates both expected and current nearby identity and does not mutate projection or RNG', () => {
        const f = session(), view = readCombatUiView(f.game)!, before = { state: JSON.stringify(f.state), random: rng.getState() };
        expect(buildCombatRestCommand(f.game, view, 31)).toBe(JSON.stringify({ module: 'combat', action: 'rest', payload: { bonfireId: 31 } }));
        for (const invalid of [0, -1, 1.5, Infinity, 90, 'combat.bonfire' as unknown as number]) expect(buildCombatRestCommand(f.game, view, invalid)).toBeNull();
        expect(buildCombatRestCommand(f.game, { ...view, bonfires: [] }, 31)).toBeNull();
        expect(buildCombatRestCommand(f.game, { ...view, readOnly: true }, 31)).toBeNull();
        expect({ state: JSON.stringify(f.state), random: rng.getState() }).toEqual(before); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('rejects modal, interaction and presentation competition and remains harmless without DialogHost', () => {
        const f = session(); f.dialogs.request({ kind: 'confirm', owner: 'other', text: '', onAnswer: () => true }); f.open();
        expect(f.dialogs.queueLength).toBe(1); expect(f.dialogs.current!.owner).toBe('other'); f.dialogs.reset();
        f.host.canOpenInteraction = () => false; f.open(); expect(f.dialogs.current).toBeUndefined();
        f.host.canOpenInteraction = () => true; f.host.isPresentationBusy = () => true; f.open(); expect(f.dialogs.current).toBeUndefined();
        const headless = session(true), before = JSON.stringify(headless.state); headless.open(); headless.ui.refresh(); headless.ui.close();
        expect(headless.dialogs.current).toBeUndefined(); expect(headless.raw.executeCommand).not.toHaveBeenCalled();
        expect(JSON.stringify(headless.state)).toBe(before); expect(headless.ui.bar.value!.props.blocked).toBe(true);
    });
    it('reset, shell interruption and host changes dismiss explanation without reopening it', () => {
        const f = session(); f.open(); const token = f.dialogs.current!.token; f.dialogs.reset(); f.dialogs.sync();
        expect(f.dialogs.answer(token, 'choice:confirm')).toBe(false); expect(f.ui.panelOpen.value).toBe(false);
        f.open(); f.host.canPresentInteraction = () => false; f.ui.refresh(); expect(f.dialogs.current).toBeUndefined();
        f.host.canPresentInteraction = () => true; f.open(); f.replaceGame(); f.ui.refresh(); f.dialogs.sync();
        expect(f.dialogs.current).toBeUndefined(); expect(f.ui.panelOpen.value).toBe(false); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('window blur cancels only the explanation, and UI cleanup never cancels a started mechanical rest', async () => {
        const browser = new EventTarget(); vi.stubGlobal('window', browser);
        const f = session(); f.open(); const token = f.dialogs.current!.token;
        browser.dispatchEvent(new Event('blur')); expect(f.ui.panelOpen.value).toBe(false);
        expect(f.dialogs.answer(token, 'choice:confirm')).toBe(false); expect(f.raw.executeCommand).not.toHaveBeenCalled();
        f.open(); f.dialogs.answer(f.dialogs.current!.token, 'choice:confirm'); await nextTick();
        const started = JSON.stringify(f.state); browser.dispatchEvent(new Event('blur')); f.ui.close(); f.dialogs.reset(); f.scope.stop();
        expect(JSON.stringify(f.state)).toBe(started); expect(f.raw.executeCommand).toHaveBeenCalledTimes(1);
    });
    it('shared held-key and adjacent-pointer barriers cannot leak into a fresh rest explanation', () => {
        const f = session(); f.input.keydown(key('ArrowRight')); f.open();
        f.input.keydown(key('Escape')); f.input.keyup(key('Escape'));
        const held = key('ArrowRight', true); f.input.keydown(held); expect(held.preventDefault).toHaveBeenCalled();
        f.input.keyup(key('ArrowRight')); const fresh = key('ArrowRight'); f.input.keydown(fresh); expect(fresh.preventDefault).not.toHaveBeenCalled();
        f.input.keyup(key('ArrowRight'));
        // The bar's physical release belongs to the opening gesture.
        f.input.pointerdown(pointer('open')); f.input.pointerup(pointer('open')); f.open();
        f.input.pointerdown(pointer('choice:confirm')); f.input.pointerup(pointer('choice:confirm'));
        f.input.click(pointer('choice:confirm', { detail: 2 })); expect(f.raw.executeCommand).not.toHaveBeenCalled();
        expect(f.ui.panelOpen.value).toBe(true);
    });
    it('the rest button gesture cannot answer the subsequent canonical engine risk confirmation', () => {
        const f = session(), answerRisk = vi.fn(() => true);
        f.raw.executeCommand.mockImplementation(() => {
            f.raw.pendingCommandConfirmation = { kind: 'rest-risk' };
            f.dialogs.request({ kind: 'confirm', owner: 'engine', text: '', onAnswer: answerRisk });
        });
        f.open(); f.input.pointerdown(pointer('choice:confirm')); f.input.pointerup(pointer('choice:confirm'));
        expect(f.raw.executeCommand).toHaveBeenCalledTimes(1); expect(f.dialogs.current!.owner).toBe('engine');
        f.input.pointerdown(pointer('yes')); f.input.pointerup(pointer('yes')); f.input.click(pointer('yes', { detail: 2 }));
        expect(answerRisk).not.toHaveBeenCalled(); expect(f.dialogs.current!.owner).toBe('engine');
    });
    it('detaches and freezes bonfire/rest DTOs and fails closed for invalid or duplicate identity', () => {
        const row = bonfire(), rows = readCombatUiBonfires([row]), rest = { bonfireId: 31, remainingTicks: 230, status: 'resting' as const };
        const copied = readCombatUiRest(rest)!; row.restTicks = 900; rest.remainingTicks = 1;
        expect(rows[0]!.restTicks).toBe(500); expect(copied.remainingTicks).toBe(230);
        expect(Object.isFrozen(rows)).toBe(true); expect(Object.isFrozen(rows[0])).toBe(true); expect(Object.isFrozen(copied)).toBe(true);
        for (const bad of [{ ...bonfire(), entityId: 0 }, { ...bonfire(), restTicks: Infinity }, { ...bonfire(), restTicks: 0 },
            { ...bonfire(), descriptionKey: 'missing' }, { ...bonfire(), canUse: 'yes' }]) expect(readCombatUiBonfires([bad])).toEqual([]);
        expect(readCombatUiBonfires([bonfire(), bonfire()])).toEqual([]); expect(readCombatUiBonfires(undefined)).toEqual([]);
        for (const bad of [undefined, { ...rest, bonfireId: -1 }, { ...rest, remainingTicks: -.5 }, { ...rest, status: 'complete' }])
            expect(readCombatUiRest(bad)).toBeNull();
        expect(readCombatUiRest({ ...rest, remainingTicks: 0, status: 'interrupted' })).toEqual({ bonfireId: 31, remainingTicks: 0, status: 'interrupted' });
    });
    it('renders captured rest and nearby bonfires during historical ACK without consulting future live state', async () => {
        const f = session(); f.open(); f.state.rest = { bonfireId: 32, remainingTicks: 1, status: 'resting' };
        const captured = { bonfireId: 31, remainingTicks: 230, status: 'resting' };
        f.host.readDisplayFrame = () => ({ telegraphs: [], rows: [], hoverCell: null,
            moduleViews: { combat: { rest: captured, bonfires: [{ ...bonfire(91), restTicks: 700 }] } } }) as unknown as DisplayFrame;
        f.host.isPresentationBusy = () => true; const reads = f.runtime.readModuleView.mock.calls.length; f.ui.refresh();
        expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads); expect(f.ui.panelOpen.value).toBe(false);
        expect(f.ui.hud.value!.props.rest).toEqual(captured);
        const html = await render(CombatTelegraphHud, f.ui.hud.value!.props);
        expect(html).toContain('剩余 230 时间刻'); expect(html).not.toContain('剩余 1 时间刻');
        const bar = await render(CombatAttackBar, f.ui.bar.value!.props);
        expect(bar).toMatch(/data-combat-bonfire="91"[^>]*disabled/); expect(bar).toContain('休息 700 时间刻');
        expect(bar).not.toContain('data-combat-bonfire="31"'); expect(bar).not.toContain('data-combat-bonfire="32"');
        f.open(91); expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads);
    });
    it('shows interruption from a captured frame and never invents rest or nearby bonfires for an older frame', async () => {
        const f = session(); f.state.rest = { bonfireId: 32, remainingTicks: 1, status: 'resting' };
        f.host.readDisplayFrame = () => ({ telegraphs: [], rows: [], hoverCell: null,
            moduleViews: { combat: { rest: { bonfireId: 31, remainingTicks: 0, status: 'interrupted' } } } }) as unknown as DisplayFrame;
        f.host.isPresentationBusy = () => true; const reads = f.runtime.readModuleView.mock.calls.length; f.ui.refresh();
        expect(await render(CombatTelegraphHud, f.ui.hud.value!.props)).toContain('篝火休息已中断，未获得篝火恢复');
        f.host.readDisplayFrame = () => ({ telegraphs: [], rows: [], hoverCell: null, moduleViews: {} }) as unknown as DisplayFrame;
        f.ui.refresh(); expect(f.ui.hud.value).toBeNull();
        expect(await render(CombatAttackBar, f.ui.bar.value!.props)).not.toContain('data-combat-bonfire');
        expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
});
