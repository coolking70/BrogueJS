# main 深层行动性能报告

日期：2026-10-14。分支 `perf/main-late-depth`，起点 `855a924`；未 commit。

## 结论

确认并修复光照的重复怪物占位扫描：一次同步光照批次内缓存纯查询，下一次视野更新或动态光照帧重新建表。游戏规则、光源顺序、阴影算法、随机数消耗、存档/录像格式不变。

完整录像 17,737 条零 OOS；32 个边界摘要相同；最终世界 5,041,466 个叶子逐字段比较，差异 0。D22 median 40.36→21.66 ms，D28 75.61→31.68 ms；D28 动态光照 21.24→3.34 ms。

## 测量方法与口径

- 输入 `/private/tmp/mainperf/replay.json`：version 2、seed 438491256、wizard、17,737 条事件。SHA-256：`da5becb23ff92f5878f1c33cfc2e9a515cdaf51e67781f9d362909f2041f8576`。
- macOS arm64 / Node 24.19.0；Node 路径置于 PATH 首位，`NODE_OPTIONS=--max-old-space-size=3072`。未进行手机设备或 GPU 实测，以下绝不是手机 FPS。
- `scripts/profile-late-depth.mjs` 通过现有 `loadReplay()` / `replayStep(true)` 导入逐条回放；开启与 Canvas 相同的 `animationEnabled`，每条用 `tickAdvancement(1000)` 同步排空推进器。无真实等待，不吞异常、不修改录像检查点。空 `onRenderRequested` 保留真实的视野准备。
- 计时覆盖 replayStep、全部强制回合、推进收尾、原检查点校验和视野准备；不包含文件读取、初始化、世界快照/散列、磁盘写入、Pixi 绘制或 Vue DOM。深度按命令**开始时**归属，进入 D28 的命令 17705 属于 D27，故 D28 有 32 条。命令编号为 1-based。
- median 为排序后第 floor(n/2) 项，P95 为 nearest-rank；包含零回合 UI/寻路启动命令。所有原始逐命令数据在 `*.rows.json`，报告另列单回合与多回合尖峰。
- Vite SSR 初始化尝试监听 24678 WebSocket 时被沙箱拒绝（EPERM）；本工具直接调用 SSR 模块，不使用该 socket，完整基线/修复后重放和 profile 均已正常退出 0。
- 未修改代码的首次 animation=false 试跑在 2640（首次坠落后 D7）出现实质 RNG 差异；有/无渲染回调均如此。改用真实动画推进路径后完整录像通过，已保存 `no-render.oos.json`。这是原有执行模式差异，本轮未改其规则，也未绕过 OOS。
- 基线 `animated.*` 和修复后 `after.*` 均不启用 CPU profiler，测量时未运行本任务的测试套件。外部系统负载和 GC 仍会造成离群点；不能把单次换层 max 的上升解释为确定的回归。

## 按深度耗时分布（ms）

| 深度 | 条数 | 前 median | 前 P95 | 前 max | 后 median | 后 P95 | 后 max |
|---|---:|---:|---:|---:|---:|---:|---:|
| D1 | 445 | 8.37 | 9.39 | 285.00 | 7.87 | 8.98 | 259.24 |
| D2 | 536 | 5.27 | 7.12 | 479.92 | 5.04 | 7.16 | 464.13 |
| D3 | 393 | 9.27 | 13.14 | 296.28 | 8.49 | 12.75 | 310.11 |
| D4 | 671 | 10.91 | 17.70 | 297.06 | 8.97 | 14.79 | 305.77 |
| D5 | 498 | 7.23 | 12.57 | 431.01 | 5.31 | 10.09 | 418.18 |
| D6 | 807 | 9.35 | 14.56 | 341.29 | 11.08 | 18.13 | 311.75 |
| D7 | 656 | 7.22 | 25.63 | 501.47 | 7.37 | 24.04 | 657.60 |
| D8 | 1239 | 11.76 | 16.72 | 591.45 | 8.91 | 15.37 | 538.56 |
| D9 | 749 | 11.09 | 15.95 | 497.73 | 8.81 | 12.90 | 456.49 |
| D10 | 943 | 11.00 | 17.81 | 599.95 | 8.47 | 14.11 | 467.02 |
| D11 | 686 | 12.47 | 16.54 | 388.20 | 10.03 | 14.06 | 363.86 |
| D12 | 531 | 14.18 | 21.59 | 434.56 | 9.11 | 13.45 | 390.29 |
| D13 | 32 | 17.12 | 34.04 | 462.47 | 9.17 | 25.27 | 423.95 |
| D14 | 304 | 11.48 | 18.94 | 528.56 | 6.29 | 12.09 | 474.86 |
| D15 | 1147 | 12.42 | 34.87 | 596.14 | 8.97 | 22.29 | 512.81 |
| D16 | 1259 | 14.13 | 24.19 | 528.98 | 9.45 | 14.57 | 471.10 |
| D17 | 473 | 16.54 | 26.72 | 940.90 | 10.94 | 19.50 | 812.64 |
| D18 | 647 | 15.48 | 24.08 | 575.52 | 9.33 | 15.29 | 691.70 |
| D19 | 840 | 14.31 | 26.31 | 484.38 | 12.20 | 25.82 | 560.01 |
| D20 | 562 | 21.56 | 34.94 | 870.15 | 14.44 | 29.50 | 626.95 |
| D21 | 437 | 27.31 | 38.80 | 629.70 | 16.86 | 26.67 | 708.99 |
| D22 | 1231 | 40.36 | 64.54 | 519.04 | 21.66 | 36.52 | 622.96 |
| D23 | 422 | 20.56 | 32.59 | 535.52 | 14.12 | 27.73 | 600.56 |
| D24 | 608 | 23.46 | 39.87 | 520.14 | 11.63 | 20.94 | 502.22 |
| D25 | 954 | 25.71 | 77.97 | 576.85 | 11.32 | 38.04 | 534.22 |
| D26 | 70 | 50.96 | 55.13 | 388.31 | 15.15 | 22.42 | 363.78 |
| D27 | 565 | 30.72 | 51.02 | 704.70 | 15.04 | 31.98 | 579.00 |
| D28 | 32 | 75.61 | 135.29 | 138.05 | 31.68 | 65.87 | 82.53 |

全部命令计时合计 314.00→212.24 秒；包含快照等工具开销的循环时间 325.83→225.26 秒。

## 命令类型与异常区间

| 类型 | 条数 | 前 median / P95 / max（ms） | 后 median / P95 / max（ms） |
|---|---:|---|---|
| `auto_step` | 10099 | 12.94 / 44.77 / 596.14 | 9.85 / 23.29 / 691.70 |
| `move` | 3687 | 15.57 / 53.33 / 940.90 | 10.58 / 30.03 / 812.64 |
| `auto_explore` | 3310 | 5.63 / 48.76 / 109.01 | 2.27 / 25.42 / 95.26 |
| `wait` | 69 | 22.67 / 45.22 / 364.12 | 13.69 / 25.52 / 311.75 |
| `item:command` | 103 | 13.63 / 49.69 / 69.28 | 10.36 / 29.51 / 54.04 |
| `search` | 102 | 12.66 / 19.40 / 24.55 | 8.94 / 12.99 / 18.40 |
| `toggle_inventory` | 112 | 2.36 / 10.68 / 16.31 | 1.16 / 2.87 / 4.63 |
| `escape` | 114 | 2.39 / 10.79 / 16.18 | 1.16 / 3.09 / 4.37 |
| `mouse_travel` | 36 | 4.28 / 40.34 / 71.33 | 2.14 / 32.90 / 33.85 |
| `travel_stairs` | 85 | 2.29 / 6.27 / 14.46 | 1.65 / 3.02 / 3.45 |
| `pickup` | 12 | 2.36 / 19.40 / 19.40 | 1.10 / 11.39 / 11.39 |
| `confirm_target` | 1 | 16.97 / 16.97 / 16.97 | 11.89 / 11.89 / 11.89 |
| `auto_rest` | 1 | 13.66 / 13.66 / 13.66 | 9.09 / 9.09 / 9.09 |
| `throw_item` | 3 | 3.17 / 3.17 / 3.17 | 1.32 / 1.33 / 1.33 |
| `discoveries` | 1 | 3.26 / 3.26 / 3.26 | 1.24 / 1.24 / 1.24 |
| `help` | 2 | 1.80 / 1.80 / 1.80 | 0.98 / 0.98 / 0.98 |

| 命令 | 起始深度 | 类型 / 推进回合 | 前 ms | 后 ms | 说明 |
|---|---|---|---:|---:|---|
| 11369 | D17 | move / 0 | 940.90 | 812.64 | D17→18 新层生成 |
| 13228 | D20 | move / 42 | 870.15 | 626.95 | 连续麻痹回合 |
| 13238 | D20 | move / 37 | 635.60 | 407.82 | 连续麻痹回合 |
| 13415 | D20 | move / 45 | 475.81 | 441.29 | 连续麻痹回合 |
| 14197 | D22 | move / 1 | 237.48 | 119.94 | D22 单回合尖峰区间 14197–14201 |
| 14198 | D22 | move / 1 | 222.67 | 97.62 | 同区间 |
| 14201 | D22 | move / 1 | 169.66 | 132.32 | 同区间 |
| 16468 | D25 | auto_step / 1 | 126.94 | 67.31 | D25 自动行进尖峰 |
| 17705 | D27 | move / 0 | 704.70 | 579.00 | D27→28 新层生成 |
| 17721 | D28 | move / 1 | 131.61 | 82.53 | D28 高怪物密度区间 17721–17726 |
| 17724 | D28 | move / 1 | 135.29 | 32.02 | 同区间 |
| 17726 | D28 | move / 1 | 138.05 | 48.20 | 同区间 |

D22 最多 33 只怪，D28 最多 46 只；并非怪物总数随局长无界增长。D25 的 16297–16468 也有密集战斗尖峰。D28 只录到开层后少量命令，不能外推整层的统计分布。

## CPU 热点与复杂度

`profile-before.cpuprofile` 使用 Node inspector 的 V8 CPU profiler（等效于 --cpu-prof），1 ms 采样，覆盖真实命令 13800–17737。另 `render-profile.json.cpuprofile` 单独覆盖 D28 动态光照与展示投影。Vite SSR 的 profile 行号对应转换结果；下面映射回仓库源码行。

| 热点 | 样本 self / inclusive | 根因 |
|---|---|---|
| `src/engine/Core/Game.ts:2470 hasCreatureAtForLight` | 后半局 self 65.34 s / 总采样 131.20 s（49.8%） | 每个光照掩码查询都 `.some()` 线性扫描当前怪物 |
| `src/engine/Core/Game.ts:2492 updateVision` | inclusive 82.86 s（63.2%） | 多个光源重叠，每回合及显示准备会多次全量计算 |
| `src/engine/Lighting/LightMap.ts:75 dance` → 同一占位查询 | 独立渲染 profile 查询链约 1.13 / 1.52 s（74%） | 每 50 ms 重放全部光源，重复放大同一查询 |
| `src/engine/Core/Game.ts:9947 getMonsterAt` | self 5.26 s（4.0%） | 怪物移动/通行等通用占位查询仍为线性扫描 |
| `src/engine/Map/DungeonFeature.ts:228 terrainFlagsOfCell` | self 4.72 s（3.6%） | 多消费者重复折叠地形层旗标 |
| `src/engine/Environment/Gas.ts:366 updateGases`、`src/engine/Core/TimeCoordinator.ts:287 updateEnvironment` | 环境更新仍占非零 CPU | 全图扫描、气体更新和怪物效果；多回合命令成倍执行 |

上述 inclusive 重叠，不能相加。广区间 profile 包含换层快照/散列等工具开销，因此不把整个采样时长当作引擎 CPU。最慢独立命令 profile 补充如下（排除 Profiler.start/stop 的 inspector `post` 开销，不用 profile 总时长替代命令耗时）：

- `slow-before.11369-11369.cpuprofile`：移动触发坠落换层，generateDepth inclusive 约 781 ms，其中 `src/engine/Generator/Architect.ts:483 generateLevel` 约 583 ms、runAutogenerators 458 ms；`src/engine/Map/DungeonFeature.ts:539 levelIsDisconnectedWithBlockingMap`、`:497 floodConnect` 与 `:644 levelIsDisconnectedOnMovementGraph` 是连通性热点。
- `slow-before.13228-13228.cpuprofile` / `13238-13238`：真实推进器执行 42/37 回合；updateVision inclusive 约 404/366 ms，占位查询约 290/271 ms，另有 updateGases 与 getMonsterAt。
- `slow-before.14197-14201.cpuprofile`：5 条高负荷命令中 updateVision 约 415 ms、怪物 takeTurn 约 280 ms；`src/engine/Map/LoopMap.ts:332 pruneLoopMarkings` self 约 30 ms，说明这里还存在地形连通拓扑工作。

这些短 profile 使用 `SEQUENTIAL_LIGHTS=1` 反事实适配器恢复逐源 paintLight（不改校验和规则），从原录像入口重放至 14201：零 OOS，之前全部换层摘要与真正修改前的基线相同。原始未修改源码的长区间 profile 已覆盖 14197–14201 与末层最慢区间。

原占位工作量近似 O(Q × M)，Q 是所有光源阴影投射的查询次数，M 是当前层怪物数；深层较多发光地形、火焰和怪物共同放大。修改后是 O(Q + U × M)，U 为这一批不同查询格数，且每个谓词 U ≤ 地图面积 79×29。不是跨回合缓存；不同谓词用独立表，拒绝结果也缓存。

寻路方面，现有 `Pathfind.ts` 已用 `PathFrontier` 的有索引堆，怪物寻主已有单次搜索通行缓存；本次 CPU 证据没有把 A* 列为首要瓶颈，因此未改变路径顺序、平局裁决、搜索范围或路径规则。通用 getMonsterAt 线性占位查询仍会放大多个 AI 消费方的成本。

## 修复范围与回归保障

- `Game.updateVision()` 按原地形→生物→燃烧→矿灯顺序收集光源，再调用 `LightMap.paintLights()`；本函数没有异步交错，收集期间没有世界写入或 RNG。
- `paintLights()` 每次创建局部 Uint8Array 三态表；`paintLight()` 单独调用保留原回调语义。`applyLight()` 保留原计算体。
- `dance()` 每帧重新采样和重新建缓存；保存的是**原始实时回调**，不会把旧怪物位置保存在下一帧。颜色采样顺序和 display RNG 已逐帧对比。
- 没有新增 Game 字段、没有改变存档/录像格式，不需要 U03 新字段登记；未改旧守卫、旧夹具或黄金 trace。
- `perf_late_light_batch.test.ts` 已登记常规套件：96 个重叠光源与逐源路径逐格比较 RGB/阴影；查询次数 ≤ 地图面积，且比逐源路径少至少 16 倍；250 ms 的宽松耗时上限用于发现灾难性退化，主要门禁是稳定的工作量界限。另验证移动/地形变更、不同谓词、单次调用、显示随机流和实质随机流。

## 渲染侧实测与限制

| 快照 | 光源 / 怪物 | 占位查询：逐源→批次 | dance median：前→后 ms | 投影 median：前→后 ms |
|---|---|---|---|---|
| D19 | 129 / 11 | 4252→628 | 4.06→1.06 | 1.08→1.10 |
| D22 | 174 / 20 | 6143→786 | 10.35→2.11 | 0.95→0.99 |
| D27 | 189 / 14 | 5302→659 | 6.62→1.54 | 0.99→1.03 |
| D28 | 213 / 44 | 6545→741 | 21.24→3.34 | 1.42→1.48 |

真实录像快照、各 20 帧预热 + 60 帧采样；`observeDisplayFrame` 包含整图外观计算、结构共享比较、冻结 DTO 和日志复制。渲染测量前后模拟 RNG 严格一致。这里 D19/22/27 是刚入层的快照，D28 是录像末尾，不能比较它们的探索面积来推断整层 DOM/GPU 负担。

- **Canvas/Pixi**：`src/components/GameCanvas.vue:511` 等处仍扫全图，但地面物品已每帧建索引；retained geometry 缓存以有限图标类别为键，颜色闪烁不新增几何。现有 `profile-retained-map.mjs` 能在 Node 测绘制构造和实际 Pixi tessellation，不能测 GPU 上传、光栅化、移动端 DPR 或浏览器布局。本次合成的 320/1,200/3,713 格 retained 绘制构造+tessellation median 为 0.213/0.802/2.569 ms，P95 为 0.326/1.103/3.686 ms；持续变色仍只生成 7 个几何 context、7 次 tessellation。3,713 格是超出实际 2,291 格地图的压力场景。脚本退出 0，关闭 Vite 时有 dependency scan cancelled 告警；结果文件已完整写出，不能据此推算手机 FPS。
- **展示时间线**：录像模式不启用现场 PresentationTimeline；上表单次投影成本不是整条现场命令成本。现场每条消息/回合都可能捕获投影，复制当前档案并冻结对象，复杂度 O(展示帧数 × (地图格数 + 档案长度))。自动帧细节有 128 帧限制，必需消息不丢；输入受积压门控、消费后清理，未发现整局无限保存帧。手机上的这部分额外成本仍需真实设备量测。
- **Vue**：Game 是普通 TS 对象，没有把整个世界或录像放入深响应式树。当前 ThemeHud/ThemeLog/TargetBar 等以 100 ms 轮询给 ref 赋新数组；存在分配、虚拟 DOM diff 成本，但不是已证实的主要行动热点。
- **消息 DOM**：Logger 上限 1,360，从约第 6,000 条后不再增长；当前 App 普通 ThemeLog 只显示数条；MessageJournal 抽屉打开时渲染整份档案，最多 1,360 行。旧 Sidebar.vue 虽也有完整日志列表，但本分支 App 未挂载它，不能算作正常手机行动时的 DOM 成本。消息折叠本机 median 0.045–0.073 ms；未实测手机展开日志时的布局/滚动，不能声称其完全无卡顿。
- **录像/历史**：实时记录每条只 append，回放本身不重复录制；loadReplay 一次性复制输入，导出/存档才复制或序列化整份历史。楼层快照随访问层数增加，占用内存，但普通行动未扫描所有已访问层。未发现每步 O(历史命令数²) 的证据；保留完整录像带来的 O(n) 内存成本仍存在。

## 确定性证据

最终状态 SHA-256（前后相同）：`f281e1d7a4f7915cded4f672d0208f7fd195f2a0f5f7e628a11ffdd11f8a6350`。

比较 5,041,466 个叶子，差异 0；32 个换层/终点的世界摘要和 RNG 完全一致。只将 `savedAt` 设为 0，未剔除日志、地图记忆、实体、楼层、回合或 RNG 字段。另逐条比较 17,737 行命令元数据（开始/结束深度、类型、推进回合数、怪物数、消息数），除耗时外全部一致。

最终 RNG：实质计数 29,199,283，装饰计数 5,582，currentRNG=0。两流状态分别为 `[315237989,4082802779,608228570,1082733734]` 和 `[3214256615,1125811508,1757741724,3999024907]`。

## 验收与复现

按中档（引擎性能优化，不改规则）验收，使用完整常规套件覆盖相关黄金 trace、回放、U03 与前端守卫：`npm test -- --maxWorkers=2` 已完整退出 0（253 文件，4,522 passed / 83 skipped / 5 todo，1717.69 秒）。CE 源码未安装，相关用例按套件规则显式跳过；未新增 skip/todo。光照定向 31 项、独立 vue-tsc -b、npm run build 均退出 0。`npm run test:drift -- --maxWorkers=2` 完整退出 0（2 文件 / 2 项，82.02 秒），两份生成基线均未重录。生成档中的源码守卫定向运行也退出 0（6 文件 / 9 个选定用例，562.75 秒；126 项因 `-t` 过滤未运行，不是新加 skip）。包括 `blueprint_center` 原种子全局扫描中的源码前提，未放宽门限。

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
node scripts/profile-late-depth.mjs /private/tmp/mainperf/replay.json /private/tmp/mainperf/after
node scripts/compare-late-depth.mjs /private/tmp/mainperf/animated /private/tmp/mainperf/after /private/tmp/mainperf/comparison.json
PROFILE_FROM=13800 PROFILE_TO=17737 node scripts/profile-late-depth.mjs /private/tmp/mainperf/replay.json /private/tmp/mainperf/profile-after
node scripts/profile-late-render.mjs /private/tmp/mainperf/render.json /private/tmp/mainperf/animated.state.json
npm test -- --maxWorkers=2
npm run test:drift -- --maxWorkers=2
node node_modules/vitest/vitest.mjs run src/test/b_1a_identification.test.ts src/test/c_4a_0_layer_model.test.ts src/test/c_4a_terrain_catalog.test.ts src/test/v_1a_blueprint_items.test.ts src/test/v_2b_4_altars.test.ts src/test/blueprint_center.test.ts -t 'InventoryOverlay 不再引用|setTerrainLayer 调用点|Grid.ts 未引入|promote/fire 类字段|T1 墓碑|D1 生产代码零|D2 生产代码与数据零|D3 越界守卫|b\) 全局扫描' --maxWorkers=2
node node_modules/vue-tsc/bin/vue-tsc.js -b
npm run build
```

验收前后 `src/` 与 `scripts/` 文件逐文件 SHA-256 一致，`git diff --check` 通过。没有失败项需要反事实修订旧守卫，也没有基线/黄金 trace 重录。build 保留现有大 chunk 提示，构建退出 0。测试日志：`focused.log`、`test.log`、`drift.log`、`source-guards.log`、`build.log`。

原始录像、逐命令耗时、世界快照、CPU profiles 和测试日志均在 `/private/tmp/mainperf/`，不提交大文件。报告与三个复现脚本、性能测试以及两处生产修改留在工作区。

## 剩余瓶颈

修复后 D28 P95 仍约 65.87 ms，D22 P95 36.52 ms；手机上仍可能卡顿。`dance()` 仍每 50 ms 新建一张 LightMap 并做逐源阴影投射，光图分配/GC 与 GPU 绘制成本没有被本次占位缓存消除。下一轮应分别处理通用怪物占位查询和重复视野/全图环境扫描，不能直接删掉知识更新或改调度次数。换层仍有生成/缓存恢复成本；连续麻痹会在一条命令中执行数十回合，不能为性能缩短游戏回合。没有改动画节奏、自动行动频率、规则、生成结果或缓存跨回合生命周期。

## 第二轮（2026-10-15，未提交）

本轮起点为第一轮已提交的 `a595a4c`（`perf/main-late-depth`）。仍使用原录像及原动画推进路径；没有改动画间隔、自动行动频率、强制回合数、路径平局顺序、规则、RNG 消耗或存档/录像格式。

### 实现与缓存边界

- 光照：`LightMap` 复用显示光图、输入/遮挡缓冲与颜色对象；闪光知识计算跨采样帧复用独立临时光图，不与显示帧共享。确定性光照输入及遮挡不变时跳过清图、泼光和渲染馈送。阴影掩码保留实际访问过的遮挡格，复用前逐项校验；缓存最多 1,024 项，函数身份关联放在模块级 WeakMap，避免进入世界对象图；批次已采样的遮挡直接按整数索引校验，省掉逐灯坐标解码和回调。颜色变化可复用阴影几何及距离衰减系数，半径、位置、地形或生物遮挡改变时失效。`paintLight()` 的单次原始路径仍可作独立参照。
- `dance()` 保留每个光源的显示随机采样顺序；静态光源不再反复泼光，闪烁光源仍有原来的颜色/半径变化。没有把“玩家没动”误当成“世界没变”，也没有冻结火焰或改用实质 RNG。`Game.danceLighting()` 在只读显示计算期间共用占位索引。
- 通用占位：普通查询读取已有生命周期 Proxy 的底层实时列表；寻路、游荡目的地选择、光照和安全图的同步计算区间建立坐标索引，工作量从 O(Q×M) 降为 O(Q+M)，游荡选择期间只改变访问标记和目的地，实际移动在索引销毁后执行。区间退出（含异常）即销毁。未把整个怪物行动或 DF 事务放进缓存，保持死亡掉物/死亡 DF 的 DYING 占格、列表顺序、移动、召唤与休眠的即时语义。
- 寻路：A* 格子键使用整数，保持堆比较、插入顺序和回调次序；缺少尺寸、非整数或越界起点保留字符串路径。新增与旧版线性队列实现的逐回调对照，覆盖 512 障碍组合及边界起点。
- 视野/记忆：只缓存纯 FOV 几何，按实际不透明格、玩家坐标和半径校验。原有每次知识发布、可见性、发现消息与物品记忆均保留；地面物品一次索引保留原 `find()` 的首个匹配语义。记忆外观直接计算最终的固定暗色/楼梯色，省掉随后会被覆盖的深度渐变计算。
- 环境：气体体积缓冲复用，邻域旗标在一次同步扫描中复用，并在每个 GAS 写入点刷新。每格随机舍入、消散抽取和两轮扩散仍保持原顺序。地形晋升第二趟只遍历第一趟已标记格，顺序仍为 x/y/layer；DF 填充先检查当前掩码再读格子，仍可看见递归回调新增的后续格。
- 地形/环路：四层旗标使用同样的四项并集，保留实时目录读取。环路剥离的 DFS 次序不变，栈改存整数；纯洪泛每格只入栈一次。环路分析校验实际通路输入，重复拓扑复用结果，对外返回独立行，调用者不能改坏缓存。
- Canvas/DOM：保留显示与模拟 ticker，移除 Pixi 默认每帧 GPU 提交，只有场景、悬停、布局/镜头等发生变化才提交。日志抽屉每页最多 100 条，分页可访问全部保留消息；没有删除 Logger 档案或改变录像消息。轮询内容不变时不替换日志 ref。

没有新增 Game 字段，U03 登记无需扩展；没有改旧断言、基线或黄金 trace。共新增 14 项回归，覆盖静态零泼光/零阴影投射、光图及闪光知识缓冲复用、动态色采样及双流、遮挡与光源失效、FOV 失效、每次只读占位查询复杂度、DF 稀疏读取及递归、环路缓存隔离、气体缓冲、全目录记忆外观、日志分页可达性。

### 正式测量与确定性

正式基线从 `git archive a595a4c` 提取到 `/private/tmp/mainperf/round2-baseline-src/`，依赖指向现有 node_modules。基线与最终版本依次运行，期间没有并行本任务的测试或 CPU profiler。仍为 Node 24.19.0、3072 MB 堆；统计口径沿用第一轮，包含所有命令、换层与多回合行动，不筛掉慢命令。D28 仍只有 32 条，不能代表完整深层或所有种子。

严格门禁 `LATE_P95_MS=20` 两次完整退出 0：D22–D28 均达标。最终源码首次测量 P95 范围 6.70–18.11ms，独立完整复测为 6.65–18.81ms；D28 分别为 18.11ms、18.81ms。下表使用首次最终测量，单位 ms，median 取排序后 `floor(n/2)`，P95 取 nearest-rank；按命令开始时深度归组。

| 深度 | 命令数 | 前 median | 后 median | 前 P95 | 后 P95 |
|---|---:|---:|---:|---:|---:|
| D1 | 445 | 7.52 | 2.64 | 9.50 | 4.72 |
| D2 | 536 | 5.03 | 2.08 | 6.79 | 3.26 |
| D3 | 393 | 8.51 | 2.99 | 12.41 | 5.09 |
| D4 | 671 | 8.90 | 2.96 | 15.32 | 5.68 |
| D5 | 498 | 5.32 | 2.30 | 10.25 | 4.62 |
| D6 | 807 | 7.88 | 2.67 | 13.22 | 4.74 |
| D7 | 656 | 5.43 | 2.37 | 19.31 | 9.42 |
| D8 | 1239 | 8.30 | 2.56 | 11.99 | 4.52 |
| D9 | 749 | 8.76 | 2.75 | 13.52 | 5.29 |
| D10 | 943 | 8.28 | 2.80 | 13.96 | 5.52 |
| D11 | 686 | 9.67 | 3.31 | 13.82 | 5.03 |
| D12 | 531 | 9.39 | 3.05 | 14.03 | 5.02 |
| D13 | 32 | 9.03 | 2.64 | 21.49 | 6.27 |
| D14 | 304 | 6.32 | 2.42 | 13.35 | 4.89 |
| D15 | 1147 | 8.71 | 2.75 | 21.84 | 6.69 |
| D16 | 1259 | 9.12 | 2.83 | 14.66 | 5.57 |
| D17 | 473 | 10.73 | 3.40 | 19.26 | 7.85 |
| D18 | 647 | 8.99 | 2.68 | 15.43 | 5.63 |
| D19 | 840 | 9.53 | 2.80 | 19.11 | 6.93 |
| D20 | 562 | 11.35 | 3.56 | 21.87 | 8.28 |
| D21 | 437 | 12.76 | 3.83 | 19.29 | 7.05 |
| D22 | 1231 | 18.06 | 5.26 | 27.30 | 8.85 |
| D23 | 422 | 10.98 | 3.34 | 20.15 | 7.66 |
| D24 | 608 | 11.35 | 3.26 | 20.89 | 6.70 |
| D25 | 954 | 11.18 | 3.24 | 39.76 | 12.35 |
| D26 | 70 | 16.09 | 4.29 | 23.62 | 9.92 |
| D27 | 565 | 15.02 | 5.13 | 32.37 | 10.62 |
| D28 | 32 | 32.70 | 10.16 | 64.39 | 18.11 |

所有命令计时合计 193.41s → 67.82s（减少 64.9%）；包含快照写盘/摘要等非行动工作时，脚本总耗时 205.11s → 79.27s。换层生成和多回合行动仍可能出现高于 20ms 的单次耗时，目标仅为逐深度 P95。

两次均从开局 `loadReplay()` 逐条执行 17,737 条，零 OOS；与基线及复测逐条命令元数据、32 个换层/终点检查点相同。最终状态逐字段比较 5,041,466 个叶子，差异 0，只归一化 `savedAt`。最终 SHA-256：`f281e1d7a4f7915cded4f672d0208f7fd195f2a0f5f7e628a11ffdd11f8a6350`。

最终 RNG 与基线相同：实质计数 29,199,283，装饰计数 5,582，currentRNG=0；两流分别为 `[315237989,4082802779,608228570,1082733734]` 和 `[3214256615,1125811508,1757741724,3999024907]`。

渲染准备沿用同一组真实快照、20 帧预热 + 60 帧采样，保留闪烁：

| 快照 | dance 前 median/P95 ms | dance 后 median/P95 ms |
|---|---:|---:|
| D19 | 1.248 / 1.543 | 0.259 / 0.381 |
| D22 | 2.014 / 2.097 | 0.300 / 0.341 |
| D27 | 1.446 / 1.542 | 0.318 / 0.347 |
| D28 | 3.254 / 3.427 | 0.380 / 0.572 |

渲染测量前后均断言模拟 RNG 不变；以上只计 CPU 准备，不含 GPU、DOM 布局或手机实机。静态零泼光/零投射由回归测试验证，表中为仍有闪烁的真实场景。

正式证据：`round2-final-before.{summary,rows,state}.json`、`round2-result.{summary,rows,state}.json`、`round2-repeat.{summary,rows,state}.json`、`round2-comparison-final.json`、`round2-comparison-repeat.json`、`round2-render-{before,final}.json`。

正式迭代门禁曾在 D28 测得 P95 20.30ms、20.57ms、20.33ms，均按 20ms 阈值退出 1（依次为 `round2-final-after.*`、`round2-after.*`、`round2-accepted.*`；最后一个是预先命名，实际未验收）。继续优化闪光知识缓冲、遮挡校验和寻路格子键后完整重跑，没有放宽阈值或删除命令。中间末层快照重放只用于定位热点，不代替从开局执行 `loadReplay()` 的正式证据。

### 验收与复现

首次完整常规套件退出 1（1082.29s）：252 文件通过，U00 新开局对象图检查 12 项失败，其余 4,523 passed / 83 skipped / 5 todo。原因是阴影缓存保留了函数引用；旧守卫未改。批次末清理方案通过 U00，但 D28 P95 20.06ms，严格性能门禁仍退出 1（`round2-validation.*`）。改为模块级 WeakMap 保存函数身份后，新开局及光照定向 27 项通过（24.35s），但完整重放 D28 P95 仍为 20.19ms（`round2-measured.*`，退出 1）。继续增加衰减系数复用、游荡选择占位索引及气体循环局部读取后，相关 4 文件 / 52 项通过（24.11s）。

最终门禁全部完整退出 0：

- 独立 vue-tsc -b：8.96s。日志 `round2-types-final.log`。
- 生成档源码守卫定向运行：353.97s；Test Files  6 passed (6)；Tests  9 passed / 126 skipped (135)。日志 `round2-source-guards.log`。
- 完整 npm test -- --maxWorkers=2：1073.55s；Test Files  253 passed (253)；Tests  4536 passed / 83 skipped / 5 todo (4624)。日志 `round2-test-final.log`。
- npm run test:drift -- --maxWorkers=2：54.86s；Test Files  2 passed (2)；Tests  2 passed (2)。日志 `round2-drift.log`。
- npm run build（含 vue-tsc）：12.73s。日志 `round2-build.log`。

常规组的 CE 依赖用例按现有规则跳过；未新增 skip/todo。源码守卫的 126 项未执行来自 `-t` 定向过滤。生成基线和黄金 trace 均未重录。开发阶段 A* 的无尺寸 Grid 兼容/额外回调问题由旧守卫发现并修正生产代码；新增气体回归的初版计数初始化改为恢复同一 RNG 状态。旧断言、门限和种子均保留。

验收前后 `src/` 与 `scripts/` 的 584 个文件 SHA-256 完全一致（`round2-code-verification.json`）。`git diff --check` 通过。最终性能重放、类型检查、测试和构建使用同一源码；build 的既有大 chunk 提示不影响退出 0。

复现命令（Node 24.19.0、3072 MB 堆、Vitest 2 workers）：

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
LATE_P95_MS=20 node scripts/profile-late-depth.mjs /private/tmp/mainperf/replay.json /private/tmp/mainperf/round2-result
LATE_P95_MS=20 node scripts/profile-late-depth.mjs /private/tmp/mainperf/replay.json /private/tmp/mainperf/round2-repeat
node scripts/compare-late-depth.mjs /private/tmp/mainperf/round2-final-before /private/tmp/mainperf/round2-result /private/tmp/mainperf/round2-comparison-final.json
node scripts/compare-late-depth.mjs /private/tmp/mainperf/round2-result /private/tmp/mainperf/round2-repeat /private/tmp/mainperf/round2-comparison-repeat.json
node scripts/profile-late-render.mjs /private/tmp/mainperf/round2-render-final.json /private/tmp/mainperf/mid.state.json /private/tmp/mainperf/deep.state.json /private/tmp/mainperf/d25.state.json /private/tmp/mainperf/animated.state.json
npm test -- --maxWorkers=2
npm run test:drift -- --maxWorkers=2
node node_modules/vitest/vitest.mjs run src/test/b_1a_identification.test.ts src/test/c_4a_0_layer_model.test.ts src/test/c_4a_terrain_catalog.test.ts src/test/v_1a_blueprint_items.test.ts src/test/v_2b_4_altars.test.ts src/test/blueprint_center.test.ts -t 'InventoryOverlay 不再引用|setTerrainLayer 调用点|Grid.ts 未引入|promote/fire 类字段|T1 墓碑|D1 生产代码零|D2 生产代码与数据零|D3 越界守卫|b\) 全局扫描' --maxWorkers=2
node node_modules/vue-tsc/bin/vue-tsc.js -b
npm run build
```

浏览器可视验收未完成：Vite 监听 `127.0.0.1:5396` 被沙箱以 EPERM 拒绝；技能提供的 Playwright 客户端也在 Chromium MachPort 初始化时报 Permission denied。没有生成可检查截图，因此不声称已实测 GPU、手机帧率或分页的真实浏览器布局。相关组件测试、渲染准备测量与构建结果分别列在上面。

原始数据、快照、CPU profile 与日志保存在 `/private/tmp/mainperf/`，不提交。没有 commit/push。
