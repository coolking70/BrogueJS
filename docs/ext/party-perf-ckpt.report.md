# Party 战斗事实世界捕获性能优化

2026-10-19；起点 `ext/party-p1a` / `ba360b4b7a31868b09d7c92a0debf7f083a9ea10`。A 为已发布 P1b `a4117b225a73f68b697fabe552aa168a17fee4a7`，B 为审查修复前的性能候选（下述源码散列固定）。当前未提交工作树还包含 F1/F2 修复，不能直接沿用 B 的测量结果。两起点之间只有报告和预算状态差异，生产源码相同。未 commit/push/派发云端。

## 独立审查 F1/F2 修复（2026-10-19）

依据 [独立审查](party-perf-ckpt.review-findings.md)，两项均为 ba360b4 原有问题，本轮修复不将其归因为属性捕获表示的性能回归。

- **F1**：party 的战斗事实世界保存点补入 `levelSeeds`、`meteredItems` 的深层捕获，并恢复奖励房全局计数。覆盖换层及普通动作触发的坠层，包括内层生成已成功、之后渲染通知才失败的外层回滚；visited/cache 一致性守卫保持。非 party 的根列表和恢复路径保持。
- **F2**：`generateDepth` 在生成事务提交前接受引擎内部的成员安置回调。主动换层与强制坠层均在该回调内完成成员安置并排入 `enteredLevel`；原 `commitGeneration` 在有效发布上下文内分发钩子，钩子看到已安置的成员。未修改 runtime/combat 的 capability 守卫，也未从外部翻转 `publishingGeneration`。

新增 `party_entry_checkpoint.test.ts` 的 10 项用例：首次/缓存层分别在 emit 后、真实 enteredLevel 钩子执行后、生成提交后的 render 通知注入失败；在原保存点使用独立全对象图审计验证值/引用/描述符/键序恢复，另验扩展快照、双 RNG、实体/机器分配器、奖励房计数；去掉注入后重试并存读。主/副成员正常换层检查钩子观察到的 active actorIds、重复进入不重复放置；副成员坠层检查真实发布失败、回滚及重试。自然行走跨层原测试扩展为 party-only/combat × single/window，比较存读、seed replay、跨层前后 seek 的全部七域/root/双 RNG。

本轮过程证据在 `/private/tmp/party-perf-ckpt-review-fix/`：修复前同组新增用例 `red-cases.log/json` 为 1 过/9 败，其中 F1 独立对象图复现原 13 处残留，F2 仍被原发布守卫拒绝。第一次启动 `red.log` 因新组合测试缺 combat 依赖声明被拒，补登记而未改检查器。实现后 `entry-first.log/json` 为 6 过/4 败：新测试误要求 seed42 自然层必有篝火，实际无合法位置时原规则允许 skipped；改为核验该深度真实 placement（含 skipped）/pending 账本及回访不重复，未改任何旧断言或生产放置规则。最终门禁结果如下。

本轮最终限定门禁：**27 文件 / 471 项全部通过，0 失败、0 跳过**。`entry-travel.log/json` 为 2 文件/16 项；`related.log/json` 为其余 25 文件/455 项，互不重复，所有断言均基于本轮最终生产源码。新测试覆盖 + 原相关成员/环境/占位/生命周期/窗口/Worker/回放 + 生成事务与 actor identity、世界放置守卫和 combat 篝火整文件。未重跑未改动的性能脚本测试。

| 本轮门禁 | 结果 | 证据 |
| --- | --- | --- |
| 相关测试 | 471/471，两批 exit0 | `entry-travel.log/json`、`related.log/json` |
| boundary | exit0 | `boundary.log` |
| 测试依赖检查 | 695 文件，errors=[]，exit0 | `dependencies.log` |
| vue-tsc -b | exit0 | `types.log` |
| npm run build | exit0；仅已有大 chunk 提示 | `build.log` |

精确文件清单在 `selected-tests.txt`，命令/退出码/耗时在 `commands.json`（其余25文件与静态门禁），逐文件计数/文件散列在 `final-summary.json` 及仓内汇总 `reviewFix`。两批测试统一 Node v24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、`node node_modules/vitest/vitest.mjs run <清单文件> --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=<结果>`。四项静态/构建命令依次为 `node scripts/check-module-boundaries.mjs`、`node scripts/check-test-dependencies.mjs`、`node node_modules/vue-tsc/bin/vue-tsc.js -b`、`npm run build`。

当前 `Game.ts` SHA256=`fbad1936dbe540473af7c88d9a16e094d62f2be6aa96164e13ba642dd2d276a7`；`WorldCheckpoint.ts` SHA256=`2e5bbc6aae4cc34731d5b652cdcddc9de7945783ae0c25b11a44863989f105c6`（属性表示实现本轮未改）。本轮 dist 为 63 文件，摘要 `1d9b2b8bd514aae9bd93be5b62928bf8208b5e2458130c36f4e2f602f3335e31`，算法同下文。无 party 五配置既有字节夹具本轮原样通过，没有重录。未运行 full/gen/drift、删除矩阵、性能重测、浏览器或云端；未 commit/push。

**性能证据适用范围**：下方 29.69%/37.07%/37.73% 和反向混合窗口数据完整保留，均仅属于审查前冻结 B。补齐写集改变了当前候选的捕获成本，修正发布顺序也改变了原本失败的跨层路径；本轮按要求仅跑相关测试与静态/types/build，未重新跑性能，不能称当前候选已获相同降幅或全面性能通过。云端命令仍须使用维护者提交这次完整修复后的 SHA。

## 实现与语义边界

`Game.checkpointCombatFactWorld` 在有 party、且未使用同边界 pooled capture 时，给 `checkpointGenerationWorld` 选择有序属性捕获。普通对象原来通过 `Object.getOwnPropertyDescriptors` 建立“属性名→描述符”的动态对象，再枚举该对象；最终路径保留 own-key 与值数组，只有访问器或非默认 writable/enumerable/configurable 标志才保留完整 descriptor，失败时逐项 `defineProperty`。省去描述符字典构建、第二次枚举和普通属性 descriptor 的长期持有；仍保存每个值及全部属性标志，捕获时不调用 getter。

属性表示优化保留每个事务边界和完整原写集；本轮另补上上述 F1 的生成写集缺口。没有按 actor 或跨窗口缓存世界，没有合并捕获、删写域或省略深层对象。对象身份、循环/别名、符号键、稀疏数组、Map/Set、typed bytes、只读引用根与 shallow 截断沿用原语义。`Game`/actor 的 own-key 顺序、Logger、窗口事实观察器、DF/地形、怪物列表会话、行动/防御/空间 revision、origin/allocator 等原恢复步骤全部保留。嵌套事务各自重新捕获，内层回滚回到内层入口，外层仍能恢复外层入口。

无 party 时直接调用原算法；pooled capture 的算法与优先级不变，party 的写集补齐同样适用。没有新增 Game 字段，没有 RNG 调用、格式/版本、规则、玩家文字或快照字段变更；无基线、黄金 trace 或无 party 字节夹具重录。

## 回归与门禁

新增 `party_checkpoint.test.ts`：

- 原算法和优化算法分别通过独立对象图审计：循环/别名、访问器不执行、符号/隐藏属性/常量、稀疏数组、Map/Set/typed bytes、引用/shallow 截断、嵌套及重复恢复。
- 四人真实命令的非主成员 wait 原生提交后注入异常，同时改库存、状态、格子、地面物品，分配实体并消耗双 RNG。单步与窗口分别验证对象图值/描述符/身份完全恢复、双 RNG、实体分配器和 tick 恢复；窗口保留此前主成员已接受的动作，不能错误回退整窗。
- 四人混合 search/wait 与 300 tick 窗口，真实 save/load 续录、seed replay、前后 seek 比较全部七个 digest domain、根摘要、双 RNG 和事件前缀。

另跑 P1a/P1b 的成员动作、环境、占位、跨层、扩展组合、生命周期、窗口/决策/R1 修复，以及生产 Worker 的 255/256/257/2047/2048/2049 边界存读、seek、续录。五配置 `ext_party_inert` 原夹具逐字节验证非 party save/recording/Game keys/RNG/messages，不重录。

审查修复前的最终有效结果为 **23 个不同文件、395 项通过、0 失败、0 跳过**，按每文件最后有效结果计数，不累加重复执行。最终值数组版本另外重跑全部受影响的11个party整文件及无party字节夹具：`values-related.log` / `values-related-results.json` 为12文件207项全过、1293.67s、exit0；未受影响文件沿用此前有效结果。首批 `related.log` / `related-results.json` 为 22 文件通过、1 文件失败，393 通过/2 失败，795.63s、exit1；`transition-final.log` / `transition-final-results.json` 将失败整文件的 2 项复测关闭，exit0。`effective-tests.json` 给出逐文件明细。新增 5 项和工具 25 项亦有独立运行日志，但不重复计数。

失败归因：`ext_combat_transition_facts` 的旧 helper 把 registry 已组装的 party-context `module.rules` 写回原 descriptor，却保留了原 runConfiguration.identity，因而在进入场景前被默认身份守卫拒绝。原始 a4117b2 上同样 2 败（`transition-baseline.log`）；在候选副本**只回退本次两个生产文件**也同样失败（`transition-counterfactual.log`），确认为既有夹具缺陷，并非修掉旧行为导致的期望变化。仅让未修改的模块返回原 descriptor，保留配置感知 factory/default identity；body-fixture 与 narrative 的测试改造保持。原全部断言原样；旧生产+修正夹具和新生产+修正夹具各 2/2 通过（`transition-counterfactual-fixed.log` / `transition-final.log`）。未改身份守卫、容差或跳过条件。

| 检查 | 最终结果 / 证据 |
| --- | --- |
| 相关测试 | 23 文件 / 395 项；上述首批与整文件复测分列 |
| boundary | exit0，`values-boundary.log` |
| 测试依赖 | 694 文件，errors=[]，exit0，`values-dependencies.log` |
| 单独 vue-tsc -b | exit0，`values-types.log` |
| npm run build | exit0，`values-build.log`；含 vue-tsc，只有已有大 chunk 提示 |
| 窗口 A/B 工具真实冒烟 | 1/2/4 人×only/all×A/B，共12场/6对，steps=8/rounds=1；raw工件校验和三分片聚合通过，`ab-smoke/merged.json`；不作为性能结论 |

第一次 types 失败仅为新增测试 Item 颜色参数用了字符串，改为数字后通过；无已有断言改动。SSR 性能工具有既有 websocket EPERM 告警，但 SSR/Node Worker 与进程返回码独立验证，不据此声称浏览器通过。

实际相关测试命令使用 Node v24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=1 --no-file-parallelism`；文件清单为证据目录 `selected-tests.txt`。静态命令为 `node scripts/check-module-boundaries.mjs`、`node scripts/check-test-dependencies.mjs`、`node node_modules/vue-tsc/bin/vue-tsc.js -b`、`npm run build`。仅运行这些相关范围及性能工具；未跑全量 npm test/full/gen/drift、删包矩阵、浏览器或云端。

原始证据根为 `/private/tmp/party-perf-ckpt/`，不提交大日志、截图、存档或录像。

## 本地同输入配对方法

A 由 `git archive a4117b2` 导出，1512 个 src 路径逐个 Git blob 校验完全相同。B 由 `git archive ba360b4` 加本次显式差量生成隔离副本；生产变化只有 `Game.ts` 和 `WorldCheckpoint.ts`。原工作区已有未跟踪 `scripts/.party-ckpt-micro.mjs` 未修改、未纳入候选副本。两侧依赖指向同一份已安装依赖，最终 B 在 `candidate-values/`；均用同一个 B 观察脚本和 Node 24，3 GiB heap，生产 Node Worker；不并行跑 A/B 或测试。

用 `profile-party-window-perf.mjs` 原 seed42、四人 party-all、2049 输入，最终单步 `single` 和混合窗口 `windows` 各一对完整运行，单步 A→B，窗口 B→A；本地不冒称完成三轮或具有统计置信区间，云端三轮由下方命令独立复验。输入生成及路线不变；为观察器新增逐输入层计数/耗时、末态七域，以及 save-load 的即时逐域/双流断言。每场继续完整 seed replay 并校验零 OOS。另有 party-only/all 各一对 257 输入短程配对，只作短程佐证。各配对强制输入 hash、逐步 rows、双 RNG、末态七域/root、tick、每步工作量与机器/Node 相等；原始 save/recording 还做完整对象比较，只将 `savedAt`（保存时间）和 `recordedAt`（录像导出时间）墙钟值置零。

最初“descriptor 数组”候选没有达到目标，不能冒充最终证据：`pairs/` 两侧子进程 exit0，七域/root、逐步输入、工作量和双 RNG 相同，但辅助 raw 比较漏归一化 recordedAt，驱动 exit1。修正观察器时间戳处理并使用 `caffeinate -i` 后，`pairs-final/` 第一对单步 raw 对象也一致，但 P95 为84.855→87.332ms（+2.92%）；capture累计115410.79→79456.15ms下降31.15%，GC累计12550.73→23370.35ms却增长86.21%。该候选未满足目标，停止后续窗口运行，保留退出130/部分输出，不删除慢样本。两次也有墙钟远大于CPU的个别停顿，不能将全部尾部归因于代码。

最终实现进一步去掉普通属性 descriptor 的长期持有，证据目录独立为 `values-short/` 与 `values-final/`。257步预检的only P95为71.801→46.221ms（−35.63%），all为83.005→65.556ms（−21.02%）；短程四场均exit0、逐域/输入/工作量/双RNG完全一致，仍不当作长窗口结论。最终测量用 `caffeinate -i` 仅在测量进程生命周期防空闲休眠，没有修改系统电源设置。

分段为输入 1–512、513–1024、1025–1536、1537–2049；1000/auto 窗口单列尾部。`inputToReady` 包含必要 Worker flush；`synchronousMs` 是命令同步段；各层计时有嵌套关系，不能相加为总 CPU。每场初始化单列为冷步但总体 P95 不删除冷步、GC 或异常慢样本。这里的收益是 Node 同机测量，不冒称浏览器 UI 延迟或正式云端预算通过。

## 审查前性能结果与裁决（历史候选）

**历史测量结论（不代表 F1/F2 修复后的当前候选）：值数组实现的已测场景逐域一致；四人全开单步2049输入的全样本P95下降29.69%。从真实录像前态恢复、同进程逐次交替的1000/auto长窗P95分别下降37.07%/37.73%，42/42配对均更快。连续混合路线的跨进程测量没有显示改善，不能将其标为性能通过；本机多次宿主暂停也使最大值/累计墙钟不能用于归因。云端三轮复验仍待维护者。**

所有数值和逐窗口配对见 [机器可读汇总](party-perf-ckpt.summary.json)。Apple M5 / macOS arm64 / Node v24.19.0 / heap3072MiB；生产Worker保留。两组完整路线各侧2049输入、零OOS、输入hash/逐步工作量/双RNG/七域及末态相等；原始save/recording仅归一化savedAt/recordedAt后完整对象相等。

| 连续路线（4人全开） | 输入P95 A→B ms | 变化 | 1000窗P95 A→B ms | auto窗P95 A→B ms |
| --- | ---: | ---: | ---: | ---: |
| single | 87.49 → 61.52 | -29.69% | — | — |
| windows | 51.54 → 66.87 | +29.76% | 1380.45 → 3391.41 | 1340.13 → 1592.35 |

windows中1000有13个、auto有7个样本，含被打断的短窗；P95在此样本量等于max。B的index254（1000）为3391.41ms，CPU2387.80ms；另有100 tick窗约18.7s墙钟而CPU约237ms。single B有约485s墙钟停顿，未删除；single A也有约23.7s墙钟/67ms CPU停顿。P95保留全部样本，但均值/max/累计不能直接归因。暂停具体原因未确认，不能断言所有反向差值均由睡眠或CPU型号造成。

### 连续路线按输入分段

捕获次数逐段相等，scheduler/environment/NPC等层计数也逐段相等。层计时相互嵌套；累计秒数含外部停顿，列出原值，不相加、不用停顿差额冒充优化收益。

| 路线 / 输入段 | 输入P95 A→B ms | capture次数 A=B | capture累计 A→B 秒（含停顿） |
| --- | ---: | ---: | ---: |
| single / 1–512 | 84.86 → 56.10 | 513 | 49.52 → 14.42 |
| single / 513–1024 | 98.81 → 58.62 | 512 | 27.76 → 17.19 |
| single / 1025–1536 | 83.22 → 59.41 | 512 | 28.09 → 14.86 |
| single / 1537–2049 | 87.85 → 66.81 | 514 | 30.05 → 500.26 |
| windows / 1–512 | 46.41 → 68.26 | 805 | 21.91 → 24.72 |
| windows / 513–1024 | 47.45 → 61.12 | 556 | 15.17 → 15.82 |
| windows / 1025–1536 | 50.67 → 68.52 | 535 | 15.22 → 15.32 |
| windows / 1537–2049 | 54.94 → 68.74 | 532 | 15.97 → 34.62 |

### 长窗口的同进程交替配对

为减少先跑A、后跑B的时间顺序影响，在同一Node进程创建两个独立Vite模块图，断言Game/RNG/Logger实例相互独立；从上述真实录像输入index192（1000）与256（auto）的前态经replaySeekAsync→toSaveSnapshotAsync取得合法快照。每次重新load该前态、等待上一轮Worker完成、校验前态，并在计时外显式GC；随后执行完全相同的原始窗口输入。计时包含完整原生窗口、记录主线程工作及输入锁要求的Worker flush。每类21对，顺序逐对AB/BA交替，首对/慢样本全部保留。

这是固定前态的完整窗口重复测量，起始堆和缓存条件受控；其绝对值不直接对应连续混合路线或旧云端3.7s。两侧每次前态/终态七域、双RNG、完整收据、捕获次数均相等，且与本侧其他20次相等。初版辅助工具漏在下一次load前flush上一轮未阻塞输入的异步记录，被原生产守卫拒绝（window-interleaved-first.log）；仅修工具调用顺序，原守卫未改。

| 实际窗口 | 样本 / ticks / captures | 整窗P95 A→B ms | 降幅 | 最大值 A→B ms | capture P95 A→B ms |
| --- | --- | ---: | ---: | ---: | ---: |
| 1000 | 21对 / 1000 / 38 | 1388.71 → 873.95 | 37.07% | 1430.22 → 883.21 | 1119.95 → 615.88 |
| auto | 21对 / 1000 / 40 | 1510.09 → 940.39 | 37.73% | 1546.86 → 960.47 | 1215.06 → 656.79 |

同进程实验按执行顺序再分三段（每段7对、P95即该段最大值），检查收益是否只来自某一段：

| 窗口 / 配对序号 | 整窗P95 A→B ms | capture P95 A→B ms |
| --- | ---: | ---: |
| 1000 / 1–7 | 1342.63 → 873.95 | 1083.75 → 615.88 |
| 1000 / 8–14 | 1388.71 → 837.16 | 1119.95 → 592.98 |
| 1000 / 15–21 | 1430.22 → 883.21 | 1142.52 → 619.31 |
| auto / 1–7 | 1485.48 → 925.60 | 1189.97 → 647.34 |
| auto / 8–14 | 1546.86 → 960.47 | 1242.05 → 668.55 |
| auto / 15–21 | 1510.09 → 918.04 | 1215.06 → 640.01 |

1000/auto的capture累计分别下降45.27%/45.75%，进程CPU累计分别下降23.15%/24.57%（含所有Worker线程，不等于主线程墙钟）。该组42对完整执行exit0，无样本剔除。

复现（在已准备的隔离副本上，使用新输出目录，避免覆盖原证据）：

```bash
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
caffeinate -i node /private/tmp/party-perf-ckpt/run-values-pairs.mjs
caffeinate -i node --expose-gc /private/tmp/party-perf-ckpt/window-interleaved.mjs
```

仓外驱动写有固定输出路径，重跑前需换新目录；完整命令/cwd/退出码见values-final/result.json，补充脚本及SHA见汇总。sourceHash A=`2fb116bab6376ab3774022f3be2d1b1e4119ab9f8ac7dddc53904e91f5515b43`，B=`5e63ce09670c2c2587793a7b4bf70d51773d4180d922dcc4d4b577c4be3bac73`，完整路线与交替测量一致。B的两个生产文件在审查修复前与当时工作树逐字节核对相同；F1/F2已使当前Game.ts不同。审查前dist的63文件摘要为`79805af44131f07f9c1a8885f6d2e780eea84c0abe30878e2278375518c36aa0`。dist摘要算法为相对POSIX路径按Unicode码点排序，聚合 `path + NUL + fileSHA256 + LF` 后再SHA256。

## 云端复验命令

现有 `party-window` workflow 原先只允许 calibration-only，无法执行所需 A/B。本次增加 `--base`，在每轮、人数和配置内执行 A/B（偶数轮 B/A）；聚合继续检查原始工件散列，新增双方身份、完整七域/双 RNG/输入/逐步工作量的严格等价检查。缺边、重复、OOS、错来源、错机器或语义漂移均失败。保留旧校准模式；预算仍 null/report-only，未修改已有预算。

维护者提交并推送本次最终源码到 `ext/party-p1a` 后，在该提交上执行。`head_ref` 必须是那次维护者提交的不可变 SHA；不能填本报告的开工 HEAD。workflow 的 branch ref 需要已经包含本次 A/B 支持。

```bash
PERF_BASE=a4117b225a73f68b697fabe552aa168a17fee4a7
PERF_HEAD=$(git rev-parse --verify 'HEAD^{commit}')
test "$PERF_HEAD" != ba360b4b7a31868b09d7c92a0debf7f083a9ea10
test "$PERF_HEAD" != "$PERF_BASE"

gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref ext/party-p1a \
  -f suite=party -f mode=ab -f base_ref="$PERF_BASE" \
  -f head_ref="$PERF_HEAD" -f rounds=3

gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref ext/party-p1a \
  -f suite=party-window -f mode=ab -f base_ref="$PERF_BASE" \
  -f head_ref="$PERF_HEAD" -f rounds=3

gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref ext/party-p1a \
  -f suite=phase6 -f mode=ab -f base_ref="$PERF_BASE" -f head_ref="$PERF_HEAD" \
  -f base_identity=6c4 -f head_identity=6c4 -f rounds=3
```

前两项覆盖 1/2/4 人、party-only/all 的完整三轮，报告性能，不冻结阈值。第三项为无 party classic、all-full、all-prefix，保持原 D6 规则及工作量可比性裁决。未代派发，云端结果待维护者补录。
