# 4a-1 执行报告：方形移动规划与体型寻路底座子里程碑

基线：`ext/phase4`，`399df979f991434441182373c2fbc022645cab10`。依据 [任务书](phase4a1.task.md) 与 [设计稿](phase4-giants.md) §4.1、§8 实施。未 commit、未 push，原有任务书未修改。

**4a-1 整体尚未完成。** 本次按任务书“改动过大时可在干净子里程碑停下并说明剩余项”交付可独立验收的空间移动规划、体型寻路与缓存通知底座。没有部分移除 Game 防线：生产发布、命令、NPC 行动、环境和加载仍沿用 4a0 的拒绝；多格 Monster 尚不能在真实 Game 中行动。后续必须完成全部入口接线及环境、落点、持久化合同，才能按任务书开放真实 Game。

## 已实现与能力边界

| 能力 | 原生 fixture 空间服务 | 真实 Game |
|---|---|---|
| square-2 / square-3 的锚点一步、整体 fit、自旧格重叠 | 已实现 | 仍拒绝空间组件 |
| 多格保守对角，目的与两个正交中间身体均 fit | 已实现；图边与移动用同一谓词 | 未接 NPC 移动 |
| 一步计划与原子提交，陈旧计划/新碰撞/失去活跃资格拒绝 | 已实现 | 未接命令耗时及环境 |
| 体型地形图、接触目标集合、显式锚点目标集合 | 已实现 | 未接追击/游荡/逃跑/回归 |
| 实时占位复核，一次地图有界重规划或等待 | 已实现 | 未接 NPC 选择 |
| 地形类型变更通知，门/Promotion/DF/气体类型失效 | 已实现 | 通知钩子已安装；普通 Game 不启动观察 |
| 任意 mask、旋转、复合体、zone、region、actionLock | 4a0 几何/codec fixture 保留；新增可执行方形入口拒绝 | 仍拒绝 |
| 落点/击退/拉拽/瞬移/召唤/克隆/变形/坠落/换层/pending/唤醒 | 本次未迁移各真实入口；保留 4a0 通用落点事务 | 未开放多格 |
| FootprintExposure、效果去重、多机关、深水、死亡掉落 | 未实现 | 未开放多格 |
| square 的真实 Game save/load/replay/seek/续录 | 未实现；原 4a0 纯 codec fixture 不变 | 未开放多格 |

`planStepPlacement` 接受独立、无 zone、无额外组件字段的 `builtin:square-2/3`、r0；普通无组件单格 fixture 保持既有墙角旗标语义。它只规划和提交位置，不提交 movementSpeed、NPC 回合或玩家命令。因此不能把这些 fixture 的移动位置验收说成真实 Monster.takeTurn 已可用。

提交前重新验两个正交中间身体；即使占位者只从 HP=0 恢复到存活、没有位置 revision，也不能穿过它。计划单次消费，失败保持 loc 容器及坐标，成功沿用原地修改 loc 的语义。源锚点假设与活实体位置分离，不临时写 -1/-1，不推进 RNG。

## 寻路与失效合同

新增 `FootprintPathing` 为显式原生服务，未安装进默认 Game。仅支持本步两种内建方形。地形节点逐个身体格 AND；八邻边共用 `conservativeSquareStep`。每步基础代价为一次行动，有地形代价时取身体格的最大有效代价，不按面积相加，也不额外把对角改为 sqrt(2) 回合。

目标可以是实体的合法几何接触锚点集合，也可以是上层明确给出的锚点集合。接触集合不允许身体覆盖目标，复核斜角地形，使用目标整个身体；它还不是 4a-2 的攻击资格/命中运行器。用反向 Dijkstra 生成距离，选择下一步以稳定 y/x 打破平局。独立测试参照用原始方形格展开和前向线性最短路，核对 2/3 方形、6 张地图、两档代价的 24 条实际提交路线。

共享静态图 key 包含 Grid 身份、地形 token、内建 footprint/pose 以及值类型通行策略（禁行旗标和地形代价）。免疫/状态的后续接线必须构造相应值策略；本次没有接 actor 状态到原生 AI。不能传一个行为可变的闭包来冒充稳定策略。每层服务最多 8 个形状/策略组，每组只留一个当前目标距离图；目标身体/死亡改变实际目标集后更新距离图。LRU、clear、Grid 替换不改变路线平局。

静态图不把移动生物永久当墙。每次取下一步都实时验全身占位（包括休眠预留），被堵只构建一次临时占位图并有界扫描，仍无路返回 blocked。临时动态图不跨调用缓存，因此 HP/资格改变也会被复核，不依赖位置 revision 近似。`CreatureSpatial.occupancyRevision` 可供后续接线使用；本次没有持久动态图，故没有一个缺失 occupancyRevision 的动态缓存 key。

所有现有写层者在 `Cell.refreshTerrainProperties` 刷新后通知观察器，覆盖 Grid.setTerrain/setTerrainLayer、terrain setter、直接写层、Promotion、DF 和 Gas。比较四层地形类型身份，气体仅 volume 变化/重复同类型写入/无变化刷新不失效；不同气体类型及清气失效。观察只在显式空间计划/图请求时开始，不给 Cell/Grid 添加 own 字段，不扫描普通局来发现使用者。共享服务分别订阅，最后释放时丢观察数组；弱标量保留新的观察 epoch，防止关闭观察期间改图后误命中旧缓存。

地形观察只保证遵守现有“写层后必须刷新属性”合同的写入；不会给非法的未刷新写层补偿。缓存、统计和 revision 均为派生状态，未入实体 codec、存档或录像。

## 共享文件的函数级改动

| 文件 | 本次范围 |
|---|---|
| `engine/Movement/CreatureSpatial.ts` | 新增 `squareMovementSize`、`conservativeSquareStep`；`replaceWorld` 释放旧观察；增加 Grid/terrain/occupancy revision 与 active 资格读口；拆出 `canFitTerrainAt`，`canFitAt` 追加占位；`canStepFootprint` 委托新的 `canStepBetween`；新增 `planStepPlacement`；`commitPlacement` 追加一步计划的即时完整边复核；计划取得地形 token 改走服务订阅 |
| `engine/Movement/SpatialRevision.ts` | 懒启动 Cell 类型观察、共享订阅/释放、off-watch 后独立 epoch、刷新通知；普通未订阅 Grid 不计变更 |
| `engine/Map/Grid.ts` | `Cell.refreshTerrainProperties` 追加通知；`setTerrain` / `setTerrainLayer` 去掉重复通知，刷新作为统一出口 |
| `engine/Map/FootprintPathing.ts`（新增） | 方形共享地形图/目标距离图、值策略、LRU、临时动态重规划与诊断统计 |
| `scripts/test-suites.json` | 登记两个新增测试，归常规 test |

未改 `Game.ts`、`Monster.ts`、`TimeCoordinator.ts`、实体 codec、whole-run codec、扩展模块或生成协调器；没有新增 Game 字段，无 U03 登记变化。尤其没有碰调度遍历、Monster.takeTurn 决策结构，与任务书提到的 3a0 并行边界保持分离。

## 验证

统一 Node **24.19.0**，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。已有 CE 缓存未隐藏，也没有额外拉取或运行完整套件。

| 实际执行 | 结果 |
|---|---|
| `node scripts/check-module-boundaries.mjs`（最终代码） | exit=0，模块边界与测试归属通过 |
| `npx vue-tsc -b`（最终代码） | exit=0 |
| `npm run build`（最终代码） | exit=0，Vite 3.33s；既有大 chunk 警告保留 |
| 下列直接相关 24 文件集合（最终代码） | 24 文件 / 314 项全部通过，0 skipped、0 todo，exit=0，169.73s |
| `phase4a1_pathing_perf.test.ts` 独立性能复测 | 1 文件 / 1 项通过，exit=0，0.49s |
| `c_4a_terrain_catalog.test.ts -t 白名单` | 1 项源守卫通过、29 项由 -t 主动过滤，exit=0；不声称完整目录文件通过 |
| `git diff --check`、本次交付文件 CR 检查 | 通过，LF |

24 文件实际命令如下（前述环境变量已设置）：

```sh
npx vitest run \
  src/test/phase4a1_square_pathing.test.ts \
  src/test/phase4a1_pathing_perf.test.ts \
  src/test/phase4a0_spatial.test.ts \
  src/test/phase4a0_spatial_differential.test.ts \
  src/test/c_4b_dungeon_feature.test.ts \
  src/test/c_4c_promotion.test.ts \
  src/test/g_1_gas_volumetric.test.ts \
  src/test/g_2_gas_df_wiring.test.ts \
  src/test/g_3_gas_effects.test.ts \
  src/test/u_18a_terrain_contracts.test.ts \
  src/test/x2b_terrain_derivation.test.ts \
  src/test/perf_2_npc_path_cache.test.ts \
  src/test/ux_1e_pathfinding.test.ts \
  src/test/u_01_instance_snapshot.test.ts \
  src/test/u_03_whole_run_snapshot.test.ts \
  src/test/ext_generation_checkpoint_differential.test.ts \
  src/test/ext_generation_transactions.test.ts \
  src/test/repo_hygiene.test.ts \
  src/test/test_suite_membership.test.ts \
  src/test/p1_30_i18n_gate.test.ts \
  src/test/u24_hardcoded_text.test.ts \
  src/test/u_r2_trace.test.ts \
  src/test/u_r3_trace.test.ts \
  src/test/u_r4_trace.test.ts \
  --maxWorkers=2
```

最终日志在 `/private/tmp/p4a1-related-final.log`、`p4a1-type-delivery.log`、`p4a1-boundary-delivery.log`、`p4a1-build-delivery.log`、`p4a1-terrain-guard.log` 和 `p4a1-performance-isolated.log`；首轮失败日志保留在 `/private/tmp/p4a1-related.log`。没有把多次通过项数相加充当独立测试总量。

专项覆盖窄道/足够宽、两个中间身体的地形或实体堵塞、1×1 原墙角、全身自重叠、HP 资格变化的提交前复核、单次事务、尾格 terrain 通知、接触目标及其移动/死亡、动态绕路、休眠预留瓶颈等待、门晋升/DF/气体失效、免疫值策略区分、8 组 LRU、clear/Grid 更换、订阅释放、无能力零扫描/计数/双 RNG 变化，以及独立最短路参照。新增方形专项 22 项，性能记录 1 项。

保留 4a0 的几何/codec 26 项与零影响差分 4 组（52 个真实 Game 观测点）。旧差分比较完整 own 对象图/引用、保存投影、命令与消息、分配器及双 RNG 状态/调用数，本次没有重录它或 UR2/UR3/UR4、生成基线。

首轮相关集合：24 文件，313 项通过、1 项失败，exit=1，132.42s。失败是 X2b AST 写层清单把观察器缓存容器的 `layers` 属性赋值误识别为真实地形写入。生产修复将缓存属性命名为 `observedTypes`，它始终只保存 Cell 类型副本，不承担世界写入。原 X2b 守卫/写入清单/断言未修改；没有隐藏实际层写入、扩白名单或放宽断言。所有旧测试均保持不变，无前提修订、无黄金重录。早期新增测试的错误地形枚举/毒气旗标布景已按实际目录修正，不属于修改旧守卫。

按任务书未跑完整 `npm test`、全部 `test:ext`、removal、`test:full`/`test:gen`。未改地图生成与随机数算法/规则取骰，未跑 drift；本次不是扩展合并或打标签验收。截图、浏览器、真实 Game 多格性能未验收。

## 性能记录

macOS arm64，Node v24.19.0；在相关集合结束、没有同时运行本轮其他测试后单独复测。毫秒保留三位，统计完整数值在 `/private/tmp/p4a1-pathing-performance.json`（约 2 KB）。

| 场景 | cold ms | warm P50 / P95 ms | 地形图 / 距离图构建 | 临时重规划 | 实际提交步数 |
|---|---:|---:|---:|---:|---:|
| 无多格（1 个普通 1×1，返回原生入口） | 0.192 | 0.007 / 0.010 | 0 / 0 | 0 | 0（本底座不执行单格 AI） |
| 1 个 2×2 | 5.511 | 0.052 / 0.131 | 1 / 1 | 0 | 30 |
| 4 个 2×2，同目标追击、相互堵路 | 3.884 | 6.093 / 6.328 | 1 / 1 | 57 | 120 |
| 1 个 3×3 | 3.937 | 0.064 / 0.097 | 1 / 1 | 0 | 30 |

无多格路径的 Cell 读取、图构建、遍历节点、缓存命中与重规划计数均为 0；所有场景的双 RNG 完整状态不变，实质/外观调用增量都为 0。多格共享静态图不会因同伴移动重建。4 个 2×2 汇聚期间发生 57 次有界重规划，聚合 P95=6.328ms，高于设计稿提出的 5ms 调优目标；冷建图也需要单独预算。当前尚未调优这一拥堵场景，也没有真实 Game 的完整性能结果。

场景为 79×29 的原生 fixture，30 个样本；每样本对全部 actor 规划并提交一步，接触目标在 (67,14)。cold 包含本服务首次建图，warm P50/P95 排除首样本，包含占位复核、必要重规划与空间提交。它不含真实 Game 命令、NPC 调度、环境、渲染或耗时提交，不能据此宣称任务书的真实 Game 每命令性能要求已完成。没有把目标耗时写成测试断言，也没有为了性能放宽碰撞或搜索结果。

## 剩余项与接续顺序

1. **真实 Game 按能力开放**：创建/发布/命令/可信 fixture 初始化/逐层空间服务生命周期/默认拒绝路径；如新增 Game 根必须登记 U03。仅开放独立 r0 square-2/3，继续拒绝其他组件能力。
2. **NPC 入口**：将当前底座接入追击、游荡、逃跑、回归与实际移动/挣扎/门进入；构造原生通行/免疫/状态值策略，维持原生动作耗时。以函数级适配器接线，避免重写与 3a0 共享的决策/调度结构。
3. **全部落点和位移入口**：生成/出生、任一多格参与不自动交换、逐步击退/力场/拉拽、闪现/随机传送、批次召唤/保尺寸克隆、polymorph 抽样后合法落点前不改旧关系/状态、全身无支撑才坠落、换层/pending/休眠唤醒。不能只接普通走路就删除 Game 防线。
4. **实体级 FootprintExposure 与世界机关**：任一格接触的效果一次、深水规则、多个真实机关各一次、瞬移后中断旧格处理、DF 作用域去重、死亡掉落一份。
5. **真实持久化闭环**：square 的 Game save/load、逐条 replay/seek/续录，当前/缓存/pending 的空间所有权，恢复后丢派生图/重建占位索引，测试无位 pending 与非法能力的原子拒绝。
6. 补齐任务书剩余专项与真实 Game 的 1/4 个 2×2、1 个 3×3 性能，按本步开发期政策运行实际相关门禁。4a-2 攻击/视野、4a-3 渲染与 4a-4 内容仍不属于本步。

本次交付没有在未迁移入口静默把身体退化为锚点；那些入口继续拒绝。既定子里程碑可以直接审阅，后续工作从本报告列出的真实入口接线继续，不能将它标为 4a-1 全部完成。
