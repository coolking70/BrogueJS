# 小队合同：P1a phase6刷新版

> 刷新：**2026-10-18**。原P0基线 `7ec0ca0`、原任务基线 `79bb26e` 仅历史；只读来源 `origin/ext/party-design` / `8bd271b4bc26dea697ca8af1257240d848f3665d`。现行参照为 `ext/phase6` / `0e684d100146af38b1e2056811fef821001f7555` 加本树试玩未提交差量。依据[已批准设计](https://github.com/coolking70/BrogueJS/blob/8bd271b4bc26dea697ca8af1257240d848f3665d/docs/ext/party-multiplayer-design.md)及[刷新任务书](party-p1a.task.md)。D-01～D-17保持；**M1–M5于2026-10-18已裁定，M5使用精简门禁**。§9中M6–M11仍是待决定建议，不冒称批准。本文仅文档，尚无party实现、不commit。

> 适用层次：P1a落实§1、§2单步声明、§3.0、§4及§6的单步分支；窗口/计划/可保存待决DTO归P1b，AI/队长指令归P1c，招募正式入口归P1d，网络归P2。下列未来类型保留为设计草案，不得在P1a存档中创建无语义的window/AI占位。

## 1 边界与不变量

1. 小队最多 4 名在籍成员，含留守成员。原生盟友不自动成为成员；招募须经显式命令及资格验证。死亡历史可归档，实体 ID 永不复用。首版可控角色只开放单格身体；giants 的 body member 与 party member 完全不同，不能据名称混用调度所有权。
2. `Game.player` 始终指向开局主成员，绝不随焦点临时替换。`primaryActorId` 不变，`leaderActorId` 是可显式移交的带队身份；主成员死亡后可以保留其实体/墓碑，不再作为存活/推进/可见性的判断入口。新规则一律解析 `actorId`，不能用 leader 代替当前执行者。
3. 同一实体只有一个实体所有者、一个所在层、一个计时所有者、一个背包根。成员记录只引用实体，不复制 HP/位置/背包/成长组件。当前层成员与原生怪物枚举须去重；托管成员不再额外运行一次 `Monster.takeTurn`。
4. 人工、托管、自动步进、重放都使用相同的 actor 命令准备与提交实现。外部改变规则状态的入口仍是 `executeCommand` / `executeItemCommand`；P1a单步、P1b窗口各作为一次外层执行事务，内部使用引擎授予的 actor scope，**不递归调用**公开 `executeCommand`，不把 NPC 耗时提交给 `playerTurnEnded`。
5. 焦点/镜头/未提交草稿只在 session；控制者及本阶段已实现、影响下一步规则的状态必须持久化；已接受计划、AI序号、窗口进度、打断记忆和可恢复待决选择待对应阶段启用时入codec。P1a不保存generator中的未完成确认，保存请求等待安全前缀。UI 先把焦点解析成显式 actorId，再提交；回放不读 UI 焦点。
6. 单个世界时钟。场外普通成员冻结；不能给每个成员调用一次整局时间推进或环境块。已批准的 world5 居民离线经济是另一种身份的机制，不能同时对同一成员算冻结、饥饿与日粮。

## 2 可类型检查的 DTO 声明（单步已裁定，窗口仍为后续草案）

以下为独立 TypeScript 声明；`PartyState/MemberState/PartyInput` 是M1单步分支，`*Draft`及窗口/AI类型是后续设计，字段名不代表已经开放的SDK。严格payload及有效codec仍须实施时核对。提取本节唯一 `ts` 块到仓库外可用 `tsc --strict --noEmit` 检查。这里的 `LevelRef` 重述当前 dungeon/site 形状供草案使用；P1 应导入届时正式类型及校验器。

```ts
export type ActorId = number; // 正安全整数；不同角色与生命周期不复用
export type Tick = number; // 非负安全整数，checkedAdd 检查溢出
export type Json = null | boolean | number | string | readonly Json[] |
  { readonly [key: string]: Json };
export type LevelRef = { readonly kind: 'dungeon'; readonly depth: number } |
  { readonly kind: 'site'; readonly id: string };
export interface Cell { readonly x: number; readonly y: number }
export type Controller = { readonly kind: 'human'; readonly slot: string } |
  { readonly kind: 'ai'; readonly policyId: string };
export type Reaction = 'stop' | 'continue' | 'ai-this-window';
export type Tactic = 'follow-leader' | 'attack' | 'keep-distance' | 'self-defense' | 'hold';
export interface AiSettings {
  readonly tactic: Tactic;
  readonly autoPickup: boolean;
  readonly consumableHpThresholdBp: number;
  readonly avoidHazards: boolean;
}
export type ActorIntent =
  | { readonly kind: 'move'; readonly dx: number; readonly dy: number }
  | { readonly kind: 'wait' | 'search' }
  | { readonly kind: 'attack'; readonly targetId: ActorId }
  | { readonly kind: 'item'; readonly operation: 'use' | 'equip' | 'unequip' | 'drop' | 'throw';
      readonly itemId: number; readonly target: Cell | null }
  | { readonly kind: 'exchange'; readonly toActorId: ActorId; readonly itemId: number; readonly quantity: number }
  | { readonly kind: 'module'; readonly owner: string; readonly commandId: string; readonly payload: Json };
export type Plan =
  | { readonly kind: 'queue'; readonly actions: readonly ActorIntent[] }
  | { readonly kind: 'travel'; readonly level: LevelRef; readonly target: Cell }
  | { readonly kind: 'ai' };
export interface WindowMemberStateDraft {
  readonly actorId: ActorId;
  readonly life: 'active' | 'frozen' | 'dead';
  readonly level: LevelRef;
  readonly controller: Controller;
  readonly pendingController: Controller | null;
  readonly plan: Plan | null;
  readonly cursor: number;
  readonly ai: AiSettings;
  readonly commanderOrder: CommanderOrder | null;
  readonly aiDecisionOrdinal: number;
  readonly emptyPlan: 'wait' | 'interrupt';
  readonly reactions: Readonly<Record<SoftInterrupt, Reaction>>;
  readonly aiOverrideWindowSeq: number | null;
  readonly seenHostileIds: readonly ActorId[];
  readonly lowHpLatched: boolean;
  readonly seenTelegraphKeys: readonly string[];
  readonly lastDecisionSite: string | null;
}
export type WindowLength = { readonly kind: 'ticks'; readonly ticks: 100 | 300 | 1000 } |
  { readonly kind: 'fine' };
export type Trigger = 'manual' | 'all-ready' | 'majority' | 'deadline' | 'plans-ready';
export type SoftInterrupt = 'new-hostile' | 'damage' | 'negative-status' | 'low-hp' | 'telegraph';
export type HardInterrupt = 'plan-invalid' | 'decision-required' | 'stairs' | 'trap-warning' |
  'member-death' | 'level-transfer' | 'no-active-member' | 'game-ended';
export interface InterruptFact {
  readonly kind: SoftInterrupt | HardInterrupt;
  readonly tick: Tick;
  readonly actorId: ActorId | null;
  readonly sourceId: number | null;
  readonly detailKey: string; // i18n 键；不存本地化显示句子
}
export interface PendingDecision {
  readonly id: number;
  readonly actorId: ActorId;
  readonly intentOrdinal: number;
  readonly kind: 'confirm' | 'dialogue';
  readonly requestKey: string;
  readonly allowedChoiceIds: readonly string[];
  readonly worldRevision: number;
}
export interface WindowState {
  readonly seq: number;
  readonly segment: number;
  readonly nextIntentOrdinal: number;
  readonly phase: 'planning' | 'running' | 'interrupted' | 'awaiting-decision';
  readonly startedAt: Tick;
  readonly elapsed: Tick;
  readonly length: WindowLength;
  readonly fineActorId: ActorId | null;
  readonly fineActionId: number | null;
  readonly fineIntentOrdinal: number | null;
  readonly automatic: boolean;
  readonly quietWindows: number;
  readonly interrupts: readonly InterruptFact[];
  readonly decision: PendingDecision | null;
}
export interface PartyWindowStateDraft {
  readonly schema: 1;
  readonly revision: number;
  readonly primaryActorId: ActorId;
  readonly leaderActorId: ActorId;
  readonly members: readonly WindowMemberStateDraft[];
  readonly window: WindowState;
  readonly nextDecisionId: number;
}
// P1a: no window, plan, AI or serializable pending-confirmation placeholders.
export interface MemberState {
  readonly actorId: ActorId;
  readonly life: 'active' | 'frozen' | 'dead';
  readonly level: LevelRef;
  readonly controller: { readonly kind: 'human'; readonly slot: string };
}
export interface PartyState {
  readonly schema: 1;
  readonly revision: number;
  readonly primaryActorId: ActorId;
  readonly leaderActorId: ActorId;
  readonly members: readonly MemberState[];
}
export interface ActorStepInput {
  readonly kind: 'party:actor-step';
  readonly schema: 1;
  readonly expectedRevision: number;
  readonly issuerSlot: string;
  readonly actorId: ActorId;
  readonly intent: ActorIntent;
}
export type SingleStepControl =
  | { readonly kind: 'leader'; readonly actorId: ActorId }
  | { readonly kind: 'travel-party'; readonly destination: LevelRef; readonly leavingBehind: readonly ActorId[] }
  | { readonly kind: 'recover-level'; readonly destination: LevelRef };
export type PartyInput = ActorStepInput |
  { readonly kind: 'party:control'; readonly schema: 1; readonly expectedRevision: number;
    readonly issuerSlot: string; readonly actorId: ActorId; readonly change: SingleStepControl };
export interface PartySingleStepRecordingEventDraft {
  readonly index: number; // whole-run command index, no window seq
  readonly input: PartyInput;
  readonly decisions: readonly boolean[]; // existing actor-bound continuation answers
  readonly trace: readonly ActorTrace[]; // verification only; never execute again
  readonly eventDigest: Readonly<Record<'extensions' | 'world5' | 'actorActions' | 'party', string>>;
  readonly fullDigest: Readonly<Record<'native' | 'extensions' | 'world5' | 'actorActions' | 'knowledge' | 'random' | 'party', string>> | null;
  readonly previousChainDigest: string;
  readonly chainDigest: string;
}
export interface PartySession {
  readonly focusActorId: ActorId | null;
  readonly drafts: Readonly<Record<string, Plan>>;
  readonly readySlots: readonly string[];
  readonly countdownDeadlineMs: number | null;
}
export type PartyControl =
  | { readonly kind: 'controller'; readonly actorId: ActorId; readonly controller: Controller }
  | { readonly kind: 'leader'; readonly actorId: ActorId }
  | { readonly kind: 'policy'; readonly actorId: ActorId; readonly settings: AiSettings }
  | { readonly kind: 'reactions'; readonly actorId: ActorId;
      readonly emptyPlan: 'wait' | 'interrupt'; readonly values: Readonly<Record<SoftInterrupt, Reaction>> }
  | { readonly kind: 'travel-party'; readonly destination: LevelRef; readonly leavingBehind: readonly ActorId[] }
  | { readonly kind: 'commander'; readonly actors: readonly ActorId[]; readonly order: CommanderOrder };
export type CommanderOrder =
  | { readonly kind: 'rally' | 'explore' }
  | { readonly kind: 'attack'; readonly targetId: ActorId }
  | { readonly kind: 'guard' | 'retreat'; readonly level: LevelRef; readonly at: Cell };
export interface WindowBatch {
  readonly kind: 'party:window';
  readonly schema: 1;
  readonly seq: number;
  readonly expectedRevision: number;
  readonly startTick: Tick;
  readonly length: WindowLength;
  readonly fineActorId: ActorId | null;
  readonly automatic: boolean;
  readonly trigger: Trigger; // 审计信息，仅进事件链；不参与规则分支
  readonly plans: readonly { readonly actorId: ActorId; readonly controllerSlot: string;
    readonly update: 'replace' | 'keep'; readonly plan: Plan | null }[];
}
export type PartyWindowInputDraft = WindowBatch |
  { readonly kind: 'party:control'; readonly schema: 1; readonly expectedRevision: number;
    readonly issuerSlot: string; readonly change: PartyControl } |
  { readonly kind: 'party:decision'; readonly schema: 1; readonly expectedRevision: number;
    readonly issuerSlot: string; readonly decisionId: number; readonly choiceId: string };
export interface ActorTrace {
  readonly ordinal: number;
  readonly tick: Tick;
  readonly actorId: ActorId;
  readonly intent: ActorIntent;
  readonly outcome: 'accepted' | 'rejected' | 'forced-wait';
  readonly actionId: number | null;
  readonly chargedTicks: number;
  readonly decisions: readonly string[];
}
export type PartyError = 'PARTY_DISABLED' | 'BAD_PAYLOAD' | 'VERSION_MISMATCH' |
  'STALE_REVISION' | 'BAD_SEQUENCE' | 'BAD_ACTOR' | 'NOT_CONTROLLER' | 'ACTOR_FROZEN' |
  'ACTOR_BUSY' | 'PLAN_LIMIT' | 'INVALID_TARGET' | 'ITEM_NOT_OWNED' | 'NO_SPACE' |
  'TRAVEL_NOT_READY' | 'STALE_DECISION' | 'DECISION_REQUIRED' | 'ZERO_TIME_LOOP' |
  'BUDGET_EXCEEDED' | 'INTERNAL_FAILURE';
export type Result<T> = { readonly ok: true; readonly value: T } |
  { readonly ok: false; readonly code: PartyError; readonly actorId: ActorId | null };
export interface WindowReceipt {
  readonly seq: number;
  readonly segment: number;
  readonly startTick: Tick;
  readonly endTick: Tick;
  readonly reason: 'budget' | 'fine-action' | 'interrupt' | 'decision' | 'terminal';
  readonly trace: readonly ActorTrace[];
  readonly interrupts: readonly InterruptFact[];
}
export interface PartyRecordingEventDraft {
  readonly index: number; // 全录像索引；不等于窗口序号
  readonly input: PartyWindowInputDraft;
  readonly receipt: WindowReceipt | null;
  readonly eventDigest: Readonly<Record<'extensions' | 'world5' | 'actorActions' | 'party', string>>;
  readonly fullDigest: Readonly<Record<'native' | 'extensions' | 'world5' | 'actorActions' | 'knowledge' | 'random' | 'party', string>> | null;
  readonly previousChainDigest: string;
  readonly chainDigest: string;
}
export interface KnownActor {
  readonly actorId: ActorId; readonly at: Cell; readonly hp: number;
  readonly maxHp: number; readonly hostile: boolean;
}
export interface AiView {
  readonly memberId: ActorId; readonly tick: Tick; readonly level: LevelRef;
  readonly actors: readonly KnownActor[];
  readonly knownCells: readonly { readonly at: Cell; readonly passable: boolean; readonly hazardous: boolean }[];
  readonly usableItems: readonly { readonly itemId: number; readonly knownUseId: string }[];
  readonly leader: KnownActor | null;
}
export interface AiDecisionContext {
  readonly view: AiView; readonly settings: AiSettings;
  readonly order: CommanderOrder | null;
  readonly ordinal: number;
  readonly draw: (purpose: string, upperExclusive: number) => number;
}
export interface PartyAiV1 {
  readonly id: string;
  decide(context: AiDecisionContext): Result<ActorIntent>;
}
export interface PreviewResult {
  readonly baseRevision: number;
  readonly model: 'known-world-v1';
  readonly trace: readonly ActorTrace[];
  readonly uncertain: true;
}
```

### 2.1 验证与实体归属

DTO 为 JSON 数据，禁止函数/accessor/原型键、循环、NaN/Infinity、负或不安全计数；除专门允许的 `null` 外不接受缺省语义混用。成员按 actorId 升序规范化；输入同一 actor 重复、同 ID 不同实体、一个物品多个根均拒绝。控制者 slot 是稳定的局内槽，不是 socket、设备或房间凭据。单机人工 slot 相同；网络鉴权由产品层绑定 slot，客户端不能靠 payload 自报身份。

P1b草案队列每成员最多32步；P1a只接受一个intent，拒绝计划/窗口/AI/网络字段。移动方向限定八方向，不能用 (0,0) 替代 wait。旅行目标必须为同一活动层已知格；长路由存目标并在行动点重规划，不信任客户端提交穿墙路径。物品按 ID 定位，不能靠库存字母跨成员寻址。module intent 必须同时满足已安装模块、声明的 actor 命令白名单及其原有 payload 验证；不能转发任意 Game 方法或保存 JS 闭包。

`MemberState.level` 是实体所有权层的校验索引，不是第二个独立可写层字段；事务中与实体一起发布。原生装备槽是背包物品引用，不能成为第二个根。成员升格保留 ID、当前 HP/状态、关系和战利品；把原 carriedItem 转背包时一次转移，不能克隆。招募先预检 slot/资格/层/身体能力，失败不扣资源、不半附着组件。

## 3 命令与窗口状态机

### 3.0 P1a单步分支（M1/M2已批准，2026-10-18）

`party:actor-step` schema1携带expectedRevision/issuerSlot/actorId和一个ActorIntent，使用整局command index，不借用window seq。公开边界验证模块、控制槽、成员身份/活动层/存活/ready/busy、物品唯一root与target，再发内部actor scope。未授权输入不得消费RNG、ID或有效命令前缀；当前classic/NPC入口不因新增DTO而开放任意actorId。纯focus不改revision、不发布机械事实。

调度停在**最近空闲人工成员需要输入的决策点**，同tick新增受控槽以稳定actorId领取；已有原生怪物列表顺序不改。先完成既有到期原子效果/环境/居民边界，后请求输入；另一成员同tick已就绪则不替其wait。已提交动作余时保留在唯一原生/actorActions计时根，不能因切换成员重跑prelude、重复扣时或重复环境块。麻痹等强制状态沿原生结算，零耗时/失败返回界面，不内部自旋。P1b“无计划默认wait”不适用于这个单步模型。

P1a只开放human控制、单步intent以及leader/travel-party/recover-level控制；未来window、AI、reactions、commander、独立party:decision输入一律拒绝。`travel-party`与`recover-level`是显式录制选择：前者验证M2就近/留守名单；后者只在无活动存活者且有冻结幸存者时可用，零时间进入选择后走正常入层事务。primary仍死亡时不能成为隐式存活/权限门禁；控制输入的actor须是合法所属成员，恢复时允许该槽控制的冻结幸存者，不能错误套用单步的ACTOR_FROZEN拒绝。

确认/目标选择锁定actor、物品、world/command epoch与有效revision。既有continuation在原命令内完成并把答案记录于同一步，切焦点不换执行者。接受前执行Worker栅栏；接受后允许确认/动画推进至安全点，保存等待命令完成，避免flush与确认互等。不能序列化generator、默认同意或伪造窗口收据。`PartySingleStepRecordingEventDraft`只表达新增字段关系，实际事件必须保留现有tick/level/双流/terminal/checkpoint诊断与验证，不能用草案覆盖掉生产v4的字段。

最小party roster不复制HP/背包/成长/倒计时；actor级回合尾声归native、动作相位归actorActions、growth/loot收据归extensions。尚需表示的就绪进度及跨层冻结剩余量必须在最终codec/写集明确归域，不得靠无法重建的session游标驱动下条命令。

### 3.1 规划与接受（P1b及以后，非P1a输入）


`planning/interrupted → running → planning/interrupted/awaiting-decision`。终局不接受新窗口。一次输入携带 seq 和 expectedRevision：窗口 seq 严格递增；重复网络包由房主按已接受 ID 返回原收据，不能执行两遍；回放中重复/缺口直接报 OOS。纯 UI 编辑草稿、准备按钮、网络等待不会推进 tick 或 RNG。

接受批次前一次校验权限、所有计划语法/长度和全部静态引用；失败返回错误、世界/双 RNG/录像有效前缀保持。批次中 `replace + null` 清空计划；`keep + null` 保留尾队列，keep 携非空 plan 拒绝。未列出的成员明确视为 keep；房主应为全部当前人工成员发送规范化行。控制权改变后旧控制者草稿无效。

批次接受不保证未来每一步合法。取步时重新验证目标存活、层、物品归属/冷却、占位与风险；失败不跳过后继续执行错误队列，产生 `plan-invalid`，保留失败步供 UI 修订。竞争同格/同物品以调度实际先后决定；不预扣整个窗口资源。

### 3.2 时间与同 tick 边界（窗口细则归P1b）

- 窗口 tick 起点取引擎单调客观时钟，不能取 logger.turn、帧时钟或网络时间。party-only 局也要有客观时钟端口，不硬依赖启用 settlement/combat/world5 模块。
- 每次时间增量是当前原生最近事件、阶段动作边界、客观环境边界和窗口剩余 tick 的最小值。只允许非负增量；到达 W 立即停止推进。未完成行动保留剩余计时，不为凑整截掉伤害/后摇或补一次等待。
- 沿用原执行阶段的顺序：已提交的当前原生动作先发布；推进时客观块在到期 actor 调度前运行，块末清理与 world rest 发布在同 tick actor 结算后完成。扩展调度现有 actorId 升序保留；新增受控成员进入相应 actor 槽。准备同时就绪的成员按 actorId 升序提交，不能按 UI 焦点/数组插入/网络到达顺序。
- t0 已到期的强制阶段先按现有调度边界结清，再收取该边界尚未领取的成员决策；不得在恢复窗口时重复 native prelude。P1 必须用单成员删除投影验证现有 NPC 与主成员同 tick 顺序，不能用本草案的“升序”改写经典无调度器的怪物列表顺序。
- t=end 的既有到期阶段、客观块和它们已触发的强制效果完成；不再领取新的计划动作。中途打断只在完整原子边界发布，不能退出半个 objective block、transaction 或多格伤害分发。同 tick 已开始的原子结算全部完成后才允许人类输入；未来行动不预先执行。
- 只有一个 countdown owner。成员原生即时移动/攻击各收一次原生耗时；阶段动作计时只由 `actorActions` 写，禁止同时从 Monster 和成员两条路径递减。
- 人工成员无计划默认按自己的移动行动单位 wait；配置 interrupt 则在取步前停。麻痹/沉眠等不能发命令时照原生强制等待/状态恢复，不反复尝试失败命令，也不凭空消耗计划游标。
- **精细档**选择批次中的 `fineActorId`（必须显式记录，不读焦点），最多领取其一个行动，推进到该行动耗时/阶段动作结束；其他成员按各自计划正常参与，其间可打断。若该成员已有跨窗动作，就只等待它结束，不再取新步。安全上限仍为 1000 tick，超出保留续体并以 budget 返回。
- 零耗时控制/改名等不能作为无限计划循环。每个同 tick 决策点最多一次失败或零耗时 intent；重复企图报 `ZERO_TIME_LOOP` 并中断。规范化批次最大 128 个排队 intent；运行期最多 1024 次 actor 决策/段（提案），超限保留已完成前缀并硬停，不强制跳过后续事件。

### 3.3 打断与确认（P1b）

| 事实 | 检测时点及去重 | 默认 / 可覆盖 |
|---|---|---|
| 新敌人 | 每成员视野更新后，hostile ID 首次加入该成员已见集；开窗已有敌人不重复打断；同怪遮挡后重现不算新 ID | stop；可 continue/ai-this-window |
| 伤害/负面状态 | 实际 HP 减少；负状态新获得或强度/时长增加；毒等持续伤害按本段事实聚合 | stop；可覆盖 |
| 低 HP | 从阈值以上跨至阈值及以下，或新局/读档首次在阈值以下；恢复到上方解除锁存；提案 25% | stop；可覆盖 |
| telegraph | 新预警或预警形状首次覆盖成员当前足迹；actionId+segmentIndex+actorId 去重 | stop；可覆盖 |
| 计划失效 | 取步验证失败，未提交副作用 | 硬停，不能 continue 无限重试 |
| 确认/对话 | 原提交路径要求输入，世界停在可序列化的安全前缀；未批准的后缀不执行 | 硬停；不得由 AI 默认点“是” |
| 楼梯/陷阱 | 到达决策点或原生风险提示，按地点+访问转换去重 | 硬停；提交显式确认后再继续 |
| 成员死亡、换层、无活动成员、终局 | 完成该原子边界及死亡清理后 | 硬停 |

软事实同 tick 全部记录，展示按 tick、actorId、kind 固定顺序；不能为挑“第一条”漏记另一名成员受伤。AI 本窗接管标记随窗口保存，窗口结束清除，不改永久控制者。停止反应优先于继续，任何硬停优先；多个成员触发不同反应时只要有 stop 就结束窗口。普通 logger 文案/翻译变化不构成打断事实。

打断后的下一次 advance 开新窗口预算，跨窗动作与未消费队列延续。`awaiting-decision` 则是同一窗口的新 segment：选择事件引用 decisionId/actorId/intentOrdinal/worldRevision；无效或过期 token 拒绝。确认“否”按原生命令语义处理，不执行未批准后缀。对话选择用稳定 choiceId。未完成的命令不能依赖序列化 JS generator：P1b 必须把待决阶段化为引擎 DTO，或在允许存档前显式退回一个已落盘前缀，绝不能把现有 generator 丢掉还声称可续录。本文目标是 DTO 可保存/重建，属于 P1b 验收项。

### 3.4 自动档与推进触发（P1b/P2）

自动档只读全队共享已知威胁/危险地形：有任意威胁或上次打断用 100；连续 3 个无威胁完整窗口后升 1000（3 为提案参数，进入规则配置）。反应配置和 automatic/quietWindows 入摘要。切换手动 W 在下次批次生效，不能改正在运行的上限。

联机全员准备按**人工控制者槽**去重，排除无活动成员的槽；投票是有资格槽严格过半后启动倒计时。倒计时只在产品层运行，结果落成确定的批次（缺席计划 keep/等待或已记录的 AI 转交）。各端不能自行比较墙钟来补步。trigger 保存于事件链作诊断，但同一规范化计划和长度应产生相同机械结果。P1 只需手动/自动档；其他触发由 P2 接线。

## 4 按成员机制

| 机制 | 所有权与处理合同 |
|---|---|
| 背包/装备/使用 | 每成员独立 Inventory/装备与携带上限；包括戒指双槽、符文反应、投掷、鉴定进度。当前 `instanceof Player` 的能力判断改为明确 actor 能力读口；经典旧路径保留。共享知识不等于共享背包。 |
| 交换 | 同层相邻（八邻接且不穿阻隔墙角）且双方存活；物品未被工作/动作预留，接收方有容量。一次交易原子转移 root/装备引用并刷新属性；M2已批准由发起者支付一个移动行动单位，收方不额外扣时。忙碌收方不接收，失败零扣时。 |
| 饥饿 | 每人一份需求账：有原生 nutrition 的成员继续原生阈值/吃食规则，foraging need 用组件适配同一权威值，不能再重复掉饥饿。没有 foraging 也能运作。成员冻结不补扣；转居民后才按 5D 日粮合同。当前 ActorNeeds 排除 player 且只收 Monster，须显式扩接口，不能声称直接复用已完成。 |
| 状态/恢复 | 原生按行动回合发生的恢复与客观 100 tick 发生的状态/营养分别保留所属时钟；每成员 own regenCarry、poisonedDuringTurn、免疫/饥饿提醒。不能把主成员所有回合尾声搬进每次 100 tick 块。受伤来源、搜索蓄力、自动路径、确认目标按 actor 分开。 |
| 知识/视野 | 鉴定知识与探索记忆共享；对每名活动成员独立计算 LOS、黑暗/隐形/心灵感应资格，再合并合法可见信息。焦点切换只投影；不能因焦点不同改变发现/AI/RNG。视野并集不等于把某成员的特殊感官借给另一成员做射击资格。照明多光源需分离 cosmetic 与 substantive。 |
| 敌方 AI/气味 | 敌人可选择任一可感知敌对成员，不能永远追 leader；沿原敌对、混乱、俘虏规则筛选，候选平局采用稳定 ID。气味/安全图需支持多源或按目标缓存；成员身体/能力不同不能共用错误的通行图。 |
| 成长 | growth组件按actor；M4已批准实际攻击伤害/成功辅助影响该战斗者进入参与集，死亡/离层不抹历史，基础奖励按参与者等权、整数余数按稳定actorId。首访/鉴定是全队一次奖励池，按事实发生时活动存活成员分配；具体辅助白名单审后入指纹，不留P1d才决定权重。phase6 `growth.xp-gain`、盟友旧分账及死亡领取细则待M6；身份首访资源/物品成长与XP分池分离，不能克隆奖励。 |
| 死亡/胜利 | 成员死亡取消未执行计划和 owned actions、释放预留、按实体规则处理物品/掉落与死亡事实一次；其他人继续。所有在籍成员（含冻结者）死亡才失败。无活动者但有留守存活者零时间进入显式恢复选择，按正常入层事务激活选中层、其余仍冻结，不能误判失败或让时钟空转。胜利仍需原生护符/出口条件，但检测全队携带与一次队伍确认；结算唯一物品 root，避免四份重复计分。队长死即败仅预留变体，不作为默认。 |
| 换层 | 一个活动层；活动存活成员均在楼梯 Chebyshev 距离 ≤1 且可达，或显式列入留守集合。预检目的地所有落点、busy/确认/预留；失败不移动任何人。转移保持 ID、背包、阶段动作允许保留的恢复部分；遗留 windup 按既有跨层取消规则，不跨层放技能。留守成员保存层所有权/状态/计时并冻结。不能以 depth=0 表示 site。 |
| 坠落/传送 | 同层传送仅该成员变化并打断。M2已批准强制跨层（坑洞）为该成员进入目标层、其他成员冻结于原层，切活动层并硬停；属于强制事故例外，不给普通成员自由异步换层。安全落点/掉落伤害仍沿原生路径，不能瞬移整个小队免伤。 |
| 营地/同伴/休息 | 转居民和编入成员是互斥身份事务，解除旧需求/工作/控制关系。原生同伴依然 AI，不计人工准备。篝火休息按 D-11 要求全部在籍存活成员在场（留守者须召回），资格在开始和结算均检查；恢复按各人资源，不用队长装备代表全队。 |

“附近1格”、交换费用、冻结恢复与强制坠落已由M2于2026-10-18按推荐批准，是扩展多人规则，不是CE原生规格。M3同时批准：P1a只做开局两人闭环/4人合法配置，俘虏、叙事及居民正式招募/互转入口后置P1d；当前居民系统适配与身份排他仍必须完成。

## 5 AI v1 与队长指令

`PartyAiV1.decide` 接冻结的已知视图，不接 Game/可写实体/全地图。五档策略沿批准设计：跟随以 leader 的已知位置为目标；进攻选合法可感知敌人；保持距离使用射程与可通行代价；自保只处理近身威胁/恢复；不动仍受原生强制状态时钟影响。自动拾取受容量/已知危险约束；消耗品默认不开启，显式开启后仅用已知用途且符合阈值的物品，未知药水不代饮。

策略只能产一个 ActorIntent；结果走与人工同一验证和提交。选择的抽样用 `DerivedDraw` 类独立派生流，键含 seed、规则指纹、policyId、actorId、aiDecisionOrdinal、purpose。ordinal 每次已接受的决策推进一次（含无路而 wait），失败的 UI 查询/预演不推进主局 ordinal。按 purpose 预分配抽样位，不用 wall-clock、Map 非规范顺序或 `Math.random`。**动作执行中的命中/伤害/原生随机仍使用实质 RNG**；“AI 不消耗原生 RNG”只指新增决策策略，不能把实际战斗随机也换掉。

托管错误/预算超限给出诊断并以确定的 wait 回退，不无限重试；内部一致性错误则锁存并停止本段，不静默吞异常。路径搜索节点预算提案每成员每决策 4096；用固定展开次序、共享只读障碍缓存，跨能力/层/占位 revision 不复用。

队长指令是已记录的零耗时规则命令，目标为明确 ID 列表；集合/攻击/守点/撤退/探索只改托管目标，不额外直接移动。对人工成员不覆盖其计划；需先显式托管。原生盟友经相同指令适配器改变意图，仍由自身 NPC 行动点执行。多格成员指令路由 decision owner，不逐部位发动作。指令冲突以后接受的 command index 为准；失效目标按本档位确定回退/等待。

控制权切换立即记录 pendingController，到该成员下一个空闲决策点生效；已有长动作不中途取消。切换时清理旧提交队列，避免前控制者留下一次隐含攻击；明确想保留时由新控制者在下一批次重新提交。ai-this-window 的临时接管独立于永久 pendingController。

## 6 存档、录像与摘要

### 6.1 单次执行、可验证回放

**P1a**记录显式ActorStepInput/SingleStepControl与actor绑定确认答案，执行一次，trace只校验不再调度。255/256/257与2047/2048/2049、自然save/load/续录/seek必须覆盖所有成员及冻结根。存档请求只发布已完成命令的安全前缀；本步没有可存活generator或窗口DTO。

**P1b及以后**以下窗口/分段规则生效：窗口输入保存 W、所有成员计划、规范化 seq、startTick、revision 与 trigger。实际执行生成 ActorTrace（顺序/actorId/动作/耗时/actionId/确认选择），写在窗口收据；**回放只执行批次一次**，重新生成 trace 与保存的 trace 比较，不把 trace 再当公开命令执行一遍。原有 NPC 自动结果仍由模拟重算，不复制整世界成每步事件。

一次打断结束一个窗口；人工选择分段则同 seq、segment 递增。每段都是可验证事件边界：双 RNG、机械摘要/链、所有成员位置/HP 等诊断均可校验。普通控制/对话选择亦记录为有序输入；会话焦点不记录。段中的 trace 是“成员每一步同样记录”的落实；必须能定位段内 ordinal，不能只存末尾队长位置。

存档只发布完整原子边界，含正在进行的 actions、计划尾部、冻结成员、控制者/待切换者、待决 DTO、AI 序号及打断锁存。重建时重新建立引用/缓存，不序列化闭包、token、网络对象。保存请求可排队到下个安全点；不可在半次同步 resolver 内快照。seek 恢复同一版本快照 + 后续批次，恢复焦点可选第一个存活活动成员，不能改变规则结果。

### 6.2 域归属（每个权威字段恰好一域）

| 域 | 新增归属 / 避免重复 |
|---|---|
| `native` | 所有成员实体的 HP/位置/状态/背包/装备/原生饥饿与 actor 级回合尾声；全队终局与全局时钟；兼容 player 顶层与实体图别名必须一致，按既有别名拆分原则处理 |
| `party`（新增 dirty 域） | P1a roster/控制槽/primary/leader/revision及必要就绪进度（不得重复native倒计时）；P1b以后才加入pendingController、计划/游标、窗口/自动档/AI ordinal/反应/指令、seenHostileIds/lowHpLatched/决策点锁存、可恢复待决DTO。即使叫“已见”，这里是打断状态机而非世界知识 |
| `actorActions` | 跨窗动作相位、decisionOwner/timeChargeOwner、资源预留和计时；party 只引用 actionId，不另存倒计时副本 |
| `extensions` | growth/combat/foraging/loot等组件和模块规则状态；growth参与/奖励/资源收据、loot全局掉落台账及属性材料化账按现有持久根登记唯一归属。物品moduleData沿现有实体/域拆分投影，不另在party复制。party策略参数定义在manifest，实时控制只归party |
| `world5` | 层/营地/居民经济/工作票据；不能再保存成员背包副本或重复冻结需求 |
| `knowledge` | 全队共享鉴定、探索记忆、原生持久观察；物品知识从每个成员背包及所有别名行拆分，不能只扫 root.player.inventory |
| `random` | 现有双流状态；派生算法身份在规则指纹，AI ordinal 在 party |
| 排除 | focus、草稿、ready/投票/倒计时、连接 ID/RTT、相机、动画、诊断、预演副本、路径/FOV 临时缓存；已有影响下一条命令解释的录制 inputState 必须改为显式 actor 上下文，不能笼统删去 |

新增 Game 字段逐项登记 U03 和 recording-digest-contract；如采用惰性 WeakMap，仍登记持久入口/codec/摘要投影，不能用 WeakMap 藏机械状态。party dirty revision 每次事务发布统一递增；独立 full oracle 每次新投影，不能与缓存实现同源自比。

P1a保持现有256命令分块/2048检查点及非整块末行full的节奏；P1b长窗口才增加**每段末强制full digest**，事件dirty域每段检查。这样可把完整 native/knowledge 的区间缩至两个验证边界之间，但不能保证隐藏错误精确到某个 actor 步。报告仍区分 dirty 域精确事件与 native/knowledge 首个可验证分歧 + `(previousVerifiedBoundary, command]`；网络按窗口末 full digest 比较。性能如超预算须显式修订检查节奏，不能只比较队长摘要冒充全队校验。

### 6.3 版本与零影响的协调

现行源码为 **foundation20 / whole-run7 / recording4 / origin2 / world5.schema6**，worldSdk2/edibleSdk1/itemSdk4；growth1.10.0。loot在HEAD0e684d1为0.9.0，当前试玩工作区为0.9.1，pack0.6.0/schema5、实例6/state2；不得混淆模块/pack/实例版本。详细八模块身份及工作区差量见任务书§1和刷新报告。

M1已批准按能力选择**有效codec身份**：party候选 **F21/S8/R5/O3**，非party维持开工冻结源 **F20/S7/R4/O2**；party schema1，未来netplay protocol1独立。候选不是占号，开工按最终写集复核；没有world5根变更则维持schema6，有变更必须审其有效分支和所有消费者。不从旧F13/F14或S6盲分配。

当前`descriptor.ts`校验、各模块descriptor、`RecordingDigest.codecIdentity`、`RecordingFormat`/Game header都仍读全局FOUNDATION_PROTOCOL；**双有效身份尚未实现**。P1a需覆盖manifest/descriptor准入、模块规则/configuration指纹、snapshot validator、digest域顺序、header/origin/checkpoint、Worker job generation/codec以及load/seek路由。party改变growth等模块语义时须明确party能力分支的有效版本/指纹，无party同启用配置沿phase6旧身份；不能无条件升全局常量或所有module.version后声称非party字节未变。旧v4严格读取器不能读新party事件。

零影响比较源是实际phase6开工冻结树，包含届时接受的试玩修复，不回退成5Z。不允许忽略版本字段或删除新增字段再作字节比较。若双身份真实不可实现，报告阻断并取得修订，不能私自改成全局升号。旧不兼容party档明确拒绝，不做迁移；缺party包必须拒档保活局，不能丢成员。删除netplay后的单机能力在P2验收。

### 6.4 录像链和Worker现行修复必须保留

`Game.recordInputEvent`在下一条命令加入前撤销上一条**非256固定边界**临时末行fullCheckpoint并重算其chainDigest；导出/保存才加的full不能让同一命令链随保存频率变化。party事件/异步job/recordingOrigin前缀也须一致，测试中比较“直接连走”和“非周期保存→继续/读档续录→再保存”的事件、完整链、seek终态。不可把固定chunk full或P1b未来语义段末full一概清掉，应明确边界来源。

保留5Y两待决chunk限额、接受前栅栏、旧generation隔离、乱序顺序发布、运输失败一次inline降级、完整性失败禁止导出；所有成员native/knowledge/party与现有loot来源/物品数据必须来自同一冻结job。全图full oracle独立投影，不与增量缓存自比。主成员死亡但仍有幸存者时允许继续录制和保存，不以player.hp代替终局。

## 7 预演与零影响验收

预演不能简单调用现有 `toSnapshot → 模拟 → loadSnapshot` 后宣称没有副作用：本项目 rng/logger/实体 ID 分配器及模块会话含全局和不可快照状态。使用独立 Worker/隔离引擎容器，复制已知世界的投影、已提交草稿和专用 RNG 副本；不得触发主局日志、存储、输入确认、网络或 recording observer。结果带 baseRevision，主局 revision 改变即丢弃。

首版 `known-world-v1` 只包含成员已知地图/可见实体，未知格不能规划穿越；敌人按展示模型保持当前状态/已知动作，不调用隐蔽真实 AI。预演显示为不确定预测，不能读取完整隐藏世界再透过伤害结果泄露敌人。对两个已知投影相同、隐藏世界不同的存档，预演输出应相同；真实推进仍使用完整权威世界。预演的临时 allocator/RNG/ordinal 不回写主局，不记录输入；实际提交重新验证和执行。

classic、无party的全部扩展组合以及物理删除party时均适用以下不变量；M5实际运行范围为任务书§6精选集合与一行全删，不要求穷举理论512子集，不用抽样通过冒称全部实测：

- 对象 own keys/descriptors/关系图不增加 `party: undefined`、成员标记或常驻数组；只在启用并合法开局时惰性创建。
- 同种子同命令与phase6开工冻结源配对比较：规则结果、双 RNG 完整状态与计数、生成、日志/确认顺序、存档/录像规范化字节、原有摘要相同。既有 savedAt/recordedAt 用固定时钟捕获再比较，不能靠删除新增字段掩盖差异。
- 焦点往返、开关草稿、看详情、预演、房间准备/取消：主局机械摘要/双 RNG/实体 ID 分配器/有效录像前缀完全不变。投影不能提交识别/发现等机械事实。
- 删除party应退化为单人且缺包party档拒绝，这是产品合同；M5本步实际只验一行全部模块物理删除（含party），正常精选组合另验有/无party。不能将此证据宣称为“只删party保留八模块”的未运行布局通过。删除netplay后单机4人保存/seek/续录留P2。软件禁用与物理删除分别留证。

## 8 错误与事件发布

上述 PartyError 是引擎稳定码，UI 通过 i18n 显示；不能直接把内部 Error.message 给玩家。静态非法输入、权限、版本、过期 seq/revision 在接受前拒绝，零 RNG/零部分写入。运行期目标失效与超限保留已完成安全前缀、输出中断收据；异常不是事务成功。`INTERNAL_FAILURE` 锁存不可推进状态并使该未完成段不可导出为有效录像；保留诊断及最后验证边界，不吞错假装 wait。

P1a单步只在安全提交后发布带command index/actorId/tick的actor结果及死亡/控制事实，不伪造window seq。P1b/P2 UI/网络可订阅 `window-accepted`、`actor-intent-resolved`、`window-interrupted`、`decision-requested`、`window-finished`、`member-died`、`control-effective`；仅在所属事务安全提交后通知，消费者不能回调改世界。事件携带 seq/segment/ordinal/actorId/tick，规范化事实不含本地化字符串。网络重传不重复发布。P1 对本合同的实现测试与性能方法见[审计报告](https://github.com/coolking70/BrogueJS/blob/8bd271b4bc26dea697ca8af1257240d848f3665d/docs/ext/party-p0.report.md)。

## 9 phase6接入补充与批准状态

### 9.1 已裁定M1–M5（2026-10-18）

| 编号 | 2026-10-18 裁定 | 落实位置 / 边界 |
|---|---|---|
| M1 | **按推荐批准**单步 `party:actor-step` schema1、最近人工决策点、同 tick 新成员槽按稳定 actorId、party 独立域及双有效 codec。身份候选随当前基线更新为 **party F21/S8/R5/O3，非 party F20/S7/R4/O2**；候选不等于已占号 | 任务书§3.3、合同§2/§3.0/§6.3；开工按实际写集复核。不改 world5 根形状则维持 schema6，不因旧稿 schema4 盲升号 |
| M2 | **按推荐批准**八邻接交换且不穿墙角；发起者付一个移动单位，收方不扣时，busy 收方拒绝；楼梯 Chebyshev≤1 且可达；强制坠者进入新活动层、其他成员冻结；仅留守者存活时零时间进入明确恢复选择，按正常入层事务激活选中层，其余冻结 | 合同§4；换层/留守/恢复为显式录制输入，确认绑定发起 actor，不能由焦点代选 |
| M3 | **按推荐批准**P1a 开局两人产品闭环，4 人合法开局配置/受控验收；俘虏、叙事、居民正式招募入口及居民双向互转后置 P1d | 本步身份排他、同 ID 转换接缝/拒绝守卫及现有营地联动仍必做；不实现 clone 成第二个 Player |
| M4 | **按推荐批准**攻击实际伤害或成功辅助影响该战斗者入参与集；死亡/离层不抹历史；参与者等权、整数余数按稳定 actorId；首访/鉴定全队一次奖励池按事实发生时活动存活成员分配 | 总池取既有奖励定义；辅助事件白名单必须审后入规则指纹。phase6 新增 XP 增益先后等细则另见 M6，不得改回全给主成员，也不得禁用 growth 规避 |
| M5 | **按维护者修订批准**当前 ext 精简门禁：影响面选测、精选组合冒烟（含 UI 创建流程）、一行物理全删、boundary/依赖/vue-tsc/build。性能走云端拆分 A/B 与 D6 修订口径；P1a 先实测单步/摘要/体积，P1b 再定阈值 | 任务书§6/本合同§9.4；不跑 256/512 穷举冒烟、完整 npm/test:ext 或 drift 套件，不恢复旧 full/gen 要求。新增 party 能力口优先；SDK 以 phase6 当前字节为基线逐项审计，不声称历史九文件从未变化 |

### 9.2 必须保留的phase6合同

- **独立actor属性与能力**：现有StatPipeline已经按actor、target、facts、revision缓存；runtime追踪跨actor组件读者，缺组件读取后创建/删除、GC、回滚也要失效；growth派生缓存包含ruleActor/scopes/基值。扩多actor不能退化为只加focus键或把所有缓存当单玩家缓存。保留4096读集溢出全局失效、knownOnly/hypothetical隔离与source验证凭证/聚合预算。
- **来源与物品**：loot属性从每个actor的装备取，套装计数不得跨成员凑件；孔/符文词/强化/本地伤害与growth.attribute派生保留来源顺序和舍入。装备容量升不补、降钳制与永久grantPolicy分开；交换/取消/退款需失效双方与真实跨actor读者。loot `!actor.player`怪物缩放和growth模板资格必须通过受控成员能力口审清，具体选择见M8。
- **唯一根和来源账**：掉落共享地面、拾取进入实际actor背包，物品ID/moduleData/knowledge不复制；unique/set/part出生代数/encounter序号全局一次，WorldWork装备escrow、预留、取消退款、完成票据/ordinal及craft≤magic继续有效。site掉落协议存在不代表有site游戏入口，本步不借party扩5C2。
- **时钟**：环境/居民需求每正elapsed只结算一次。ActorNeeds的native nutrition适配不增加伴随第二账；普通留守与resident经济身份互斥。growth全局clock的到期遍历须适配冻结成员，具体剩余量表示待M10，不能默默过期。
- **事务写集**：成员entity/inventory/equipment别名、native资源/计时、growth组件/参与收据、loot模块物品数据/来源台账、材料化账/预留/escrow、inputState/revisions均逐项登记到现有world/generation/command/item事务及摘要归属。`WorldCheckpoint`共享只读捕获/`ext/json.ts`不可变分支凭证不是省掉新成员写根的理由。写后嵌套保存点重建；失败保对象身份/双流/allocator。缓存留世界图外，可失效重建，不持久化缓存值冒充权威。
- **创建与显示**：MainMenu保留原创建session/step/attempt、取消/重试、重复提交锁，保留`structuredClone(toRaw(configurationDrafts.value))`到manifest前的快照。`ext/ui/creation.ts`现为每owner一个initialCommand；M9未定前不能靠多塞命令或直接写成员绕过验证。focus显示、loot比较/已知投影/工作候选按显式actor读取，不消费实质随机流。真实创建链单测与浏览器结果分列。

按文件的冲突证据、处理建议、A01–A13映射及未来写集见任务书§7/§9；这些是实施义务，本次未改任何代码或冻结新接口。

### 9.3 新增待决定细则（均有推荐，尚未批准）

| 编号 | 新问题（截至本次仍待决定） | 推荐 | 影响 / 决定前边界 |
|---|---|---|---|
| M6 | growth 1.10 XP 增益、辅助白名单、盟友旧分账与死亡参与者如何衔接 M4？ | 先按现有资格/总池/一次收据取基础 XP，再按 M4 等权整数分池，最后各领取者各调用一次 `growth.xp-gain`；倍率后总和可变，不再次均分。辅助先限成功造成实际治疗/护盾吸收/有效增益或控制的权威结果，禁止仅按施放、日志或 UI 声明入集；逐事件映射审后入指纹；缺权威事实的辅助暂不列入，不借此新增技能。party 成员不再走原 player/ally 二次分账；未升格盟友仍走原规则，把原 player 份作为队伍池，不能直接变成员。死亡/离层保留参与席位，冻结存活者可领取 XP；死者份记入终结收据但不复活、不转赠 | M4 未决定倍率先后、辅助事件全集和死者发奖细则；B 段 XP 实现前定案。故事奖保持原显式收据语义，本步不扩叙事招募；不能以本建议冒称已批准 |
| M7 | 共享掉落下 rarity-find 从谁取值，拾取过滤和金币归谁？ | D-16 共享地面掉落保持；kill/part 用权威 `EffectOrigin.creditActorId`（不合资格则固定主成员基准），floor/vault/encounter 用固定 primaryActorId，均不取 focus/leader/最近查看者；成员死亡后允许读取其冻结终态属性。唯一/套装/part/encounter 收据仍全局一次。拾取归实际位移/手动命令 actor，沿当前局级 loot 过滤偏好，不在 P1a 新增每人过滤配置；金币沿现有局级权威账，独立背包不自动改为四份钱 | `DropEvent.playerId` 与宿主取值守卫需 actor 适配，字段名不能直接换成未经授权的 payload；B/C 段前定案。此推荐为首版稳定口径，非 D-16 自动推导 |
| M8 | 非主成员如何获得 growth 身份/装备属性，又避免被 loot 当怪物缩放？ | 增加明确受控成员能力/身份读取，不篡改 `Game.player` 或全局 `ActorFacts.player` 语义；成员使用各自 creation identity、装备、L0 原生基值与 L2 装备→growth 属性→派生值；loot 怪物环境缩放排除全部 party 成员。原非成员 NPC 的模板白名单保留；容量增长政策沿来源 `grantPolicy`（装备容量升不补、降钳制；永久成长保原授予） | 已批准独立成长不等于已批准把所有 Monster 标成 player；A/B 段能力分类与版本/规则指纹前定案 |
| M9 | MainMenu 如何同时收集多成员身份并维持每模块一个 initialCommand？ | 在现有创建会话中增加 party roster 草稿；growth 一步收齐各成员身份并输出一个版本化批量 initialCommand，party 步收成员数/稳定槽。最终配置与全部初始命令统一预检、只发一次 new-game；引擎内 roster→actor 映射→按 actor 初始化，实际命令按公开录制边界执行。不靠 UI 预分配实体 ID，不改成多个同 owner 字符串绕过计数检查 | 具体跨模块步骤依赖/批量 payload 与成长模块有效版本仍待定；需保留无 growth 的两人创建。不能仅复制现有单角色面板、按数组顺序猜执行 actor |
| M10 | 留守冻结与 growth 的全局 `objectiveClock` 到期清理冲突如何处理？ | 单世界时钟保持；成员冻结时保存效果/冷却/focus 的剩余时长或冻结起点，恢复时平移绝对截止值，使非活动期间不扣时；不整体回退 growth 时钟、不冻结居民经济或普通 NPC。XP 收据可在冻结期间发布，计时仍不前进 | 合同“普通成员冻结”已定；需决定具体表示与 `extensions` 写集/容量，A/C 段前定案，并测长跳、恢复、seek |
| M11 | 如何给尚不存在的 party 接入云端 A/B，而不冒用 6C4 基准？ | 保留 classic/现有八模块无 party 的可比路线作为回归对照；新增显式 party-only / party+all 的 1/2/4 人固定命令场景、独立 identity/路线/预算来源，分别测单步、摘要、体积。为 runner/selector/workflow 增加已审 party 身份后沿用三分片与汇总校验；四人数据不能拿单人路线直接判退。P1a 不设新绝对性能硬阈值，P1b 据云端完整样本定案 | M5 的云端/D6 方法已定，此项决定新增场景与工具写集。现有工具仅有 p0/6b4/6c1–6c4 身份，尚不能直接选择 party；不得改旧输入 hash 或用 `--limit` 当正式结果 |

### 9.4 性能和运行范围

八旧模块理论256子集，加入party理论512；本步按任务书§6选12条正常配置（含classic、11个扩展子集），不穷举剩余501个扩展子集；一行全删，单删/单留等布局未验明列。影响面整文件选测及boundary/测试依赖/vue-tsc/build是M5批准门禁，不跑完整npm/test:ext/drift或旧full/gen。软件不变量不因范围缩小而放松。

性能由云端classic/all-full/all-prefix三分片交错A/B三轮并汇总，D6修订为命令/客观回合P95+10%、命令max/客观回合P99+25%、墙钟+10%，至少1ms且严格大于，三轮两轮任意项越线判退；客观回合max只报告。all/full工作量不同仅报告时间，但完整正确性硬检查仍须通过；all/prefix必须保持同输入/双流/blocks/rounds/roundTicks可比，不能以短前缀证明D20。

P1a实测1/2/4人单步、event/full摘要/Worker flush、存档录像与新增成员字节、内存和边界长尾；P1b才冻结新阈值。P0的64KiB/256KiB和窗口毫秒值只作历史预算提案，不是本步硬断言。现有phase6工作流/selector尚未开放party身份，M11定案后接入；旧冻结预算不可改头冒用。无数据、短跑或缺分片不称pass；本次文档刷新未跑性能或功能门禁。
