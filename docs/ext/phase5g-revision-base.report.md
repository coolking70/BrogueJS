# 5G 集中返工基线集成检查

2026-10-08。本轮在 `codex/phase5g-revision-base` 执行外部 `phase5g-base.task.md`；合并由指挥预先完成，本会话没有执行 merge/commit/push/rebase。**指定最小相关集合与完整 npm drift 通过；完整原 foraging_combinations 保留预期的 settlement-only 红灯。未发现本批次非预期失败。** 这是集中返工前的集成候选检查，供指挥另派独立只读审查，不代表 foraging 最终验收或远端基线已发布。

## 1 固定身份、并集与输入

|对象|commit / tree|
|---|---|
|已验收5C1 HEAD|`5dbeb32d17e72124a04156bcdff9b875807cfa48` / `0fd022712497d8481955f129273377bca68763bc`|
|已独立审查SDK MERGE_HEAD|`3f6e237c48f2696513426cfadc85ad79f22ae943` / `bc6795776915f938800fa35a48280c86d7898bb9`|
|共同基线|`5e9753030696d2e8ea177c27007c2f15253d3eba`|
|本批次待提交候选 index tree（不含本新报告）|`c53e46241e9f3ddace63282e07a9807156b40a37`|

SDK 父链含 dot 原 `0fb2720ff1e62ca49cf2f9bcc7b41c550a72d467`，祖先检查 exit0。不能把尚未提交的候选 tree 当作已发布基线 commit；派发 base/tip/tree 和远端身份由指挥在独立审查后填实。

`audit.py` 逐文件比较共同基线、两侧提交、Git index 与真实磁盘。左侧相对共同基线79文件变化，右侧61文件变化，**共同变化文件0**，候选严格等于预期并集；index与工作文件逐字节一致，没有未解决冲突。相对5C1已暂存 **61文件：51新增、10修改、0删除**，正是 dot 部分交付、派发包/边界白名单及已验收SDK九文件修复/两份文档；没有额外生产编辑。

输入覆盖全部已跟踪且包含预合并新增的 **2645文件**，含src/scripts/public/配置/既有文档，逐文件SHA与index-before保存在外部证据。按码点排序“相对路径+NUL+文件SHA-256+LF”聚合：
`ef3b583fab05ccebd0fd73f0ea3d4965bfd70dd91ca77a890efe8b5ab2c65fe8`。

门禁前后2645输入及index已核验逐字节相同（0差异），最终结果见 `audit-after.json`。本报告是唯一新未跟踪文件，不纳入自引用输入。329个模块自有文件全部等于所属已验收/原交付侧（foraging取SDK侧，其他六模块取5C1侧），34个trace/基线相关源码或黄金文件逐字节对应原侧。九冻结文件在共同基线、两父侧和候选全相同；fgfixture树仍 `7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`。没有重新录制黄金。

## 2 生产发现、数据与版本

真实严格发现恰为 **combat、crafting、foraging、giants、growth、narrative、settlement** 七生产目录；fixture不计生产模块。foraging descriptor 明确 defaultEnabled=false。所有模块自有代码、数据、locale、规则身份工厂/指纹算法均保持原件；foraging **46文件、12种、24可食、12节点、18外观、20 nonEaters、200 locale** 不变，两条原自然trace JSON不变。

|模块|版本|自有测试文件数量（发现，不代表全量执行）|
|---|---|---:|
|combat|1.6.0|34|
|crafting|1.0.0|18|
|foraging|1.0.0|19|
|giants|1.0.0|18|
|growth|1.8.0|37|
|narrative|1.4.0|10|
|settlement|1.0.0|15|

foundation10 / worldSdk1 / edible1 / whole-run6 / recording4 / origin2 / SaveDatabase2；源码常量和序列化执行口均按预期核验。版本文件和指纹相关生产源也包含在两侧并集字节核对中，没有误升或重新加盐。严格发现分区 test/gen/drift/ext 为 **507/27/6/253文件**；settlement自然测试仍归其test分区，没有伪称为新增drift文件。七模块全子集应为128，但本轮不执行全子集。

## 3 本批次命令、退出与结果

证据唯一目录 `E=/private/tmp/brogue-commander-20261007/phase5g-base-evidence`。全部Node命令显式PATH前缀 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，实测v24.19.0，NODE_OPTIONS=`--max-old-space-size=3072`，Vitest4.1.11/`--maxWorkers=2`，TMPDIR=`E/tmp`。共享node_modules链接未改，不安装依赖。测试批次依次执行，未同时启动两组Vitest。

以下7个实际门禁/元数据命令，各有 `.command.json`（精确argv/cwd/env/exit/wall）、`.log`；测试另有JSON。passed/failed/skipped/todo分列，不把诊断失败过滤掉或把重复数量相加。

|证据标签|exit|文件数；passed/failed/skipped/todo|wall秒|
|---|---:|---|---:|
|`boundary`|0|非测试命令|2.215|
|`types`|0|非测试命令|8.426|
|`build`|0|非测试命令|13.394|
|`metadata`|0|严格发现与源码格式/版本核验|0.051|
|`related`|0|8文件；208/0/0/0|47.881|
|`combinations`|1|1文件；11/1/0/0|44.871|
|`drift`|0|6文件；12/0/0/0|84.079|

外层wall累加 **200.917s**，只计上述7命令；只读文件/散列审计辅助命令不是测试。Node元数据确认 FORAGING_CAPTURE_DIRECTORY 未设置，原trace测试实际重放断言，未触发捕获旁路。本机darwin；没有新Linux或E2BIG实测声明。

指定八文件 **208 passed/0 failed/skip/todo**，实际逐文件：

|文件|项数|
|---|---:|
|`ext_edible_runtime.test.ts`|52|
|`ext_kind_knowledge_runtime.test.ts`|29|
|`ext_module_ui.test.ts`|10|
|`test_suite_membership.test.ts`|6|
|`foraging_ui.test.ts`|103|
|`settlement_input.test.ts`|2|
|`settlement_inventory_ui.test.ts`|4|
|`settlement_natural.test.ts`|2|

settlement_natural 的D1是原生拾粮/建营/建造/扩区/存取/UI休息/拆除/撤营/存读与录像闭环；D5是先原生D1拾粮，再显式首访D5准备后的资格与付费闭环，保持原测试披露，不称徒步D1→D5自然长局。inventory/input的真实引擎/SFC事件通过不等于浏览器像素或真机触摸。

完整 npm drift **6文件、12 passed/0 failed/skip/todo**。实际文件与严格分区相同：

- `src/ext/modules/crafting/tests/crafting_trace.test.ts`
- `src/ext/modules/foraging/tests/foraging_trace.test.ts`
- `src/ext/modules/giants/tests/giants_spine_trace.test.ts`
- `src/ext/modules/giants/tests/giants_trace.test.ts`
- `src/test/generation_baseline.test.ts`
- `src/test/u_26a_deep_baseline.test.ts`

两份生成基线与原crafting/giants/foraging trace黄金兼容。foraging A/B四项逐命令/decision/终点和save/load/replay/seek/真实续录通过，原trace B与其crafting硬依赖原样保留，不重录，不临时修改测试求绿。

精确最终命令：

```sh
node scripts/check-module-boundaries.mjs
node node_modules/vue-tsc/bin/vue-tsc.js -b
npm run build -- --outDir /private/tmp/brogue-commander-20261007/phase5g-base-evidence/build-final --emptyOutDir --manifest
node /private/tmp/brogue-commander-20261007/phase5g-base-evidence/metadata.mjs
node node_modules/vitest/vitest.mjs run src/test/test_suite_membership.test.ts src/test/ext_module_ui.test.ts src/test/ext_edible_runtime.test.ts src/test/ext_kind_knowledge_runtime.test.ts src/ext/modules/settlement/tests/settlement_inventory_ui.test.ts src/ext/modules/settlement/tests/settlement_input.test.ts src/ext/modules/settlement/tests/settlement_natural.test.ts src/ext/modules/foraging/tests/foraging_ui.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=/private/tmp/brogue-commander-20261007/phase5g-base-evidence/related.json
node node_modules/vitest/vitest.mjs run src/ext/modules/foraging/tests/foraging_combinations.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=/private/tmp/brogue-commander-20261007/phase5g-base-evidence/combinations.json
npm run test:drift -- --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=/private/tmp/brogue-commander-20261007/phase5g-base-evidence/drift.json
```

## 4 已知红诊断与实际组合

原 `foraging_combinations.test.ts` **完整执行12项，exit1：11 passed / 1 failed / 0 skipped/todo**。唯一红灯是 settlement-only 在第30行读取 `final.state.totals`，错误 `Cannot read properties of undefined (reading 'totals')`。前面的manifest检查已通过；该行没有启用foraging，`foragingFinal`的state因此为undefined。这与已审查的G-R06完全一致，属于原模块测试分支缺陷；没有发现settlement或底座生产损坏，不新增补丁，不隐去红灯。

|实际行/场景|本轮结果|
|---|---|
|foraging|通过真实自然采集/吃/存读/replay/seek/续录|
|foraging+growth|通过|
|foraging+narrative|通过|
|foraging+combat|通过|
|foraging+giants|通过|
|foraging+crafting|通过|
|原六生产模块全开（foraging+growth+narrative+combat+giants+crafting）|通过，原行保留|
|settlement-only|预期红：到第30行即异常，不能称此行存读/录像链已通过|
|foraging+settlement|通过真实采集/吃/存读/replay/seek/续录|
|combat热源、crafting热源、giants群体需求/非死亡退役（三项）|分别通过|

当前原文件是 **9组合行+3联动=12项**，标题还写旧seven/64。返工草稿要求 **10组合行+3联动=13项**，差别是还要新增真正七生产模块全开的一行，并修无foraging的终态辅助；不能替换原六模块行。未过滤settlement-only、未临时修原文件，也没有执行全128子集。

## 5 外部空目录构建与边界

构建前 `build-final` 实际为空，`build-empty-before.json`记录。`npm run build -- --outDir E/build-final --emptyOutDir --manifest` 包含最终vue-tsc与Vite；实际输出 **60文件**，含Vite原生 `.vite/manifest.json`。逐文件SHA/字节清单在 `build-final.manifest.json`；路径+NUL+SHA+LF聚合：
`1be69f004220966d9a0e213ab26fb5ffd822f22c174ae0a4d6db230701a38307`。

源输入绑定上列2645文件SHA。构建只出现既有大chunk提示；没有浏览器启动、截图、端口服务、移动设备或地图遮挡验收，不拿5C1旧浏览器final4当成本新合并构建证据。

## 6 历史与集中返工交接

- 本地SDK的 **614 passed+1原有CE skip**、其 **12 drift** 是原六模块候选的历史门禁，已独立审查通过；本批次另有208相关通过、12 drift及原组合11绿/1红，不能跨批次累加或复用为新整合结果。5C1验收文档的浏览器/性能/门禁也只保留其原输入归属。
- SDK-02首版通用拒绝提示已由返工草稿裁定保留，不能称具体按码反馈已完成。冻结worldSdk原有可选lastCommandError，SDK独立审查已经更正旧“没有合法公共读口”的过宽描述；本会话不新增字段/协议或改变固定ForagingView。
- SDK-03三个参与者写阶段catch、真正writer包装故障矩阵仍归dot返工；保留写前验证/qualifies查询兜底，提交异常传播。eat/feed onConsumed和主动roast为strict；环境火及所有need（含feed内）为degrade，不扩大底座锁存或整笔feed事务。
- dot须恢复精确治疗/烤keep-strip、32000面板重采/CAS/零写双流、真实重复known/烤双揭示/爆炸/保存再吃的自有断言。本轮基础/外部SDK历史探针不能替代该交付。
- 持久化仍按修订合同补真实效果；玩家沉眠同一命令排空，用只读施加观察点/到期或伤害唤醒验证；活动沉眠存读用公开feed给同伴，从load后的当前Game重取actor。九类特殊布景各自完整新局录像actor/时点留5Z，不把旧wait两次/手改duration当完成。
- 原trace B与自有测试对crafting/combat/giants的已知硬依赖本轮保持原件。返工包复审关闭的是合同遗漏，不是产品修复；dot在自身白名单内修场景注册/独立fixture与最小删除复验，保留正常树两自然trace和原联动，不加skip/return假绿/宽exclude/删归属测试。
- 本会话唯一仓库新增为本报告；既有生产/测试/配置/报告/README没有编辑或格式化。没有运行完整npm/test:ext、全128组合、删除副本/矩阵、浏览器、ce:fetch/full/gen；未派代理或另起审查，不提交/推送。指挥另派基线只读审查后再决定提交与发布，foraging整包仍待集中返工和验收。

## 7 九冻结最终值

|文件|SHA-256|
|---|---|
|`src/ext/worldSdk.ts`|`297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343`|
|`src/ext/edibleSdk.ts`|`fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b`|
|`src/ext/worldEdible.ts`|`7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67`|
|`src/ext/kindKnowledge.ts`|`4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f`|
|`src/ext/actorNeeds.ts`|`8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e`|
|`src/ext/stats.ts`|`c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84`|
|`src/ext/testing/worldHarness.ts`|`a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0`|
|`src/ext/testing/forageHarness.ts`|`ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38`|
|`src/ext/testing/fixtures/forageFixture/index.ts`|`adc02caaa085519c54a4c0c202ef9f06f1a2b818806bd6b819773f81a4b1abea`|
