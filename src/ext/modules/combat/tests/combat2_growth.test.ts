import { afterEach, describe, expect, it, vi } from 'vitest';
import { start, arena, add, rows, state, play, attackCommand, mechanical, acknowledge, clone } from './support/combat2Harness';
import { growthCommand } from './support/combat2Natural';
import { chargeNativeActorAttack } from '../../../../engine/Core/PhasedAttackProduction';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { logger } from '../../../../engine/Systems/Logger';
import type { Game } from '../../../../engine/Core/Game';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';

const focus = (game: Game) => clone(game.extensionRuntime!.readModuleView('growth')!.components.focus) as { current: number; remainder: number };
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
describe('C2-GROWTH public legitimate character and native skill boundary', () => {
    it.each(rows)('$id uses installed growth Stat capacities but keeps its exact fee and one native physical resolution', row => {
        const { game } = start(['combat', 'growth']); arena(game); add(game, row.id === 'cast-echo' ? 22 : 21, 15);
        const capacity = game.extensionRuntime!.stats.value(game.player.id, 'combat.stamina-capacity', { baseValue: 24 });
        const poise = game.extensionRuntime!.stats.value(game.player.id, 'combat.poise-capacity', { baseValue: 12 });
        expect(capacity).toBeGreaterThanOrEqual(24); expect(poise).toBeGreaterThanOrEqual(12);
        const physical = vi.spyOn(game.player.extensionHooks!, 'physicalResolved');
        let paid: number | undefined; const native = game.resolveActorNativeMelee;
        game.resolveActorNativeMelee = function (...args) { paid ??= state(this).actors.find(actor => actor.actorId === this.player.id)!.stamina; return native.apply(this, args); };
        const beforeFocus = focus(game).current;
        play(game, 'ext:command', attackCommand(`combat.${row.id}`));
        expect(paid).toBe(24 - row.cost); expect(state(game).actors.find(actor => actor.actorId === game.player.id)!.stamina).toBeLessThanOrEqual(capacity);
        expect(physical).toHaveBeenCalledTimes(1);
        expect(focus(game).current).toBeGreaterThanOrEqual(beforeFocus); game.resolveActorNativeMelee = native;
    });
    it('measured-strike pays exactly two focus and one native stamina fee before its ordinary combat resolution', () => {
        const { game } = start(['combat', 'growth']); arena(game); const target = add(game, 21, 15);
        play(game, 'ext:command', growthCommand(game, 'equip-skills', { active: ['growth.skill.measured-strike'], passive: [] }));
        const before = focus(game).current, native = CombatSystem.attack, fees: { focus: number; stamina: number }[] = [];
        CombatSystem.attack = function (...args) { if (args[0] === game.player) fees.push({ focus: focus(game).current, stamina: state(game).actors.find(actor => actor.actorId === game.player.id)!.stamina }); return native.apply(this, args); };
        try { play(game, 'ext:command', growthCommand(game, 'use-skill', { skillId: 'growth.skill.measured-strike', target: { kind: 'creature', id: target.id } })); }
        finally { CombatSystem.attack = native; }
        expect(fees).toEqual([{ focus: before - 2, stamina: 22 }]); expect(target.hp).toBeLessThan(1000);
    });
    it('exhausted combat stamina and a noncontact target each preserve the entire dual-resource transaction', () => {
        const { game } = start(['combat', 'growth']); arena(game); const target = add(game, 21, 15);
        play(game, 'ext:command', growthCommand(game, 'equip-skills', { active: ['growth.skill.measured-strike'], passive: [] }));
        while (chargeNativeActorAttack(game, game.player.id)) { /* Diagnostic use of real native resource mechanism, no growth-state write. */ }
        acknowledge(); const before = mechanical(game);
        play(game, 'ext:command', growthCommand(game, 'use-skill', { skillId: 'growth.skill.measured-strike', target: { kind: 'creature', id: target.id } }));
        expect(mechanical(game)).toEqual(before);
        commitCreatureAnchor(target, { x: 25, y: 15 }); (game as any).updateVision(); acknowledge(); const moved = mechanical(game);
        play(game, 'ext:command', growthCommand(game, 'use-skill', { skillId: 'growth.skill.measured-strike', target: { kind: 'creature', id: target.id } }));
        expect(mechanical(game)).toEqual(moved);
    });
});
