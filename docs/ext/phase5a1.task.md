# 5A1 任务书：层所有权、权威时钟、离线 fixture 与新版录像（含 5A1-R）

> 基线：**阶段 3/4 收尾提交合入后的 ext/foundation（维护者开工时填写确切 commit：`2cd10a5`（阶段 3/4 收尾提交））**。工作分支 `ext/phase5`（从该基线新建）。
> 依据（均已批准）：`docs/ext/phase5-settlement-world.md`（P5-D01–D14 全 A；本步重点 D03/D04/D12/D14 及 §4/§5/§12/§14.1）、`docs/ext/phase5a-contract.md`（**C5-1/1.0.0 文档修订 r2**；本步读 §0–§4、§10.2、§11）、`docs/ext/phase5a0.report.md`（§3 新版录像格式与 §3.3 验收，**以该报告末节“r2 修订记录”及合同 §10.2 为准覆盖 §3.1 的逐事件全量摘要与独立录像库**）。若基线中缺这三份文档或合同不是 r2，先停下请维护者合入，不得凭记忆实现。
> 本步 = **5A1（层/钟/离线 fixture）+ 5A1-R（新版录像格式）作为同一个格式批次**，一次分配版本号。**5A1-R 是 5A2 的硬前置**（5A2 要把动作根移出 `extensions`，必须先有覆盖新根的录像摘要），因此 5A1-R 不可拆出延后。开发期门禁按 P5-D14=A（相关功能门禁；完整/组合/删除矩阵留 5Z）。**不要 commit。**

## 0 开工核对（不通过先停下报告）

1. 确认基线实际版本：`src/ext/types.ts` 中 `ExtensionManifest.foundation` / `ExtensionSnapshot.foundation.version` 为 **5**，`src/ext/descriptor.ts` 键白名单中 `foundation: 5`；`WholeRunSnapshot.ts` 的 `WHOLE_RUN_SCHEMA='brogue-web-whole-run-v3'` / version 3；`Game.ts` 录像 `version: 3`、`RecordingOrigin.version: 1`；`EntitySnapshot` 行/图无独立 envelope 槽（共用整局外壳 v3）；growth 1.7.0、narrative 1.4.0、combat 1.5.0、giants 1.0.0；`SaveStorage.ts` 打开 `indexedDB.open('brogue-web-saves', 1)` 且只有 store `checkpoint`；`App.vue` 录像键 `brogue-web-replay-v1`。与 C5-1 §1 表不符（例如收尾已占用某个格式号）时**不要自行改号**，报告差异等维护者裁定。
2. 复核合同 §1.3 中本步依赖的代码位置仍成立（行号可漂移，语义必须一致）：`TimeCoordinator.advancementLoop` 中 `soonestTurn>0` 时的 `bodies.advanceElapsed` 与 `actions.advanceActionTime`；`Game.monstersApproachStairs`；`LevelTravel.scheduleLevelFollowers`；`GenerationCoordinator.generateDepth` 中重访缓存层先 `restoreFallenItems()` 再 `catchUpEnvironment`；`Game.recordInputEvent` / `updateRecordedCheckpoint`。任何一处语义不同，停下报告。
3. 用 `git log` 记录基线 commit 与工作区干净状态，写入报告。
4. 通读 C5-1 r2 §0–§4、§10.2、§11 与 5A0 报告 §3 及其 r2 修订记录后再动手；名字、字段、算法 ID 以合同为准，合同未定的内部实现细节可自定但须在报告中列出。

## 1 版本分配（本批次唯一一次；合同 §1.2 版本计划第一行）

| 项目 | 旧 → 新 | 说明 |
| --- | --- | --- |
| foundation 协议 | 5 → **6** | manifest schema 仍为 1，存档/录像中的 foundation 精确匹配；`src/ext/descriptor.ts` 导出 `FOUNDATION_PROTOCOL = 6`，键白名单校验改为比较该常量；既有四模块 descriptor 改为 `foundation: FOUNDATION_PROTOCOL`，**不改**其 module/rules/state 版本 |
| 整局快照 | whole-run-v3 / 3 → **whole-run-v4 / 4** | 新增可选 `run.world5`；save 不再同时持有 `run.recordedInputEvents` 第二份可写历史（见 §2 5A1-R） |
| 实体行/图与共用外壳 | 行/图不变；共用 whole-run **v4** | **维护者 2026-10-06 裁定选项 1**：不引入独立实体 codec 槽；报告写明“实体 envelope 无独立槽、未单独升号” |
| 录像 | 3 → **4** | 5A0 报告 §3.1 `RecordingV4`，按报告 r2 修订记录调整事件摘要字段 |
| 录像来源 | RecordingOrigin 1 → **2** | `RecordingOriginV2` |
| IndexedDB | `brogue-web-saves` v1 → **v2** | 保留 `checkpoint`，新增 `recordings / eventChunks / snapshots` |

- 后续计划（仅供知悉，本步不得预占）：5A2 若格式变化分配 foundation 7；5A2 的 combat 格式变化与 5A2-S 合并一次升号；5A2-S、5A3 仅在格式变化时升号。
- 所有旧版本（foundation 5、whole-run-v3、录像 3、来源 1、localStorage 中的 `brogue-web-replay-v1`）**统一拒绝，不迁移**，在退休当前局前拒绝并给出 i18n 简洁原因。IDB 升级到 v2 时保留 `checkpoint` store 的对象不删，但其中旧格式存档在读取时按上条拒绝。
- 子里程碑之间不得各自升号或使用临时号；中途停下的子里程碑只供审阅，不作为可合并交付。
- 新增 Game/Item/Creature 持久或会话字段必须登记 `scripts/u03-state-contract.json`（kind ∈ run/derived/session/reset，附一句合同说明），由 `src/test/u_03_whole_run_snapshot.test.ts` 校验；派生缓存（房间/FOV/路线/摘要 dirty 索引）不进持久根。

## 2 推荐顺序与可停下的子里程碑

每个子里程碑完成后可停下写报告（列出已完成与剩余项），等待维护者决定是否继续。

### 5A1a 层所有权 + simulationTicks + 可选 world5 根

- `LevelRef`、`levelKey`、`compareLevelRefs`（C5-1 §2.1；dungeon depth 1…40，site 只做类型/校验，机械调用返回 `C5_UNSUPPORTED`）。owned region、interactable、bundle 本步继续使用 `depth: number`，不改为 LevelRef。
- ID 空间（合同 §2.1）：本步新建的 world5 记录（订单）用 `world5.nextWorldId` 的 `WorldId`；居民/Item/region/interactable 一律是既有实体分配器的 `EntityId`（region id 即 EntityId），不得为同一对象再分配 WorldId。本步不新建运行期 region。
- `World5Snapshot`（schema 1，合同 §2.2）作为可选 `GameSnapshot.run.world5`。本步物化 `revision / simulationTicks / nextWorldId / nextPlanId / levels / orders / residents / offline / receipts`；`structures / containers / nodes / stations / tickets / restPoints / pendingPlacements / startupGrants` 必须是空数组并严格校验为空（5A2/5A3 才开放）。`world5.revision` 只是诊断计数，不进入任何命令 payload 或 CAS。
- `LevelRecord` **只覆盖已访问层**：在层首次成为 visited 的同一事务建立；`generatedBy` 对 dungeon 恒为 `'native-dungeon'`。唯一所有权：一个真实层只有一个承载者（活动层在 Game，缓存层在 `LevelState`），LevelRecord 只是索引；`persistenceReasons` 由真实引用推导；跨 `generateDepth`、`LevelTravel`、Game 跟随/坠落恢复路径校验无可写别名。
- `simulationTicks` 唯一提交点（合同 §3.1）：在 `advancementLoop` 每圈 `soonestTurn > 0` 处，紧随 `ports.bodies?.advanceElapsed(soonestTurn)` 与 `actions.advanceActionTime(soonestTurn)`、在客观块倒计时扣减之前，经新的可选端口 `ports.worldClock?.advance(soonestTurn)` 增加；**不依赖 actions 端口存在**。动画 yield 恢复不重复加；生成器在 yield 处退休时已提交的 elapsed 与同圈已扣的怪物计时一起保留、不单独回退；坠落 `continue` 后下一圈按其自身 elapsed 计，坠落本身加 0。load、UI、墙钟、生成预热、原 catch-up、seek 本身不推进；seek 重放真实耗时命令按原 elapsed 重建。`currentTick`、`absoluteTurnNumber` 语义不变，三者不可互相覆写。
- 能力开关**只由新局 manifest 静态决定**：只有 manifest 含需要世界能力的模块（本步仅测试 fixture）时，新局初始化建立 world5 与时钟（初值 0）；否则不建字段、不注册新随机/抽样域、不推进新计时。load 校验 world5 有无与 manifest 一致；运行中不可开关。
- foundation 6 / whole-run v4 codec、严格校验（未知键、安全整数、单调、溢出 `C5_OVERFLOW`、时钟倒退 `C5_BAD_TIME`、双承载 `C5_BAD_OWNERSHIP`）。

### 5A1b 离线 planner + 提交事务 + 管理层政策 + fixture

- 新可信入口 `src/engine/Core/WorldSettlement.ts`：纯函数 `planOfflineSettlement(input)`（无 Game、无全局 RNG、无消息、无写入）、`offlineDraw`（`sha256-c5-offline-v1`）与 `offlineSeedKey`（`c5-seed-v1`）。
  - seedKey = SHA-256 of canonical `["c5-seed-v1",runSeed,campSlotId,domainId,rulesFingerprint]`，**campSlotId 是稳定营地 slot 0…7**（不是营地实例 ID，不含 levelKey），保证拆营重建不能重掷。
  - canonical JSON 规范照合同 §3.4（ECMAScript `JSON.stringify` 紧凑输出、原样 UTF-8、非 ASCII 不转义、仅必需控制字符转义）。
  - 冻结合同 §3.4 表中的 3 条 offlineDraw 向量与 4 条 seedKey 向量，并补空/超长/非十六进制 seedKey、负数/非安全整数、campSlotId 越界、非法 domainId、canonical 转义等拒绝/边界向量。
- DTO 与持久位置（合同 §3.3）：
  - 订单持久在 `world5.orders`（`EconomicOrder.id: WorldId`），**`remainingEpochs` 与 `planId` 只在订单**；`OfflineLedger` 不复制它们。
  - 离场冻结摘要持久在 `ledger.frozen`（路线、床、设施资格、已知威胁、结构 revision、规则指纹）：在离开该层的安全点由引擎**一次**计算写入；planner 只读它，结算时不重新推导；load 校验 `frozen.rulesFingerprint` 与当前一致。本步无结构，`facilities` 为空，居民路线由 fixture 的真实 ally 位置在离场时计算。
  - 居民动态（存活、短缺 0…3）在 `ledger.residentStates`；居民身份在 `world5.residents`（`ResidentRecord`，含 campSlotId）。
- 经济核按合同 §3.3 顺序处理每个绝对完整 epoch（`epoch=floor(simulationTicks/1000)`）；`remainingEpochs` 0…32 属于补给单生命周期，耗尽后 `needs-resupply`；单 epoch 完成上限 1024；`pendingOutputs` 下一 epoch 才可用。**长尾的规范定义是逐 epoch 迭代**：实现可用闭式算式跳过任意多 epoch 以保证耗时有界，但必须另写一个仅测试的参考逐 epoch 迭代器，并在边界与随机分段上逐字段对照。重复的同一计划为幂等 no-op；旧 revision 的不同计划 `C5_STALE`。
- `commitOfflineSettlement`：同步事务提交 world5 账本、订单、模块状态、收据；本步生产路径只支持 ledger/orders/residentStates/receipts/pending-encounter；`item-delta`/`ticket-progress`/`structure-damage` 在没有 5A2/5A3 根时返回 `C5_UNSUPPORTED`，fixture 可通过**测试专用**效果汇入自有 state 验证顺序与守恒。
- 管理层政策 `frozen-ecology-economy-v1`（合同 §3.5）：
  - 该层离场冻结火/气/液/非工作生物/HP/状态/combat 资源，**替代**其重访时原最多 100 次 `catchUpEnvironment`；其他层原路径不变，首次生成 50 次预热不变。
  - `monstersApproachStairs`：对管理层的相邻缓存层**整层跳过**（不递减 `entersLevelIn`、不迁出）。
  - `scheduleLevelFollowers`：新增排除谓词端口，`world5.residents` 中的居民不安排跟随（与 movementRegionId 绑定者同样跳过，不发 regionBlocked 通知）；不为此新增 Monster 字段。
  - 重访管理层顺序：**离线结算（计划+提交）→ `restoreFallenItems` → pending 坠落生物 → 不跑 catch-up**。玩家不在时坠入管理层的物品/生物留在 pending 根，结算后才写入。
- 入层顺序：冻结离开层（写 `ledger.frozen`）→ 移交目标层唯一承载 → 旧区间纯规划与完整预检 → 同步提交 → 写入 pending 坠落物与生物 → 玩家落点/跟随者落位 → enteredLevel → 原命令 checkpoint。load 只验证恢复，禁止 onLoad 产出；保存可带未物化区间。玩家终局冻结整局，不补结。
- **fixture**：foundation 自有、仅测试发现（沿用现有 foundation 测试 fixture/provider 的放置惯例，不进生产 catalog、不加 descriptor 发现项），提供：把某 dungeon 层登记为管理层（campSlotId=0）、开一张有限订单、登记居民（真实 ally Monster ID）、一个登记事件。不得做成 settlement/crafting 内容。

### 5A1-R 新版录像格式（5A0 报告 §3 + 其 r2 修订记录 + 合同 §10.2）

- 类型：`RecordingV4` / `RecordingEventV4` / `ReplaySnapshotV4` / `RecordingOriginV2` / `RecordingInputStateV2` 按报告 §3.1，`codec` 字段的具体号码按本任务 §1 实际分配写入（报告中的数字只是候选）。摘要算法 `sha256-c5-merkle-v1`（leaf/domain/root/chain 前缀与排序照抄 §3.1，canonical JSON 规范同合同 §3.4，冻结固定向量）。
- **分层摘要**（合同 §10.2，取代报告 §3.1 的逐事件全量 `MechanicalDigest`）：
  - 每条事件：`checkpoint` 只覆盖 dirty 跟踪域 **extensions / world5 / actorActions**（本步 actorActions 尚不存在，固定空域摘要），外加廉价诊断：tick、turn、simulationTicks、levelRef、玩家位置、玩家 HP、背包 `inventoryStamp`（合同 §4.2 `c5-inventory-v1`）、双 RNG 状态与计数。本步允许以“全量重算这三个域”实现（成本与今天逐事件 `extensionRuntime.snapshot()` 同量级）；若实现增量 dirty，须保留独立全量实现并在 chunk 边界与测试中比对。
  - 每 256 条命令的 chunk 边界（`(index+1) % 256 === 0`）、每个加速快照点与最后一条事件：`fullCheckpoint` = 完整 `MechanicalDigest`（native / extensions / world5 / actorActions / knowledge / random 全量重算），并校验增量域与全量一致。
  - **经典局（无 extensions/world5/actorActions）**：每事件只记今天已有的 tick/depth→levelRef/player/turn/rng 诊断，`checkpoint` 为 null，**维护者 2026-10-06 接受 inventoryStamp/chainDigest 两次 SHA-256，以新增 P95 ≤1 ms 验收**；完整原生摘要只在 chunk 边界/快照点。
  - **维护者 2026-10-06 裁定（选项 1；合同 §10.2）**：保留 r2 成本、格式与检测节奏，不增加逐事件 native/knowledge 证据。隐藏 native/knowledge 分歧在首个可验证的不一致完整摘要命令处停止，报告 command/域/tick/位置、前一个已验证边界及区间 `(previousVerifiedBoundary, command]`，并提供包含两端的 `fromCommand=previousVerifiedBoundary+1`、`toCommand=command`。边界 0 为已验证新局起点，其后只使用已通过完整摘要校验的边界（含已验证加速快照）。不得冒称隐藏分歧的精确首命令；dirty 域仍逐事件精确定位。
  - 摘要域字段清单与 `scripts/u03-state-contract.json` 绑定：每个 kind=`run` 字段恰属一个域，`derived/session/reset` 字段列入排除清单；新增测试校验一致。持久知识/记忆不得当显示缓存排除。
- 加速快照：每 **2048 条已完成输入命令**在无 advancement/确认/未提交事务的安全点生成 world-only 快照（剥除 events/origin/snapshots 本身）；缓存 **按每个录像** ≤64 MiB 且 ≤128 份，按 afterCommand 淘汰最老；单份超 64 MiB 不存；seed/完整命令/摘要链**永不截断**。
- replay：从 seed/manifest 重开，逐条比较本事件可得的摘要与诊断/双 RNG，chunk 边界比较全量；不同即停止，dirty 域报精确首个 command/域/tick/位置，隐藏 native/knowledge 按上述裁定报首个可验证分歧命令及完整区间字段。seek：选 ≤目标的最近有效快照，完整校验后在候选 Game 恢复再重放；坏快照跳过回退更早点/seed；外部未验证快照首次按 seed 重放验证；诊断精度和已验证边界在候选发布/回退后保持正确。
- save：world + 一份 `RecordingOriginV2` 摘要前缀（与 save 同一 IDB 事务），续录检查 header/index/chain/inputState 连续；分支续录丢弃后缀与越界快照。
- 存储：新增 `src/engine/Core/RecordingStorage.ts`，与 `SaveStorage.ts` **共用同一个 IndexedDB 库 `brogue-web-saves`**（共享 opener，版本 1→2 的 `onupgradeneeded` 只新增 store，不动 `checkpoint` 内容）；新增 store `recordings / eventChunks / snapshots`，event 每 256 条一 chunk，清单与 chunk 同事务；保存存档时 `checkpoint` 与相关 `recordings/eventChunks` 在**同一个 readwrite 事务**中提交。保持现有“单一当前录像”UX（以 IDB 中的当前录像替代 `brogue-web-replay-v1` 单键），不新增录像列表；localStorage 只留小偏好/索引；JSON 导入/导出保留（导出可选带快照）。**不新增 npm 依赖**：IDB 测试用注入的内存适配器/手写 fake，真实浏览器 IDB 列为未验证项。
- **P95 门禁**（合同 §10.2）：实测“每条命令新增成本 P95”，拟议阈值经典 control ≤1 ms、0 营地扩展局 ≤5 ms，大状态代理样本如实报告；chunk 边界全量摘要耗时单独报告。超标时按合同回退顺序：先把完整原生摘要放宽到每 1024 条/仅快照点，再把 dirty 域退为仅 chunk 边界摘要；每次回退在报告中写明检测粒度损失，不缩小覆盖。最终阈值由维护者在审阅报告时确认。

## 3 非目标（出现即越界）

- 不做 settlement/crafting 任何内容、命令、UI、数值；不建模块 descriptor。
- 不做 MATERIAL/工具/容器/escrow/节点/工位/工作票据/中立 `run.actorActions` 根/auto_work/WorldWork SDK/harness（5A2）；不做结构/房间/运行期 region/cellProperties/RestPoint（5A3）；不做 site 生成（5C2）。
- 不改 combat/giants/growth/narrative 规则、数值、state 布局；不改生成算法；除 `foundation: FOUNDATION_PROTOCOL` 外不改既有模块 descriptor。
- 不实现离线火灾/洪水摘要（D04=A）；不让墙钟离线产出（D03）。

## 4 必须保持的不变量

1. **零影响**：未启用世界能力的组合不物化 world5、不建时钟、不加 RNG 调用/新域；经典局每事件两次 SHA-256 按已批准 P95 门槛验收；两条 RNG 流、生成结果、UR2/UR3/UR4 黄金 trace 不变（格式外壳版本号变化除外，见 §6）。
2. **确定性**：planner/offlineDraw/seedKey 只依赖输入 DTO；`S(t0,t2)=S(S(t0,t1),t1,t2)` 对全部余数/收据/ordinal/随机键成立；闭式长尾与参考迭代器逐字段相等。
3. **恰好一次**：load、seek 本身、查看、UI 打开不结算；replay 在原来那条真实入层命令处结算且只一次；从结算后的快照 seek 不再结算。
4. **回滚**：入层/提交任何发布点失败（ID 分配、账本、模块参与者、消息/事实、层移交、会话索引）→ 完整对象图恢复，不半发布；坏档/坏录像在退休旧局前拒绝。
5. **单一时间归属**：simulationTicks 只有一个提交点；管理层不再跑 100 次补算；经济 elapsed 不传给 combat scheduler。
6. **管理层不被跨层写穿透**：管理层离场期间无怪物迁出、居民不随玩家迁层、坠落写入发生在结算之后。
7. save 内只有一份可写录像历史；快照不递归包含 origin/events/snapshots。

## 5 必测场景（新测试登记到 `scripts/test-suites.json` 对应底座清单，命名 `ext_world5_*` / `ext_recording_v4_*` 等）

**维护者 2026-10-06 审查裁定补充（对应合同 §10.2）**：存档来源与用户录像独立存储；seek 后/另一局存档不能改写录像或清缓存。居民经济归属与 native 承载分开，pending/离层/死亡后复活合法、相关旧工作停用，toSnapshot/loadSnapshot 使用同一 world5 校验；真实 monstersFall 单体/整体身体进入已缓存管理层必须 pending→结算→落位，补坠落及复活往返。六域摘要不含本地化正文/显示名、随机外观使用稳定 id，英文录制/中文回放和中途切语言通过，撤回 x2i 的切语言时机规避。收据滚动保留最近 128 条并按高水位去重，补 >128 回归。旧存档菜单可见、解释不兼容、覆盖需确认；旧 localStorage 录像可下载原 JSON 且永久关闭提示。补两个拒绝原因、配额去缓存重试、DEV 专用 fixture、seed seek 保留可信缓存和异常反馈、真实连接 checkpoint 的升级测试与生产 IDB 适配器测试；不新增依赖。经典两次 SHA-256/事件获准保留，新增 P95 ≤1 ms/≤5 ms、chunk 单列，并在交付报告登记该批准偏差。

时钟与层：
- 正 elapsed 累加一次（多 NPC、群体、环境块、麻痹/长动作/等待、无 actions 端口的组合）；动画 yield 恢复不重复加；坠落续圈只按新圈 elapsed；零时间命令/No 确认不推进；load/seek/UI 不推进；seek 重放重建同值；三种时间互不覆写。
- 唯一承载：生成、上下楼、相邻缓存层跟随、坠落、恢复后无双别名；LevelRecord 只为已访问层建立；坏档双承载/孤儿 LevelRecord/未访问层记录拒绝。
- world5 有无与 manifest 不一致的存档拒绝；未启用能力的真实 Game 新局/游玩/save/load/replay：无 world5 字段、RNG 计数与旧路径一致。

离线核（纯 planner + 真实 Game）：
- 0 / 999 / 1000 / 1001 tick；31 / 32 / 33 epoch；超长区间（如 10^9 tick）长尾耗时有界，且在可迭代规模（如 10^4 epoch）与参考逐 epoch 迭代器逐字段一致。
- 同一区间 1 段 vs 2 段 vs 17 段（含 epoch 中间切分、中途 save/load）完整状态逐字段相等，不只比产量。
- `ledger.frozen` 在离场时写入一次、结算不重算（离场后篡改真实路线不影响结算）；`remainingEpochs` 只在订单、ledger 不含该字段；坏档中两处不一致的旧形状被拒绝。
- 管理层：相邻管理层的怪物 `entersLevelIn` 冻结且不迁出、非管理层照旧；登记居民不随玩家迁层、非居民盟友照旧跟随并在结算后落位；坠入管理层的物品/生物在结算后才写入；非管理层仍走原 catch-up，首访 50 次预热不变。
- load 不结算；保存未物化区间后读档再入层结算一次；终局后冻结不补结。
- 失败注入：planner 拒绝、提交中途抛错、模块参与者异常/Promise、ID 溢出 → 全对象图/ID/计数/RNG/消息/缓存恢复，用独立写集差分，不只比 JSON。
- 重复计划幂等、旧 revision `C5_STALE`、`fromTick≠lastSettledTick`/余数不符 `C5_BAD_TIME`、remainingEpochs 越界拒绝。
- offlineDraw/seedKey 固定向量（合同 7 条 + 新增边界/拒绝向量）；同 slot 拆建（fixture 模拟撤销后重建）seedKey 不变、ordinal 高水位不归零。
- 真实命令 save/load/逐条 replay/seek/续录，覆盖“离开管理层 → 别层耗时 → 返回结算”跨两层。

录像格式：
- 摘要正确性：每域篡改（native/extensions/world5/actorActions/knowledge/random 各一）均被检出——dirty 域在首个分歧事件精确检出，隐藏 native/knowledge 在首个可验证完整摘要命令检出并报告前一个已验证边界及完整区间字段（维护者 2026-10-06 裁定）；空域固定摘要；chain 起点/逐条向量冻结；recordedAt 不入链。
- 经典局：事件无 `checkpoint`、chunk 边界有 `fullCheckpoint`，逐事件成本与 v3 基线同量级（测量对照）。
- u03 字段与摘要域绑定测试：新增一个未登记域的 run 字段必须使测试失败。
- 快照节奏：0/1/255/256/257/2047/2048/2049/4096 命令边界；No 确认计入；长动作中不截快照。
- 淘汰：同一录像超过 64 MiB 或 128 份按 afterCommand 淘汰最老；单份过大不存仍可从 seed seek。
- seek 等价：从 seed、从有效快照、坏快照回退三条路径到同一目标的摘要完全一致；外部未验证快照首次走 seed 验证。
- OOS：人为制造 dirty 域、native 域及 knowledge 域分歧，停止并报 command/域/tick/位置；dirty 域精确首命令，隐藏 native/knowledge 明示“首个可验证分歧”和前一个已验证边界到该命令的区间，含 `previousVerifiedBoundary/fromCommand/toCommand`。覆盖新局边界 0、已验证 chunk/加速快照、seek 候选发布/坏缓存回退与重启后的边界重置；测试命名不得声称恢复了未记录的隐藏精确首命令。
- 续录：活动模态（inventory/arcana/throw/pendingUseConfirm）保存后续录；分支续录丢弃后缀；长前缀 save 不二次嵌历史。
- 存储：内存 IDB 适配器下 v1→v2 升级保留 `checkpoint` 内容；`checkpoint` 与 `recordings/eventChunks` 同事务写入，写失败原记录不丢；旧 localStorage v1 键拒绝执行且不迁移，可导出原 JSON 并永久关闭提示；存档来源与用户录像隔离。
- 旧版本拒绝：录像 3、来源 1、whole-run-v3、foundation 5 的存档与录像在退休当前局前拒绝。
- 体积/耗时与 P95 门禁：对 5A0 报告 §2.4/§2.6 同口径样本（control 与可构造的大状态代理）测实际 v4 字节（64 / 2048 / 2049 命令）、每命令新增成本中位/P95（逐事件与 chunk 边界分开）、save/导出/seek 耗时；若基线有 `scripts/phase5a0-size-probe.mjs` 可复用方法（勿改其输出语义），否则在仓库外脚本测量；与 5A0 数字并列，说明不可比之处，并写明是否触发回退。

## 6 预计改动的共享文件

`src/ext/types.ts`、`runtime.ts`、`descriptor.ts`（`FOUNDATION_PROTOCOL`）、`compatibility.ts`、`fingerprint.ts`、各模块 `descriptor.ts`（仅 foundation 引用常量）；`src/engine/Core/Game.ts`（录制/校验/seek/load/入层/跟随坠落/monstersApproachStairs）、`TimeCoordinator.ts`（worldClock 端口）、`GenerationCoordinator.ts`（管理层结算先于 restoreFallenItems）、`LevelState.ts`、`WholeRunSnapshot.ts`、`EntitySnapshot.ts`（如需要）、`SaveStorage.ts`（共享 opener/DB v2）；`src/engine/Movement/LevelTravel.ts`（排除谓词）；新 `src/engine/Core/WorldSettlement.ts`、world5 codec、摘要模块、`RecordingStorage.ts`；`src/App.vue`、`MainMenu.vue`/`ReplayControls.vue`（录像入口改 IDB）、相关 i18n；`scripts/u03-state-contract.json`、`scripts/test-suites.json`。

- 因版本外壳变化需要更新的既有 fixture/黄金（u_27、x2a、x3b、U03 等）：先归因到具体字段变化，按原捕获方法重录并在报告逐字段登记；**不得**因换版本直接整体重录或放宽断言。UR2/UR3/UR4 trace 预期不变，若变化先停下归因。
- 本步不应改生成；若确实触及 `GenerationCoordinator` 的生成行为（非仅所有权/补算/结算顺序路径），追加 `npm run test:drift` 并解释。

## 7 门禁（开发期相关功能，P5-D14=A）

环境：`export PATH='/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':"$PATH"`（Node **24.19.0**），`export NODE_OPTIONS=--max-old-space-size=3072`，vitest 统一 `--maxWorkers=2`。每个子里程碑停下前跑一遍与之相关的部分，最终全部跑：

1. `node scripts/check-module-boundaries.mjs`
2. `npx vue-tsc -b`
3. `npm run build`
4. 本步新增全部测试 + 直接受影响测试：`src/test/u_r2_trace.test.ts`、`u_r3_trace.test.ts`、`u_r4_trace.test.ts`、`u_27_recording.test.ts`、`x2a_recording_checkpoint.test.ts`、`x3b_display_recording.test.ts`、`x3b_item_details.test.ts`、`u_03_whole_run_snapshot.test.ts`、`u_03b_level_travel.test.ts`、`c_5_fall_subsystem.test.ts`、`main_menu_replay_seek.test.ts`、`perf_2_replay_cadence.test.ts`、`ext_foundation*.test.ts`、`ext_generation_checkpoint*.test.ts`、`ext_compatibility_diagnostics.test.ts`、`ext_module_composition.test.ts`，涉及 SaveStorage/IDB 的既有测试，以及各模块自有测试中涉及存读/录像/版本号/descriptor 的文件（用 grep 版本常量与 `foundation: 5` 定位并列出）。
5. 真实组合 smoke（engine-only 即可）：空模块、旧四模块各单独、四模块全开、fixture 单独、fixture + combat + giants；每组新局/游玩/save/load/逐条 replay/seek/续录。可用 `node scripts/check-module-composition-smoke.mjs --engine-only`（按其现有参数选择子集）加 fixture 专用测试。
6. 若触及生成：`npm run test:drift`。

不跑完整 `npm test`、全部 `test:ext`、removal 删除矩阵（留 5Z）。任何失败先单变量归因：真实缺陷修生产代码补回归；过时前提给出旧前提/证据/最小调整；不加 skip、不放宽有效断言、不延长超时掩盖性能。

## 8 交付

- 代码与测试（不 commit），以及 `docs/ext/phase5a1.report.md`：
  - 基线 commit、开工核对结果（含 §0 第 2 条各代码位置的实际行号）、最终版本表（§1 每项实际值）、U03 新登记字段清单及其摘要域归属。
  - **逐子项 done / not-done 清单**：按 §2 的 5A1a、5A1b、5A1-R 每个要点逐行标注，未完成写原因与剩余工作；合同中自定的内部细节列表。
  - 每条门禁的实际命令、退出码、文件/用例数量、耗时；失败与修复记录；真实 skip/todo 来源。
  - 重录的 fixture/黄金逐字段归因表。
  - 体积/耗时测量与 5A0 对照表；dirty 域是全量重算还是增量、P95 是否达标、是否触发回退及检测粒度影响，如实写。
  - 未覆盖项：真实浏览器 IDB/录像 UI、最大状态长局、5Z 门禁等，明确标“未验证”，不得以 engine-only 冒称浏览器验收。
  - 交接给 5A2 的事项：5A1-R 已合入的证据（5A2 的硬前置）、actorActions 域当前为空域的约定、`FOUNDATION_PROTOCOL` 的使用方式。
- 原始日志、大型样本、测量 JSON 放仓库外（`/private/tmp/...`），报告只引路径与摘要。
- **不要 commit，不要 push，不要修改 `docs/ext/README.md` 以外的阶段文档**（README 仅可在报告完成后追加一行 5A1 状态与报告链接）。
