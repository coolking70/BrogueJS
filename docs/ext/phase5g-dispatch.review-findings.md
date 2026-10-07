# 5G 派发任务包独立只读审查

审查日期：2026-10-07。审查树：`BrogueJS-5gbase` / `ext/phase5g-base`；代码基线 `5e9753030696d2e8ea177c27007c2f15253d3eba`；HEAD `4829b4000ba66d5414a486fef60c42cd90b69562`；旧任务包 `34bb6c759492ee3499a62eb02375e27e8d8c21b9`。

结论：**1 条 P2，0 条 P1/P3。建议原执行会话 resume 修正下列确认驱动说明后再发布派发 tip。** 此项来自旧包已有指引，会影响本次强制自然 trace，未建议改数据、玩法或底座。此次更新的基线、冻结值、授权状态、导入白名单和门禁阶段调整未发现其他问题。

本报告唯一写入位置为用户指定的 `BrogueJS-p5/docs/ext/phase5g-dispatch.review-findings.md`。没有修改 5gbase 的源码、任务包、脚本或报告，没有 commit/push/fetch。已读 AGENTS.md、HANDOFF/development/architecture、扩展 README、commander-handoff、owner 修复报告与独立审查、完整任务包，以及 `/private/tmp/brogue-commander-20261007/package.report.md`。

## F1 — P2：原生命令确认的循环方案缺少启用挂起模式的前提，会把 trace A 的 No 自动变成 Yes

**文件/行**：`docs/ext/phase5g.dot-package.md:942`（§8.1 当前执行指引）；受影响要求在 `:954`（T-EAT 的 No 必须录制且零成本）和 `:973`（trace A 必须先 No 再 Yes）。`:88` 的旧 A.2#19 也含同一说法，但它现已明确标为历史，不需改写历史实测。

**证据**：

- §8.1 将两种方法并列为可直接使用：设置 `onConfirmRequest`，或者在 `h.command()` 后循环 `resolveCommandDecision(pendingCommandConfirmation.token, answer)`，并指向 crafting 的 `traceHelpers.ts`。
- `src/ext/testing/worldHarness.ts:36–45,67–69` 创建普通 Game 并直接调用 `executeCommand`，未设置 `onCommandConfirmRequest`。`Game.ts:710` 该回调默认 null。
- `Game.ts:3647–3658` 只有已设置 `onCommandConfirmRequest`（或非录制确认的特殊分支）才挂起并生成 pending token；否则立即走 `confirmationDecision`。`:3703` 没有同步回调时默认答 true。`worldHarness.ts:55` 的上一条 `h.ext()` 还会留下 `answers[cursor++] ?? true` 回调；trace A 前面的 harvest 因此也不会使随后的原生吃命令挂起。
- `src/ext/modules/crafting/tests/traceHelpers.ts:86–95` 正是先 `h.command()`、后查 pending，未安装挂起回调。它不能在这个默认环境中给原生吃命令补答 No。`Game.ts:5501–5508` 的吃菌确认已在命令执行过程中作出，命令返回后再检查 pending 太迟。crafting 现有 trace 只使用 move/楼梯/auto_step/ext 命令（`crafting_trace.test.ts:49–52`），其历史通过不能证明这一原生 No 路径有效。

**影响/最小复现路径（源码核验，未运行游戏探针）**：用默认 `createWorldHarness`，采集后让玩家仍满足“不太饿”条件，把 `answers:[false]` 交给照抄的 `executeTraceCommand(h,{action:'item:execute',data:'eat|<letter>',answers:[false]})`。吃命令会同步答 Yes 并消耗物品/时间，之后 while 没有 pending 可处理。这样无法满足 trace A 和 T-EAT；也可能把第一次拒绝错误地捕获为成功进食。包内第一种同步回调方法本身正确，问题是第二种方法被写成无需前置设置的等价替代。

**最小修订建议（只改任务包正文）**：

1. §8.1 明确推荐为每条原生命令在执行前安装该条命令自己的 `game.onConfirmRequest = () => answers[cursor++] ?? true`，并在结束后恢复原回调；特别说明不要复用上一次 `h.ext()` 留下的回调。
2. 若保留 pending 循环方案，补上前提：在执行命令前安装 `game.onCommandConfirmRequest = () => {}`，循环回答直到命令完成后恢复原回调。说明不能原样照抄 crafting helper 作为支持原生命令 answers 的完整实现。
3. 在 §8.3/T-TRACE 补充实际确认答案断言：首次拒绝的录制事件 `decisions` 为 `[false]` 且背包/时间未变化；第二次为 `[true]` 并成功吃下。不改冻结 SDK、harness 或 crafting helper，也不改 §5.10/§7.4 两个权威块。A.2 可继续保留历史原文，由当前 §8.1 注明补充前提。

## 已独立核对且通过的项目

| 审查项 | 证据与结果 |
| --- | --- |
| 差异范围 | `git diff --name-only 5e9753030696d2e8ea177c27007c2f15253d3eba` 恰为 `docs/ext/phase5g.dot-package.md`、`scripts/check-module-boundaries.mjs`；相对 HEAD 只有任务包未提交，无未跟踪文件。边界脚本逐字等于 34bb6c7。 |
| §0 / §2 基线 | 代码 SHA、分支、只允许 foraging 自有目录及两份交付文档、推送目标、实际起始 tip 与代码基线的区分一致；§A.5 如实说明本地文档尚未发布。 |
| A.6 已修 | `WorldWorkOwner.ts:6–8` 确实查询 items/resourceNodes/stations/recipes/edibleItems 五列表；`WorldWorkValidation.ts:27,204,219,271–273` 与 `WorldWorkWorld.ts:709` 已接线。该实现与回归在基线提交 5e97530 内；具体定义/owner/操作类别校验仍保留。修复报告 242 项及独立审查 73 项只作为历史证据，本轮未重跑。w_26 提交 2571abe 是代码基线祖先。 |
| 冻结文件 | §A.1/§2 的九个文件实际 SHA 均匹配；八个逐文件行及 fgfixture/index 的冻结值正确，冻结源码相对代码基线无 diff。fgfixture 树 SHA 为 `7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`。 |
| 模块/格式 | 实际仅安装 combat/crafting/giants/growth/narrative，版本分别 1.6.0/1.0.0/1.0.0/1.8.0/1.4.0；foundation 10、worldSdk 1、edible SDK 1、whole-run 6、recording 4、origin 2、IDB 2，与任务包一致。 |
| 权威数据/locale | 两个代码块与 34bb6c7 按字节相等，均可解析 JSON；没有 ID/数值/名字/文案/数组顺序变化。12 菌种、24 edible、12 节点、18 外观；20 个 nonEaters 去重码点序且均在当前 monsters.json 中。200 条 locale 对 35 禁用词零命中；30 个名称唯一且均以“菌”结尾，prism 为“苍鸾菌”。 |
| 授权表述 | §开头、A.5/A.7、1.2、5.8、6.4、10、12.3 均将全部 20 条、20 模板、苍鸾菌与烤菌揭示生菌列为指挥依“先推荐推进”授权临时采纳、待用户确认；没有改写成用户逐条终审。 |
| 门禁政策 | §0:32、§8 的 T-COMBO/T-PERSIST/T-TRACE、§9.2、§10.1/10.4 一致保留自有功能、直接回归、7 行相关组合、两条自然 trace/drift、可执行浏览器矩阵；完整 npm test/全部 test:ext/完整 64 组合/所有删除留 5Z。没有要求本轮重做旧完整矩阵。 |
| 历史 A.4 | A.2–A.4 整段逐字等于 34bb6c7；`:43` 和 A.6 明确其 6e068cd 副本、临时补丁、64/64 engine-only 的历史来源，未冒充此次新运行或浏览器验收。 |
| 导入合同 | §0:28、§6.0、T-IMP:948、§12.3#17 均禁止 stats（含 type），world 仅 type，允许 edibleSdk。边界脚本 `:277–306` 与此一致；§6.0 的 statSources 派生类型与真实 ExtensionModule/StatSourceProvider 形状一致。 |

权威块 SHA（按执行报告同一口径：围栏内 JSON 文本，不计结束围栏前的分隔 LF）：

- §5.10：25738 字节，`2bb0c3223673bf23d90253086b7eace9e8d9eeb124789bb24c9b1e096680330d`。
- §7.4：13776 字节，`7bd06b35b64f974d52ada783da3392391129f80f8c865ccbfc2c2612429c20ce`。
- 受审任务包全文：`cb2193d4eeda9aa9f67ea376d53afefdb9c881a4f893138c6312130d68d454ef`。

## 本轮实际检查与边界

- 独立执行 Python 字节/JSON/名称/名单/哈希检查，以及 Git 差异、提交祖先与版本源码检查；没有直接运行执行方检查脚本替代独立核对。
- `git diff --check 5e9753030696d2e8ea177c27007c2f15253d3eba`：exit 0；任务包无 CRLF。
- `PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH NODE_OPTIONS=--max-old-space-size=3072 node scripts/check-module-boundaries.mjs`：exit 0，输出 `Module boundaries and test ownership verified.`，约 1.94 秒。
- 未运行 vue-tsc/build、游戏测试、trace/drift、完整 npm test/test:ext、组合/删除矩阵或浏览器；没有把静态检查算作产品验收，也没有重录基线。F1 为实际源码执行分支核验，不声称已做游戏动态复现。
- 本地远端跟踪引用 `origin/ext/phase5g-base` 仍是 34bb6c7（未联网 fetch）；因此“§0 可转贴”以指挥随后发布修订后的 tip 并核对远端为前提，当前不能声称 dot 立即 fetch 就会拿到这份未提交包。这与 §A.5 的发布待办一致，不另列文档缺陷，本审查不执行提交/推送。

原执行会话仅需修正 F1 的当前执行说明并复核两权威块及范围；不应因此更改历史证据、源码、数据或玩法。

## 指挥复核与处置（2026-10-07，首轮审查后的补记）

F1 已交回原执行会话 `01a11650-6e75-7e20-aaa6-e3cde1ae43f5` resume 修订。指挥对照 `Game.ts` 的 advanceCommand/confirmationDecision 和 worldHarness.ext/command 实际分支核验：新 §8.1 明确逐条原生命令安装同步 onConfirmRequest，临时清空挂起回调，finally 恢复两回调；不再把默认 pending 循环当成等价方案。T-EAT/T-TRACE/§8.3 要求实际询问一次、事件 decisions 严格为 [false]/[true]、首次零成本和其次实际进食。另按交接单补齐 §0/§10.3 提交署名。

指挥独立比较确认：§5.10/§7.4 两权威块与34bb6c7逐字相同，边界脚本原字节不变，相对5e97530仍只有任务包/白名单两个文件，diff检查通过；最终包SHA-256为 `d407c169fa17488c5fcfbd702efa31ecad9fcec6f0ebbe26c1ef2ace425eedd3`。以上为指挥静态源码/文档复核，不是新增游戏动态验证；原独立审查事实与限制保留。**F1关闭，允许提交发布；远端SHA另在指挥状态记录。**
