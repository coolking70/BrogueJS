# 4a-1 完整执行报告：方形身体移动、寻路、落点、位移与环境

本轮基线为维护者提交后的 `ext/phase4` HEAD `6f957b5a2891c0f5fdf76e11e3ac0925b52d72d6`。依据 [任务书](phase4a1.task.md) 与 [设计稿](phase4-giants.md) r3，接续首个子里程碑的剩余 1–6 项。**本轮已完成 4a-1 引擎范围；没有 commit、push 或修改任务书。** 文末保留首个子里程碑的实现、验收与性能记录，供历史对照。

## 本轮结果与能力边界

| 原报告剩余项 | 完成情况 |
|---|---|
| 1. 真实 Game 按能力开放 | 默认实体发布、命令与 codec 接受独立 r0 `builtin:square-2/3` Monster；提供完整预检的 `createSquareMonster` / `publishSquareMonster`。普通局不创建方形服务或空间根 |
| 2. NPC 移动入口 | 追击、游荡、逃跑、回归、尸体接近、迷惑移动、挣脱蛛网、门进入与 NPC 闪现使用全身预检或体型图；调度遍历与 TimeCoordinator 未改 |
| 3. 落点与位移 | 出生、交换禁令、逐步击退/力场/拉拽、闪现/随机传送、召唤、克隆/分裂、polymorph、坠落、跨层/pending、休眠唤醒、复活、携带生物释放与 DF 驱离已接线 |
| 4. Exposure 与机关 | 任一身体格的实体效果归并；实际机关逐格处理、独立陷阱与 DF 子作用域、瞬移/死亡/形态变化中断；全身水域/支撑判据与一次死亡掉落 |
| 5. 持久化 | 真实 Game square save/load、续录、逐条 replay、seek；包含走路、符文击退、楼梯跟随和无位 pending。当前/缓存/携带/purgatory/pending 保持同一实体身份 |
| 6. 专项与性能 | 新增真实 Game 专项、运行直接相关旧测试和开发期门禁；另作真实命令空间耗时与完整命令耗时的独立记录 |

开放仅限无 zone、无 group、无 region、无 actionLock、固定 r0 的内建 2×2/3×3 单实体刚体。玩家仍必须是隐式 1×1；显式 single 组件、任意 mask、旋转、复合体、zone 战斗、主动空间转换仍拒绝。`SpatialSchema.validateSpatialComponent` 的通用生产门仍关闭：授权由具体 square 能力入口授予，存档内的定义不能授予新能力。原 4a0 任意几何/codec fixture 仍需显式 fixture catalog。

生产怪物、群落与 giants 内容没有增加。攻击资格、命中、射线/范围收集与感知仍沿用现有边界，等待 4a-2；身体渲染/UI 属于 4a-3，正式内容和场地属 4a-4。本轮测试创建多格生物，并不表示这些后续阶段已完成。

## 移动、寻路与状态策略

复用前一子里程碑的整体 fit、保守对角、反向 Dijkstra、8 组 LRU 和一次有界动态重规划。真实 Game 只在 square 请求时懒建 `CreatureSpatial` / `FootprintPathing`，实体列表替换时重绑，换 Grid、新局、成功读档或最后一个使用者退出时释放。列表既有发布循环顺便维护 WeakMap 能力计数；普通局不扫描网格来发现空间使用者、不建图、不产生节点/图统计。

NPC 桥接放在原状态/魔法/不可移动门之后，原 1×1 决策与取骰顺序保持原路径。体型图目标是完整目标身体的合法接触锚点集合；逃跑取可达最远锚点，游荡取有界 waypoint 目标，回归取领袖/玩家接触集合。静态图按永久能力、临时悬浮/火免疫、当前身体接触与液体限定构造值策略；水域与秘密门的策略也进入 key。真正提交前仍逐身体格复核原生 `monsterAvoids` 和占位，状态或同伴变化不会穿过旧缓存。被强制放到自愿禁行地形后，允许一条完整合格的边离开，不能把起点永久改成通行节点。

NPC 闪现的偏好使用相同体型距离图，候选落点验整个身体，移动射线忽略自身尾格；实际射线与终点仍分别复核。跨层跟随的距离/耗时和离层期间已走过的部分也使用 body 图，不把 square 放进 1×1 的旅行图里推进。

## 落点与失败事务

新增 `SquarePlacement`：地图大小有界的完整锚点搜索，稳定 x-major 并列，调用方按既有策略确定性取中位或消费一次 RNG；路径失败再作有界环搜索。遍历检查全身地形和保守对角，终点检查全身禁行地形、楼梯/机器约束及活跃/休眠占位，忽略自旧格。不存在无限反复抽样或默认退化为锚点。

- 出生先用未发布值候选预检地形、占位和容量，再调用 Monster 构造器分配 ID/取初始化骰；无位不动世界、ID 或 RNG。正式内容保持 CE 原生生成路径，小型召唤仍会避让大型尾格。
- 任一参与者多格时不自动交换。玩家穿越盟友、闪现挪开潜水占位者、单格怪物进入已有大型生物的楼层均覆盖此规则。
- 击退与拉拽方向取实际最近接触格。每次锚点推进检查完整刚体和两个对角中间身体；跨过的中间姿态不结算环境，终点结算一次。完全失败不清束缚/潜水/俘虏状态；技能依法仍可收取其既有行动费用。
- 闪现/随机传送全身终点预检在位置与状态写入前完成。大型随机传送无位时，俘虏不会先被释放。
- 克隆先求位再复制，保留形状且深拷贝 spatial；分裂先过滤完整候选，再扣一半 HP、分配克隆 ID。无位不扣 HP，不分配 ID。
- square polymorph 按 D07=A 先抽新物种，再以未发布值候选求单格合法落点；无位不改变旧 HP、状态、关系、身份、位置或组件，只保留物种抽样的 RNG。成功才一次提交原生变形并去掉组件。
- 坠落需要所有身体格都失去有效支撑。伤害和状态清理在离开源层时只执行一次；下层无位则保留既有 `pendingFallenByDepth` 队列，原实体不落到半个身体的空间。
- 当前层 pending 按实体 ID 升序重试；进层及地形 token、实体占位/活跃资格或队列变化触发有界搜索。状态不变时不重搜，重试不重复坠落伤害；容量不足同样保留 pending。没有创建第 41 层。
- 跨层入口、square 唤醒/复活先求位，再改所有权、倒计时及旗标；失败保留来源。释放携带的 square 无位时进入当前层 pending，保存实体身份与尺寸。
- DF 驱离检查目标全身都在 DF 区域外，逐个发布后的身体成为后续候选的占位约束；无位保持该实体。

## FootprintExposure 与机关作用域

`FootprintExposure` 是不持久化、不取骰的接触快照：固定 y/x 的实际身体格、各格 flags/terrainMechanics、全层与 GAS union、全身液体与全身无支撑 AND 摘要。火/熔岩/气体/蛛网/毒苔可由任一格接触；同类状态/爆炸/毒/持续伤害按实体一次，治疗取单格最大值一次。灭火要求全部身体格可灭火；液体限定移动和潜水资格要求全身合格。普通 1×1 接触仍走原单格路径。

移动记录旧身体，新格才产生新的进入事件；驻留旧格继续接触持续地形。真实陷阱逐格记 depression，多个独立机关各触发一次，钥匙、献祭与门晋升也消费实际接触格。处理途中死亡、瞬移或形态变化即停止旧序列；square 锚点的派生 revision 还能识别嵌套移出后又返回同一坐标的情况。

递归同一 DF 共享实体效果集合，按实体 ID + 效果种类去重，允许后来新增的另一种效果生效。不同真实陷阱开启独立 DF 联系作用域；机器号只在一次同步接触链内去重。死亡 DF 开新子作用域，随后独立 DF 不继承前次集合。所有集合通过 finally 退出，无持久机械状态混入 Grid/Cell/实体。死亡、道具掉落与携带生物释放仍是同一个原生实体出口，不按身体面积重复执行。

按 CE Time.c:168–176，怪物置 falling 后仍完成该次瞬时地形结算，在回合边界离层；玩家置 falling 则立即返回。这里遵守 CE 执行路径，没有把任务描述中的“坠落中断”解释为提前删掉怪物的原生瞬时效果。

## 默认存档与录像合同

默认 whole-run 根仅保存实体图实际使用的内建定义闭包，groups 必为空，版本仍为 v3。加载校验能力、定义闭包、整数锚点、各物理楼层全身边界/重叠、跨层和 pending 单一所有权、pending 深度与预算、携带/purgatory 所有权以及孤立存活 square。多格玩家、未知定义、额外定义和未开放组件原子拒绝，旧世界与双 RNG 不变。

实体 `spatial` + `loc` 是真相；占位索引、图、contact 集合和重试 token 不进入存档/录像。默认加载不安装 fixture service，真正行动时按已恢复实体重建。真实存读后继续命令的世界投影（含双流）、录像每条命令、跨方向 seek 和保存前缀续录均比较一致。录像场景只在 `startNewGame` 后构造确定性 fixture；执行命令、Monster.takeTurn、NPC 选择、环境、换层、读档、回放与 RNG 均执行真实生产代码。

## 本轮共享文件函数级范围

| 文件 | 本轮修改 |
|---|---|
| `Movement/CreatureSpatial.ts` | square 能力门、玩家单格门、原生 fit/step；默认服务生命周期验证、禁止主动转换、dispose；square 锚点 revision、避免单格接触降维 |
| `Map/FootprintPathing.ts` | 水域/秘密门值策略、escape 目标、只读距离查询、禁行起点的完整退出边；保留原 LRU 和单次动态重规划 |
| `Movement/SquarePlacement.ts` / `FootprintExposure.ts` / `SpatialContactScope.ts` | 新增完整方形落点搜索、接触摘要、同步接触作用域 |
| `Movement/CreaturePlacement.ts` | 方形瞬移地图/终点与多层秘密门过滤；单格路径保留 |
| `Movement/LevelTravel.ts` | `scheduleLevelFollowers` 的 square 查询、`travelPlacement` 的全身候选、`restoreSquareTravelPosition`；单格公式/图不变 |
| `Combat/Cloning.ts` / `Combat/MonsterBlink.ts` | 方形克隆候选；NPC 闪现偏好/安全/领袖接近的 body 查询、实际终点与自身尾格处理 |
| `entities/Monster.ts` | `polymorph` 的抽样后预检；`takeTurn` 新增桥接调用；`takeSquareMovementTurn`、`randFlittingDirection`、`canEnterWaterTerrain`、`tryCorpseMove`、`tryMoveTo`、entrancement movement |
| `Core/MonsterLifecycle.ts` | 既有列表发布循环和 Proxy 维护能力计数/派生服务释放通知 |
| `Core/Game.ts`（生命周期/持久化） | init/load 成功释放派生服务；spatialActor/executeCommand 玩家门；squareMotion/squareLandingRetry 及 U03；创建/发布/诊断计数；DF grid 重绑 |
| `Core/Game.ts`（落点/位移） | placeCreature、processStaggerHit、force 符文、beckonCreature、finishBlink、teleportBoltTarget、polymorphBoltTarget、cloneMonster/trySplitMonster、movePlayerPastAlly；monsterEntersLevel/restoreLevelResident(s)、monstersFall/retrySquareLandings、toggleMonsterDormancy、resurrectAlly、killMonster 携带释放与玩家落位预留 |
| `Core/Game.ts`（环境） | applyEnvironmentalEffects、火/蛛网/气体/苔藓/爆炸接触谓词、applyDisplacementTileEntry、triggerPressurePlate、triggerDeathFeatures、bindDungeonFeatureEffects / applyDungeonFeatureContact |
| `Core/GenerationCoordinator.ts` | 读取未访问层 fallen 队列时 square 全身落位，无位保留队列 |
| `Core/EntitySnapshot.ts` / `WholeRunSnapshot.ts` | 默认 square 组件/锚点验证、内建闭包、全楼层与闭合生命周期所有权；fixture codec 保留 |
| `Map/DungeonFeature.ts` / `Promotion.ts` | DF 全身驱离端口、递归 root 效果集合、独立接触 root、机器号接触去重；普通接口调用形状保留 |
| `scripts/u03-state-contract.json` / `test-suites.json` | 两个可选派生 Game 字段、两个新测试归常规 test |

本轮没有改 `TimeCoordinator.ts` 的调度、随机数算法、生产怪物/群落/生成目录、UI 或翻译文件。没有新增玩家可见文本。

## 本轮验证与性能

环境：macOS arm64，Node **24.19.0**，PATH 前置项目指定运行时，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。按开发期政策定向运行，未运行完整 `npm test` / 全部 `test:ext` / removal / `test:full` / `test:gen` / drift。本轮不是合并扩展进 main 或发版验收。

| 实际执行 | 结果与证据 |
|---|---|
| 48 文件直接相关集合（下列清单） | 首轮 47 文件通过、1 文件失败；1032 passed / 1 failed，exit=1，317.88s。唯一失败为 W-11 旧 prototype fixture 缺少 pending map；不把本轮集合写成全绿。日志 `p4a1-followup-related-final.log` |
| 修复后的 8 文件复测 | 237/237 通过，exit=0，41.69s。W-11/W-12、Game square、square pathing、4a0 spatial/differential、U03/U03b；日志 `p4a1-followup-corrected-final.log` |
| 跨层接线后的 4 文件复测 | 89/89 通过，exit=0，53.63s。Game square、C5、generation checkpoint differential/transactions；日志 `p4a1-followup-arrivals-final.log` |
| 全身水域出生/克隆后的 5 文件复测 | 163/163 通过，exit=0，41.87s。Game square、4a0 differential、W20、U03b、V2b5；日志 `p4a1-followup-water-final.log` |
| 最终 `phase4a1_game_square.test.ts` | **49/49 通过**，exit=0，28.51s；包含最后补充的 aquatic 发布检查。日志 `p4a1-followup-square-delivery.log` |
| `phase4a1_pathing_perf.test.ts` | 1/1 通过，exit=0，0.47s；底座计数/样本记录仍有效。日志 `p4a1-followup-pathing-perf.log` |
| 最终 `phase4a1_game_perf.test.ts`，单独执行 | 1/1 通过，exit=0，2.58s；真实命令数据见下表。日志 `p4a1-followup-game-performance-delivery.log` |
| `c_4a_terrain_catalog.test.ts -t 白名单` | 源守卫 1 项通过，29 项由 `-t` 主动过滤，exit=0，1.10s；不声称完整目录文件通过。日志 `p4a1-followup-terrain-guard-final.log` |
| 最终 `repo_hygiene.test.ts` / `test_suite_membership.test.ts` | 2 文件、8/8 通过，exit=0，0.18s；日志 `p4a1-followup-hygiene-delivery.log` |
| `node scripts/check-module-boundaries.mjs` | 通过，exit=0；日志 `p4a1-followup-boundary-final.log` |
| `npx vue-tsc -b` | 通过，exit=0；日志 `p4a1-followup-type-final.log` |
| `npm run build` | 通过，exit=0，Vite 2.48s；保留既有 >500 KB chunk 警告。日志 `p4a1-followup-build-delivery.log` |
| `git diff --check`、交付文件 CR 检查 | 通过，LF |

以上多轮测试有重叠，**没有把通过项数相加充当独立测试总数**。4a0 零影响差分的 4 组观测、UR2/UR3/UR4 与相关快照/录像旧断言继续一致，无观测重录。最终新增真实 Game 专项覆盖 2×2/3×3 的命令移动与追击、符文击退、楼梯跟随及 save/load/逐条 replay/seek/续录；另外覆盖尾格熔岩/气体/蛛网、独立陷阱和实际 DF、移出后返回同坐标的接触中断、全身支撑/水域、无位 pending、乘客/purgatory 身份、polymorph、分裂/深拷贝、失败事务与能力门。窄道、保守对角、动态堵路、各写层失效和独立最短路参照继续由 22 项 square pathing 专项验证。

48 文件集合实际命令（已设置上述 Node 环境）：

```sh
npx vitest run \
  src/test/phase4a1_game_square.test.ts \
  src/test/phase4a1_square_pathing.test.ts \
  src/test/phase4a0_spatial.test.ts \
  src/test/phase4a0_spatial_differential.test.ts \
  src/test/v_2b_6_keys.test.ts \
  src/test/p1_30_i18n_gate.test.ts \
  src/test/g_2_gas_df_wiring.test.ts \
  src/test/v_2b_3_wired.test.ts \
  src/test/g_1_gas_volumetric.test.ts \
  src/test/v_2b_5_dormant.test.ts \
  src/test/x3b_display_recording.test.ts \
  src/test/x2b_terrain_derivation.test.ts \
  src/test/p4_4_split_kamikaze.test.ts \
  src/test/test_suite_membership.test.ts \
  src/test/f_2c_explosion.test.ts \
  src/test/p4_10_waypoint.test.ts \
  src/test/u_r4_trace.test.ts \
  src/test/w_19_polymorph.test.ts \
  src/test/c_4b_dungeon_feature.test.ts \
  src/test/u_r3_trace.test.ts \
  src/test/u_27_recording.test.ts \
  src/test/c_4c_promotion.test.ts \
  src/test/p1_24_death_sink.test.ts \
  src/test/u_11_corpse_learning.test.ts \
  src/test/u_03b_level_travel.test.ts \
  src/test/u_03_whole_run_snapshot.test.ts \
  src/test/x2a_recording_checkpoint.test.ts \
  src/test/u_r2_trace.test.ts \
  src/test/perf_2_npc_path_cache.test.ts \
  src/test/ext_generation_transactions.test.ts \
  src/test/u_15d_weapon_runic.test.ts \
  src/test/w_12_blink_beckoning.test.ts \
  src/test/g_3_gas_effects.test.ts \
  src/test/w_20_cloning.test.ts \
  src/test/c_5_fall_subsystem.test.ts \
  src/test/ux_1e_pathfinding.test.ts \
  src/test/f_2a_fire_mechanics.test.ts \
  src/test/w_18_entrancement.test.ts \
  src/test/u_10_absorption_snapshot.test.ts \
  src/test/u24_hardcoded_text.test.ts \
  src/test/w_11_teleport_placement.test.ts \
  src/test/u_18_water_cage.test.ts \
  src/test/ext_generation_checkpoint_differential.test.ts \
  src/test/f_2b_creature_burning.test.ts \
  src/test/repo_hygiene.test.ts \
  src/test/p4_2_monster_summoning.test.ts \
  src/test/u_01_instance_snapshot.test.ts \
  src/test/u_07_monster_blink.test.ts \
  --maxWorkers=2
```

表中后续复测均为 `npx vitest run <所列文件> --maxWorkers=2`；目录源守卫另加 `-t 白名单`，两个性能文件分别单独调用。未启动完整套件的脚本别名。

真实 Game 性能：79×29 平地，同一个 headless Game fixture 中真实执行 30 条 `wait` 命令，怪物始终追击；无多格对照为 1 个普通 1×1。2026-10-05 07:10 的最终代码独立复测没有同时运行其他测试或构建。空间入口合计测量 `planSquareStep`、`canStepFootprint`、`canDisplaceCreature` 和 `footprintExposure`，嵌套调用不重复计时；**这是这些空间入口的耗时，不是所有原语的穷尽剖析**。完整命令另行计时，包含调度、NPC、环境等，不含渲染。cold 为首条命令，warm 排除首条；P95 按 29 个 warm 样本的 nearest rank。时间单位 ms，保留三位。

| 场景 | cold 空间 | warm 空间 P50 / P95 | warm 完整命令 P50 / P95 | 地形图 / 距离图 | 重规划 | 命中 / 遍历节点 / 保留图 |
|---|---:|---:|---:|---:|---:|---:|
| 0 多格，1 个普通 1×1 | 0.000 | 0.000 / 0.000 | 3.522 / 4.645 | 0 / 0 | 0 | 0 / 0 / 0 |
| 1 个 2×2 | 5.940 | 0.082 / 0.182 | 4.599 / 5.295 | 1 / 1 | 0 | 29 / 1976 / 1 |
| 4 个 2×2，同目标汇聚拥堵 | 3.074 | 4.664 / **7.747** | 12.988 / 15.929 | 1 / 1 | 54 | 119 / 107348 / 1 |
| 1 个 3×3 | 3.869 | 0.108 / 0.200 | 4.634 / 5.154 | 1 / 1 | 0 | 29 / 1875 / 1 |

4 个 2×2 汇聚的 54 次临时重规划均按请求有界，静态图共享且未因同伴移动重建；其空间 P95=7.747ms 超过 5ms，按用户指示记录而不强求本轮调优。原始 30 条空间/命令样本与计数在 `/private/tmp/p4a1-game-performance.json`。性能测试不把毫秒目标写成断言，没有为了计时改变碰撞、搜索结果或行动流程。

所有原始日志与性能样本放 `/private/tmp/`，未加入仓库。没有修改或重录生成基线、黄金 trace 或 4a0 差分观测数据。

## 旧测试前提修订与失败处理

`phase4a0_spatial.test.ts` 有两处“所有生产 square 均未开放”的前提与本步授权冲突。先保留旧测试，只回退本轮生产文件到 HEAD 做单变量反事实：原来的两个用例均通过（2 passed、24 主动过滤，exit=0，`/private/tmp/p4a1-capability-counterfactual.log`）；恢复生产改动时原两个用例失败。随后只改布景：

1. 未开放发布/玩家/加载守卫的被测组件从裸 square-2 改成 square-2 + `actionLockInTicks: 0`，拒绝与不改变世界的断言保持原样。
2. fixture 定义闭包 round-trip 改成同样 2×2 几何的注册 `fixture-square` mask；默认拒绝、显式 fixture 成功以及跨层身份的断言保持原样。

未翻转断言、放宽容差、删除或跳过用例。其余旧测试未修改。旧 W-12 精确调用形状守卫失败时修复生产调用，让普通接触继续传原参数；没有改守卫。48 文件集合中的 W-11 prototype fixture 没有 pending map，生产重试入口改为可选读取，普通无 square 局直接返回；原 W-11 fixture 与断言未改，随后 8 文件复测全部通过。

新增水域摘要的同名 `mechFlags` 字段被 C4a 源守卫识别为目录直接读者，生产摘要改名 `terrainMechanics`；实际目录读取仍通过原 `cellTerrainMechFlags` helper，没有扩白名单或修改守卫。更名后原源守卫通过。新增测试曾用错 burning 的类型入口、治疗量/混乱陷阱体积、test 模式的楼层缓存前提和楼梯坐标元数据，均修正 fixture 后重新运行，未把失败测试算作通过。

## 已知限制与后续

- 4 个 2×2 汇聚时会多次作地图大小的完整占位重规划，P95 可超过 5ms 目标；按用户指示记录，不为本轮强行调优。计时是开发机的样本记录，不是门限断言。
- 空间通行图的静态地形通知仍要求写层后刷新属性；未刷新的非法地形写入不受支持。占位动态图不跨请求缓存，HP/休眠资格会实时复核。
- square 新行为采用稳定 body 路线平局和整形状避让；没有要求它与不存在的大型 CE 内容逐骰一致。普通 1×1 保留原执行路径。
- 当前引擎 fixture 已开放，不具备 4a-2 的完整身体战斗/感知或 4a-3 的身体显示，因此尚不能当作巨人正式可玩内容交付。下一步按既定顺序推进 **4a-2 → 4a-3 → 4a-4**。
- 前一报告列出的接续 1–6 项本轮已完成；没有新的 4a-1 子里程碑剩余项。

---

## 首个子里程碑的原始记录（历史）

下文保留原报告。“尚未完成”“仍拒绝”“剩余项”等均表示维护者提交本轮 HEAD 之前的状态；当前能力与结论以上文为准。原表格与日志仍记录当时样本；底座性能脚本本轮复测覆写了同名临时 JSON，该临时路径不代表历史样本归档。

### 方形移动规划与体型寻路底座子里程碑（原报告）

基线：`ext/phase4`，`399df979f991434441182373c2fbc022645cab10`。依据 [任务书](phase4a1.task.md) 与 [设计稿](phase4-giants.md) §4.1、§8 实施。未 commit、未 push，原有任务书未修改。

**4a-1 整体尚未完成。** 本次按任务书“改动过大时可在干净子里程碑停下并说明剩余项”交付可独立验收的空间移动规划、体型寻路与缓存通知底座。没有部分移除 Game 防线：生产发布、命令、NPC 行动、环境和加载仍沿用 4a0 的拒绝；多格 Monster 尚不能在真实 Game 中行动。后续必须完成全部入口接线及环境、落点、持久化合同，才能按任务书开放真实 Game。

### 已实现与能力边界

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

### 寻路与失效合同

新增 `FootprintPathing` 为显式原生服务，未安装进默认 Game。仅支持本步两种内建方形。地形节点逐个身体格 AND；八邻边共用 `conservativeSquareStep`。每步基础代价为一次行动，有地形代价时取身体格的最大有效代价，不按面积相加，也不额外把对角改为 sqrt(2) 回合。

目标可以是实体的合法几何接触锚点集合，也可以是上层明确给出的锚点集合。接触集合不允许身体覆盖目标，复核斜角地形，使用目标整个身体；它还不是 4a-2 的攻击资格/命中运行器。用反向 Dijkstra 生成距离，选择下一步以稳定 y/x 打破平局。独立测试参照用原始方形格展开和前向线性最短路，核对 2/3 方形、6 张地图、两档代价的 24 条实际提交路线。

共享静态图 key 包含 Grid 身份、地形 token、内建 footprint/pose 以及值类型通行策略（禁行旗标和地形代价）。免疫/状态的后续接线必须构造相应值策略；本次没有接 actor 状态到原生 AI。不能传一个行为可变的闭包来冒充稳定策略。每层服务最多 8 个形状/策略组，每组只留一个当前目标距离图；目标身体/死亡改变实际目标集后更新距离图。LRU、clear、Grid 替换不改变路线平局。

静态图不把移动生物永久当墙。每次取下一步都实时验全身占位（包括休眠预留），被堵只构建一次临时占位图并有界扫描，仍无路返回 blocked。临时动态图不跨调用缓存，因此 HP/资格改变也会被复核，不依赖位置 revision 近似。`CreatureSpatial.occupancyRevision` 可供后续接线使用；本次没有持久动态图，故没有一个缺失 occupancyRevision 的动态缓存 key。

所有现有写层者在 `Cell.refreshTerrainProperties` 刷新后通知观察器，覆盖 Grid.setTerrain/setTerrainLayer、terrain setter、直接写层、Promotion、DF 和 Gas。比较四层地形类型身份，气体仅 volume 变化/重复同类型写入/无变化刷新不失效；不同气体类型及清气失效。观察只在显式空间计划/图请求时开始，不给 Cell/Grid 添加 own 字段，不扫描普通局来发现使用者。共享服务分别订阅，最后释放时丢观察数组；弱标量保留新的观察 epoch，防止关闭观察期间改图后误命中旧缓存。

地形观察只保证遵守现有“写层后必须刷新属性”合同的写入；不会给非法的未刷新写层补偿。缓存、统计和 revision 均为派生状态，未入实体 codec、存档或录像。

### 共享文件的函数级改动

| 文件 | 本次范围 |
|---|---|
| `engine/Movement/CreatureSpatial.ts` | 新增 `squareMovementSize`、`conservativeSquareStep`；`replaceWorld` 释放旧观察；增加 Grid/terrain/occupancy revision 与 active 资格读口；拆出 `canFitTerrainAt`，`canFitAt` 追加占位；`canStepFootprint` 委托新的 `canStepBetween`；新增 `planStepPlacement`；`commitPlacement` 追加一步计划的即时完整边复核；计划取得地形 token 改走服务订阅 |
| `engine/Movement/SpatialRevision.ts` | 懒启动 Cell 类型观察、共享订阅/释放、off-watch 后独立 epoch、刷新通知；普通未订阅 Grid 不计变更 |
| `engine/Map/Grid.ts` | `Cell.refreshTerrainProperties` 追加通知；`setTerrain` / `setTerrainLayer` 去掉重复通知，刷新作为统一出口 |
| `engine/Map/FootprintPathing.ts`（新增） | 方形共享地形图/目标距离图、值策略、LRU、临时动态重规划与诊断统计 |
| `scripts/test-suites.json` | 登记两个新增测试，归常规 test |

未改 `Game.ts`、`Monster.ts`、`TimeCoordinator.ts`、实体 codec、whole-run codec、扩展模块或生成协调器；没有新增 Game 字段，无 U03 登记变化。尤其没有碰调度遍历、Monster.takeTurn 决策结构，与任务书提到的 3a0 并行边界保持分离。

### 验证

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

### 性能记录

macOS arm64，Node v24.19.0；在相关集合结束、没有同时运行本轮其他测试后单独复测。毫秒保留三位，统计完整数值在 `/private/tmp/p4a1-pathing-performance.json`（约 2 KB）。

| 场景 | cold ms | warm P50 / P95 ms | 地形图 / 距离图构建 | 临时重规划 | 实际提交步数 |
|---|---:|---:|---:|---:|---:|
| 无多格（1 个普通 1×1，返回原生入口） | 0.192 | 0.007 / 0.010 | 0 / 0 | 0 | 0（本底座不执行单格 AI） |
| 1 个 2×2 | 5.511 | 0.052 / 0.131 | 1 / 1 | 0 | 30 |
| 4 个 2×2，同目标追击、相互堵路 | 3.884 | 6.093 / 6.328 | 1 / 1 | 57 | 120 |
| 1 个 3×3 | 3.937 | 0.064 / 0.097 | 1 / 1 | 0 | 30 |

无多格路径的 Cell 读取、图构建、遍历节点、缓存命中与重规划计数均为 0；所有场景的双 RNG 完整状态不变，实质/外观调用增量都为 0。多格共享静态图不会因同伴移动重建。4 个 2×2 汇聚期间发生 57 次有界重规划，聚合 P95=6.328ms，高于设计稿提出的 5ms 调优目标；冷建图也需要单独预算。当前尚未调优这一拥堵场景，也没有真实 Game 的完整性能结果。

场景为 79×29 的原生 fixture，30 个样本；每样本对全部 actor 规划并提交一步，接触目标在 (67,14)。cold 包含本服务首次建图，warm P50/P95 排除首样本，包含占位复核、必要重规划与空间提交。它不含真实 Game 命令、NPC 调度、环境、渲染或耗时提交，不能据此宣称任务书的真实 Game 每命令性能要求已完成。没有把目标耗时写成测试断言，也没有为了性能放宽碰撞或搜索结果。

### 剩余项与接续顺序

1. **真实 Game 按能力开放**：创建/发布/命令/可信 fixture 初始化/逐层空间服务生命周期/默认拒绝路径；如新增 Game 根必须登记 U03。仅开放独立 r0 square-2/3，继续拒绝其他组件能力。
2. **NPC 入口**：将当前底座接入追击、游荡、逃跑、回归与实际移动/挣扎/门进入；构造原生通行/免疫/状态值策略，维持原生动作耗时。以函数级适配器接线，避免重写与 3a0 共享的决策/调度结构。
3. **全部落点和位移入口**：生成/出生、任一多格参与不自动交换、逐步击退/力场/拉拽、闪现/随机传送、批次召唤/保尺寸克隆、polymorph 抽样后合法落点前不改旧关系/状态、全身无支撑才坠落、换层/pending/休眠唤醒。不能只接普通走路就删除 Game 防线。
4. **实体级 FootprintExposure 与世界机关**：任一格接触的效果一次、深水规则、多个真实机关各一次、瞬移后中断旧格处理、DF 作用域去重、死亡掉落一份。
5. **真实持久化闭环**：square 的 Game save/load、逐条 replay/seek/续录，当前/缓存/pending 的空间所有权，恢复后丢派生图/重建占位索引，测试无位 pending 与非法能力的原子拒绝。
6. 补齐任务书剩余专项与真实 Game 的 1/4 个 2×2、1 个 3×3 性能，按本步开发期政策运行实际相关门禁。4a-2 攻击/视野、4a-3 渲染与 4a-4 内容仍不属于本步。

本次交付没有在未迁移入口静默把身体退化为锚点；那些入口继续拒绝。既定子里程碑可以直接审阅，后续工作从本报告列出的真实入口接线继续，不能将它标为 4a-1 全部完成。
