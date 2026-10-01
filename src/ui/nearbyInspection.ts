/** UI-4: the sidebar opens the same display models used by right-click/long
 * press inspection. Return a detail without assigning Game.inspectTarget,
 * issuing a command, changing knowledge, or consuming either random stream. */
import type { Game } from '../engine/Core/Game';
import { sidebarEntityRows, type SidebarEntityRow } from '../engine/UI/MonsterSidebar';
import { generateMonsterDetail, generateItemDetail, type DetailInfo } from '../engine/UI/DetailGenerator';
import { createItemDetailContext } from '../engine/UI/ItemDetailContext';
import { describeTerrain } from '../engine/UI/TerrainTextCatalog';

export function nearbyDetail(game: Game, requested: SidebarEntityRow): DetailInfo | null {
    // Recheck the polled row against current visibility and identity. A moved,
    // removed or newly hidden entity must not reveal its replacement/location.
    const row = sidebarEntityRows(game.player, game.grid, game.monsters, game.items, game.hoveredCell, game.depth)
        .find(row => row.kind === requested.kind && row.id === requested.id
            && row.loc.x === requested.loc.x && row.loc.y === requested.loc.y);
    if (!row) return null;
    if (row.kind === 'monster') {
        const monster = game.monsters.find(monster => monster.id === row.id)!;
        const player = game.player;
        const [n, d] = (player.equippedWeapon?.damage ?? '1d2').split('d').map(Number);
        return generateMonsterDetail(monster, player.hp, player.effectiveStrength, 0,
            [n || 1, (n || 1) * (d || 2)], player.equippedWeapon?.enchantment ?? 0,
            player.equippedWeapon?.strengthRequired ?? 12, player.equippedArmor?.armor ?? 0,
            player.equippedArmor?.enchantment ?? 0, player.equippedArmor?.strengthRequired ?? 0,
            player.hasStatus('hallucinating'), player.getStatusDuration('donning'), player.hasStatus('stuck'));
    }
    if (row.kind === 'item') {
        const item = game.items.find(item => item.id === row.id)!;
        return generateItemDetail(item, createItemDetailContext(game, item));
    }
    const cell = game.grid.getCell(row.loc.x, row.loc.y)!;
    const terrain = describeTerrain({ visible: { layers: cell.layers, atDungeonExit: game.depth === 1 } });
    if (!terrain) return null;
    return { char: row.char, color: Number.parseInt(row.color.slice(1), 16), name: terrain.description,
        sections: [{ lines: terrain.flavor ? [{ text: terrain.flavor }] : [{ text: terrain.description }] }] };
}
