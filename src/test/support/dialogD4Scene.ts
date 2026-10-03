/** Diagnostic browser fixture. Aim/use/confirm still cross the normal command
 * boundary; this hand-arranged world is not a complete seed recording. */
import type { Game } from '../../engine/Core/Game';
import { TerrainType as T } from '../../engine/Map/Grid';
import { ItemLoader } from '../../engine/Items/ItemLoader';

export function setupDialogD4Scene(game: Game, animationEnabled = true) {
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    game.visibleItems.clear(); game.visibleMonsters.clear();
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, x >= 8 && x <= 28 && y >= 8 && y <= 12 ? T.FLOOR : T.GRANITE);
        const cell = game.grid.getCell(x, y)!;
        Object.assign(cell, { isVisible: false, hasMemory: false, isExplored: false,
            isClairvoyantVisible: false, isMagicMapped: false, isDiscovered: false, machineNumber: 0 });
    }
    game.environment.gasGrid.forEach(column => column.forEach(gas => { gas.density = 0; gas.type = 0; }));
    game.player.loc = { x: 10, y: 10 };
    game.player.hp = game.player.maxHp = 100;
    game.player.statusDurations = {}; game.player.maxStatus = {};
    game.player.inventory.items = []; game.player.equippedWeapon = null; game.player.equippedArmor = null;
    game.player.ringLeft = null; game.player.ringRight = null;
    // E=2 lands at x=16 (safe), while the known lava at x=13 creates possible
    // death for an unknown range. The safe far bank excludes certain death.
    game.grid.setTerrain(13, 10, T.LAVA);
    const item = ItemLoader.spawnStaff('staff_of_blinking', -1, -1)!;
    Object.assign(item, { enchantment: 2, maxCharges: 2, charges: 2,
        identified: false, maxChargesKnown: false, staffRechargeRemaining: 1000 });
    game.player.inventory.addItem(item);
    ItemLoader.identify('staff_of_blinking');
    game.animationEnabled = animationEnabled;
    (game as unknown as { updateVision(): void }).updateVision();
    for (let x = 10; x <= 28; x++) {
        const cell = game.grid.getCell(x, 10)!;
        cell.hasMemory = true; cell.rememberedLayers = [...cell.layers];
    }
    (game as unknown as { recordingFromNewGame: boolean }).recordingFromNewGame = false;
    return { item, aim: { x: 20, y: 10 }, landing: { x: 16, y: 10 } };
}
