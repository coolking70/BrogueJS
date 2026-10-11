**R2 结论：通过，可以按本轮六项底座修复的限定范围收口。** 未发现新的确证产品缺陷或必须末修的阻断项。R1-F1–F5、原确认/目标失败及新增空间首败已有足够的源码与有效复测证据支持关闭。

此结论不代表 combat2 整体全绿，也不替代后续 SDK、内容集成、统一最终全量和 Claude 人工验收。本轮不再开启 R3。

**审查对象与独立性**

审查对象为 `ext/phase5`：

- HEAD：`4856505e2c48f37586ca016af2d59f443b79ec9d`。
- 全部未提交六项修复、R1 响应及 combat2 VISIBILITY 补充。
- 本人独立复算源码：1311 inputs，SHA256 `73a08ca004620f1e9c5f78ef0fe298aee4d236a5a6b47d4916d973604b9afc14`。
- 本人独立复算 dist：60 files，SHA256 `b7055a7b4d2d84c21badd1c3bc9975e6a8014dc4fe04c4499ed840f2df4f6696`。
- 审查结束时源码 SHA 保持相同，`git diff --check` 通过。

已读取仓库 AGENTS、项目入口文档及相关事务、输入、持久化、可删除性、黄金合同；读取任务书、实施报告、原 R1，以及执行根四份指定补充/裁定文件。固定 XR、combat2 报告分别从指定提交读取，未将草案当规范或已合入实现。

本人未修改生产、测试、黄金、报告或外部内容树，未提交、推送、合并、打标签、派代理。新增运行仅为内存探针和只读证据核验，未启动新的全 npm/ext/128/15。

**新发现项**

新增确证发现：**S1＝0，S2＝0，S3＝0**。

下面将已关闭旧项、证据限制和范围外待办分开列出。通过结论依据执行路径与证据交叉核验，不依据 READY、作者退出码或测试数量。

**六项合同审查**

| 项目 | 源码判断与关键证据 | R2 裁决 |
|---|---|---|
| ORIGIN | [Game.ts:3937](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:3937)仅为受限同步 generic 扩展命令取得边界检查点；专用原生路由、悬停确认、推进、flare、活动 bundle/work/rest 等排除。异常路径要求当前 execution 的回滚通知、同一 runtime、同一原异常对象，并成功恢复外层预处理。`runtime.ts:1045`另检查原生边界、异步、解绑、消息发布及恢复完成。 | 关闭。不是按异常类型或全部 `ext:command` 豁免。原生部分写入、未知错误及不完整恢复继续失败关闭并抛原异常。 |
| VISIBILITY | [Game.ts:6566](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:6566)无 flare 也调用普通 FOV 重算；`remember=false`路径只写两类可见旗标，不进入知识、发现消息或记忆提交。与既有光强、几何及透视门保持一致。 | 关闭。正式 native 有/无渲染、真实 fall/stair/cache、存读、非单调 seek、续录和原 combat2 场景共同支持。 |
| SPATIAL | [Game.ts:12266](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:12266)在成功加载发布后重绑活动 grid，并逐缓存 depth 绑定本次 runtime 查询。查询读取当前 ledger，disposed runtime 返回拒绝。 | 关闭。未放宽区域或存档校验；拒档保持、再次存读、重访及卸载后旧绑定失效均有正式证据。 |
| XR-01 | [StructureWorld.ts:1450](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Map/StructureWorld.ts:1450)按订单的 plot/station/source/destination 清理引用，涵盖 completed 且无 live ticket 的订单。`ResidentOrders.ts:667`仅有活票据才退款/退休，pending output 保原期限与 fallback。 | 关闭。拆箱、烧毁、绑定工位、待输出/已交付及同/不同箱路径有覆盖；未通过宽化 reader 关闭。 |
| XR-02 | [ActorDeparture.ts:99](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/ActorDeparture.ts:99)在权威退休事务内发布独立 receipt 和 raid retirement；[SettlementRaids.ts:579](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/SettlementRaids.ts:579)共用见证核验：实体不存在、原因/owner/tick/ordinal 匹配，并与 defeated/departed 互斥。 | 关闭。完成与存档使用同一非击杀语义，没有新增 kill/reward 路径；原幸存坠层的 departed 防护保持。 |
| XR-03 | [ResidentOrders.ts:769](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/ResidentOrders.ts:769)先保存原批次/ordinal，再逐物理新增批次发布连续事实；consumer 仍每事实加一。 | 关闭。避免离线多批欠计，也没有把累计 completedBatches 重复累加。实物、终端票据、总数及 ordinal 有一致性回归。 |

格式升为 **foundation14 / world5 schema5 / settlement module、rules 1.4.0**，解析及身份校验同步。whole-run6、recording4、origin2、settlement state2 保持；旧格式拒绝，没有迁移路径。没有新增 Game 持久字段，world5 新语义已登记 U03。

**R1 旧项复核**

1. **R1-F1，原 S1：退休外层晚异常——已关闭。**

   [Game.ts:13933](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:13933)现在捕获完整 carried graph、检视集合、空间 source/anchor revision、listener/catalog、列表计量、phased defense、stat/session 和 terrain 订阅。实际删除目标另保存 own descriptors，处理最后 squareMotion/bodyGroups 删除后的键顺序恢复。

   窄写集对 grid、空间目录及未写入的大型路径图设引用边界，没有退回全缓存地形拷贝。空间订阅恢复仅保原关联；本事务不拥有 terrain 写入，使用该窄检查点符合实际写集。

   正式六分支已在有效完整结果中通过。本人另做 **活动/缓存 × 有无乘客 × 有无空间，共 8 个合法分支**的内存探针：先由真实 save/load 接受布景，再在真实 native 退休成功后抛同一原异常。完整原对象图、own descriptors/集合/别名、source/anchor revision、完整快照、RNG、allocator、时钟保持；恢复后重试两次只退休一次，原实体未死亡、统计不变，再保存/加载成功。

   探针第一次错误使用 `mode=test`，该模式不产生楼层缓存，缓存前提失败；此无效试次不计产品失败或通过证据。改用正常生成模式后的 8 分支全部通过。

2. **R1-F2，原 S2：可删除模块测试硬依赖——已关闭。**

   根合同按实际安装集运行；缺内容时使用明确的有限中性 fixture。`fgfixture`、`crafting.foundation-*`、`0.0.1`及独立 rules 身份区别于真实内容。保留 `crafting` owner 的适配器用于其保留协议，不应称为真实 crafting 包仍安装。

   本人核实五目录实际不存在，并在该物理树中以 **无 fixture registry** 独立运行拒档探针：实际 catalog 仅 growth/settlement；真实七包来源存档与录像均拒绝，完整活局、player/grid/monsters/runtime/world5/levels 身份、RNG 和 allocator 保持。

   正常七包来源接受及回放证据、缺五包全部剩余 ext 结果均保留。没有新增 skip/exclude 或放松 registry。

3. **R1-F3，原 S2：隐形盟友负例前提——已关闭。**

   `MonsterVisibility.ts:18`明确让盟友不因 invisible 状态隐藏。修后负例建立真实零光普通 FOV，并在发命令前断言 cell 与 direct visibility 均为 false，保留原 `C5_UNKNOWN_TARGET`、记录尝试、零机械费用和食物不消耗断言。

   新正例位于 [foraging_feed.test.ts:69](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/foraging/tests/foraging_feed.test.ts:69)：可见 invisible 盟友仍可喂食，100 tick、单 event、单 fact、单食物。未新增“隐形盟友拒食”生产特例。

4. **R1-F4，原 S2：五条巨人黄金遗漏——已关闭。**

   五路线 base 捕获精确复现 HEAD 黄金，final 黄金等于原 capture 输出。非 hash trace 字段、种子、事件物理字段、命令及决定保持。

   本人核对全部登记 raw SHA，并用 V8 原值独立复算 **108 个 hash 等式**，涵盖原三变体捕获点及扩展、命令、final 补充投影。原值保留 `undefined`；不能用 JSON round-trip 替代。

   9199 叶登记完整：格式56、普通 FOV1667、recording 派生摘要7413、trace 派生 hash57、墙钟6。**D3/D7 native 变化来自缓存 FOV，不能称纯格式；spine 的 extensionsHash 变化来自格式，其既有 native 投影不含缓存层。** 没有发现黄金掩盖 HP、行动、费用、时钟、RNG 或物品回归的证据。

5. **R1-F5，原 S2：129 次退休覆盖中断——已关闭。**

   原 `(60,20)` 被布景中的活 kobold 占据。修后仅选择已验证空位 `(60,21)`，保真实创建、结盟和权威退休入口；没有注入结果 ledger。

   有效完整文件已执行 visible=true 的129次退休、128条上限和原 witness 保留，再执行原12类拒档及新增 fake actor、unrelated receipt、fake region 负例，最后完成剩敌结束、存读和经济恢复。visible=false 分支亦实际完成。

**R1 测试前提修订是否合法**

接受这些修订，依据同时包含单变量反事实和独立原生语义；不以“撤 FOV 后通过”单独免责。

- growth prepared/square 场景原先铺图、移动玩家，却保留旧生成 LightMap；部分用例只手写 isVisible。修订在 origin 捕获之前重建原生光照，live/replay/seek 使用相同准备。
- 隐藏接触、bonfire 新可见成员、no-space 等负例改用 LightMap 和普通 FOV 建立黑暗，仍保原拒绝、安全及成本断言。
- 新增五项空间首败的修订仅在原快照/故障审计前建立合法光照，保原环境故障、完整对象图、重试、存读后的下一次移动及完整世界比较。
- 两问 `[true,false]`、`[true,true]` 的 replay/seek/续录、缺失/多余决定拒绝、stale runtime/RNG、No 零成本、一次收费和完整录制世界断言仍在，并在有效完整结果中实际通过。
- 本人没有发现翻转原期望、减少风险链、弱化费用/OOS 断言或绕过正常公开输入的修改。

补充新 fixture 的首败也处理得合理：真实 descent 会产生 flare，不能强称无 flare；独立空队列用例仍保留。feed 正例改用正常初始 satiety，避免诊断 load 按合同关闭录制后的无效前提。原首败保留，没有改变生产录像规则迎合测试。

**combat2 VISIBILITY 补充**

本人逐字节核对外部 combat 树与固定 `4ea702c`：89个原路径中，仅三份 combat2 fixture 有差异，且仅 identity/checkpoints 重捕获；原三个测试、support 和生产内容保持。共享19个底座生产路径与主候选一致。外部装配不算合入。

正式结果证明三个原 VISIBILITY 首败已关闭，后续持久化实际到达：

| 原场景 | events / saves | 非单调 seek | 续录 events |
|---|---:|---|---:|
| evasion seed3 | 62 / 3 | `[62,0,60,1,62]` | 63 |
| natural seed3 | 64 / 7 | `[64,0,49,1,64]` | 65 |
| natural seed11 | 315 / 14 | `[315,0,34,1,315]` | 316 |
| natural seed12 | 1328 / 21 | `[1328,0,138,1,1328]` | 1329 |
| links seed47 | 425 / 18 | `[425,0,24,2,425]` | 426 |

比较保全部缓存及完整世界；0 OOS 没有替代世界断言。

原三个完整文件的真实结果仍为 **2 pass / 2 fail，exit1**：

- natural 在全部五 seed 持久化之后，缺 zombie `combat.anchor-break` 自然释放。
- links 在完整存读/seek/续录之后，`giantHit=false`。

三变体原 hits/releases/parries保持相同。这两项按最新用户裁定及 C10 后置 combat2 集成，属于内容证据待办，**不阻塞本轮六项收口**。原断言、首败及 exit1 必须保留；不能称整 combat2 全绿。

**有效门禁与计数口径**

本人核对原 Vitest JSON、关键 summary/child done，并独立检查补充22个 done及5份 summary均已结束。

| 范围 | 有效结果与限制 |
|---|---|
| R1正常226文件唯一并集 | 4314 pass / 0 fail / 1既有 CE skip。原 bulk 4309/5/1、exit1保留；用三完整文件58项修后结果替换，不重复计数。 |
| 同源复用 | 本人用外部原 feed/manifest重构出 R1 `2184edaa…`，再用三测试旧 hash重构出 bulk `d3ef1e65…`，支持其余223文件复用。没有新226命令exit0。 |
| drift | 原7完整文件14/14、exit0；未因补充再次运行，不重复累计原5个重叠项。 |
| 原性能 | 16人 P95净增1.371457ms≤5；64人峰值24.675167ms≤50。原测试字节/门限保持，本人未重测性能。 |
| 缺五包全部剩余 ext | 原191完整文件2924 pass / 0 fail / 1同一 CE skip、exit0。不是新128/15结果。 |
| 补充正式门禁 | 主6完整文件76/76；实际缺五包新根5/5。boundary/types/build及外部归属检查有有效通过记录。 |
| 反事实 | 原 combat2仅撤 FOV仍3 fail/1 pass；新根仅撤 FOV为0 pass/5 fail。是因果证据，不是候选失败或整批通过。 |

唯一计入上述正常/缺包汇总的真实 skip均为原 `observes zero and 3072-cell/12288-component budget fixture`，来自缺 CE。没有把名称过滤当真实 skip，也没有把两布局中的同一 skip重复累加。没有发现最终有效相关日志中的已报告 unhandled。

**本人新增只读核验及限制**

实际完成：

- 候选源码、dist、同源重构、固定内容及原测试字节核验。
- 晚退休异常8分支独立内存探针。
- 真实缺五包、无 fixture 的存档/录像拒绝及完整活局保持探针。
- 巨人 V8 原值 hash、原输入及黄金捕获对应核验。
- combat2独立复算7635个 root、7572个 chain、63个实际扩展投影样本。
- 扫描全部125148个世界登记叶：5074格式叶、120074普通 FOV叶；另对7路线、两变体边界的42个代表性原始世界对完整重比，精确匹配登记。
- 初版黄金两边界各290份原始文件 SHA核验。

**未完成的独立检查如实保留：**本人尝试对每边界全部2537点重新递归重比原始世界，因成本超出小型审查探针范围主动中止，exit130；不引用为完整独立通过。完整点覆盖采用作者有效三变体捕获、原方法及全叶登记，辅以本人全登记扫描、原始点抽查和独立摘要复算。

本轮未新跑完整 npm/ext、128启用组合、15物理删除布局、CE fetch/full/gen、浏览器/真机、最大负载或性能门禁。未完成 SDK1/2、narrative2/combat2集成、XP和5D3；Claude最终候选人工回执仍待验。

**最终裁决：六项及本轮 R1 响应、VISIBILITY 补充可以收口；本次没有必须末修的新发现。保留上述范围外内容首败与后续验收责任，R2审查到此结束。**
