# 4b 完整执行报告：任意刚体形状与四向旋转

2026-10-05，分支 `ext/phase4`，起点/交付 HEAD 均为 `6f71e0e3c639bb7df5f599923c30ecd84fa7cd48`。维护者已提交 4b-0；本轮按 [任务书](phase4b.task.md) 与续轮授权，完成旧报告“完整 4b 剩余项”1–6 的生产实现和开发期功能验收。**生产开放可信注册的独立 mask 与四向旋转，未 commit、暂存或 push。** 文末保留 4b-0 报告原文，历史中的“生产未开放”描述只对应当时状态。

## 本轮范围与共享代码

| 文件/函数 | 本轮变化与合同 |
|---|---|
| `SpatialSchema.SpatialCatalog`、`nativeForms.validNativeForm/nativeFormSpatial` | 原 `size:2|3` 与新 `footprint:{geometry,poses}` 互斥；安装先编译连通性、原点、格数/跨度、固定或四向、无镜像及 sweep 预算；空/null/多余字段拒绝。创建从安装定义选初态，旧姿态若被新形状支持则保留。 |
| `ExtensionRuntime.spatialCatalog/attachCreature`、`CreatureSpatial.bindSpatialCatalog` | 可信目录属本局启用模块；不可变注册定义与纯编译结果派生、不持久化。目录存外部 WeakMap，getter 在无任意形状声明时复用 builtin 目录，不给普通 runtime 加字段。component 绑定覆盖假设锚点 DTO、复制与 codec；卸载/退休清绑定。 |
| `MonsterLifecycle.ownedMonsterList`、Game `spatialCatalog/createModuleMonster/canCreateModuleMonster` | 接收 Game 的目录再校验所有权入口与 typeId/body 身份，旧局可信对象也不能跨到未安装局。全 mask 创建预检在构造/ID/RNG 之前；方形继续调用原 `canCreateSquareMonster` 快路径与既有测试接缝。 |
| `RigidPosePathing.buildTerrain/scan/dynamicTerrain` | 静态每格一次汇总地形/区域/成本，整数偏移编完整 fit/平移/精确 sweep 旋转表；逆转共享同一体积，单位成本用 typed-array BFS、非单位保留 Dijkstra。动态重规划只作一次 active-or-reserved 占位快照，再按实际 offsets/sweep 编临时表；仍现场复核返回动作及最终提交。没有剪 pose、截 sweep、按时间放弃路线或放宽碰撞。 |
| Game `planSquareStep/rotateSpatialActor/squareDistanceValues`、Monster `applyPlannedBodyStep` | 方形仍 r0 原服务；注册非方形按需创建新图。追击、逃跑、waypoint、守卫回归、尸体移动与 blink 偏好统一读实际身体。NPC 转向在原 executeCommand 调度内提交检查计划，写入正 `ticksUntilTurn`；固定锚点，终态环境结算一次，新旧格接触与视野同步。提交前刷新 cohort，规划后新增生物也能挡住 sweep。恶心/蛛网等原生行动前提保留。 |
| `SquarePlacement.squarePlacementCandidates`、`CreatureSpatial.canFitAt/collectBodyTargets`、`LevelTravel.scheduleLevelFollowers/restoreSquareTravelPosition` | 保留兼容函数名，方形双循环/r0 换为当前 pose 的真实 offsets；落点、传送、blink、击退/拉拽、坠落、重访、跨层与补旅程沿原生规则验全 mask。凹角/孔洞不占位。跨层距离及补旅程可含旋转边；历史补旅程沿原 CE 行为不重复即时环境。 |
| `Monster.copyForClone/polymorph`、Game `polymorphBoltTarget` | clone 深拷贝组件与 pose 并重绑目录；被动 polymorph 先选新形态、用真实新身体找合法落点后才修改。新形态不支持旧 pose 时取其声明初态；失败不改身体/关系、不分配实体。没有新增主动转换命令。 |
| `EntitySnapshot.restoreEntityGraph`、`WholeRunSnapshot.snapshotSquareWorld/decodeWholeRunWorld/isWholeRunSnapshot/decodePlayer`、Game `loadSnapshot` | 仅用已安装目录校验存档定义闭包，不从保存的 geometry 授权注册；当前/缓存/休眠/pending/携带/炼狱统一 shape+pose、层预算、边界和所有权检查。读档先构建 detached 候选，发布期间用派生目录绑定，最终才附加会话钩子。临时 Player 解码恢复 live ID 分配器，后续负例拒绝也不泄漏 ID。 |
| `MonsterBody.publicMonsterBody`、`MonsterSidebar.visibleMonsterRows`、Sidebar/ContextPanel/ThemeNearby、基础 locale | 实际 mask 的公开可见 cells、一行一主字形；任意形状不再误显示 sqrt(K)×sqrt(K)。完整可见才公开总格数，部分可见隐藏总数；三个组件用 i18n `sidebar.body_cells`。四地图共用实际轮廓和空格，无新美术素材。 |
| `SideChamber.rigidSideChamberValid`、Game `publishSideChambers` | 现场枚举所有有效锚点×pose，以完整 sweep 做旋转边，验证全部有效位姿可达、真实初态净空、入口和玩家绕行；原方形验证保留。 |
| 测试清单、`u03-state-contract.json`、架构与 progress | 新专项登记唯一归属；既有可选 squareMotion 合同说明新增按需 rigid 图，无新增 Game 持久字段/存档包络。 |

普通局全对象图零影响守卫保留原基线与原断言。玩家仍 1×1；镜像、部分旋转集、动作锁、复合体和局部 zone HP 关闭。固定形状不产生旋转边，builtin 方形继续只有 r0。几何围绕整数原点格中心转动；180° 仍逐段检查两个 90° sweep，动作成本为两倍 movementSpeed。空间标签随 pose 编译保留，为 4c 预留，不实现部位战斗。

## 原创内容、自然种子与真实闭环

`src/ext/modules/giants/data/definitions.json` 新增 **棘脊爬兽 `giants.spine-crawler`**：端点锚定 1×4，r0/r90/r180/r270，HP150、accuracy90、defense30、damage5–10、movement/attack100；中文原创名称/描述在模块 locale。`giants.spine-chamber` 为 D9–14、chance100、priority1、16×12、5格入口，保持每层至多一个成功场地及有限候选/跳过收据。没有移植商业数据或素材。

自然验收 **seed7309、wizard、D11、1174 条真实命令**；Boss ID277，region276，初始锚点(25,9)、pose r0、HP150。`naturalSpine()` 从真实新局沿 move/search/item/stairs/wait 等公开入口到场，无地图揭示、HP/坐标修改或调试出生。D9 无适合场地、D10 被既有场地预算占用，D11 成功；不是保证每层必出。新自然 trace 为 `data/spine-natural-trace.json`，记录路线哈希、地图/实体、双 RNG、模块收据与身体状态。commandsHash=`2937b269b0c94d16606dfff5bd65e846bd7d09c9389c97bc2f986af2f6852acb`，新trace文件 SHA-256=`46e777177526404be4c0e653b82fe7bf91be4dbf052161affdc866b10afe3d7b`。

该自然来源完成实际 Game save/load、逐事件 replay、seek(0/中点/结尾) 与续录。另有明确标为诊断的 **r270 原生样例**：通过真实 wait 命令验证每事件机械世界、存档前缀续玩、非顺序 seek 与追加录像。它证明非初态 pose 的 codec/调度闭环，不冒充自然生成证明。native birth、完整四 pose 净空/sweep、真实 Boss HUD 另有专项。

## 测试证据与旧前提/trace 处理

在 4b-0 原有 40 项基础上，新增/扩充独立正向动态寻路对照、真实 Game 四形状×四 pose 环境/孔洞、D08、近战/弹道首碰、四地图实际绘制、部分可见/尾格检查、clone/位移、NPC 正耗时与终态环境、原生数据/创建/跨局/读档负例、被动变形原子失败、r270 pending/缓存层及原生录像/自然 trace。新增文件 `phase4b_game_rigid.test.ts`、`giants_rigid.test.ts`、`giants_spine_trace.test.ts`，与扩充 pose 图共 **29 项**；4b 专项总计69项。

连续 sweep 原有独立 polygon clipping 参照保留；静态四形状×四 pose×地形权重与新的四形状动态占位路线，均与独立正向 Dijkstra 比较，不读取生产 fit/旋转/距离表。新增预算负例包含17格、非连通、镜像/部分姿态、16格端点长条 sweep 超256；同一16格长条固定 r0 合法。null footprint 拒绝。

只修订两份旧内容前提：

| 旧测试 | 单变量反事实 | 前提修订 |
|---|---|---|
| `giants_contract.test.ts` | 仅回退 `definitions.json` 到 HEAD，旧合同与旧 trace 共5项通过，测试/其他生产文件保持新版。日志 `/private/tmp/p4b-content-counterfactual.log`。 | forms/templates/nameKey 个数2→3；原两物种数值、独立性、原模板等断言保留。 |
| `giants_colossus.test.ts` 的 stable competition | 同样仅回退内容文件，原测试1项通过；日志 `/private/tmp/p4b-colossus-counterfactual.log`。 | D9 contributors 新增 spine-chamber，D14 数量1→2；D7/8排序、每层至多一个成功场地、budget收据全部原断言保留。 |

没有修改零影响、i18n、模块边界、预算或其他守卫。首个候选的零影响4项失败来自 runtime 普通字段引入派生目录，改生产为外部 WeakMap/getter 后原基线通过；原方形 final-occupied 负例来自预检接缝绕过，恢复委托原 `canCreateSquareMonster` 后通过。新负例还发现并修复了旋转入口旧 cohort 索引、detached Player ID 泄漏，以及把 typeId/form 同时伪装为普通物种但保留任意身体的读档绕过。最终类型身份收紧后，四个新增环境测试暴露诊断物种仍继承 rat 的旧目录免疫；诊断定义显式清空该免疫/减免前提后保持原“一次混乱”断言，正式 native form 默认本就为空。最后校对修正了性能记录的暖样本切片：只取真实命令的29次暖规划，后续两次诊断规划单列。失败日志保留，首轮候选不算最终门禁通过。

两份旧 giants trace 先单变量归因，后用原 `BROGUE_CAPTURE_GIANTS_TRACE=1` 捕获入口重录；**每份仅一个叶字段 extensionsHash 变化**，来源为新增内容的 rules fingerprint。commands/commandsHash/nativeWorldHash/双 RNG/region/state/Boss 均不变：

| trace | extensionsHash 旧→新 | 文件 SHA-256 旧→新 |
|---|---|---|
| D3 natural-trace | 20c0b82b60b32144cdd91efdf26d76a3ca06c3a985cb2967b1eacc0b28492417 → 094006ecc8fbdb6a831e457ac12405be8b083a9ad7a5aa69a33815c89e2aaf3a | 00ec08b193e7a66f3e9d1f4197a8e4b680110eed7af6aa9af44215594c210901 → b3e79e43b0cb4bc38ee25e2c0ce1cdd326a5ac0e2188f0e4dd29f1c77a1b05b8 |
| D7 colossus-natural-trace | 140654aa9ef02c45014199333b054035dbbba947961802778b0d6eb8ee4b2231 → 5996b34dc89f7aba9da68372689c02f7f948644677db8a063de486ffa0b96fdc | b1d44ad632256c2ee0f5c534820ed37de0ff829ff71d848d27e231bc60a29e3a → 0cb73aa6e39ca14191276943ed82fe2556905e85a5fac9ab2694f6566b0c0a9f |

两个普通生成基线与 UR2/3/4 文件保持 HEAD 字节；不做旧存档迁移，旧 giants 指纹的档/录像按原兼容合同拒绝。

## 最终开发期门禁

统一 Node **24.19.0**，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。最终同一冻结候选以下七项全部 exit0：

| 门禁 | 结果 | 命令耗时 |
|---|---|---:|
| `node scripts/check-module-boundaries.mjs` | 模块边界/唯一测试归属通过 | 1.56s |
| `npx vue-tsc -b` | 通过 | 6.86s |
| `npm run build` | 通过；原有 >500 KB chunk 提示保留 | 9.33s |
| 直接相关 Vitest 集合 | **37 文件 / 462 项通过**；4b共69项、4a0零影响与全部4a专项、全部giants、UR2/3/4、U03/换层/录像、生成回滚、源码/i18n/卫生/归属守卫 | 251.60s |
| `c_4a_terrain_catalog -t 白名单` | 1项通过、29项被选择表达式过滤；未跑重型普查 | 2.03s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16 子集通过**；真实 Game 新局/游玩/save-load/逐事件 replay/seek/续录 | 67.31s |
| `npm run test:drift -- --maxWorkers=2` | **4 文件 / 5 项通过**；两个普通生成基线、原giants两trace、新棘脊trace | 55.74s |

smoke installed 为 combat/giants/growth/narrative，`engine.status=passed`、`requestedScopePassed=true`；browser=not-run、整体 passed=false 是脚本对浏览器未验的口径。SSR HMR WebSocket 的监听 EPERM 日志保留，没有改脚本掩去它；engine-only 的实际退出码为0。

843 份 src/scripts/构建配置输入在每项门禁前后完全相同，变化列表均为空；路径排序紧凑JSON散列集合 SHA-256 为 `95468a9701695c0a1b050caa01092d332b68732da3e9e77fe8817d17279e8298`。执行 runner `/private/tmp/p4b-complete-v4-gates.py`；精确命令、输入逐文件散列、耗时/退出码登记 `/private/tmp/p4b-complete-v4-gates.json`，相关清单 `/private/tmp/p4b-complete-v4-related-files.json`，门禁结束 UTC `2026-10-05T05:59:15Z`。随后只补文档，原始证据均在仓库外。HEAD 未变、暂存区空，交付 `git diff --check`、变更文本LF检查通过。

依任务书没有跑完整 npm test、全部 test:ext、removal 或 CE full/gen。没有新增 skip/todo；上述 `-t` 的未选用例是定向选择，不冒充整套通过。

## 实际 Game 性能与限制

实际 Game 测量文件 `/private/tmp/p4b-game-performance.json`，Node24.19.0、79×29、两个worker专项环境。诊断注册形状运行真实 `executeCommand(wait)` 的NPC追击与环境，不是fixture单独提交：每形状30条命令，第一次单列冷样本，其余29次为暖P50/P95；另给出新增生物挡住下一步时一次完整动态重规划。规划时间包含冷建完整地形图、目标距离表与选步，命令时间额外包含Game/NPC/环境/视野；两者均不含浏览器绘制。

| 形状 | 冷规划 | 暖规划 P50 / P95 | 冷整命令 | 暖整命令 P50 / P95 | 堵路重规划 |
|---|---:|---:|---:|---:|---:|
| bar | 14.694ms | 0.091 / 0.198ms | 21.839ms | 6.587 / 6.900ms | 8.594ms |
| L | 9.672ms | 0.062 / 0.086ms | 16.044ms | 6.245 / 6.738ms | 5.037ms |
| 16-cells | 9.541ms | 0.335 / 0.466ms | 16.384ms | 6.712 / 7.669ms | 10.502ms |

三形状各静态图/距离表1/1、暖缓存命中29、正常追击动态重规划0；加入挡路生物后每形状恰好重规划1次，结果仍为合法step。16格用端点4×4完整四向，额外覆盖规模上限。本次实际 Game **长条/L及16格的冷规划均≤20ms，满足开发机单次冷建目标**。冷规划包含建图后额外工作，故同一调用里的建图成本也在20ms内。

4b-0 的79.875/56.401ms是旧实现的fixture测量；本轮曾先修静态冷建，再发现动态重规划107/70/196ms，第二次去除逐节点重复元数据/地形查询后降到本表。保留完整图与检查的代价是有界typed-array内存和同步建立，而非分帧；本局按需懒建、静态表复用、逆旋转共享体积、单位成本BFS去堆开销是本轮取舍。地形revision和LRU8淘汰会再冷建，移动目标距离表仍会再扫描。

没有以动画采样、包围盒、暖缓存平均或路线截断换取性能。完整有效姿态图仍同步建立、至多一次完整动态重规划；图静态成本与动态临时表有明确 W×H×A / K / sweep 上限。测量是开发机 Node CPU 单次样本与29次暖动作，不是冷分位数、手机帧率或 GPU 预算。

功能实现剩余项：**无（本轮4b授权范围）**。4c/4d/4e、镜像与旧档迁移不在本轮。Vite/Chromium 在本环境先前实测受到监听/MachPort EPERM 限制；本轮以真实 Game、公开投影/实际绘制、SFC编译和 engine-only composition 验收，**没有浏览器截图、320/390触屏、GPU渲染或真实手机性能验收**，这些限制未以测试绿掩盖。大体积原始证据/截图不入库。

---

## 4b-0 历史报告（原文保留，以下均为当时状态）

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
