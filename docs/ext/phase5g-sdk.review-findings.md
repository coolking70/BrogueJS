# 5G 本地 SDK 修复独立审查

2026-10-08。候选树 `/private/tmp/brogue-commander-20261007/phase5g-sdk-tree`，HEAD `0fb2720ff1e62ca49cf2f9bcc7b41c550a72d467`。执行者完成标记为 `exit=0`；依据外部 `phase5g-sdk-review.task.md` 审查。

**结论：本轮 G-R01/R02/R05/E01/E02/E03 底座修复可提交；未发现候选新增 P1/P2/P3 问题。该结论不等于 foraging/5G 整包验收通过。** 审查只新增本报告，未修生产代码或既有测试，未提交、推送、合并，未派代理、运行浏览器或触碰 p5/5C1 候选。

## 独立验证结论

已读项目 AGENTS、HANDOFF、development、architecture、ext README、执行任务书、原独立审查报告、atomic-contract、执行者 last/status/report；核对全部最终门禁的命令、日志、JSON 和输入散列。以下结论还使用本次独立真实 Game 探针，不只采信执行者报告。

|项目|独立结果及代码审计|
|---|---|
|G-R01 点数治疗|`EdibleEffects` 已计算点数改交 `healPoints`，不再二次按百分比折算。真实 eat/feed 核验 maxHP30 的 +9、同伴最小 +5；新增独立 maxHP3/HP1 封顶 +2、maxHP37/HP1 截断 +11、满血 +0，事实 hpBefore/maxHp/hpGained/applied、最终 HP 和扣除一份物品一致。候选核心表另覆盖 +5/+60/缺血封顶，删除 foraging 后仍可执行。|
|原生 heal 合同|`heal(percent,panacea)` 原算式、封顶、dirty 和 terminal 清理次序保留；额外整数截断不改变原算式结果。独立 maxHP37、percent=0/3.9/30/100/-5 精确对照；panacea 的降至 1、清零及存留状态分别断言。候选核心用例还验证 stats revision 与从死亡恢复时 clearTerminal。审查 Monster、ItemUseCoordinator、Game 的全部四处原生调用，没有改其百分比输入。|
|G-R02 纯再生读|公共 SDK 显式 true，默认 true 覆盖冻结 harness；复用既有 materializedNode 副本。独立真实耗尽并等待，31900 读 0、32000 读 1；20 次 SDK/harness 读的完整 snapshot（仅规范化 savedAt）、原行身份/内容、双 RNG、下一实体 ID 完全不变。保存载入投影相同；投影 revision 实际采集成功，旧 revision 配最新 inventoryStamp 仍 C5_STALE；reservedUnits=1 保留且拒绝 C5_RESERVED，满容量副本余数归零而原行不写。prepare 原来已 true；未发现其余生产调用依赖默认 raw。|
|G-R05 知识布尔|等值/降级现在 false；新增/严格升格 true。独立 tasted 重复、known 重复/降级、错误 owner 均验证零状态/RNG变化。真实 crafting 炉烤 venom 后，raw/roasted 的 none/raw/roasted/both 四种预知组合首次揭示只 +1/+1/+1/+0，save/load 再吃 eaten +1 而 revealed 不变。全部生产调用：EdibleEffects/FireContact 只转发；fgfixture 两参与者忽略结果；foraging 消费/火焰参与者用于实际揭示计数，tasted 返回值忽略。无“合法请求即 true”的必要调用。|
|E01 核心隔离前提|只撤去旧“不含生产 foraging”前提，新增 fixture manifest 精确等于 `['fgfixture']`；原不泄漏 fgfixture 与 11 定义断言保留。独立外部副本物理删去 foraging，其他输入保持原字节，相关 14 用例真实通过；核心新增测试不导入生产 foraging。原探针还独立确认当前安装的 foraging default-off。|
|E02 临时路径|仅改 `join(tmpdir(), 'phase5a2-D15.json')`，原数值/预算断言逐字保留。本次设置外部 TMPDIR 后原 10000 单批/十个1000批用例通过，文件实际写入该目录：HP 2/11、nutrition 都1700、elapsed都10000、turns 1/10、均 completed。|
|E03 runner|父进程仍完整严格发现，子进程删除包括继承值在内的 BROGUE_TEST_DISCOVERY，然后走现有同一发现。独立主动继承旧 132374-byte JSON，真实 wrapper→Node 子进程确认变量不存在、完整 discovery 深相等，test/gen/drift/ext 为490/27/6/236；删除副本为472/27/5/217。两次有限实际 wrapper 测试也成功，不以 preload 提前退出冒充测试门禁。|

代码差异限九个授权文件。没有新增 skip/todo、提高超时、放宽发现清单或改失败断言以适配错误行为。E01 执行者的旧前提红灯、只删除 foraging 的单变量绿灯及修订后绿灯已核对；三项生产单变量回退分别重新触发治疗、再生、重复知识失败，恢复后输入与最终门禁一致。新增预留测试首次错误预期 C5_RESOURCE_EMPTY 后改为执行路径实际的 C5_RESERVED，属于新增测试纠错，原断言未削弱。

## 证据、命令及门禁归属

本次证据目录：`/private/tmp/brogue-commander-20261007/phase5g-sdk-review-evidence`（下称 E）。Node PATH 显式前缀 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，实际 v24.19.0；NODE_OPTIONS=`--max-old-space-size=3072`；Vitest `--maxWorkers=2`，TMPDIR=`E/tmp`。未安装依赖。

`E/run.py` 记录完整 argv/cwd/exit/外层 wall；以下五个最终命令均 exit0，外层 wall 合计 **29.544s**。每项有同名 `.command.json`、`.log`，测试有 JSON；`review-command-audit.json` 汇总。

|标签|实际命令/数量|wall秒|
|---|---|---:|
|probes|`node node_modules/vitest/vitest.mjs run --config E/review.config.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=E/probes.json`；2文件24 passed/0 failed/skip/todo|12.810|
|no-foraging|在 `E/without-foraging` 执行 `node scripts/run-test-suite.mjs test src/test/ext_edible_runtime.test.ts src/test/ext_kind_knowledge_runtime.test.ts -t 'point healing\|native healing remains\|public and harness node reads\|knowledge boolean\|registered fixture grants' --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=E/no-foraging.json`；2文件14 passed、67未选、0 failed/todo|10.270|
|tmp-path|候选树执行 `node scripts/run-test-suite.mjs test src/test/ext_world_work_boundaries.test.ts -t '10000 single batch' --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=E/tmp-path.json`；1 passed、11未选、0 failed/todo|3.951|
|boundary|`node scripts/check-module-boundaries.mjs`|2.388|
|runner|`node E/runner-probe.mjs`；真实子进程发现诊断，不执行 Vitest 用例|0.125|

另有一次同 probes 命令的首轮 **exit1**：外部新增探针错误地从不存在的 Entity 文件导入 getNextEntityId，13条新增断言未运行，原11条通过。仅修正外部 import 到 Creature 后重跑；断言未改。保留 `probes-setup-import-error.log`（Vitest duration9.13s；该次外层 wall 未单独留存）。因此独立验证共 **6 次外层尝试，5 次最终成功**，不是省略一次红灯。24 个绿灯中包含原 SDK03 吞错、SDK02 通用反馈、无 foraging 组合缺口的诊断断言；这些绿灯说明原问题仍可复现，不能作为关闭问题的验收证据。

执行者证据目录 `/private/tmp/brogue-commander-20261007/phase5g-sdk-evidence` 的全部18项结果已核对（`executor-results-audit.json`）。采用而未重复运行的最终门禁：相关26文件 **614 passed/0 failed/1原有CE skip/0todo**，types、build、boundary exit0；实际 **npm run test:drift -- --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=…/drift.json** 为6文件12 passed/0failed/skip/todo。六个 drift 文件与严格发现完全一致：crafting_trace、foraging_trace、giants_spine_trace、giants_trace、generation_baseline、u_26a_deep_baseline。没有重录黄金文件。唯一相关 skip 是既有 U14a CE fear/darkness 源码对照，缺 CE 参照，与本次修改无关。

Linux 环境未获得。本次仅有 darwin 实际 wrapper、严格选集等价、平台 tmpdir 写出与源码可移植实现证据；不声称 Linux/E2BIG 实测。旧发现环境条目132397字节超过常见 Linux 4KiB 页的单字符串131072字节，新 wrapper 已移除该条目。完整 npm drift 通过来自执行者实际门禁，独立 preload 探针仅用于环境和发现等价验证。

## 输入完整性

本次 `input-before.json` / `input-after.json` 覆盖 src/scripts/public 和 package、lock、Vite、tsconfig、eslint、index 入口，共 **1168 文件**；逐文件无增删改，路径+NUL+SHA256+LF 聚合 SHA-256 前后均为：

`88f16a6fc211085abc290eb0ffdcd69a72f0d6432e8164bd26b84e9da5d27d79`

执行者最终门禁1275输入逐文件与当前候选 **0差异**，门禁聚合 SHA 为 `ea0c54e3dc4708a00db4a06c7f9f27f31cac6de53747ef3a3128658fbad7b7e1`。九冻结文件与任务/原审查散列全部相等；所有模块与 dot 文档 **0diff**，foraging 的46文件（含权威数据、200 locale、原trace/报告）未改；fgfixture 树哈希仍 `7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`。`audit.json` 和外部副本 `without-foraging-input.json` 保存机械对照。报告本身不纳入自引用源码输入散列。

## 原审查更正及仍待 dot 的事项

**原 G-R03 文字更正（P3，审查描述范围，不是本候选缺陷）**：底座冻结 `src/ext/worldSdk.ts:435` 原已有可选 `lastCommandError()`，WorldWorkWorld 原实现转发，crafting/view 已使用。原报告若被理解为“底座没有合法公共错误读口”，该表述过宽，应更正为“固定 ForagingView 未投影错误、当前 UI 仅通用拒绝”。复现/核对：查看上述接口及 `src/ext/modules/crafting/view.ts:149`。最小建议是先由指挥裁定固定 DTO/反馈规格；本阶段按授权保留首版通用提示，不新增错误协议、字段或改九冻结文件。原报告文件保持不动，在此登记勘误。

- **G-R04 / SDK03 原P1仍未关闭**：模块写阶段 catch 仍吞人工 writer 故障；独立原诊断仍见消费/知识已提交而 eaten 未写。正常生产未观察到自然 writer 故障。dot 应按 atomic-contract 去掉三个写阶段吞错 catch，保留写前/查询兜底，补真实原参与者故障矩阵；need 事件沿原降级边界，包括 feed 内 need，不扩成整笔 feed 回滚。本轮未扩大底座锁存/事务范围。
- **G-R06 原P2仍未关闭**：foraging 关闭时 final helper 无 state，组合测试仍假设 state.totals.eaten。独立 growth-only 探针重现；dot 应补无 foraging 分支和将来 settlement 组合的正确验收，不触碰当前5C1候选。
- dot 自有 eat/feed/roast 精确断言、32000面板可采、真实重复知识/可见爆炸与保存再吃、特殊状态完整从新局录像/持久化证据仍须恢复或补齐。外部临时规格探针与执行者18项恢复规格探针不能替代模块自有交付。
- 浏览器24格、完整741/全 npm/test:ext、全组合、生产删除矩阵和5Z最终验收未在本任务运行；不能由本轮局部绿灯推断通过。

本次审查没有候选代码修复建议或新增阻塞。本轮六项基础问题可关闭并进入指挥的提交步骤；完整5G保持待修订/待验收状态。
