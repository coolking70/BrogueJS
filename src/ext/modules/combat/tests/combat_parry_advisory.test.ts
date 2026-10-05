import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, effectScope, nextTick, ref, type Component, type EffectScope } from 'vue';
import { renderToString } from '@vue/server-renderer';
import i18next from 'i18next';
import type { Game } from '../../../../engine/Core/Game';
import type { ModuleUiHost } from '../../../ui/types';
import type { DisplayFrame } from '../../../../ui/displayProjection';
import type { DisplayTelegraph } from '../../../../ui/combatDrawing';
import { DialogService } from '../../../../ui/dialogService';
import { rng } from '../../../../engine/Random';
import { useCombatUi } from '../ui/useCombatUi';
import { combatDirections } from '../ui/view';
import type { Facing } from '../types';
import CombatAttackDialog from '../ui/CombatAttackDialog.vue';
import CombatTelegraphHud from '../ui/CombatTelegraphHud.vue';
import locale from '../locales/zh_CN.json';

const parry = { id: 'parry', nameKey: 'ext.combat.parry.name', canUse: true, cost: 7, windowTicks: 35, recoveryTicks: 120 };
const warning = (sourceEntityId = 10, parryable: boolean | undefined = false): DisplayTelegraph => ({
    actionId: sourceEntityId, sourceSubactionId: 1, sourceEntityId, phase: 'windup',
    cells: [{ x: 9, y: 10 }], ...(parryable === undefined ? {} : { parryable }), remainingTicks: 30,
});
const row = (id = 10, x = 13, y = 10) => ({ kind: 'monster', id, name: 'source', loc: { x, y } });
const captured = (telegraphs: readonly DisplayTelegraph[] = [warning()], rows: readonly unknown[] = [row()], extra = {}) =>
    ({ telegraphs, rows, player: { x: 10, y: 10 }, hoverCell: null, moduleViews: {}, ...extra }) as unknown as DisplayFrame;
const scopes: EffectScope[] = [], services: DialogService[] = [];
function session(initialFrame: DisplayFrame | null = captured()) {
    const state = { schema: 1, revision: 0, actions: [parry, { id: 'dodge', nameKey: 'ext.combat.dodge.name', canUse: true }],
        telegraphs: [warning(10, true)] };
    const token = {}, runtime = { readModuleView: vi.fn(() => ({ session: token, state, canManageCharacter: true })) };
    const raw = { extensionRuntime: runtime, replayRecording: null, isGameOver: false,
        executeCommand: vi.fn(() => { state.revision++; }) };
    // A display advisory has no authority to inspect even a live source position.
    for (const key of ['player', 'monsters', 'grid']) Object.defineProperty(raw, key, {
        get() { throw new Error(`Live world read: ${key}`); },
    });
    const game = raw as unknown as Game, dialogs = new DialogService(); services.push(dialogs);
    const host: ModuleUiHost = { game: () => game, tick: ref(0), immersive: ref(false), dialogs,
        canOpenPanel: () => true, beforeOpenPanel: vi.fn(), afterClosePanel: vi.fn(),
        isPresentationBusy: () => false, readDisplayFrame: initialFrame ? () => initialFrame : undefined };
    const scope = effectScope(); scopes.push(scope); const ui = scope.run(() => useCombatUi(host))!;
    const open = (action = 'parry') => (ui.bar.value!.props.onAttack as (id: string) => void)(action);
    const choose = (facing: Facing) => dialogs.answer(dialogs.current!.token, `choice:${facing}`);
    const props = () => dialogs.current!.content!.props;
    return { state, runtime, raw, host, dialogs, ui, open, choose, props,
        setFrame: (value: DisplayFrame | null) => { host.readDisplayFrame = value ? () => value : undefined; ui.refresh(); } };
}
async function render(component: Component, props: Record<string, unknown>) {
    const translator = i18next.createInstance();
    await translator.init({ lng: 'zh_CN', resources: { zh_CN: { translation: locale } } });
    const app = createSSRApp(component, props); app.config.globalProperties.$t = translator.t.bind(translator);
    return renderToString(app);
}
afterEach(() => {
    scopes.splice(0).forEach(scope => scope.stop()); services.splice(0).forEach(service => service.dispose());
    vi.restoreAllMocks();
});

describe('captured public parry confirmation advisory', () => {
    it.each(combatDirections)('advises $facing only on confirmation, without changing the accepted command', async ({ facing }) => {
        const x = 10 + (facing.includes('e') ? 3 : facing.includes('w') ? -3 : 0);
        const y = 10 + (facing.includes('s') ? 3 : facing.includes('n') ? -3 : 0);
        const f = session(captured([warning()], [row(10, x, y)]));
        const before = { state: JSON.stringify(f.state), rng: rng.getState() };
        f.open();
        expect(Boolean(f.props().unparryableWarning)).toBe(false);
        expect(await render(CombatAttackDialog, f.props())).not.toContain('combat-parry-advisory');
        expect(f.choose(facing)).toBe(true); expect(f.props().unparryableWarning).toBe(true);
        const html = await render(CombatAttackDialog, f.props());
        expect(html).toContain('该方向当前可见的预警均标为不可弹反');
        expect(html).toContain('仍可开始弹反'); expect(html).not.toContain('ext.combat.');
        expect(html).toMatch(/<button[^>]+data-dialog-action="choice:confirm"[^>]*>开始弹反<\/button>/);
        expect(html).not.toContain('disabled');
        expect(f.dialogs.current!.choices).toEqual([{ action: 'choice:confirm', enabled: true }]);
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
        expect({ state: JSON.stringify(f.state), rng: rng.getState() }).toEqual(before);
        const confirm = f.dialogs.current!.token;
        expect(f.dialogs.answer(confirm, 'choice:confirm')).toBe(true);
        expect(f.dialogs.answer(confirm, 'choice:confirm')).toBe(false); await nextTick();
        expect(f.raw.executeCommand).toHaveBeenCalledExactlyOnceWith('ext:command',
            JSON.stringify({ module: 'combat', action: 'parry', payload: { facing } }));
        expect(rng.getState()).toEqual(before.rng);
    });

    it('uses source bearing instead of warned destination cells and ignores other known bearings', () => {
        const f = session(captured([warning(), warning(11, true)], [row(), row(11, 7, 10)]));
        f.open(); f.choose('e'); expect(f.props().unparryableWarning).toBe(true);
        f.dialogs.answer(f.dialogs.current!.token, 'back'); f.choose('w');
        expect(Boolean(f.props().unparryableWarning)).toBe(false);
        f.dialogs.answer(f.dialogs.current!.token, 'back'); f.choose('n');
        expect(Boolean(f.props().unparryableWarning)).toBe(false);
    });

    it.each([true, undefined])('does not call mixed facing warnings all nonparryable when one is %s', parryable => {
        // Explicitly omit metadata for the old-DTO case; omission never means false.
        const other = parryable === undefined ? { ...warning(11), parryable: undefined } : warning(11, parryable);
        const f = session(captured([warning(), other], [row(), row(11, 11, 10)]));
        f.open(); f.choose('e'); expect(Boolean(f.props().unparryableWarning)).toBe(false);
    });

    it('accepts multiple explicitly nonparryable current phases in the chosen bearing', () => {
        const f = session(captured([warning(), { ...warning(11), phase: 'inter-segment' }], [row(), row(11, 11, 10)]));
        f.open(); f.choose('e'); expect(f.props().unparryableWarning).toBe(true);
    });

    it('uses public body cells rather than reducing a large source to its glyph', () => {
        const body = { entityId: 10, cells: [{ x: 11, y: 9 }, { x: 11, y: 10 }], glyph: { x: 11, y: 9 }, size: null };
        const f = session(captured([warning()], [row(10, 11, 9)], { map: { bodies: [body] } }));
        f.open(); f.choose('e'); expect(f.props().unparryableWarning).toBe(true);
        f.dialogs.answer(f.dialogs.current!.token, 'back'); f.choose('ne'); expect(f.props().unparryableWarning).toBe(true);
        f.setFrame(captured([warning()], [{ ...row(10, 11, 9), bodyCells: body.cells }]));
        f.dialogs.answer(f.dialogs.current!.token, 'back'); f.choose('e'); expect(f.props().unparryableWarning).toBe(true);
        f.dialogs.answer(f.dialogs.current!.token, 'back'); f.choose('se'); expect(Boolean(f.props().unparryableWarning)).toBe(false);
    });

    it.each([
        null, captured([], []), captured([warning()], []), captured([warning()], [row()], { player: undefined }),
        captured([warning()], [row(10, NaN, 10)]), captured([warning(), warning(11)], [row()]),
        captured([warning()], [{ ...row(), bodyCells: [] }]),
        captured([{ ...warning(), parryable: undefined }]),
    ])('omits an advisory when the captured evidence is absent or insufficient (%#)', frame => {
        const f = session(frame); f.open(); f.choose('e'); expect(Boolean(f.props().unparryableWarning)).toBe(false);
        expect(f.dialogs.current!.choices).toEqual([{ action: 'choice:confirm', enabled: true }]);
    });

    it('refreshes the existing confirmation from captured metadata without live-world fallbacks or new tokens', () => {
        const f = session(); f.open(); f.choose('e'); const token = f.dialogs.current!.token;
        expect(f.state.telegraphs[0]!.parryable).toBe(true); expect(f.props().unparryableWarning).toBe(true);
        f.setFrame(captured([{ ...warning(), parryable: undefined }]));
        expect(f.dialogs.current!.token).toBe(token); expect(Boolean(f.props().unparryableWarning)).toBe(false);
        f.setFrame(captured()); expect(f.props().unparryableWarning).toBe(true);
        f.setFrame(captured([warning()], [row(10, 7, 10)])); expect(Boolean(f.props().unparryableWarning)).toBe(false);
        const reads = f.runtime.readModuleView.mock.calls.length;
        f.host.isPresentationBusy = () => true; f.setFrame(captured());
        expect(f.runtime.readModuleView).toHaveBeenCalledTimes(reads);
        expect(f.dialogs.current).toBeUndefined(); expect(f.dialogs.answer(token, 'choice:confirm')).toBe(false);
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
    });

    it('keeps back, reselect, cancel and repeated opens display-only and never advises other actions', async () => {
        const f = session(), before = { state: JSON.stringify(f.state), rng: rng.getState() };
        f.open(); f.open(); expect(f.dialogs.queueLength).toBe(1); f.choose('e');
        const old = f.dialogs.current!.token;
        f.dialogs.answer(old, 'back'); expect(Boolean(f.props().unparryableWarning)).toBe(false);
        f.choose('w'); expect(Boolean(f.props().unparryableWarning)).toBe(false);
        f.dialogs.answer(f.dialogs.current!.token, 'close'); expect(f.dialogs.answer(old, 'choice:confirm')).toBe(false);
        f.open('dodge'); f.choose('e'); expect(Boolean(f.props().unparryableWarning)).toBe(false);
        for (const [attack, facing] of [[parry, null], [{ ...parry, id: 'dodge' }, 'e']] as const)
            expect(await render(CombatAttackDialog, { attack, facing, unparryableWarning: true })).not.toContain('combat-parry-advisory');
        expect(f.raw.executeCommand).not.toHaveBeenCalled();
        expect({ state: JSON.stringify(f.state), rng: rng.getState() }).toEqual(before);
    });

    it('keeps localized property-specific map legends in HUD titles without an extra visible row', async () => {
        const html = await render(CombatTelegraphHud, { resources: null, focused: false,
            entries: [true, false, undefined].map((parryable, index) => ({ key: `1:${index}`, name: null, phase: 'windup', parryable })) });
        for (const label of ['左下盾形＝可弹反', '右下×＝不可弹反', '底部中间空心菱形＝属性未知']) {
            expect(html).toMatch(new RegExp(`title="[^"]*${label}[^"]*"`));
            expect((html.match(new RegExp(label, 'g')) ?? [])).toHaveLength(1);
        }
        expect(html).toContain('不保证弹反成功'); expect(html).not.toContain('ext.combat.');
        const unknown = await render(CombatTelegraphHud, { resources: null, focused: false,
            entries: [{ key: '1:1', name: null, phase: 'windup' }] });
        expect(unknown).toContain('空心菱形'); expect(unknown).not.toContain('不可弹反'); expect(unknown).not.toContain('盾形');
    });
});
