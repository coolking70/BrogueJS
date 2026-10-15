# 6B2 独立复审（第 2 轮，最后一轮）

结论：**可合入**。首轮四项重要问题全部关闭；本轮定向检查及实测未发现修复引入的新阻断或重要问题。

审查日期：2026-10-15。基线 HEAD `9ab574550dabb88f6cfa9b1e94e6a5fa8450b737`，对象为其未提交 6B2 实现及修复。已读 AGENTS.md、HANDOFF/development/architecture、6B2 任务书、首轮四项发现以及作者报告“审查发现处理”节。按维护者裁定，D4 数值平衡整体延期，不列缺陷；D7 真实浏览器由维护者执行，本结论不代表浏览器验收完成。

## 逐项判定与证据

### R1-F1：原生破防固定重置误揭示 — 已修复

- `src/engine/Core/PhasedAttackProduction.ts:245` 起逐个实际推进区间捕获资源前后值，按该区间的 `activePhases` 排除 `break-recovery`，再分别累计普通整数／分数恢复事实。跨界剩余 idle 区间仍独立判断。`ActorResources.ts` 的算术、固定重置和时钟切段没有因修复而变化。
- 原首轮独立探针原样重跑：50 tick 前 `poise=0, delay=40, stagger=50, known=false`；终点 `poise=12, remainder=0, stagger=0, known=false`。旧误揭示不再发生。
- `loot_review_r1.test.ts:41,70` 的 7 项通过：固定重置前读档；整段／分段／边界读档分别跨界 1 tick 的分数恢复和 30 tick 的整数恢复；真正恢复揭示，随后读档保留。
- 共享资源、原生破防、状态校验及动画调度 4 文件 101 项通过。未发现固定重置被重新归因或普通恢复丢失的反例。

### R1-F2：空戒槽命令与比较列错位 — 已修复

- `src/ext/modules/loot/comparison.ts:37` 的 `lootRingEquipSlots` 同时供 `gameView.ts:35` 的动作列表、`comparison.ts:49` 的比较列及 `gameSession.ts:57` 的提交重验使用。双空只左、左占只右、右占只左、双满可替换左右；已装备候选无重复装备动作。`LootGamePanel.vue:36` 据此显示“佩戴到…”或“替换…”按钮。
- 与宿主 `Game.ts:5508` 起仅双满解释 replacement 的实际路径吻合；提交仍通过 `executeItemCommand`。
- 原首轮探针：左 id18、右空、候选 id19 时仅右列（恢复 2→4）；调用旧错误 `onEquip(false,'left')` 后左仍 id18、右仍空、恢复仍 2。
- `loot_review_r1.test.ts:48,84` 的 7 项通过，覆盖双空／左右单占／双满分别替换／已装备及读档前后实际槽位、数值；`loot_game_sfc.test.ts:47` 新挂载交互通过，实际点击填右后为 4，满槽替左后仍为 4，按钮可见性一致。SFC 证据不等同真实浏览器。

### R1-F3：未知物等分解显示确定零产量 — 已修复

- `src/ext/modules/loot/ui/viewModel.ts:287` 起保留真实分解公式；未知物等仅采用公开合法端点及已知稀有度、预设倍率、允许的腐化状态求 min/max。没有向 UI 传入隐藏精确物等。新的区间提示走 i18n；原 `LootSalvagePanel` 将非等值区间用于单件、总计及确认文字。
- 原首轮探针：`knownIlvl=null`，预览由 0–0 变成 **8–120**，真实命令增加 **32** 碎片。
- `loot_review_r1.test.ts:56,116,129` 的 3 项通过：未知单件、未知／部分已知／完全已知混合原子批次、存读前后区间一致、实际余额与删除状态保持；3 预设×3 稀有度×99 物等×合法腐化情况按独立算术枚举均落入区间。重复读取完整对象图及 RNG 不变，未知 DTO 的 ilvl 仍为 null。

### R1-F4：原生候选丢失当前 loot 物品及条件／符文 — 已修复

- `src/ext/modules/loot/comparison.ts:46,55,58` 分别投影候选／当前 chip，并调用 `ui/viewModel.ts:212` 的已知 modifier 比较；原生侧用 null 表示无 loot 来源，不伪造 loot DTO。helper 仅从 known 行生成条件与符文行。
- 原首轮探针：原生匕首对已知 giantsbane 连枷时，当前 chip 为真实稀有连枷，不再为 null；“大型目标”行 **+61.36%→0%，差值 −61.36%**。
- `loot_review_r1.test.ts:62,143` 的 3 项通过：R08 条件、R12 符文均覆盖 native↔loot，已知收益／损失符号正确；未知时没有条件／符文引用并提示排除；存读前后相同，重复查询完整对象图及 RNG 不变。

## 修复引入问题检查

无新增阻断／重要发现。相对首轮冻结候选仅 11 路径改变：7 个生产文件、SFC 测试、1 个新回归测试和 2 个测试登记文件。逐一检查这些差量及相邻宿主路径；Game、ActorResources、StatPipeline、runtime 均与首轮冻结字节相同。没有新增 Game 字段、规则数据、共享 SDK 权限或存档格式变化；没有放宽守卫、旧断言、超时或新增 skip。

本轮同时执行真实会话、命令、结算、属性、知识、只读与存读回放相关回归。新增回归归属 loot，并将真实 combat 依赖登记为 required，optional 为空；boundary 与静态依赖通过。未把旧全移除副本当成修复后候选验证；按本轮范围没有重跑全移除、类型或构建。

## 本轮实际执行

全部在仓库根串行运行，Node **24.19.0**，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。完整 argv 及退出码见 `/private/tmp/p6b2rev2.plan.json`、`/private/tmp/p6b2rev2.results.json`；日志前缀均为 `/private/tmp/p6b2rev2.`。

| 批次 | 结果 | exit | 墙钟耗时 | 日志后缀 |
| --- | --- | --- | --- | --- |
| A：四项回归及直接相关 UI／结算／存读 | 13 文件 316 项通过 | 0 | 73.71s | related-A.log |
| B：共享资源／破防／状态／动画 | 4 文件 101 项通过 | 0 | 31.92s | related-B.log |
| C：i18n／硬编码／归属／卫生 | 4 文件 37 项通过 | 0 | 23.36s | guards.log |
| `node scripts/check-module-boundaries.mjs` | 边界及测试归属通过 | 0 | 10.94s | boundary.log |
| `node scripts/check-test-dependencies.mjs` | errors=[] | 0 | 6.98s | dependencies.log |
| `node /private/tmp/p6b2rev1.probe.mjs` | 原首轮反例观察结果符合修复预期 | 0 | 7.15s | original-probe.log |

相关测试合计 **21 个不同文件、454 项通过，0 失败，0 skip/todo，无 unhandled 报告**。原首轮探针是观察脚本，单独列出结果，不将其 exit0 算成额外断言数量；其额外 full-hp-leech 观察仍为 45→50，与首轮排除结论一致。

文件清单（测试入口统一为 `node node_modules/vitest/vitest.mjs run <文件> --maxWorkers=2`）：

- A，均在 `src/ext/modules/loot/tests/`：`loot_review_r1.test.ts`、`loot_game_ui.test.ts`、`loot_game_sfc.test.ts`、`loot_trigger_settlements.test.ts`、`loot_trigger_commits.test.ts`、`loot_integration.test.ts`、`loot_commands_integration.test.ts`、`loot_stats_integration.test.ts`、`loot_ui_viewmodel.test.ts`、`loot_ui_components.test.ts`、`loot_ui_knowledge.test.ts`、`loot_ui_i18n.test.ts`、`loot_ui_inert.test.ts`。
- B：`src/test/ext_actor_resources.test.ts`，以及 `src/ext/modules/combat/tests/` 下 `combat_native_defense.test.ts`、`combat_defense_state.test.ts`、`combat_animated_defense.test.ts`。
- C，均在 `src/test/`：`u24_hardcoded_text.test.ts`、`p1_30_i18n_gate.test.ts`、`test_suite_membership.test.ts`、`repo_hygiene.test.ts`。

未执行全量 npm/test:ext、CE、drift、生成普查、移除矩阵、build/types、浏览器或平衡测量。`git diff --check` 通过。

## 候选身份与只读保证

作者修复后冻结的 1,489 个源码输入逐文件 SHA256 全部吻合；按 `path\0sha\n` 汇总仍为 `1b145bc706fd4733fd53249120485048771e31e3d0c66447267768f780323fc4`。

审查前后另外对全部 3,048 个已跟踪及未忽略未跟踪仓库文件比对，内容及路径差异为空；HEAD 未变。核对记录 `/private/tmp/p6b2rev2.identity.json`。本轮只写 `/private/tmp` 报告／执行记录，未修改仓库文件，未 commit。
