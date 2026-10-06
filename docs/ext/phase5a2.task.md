# 5A2 任务书：物品/容器/资源点/工位/工作票据、中立动作根与冻结 WorldWork SDK

> 基线：**5A1 + 5A1-R 完整交付并合入后的 `ext/phase5`（维护者开工时填写确切 commit：`c3319ae`（5A1 含审查修复 b2547d6 + foundation 收尾补丁 + 设计更新））**。工作分支 `ext/phase5`。
> 依据（均已批准）：`docs/ext/phase5-settlement-world.md`（P5-D01–D14 全 A；本步重点 §7、§12、§14.1）、`docs/ext/phase5a-contract.md`（**C5-1/1.0.0 文档修订 r2**；本步读 §0–§2、§4、§5、§8、§9、§10、§11，§3 只读与 ticket/离线相关处）、`docs/ext/phase5a0.report.md`（§4 拆分表 5A2 行、§5.3–5.6 已批准数值、**§7 r2 修订记录**）、`docs/ext/phase5a1.report.md`（实际版本表、`FOUNDATION_PROTOCOL` 用法、`actorActions` 摘要域约定）。合同与本任务书冲突时以合同为准并在报告中指出；合同未定、本任务书 §1 已裁定的细节以本任务书为准。
> 本步交付 **冻结给 dot 的 5B SDK 基线**：§9 全部真实 TS 导出 + 无头 harness + crafting 骨架示例模块。**统一属性管线不在本步**，它是独立的 5A2-S（`docs/ext/phase5a2s.task.md`），本步不得预先改任何属性读取点。开发期门禁按 P5-D14=A（相关功能门禁；完整/组合/删除矩阵留 5Z）。**不要 commit。**
> 维护者 2026-10-06 对本任务书的全部预先裁定表态“全部按推荐”（记录见[阶段 5 设计 §15](phase5-settlement-world.md#15-待维护者决定推荐不是批准)）。

## 0 开工核对（不通过先停下报告）

1. **5A1-R 已合入是硬前置**（合同 §11 第 1 条）：确认基线中存在 `RecordingV4`、分层摘要（每事件 `extensions / world5 / actorActions` dirty 域 + 廉价诊断，chunk 边界 `fullCheckpoint`）、`scripts/u03-state-contract.json` 与摘要域绑定测试、`RecordingStorage.ts`。`actorActions` 域在 5A1 中是固定空域摘要。任何一项缺失 → 停下，不得开工。
2. 确认实际版本（以 `docs/ext/phase5a1.report.md` 最终版本表为准，预期）：foundation **6**（`src/ext/descriptor.ts` 导出 `FOUNDATION_PROTOCOL`）；whole-run **v4**；录像 **4**；来源 **2**；IDB `brogue-web-saves` **v2**；**没有独立实体 codec 槽**（维护者已裁定：实体行随整局 v4 外壳共用）；growth 1.7.0、narrative 1.4.0、combat 1.5.0（state schema 3）、giants 1.0.0。不符时不要自行改号，报告差异。
3. 复核以下代码事实仍成立（行号以 `2cd10a5` 为参考，5A1 后会漂移，按语义重定位并在报告写实际行号）：
   - combat 生产状态 `ProductionActorAttackState`（`src/ext/actorActions.ts`）持有 `schema:3 / revision / nextActionId / bonfires? / scheduler / actions / actors`；`src/ext/runtime.ts` 中 `Conflicting actor action providers` 与 `stateField === 'scheduler'` 检查；`runtime.actorActionBinding()`。
   - `nextActionId` 的分配者：`PhasedAttackProduction.ts`、`WorldRestProduction.ts`、`ActorActionAuthority.ts`（foundation fixture）、combat `bonfires.ts`/`worldRest.ts` 校验。growth state 中同名 `nextActionId` 是 growth 自己的动作计数，**不在本步迁移范围**。
   - `Game.applyCommandStages` 的 `ext:command` 分支顺序：`isWorldRestCommand` → parry → dodge → phased attack → `executePreparedExtensionCommandStages`（仅实时局且有确认回调）→ `runtime.command`。
   - `Game.autoAction`（kind `'auto_rest' | 'search_long' | 'run'`）、`beginAutoActionStages`、`stepAutoActionStages`、`performAutoPathStepStages`、`stopAutoTravel`；U03 已登记 `autoAction`。
   - `Items/Inventory.ts` packCount/stacksWith、`Items/Item.ts` ItemCategory 止于 GEM=12、`EntitySnapshot.ts` ITEM_FIELDS/collectEntityGraph。
   - `WorldRestProduction.ts` 篝火休息的中断谓词（dead/moved/level-exit/damage/incapacitated/target-removed/threat）。
4. `git log` 记录基线 commit 与干净工作区，写入报告。通读合同 §0–§2、§4、§5、§8–§11 后再动手。

## 1 预先裁定（开工前已定，不再回问）

| # | 事项 | 裁定 |
| --- | --- | --- |
| D1 | 版本分配 | foundation 6→**7**；whole-run v4→**v5**（Item 新字段/MATERIAL/容器根/`run.actorActions` 改变共用外壳，按“无独立实体槽”裁定随外壳升）；录像格式仍 **4**、来源仍 **2**、IDB 仍 **v2**（录像头 codec 字段写入新的 wholeRun/foundation 号）；combat module/rules 版本 1.5.0→**1.6.0**、state schema 3→**4**；combat rules 指纹输入若未变则 rules 版本说明理由后可保持，报告写明；growth/narrative 不改；giants 仅当其持久布局确受 scheduler 迁出影响才升，报告举证 |
| D2 | combat 合并升号 | 合同 §1.2：combat 的 scheduler/nextActionId 迁出（本步）与 5A2-S 的容量物化**共用本步分配的同一 combat 版本号**；5A2-S 不再升 combat。本步与 5A2-S 之间产生的 combat 存档/录像不承诺兼容（开发期，不打标签） |
| D3 | 中立动作根形状 | `run.actorActions = { schema: 1, nextActionId, bundles }`（`bundles` 即原 `scheduler.bundles`，保持 bundle 内部字段与 `depth: number`），每个 bundle **新增必填 `owner: string`**：combat 攻击/闪避/弹反/篝火休息为 `'combat'`，世界工作为 `'foundation'`。combat state 去掉 `scheduler` 与 `nextActionId`，保留 `revision / bonfires? / actions / actors`，`actions[].actionId` 必须引用 `run.actorActions` 中 owner='combat' 的现存或已分配 ID（`< nextActionId`） |
| D4 | 根存在条件 | `run.actorActions` 存在 ⇔ 新局 manifest 含 actorActions provider（combat）**或** world5 存在；静态决定、load 校验一致、运行中不开关。经典局与无 combat 且无世界能力的组合不建根 |
| D5 | provider 声明 | `ExtensionModule.actorActions` 改为 `{ definitions: Json }`（删除 `stateField`）；“单一 actorActions provider”检查保留（只约束攻击定义提供者，不约束世界工作） |
| D6 | 确认风险 | 本步引擎只产生一种世界工作确认：**`tool-break`**——计划中任一批次会使所用工具耐久降到 0。文案归 foundation locale `ext.foundation.world.confirm.tool-break`。No 照合同 §9.1 记录一条 `ext:command`（decisions 末项 false），0 成本 |
| D7 | 节点再生在 prepare 的读值 | prepare 内 `readWorkContext` 返回**纯计算的虚拟物化值**（与 commit 将写入的结果逐字段相同，不写任何根）；`projection.worldWork` 返回**最后已物化值**；commit 先物化再应用。物化不递增 `node.revision` |
| D8 | `c5-place-v1` 的“已知可达” | 合同 §9.2(e) 的“从到达点已知可达”解释为：在真实地图上，从玩家到达点出发、只经可通行稳定地面、**不经秘密门/需钥匙或机关的格**的四/八邻连通（与原生寻路相同的对角规则）。不读玩家知识，因此不泄露未见信息；节点仍只在格可见后被渲染 |
| D9 | MATERIAL 物品原生行为 | 可拾取、丢弃、随原生坠落/深水漂走/怪物偷取等对“任意非装备物品”的规则；**不可**装备、投掷、使用（apply/eat/read/zap），这些入口对 MATERIAL 返回 i18n 简洁拒绝、0 成本、不录制为成功动作（沿原生“不能使用”的处理）；不可燃、不被鉴定流程影响（始终已知名）；原生生成/掉落表永不产出 MATERIAL |
| D10 | 骨架模块 ID | 测试骨架模块 id = **`craftskel`**，定义 ID 以 `craftskel.` 开头，避免与 dot 的正式 `crafting` 同时出现时冲突。payload 形状与合同 `CraftingCommand` 完全相同（只是 `module` 不同） |
| D11 | `world-work-basic` fixture 归属 | 复用 5A1 的 foundation 测试 fixture 机制（`registerWorld5Fixture` 一类测试专用注册，不进 catalog），fixture 模块 id **`c5fixture`**，自带一份最小 `worldDefinitions`（1 材料、1 无工具节点、1 桌、1 箱容量定义）；D1 节点/桌/箱由**可信 fixture 放置**（固定相对偏移，被占则按 `adjacent-passable` 稳定近邻序回退），不走 `c5-place-v1` |
| D12 | NPC 工作 | 本步只做 foundation fixture 级 NPC 票据推进（`trusted-world` scope 给一个真实盟友建 ticket，在其每次原生自由决策启动一个 bundle 一批）；不做招募、订单、离线工作。`commitOfflineSettlement` 的 `item-delta` / `ticket-progress` 效果**继续返回 `C5_UNSUPPORTED`**（5D2 开放）；`suspended` 状态只做 schema 校验，本步无生产路径产生它 |
| D13 | 箱的创建 | 本步不开放任何玩家建箱命令；箱只由可信 fixture 建（同事务预建该层 remains）。玩家放台（place-station）是唯一公开的世界对象创建命令 |
| D14 | `regions` 键 | 本步不建/不撤运行期 region（5A3），但新增的世界根写入路径（interactable 放置/移除、remains、节点耗尽）**不得**写出 `regions: []`；提供单一 helper `setOwnedRegions(world, list)`：空列表删除键。5A3 复用它 |
| D15 | 每批耗时与回血 | 不改合同：每批一条命令、回血/回合各一次、饥饿按 100 tick 客观块扣。骨架与 fixture 配方每批 ≤1000 tick；5B 数值（每批 ≤1500 tick）已批准。本步须用测试固化“10000 tick 单批只回血一次、饥饿扣 100 次”的现状，并在报告“交接 5B”中写明：**配方每批 tick 应保持短**（建议 ≤1500），长工序用多批而非单批长 tick |
| D16 | place-station 付费来源 | 由 foundation 决定、模块不在 payload 指定：玩家背包中有 `StationDefinition.kitDefinitionId` 对应 kit ≥1 → 扣 1 个 kit；否则扣 `placementCost` 原材料；两者都不足 → `C5_INPUT`。不弹确认；`readWorkContext`/投影可据此预告来源；绝不同时扣 kit 与材料（5A0 §5.5） |
| D17 | `worldSdk` 键位置 | `worldSdk: 1` 是 `ModuleDescriptor`（`src/ext/descriptor.ts` 键白名单）字段，与 `foundation: FOUNDATION_PROTOCOL` 并列（合同 §9 `WorldDescriptorFields`、§9.1(h)）；runtime 在构造时把 descriptor 的 `worldSdk` 与 `ExtensionModule` 上的 world 字段做 D-一致性检查（见 5A2d） |
| D18 | 读 DTO 范围与显示归属（预先回答 5B 包草稿 §A.3 的问题） | `WorkContext.stations` / `queryStations()`：当前层中 **调用 owner 自己的全部工位** + 玩家已见过的其他 owner 工位（自有对象不构成信息泄露，模块据此执行比 foundation 更严的每层上限）；`containers` / `queryContainers()`：当前层玩家已见过的箱（任何 owner 的箱在 C5-1 都可被玩家用作来源/目的地，不做 owner 权限）。节点/工位 interactable 的 `owner` = 定义所属模块；地图渲染、悬停、详情由 foundation 完成；批完成/中断/取消/放置/启动礼包的日志消息由 foundation 用定义的 `nameKey` 写（模块不写日志）。native 行的 glyph/color 只做校验与目录显示，地图/背包外观沿原生模板。`worldWorkCommands.prepare` 只拿 `payload + sdk`，拿不到模块 state（合同签名）。harness 的 `command(action, data)` 接受任意原生录制命令（move、travel、rest 等），供自然路线 trace 使用。`c5fixture` 可与任何世界模块（含正式 `crafting`）同局启用 |

## 2 推荐顺序与可停下的子里程碑

每个子里程碑完成后可停下写报告（已完成与剩余项），等维护者决定是否继续。中途停下的子里程碑只供审阅，不作为可合并交付；版本号只在本批次分配一次（§1 D1），子里程碑之间不得各自升号。

### 5A2a 中立动作根迁移（含篝火回归）

- 按 D3–D5 把 scheduler bundles 与 `nextActionId` 从 combat state 迁到 `run.actorActions`；所有分配者（phased attack、闪避/弹反、篝火休息、`ActorActionAuthority` fixture）改从中立根分配。`ActorActionProduction` 的玩家输入锁、`advanceActionTime` 推进、bundle 完成边界语义不变。
- 唯一可写倒计时（合同 §5.5）：bundle 存活时权威倒计时只在 `run.actorActions`；本步之后 ticket 的 `remainingTicks` 是派生镜像（见 5A2d）。
- `WorldRestProduction.ts` / `src/ext/worldRest.ts` 改读中立根；篝火的 interactable、`state.bonfires` 账本、full-on-complete、收据**全部仍归 combat**（合同 §7 第 1 条），不建 world5 记录。
- 摘要：`actorActions` 域从固定空域变为真实内容，写入口登记 dirty；U03 登记 `run.actorActions`（kind=run，域 actorActions）。
- codec：whole-run v5 / foundation 7 / combat state 4 严格校验（未知键、ID 单调、bundle owner 合法、combat actions 引用存在、根存在性与 manifest 一致）；旧版本在退休当前局前拒绝。
- **停点验收**：combat、giants、combat+giants 既有来源/费用/中断/历史显示不倒退；篝火休息 save/load/逐条 replay/seek/中断非回归；无 combat 组合不建根（除非 world5 存在）。

### 5A2b Item 模型、原生装配与全 Item 根枚举器

- `ItemCategory.MATERIAL = 13`（不重排 0…12）；`Item.worldItem?: WorldItemFields`（只在 MATERIAL 上出现；原生物品省略属性，不写 undefined）；登记 `ITEM_FIELDS`、u_01 实体字段审计、U03。
- packCount：MATERIAL 每 stack 1 格；其余原生规则不变（FOOD 仍按 quantity，合同 §5.1）。stacksWith：双方 MATERIAL 且 `definitionId`/`quality` 相同、`toolDurability` 均为 null → 堆叠，上限 `maxStack`，超出按稳定顺序拆 stack；工具（maxStack=1、有耐久）不堆叠；其余沿原生。合同中的 `moduleData` 规则属 6A1，本步不加该字段，只在代码注释与报告中声明预留。
- 固定原生装配（不走 `ItemLoader.spawn*`，0 RNG）：`dagger` / `leather_armor` / `ration_of_food`，+0、无诅咒/符文、已鉴定、FOOD nutrition=1800、**不带任何模块/世界字段**，与自然物品同模板时按原生 stacksWith 合并。
- 定义注册：`worldDefinitions.items`（`ItemDefinitionContribution`，合同 §5、§10.1 校验表）在 runtime 构造时整包校验并冻结，进入该模块规则指纹；material/tool/kit 生成 MATERIAL Item；native 行只用于输出模板与批次上限校验；**unitWeight 不存在**。
- 显示：MATERIAL 的名称/描述取 owner locale `nameKey/descriptionKey`，glyph/color 取定义；背包、详情、地面渲染接入；工具显示耐久。D9 的拒绝入口。
- `forEachItemRoot(game, visit)`（合同 §5.2）：唯一可信枚举器，规范顺序（玩家背包 → 活动层地面 → 活动层生物携带 → 缓存层按 levelKey 的地面与携带 → pending 坠落物 → purgatory/暂存生物携带 → world5 容器按 WorldId）。预算、双 owner 检查、load 校验都必须用它；新增一个“禁止另写遍历”的源码守卫测试（grep 白名单式）。
- 预算（合同 §5.3、§10.1）：C5 新增根操作在提交前计数 `全部根 + 新增 > 8192 − 1024` → `C5_BUDGET`；原生生成从不因此被拒；load 只校验 C5 自有根（world5 容器内 Item ≤7168、单 owner）。

### 5A2c 世界根：容器、资源节点、工位、票据、放置与启动礼包

- world5 中开放 `containers / nodes / stations / tickets / pendingPlacements / startupGrants`（5A1 严格为空的根）；`structures / restPoints` 仍严格为空（5A3）。ID 空间严格按合同 §2.1：节点/工位的身份 = 其 interactable 的 `EntityId`；ContainerRecord/WorkTicket 用 `WorldId`；箱 = interactable(EntityId) + ContainerRecord(WorldId, `position.kind='interactable'`)。
- 容器（合同 §5.3）：chest/escrow/refund/remains 作为 `collectEntityGraph` 根，只存 Item ID 引用；capacity 1…64（remains ≤1024）；每层第一个箱同事务预建 remains（D13）；查看零时间；同层 Chebyshev ≤1 的批量存取共 100 tick 的内部 transfer 计划（`planMaterialTransfer` 不在 §9 SDK 中，仅可信 adapter/fixture 使用）。
- 世界 interactable 子预算（合同 §10.1 M3）：C5 合计 ≤832（节点 512 / 工位 128 / 箱 112 / remains 16 / RestPoint 64 预留），且全局 ≤1024；既有模块放置不受 C5 影响。
- 资源节点（合同 §5.4）：`remaining/reservedUnits/regenRemainder/lastSettledTick` 整数再生、满容量清余数、惰性物化不递增 revision（D7）；单格非阻挡、不写地形；渲染/悬停/详情走 foundation 既有 interactable 路径（合同 §9.1(d)）。
- 放置（合同 §9.1(e)、§9.2(e)）：该层**首次 visited 的 enteredLevel 事务**中、模块 enteredLevel 钩子之前，按 `resourceNodes[].placement` 执行 `c5-place-v1`（候选按 D8，(y,x) 排序，SHA-256 首 4 字节大端 + 合同 §3.4 拒绝抽样）；`defer` 写 `pendingPlacements` 并在该层下一次 enteredLevel 重试一次，仍无位记 skip；skip/defer 各写唯一收据。不触原生两条 RNG 流，不改房间/楼梯/giants reservation。冻结 `c5-place-v1` 固定向量（至少 3 条，含 attempt>0 的拒绝重抽）。
- 工位（合同 §5.6）：独立单格非阻挡 StationRecord + interactable；工作位 = 8 邻中可通行且有交互线的格（`adjacent-passable`），至少 1 个才可放置；`boundComponentId` 恒 null（5A3 才绑定）。
- 启动礼包（合同 §9.1(f)、§9.2(f)）：新局玩家首次真实落位 D1 的 enteredLevel 事务中、资源放置之后、每 owner 一次；按定义行顺序入包 → `floor-then-skip` 稳定近邻落地 → skipped；`StartupGrantReceipt` 持久不淘汰；load/replay 查询不补发。
- 所有新根：U03/实体字段登记、world5 dirty 域写入口、严格 codec（引用闭包、单 owner、预留守恒 `0≤reservedUnits≤remaining≤capacity`、镜像相等）。

### 5A2d WorldWork SDK、`ext:command` 世界工作分支、票据与 auto_work

- **冻结 §9 SDK**：新建 `src/ext/worldSdk.ts` 作为内容模块的**唯一**世界 SDK 入口，导出合同 §2.1（模块可见部分）、§5 定义/读 DTO、§9 代码块的全部类型与 `C5_CONTRACT_VERSION='1.0.0'`、`WORLD_SDK_VERSION=1`、`WorldErrorCode` 全集、`WorldResult`。**不得**从该入口导出 LevelRecord/OfflineInput/结构写口/可信 scope 工厂/`commitWorldWork`/`commitOfflineSettlement`（合同 §9 首段）。类型以合同为准逐字落地；SDK 返回 DTO 深复制并深冻结。
- **descriptor**：`worldSdk: 1` 加入键白名单；runtime 构造时独立检查——声明了 `worldDefinitions` 或 `worldWorkCommands` 或 `worldWorkParticipant` 的模块必须 `worldSdk: 1`，反之亦然；其他值 → 构造失败（兼容诊断 i18n，错误码 `C5_BAD_VERSION`）。`worldWorkCommands` 的键只允许合同 `CraftingAction` 四个；同一 action 不得同时出现在 `commands`（构造时互斥检查，合同 §9.2(b)）。整包任何错误使运行时构造失败，不部分注册（§9.2(a)）。
- **Game 新分支**：在 `applyCommandStages` 的 `ext:command` 中，与 `isWorldRestCommand` 并列、**先于** `executePreparedExtensionCommandStages` 与 `runtime.command`，新增 `isWorldWorkCommand(game,data)` → `executeWorldWorkCommandStages(data)`。实时局：prepare →（有 D6 风险）以 `recordDecision:false` 收集确认 → 重新 prepare 并 canonical 比较（不等 `C5_STALE`，0 成本，不抛错）→ `requestConfirm` 记录一次 → 引擎 `commitWorldWork(handle, scope)` → 启动 bundle/auto_work 或零时间完成（cancel-work）。replay：prepare 一次并沿记录答案。prepare/plan* 只在该回调期间可用，其余时机 `C5_SCOPE`；句柄只活一次命令。
- **scope**：`WorldActorScope` 只由底座在 executeCommand（player-command）、NPC 原生自由决策（npc-decision）、可信迁层/fixture 边界（trusted-world）签发，不可经 JSON 构造。
- **CAS**（合同 §4.2）：只比较计划触及对象的版本集合；`inventoryStamp`（`c5-inventory-v1`，若 5A1-R 已实现则复用同一函数）；四种命令 payload 的 CAS 字段与 casKeys 严格按合同表。
- **票据与时间**（合同 §5.5、§8）：
  - 接收：一次性 escrow 全部批次输入、预留输出槽与退款槽（`refundReservation`）、建 ticket(working)；batchCount>1 时写 `run.autoAction = { kind: 'auto_work', ticketId }`（U03 更新 autoAction kind 登记）；启动第 1 批 bundle（owner='foundation'，时长=该批 workTicks）。时间承担沿篝火休息 bundle 的方式（timeChargeOwner=玩家），不在 commit 内另加世界钟，`WorldCommit.chargedTicks`=首批时长。
  - 每批完成在 bundle 完成边界原子：消耗该批输入、创建输出（原生装配或 MATERIAL）、扣工具耐久、`completedBatches++`、收据、`CommittedWorkFact`（factId 用既有 runtime 事实分配器）、参与者 `onCommitted`。
  - 续作：既有 ticker 触发录制的 `auto_step`；`stepAutoActionStages` 对 auto_work 先 `autoTravelDisturbed()`，再重验工具/工位/节点可用量/交互线，通过则启动下一批；末批完成清 autoAction、ticket→completed。
  - 停止续作（disturbed/伤害/HP 下降/离层/目标失效/工具破损/任何非 `auto_step` 输入）：**在该条录制命令内**执行 foundation 取消事务（退款未开始批次、释放节点与输出预留、ticket→cancelled、收据 interrupted、事实 `cancel`）。
  - bundle 存活中被打断：沿 `WorldRestProduction` 同一中断谓词；该批不产出、不扣耐久，已耗时间不退，剩余（含该批）escrow 全退，ticket→cancelled。
  - `cancel-work`：只取消当前玩家自己的 ticket，仅在无 bundle 存活时可执行，零时间，与停止续作同一取消事务。
  - harvest：一次采 1 单位，单批 ticket + 一个 bundle（`harvestTicks`），不写 auto_work。
  - `ticket.remainingTicks` 镜像：每次 `advanceActionTime` 后同步，load 校验与 bundle 剩余相等，镜像更新不递增 ticket.revision。
  - 每 actor 一个未终结 ticket；有 combat 时仅在 actor 空闲且无存活 bundle 时接收（否则 `C5_BUSY`）。
- **参与者失败**（合同 §9.1(g)）：接收/取消/放置/启动时异常 → `C5_PROVIDER` 全回滚；**批完成时**失败 → 回滚该完成事务，同一边界改走不调用参与者的 foundation 取消事务（receipt reason=`provider`），bundle 不卡住。
- **NPC**（D12）：fixture 级一次 prelude/一个 bundle 一批的证明。
- **投影**：`ExtensionProjectionContext.worldWork?: WorldWorkReadSDK`，仅当 owner 声明 worldDefinitions 且 world5 存在时提供；只读最后已物化值；`recentFacts(afterFactId)` 与参与者所见 fact 相同。
- **i18n**（合同 §9.1(j)）：foundation locale 新增 `ext.foundation.world.error.<code 去 C5_ 前缀小写>` 全集（34 个）与 D6 确认文案；玩家不见错误码。

### 5A2e `stopAutoTravel` / `autoAction` 写入点审计

合同 §8：auto_work 停止只能发生在录制命令的执行中；非命令路径不得对 auto_work 做机械写入。基线 `2cd10a5` 的 `Game.ts` 中 `stopAutoTravel` 共 **22 处 grep 命中 = 21 个调用点 + 1 个定义**（合同所记“22 处”即此数），另有直接写 `this.autoAction = null` 的 3 处（新局初始化 ~930、load 恢复 ~11485、`setAutoPath` ~14131）也纳入审计。参考行号（会漂移，按语义重定位）：

| 参考行 | 所在函数 | 需要判定 |
| --- | --- | --- |
| 3605 | `applyCommandStages`（任何非 auto_step 输入） | 命令内 → auto_work 取消事务的主入口 |
| 4357、4730 | `performPlayerAction`（非自动步移动；自动步拾取） | 命令内 |
| 9640 | `requestConfirm`（确认前停自动） | 命令内；确认 No 时取消事务仍在本命令 |
| 9800 | `confirmPlayerMoveStages`（必死移动） | 命令内 |
| 13216、13236 | `handleAutoExploreStages` | 判定是否总在 `auto_explore` 命令内 |
| 13277 | `recomputeExplorePath` | 判定调用者 |
| 13300 | `handleMouseTravelStages` | 判定 UI 直调还是命令内 |
| 14140、14153 + 14131 直写 | `setAutoPath`（public，UI 直调） | 很可能非命令路径 |
| 14184 | `autoTravelDisturbed` | 调用者全在命令内？ |
| 14230、14274、14285、14292 | `beginAutoActionStages` / `stepAutoActionStages` | 命令内 |
| 14314、14331、14358、14363、14373 | `stepAutoPathInnerStages` | 命令内（auto_step） |

处理规则（已裁定）：

1. 每处分类为 **A 命令内**（位于某条录制命令的执行栈中）或 **B 非命令**（UI/会话/渲染/恢复路径）。分类依据写进报告表格（调用链证据）。
2. `stopAutoTravel()` 在 `autoAction?.kind === 'auto_work'` 时改为调用 `stopAutoWorkInCommand(reason)`：它断言当前处于录制命令执行中（新增会话级标志，登记 U03 为 session），执行取消事务；断言失败**抛内部错误**（与既有严格风格一致）。
3. 所有 B 类点必须修到在 auto_work 存活时**不触达**该断言、不清 autoAction、不写 ticket：只允许改会话显示标志。若该 UI 路径需要打断工作（例如点击寻路），UI 先发一条录制的零时间 `escape` 命令（基线中 `escape` 是录制命令且零时间——开工时复核，不成立则停下报告），再继续原 UI 行为。
4. 新局初始化/load 恢复的直写不是“停止”，保持；load 必须原样恢复 `auto_work` 与 ticket。
5. 每个 B 点都要有一条“auto_work 存活时调用不抛错、世界不变”的测试；每个 A 点类别至少一条“在该命令内取消、退款一次、录像可重放”的测试。

### 5A2f harness、fixture、骨架模块与 5B 冻结清单

- `src/ext/testing/worldHarness.ts`：合同 §9 `createWorldHarness` 签名逐字实现；内部走真实 Game/executeCommand/录像 v4/存档，不 mock 底座。`replay()` 的 `firstMismatch` 返回**首个可验证的分歧命令**；报告格式沿 5A1-R 的维护者裁定：“首个可验证分歧命令 + 自上一个已验证边界起的区间”，不做逐命令全量摘要（harness 可附带 `{ fromVerified, toCommand }` 诊断字段，但签名的 `firstMismatch` 语义不变）。`digest()` 返回当前完整机械摘要根。
- fixture `world-work-basic`（D11）与骨架 `src/ext/testing/fixtures/craftingSkeleton/`（D10）：一种材料、一个节点、一个配方（每批 ≤1000 tick，至少一个配方 batchCount 可 >1）、四个命令（harvest/craft/place-station/cancel-work）、参与者（写自身 state 的工作历史）与投影（读 worldWork）的最小可运行实现；含一个带工具耐久的配方以覆盖 D6。不进生产 catalog、不加 descriptor 发现项、不出现在生产构建。
- 隔离：在 `scripts/check-module-boundaries.mjs` 增加规则——非测试生产源码不得 import `src/ext/testing/**`；并以 build 产物检查（或等价测试）证明 harness/骨架未进生产包。
- 测试发现：说明 dot 的 `src/ext/modules/crafting/tests/**` 与 `test-suites.json` 如何被现有发现器自动纳入（不需改共享清单），写进冻结清单。
- **5B 派发冻结清单**（合同 §11 第 3 条逐项）：本步报告必须给出一张表，每项写实际值或路径：5A2 收尾候选 commit 位（由集成人提交后填写）；`src/ext/worldSdk.ts`、`worldHarness.ts`、骨架目录、fixture 文件的路径与 **SHA-256**；`worldSdk: 1` 与 `FOUNDATION_PROTOCOL` 用法示例；WorldDefinitionPack schema；四种 payload v1 与 CAS 字段；`ext:command`/确认/No 记录流程；`projection.worldWork`；地图显示归属；`c5-place-v1` 向量与启动礼包规则；参与者接口；错误码与 i18n 键；harness API；auto_work 行为；5A0 §5 数值（含 r2 修订：无 unitWeight、口粮按 quantity 占格）；crafting 测试发现入口；已知限制（D15 回血语义、5A2-S 合入后需重跑 crafting trace）。缺任一项不得宣称“可派发 5B”。

## 3 非目标（出现即越界）

- 统一属性管线、任何属性读取点改道、growth `rulePolicies` 改动（5A2-S）。
- 结构/房间/cellProperties/运行期 region/RestPoint（5A3）；site（5C2）；居民招募、订单、离线工作生产效果（5D）。
- crafting 正式内容与数值、crafting 正式 descriptor/目录 `src/ext/modules/crafting/**`（dot 的 5B）。
- 改 combat/giants/growth/narrative 的规则或数值；改生成算法；新增 npm 依赖。
- `Item.moduleData`（6A1）。

## 4 必须保持的不变量

1. **零影响**：未启用世界能力且无 combat 的组合不建 `run.actorActions`、不建 world5、无新 RNG 调用/新域；经典局录像逐事件成本不增加；两条 RNG 流、生成结果、UR2/UR3/UR4 黄金 trace 除版本外壳外不变。
2. **唯一时间**：world-work 只经 bundle 落账；一批一条命令；不在 commit 内另加世界钟；`simulationTicks` 仍只有 5A1 的唯一提交点。
3. **一个对象一个 ID、一个 Item 一个 owner**；预留与 escrow 守恒；退款与输出只一次；终结 ticket 的 ID/高水位不重用。
4. **接收前拒绝 0 成本**（0 tick/0 RNG/0 实体与持久 ID/0 消息/不消耗 planId）；接收后中断不倒退已完成批次与已耗时间。
5. **回滚**：任一发布点（ID 分配、扣料、escrow、输出、工具耐久、参与者、事实/消息、预算）失败 → 完整对象图/ID/计数/RNG/消息/缓存恢复，用独立写集差分，不只比 JSON。
6. **combat 不倒退**：攻击/闪避/弹反/篝火的来源、费用、打断、历史显示与录像合同不变；giants 身体动作不变。
7. SDK 入口之外的可信能力对内容模块不可达（类型与运行期双重保证）。

## 5 必测场景（登记到 `scripts/test-suites.json` 底座清单，命名 `ext_actor_actions_root_*`、`ext_world_items_*`、`ext_world_work_*`、`ext_world_harness_*`）

动作根：
- 迁移前后 combat/giants/combat+giants 的既有攻击、闪避、弹反、身体动作、篝火休息 save/load/逐条 replay/seek/续录；`nextActionId` 单调且跨 owner 唯一；坏档（重复 actionId、owner 非法、combat actions 引用不存在、根存在性与 manifest 不符、镜像不等）在退休旧局前拒绝。
- 无 combat + 骨架：根存在且只有 owner='foundation'；无 combat 无世界能力：无根。

物品：
- 26 字母背包与 stack 99、拆 stack/合并、满包、工具不堆叠、FOOD 按 quantity 占格（N 份口粮 N 格）、制造的 dagger/armor/ration 与自然物品不可区分并按原生合并；D9 各拒绝入口 0 成本；MATERIAL 坠落/深水/偷取沿原生；枚举器顺序与覆盖（每类根至少一件）；双 owner 坏档拒绝；预算 `8192−1024` 边界（等于/超出 1）且原生生成不被拒；load 只查 C5 自有根。

世界根与放置：
- `c5-place-v1` 固定向量、候选资格（D8，含秘密门后不可选）、maxPerDepth/maxPerRun、skip/defer 唯一收据、defer 下一次入层重试一次；原生 RNG 计数不变；giants reservation 不被占。
- 节点再生：0/1/interval−1/interval/多倍 interval、满容量清余数、跨 save/load/seek 一致、物化不递增 revision；prepare 虚拟物化 = commit 写入（D7）。
- 启动礼包：全部入包 / 部分落地 / 全部跳过三种收据；load/replay 不补发；每 owner 一次。
- interactable 子预算 832 与全局 1024 边界；remains 随第一个箱预建。
- `regions` 键：从无 regions 的世界经过全部 C5 放置/移除路径后仍无该键；`setOwnedRegions(world, [])` 删除键并 save/load 往返（D14）。

工作：
- harvest/craft/place-station/cancel-work 四命令的成功路径与每种拒绝码（STALE、PLAN_USED、BUSY、WRONG_LEVEL、DISTANCE、THREAT、TOOL、INPUT、CAPACITY、RESOURCE_EMPTY、RESERVED、BUDGET、SCOPE、BAD_PAYLOAD、DISABLED 等），全部 0 成本；伪 actorId/错误 owner/过期 revision。
- 确认 Yes/No（D6）：No 记录一条命令、世界与两流不变、不耗 planId；实时与 replay 一致；确认期间状态变化导致重 prepare 不等 → `C5_STALE`。
- 多批 auto_work：1/2/16 批；每批一条录制 `auto_step`；中途 save/load/seek 在批间与批中（bundle 中）恢复；各停止原因（敌人出现、受伤、HP 下降、离层、工具破损、节点耗尽、玩家任意输入）在录制命令内取消并退款一次；bundle 中被打断（伤害/威胁）不产出不扣耐久。
- **回血/饥饿现状固化**（D15）：单批 10000 tick 只回血一次、饥饿按 100 次客观块扣；同总时长拆成 10 批的对照数值写入报告。
- 参与者：接收/批完成/取消/放置/启动各注入异常与 Promise → 回滚语义符合 §9.1(g)；批完成失败改走取消且 bundle 不卡。
- 失败注入：在 ID 分配、扣料、escrow、输出创建、耐久、事实、消息、预算各发布点注入，完整对象图恢复。
- NPC fixture：一次原生自由决策一个 bundle、无双重 prelude、正耗时一次。
- stopAutoTravel 审计（§2 5A2e 第 5 条）。
- 篝火：combat 篝火与世界工作同局共存，互斥（BUSY），各自收据正确。

SDK/harness：
- 类型：`worldSdk.ts` 不导出可信入口（类型测试 + 运行期 `Object.keys` 断言）；DTO 深冻结；prepare 外调用 plan* → `C5_SCOPE`。
- 骨架模块经 harness 跑完整闭环：启动礼包 → 采集 → 放台 → 多批制造 → 取消 → save/load/replay/seek/续录，`replay().ok===true`；人为制造一次分歧，`firstMismatch` 指向首个可验证分歧命令。
- 构造期：缺 `worldSdk`、`worldSdk: 2`、action 同时在 `commands` 与 `worldWorkCommands`、坏定义包 → 运行时构造失败且兼容诊断 i18n。
- 生产包不含 harness/骨架。

## 6 预计改动的共享文件

`src/ext/types.ts`、`runtime.ts`、`descriptor.ts`（`worldSdk` 白名单）、`compatibility.ts`、`fingerprint.ts`、`actorActions.ts`、`actorActionValidation.ts`、`worldRest.ts`、`world.ts`（interactable 子预算、`setOwnedRegions`）、`world5.ts`（新根校验）、新 `src/ext/worldSdk.ts`、新 `src/ext/testing/**`；`src/ext/modules/combat/**`（state 去 scheduler/nextActionId、production、bonfires、descriptor 版本）；`src/engine/Core/Game.ts`（ext:command 分支、auto_work、stopAutoTravel 审计、入层放置/启动礼包）、`ActorActionProduction.ts`、`ActorActionScheduler.ts`、`ActorActionScope.ts`、`ActorActionAuthority.ts`、`PhasedAttackProduction.ts`、`WorldRestProduction.ts`、`WholeRunSnapshot.ts`、`EntitySnapshot.ts`、`GenerationCoordinator.ts`（仅首访放置/启动礼包调用点，不改生成）、`RecordingDigest.ts`（actorActions 域）；新 `src/engine/Core/WorldWork*.ts`（票据/事务/放置/枚举器，命名自定并在报告列出）；`src/engine/Items/Item.ts`、`Inventory.ts`、`ItemLoader.ts`（只加固定装配，不改 spawn）、`ItemUseCoordinator.ts`（D9）、物品详情/背包 UI 相关文件；foundation locale；`scripts/u03-state-contract.json`、`scripts/recording-digest-contract.json`、`scripts/test-suites.json`、`scripts/check-module-boundaries.mjs`。

- 若 giants 的状态/测试只因 scheduler 迁出而改变前提，按 AGENTS 规则做单变量反事实后只修前提。
- 因版本外壳变化需要更新的 fixture/黄金：先归因到具体字段，按原捕获方法重录并逐字段登记；UR2/UR3/UR4 预期仅外壳变化。

## 7 门禁（开发期相关功能，P5-D14=A）

环境：`export PATH='/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':"$PATH"`（Node **24.19.0**），`export NODE_OPTIONS=--max-old-space-size=3072`，vitest 统一 `--maxWorkers=2`。每个子里程碑停下前跑与之相关的部分，最终全部跑：

1. `node scripts/check-module-boundaries.mjs`
2. `npx vue-tsc -b`
3. `npm run build`
4. 本步新增全部测试 + 直接受影响测试：combat 全部自有测试（bonfire/runtime/parry/dodge/phased/recording/combinations）、giants 涉及身体动作/录像/自然 trace 的测试、`u_01*`（实体字段审计）、`u_03_whole_run_snapshot`、`u_03b_level_travel`、`u_27_recording`、`x2a_recording_checkpoint`、`x3b_*`、`u_r2/u_r3/u_r4_trace`、`ext_recording_v4_*`、`ext_world5_*`、`ext_foundation*`、`ext_compatibility_diagnostics`、`ext_module_composition`、背包/物品详情/ItemUse 相关测试（grep `packCount`、`stacksWith`、`ItemCategory` 定位并在报告列出）、`main_menu_replay_seek`、`perf_2_replay_cadence`。
5. 真实组合 smoke（engine-only）：空、growth/narrative/combat/giants 各单独、四模块全开、骨架单独、骨架+combat、骨架+combat+giants、骨架+四模块全开、`c5fixture` 单独；每组新局/游玩/save/load/逐条 replay/seek/续录，含世界工作的组合至少跑一次多批 auto_work。
6. 录像 P95：沿 5A1-R 方法复测“每条命令新增成本 P95”（经典 control、0 营地扩展局、骨架工作局），与 5A1-R 数字并列；超过 5A1-R 已确认阈值则按合同 §10.2 回退顺序处理并如实报告。
7. 若触及生成行为（预期不触及）：`npm run test:drift`。

不跑完整 `npm test`、全部 `test:ext`、removal 删除矩阵（留 5Z）。失败先单变量归因：真实缺陷修生产代码补回归；过时前提给出旧前提/证据/最小调整；不加 skip、不放宽有效断言、不延长超时。

## 8 交付

- 代码与测试（**不 commit**），以及 `docs/ext/phase5a2.report.md`：
  - 基线 commit、§0 核对结果与实际行号、最终版本表（§1 D1 每项实际值）、U03/实体字段/摘要域新登记清单。
  - 逐子项 done/not-done（5A2a–f 每个要点），未完成写原因；合同未定、本步自定的内部细节列表（模块/文件命名、事务实现方式等）。
  - stopAutoTravel/autoAction 审计表（每处：实际行、函数、A/B 分类、调用链证据、处理、对应测试）。
  - 每条门禁的实际命令、退出码、文件/用例数、耗时；失败与修复；真实 skip/todo 来源。
  - 重录 fixture/黄金逐字段归因表。
  - D15 回血/饥饿对照数值。
  - **5B 派发冻结清单**（§2 5A2f 最后一条），以及“交接给 5A2-S”的事项：combat 已分配版本号、actors 行中待 5A2-S 迁移的 `combatStats`、不得改动的 C5 DTO 清单；“交接给 5A3”的事项：`setOwnedRegions`、interactable 子预算余量、工作位/交互线的现有实现位置（5A3 必须保持逐格不变）。
  - 未覆盖项（真实浏览器 UI、最大状态长局、5Z 门禁）明确标“未验证”。
- 原始日志、测量 JSON 放仓库外（`/private/tmp/...`），报告只引路径与摘要。
- **不要 commit，不要 push，不要修改 `docs/ext/README.md` 以外的阶段文档**（README 仅可在报告完成后追加一行 5A2 状态与报告链接）。
