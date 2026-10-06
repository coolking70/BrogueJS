# 5A3 任务书：结构性质（cellProperties）、运行期 region、房间原语与通用 RestPoint

> 基线：**5A2 与 5A2-S 均已合入后的 `ext/phase5`（维护者开工时填写确切 commit：`________`）**。工作分支 `ext/phase5`。推荐顺序 5A2 → 5A2-S → 5A3（同一本地主笔顺序执行，共享 `Game.ts`/`runtime.ts`）；若维护者决定 5A3 先于 5A2-S，见 §1 R12。可与 dot 的 5B（只写 `src/ext/modules/crafting/**`）并行。
> 依据（均已批准）：`docs/ext/phase5-settlement-world.md`（§6 结构/建造/房间全部、§7.3 通用 RestPoint 段、§12、§14.1 的 5A3 行）、`docs/ext/phase5a-contract.md`（C5-1 r2；本步读 §2、§4、§5.3、§5.5–§5.6、**§6、§7**、§10.1、§11 第 5 条）、`docs/ext/phase5a0.report.md`（§4 拆分表 5A3 行、§7 r2 修订）、`docs/ext/phase5a2.report.md`（“交接给 5A3”：`setOwnedRegions`、interactable 子预算余量、工作位/交互线实现位置）、`docs/ext/phase5a2s.report.md`（`native.regeneration` 用法）。
> 本步只交付**底座能力 + foundation fixture**，不交付营地产品、不开放玩家公开建造命令（5C1 由 settlement 适配）。开发期门禁按 P5-D14=A。**不要 commit。**
> 维护者 2026-10-06 对本任务书的全部预先裁定表态“全部按推荐”（记录见[阶段 5 设计 §15](phase5-settlement-world.md#15-待维护者决定推荐不是批准)）。

## 0 开工核对（不通过先停下报告）

1. 5A2、5A2-S 已合入；记录当前 foundation 号（预期 8）、whole-run v5、录像 4；`worldSdk.ts` 的 SHA-256 与 5A2 报告冻结值一致（本步不得改变它，见 R2）。
2. 复核代码事实（行号以 `2cd10a5` 为参考，按语义重定位并写实际行号）：`Grid.ts` 的 `refreshTerrainProperties` / `setTerrainLayer` / `setTerrain`；`DungeonFeature.ts`、`Promotion.ts`、`Environment/Gas.ts` 既经 setter 也直接写层/volume；`ext/regions.ts` 的 `validOwnedRegions`（非空数组、≤128、id 递增、depth-only 矩形、不重叠）与 `runtime.ts` 中 owned region 发布（region 与 interactable 共用实体分配器）；`ext/world.ts:69` 一类的“region 与 interactable 不同 ID”检查；`ext/worldSpatial.ts` 的 `interactablePlacementCells` / `hasInteractionLine`；`WorldRestProduction.ts` 篝火中断谓词；5A2 的 `adjacent-passable` 工作位实现位置。
3. `git log` 记录基线与干净工作区。通读合同 §6、§7 与设计 §6 后再动手。

## 1 预先裁定（开工前已定，不再回问）

| # | 事项 | 裁定 |
| --- | --- | --- |
| R1 | 版本 | foundation 号 **+1**（预期 8→9；结构根、region 的 `revision`/`campSlotId`、RestPoint 根改变 foundation 格式）；whole-run 仅当共用外壳/实体字段变化才升（预期不升）；录像格式不变；`World5Snapshot.schema` 仍为 1（其内容合法性绑定 foundation 号）；既有模块版本不改 |
| R2 | SDK 冻结 | 合同 §9 与 `src/ext/worldSdk.ts` **逐字不变**（5B 正在基于它开发）。结构/RestPoint 定义按合同 §6 末句扩展 `WorldDefinitionPack`，以**可选键** `structures?: readonly StructureDefinition[]`、`restPoints?: readonly RestPointDefinition[]` 加入（缺省等于空、`worldSdk` 仍为 1）；这两个类型与扩展后的 pack 类型从**新的可信/底座入口**导出，不改 `worldSdk.ts`。规则指纹对缺省键**不归一为空数组**，保证不含这两键的现有包（骨架、dot 的 crafting）指纹不变——须有测试 |
| R3 | 产品边界 | 不新增任何玩家公开命令（build/dismantle/door/rest 的公开适配归 5C1 settlement）。本步通过 foundation 测试 fixture（id `c5fixture`，沿 5A2）与 harness 的可信 scope 驱动全部写口；`planRest` 的端到端玩家路径用 fixture 的一个测试专用 `ext:command` 适配证明，不进生产 catalog |
| R4 | 运行期 region 即营地区域 | C5-1 中经 `planRegionChange` 创建的 region 都是营地区域：`create` 时分配 **最小空闲 `campSlotId`（0…7）** 并写入 OwnedRegion（运行期 region 专有字段；生成期 region 没有）；同一 slot 拆建复用（合同 §3.4 seedKey 依赖稳定 slot），slot 的创建/事件高水位另存不归零。全局营地 ≤8、同层 ≤1、site 也占名额（本步无 site） |
| R5 | region 尺寸 | `create` 的 bounds 必须**恰为 9×9** 且完全在地图内边界内，否则 `C5_BLOCKED`；`expand` 新 bounds 必须包含旧 bounds、≤24×20、不与其他 region 重叠；范围格 ≤480（24×20 即上限） |
| R6 | OwnedRegion 新字段 | 所有 region 新增 `revision`（生成期 region 初值 0，CAS 用，合同 §6）；运行期 region 另有 `campSlotId`。最后一个 region 撤销时**删除 `regions` 键**（用 5A2 的 `setOwnedRegions`，合同 M2） |
| R7 | 关闭的门 | 按合同 §6：关闭门 = 墙的性质（挡移动/视线/普通弹道/气液）；开启门恢复基础地面性质。**本版本怪物 AI 不开结构门**（视为墙），开关只经 `planStructureChange({kind:'door'})`，耗时由调用方命令承担（5C1 适配原生门动作）。原生 DOOR 地形行为不变 |
| R8 | 火对结构 | 可燃（`flammable:true`）部件所在格在 `cellProperties.flammable` 中为真，参与原生火蔓延判定；该格存在原生火时，每个 100 tick 客观块对该格每个可燃部件施加 `damageKind:'fire'` 伤害 `max(1, floor(maxHp × (100 − resistances.fire) / 1000))`（0 抗性约 10 块烧毁）。此公式是 foundation 规则，进入指纹；具体建材数值归 5C1 数据 |
| R9 | DF/Promotion 落在结构格 | 原生 DF/Promotion 照常写基础层；若结果使该格基础地面**不再是稳定可通行地面**（深水/熔岩/裂隙/实心墙等），同一边界对该格全部部件提交“地基失效”损毁意图（删除部件，关联物品/票据按损毁规则处理）；否则结构保留。不以 `setTerrain` 清层建墙，不抹已有水气 |
| R10 | 物理伤害来源 | 本步结构物理伤害只来自可信 `damage` 意图（fixture）与 R9；怪物攻击结构属 5E1，不做 |
| R11 | 保护格与逃生 | 照合同 §6 M4 列表；“唯一逃生路线”定义为：从玩家当前位置与每个已登记居民位置到本层任一楼梯/出口的四/八邻可通行路径（与原生寻路同对角规则），施工后至少保留一条；不可见格不作精确阻挡反馈（统一 `C5_BLOCKED`/`C5_PROTECTED`，不泄露未见实体） |
| R12 | 回血 | RestPoint 休息复用 auto_rest 语义，原生回血读 `native.regeneration`（5A2-S）。若 5A3 先于 5A2-S 执行，则读原生 `regenRatePerTurn`，并在报告“交接 5A2-S”中列出该读取点 |
| R13 | RestPoint 定义校验 | `maxRestTicks` 100…30000 且为 100 的倍数，`interactionDistance` 0…16，`restorePolicy.hp ∈ {'native-over-time','none'}`、`optionalCombatResources:'none'`、`resetPolicy:'none'`；`full-on-complete`/`provider-on-complete` 一律拒绝（合同 §7） |
| R14 | 房间重算时机 | 每次结构批量提交后全层重算（79×29 有界）；结果是会话派生缓存（`sessionRoomId`），不持久、load/seek 重建；不引入增量拓扑缓存 |
| R15 | generation 读者 | 生成期不存在结构，生成代码中的地形读者归类为“基础类型读者”可保留；但只要共用 helper 被改动，就必须跑 `test:drift` 证明生成不变 |

## 2 推荐顺序与可停下的子里程碑

### 5A3a 读写入口清单与 cellProperties 内核（零结构恒等）

- **先交清单**：对 `src/**`（非测试）中所有地形/机械性质读取（`cellHasTerrainFlag`、`terrainFlagsOfCell`、`cellHasTMFlag`、`isPassable`、`isOpaque`、`cellHasTerrainType`、直接 `layers[...]`、`terrainMechFlags` 等，基线粗计 30+ 文件，`Game.ts`、`DungeonFeature.ts`、`Promotion.ts`、`Gas.ts`、`Grid.ts`、`Monster.ts`、`LightMap.ts`、`FOV.ts`、`worldSpatial.ts`、战斗射线/闪现/身体感知等）逐条分类为：**基础类型读者**（问“这是什么地形”，可保留）/ **机械阻挡读者**（问“能否通过/看见/扩散/燃烧”，必须改走 cellProperties）/ **写入口**（必须改为提交意图）。分类表写入报告附录，是本步验收物。
- `cellProperties(level, at, scope)`（合同 §6 `CellProperties`）：在基础四层之上合成结构性质；**零结构格返回值与旧基础 flags 逐位相同**（含位宽/符号规则）；热路径无结构时走快速路径。`terrainRevision` 递增规则写明。
- 按清单把全部机械阻挡读者迁移到合成性质：passability、FOV/光照、怪物 AI/路径/逃跑、玩家寻路/自动探索、scent、射线/法术/闪现、DF/Promotion 判定、Gas/液体扩散、记忆/渲染、巨兽全足迹与位姿（合同 §6“不能只迁 FOV/玩家寻路”）。
- **停点验收**：无结构的全部回归（UR2/UR3/UR4、drift、巨兽自然 trace、气体/液体/火/DF 测试）逐值不变；性能对照（FOV/寻路/气体扩散每回合耗时）。

### 5A3b 结构根、写入意图、统一失效与损毁

- world5 开放 `structures`（稀疏 `StructureCell`，合同 §6；部件 `StructureComponent.id` 为 WorldId）；每格 floor/barrier/roof/fixture 各 ≤1，barrier 三种互斥，门 `doorOpen` 仅 door 非 null；HP=0 同损毁事务删除部件。
- 定义：R2 的 `structures` 定义校验（合同 §6、§10.1：maxHp 1…1000000、抗性 0…100、返还分子 0…分母 1…10000、`containerCapacity` 仅 fixture 1…64、`stationDefinitionId/restPointDefinitionId` 仅 fixture 且引用已启用定义）。
- `planStructureChange`（build/door/dismantle/damage）：可信入口，一次一格；build 同事务创建关联 interactable 与 ContainerRecord/StationRecord/RestPoint（结构格坐标为权威，interactable x/y 为镜像，load 校验相等）；dismantle 返还 `floor(originalCount × hp/maxHp × 1/2)`；关联票据/物品/退款在同一事务解决，不留孤儿；箱损毁先合法稳定近邻落地，剩余入该层 remains（合同 §5.5）。
- 机械性质照合同 §6：墙/关闭门挡移动/视线/普通弹道/气液；窗挡移动/普通弹道/液体、透视线与气体；地板不封气水、不使深水/熔岩/裂隙变安全；屋顶仅覆盖/日照；魔法弹道由定义 `magicProjectile` 决定。R7–R9。
- 统一失效：一次提交覆盖 terrain revision、空间/位姿、路线、房间、light/FOV、记忆、loop/waypoint；提交失败恢复原对象与全部派生索引。
- 预算（合同 §10.1）：每营地结构格 ≤384、全局 ≤3072、部件 ≤12288，共格只算一结构格。
- 工位绑定：5A2 独立台可原子绑定 fixture 部件（`boundComponentId`），几何只有一份可写来源。

### 5A3c 运行期 region 事务

- `planRegionChange`（create/expand/retire，合同 §6 `RegionChange`）：RegionId=EntityId、共用 128 上限与唯一 bounds、与 interactable 不同 ID；R4–R6；create/expand 不伪造 generation token，重验真实层、地图边界、不重叠、设施/工位、全足迹与逃生（R11）；CAS 用 `region.revision`。
- retire：非空营地须先处理全部关联（本步 fixture 下为结构/箱/台/RestPoint/票据）——有未解决关联返回 `C5_RESERVED`，不自动删除；最后一个 region 撤销删除 `regions` 键；slot 高水位不归零；撤销最后营地后已访问层与生成身份保留（合同 §2.2）。
- 普通居民不自动绑定 movementRegionId（本步无居民，写入断言/测试即可）。

### 5A3d 房间原语

- `identifyRooms(level, scope)`（合同 §6 `RoomRead`、设计 §6.3）：全层 79×29 四邻域 flood fill；天然墙、墙、门框、窗为边界，门的开闭不改拓扑；候选 2…128 稳定地面格、不触外边/开放通道；每格有效屋顶才完整；无对角角洞连接；地下天然顶不算屋顶；标签 bedroom（床）/warehouse（箱）/workshop（台/合法工位，炉另需通风）；首版通风 = 房间边界至少一扇完好窗或开放门通向非同室稳定空气格。
- 屋顶无支持立即失效住房/工坊资格（不砸人、不连锁掉落）。
- 只读、零时间、0 RNG；公开已知投影另裁剪（本步只提供可信入口与 fixture 测试）。

### 5A3e RestPoint

- world5 开放 `restPoints`（合同 §7 `RestPoint`，身份 = interactable EntityId；`boundComponentId` 可绑 fixture 部件）；`planRestPointPlacement`（独立放置，可信入口）与结构 fixture 的 `restPointDefinitionId` 两条创建路径；子预算 RestPoint ≤64（5A2 已预留）。
- `planRest`：资格（同层、`interactionDistance`、交互线、无已知威胁、无未终结 ticket）与 CAS（`restPointRevision`）；提交后进入与 auto_rest 相同的逐步续作（每步一条录制 `auto_step` = 一次 wait，原生每回合回血/饥饿照常），上限 `maxRestTicks/100` 步；满血/disturbed/伤害/离开距离/目标毁坏即停；不建 bundle、不建 ticket、不清饥饿/毒、不刷新敌人/物品、不保命；停止时写一条 owner 收据（completed/interrupted），`lastUseOrdinal` 单调。
- autoAction 新增 kind（如 `rest_point`）须更新 U03 登记；其停止同样遵守 5A2 的 stopAutoTravel 审计规则（命令内停止才写收据；非命令路径不写）。
- **combat 篝火保持 combat 所有**（合同 §7 第 1 条）：不转换、不建 world5 记录。
- 回血读取按 R12。

### 5A3f 不变量回归与组合

- **工作位/交互线逐格不变**（合同 §11 第 5 条）：建立回归 fixture——在 5A3a 迁移**之前**（用本步开工基线）对骨架/`c5fixture` 场景中每个节点/工位/RestPoint/箱 fixture 记录 `adjacent-passable` 工作位集合与每格 `hasInteractionLine` 结果（存为测试 JSON，附捕获方法与基线 commit），迁移后逐格比较；任何差异即失败（否则 dot 已录 crafting trace 失效）。
- 篝火：无 combat 的 RestPoint 与有 combat 的篝火分别 save/load/replay/seek/中断恢复；二者同局共存互不干扰。
- 骨架 harness 完整闭环摘要与 5A2-S 交付时一致（除版本外壳）。

## 3 非目标（出现即越界）

- settlement 内容/命令/UI/数值、玩家公开 build/dismantle/door/rest 命令、营地撤销 UI、居民、订单、袭击（5C/5D/5E）。
- 怪物攻击结构、AI 开结构门、任意采墙/桥/多层建筑（设计 P5-D09=A 范围外）。
- site 生成与 LevelRef 化的 region/interactable/bundle（5C2）；region 继续 `depth: number`。
- 改 §9 SDK/`worldSdk.ts`；改属性管线；改生成算法；新增 npm 依赖。

## 4 必须保持的不变量

1. **零结构恒等**：没有任何结构的局，所有机械读取、生成、RNG 流、UR2/UR3/UR4、巨兽自然 trace 逐值不变；经典局录像成本不增加。
2. **单一几何来源**：结构格坐标权威，interactable/工位/箱/RestPoint 坐标是镜像且 load 校验；一个对象一个 ID。
3. **完整迁移**：不存在“只迁 FOV 未迁 gas/DF”的半状态；新增源码守卫：机械阻挡类读取只能经 cellProperties（白名单为基础类型读者清单）。
4. **事务**：结构/region/RestPoint 提交任一发布点失败 → 完整对象图、派生索引、ID、RNG、消息恢复（独立写集差分）；损毁/拆卸不吞物、不留孤儿；退款只一次。
5. **工作位/交互线逐格不变**（5A3f）。
6. `regions` 键永不为空数组；slot/ordinal 高水位不归零。
7. SDK 不变（R2），crafting/骨架包指纹不变。

## 5 必测场景（登记 `scripts/test-suites.json` 底座清单，命名 `ext_structure_*`、`ext_region_runtime_*`、`ext_rooms_*`、`ext_rest_point_*`）

性质与迁移：
- 每类机械读者在墙/关闭门/开启门/窗/地板/屋顶/fixture 上的行为：移动、玩家寻路与自动探索、怪物追击/逃跑/寻路、FOV/光照/记忆、scent、普通弹道与魔法弹道、闪现、气体扩散（窗透气、墙挡气）、液体扩散、火蔓延（R8）、DF/Promotion（R9：稳定与不稳定两种结果）、渲染。
- 巨兽：全足迹与位姿不能挤进/穿过结构；巨兽场地合法通路不被结构封死。
- 零结构：全部上述读者与旧值逐位相同（含大种子集抽样）。

结构事务：
- build 每种部件、共格组合（floor+barrier+roof+fixture）、barrier 互斥、保护格每一类（楼梯/D40/机器/impregnable/生物全足迹/地面 Item/任何 interactable 及其唯一工作位/唯一逃生路线）拒绝、不可见格统一反馈；预算 384/3072/12288 边界。
- door 开关性质切换与失效；dismantle 返还公式（满血/半血/1 HP）；damage 至 0 删除部件；箱损毁落地 + remains 托管守恒；台/RestPoint 损毁时关联票据取消退款一次；地基失效（R9）。
- 失效：每次提交后路线/房间/FOV/空间缓存与全量重算一致；失败注入后派生索引恢复。

region：
- create 9×9（越界/重叠/保护/逃生失败）、expand（不含旧 bounds、超 24×20、重叠）、retire（有关联拒绝、清空后成功）；8 营地/同层 1/全局 128 边界；slot 最小空闲分配与复用、高水位不归零；**最后一个 region 撤销后 `regions` 键被删除，save/load 往返后仍无该键且世界校验通过**；生成期 region 的 `revision` 初值与 CAS。

房间：
- 2 格与 128 格边界、129 格不成房、触外边/开放通道不成房、对角角洞不连通、破顶失效、天然顶不算、门开闭不改拓扑、通风有/无、多标签同室、重算确定性（同输入同输出）。

RestPoint：
- 定义校验（R13 每条拒绝）；planRest 资格与 CAS（STALE/DISTANCE/THREAT/BUSY）；auto_rest 续作每步一条 `auto_step`、上限步数、满血/disturbed/伤害/离开/目标毁坏停止并写收据一次；不清饥饿/毒；save/load/replay/seek 批间恢复；与 combat 篝火同局共存。

回归：
- 5A3f 工作位/交互线逐格不变；骨架 harness 闭环；R2 指纹不变。

## 6 预计改动的共享文件

`src/engine/Map/Grid.ts`、`TerrainRules.ts`、`DungeonFeature.ts`、`Promotion.ts`、`LoopMap.ts`、新 `src/engine/Map/StructureWorld.ts`（合同 §2 指定的结构可信入口）；`src/engine/Environment/Gas.ts`（及液体扩散）；`src/engine/Lighting/FOV.ts`、`LightMap.ts`；`src/engine/Movement/*`（`PlayerTravel`、`SpatialRevision`、`FootprintExposure`、`CreatureSpatial`/位姿、寻路）；`src/entities/Monster.ts`（AI 读取）；`src/engine/Combat/BoltTrajectory.ts`、`BlinkTargeting.ts`、`MonsterBlink.ts`、`BodyPerception.ts`、`ActorCombatResolution.ts`；`src/engine/UI/Appearance.ts`、`MonsterVisibility.ts`、DisplayFrame/PresentationObserver 相关；`src/engine/Core/Game.ts`、`GenerationCoordinator.ts`（仅失效/重访接线，不改生成）、`WorldRestProduction.ts`、`WholeRunSnapshot.ts`；`src/ext/regions.ts`、`world.ts`、`worldSpatial.ts`、`world5.ts`、`runtime.ts`、`types.ts`、`compatibility.ts`、`fingerprint.ts`、`src/ext/testing/**`（fixture 扩展）；foundation locale；`scripts/u03-state-contract.json`、`scripts/recording-digest-contract.json`、`scripts/test-suites.json`、`scripts/check-module-boundaries.mjs`（若加源码守卫）。

- 生成目录（`src/engine/Generator/**`、`AutoGenerator`、`LakeSystem` 等）原则上只读；若共享 helper 改动波及它们，R15 + drift。
- 黄金/trace：零结构下应不变；任何变化先单变量归因，不得因“迁移”整体重录。

## 7 门禁（开发期相关功能，P5-D14=A）

环境同 5A2。每个子里程碑停下前跑相关部分，最终全部跑：

1. `node scripts/check-module-boundaries.mjs`
2. `npx vue-tsc -b`
3. `npm run build`
4. 本步新增测试 + 直接受影响：地形/寻路/FOV/光照/气体/液体/火/DF/Promotion/scent/射线/闪现/怪物 AI/渲染相关原生测试（按 5A3a 清单逐文件列出）；giants 全部自有测试（全足迹/位姿/场地/自然 trace）；combat 篝火与身体动作测试；`u_r2/u_r3/u_r4_trace`、`u_03*`、`u_27_recording`、`x2a`、`x3b_*`、`ext_recording_v4_*`、`ext_world5_*`、`ext_world_work_*`、`ext_world_harness_*`、`ext_stats_*`、`ext_foundation*`、`ext_module_composition`、`ext_compatibility_diagnostics`。
5. **`npm run test:drift`**（R15；共享地形 helper 改动必须证明生成不变）。若 drift 需要 CE 源码则先 `npm run ce:fetch`；CE 局部规则档中地形/气体/火相关用例一并运行并在报告注明。
6. 真实组合 smoke（engine-only）：空、四模块各单独、四模块全开、骨架+四模块全开、`c5fixture`（含结构/region/RestPoint 场景）单独、`c5fixture`+combat+giants；每组新局/游玩/save/load/逐条 replay/seek/续录。
7. 性能：零结构与预算内满结构（3072 格）两档下 FOV/寻路/气体扩散/房间重算耗时，录像每命令新增成本 P95 与 5A2-S 对照。

不跑完整 `npm test`、全部 `test:ext`、removal 矩阵（留 5Z）。失败处理同 5A2 §7。

## 8 交付

- 代码与测试（**不 commit**），以及 `docs/ext/phase5a3.report.md`：
  - 基线 commit、§0 核对与实际行号、最终版本表、U03/摘要域登记。
  - **5A3a 读写入口分类表**（每条：文件:行、读取内容、分类、处理、覆盖测试）。
  - 逐子项 done/not-done（5A3a–f）；自定细节列表。
  - 工作位/交互线回归 fixture 的捕获方法、基线 commit 与比较结果。
  - 每条门禁实际命令、退出码、数量、耗时；drift 结果；失败与修复；反事实证据；重录逐字段归因（预期无）。
  - 性能实测。
  - 交接给 5C1：settlement 需要的公开命令适配点（build/dismantle/door/rest/region）、R4–R5 营地规则、R8 火公式、保护格/逃生定义、房间标签接口；未覆盖项标“未验证”。
- 原始证据放仓库外；**不要 commit / push**；README 仅可在报告完成后追加一行。
