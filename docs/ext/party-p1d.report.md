# Party P1d 实施与验收报告

2026-10-20，开工分支 `ext/party-p1a`，HEAD `3431533`；本次不 commit/push。维护者已批准 PD1–PD7 全部按推荐，先回填任务单再实施。冻结 foundation `399df979f991434441182373c2fbc022645cab10`；性能 A `e72cd6256daf810f89e520f1673b197d6ba6097d`，其 src 与开工 HEAD 无差量。**实现、精简自动门禁、本地分层归因与 rounds=1 工具链冒烟已完成；已知行为限制见§8，不将短烟判为正式性能通过。** 正式云端派发和浏览器/真机由维护者执行。

**最新修订：第2轮独立复审已关闭F1–F3；新增F4及同类目标遗漏由作者复现修复，处理、入口清单和末轮验证见§10。审查轮次已用完，不启动第三轮；独立审查原文保持。**

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
| PD-A11 性能 | 已完成固定B本地分层、三套rounds1工具烟测、AI负载及九转换；report-only，正式云端由维护者派发 |
| PD-A12 审查交付 | R1/R2原发现及回读留档；最终源/build身份、报告/人工清单交付；R2后集成修复未冒称第三轮独立审查，已知限制待裁定 |

## 6 性能与维护者命令

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
