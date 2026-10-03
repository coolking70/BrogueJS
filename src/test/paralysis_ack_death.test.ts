import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { CombatSystem } from '../engine/Combat/Combat';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { GasType } from '../engine/Environment/Gas';
import { TerrainType } from '../engine/Map/Grid';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';

function scene() {
    const game = createHeadlessGame(331003, 'test');
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    game.player.loc = { x: 10, y: 10 };
    game.player.inventory.items = [];
    game.player.equippedWeapon = null; game.player.equippedArmor = null;
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, x >= 4 && x <= 20 && y >= 4 && y <= 20 ? TerrainType.FLOOR : TerrainType.GRANITE);
        game.grid.getCell(x, y)!.autoSearched = true;
    }
    logger.reset();
    return game;
}

function attackScene(hp = 1) {
    const game = scene();
    const ring = ItemLoader.spawnRing('ring_of_transference', -1, -1)!;
    ring.enchantment = -2; ring.identified = true;
    game.player.inventory.addItem(ring); game.player.equip(ring);
    game.player.hp = hp; game.player.setStatusDuration('shielded', 100);
    const target = new Monster(11, 10, monsters.find(m => m.id === 'goblin')! as MonsterData);
    target.state = MonsterState.HUNTING;
    target.hp = target.maxHp = 100; target.defense = 0; target.ticksUntilTurn = 10000;
    target.setStatusDuration('stuck', 5); // deterministic hit, no accuracy RNG
    game.monsters.push(target);
    return { game, target };
}

afterEach(() => { vi.restoreAllMocks(); logger.presentAcknowledgments(null); });

describe('CE paralysis acknowledgment transitions', () => {
    it('gas refresh keeps duration/RNG but only first exposure and a new episode prompt', () => {
        const game = scene();
        const bridge = game as unknown as { applyEnvironmentalEffects(target: Monster | typeof game.player): void };
        game.environment.addGas(10, 10, GasType.PARALYSIS, 1000);
        logger.presentAcknowledgments(() => true);
        const random = rng.getState();
        bridge.applyEnvironmentalEffects(game.player);
        expect(logger.pendingAcknowledgment?.text).toBe('You are paralyzed!');
        expect(game.player.getStatusDuration('paralyzed')).toBe(20);
        logger.acknowledgeNext();
        game.player.setStatusDuration('paralyzed', 19);
        bridge.applyEnvironmentalEffects(game.player);
        expect(game.player.getStatusDuration('paralyzed')).toBe(20);
        expect(logger.pendingAcknowledgment).toBeUndefined();
        expect(logger.messages.filter(m => m.acknowledge).map(m => m.count)).toEqual([1]);
        expect(rng.getState()).toEqual(random);
        game.player.setStatusDuration('paralyzed', 0);
        bridge.applyEnvironmentalEffects(game.player);
        expect(logger.pendingAcknowledgment?.text).toBe('You are paralyzed!');
        expect(logger.messages[0]?.count).toBe(2);
        expect(rng.getState()).toEqual(random);
    });

    it('timed player refresh preserves its applied result without another generic ACK', () => {
        const game = scene();
        logger.presentAcknowledgments(() => true);
        const random = rng.getState();
        expect(game.applyMonsterOnHitStatus(game.player, 'test caster', 'paralyzed', 3)).toBe(true);
        logger.acknowledgeNext();
        expect(game.applyMonsterOnHitStatus(game.player, 'test caster', 'paralyzed', 5)).toBe(true);
        expect(game.player.getStatusDuration('paralyzed')).toBe(5);
        expect(logger.pendingAcknowledgment).toBeUndefined();
        expect(logger.messages.filter(m => m.acknowledge).map(m => m.count)).toEqual([1]);
        expect(rng.getState()).toEqual(random);
    });
});

describe('CE Combat.c:1872-1875 cursed transference', () => {
    it.each([false, true])('ends inside the real attack before victim HP loss, animation=%s', animated => {
        const { game, target } = attackScene(); game.animationEnabled = animated;
        const attack = CombatSystem.attack;
        const observed: boolean[] = [];
        vi.spyOn(CombatSystem, 'attack').mockImplementation((...args) => {
            const result = attack(...args);
            observed.push(game.isGameOver);
            expect(target.hp).toBe(100);
            expect(result.hit).toBe(true);
            return result;
        });
        game.executeCommand('move', { x: 1, y: 0 });
        expect(observed).toEqual([true]);
        expect(game.player.hp).toBe(0);
        expect(game.player.getStatusDuration('shielded')).toBe(100);
        expect(game.gameOverReason).toBe('Drained by a cursed ring on depth 1.');
        expect(game.stats.kills).toBe(0);
        expect(game.recordedInputEvents).toHaveLength(1);
    });

    it('surviving negative transfer still inflicts victim damage', () => {
        const { game, target } = attackScene(10);
        game.executeCommand('move', { x: 1, y: 0 });
        expect(game.isGameOver).toBe(false);
        expect(game.player.hp).toBe(9);
        expect(target.hp).toBeLessThan(100);
    });

    it('keeps the survivor runic path after fatal transfer (inflictDamage returns false)', () => {
        const { game, target } = attackScene();
        const weapon = ItemLoader.spawnWeapon('dagger', -1, -1)!;
        weapon.runicType = 'paralyzing'; weapon.enchantment = 50; weapon.identified = true;
        game.player.inventory.addItem(weapon); game.player.equip(weapon);
        game.executeCommand('move', { x: 1, y: 0 });
        expect(game.isGameOver).toBe(true);
        expect(target.hp).toBe(100);
        expect(target.hasStatus('paralyzed')).toBe(true);
        expect(game.stats.kills).toBe(0);
    });

    it('fatal transfer leaves a one-HP victim alive and never records a kill', () => {
        const { game, target } = attackScene(); target.hp = 1;
        game.executeCommand('move', { x: 1, y: 0 });
        expect(game.isGameOver).toBe(true);
        expect(target.hp).toBe(1);
        expect(game.getMonsterAt(11, 10)).toBe(target);
        expect(game.stats.kills).toBe(0);
    });

    it('throw damage follows the same immediate death and survivor result', () => {
        const { game, target } = attackScene();
        const dart = ItemLoader.spawnWeapon('dart', -1, -1)!; dart.quantity = 3;
        game.player.inventory.addItem(dart);
        game.executeItemCommand('throw', dart);
        game.executeCommand('mouse_travel', { x: target.x, y: target.y });
        expect(game.isGameOver).toBe(true);
        expect(game.gameOverReason).toBe('Drained by a cursed ring on depth 1.');
        expect(target.hp).toBe(100);
        expect(game.stats.kills).toBe(0);
        expect(dart.quantity).toBe(2);
    });

    it('staff damage stops victim HP loss at the same transfer boundary', () => {
        const { game, target } = attackScene();
        const staff = ItemLoader.spawnStaff('staff_of_lightning', -1, -1)!;
        staff.identified = true; staff.charges = 2;
        game.player.inventory.addItem(staff);
        game.executeItemCommand('use', staff);
        game.executeCommand('mouse_travel', { x: target.x, y: target.y });
        expect(game.isGameOver).toBe(true);
        expect(game.gameOverReason).toBe('Drained by a cursed ring on depth 1.');
        expect(target.hp).toBe(100);
        expect(game.stats.kills).toBe(0);
        expect(staff.charges).toBe(1);
    });

    it('restores the owning-run death handler after loading a snapshot', () => {
        const { game, target } = attackScene();
        const saved = game.toSnapshot();
        expect(game.loadSnapshot(saved)).toBe(true);
        game.executeCommand('move', { x: 1, y: 0 });
        expect(game.isGameOver).toBe(true);
        expect(game.gameOverReason).toBe('Drained by a cursed ring on depth 1.');
        expect(game.monsters.find(m => m.id === target.id)?.hp).toBe(100);
    });
});
