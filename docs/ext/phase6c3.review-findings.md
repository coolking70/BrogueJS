# 6C3 独立审查 R1

结论：**需修**。发现 3 项重要问题，无另外确认的阻断级问题。未修改被审仓库文件，未 commit。浏览器人工验收、数值平衡、云端正式性能不作为缺陷。

审查基线：HEAD `33d7aba6e458529ae126dee2d889c7b2c24507bd`，范围为全部未提交改动（含未跟踪源码）。已读 AGENTS.md、HANDOFF/development/architecture、phase6c.task.md、冻结 phase6c0-contract.md（尤其 §5）和 phase6c3.report.md。

当前完整 src SHA256：`51b16631cdb01433ef20b1bdadbde7dc3e7531325d9ae15e1171b5a44dc7a267`，审查末复核不变。报告登记的 1473 个 src 文件、61 个 dist 文件全部逐文件匹配；A/B 的所有 toolHashes 匹配当前工具。

## 新问题（仅重要/阻断）

### R1-F1（重要）：重铸“第 N 行”与玩家详情中的第 N 行不是同一行

位置：`src/ext/modules/loot/gameView.ts:68`、`src/ext/modules/loot/ui/game/LootGamePanel.vue:53`；相关显示排序在 `src/ext/modules/loot/ui/viewModel.ts:189–190`。

工作选项以原始 `data.affixes` 数组序号构造，按钮用 `rowIndex + 1` 显示“重铸第 N 行”；详情却先按 prefix、suffix 排序。生成器可以先生成后缀再生成前缀，因此这是合法装备会遇到的功能错误。确认框也没有词缀身份可供纠正判断。违反冻结 §5.1 的“玩家选行、仅替换该行”，会花费碎片并改变玩家不想改的行；不是浏览器尺寸/视觉缺验。

复现（仓外探针，真实 readLootGameView + 生产命令）：

1. 锻炉旁放入已鉴定合法 magic dagger，原始 affixes 为 `[precise T1=1200, keen T1=2500]`。
2. 详情顺序实际为 `[keen, precise]`；第一按钮文字为“重铸第 1 行”，却提交 `rowIndex:0`，指向 precise。
3. 走 `h.ext('loot','item-operation',choice.payload)`，实际成功，原始第 0 行 precise 变成 leech T3=1，显示第一行 keen=2500 完全未动。

建议：将显示行身份与命令原始 rowIndex 显式绑定，按钮显示准确词缀名或显示序号，并保留原始 index 给宿主；增加“后缀先生成、前缀后生成”的选行回归。不要改后端选中行以外不变的断言。

证据：`/private/tmp/p6c3rev1.probe.mjs`、`/private/tmp/p6c3rev1.probe.log` 中 `reforge selection mapping` 和 `first displayed row reforge result`。

### R1-F2（重要）：craft 完成提案没有绑定深度推导的 ilvl，错误产物可完成并扣料

位置：`src/ext/modules/loot/work.ts:98–101`；宿主接纳路径 `src/engine/Core/WorldWorkItems.ts:139` 起。

craft 的 validateProposal 检查基底、rarity 上限、已知/+0/无腐化及 origin，却没有检查 `data.ilvl` 是否等于绑定 depth 依 §5.3 推导的物等。实例级校验只要求 ilvl 在 1…99；它不能替代完成提案针对本次请求的校验。故符合结构但违反工作请求的 provider 结果被当作成功，未进入“完成失败回到完成入口、取消退未完成投入”的路径。

复现：

1. 生产 D1、loot+crafting，新建 forge，发起 forge-dagger。
2. 在内存中对 provider.commit 做单字段故障注入：调用原 commit 后，仅把返回的 `data.ilvl` 改为 99，原 `origin={source:'craft',depth:1,recipeId:'crafting.forge-dagger'}` 不变；未改校验器或仓库文件。
3. 实际命令返回 `{recorded:true,error:null}`，消耗 1000 tick，库存接纳 ilvl99 dagger，终结票据为 `completed/completedBatches=1`。应拒绝错误提案，保留劳动、退本批材料。
4. 另一个纯提案探针把 D1 normal 结果改为 ilvl99/4孔，`validateLootItemData` 与 `validateProposal` 均返回 true，说明不能靠实例合法性挡住请求外生成域。

正常生成器目前算出的 D1 ilvl 是 1；本项是受控完成协议的错误结果接纳缺口，不声称正常 RNG 自己会产出 ilvl99。与现有 wrong-origin/wrong-recipe/rare 注入测试属于同一权限边界。

建议：完成校验独立核对绑定 depth 推导的 ilvl，并核对该次生成允许的孔数/词缀阶窗口等生成域；新增错物等完成提案负例，核对已耗时不退、退款和无完成产物。

证据：同一探针日志中的 `D1 illegal ilvl and sockets`、`real completion wrong ilvl`。运行命令：

```sh
NODE_OPTIONS=--max-old-space-size=3072 /Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/p6c3rev1.probe.mjs
```

### R1-F3（重要）：新增行预算无条件加强化行，拒绝 cap=0 的合法边界目录，既有测试回归

位置：`src/ext/modules/loot/schema.ts:506–510`；原有回归 `src/ext/modules/loot/tests/loot_schema.test.ts:191–193`。

`computeEquipmentRowBudget` 对武器始终加 3 行、甲始终加 2 行，即使对应 rarity 的 enhancementCap=0。合法套装锚件 21 条固定修正 + 3 条累计奖励恰为 24 行，且强化关闭，不会产生强化行；新增校验误算成 27/26，报 `BUDGET at pack.equipmentRows`。现有更早的套装检查和运行时统计已正确处理 cap=0；应修新增生产预算，不改守卫或放宽 24 行上限。此项是目录准入/共享边界回归，不是平衡意见。

复现：

```sh
NODE_OPTIONS=--max-old-space-size=3072 /Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/vitest/vitest.mjs run src/ext/modules/loot/tests/loot_schema.test.ts -t 'zero enhancement cap' --maxWorkers=1 --no-file-parallelism
```

当前候选：piece 0（武器）、piece 1（甲）失败；piece 2（戒指）通过。完整相关批次亦为同两项失败。仓外原 HEAD 副本同过滤运行 3 项全过；已核对该副本 schema、definitions、item、statSources 和此测试文件与 `git show HEAD:<path>` 字节相同。这是旧版对照，不冒称“只回退一个生产文件”的单变量反事实；审查未改测试。

证据：`/private/tmp/p6c3rev1.related.log`、`/private/tmp/p6c3rev1.schema-repro.log`、`/private/tmp/p6c3rev1.schema-base.log`。过滤运行的 99 skipped 是 `-t` 未选中用例，不是新增 skip。作者报告的“各文件末次通过清单”不能覆盖当前生产字节；本轮失败结果必须保留。

## 逐条判定

| 核查项 | 判定与证据 |
| --- | --- |
| 拆卸末枚/全部、保留符文、成本 | 通过。stationOperations 固定 10片/100tick，all 按接单 n 倍且一批；work 测试覆盖 1/2/4 枚、同对象同 ID、原生偏移保持、40片/400tick、重复拒绝。 |
| 拆后 rarity/词行 | 通过。work.ts 清相应序列并置 normal；socketRows 按剩余序列派生，不存 runewordId；容器回归实测余烬拆末枚留下 ka、normal、底材仍未知。 |
| 重铸候选范围、变差、负面/固定行及成本 | 后端规则通过，但玩家选行不通过（F1）。reforgeCandidates 限完整已知 magic/rare、正面非原生 rune、原位置/类别/互斥组/有效权重；rollAffix 走当前 ilvl 窗口。字面骰带 T3=6000→T1=1500，100tick/10片；其他行和原生状态保持。 |
| C5 票据映射与幂等 | 通过。真实 escrow、单目标单批、targetStamp、ordinal、终结票据；load 走 validateStored 不重新 prepare/roll，旧 ticket 不再次产出。 |
| 失败/中断、已耗时与“0消费”范围 | 既有合法/抛错路径通过；错误 craft 提案漏拒见 F2。接单前 No/CAS/装备中/容量不足零成本；开始后取消/受伤/离层/工位删除/死亡退未完成投入，劳动和早先已完成批不退。completeBatch 事务回滚后 cancelFailedBatch 明确取消。 |
| craft 来源、上限与软联动 | 正常来源和 normal/magic 上限通过；生成域提案校验不通过（F2）。两条新配方固定基底/材料/时间，仅 crafting 绑定 plain、双开绑定 provider；缺席与异常区分，16批逐批完成。 |
| 容器软联动 | 通过。真实 settlement 箱子回归：箱内无改造选项，直接提交 C5_BAD_OWNERSHIP；原取回100tick再拆末枚100tick，100次读无图/RNG变化，save/load 单 owner。 |
| 装备所有权 | 通过。包内未装备 quantity1、原生字段签名、确认复验、真实对象移出背包至唯一 escrow；输出/退款 max 预留，近满99堆合并；重复根和错误 escrow 元数据拒绝。 |
| 知识边界与只读 | 通过。未知底材拆卸不鉴定；未知装备没有重铸候选；箱内投影不提供改造写入口。100次读完整图/双流保持；仅展示已知 DTO。F1 是已知行身份绑定错误。 |
| 版本拒旧、同版本确定性 | 本轮相关合法路径通过。foundation19、worldSdk2/world schema6、loot v5/0.8.0、crafting schema2/1.1.0；旧schema/坏元数据拒绝保活局。work 真实命令 replay/seek、工作中保存、craft批间保存/继续均通过。额外录像测试结果见末节。 |
| 模块边界与全移除 | 通过。当前 boundary、依赖 errors=[]；核对作者全移除副本八目录实际缺席，887个非模块源文件逐字节等于候选。既有6步日志 exit0、132pass/1具名缺combat skip，生命周期/同版本缺包存档录像拒绝证据有效。本轮未重跑删除矩阵或 build。 |
| 共享补口是否越权 | 接口范围符合 G4/G5：无活 Item/Game 引用，原生目标不伪装 worldItem，自有 data 更新/固定装配，RNG 64次且撤权；Game 无新增字段，itemSdk 字节未改。完成提案的实际校验缺口归 F2。Appearance 改动等价拆分，edible 仅跟随 worldSdk 声明。 |
| 最坏行预算 | 当前生产目录 11/8/6、四槽31+4 cap=35，无提高24/256；但合法 cap0 边界回归，不通过（F3）。 |
| 云端 A/B 身份/路线工具本地冒烟 | 通过“工具已本地跑通”的核查。原始 ab-delivery-exit=0；result hard=pass/status=incomplete，rounds1/limit257；6次 observer 各257事件、0 OOS，A/B各自两次all比较 differences=0。完整生成 classic2208/all2423，D20各500；不可声称完整路线计时或三轮性能通过。工具策略负例本轮通过，源码/工具身份匹配。 |

## 本轮执行与证据界限

仅运行相关测试、boundary、测试依赖和 A/B 工具策略测试/仓外复现；未运行完整 npm/ext/drift、CE、平衡、浏览器、云端性能或删除矩阵。未改生产、测试、冻结合同或报告文件。

- `/private/tmp/p6c3rev1.tests.log`：5文件 **119通过**，exit0（work、work_container、WorldWork SDK/transactions/failures）。此批实际 Node25.2.1。
- `/private/tmp/p6c3rev1.related.log`：7文件 **475通过/2失败**，exit1（loot game SFC/i18n/schema/item、crafting schema、WorldWork boundaries、完整图 generation checkpoint differential）。使用 Node24.19.0。命令还带了一个不存在的 `ext_recording_boundaries.test.ts` 过滤路径，Vitest未把它作为文件执行；不计入覆盖，后续另跑真实录像文件。
- schema 单独复现：当前1通过/2失败；原HEAD副本3通过。均为相关定向对照，未修改任何断言。
- `/private/tmp/p6c3rev1.boundary.log`、`p6c3rev1.dependencies.log`、`p6c3rev1.perf-selection.log`、`p6c3rev1.perf-ab.log`：均exit0。
- 独立探针正常exit0表示复现脚本执行完成，不表示实现正确；两个明确异常结果见 F1/F2。
- 全移除与完整本地 A/B 为对作者已有原始制品及当前字节身份的核对，未冒充本轮重新执行；source/dist全文件、控制工具、移除树非模块源码均已独立比对。

修复建议顺序：F1 绑定可见行身份；F2 补完成请求生成域校验及退款负例；F3 按实际 rarity 强化资格算预算并保持旧边界断言。修后最多进入 R2，当前不能判“可合入”。

最终录像补测：`/private/tmp/p6c3rev1.recording.log`，`ext_recording_async.test.ts` + `ext_recording_v4_snapshots.test.ts`，2文件 **36通过、0跳过**，exit0；覆盖255/256/257、2047/2048/2049、同步/worker与旧消息隔离。主要三批相关测试合计14文件、**630通过/2失败**，不把额外过滤复现与基线对照重复累加。审查结论保持 **需修**。
