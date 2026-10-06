# 5A1 交付报告：层、时钟、离线 fixture 与录像 v4

日期：2026-10-06。基线 `2cd10a5`；工作分支 `ext/phase5`；原 5A1 开工及当前 HEAD `60a5435`，原开工工作区干净；本次审查修复继续同一未提交候选。代码留在当前工作树，**未 commit、未 push、未合入其他分支**。依据 [任务书](phase5a1.task.md)、[C5-1/1.0.0 r2](phase5a-contract.md)、[5A0 报告及 r2 修订](phase5a0.report.md)，继续执行维护者对 5A1a 的认可和实体编码选项 1 裁定。

5A1a、5A1b 与 5A1-R 的工作树实现及本轮审查修复已交付；H1–H3、M1–M3 与低项逐项处理，617 项相关回归及 boundary/types/build 通过，P95 复测达标（见 §8）。**native/knowledge 诊断精度的合同阻断已由维护者 2026-10-06 裁定关闭**：保留 r2 成本与格式，隐藏分歧报告“首个可验证分歧命令 + 前一个已验证边界到该命令的区间”，dirty 域仍精确到首命令。合同 §10.2/§10.3 与任务书已同步，结构化诊断、错误文本及对应回归见 §3；诊断裁定修订门禁在 §5.0；本次审查修复与最新门禁/P95 在 §8，原交付证据仍保留。**5A2 的 5A1-R 硬前置待维护者验收并合入 commit 后关闭**；当前工作树未 commit，不能将裁定关闭等同于已合入。

## 1 开工核对、版本与状态登记

先读 AGENTS.md、docs/HANDOFF.md、docs/development.md、docs/architecture.md、docs/ext/README.md，再读任务指定设计/合同章节。开工 `git log -3 --oneline`：`60a5435` 填写基线，`7cdd477` 合入设计，`2cd10a5` 阶段 3/4 收尾。本次未改地图生成算法；既有四模块只改 descriptor 的 foundation 常量引用，不改 module/rules/state 版本、数值或布局。

以下位置为**开工 HEAD** 的实际行号，最终行号随插入漂移：

| 核对 | 实际位置和语义 | 结果 |
| --- | --- | --- |
| foundation 5 | types.ts:27、33；descriptor.ts:10、31；registry/runtime | 与计划一致 |
| whole-run-v3 / 3 | WholeRunSnapshot.ts:35、185、472 | 与计划一致 |
| 录像 3 / 来源 1 | Game.ts:3819、3920 / :307、1099 | 与计划一致 |
| 实体 envelope | EntitySnapshot.ts:11、23、28、43 为实体行；WholeRunSnapshot.ts:71–72 为共用外壳 | 无独立槽；维护者已裁定选项 1 |
| DB v1、checkpoint | SaveStorage.ts:15；App.vue:39 的旧录像键 | 与计划一致 |
| 正 elapsed 调度 | TimeCoordinator.ts:118–150，bodies:147、actions:149，随后客观块 | 语义一致 |
| 相邻缓存迁移、跟随 | Game.ts:1855；LevelTravel.ts:56；GenerationCoordinator.ts:267 | 语义一致 |
| 重访、预热 | GenerationCoordinator.ts:384、430–436，fallen items 先于 catch-up；首访 50 次 | 语义一致 |
| 事件记录、完成 checkpoint | Game.ts:3348、3379 | 语义一致 |

| 项目 | 最终值 | 本批次 |
| --- | --- | --- |
| foundation | `FOUNDATION_PROTOCOL = 6`，manifest schema 1 | 5→6，一次分配；四模块引用常量 |
| 整局 | `brogue-web-whole-run-v4` / 4 | v3/3→v4/4 |
| 实体行/实体图 | 原字段和编码不变，共用整局 v4 | **实体 envelope 无独立槽、未单独升号** |
| 录像 / 来源 | RecordingV4 4 / RecordingOriginV2 2 | 3→4 / 1→2 |
| 录像 codec | `{wholeRun:4, foundation:6, origin:2}` | `sha256-c5-merkle-v1`；chunk 256，快照 2048 |
| IndexedDB | `brogue-web-saves` v2，checkpoint/recordings/eventChunks/snapshots | v1→v2，只增 store |
| growth / narrative / combat / giants | 1.7.0 / 1.4.0 / 1.5.0 / 1.0.0 | module/rules/state 身份均不改 |

新增持久 Game 字段只有 `world5?: World5Snapshot`，在 U03 登记为 `run`，摘要域为 `world5`；没有新增 Item/Creature 字段。`recordedInputEvents` 改登记 `session`，唯一持久历史在 `recordingOrigin.events`；`recordedInputIndex` 为 `derived`。`updatedSafetyMapThisTurn/safetyMap/loopMap/monsterPathCache` 明确为派生路径缓存：whole-run 仍可往返它们，机械摘要不依赖其是否已重建。其他原生 persist/level 根继续由原生 codec 投影覆盖。

`scripts/recording-digest-contract.json` 与 U03 字段集绑定：每个 run 字段恰属一域；其他 kind 均明确登记，不将持久知识当缓存排除。测试加入一个未归属的 run 字段会失败。native 覆盖实体图/层/所有权/输入资格；extensions 覆盖所有模块与底座状态；world5 覆盖完整根；actorActions 固定带标签空域；knowledge 覆盖 Cell 记忆、物品已知信息、种类/风味/称呼/极性、发现、日志与终局知识；random 覆盖双流状态和计数。

## 2 逐项交付与证据边界

### 5A1a

| 任务要点 | 状态 | 实现与验证 |
| --- | --- | --- |
| LevelRef、排序、site unsupported | done | world5.ts：dungeon 1…40，site 仅类型/校验；机械调用 C5_UNSUPPORTED，原 depth 接口不迁移 |
| WorldId/EntityId 空间 | done | 订单只用 nextWorldId；居民使用真实 ally Monster 的 native ID，plan 用 nextPlanId；不创建运行期 region |
| 可选 schema 1 world5 和空未来根 | done | 必需根物化，structures/containers/nodes/stations/tickets/restPoints/pendingPlacements/startupGrants 严格为空 |
| 已访问层、唯一承载与索引 | done | 同一入层事务登记 native-dungeon，LevelRecord 仅为索引；真实引用推导理由，预检活动/缓存/pending/休眠承载，无双别名、孤儿或未访问记录 |
| 唯一 simulationTicks 提交点 | done | 正 soonestTurn 时，紧随 bodies/actions，在客观块扣减前 worldClock.advance；无 actions 也工作。溢出先预检，不使用墙钟/RNG |
| 静态能力开关 | done | 新局 manifest 的测试 fixture 工厂标记一次决定；普通组合没有 world5/时钟；load 检查有无一致，运行中不切换 |
| 严格 codec、时间/所有权错误 | done | 未知键、非 JSON、getter、整数、跨引用、限额、规则指纹、旧格式在退休前拒绝；C5_OVERFLOW/BAD_TIME/BAD_OWNERSHIP 覆盖 |

新增时钟场景含九成员实际身体、两 NPC、麻痹强制客观块、长动作、无 actions、环境计时、动画 yield/恢复/退休、零输入和 No 确认。九成员受控场景实际得到 simulationTicks=400/currentTick=200/turn=4，三种时间独立。真实惊落的坠落/预热不产生额外 elapsed；另有带真实相位 timer owner 的 Coordinator 坠落 continue 场景累计 250 ticks，落地回调收费 0。load/seek/UI 自身不推进，seek 按真实命令 elapsed 重建。受控身体/坠落布景不冒称自然遭遇长局。

### 5A1b

| 任务要点 | 状态 | 实现与验证 |
| --- | --- | --- |
| 纯 planner、offlineDraw/SeedKey 和 canonical | done | WorldSettlement.ts，无 Game/全局 RNG/消息/写入；冻结合同 3+4 向量及拒绝/转义边界，稳定 slot 不含实例/levelKey |
| DTO 持久位置与离场 frozen | done | remainingEpochs/planId 只在订单；身份在 residents，存活/短缺在 ledger.residentStates。离场一次冻结真实路线/已知威胁/指纹/revision，本步设施为空；结算不重新求路线 |
| epoch 顺序和有限生命周期 | done | 完整绝对 epoch、1000 ticks；食物/短缺→稳定订单→每 epoch 1024 上限→下 epoch 输出→单事件/ordinal→节点再生；订单 0…32，用尽 needs-resupply |
| 有界长尾与规范参考 | done | 闭式饱和尾与事件跳跃；独立测试逐 epoch 参考，0/999/1000/1001、31/32/33、10000 epoch、10^9 ticks；1/2/17 段及 JSON 保存逐字段对照 |
| 同步事务、幂等、stale、unsupported | done | ledger/orders/residentStates/receipts/pending-encounter 同步提交，参与者 prepare/publish 拒绝 Promise；相同计划 no-op，旧 revision stale；生产拒绝未来 item/ticket/structure 效果 |
| 管理层冻结生态 | done | 整个相邻管理缓存层跳过迁移与 entersLevelIn；居民不跟随且不发 regionBlocked。缓存重访结算→fallen items→pending actors，不跑 catch-up；其他层与首访 50 次保留 |
| 入层/回滚/load/终局 | done | 冻结旧层→单承载移交→纯预检→提交→pending→落点/跟随→enteredLevel→原 checkpoint。独立全对象图 oracle 检查发布失败恢复身份、RNG/ID、消息、索引与模块状态；load 不产出，终局不补结 |
| 底座仅测试 fixture | done | 自有 fixtures/world5-module，通过真实记录命令登记 slot0、32 epoch 订单、真实 ally ID、一个离线事件；不进生产 catalog、不加 descriptor |

原生居民死亡更新经济 ledger.alive、停止其工作且只记一次；ResidentRecord.levelRef 表示经济归属层，真实 actor 可在其它活动/缓存层或 pending 中。坠落离层将相关旧工作停止为 resident-displaced、路线不可达；死亡后原生复活不自动重开旧订单，经济死亡登记可保留。native 已移除的历史 ID 仍受 nextEntityId/dead ledger 约束，不能借用 Item/Player 身份。写出与读入共用 world5 校验，真实坠落/复活往返通过（审查裁定，见新增处理节）。私有经济适配器验证 food/材料/预留/工作 credit/next-epoch 输出/节点的顺序和守恒，**未来根仍关闭，没有交付 crafting/settlement、WorldWork SDK 或 5A2 harness**。

两组真实跨层输入测试（fixture；fixture+combat+giants）在固定种子真实地图行走到楼梯，经公开 move 离场，D2 接受 340 次 wait，save/load 未结算区间，真实 move 回 D1 恰好结算一次；逐条 replay、两处 seek、分支存档续录结果与完整 world5/模块 state 相同。生态/失败注入测试另使用受控活动/缓存场景，覆盖冻结路线后改变真实位置仍不重算、非居民跟随和 pending 后写入，不混称自然命令证明。

### 5A1-R

| 任务要点 | 状态 | 实现与验证 |
| --- | --- | --- |
| V4/V2 类型与 merkle/chain 固定向量 | done | RecordingV4/Digest/Format，带域 leaf/domain/root/start/event 标签，码点排序，recordedAt 排除链 |
| 三域事件摘要、廉价诊断、经典 null | done | 当前三个域**全量重算**，未声称增量 dirty；actorActions 为带标签 null 域。经典 checkpoint=null；tick/turn/level/HP/位置/inventoryStamp/双 RNG 等诊断仍保留 |
| 256 边界、2048 点、末事件 full 和一致性 | done | 六域完整机械摘要；三事件域必须与 full 一致；末事件在安全 export/save 时补 full，长期命令不丢失 |
| 每域篡改、OOS 诊断精度 | done | 六域分别篡改、坏 chain/合法 chain 语义 OOS、伪造 initialDigest、完整旧对象图保留；dirty 域报精确首命令，隐藏 native/knowledge 报首个可验证 command/domain/tick/位置及完整区间字段 |
| native/knowledge 两边界间分歧区间 | done（维护者裁定关闭） | 2026-10-06 选项 1；首个可验证分歧命令 + 前一个已验证边界到该命令的区间，见 §3。不增加逐事件证据或改变协议/成本 |
| U03 全字段域绑定和排除 | done | 显式清单+未登记字段负例；持久记忆、识别和日志覆盖；派生 FOV/light/path/mapToMe 排除，不改变 RNG/世界 |
| 2048 安全 world-only 快照与缓存预算 | done | 0/1/255/256/257/2047/2048/2049/4096、No 和悬挂动作；≤128/64MiB 淘汰最老、单份超限不存；不截 seed/事件/链，不嵌 history/origin |
| seed replay、候选 seek 与坏缓存回退 | done | 候选先验证，再发布；外部缓存首次 seed 验证；坏缓存跳过/警告，回退后完整摘要相等；全局 RNG/ID/ItemLoader/Logger/hook 原位恢复 |
| save 单历史、模态、分支续录 | done | origin2 一份前缀；header/index/chain/inputState 连续检查，分支丢后缀/越界缓存。inventory/throw 既有真实路径，arcana/pendingUseConfirm 为受控 native Item 开局布景 |
| 共用 DB2、原子 chunk/save、单当前录像 UI | done（生产适配器内存 IDB 桩/组件） | 四 store 共享 opener；用户 current 与存档 save-origin 独立命名空间，存档及来源同事务；真实连接升级、异步请求/abort/配额回退覆盖；无新依赖 |
| 所有旧版本统一拒绝 | done | foundation5/whole-v3/replay3/origin1 在退休旧局前拒绝并 i18n；旧 localStorage JSON 可下载且永久关闭提示、不迁移；DB 保留旧存档、菜单显示不兼容原因，确认后才覆盖 |
| 新增成本 P95 与体积/延迟 | done | 实测见 §6，chunk 单列；审查前新增P95为0.052ms/0.123ms；审查修复后的重测单列于处理节，不沿用旧值冒称当前测量 |

## 3 诊断精度裁定：已关闭

维护者 **2026-10-06 裁定选项 1**：保留 r2 成本与格式，不增加逐事件 native/knowledge 证据；隐藏分歧报告“首个可验证分歧命令 + 前一个已验证边界到该命令的区间”，dirty 域仍精确到首命令。已写入 [合同 §10.2/§10.3](phase5a-contract.md) 和 [任务书](phase5a1.task.md) 的实现与验收描述，取代原诊断重放定位隐藏精确首命令的要求。本项合同阻断**已裁定关闭**，没有遗留裁定请求。

原阻断的独立反例保留并扩展为两域回归：`ext_recording_v4_snapshots.test.ts` 的 `reports an interval for indistinguishable hidden %s changes at different commands`。同种子经典局两条 escape，版本 A 在第 1 条回调改变 native.foodSpawned，版本 B 在第 2 条改变；对应 knowledge 反例改变已识别 kind 集合。每域的两份导出 v4 文件逐字段相同（仅消去录制墙钟），隐藏变化的实际首命令分别为 1 和 2。两者重放均在第 2 条首次验证出该域分歧，前一个已验证边界为 0，区间 `(0,2]`，包含两端的命令范围为 **1…2**。该测试验证可观察性限制与获准诊断，没有声称恢复未记录的中间正确值。

`Game.replayDiagnostic` 是只读、冻结的会话诊断，放在既有 RecordingRuntime WeakMap 中，不进入 Game 自有状态、存档或录像。字段如下：

| 字段 | 语义 |
| --- | --- |
| `command`、`domain`、`tick`、`player.x/y` | 停止检测的命令、分歧域与该事件诊断；隐藏 native/knowledge 的 command 是首个**可验证**分歧命令 |
| `precision` | 隐藏 native/knowledge 为 `interval`；逐事件 dirty 域为 `exact` |
| `previousVerifiedBoundary` | 已通过完整摘要校验的前一个命令边界；0 是已验证新局起点，已验证加速快照点也可作边界 |
| `interval.fromCommand/toCommand` | 包含两端的命令范围。隐藏域为 `previousVerifiedBoundary+1…command`；精确诊断为 `command…command` |

仅在整条命令的完整摘要成功校验后推进边界，不以当前 cursor、未验证 fullCheckpoint 或坏缓存猜测边界。已验证快照恢复、seek 候选发布、seed 回退均携带边界与诊断；重启/清除回放重置诊断与边界。`replayError` 保留 `OOS at command N` 诊断前缀，对隐藏域追加 `first verifiable divergence`、前一个已验证边界及完整命令区间；中文 `replay.oos_interval` 明示“首次验证出分歧”和区间，不宣称隐藏精确首命令。重放与 seek 的显示提示均为 presentationOnly，持久知识日志不受污染。

回归覆盖六域有效链篡改、两域同文件反例、已验证 256 边界后的 **257…258** 区间、2048 快照首次 seed 验证及已信任缓存、尾部 OOS 候选回退、坏缓存回退、重启/新回放重置，以及中文诊断与持久日志不变。录像/来源/whole-run/foundation 的版本、序列化字段、固定摘要与链向量均未改变；本次诊断裁定修订自身未重录黄金或重跑性能探针；之后审查 M1 的黄金归因与性能重测另列。**5A2 硬前置仍待维护者验收并合入 5A1-R commit 后关闭**，裁定本身不代替合入。

## 4 自行决定的内部细节

- 用 WeakSet/WeakMap 固定测试世界能力与配置，不提供运行期开关或生产发现项。fixture 事件 epoch 由**离场 capturedTick**加固定偏移决定，偏移和预算进入测试规则指纹；不把当前结算时间/层或实例 ID 放入 seedKey。
- strict canonical 拒绝 getter、孤立 surrogate、非 JSON、非法原型、环、稀疏数组；C5 用安全整数，原生叶允许有限小数，负零为 0。物品已知 kind Set、已见 ID Set、风味 kind 映射显式排序；monster/AI/背包/staffSlots 等有规则顺序的数组不重排。
- full 摘要走无副作用 `projectWholeRun`/Logger.peekState。保留原公开 toSnapshot 的原生日志完成语义。未记录的拒绝输入/坏文件/回放完成/OOS 提示为 presentationOnly，Sidebar 仍显示，但不修改持久 archive/knowledge/RNG；战斗、剧情等机械日志仍持久。以回归证明坏文件不改变旧世界、合法后续重放不被提示污染。
- export/save 为**当时末事件**补 fullCheckpoint；继续追加时，若该旧末事件不是固定 256 边界，移除它的临时 full 并仅重建该尾链，再追加新事件。已导出副本仍是完整合法前缀。相同命令数下，频繁 save/export 与一次导出的整个 v4 文件（仅消去 recordedAt）逐字段相同，独立七命令回归覆盖；前缀比较只规范化这一个临时边界的角色，命令/决定/elapsed/RNG/三个域/所有固定 full 不变。
- 候选 Game 使用固定构造 seed 1，随后才用录像 seed 开局，避免构造函数借墙钟消耗全局 RNG。候选借用进程服务但完整 checkpoint/restore 后才发布。空 trap depression 不创建不透明空 WeakMap，保持新局全对象图等价。
- growth 尚未完成开局时不允许普通存档，这是旧模块守卫。seek 0 的已验证候选在该状态通过已验证 seed 前缀重新发布；不削弱 growth 保存资格。其他候选在普通完整 save/load 预检后发布。
- 无完整来源的存档只保存世界，不携带会话 raw history；重新读取后保持无录制来源，后续输入不伪造 seed 前缀。当前同一会话的失效录制可继续收集 raw 输入，但永远不恢复导出资格。开局命令的完整有序前缀用纯校验在退休前检查，拒绝缺失/重复创建；不依赖旧 event.extensions 形状。
- IDB 物理 eventChunks 是 checkpoint 前缀的事务镜像，并非 Game 内第二个可写 history 根；保存无录像来源的 world-only checkpoint 仍允许，但不伪造来源或承诺续录。缓存属于可丢弃加速数据，不签名，不是防作弊机制。
- 世界引用预检统一使用 `world5SnapshotContext` 的纯临时 Map/Set，不新增Game字段或持久根；活动/缓存/pending 的真实actor均可解析，归属层不强制等于当前 native 承载层；historical dead要求低于nextEntityId，且不能借用当前Player/Item或未解析的活体实体ID。dead purgatory允许保留原层的历史记录。同步事务的checkpoint/prepare/publish一律拒Promise，恢复函数只在同步类型验证后登记；JSON原位回滚删除新添自有键使用hasOwnProperty，不把constructor/toString原型键误认为已捕获键。
- 合同 r2 的 inventoryStamp CAS、交互子预算 832、每层一个 1024 格遗留物容器、material/kit 配方输入、声明式 worldDefinitions/worldWorkCommands/worldSdk:1 保持批准值。本步只实现录像 inventoryStamp 与私有经济输入约束，不开放未来生产命令/物品/容器/SDK。

## 5 审查修复前门禁、失败修复与黄金归因（历史证据）

本节保留原交付与诊断裁定修订的历史记录；本次审查最终验收见 §8.3。全部 Vitest 使用 `--maxWorkers=2`，Node **v24.19.0**，`NODE_OPTIONS=--max-old-space-size=3072`，无同时运行的两个本任务 Vitest。另一工作树可能有系统负载，未停止其任务。实际环境：

```sh
export PATH='/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':"$PATH"
export NODE_OPTIONS=--max-old-space-size=3072
```

### 5.0 2026-10-06 诊断裁定修订门禁（审查修复前）

本轮只改 OOS 会话诊断、中文错误信息、合同/任务书/报告与相关回归。按维护者要求仅跑相关测试 + boundary + vue-tsc + build；全部 Vitest 保持 `--maxWorkers=2`，Node v24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`，未并发运行本任务的两个 Vitest。以下门禁全部通过；原 145 文件结果是先前完整 5A1 交付的证据，不冒称本轮全量重跑。

| 裁定修订门禁 | 最终结果 | 实际耗时与证据（`/private/tmp/`） |
| --- | --- | --- |
| 相关 Vitest | **9 文件、106 pass、0 fail、0 skip、0 todo** | 主轮 128.256s；`phase5a1-ruling-related.json`/`-command.json`；修正测试索引后单文件 6/6 pass、9.336s，`phase5a1-ruling-text-final.json`/`-command.json`。按文件最新结果去重见 `phase5a1-ruling-coverage.json`，不把复验六项再次相加 |
| boundary：`npm run check:modules` | exit0，模块边界与测试归属通过 | 1.567s；`phase5a1-ruling-boundary.log` |
| `node node_modules/vue-tsc/bin/vue-tsc.js -p tsconfig.app.json --noEmit --incremental false` | exit0，覆盖实际 app/test 来源 | 7.023s；`phase5a1-ruling-vue-tsc-final.log` |
| `npm run build` | exit0，vue-tsc -b + Vite | 9.925s；`phase5a1-ruling-build.log`；保留既有 >500kB chunk 提示 |
| `git diff --check` | exit0 | `phase5a1-ruling-gates.json`，报告填写后的最终检查追加在同一证据文件 |

实际 argv、Node/内存配置、exit 和墙钟记录在 `phase5a1-ruling-related-command.json`、`phase5a1-ruling-text-final-command.json`、`phase5a1-ruling-gates.json`。首轮 vue-tsc exit2（7.075s）指出新测试两处 `Array.at()` 不在仓库 TS lib 声明中；改为项目已有的最后一项索引写法，保留中文诊断/区间/持久日志断言，单文件复验 6/6 pass，随后类型与构建 exit0。没有放宽类型或测试守卫。

本轮相关测试精确输入：

```text
src/test/ext_recording_v4_digest.test.ts
src/test/ext_recording_v4_snapshots.test.ts
src/test/x2i_discovery_text.test.ts
src/test/u_27_recording.test.ts
src/test/ux_1d_recording_continuation.test.ts
src/test/perf_2_replay_cadence.test.ts
src/test/u_00_new_run.test.ts
src/test/p1_30_i18n_gate.test.ts
src/test/u24_hardcoded_text.test.ts
```

本轮未再跑完整/组合/removal/CE 门禁或体积/性能探针，没有重录黄金。固定格式/摘要/链向量、单历史和存读/seek/续录，以及新局全对象图/双 RNG 的相关回归仍通过。代码、文档与报告均留在工作树，未 commit。

### 原完整交付门禁（本次诊断修订前）

| 开发期门禁 | 实际结果 | 证据/耗时 |
| --- | --- | --- |
| 相关 Vitest 最新正常文件结果 | 145文件；2261 pass，0 fail，3原有CE可选skip，0todo | final-coverage.json，逐轮实际运行见下表 |
| `node node_modules/vue-tsc/bin/vue-tsc.js -p tsconfig.app.json --noEmit --incremental false` | exit0 | 6.970s，覆盖实际 app/test 来源；根tsconfig仅references，不以空检查冒称类型覆盖 |
| `npm run build` | exit0 | 9.783s（vue-tsc -b + Vite），原大chunk提示保留 |
| `npm run check:modules` | exit0 | 1.569s；模块边界与测试归属 |
| `git diff --check` | exit0（清理后） | 0.028s；先前exit2的三处测试尾随空白已修 |

首轮相关文件按任务版本/descriptor/存读/录像引用与改动筛选 **105** 个；随后补入直接调用存档/录像接口的经典显示、确认与受控场景文件（额外36个，含D4；再加4个仓库/i18n守卫），按失败和新增关注逐轮复验。精确集合/argv在附录。`numTotalTestSuites` 含 describe 嵌套，不冒称文件数。按每个文件的**最新正常模式结果**去重，共 **145 文件、2264 用例：2261 pass、0 fail、3 既有 CE 可选 skip、0 todo**。不是一次145文件全通过的重跑，也不把多轮重复用例相加。三项原有 skip 来自 captive_manacles/u_26a_deep_levels/x3_u8c_combat_items 的实际 CE 源码比较，本地未取 CE，任务要求的独立规则断言照常运行。证据 `/private/tmp/phase5a1-final-coverage.json` 按文件标注最终来自哪轮。 未跑完整 npm test、全部 test:ext、removal、5Z、ce:fetch/test:full/test:gen。GenerationCoordinator 仅改所有权/跟随与补算/结算顺序，未改生成算法，按任务 §6 不追加 drift。构建仍有原有 >500kB chunk 提示，未改配置掩盖。

8 组新增 engine smoke：空、growth、narrative、combat、giants、四模块全开、fixture 单独、fixture+combat+giants；均真实 Game 新局/付费命令/save/load/replay/seek0及末尾/续录，使用发现式模块选择。另外实际运行既有 ext_module_composition 的全部测试，其中四模块 16 子集均覆盖开局/游玩/存读/录像/seek/续录；未运行独立组合矩阵脚本，也不将 engine 证明称为真实浏览器验收。

### 5.1 已修失败与旧前提

| 问题/归因 | 处理与保留的断言 |
| --- | --- |
| a 初次相关 86 文件有 6 失败，foundation5 和 v3 外壳前提 | 分别只回退常量/whole-run 外壳反事实通过，更新前提和原方法黄金；a 后续 12 文件 94 pass。初次依赖 ENOTFOUND 后复用本机已有 node_modules，不加依赖；早期类型前提/Object.hasOwn lib 问题修代码 |
| v3 event.extensions、重复历史、旧模态/录像 1 fixture | Only Game.ts 回退 HEAD 的 u27/x2/续录 28/28 通过；最小改用 v4 三域/full 的真实验证、origin.events、合法 v4 前缀；坏链拒绝与合法链语义 OOS 分开，不降低命令/state/随机断言 |
| 26 文件模块反事实 376 pass / 4 fail | 四处失败来自新 Coordinator 假定旧 Game 有 managedWorld 端口；端口改可选。四项实际组合/巨兽/narrative 回退反事实 4/4 通过，其他 79 为 -t 过滤 |
| U00 旧伪 version1 录像不再合法 | 原 Game+原 U00 17/17；前提换成真实生成的三 escape v4 录像。保留 whole graph、双流计数、旧对象 retire 一次断言；候选固定构造 seed、空 WeakMap 为真实生产修复 |
| growth 可选奖励/narrative 拒绝输入产生未记录知识日志 | presentationOnly 保留用户反馈而不污染持久知识；不改模块数值/奖励/保存资格。combat 缺模块坏文件测试改查 displayMessages，并加强 archive 不变/整个世界不变 |
| world-only 受控 state 修改携带旧合法 origin | 明确删去失效 origin 后作为 world-only 诊断场景；生产仍拒绝来源与末根不一致，没有自动容忍不连续来源 |
| 105 文件相关复验：1339 pass / 81 fail，1875.438s | 按失败逐项修正，不把该轮写成通过。修复真实生产的末事件暂存 full 导致保存频次影响链；恢复无 origin 不录制原路径；纯开局前缀预检；错误反馈不污染知识根；随后复验 37 文件 615 pass / 22 fail，剩余仅下列旧前提，实际终验见门禁表 |
| 受控场景在 startNewGame 返回后才装配，录像 seed 候选不同 | 测试用 installRecordingScene 在真实 makeRecordingHeader 之前装配同一场景，录制与 seed 候选均生效；不绕过 initialDigest 验证，不降低机械/RNG/身份断言。覆盖身体、parry/dodge、巨兽、growth、强制气体动画路径 |
| 旧前缀末 full 续录角色与旧错误反馈持久日志前提 | 只撤销 transient-tail 生产归一化时，原 narrative 前缀断言 1/1 pass（6.512s）；仅 Game.ts 回退并使用原 baseline 测试时，两种 advancement 例外与 combat 组合原守卫 3/3 pass。前缀只规范化临时 full/chain；错误反馈改查 displayMessages 并加强 archive/整个世界完全不变。无 origin 的旧会话历史持久化前提按单历史合同删除，保留例外前 raw 收集、导出失效与世界继续推进的断言 |
| 最后一轮追加直接受影响的 D4 闪现录像文件 | 16 文件 201 pass / 10 fail（665.02s），原有 15 文件和 UR2/UR3/UR4 全通过；新补 D4 仍用 v3、场景在 origin 后修改、语义篡改未重链。仅回退 Game.ts 并保留原 D4 测试反事实：8 pass，另2项只剩 whole-run 已升4却仍断言3（whole-run 单变量归因沿用5A1a证据）。随后用相同受控场景时点/版本/重链前提修正，保留风险回答、无 UI、逐条/playing/seek/续录与世界/RNG 原断言 |
| 补充经典文件的格式批次反事实 | Game/WholeRunSnapshot 回退 HEAD、foundation 回5，原有效断言不改：50 pass / 4 fail / 353过滤（33.68s），4项只剩下面 Runtime 自有字段污染；其他场景的 native/RNG/日志全部匹配。已恢复生产源码 |
| 普通 Runtime 也添加 needsWorld5=false 自有字段 | 独立原始图只移除这一个 false 标量，**104/104 原黄金图/快照 hash 完全匹配**；改生产为静态 WeakSet + getter，普通 Runtime 不再增加自有槽。再次旧格式反事实 4/4 pass（15.494s）；没有删改图守卫 |
| 补充轮 D4 seek 忙循环 | 测试 fixture 把候选 animationEnabled 从 false 强制设 true，导致同步 seek 无法推进；手动终止该轮 exit130，36文件输出完成，D4未完成，无最终JSON、未保留完整墙钟，不能计为通过。只改测试继承候选动画配置，随后D4原29项全部通过；未延长 timeout |
| 收尾45文件与中文初始根 | 908 pass / 1 fail / 3既有skip，448.173s；唯一失败是测试在新局初始摘要后才切中文，seed候选初始日志语言不同。当时将测试切语言置于新局之前后单文件4/4 pass（3.865s），该调整掩盖了摘要依赖文本的根因。审查 M1 后已撤回：英文新局/录制后才切中文，生产摘要改为稳定 ID 和无正文发出证据，原合法链语义OOS、中文反馈、工具诊断断言继续有效。类型预检亦抓到测试批量编辑多余的 rechain 变量，已删去；不改生产验证 |
| 最后同步/引用守卫的新反例与生产修复 | 安装7项新回归后只回退4个生产文件，6项定位运行实际 **1 pass /5 fail /27过滤**（见 transaction-before JSON/command）；checkpoint Promise 被误当 restore回调、publish Promise 被忽略、prepare失败遗留constructor/toString自有键、已sweep居民缺nextEntityId都复现。修复为先验证同步checkpoint再登记恢复函数，checkpoint/prepare/publish拒Promise并消化拒绝，回滚用hasOwnProperty清新增键；world5上下文统一传nextEntityId，当时活pending/carried/purgatory actor与Item/Player ID均被视为错误引用；此处 pending/其它层的真实 actor 判定已按维护者 H2 裁定修正为合法，Item/Player 身份保护保留，dead purgatory保持历史身份。之后7文件 **95/95 pass，105.350s**，其中offline33项；整局、时钟、录像三文件和原P4 full-graph全部保持正常模式通过。没有改有效旧断言或再重录黄金 |
| 最终空白检查 | 类型/构建/边界均通过，git diff --check 抓到 D4 三处尾随空白，已清理并单独复验通过；仅文本空白，没有改变测试语义 |
| 原生 diag/turn/terminal、growth 决定的语义篡改 | 对修改后的合法 V4 文件重算链，再测语义 OOS；坏链仍有独立拒绝断言，不把解析失败当作重放语义验证 |
| 新 fixture 本身布景错误 | 原生无 isLava 导出；实际楼梯自动迁层，路线应停在邻格；No 应走真实收费风险；坠落为零 elapsed；相位 timer owner 需在测试镜像。仅修新测试，没有改生成/旧守卫或延长既有 timeout |
| fixture 绝对 epoch3 可能早于真实离场 | 事件从 capturedTick 的完整 epoch +3 冻结，配置纳入指纹；真实跨层原命令回放/seek/续录通过 |
| 种子 seek 回退直接改变当前局 | 在候选完成验证后发布（growth 未创建例外见 §4）；坏快照回退保留完整 root 等价并提示 |

最后两项守卫修复后重新执行实际 app 类型检查（6.970s）、build（9.783s）、模块边界（1.569s）和空白检查（0.028s），均exit0。此前空白失败轮在 `phase5a1-final-gates-before-context.json`，没有覆盖其失败证据。

无新增 skip 或 todo。旧前提更新限于已归因的版本/字段/边界角色/场景时点与单历史/显示反馈要求，世界、守恒、RNG、身份与坏文件拒绝断言保留或加强；没有通过改守卫绕开生产回归。所有中途反事实均恢复生产文件后再验收。以下保留有意义的原始运行记录，失败轮不混入最终通过数字：

| 原始 JSON / 实际文件集合 | 文件 | pass/fail/过滤或skip/todo | 结果 | 秒（Vitest 起止窗） |
| --- | ---: | --- | --- | ---: |
| phase5a1-a-capture-results.json（集合见 iteration-evidence.json） | 4 | 5/0/0/0 | 通过 | 45.280 |
| phase5a1-a-final-focused-results.json（集合见 iteration-evidence.json） | 4 | 51/0/0/0 | 通过 | 14.126 |
| phase5a1-a-final-normal-results.json（集合见 iteration-evidence.json） | 12 | 94/0/0/0 | 通过 | 55.825 |
| phase5a1-a-related-results.json（集合见 iteration-evidence.json） | 86 | 1076/6/0/0 | 失败 | 808.698 |
| phase5a1-br-clock-modals-2.json（集合见 iteration-evidence.json） | 4 | 70/1/0/0 | 失败 | 97.564 |
| phase5a1-br-clock-modals.json（集合见 iteration-evidence.json） | 3 | 40/5/0/0 | 失败 | 73.055 |
| phase5a1-br-focused-4.json（集合见 iteration-evidence.json） | 11 | 103/2/0/0 | 失败 | 81.850 |
| phase5a1-br-initial-tests.json（集合见 iteration-evidence.json） | 4 | 42/3/0/0 | 失败 | 37.035 |
| phase5a1-br-new-tests-2.json（集合见 iteration-evidence.json） | 5 | 50/1/0/0 | 失败 | 38.821 |
| phase5a1-br-repairs-5.json（集合见 iteration-evidence.json） | 4 | 75/3/0/0 | 失败 | 45.693 |
| phase5a1-br-repairs-6.json（集合见 iteration-evidence.json） | 4 | 58/3/0/0 | 失败 | 48.005 |
| phase5a1-br-repairs-7.json（集合见 iteration-evidence.json） | 3 | 37/3/0/0 | 失败 | 32.738 |
| phase5a1-br-repairs-8.json（集合见 iteration-evidence.json） | 3 | 40/0/0/0 | 通过 | 44.601 |
| phase5a1-br-trace-capture.json（集合见 iteration-evidence.json） | 3 | 11/8/0/0 | 失败 | 51.419 |
| phase5a1-final-capture-clock.json（集合见 iteration-evidence.json） | 2 | 2/0/22/0 | 通过 | 5.831 |
| phase5a1-foundation5-counterfactual-results.json（集合见 iteration-evidence.json） | 3 | 4/0/9/0 | 通过 | 17.747 |
| phase5a1-r-counterfactual-Game.json（集合见 iteration-evidence.json） | 3 | 28/0/0/0 | 通过 | 18.905 |
| phase5a1-r-focused-3.json（集合见 iteration-evidence.json） | 9 | 58/4/0/0 | 失败 | 54.469 |
| phase5a1-r-module-counterfactual.json（集合见 iteration-evidence.json） | 26 | 376/4/0/0 | 失败 | 530.713 |
| phase5a1-r-module-focused-4.json（集合见 iteration-evidence.json） | 6 | 105/8/0/0 | 失败 | 152.811 |
| phase5a1-r-ports-counterfactual.json（集合见 iteration-evidence.json） | 4 | 4/0/79/0 | 通过 | 5.600 |
| phase5a1-u00-counterfactual.json（集合见 iteration-evidence.json） | 1 | 17/0/0/0 | 通过 | 17.032 |
| phase5a1-ur3-history-attribution.json（集合见 iteration-evidence.json） | 1 | 1/0/0/0 | 通过 | 45.848 |
| phase5a1-whole3-counterfactual-results.json（集合见 iteration-evidence.json） | 2 | 2/0/0/0 | 通过 | 44.032 |
| phase5a1-world-command-debug-2.json（集合见 iteration-evidence.json） | 1 | 0/2/22/0 | 失败 | 23.094 |
| phase5a1-world-command-debug.json（集合见 iteration-evidence.json） | 1 | 0/2/22/0 | 失败 | 9.397 |

以上逐轮精确文件集合/失败名见 `/private/tmp/phase5a1-iteration-evidence.json`。反事实及 debug 的 pending 为 `-t` 过滤（9/79/22），不算新增产品 skip。对应日志与 JSON 使用相同 phase5a1 前缀。失败轮实际输出保留，未给未保存的子进程退出码或墙钟补造数值。早期 a 的真实 argv/退出码/墙钟另在 `*-command.json`，最终相关轮也单独记录。

最终相关正常轮使用进程实际墙钟（含启动；以 `*-command.json` 为准），与上表 Vitest 起止窗区分：

| 原始结果JSON | 文件 | pass/fail/既有skip/todo | exit | 进程秒 |
| --- | ---: | --- | ---: | ---: |
| phase5a1-final-related.json | 105 | 1339/81/0/0 | 1 | 1875.438 |
| phase5a1-final-repaired.json | 37 | 615/22/0/0 | 1 | 698.257 |
| phase5a1-final-last.json | 16 | 201/10/0/0 | 1 | 665.278 |
| phase5a1-final-closing.json | 45 | 908/1/3/0 | 1 | 448.173 |
| phase5a1-final-correction.json | 1 | 4/0/0/0 | 0 | 3.865 |
| phase5a1-final-transaction-final.json | 7 | 95/0/0/0 | 0 | 105.350 |

补充 interrupted 轮 exit130，完整日志 `phase5a1-final-additional.log`，摘要 `phase5a1-additional-interrupted-summary.json`；没有最终JSON或可确认整轮墙钟，不填造。反事实进一步包括 `phase5a1-additional-format-counterfactual.json`（50/4/353过滤）、`phase5a1-p4-format-counterfactual-fixed.json`（4/0）、`phase5a1-p4-capture.json`（4/0），实际argv/exit/秒另在同前缀 `-command.json`。`phase5a1-last-guard-counterfactual.json` 曾对修改后的前提回退仅Game，3 fail；随后对原baseline测试做同一回退的 `phase5a1-original-guard-counterfactual.json` 3 pass /24过滤，原断言证明见5.1，失败尝试未被抹去。

### 5.2 黄金逐字段登记

原 fixture 仓库外保存 `/private/tmp/phase5a1-old-*`，a 批次逐叶旧/新表 `/private/tmp/phase5a1-golden-field-differences.json`。捕获仍用原测试 UR3_CAPTURE/UR4_CAPTURE/BROGUE_CAPTURE_GIANTS_TRACE，先反事实归因，再无捕获模式比较；没有整体放行版本差异。

| 文件 | 逐字段变化与证据 |
| --- | --- |
| UR2 | 无变化，最终正常模式运行 |
| UR3 a | 4 seed ×（26 depth hash + revisit/returnTo26/loaded + fall）=120 处，完整快照 schema/version 外壳 3→4；只回退这两个字段旧 trace 通过；其他世界/观察/RNG不变 |
| UR3 R | run.recordedInputEvents/Index 从 world-only 投影移除，120 hash 重算；仅临时加回这两个原字段、原 JSON 顺序，**所有 a hash 原样通过**，证据 `/private/tmp/phase5a1-ur3-history-attribution.json`；测试恢复后原 capture 重录 |
| UR4 a | 30 个 state 的 schema/version 共60叶，只有外壳变化 |
| UR4 R | 669叶，仅录像字段或 state.run 的第二份历史：Events/Index 各30处删除；新增 levelRef/simulationTicks/hp/terminal/checkpoint/fullCheckpoint/inventoryStamp/chainDigest 各63；旧depth删除63；旧end删除2；未完成动画事件 tick/x/y 各11、turn7 改为暂存占位0。证据 `/private/tmp/phase5a1-r4-recording-field-differences.json` |
| UR4 R 最终规范排序 | 仅52个 `.recording[*].chainDigest`，没有 native/RNG/日志/观察变化；`/private/tmp/phase5a1-r4-final-sort-differences.json` |
| phase4a0-single-cell | 按原 `P4A0_CAPTURE=1` 捕获4组×13状态，204个叶差异=102 sha256 +102 objects，**RNG/日志叶0变化**。先完成上述旧格式/false字段反事实，再重录；正常模式4/4通过（收尾36.226s），原 full-graph 测试代码与断言未改。详细独立归因如下 |
| giants natural/colossus/spine | 各只变 extensionsHash，foundation5→6；其他 nativeWorld/RNG/模块 state/boss 全未变 |

4a0 原始图归因不是新增弱投影守卫：仓库外独立读取完整原图/快照，移除录像格式/history字段，foundation5/6归一；另外逐项登记 v4 候选 publication 经原 save/load DTO 产生的差异。两处空 trap-depression 衍生缓存不再创建/读档重建；`lastPromotionUpdate` 按 U03 reset 清空；WaypointSystem 的私有 `scanner` 是 `setState()` 明确清空的 scratch，coordinates/count/refreshTicker/distanceMaps/coverage 保持；闲置 seek 的 `disturbed` 按既有 U03 闲置 false 契约归一；testRooms 的 JSON DTO 丢去 undefined 自有键。代表 seek 原图精确273差异=270个 undefined键删除（Item各可选字段及 room.blueprintId，无值变化）、1个闲置 disturbed true→false、2个 reset/scratch对象→null，没有 alias/descriptor/类别额外变化。对这些明确路径作外部归因后 **104/104 完整图/快照都相等，包括全部52个持久 world-only快照**；其他 descriptors/类名/循环/别名/Map/Set/typed bytes 保留比较。证据 `/private/tmp/phase5a1-p4-field-attribution.json`（204个旧→新叶完整表）、`phase5a1-p4-seek-raw-differences.json`、`phase5a1-p4-false-flag-attribution.json`，原始大图在 `/private/tmp/phase5a1-p4-graph-{baseline-fixed,new}`，均留仓库外。仓库实际 guard 仍比较未归一的真实 full graph 与原方法重录的黄金。

UR4 原观察回调曾在命令推进中 export；v4 安全点守卫禁止这一行为。观察改为复制会话录制数组，因此未完成事件显示暂存的零诊断，完成时才填实际值并形成 chain；**安全导出没有这些占位事件**。30个 state 的 native/tick/双 RNG/日志等逐字段不变。新增 hash/删除旧 end 是格式变化，终局 terminal 的实际内容保留，不能把暂存行当可导入录像。

三个巨兽旧→新 hash：

```text
natural  d6add3168e56d8e06c54114057dbbc84a6ac82b7d793310403cce472e9c3106e
      -> 9dfc37efea718c3e8c53ff371d4aa60184352bcc2b7d66b78350744e063df6fb
colossus 1f13bb1522f8d419f449a20e4ad045ea86632d0883ae0bbee9ecd95b5ee07bae
      -> 534aea914dd904ec011f5ba6a3eb8d0b29c15ca4c5be235a326b5b00c85ee962
spine    fc59ea17b3a145f597d00d6b0c1d3ffef0cff19a8c92e99872f69d637e4eae45
      -> 3524312501d49f65201435acabe7942d38bd7802a8cc650dac71c187d5cf7c04
```

## 6 审查修复前体积与延迟（历史证据）

复用仓库外的原5A0原生构造方法，固定seed 51005000、wizard，每个样本实际执行2049条 `escape`。这是零时间命令，不模拟劳动；双RNG在三个扩展代理命令期间保持不变。经典与0营地可真实seed replay；1/8营地的未来DTO仅存私有JSON模块状态，合成跳层，**不是world5未来根、SDK、自然可玩建设或来源合法性验收**。8营地仅对象计数预算内：8层、64真实ally Monster、3072格/12288部件、128箱×63模拟stack=8064，加67个native Item=8131≤8192，256节点/256订单/64ticket。1营地为16居民/384格/16箱×64/32订单；0营地为空私有模块、1原生层，区别于四模块全开。

运行环境：Apple M5，10逻辑CPU，32.0GiB RAM，darwin-arm64，Node v24.19.0，3072MiB old-space。同机另一工作树可能产生负载，本任务测量不与自己的Vitest/构建并跑。

完整测量 `/private/tmp/phase5a1-size-results.json`，exit0、1246.746s；最终control重测exit0、39.222s。真实argv/exit/秒 `phase5a1-size-command.json`；前后977份src/scripts/public/config文件hash相同 `8d8d562b7163b48a79d585b40b83df5ddab9d22b971e4fa9af250c222dbe1b83`。之后只修§5末次发现的world5提交/引用守卫及新测试；大代理均无world5能力，不进入这两个路径，其规模/编码/录制/摘要路径未改。本次诊断裁定修订前的交付源码重新测经典和0营地，`phase5a1-size-final-controls.json`/`-command.json`，前后hash相同 `d618042188b9f31d7fe54e7a6da6193d2c6337cc81d3b6734533cfcc979816a5`；以下这两组使用该次重测结果；当次诊断裁定修订只改 OOS 诊断，未重跑性能探针，大代理保留完整轮真实数据，没有把旧量测假称最终源码全样本重跑。

门槛按**成对current−v3差值**的分位数测量。v3是HEAD的真实Game.ts，在独立Vite SSR实例中仅内存替换，周边模块/whole-run为当前代码；它是匹配的录像器反事实，**不是完整历史checkout**。两个版本同seed、同零时间命令交错执行。首32样本排除，每256边界单列，普通/新增各n=2009。保存/导出1预热+5样本；可信seek经典/0为1预热+5样本，代理为1预热+3；外部首次seek仅1次，不能把它称为稳定P95。全部CPU成本，未含磁盘IDB/浏览器/UI/压缩。

| 最终新增成本门禁 | median/P95 ms | 批准门槛 | 结果 |
| --- | ---: | ---: | --- |
| classic | 0.049/0.052 | ≤1ms | 通过 |
| extended-zero-camp | 0.116/0.123 | ≤5ms | 通过 |

两项均达标，**不触发回退**：256完整摘要/2048快照/末事件full与三事件域全量重算保持原检测粒度。

| 样本 | 普通命令median/P95 ms | chunk命令median/P95 ms | n |
| --- | ---: | ---: | --- |
| 经典 | 0.050/0.055 | 131.553/317.180 | 2009普通/8边界 |
| 0营地扩展 | 0.126/0.139 | 131.281/315.801 | 2009普通/8边界 |
| 1营地代理 | 60.907/62.909 | 264.178/509.475 | 2009普通/8边界 |
| 8营地代理 | 479.356/494.411 | 2037.269/4019.706 | 2009普通/8边界 |

chunk为完整边界命令总耗时，2048边界还含world-only快照捕获，未冒称纯hash成本。大状态代理全量重算三域的事件成本明显高于5A0；达标只针对批准的经典/0营地门槛，不意味着最大状态已满足交互延迟要求。没有据此缩小摘要覆盖。

实际紧凑UTF-8 JSON字节（B，非压缩；64时0缓存，2048/2049时1份缓存）：

| 样本 | 命令 | 录像B | 不带快照录像B | 存档B | 快照缓存B |
| --- | ---: | ---: | ---: | ---: | ---: |
| 经典 | 64 | 41,472 | 41,472 | 1,963,276 | 2 |
| 经典 | 2048 | 3,212,879 | 1,290,316 | 3,212,120 | 1,922,565 |
| 经典 | 2049 | 3,214,059 | 1,291,496 | 3,213,300 | 1,922,565 |
| 0营地扩展 | 64 | 62,088 | 62,088 | 1,984,245 | 2 |
| 0营地扩展 | 2048 | 3,870,712 | 1,947,796 | 3,869,953 | 1,922,918 |
| 0营地扩展 | 2049 | 3,872,213 | 1,949,297 | 3,871,454 | 1,922,918 |
| 1营地代理 | 64 | 61,896 | 61,896 | 2,792,584 | 2 |
| 1营地代理 | 2048 | 4,673,099 | 1,941,652 | 4,672,340 | 2,731,449 |
| 1营地代理 | 2049 | 4,674,597 | 1,943,150 | 4,673,838 | 2,731,449 |
| 8营地代理 | 64 | 62,280 | 62,280 | 21,126,592 | 2 |
| 8营地代理 | 2048 | 23,019,011 | 1,953,940 | 23,018,252 | 21,065,073 |
| 8营地代理 | 2049 | 23,020,515 | 1,955,444 | 23,019,756 | 21,065,073 |

经典不带缓存尺寸由已测紧凑snapshot数组大小扣除（保留空数组2B）计算，其余三组实际调用 includeSnapshots:false。seed/事件/链从未截断，snapshot只保存world/inputState，不嵌origin/history。

| 样本 | 命令 | 导出median/P95 ms | 保存median/P95 ms |
| --- | ---: | ---: | ---: |
| 经典 | 64 | 0.135/0.139 | 136.559/137.122 |
| 经典 | 2048 | 8.192/8.691 | 299.090/304.787 |
| 经典 | 2049 | 8.149/8.214 | 288.450/289.040 |
| 0营地扩展 | 64 | 0.156/0.161 | 137.632/138.089 |
| 0营地扩展 | 2048 | 9.010/9.107 | 353.548/353.795 |
| 0营地扩展 | 2049 | 9.204/9.385 | 353.321/356.263 |
| 1营地代理 | 64 | 0.157/0.160 | 202.288/202.647 |
| 1营地代理 | 2048 | 12.301/12.415 | 421.803/422.401 |
| 1营地代理 | 2049 | 12.315/12.423 | 422.931/423.220 |
| 8营地代理 | 64 | 0.160/0.164 | 1538.246/1562.693 |
| 8营地代理 | 2048 | 63.587/64.188 | 1789.564/1801.089 |
| 8营地代理 | 2049 | 63.797/64.668 | 1808.157/1830.156 |

| seek2049 | 外部首次seed验证ms（n=1） | 已验证缓存median/P95 ms | 证据性质 |
| --- | ---: | ---: | --- |
| 经典 | 2513.465 | 933.230/953.747 | 真实seed可重放，n=5 |
| 0营地扩展 | 2624.210 | 984.112/990.938 | 真实seed可重放，n=5 |
| 1营地代理 | 未测不可达seed代理 | 1291.339/1293.453 | 仅本地已信任合成快照，n=3；不证明seed可达 |
| 8营地代理 | 未测不可达seed代理 | 6559.991/6836.582 | 仅本地已信任合成快照，n=3；不证明seed可达 |

与5A0 §2.4/§2.5原64命令数字并列（旧版2048/2049未实测，§2.6外推不能当历史真实基线）：

| 样本 | 旧→新64录像B | 旧→新64存档B | 旧普通命令median/P95 ms | 旧→新64导出median/P95 ms | 旧→新64保存median/P95 ms |
| --- | ---: | ---: | ---: | --- | --- |
| 0营地扩展 | 63,028→62,088 | 1,986,026→1,984,245 | 0.02/0.06 | 0.44/0.47→0.156/0.161 | 5.04/6.23→137.632/138.089 |
| 1营地代理 | 49,697,588→61,896 | 52,428,879→2,792,584 | 3.57/4.16 | 250.50/252.90→0.157/0.160 | 286.07/286.44→202.288/202.647 |
| 8营地代理 | 386,510,068→62,280 | 407,574,983→21,126,592 | 23.17/28.14 | 1824.59/1852.90→0.160/0.164 | 2619.68/2621.98→1538.246/1562.693 |

0营地私有state用空对象（本轮checkpoint339B，5A0为577B），1/8代理的extension checkpoint分别776,120/6,038,809B，与5A0相同。world外壳/单历史与诊断略有差异；旧64普通命令仅64样本，新P95采用2009普通样本，且前后负载不同，不能以二者分位数相减冒称新增P95（门槛用上面的同轮配对测量）。旧完整canonical+SHA的8营地190.10/201.72ms是旧单字符串方法，也不能替代当前六域完整投影边界。新版确实解决逐事件重复大payload的体积膨胀；完整摘要、安全保存与大状态逐事件三域重算仍有明显CPU成本。

## 7 未验证与 5A2 交接

- **未验证**：真实浏览器 IDB v2 升级/blocked/磁盘故障、录像入口/seek/警告的实际画面；生产适配器已用最小内存 IDB 事件桩验证升级/事务/异步请求/abort/配额，仍不等于真实浏览器验收。
- **未验证**：41层最大世界、自然建设/1万命令长局、最大预算下真实 CPU/内存/磁盘延迟。体积代理的未来 DTO 不证明资源合法来源、建筑可达或 C5 工作运行；新世界 fixture 不是 settlement/crafting 内容。
- **未执行**：完整 npm test、全部 test:ext、独立组合矩阵脚本、removal、5Z，以及未来5A2/5A3功能门禁；按开发期政策留给对应阶段。既有组合测试的四模块 16 子集确已运行，不能与未运行的独立脚本混淆。
- **已裁定关闭**：§3 的 hidden native/knowledge 诊断精度采用维护者 2026-10-06 选项 1，合同、任务书、实现、错误信息与测试已同步。**5A2 硬前置待维护者验收并合入 commit 后关闭**；当前没有合入 commit，也未按本报告开启 5A2。
- 5A2 新建 descriptor 使用 `FOUNDATION_PROTOCOL`，后续如格式变化按统一计划分配 foundation7，不在本批次另升号。actorActions 当前 `merkleDomain('actorActions',{root:null})` 空域为 `9f1c9dc4d52ec4c60fe72bcc1de71b66536be51dcd27556f1fa4142b0ddf0306`，未来动作根必须替换该域而非塞回 extensions。world5 未来八根仍不开放；按合同继续声明式 worldDefinitions/worldWorkCommands/worldSdk:1。

## 8 审查发现处理（2026-10-06）

依据 [独立审查发现](phase5a1.review-findings.md) 与维护者逐项裁定复核。H1/H2/H3/M1 的原反例已在当前工作树安装回归并复现失败；M2 先纠正超出单计划 128 事件预算的测试布景，再以合法的 128+2 两次计划复现第 129 条提交失败。修复前日志为 `phase5a1-review-before.json/.log`、`phase5a1-review-M2-before.json/.log`，均在 `/private/tmp/`。过滤运行中的 pending 只是 `-t` 未选中用例，不作为产品 skip 或正常验收。

### 8.1 逐项结果

| 发现 | 结果 | 修复与回归 |
| --- | --- | --- |
| H1 | 已关闭 | `current` 用户录像与 `save-origin` 存档镜像各自 manifest/chunk/cache 命名空间；保存/删除存档仅操作镜像。真实 2049 条录像带 2048 缓存，seek10 后存档、seed999 另一局存档，原录像与缓存逐字段不变；世界及来源镜像仍同事务 |
| H2 | 已关闭 | 经济 home 与 native 物理承载分开，pending/其它层的真实 actor 合法；原生坠落停止旧订单并记不可达路线，死亡复活保留退休经济登记、不开旧工作。toSnapshot/loadSnapshot 共用 world5SnapshotContext/validateWorld5 与规则指纹。真实 CHASM→monstersFall→pending 往返、死亡→原生 sweep/purgatory→另层 resurrectAlly 往返、生产写出/读入拒绝同一坏引用；Item/Player 身份守卫保留 |
| H3 | 已关闭 | 单体与九成员整体身体坠入已缓存管理层均进入 pending 根，不提前写缓存；结算之后恢复并落位，排除 preplaced 新到者于 frozenActors。真实 monstersFall 两路径，含 pending 阶段存读、清 pending、可通行落位/完整群体与再次存读 |
| M1 | 已关闭 | native 显示名替换为 kind/type/entity ID，派生描述/尸体名剔除；随机外观保存稳定池 ID，程序化卷轴保存词素索引序列，不新增 RNG 抽取。日志正文、显示折叠/重复次数/id 不入摘要，独立滚动 1360 条发出证据（turn/color/acknowledge/foldable+单调高水位）入 knowledge；原渲染 archive 保留。sign/发现/终局正文剔除而保留地点、队列、颜色、存在性等机械知识；玩家绰号/铭文保留。经典与四模块全开六域初始等价、英文录制/中文回放/中途切语言、译文改动、重复折叠及坏证据/ID 拒绝；inventoryStamp 无 kind 时使用 entity ID。已撤回 x2i 的时机规避，恢复英文录制之后才切中文 |
| M2 | 已关闭 | commit 依据 ledger.lastEventOrdinal 高水位追加新收据，滚动淘汰最旧至 128 条。128+2 次合法事件提交成功，ordinal=130，旧收据淘汰后重复/旧 ordinal 不再产生收据或效果 |
| M3 | 已关闭 | readSaveSummary 返回 compatible=false 的旧存档信息，菜单显示原因并禁用继续；保存前默认 No 的确认，No/cancel 均不写，Yes 才替换，run epoch 与 busy 防止过期/重复保存。旧 localStorage JSON 可用原下载路径导出，永久关闭提示只写 dismissed 标记，旧 JSON 与恢复入口仍保留；真实挂载菜单、DialogService 三种回答、重启后原 JSON 保留覆盖 |
| L1 | 已关闭 | world5 有无不符与规则指纹失败均走 refuse，给出 i18n 简洁原因；回调通知且当前 player 身份保留 |
| L2 | 已关闭 | 可选 snapshot 配额不足时整个事务 abort，丢弃加速缓存后重试事件/manifest；向 UI 返回降级提示。生产适配器下异步请求 QuotaExceededError 覆盖，事件仍一致，存档镜像不动；事件本身配额不足保持原用户录像 |
| L3 | 维护者接受 | 经典局普通事件 inventoryStamp/chainDigest 两次 SHA-256 获准保留，以新增 P95 ≤1 ms 验收；0 营地扩展仍 ≤5 ms。无逐事件 native/knowledge 完整摘要，未改变 OOS 检测节奏 |
| L4 | 已关闭 | registerWorld5Fixture 在非 DEV 环境抛错且不登记；生产 build 树摇去掉注册函数，测试/DEV 入口保留。非 DEV 实际模块登记拒绝回归及构建产物检查 |
| L5 | 已关闭 | seed 回退完成/异常均保留此前信任的快照集合，2048→0→2048 不再做 seed 验证；候选异常转为 i18n UI 警告，恢复动画/omniscient 设置，当前图/世界保持。坏缓存仍单独回退，不把错误候选列为可信 |
| L6 | 已关闭 | node_modules 无 fake-indexeddb，新增最小异步 IDB 事件/事务桩，无依赖变化。升级断言读取生产 opener 实际连接的 checkpoint；生产 saveDatabaseTransaction 覆盖 async get、同步/异步参与者异常、request 失败、配额 abort、原记录保留、自动完成后迟到拒绝被消费与连接关闭。H2/H3/M2 的真实路径与滚动测试补齐；真实浏览器仍列未验证 |

自行决定：不增加 displaced DTO/独立实体 codec 槽；home 登记保留、离层停工，复活不隐式恢复旧经济工作。日志采用无正文发出证据而非改造全部消息调用为 key+params，以避免文本折叠影响摘要并保留发出次数。稳定风味 ID 与日志证据作为尚未合入的同一 whole-run v4 格式批次字段，未再升号；实体行/图字段不变，**实体 envelope 无独立槽、未单独升号**。存档镜像是事务镜像，Game 内唯一权威历史仍为 origin.events，用户录像为独立文件记录。合同 §10.2 与任务书已写入维护者 2026-10-06 裁定。

### 8.2 黄金与旧前提归因

只回退审查 M1 的四个生产文件（RecordingDigest、WholeRunSnapshot、ItemLoader、Logger）时，原方法捕获的 UR3/UR4/P4a0 与审查前黄金**逐字段相同**，证据 `phase5a1-review-golden-counterfactual.json`。Logger 的审查前版本只去掉发出证据改动，保留此前 presentationOnly 修复。原方法可选把完整原始投影写到仓库外的 capture directory；普通模式仍执行原黄金守卫，没有改比较算法、白名单或断言。UR2 另以相同四文件单变量回退通过原正常断言（`phase5a1-review-ur2-counterfactual.json`，1 pass）；恢复生产修复后使用原 `UR2_CAPTURE` 捕获方法，并只增加仓库外输出目录选项。恢复全部生产修复后，原始 JSON 与完整图对照如下：

| 对照 | 逐字段差异 | 机械结果 |
| --- | --- | --- |
| UR2 22 条轨迹投影 | 仅 22 个 log.mechanical 新增字段（`phase5a1-review-ur2-fields.json`） | 既有 Item/输入/时钟/RNG/渲染消息字段全部相同 |
| UR3 120 原始完整投影（四种子 D1…D26、往返/存读/坠落） | 仅 snapshot.flavors.identities、snapshot.run.logger.mechanical 与独立 log.mechanical；120 个 compact hash 更新 | 全部地图/实体/观察/allocator/两条 RNG/渲染日志/时钟相同 |
| UR4 完整 objective/final 投影 | 同上新增字段，以及 52 个 recording.chainDigest | 全部原生状态、输入、事件、tick/turn/RNG/原渲染消息相同 |
| P4a0 104 完整图/快照（52+52） | 156 处日志字段、52 处风味 identities、132 个 initialDigest、252 个 fullCheckpoint、242 个 chainDigest、36 个 prefixDigest；摘要域仅 native/knowledge/root 改变 | 没有额外 alias/class/ref-value/descriptor、规则数值、坐标、时钟、RNG 或既有字段变化；compact 104 hash/objects 与 52 个消息证据字段相应更新 |

原始投影在 `/private/tmp/phase5a1-review-capture/{before,after}/`，逐字段表 `phase5a1-review-field-attribution.json`，汇总 `phase5a1-review-field-summary.json`（unexpected=0）。UR2/UR3/UR4/P4a0 已用原测试内捕获方法重录，正常无 capture 模式验收；其它 giants 自然 trace 未据此重录。固定 merkle/chain 向量没有改变。

两条旧居民负例在仅回退 world5.ts 后通过（`phase5a1-review-resident-counterfactual.json` 2 pass，34 项仅过滤），按维护者 H2 直接裁定改为合法 native 承载/退休经济登记，并保留独立 Item/Player/越界坏 ID 保护。两条 DialogHost cancel 旧断言预期每次取消会改变存档 run 中的 raw history/index；只回退本格式批次 Game/WholeRunSnapshot 后原断言 2 pass（`phase5a1-review-dialog-host-counterfactual.json`），当前生产只有这两条旧路径消失、其它世界完全不变。改为要求整个世界零差异，同时继续检查真实 session event/index 恰好追加一次、取消语义/物品/时间/RNG 不变。

首个相关大轮与一次扩展轮人工中断（exit130、无最终 JSON），不算通过；确认命令“停滞”的定位单例 Q1 false 正常通过（4.660s），没有复现死循环，不为猜测修改生产或放宽 timeout。过滤定位、失败轮、capture 与 counterfactual 不混入最终正常测试统计。44 文件正常轮先出现 615 pass / 2 fail（617 项、exit1、990.846s）：一项 UR2 黄金只缺上述日志证据字段，按单变量归因后原方法重录；一项 i18n 守卫发现停用的 replay.legacy_ignored 仍在活跃词表，移动至 legacy 词表，保留原译文及资源格式。两项均未改守卫或断言。M2 还补强了淘汰后的 ordinal=1 在未来 epoch=131 重新被广告的反例，确保按高水位去重而非仅因旧 epoch 不在区间。早期类型检查发现新测试 it.each 行解包、readonly tuple、optional flavors、Array.at 与缺失 fixture validateState 的问题，均修正测试布景/类型，未放宽 TS 配置或生产校验。

### 8.3 审查修复后的门禁与 P95

Node v24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`，Vitest 全部 `--maxWorkers=2`，本任务不并行跑两个 Vitest。门禁按开发期政策，仅相关功能与指定 boundary/types/build；完整/CE/5Z/独立删除矩阵未执行。审查前 §5/§6 保持历史证据，不能替代本节结果。

| 最终验收 | 结果 | 本轮证据（`/private/tmp/`） |
| --- | --- | --- |
| 相关 Vitest | **44 文件、617 pass、0 fail、0 skip、0 todo** | 44 文件正常轮 615 pass/2 fail、990.846s；修正后 UR2/i18n/offline 三文件完整复验 65/65 pass、exit0、50.217s。按每个文件最新完整正常结果去重，`phase5a1-review-coverage.json`；不把重复、capture、反事实或过滤用例相加 |
| boundary：`npm run check:modules` | exit0 | 1.525s，`phase5a1-review-boundary.log` |
| `node node_modules/vue-tsc/bin/vue-tsc.js -p tsconfig.app.json --noEmit --incremental false` | exit0 | 6.989s，`phase5a1-review-vue-tsc.log`；实际 app/test 来源，非根 references 空检查 |
| `npm run build` | exit0 | 9.717s，`phase5a1-review-build.log`，保留既有 >500kB chunk 提示 |
| 生产 fixture 注册不可调用 | 21 个 JS 产物无注册函数/拒绝字符串；非 DEV 注册拒绝回归通过 | `phase5a1-review-fixture-bundle.json`；命令解码中的 fixture 字符串仍用于拒绝，不代表开放生产能力 |
| `git diff --check` | exit0 | `phase5a1-review-whitespace.log`；报告填写后的最终检查见 `phase5a1-review-final-hygiene.json` |

主轮精确 argv/Node/内存/exit/墙钟为 `phase5a1-review-final-command.json`，补验为 `phase5a1-review-repairs-final-command.json`，最终门禁为 `phase5a1-review-gates.json`。原始 `phase5a1-review-final.json` 的两项失败保留，不覆盖或改写成通过；latest-file 去重依据补验的三个完整文件结果。没有再运行 145 文件旧交付集合。

本次 44 文件精确输入（主轮 argv 顺序，补验为 UR2/i18n/offline）：

```text
src/engine/Items/itemFlavors.test.ts
src/ext/modules/giants/tests/giants_composite_natural.test.ts
src/ext/modules/giants/tests/giants_spine_trace.test.ts
src/ext/modules/giants/tests/giants_trace.test.ts
src/test/b_1b_identification_persistence.test.ts
src/test/c_5_fall_subsystem.test.ts
src/test/dialog_continuations.test.ts
src/test/dialog_host.test.ts
src/test/dialog_service_input.test.ts
src/test/ext_compatibility_diagnostics.test.ts
src/test/ext_foundation.test.ts
src/test/ext_foundation_contracts.test.ts
src/test/ext_generation_checkpoint.test.ts
src/test/ext_generation_checkpoint_differential.test.ts
src/test/ext_generation_transactions.test.ts
src/test/ext_recording_v4_digest.test.ts
src/test/ext_recording_v4_snapshots.test.ts
src/test/ext_recording_v4_storage.test.ts
src/test/ext_world5_clock_levels.test.ts
src/test/ext_world5_offline.test.ts
src/test/main_menu_replay_seek.test.ts
src/test/p1_30_i18n_gate.test.ts
src/test/perf_2_replay_cadence.test.ts
src/test/phase4a0_spatial.test.ts
src/test/phase4a0_spatial_differential.test.ts
src/test/phase4e_recording.test.ts
src/test/repo_hygiene.test.ts
src/test/sfc_harness.test.ts
src/test/test_suite_membership.test.ts
src/test/u24_hardcoded_text.test.ts
src/test/u_00_new_run.test.ts
src/test/u_01_instance_snapshot.test.ts
src/test/u_03_whole_run_snapshot.test.ts
src/test/u_03b_level_travel.test.ts
src/test/u_27_recording.test.ts
src/test/u_r2_trace.test.ts
src/test/u_r3_trace.test.ts
src/test/u_r4_trace.test.ts
src/test/ux_1d_recording_continuation.test.ts
src/test/x2a_recording_checkpoint.test.ts
src/test/x2i_discovery_text.test.ts
src/test/x3_u6_messages.test.ts
src/test/x3b_display_recording.test.ts
src/test/x4b_flavor_text.test.ts
```

审查修复后实际重测：`node /private/tmp/phase5a1-review-run-size.mjs` 调用 `phase5a1-review-size.mjs`，exit0、212.420s；结果 `phase5a1-review-size.json`，精确 argv/环境/墙钟 `phase5a1-review-size-command.json`。Apple M5、10 逻辑 CPU、32.0GiB RAM、darwin-arm64。本任务没有与自己的 Vitest/构建并跑；其它工作树可能产生系统负载。前后 980 份 src/scripts/public/config 的 hash 完全相同：`1c426b33208d31f0cd275877d7432e760372b161e391a0400b22152321d9d762`；测量过程中只有报告/合同等文档填写。

经典与 0 营地扩展各实际执行 2049 条零时间 `escape`，不代表耗时劳动或自然长局。用 HEAD 的真实 v3 Game.ts 经独立 Vite SSR 内存替换，周边模块为本轮当前代码；两版同 seed 交错，首 32 条预热排除，每 256 条完整边界单列。新增成本取 **2009 对 current−v3 命令差值的分位数**，不是两个 P95 相减。经典 inventoryStamp/chainDigest **两次 SHA-256/事件按维护者裁定接受**。六域覆盖、256 检测节奏与 2048 快照未因性能缩减。

| 新增成本门禁 | n | median/P95 ms | 批准门槛 | 结果 |
| --- | ---: | ---: | ---: | --- |
| 经典 | 2009 | 0.050/0.053 | ≤1 ms | 通过 |
| 0 营地扩展 | 2009 | 0.116/0.122 | ≤5 ms | 通过 |

1/8 营地沿用原 5A0 私有 DTO 体积代理构造方法，本轮各执行 **257 条**（224 普通样本、1 个 256 边界）；此前 §6 的 2049 条完整代理测量保留为历史，不冒称全部重跑。未来数据只在私有模块 JSON，world5 未来根仍关闭；不证明建设玩法、SDK、自然长局或来源可达。8 营地保持 8 层/64 真实 ally、3072 格/12288 部件、128 箱×63 模拟 stack、256 节点/订单、64 ticket；原生 Item 与模拟 stack 合计仍 ≤8192。双 RNG 在三组扩展命令期间不变。

| 当前样本 | 普通 n / median/P95 ms | 边界 n / median/P95 ms |
| --- | ---: | ---: |
| 经典 | 2009 / 0.052/0.056 | 8 / 134.817/323.716 |
| 0 营地扩展 | 2009 / 0.127/0.138 | 8 / 132.140/319.965 |
| 1 营地代理 | 224 / 61.642/62.301 | 1 / 260.020/260.020 |
| 8 营地代理 | 224 / 479.933/493.779 | 1 / 2023.668/2023.668 |

边界是整条命令耗时，2048 边界还含快照捕获；代理仅一条边界，是单次观测，不能视为稳定 P95。最大状态逐事件三域全量重算仍有明显 CPU 成本；门槛通过只针对经典/0 营地。没有缩小摘要覆盖或检测节奏。

实际紧凑 UTF-8 JSON 字节（未压缩；经典无缓存列由录制字节减实际 snapshot 数组字节加空数组 2B 计算，其它样本实际调用 includeSnapshots:false）：

| 当前样本 | 命令 | 录像 B | 不带快照 B | 存档 B | 缓存 B |
| --- | ---: | ---: | ---: | ---: | ---: |
| 经典 | 64 | 41,472 | 41,472 | 1,966,142 | 2 |
| 经典 | 2048 | 3,215,745 | 1,290,316 | 3,214,986 | 1,925,431 |
| 经典 | 2049 | 3,216,925 | 1,291,496 | 3,216,166 | 1,925,431 |
| 0 营地扩展 | 64 | 62,088 | 62,088 | 1,987,111 | 2 |
| 0 营地扩展 | 2048 | 3,873,578 | 1,947,796 | 3,872,819 | 1,925,784 |
| 0 营地扩展 | 2049 | 3,875,079 | 1,949,297 | 3,874,320 | 1,925,784 |
| 1 营地代理 | 64 | 61,896 | 61,896 | 2,795,450 | 2 |
| 1 营地代理 | 257 | 244,797 | 244,797 | 2,978,351 | 2 |
| 8 营地代理 | 64 | 62,280 | 62,280 | 21,129,458 | 2 |
| 8 营地代理 | 257 | 246,339 | 246,339 | 21,313,517 | 2 |

| 当前样本 | 命令 | 导出 median/P95 ms | 构造存档 median/P95 ms |
| --- | ---: | ---: | ---: |
| 经典 | 64 | 0.132/0.136 | 139.865/141.339 |
| 经典 | 2048 | 8.054/8.465 | 292.515/295.422 |
| 经典 | 2049 | 7.997/8.101 | 292.534/294.900 |
| 0 营地扩展 | 64 | 0.156/0.160 | 135.918/142.076 |
| 0 营地扩展 | 2048 | 8.957/9.562 | 352.294/352.996 |
| 0 营地扩展 | 2049 | 9.055/9.780 | 351.659/352.557 |
| 1 营地代理 | 64 | 0.156/0.160 | 205.205/205.717 |
| 1 营地代理 | 257 | 0.610/0.630 | 226.452/226.947 |
| 8 营地代理 | 64 | 0.159/0.163 | 1545.087/1567.918 |
| 8 营地代理 | 257 | 0.626/0.640 | 1586.273/1591.839 |

导出/构造存档各 1 预热+5 样本，是 CPU 操作，不含 IDB/磁盘/UI/压缩。来源前缀与缓存保存完整，不截断事件。1/8 营地本轮 257 条没有 2048 缓存或 seek 数据，不引用 §6 旧数字作为本轮结果。

| seek2049 | 外部首次 seed 验证 ms（n=1） | 已信任缓存 median/P95 ms（n=5） |
| --- | ---: | ---: |
| 经典 | 2484.000 | 941.102/950.095 |
| 0 营地扩展 | 2622.051 | 979.277/981.311 |

外部首次验证只一次，不称为稳定 P95。L5 的 seed seek 后信任保留由 2048→0→2048 正常回归证明；这里缓存耗时不能替代该行为断言。§3 诊断阻断及本轮 H/M/L 审查项均已按裁定关闭，真实浏览器/未来玩法边界仍见 §7。**5A2 的 5A1-R 硬前置待维护者验收并合入 commit 后关闭；当前工作树未 commit。**


## 附录：审查修复前最终相关测试精确输入

集合/argv/节点环境/实际 exit/墙钟：`/private/tmp/phase5a1-final-related-files.json`、`/private/tmp/phase5a1-final-related-command.json`；用例结果 `/private/tmp/phase5a1-final-related.json`。首轮105文件如下；新增/复验文件集合见附录后续列表。清单对应实际 argv，不用 glob 冒称执行：

```text
src/ext/modules/combat/tests/combat_adapters.test.ts
src/ext/modules/combat/tests/combat_animated_defense.test.ts
src/ext/modules/combat/tests/combat_body_transition_facts.test.ts
src/ext/modules/combat/tests/combat_bonfire_runtime.test.ts
src/ext/modules/combat/tests/combat_combinations.test.ts
src/ext/modules/combat/tests/combat_display.test.ts
src/ext/modules/combat/tests/combat_dodge.test.ts
src/ext/modules/combat/tests/combat_foundation_dodge_gate.test.ts
src/ext/modules/combat/tests/combat_native_defense.test.ts
src/ext/modules/combat/tests/combat_native_stamina.test.ts
src/ext/modules/combat/tests/combat_parry.test.ts
src/ext/modules/combat/tests/combat_parry_decision.test.ts
src/ext/modules/combat/tests/combat_part_break_runtime.test.ts
src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts
src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts
src/ext/modules/combat/tests/combat_phase4d_declarations.test.ts
src/ext/modules/combat/tests/combat_phase4d_playable_recording.test.ts
src/ext/modules/combat/tests/combat_phase4d_rest_relations.test.ts
src/ext/modules/combat/tests/combat_phase4d_travel_ai.test.ts
src/ext/modules/combat/tests/combat_phase4e_recording.test.ts
src/ext/modules/combat/tests/combat_runtime.test.ts
src/ext/modules/combat/tests/combat_square_replay.test.ts
src/ext/modules/combat/tests/combat_warning_map.test.ts
src/ext/modules/giants/tests/giants_colossus.test.ts
src/ext/modules/giants/tests/giants_committed_transition.test.ts
src/ext/modules/giants/tests/giants_composite.test.ts
src/ext/modules/giants/tests/giants_composite_natural.test.ts
src/ext/modules/giants/tests/giants_config_examples.test.ts
src/ext/modules/giants/tests/giants_contract.test.ts
src/ext/modules/giants/tests/giants_rigid.test.ts
src/ext/modules/giants/tests/giants_runtime.test.ts
src/ext/modules/giants/tests/giants_spine_trace.test.ts
src/ext/modules/giants/tests/giants_trace.test.ts
src/ext/modules/giants/tests/giants_transitions.test.ts
src/ext/modules/giants/tests/giants_ui.test.ts
src/ext/modules/giants/tests/giants_zones.test.ts
src/ext/modules/giants/tests/giants_zones_natural.test.ts
src/ext/modules/growth/tests/ext_growth_attributes.test.ts
src/ext/modules/growth/tests/ext_growth_body_transitions_rewards.test.ts
src/ext/modules/growth/tests/ext_growth_classic_isolation.test.ts
src/ext/modules/growth/tests/ext_growth_clone_overhealth.test.ts
src/ext/modules/growth/tests/ext_growth_combat_stats.test.ts
src/ext/modules/growth/tests/ext_growth_composite_rewards.test.ts
src/ext/modules/growth/tests/ext_growth_content_rewards.test.ts
src/ext/modules/growth/tests/ext_growth_creation_ui.test.ts
src/ext/modules/growth/tests/ext_growth_creation_view.test.ts
src/ext/modules/growth/tests/ext_growth_data_contract.test.ts
src/ext/modules/growth/tests/ext_growth_identity_adversarial.test.ts
src/ext/modules/growth/tests/ext_growth_identity_runtime.test.ts
src/ext/modules/growth/tests/ext_growth_item_runtime.test.ts
src/ext/modules/growth/tests/ext_growth_lifecycle.test.ts
src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts
src/ext/modules/growth/tests/ext_growth_npc_replay.test.ts
src/ext/modules/growth/tests/ext_growth_optional_rewards.test.ts
src/ext/modules/growth/tests/ext_growth_prepared_commands.test.ts
src/ext/modules/growth/tests/ext_growth_runtime.test.ts
src/ext/modules/growth/tests/ext_growth_skill_integration.test.ts
src/ext/modules/growth/tests/ext_growth_skills_slot_order.test.ts
src/ext/modules/growth/tests/ext_growth_sources.test.ts
src/ext/modules/growth/tests/ext_growth_templates_runtime.test.ts
src/ext/modules/growth/tests/ext_growth_ui.test.ts
src/ext/modules/growth/tests/ext_growth_view.test.ts
src/ext/modules/narrative/tests/narrative_content.test.ts
src/ext/modules/narrative/tests/narrative_dialogue.test.ts
src/ext/modules/narrative/tests/narrative_persistence.test.ts
src/ext/modules/narrative/tests/narrative_rewards.test.ts
src/ext/modules/narrative/tests/narrative_runtime.test.ts
src/test/c_5_fall_subsystem.test.ts
src/test/dpad_hold_input.test.ts
src/test/ext_compatibility_diagnostics.test.ts
src/test/ext_foundation.test.ts
src/test/ext_foundation_contracts.test.ts
src/test/ext_generation_checkpoint.test.ts
src/test/ext_generation_checkpoint_differential.test.ts
src/test/ext_hardening.test.ts
src/test/ext_module_composition.test.ts
src/test/ext_optional_rewards.test.ts
src/test/ext_recording_v4_digest.test.ts
src/test/ext_recording_v4_snapshots.test.ts
src/test/ext_recording_v4_storage.test.ts
src/test/ext_world5_clock_levels.test.ts
src/test/ext_world5_offline.test.ts
src/test/main_menu_replay_seek.test.ts
src/test/perf_2_auto_cadence.test.ts
src/test/perf_2_replay_cadence.test.ts
src/test/phase4a0_spatial.test.ts
src/test/phase4a1_game_square.test.ts
src/test/phase4a2_body_combat.test.ts
src/test/phase4a2_body_effects.test.ts
src/test/phase4e_recording.test.ts
src/test/u_00_new_run.test.ts
src/test/u_03_whole_run_snapshot.test.ts
src/test/u_03b_level_travel.test.ts
src/test/u_26b_endgame.test.ts
src/test/u_27_recording.test.ts
src/test/u_r2_trace.test.ts
src/test/u_r3_trace.test.ts
src/test/u_r4_trace.test.ts
src/test/ux_1d_recording_continuation.test.ts
src/test/x2a_recording_checkpoint.test.ts
src/test/x2n_lumenstone_description.test.ts
src/test/x3_u6_messages.test.ts
src/test/x3_u8a_forced_turns.test.ts
src/test/x3b_display_recording.test.ts
src/test/x3b_item_details.test.ts
```

其后新增的40个相关文件（与首105集合合并恰为145）如下：

```text
src/test/canvas_resize.test.ts
src/test/captive_manacles.test.ts
src/test/dialog_continuations.test.ts
src/test/dialog_d4_blink.test.ts
src/test/fe_1_touch.test.ts
src/test/fix_rapier_travel.test.ts
src/test/immersive_polish.test.ts
src/test/lava_connectivity.test.ts
src/test/p1_30_i18n_gate.test.ts
src/test/phase3a0_actor_action.test.ts
src/test/phase3a0_defense.test.ts
src/test/phase3b_action_lifecycle.test.ts
src/test/phase4a0_spatial_differential.test.ts
src/test/phase4a3_body_display.test.ts
src/test/phase4a3_body_sfc.test.ts
src/test/phase4a4_movement_regions.test.ts
src/test/presentation_timeline.test.ts
src/test/repo_hygiene.test.ts
src/test/retained_render_determinism.test.ts
src/test/search_progress_hud.test.ts
src/test/test_suite_membership.test.ts
src/test/u24_hardcoded_text.test.ts
src/test/u_02a_rng_snapshot.test.ts
src/test/u_15a_shattering.test.ts
src/test/u_26a_deep_levels.test.ts
src/test/ux_1c_hallucination_display_rng.test.ts
src/test/ux_1d_export_boundary.test.ts
src/test/x2d_scroll_equipment.test.ts
src/test/x2i_discovery_text.test.ts
src/test/x3_u1_movement_safety.test.ts
src/test/x3_u2_ally_captive.test.ts
src/test/x3_u3_cursed_equipment.test.ts
src/test/x3_u4_auto_travel.test.ts
src/test/x3_u5_commands.test.ts
src/test/x3_u7_sidebar.test.ts
src/test/x3_u8b_items.test.ts
src/test/x3_u8c_combat_items.test.ts
src/test/x4_r6_integration.test.ts
src/test/x4a_movement_rendering.test.ts
src/test/x4b_flavor_text.test.ts
```

复验实际完整argv/集合：`/private/tmp/phase5a1-final-repaired-command.json`（37文件）、`phase5a1-final-last-command.json`（16文件）、`phase5a1-final-closing-command.json`/`-files.json`（45文件）、`phase5a1-final-correction-command.json`（x2i单文件）。类型/构建/模块边界的最终argv与exit/秒为 `phase5a1-final-gates.json`，空白修复复验为 `phase5a1-final-whitespace.json`。仅把同一文件最后正常结果用于交付覆盖统计；capture/反事实/过滤/interrupted均不混入。

最后新增反例/完整回归：`phase5a1-final-transaction-before-command.json`/`.json`（6项定位运行，其余27仅过滤，生产修复前5 fail/1 pass）、`phase5a1-final-transaction-final-command.json`/`.json`（7文件95 pass，无过滤/skip/todo）。四个生产文件的修复前后原件留在 `phase5a1-final-context-{before,after}`；正常验收及最终性能使用after版本。最后这次守卫修复未再增加Game字段或升号；本批次唯一新增持久Game字段为world5（见§1）。地图生成算法与原生/模块规则数值未改。
