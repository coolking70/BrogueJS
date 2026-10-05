import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyProductionArena, installProductionBody, PRODUCTION_BODY_ID, startProductionGame } from './support/productionComposite';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { canDirectlySeeMonster, monsterHidden } from '../engine/UI/MonsterVisibility';
import { commitWorldRest, prepareWorldRest, settleWorldRest, worldRestUnavailable } from '../engine/Core/WorldRestProduction';
import { MonsterState, monstersAreEnemies } from '../entities/Monster';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { logger } from '../engine/Systems/Logger';
import { timeSystem } from '../engine/Systems/Time';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
function scene() {
    installProductionBody();
    const game = startProductionGame(['giants', 'combat'], 7307, 'normal'); emptyProductionArena(game);
    const fire = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.owner === 'combat' && entity.depth === game.depth)!;
    commitCreatureAnchor(game.player, { x: fire.x, y: fire.y });
    game.player.maxHp = 1000; game.player.hp = 300; game.player.ticksUntilTurn = 0; game.player.regenCarry = 0;
    const core = game.createCompositeMonster(PRODUCTION_BODY_ID, {
        x: Math.min(Math.max(fire.x + 4, 5), game.grid.width - 5), y: Math.min(Math.max(fire.y, 5), game.grid.height - 5),
    })!;
    expect(core).toBeDefined(); core.state = MonsterState.ASLEEP;
    const actors = [...game.monsters], leg = actors[1]!;
    (game as any).updateVision(); game.onConfirmRequest = () => true;
    const command = JSON.stringify({ module: 'combat', action: 'rest', payload: { bonfireId: fire.id } });
    return { game, core, leg, actors, fire, command, ledger: () => game.extensionRuntime!.actorActionBinding()!.state.bonfires! };
}
function onlyVisible(game: ReturnType<typeof scene>['game'], leg: ReturnType<typeof scene>['leg'] | null) {
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) game.grid.getCell(x, y)!.isVisible = false;
    for (const entity of game.extensionRuntime!.snapshot().foundation.world.entities) if (entity.owner === 'combat' && entity.depth === game.depth) game.grid.getCell(entity.x, entity.y)!.isVisible = true;
    if (leg) for (const at of footprintOf(leg)) game.grid.getCell(at.x, at.y)!.isVisible = true;
}
describe('4d composite relations at the bonfire/native input boundary', () => {
    it('a visible peripheral enemy blocks pure preparation even with the core hidden; core allegiance is authoritative', () => {
        const { game, core, leg, fire, command } = scene(); onlyVisible(game, leg);
        const before = { rng: rng.getState(), id: getNextEntityId(), ext: json(game.extensionRuntime!.snapshot()), tick: timeSystem.currentTick };
        expect(canDirectlySeeMonster(game.player, game.grid, core)).toBe(false);
        expect(canDirectlySeeMonster(game.player, game.grid, leg)).toBe(true);
        expect(worldRestUnavailable(game, fire.id)).toBe('threatened'); expect(prepareWorldRest(game, command)).toBeNull();
        expect({ rng: rng.getState(), id: getNextEntityId(), ext: game.extensionRuntime!.snapshot(), tick: timeSystem.currentTick }).toEqual(before);
        core.isAlly = true; // Peripheral's stale native boolean grants no second allegiance.
        expect(leg.isAlly).toBe(false); expect(monstersAreEnemies(leg, game.player)).toBe(false);
        expect(worldRestUnavailable(game, fire.id)).toBeNull();
        leg.setStatusDuration('invisible', 10); expect(monsterHidden(game.grid, leg, game.player)).toBe(false);
        core.setStatusDuration('discordant', 10); expect(monstersAreEnemies(leg, game.player)).toBe(true);
        expect(worldRestUnavailable(game, fire.id)).toBe('threatened');
    });
    it('asynchronous confirmation rechecks a newly visible member without charging a visit or time', () => {
        const { game, leg, command, ledger } = scene(); onlyVisible(game, null);
        game.onCommandConfirmRequest = () => {}; while (logger.pendingAcknowledgment) logger.acknowledgeNext();
        const tick = timeSystem.currentTick; game.executeCommand('ext:command', command);
        const token = game.pendingCommandConfirmation!.token; onlyVisible(game, leg);
        expect(game.resolveCommandDecision(token, true)).toBe(true);
        expect(game.pendingCommandConfirmation).toBeNull(); expect(timeSystem.currentTick).toBe(tick);
        expect(ledger().placements[0]!.visits).toBe(0); expect(ledger().active).toBeNull(); expect(game.recordedInputEvents).toEqual([]);
    });
    it('the paid rest interrupts when a previously hidden member becomes visible, with no heal or duplicate receipt', () => {
        const { game, leg, command, ledger } = scene(); onlyVisible(game, null);
        const plan = prepareWorldRest(game, command)!; expect(commitWorldRest(game, plan)).toBe(true);
        onlyVisible(game, leg); settleWorldRest(game);
        expect(ledger().active).toBeNull(); expect(ledger().receipts).toHaveLength(1);
        expect(ledger().receipts[0]).toMatchObject({ result: 'interrupted', reason: 'threat' }); expect(game.player.hp).toBe(300);
        settleWorldRest(game); expect(ledger().receipts).toHaveLength(1);
    });
    it('a real rest command observes invisibility expiration on the group and stops before its 500-tick heal', () => {
        const { game, actors, command, ledger } = scene(); for (const actor of actors) actor.setStatusDuration('invisible', 1);
        (game as any).updateVision(); const tick = timeSystem.currentTick;
        while (logger.pendingAcknowledgment) logger.acknowledgeNext(); game.executeCommand('ext:command', command);
        expect(timeSystem.currentTick - tick).toBeGreaterThan(0); expect(timeSystem.currentTick - tick).toBeLessThan(500);
        expect(ledger().receipts[0]).toMatchObject({ result: 'interrupted', reason: 'threat' });
        expect(game.player.hp).toBeLessThan(game.player.maxHp); expect(game.recordedInputEvents).toHaveLength(1);
    });
    it('a real melee attempt against a sleeping group member wakes and delays only the core, including a shielded hit', () => {
        const { game, core, leg, actors } = scene(); commitCreatureAnchor(game.player, { x: leg.x - 1, y: leg.y });
        for (const actor of actors) actor.ticksUntilTurn = 500;
        core.state = MonsterState.ASLEEP; leg.state = MonsterState.HUNTING; leg.applyShield(10000);
        const memberTicks = leg.ticksUntilTurn;
        while (logger.pendingAcknowledgment) logger.acknowledgeNext(); game.executeCommand('move', { x: 1, y: 0 });
        expect(core.state).toBe(MonsterState.HUNTING); expect(core.ticksUntilTurn).toBeGreaterThan(500 - 100);
        expect(leg.hp).toBe(leg.maxHp); expect(leg.ticksUntilTurn).toBe(memberTicks);
    });
});
