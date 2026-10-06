# 5A2 独立代码审查（ext/phase5 @ 8e946bb + 未提交工作树）

> 审查方式：只读 `git diff` / 源码阅读；在 `/private/tmp/p5a2-review`（工作树副本，node_modules 软链）里跑复现测试和性能分析脚本。原工作树没有改动。
> 复现测试：`/private/tmp/p5a2-review/src/test/zz_review_repro.test.ts`（R1–R4，4/4 跑通，并打印出证据）。
> 性能脚本：`scratchpad/prof/{prof.mjs,levels.mjs,est.mjs,agg.mjs}`，CPU profile 在 `scratchpad/prof/cpu/`。
> Node 24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，`--maxWorkers=1`。

---

## 0 结论速览

| 级别 | 编号 | 问题 | 是否阻塞 5B |
| --- | --- | --- | --- |
| **高** | H1 | 每个世界事务都对整张对象图做检查点，成本随**已访问层数**线性增长（D1 约 27 ms，D8 约 229 ms；每批至少 2 次） | **是**（长局/深层性能） |
| **高** | H2 | 终结票据永不回收；总票据数到 8192 后，所有新工作永久返回 `C5_BUDGET`（R4 已复现），摘要、扫描和存档也随历史线性增长 | **是** |
| **高** | H3 | 接收事实与完成事实同 operation、`result:'completed'`，只靠 `completedBatches/completionOrdinal=0` 区分；5B 包 §6.4 会重复计数，PlacementReceipt 也会写错 | **是**（需改包或补 SDK 说明） |
| 中 | M1 | 逐事件摘要没有按 dirty 叶增量计算（违反合同 §10.2），并且 `compareCodePoints` 是热点，占规范化时间约 70% | 随 H1/H2 一起修 |
| 中 | M2 | load 不校验 `autoAction:{kind:'auto_work',ticketId}`：悬空的 ticketId 被接受，auto 状态卡死（R1 已复现） | 建议 5B 前修 |
| 中 | M3 | 节点放置超出预算时直接 throw，导致新局或进层整笔回滚，玩家无法开局或换层（R2 已复现）；定义校验不检查同包 `maxPerDepth`/`maxPerRun` 合计 | 建议 5B 前修 |
| 中 | M4 | 批完成时**任何**异常都改走 `provider` 取消；输出创建时又按全局 Item 预算重检一次，已付时间的工作可能因原生物品增长被取消 | 否 |
| 中低 | M5 | foundation 没有把 `worldDefinitions` 绑定进规则指纹（合同 §9.1(a)），完全依赖模块自己算 fingerprint | 否（dot 已自算） |
| 低 | L1–L11 | 详见 §4 | 否 |

**性能根因（实测）**：800 条工作命令的 CPU profile 里，`checkpointGenerationWorld.capture` 自身占 **67%**（全图检查点），`eventDigest` 占 **28%**（其中 `compareCodePoints` 11.9 s / 17.3 s）。三项修复（scoped 检查点、退休终结票据并限制模块历史、`compareCodePoints` 快路径）合起来，每批成本可从 D1 约 90–130 ms、D8 约 0.5 s 降到约 10 ms 内，而且不再随层数和历史增长。§2 给出数据。

---

## 1 高优先级缺陷

### H1 世界事务用全对象图检查点，成本 ∝ 已访问层数（性能主因）

- **位置**：`src/engine/Core/WorldWork.ts:577` `transactWorldWork` → `Game.checkpointWorldWork()`（`Game.ts:13379`）→ `checkpointCombatFactWorld()`（`Game.ts:449`）。后者深拷贝 grid、environment、fov、scent、所有缓存层 `this.levels`（每层 grid 和 lightMap）、全部怪物等，再叠加 `runtime.transaction` 对所有模块 state、components、world 做的 `structuredClone`。
- **调用次数**：接收命令 1 次（`commitWorldWork`）+ 首批完成 1 次（`settleWorldWork→completeBatch`）；每条 `auto_step` 1 次（`continueWorldWork`）+ 1 次（`completeBatch`）。`cancel-work` 外层和内层 `cancelWorldWork` 各 1 次，嵌套。
- **证据**：
  - `levels.mjs`：`checkpointWorldWork` 在 D1 为 **25.9 ms**，D2 57.6，D3 84.3，D4 112.7，D5 140.8，D6 169.0，D7 199.8，D8 **229.2 ms**（约 +28 ms/层）。
  - CPU profile（N=800）：总 71.4 s 中 `capture`（GenerationCoordinator）**41.8 s** 自身时间，`transactWorldWork` 包含时间 44.4 s。
  - 推算：5B 在 D8 的一批 ≥2×229 ≈ **0.46 s**，到 D20 每批会超过 1 s。报告里 58/114 ms 的数据只在 D1 测量，低估了这个问题。
- **修复方向（与合同 §4.3 “事务写集是显式 operation union” 一致）**：给 world-work 单独做一个 **scoped 检查点**，写集明确列出：
  - `world5`、`actorActions`、`worldContainerItems`（Map 及其中的 Item 对象）、`worldWorkFacts`、`worldWorkDetails`；
  - `player`（shallow）+ `player.inventory.items` 及其 Item；
  - `game.items`（启动礼包落地用）；NPC 的 `carriedItem`；
  - `Game.autoAction` 字段、实体 ID 分配器、`timeSystem.currentTick`、`logger` 消息（用 `logger.checkpoint()`）；
  - runtime 侧继续用 `runtime.transaction`（world entities、states、nextFactId）。
  - Grid、环境和缓存层都**不在**写集里：world-work 从不写地形。

  原有的 `auditFullObjectGraph` 失败注入测试保留，作为“独立写集差分”的 oracle，证明 scoped 写集够用。
  实测同口径 scoped 检查点为 **1.95 ms**，全图为 27.2 ms（D1），而且与层数无关。复杂度从 O(全图 × 层数) 降到 O(world5 + 背包)。

### H2 终结票据永不回收 + 总数 8192 硬上限：长局后永久拒绝工作，成本线性增长

- **位置**：
  - `WorldWork.ts:954` `releaseTicket` 只清预留，ticket 留在 `world5.tickets`；
  - `WorldWork.ts:260`：`tickets.length >= 8192 → C5_BUDGET`，计数包含 completed/cancelled；
  - `WorldWorkValidation.ts:16` `list(w.tickets, 8192)`。
- **复现 R4**：采集 1 次后，把 world5.tickets 用已完成票据的克隆补到 8192 张（新 ID，`nextWorldId` 同步递增），再发 harvest → `R4 error with 8192 terminal tickets = C5_BUDGET`。
  每次采集就是 1 张票据。5B 的手采每单位 100 tick，一局几千到上万次采集和制作完全可能，到上限后 crafting 在该局永久失效。
- **随历史线性增长的成本（都源于不回收）**：
  - 逐事件摘要（M1）：每张票据约 **475 B**，1200 条命令时 world5 约 307 KB；
  - `settleWorldWork`、`mirrorWorldWorkTicks`（每次 `advanceActionTime`）、`reservedInventorySlots`（每次 `hasSpace`）、`updateWorldReasons`（层数 × 票据）都是 O(票据)；
  - `leftDepth` 回调（`PhasedAttackProduction.ts:394/409`）对**每张**票据调用 `interruptWorldWork`，后者再线性查 `activeTicket`，合计 **O(n²)**；
  - 存档校验 `WorldWorkValidation.ts:211-221` 是 nodes × tickets，`:420` 是 facts × tickets。
- **修复方向（合同 §5.5 已允许：“终结 ticket 在关联/输出/退款全部解除后可回收，已用 ID/完成高水位不重用”）**：
  1. 在 `releaseTicket` 里把终结票据移出 `world5.tickets`（如需诊断可保留最近 ≤32 张）；`nextWorldId` 是高水位，ID 不重用；收据去重靠 identity 和高水位。
  2. 删除或改造 8192 总量门槛，只限制活跃票据数（每 actor 1 张）。
  3. 事实闭包校验（`WorldWorkValidation.ts:418-431`）改为：ticket 存在就校验一致性；不存在时只要求 `ticketId < nextWorldId`。
  4. 维护活跃票据索引（`Map<ticketId, ticket>`、`Map<actorId, ticket>`），`leftDepth`、mirror、settle 只遍历活跃票据。
- 复杂度：每次 O(1) 摊销，持久体积有界。**这个保留策略会影响 harness `world5()` 的可见内容，必须在 5B 冻结前定下来**，否则 dot 断言 `tickets` 长度的测试会失效。

### H3 接收事实与完成事实无法从 operation/result 区分，5B 包 §6.4 会重复计数

- **位置**：`WorldWork.ts:756-767`。接收时发布的事实为 `operation = craft→'craft-batch' | 'harvest' | 'place-station'`、`result:'completed'`、`completedBatches:0`、`completionOrdinal:0`。
- **复现 R3**：一次 harvest 之后，参与者历史为 `[["startup","completed",0,0],["harvest","completed",0,0],["harvest","completed",1,1]]`。
- **影响**：5B 包 §6.4 规定“`result==='completed'` 才计 harvest/craftBatches/placements；place-station 事实另追加 PlacementReceipt”。按这个写会出现：
  - 每次采集计 2 次；N 批制作计 N+1 次；
  - 每次放台计 2 次，并在接收时就写一条 `completed` 的 PlacementReceipt（即使之后被中断）。
- **修复方向（SDK 冻结，不改联合类型）**：在合同/包里冻结判别规则：`ticketId!==null && completionOrdinal===0` ⇔ 接收事实，并改 5B §6.4（totals、placements、history 都要按这个规则过滤）。另一种做法是接收时不发事实，但这偏离合同 §9.1(g)。无论选哪种，都要先写进 §A 再派发。

---

## 2 性能专项：根因、是否无界、修复与预期

### 2.1 实测增长（`prof.mjs`：骨架工作局，1 tick 纤维→纤维，每单 2 批，无怪）

| 命令 i | 每命令 ms | tickets | world5 字节 | extensions 字节 | craftskel.history |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 64.9 | 50 | 41 K | 34 K | 151 |
| 600 | 90.9 | 300 | 165 K | 198 K | 901 |
| 1200 | 130.8 | 600 | 307 K | 395 K | 1801 |

1200 条时的微基准：
- `eventDigest` 59.6 ms（不含 extensions 时 28.4 ms）；
- `checkpointWorldWork` 26.9 ms（D1，与历史基本无关，与层数线性相关，见 H1）；
- `settleWorldWork` / `reservedInventorySlots` / `countWorldItemRoots` / `readWorkContext` 都 < 0.2 ms。

### 2.2 根因（按占比）

1. **全图事务检查点**（H1）：约 2×27 ms/命令（D1），这是**常数底座**，每多一层缓存层再加约 28 ms×2。
2. **逐事件摘要全量重算**：`RecordingDigest.ts:54` 每条事件都对整份 `extensionRuntime.snapshot()`、整份 `world5`、facts、details 做 `c5Canonical` 加纯 JS SHA-256。没有 dirty 叶缓存，与合同 §10.2 “只重算被显式写入口标脏的叶” 不符；5A1 时这些域都很小，问题没暴露。增长来源：
   - (a) 终结票据永不回收（H2）；
   - (b) 骨架参与者 `history` 无界追加（`craftingSkeleton/index.ts:138`，每单 3 条事实，1200 条命令时 1801 条约 395 KB）。5B 包 §6.4 已限 128，但骨架是 dot 的模板，应示范有界；
   - (c) `compareCodePoints`（`WorldCanonical.ts:59`）每次比较都对两个字符串做 `Array.from`，profile 里占规范化时间 **11.9 s / 17.3 s**。
3. 次要：`runtime.worldWorkFact` 的 `state` getter 每条事实都 `cloneJson` 整个模块 state（骨架无界历史下随历史增长）；`runtime.transaction` 每个事务 `structuredClone` 所有模块 state。

### 2.3 修复与预期（已在副本中部分验证）

| 修复 | 复杂度变化 | 实测/预期 |
| --- | --- | --- |
| F1 scoped 检查点（H1） | O(全图×层) → O(world5+背包) | 27.2 ms → **1.95 ms**（D1），D8 从 229 ms 降到约 2 ms |
| F2 退休终结票据 + 活跃索引（H2） | 摘要和扫描从 O(历史) → O(活跃) | 同时把骨架/模块历史限到 128：1200 条时 `eventDigest` 20.9 ms → **2.2 ms** |
| F3 `compareCodePoints` 快路径：先比 UTF-16 码元，首个不同码元是代理项时才回落到码点比较；与码点序等价 | 常数因子约 3× | 副本实测 `eventDigest` 59.6 → **21.0 ms**，每命令 130.8 → **88.0 ms**（i=1200）；`ext_recording_v4_digest`、`ext_world_work_sdk_contract`、`ext_world_harness_closed_loop` 40/40 通过，摘要值不变。对经典/0 营地的 chunk 全量摘要也有效 |
| F4 dirty 叶摘要（合同 §10.2） | world5 域按根数组分叶（tickets/containers/nodes/stations/receipts/levels…），叶哈希缓存，由现有集中写入口（`allocateWorldId`/`updateWorldReasons`/recordWorldReceipt 等）bump 根版本；extensions 按模块分叶，以 state 对象身份或 revision 缓存 | 有 F2 后可延后；F2 之后全量也只要约 2 ms |
| F5 leftDepth/mirror/settle 只走活跃票据 | O(n²) → O(活跃) | 消除换层的二次方 |

**预期组合效果**：D1 每批约 2×2 ms 检查点 + 约 2 ms 摘要 + 原生回合本身，量级 ≤10 ms，且不随层数和历史增长。F1/F2/F3 都不改冻结的 SDK 类型。F2 会改 world5 持久内容和录像字节，应在 5B 冻结和派发**之前**合入，并重录相关黄金。

---

## 3 中优先级缺陷

### M1 逐事件摘要不是 dirty 增量；`compareCodePoints` 热点
见 §2.2/§2.3。位置：`RecordingDigest.ts:43-58`、`:226-230`；`WorldCanonical.ts:59`。

### M2 load 接受悬空或伪造的 `autoAction` auto_work（严格 codec 缺口）
- **位置**：`Game.ts:11677` `this.autoAction = run.autoAction ?? null;`。`isWholeRunSnapshot` 和 `validateWorldWorkReferences` 都不校验 autoAction。
- **复现 R1**：在合法存档里把 `run.autoAction` 改成 `{kind:'auto_work',ticketId:424242}`，`loadSnapshot` 返回 **true**，`isAutoTraveling()` 为 true。连发 3 条 `auto_step` 之后仍是 auto：`continueWorldWork` 抛错 → `cancelWorldWork` 找不到票据 → 直接 return，autoAction 永不清除，ticker 空转。classic 存档伪造 auto_work 也类似。
- **修复**：load 预检（退休旧局前）要求以下条件全部成立：
  - auto_work ⇒ world5 存在；
  - 对应票据存在，`status='working'`，`actorId=player`，`totalBatches>1`，`completedBatches<totalBatches`；
  - 反向：玩家有 working 且 `totalBatches>1`、`bundle=null` 的票据时，autoAction 必须指向它，否则拒绝或明确定义为“异常恢复点”。

  native kind 的字段形状也应一并严格校验（这个缺口在 5A2 之前就存在）。

### M3 节点放置预算溢出会 throw，导致新局或进层整笔回滚
- **位置**：`WorldWorkWorld.ts:496`（每层 32 / 整局 512 → throw `C5_BUDGET`），`checkInteractableBudget`（832/1024 → throw）；调用点 `WorldWorkPlacement.ts:52/84`（defer 重试和首访放置），位于 `Game.ts` 进层 try 块内（约 1770 行），失败会 `restoreWorld()` 并回滚整个层转移。定义校验 `WorldDefinitions.ts:130-131` 只限单定义 `maxPerDepth≤32`、`maxPerRun≤512`，不限同包合计，更不限跨包合计。
- **复现 R2**：骨架包两条节点定义各 `maxPerDepth:20` → 新局抛 `Error: C5_BUDGET`，无法开局。若整局合计超 512 或 interactable 用满，就会在中途某次下楼时卡住，永远进不了下一层。
- **修复**：放置路径遇到预算不足时按 skip 处理并写唯一收据（reason `budget`），不 throw。定义校验加上同包每深度 `maxPerDepth` 合计 ≤32、`maxPerRun` 合计 ≤512。dot 自己的包是 8/层、144/局，不会触发，但 crafting 加 foraging 或 settlement 同局时会。

### M4 批完成异常一律归为 `provider`；输出时重检全局 Item 预算
- **位置**：`WorldWork.ts:873-877`、`:1169-1173` 用 catch-all 走 `cancelWorldWork(...,'provider',false)`；`createOutputs` 每个 stack 调 `checkItemBudget`（`WorldWorkWorld.ts:636`）。
- **影响**：
  - `C5_BLOCKED`（放台目标格被占）、`C5_TOOL`（工具被偷）、`C5_CAPACITY`、`C5_BUDGET` 都被记成 provider，并且**跳过参与者**，模块看不到这次取消的事实（`recentFacts` 里有）。这与 §9.2(g) “参与者看到的 fact 与 recentFacts 相同”不一致；合同只对参与者失败授权这条例外。
  - 原生物品数量可以合法超过 7168（合同 §5.3），这时已付时间的批次会因输出“新根”超预算而被取消。接收时已按批次计入输出 stack，完成时不应再按全局门槛重检。
- **修复**：只有 `C5_PROVIDER` 走无参与者取消；其他码走带参与者的普通取消，并用真实 reason。已在接收时 admission 过的输出和退款不重检全局预算（与“退款/残骸托管从不因预算失败而吞物”同理）。

### M5 `worldDefinitions` 未由 foundation 绑定进规则指纹
- **位置**：`registry.ts` 只调用 `validateWorldModule`；`runtime` 没有把 `worldDefinitions` 和 `rules.fingerprint` 做任何绑定。合同 §9.1(a) 写的是“进入规则指纹”。
- **影响**：模块改了定义却没改 fingerprint 时，旧存档和录像能静默加载，分歧要等摘要报错才暴露。
- **修复**：两种做法任选：校验 `module.rules.fingerprint` 覆盖了 `worldDefinitions`（例如要求 fingerprint 等于 `extensionDataFingerprint(包含 pack 的规范对象)`）；或由 foundation 把 `c5Hash(worldDefinitions)` 写进 manifest 或 world5 配置指纹并在 load 时比对。

---

## 4 低优先级

- **L1** 模块 prepare 返回 `{ok:false}` 时，`code` 不校验是否属于 33 码（`WorldWork.ts:558`），任意字符串都会进 `setWorldWorkError` 和 harness `error`。应校验并降级为 `C5_PROVIDER`。payload 对象也没有冻结后再交给 prepare。
- **L2** `world:transfer`（`Game.ts:3753` 起）是新的公开录制命令，不在合同或 SDK 中（合同把 transfer 写为 5C UI/订单 adapter）。它还有几个问题：
  - 允许 KEY/AMULET/GEM 等任意非装备原生物品入箱；
  - `ticksUntilTurn` 固定 100，忽略玩家速度；
  - 不检查 paralysis/entranced/威胁。

  建议 5A2 先只开放给测试，或者至少限制为 MATERIAL 和 native 输出模板，并写进合同。
- **L3** `stopAutoWorkInCommand` 的取消原因固定为 `'input'`。由 `autoTravelDisturbed`（敌情、disturbed）触发时也记成 input（`Game.ts:13381`、`:14390`）。
- **L4** `executingRecordedCommand` 是词法 try/finally 标志（`Game.ts:3737`），在确认等待（生成器挂起）期间一直为 true，B 类守卫在这段时间被绕过。目前因前缀已清 auto_work 不可触发，但语义脆弱。建议在 yield 时置 false、恢复时置 true。
- **L5** `prepareTravel` 先录一条 `escape`（`ui/commands.ts:21`），可 UI 随后调用的就是录制命令 `mouse_travel`，它的前缀 `stopAutoTravel` 本来就会取消工作，所以 escape 多余，只是每次点击多录一条零时命令。报告把这三处归为“B 路径”也不准确：三处都是 A。
- **L6** 模块边界规则是黑名单（`check-module-boundaries.mjs:287-288`）。内容模块仍能 import `engine/Core/Game.ts`（public 的 `beginWorldAutoWork`/`checkpointWorldWork`）、`ext/world5.ts`、`ext/world5Fixture.ts`、`ext/runtime.ts`（public 的 `worldWorkPlace`/`worldWorkFact`/`worldWorkTransaction`）。建议对 `crafting` 改成白名单：worldSdk、types、descriptor、fingerprint、world（仅类型），再加 UI 共享层。另外 `worldSdk.ts` 用值导出 `levelKey/compareLevelRefs`，经 `world5.ts` → `WorldWorkValidation` → `WorldItems` → `ItemLoader`/`Creature` 拖进引擎图，建议 dot 只用 `import type`，或把 levelKey 移到叶模块。
- **L7** `createActorActionBundle` 缺省 `owner:'combat'`（`ActorActionScheduler.ts:248`）。新增分配者忘记传 owner 就会静默归 combat，在无 combat 的世界局中 save 才报错。建议改为必填。
- **L8** 工位资格只看 `workPositions`（8 邻、稳定地面、对角规则、交互线），`StationDefinition.interactionDistance` 对 prepare 无效。5B §7.1 的 `inReach = Chebyshev ≤ interactionDistance` 会和 prepare 不一致。
- **L9** `src/ext/world5.ts` 改为值 import 引擎 `WorldWorkValidation`，ext 层反向依赖引擎 core，存在循环 import 风险。
- **L10** `worldWorkFacts` 是全 owner 共享的 128 条环，一个模块活跃时会挤掉另一模块的 `recentFacts`。
- **L11** 收据 `ordinal = world5.revision`（`WorldWorkWorld.ts:479`）。同一事务内连续写多条收据（例如多条 skip 放置收据）时 ordinal 会重复，校验也不查单调或唯一。

---

## 5 5B 包 §A 对照（逐项；“✓”=名称和行为一致，“✗/注”=需改包或需说明）

### A.1 占位符
- `<FOUNDATION_PROTOCOL>` = **7**（`descriptor.ts:5`）✓。
- `<MODULE_VERSIONS>` = growth 1.7.0、narrative 1.4.0、combat **1.6.0**（state 4）、giants 1.0.0 ✓（取自报告，未逐文件复核 giants 和 growth 源码版本）。
- SHA：以集成提交时重算为准。若 H1/H2 修复改到 harness 或骨架（例如骨架历史改为有界），这些 SHA 会变。
- `<5A2S_STATUS>` / `<5A3_STATUS>`：均未合入。

### A.2 名称
| # | 结论 |
| --- | --- |
| 1 | ✓ `src/ext/worldSdk.ts` 存在。**✗** “只从此文件 import” 做不到：骨架实际还需要 `ext/types`（ExtensionModule、Json）、`ext/descriptor`（FOUNDATION_PROTOCOL、ModuleDescriptor）、`ext/fingerprint`（extensionDataFingerprint）、`ext/world`（ExtensionProjectionContext 类型）。包里应改为允许这 4 个入口，并要求从 worldSdk 只用 `import type`，版本用字面量 1（见 L6）。 |
| 2 | ✓ 7 个类型名和字段与合同逐字一致。注：native 行也必须有合法的单字形和 `#RRGGBB`；native maxStack 必须恰为 1（dagger/armor），ration 为 99；tool 行 `tool.tag ∈ tags`。dot 表格满足。 |
| 3 | ✓ 名称一致。行为注意：(a) 请求对象严格键集：`planTimedWork` 必须带 `kind`；放台用 `at:{x,y}`（payload 是 x,y）；必须去掉 `v`。(b) 返回的句柄的 `operation` 必须等于信封 action，否则 `C5_BAD_PAYLOAD`。(c) 未知 recipe 由 foundation 返回 `C5_BAD_DEFINITION`，与包一致。 |
| 4 | ✓ 名称一致（第二参数在骨架里叫 `context`，无影响）。**✗ 行为**：接收事实（H3）。另外 provider 型取消（以及 M4 的误归类）不调用参与者，但 recentFacts 里有这条事实；包里 lastFactId 用 `>` 判断，能容忍跳号 ✓。 |
| 5 | ✓ `ExtensionProjectionContext.worldWork`（`src/ext/world.ts`）。仅当模块声明 worldDefinitions、world5 存在、且包内有该 owner 的 `items` 行时才提供（crafting 满足）。 |
| 6 | ✓ 字段名一致。注：`ItemRead.available` 恒等于 quantity（不扣预留）；`WorkContext.containers` 只含本层已见的 chest；`stations` = 本层自有全部 + 已见他人。 |
| 7 | ✓ |
| 8 | ✓ `worldSdk: 1` 只在 `ModuleDescriptor`（可选键），不在 ExtensionModule；声明世界字段但缺 worldSdk 时构造失败（`C5_BAD_VERSION`）。 |
| 9 | ✓ 33 码（任务书写的 34 不对）。模块可以直接返回 `{ok:false,code,field}` 字面量，但 foundation **不校验** code（L1），包需写明“只用 33 码”。 |
| 10 | ✓ `C5_CONTRACT_VERSION='1.0.0'`、`WORLD_SDK_VERSION=1`。 |
| 11 | ✓ `CraftingCommand` 已导出（module 字面量为 `'crafting'`）。 |
| 12 | ✓ `createWorldHarness` 在 `src/ext/testing/worldHarness.ts`；`WorldHarnessOptions`、`WorldHarness` 类型从 `worldSdk.ts` 导出；fixture 名 `world-work-basic`（加入模块 `c5fixture`）和 `crafting-skeleton`（加入 `craftskel`）；骨架路径正确。行为注意：(a) 被拒命令也是 `recorded:true`（0 成本但录制）；(b) `error` 是“最后一次 world-work 错误”，非世界命令不会重置它；(c) `replay()` 和 `seek()` 会替换 harness 当前的活局。 |
| 13 | ✓ `ext.foundation.world.error.<去C5_小写，保留下划线>`（如 `resource_empty`、`unknown_target`）33 键齐全；`ext.foundation.world.confirm.tool-break` ✓；另有 `ext.foundation.world.message.{completed,interrupted,startup}`。 |
| 14 | ✓ `auto_work` / `auto_step`；harvest 和单批不写 auto_work。 |

### A.3 行为
| # | 结论 |
| --- | --- |
| 1 | ✓ D16：玩家背包有 kit 就扣 1 个 kit，否则扣材料，不弹确认，不会双扣。 |
| 2 | ✓ 当前层自有工位全部可见，加已见的其他 owner 工位；DTO 带 `levelRef`。 |
| 3 | ✓ interactable owner 为定义模块；节点 `interactionDistance` 固定为 1。注意工位资格看 workPositions（L8）。 |
| 4 | ✓ foundation 写完成、中断、启动日志（取配方/节点/工位 nameKey；启动用首个礼包物品）。玩家主动 cancel-work 也写“中断”。 |
| 5 | ✓ native 输出外观沿原生模板，native 行的 glyph/color 只做校验。 |
| 6 | ✓ |
| 7 | ✓ 可以同局。`c5fixture` 在 D1 玩家附近放自己的节点、桌和一个容量 16 的箱（owner `c5fixture`），crafting 可以把这个箱当来源或目的地（同层、Chebyshev≤1、交互线、hasMemory）。注意 fixture 会占掉开局附近的格子。 |
| 8 | ✓ `command(action,data)` 直接调用原生 `executeCommand`。 |
| 9 | **未验证**（5A2 未跑 removal/composition；catalog 用 `import.meta.glob('./modules/*/descriptor.ts')` 自动发现）。 |
| 10 | ✓ 放置和礼包不碰两条 RNG 流；实体 ID 会被占用而偏移（包 T8 已允许）。 |

### A.4 以外、派发前必须改包的事项
1. **H3**：§6.4 的 totals、placements、history 要按“接收事实 = `ticketId!==null && completionOrdinal===0`”过滤（或冻结另一种约定）。
2. **玩家 bundle 从不跨命令存活**：接收和 `auto_step` 的那条命令内就跑完首批或该批（R3：命令后 bundles=0；harness 测试也只看到批间状态）。所以 T11 的“bundle 存活时 cancel-work 被拒”和 T12 的“批中（bundle 存活）存档”用公开命令或 harness 构造不出来，应改为“批间”，或标为仅 NPC/可信 fixture。
3. **L8**：§7.1 的 `inReach` 应改为“玩家 `at` ∈ `StationRead.workPositions`”，否则 UI 显示可做但 prepare 返回 `C5_DISTANCE`。
4. 骨架参与者 `history` 无界，dot 不要照抄，按 §6.4 的 128 上限实现；建议骨架同步修正（会改骨架 SHA）。
5. H2 修复后的终结票据保留策略（harness `world5().tickets` 可见内容）要在派发前冻结。
6. 自然 trace 的 `expect.recorded`：被拒命令也是 true。
7. tool-break 阈值为 `durability ≤ durabilityPerBatch × batchCount`，制作和采集都适用（镐耐久 1 时采矿会弹确认，与包一致）。

---

## 6 已检查且无问题的部分

- **唯一时间**：world-work 只经 bundle 记账。玩家 bundle 的时间由 `mirrorWorldWorkTicks` 计入 currentTick（与篝火互斥）；commit 内没有额外的世界钟；`chargedTicks` 为首批时长，cancel 为 0。`ticket.remainingTicks` 镜像不递增 revision，load 校验与 bundle 剩余相等（`WorldWorkValidation.ts:488-498`），也检查孤儿 foundation bundle。
- **中立根迁移**：
  - `run.actorActions={schema,nextActionId,bundles}`，bundle 必带 owner；
  - 存在条件为 combat provider 或 world5，新局、save、load 三处一致（`Game.ts:964/11387/11508`）；
  - 所有分配者（phased、body、dodge/parry、篝火、fixture authority）改用中立根；
  - `checkpointProductionActorActions` 把根纳入回滚身份；
  - 无 combat 的世界局由 `bindPhasedAttackProduction` 建立 world-only session（删除 combat 后 foundation 调度仍可用）；
  - 纯 combat 局不建 world5，`mirror`/`settle`/`interrupt` 在没有 world5 时立即返回。
- **零影响**：
  - classic 局不建根、不建 world5、不引入新 RNG；Item 用 `declare worldItem`，没有 own 属性；`serializeItem` 删掉不存在的键，classic 快照只有版本外壳变化；
  - 经典/0 营地 P95 与报告一致（未复测）；
  - 新增的会话字段 `worldWorkCommandEpoch`、`executingRecordedCommand` 已在 U03 登记为 session。
- **确定性**：
  - prepare 不分配 ID、不抽 RNG：预览 Item 用 `id:-1` 且不走构造器，`afterEscrow` 用 structuredClone；
  - 放置用 SHA 拒绝抽样（`placementDraw`），候选按 (y,x) 排序；
  - 实时双 prepare 与 replay 单 prepare 的写效果相同；确认 No 录制 decisions=[false]，0 成本；
  - 句柄的 epoch、session 都不进入 canonical。
- **物品守恒**：
  - escrow 是真实 owner：整 stack 移入，或拆出新 ID；
  - 批完成原子消耗、输出、扣耐久、事实；
  - 取消时一次性退回原 owner（背包或来源箱），合并时 retire 来源 ID；
  - 输出和退款槽在接收时按独立 fallback 保守预留，`hasSpace` 计入预留；
  - 取消重入被 `isPublishingTicket` 拦截；
  - 退款路径不做预算检查；
  - escrow 中的物品不在背包里，不会被偷或丢。
- **全 Item 根**：`forEachItemRoot` 顺序覆盖背包、地面、携带、缓存层、pending、purgatory/pending 生物、容器；save 和 load 用同一个枚举器做双 owner 和 worldItem 校验；load 时重新绑定 `bindWorldItem`。
- **背包规则**：MATERIAL 每 stack 占 1 格；材料按 maxStack 部分合并；工具不堆叠；FOOD 仍按 quantity 占格；字母冲突时重新分配；原生拆分（丢弃、偷窃）时重新绑定定义。
- **D9**：equip、quaff、eat、read、arcana、throw（进入与执行）六个入口对 MATERIAL 零时拒绝。
- **SDK 运行期隔离**：
  - `trusted-world` scope、fixture 注册、harness 在非 DEV 下都会抛错；
  - plan* 在 prepare 外返回 `C5_SCOPE`；
  - 返回的 DTO 先 structuredClone 再 deepFreeze；
  - 句柄一次性，按 epoch 和 game 绑定；
  - 定义包整包校验后冻结；四个 action 与 `commands` 互斥。
- **stopAutoTravel 审计**：21 个调用点的 A/B 分类与源码一致（UI 三处实际是 A，见 L5）；B 入口在 auto_work 时直接返回；`stopAutoWorkInCommand` 在命令外调用会抛错；`setAutoPath` 无条件早退在 A 路径上也安全，因为前缀已经清掉 auto_work。
- **兼容迁移**：
  - 旧 v4 存档和录像在 `isWholeRunSnapshot` 和 `validateRecordingV4` 阶段就被拒；
  - 用户在 classic 下录的旧录像同样因 codec 号改变被拒，这是 D1 裁定的后果，需要在 UI 文案层面接受；
  - foundation world 实体放宽为“模块有 worldInteractables 或 worldDefinitions”。
- **副本验证**：`ext_recording_v4_digest`、`ext_world_work_sdk_contract`、`ext_world_harness_closed_loop`（加上 F3 快路径补丁）40/40 通过。
