# C5-1：阶段 5A 合同冻结草案（r2）

日期：2026-10-06。合同标识 **`C5-1 / 1.0.0`**，文档修订 **r2**（取代 r1；r1 从未实现或发布，因此首次实现时版本串仍为 `1.0.0`，不另开 1.0.1）。来源是已批准的[阶段 5 设计](phase5-settlement-world.md)（P5-D01–D14 全 A）、[5A0 任务书](phase5a0.task.md)与一份针对 r1 的独立评审（B1–B4、I1–I11、M1–M9 及顺序意见），评审中的取舍已由维护者裁定，本文照裁定落实。本文冻结供 5A1–5A3 实现、5B 派发使用的名称、字段及行为，不表示这些 API 已实现。数值内容表见 [5A0 报告](phase5a0.report.md) §5（已批准，r2 修订见该报告末节）。

## 0 r2 修订记录

| 评审项 | 本文落点 | 摘要 |
| --- | --- | --- |
| B1 玩家长工作 vs 输入/回合语义 | §8 新增、§5 票据、§7 | 每批一个 bundle（≤10000 tick）+ `auto_work` 续作；每批一条录像命令；续作可被打断/取消并退款未开始批次；RestPoint 原生回血复用 auto_rest |
| B2 CAS 版本 | §4.2 新增 | 只比较计划触及对象的版本集合；惰性再生物化不递增 CAS 版本；world5.revision 仅诊断、永不进 payload；逐命令列出 CAS 键 |
| B3 5B SDK 不完整 | §9 重写 | (a)–(j) 全部冻结为签名+调用时机表；5A2 交付骨架示例模块与无头 harness |
| B4 ID 空间 | §2.1、§5、§6、§7 | RegionId=EntityId；节点/工位/RestPoint 以其 interactable 的 EntityId 为唯一身份；一个对象不持两个 ID |
| I1 冻结生态 vs 跨层写 | §3.5 | 管理层冻结 monstersApproachStairs 倒计时/迁出；居民排除出 scheduleLevelFollowers；离线结算先于 restoreFallenItems |
| I2 冻结离线输入无家 | §3.3 | 离场摘要持久在 ledger.frozen；EconomicOrder 进 World5Snapshot；remainingEpochs 只在订单；长尾以逐 epoch 迭代为规范定义 |
| I3 双倒计时 | §5.5 | bundle 存活时 ticket.remainingTicks 是派生镜像，load 校验相等；bundle 保持 depth 至 5C2；nextActionId 于 5A2 随动作根迁出 |
| I4 篝火 vs RestPoint | §7、§11 | combat 篝火仍归 combat；RestPoint 是独立 foundation 记录；5A2 加 WorldRestProduction/篝火回归 |
| I5 背包语义 | §5.1 | FOOD 按 quantity 占格；native 输出不带模块字段；unitWeight 移出机械包 |
| I6 8192 | §5.3、§10 | 8192 是 C5 操作接纳预算，为原生物品留余量；load 只校验 C5 自有根 |
| I7 录像摘要成本与存储 | §10.2 | 逐事件只摘 dirty 域+廉价诊断；完整原生摘要只在 256 命令块边界/快照点；经典局不增逐事件成本；同库 `brogue-web-saves` 新 store；64 MiB 按录像计 |
| I8 精确 foundation 匹配 | §1.2、§9(h) | crafting 声明 `worldSdk: 1` 独立检查；foundation 号用导出常量；版本计划表 |
| I9 5A2-S 余量 | §5.1、§5.6、§7、§11 | 劳动信用固定 elapsed×1；回血读管线键；统一 Item 扩展模型与 stacksWith；全 Item 根枚举器；combat 格式变化合并一次 |
| I10 seedKey 可重掷 | §3.4 | seedKey 用稳定营地 slot，去掉 instance/levelKey；新增固定向量 |
| I11 simulationTicks 提交点 | §3.1 | 指名 advancementLoop 中 `soonestTurn>0` 分支；yield/中止/坠落记账；仅由新局 manifest 决定启用 |
| M1–M9 | §1.3、§3.4、§5、§6、§7、§2.2；报告 r2 节 | 函数名/行号、空 regions 删键、interactable 1024 账、保护格、ItemRead 词汇与 factId、rest 去重与订单 ID 类型、canonical JSON 规范、报告 codec 号改候选、LevelRecord 覆盖与 generatedBy |
| 顺序意见 | §11 | 5A1-R 硬前置 5A2；5A2 加篝火回归；5B 派发前冻结清单；5A2-S 不改 C5 DTO 且集成时重跑 dot trace；5A3 保持工位邻接不变 |

## 1 基线、版本计划与事实纠正

### 1.1 基线

代码事实以 **foundation 协议 5 的 `7f6de96`** 为准（r2 在只读工作树 `BrogueJS-qa`，detached 于该提交逐项复核）。设计分支 HEAD 不含该提交；5A1 开工时由集成人提供实际收尾候选 commit 并重核本节，不得在设计分支合并生产代码。

| 项目 | 基线 `7f6de96` | 5A 计划 |
| --- | --- | --- |
| manifest / foundation | schema=1 / **5**（`src/ext/descriptor.ts` 键白名单含字面量 `foundation: 5`） | 见 §1.2 版本计划 |
| growth / narrative / combat / giants module·rules | 1.7.0 / 1.4.0 / 1.5.0 / 1.0.0 | 5A1 不改；combat 格式变化见 §1.2 |
| narrative state / input | 4 / 2 | 不改 |
| 整局 / 实体 envelope / 录像 / 来源 | whole-run-v3 / 3 / 3 / RecordingOrigin 1 | 见 §1.2 |

模块没有统一的独立 input/display/state 版本槽，不能虚构“所有模块 state=1”。growth 的 GrowthState 无独立 schema 号；combat 的 scheduler、resource、bonfire 等子状态各有校验；narrative 的 displayVersion 来自显示包。所有旧格式统一拒绝，不迁移，不剥离缺失模块续玩。

### 1.2 版本计划（计划表；最终号码在各步实现时分配并登记）

| 步骤 | 计划分配 | 条件 |
| --- | --- | --- |
| 5A1 + 5A1-R（同一格式批次） | foundation **6**；whole-run **v4**；录像 **4**；RecordingOrigin **2**；实体 envelope 仅在确有实体字段/根变化时随批次升 4 | 必然发生（新增 run.world5/录像格式） |
| 5A2 | foundation **7** | 仅当保存格式确有变化（预计会：MATERIAL、容器/escrow 根、`run.actorActions`、`Item.worldItem`） |
| 5A2 combat 格式 | combat state/module 版本只升一次 | 5A2 的 scheduler/nextActionId 迁出与 5A2-S 的容量物化合并为同一 combat 格式变化；若 5A2-S 取消或推迟，由维护者在 5A2 单独分配 |
| 5A2-S | foundation/growth/combat 号仅在其格式变化时升 | 不预占；不得改任何 C5 DTO（§11） |
| 5A3 | foundation 号仅在其格式变化时升 | 结构根/region revision 预计需要 |

子里程碑之间不得各自升号或使用临时号。为避免 foundation 号变化强迫 crafting 改文件（I8）：

- 5A1 在把协议升到 6 时从 `src/ext/descriptor.ts` 导出 `FOUNDATION_PROTOCOL` 常量，既有四模块 descriptor 改为 `foundation: FOUNDATION_PROTOCOL`（只改这一处，不改其 module/rules/state 版本）；之后新模块同样引用常量。
- 使用世界 SDK 的模块另在 descriptor 声明 `worldSdk: 1`（§9(h)），由 runtime 独立检查。SDK 合同不变时 foundation 格式号升级不要求模块改动；若仍有字面量兼容字段需要更新，由本地集成人在集成时修改，dot 不改共享文件。
- 存档/录像中的 manifest foundation 号仍精确匹配（格式绑定），与模块 SDK 兼容号是两件事。

### 1.3 代码事实与新能力缺口（均指 `7f6de96`）

| 引用 | 事实 / 缺口 |
| --- | --- |
| `src/ext/types.ts` ExtensionManifest / ExtensionSnapshot；`runtime.ts` snapshot / validateSnapshot | foundation 精确为 5；snapshot 每次完整 structuredClone 模块/组件/foundation 世界状态 |
| `src/ext/runtime.ts:209` | `Conflicting actor action providers`：单一 actorActions provider；`:210` stateField 必须为 `scheduler` |
| `src/ext/runtime.ts:1366–1384`（owned region 发布）、`:1435–1447`（placeInteractables） | region 与世界 interactable 都用 **`allocateEntityId()`**（实体分配器），interactable 全局上限 `WORLD_INTERACTABLE_LIMIT=1024`（`world.ts:35`），单次请求≤256 |
| `src/ext/world.ts:69` | validWorldSnapshot 拒绝 region id 与 interactable id 相同——两者同一 ID 空间 |
| `src/ext/regions.ts:31–32` | validOwnedRegions 要求非空数组、≤128、depth-only 矩形、不重叠；尚无运行期建立/扩张/撤销事务 |
| `src/ext/world.ts:27` ExtensionProjectionContext | 只有 state/depth/turn/visible·nearbyInteractables/queryOptional/worldRestUnavailable；**没有 worldWork 读入口** |
| `src/ext/types.ts:157–166, 305–306`；`runtime.ts:1157–1185`；`Game.ts:3723–3750` | `prepareControlledCommand` 只能返回 attack/move/wait/search 的 ControlledActionRequest；确认答案以 `recordDecision:false` 收集，执行时重准备并比较 canonical，经 requestConfirm 记录一次 |
| `src/ext/types.ts:225`；`modules/combat/bonfires.ts:19–80`；`ext/worldSpatial.ts:8–25` | 世界对象在 `enteredLevel` 钩子的同一 foundation 事务中放置；候选格按到入口距离/y/x 确定排序，**不抽 RNG** |
| `Game.ts:3348–3390` `recordInputEvent` / `updateRecordedCheckpoint` | 每事件完整 `extensionRuntime.snapshot()`；经典局（无 runtime）只记 tick/depth/player/turn/rng，无 extensions |
| `Game.ts:4200` | `source==='player' && isInputLocked()` 时输入被忽略（不录制） |
| `ActorActionProduction.ts:155–157` | 玩家为 decision owner 的 bundle 存活即 `productionActorActionInputLocked` |
| `Game.ts:651, 14223–14290`；`Game.ts:11166/11473`；`u03-state-contract.json` autoAction | auto_rest/search_long/run：首步属发起命令，后续每步是一条录制的 `auto_step` 命令；`disturbed` 停止；autoAction 随 run 持久 |
| `TimeCoordinator.ts:118–150` advancementLoop | `soonestTurn>0` 时 `bodies.advanceElapsed`（:147）与 `actions.advanceActionTime`（:149）；客观块每 100 tick；`finishTurnEpilogue`（:549）每命令一次 |
| `Game.ts:1853–1867` monstersApproachStairs | 每个客观块对相邻已访问缓存层的怪物 `entersLevelIn--`，到 1 则迁入当前层 |
| `Movement/LevelTravel.ts:56–100` scheduleLevelFollowers；`GenerationCoordinator.ts:267` | 盟友（含未来居民）随玩家迁层；仅 movementRegionId 绑定者被挡 |
| `GenerationCoordinator.ts:384, 430–436` | 重访缓存层先 `restoreFallenItems()` 再 `catchUpEnvironment(min(...))`；首访 50 次预热 |
| `Items/Inventory.ts:13–16, 37–44` | packCount：WEAPON/GEM 每 stack 1 格，**其余按 quantity 计格**（FOOD 5 份占 5 格）；stacksWith 按 category+kind（consumableId/identityId/name） |
| `Items/Item.ts:11–25` | ItemCategory 止于 GEM=12 |
| `Core/SaveStorage.ts:15–28` | IndexedDB 库 `brogue-web-saves` 版本 1，唯一 store `checkpoint` |
| `App.vue:39, 271, 290` | 录像写 localStorage 键 `brogue-web-replay-v1`（单一当前录像） |
| `WorldRestProduction.ts:57–121, 146–160` | 篝火休息读写 combat `state.scheduler` 与 `state.nextActionId`；中断谓词 dead/moved/level-exit/damage/incapacitated/target-removed/threat |
| `Grid.ts`：refreshTerrainProperties / setTerrainLayer / setTerrain；`DungeonFeature.ts`；`Promotion.ts`；`Environment/Gas.ts` | 四层基础性质，无结构感知 cellProperties；DF/Promotion/Gas 既经 setter 也直接写层/volume |
| `EntitySnapshot.ts` ITEM_FIELDS / collectEntityGraph | 显式字段编码；无容器/escrow 根，无 MATERIAL 扩展字段 |

阶段 3/4 联合最终门禁在另一工作树执行，本节**不声明联合收尾全绿**。

## 2 名称、ID 空间、数据边界与持久路径

拟公开入口 `src/ext/worldSdk.ts`，离线可信入口 `src/engine/Core/WorldSettlement.ts`，结构可信入口 `src/engine/Map/StructureWorld.ts`，测试 harness `src/ext/testing/worldHarness.ts`（§9(i)）。以下各 TS 块组成一份可独立类型检查的声明草案；SDK 返回 DTO 深复制并深冻结。number 的 TS 类型不替代运行期有限、安全整数和范围校验；undefined、未知键、getter、prototype 污染、循环、非 JSON、Promise 均拒绝。

### 2.1 ID 空间（B4）

| 类型 | 分配器 | 用于 |
| --- | --- | --- |
| `EntityId` | 既有 `allocateEntityId()` | Creature、Item、世界 interactable、owned region（**RegionId=EntityId**）；节点/工位/RestPoint/箱的地图存在 |
| `WorldId` | `world5.nextWorldId` | 只用于 world5 内无地图实体的记录：WorkTicket、ContainerRecord、EconomicOrder、StructureComponent |
| `planId` | `world5.nextPlanId` | 只在成功开启补给单/工作时递增 |
| `factId` | 既有 runtime 事实分配器（`ExtensionContext.nextFactId` / `commitFactRange`） | CommittedWorkFact（M5） |

**一个对象只有一个 ID**：资源节点、工位、RestPoint 的身份就是其 interactable 的 `interactableId: EntityId`，记录不再另持 WorldId。箱是两个对象：地图上的 interactable（EntityId）与存储根 ContainerRecord（WorldId），后者以 `position: {kind:'interactable', interactableId}` 指向前者。所有引用带字段类型，禁止把数值相同的 EntityId 与 WorldId 混用。

命名空间 ID 用已存在 validId 语法，长度 1…128，定义 ID 必须以 `owner.` 开头；文本键归启用模块 locale，颜色为 `#RRGGBB`，glyph 为一枚合法文本字形。ID 为 1…MAX_SAFE_INTEGER，revision/tick/ordinal 为 0…MAX_SAFE_INTEGER；递增前检查溢出。规范排序不用 localeCompare：ASCII ID 按码点，整数按升序。

```ts
export type WorldId = number;
export type EntityId = number;
export type RegionId = EntityId;
export type CampSlotId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Revision = number;
export type ContentStamp = string;
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
export declare const WORLD_SDK_VERSION: 1;
export declare function levelKey(ref: LevelRef): string;
export declare function compareLevelRefs(a: LevelRef, b: LevelRef): number;
```

`levelKey` 返回 `dungeon.<decimal depth>` 或 `site.<id>`；depth=1…40，site id 沿 validId。比较 dungeon 先于 site，dungeon 按 depth，site 按 id；编码不含语言/显示名。5A1 接受 site 类型，但未提供 site 适配器的机械调用返回 C5_UNSUPPORTED；5C2 才可创建首个 79×29 site。禁止 depth=0/负数/D41、site 访问 dungeon seed 数组。旧 depth 是 dungeon 的派生适配值，不是第二个可写身份。既有 owned region、interactable、ActorActionBundle 在 5C2 之前继续使用 `depth: number`，不在 5A 提前改为 LevelRef（I3）；5A3 若扩 region 为 LevelRef 须登记格式变化。

### 2.2 持久路径

可选 `GameSnapshot.run.world5` 是 foundation-owned 世界新增账本，内含 World5Snapshot；它不嵌第二份 Grid/Creature/Item。唯一中立动作簿记在可选 `run.actorActions`（5A2 引入，含 bundles 与 **nextActionId**，见 §5.5）。combat 仅保资源/定义/自己的结果收据及 bundle 引用。Item/生物完整行延续实体 codec，新增容器/escrow 仅作为 collectEntityGraph 的根并保存 ID 引用。模块私有政策仅在 `extensions.modules.<owner>`，组件在 `extensions.components[actorId]`。已有 `extensions.foundation.world` 是 interactable/region 根，保持其职责：节点/工位/RestPoint/箱的地图存在仍是该根中的 WorldInteractable，world5 只存其机械记录并以 interactableId 引用；**当最后一个 region 撤销时删除 `regions` 键**而不是写空数组（validOwnedRegions 要求非空，M2）。

```ts
export type PersistenceReason = 'camp' | 'container' | 'resident' | 'work' | 'event';
export type LevelSimulationPolicy = 'native' | 'frozen-ecology-economy-v1';
export type LevelGenerator = 'native-dungeon' | `site-generator.${string}`;
export interface LevelRecord {
  levelRef: LevelRef; generatedBy: LevelGenerator; residence: 'active' | 'cached';
  revision: Revision; lastDepartedTick: Tick | null;
  policy: LevelSimulationPolicy; persistenceReasons: readonly PersistenceReason[];
}
export interface ResidentRecord {
  actorId: EntityId; owner: ModuleId; campSlotId: CampSlotId; levelRef: LevelRef;
  revision: Revision;
}
export interface PendingPlacement {
  owner: ModuleId; definitionId: DefinitionId; levelRef: LevelRef; ordinal: number;
  retriesLeft: 0 | 1;
}
export interface World5Snapshot {
  schema: 1; revision: Revision; simulationTicks: Tick; nextWorldId: WorldId; nextPlanId: number;
  levels: readonly LevelRecord[]; structures: readonly StructureCell[];
  containers: readonly ContainerRecord[]; nodes: readonly ResourceNodeRecord[];
  stations: readonly StationRecord[]; tickets: readonly WorkTicket[];
  orders: readonly EconomicOrder[]; residents: readonly ResidentRecord[];
  restPoints: readonly RestPoint[]; offline: readonly OfflineLedger[];
  pendingPlacements: readonly PendingPlacement[];
  startupGrants: readonly StartupGrantReceipt[]; receipts: readonly WorldReceipt[];
}
export interface WorldReceipt {
  owner: ModuleId; ordinal: number; identity: string; kind: 'startup' | 'transfer' | 'work'
    | 'placement' | 'offline' | 'region' | 'structure' | 'rest';
  levelRef: LevelRef; tick: Tick; result: 'completed' | 'interrupted' | 'skipped';
  reason: string | null;
}
```

**LevelRecord 只覆盖已访问层**（M9）：在一个层首次成为 visited 的同一事务中建立；未访问层不建记录、不进 persistenceReasons 推导。`generatedBy` 是生成器身份：dungeon 恒为 `'native-dungeon'`，site 为 `site-generator.<id>`（5C2）；生成器版本由规则指纹覆盖，不重复在此存版本。`world5.revision` 是**纯诊断计数**（任何 world5 写入递增），永不进入命令 payload 或 CAS（B2）。

world5 是否存在**只由新局 manifest 静态决定**（I11）：manifest 中有声明 `worldDefinitions`/`worldSdk` 的模块，或 5A1 的仅测试 fixture，新局初始化时物化 world5 与时钟（初值 0）；否则永不物化、不推进新计时、不注册新随机/抽样域。load 校验 world5 存在与否和 manifest 一致；运行中不可开启/关闭。不以空数组字段把旧组合“伪启用”。scheduler 中立迁移（`run.actorActions`）可供既有 combat 使用，其存在条件与 world5 分开。新增 Game/Item/Creature 持久字段登记 U03/实体字段合同；派生 room/FOV/route 不进持久根。

一个真实层只有一个承载者：活动层 Game 字段或缓存 LevelState，不能同时保有可写 Grid 别名。LevelRecord 是索引不是地图副本；persistenceReasons 为唯一真实引用推导的规范集合；撤销最后营地仍保留 visited 层和生成身份。层转移、实体/Item pending roots 与组件跨引用在退休旧局前验证；持久性理由不能授权删除已访问层或按 seed 载回。

## 3 simulationTicks、两种精度与离线 planner

### 3.1 唯一提交点（I11）

`simulationTicks` 的唯一提交点冻结为 `TimeCoordinator.advancementLoop` 每一圈中 **`soonestTurn > 0` 的同一处**：紧随 `ports.bodies?.advanceElapsed(soonestTurn)` 与 `actions.advanceActionTime(soonestTurn)`（`7f6de96` 第 147–149 行），在客观块 `ticksTillUpdateEnvironment -= soonestTurn` 之前，经新的可选端口 `ports.worldClock?.advance(soonestTurn)` 增加。该调用不依赖 `actions` 是否存在（无 actorActions provider 的 world fixture 也计时），在 world5 不存在时端口缺席。

- 一圈只加一次；NPC 数、群成员、环境块、工作/休息回调都不另加。
- **yield**：客观块内为动画暂停 `yield` 时，本圈 elapsed 已在 yield 之前提交；恢复后继续同一圈，不重复加。
- **中止**：生成器在 yield 处被退休（`suspended` 分支不发布客观块收尾），已提交的 elapsed 与同圈已扣的怪物 `ticksUntilTurn`、`advanceActionTime` 同属一个已发生的事实，不回滚；钟永远与这些计时一起前进，不能单独补加或单独回退。若某路径会丢弃整个候选 Game（读档/坏档），钟随 Game 一起丢弃。
- **坠落返回**：`playerFalls()` 后 `continue` 进入下一圈，下一圈按其自身 `soonestTurn` 计时；坠落/落地本身加 0。
- 100 tick 原生客观块保持；经济 epoch=`floor(simulationTicks/1000)`。load/UI/墙钟/生成预热/原 catch-up/seek 本身都不推进钟；seek 重放真实历史正耗时命令仍按原 elapsed 重建同一时钟。`currentTick`、`absoluteTurnNumber` 沿旧用途，三者不互相覆写。零时间管理命令不能给工作信用、续补给单或重置事件窗口。

### 3.2 在场精度

在场以原动作实际正耗时累积劳动信用，**C5-1 固定 laborCredit = elapsed × 1**（I9）；将来若引入工作速度属性，键名预留为 `foundation.labor-rate`（5A2-S 管线之后另批，C5-1 不读取）。在场 NPC 工作沿票据调度（§5.5）；玩家计时工作见 §8。

### 3.3 离线 DTO（I2）

```ts
export interface EconomicOrder {
  id: WorldId; owner: ModuleId; actorId: EntityId; levelRef: LevelRef;
  definitionId: DefinitionId; priority: number; planId: number; remainingEpochs: number;
  ticketId: WorldId | null; status: 'working' | 'stopped' | 'needs-resupply';
  stopReason: string | null; revision: Revision;
}
export interface OfflineResidentFrozen {
  actorId: EntityId; bedComponentId: WorldId | null;
  route: Readonly<{ reachable: boolean; distance: number; travelTicks: Tick }>;
}
export interface OfflineResidentState { actorId: EntityId; alive: boolean; shortage: 0 | 1 | 2 | 3 }
export interface OfflineFacility {
  componentId: WorldId; definitionId: DefinitionId; hp: number; maxHp: number;
  roomEligible: boolean; ventilated: boolean; reachable: boolean;
  tags: readonly string[];
}
export interface OfflineFrozenSummary {
  capturedTick: Tick; rulesFingerprint: string; structureRevision: Revision;
  residents: readonly OfflineResidentFrozen[]; facilities: readonly OfflineFacility[];
  knownThreats: readonly string[];
}
export interface DeferredOutput {
  ticketId: WorldId; availableEpoch: number; destinationId: WorldId;
  items: readonly ItemAmount[];
}
export interface OfflineLedger {
  levelRef: LevelRef; campSlotId: CampSlotId; lastSettledTick: Tick; epochRemainder: number;
  revision: Revision; seedKey: string; lastEventOrdinal: number;
  residentStates: readonly OfflineResidentState[];
  pendingOutputs: readonly DeferredOutput[]; needsResupply: boolean;
  frozen: OfflineFrozenSummary;
}
export interface OfflineRules {
  epochTicks: 1000; maxPlanEpochs: 32; maxCompletionsPerEpoch: 1024;
  foodUnitsPerResident: 1; rationDefinitions: readonly DefinitionId[];
  nodeDefinitions: readonly ResourceDefinition[]; recipes: readonly RecipeDefinition[];
  shortageEfficiencyNumerators: readonly [number, number, number, number];
  efficiencyDenominator: number;
}
export interface OfflineEvent {
  id: string; absoluteEpoch: number; ordinal: number; kind: 'raid' | 'work-stop';
  policy: JsonValue;
}
export interface OfflineInput {
  schema: 1; rulesFingerprint: string; runSeed: string; campSlotId: CampSlotId;
  level: LevelRecord; fromTick: Tick; toTick: Tick; ledger: OfflineLedger;
  rules: OfflineRules; containers: readonly ContainerRead[];
  nodes: readonly ResourceNodeRecord[]; tickets: readonly WorkTicket[];
  orders: readonly EconomicOrder[]; pendingEvents: readonly OfflineEvent[];
}
export interface OfflinePlan {
  contract: 'C5-1'; planId: number; levelRef: LevelRef;
  fromTick: Tick; toTick: Tick; sourceRevision: Revision; inputDigest: string;
  nextLedger: OfflineLedger; nextOrders: readonly EconomicOrder[];
  nextNodes: readonly ResourceNodeRecord[];
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
export declare function offlineSeedKey(runSeed: string, campSlotId: CampSlotId,
  domainId: string, rulesFingerprint: string): string;
```

持久归属（不重复）：

| 数据 | 唯一持久位置 | 说明 |
| --- | --- | --- |
| 离场冻结摘要（路线、床、设施资格、已知威胁、结构 revision） | `ledger.frozen` | 在离开该层的安全点由引擎从真实部件/房间/路线**一次**计算并写入；planner 只读它，**不在结算时重新推导**；重访并结算后在下次离开时重写 |
| 居民动态（存活、短缺 0…3） | `ledger.residentStates` | 由 planner 推进 |
| 订单（含 `remainingEpochs`、`planId`） | `world5.orders` | **remainingEpochs 只在订单**；ledger 不再复制 planId/remainingEpochs |
| 节点/票据/容器 | `world5.nodes/tickets/containers` | input 是这些根的冻结只读投影 |

离线接口只向引擎可信适配器开放，不进入 module UI 的 public context。rules 从已启用机械定义构造，不能由保存自带数值授予能力；load 时校验 `ledger.frozen.rulesFingerprint` 与当前规则指纹一致。shortageEfficiencyNumerators 是等级 0…3 的四个定点分子（0 档等于分母、2/3 档为 0），具体 1 档值留 5D 数值任务审批。knownThreats/pendingEvents.policy 承载有界领域政策 JSON，schema 由该 owner 的已安装定义校验，不允许任意脚本。

经济核按绝对完整 epoch 依次：上周期产物可用 → 按 actor ID 发真实口粮/分床 → 资格/预留/仓容 → 稳定 priority/job/actor 顺序的信用及批次 → 一个登记事件窗口 → 余数/高水位/停止原因。产物在下一 epoch 才可作他单输入；一件 Item 不能同时喂居民与补玩家 nutrition。固定政策下支持 0/999/1000/1001 tick、31/32/33 周期和任意中间分段；比较全部余数、预留、收据、ordinal 与随机键，满足 `S(t0,t2)=S(S(t0,t1),t1,t2)`。

remainingEpochs=0…32，属于补给单整个生命周期；fromTick 必须等于 ledger.lastSettledTick，epochRemainder 必须等于 lastSettledTick % 1000，toTick≥fromTick 且≤当前权威 simulationTicks。处理调用、查看、重访、load 不重置。**长尾的规范定义是逐 epoch 迭代**：订单耗尽后，每个后续 epoch 只做口粮发放/短缺饱和（0…3）/节点再生/pendingOutputs 可用。实现可以用闭式算式跳过任意多个 epoch，但其结果必须与参考逐 epoch 迭代器逐字段相等；测试用仓库内的参考迭代器（仅测试）在边界和随机分段上对照，闭式实现不得成为第二份规范。对已经计算到 toTick 的重复计划为同一提交收据的幂等 no-op；旧 revision 的不同计划报 C5_STALE，不重抽、不重复发物。

### 3.4 离线抽样与 seedKey（I10、M7）

**canonical JSON（M7）**：本文所有 SHA-256 输入都是 ECMAScript `JSON.stringify` 对仅含字符串与安全整数的数组/对象的输出（对象键先按码点排序）：紧凑分隔符（`,` 与 `:`，无空格），字符串原样 UTF-8，**非 ASCII 不做 `\u` 转义**，只有 `"`、`\` 与 U+0000–U+001F 按 JSON 必需规则转义（`\b\f\n\r\t` 短形，其余 `\u00xx` 小写），不得含孤立代理项。这等于 Python `json.dumps(x, ensure_ascii=False, separators=(',',':'))` 对同类输入的输出。

离线抽样算法 `sha256-c5-offline-v1`：对 `["c5-offline-v1",seedKey,absoluteEpoch,eventKind,ordinal]` 取 SHA-256，首 4 字节**大端 uint32**，输出 0…2^32−1。

seedKey（`c5-seed-v1`）= SHA-256 of `["c5-seed-v1",runSeed,campSlotId,domainId,rulesFingerprint]` 的 64 个小写十六进制字符。**campSlotId 是稳定营地 slot（0…7）**，不是会随拆建改变的营地实例 ID，也不含 levelKey；同一 slot 拆营重建得到同一 seedKey，且 absoluteEpoch/ordinal 高水位不归零，因此不能通过重建重掷（I10）。runSeed 是引擎规范十进制字符串；epoch/ordinal 为安全非负整数；不使用 JS hash/Math.random/全局 RNG。需要范围抽样的 adapter 用版本化拒绝抽样（`limit = 2^32 − (2^32 mod n)`，≥limit 时 ordinal 递增再抽），不直接 `% range`。算法 ID/领域规则纳入指纹。本步没有给旧双流增加调用。

r2 用 Python 标准库与 Node 24 `JSON.stringify`+`crypto` 两种实现独立复算（不是生产 API 测试）：

| 函数 / 输入 | 输出 |
| --- | --- |
| offlineDraw(64个0, 0, raid, 0) | 首4字节 `09531fcc` → **156442572** |
| offlineDraw(64个0, 1, raid, 0) | `7c77d260` → **2088227424** |
| offlineDraw(64个f, 9007199254740991, work, 9007199254740991) | `4719c5ff` → **1192871423** |
| offlineSeedKey("51005000", 0, "raid", 64个0) | `b805996d1d733cdc9a239db3c0549af9adb33eb68128c567df35d86af0e57be1` |
| offlineSeedKey("51005000", 7, "raid", 64个0) | `caab464d66c5b7f81ce79e3e26df67961e0983e52ce6c24bd6bb63cde42589c8` |
| offlineSeedKey("51005000", 0, "work", 64个0) | `3eb323a663f1e34d6083d7ab803682e8e2633a5b71233dd09478fe0c2173bdd5` |
| offlineSeedKey("1", 3, "settlement.raid", 64个f) | `847315b5921d3d55464c8068e10475fff4ab1eab54904b6d2deacbaba3b6be49` |

实现测试还须冻结：空 seedKey/超长/非十六进制拒绝、负数/非安全整数拒绝、campSlotId 越界拒绝、含非 ASCII 的 domainId 拒绝（validId 语法）以及 canonical JSON 的转义向量。

### 3.5 管理层政策与跨层写入顺序（I1）

管理层（policy=`frozen-ecology-economy-v1`）离场冻结原生火/气/液体/非工作生物/HP/状态/combat 资源，**替代**该层重访时最多 100 次 `catchUpEnvironment`；其他地牢层保持原路径，首次 50 次预热保持。离开时危险岗位停工，返回危险仍在。节点在非管理层也可惰性再生（§5.4），不因此把该层改为管理层政策。

现有三条跨层写路径在管理层上的规则：

1. **monstersApproachStairs**（`Game.ts:1855`）：对 policy 为管理层的相邻缓存层，**跳过整层**——既不 `entersLevelIn--`，也不 `monsterEntersLevel` 迁出。倒计时冻结，返回后从冻结值继续。非管理层不变。
2. **scheduleLevelFollowers**（`LevelTravel.ts:56`）：在 `world5.residents` 中登记的居民（显式标志）一律不安排跟随，与 movementRegionId 绑定者同样被跳过（不触发 regionBlocked 通知）。实现方式是给该函数新增“排除谓词”端口，不改 Monster 字段。玩家的其他盟友仍按原规则跟随，并在入层序列中**于结算之后**落位。
3. **restoreFallenItems / pendingFallenByDepth**（`GenerationCoordinator.ts:430`）：管理层重访时顺序改为 **离线结算（计划+提交）→ restoreFallenItems → pending 坠落生物 → 不跑 catch-up**。玩家不在时坠入管理层的物品/生物始终停在 pending 根，只在结算之后写入层。

入层事务：冻结离开层（写 `ledger.frozen`）→ 移交目标唯一真实承载 → 旧区间纯规划与完整预检 → 同步提交世界/模块/收据 → 写入 pending 坠落物与生物 → 玩家落点及跟随者落位 → enteredLevel 放置/事实 → 原命令 checkpoint。load 只验证恢复，禁止 onLoad 产出；保存可带未物化离场区间。玩家终局冻结整局，不为终局页面补结离场经济。

## 4 受控世界事务、CAS 与错误语义

### 4.1 scope 与计划句柄

```ts
declare const scopeBrand: unique symbol;
declare const planBrand: unique symbol;
export type WorldActorScope = Readonly<{ [scopeBrand]: true; owner: ModuleId;
  actorId: EntityId; kind: 'player-command' | 'npc-decision' | 'trusted-world' }>;
export type CasKey = Readonly<{ kind: 'node'; interactableId: EntityId; revision: Revision }>
  | Readonly<{ kind: 'station'; interactableId: EntityId; revision: Revision }>
  | Readonly<{ kind: 'rest-point'; interactableId: EntityId; revision: Revision }>
  | Readonly<{ kind: 'container'; containerId: WorldId; revision: Revision }>
  | Readonly<{ kind: 'ticket'; ticketId: WorldId; revision: Revision }>
  | Readonly<{ kind: 'order'; orderId: WorldId; revision: Revision }>
  | Readonly<{ kind: 'component'; componentId: WorldId; revision: Revision }>
  | Readonly<{ kind: 'region'; regionId: RegionId; revision: Revision }>
  | Readonly<{ kind: 'inventory'; actorId: EntityId; stamp: ContentStamp }>;
export interface WorldPlanHandle {
  readonly [planBrand]: true; contract: 'C5-1'; sessionId: string; owner: ModuleId;
  actorId: EntityId; operation: string; casKeys: readonly CasKey[];
}
export interface WorldCommit {
  operation: string; receiptIdentity: string; ticketId: WorldId | null;
  chargedTicks: Tick;
}
export declare function commitWorldWork(plan: WorldPlanHandle,
  scope: WorldActorScope): WorldResult<WorldCommit>;
export declare function commitOfflineSettlement(plan: DeepReadonly<OfflinePlan>,
  scope: WorldActorScope): WorldResult<WorldCommit>;
export declare function inventoryStamp(actorId: EntityId): ContentStamp;
```

scope 由底座在 executeCommand / NPC 的原生一次自由决策 / 可信迁层边界签发，不能通过 JSON/actorId 构造。handle 是 session-only 身份，模块只能持有，不能造 planID、写任意 Game 或传回结果 delta。纯 prepare：0 tick/0 RNG/0 实体与持久 ID/0 消息。过期 UI、scope mismatch、不同局/owner、已用 handle 在扣料/取随机/ID 前拒绝。成功 commit 消费 handle；失败不允许重用，调用者重新准备。commit 只由引擎调用（§9(b)），模块从不直接提交玩家命令。

### 4.2 CAS（B2）

CAS **只比较 payload 与计划实际触及对象的版本集合**；不存在全局 CAS 数。各版本的递增规则：

| 版本 | 递增 | 不递增 |
| --- | --- | --- |
| node.revision | 放置/移除、预留变化（接收/取消/完成）、采集完成 | **惰性再生物化**（remaining/regenRemainder/lastSettledTick 变化） |
| container.revision | 任何 Item 进出/数量变化/预留变化/位置绑定变化 | 只读查看 |
| station.revision / restPoint.revision | 放置、绑定 fixture、损毁、资格标签变化 | 被使用 |
| ticket.revision | status/completedBatches/预留/escrow 变化 | bundle 存活时 remainingTicks 镜像更新（§5.5） |
| inventory stamp | —（内容派生，无写入口） | — |

`inventoryStamp`（`c5-inventory-v1`）= SHA-256 of canonical `["c5-inventory-v1",rows]` 的前 16 个小写十六进制字符，rows 为该 actor 背包按 inventoryLetter 排序的 `[letter,itemId,category,kindKey,quantity,worldItem.definitionId|null,worldItem.toolDurability|null]`。它由真实背包内容确定，replay 中同样可重算，因此无需给所有原生背包写入口加 dirty 计数。

| 命令 | payload CAS 字段 | 计划 casKeys |
| --- | --- | --- |
| harvest | `nodeRevision`、`inventoryStamp`、`destinationRevision: Revision \| null` | node、actor inventory、目标容器（若有） |
| craft | `inventoryStamp`、`stationRevision \| null`、`sourceRevision \| null` | actor inventory（输出与默认来源）、station（若有）、来源容器（若有） |
| place-station | `inventoryStamp` | actor inventory；目标格不设 CAS，提交时完整重验合法性 |
| cancel-work | `ticketRevision` | ticket |
| 内部 transfer（5C UI/订单 adapter） | 来源与目标各自 revision/stamp | 来源与目标 |
| rest（planRest） | `restPointRevision` | rest-point |

准备阶段若需先物化节点再生（只在可信机械边界执行），这不改变 node.revision，故不会让玩家刚取得的 DTO 立即过期。提交前按 casKeys 逐一比较，任何一个不同即 C5_STALE（0 成本，前端重取 DTO）；可用量、容量、距离、工具等资格另行完整重验，不靠 CAS 代替。

### 4.3 事务写集与错误码

事务写集是显式的 operation union，不向模块开放 `{path,value}` 或任意 patch。任何提交覆盖实际可能写入的当前/缓存层、物品对象/数组/数量/引用、Grid/environment、世界账本、模块 state/components、动作根、实体/world/plan/fact ID、消息与事实队列、双流、空间/光照/会话缓存及旧局恢复身份。同步参与者（§9(g)）参与同一外层事务；缺席/disabled/unsupported 才允许已声明降级，异常/Promise/越权/错误 DTO 报 C5_PROVIDER 且全回滚。

| 错误码组 | 检查 / 结果 |
| --- | --- |
| BAD_PAYLOAD / BAD_DEFINITION / BAD_VERSION | 严格未知键、数组上限、有限整数、引用、locale、版本/指纹；坏包/坏档在退休旧局前拒绝 |
| DISABLED / UNSUPPORTED / SCOPE / TERMINAL | 未启用 owner、未实现 site/软能力、伪 scope/在错误时机调用 SDK、已终局；无写入 |
| STALE / PLAN_USED | session/CAS/one-shot；无写入、无新 ID |
| BUSY / DEAD / GATE / UNKNOWN_TARGET / WRONG_LEVEL / DISTANCE / THREAT | 已有动作/续作、输入屏障、公开已知/同层/交互线/安全资格；未知目标统一反馈，不泄露隐藏阻挡者 |
| TOOL / INPUT / CAPACITY / RESOURCE_EMPTY / RESERVED / BUDGET | 工具标签/耐久、指定库存、输出/退款槽、节点可用量、互斥预留与硬预算；拒绝不截断数量、不淘汰旧世界 |
| OVERLAP / PROTECTED / BLOCKED / ROOM / NEEDS_RESUPPLY | 区域重叠、保护格、房间、订单生命周期；不给免费信用 |
| BAD_TIME / BAD_OWNERSHIP / BAD_REFERENCE / OVERFLOW | 时钟倒退/余数不符、Item 双 owner、跨根孤儿、加乘溢出；绝不自动修补 |
| PROVIDER / TRANSACTION | 参与者或同步发布失败；完整回滚后返回内部错误，玩家只看 i18n 简洁原因 |

零成本指**接收前拒绝**。已开始工作后被打断，已耗游戏时间和已完成批次不倒退；只取消未完成批次并退款剩余输入。提交异常恢复本次写集，但不能把已提交的劳动回合“退款为零时间”。日志/显示发布在成功安全点之后，显示 observer 异常不得回调补扣世界。

## 5 物品、容器、资源点、工位与票据

```ts
export interface ItemAmount { itemDefinitionId: DefinitionId; count: number }
export interface ItemDefinitionContribution {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  category: 'material' | 'tool' | 'kit' | 'native'; glyph: string; color: string;
  maxStack: number;
  nativeTemplate: 'dagger' | 'leather_armor' | 'ration_of_food' | null;
  tags: readonly string[]; tool: Readonly<{ tag: string; maxDurability: number;
    durabilityPerBatch: number }> | null;
}
export interface WorldItemFields {
  definitionId: DefinitionId; quality: 'basic'; toolDurability: number | null;
}
export type NativeItemCategoryName = 'weapon' | 'armor' | 'potion' | 'scroll' | 'food'
  | 'gold' | 'wand' | 'staff' | 'ring' | 'charm' | 'key' | 'amulet' | 'gem';
export type ItemOwnerRef = Readonly<{ kind: 'inventory'; actorId: EntityId }>
  | Readonly<{ kind: 'floor'; levelRef: LevelRef; at: Position }>
  | Readonly<{ kind: 'carrier'; actorId: EntityId }>
  | Readonly<{ kind: 'container'; containerId: WorldId }>;
export type WorldPositionRef = Readonly<{ kind: 'interactable'; interactableId: EntityId }>
  | Readonly<{ kind: 'structure'; componentId: WorldId }>;
export interface ContainerRecord {
  id: WorldId; owner: ModuleId; kind: 'chest' | 'escrow' | 'refund' | 'remains';
  levelRef: LevelRef; position: WorldPositionRef | null; capacity: number;
  itemIds: readonly EntityId[]; revision: Revision; ticketId: WorldId | null;
}
export interface ItemRead {
  id: EntityId; category: 'material' | 'tool' | 'kit' | 'native';
  nativeCategory: NativeItemCategoryName | null; definitionId: DefinitionId | null;
  quantity: number; available: number; packSlots: number;
  tags: readonly string[]; toolDurability: number | null;
}
export interface ContainerRead {
  id: WorldId; levelRef: LevelRef; at: Position | null; kind: ContainerRecord['kind'];
  revision: Revision; capacity: number; occupiedSlots: number; reservedSlots: number;
  items: readonly ItemRead[];
}
export interface ResourceDefinition {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  glyph: string; color: string;
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
  interactableId: EntityId; owner: ModuleId; definitionId: DefinitionId; instanceKey: string;
  levelRef: LevelRef; at: Position; capacity: number; remaining: number;
  reservedUnits: number; regenRemainder: Tick; lastSettledTick: Tick; revision: Revision;
}
export interface StationDefinition {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  glyph: string; color: string; interactionDistance: number;
  stationTags: readonly string[]; placementCost: readonly ItemAmount[];
  placementTicks: Tick; workPositionPolicy: 'adjacent-passable';
  kitDefinitionId: DefinitionId | null;
}
export interface StationRecord {
  interactableId: EntityId; owner: ModuleId; definitionId: DefinitionId;
  levelRef: LevelRef; boundComponentId: WorldId | null; revision: Revision;
}
export interface StationRead {
  interactableId: EntityId; definitionId: DefinitionId; levelRef: LevelRef; at: Position;
  revision: Revision; tags: readonly string[]; workPositions: readonly Position[];
}
export interface RecipeDefinition {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  inputs: readonly ItemAmount[]; outputs: readonly ItemAmount[];
  stationTags: readonly string[]; toolTag: string | null;
  workTicks: Tick; offlineEligible: boolean;
}
export interface OutputReservation {
  destination: ItemOwnerRef; slots: number; mergeTargets: readonly EntityId[];
  counts: readonly ItemAmount[];
}
export interface WorkTicket {
  ticketId: WorldId; owner: ModuleId; actorId: EntityId; levelRef: LevelRef;
  kind: 'harvest' | 'craft' | 'station' | 'build';
  nodeId: EntityId | null; stationId: EntityId | null; sourceContainerId: WorldId | null;
  definitionId: DefinitionId;
  inputEscrowId: WorldId | null; outputReservation: OutputReservation | null;
  refundReservation: OutputReservation | null;
  resourceReservation: Readonly<{ nodeId: EntityId; units: number }> | null;
  totalBatches: number; completedBatches: number; remainingTicks: Tick;
  laborCreditTicks: Tick; bundleActionId: number | null; revision: Revision;
  status: 'working' | 'suspended' | 'completed' | 'cancelled';
  stopReason: string | null; lastCompletionOrdinal: number;
}
```

### 5.1 Item 模型与背包语义（I5、I9）

- 原 ItemCategory 0…12 不重排，追加 **MATERIAL=13**。definition category 为 material/tool/kit 的实体**都是 MATERIAL=13 Item**，带 foundation 字段 `Item.worldItem: WorldItemFields`（可选；原生物品省略该属性，不写 undefined），按 definition category 区分行为；工具 maxStack=1，材料/套件 ≤99。
- **packCount**：MATERIAL 每 stack 计 1 格（与 WEAPON/GEM 同类处理，新增分支只对 13 生效）；其余原生类别规则不变，**FOOD 等仍按 quantity 计格**。因此口粮产出 N 份需要 N 个背包格（合并到已有口粮 stack 也不省格）；输出预留与退款预留的 `slots` 都按原生 packCount 计算。
- **native 输出不带任何模块/世界字段**：制造的 dagger/leather_armor/ration 与自然生成的同模板物品不可区分（固定 +0、无诅咒/符文、已鉴定、FOOD nutrition=1800），按原生 stacksWith 与自然口粮合并；不走随机 ItemLoader.spawn。预留使用原生 packCount/stacksWith 计算。ItemDefinitionContribution 中 native 行的 maxStack 只用于制造批次输出上限的校验，不改原生合并规则。
- **unitWeight 删除**：Brogue 无负重机械，r1 的 unitWeight 不进入机械包与指纹；显示若需要只能放在模块显示包。
- **统一 Item 扩展模型（与 loot 分支的阶段 6 设计草案 `docs/ext/phase6-loot.md` §4–§5.2 对齐）**：Item 上只有两类扩展槽——foundation 拥有的 `worldItem`（仅 MATERIAL=13）与未来模块拥有的 `moduleData?: Record<ModuleId, Json>`（6A1，C5-1 不实现）。stacksWith 规则冻结为：任一方有 `moduleData` → 不堆叠；双方 MATERIAL 且 `worldItem.definitionId`/`quality` 相同、`toolDurability` 均为 null → 堆叠（上限 maxStack，超出按稳定顺序拆 stack）；其余沿原生规则。worldItem 与 moduleData 不得出现在同一 Item 上（C5-1 制造不产出 loot 物品）。
- 装备不可堆叠，不改变原实体 ID/附魔/诅咒/鉴定；容器内不得自动充能/鉴定/吃饭。**箱/escrow/refund/remains 中的物品不贡献任何属性**（只有装备在背包中的物品是属性来源，5A2-S 管线遵守同一规则）。
- tags/stationTags 去重按码点排序，不根据 ID 魔法分支。材料/工具/台定义合计≤128，resource 定义≤128，配方≤128；owner 必须启用。**配方 inputs 只能引用 material/kit 定义**（native 物品不能作制造输入），因此匹配不依赖原生物品的身份推断。

### 5.2 全 Item 根枚举器（I9）

5A2 提供唯一可信枚举器 `forEachItemRoot(game, visit)`，规范顺序覆盖：玩家背包 → 活动层地面 → 活动层生物携带 → 各缓存层（levelKey 序）地面与携带 → pending 坠落物 → purgatory/暂存生物携带 → world5 容器（chest/escrow/refund/remains，按 WorldId）。预算计数、坏档 Item 双 owner 检查、5A2-S 属性来源收集、6A1 moduleData 校验都必须使用它，不得各自写一份遍历。

### 5.3 容器与预算（I6）

容器 capacity=1…64（remains 例外，见 §10.1）；每营地≤16 箱。**8192 是 C5 操作的接纳预算**：任何会新增 Item 根（拆 stack、制造输出、启动礼包）的 C5 操作在提交前用枚举器计数，`全部 Item 根 + 新增 > 8192 − 1024`（为原生物品保留 1024 余量）则 C5_BUDGET；原生物品生成从不因此被拒，可以使总数超过 8192，此后 C5 新增操作继续拒绝直至回落。**load 只校验 C5 自有根**（world5 容器中的 Item 合计 ≤ 7168，且每个 Item 只有一个 owner），不因原生物品总数拒绝存档。纯移动（不拆分）不新增根，退款/残骸托管使用接收时已预留的路径，从不因预算失败而吞物。

一个 Item 只有一个持有 owner，装备引用是该背包 Item 的引用，不是第二 owner。转移用真实对象移动；部分堆叠拆出新 ID，合并退役来源 ID 与引用同事务。UI source=null 仅当前玩家背包，不隐式找世界库存。箱存取同层、Chebyshev 距离≤1、合法交互线和权限，批量成功共耗 100 tick；查看零时间。

输出预留同时计槽和合并 stack 的可加数量，退款路径也在接收时预留（`refundReservation`）；“箱满以后再想退款”不是合法接收条件。escrow 是真实容器 owner，只记录剩余未消费 Item ID；每批完成原子消耗该批输入、创建固定输出、扣工具耐久、进度/收据。

### 5.4 资源节点

节点 remaining 包含预留未完成单位，available=remaining−reservedUnits≥0；完成时同时减 remaining/reservedUnits，取消只释放 reservedUnits。再生按整数余数/elapsed，容量已满余数清零，无超额信用；lastSettledTick 单调。**惰性物化不递增 node.revision**（§4.2）。UI 查询只读最后已物化值；真实采集准备在可信机械边界结节点。节点是单格非阻挡 interactable，不写地形；放置算法见 §9(e)。

### 5.5 票据与唯一计时（I3、M6）

ticket 总批次 1…16，每批 workTicks=100…10000（通用定义允许 1…10000，首批 crafting 限 100 起）；总费用/时长/输出先安全乘法核验。每 actor 一个未终结工作 ticket；群成员不各做一份。WorkTicket 不再有 `rest` 种类（休息只走 §7）。

**唯一可写倒计时**：bundle 存活时，权威倒计时是 `run.actorActions` 中该 bundle 的阶段剩余 tick；`ticket.remainingTicks` 是**派生镜像**，每次 `advanceActionTime` 后同步写入，load 时校验二者相等（不等即坏档），镜像更新不递增 ticket.revision。只有 status=suspended（居民离场/离线）或无 bundle 时，`remainingTicks` 才是权威值，由离线 planner 推进。laborCreditTicks 是尚未消费的实际劳动信用。bundle 在 5C2 前保持 `depth: number`；`nextActionId` 于 5A2 随动作根从 combat state 迁到 `run.actorActions`（combat 格式变化与 5A2-S 合并一次升号，§1.2）。

状态：接收→working；居民离场合格→suspended；续同单→working；完成→completed；中断/取消→cancelled。终结 ticket 在关联/输出/退款全部解除后可回收，已用 ID/完成高水位不重用，重复完成/退款不能重新分配 ID 或奖励。居民符合政策可冻结剩余 ticket 进入离线，同一 ticket 的兑现 ordinal 唯一。

箱毁坏先合法稳定近邻落地，未放出内容入该层 remains（§10.1），不能默默删箱导致无 owner。火损毁暴露 Item 沿原规则，箱不是永久防火保险。

### 5.6 工位

5A2 的独立台是 foundation 单格**非阻挡** StationRecord + world interactable（同一 EntityId），不依赖房间/settlement。工作位 = interactable 周围 8 邻接中可通行且有交互线的格（`adjacent-passable`）。5A3 以后台可绑定 fixture component（`boundComponentId`），此时 StructureCell.at 为权威坐标，interactable 的 x/y 是同步镜像并在 load 校验相等，几何只有一份可写来源。需工坊/通风的后续配方通过公开资格 tags 软查询；首批桌/炉配方在无 settlement 时可完成。工具必须实际持有、每批成功才耗耐久；破损工具停止下一批（续作停止并退款未开始批次），已完成不回滚。

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
  owner: ModuleId; regionId: RegionId; levelRef: LevelRef; at: Position;
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
  stationIds: readonly EntityId[]; ventilated: boolean;
}
export type RegionChange = Readonly<{ kind: 'create'; instanceKey: string;
    levelRef: LevelRef; bounds: Bounds }>
  | Readonly<{ kind: 'expand'; regionId: RegionId; revision: Revision; bounds: Bounds }>
  | Readonly<{ kind: 'retire'; regionId: RegionId; revision: Revision }>;
export type StructureChange = Readonly<{ kind: 'build'; regionId: RegionId;
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
```

这些入口是可信引擎窄口，不能让公开 JS/UI 任意提交 damage 或看完整隐藏房间。玩家 build/dismantle/door 由已有命令 scope 适配，公开已知投影另裁剪。首版四层数组仍为 4，稀疏结构为独立根；各格 floor/barrier/roof/fixture 各≤1，barrier 三种互斥。HP=0 同损毁事务删除部件，maxHp/材料/抗性查启用定义。门 open 仅 door 非 null。结构/RestPoint 定义通过 §9(a) 的 `worldDefinitions` 声明（5A3 扩展该包的 `structures`/`restPoints` 字段），不再有运行期 register* 调用。

**region ID（B4）**：运行期 region 与生成 region 共用实体分配器（RegionId=EntityId）、同一 128 上限和唯一 bounds；region 与 interactable 不得同 ID（沿 `world.ts:69`）。5A3 给 OwnedRegion 增加 `revision` 字段（登记格式变化）供 CAS；最后一个 region 撤销时删除 `regions` 键（M2）。create/expand 不伪造 generation token，重验真实层、地图边界、不重叠、设施/工位、全足迹与逃生。营地最多 8、同层 1、初始 9×9、最大 24×20；site 也占名额。范围格≤480，每营地有结构格≤384、全局≤3072，部件≤12288，共格只算一结构格。普通居民不自动绑定 movementRegionId。

containerCapacity 仅 fixture 可非 null（1…64），stationDefinitionId/restPointDefinitionId 仅 fixture 引用已启用定义；build 同事务创建对应 interactable 与 ContainerRecord/StationRecord/RestPoint，结构格坐标为权威。拆卸/损毁同事务处理关联票据、物品和退款；关联未解决不得遗留孤儿。5A2 箱/台由可信 fixture 或独立非阻挡台入口构造，5A3 后可原子绑定结构；不向 dot 开放任意箱根创建/结构写口。

机械性质在基础四层之上合成：墙/关闭门挡移动/视线/普通弹道/气液，窗挡移动/普通弹道/液体、透视线与气体；魔法弹道由明确定义。地板不封气水，不将深水/熔岩/裂隙变安全；屋顶仅覆盖/日照。开启门恢复基础地面性质。flags/mechFlags 位运算保持原位宽/符号规则。

5A3 必须分类迁移机械读取（passability、FOV、AI、路径、scent、射线/法术、DF/Promotion、Gas/液体、memory/render、巨兽全足迹/位姿），不能只迁 FOV/玩家寻路就开放建筑。写入统一提交“基础地形变化/结构损伤/删除”意图，不用 setTerrain 的清层行为建墙，不抹已有水气。失效一次覆盖 terrain revision、空间/位姿、路线、房间、light/FOV、记忆、loop/waypoint；提交失败恢复原对象/派生索引。**迁移前后，对每个已有节点/工位/RestPoint/箱 fixture，工作位集合与 `hasInteractionLine` 结果必须逐格相同**（5A3 回归，§11）。

建造仅当前可见已知可达营地、玩家相邻合法工作位；**保护格**包括楼梯/D40/机器/impregnable/全生物足迹/地面 Item/**任何世界 interactable 所在格及其唯一工作位**（M4）和唯一逃生路线。每次公开命令最多施工一格，UI 草稿≤16 格顺序发命令，危险/缺料即停止后续草稿；读档/seek 不恢复 UI 队列。拆卸返还 `floor(originalCount × hp/maxHp × 1/2)`，不修理套利。撤销非空营地必须先处理全部居民/订单/休息/预留/退款/袭击。最后管理营地撤销先结到当前 tick，再解除管理政策；稳定 8 个 slot（CampSlotId）创建/事件高水位不归零。

房间全层 79×29 四邻域 flood fill；天然墙、墙、门框、窗是边界；候选 2…128 稳定地面格、不触外边/开放通道、每格有效屋顶才完整。无对角角洞连接；地下天然顶不算玩家屋顶。roomId 是会话派生值，居民永久绑定床/工位 ID，屋顶无支持立即失效住房/工坊。卧室需床、仓库需箱、工坊需台/合法工位，炉再需通风；首版通风为房间边界至少一扇完好窗或开放门通向非同室的稳定空气格。

## 7 RestPoint 通用休息（I4、M6、B1）

```ts
export interface RestPointDefinition {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  glyph: string; color: string;
  maxRestTicks: Tick; interactionDistance: number;
  restorePolicy: Readonly<{ hp: 'native-over-time' | 'none';
    optionalCombatResources: 'none' }>;
  resetPolicy: 'none';
}
export interface RestPoint {
  interactableId: EntityId; owner: ModuleId; definitionId: DefinitionId;
  levelRef: LevelRef; boundComponentId: WorldId | null;
  revision: Revision; lastUseOrdinal: number;
}
export interface RestRequest { restPointId: EntityId; revision: Revision }
export interface RestPointPlacementRequest {
  definitionId: DefinitionId; levelRef: LevelRef; at: Position;
}
export declare function planRest(request: RestRequest,
  scope: WorldActorScope): WorldResult<WorldPlanHandle>;
export declare function planRestPointPlacement(request: RestPointPlacementRequest,
  scope: WorldActorScope): WorldResult<WorldPlanHandle>;
```

- **combat 篝火保持 combat 所有**：篝火的 interactable、`state.bonfires` 账本、full-on-complete 规则与收据全部不变，C5-1 不把它转成 RestPoint，也不为它建 world5 记录。RestPoint 是独立的 foundation 记录，只服务无 combat 依赖的休息位（settlement 床/休息位）。
- **RestPoint 休息复用 auto_rest 语义**：`planRest` 只做资格（同层、`interactionDistance`、交互线、无已知威胁、无未终结 ticket）与 CAS；提交后进入与 auto_rest 相同的逐步续作（每步一条录制的 `auto_step` = 一次 wait，原生每回合回血、饥饿照常），上限 `maxRestTicks/100` 步（≤ TURNS_FOR_FULL_REGEN 的整数倍由定义给出），满血/disturbed/伤害/离开距离/目标毁坏即停。不建 bundle、不建 ticket，**不清饥饿/毒、不刷新敌人/物品、不保命**；停止时写一条 owner 收据（completed/interrupted）。
- `full-on-complete` 与 `provider-on-complete` 在 C5-1 不开放（定义校验拒绝）；以后若需要，另立合同而不是借篝火实现。
- 5A2-S 管线就位后，原生回血速率改读管线键 `native.regeneration`（RestPoint 自身不加修正）；在此之前沿原生 `regenRatePerTurn`。

## 8 玩家计时工作：分批 bundle 与 auto_work 续作（B1）

既有约束：bundle 存活时玩家输入被锁（`Game.ts:4200`，`ActorActionProduction.ts:155`），一条命令只跑一次 `finishTurnEpilogue`。因此 C5-1 不允许单 bundle 承载整单多批工作，冻结如下：

| 阶段 | 行为 |
| --- | --- |
| 接收（`ext:command` craft，§9(b)） | prepare → 确认（若有）→ 引擎 `commitWorldWork`：一次性 escrow 全部批次输入、预留输出槽与退款槽、建 ticket(working)；batchCount>1 时写 `run.autoAction = { kind: 'auto_work', ticketId }`；启动**第 1 批 bundle**（时长 = 该批 workTicks ≤ 10000） |
| 一批运行 | bundle 存活期间输入锁定；该批在 bundle 完成边界原子完成：消耗该批输入、创建输出、扣工具耐久、`completedBatches++`、收据/事实；随后本命令照常 `playerTurnEnded`/`finishTurnEpilogue` 一次 |
| 续作 | 既有 ticker 触发 `executeCommand('auto_step')`（**每批一条录制命令**）；`stepAutoActionStages` 对 auto_work：先 `autoTravelDisturbed()`，再重验工具/工位/节点可用量/交互线，通过则启动下一批 bundle；最后一批完成后清 autoAction，ticket→completed |
| 停止续作 | 新可见敌人/disturbed、伤害、HP 下降、离层、目标失效、工具破损，或玩家发出任何非 `auto_step` 输入（既有 `stopAutoTravel` 路径）：**在该条录制命令内**执行 foundation 取消事务——退款全部未开始批次的 escrow（原 owner，或接收时预留的 refund 路径）、释放节点预留与输出预留、ticket→cancelled、收据 interrupted |
| 运行中批被打断 | 玩家无法在 bundle 存活时取消（输入被锁，不录制）。该批按篝火休息同一中断谓词（`WorldRestProduction.ts:146–160`：dead/moved/level-exit/damage/incapacitated/target-removed/threat）中断：该批不产出、不扣耐久，已耗时间不退，剩余（含该批）escrow 全部退款，ticket→cancelled |
| cancel-work | 只能取消当前玩家自己的 ticket，不能借此打断其他 owner 的战斗动作或 NPC；仅在无 bundle 存活（批与批之间、或续作已停但 ticket 尚未终结的异常恢复点）时可执行；与停止续作走同一取消事务 |

- 每批是一条正常玩家命令：回血/回合计数/`playerTurnEnded` 钩子各一次，饥饿按 100 tick 客观块照常扣（与任何慢于 100 tick 的原生动作相同；500 tick 一批只回血一次是既有语义，C5-1 不补偿）。
- auto_work 停止只能发生在录制命令的执行中；`stopAutoTravel` 的非命令调用点（UI/会话路径，`7f6de96` 共 22 处调用）不得对 auto_work 做机械写入，只能标记，5A2 必须逐一审计并在报告列出。autoAction 随 run 持久（U03 已登记 `autoAction`），新增 kind 须更新登记；save/load/replay/seek 在批间恢复续作，在批中由 bundle 恢复。
- harvest 一次命令采 1 单位：节点预留 1 单位、建单批 ticket 与一个 bundle（`harvestTicks`，首包 100 tick），不写 auto_work；完成即 ticket→completed。
- NPC 与离线工作保持票据调度：在场 NPC 每次原生自由决策可推进其 ticket（一个 bundle 一批），离场由 §3 planner 处理。

## 9 冻结给 5B 的 SDK（B3）

只有本节列出的 module-bound 入口、§5 的定义/读 DTO、`WorldResult`/`WorldErrorCode` 可派发 dot；LevelRecord/OfflineInput/结构写口/可信 scope 工厂/`commitWorldWork` 不进入 crafting 代码。**5A2 交付物包含：本节全部真实 TS 导出、一个最小 crafting 骨架示例模块与无头 harness**（§9(i)），三者共同构成冻结 SDK 基线。

```ts
export interface StartupItemsDeclaration {
  instanceKey: string; items: readonly ItemAmount[]; overflow: 'floor-then-skip';
}
export interface WorldDefinitionPack {
  schema: 1; worldSdk: 1;
  items: readonly ItemDefinitionContribution[];
  resourceNodes: readonly ResourceDefinition[];
  stations: readonly StationDefinition[];
  recipes: readonly RecipeDefinition[];
  startupItems: StartupItemsDeclaration | null;
}
export interface StartupGrantReceipt {
  owner: ModuleId; instanceKey: string; result: 'granted' | 'partial' | 'skipped';
  toInventory: readonly ItemAmount[]; toFloor: readonly ItemAmount[];
  skipped: readonly ItemAmount[]; tick: Tick;
}
export type KnownWorkQuery = Readonly<{ kind: 'node'; interactableId: EntityId }>
  | Readonly<{ kind: 'station'; interactableId: EntityId }>
  | Readonly<{ kind: 'inventory' }>;
export interface WorkContext {
  contract: 'C5-1'; owner: ModuleId; actorId: EntityId; levelRef: LevelRef;
  at: Position; inventoryStamp: ContentStamp; available: boolean;
  node: ResourceNodeRecord | null; stations: readonly StationRead[];
  inventory: readonly ItemRead[]; containers: readonly ContainerRead[];
  activeTicket: WorkTicket | null;
}
export interface RecipePreview {
  recipeId: DefinitionId; batchCount: number; ok: boolean; reason: WorldErrorCode | null;
  inputs: readonly ItemAmount[]; outputs: readonly ItemAmount[];
  totalTicks: Tick; outputSlots: number; refundSlots: number;
  stationTags: readonly string[]; toolTag: string | null;
}
export type TimedWorkRequest = Readonly<{ kind: 'harvest'; nodeId: EntityId;
    nodeRevision: Revision; inventoryStamp: ContentStamp;
    destinationId: WorldId | null; destinationRevision: Revision | null }>
  | Readonly<{ kind: 'craft'; recipeId: DefinitionId; batchCount: number;
    stationId: EntityId | null; stationRevision: Revision | null;
    sourceContainerId: WorldId | null; sourceRevision: Revision | null;
    inventoryStamp: ContentStamp }>;
export interface StationPlacementRequest {
  definitionId: DefinitionId; at: Position; inventoryStamp: ContentStamp;
}
export interface CancelWorkRequest { ticketId: WorldId; ticketRevision: Revision }
export interface WorldWorkPrepareSDK {
  readonly owner: ModuleId; readonly actorId: EntityId;
  readWorkContext(query: KnownWorkQuery): WorldResult<WorkContext>;
  planTimedWork(request: TimedWorkRequest): WorldResult<WorldPlanHandle>;
  planStationPlacement(request: StationPlacementRequest): WorldResult<WorldPlanHandle>;
  planCancelWork(request: CancelWorkRequest): WorldResult<WorldPlanHandle>;
}
export interface WorldWorkCommand {
  prepare(payload: JsonValue, sdk: WorldWorkPrepareSDK): WorldResult<WorldPlanHandle>;
}
export interface CommittedWorkFact {
  owner: ModuleId; factId: number; ticketId: WorldId | null; completionOrdinal: number;
  operation: 'harvest' | 'craft-batch' | 'place-station' | 'cancel' | 'startup';
  definitionId: DefinitionId; actorId: EntityId; completedBatches: number;
  result: 'completed' | 'interrupted' | 'skipped'; reason: string | null; tick: Tick;
}
export interface ModuleStateTransaction {
  readonly state: JsonValue;
  replaceState(next: JsonValue): void;
}
export interface WorldWorkParticipant {
  onCommitted(fact: DeepReadonly<CommittedWorkFact>, tx: ModuleStateTransaction): void;
}
export interface WorldWorkReadSDK {
  readonly contractVersion: '1.0.0'; readonly worldSdk: 1; readonly owner: ModuleId;
  readWorkContext(query: KnownWorkQuery): WorldResult<WorkContext>;
  queryStations(): WorldResult<readonly StationRead[]>;
  queryContainers(): WorldResult<readonly ContainerRead[]>;
  previewRecipe(recipeId: DefinitionId, batchCount: number, stationId: EntityId | null,
    sourceContainerId: WorldId | null): WorldResult<RecipePreview>;
  recentFacts(afterFactId: number): WorldResult<readonly CommittedWorkFact[]>;
}
export type CraftingAction = 'harvest' | 'craft' | 'place-station' | 'cancel-work';
export interface WorldModuleFields {
  worldDefinitions?: WorldDefinitionPack;
  worldWorkCommands?: Readonly<Partial<Record<CraftingAction, WorldWorkCommand>>>;
  worldWorkParticipant?: WorldWorkParticipant;
}
export interface WorldProjectionFields { readonly worldWork?: WorldWorkReadSDK }
export interface WorldDescriptorFields { readonly worldSdk: 1 }
export type CraftingCommand = Readonly<{ module: 'crafting'; action: 'harvest';
    payload: Readonly<{ v: 1; nodeId: EntityId; nodeRevision: Revision;
      inventoryStamp: ContentStamp; destinationId: WorldId | null;
      destinationRevision: Revision | null }> }>
  | Readonly<{ module: 'crafting'; action: 'craft'; payload: Readonly<{ v: 1;
    recipeId: DefinitionId; batchCount: number; stationId: EntityId | null;
    stationRevision: Revision | null; sourceContainerId: WorldId | null;
    sourceRevision: Revision | null; inventoryStamp: ContentStamp }> }>
  | Readonly<{ module: 'crafting'; action: 'place-station'; payload: Readonly<{ v: 1;
    definitionId: DefinitionId; x: number; y: number; inventoryStamp: ContentStamp }> }>
  | Readonly<{ module: 'crafting'; action: 'cancel-work';
    payload: Readonly<{ v: 1; ticketId: WorldId; ticketRevision: Revision }> }>;
export interface WorldHarnessOptions {
  seed: number; mode?: 'normal' | 'easy'; modules: readonly string[];
  fixtures?: readonly ('world-work-basic' | 'crafting-skeleton')[];
}
export interface WorldHarness {
  ext(module: string, action: string, payload: JsonValue,
    answers?: readonly boolean[]): Readonly<{ recorded: boolean; error: WorldErrorCode | null }>;
  command(action: string, data?: JsonValue): void;
  runAutoUntilIdle(maxCommands: number): number;
  readWorkContext(owner: ModuleId, query: KnownWorkQuery): WorldResult<WorkContext>;
  world5(): DeepReadonly<World5Snapshot> | null;
  save(): string;
  load(save: string): void;
  exportRecording(): string;
  replay(recording: string): Readonly<{ ok: boolean; firstMismatch: number | null }>;
  seek(recording: string, afterCommand: number): void;
  digest(): string;
  dispose(): void;
}
export declare function createWorldHarness(options: WorldHarnessOptions): WorldHarness;
```

### 9.1 调用时机总表

| 入口 | 何时被调用 / 可调用 | 禁止 | 写入 / 时间 / RNG |
| --- | --- | --- | --- |
| (a) `module.worldDefinitions` | 静态数据字段；`ExtensionRuntime` 构造时（与 nativeForms/generationContributions 同处，候选校验、退休旧局前）一次整包校验并冻结，进入规则指纹 | 运行期增删定义；不存在 register* 调用 | 无 |
| (b) `worldWorkCommands[action].prepare` | `executeCommand('ext:command', …)` 中由引擎新增分支（与 `isWorldRestCommand` 并列，先于 `executePreparedExtensionCommandStages`）调用：实时局确认前一次、确认答案收集后再一次（canonical 比较）；replay 中一次 | 模块自行调用；在 `commands[action]` 或钩子中调用 | 纯：0 写/0 tick/0 RNG/0 ID |
| (b) `WorldWorkPrepareSDK.plan*` / `readWorkContext` | 仅在上面 prepare 回调执行期间 | 其他时机返回 C5_SCOPE | 纯 |
| (b) 确认 | 计划含风险（kit/材料来源选择、输出落地等）时引擎生成提示，以 `recordDecision:false` 收集；执行时重新 prepare 并比较，不等则 C5_STALE（0 成本，不抛错）；答案经 requestConfirm 记录一次 | 模块自带确认 UI 绕过 DialogService | 答 No：该 `ext:command` 仍是一条录制命令（decisions 末项 false），机械世界与两流不变，不消耗 planId/ID |
| (b) 句柄生命周期 | 只活在一次命令执行内；跨确认等待只保留 detached 数据，恢复后重新 prepare 得新句柄 | 存入 state/闭包跨命令复用（C5_PLAN_USED/C5_STALE） | — |
| (b) `commitWorldWork` | **仅引擎**在同一命令的同步事务中调用 | 模块调用（不在模块 SDK 上） | 写 world5/背包/动作根；时间由 bundle 承担 |
| (c) `projection.worldWork` | `projectView(context)` 时（ExtensionProjectionContext 新增可选字段 `worldWork`，仅当 owner 声明 worldDefinitions 且 world5 存在） | 写；推进再生/离线 | 只读最后已物化值 |
| (d) 地图显示 | 节点/工位/箱/RestPoint 均为 foundation 世界 interactable，glyph/color/nameKey 取自定义，**渲染与悬停/详情归 foundation 既有 interactable 渲染路径** | 模块绘制地图格 | 无 |
| (e) 资源放置 | foundation 在该层**首次 visited 的 enteredLevel 事务**中、模块 enteredLevel 钩子之前，按 `worldDefinitions.resourceNodes[].placement` 自动执行；`defer` 行由 foundation 写 `pendingPlacements`，并在该层下一次 enteredLevel 重试一次，仍无位则记 skip | 模块调用放置；`generationContributions` 不用于节点 | 不抽原生 RNG；用 `c5-place-v1` 哈希抽样 |
| (f) 启动礼包 | 新局在玩家首次真实落位 D1 的 enteredLevel 事务中、资源放置之后由 foundation 执行一次；replay 走同一路径 | 公开命令/load/replay 查询中发放；每 owner >1 份 | 写背包/地面；记 StartupGrantReceipt |
| (g) `worldWorkParticipant.onCommitted` | 每次该 owner 的世界提交（接收、每批完成、取消、放置、启动礼包）在 foundation 写完、发布前同步调用；只能 `replaceState` 自己的模块 state（例如放置收据、工作历史） | 写他人 state/Game；Promise；启动新事务；RNG | 异常→C5_PROVIDER 全回滚；**批完成时失败**则回滚该完成事务，同一边界改走不调用参与者的 foundation 取消事务（退款走预留路径，receipt reason=`provider`），不卡住 bundle |
| (h) descriptor | `worldSdk: 1` 新白名单键；`foundation: FOUNDATION_PROTOCOL` | 字面量 foundation 号（若仍有，集成人更新） | — |
| (i) harness | 仅测试；engine-only | 生产导入 | — |
| (j) 错误/i18n | WorldErrorCode 固定集合；foundation locale 拥有 `ext.foundation.world.error.<code 去前缀小写>` 通用短句；模块可在自己 locale `ext.<owner>.…` 提供更具体文案 | 向玩家显示错误码 | — |

### 9.2 补充冻结

- 公开命令格式固定为 `executeCommand('ext:command', JSON.stringify({module:'crafting',action,payload}))`，payload 为上方 `CraftingCommand` 之一。模块只选择已注册 recipe/node/台，不提交物料 delta、nativeTemplate、actorId、workTicks 或产出计数；材料不足/满包/No/过期/坏 payload 均 0 成本。craft 默认输出到当前玩家背包；居民 internal-work 的输出容器只能由底座订单 adapter 指定。

- **(a)** crafting 的 CraftingDefinitionPack 是其自有数据根，模块 `create()` 时把 materials+tools 合并为 `items`，连同 nodes/stations/recipes/startupItems 填入 `worldDefinitions`；limits 留在 crafting 自己的包内，只能比 foundation 硬预算更严。整包任何错误使整个运行时构造失败（不部分注册）。
- **(b)** `ext:command` 流程：`isWorldWorkCommand(game,data)` 识别 `module.worldWorkCommands[action]` → prepare → 确认 → 引擎 `commitWorldWork(handle, scope)` → 启动 bundle/auto_work（§8）或零时间完成（cancel-work）。没有 worldWorkCommands 的动作仍走既有 `commands[action]`/`prepareControlledCommand` 原路径，二者对同一 action 互斥（构造时检查）。crafting 不得在 `commands` 中实现这四个动作。
- **(e)** 放置算法 `c5-place-v1`：候选 = 该层可通行稳定地面、非楼梯/机器/impregnable/液体/陷阱、无 Item/生物/interactable、至少 1 个相邻合法工作位、从到达点已知可达的格，按 (y,x) 排序；第 k 个节点的下标 = 对 `["c5-place-v1",runSeed,levelKey,definitionId,k,attempt]` 的 SHA-256 首 4 字节做 §3.4 拒绝抽样取模候选数；选中格移出候选再取下一个。maxPerRun 只计实际放置；skip/defer 各写唯一收据，不反复重掷。不触及原生两条 RNG 流，不改房间/楼梯/giants reservation。
- **(f)** 发放顺序：按定义行顺序逐个尝试入背包（受 packCount 与 stack 规则），放不下的按 `floor-then-skip` 放到玩家周围合法安全地面（稳定近邻序），仍无位记 skipped；结果为 granted（全部入包）/partial（有落地或跳过）/skipped（全部跳过）。收据持久在 `world5.startupGrants`，不滚动淘汰。
- **(g)** 参与者看到的 fact 与 `recentFacts` 返回的相同；factId 由既有 runtime 事实分配器在同一事务分配。
- **(i)** 5A2 交付 `src/ext/testing/worldHarness.ts`（上方签名）、fixture `world-work-basic`（D1 玩家旁放一个无工具节点与一个桌）及 `crafting-skeleton` 示例模块（`src/ext/testing/fixtures/craftingSkeleton/`：一种材料、一个节点、一个配方、四个命令、参与者与投影的最小可运行实现，不进生产 catalog）。harness 内部走真实 Game/executeCommand/录像，不 mock 底座。
- **(j)** 前端可依 `WorldResult.code` 选文案，但只显示 i18n 文本；`field` 只用于开发诊断。

## 10 预算、录像摘要与完成条件

### 10.1 预算

| 项目 | C5-1 固定约束 |
| --- | --- |
| 层 / site | 40 dungeon + 首版最多 1 个可选 site，79×29；5A1 site 尚未执行 |
| 营地 / region | 8（CampSlotId 0…7）/ 全 foundation 128（RegionId=EntityId）；同层 1，初始 9×9，最大 24×20 |
| 结构 | 每营地 384 格、全局 3072 格、12288 部件 |
| 居民 | 每营地 16、整局 64；当前真实活动实体 128/空间格 512 继续有效 |
| 箱 / Item roots | 每营地 16 箱、每箱 64 槽；C5 新增根的接纳预算 8192−1024（§5.3）；load 只校验 C5 自有根 ≤7168 |
| 世界 interactable（M3） | 全局 1024（`WORLD_INTERACTABLE_LIMIT`）。C5 子预算合计 ≤ **832**：节点 ≤512、工位 ≤128、箱 ≤112、remains ≤16、RestPoint ≤64；其余 ≥192 留给既有用户（当前 combat 篝火 maxPlacements 40 + narrative maxActiveNpcs 32 = 72）。C5 操作按“全局计数+新增 ≤1024 且 C5 子预算未满”接纳，否则 C5_BUDGET；既有模块放置不受 C5 影响 |
| remains | 每个有箱的层在放第一个箱时同事务预建该层 remains 容器及其 interactable（计入 remains 子预算）；remains 容量不受 64 槽限制（≤1024），保证损毁总有托管路径 |
| 节点 / 包 | 每层 32、整局 512；配方 128；材料/工具/台合计 128 |
| 工作 / 经济 | 每 actor 1 活跃 ticket、每营地 32 订单；每批量 1…16；每 epoch 最多 1024 完成；每补给单最多 32 epoch |
| 事件 / 通知 | 每营地 1 未结袭击、全局 4；公开历史 128，ordinal 永不因滚动淘汰/拆营归零 |
| 施工 / 房间 | 一命令一格、UI 草稿 16 格；房间 2…128 格 |

定义/DTO 校验：ItemAmount 清单 1…8 项、count=1…99 且同清单 definitionId 不重复；配方 inputs/outputs 非空，inputs 只引用 material/kit；tags≤16；resource yield 1…8 项、capacity 1…9999、unitsPerHarvest 1…99 且≤capacity、harvestTicks 1…10000，periodic.units 1…99/intervalTicks 1…1000000，0≤reservedUnits≤remaining≤capacity、再生余数 0…intervalTicks−1（满容量时 0）。工位 tags 非空，placementTicks 1…10000，interactionDistance 0…16。结构 maxHp 1…1000000、0<hp≤maxHp；抗性 0…100、返还分子 0…分母（1…10000）。RestPoint.maxRestTicks 100…30000 且为 100 的倍数、interactionDistance 0…16。加乘前检查 MAX_SAFE_INTEGER，delta 仅可信计划可为负。

WorldCommit.chargedTicks 表示此次接收的耗时义务（timed-work 为首批时长、转移 100、取消/启动 0），不是在 commit 内另加世界钟；唯一 scheduler/原生行动提交点按真实 elapsed 落账。公开 WorldReceipt 历史最多 128，去重凭根的单调 ID/高水位与稳定 startup/node 收据，不依靠滚动历史。

### 10.2 录像摘要策略（I7；修订 5A0 报告 §3.1/§3.3 的逐事件全量摘要）

5A0 实测全量 canonical+SHA-256 在 0 营地约 21 ms、8 营地约 190 ms，逐事件全量不可接受。冻结为分层摘要：

| 时机 | 摘要内容 |
| --- | --- |
| 每条事件 | **dirty 跟踪域**：extensions（模块 state/components/foundation world，写入口已集中在 runtime）、world5、actorActions——只重算被显式写入口标脏的叶；加**廉价诊断**：tick、turn、simulationTicks、levelRef、玩家位置、玩家 HP、背包 `inventoryStamp`、双 RNG 状态与计数 |
| 每 256 条命令的 chunk 边界、每个加速快照点、录像末尾 | **完整机械摘要**：native、knowledge 全量重算，加上述各域的全量重算并与增量值比对 |
| 经典局（无 extensions/world5/actorActions） | 每事件只记今天已有的 tick/depth/player/turn/rng 诊断，**不增加任何逐事件摘要**；完整原生摘要仅在 chunk 边界/快照点 |

- replay 在 chunk 边界发现 native/knowledge 不一致时，回到上一个已验证边界，以诊断模式逐事件全量重算定位首个不一致命令后停止并报告（OOS 诊断不放宽检测，只是推迟定位）。
- 摘要域字段清单与 `scripts/u03-state-contract.json` 绑定：每个 kind=`run` 的字段必须恰好属于一个摘要域，kind=`derived/session/reset` 字段必须列入排除清单；新测试校验二者一致，漏登记即失败。持久知识/记忆不得作为显示缓存排除。
- **5A1-R 门禁**：实测“每条命令新增成本 P95”。拟议阈值（5A1-R 报告中由维护者确认）：经典 control ≤1 ms；0 营地扩展局 ≤5 ms；预算内 8 营地代理样本如实报告。chunk 边界全量摘要的耗时单独报告，不摊入逐命令 P95。**超标回退**：依次 (1) 把完整原生摘要从每 256 条放宽到每 1024 条/仅快照点；(2) 若 dirty 域仍超标，退为仅在 chunk 边界摘要这些域、逐事件只保留诊断。每次回退都须在报告中写明检测粒度的损失，不得缩小摘要覆盖范围。
- 存储：录像与存档**同一个 IndexedDB 库 `brogue-web-saves`**，库版本 1→2，保留 `checkpoint` store，新增 `recordings`、`eventChunks`、`snapshots` 三个 store；一次保存在同一 readwrite 事务中覆盖 `checkpoint` 与相关 `recordings/eventChunks`（save 与来源前缀同事务）。64 MiB 加速快照缓存与 ≤128 份上限**按每个录像**计算。保持现有“单一当前录像”的 UX（替换 `brogue-web-replay-v1` 的单键语义），C5-1 不新增录像列表；JSON 导入/导出保留。

### 10.3 完成条件

5A1–5A3 必须验证：零启用机械/RNG 不变；真实 Game 安全点 save/load/replay/seek/续录；重复/陈旧/确认 No/跨层/终局/坏档在退休旧局前拒绝；在场/NPC 一次 prelude 与正耗时；离线分段/长尾（对参考迭代器）/精度切换/跨层写顺序；物品和预留守恒；同步多参与者失败注入下全对象图、引用身份、ID/计数/RNG/消息/缓存恢复。不得以只比 JSON 的测试代替独立写集差分。5A0 类型草案检查只说明声明互相可解析，不说明任一功能可用。

## 11 步骤顺序、版本与 5B 派发前冻结清单

1. **5A1 + 5A1-R**（同一格式批次，§1.2 第一行）。5A1-R 是 5A2 的**硬前置**：5A2 把 scheduler 从 `extensions` 迁到 `run.actorActions`，在 v3 的逐事件 extensions checkpoint 下这部分状态将失去逐事件覆盖；5A1-R 未合入前不得开工 5A2。
2. **5A2**：Item/MATERIAL/容器/节点/工位/ticket/`run.actorActions`（含 nextActionId）/auto_work/WorldWork SDK/harness/骨架模块。scope 与验收**新增**：`WorldRestProduction.ts`/`ext/worldRest.ts` 改读中立动作根后的篝火休息 save/load/replay/seek/中断 非回归，combat+giants 既有来源/费用/中断不倒退；无 combat 组合覆盖。
3. **派发 5B 前必须冻结**：5A2 精确 commit；`src/ext/worldSdk.ts` 等导出路径与 SHA-256；`worldSdk: 1`、`FOUNDATION_PROTOCOL` 用法；WorldDefinitionPack schema；四种 payload v1 与 CAS 字段（§4.2）；ext:command/确认/No 记录流程；投影 `worldWork`；地图显示归属；`c5-place-v1` 与启动礼包规则；参与者接口；错误码与 i18n 键；harness API、`world-work-basic` fixture 与骨架模块路径；auto_work 行为（§8）；5A0 报告 §5 数值（含本 r2 的 unitWeight/口粮占格修订）；crafting 模块测试的发现入口。缺任一项不得派发。
4. **5A2-S**（统一属性管线）：**不得修改任何 C5 DTO 或 §9 签名**；与 5A2 的 combat 格式变化合并为一次 combat 升号（§1.2）；回血改读 `native.regeneration`；属性来源收集用 §5.2 枚举器且箱内物品不贡献。集成时，dot 的 crafting 自然 trace/录像在 5A2-S 合入后**重跑**并逐字段归因。
5. **5A3**：结构/房间/region revision/RestPoint。cellProperties 迁移前后，每个节点/工位/RestPoint/箱的工作位集合与交互线结果逐格不变（新增回归 fixture），否则 crafting 已录 trace 失效。
6. 5C/5D/5E 另批；5C2 site 必须迁 region/world/spatial/action/实体 codec 的 depth 为 LevelRef，不是多加一个 depth=0。任何后续 SDK 需求由本地修订合同/fixture，dot 不直接改共享文件。
