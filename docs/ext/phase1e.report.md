# 阶段 1e：身份、怪物模板与阶段 1 收尾

状态：实现、独立复核与新版全量门禁完成；真实浏览器主要流程通过，下述未覆盖项/既有限制明确保留，不称浏览器全项通过。仅交付 `ext/foundation`，停止等待维护者验收，不合入 main、不部署、不进入阶段 2。

## 基线、范围与门禁档位

从已验收 `08559dc643d5ef2792411b27152ef560c26809b7` fresh fetch，将 `origin/main 1ff39a842e65accd5d6f73b5ae091dca9c7d97a2` 合入，提交 `f80faf8`。唯一 README 冲突保留扩展规则独立及新版经典门禁；三套文件清单补登 35 个既有 ext 测试和 main_menu_replay_seek，不遗漏 1d 增量。合并后类型、build、清单守卫 3 项通过。

采用最新版 **全量档**：本步新增身份/赠技/模板来源持久字段、扩展 create-character DTO/效果来源/首访参与者，growth 精确版本升为 **1.4.0**，改变扩展存档/录像合同；同时真实怪物出生启用模板。必跑 `vue-tsc -b`、`build`、固定 legacy `ce:fetch`、`test:full`、`BROGUE_REQUIRE_CE=1 npm run test:gen`、`test:drift`。不再运行旧的含重型普查 full，也不重复 npm test。所有新增测试登记 `scripts/test-suites.json`。

实际引擎/实体文件：`engine/Core/Game.ts`（纯新局预校验、首条命令、入层参与者）、`entities/Player.ts`（提取并复用原生出生 HP30/STR12 常量）；easy45/14、wizard999/18 与经典初始化结果不变。无新增 Game 实例字段，U03 清单无需增项。其它改动为扩展运行器/类型、growth纯模块/校验/投影、Vue/i18n、测试和文档。原 TimeCoordinator try/finally、受控动作入口、来源归属、生成事务/检查点、原对等断言/黄金 trace/生成基线未变。

### 实际 1e 文件清单（不把前置 main 合并算成新玩法）

- 原生边界：`src/engine/Core/Game.ts`、`src/entities/Player.ts`
- 扩展底座：`src/ext/runtime.ts`、`src/ext/types.ts`
- growth：`attributes.ts`、`definitions.json`、`definitions.ts`、`describe.ts`、`evaluator.ts`、`index.ts`、`module.ts`、`schema.ts`、`skills.ts`、`state.ts`、`view.ts`；新增 `identities.ts`、`templates.ts`，均在 `src/ext/modules/growth/`
- UI/文本：`src/App.vue`、`src/components/MainMenu.vue`、`src/components/growth/GrowthCharacterPanel.vue`、新增 `GrowthCreationPanel.vue`、`src/locales/zh_CN.json`
- 新回归：`ext_growth_identities`、`ext_growth_identity_runtime`、`ext_growth_templates`、`ext_growth_templates_runtime`、`ext_growth_identity_adversarial`、`ext_growth_creation_view`、`ext_growth_creation_ui`、`ext_growth_public_effects`，均为 `src/test/<name>.test.ts`
- 获准旧前提：`ext_growth_attributes`、`ext_growth_skills`、`ext_growth_npc_replay`、`ext_growth_view`、`ext_growth_ui`、`main_menu_replay_seek`、`immersive_polish`，精确范围见下表；无其它旧测试改动
- 测试清单：`scripts/test-suites.json`；文档：`docs/ext/README.md`、`architecture.md`、`growth-config.md`、`growth-expression-audit.md`、`phase1-growth.md`、本报告和 `evidence/summary.md`，另更新根目录 `progress.md`

## 交付能力

- 4 职业、4 血统、4 信仰数据接通：固定初值、加权选择点、免费赠技/一次性前置豁免、常驻被动、誓约收益与代价、none/soft/hard 学习限制；没有样例 ID 分支或 eval
- 开局职业 → 血统 → 信仰 → 汇总，全部列表/预算/说明来自当前实际数据工厂。取消/返回/重开仅影响草稿；完整选项在旧局退休前校验；第一条真实录像命令携带所选身份，半创建局不可行动/保存
- 兼容原显式 `{revision:0}` 程序化中性创建；正式菜单始终使用完整显式选项。成功开局的 600ms 纯显示输入屏障阻止第二次物理点击落到新地图，不推进模拟或改变经典开局
- 身份 modifier/tagged-modifier/first-visit resource 运行。守望的架势强度/冷却、岩裔/暮裔时长、苇民勘察、寻路首访资源与容量代价、克己容量/恢复代价复用既有词汇；身份 timed 无触发时点及未实现 changeFaith=true 明确拒绝
- 怪物开关、确定性深度优先模板、共享构筑初始化、克隆继承、真实复活/变形保持身份、职业盟友升级自动分配。普通怪物默认仍中性 L1，默认深度映射为空；不开启 NPC 主动技能 AI
- 精确保存/加载、录像、seek、续录与篡改拒绝。加载不重赠，不重选模板，不重复叠加派生最大生命；1.3.0 及同版本错指纹输入拒绝，无迁移

### 玩家/NPC 初始点数来源

玩家初始可用属性点/技能点仍由等级表 L1 计划提供，与1d一致；身份固定属性/选择与赠技是免费构筑，不扣除或替换余额。真实新局回归以 L1=20属性点/4技能点同时验证中性与显式身份角色均保留20/4，只有后者附身份秩/赠技。

NPC 使用完整出生模板：两项 unspent* 是明确出生余额，不再隐式领取等级表 L1 计划；后续只领取出生等级之后的跨级增量。相同测试配置下默认 NPC/克隆仍0/0。字段说明和迁移注意已写入 `growth-config.md §1.6` 与字段目录；改变等级表时必须显式检查每个模板余额。

### 玩家只读投影与隐私边界

identity 精确公开字段：

| 字段 | 来源与显示用途 |
|---|---|
| professionId / lineageId / faithId | 玩家已确认身份 ID；从公开冻结定义取得名字、说明和誓约公开得失 |
| choices[].identityId | 将公开选择结果关联到所选身份定义；不表示授予执行来源 |
| choices[].choiceIndex | 关联该定义中的公开选择组/预算，供身世展示及分配/洗点基值复算 |
| choices[].attributes | 玩家确认的属性 ID→增量；显示已选初值，不含待提交草稿 |

不投影 templateId、gifted、首访/奖励/赠予收据、因果来源账本、NPC 身份组件或 RNG。公开定义包含可选内容目录，不含当前 NPC 实例身份图。新增通用 componentFields 白名单及纯 detached-component 投影，不向投影函数提供 Game、上下文能力、NPC或随机流。

临时受技效果也去除旁路：公开 skill-build 只有 learned/inherited/active/passive/effects；effects 只有 expiresAt/tags/modifiers/taggedModifiers，施放者当时的幅度已计算为常量，条件继续由同一求值器判断。来源 actorId/属性、身份来源 ID、实例序号/内部计数不进入显示。新测试以不同 NPC 身份和内部收据哨兵检查分离、精确字段、深冻结、不可变、零 RNG/模拟副作用及逐条件效果对等。

## 获准的旧测试前提调整

断言语义、容差、超时与 skip 不作其它修改；原对等测试/源码守卫/黄金 trace/生成基线不放宽。全部反事实在仓库外副本执行，原测试字节逐文件核对相同。

| 文件 / 用例 | 原前提 → 限定新前提 | 等值依据与反事实 |
|---|---|---|
| ext_growth_attributes / configured clone progression accounts for withheld birth grants and inherited points=%s | NPC 隐式领取等级表L1 → 该夹具模板出生余额20属性/4技能 | 原 configured L1计划正好20/4；所有继承开关、20/0、升级预算断言不变 |
| ext_growth_skills / persists NPC timed/passive components, reloads without reapplying, then expires from objective time | combatHarness NPC隐式L1技能点 → 模板显式30 | 原L1计划30；学习实际扣费、效果/存读断言不变 |
| ext_growth_npc_replay / applies NPC defense/damage/one-shot consumption during native turns and round-trips replay, seek and save continuation | configuredNpcScene隐式L1技能点 → 模板显式30 | 原L1计划30；原真实录像/seek/续录逐状态断言不变 |
| ext_growth_view / reads the actual session pack and renders added/removed attributes, skills, identities and changed slot counts | futurePhase==='1e'尚未实现标记 → null | 只回退生产view的该字段，原用例1/1通过；其它 !available/中性selectedId=null断言不变 |
| ext_growth_view / exposes immutable player-only selection and reuses its frozen pack rather than cloning the run per read | 精确组件列表少identity → 只追加identity，新增字段/深冻结覆盖 | 只从生产descriptor移除identity，原用例1/1通过；没有改成宽松子集检查 |
| ext_growth_ui / uses actual changed definition entries, prices, caps, effects, prerequisite names and slot counts | 字面“阶段1e”占位 → 已确认身世固定的当前说明 | 只回退面板说明key，原用例1/1通过；价格/上限/效果/前置/槽数断言不变 |
| main_menu_replay_seek / MainMenu mounted replay seek（7项） | 手写模块映射缺新面板/view → 补空面板stub与真实view导入 | 仅把生产MainMenu新增runtime imports替成空组件/被调用即throw的休眠helper，其余当前逻辑不变，原7/7通过 |
| immersive_polish / 原11项 | 同类手写映射缺新依赖 → 仅补同两映射 | 同一import-only生产反事实，原11/11通过；11项断言、容差、超时、skip不动 |

前三项 NPC 反事实仅把 module.ts 的一处 NPC模板初始化表达式恢复旧中性初始化，其余1e生产和原测试不变，3文件53/53通过、exit0。最终恢复1e模板行为并补获准等值余额后，同组重新全绿；不使用旧式隐式L1兼容分支掩盖配置语义。

## 独立复核整改

1. 有体质构筑的继承克隆 HP 曾被裸原生上限裁低；改为最终新最大值钳制正常HP，并保留原生过量HP一次。真实HP18、满HP23→21、过量33→31及再克隆/存读覆盖
2. 极端合法配置的成长加值单独安全、加原生HP/力量后溢出；在退休旧局前使用与实际初始化共享的模式基值做精确安全加法。normal/easy/wizard、HP/力量、MAX边界合法及+1拒绝全部覆盖；独立半创建命令也在原输入门拒绝
3. 盟友自动分配回复混入新装被动增益；明确等级→属性→装配三步，分别执行配置回复/保留政策，不免费治疗装备增加的上限；无跨级/封顶不消耗模板初始余额
4. 完整模板跨身份赠技总额度漏检，补唯一赠技合计校验；changeFaith预留字段不再接受无实现的true
5. 身份技能说明注明基础效果与标签修正，避免岩裔/守望的基础时长2/冷却10被误读为最终3/12；技能页冷却仍显示统一求值器的实际值
6. 只读受技快照原可携带 NPC 身份来源ID；改为无来源的常量修正规则投影，保留条件而不提前应用条件强度，独立对等/泄漏回归兜底

## 浏览器整改与中断证据

第一候选真实双击“下一步”时连续处理两个click，职业→血统→信仰跨过一页；背景dblclick阻止冒泡在两个click之后，不能阻止该问题。旧候选全量于2026-10-03 07:50 UTC启动，08:01 UTC以exit130主动中断；类型/build/CE准备通过，test:full没有完整结果，test:gen/drift未执行。旧日志单独归档，不拼接为最终通过。第二候选对上/下步增加同步600ms导航锁与重复click.detail拒绝，锁内开始禁用；取消/卸载清计时，不碰模拟。新增同一DOM两次click/跨Vue重绘、反向连击、599/600ms、键盘detail0和取消/重开测试；仅回退这处生产处理器、保持新测试相同时精确重现“应血统、却信仰”。第二候选浏览器复验与新树完整门禁结果见最终段落。

### 已完成的真实浏览器覆盖

Mac 只托管云端静态 dist，不在用户机器编译或运行完整门禁。第一候选完整查看1440×900、390×844、320×844的普通/沉浸六布局像素，12张身份卡、加权选择/汇总修改、经典直接开局均通过；四步骤取消按钮/Escape/外点共12次，旧世界（排除savedAt）、玩家对象、录像与双RNG相同，重开为独立默认草稿。

第二候选 SHA256 `e08d450666c2f607b95832a9a237c4b56952f7e28738e3b5e936b26e6ce6043e`（生产输入hash）仅修改GrowthCreationPanel导航逻辑/禁用状态，样式保持。三视口上/下步共18次真实dblclick均只一步，反向锁定点击不越页；键盘Enter逐页，取消重开恢复。最后创建双击只有1条create-character；detail2在29ms被屏障承接，278ms ArrowUp/283ms s被拦，0/252/305/556ms均turn0、原位置、1条事件，656ms屏障结束也未耗时。

恢复观察器后另起自然局：完整身份+5wait的真实保存/加载世界一致，继续wait得到7事件；实际数字seek3/0/7与0→末尾均0OOS，扩展checkpoint、机械世界、双RNG精确一致。播放时角色只读并冻结cursor，关闭后继续。实际“保存录像”的原始JSON经真实文件选择器导入通过；导出按钮反馈复制剪贴板，但IAB读取为空，故**导出按钮字节捕获未验证**，不拿保存/导入结果冒充。

原生法器瞄准取消已实测：充能4→4，完整机械世界与双RNG零差异。窄屏鼠标/键盘是Mac浏览器视口模拟；没有物理手机或真实触摸证据。

Mac终态证据在 `/Users/coolking70/Documents/Codex/2026-10-03/task-4/qa-evidence/`：`qa-report.json`、`screenshot-index.json`（38图）、`hash-final.json`。两版243生产输入/16dist最终散列匹配。观察器、视口、沉浸偏好已还原，静态服务停止；一个旧错误页标签因工具安全限制未关闭，其余预览关闭。截图和原始JSON不提交仓库。

### 既有菜单焦点限制（非1e回归）

主菜单关闭后activeElement落BODY，最多8次Tab仍未到地图，因此“普通菜单关闭必须恢复.game-view”这项清单要求未通过。只读对照f80faf8与当前代码：App菜单@close均仅设menuOpen=false，watch只处理打开；MainMenu卸载均只移除modal handler。Input在window监听keydown、不要求地图DOM焦点。Mac独立游斗者局在BODY下真实z输入仍正常，turn0→1、事件3→4，说明没有键盘玩法阻断。角色页关闭、身份取消回菜单和新创建屏障结束的焦点行为另已验证。此既存DOM焦点/Tab可访问性限制单列，不扩大1e去修，不写成焦点全过。

### 原生确认取消：明确未覆盖

第一候选 Mac 中 window.confirm 的操作仍不可靠：IAB 对话框读取返回 undefined、辅助UI读取超时并重置；恢复后口粮已消耗，turn=1、nutrition=2149，所以不能把该次尝试写为“取消成功”。随后无活动对话框；原生应用访问又被安全限制明确拒绝，已停止，不另找绕过路线。云端受控动作/食物逻辑取消用例与本次浏览器结果分开报告，前者不能替代后者。

维护者可手工补验：另起刚创建的扩展局（满饱食），记录回合、口粮数量以及调试入口的双RNG/专注/CD快照；从实际背包食用口粮，在系统确认框点击“取消”；确认口粮/营养、回合/tick、HP/专注/CD和双RNG全部不变。消息提示可变化，但不能把消息变化当机械费用。不要复用已经消耗口粮的场景，也不要将确认回调替成假返回值。该项尚待人工补验，不把它列为阶段1浏览器全覆盖。

## 实际验证

第一候选先行检查（不替代第二候选最终门禁）：vue-tsc/build通过；全部ext加原生开局/清单45文件917项通过（285.64秒）；快速源码守卫53文件241项通过（630为名称筛选未选，非新增skip）；UR2/UR3/UR4、录像、U03、新局8文件47项通过（163.66秒）。严格JSON96份及JSONC3份、LF/diff检查通过。重型源码守卫3项通过（702.46秒；4为名称筛选未选），45种子×26层1170层/3803台机器，center及宝藏违规均0。因Mac验收待工具响应，经协调先在同一冻结候选启动最终全量，浏览器仍独立待完成；以上先行检查不是最终全量通过。若浏览器要求改源码，不能挪用旧树绿灯。

第二候选最终完整一轮为 **2026-10-03 08:21:16–10:18:46 UTC**，Node24.19.0/npm11.9.0、3072MiB堆，full/gen两worker、drift一worker，原门限/种子/断言不变：

| 命令 | 最终结果 | 退出码 |
|---|---|---|
| `npx vue-tsc -b` | 类型通过，26秒 | 0 |
| `npm run build` | 构建通过，38秒；保留原Vite单块大于500kB与npm代理配置提示 | 0 |
| `npm run ce:fetch` | 固定legacy `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9` 已验证 | 0 |
| `npm run test:full -- --maxWorkers=2` | 288文件，5314通过，8个历史skip、5个历史todo；2334.86秒 | 0 |
| `BROGUE_REQUIRE_CE=1 npm run test:gen -- --maxWorkers=2` | 27文件，436通过；4513.57秒，无skip | 0 |
| `npm run test:drift -- --maxWorkers=1` | 2文件/2项，D1–26与D27–40原基线均过；133.76秒 | 0 |

三套共317文件、5752项通过；旧skip/todo不变，没有用无CE的npm test规避对照。第二候选额外重新跑快速源码守卫53文件243项通过（630为名称筛选未选），以及导航/相关UI回归；最终full/gen覆盖全部源代码守卫和扩展。所有新增8个测试已登记清单。

652个生产/测试/脚本/资源/构建输入前后精确相同，SHA256为 `55e2ab92d5291176f31812c417b1b96ae09469c003f7cd7a12179dbfc5c45792`；生产输入hash仍为Mac第二候选 `e08d450666c2f607b95832a9a237c4b56952f7e28738e3b5e936b26e6ce6043e`，最终16个dist字节与其完全一致。完整日志无FATAL、OOM、断言失败、未处理错误或worker异常；两份基线/三份黄金trace与已验收输入逐字不变，未重录。

门禁结束后仅补文档。原始日志、完整散列、反事实副本保留忽略目录 `tmp-phase1e-raw/` 及仓库外 `cloud-extension-evidence/phase1e/`，截图仅留Mac，不提交。精简结果原文见 [门禁摘要](evidence/summary.md#阶段1e身份怪物模板与阶段1收尾最终验收)。提交/远端核对由完成汇报给出，只限ext/foundation；仓库仅有main触发的Pages工作流，本步不触发。

## 阶段 1 总结：供是否合入 main 决策

### 已交付能力

- 阶段0隔离底座：显式扩展注册、命令/生命周期/组件、精确manifest/数据指纹、扩展存档录像区块；经典路径不建立成长状态
- 1a0/1a/1a1：有界真实因果与奖励凭证、嵌套生成提交/回滚、可达性回收、经验/等级/发点、客观资源基础及缩窄生成检查点
- 1b：纯属性/条件/预算/叠加求值、原生战斗/搜索/潜行窄端口、分配/洗点、药水/强化永久收益配置，原生资源单一所有者
- 1c：数据驱动刻符 HUD/角色页、纯预览、会话/revision/回放只读、桌面/手机普通与沉浸布局，中性真实战斗对等保险
- 1d：6被动+6主动样例、受控原攻击/移动/等待/搜索、费用/目标/确认、客观时钟、临时效果/逐结算消费与中断、配置生成说明
- 1e：4×3维身份/开局选择/赠予/誓约、怪物组件开关/出生深度模板/职业盟友自动分配、完整配置及阶段总结

### 配置入口

首要入口为 [growth-config.md](growth-config.md)，数据为 `src/ext/modules/growth/definitions.json`，定义/引用/预算校验在 schema.ts，公开名称和说明在 `src/locales/zh_CN.json`。经验报价/曲线/发点、属性目录/费用/上限、回复、技能前置/锁/槽/费用/冷却、身份赠予/誓约、物品收益、NPC模板/克隆开关均为可调A样例；技术D02/D04/D16/D17/D18/D19/D20/D22保持固定A合同。改包须同步规则版本、引用及测试清单，无需为合法新条目修改引擎或Vue列表。

### 已知限制与后续建议

- 这些是可配置机制与样例内容，不是强度/升级曲线/奖励分布已经平衡；未做固定种子奖励分布或目标曲线校准
- 没有 NPC 主动技能 AI、精英敌方高等级默认分布、剧情内容/改信/违誓系统；后续按阶段2/3单独设计并获准，不在本轮补做
- 不迁移旧扩展存档/录像；1.4.0与数据指纹精确绑定。经典格式/基线保持；之后真正合入main必须按最新全量档，并按既定要求在维护者本机至少一次完整CE复核
- 1a1剩余跨层小幅捕获增长沿已批准接受范围，未扩成undo journal；极端加权身份默认预选可留空由用户手动完成，正式验证无隐藏平衡上限
- 浏览器已验证法器瞄准取消、身份全流程和自然存读/seek/续录；原生食物确认取消仍待人工补验，真实手机触摸与导出剪贴板字节捕获未覆盖。既有普通菜单BODY/Tab焦点限制保留，但真实键盘行动正常。详见浏览器段，不称全项验收通过

建议先以此报告、最终门禁和真实浏览器结果验收阶段1，再决定是否将扩展分支合入main；本报告不是合并授权。1e交付后停止，等待维护者下一步决定。
