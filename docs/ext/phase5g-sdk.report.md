# 5G 本地 SDK 基础修复报告

2026-10-08，候选树 `/private/tmp/brogue-commander-20261007/phase5g-sdk-tree`，detached HEAD `0fb2720ff1e62ca49cf2f9bcc7b41c550a72d467`。依据外部 `phase5g-sdk.task.md` 执行；独立审查由指挥后续另派。本报告属于本地修复，不改写 dot 的原交付报告。

本轮 G-R01/R02/R05/E01/E02/E03 基础修复完成。最终相关门禁 **26 文件、614 passed / 0 failed / 1 原有 CE skip / 0 todo**；原 npm drift 包装器 **6 文件、12 passed / 0 failed/skip/todo**；边界、类型与构建通过。模块侧 SDK-03、G-R06 与特殊状态/浏览器验收仍待后续处理，不宣称 5G 整包最终验收。

## 实改范围

- **G-R01**：`src/engine/Core/EdibleEffects.ts` 将已经计算的 `max(min,floor(maxHP×percent/100))` 交给 `Creature.healPoints`。`src/entities/Creature.ts` 抽出可信点数治疗，保留封顶、stats dirty 与从死亡恢复的 terminal causality 清理；原 `heal(percent,panacea)` 仍按百分比截断，panacea 次序及状态处理保持。
- **G-R02**：`src/engine/Core/WorldWorkWorld.ts` 的默认读与公共 SDK 都走已有 `materializedNode` 副本。默认读覆盖冻结 harness 的既有转发；可信内部仍可显式传 false。审计所有生产调用：prepare 已传 true，其余无该参数的读都是公共 SDK/harness 或 inventory 读。再生不写持久行、不递增 revision、不分配 ID、不用 RNG；提交仍按真实 revision/CAS 验证，预留单位照常扣除。模块不改计时、不强行可采。
- **G-R05**：`src/engine/Core/KindKnowledge.ts` 只有新增行/严格升格返回 true；等值与降级 false，等值不再 dirty。知识行/title、名称、消费和事实流程仍正常。生产调用者完整审计：EdibleEffects 与 FireContact 只转发返回值；fgfixture 的两个参与者忽略；foraging 的 onConsumed/onFireContact 用于新增揭示计数，tasted 忽略。没有依赖“合法请求即 true”的其他用途。其余调用均为测试。
- **G-E01**：`src/test/ext_edible_runtime.test.ts` 只替换“不含生产 foraging”旧前提为 fixture harness 的真实 manifest 恰为 `['fgfixture']`。保留 catalog 不泄漏 fgfixture 与 **11 定义**原断言；不要求任一可删除生产模块存在。安装/default-off 由原模块证据与独立探针核验，基础隔离断言在有/无 foraging 两种输入均通过。
- **G-E02**：`src/test/ext_world_work_boundaries.test.ts` 输出路径改为 `join(tmpdir(),'phase5a2-D15.json')`，数值/预算断言逐字保留。实际门禁以 TMPDIR 指向证据目录的合法临时子目录。
- **G-E03**：`scripts/run-test-suite.mjs` 仍在父进程严格发现/校验 suite，再删除子进程环境中的 BROGUE_TEST_DISCOVERY（包括继承值），让 Vite 走现有 getTestDiscovery 无 env 时的同一严格发现。`scripts/test-discovery.mjs` 仅更新注释。未改发现规则、清单、分区或 npm scripts。
- 在两个既有基础文件（`ext_edible_runtime` / `ext_kind_knowledge_runtime`）新增 **13 项**回归，全部用合法 fgfixture 注册与公开 eat/feed/harvest 命令；没有导入生产 foraging。没有新增测试文件或修改所有权清单。

共九个已有文件实改，另新增本报告。没有修改 foraging/任何其他模块、dot 报告/手册、200 locale、权威数据、黄金 trace/基线、九冻结文件、5C1。没有新增 Game 字段，也没有改 SDK 签名、payload、协议或持久化格式版本。

## 红绿与单变量证据

证据根 `E=/private/tmp/brogue-commander-20261007/phase5g-sdk-evidence`。原审查目录只读；复制外部探针时仅替换源码/证据根路径，不改原 11 条断言。修前完整 **4 failed / 7 passed**：玩家 +2≠9、同伴 +0≠5、再生面板 false、重复 revealed2≠1；修后原 11 全绿。

逐项反事实保持其余修复不动，仅回退对应生产文件并原样恢复：EdibleEffects 两治疗重新失败；WorldWorkWorld 再生投影重新失败；KindKnowledge 重复揭示重新失败。`cf-*.json/log/command.json` 保留实际红灯、选择范围与耗时；红事实另保存在 `red-facts/`。

E01 在独立副本 `counterfactual-catalog` 仅撤去生产 foraging 目录、原基础测试及其他源码逐字保留：旧断言 1 绿；本树原断言 1 红。修前对照先完成才改前提。再把修订后的测试复制到同一副本，fixture 断言仍 1 绿。此为单用例前提对照，不是类型/构建/剩余全套删除门禁，也未跑删除矩阵；本候选的 foraging 目录未挪动。

新增基础专项首次 **13 passed / 1 failed**，失败是新测试把预留拒绝误写为 C5_RESOURCE_EMPTY。按 `WorldWork.ts` 执行链，remaining 足够而扣 reservedUnits 后不足应为 C5_RESERVED；只修本次新断言，未改任何原断言。修后 **14 passed**（13 新增 + 1 原 fixture 用例）。所有失败日志保留。

扩展外部探针共 **18 passed**，增加真实烤 mend 的 keep/strip × eat/feed 精确 HP、烤菌 raw/roasted 四种预知组合的单事实揭示计数及保存再吃、两个真实可见 blast 爆炸只揭示一次。临时探针不能代替 dot 恢复其自有断言。原 SDK-03 吞 writer 异常的诊断仍绿，表示缺陷仍可复现；不表示本轮关闭该问题。

## 机械验证与边界

基础治疗表对玩家/同伴分别核验 maxHP30/HP10→+9，maxHP10/HP1→+5，HP28→+2，满血→0，maxHP200/HP100→+60；同时断言事实即时 hpGained、回调即时 HP 与付费命令最终 HP。原生 heal30 在 maxHP37 时仍 +11；点数治疗触发 stats invalidation 与 terminal 清理。

公共 SDK 和冻结 harness 都核验 31900→0、32000→1，20 次读的完整保存投影（仅规范化 savedAt）、两条 RNG、ID 不变；实际 revision 不变，save/load 后投影相同。用投影 revision 公开采集成功，旧 revision 换最新 inventoryStamp 仍 C5_STALE。remaining1/reserved1 读保留预留，实际采集 C5_RESERVED；满容量读清零副本 remainder，不积余。外部真实 foraging 面板可采与重采验证保留。

知识验证 unknown/title→tasted→known，重复 tasted/known 与降级均 false，snapshot/RNG 不变、已知名正常；保存后重复标记/真实再吃保持 known。外部烤菌首次双升格总 revealed 只 +1；两形态都已知时 +0，载入后再吃不增加。真实事实仍有新序号，eaten/exploded 正常递增。

## 运行环境与可移植性

所有 Node 验证统一显式 PATH 前缀 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，Node **24.19.0**；NODE_OPTIONS=`--max-old-space-size=3072`，Vitest **4.1.11**、`--maxWorkers=2`。共享 node_modules 链接未改，未安装依赖。无 CE 缓存，不运行 ce:fetch/full/gen。

旧发现 JSON 本候选根为 **132374 bytes**，环境条目含名字/等号/NUL **132397 bytes**，超过常见 Linux 4KiB 页的单字符串 131072 字节。新 runner 不产生该发现环境条目。`platform.mjs` 在本机真正启动 wrapper→Node child，用 preload 仅截取子进程发现（不是测试通过证据）：主动给父 wrapper 继承旧大 JSON，子进程该变量确为空，发现完整对象深相等；test/gen/drift/ext 分区为 **490/27/6/236 文件**，参数仍带 2 workers。完整 npm drift 结果另列。

**未获得 Linux 环境，未声称 Linux 实测/E2BIG 本机复现。** dot 原 npm drift exit1/E2BIG/0.307s 历史与原报告保持；本轮给出移除过大字符串的实现、字节约束、darwin 实际子进程与选集等价证据。E02 使用平台 tmpdir，darwin 实际写出后继续原精确断言；Linux 的 tmpdir 与写出未实测。

## 输入完整性

开工保存 src/scripts/docs-ext/package/配置共 **1275 文件**逐文件 SHA-256（`input-before.json`），拟改原件在 `original/`；追加回归后门禁输入同样1275文件，路径码点排序的“相对路径+NUL+SHA256+LF”聚合 SHA：`ea0c54e3dc4708a00db4a06c7f9f27f31cac6de53747ef3a3128658fbad7b7e1`。本新报告不纳入自引用输入。最终逐字段机械核验另存 audit；九冻结哈希与任务书完全一致，fgfixture 树哈希仍 `7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`。

## 后续 dot 与未覆盖项

- 恢复 eat/feed 的精确治疗量，mend-roasted keep/strip 的即时事实/HP；恢复 nodes 的 32000 面板可采断言，不迎合错误旧量。
- 在自有 knowledge/module/fire/eat 测试补真实重复 known、烤菌两形态首次/部分已知/全部已知、重复可见爆炸、save/load 后再吃；不能只 mock false。
- G-R04 按外部 atomic-contract 澄清去掉三个写阶段吞错 catch，保留写前验证/qualifies 查询兜底；补真正原参与者 writer 故障矩阵。底座现有 strict/degrade 边界未扩大，feed 内 need 失败仍降级，不扩为整笔 feed 回滚。
- G-R06 模块自有组合测试的无 foraging 分支、后续 settlement-only/foraging+settlement 集成由 dot 修。未触碰 settlement 候选。
- G-R03 首版通用拒绝反馈继续保留，具体反馈的规格由指挥裁定；没有新增 lastError 或统一结果协议。
- 特殊状态完整从新局录像、浏览器24格、5Z 全 npm/test:ext/全组合/删除矩阵仍未覆盖。本轮不派代理/另起审查进程，不跑浏览器；没有 commit/push/merge/rebase。

## 全部验证命令与耗时

以下 **18 个**实际外层验证/门禁命令（wall 累加 **583.946s**；重复/反事实独立记账，不是唯一测试数）均有同名 `.command.json`（精确 argv、cwd、PATH、Node 堆参数、退出码与 wall 时间）、`.log`，测试另有 Vitest JSON。反事实脚本顺序执行三个命令并 finally 恢复源码；platform 的 nested wrapper/child 是选集探针，不冒充门禁。读取/编辑/散列审计辅助命令不计为测试门禁。

|证据命令标签|exit|测试 passed/failed、未选/skip、todo|wall秒|
|---|---:|---|---:|
|`final-boundary`|0|非测试命令|2.354|
|`types`|0|非测试命令|10.822|
|`final-build`|0|非测试命令|15.395|
|`related`|0|26文件；614/0；原有skip1；todo0|357.826|
|`drift`|0|6文件；12/0；原有skip0；todo0|101.536|
|`restored-specs`|0|1文件；18/0；原有skip0；todo0|23.111|
|`foundation-new-fixed`|0|2文件；14/0；未选67；todo0|12.151|
|`green-probes`|0|1文件；11/0；原有skip0；todo0|11.685|
|`red-probes`|1|1文件；7/4；原有skip0；todo0|13.455|
|`red-fixture`|1|1文件；0/1；未选39；todo0|3.140|
|`cf-fixture`|0|1文件；1/0；未选39；todo0|3.074|
|`cf-fixture-fixed`|0|1文件；1/0；未选51；todo0|3.305|
|`cf-heal`|1|1文件；0/2；未选16；todo0|3.447|
|`cf-read`|1|1文件；0/1；未选17；todo0|4.401|
|`cf-knowledge`|1|1文件；0/1；未选17；todo0|2.906|
|`foundation-new`|1|2文件；13/1；未选67；todo0|11.968|
|`boundary`|0|非测试命令|3.222|
|`platform`|0|真实子进程/严格发现等价；不执行测试|0.148|

带 `-t` 的未选项仅为明确专项选择，没有新增 skip/todo 或过滤失败。相关26文件命令未过滤用例；唯一原有 CE skip 是 u_14a_status_gaps 的 CE fear source / darkness throw 对照（缺参照源码），原机制保留。membership/i18n 中对临时微型假模块的单元删除按原用例运行，不是生产模块删除矩阵。build 含最终 vue-tsc -b；另一次纯类型检查通过。构建只有原共享大 chunk 提示。

最终完整相关命令（公共资源参数见上方环境；TMPDIR=`/private/tmp/brogue-commander-20261007/phase5g-sdk-evidence/tmp`）：

```sh
node node_modules/vitest/vitest.mjs run src/test/ext_edible_runtime.test.ts src/test/ext_edible_review.test.ts src/test/ext_edible_combinations.test.ts src/test/ext_fire_contact_runtime.test.ts src/test/ext_kind_knowledge_runtime.test.ts src/test/ext_actor_needs_runtime.test.ts src/test/ext_world_work_sdk_contract.test.ts src/test/ext_world_work_transactions.test.ts src/test/ext_world_work_review.test.ts src/test/ext_world_work_failures.test.ts src/test/ext_world_work_boundaries.test.ts src/test/ext_foundation_contracts.test.ts src/test/w_21_empowerment.test.ts src/test/u_14a_status_gaps.test.ts src/test/u_14b_status_gaps.test.ts src/test/u_15f_food.test.ts src/test/repo_hygiene.test.ts src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/test_suite_membership.test.ts src/test/ext_module_boundaries.test.ts src/ext/modules/foraging/tests/foraging_eat.test.ts src/ext/modules/foraging/tests/foraging_feed.test.ts src/ext/modules/foraging/tests/foraging_nodes.test.ts src/ext/modules/foraging/tests/foraging_knowledge.test.ts src/ext/modules/foraging/tests/foraging_roast.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=/private/tmp/brogue-commander-20261007/phase5g-sdk-evidence/related.json
```

npm 完整 drift 命令：

```sh
npm run test:drift -- --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=/private/tmp/brogue-commander-20261007/phase5g-sdk-evidence/drift.json
```

六个实际 drift 文件：crafting_trace、foraging_trace、giants_spine_trace、giants_trace、generation_baseline、u_26a_deep_baseline；与严格发现分区精确一致。foraging 的两条原自然 trace 4 项（逐命令/decisions、终点、save/load、seek、真实续录）通过；其他原 trace/两生成基线通过。**没有重录或改动任何黄金文件。**

最终输入机械检查：1275 既有输入逐文件与 gate-input **0 差异**；296 个模块自有文件全部与开工一致（foraging 46 文件，12 kinds / 24 edible / 12 nodes / 18 appearance / 20 nonEaters / 200 locale）。开工聚合SHA为 `8d4f4023813a1c85ed4803aa720a787a24505eb59cc01d0814f5843bd1de05d5`；最终源码门禁SHA为 `ea0c54e3dc4708a00db4a06c7f9f27f31cac6de53747ef3a3128658fbad7b7e1`。`audit-final.json` 与 `build-input.json` 保存机械结果及55个构建文件散列。

九冻结文件最终逐字节核验（全等于开工与任务书）：

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
