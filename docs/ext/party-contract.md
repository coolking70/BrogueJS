# 小队合同草案 P0

> 2026-10-08；审计基线 `7ec0ca0964c822c026c0077b5d6f68477923f1c5`。依据[已批准设计](party-multiplayer-design.md)及[P0 任务书](party-p0.task.md)。D-01～D-17 全部按推荐已批准；本文的排序细节、阈值、预算、编码和接口是供 P1 实现的**合同提案**，不冒称既有实现或额外产品批准。当前只交付文档。

## 1 边界与不变量

1. 小队最多 4 名在籍成员，含留守成员。原生盟友不自动成为成员；招募须经显式命令及资格验证。死亡历史可归档，实体 ID 永不复用。首版可控角色只开放单格身体；giants 的 body member 与 party member 完全不同，不能据名称混用调度所有权。
2. `Game.player` 始终指向开局主成员，绝不随焦点临时替换。`primaryActorId` 不变，`leaderActorId` 是可显式移交的带队身份；主成员死亡后可以保留其实体/墓碑，不再作为存活/推进/可见性的判断入口。新规则一律解析 `actorId`，不能用 leader 代替当前执行者。
3. 同一实体只有一个实体所有者、一个所在层、一个计时所有者、一个背包根。成员记录只引用实体，不复制 HP/位置/背包/成长组件。当前层成员与原生怪物枚举须去重；托管成员不再额外运行一次 `Monster.takeTurn`。
4. 人工、托管、自动步进、重放都使用相同的 actor 命令准备与提交实现。外部改变规则状态的入口仍是 `executeCommand` / `executeItemCommand`；窗口作为一次外层执行事务，内部使用引擎授予的 actor scope，**不递归调用**公开 `executeCommand`，不把 NPC 耗时提交给 `playerTurnEnded`。
5. 焦点/镜头/未提交草稿只在 session；控制者、已接受计划、AI 序号、窗口进度、打断记忆和待决选择影响下一步规则，必须持久化。UI 先把焦点解析成显式 actorId，再提交；回放不读 UI 焦点。
6. 单个世界时钟。场外普通成员冻结；不能给每个成员调用一次整局时间推进或环境块。已批准的 world5 居民离线经济是另一种身份的机制，不能同时对同一成员算冻结、饥饿与日粮。

## 2 可类型检查的 DTO 提案

以下为独立 TypeScript 声明草案；字段名不代表已经开放的 SDK。提取本节唯一 `ts` 块到仓库外可用 `tsc --strict --noEmit` 检查。这里的 `LevelRef` 重述当前 dungeon/site 形状供草案使用；P1 应导入届时正式类型及校验器。

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
export interface MemberState {
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
export interface PartyState {
  readonly schema: 1;
  readonly revision: number;
  readonly primaryActorId: ActorId;
  readonly leaderActorId: ActorId;
  readonly members: readonly MemberState[];
  readonly window: WindowState;
  readonly nextDecisionId: number;
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
export type PartyInput = WindowBatch |
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
  readonly input: PartyInput;
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

队列每成员最多 32 步；移动方向限定八方向，不能用 (0,0) 替代 wait。旅行目标必须为同一活动层已知格；长路由存目标并在行动点重规划，不信任客户端提交穿墙路径。物品按 ID 定位，不能靠库存字母跨成员寻址。module intent 必须同时满足已安装模块、声明的 actor 命令白名单及其原有 payload 验证；不能转发任意 Game 方法或保存 JS 闭包。

`MemberState.level` 是实体所有权层的校验索引，不是第二个独立可写层字段；事务中与实体一起发布。原生装备槽是背包物品引用，不能成为第二个根。成员升格保留 ID、当前 HP/状态、关系和战利品；把原 carriedItem 转背包时一次转移，不能克隆。招募先预检 slot/资格/层/身体能力，失败不扣资源、不半附着组件。

## 3 命令与窗口状态机

### 3.1 规划与接受

`planning/interrupted → running → planning/interrupted/awaiting-decision`。终局不接受新窗口。一次输入携带 seq 和 expectedRevision：窗口 seq 严格递增；重复网络包由房主按已接受 ID 返回原收据，不能执行两遍；回放中重复/缺口直接报 OOS。纯 UI 编辑草稿、准备按钮、网络等待不会推进 tick 或 RNG。

接受批次前一次校验权限、所有计划语法/长度和全部静态引用；失败返回错误、世界/双 RNG/录像有效前缀保持。批次中 `replace + null` 清空计划；`keep + null` 保留尾队列，keep 携非空 plan 拒绝。未列出的成员明确视为 keep；房主应为全部当前人工成员发送规范化行。控制权改变后旧控制者草稿无效。

批次接受不保证未来每一步合法。取步时重新验证目标存活、层、物品归属/冷却、占位与风险；失败不跳过后继续执行错误队列，产生 `plan-invalid`，保留失败步供 UI 修订。竞争同格/同物品以调度实际先后决定；不预扣整个窗口资源。

### 3.2 时间与同 tick 边界

- 窗口 tick 起点取引擎单调客观时钟，不能取 logger.turn、帧时钟或网络时间。party-only 局也要有客观时钟端口，不硬依赖启用 settlement/combat/world5 模块。
- 每次时间增量是当前原生最近事件、阶段动作边界、客观环境边界和窗口剩余 tick 的最小值。只允许非负增量；到达 W 立即停止推进。未完成行动保留剩余计时，不为凑整截掉伤害/后摇或补一次等待。
- 沿用原执行阶段的顺序：已提交的当前原生动作先发布；推进时客观块在到期 actor 调度前运行，块末清理与 world rest 发布在同 tick actor 结算后完成。扩展调度现有 actorId 升序保留；新增受控成员进入相应 actor 槽。准备同时就绪的成员按 actorId 升序提交，不能按 UI 焦点/数组插入/网络到达顺序。
- t0 已到期的强制阶段先按现有调度边界结清，再收取该边界尚未领取的成员决策；不得在恢复窗口时重复 native prelude。P1 必须用单成员删除投影验证现有 NPC 与主成员同 tick 顺序，不能用本草案的“升序”改写经典无调度器的怪物列表顺序。
- t=end 的既有到期阶段、客观块和它们已触发的强制效果完成；不再领取新的计划动作。中途打断只在完整原子边界发布，不能退出半个 objective block、transaction 或多格伤害分发。同 tick 已开始的原子结算全部完成后才允许人类输入；未来行动不预先执行。
- 只有一个 countdown owner。成员原生即时移动/攻击各收一次原生耗时；阶段动作计时只由 `actorActions` 写，禁止同时从 Monster 和成员两条路径递减。
- 人工成员无计划默认按自己的移动行动单位 wait；配置 interrupt 则在取步前停。麻痹/沉眠等不能发命令时照原生强制等待/状态恢复，不反复尝试失败命令，也不凭空消耗计划游标。
- **精细档**选择批次中的 `fineActorId`（必须显式记录，不读焦点），最多领取其一个行动，推进到该行动耗时/阶段动作结束；其他成员按各自计划正常参与，其间可打断。若该成员已有跨窗动作，就只等待它结束，不再取新步。安全上限仍为 1000 tick，超出保留续体并以 budget 返回。
- 零耗时控制/改名等不能作为无限计划循环。每个同 tick 决策点最多一次失败或零耗时 intent；重复企图报 `ZERO_TIME_LOOP` 并中断。规范化批次最大 128 个排队 intent；运行期最多 1024 次 actor 决策/段（提案），超限保留已完成前缀并硬停，不强制跳过后续事件。

### 3.3 打断与确认

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

### 3.4 自动档与推进触发

自动档只读全队共享已知威胁/危险地形：有任意威胁或上次打断用 100；连续 3 个无威胁完整窗口后升 1000（3 为提案参数，进入规则配置）。反应配置和 automatic/quietWindows 入摘要。切换手动 W 在下次批次生效，不能改正在运行的上限。

联机全员准备按**人工控制者槽**去重，排除无活动成员的槽；投票是有资格槽严格过半后启动倒计时。倒计时只在产品层运行，结果落成确定的批次（缺席计划 keep/等待或已记录的 AI 转交）。各端不能自行比较墙钟来补步。trigger 保存于事件链作诊断，但同一规范化计划和长度应产生相同机械结果。P1 只需手动/自动档；其他触发由 P2 接线。

## 4 按成员机制

| 机制 | 所有权与处理合同 |
|---|---|
| 背包/装备/使用 | 每成员独立 Inventory/装备与携带上限；包括戒指双槽、符文反应、投掷、鉴定进度。当前 `instanceof Player` 的能力判断改为明确 actor 能力读口；经典旧路径保留。共享知识不等于共享背包。 |
| 交换 | 同层相邻（八邻接且不穿阻隔墙角）且双方存活；物品未被工作/动作预留，接收方有容量。一次交易原子转移 root/装备引用并刷新属性；提案由发起者支付一个移动行动单位，收方不额外扣时。忙碌收方不接收，失败零扣时。 |
| 饥饿 | 每人一份需求账：有原生 nutrition 的成员继续原生阈值/吃食规则，foraging need 用组件适配同一权威值，不能再重复掉饥饿。没有 foraging 也能运作。成员冻结不补扣；转居民后才按 5D 日粮合同。当前 ActorNeeds 排除 player 且只收 Monster，须显式扩接口，不能声称直接复用已完成。 |
| 状态/恢复 | 原生按行动回合发生的恢复与客观 100 tick 发生的状态/营养分别保留所属时钟；每成员 own regenCarry、poisonedDuringTurn、免疫/饥饿提醒。不能把主成员所有回合尾声搬进每次 100 tick 块。受伤来源、搜索蓄力、自动路径、确认目标按 actor 分开。 |
| 知识/视野 | 鉴定知识与探索记忆共享；对每名活动成员独立计算 LOS、黑暗/隐形/心灵感应资格，再合并合法可见信息。焦点切换只投影；不能因焦点不同改变发现/AI/RNG。视野并集不等于把某成员的特殊感官借给另一成员做射击资格。照明多光源需分离 cosmetic 与 substantive。 |
| 敌方 AI/气味 | 敌人可选择任一可感知敌对成员，不能永远追 leader；沿原敌对、混乱、俘虏规则筛选，候选平局采用稳定 ID。气味/安全图需支持多源或按目标缓存；成员身体/能力不同不能共用错误的通行图。 |
| 成长 | growth 组件按 actor；击杀参与记录按攻击/辅助事实归属，结算一次。参与权重、整数余数按稳定 ID 分配，具体权重在 P1d 规则数据中确定；不重复发队长独享奖励。首访/鉴定等原奖励要明确队伍一次事实和受益成员列表。 |
| 死亡/胜利 | 成员死亡取消未执行计划和 owned actions、释放预留、按实体规则处理物品/掉落与死亡事实一次；其他人继续。所有在籍成员（含冻结者）死亡才失败。无活动者但有留守存活者进入恢复选择，激活其层，不能误判失败或让时钟空转。胜利仍需原生护符/出口条件，但检测全队携带与一次队伍确认；结算唯一物品 root，避免四份重复计分。队长死即败仅预留变体，不作为默认。 |
| 换层 | 一个活动层；活动存活成员均在楼梯 Chebyshev 距离 ≤1 且可达，或显式列入留守集合。预检目的地所有落点、busy/确认/预留；失败不移动任何人。转移保持 ID、背包、阶段动作允许保留的恢复部分；遗留 windup 按既有跨层取消规则，不跨层放技能。留守成员保存层所有权/状态/计时并冻结。不能以 depth=0 表示 site。 |
| 坠落/传送 | 同层传送仅该成员变化并打断。强制跨层（坑洞）必须在 P1a 定义为该成员进入目标层、其他成员冻结于原层，切活动层并硬停；属于强制事故例外，不给普通成员自由异步换层。安全落点/掉落伤害仍沿原生路径，不能瞬移整个小队免伤。 |
| 营地/同伴/休息 | 转居民和编入成员是互斥身份事务，解除旧需求/工作/控制关系。原生同伴依然 AI，不计人工准备。篝火休息按 D-11 要求全部在籍存活成员在场（留守者须召回），资格在开始和结算均检查；恢复按各人资源，不用队长装备代表全队。 |

“附近 1 格”、交换费用、冻结者恢复选择和强制坠落政策均是为填补执行歧义的 P0 提案；P1a 任务书应冻结这些数值和边界，不把它们说成 CE 原生多人规格。

## 5 AI v1 与队长指令

`PartyAiV1.decide` 接冻结的已知视图，不接 Game/可写实体/全地图。五档策略沿批准设计：跟随以 leader 的已知位置为目标；进攻选合法可感知敌人；保持距离使用射程与可通行代价；自保只处理近身威胁/恢复；不动仍受原生强制状态时钟影响。自动拾取受容量/已知危险约束；消耗品默认不开启，显式开启后仅用已知用途且符合阈值的物品，未知药水不代饮。

策略只能产一个 ActorIntent；结果走与人工同一验证和提交。选择的抽样用 `DerivedDraw` 类独立派生流，键含 seed、规则指纹、policyId、actorId、aiDecisionOrdinal、purpose。ordinal 每次已接受的决策推进一次（含无路而 wait），失败的 UI 查询/预演不推进主局 ordinal。按 purpose 预分配抽样位，不用 wall-clock、Map 非规范顺序或 `Math.random`。**动作执行中的命中/伤害/原生随机仍使用实质 RNG**；“AI 不消耗原生 RNG”只指新增决策策略，不能把实际战斗随机也换掉。

托管错误/预算超限给出诊断并以确定的 wait 回退，不无限重试；内部一致性错误则锁存并停止本段，不静默吞异常。路径搜索节点预算提案每成员每决策 4096；用固定展开次序、共享只读障碍缓存，跨能力/层/占位 revision 不复用。

队长指令是已记录的零耗时规则命令，目标为明确 ID 列表；集合/攻击/守点/撤退/探索只改托管目标，不额外直接移动。对人工成员不覆盖其计划；需先显式托管。原生盟友经相同指令适配器改变意图，仍由自身 NPC 行动点执行。多格成员指令路由 decision owner，不逐部位发动作。指令冲突以后接受的 command index 为准；失效目标按本档位确定回退/等待。

控制权切换立即记录 pendingController，到该成员下一个空闲决策点生效；已有长动作不中途取消。切换时清理旧提交队列，避免前控制者留下一次隐含攻击；明确想保留时由新控制者在下一批次重新提交。ai-this-window 的临时接管独立于永久 pendingController。

## 6 存档、录像与摘要

### 6.1 单次执行、可验证回放

窗口输入保存 W、所有成员计划、规范化 seq、startTick、revision 与 trigger。实际执行生成 ActorTrace（顺序/actorId/动作/耗时/actionId/确认选择），写在窗口收据；**回放只执行批次一次**，重新生成 trace 与保存的 trace 比较，不把 trace 再当公开命令执行一遍。原有 NPC 自动结果仍由模拟重算，不复制整世界成每步事件。

一次打断结束一个窗口；人工选择分段则同 seq、segment 递增。每段都是可验证事件边界：双 RNG、机械摘要/链、所有成员位置/HP 等诊断均可校验。普通控制/对话选择亦记录为有序输入；会话焦点不记录。段中的 trace 是“成员每一步同样记录”的落实；必须能定位段内 ordinal，不能只存末尾队长位置。

存档只发布完整原子边界，含正在进行的 actions、计划尾部、冻结成员、控制者/待切换者、待决 DTO、AI 序号及打断锁存。重建时重新建立引用/缓存，不序列化闭包、token、网络对象。保存请求可排队到下个安全点；不可在半次同步 resolver 内快照。seek 恢复同一版本快照 + 后续批次，恢复焦点可选第一个存活活动成员，不能改变规则结果。

### 6.2 域归属（每个权威字段恰好一域）

| 域 | 新增归属 / 避免重复 |
|---|---|
| `native` | 所有成员实体的 HP/位置/状态/背包/装备/原生饥饿与 actor 级回合尾声；全队终局与全局时钟；兼容 player 顶层与实体图别名必须一致，按既有别名拆分原则处理 |
| `party`（新增 dirty 域） | roster/控制者/pendingController/leader、已提交计划/游标、窗口/自动档/AI ordinal/反应配置/指令、seenHostileIds/lowHpLatched/决策点锁存、可恢复待决 DTO；即使名称是“已见”，这里是打断状态机而非世界知识 |
| `actorActions` | 跨窗动作相位、decisionOwner/timeChargeOwner、资源预留和计时；party 只引用 actionId，不另存倒计时副本 |
| `extensions` | growth/combat/foraging 等组件和模块规则状态；party 策略参数定义在 manifest，实时控制状态只归 party |
| `world5` | 层/营地/居民经济/工作票据；不能再保存成员背包副本或重复冻结需求 |
| `knowledge` | 全队共享鉴定、探索记忆、原生持久观察；物品知识从每个成员背包及所有别名行拆分，不能只扫 root.player.inventory |
| `random` | 现有双流状态；派生算法身份在规则指纹，AI ordinal 在 party |
| 排除 | focus、草稿、ready/投票/倒计时、连接 ID/RTT、相机、动画、诊断、预演副本、路径/FOV 临时缓存；已有影响下一条命令解释的录制 inputState 必须改为显式 actor 上下文，不能笼统删去 |

新增 Game 字段逐项登记 U03 和 recording-digest-contract；如采用惰性 WeakMap，仍登记持久入口/codec/摘要投影，不能用 WeakMap 藏机械状态。party dirty revision 每次事务发布统一递增；独立 full oracle 每次新投影，不能与缓存实现同源自比。

保持现有 256 命令分块 / 2048 检查点节奏的基线，并为长窗口增加**每段末强制 full digest**作为 P1 起点；事件 dirty 域每段检查。这样可把完整 native/knowledge 的区间缩至两个验证边界之间，但不能保证隐藏错误精确到某个 actor 步。报告仍区分 dirty 域精确事件与 native/knowledge 首个可验证分歧 + `(previousVerifiedBoundary, command]`；网络按窗口末 full digest 比较。性能如超预算须显式修订检查节奏，不能只比较队长摘要冒充全队校验。

### 6.3 版本与零影响的协调

当前源码：whole-run 6、foundation 10、recording 4、origin 2；P1 必须从 **5Z 实际冻结版本 F/S/R/O** 分配后继号，不预占 11 或假定 5D 不升号。party schema/计划 payload 初始 1；netplay protocol 初始 1 独立于规则 codec。

设计同时要求“升 foundation”和“未启用小队的快照字节不变”。当前 `RecordingDigest.codecIdentity` 使用全局 FOUNDATION_PROTOCOL，直接 +1 就违反后一个要求。本文采用**按能力选择有效 codec 身份**的提案：party 局选择新 F/S/R/O 与含 party 的摘要域；classic/无 party 局仍输出 5Z 的旧形状、旧有效版本和旧域顺序，运行时验证按该有效 codec 路由。非 party 模块 descriptor/manifest 必须保留相应有效身份，不能无条件把新全局常量写进所有局。新增事件应进入 party 专用的新录像格式分支，不能声称当前严格的 v4 读取器已能读取本文 DTO。

若 P1 改选全局统一升号，就必须明确修订“字节不变”为排除版本字段的语义等价，不能在验收时偷偷忽略版本/摘要差异。这里不迁移旧格式 party 档；不支持跨版本联机。删除 party 后依然拒绝要求 party 的存档，不能悄悄丢掉其他成员；删除 netplay 不影响同一 party 局本地续玩。

## 7 预演与零影响验收

预演不能简单调用现有 `toSnapshot → 模拟 → loadSnapshot` 后宣称没有副作用：本项目 rng/logger/实体 ID 分配器及模块会话含全局和不可快照状态。使用独立 Worker/隔离引擎容器，复制已知世界的投影、已提交草稿和专用 RNG 副本；不得触发主局日志、存储、输入确认、网络或 recording observer。结果带 baseRevision，主局 revision 改变即丢弃。

首版 `known-world-v1` 只包含成员已知地图/可见实体，未知格不能规划穿越；敌人按展示模型保持当前状态/已知动作，不调用隐蔽真实 AI。预演显示为不确定预测，不能读取完整隐藏世界再透过伤害结果泄露敌人。对两个已知投影相同、隐藏世界不同的存档，预演输出应相同；真实推进仍使用完整权威世界。预演的临时 allocator/RNG/ordinal 不回写主局，不记录输入；实际提交重新验证和执行。

classic、无 party 的全部扩展组合以及物理删除 party 时，要求：

- 对象 own keys/descriptors/关系图不增加 `party: undefined`、成员标记或常驻数组；只在启用并合法开局时惰性创建。
- 同种子同命令与 5Z 基线比较：规则结果、双 RNG 完整状态与计数、生成、日志/确认顺序、存档/录像规范化字节、原有摘要相同。既有 savedAt/recordedAt 用固定时钟捕获再比较，不能靠删除新增字段掩盖差异。
- 焦点往返、开关草稿、看详情、预演、房间准备/取消：主局机械摘要/双 RNG/实体 ID 分配器/有效录像前缀完全不变。投影不能提交识别/发现等机械事实。
- 真实删除 party 目录与资源后，剩余模块类型/构建/测试与组合真实游玩通过；删除 netplay 后单机 4 人保存、seek、续录可用。软件禁用与物理删除分别留证。

## 8 错误与事件发布

上述 PartyError 是引擎稳定码，UI 通过 i18n 显示；不能直接把内部 Error.message 给玩家。静态非法输入、权限、版本、过期 seq/revision 在接受前拒绝，零 RNG/零部分写入。运行期目标失效与超限保留已完成安全前缀、输出中断收据；异常不是事务成功。`INTERNAL_FAILURE` 锁存不可推进状态并使该未完成段不可导出为有效录像；保留诊断及最后验证边界，不吞错假装 wait。

UI/网络可订阅 `window-accepted`、`actor-intent-resolved`、`window-interrupted`、`decision-requested`、`window-finished`、`member-died`、`control-effective`；仅在所属事务安全提交后通知，消费者不能回调改世界。事件携带 seq/segment/ordinal/actorId/tick，规范化事实不含本地化字符串。网络重传不重复发布。P1 对本合同的实现测试与性能方法见[审计报告](party-p0.report.md)。
