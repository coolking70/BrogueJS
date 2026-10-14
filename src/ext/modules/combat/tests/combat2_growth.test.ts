import { installedOptionalModules } from '../../../../test/support/installedExtensions';
import { missingPackages, verifyInstalledPackageFallback } from '../../../../test/support/optionalPackageLifecycle';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { start, arena, add, rows, state, play, attackCommand, mechanical, acknowledge, clone } from './support/combat2Harness';
import { growthCommand } from './support/combat2Natural';
import { chargeNativeActorAttack } from '../../../../engine/Core/PhasedAttackProduction';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { logger } from '../../../../engine/Systems/Logger';
import type { Game } from '../../../../engine/Core/Game';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';

const growthInstalled = missingPackages(['growth']).length === 0;
const skillCase = (name: string) => growthInstalled ? name : name + ' [growth absent: explicit command refusal and remaining-world persistence]';
function absentGrowthSkill() {
    const game = verifyInstalledPackageFallback(['combat', 'growth']);
    const before = mechanical(game), count = game.recordedInputEvents.length, runtime = game.extensionRuntime, ledger = state(game), actions = game.actorActions;
    for (const action of ['equip-skills', 'use-skill']) {
        play(game, 'ext:command', JSON.stringify({module:'growth', action, payload:{revision:0, skillId:'growth.skill.measured-strike'}}));
        expect(mechanical(game)).toEqual(before); expect(game.recordedInputEvents).toHaveLength(count);
        expect(game.pendingCommandConfirmation).toBeNull(); expect(game.extensionRuntime).toBe(runtime); expect(state(game)).toBe(ledger); expect(game.actorActions).toBe(actions);
    }
    expect(game.extensionRuntime!.readModuleView('growth')).toBeNull();
}
const focus = (game: Game) => clone(game.extensionRuntime!.readModuleView('growth')!.components.focus) as { current: number; remainder: number };
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
describe('C2-GROWTH public legitimate character and native skill boundary', () => {
    it.each(rows)(growthInstalled ? '$id uses installed growth Stat capacities but keeps its exact fee and one native physical resolution' : '$id keeps base combat capacities, exact fee and one native physical resolution with growth physically absent', row => {
        const { game } = start(installedOptionalModules(['combat', 'growth'])); arena(game); add(game, row.id === 'cast-echo' ? 22 : 21, 15);
        const capacity = game.extensionRuntime!.stats.value(game.player.id, 'combat.stamina-capacity', { baseValue: 24 });
        const poise = game.extensionRuntime!.stats.value(game.player.id, 'combat.poise-capacity', { baseValue: 12 });
        expect(capacity).toBeGreaterThanOrEqual(24); expect(poise).toBeGreaterThanOrEqual(12);
        const physical = vi.spyOn(game.player.extensionHooks!, 'physicalResolved');
        let paid: number | undefined, nativeResolutions = 0; const native = game.resolveActorNativeMelee;
        game.resolveActorNativeMelee = function (...args) { nativeResolutions++; paid ??= state(this).actors.find(actor => actor.actorId === this.player.id)!.stamina; return native.apply(this, args); };
        const beforeFocus = growthInstalled ? focus(game).current : null;
        play(game, 'ext:command', attackCommand(`combat.${row.id}`));
        expect(paid).toBe(24 - row.cost); expect(state(game).actors.find(actor => actor.actorId === game.player.id)!.stamina).toBeLessThanOrEqual(capacity);
        expect(nativeResolutions).toBe(1);
        if (growthInstalled) expect(physical).toHaveBeenCalledTimes(1);
        else expect(physical).not.toHaveBeenCalled();
        if (growthInstalled) expect(focus(game).current).toBeGreaterThanOrEqual(beforeFocus!);
        else expect(game.extensionRuntime!.readModuleView('growth')).toBeNull(); game.resolveActorNativeMelee = native;
    });
    it(skillCase('measured-strike pays exactly two focus and one native stamina fee before its ordinary combat resolution'), () => {
        if (!growthInstalled) { absentGrowthSkill(); return; }
        const { game } = start(installedOptionalModules(['combat', 'growth'])); arena(game); const target = add(game, 21, 15);
        play(game, 'ext:command', growthCommand(game, 'equip-skills', { active: ['growth.skill.measured-strike'], passive: [] }));
        const before = focus(game).current, native = CombatSystem.attack, fees: { focus: number; stamina: number }[] = [];
        CombatSystem.attack = function (...args) { if (args[0] === game.player) fees.push({ focus: focus(game).current, stamina: state(game).actors.find(actor => actor.actorId === game.player.id)!.stamina }); return native.apply(this, args); };
        try { play(game, 'ext:command', growthCommand(game, 'use-skill', { skillId: 'growth.skill.measured-strike', target: { kind: 'creature', id: target.id } })); }
        finally { CombatSystem.attack = native; }
        expect(fees).toEqual([{ focus: before - 2, stamina: 22 }]); expect(target.hp).toBeLessThan(1000);
    });
    it(skillCase('exhausted combat stamina and a noncontact target each preserve the entire dual-resource transaction'), () => {
        if (!growthInstalled) { absentGrowthSkill(); return; }
        const { game } = start(installedOptionalModules(['combat', 'growth'])); arena(game); const target = add(game, 21, 15);
        play(game, 'ext:command', growthCommand(game, 'equip-skills', { active: ['growth.skill.measured-strike'], passive: [] }));
        while (chargeNativeActorAttack(game, game.player.id)) { /* Diagnostic use of real native resource mechanism, no growth-state write. */ }
        acknowledge(); const before = mechanical(game);
        play(game, 'ext:command', growthCommand(game, 'use-skill', { skillId: 'growth.skill.measured-strike', target: { kind: 'creature', id: target.id } }));
        expect(mechanical(game)).toEqual(before);
        commitCreatureAnchor(target, { x: 25, y: 15 }); (game as any).updateVision(); acknowledge(); const moved = mechanical(game);
        play(game, 'ext:command', growthCommand(game, 'use-skill', { skillId: 'growth.skill.measured-strike', target: { kind: 'creature', id: target.id } }));
        expect(mechanical(game)).toEqual(moved);
    });
    it(skillCase('measured-strike explicit No preserves both resources and the complete world while recording one refusal'), () => {
        if (!growthInstalled) { absentGrowthSkill(); return; }
        // Controlled protocol evidence: arena/ally setup is separate from natural routes.
        const { game } = start(installedOptionalModules(['combat', 'growth'])); arena(game); const target = add(game, 21, 15);
        target.isAlly = true; target.setStatusDuration('discordant', 100);
        play(game, 'ext:command', growthCommand(game, 'equip-skills', { active: ['growth.skill.measured-strike'], passive: [] }));
        acknowledge(); const before = mechanical(game), count = game.recordedInputEvents.length;
        expect(before.run.justRested).toBe(true);
        const runtime = game.extensionRuntime!, ledger = state(game), actions = game.actorActions;
        game.onCommandConfirmRequest = () => {};
        game.executeCommand('ext:command', growthCommand(game, 'use-skill', { skillId: 'growth.skill.measured-strike', target: { kind: 'creature', id: target.id } }));
        expect(game.pendingCommandConfirmation).not.toBeNull(); expect(mechanical(game)).toEqual(before);
        const token = game.pendingCommandConfirmation!.token;
        expect(game.resolveCommandDecision(token, false)).toBe(true);
        expect(game.pendingCommandConfirmation).toBeNull(); expect(game.lastAdvancementError).toBeNull();
        expect(mechanical(game)).toEqual(before);
        expect(game.extensionRuntime).toBe(runtime); expect(state(game)).toBe(ledger); expect(game.actorActions).toBe(actions);
        expect(game.recordedInputEvents).toHaveLength(count + 1);
        expect(game.recordedInputEvents[count]!.decisions).toEqual([false]);
        expect(game.resolveCommandDecision(token, true)).toBe(false); expect(mechanical(game)).toEqual(before);
    });
});
