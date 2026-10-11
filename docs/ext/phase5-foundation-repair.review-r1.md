R1 结论：**不通过，当前不是 READY。** 确认一项产品事务恢复缺陷、两项测试合同问题、巨人初始黄金遗漏；其余失败仍需作者反事实归因。以下问题先交原作者修复，六项共用最多 R1/R2，无 R3。

**1．R1-F1，S1，确证产品缺陷：XR-02 退休外层回滚未恢复完整原生写集**

位置：[ActorDeparture.ts:99](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/ActorDeparture.ts:99)、[Game.ts:13933](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:13933)、[Game.ts:14098](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:14098)、[Game.ts:14103](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:14103)。

- **触发**：`retireDepartingActors` 完成原生移除或乘客落地后，退休事务发生晚异常。与新增回归使用的“调用真实 native 方法后抛原异常”故障方式一致。
- **原因**：`retireActor` 调用 `transactResidentWorld` 时没有启用 `nativeWrites`；外层检查点补了 stat bindings，但没有覆盖空间演员的 WeakMap revision，也没有深捕获 `examinedEntityIds`。乘客路径自己的内层检查点已经成功提交，不能处理随后发生的外层失败。
- **独立证据**：只读内存探针使用 foraging 实际引擎、原生 rat 载体和 square-2 乘客。布景先经真实 `loadSnapshot` 验证接受，再注入晚故障：

  ```text
  candidateLoadAccepted: true
  before: loc=(30,20), anchorRevision=0, sourceRevision=0, examined=true
  after:  loc=(30,20), anchorRevision=1, sourceRevision=1, examined=false
  carrierRestored=true, samePassenger=true，仍抛原异常对象
  ```

  不带乘客的独立探针同样确认：演员已恢复，`examinedEntityIds` 中该 ID 未恢复。
- **影响**：失败后对象图看似恢复，派生身份及检视状态却已改变，不满足权威退休原子性。不能用当前完整快照相等及 stat 绑定测试认定全部原生写集恢复。
- **最小修复方向**：在退休所属外层事务中补齐实际原生写集和会话恢复，至少包括完整携带对象图的空间 revision/listener/catalog 关联及被删除的集合；同时审计 phased source 清理。不要直接把每个退休重新变成全缓存地图检查点，破坏已修性能。
- **验证要求**：把上述两种晚失败补成正式回归，比较完整快照、原对象引用、集合内容、空间 revision、stat/session 绑定、RNG、allocator、时钟及原异常对象；覆盖活动、缓存和携带实体，失败后重试只能退休一次，无 kill/reward。按原门限复验 16/64 人性能。

这是当前 63 项门禁失败之外独立发现的问题，不重复计入失败数。

**2．R1-F2，S2，确证测试合同问题：新增测试重新引入可删除模块硬依赖**

位置：[ext_foundation_world_repair.test.ts:34](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/test/ext_foundation_world_repair.test.ts:34)、[ext_foundation_world_repair.test.ts:53](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/test/ext_foundation_world_repair.test.ts:53)、[ext_foundation_boundary_audit.test.ts:61](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/test/ext_foundation_boundary_audit.test.ts:61)、[ext_foundation_boundary_audit.test.ts:74](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/test/ext_foundation_boundary_audit.test.ts:74)、[foundation_retirement_replay.test.ts:137](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/settlement/tests/foundation_retirement_replay.test.ts:137)。

- **触发**：物理删除 narrative、combat、giants、crafting 或 foraging，而根测试或 settlement 测试仍存在。
- **原因**：根测试无条件启动 narrative、固定七模块及固定 combat 组合；三个新增 settlement 文件无条件使用 foraging/crafting。删除包会正确撤销注册，却不会撤销这些仍由 foundation/settlement 拥有的测试。
- **证据**：`test-discovery.mjs` 将这些根 `ext_` 文件纳入剩余 ext 门禁；模块清单随所有者目录删除。当前测试没有安装集投影或缺包分支，严格 registry 会拒绝不存在的 ID。boundary 通过只证明静态导入/所有权规则，不证明这些运行时组合可删除。
- **影响**：后续获准删除布局必然遇到新的测试依赖失败，不能沿用旧 5Z 删除结果。这是测试设计问题，尚未发现本次生产代码新增私有模块导入。
- **最小修复方向**：底座合同用中性、明确注册的 fixture 验证；内容集成按实际安装集执行，并保留缺模块存档/录像拒绝及活局保持断言。settlement 的可选 crafting/foraging 路径沿既有可选依赖模式处理。
- **验证要求**：先做缺包与恢复包的单变量证明，再跑有关完整文件；正常七包安装时原合同覆盖必须保留。不得增加 skip/exclude、放松 registry 或省掉剩余 ext 门禁。本轮没有执行删除布局，也不把它算作步骤 B 已完成。

**3．R1-F3，S2，确证测试前提错误：隐形盟友没有构成不可见喂食目标**

位置：[foraging_feed.test.ts:299](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/foraging/tests/foraging_feed.test.ts:299)、[MonsterVisibility.ts:18](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/UI/MonsterVisibility.ts:18)。

- **触发**：本次把原“目标格不可见”前提改为 `ally.setStatusDuration('invisible', 10000)`。
- **原因**：现有可见性执行路径对盟友直接返回 `monsterHidden=false`。隐形状态不等于盟友所在格不可见。
- **证据**：最终日志第 113 行该项得到 `{recorded:true,error:null}`，而期望 `C5_UNKNOWN_TARGET`；源码明确解释了为何这个新前提不能建立拒绝条件。
- **影响**：当前用例失败，且没有证明不可见输入零成本安全。不能据此修改生产规则为“隐形盟友一律拒食”，也不能把断言翻成成功。
- **最小修复方向**：建立真实普通 FOV 下不可见的盟友格，例如可验证的黑暗或遮挡；保留 `C5_UNKNOWN_TARGET`、录制尝试、完整 mechanics 不变及食物不消耗断言。
- **验证要求**：作者补该前提的单变量证据及整文件通过；至少断言发命令前实际不能直接看见目标。原 25 文件反事实不能为这个后来引入的新前提免责。

**4．R1-F4，S2，确证黄金遗漏：giants2 初始完整世界 hash 尚未随格式更新**

位置：[giants2_trace.test.ts:59](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/giants/tests/giants2_trace.test.ts:59)、[giants2_persistence.test.ts:71](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/giants/tests/giants2_persistence.test.ts:71)。

- **触发**：lantern/copper 初始化后比较原 foundation13 黄金。
- **证据**：独立内存分析沿原 `world` 的 JSON 化、`savedAt=0`、canonical/SHA 方法取得与最终日志完全相同的新 hash；仅在快照副本中回退 foundation 版本/manifest 和存在时的 world5 schema，即精确得到旧黄金：

  | 场景 | 当前 hash | 仅回退格式叶后的 hash＝原黄金 |
  |---|---|---|
  | lantern，seed 1 | `077cd9a9b3903e627411653a23f01380889b2b92d3f7d2ca8a2930cbd248f4ed` | `0be02d40a9cd3728352fc5fff7619de02c4ca72fffa895ecc51c60301ea5ce53` |
  | copper，seed 2 | `82fabbaa0e118a3a09e21b0b20e9eff230719f2decee5e247756ea1ef29ede3e` | `359a919b70b6d34a883378f68955b9641090a92fd5a85ba28a0700fb63cf2bd3` |

- **影响**：8 项 persistence 和 2 项 trace 在初始关口停止，后面的损伤、回放、拒档和换层断言没有因此获得通过证明。
- **最小修复方向**：作者按原 capture 方法完成这两条路线的逐检查点归因和重录，保留种子、命令、决策及完整字段。
- **验证要求**：先原测试/黄金不动，只回退生产证明，再按原入口捕获并登记全部叶；恢复后跑两套完整文件及 drift。上述独立分析只确证**初始关口**，不证明后续只有格式变化。

另三个 giants trace 的最终日志明确显示：

- spine：`extensionsHash` 变化，`nativeWorldHash` 未变；
- D3 ridgeback、D7 colossus：`extensionsHash` **和** `nativeWorldHash` 都变。

其 native hash 投影不包含 foundation/world5 版本叶，故 D3/D7 不能称“只漏格式黄金”。FOV 是合理候选，但仍需本次逐叶反事实证据，不能用旧 5Z 证据替代。

**5．R1-F5，S2，确证覆盖中断：129 次退休见证保留用例未完成**

位置：[foundation_lifecycle_repair.test.ts:150](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/settlement/tests/foundation_lifecycle_repair.test.ts:150)、[Game.ts:13940](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:13940)。

- **触发/证据**：visible=true 分支在固定 `(60,20)` 调用 `createRaidMonster` 返回 null，最终日志第 693 行、第 152 行断言失败。
- **原因状态**：用例假定固定位置满足真实候选规则，未验证净空/占据；具体拒绝因子尚未记录，不能预设只是旧布景。
- **影响**：这一分支的 128 条上限、保留原袭击见证、后续 12 个拒档负例、剩余敌人结束及经济恢复均未执行完。visible=false 分支通过不能补齐 129 次保留证据。
- **最小修复方向**：先记录真实候选拒绝因子；若确为新用例布景问题，选择合法空位继续使用实际造怪、结盟和退休入口。若是生产清理留下占据，则修生产。
- **验证要求**：整文件实际完成，证明 129 次权威退休后仍为 128 条且原 witness 保留，再完成该分支全部后续断言。不得注入 receipts、放松候选规则或跳过压力段。

**6．48 项 FOV/目标/确认失败仍未决，不能先批准改前提**

相关位置：[Game.ts:6566](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/engine/Core/Game.ts:6566)、[ext_growth_prepared_commands.test.ts:54](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/growth/tests/ext_growth_prepared_commands.test.ts:54)、[ext_growth_square_melee.test.ts:42](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/growth/tests/ext_growth_square_melee.test.ts:42)、[combat_phase4d_rest_relations.test.ts:51](/Users/coolking70/Documents/同步空间/BrogueJS-p5/src/ext/modules/combat/tests/combat_phase4d_rest_relations.test.ts:51)。

源码可见这些布景铺图、移动玩家或手写 `isVisible`，部分没有重建当前原生光照，combat 用例直接遮掉本应可见的敌人。新普通 FOV 规范化会覆盖这些旗标，确有前提失效的可能。

但当前证据只证明确认没有出现、风险链缩短或目标无效，**尚未证明这 48 项全是测试问题**。原作者须：

- 对这三个完整文件补生产单变量反事实，保原测试/黄金不动；
- 若旧前提确证失效，只修光照/遮挡/观察时点，保全部原生风险确认、No 零成本、一次收费、目标选择、陈旧 token、回放决策和零 OOS 断言；
- 用正常引擎建立的可见场景验证真实 fire/gas/plate、酸蚀/盟友、多目标及空间接触，避免仅以手写旗标验证新实现；
- 若合法普通 FOV 场景仍丢确认或误选目标，修生产并记录 CE 执行依据。

这些属于 S1 安全语义风险未决，当前不列为已确证产品缺陷。

**63 项失败与 drift 的完整映射**

下表 `L` 为绝对日志
`/private/tmp/brogue-commander-20261009-5z/foundation-affected-final-detached.log`。参数组列出了全部失败参数，行号可逐项定位；分组不代表根因已经关闭。

| 文件／测试名或完整参数组 | 数量 | L 行号 | 分类及关闭要求 |
|---|---:|---|---|
| giants2_persistence，lantern：`continues damaged/phase checkpoints…`、`replays every real event and nonmonotonically seeks…`、`rejects corrupt spatial closure and manifest…`、`retains damage, broken slots and phase spent through real stairs…` | 4 | 135、153、171、189 | F4：初始格式 hash；后续合同未执行，原法全路线归因后整文件复验 |
| 同上四项，copper | 4 | 207、225、243、261 | 同上 |
| giants2_trace：`fixed lantern/copper natural public-command trace matches all mechanical checkpoint hashes` | 2 | 279、295 | F4；与 drift 两项重叠 |
| giants_spine_trace：`naturally recreates spine seed, commands, both RNGs and original sample trace` | 1 | 311 | extension hash 未归因；原法反事实/重录；与 drift 重叠 |
| giants_trace：`naturally recreates seed 7328 D3 world…`；`naturally recreates the D7 colossus world…` | 2 | 341、373 | extension/native hash 均变，格式不能解释 native；逐叶归因；与 drift 重叠 |
| growth_prepared：`fire/gas/plate/acid/discordant ally: answer false/true matches native synchronous world, RNG and growth cost`，每种两项 | 10 | 406–415 | 未决 FOV/风险确认；先完整反事实 |
| `acid→ally questions consume answers [false]/[true,false]/[true,true] once, with no cost before final approval` | 3 | 427、446、447 | 同上 |
| `whip/spear/axe: measured-strike keeps whole-hit-list risks and answers [false]/[true,false]/[true,true]`，每种三项 | 9 | 466–468、487–492 | 同上，保多目标风险与收费语义 |
| `withdraw with rapier/flail confirms its acidic movement attack, answer false/true` | 4 | 511–514 | 同上，保移动攻击酸蚀确认 |
| `withdraw risk chain refuses at 1/2/3/4 without consuming action IDs, focus, cooldown, effects or time` | 4 | 526、545、564、565 | 当前仅一条答案；先反事实，不缩短风险链期望 |
| `rejects stale growth revision/target/runtime/RNG without running the queued Runtime.command` | 4 | 584–587 | 确认未产生，尚未到达陈旧守卫；先恢复合法前提再复验 |
| `replay, seek and saved continued recording preserve a two-question answer false/true with zero OOS` | 2 | 599、600 | 确认未产生，续录/seek 证据未完成 |
| `replay rejects missing/surplus recorded decisions instead of asking the UI` | 2 | 613、614 | 确认未产生，缺失/多余答案拒绝证据未完成 |
| growth_square_melee：`2/3-square tail target: No retains resources, cooldown, revisions, RNG and time` | 2 | 627、628 | 目标验证 false；空间接触/FOV 前提未决 |
| `pending square target moved/out-and-back/shape/corner invalidates approval before payment` | 4 | 647–650 | pending token 为 null，尚未验证陈旧目标 |
| `Yes pays once and runs one physicalResolved and one real acid degradation despite two spear contact cells` | 1 | 662 | token 为 null，收费/物理解算证据未完成 |
| `real pressure target budget consumes once per square native strike and twice for independent strikes` | 1 | 669 | effect 未产生；目标/消费合同未决 |
| `losing public body contact during prepared confirmation invalidates Yes without charging or recording a stale command` | 1 | 681 | token 为 null，失去接触拒绝证据未完成 |
| combat_phase4d_rest_relations：`asynchronous confirmation rechecks a newly visible member without charging a visit or time` | 1 | 101 | token 为 null；手写隐藏前提候选，须独立反事实 |
| foraging_feed：`invisible feed rejection records an attempt with zero mechanical cost` | 1 | 113 | F3：新增隐形盟友前提错误；恢复真实不可见条件 |
| foundation_lifecycle_repair：`XR-02 real hungry ally retirement visible=true, witness, strict negatives and economic recovery` | 1 | 693 | F5：造怪返回 null；129 次 witness 压力及其后断言未完成 |
| **合计** | **63** | | **10 初始黄金＋3 其他 trace＋48 FOV/确认未决＋1 feed＋1 新 XR 用例** |

drift 日志为
`/private/tmp/brogue-commander-20261009-5z/foundation-drift-final-detached.log`。第 32、48 行对应 giants2 lantern/copper；64 行对应 spine；94、126 行对应 D3/D7。**这 5 项全部已在上表，不另加失败数。**

**六项合同审查及覆盖缺口**

| 合同 | 本轮确认 | 尚缺／阻断 |
|---|---|---|
| ORIGIN | receipt 经 engine-local execution 回调传递，模块 context 不提供该能力；同异常对象匹配。原生动作边界单调计数、异步检测、消息发布窗口、GC 解绑、disposed、确认悬停、scheduler/session 换绑均阻止认证。同步 commit/settled 回滚、重试/续录及若干未知异常负例已覆盖 | 尚不能以保存投影概括任意完整对象图恢复；保持 native/未知异常 failclosed。新增安装组合测试有 F2 删除依赖。R1 未确证新的 ORIGIN 产品缺陷 |
| VISIBILITY | 无 flare 分支以 `remember=false` 重算普通 FOV；执行路径不写探索记忆、不取 RNG。A01 保存/回放/非单调 seek 完整世界回归已通过 | 48 项确认/目标失败未决；feed 前提错误；D3/D7 native trace 未归因。新增 snapshot/flare 回归不等于真实渲染与 headless 双驱动全部验收，Claude 待验 |
| SPATIAL | 成功加载发布后活动 grid 及每个缓存 depth 绑定本次 runtime；resolver 查询当前 ledger，disposed 后拒绝。新增路线包含缓存区域、拒档身份保持、再次存读、重访及卸载重开 | 固定七模块测试存在 F2；本步未新跑物理删除布局。无已确证 SPATIAL 产品缺陷 |
| XR-01 | 公共 `destroyComponent` 遍历生产订单的 source/destination/station/plot，completed 无 live ticket 也能走清引用路径；已有产物保原 next-epoch/fallback，取消无 live ticket 不再次退款 | 拆除/烧毁、待输出/已交付、箱子/绑定站测试已提供；未据此声称所有销毁组合全覆盖。新增跨可选包测试有 F2。无已确证剩余 XR-01 产品缺陷 |
| XR-02 | 独立 `retired` 原因、tick、ordinal 匹配 departure receipt；与 defeated/departed 互斥、实体不存在才认可。完成与存档引用校验共用 retirement helper；该新增路径没有 kill/reward 调用 | **F1 原子性缺陷、F5 129 次保留测试中断**。现有 12 个负例没有明确覆盖替换 fake actor 身份、借 unrelated receipt 及退休后 fake region 的组合，须补严格负例；不据此直接宣布协调伪造已被接受 |
| XR-03 | 应用 plan 前保原 batch/ordinal，再按每物理新增批次发布连续事实；consumer 仍每事实 +1，避免累计值重加。在线/离线、日界、袭击暂停恢复、save/load/replay/seek、物理/terminal/totals/ordinal 有实际回归 | 新增 crafting 路线有 F2 可删除性问题。未发现已确证 XR-03 生产计数缺陷；不能把 controlled clock 布景称自然 UI 验收 |

格式升级为 foundation14、world5 schema5、settlement module/rules1.4.0；whole-run6、recording4、origin2、settlement state2 保持。解析与身份检查同步，旧 13/12 raw 保留并拒绝，未发现迁移或放松旧身份的实现。无新增 Game 持久字段；`CommandExecution` 两项为瞬态，world5 子语义已登记 U03。没有新增玩家可见文案需另补 i18n；最终相关源码/i18n/归属守卫未见失败。

**本次黄金证据核验**

本次证据独立于旧 5Z：

- 18 个存储生产文件与当前源码逐字节相同。
- `golden-changes.json.gz` SHA 为 `0a35a95b50c48f6e6ddff2854ee227c780506446f4a846c972f61a5dd5401a1c`；两对各 290 个文件的前后 SHA 全部匹配原证据。
- base→nonvis：2799 叶；nonvis→final：1051 叶。登记包含格式及派生 hash、普通 FOV 920 个旗标、72 个可见目标名称变化等。
- 原 capture 入口、仅撤普通 FOV 分支的变体方法、有效串行 capture done 均已核；中断/重叠批不用于通过结论。
- crafting/foraging 三份 trace 的非 final 字段及两份居民 route 的非 digest 字段与 HEAD 相同；原命令/物理检查点未被替换。新 14 导出为 59162 bytes。
- 原 25 文件 362/362 反事实真实 exit0，但清单不覆盖此次 growth 两文件、combat relations、giants persistence/三 trace 及新增 XR 压力失败，不能扩大其免责范围。
- **giants 的遗漏不在上述已登记捕获集合中**；仍须按 F4 补齐，尤其不能把 D3/D7 native hash 归为格式。

**有效门禁与本轮边界**

核对了 detached summary、六套 done 和相关日志。当前重新计算仍为 **1308 inputs／`71907f538e762766a378fa94a74963217889ab53c04efd5911c5ea0afa30904c`**，与门禁前后一致；实际新 build 为 **`d164aa45287b1a8ced5cbebb446bb332fd0fa1eda5c6d12d59d785d6aa81ab43`**。

| 门禁 | 真实结果 |
|---|---|
| 258 个完整相关文件 | 248 过／9 败／1 既有 skip；4766 过／63 败／1 既有 skip；0 todo、0 已报告 unhandled；exit1，5784.421s |
| drift | 4 文件过／3 败；9 项过／5 败；exit1，与上表重叠 |
| boundary／types／实际 build | 各 exit0 |
| c4a 指定源码 guard | 1 项通过，29 项 name-filtered；exit0，不能称 29 个真实 skip |

只提取性能指标：16 人 ordinary P95 净增 **1.356416ms**；64 人峰值 **23.417417ms**，原门限通过。ORIGIN 1/8 depth P95 为 **0.341833/1.639917ms**；这是测量及结构保护，未冒充新的数值门禁。

本轮未修改任何生产、测试、黄金或报告文件；未 commit/push/合分支、未派代理、未新跑重负载、未干预 combat2。补充探针仅以 `esbuild write:false` 在进程内执行，未写生产树。

**交回原作者处理 F1–F5及未决归因；修复后仅按实际影响复测，再进入最多 R2。narrative2 尚未合入，后续完整全量／128／15 布局没有完成，Claude 人工仍待验。R1 审查到此结束。**
