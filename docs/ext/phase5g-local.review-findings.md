> 发布说明：以下保留原独立审查的历史发现及复审结论。当前执行合同以 [集中返工包](phase5g-revision.dot-package.md) 为准。SDK-02已更正：worldSdk原有可选lastCommandError；本轮保留通用反馈，不新增固定ForagingView具体提交码投影。历史“没有公共读口”的笼统描述不作为当前结论。

# 5G dot 包本地独立验收审查

审查对象：`0fb2720ff1e62ca49cf2f9bcc7b41c550a72d467`；实际起始 `7fdc2491cc3014f2c1a3736e262c7ff8b5d39ce7`；代码基线 `5e9753030696d2e8ea177c27007c2f15253d3eba`。日期：2026-10-08（Asia/Shanghai）。只读审查；没有修改产品/既有测试/基线，没有运行 5C1 候选，没有 commit/push/merge、浏览器或代理。

## 裁决

**可作为明确标注“部分完成、待集成”的包暂存，禁止最终验收。** 正常产品问题至少有治疗错误（P1）、再生 UI 阻断（P1）和重复揭示计数（P2）。SDK-02 是错误反馈合同缺口（P2）；SDK-03 是人工 writer 故障下的原子性合同缺口（P2，条件性），本轮没有发现合法正常输入导致真实生产 writer 失败，不能把它升级成已经发生的正常产品 P1。另有模块自有组合测试在未来安装 settlement 后必然进入错误分支（P2 集成测试缺陷）。

dot 已准确披露四条问题和浏览器 blocked，未冒称完整验收；但披露不等于功能已满足。741 项绿只覆盖保留的断言，不能抵消 §12.2 允许移出的治疗、再生投影及故障注入断言。两条自然 trace/七组合也不能代替 T-PERSIST 要求的各特殊状态完整录像证据。

## 1 包完整性与边界

独立脚本与详细清单：`phase5g-review-evidence/audit.py`、`audit.json`、`dependency-check.json`（均在本报告同级的证据目录）。

- 起始至终点恰 **48 个新增文件、7509 行新增**，全部位于 `src/ext/modules/foraging/**`、`docs/ext/foraging-config.md`、`docs/ext/phase5g.report.md`。代码基线至起始仅任务书与边界脚本两文件；代码基线至终点 50 文件、8670 新增/4 删除。其他模块、共享生产代码、既有测试、生成基线及旧黄金 trace 未改。
- 四条单父提交按顺序为 `8efc921d` → `a07b7b23` → `f6337959` → `0fb2720f`，第一条父为实际起始。每条末尾均有 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`；前三条 tree SHA 与交付报告所列相同。这里只验证已 fetch 的本地提交，不重新验证远端账号操作日志。
- 九个冻结文件逐字节等于代码基线；实际 SHA-256 全部等于任务书 §2。fgfixture 目录仅 `index.ts`，树哈希为 `7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`。
- §5.10 权威 JSON 与生产数据解析后深相等（所有数值、键、数组顺序相同）；§7.4 的 **200 条 locale 键和值完全一致**。12 种/24 可食/12 节点/18 外观/20 nonEaters，未混入手册未批准的三个提案。
- 真实 runtime 独立核验 rules 指纹 `sha256:d2e0803474a80f1adfc41680351199da38b7f3e8129df3d58ffd0349488d936f`、owner 世界指纹 `sha256:40ffe3d3924cb9914e7bb7b34879bc024750bf28ac17cf02df27230f8a862bc9`，均符合报告。
- descriptor 默认关闭，无硬依赖；仅消费可选居民查询，不提供查询、不硬引入 settlement。stat 类型从 ExtensionModule 派生；无自造时钟/RNG/调度器，无 Game 机械写入。boundary 与测试所有权发现检查 exit 0。
- 生产 DTO 未输出 definitionId/kind、烤制政策、需求精确值；非 known 食物 satiety 为 null。节点名及同伴名来自公共显示帧；未知回退文案中性。十种真实动作后的 SFC 隐私断言本轮通过。没有发现新增私密种类泄露；这不包括未运行浏览器的像素与遮挡验收。
- 新增文件无 CRLF、无超过 1 MB 原始文件。工作树前后 `git status --short` 均为空。

## 2 四条已报告问题的独立裁决

### G-R01 / SDK-01 — P1：治疗点数被再次按百分比换算

**位置**：`src/engine/Core/EdibleEffects.ts:38–42`；`src/entities/Creature.ts:245–249`。模块数据给的 30%/min5 正确；错误在可信效果执行层。

**复现**：`review.test.ts` 的前两条规格测试使用真实新局、只在场景准备阶段设置 HP/授予食物，被测动作分别为公开 `item:execute eat|字母` 和 `foraging feed`。玩家 maxHP30/HP10，fact.hpGained=2，应为9；哥布林 maxHP15/HP5，fact.hpGained=0，应为5。两条期望断言均真实失败。证据 `sdk01-player.json`、`sdk01-companion.json`、`probes.log`。不是 heal 之后一回合自然恢复造成的观察误差：断言针对消费事实里的即时 hpGained。

**期望/影响**：即时治疗量 `min(缺血量,max(5,floor(maxHP*30/100)))`。低 HP 上限时几乎无治疗，高 HP 上限时也可能放大治疗；不能只称小幅数值误差。

**修复所有权/最小方案**：本地 foundation 内部修 `EdibleEffects` 的点数落地方式，保留 native `Creature.heal(percent)` 的既有语义与必要失效通知。优先使用/整理可信点数治疗路径，不让模块改数值或直接写 Game/HP。不需要九冻结接口的签名或版本变化；本轮未实施。

**必要集成测试**：玩家、普通同伴、低 maxHP 的 min5、缺血量小于治疗值、满血0、烤菌 keep/strip；精确事实 hpGained 和最终 HP 分开断言，补回 dot 删除的精确治疗断言；存读续行/录像验证即时结果。修后跑受影响 edible、native heal 与 foraging eat/feed 专项。

### G-R02 / SDK-04 — P1：再生读口陈旧，使正常 UI 无法重采

**位置**：`src/engine/Core/WorldWorkWorld.ts:348–367,411–438,717`；`src/engine/Core/WorldWork.ts:369–375,744`；模块 `view.ts:24–34`、`ui/commands.ts:2–5`。

**复现**：seed51020001、仅 foraging，合法布景将节点39移到玩家邻格。公开采集三次，公开 wait 到 tick32000。持久行 remaining0/revision6/lastSettledTick200/remainder200；生产模块投影 remaining0、available0、canHarvest=false、C5_RESOURCE_EMPTY；同一时刻合法公开 harvest 却成功，食物3→4，tick32100，revision8。独立规格断言 canHarvest=true 真实失败。证据 `sdk04.json`。

**CAS 核验**：已有内部 `readWorkContext(...,true)` 返回纯物化副本 remaining1，仍保持实际 revision6。读取前后完整 snapshot（只规范化输出时间戳 savedAt）和双 RNG 相同；用其 revision/stamp 提交公开 harvest 成功；随后沿用旧 revision6 并换最新 inventoryStamp，得到 C5_STALE。`sdk04-cas.json`。所以本轮未发现“启用虚拟读就必须递增 revision”的接口障碍。

**期望/所有权/最小方案**：本地 foundation 把公共只读投影转发到已有纯物化读，保留持久行 revision，不在读阶段写世界、分配 ID 或取 RNG。再生时间推导不应伪造一个已提交的 revision；真实采集仍由准备/提交复核。模块必须继续尊重 canHarvest，不能自行计时或强行放行。改可信内部接线即可，无需九冻结接口签名变更。

**必要集成测试**：31900/32000 边界、面板按钮可用并实际重采、反复投影0写/0RNG、满容量不积余、预留扣除、读档/离层物化后读口一致、真实提交后旧 revision 拒绝；底座投影 SDK 与测试 harness 各自核验，不只测试内部 helper。补回 dot 移出的再生投影断言。

### G-R03 / SDK-02 — P2：具体错误反馈没有合法公共读口

**位置**：`src/ext/modules/foraging/ui/useForagingUi.ts:124–139`（同结果推断也见 refresh 的 pending 分支）；`src/ext/ui/types.ts:6–37`；`Game.ts:3573`；`src/engine/Core/WorldWork.ts:137–143`。`worldWorkLastError` 存于可信 WeakMap，不属于模块合法导入。

**独立复现**：真实 Game 给相邻可见盟友麻痹，模块 UI 仍能提交合法 feed；实际结果 C5_GATE、0机械成本。`useForagingUi` 输出 `ext.foraging.ui.rejected`，没有错误码。没有 mock 命令成功/失败；UI 对照与诊断命令均走公开 Game，可信结果仅由审查 harness 读取。证据 `sdk02.json`。

**裁决**：通用“操作未执行，请重新查看”足以在该场景提示拒绝且不泄密；确认 No 在已保留测试中也没有被误当失败。它可用于部分包暂存。**不满足 §7.2 按 C5 码显示具体原因**，且当前是根据“投影有没有变化”推断结果，并非有完整公共命令结果保证；不能宣称所有拒绝路径都已有精确反馈。本轮没有发现由此造成扣费/状态损坏的正常产品 P1。

**修复所有权/最小合同方案**：先由维护者决定是否接受首版通用反馈作为显式规格调整。若仍坚持具体按码反馈，优先让 foundation/shell 在既有显示/消息服务统一呈现当前命令的翻译原因；模块继续只读合法投影，不读内部 WeakMap、不解析日志猜码。若必须显示在模块面板，则集中批准一个带命令关联标识的公共结果读口，并一次交给 dot 接线；不能仅加一个无关联的 lastError 或由 dot 偷扩固定 DTO。本轮没有改变任何接口。

**必要集成测试**：真实威胁/容量/目标失能/距离/CAS 拒绝，确认 No/Yes、挂起确认、回放只读，上一命令拒绝后下一命令成功不沿用旧错误；保证0成本和不显示 code/field/未知种类。具体提示与通用提示的验收须明确区分。

### G-R04 / SDK-03 — P2 条件性合同缺口：写阶段 catch 吞掉故障，事务无法获知失败

**位置**：模块 `participants.ts:23–37,47–52,79–97`；底座 `runtime.ts:979–1006,1677–1698`；任务书 §6.4/6.5 的“绝不抛异常”与 §12.2#5。

**独立复现**：seed1、仅 foraging、公开吃 venom×2。仅测试 override 将传给原生产参与者的 replaceState 替换为抛错函数。原函数先 markKnowledge、message，随后 writer 抛错被 catch 吞掉。结果：known、数量1、营养2149、tick100/turn1、双流改变、录制+1，foraging state 却仍全部0/lastFactId0，诊断为空。证据 `sdk03-swallowed.json`。

**对照**：原参与者完成之后让外层参与者明确抛错，真实命令回滚：unknown、数量2、营养2150、tick/turn0、机械状态及双 RNG 恢复（拒绝事件仍录制）。`sdk03-propagated.json`。既有 roast 专项的“爆炸已执行、后续参与者失败”严格整链回滚也独立通过。

**边界与归属**：这里替换的是可信 writer，并非发现正常可信 writer 自己会随机失败。模块合法事实/state 已预验证、写入值预计算；目前未找到正常生产输入引起这种 writer 故障。因此不可把注入限制宣传成已发生的正常存档损坏，也不可把严格整链回滚通过当成 writer 被内部吞掉时仍能回滚。

**最小合同方案（推荐）**：澄清 never-throw 只约束畸形输入/缺席可选查询等可容错读取；合法事务 writer 故障必须向可信事务传播。保留所有输入验证 catch，把三种参与者的写阶段 catch 收窄/移除。这是**模块侧可修问题**，不是必须新增 SDK 才能解决；九冻结接口的签名无需改变。因为当前任务书明确要求“绝不抛”，须由维护者统一澄清并按 §0 转贴 dot，不能责令 dot 擅自违约。

另一方案是可信 writer 在内部记“事务已失败”标志，回调即使吞错也在结束时拒绝；这只识别真实可信 writer 内部故障，识别不到本探针这种在外层直接替换 writer 后自行抛出并吞掉的任意异常。若选择此方案，故障测试应注入可信写路径，明确保证范围，不声称解决一切人工 wrapper 故障。不建议为此创建补偿事务或扩 SDK 签名。

**必要集成测试**：onConsumed/onFireContact/onNeedEvent 每个 writer 的失败点；markKnowledge 成功后 replaceState 失败、烤菌双知识更新、组件写后消息失败、deadline depart 失败；分别核验命令整笔回滚与时间路径“丢弃模块写并诊断”的既有范围。畸形输入仍不抛/0写；异常不能被换成“成功”。状态、知识、组件、消息缓冲、费用、时间、RNG、ID/收据及对象身份各按相应可信事务写集核验。

## 3 补充发现

### G-R05 — P2：已知菌重复消费仍计为新揭示（正常路径）

**位置**：`participants.ts:28–36,48–50`；`src/engine/Core/KindKnowledge.ts:102–125`；自有测试 `foraging_module.test.ts:145–155`；报告 §11 自行决定#9。

**复现**：真实 Game、seed1、公开吃 might 两次。第一次 eaten1/revealed1；第二次 eaten2/revealed2，知识表前后完全相同，都是同一个 known 行。独立期望 revealed1 失败；`repeated-revelation.json`、`additional.log`。这不是重复 factId 投递，两个真实消费事实有不同序号。

**原因/期望**：模块将 markKnowledge 的 boolean 理解成“知识发生改变”；当前可信函数只拒绝降级，known→known 仍返回 true。单元测试用 mockReturnValue(false) 模拟重复学习，因此没覆盖生产返回语义。报告承诺“重复吃已知菌不重复加”，当前不成立。实际知识单调性和效果仍正确，问题限于状态计数合同，不夸大成种类泄露。

**所有权/最小方案**：本地基础方先明确 boolean 是“真正新增/升格”还是“请求合法”。推荐在可信 KindKnowledge 内部使等值标记也返回 false（与模块需要的幂等含义一致），保留类型签名；审计所有调用者，避免改变有意依赖“合法请求成功”的路径。如果维护者坚持原语义，dot 必须调整计数设计并公开记录取舍；现有参与者 tx 无知识读口，禁止偷偷读引擎或把种类列表塞进自有 state。模块测试/报告由 dot 修订。

**必要测试**：真实 raw known→known 两次消费、重复可见 blast 爆炸、roasted 连带 raw 的首次揭示只计1、部分/全部已 known、tasted→known、拒绝降级与重复同 fact 幂等；同时保存再载入后重复消费。不能只换 mock。

### G-R06 — P2 集成测试缺陷：仅 settlement 行无条件读取 foraging 状态

**位置**：`foraging_combinations.test.ts:10,18–30`；`traceHelpers.ts:25`。

**证据**：测试明确在发现 settlement 后追加 `['settlement']`，前段虽正确改成 wait，随后仍使用 foragingFinal 并无条件 `final.state.totals.eaten === 1`。foraging 未启用时，foragingFinal 序列化结果没有 state。独立用当前已安装的 **growth-only** 真 Game 执行 wait，证实没有该 state，读取 totals 抛错；`foraging-absent-combination.json`。这是对不含 foraging 分支的证据，不是跑 settlement 候选，也不声称验证其注册/初始化/行为。

**期望/所有权/最小方案**：dot 只改自己的测试与辅助函数：不含 foraging 的组合采用模块中性的公共终点/manifest/digest 与存读/录像断言，仅含 foraging 的行才验证 harvested/eaten/knowledge/state。不能删 settlement-only 行、加 skip 或弱化仍启用 foraging 的断言。无需基础修复或 SDK 变更。安装尚未合入的 settlement 后，这条原测试会因自己的断言前提错误阻断，不能归责为 settlement 产品 bug。

**必要测试**：一个当前已安装模块的无 foraging 控制分支；后续集成树上的 settlement-only 与 foraging+settlement 两行（按 settlement 真实开局合同初始化），保持其他七行的完整公开命令/存读/replay/seek/续录检查。

## 4 旧失败与运行环境的裁决

### G-E01 — P2 旧测试前提失效，fixture 隔离语义仍有效

`src/test/ext_edible_runtime.test.ts:120–125` 原用例本轮独立运行，**仍在第122行失败**；第121行“不含 fgfixture”先通过。起始 git tree 完全没有 foraging 目录，现在它是默认关闭的生产模块，恰是本任务要求，不是 fixture 泄漏。另一个独立真实 createForageHarness 探针证实：catalog 不含 fgfixture；foraging 已安装/defaultEnabled=false；只启 fgfixture 的世界包仍为11个可食定义。证据 `old-premise.log`、`old-premise.json`、`dependency-check.json`。

本地维护者后续只修第122行的过时前提：明确生产 foraging 可以安装但默认关闭/不被 fixture harness 自动启用，保留第121行及第124行的 fixture隔离/11定义断言。不整段删、不 skip、不修改隔离断言语义。本轮没有改测试，也没有运行生产模块删除矩阵或旧基线反事实套件。

### G-E02 — P2 可移植性：macOS 固定临时路径

`src/test/ext_world_work_boundaries.test.ts:190–193` 将证据写到 `/private/tmp/phase5a2-D15.json`，在 dot Linux 上先 ENOENT 而未执行后续数值断言，是报告的环境失败。本机 darwin 该目录存在，不能据此称跨平台通过。本轮仅核对源码，没有运行会在证据目录外写文件的该测试。

本地基础测试所有者后续把输出改为平台临时目录/显式外部证据目录，保留所有数值断言与执行路径，不用创建 macOS 专属目录掩盖 Linux 问题。必要测试是在两平台能完成写证据并继续原断言。该项不是 foraging 游戏规则 bug。

### G-E03 — P2 Linux runner 可运行性：发现 JSON 单个环境字符串过大

`scripts/run-test-suite.mjs:17–27` 把完整 JSON 塞入单个 `BROGUE_TEST_DISCOVERY`。本地发现 JSON **132377 bytes**，加变量名、等号与终止 NUL **132400 bytes**；dot 报告 JSON132373 bytes，细小差异不能当作不一致规则数据证据（发现对象还包括环境相关 root）。单字符串规模已超过128 KiB。报告的常见4 KiB页 Linux 32页单字符串限额与此相符，但**本轮未在 Linux 上运行/核验内核限额**。

本机 Node24.19.0/darwin arm64 以同样大环境值启动一个只读 Node 子进程，exit0并回读132377，**没有复现 E2BIG**。本轮未重新跑 npm drift 或全 drift。`platform-check.mjs/json` 保存字节与真实平台结果。

读源码确认 dot 的替代入口仍由 `getTestDiscovery()` 在进程内调用同一严格 `resolveTestSuites()`，六个 drift 文件与报告一致；不是手工缩减集合。但原 npm wrapper失败与替代入口12项通过必须继续分列，不能改写成 npm drift绿。

本地脚本所有者后续去掉大环境值、改为同进程重新发现或受控文件传递；不放宽清单校验、不改分区。必要验证 Linux/macOS 的包装器发现等价、进程正常启动及 npm 套件入口执行结果。无需改九冻结 SDK。

## 5 功能证据与剩余验收债

本轮没有重复741自有全套、完整 npm/test:ext、64组合、删除或全 drift。以下界限必须保留：

| 项目 | 独立证据 | 不能据此宣称 |
|---|---|---|
| 原生吃 No/Yes 与确定性 | 两自然 trace 原确认决策、No零成本、终点一致，本轮4项原trace测试通过 | 每类特殊效果都有从新局完整录像 |
| 食用/喂食 | 真实吃、喂的治疗规格探针；真实失能 feed 的0成本拒绝 | 精确治疗已正确 |
| 烤制/爆炸原子性 | 原roast9项通过，含两热源、三阶、爆燃、拒绝、严格后续失败整链回滚 | 内部 writer 异常被吞掉时仍原子 |
| 再生 | 真实采空/等到32000/直接公开重采、纯物化与CAS通过 | 正常面板可以重采（规格断言失败） |
| UI与隐私 | 原UI103项通过，含十种真实动作后的SFC文本 | 24格浏览器/真实触摸/地图不遮挡已验 |
| 自有 state | 幂等/有界设计、无种类ID；真实发现重复计数缺陷 | 所有揭示统计正确 |
| 特殊状态持久化 | 静态审查 staged save/load续行测试及报告披露 | T-PERSIST九类各自完整replay/seek覆盖 |
| 相关组合 | 静态核对原7行和额外热源/giants证据结构；本轮未重新执行组合文件 | 64子集或含settlement通过 |

**P2 验收证据缺口（非新产品故障）**：`foraging_persistence.test.ts:10–25` 主要是布景状态存读后 wait×2 对照；slumber 用例吃完后又人工设7回合沉眠，不能算消费产生的真实沉眠中从新局录像。离开中/退役后的存读在 companion 文件；每类状态从新局的 replay/seek 不在这些 staged 用例里。报告 §13 已披露，准确，不因此视为满足任务书 T-PERSIST。

修复所有权：dot 的功能测试/报告，维护者的验收合同。最小方案是逐条明确“已做 save/load续行”和“未做完整新局录像”，补能自然触发的真实 trace；对于无法自然稳定触发的布景，需要维护者明确接受范围替代，再用合法命令/确定性测试注册场景证明合同。禁止 origin monkeypatch、往录像塞虚假事件、把布景存读绿改名为新局录像绿。必要核验每种状态的保存时点/真正生效条件、继续执行的效果与到期/离队边界，而非只两个 wait 和一个摘要。

浏览器本轮按任务禁止运行。dot 的24格blocked仍保留；本机是否可运行应以后续实际预检为准。建议维护者在最终修复后的**精确源码与构建 hash**上，用既有本地浏览器工具和共享显示入口补1440×900/390×844/320×844 × 普通/沉浸 × 四地图；逐格核验长名、满包、无热源、多同伴、离开中、连点、blur、真实/模拟触摸、回放以及玩家邻格/预警遮挡。不得拿另一5C1构建或先前矩阵混标。本报告只给路线，不启动服务/浏览器、不安装或改工具。

## 6 本轮实际命令与结果

仓库根：`/private/tmp/brogue-commander-20261007/phase5g-review-tree`。

统一环境：`PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`，真实 node `v24.19.0`；`NODE_OPTIONS=--max-old-space-size=3072`；Vitest `--maxWorkers=2`。Vitest4.1.11。共享链接 `node_modules -> /Users/coolking70/Documents/同步空间/BrogueJS/node_modules`，未安装包/未改锁文件；实际读取182个已安装 package.json，版本全部符合本树 package-lock（无缺失、无不符），不能直接把平台安装包数量与dot Linux的181包做同数量承诺。没有CE缓存，启动提示缺CE；本轮选中的测试无CE依赖skip。

证据目录 `E=/private/tmp/brogue-commander-20261007/phase5g-review-evidence`（以下 E 仅为说明缩写，实际命令用完整路径）。

| 命令/选集 | exit | 实际结果 | Vitest耗时 |
|---|---:|---|---:|
|`node scripts/check-module-boundaries.mjs`|0|边界和所有权通过，`boundary.log`|非Vitest |
|`node node_modules/vitest/vitest.mjs run --config E/review.config.ts --maxWorkers=2`，首批8探针|1|5 passed / **3 spec failed** / 0 skipped / 0 todo|8.56s |
|`node node_modules/vitest/vitest.mjs run src/ext/modules/foraging/tests/foraging_roast.test.ts src/ext/modules/foraging/tests/foraging_ui.test.ts src/ext/modules/foraging/tests/foraging_trace.test.ts --maxWorkers=2`|0|3文件，**116 passed** / 0 failed/skipped/todo|35.72s |
|外部config，`-t 'additional spec'`|1|新增真实重复揭示规格1 failed；其余8按名称未选中|2.19s |
|原`src/test/ext_edible_runtime.test.ts -t 'registered fixture grants never leak'`|1|1 failed；其余39按名称未选中|1.62s |
|外部config，`-t 'additional diagnosis'`|0|无foraging控制分支1 passed；其余9按名称未选中|2.36s |
|外部config，`-t 'old premise diagnosis'`|0|fixture保留语义1 passed；其余10按名称未选中|2.06s |
|`python3 E/audit.py`、依赖实际版本检查|0|完整性/依赖核对通过|非Vitest |
|`node E/platform-check.mjs`|0|字节核验；darwin子进程exit0|非Vitest |

Vitest命令同时用了 `--reporter=default --reporter=json --outputFile.json=E/<对应结果>.json`，stdout/stderr分别在同名log。`review.test.ts` 为外部独立审查测试，只复用经核对的自有 helpers 做场景准备与公开命令；产品源码未修改。首批8项的源码另存 `review-core.test.ts`；随后向 `review.test.ts` 追加三项并逐项用 `-t` 执行，历史数量以相应JSON为准（现有文件全跑会是11项，本轮未再次全跑）。`final-evidence-manifest.json`登记最终证据散列及干净提交输入。config继承本树 Vue插件/CE setup，include 仅审查文件，未改变生产测试发现器或任何门禁清单。`-t` 是明确的专项选集，表中未选中数量不是新加 skip/todo，也不是完整门禁通过。

初次外部探针有编写/布景检查错误：一次语法括号导致0项执行，随后 snapshot比较包含自然变化的 savedAt、observeDisplayFrame漏传logger。修正仅限外部探针（savedAt规范化，仍比较全部机械snapshot字段），第二次设置错误日志保留在 `probes-setup-errors.log`；表中首批8项以修正后的 `probes-result.json/probes.log` 为准。两条治疗与一条再生的规格期望未改，也没有改成错误实际量求绿。

## 7 维护者处置与一次集中转贴建议

**本地基础修复**：G-R01治疗、G-R02公共纯物化读/CAS、G-R05 markKnowledge返回语义（先统一定义）、G-E01旧fixture前提、G-E02临时输出可移植性、G-E03 runner。全部优先内部修复，九冻结文件无需改接口签名；测试前提只做明确归因后的窄修改。修复改变实际规则结果时，以最终集成输入重新验证存读/录像；如黄金数据确实受影响，按维护者适用政策登记真实变更，不在本审查阶段改基线。

**须按任务书 §0 集中转贴 dot**：

1. G-R04先明确 never-throw边界，再调整自有三种参与者的写阶段catch；保持畸形输入0写容错，补故障原子性测试。
2. G-R06修复不含foraging的组合测试分支，保留settlement-only行，不删除/skip。
3. G-R05补真实重复known消费/爆炸/烤菌双揭示测试；不得继续用mock返回false代替生产行为。
4. 待本地基础修复可用，补回SDK-01精确治疗、SDK-04再生面板投影断言，并更新报告，不修改设计数值/名单。
5. G-R03由维护者明确临时接受通用提示还是统一具体错误显示合同；若新增公共读口须先集中批准，dot不得扩接口。
6. 逐项交代T-PERSIST特殊状态录像剩余范围，补能执行的真实证据；无法满足的需明确验收范围裁定，不能再用741绿收口。

只需一个协调后的基础版本/合同通知和一轮dot模块修订，避免四问题各自扩协议。保留原交付和本轮红灯证据。浏览器、相关组合集成补验及5Z全量收尾另行执行；本轮到外部报告交付即停止。
