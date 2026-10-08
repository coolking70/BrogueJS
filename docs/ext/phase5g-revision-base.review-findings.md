# 5G 隔离返工基线独立审查

2026-10-08，依据外部 `phase5g-base-review.task.md`，完成标记已确认 `exit=0`。

**结论：可发布隔离修订基线，未发现新增 P1/P2/P3 集成问题。** 当前仍是未提交的合并候选，提交、填实派发身份与核对远端由指挥完成；本审查未执行这些操作。结论仅关闭本次基线集成检查，不表示 foraging 或完整5G验收通过。

已完整读取项目 AGENTS/HANDOFF/development/architecture/ext README、执行任务/last/集成报告、SDK独立报告、5C1 acceptance、外部返工template及package审查关闭追加。只新增本报告，证据置于 `/private/tmp/brogue-commander-20261007/phase5g-base-review-evidence`（E）；未改生产、测试、配置、已交报告或dot包，未派代理、运行浏览器、提交/推送/merge/rebase。

## 身份、并集与保护范围

|对象|核对值|
|---|---|
|HEAD（已验收5C1）|`5dbeb32d17e72124a04156bcdff9b875807cfa48`|
|MERGE_HEAD（已验收SDK，含原dot链）|`3f6e237c48f2696513426cfadc85ad79f22ae943`|
|共同基线|`5e9753030696d2e8ea177c27007c2f15253d3eba`|
|当前index tree，不含未跟踪报告|`c53e46241e9f3ddace63282e07a9807156b40a37`|

独立读取四个提交的文件树、Git index及磁盘字节：两父侧相对共同基线分别变化79/61文件，交集为空；候选严格等于两侧预期并集，文件模式/内容均一致，未解决冲突为零。SDK侧包含 `0fb2720ff1e62ca49cf2f9bcc7b41c550a72d467` 的祖先检查通过；没有未归因的合并修改。

- 329个模块自有文件逐字节核对：foraging的46文件直接等于原dot `0fb2720`；settlement的32文件及其他五模块直接等于5C1 `5dbeb32`。foraging数据、200 locale、两自然trace黄金及原dot报告/手册/任务包均保持原件。
- 共享SDK九个修复文件直接等于 `3f6e237`；九冻结文件在共同基线、两父侧、原dot与候选均相同。逐文件SHA见 `E/audit.json`；fgfixture树SHA仍 `7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`。34个trace/基线相关文件匹配所属父侧，未重录。
- 真实严格发现恰七生产模块：combat/crafting/foraging/giants/growth/narrative/settlement。默认值逐项核对：仅growth为true，其余六个为false，foraging与settlement均默认关闭；没有把fixture计成第八个生产模块。
- 对应模块版本为1.6.0/1.0.0/1.0.0/1.0.0/1.8.0/1.4.0/1.0.0；foundation10/worldSdk1/edible1/whole-run6/recording4/origin2/SaveDatabase2，序列化执行口和常量正确。独立发现test/gen/drift/ext为507/27/6/253文件，drift实际执行文件与分区精确一致。

2645个已跟踪输入（含预合并新增）与执行者 `input-before.json`、`input-after.json`及index逐项一致，审查前后保持稳定；聚合SHA-256均为：

`ef3b583fab05ccebd0fd73f0ea3d4965bfd70dd91ca77a890efe8b5ab2c65fe8`

本次复核另保存 `E/input-before.json`、`E/input-after.json`；已有集成报告字节未改，新审查报告不纳入自引用输入。

## 实际验证与已知红灯

核对执行者七项实际命令的argv、环境、exit、日志及JSON，全部绑定上述相同输入；外层wall合计200.917s，未重跑长门禁。`E/executor-gates-audit.json`保存对照。

|执行者本批次|exit|实际结果|
|---|---:|---|
|boundary / vue-tsc / 外部空目录build / metadata|均0|边界与归属、类型、构建、发现/版本核验通过|
|指定八文件相关集合|0|208 passed、0 failed/skip/todo|
|完整原foraging_combinations文件|1|12项：11 passed、1 failed、0 skip/todo|
|实际npm run test:drift包装器|0|6文件12 passed、0 failed/skip/todo|

构建前空目录记录与实际输出核对通过：60文件（含Vite原生 `.vite/manifest.json`），逐文件SHA/字节清单一致，manifest引用资源存在，产物聚合 `1be69f004220966d9a0e213ab26fb5ffd822f22c174ae0a4d6db230701a38307`。构建仅有原大chunk提示；没有浏览器证据复用或新像素验收声明。

组合唯一失败为 **settlement-only** 在 `src/ext/modules/foraging/tests/foraging_combinations.test.ts:30` 解引用缺席foraging的 `final.state.totals`，与既有G-R06一致。该行尚未走完存读/录像链，不能记通过。其余八组合行（含原六模块全开、foraging+settlement）和三联动实际通过；本轮原文件仍是9组合+3联动，共12项。真正七模块全开的新行尚未添加/运行，不能称返工要求的10+3项或128全子集通过。

本审查独立复跑原文件的 **foraging+settlement** 精确参数行，未复制/改断言：公开自然采集、食用、精确manifest、save/load、逐条replay、seek及续录均通过。实际只验证该联合启用下的原foraging链，没有新增建营地或营地经济联动测试。命令为 `node node_modules/vitest/vitest.mjs run src/ext/modules/foraging/tests/foraging_combinations.test.ts -t <该行fullName的锚定正则> --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=E/combo.json`，精确argv见 `E/combo.command.json`；**exit0，1 passed/0 failed/todo，11未选，wall6.365s**。选择复验不替代执行者完整文件exit1诊断。

独立另执行严格发现/版本/默认值元数据探针，exit0、wall0.043s；源码在 `E/discovery-code.mjs`，执行argv及结果见 `E/discovery.command.json`/`discovery.json`。两项独立Node命令均显式使用Node24.19.0 PATH、3GiB堆，Vitest最多2 workers；临时输出在E，FORAGING_CAPTURE_DIRECTORY未设置。散列/文件审计辅助读取不计测试门禁。

## 关闭范围与交接

本次关闭的是：两侧预期并集、来源字节/冻结/格式/发现/默认值正确、稳定输入、指定相关集合/构建/完整drift兼容，以及最小foraging+settlement联合启用无新冲突。SDK六项基础修复的独立通过、5C1本步验收、package三项合同发现的关闭仍按各自原范围成立，不扩大为新产品修复或本批次重跑结果。

仍归dot集中返工：SDK03提交段吞错与真实writer故障矩阵、G-R06中立组合终态及新全七模块行、自有精确治疗/再生/重复知识断言、真实效果持久化与同伴活动沉眠存读、peer缺席后的自有测试适配及四类最小删除复验。SDK02按已裁定保留首版通用拒绝；need/feed内need沿原degrade边界，不扩大底座锁存/事务。合同已关闭不代表这些实现完成。

本轮未执行完整npm/test:ext、128全组合、删除矩阵、特殊布景完整新局录像、浏览器24格、真机或5Z最终验收；原trace B/其他测试硬依赖仍原样保留。指挥完成提交及固定代码base/派发tip/tree/远端核验后可派发返工包，不能把当前index tree称为已发布commit。
