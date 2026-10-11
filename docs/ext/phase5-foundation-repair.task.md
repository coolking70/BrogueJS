# 阶段5底座六项修复任务书

用户已明确批准本步骤全部语义及必要格式升版，无新增待决。唯一生产作者，分支ext/phase5。开工实现0ec7c56，文档后继59b9ba6；刚完成三套完整复跑均exit0，源码3321b89a32517e497a2485479fdcf147eb2696bb0597aaca7da6310d1c9ce3f5保持不变。旧门禁不是六项已修证明。

# narrative2 底座修复与集成——用户已批准的接续合同

前置：当前 final-rerun 三套（npm test、test:ext、test:drift）全部结束并核对其完整结果/源码身份，写5Z报告与状态；当前阶段只跑不改，不中断测试。若失败先按证据分类报告用户，不擅自扩张修复范围。先收好5Z复测文档，再开始本步骤。

仓库 /Users/coolking70/Documents/同步空间/BrogueJS-p5，唯一生产作者，ext/phase5。
来源：origin/ext/narrative2 已在本地解析到 1d0d900212c94e5acfccdd63d244e24d6f2d1bd2。其 docs/ext/narrative2.acceptance.md 已读；docs/ext/evidence/narrative2/ 三补丁、两草案测试/配置/两路线仅参考，不作为已修复证据。正式合入前核对固定commit身份，不能随远端变化扩大目标。

步骤A：底座修复，先于narrative2合入，收口并推送。
- ORIGIN 用户裁定：仅对确证完整回滚的同步扩展事务保留录制来源；原生部分写入、推进中止、未知状态仍失败关闭；照常抛出原异常。同步更新 docs/ext/phase2-narrative.md 原430行合同（§6.4）。不能吞异常/放宽断言/全局豁免ext:command；审计事务外预处理、完整写集、原生动作、recorder状态、确认取消/异步推进。优先受控且不可伪造的完整回滚凭据，草案的全世界序列化比较不得未经性能验证直接放热路径。补真实commit/settled异常、重试/续录、原生部分写入/未知状态负例和性能回归。
- VISIBILITY 无闪光仍规范化普通FOV边界，完整保存/回放快照一致，不记新知识、不取随机数；补闪光/无闪光、无/有渲染、换层/坠层、存读/非单调seek/续录、RNG与只读副作用。完整世界trace变化先单变量逐叶归因，原捕获方法重录，不裁字段/放宽守卫。
- SPATIAL 成功读档后每个缓存grid按depth绑定当前runtime区域查询；补真实重访、缓存复合体、区域负例、拒档保持、卸载/再次加载；不放宽空间边界/格式校验。
- 草案基线5项可作起点，必须正式登记测试并用真实公开入口，保原异常和全部快照断言。先确认底座独立回归，再独立只读R1→原作者resume必要修复→R2最多两轮，无R3，必要末修一次，仅相关复测；具体无法关闭项原因/影响交用户。gpt-6.1-sol/high优先。核对后提交推送ext/phase5，状态记录实际SHA。

步骤B：步骤A已推送后才合入固定 origin/ext/narrative2 (1d0d900212c94e5acfccdd63d244e24d6f2d1bd2)。处理冲突保已修底座；先检查源分支只改narrative生产和自有测试/资源/文档。
- 关闭原12失败：5人×failCommit/failSettlement十项、N2-A01完整缓存可见性一项、七模块缓存空间一项；后者与九行组合第9行同一失败，不重复累计。
- 完整narrative全部、九行组合全部、报告指定受影响11文件及底座新增回归、boundary/types/build、实际drift；XP奖励保持disabled/skip，5D3招募另案。
- 真实合并候选重跑完整npm/test:ext、正常128启用子集、获准15物理删除布局（单删7、单留7、全删1）。每删除行boundary/types/build/全部剩余test:ext及真实缺模块存档录像拒绝；smoke仅剩余全开/全关，全删去重29。所有结果必须新跑，不沿用5Z旧候选结果（包括旧历史额外124不计新覆盖）。本地engine-only；原skip/todo如实列出，不新加skip/exclude。
- 若集成后全量发现失败，先单变量归因再最小修复，黄金按原法，报告保首败，不能仅登记当关闭。影响全局的变动不能只跑一行。
- 两轮规则独立审查/作者修复收口后按授权推送ext/phase5，状态与报告更新。浏览器人工Claude抽样，回执不到仍待验；不自动合main/foundation、标签或开其它步骤。

运行：重负载串行、Node24.19.0/3GiB、Vitest单worker且无文件并发，不与当前5Z复测并行。子进程均run-child.sh或等价包装，done+纯shell看门狗，启动后结束当轮，不模型轮询；CLI父resume active-writer冲突，沿用60分钟兜底。每完成一步或6小时更新顶部五行。只保存命令/退出码/计数/候选身份/失败分类摘要，不能重建历史全量档案。

## 2026-10-11 用户追加：XR 三项并入同一底座步骤 A

固定证据源 origin/ext/phase5-xreview = 4bc60a9fadbd73e1ef11247beae1a6a5f18e4a4f；读取 docs/ext/phase5-xreview.md、phase5-xreview.repro.mjs、phase5-xreview.repro.ts。不合此审查分支，提取报告/探针作参考，正式补回归。与 ORIGIN/VISIBILITY/SPATIAL 合计六项，共用本步骤最多 R1/R2 两轮，不分开追加轮次。
- XR-01 S1：完成订单已退休ticket仍保留箱子/工作台引用，拆除后无法保存。修公共结构销毁清理路径，涵盖completed无live ticket订单；不得宽化存档验证。补完成前/交付后、同/不同source/destination、箱子/工作台、拆除/烧毁等相关路径，保证pending输出期限、无重复退款/产出。
- XR-02 S1 用户裁定：权威非致死退休事务将该袭击成员记为独立的非击杀退出，保留原因和时点；不计击杀、不发奖励。袭击完成条件与存档校验使用同一语义；若持久格式变化，本步升版并登记，严格拒绝旧格式、不做迁移。不得滥用既有仅限确证坠层的departed字段或放松其防伪守卫。补真实结盟→饥饿→可见宽限/视外即时退休→剩余敌人结束、经济恢复、save/load/replay与伪造missing/departed负例。不要仅注入ledger掩盖真实路径。
- XR-03 S3：离线epoch一轮完成多批，仅一个累计craft-batch事实造成totals少计。统一事实/消费者语义，避免对累计completedBatches直接累加造成重计。优先按每物理批次产出连续唯一ordinal事实；在线/离线、单/多批、日界/袭击暂停恢复、save/load/seek、物理产出/终端ticket/总数/ordinal一致。

步骤 A 只修六项及必要同因回归，不提前合narrative2；先重现原缺陷保首败，再修并跑完整受影响文件、相关回归、boundary/types/build/drift及必要性能。全局格式/黄金变更须登记影响与单变量归因，用原捕获法，不裁快照字段/改门限/增加skip/exclude。步骤 A READY 后由维护者派独立只读审查，原作者resume修复，最多两轮，无R3。收口推送后才执行步骤 B 的新候选全量门禁，5Z旧结果不能沿用。

## 2026-10-11 用户完整补充合同（当前 R1 修复优先）

# 用户完整补充合同（2026-10-11，覆盖此前冲突的接续顺序）

当前 foundation-r1-fix 作者 wrapper PID40921 / 作者PID40922，原会话01a12858-8da4-7c11-94ee-128d6789c5c1正常运行。用户要求不打断；不发信号、不并发resume、不另派作者、不并发写生产树。本合同存执行根，下一次原作者resume必须首先读取，并补入生产任务书/报告/状态顶部。

## A 当前六项底座（同一最多两轮）
1. 修复原则：录像决定类（两问true/false回放/seek/续录、多余/缺失决定拒绝、过期runtime/RNG拒绝）、foraging隐身喂食、giants spine自然trace等失败，先单变量回退对应生产修复确认归因。属于ORIGIN/VISIBILITY等修复引入的真实回归，一律修生产，不能改断言或测试前提关闭。只有反事实证明过时前提后才最小调整，逐项报告。回退后过只是因果相关证据，不能单凭这个把失败说成旧前提；必须结合原语义及合法原生场景判定。审计本次正在完成的R1修复是否满足此新增明确裁定，有不符在下次resume纠正。
2. 当前作者修复及其已启动门禁真正结束后、进入R2前，必须再resume一次原作者，补combat2 seed3/47 VISIBILITY原场景并关闭（换层/坠层、完整缓存快照、非单调seek）。不能当前作者done后直接派R2。该resume为既有VISIBILITY范围补充，不计新审查轮；R2一次同时复核六项R1修复及这些场景。
3. combat2证据固定 origin/ext/combat2=4ea702c0fce7a25cea9be0bf92b27dbd3ff29677；报告 docs/ext/combat2.acceptance.md 已由维护者读取，草案docs/ext/evidence/combat2/仅参考，不提前merge整个combat2生产。原失败3入口：combat2_evasion seed3/62、combat2_natural seed3/64（后续seed11/12不能省）、combat2_links seed47/425（巨兽正伤害接触断言在seek之后，不能称已覆盖）。seed3缓存可见性8叶，seed47共23叶；保原输入/完整快照，不能以0OOS或裁缓存字段代替。正式回归按底座/模块正确归属、实际安装模块可删除性，必要内容装配用明确隔离fixture，区分内容原输入与底座同因回归；最终集成后仍须复验原用例。
4. R2后按既有最多两轮规则收口推送ext/phase5。若不能关闭，逐项原因影响交用户，不开R3、不虚报READY。已授权一次必要末修及相关验证按既有规则，无额外独立审查轮。

## B 六项收口推送后，另开小底座SDK步骤（不是六项扩轮）
5. SDK-1：生成子事务rollback恢复活actor-action ledger及子对象身份，保镜像/存档守卫；不在安全点盲删metadata。原seed23第91公开输入、旧fixture.stomp no-op blueprint rollback最小复现；补嵌套提交后父失败、真实修改后回滚、多来源/休息/冻结袭击动作/其它模块异常与生成性能，完整值、ledger/action/resource身份及后续动作结束/save/load。
6. SDK-2：growth区域死亡DTO接受合法ActorFacts可选空间字段，经producer明确投影既有持久DTO，不改schema吞未知非法字段。原seed118第152输入，square-2 movementRegionId死亡；补独立/固定区/复合核心、普通/行政死亡、来源/分成/重复收据。保持35045d9来源过滤/收集幂等回归；无旧档迁移。
7. SDK-1/2可同一小步骤实施，独立R1→原作者修→最多R2，收口推送，再进入集成。草案 sdk1-generation-identity.patch、sdk2-growth-death-projection.patch、sdk-regression.draft.ts 仅参考，正式登记回归。不提前偷偷混进六项阶段。

## C 集成与唯一完整全量批次
8. 依次合固定narrative2=1d0d900212c94e5acfccdd63d244e24d6f2d1bd2，再combat2=4ea702c0fce7a25cea9be0bf92b27dbd3ff29677。保底座修复，核冲突与验收报告。每次集成可跑必要定向回归，但不每次重复完整全量。
9. 关闭narrative2原12项及九行组合；combat2原6失败（2SDK、3seek、1bonfire），另保共享giants2 SDK02 jackal两项，不能混记原6。旧前提含篝火、共享giants2 jackal：报告已有仅回退definitions到59b9ba6旧测试通过、改未绑定wraith原行为断言通过的证据；当前整合树核单变量再最小调整，保伤害/时间/中断与35045d9。
10. 补combat2报告明确的自然证据缺口：zombie自然释放、自然巨兽新招正伤害接触/群体handled、非空缓存NPC资源冻结、seed11/12持久化、growth技能No。原seed23/118安全prefix继续，不重抽掉失败seed；自然与受控证据分列。
11. 三者合并后的最终候选统一一次完整 npm test / test:ext / test:drift、正常128启用组合及已批准15物理删除布局（单删7/单留7/全删1，每行boundary/types/build+全部剩余ext+真实缺包存档录像拒绝；smoke剩余全开/全关，全删去重29）。不能沿用5Z旧结果，不在narrative2和combat2分别跑一遍全量。真实skip/todo/unhandled保留，重叠计数不累加。
12. 完成后按授权推送并更新状态顶部通知用户；浏览器人工抽查由Claude在最终候选上做，未回执不称通过。XP保持skip，5D3招募另案。不合main/foundation、不打标签、不擅自开其它步骤。

运行硬规则：所有后台作者/审查/长门禁均launch-detached.py（start_new_session/setsid + nohup + 文件stdin/stdout + run-child done），不能依赖执行者会话存活；唯一生产作者、重负载串行Node24/3072MiB/单worker。只事件/60分钟兜底，不模型轮询。每步或6h顶部≤5条更新。父CLI resume仍有active-writer冲突，不重复探测。全部授权流程完成推送/人工交付后停自动化。

维护者执行补充：每次续跑提示写毕必须同轮实际启动并登记PID，不能停在准备中。当前R1续跑须完成F1–F5实际修复及相关复测才退出；之后另resume补combat2 seed3/47，再R2。

## 2026-10-12 既有VISIBILITY独立作者resume（R2前补充）
本次仅固定4ea702c combat2原evasion seed3/62、natural seed3/64与后续seed11/12、links seed47/425；保原输入/决定/完整缓存世界、原换层坠层及非单调seek/续录，确保seek后的真实巨兽正伤害断言到达。明确隔离外部内容树，不合入combat2，不执行SDK1/2。正式底座同因回归归根目录，无可删除包硬依赖；原内容整合后仍必须复验。R1前提修订另审计独立单项反事实及原生FOV/光强语义，不能凭仅撤FOV通过即免责；真实生产回归修生产。实际相关门禁结束后写foundation-combat2-visibility.READY.md，由父派既有R2统一复核，无R3。

### 补充实际结果及需裁合同（历史，已被下方用户范围裁定覆盖）
三个原VISIBILITY seek已闭且原seed11/12完整持久化到达；后置原内容断言暴露两个既有缺口：固定natural五trace没有zombie新招释放，固定links seed47/425没有巨兽正伤害且reason=no-safe-stair-route。原test同时严格要求观察hits/releases等于原fixture，保持原输入/物理点/该事实数组时不可能凭底座生产修复满足缺失正事实。不得伪造出生/目标/伤害、改断言或偷偷更换原route。已问是否授权独立同seed原prefix续接证据，或把内容首败留后续集成阶段；未获裁定不擅自加内容输入。当前补充不是原三个seek未修，也不称原3文件全部通过；无额外审查轮，父决定接续方式。

## 2026-10-12 用户裁定及本次范围收口（覆盖上方待裁措辞）
# 用户裁定：seed47 giantHit内容缺口（2026-10-12）
用户明确：seed47后置giantHit=false是combat2交付已登记的自然巨兽新招接触缺证据，不属于VISIBILITY底座修复。本步只验seed47完整存读/seek/续录一致性（已通过），不得为giantHit等待裁定或阻塞R2。
保留giantHit原首败、原断言及未修改原文件结果，报告明确原完整文件可因该范围外内容断言仍exit1，不能称完整全绿或新增skip。将此项登记到combat2集成待办：集成时本地补自然/公开命中巨兽路线，或使用已有能命中巨兽种子，保留原断言。不是本轮删除或弱化giantHit断言。
现在继续完成原文件修后门禁、正式VISIBILITY回归及相关审计，按范围分别记通过与内容待办；完成交READY供父派统一独立R2。不要为该内容项另开修复轮，不提前合combat2。此裁定覆盖之前要求本轮关闭giantHit后置内容断言的任何冲突措辞。

同一补充合同C10已把zombie自然释放列为combat2集成待补证据；本轮不提前修该内容，与giantHit一起保留原首败、原断言及原文件真实exit1，均不阻塞VISIBILITY/R2。范围内三个seek及seed11/12、原换层/坠层/所有缓存完整快照、存读/非单调seek/续录已真实通过；正式根5项、feed34全文件及相关边界/类型/构建和原则审计完成。此次resume仅核有效done、原测试字节和同源码身份，更新合同与证据，不运行无关测试、不新增生产修复或内容输入。交foundation-combat2-visibility.READY.md，父派唯一剩余独立R2统一复核六项与补充；不是整内容验收、六项最终发布或新增审查轮。
