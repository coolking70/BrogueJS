# Growth 1a0：24 项数据表达审计

范围：默认样例的 **12 技能 + 4 职业 + 4 血统 + 4 信仰，共 24 项**。数据源是 `src/ext/modules/growth/definitions.json`，类型/校验见同目录 `types.ts`、`schema.ts`、`definitions.ts`；字段全表见 [growth-config.md](growth-config.md)。

“可表达”只表示有限数据合同能精确描述需求，**不表示效果已运行**。1a0 不启用 growth 玩法；1b 已实现 P01 纯求值器和属性规则端口，1d 已接动作/临时效果/时钟与学习装配，身份应用仍归 1e。1a 的 XP/等级/资源提交基础不能被当成已实现技能效果。以下数值全部是可调整样例，不做强弱比较或平衡校准。

## 1. 共用词汇与审计口径

- 标量词汇 `modifier`：`port` + `operation` + `slot` + `magnitude` + `conditions`，值来源只允许常数、属性或等级；没有脚本/eval/函数名字字符串
- 定向词汇 `tagged-modifier`：按已声明稳定标签修改 `duration`、`intensity` 或 `cooldown`，复用通用目标解析；禁止按某个技能 ID 写执行分支
- 临时词汇 `timed`：明确 self/target、action-start/action-result、动作期/客观块持续、应用条件、逐命中消费与中断动作；用效果 ID 和标签追踪，不能通过 getter 消费
- 事件词汇 `resource`：first-visit 的深度范围内增减 focus/hp，并按资源合法最小/最大值钳制；是否已首访由持久事实/收据判断，不能把 enteredLevel 事件次数当首访
- 动作词汇只有 `attack`、`move`、`wait`、`search`。全部复用引擎原行动耗时/确认/守卫；move 的 occupied=reject 防止替换成攻击；不含直接坐标写入或直接扣HP
- 身份共同字段：`attributes`/`choices`、`gifts`/`waivePrerequisites`、`effects`、`oaths`、推荐属性/技能；推荐不等于强制分配，学会不等于无槽位生效
- `conditions` 数组是合取；条件只读已提供的事实。`probability-roll` 区分真实概率求值和原必中短路；`hit` 不等于造成HP损失，`positive-hp-damage` 必须读取最终实际结果
- 叠加顺序由 `config.rules.order` 固定为 add → multiply → global-clamp → round；每端口预算、乘法槽、钳制、舍入和保零读配置。命中原必中/必失优先，原100%仍掷骰路径保留原骰子
- 一次性消费由 `per-resolution-commit` 执行：当前单独命中结算后、同动作下一次命中前。架势判定点是非零直接物理伤害、护盾前，盾全吸收仍消费；牵制只在下一次实际普通物理概率求值提交时消费，必中短路不消费

## 2. 相对阶段0必须新增的通用执行原语

阶段0只有只读事件、模块自有JSON组件与命令派发，**没有以下成长执行原语**。1a0新增的是这些原语的数据/校验合同；“合同可表达”不能写成“阶段0现有能力可直接执行”。本表给出缺失执行原语的名称、精确定义和责任步骤，下一节逐行引用。

| 编号 | 新通用原语 | 最小语义与现有能力缺口 | 实现步骤 |
|---|---|---|---|
| P01 | `evaluate-modifiers` 纯标量与条件求值 | 常数/属性/等级幅度、AND事实条件、端口预算/单次乘法槽/钳制/舍入；共享物伤预算仅缩放一次；读而不写、不耗RNG | 1b；1d/1e引用 |
| P02 | `commit-timed-effect` 临时效果与结果消费 | 动作起点/结果给self/target；hit+hpLost等结果条件、截止客观块、逐命中消费和实际动作中断；架势护盾前与牵制概率求值各自独立 | 1d |
| P03 | `modify-tagged-property` 标签属性修正 | 静态有效标签选择目标；duration→cap之前、intensity→magnitude钳制之后/端口预算之前、cooldown→技能base之后/通用冷却之前；不能写任意对象字段 | 1d通用执行，标量复用1b；1e身份引用 |
| P04 | `grant-first-visit-resource` 首访资源与收据 | 效果稳定ID+深度收据去重，min/maxDepth筛选，增减focus/hp并钳制合法界限；与XP来源开关独立，load/重访不再赠 | 1a首访/资源提交基础；1e身份触发启用 |
| P05 | `execute-controlled-action` 受控原行动 | attack/move/wait/search严格目标类型，原资格守卫/确认/耗时；取消拒绝不扣费，无嵌套公开命令，不直接改坐标/HP | 1d |
| P06 | `apply-identity-grants` 身份授予与选择 | 创建一次、固定属性/可选点/赠技豁免/誓约绑定，预算及引用统一校验；存读/seek不重新赠送，公开命令不可指定任意actor | 1e；1a先建中性create-character边界 |
| P07 | `commit-skill-state` 技能学习装配及资源时钟 | 学习/锁定/前置、主动被动槽、focus扣费/恢复余数、每技能readyAt、换槽策略，全部读取配置；等待按真实客观块推进 | 1b属性前置求值；1d执行；1a先建必要资源/冷却提交基础 |

上述都是有名称、有边界的缺失通用执行原语，不是缺一个技能就新增一个技能专属函数。若1b/1d/1e实现中发现现有数据形状还不足，则另列“缺少数据合同/新原语”并升版本；当前24项样例未发现必须使用任意脚本或ID特判才能表达的需求。

## 3. 逐项审计（恰好 24 行）

表中所有 ID 均带 `growth.<kind>.` 前缀；技能/效果标签的完整写法是 `growth.tag.<名称>`。“加法预算”指端口`budgetId`绑定的预算。24项中的modifier样例全部是`operation:add`、`slot:null`；预留乘法只能进入已声明的`growth.slot.final`。攻守物伤端口共享`growth.budget.physical`，同次结算合并后只缩放一次，不各自相乘。同一源的重复只读查询不能重复叠加、重复扣资源或消耗效果。

| # | 样例 ID / 类别 | 可表达的数据与端口/槽位 | 动作、应用/结果条件、消费/中断 | 合同表达判断与运行归属 | 相对阶段0需新增原语 |
|---|---|---|---|---|---|
| 01 | `growth.skill.steady-hand` / 被动稳手 | modifier → hitChance，样例 +500bp，合并命中加法预算 | attack-kind=thrown、role=actor、probability-roll=true；无动作/次数消费 | 可直接表达；1b求值，1d装配生效 | P01、P07 |
| 02 | `growth.skill.close-guard` / 被动近身防御 | modifier → hitChance，样例 −300bp，命中加法预算 | role=target、adjacent、普通物理攻击/概率求值条件；不覆盖必中 | 可直接表达；1b/1d | P01、P07 |
| 03 | `growth.skill.careful-step` / 被动轻步 | modifier → stealthRange，样例 −1，潜行加法预算与原下限 | 常驻装配效果；不改速度/路径，无次数消费 | 可直接表达；1b/1d | P01、P07 |
| 04 | `growth.skill.methodical` / 被动细察 | modifier → searchStrength，样例 +5，搜索加法预算 | search-mode=manual；自动搜索不满足条件，无额外搜索动作 | 可直接表达；1b/1d | P01、P07 |
| 05 | `growth.skill.composure` / 被动沉着 | modifier → focusRecoveryInterval，样例 −1，恢复间隔预算/下限 | 常驻装配效果；不能重置余数或改变原法器资源 | 可直接表达；1b求值，1d客观时间 | P01、P07 |
| 06 | `growth.skill.weapon-familiarity` / 被动武器熟练 | modifier → physicalDamage，样例 +500bp，物伤加法预算、唯一伤害缩放阶段 | attack-kind=melee、damage-kind=physical；level前置4；不进入法术/毒/符文直伤 | 可直接表达；1b/1d | P01、P07 |
| 07 | `growth.skill.measured-strike` / 主动稳击 | timed动作期修正 → hitChance +1000bp、physicalDamage −1000bp；各自端口预算 | attack/adjacent-creature/native-attack；action-start、自身、本次动作；合法未命中仍耗费，动作结束清作用域 | 可直接表达；1b求值，1d受控攻击 | P01、P02、P05、P07 |
| 08 | `growth.skill.brace` / 主动架势 | timed → receivedPhysicalDamage −2000bp，承伤预算；稳定 brace标签供身份改时长/强度 | wait/native-wait；self，2客观块；positive-direct-physical、count=1、per-resolution-commit、includesShieldAbsorbed=true；原0/免疫不消费 | 可直接表达；1b/1d，标签修正1e | P01、P02、P05、P07 |
| 09 | `growth.skill.withdraw` / 主动撤步 | timed → hitChance −500bp，role=target和physical条件，命中预算 | move/adjacent-cell/occupied=reject/native-move；合法移动后给self 1块；不用攻击代替被占格，不直接改坐标 | 可直接表达；1b/1d | P01、P02、P05、P07 |
| 10 | `growth.skill.hold-breath` / 主动屏息 | timed → stealthRange −2，潜行预算；hold-breath标签供时长修改 | wait/native-wait；self 3块；interruptions含attack/projectile/cast，主动动作提交中断；不以UI预览中断 | 可直接表达；1b/1d，标签修正1e | P01、P02、P05、P07 |
| 11 | `growth.skill.survey` / 主动勘察 | timed动作期 → searchStrength +10，search-mode=manual，搜索预算；survey标签可再加值 | search/self/manual/native-search；原搜索核心执行一次，不额外连搜充能，不泄露规则外信息 | 可直接表达；1b/1d，标签修正1e | P01、P02、P05、P07 |
| 12 | `growth.skill.pressure` / 主动牵制 | 动作期 physicalDamage −2500bp；结果timed → 目标下一次 hitChance −500bp、命中预算 | attack/native-attack；action-result条件 hit=true AND positive-hp-damage=true；target 2块；physical-probability-roll count=1逐命中消费，必中短路不消费 | 可直接表达；1b/1d；必须分别验证命中/全盾/零伤/多击 | P01、P02、P05、P07 |
| 13 | `growth.profession.guardian` / 卫士 | attributes给constitution+2；gifts引用close-guard/brace；recommendedAttributes提供确定优先序 | 创建一次赠予并明确前置豁免；预算和赠技数校验；无战斗ID特判 | 可直接表达；1e身份应用，效果复用1b/1d | P06、P07 |
| 14 | `growth.profession.scout` / 斥候 | attributes给agility+2；gifts引用careful-step/hold-breath；推荐敏捷路线 | 同创建/赠技/预算通用语义；不另设装备或射程例外 | 可直接表达；1e | P06、P07 |
| 15 | `growth.profession.explorer` / 探索者 | attributes给perception+2；gifts引用methodical/survey；推荐感知路线 | 创建一次；搜索收益只由已声明技能及端口产生，不暴露地图 | 可直接表达；1e | P06、P07 |
| 16 | `growth.profession.skirmisher` / 游斗者 | attributes给agility+1/will+1；gifts引用steady-hand/measured-strike并显式豁免 | 只对本次赠技豁免；以后学习照常检查前置，不能永久绕过门槛 | 可直接表达；1e | P06、P07 |
| 17 | `growth.lineage.human` / 人类 | choices限定可选属性、points=1、perAttributeCap=1；没有隐形被动 | create-character payload必须记录选择，1点只应用一次，非法选择/超预算整体拒绝 | 可直接表达；1e | P06 |
| 18 | `growth.lineage.stoneborn` / 岩裔 | attributes给constitution+1；tagged-modifier → brace标签duration +1 | 仅匹配临时效果时长，仍受duration.cap；不改减伤幅度/消费count | 可直接表达；1e标签求值，复用1d临时效果 | P03、P06 |
| 19 | `growth.lineage.duskborn` / 暮裔 | attributes给agility+1；tagged-modifier → hold-breath标签duration +1 | 同通用时长边界；不赠夜视/隐身，不移除攻击中断 | 可直接表达；1e | P03、P06 |
| 20 | `growth.lineage.reedfolk` / 苇民 | attributes给perception+1；受survey标签条件限定的searchStrength +2 | 与本次勘察搜索加值合并预算/全局钳制；不能让每次搜索都默认+2 | 可直接表达；1e，复用1b/1d | P01、P06 |
| 21 | `growth.faith.unaffiliated` / 无信仰 | 空attributes/gifts/effects/oaths，显式稳定ID | 中性身份；创建/存读仍走同一校验，无额外消费/触发 | 可直接表达；1e | P06 |
| 22 | `growth.faith.watch` / 守望誓约 | oath显式两面：brace标签intensity使承伤修正再−500bp；brace标签cooldown +2；总承伤下限仍生效 | 标签只匹配对应技能/效果；不额外增加消费次数；不得按信仰ID改变攻击流程 | 可直接表达；1e定向修正，复用1b/1d | P03、P06 |
| 23 | `growth.faith.path` / 寻路誓约 | oath resource(first-visit focus +1，minDepth=2) + modifier focusCapacity −1 | 首访事实持久去重；D1/重访/load/seek初始化不再赠；资源合法最小/最大值钳制；与XP来源开关独立 | 可直接表达；1a首访/资源提交基础，1e身份事件生效 | P01、P04、P06 |
| 24 | `growth.faith.restraint` / 克己誓约 | oath modifier focusCapacity +1、focusRecoveryInterval +1；分别合并端口预算/上限 | 沉着的−1与本项+1用同一加法阶段，不能清余数；无次数消费 | 可直接表达；1b/1d基础，1e身份生效 | P01、P06 |

## 4. 实现前必须保持的有限语义

1. 无未知效果种类、任意事件名、任意字段写入或通用字符串表达式。新原语须更新类型/schema/校验/文档并升版本，不能把 JSON 当脚本或按样例 ID 补分支
2. `tagged-modifier` 的标签必须静态命中已声明技能/临时效果。标签只是受控选择器；修改的 property 不允许扩展成任意对象路径。强度在基础magnitude钳制后、端口预算前修改；持续时间在duration.cap前修改；冷却先改技能base，再进入通用冷却端口/比例下限
3. `resource(first-visit)` 是独立领域事件。XP首访奖励关闭不自动禁用信仰首访专注；加载和回放必须由已记录创建/访问历史恢复，不重新触发赠予
4. `action-result` 引用本次动作唯一的提交结果。牵制附加目标效果需要hit和实际hpLost>0同时成立；全盾、免疫、miss均不成立。架势消费观察点不同，不得共用hpLost>0条件偷换语义
5. 消费只影响已提交的那一个效果实例；当前动作多击之间立即可见，纯策略求值无写权限。中断只发生在实际动作提交，取消/非法目标/预览不触发
6. NPC与玩家使用同一效果和动作执行器；公开玩家命令不能伪造actorId。1e模板不授予未实现AI自动使用主动技的能力

## 5. 结论与未执行范围

24项样例已由1a0有限数据词汇描述；相对阶段0仍需新增P01–P07通用执行原语，逐行映射见表。合同可表达不等于运行器已有能力；表中运行归属都是后续实施责任，不能列为1a0实际玩法验收。若实现时发现任何样例必须靠ID专用分支，结论必须改为“缺少通用原语”，写明名称、输入/输出、确定性及原子提交语义、拟补步骤，先修合同再接线。

本审计不测技能强度；1b P01 实际覆盖见 [1b 报告](phase1b.report.md)，1d P02/P03/P05/P07 的实际实现、NPC共用边界和门禁见 [1d 报告](phase1d.report.md)。1e 身份运行器仍未实现；历史 1a0 类型/数据负例证据不能代替1d执行验收。经典原断言、trace、生成基线不能为了表达样例被修改。
