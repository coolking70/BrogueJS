# C5-1：阶段 5A 合同冻结草案

日期：2026-10-06。合同标识 **`C5-1 / 1.0.0`**；来源是已批准的[阶段 5 设计](phase5-settlement-world.md)（P5-D01–D14 全 A）与 [5A0 任务书](phase5a0.task.md)。本文冻结供 5A1–5A3 实现、5B 派发使用的名称、字段及行为，不表示这些 API 已实现。5A0 只新增本文、[执行报告](phase5a0.report.md)和只读体积探针，不改变任何生产版本。数值内容表及新版录像的实施任务仍须维护者确认。

## 1 基线、版本与事实纠正

任务指定集成基线为 **`7f6de96`**，通过 `git show <commit>:<file>` 和仓库外固定导出核对。当前设计分支 HEAD 为 `87d92c8`，与该提交的共同祖先是 `9331104`，**并不包含 `7f6de96`**；不可把当前树的 foundation=4 当成收尾集成后的版本，也不可在本步偷偷合并生产代码。后续 5A1 必须先由集成人提供实际收尾候选 commit，重核对本节。

| 项目 | 设计工作树 `87d92c8` | 指定基线 `7f6de96` | 5A 计划 |
| --- | --- | --- | --- |
| manifest / foundation | schema=1 / 4 | schema=1 / **5** | 5A1 首次落地统一分配 foundation **6**；manifest schema 仍为 1，foundation 精确匹配 |
| growth module/rules | 1.6.0 / 1.6.0 | **1.7.0 / 1.7.0** | 5A0 不升版 |
| narrative module/rules/state/input | 1.3.0 / 1.3.0 / 3 / 2 | **1.4.0 / 1.4.0 / 4 / 2** | 5A0 不升版 |
| combat module/rules；主 state schema | 1.4.0 / 1.4.0；1 | **1.5.0 / 1.5.0；1** | 5A0 不升版；不调整招式/成长/篝火平衡 |
| giants module/rules/state | 1.0.0 / 1.0.0 / 1 | **1.0.0 / 1.0.0 / 1** | 5A0 不升版；身体/群体规则保持 |
| 整局 / 实体 envelope / 录像 / 来源 | whole-run-v3 / 3 / 3 / RecordingOrigin 1 | 同左 | 候选 whole-run-v4 / 4 / 录像 4 / 来源 2；在 5A1 根据真实候选核定，5A0 不预占格式号 |

模块没有统一的独立 input/display/state 版本槽，不能虚构“所有模块 state=1/input=1”。growth 的 GrowthState 是字段结构，公开没有独立 schema 号；combat 的 scheduler、resource、bonfire 等子状态各有自己的校验。narrative 的 displayVersion 来自单独显示包。既有模块 descriptor 的 foundation 兼容号在 5A1 统一适配 6，不因此改其机械数据版本。

5A2 将 combat scheduler 的可写倒计时搬到中立动作根，可能改变其保存布局/模块校验器。届时必须显式登记受影响的 state/module 版本并重新验收，不能借“5A0 不影响旧模块”隐瞒格式变化；这里不预分配 combat 1.6.0 或重写旧记录。giants 及既有战斗规则没有本步变更授权。所有旧格式统一拒绝，不做迁移，不剥离缺失模块续玩。

以下文件/函数均指 **`7f6de96` 的内容**；当前分支同路径的行号/版本可能不同。

| 引用 | 实际执行事实 / 新能力缺口 |
| --- | --- |
| `src/ext/types.ts`：ExtensionManifest / ExtensionSnapshot；`runtime.ts`：snapshot / validateSnapshot | foundation 精确为 5；snapshot 每次完整 structuredClone 模块、组件、foundation 世界状态 |
| `src/ext/modules/*/definitions.ts`、`descriptor.ts`、`types.ts`、`state.ts`、数据根 | 表中模块版本的代码依据；模块规则 fingerprint 覆盖机械包，未启用模块不授予能力 |
| `GenerationCoordinator.ts`：generateDepth（244 起）、checkpointGenerationWorld | visited 层必须有真实缓存（test 专用路径例外）；离开移入 levels，恢复后删除活动层缓存别名；不得按种子重生成营地 |
| `LevelState.ts`；`WholeRunSnapshot.ts`：snapshotLevel / whole-run 投影与恢复 | 当前层在 Game，缓存层各有唯一 Grid/environment/entities/items；整局同时保存当前层、全部缓存层、pending fallen 与 purgatory |
| `EntitySnapshot.ts`：ITEM_FIELDS / collectEntityGraph / restoreEntityGraph | 显式字段编码和跨层生物/携带物引用；没有容器/escrow roots，没有 MATERIAL/工具扩展字段 |
| `Game.ts`：snapshotRunState / toSnapshot / toSaveSnapshot / exportRecording / finalizeRecordedInput | 每事件完整 extensions checkpoint；**普通 toSnapshot 的 run 也含 recordedInputEvents 前缀**，保存来源不是唯一的录像体积来源 |
| `SaveStorage.ts`：saveSnapshot；前端录像库的 `brogue-web-replay-v1` 写入路径 | 存档 JSON 在 IndexedDB；录像库仍写 localStorage。IndexedDB 存档可写不证明录像字符串可写 |
| `TimeCoordinator.ts`：advancementLoop；`Systems/Time.ts` | 最小 elapsed 推进/100 tick 环境块；currentTick 是输入时间簿记，不能冒充 simulationTicks |
| `Game.ts`：环境 catch-up；`GenerationCoordinator.ts`：首次/重访环境模拟 | 首次预热 50 次，重访最多 100 次；不是长期经济/居民模拟 |
| `Movement/LevelTravel.ts`、Game 恢复跟随/坠落处理 | 相邻缓存层跟随者仍可能迁层，管理层需先结旧区间再接受跨层写入 |
| `Items/Item.ts`、`Inventory.ts`：packCount / stacksWith / addItem；`ItemLoader.ts` | 类别止于 GEM=12；26 字母背包，现有数量/合并规则不能直接承载材料。随机 spawn 不是固定 +0 已知装配接口 |
| `Grid.ts`：refreshTerrainProperties（864）、setTerrainLayer（1006）、setTerrain（1014）；`TerrainRules.ts` | 四层基础性质；setTerrain 清其他层，setTerrainLayer 保留其他层；**没有结构感知 cellProperties** |
| `DungeonFeature.ts`：terrainFlagsOfCell / cellTerrainFlags；`Promotion.ts`；`Environment/Gas.ts`：addGas / clear / update | DF/Promotion/Gas 既经 setter 又直接写 layers/volume；气体阻挡读取 flags。仅改 Grid setter 不足以支持结构 |
| `src/ext/regions.ts`：OwnedRegion / validOwnedRegions；runtime 的生成 region 发布 | depth-only、矩形、全局 128、不重叠、生成 token 发布；尚无运行期建立/扩张/撤销事务 |
| `ActorActionProduction.ts`：production 绑定；`runtime.ts` 构造 provider 检查；`WorldRestProduction.ts` / `ext/worldRest.ts` | 单一 actorActions provider 的 state.scheduler 是当前可写动作根；combat 是正式 provider；篝火休息绑定该 provider，尚非无 combat 的通用 RestPoint |

阶段 3/4 联合最终门禁正在另一工作树执行，本节只确认指定 commit 的代码事实，**不声明联合收尾全绿**。

## 2 名称、数据边界与持久路径

拟公开入口为 `src/ext/worldSdk.ts`，离线可信入口为 `src/engine/Core/WorldSettlement.ts`，结构可信入口为 `src/engine/Map/StructureWorld.ts`。本步不创建这些生产文件。以下各 TS 块组成一份可独立类型检查的声明草案；所有 SDK 返回 DTO 深复制并深冻结。number 的 TS 类型不替代运行期有限、安全整数和范围校验；undefined、未知键、getter、prototype 污染、循环、非 JSON、Promise 均拒绝。

命名空间 ID 用已存在 validId 语法，长度 1…128，定义 ID 必须以 `owner.` 开头；文本键归启用模块 locale，颜色为 `#RRGGBB`，glyph 为一枚合法文本字形。内部实体/世界 ID 为 1…MAX_SAFE_INTEGER，revision/tick/ordinal 为 0…MAX_SAFE_INTEGER；递增前检查溢出。世界 ID 独立于实体 ID，所有引用带字段类型，禁止混用数值相同的 ID。规范排序不用 localeCompare：ASCII ID 按码点，整数按升序。

```ts
export type WorldId = number;
export type EntityId = number;
export type Revision = number;
export type Tick = number;
export type DefinitionId = string;
export type ModuleId = string;
export type Position = Readonly<{ x: number; y: number }>;
export type Bounds = Readonly<{ x: number; y: number; width: number; height: number }>;
export type LevelRef = Readonly<{ kind: 'dungeon'; depth: number }>
  | Readonly<{ kind: 'site'; id: string }>;
export type JsonValue = null | boolean | number | string | readonly JsonValue[]
  | Readonly<{ [key: string]: JsonValue }>;
export type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T
  : T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export type WorldErrorCode = 'C5_BAD_PAYLOAD' | 'C5_BAD_DEFINITION' | 'C5_BAD_VERSION'
  | 'C5_DISABLED' | 'C5_UNSUPPORTED' | 'C5_SCOPE' | 'C5_STALE' | 'C5_PLAN_USED'
  | 'C5_BUSY' | 'C5_DEAD' | 'C5_GATE' | 'C5_UNKNOWN_TARGET' | 'C5_WRONG_LEVEL'
  | 'C5_DISTANCE' | 'C5_THREAT' | 'C5_TOOL' | 'C5_INPUT' | 'C5_CAPACITY'
  | 'C5_RESOURCE_EMPTY' | 'C5_RESERVED' | 'C5_BUDGET' | 'C5_OVERLAP'
  | 'C5_PROTECTED' | 'C5_BLOCKED' | 'C5_ROOM' | 'C5_NEEDS_RESUPPLY'
  | 'C5_BAD_TIME' | 'C5_BAD_OWNERSHIP' | 'C5_BAD_REFERENCE'
  | 'C5_PROVIDER' | 'C5_TRANSACTION' | 'C5_OVERFLOW' | 'C5_TERMINAL';
export type WorldResult<T> = Readonly<{ ok: true; value: DeepReadonly<T> }>
  | Readonly<{ ok: false; code: WorldErrorCode; field: string | null }>;
export declare const C5_CONTRACT_VERSION: '1.0.0';
export declare function levelKey(ref: LevelRef): string;
export declare function compareLevelRefs(a: LevelRef, b: LevelRef): number;
```

`levelKey` 返回 `dungeon.<decimal depth>` 或 `site.<id>`；depth=1…40，site id 沿 validId。比较 dungeon 先于 site，dungeon 按 depth，site 按 id；编码不含语言/显示名。5A1 接受 site 类型，但实际未提供 site 适配器的机械调用返回 C5_UNSUPPORTED；5C2 才可创建首个 79×29 site。禁止 depth=0/负数/D41、site 访问 dungeon seed 数组。旧 depth 是 dungeon 的派生适配值，不是第二个可写身份。

**冻结持久路径：**可选 `GameSnapshot.run.world5` 是 foundation-owned 世界新增账本，内含以下 World5Snapshot；它不嵌第二份 Grid/Creature/Item。唯一中立动作簿记在可选 `run.actorActions`（5A2 版号 1），combat 仅保资源/定义/自己的结果收据及 bundle 引用。Item/生物完整行延续实体 codec，新增容器/escrow 仅作为 collectEntityGraph 的根并保存 ID 引用；已有 native roots 不为本步强行全面重构。模块私有政策仅在 `extensions.modules.<owner>`，组件仍在 `extensions.components[actorId]`。已有 `extensions.foundation.world` 是交互对象/region 根，保留其职责，region 扩展为 LevelRef 时不另在 world5 复制 bounds。

```ts
export type PersistenceReason = 'camp' | 'container' | 'resident' | 'work' | 'event';
export type LevelSimulationPolicy = 'native' | 'frozen-ecology-economy-v1';
export interface LevelRecord {
  levelRef: LevelRef; generatedBy: string; residence: 'active' | 'cached';
  revision: Revision; lastDepartedTick: Tick | null;
  policy: LevelSimulationPolicy; persistenceReasons: readonly PersistenceReason[];
}
export interface World5Snapshot {
  schema: 1; revision: Revision; simulationTicks: Tick; nextWorldId: WorldId; nextPlanId: number;
  levels: readonly LevelRecord[]; structures: readonly StructureCell[];
  containers: readonly ContainerRecord[]; nodes: readonly ResourceNodeRecord[];
  stations: readonly StationRecord[]; tickets: readonly WorkTicket[];
  restPoints: readonly RestPoint[]; offline: readonly OfflineLedger[];
  startupGrants: readonly StartupGrantReceipt[]; receipts: readonly WorldReceipt[];
}
export interface WorldReceipt {
  owner: ModuleId; ordinal: number; identity: string; kind: 'startup' | 'transfer' | 'work'
    | 'placement' | 'offline' | 'region' | 'structure' | 'rest';
  levelRef: LevelRef; tick: Tick; result: 'completed' | 'interrupted' | 'skipped';
  reason: string | null;
}
```

没有使用新世界能力的组合不物化 world5，不推进新机械计时，不注册新生成/规则随机域。不以空数组字段把所有旧组合“伪启用”。scheduler 中立迁移可供既有 combat 使用，world5 与 scheduler 的存在条件分开。新增 Game/Item/Creature 持久字段必须登记 U03/实体字段合同；派生 room/FOV/route 不进持久根。

一个真实层只有一个承载者：活动层 Game 的字段或缓存 LevelState，不能同时保有可写 Grid 别名。LevelRecord 是索引，不是地图副本。persistenceReasons 为唯一真实引用推导的规范集合；撤销最后营地仍保留 visited 层和生成身份。所有层转移、实体/Item pending roots 与组件跨引用在退休旧局前验证；持久性理由不能授权删除已访问层/按 seed 载回。

## 3 simulationTicks、两种精度与离线 planner

`simulationTicks` 在 advancementLoop **正 elapsed 的唯一提交点**增加；相同调度 delta 不因 NPC 数/群成员数/环境块/工作回调多计。100 tick 原生客观块保持，经济 epoch=`floor(simulationTicks/1000)`。新能力首次启动时钟由新局初始化为 0（已启用该能力的局），后续动作持续计时；不能在建第一个营地时清零。未启用能力时不建立钟。load/UI/墙钟/生成预热/原 catch-up 都不推进钟。

seek 自身不额外加时间；**seek 重放真实历史正耗时命令仍按原 elapsed 重建同一个时钟**，不能把设计中的“seek 不推进”误解成重放不计时。当前 Tick/currentTick 与 absoluteTurnNumber 沿旧用途，三者不可互相覆写。零时间管理命令不能给工作信用、续补给单或重置事件窗口。

```ts
export interface EconomicOrder {
  id: string; owner: ModuleId; actorId: EntityId; definitionId: DefinitionId;
  priority: number; planId: number; remainingEpochs: number;
  ticketId: WorldId | null; status: 'working' | 'stopped' | 'needs-resupply';
  stopReason: string | null; revision: Revision;
}
export interface OfflineResident {
  actorId: EntityId; alive: boolean; bedComponentId: WorldId | null;
  shortage: 0 | 1 | 2 | 3; availableFoodUnits: number;
  route: Readonly<{ reachable: boolean; distance: number; travelTicks: Tick }>;
}
export interface OfflineLedger {
  levelRef: LevelRef; lastSettledTick: Tick; epochRemainder: number;
  revision: Revision; planId: number; remainingEpochs: number;
  seedKey: string; lastEventOrdinal: number; structureRevision: Revision;
  pendingOutputs: readonly DeferredOutput[]; needsResupply: boolean;
}
export interface DeferredOutput {
  ticketId: WorldId; availableEpoch: number; destinationId: WorldId;
  items: readonly ItemAmount[];
}
export interface OfflineInput {
  schema: 1; rulesFingerprint: string; runSeed: string; campInstanceId: string;
  level: LevelRecord; fromTick: Tick; toTick: Tick; ledger: OfflineLedger;
  rules: OfflineRules; facilities: readonly OfflineFacility[];
  containers: readonly ContainerRead[]; nodes: readonly ResourceNodeRecord[];
  tickets: readonly WorkTicket[]; orders: readonly EconomicOrder[];
  residents: readonly OfflineResident[];
  knownThreats: readonly string[]; pendingEvents: readonly OfflineEvent[];
}
export interface OfflineRules {
  epochTicks: 1000; maxPlanEpochs: 32; maxCompletionsPerEpoch: 1024;
  foodUnitsPerResident: 1; rationDefinitions: readonly DefinitionId[];
  nodeDefinitions: readonly ResourceDefinition[]; recipes: readonly RecipeDefinition[];
  shortageEfficiencyNumerators: readonly [number, number, number, number];
  efficiencyDenominator: number;
}
export interface OfflineFacility {
  componentId: WorldId; definitionId: DefinitionId; hp: number; maxHp: number;
  roomEligible: boolean; ventilated: boolean; reachable: boolean;
  tags: readonly string[];
}
export interface OfflineEvent {
  id: string; absoluteEpoch: number; ordinal: number; kind: 'raid' | 'work-stop';
  policy: JsonValue;
}
export interface OfflinePlan {
  contract: 'C5-1'; planId: number; levelRef: LevelRef;
  fromTick: Tick; toTick: Tick; sourceRevision: Revision; inputDigest: string;
  nextLedger: OfflineLedger; nextOrders: readonly EconomicOrder[];
  nextResidents: readonly OfflineResident[]; nextNodes: readonly ResourceNodeRecord[];
  effects: readonly OfflineEffect[]; receipts: readonly WorldReceipt[];
}
export type OfflineEffect = Readonly<{ kind: 'item-delta'; containerId: WorldId;
    definitionId: DefinitionId; delta: number; availableEpoch: number }>
  | Readonly<{ kind: 'ticket-progress'; ticketId: WorldId; laborTicks: Tick;
    completedBatches: number }>
  | Readonly<{ kind: 'structure-damage'; componentId: WorldId; hpLost: number }>
  | Readonly<{ kind: 'pending-encounter'; eventId: string; remainingBudget: number }>;
export declare function planOfflineSettlement(input: DeepReadonly<OfflineInput>): WorldResult<OfflinePlan>;
export declare function offlineDraw(seedKey: string, absoluteEpoch: number,
  eventKind: string, ordinal: number): number;
```

上述离线接口只向引擎可信适配器开放，不进入 module UI 的 public context。输入必须是离开安全点冻结的**充分值快照**：rules 从已启用机械定义构造，facilities 是真实部件/房间/路线的资格摘要，不能由保存自带数值授予能力。shortageEfficiencyNumerators 是等级0…3的四个定点分子（0档等于分母、2/3档为0），具体1档值留5D数值任务审批。本草案用 knownThreats/pendingEvents.policy 承载有界领域政策 JSON，schema 由该 owner 的已安装定义校验，不允许任意脚本。执行器应构建/校验该 DTO，模块不得伪造世界库存。

C5-1 的经济核按绝对完整 epoch 依次：上周期产物可用→按 actor ID 发真实口粮/分床→资格/预留/仓容→稳定 priority/job/actor 顺序的信用及批次→一个登记事件窗口→余数/高水位/停止原因。产物在下一 epoch 才可作他单输入；一件 Item 不能同时喂居民与补玩家 nutrition。固定政策下支持 0/999/1000/1001 tick、31/32/33 周期和任意中间分段；比较全部余数、预留、收据、ordinal 与随机键，满足 `S(t0,t2)=S(S(t0,t1),t1,t2)`。

remainingEpochs=0…32，属于补给单整个生命周期；fromTick 必须等于 ledger.lastSettledTick，epochRemainder 必须等于 lastSettledTick % 1000，toTick≥fromTick 且≤当前权威 simulationTicks。处理调用、查看、重访、load 不重置。最多循环这份单据剩余的 32 个 epoch；之后以有限口粮、短缺饱和（0…3）及再生容量的闭式算式处理任意长尾，不逐 tick/无限 epoch 模拟。pendingOutputs 的开放边界也纳入闭式处理。对已经计算到 toTick 的重复计划为同一提交收据的幂等 no-op；旧 revision 的不同计划报 C5_STALE，不重抽/重复发物。

固定离线抽样算法冻结为 `sha256-c5-offline-v1`：UTF-8 编码 canonical JSON 数组 `["c5-offline-v1",seedKey,absoluteEpoch,eventKind,ordinal]`，取 SHA-256 摘要首 4 字节**大端 uint32**，输出 0…2^32−1。seedKey 是 SHA-256 of canonical JSON `["c5-seed-v1",runSeed,levelKey,stableCampInstanceId,domainId,rulesFingerprint]` 的 64 个小写十六进制字符。runSeed 是引擎规范十进制字符串；epoch/ordinal 为安全非负整数；不使用 JS hash/Math.random/全局 RNG。需要范围抽样的 adapter 另用版本化拒绝抽样，不随意 `% range` 宣称无偏。实现测试必须冻结空/边界/跨层/非 ASCII 拒绝等向量；算法 ID/领域规则纳入指纹。本步没有给旧双流增加调用。

在场以原动作实际正耗时累积劳作信用，用相同经济核兑现；离场不跑 AI/逐格战斗，使用离开时路线/速度摘要补剩余信用。管理层冻结原生火/气/液体/HP/状态/combat 资源，替代该层原 100 次 catch-up；其他地牢层保持原路径，首次 50 次预热保持。离开时危险岗位停工，返回危险仍在。节点在非管理层也可惰性再生，不能因此把该层全生态改为管理层政策。

offlineDraw 算法草案已用仓库外 Python 标准库独立计算三项固定向量（不是生产API测试）：

| seedKey | epoch / eventKind / ordinal | SHA-256首4字节hex | 输出uint32 |
| --- | --- | --- | ---: |
| 64个0 | 0 / raid / 0 | 09531fcc | 156442572 |
| 64个0 | 1 / raid / 0 | 7c77d260 | 2088227424 |
| 64个f | 9007199254740991 / work / 9007199254740991 | 4719c5ff | 1192871423 |

入层事务：冻结离开层→移交目标唯一真实承载→旧区间纯规划与完整预检→同步提交世界/模块/收据→玩家落点及居民恢复→enteredLevel 放置/事实→原命令 checkpoint。跨层跟随/坠落/可信事件在写管理层前先结旧区间，再写入，再建新 revision 输入。load 只验证恢复，禁止 onLoad 产出；保存可带未物化离场区间。玩家终局冻结整局，不能为了终局页面打开补结离场经济。

## 4 受控世界事务与错误语义

```ts
declare const scopeBrand: unique symbol;
declare const planBrand: unique symbol;
export type WorldActorScope = Readonly<{ [scopeBrand]: true; owner: ModuleId;
  actorId: EntityId; kind: 'player-command' | 'npc-decision' | 'trusted-world' }>;
export interface RevisionStamp { kind: 'world' | 'level' | 'container' | 'node'
  | 'station' | 'ticket' | 'structure' | 'region'; id: string; revision: Revision }
export interface WorldPlanHandle {
  readonly [planBrand]: true; contract: 'C5-1'; sessionId: string; owner: ModuleId;
  actorId: EntityId; operation: string; sourceRevisions: readonly RevisionStamp[];
}
export interface WorldCommit {
  operation: string; receiptIdentity: string; ticketId: WorldId | null;
  chargedTicks: Tick; revision: Revision;
}
export declare function commitWorldWork(plan: WorldPlanHandle,
  scope: WorldActorScope): WorldResult<WorldCommit>;
export declare function commitOfflineSettlement(plan: DeepReadonly<OfflinePlan>,
  scope: WorldActorScope): WorldResult<WorldCommit>;
```

scope 由底座在 executeCommand / NPC 的原生一次自由决策 / 可信迁层边界签发，不能通过 JSON/actorId 构造。handle 是底座 session-only 身份，模块只能持有，不能造 planID、写任意 Game 或传回结果 delta。纯 prepare 0 tick/0 RNG/0 实体与持久 ID/0消息；确认异步时只有数据，结束前重新获取短同步 scope，并核验所有源 revision/资格/容量/目标。过期 UI、scope mismatch、不同局/owner、已用 handle 在扣料/取随机/ID 前拒绝。

计划身份 token 不等于持久 nextPlanId；后者只在成功开启补给单/工作时递增。确认 No 是命令决策，可有一条零时间录像事件，但机械世界和两流不变。成功 commit 消费 handle；结果失败也不允许伪造重用失效 context，调用者重新准备。既有计划与源完全不变时，同一持久工作/离线 receiptIdentity 的重复兑现不二次扣料/发物。

事务写集是显式的 operation union，不向模块开放 `{path,value}` 或任意 patch。任何提交覆盖实际可能写入的当前/缓存层、物品对象/数组/数量/引用、Grid/environment、世界账本、模块 state/components、动作根、实体/world/plan/fact ID、消息与事实队列、双流、空间/光照/会话缓存及旧局恢复身份。同步子 provider 参与同一外层事务；缺席/disabled/unsupported 才允许已声明降级，异常/Promise/越权/错误 DTO 报 C5_PROVIDER 且全回滚。不能以当前奖励或生成事务的存在冒充新的写集证明。

| 错误码组 | 检查 / 结果 |
| --- | --- |
| BAD_PAYLOAD / BAD_DEFINITION / BAD_VERSION | 严格未知键、数组上限、有限整数、引用、locale、版本/指纹；坏包/坏档在退休旧局前拒绝 |
| DISABLED / UNSUPPORTED / SCOPE / TERMINAL | 未启用 owner、未实现 site/软能力、伪 scope/权限、已终局；无写入 |
| STALE / PLAN_USED | session/revision/CAS/one-shot；无写入、无新 ID |
| BUSY / DEAD / GATE / UNKNOWN_TARGET / WRONG_LEVEL / DISTANCE / THREAT | 源主体唯一计时、输入屏障、公开已知/同层/交互线/安全资格；未知目标统一反馈，不能泄露隐藏阻挡者 |
| TOOL / INPUT / CAPACITY / RESOURCE_EMPTY / RESERVED / BUDGET | 工具标签/耐久、指定库存、输出/退款槽、节点可用量、互斥预留与硬上限；拒绝不截断数量、不淘汰旧世界 |
| OVERLAP / PROTECTED / BLOCKED / ROOM / NEEDS_RESUPPLY | 区域重叠、机器/楼梯/全身体/逃生、房间、订单生命周期；不给免费信用 |
| BAD_TIME / BAD_OWNERSHIP / BAD_REFERENCE / OVERFLOW | 时钟倒退/余数不符、Item 双 owner、跨根孤儿、任意加乘溢出；绝不自动修补 |
| PROVIDER / TRANSACTION | 子 provider 或同步发布失败；完整回滚后返回内部错误，玩家只看 i18n 的简洁失败原因 |

上述零成本指**接收前拒绝**。已开始工作后被伤害/离层/工位毁坏等打断，已耗游戏时间和已完成批次不倒退；仅取消未完成批次并退款剩余输入。提交异常恢复本次写集，但不能把先前已提交的劳动回合“退款为零时间”。日志/显示发布在成功安全点之后，显示 observer 异常不得回调补扣世界。

## 5 物品、容器、资源点、工位与票据

```ts
export interface ItemAmount { itemDefinitionId: DefinitionId; count: number }
export interface ItemDefinitionContribution {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  category: 'material' | 'tool' | 'kit' | 'native'; glyph: string; color: string;
  maxStack: number; unitWeight: number;
  nativeTemplate: 'dagger' | 'leather_armor' | 'ration_of_food' | null;
  tags: readonly string[]; tool: Readonly<{ tag: string; maxDurability: number;
    durabilityPerBatch: number }> | null;
}
export interface ModuleItemFields {
  definitionId: DefinitionId; quality: 'basic'; toolDurability: number | null;
}
export type ItemOwnerRef = Readonly<{ kind: 'inventory'; actorId: EntityId }>
  | Readonly<{ kind: 'floor'; levelRef: LevelRef }>
  | Readonly<{ kind: 'carrier'; actorId: EntityId }>
  | Readonly<{ kind: 'container'; containerId: WorldId }>;
export type WorldPositionRef = Readonly<{ kind: 'placed'; levelRef: LevelRef; at: Position }>
  | Readonly<{ kind: 'structure'; componentId: WorldId }>;
export interface ContainerRecord {
  id: WorldId; owner: ModuleId; kind: 'chest' | 'escrow' | 'refund' | 'remains';
  position: WorldPositionRef | null; capacity: number; itemIds: readonly EntityId[];
  revision: Revision; ticketId: WorldId | null;
}
export interface ItemRead {
  id: EntityId; definitionId: DefinitionId | null; category: string; quantity: number;
  available: number; tags: readonly string[]; toolDurability: number | null;
}
export interface ContainerRead {
  id: WorldId; levelRef: LevelRef; at: Position; kind: ContainerRecord['kind'];
  revision: Revision; capacity: number; occupiedSlots: number; reservedSlots: number;
  items: readonly ItemRead[];
}
export interface ResourceDefinition {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  kind: 'wood' | 'stone' | 'ore' | 'fiber' | 'fungus';
  yield: readonly ItemAmount[]; capacity: number; harvestTicks: Tick;
  unitsPerHarvest: number; requiredToolTag: string | null;
  regeneration: Readonly<{ kind: 'none' }>
    | Readonly<{ kind: 'periodic'; units: number; intervalTicks: Tick }>;
  placement: Readonly<{ dungeon: Readonly<{ minDepth: number; maxDepth: number;
    maxPerDepth: number; maxPerRun: number; onNoSpace: 'skip' | 'defer' }> | null;
    site: Readonly<{ siteTags: readonly string[]; maxPerSite: number;
      maxPerRun: number; onNoSpace: 'skip' | 'defer' }> | null }>;
}
export interface ResourceNodeRecord {
  id: WorldId; owner: ModuleId; definitionId: DefinitionId; instanceKey: string;
  levelRef: LevelRef; at: Position; capacity: number; remaining: number;
  reservedUnits: number; regenRemainder: Tick; lastSettledTick: Tick; revision: Revision;
}
export interface StationDefinition {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  stationTags: readonly string[]; placementCost: readonly ItemAmount[];
  placementTicks: Tick; workPositionPolicy: 'adjacent-passable';
  kitDefinitionId: DefinitionId | null;
}
export interface StationRecord {
  id: WorldId; owner: ModuleId; definitionId: DefinitionId;
  position: WorldPositionRef; revision: Revision;
}
export interface StationRead {
  id: WorldId; definitionId: DefinitionId; levelRef: LevelRef; at: Position;
  revision: Revision; tags: readonly string[]; workPositions: readonly Position[];
}
export interface RecipeDefinition {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  inputs: readonly ItemAmount[]; outputs: readonly ItemAmount[];
  stationTags: readonly string[]; toolTag: string | null;
  workTicks: Tick; offlineEligible: boolean;
}
export interface CraftingDefinitionPack {
  schema: 1; moduleId: 'crafting'; moduleVersion: string; rulesVersion: string;
  materials: readonly ItemDefinitionContribution[];
  tools: readonly ItemDefinitionContribution[];
  resourceNodes: readonly ResourceDefinition[]; stations: readonly StationDefinition[];
  recipes: readonly RecipeDefinition[];
  limits: Readonly<{ recipes: number; itemAndStationDefinitions: number;
    nodeDefinitions: number; nodesPerLevel: number; nodesPerRun: number;
    stationsPerLevel: number; stationsPerRun: number; startupReceipts: number;
    placementReceipts: number; workHistory: number; batchMax: number; stack: number }>;
}
export interface OutputReservation {
  destination: ItemOwnerRef; slots: number; mergeTargets: readonly EntityId[];
  counts: readonly ItemAmount[];
}
export interface WorkTicket {
  ticketId: WorldId; owner: ModuleId; actorId: EntityId; levelRef: LevelRef;
  kind: 'harvest' | 'craft' | 'station' | 'build' | 'rest';
  sourceIds: readonly WorldId[]; definitionId: DefinitionId;
  inputEscrowId: WorldId | null; outputReservation: OutputReservation | null;
  resourceReservation: Readonly<{ nodeId: WorldId; units: number }> | null;
  totalBatches: number; completedBatches: number; remainingTicks: Tick;
  laborCreditTicks: Tick; bundleId: number; revision: Revision;
  status: 'working' | 'suspended' | 'completed' | 'cancelled';
  stopReason: string | null; lastCompletionOrdinal: number;
}
```

原 ItemCategory 0…12 不重排，拟追加 **MATERIAL=13**；仅 `category=material` 使用新类别。tool/kit 也是新类别实体但通过 definition tags 区分，maxStack=1（工具）或 99（套件），不能当输入木/石；native 输出沿原类别/模板。definitionId/quality/toolDurability 用可选 Item 字段持久化，原物品无此字段。材料堆叠键 `(definitionId,basic)`，每 stack 一背包格、maxStack=99；超过上限按稳定顺序拆 stack 并预检槽与实体预算。装备不可堆叠，不改变原实体 ID/附魔/诅咒/鉴定。原物品特殊堆叠保持，容器内不得自动充能/鉴定/吃饭。

unitWeight 为 0…10000 安全整数，材料按 quantity×unitWeight 计负重；原生物品重量沿旧规则。native 白名单固定 +0、无诅咒/符文、已知，装配不走随机 ItemLoader.spawn；FOOD 使用真实 nutrition=1800。tags/stationTags 去重按码点排序，不根据 ID 魔法分支。材料/工具/台定义合计≤128，resource 定义≤128，配方≤128；owner 必须启用。台/箱/套件不创建居民。

CraftingDefinitionPack 根未知键拒绝：materials是非工具Item贡献表（material/kit/native三类），tools仅tool，两个表ID全集不能重复；这使固定根字段无需另加未声明的nativeOutputs。limits键与类型如上，具体初值见报告；不能通过调大包limits突破foundation硬预算。state/input/display版本在模块声明/自有状态/显示包记录，不额外塞进这个机械根。注册前对完整pack引用/合计数/owner/locale一次校验，native的C5 maxStack只管制造输出预留，不重写已有原生FOOD合并规则。

容器 capacity=1…64；每营地≤16 个箱，全局实物 Item/stack roots（含玩家/地面/携带/箱/escrow/退款）≤8192。一个 Item 只有一个持有 owner，装备引用是该背包 Item 的引用，不是第二 owner。转移用真实对象移动；部分堆叠拆出新 ID，合并退役来源 ID 与引用同事务。UI source=null 仅当前玩家背包，不隐式找世界库存。箱存取同层、Chebyshev 距离≤1、合法交互线和权限，批量成功共耗 100 tick；查看零时间。

输出预留同时计槽和合并 stack 的可加数量，退款路径也必须预留；“一个箱满了以后再想退款”不是合法接收条件。escrow 是真实容器 owner，只记录剩余未消费 Item ID；每批完成原子消耗该批输入、创建固定输出、扣工具耐久、进度/收据。节点 remaining 包含预留未完成单位，available=remaining−reservedUnits≥0；完成时同时减 remaining/reservedUnits，取消只释放 reservedUnits。再生按整数余数/elapsed，容量已满余数清零，无超额信用；单位/容量/interval 在定义范围内，lastSettledTick 单调。UI 查询只读最后已物化值，真实采集准备在可信机械边界结节点。

ticket 总批次 1…16，每批 workTicks=100…10000（定义通用允许 1…10000，首批 crafting 限制 100 起）；总费用/时长/输出先安全乘法核验。每 actor 一个未终结工作 ticket，唯一 decision/time-charge owner；群成员不各做一份。remainingTicks 是当前批剩余时间，完成批后重新设下一批的定义时长；laborCreditTicks 是尚未消费的实际劳动信用，不能另存可写的 scheduler 倒计时。状态：接收→working；居民离场合格→suspended；续同单→working；完成→completed；玩家伤害/失能/离层/工位毁坏/取消→cancelled。重复完成/退款不能重新分配 ID 或奖励。

玩家打断取消当前未完成批次，已完成批保留，剩余 escrow 返原 owner；原处无容量则入已预留 refund/remains 容器，禁止吞物。居民符合政策可冻结剩余 ticket 进入离线，同一 ticket 的兑现 ordinal 唯一。箱毁坏先合法稳定近邻落地，未放出内容入可检索 remains，不能默默删箱导致无 owner；预算触顶时损毁事务也必须有已登记托管路径。火损毁暴露 Item 沿原规则，箱不是永久防火保险。

## 6 结构性质、运行期区域与房间原语

```ts
export type StructureSlot = 'floor' | 'barrier' | 'roof' | 'fixture';
export interface StructureDefinition {
  owner: ModuleId; id: DefinitionId; slot: StructureSlot;
  barrierKind: 'wall' | 'door' | 'window' | null;
  nameKey: string; descriptionKey: string; maxHp: number;
  blocks: Readonly<{ movement: boolean; vision: boolean; physicalProjectile: boolean;
    magicProjectile: boolean; gas: boolean; liquid: boolean }>;
  flammable: boolean; resistances: Readonly<{ physical: number; fire: number }>;
  constructionCost: readonly ItemAmount[]; constructionTicks: Tick;
  refundNumerator: number; refundDenominator: number;
  containerCapacity: number | null; stationDefinitionId: DefinitionId | null;
  restPointDefinitionId: DefinitionId | null;
  tags: readonly string[];
}
export interface StructureComponent {
  id: WorldId; definitionId: DefinitionId; hp: number;
  doorOpen: boolean | null; revision: Revision;
}
export interface StructureCell {
  owner: ModuleId; regionId: WorldId; levelRef: LevelRef; at: Position;
  floor: StructureComponent | null; barrier: StructureComponent | null;
  roof: StructureComponent | null; fixture: StructureComponent | null;
}
export interface CellProperties {
  baseTerrainFlags: number; baseMechFlags: number;
  blocksMovement: boolean; blocksVision: boolean; blocksScent: boolean;
  blocksPhysicalProjectile: boolean; blocksMagicProjectile: boolean;
  blocksGas: boolean; blocksLiquid: boolean;
  stableFloor: boolean; usableRoof: boolean; roofBlocksSunlight: boolean;
  flammable: boolean; terrainRevision: Revision;
}
export interface RoomRead {
  sessionRoomId: string; levelRef: LevelRef; structureRevision: Revision;
  cells: readonly Position[]; closedBoundary: boolean; completeRoof: boolean;
  tags: readonly ('bedroom' | 'warehouse' | 'workshop')[];
  bedIds: readonly WorldId[]; containerIds: readonly WorldId[];
  stationIds: readonly WorldId[]; ventilated: boolean;
}
export type RegionChange = Readonly<{ kind: 'create'; instanceKey: string;
    levelRef: LevelRef; bounds: Bounds }>
  | Readonly<{ kind: 'expand'; regionId: WorldId; revision: Revision; bounds: Bounds }>
  | Readonly<{ kind: 'retire'; regionId: WorldId; revision: Revision }>;
export type StructureChange = Readonly<{ kind: 'build'; regionId: WorldId;
    levelRef: LevelRef; at: Position; definitionId: DefinitionId }>
  | Readonly<{ kind: 'door'; componentId: WorldId; revision: Revision; open: boolean }>
  | Readonly<{ kind: 'dismantle'; componentId: WorldId; revision: Revision }>
  | Readonly<{ kind: 'damage'; componentId: WorldId; revision: Revision;
    amount: number; damageKind: 'physical' | 'fire' }>;
export declare function cellProperties(level: LevelRef, at: Position,
  scope: WorldActorScope): WorldResult<CellProperties>;
export declare function identifyRooms(level: LevelRef,
  scope: WorldActorScope): WorldResult<readonly RoomRead[]>;
export declare function planRegionChange(change: RegionChange,
  scope: WorldActorScope): WorldResult<WorldPlanHandle>;
export declare function planStructureChange(change: StructureChange,
  scope: WorldActorScope): WorldResult<WorldPlanHandle>;
export interface WorldStructureRegistration {
  registerStructureDefinitions(rows: readonly StructureDefinition[]): WorldResult<null>;
  registerRestPointDefinitions(rows: readonly RestPointDefinition[]): WorldResult<null>;
}
```

这些入口是可信引擎窄口，不能让公开 JS/UI 任意提交 damage 或看完整隐藏房间。玩家 build/dismantle/door 由已有命令 scope 适配，公开已知投影另裁剪。首版四层数组仍为 4，稀疏结构为独立根；各格 floor/barrier/roof/fixture 各≤1，barrier 三种互斥。HP=0 同损毁事务删除部件，maxHp/材料/抗性查启用定义，不能让保存自带数据授予能力。门 open 仅 door 非 null；其他部件必须 null。

注册同物品目录先整批校验再发布，只在启用owner初始化scope可用。containerCapacity仅fixture可非null（1…64），stationDefinitionId/restPointDefinitionId仅fixture引用已启用定义；build同事务创建对应ContainerRecord/StationRecord/RestPoint，其position只引用componentId，不重复保存坐标。拆卸/损毁同事务处理关联票据、物品和退款；关联未解决不得遗留孤儿。5A2箱/台由可信fixture或独立非阻挡台入口构造，5A3后可原子绑定结构；并不向dot开放任意箱根创建/结构写口。

机械性质在基础四层之上合成：墙/关闭门挡移动/视线/普通弹道/气液，窗挡移动/普通弹道/液体、透视线与气体；魔法弹道由明确定义，禁止借普通弹道标志推断。地板不封气水，不将深水/熔岩/裂隙变安全；屋顶仅覆盖/日照，不挡平面移动、不净化空气、不提供上层。开启门恢复基础地面性质，不能附送移动/多计一次动作。所有 flags/mechFlags 位运算保持原位宽/符号规则，CellProperties 对阻挡提供显式布尔值。

5A3 必须分类迁移机械读取（passability、FOV、AI、路径、scent、射线/法术、DF/Promotion、Gas/液体、memory/render、巨兽全足迹/位姿），基础地形类型读者可保留。不能只迁 FOV/玩家寻路就开放建筑。写入统一提交“基础地形变化/结构损伤/删除”意图，不用 setTerrain 的清层行为建墙，不抹已有水气。失效一次覆盖 terrain revision、空间/位姿、路线、房间、light/FOV、记忆、loop/waypoint；提交失败恢复原对象/派生索引。

运行期 region 与生成 region 共用同一 128 上限和唯一 bounds；create/expand 不伪造 generation token，重验真实层、地图边界、不重叠、设施/工位、全足迹与逃生。营地最多8、同层1、初始9×9、最大24×20；site 也占名额。范围格≤480，每营地有结构格≤384、全局≤3072，部件≤12288，共格只算一结构格。普通居民不自动绑定 movementRegionId；永久场地守卫另走既有资格。

建造仅当前可见已知可达营地、玩家相邻合法工作位，保护楼梯/D40/机器/impregnable/全生物足迹/箱物和唯一逃生路线。每次公开命令最多施工一格，UI 草稿≤16格顺序发命令，危险/缺料即停止后续草稿；读档/seek 不恢复 UI 队列。拆卸返还 `floor(originalCount × hp/maxHp × 1/2)`，原材料/当前HP由真实定义和根决定，不修理套利。撤销非空营地必须先处理全部居民/订单/休息/预留/退款/袭击，不允许任意 shrink。最后管理营地撤销先结到当前 tick，再解除管理政策；稳定8个slot创建/事件高水位不归零，资源账本不随拆建重置。

房间全层79×29四邻域 flood fill；天然墙、墙、门框（开关不改变拓扑）、窗是边界，摧毁才连通；候选2…128稳定地面格、不触外边/开放通道、每格有效屋顶才完整。无对角角洞连接；地下天然顶不算玩家屋顶。roomId 是会话派生值，居民永久绑定床/工位 component ID，屋顶无支持立即失效住房/工坊，不离线砸人。卧室需床、仓库需箱、工坊需台/合法工位，炉再需通风；首版通风冻结为房间边界至少一扇完好窗或开放门通向非同室的稳定空气格（标签资格，不算氧气物理）。露天箱可用，农田/菌圃/警戒为工作区标签，不强行解释为房间。

## 7 RestPoint 通用休息

```ts
export interface RestPointDefinition {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  restTicks: Tick; interactionDistance: number;
  restorePolicy: Readonly<{ hp: 'native-over-time' | 'full-on-complete' | 'none';
    optionalCombatResources: 'none' | 'provider-on-complete' }>;
  resetPolicy: 'none';
}
export interface RestPoint {
  id: WorldId; owner: ModuleId; definitionId: DefinitionId;
  position: WorldPositionRef; revision: Revision; lastUseOrdinal: number;
}
export interface RestRequest { restPointId: WorldId; revision: Revision }
export interface RestPointPlacementRequest {
  definitionId: DefinitionId; position: WorldPositionRef; revision: Revision;
}
export declare function planRest(request: RestRequest,
  scope: WorldActorScope): WorldResult<WorldPlanHandle>;
export declare function planRestPointPlacement(request: RestPointPlacementRequest,
  scope: WorldActorScope): WorldResult<WorldPlanHandle>;
```

RestPoint 几何/定义归 foundation，owner 保放置/使用收据。无 combat 可 native-rest，唯一中立 scheduler 正耗时、可打断；可选 combat 资源 provider 仅恢复自有资源并参与同事务，不成为第二 scheduler。settlement 简易床/休息位只选 native-over-time，**不清饥饿/毒、不刷新敌人/物品、不保命复活**；原 combat 篝火保留既有 full-on-complete 行为和自身资格/收据（兼容 adapter），不把两种恢复偷偷统一成满血。损伤/移动/死亡/威胁/失能/离层/目标毁坏统一中断，不发“完成”事实。

## 8 单独冻结给 5B 的 SDK 子集

只有这一节的 module-bound SDK、上文定义 DTO、ItemRead/ContainerRead/StationRead/WorldResult 可派发 dot；LevelRecord/OfflineInput/结构写口/可信 scope 工厂不进入 crafting 自有代码。底座通过 module context 提供 `worldWork: WorldWorkSDK`；owner 从该 context 绑定，actor 从原生执行 scope 决定。SDK 对纯准备和同步提交分权，UI 得到只读查询/预览，没有 commit 方法。

```ts
export type KnownWorkQuery = Readonly<{ kind: 'node'; id: WorldId }>
  | Readonly<{ kind: 'station'; id: WorldId }>
  | Readonly<{ kind: 'inventory' }>;
export interface WorkContext {
  contract: 'C5-1'; owner: ModuleId; actorId: EntityId; levelRef: LevelRef;
  at: Position; revision: Revision; available: boolean;
  node: ResourceNodeRecord | null; stations: readonly StationRead[];
  inventory: readonly ItemRead[]; containers: readonly ContainerRead[];
  activeTicket: WorkTicket | null;
}
export interface TransferRequest {
  source: ItemOwnerRef; destination: ItemOwnerRef;
  items: readonly Readonly<{ itemId: EntityId; count: number }>[];
  revisions: readonly RevisionStamp[];
}
export type TimedWorkRequest = Readonly<{ kind: 'harvest'; nodeId: WorldId;
    revision: Revision; destinationId: WorldId | null }>
  | Readonly<{ kind: 'craft'; recipeId: DefinitionId; batchCount: number;
    stationId: WorldId | null; sourceContainerId: WorldId | null; revision: Revision }>;
export interface ResourcePlacementRequest {
  definitionId: DefinitionId; instanceKey: string; levelRef: LevelRef;
  candidates: readonly Position[];
}
export interface StationPlacementRequest {
  definitionId: DefinitionId; at: Position; revision: Revision;
}
export interface CancelWorkRequest { ticketId: WorldId; revision: Revision }
export interface StartupItemsRequest {
  instanceKey: string; items: readonly ItemAmount[]; overflow: 'floor-or-skip';
}
export interface StartupGrantReceipt {
  owner: ModuleId; instanceKey: string; result: 'granted' | 'skipped';
}
export interface CommittedWorkFact {
  owner: ModuleId; factId: number; ticketId: WorldId; completionOrdinal: number;
  definitionId: DefinitionId; actorId: EntityId; completedBatches: number;
  result: 'completed' | 'interrupted'; reason: string | null;
}
export interface WorldWorkSDK {
  readonly contractVersion: '1.0.0'; readonly owner: ModuleId;
  readWorkContext(query: KnownWorkQuery): WorldResult<WorkContext>;
  queryStations(): WorldResult<readonly StationRead[]>;
  queryContainers(): WorldResult<readonly ContainerRead[]>;
  planMaterialTransfer(request: TransferRequest): WorldResult<WorldPlanHandle>;
  planTimedWork(request: TimedWorkRequest): WorldResult<WorldPlanHandle>;
  planResourcePlacement(request: ResourcePlacementRequest): WorldResult<WorldPlanHandle>;
  planStationPlacement(request: StationPlacementRequest): WorldResult<WorldPlanHandle>;
  planCancelWork(request: CancelWorkRequest): WorldResult<WorldPlanHandle>;
  planStartupItems(request: StartupItemsRequest): WorldResult<WorldPlanHandle>;
  commitWorldWork(plan: WorldPlanHandle): WorldResult<WorldCommit>;
  subscribeCommittedWork(handler: (fact: DeepReadonly<CommittedWorkFact>) => void): () => void;
}
export interface WorldDefinitionRegistration {
  registerItemDefinitions(rows: readonly ItemDefinitionContribution[]): WorldResult<null>;
  registerResourceDefinitions(rows: readonly ResourceDefinition[]): WorldResult<null>;
  registerStationDefinitions(rows: readonly StationDefinition[]): WorldResult<null>;
  registerRecipes(rows: readonly RecipeDefinition[]): WorldResult<null>;
}
```

SDK `commitWorldWork(plan)` 与可信函数 `commitWorldWork(plan,scope)` 是同一实现的 module-bound adapter，scope 不交给 UI，也不让玩家 payload 带 actorId。注册接口只在已启用模块的初始化/定义预检同步 scope 可用；先一次校验整包引用和合计预算再整体发布，不允许部分注册后继续游戏。definition contribution 最终挂在 descriptor/module 的明确字段，5A2 提供原型和 fixture，dot 不手改全局发现器。planStartupItems 只在新局初始化的首次真实入层可信 scope 可用，不能从玩家公开命令/load/replay查询调用；每owner最多1个固定定义清单，owner+instanceKey收据持久在startupGrants且不滚动淘汰，首次入层重放沿真实新局同路径执行一次，不能重复发。溢出只用合法地面或明确skip，不覆盖旧物品。subscribe 只发已提交该 owner 的公开工作事实；handler 只读，不能在 notification 内启动新世界事务/调用 setState/RNG，模块工作收据在可信提交参与者中写入；取消订阅随 unload。

`readWorkContext/query*` 只暴露当前行动者已知/同层/有权限的 DTO，不扫描远方库存，不通过查询推进再生/离线；prepare 的机械结算只能在真实 command/可信 world boundary。WorkContext.revision 是 world5.revision 的 CAS：任何世界机械写入/影响工作资格的actor变化递增，计划内部再包含每个源容器/node/station/ticket 的 revision，不靠单个全局数掩盖资源变动。harvest payload 的 revision 精确为 node.revision，cancel-work 为 ticket.revision，craft/place-station 为 WorkContext.revision；准备若先结节点/离线导致CAS失效，返回C5_STALE并让前端重取DTO，不暗中按新数量接受旧确认。craft 默认输出到当前行动者背包；居民 internal-work 可由底座订单 adapter 指定箱，公开 crafting payload 不接受任意输出数量/结果。

公开格式固定：`executeCommand('ext:command', JSON.stringify({module:'crafting',action,payload}))`。

```ts
export type CraftingCommand = Readonly<{ module: 'crafting'; action: 'harvest';
    payload: Readonly<{ v: 1; nodeId: WorldId; revision: Revision; destinationId: WorldId | null }> }>
  | Readonly<{ module: 'crafting'; action: 'craft'; payload: Readonly<{ v: 1;
    recipeId: DefinitionId; batchCount: number; stationId: WorldId | null;
    sourceContainerId: WorldId | null; revision: Revision }> }>
  | Readonly<{ module: 'crafting'; action: 'place-station'; payload: Readonly<{ v: 1;
    definitionId: DefinitionId; x: number; y: number; revision: Revision }> }>
  | Readonly<{ module: 'crafting'; action: 'cancel-work';
    payload: Readonly<{ v: 1; ticketId: WorldId; revision: Revision }> }>;
```

模块只选择已注册 recipe/node/台，不提交物料 delta、任意 nativeTemplate、actorId、workTicks 或产出计数。材料不足/满包/No/过期/坏 payload 0成本。手采100 tick/1单位、材料stack99、手工/桌/炉三类 station，+0已知普通装备/口粮/床箱台套件、无概率/品质/XP、配方≤128已固定；具体数值表见报告供批准。采集节点单格非阻挡，矿点不挖任意墙；placement 使用真实生成 reservation 或可信运行 scope，candidate 从引擎选取而非公开玩家伪造。

5A2 的独立台是 foundation 单格**非阻挡** StationRecord + world interactable，不依赖房间/settlement，也不冒充已完成结构碰撞。5A3 以后台可绑定 fixture component，position 改为结构引用，几何只有一份；需工坊/通风的后续配方通过公开资格 tags 软查询。首批 crafting 桌/炉配方均在无 settlement 时可完成，不能把未实现房间接口变成隐藏硬依赖。工具必须实际持有、每批成功才耗耐久；破损工具停止下一批，已完成不回滚。

## 9 预算、验证与实现完成条件

定义/DTO的其余字段校验冻结如下：ItemAmount清单1…8项、count=1…99且同清单definitionId不重复；配方inputs/outputs非空（不支持无料生产），tags≤16个；resource yield1…8项、capacity1…9999、unitsPerHarvest1…99且≤capacity、harvestTicks1…10000，periodic.units1…99/intervalTicks1…1000000，0≤reservedUnits≤remaining≤capacity、再生余数0…intervalTicks−1（满容量时0）。工位tags非空，placementTicks1…10000。结构maxHp1…1000000、0<hp≤定义maxHp；抗性是0…100整数百分比、返还分子0…分母（1…10000），首版比例1/2。RestPoint.restTicks1…1000000、interactionDistance0…16。所有跨对象清单按真实预算限制长度，references唯一/存在/owner启用/层一致；加乘前检查MAX_SAFE_INTEGER，delta仅可信计划可为负。

WorldCommit.chargedTicks表示此次接收的总耗时义务（timed-work为整批计划时长、转移100、取消/初始化0），不是在prepare/commit内另加世界钟；唯一scheduler/原生行动提交点以后按真实elapsed落账。cancel-work是允许忙态进入的窄命令，只能取消当前玩家自己的可取消ticket，不能借取消打断另owner战斗或NPC。终结ticket在关联/输出/退款全部解除后可回收，已用ID/完成高水位不重用，旧请求拒绝而不再兑付。公开WorldReceipt历史最多128，去重凭根的单调ID/高水位、仍活的ticket/plan状态及稳定startup/node收据，不依靠滚动历史保持全部旧对象。新增容量超过预算应在发布前拒绝，不能靠清历史释放实体额度。

| 项目 | C5-1 固定约束 |
| --- | --- |
| 层 / site | 40 dungeon + 首版最多1个可选site，79×29；5A1 site尚未执行 |
| 营地 / region | 8 / 全foundation128；同层1，初始9×9，最大24×20 |
| 结构 | 每营地384格、全局3072格、12288部件；不是8×480有结构格 |
| 居民 | 每营地16、整局64；所有在场/缓存/护送/暂存都计；当前真实活动实体128/空间格512继续有效 |
| 箱 / Item roots | 每营地16箱、每箱64槽；全局8192，escrow/refund/remains也计，不是只计箱内 |
| 节点 / 包 | 每层32、整局512；配方128；材料/工具/台合计128 |
| 工作 / 经济 | 每居民1活跃ticket、每营地32订单；每批量1…16；每epoch最多1024完成；每补给单最多32epoch |
| 事件 / 通知 | 每营地1未结袭击、全局4；公开历史128，ordinal永不因滚动淘汰/拆营归零 |
| 施工 / 房间 | 一命令一格、UI草稿16格；房间2…128格，全层四邻域重算 |

8营地×16居民=128属于**超预算压力样本**；预算内八营地可以各8人，或4个16人+4个无人营地。24×20是region面积上限，不是每营地可有480结构格。满128箱×64槽恰为8192，若另有原生 Item/escrow则已超全局预算，需保留空槽而不能暗中突破。这些关系也是坏档/发布前守卫。

5A1–5A3 必须验证：零启用机械/RNG不变，真实Game安全点、save/load/replay/seek/续录；重复/陈旧/确认No/跨层/终局/坏档在退休旧局前拒绝；在场/NPC一次prelude与正耗时；离线分段/长尾/精度切换/跨层写边界；物品和预留守恒；同步多provider失败注入下全对象图、引用身份、ID/计数/RNG/消息/缓存恢复。不得以只比JSON的测试代替独立写集差分。

5A0 类型草案检查只说明声明互相可解析，不说明任一功能可用。正式SDK派发须由5A2提供**真实导出文件、固定fixture、精确commit/SDK hash/版本和执行门禁结果**。5A1–5A3的拆分/具体门禁、新版录像设计、5B完整任务包与数值审批表见[5A0报告](phase5a0.report.md)。
