# 小队 P0：单人假设审计与 P1 拆分

> 2026-10-08。执行范围：[P0 任务书](party-p0.task.md)；设计依据：[小队与多人联机设计](party-multiplayer-design.md)。只读源码，只新增本文与[合同草案](party-contract.md)，未改代码、测试、数据，未 commit。

## 1 结论与基线

P1 不能通过“给盟友加控制者 + 切换 Game.player”完成。当前 actorActions 提供多 actor 阶段动作能力，但时间循环、原生命令、Player 能力、物品根、需求组件、SDK 与录像仍有独立的单主角入口。迁移要先建立 actor 能力/所有权与时间边界，再接窗口与 UI；P1a 也必须包含最小的多成员就绪调度，不能完全留到 P1b。

本次 HEAD 为 `7ec0ca0964c822c026c0077b5d6f68477923f1c5`，分支 `ext/party-design`；开工工作区干净。任务书所述 `769f6fc` 是分支来源；两者仅相差设计稿与任务书两份文档，源码一致，本报告证据绑定实际 HEAD。当前源码为 foundation 10 / whole-run 6 / recording 4 / origin 2（`src/ext/descriptor.ts:5`、`src/engine/Core/RecordingV4.ts:70`）；`docs/architecture.md` 的旧 version 2 概述不用于格式裁定。

已读 AGENTS、HANDOFF、development、architecture、已批准设计与任务书；补读阶段 5 合同、世界/采食设计、状态交接和有关源码。`docs/ext/README.md` 的一般政策放弃经典零影响，但此次已批准小队设计 §5.2/§12 和用户给出的 AGENTS 明确要求零影响，本任务按后者执行，不据旧通用政策放宽。纯设计只做文档/清单/声明检查，不将未执行的功能门禁写成通过。

阶段 5 状态文档记录 5C1 已验收，5D/5E/Worker/5Z 尚未开工，5G 在隔离返工链；这些是所读文档的状态，**未远程核验其他工作树最新进度**。本树没有生产 `foraging` 目录，不将未来包当作已装模块。P1 必须等待最终 5Z 基线后重扫，当前结果不是可直接 cherry-pick 的实现清单。

## 2 覆盖方法与计数口径

机器可读清单：`/private/tmp/party-p0/inventory.json`。复现工具、输入 SHA 清单、汇总、提取的 TS 声明与检查记录均在同目录，未放入仓库。

- 扫描 `rg --files src` 的全部 1125 文件，含生产 TS/Vue、测试/支撑夹具、JSON/文本；没有只扫 Game 或跳过模块自有测试。
- 生产 TS 和 Vue script 用 TypeScript AST；枚举大小写不敏感的 player 标识符/字面量（含参数、类型、`isPlayer`、`instanceof Player`、`playerId`、方括号键），补注册的玩家专属状态读写和 Player 自身字段。局部别名按编译器符号传播，避免把两个作用域的同名变量算成同一别名。另提取 Game 内部直接依赖 this.player 的 223 个方法，枚举其同名调用点，记录 dependency 来源；这是保守调用候选，异类对象同名方法需排除。
- Vue template、注释/字符串残余、资源文本单列，不冒充生产 AST。全部 U03 的 127 个状态字段另有 `stateFields` 归属账；未含 player 字样的关键调用链以 `semanticSites` 补充 32 个定位点。
- 每个 occurrence 含 `id/file/line/column/offset/symbol/context/kind/scope/category/rule/review/text/migration/risk`；每条原始 `this.player/game.player` 命中反向关联清单 ID。生产按一个主类别 A/B/C/D 去重计数；实际一个语句可同时涉及 C 状态和 D 终局，按具体迁移链联合审查。
- 分类为**可复现的规则初分 + 32 处关键执行路径人工复核**，不是宣称逐一人工证明几千条语句。宽口径包括 API 声明、派生值、纯函数与可能无需修改的兼容分支。例如 growth 奖励拆分中的局部变量 `player` 不是一条新缺陷，仍保留 C 标签供奖励分配审查。预计改动量与命中数不能相加或画等号。
- 覆盖保证限于声明的 AST/词法集合、注册全局字段与所列语义链；通用 Creature 参数跨函数传播、动态反射、运行时插件行为不能由此证明穷尽。P1 改每条 actor 调用链时仍须核对所有消费者，尤其没有 player 名称的 status/effect/owner 接口。清单无静默未分类行；不能把这一点说成形式化证明“所有单人假设都已消除”。

原始 `this.player/game.player` 文本命中 **4119**：生产文件 **1511**、测试及测试支撑 **2608**。生产文件命中也可能位于注释，故称文本命中。设计稿“约 2200”的范围主要覆盖 Core/ext/components/Combat/Map/UI，并混入模块自有测试；相同六类路径本树为 2237 处，其余大多在 `src/test`、entities、ui。不能用 2200 作为生产修改点预算。

生产扩展审计索引包含 **9048 个 occurrence / 5571 个去重源码行 / 158 个文件**；另保留测试 **19462**、文本残余 **518**、资源候选 **71**。所有 4119 条原始直接命中都关联到了分类行；AST 解析错误 0。分类总量见下表（扫描候选，不是缺陷数量）：

| 主类别 | occurrence | 含义 |
|---|---:|---|
| A | 1198 | 焦点/显示 |
| B | 1078 | 全队共享/世界枚举 |
| C | 5732 | 按成员/actor 能力 |
| D | 1040 | 终局/录制/持久生命周期 |

### 2.1 子系统分布与改动量估计

改动量指 P1a–d 合计的初步生产行数范围（含新适配器，不含测试/新模块数据），不是测量结果或工作承诺；重叠文件只在总估计中去重。总量暂估 **4000–8000 行、70–110 个现有文件**，另新增 party/调度/codec 文件；先按里程碑收敛，不能按命中数机械替换。

| 子系统 | A | B | C | D | 合计 | 预计改动量/重点 |
|---|---:|---:|---:|---:|---:|---|
| `src/App.vue` | 9 | 0 | 0 | 5 | 14 | 约20–50行；装配/焦点 |
| `src/components` | 343 | 14 | 0 | 31 | 388 | 250–600 行；组件绑定 |
| `src/engine/Combat` | 31 | 33 | 406 | 3 | 473 | 350–700 行；双解算器及法术归属 |
| `src/engine/Core` | 104 | 474 | 4510 | 929 | 6017 | 1800–3500 行；调度/命令/持久化主风险 |
| `src/engine/Generator` | 0 | 22 | 0 | 0 | 22 | 50–150 行；入口/全队落点 |
| `src/engine/Items` | 0 | 32 | 72 | 0 | 104 | 100–200 行；actor 参数 |
| `src/engine/Map` | 0 | 7 | 160 | 3 | 170 | 150–350 行；多源感知/安全图 |
| `src/engine/Movement` | 0 | 38 | 46 | 0 | 84 | 150–350 行；占位/换层 |
| `src/engine/Stats` | 0 | 8 | 8 | 2 | 18 | 30–100 行；来源事实 |
| `src/engine/UI` | 234 | 60 | 0 | 6 | 300 | 100–250 行；上下文 DTO |
| `src/entities` | 0 | 338 | 138 | 1 | 477 | 450–900 行；能力/敌对目标 |
| `src/ext` | 0 | 43 | 157 | 16 | 216 | 250–500 行；SDK/manifest/codec |
| `src/ext/modules/combat` | 54 | 0 | 19 | 11 | 84 | 模块每包约50–200行；创建/资源/命令或UI适配 |
| `src/ext/modules/crafting` | 2 | 0 | 0 | 3 | 5 | 模块每包约50–200行；创建/资源/命令或UI适配 |
| `src/ext/modules/giants` | 3 | 0 | 0 | 0 | 3 | 模块每包约50–200行；创建/资源/命令或UI适配 |
| `src/ext/modules/growth` | 185 | 4 | 177 | 5 | 371 | 模块每包约50–200行；创建/资源/命令或UI适配 |
| `src/ext/modules/narrative` | 1 | 0 | 39 | 8 | 48 | 模块每包约50–200行；创建/资源/命令或UI适配 |
| `src/ext/modules/settlement` | 2 | 0 | 0 | 3 | 5 | 模块每包约50–200行；创建/资源/命令或UI适配 |
| `src/ui` | 230 | 5 | 0 | 14 | 249 | 150–350 行；输入/投影 |

### 2.2 四类代表、迁移与风险

| 类别 | 代表位置 | 迁移方式 | 风险 |
|---|---|---|---|
| A 镜头/显示 | `src/components/GameCanvas.vue`、`src/ui/displayProjection.ts`、`src/engine/UI/ItemDetailContext.ts`（逐处行号见附录/JSON） | 独立 Focus/成员显示 DTO；输入提交时固化 actorId；渲染共享可见并集 | 镜头切换触发发现、目标选择串人、显示回调改变实质 RNG；不能把全部 UI inputState 排除录像 |
| B 全队共享 | `src/entities/Monster.ts:68`、`src/engine/Core/Game.ts:3239`、`src/engine/Map/SafetyMap.ts:132` | 阵营/目标集合、独立感官后合并知识、多源气味/安全图；统一实体注册 | 怪物只追队长、借用别人的感官攻击、身体/成员重复调度、错误通行缓存 |
| C 按成员 | `src/entities/Player.ts:30`、`src/engine/Core/TimeCoordinator.ts:311`、`src/engine/Core/WorldWork.ts:161` | actor 原生命令/背包/装备/需求/资源/确认；规则私有状态由 actorId 索引 | 饥饿和状态扣四遍或漏三人、两次收费、物品重根、busy 入口绕过、奖励全给队长 |
| D 唯一主角语义 | `src/engine/Core/RecordingDigest.ts:20`、`src/engine/Core/RecordingV4.ts:45`、`src/engine/Core/Game.ts:14803` | 全队终局、成员实体图/录像批次、按能力有效 codec | 队长死即结束、存读丢队友、窗口内部动作双重重放、升全局号破坏零影响 |

A 不是“所有视野都跟焦点”：探索记忆、看见敌人的打断状态属于 B/持久控制状态；C 成员死亡与 D 全队失败分两步；B 留守层所有权与 C 身上冻结计时也应拆开。

## 3 关键执行路径审计

下面的定位点也作为 JSON `semanticSites` 交付。严重性表示**不迁移就实现多人时的风险**，不是声称现有单人玩法有这些 bug。

| ID | 类别/风险 | 当前执行位置 | 迁移要求 |
|---|---|---|---|
| S01 | C/S1 | `src/engine/Core/TimeCoordinator.ts:123` | 队长就绪条件限制全世界循环；改按全部可调度成员与窗口边界推进 |
| S02 | C/S1 | `src/engine/Core/TimeCoordinator.ts:311` | 每成员营养、免疫与回合恢复保留各自时间域，环境块只执行一次 |
| S03 | C/S1 | `src/engine/Core/Game.ts:3582` | 外层录制锁拒绝递归命令；内部 actor scope 共用提交而非交换 player |
| S04 | B/S1 | `src/engine/Core/Game.ts:3239` | 独立感官及照明计算后取全队合法并集；焦点不能写知识或改 RNG |
| S05 | D/S1 | `src/engine/Core/Game.ts:11511` | 目标/物品命令解释状态缺 actor；不能把全部 UI 状态排除摘要 |
| S06 | D/S1 | `src/engine/Core/Game.ts:14803` | 成员死亡与全队终局分离；结算背包根去重 |
| S07 | C/S1 | `src/entities/Player.ts:30` | 能力抽取：库存、装备、nutrition、恢复与 Player 子类门禁 |
| S08 | B/S1 | `src/entities/Monster.ts:68` | 阵营与目标集合包含成员，混乱/俘虏规则继续生效 |
| S09 | B/S1 | `src/entities/Monster.ts:1580` | 敌人默认攻击主角：目标改显式成员，伤害反馈与死亡要同迁 |
| S10 | C/S1 | `src/engine/Combat/Combat.ts:205` | 原生与扩展解算器内的装备/符文/攻击资格是 actor 能力，不是焦点 |
| S11 | C/S1 | `src/engine/Core/ActorActionAuthority.ts:73` | source===player 与 player-command/npc-scheduler 二选一需要成员命令授权 |
| S12 | B/S1 | `src/engine/Core/ActorActionProduction.ts:47` | 实体注册和层归属去重；成员只计时一次 |
| S13 | B/S1 | `src/engine/Core/ActorActionScheduler.ts:90` | 离场层 action countdown 已冻结；不是多活动层能力 |
| S14 | B/S1 | `src/ext/actorQuery.ts:6` | actorId 全图闭包和 body 核心规则需要保留；成员不复制实体 |
| S15 | C/S1 | `src/engine/Core/WorldItemRoots.ts:30` | 遍历所有成员背包；物品唯一 owner、交易/掉落不复制 |
| S16 | C/S1 | `src/engine/Core/WorldWork.ts:161` | 工作票据原生输入的 player gate 需按实际 actor 验证 |
| S17 | C/S1 | `src/engine/Core/ActorNeeds.ts:96` | 现同伴需求排除 player 且参数 Monster[]；复用前须统一唯一饥饿账 |
| S18 | C/S1 | `src/engine/Core/WorldRestProduction.ts:40` | 休息的资源和 source revision 绑定队长；全员在场并逐成员恢复 |
| S19 | C/S1 | `src/ext/runtime.ts:782` | 只读 SDK/奖励/技能入口有隐式 playerId，不是只替换 Game 引用 |
| S20 | C/S1 | `src/ext/modules/growth/module.ts:459` | 首访、鉴定和击杀奖励目前可只授予 state.playerId；参与分配去重 |
| S21 | B/S2 | `src/engine/Map/SafetyMap.ts:132` | 安全图单源且能力来自玩家；按目标/能力缓存或多源重建 |
| S22 | B/S2 | `src/engine/Map/Scent.ts:67` | 单一气味时间与源，经调用者迁为多成员追踪策略 |
| S23 | D/S1 | `src/engine/Core/RecordingDigest.ts:20` | 全局 foundation 常量入摘要；直接升号违反禁用小队字节不变 |
| S24 | D/S1 | `src/engine/Core/RecordingDigest.ts:336` | 知识投影需要遍历所有成员并处理别名 |
| S25 | D/S1 | `src/engine/Core/RecordingV4.ts:45` | 事件仅有主角诊断；批次 trace/party 域需要新版本 |
| S26 | D/S1 | `src/engine/Core/WholeRunSnapshot.ts:188` | 按能力选择有效 codec，成员图与留守层快照不可遗漏 |
| S27 | B/S1 | `src/engine/Systems/Time.ts:20` | 单例输入时间簿记不等于可供多成员推进的客观时钟 |
| S28 | D/S1 | `src/engine/Random.ts:237` | 预演需隔离全局 RNG，而非只 load 主局 JSON |
| S29 | A/S2 | `src/engine/Systems/Logger.ts:253` | 显示单例兼有 disturbed/确认副作用；预演和焦点投影须隔离 |
| S30 | D/S1 | `src/engine/Core/Endgame.ts:16` | 纯函数的 items 参数也有唯一背包前提，由调用处改为队伍集合 |
| S31 | D/S1 | `src/entities/Creature.ts:46` | 预演新建实体消耗全局 allocator，快照恢复不能假定无副作用 |
| S32 | B/S2 | `src/engine/Lighting/FOV.ts:22` | 纯算法可复用；Game 单源调用与共享记忆的写入顺序才是迁移点 |

### 3.1 时间、同 tick 与多阶段动作

`TimeCoordinator.advancementLoop:123` 的 while/soonestTurn 起点仍是 player；`183` 主角 HP 归零直接退出；`208` 只有 busy 的 player 才进到期 actor 列表。`playerTurnEnded:425` 包括玩家 prelude、气味、搜索、强制状态及恢复，不是可对每个成员调用的通用 world step。`ActorActionAuthority:73` 将来源权限硬分 player-command/npc-scheduler；`Game.executeCommand:3584` 的执行锁拒绝递归调用。因此“已有 actorActions 支持长动作”只说明能复用相位/倒计时，不说明多人就绪调度已经完成。

本地只读参照 `/private/tmp/BrogueCE-master/src/brogue/Time.c:2643–2660` 实际同样按 player 定最近事件并每 100 tick 更新环境；没有从注释推断另一套时间队列。未抓取最新官方 CE，也未宣称完成 CE 版本差异审查；P0 对多人部分是在批准设计下定义扩展合同，不能称 CE 自带多人规则。

### 3.2 所有权、离层与模块 SDK

`WorldItemRoots:30` 只遍历主角背包，NPC 是 carriedItem；`WorldWork:161/333` 有公开命令只能操作 player 的限制；`ActorNeeds:96` 排除 player，且参数是 Monster[]。多个模块已有通用 actor 组件，但 `runtime.getPlayerComponent`/playerId、growth 首访与鉴定奖、narrative 的 optional-player 条件和奖励仍有玩家单例语义。必须一起迁移 DTO/权限/查询和写者，不能只更换调用处的 `game.player`。

`actorQuery` 已处理 carried/leader 闭包与身体核心，`ActorActionScheduler` 已有离场层冻结；可借用所有权校验，不能把“Monster[] 中多一个盟友”当成同时支持多背包或多活动层。留守、转居民、重新编入必须互斥事务；5D 的日粮和 foraging 需求不应重扣同一资源。

### 3.3 两个需前置验证的设计难点

1. **零影响与版本**：`RecordingDigest.codecIdentity` 直接读全局 foundation 常量；严格执行设计“无 party 字节不变”需要按能力选择有效 codec/manifest，不是全局常量加一。草案 §6.3 写明双身份方案及替代方案需变更合同的边界。
2. **预演与确认**：全局 rng/logger/time/allocator 以及命令 generator 不等于 whole-run JSON。草案要求隔离预演和可序列化待决阶段；若用 loadSnapshot 回滚主局，必须证明这些对象全部恢复，否则会污染 RNG/日志/录像。确认段保存/重放需要真实 DTO，不可只保存 token。

另一个性能风险是每窗 full digest。已有 5A1 历史记录的完整边界耗时达到数百毫秒，大状态代理可达秒级；“房主命令锁步”不自动意味着窗口交互已满足延迟目标。P1b 先测量，不把主线程流畅作为已实现能力。

## 4 P1 分步建议与门禁

### P1a 多成员底座（先做最小就绪调度）

范围：party 惰性生命周期/成员 ID/控制者与焦点；actor 能力（背包、装备、需求、原生命令、状态、死亡）；敌方目标/阵营与占位；共享合法视野/知识；换层/留守/强制坠落；全队终局；最小“到最近成员就绪点等待输入”调度。建立单步 actor 录制与成员快照/摘要，codec 一次分配，不等 P1b 才补保存。招募先开局两成员闭环，俘虏/叙事/营地适配分阶段接入但不改变已批准来源方向。

主要共享文件：Game、TimeCoordinator、Player/Creature/Monster、Combat（两解算器）、ActorActionAuthority/Production/Scope、CreatureSpatial/Placement、PlayerTravel/LevelTravel、WorldItemRoots/WorldWork/ActorNeeds、EntitySnapshot/WholeRunSnapshot/RecordingV4/RecordingDigest/RecordingFormat、ext/runtime/types/world、U03/摘要/测试清单、i18n。第一子步冻结 actor API 和 codec，再批量迁移消费者；一个共享文件主笔。

验收：真实命令两人完成一层；双方拾取/装备/吃食/投掷/交易、双方独立受伤/状态/恢复；交换失败无副作用；主角死亡后另一人继续；全灭一次终局；场外幸存者恢复；上下楼拒绝/留守/坠落；冷却/忙碌不可越权；存读/seed replay/seek/续录完整成员/物品根/双 RNG 一致；同一原生动作人工与成员适配执行等价。classic 和无 party 的配对基线逐字节/对象形状保险不可省。

门禁：**全量档**（时间/RNG/存档/录像改变），相关真实模块组合、所有源码守卫、U03/黄金 trace 与单成员兼容保险；不采用“只改接口所以轻档”。

### P1b 窗口推进、打断与预演

范围：100/300/1000/精细/自动档；批次接受、队列续行、同 tick 安全打断、所有控制/选择事件、窗口末摘要、隔离已知世界预演。模块策略先简单 wait 或人工计划，避免把复杂 AI 和时间错误混在一起。

主要共享文件：Game 命令/确认/录制、TimeCoordinator、ActorActionScheduler/Production、PresentationObserver、Recording*/WholeRunSnapshot、UI inputState/命令适配与新增窗口协调器；可能涉及 Worker/引擎实例隔离，先与 5Z 的摘要优化协调。

验收：速度 25/50/100/200/400 的成员，同 W 实际行动数/时间守恒；W=100 边界 99/100/101、阶段释放与环境同 tick；快者多动、慢者跨窗，无队长速度绑定；每类打断、软反应与硬停优先、去重锁存、两个成员同时受伤；确认“否”、过期选择、两段保存/seek；交换/目标竞争实际先后；零耗时恶意队列有界；焦点不同输入批次相同结果；预演前后主局对象/双 RNG/allocator/录像前缀相同，隐藏世界变化不改变已知预演。

门禁：**全量档** + 长动作/多格/NPC 同 tick 回归、窗口事件 tamper/重复/丢序/OOS 区间 + 本报告预算测量。精细档也必须绑定显式 actorId。

### P1c AI v1 与队长指令

范围：五档策略/三个开关/五类队长指令、托管/接管下个行动点生效；party-only 无其他模块闭环；成员与原生同伴两种适配。growth/物品使用只是可选能力，不硬依赖 combat/foraging。

主要共享文件：以新增 party 模块为主；必要共享修改仅 actor 原生命令/已知视图/DerivedDraw 端口、Monster 指令入口、runtime 可选查询。此时不再扩大 P1a 的大范围状态迁移。

验收：两名托管成员经真实命令走完固定简单层；阻路/无法到达/未知药水/未鉴定陷阱/队友受伤/消耗品阈值；不会重复调用原生 ally AI；忙碌时接管不取消后摇；同 seed/批次/配置/ordinal 决策一致，新增策略取样不动原生双 RNG，实际攻击仍正常取骰；无可选模块与软组合 smoke；模块实际删除。

门禁：至少中档及扩展边界/删除；实际预计改变 actor 调度和录像控制状态，按 **全量档** 安排，不在实现后用“AI 仅纯函数”降低。

### P1d 平衡与 UI

范围：4 人规模约束、成员数缩放、少量消耗品增量、参与 XP 分配、共享掉落；成员栏/计划层/窗口控制/打断提示/托管面板/角色创建与逐步招募入口；320/390 与桌面。具体缩放表/XP 权重进入配置和规则指纹，不能以 P0 的预算替代平衡数值裁决。为每名成员分别适配 growth/narrative/combat/营地 UI；任何 UI 操作先绑定 actorId。

主要共享文件：App/GameCanvas、Sidebar/InventoryOverlay/DetailPanel、ui 输入/投影/布局、模块 UI 插槽、原生生成贡献入口和测试清单；party 数据/locale；growth 奖励或营地招募通用端口按 P1a 合同接。

验收：真实浏览器键鼠/触屏、四地图模式、普通/沉浸、320/390/桌面；长名/4 人满背包/计划遮挡/模态锁定/焦点死亡；缩放按冻结的成员数口径（不是在线人数），掉线不改变生成；场外成员是否计入缩放须任务书固定；资源/XP 守恒；模块组合与删除；四人完整一层存读/录像/seek 自然闭环。模拟触摸与真机证据分列。

门禁：纯 UI 子提交轻档；**P1d 整体验收全量档**（生成/奖励/资源规则变化）+ 浏览器与体积报告。

### 4.1 完整命令与验收归属

依此次 AGENTS/development 的全量档：先 `npm run ce:fetch`，然后 `npx vue-tsc -b`、`npm run build`、`npm run test:full`、`BROGUE_REQUIRE_CE=1 npm run test:gen`、`npm run test:drift`；另跑 `npm run test:ext`、`node scripts/check-module-boundaries.mjs`、相关真实组合/删除检查及窗口特有验收。日常 smoke 不能替代这些完整退出结果。若维护者为 P1 单独批准阶段式门禁，按新任务书记录，不从阶段 3/5 的历史豁免推断 P1 已获豁免。

生成/黄金变化仍按此次 AGENTS 做单变量归因及原捕获重录；旧测试只修前提需反事实；守卫不得直接削弱。新增测试登记唯一套件归属，新 Game 状态登记 U03 与摘要域。测试和推送分离；P0 本次不运行上述功能门禁，也无推送。

## 5 阶段 5 冲突与合并顺序

| 阶段 | 共用风险 | 对 P1 的约束 |
|---|---|---|
| 5C1 地牢营地 | Game 命令锁、world work/箱子/起始储粮、UI 输入、人物当前位置 | 接收最终真实命令入口，交换/建造用执行成员；不能用焦点换 player 暂时兼容 |
| 5C2 可选 site | LevelRef 贯穿 region/world/spatial/action/实体 codec | 若 5Z 前纳入，P1 直接接正式 LevelRef；未纳入仍不硬编码 depth=0。该可选步骤不作为无限等待理由 |
| 5D1/5D2 居民/离线 | ActorNeeds/Departure、SDK DTO、world5 离线结算、居民日粮/工作/快照版本 | 同一 actor 不能既成员冻结又居民补算；SDK/DTO 和版本先合入，再写招募/身份转换适配 |
| 5D3 叙事招募 | actor 固定绑定、奖励/招募收据、interaction gate | 使用已冻结的唯一身份/收据，不复制 NPC 到新 Player 造成一人两份 |
| 5E 防御袭击 | Monster AI/阵营、结构损伤、警报、在离场规则、actorActions | 全队敌对/可见打断不能绕过袭击所有权；不创建独立离场战斗时钟 |
| 5G foraging | 当前不在本树；需求/喂食/派生抽样/可选模块组合 | 合入 5Z 实际包再复核 actorNeeds 与原生 nutrition；不直接 import 其数据 |
| 5Z 收尾/摘要优化 | 统一版本/组合/删除、RecordingDigest、Worker 与 full checkpoint 性能 | P1 不抢共享文件，不把当前审计当成 5Z 完成；预算采样用冻结后的真实树 |

建议顺序：阶段 5 各正式验收提交 → 5Z 统一冻结（可选 5C2/5D3 的实际纳入情况写清）→ 在最终树重跑外部审计并登记新增/消失 occurrence → P1a actor/codec/多成员调度 → P1b 窗口/确认/预演 → P1c AI → P1d 平衡/UI → P1 统一全量/组合/真实删除与自然录像 → 再做 P2。P1a/b 共享底座串行主笔，独立 UI 草图或数据提案可提前写文档，不提前改共用源码。重扫以文件+符号+上下文匹配，不只按旧行号认领。

## 6 体积与性能预算（提案，尚未实测）

4 人增加的是可控 actor，不应把整张地图、怪物 AI、world5 离线结算复制四遍。近似成本：`一次世界推进 + Σ成员原生命令/感官 + Σ托管决策 + 一次事件/完整摘要`；安全图/FOV 可每成员计算但共用只读地形索引。

W=1000、每行动最少 25 tick 的示例最多约 `4 × (ceil(1000/25)+1) = 164` 次成员行动机会（计 t0），这是**在最小耗时 25 前提下的容量估算**，不是所有配置的规则上限；零耗时和未来更快规则必须受显式决策预算约束。AI 每步和 FOV 全图重算比“多三个成员 DTO”更可能成为瓶颈。

| 项目 | 4 人预算提案 | 计量边界 |
|---|---|---|
| 窗口编排新增 CPU | W100 P95 ≤8 ms；W300 ≤20 ms；W1000 ≤50 ms | 与相同四 actor/同动作序列的无窗口调度配对，排除原战斗/生成与 full digest；包含队列、打断、AI、视野增量 |
| AI 单决策 | P95 ≤0.2 ms；4 人同一决策波 ≤1 ms；≤4096 搜索展开/人/次 | 冷/热路径分别报告，固定展开预算；164 次上界约 32.8 ms，不能当全窗口实测 |
| party dirty 摘要 | 每段 P95 ≤1 ms、上限 4 ms | 只计新增域；其他域不可漏算 |
| 全世界 full digest | 新增 party 开销 ≤`5 ms + 单人同世界基线的10%`（P95 配对差） | 全量总耗时另报，不能扣掉长尾后声称窗口 ≤50 ms；P2 窗口间总延迟目标待 P1b实测冻结 |
| 主线程可响应 | 可让出的模拟切片 ≤8 ms，手机 ≤12 ms；不能按时间片丢动作 | yield 仅在安全边界，不改变 RNG/排序；同步完整摘要若无法切片需隔离执行/明确卡顿，不承诺已有 Worker |
| party 控制状态 | 紧凑 UTF-8 JSON ≤64 KiB/局 | 含计划尾部/控制/锁存；对已见敌人集合定规模并采用稳定位集或阶段归档，不能无上限增长 |
| 额外三名成员实体/库存 | ≤256 KiB 增量快照 | 必须计装备/组件/嵌套物品，不能只算 MemberState；world 地图仍一份 |
| 窗口事件 | 输入 ≤32 KiB；正常收据 ≤64 KiB，硬上限 ≤256 KiB/段 | 真实 intent trace、确认、摘要、链全计；达到运行预算就安全分段/打断，不能截去已发生动作 |
| 长录像体积 | 以 10000 窗 × 平均实际事件 B 外推；期望均值 ≤8 KiB 即约78 MiB，不含快照 | 32/64/256 KiB 是上限而非平均；10k 快窗不能强称78 MiB。缓存沿有效 codec 的总 64 MiB/128 上限共享，不给每人再开64 MiB |
| 额外驻留内存/包体 | steady heap 增量目标 ≤8 MiB（不含隔离预演的全世界副本）；party UI+规则 gzip增量≤100 KiB | Worker 克隆峰值、无 party 加载量、预演加载量另列，资源素材不在本步 |

这些是提案目标，不是已验证通过的门槛。历史参考 `phase5a1.report.md` §性能记录：0 营地扩展完整边界 median/P95 约 131/316 ms，8 营地代理约 2037/4020 ms，包含部分快照成本且只 8 个边界样本；不是本树纯 hash 或 4 人的测量。它说明每窗 full digest 是 P1b 的先决性能风险。不得把历史普通命令 0.139 ms 的 P95 套用到窗口全摘要。

### 6.1 P1 落地后的测量方法

1. 固定 Node 24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、同机同负载；记录 CPU/内存/OS/HEAD/源文件 SHA、规则指纹与模块集合。配对 1/2/4 人；同地图种子、NPC 数和预置动作。移动空层、拥挤窄路、同 tick 多技能、持续负状态、离场留守各一组。
2. 模块组合至少 party-only、party+combat、party+growth、party+world5 提供者、与实际 foraging/settlement 组合、最终全开；无 party 对照单列。场景覆盖 D1/D4/深层、0/1/8 营地预算状态（区分自然可玩与代理）、最满合法背包/队列/知敌集合。
3. 每个 W 和场景预热 32 窗，采至少 1000 窗或报告实际不足；P50/P95/P99/max、决策数、tick、展开节点、GC、失败/中断分布一起记录。full/chunk/快照至少另收 100 个边界样本，不摊入普通窗口平均数。原生推进、AI、FOV、域投影、canonical/hash、序列化、快照捕获分别计时；性能探针只放外部目录。
4. 真实浏览器记录主线程长任务、输入到计划可见与推进到显示延迟；390/320 手机模拟与真实设备分列。动画开/关都测，纯引擎 CPU 不冒充浏览器帧率。Worker 消息复制、摘要队列等待和端到端延迟均不能漏报。
5. 紧凑 `JSON.stringify` UTF-8 byteLength、可选 gzip、IndexedDB 实写/重读、导出、seek/续录、内存峰值和 GC 后 steady heap。100/1000/10000 窗分层；若只外推就标外推，不能冒充真正存了10000窗。
6. 测量前后校验同输入机械状态、双 RNG 调用计数、trace；延迟注入/yield/不同焦点不改结果。超限优先缓存/减少无效投影/隔离摘要，不能减少规则结算、放宽源码守卫或缩小摘要字段；若改变摘要频率，明确记录 OOS 精度变化并修订合同。

## 7 本次验证与未验证边界

| 检查 | 实际结果 |
|---|---|
| 独立 `rg --json` 直接引用交叉计数 | 4119，与 JSON 的逐文件/行计数一致；全部有反向分类 ID |
| 清单结构/汇总 | 29099 条索引 ID 唯一；9048 生产候选的 A/B/C/D、文件表与子系统表一致；AST 解析错误 0 |
| 语义/状态定位 | 32 个手工复核锚点逐行匹配；127 个 U03 字段全覆盖 |
| 合同声明类型检查 | Node v24.19.0、3072 MiB；提取最终 TS + 正/负类型示例，`tsc --strict --noEmit --skipLibCheck false` exit 0（约1.07s） |
| 输入不变 | 1125 个 src 文件逐 SHA-256 对比开工清单一致；HEAD 未变；git status 仅两份新增文档 |
| 文档检查 | 两份 LF、无尾空白/冲突标记、相对链接有效、TS 提取与文档一致；`git diff --check` exit 0（另对未跟踪文档直接检查） |

完整命令/退出码：`/private/tmp/party-p0/typecheck-run.json`；机器验证：`verification.json`；源码 SHA 清单：`source-before.json`；计数摘要：`summary.json`。本次 inventory 为 **19804167 B**（大证据仅在仓库外），SHA-256 `1af961f4fa46259166d9ea986901fb708208155ffc3123b3d7f5e136e177c79d`；输入清单 SHA-256 `2d54c942bb0061926028bec7d0cf87ed084965fc06203b1369ee935ebebb14aa`。仓库外文件属于本机临时证据，交接前应归档，不假定它们随 git 文档自动传递。

复跑审计及文档声明检查（均不改生产文件）：

```sh
export PATH='/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':"$PATH"
export NODE_OPTIONS=--max-old-space-size=3072
node /private/tmp/party-p0/audit.cjs
node /private/tmp/party-p0/supplement.cjs
node node_modules/typescript/bin/tsc --strict --noEmit --skipLibCheck false --target es2022 --module esnext --moduleResolution bundler --types node --typeRoots "$PWD/node_modules/@types" /private/tmp/party-p0/contract.ts /private/tmp/party-p0/contract-check.ts
python3 /private/tmp/party-p0/verify.py
```

先在仓库根执行；当前源码行与 SHA 绑定上述 HEAD。换基线后应另存旧证据并重做文档提取/统计，不能拿此处旧行号作新版本证明。

没有实现小队，没有运行 npm test/test:drift/test:full/test:gen、构建或浏览器，没有 CE 下载、基线重录、测试前提修订、格式升号或 commit。Node 启动前曾只读检查系统默认版本 v25.2.1；实际外部审计与声明检查均 PATH 前置任务要求的 v24.19.0，堆上限3072 MiB。P0 的类型检查只证明 DTO 声明自洽，不证明能直接替换生产 SDK，也不证明窗口语义已实现。

## 附录 A：全部生产候选文件计数

下面完整列出 158 个生产文件（测试、文本残余与资源见 JSON）。列是 occurrence 主类别；`首处`为清单中该文件的首个定位，更多逐处位置与上下文保留在 JSON。`复核范围`是预计迁移粒度：少量命中也可能承载格式/规则边界，不能据数字跳过。

| 文件 | A | B | C | D | 合计 | 首处 | 复核范围 |
|---|---:|---:|---:|---:|---:|---:|---|
| `src/App.vue` | 9 | 0 | 0 | 5 | 14 | 96 | 局部接线/兼容核对 |
| `src/components/AgentControls.vue` | 7 | 0 | 0 | 2 | 9 | 33 | 局部接线/兼容核对 |
| `src/components/ContextPanel.vue` | 1 | 0 | 0 | 0 | 1 | 14 | 局部接线/兼容核对 |
| `src/components/DetailPanel.vue` | 0 | 0 | 0 | 2 | 2 | 49 | 局部接线/兼容核对 |
| `src/components/GameCanvas.vue` | 185 | 12 | 0 | 5 | 202 | 100 | 系统拆分 |
| `src/components/GameEndOverlay.vue` | 3 | 0 | 0 | 14 | 17 | 15 | 局部接线/兼容核对 |
| `src/components/InventoryOverlay.vue` | 76 | 2 | 0 | 6 | 84 | 20 | 接口/调用链 |
| `src/components/MapTileLegend.vue` | 8 | 0 | 0 | 0 | 8 | 30 | 局部接线/兼容核对 |
| `src/components/ReferenceOverlay.vue` | 1 | 0 | 0 | 0 | 1 | 44 | 局部接线/兼容核对 |
| `src/components/ReplayControls.vue` | 0 | 0 | 0 | 2 | 2 | 25 | 局部接线/兼容核对 |
| `src/components/Sidebar.vue` | 51 | 0 | 0 | 0 | 51 | 7 | 接口/调用链 |
| `src/components/theme/ThemeHud.vue` | 5 | 0 | 0 | 0 | 5 | 6 | 局部接线/兼容核对 |
| `src/components/theme/ThemeNearby.vue` | 6 | 0 | 0 | 0 | 6 | 16 | 局部接线/兼容核对 |
| `src/engine/Combat/ActorCombatResolution.ts` | 0 | 1 | 25 | 3 | 29 | 9 | 接口/调用链 |
| `src/engine/Combat/AttackVerbs.ts` | 0 | 0 | 2 | 0 | 2 | 4 | 局部接线/兼容核对 |
| `src/engine/Combat/BlinkTargeting.ts` | 31 | 5 | 2 | 0 | 38 | 6 | 接口/调用链 |
| `src/engine/Combat/BoltReflection.ts` | 0 | 1 | 3 | 0 | 4 | 4 | 局部接线/兼容核对 |
| `src/engine/Combat/BoltTargeting.ts` | 0 | 4 | 47 | 0 | 51 | 5 | 接口/调用链 |
| `src/engine/Combat/BoltTrajectory.ts` | 0 | 1 | 2 | 0 | 3 | 6 | 局部接线/兼容核对 |
| `src/engine/Combat/Cloning.ts` | 0 | 0 | 5 | 0 | 5 | 40 | 局部接线/兼容核对 |
| `src/engine/Combat/Combat.ts` | 0 | 0 | 173 | 0 | 173 | 9 | 系统拆分 |
| `src/engine/Combat/CombatFormulas.ts` | 0 | 0 | 7 | 0 | 7 | 16 | 局部接线/兼容核对 |
| `src/engine/Combat/CombatText.ts` | 0 | 0 | 31 | 0 | 31 | 5 | 接口/调用链 |
| `src/engine/Combat/Conjuration.ts` | 0 | 0 | 3 | 0 | 3 | 33 | 局部接线/兼容核对 |
| `src/engine/Combat/CreatureFeatures.ts` | 0 | 0 | 1 | 0 | 1 | 17 | 局部接线/兼容核对 |
| `src/engine/Combat/MonsterAbsorption.ts` | 0 | 0 | 2 | 0 | 2 | 111 | 局部接线/兼容核对 |
| `src/engine/Combat/MonsterAI.ts` | 0 | 10 | 20 | 0 | 30 | 6 | 接口/调用链 |
| `src/engine/Combat/MonsterBlink.ts` | 0 | 6 | 33 | 0 | 39 | 4 | 接口/调用链 |
| `src/engine/Combat/MonsterTheft.ts` | 0 | 2 | 49 | 0 | 51 | 2 | 接口/调用链 |
| `src/engine/Combat/Negation.ts` | 0 | 3 | 1 | 0 | 4 | 26 | 局部接线/兼容核对 |
| `src/engine/Core/ActorActionAuthority.ts` | 0 | 4 | 11 | 2 | 17 | 42 | 局部接线/兼容核对 |
| `src/engine/Core/ActorActionProduction.ts` | 0 | 0 | 14 | 2 | 16 | 21 | 局部接线/兼容核对 |
| `src/engine/Core/ActorActionScope.ts` | 0 | 0 | 2 | 0 | 2 | 3 | 局部接线/兼容核对 |
| `src/engine/Core/ActorDeparture.ts` | 0 | 2 | 11 | 0 | 13 | 26 | 局部接线/兼容核对 |
| `src/engine/Core/ActorNeeds.ts` | 0 | 2 | 5 | 0 | 7 | 48 | 局部接线/兼容核对 |
| `src/engine/Core/EdibleCommands.ts` | 0 | 2 | 42 | 2 | 46 | 45 | 接口/调用链 |
| `src/engine/Core/EdibleDefinitions.ts` | 0 | 0 | 7 | 0 | 7 | 115 | 局部接线/兼容核对 |
| `src/engine/Core/EdibleEffects.ts` | 0 | 5 | 55 | 0 | 60 | 7 | 接口/调用链 |
| `src/engine/Core/EdibleValidation.ts` | 0 | 0 | 6 | 0 | 6 | 159 | 局部接线/兼容核对 |
| `src/engine/Core/EntitySnapshot.ts` | 0 | 0 | 0 | 13 | 13 | 9 | 局部接线/兼容核对 |
| `src/engine/Core/FireContact.ts` | 0 | 0 | 14 | 0 | 14 | 57 | 局部接线/兼容核对 |
| `src/engine/Core/Game.ts` | 102 | 349 | 3640 | 631 | 4722 | 76 | 系统拆分 |
| `src/engine/Core/GenerationCoordinator.ts` | 0 | 71 | 0 | 0 | 71 | 144 | 接口/调用链 |
| `src/engine/Core/KindKnowledge.ts` | 0 | 1 | 0 | 0 | 1 | 130 | 局部接线/兼容核对 |
| `src/engine/Core/LevelState.ts` | 0 | 2 | 4 | 0 | 6 | 15 | 局部接线/兼容核对 |
| `src/engine/Core/MonsterLifecycle.ts` | 0 | 0 | 1 | 0 | 1 | 97 | 局部接线/兼容核对 |
| `src/engine/Core/NativeAttackTransaction.ts` | 0 | 0 | 3 | 0 | 3 | 27 | 局部接线/兼容核对 |
| `src/engine/Core/PhasedAttackProduction.ts` | 0 | 8 | 152 | 2 | 162 | 58 | 系统拆分 |
| `src/engine/Core/RecordingDigest.ts` | 0 | 0 | 0 | 31 | 31 | 289 | 接口/调用链 |
| `src/engine/Core/RecordingFormat.ts` | 0 | 0 | 0 | 11 | 11 | 73 | 局部接线/兼容核对 |
| `src/engine/Core/RecordingV4.ts` | 0 | 0 | 0 | 3 | 3 | 22 | 局部接线/兼容核对 |
| `src/engine/Core/StructureProduction.ts` | 0 | 0 | 78 | 4 | 82 | 113 | 接口/调用链 |
| `src/engine/Core/TimeCoordinator.ts` | 0 | 13 | 167 | 21 | 201 | 20 | 系统拆分 |
| `src/engine/Core/WholeRunSnapshot.ts` | 0 | 0 | 0 | 198 | 198 | 4 | 系统拆分 |
| `src/engine/Core/WorldItemRoots.ts` | 0 | 2 | 0 | 0 | 2 | 30 | 局部接线/兼容核对 |
| `src/engine/Core/WorldMaterialTransfer.ts` | 0 | 0 | 53 | 2 | 55 | 47 | 接口/调用链 |
| `src/engine/Core/WorldRestProduction.ts` | 0 | 2 | 59 | 4 | 65 | 40 | 接口/调用链 |
| `src/engine/Core/WorldWork.ts` | 2 | 0 | 97 | 2 | 101 | 147 | 接口/调用链 |
| `src/engine/Core/WorldWorkPlacement.ts` | 0 | 9 | 0 | 0 | 9 | 185 | 局部接线/兼容核对 |
| `src/engine/Core/WorldWorkValidation.ts` | 0 | 0 | 11 | 0 | 11 | 41 | 局部接线/兼容核对 |
| `src/engine/Core/WorldWorkWorld.ts` | 0 | 2 | 78 | 1 | 81 | 45 | 接口/调用链 |
| `src/engine/Generator/GenerationPlacement.ts` | 0 | 2 | 0 | 0 | 2 | 47 | 局部接线/兼容核对 |
| `src/engine/Generator/SideChamber.ts` | 0 | 20 | 0 | 0 | 20 | 138 | 接口/调用链 |
| `src/engine/Items/AggravationScroll.ts` | 0 | 0 | 2 | 0 | 2 | 8 | 局部接线/兼容核对 |
| `src/engine/Items/Item.ts` | 0 | 9 | 0 | 0 | 9 | 211 | 局部接线/兼容核对 |
| `src/engine/Items/ItemLoader.ts` | 0 | 19 | 2 | 0 | 21 | 37 | 接口/调用链 |
| `src/engine/Items/ItemSpawnHeatMap.ts` | 0 | 0 | 4 | 0 | 4 | 217 | 局部接线/兼容核对 |
| `src/engine/Items/ItemUseCoordinator.ts` | 0 | 4 | 64 | 0 | 68 | 8 | 接口/调用链 |
| `src/engine/Map/AutoGenerator.ts` | 0 | 0 | 29 | 0 | 29 | 153 | 接口/调用链 |
| `src/engine/Map/DungeonFeature.ts` | 0 | 2 | 0 | 0 | 2 | 119 | 局部接线/兼容核对 |
| `src/engine/Map/FootprintPathing.ts` | 0 | 0 | 1 | 0 | 1 | 61 | 局部接线/兼容核对 |
| `src/engine/Map/Promotion.ts` | 0 | 0 | 4 | 0 | 4 | 123 | 局部接线/兼容核对 |
| `src/engine/Map/RigidPosePathing.ts` | 0 | 0 | 1 | 0 | 1 | 51 | 局部接线/兼容核对 |
| `src/engine/Map/SafetyMap.ts` | 0 | 0 | 53 | 1 | 54 | 68 | 接口/调用链 |
| `src/engine/Map/Scent.ts` | 0 | 4 | 2 | 0 | 6 | 131 | 局部接线/兼容核对 |
| `src/engine/Map/StructureValidation.ts` | 0 | 0 | 1 | 0 | 1 | 118 | 局部接线/兼容核对 |
| `src/engine/Map/StructureWorld.ts` | 0 | 0 | 34 | 2 | 36 | 60 | 接口/调用链 |
| `src/engine/Map/TerrainCatalog.ts` | 0 | 0 | 12 | 0 | 12 | 91 | 局部接线/兼容核对 |
| `src/engine/Map/TerrainRules.ts` | 0 | 1 | 6 | 0 | 7 | 50 | 局部接线/兼容核对 |
| `src/engine/Map/WallDoorFinish.ts` | 0 | 0 | 14 | 0 | 14 | 123 | 局部接线/兼容核对 |
| `src/engine/Map/WaypointMap.ts` | 0 | 0 | 3 | 0 | 3 | 92 | 局部接线/兼容核对 |
| `src/engine/Movement/AutoTravelVisibility.ts` | 0 | 1 | 4 | 0 | 5 | 2 | 局部接线/兼容核对 |
| `src/engine/Movement/CreaturePlacement.ts` | 0 | 8 | 0 | 0 | 8 | 23 | 局部接线/兼容核对 |
| `src/engine/Movement/CreatureSpatial.ts` | 0 | 29 | 0 | 0 | 29 | 26 | 接口/调用链 |
| `src/engine/Movement/LevelTravel.ts` | 0 | 0 | 26 | 0 | 26 | 95 | 接口/调用链 |
| `src/engine/Movement/PlayerTravel.ts` | 0 | 0 | 16 | 0 | 16 | 6 | 局部接线/兼容核对 |
| `src/engine/Stats/NativeStatSources.ts` | 0 | 8 | 8 | 2 | 18 | 14 | 局部接线/兼容核对 |
| `src/engine/UI/Appearance.ts` | 7 | 5 | 0 | 0 | 12 | 25 | 局部接线/兼容核对 |
| `src/engine/UI/DetailGenerator.ts` | 36 | 1 | 0 | 0 | 37 | 112 | 接口/调用链 |
| `src/engine/UI/ItemDetailContext.ts` | 43 | 0 | 0 | 6 | 49 | 4 | 接口/调用链 |
| `src/engine/UI/ItemDetailIntro.ts` | 3 | 0 | 0 | 0 | 3 | 56 | 局部接线/兼容核对 |
| `src/engine/UI/ItemKnowledge.ts` | 0 | 1 | 0 | 0 | 1 | 5 | 局部接线/兼容核对 |
| `src/engine/UI/MonsterBody.ts` | 28 | 0 | 0 | 0 | 28 | 1 | 接口/调用链 |
| `src/engine/UI/MonsterGroups.ts` | 45 | 2 | 0 | 0 | 47 | 12 | 接口/调用链 |
| `src/engine/UI/MonsterSidebar.ts` | 43 | 32 | 0 | 0 | 75 | 8 | 接口/调用链 |
| `src/engine/UI/MonsterVisibility.ts` | 16 | 18 | 0 | 0 | 34 | 6 | 接口/调用链 |
| `src/engine/UI/MonsterZones.ts` | 8 | 1 | 0 | 0 | 9 | 2 | 局部接线/兼容核对 |
| `src/engine/UI/TerrainColorCatalog.ts` | 5 | 0 | 0 | 0 | 5 | 176 | 局部接线/兼容核对 |
| `src/entities/Monster.ts` | 0 | 338 | 0 | 0 | 338 | 27 | 系统拆分 |
| `src/entities/Player.ts` | 0 | 0 | 138 | 1 | 139 | 2 | 接口/调用链 |
| `src/ext/actorActions.ts` | 0 | 0 | 1 | 0 | 1 | 40 | 局部接线/兼容核对 |
| `src/ext/actorActionValidation.ts` | 0 | 0 | 3 | 0 | 3 | 83 | 局部接线/兼容核对 |
| `src/ext/actorNeeds.ts` | 0 | 0 | 1 | 0 | 1 | 39 | 局部接线/兼容核对 |
| `src/ext/actorQuery.ts` | 0 | 21 | 0 | 0 | 21 | 6 | 接口/调用链 |
| `src/ext/combatStats.ts` | 0 | 0 | 5 | 0 | 5 | 4 | 局部接线/兼容核对 |
| `src/ext/modules/combat/module.ts` | 0 | 0 | 3 | 2 | 5 | 35 | 局部接线/兼容核对 |
| `src/ext/modules/combat/partBreak.ts` | 0 | 0 | 10 | 0 | 10 | 39 | 局部接线/兼容核对 |
| `src/ext/modules/combat/production.ts` | 0 | 0 | 2 | 0 | 2 | 15 | 局部接线/兼容核对 |
| `src/ext/modules/combat/schema.ts` | 0 | 0 | 3 | 0 | 3 | 152 | 局部接线/兼容核对 |
| `src/ext/modules/combat/types.ts` | 0 | 0 | 1 | 0 | 1 | 42 | 局部接线/兼容核对 |
| `src/ext/modules/combat/ui/diagnostics.ts` | 36 | 0 | 0 | 1 | 37 | 24 | 接口/调用链 |
| `src/ext/modules/combat/ui/diagnosticTrace.ts` | 0 | 0 | 0 | 7 | 7 | 46 | 局部接线/兼容核对 |
| `src/ext/modules/combat/ui/useCombatUi.ts` | 4 | 0 | 0 | 0 | 4 | 22 | 局部接线/兼容核对 |
| `src/ext/modules/combat/ui/view.ts` | 0 | 0 | 0 | 1 | 1 | 93 | 局部接线/兼容核对 |
| `src/ext/modules/combat/view.ts` | 14 | 0 | 0 | 0 | 14 | 4 | 局部接线/兼容核对 |
| `src/ext/modules/crafting/ui/useCraftingUi.ts` | 2 | 0 | 0 | 3 | 5 | 30 | 局部接线/兼容核对 |
| `src/ext/modules/giants/ui/view.ts` | 3 | 0 | 0 | 0 | 3 | 16 | 局部接线/兼容核对 |
| `src/ext/modules/growth/module.ts` | 0 | 0 | 150 | 0 | 150 | 31 | 系统拆分 |
| `src/ext/modules/growth/schema.ts` | 0 | 0 | 2 | 0 | 2 | 97 | 局部接线/兼容核对 |
| `src/ext/modules/growth/state.ts` | 0 | 0 | 20 | 0 | 20 | 15 | 接口/调用链 |
| `src/ext/modules/growth/statSources.ts` | 0 | 0 | 3 | 0 | 3 | 31 | 局部接线/兼容核对 |
| `src/ext/modules/growth/types.ts` | 0 | 0 | 2 | 0 | 2 | 109 | 局部接线/兼容核对 |
| `src/ext/modules/growth/ui/useGrowthUi.ts` | 2 | 0 | 0 | 0 | 2 | 108 | 局部接线/兼容核对 |
| `src/ext/modules/growth/view.ts` | 183 | 4 | 0 | 5 | 192 | 15 | 系统拆分 |
| `src/ext/modules/narrative/conditions.ts` | 0 | 0 | 29 | 0 | 29 | 18 | 接口/调用链 |
| `src/ext/modules/narrative/effects.ts` | 0 | 0 | 4 | 4 | 8 | 5 | 局部接线/兼容核对 |
| `src/ext/modules/narrative/module.ts` | 0 | 0 | 0 | 1 | 1 | 49 | 局部接线/兼容核对 |
| `src/ext/modules/narrative/schema.ts` | 0 | 0 | 3 | 0 | 3 | 249 | 局部接线/兼容核对 |
| `src/ext/modules/narrative/sessions.ts` | 0 | 0 | 1 | 0 | 1 | 29 | 局部接线/兼容核对 |
| `src/ext/modules/narrative/types.ts` | 0 | 0 | 2 | 0 | 2 | 14 | 局部接线/兼容核对 |
| `src/ext/modules/narrative/ui/useNarrativeUi.ts` | 1 | 0 | 0 | 0 | 1 | 42 | 局部接线/兼容核对 |
| `src/ext/modules/narrative/ui/view.ts` | 0 | 0 | 0 | 1 | 1 | 32 | 局部接线/兼容核对 |
| `src/ext/modules/narrative/validation.ts` | 0 | 0 | 0 | 2 | 2 | 78 | 局部接线/兼容核对 |
| `src/ext/modules/settlement/ui/useSettlementUi.ts` | 2 | 0 | 0 | 3 | 5 | 102 | 局部接线/兼容核对 |
| `src/ext/partBreak.ts` | 0 | 0 | 1 | 0 | 1 | 21 | 局部接线/兼容核对 |
| `src/ext/runtime.ts` | 0 | 22 | 116 | 14 | 152 | 30 | 系统拆分 |
| `src/ext/stats.ts` | 0 | 0 | 1 | 0 | 1 | 98 | 局部接线/兼容核对 |
| `src/ext/structureSchema.ts` | 0 | 0 | 1 | 0 | 1 | 111 | 局部接线/兼容核对 |
| `src/ext/types.ts` | 0 | 0 | 22 | 1 | 23 | 18 | 接口/调用链 |
| `src/ext/world.ts` | 0 | 0 | 2 | 1 | 3 | 25 | 局部接线/兼容核对 |
| `src/ext/worldEdible.ts` | 0 | 0 | 3 | 0 | 3 | 38 | 局部接线/兼容核对 |
| `src/ext/worldSdk.ts` | 0 | 0 | 1 | 0 | 1 | 78 | 局部接线/兼容核对 |
| `src/ui/canvasGameInput.ts` | 2 | 0 | 0 | 0 | 2 | 10 | 局部接线/兼容核对 |
| `src/ui/combatDrawing.ts` | 4 | 1 | 0 | 0 | 5 | 30 | 局部接线/兼容核对 |
| `src/ui/commands.ts` | 1 | 0 | 0 | 0 | 1 | 22 | 局部接线/兼容核对 |
| `src/ui/dialogAcknowledgments.ts` | 6 | 0 | 0 | 4 | 10 | 9 | 局部接线/兼容核对 |
| `src/ui/displayProjection.ts` | 59 | 0 | 0 | 1 | 60 | 4 | 接口/调用链 |
| `src/ui/immersiveMode.ts` | 5 | 0 | 0 | 3 | 8 | 11 | 局部接线/兼容核对 |
| `src/ui/mapTileSemantics.ts` | 11 | 0 | 0 | 0 | 11 | 12 | 局部接线/兼容核对 |
| `src/ui/monsterDisplay.ts` | 30 | 4 | 0 | 0 | 34 | 13 | 接口/调用链 |
| `src/ui/nearbyInspection.ts` | 47 | 0 | 0 | 0 | 47 | 17 | 接口/调用链 |
| `src/ui/playerHudStatus.ts` | 6 | 0 | 0 | 0 | 6 | 7 | 局部接线/兼容核对 |
| `src/ui/presentationTimeline.ts` | 0 | 0 | 0 | 3 | 3 | 50 | 局部接线/兼容核对 |
| `src/ui/squareBodyDiagnostics.ts` | 8 | 0 | 0 | 1 | 9 | 15 | 局部接线/兼容核对 |
| `src/ui/targeting.ts` | 3 | 0 | 0 | 0 | 3 | 42 | 局部接线/兼容核对 |
| `src/ui/useGameHud.ts` | 43 | 0 | 0 | 2 | 45 | 12 | 接口/调用链 |
| `src/ui/vectorAtlas.ts` | 2 | 0 | 0 | 0 | 2 | 59 | 局部接线/兼容核对 |
| `src/ui/worldInteractableMap.ts` | 3 | 0 | 0 | 0 | 3 | 8 | 局部接线/兼容核对 |

## 附录 B：玩家专属和全局状态归属

全部 127 个 U03 字段均在 JSON `stateFields`；下面按迁移归属汇总，保留当前 `kind` 于 JSON。B 中的大部分世界根无需按成员复制，但要检查枚举消费者；A 中现有命令解释状态可能仍需带 actor 保存，不能一刀切排除；D 的 `player` 是兼容主成员引用，不随焦点变。

| 归属 | 字段数 | 完整字段名 |
|---|---:|---|
| A | 26 | `onCommandConfirmRequest`、`activeFlares`、`animationAccumulatorMs`、`animationEnabled`、`animationLockDeadline`、`boltAnimStartTime`、`currentBoltFrameIndex`、`flareElapsedMs`、`flareLightMap`、`floatingTexts`、`hoveredCell`、`flavorText`、`hoveredText`、`inspectTarget`、`isExamining`、`isInventoryOpen`、`needsRender`、`onConfirmRequest`、`onRenderRequested`、`pendingBoltFrames`、`pendingPauseMs`、`referenceScreen`、`replayFrameAccumulator`、`replayFramesPerStep`、`terrainFlashes`、`replayOmniscientDetails` |
| B | 57 | `squareLandingRetry`、`squareMotion`、`absoluteTurnNumber`、`combatSystem`、`currentLevelAwaySince`、`currentLevelDepth`、`currentTestCategory`、`depth`、`displacementTrapDepressions`、`dormantMonsterList`、`environment`、`everSeenItems`、`everSeenMonsters`、`examinedEntityIds`、`seenBodyCoreIds`、`foodSpawned`、`fov`、`goldGenerated`、`grid`、`items`、`lastPromotionUpdate`、`levelHasSecrets`、`levelSeeds`、`levels`、`lightMap`、`loopMap`、`machineCells`、`meteredItems`、`monsterSpawnFuse`、`activeMonsterList`、`pendingCaughtFireCells`、`pendingFallenItemsByDepth`、`pendingFallenByDepth`、`purgatory`、`resetPlateRoomByPos`、`safetyMap`、`scent`、`secretScanDepth`、`signTexts`、`stats`、`testRooms`、`ticksTillUpdateEnvironment`、`updatedSafetyMapThisTurn`、`visibleItems`、`visibleMonsters`、`waypoints`、`currentLevelExitedVia`、`monsterPathCache`、`pendingDiscoveryMessages`、`extensionRuntime`、`bodyGroups`、`world5`、`actorActions`、`worldContainerItems`、`worldWorkFacts`、`worldWorkDetails`、`worldWorkCommandEpoch` |
| C | 25 | `autoPath`、`inAutoTravelStep`、`isAutoExploring`、`isMouseTraveling`、`isThrowing`、`justRested`、`justSearched`、`lastDamageSource`、`minersLight`、`minersLightBaseFixpt`、`pendingArcana`、`pendingEnchantment`、`pendingEnchantmentScrollWasKnown`、`pendingIdentify`、`pendingUseConfirm`、`playerFalling`、`poisonedDuringTurn`、`searchingCharge`、`throwItemTarget`、`travelTargetItem`、`disturbed`、`autoFight`、`autoAction`、`inventoryAction`、`receivedLevitationWarning` |
| D | 19 | `advancementIter`、`currentSeed`、`gameOverInventory`、`gameOverReason`、`gameOverScore`、`gameOverWon`、`isAdvancing`、`isGameOver`、`lastAdvancementError`、`mode`、`player`、`recordedInputEvents`、`recordedInputIndex`、`recordingStartAt`、`replayCursor`、`replayEvents`、`replayRecording`、`replayStatus`、`executingRecordedCommand` |
