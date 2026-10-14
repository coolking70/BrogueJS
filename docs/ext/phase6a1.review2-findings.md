# 6A1 独立复审，第 2 轮（最后一轮）

**最终结论：需修。** 七项中六项已修，一项部分修复；另确认一项重要正确性回归，见下文 N1。没有修改仓库源文件、测试或文档，没有暂存、commit 或 push。

复审对象：`/Users/coolking70/Documents/同步空间/BrogueJS-p6` 相对 HEAD `ff9dee3d3dfba3daf752c74e097467c0ed4c50be` 的未提交实现及修复。日期：2026-10-15。已读 AGENTS.md、项目交接/开发/架构文档、phase6a1.task.md、phase6a1.review-findings.md，以及 phase6a1.report.md 的“审查发现处理”及后续复核记录。结论来自本轮代码阅读和实际运行，不引用作者的通过数充当本轮结果。

**七项逐项核实**

| 项目 | 判定 | 代码与实测证据 |
| --- | --- | --- |
| R1 否定爆发知识同步 | **部分** | `Game.ts:8235` 在爆发前捕获世界/RNG/allocator 并进入扩展事务；地面戒指通过 `ItemLoader.identifyInstanceOnly` 同步 owner 知识。原有成功及完整图失败回归通过，独立探针也确认 `identified=true / known=true` 且可以保存，种类仍未知。但同步错误清除鉴定目标资格，见 N1。 |
| R2 碎片整件鉴定 | **已修** | `ItemCommands.ts:80-93` 使用完整 `ItemLoader.identifyInstance`，学习种类、符文并同步 owner；晚失败恢复种类知识集合、材料、属性会话和时钟。`ext_item_commands.test.ts` 27/27 通过，包含戒指实际点数 2→5、机械 revision 增加、武器 runicKnown 亮起及晚失败回滚。 |
| R3 vault 拒绝转换回退 | **已修** | `Game.ts:1458` 起先用一次原生 chooseKind 保存选定 kind，投掷直接走原生，近战拒绝转换复用该 kind。`ext_item_drop.test.ts` 穷举全部 140 个权重点，验证 kind 与类别/种类抽骰调用次序；整文件 34/34 通过。未再从完整武器池重抽。 |
| R4 盟友遭遇领奖 | **已修** | `runtime.ts:1939` 与 `Game.ts:11127` 将盟友/克隆/无奖励及行政死亡转为 lost；可信分裂后代用 `itemDrops.ts` 的 splitSubjects 保留原遭遇资格。encounter-only、无 kill 出生表的四类负例通过；分裂失效跨存读档、清除阵营前先记 lost、合法真实 giants 分裂最终结算均通过。相邻 body transition、giants transitions 和 D3/D7 原黄金也通过。 |
| R5 数组 getter 先执行 | **已修** | `ItemData.ts:15` 起用 length/索引/属性描述符检查，再仅递归 descriptor.value，不调用 every 读取元素。`ext_item_data.test.ts` 20/20 通过，数组索引访问器回归确认 getter 调用数为 0。 |
| R6 熟悉度空操作性能 | **已修** | `ItemLoader.ts:913-942` 将已知/不适用/普通倒计时置于事务之前；`ItemExtensionBindings.ts:31` 用会话 WeakSet 消除同一绑定的嵌套事务。回归验证已知空操作和普通扣减 0 个完整 checkpoint、护甲/戒指揭示各 1 个，以及纯揭示失败恢复物品。独立性能探针两组共 1100 次调用（含预热），完整 checkpoint=0，P95 均为 0.000167 ms。 |
| R7 冷查询与比较性能 | **已修** | `StatPipeline.ts:306` 的求值器共享单次来源和 DAG memo；`runtime.ts:443-468` 复用冻结装备事实及按 revision/实际来源内容校验的结果。完整预算、无副作用、变坏来源/访问器不能命中旧凭证等回归通过。独立复测冷查询 median/P95=0.038292/0.047791 ms；比较=0.140750/0.158041 ms，最大 0.626916 ms；一次比较 collect=1，达到原门限。 |

**本轮新确认的重要问题（仅列重要/阻断）**

1. **N1，重要（S2）：否定后的 C6 戒指仍未知种类，却失去鉴定卷轴目标资格。**

   位置：`src/ext/runtime.ts:1893-1894`、`src/engine/Items/ItemLoader.ts:877-904`；实际目标检查在 `src/engine/Items/ItemUseCoordinator.ts:31-34`，背包 UI 也按 canBeIdentified 过滤。

   `identifyInstanceOnly` 正确保留“种类未知”，但它调用的 `revealItemKnowledge` 无条件用 `!candidate.identified` 派生 canBeIdentified。模块全部 known 后该标志变成 false；后续 `updateIdentifiableItem` 只会清除标志，不会为未知种类重新置 true。因此原生鉴定卷轴拒绝选择这枚仍需学习种类的戒指。存读档也不会恢复资格。

   独立真实 Game 探针使用 completeDescriptor，放置未知 +4 C6 再生戒指，执行原生否定爆发，再放入背包并调用生产目标检查，结果为：

   ```text
   R1_C6_RING {"identified":true,"moduleKnown":true,"kindKnown":false,"canBeIdentified":false,"scrollSelectable":false,"saveOK":true}
   R1_AFTER_LOAD {"kindKnown":false,"scrollSelectable":false}
   R1_NATIVE_CONTROL {"kindKnown":false,"scrollSelectable":true}
   ```

   不带 moduleData 的同类原生戒指在相同否定路径下仍可被选中，证明是新增知识同步接线造成的差异。现有 R1 回归只检查 known/identified、种类未学习和可保存，遗漏了后续目标资格。应按原生“是否还有种类/实例/符文知识可学”维护 canBeIdentified，补充否定→拾取→鉴定目标与存读档回归，不能把实例已知等同于整件再无可学知识。

   可复现脚本：`/private/tmp/p6a1rev2-probe.mjs`；实际输出：`/private/tmp/p6a1rev2-probe.log`。脚本只在 /private/tmp，未更改仓库。

**实际验证范围与命令**

全部执行使用 Node `v24.19.0`，`NODE_OPTIONS=--max-old-space-size=3072`，PATH 前置任务书指定 Node 目录。完成的 Vitest 批次均为单 worker：`node node_modules/vitest/vitest.mjs run <明确文件列表> --maxWorkers=1 --pool=threads --no-cache`。后三批额外使用 default 和 /private/tmp 中的只读进度 reporter，不改变用例/断言/超时。

| 完成批次 | 明确文件（相对 src/test，另标完整路径者除外） | 结果 | 日志 |
| --- | --- | --- | --- |
| JSON 数据 | ext_item_data.test.ts | 1 文件 20 项，exit0，5.85s | `/private/tmp/p6a1rev2-runner-check.log` |
| 直接修复 | ext_item_commands.test.ts、ext_item_drop.test.ts、ext_item_stats.test.ts、ext_stats_pipeline.test.ts | 4 文件 117 项，exit0，57.58s | `/private/tmp/p6a1rev2-focused.log` |
| 相邻行为 | ext_stats_native.test.ts、ext_stats_runtime.test.ts、ext_stats_review.test.ts、phase4e_body_transition.test.ts、b_1b_identification_persistence.test.ts、x3b_item_details.test.ts；src/ext/modules/giants/tests/giants_transitions.test.ts、giants_trace.test.ts | 8 文件 152 项，exit0，81.33s | `/private/tmp/p6a1rev2-adjacent.log` |
| 生命周期 | ext_item_presentation.test.ts、ext_item_recording.test.ts、ext_item_roots.test.ts | 3 文件 26 项，exit0，84.06s | `/private/tmp/p6a1rev2-lifecycle.log` |

去重合计 **16 文件 315 项通过，包含全部 18 项新增审查回归**，无失败、skip/todo 或 unhandled。这里是四批完成结果，不冒称一次整批全绿。包含当前 codec 的 save/load、replay/seek/续录、256/2048 检查点以及真实 giants 正常分裂路径。

此前两个 16 文件批次（先默认 fork 池、后 threads 池）只输出 RUN，长时间没有用例结果，均被我中止，exit130；不计通过、不将其归为生产失败。日志分别为 `/private/tmp/p6a1rev2-related.log` 和 `/private/tmp/p6a1rev2-related-threads.log`。随后拆分上述批次实际完成。

- `node scripts/check-module-boundaries.mjs`：exit0；日志 `/private/tmp/p6a1rev2-boundary.log`。
- `node scripts/check-test-dependencies.mjs`：exit0，630 文件、7 个已安装模块、errors=[]；结果 `/private/tmp/p6a1rev2-dependencies.json`，stderr 为空。
- 冻结清单独立 SHA-256 复算：368 条全部匹配；没有修改清单或源文件。
- 性能：将仓库 `src/ext/testing/probes/phase6a1-perf-probe.mjs` 复制到 `/private/tmp/p6a1rev2-perf.mjs`，仅调整 Vite 导入绝对路径及结果输出路径；在所有测试结束后单独运行，exit0。日志 `/private/tmp/p6a1rev2-perf.log`、数据 `/private/tmp/p6a1rev2-perf.json`。Apple M5/darwin-arm64，4 件装备加 1 件比较候选、1 个 owner；查询 50 预热/500 样本、比较 10 预热/100 样本，P95 用 ceil(0.95N)-1。冷查询清结果/来源缓存，保留按 revision 和实际输出验证的不可变凭证；不声称覆盖所有模块组合或整机独占。
- 缓存命中 P95=0.002375 ms。八件完整死亡事务 P95=36.618583 ms，范围与作者探针相同，不据此宣称纯生成单件 ≤1 ms。

额外故障注入筛选：临时脚本还验证了知识回调直接分配实体、取 RNG 后抛错时，熟悉度事务不恢复这两项（ID 34→35）。该注入越过了知识回调仅接收脱离实体 DTO、无 RNG/实体创建权限的约定；本轮不把这种违反 provider 合同的副作用列为重要正确性缺陷，也不据此否定 R6 的正常纯回调修复。实际玩家可触发的 N1 不依赖这些非法行为。

未运行全量 npm test/test:ext/test:full、CE 生成对照、drift、删除矩阵、浏览器或构建/类型门禁；严格遵循本轮仅相关测试与 boundary/测试依赖检查的范围。**结论仍为需修，不能以 315 项相关回归通过覆盖 N1。**
