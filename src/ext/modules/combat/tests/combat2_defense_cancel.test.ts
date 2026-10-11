import { afterEach, describe, expect, it, vi } from 'vitest';
import { rows, start, arena, add, state, attackCommand, observe, mechanical } from './support/combat2Harness';
import { preparePhasedAttackCommand, commitPhasedAttackCommand, prepareActorParry, commitActorParry, applyActorPoiseDamage } from '../../../../engine/Core/PhasedAttackProduction';
import { withNativeActorDecisionScope } from '../../../../engine/Core/ActorActionScope';
import { productionActorActionScheduler, notifyProductionActorSourceChanged } from '../../../../engine/Core/ActorActionProduction';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import type { Game } from '../../../../engine/Core/Game';

function advance(game: Game, ticks: number) {
    productionActorActionScheduler(game)!.advanceActionTime(ticks);
    for (const actor of [game.player, ...game.monsters]) actor.ticksUntilTurn = Math.max(0, actor.ticksUntilTurn - ticks);
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
describe('C2-DEFENSE diagnostic paid phased contacts', () => {
    it.each(rows)('$id honors its parry bit and the one-cell contact requirement', row => {
        const { game } = start(); arena(game); const target = add(game, row.id === 'cast-echo' ? 22 : 21, 15);
        const observation = observe(game), plan = preparePhasedAttackCommand(game, attackCommand(`combat.${row.id}`))!;
        commitPhasedAttackCommand(game, plan); advance(game, row.windup - 1);
        target.ticksUntilTurn = 0;
        const defense = prepareActorParry(game, target.id, 'w')!;
        withNativeActorDecisionScope(game, target.id, scope => commitActorParry(game, defense, scope));
        const random = rng.getState(), hp = target.hp; advance(game, 1);
        productionActorActionScheduler(game)!.dispatchActorBoundary(game.player.id);
        const successful = row.segments[0]!.parry && row.id !== 'cast-echo';
        expect(observation.parries).toHaveLength(successful ? 1 : 0);
        if (successful) { expect(target.hp).toBe(hp); expect(rng.getState()).toEqual(random);
            expect(state(game).actors.find(actor => actor.actorId === target.id)!.parryRemainingTicks).toBe(0);
            expect(state(game).actors.find(actor => actor.actorId === game.player.id)!.poise).toBe(0);
            expect(observation.hits).toEqual([]);
        } else expect(target.hp).toBeLessThan(hp);
        expect(state(game).actors.find(actor => actor.actorId === target.id)!.stamina).toBe(21);
        observation.restore();
    });
    it.each([{ facing: 'w', elapsed: 59, succeeds: true }, { facing: 'w', elapsed: 60, succeeds: false }, { facing: 'e', elapsed: 59, succeeds: false }] as const)('returning-sweep $facing/$elapsed has the exclusive defense window', ({ facing, elapsed, succeeds }) => {
        const { game } = start(); arena(game); const target = add(game, 21, 15), observation = observe(game);
        commitPhasedAttackCommand(game, preparePhasedAttackCommand(game, attackCommand('combat.returning-sweep'))!);
        advance(game, 100 - elapsed); target.ticksUntilTurn = 0; const plan = prepareActorParry(game, target.id, facing)!;
        withNativeActorDecisionScope(game, target.id, scope => commitActorParry(game, plan, scope)); advance(game, elapsed);
        productionActorActionScheduler(game)!.dispatchActorBoundary(game.player.id);
        expect(observation.parries).toHaveLength(succeeds ? 1 : 0); observation.restore();
    });
    it('a far advancing-point contact stays unparried even though its segment allows parry', () => {
        const { game } = start(); arena(game); const target = add(game, 23, 15), observation = observe(game);
        commitPhasedAttackCommand(game, preparePhasedAttackCommand(game, attackCommand('combat.advancing-point'))!);
        for (const ticks of [80, 60]) { advance(game, ticks); productionActorActionScheduler(game)!.dispatchActorBoundary(game.player.id); }
        advance(game, 59); target.ticksUntilTurn = 0; const plan = prepareActorParry(game, target.id, 'w')!;
        withNativeActorDecisionScope(game, target.id, scope => commitActorParry(game, plan, scope)); advance(game, 1);
        productionActorActionScheduler(game)!.dispatchActorBoundary(game.player.id);
        expect(observation.parries).toEqual([]); expect(target.hp).toBeLessThan(1000); observation.restore();
    });
});
describe('C2-CANCEL diagnostic source and target changes', () => {
    it.each(['death', 'displacement', 'disabled', 'break'] as const)('%s cancels an advancing-point windup without refund or ghost contacts', reason => {
        const { game } = start(); arena(game); add(game, 21, 15); const observation = observe(game);
        commitPhasedAttackCommand(game, preparePhasedAttackCommand(game, attackCommand('combat.advancing-point'))!);
        expect(state(game).actors.find(actor => actor.actorId === game.player.id)!.stamina).toBe(18);
        if (reason === 'death') game.player.hp = 0;
        if (reason === 'displacement') commitCreatureAnchor(game.player, { x: 19, y: 15 });
        if (reason === 'disabled') game.player.statusDurations.paralyzed = 100;
        if (reason === 'break') applyActorPoiseDamage(game, game.player.id, 12);
        else notifyProductionActorSourceChanged(game, game.player.id);
        const child = game.actorActions!.bundles[0]?.subactions[0];
        if (child && child.phaseRemainingTicks > 0) advance(game, child.phaseRemainingTicks);
        productionActorActionScheduler(game)!.dispatchActorBoundary(game.player.id);
        expect(observation.hits).toEqual([]);
        expect(state(game).actions.flatMap(action => action.subactions).every(sub => sub.lockedCells.length === 0)).toBe(true);
        expect(state(game).actors.find(actor => actor.actorId === game.player.id)!.stamina).toBeLessThan(24);
        observation.restore();
    });
    it('moving only the target makes the locked first stage miss while keeping later stages paid', () => {
        const { game } = start(); arena(game); const target = add(game, 21, 15), observation = observe(game);
        commitPhasedAttackCommand(game, preparePhasedAttackCommand(game, attackCommand('combat.advancing-point'))!);
        commitCreatureAnchor(target, { x: 22, y: 15 }); advance(game, 80);
        productionActorActionScheduler(game)!.dispatchActorBoundary(game.player.id); expect(observation.hits).toEqual([]);
        expect(game.actorActions!.bundles[0]!.subactions[0]!.cancelled).toBe(false);
        advance(game, 60); productionActorActionScheduler(game)!.dispatchActorBoundary(game.player.id);
        expect(target.hp).toBeLessThan(1000); expect(observation.hits).toHaveLength(1);
        const snapshot = mechanical(game); expect(snapshot.run.actorActions!.bundles[0]!.elapsedActionTicks).toBe(140);
        observation.restore();
    });
});
