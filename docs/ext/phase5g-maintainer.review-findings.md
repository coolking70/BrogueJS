# 5G 固定返工提交维护者侧独立审查

审查完成：本轮返工 diff 未发现新的、有独立复现证据的缺陷；既有 **R-E01 / P2 已独立证实**，并通过候选时钟单变量反事实定位。R-E01 属于共享派发基线，不由本轮 foraging 参与者修改引入，仍需后续本地共享修复。本报告不是维护者最终验收。

## 1 固定输入与执行范围

- 候选：`bca0c5b5c06a2c01395ddb132f8b8bd0a14df8c0`，tree `b5746fd02882b83f9709b3d79a47c3a1815ce096`。
- 基线：`db50a84511dde0b0196f8b182205b9ea70086ef3`。
- 独立 detached 工作树：`/private/tmp/brogue-commander-20261008-5g-revision/review-tree`。开始和结束均干净、HEAD/tree 相同。
- 先读 AGENTS.md、HANDOFF、development、architecture、ext/README；完整读取集中返工包、472 行 phase5g.report.md 与既有独立审查文档，并核对原任务包冻结表。实际审阅参与者完整 diff、验证/规划辅助函数、相关测试 diff 和共享执行路径。
- 只在本 evidence 目录新增审计脚本、单个 Node 复现、日志和本报告；未修改生产、原测试或仓库报告，未 commit/push/切分支/派代理。
- 遵照 review.task.md 的资源限制，没有运行 Vitest、type/build、drift、浏览器、删除副本或大规模 smoke。未导入 5D1 工作树/移动源码；仅参考其 esbuild 静态 descriptor 发现的构建方式。

## 2 白名单、冻结与提交链核验

相对固定基线，恰好 **20 文件，1703 增行、310 删行**；全部属于 `src/ext/modules/foraging/**` 或允许的三个文档路径。唯一生产文件是 `participants.ts`；其余是自有测试/清单与文档。共享 runtime/engine/UI/test/scripts、其他模块、协议与格式文件无 diff。原交付报告的历史字节前缀完整保留。

| 提交 | 父提交 | tree | 指定 Co-Authored-By |
| --- | --- | --- | --- |
| `488dd7654984e2033cf86f302fcc784d8f2bdb39` | `db50a84511dde0b0196f8b182205b9ea70086ef3` | `839c74f1fa2c18541a01c708dd5e4795ce51f744` | 存在 |
| `bca0c5b5c06a2c01395ddb132f8b8bd0a14df8c0` | `488dd7654984e2033cf86f302fcc784d8f2bdb39` | `b5746fd02882b83f9709b3d79a47c3a1815ce096` | 存在 |

两条提交均保留 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。这是本地对象的提交链/署名尾行核验，不是远端 ref 或密码学签名核验；本轮没有网络写入。

九冻结文件的基线、候选对象与实际工作文件 SHA-256 三者相同，并符合原任务包冻结表：

| 文件（相对 src/ext/） | SHA-256 |
| --- | --- |
| worldSdk.ts | `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343` |
| edibleSdk.ts | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` |
| worldEdible.ts | `7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67` |
| kindKnowledge.ts | `4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f` |
| actorNeeds.ts | `8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e` |
| stats.ts | `c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84` |
| testing/worldHarness.ts | `a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0` |
| testing/forageHarness.ts | `ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38` |
| testing/fixtures/forageFixture/index.ts | `adc02caaa085519c54a4c0c202ef9f06f1a2b818806bd6b819773f81a4b1abea` |

fgfixture 原目录仅一个文件，树哈希仍为 `7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`。独立逐字节比较的 105 个受保护文件（src/data、全局 locale、src/test/fixtures、foraging data/locale）零变化，含原两条自然 trace。未重录任何黄金资料。

2653 个跟踪文件总哈希为 `107b2fa4a218fa0bffc883c4bb31d2f6d359276d9440a9a408b63fe92c6edc2c`。剔除仅作证据元数据的两份报告后，**2651 个输入哈希独立重算为 `7c9c8f740d49abeaabba04e21cd82249f9e511269b942cac54e913f853b027ba`**，与 dot 声明吻合。算法为码点排序的路径 + NUL + 文件 SHA-256 + LF。前后逐文件零变化，详见 audit-before/after.json。

## 3 新发现与既有问题

### 新的返工缺陷：0 条

没有把 dot 的历史失败、未执行浏览器/真机/5Z 项或故障注入本身登记成新的正常生产缺陷。此结论限于本次源码审查与单个行为探针，不意味着重新跑过返工完整门禁。

### R-E01 / P2：有效活动力量存档被已过期活局拒绝（既有，独立确认，未修）

**触发与影响：** 玩家公开食用 might 后保存，继续游玩至力量期满，再在同一 Game 中载入原有效存档，`loadSnapshot` 返回 false。相同模块 manifest、相同字节在即时载入和 fresh Game 下均可接受。因此载入是否成功错误地依赖目标活局的时间，不是档案损坏、版本不符或参与者 writer 注错。

**真实复现：** evidence/probe.ts 导入当前固定树的真实 createWorldHarness/Game、原 foraging descriptor/参与者和生产效果层。seed `51020001`，仅启用 foraging。初始安全地形、清理敌人和授予一个 might 属于受控布景；没有直接写力量、timedStats、持续时间或世界时钟。效果由 `Game.executeCommand('item:execute', 'eat|<letter>')` 建立，后续用 399 个公开 `wait` 推进。保存用真实 `toSaveSnapshot`（h.save），载入用真实 `Game.loadSnapshot`。

| 场景 | 活局 tick / 候选 tick | 实际校验时钟 | 返回 / 力量 |
| --- | --- | --- | --- |
| 食用后保存 | 100 / 100 | — | 力量14；flat +2，untilTick40000；applied bonus2 |
| 同一 Game 即时载入 | 100 / 100 | 100 | true；力量14 |
| 同一 Game 期满后载入 | 40000 / 100 | **40000** | **false**；活局仍力量12 |
| fresh Game 对照 | 0 / 100 | 0 | true；发布后 tick100、力量14 |
| 同一期满 Game，仅候选校验时钟反事实 | 40000 / 100 | **100** | true；发布后 tick100、力量14 |

每次加载均重新 JSON.parse 同一个保存字符串；其 1,994,605 字节、SHA-256 `f096d440bb0922a320cfcbea714e0a5bf1dbb1848abc049d8b89bb1c45f422d8` 全程不变。保存字节未写入磁盘；原始 bundle 等大文件仅留外部 evidence，不提交。

**独立定位证据：** 探针只包装候选 runtime 的 validateWorld 作观察，保留原实现、捕获后原样抛出异常。失败堆栈明确命中 `MaterializedStats.assert` → `ExtensionRuntime.validateWorld` → `Game.loadSnapshot`。失败候选仍带 saved strength14、timed +2、applied bonus2，但真实 breakdown 为 `{base:12,value:12,rows:[]}`。

1. `Game.ts:565` 的 `simulationTicks` port 闭包读的是 `this.world5` 活局；`Game.ts:11559` 用此工厂创建未发布的候选 runtime。
2. `Game.ts:11618` 将候选 depth/turn 等传入 validateWorld，未传候选 simulationTicks；`runtime.ts:454` 的 withStatWorld 只换 actor 集合，不换时钟。
3. `runtime.ts:387` 以 port 当前时钟 `< untilTick` 筛掉候选 timedStats。在本场景 40000 < 40000 为 false，合法候选 +2 被排除。
4. `NativeStatSources.ts:73` 正确按候选 strength14 减去候选 applied bonus2 得到 base12；`MaterializedStats.ts:45` 正确拒绝“保存 bonus2，但重算 bonus0”的矛盾。该守卫不应放宽。
5. `Game.ts:11687` 才发布候选 world5，时序晚于上述校验。fresh Game 读到0而偶然放行，不证明候选上下文已正确。

**单变量反事实：** 在同一次 Node 进程、同一个过期 Game 中，仅在候选 validateWorld 的调用范围把 candidate runtime 的 `ports.simulationTicks` 暂时读为保存 tick100，`finally` 恢复原函数；未改变活局时钟、档案字段、原校验器、源文件或 manifest。原校验通过且真实 load 发布成功。该诊断包装只用于归因，不是本轮生产修复。

上述五个共享源码文件相对 db50a845 全部无 diff。故保留既有 R-E01 编号，不重命名为本轮新缺陷。失败返回的 onExtensionError 数组为空，保留原始记录，不将其扩列成第二个新问题。

**证据精度：** 拒绝时原 player/runtime 身份与双 RNG 保持，tick40000/力量12保持。探针的整快照序列化相等诊断为 false，未保存逐叶差分；本报告不据此宣称拒绝路径“所有根零写”，也不把未定位的差异登记为新缺陷。后续共享修复回归应补逐叶比较。

### R-F01：既有 detached 测试 oracle 修订（源码确认，未独立复跑）

当前 `foraging_atomic.test.ts:169–179` 完整比较入口 components，并断言同一死亡盟友在 purgatory、已离开 active monsters，符合 Game 死亡保留根与离队退役分开的执行路径。未看到旧“components应为空”的错误 oracle 残留。既有报告的54项复跑关闭仍是其历史证据；本审查因资源排程没有重跑，不能新增一次“54项通过”声明。

## 4 返工合同的独立代码审查

| 合同 | 当前代码与测试边界 | 本次验证方式 |
| --- | --- | --- |
| 首写前验证/规划、提交异常传播 | participants.ts:14–33/48–55/83–94 保守准备；writer 分别位于36–44/57–58/95–100，无提交 catch；qualifies 可选查询兜底保留。外owner、重复、畸形由 knowledge/state 解析拒绝 | 完整 diff 与真实辅助函数审查 |
| strict/degrade 分界 | runtime.ts:1680 edibleParticipate 通过 transaction/invoke 回滚；非degrade转 C5_PROVIDER，degrade诊断。EdibleEffects.ts:102消费外层 transactWorldWork；FireContact.ts:157传 !strict；ActorNeeds.ts:64始终degrade，只有ok才处理本次depart队列 | 真实调用链审查；atomic故障矩阵源码审查 |
| 原参与者 writer 注错 | atomic包装原参与者，覆盖知识第1/2写、message、replaceState、组件、depart的 before/after；严格路径录制+1且比较身份/成本/双流，降级按入口与无故障对照比较 | 源码审查，未运行矩阵 |
| 新 known 按事实计1 | 两次知识 writer 都实际调用，known返回值取OR；tasted/false不增加；knowledge测试四前提1/1/1/0、降级false、保存再吃，persistence含重复爆炸 | 源码审查 |
| 治疗与再生 | eat/feed增加真实事实点HP和gain、min/percent/cap/full与独立crypto keep/strip；nodes到32000公开UI/controller读投影和真实提交、20次纯读、同CAS成功/旧CAS拒绝 | 源码审查，未重新执行 |
| 无foraging组合 | settlement-only走中立manifest/digest/完整机械投影；只在enabled分支求foragingFinal；七模块候选去重为10组合，另2热源+1群体 | 源码/当前七个descriptor文件审查 |
| 真实持久化与沉眠 | feed施加同伴25回合，命令后24；到期/行动阻断/真实爆炸伤害醒，加载重取actor；未见食后改duration。力量fresh/control对照覆盖到期，但明确不覆盖R-E01 | 源码审查；本次只额外复现R-E01 |
| 可选模块与首版反馈 | 通用热源改为合法fgheat自有descriptor，craftingHearth仅真实联动使用；peer按安装能力注册，trace B按crafting存在注册；UI生产未改，手册追加已裁定通用反馈 | 源码审查；未重新创建删除副本 |

foraging有20份自有测试，新增 atomic已登记本模块test-suites；未改共享发现器。已有捕获专用环境变量分支为原 trace 捕获机制，本轮新增peer适配发生在用例注册阶段，没有新加已注册用例内“peer缺席直接return”、skip/todo或延长超时。四个删除副本的845/846/846/833与正常849是 dot/原审查报告的结果，当前独立任务未获得并逐一复跑这些外部副本，不把它们归入本次独立执行数量。

## 5 后续本地修复建议

最小生产修复面是 **Game 的候选 preflight 接入 + runtime 的内部 stats 求值上下文**；测试放共享存读/临时属性相邻集合。保留九冻结 SDK、foraging数据/参与者/协议号及 MaterializedStats 严格断言。

1. 从 `snapshot.run.world5.simulationTicks` 建立可信、显式的候选时钟上下文，覆盖整段候选属性求值；runtime timed来源筛选使用该上下文，正常运行仍使用live port。用try/finally退出上下文并清理stats缓存，成功发布与失败返回都不能遗留旧时钟。
2. 不只包住 validateWorld：同一preflight后续 `Game.ts:11635` 的 combat stamina/poise容量校验也通过 withStatWorld/stats读取，须统一候选上下文。不得先改活局world5再校验、删除保存的bonus、忽略StatValidationError或直接让坏账本通过。
3. 最少补本探针的即时/期满同Game/fresh三对照与同字节断言；分别在untilTick−1和untilTick边界验证。篡改saved strength、applied bonus、timed value/期限导致不一致时仍必须拒绝；失败逐叶核对活局机械根、双RNG和身份，不能只看布尔值或digest。
4. 发布后检查真实stats consumer：Player.ts:42的effectiveStrength → NativeStatKeys.ts:61–69的武器/护甲enchant、accuracy/defense、damage/runic；Combat.ts:210/500及实际攻击/投掷读点；ItemDetailContext.ts:60的当前/假设装备预览。消费效果施加（EdibleEffects.ts:66–88）和到期（153–168）仍应一次reconcile回14/12，不能因候选上下文修复使buff永久化。
5. 同伴might是非物化 `native.physical-damage-dealt` 的 more行，运行期由 StatPipeline.ts:425/nativePair 消费；后续共享测试应确认load后125%与到期100%。本次只证实玩家力量加载拒绝，不声称该NPC场景也已经复现失败。

后续修复与门禁由指挥另行排程；当前树不实施这些建议。

## 6 本次独立执行结果与交接

本机实际 Node **v25.2.1**，esbuild **0.27.3**，沿用只读共享node_modules；Node进程均设置 `NODE_OPTIONS=--max-old-space-size=3072`。这是小探针环境，不冒称完成要求Node24.19.0的开发/交付门禁。

从 review-tree cwd 实际执行：

```sh
python3 /private/tmp/brogue-commander-20261008-5g-revision/evidence/audit.py before > /private/tmp/brogue-commander-20261008-5g-revision/evidence/audit-before.log
NODE_OPTIONS=--max-old-space-size=3072 node /private/tmp/brogue-commander-20261008-5g-revision/evidence/compile.cjs > /private/tmp/brogue-commander-20261008-5g-revision/evidence/compile.log 2>&1
NODE_OPTIONS=--max-old-space-size=3072 node /private/tmp/brogue-commander-20261008-5g-revision/evidence/probe.cjs > /private/tmp/brogue-commander-20261008-5g-revision/evidence/probe.log 2>&1
git diff --check db50a84511dde0b0196f8b182205b9ea70086ef3 HEAD
python3 /private/tmp/brogue-commander-20261008-5g-revision/evidence/audit.py after > /private/tmp/brogue-commander-20261008-5g-revision/evidence/audit-after.log
```

上述命令全部exit0；Node行为探针仅运行一次，399次wait、4次真实load比较；所有探针断言通过，日志和 probe.result.json保留完整失败堆栈/上下文/反事实。compile元文件380个输入，生产源码全部来自此固定review-tree，5D1源码输入为0；Vite glob仅在esbuild内存loader替换为当前七descriptor静态发现，不修改文件。

结束核验：HEAD/tree/status与开工相同；2653跟踪文件逐SHA零变化，2651门禁输入哈希仍如§2。没有新增仓库未跟踪文件。

未执行项继续交接：浏览器24格/再生浏览器重采/真机、九特殊布景完整新局录像、完整npm test/test:ext、128子集、完整物理删除矩阵与极限长局/5Z。这些是证据边界，未列为本轮新代码缺陷。完成本报告后停止，等待指挥下一轮排程。
