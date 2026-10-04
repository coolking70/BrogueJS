/** Reusable live fixture, also importable through Vite in the dev browser.
 * Setup is deliberately diagnostic, outside the input/recording protocol.
 * The actual trap, gas, attacks and death use one ordinary movement command. */
import type { Game } from '../../engine/Core/Game';
import { TerrainType as T } from '../../engine/Map/Grid';
import { Monster, MonsterState, type MonsterData } from '../../entities/Monster';
import monsters from '../../data/monsters.json';

export function setupDialogD3Scene(game: Game, animationEnabled = true) {
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    game.visibleItems.clear(); game.visibleMonsters.clear();
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, x >= 8 && x <= 16 && y >= 8 && y <= 12 ? T.FLOOR : T.GRANITE);
        const cell = game.grid.getCell(x, y)!;
        Object.assign(cell, { isVisible: false, hasMemory: false, isExplored: false,
            isClairvoyantVisible: false, isMagicMapped: false, isDiscovered: false, machineNumber: 0 });
    }
    game.environment.gasGrid.forEach(column => column.forEach(gas => { gas.density = 0; gas.type = 0; }));
    game.player.loc = { x: 10, y: 10 };
    game.player.hp = game.player.maxHp = 36;
    game.player.equippedWeapon = null; game.player.equippedArmor = null;
    game.player.statusDurations = {}; game.player.maxStatus = {};
    game.grid.setTerrain(11, 10, T.GAS_TRAP_PARALYSIS_HIDDEN);
    game.grid.getCell(11, 10)!.machineNumber = 901;
    game.grid.setTerrain(11, 9, T.MACHINE_PARALYSIS_VENT_HIDDEN);
    game.grid.getCell(11, 9)!.machineNumber = 901;
    const attacker = new Monster(12, 10, { ...monsters.find(monster => monster.id === 'goblin')!,
        hp: 1000, damage: '1d2', accuracy: 100, defense: 0 } as MonsterData);
    attacker.state = MonsterState.HUNTING;
    attacker.statusImmunities.add('paralyzed');
    attacker.ticksUntilTurn = 100;
    game.monsters.push(attacker);
    game.animationEnabled = animationEnabled;
    game.onConfirmRequest = () => true;
    (game as unknown as { updateVision(): void }).updateVision();
    // Hand-arranged worlds cannot claim to be a complete seed recording.
    (game as unknown as { recordingFromNewGame: boolean }).recordingFromNewGame = false;
    return { from: { x: 10, y: 10 }, plate: { x: 11, y: 10 }, attacker };
}
