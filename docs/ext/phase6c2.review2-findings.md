# 6C2 独立复审第 2 轮（最后一轮）

结论：**可合入**。R1-F1、R1-F2、R1-F3 均已独立核实修复；本轮定向范围内未发现修复引入新的阻断或重要问题。附带统计 NaN 修复亦通过检查。

## 审查身份与范围

- 基准 HEAD：`e27648489953069b9aca4c9cf2b8a5ed5162a372`；对象为其上的全部未提交实现及修复，本轮定向追踪三项 R1 发现及修复相邻路径。
- 已读根 AGENTS.md、docs/HANDOFF.md、docs/development.md、docs/architecture.md、phase6c0-contract（重点 §4，结合 §2.1/§6.1）、phase6c2.review-findings 的第 1 轮发现，以及 phase6c2.report 的审查发现处理节。
- 独立计算 src 1467 文件聚合 SHA256：`670488fad3894ebe7c4ab4b6d6a8630b15424c1494f540c44016483ee3134193`，与作者 R1 修复报告一致。
- 按用户限定仅跑相关测试、boundary、测试依赖检查及原独立复现脚本；未跑全量、drift、build/types、模块移除、浏览器或性能。浏览器、平衡、云端性能不列为缺陷；本结论不代替这些验收。

## 三项发现复核

| 发现 | 结论 | 独立核实与相邻风险检查 |
| --- | --- | --- |
| R1-F1：地面词装 DTO 被拒 | 已修复，关闭 | `src/engine/Items/ItemPresentation.ts:10–16` 仅保留有界 count/sequence 并重建对象；`src/ext/modules/loot/gameView.ts:41–43` 使用同一次公开投影。原 `/private/tmp/p6c2rev1-floor.mjs` 原样重跑：真实两次 socket→drop 后投影含 2 孔及 ka/ul，输出 `FLOOR_VIEW_OK`。专项覆盖 0 孔、部分镶嵌、两孔词、四孔前缀、底材附魔/力量/诅咒/熟悉度不泄露、多次只读全图不变；两词真实 drop 后存读/2049 事件回放/边界 seek/续录通过。未放宽 DTO 校验。 |
| R1-F2：材料绕过 C5 预算 | 已修复，关闭 | `src/engine/Core/Game.ts:1344–1350` 在落点 RNG 与装配前调用已有 `checkItemBudget(this,1)`，逐提案重读全部根和工作输出预留；仅吞 `World5Error/C5_BUDGET` 为 `skipped:capacity`，其他异常继续回滚。原 probe 原样重跑得到 7168→7168、runeDelta=0。六组 7166/7167/7168 根、真实工作票据预留及 native 先接纳的专项全部通过；原生 8192 路径保持。真实攻击死亡在容量拒绝后仍成立，存读/全回放/seek/续录一致；C5 根所有权和工作边界相邻测试通过。 |
| R1-F3：单正权重耗骰 | 已修复，关闭 | `src/ext/modules/loot/generator.ts:256–259` 改用原 `weightedPick`，单正候选直接返回。原 probe 对 `[0,0,100,0,0]` 输出 sockets=2、draws=[]。专项逐一检查 0…4 孔、权重 1/100，底层 RNG 回调不得执行，结果和 trace 均零骰；三段生产表的每段 100 个字面枚举点仍恰一骰，戒指及相邻生成向量通过。 |

原脚本本轮输出：

```text
FLOOR {"onFloor":true,"visible":true,"projection":{"rarity":"runeword","sockets":{"count":2,"sequence":["loot.rune.ka","loot.rune.ul"]}}}
FLOOR_VIEW_OK
SINGLETON {"sockets":2,"draws":[]}
MATERIAL_BUDGET {"before":7168,"budgetError":"C5_BUDGET","after":7168,"runeDelta":0}
```

附带统计修复：`src/ext/modules/loot/tools/stats.ts:60,225,298–300` 补齐六类计数并去掉错误索引断言；历史 6B1 理论比较显式使用四类模型，实际模拟仍用完整生产目录，报告说明口径。原 15 项全部通过，包括 JSON 往返、独立权重、原容差、逐层总数以及新增 set 实际样本/六类有限数检查。未发现为消除 NaN 而改动生产掉率或放宽原断言。

## 本轮实际执行结果

Node `v25.2.1`。两批 Vitest 串行，每批 `--maxWorkers=1 --no-file-parallelism`，均 exit 0，无失败、skip/todo 或 unhandled 报告。

1. **9 文件 / 297 项通过**，120.58s。文件：
   - `src/ext/modules/loot/tests/loot_sockets.test.ts`
   - `src/ext/modules/loot/tests/loot_stats.test.ts`
   - `src/test/ext_item_presentation.test.ts`
   - `src/test/ext_item_drop.test.ts`
   - `src/test/ext_item_commands.test.ts`
   - `src/test/ext_generation_checkpoint_differential.test.ts`
   - `src/ext/modules/loot/tests/loot_generator_vectors.test.ts`
   - `src/ext/modules/loot/tests/loot_ui_viewmodel.test.ts`
   - `src/ext/modules/loot/tests/loot_game_sfc.test.ts`
   日志：`/private/tmp/p6c2rev2-tests.log`。
2. **2 文件 / 31 项通过**，30.48s：`src/test/ext_world_items_roots.test.ts`、`src/test/ext_world_work_boundaries.test.ts`。日志：`/private/tmp/p6c2rev2-c5.log`。
3. `node scripts/check-module-boundaries.mjs`：exit 0，`Module boundaries and test ownership verified.`；日志 `/private/tmp/p6c2rev2-boundary.log`。
4. `node scripts/check-test-dependencies.mjs`：exit 0，errors=[]；日志 `/private/tmp/p6c2rev2-dependencies.log`。
5. 原 `/private/tmp/p6c2rev1-floor.mjs`、`/private/tmp/p6c2rev1-probe.mjs` 原样执行均 exit 0；日志分别 `/private/tmp/p6c2rev2-floor.log`、`/private/tmp/p6c2rev2-probe.log`。Vite 的非致命 sandbox websocket EPERM 告警不影响脚本完成，不列为产品缺陷。
6. `git diff --check e276484`：exit 0。审查前后对全部 3134 个 Git 已跟踪及非忽略未跟踪仓库文件逐文件 SHA256 对照，路径集合与字节均无变化；记录 `/private/tmp/p6c2rev2-before.json`、`/private/tmp/p6c2rev2-unchanged.json`。

合计 **11 个相关文件、328 项全部通过**。未修改仓库文件、未 commit。报告仅写入 `/private/tmp/p6c2rev2.findings.md`。本轮最终结论：**可合入**。
