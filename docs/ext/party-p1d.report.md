# Party P1d 实施与验收报告

**2026-10-23 无party尾部专项：调用栈定位、短路候选和功能门禁已完成；本地计时再次受到Unity batch污染，尚未取得P99三轮中位数+10%以内的有效证明。见[§11](#11-2026-10-23-无-party-尾部专项)。未commit/push。**

2026-10-20，开工分支 `ext/party-p1a`，HEAD `3431533`；本次不 commit/push。维护者已批准 PD1–PD7 全部按推荐，先回填任务单再实施。冻结 foundation `399df979f991434441182373c2fbc022645cab10`；性能 A `e72cd6256daf810f89e520f1673b197d6ba6097d`，其 src 与开工 HEAD 无差量。**实现、精简自动门禁、本地分层归因与 rounds=1 工具链冒烟已完成；已知行为限制见§8，不将短烟判为正式性能通过。** 正式云端派发和浏览器/真机由维护者执行。

**最新修订：第2轮独立复审已关闭F1–F3；新增F4及同类目标遗漏由作者复现修复，处理、入口清单和末轮验证见§10。审查轮次已用完，不启动第三轮；独立审查原文保持。**

2026-10-21云端七运行的后续追查、比较身份v2、超时/汇总工具修复及维护者重跑命令见§6.1；下文首次实施阶段的日志和裁决作为历史证据保留。

## 1 实现与边界

- 正式 `party:roster` schema1 输入：严格 local:0/revision/actor/层/邻接/安全规划边界，零 tick 的 join/station。原生 NPC 的已支付行动间隔保留，scheduler busy/未决/未完成窗口拒绝。
- 三来源：原生救援 hook 的 goblin、既有 cord.mender splice 链及放置收据、实际已付费居民来源。载入联合检查初始ID、来源、历史转换、活/死名册、互斥实体根、profile和真实提供者证据。旧party拒绝，无party格式不升。
- 非主非队长成员可派驻；同一个受控实体在 actors/stationed 间移交，原生状态迁移到 stationedNative，库存/装备/HP/计时不复制。居民交接沿原owner结算、取消、退款、床位和需求；退休保留历史且库存落地一次。
- 当前层驻营者独立调度岗位、状态和环境，并允许原地自卫；离层经济沿原world5。普通留守仍冻结。原地自卫不主动追敌；驻营者落深渊按fallen终止驻营、保留身份历史及物品，不强迫小队换层，也不伪造HP死亡。此处未实现跨层落地后继续任职，列入§8需要维护者复核的限制。
- 成长历史成员/参与者/收据不随派驻删掉；新命令查当前名册，未来普通盟友奖励fallback查当前名册。原生伤害/防御/弱化/再生及装备效果接真实计算路径，未给加入者额外开局套装。
- 横滑成员栏、计划抽屉、来源与拒绝原因、派驻/编入、纯已知地图计划投影；旧焦点/草稿/目标回调失效。视觉与设备体验不由SFC通过代填。
- 跨格式party比较为显式协议，未知差量拒绝；AI有严格A/B入口。新增无路/同伴与三来源转换诊断独立身份，不混入旧wait工作量。

有效身份：**F24 / whole-run11 / recording8 / origin6，party0.4.0/state4**；无party **F20/S7/R4/O2**；world5 schema6不变。新增字段和事务归属登记 `scripts/u03-state-contract.json`、`scripts/recording-digest-contract.json`。不做数值平衡、网络、旧档迁移。

## 2 依据与审批

CE读取来源 `/Users/coolking70/Documents/同步空间/brogue/BrogueCE-master`，HEAD `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`；原生救援按Movement.c执行路径，救援原动作与本次零tick身份管理分开。完整字段/能力/来源/居民写集见 [source audit](party-p1d.source-audit.md)。批准设计从本地git对象 `8bd271b4bc26dea697ca8af1257240d848f3665d:docs/ext/party-multiplayer-design.md`读取，不把缺失的工作树文件当新规格。

PD1主实体/死亡槽、PD2来源/最低初始化、PD3当面空闲零tick、PD4安全退款和需求连续、PD5手机计划层、PD6新party身份、PD7显式跨格式比较与report-only预算，均按2026-10-20推荐批准。执行合同补入 [party-contract §9.8](party-contract.md#98-p1d-动态名册2026-10-20-pd1pd7-按推荐批准)。

## 3 精简门禁与首次失败

只运行影响面整文件、13精选组合、隔离全删九模块和静态/build。未运行完整npm test/test:ext、drift、gen或512子集穷举。

影响面去重为85个整文件：party 33（资格/时序/环境/占位/旅行/AI/Worker/新增来源与UI），settlement 13（来源/岗位/劳动/经济/needs/escort/fall/codec/rollback），growth 7与loot 2（身份/所有权/奖励/收据），narrative 5（内容准入/会话/奖励/存读），foundation 25（中性战斗/slaying、whole-run/摘要/异步录像、world5/物品/结构、无party和源码守卫）。完整路径清单为`/private/tmp/party-p1d/all-functional-selected-files.txt`，分组为`selected-functional-scope.json`。另列三个性能工具整文件，删除副本21个适用整文件单独计，不累计重复测试数。

最终功能证据按批保留，以下不是把重复执行累加成一次全绿：

| 批次 | 实际结果与最终适用范围 | 原始证据（均在 `/private/tmp/party-p1d/`） |
|---|---|---|
| 既有party影响面 | 首批25文件24过/1版本前提失败、294过/1失败；窗口由后续38/38关闭，其余24文件有效 | `party-impact-first.log`、`party-impact-files.txt` |
| foundation/跨模块影响面 | 首批48文件44过/4失败，745过/8失败/2旧skip；四失败文件全部按下列整文件复验关闭 | `foundation-impact-first.log`、`foundation-impact-files.txt` |
| 新P1d来源与组合 | 首批9文件7过/2失败，49过/5失败；自然居民、组合由后续整文件关闭，未覆盖首批日志 | `p1d-final-first.log` |
| 最终窗口/名册/战斗/UI/时钟 | 8文件313/313；含38项窗口、200项中性差分/slaying、13个真MainMenu配置所在19项UI | `final-followup.log`、`final-serial-summary.json` |
| 自然居民原种子链 | 1/1，seed28原388输入保留、最终406事件，完整seed replay/双向seek/续录 | `resident-natural-roundtrip-final.log` |
| 叙事奖励 | 同源整文件46/46，219.00s；原两次超时批另留，未提高timeout | `narrative-rewards-awake.log` |
| 最后i18n/UI/来源/Worker/无party | 8文件首跑60过/1新fixture失败，其他7文件有效；居民随后15/15，34.33s | `extra-final.log`、`extra-resident-second.log` |
| 旧生命周期及早期来源修复 | 3文件9/9，生命周期S11/R8；俘虏/成长另在最终来源批覆盖 | `core-fifth.log` |
| 无party五配置字节 | 最后`ext_party_inert`整文件通过；classic/extended空/growth/loot/旧八模块原fixture、own keys/save/recording/messages/双RNG保持 | `extra-final.log`；原黄金未重录 |
| 正常树静态与构建 | boundary、test-dependencies、vue-tsc/build、diff-check均exit0 | `extra-final-summary.json`、`root-final-ready.summary.json` |
| 实体全删九模块 | 21整文件首批513过/1 i18n失败/2旧skip；20文件有效，i18n整文件26/26复验。去重21文件514过/2旧skip；边界/依赖/types/build通过 | `removal-selected-final.log`、`removal-i18n-ui-text.log`、`removal-final-gates.summary.json` |
| 删除副本生命周期与真实缺包 | extended空和classic分别完整save/load/replay/双向seek/续录；15份本步真实S11/R8档案/录像缺包全部拒绝且保活局引用/摘要/双RNG/allocator/录制前缀 | `removal-composition-final.json`、`removal-classic-lifecycle.json`、`missing-package-rejection-final.json` |

去重85个影响面整文件全部有最终有效结果；两个skip均为`p2_3_objective_time`原有退役生成/相位基线，不是本次跳过失败。首批使用Node25.2.1（foundation首批默认heap）；最终修复复验及删除副本使用Node24.19.0、3072MiB、单worker/无文件并行。没有把旧日志环境改写成Node24；本地性能另在无测试竞争的固定Node24/3072MiB候选运行。`normal-build-post-fixture.log`保留Vite既有chunk>500kB提示，未以改阈值消警。

删除副本确实不存在九个模块目录，不是软件禁用。prepare原证据保持`prepared-not-verified`，实际验收看上述后续门禁；其间明确登记源码同步的前后hash（`removal-final4-refresh.json`、`removal-final4-ui-text-refresh.json`）；最后将4项诊断工具/测试差量同步（`removal-final4-tools-refresh.json`），边界/依赖/types再次通过。`physical-removal-final-identity.json`核对余下913个src文件与最终正常树逐字相同，九模块目录全部不存在。`removal-composition-final.json`仅engine-only的requestedScopePassed=true，browser仍not-run、整体passed=false；没有将其冒称浏览器通过。未跑其他单删/单留布局。缺包样本含三来源、居民往返/自然居民、AI、待决及全开growth/loot局；旧party实际S10/R7样本也已拒绝并保活局（`old-format-rejection.json`）。

首次失败均保留，不改生产守卫消除失败：

1. 新转换测试把所有NPC原生timer>0视为忙碌，导致6项正常招募拒绝；修生产区分已支付间隔与scheduler动作，保留原timer。
2. 新全图oracle在安装spy前捕获，spy增加Game own key造成假阳性；仅将新测试捕获移到spy后，断言仍完整图相等。
3. 新C搬运夹具主成员堵门、货物统计将undefined identity的口粮计入木材，及save补写合法full导致录制baseline取早，均只修新夹具前提；未删退款/别名/图相等断言。
4. 自然叙事测试发现入层恢复成员前可见性为空，合法placement被skip；修travel/fall事务内enteredLevel之前更新视野。随后发现单步回答被外层runtime gate静默拒绝，修可信actor作用域的实际ext输入鉴权，runtime gate本身保持。
5. 新实际伤害对照初次目标未attach真实stat根、直接赋weakness未失效属性缓存，修新夹具使用真实根与原markStatsDirty；不降低伤害对照语义。
6. 旧性能测试单变量反事实：两份旧测试字节不变，配新8个工具生产文件2失败/42过，只还原工具44过。AB/BA/AB fixture为前提修正；AI新增A/B接受断言是PD7批准的能力变化，明确不是把旧拒绝断言称仅修前提。证据 `perf/counterfactual-*.log` 与 `files.json`。

7. 旧 `party_lifecycle` 两个期望仍为 S10/R7。保持整份旧测试字节（SHA-256 `59e82ff8bb2a7ccab3c756802c59837704f9aeaff715c6e5adafdef1bf33b4f2`），仅回退到 A 生产源后7/7通过；本次只更新为批准的 S11/R8，仍断言有效格式精确值。证据 `lifecycle-production-counterfactual.log`。
8. 自然俘虏录档发现 settlement 的已救来源未标 consumed、旧 Monster 仍留在 visible/everSeen 引用中；修来源一次消耗与旧观察根清理，均处于外层完整回滚事务内。新 growth 存读夹具提前构造第二个 Game，重置全局 allocator，改为捕获存档后再构造。自然俘虏/growth/旧生命周期整文件9/9通过（`core-fifth.log`）。
9. 新 Worker 夹具尝试从无origin诊断档开始录制，被正确拒绝；改为沿真实付费营地布景的既有命令前缀填至边界，不伪造事件。链校验取真正 `recordingHeader`，不把带events/snapshots的整份export当header。六边界、生产Worker逐域和诊断读回1/1通过（`worker-fourth.log`）；最后的采集版须以最终门禁为准。


10. 旧 `party_window` 同样保留 S10/R7 前提：旧测试字节 SHA-256 `1d7fdbd07b3507141da1aa829ff9cf9e6e0014a6abaf55111ff4567efb00a003` 在生产 A 上整文件38/38通过（`window-production-counterfactual.log`）。只将两处精确版本期望更新为 S11/R8；当前B整文件38/38已在最终followup通过。
11. 13组合首次跑有4个camp行失败：真实 foraging 同伴在居民移除时重新生成 native actorNeeds，而同实体 rejoin 的早返回跳过交接，导致合法保存被 actorNeeds.actor 守卫拒绝。已抽取共同需求移交函数，让首次转换与再次编回都保守取最低 nutrition、移除原生需求行并失效派生缓存。守卫不改，四行同产品路径新增“不补饱、无残留need”断言；最终MainMenu整文件19/19通过。此修复发生于R2后，单列为后续集成发现，未冒称此前静态审查覆盖。
12. 新自然居民路径首次站营失败，是人在真实camp bounds外；原388输入和实际招募已通，正确范围守卫保持，补公开回营步行和ready边界等待后，保留原388输入，形成406事件；整文件1/1通过完整seed replay、双向seek和续录。


13. 全删九模块副本的types首先失败：根UI测试直接静态导入可删除 settlement/tests helper。改为 foundation `src/test/support/partyCampFixture.ts`，只提取现有诊断地图和真实付费建造所需代码，不改原模块 helper、组合数量、依赖声明或断言。保留首次exit2日志 `removal-build-final.log`；新副本静态与完整UI复验结果另列。


14. 旧 `ext_world5_clock_levels` 动态发现 party 后直接 `executeCommand('wait')`，触发既有 P1a 输入守卫。单变量反事实保留旧测试字节，只回退生产A后同两行仍 `BAD_PAYLOAD`（29过/2失败，`world5-clock-production-counterfactual.log`；字节hash见`world5-clock-counterfactual-files.json`），因此是开工基线已有测试前提缺陷，不归因为P1d回归。仅把party行的wait通过 `submitPartyIntent` 发给真实ready成员，非party原输入与全部时钟/存读/录像/续录断言不变；完整文件加入最终复验。

15. i18n源码门禁发现5处新动态翻译无法静态证明：叙事名称改沿既有 foundation `worldText` 入口；UI拒绝原因保留已存在key检查，并用明确 namespace 前缀翻译。没有新增白名单、修改扫描器或删除翻译断言；完整i18n/UI/叙事复验列于最终门禁。
16. 旧 `ext_growth_composite_rewards` 对所有模块重写默认rules/create，触发配置身份精确守卫。旧测试字节 SHA-256 `bc2ae0a3d8be4f2093c6feeac6f7859f17031368f7c2a9b7fd98fbc8a8011e32` 在A生产同样两项失败（`growth-composite-production-counterfactual.log`），属于既有前提缺陷。只保留实际需注入的body-fixture/growth，其他descriptor保持原配置身份；奖励27/腿与clone零奖励/存读断言全部不变。
17. foundation首批48文件有3项narrative奖励测试超出60秒；没有改timeout或生产语义。首批Node25默认heap且部分时间段存在其他测试，后续以Node24/3072MiB/单worker安静环境整文件复验；环境同时变化，不能把时间差单变量归因为资源争用，也不将首批失败抹去。随后quiet整文件44过/2超时（899.14s）；macOS `pmset`证实19:25:27维护睡眠241秒、19:31:04睡眠253秒，与两条长耗时相符。19:35:17 lid/HID唤醒后另开同源同Node24整文件复验，46/46通过（219.00s），未改测试timeout。睡眠原始证据保存在`system-sleep-evidence.log`。

18. 补充旧Worker job/新名册联合探针后，build发现两处测试错误读取`GameSnapshot.world5`；改为真实`run.world5`，断言语义不变。原exit2保留为`pre-worker-snapshot-path-normal-build-final.log`，不涉及生产修复。

19. 全删九模块i18n整文件发现Game直接翻译`ext.party.roster.camp`，删除party语言包后缺键。将营地名称翻译移回party UI所有权内，Game只提供营地ID；原译文和展示语义相同，未改扫描守卫或添加全局备用键。原删除21文件批次保留，按影响仅重跑i18n整文件及静态/build，另续跑生命周期与实际缺包样本。

20. 追加驻营拆床/撤营联测首次失败在夹具选择拆墙站位：误用会拒绝实体墙目标的生物接触线判定。生产拆卸契约是可见且相邻；只修新夹具对应条件，床位、住房欠额、拒绝原子性、一次落物和退休存读断言不变。原`extra-final.log`为8文件60过/1失败，Worker新旧名册乱序联合两例及无party原字节在该批已通过；居民整文件随后15/15通过。第一次修订后14过/1失败进一步到达公开撤营拒绝：真实预检为C5_RESERVED，但既有party入口转换为INVALID_TARGET。仅修新用例同时观察透传预检和公开拒绝两层，完整snapshot/prefix断言不变；没有为测试改变生产错误契约。

21. phase6本地rounds1首试limit2在all/full被原`Invalid objective timings`守卫拒绝：两条均为growth/loot零tick创建，客观回合样本为空；classic双方已完成但不据此称四套通过。保留`perf/final-phase6-smoke`失败证据，改为最短含真实move的limit3新输出重跑，仍是短烟，不改计时守卫/阈值。

22. 新转换诊断自建rescue1第二条首次失败：工具预期BAD_ACTOR，但入队保留原生100tick间隔，重复操作先按既有守卫返回ACTOR_BUSY。这是新场景前提错误；只改capture场景名称/预期为joined-busy-rejection，继续硬验拒绝零写，不改生产/守卫。失败与修订后的工具快照身份分别保留，已完成且未受影响的A/B与AI-load测量不重写。

## 4 独立审查

[R1](party-p1d.review-r1.md)原始七项：派驻调度、growth历史收据、来源伪造、stationed profile、尾部WeakSet回滚、地图显示、实际空手伤害。修复后由[R2核心](party-p1d.review-r2.md)复读；C作者自检与独立部分明确分开。R2还发现居民来源memory须关联真实来源/终端spawnSlot、未来盟友分摊不可用历史union，已修。R2-F2后续回读还要求新damage/物理/辅助参与与kill分类取当前名册，普通盟友奖与既得历史party份额分开：已加显式historicalPartyShare，冻结资格也取当前名册；同项最后整改已由独立审阅者静态回读关闭，成长整文件2/2通过（含历史席位保留、新事实资格和普通盟友分摊hook探针）；不把hook探针当自然战斗录像。居民调度、地图、C5原因和跨格式算法差量的独立回读见 [R2集成](party-p1d.review-r2-integration.md)。R2后发现的需求移交、i18n入口和追加联测由作者修复及门禁验证；经济计数观察器与capture夹具修订亦经定向整文件验证，未开展或冒称第三轮全面独立审查。

## 5 PD-A验收矩阵

| 项目 | 自动证据/状态 |
|---|---|
| PD-A01 来源/容量 | 通过：roster12、叙事4、居民15；含满员/死亡历史/伪来源/重复与过期拒绝 |
| PD-A02 身份/能力 | 通过：同ID/HP/库存/状态、原生实际伤害差分、驻营工作/受击/自卫/中毒死亡；坠落及护送限制另列 |
| PD-A03 居民互转 | 通过：付费营地、haul/退款、离层实际需求结算/返回存读、拆床欠额、拒绝撤营/遣散/一次落物；诊断时钟与自然406事件分列 |
| PD-A04 叙事 | 通过：P+narrative真实seed移动/placement/splice、完整回放/seek/续录；满员不消费资格、往返不重发奖励 |
| PD-A05 控制/时间 | 通过：既有窗口/AI/控制影响面整文件；新增成员与驻营分别受控/原生调度，无插入已提交窗口 |
| PD-A06 原子性 | 通过：全对象图/双RNG/allocator/日志/录制前缀与阶段注错，含末尾collect/record失败 |
| PD-A07 codec | 通过：三来源自然链与诊断坏档分列；存读/seed replay/双向seek/续录；旧格式和15份真实缺包样本保活局 |
| PD-A08 Worker | 通过：生产Worker六边界原用例；新增256/257加入及512/513派驻的扣留/逆序/重复旧响应联合测试，逐域与链/活根保持；通用降级测试另过 |
| PD-A09 UI | 自动通过：UI8与13行真MainMenu所在19项；桌面/320/390视觉、触摸及真机待人工 |
| PD-A10 无party/删除 | 通过：五原字节配置、九模块实体全删、classic/extended空生命周期和真实缺包拒绝 |
| PD-A11 性能 | 最新见§6.0：三套v2 A/B完整证据齐，window/AI汇总已离线修复；均report-only。phase6 v3仍regression，待独立三轮复测 |
| PD-A12 审查交付 | R1/R2原发现及回读留档；最终源/build身份、报告/人工清单交付；R2后集成修复未冒称第三轮独立审查，已知限制待裁定 |

## 6 性能与维护者命令

### 6.0 2026-10-23 汇总修复与 D6 v3

本节为性能最新结论，覆盖下方旧“需重跑四个 suite”安排。开工 HEAD/control 与本次四个云端 run 的 B 均为 `9a05080375136fb214975157b52de82f128fe93d`，A 为 `e72cd6256daf810f89e520f1673b197d6ba6097d`。本轮只改脚本、脚本测试和文档；不改游戏代码、observer、原始 artifact、冻结预算；未 commit/push、未派发云端、未新增游戏回放或性能采样。完整本地重算证据在 `/private/tmp/p1d-d6-v3/`，小型汇总见 [party-p1d.perf-v3-summary.json](party-p1d.perf-v3-summary.json)。

**汇总器根因与修复。** `39530321117`、`39530343859` 的 `failed-log.txt` 完整错误都是 `RangeError: Invalid string length → JSON.stringify → ext-perf-common.mjs:6 → merge-party-window-perf.mjs`；外层才包装为 `AssertionError: Round aggregate failed`。36 份测量及逐输入双 oracle/语义参考在最终结果里重复嵌入，三轮累计超过 V8 单字符串上限；不是 OOS、工作量不符或性能越线。最终汇总使用 `external-measurements-v1`：保留所有指标 summary、比较结论及原始测量相对路径/SHA256，samples、完整 crossformat 帧和参考执行继续保存在原始文件。先完整校验原始 hash、save/recording、语义参考和逐帧 proof，再生成引用式报告；外层补 `verified/` 相对路径，下载后可解析。`ext-perf-common.mjs` 字节不动，避免改变冻结 observer 身份。不是捕获异常后返回成功，也没有删掉语义守卫。

离线入口 `recalculate-party-window-perf.mjs` 接收九份原 round shard，使用原读取/比较/稳定性校验链；只有两份汇总脚本允许显式提供历史字节，且其 SHA 必须等于 artifact 记录值。其余五份工具必须逐字节保持，所有原工具 hash 留存；输出另记新旧 merger hash。离线报告引用原 artifact 的绝对路径，不复制数 GB 证据，也不覆盖旧失败。新云端输出则仍复制完整原始文件、使用可搬运的相对路径。

| suite / run | 云端原结果 | 本次结论 |
| --- | --- | --- |
| party A/B v2 `39530312282` | success | 原完整 aggregate：18 对比较均 report-only，`measured-no-budget`，budget=null；无需重跑 |
| party-window A/B v2 `39530321117` | 汇总序列化失败 | 九份 shard、36 份测量、18 对 A/B、每对 2050 帧全部离线复验通过；`measured-no-budget`，budget=null |
| party-ai A/B v2 `39530343859` | 同上 | 九份 shard、36 份测量、18 对 A/B、每对 2050 帧及 AI 工作计数全部离线复验通过；`measured-no-budget`，budget=null |
| phase6 `39530302391` | hard pass / D6 regression | 原始 summary/rounds/input 与 shard hash、runner/身份、稳定计数复验；v3 **仍 regression**，all/prefix 回合 P99 中位数 +30.35% |

三套 party 均为 `party-p1c-p1d-v2`，A sourceHash=`fbb895e04212df9cc76cc983dc288eb43d21a095954ced690e18857cc1f92827`，B=`97306f6576157caa18a1fe9a0a8516670056f55079fa1af7a07a9d7ca53ea5ed`。v2 的 B-minus-reviewed-ownership 参考用于证明已登记行为差量；原生 B 的时间与生命周期保持，不拿参考时间代替 B。

各 suite 的18个**轮内**命令 P95 比率范围：party `0.98277–1.04247`，window `0.95906–1.05794`，AI `0.95346–1.06622`。window 长窗口 max 比率 `0.9478–1.0613`；AI 无该窗口标签，`longWindowMaxRatio=null` 是不适用，不能写成零成本。不同轮在不同 runner 上，只报告成对比率，不对它们的绝对时间取中位数判 D6。这些结果证明比较链完成，不代表新硬预算获批、浏览器/手机性能通过；云端两个 failure 状态仍保留。

**D6 v3。** 维护者 2026-10-23 裁定，身份 `D6-v3-2026-10-23`；详见 [统一口径](perf-d6.md)。P95/墙钟仍 +10%、最少1ms、逐轮任一越线且至少2/3判退。command.max、depth.20.max、round.p99、roundDepth.20.p99 分别取 A 三轮中位数和 B 三轮中位数，再用原 +25%/1ms 严格 `>` 阈值；单轮尾部越线只记录，不能与另一轮 P95 越线凑2/3。不是比率中位数或合并样本P99；原客观回合max仍只报告。完整工作量/前缀、runner与硬门禁均保持。

**历史 run 不追溯改判**。以下是同一批数据的新旧口径对照，不更改 GitHub 结论或6C3的 `known-tail-risk` 采纳记录，也不生成新预算：

| run / gate | 原 D6 越线轮数与判定 | v3 P95/墙钟越线轮数 | v3 尾部中位数越线项 | v3 对照 |
| --- | --- | --- | --- | --- |
| P1d `39530302391` classic/full | 1/3 pass | 1/3 | 无 | pass |
| 同上 all/full | 2/3 regression | 0/3 | 无 | **pass** |
| 同上 all/prefix | 2/3 regression | 0/3 | round.p99 **+30.35%** | regression |
| 6C3 `39028334751` classic/full | 0/3 pass | 0/3 | 无 | pass |
| 同上 all/full | 2/3 regression | 0/3 | roundDepth.20.p99 **+35.07%** | regression |
| 同上 all/prefix | 1/3 pass | 0/3 | 无 | pass |
| P1c首轮 `39338476889` classic/full | 0/3 pass | 0/3 | 无 | pass |
| 同上 all/full | 3/3 regression | 0/3 | round.p99 **+33.88%**；roundDepth.20.p99 **+38.39%** | regression |
| 同上 all/prefix | 0/3 pass | 0/3 | 无 | pass |

三批总判定均为 **regression → regression**。阻断的精确中位数（ms）：P1d prefix round.p99 `467.323738 → 609.157737`，阈值 `584.154673`；6C3 D20 round.p99 `190.074612 → 256.728573`，阈值 `237.593265`；P1c full round.p99 `442.120502 → 591.913658`、D20 `181.777705 → 251.560263`。P1d all/full 的中位数增幅分别为 command.max −1.23%、round.p99 +2.86%、depth.20.max +7.17%、roundDepth.20.p99 +19.55%，所以退出阻断；classic 原 r1 D20 P95 +14% 仍算1轮，规则未放宽。

**证据层级。** P1d/P1c 使用原 aggregate 下全部三轮原始 summary/rounds/input 重算，保留原 hard pass，不声称重新执行逐域/终态游戏回放。6C3 的 `/private/tmp/perfci-39028334751/` 本次检查只剩空目录；GitHub connector 确认 aggregate `12104508508` 未过期并提供下载，但本机 gh 网络不可达、无可用浏览器，未能恢复到本地。本次改用仓库 [既有证据](evidence/phase6c3-c4-perf-review.json) `runs.6c3.gates[].pairs` 的三轮完整精度 A/B 数值重算；其登记的原 result SHA256 为 `a24c4a0ebfc21e3e5bec121b4d81ba579215623b5302154835b9e6fa8c1f0a82`。该行是**留存指标重算，未新做原始硬门禁复验**，不是补造原 artifact；结论与精确输入均保存在本次小型汇总。

离线复现（输出须全新；v3 regression 正常退出1，结果JSON/Markdown仍生成）：

```bash
PERF_V3_OUT=$(mktemp -d /private/tmp/p1d-v3-recheck.XXXXXX)
mkdir "$PERF_V3_OUT/original-tools"
for name in merge-party-window-perf.mjs merge-party-rounds.mjs; do
  git show "9a05080375136fb214975157b52de82f128fe93d:scripts/$name" > "$PERF_V3_OUT/original-tools/$name"
done
for run in 39530321117 39530343859; do
  node --max-old-space-size=4096 scripts/recalculate-party-window-perf.mjs \
    "$PERF_V3_OUT/$run" "$PERF_V3_OUT/original-tools" /private/tmp/perfci-$run/*-r*/result.json
done
for run in 39530302391 39338476889; do
  node scripts/recalculate-ext-perf-ab.mjs \
    "/private/tmp/perfci-$run/ext-perf-$run-1-aggregate/result.json" "$PERF_V3_OUT/$run"
done
# 6C3：只计算已登记的完整指标，明确不做原始 artifact 校验。
node --input-type=module - <<'JS'
import {readFileSync} from 'node:fs';
import {decide} from './scripts/ext-perf-ab-policy.mjs';
const r=JSON.parse(readFileSync('docs/ext/evidence/phase6c3-c4-perf-review.json')).runs['6c3'];
console.log(JSON.stringify({run:r.run,scope:'recorded gate pairs only; historical verdict unchanged',
  gates:r.gates.map(g=>({id:g.id,kind:g.kind,original:g.status,...decide(g.pairs)}))},null,2));
JS
```

**仍需重跑与精确 gh 命令。** phase6 仍阻断；需要独立完整三轮验证v3下是否持续回退，不能引用本次 party success 代替，也不能把重复离线重算算作新样本。party/window/AI 的完整 v2 A/B 证据现在均已齐，不必为恢复结论再计时。若要取得“修复后 hosted aggregate 成功”的 CI 证据，window/AI 可选再派发；该云端验证本次未执行。`gh run rerun --failed` 会复用旧 control，仍含旧汇总器，不能验证修复。无需重跑已有 party success 或已有 B-only 校准，不额外追溯重跑6C3/P1c。

本次没有 commit，无法虚构新工具SHA。维护者提交/推送本轮脚本后固定一个 control ref；**A/B 测量对象继续固定原 SHA**，新 control 仅提供修复后的汇总与v3策略：

```bash
P1C_A=e72cd6256daf810f89e520f1673b197d6ba6097d
P1D_B=9a05080375136fb214975157b52de82f128fe93d
: "${CONTROL_SHA:?填写包含本轮汇总修复与D6-v3的已推送完整40位SHA}"
: "${CONTROL_REF:?填写指向该SHA的已推送branch或tag}"
[[ "$CONTROL_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
CONTROL_REF_URL=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$CONTROL_REF")
[[ "$(gh api "repos/coolking70/BrogueJS/commits/$CONTROL_REF_URL" --jq .sha)" == "$CONTROL_SHA" ]] || exit 1

gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$CONTROL_REF" \
  -f suite=phase6 -f mode=ab -f base_ref="$P1C_A" -f head_ref="$P1D_B" \
  -f base_identity=6c4 -f head_identity=6c4 -f comparison=strict -f rounds=3

# 可选：仅验证两套修复后的云端汇总发布，不是补缺 A/B 数据。
for suite in party-window party-ai; do
  gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$CONTROL_REF" \
    -f suite="$suite" -f mode=ab -f base_ref="$P1C_A" -f head_ref="$P1D_B" \
    -f comparison=party-p1c-p1d-v2 -f rounds=3
done

# 6C3 原始文件恢复后可补全原始证据复验，无需重测游戏：
C3_OUT=$(mktemp -d /private/tmp/c3-v3-raw.XXXXXX)
gh run download 39028334751 --repo coolking70/BrogueJS \
  --name ext-perf-39028334751-1-aggregate --dir "$C3_OUT/original"
node scripts/recalculate-ext-perf-ab.mjs "$C3_OUT/original/result.json" "$C3_OUT/recalculated"
```

**限定验收。** 原测试断言未修改；新增中位数/比率区分、单轮尖峰、不同尾部轮流越线、P95/尾部不混计、1ms/等号、缺轮/缺指标/伪造越线、分片离线校验与篡改拒绝、原merger字节准入、最终JSON不遍历大payload、真实两级CLI相对路径等用例。`node scripts/test-ext-perf-ab.mjs`、`node scripts/test-ext-perf-split.mjs` 与三个 party 工具测试文件 **91/91通过**（均exit0）；测试依赖检查717文件、errors=[]。原失败日志保留；本轮无游戏旧测试前提修订、基线重录或预算修改。完整命令与结果见 `/private/tmp/p1d-d6-v3/test-*.log`；仅运行相关脚本测试和测试依赖检查，未扩跑游戏测试、types/build、drift或全量。

### 6.1 云端七运行追查（2026-10-21，历史）

本节覆盖下方§6.2的旧“正式云端待派发”状态。开工/计时 B 为 `94813cf8446fafb32074c70232560d2e99ac5421`，A 为 `e72cd6256daf810f89e520f1673b197d6ba6097d`。本轮仅改性能工具、workflow、工具测试和报告；没有修改游戏生产代码、原始录像、黄金夹具、D6 政策或冻结预算，没有 commit/push/云端派发。原始七运行保留在 `/private/tmp/perfci-<runId>/`；新增证据统一在 `/private/tmp/p1d-perf-fix/investigation-20261021/`，计时源码副本为上级目录的 `A/`、`B/`（从上述 Git 对象导出，非新的提交）。

| 云端运行 | 原结果与本轮处理 |
|---|---|
| phase6 `39434786774` | hard pass、D6 regression 原样保留；all/full 2/3、all/prefix 2/3，仅尾部越线，P95/墙钟无越线。下文是诊断，不改判。 |
| party calibration `39434802284` | success；无游戏改动，本次无需为了修比较工具重新校准。 |
| party-window calibration `39434833316` | success，仍是独立 B/report-only。 |
| party-ai calibration `39434873637` | success，仍是独立 B/report-only。 |
| party A/B `39434818060` | 2 人 all 首差异 458；另有 4 人 all 首差异 896。均仅 extensions 域。 |
| party-window A/B `39434852901` | 2 人 all 首差异 324；4 人 all 首差异 569；classic 的 B-all 子进程另超时。 |
| party-ai A/B `39434887631` | 2 人 A-only 子进程超过 1200s；4 人完成9份原始测量后串行作业超出总时限，fallback 丢掉结果结构（原始4人all另有首差异342，仅extensions域）；aggregate 的 iterable 异常掩盖原始失败。 |

**机械差异：已登记的原生攻击所有权修复。** 用两侧云端原生 `.recording.json` 在各自源码上重放，导出首差异前一帧与当帧的完整 world/input。party 的第458条是整份录像的第461个事件（0基 index460，前三条为创建），actor42 提交 wait，tick22900；window 第324条（整份录像第327个事件，actor1 wait）也到达同一 tick22900。狗头人 #47 在(38,24)攻击非主队员 #42（38,25）。两条路线 A 经既有格式提升后，native、random、party、knowledge、world5、actorActions 六域与 B 一致；B 的 `extensions.modules.combat.actors` 新增 #42 的资源行，profile=`combat.second-profile`、stamina24、poise10、poiseRecoveryDelayRemaining40，其余恢复/防御字段为初始值。party combat revision 466→467，window 634→635；原有其他 actor 行不变。分歧前一帧经格式提升后完整相等。

根因是 `NativeAttackTransaction.owns()`：P1c 只承认主玩家和 monsters，漏掉非主队员，导致原生命中后的 `settleNativeMeleePoise` 所有权校验提前返回。P1d 将当前层活的 `nativeAllyActors` 纳入，因此 `applyActorPoiseDamage` 正确把隐式满韧性12减为10，登记40tick恢复延迟并递增revision。这是 [P1d source audit](party-p1d.source-audit.md) 已明确记录的“世界所有权同时纳入真实在场party盟友，以保留stamina/parry/poise守卫”；不是招募命令、F4闪电穿透、随机数或未知玩法回退。既有 combat 资源定义本来就要求 nativePoiseDamage2/poiseCapacity12/recoveryDelay40，不应为比较成功撤销修复。

单变量反事实：仅在仓外 B 副本将该行恢复为 P1c 的 `actor === game.player || monsters.includes(actor)` 等价原表达式，同 seed42/2人/all/458输入重新执行并通过自身存读/seed replay，combat 完整状态精确复现 A（`counterfactual-party.json*`）；随后将副本恢复为 HEAD 原字节。所有原始失败和前后状态均保留。另逐帧检查云端已有的20份完整all配对，每份2050帧；多成员均只在上述首差异后出现extensions域差异，其余六域全程一致，一人成对结果全程一致（`cloud-complete-domain-audit.json`）。这些配对的最终存档经提升后，extensions差量也仅为combat revision和新增非主队员资源行；原有actor行及相对顺序、其他module/components均一致（`cloud-final-extension-audit.json`）。这不代替逐输入的单变量归因；4人额外报错以及2049输入完整反事实验证见本轮运行记录。

**比较身份改为 `party-p1c-p1d-v2`。** v1 只覆盖格式变化，不能继续拿它冒称机械等价。v2 保留 A/B 原生计时、每输入全域摘要和各自完整 save/load/seed replay/seek；多成员 party-all 另建一次 B 的隔离诊断副本，唯一允许变化是上述 `owns` 一行。完整原文件 SHA-256 必须为 `35085cc348d972dbfe389371df56e4c58a7e0b913469972a89f322bff32d2c6c`，回退后为 `ddbbbde62071ac55172fb1024b515fa16fec5d8e0cb4e222b75bd74466bd06de`，逐文件清单断言除此之外无任何差量；副本也独立运行原生生命周期。A 经原格式提升后的**每个完整域**必须精确等于该副本，B原生与副本的输入、HP/位置等工作行、随机数、ticks、AI计数等仍须相等。未知其他差异继续失败，没有删 combat 域、忽略revision/资源字段或重写原生检查点。全部原生配对结束后才执行参考，不在BA两侧之间插入额外负载；参考执行的时间不进入 A/B 比率；参考原始measurement/save/recording及hash随工件交付并在merge重验。此协议说明“除审核过的所有权修复外等价”，不是声称原生 A/B 机械摘要相等。

**超时及汇总。** calibration 的 one-actor party 最慢约450s，而加入逐输入两次 full oracle 的 cross-format 已到1142s；window one-actor all 的 A 为1187s、B在1200s被杀。AI四人 cross-format 单子进程已到2358s，12个原生A/B子进程即可能超过360分钟，单独提高子进程timeout不能解决。现在 A/B 的 party/window 每个进程给30分钟，AI按1/2/4人给30/30/60分钟，包含SSR、计时、proof及完整生命周期，均不是性能阈值。

party三个suite的A/B按人数×轮次拆作业（B-only校准保留原同机三轮）；每一对 A/B 仍同机同Node，global round1/2/3保持AB/BA/AB，不能把每个slice误作round1。每job最多4个原生子进程加1个参考子进程，最坏5×60=300分钟，留出原360分钟job预算内的余量。B-only window/AI没有跨格式oracle，保持原20分钟及20/20/40分钟子进程预算，六个四人AI子进程最多240分钟，同样低于345分钟step上限。合并要求三人数×全部请求轮数、每个slice完整结束、原始hash/生命周期、工具/源码身份及逐对工作量全部通过。不同轮可来自不同runner，逐轮node/CPU绑定保留；只在显式round-sharded协议下免除跨轮机器相等，旧未拆轮入口仍保留原守卫。不得将不同runner的绝对耗时直接作A/B对比；拆轮A/B中的B绝对耗时及预算建议也只作带环境信息的诊断，不能替代同机B-only calibration后批准的预算。该拆分只用于report-only party，phase6/D6的同机多轮流程不变。

`readShard` 在遍历前验证status和runs数组，优先报告已有error或running等未完成状态，缺数组单独说明；整job被取消而未留下error时，仍须结合job timeout日志。workflow不再用fallback覆盖已有partial result。缺片、缺轮或原生错误都仍失败，不能因“健壮性”变成空样本通过。

工具测试的旧前提另做单变量反事实：保持HEAD三个旧测试文件原字节，配新工具为80过/3失败；仅回退工具/workflow后83/83通过（`guard-old-tests-{new,old}-tools.log`，旧测试hash见`guard-old-test-identities.json`）。三处是本任务授权调整的子进程timeout数值、AI单job预算和新增工具的精确provenance清单；超时必须失败/保留诊断、总预算不得超过job上限、缺工具或字节漂移必须拒绝等断言语义均保留。新增语义参考/缺轮/重复轮/身份漂移/不完整报告的负例另计。复验曾因workflow合并了两条参数追加语句触发原源码守卫，已拆回原语句形式，未改该守卫。

**本地无party完整配对。** 同一份云端A的all/full录像，2423输入、2549客观回合、D20样本570；已核对云端all/prefix输入JSON与它完整相同，因此复用一个冻结输入进行诊断，未把它冒称两个独立样本。Apple M5 / Darwin arm64 / Node v24.19.0 / heap3072MiB，按AB、BA、AB串行执行，计时期间没有并行测试或本任务其他性能进程。使用原observer的仓外副本，仅增加命令/GC开始时刻和导出候选的sourceHash读取，新增时间戳排除在语义hash之外；首份启动后给队列加入SSR boot前的等待闸，用于在测量间隙执行脚本复验，故部分配对之间有间隔。等待不在任何计时区间内，测量区间和检查点不缩短、不抑制；差量及最终observer hash见`tail-observer.patch`、`tail-observer-identity.json`。源码A/B分别1530/1551文件与Git src tree逐字匹配（`candidate-src-identity.json`）；导出目录没有.git，原runner的commit字段为null，以该独立Git对象核对和measurement.sourceHash绑定，不伪造提交身份。

| 轮次/执行顺序 | 墙钟B/A | command.P95 | round.P95 | round.P99 | D20 round.P99 | D20 command.max |
|---|---:|---:|---:|---:|---:|---:|
| 1 / AB | −0.34% | −0.15% | −1.45% | −15.57% | +0.42% | +0.60% |
| 2 / BA | −2.73% | −4.22% | −2.52% | −12.42% | −4.54% | −3.97% |
| 3 / AB | +0.52% | +0.35% | +0.31% | +48.93% | +57.50% | +28.48% |

三轮A墙钟450.117/466.148/473.815秒，B为448.567/453.432/476.301秒。两侧均有随运行顺序的墙钟漂移，未采集温度/频率，因此仅解读轮内配对，不以跨轮绝对时长推出版本因果。全部配对的最终state、逐事件域/检查点域、双RNG、非计时工作行、253375客观ticks及所有计数一致；例如collectExtensionComponents4794次、objectiveTimeBlock2549次、combat checkpoint148次、resident checkpoint145次。完整数据见`tail-{1,2,3}-{A,B}.{summary,rows,rounds}.json`及`tail-analysis.json`。这是一条路线的三轮诊断，不是执行全部D6分片后的新正式裁决。

第三轮本地也出现尾部越线，不能删除它只选前两轮。它展示了秩敏感性：D20相对固定的慢回合在输入1993/2285/2399；A3另有2094约391ms的一次尖峰，B3额外尖峰在2233/2344/2403，约420/404/407ms，使第6大从102.17ms移到160.92ms。全程P99由A3的输入453、244.47ms跳到B3的输入769、364.09ms（后者处在原有D10慢回合簇内）。同一输入769自身的A3/B3回合为360.2/364.1ms，仅约+1.1%，体现了P99取样秩跨簇的放大；D20最大命令则是B3输入2048的full checkpoint1661.10ms，A3的最大值1292.89ms。未经GC观测的wall运行不能把这些具体尖峰直接标成GC。

**独立GC观测与结论。** 正常wall三轮结束后，再串行执行B、A两份`--gc`完整录像，未将观测耗时混进上述配对。A/B分别15103/15112个GC事件，major GC 53/52次；事件duration总和21.857/21.903秒，分别为测量墙钟的4.572%/4.577%，最大单事件280.07/257.40ms。这是事件时长比例，不是独占CPU占比，也不是分配字节数。八份完整运行的语义、工作量及关键调用计数均相同。

按命令区间关联GC：B观测中D20输入2219/2281的客观慢回合约427/442ms，其所在命令与GC重叠约265/271ms；A的最后一条full checkpoint输入2423也达到1680.85ms，其中GC重叠300.60ms。GC位置在两侧及不同运行中移动。关联是命令级时间重叠，不能把多回合命令的全部GC独占归给某个客观回合，更不能从独立观测反推云端或wall第三轮的逐事件原因。原始`tail-gc-{A,B}.{gc,gc-overlap,summary}.json`和`tail-analysis.json`保留。`caffeinate`贯穿批次；05:23读取的当日pmset日志401条，无Sleep/Wake/DarkWake事件（`power-log-20261021.log`、`sleep-audit.json`），但这不证明其他后台进程完全没有争用。

**判断：现有证据支持尾部波动/分位数秩效应主导，尚未定位到P1d在无party路线的稳定新增热路径。** 同一源码自身三轮的round.P99最大/最小，A为1.39倍、B为1.70倍；配对前两轮尾部下降，第三轮尾部单独跳升，而墙钟/P95稳定，独立GC总量近似。这与6C3及P1c首次/复测的历史相符，不能据此证明所有云端回退都是GC，也不能排除云端CPU特异性或小幅新增分配。F4相关静态复核中，`boltStoppedByDeath`无party直接走原死亡判断；`nativeAllyActors`返回原activeControlledActors路径，`ActorCombatResolution`无party不构造新增Set。TimeCoordinator等处仍有新增条件/空集合表达式，未宣称“零开销”。没有可重复归因支持新的生产优化，因此本轮不改生产；原云端D6 regression保持，待下列同输入云端复测。

**完整 rounds=1 工具验收已完成。** 使用最终冻结工具和上述 A/B 源码，party、party-window、party-ai 各跑1/2/4人三个分片，全部2049输入；共36份原生执行、6份独立单行反事实执行、18组成对比较，每组包含初始帧及全部输入的2050帧。原生及参考的 save/load、seed replay、seek 全通过，三个suite各6组比较均成功汇总为 `smoke-only`，三个批次退出码均为0。没有 ETIMEDOUT、未知机械差异或 iterable 异常；rounds=1 仍不构成正式三轮性能通过或新预算。

| 完整本地 all 路线 | 1人首差异 | 2人首差异 | 4人首差异 |
|---|---|---:|---:|
| party | 无 | 458 | 896 |
| party-window | 无 | 324 | 569 |
| party-ai | 无 | 303 | 342 |

表中是A经格式提升与**原生B**的差异，未被覆盖；多成员全程差量均仅在extensions域，其余六域相同。六份完整参考分别仅回退已审核的所有权行后，与A提升后的所有域及root逐输入精确相等，覆盖了原云端未完成的AI双人路线。原始measurement/save/recording及hash通过正式merge重验。证据为 `full-{party,window,ai}-{classic,all-full,all-prefix}/`、`full-{party,window,ai}-merged/`、`full-final-audit.json` 和 `full-batch-exits.txt`；命令保存在 `full-party.sh`。最终13项工具/workflow哈希见 `final-tool-snapshot.json`，对应可运行控制工具副本为 `full-tools/`，验收结束时仓内工具字节仍与该快照一致。

这三套工具验收在无party串行wall/GC批次结束后并行启动，suite内按分片串行；其耗时仅用于确认执行/超时/汇总链路，不进入无party性能结论。早期 `smoke-*` 的steps=2结果仅保留作工具调试证据，不替代本次完整路线。最终三个脚本测试文件 **88/88通过**（`tools-final-calibration.log`），测试依赖检查717文件、errors=[]（`dependencies-final-calibration.log`）；workflow通过PyYAML解析，`git diff --check`通过。没有修改游戏生产代码，因此按本任务限定未扩跑boundary/vue-tsc/build或重录无party字节夹具。

**历史与尾部判定边界。** 本次云端 all/full 三轮的 command.P95 为 +0.47/+0.55/+0.29%，墙钟 +0.07/+0.51/+0.09%；round.P99 却为 +56.54/−16.90/+15.84%，D20 round.P99 为 +49.64/−4.31/−32.95%。all/prefix 的 round.P99 为 +32.96/+61.12/+10.75%。D20 只有570个客观回合，P99实际取第6大的样本；全程2549个回合则取第26大。full 的 D20 >500ms 回合数 A=0/3/2、B=2/2/1，尖峰位置有漂移，也有重复，不能把每次尖峰都先验认作随机或GC。

[6C3报告§12](phase6c3.report.md) 的 `39028334751` 已出现 hard pass、P95/墙钟稳定而少量尾部移动的情形，接受的是明确的 known-tail-risk，不是自动改判；[P1c报告](party-p1c.report.md) 的首次 `39338476889` all/full 3/3越线，复测 `39361213080` 为1/3，重新按原D6汇总后通过。P1c历史A/B是72aa412→006cd7d，不能把它的绝对值当成本次e72cd62→94813cf的配对基线；其受Maintenance Sleep污染的本地剖析也不复用作有效计时。本次原始尾部位置/分位数整理在 `cloud-tail-audit.json`。

更稳健的后续口径建议：保留当前D6原裁决，附报每轮配对比率、分位数实际秩、超过固定时长的样本数及输入位置；对尾部独占的回归追加一批独立三轮配对，两个批次各自保留原D6裁决，并按整轮/连续区块评估不确定性，避免把同一录像的相关回合当独立样本。供另行批准的候选规则是要求同一尾部指标跨独立批次重复越线，并结合经同版本复测校准的绝对毫秒差下限；应区分同指标持续变慢与不同尾部指标轮流触发，正式门禁的数值和批次数均不在本轮擅定。若需要提高D20样本量，应另立更长路线身份及预算，不能拼接现有轮次后改算P99，或悄悄提高当前阈值。这些仅是待批准建议，本轮未修改D6算法、阈值或历史结论。

**维护者需重跑的精确命令。** 仅四个失败/待复核suite；三个已有success的B校准保留为旧HEAD/sourceHash的原始证据，不改署名为新提交的校准或预算。以下 SHA 是维护者提交并推送**本轮工具修改之后**的真实 HEAD，不能用开工94813cf代替，或把未提交工作区当远端head。control与head均取该提交；先校验远端branch/tag解析值，期间若ref移动应停止重新固定。

```bash
P1C_A=e72cd6256daf810f89e520f1673b197d6ba6097d
: "${P1D_SHA:?填写维护者提交并推送本轮修改后的完整40位SHA}"
: "${P1D_REF:?填写指向该SHA的已推送branch或tag}"
[[ "$P1D_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
P1D_REF_URL=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$P1D_REF")
[[ "$(gh api "repos/coolking70/BrogueJS/commits/$P1D_REF_URL" --jq .sha)" == "$P1D_SHA" ]] || exit 1

gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$P1D_REF" \
  -f suite=phase6 -f mode=ab -f base_ref="$P1C_A" -f head_ref="$P1D_SHA" \
  -f base_identity=6c4 -f head_identity=6c4 -f comparison=strict -f rounds=3
for suite in party party-window party-ai; do
  gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$P1D_REF" \
    -f suite="$suite" -f mode=ab -f base_ref="$P1C_A" -f head_ref="$P1D_SHA" \
    -f comparison=party-p1c-p1d-v2 -f rounds=3
done
```

新party工件为 `ext-perf-<runId>-<attempt>-<classic|all-full|all-prefix>-r<1|2|3>`；aggregate统一调用 `merge-party-rounds.mjs` 后再执行原专用merge，不再把其中三份当完整三轮。phase6工件名称和merge保持原样。派发后的本地复核例（每个suite分别填其run ID、使用全新输出目录）：

```bash
: "${RUN_ID:?填写某一个party suite的运行ID}"
ATTEMPT=$(gh api "repos/coolking70/BrogueJS/actions/runs/$RUN_ID" --jq .run_attempt)
gh run download "$RUN_ID" --repo coolking70/BrogueJS --dir "/private/tmp/perfci-$RUN_ID-recheck"
parts=()
for shard in classic all-full all-prefix; do
  for round in 1 2 3; do
    parts+=("/private/tmp/perfci-$RUN_ID-recheck/ext-perf-$RUN_ID-$ATTEMPT-$shard-r$round")
  done
done
node scripts/merge-party-rounds.mjs "/private/tmp/perfci-$RUN_ID-verified" "${parts[@]}"
```

### 6.2 首次实施阶段性能（历史证据，保留）

本节数值、协议v1和派发命令均为历史记录；本轮重跑使用§6.1的v2命令。

本地性能已完成；正式云端派发仍由维护者执行。本节所有数值是 Apple M5 / Darwin arm64 / Node v24.19.0、heap 3072 MiB 的单机诊断与短路线工具烟测，未设新硬预算，未宣称完整 D6 或稳定云端回归结论。全部原始 JSON/日志位于 `/private/tmp/party-p1d/perf/`。

**身份及运行条件。** A 为真实 Git 源 `e72cd6256daf810f89e520f1673b197d6ba6097d`（其 src 与任务 HEAD 3431533 相同），src snapshot `41f66ffe6a1fd82e0cfffe9c97bdb5f4f263c92636edb2d79fa5e5cac4ed66ac`。B 是未提交工作树副本，src snapshot `48b0ef8fd318d114f04150fde5f4586547782abcbd127eb598135b40c3162679`。保留两个不可变计时副本：

| 副本 | 完整候选 SHA-256 | 使用范围 |
|---|---|---|
| `b-timed` | `820e6bdcddb002312d7b49442b869fcc157e214d7fa4d6873e99c723283b4381` | phase6、三 party 套件、AI load、321/641 窗口 |
| `b-roster-timed` | `ac2cec32619e01c03f11ce770a81994775ea54152a90352355ee990ed8c5bf43` | 修正捕获前提后的九转换场景 |

两副本 src 相同，唯一工具差量是捕获器拒绝码前提（见首次失败）。完整文件/工具哈希见两份 `*.identity.json` 和各结果 `tools`；证据清单见 `final-evidence-manifest.json`。功能门禁结束且 root quiet marker ready 后才串行计时。北京时间 **2026-10-20 19:56:10.644–20:11:58.161** 全测量区间内，pmset 原始日志没有跨越实际 Sleep/Wake/DarkWake 事件；最近前次 Wake 为 19:35:17。`sleep-validity.json` 保留解析结果；不能把日志 Assertions 内的 MaintenanceWake 字样误算睡眠。计时进程现已全部终止。

| 已执行项目 | 实际规模 | 结果/范围 |
|---|---|---|
| 非 party phase6 | rounds=1，classic/all；limit=2 首失败后最小有效 limit=3 | limit=3 的 6 observer 记录、3 对比及 C1/C4 补充通过 hard；状态仍 `incomplete` |
| party / party-window / party-ai | 各 3 shards，1/2/4 人 × only/all × A/B，rounds=1、steps=2；共 36 测量 | 各独立 merge 为 `smoke-only`，各 6 对比；原生存读/回放/seek 与机械验证通过 |
| AI 负载 | 1/2/4 人，各 32 窗口 × 0/8/16 原生同伴 | 各 case 3200 ticks，OOS=0，原生 save/load/seed replay/seek 通过 |
| 名册转换 | 9 场景，13 输入，10 成功、3 拒绝 | 全部 0 ticks；10 transfers；存读、快照 replay/seek、生产 Worker checkpoint、无插桩复跑通过 |
| 4 人 all 窗口归因 | 641 输入、24230 ticks | OOS=0、previewPollution=0，五档及中断/分相路径均实际命中 |

跨格式烟测显式使用 `party-p1c-p1d-v1`，默认 strict 未放宽。只接受枚举的 F/S/R/O、party schema/version、创建来源与空新增字段差量；保留两侧原生 full 与生命周期，再逐输入比较定向提升后的完整 domains。RecordingDigest 的两处 stationed 遍历采用审核后的定向算法身份，其他算法保持原字节；每帧要求 stationed 及 stationedNative 为空。未知差量仍拒绝。steps=2 只证明工具链，不能外推长路线性能。

**641 输入窗口。** 测量 wall=24.524 s，另行机械验证 wall=24.077 s。下表单位 ms；小桶 n=1/2/7 的 P95/P99 是实际样本分位数，不是稳定尾延迟估计。

| 实际桶 | n | P50 | P95 | P99 | max |
|---|---:|---:|---:|---:|---:|
| single:single | 622 | 21.118 | 31.753 | 37.637 | 78.834 |
| fine:fine-action | 3 | 99.506 | 124.454 | 124.454 | 124.454 |
| 100:budget | 1 | 106.625 | 106.625 | 106.625 | 106.625 |
| 300:budget | 1 | 264.272 | 264.272 | 264.272 | 264.272 |
| 1000:budget | 7 | 849.949 | 859.032 | 859.032 | 859.032 |
| auto:budget | 2 | 847.455 | 847.455 | 847.455 | 847.455 |

| 实际调用层 | 调用次数 | 总 wall ms | 每调用 P95 ms |
|---|---:|---:|---:|
| capture | 974 | 14584.311 | 16.804 |
| vision | 1939 | 2715.569 | 3.718 |
| scheduler | 971 | 2740.158 | 10.369 |
| stats | 144308 | 1982.587 | 0.043 |
| recordMain | 641 | 1031.173 | 2.550 |
| environment | 242 | 264.186 | 1.276 |
| npc | 2517 | 225.448 | 0.200 |
| restore | 1 | 27.227 | 27.227 |
| validation | 1946 | 9.367 | 0.011 |

剩余热点是反复捕获全图状态（974 次/14.584 s），其次是视野、调度与高频属性查询；单独移走 full oracle 并不足以消除这些成本。这是调用量与计时共同支持的局部归因，各层含嵌套，不能相加或把占比当互斥 CPU 分账。GC 1577 次/3.192 s（P95 3.009 ms，max 6.805 ms）也与输入/层计时重叠。19 次真实 Worker compute 为 40.909–63.439 ms，峰值 2 jobs/7,959,682 bytes、6 次饱和；两次 producer boundary 主线程耗时 12.342/11.846 ms。独立显式探针 n=8 的 projection/full/encoding P95 为 5.978/45.300/6.408 ms，不能再加进输入耗时。1000/auto 约 850 ms 对应更大工作量，不能与 single 当同工作比较。此路线 AI 层调用为 0，AI 由下项单独覆盖。

该长路线 save=2,818,509 bytes、recording=826,946 bytes；RSS 起止约 611→1190 MB、heapUsed 339→296 MB，仅端点值，不能证明峰值或泄漏。process CPU=37.085 s 包含 Worker 线程，不能称主线程 CPU。无浏览器帧率或设备交互测量。

**AI 分层。** 独立纯策略输入为 100×100 已知地板、已知视野外不可达 leader(500,500)，并非自然地图规模声明；1/2/4 人分别 32/64/128 调用、131072/262144/524288 nodes，全部 4096-node budget fallback，RNG 不变。每次调用 P95 为 2.692/2.741/2.468 ms。实际原生同伴 arena 在录制 origin 前建立，原生 seed replay/seek 可复验；每 case 32 个 100-tick 窗口。

| 人数 | 同伴数 | 输入 P95 ms | AI view+decision 每调用 P95 ms | 原生同伴每调用 P95 ms | 独立 full 探针 P95 ms |
|---|---:|---:|---:|---:|---:|
| 1 | 0 / 8 / 16 | 60.080 / 92.715 / 131.768 | 4.806 / 4.228 / 4.441 | — / 6.076 / 6.143 | 32.369 / 32.685 / 32.666 |
| 2 | 0 / 8 / 16 | 75.036 / 110.191 / 144.985 | 3.821 / 3.805 / 4.585 | — / 6.139 / 5.935 | 32.416 / 32.382 / 32.872 |
| 4 | 0 / 8 / 16 | 122.835 / 153.860 / 192.718 | 4.656 / 4.808 / 4.841 | — / 5.996 / 5.992 | 33.035 / 32.910 / 32.946 |

同伴原生决策次数分别 0/264/528，随同伴数增长；full 探针约 32–33 ms 相对稳定，输入耗时上升同时伴随受控 actor 和同伴工作增加。每调用分位数与每窗口分位数不可直接相加，独立 full/projection/encoding 探针在输入区间外。每命令采样 heap 峰值约 473–767 MB、RSS 757–1117 MB，非连续峰值；save 1,746,019–1,822,374 bytes、recording 74,779–100,516 bytes。此诊断不冒充自然游玩或正式 party-ai-v1 回归阈值。

**九转换与实际经济工作。** 三来源使用自然 captive/narrative 捕获与真实付费居民捕获；计时入口是 SHA 绑定的快照，明确 `seedReplay:false`，不冒充从种子计时。救援 1/2/4 人另有显式诊断 fixture。以下输入均 n=1，所以 P50=P95=P99=max，单位 ms。

| 场景/输入 | 输入 ms | full 探针 ms | Worker algorithm ms |
|---|---:|---:|---:|
| captive-before-join-join/captive-before-join-join:success | 112.424 | 117.731 | 256.186 |
| narrative-before-join-join/narrative-before-join-join:success | 68.694 | 77.323 | 175.102 |
| rescue-1/rescued-goblin-join:success | 40.833 | 39.546 | 94.867 |
| rescue-1/joined-busy-rejection:rejection | 0.131 | 38.540 | 79.697 |
| rescue-2/rescued-goblin-join:success | 40.439 | 40.952 | 94.855 |
| rescue-2/joined-busy-rejection:rejection | 0.125 | 38.923 | 78.902 |
| rescue-4/full-roster:rejection | 0.528 | 40.103 | 95.325 |
| resident-before-join-join/resident-before-join-join:success | 42.509 | 39.148 | 89.487 |
| resident-before-join-roundtrip/station:success | 42.991 | 38.624 | 89.150 |
| resident-before-join-roundtrip/rejoin:success | 34.013 | 36.991 | 72.876 |
| resident-with-ticket-join/resident-with-ticket-join:success | 43.548 | 37.764 | 88.987 |
| resident-with-ticket-roundtrip/station:success | 38.605 | 37.247 | 88.382 |
| resident-with-ticket-roundtrip/rejoin:success | 33.048 | 38.026 | 73.113 |

居民入队/往返共实际 settleResidentNeeds=6 次、validated needs plan=6 次、planner 输入 resident rows=4、cancelResidentWork=4 次、选中取消 job rows=1、retireBundle=1 次；economic epoch intervals=0。持货入队命中上述唯一 job+bundle 回滚；捕获时 residentJobs=1/actionBundles=1，world5 tickets/orders 实际为 0，不混称 world5 票据。救援/叙事这些经济调用均为 0。计数来自工具内存 transform 的唯一审核锚点，源/插桩 SHA 保存在 JSON；仅测量命令期间启用，并用无插件引擎逐输入 full 对照通过。计时含少量计数开销，不进入正式 A/B。拒绝输入 full/RNG/allocator/prefix 零写断言保持。居民反复恢复前提所需等待在捕获阶段，未混入 0-tick 命令桶。

自然 captive save 约 5.44 MiB，明显大于约 1.76–1.86 MiB 的其他诊断小局，full 与 Worker 成本也更高；这提示全图大小成本，n=1 且独立 Worker 包含冷初始化，不能推导稳态线性模型。这里的 Worker 是真实生产 checkpoint 计算，完整异步 live-recording 竞态仍以功能门禁为证。

**首次失败及保留证据。**

- `final-phase6-smoke` 的 rounds=1/limit=2 在 all 的两个零 tick 创建输入后没有 objective rounds，原守卫报 `Invalid objective timings`。classic 两输入对比已过；改为最小 limit=3 才形成真实移动回合，保留原失败，未改 guard，仍不是 D6 pass。
- 原 `final-roster-rescue-1.log` 第二输入预期 BAD_ACTOR，实际 ACTOR_BUSY：原生救援对象刚加入仍有 100 tick recovery，现有就绪守卫先执行。仅修捕获器前提为 `joined-busy-rejection`/ACTOR_BUSY；原 B1 不改，创建 B2，整文件 26 测试通过后重跑全部九场景。生产、拒绝零写断言不变。
- 321 输入成功但实际 100/300 被首轮特殊输入占位，覆盖不齐；保留其结果并补 641，第二轮实际命中两桶，未把命令参数当覆盖证据。
- 早期一次 Vitest `--minWorkers` 不受 v4 支持，启动即失败，改为 `--maxWorkers 1`；旧工具测试单变量反事实：新工具+旧测试 42/44，回退仅工具生产文件后 44/44。AI 接受 A/B 的旧禁止性断言按已裁定 PD7 更新，不能归为纯前提修复。最终三工具文件 82 tests 通过；后来新增计数/捕获前提所在整文件分别 26/26 通过。
- SSR 初始化日志的 HMR 端口 `listen EPERM 0.0.0.0:24678` 是环境警告；实际 SSR、Worker 和生命周期检查成功，未作为忽略失败的理由。早期 Node24 未找到及 DNS 限制已由本地缓存 v24.19.0 解决，全最终运行没有绕版本守卫。

**精确命令与剩余派发。** 以下是已执行的命令文件，保留原参数、日志重定向与先后顺序；首文件在原 rescue-1 前提失败处停止，后续由第二文件完整重跑九转换。重现应换新的输出目录，以免覆盖证据。

```bash
bash /private/tmp/party-p1d/perf/final-local-smoke-commands.sh
bash /private/tmp/party-p1d/perf/final-roster-retry-commands.sh
cd /private/tmp/party-p1d/perf/b-timed
NODE_OPTIONS=--max-old-space-size=3072 /Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/profile-party-window-perf.mjs /private/tmp/party-p1d/perf/final-window-layered-4-all-641.json party-all 4 641 windows
```

完整四 wrapper 命令、正式三套 party 校准/跨格式回归、非 party phase6 回归，以及按真实 artifact 名下载和正确 merge 的精确 `gh` 命令见下列已核对 workflow/CLI 的维护者命令（外部副本 `maintainer-commands.md`）。`P1D_CONTROL_REF` 必须为真实已推送 branch/tag，远端解析必须等于真实 `P1D_CONTROL_SHA`；候选 SHA 同样须先推送验证。没有实际派发、commit 或制造候选 SHA。正式 2049 输入/3 rounds 与云端校准仍待维护者侧执行；短烟测不替代正式时间预算，原 phase6 档位与阈值不变。

P1d 性能工具/派发命令（未派发正式云端；无 commit）

A 固定为 `e72cd6256daf810f89e520f1673b197d6ba6097d`。`git diff e72cd62 3431533 -- src` 为空，故该 A 的生产源码与开工源相同；不能引用旧 phase6 run 39361213080 的 B=006cd7d 为该 A 的测量。最终 B 与 control 必须在维护者提交后填写真实完整 SHA；`gh workflow run --ref` 使用已推送的真实 branch/tag 名称，并先解析校验它等于 control SHA。推荐固定 tag 避免派发间分支移动；当前未提交工作树不是可派发 ref。

```bash
P1C_A=e72cd6256daf810f89e520f1673b197d6ba6097d
: "${P1D_CANDIDATE_SHA:?请先填写已推送的最终P1d完整40位SHA}"
: "${P1D_CONTROL_SHA:?请先填写包含已审性能工具的已推送完整40位SHA}"
: "${P1D_CONTROL_REF:?请填写指向上述control SHA的已推送branch或tag名称}"
[[ "$P1D_CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ && "$P1D_CONTROL_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
P1D_CONTROL_REF_URL=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$P1D_CONTROL_REF")
[[ "$(gh api "repos/coolking70/BrogueJS/commits/$P1D_CONTROL_REF_URL" --jq .sha)" == "$P1D_CONTROL_SHA" ]] || exit 1
[[ "$(gh api "repos/coolking70/BrogueJS/commits/$P1D_CANDIDATE_SHA" --jq .sha)" == "$P1D_CANDIDATE_SHA" ]] || exit 1
```

非 party 正式 D6（6c4/6c4，limit=0默认；三分片、三轮A/B及工具内独立B验证）：

```bash
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$P1D_CONTROL_REF" \
  -f suite=phase6 -f mode=ab -f base_ref="$P1C_A" -f head_ref="$P1D_CANDIDATE_SHA" \
  -f base_identity=6c4 -f head_identity=6c4 -f comparison=strict -f rounds=3
```

三套 party B 校准（各自1/2/4×only/all、2049输入、三轮，report-only）：

```bash
for suite in party party-window party-ai; do
  gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$P1D_CONTROL_REF" \
    -f suite="$suite" -f mode=calibration-only -f head_ref="$P1D_CANDIDATE_SHA" \
    -f comparison=strict -f rounds=3
done
```

三套 party P1c→P1d 正式跨格式比较（同样2049输入、三轮；不是上述B校准的替代名称）：

```bash
for suite in party party-window party-ai; do
  gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$P1D_CONTROL_REF" \
    -f suite="$suite" -f mode=ab -f base_ref="$P1C_A" -f head_ref="$P1D_CANDIDATE_SHA" \
    -f comparison=party-p1c-p1d-v1 -f rounds=3
done
```

工具仅冒烟云端派发时将 `rounds=3` 改为 `rounds=1`；workflow 仍运行2049输入，结果必须是 smoke-only，不能称三轮性能通过。用户本次仅要求本地完成此云端工具链的rounds=1冒烟，正式派发由维护者执行，以上命令本轮未运行。

下载和独立重算（分别填写每次run的数值ID与attempt；旧证据不得覆盖；重算命令在与该run相同的`P1D_CONTROL_SHA`检出目录执行，汇总器会拒绝工具字节漂移）：

```bash
: "${PERF_RUN_ID:?填写本次run的数值ID}"
: "${PERF_ATTEMPT:?填写本次run attempt，通常为1}"
: "${PERF_SUITE:?填写该run实际suite：phase6/party/party-window/party-ai}"
[[ "$PERF_RUN_ID" =~ ^[0-9]+$ && "$PERF_ATTEMPT" =~ ^[0-9]+$ ]] || exit 1
gh run view "$PERF_RUN_ID" --repo coolking70/BrogueJS --json url,headSha,status,conclusion,jobs
[[ "$(gh run view "$PERF_RUN_ID" --repo coolking70/BrogueJS --json headSha --jq .headSha)" == "$P1D_CONTROL_SHA" ]] || exit 1
[[ "$(git rev-parse HEAD)" == "$P1D_CONTROL_SHA" ]] || exit 1
PERF_DOWNLOAD="/private/tmp/party-p1d/cloud-${PERF_RUN_ID}-${PERF_ATTEMPT}"
ARTIFACT="ext-perf-${PERF_RUN_ID}-${PERF_ATTEMPT}"
[[ ! -e "$PERF_DOWNLOAD" ]] || exit 1
gh run download "$PERF_RUN_ID" --repo coolking70/BrogueJS --pattern "$ARTIFACT-*" --dir "$PERF_DOWNLOAD"
case "$PERF_SUITE" in
  phase6|party)
    node scripts/merge-ext-perf-ab.mjs "$PERF_DOWNLOAD/recomputed" \
      "$PERF_DOWNLOAD/$ARTIFACT-classic" "$PERF_DOWNLOAD/$ARTIFACT-all-full" "$PERF_DOWNLOAD/$ARTIFACT-all-prefix"
    ;;
  party-window|party-ai)
    node scripts/merge-party-window-perf.mjs "$PERF_DOWNLOAD/recomputed" \
      "$PERF_DOWNLOAD/$ARTIFACT-classic/result.json" "$PERF_DOWNLOAD/$ARTIFACT-all-full/result.json" "$PERF_DOWNLOAD/$ARTIFACT-all-prefix/result.json"
    ;;
  *) exit 1 ;;
esac
```

云端时限分层保持原值：workflow job为360分钟、实际运行step为345分钟；单场party/window为1200000ms，AI四人为2400000ms。四人分片两配置×A/B×三轮共12场，其单场timeout最坏合计480分钟，大于job上限；这不是保证整片能在最坏情况下完成。若正式运行超时，必须保留timeout/signal/elapsed及缺片结论，不得按已有部分结果判通过。本轮未提高这些上限。

跨版比较协议：默认 strict 路径逐项检查 input/rowsHash/双RNG/full oracle/计时与工作量，AI另查calls/nodes/acceptedDecisions/budgetFallbacks/cacheHits。`party-p1c-p1d-v1`是显式前向适配：由 B 真实registry产生每种人数/模块的目标manifest；WorldCanonical.ts/fingerprint.ts要求两源字节相同；RecordingDigest.ts仅放行`empty-stationed-traversals-v1`明确审核的两处驻营actors/items遍历扩展，逐字反向替换后必须回到P1c原SHA `88cc117934769a7b948db314fa5d9a1f81b963cf94bce14281c96b219131a943`，B真实SHA为`bf3befd4b0a8c305012162d887d6fa32e514f47dfda4e3cebb53e988e6eba9cd`，每帧同时硬验stationed与stationedNative为空；任何其他算法字节差量均拒绝；逐步保留A/B原生root，A仅提升枚举F/S/party版本和规则身份，并补齐创建来源、空转换/救援/居民记忆/死亡根、stationed与stationedNative空根，计算B身份下的adapted root。每条输入含初始状态逐域比较，未列出的机械差量立即失败。双方分别校验真实save/load/seed replay/双向seek；未知差量、未接受输入、混轮/缺片、源变化、工具变化、失败子进程均不能冒称速度改善。跨版每步证明的开销在命令计时之外，另记proofTiming；不得将其全进程墙钟与未启用证明的旧校准混比。它不删除版本、不宣称原始fullDigest相等、不提供旧档迁移。

AI-load新增身份 `party-ai-load-v1` 是独立诊断：100×100合法known-view、不可达(500,500)目标，要求每次4096节点预算回退且不改双RNG；另在真实录制origin之前建立可重建的arena，对0/8/16原生同伴分别计时，所有控制/命令使用公开录制边界，完整save/load/seed replay/seek硬验。该诊断不是自然地图、不是原party-ai-v1、不是browser/FPS、不是新硬预算；原生同伴case仅party-only，不声称已完成party-all同伴负载校准。本次已在固定源上执行；以下命令供同源复现，需使用全新输出路径：

```bash
for actors in 1 2 4; do
  NODE_OPTIONS=--max-old-space-size=3072 node scripts/profile-party-ai-load.mjs \
    "/private/tmp/party-p1d/ai-load-${actors}.json" "$actors" 32
done
```

新的身份转换诊断：先保留/取得最终引擎生成的四份wrapper（路径如下，不把缺失文件静默跳过），输出目录必须全新。捕获工具生成9个独立scenario：rescue1/2/4、自然救援快照join、自然叙事快照join、诊断居民join/往返、诊断haul居民join/往返。快照计时不冒称自然seed重放证明。

```bash
P1D_CAPTURE=/private/tmp/party-p1d/perf
P1D_ROSTER_OUT=/private/tmp/party-p1d/roster-setups
node scripts/capture-party-roster-perf.mjs "$P1D_ROSTER_OUT" \
  "$P1D_CAPTURE/captive-before-join.json" \
  "$P1D_CAPTURE/narrative-before-join.json" \
  "$P1D_CAPTURE/resident-before-join.json" \
  "$P1D_CAPTURE/resident-with-ticket.json"
for scenario in "$P1D_ROSTER_OUT"/*.scenario.json; do
  name=$(basename "$scenario" .scenario.json)
  NODE_OPTIONS=--max-old-space-size=3072 node scripts/profile-party-roster-perf.mjs \
    "/private/tmp/party-p1d/roster-${name}.json" "$scenario" 3
done
```

`party-roster-diagnostic-v1`消费经过引擎严格验证的、SHA绑定的诊断snapshot。三来源/居民往返/居民工作任务可各用独立scenario描述（本轮world5 tickets/orders实际为0），成功和拒绝不混桶。保存/载入、从setup重放、从中间snapshot恢复重放尾段、原生双RNG/allocator/零tick和生产Worker逐域检查成立才写measurement-only；明确 `seedReplay:false`，不把诊断setup冒称自然seed世界，也不把独立Worker checkpoint冒称完整录像Worker时序覆盖。记录输入/投影/full/编码/Worker墙钟与算法/存档计时，转换数、成员/NPC/居民/订单/票据前后计数、存档体积和内存采样峰值；根记录数量与实际工作计数分列。诊断Vite内存observer按唯一源码锚点计数真实settle/needsPlan/cancel调用、planner输入resident行、epoch区间、选中取消job与retireBundle调用；记录每项单位、原/插桩代码SHA，计时含少量hook成本，并用另一台无plugin的同源引擎逐步fullDigest重放验证机械等价。正式A/B不插该observer。

## 7 原实施源码、构建与人工发布

独立审查修复前的`src`清单hash（按`sourceSnapshot`递归排序路径及各文件SHA-256；修后身份见§10）：`48b0ef8fd318d114f04150fde5f4586547782abcbd127eb598135b40c3162679`。正常构建63个产物的排序`file/sha256/bytes` JSON摘要：`3cd11e336a84cefe54b52c8bbfbb4c4288c30000d03c7ee2fae08ec7a5f4eab4`；逐文件身份为`/private/tmp/party-p1d/final-source-build.identity.json`，构建日志`normal-build-post-fixture.log`。这是未提交候选的源/build身份，不把开工HEAD冒称新提交；性能固定副本与工具身份另列§6。原黄金/trace/五无partyfixture未重录。


独立 [manual checklist](party-p1d.manual-checklist.md)全部待维护者桌面/320/390横竖屏和真机验收。没有浏览器截图、点击延迟、FPS或实际设备证据。没有commit、push、tag、merge或正式云端派发。

## 8 限制与后续裁定

- 派驻者原地自卫，不主动追敌；护送模式目前明确拒绝，以免将受控实体强制伪装成Monster。
- 驻营深渊坠落按fallen安全退役，未实现跨层重落位并继续驻营；不将其称为完整原生怪物坠落等价。此项需要维护者复核，按本次指示记录后继续其余实施。
- 精选13行与一行全删不代表其余500个扩展子集或单删/单留布局都验证。
- 新转换诊断snapshot重放不冒称自然seed回放，Worker单job一致不冒称完整255/2048异步时序。正式三轮云端、浏览器和真机结果未生成。


## 9 本次第1轮独立审查发现处理（2026-10-20）

审查入口为 [party-p1d.review-findings.md](party-p1d.review-findings.md)，结论“需修”，F1–F3均为本次新增驻营根遗漏；该独立报告原文保持，不与§4实施期间的R1/R2混为同一轮。此次只改相关生产端口、回归和登记，按维护者要求运行相关测试、boundary、测试依赖、vue-tsc与build，不跑全量、删除矩阵、性能、云端或浏览器，不commit。原始证据位于 `/private/tmp/party-p1d/r1-fix/`。

| 发现 | 独立复现 | 修复及回归 |
|---|---|---|
| F1 射线遗漏驻营者 | 原probe在修前再次得到 lookup=null、hits=[]、HP=5；编回后hits=[47]、HP=11 | `boltWorld`使用当前层存活且未退役的`nativeAllyActors`；对应可见性、焚烧飞镖、范围消魔一并补齐。验证编回前后阻挡/治疗、公开治疗、飞镖及消魔的存读/回放/seek/续录。 |
| F2 原生属性环境丢失 | 原stat-probe再次复现同版诊断档前7、后14（shadow=true、darkness=false） | 配置回调覆盖受控与stationed所有权根；rested分别读取native/stationedNative。照明刷新也失效驻营属性。验证rested=false/true、实际敌方决策目标/潜行输入/全域终态/双RNG，以及存读、回放、seek和续录；原seed28自然路线追加驻营保存及seek属性相等断言。 |
| F3 DF撤离遗漏驻营者 | 原df-probe再次复现驻营留在(20,13)且不可通行；编回则撤至(19,14) | DF撤离集合、即时接触及火/下降补查统一接入当前层活驻营者；直接原目录闸门、公开压力板驱动闸门、即时着火和生命周期回归，另校验死亡/退役/离层根不进入活动端口。 |

同类审计沿实体查询端口逐处核对：交互物放置排除、生成占位、坠落重试占位签名、照明挡光/燃烧光、睡眠唤醒绑定和警报状态均补齐驻营根。保持仅在籍成员的控制窗口、队伍旅行、矿灯与共享视野集合，驻营不获得队员观察权，也不重复进入队员的毒/燃烧时钟。通用空间占位原已包含驻营者；本轮没有修改地形目录、规则数值、格式身份或任何无party黄金。

CE依据仍为本地已冻结源码：Items.c:5131格上生物查询与BE_HEALING执行、Architect.c:3332–3353撤离查询，以及既有照明/接触端口的原生规则。非party分支保持原集合与顺序；party无驻营时这些活动世界集合也不增加实体。

回归布景分开记：新增文件通过真实付费居民来源和公开join/station建立诊断世界；直接探针不冒充录制命令。命令生命周期场景在新局初始摘要捕获前重建诊断快照，保留新局录制标记、将party创建门置于未创建状态，再由真实首条create命令完成初始化。没有搬入旧命令前缀或伪造full/chain/检查点，所有回放候选仍通过原始完整初始根校验；这属于可重建诊断场景，并非自然种子游玩。自然seed28原公开前缀另以原测试验证，不修改其路线。

首次失败与处理：

- 三份原审查脚本修前重跑均exit0并复现缺陷，见`probe-before.log`、`stat-probe-before.log`、`df-probe-before.log`。修后同脚本、同S11样本再次运行：驻营/编回均命中#47并治疗5→11；潜行7→7；驻营/编回均撤至(19,14)且可通行。`original-probes-fixed.json`逐项硬验上述结果，三进程均exit0。
- 新回归首轮9项为8失败/1通过；其中射线、rested、撤离、范围消魔真实失败。新夹具还错误观察了不会进入的`takeTurn`分支，改为实际`prepareNativeDecision`并调用原实现；敌人与两友方等距会按ID选主成员，改站位使居民为唯一最近目标。
- 初版诊断setup尝试直接从无origin存档续录，被生产守卫拒绝；改为显式新局前置诊断布景及真实create前缀，未改生产录制守卫。另一个新闸门用例在已有房屋地基上创建阻挡地形，触发原`structure.region/foundation`校验；只移到无建筑覆盖的原生地板，不放宽结构校验（正常建筑选址原就拒绝machineNumber地块，夹具是建完房后直接改了原生地形）。生产修复后的首个回归批为2过/7失败（`regression-after-first.log`），保留上述夹具失败；修正后的9项整文件全部通过（`regression-after-second.log`）。
- 首次vue-tsc暴露新增测试把内部burning当公共StatusId，以及项目target不提供Array.at；仅改为已有burningDuration查询和数组下标，不改类型配置或守卫。原exit2日志`types-first.log`保留。

本轮boundary、测试依赖、vue-tsc、Vite build均exit0，具体命令与时长见`gates.json`；构建既有chunk>500kB提示保持，未改阈值。24个相关整文件首批为470过/1失败（495.19s，`selected.log`），唯一失败是旧DF引用扫描将模块`tests/`里的新测试当生产引用。直接DF调用移至既有`src/test/support/dungeonFeature.ts`测试区，仍使用绑定在Game上的真实效果端口和原目录；不改扫描器、白名单或断言。受影响的新增驻营文件、DF整文件、测试登记和仓库卫生共4文件50/50通过（86.27s，`followup.log`）。因此去重24文件/471项有最终有效通过结果，无skip；不把两批重复计为520项或冒称首批exit0。

范围为7个party整文件（新增驻营原生11项、居民交接、自然居民、环境、占位、旅行、事务检查点）与17个foundation整文件（五配置无party原字节、射线/地形/消魔/照明/飞镖、原生属性、whole-run及源码守卫）。精确路径见`selected-files.txt`，首批原命令及环境见`selected-command.json`。既有自然路线和无party fixture未改；只在自然路线追加驻营保存/seek属性检查。所有旧测试断言保持，没有重录黄金、放宽timeout或增加skip。

F1–F3本次作者修复验证完成；没有代替维护者或下一轮独立审阅者改写“可合入”结论。

修后源码`sourceSnapshot`为`0d5d7328bf1e8d8ab3d9ec7a1b2f77c3201726e7743f22fb79106c1310062cbe`，63个dist产物排序`file/sha256/bytes`摘要为`b46d6950df62ee35b26b2c4ce9d3428bf00c0b62c35ae24a64db22269e2e2311`；逐文件身份见`r1-fix/final-identity.json`。独立审查原文SHA-256仍为`994a36d947c8ff2113937b6216168787ec103f7344da5d1c321f041f690f37c9`。HEAD仍为3431533，未commit/push。

§3及§6的原实施门禁、删除副本和性能数据属于修前候选，不冒称本次修后复跑；本轮不重测性能，维护者正式云端应使用修后的真实候选提交。

## 10 第2轮复审 F4 与同类入口排查（2026-10-20，末轮作者修复）

[第2轮独立复审](party-p1d.review2-findings.md)已独立关闭F1–F3，新增重要问题F4，结论仍为“需修”。本节记录作者复现、修复及自验，不改写该审查原文，不启动第三轮，也不冒称最后修复已独立核销。原始证据在 `/private/tmp/party-p1d/r2-fix/`；本轮没有commit/push。

### 10.1 复现及修复

原公开探针 `lightning-public-probe.mjs`、原S11诊断档原样重跑：HP=1驻营者死亡并退役，下游原生rat仍为1000 HP、队伍未终局；存活对照下游为994 HP。修后原脚本同场景两种HP均命中下游，HP=1场景仍只退役一次且队伍未终局（`public-before.log`、`public-after.log`）。原诊断档没有录制来源，events=0，不将它冒称录像证明。

根因是把受控能力类型当成了在籍身份。玩家法杖及怪物施法各有逐格命中和地形后的死亡终止判断；怪物瞄准驻营者时还会用它作临时commandActor。现在共同调用 `boltStoppedByDeath`：无party保留原玩家死亡/终局判断；party仅在在籍成员死亡或全队终局时截断。驻营者死亡不截断穿透，也不跳过该格地形暴露；非穿透火焰/投射物仍由其原生规则停在首个接触者。非主成员死亡停止本条射线、其余队员继续的原语义保留，未改变窗口硬停边界。

同类排查另确认并修复三处目标遗漏：

- 投掷轨迹原只查询monsters，瞄准远处时会直接穿过驻营者/队员；上一轮飞镖修复只覆盖落点查询，不能修复沿途碰撞。现在party轨迹查询活动受控及驻营占位，普通武器、药水、焚烧飞镖均在首个生物接触处停止。普通投掷伤害扩展到受控体，沿原投掷命中/伤害/护盾/物理事实路径，接入目标护甲和武器符文，怪物专有状态/类属判断显式分支，不把居民死亡算作原生怪物击杀计数。
- 分段范围攻击的空间查询虽已包含驻营者，`ActorCombatResolutionAuthority`的实体绑定/活实体查询却把它丢掉；新锁定区域测试修前得到目标 `[player]`，应为 `[stationed,player]`。修复实体绑定，同时补生产攻击解析、资源推进、预检世界签名及敌方候选集合的驻营根，保持冻结/死亡/离层过滤和源死亡/终局/失衡中断。没有给驻营者开放玩家命令或改变原地自卫规则。
- 力量符文的移动阻挡已识别驻营占位，但碰撞伤害再次只查monsters，导致被撞驻营者漏伤。碰撞双方现在按同一活动世界占位查询；新增实际原生力场测试验证投出目标和驻营障碍各受两点碰撞伤害。

### 10.2 同类入口清单与逐项结论

下表覆盖本轮核对的实际生产入口；“无新增缺陷”仅指本次截断/目标列表问题，不代表所有玩法均已穷举。

| 入口 | 目标/死亡处理结论 | 验证 |
|---|---|---|
| `Game.applyBoltResult` / 玩家LIGHTNING | **修复F4**；驻营致死继续后方目标与当前格地形；在籍非主成员致死仍停止此射线 | 公开闪电，低HP驻营+下游敌人；非主成员死亡对照；存读/逐事件回放/双向seek/续录 |
| `Game.castMonsterBoltBody` / SPARK、FIRE、DRAGONFIRE等共用旅行 | **修复同根问题**；同时覆盖命中者和临时commandActor为驻营者的两种截断 | SPARK明确瞄准驻营者、驻营者挡在另一目标前、在籍成员对照，实际hits及逐格地形调用 |
| `BoltTrajectory.traceBolt` / 生物反射、墙反射及反复弹回 | 无独立死目标缓存：每格重新查活占位；受控体无大体型去重，死亡后返回段不会再命中它；最大长度/反射预算保持 | 驻营致死后经stone_guardian反射再伤后方目标/施法者的公开生命周期；既有W4重复/随机反射与路径上限整文件 |
| `traceBolt` / 治疗、状态、闪现、牵引、隧道、障碍 | 非穿透仍按原flag在首个接触者处停；隧道/地形阻隔预算与活查询不因死亡放宽 | 既有W3/U08及驻营治疗、非穿透致死火焰当前格暴露回归 |
| `throwItem` / 普通武器、药水、焚烧飞镖 | **修复沿途目标遗漏**；它们本来不穿透生物，不能因未查到驻营根而误穿；单次物品拆分/消耗保持 | 公开远目标投掷：前方驻营者实受伤/着火，下游不受武器伤；死亡退休、存读/回放/seek/续录；既有投掷数学及飞镖整文件 |
| `IncendiaryDart.resolveIncendiaryDart` / 爆点后查询 | 先DF再活占位查询；死亡/退役后不再二次点燃；无独立目标列表截断 | 原F1飞镖生命周期+新增沿途拦截 |
| 玩家矛/鞭/斧、突进/连枷，含原生profile穿刺 | 原生可攻击目标为Monster；受控队员和驻营者为友方，不加入玩家近战敌方名单。矛倒序远→近，固定名单逐个解析；目标死亡不截断后续目标 | `p4_7_player_weapon_geometry`整文件；不改友军资格或CE顺序 |
| 怪物矛/鞭/横扫 `Monster.perform*Attack` | 原已使用nativeAllyActors+monsters；矛倒序、横扫逐格活查、死亡目标跳过，不因驻营或非主身份提前break | 新怪物穿刺/横扫实际伤害双目标回归；P4-6整文件 |
| combat分段/锁定区域 `ActorCombatResolutionAuthority`、`PhasedAttackProduction` | **修复绑定/解析集合遗漏**；一段冻结目标，逐个重新验证活身份/位置；死亡目标不会让仍合法的后续目标消失。源死亡/终局/失衡才中断余下释放 | 锁定段修前漏驻营的红测试；真实combat+party+settlement公开wait触发原生ogre范围攻击，死亡退休与存读/回放/seek/续录；combat原生防御/运行时/身体生命周期整文件 |
| 力量符文位移及二次碰撞 | **修复碰撞目标遗漏**；已含驻营占位的移动阻挡与伤害使用同一对象根，双方各结算一次 | 实际移动至障碍前、双方各扣2HP；原武器符文整文件 |
| 护甲reprisal/mutuality/immolation | 反伤是伤害叶，不递归重新发起攻击；均摊名单固定、敌方资格保持；引燃走DF同一活实体端口，不按任意ControlledActor死亡终止列表 | 原护甲符文/反射死亡整文件；投掷受控目标沿原护甲入口，远程不误触近战反伤/分身 |
| `resolveExplosionDamage*`、`DungeonFeature.refreshFeatureCell/fillSpawnMap` | 原已逐格即时接触活nativeAllyActors+monsters；只有真正gameHasEnded才停止DF填充；驻营死亡退休或单成员死亡不会提前终止整片 | 新驻营/非主成员HP=1爆炸双对照，后续格rat仍受伤；F2c/DF整文件 |
| `triggerDeathFeatures` / 自爆、突变爆炸、后续DF链 | 快照怪物列表、deathEffectTriggered先置位；后续DF链使用同一瞬时端口，不依赖死驻营目标；掉落与重复死亡守卫保持 | 复读死亡DF/后续DF路径，既有爆炸/DF/火焰整文件 |
| `igniteIncinerationCells`、`EnvironmentManager`、`Promotion.runFireUpdate` / 火焰传播、燃气、气体 | 网格传播不遍历party名册；每格实际生物接触经DF端口；环境遍历使用活成员+驻营及monsters快照，死者不再次接触/点燃，后续对象继续 | 新公开焚化药水前方驻营死亡、后邻仍受伤燃烧的存读/回放/seek；原F2a及fire-contact整文件 |
| 范围消魔 `negationBlastBody` | 原F1修后已枚举nativeAllyActors，再遍历怪物副本；单个目标变化不破坏后续名单 | 原驻营消魔生命周期及W23整文件，保持 |
| 碎墙、警报/不和等非直接伤害群体入口 | 碎墙按地形及原生嵌墙/炮塔资格，合法P1d受控模板不具此资格；原生怪物精神/AI群体保留其Monster名单语义，不改为队伍控制指令，无致死循环截断分支 | 静态核对，不将这些入口冒称本轮新增全生命周期实测；驻营自主行为仍限报告§8的原地自卫 |

CE仍以本地冻结源码为准：Items.c:5168–5191普通生物致死后继续、5420–5422按PASSES_THRU_CREATURES停止；6882–6950投掷首个非潜水生物接触；Movement.c:1005–1009矛远→近；DF与爆炸沿Architect.c/Time.c既有端口。本次没有改CE目录、伤害数值、RNG算法、格式身份或录制守卫。

### 10.3 回归、首次失败及门禁

新增回归沿§9相同的真实付费居民/公开join/station诊断布景；正式命令生命周期用新局初始摘要前重建的诊断场景，不伪造origin/events/chain。存读核对全域摘要、双RNG及allocator；逐事件回放核对全域摘要，双向seek含0和尾部并核对双RNG，另有读取存档后继续输入并重放续录。该证据不是自然种子路线；原自然居民文件另行运行。

首次结果原样保留：

- `f4-red.log`：定向6项，4项真实失败、2项成员死亡对照通过；其余11项仅因定位过滤未执行。只改射线生产条件后，原11项及新增6项整文件17/17通过（`f4-green.log`）。
- `audit-red.log`：投掷飞镖/武器两项真实失败；新锁定段用错selfExclusion枚举导致一项夹具失败，改成合法`source-member`后仍复现真实目标遗漏 `[player]`（`area-red.log`）。爆炸/怪物穿刺/横扫四项当时已通过；不改原守卫或旧断言。
- `audit-green-first.log`整文件24/24通过。后来追加真实combat生命周期，首跑因新夹具把唯一可提交成员设为paralyzed却强行提交null ready actor，被BAD_PAYLOAD正确拒绝；去掉这个不必要的主成员状态，用原生高命中属性保证敌方命中，仍保留驻营麻痹、实际范围伤害和完整生命周期断言。定向真实combat随后通过（`combat-lifecycle.log`）。

最终限定验收为 **33个整文件、720项通过，无skip**，分两批且不重复累计：

| 最终批次 | 结果 | 原始证据 |
|---|---|---|
| 驻营原生整文件（原11项+本轮18项） | 29/29，169.04s，exit0 | `regression-final.log` |
| 其余相关整文件 | 32文件691/691，436.54s，exit0 | `selected.log`、`selected-result.json`、`selected-files.txt`、`selected-command.json` |
| boundary / 测试依赖 | 均exit0；依赖检查717文件、errors=[] | `boundary.log`、`dependencies.log`、`gates.json` |
| vue-tsc / build | 均exit0；Vite构建63产物，原chunk>500kB提示保留 | `types-final.log`、`build.log`、`gates.json` |

最终范围为6个party、3个combat、24个foundation整文件；原始精确命令和32文件路径在`selected-command.json`，新增驻营整文件命令为相同Node调用`node_modules/vitest/vitest.mjs run src/ext/modules/party/tests/party_stationed_native.test.ts --maxWorkers 1 --no-file-parallelism`。Node为v24.19.0，路径`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`；Vitest、vue-tsc及build显式使用`NODE_OPTIONS=--max-old-space-size=3072`。类型检查为`node_modules/vue-tsc/bin/vue-tsc.js -b`，构建为`node_modules/vite/bin/vite.js build`；两项独立完成，不以仅Vite成功代替类型检查。

无party五配置的原own keys/save/recording/消息/双RNG黄金对照在本轮32文件批次通过；原fixture与全部原守卫保持，未重录黄金、修改旧断言、调整timeout或增加skip。逐文件对照第2轮独立审阅快照，src只有4个生产文件（Game、Combat、ActorCombatResolution、PhasedAttackProduction）及1个驻营回归文件变动，见`source-delta.json`；其余为测试依赖登记、报告/人工清单/进度说明。无party分支的集合顺序、原生Monster投掷/符文运算及F20/S7/R4/O2身份保持。无新增Game字段、持久化根或格式变更。

末轮最终源码`sourceSnapshot`：`1b749443bb92c1e008f509a440e918b722c352944209d213c0fa985ee6f3f840`；63个dist产物按排序`file/sha256/bytes` JSON计算的摘要：`fb149790d214c8f031f07ab4862d6cf20c89eb0da38651808103e36234b2e33c`。完整身份在`final-identity.json`。本轮开始的Game副本SHA-256为`75bc9d813a0d9f4a75c4c5ed78cd039ec1b6da6451ccd99190e540eeb36cf60c`，等于第1轮修后/第2轮审阅源。第1/2轮审查文档SHA-256分别保持`994a36d947c8ff2113937b6216168787ec103f7344da5d1c321f041f690f37c9`、`6579cce9604536aa3a702530fed73500a62ab0d26eaba09f1cbd580fa3be06bf`。

F4及本轮确证的同类目标遗漏已完成作者修复和限定自验，未新增独立审查结论。原§3/§6/§9的测试、删除副本、性能及构建身份均为历史候选证据，不能代替本轮修后验证；本轮仅执行相关测试、boundary、测试依赖、vue-tsc和build，不再跑性能/云端/浏览器/全量/删除矩阵。§8的原有行为限制仍保留，正式云端使用维护者提交的本次最终候选，按§6命令派发。本次未commit/push，HEAD仍为3431533。

## 11 2026-10-23 无 party 尾部专项

开工 `ext/party-p1a` / `93a5e222332bf525566136870b9133d7bd34ee09`（含 D6 v3）；A 固定 `e72cd6256daf810f89e520f1673b197d6ba6097d`，原始 P1d 记为 B0，候选工作区记为 B。B0 与云端 `9a05080375136fb214975157b52de82f128fe93d` 的生产源码相同，差量仅一个性能工具测试文件。本次不 commit/push，不修改 D6、冻结预算或原始 CI 裁定。

### 方法、身份与噪声

原始证据 `/private/tmp/p1d-tail-20261023/`。A/B0 从 Git 对象导出，1530/1551 个 src 文件逐个 Git blob 验证；候选在 B0 上只替换本次生产/测试差量，完整清单、补丁与散列保留。Node v24.19.0 / Apple M5 / Darwin arm64 / heap3072MiB。两侧固定同一完整 all/prefix 文件，2423 输入、2549 客观块、253375 ticks；该文件与两批 CI 的 A/B 输入逐字相同，SHA256 `fb217d658dd7c2d5d6ac7d2de29a700dbf8bebe733767a10604952d0a26360cf`。

wall 采用原 observer 的仓外副本，保留完整回放、全部检查点及原客观计时回调；只追加命令时间区间/实际 UTC 窗口、导出源码身份，新增区间不进语义 hash。三个配对按 AB/BA/AB 串行；CPU/GC 单独整路线运行，不进入 wall 判定。CPU 另记录事件次数与客观 work slices，按客观块序号、结束输入和层数对齐。CPU 时间轴以 profiler 结束时钟对齐 replay 结束点，存在停止/采样粒度误差；跨命令客观块保留所有 work slices，GC 报区间重叠，不冒充独占 CPU 时间或倒推 wall/云端每个尖峰。

`caffeinate -ims` 贯穿，`pmset` 按实际测量窗口核对。全部11个已完成测量窗口无 Sleep/Wake/DarkWake（`sleep-audit.json`）。04:51:35–04:54:42 存在 Unity batch，与 A3 的 D19/D20 重叠；A3/B0-3 墙钟均明显抬升，原三轮完整保留并标注争用风险，不能称安静基线。没有删除慢样本、拼接样本或改变分位数。CPU/温度/后台负载未做完整遥测，`pmset` 无睡眠不等于机器绝对空闲。

### 逐块与调用栈

`aligned-B0.json` 保存全部2549块，三轮逐块中位数的 P90 集合255块，逐轮 P90 并集344块；`target-stacks.json` 给出这些块的 A/B CPU 采样栈与GC重叠。原云端对应整理为 `cloud-aligned.json`。客观块可跨输入累积，不能把整个命令墙钟当作该块时间。

| 客观块 / 累积输入 / 层 | CPU定位到的事件 | CPU客观ms A → B0 | B0 GC重叠ms |
| --- | --- | ---: | ---: |
| 419 / 420–421 / D6 | 穿透攻击致死 → 世界快照捕获 | 262.58 → 227.78 | 30.34 |
| 736 / 735–736 / D10 | 近战致死 → 世界快照捕获 | 441.12 → 378.31 | 53.66 |
| 769 / 768–769 / D10 | 燃烧致死 → 世界快照捕获 | 435.80 → 368.35 | 53.19 |
| 1243 / 1181 / D12 | 吸取HP致死 → 世界快照捕获 | 573.26 → 466.82 | 65.83 |
| 1634 / 1600–1601 / D15 | 怪物射线致死 → 世界快照捕获 | 847.12 → 711.66 | 87.52 |
| 1650 / 1613 / D15 | 燃烧致死 → 世界快照捕获 | 975.01 → 720.81 | 118.00 |
| 1686 / 1644 / D15 | 召唤 → attachCreature → 属性来源校验 | 169.97 → 152.59 | 5.71 |
| 1738 / 1688–1689 / D15 | 射线攻击致死、GC | 856.37 → 816.54 | 175.44 |
| 1867 / 1814–1815 / D17 | 环境伤害致死、GC | 1007.62 → 991.15 | 272.62 |
| 1868 / 1815–1816 / D17 | 环境伤害致死 → 世界快照捕获 | 979.37 → 945.85 | 170.32 |
| 2354 / 2284–2285 / D20 | 周期刷怪 → attachCreature → 成长属性来源校验 | 215.73 → 283.03 | 14.13 |

此表是独立CPU运行的客观块，不是wall验收数字。GC使用work区间交集的并集，避免重叠事件重复相加。独立采样中A/B0分别15103/15133个GC事件、51/52次major；事件duration总和32.914/30.090秒，不是独占CPU时间。对象快照`capture`的全程self采样53.062/45.805秒。没有发现B0多出同量级的新重型栈。

修复前wall三轮P99（ms）：A=230.792/229.271/376.973，B0=248.119/358.455/385.713；分别取中位数为230.792→358.455（+55.32%）。第三对有上述噪声，保持诊断身份。按块中位数，B0相对A的P90慢块最大差量为1634（+110.151ms）、1243（+84.111ms）、1650（+80.982ms）；完整慢块集合保留，未只选表中例子。

已定位的共同大头是怪物死亡后的 `killMonster → checkpointCombatFactWorld → checkpointGenerationWorld → capture`，以及属性/成长结算和 GC；并非新添层生成、驻营者或额外 F4 命中。A/B0 都有148次战斗快照、145次居民事务快照、19次换层生成、301次怪物射线，原17计数全部相等。D6输入421是穿透攻击致死；D10输入736是近战致死、769是燃烧致死；D12输入1181含吸取HP致死；D15输入1601射线致死、1613燃烧致死；D17输入1816环境伤害致死；D20输入2285周期刷怪/attachCreature/成长属性来源校验。不能把145次原有居民事务快照误称为145次新驻营结算。

P99 的第26大样本从 A1/A2 的 D6输入421（230.792/229.271ms）移到 B0-2 的 D10输入769（358.455ms），B0-3为D10输入736（385.713ms）；慢簇自身与GC插入共同影响取样秩。独立 CPU 运行中多数这些块反而 B0 更快，故没有证据把云端+30.35%全部归因于某个新增重型调用栈，也不能将这次采样的GC事件冒充历史wall尖峰的直接证据。

### 修复与回归

- 光照占位无party时直接检查玩家 footprint，跳过 P1d 新增的 `nativeAllyActors → activeControlledActors` 转发，并消除该位置原有单元素名单/回调分配。完整路线有6854719次此类查询。
- 客观时钟在 resident port 缺席时不构造/展开空名单，仍按原顺序快照、过滤、排序 due actors。无party状态/环境/客观通知不读取驻营名册；party存在时仍动态获取当前成员和驻营者，不引入缓存失效问题。
- 原生穿透才扩展武器旗标；普通玩家继续读取已有旗标，避免P1d无条件复制。
- F4命中/死亡停止规则、所有权守卫、各事务写集和回滚算法保持；没有新增Game字段、RNG调用或格式变化。

在原B0生产副本运行新增测试：两项新性能合同均失败；旧五配置字节断言先通过。最终候选须同时通过不枚举空驻营名册、光照不读取party名单，以及原有keys/save/recording/messages/双RNG夹具。原夹具、旧断言、守卫、门限均未改。

### 修复后测量：尚未取得有效的三轮 +10% 证明

另起全新A/B，不复用前批A。第一对客观P99为 **286.199→463.598ms（+61.99%）**，客观P95 +38.26%、命令P95 +24.73%、墙钟558.447→673.468秒（+20.60%）。`pmset-fixed1-B.log`证实B窗口内连续四次Unity batch：05:52:07–05:54:51、05:56:02–05:57:10、05:58:10–05:59:28、06:00:05–06:01:06（UTC+8）。这些是由ClientDied时间及持续时长定位的秒级区间；不将所有时间差单变量归因于Unity，但本对显然不满足安静配对条件。

首对完整保留；第二轮B已完成，P99=337.907ms、墙钟601.717秒，仅保留为未配对诊断。该窗口又与Unity batch 06:03:20–06:04:20、06:05:11–06:06:27、06:07:26–06:09:30重叠。后续队列已在下一入口boot/计时之前主动退出（exit75，`queue-stop.json`），没有后台待运行的测量。**不从不足三轮的数据计算验收中位数，不丢弃首对或与旧A拼接，不宣称恢复到+10%。** 已向维护者请求连续约50分钟的空闲窗口。没有收到窗口前，性能验收保持未完成，后续须全新三轮AB/BA/AB；当前小型汇总见 [tail-local-summary](party-p1d.tail-local-summary.json)。原始云端regression不改判，也不根据本次噪声放宽门禁。

已完成的限定验收（Node24 / heap3072 / 单worker / 无文件并行）：

| 项目 | 结果 | 原始日志 |
| --- | --- | --- |
| 新回归反事实 | 原B0上2项新增性能合同失败，旧五配置字节断言通过 | `counterfactual.log` |
| 相关测试与源码守卫 | 29文件、619通过、2原有skip；包含无party五配置原字节、F4射线/范围/投掷/驻营、客观时钟、武器几何、光照、UR2/3/4、录像与whole-run | `selected-tests.txt`、`selected.log` |
| boundary / 依赖 | exit0；717测试文件、errors=[] | `boundary.log`、`dependencies.log` |
| vue-tsc / build | 均exit0；原chunk>500kB提示保留 | `types.log`、`build.log` |
| drift | 8文件、16通过，exit0；没有重录任何基线 | `drift.log` |
| diff-check | exit0 | `diff-check.log` |

另用原 `compare-ext-perf.mjs` 将其余10个已完成运行逐一与A1比较：每次3,380,356状态叶节点及9,772事件域叶节点均零差异，semantic、RNG与recordingHash一致（`equality-summary.json`），不是只比较末状态hash。1551个候选src文件的散列在测试、测量导出与最终工作区之间一致。

上述均为真实完成结果，不把未完成的性能批次冒称通过。源码仅`Game.ts`、`TimeCoordinator.ts`，回归仅追加到既有`ext_party_inert.test.ts`，没有改变旧断言、测试门限、套件归属、schema或状态登记。后续若修改候选生产源，须重新绑定源码身份并补跑相应门禁。

### 维护者 phase6 重跑

只在维护者提交并推送后执行，下述 head/control 都是包含本轮生产修复的真实 SHA，不能用开工HEAD或旧P1d代替。该命令未在本次派发。

```bash
P1C_A=e72cd6256daf810f89e520f1673b197d6ba6097d
: "${P1D_FIXED_SHA:?填写包含本轮生产修复的已推送完整40位SHA}"
: "${CONTROL_REF:?填写指向该SHA的已推送branch或tag}"
[[ "$P1D_FIXED_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 1
CONTROL_REF_URL=$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$CONTROL_REF")
[[ "$(gh api "repos/coolking70/BrogueJS/commits/$CONTROL_REF_URL" --jq .sha)" == "$P1D_FIXED_SHA" ]] || exit 1
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$CONTROL_REF" \
  -f suite=phase6 -f mode=ab -f base_ref="$P1C_A" -f head_ref="$P1D_FIXED_SHA" \
  -f base_identity=6c4 -f head_identity=6c4 -f comparison=strict -f rounds=3
```

本地只判同输入all/prefix，不代替classic/full、all/full的正式分片、云端runner复验或独立预算验证；历史regression保持。
