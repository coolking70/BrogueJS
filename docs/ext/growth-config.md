# Growth 数据配置合同（2c，schema 1 / rules 1.5.0）

本文件记录 growth 数据包的实际字段合同。配置是有限、可校验的 JSON，不是脚本；数值是可调整的默认样例，不承诺平衡。1a0、1a、1a1 已验收；1b 启用 P01 纯求值、属性/训练/分配/洗点和原物品永久收益控制。1d 已接技能动作/效果消费/客观时钟；1e 接通身份选择/授予/誓约、怪物模板与盟友自动分配。§1.1–1.6 保留逐步交付历史，2c 新增可选能力见 §1.7。

## 1. 实际文件与边界

| 文件 | 责任 |
|---|---|
| `src/ext/modules/growth/index.ts` | 生产 growth 工厂校验真实目录并创建 1e 运行器；保留显式合同探针工厂供底座测试 |
| `src/ext/modules/growth/module.ts`、`state.ts` | XP 事实队列/安全点结算、角色创建、收据/来源摘要与跨组件/世界校验 |
| `src/ext/modules/growth/identities.ts`、`templates.ts` | 纯身份/选择/赠技/誓约与出生模板、确定性盟友分配 |
| `src/ext/modules/growth/experience.ts`、`components.ts` | 精确整数等级/发点/自动 HP、资源提交基础、严格组件校验 |
| `src/ext/modules/growth/types.ts` | 配置类型、判别联合、有限规则端口/动作词汇 |
| `src/ext/modules/growth/view.ts` | 纯玩家显示投影、配置条目/前置/槽位、分配/洗点/技能预览与严格命令 DTO；不在显示层执行规则 |
| `src/ext/modules/growth/schema.ts` | `getGrowthSchema()`结构合同及两阶段纯校验、引用/预算/循环/版本检查；schema显式请求时才构造并冻结缓存 |
| `src/ext/modules/growth/definitions.json` | 默认样例配置和12技能/4职业/4血统/4信仰定义 |
| `src/ext/modules/growth/definitions.ts` | `parseGrowthDefinitionPack`验证后深拷贝/深冻结；默认加载器和惰性数据指纹 |
| `src/ext/modules/growth/text.ts` | 样例定义与校验错误的本地化词条 |
| `src/ext/registry.ts`、`src/ext/types.ts` | 模块数据合同与阶段0精确版本校验衔接 |

不复用阶段0 `src/ext/definitions.ts` 的示例三属性/简单effects冒充正式成长schema。旧 example 包与测试保持原合同；growth包通过数据校验不等于引擎支持其中所有动作。默认扩展集合为 `growth`；`example` 仍可显式选择，保留原合同。`createGrowthContractModule()` 是显式测试探针；生产目录注册 `createGrowthModule()`。1e 当时的门禁见 [1e 报告](phase1e.report.md)；当前验收政策以 [扩展 README](README.md) 为准。下列1a–1e段落保留阶段历史，2c 新增可选能力见 §1.7。


### 1.1 已验收 1a 的历史运行状态（1b 新增接线见 §1.3）

| 配置/能力 | 当前状态与精确语义 | 后续边界 |
|---|---|---|
| experience 全部来源开关/报价/深度范围/总额上限/盟友比例 | 已接线。出生固定报价，不按变形/当前 HP/深度重算；行政/无归属/不合资格死亡为零；所有 XP 在最终模拟安全点提交 | 剧情表默认空，受信模块可调用配置定义奖励；没有玩家加经验命令 |
| levels.cap / table 或 curve / 点数计划 / maxHp 计划和上限 | 已接线。累计表 index=L−1；曲线离开 L 的费用 base+linear×L+quadratic×L²；L1 发点也读计划，跳级按累计差额发放；满级 XP 钳在阈值 | 无加点/学习消费命令，未分配池保持配置应有总额 |
| recovery.levelHp / levelFocus / clearCooldownOnLevel | 已接线；none 保留当前量并钳上限，increase 只补容量增量，full 回满；死亡者不会被回复复活；截止时刻清零仅在开关为 true 时 | 1a 专注容量固定为 focus.base，因此 levelFocus=increase 暂无容量增量；属性影响归 1b |
| recovery.creationHp | 仅中性 create-character 的玩家创建提交使用；NPC/克隆保留原当前 HP，缩小上限时钳制，不使用创建满血策略 | 1e 身份创建仍走同一原子边界 |
| focus.base / min / cap，focus/current/remainder，skills/readyAt | 已有资源/冷却状态及严格校验，最大专注不重复存储；min/cap 限制容量，当前专注最低 0 | 自动恢复、客观时钟推进、冷却扣费、装配/效果归 1d；recoveryAmount/Interval 等尚不推进玩法 |
| recovery.allocation* / clearCooldownOnAllocation | 纯资源提交 helper 可表达且有测试；无公开分配命令 | 1b 实际分配接入 |
| 首访事实/资源收据 P04 | 首访账本独立于 XP 开关；受限 resource helper 使用 effectId+actorId+depth 收据，focus 钳 [0,capacity]，存活 HP 钳 [1,maxHp]，不从 getter 消费 | 1e 才调用身份首访效果；1a 没有赠予信仰资源，也不允许资源效果绕过死亡管线 |
| monsters.alliesGrow | 已在 XP 兑付中决定盟友自己的份额是否可成长；关闭时不把该份额额外转给玩家 | 自动分点策略归 1e |
| monsters.enabled / templates / depthTemplates / clone 配置 | 仍是已校验的 1e 合同；1a 给普通生物中性组件；实际克隆/分裂/幻影来源已区分，默认新体中性且不复制未分配点 | 可配置模板、继承构筑/经验/奖励开关归 1e，不能把当前中性行为当模板已启用 |
| attributes、rules 端口/效果、物品换算、技能/身份 | 有严格数据合同，1a 不求值、不应用样例效果 | P01 归 1b，P02/P03/P05/P07 完整执行归 1d，P06/身份归 1e |

1a 新增的 birth/reward/来源关系/进度状态随 growth 模块精确升为 `1.1.0`；包形状未变，所以 schema 仍为 1。旧 `growth@1.0.0` 输入拒绝，同版本改包也按 fingerprint 拒绝。任何后续接线令此前未运行字段开始影响状态，同样是规则变化，须再升 moduleVersion/rulesVersion。

### 1.2 1a 事实、收据与原生字段的所有者

- `create-character` 的唯一 1a payload 为 `{revision:0}`；不接受任意 actorId/身份/属性。菜单新局建立后立即通过真实 `executeCommand` 录入，回放按同一条命令重放。半创建局不能行动或持久保存；重复/未知命令在改 UI/模拟状态和录像之前拒绝
- 出生桥记录 creationReason、originalMonsterType、initiallyHostile、sourceId、nativeStatsCopied。最后一项区分真正复制原生属性的克隆/分裂/护甲幻影，与仅有召唤者来源的新建召唤物。出生提交后固定 `birth:<entityId>` 奖励身份与报价，变形/复活/读档不重置收据
- 来源队伍凭证包括主角 ID、责任者 ID、关系版本；捕获时与结算时必须相同。解盟后再入队也不恢复旧凭证。仍被毒/火/位移/死亡事实引用的离场来源只留必要摘要；主体组件按机械实体图回收，观察历史不保活
- 真正种类知识由 ItemLoader 的种类提交/推断路径发 `itemKnowledgeChanged`，安全点读取已知集合并以种类 ID 收据去重。初始已知种类在创建时记为基线；探测、拾取、实例附魔揭示不冒充新种类
- 自动最大生命用 `appliedMaxHp` 差额更新原生 maxHp；没有第二套当前 HP。复制体先减去真正复制的旧自动加值再应用自身中性值；变形/召唤形态恢复的原生 maxHp 重置后补回现有自动加值。此为 1a 必要一致性桥，不是 1b 通用属性求值器
- 受信 `context.grantReward({recipientId,rewardId,instanceId})` 只引用配置中的剧情定义，金额/原因由定义决定；收据键含发出模块、定义、实例。默认没有实际剧情内容，也不开放玩家自报金额/原因
- 模块/组件/来源引用/机械世界共同校验，在退休旧局前拒绝错误；onLoad 不发点、不补经验、不重新应用差额。完整每命令 checkpoint 保持，未改变黄金 trace/生成基线

### 1.3 1b 的实际运行状态

- `evaluator.ts` 实现 P01：属性目录及有限条件只读求值，共享加法预算、唯一乘法槽、全局范围与最终舍入。实际近战/投掷命中和一次物伤、潜行、手动/自动搜索已接引擎；命中详情使用同一纯公式，经典原 solver/随机路径不变
- `attributes.ts` 与 `growth:attributes` 保存实际属性、已付费增量、不可退还损失/费用和可选克隆继承点数来源；初值/费用/单项/合计/力量训练上限均读配置。`allocate` payload 精确为 `{revision,attributes:{属性ID:增量}}`；`respec` 为 `{revision}`，都只处理当前玩家、0 tick、0 RNG。技能学习不接受在此步 payload 中混入
- 洗点只退款已付费属性，保留配置初值/继承构筑；退款向下取整，不可退部分及属性/技能点费用记账。gold/focus 由真实资源支付，费用不足/过期 revision/原目标选择或强制行动未完成时整体拒绝。洗点不额外治疗或恢复专注，降最大生命只钳制当前 HP；冷却是否清空由 respec 配置决定
- 派生生命/力量在合法提交点应用新旧差额；物品原生永久增益仍是基础数值，不计入 applied 派生加值。load 校验后只重绑，不重复叠加/治疗；变形、突变、强化、还原和复活先按原生基值执行，再加回一次构筑加值
- 克隆的 inheritBuild 指属性/训练构筑，不继承来源等级、XP、奖励收据或物品使用额度。默认 level1、无未分配点、无奖且不成长，原 1a 等级/自动生命断言不变；若配置显式开放 inheritUnspentPoints/progression，分别记录来源余额并只为克隆后续新等级发点。nativeStatsCopied 的护甲幻影与分裂同样受复制体规则约束；普通召唤不是复制体
- 专注容量/恢复间隔、冷却时长与比例下限已有纯端口；专注客观时间推进、技能冷却启动、临时效果消费仍属 1d，不把数值求值写成已执行技能
- `growth:items` 保存每个原物品规则实际永久输出累计；见 §5.5。组件合同/行为变化将 moduleVersion/rulesVersion 同升为 1.2.0，schema 形状仍是1；旧1.1.0扩展存档/录像精确拒绝，无迁移

### 1.4 1c 的只读界面边界

- 成长模块通过只读 view descriptor 发布当前工厂实际使用的定义包、created/revision/playerId 和当前玩家的 progression/attributes/derived/focus/skills；运行器按字段分离复制并冻结，不轮询整局存档、奖励账本、因果表或 NPC 组件
- UI 只从统一读模型取得属性/费用/上限、技能/前置/槽位、身份目录及当前经验；自定义合法包增删条目不需要改 Vue 列表或 ID 分支。技能和身份仍为明确标记尚未启用的目录，1c 不增加学习/施技/身份选择命令
- 分配草稿保存会话身份和 revision；读档、seek、重开局使旧会话草稿失效。提交前重读当前模型，实际修改仍只经过原 executeCommand 的 allocate/respec。只读显示不升规则版本，growth 精确版本仍为1.2.0
- 资源预览复用既有纯属性/恢复计算；上下文规则显示使用明示参考输入，不读取未知敌人或冒充当前战斗的最终伤害。攻方/守方端口参考不可顺序相乘当作完整物伤，实际战斗仍用共享预算/乘法槽一次联合求值
- 普通/沉浸 HUD 与角色页都是显示状态；回放只读，取消/重置不发命令。自动命令/录像帧在角色页打开期间由 UI 暂停推进，不改变模拟时钟或录像状态


### 1.5 1d 时的实际状态（历史）

- P02：动作起点/结果的 self/target 临时效果、施加时快照、绝对截止时刻、逐物理结算消费、已提交行动中断均执行。P03 的 duration/intensity/cooldown 按标签有限求值可供已装被动引用；1e 身份引用尚未激活
- P05：内部 actorId 请求对应原攻击/普通相邻位移/等待/手动搜索；当前原生动作适配器执行玩家路径。取消、拒绝、过期目标不支付；合法 miss 支付。已提交后被原生抓持/蛛网/呕吐中断的位移尝试仍按原生尝试支付耗时，但 moved=false，不应用移动结果效果。NPC 主动施放/AI 选择按维护者确认后延，共用被动/临时效果与真实战斗/时间/消费/存读回放已接线，未来接口见 architecture §14
- P07：learn-skill、equip-skills、use-skill 均走扩展命令边界；前置 AND、全局/单项锁定取较宽松者、学习费用和两种槽数读配置。装配提交整个 active/passive ID 数组，保留顺序，拒绝重复/错类别/未学/超槽位；不是录“第几个槽”
- 专注容量、恢复量/间隔、原100 tick 到配置客观块的折算余数、满值余数策略、每技能 readyAt 均执行。默认换槽保留专注/CD；equipPreservesFocus=false 明确定义为重置至新容量，再按 resetRemainderWhenFull 处理满值余数；equipPreservesCooldowns=false 清现有 readyAt。改变恢复间隔只在提交点规范化已有恢复信用，读取不能反复兑付
- 数据生成说明在 describe.ts，按效果类别/端口/幅度来源/数值/上下限/条件/时长/消费/中断及前置生成本地化文本。属性与技能增删、数值修改立即反映；没有按技能/属性 ID 的描述分支。说明不执行效果，不读隐藏敌人、不取 RNG
- 数据 schema 形状仍为1，moduleVersion/rulesVersion 同升1.3.0；skill effect 触发合同补强：被动只允许 modifier/tagged-modifier，主动只允许 timed。原来结构上允许但没有触发时点的被动 timed/resource 或主动裸 modifier/resource 现拒绝，不再把它们默默加载为不生效内容。身份 resource first-visit 仍是1e合同

实际代码：skills.ts（学习/装配/实例/标签/时钟数学）、module.ts（命令与提交钩子）、state.ts（跨组件一致性）、runtime/types（受限动作与只读事实）、Game/Combat/TimeCoordinator（原生边界）。skills:{readyAt} 保留原基础合同；新增 skill-build 保存 learned/inherited/active/passive/effects。inherited 只表示克隆配置允许复制的已学知识，不重复扣费；不继承临时效果或旧冷却。状态新增 objectiveClock、objectiveRemainder、nextEffectId、nextActionId，均持久保存；UI只额外投影显示冷却所需的 objectiveClock 与当前玩家 skill-build，不暴露时钟内部余数、序号或全体生物账本。

### 1.6 1e 交付状态与配置入口

所有运行数值仍由 `definitions.json` 提供；没有身份/模板 ID 特判、任意脚本或新随机流。默认 4 职业 / 4 血统 / 4 信仰全部可选，普通怪物默认仍是中性 L1 模板，`depthTemplates: []` 不主动提升原怪物难度。

| 配置入口 | 现在执行的语义 |
|---|---|
| `identities.enabled` / `defaults` | 开局卡片维度开关与可撤销预选；禁用维度只能提交 null。经典菜单不创建成长数据工厂 |
| `identities.budgets` / `giftLimits` | 固定属性及选择按属性 `pointCost` 计费；每组选择必须精确用完 points，单属性增量限 perAttributeCap；合并身份后再检查总属性上限及唯一赠技数量 |
| 身份 `attributes` / `choices` / `gifts` | 玩家在 create-character 一次授予；NPC完整模板按下文出生一次。赠技不扣技能点，waivePrerequisites 仅本次授予豁免；按可用主动/被动槽装配，溢出槽位的知识仍已学但不生效 |
| 身份 `effects` / `oaths[].effects` | 常驻 modifier、tagged-modifier、first-visit resource 执行；誓约收益/代价都走同一有限求值器。身份没有原动作触发，裸 timed 明确拒绝 |
| `skills.lockMode` / 单技能 lock | none / soft 都不禁止学习；双方都 hard 才执行身份名单锁定。普通前置始终检查；职业推荐不降低价格 |
| `monsters.enabled` | false 不创建 NPC progression/attributes/identity/derived/focus 等成长状态，不授模板/XP。仍保留出生奖励账本与临时受技容器，敌方可被牵制，击杀奖励与来源归属不因此消失 |
| `monsters.templates` / `defaultTemplateId` / `depthTemplates` | 首次真实出生选择最高 priority 的匹配深度模板，未匹配用默认。相同优先级重叠拒绝；重访、变形、复活、读档不重新选择 |
| `monsters.alliesGrow` + 身份 recommendations | 有职业盟友升级后自动分配；无职业保留余额。属性按公开推荐序列、已分配秩最低者优先循环，达到上限/禁用/不足费用时跳过；无推荐则用属性配置顺序。技能先推荐、再定义顺序，检查费用/前置/锁/空槽；不自动替换已装槽、不运行 NPC 主动技能 AI |
| `monsters.clone` | inheritBuild 复制属性/身份/已学与槽位，不复制效果、冷却、等级或 XP；inheritUnspentPoints 独立决定余额。新体 L1/XP0；progression 控制未来收益，rewards 还要同时通过创建原因与敌对资格规则 |

#### 创建、组件与保存格式

菜单先完成职业 → 血统 → 信仰 → 汇总，取消/返回仅丢弃草稿；选择本身不改变当前局、时间、双 RNG 或录像。开始时 `Game.startNewGame({initialCommands})` 先让各模块纯校验完整初始命令批次，再退休旧局，建立原世界与录制起点，最后同步执行真实 `create-character`。首条录像 payload 精确为 `{revision:0, professionId, lineageId, faithId, choices:[{identityId,choiceIndex,attributes:{属性ID:增量}}]}`；未知键/伪造 actor/超预算/缺失选择全部拒绝。现有精确 `{revision:0}` 程序化中性创建合同保留；正式菜单始终发送显式身份选项。

`growth:identity` 保存 professionId、lineageId、faithId、choices、templateId。`growth:skill-build` 新增 gifted，明确区分身份赠技、模板/克隆 inherited 和付费 learned；学习费用只计非 gifted/non-inherited 条目。模板记录完整出生构筑：`attributes` 已包含身份预算，不再叠加身份固定赠点；`skills` 包含实际赠予/学习的全部技能，槽位必须是其中同模式子集。模板明确的 unspentAttributePoints/unspentSkillPoints 是出生余额；以后只发模板出生等级之后的增量，不能重复领取出生前等级点数。

玩家初始余额仍来自等级表 L1 的 attributePoints/skillPoints 计划，与1d完全一致；身份固定属性/选择点及 gifted 是额外免费构筑，不抵扣、不替代这两类余额。程序化中性创建和正式身份创建都使用同一 initialGrowthProgression。NPC 则不再隐式读取等级表 L1 计划：即使该计划改成20属性点/4技能点，默认中性模板的两项出生余额仍为显式0。要让 NPC 获得同样余额，必须在模板 unspentAttributePoints/unspentSkillPoints 分别写20/4，并通过等级/身份预算校验；等级表仍约束模板合法总预算及出生后跨级授予。

迁移注意：这是1e启用既有模板合同后的明确语义变化。调整等级表不等于调整 NPC 出生余额，应同步检查每个模板；原1d测试夹具隐式使用L1赠点的场景已按维护者批准补入等值模板余额。1.3.0旧档/录像直接拒绝，不自动补余额或迁移。

免费初值/身份选择/模板基值与 paid allocated 分开保存，洗点只退已购买增量，不移除身份赠予。模板/身份效果进入同一纯端口与派生差额提交；clone 先扣复制来的原成长最大生命，再加自身派生值一次。关闭 NPC 成长时仍去掉原生复制字段携带的来源成长加值。

盟友升级按“等级恢复 → 自动属性分配恢复 → 槽位保留/重置政策”依次计算，只提交最终差额；没有跨级的新 XP 不抢先消费模板出生余额，封顶零收益不改构筑。自动分配不伪造玩家录像输入或额外原行动，技能 AI 仍留阶段 3。

首访进入事实携带实际当前层参与者，避免给缓存层生物隔空发资源；resource 收据为 effectId:actorId:depth，与 XP 开关独立。默认寻路誓约 D2–D26 专注 +1、容量 −1；同深度重访、load/seek 不重赠，钳制吸收的奖励也记收据。死者不会被资源效果复活。

只读投影另有严格公开合同：identity 只给玩家已确认的 `professionId`、`lineageId`、`faithId`、`choices`；每项 choices 只有 `identityId`、`choiceIndex`、`attributes`，用于将公开分配结果关联到配置选择组、展示身世和复算分配/洗点基值。模板出处 `templateId`、内部赠技 `gifted`、资源/奖励收据均不投影；草稿和已确认模型分离。

技能公开 DTO 保留 learned/inherited/active/passive/effects，effects 仅含 expiresAt/tags/modifiers/taggedModifiers：所有施放者属性/等级幅度已用当时不可变来源值计算为常量，条件仍留给同一纯求值器。无来源 actorId/属性快照、身份来源 ID、实例分配序号或内部消费计数；由此 NPC 身份不能通过被施加效果的元数据旁路泄漏。公开数值作用与原始持久效果逐条件对等，查询不耗 RNG 或改状态。完整定义包是公开可选内容目录，不是当前 NPC 身份图。

此步数据 schema 形状仍是 1，growth moduleVersion/rulesVersion 同升 1.4.0；身份组件、gifted、临时效果的身份来源与首访参与者改变扩展存档/录像合同，因此旧 1.3.0 输入精确拒绝，不做迁移。经典格式无变化。配置包指纹继续精确绑定；改 ID 或数值需同步版本与引用，但无需修改解释器/UI。

默认选择器只做有界、无 RNG 的预选搜索；极端可配置加权选择若不能在有限 UI 工作预算中找到分配，保留未完成草稿供手动选择，开始按钮禁用。这是预览计算限制，不是玩法点数上限；正式命令可验证任何合法完整分配。

### 1.7 2c 可选剧情奖励与公开玩家查询

数据 schema 仍为 1；可选能力接线改变规则语义，因此 growth moduleVersion/rulesVersion 同升 `1.5.0`，descriptor 要求 foundation 3。旧 `1.4.0` 存档/录像按精确 manifest 拒绝，不自动迁移。现有 `story` 配置形状不变，默认仍关闭且 rewards 为空。

- `growth.story-reward.v1` 接受底座生成的 issuerId、rewardId、instanceId 与固定 `recipient: 'player'`。调用者不能传经验数额或本地化理由；growth 自己从 `config.experience.story.rewards` 取 amount/reasonKey
- story 关闭返回 `skipped/disabled`；开启但没有对应报价返回 `skipped/unsupported-key`。两者不创建 growth 收据或经验。模块缺席由底座返回 `skipped/absent`，由剧情模块处理自己的 skip 收据
- prepare 只读取深冻结的自身状态、玩家组件、玩家公开事实及原生资源；完整计算经验、等级、派生值、回复/冷却及整数上限。ready 表示可提交，不表示已经发奖；准备阶段没有世界写入、消息或 RNG
- commit 在底座受控事务内复核准备结果，直接提交成长组件、原生资源与 `issuerId:rewardId:instanceId` 收据。可选奖励不进入旧 pending 队列，不等待下一条命令；重复收据保持幂等，包括零经验和已封顶的有效报价
- `growth.public-character.v1` 只接受 `{v:1}`，只返回玩家 level/professionId/lineageId/faithId 四项。没有身份时为 null；不接受 actorId，不暴露 NPC、模板、身份选择细节或内部收据。错误输入版本由底座返回 unavailable/unsupported-input，缺席为 unavailable/absent；创建角色前查询属于非法生命周期，会拒绝而非伪造可用角色
- growth 通过 initializationReady 区分创建前后；底座先完成所有模块初始化，再在同一安全边界释放首次剧情事实。旧 kills/firstVisits/identification 与受信 grantReward 路径仍用既有最终结算，只复用同一个纯奖励计算器

新测试 `ext_growth_optional_rewards.test.ts` 同时覆盖 provider 纯预检、整数溢出、默认/未知报价 skip、同命令连发、零值/重复收据，以及发现式安装组合中的真实 narrative 对话、存读、逐条 replay 和 seek；不通过导入 narrative 私有实现建立依赖。

## 2. 固定技术合同与可调数据

固定A：D02确定致死来源、D04有界环境/持续伤害因果、D16经典隔离和窄纯端口、D17嵌套生成事务、D18安全点可达性回收、D19每命令完整checkpoint、D20最后有效状态施加者、D22首世界动作前create-character命令。这些不能靠改JSON关闭。

其余玩法数值/开关是数据：XP来源和报价、盟友分配、等级上限/曲线/逐级发点、自动生命/回复、属性目录与公式、训练力量、洗点及代价、装配槽位/学习限制、专注/冷却、原物品收益上限或折算、身份/誓约、怪物组件与深度模板。更改这些数据仍须通过范围、预算、引用、纯JSON和精确版本校验；不代表允许绕过有限端口写入任意世界字段。

版本负责确定性兼容，不承担旧档迁移。经典输入仍无growth配置/快照键，不能为了让所有包统一加载而给经典局增加模块初始化或策略工作。

## 3. 类型和取值约定

- integer字段须有限且为安全整数；number字段可用有限小数并服从各自范围；NaN、Infinity不合法，整数输入不自动四舍五入
- `null`只在字段明确允许时使用；省略字段与null不是等价默认。数组/对象必须符合schema，未知键、原型键、循环/非JSON值被拒绝
- 稳定ID用于引用/录像；nameKey/descriptionKey用于本地化，不能拿显示名做身份或效果判定
- bp为基点，10000bp=1倍、100bp=1个百分点；负修正与增益经过相同预算/钳制顺序
- “默认样例”指仓库 `definitions.json` 中实际保存值，不是加载器替缺失字段补值。表里的数组样例可能展示第一个元素；完整默认列表始终以该JSON为准
- 结构校验先于交叉引用/循环前置/预算/版本校验；校验与导入纯同步，不取RNG、不写世界、不运行效果

## 4. 完整字段目录

以下目录按实际 `getGrowthSchema()` 生成/核对。相同的判别联合叶子按变体列出；`[]`表示数组元素，`{kind=…}`表示判别联合变体。每个字段标出类型/范围、当前样例、校验和运行实现责任；schema本身均由1a0拥有，后续步骤新增或改变字段时必须同步更新本节。

`MAX`为9007199254740991；每个对象的列出键均必填，未知键拒绝。表中`number`允许有限小数，`integer`只允许安全整数。共享类型的每个使用处都继承该节完整结构；所有结构校验归1a0，最后一列是运行时实现责任。样例列从实际JSON取值，重复元素仅展示不同值的前几个，不是新增默认填充机制。

### 4.1 包标识

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a0 |
| `$.schema` | 枚举 `1` | `1` | 1a0 |
| `$.moduleId` | 枚举 `"growth"` | `"growth"` | 1a0 |
| `$.moduleVersion` | 三段非负整数版本，禁止多余前导0 | `"1.5.0"` | 1a0；2c升级 |
| `$.rulesVersion` | 三段非负整数版本，禁止多余前导0 | `"1.5.0"` | 1a0；2c升级 |
| `$.config` | object；全部配置子组必填，见以下各节 | 对象 | 1a–1e |
| `$.definitions` | array；元素为Skill或Identity，完整结构见对应节 | 24项：12技能/4职业/4血统/4信仰 | 1d/1e |

### 4.2 config.experience

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.experience` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.sources` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.sources.kills` | boolean | `true` | 1a |
| `$.config.experience.sources.firstVisits` | boolean | `true` | 1a |
| `$.config.experience.sources.identification` | boolean | `true` | 1a |
| `$.config.experience.sources.story` | boolean | `false` | 1a |
| `$.config.experience.kills` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.kills.base` | 安全整数 [0,MAX] | `6` | 1a |
| `$.config.experience.kills.perThreatRank` | 安全整数 [0,MAX] | `2` | 1a |
| `$.config.experience.kills.threatRank` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.kills.threatRank.min` | 安全整数 [0,MAX] | `1` | 1a |
| `$.config.experience.kills.threatRank.max` | 安全整数 [0,MAX] | `20` | 1a |
| `$.config.experience.kills.eligibleCreationReasons` | array，长度≥0；元素唯一 | 样例长度1；见元素字段 | 1a |
| `$.config.experience.kills.eligibleCreationReasons[]` | 枚举 `"natural"`,`"summoned"`,`"split"`,`"clone"`,`"periodic"`,`"scripted"`,`"test"` | `"natural"` | 1a |
| `$.config.experience.kills.requireInitiallyHostile` | boolean | `true` | 1a |
| `$.config.experience.kills.requireHostileAtDeath` | boolean | `true` | 1a |
| `$.config.experience.kills.monsterQuotes` | array，长度≥0 | 样例长度67；见元素字段 | 1a |
| `$.config.experience.kills.monsterQuotes[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.kills.monsterQuotes[].monsterId` | 外部ID（字母起始；字母/数字/_.:-） | `"rat" / "kobold" / "jackal" / "eel" …` | 1a |
| `$.config.experience.kills.monsterQuotes[].threatRank` | 安全整数 [0,MAX] | `1 / 2 / 5 / 3 …` | 1a |
| `$.config.experience.kills.monsterQuotes[].amount` | 可为null；否则 安全整数 [0,MAX] | `null` | 1a |
| `$.config.experience.firstVisits` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.firstVisits.minDepth` | 安全整数 [1,MAX] | `2` | 1a |
| `$.config.experience.firstVisits.maxDepth` | 安全整数 [1,MAX] | `26` | 1a |
| `$.config.experience.firstVisits.base` | 安全整数 [0,MAX] | `20` | 1a |
| `$.config.experience.firstVisits.perDepth` | 安全整数 [0,MAX] | `5` | 1a |
| `$.config.experience.firstVisits.cap` | 可为null；否则 安全整数 [0,MAX] | `null` | 1a |
| `$.config.experience.identification` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.identification.perKind` | 安全整数 [0,MAX] | `10` | 1a |
| `$.config.experience.identification.totalCap` | 安全整数 [0,MAX] | `300` | 1a |
| `$.config.experience.identification.categories` | array，长度≥0；元素唯一 | 样例长度6；见元素字段 | 1a |
| `$.config.experience.identification.categories[]` | 外部ID（字母起始；字母/数字/_.:-） | `"potion" / "scroll" / "wand" / "staff" …` | 1a |
| `$.config.experience.story` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.story.rewards` | array，长度≥0 | `[]` | 1a |
| `$.config.experience.story.rewards[]` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1a |
| `$.config.experience.story.rewards[].id` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1a |
| `$.config.experience.story.rewards[].amount` | 安全整数 [0,MAX] | 样例未选此变体/无元素 | 1a |
| `$.config.experience.story.rewards[].reasonKey` | 本地化键 `ext.growth.*`，且词条必须存在 | 样例未选此变体/无元素 | 1a |
| `$.config.experience.allySplit` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.allySplit.playerBasisPoints` | 安全整数 [0,10000] | `8000` | 1a |
| `$.config.experience.allySplit.remainder` | 枚举 `"credited-actor"` | `"credited-actor"` | 1a |
| `$.config.experience.allySplit.rounding` | 枚举 `"floor"`,`"ceil"`,`"nearest"`,`"truncate"` | `"floor"` | 1a |

### 4.3 config.levels

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.levels` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.levels.cap` | 安全整数 [1,MAX] | `20` | 1a |
| `$.config.levels.experience` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1a |
| `$.config.levels.experience{kind=table}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1a |
| `$.config.levels.experience{kind=table}.kind` | 枚举 `"table"` | 样例未选此变体/无元素 | 1a |
| `$.config.levels.experience{kind=table}.cumulative` | array，长度≥1 | 样例未选此变体/无元素 | 1a |
| `$.config.levels.experience{kind=table}.cumulative[]` | 安全整数 [0,MAX] | 样例未选此变体/无元素 | 1a |
| `$.config.levels.experience{kind=curve}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.levels.experience{kind=curve}.kind` | 枚举 `"curve"` | `"curve"` | 1a |
| `$.config.levels.experience{kind=curve}.base` | 安全整数 [0,MAX] | `40` | 1a |
| `$.config.levels.experience{kind=curve}.linear` | 安全整数 [0,MAX] | `20` | 1a |
| `$.config.levels.experience{kind=curve}.quadratic` | 安全整数 [0,MAX] | `4` | 1a |
| `$.config.levels.attributePoints` | `Schedule`；完整结构见共用类型 | 对象；见子字段 | 1a |
| `$.config.levels.skillPoints` | `Schedule`；完整结构见共用类型 | 对象；见子字段 | 1a |
| `$.config.levels.maxHp` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.levels.maxHp.grants` | `Schedule`；完整结构见共用类型 | 对象；见子字段 | 1a |
| `$.config.levels.maxHp.cap` | 安全整数 [0,MAX] | `10` | 1a |
| `$.config.levels.recovery` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.levels.recovery.levelHp` | 枚举 `"none"`,`"increase"`,`"full"` | `"none"` | 1a |
| `$.config.levels.recovery.allocationHp` | 枚举 `"none"`,`"increase"`,`"full"` | `"none"` | 1a |
| `$.config.levels.recovery.levelFocus` | 枚举 `"none"`,`"increase"`,`"full"` | `"none"` | 1a |
| `$.config.levels.recovery.allocationFocus` | 枚举 `"none"`,`"increase"`,`"full"` | `"none"` | 1a |
| `$.config.levels.recovery.clearCooldownOnLevel` | boolean | `false` | 1a |
| `$.config.levels.recovery.clearCooldownOnAllocation` | boolean | `false` | 1a |
| `$.config.levels.recovery.creationHp` | 枚举 `"native"`,`"full"` | `"full"` | 1a |

### 4.4 config.attributes

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.attributes` | array，长度≥0 | 样例长度5；见元素字段 | 1b |
| `$.config.attributes[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.attributes[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.strength-training" / "growth.attribute.agility" / "growth.attribute.constitution" / "growth.… …` | 1b |
| `$.config.attributes[].nameKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.attribute.strength-training.name" / "ext.growth.attribute.agility.name" / "ext.growth.attribute.co… …` | 1b |
| `$.config.attributes[].descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.attribute.strength-training.description" / "ext.growth.attribute.agility.description" / "ext.growt… …` | 1b |
| `$.config.attributes[].min` | 安全整数 [0,MAX] | `0` | 1b |
| `$.config.attributes[].cap` | 安全整数 [0,MAX] | `4 / 8` | 1b |
| `$.config.attributes[].initial` | 安全整数 [0,MAX] | `0` | 1b |
| `$.config.attributes[].pointCost` | 安全整数 [1,MAX] | `3 / 1` | 1b |
| `$.config.attributes[].effects` | array，长度≥0 | 样例长度1；见元素字段 | 1b |
| `$.config.attributes[].effects[]` | `Modifier`；完整结构见共用类型 | 对象；见子字段 | 1b |

### 4.5 config.attributeTotalCap

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.attributeTotalCap` | 可为null；否则 安全整数 [0,MAX] | `36` | 1b |

### 4.6 config.strengthTraining

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.strengthTraining` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.strengthTraining.enabled` | boolean | `true` | 1b |
| `$.config.strengthTraining.attributeId` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.strength-training"` | 1b |
| `$.config.strengthTraining.pointCost` | 安全整数 [1,MAX] | `3` | 1b |
| `$.config.strengthTraining.cap` | 安全整数 [0,MAX] | `4` | 1b |

### 4.7 config.respec

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.respec` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.respec.enabled` | boolean | `false` | 1b |
| `$.config.respec.cost` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.respec.cost.resource` | 枚举 `"gold"`,`"attribute-points"`,`"skill-points"`,`"focus"` | `"gold"` | 1b |
| `$.config.respec.cost.amount` | 安全整数 [0,MAX] | `0` | 1b |
| `$.config.respec.refundBasisPoints` | 安全整数 [0,10000] | `10000` | 1b |
| `$.config.respec.clearCooldowns` | boolean | `false` | 1b |

### 4.8 config.skills

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.skills` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `$.config.skills.activeSlots` | 安全整数 [0,MAX] | `3` | 1d |
| `$.config.skills.passiveSlots` | 安全整数 [0,MAX] | `3` | 1d |
| `$.config.skills.equipTime` | 枚举 `"native-wait"`,`"none"` | `"native-wait"` | 1d |
| `$.config.skills.lockMode` | 枚举 `"none"`,`"soft"`,`"hard"` | `"soft"` | 1d |
| `$.config.skills.prerequisites` | 枚举 `"all"` | `"all"` | 1d |
| `$.config.skills.equipPreservesCooldowns` | boolean | `true` | 1d |
| `$.config.skills.equipPreservesFocus` | boolean | `true` | 1d |

### 4.9 config.focus

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.focus` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a状态/1b数值/1d时钟 |
| `$.config.focus.base` | 安全整数 [0,MAX] | `8` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.min` | 安全整数 [0,MAX] | `0` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.cap` | 安全整数 [0,MAX] | `13` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.recoveryAmount` | 安全整数 [0,MAX] | `1` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.recoveryInterval` | 安全整数 [1,MAX] | `8` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.objectiveTicksPerBlock` | 安全整数 [1,MAX] | `100` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.resetRemainderWhenFull` | boolean | `true` | 1a状态/1b数值/1d时钟 |

### 4.10 config.rules

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.rules` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.budgets` | array，长度≥1 | 样例长度12；见元素字段 | 1b |
| `$.config.rules.budgets[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.budgets[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.budget.hitchance" / "growth.budget.physical" / "growth.budget.stealthrange" / "growth.budget.searchstr… …` | 1b |
| `$.config.rules.budgets[].min` | 有限实数 [−MAX,MAX] | `-10000 / -2500 / -9007199254740991 / 0 …` | 1b |
| `$.config.rules.budgets[].max` | 有限实数 [−MAX,MAX] | `10000 / 2000 / 9007199254740991 / 40 …` | 1b |
| `$.config.rules.ports` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.ports.hitChance` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.physicalDamage` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.receivedPhysicalDamage` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.stealthRange` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.searchStrength` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.strengthBonus` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.maxHpBonus` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.focusCapacity` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.focusRecoveryInterval` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.cooldownDuration` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.taggedProperties` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.taggedProperties.duration` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.taggedProperties.intensity` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.taggedProperties.cooldown` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.order` | array，长度≥4且≤4；元素唯一 | 样例长度4；见元素字段 | 1b |
| `$.config.rules.order[]` | 枚举 `"add"`,`"multiply"`,`"global-clamp"`,`"round"` | `"add" / "multiply" / "global-clamp" / "round"` | 1b |
| `$.config.rules.hitPrecedence` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.hitPrecedence.guaranteedHit` | 枚举 `"preserve"` | `"preserve"` | 1b |
| `$.config.rules.hitPrecedence.guaranteedMiss` | 枚举 `"preserve"` | `"preserve"` | 1b |
| `$.config.rules.hitPrecedence.guaranteedRoll` | 枚举 `"preserve-roll"` | `"preserve-roll"` | 1b |

### 4.11 config.identities

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.identities` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.enabled` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.enabled.professions` | boolean | `true` | 1e |
| `$.config.identities.enabled.lineages` | boolean | `true` | 1e |
| `$.config.identities.enabled.faiths` | boolean | `true` | 1e |
| `$.config.identities.defaults` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.defaults.professionId` | 稳定ID（小写；`.`/`-`分段） | `"growth.profession.guardian"` | 1e |
| `$.config.identities.defaults.lineageId` | 稳定ID（小写；`.`/`-`分段） | `"growth.lineage.human"` | 1e |
| `$.config.identities.defaults.faithId` | 稳定ID（小写；`.`/`-`分段） | `"growth.faith.unaffiliated"` | 1e |
| `$.config.identities.budgets` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.budgets.profession` | 安全整数 [0,MAX] | `2` | 1e |
| `$.config.identities.budgets.lineage` | 安全整数 [0,MAX] | `1` | 1e |
| `$.config.identities.budgets.faith` | 安全整数 [0,MAX] | `0` | 1e |
| `$.config.identities.giftLimits` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.giftLimits.active` | 安全整数 [0,MAX] | `1` | 1e |
| `$.config.identities.giftLimits.passive` | 安全整数 [0,MAX] | `1` | 1e |
| `$.config.identities.changeFaith` | boolean；当前仅 false，true 明确拒绝（改信未实现） | `false` | 保留字段，不是已启用开关 |

### 4.12 config.itemGrowth

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.itemGrowth` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.itemGrowth.rules` | array，长度≥0 | 样例长度3；见元素字段 | 1b |
| `$.config.itemGrowth.rules[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.itemGrowth.rules[].itemId` | 外部ID（字母起始；字母/数字/_.:-） | `"potion_of_strength" / "potion_of_life" / "scroll_of_enchantment"` | 1b |
| `$.config.itemGrowth.rules[].nativeEffect` | 枚举 `"preserve"`,`"replace"` | `"preserve"` | 1b |
| `$.config.itemGrowth.rules[].destination` | 枚举 `"strengthBonus"`,`"maxHpBonus"`,`"attribute-points"`,`"skill-points"`,`"enchantment"` | `"strengthBonus" / "maxHpBonus" / "enchantment"` | 1b |
| `$.config.itemGrowth.rules[].conversion` | 有限实数 [0,MAX] | `1` | 1b |
| `$.config.itemGrowth.rules[].perItemCap` | 可为null；否则 有限实数 [0,MAX] | `null` | 1b |
| `$.config.itemGrowth.rules[].runCap` | 可为null；否则 有限实数 [0,MAX] | `null` | 1b |

### 4.13 config.monsters

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.monsters` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.monsters.enabled` | boolean | `true` | 1e |
| `$.config.monsters.defaultTemplateId` | 稳定ID（小写；`.`/`-`分段） | `"growth.template.neutral"` | 1e |
| `$.config.monsters.alliesGrow` | boolean | `true` | 1e |
| `$.config.monsters.clone` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.monsters.clone.inheritBuild` | boolean | `true` | 1e |
| `$.config.monsters.clone.inheritUnspentPoints` | boolean | `false` | 1e |
| `$.config.monsters.clone.rewards` | boolean | `false` | 1e |
| `$.config.monsters.clone.progression` | boolean | `false` | 1e |
| `$.config.monsters.templates` | array，长度≥1 | 样例长度1；见元素字段 | 1e |
| `$.config.monsters.templates[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.monsters.templates[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.template.neutral"` | 1e |
| `$.config.monsters.templates[].nameKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.template.neutral.name"` | 1e |
| `$.config.monsters.templates[].descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.template.neutral.description"` | 1e |
| `$.config.monsters.templates[].level` | 安全整数 [1,MAX] | `1` | 1e |
| `$.config.monsters.templates[].experience` | 安全整数 [0,MAX] | `0` | 1e |
| `$.config.monsters.templates[].attributes` | array，长度≥0 | `[]` | 1e |
| `$.config.monsters.templates[].attributes[]` | `AttributeGrant`；完整结构见共用类型 | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.templates[].professionId` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1e |
| `$.config.monsters.templates[].lineageId` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1e |
| `$.config.monsters.templates[].faithId` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1e |
| `$.config.monsters.templates[].skills` | array，长度≥0；元素唯一 | `[]` | 1e |
| `$.config.monsters.templates[].skills[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.templates[].activeSlots` | array，长度≥0；元素唯一 | `[]` | 1e |
| `$.config.monsters.templates[].activeSlots[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.templates[].passiveSlots` | array，长度≥0；元素唯一 | `[]` | 1e |
| `$.config.monsters.templates[].passiveSlots[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.templates[].unspentAttributePoints` | 安全整数 [0,MAX]；NPC出生余额，不隐式叠加等级表L1计划（§1.6） | `0` | 1e |
| `$.config.monsters.templates[].unspentSkillPoints` | 安全整数 [0,MAX]；NPC出生余额，不隐式叠加等级表L1计划（§1.6） | `0` | 1e |
| `$.config.monsters.depthTemplates` | array，长度≥0 | `[]` | 1e |
| `$.config.monsters.depthTemplates[]` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.depthTemplates[].minDepth` | 安全整数 [1,MAX] | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.depthTemplates[].maxDepth` | 安全整数 [1,MAX] | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.depthTemplates[].templateId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.depthTemplates[].priority` | 安全整数 [0,MAX] | 样例未选此变体/无元素 | 1e |

### 4.14 技能定义

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Skill` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.id` | 稳定ID（小写；`.`/`-`分段） | `"growth.skill.steady-hand" / "growth.skill.close-guard" / "growth.skill.careful-step" / "growth.skill.methodic… …` | 1b求值/1d |
| `Skill.nameKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.skill.steady-hand.name" / "ext.growth.skill.close-guard.name" / "ext.growth.skill.careful-step.nam… …` | 1b求值/1d |
| `Skill.descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.skill.steady-hand.description" / "ext.growth.skill.close-guard.description" / "ext.growth.skill.ca… …` | 1b求值/1d |
| `Skill.kind` | 枚举 `"skill"` | `"skill"` | 1b求值/1d |
| `Skill.mode` | 枚举 `"active"`,`"passive"` | `"passive" / "active"` | 1b求值/1d |
| `Skill.tags` | array，长度≥0；元素唯一 | 样例长度1；见元素字段 | 1b求值/1d |
| `Skill.tags[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.tag.steady-hand" / "growth.tag.close-guard" / "growth.tag.careful-step" / "growth.tag.methodical" …` | 1b求值/1d |
| `Skill.cost` | 安全整数 [0,MAX] | `1 / 2` | 1b求值/1d |
| `Skill.prerequisites` | array，长度≥0；元素唯一 | 样例长度1；见元素字段 | 1b求值/1d |
| `Skill.prerequisites[]` | `Prerequisite`；完整结构见共用类型 | 对象；见子字段 | 1b求值/1d |
| `Skill.lock` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.lock.mode` | 枚举 `"none"`,`"soft"`,`"hard"` | `"none"` | 1b求值/1d |
| `Skill.lock.professionIds` | array，长度≥0；元素唯一 | `[]` | 1b求值/1d |
| `Skill.lock.professionIds[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1b求值/1d |
| `Skill.lock.lineageIds` | array，长度≥0；元素唯一 | `[]` | 1b求值/1d |
| `Skill.lock.lineageIds[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1b求值/1d |
| `Skill.lock.faithIds` | array，长度≥0；元素唯一 | `[]` | 1b求值/1d |
| `Skill.lock.faithIds[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1b求值/1d |
| `Skill.focusCost` | 安全整数 [0,MAX] | `0 / 2 / 3` | 1b求值/1d |
| `Skill.cooldown` | 安全整数 [0,MAX] | `0 / 6 / 10 / 8` | 1b求值/1d |
| `Skill.action` | 可为null；否则 `Action` | `null / {"kind":"attack","target":"adjacent-creature","attackKind":"melee","time":"native-attack"} / {"kind":"w… …` | 1b求值/1d |
| `Skill.action{非null}` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=attack}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=attack}.kind` | 枚举 `"attack"` | `"attack"` | 1b求值/1d |
| `Skill.action{非null}{kind=attack}.target` | 枚举 `"adjacent-creature"` | `"adjacent-creature"` | 1b求值/1d |
| `Skill.action{非null}{kind=attack}.attackKind` | 枚举 `"melee"` | `"melee"` | 1b求值/1d |
| `Skill.action{非null}{kind=attack}.time` | 枚举 `"native-attack"` | `"native-attack"` | 1b求值/1d |
| `Skill.action{非null}{kind=move}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=move}.kind` | 枚举 `"move"` | `"move"` | 1b求值/1d |
| `Skill.action{非null}{kind=move}.target` | 枚举 `"adjacent-cell"` | `"adjacent-cell"` | 1b求值/1d |
| `Skill.action{非null}{kind=move}.occupied` | 枚举 `"reject"` | `"reject"` | 1b求值/1d |
| `Skill.action{非null}{kind=move}.time` | 枚举 `"native-move"` | `"native-move"` | 1b求值/1d |
| `Skill.action{非null}{kind=wait}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=wait}.kind` | 枚举 `"wait"` | `"wait"` | 1b求值/1d |
| `Skill.action{非null}{kind=wait}.target` | 枚举 `"self"` | `"self"` | 1b求值/1d |
| `Skill.action{非null}{kind=wait}.time` | 枚举 `"native-wait"` | `"native-wait"` | 1b求值/1d |
| `Skill.action{非null}{kind=search}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=search}.kind` | 枚举 `"search"` | `"search"` | 1b求值/1d |
| `Skill.action{非null}{kind=search}.target` | 枚举 `"self"` | `"self"` | 1b求值/1d |
| `Skill.action{非null}{kind=search}.mode` | 枚举 `"manual"` | `"manual"` | 1b求值/1d |
| `Skill.action{非null}{kind=search}.time` | 枚举 `"native-search"` | `"native-search"` | 1b求值/1d |
| `Skill.effects` | array，长度≥0 | 样例长度1；见元素字段 | 1b求值/1d |
| `Skill.effects[]` | `Effect`；完整结构见共用类型 | 对象；见子字段 | 1b求值/1d |

### 4.15 身份定义

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Identity` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `Identity.id` | 稳定ID（小写；`.`/`-`分段） | `"growth.profession.guardian" / "growth.profession.scout" / "growth.profession.explorer" / "growth.profession.s… …` | 1e |
| `Identity.nameKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.profession.guardian.name" / "ext.growth.profession.scout.name" / "ext.growth.profession.explorer.n… …` | 1e |
| `Identity.descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.profession.guardian.description" / "ext.growth.profession.scout.description" / "ext.growth.profess… …` | 1e |
| `Identity.kind` | 枚举 `"profession"`,`"lineage"`,`"faith"` | `"profession" / "lineage" / "faith"` | 1e |
| `Identity.attributes` | array，长度≥0 | 样例长度1；见元素字段 | 1e |
| `Identity.attributes[]` | `AttributeGrant`；完整结构见共用类型 | 对象；见子字段 | 1e |
| `Identity.choices` | array，长度≥0 | 样例长度1；见元素字段 | 1e |
| `Identity.choices[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `Identity.choices[].attributeIds` | array，长度≥1；元素唯一 | 样例长度4；见元素字段 | 1e |
| `Identity.choices[].attributeIds[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.agility" / "growth.attribute.constitution" / "growth.attribute.will" / "growth.attribute.per…` | 1e |
| `Identity.choices[].points` | 安全整数 [1,MAX] | `1` | 1e |
| `Identity.choices[].perAttributeCap` | 安全整数 [1,MAX] | `1` | 1e |
| `Identity.gifts` | array，长度≥0 | 样例长度2；见元素字段 | 1e |
| `Identity.gifts[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `Identity.gifts[].skillId` | 稳定ID（小写；`.`/`-`分段） | `"growth.skill.close-guard" / "growth.skill.brace" / "growth.skill.careful-step" / "growth.skill.hold-breath" …` | 1b求值/1d |
| `Identity.gifts[].waivePrerequisites` | boolean | `true` | 1e |
| `Identity.effects` | array，长度≥0 | 样例长度1；见元素字段 | 1e |
| `Identity.effects[]` | `Effect`；完整结构见共用类型 | 对象；见子字段 | 1e |
| `Identity.oaths` | array，长度≥0 | 样例长度1；见元素字段 | 1e |
| `Identity.oaths[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `Identity.oaths[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.oath.watch" / "growth.oath.path" / "growth.oath.restraint"` | 1e |
| `Identity.oaths[].descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.oath.watch.description" / "ext.growth.oath.path.description" / "ext.growth.oath.restraint.descript…` | 1e |
| `Identity.oaths[].effects` | array，长度≥0 | 样例长度2；见元素字段 | 1e |
| `Identity.oaths[].effects[]` | `Effect`；完整结构见共用类型 | 对象；见子字段 | 1e |
| `Identity.recommendedAttributes` | array，长度≥0；元素唯一 | 样例长度4；见元素字段 | 1e |
| `Identity.recommendedAttributes[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.constitution" / "growth.attribute.agility" / "growth.attribute.will" / "growth.attribute.per…` | 1e |
| `Identity.recommendedSkills` | array，长度≥0；元素唯一 | 样例长度2；见元素字段 | 1b求值/1d |
| `Identity.recommendedSkills[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.skill.close-guard" / "growth.skill.brace" / "growth.skill.careful-step" / "growth.skill.hold-breath" …` | 1b求值/1d |

### 4.16 共用 Magnitude

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Magnitude` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Magnitude.source` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b；效果提交1d |
| `Magnitude.source{kind=constant}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Magnitude.source{kind=constant}.kind` | 枚举 `"constant"` | `"constant"` | 1b；效果提交1d |
| `Magnitude.source{kind=attribute}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Magnitude.source{kind=attribute}.kind` | 枚举 `"attribute"` | `"attribute"` | 1b；效果提交1d |
| `Magnitude.source{kind=attribute}.attributeId` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.strength-training" / "growth.attribute.agility" / "growth.attribute.constitution" / "growth.… …` | 1b；效果提交1d |
| `Magnitude.source{kind=level}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1b；效果提交1d |
| `Magnitude.source{kind=level}.kind` | 枚举 `"level"` | 样例未选此变体/无元素 | 1b；效果提交1d |
| `Magnitude.coefficient` | 有限实数 [−MAX,MAX] | `1 / 100 / -50 / -1 …` | 1b；效果提交1d |
| `Magnitude.divisor` | 有限实数 (0,MAX] | `1 / 3 / 2 / 4` | 1b；效果提交1d |
| `Magnitude.rounding` | 枚举 `"floor"`,`"ceil"`,`"nearest"`,`"truncate"` | `"floor" / "ceil"` | 1b；效果提交1d |
| `Magnitude.min` | 有限实数 [−MAX,MAX] | `0 / -400 / -2 / 500 …` | 1b；效果提交1d |
| `Magnitude.max` | 有限实数 [−MAX,MAX] | `4 / 800 / 0 / 24 …` | 1b；效果提交1d |

### 4.17 共用 Condition

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Condition` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=attack-kind}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=attack-kind}.kind` | 枚举 `"attack-kind"` | `"attack-kind"` | 1b；效果提交1d |
| `Condition{kind=attack-kind}.values` | array，长度≥1；元素唯一 | 样例长度2；见元素字段 | 1b；效果提交1d |
| `Condition{kind=attack-kind}.values[]` | 枚举 `"melee"`,`"thrown"`,`"bolt"`,`"reprisal"`,`"other"` | `"melee" / "thrown"` | 1b；效果提交1d |
| `Condition{kind=damage-kind}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=damage-kind}.kind` | 枚举 `"damage-kind"` | `"damage-kind"` | 1b；效果提交1d |
| `Condition{kind=damage-kind}.values` | array，长度≥1；元素唯一 | 样例长度1；见元素字段 | 1b；效果提交1d |
| `Condition{kind=damage-kind}.values[]` | 枚举 `"physical"`,`"fire"`,`"poison"`,`"other"` | `"physical"` | 1b；效果提交1d |
| `Condition{kind=role}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=role}.kind` | 枚举 `"role"` | `"role"` | 1b；效果提交1d |
| `Condition{kind=role}.value` | 枚举 `"actor"`,`"target"` | `"actor" / "target"` | 1b；效果提交1d |
| `Condition{kind=search-mode}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=search-mode}.kind` | 枚举 `"search-mode"` | `"search-mode"` | 1b；效果提交1d |
| `Condition{kind=search-mode}.value` | 枚举 `"manual"`,`"automatic"` | `"manual"` | 1b；效果提交1d |
| `Condition{kind=adjacent,probability-roll,hit,positive-hp-damage,direct-damage}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=adjacent,probability-roll,hit,positive-hp-damage,direct-damage}.kind` | 枚举 `"adjacent"`,`"probability-roll"`,`"hit"`,`"positive-hp-damage"`,`"direct-damage"` | `"probability-roll" / "adjacent" / "hit" / "positive-hp-damage" …` | 1b；效果提交1d |
| `Condition{kind=adjacent,probability-roll,hit,positive-hp-damage,direct-damage}.value` | boolean | `true` | 1b；效果提交1d |
| `Condition{kind=tag}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=tag}.kind` | 枚举 `"tag"` | `"tag"` | 1b；效果提交1d |
| `Condition{kind=tag}.tag` | 稳定ID（小写；`.`/`-`分段） | `"growth.tag.survey"` | 1b；效果提交1d |

### 4.18 共用 Effect

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Effect` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Effect{kind=modifier}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `Effect{kind=modifier}.kind` | 枚举 `"modifier"` | `"modifier"` | 1b |
| `Effect{kind=modifier}.port` | 枚举 `"hitChance"`,`"physicalDamage"`,`"receivedPhysicalDamage"`,`"stealthRange"`,`"searchStrength"`,`"strengthBonus"`,`"maxHpBonus"`,`"focusCapacity"`,`"focusRecoveryInterval"`,`"cooldownDuration"` | `"strengthBonus" / "hitChance" / "stealthRange" / "maxHpBonus" …` | 1b |
| `Effect{kind=modifier}.operation` | 枚举 `"add"`,`"multiply"` | `"add"` | 1b |
| `Effect{kind=modifier}.slot` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1b |
| `Effect{kind=modifier}.magnitude` | `Magnitude`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `Effect{kind=modifier}.conditions` | array，长度≥0；元素唯一 | 样例长度4；见元素字段 | 1b |
| `Effect{kind=modifier}.conditions[]` | `Condition`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `Effect{kind=tagged-modifier}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.kind` | 枚举 `"tagged-modifier"` | `"tagged-modifier"` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.tag` | 稳定ID（小写；`.`/`-`分段） | `"growth.tag.brace" / "growth.tag.hold-breath"` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.property` | 枚举 `"duration"`,`"intensity"`,`"cooldown"` | `"duration" / "intensity" / "cooldown"` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.operation` | 枚举 `"add"`,`"multiply"` | `"add"` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.slot` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.magnitude` | `Magnitude`；完整结构见共用类型 | 对象；见子字段 | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.conditions` | array，长度≥0；元素唯一 | `[]` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.conditions[]` | `Condition`；完整结构见共用类型 | 样例未选此变体/无元素 | 1d通用/1e身份 |
| `Effect{kind=timed}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.kind` | 枚举 `"timed"` | `"timed"` | 1d |
| `Effect{kind=timed}.id` | 稳定ID（小写；`.`/`-`分段） | `"growth.effect.measured-strike" / "growth.effect.brace" / "growth.effect.withdraw" / "growth.effect.hold-breat… …` | 1d |
| `Effect{kind=timed}.tags` | array，长度≥0；元素唯一 | 样例长度1；见元素字段 | 1d |
| `Effect{kind=timed}.tags[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.tag.measured-strike" / "growth.tag.brace" / "growth.tag.withdraw" / "growth.tag.hold-breath" …` | 1d |
| `Effect{kind=timed}.recipient` | 枚举 `"self"`,`"target"` | `"self" / "target"` | 1d |
| `Effect{kind=timed}.application` | 枚举 `"action-start"`,`"action-result"` | `"action-start" / "action-result"` | 1d |
| `Effect{kind=timed}.conditions` | array，长度≥0；元素唯一 | 样例长度2；见元素字段 | 1d |
| `Effect{kind=timed}.conditions[]` | `Condition`；完整结构见共用类型 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.duration` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1d |
| `Effect{kind=timed}.duration{kind=action}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.duration{kind=action}.kind` | 枚举 `"action"` | `"action"` | 1d |
| `Effect{kind=timed}.duration{kind=objective-blocks}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.duration{kind=objective-blocks}.kind` | 枚举 `"objective-blocks"` | `"objective-blocks"` | 1d |
| `Effect{kind=timed}.duration{kind=objective-blocks}.blocks` | 安全整数 [1,MAX] | `2 / 1 / 3` | 1d |
| `Effect{kind=timed}.duration{kind=objective-blocks}.cap` | 安全整数 [1,MAX] | `3 / 1 / 4 / 2` | 1d |
| `Effect{kind=timed}.modifiers` | array，长度≥1 | 样例长度2；见元素字段 | 1d |
| `Effect{kind=timed}.modifiers[]` | `Modifier`；完整结构见共用类型 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.consume` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.consume.event` | 枚举 `"none"`,`"positive-direct-physical"`,`"physical-probability-roll"` | `"none" / "positive-direct-physical" / "physical-probability-roll"` | 1d |
| `Effect{kind=timed}.consume.count` | 安全整数 [0,MAX] | `0 / 1` | 1d |
| `Effect{kind=timed}.consume.phase` | 枚举 `"per-resolution-commit"` | `"per-resolution-commit"` | 1d |
| `Effect{kind=timed}.consume.includesShieldAbsorbed` | boolean | `false / true` | 1d |
| `Effect{kind=timed}.interruptions` | array，长度≥0；元素唯一 | 样例长度3；见元素字段 | 1d |
| `Effect{kind=timed}.interruptions[]` | 枚举 `"attack"`,`"projectile"`,`"cast"`,`"move"`,`"search"`,`"wait"` | `"attack" / "projectile" / "cast"` | 1d |
| `Effect{kind=resource}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a提交基础/1e触发 |
| `Effect{kind=resource}.kind` | 枚举 `"resource"` | `"resource"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.id` | 稳定ID（小写；`.`/`-`分段） | `"growth.effect.path-focus"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.resource` | 枚举 `"focus"`,`"hp"` | `"focus"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.amount` | 安全整数 [−MAX,MAX] | `1` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger.kind` | 枚举 `"first-visit"` | `"first-visit"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger.minDepth` | 安全整数 [1,MAX] | `2` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger.maxDepth` | 安全整数 [1,MAX] | `26` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger.receipt` | 枚举 `"depth"` | `"depth"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.clamp` | 枚举 `"resource-bounds"` | `"resource-bounds"` | 1a提交基础/1e触发 |

### 4.19 共用 Modifier

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Modifier` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Modifier.kind` | 枚举 `"modifier"` | `"modifier"` | 1b；效果提交1d |
| `Modifier.port` | 枚举 `"hitChance"`,`"physicalDamage"`,`"receivedPhysicalDamage"`,`"stealthRange"`,`"searchStrength"`,`"strengthBonus"`,`"maxHpBonus"`,`"focusCapacity"`,`"focusRecoveryInterval"`,`"cooldownDuration"` | `"strengthBonus" / "hitChance" / "stealthRange" / "maxHpBonus" …` | 1b；效果提交1d |
| `Modifier.operation` | 枚举 `"add"`,`"multiply"` | `"add"` | 1b；效果提交1d |
| `Modifier.slot` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1b；效果提交1d |
| `Modifier.magnitude` | `Magnitude`；完整结构见共用类型 | 对象；见子字段 | 1b；效果提交1d |
| `Modifier.conditions` | array，长度≥0；元素唯一 | 样例长度4；见元素字段 | 1b；效果提交1d |
| `Modifier.conditions[]` | `Condition`；完整结构见共用类型 | 对象；见子字段 | 1b；效果提交1d |

### 4.20 共用 Prerequisite

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Prerequisite` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1d/1e |
| `Prerequisite{kind=level}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d/1e |
| `Prerequisite{kind=level}.kind` | 枚举 `"level"` | `"level"` | 1d/1e |
| `Prerequisite{kind=level}.min` | 安全整数 [1,MAX] | `4` | 1d/1e |
| `Prerequisite{kind=attribute}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d/1e |
| `Prerequisite{kind=attribute}.kind` | 枚举 `"attribute"` | `"attribute"` | 1d/1e |
| `Prerequisite{kind=attribute}.attributeId` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.agility" / "growth.attribute.constitution" / "growth.attribute.perception" / "growth.attribu…` | 1d/1e |
| `Prerequisite{kind=attribute}.min` | 安全整数 [0,MAX] | `2` | 1d/1e |
| `Prerequisite{kind=skill}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1b求值/1d |
| `Prerequisite{kind=skill}.kind` | 枚举 `"skill"` | 样例未选此变体/无元素 | 1b求值/1d |
| `Prerequisite{kind=skill}.skillId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1b求值/1d |
| `Prerequisite{kind=profession}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=profession}.kind` | 枚举 `"profession"` | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=profession}.professionId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=lineage}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=lineage}.kind` | 枚举 `"lineage"` | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=lineage}.lineageId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=faith}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=faith}.kind` | 枚举 `"faith"` | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=faith}.faithId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1d/1e |

### 4.21 共用 Action

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Action` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}.kind` | 枚举 `"attack"` | `"attack"` | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}.target` | 枚举 `"adjacent-creature"` | `"adjacent-creature"` | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}.attackKind` | 枚举 `"melee"` | `"melee"` | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}.time` | 枚举 `"native-attack"` | `"native-attack"` | 1b求值/1d执行/1e身份 |
| `Action{kind=move}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=move}.kind` | 枚举 `"move"` | `"move"` | 1b求值/1d执行/1e身份 |
| `Action{kind=move}.target` | 枚举 `"adjacent-cell"` | `"adjacent-cell"` | 1b求值/1d执行/1e身份 |
| `Action{kind=move}.occupied` | 枚举 `"reject"` | `"reject"` | 1b求值/1d执行/1e身份 |
| `Action{kind=move}.time` | 枚举 `"native-move"` | `"native-move"` | 1b求值/1d执行/1e身份 |
| `Action{kind=wait}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=wait}.kind` | 枚举 `"wait"` | `"wait"` | 1b求值/1d执行/1e身份 |
| `Action{kind=wait}.target` | 枚举 `"self"` | `"self"` | 1b求值/1d执行/1e身份 |
| `Action{kind=wait}.time` | 枚举 `"native-wait"` | `"native-wait"` | 1b求值/1d执行/1e身份 |
| `Action{kind=search}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=search}.kind` | 枚举 `"search"` | `"search"` | 1b求值/1d执行/1e身份 |
| `Action{kind=search}.target` | 枚举 `"self"` | `"self"` | 1b求值/1d执行/1e身份 |
| `Action{kind=search}.mode` | 枚举 `"manual"` | `"manual"` | 1b求值/1d执行/1e身份 |
| `Action{kind=search}.time` | 枚举 `"native-search"` | `"native-search"` | 1b求值/1d执行/1e身份 |

### 4.22 共用 Schedule

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Schedule` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1a |
| `Schedule{kind=periodic}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `Schedule{kind=periodic}.kind` | 枚举 `"periodic"` | `"periodic"` | 1a |
| `Schedule{kind=periodic}.firstLevel` | 安全整数 [1,MAX] | `2` | 1a |
| `Schedule{kind=periodic}.every` | 安全整数 [1,MAX] | `1 / 2` | 1a |
| `Schedule{kind=periodic}.amount` | 安全整数 [0,MAX] | `1` | 1a |
| `Schedule{kind=table}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1a |
| `Schedule{kind=table}.kind` | 枚举 `"table"` | 样例未选此变体/无元素 | 1a |
| `Schedule{kind=table}.grants` | array，长度≥1 | 样例未选此变体/无元素 | 1a |
| `Schedule{kind=table}.grants[]` | 安全整数 [0,MAX] | 样例未选此变体/无元素 | 1a |

### 4.23 共用 AttributeGrant

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `AttributeGrant` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e；属性预算1b |
| `AttributeGrant.attributeId` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.constitution" / "growth.attribute.agility" / "growth.attribute.perception" / "growth.attribu…` | 1e；属性预算1b |
| `AttributeGrant.amount` | 安全整数 [0,MAX] | `2 / 1` | 1e；属性预算1b |

### 4.24 共用 RulePort

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `RulePort` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `RulePort.additiveMode` | 枚举 `"flat"`,`"base-basis-points"` | `"flat" / "base-basis-points"` | 1b；效果提交1d |
| `RulePort.budgetId` | 稳定ID（小写；`.`/`-`分段） | `"growth.budget.hitchance" / "growth.budget.physical" / "growth.budget.stealthrange" / "growth.budget.searchstr… …` | 1b；效果提交1d |
| `RulePort.multiplierSlots` | array，长度≥0 | 样例长度1；见元素字段 | 1b；效果提交1d |
| `RulePort.multiplierSlots[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `RulePort.multiplierSlots[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.slot.final"` | 1b；效果提交1d |
| `RulePort.multiplierSlots[].min` | 有限实数 [0,MAX] | `0` | 1b；效果提交1d |
| `RulePort.multiplierSlots[].max` | 有限实数 [0,MAX] | `4` | 1b；效果提交1d |
| `RulePort.globalClamp` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `RulePort.globalClamp.min` | 有限实数 [−MAX,MAX] | `500 / 0 / 1 / -9007199254740991` | 1b；效果提交1d |
| `RulePort.globalClamp.max` | 有限实数 [−MAX,MAX] | `9500 / 9007199254740991 / 4 / 34 …` | 1b；效果提交1d |
| `RulePort.rounding` | 枚举 `"floor"`,`"ceil"`,`"nearest"`,`"truncate"` | `"floor" / "ceil"` | 1b；效果提交1d |
| `RulePort.preserveZero` | boolean | `false / true` | 1b；效果提交1d |
| `RulePort.minimumPositive` | 可为null；否则 有限实数 [0,MAX] | `null / 1` | 1b；效果提交1d |
| `RulePort.minimumBaseRatio` | 可为null；否则 有限实数 [0,MAX] | `null / 0.75` | 1b；效果提交1d |

### 4.25 各规则端口的实际样例

| 端口 | 模式/预算 | 乘法槽[min,max] | 全局[min,max]/舍入 | 保零/正值下限/基值比例下限 |
|---|---|---|---|---|
| `hitChance` | flat / `growth.budget.hitchance` | growth.slot.final[0,4] | [500,9500] / floor | false / null / null |
| `physicalDamage` | base-basis-points / `growth.budget.physical` | growth.slot.final[0,4] | [0,9007199254740991] / floor | true / 1 / null |
| `receivedPhysicalDamage` | base-basis-points / `growth.budget.physical` | growth.slot.final[0,4] | [0,9007199254740991] / floor | true / 1 / null |
| `stealthRange` | flat / `growth.budget.stealthrange` | growth.slot.final[0,4] | [1,9007199254740991] / floor | false / null / null |
| `searchStrength` | flat / `growth.budget.searchstrength` | growth.slot.final[0,4] | [0,9007199254740991] / floor | false / null / null |
| `strengthBonus` | flat / `growth.budget.strengthbonus` | growth.slot.final[0,4] | [0,4] / floor | false / null / null |
| `maxHpBonus` | flat / `growth.budget.maxhpbonus` | growth.slot.final[0,4] | [0,34] / floor | false / null / null |
| `focusCapacity` | flat / `growth.budget.focuscapacity` | growth.slot.final[0,4] | [0,13] / floor | false / null / null |
| `focusRecoveryInterval` | flat / `growth.budget.focusrecoveryinterval` | growth.slot.final[0,4] | [1,9007199254740991] / floor | false / null / null |
| `cooldownDuration` | flat / `growth.budget.cooldownduration` | growth.slot.final[0,4] | [0,9007199254740991] / ceil | true / null / 0.75 |
| `taggedProperties.duration` | flat / `growth.budget.tag-duration` | growth.slot.final[0,4] | [1,9007199254740991] / floor | false / null / null |
| `taggedProperties.intensity` | flat / `growth.budget.tag-intensity` | growth.slot.final[0,4] | [-9007199254740991,9007199254740991] / floor | false / null / null |
| `taggedProperties.cooldown` | flat / `growth.budget.tag-cooldown` | growth.slot.final[0,4] | [0,9007199254740991] / floor | false / null / null |

## 5. 求值、效果及动作合同

### 5.1 标量公式与叠加

`GrowthMagnitude`的有界公式为 `clamp(round(source * coefficient / divisor), min, max)`。constant来源值恒为1；attribute来源只读引用属性，level来源只读已验证等级。不支持变量字符串、任意对象路径、代码或第三种随机流。

先按固定顺序汇总加法，受共享预算限制；再按声明顺序应用有名乘法槽，最后global-clamp和round。每端口声明flat或base-basis-points解释、保零、正值下限及基值比例下限。默认`physicalDamage`与`receivedPhysicalDamage`共享`growth.budget.physical`：同一次物理结算收集攻守两向修正，合并预算后只缩放一次，不能把两个端口各自乘一次。必中/必失优先，原100%仍取骰路径必须保留其原随机调用。有限词汇和解释算法归1b；1a0只验证配置结构/引用。

1b明确同一提供者内的乘法槽组合：magnitude表示普通倍率，1为中性值；同槽先求`1 + Σ(倍率 − 1)`，再按该槽[min,max]钳制并只乘一次。例如两个1.5倍贡献合成2倍，不是2.25倍，也不后写覆盖。没有贡献的槽保持中性，不应用其min；多个有贡献的槽按声明顺序各执行一次。跨规则提供者的未设计冲突仍拒绝启用。

物伤双向端口必须声明完全一致的`RulePort`配置（含预算、槽位及顺序、钳制、舍入和各下限）；校验器拒绝不一致配置。出伤只读取actor的physicalDamage修正，承伤只读取target的receivedPhysicalDamage修正，合入同一求值核。命中读取两方各自角色事实；非双向标量端口只读取actor，不因传入target重复计入属性。

整数端口在round后限制到可行整数区间`[ceil(有效下限), floor(globalClamp.max)]`，避免小数边界经舍入越界。有效下限包含globalClamp.min，以及正基值适用的minimumPositive和minimumBaseRatio；舍入不能削弱这些下限。配置中的全局区间及正值下限必须至少允许一个整数；依赖本次基值的比例下限若与全局上限矛盾，纯求值确定性报错。preserveZero优先保留原0；原免疫、必中/必失、仍掷骰的100%命中及隐身早退均优先保留原语义。

原生端口约束在加载时校验：所有`rules.ports`的globalClamp.min不得为负；hitChance上限不得超过10000bp；focusRecoveryInterval下限至少1；stealthRange上限至少2，以容纳原正常潜行下限。特殊/隐身下限1仍保留。taggedProperties.duration/cooldown的globalClamp.min同样不得为负；taggedProperties.intensity允许负值，不受此非负约束。

focusCapacity在同一纯求值器内取`config.focus[min,cap]`与端口globalClamp的交集；策略读值与实际资源容量使用同一结果。加载时拒绝没有可行整数的交集及与该交集矛盾的minimumPositive，不能只在状态提交端另行封顶。

### 5.2 有限条件、临时效果与消费

条件数组为AND，不存在任意布尔表达式脚本。条件读取动作类别、伤害类别、角色位置、相邻、手动/自动搜索、实际概率求值、命中、实际HP伤害、直接伤害或稳定标签事实。

临时效果将应用时点（action-start/action-result）、对象（self/target）、持续（动作期/客观块）、内部modifier、消费事件和中断动作分开。消费只在per-resolution-commit发生，不能在只读求值器/UI查询时扣次数。架势的positive-direct-physical在护盾前判正，盾全吸收仍消费；牵制的physical-probability-roll要求实际普通物理概率求值，原必中短路不消费。同一动作多击之间必须即时可见消费结果。

按标签的duration/intensity/cooldown修正只作用于明确声明的标签目标和属性，不能作为任意对象写入路径。intensity在原magnitude自身舍入/钳制后、所属端口加法预算/全局钳制前应用；duration在声明的duration.cap之前应用；cooldown先修正技能的基础冷却，再进入通用属性冷却求值/比例下限。否则架势固定−2000bp的magnitude范围会错误吞掉守望誓约的额外−500bp。first-visit资源效果独立于XP开关，带稳定效果`id`、`trigger.receipt:depth`、深度边界及`resource-bounds`钳制；以效果ID+深度记录收据，增减资源均限于合法最小/最大值。实现归属/24项覆盖见[表达审计](growth-expression-audit.md)。

### 5.3 受控动作

只允许attack、move、wait、search。攻击仅相邻普通近战；移动仅合法相邻格且被占格拒绝；等待/搜索以self为目标、搜索限manual。耗时引用native-attack/native-move/native-wait/native-search，不能由JSON绕过原时间、危险确认、终局/麻痹/模态等资格守卫。运行器归1d；玩家命令不能提交任意actorId或嵌套公开executeCommand来伪造一次动作。

### 5.4 纯端口与提交事实DTO（1b纯规则与1d动作/消费）

`types.ts`同时提供以下只读输入/输出合同；不是额外JSON配置字段，不含活Game/Creature、回调、UI或RNG权限。

| 类型 | 实际字段/变体 | 责任 |
|---|---|---|
| `GrowthRuleActor` | id、level、attributes只读ID→数值表 | 1b构造经验证视图 |
| `GrowthRuleInput` | actor、nullable target、baseValue、actionId、resolutionId、tags | 1b纯求值上下文 |
| `GrowthHitInput` | 基础字段+attackKind(melee/thrown)、adjacent、rollMode(skip-guaranteed-hit/skip-guaranteed-miss/roll-guaranteed/roll-probability) | 1b保留原必中/必失/RNG优先 |
| `GrowthDamageInput` | 基础字段+attackKind、damageKind=physical、direct、immune | 1b物伤统一预算槽 |
| `GrowthStealthInput` / `GrowthSearchInput` | 前者加nativeMinimum/invisible，后者加mode(manual/automatic) | 1b保留原隐身/最低距离/搜索语义 |
| `GrowthCooldownInput` | 基础字段+skillId/baseCooldown | 1b求值，1d状态提交 |
| `GrowthRulePolicies` | 10个方法名与config.rules.ports相同；每次返回有限同步number | 1b；不得消费效果或写状态 |
| `GrowthActionResult` | 1a0设计DTO：actionId、resolutionId、actorId、nullable targetId、kind、committed、hit、hpLost、positiveDirectPhysicalBeforeShield、probabilityRollCommitted | 类型草图保留；1d实际引擎事实见下一行 |
| `ControlledActionResult` / `PhysicalResolutionFact`（ext/types.ts） | action/actorId/严格target、moved、resolutions/hit/hpLost；逐击resolutionId、attacker/defender、attackKind、result、probabilityRolled、positivePhysicalDamage、hpLost | 真实受控动作/逐击提交；moved只在原生位移完成时记录，不以最终坐标猜测；保证架势与牵制使用不同判定点 |
| `GrowthEffectConsumptionFact` | 1a0设计DTO：effectId、actorId、actionId、resolutionId、event(positive-direct-physical/physical-probability-roll)、consumedCount | 历史类型草图；1d实际由module.ts直接处理PhysicalResolutionFact逐击消费，不另发此DTO，不能等整命令结尾 |

学习限制采用`none < soft < hard`；有效模式是全局`config.skills.lockMode`与每技能`lock.mode`两者较宽松者（min），soft仅建议。只有两者均hard时才按非空身份白名单限制；显式赠技豁免单独校验。默认样例技能mode=none，因此全局soft不会把其变成身份硬锁。前置数组始终按`all`求AND，不随soft推荐模式跳过。

### 5.5 原物品永久收益的唯一换算

`itemGrowth.rules[].nativeEffect=preserve`时，conversion是原永久收益的倍率；默认力量药水/生命药水/强化卷轴均为1，分别保留原+1力量/+10最大生命/+1强化。`replace`时conversion是每次使用的替代授予量，destination指定接收字段/点数。1b已接通这些原生永久收益分支；未配置的物品保持原收益。

- 换算后依次限制每次成功使用的`perItemCap`及本角色、本`itemId`累计永久授予的`runCap`，最终向下取整一次；不保存或跨次累积小数余量。`growth:items.awarded`只登记实际正整数收益，存读档后继续使用同一上限；点数收益同时参与点数来源校验。
- 工厂按实际物品目录的效果能力提供来源元数据，不在扩展求值器内分派样例物品ID。`preserve.destination`必须匹配原生来源；`replace`可改授力量、最大生命或两类点数，但`enchantment`只能由原生强化分支授给已经接受的合法背包目标。无来源、错误保留目标、药水转强化及不安全数值在配置加载时拒绝。
- 上限只约束永久收益。生命药水仍完整治疗并执行原清状态逻辑；力量药水仍执行原虚弱清理。强化幅度统一缩放附魔值、`timesEnchanted`、装备力量要求下降、法杖容量/充能及魔杖充能增长；归零时这些永久字段不增长。解除诅咒、法杖充能计时重置、护符冷却重置、穿甲状态刷新与弹药分组随机数仍按原路径各执行一次，不额外抽取随机数。
- 强化在接受真实合法目标时才授予并记账；取消尝试、拒绝目标、只有待选状态的存档都不提前支付收益。Classic直接走原生数量，不调用物品扩展策略。
- 原生永久字段的完整加法在写入前检查安全整数，并与扩展账本处于同一窄事务。药水在检查、提交成功后才消耗；强化若溢出，目标的永久字段和账本一起回滚，仍保留待选状态。静态可判定的溢出在载入规则时拒绝，其余由实际原生目标的当前数值检查。

纯换算与账本校验在`src/ext/modules/growth/items.ts`，配置来源能力由`index.ts`/`schema.ts`校验；执行桥在`src/ext/runtime.ts`、`src/engine/Core/Game.ts`及`src/engine/Items/ItemUseCoordinator.ts`、`ArcanaEnchantment.ts`、`ItemEffectFormulas.ts`。模块只提交替代目标收益；同目标数量由原生所有者写入一次。

力量训练换算只由其引用属性的strengthBonus modifier幅度定义，避免重复strengthPerPoint字段造成两套答案。冷却最小比例只由`rules.ports.cooldownDuration.minimumBaseRatio`定义，focus中没有第二个floorCooldownRatio。其它maxHp/strength原生所有者及派生差额同步仍沿[阶段1设计](phase1-growth.md)约束，不将永久收益重复加到原字段。

## 6. 跨字段校验与拒绝策略

校验应明确报告路径和本地化原因，不得通过静默截断、未知字段忽略、随机回退或按加载顺序碰运气处理坏包。实际已实现检查由 `definitions.ts` 及1a0负例测试核对；新增语义必须配负例。

实际两阶段校验在`schema.ts`，加载器不偷偷补默认值：

- JSON/形状：有限、无环、无危险原型键；对象完整且无未知键；oneOf恰好匹配一个变体；数组唯一性、ID格式、数值范围、枚举严格检查
- 引用/去重：属性、定义、预算、模板ID唯一；技能/身份/推荐/赠技引用必须存在且kind匹配；命名前置不能重复，skill依赖图无环；临时/资源效果ID唯一
- 效果/叠加：来源属性存在，幅度min≤max且计算不溢出；add必须slot=null，multiply必须引用已声明槽且幅度不负；duration标签要命中客观块临时效果，intensity要命中可修正强度，cooldown要命中主动技能；消费事件/count/护盾旗标匹配；求值order固定且每预算/槽/钳制范围有效
- 等级/预算：累计表长度=cap、L1=0且严格递增；曲线有正费用且满级累计安全；发点表长度=cap或periodic起始级合法，累计授予安全；首访单次报价与未设 cap 时的全深度累计安全（BigInt 精确核对）；属性初值/上限、总属性上限、训练属性与价格/上限一致；focus的min≤base≤cap
- 身份/模板：固定初值、选择容量、身份点数及赠技数量校验；模板等级/XP区间、属性/技能预算、赠技豁免、实际前置/硬锁、已学与装配模式/槽数校验；深度范围min≤max、模板引用存在，同priority的重叠范围拒绝
- 外部目录：传`monsterIds`时必须与报价表精确同集合；传`itemIds`/`categoryIds`时检查物品/鉴定类别引用。显式`createGrowthContractModule`工厂会传实际怪物、物品和支持类别目录；直接调用纯schema校验时若省略这些可选参数，不会凭空查引擎目录
- 版本/文本：schema固定1，moduleVersion匹配调用方版本且rulesVersion与其相等；所有引用的nameKey/descriptionKey/reasonKey须通过hasText。注册/读取模块时再比较规范化包SHA-256指纹，拒绝同版本换包

错误码为`json`、`shape`、`field`、`range`、`duplicate`、`reference`、`cycle`、`version`、`text`、`budget`，映射`ext.growth.error.<code>`并带出错路径。parse成功后返回深拷贝/深冻结数据，不暴露调用方可变别名。

纯schema抛出结构化GrowthValidationError；实际public parse/load及合同工厂的错误message已在生产边界本地化，同时保留key/path/detail/code供诊断和后续UI。技术引用ID可展示，内部英文诊断短语不直接拼给玩家。工厂按真实zh_CN资源目录校验非空词条，不以text.ts的样例词条表作为定义白名单；新增技能/属性只需修改定义JSON及本地化资源，不需改界面或词条登记代码。

纯包校验不替代实际create-character身份组合、目标合法性、资源充足、revision和原子提交检查，后者属于1b/1d/1e；模板配置通过后只在实际出生入口执行，不在显示或 load 时执行。

## 7. 版本升级规则

- `schema`描述包形状；不兼容字段/判别联合变化必须升级schema并更新读取器。不要悄悄接受旧包，再猜缺失字段
- `rulesVersion`描述这组效果语义/数值，当前校验要求它与`moduleVersion`精确相等；任何会改变同输入可观察结果的公式、样例值、技能/身份/模板或默认开关变化都升级它
- `moduleVersion`与注册growth时提供的模块精确版本绑定；schema/规则/数据/状态合同变化要同时升级模块版本，依赖已有阶段0精确manifest检查拒绝旧扩展存档/录像
- 同版本不得换包内容；规范化数据指纹用于发现同版本漂移。改文档错字或不参与规则的说明是否需要升版本，以实际包内容是否改变及指纹检查为准；不能为了绕过检查放宽兼容
- 不做旧存档迁移或自动修档；错误在退休旧局之前拒绝。1a0未默认启用growth，因此不把版本合同测试描述为“已有玩家成长档迁移成功”

### 7.1 修改数据的最小流程

1. 改`definitions.json`中的配置/条目；增删属性/技能时同步修正前置、推荐、赠技、标签和模板引用。空属性目录可合法表达，但需禁用力量训练并令attributeId=null，同时清除相关引用
2. 新显示项/错误内容补本地化键，保持ID稳定。不要将中文描述变为解释器输入，也不要为某个ID加特殊引擎/UI分支
3. 数据或语义改变同步升级JSON的moduleVersion/rulesVersion与`GROWTH_VERSION`；`getGrowthPackIdentity()`按规范键序数据计算指纹，不手填或弱化它。schema形状变化另升schema/读取器
4. 跑对应步骤的校验/负例和完整门禁，记录实际引擎/实体文件及档位；更新本字段目录/样例审计。旧扩展输入应明确拒绝，不能隐式迁移

## 8. 后续步骤维护责任

| 步骤 | 实现和文档维护责任 |
|---|---|
| 1a0 | 所有字段形状/加载校验/版本绑定与24项表达审计；不启用玩法 |
| 1a | XP、报价/收据、等级/点数/自动生命/升级回复；派生同步和focus/cooldown状态提交基础；中性create-character首动作边界 |
| 1b | 统一纯求值和端口、可增删属性/训练/洗点、预算/槽位/钳制/舍入、原物品折算与收益限制 |
| 1c | 通用数据读模型/UI，内容增删不加组件中的ID规则分支；未启用能力不提前显示成可用 |
| 1d | 动作桥、12技能、客观时间、资源消耗、效果持续/结果条件/逐命中消费/中断/回放 |
| 1e | 身份选择/赠予/誓约、怪物模板与盟友自动分配；收齐实际字段、样例和运行限制 |

当前原型门禁按 [README](README.md#当前验收门禁)：正常候选类型/构建/边界/全部ext/完整npm test一次，真实删除副本只跑removal档；不要求CE对齐、ce:fetch、test:full或test:gen。阶段1历史门禁仍见其原报告。此配置文档不代替实际测试结果，不把尚未执行的检查写成通过。
