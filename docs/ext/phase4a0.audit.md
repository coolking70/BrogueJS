# 4a0 调用点迁移清单

> 基线 `ac92f66f4ef9205cdd5c34c1ade79e6d1d796c41`。下表逐行登记开工前候选，行号指基线；含声明、注释、非空间筛选与物品坐标，不能把候选总数当成独立算法数量。

分类：**改 footprint**＝身体占位/接触/距离/可见性使用通用几何；**仅改端口**＝现有调用转至统一查询或提交出口，既有 CE 策略/顺序保留；**保留单格坐标**＝格点、物品、锚点/射线起点、单格玩家或非空间身份筛选。

| 基线位置 | 分类 | 判定/理由 | 原调用摘录 |
|---|---|---|---|
| `src/engine/UI/ItemDetailEquipment.ts:94` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `if (!item.isProtected && monsters.some(m => monsterIsInClass(m.id, item.vorpalEnemy)` |
| `src/engine/UI/MonsterSidebar.ts:49` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `return monsters.filter(monster => canSeeMonster(player, grid, monster)` |
| `src/engine/Core/LevelSeeds.ts:28` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `} while (Math.max(Math.abs(upStairsLoc.x - downStairsLoc.x), Math.abs(upStairsLoc.y - downStairsLoc.y)) < Math.floor(DCOLS / 3));` |
| `src/engine/Core/WholeRunSnapshot.ts:182` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `monsters: graph.monsters.filter(m => !roots.includes(m)).map(serializeMonsterRow),` |
| `src/engine/Core/GenerationCoordinator.ts:139` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `ports.monsters = ports.monsters.filter(m => m !== mon);` |
| `src/engine/Core/GenerationCoordinator.ts:140` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `ports.dormantMonsters = ports.dormantMonsters.filter(m => m !== mon);` |
| `src/engine/Core/GenerationCoordinator.ts:162` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `item.loc = {...spawn.pos};` |
| `src/engine/Core/GenerationCoordinator.ts:180` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `item.entity.loc = {...bearer.loc};` |
| `src/engine/Core/GenerationCoordinator.ts:211` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `hasMonster: (x, y) => ports.monsters.some(m => m.hp > 0 && m.x === x && m.y === y),` |
| `src/engine/Core/GenerationCoordinator.ts:216` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const old = ports.monsters.find(m => m.hp > 0 && m.x === spawn.pos.x && m.y === spawn.pos.y);` |
| `src/engine/Core/GenerationCoordinator.ts:337` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `ports.player.loc = {x: 0, y: 0}; // CE removes the player during digDungeon.` |
| `src/engine/Core/GenerationCoordinator.ts:392` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `m.loc.x = spot.x;` |
| `src/engine/Core/GenerationCoordinator.ts:393` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `m.loc.y = spot.y;` |
| `src/engine/Core/GenerationCoordinator.ts:404` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `ports.player.loc = { ...exit };` |
| `src/engine/Core/GenerationCoordinator.ts:610` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `item.loc = { ...pos };` |
| `src/engine/Core/GenerationCoordinator.ts:749` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `// the player" 的时序一致，HAS_MONSTER 排除项才有数据可用。）` |
| `src/engine/Core/GenerationCoordinator.ts:791` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `&& !ports.getMonsterAt(pos.x, pos.y)` |
| `src/engine/Core/GenerationCoordinator.ts:792` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `&& !ports.dormantMonsters.some(m => m.hp > 0 && m.x === pos.x && m.y === pos.y)` |
| `src/engine/Core/GenerationCoordinator.ts:873` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `// HAS_MONSTER\|HAS_STAIRS\|HAS_ITEM\|IS_IN_MACHINE（HAS_PLAYER 不查——` |
| `src/engine/Core/GenerationCoordinator.ts:876` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `loc = null;` |
| `src/engine/Core/GenerationCoordinator.ts:882` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (ports.getMonsterAt(x, y)) return true;` |
| `src/engine/Core/GenerationCoordinator.ts:892` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `loc = cand;` |
| `src/engine/Core/GenerationCoordinator.ts:896` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `if (!loc) loc = heatMap.getItemSpawnLoc();` |
| `src/engine/Core/GenerationCoordinator.ts:898` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `loc = heatMap.getItemSpawnLoc();` |
| `src/engine/Core/GenerationCoordinator.ts:901` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `item.loc = { x: loc.x, y: loc.y };` |
| `src/engine/Core/GenerationCoordinator.ts:913` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `const loc = heatMap.getItemSpawnLoc();` |
| `src/engine/Core/EntitySnapshot.ts:125` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `monsters: graph.monsters.filter(v => v !== m).map(serializeMonsterRow),` |
| `src/engine/Core/TimeCoordinator.ts:82` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `getMonsterAt(x: number, y: number): Monster \| undefined;` |
| `src/engine/Core/TimeCoordinator.ts:346` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (!(ports.world.player.x === x && ports.world.player.y === y) && !ports.effects.getMonsterAt(x, y)` |
| `src/engine/Core/Game.ts:434` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `&& Math.max(Math.abs(entity.x-this.player.x), Math.abs(entity.y-this.player.y)) <= entity.interactionDistance` |
| `src/engine/Core/Game.ts:1571` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `if (spot) m.loc = spot;` |
| `src/engine/Core/Game.ts:1610` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `m.loc = { ...origin };` |
| `src/engine/Core/Game.ts:1614` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `if (spot) m.loc = spot;` |
| `src/engine/Core/Game.ts:1618` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `if (displaced) occupant.loc = displaced;` |
| `src/engine/Core/Game.ts:1654` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `*        !(pmap flags & (HAS_MONSTER \| HAS_STAIRS \| IS_IN_MACHINE)))；` |
| `src/engine/Core/Game.ts:1661` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.x = target.x;` |
| `src/engine/Core/Game.ts:1662` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.y = target.y;` |
| `src/engine/Core/Game.ts:1669` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.x = x;` |
| `src/engine/Core/Game.ts:1670` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.y = y;` |
| `src/engine/Core/Game.ts:1674` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `const loc = this.findQualifyingPathLocNear(target);` |
| `src/engine/Core/Game.ts:1676` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.x = loc.x;` |
| `src/engine/Core/Game.ts:1677` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.y = loc.y;` |
| `src/engine/Core/Game.ts:1689` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `*   - HAS_MONSTER → getMonsterAt；HAS_STAIRS → 楼梯地形；` |
| `src/engine/Core/Game.ts:1700` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (this.getMonsterAt(x, y)) return false;` |
| `src/engine/Core/Game.ts:1709` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* HAS_MONSTER\|HAS_STAIRS\|IS_IN_MACHINE、hallwaysAllowed=true、` |
| `src/engine/Core/Game.ts:1761` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `if (Math.max(Math.abs(dx!), Math.abs(dy!)) !== r) continue;` |
| `src/engine/Core/Game.ts:1898` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* 排除 CE 的占用约束 HAS_MONSTER / HAS_PLAYER / HAS_ITEM / IS_IN_MACHINE` |
| `src/engine/Core/Game.ts:1914` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `if (this.dormantMonsters.some(m => m.hp > 0 && m.x === x && m.y === y)) continue;` |
| `src/engine/Core/Game.ts:1915` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (this.getMonsterAt(x, y)) continue; // CE HAS_MONSTER` |
| `src/engine/Core/Game.ts:1916` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `if (this.player.loc.x === x && this.player.loc.y === y) continue; // CE HAS_PLAYER` |
| `src/engine/Core/Game.ts:2002` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `mon.loc = {...pos};` |
| `src/engine/Core/Game.ts:2055` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (this.getMonsterAt(nx, ny)) continue;` |
| `src/engine/Core/Game.ts:2080` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `\|\| this.getMonsterAt(x, y) \|\| (this.player.x === x && this.player.y === y)) continue;` |
| `src/engine/Core/Game.ts:2122` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `this.monsters = this.monsters.filter(m => m !== summoner);` |
| `src/engine/Core/Game.ts:2155` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `mon.loc = { x: dest.x, y: dest.y };` |
| `src/engine/Core/Game.ts:2203` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (this.getMonsterAt(x, y)) continue;` |
| `src/engine/Core/Game.ts:2224` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `const loc = this.findPeriodicSpawnLocation();` |
| `src/engine/Core/Game.ts:2269` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `const visibleMonsters = this.monsters.filter(m => {` |
| `src/engine/Core/Game.ts:2336` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const monster = this.getMonsterAt(x, y);` |
| `src/engine/Core/Game.ts:2421` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.x = entryX;` |
| `src/engine/Core/Game.ts:2422` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.y = entryY;` |
| `src/engine/Core/Game.ts:2759` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `/** CE getFOVMask 的 HAS_MONSTER\|HAS_PLAYER 遮挡谓词（Light.c:85）。 */` |
| `src/engine/Core/Game.ts:2762` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `return this.monsters.some((m) => m.hp > 0 && m.loc.x === x && m.loc.y === y);` |
| `src/engine/Core/Game.ts:3367` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `const primary = this.monsters.find(monster => monster.id === target.id)!;` |
| `src/engine/Core/Game.ts:3691` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `const defender = this.monsters.find(actor => actor.id === target.id && actor.hp > 0);` |
| `src/engine/Core/Game.ts:3694` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `&& Math.max(Math.abs(defender.x - this.player.x), Math.abs(defender.y - this.player.y)) === 1` |
| `src/engine/Core/Game.ts:3701` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `\|\| Math.max(Math.abs(target.x - this.player.x), Math.abs(target.y - this.player.y)) !== 1` |
| `src/engine/Core/Game.ts:3702` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `\|\| this.getMonsterAt(target.x, target.y)` |
| `src/engine/Core/Game.ts:3736` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `const monster = this.monsters.find(actor => actor.id === target.id)!;` |
| `src/engine/Core/Game.ts:3974` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `&& !this.getMonsterAt(this.player.loc.x+x, this.player.loc.y+y);` |
| `src/engine/Core/Game.ts:3984` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const blockingMonster = this.getMonsterAt(newX, newY);` |
| `src/engine/Core/Game.ts:4133` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const dist = Math.max(Math.abs(m.loc.x - newX), Math.abs(m.loc.y - newY));` |
| `src/engine/Core/Game.ts:4141` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (isItemCage && !this.getMonsterAt(newX, newY)) {` |
| `src/engine/Core/Game.ts:4233` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc = { x: newX, y: newY };` |
| `src/engine/Core/Game.ts:4236` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `if (this.depth === oldDepth) this.player.loc = origin;` |
| `src/engine/Core/Game.ts:4471` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `dropped.loc = { x: this.player.loc.x, y: this.player.loc.y };` |
| `src/engine/Core/Game.ts:5344` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const monster = this.getMonsterAt(p.x, p.y);` |
| `src/engine/Core/Game.ts:5349` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const monster = this.getMonsterAt(p.x, p.y);` |
| `src/engine/Core/Game.ts:5752` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `guardian.loc = at;` |
| `src/engine/Core/Game.ts:6775` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const monst = this.getMonsterAt(i, j); // CE :4919 HAS_MONSTER` |
| `src/engine/Core/Game.ts:6827` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* （CE 为 !T_OBSTRUCTS_PASSABILITY && !HAS_MONSTER）且 10% 掷骰命中时，` |
| `src/engine/Core/Game.ts:6845` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (!cell \|\| (cellTerrainFlags(this.grid, x, y) & T_OBSTRUCTS_PASSABILITY) \|\| this.getMonsterAt(x, y)) continue;` |
| `src/engine/Core/Game.ts:7032` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const monst = this.getMonsterAt(x, y);` |
| `src/engine/Core/Game.ts:7170` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `? this.player : this.getMonsterAt(pos.x, pos.y),` |
| `src/engine/Core/Game.ts:7193` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `thrown.loc = { ...dropLoc };` |
| `src/engine/Core/Game.ts:7652` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (!cell \|\| !cell.isPassable \|\| cell.isOpaque \|\| this.getMonsterAt(nx, ny)) break;` |
| `src/engine/Core/Game.ts:7653` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `target.loc.x = nx;` |
| `src/engine/Core/Game.ts:7654` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `target.loc.y = ny;` |
| `src/engine/Core/Game.ts:7669` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const other = this.getMonsterAt(target.x + ndx, target.y + ndy);` |
| `src/engine/Core/Game.ts:7752` | 改 footprint | mutuality 分伤名单的相邻实体判定使用足迹最短距离，保留 CE ≤1 口径 | `const hitList = this.monsters.filter(m =>` |
| `src/engine/Core/Game.ts:8056` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const m = cell ? this.getMonsterAt(tx, ty) : undefined;` |
| `src/engine/Core/Game.ts:8063` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `if (Math.max(Math.abs(m.loc.x - this.player.loc.x), Math.abs(m.loc.y - this.player.loc.y)) !== 1) continue;` |
| `src/engine/Core/Game.ts:8064` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `if (Math.max(Math.abs(m.loc.x - newX), Math.abs(m.loc.y - newY)) !== 1) continue;` |
| `src/engine/Core/Game.ts:8097` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const defender = this.getMonsterAt(tx, ty);` |
| `src/engine/Core/Game.ts:8139` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `actor.hp > 0 && actor.x === x && actor.y === y && this.getMonsterAt(x, y) === actor` |
| `src/engine/Core/Game.ts:8152` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const c = this.getMonsterAt(tx, ty);` |
| `src/engine/Core/Game.ts:8196` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const defender = this.getMonsterAt(tx, ty);` |
| `src/engine/Core/Game.ts:8233` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `goldItem.loc = { ...target.loc };` |
| `src/engine/Core/Game.ts:8441` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `* \`this.monsters = this.monsters.filter(m => m.hp > 0)\`）里找一个仍然` |
| `src/engine/Core/Game.ts:8458` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `return this.monsters.find(m =>` |
| `src/engine/Core/Game.ts:8461` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `Math.max(Math.abs(m.loc.x - this.player.loc.x), Math.abs(m.loc.y - this.player.loc.y)) === 1` |
| `src/engine/Core/Game.ts:8498` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `clone.loc = { ...spot };` |
| `src/engine/Core/Game.ts:8527` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const dist = Math.max(Math.abs(defender.loc.x - attacker.loc.x), Math.abs(defender.loc.y - attacker.loc.y));` |
| `src/engine/Core/Game.ts:8539` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const m = this.getMonsterAt(nx, ny);` |
| `src/engine/Core/Game.ts:8561` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (this.getMonsterAt(nx, ny)) continue;` |
| `src/engine/Core/Game.ts:8726` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc = { x, y };` |
| `src/engine/Core/Game.ts:8729` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `ally.loc = origin;` |
| `src/engine/Core/Game.ts:8735` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc = origin;` |
| `src/engine/Core/Game.ts:8736` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `ally.loc = allyOrigin;` |
| `src/engine/Core/Game.ts:8739` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `ally.loc = candidates[rng.randRange(0, candidates.length - 1)]!;` |
| `src/engine/Core/Game.ts:8992` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `const loc = this.grid.getCell(m.loc.x, m.loc.y);` |
| `src/engine/Core/Game.ts:9038` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `this.monsters = this.monsters.filter((m) => !fellOut.has(m));` |
| `src/engine/Core/Game.ts:9046` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* 落进深水），占用排除 = HAS_MONSTER \| HAS_ITEM \| HAS_STAIRS \|` |
| `src/engine/Core/Game.ts:9061` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (this.getMonsterAt(x, y)) return false;` |
| `src/engine/Core/Game.ts:9080` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;` |
| `src/engine/Core/Game.ts:9095` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `let loc = ringPick(landingOk);` |
| `src/engine/Core/Game.ts:9102` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `loc = dryLoc; // CE :836-838：游不出去 → 落到干地。` |
| `src/engine/Core/Game.ts:9106` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.x = loc.x;` |
| `src/engine/Core/Game.ts:9107` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc.y = loc.y;` |
| `src/engine/Core/Game.ts:9207` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const carried = this.getMonsterAt(x, y)?.carriedItem;` |
| `src/engine/Core/Game.ts:9226` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const carrier = this.getMonsterAt(x, y);` |
| `src/engine/Core/Game.ts:9271` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `passenger.loc = { ...m.loc };` |
| `src/engine/Core/Game.ts:9302` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `this.monsters = this.monsters.filter(m => m.hp > 0);` |
| `src/engine/Core/Game.ts:9303` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `this.dormantMonsters = this.dormantMonsters.filter(m => m.hp > 0);` |
| `src/engine/Core/Game.ts:9330` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `item.loc = { ...dest };` |
| `src/engine/Core/Game.ts:9348` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `drop.loc = { x, y };` |
| `src/engine/Core/Game.ts:9390` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `if (Math.max(Math.abs(x - item.x), Math.abs(y - item.y)) !== r) continue;` |
| `src/engine/Core/Game.ts:9393` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `\|\| cell.machineNumber \|\| this.getMonsterAt(x, y)` |
| `src/engine/Core/Game.ts:9404` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `item.loc = candidates[rng.randRange(1, candidates.length) - 1]!;` |
| `src/engine/Core/Game.ts:9472` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `if (Math.max(Math.abs(dest.x - x), Math.abs(dest.y - y)) === 1) {` |
| `src/engine/Core/Game.ts:9473` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `item.loc = dest;` |
| `src/engine/Core/Game.ts:9564` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `getMonsterAt: (x, y) => game.getMonsterAt(x, y),` |
| `src/engine/Core/Game.ts:9604` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `monsterAt: (x, y) => this.getMonsterAt(x, y),` |
| `src/engine/Core/Game.ts:9621` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `isOccupiedByMonster: (x, y) => this.getMonsterAt(x, y) !== undefined,` |
| `src/engine/Core/Game.ts:9689` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc = { x: 0, y: 0 };` |
| `src/engine/Core/Game.ts:9697` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.player.loc = position;` |
| `src/engine/Core/Game.ts:10187` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `\|\| Math.max(Math.abs(target.x-decodedPlayer.x),Math.abs(target.y-decodedPlayer.y)) > target.interactionDistance` |
| `src/engine/Core/Game.ts:10895` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `public getMonsterAt(x: number, y: number): Monster \| undefined {` |
| `src/engine/Core/Game.ts:10896` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `// CE clears HAS_MONSTER only after item placement and the death DF.` |
| `src/engine/Core/Game.ts:10897` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `return this.monsters.find(m => m.loc.x === x && m.loc.y === y` |
| `src/engine/Core/Game.ts:10919` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `creatures: () => [this.player, ...this.monsters.filter(m => !m.isDormant)]` |
| `src/engine/Core/Game.ts:10931` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `? this.player : this.monsters.find(m => m.hp > 0 && !m.isDormant && m.x === pos.x && m.y === pos.y);` |
| `src/engine/Core/Game.ts:11106` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `(x, y) => !!this.getMonsterAt(x, y) \|\| (this.player.x === x && this.player.y === y));` |
| `src/engine/Core/Game.ts:11107` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `const loc = ties.length ? ties[rng.randRange(0, ties.length - 1)]! : null;` |
| `src/engine/Core/Game.ts:11110` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `candidate.loc = loc;` |
| `src/engine/Core/Game.ts:11152` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `*   - **格被占（HAS_MONSTER \| HAS_PLAYER）则重新选址**（:4168-4181）——` |
| `src/engine/Core/Game.ts:11153` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `*     漏了这支会出现两只怪叠格（CE 的 HasMonster/HAS_PLAYER 在 web 分别是` |
| `src/engine/Core/Game.ts:11160` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* 睡下方向（:4200-4209）：从 monsters 摘到 dormantMonsters、清 HAS_MONSTER` |
| `src/engine/Core/Game.ts:11173` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `// CE :4168-4181：\`pmap.flags & (HAS_MONSTER \| HAS_PLAYER)\` → 占用` |
| `src/engine/Core/Game.ts:11174` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const occupied = !!this.getMonsterAt(monst.loc.x, monst.loc.y)` |
| `src/engine/Core/Game.ts:11180` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `// 随机"，HAS_PLAYER / HAS_MONSTER / HAS_STAIRS 一并回避）。web` |
| `src/engine/Core/Game.ts:11185` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `// CE 的判据里 HAS_PLAYER 是硬回避项；web 的` |
| `src/engine/Core/Game.ts:11198` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `monst.loc = relocated;` |
| `src/engine/Core/Game.ts:11207` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `// CE :4194 置 HAS_MONSTER——web 的 getMonsterAt 派生自本表，无需位。` |
| `src/engine/Core/Game.ts:11318` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `&& Math.max(Math.abs(m.x - this.player.x), Math.abs(m.y - this.player.y)) === 1` |
| `src/engine/Core/Game.ts:11483` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `this.monsters = this.monsters.filter((m) => !this.isInsideTestRoom(room, m.loc.x, m.loc.y));` |
| `src/engine/Core/Game.ts:11631` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `- Math.max(Math.abs(x - px), Math.abs(y - py)) * 10;` |
| `src/engine/Core/Game.ts:11748` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const occupant = this.getMonsterAt(landing.x, landing.y);` |
| `src/engine/Core/Game.ts:11751` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `if (!canPlaceCreature({ grid: this.grid, player: this.player, monsters: this.monsters.filter(m => m !== occupant), dormantMonsters: this.dormantMonsters }, caster, landing)) return false;` |
| `src/engine/Core/Game.ts:11753` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `caster.loc = { x: -1, y: -1 }; // CE temporarily removes the caster from occupancy.` |
| `src/engine/Core/Game.ts:11764` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (d > 0 && d <= distance && !this.getMonsterAt(x, y)` |
| `src/engine/Core/Game.ts:11771` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `} finally { caster.loc = origin; }` |
| `src/engine/Core/Game.ts:11772` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `if (home) occupant.loc = home; // CE relocation has no terrain-entry callback.` |
| `src/engine/Core/Game.ts:11791` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const distance = Math.max(Math.abs(target.loc.x - caster.loc.x), Math.abs(target.loc.y - caster.loc.y));` |
| `src/engine/Core/Game.ts:11821` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `target.loc.x = destination.x;` |
| `src/engine/Core/Game.ts:11822` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `target.loc.y = destination.y;` |
| `src/engine/Core/Game.ts:11893` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `isOccupied: (x, y) => !!this.getMonsterAt(x, y)` |
| `src/engine/Core/Game.ts:11902` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `monster.carriedItem.loc = { ...drop };` |
| `src/engine/Core/Game.ts:12033` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const sensedMonster = this.getMonsterAt(x, y);` |
| `src/engine/Core/Game.ts:12042` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const m = this.getMonsterAt(x, y);` |
| `src/engine/Core/Game.ts:12120` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `return !!cell && Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y)) === 1` |
| `src/engine/Core/Game.ts:12255` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const adjacent = (pos: Pos) => Math.max(Math.abs(pos.x - this.player.x), Math.abs(pos.y - this.player.y)) === 1;` |
| `src/engine/Core/Game.ts:12350` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (fight && (enemy!.hp <= 0 \|\| this.getMonsterAt(fight.loc.x, fight.loc.y) !== enemy)) this.autoFight = null;` |
| `src/engine/Combat/MonsterAI.ts:10` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const distance = (a: Creature, b: Creature) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));` |
| `src/engine/Combat/MonsterBlink.ts:32` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `const distance = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));` |
| `src/engine/Combat/MonsterBlink.ts:35` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `? g.player : g.getMonsterAt(p.x, p.y);` |
| `src/engine/Combat/MonsterBlink.ts:203` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const cell = g.grid.getCell(x,y)!, f = flags(g, { x,y }), occupant = g.getMonsterAt(x,y);` |
| `src/engine/Combat/MonsterBlink.ts:218` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `else { const occupant = g.getMonsterAt(x,y); if (occupant && monstersAreEnemies(g.player,occupant)) { map[x]![y] = 0; allyCosts[x]![y] = -1; } }` |
| `src/engine/Combat/MonsterBlink.ts:325` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const cell = g.grid.getCell(x,y)!, p = {x,y}, occupant = g.getMonsterAt(x,y);` |
| `src/engine/Combat/Polymorph.ts:6` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `return monsters.some(row => row.id === id);` |
| `src/engine/Combat/BlinkTargeting.ts:23` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `monsters.find(m => m.hp > 0 && !m.isDormant && m.x === p.x && m.y === p.y` |
| `src/engine/Combat/Cloning.ts:26` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* HAS_PLAYER blocks paths, HAS_MONSTER/HAS_STAIRS only block destinations.` |
| `src/engine/Combat/Cloning.ts:36` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `&& !playerAt(p) && !world.monsters.some(m => !m.isDormant && m.hp > 0 && m.x === p.x && m.y === p.y)` |
| `src/engine/Combat/Cloning.ts:62` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `if (Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) === r && qualifies({ x, y })) candidates.push({ x, y });` |
| `src/engine/Combat/Combat.ts:103` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `attackKind: 'melee', adjacent: Math.max(Math.abs(attacker.x - defender.x), Math.abs(attacker.y - defender.y)) === 1,` |
| `src/engine/Combat/Combat.ts:595` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `adjacent: Math.max(Math.abs(attacker.x - defender.x), Math.abs(attacker.y - defender.y)) === 1,` |
| `src/engine/Combat/Combat.ts:923` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `adjacent: Math.max(Math.abs(thrower.x - defender.x), Math.abs(thrower.y - defender.y)) === 1,` |
| `src/engine/Combat/BoltTrajectory.ts:36` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `const divisor = Math.max(Math.abs(dx), Math.abs(dy));` |
| `src/engine/Combat/BoltTargeting.ts:32` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `return monsters.filter(m => {` |
| `src/engine/Combat/BoltTargeting.ts:39` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `\|\| monsters.some(other => other !== m && other.hp > 0 && !other.isDormant && !other.submerged` |
| `src/engine/Combat/BoltTargeting.ts:47` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const distance = Math.max(Math.abs(m.loc.x - player.loc.x), Math.abs(m.loc.y - player.loc.y));` |
| `src/engine/Combat/BoltTargeting.ts:60` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const distance = (m: Monster) => Math.max(Math.abs(m.loc.x - player.loc.x), Math.abs(m.loc.y - player.loc.y));` |
| `src/engine/Combat/Conjuration.ts:31` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* Dormant monsters do not carry CE HAS_MONSTER and intentionally do not occupy.` |
| `src/engine/Combat/Conjuration.ts:38` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `&& !same(world.player.loc, p) && !world.monsters.some(m => m.hp > 0 && !m.isDormant && same(m.loc, p));` |
| `src/engine/Combat/Conjuration.ts:64` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `if (Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) === r && qualifies({ x, y })) candidates.push({ x, y });` |
| `src/engine/Combat/MonsterAbsorption.ts:44` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const cell = g.grid.getCell(x, y)!, flags = cellTerrainFlags(g.grid, x, y), occupant = g.getMonsterAt(x, y);` |
| `src/engine/Combat/MonsterAbsorption.ts:77` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `const roster = g.monsters.filter(m => m.hp > 0 && !m.deathProcessed && !m.isDormant && m !== decedent);` |
| `src/engine/Generator/GenerationPlacement.ts:32` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `if (Math.max(Math.abs(x-target.x),Math.abs(y-target.y))===r && grid.isValidPos(x,y) && qualifies(x,y)) pool.push({x,y});` |
| `src/engine/Generator/GenerationPlacement.ts:73` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `if(world.monsters.some(m=>m.hp>0&&m.x===x&&m.y===y` |
| `src/engine/Generator/BlueprintEngine.ts:762` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `/** CE randomMatchingLocation HAS_ITEM \| HAS_MONSTER during construction.` |
| `src/engine/Generator/BlueprintEngine.ts:1993` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* 吞入物品即整次失败，不能跳过该格另选。这里不检查 HAS_MONSTER、` |
| `src/engine/Generator/BlueprintEngine.ts:1994` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* HAS_PLAYER 或 HAS_STAIRS；它们不是 CE 前厅的否决条件。` |
| `src/engine/Generator/BlueprintEngine.ts:2088` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `tryAgain = true; // HAS_ITEM \| HAS_MONSTER \| IS_IN_MACHINE` |
| `src/engine/Generator/BlueprintEngine.ts:2419` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `// U19b CE audit: no HAS_ITEM/HAS_MONSTER/HAS_PLAYER/HAS_STAIRS gate` |
| `src/engine/Map/SafetyMap.ts:222` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `return Math.max(Math.abs(monst.loc.x - host.player.loc.x), Math.abs(monst.loc.y - host.player.loc.y)) <= 1;` |
| `src/engine/Map/WallDoorFinish.ts:118` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* 同款守卫保留）。CE 1938 的 HAS_MONSTER 守卫无 web 对应物：生成阶段` |
| `src/engine/Map/AutoGenerator.ts:548` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `*   3. 格无占用。CE 检查 HAS_PLAYER\|HAS_MONSTER\|HAS_STAIRS\|HAS_ITEM\|` |
| `src/engine/Map/AutoGenerator.ts:688` | 保留单格坐标 | 格点/物品/锚点或非空间资格、身份筛选；不据此推导身体占位 | `const loc = randomMatchingLocation(` |
| `src/engine/Map/Grid.ts:928` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* \`dormantMonsters\`，并清 HAS_MONSTER 改置本旗标；因此 HAS_MONSTER 的读取` |
| `src/engine/Map/Grid.ts:931` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `* web 的 HAS_MONSTER 等价物是 \`Game.getMonsterAt\`（按 this.monsters 现场` |
| `src/engine/Map/DungeonFeature.ts:142` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `// creatures are absent from HAS_MONSTER in CE and from this port's list.` |
| `src/engine/Map/DungeonFeature.ts:146` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `const creature = creatures.find(c => c.loc.x === x && c.loc.y === y);` |
| `src/engine/Map/DungeonFeature.ts:151` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `&& !creatures.some(c => c.loc.x === nx && c.loc.y === ny));` |
| `src/engine/Movement/AutoTravelVisibility.ts:11` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `monsters: new Set(monsters.filter(m => canSeeMonster(player, grid, m))),` |
| `src/engine/Movement/CreaturePlacement.ts:28` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* Dormant living creatures count as occupied too (stronger than CE HAS_MONSTER).` |
| `src/engine/Movement/CreaturePlacement.ts:65` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const stationary = world.monsters.some(m => !m.isDormant && m.hp > 0 && m.loc.x === x && m.loc.y === y` |
| `src/engine/Movement/CreaturePlacement.ts:123` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* HAS_MONSTER bit is cleared. Terrain blocks paths, but only occupied cells` |
| `src/engine/Movement/CreaturePlacement.ts:129` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `\|\| world.monsters.some(m => m !== ally && !m.isDormant && !m.deathProcessed && m.hp > 0 && m.x === x && m.y === y)` |
| `src/engine/Movement/CreaturePlacement.ts:163` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `if (Math.max(Math.abs(x - origin.x), Math.abs(y - origin.y)) !== radius` |
| `src/engine/Movement/LevelTravel.ts:27` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `else if (!placement && monsters.some(m=>m.hp>0 && m.x===x && m.y===y` |
| `src/engine/Movement/LevelTravel.ts:109` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `if(Math.max(Math.abs(x-origin.x),Math.abs(y-origin.y))===r && qualifies({x,y})) ties.push({x,y});` |
| `src/engine/Movement/LevelTravel.ts:129` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `if(!next) break;m.loc=next;` |
| `src/engine/Lighting/LightMap.ts:59` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* 生物遮挡谓词（CE getFOVMask 的 HAS_MONSTER\|HAS_PLAYER 参数：` |
| `src/engine/Items/Item.ts:180` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `this.loc = { x: -1, y: -1 };` |
| `src/engine/Items/ItemLoader.ts:1240` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `potion.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1256` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `scroll.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1270` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `foodItem.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1304` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `weapon.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1376` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `armor.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1426` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `wand.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1447` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `staff.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1469` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `ring.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1490` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `charm.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1522` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `key.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1535` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `gold.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1547` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `gem.loc = { x, y };` |
| `src/engine/Items/ItemLoader.ts:1558` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `amulet.loc = { x, y };` |
| `src/engine/Items/ItemUseCoordinator.ts:197` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `thrown.loc = { ...origin };` |
| `src/engine/Items/ItemUseCoordinator.ts:202` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `item.loc = { ...origin };` |
| `src/engine/Items/ItemUseCoordinator.ts:211` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `return monsters.find(m => m.hp > 0 && !m.isDormant && m.loc.x === pos.x && m.loc.y === pos.y);` |
| `src/engine/Items/ItemSpawnHeatMap.ts:385` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `/** CE HAS_PLAYER / HAS_MONSTER / HAS_STAIRS / HAS_ITEM 的占用查询。 */` |
| `src/entities/Monster.ts:102` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `return game.monsters.some(enemy => enemy.hp > 0 && boltEnemies(game.player, enemy, game)` |
| `src/entities/Monster.ts:229` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const dist = Math.max(Math.abs(caster.loc.x - target.loc.x), Math.abs(caster.loc.y - target.loc.y));` |
| `src/entities/Monster.ts:244` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `return game.getMonsterAt(x, y);` |
| `src/entities/Monster.ts:538` | 仅改端口 | CE 注释/查询契约；实际占位端口已迁移，不新增 Cell 位 | `* （HAS_MONSTER 清、HAS_DORMANT_MONSTER 置）+ 不获回合 + 不被` |
| `src/entities/Monster.ts:656` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `clone.loc = { ...this.loc };` |
| `src/entities/Monster.ts:1133` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `const candidates: Creature[] = [game.player, ...game.monsters.filter(m => m !== this && m.hp > 0)];` |
| `src/entities/Monster.ts:1194` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `if (this.seized && game.monsters.some(m => m !== this && m.hp > 0 && m.seizing` |
| `src/entities/Monster.ts:1196` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `&& Math.max(Math.abs(m.loc.x-this.loc.x), Math.abs(m.loc.y-this.loc.y)) === 1` |
| `src/entities/Monster.ts:1451` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `const k = Math.max(Math.abs(vx), Math.abs(vy));` |
| `src/entities/Monster.ts:1596` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `&& !game.getMonsterAt(p.x, p.y) && !(game.player.loc.x === p.x && game.player.loc.y === p.y);` |
| `src/entities/Monster.ts:1600` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const minDist = target ? Math.max(Math.abs(this.x - target.x), Math.abs(this.y - target.y)) : Infinity;` |
| `src/entities/Monster.ts:1686` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const distToPlayer = Math.max(Math.abs(this.x - game.player.x), Math.abs(this.y - game.player.y));` |
| `src/entities/Monster.ts:1691` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `.filter(p => this.canEnterMovementTerrain(game, p.x, p.y) && !game.getMonsterAt(p.x, p.y)` |
| `src/entities/Monster.ts:1700` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `canEnter: (x, y) => this.canEnterMovementTerrain(game, x, y) && !game.getMonsterAt(x, y)` |
| `src/entities/Monster.ts:1707` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `(x, y) => this.canEnterMovementTerrain(game, x, y) && !game.getMonsterAt(x, y));` |
| `src/entities/Monster.ts:1715` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const distToPlayer = Math.max(Math.abs(this.loc.x - game.player.loc.x), Math.abs(this.loc.y - game.player.loc.y));` |
| `src/entities/Monster.ts:1724` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (c && this.canEnterMovementTerrain(game, nx, ny) && !game.getMonsterAt(nx, ny) && !(game.player.loc.x === nx && game.player.loc.y === ny)) {` |
| `src/entities/Monster.ts:1743` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `return !game.getMonsterAt(x, y) && !(game.player.loc.x === x && game.player.loc.y === y);` |
| `src/entities/Monster.ts:1818` | 保留单格坐标 | 实体/生命/阵营/ID/可见资格筛选；空间碰撞另由已迁移端口负责 | `const blade = game.monsters.find(m => ((m.typeId === 'spectral_blade' && m.boundToPlayer) \|\| (m.dominated && m.isAlly))` |
| `src/entities/Monster.ts:1819` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `&& this.willAttackTarget(m) && Math.max(Math.abs(m.x - this.x), Math.abs(m.y - this.y)) === 1` |
| `src/entities/Monster.ts:1845` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const other = game.getMonsterAt(this.loc.x + dx!, this.loc.y + dy!);` |
| `src/entities/Monster.ts:1986` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (c && this.canEnterMovementTerrain(game, nx, ny) && !game.getMonsterAt(nx, ny) && !(game.player.loc.x === nx && game.player.loc.y === ny)) {` |
| `src/entities/Monster.ts:1987` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `const dist = Math.max(Math.abs(nx - game.player.loc.x), Math.abs(ny - game.player.loc.y));` |
| `src/entities/Monster.ts:2019` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `return this.canEnterMovementTerrain(game, x, y) && !game.getMonsterAt(x, y) && !(game.player.loc.x === x && game.player.loc.y === y);` |
| `src/entities/Monster.ts:2059` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `return this.canEnterMovementTerrain(game, x, y) && !game.getMonsterAt(x, y);` |
| `src/entities/Monster.ts:2070` | 改 footprint | 身体判断改为通用几何；普通 1×1 走原常数路径 | `&& Math.max(Math.abs(this.x - this.leader.x), Math.abs(this.y - this.leader.y)) > 2` |
| `src/entities/Monster.ts:2126` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (canEnter && !game.getMonsterAt(nx, ny) &&` |
| `src/entities/Monster.ts:2179` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `if (game.getMonsterAt(p.x, p.y) \|\| entrancementDiagonalBlocked(game.grid, this.loc, p)) return false;` |
| `src/entities/Monster.ts:2188` | 仅改端口 | 经兼容占位 facade；参数仍是接触格，死亡窗由 facade 保留 | `const occupied = game.getMonsterAt(nx, ny) \|\| (game.player.x === nx && game.player.y === ny);` |
| `src/entities/Monster.ts:2222` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.loc.x = nx;` |
| `src/entities/Monster.ts:2223` | 仅改端口 | 生物位置写入统一提交；保留替换或原地更新的原引用语义 | `this.loc.y = ny;` |
| `src/entities/Creature.ts:146` | 保留单格坐标 | 物品点坐标或未发布构造初值；物品不扩为身体 | `this.loc = { x, y };` |
| `src/ext/worldSpatial.ts:14` | 保留单格坐标 | 射线向量/格点扫描环/楼梯/物品/目标坐标的距离，单位与顺序保留 | `const distance = (a:{x:number;y:number},b:{x:number;y:number}) => Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));` |
| `src/ext/modules/growth/view.ts:317` | 保留单格坐标 | 单格 UI 呈现的可见格/检视查询；生产空间组件拒绝，身体呈现后续实施 | `if (game.monsters.some(monster => monster.x === x && monster.y === y && canDisplayMonster(game.player, game.grid, monster))) return false;` |
| `src/ext/modules/growth/view.ts:339` | 保留单格坐标 | 单格 UI 呈现的可见格/检视查询；生产空间组件拒绝，身体呈现后续实施 | `const creature = game.monsters.find(monster => monster.x === x && monster.y === y && canSeeMonster(game.player, game.grid, monster));` |
| `src/ui/displayProjection.ts:86` | 保留单格坐标 | 保留现有单格呈现/交互点；本步拒绝生产多格，身体组 UI 属 4a 后续 | `...game.monsters.filter(monster => canDisplayMonster(game.player, game.grid, monster)).map(monster => \`${monster.x},${monster.y}\`),` |
| `src/ui/nearbyInspection.ts:21` | 保留单格坐标 | 保留现有单格呈现/交互点；本步拒绝生产多格，身体组 UI 属 4a 后续 | `const monster = game.monsters.find(monster => monster.id === row.id)!;` |
| `src/components/AgentControls.vue:47` | 保留单格坐标 | 保留现有单格呈现/交互点；本步拒绝生产多格，身体组 UI 属 4a 后续 | `dist: Math.max(Math.abs(m.loc.x - activeGame.player.loc.x), Math.abs(m.loc.y - activeGame.player.loc.y))` |
| `src/components/GameCanvas.vue:635` | 保留单格坐标 | 保留现有单格呈现/交互点；本步拒绝生产多格，身体组 UI 属 4a 后续 | `...game.monsters.filter(monster => canDisplayMonster(game.player, game.grid, monster))` |
| `src/components/theme/ThemeNearby.vue:20` | 保留单格坐标 | 保留现有单格呈现/交互点；本步拒绝生产多格，身体组 UI 属 4a 后续 | `.map(row => ({ ...row, distance: Math.max(Math.abs(row.loc.x - p.x), Math.abs(row.loc.y - p.y)) }));` |

共 281 个检索候选：保留单格坐标 95；改 footprint 44；仅改端口 142。

补充语义审计（不在原正则候选中）：

| 入口 | 分类 | 判定 |
|---|---|---|
| `DungeonFeature.evacuateCreatures` 的 `Object.assign(loc, next)` | 仅改端口 | 真实 Game 端口提供 `occupies` 与 `commitPosition`；无生物的旧纯点测试端口保留点写入。 |
| `GenerationPlacement` / `BlinkTargeting` / `LevelTravel` 的 x/y 占位谓词 | 改 footprint | 查实际身体格，不再用实体锚点相等推断占位。 |
| `applyEnvironmentalEffects`、`creatureShouldFall`、爆炸/恶心/缠绕/地衣 | 仅改端口 | 4a0 的 `nativeContactOf`/能力预检明确只允许原生单格物理执行；不对 fixture 多格运行环境效果。完整 exposure reducer 属 4a。 |
| `Monster.takeTurn` / `polymorph` / `Game.cloneMonster` | 仅改端口 | 行动/变形/正式复制前拒绝未开放空间组件；raw clone 容器拷贝为未发布对象，保持深拷贝。 |
| `Scent` / `Pathfind` / `DijkstraMap` / `WaypointMap` / `MapToShore` | 保留单格坐标 | 位姿图本步不开放；原生生产全是 1×1，寻路格点/嗅觉源/岸距入口保留。不能据此声称 fixture 可寻路。 |
| 玩家 FOV 原点、光源/血迹/掉落/浮字/射线起点 | 保留单格坐标 | 这些是明确点源/锚点位置，不是整个身体的碰撞判断；玩家空间组件始终拒绝。 |
| `GameCanvas`、历史显示投影、侧栏聚焦/目标光标 | 保留单格坐标 | 不改 UI；生产多格拒绝，原生 fixture 仅机械查询，不发布新敌人/身体组显示。 |
| `Creature.constructor`、实体解码的 `Object.assign` | 保留单格坐标 | 未发布初始化；解码在创建候选世界前校验组件，真实 Game 禁用未来能力。 |
| 休眠、purgatory、pending、携带者列表迁移 | 仅改端口 | 原有名单所有权不改；生产入口拒绝空间组件，fixture 换名单必须调用 `replaceWorld` 重建使用者计数/失效缓存。 |

4a0 没有留下可由菜单启用但未经迁移的多格动作；多格环境、寻路、形态与复合体调度全部明确未开放。

收尾补充：`awakenDormantMonstersAt` 按 DF 原点或建成格集与足迹相交判定；`teleportCandidates` 在 actor-native FOV/距离图构造前拒绝空间组件。`WholeRunSnapshot` 的显式 native fixture 端口按当前/缓存楼层分别解码空间根和索引，拒绝跨层共享/拆群；pending、purgatory、携带的空间生命周期、区域解析仍未开放。
