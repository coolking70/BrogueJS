import { bodyDecisionActor } from '../Status/BodyStatuses';
import { footprintOf, footprintSome } from '../Movement/CreatureSpatial';
import type { Pos } from '../../types';
import type { Creature } from '../../entities/Creature';
import { hiddenBySubmersion } from '../Movement/Submersion';
import { Player } from '../../entities/Player';
import type { Monster } from '../../entities/Monster';
import { DungeonLayer, TerrainType, type Grid } from '../Map/Grid';

/** CE Monsters.c:166-252: identity and location are separate kinds of knowledge. */
export function monsterRevealed(player: Player, monster: Monster): boolean {
    return monster.hasStatus('entranced')
        || (player.hasStatus('telepathy') && !monster.hasBehavior('MONST_INANIMATE'));
}

export function monsterHidden(grid: Grid, monster: Monster, observer?: Creature): boolean {
    if (monster.isDormant) return true;
    if (bodyDecisionActor(monster).isAlly) return false;
    const inGas = monster.spatial && observer instanceof Player
        ? footprintSome(monster, p => !!grid.getCell(p.x, p.y)?.isVisible && hasGasAt(grid, p)) : monsterInGas(grid, monster);
    return (monster.hasStatus('invisible') && !inGas) || hiddenBySubmersion(grid, monster, observer);
}

function hasGasAt(grid: Grid, at: Pos): boolean {
    const gas = grid.getCell(at.x, at.y)?.layers[DungeonLayer.GAS];
    return gas !== undefined && gas !== TerrainType.NOTHING;
}

/** Per-cell public geometry. Seeing a body or a gas outline grants identity,
 * never knowledge of its unobserved cells. A reveal grants the existing single
 * location marker, not a full body topology. Pure, no RNG or memory writes. */
export function publicMonsterCells(player: Player, grid: Grid, monster: Monster): readonly Pos[] {
    if (monster.hp <= 0 || monsterHidden(grid, monster, player)) return [];
    const invisible = monster.hasStatus('invisible') && !bodyDecisionActor(monster).isAlly;
    const visible = footprintOf(monster).filter(p => !!grid.getCell(p.x, p.y)?.isVisible && (!invisible || hasGasAt(grid, p)));
    return visible.length ? visible.map(p => ({ x: p.x, y: p.y })) : monsterRevealed(player, monster) ? [{ ...monster.loc }] : [];
}

export function monsterInGas(grid: Grid, monster: Monster): boolean {
    return footprintSome(monster, p => {
        const gas = grid.getCell(p.x, p.y)?.layers[DungeonLayer.GAS];
        return gas !== undefined && gas !== TerrainType.NOTHING;
    });
}

export function canSeeMonster(player: Player, grid: Grid, monster: Monster): boolean {
    if (monster.spatial) return publicMonsterCells(player, grid, monster).length > 0;
    if (monster.hp <= 0 || monsterHidden(grid, monster, player)) return false;
    return footprintSome(monster, p => !!grid.getCell(p.x, p.y)?.isVisible) || monsterRevealed(player, monster);
}

export function canDirectlySeeMonster(player: Player, grid: Grid, monster: Monster): boolean {
    if (monster.spatial) return publicMonsterCells(player, grid, monster).some(p => !!grid.getCell(p.x, p.y)?.isVisible);
    return monster.hp > 0 && !monsterHidden(grid, monster, player)
        && footprintSome(monster, p => !!grid.getCell(p.x, p.y)?.isVisible);
}

/** A revealed but hidden creature has a location marker, never an identity. */
export function canDisplayMonster(player: Player, grid: Grid, monster: Monster): boolean {
    return monster.hp > 0 && (canSeeMonster(player, grid, monster) || monsterRevealed(player, monster));
}

export function canSeeMonsterAt(player: Player, grid: Grid, monster: Monster, at: Pos): boolean {
    return monster.spatial ? publicMonsterCells(player, grid, monster).some(p => p.x === at.x && p.y === at.y)
        : canSeeMonster(player, grid, monster);
}
export function canDisplayMonsterAt(player: Player, grid: Grid, monster: Monster, at: Pos): boolean {
    return monster.spatial ? canSeeMonsterAt(player, grid, monster, at)
        || (monster.hp > 0 && monsterRevealed(player, monster) && monster.x === at.x && monster.y === at.y)
        : canDisplayMonster(player, grid, monster);
}
