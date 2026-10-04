# 阶段 3：独立类魂战斗设计（待审）

> 仅设计，不授权实施。分支 `ext/phase3`，基线 `70a5e1db1959107c5fceca6a91bf5b942ee053cd`（内容扩充已完成），2026-10-04。本文所有新增接口、版本、规则与测试均为提案，未实现、未验收。批准设计也不自动批准任何实现小步。

## 1 范围、依据与现状

目标是可独立启用/删除的 `combat`：攻击预警格、多阶段攻击、体力、闪避、韧性/硬直、弹反、篝火。只硬依赖底座。玩家、敌人、盟友使用同一动作/资源/防御规则；叙事交互对象不是战斗 NPC，不强行赋予生物组件。没有死亡复活、掉魂、升级、商店、联网或复制商业内容的隐含授权。

依据为[当前路线和门禁](README.md)、[扩展架构](architecture.md)、[成长配置](growth-config.md)、[叙事设计](phase2-narrative.md)、[叙事配置](narrative-config.md)、[2d报告](phase2d.report.md)、[2e报告](phase2e.report.md)与[本轮内容报告](content-expansion.report.md)。[Lost Flame 笔记](references/lost-flame-notes.md)只提供读格子、动作耗时、体力等机制启发；不读取/复制其代码、数据、数值、文本或美术。新产品政策覆盖旧 CE 隔离/逐骰/不可修改守卫要求；仍维护有用的功能、所有权、输入和确定性合同。

### 1.1 源码审计结论（不是既有能力声明）

| 现有文件 / 入口 | 已有能力与本阶段缺口 |
|---|---|
| `src/engine/Core/Game.ts`：executeCommand/applyCommandStages、executePreparedExtensionCommandStages、validateControlledAction/executeControlledAction | 输入与录制共享；prepared 接口存在，但受控 attack/move/wait/search 校验限定 playerId；不能直接拿来跑 NPC、多格 AoE 或多阶段动作 |
| `src/engine/Core/TimeCoordinator.ts`：advancementLoop/objectiveTimeBlock | 以玩家/怪物 ticksUntilTurn 和环境门取最小步长；环境在同时间怪物行动前；当前 monster 数组顺序结算，不存在通用动作截止队列。objectiveTime 是100tick块，不能用来粗略扣任意前摇 |
| `src/entities/Monster.ts`：takeTurn/tryMoveTo/几何攻击；`src/engine/Combat/MonsterAI.ts` | NPC 行为与耗时出口散在原生路径；MonsterAI 主要感知/状态，不是唯一攻击调度器，改它一处不能覆盖技能/盟友/几何攻击 |
| `src/engine/Combat/Combat.ts`：CombatSystem.attack/resolveAttackExtended | 原生伤害、命中、来源与逐击 physicalResolved；不是名为 CombatSystem.ts 的文件。新动作须复用/受控扩展这里的权威结算，不在模块直接扣 HP |
| `src/ext/types.ts`、`runtime.ts`、`causality.ts` | 同步可撤销 context、组件、纯规则/可选查询、受控资源、来源与收据；当前奖励回滚写集不等于任意世界事务；storyFact 尚为入层事实且仅一个消费者分配派生范围 |
| `src/ext/world.ts`、`worldSpatial.ts` | 固定可穿行非战斗 WorldInteractable 与 gate/安全放置；没有生物多格占位、战斗碰撞或篝火重生能力 |
| `src/ui/dialogInput.ts`、`dialogService.ts`、`src/components/DialogHost.vue` | 共用对话栈、物理输入所有权与释放屏障；必须复用，无第二套 window 键盘/触控屏障 |
| `src/ext/descriptor.ts`、`catalog.ts`、`src/ext/ui/`、模块 test-suites | 发现式安装/组合/UI/测试已存在；新增 combat 必须保留物理删除能力，不能写硬编码总导入表 |

当前 foundation=3、manifest.schema=1；growth module/rules=1.6.0，narrative=1.3.0，后者 state=3/input=2；原生 save/replay version=2。本文不改任何版本。

### 1.2 阶段 4 的已批准协作基线

维护者最新决定以已批准r3 **8860b47b463663e4581caf24272c6f59ec55f662** 为准，已只读fetch并核对[阶段4设计§11.3/§13](https://github.com/coolking70/BrogueJS/blob/8860b47b463663e4581caf24272c6f59ec55f662/docs/ext/phase4-giants.md)。初审曾依据1242567，随后只读审阅8104e5c r2；它们是审计历史，不再作为当前接口基线。r3的设计批准不等于所有阶段4功能已经实现，也不授权本任务实施阶段3。

r3的`giants`仅拥有内容，底座负责方形/任意刚性mask、pose、固定命中区、独立落点的复合成员、部位破坏/转换与核心调度。本文现按“发起成员足迹＋相对形状”、EffectTargetPolicy和核心唯一耗时所有者设计；不把攻击源、伤害目标和调度所有者混成一个actor。相关接口仍需双方确定落地签名；不会因设计批准就声称TypeScript已存在。

原生entity/whole-run/replay 2→3、foundation3→4是阶段4建议的联合升级窗口，**两边不得各自升级**，合并时由维护者统一分配。阶段4分支早于最新内容扩充，不得整分支覆盖本基线；本轮不改阶段4任何文件。阶段3开发门禁已由同条维护者决定改为相关功能测试，见§12及README阶段3专节。

## 2 独立模块、所有权和生命周期

正式目录提案 `src/ext/modules/combat/`：descriptor/index/module、schema/types、definitions、data/definitions.json、state/validation、纯动作 planner、AI policy、view、ui、locales、tests/test-suites.json。稳定 ID `combat`，首个实现建议 module/rules=1.0.0、data/state/input schema=1、displayVersion=1.0.0；具体版本只在首个实现批准后分配。

- 状态只在 `extensions.modules.combat`，生物组件 `combat:resources` / `combat:action`；录像 manifest 自有 module/rules/fingerprint。不借用 growth state，不复制原生 HP/坐标/等级，不用另一个顶层 save。
- 底座拥有实体 ID、深度/足迹/位置、调度时钟、原生伤害与来源、动作执行器和事务；combat 拥有技能定义、每独立生物/群核心资源、动作阶段与篝火休息收据。调度索引从持久动作重建，不能与模块两份 countdown 同时做真相。
- 新局/可信出生为有资格生物装载模板，玩家与 NPC 共用 schema、纯计算器和执行器；复合成员由核心持有共享体力/韧性和动作束，不能每条腿另得一池资源。被俘/麻痹/非战斗对象不得通过 combat 绕过原资格；克隆/变形/复活分别明确重新初始化资源与动作取消，不复制正在施放的 actionId。
- attach/load 只校验/绑定/重建索引，不补费、回血、触发攻击或 RNG。离层按 §4 处理；缓存层资源冻结，返回继续剩余时间。死亡先使动作不可执行，再进入既有死亡/来源/GC，历史来源收据不保活死对象。
- unload 撤销 provider/订阅/UI和会话缓存，不修改已退休世界；同局不允许热移除模块。新局任意子集可玩，要求 combat 的旧存档在未安装时明确拒绝，不能剥掉状态继续读。
- 仅安装无启用：无 combat 组件、调度任务、资源恢复/动作 RNG 或 UI；没有 combat 的 giants 沿其原生即时攻击。没有 giants 的 combat 通过底座单格实现，不依赖 giants 存在。模块集合仍一局固定。

## 3 数据合同与可调平衡

下面是字段设计，不是新增运行 schema。所有定义有限 JSON、严格判别联合、引用预检、无 eval/脚本/动态路径/网络；修改机械字段或顺序改变规则指纹并升规则版本。

| 类别 | 拟定数据 | 校验和语义 |
|---|---|---|
| 包 | moduleId/versions、profiles、attacks、resourcePolicies、bonfires、limits | 全部 ID 包内唯一，跨定义引用必须存在；UI 文本 ext.combat.*；显示资源不混入机械随机 |
| 资源模板 | staminaCapacity、initial、regenPerTickNumerator/denominator、regenDelayTicks、poiseCapacity、poiseRecovery | 非负有限安全整数，分母/容量正，定点余数持久；无 growth 使用自有模板值，不读取未存在属性 |
| 招式 | id/tags、cost、windupTicks、recoveryTicks、interruptPolicy、segments[] | 时长均为正整数；不以渲染帧/玩家turn计时；首版每独立actor/群核心最多一个动作束；复合束最多4个并行成员子动作，每招式≤8段，每段≤256偏移，最终预算待实测 |
| 子段 | delayTicks、shape、orientation、locationPolicy、targetPolicy、damageProfile、poiseDamage、parryable、friendlyFire | 显式说明命中/伤害/盾/符文/来源如何进入原生结算；不能仅写一个 damage 数字绕过现有 immunity/physicalResolved |
| shape | footprint-offset-union 或 single-ray；offsets/local direction；includeSelf、occlusion | 前者从整个占格集生成；后者唯一边缘发射点。任意8方向使用显式整数模板，不用45°浮点旋转/四舍五入 |
| 防御 | dodgeCost/distance/duration/recovery、parryCost/window/recovery、breakRecovery | 费用、距离、时间、保护类别皆可调；不能把“闪避”理解为所有伤害无敌 |
| AI | eligibleProfiles、priority、rangePolicy、resourceReserve、dodge/parry weights | 按权重的随机选招只在NPC就绪决策提交取引擎 RNG；无可行动作确定性 wait；纯预览不掷骰 |
| 篝火 | placement/interaction、restTicks、restorePolicy、resetPolicy、limits | 复用安全交互对象，默认 resetPolicy=none；重生不是现有能力，见 §7 单独选择 |

数值只是未来配置位置，本文不锁具体武器伤害、体力池、招式节奏、成功率或敌人密度。建议先用纯 fixture 三种原创招式（定向横斩、固定地面重砸、分两段突刺）验证规则，再选择正式内容；fixture 不冒充自然生成。首次正式阶段3玩法需确认 §10，而非把默认建议当批准；阶段4已批准的按部位范围伤害、核心并行束max耗时等合同不再列为阶段3可自由改变的平衡选项。

## 4 权威动作与时间合同

### 4.1 状态形状和唯一时钟

拟持久 `combat:action` 包含 schema/actionId/decisionOwnerId/timeChargeOwnerId/groupId/profileId/depth/phase、phaseRemainingTicks、elapsedActionTicks、segmentIndex、lockedAnchor/lockedCells/facing、targetId可空、paidCost、interruptReason可空、source provenance；每个子动作另存sourceEntityId/sourcePartId/sourceGeneration、footprintId/pose与其phase/remaining/lockedCells，固定zone来源再带zoneId/generation。`combat:resources` 保存 stamina、regenRemainder、regenDelayRemaining、poise、poiseRecoveryRemainder、defenseWindowRemaining。private state 保存 revision、nextActionId、篝火绑定/休息次数/收据等有界记录。所有 ID/预算/引用/相位交叉校验。

使用底座推进的**正整数 elapsedTicks**，不使用 Date.now、animationPauseMs、absoluteTurnNumber 或现有 `timeSystem.currentTick` 的输入累计值当新增截止时钟。后者写入散在 Game 动作路径，尚不能保证任意 NPC 中间子步的权威时刻。首选剩余时长方案：每次 advancementLoop 的 soonestTurn 同时考虑动作下一边界；同一个 elapsed delta 只扣一次资源/phase 剩余量。调度队列只是索引，重建不改变未来顺序。

### 4.2 从输入到阶段切换

1. 纯 preflight 解析/版本/revision/角色资格/资源/shape/空间与目标；所有风险确认完成并重验前不扣费、不取骰、不分 actionId，不写录像 decisions。
2. 同步 commit 分配 actionId、扣一次全招式体力、记录来源、冻结首段预警、进入 windup。启动耗时为 windupTicks，actor 下一自由决策在完整动作结束后。不能再叠一次原生 attackSpeed。
3. 玩家长动作交给同一 time scheduler 推进，不伪造连续玩家 wait 命令。期间敌人和环境正常行动；UI可播放多个帧但不改变时间。玩家不在自身 windup 中获得额外输入机会，故首版主动取消只允许在空闲/合法恢复边界的独立动作，不支持墙钟“抢按取消”。敌人的前摇跨玩家决策边界自然可见。
4. 到 windup 末执行第一段。每段先重验 actor/深度/空间政策，冻结唯一目标列表，再按底座稳定接触顺序与命中键结算；逐EffectTargetPolicy命中键应用原生命中/护盾/伤害/效果并即时发 physicalResolved。反伤杀死施法者则剩余目标和后续子段终止。之后进入正延迟 inter-segment 或 recovery。
5. 末段后 recoveryTicks 到零才 idle。零时间“resolve”是同一调度边界内的有限步骤，不能重复进入自由 AI；动作预算保证不会零tick自循环。
6. 相位推进和 核心/独立NPC 原生选择必须明确 handled/blocked/native-fallback 三态，只有 fallback 进入原 Monster.takeTurn。handled 时不再补 movementSpeed；blocked 必须有正剩余时间。不允许新动作与原AI同一边界双击。

**NPC共同前置与后置**：3a0须从Monster.takeTurn提取一次性的native-decision prelude，而不是让handled路径跳过takeTurn全部内容。就绪自由决策先经过scheduler的死亡/entranced/paralyzed/caged/GETS_TURN_ON_ACTIVATION门，再执行原尸体吸收、activation feature、离水显露、缠绕、感知/state更新与睡醒消耗动作；这些任一已消耗本次决策就不选combat招式。prelude仅在idle→新决策执行一次，windup/inter-segment/recovery边界不重跑。fallback进入“已做prelude”的原生行为余部，不再重复前置；逃跑/盟友避险/施法与combat选招优先级由profile明确声明，默认保留生存/逃跑优先，不能沉睡施招或用combat规避IMMOBILE/俘虏限制。每次已接受的原生行为仍只做原native deep-water sweep；新combat复合动作持久累计elapsedActionTicks，在完成/打断的terminal边界对仍存活且同层actor只做一次sweep，使用实际消耗tick，不每子段重复；死亡/移层不在旧层追加sweep。该差异是新动作的明确规则，需来源/随机计数和中断用例，不假称与旧单步逐骰相同。普通环境接触仍按底座客观块正常运行，不因前置仅一次而免疫危险。

**与原生ticksUntilTurn的桥接不变量**：busy独立actor的phaseRemainingTicks是相位的唯一持久时间真相；复合核心则以各子动作的持久phase/remaining为唯一真相，核心phaseRemainingTicks和native ticksUntilTurn只是其下一最小正边界的派生镜像，保存时若保留镜像须严格交叉验证、不能独立修改；每次进入/切换/打断相位，底座同步把其ticksUntilTurn设为同一正剩余值，二者按同一elapsed恰好递减一次，恢复时校验两者一致。phase边界先于advancementLoop的“玩家tick为零则退出”与NPC的movementSpeed兜底处理：windup释放后立即切下一正间隔/recovery并同步ticksUntilTurn，不能暂时开放玩家输入。非busy actor才由原生ticksUntilTurn决定下一行动；busy期间禁止原AI、attackSpeed赋值或native兜底覆盖。恢复到idle的边界：玩家ticksUntilTurn归零，完成同tick既定解析后才返回输入；NPC在该边界至多作一次新决策（新招式重新进入正windup，native fallback执行一次并获得正原生耗时），不把“完成恢复”和“自由行动”分别当两个轮次。环境/伤害打断发生在该边界前则切正breakRecovery；死亡移除不再调度。此桥接由3a0集中实现/测试，不能模块直接写原生计时器。保存busy实体同时有原生字段与模块remaining是兼容表示，必须由底座同步、严格一致验证，不能各自独立推进或修复坏档。

同 tick 提议顺序：扣 elapsed/累积资源 → 既有环境块/致死 → 同到期独立actor/群核心按实体ID的 phase resolution或原生决策 → 逐击死亡/打断立即可见 → 安全点事实/资源/GC → 公共显示帧。玩家完成和NPC攻击同tick时先完成上述到期解析，再开放玩家输入；不按 UI 到达次序裁定。未使用新调度能力的局保留现有怪物迭代路径；开启局新稳定顺序属显式规则变化。顺序改变须录像升版和组合测试，不声称与旧规则相同。

### 4.3 打断、死亡、位移与取消的精确定义（推荐）

| 事件 | 规则提议 |
|---|---|
| 目标死亡/移走 | 默认地面锁定攻击仍打原预警格中的当前合法实体或挥空，无自动追踪；不退体力，进入正常后续段/恢复。明确 entity-target 招式目标失效则该段挥空，不能秘密换人 |
| 来源成员/zone破坏、退休或施法者死亡 | 立即取消该来源全部待段和防御窗口，不能让核心补射；核心死亡则取消整个束；不补伤害、不退款；死亡来源仍按既有因果链结算 |
| 强制位移/物理旋转/换形/拓扑变化 | windup/inter-segment取消剩余招式，进入 breakRecovery；已发生伤害不撤销，不退款。底座先提交位移再同步通知取消与新投影，不能显示旧预警到下一玩家输入 |
| 切层/坠落 | 取消主动攻击/防御窗口，不在另一层释放；资源与恢复期剩余量随实体保存，缓存层不推进。离层时 clear preview 与pending索引，返回重建恢复期 |
| 韧性破防/麻痹/被俘 | 立即取消未解析子段；当前不可分割单次命中完成后应用。恢复期取 max(现余恢复, breakRecovery)，不叠加无限锁死；原生麻痹自身仍独立阻止行动 |
| 无效/陈旧输入、确认No、纯瞄准取消 | 0tick、零费用/随机/ID，无新动作，无虚假成功记录；确认No由原命令拒绝路径消费一次录制decision |
| 已接受动作的落点因事务内世界效果失效 | 作为付费失败进入配置恢复；不能回退整个历史。若尚在commit前验证则免费拒绝，两者由明确commit点区分 |
| 内部异常 | 当前调度微步原子恢复或显式停止失效录制，不能吞错继续；未实现完整写集之前不开放该动作原语 |

每个待段的 locationPolicy 首版建议仅 `locked-world`：将施法者占格集和朝向在该段预警开始冻结。后续段重新锁定时必须有独立正前摇，不能即时把危险区旋转到玩家脚下。未来 `follow-actor`/`track-target` 不是默许字段；如要支持须选择 §10，并给出重新预警与最小反应时间合同。

### 4.4 资源、NPC与确定性

体力在所有已接受且声明费用的 native/模块攻击、dodge、parry 的共同 commit 点统一扣费；普通移动/等待费用默认零，可调。成长技能若调用 native attack，不可双扣：底座动作凭据含 costOwner/charged，一次行为只有一个 stamina charge；growth 的专注是另一资源，双方预检与提交必须同一事务，任一失败均不留单边扣费。物品/魔法若未声明combat stamina policy则不擅自收费。

正 elapsed delta 以定点累计体力恢复，仅 idle 或声明可恢复阶段生效；费用提交重置 regenDelay，至零后的剩余 delta才恢复。容量变化在权威安全点钳制当前值、不免费回满。poise伤害先扣，≤0产生一次 break；恢复窗口结束时按规则回到合法正值，同一恢复期重复受击不重触发/延长无限硬直。NPC与玩家算法相同；免疫硬直是明示模板，不靠 isPlayer 判断。

NPC在就绪时按可见/已知目标、空间与资源过滤选项，固定priority/ID排序，随机权重只在有意义的最终选择点取一次规则随机。AI不能读取玩家尚未提交输入；防御决策只读已公开于该NPC感知的预警。无combat或未分配招式的NPC native fallback；combat启用但资源不足的攻击必须改wait/移动而非绕过费用。普通中立/盟友生物可共享能力，narrative非战斗WorldInteractable依然不可攻击。

### 4.5 必须保留的受控准备与录制 decisions 合同

沿已合入的D4/阶段2d纯准备设计 §4.5，不另起异步模块协议：prepare返回规范化 `{command,revision,request}` 数据；Game用同一原生风险谓词构造 `{kind,target,message}`。准备context只读、同步、结束撤销；不得让可写ExtensionContext、Creature、Game或业务回调跨 yield/await。

当前 request 只有 attack/move/wait/search，不能把 dodge/多阶段攻击/篝火伪装成一个 wait 来骗过验证。3a0须扩充严格版本化 action request/风险描述或定义等价有限纯意图类型；现有接口在此之前不支持这些动作。准备期间保存的只有冻结数据及suppliedAnswers；重新取得候选世界、核对runtime identity、revision、目标/footprint及规范计划相等后同步执行一次。原 requestConfirm按risk逐条消费答案并且恰好向decisions记录一次，No进入原拒绝路径；缺失/多余/错序答案不得默认Yes。

**延迟命中的风险授权范围**：当前原生确认是目标特定的，不能用启动时对A的确认授权未来B。首版推荐在commit时保存每子段的EffectTargetPolicy和risk policy：普通敌对合法目标允许未来进入；需要友军/中立攻击或酸蚀装备等确认的实体，只允许本次prepare明确列出并获得Yes的entityId/groupId/partId或zoneId+generation+风险种类，且释放时资格/风险不扩大。新进入的需确认目标或已确认对象新增风险，在解析前跳过该目标（不扣其HP、不取命中骰），招式仍付费挥空/继续；绝不在NPC/延迟解析里调用requestConfirm暂停或默认Yes。UI预览说明此安全过滤。再生/替换即使partId相同也使用新generation，不继承旧目标授权。该授权记录属于动作机械状态，必须保存/重放校验；实际答案仍只由原命令消费记一次decisions，不在每段再录。NPC动作沿明确阵营/friendlyFire资格，不借用玩家答案。未来若选择“确认整个危险区包括后来者”，须另行批准范围型风险文案/协议，不偷偷扩张现有目标确认。

预警只是呈现不产生确认。危险闪避经过原生移动的危险/友军/地形风险谓词；篝火的明示恢复/重置风险由新原语提供同样纯风险列表。重放消费既有决策不等弹窗；seek/load清理旧准备会话，不把prepared DTO写进存档。禁止先执行再回滚当预检，禁止复用同步drain等待UI。

## 5 多格预警与阶段 4 的底座交接

### 5.1 几何、预测和实际命中

令 O 是底座返回的**发起攻击的成员**完整足迹，S 是指定攻击朝向的整数相对偏移集合。面积预警候选为 `union(o+s for o in O, s in S)`，去重、按y/x排序，再按selfExclusion/边界/遮挡过滤。selfExclusion明确为source-member或whole-group，首版推荐whole-group（从结果减去本束锁定时的己方群占格）；绝不将O替换为整群足迹。普通单体是隐式单成员群，1×1 fallback仍同公式。

anchor是mask局部原点/旋转支点，不普遍等于左上或中心；只有builtin方形r0沿左上原点。body pose是r0/r90/r180/r270，按r3首版不开放镜像；攻击facing独立为8方向。四向攻击可整数90°变换，斜向使用显式整数模板；不对mask旋转后重新左上归一化，不把空洞当身体。combat不定义新形状/旋转/部位几何，全部消费底座结果。

单射线从指定成员nearestContact的唯一稳定合法边缘源格发射；不会每个占格复制一道射线。依底座contact顺序和墙角/LOS政策，源部位被毁后不能换核心发射。

- forecast机械格集在该来源子段锁定时持久；UI仅获得当前公开格/来源/阶段，不泄露隐藏群拓扑、zone HP或完整footprint。当前公共DisplayFrame把部位位置/血量/破坏与预警作为同一帧。
- resolution以locked格集为上界，复核墙体/遮挡、来源generation、目标资格和当前占格；新增墙可减命中，拆墙不扩张到未预警格。普通合法敌对目标可移入/移出，新增风险目标按§4.5过滤，不在解析期间询问。
- 每个 `(actionId, sourceSubactionId, segmentIndex, dedupKind, targetKey)` 最多一次。EffectTargetPolicy严格版本化：按已批准P4-D08，近战/投掷/射线/横扫/爆炸等物理及范围伤害默认part（同一成员或固定zone多格一次，不同部位可各受一次），整体精神/身份效果group一次，地形/气体按entity后按状态owner合并，击杀/XP按group一次。招式明确覆盖须进入规则指纹，不能私下把AoE统一去重成整个entity/group。
- 基础无zone单体的part键退化为entity+body；部位键带entity/group/part或zone及generation。底座collectBodyTargets提供稳定接触序：有方向按子段contact，无方向按y/x、entityId、zoneId。阶段3不能另按entity排序覆盖它。不同成员子动作/显式后续段各有scope，同一局部命中传播核心伤害却**不**产生新scope。
- 局部伤害与r3的核心传导属于同一次原始物理resolution，传导不再掷命中/伤害骰，不重复符文、弹反、poise消费、growth效果或攻击费用；具体局部/整体poise owner由§5.4规定。目标接触列表冻结后每命中重验，位移/破坏不能自动添加新目标；核心/来源死亡即停止适用剩余子段。
- 新预警威胁进入玩家安全路径即打断自动探索/旅行/长休息，不自动闪避；读取显示不取规则RNG。原生反射回访的scope仍归底座明确策略，不能以combat去重改变所有bolt行为。

### 5.2 新增底座接口目录（全为待共同确认的签名草图）

以下类型在底座定义，模块不导入彼此。`Cell/EntityId/Revision` 为有界整数值；所有 View 深冻结。签名描述能力而非已经可编译的API。

| 能力 / 建议签名 | 所有者、语义与交接 |
|---|---|
| `spatialOf(sourceEntityId): CreatureSpatialView | null`，view含entityId/groupId/partId/generation、anchor/footprintId/pose/labeled cells及sessionRevision | 阶段4底座主笔；对齐r3 §3.2/§11.3提案。当前层存活/允许死亡接触策略另参；没有多格组件就返回单格，不要求giants。revision是会话防陈旧令牌，不持久机械时钟 |
| `nearestContact(a,b,linePolicy): Contact | null`；`canStepFootprint(actorId,from,to,policy): FitResult` | 阶段4主笔；combat只消费完整身体合法位移/射线源，不维护第二套碰撞或跳墙规则 |
| `collectBodyTargets(cells,policy: EffectTargetPolicy,scope): readonly BodyTargetContact[]`；scope含action/来源子动作/segment、eligibility | 阶段4主笔、3a0共同核对；按entity/part/group显式键去重、返回来源/目标generation和稳定contact，不给模块活Creature。AoE与反射重访显式不同策略 |
| `projectAttackShape({footprint,shape,facing,occlusion}): readonly Cell[]` | 通用纯几何底座；阶段3提出用例、阶段4确认几何与预算后单一实现。shape定义属combat但有限基础原语不导入combat types |
| `readKnownBodyTarget(target): PublicBodyView | null`；`projectTelegraph(plan,knowledge): PublicTelegraph` | 阶段4负责空间知识/裁切，阶段3负责攻击公开状态；不可拿可信完整footprint给Vue |
| `prepareActorAction({sourceEntityId,decisionOwnerId,timeChargeOwnerId},request): ActorActionPlan | Rejection`；`commitActorAction(plan): ActorActionResult` | 3a0底座主笔、阶段4审占位接口；native/玩家/NPC共用；成员返回无时间落账的结果，由核心协调器唯一提交；commit仅同步引擎授权域可用；source区别玩家命令/NPC scheduler，不能外部伪造actorId |
| `nextActionBoundary(): number | null`；`advanceActionTime(delta): void`；`dispatchActorBoundary(decisionOwnerId): handled | blocked | native-fallback` | 3a0底座；队列由模块持久remaining重建，最小正delta和稳定tie order；不向任意hook开放调度世界写权限 |
| `commitCombatResolution(plan): ResolutionResult` | 3a0底座扩展CombatSystem权威入口；具备来源、命中、伤害、防御拦截、physicalResolved与死亡的单次写集；具体DamageProfile范围须列白名单 |
| `prepareWorldRest(request): RestPlan | Rejection`；`commitWorldRest(plan): RestResult` | 3e底座；新事务独立定义，3a0不假装已有；范围取决于P3-D05，不允许借2c reward transaction执行重置世界 |
| `queryActorCapability(id, input, actorId): OptionalResult` | 3a0后可选底座增量，明确可信actor scope；现queryOptional仅玩家context不足。不存在provider返回unavailable，非法DTO报错，重复provider注册拒绝 |
| `publishCommittedFact(fact): void` 与版本化订阅声明 | 联动实现前共同设计，底座分配共享根/各module派生范围，稳定FIFO/预算/回滚；不得直接复用narrative单消费者commitFactRange并让combat抢ID |

单格/隐式单成员群fallback由底座facade实现并留无giants fixture；不能combat私下从Game读loc，而giants开启时另走软provider返回其他坐标。**空间是基础能力，giants内容是可选模块**。可选 `combat.attack-profile.v1` 给声明了外部profile key的giants招式适配返回冻结描述；没有combat或不支持key则使用giants明示native attack。该协议尚不存在，不能靠当前玩家optional query假装NPC已可查询。

### 5.3 实际共享文件冲突表与先后顺序

| 共享文件 / 范围 | 阶段3拟改 | 阶段4拟改 / 合并责任 |
|---|---|---|
| `src/engine/Core/Game.ts` | prepared新动作、权威actor executor、调度ports、篝火事务、显示帧连接 | 占位/位移/target/持久/生成连接均在同文件；维护者指定单一集成人，按函数小补丁串行，禁止双方整文件覆盖 |
| `src/engine/Core/TimeCoordinator.ts` | 新边界候选、delta资源/阶段推进、tie顺序、防AI双行动 | 多格接触/环境/cache失效；先固定共同phase顺序，4不另建多格独立timer |
| `src/entities/Monster.ts`、`src/engine/Combat/MonsterAI.ts` | 有界选招、NPC共用动作、感知预警 | 空间感知/路径/攻击接触迁移；独立actor/群核心一调度项，非核心成员不入全局调度，不能按占格或每个Monster重复调用AI |
| `src/engine/Combat/Combat.ts` | defense/poise拦截和原子解析、统一费用/逐击事实 | 接触距离/多格去重；共用resolution scope，避免二次physicalResolved |
| `src/ext/types.ts`、`runtime.ts`、`world.ts` | 受控动作、调度/事实能力、模块校验/篝火世界引用 | spatial/regions、版本/世界验证；world原interactable保持非战斗语义，新区域类型不塞进它 |
| `src/engine/Core/EntitySnapshot.ts`、`WholeRunSnapshot.ts`、`LevelSnapshot.ts`、`src/ext/compatibility.ts` | 必要调度/状态完整性、错误定位 | spatial/regions codec与读取；统一版本分配和候选验证后退休旧局 |
| `src/ui/displayProjection.ts`、`presentationTimeline.ts`、`src/components/GameCanvas.vue` | 当前/历史预警DTO与图层、危险目标选择 | 身体裁切/一实体render group；先商定公开帧shape，旧ACK帧不得混未来坐标 |
| `src/ui/commands.ts`、`src/ui/dialogInput.ts`、`src/ext/ui/types.ts` | 新按钮/有限动作target UI，复用DialogInput | 多格尾格瞄准；默认不改DialogInput核心，只有明确通用缺口才双方review |
| `scripts/u03-state-contract.json`、`scripts/test-suites.json`、扩展测试发现/组合smoke | 新Game字段若有必登记，底座测试/所有组合 | 空间字段/基础fixture；不能互相删守卫或把基础测试放进可删模块 |

以上为实施时真实文件路径清单，本轮均未修改。这三份Snapshot均已核对位于 `src/engine/Core/`，不能用提案名称创建平行codec。生成、path/FOV/占位和多格渲染主体由阶段4维护；combat最多提出对接要求/测试，不接管 `Architect`、`GenerationCoordinator`、`Pathfind`、`FOV` 等完整迁移。篝火首版安全放置复用enteredLevel不挖图；若后续要求营地房间，移交阶段4通用generation contribution并另批生成工作。

交接顺序：共同确认本表与签名/时序 → 阶段4提供4a0通用身份/单格facade与4a方形纵切fixture/几何契约，阶段3可先独立纯planner → 维护者整合一个3a0/4a0底座合同提交并统一版本 → 3b在该提交上接单格动作 → 4a方形、4b mask/旋转、4c固定zone、4d复合体分别接对应fixture → 双模块组合测试 → 分别推进各自内容。若阶段4尚未可用，3b可在已批准的底座单格facade上实现，但多格能力标未验收，不复制占位库。每个共享改动先报函数/类型范围与基线；完成后交换commit与测试证据，合并采用三方小补丁，冲突重跑双方直接受影响功能门禁，完整档留收尾。当前不合分支、不推foundation/main。

### 5.4 r3复合体、部位破坏与持久令牌的协调合同

**调度/费用**：sourceEntityId/sourcePartId是实际攻击来源，decisionOwnerId/timeChargeOwnerId是群核心（独立生物三者相同）。核心在一次激活中建立最多4个并行成员子动作，按r3已批准D14束耗时取各成员完整动作耗时的max，不串行求和、不把四个子动作分别加到核心tick。成员返回计划/结果/持续时间，不写ticksUntilTurn、不调用playerTurnEnded；TimeCoordinator求soonestTurn、递减和ready遍历三处均排除非核心成员。核心调度索引取所有子动作下一正边界的min以交错解析；完成束的最晚deadline取max，短子动作结束不会提前开放核心新决策。§4.2的remaining/native tick桥接仅作用于核心/独立actor；对复合束phaseRemaining表示下一子边界，恢复/结束由所有子动作是否完成决定，成员自己的remaining由核心唯一delta更新。核心镜像只能从这些剩余量重算，不另存独立deadline；所有子动作结束后才到idle。同一核心同tick的子动作按创建时稳定sourceSubactionId升序、再segmentIndex升序解析（ID由稳定成员partId顺序分配），前段破坏/弹反/死亡立即影响后段资格。该顺序和跨核心entityId顺序一起进入规则版本，不能依赖数组插入或回调抵达次序。

stamina/poise默认由核心共享，一次束commit按招式声明合计费用一次扣账，不能每个预警格/命中部位/传导再次收款；共享体力仅在所有未完成子动作均处于显式允许恢复的阶段、且核心regenDelay到期后恢复，全部完成才视idle，每个核心elapsed只累计一次，不读取恰好当前最早边界的单个子阶段来决定整群恢复；不同头的独立子动作可以有独立费用条目，但费用总和由核心预检/原子提交。固定zone局部HP、成员HP和冷却仍归底座；不自动给每成员创建combat资源池。首版不支持局部combat资源，若未来明确需要须另加owner声明/schema。共同NPC决策prelude在核心激活一次；局部成员环境/状态由r3的status owner和客观块处理，不能因此跳过中毒/缠绕/部位破坏。deep-water和环境接触路由由底座负责每合法owner一次，不能再对每条腿重复执行核心后置。

**位移/旋转/来源失效**：每个子段绑定sourceEntityId、partId/zoneId（适用时）、generation、groupId及机械footprintId/pose/锁定格。成员移动、物理旋转、换形、zone替换或拓扑改变使该来源剩余子动作按locked-world首版政策取消并清预警；普通目标移动不取消施法者。纯break且无balance-loss只取消被毁来源；核心整体转换或群死亡取消全束。其它来源未变且仍合法时可继续；任何重定位攻击必须重新进入有正反应时间的前摇，不能临命中换来源/朝向补射。自体排除集的群拓扑变化同时触发重新校验，禁止已毁成员的旧格成为隐藏新增杀伤格。再生使用新entityId/generation，即使partId复用也不能继承旧计划或风险许可。

**可选 `combat.part-break.v1`**（拟新增，非现API）：输入为冻结的 `{resolutionId, breakReceipt, groupId, sourcePartId, generation, balanceLoss}`；底座验证receipt唯一且确为本次部位转换。provider返回 `handled` 的有界核心poise损失/硬直/取消意图，或 `unavailable`。handled时只有combat韧性/硬直写入；缺席/明确不支持才由底座按r3 fallbackStunTicks写核心actionLockInTicks，二者互斥，不叠两份stun、不造一份假poise。receipt由底座部位破坏账本权威去重，combat只保必要已消费关联；provider异常是同一body transition事务失败，不能吞错降级再提交两次。无balance-loss无provider调用，仍取消被毁来源。provider注册重复在开局前拒绝；不经2c reward adapter改世界/推进时间。

**持久计划与footprint revision**：r3 §11.3要求计划绑定足迹版本，§11.1又将空间revision定义为不保存的会话缓存。本案明确区分：持久保存source generation、footprintId/pose及locked geometry的规范机械指纹 `sourceFootprintVersion`（由已有机械字段纯计算，含zone标签/所属群与成员generation，不新增空间机械真相）；活会话准备/执行另持sessionRevision防陈旧。load先验证完整候选世界与sourceFootprintVersion，再重新绑定当前sessionRevision，绝不把旧会话数字与重建数字比较而误取消合法招式。破坏/转换后的机械不一致按状态验证/已提交取消记录处理，不load时偷偷补攻击。**该命名/接口差异须双方确认**，不是擅改阶段4 codec；若维护者选择独立持久revision，须由底座定义唯一计数并统一格式升级，combat不自增一个竞争计数。

**缓存层时钟**：combat动作在离层取消，combat stamina/poise恢复期及regen余数离层冻结；这只约束combat字段。r3原生缓存层catch-up继续按其已有底座规则处理原生状态、群冷却/再生/actionLock，不能把该delta再转发combat scheduler。基础恢复若导致部位退休/形态变化，在发布恢复层前用来源事实清理对应索引和校验状态，不补发离线攻击。普通load不做catch-up、发新事实或资源恢复；真实换层恢复与load是两个不同入口，测试分别覆盖。若未来要combat也离线恢复，另改规则版本与双方时钟合同。

共享文件增量：阶段4拟新增底座 `src/engine/Combat/BodyDamage.ts`、`src/engine/Core/BodyGroup.ts`（具体路径随其落地确认）；以及已存在 `src/engine/Core/MonsterLifecycle.ts`、`src/engine/Systems/Time.ts`、`src/ext/causality.ts`/`birth.ts`、`src/engine/Core/PresentationObserver.ts`、`src/entities/Creature.ts`。空间/群表/无死亡退休/原始与传导来源由阶段4底座主笔，combat仅提交有限防御/取消意图。新增API不是新combat私有空间库。沿r3 §13逐函数协调，不给用户已批准阶段4的D08/D14再列反向选择。

r3正文中尚有“火球默认group”历史段落，与§12已决定D08不同；本文遵循**已批准D08的part默认**。此处仅记录对接风险，不改阶段4文档；维护者整合时应清理矛盾文字。阶段3对r3已批准能力的消费仍逐步按4a方形、4b mask/旋转、4c zone、4d复合体fixture开放，未落地能力显式拒绝，不能先接受无法执行的配置。

## 6 闪避、韧性和弹反

- **闪避建议**：一次严格目标格/方向的付费原生移动，首版距离一格，整段路径/足迹须合法，不穿墙/穿人/楼梯/区域边界，不悄悄换目标。成功位移后保护窗口仅过滤标记 dodgeable 的直接物理段；环境火/毒/坠落/已有DOT不免疫。费用+位移+窗口原子提交，之后恢复期；无合法格预检免费拒绝。若选择纯走位型闪避（D03-B），无保护窗口仍保留费用/恢复合同。
- **弹反建议**：主动付费架势，正整数windowTicks；窗口含开始、截止边界不含终点（remaining>0才有效），在所有同tick命中前先扣elapsed。因此恰在到期边界的攻击失败。仅 parryable 直接物理且满足朝向/contact范围的段可弹反；不对环境/投射物默认有效。
- 成功弹反：在原生命中/伤害抽签前拦截，零普通伤害骰，发独立defended事实，不伪造普通命中；消耗该窗口一次、攻击者接受配置poise冲击/打断。首版无免费反击，玩家下一合法动作自行选择。非parryable攻击不消耗窗口但可造成正常伤害；有效窗口内可弹反攻击到来即用尽，之后同tick后续段正常结算。
- 失败/过期：体力不退、恢复期照走；禁止概率二次判定作为隐藏“操作时机”。提议以离散时间与朝向确定成功，见D04。朝向在架势提交冻结；被迫位移取消窗口。
- 顺序：资格/空间 → dodge保护 → parry → 原生命中 → 盾/伤害 → poise → physicalResolved/死亡。未实际掷普通命中骰不得消费growth的probability-roll效果；成功防御不能触发positivePhysicalDamage。原生伤害仍由CombatSystem维护。

## 7 篝火：恢复，不偷偷回卷世界

建议首版安全休息点，使用combat所有的非阻挡WorldInteractable，放置收据/绑定在combat，坐标在foundation.world。enteredLevel安全放置、无位defer/终止、缓存层GC沿既有合同；地图空间不变。只有存活、非行动/非硬直/非战斗威胁、合法交互距离与LOS、无其它interaction gate才允许准备休息。

打开说明是0tick只读界面，不私自建立narrative gate。确认 `combat.rest` 后进入**可被打断的有时长rest动作**：体力/HP恢复在rest完成安全点一次性提交，期间NPC/环境照常；受伤、移动、死亡或新敌情按统一interrupt取消恢复，无免费中途回血。窗口期间无普通玩家输入；复用prepared风险确认与D3显示，不让弹窗冻结机械rest，也不按打开界面的墙钟计时。

恢复建议只处理原生HP与combat stamina/poise/自己动作；不清毒/饥饿/伤口等原生状态、不重置growth专注/冷却，除非有显式版本化provider支持并被批准。容量从当前权威值重算，不能复活死亡者。记录rest actionId/bonfireId/visit序号，精确一次；load不会重新恢复。

P3-D05若选择敌人重置，另一个实现小步先设计并验收如下事务：

- 不load旧存档、不rewind seed/RNG/时间/nextEntityId/nextFactId，不擦录制输入或叙事日志；新rest命令正向产生全部变化和新checkpoint。
- 重置范围只限明确生成epoch/region登记的可重置普通敌人，不复活Boss、剧情NPC、盟友、已领取唯一物品或任务结果；哪些敌人和掉落可再生必须数据化批准。
- 新生物使用新ID/出生来源，旧死亡/XP收据保持；防刷奖励策略需要growth可选报价明示，不因growth缺席而报错。重生时出生/掉落/XP如何去重不能留到实现临时决定。
- 计划预检所有落点/预算/世界引用；整体写集含生物/列表/空间索引、双方模块state、来源/计数、两RNG、消息timeline，失败全回滚。2c现有资源事务不足，须新增底座事务和故障注入测试。
- 初版A不提供重生、死亡复活或checkpoint重开按钮。将来要死亡续局属于另一产品选择与存档/终局语义设计。

## 8 可选成长、叙事与持久/录像

### 8.1 软联动方向

| 协议提案 | 合同 / 缺席 |
|---|---|
| `growth.combat-stats.v1`（可信actor查询） | 只返回允许的staminaCapacity/regen/poise参数修正或限定属性DTO；growth自行解释属性，combat不import其公式/组件。缺席/不支持使用combat模板；非法非有限/越界DTO拒绝，不伪装缺席 |
| `combat.attack-profile.v1` | 已启用combat可根据声明key给原生actor执行器冻结招式描述；giants缺席不影响combat，combat缺席giants原生攻击。调用需要新增actor-scope capability，现API不足 |
| `combat.event.v1`（底座committed fact） | attack-resolved/staggered/parried/rest-completed的有界公开事实，含action/segment/entity/source IDs与公开类型，不含未揭示计划。narrative缺席无队列/派生ID，不补发旧事件；narrative存在但未订阅不产生剧情 |
| `combat.part-break.v1` | 按§5.4消费唯一部位破坏receipt，核心poise/stagger与底座fallbackStun互斥；缺combat不报错也不造combat字段 |
| `combat.public-state.v1`（玩家只读） | 自己公开资源/阶段/篝火历史，可用于叙事旁支；combat缺席条件明确onUnavailable，不阻断基础故事。不能经此访问NPC秘密状态 |

首版可完全不接高级联动，保留原生死亡/逐击事实供现有growth使用。增加多消费者剧情事实必须先解决共享根+各module派生范围、排序、预算、失败共同回滚；不能让combat直接调用narrative planner。成长stat adapter若未实现，对UI标“基础模板”，不假称属性已经影响体力。

### 8.2 保存和重放

- 只在原有安全输入边界保存；正在动画/同步解析/确认等待不可导出半事务save。怪物windup/inter-segment/recovery和玩家可持久恢复状态必须可保存；动作definition引用、phase合法性、remaining>0、actor/depth/来源、冻结形状和资源余数均校验。
- 缓存层资源/恢复期保存为剩余时间，不对离线层追补tick。actor死亡后无待行动；活跃action与decisionOwner/action束一一对应、source成员/generation存在，重复actionId、孤儿/未来段、坏shape预算、负数/溢出拒绝。load从持久状态重建索引，不能重新抽取AI招式/支付费用。
- 精确manifest验证模块集合、foundation/module/rules指纹、状态/输入schema。不迁移旧档、不剥除缺模块；拒绝在退休旧Game前完成。当前版本保持不动，首次底座动作/空间格式实际落地由集成人统一分配，不能combat和giants都独占foundation4。
- 玩家每次输入走Game.executeCommand/executeItemCommand；NPC派生行动由同一权威模拟执行，不注入假玩家录像输入。checkpoint覆盖所有actor动作/资源/余数/来源、当前/缓存层和需要的空间摘要；不能只比玩家坐标。
- 多段命中、打断、rest均可逐条replay、seek和save续录：只记录已提交输入与既有decisions，按同一RNG/调度重建结果；seek不等待显示/UI；load不重发攻击/奖励/休息。相同输入与包必须复现同一事件/状态/两RNG计数。
- 公共历史显示帧必须捕获预警/资源/阶段DTO；等待旧伤害ACK时不读取未来Game的当前action。图片、文字、hover、缩放和DialogInput状态不进入机械save，不取规则RNG。

## 9 刻符界面和移动端

预警图层位于地形上、身体与目标轮廓下，危险格用填充+独立边框/符号区分“即将释放/后续段”，不可遮住火、楼梯、身体边缘；与阶段4共用公开格遮罩。只展示当前已预警段及剩余行动时间区间，不能剧透未来目标/隐藏招式。多个预警重叠用稳定优先级和检视列表，不用颜色混合暗示不存在的叠伤次数。

HUD在模块通用插槽显示stamina条/poise状态/当前招式阶段；无模块无空槽。玩家按钮为攻击招式/闪避/弹反/附近篝火，灰态附原因，实际授权仍在Game。桌面方向/鼠标目标走既有瞄准→确认；手机点击闪避→方向格→确认，返回只退当前瞄准。禁止双tap/长按释放后落入下一按钮或同格另一身体片自动确认。

共用DialogService/DialogHost负责招式说明/篝火确认；DialogInput是唯一物理输入仲裁。长按检视预警格可显示当前公开攻击者/阶段/防御提示；模态、背包、narrative会话、D3忙态、失焦/host卸载都按现有优先级处理。新危险自动打断旅行，关闭说明不会恢复自动行动。

验收必须包含1440×900、390×844、320×844 × 普通/沉浸，四地图模式、触摸模拟与真实设备分别报告；预警重叠、部分身体可见、长名称、回复中击中、多个Dialog往返、held键/blur/双指或相邻pointer cluster、replay快进/seek、旧ACK帧与新招式都要覆盖。展示不改变资源/tick/两RNG；不声称仅SFC测试或headless引擎已验证手工触控。

## 10 待维护者决定（每项2–3选项，推荐不是批准）

| 编号 | 选择 | 推荐和影响 |
|---|---|---|
| P3-D01 首版覆盖 | A 仅少量明确配置的敌人招式+玩家防御；B 所有普通攻击改多阶段；C 仅敌人预警、不加玩家防御 | **A**。先验证读招和资源闭环，未配置攻击仍经过费用policy但保持即时原语；B改动广且需全内容平衡 |
| P3-D02 锁定/追踪 | A 每段locked-world，位移/变形打断；B actor-relative随施法者动且重预警；C 目标追踪到释放 | **A**。预警可信、空间冲突小；B/C须重写最小反应时间和显示，不作为隐藏自动追踪 |
| P3-D03 闪避 | A 一格移动+限定物理保护窗口；B 仅快速走位无无敌；C 多格翻滚 | **A**更有魂系防御，环境仍危险；B最简单；C要求逐步接触/碰撞及更多阶段4对接 |
| P3-D04 弹反/硬直 | A 离散确定窗口+一次消耗+poise破防；B 仅格挡减伤暂缓弹反；C 概率弹反 | **A**可学习且可重放；B可缩小首次范围；C增加随机解释与平衡负担，不推荐 |
| P3-D05 篝火 | A 有时长可打断恢复、不刷新；B 恢复并局部普通敌人重置；C 本轮只做预留、推迟休息 | **A**。B要独立重置事务与奖励防刷裁决；C缩短战斗交付但不能称完整阶段3 |
| P3-D06 成长联动 | A 先combat自有模板，adapter后独立验收；B 第一版即双模块属性联动 | **A**先证明独立性；B需actor-scope查询、双资源事务及容量变动规则一起做 |
| P3-D07 时间/恢复 | A 正整数tick、缓存层冻结、玩家长动作期间无额外输入；B 允许玩家在阶段间取消/换招 | **A**与原调度容易整合；B须新可记录输入安全点/费用和取消规则，不能靠UI实时按钮实现 |

还需双方共同确认 §5.2 的空间/actor-action API形状、§4.2同tick顺序、具体基础版本号及共享文件负责人。这是工程合同裁决，不通过选择上述A就默认认可尚未实现的所有签名。

## 11 分步实施建议：每步独立验收，停下来等批准

| 小步 | 交付范围 | 最大风险与必须新增的测试 |
|---|---|---|
| 3a0 共用底座协议 | 与4a0共同确定footprint单格facade、actor action/prepare/阶段调度/防御解析权限与版本；基础fixture，不安装正式combat | 双计时/双AI行动、持久双真相、跨await写权限；同tick环境致死/玩家就绪、最小delta、stale plan/No/错序答案、异常回滚、NPC无法冒充玩家命令；core-only三遍调度、≤4并行max耗时、成员不写timer；单格fallback不依赖giants |
| 3a1 独立包与纯planner | combat schema/definitions/state/组件/发现/UI空投影、自有测试；不启用实际招式 | 坏引用/无界shape/零循环/非法provider；严格预算/整数/版本、canonical指纹、物理删除及纯显示零RNG；不可宣称战斗可玩 |
| 3b 预警与多段攻击 | 少量原创profile、原生/NPC接入、locked-world、显示历史帧；完整来源/逐击/打断 | 未预警扩区、尾格重复命中、目标死亡/位移、反伤中止、缓存层；三招式真实Game、每phase存读/replay/seek/续录、多人同tick与双RNG、禁用/缺giants，底座2×2/3×3及按阶段开放的mask/zone/复合fixture合作验证；破坏来源/再生generation、物理旋转、part/group去重、sessionRevision重绑定 |
| 3c 体力与闪避 | 统一费用、regen定点余数、NPC同规则、有限保护窗口 | 原生成长技能双扣/单边提交、0tick刷资源、穿人穿墙、保护误挡环境；资源上下界、速度变化、窗口终点、双方费用失败回滚、无growth/带growth、手机目标/取消风险确认 |
| 3d 韧性/弹反 | poise恢复/破防、确定弹反、AI防御、逐击效果消费 | 无限硬直、同tick窗口重复、伪命中触发成长；多段/多人次序、免疫/盾/必中/反击、有效与无效parry、RNG次数、shared NPC/盟友；D03/D04变更须更新规则版本 |
| 3e 篝火 | 按D05批准项接有时长恢复；若选B另拆3e2，先交重置事务设计再实现 | 免费暂停/恢复、重复奖励、回卷时间、半世界重生；中断/死亡/No/双提交、无位、重复访问/存读/seek、无narrative/growth、来源ID单调与回滚；B故障注入覆盖全部写集 |
| 3f 联动与收尾 | 经批准的stat/event adapter、配置手册、独立组合/实际删除、自然内容及最终报告 | 隐式growth/giants依赖、多消费者fact ID碰撞、缺provider错误、旧版本误读；反注册顺序、预算失败共同回滚、缺模块档拒绝、所有子集实际替代行为和六布局浏览器 |

每个开发小步只跑§12相关功能门禁；完整full/全部ext/全子集和实际removal矩阵统一3f收尾一次。尚未正式安装combat的底座步不能声称已删combat验证；模块自有测试随真实目录删除，底座动作/空间fixture留在底座。3b/3c可按维护者要求进一步拆分，不能借拆步跳过门禁。未经下一步明确授权不继续实现，不合main、不tag、不部署。

## 12 验收矩阵与本轮设计验证

### 12.1 最新阶段3门禁决定（覆盖旧每步full政策）

维护者明确要求：开发各步（含本设计交付）只跑功能相关测试：`node scripts/check-module-boundaries.mjs`、`npx vue-tsc -b`、`npm run build`、本步新增/修改功能和直接受影响既有测试，以及相关子集真实Game smoke。**不跑完整npm test，不跑全部test:ext，不跑删除副本removal矩阵。** 本轮纯文档没有新增功能测试，使用文档检查与现有相关组合smoke，不凭空增写游戏测试。

完整npm test、全部test:ext、所有安装子集smoke及实际物理删除矩阵统一在**3f阶段收尾一步执行一次**；若3f同时有联动开发，可先拆功能子步，最终收尾才执行完整档。Node24.19.0、3GiB堆、2workers继续，实际命令/文件/hash/数量/退出码如实记录。不要求ce:fetch/CE test:full/test:gen，不隐藏现有CE缓存。实际生成变化才跑相关drift并说明；无生成改动不跑drift，收尾需要的全量生成回归按实际改动范围决定。

收尾的物理删除在隔离副本删整个模块/数据/自有测试、清缓存，跑boundary/type/build/剩余全部ext/所有剩余组合smoke/旧档拒绝；removal不重复完整npm test。禁用不等于删除，engine-only不等于浏览器。开发期可以做新增模块的发现/边界专项，但不能称已完成真实删除矩阵。保留有效守卫，明确新产品规则变化可修订失效测试并报告原因/替代覆盖，不用宽泛exclude/skip掩盖回归。

当前有growth/narrative：4启用子集、4目录保留子集（3删除行）。安装combat后为8/8（7删除行）；再有giants为16/16（15删除行）。由发现器计算，不能只测全开和全关。每个包含combat的子集应自然可进入实际战斗/防御/rest闭环；底座多格fixture另标，不用调试注入冒称自然giants内容。删除combat后giants仍native可玩，删除giants后combat单格可玩，删除growth/narrative也不影响combat基本资源和休息。

阶段专测必须覆盖：纯显示/开关UI的两RNG不变；坏档/坏manifest不退休旧局；current/cached/pending/dead来源与动作一致；相位边界的序列化；同tick冲突；攻击者/目标死亡与强制位移；单实体多格去重；generated环境/换层事务故障；真实命令路径中的confirmation decisions；重放不可依赖图像、墙钟或UI等待。性能记录每命令P50/P95、最大预警格/动作数/目标数与预算触顶原因，不编造FPS。

### 12.2 本轮仅设计的实际检查与停止点

本轮只修改本文与README阶段3政策/审阅入口，不创建combat模块，不改变src/scripts/tests/data/package或任何规则/版本。先按当时旧README启动正常门禁，boundary/type/build、全部ext（68文件1307项）及现有四组合真实Game smoke已完成；后来维护者改变阶段3政策，正在运行的完整npm test立即中断（exit130），**这是范围调整，不是产品测试失败，也不是完整测试通过**。removal从未启动。先前已完成的全部ext只作为实际运行记录，不代表今后每步需要它。

r3与新政策文档修订发生在中断之后：初始门禁候选hash与最终文档hash分开记录，生产/测试/脚本/数据字节始终与70a5e1d一致。修订后重新做boundary/type/build、现有相关四组合engine-only smoke、Markdown目标/LF/diff检查和独立只读审查；精确结果以最终交付的证据摘要为准。没有生成改变，不跑drift/CE full/gen；没有新浏览器行为，不重复Mac像素验收，不声称本轮实测触控。代码原有风险与历史缺口不会被文档检查消除。

设计及接口提案、阶段3的§10选择仍待维护者审阅；阶段4r3已批准这一事实不授权实施阶段3。交付后停止，不merge、不tag、不部署、不自动进入3a0。
