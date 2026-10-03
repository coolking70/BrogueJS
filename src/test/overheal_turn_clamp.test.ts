import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { CombatSystem } from '../engine/Combat/Combat';
import { advancementLoop, finishTurnEpilogue, type TimePorts } from '../engine/Core/TimeCoordinator';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { TerrainType } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';

function scene() {
    const game = createHeadlessGame(331003, 'test');
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    game.player.loc = { x: 10, y: 10 };
    game.player.inventory.items = [];
    game.player.equippedWeapon = null; game.player.equippedArmor = null;
    game.player.hp = game.player.maxHp = 30;
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, x >= 4 && x <= 20 && y >= 4 && y <= 20 ? TerrainType.FLOOR : TerrainType.GRANITE);
        game.grid.getCell(x, y)!.autoSearched = true;
    }
    return game;
}

function spawn(game: ReturnType<typeof scene>, id = 'vampire_bat') {
    const monster = new Monster(11, 10, monsters.find(m => m.id === id)! as MonsterData);
    monster.state = MonsterState.HUNTING;
    monster.accuracy = 100; monster.defense = 0;
    game.monsters.push(monster);
    return monster;
}

function equipTransference(game: ReturnType<typeof scene>, enchantment: number) {
    const ring = ItemLoader.spawnRing('ring_of_transference', -1, -1)!;
    ring.enchantment = enchantment; ring.identified = true;
    game.player.inventory.addItem(ring);
    game.player.equip(ring);
}

function ports(game: ReturnType<typeof scene>): TimePorts {
    return (game as unknown as { timePorts(): TimePorts }).timePorts();
}

function settle(game: ReturnType<typeof scene>) {
    for (let steps = 0; game.isAdvancing && steps < 10; steps++) game.stepAdvancement();
    expect(game.isAdvancing).toBe(false);
    expect(game.lastAdvancementError).toBeNull();
}

afterEach(() => vi.restoreAllMocks());

describe('CE Time.c:2721-2723 / 2862-2864 overheal settlement', () => {
    it.each([false, true])('positive ring permits attack-time overheal then clamps the same command, animation=%s', animated => {
        const game = scene(); game.animationEnabled = animated;
        equipTransference(game, 2);
        const target = spawn(game, 'goblin');
        target.hp = target.maxHp = 100; target.ticksUntilTurn = 10000;
        const attack = CombatSystem.attack;
        const attackHp: number[] = [];
        vi.spyOn(CombatSystem, 'attack').mockImplementation((attacker, defender, options) => {
            const result = attack(attacker, defender, options);
            if (attacker === game.player) {
                expect(result.hit).toBe(true);
                attackHp.push(game.player.hp);
            }
            return result;
        });
        game.executeCommand('move', { x: 1, y: 0 }); settle(game);
        expect(attackHp).toEqual([31]); // CE Combat.c:1858-1860 minimum +1, no immediate cap.
        expect(game.player.hp).toBe(game.player.maxHp);
        expect(game.stats.turns).toBe(1);
        expect(game.recordedInputEvents).toHaveLength(1);
    });

    it('MA_TRANSFERENCE overheal survives its attack and is capped before its next real action', () => {
        const game = scene(), bat = spawn(game);
        game.player.hp = game.player.maxHp = 200;
        bat.ticksUntilTurn = 100;
        const takeTurn = bat.takeTurn.bind(bat);
        const before: number[] = [], after: number[] = [];
        vi.spyOn(bat, 'takeTurn').mockImplementation((...args) => {
            before.push(bat.hp); takeTurn(...args); after.push(bat.hp);
        });
        game.executeCommand('wait');
        expect(after[0]).toBeGreaterThan(bat.maxHp);
        expect(bat.hp).toBe(after[0]);
        game.executeCommand('wait');
        expect(before).toEqual([bat.maxHp, bat.maxHp]);
        expect(after[1]).toBeGreaterThan(bat.maxHp);
    });

    it('does not cap a monster whose turn is still pending', () => {
        const game = scene(), bat = spawn(game);
        bat.hp = bat.maxHp + 5; bat.ticksUntilTurn = 200;
        bat.setStatusDuration('paralyzed', 10);
        game.executeCommand('wait');
        expect(bat.hp).toBe(bat.maxHp + 5);
        game.executeCommand('wait');
        expect(bat.hp).toBe(bat.maxHp);
    });

    it.each(['paralyzed', 'entranced', 'captive', 'activation'] as const)('caps before the %s action gate, including captive item dropping', gate => {
        const game = scene(), bat = spawn(game);
        bat.hp = bat.maxHp + 5; bat.ticksUntilTurn = 100;
        if (gate === 'paralyzed' || gate === 'entranced') bat.setStatusDuration(gate, 10);
        if (gate === 'activation') bat.behaviorFlags.add('MONST_GETS_TURN_ON_ACTIVATION');
        if (gate === 'captive') {
            bat.isCaged = true;
            bat.carriedItem = ItemLoader.spawnRing('ring_of_transference', 11, 10)!;
            const bridge = game as unknown as { makeMonsterDropItem(monster: Monster): void };
            const drop = bridge.makeMonsterDropItem.bind(game);
            vi.spyOn(bridge, 'makeMonsterDropItem').mockImplementation((monster: Monster) => {
                expect(monster.hp).toBe(monster.maxHp); drop(monster);
            });
        }
        const turn = vi.spyOn(bat, 'takeTurn');
        game.executeCommand('wait');
        expect(bat.hp).toBe(bat.maxHp);
        expect(turn).not.toHaveBeenCalled();
    });

    it('negative transference kills a one-HP player even with a protection shield', () => {
        const game = scene(); equipTransference(game, -2);
        game.player.hp = 1;
        game.player.setStatusDuration('shielded', 100);
        const target = spawn(game, 'goblin');
        target.hp = target.maxHp = 100; target.ticksUntilTurn = 10000;
        game.executeCommand('move', { x: 1, y: 0 });
        expect(game.player.hp).toBe(0);
        expect(game.isGameOver).toBe(true);
        expect(game.gameOverWon).toBe(false);
        expect(game.recordedInputEvents).toHaveLength(1);
    });

    it('keeps both RNG streams unchanged at the isolated player and monster settlement points', () => {
        const game = scene(), bat = spawn(game);
        const time = ports(game);
        game.ticksTillUpdateEnvironment = 10000; game.player.ticksUntilTurn = 100;
        game.player.hp = game.player.maxHp + 5;
        bat.hp = bat.maxHp + 5; bat.ticksUntilTurn = 100;
        bat.setStatusDuration('paralyzed', 10);
        const before = rng.getState();
        for (const _pause of advancementLoop(time, 10)) { /* synchronous */ }
        finishTurnEpilogue(time);
        expect(game.player.hp).toBe(game.player.maxHp);
        expect(bat.hp).toBe(bat.maxHp);
        expect(rng.getState()).toEqual(before);
    });

    it('lets environmental damage consume temporary excess HP before player settlement', () => {
        const game = scene(); game.player.hp = game.player.maxHp + 5;
        game.grid.setTerrain(10, 10, TerrainType.STEAM);
        const recovery = game.player.recoverPerTurn.bind(game.player);
        const observed: number[] = [];
        vi.spyOn(game.player, 'recoverPerTurn').mockImplementation((...args) => {
            observed.push(game.player.hp); return recovery(...args);
        });
        game.executeCommand('wait');
        expect(observed).toEqual([33]); // steam deals maxHP/15 before the cap.
        expect(game.player.hp).toBe(game.player.maxHp);
    });

    it('caps after objective effects and before an in-loop player fall', () => {
        const game = scene(); game.player.hp = game.player.maxHp + 5;
        game.player.setStatusDuration('levitating', 1);
        game.player.setStatusDuration('slowed', 100); // second objective block sees expired levitation.
        game.grid.setTerrain(10, 10, TerrainType.CHASM);
        const fall = vi.spyOn(game as any, 'playerFalls').mockImplementation(() => {
            expect(game.player.hp).toBe(game.player.maxHp);
        });
        game.executeCommand('wait');
        expect(fall).toHaveBeenCalledOnce();
    });

    it('returns on game end before capping HP or processing an in-loop fall', () => {
        const game = scene(); game.player.hp = game.player.maxHp + 5;
        game.player.ticksUntilTurn = 100;
        const time = ports(game);
        time.effects.objectiveTimeBlock = () => { game.isGameOver = true; (game as any).playerFalling = true; };
        const fall = vi.fn(); time.effects.playerFalls = fall;
        for (const _pause of advancementLoop(time, 10)) { /* synchronous */ }
        expect(game.player.hp).toBe(game.player.maxHp + 5);
        expect(fall).not.toHaveBeenCalled();
        finishTurnEpilogue(time);
        expect(game.player.hp).toBe(game.player.maxHp + 5);
    });
});
