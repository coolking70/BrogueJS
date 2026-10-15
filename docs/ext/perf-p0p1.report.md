# ext P0/P1 深层性能报告

本轮 P0 基准/门禁和 P1 两批移植已完成。两组完整回放、冻结路线重建及独立 GC/CPU 观测均保持逐域/最终状态一致；稳定计数和零 OOS 硬门禁通过，绝对耗时未全面达标。相关测试保留一项经 HEAD 反事实确认的既有失败，详见测试节。开工 `ext/phase6` / `1fe7ff81da9725fa4f0de3f555e100241503b183`（含 6A1/6B1/6B2/6B3）。只读参考 main `a595a4c`、`9db964e`；不合并 main，不改数值/录像格式，不实施 P2/P3/Worker/WASM，不 commit。

## 基准与复现口径

- 当前树是 recording v4 / whole-run v7，已安装八模块（含 loot）；不能复用评估时 whole-run v6/七模块的结果。
- 正式最小配对集：seed 438491256，wizard 模式，原生 classic 与全部已安装模块启用，D1 经真实命令到 D20，D20 至少 500 个已结算玩家行动。选择路线可读取整张地图，所有状态变化仍走 `executeCommand` / `executeItemCommand`，初始化使用模块的真实 initialCommand。无直接深度、HP、地图、怪物或 RNG 布景修改。wizard 的高 HP/回合回血属于现有模式；这不是普通模式通关或人工试玩证据。
- `scripts/generate-ext-perf.mjs` 是寻路/避怪/装备/搜索/抓持者处理策略。每条命令排空动画、处理真实确认/ACK，并等待 `flushRecording()`；安全边界 `exportRecordingAsync()`。固定 Date.now 只用于可再生的捕获时间戳和合成驱动的动画墙钟；性能计时使用真实 performance.now。
- 小型 `scripts/perf/*.route.json` 保存已接受的完整命令、确认和制品哈希；`scripts/regenerate-ext-perf.mjs` 从真实开局重新执行生成 v4 录像，并强制核对完整 `JSON.stringify()` UTF-8 字节的 SHA-256（保留键/数组顺序和所有字段，忽略制品文件的美化空白），不改头、不删检查点、不自动刷新哈希。原始录像、大快照、逐命令数据和日志在 `/private/tmp/ext-perf-p0p1/`；长期来源是仓库内路线和重建脚本。
- `scripts/profile-ext-perf.mjs` 从 `loadReplay()` 原点完整回放；动画开启，挂载空渲染请求回调，每条 `replayStep(true)` 后 `tickAdvancement(1000)` 排空。先做不计时预热，单列 loadReplay 冷启动耗时。全部零回合、换层、强制多回合、256/2048 边界均保留。
- 回放也固定 Date.now 为录像捕获时刻，使动画超时保护不随宿主负载改变中间刷新次数；实际持续时间使用 performance.now。命令计时包括模拟、视野准备和生产回放验证，不包括逐命令观测字段采集/文件写入、Pixi/GPU/DOM。P50 使用排序 floor(n/2)，P95 nearest-rank，深度按命令开始位置分组；保留全部 max。
- 客观调度活跃段耗时 由 TimeCoordinator 可选诊断端口记录：累加计时片的环境、怪物行动和块尾结算（performance.now 墙钟跨度，含 GC/宿主停顿，不等于纯 CPU 周期），在实际客观块边界输出，排除生成器 yield 的等待。跨命令的不足一块工作继续累计，末尾未满块不混入完整回合分布。命令前奏、命令摘要和显示发布仍由命令指标覆盖；另保 objectiveTimeBlock 函数自身的环境/状态分段。没有用命令 ms 除以回合数伪造分位数。
- 热点占位查询只加调用计数，不对每次查询读两次高精度计时器；其 CPU 成本由上层分段及独立 profiler 观察。固定观测开销仍包含在本基准命令耗时中。
- GC `--gc` 与 V8 profiler `--cpu` 分开跑，不作为三次 wall 校准样本。GC 是 Node 进程观测，内存是每 128 命令的抽样峰值；不代表浏览器/手机或精确瞬时峰值。
- 附加显示快照探针在 P1 前即被基线 `loadSnapshot()` 拒绝（原生/全模块两份终点世界均返回 false），没有进入显示采样，未绕过守卫、修改快照或冒用默认 D1。原脚本和失败日志保留在证据目录；不发布该路径的 CPU/FPS 数字。显示改动由逐通道/阴影/显示随机流对照、嵌套回滚和实际 SFC 提交计数验证，真实浏览器另列环境限制。

## 验证范围

本次按用户的 ext 瘦身要求，仅相关测试 + module boundary + 测试依赖检查 + 独立 vue-tsc + build，不运行完整 npm/test:ext/test:full/test:gen。性能输入保持完整，不用定点快照替代从开局回放。

评估 §6 的更广覆盖（D22/D25/D28 每深度 500 行动、三个种子、40怪下限、16/64居民、满结构、保存续录/seek、额外装备词缀压力）须与本次最小 D20 配对集区分；未采集的项目不能写为已通过。相关身体/营地/回滚测试提供语义保险，不冒充这些负载的性能测量。

本轮冻结的是 17 项入口调用计数、客观调度块/tick 与语义摘要；另记录属性缓存命中/未命中和进程内存。路径 visitedNodes、事务捕获对象/字节、实际阴影递归及浏览器显示捕获帧数尚未纳入这份 manifest，不能把入口调用数当成这些内部工作量。后续扩充口径须重新校准独立 manifest，不能修改本轮冻结观测脚本后沿用阈值。

## 可复现入口

所有命令从仓库根目录执行，使用 Node 24.19.0；原始文件输出到仓外。正式测量期间不要并行运行生成器、测试或 profiler。

```sh
# 由冻结的真实命令路线重建两条录像，再串行完整回放与门禁
node scripts/check-ext-perf.mjs /private/tmp/ext-perf-input /private/tmp/ext-perf-result --regenerate
# 已有同哈希录像时，省去重建
node scripts/check-ext-perf.mjs /private/tmp/ext-perf-input /private/tmp/ext-perf-result
# 独立 GC / CPU 观测，不混入正式 wall 样本
node --max-old-space-size=3072 scripts/profile-ext-perf.mjs INPUT OUTPUT_PREFIX --gc
node --max-old-space-size=3072 scripts/profile-ext-perf.mjs INPUT OUTPUT_PREFIX --cpu
# 比较任意两批同输入的逐域和完整终态；再对两种组合检查冻结预算
node scripts/compare-ext-perf.mjs BEFORE_PREFIX AFTER_PREFIX COMPARISON.json
node scripts/ext-perf-budget.mjs check scripts/ext-perf-budget.json classic=CLASSIC_PREFIX all=ALL_PREFIX
```

`perf:late:check` 是独立、显式启用的深层门禁，不塞进日常测试集合。输入缺失、模块组合缺失、哈希变化、OOS、最终世界/域变化或稳定调用数超预算均非零退出；无基准不能以零样本通过。相对 P95 +10% / max +25%（至少 1 ms 噪声带）目前只提示，专用 runner 三次中两次超线的策略保存在 manifest 中，未提前启用绝对时间硬拦。

重新探索路线用 `scripts/generate-ext-perf.mjs OUT classic|all SEED 500`，默认 D20，可通过 `PERF_DEPTH` 指定其他目标。它输出独立新制品，不覆盖已冻结 manifest；本次验收不允许靠改变命令或重录基线消除差异。

## 实施与验收数据

首次墙钟未固定的试跑已保留在 `clock-diagnostic/`，包括原生三次完整结果及全模块第一轮中断日志；发现动画超时可能影响工作计数后，全部退出正式校准集，修正 runner 后从第一轮重跑。没有改录像或重录以规避差异。

### 冻结录像清单

两条录像均在 P1 之前捕获；仅源文件的排版空白不计入哈希。以下光源数是地形层发光条目数，不是去重后的格子数。

| 组合 | 命令 | D20 已结算行动 | D20 最多活怪 / 地形层光源 | 录像 SHA-256 |
| --- | ---: | ---: | --- | --- |
| classic | 2208 | 500 | 35 / 174 | `fb0181b502ee693fcdd3966307884c7ff2f0ab16b60628c45fddbad813475905` |
| all | 2516 | 500 | 33 / 211 | `e12f4c1566fc963e30154e12fe0cd4883651bf6e9f29b8d6417816f7679ce1e0` |

all 在本次 HEAD 定义为 combat、crafting、foraging、giants、growth、loot、narrative、settlement 八模块及其真实初始化命令；未来新增模块须新增/审查基准，不能把此冻结组合自动称为新版全开。路径中 D15 出现至少 66 怪、9 个肢体成员，全程最多 80 个怪物占格。D20 并未达到评估建议的 40 怪下限，因此不能将这两条录像称为完整压力覆盖。

两条路线各有 19 次换层。classic 包含 242 条零客观块输入、411 条多客观块命令，单命令最多 29 块；all 分别为 228、38、最多 2 块。classic 完整校验边界为 256/512/768/1024/1280/1536/1792/2048/2208，all 再包含 2304 并以 2516 收尾；255–257 与 2047–2049 均完整保留。不是只截取 D20 等待段来压低延迟。

### 三次校准与冻结阈值

机器 Apple M5 / darwin arm64，Node 24.19.0，堆上限 3072 MiB。同一观测代码、串行完整运行；每种组合的三次稳定调用数、客观块数、event/full 校验、双流与最终世界完全相同。耗时单位 ms。

| 组合 / 次数 | 全程命令 P50 / P95 / max | D20 命令 P50 / P95 / max | D20 客观块 P50 / P95 / max |
| --- | --- | --- | --- |
| classic / 1 | 17.29 / 77.10 / 1286.60 | 55.29 / 94.26 / 1107.95 | 6.57 / 26.94 / 48.92 |
| classic / 2 | 20.41 / 93.60 / 1450.30 | 65.59 / 111.29 / 1211.99 | 7.77 / 32.11 / 54.32 |
| classic / 3 | 17.99 / 69.34 / 8741.32 | 50.64 / 89.61 / 8741.32 | 6.14 / 24.88 / 8676.48 |
| all / 1 | 358.16 / 1298.98 / 7671.15 | 1219.98 / 1455.45 / 2902.95 | 177.90 / 243.13 / 676.29 |
| all / 2 | 341.51 / 1393.27 / 5318.94 | 1243.02 / 1573.89 / 2490.94 | 189.67 / 273.19 / 570.27 |
| all / 3 | 390.29 / 4929.21 / 163736.02 | 2039.44 / 9206.58 / 163736.02 | 298.24 / 647.14 / 161940.65 |

全模块第三次 max 达 163736 ms，原因未归因；它仍完整通过且保留原始数据，没有删除离群命令。当前环境不支持把小幅墙钟变化归因于代码。首次配对的 before 固定选择三次**命令 P95 居中那一整次**（classic 第 1 次、all 第 2 次），没有逐指标拼接最好结果。manifest 的告警参考则逐指标取三次中位数；它与配对表选取整次 before 的用途不同。后续批次直接以前一批同输入完整结果配对。

冻结文件 [`scripts/ext-perf-budget.json`](../../scripts/ext-perf-budget.json) 包含两条完整录像哈希、模块版本/配置、源与观测代码哈希、三次校准及 17 项调用上限（含零值）。冻结后拒绝覆盖；观测脚本漂移要求重新审查校准，不能悄悄改变计数口径。event/完整域、双流、最终状态与调度块/tick 必须精确相等；调用数不得超过校准上限。所有时间阈值目前仅报告。

负向验证：正常输入通过；缺少组合、输入哈希改变、非零 OOS、语义状态变化、调用数增加、原零值的 light.dance 出现调用均被拒绝；将耗时放大 1000 倍仍通过硬门禁并报警。详细日志 `budget-negatives.log`。

### 分批移植与配对

第一批对应 `a595a4c`：同一光照批次共享占位查询，光源顺序、巨兽/肢体光源锚点和独立 paintLight 的回调行为保持原样。

第二批对应 `9db964e`，按 ext 改写：

- 光照输入/遮挡验证、几何 mask/衰减模板复用、FOV 几何复用和 flare 知识采样缓冲；知识发布和属性失效仍按原顺序执行。
- 占位索引包含全部脚印和肢体，保持列表首匹配、ignore、DYING/deathProcessed 过滤；只包围同步规划/只读查询，不跨移动、生成、死亡效果或事务。
- 几何/FOV 缓存在世界图外，每次按实际依赖复验；事务保留显示缓冲身份，后续 dance 写时复制，覆盖嵌套失败回滚。
- 气体临时数组/旗标、DF 已标记目的格、LoopMap 和寻路键优化；保留结构组合旗标，存在结构观察器时气体继续活读并使用独立体积缓冲。
- Pixi 仅提交脏场景，指针/布局/可见性/投影变化仍刷新；幻觉保留 50 ms 重绘。保留 ext 身体/营地选择和悬停几何，没有套用 main 的简化悬停键。
- 日志每页最多 100 条 DOM，完整消息仍可翻页；新增按钮文字走 i18n。

boundary 首次执行拦住了地形原始读者语句的变更。保持 `check-structure-readers.mjs` 和 `structure-readers.json` 不变后调整生产实现：光照仍用原地形遍历收集同序光源，气体在原类型竞争分支之后刷新组合旗标；旗标函数局部别名/展开、isBurning Set 扫描和记忆地形快速投影三类微优化不移植，继续使用原 ext 实现。没有用重新登记哈希放宽守卫。

### 两批同输入配对

所有数值保留整条录像；单位 ms。baseline 是三次校准中命令 P95 居中的整次，第一批 before=baseline，第二批 before=第一批。每批各一轮配对，不把单轮波动解释为稳定加速比。

| 组合 / 阶段 | 全程命令 P50 / P95 / max | 全程客观块 P50 / P95 / max | 完整回放墙钟 s |
| --- | --- | --- | ---: |
| classic / baseline | 17.29 / 77.10 / 1286.60 | 4.29 / 23.62 / 52.36 | 64.86 |
| classic / batch1 | 12.84 / 52.16 / 6596.24 | 6.75 / 27.54 / 6589.54 | 78.92 |
| classic / batch2 | 12.26 / 38.38 / 2535.07 | 7.74 / 22.66 / 115.66 | 59.81 |
| all / baseline | 341.51 / 1393.27 / 5318.94 | 69.70 / 238.97 / 1681.39 | 1481.81 |
| all / batch1 | 577.03 / 8249.16 / 114136.53 | 107.68 / 400.78 / 68298.81 | 5082.16 |
| all / batch2 | 714.14 / 1615.07 / 11061.11 | 127.45 / 408.36 / 3396.24 | 2021.43 |

| 组合 / 阶段 | D20 命令 P50 / P95 / max | D20 客观块 P50 / P95 / max |
| --- | --- | --- |
| classic / baseline | 55.29 / 94.26 / 1107.95 | 6.57 / 26.94 / 48.92 |
| classic / batch1 | 32.99 / 62.24 / 3959.61 | 10.94 / 29.34 / 3931.46 |
| classic / batch2 | 25.53 / 46.30 / 2535.07 | 10.15 / 24.39 / 43.53 |
| all / baseline | 1243.02 / 1573.89 / 2490.94 | 189.67 / 273.19 / 570.27 |
| all / batch1 | 1978.33 / 15419.67 / 114136.53 | 296.39 / 507.31 / 39167.18 |
| all / batch2 | 1013.69 / 1124.25 / 2151.49 | 153.79 / 180.60 / 431.15 |

绝对时间未满足所有目标；第一批全模块出现 P95 与 max 明显变差，不能删除该轮或将第二批相对它的降幅全归于优化。计数与语义证据比本机小幅耗时变化更稳定。

### 稳定工作计数

| 组合 / 阶段 | updateVision | 占位谓词 | buildLightMask 入口 | getMonsterAt | 客观块 | 扩展收集 / 事务 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| classic / baseline | 6944 | 23369658 | 791046 | 6551356 | 2431 | 0 / 0 |
| classic / batch1 | 6944 | 3098170 | 791046 | 6551356 | 2431 | 0 / 0 |
| classic / batch2 | 6944 | 5802024 | 367790 | 6551356 | 2431 | 0 / 0 |
| all / baseline | 7234 | 27433354 | 816547 | 6962473 | 2326 | 4813 / 5017 |
| all / batch1 | 7234 | 3118872 | 816547 | 6962473 | 2326 | 4813 / 5017 |
| all / batch2 | 7234 | 6663421 | 398643 | 6962473 | 2326 | 4813 / 5017 |

buildLightMask 是入口调用数，包含命中几何缓存的调用，不等于实际阴影递归次数。批量 API 使 paintLight 入口减少也不等于减少光源；光源顺序/结果由逐通道测试和回放验证。第二批全图遮挡验证可能比第一批懒查询调用更多，但每个只读作用域索引全部脚印，且仍不得突破 P0 冻结上限。

### 回放一致性

| 比较 | 最终状态叶 | event / 已验证 full 域叶 | 差异 | OOS |
| --- | ---: | ---: | ---: | ---: |
| batch1 / classic | 3499183 | 2280 | 0 | 0 |
| batch1 / all | 3396652 | 10144 | 0 | 0 |
| batch2 / classic | 3499183 | 2280 | 0 | 0 |
| batch2 / all | 3396652 | 10144 | 0 | 0 |

每条命令按现有协议由生产回放路径核对 event 域（classic 的 event 摘要为 null）、坐标/HP/回合/双流；full 边界重算全部六个 DIGEST_DOMAINS。runner 记录实际 event 摘要和校验通过的 full 检查点，再递归比较这些域与最终 toSnapshot 的全部键/数组/值，仅将 savedAt 归零。两个批次的终态哈希、双随机流、行摘要、客观块数与 tick 总量均保持冻结值。


### 最终源码与剩余开销

第二批两条正式回放的 `git diff HEAD -- src` 观测哈希均为 `d09bddf43a22c3f83bf5a5ce802025f66ef0c1db8573bd7b4777b026f3d77a5e`，与开工 HEAD 一起标识本轮已测源码。该哈希也包含已跟踪的相关测试差量，不是构建产物哈希；新增内核测试另列于测试登记。

以下为最终全模块完整回放的包容分段时间，单位秒。调用有嵌套关系，**不能相加或当作互斥 CPU 占比**。

| 分段 | 次数 | 包容耗时 s |
| --- | ---: | ---: |
| collectExtensionComponents | 4813 | 1411.33 |
| extension.transaction | 5017 | 999.62 |
| extension.settle | 4813 | 972.01 |
| checkpointCombatFactWorld | 134 | 118.00 |
| recordingEventDigest | 2516 | 32.40 |
| objectiveTimeBlock | 2326 | 30.71 |
| updateVision | 7234 | 11.90 |
| updateEnvironment | 3276 | 8.75 |
| extension.snapshot | 2526 | 5.76 |
| checkpointResidentWorld | 129 | 4.68 |
| gas.update | 5046 | 3.38 |
| projectWholeRun | 10 | 1.09 |
| light.buildLightMask | 398643 | 0.81 |

全模块属性诊断在 baseline 和第二批同为 1,244,710 次命中、4,841,363 次未命中。P1 没有减少扩展收集/事务次数，也没有改变属性失效边界；全模块的主要剩余开销仍在扩展发布和事务相关路径。原生包容分段则以 objectiveTimeBlock 10.46 s、updateEnvironment 8.64 s、updateVision 8.25 s 为主。

### 冻结路线重建

在最终 P1 代码上，原生 2208 条与全模块 2516 条路线均从真实开局重新执行，完整导出哈希分别精确等于上表的 `fb0181b5…5905` 与 `e12f4c15…e1e0`。没有使用初始/终点快照跳过路线，没有重录或修改冻结输入。这同时证明已保存的紧凑路线可在当前版本重新生成完整录像。

两次捕获的 recordingMetrics 均为 peakJobs=0、peakBytes=0、saturated=0；该 Node 环境未启用 Worker 后端，不能据此声称已测得浏览器 Worker 的队列/内存峰值。制品与指标分别为 `regenerated-{classic,all}.recording.json` 及其 `.capture.json`。

### 独立 GC 观测

| 组合 | GC 事件数 | 暂停 P50 / P95 / max ms | 总暂停 s / 运行墙钟占比 | 抽样 RSS / heapUsed 峰值 MiB |
| --- | ---: | --- | --- | --- |
| classic | 394 | 0.72 / 2.71 / 15.35 | 0.39 / 1.90% | 1394.1 / 1045.4 |
| all | 63855 | 0.31 / 0.78 / 284.49 | 36.04 / 3.04% | 2457.8 / 1704.2 |

这两轮分别完整运行 20.45 s / 1187.07 s，源码身份与第二批相同，逐域/最终世界比较仍为零差异、零 OOS（原生 3,499,183 + 2,280 叶，全模块 3,396,652 + 10,144 叶）。GC 的观测模式和让出事件循环方式与正式 wall 模式不同，不能将它们更短的墙钟当成新增优化收益。

原生/全模块的 GC 总占比均低于 manifest 的 5% 报告目标，但全模块 max 284.49 ms 超过 20 ms 目标；总体 P95 低不能掩盖这项长暂停。Node GC kind 计数分别为 `{1:386,4:4,8:4}` / `{1:63727,4:64,8:64}`。每 128 命令内存抽样不是瞬时峰值，未测浏览器 GPU/Worker 内存；上述目标仍不作绝对时间硬拦。

### CPU 采样与 P2 候选排序

最终源码的全模块 CPU 观测完整运行 2516 条命令，零 OOS；与第二批比较的最终状态 3,396,652 叶、域 10,144 叶均零差异，源码哈希相同。V8 得到 893,646 个样本，累计采样间隔 1208.46 s，最大间隔 91.79 ms；下面使用**未按时间间隔加权的样本频率**，不将宿主暂停算成某个函数的 CPU 周期。采样覆盖 runner 的观测开销，不能作为正式 wall 配对数据。

| 自身采样热点 | 样本占比 |
| --- | ---: |
| `src/ext/json.ts` / canonical | 13.85% |
| 未归属源码的 anonymous | 9.90% |
| 未归属源码的 canonical | 9.37% |
| Node structuredClone | 6.71% |
| `src/ext/json.ts` / isJson | 4.75% |
| `src/ext/stats.ts` / isStatJson | 4.14% |
| 未归属源码的 record | 3.85% |
| V8 garbage collector | 3.39% |
| WorldCheckpoint.capture | 3.26% |
| extension runtime collect | 2.85% |
| StatPipeline.decimalStatFraction | 2.35% |
| growth.collectModifiers | 2.00% |
| StatPipeline.evaluateStat | 1.55% |

未归属源码的同名函数保留为单独项，不凭名称并入某个源文件。栈内文件的包容频率为 runtime 84.83%、growth/module 33.88%、StatPipeline 33.64%、ext/json 22.44%、growth/statSources 12.18%、WorldCheckpoint 3.27%；这些存在父子调用，不能相加。原始 `.cpuprofile` 和 `final-cpu-all.analysis.json` 保留完整证据。

以下仅是下一阶段建议，本轮未实施：

| 优先级 / P2 候选 | 本轮依据 | 下一步约束与测量 |
| --- | --- | --- |
| 1：扩展只读事实的规范化、克隆与重复收集复用 | canonical/isJson/structuredClone 的自身采样高；4813 次收集包容耗时 1411.33 s | 先细分调用来源、输入字节与失效原因；按实际变更版本复用已验证的不可变结果，保持外来输入校验、完整 full oracle、顺序和回滚身份。不能直接删校验。 |
| 2：属性来源与失效粒度 | StatPipeline 包容 33.64%；4,841,363 次未命中，growth 来源反复计算 | 区分角色、属性、来源与上下文的失效；验证同一只读批次的复用，保持 BigInt 有理数、舍入、来源顺序、鉴定边界及事务失败恢复。 |
| 3：事务写域捕获与嵌套捕获复用 | 5017 次事务；Node structuredClone 自身 6.71%，WorldCheckpoint.capture 3.26% | 增加捕获对象/字节计数，定位重复根后做有界写域/嵌套复用；必须覆盖失败注入、巨兽肢体、跨层与营地事务，不靠省略写集换速度。 |
| 4：原生派生缓冲的进一步批量访问 | 原生环境/视野仍占主要分段；全模块光照已明显小于扩展路径 | 先在更广深层输入确认收益，再选择 occupancy/环境 scratch 等 A1 派生缓冲；本轮没有替换 Cell 事实存储，也没有 P3/Worker/WASM 工作。 |

正式扩展 P2 前，应补三个种子及 D22/D25/D28、40 怪、16/64 居民/满结构和保存续录/seek 的性能场景；本轮语义测试不能替代这些计时证据。保留当前两条作为回归下限，并对新增场景独立校准。


## 测试与环境限制

- 第一批相关光照测试 46/46 通过。
- 第二批初步核心测试 52/52 通过；相关集合 41 文件共 604 项：601 通过、2 个原有跳过、1 个原有摘要向量失败。边界适配后，仅重跑受影响的 9 文件，204/204 通过。
- 调整前提的四个旧测试文件为 `src/test/phase4a3_body_sfc.test.ts`、`src/ext/modules/settlement/tests/phase5_ui_open.test.ts`、`src/ext/modules/growth/tests/ext_growth_creation_ui.test.ts`、`src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts`。四组旧 Canvas 测试先在新生产文件下运行：23 失败、23 通过；仅回退 `GameCanvas.vue` 后 46/46 通过，再恢复新实现。修改仅补 `Application.render`、`ticker.remove` 和抽取闭包的渲染环境，原断言未改。另加真实 SFC 的空闲提交计数、指针/可见性刷新、幻觉 50 ms 重绘与 RNG/回合不变断言；相关集合已通过这些新增测试。
- 唯一摘要失败位于 `src/test/ext_recording_v4_digest.test.ts:160`：向量写死 whole-run 7 / foundation 15，但本次 HEAD 的 `FOUNDATION_PROTOCOL` 已为 16。将本轮所有生产文件临时恢复为 HEAD 后，同一用例仍收到 `54ba0890…75b8a`，而旧断言要求 `2a655762…3a707`，失败完全相同。已恢复全部生产改动；未改这个测试、摘要算法、协议号或守卫。日志 `digest-head-counterfactual.log`，不是“全绿”。
- module boundary 最终通过，测试依赖检查 errors=[]，独立 `vue-tsc -b` 通过，Vite build 通过（原有大 chunk 提示仍在），`git diff --check` 通过。没有运行全量测试、test:full/test:gen，也没有 commit。
- 按 develop-web-game 技能实际运行了提供的 Playwright 客户端。Chromium 在 `MachPortRendezvousServer` 启动时收到 Permission denied 并退出；Vite 监听 `127.0.0.1:5175` 也被 EPERM 拒绝。日志 `playwright.log`、`final-vite-serve.log`。没有生成可验收的浏览器截图，没有 GPU、手机或 FPS 实测；SFC 提交次数和 CPU 内核对照不能替代这些指标。

## 原始证据索引

原始证据根目录 `/private/tmp/ext-perf-p0p1/`，大文件不进入仓库；紧凑路线、冻结 manifest 和 runner 留在仓库。主要证据：

- `baseline-{classic,all}-{1,2,3}.summary.json` 及对应逐命令/客观块/域/状态文件；`paired-baseline-selection.json` 固定首次配对选取规则。
- `batch{1,2}-{classic,all}.*`、`compare-batch{1,2}-{classic,all}.json` 和 `batch{1,2}-driver.log`；后者含预算硬门禁结果及全部时间告警。
- `regenerated-{classic,all}.recording.json` 及 `.capture.json`、`final-gc-{classic,all}.*`、`final-cpu-all.*`、`compare-final-{gc-classic,gc-all,cpu-all}.json`。
- `budget-negatives.log` 及每项负例日志；`related-tests.txt`、`batch2-related.log`、`boundary-adaptation-tests.log`、两个 Canvas 单变量反事实日志、`digest-head-counterfactual.log`。
- `final-boundary2.log`、`final-dependencies2.log`、`final-typecheck2.log`、`final-build.log`；首次失败和诊断日志保留，不只保留通过的一轮。

最终 `final-audit.json` 确认 HEAD 未变、最终 wall/GC/CPU 的源码身份与所有入口调用数/语义相同、观测哈希仍为冻结值，两个组合硬门禁均通过；时间告警分别为 65/70 项，仅报告。依赖检查再次 errors=[]；结构读者清单、U03 合同和旧摘要向量未改，无 CRLF、无新增超过 1 MiB 的文件。
