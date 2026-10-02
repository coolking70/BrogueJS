# EXT-1a1：生成回滚检查点的性能缩窄

分支：`ext/foundation`。起点：已验收的 `9375ed9518f04c617ee1b63c1fe026480413a659`；开工核对远端相同。仅执行 1a1，完成后停下等待验收；没有开始 1b、合并 main 或修改成长配置。

状态：**1a1 实现与验证完成，最终完整/CE 门禁全部通过。** 每层捕获中位数 ≤30ms 达标；缓存大图的逐层复制已消除，但总捕获仍保留跨层可写实体/容器的规模成本，严格的总耗时层数无关目标尚未完全达到，见性能节。停在本步等待验收。

## 修改范围与写集

生产文件只有 `Game.ts`、`GenerationCoordinator.ts`、`LightMap.ts`；新增 `ext_generation_checkpoint.test.ts`。没有新增 Game 实例字段。既有 1a0/1a/经典测试逐字不改，黄金 trace、生成基线、U03 表、配置包和版本均不动。本步按完整/CE 档执行，`test:full` 替代 `npm test`。

检查点仍原位恢复原对象的描述符、Map/Set 成员与 typed-array 字节，不用 JSON/structuredClone 替换 live 对象，不重建角色或 runtime。根选择在 `checkpointGenerationWorld` 内执行，因此计时没有漏掉选择写集的成本。

| 类别 | 捕获方式与执行依据 |
|---|---|
| Game 顶层与 levels | Game 所有自有属性浅快照，恢复指针及标量；levels 的 Map 成员浅快照，非目标 LevelState 包装对象浅快照 |
| 实体与所有权 | 玩家及背包、当前/休眠/炼狱/缓存/pending 生物图深捕获，沿 leader/carriedMonster/carriedItem 保留共享图；观察集中仍有的对象也覆盖。所有缓存怪物数组保留成员及原引用，不能整体排除 |
| 跨层领导关系 | demoteMonsterFromLeadership 遍历缓存活动/休眠表，写 leader、leaderlessAfterDemotion、targetWaypointIndex、waypointAlreadyVisited；对应实体和 visited 数组仍深捕获 |
| 坠落 | monstersFall 可能向已缓存下一层 monsters 追加，或改 pendingFallenByDepth；fallFloorItems / restoreFallenItems 还改物品队列与原物品位置，全部覆盖 |
| 当前/目标楼层 | 同层重入或已存在重访目标的网格、环境、模拟光照、气味、实体仍捕获；真正离层几何只读，且生成 DF 禁用 refreshSideEffects，因此旧网格/环境/FOV/光照保留引用。其它未触达缓存层大图不遍历 |
| 早期生成 DF | 在新 scent/waypoints 安装前，aggravate 仍可写离层 scent、waypoint 0、旧 scanner；保留这些快照。其余旧距离图与 coverage 不改；重访 setup 替换旧 coordinates/distanceMaps/coverage，只保留引用，scanner 仍捕获 |
| 其它可写小对象 | levelSeeds、meteredItems、stats、minersLight、当前物品、pending fire、鉴定/称呼/魔法极性集合；test 模式清空的 sign/reset/testRooms/visible/machineCells 容器仍恢复 |
| 录像及显示 | generation 不改录像/回放历史、UI 详情，顶层引用足够；旧 floatingTexts/pendingDiscoveryMessages/activeFlares/terrainFlashes 在此边界只追加或替换，保存原引用与长度。怪物 mapToMe/safetySnapshot 只替换，不深遍历 |
| 全局/弱状态 | 既有 RNG、logger（含消息/待确认/战斗缓冲）、奖励配额、dyingMonsters、DF 会话/描述资格、陷阱弱状态恢复不变；实体 ID 不回退重用；机器编号保留原生成路径的分配/重置行为，不随外层失败回退 |

### 独立审计发现与修复

重访 `updateVision → LightMap.clearLighting` 会替换弱容器中的 renderSources。旧全图快照并不能捕获这个 WeakMap；即使模拟光照和 visualMap 指针已经恢复，下一次 `dance()` 仍可能使用失败进入时的光源。

新增 `LightMap.checkpointRenderState` 只保存原 renderSources 列表引用/长度和旧 visualMap 引用。旧显示图不遍历，模拟 lightGrid/lightCells/shadowGrid 仍作为目标层可写状态恢复；失败后立即 `dance` 的回归证明使用旧光源，而不是先通过 `updateVision` 掩盖问题。该 helper 只由扩展检查点调用，经典路径无新增调用。

独立只读审计已复核 generation、catch-up、发布资源端口及写集。缩窄适用于这些受限入口，不是任意外部 Game 修改的通用事务；今后增加生成期写入必须同步更新写集和回归。

## 正确性证据

新增 `ext_generation_checkpoint.test.ts` 13 项回归全部通过；全部扩展预检 14 文件 / 238 项通过。覆盖：

- 真实新层生成的 coordinator / 发布异常；pending fallen 怪物与物品队列消费后恢复
- 真实重访的气体补算、waypoint 重建和嵌套格子/图/数组的原对象身份
- 真实补算坠落到第三个已缓存楼层，恢复目的层的原 monsters 数组
- 跨层领导选举、休眠/绑定追随者解联、waypoint visited 标志；coordinator / 发布失败后恢复
- 挖图早期 aggravate 的离层 scent、waypoint 0、scanner 原链接身份和字段恢复
- 光照弱缓存失败回滚后，在下一次 updateVision 前 dance，保留旧视觉图身份和光源
- 同层重入、test 模式容器清空、经典从不调用检查点
- 未触达缓存图和累计录像内容不被描述符遍历；通用捕获仍恢复循环、共享引用、symbol 描述符、typed array 和追加队列

生成/重访失败用例同时检查原 Game/runtime/世界对象、双 RNG、消息、模块状态和世界投影。实体 ID 与机器编号沿用原事务测试的分配/重置规则。旧断言没有更改或削弱。

读源码守卫重新扫描当前 282 个测试文件，生产守卫集合与原清单一致：146 个快速实例、3 个共享真实生成普查实例全部通过。重型普查实际执行 45 seeds × 26 层 = 1170 层、3803 台机器，center 违例为零；未替换成 mock 或缩小原普查集合。名称过滤只用于这次预检，不计作完整套件通过。

## 性能复测

精确旧对照为 [1a 报告最后一节](phase1a.report.md#1a-当前生产冻结样本追加保留上方-1a0-基线) 的当前生产样本，不混用更早的 1a0。

### 方法与来源

规范样本沿用 1a 最终探针：seed 424242，normal + growth，每个进程 1 次完整预热 + 5 次正式重复；Node v24.19.0、3 GiB 堆上限、动作前后显式 GC。每轮 fresh Game 先做同种子 classic D1 准备；实际 extended D1 完成计时与 GC 后执行 create-character revision 0（created=true、恰一条命令、RNG 不变）；D2 起放置到实际下楼梯，经 executeCommand('stairs_down') 入层，没有移动/战斗回合。主样本 D1–D5；补充进程完整跑 D1–D10，不混合两次样本。

完整入口计时是实际 Game.generateDepth，包含回滚捕获、coordinator 和扩展发布；coordinator 包含生成、50 次环境补算、落位与视野，不能视为纯地图生成。新 checkpointGenerationWorld 的 select 回调在计时函数内部：缓存/实体根构造、写集选择、LightMap 弱状态捕获、reference/append-only 清单构造全部计入 checkpoint。原本在函数外的 dying/logger/RNG/DF/trap 检查点仍计入完整入口，列为 other 差额；没有转移到未测区域。成功路径不执行恢复，故本性能样本不能代替回滚正确性测试。

2026-10-02T12:03:09.967463+00:00 冻结生产源至仓库外，排除所有测试；全部生产/构建配置 SHA-256：`474a6d346b6b933f97eaa03777d04f31cc59495c427d77ed2785257c4651a79f`；实际导入 152 个生产输入闭包 SHA-256：`0c155c524b44608a443ef9dc9aefea5615c4b56c7308e4da363a65c05b228fd7`。2026-10-02T12:04:48.513878+00:00 测后核对 unchanged=true。1a 旧结果及冻结源保持原样；旧冻结源逐文件复核不变，诊断导入闭包与旧计时闭包相同（`5250afd534510cd4053c1eea73585956a2aaaafded7812f700fee0792e0778c7`）。11:50 探索样本早于 LightMap 弱状态修复，不用于最终验收；其源差异与结果保存在独立归档。

### D1–D5 规范结果（ms）

| 层 | 1a 捕获中位数 | 1a1 捕获中位数 (min–max) | 捕获中位数样本降幅 | 1a 完整入口中位数 | 1a1 完整入口中位数 (min–max) |
|---|---:|---:|---:|---:|---:|
| D1 | 30.4 | 0.56 (0.50–0.85) | 98.2% | 122.1 | 87.90 (85.27–92.46) |
| D2 | 50.7 | 6.62 (6.15–7.15) | 86.9% | 153.0 | 100.44 (97.03–105.77) |
| D3 | 122.9 | 6.72 (5.92–7.20) | 94.5% | 233.6 | 123.79 (121.52–136.99) |
| D4 | 185.4 | 7.63 (6.54–8.95) | 95.9% | 275.8 | 99.92 (95.52–107.48) |
| D5 | 251.7 | 7.56 (6.35–7.95) | 97.0% | 476.8 | 212.79 (201.77–226.06) |

D3–D5 旧捕获每个正式样本 >100ms；新样本最大值 8.95ms。D5 中位数 251.65→7.56ms，完整入口476.79→212.79ms。全程六轮各层的 RNG/实体数/物品数/缓存深度与旧1a记录精确相等。

### D1–D10 补充（同协议）

| 层 | 捕获 ms 中位数 (min–max) | 完整入口 ms 中位数 (min–max) | 捕获即时 ΔheapUsed MiB 中位数 |
|---|---:|---:|---:|
| D1 | 0.50 (0.49–0.56) | 85.31 (82.97–93.30) | 0.40 |
| D2 | 6.67 (5.39–7.37) | 98.43 (96.95–112.62) | 6.25 |
| D3 | 6.55 (5.68–7.03) | 121.82 (116.20–123.18) | 6.52 |
| D4 | 7.74 (6.16–10.79) | 93.78 (91.76–101.79) | 7.25 |
| D5 | 7.75 (6.42–8.07) | 206.63 (193.14–226.13) | 7.56 |
| D6 | 8.33 (7.56–14.97) | 102.04 (95.22–109.75) | 8.42 |
| D7 | 8.95 (7.40–9.21) | 79.94 (77.41–84.37) | 8.62 |
| D8 | 8.84 (7.72–9.33) | 171.72 (167.63–180.33) | 8.90 |
| D9 | 9.78 (8.85–10.26) | 117.50 (116.43–122.05) | 10.17 |
| D10 | 10.41 (8.88–10.72) | 111.28 (109.08–112.71) | 10.53 |

旧规范基线仅到 D5，因此不为 D6–D10 声称旧/新收益。补充 D10 捕获中位数 10.41ms，相对 D2 仍可见增长。源码审计表明写集仍包含可达可写实体与容器成员，未宣称 O(1)；本探针没有捕获实体/descriptor 数量普查，因此不把该斜率归因为已测出的瓶颈。

验收判断：**每层中位数 ≤30ms 已满足；缓存网格大图的逐层递归捕获已消除。** 若将“不再随已访问楼层数线性增长”理解为总捕获开销，则本步尚未完全达到：levels 的浅成员与跨层可写实体仍逐层收集，D2–D10 实测也仍缓慢上升；不宣称整体 O(1) 或零斜率。源码可确定这项剩余工作量依赖可写实体/容器规模，但本探针没有对象普查或 CPU profile，不能精确归因那几毫秒的斜率。进一步压平的下一步方案是在 demote、缓存/队列追加和资源发布等实际写入口建立按需 undo journal，并以本步正确性快照作对照验证；本步没有为压平数字而排除这些可写对象。

### 状态等价与内存口径

完整指纹另起两个诊断进程（旧1a冻结源、新1a1冻结源），分别1次预热+1次正式D1–D10。20 对 whole-run SHA-256 全相同，每层旧/新各自两次也一致；覆盖活动和缓存楼层、实体图、物品/玩家、run/录像命令、RNG、分配器、growth状态。只删除 wall-clock savedAt；使用纯世界投影，绕开 toSnapshot 的瞬时显示清算和 Logger.getState 的 combat flush（直接读取其存档消息投影），不会消耗 RNG。诊断哈希放在动作后 GC 采样之后，不混入正式性能计时/内存结果。它证明本 fixed-seed 成功路径的持久状态一致，不证明所有异常路径/所有瞬时会话状态一致。

D1–D5 捕获即时 ΔheapUsed 中位数为 0.40/6.26/6.52/7.24/7.56MiB；D5 旧粗样本94.55MiB，新7.56MiB。采样点最高RSS：主样本254.8MiB，D10补充264.0MiB。GC只在顶层动作前后、全部计时器之外；heap/RSS差额受自动GC/分配器/OS影响，不是累计分配、对象保留大小或连续峰值；D1差额含准备世界释放。完整内存 min/max 和动作后GC差额在原始汇总中保留。

最终探针在重型源码守卫退出后、完整门禁开始前串行运行，主动没有并行重套件。宿主机仍未隔离：主样本load1 0.66→0.69，补充 0.69→0.83，原1a2.17→2.23。CPU/GC/调度未控制，表中降幅是指定协议下观测样本，非严格隔离因果估计。

### 原始证据与复现

全部临时脚本/日志/JSON在忽略目录 `tmp-phase1a1-raw/`：`performance-1a1-{d5,d10}-{probe.log,results.json,summary.json,report.md,input-hashes.json}`，`performance-1a1-fingerprint-comparison.json`，旧/新 `*-fingerprints-results.json`，`performance-1a1-source-{snapshot,check}.json`，`performance-exploratory-vs-final-source-diff.json`；`README-performance.txt`含完整命令。全部运行exit0；计时没有生产文件修改。

仓库根执行 `python3 tmp-phase1a1-raw/performance-1a1-freeze.py` → `node tmp-phase1a1-raw/performance-1a1-build.mjs` → `NODE_OPTIONS=--max-old-space-size=3072 TZ=UTC node --expose-gc tmp-phase1a1-raw/performance-1a1-d5-probe.mjs`。补充构建用 `PERF_LABEL=performance-1a1-d10`，运行加 `PERF_DEPTH=10`。每次重测前应确认无重门禁争用，并在结束执行 `performance-1a1-verify-source.py`。

## 最终完整/CE 门禁

执行环境：云端 Linux / Node v24.19.0 / npm 11.9.0，`TZ=UTC`、`NODE_OPTIONS=--max-old-space-size=3072`。完整套件 2 worker，drift 1 worker；原测试集合、超时、断言、skip/todo 不变。`--bail=1` 只在失败时提前终止，本轮没有失败；不是用定向拼接代替完整门禁。

唯一最终运行的五项全部退出 0（12:05:16–13:48:08 UTC）：

```text
END vue-tsc EXIT_CODE=0 DURATION_SECONDS=16 2026-10-02T12:05:32Z
✓ built in 5.94s
END build EXIT_CODE=0 DURATION_SECONDS=21 2026-10-02T12:05:53Z
CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9
END ce-fetch EXIT_CODE=0 DURATION_SECONDS=0 2026-10-02T12:05:53Z
```

`npm run test:full -- --maxWorkers=2 --reporter=verbose --bail=1`：

```text
 Test Files  281 passed (281)
      Tests  4987 passed | 8 skipped | 5 todo (5000)
   Start at  12:05:53
   Duration  6080.44s (transform 9.58s, setup 0ms, import 205.48s, tests 11908.80s, environment 112ms)
END test-full EXIT_CODE=0 DURATION_SECONDS=6081 2026-10-02T13:47:14Z
```

`npm run test:drift -- --maxWorkers=1`：

```text
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  13:47:14
   Duration  53.66s (transform 1.41s, setup 0ms, import 2.22s, tests 51.26s, environment 0ms)
END test-drift EXIT_CODE=0 DURATION_SECONDS=54 2026-10-02T13:48:08Z
FINAL all_gates=0 2026-10-02T13:48:08Z
```

- CE 参照可用，`BROGUE_REQUIRE_CE=1` 下所有活动 CE 对照执行，没有因缺参照而跳过
- 8 项历史 skip 仍是 P2-1/P2-2/P2-3 退役用例；5 项 todo 仍是 smoke 和 CombatFormulas 历史占位，没有把它们计作已验证，也没有新增 skip/todo
- 扫描最终 full/drift 日志，没有 FATAL/OOM、worker 异常、未捕获异常或失败汇总。构建仍有既有 >500kB 产物警告，未改警告阈值
- 最终类型/构建/完整 CE/drift 前后 595 个生产/测试/脚本/资源输入聚合 SHA-256 一致：`e3c05d9aa0a1daaae6eb463c3500adc3496c446dc60e035ea6ec30a6535e232c`；门禁后只整理文档，没有改源码或测试。13:48:29 UTC 再核对性能冻结生产源，逐文件仍相同
- 既有 1a0/1a/经典测试文件、黄金 trace、生成基线、配置/版本及 U03 清单均未改。LF、JSON/重复键与 `git diff --check` 检查通过

合入 main 前，维护方仍须按既有要求在本机另行完整运行 test:full；本步不执行该合并，也不进入 1b。

### 交付文件

- 生产：`src/engine/Core/Game.ts`、`src/engine/Core/GenerationCoordinator.ts`、`src/engine/Lighting/LightMap.ts`
- 新回归：`src/test/ext_generation_checkpoint.test.ts`（13 项）
- 文档：本报告、`docs/ext/architecture.md`、`docs/ext/README.md`、`docs/ext/phase1-growth.md`、`docs/ext/evidence/summary.md`

原始日志、探针、逐样本 JSON 和散列清单留在本 checkout 忽略目录 `tmp-phase1a1-raw/`，冻结生产源在仓库外 `cloud-extension-evidence/`。不提交截图、原始全量日志或大型证据。
