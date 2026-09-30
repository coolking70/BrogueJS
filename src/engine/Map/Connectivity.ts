/**
 * src/engine/Map/Connectivity.ts — 关卡连通性验证（P1-29）
 *
 * CE 对照（CE reference / src/brogue/Architect.c）：
 * - lakeDisruptsPassability（2588-2636）：把候选湖**假想放置**之后，所有
 *   "干地"必须仍属同一个 flood-fill 连通块；任一干地格未被泛洪到，
 *   即判定"破坏连通性"，该放置位置必须拒绝。
 * - lakeFloodFill（2569-2586）：泛洪只在干地格之间传播。
 *
 * LAVA-1：四方向干地连通与 CE 一致。干地按四层 T_PATHING_BLOCKER
 * 判断，泛洪可穿过 TM_CONNECTS_LEVEL 的可开启机关，但不把机关算成干地。
 * 不可借助墙角对角线或既有熔岩/陷阱走廊证明湖泊安全。
 */
import { Grid, TerrainType } from './Grid';
import { blocksPassability, isDeepWater, T_PATHING_BLOCKER, TM_CONNECTS_LEVEL } from './TerrainCatalog';
import { cellTerrainFlags, cellTerrainMechFlags } from './DungeonFeature';

const DIRS4: ReadonlyArray<readonly [number, number]> = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export const DIRS8: ReadonlyArray<readonly [number, number]> = [
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
];

/** Game.canMoveTo（Game.ts）地形判据的镜像。
 *  p1_29_lake_connectivity.test.ts 把两者按 TerrainType 全枚举逐格比对钉死；
 *  改动 Game.canMoveTo 的排除清单时必须同步这里，反之亦然。
 *
 *  C-4a：改为查表实现——`!(T_OBSTRUCTS_PASSABILITY | T_IS_DEEP_WATER)`
 *  （TerrainCatalog.ts，CE Rogue.h:1924/1937）。对全部 TerrainType 与旧
 *  硬编码清单 {GRANITE, WALL, SECRET_DOOR, LOCKED_DOOR, WATER_DEEP} 逐位
 *  一致（c_4a_terrain_catalog.test.ts 的迁移安全性用例全枚举钉死）。 */
export function terrainAllowsMove(terrain: TerrainType): boolean {
    return !blocksPassability(terrain) && !isDeepWater(terrain);
}

/**
 * CE Architect.c:2588 lakeDisruptsPassability 的 web 对应物。
 * wouldBeLaked(x, y) === true 的格视作候选湖覆盖（假想已放置）；
 * 其余干地必须仍属同一个四方向连通块；可开启机关仅作泛洪连接。
 * 返回 true = 该放置会切断关卡，必须换位重试或放弃该湖。
 */
export function lakeDisruptsPassability(
    grid: Grid,
    wouldBeLaked: (x: number, y: number) => boolean
): boolean {
    const isDry = (x: number, y: number): boolean => {
        const cell = grid.getCell(x, y);
        return !!cell && !(cellTerrainFlags(grid, x, y) & T_PATHING_BLOCKER) && !wouldBeLaked(x, y);
    };

    // CE 从扫描到的第一个干地格起泛洪；全图无干地在 CE 是
    // brogueAssert(x != -1)。这里按"没有干地即没有干地可被切断"接受：
    // 楼梯/门不会被湖覆盖（候选集只含 FLOOR），实际到不了这个分支。
    let startX = -1;
    let startY = -1;
    let dryCount = 0;
    for (let x = 0; x < grid.width; x++) {
        for (let y = 0; y < grid.height; y++) {
            if (!isDry(x, y)) continue;
            dryCount++;
            if (startX === -1) {
                startX = x;
                startY = y;
            }
        }
    }
    if (startX === -1) return false;

    const seen = new Set<number>([startY * grid.width + startX]);
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    while (queue.length > 0) {
        const p = queue.pop()!;
        for (const [dx, dy] of DIRS4) {
            const nx = p.x + dx;
            const ny = p.y + dy;
            if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
            const key = ny * grid.width + nx;
            if (seen.has(key)) continue;
            if (wouldBeLaked(nx, ny)) continue;
            if ((cellTerrainFlags(grid, nx, ny) & T_PATHING_BLOCKER)
                && !(cellTerrainMechFlags(grid, nx, ny) & TM_CONNECTS_LEVEL)) continue;
            seen.add(key);
            queue.push({ x: nx, y: ny });
        }
    }

    // Connecting gates are visited but are not dry tiles (CE final scan).
    let reachedDry = 0;
    for (const key of seen) if (isDry(key % grid.width, Math.floor(key / grid.width))) reachedDry++;
    return reachedDry < dryCount;
}
