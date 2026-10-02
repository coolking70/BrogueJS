import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatSystem } from '../engine/Combat/Combat';
import { hitProbability } from '../engine/Combat/CombatFormulas';
import { Item, ItemCategory } from '../engine/Items/Item';
import { Random, rng } from '../engine/Random';
import { TerrainType } from '../engine/Map/Grid';
import { Player } from '../entities/Player';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { createHeadlessGame } from './harness';

afterEach(() => vi.restoreAllMocks());

function weapon() {
    const item = new Item('dagger', ')', 0xffffff, ItemCategory.WEAPON);
    item.damage = '1d2';
    item.strengthRequired = 12;
    item.flags = ['ITEM_RUNIC'];
    item.runicType = 'slaying';
    item.vorpalEnemy = 'animal';
    return item;
}

function target() {
    const monster = new Monster(5, 4, (monsters as MonsterData[]).find(m => m.id === 'rat')!);
    monster.state = MonsterState.HUNTING; // No sneak/sleep auto-hit.
    monster.defense = 80;
    monster.hp = monster.maxHp = 100;
    return monster;
}

function scene() {
    const player = new Player(4, 4);
    player.equippedWeapon = weapon();
    return { player, monster: target(), item: player.equippedWeapon };
}

describe('CE Combat.c:116-158 slaying melee hit probability', () => {
    it('matches all 100 hit dice and keeps hit → damage → runic draw order', () => {
        const { player, monster } = scene();
        let die = 0;
        const percent = vi.spyOn(rng, 'randPercent');
        const range = vi.spyOn(rng, 'randRange').mockImplementation((lo, hi) => hi === 99 ? die : lo);
        for (die = 0; die < 100; die++) {
            monster.hp = 100;
            percent.mockClear(); range.mockClear();
            const result = CombatSystem.attack(player, monster);
            expect(result.hit, `hit die ${die}`).toBe(true);
            expect(result.triggeredRunic).toBe('slaying');
            expect(percent.mock.calls).toEqual([[100], [100]]);
            expect(range.mock.calls).toEqual([[0, 99], [1, 2], [0, 99]]);
        }
    });

    it('advances the real RNG exactly like the existing successful attack path', () => {
        const { player, monster } = scene();
        rng.seedRandomGenerator(901); rng.resetCounters();
        const expected = new Random(901);
        expected.randPercent(100);
        const damage = expected.randRange(1, 2);
        expected.randPercent(100);
        const result = CombatSystem.attack(player, monster);
        expect(result).toMatchObject({ hit: true, damage, triggeredRunic: 'slaying' });
        expect(rng.getState()).toEqual(expected.getState());
        expect(rng.randomNumbersGenerated).toBe(3);
    });

    it.each(['other class', 'other rune', 'missing ITEM_RUNIC', 'no equipped weapon'])('%s keeps normal accuracy and can miss', condition => {
        const { player, monster, item } = scene();
        if (condition === 'other class') item.vorpalEnemy = 'undead';
        if (condition === 'other rune') item.runicType = 'quietus';
        if (condition === 'missing ITEM_RUNIC') item.flags = [];
        if (condition === 'no equipped weapon') {
            player.inventory.addItem(item);
            player.equippedWeapon = null;
        }
        const percent = vi.spyOn(rng, 'randPercent');
        const range = vi.spyOn(rng, 'randRange').mockReturnValue(99);
        expect(CombatSystem.attack(player, monster).hit).toBe(false);
        expect(percent.mock.calls).toEqual([[hitProbability(100, 80, 0)]]);
        expect(range.mock.calls).toEqual([[0, 99]]);
    });

    it('unidentified enchantment and rune still give 100% accuracy', () => {
        const { player, monster, item } = scene();
        item.identified = false; item.runicKnown = false;
        vi.spyOn(rng, 'randRange').mockImplementation((lo, hi) => hi === 99 ? 99 : lo);
        const percent = vi.spyOn(rng, 'randPercent');
        expect(CombatSystem.attack(player, monster)).toMatchObject({ hit: true, triggeredRunic: 'slaying' });
        expect(percent.mock.calls).toEqual([[100], [100]]);
    });

    it.each([false, true])('monster attacker (ally=%s) does not inherit the player weapon or inventory rune', ally => {
        const { player, monster, item } = scene();
        const attacker = target();
        attacker.isAlly = ally;
        attacker.accuracy = 100;
        attacker.carriedItem = item;
        const percent = vi.spyOn(rng, 'randPercent');
        vi.spyOn(rng, 'randRange').mockReturnValue(99);
        // Keep a matching player weapon equipped while the monster attacks.
        expect(player.equippedWeapon).toBe(item);
        expect(CombatSystem.attack(attacker, monster).hit).toBe(false);
        expect(percent.mock.calls).toEqual([[hitProbability(100, 80)]]);
    });

    it.each(['stuck', 'paralyzed', 'captive'] as const)('%s preserves the attackHit short circuit', condition => {
        const { player, monster, item } = scene();
        item.damage = '1'; monster.hp = 1; // Fatal contact skips the separate runic draw.
        if (condition === 'captive') monster.isCaged = true;
        else monster.setStatusDuration(condition, 2);
        const percent = vi.spyOn(rng, 'randPercent');
        expect(CombatSystem.attack(player, monster).hit).toBe(true);
        expect(percent).not.toHaveBeenCalled();
    });

    it('seized/seizing precedes normal accuracy, with one hit die even for a nonmatching class', () => {
        const { player, monster, item } = scene();
        item.damage = '1'; item.vorpalEnemy = 'undead';
        player.seizing = true; monster.seized = true;
        const percent = vi.spyOn(rng, 'randPercent');
        const range = vi.spyOn(rng, 'randRange').mockReturnValue(99);
        expect(CombatSystem.attack(player, monster).hit).toBe(true);
        expect(percent.mock.calls).toEqual([[100]]);
        expect(range.mock.calls).toEqual([[0, 99]]);
    });

    it('thrown weapons retain their own rune and original hit-die behavior', () => {
        const { player, monster, item } = scene();
        item.damage = '1'; monster.hp = 1;
        const thrown = weapon(); thrown.damage = '1'; thrown.vorpalEnemy = 'undead';
        const range = vi.spyOn(rng, 'randRange').mockReturnValue(99);
        expect(CombatSystem.resolveThrownWeapon(player, monster, thrown).hit).toBe(false);
        expect(range.mock.calls).toEqual([[0, 99]]);
        range.mockClear(); thrown.vorpalEnemy = 'animal';
        expect(CombatSystem.resolveThrownWeapon(player, monster, thrown)).toMatchObject({ hit: true, killed: true });
        expect(range.mock.calls).toEqual([[0, 99]]);
    });
});

describe('slaying command and inspection integration', () => {
    function gameScene() {
        const game = createHeadlessGame(901);
        game.monsters.length = 0;
        game.items.length = 0;
        for (let x = 2; x <= 7; x++) for (let y = 2; y <= 7; y++) {
            game.grid.setTerrain(x, y, TerrainType.FLOOR, '.', 0x888888);
            const cell = game.grid.getCell(x, y)!;
            cell.isVisible = true;
        }
        game.player.loc = { x: 4, y: 4 };
        game.player.equippedWeapon = weapon();
        const monster = target();
        game.monsters.push(monster);
        return { game, monster, item: game.player.equippedWeapon };
    }

    it.each(['at location', 'examine cycle'])('%s shows the same hit probability without consuming RNG', async route => {
        const { game, monster, item } = gameScene();
        const inspect = async () => {
            if (route === 'at location') game.handleInspectAt(monster.x, monster.y);
            else { game.examinedEntityIds.clear(); await game.executeCommand('examine'); }
            return game.inspectTarget!.sections.flatMap(s => s.lines).find(l => l.text.startsWith('你有 '))!.text;
        };
        const before = rng.getState();
        expect(await inspect()).toBe('你有 100% 的概率命中该怪物。');
        expect(rng.getState()).toEqual(before);
        item.identified = false; item.runicKnown = false;
        expect(await inspect()).toBe('你有 100% 的概率命中该怪物。');
        item.vorpalEnemy = 'undead';
        expect(await inspect()).toBe(`你有 ${hitProbability(100, 80, 0)}% 的概率命中该怪物。`);
        item.vorpalEnemy = 'animal'; item.runicType = 'quietus';
        expect(await inspect()).toBe(`你有 ${hitProbability(100, 80, 0)}% 的概率命中该怪物。`);
        expect(rng.getState()).toEqual(before);
    });

    it('executeCommand melee hits a hunting target and applies the slaying effect', async () => {
        const { game, monster } = gameScene();
        vi.spyOn(rng, 'randRange').mockImplementation((lo, hi) => hi === 99 ? 99 : lo);
        const attack = vi.spyOn(CombatSystem, 'attack');
        await game.executeCommand('move', { x: 1, y: 0 });
        expect(attack).toHaveBeenCalledWith(game.player, monster, expect.anything());
        expect(attack.mock.results[0]!.value).toMatchObject({ hit: true, triggeredRunic: 'slaying' });
        expect(monster.hp).toBe(0);
    });
});
