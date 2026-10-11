import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, effectScope, nextTick, ref, type Component } from 'vue';
import { renderToString } from '@vue/server-renderer';
import i18next from 'i18next';
import { readFileSync } from 'node:fs';
import { rows, start, arena, mechanical } from './support/combat2Harness';
import { readCombatUiView } from '../ui/view';
import { useCombatUi } from '../ui/useCombatUi';
import CombatAttackBar from '../ui/CombatAttackBar.vue';
import CombatAttackDialog from '../ui/CombatAttackDialog.vue';
import CombatTelegraphHud from '../ui/CombatTelegraphHud.vue';
import { DialogService } from '../../../../ui/dialogService';
import { logger } from '../../../../engine/Systems/Logger';
import locale from '../locales/zh_CN.json';

async function render(component: Component, props: Record<string, unknown>) {
    const translator = i18next.createInstance();
    await translator.init({ lng: 'zh_CN', resources: { zh_CN: { translation: locale } } });
    await i18next.init({ lng: 'zh_CN', resources: { zh_CN: { translation: locale } } });
    const app = createSSRApp(component, props); app.config.globalProperties.$t = translator.t.bind(translator);
    return renderToString(app);
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('C2-UI static content and one authoritative toolbar', () => {
    it('renders eight attacks and two defenses exactly once with scrollable 44px controls', async () => {
        const { game } = start(); const before = mechanical(game), model = readCombatUiView(game)!;
        const html = await render(CombatAttackBar, { model, blocked: false, error: null });
        const ids = [...html.matchAll(/data-combat-action="([^"]+)"/g)].map(match => match[1]!);
        expect(ids).toEqual(['fixture.slash', 'fixture.stomp', 'fixture.double-thrust', ...rows.map(row => `combat.${row.id}`), 'dodge', 'parry']);
        expect(new Set(ids).size).toBe(10);
        expect(html).not.toContain('ext.combat.');
        const source = readFileSync('src/ext/modules/combat/ui/CombatAttackBar.vue', 'utf8');
        expect(source).toContain('overflow-x:auto'); expect(source).toContain('min-width:44px'); expect(source).toContain('min-height:44px');
        expect(mechanical(game)).toEqual(before);
    });
    it.each(rows)('$id has localized exact costs, timing and limits in both direction and confirmation pages', async row => {
        const { game } = start(), attack = readCombatUiView(game)!.actions.find(action => action.id === `combat.${row.id}`)!;
        for (const facing of [null, 'e']) {
            const html = await render(CombatAttackDialog, { attack, facing });
            expect(html).toContain(row.name); expect(html).toContain(row.hint);
            expect(html).toContain(`消耗 ${row.cost} 体力`);
            expect(html).toContain(`前摇 ${row.windup} 时间刻`);
            expect(html).toContain(`恢复 ${row.recovery} 时间刻`);
            expect(html).toContain(`共 ${row.windup + row.recovery + row.segments.reduce((sum, segment) => sum + segment.delay, 0)} 时间刻`);
            expect(html).not.toContain('ext.combat.');
            expect([...html.matchAll(/data-dialog-action="choice:confirm"/g)]).toHaveLength(facing ? 1 : 0);
        }
    });
    it('explains paid manual counter without combining it with parry', async () => {
        const { game } = start(), attack = readCombatUiView(game)!.actions.find(action => action.id === 'parry')!;
        const html = await render(CombatAttackDialog, { attack, facing: 'e' });
        expect(html).toContain(locale['ext.combat.ui.manual_counter_hint']); expect(html).toContain('另付体力');
        expect([...html.matchAll(/data-dialog-action="choice:confirm"/g)]).toHaveLength(1);
    });
    it.each(['fixture.slash', 'fixture.stomp', 'fixture.double-thrust', ...rows.map(row => `combat.${row.id}`), 'dodge', 'parry'])('%s uses real Game only after explicit direction and confirmation', async id => {
        const { game } = start(); arena(game);
        const dialogs = new DialogService(), scope = effectScope();
        const ui = scope.run(() => useCombatUi({ game: () => game, tick: ref(0), immersive: ref(false), dialogs,
            canOpenPanel: () => true, beforeOpenPanel: () => {}, afterClosePanel: () => {}, isPresentationBusy: () => false }))!;
        try {
            const before = mechanical(game), count = game.recordedInputEvents.length;
            (ui.bar.value!.props.onAttack as Function)(id);
            expect(dialogs.current!.owner).toBe('combat'); expect(ui.commands.value).toEqual([]);
            dialogs.answer(dialogs.current!.token, 'choice:n'); expect(mechanical(game)).toEqual(before);
            dialogs.answer(dialogs.current!.token, 'back'); dialogs.answer(dialogs.current!.token, 'close');
            expect(mechanical(game)).toEqual(before);
            (ui.bar.value!.props.onAttack as Function)(id); dialogs.answer(dialogs.current!.token, 'choice:e');
            expect(mechanical(game)).toEqual(before);
            dialogs.answer(dialogs.current!.token, 'choice:confirm'); await nextTick();
            expect(game.lastAdvancementError).toBeNull(); expect(game.recordedInputEvents).toHaveLength(count + 1);
            expect(JSON.parse(game.recordedInputEvents[count]!.data as string)).toEqual({ module: 'combat', action: id === 'parry' || id === 'dodge' ? id : 'attack',
                payload: id === 'parry' || id === 'dodge' ? { facing: 'e' } : { attackId: id, facing: 'e' } });
        } finally { scope.stop(); dialogs.dispose(); }
    });
    it('keeps overlapping captured warnings distinct and unknown properties unknown', async () => {
        const html = await render(CombatTelegraphHud, { resources: null, focused: false, entries: [
            { key: '1:1', name: '公开来源', phase: 'windup', parryable: false, remainingTicks: 31 },
            { key: '2:1', name: null, phase: 'inter-segment' },
        ] });
        expect(html).toContain('公开来源'); expect(html).toContain('不可弹反'); expect(html).toContain('31');
        expect(html).toContain('弹反属性未知'); expect(html).toContain(locale['ext.combat.ui.telegraph_timing_unknown']);
        for (const row of rows) expect(html).not.toContain(row.name);
        const source = readFileSync('src/ext/modules/combat/ui/useCombatUi.ts', 'utf8');
        expect(source).not.toMatch(/addEventListener\(['"](?:keydown|keyup|touchstart|pointerdown)/);
    });
});
