import { afterEach, describe, expect, it, vi } from 'vitest';
import * as absorption from '../engine/Combat/MonsterAbsorption';
import * as features from '../engine/Combat/CreatureFeatures';
import * as perception from '../engine/Combat/MonsterAI';
import * as submersion from '../engine/Movement/Submersion';
import type { Game } from '../engine/Core/Game';
import { Grid } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';

const fixtureData: MonsterData = {
    id: 'rat', name: 'rat', char: 'r', color: 0xffffff, hp: 20, damage: '1',
    minDepth: 1, maxDepth: 1, goldDropChance: 0, itemDropChance: 0,
    moveSpeed: 80, attackSpeed: 120, behaviorFlags: ['MONST_NEVER_SLEEPS'],
};

function scene() {
    const order: string[] = [];
    const monster = new Monster(4, 4, fixtureData);
    monster.state = MonsterState.HUNTING;
    monster.ticksUntilTurn = 0;
    const game = {
        grid: new Grid(12, 12),
        applyEntanglementFromTerrain: vi.fn(() => { order.push('entanglement'); }),
        makeMonsterDropItem: vi.fn(() => { order.push('drop'); }),
    } as unknown as Game;
    const absorb = vi.spyOn(absorption, 'updateMonsterCorpseAbsorption').mockImplementation(() => {
        order.push('absorption'); return false;
    });
    const activate = vi.spyOn(features, 'emitCreatureFeature').mockImplementation(() => {
        order.push('activation'); return null;
    });
    const surface = vi.spyOn(submersion, 'surfaceOnDryLand').mockImplementation(() => { order.push('surface'); });
    const update = vi.spyOn(perception, 'updateMonsterState').mockImplementation(() => { order.push('state'); });
    const summon = vi.spyOn(monster, 'trySummon').mockImplementation(() => {
        order.push('native'); monster.ticksUntilTurn = monster.attackSpeed; return true;
    });
    return { monster, game, order, absorb, activate, surface, update, summon };
}

afterEach(() => vi.restoreAllMocks());

describe('3a0 one-time native decision prelude', () => {
    it('keeps the original ordering and forwards the perception range', () => {
        const { monster, game, order, update } = scene();
        expect(monster.prepareNativeDecision(game, 7)).toBe(false);
        expect(order).toEqual(['absorption', 'activation', 'surface', 'entanglement', 'state']);
        expect(update).toHaveBeenCalledExactlyOnceWith(game, monster, 7);
        expect(monster.ticksUntilTurn).toBe(0);
    });

    it('runs the native remainder without repeating prelude effects or assigning movement time', () => {
        const { monster, game, order, absorb, activate, surface, update } = scene();
        expect(monster.prepareNativeDecision(game, 0)).toBe(false);
        monster.takeNativeDecision(game);
        expect(order).toEqual(['absorption', 'activation', 'surface', 'entanglement', 'state', 'native']);
        for (const callback of [absorb, activate, surface, update]) expect(callback).toHaveBeenCalledTimes(1);
        expect(game.applyEntanglementFromTerrain).toHaveBeenCalledTimes(1);
        expect(monster.ticksUntilTurn).toBe(120);
    });

    it('keeps takeTurn as the same prelude-then-native wrapper', () => {
        const { monster, game, order } = scene();
        const prelude = vi.spyOn(monster, 'prepareNativeDecision');
        const remainder = vi.spyOn(monster, 'takeNativeDecision');
        expect(monster.takeTurn(game, 11)).toBeUndefined();
        expect(prelude).toHaveBeenCalledExactlyOnceWith(game, 11);
        expect(remainder).toHaveBeenCalledExactlyOnceWith(game);
        expect(order).toEqual(['absorption', 'activation', 'surface', 'entanglement', 'state', 'native']);
    });

    it('stops before all prelude effects when the monster is dead', () => {
        const { monster, game, order } = scene();
        monster.hp = 0;
        expect(monster.prepareNativeDecision(game, 0)).toBe(true);
        expect(order).toEqual([]);
        expect(monster.ticksUntilTurn).toBe(0);
    });

    it('lets corpse absorption consume the decision before activation or state updates', () => {
        const { monster, game, order, absorb, summon } = scene();
        absorb.mockImplementation(() => {
            order.push('absorption'); monster.ticksUntilTurn = 100; return true;
        });
        monster.takeTurn(game, 0);
        expect(order).toEqual(['absorption']);
        expect(summon).not.toHaveBeenCalled();
        expect(monster.ticksUntilTurn).toBe(100);
    });

    it('retains the negative corpse-counter bypass', () => {
        const { monster, game, order, absorb } = scene();
        monster.corpseAbsorptionCounter = -1;
        expect(monster.prepareNativeDecision(game, 0)).toBe(false);
        expect(absorb).not.toHaveBeenCalled();
        expect(order).toEqual(['activation', 'surface', 'entanglement', 'state']);
    });

    it.each(['paralyzed', 'entranced'] as const)('preserves the inner %s gate after native terrain effects', status => {
        const { monster, game, order, summon } = scene();
        monster.setStatusDuration(status, 10);
        expect(monster.prepareNativeDecision(game, 0)).toBe(true);
        expect(order).toEqual(['absorption', 'activation', 'surface', 'entanglement']);
        expect(summon).not.toHaveBeenCalled();
        expect(monster.ticksUntilTurn).toBe(0);
    });

    it('drops captive items at the original inner gate and skips perception', () => {
        const { monster, game, order } = scene();
        monster.isCaged = true;
        expect(monster.prepareNativeDecision(game, 0)).toBe(true);
        expect(order).toEqual(['absorption', 'activation', 'surface', 'entanglement', 'drop']);
        expect(game.makeMonsterDropItem).toHaveBeenCalledExactlyOnceWith(monster);
    });

    it('awakening spends the current decision and cannot enter the native remainder', () => {
        const { monster, game, order, update, summon } = scene();
        monster.state = MonsterState.ASLEEP;
        monster.behaviorFlags.add('MONST_ALWAYS_HUNTING');
        update.mockImplementation(() => {
            order.push('state');
            expect(monster.ticksUntilTurn).toBe(80);
            monster.state = MonsterState.HUNTING;
        });
        monster.takeTurn(game, 0);
        expect(monster.state).toBe(MonsterState.HUNTING);
        expect(monster.ticksUntilTurn).toBe(80);
        expect(summon).not.toHaveBeenCalled();
    });

    it.each([0, 47])('a monster put to sleep by perception keeps original time ownership (ticks=%i)', ticks => {
        const { monster, game, update } = scene();
        monster.ticksUntilTurn = ticks;
        update.mockImplementation(() => { monster.state = MonsterState.ASLEEP; });
        expect(monster.prepareNativeDecision(game, 0)).toBe(true);
        expect(monster.ticksUntilTurn).toBe(ticks || 80);
    });

    it('does not apply hostile sleep consumption to an ally', () => {
        const { monster, game } = scene();
        monster.isAlly = true;
        monster.state = MonsterState.ASLEEP;
        expect(monster.prepareNativeDecision(game, 0)).toBe(false);
        expect(monster.ticksUntilTurn).toBe(0);
    });

    it('does not add its own random draws between the existing decision steps', () => {
        const { monster, game } = scene();
        const random = vi.spyOn(rng, 'randPercent');
        const range = vi.spyOn(rng, 'randRange');
        monster.takeTurn(game, 0);
        expect(random).not.toHaveBeenCalled();
        expect(range).not.toHaveBeenCalled();
    });
});
