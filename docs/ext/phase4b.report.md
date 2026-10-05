# 4b 执行报告：4b-0 扫掠、受控旋转与位姿图子里程碑

2026-10-05，分支 `ext/phase4`，起点/交付 HEAD 均为 `b306f01d4a3e9e66f2fc9c0d5e394a4f3e2c2b9a`。执行 [任务书](phase4b.task.md)，采用其“可在干净子里程碑停下并列剩余项”的交付选项。**本轮完成 4b-0 底座 fixture；完整 4b 尚未完成，生产任意 mask / 旋转能力门仍关闭。** 没有 commit、暂存或 push。

## 范围与能力边界

本轮交付通用独立刚体的连续旋转扫掠预编译、整体平移与原子旋转计划，以及带旋转边的锚点×pose 寻路服务。fixture 支持已注册、四连通、有原点、≤16 格/单边≤16 的 mask；可执行姿态为一个固定方向或完整 r0/r90/r180/r270。镜像、部分旋转集合、复合体、动作锁和局部 zone HP 拒绝；native zone 标签仅用于随身体变换的空间标签，不实现 4c 战斗。

本轮没有开放原生注册/创建/读档的任意 mask 门，没有增加正式敌人/场地或改变 giants 数据，没有接 Game/NPC 的旋转时钟、驻留环境或公开命令。原 `squareMovementSize`、`FootprintPathing` 和 Game 的生产形态/落点/存档校验保持方形 r0 合同。这样不会产生“能创建、但其余规则仍把它当方形”的可玩半接线状态。项目已确定的命令边界、i18n、双 RNG、玩家 1×1 与旧档拒绝合同保持；没有新增 Game 字段或持久 schema。

## 共享文件与函数级改动

| 文件 | 函数/变化 |
|---|---|
| `src/engine/Movement/CreatureSpatial.ts` | 新增 `rigidMovementFootprint`，只给可信 fixture catalog 开放独立刚体；生产原能力门不放宽。 |
| 同上 | `canStepBetween` 增可选 hypothetical pose，所有原调用默认仍用当前 pose。新增 `planRigidStepPlacement`，复用单步中间身体复核与原子提交。 |
| 同上 | 新增 `canRotateBetween` / `canRotateFootprint`：逐段 fit 与 sweep，检查地形、区域、边界、动态/休眠占位，忽略自己旧身体；纯规划不触发环境。 |
| 同上 | 新增 `planRotationPlacement` / 派生 `rotationPlans`：计划不可伪造、一次性，90° 返回 movementSpeed 正耗时，180° 是两段 90° 并返回两倍耗时。未接 actor 时钟，不宣称实际 NPC 已耗时。 |
| 同上 | `planPlacement` 提取私有 `preparePlacement`，终态冲突按实际 mask+pose；公共 placement 禁止直接改 pose 绕过 sweep。`commitPlacement` 重验身份/身体、所有权、速度、terrain revision、动态资格、扫掠，固定锚点后更新 pose、占位/接触 revision；原非旋转提交继续原路径。 |
| `src/engine/Movement/RigidFootprint.ts`（新增） | `compileRigidFootprint` 收窄可执行能力；`compileQuarterSweep` 求连续 vertex/edge 接触临界角并对区间做 SAT，逆边共享同一体积，其余朝向按整数变换。只读编译表与按不可变定义缓存；扫掠超 256 格整项拒绝。 |
| `src/engine/Map/RigidPosePathing.ts`（新增） | fixture 专用 `RigidPosePathing`：静态四向 fit/最大地形代价/旋转边、反向 Dijkstra、接触多源/逃跑/指定 pose 的锚点目标、一次有界动态重规划、地形 revision 与 LRU 8 组、捕获当次 distanceAt；返回旋转方向与正耗时声明。 |
| `scripts/test-suites.json` | 只登记两份新专项到常规 suite，不改变旧测试归属。 |
| `docs/ext/architecture.md`、`progress.md` | 记录 fixture/生产边界与接手事项。 |

扫掠围绕**整数原点格的中心**旋转单位格方块，锚点不挪到旋转后的包围盒左上。连续区间判定不以动画采样代替；中途切触保守计入碰撞。只用圆半径枚举候选格，圆/包围盒本身不是实际扫掠或身体。每条 90° 边≤256 格，180° 检查两条各自有界的边，不能验起终态就穿墙。

静态 graph key 含完整 shape/标签定义、有效 pose 集合、区域 ID 与归一化值策略；actor 当前 pose 用于选择起点，同一四 pose 图无需因一次转身重建。目标实际 pose 改变会重建目标距离表。地形 revision 清派生图，占位不写进静态图；受阻至多一次 W×H×A 的动态重规划，A≤4、每节点≤10 邻边。LRU 超 8 组淘汰最旧项、需要时完整重算，没有按墙钟时间裁剪、减少 pose 或改路线的退化。

## 数据、专项与验收种子

fixture 数据在 `src/test/support/rigidScene.ts`：L（三格）、十字（五格）、带中心孔洞的 3×3 环（八格）、1×4 长条（四格）。不引用 giants 内容，不把诊断布景当自然生成。

新增两份专项共 40 项：

- `phase4b_rigid_rotation.test.ts`（26 项）：独立 polygon clipping 参照覆盖每种形状 161 个角度；中途弧上的墙/生物、终态 fit 而 sweep 不 fit、180° 第二段/反向路径、正 actionCost 声明、锚点不漂移、单用计划、terrain/复活/休眠/身份/速度/冻结失效、地图与区域、禁止忽略旁人/合并平移旋转、四 pose 空格可站其他生物、D08 空间去重、实际 mask 轮廓边、标签随旋转、独立 clone/实体与 world codec、生产拒绝 fixture 档且旧局/双 RNG 不退休。
- `phase4b_pose_pathing.test.ts`（14 项）：长条在房间先转再入单格通道（8 次平移+1 次旋转，最短归一化代价 9）；端点 L 通道扫掠不可达；四种形状×四 pose×两档地形权重与独立**正向** Dijkstra 对照；动态扫掠被挡后反向三次绕转、封死窄道有界 blocked、死者资格变化、目标/actor pose 与地形缓存失效、LRU 8/clear 不改动作、固定 square 与旧 r0 服务逐步同路、普通世界零读格/零图/零索引/零 RNG；另记录长条/L fixture 追击性能。

连续几何参照的 polygon clipping 不调用生产 SAT 或临界角函数。正向寻路参照独立使用 Map、排序队列、正向松弛与现场空间谓词，不读生产 fit/距离/旋转表或使用生产堆；它验证的是建图、反向代价和缓存结果，不冒充独立物理旋转规格。

真实 `decodeWholeRunWorld` 的 fixture codec 在旋转后重建同一占位；`Game.loadSnapshot` 拒绝该未开放生产形状并保留旧局。这是格式/门禁验证，**不是旋转形状真实 Game save/load/replay/seek/续录闭环**。

预算负例发现：即使连通、16 格/边长 16 均合法，绕端点旋转的 1×16 mask 仍会超过 256 格 sweep，因此旋转声明拒绝；相同 mask 仅 r0 固定朝向合法。测试没有放大上限或截断扫掠。

**没有新增正式样例，也没有新增自然验收种子。** giants 仍只有原岩脊兽与沉渊巨像；既有自然路线/trace 回归不代表新形状生成验收。

## 最终门禁与性能

统一 Node **24.19.0**，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。

最终同一冻结候选按序完成以下门禁，**全部 exit0**：

| 门禁 | 结果 | 命令耗时 |
|---|---|---:|
| `node scripts/check-module-boundaries.mjs` | 模块边界与测试所有权通过 | 1.51s |
| `npx vue-tsc -b` | 通过 | 6.84s |
| `npm run build` | 通过；已有 >500 KB chunk 提示保留 | 9.30s |
| 直接相关 Vitest 集合 | **34 文件 / 433 项全部通过**；含新增 40 项、4a0 全对象图零影响差分、全部 4a 专项、giants 五份测试、UR2/3/4、U03/换层/录像、两种生成回滚与源码/i18n/卫生/归属守卫 | 200.25s |
| `c_4a_terrain_catalog -t 白名单` | 1 项通过，29 项由 `-t` 过滤；未跑重型普查 | 1.93s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16 子集通过**，包含 giants；真实 Game 新局/游玩/save-load/逐事件 replay/seek/续录 | 66.96s |
| `npm run test:drift -- --maxWorkers=2` | **3 文件 / 4 项全部通过**；两份普通生成基线与 giants 两份自然 trace 原字节通过 | 49.64s |

smoke 的 installed 为 combat/giants/growth/narrative，`engine.status=passed`、`requestedScopePassed=true`；browser=not-run、整体 passed=false 是脚本对浏览器未验的报告口径，不冒充全浏览器门禁。SSR 初始化时 HMR WebSocket 监听另有 EPERM 日志，但不影响 engine-only 检查与实际 exit0；没有改脚本掩去该日志。

839 份 src/scripts/构建配置输入在每项门禁前后及交付检查逐文件相同，变化列表为空；输入散列集合（路径排序的紧凑 JSON）SHA-256 为 `de390ab446a9edc46898467e1609427f142d986d3ac39314b556c5d706b38a4b`。证据均在仓库外 `/private/tmp/p4b-final-*`。执行 runner `/private/tmp/p4b-gates-executed.py`（等效优化过重复散列读取的复现 runner 为 `/private/tmp/p4b-gates.py`），精确命令、输入散列、耗时、退出码与前后变化登记于 `/private/tmp/p4b-final-gates.json`，直接相关清单 `/private/tmp/p4b-final-related-files.json`。门禁结束 UTC `2026-10-05 04:44:33`；随后只补文档。HEAD 不变，暂存区为空，`git diff --check`、交付文本 LF 检查通过；任务书原本未跟踪，未改动。

最终相关集合内的追击性能记录为 `/private/tmp/p4b-pose-performance.json`。单次样本规划并提交一次 fixture 行动，79×29，30 次行动；冷样本单列，暖 P50/P95 取余下 29 次，未把冷样本混进暖缓存指标：

| 形状 | 冷建图+规划+提交 | 暖 P50 | 暖 P95 | 建图/距离表 | 命中/动态重规划 | 扫描节点 |
|---|---:|---:|---:|---|---|---:|
| 1×4 长条 | 79.875 ms | 0.113 ms | 0.161 ms | 1 / 1 | 29 / 0 | 8516 |
| 三格 L | 56.401 ms | 0.073 ms | 0.114 ms | 1 / 1 | 29 / 0 | 8736 |

两流 RNG 状态/计数增量均为 0。这是同一台 Mac 上两 worker 验收中的一次 fixture 测量，排除 Game/NPC/环境/渲染，不是手机基准、实际命令 P95 或自然场地追击；单样本 cold 也不是冷建图分位数。暖指标低于设计调优目标，冷建图同步耗时仍须后续优化。

依任务书不跑完整 npm test、全部 test:ext、removal 或 CE full/gen。没有新的 skip/todo，没有修改旧测试/守卫/断言/夹具，没有基线或 trace 重录，两个旧生成基线、UR2/3/4 和 giants 内容/trace 与 HEAD 保持原字节。

浏览器技能客户端已实际尝试：Vite 监听 `127.0.0.1:5408` 返回 EPERM，Chromium 因 MachPort bootstrap 权限拒绝退出（客户端 exit1），无截图可供检查。日志 `/private/tmp/p4b-browser-{vite,client}.log`。本轮不宣称浏览器、触屏或四地图新形状截图验收。

开发失败只涉及新增专项：初轮错误假设所有 16 格长条 sweep 都≤256，改为真实超界负例；动态避让初轮误以为必须平移，实际合法最短替代是反向旋转，改验具体 -1 方向与有效旋转计划；类型检查发现新增测试误用不存在的 FIRE，修为实际 PLAIN_FIRE 并补正/高权重距离不同断言，以及删新增测试未用 import。旧测试完全未修改，无旧前提修订/反事实重录。

## 完整 4b 剩余项与限制

1. 原生内容贡献注册任意 mask+pose，在**数据安装、创建、读取**处调用能力编译及预算/镜像校验，并提供会话所有的可信目录；当前编译器只有 fixture 执行接线，4a0 schema 仍保留未来镜像建模。
2. 把新图/旋转计划接 Game/NPC 的追击、逃跑、waypoint、回归、闪现等入口；通过 actor 原生耗时点提交旋转及驻留环境，公开输入仍经 executeCommand。当前 actionCost 只是严格正整数计划声明，没有真实 NPC 转向时间测试。
3. 推广 SquarePlacement、生产 canFitAt 的 r0 分支、完整落点/传送/击退/坠落/重访/复制/变形与形态身份校验；有 shape+pose 的全层及 pending/缓存存档校验。fixture clone/codec 不能替代这些生产接线。
4. 任意 mask 的真实环境一次归并、接触近战、弹道首碰、视野、D08、显示模型/尾格交互与实际组件/四地图验证。当前只有空间去重/标签/轮廓原语覆盖，原 4a 回归保持通过不等于此项已完成。
5. giants 原创可旋转长条/L 敌人及独立场地，按位姿图/扫掠实际验入口和可达；自然生成种子、真实 Game save/load/replay/seek/续录与样例 trace，数据变化如需重录必须先单变量归因。
6. 性能目前只测 fixture 规划+原子提交，未测实际 Game 调度/环境/渲染、自然堵路或极限 16 格四朝向。冷建图同步耗时显著高于暖缓存，不能以暖 P95 冒充整体命令或手机帧率。后续开放生产前须实测冷建图与动态重规划成本。

4c 的局部 HP/破坏、4d 复合体与 4e 主动转换均未实现。本轮停在上述可独立测试、生产门未半开放的 4b-0 子里程碑。
