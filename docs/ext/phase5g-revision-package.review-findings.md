> 发布说明：以下保留原独立审查的历史发现及复审结论。当前执行合同以 [集中返工包](phase5g-revision.dot-package.md) 为准。SDK-02已更正：worldSdk原有可选lastCommandError；本轮保留通用反馈，不新增固定ForagingView具体提交码投影。历史“没有公共读口”的笼统描述不作为当前结论。

# 5G 集中返工包独立只读审查

2026-10-08。审查草稿：`/private/tmp/brogue-commander-20261007/phase5g-revision.dot-package.draft.md`，下文草稿行号对应本次读取的 38 行版本。生产参照树：`phase5g-review-tree`，HEAD `0fb2720ff1e62ca49cf2f9bcc7b41c550a72d467`。

**结论：无 P1；发现 2 项 P2 验收合同/交接遗漏、1 项 P3 计数措辞歧义。建议补齐后派发。** 它们不推翻 SDK-02 首版通用拒绝反馈、九类特殊布景完整新局录像留 5Z 的维护者推荐裁定，也不要求用户另行批准这些可回退决定。§A 和 §0 的真实基线尚待填是已知发布步骤，不列为发现。

本轮只读项目 AGENTS/HANDOFF/development/architecture/ext README、原任务包与报告、外部 review-findings/atomic-contract，并查实际 SDK/runtime/participants/persistence/combo/发现与删除代码。另只读本地 SDK 候选报告及相关修改、P5 树的 settlement module/descriptor；未执行它们。未跑门禁、探针、浏览器或代理，未修改生产、测试、包、P5/SDK 候选，未提交推送。本轮唯一输出为本文；以下执行结果引用原报告，源码结论为静态核对。

## PR-P02-01 — P2：沉眠存读要求未明确可保存的 actor 与时点

**位置**：草稿 §0.6（行 16）；继承的原包 T-PERSIST（`docs/ext/phase5g.dot-package.md:984` 附近）；`src/ext/modules/foraging/tests/foraging_persistence.test.ts:14`。

**原因**：删除“食用后手改 duration=7”是正确的，但当前替代要求仍未说明如何获得真正的“沉眠中”存档。普通玩家食用 drowse 后，`TimeCoordinator.ts:540–553` 在失能期间同步排空强制回合；动画结束取得失能时，`Game.ts:11283` 也同步排空后才提交命令检查点。现有 `foraging_eat.test.ts:52` 已断言安全场景命令返回时 slumber=false、simulationTicks=2500；`:89–96` 验证真实毒伤提前唤醒。仅去掉旧手改再保存，保存的将是已醒玩家，不能证明活动沉眠的持久化。也不能为了制造保存窗口暂停底座调度、在事务回调内保存或修改共享引擎。

**最小补充**：在 §0.6 明确两种证据：

- 玩家：在只读事实观察点断言真实施加 25 回合；分别验证安全场景同一食用命令内自然到期、真实正伤害提前唤醒及命令终态，不要求正常命令结束后还处于沉眠。
- 活动沉眠存读：公开 feed 将 drowse 喂给普通同伴，在该付费命令结束后断言其仍有真实剩余时长，再保存；载入与不载入两组使用相同公开后续命令，分别比较到期及真实伤害唤醒、无法行动期间的行为、需求/知识/模块 state/双 RNG。必须从载入后的当前 Game 重新取得 actor，不能继续读旧对象。

这只需修改 foraging 自有测试/辅助函数/报告；无需新保存协议或调度入口。九类完整新局录像仍留 5Z，并把“沉眠中”录像的 actor/时点一并登记，不能在 5Z 再要求不存在的正常玩家命令间保存窗口。

## PR-P02-02 — P2：物理删除延后，但保留测试对可选模块的已知硬依赖未交接

**位置**：草稿 §0.5“热源与巨兽原三项保留”（行 15）、§1 自有测试范围（行 21–22）、§2“完整物理删除留 5Z”（行 28）。

**原因**：延后运行删除矩阵没有问题，但删除其他模块时，foraging 的测试不会随对方删除。`scripts/test-discovery.mjs:60–74` 将它们全部归 foraging；`check-module-removal.mjs:170–173` 只允许移除实际被删 owner 的测试。现有以下路径无条件要求对方安装，故正常树全绿不能消除该债务：

- `foraging_combinations.test.ts:42–59` 无条件创建 combat/crafting/giants 场景；主组合 rows 的安装过滤没有覆盖这三个用例。
- `foraging_roast.test.ts:9,20,32,45,54,69` 等直接启用 crafting/combat；`foraging_companion.test.ts:113,205` 要求 crafting/giants。
- `foraging_persistence.test.ts:9–11`、leak/UI 的烤制/爆炸场景也无条件加入 crafting。
- `foraging_trace.test.ts:20–34` 无条件执行包含 crafting 的自然 trace B。

在只留 foraging 或只删这些 peer 的副本中，registry 的 `manifest()` 会对缺席 ID 抛 `Unavailable extension`（`src/ext/registry.ts:24–29`）；这是测试配置硬依赖的静态可达失败，不是本轮实际删除门禁结果。仅写“所有删除留 5Z”没有区分延期验收与已知测试适配工作，容易在 5Z 错删 foraging 测试、扩大 exclude 或归责底座。

**最小补充**：明确删除归属和责任：foraging 自有测试只能随 foraging 目录实际删除；共享 fixture/底座测试保留，不能把这些联动测试转移到共享清单、修改发现器或在删除副本额外移除测试。正常七模块树仍执行原三项及两自然 trace。对 peer 物理缺席，按实际 descriptor 能力组织场景，保留 foraging 基础行为及无热源拒绝测试；联动证据只在所需 peer 已安装时注册，不能用缺席时直接 return 冒充一项通过，也不能 skip/todo。通用火/消费/持久化验证不能随热源 peer 缺席整体丢失。

若本返工不处理全部这些测试，至少在包与修订报告逐文件列为 **5Z 前由 foraging 执行者修复的已知测试适配债**，区别于“尚未运行删除验收”。此最低补充不要求现在启动删除矩阵，也不扩大 dot 生产白名单。

## PR-P03-01 — P3：revealed 的计数单位应明确为每事实至多一次

**位置**：草稿 §0.4（行 14）“revealed 只累计新获知识”。

**原因**：本次共享修复把 markKnowledge 的布尔改为真实新增/升格，正确；但新措辞可被理解为按知识行数量计数。原报告 §11 自行决定 #9 是一个事实最多 +1，烤菌同时揭示 raw/roasted 仍只 +1；当前 `participants.ts:28–36` 对两次写的返回值取逻辑 OR，`state.ts` 再增一次。返工不应无意变成两形态首次获得时 +2。

**最小补充**：注明“revealed 计产生新 known 知识的事实数；同一烤菌事实两次 markKnowledge 的返回值取 OR，最多 +1；重复/降级及仅 tasted 不增加”。真实烤菌测试对 raw/roasted 全未知、仅 raw 已知、仅 roasted 已知、全已知四种前提分别断言增量 **1/1/1/0**；eaten 每次有效食用继续 +1，history 可记录观察，不等于统计又有新揭示。无需改 schema、数据或黄金 trace。

## 已核对正确的合同与分工

- **writer 异常边界正确**：草稿 §0.2/3 覆盖旧绝对 never-throw 的错误泛化。写前畸形输入零 writer，qualifies/居民查询兜底；提交异常逸出原参与者，成功仍 undefined，markKnowledge=false 是正常业务结果。`runtime.ts:1677–1698` 原事务已支持 strict/degrade，无需失败锁存、返回协议、SDK 签名或版本变化。三种注入方式及真实原参与者 writer 包装要求足以针对 SDK-03，不把注入缺口称为日常必现。
- **need 不跨错边界**：`ActorNeeds.ts:63–83` 总是 degrade=true，depart 仅在该参与者成功后启动；`feedNeed():185–213` 同样投递 band。草稿保留 feed 内 need 失败的机械结算，不要求整笔 feed 拒绝或自动重投。对照应在参与者入口区分已发生的机械更新/事实分配和参与者暂存写，不能对降级路径要求整条命令所有计数、RNG、消息都回到命令前。环境火亦应保留底座变形/爆炸与底座消息，只丢失败参与者缓冲消息。
- **白名单基本足够**：治疗/再生/知识布尔/旧 fixture 前提/平台输出/runner 归维护者基础修复；dot 恢复模块断言、去 catch、改自有组合/持久化/UI 和报告即可。自有测试可按原 §6.0 用引擎做布景及只读观察，受测动作走公开命令；writer 注错使用测试 descriptor override，不需编辑或 monkeypatch runtime/Game。独立审查文档在白名单内，不代表授权当前审查派代理。
- **无 foraging 分支正确**：settlement-only 用中立 manifest/digest/存读/replay/seek/续录，不调用 foragingFinal/knowledgeView；启用 foraging 时保留 eaten=1。P5 当前 settlement module/descriptor 无 initialCommand，居民查询合法结果为 `{resident:false}`，与 foraging“仅严格 true 排除居民”兼容；不要求 5C1 实现 5D 招募/居民经济。这里只静态核对，没有运行 P5 集成。
- **组合数正确**：安装 settlement 后为 combat/crafting/foraging/giants/growth/narrative/settlement 七生产模块，全子集含空集为 `2^7=128`。返工正常树的相关 rows 应为原七行 + settlement-only + foraging/settlement + 新全七模块行，共 **10 行**；保留的原“全开”六模块行不能被新全七行替换。另两热源加巨兽为 **3 项**，组合文件因此预计 13 项（不含后续新增用例），不是 128 smoke。当前审查树实际只有六模块，不声称已运行七模块。
- **计数报告正确**：741 是原交付历史通过数；模块清单实际 18 个 test 文件 + 1 个 drift 文件，共 19（含原包列表之外已登记的 config_examples）。修订后的数量必须按最终运行器实际结果重新列出，不能把开发重跑、自然 trace 和完整自有集合的重复通过数相加。5Z 的完整 npm/test:ext/128 smoke/删除与长局仍未执行。
- **SDK-02 与录像裁定可保留**：通用拒绝是明确首版规格调整，具体提交码读口仍未实现；不要求再请用户批准或扩大 DTO。确认 No、挂起确认/ACK、拒绝后成功不残留错误、回放只读和零成本仍应保持真实验证，不把投影变化推断描述成完整公共命令结果协议。九类特殊状态完整新局 replay/seek 债务移交 5Z，不降低本次真实效果存读续行要求，不称已完成 T-PERSIST 全部录像。

## 填真实 base 与远端 SHA 时的必要核验

以下是发布步骤，不是占位符缺陷；本轮不执行：

1. 固定新的代码基线 commit、含本包的派发 tip、各自 tree SHA、远端 ref 和 dot 新修订/唯一推送分支。明确新包优先于原 §0/§2/§9/§10.3 的旧分支与门禁指令，旧 ext/phase5g 保留；不得照原包再向该旧分支推送。区分“原执行者执行修订”和维护者组织的独立审查。
2. 核验基线实际包含已验收 5C1、dot 原四提交内容及已验收基础修复。若集成使用 cherry-pick/重建提交导致 SHA 不同，分别登记原链与内容/树对应，不能只凭包含字符串或相同标题认定集成。分别审核维护者集成 diff 和 dot 相对新起始 tip 的返工 diff，后者不得把共享修复算为自有改动。
3. 核对九冻结逐文件 SHA-256 和 fgfixture 树哈希与原包；四种格式及 foundation/worldSdk/edible SDK 值、所有模块身份/指纹、权威数据/200 文案/自然 trace 原件一并检查。当前推荐修复无需升协议/格式或重录黄金；不符要归因维护者基线，不授权 dot 自行修共享文件。
4. 用实际发现结果确认恰七生产模块，夹具不是生产模块；最终相关组合的 10+3 行与 5Z 128 子集分列。保存最终自有测试清单与实际数量；共享基础测试继续只使用 fixture，不要求可删除的生产 foraging 存在。
5. 核验基础审查/相关门禁绑定精确源码输入 hash。SDK 候选报告自述不是独立验收；runner 与平台输出的修复需保持真实平台证据界限，dot 必须实际跑成功 npm drift wrapper。若最终集成使黄金断言失败，先交维护者归因，不让 dot 重录、放宽或隐藏。
6. fetch/远端读取后比对发布 ref 的真实 commit/tree 与本地派发 tip；记录原 ext/phase5g、main/foundation 等受保护 ref 的前后身份。核验修订包及它引用的原任务/报告确实可从发布基线读取，必要 override 不依赖只在本机存在的外部报告；发布基线不等于 foraging 最终验收。
7. 修订浏览器证据绑定最终构建与源码 hash；SDK-02 接受状态、九类 5Z 录像 actor/时点、上述删除测试适配债分别列入交接。环境 blocked 与真实设备未验不得记通过。

生产参照树结束时 HEAD 与开始一致，`git status --porcelain` 为空。完成本文后停止。

## 2026-10-08 定向复审追加：三项合同发现关闭

依据 `phase5g-package-rereview.task.md` 复审维护者修订的同名草稿。此次草稿共 41 行，SHA-256 为 `a3327a22d46cc5954c031303a022764a4d079b821663c395baed8726764fe018`。以上首轮审查全文保留，以下为当前合同结论。

**结论：PR-P02-01、PR-P02-02、PR-P03-01 均已在任务包合同层关闭；本次定向复审无新增 P1/P2/P3。修订合同正确、可在现有白名单及 SDK 内执行。** 这不是产品修复、测试通过或发布批准；真实 base/tip/tree 的填实仍按既定发布步骤执行，本轮无需等待该步骤完成。

| 原发现 | 修订位置 | 复审裁决 |
| --- | --- | --- |
| PR-P02-01 | §0.6，行 18 | 已明确玩家事实观察点施加 25 回合、同命令自然到期/真实正伤害提前唤醒及命令终态；活动沉眠存读改用公开 feed 建立同伴真实效果，检查保存时的剩余时长、到期/唤醒/期间不能行动和载入后的当前 actor。与真实同步调度一致，不再要求玩家正常命令间沉眠保存窗口；5Z 录像也登记 actor/时点。 |
| PR-P02-02 | §0.8，行 20 | 不再仅延期登记债务，而是本轮修复全部已知自有测试/辅助路径，并在外部实际删 crafting、combat、giants 和只留 foraging 四类副本做自有集合/发现归属最小复验。真实 peer 联动按安装能力注册；独立通用规则不借此省略，改用合法自有 fixture。禁止已注册用例缺席 return、skip/todo、额外 exclude、移归共享、删保留测试及 peer 空壳，符合物理所有权合同。 |
| PR-P03-01 | §0.4，行 16 | 已明确统计产生新 known 知识的事实数，双知识 writer 返回值取 OR、每事实最多 +1；四前提 1/1/1/0，重复/降级/仅 tasted 不增加，同时保留消费统计。未要求更改 schema 或数据。 |

针对新要求的可执行性和交叉约束，再核对如下：

- **自有 fixture 有合法接入口。** 冻结 `worldHarness.ts:20–26` 的 overrides 参数可注册自有测试 descriptor，不仅能替换现有生产模块；`EdibleCommands.ts:50–72` 从已启用世界包的工位定义识别 `station.hearth`，没有硬编码 crafting owner。因此可以在 foraging/tests 内声明独立合法热源 fixture，经现有可信布景/公开受测命令验证通用规则，不需修改 SDK/runtime/共享 fixture 或复制被删除 peer 的空壳。fixture 不是第八个生产模块，其 manifest/注册计数须与自然生产组合证据区分。
- **trace B 的适用范围一致。** 正常七模块树两条原 trace 必须运行；物理缺席 crafting 时，只对确实依赖它的 trace B 两类验证不注册并记录原因，原黄金 JSON 不改。trace A 及独立规则继续实际执行。测试文件和清单仍保留，发现归属检查仍能核对所有文件；运行时适用场景减少不等于删除文件、扩大 exclude 或伪记通过。原 §0.5 保留组合及三联动要求由 §0.8 明确限定正常七模块树，未造成删除副本仍必须启用缺席 peer 的矛盾。
- **最小删除复验与 5Z 门禁分工一致。** 此次授权的是四类外部实际删除副本的 foraging 自有集合和发现归属检查，未要求执行默认全矩阵、全部剩余 test:ext、完整 npm test 或 128 子集 smoke。这些完整门禁仍按 §2 留 5Z；外部副本的明确删除授权不等于可修改正常候选的其他模块。记录各副本实际删除文件、注册/执行数量及退出结果，不能把本轮最小复验标成完整 removal 档通过。
- **strict/degrade 基线已补清。** §0.3（行 15）以 strict 命令前和 degrade 参与者入口分别设对照，保留降级路径已经发生的机械更新、事实分配、底座消息与 RNG；`ActorNeeds.ts:63–83` 的 feed 内事件降级和仅成功参与者启动 depart 仍一致。writer 异常需逸出模块、畸形输入写前兜底，未要求扩大事务、失败锁存、自动重投或整条 feed 必拒绝。C5_PROVIDER/诊断/录制属于预期失败反馈，不能被机械回滚比较错误地禁止。
- **分支覆盖明确。** 行 5 已显式覆盖原 §0/§2/§9/§10.3：派发 ref 为 `origin/codex/phase5g-revision-base`，唯一执行/推送分支为 `codex/phase5g-revision`，旧 ext/phase5g 保留；代码 base 与文档派发 tip 的固定 commit/tree 分列。未再继承旧唯一推送分支指令。填实前不可转贴执行的限制与本轮合同复审不冲突。
- **其余裁定保持。** 正常生产相关组合仍为 10 行加原 3 项联动，128 全子集含空集留 5Z；741 仍仅为原交付历史数，修订与各删除副本数量按实际分别报告。SDK-02 通用拒绝、九类特殊布景完整新局录像留 5Z 仍是已有推荐裁定，无需追加用户批准；没有要求改冻结接口、生产数值、原 trace、协议或格式。

本次仅重读修订包、原外部报告和上述相关源码，静态核对可执行路径；没有运行测试、门禁、探针、浏览器或代理，没有操作 P5/SDK 候选，也没有修改任务包或仓库。本报告仅追加本节。发布时仍需完成上一节固定身份、集成内容、冻结哈希、实际发现/测试数量、门禁输入及远端身份核验；其中原第 7 项的删除适配债现已升级为本轮必做工作，应以本次 §0.8 实际回执关闭，不能继续笼统延期到 5Z。
