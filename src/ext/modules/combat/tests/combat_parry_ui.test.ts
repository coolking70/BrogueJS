import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, effectScope, nextTick, ref, type Component, type EffectScope } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { readFileSync } from 'node:fs';
import i18next from 'i18next';
import type { Game } from '../../../../engine/Core/Game';
import type { ModuleUiHost } from '../../../ui/types';
import type { DisplayFrame } from '../../../../ui/displayProjection';
import { DialogService } from '../../../../ui/dialogService';
import { DialogInput } from '../../../../ui/dialogInput';
import { rng } from '../../../../engine/Random';
import { useCombatUi } from '../ui/useCombatUi';
import { buildCombatUiCommand, combatDirections, readCombatUiResources, readCombatUiView } from '../ui/view';
import CombatAttackBar from '../ui/CombatAttackBar.vue';
import CombatAttackDialog from '../ui/CombatAttackDialog.vue';
import CombatTelegraphHud from '../ui/CombatTelegraphHud.vue';
import locale from '../locales/zh_CN.json';

const resources = (poise = 17) => ({ stamina: 19, capacity: 24, regenDelayRemaining: 0,
    dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0, poise, poiseCapacity: 25,
    poiseRecoveryDelayRemaining: 11, parryRemainingTicks: 7, parryRecoveryRemainingTicks: 27, staggerRemainingTicks: 0 });
const parry = () => ({ id: 'parry', nameKey: 'ext.combat.parry.name', canUse: true, cost: 7, windowTicks: 35, recoveryTicks: 120 });
const scopes: EffectScope[] = [], services: DialogService[] = [], inputs: DialogInput[] = [];
function session() {
    const state = { schema: 1, revision: 0, resources: resources(), actions: [
        { id: 'fixture.slash', nameKey: 'ext.combat.attack.slash.name', canUse: true, cost: 4 },
        { id: 'fixture.stomp', nameKey: 'ext.combat.attack.stomp.name', canUse: true, cost: 5 },
        { id: 'fixture.double-thrust', nameKey: 'ext.combat.attack.double-thrust.name', canUse: true, cost: 6 },
        { id: 'dodge', nameKey: 'ext.combat.dodge.name', canUse: true, cost: 6 }, parry(),
    ] };
    const token = {}, runtime = { readModuleView: vi.fn(() => ({ session: token, state, canManageCharacter: true })) };
    const raw = { extensionRuntime: runtime, replayRecording: null as object | null, isGameOver: false,
        executeCommand: vi.fn(() => { state.revision++; }) };
    const game = raw as unknown as Game, dialogs = new DialogService(); services.push(dialogs);
    const host: ModuleUiHost = { game: () => game, tick: ref(0), immersive: ref(false), dialogs,
        canOpenPanel: vi.fn(() => true), beforeOpenPanel: vi.fn(), afterClosePanel: vi.fn(),
        isPresentationBusy: vi.fn(() => false) };
    const scope = effectScope(); scopes.push(scope); const ui = scope.run(() => useCombatUi(host))!;
    const input = new DialogInput(); inputs.push(input); input.attach({ service: dialogs, contains: () => true, hint: vi.fn() });
    const open = (event?: MouseEvent) => (ui.bar.value!.props.onAttack as (id: string, event?: MouseEvent) => void)('parry', event);
    return { state, runtime, raw, game, dialogs, host, scope, ui, input, open };
}
async function render(component: Component, props: Record<string, unknown>) {
    const translator = i18next.createInstance();
    await translator.init({ lng: 'zh_CN', resources: { zh_CN: { translation: locale } } });
    const app = createSSRApp(component, props); app.config.globalProperties.$t = translator.t.bind(translator);
    return renderToString(app);
}
const key = (name: string, repeat = false) => ({ key: name, code: name, repeat, target: null,
    preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }) as unknown as KeyboardEvent;
const pointer = (action: string, extra: Record<string, unknown> = {}) => ({ pointerId: 1, button: 0, detail: 1,
    clientX: 30, clientY: 50, target: { closest: () => ({ getAttribute: () => action, hasAttribute: () => false }) },
    preventDefault: vi.fn(), stopImmediatePropagation: vi.fn(), ...extra }) as unknown as PointerEvent;
afterEach(() => {
    scopes.splice(0).forEach(scope => scope.stop()); services.splice(0).forEach(service => service.dispose());
    inputs.splice(0).forEach(input => input.dispose()); vi.restoreAllMocks();
});

describe('EXT-3d sole combat toolbar and public parry/poise UI', () => {
    it('bounds the narrow toolbar to one non-wrapping, horizontally scrollable action row', () => {
        const source = readFileSync(new URL('../ui/CombatAttackBar.vue', import.meta.url), 'utf8');
        const row = source.match(/\.combat-attacks\{([^}]+)\}/)![1]!;
        expect(row).toContain('flex:1 1 0'); expect(row).toContain('flex-wrap:nowrap');
        expect(row).toContain('min-width:0'); expect(row).toContain('overflow-x:auto');
        expect(source).toContain('max-width:100%'); expect(source).toContain('min-height:44px');
    });
    it('keeps every action exactly once in the module bar and none in bottom commands', async () => {
        const f = session();
        expect(f.ui.commands.value).toEqual([]);
        const html = await render(CombatAttackBar, f.ui.bar.value!.props);
        const ids = [...html.matchAll(/data-combat-action="([^"]+)"/g)].map(match => match[1]);
        expect(ids).toEqual(f.state.actions.map(action => action.id)); expect(new Set(ids).size).toBe(ids.length);
        f.open(); expect(f.ui.commands.value).toEqual([]);
        f.dialogs.answer(f.dialogs.current!.token, 'close'); f.raw.replayRecording = {}; f.ui.refresh();
        expect(await render(CombatAttackBar, f.ui.bar.value!.props)).toMatch(/data-combat-action="parry"[^>]+disabled/);
        expect(f.ui.commands.value).toEqual([]);
    });
    it('shows localized cost and timing from the action DTO in both steps', async () => {
        for (const facing of [null, 'ne'] as const) {
            const html = await render(CombatAttackDialog, { attack: { ...parry(), cost: 13, windowTicks: 41, recoveryTicks: 137 }, facing });
            expect(html).toContain('消耗 13 体力'); expect(html).toContain('保护窗口 41 时间刻 · 恢复 137 时间刻');
            expect(html).toContain(facing ? '确认朝这个方向架起弹反？' : '选择弹反朝向');
            expect(html).toContain('不自动反击'); expect(html).not.toContain('ext.combat.');
            expect(html).toContain('开始弹反及其他行动都会推进时间');
            expect(html).toContain('攻击必须在窗口归零前命中，归零当刻已失效');
            expect([...html.matchAll(/data-dialog-action="choice:confirm"/g)]).toHaveLength(facing ? 1 : 0);
        }
    });
    it('shows explicit current-segment parry properties and tick countdowns without promising success', async () => {
        for (const [parryable, label] of [[true, '可弹反'], [false, '不可弹反'], [undefined, '弹反属性未知']] as const) {
            const html = await render(CombatTelegraphHud, { resources: null, focused: false,
                entries: [{ key: '1:1', name: '预警来源', phase: 'windup', parryable, remainingTicks: 50 }] });
            const text = html.match(/class="windup"[^>]*>([^<]+)<\/span>/)![1]!.replace(/\s+/g, ' ').trim();
            expect(text).toBe(`预警来源 · 即将释放 · ${label} · 距本段释放 50 时间刻`);
            expect(html).toContain('可弹反仅指本段属性，成功还需朝向、接触范围与时机符合');
            expect(html).toContain('行动会推进时间，弹反窗口归零当刻已失效');
            expect(html).not.toContain('ext.combat.');
        }
        const old = await render(CombatTelegraphHud, { resources: null, focused: true,
            entries: [{ key: '1:1', name: null, phase: 'inter-segment' }] });
        const oldText = old.match(/class="inter-segment"[^>]*>([^<]+)<\/span>/)![1]!.replace(/\s+/g, ' ').trim();
        expect(oldText).toBe('已现身的攻击来源 · 后续段预警 · 弹反属性未知 · 释放时间未知');
        const due = await render(CombatTelegraphHud, { resources: null, focused: false,
            entries: [{ key: '1:1', name: null, phase: 'inter-segment', parryable: false, remainingTicks: 0 }] });
        expect(due).toContain('距本段释放 0 时间刻'); expect(due).not.toContain('释放时间未知');
    });
    it.each(combatDirections)('confirms $facing parry exactly once through the original command boundary', async direction => {
        const f = session(), before = { state: JSON.stringify(f.state), rng: rng.getState() }; f.open();
        expect(f.dialogs.current!.content!.props.attack).toEqual(parry());
        expect(f.dialogs.answer(f.dialogs.current!.token, `choice:${direction.facing}`)).toBe(true);
        expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect({ state: JSON.stringify(f.state), rng: rng.getState() }).toEqual(before);
        const confirm = f.dialogs.current!.token;
        expect(f.dialogs.answer(confirm, 'choice:confirm')).toBe(true);
        expect(f.dialogs.answer(confirm, 'choice:confirm')).toBe(false); f.open(); await nextTick();
        expect(f.raw.executeCommand).toHaveBeenCalledExactlyOnceWith('ext:command', JSON.stringify({ module: 'combat', action: 'parry', payload: { facing: direction.facing } }));
        expect(f.ui.panelOpen.value).toBe(false); expect(rng.getState()).toEqual(before.rng);
    });
    it('keeps Back, Cancel and repeated opens display-only', () => {
        const f = session(), before = { state: JSON.stringify(f.state), rng: rng.getState() };
        for (const direction of combatDirections) {
            f.open(); f.open(); expect(f.dialogs.queueLength).toBe(1);
            f.dialogs.answer(f.dialogs.current!.token, `choice:${direction.facing}`);
            f.dialogs.answer(f.dialogs.current!.token, 'back'); expect(f.dialogs.current!.content!.props.facing).toBeNull();
            f.dialogs.answer(f.dialogs.current!.token, 'close');
        }
        expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect({ state: JSON.stringify(f.state), rng: rng.getState() }).toEqual(before);
    });
    it('rejects stale capabilities, unusable parry, replay, terminal and retired confirmations', () => {
        for (const change of ['revision', 'session', 'disabled', 'replay', 'terminal', 'retired'] as const) {
            const f = session(); f.open(); f.dialogs.answer(f.dialogs.current!.token, 'choice:n'); const old = f.dialogs.current!.token;
            if (change === 'revision') f.state.revision++;
            if (change === 'session') f.runtime.readModuleView.mockImplementation(() => ({ session: {}, state: f.state, canManageCharacter: true }));
            if (change === 'disabled') f.state.actions.find(action => action.id === 'parry')!.canUse = false;
            if (change === 'replay') f.raw.replayRecording = {};
            if (change === 'terminal') f.raw.isGameOver = true;
            if (change === 'retired') f.scope.stop();
            f.dialogs.answer(old, 'choice:confirm'); expect(f.raw.executeCommand).not.toHaveBeenCalled();
        }
        const f = session(), view = readCombatUiView(f.game)!;
        expect(buildCombatUiCommand(f.game, view, 'parry', 'bad' as never)).toBeNull();
        f.state.actions.find(action => action.id === 'parry')!.canUse = false; f.ui.refresh(); f.open();
        expect(f.dialogs.current).toBeUndefined(); expect(buildCombatUiCommand(f.game, view, 'parry', 'n')).toBeNull();
    });
    it('honors modal competition, presentation, reset and shell interruption', () => {
        const f = session(); f.dialogs.request({ kind: 'confirm', owner: 'other', text: '', onAnswer: () => true }); f.open();
        expect(f.dialogs.current!.owner).toBe('other'); expect(f.dialogs.queueLength).toBe(1);
        f.dialogs.reset(); f.host.canOpenInteraction = () => false; f.open(); expect(f.ui.panelOpen.value).toBe(false);
        f.host.canOpenInteraction = () => true; f.open(); const old = f.dialogs.current!.token;
        f.host.isPresentationBusy = () => true; f.ui.refresh(); expect(f.dialogs.answer(old, 'choice:n')).toBe(false);
        f.open(); expect(f.ui.panelOpen.value).toBe(false); f.host.isPresentationBusy = () => false;
        f.open(); f.host.canPresentInteraction = () => false; f.ui.refresh(); expect(f.ui.panelOpen.value).toBe(false);
        f.host.canPresentInteraction = () => true; f.open(); f.dialogs.reset(); f.dialogs.sync();
        expect(f.ui.panelOpen.value).toBe(false); expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });
    it('preserves held-key and adjacent-pointer release barriers through parry and cancel', () => {
        const f = session(); f.input.keydown(key('ArrowRight')); f.open();
        f.input.pointerdown(pointer('choice:e')); f.input.pointerup(pointer('choice:e'));
        expect(f.dialogs.current!.content!.props.facing).toBe('e');
        f.input.pointerdown(pointer('choice:confirm')); f.input.pointerup(pointer('choice:confirm'));
        f.input.click(pointer('choice:confirm', { detail: 2 })); expect(f.raw.executeCommand).not.toHaveBeenCalled();
        f.input.keydown(key('Escape')); f.input.keyup(key('Escape')); expect(f.dialogs.current!.content!.props.facing).toBeNull();
        f.input.keydown(key('Escape')); f.input.keyup(key('Escape'));
        const held = key('ArrowRight', true); f.input.keydown(held); expect(held.preventDefault).toHaveBeenCalled();
        f.input.keyup(key('ArrowRight')); const fresh = key('ArrowRight'); f.input.keydown(fresh); expect(fresh.preventDefault).not.toHaveBeenCalled();
        f.open({ detail: 2 } as MouseEvent); expect(f.ui.panelOpen.value).toBe(false);
    });
    it('validates, freezes and detaches defense resources, without inventing fields in older frames', () => {
        const value = resources(), copy = readCombatUiResources(value)!; value.poise = 0;
        expect(copy.poise).toBe(17); expect(Object.isFrozen(copy)).toBe(true);
        for (const bad of [{ ...resources(), poise: 26 }, { ...resources(), poiseCapacity: 0 },
            { ...resources(), parryRemainingTicks: Infinity }, { ...resources(), staggerRemainingTicks: -.5 },
            { ...resources(), poiseRecoveryDelayRemaining: -1 }, { ...resources(), parryRecoveryRemainingTicks: undefined }])
            expect(readCombatUiResources(bad)).toBeNull();
        const old = { stamina: 12, capacity: 24, regenDelayRemaining: 0, dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 };
        expect(readCombatUiResources(old)).toEqual(old); expect(readCombatUiResources(old)).not.toHaveProperty('poise');
    });
    it('detaches action timing and omits malformed optional timing rather than displaying it', () => {
        const f = session(), source = f.state.actions.find((action): action is ReturnType<typeof parry> => action.id === 'parry')!;
        const view = readCombatUiView(f.game)!, action = view.actions.find(action => action.id === 'parry')!;
        expect(action).toEqual(parry()); expect(Object.isFrozen(action)).toBe(true);
        source.windowTicks = 99; source.cost = 12; expect(action.windowTicks).toBe(35); expect(action.cost).toBe(7);
        source.windowTicks = Infinity; source.recoveryTicks = -.5;
        const invalid = readCombatUiView(f.game)!.actions.find(action => action.id === 'parry')!;
        expect(invalid).not.toHaveProperty('windowTicks'); expect(invalid).not.toHaveProperty('recoveryTicks');
    });
    it('uses only captured poise, parry and stagger while ACK owns the display', async () => {
        const f = session(), captured = { ...resources(3), parryRemainingTicks: 0, staggerRemainingTicks: 12 };
        f.host.readDisplayFrame = () => ({ telegraphs: [], rows: [], hoverCell: null,
            moduleViews: { combat: { resources: captured } } }) as unknown as DisplayFrame;
        f.host.isPresentationBusy = () => true; const reads = f.runtime.readModuleView.mock.calls.length; f.ui.refresh();
        expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads); expect(f.ui.hud.value!.props.resources).toEqual(captured);
        const html = await render(CombatTelegraphHud, f.ui.hud.value!.props);
        expect(html).toContain('韧性 3 / 25'); expect(html).toContain('硬直 12'); expect(html).toContain('弹反恢复 27');
        expect(html).not.toContain('韧性 17'); expect(html).not.toContain('弹反窗口 7');
        f.host.readDisplayFrame = () => ({ telegraphs: [], rows: [], hoverCell: null, moduleViews: {} }) as unknown as DisplayFrame;
        f.ui.refresh(); expect(f.ui.hud.value).toBeNull(); expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads);
    });
    it('uses captured warning metadata and leaves older warnings unknown without a live lookup during ACK', async () => {
        const f = session();
        const captured = { actionId: 1, sourceSubactionId: 1, sourceEntityId: 10, phase: 'windup',
            cells: [{ x: 11, y: 10 }], parryable: false, remainingTicks: 50 };
        Object.assign(f.state, { telegraphs: [{ ...captured, parryable: true, remainingTicks: 1 }] });
        f.host.readDisplayFrame = () => ({ telegraphs: [captured], rows: [{ kind: 'monster', id: 10, name: '预警来源' }],
            hoverCell: null, moduleViews: {} }) as unknown as DisplayFrame;
        f.host.isPresentationBusy = () => true;
        const reads = f.runtime.readModuleView.mock.calls.length, random = rng.getState();
        f.ui.refresh();
        expect(f.ui.hud.value!.props.entries).toEqual([{ key: '1:1', name: '预警来源', phase: 'windup',
            parryable: false, remainingTicks: 50 }]);
        const html = await render(CombatTelegraphHud, f.ui.hud.value!.props);
        expect(html).toContain('不可弹反'); expect(html).toContain('距本段释放 50 时间刻');
        expect(html).not.toContain('距本段释放 1 时间刻');
        const old = { actionId: 1, sourceSubactionId: 1, sourceEntityId: 10, phase: 'windup', cells: captured.cells };
        f.host.readDisplayFrame = () => ({ telegraphs: [old], rows: [], hoverCell: null,
            moduleViews: {} }) as unknown as DisplayFrame;
        f.ui.refresh();
        const entries = f.ui.hud.value!.props.entries as { parryable?: boolean; remainingTicks?: number }[];
        expect(entries[0]!.parryable).toBeUndefined(); expect(entries[0]!.remainingTicks).toBeUndefined();
        const unknown = await render(CombatTelegraphHud, f.ui.hud.value!.props);
        expect(unknown).toContain('弹反属性未知'); expect(unknown).toContain('释放时间未知');
        expect(unknown).not.toContain('不可弹反'); expect(unknown).not.toContain('距本段释放');
        expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads);
        expect(f.raw.executeCommand).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
    });
});
