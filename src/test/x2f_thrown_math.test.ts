import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatSystem } from '../engine/Combat/Combat';
import { rng } from '../engine/Random';
import { Player } from '../entities/Player';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { ItemLoader } from '../engine/Items/ItemLoader';
import monsters from '../data/monsters.json';

const rat = (monsters as MonsterData[]).find(row => row.id === 'rat')!;
afterEach(() => vi.restoreAllMocks());

describe('X2f compiled CE thrown weapon mathematics', () => {


    it('a miss spends one hit die; auto hit spends none; immune hit spends no damage dice', () => {
        const thrower = new Player(4, 5);
        const defender = new Monster(5, 5, rat);
        defender.hp = defender.maxHp = 10000;
        defender.state = MonsterState.HUNTING;
        const item = ItemLoader.spawnWeapon('javelin', -1, -1)!;
        item.runicType = undefined;
        const roll = vi.spyOn(rng, 'randRange').mockReturnValue(99);
        expect(CombatSystem.resolveThrownWeapon(thrower, defender, item).hit).toBe(false);
        expect(roll.mock.calls).toEqual([[0, 99]]);

        roll.mockClear(); defender.isCaged = true;
        CombatSystem.resolveThrownWeapon(thrower, defender, item);
        expect(roll).toHaveBeenCalledTimes(item.clumping!);

        roll.mockClear();
        vi.spyOn(defender, 'isImmuneToWeapons').mockReturnValue(true);
        const immune = CombatSystem.resolveThrownWeapon(thrower, defender, item);
        expect(immune.damage).toBe(0);
        expect(roll).not.toHaveBeenCalled();

        roll.mockClear();
        vi.spyOn(defender, 'isImmuneToWeapons').mockReturnValue(false);
        vi.spyOn(defender, 'isInvulnerable').mockReturnValue(true);
        expect(CombatSystem.resolveThrownWeapon(thrower, defender, item).damage).toBe(0);
        expect(roll).not.toHaveBeenCalled();
    });

    it('slaying gives 100% hit probability but still consumes attackHit die', () => {
        const thrower = new Player(4, 5);
        const defender = new Monster(5, 5, rat);
        defender.state = MonsterState.HUNTING;
        defender.hp = 1;
        const item = ItemLoader.spawnWeapon('dagger', -1, -1)!;
        item.damage = '100';
        item.runicType = 'slaying';
        item.vorpalEnemy = 'animal';
        const roll = vi.spyOn(rng, 'randRange').mockReturnValue(99);
        const result = CombatSystem.resolveThrownWeapon(thrower, defender, item);
        expect(result.hit).toBe(true);
        expect(result.killed).toBe(true);
        expect(roll.mock.calls).toEqual([[0, 99]]);
    });
});
