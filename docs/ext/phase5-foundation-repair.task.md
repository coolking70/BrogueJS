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
