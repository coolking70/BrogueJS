# 5G foraging 交付报告

## 1 结论

部分完成（模块实现交付，SDK与浏览器验收缺口保留）。仅foraging的新局发现→采集→吃/扔/绰号→知识→存读/录像闭环可玩；同伴规则已通过真实命令覆盖。已采空节点再生后的UI重采被SDK-04挡住，回复量被SDK-01算错，不能宣称完整设计验收。可选热源烤制实现并有真实crafting/combat验证。最终门禁仅说明已保留测试通过，不掩盖明确移交的SDK断言。

## 2 基线与环境

- 代码基线：`5e9753030696d2e8ea177c27007c2f15253d3eba`
- 实际起始tip：`7fdc2491cc3014f2c1a3736e262c7ff8b5d39ce7`，来自`origin/ext/phase5g-base`
- 工作/唯一推送分支：`ext/phase5g`，没有merge/rebase/tag/PR或其它分支推送
- 新隔离云checkout；既有任务目录未动，未使用用户Mac
- 开工状态干净；相对代码基线恰两文件：`docs/ext/phase5g.dot-package.md`、`scripts/check-module-boundaries.mjs`
- Node `v24.19.0`；所有Node门禁堆限制`NODE_OPTIONS=--max-old-space-size=3072`；Vitest `--maxWorkers=2`
- `npm ci --cache ../npm-cache --prefer-offline --no-audit --no-fund`成功，181包；未改依赖或锁文件
- 最终提交身份在交付消息与远端分支核验中给出；报告自身属于最终提交，不虚构自引用哈希

### 发布路径与提交身份

普通HTTPS git push因云恢复后无凭据失败（`could not read Username ... terminal prompts disabled`），改用已授权的GitHub连接器创建同内容树、同消息、同顺序单父链，只创建`ext/phase5g`。没有合并、rebase、tag、PR或其他分支写入。

| 本地源提交 | 连接器提交 | 树SHA（逐项相同） |
|---|---|---|
|9e43e983f48d35fb63de7a28cdf289558d9d7611|8efc921d6af34e995e5024fa96057c3c3bfbc0a0|eb0bd176547afb1ade3960f1edaf32651a7afaa9|
|fdc0eca88132684723903b410bc9fc3f8bb4f4ba|a07b7b2364dfaef7e3f3cad65428cc5210006959|9ebbce4a5a555c6bb02c7cea13c9980b22b40a3f|
|b9ab14a7862bf78153988c7d7ba448e13f8b6706|f63379598b815433ddf4c2c7c2acb52e94fe5af2|76f5a89c3c20e4dbd0f84e867f733c9cebccfdf2|

三个内容提交消息及末尾Co-Authored-By逐字保留；连接器使用已连接账号coolking70及服务器提交时间（第三条2026-10-07T14:29:04Z），与本地dot提交者/执行器时钟不同，所以commit SHA不同，tree SHA相同。报告自身在第四条报告提交，加入本段发布事实后只更新报告文件；不写不可能自引用的最终commit SHA。最终远端完整SHA、四条链和最终树核对结果在交付消息给出，可从本报告GitHub提交链接直接查验。

冻结检查：开工及最终任务书§2九文件SHA-256全部一致；最终git diff验证整个共享树相对起始tip无改动。fgfixture树算法为码点排序路径+NUL+文件SHA+LF，实际树哈希`7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`也一致。

| 文件 | SHA-256 |
|---|---|
|src/ext/worldSdk.ts|297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343|
|src/ext/edibleSdk.ts|fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b|
|src/ext/worldEdible.ts|7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67|
|src/ext/kindKnowledge.ts|4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27d90a184f|
|src/ext/actorNeeds.ts|8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e|
|src/ext/stats.ts|c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84|
|src/ext/testing/worldHarness.ts|a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0|
|src/ext/testing/forageHarness.ts|ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38|
|src/ext/testing/fixtures/forageFixture/index.ts|adc02caaa085519c54a4c0c202ef9f06f1a2b818806bd6b819773f81a4b1abea|

## 3 交付清单

所有自有改动仅`src/ext/modules/foraging/**`、`docs/ext/foraging-config.md`、本报告。任务书与白名单脚本为起始tip带入，本轮没有修改。48个新增文件；无任何自有文件越界。完整清单：

```text
docs/ext/foraging-config.md
docs/ext/phase5g.report.md
src/ext/modules/foraging/commands.ts
src/ext/modules/foraging/data/definitions.json
src/ext/modules/foraging/data/natural-trace-hearth.json
src/ext/modules/foraging/data/natural-trace.json
src/ext/modules/foraging/definitions.ts
src/ext/modules/foraging/descriptor.ts
src/ext/modules/foraging/index.ts
src/ext/modules/foraging/knowledge.ts
src/ext/modules/foraging/locales/zh_CN.json
src/ext/modules/foraging/module.ts
src/ext/modules/foraging/participants.ts
src/ext/modules/foraging/schema.ts
src/ext/modules/foraging/statSources.ts
src/ext/modules/foraging/state.ts
src/ext/modules/foraging/test-suites.json
src/ext/modules/foraging/tests/foraging_combinations.test.ts
src/ext/modules/foraging/tests/foraging_commands.test.ts
src/ext/modules/foraging/tests/foraging_companion.test.ts
src/ext/modules/foraging/tests/foraging_config_examples.test.ts
src/ext/modules/foraging/tests/foraging_data_tables.test.ts
src/ext/modules/foraging/tests/foraging_eat.test.ts
src/ext/modules/foraging/tests/foraging_feed.test.ts
src/ext/modules/foraging/tests/foraging_fire.test.ts
src/ext/modules/foraging/tests/foraging_imports.test.ts
src/ext/modules/foraging/tests/foraging_knowledge.test.ts
src/ext/modules/foraging/tests/foraging_leak.test.ts
src/ext/modules/foraging/tests/foraging_module.test.ts
src/ext/modules/foraging/tests/foraging_names.test.ts
src/ext/modules/foraging/tests/foraging_nodes.test.ts
src/ext/modules/foraging/tests/foraging_persistence.test.ts
src/ext/modules/foraging/tests/foraging_roast.test.ts
src/ext/modules/foraging/tests/foraging_schema.test.ts
src/ext/modules/foraging/tests/foraging_trace.test.ts
src/ext/modules/foraging/tests/foraging_ui.test.ts
src/ext/modules/foraging/tests/mechanicsHelpers.ts
src/ext/modules/foraging/tests/naturalCapture.ts
src/ext/modules/foraging/tests/traceHelpers.ts
src/ext/modules/foraging/types.ts
src/ext/modules/foraging/ui/ForagingCompanionHud.vue
src/ext/modules/foraging/ui/ForagingEntry.vue
src/ext/modules/foraging/ui/ForagingPanel.vue
src/ext/modules/foraging/ui/commands.ts
src/ext/modules/foraging/ui/descriptor.ts
src/ext/modules/foraging/ui/useForagingUi.ts
src/ext/modules/foraging/ui/view.ts
src/ext/modules/foraging/view.ts
```

- 相对实际起始tip：`48 files changed, 7509 insertions(+)`
- 相对代码基线：`50 files changed, 8670 insertions(+), 4 deletions(-)`
- 后者额外两文件就是起始tip带入的任务书与白名单脚本，不是本轮自有修改。

## 4 版本与身份

module/rules `1.0.0`，module id `foraging`，rules schema1，state schema1，payload v1，worldSdk1，edible SDK1。descriptor引用`FOUNDATION_PROTOCOL`（基线10），defaultEnabled=false，不声明硬依赖或optional query提供者。

规则指纹：`sha256:d2e0803474a80f1adfc41680351199da38b7f3e8129df3d58ffd0349488d936f`，与任务书参考值相同。完整pack入指纹，locale不入。世界包指纹由foundation生成：`sha256:40ffe3d3924cb9914e7bb7b34879bc024750bf28ac17cf02df27230f8a862bc9`（真实seed2 runtime读取）；本模块不重算外观或烤制抽样。

## 5 数据一致性

§5.10 JSON逐字提取，§7.4既有200条locale值逐字一致；无新增locale键。T-DATA核对黄金包/全部值与顺序，T-NAME固定18外观/12已知名称及模板快照，禁用词扫描0命中。生烤同字形同色，爆燃无烤定义，24可食/12节点/18外观/20 nonEaters。

## 6 SDK 差异与问题清单

### SDK-01 heal-fraction重复百分比换算

- 条款：§5.2、T-EAT，mend回复max(5,floor(maxHP×30%))
- 实际：`EdibleEffects.applyEdibleEffect`先算出点数，再传给把参数当百分比的`Creature.heal`，形成第二次百分比换算
- 最小复现：真实Game，玩家maxHP30/hp10，授予`foraging.mend`，公开`item:execute eat|<letter>`；实际fact.hpGained=2，应为9；普通哥布林maxHp15/hp5经公开feed实际+0，应至少+5
- 影响：回复量错误，种类/饱腹/揭示及其他效果继续工作；没有改模块30%/min5或绕过SDK
- 建议本地修订：可信效果层把计算后点数交给点数式治疗路径，或正确调用百分比接口并保持min5约束；修后恢复精确回复量断言
- 处理：按§12.2保留最小复現证据，不在提交套件留下已知SDK错误的失败断言，也不skip/todo或迎合错误量

### SDK-02 固定投影缺少提交错误读口

- 条款：§7.2提交拒绝要求按码映射；§7.1固定DTO无lastError，host执行返回void，共享DisplayFrame亦无命令错误
- 最小复现：T-UI提交保持DTO不变的拒绝，模块合法读口不能取得C5码；节点卡片自有reason仍能正确显示具体原因
- 影响：提交失败显示已有`ui.rejected`，确认No例外；不向玩家显示内部码/field，不读引擎私有错误
- 建议本地修订：批准模块DTO增加受控错误读口，或统一host命令结果协议。当前保留不泄露的通用反馈

### SDK-03 注入式writer故障与never-throw的原子性张力（非正常生产故障）

- 条款：§6.4/6.5要求参与者绝不抛；可信runtime只有回调抛出时才回滚其暂存写
- 最小复现：seed1，仅foraging，测试场景移除活动/休眠敌人，添加venom×2，营养2150、tick/turn0；descriptor测试override把原onConsumed的tx替换为以下包装，再公开吃并同步答Yes：

```ts
onConsumed(fact, tx) {
  original.onConsumed?.(fact, {
    ...tx,
    replaceState() { throw Error('injected writer failure'); }
  });
}
```

- 期望故障原子性：unknown、数量2、营养2150、tick/turn0、两流不变、初始state
- 实际：known、数量1、营养2149、tick100/turn1、两流改变、录制+1；state却仍lastFactId0/全部totals0/history空
- 这是人为替换可信writer后的可复现限制，不是观察到的正常SDK writer故障；不得与SDK-01正常治疗错误混为一谈
- 按明确never-throw保留防御catch；已把所有模块输入验证与两种记账结果预计算移至任何writer调用之前。没有补偿事务、SDK旁路或私有写入
- 本地建议：澄清never-throw是否只限畸形输入，或SDK给所有writer失败提供可原子丢弃的结果协议。未经批准不采用传播writer异常的替代实现
- 失败注入断言按§12.2移至本报告，不以skip/todo或伪通过保留；正常事务及畸形输入测试仍保留

### SDK-04 再生节点读口未物化，UI错误禁用可采集菌丛

- 条款：§5.4/T-NODE的32000tick再生、§7.1按readWorkContext.remaining计算采集可用性
- 最小复现：`foraging_nodes`用例“one paid 100-tick harvest…”；seed51020001仅foraging，布景节点39（venom-patch）于(11,10)，公开harvest3次后wait至simulationTicks32000
- 实际持久行：remaining0、lastSettledTick200、regenRemainder200、revision6；生产projectForagingView节点显示remaining0/available0/canHarvest:false/reason:C5_RESOURCE_EMPTY
- 同一时点直接发送合法公开harvest却成功`{recorded:true,error:null}`，背包菌3→4、tick32100；节点更新lastSettledTick32000/remainder0/revision8
- 原因：`WorldWorkWorld.readWorkContext`默认virtual=false；公开worldWorkReadSDK转发时没有启用virtual物化投影，prepare/commit却使用物化节点
- 影响：已采空且原地再生的菌丛在面板仍灰态，正常UI不能发出已可成功的采集；初始采集及直接公开命令再生机制可用。此为实际用户可见缺陷，不能宣称完整再生UI通过
- 建议本地修订：底座只读SDK返回基于当前时钟的纯物化副本（保持0写/0RNG），同步核验revision/CAS；模块不自行算时钟或绕过canHarvest
- 按§12.2保留真实成功采集/再生用例，把失败投影断言转本清单，未skip/todo或修改底座

## 7 门禁结果

### 开发里程碑（各次真实结果，最终门禁另列）

- M1：初次数据/导入/schema/名称四文件349 passed，0 failed/skipped/todo，8.70s；随后增加一个keep/strip种子覆盖，名称7 passed，11.10s，合计当前350个M1用例。boundary通过。初次整树类型检查曾遇并行编写中其它测试类型错误，不能称当次全绿；末次四文件350 passed/0failed/skipped/todo、11.23s，boundary5.576s通过，最终整树类型已通过
- M2：module/commands首次119 passed，随后补有效feed/roast prepare纯度与预计算守卫，末次121 passed/0failed/skipped/todo，Vitest6.07s/wall6.827s；boundary6.231s通过
- M5：UI最终聚焦103 passed/0failed/skipped/todo，18.37s（含十种真实命令后的SFC隐私），boundary通过；无浏览器通过声明

### 直接受影响旧守卫冲突与纠正

- 初次旧回归中的i18n首参扫描拒绝`i18next.t(read.knownNameKey!)`。仅在模块内改为保留完整已校验key语义的`ext.foraging.kind.`前缀+既有key后缀表达式；未改locale/规则数据/共享扫描器。最后定向旧i18n25 passed，1个临时假模块删除用例按范围过滤，17.34s；初次失败保留记录
- 冻结旧测试`src/test/ext_edible_runtime.test.ts:120–125`的“registered fixture grants never leak into production catalog”在第122行明确断言catalog不包含`foraging`。本任务正是安装真实foraging，故该旧前提失效；同用例对fgfixture的排除仍正确。该文件相对起始tip字节未改，未过滤这个失败、未改共享断言。建议维护者本地只删除过时的“不含foraging”前提并保留fixture隔离断言
- 初次完整i18n旧文件包含一个在临时目录删除微型假模块的扫描器单元，已执行；没有删除任何实际已安装模块或运行删除验收脚本。后续i18n/ownership定向检查显式排除这种fixture删除项；不能把这项微型单元当成5Z生产模块删除证据

### Linux运行器/既有测试环境问题

- `ext_world_work_boundaries.test.ts:190`把探针JSON写到macOS固定路径`/private/tmp/phase5a2-D15.json`，Linux本环境不存在该目录，抛ENOENT，尚未执行该用例后续数值断言。没有创建越权目录、修改共享测试或假称通过；建议本地改用平台tmpdir
- 必需命令`npm run test:drift -- --maxWorkers=2`实际执行一次，exit1，0.307s，未启动Vitest；`run-test-suite.mjs`通过单个BROGUE_TEST_DISCOVERY环境值传递132373-byte JSON，超过Linux单参数/环境字符串限制，spawnSync E2BIG
- 不改runner，使用同一Vite配置原生支持的`BROGUE_TEST_SUITE=drift npx vitest run --maxWorkers=2`，不设置BROGUE_TEST_DISCOVERY，由`getTestDiscovery()`在进程内重新严格验证/解析完全相同分区。不是手工缩减集合；实际六文件为crafting_trace、foraging_trace、giants_spine_trace、giants_trace、generation_baseline、u_26a_deep_baseline。npm包装层失败与等价完整drift测试结果分别列示

### 最终同树门禁

初版最终候选：boundary exit0/5.536s，vue-tsc exit0/23.363s，build exit0/31.180s，19文件741 passed/0 failed/skipped/todo、Vitest245.34s/wall246.081s。随后旧i18n守卫发现上述可静态追踪形式问题，仅participants.ts一处等价表达式调整；以下收尾重跑才代表修正后的最终代码。

初次22旧文件：exit1，wall601.499s，401 passed/3 failed/0 skipped/todo；三失败就是i18n、旧“不含foraging”断言、固定/private/tmp路径。没有把初次失败改记通过。

| 门禁 / 命令 | exit | 结果（passed / failed / skipped / todo） | wall秒 |
|---|---:|---|---:|
|`node scripts/check-module-boundaries.mjs`|0|通过（非测试命令）|5.307|
|`npx vue-tsc -b`|0|通过（非测试命令）|24.66|
|`npm run build`|0|通过（非测试命令）|33.664|
|`npx vitest run src/ext/modules/foraging/tests --maxWorkers=2`|0|19文件；741 / 0 / 0 / 0（Vitest248.75s）|249.5|
|`npm run test:drift -- --maxWorkers=2`|1|未启动测试：E2BIG|0.307|
|`BROGUE_TEST_SUITE=drift npx vitest run --maxWorkers=2`|0|6文件；12 / 0 / 0 / 0（Vitest209.08s）|209.721|
|旧22文件定向，见下方完整命令|1|22文件；401 / 2 / 1按范围过滤 / 0（Vitest536.26s）|537.104|
|ownership非删除定向，见下方命令|0|5 / 0 / 1按范围过滤 / 0|1.144|

资源限制均同§2；build只有既有共享index chunk大于500kB提示，无新增构建错误。M2/M5的末次build/type为这个修正后同树结果；M3/M4/M6在并行工作汇合后的同树boundary/type/741项完整定向门禁统一收口，不伪造独立先后运行。

最终候选输入：1159文件（src、scripts、package/lock、vite、配置手册），路径+NUL+SHA256+LF的SHA256=`8bfd43e32b1ce122c77a3a24edfc007f383dd6db644088fe71acc6cf759a5f25`；报告仅更新证据元数据，未改变测试输入。收尾发布前已再次逐文件比对，1159文件0差异。

直接受影响旧测试：

```sh
NODE_OPTIONS=--max-old-space-size=3072 npx vitest run \
  src/test/ext_actor_needs_runtime.test.ts \
  src/test/ext_departure_runtime.test.ts \
  src/test/ext_edible_combinations.test.ts \
  src/test/ext_edible_review.test.ts \
  src/test/ext_edible_runtime.test.ts \
  src/test/ext_fire_contact_runtime.test.ts \
  src/test/ext_kind_knowledge_runtime.test.ts \
  src/test/ext_placement_group_runtime.test.ts \
  src/test/ext_slumber_runtime.test.ts \
  src/test/ext_derived_draw_vectors.test.ts \
  src/test/ext_world_work_sdk_contract.test.ts \
  src/test/ext_world_work_transactions.test.ts \
  src/test/ext_world_work_review.test.ts \
  src/test/ext_world_work_failures.test.ts \
  src/test/ext_world_work_boundaries.test.ts \
  src/test/ext_foundation_contracts.test.ts \
  src/test/repo_hygiene.test.ts \
  src/test/p1_30_i18n_gate.test.ts \
  src/test/u24_hardcoded_text.test.ts \
  src/test/u_15f_food.test.ts \
  src/test/u20_inventory.test.ts \
  src/test/x3b_item_details.test.ts \
  -t '^(?!.*删除模块后数据)' --maxWorkers=2

NODE_OPTIONS=--max-old-space-size=3072 npx vitest run src/test/test_suite_membership.test.ts \
  -t 'registers every discovered|uses the exact resolved|routes all npm suites|uses the same stable|fails stale' --maxWorkers=2
```

上述2个过滤项只是遵照本轮不做删除检查的范围选择，不是源码中的skip/todo；没有新声明skip/todo，未过滤两项失败。CE缓存缺席，未人为删除缓存制造跳过；本轮自有与drift都无CE依赖跳过。

## 8 自然 trace 与持久化

两条仅通过公开命令捕获，不用fgfixture、不直接改Game布景。同步原生命令确认逐条安装/恢复，暂时清空onCommandConfirmRequest；真实事件decisions独立核验，不复制输入冒充答案。

| trace | 模块 | 种子 | 命令数 | 总tick | 录像字节 |
|---|---|---:|---:|---:|---:|
|A|foraging|2|149|14400|145709|
|B|crafting+foraging|6|27|2900|28994|

A顺序尝试：seed1采集C5_THREAT，seed2选中。B：seed1采集C5_THREAT；seed2无相邻可放火炉格；seed3放置C5_THREAT；seed4/5采集C5_THREAT；seed6选中。没有随机挑种或超过64次。

A包含D1采空3次、吃No/Yes各录一条，No背包/营养/tick/绝对回合不变，Yes吃1个并推进；扔1个、未知菌绰号、下D2再采。B补石料2、真实place-station、采3个、生→烤、吃1个烤菌、剩余烤→焦。捕获时两条full replay/endseek均成功；黄金测试还覆盖save/load、中途seek/续录与终点一致，最终结果另见门禁。

## 9 相关组合与5Z延后项

最终741项自有门禁中的T-COMBO逐行结果（不是64子集）：

| 组合 | 新局/采集/吃 | save/load | replay/seek/续录 |
|---|---|---|---|
|foraging|通过|通过|通过|
|foraging+growth|通过|通过|通过|
|foraging+narrative|通过|通过|通过|
|foraging+combat|通过|通过|通过|
|foraging+giants|通过|通过|通过|
|foraging+crafting|通过|通过|通过|
|foraging+growth+narrative+combat+giants+crafting|通过|通过|通过|

额外3个T-COMBO测试：真实绑定combat篝火烤制、真实放置crafting火炉烤制且crafting rules指纹保持`sha256:fc1b8d11b7faf918331cf58895f135e11e67d397b5c88d1a08c5b2b679597fe1`、giants核心唯一需求/整体非死亡退役，均通过；这些布景联动只声明相应真实命令与存读结果，不扩称每种布景的从新局录像。settlement当前未安装，没有硬引用或虚构该行。

完整npm test、全部test:ext、完整64子集smoke、所有生产模块物理删除验收（包括只删/只留foraging；临时扫描器fixture例外见§7）、5Z体积/性能：全部未运行，按最新政策留5Z。未调用默认全子集composition脚本，没有CE fetch/full/gen。相关七行不等于64全覆盖。

## 10 浏览器与视口

24个组合（1440×900 / 390×844 / 320×844 × 普通/沉浸 × 原版/精修ASCII/汉字/图块）均 **blocked / 未运行**。无真实设备、无浏览器模拟验收截图。

能力检查：仓库已有Playwright依赖；默认bundled Chromium不存在。系统预装`/usr/bin/chromium`已存在，本轮没有安装浏览器。尝试：

```sh
node -e "import('playwright').then(async({chromium})=>{const b=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});console.log('cloud-headless-browser-ok');await b.close()})"
```

exit1，Chromium `FATAL:chrome/browser/process_singleton_posix.cc:297 ... socket() failed: Operation not permitted (1)`；另有crashpad database初始化错误。尊重socket权限拒绝，没有改启动参数、切换替代浏览器/访问路线或用户电脑绕过。

可执行的替代覆盖仅共享SFC harness行为及静态CSS检查：三页签、未知量“少量”、长名称两行、44px点击目标、固定页签/底部操作、无横向overflow设置、回放/seek只读、连点锁、blur关闭。它们不是像素/真实触摸/地图遮挡验收。待本地补验24格以及长名、满背包、无热源、多同伴、离开中、连点、blur、触摸和回放。

## 11 自行决定与待确认

### 实现细节

1. 桌面侧板350px；移动抽屉占min(36dvh,320px)，模块CSS预留地图区域，像素效果待浏览器补验
2. 食物显式选择；热源按ID最低默认；唯一相邻且未离开的同伴自动选中
3. 任一同伴饥饿/离开时HUD列出可见同伴，显示档位及离开标记
4. 沉浸/回放在预留module bar给面板入口，仍用原命令服务，不另设全局键盘监听
5. 投影/解析/参与者对畸形输入保守拒绝，state仅枚举结果，未知信息优先不显示
6. DTO缺错误读口时按SDK-02给通用反馈，不绕边界
7. 自然trace首选安全最短路线，布景只读寻路；无可达/威胁/放置不成立依顺序换种
8. 配置示例新增菌/调整固定需求是未来审阅提案，必须改schema/黄金测试，未把未经批准数据混入本次机械包或locale

9. revealed总数按一次事实成功改变知识计1；同一次烤菌揭示两形态仍计1，重复吃已知菌不重复加；history仍记录观察结果
10. 原生确认No仍录事件，所有trace比较将录像条数与机械零成本分开；growth有initialCommand时seek索引包含此前缀

### 指挥临时采纳（全部保留状态）

以下均 **按推荐执行，待用户确认（可逆，不阻断派发）**，不称用户逐条终审：

1. 生/烤/焦/节点可读定义ID命名
2. nameKey中性兜底“奇异的菌/烤过的菌/菌丛”
3. 生烤同`菌/#B8A4E0`；焦`炭/#6B5B53`
4. always在非免疫/非不适用时揭示，即便状态已存在
5. 同伴揭示额外要求visibleToPlayer
6. 背包爆炸视为可见
7. 离队grace2000tick，饥荒deadline30000tick
8. fed/hungry/weak/starving档位ID
9. 档位消息无名，离队消息带名
10. 共享侧栏/盟友详情档位本轮不做，以HUD/喂食页承载
11. 20模板nonEaters名单
12. 居民查询仅available+严格`{resident:true}`视为居民
13. 烤制不按隐藏种类过滤，未知爆燃可选
14. 两条自然trace，喂食以真实测试覆盖
15. 全部固定文案及prism已知名“苍鸾菌”
16. 扩充禁用词表
17. 白名单含edibleSdk、不含stats；类型从ExtensionModule派生
18. might同伴临时physical-damage-dealt more+2500bp
19. state不存种类，history只枚举
20. 八项limits固定上限

20模板：arrow_turret、bloat、dart_turret、explosive_bloat、flame_turret、flamedancer、golem、ifrit、lich、mangrove_dryad、phantom、phoenix、pit_bloat、revenant、sentinel、spark_turret、vampire、wisp、wraith、zombie。另明确“揭示烤菌同时揭示生菌”也属相同临时采纳状态。

## 12 交接5D

只按公开`tags.includes('food.ingredient.mushroom')`筛选并对quantity求和；生烤23定义有该标签、焦炭没有。不要按原生FOOD分类或内部kind判定。厨师不得读隐藏种类、烤制政策，亦不得改变采食知识。

本模块仅消费`settlement.resident-status.v1`，输入`{actorId}`，输出只有available且value严格为`{resident:true}`视居民；unavailable/异常/多键/畸形均非居民。settlement入驻变更须由其可信事务触发底座资格重评，本模块不轮询或写营地状态。营地日粮/粮仓/厨师/猎人/农田/离线经济均不在本交付。

## 13 未覆盖 / 待本地集成

- npm drift包装器E2BIG与两项冻结旧测试（catalog前提、macOS固定路径）待本地维护
- SDK-04节点再生投影修复（当前灰态挡住UI重采）
- SDK-01精确治疗修复与回归恢复
- SDK-02提交错误公开读口
- SDK-03注入writer故障的never-throw/原子性合同澄清
- 全24格浏览器及真实触摸验收
- §9统一留5Z的全量/64组合/删除/性能项
- 爆炸/喂食/离开/沉眠/力量等特定布景状态完成save/load与公开命令续行比较；没有把未录制的布景伪装成自然录像。上述每种状态各自的完整从新局replay/seek未覆盖（禁止origin monkeypatch）；两条自然trace与七组合的真实replay/seek/续录已独立覆盖
- 120节点上限测试通过合法预置节点达到预算后真实生成D5，非自然120节点长局；最大512底座节点/最大状态/长期录像性能留5Z

### 逐项功能证据索引

| 条款 | 本轮实际覆盖 | 剩余边界 |
|---|---|---|
|T-IMP/T1/T-DATA/T-NAME|严格导入、每对象键集、指纹叶/数组、完整黄金数据/200文案、35禁词/30名称，3种子真实知识名称|无已知数据偏离|
|T-MOD/T-CMD|state饱和/幂等/64历史、揭示矩阵、资格异常/畸形、属性与三命令纯准备|SDK-03注入writer故障|
|T-EAT|No/Yes真实decisions；12意图与真实状态时长、满血/旧状态/免疫、呕吐下限、力量400回合、25回合沉眠与真实伤害唤醒、自动原生食物、独立crypto烤制预言|SDK-01精确治疗量|
|T-KNOW|单调知识、生烤分离、背包/详情/悬停/节点、绰号留存、鉴定/探测/最后种类隔离、幻觉命名两流不变|无新增魔法知识路径|
|T-FIRE|spawn/floor/throw/carrier/lava、冷却/完整链、爆燃1/2/3、可见/不可见/必触发背包揭示、ID连锁、独立1/3预言、无食物两流对照|无真实浏览器火效像素验收|
|T-ROAST|真实放置火炉/生成绑定篝火、整堆三阶、热源爆炸、距离/交互线/CAS拒绝、热源投掷一次、下游参与者失败整链回滚|无提供者显示为空；未新增热源|
|T-NODE|D1–12×2种子、D1–3×2种子原生地形/生物/物品/两流对照、100tick×3/32000再生/满容量、completed/skipped、120预算|SDK-04纯读投影陈旧|
|T-COMP/T-FEED|20模板/规则/居民/群体资格、200tick每点/各档属性、30000截止/20回合grace、非致死/掉落/无XP、跨层/复活、原生与12菌喂食、所有拒绝与确认|治疗同SDK-01|
|T-LEAK/T-UI|十种实际命令后日志/投影/详情/三页签真实SFC文本，未知精确饱腹隐藏；103UI断言|SDK-02提交码读口；浏览器blocked|
|T-PERSIST/T-TRACE/T-COMBO|9类效果/需求布景存读续行；两自然trace、七相关组合真实新局/replay/seek/续录、额外两热源+群体联动|特定布景逐种完整新局录像未声称通过|
