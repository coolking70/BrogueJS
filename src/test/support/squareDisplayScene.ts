import type { Game } from '../../engine/Core/Game';
import { TerrainType as T } from '../../engine/Map/Grid';
import { commitCreatureAnchor } from '../../engine/Movement/CreatureSpatial';
import { EnvironmentManager } from '../../engine/Environment/Gas';
import { WaypointSystem } from '../../engine/Map/WaypointMap';
import { MonsterState, type MonsterData } from '../../entities/Monster';
import monsters from '../../data/monsters.json';
import { logger } from '../../engine/Systems/Logger';

export function squareDisplayScene(game: Game, size: 2 | 3 = 3) {
    game.animationEnabled = false; game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, x > 0 && y > 0 && x < game.grid.width - 1 && y < game.grid.height - 1 ? T.FLOOR : T.WALL);
        Object.assign(game.grid.getCell(x, y)!, { isVisible: true, hasMemory: true, isClairvoyantVisible: false,
            machineNumber: 0, rememberedItem: null, isMagicMapped: false });
    }
    commitCreatureAnchor(game.player, { x: 16, y: 12 }); game.player.hp = game.player.maxHp = 10000;
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    (game as any).machineCells = new Set(); (game as any).monsterSpawnFuse = 100000;
    (game as any).bindDungeonFeatureEffects();
    const data = { ...monsters.find(m => m.id === 'rat')!, hp: 300, behaviorFlags: ['MONST_IMMOBILE'] } as MonsterData;
    const monster = game.createSquareMonster(data, size, { x: 12, y: 11 })!;
    monster.state = MonsterState.HUNTING; monster.ticksUntilTurn = 10000; monster.regenTurns = 0;
    game.hoveredCell = null; game.hoveredText = ''; logger.reset();
    return monster;
}
