> 指挥归档：保留执行进程的阶段性表述；F1已由原会话修订并经指挥复核关闭，最终包已推送ext/phase5g-base@7fdc249。当前状态以commander-status.md及审查末尾的指挥补记为准。

# 5G 任务包派发前最终更新报告

完成日期：2026-10-07。独立审查 F1 已按本次 resume 要求修订，提交署名补充已完成；仅文档交付，停止供指挥核对。

## 结论与范围

工作树 `/Users/coolking70/Documents/同步空间/BrogueJS-5gbase`，分支 `ext/phase5g-base`。代码基线 `5e9753030696d2e8ea177c27007c2f15253d3eba`，当前 HEAD `4829b4000ba66d5414a486fef60c42cd90b69562`（cherry-pick 旧定稿 `34bb6c7`）。HEAD/分支保持不变，未 commit/push/切分支。

本轮唯一修改仓库文件：`docs/ext/phase5g.dot-package.md`（含本次审查修订，相对 HEAD：95 行新增、63 行删除）。相对代码基线 `git diff --name-only 5e9753030696d2e8ea177c27007c2f15253d3eba` **恰好两个文件**：任务包与 `scripts/check-module-boundaries.mjs`；无仓库内新增报告、无未跟踪文件。边界脚本未修改，逐字等于旧定稿 `34bb6c7`。

任务包最终 SHA-256：`d407c169fa17488c5fcfbd702efa31ecad9fcec6f0ebbe26c1ef2ace425eedd3`（F1/署名修订后；受审前版本为 `cb2193d4eeda9aa9f67ea376d53afefdb9c881a4f893138c6312130d68d454ef`）。

## 修改依据与结果

1. 已读 AGENTS.md、项目 HANDOFF/development/architecture、扩展 README、代码基线中的 commander-handoff 和 owner-lookup 修复报告、独立审查报告，以及完整任务包。维护者本轮指令及交接单 §1/§4 的最新政策优先于 README 的旧一般 full 要求。
2. 开头、§0、§A.1/A.5/A.6、§2、报告/回复模板中的实际代码基线与所有开工 diff 命令统一为 `5e9753030696d2e8ea177c27007c2f15253d3eba`；派发 tip 表述为“代码基线 + 包与白名单定稿修订”，不声称只有一个提交。§A.5 明确本轮本地更新未发布，远端 tip 由指挥发布后核对。
3. §A.6 原 owner 阻断改为已解除，链接 `phase5g-owner-lookup.report.md` 与 `phase5g-owner-lookup.review-findings.md`。源码核对共享 helper 查询五列表、终端/facts/活跃票据/投影接线；修复报告的 242 项、独立审查的 73 项属于其各自历史证据，本轮没有重跑或冒称新运行。基线含 i18n 修复，`git merge-base --is-ancestor 2571abe 5e9753030696d2e8ea177c27007c2f15253d3eba` 退出 0，确认 w_26 修复提交在祖先链中。
4. §A.2–A.4 **整段逐字等于 `34bb6c7`**，其 `6e068cd` 副本来源和临时补丁、64/64 历史 smoke、浏览器未运行等限制不改写。§A 前言明确区分当前哈希/版本核对与旧副本实测；64 子集事实保留，全覆盖留 5Z。
5. 指挥根据维护者“按推荐推进并记录，只有大且难回退才停”的本轮授权，临时采纳 §12.3 全部 20 条、nonEaters 20 模板、苍鸾菌、揭示烤菌同时揭示生菌；统一写为“按推荐执行，待用户确认（可逆，不阻断派发）”。同步 §A.5/A.7、§1.2、§5.6/5.8、§6.4、§12、报告模板，去掉旧派发前待签阻断及“已逐项批准”暗示。严格命名规则和 35 项禁用词逐字保留。
6. §0/§9/§10 统一 5G 交付门禁：boundary、vue-tsc、build、全部 foraging 自有定向测试、直接受影响既有测试、test:drift、T-COMBO 真实相关组合、两条自然 trace、能执行的浏览器矩阵。完整 npm test、全部 test:ext、完整 64 组合 smoke、所有删除检查（包括原两行删除）均延至 5Z。明确这是指挥按最新政策调整执行阶段，功能验收仍保留；不可执行项写 blocked/未运行与原因。共享 composition 脚本默认全枚举，因此 5G 用模块自有真实组合测试，不修改脚本，不误造过滤参数。模板不再要求 64/64 或删除通过。
7. 文档一致性修正：T-IMP 与 §6.0 对齐，禁止 `stats` 的任何导入（含 import type），`world` 才仅允许 import type；§7.4 不再允许擅改既有文案错别字，统一与 §0 逐字冻结规则一致（新增 UI/错误键仍遵 §12.2）；§7.1 澄清禁止绕过知识解析另输出已知名，允许既有 DTO 的 SDK displayName；§8.3 trace final 补列 state，满足已存在 T-TRACE 的终态 state 比对；T-COMBO 显式写仅 foraging，与闭环要求及 §9 的 7 行相关组合一致。这些是正文合同对齐，未变更机械数据、数值、ID、名称或 locale 文本。

## 数据、哈希与版本核对

`check.py` 用 subprocess 读取 Git blob，以字节比较而非格式化 JSON 比较两个权威代码块。两块与 `34bb6c7` **逐字相同**（含空白/数组顺序），可解析 JSON；以下 hash 是代码围栏内部内容的 SHA-256：

| 对象 | 字节数 | SHA-256 |
| --- | ---: | --- |
| §5.10 权威数据 | 25738 | `2bb0c3223673bf23d90253086b7eace9e8d9eeb124789bb24c9b1e096680330d` |
| §7.4 locale | 13776 | `7bd06b35b64f974d52ada783da3392391129f80f8c865ccbfc2c2612429c20ce` |

计数：12 菌种、24 可食定义、12 节点、18 外观；nonEaters 20 项去重码点序，全部存在于当前 monsters.json；200 locale 值逐条扫描 35 禁用词 **0 命中**；30 名称唯一且均以“菌”结尾，prism 为“苍鸾菌”。这是静态数据/文档检查，不是本轮调用真实 SDK 构造新局；真实 SDK 校验来源仍为 §A.4 历史。

9 个冻结文件均与代码基线逐字相同、实际 SHA 与任务包 §A.1/§2 冻结表一致：

| 文件 | SHA-256 |
| --- | --- |
| `src/ext/worldSdk.ts` | `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343` |
| `src/ext/edibleSdk.ts` | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` |
| `src/ext/worldEdible.ts` | `7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67` |
| `src/ext/kindKnowledge.ts` | `4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f` |
| `src/ext/actorNeeds.ts` | `8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e` |
| `src/ext/stats.ts` | `c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84` |
| `src/ext/testing/worldHarness.ts` | `a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0` |
| `src/ext/testing/forageHarness.ts` | `ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38` |
| `src/ext/testing/fixtures/forageFixture/index.ts` | `adc02caaa085519c54a4c0c202ef9f06f1a2b818806bd6b819773f81a4b1abea` |

fgfixture 目录树 SHA：`7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c`，按排序的仓库相对路径 + NUL + 单文件 SHA + LF 再 SHA-256；目录仅 index.ts，匹配冻结值。

边界脚本 SHA：`c25c72f26289be0a0a9010bbd8a7d3de8a0bfab883cfb8b27f9d3ef6795c469e`，与 `34bb6c7` 逐字相同。

源码/定义包核对：foundation **10**、worldSdk **1**、edibleSdk **1**、whole-run **6**、recording **4**、origin **2**、IDB **2**（IDB 实际定义在 SaveDatabase.ts）。已安装模块及其 module/rules 版本：combat **1.6.0**、crafting **1.0.0**、giants **1.0.0**、growth **1.8.0**、narrative **1.4.0**；没有 production foraging 或 settlement。相关版本源码均与基线逐字相同。

## 首轮实际命令与结果（审查前历史证据）

运行器：`python3 /private/tmp/brogue-commander-20261007/package-evidence/run.py`，退出 0。PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，`NODE_OPTIONS=--max-old-space-size=3072`。

| 命令 | 退出码 | wall 秒 |
| --- | ---: | ---: |
| `node --version` | 0 | 0.012 |
| `python3 /private/tmp/brogue-commander-20261007/package-evidence/check.py` | 0 | 0.248 |
| `git diff --check` | 0 | 0.01 |
| `git diff --stat 5e9753030696d2e8ea177c27007c2f15253d3eba` | 0 | 0.01 |
| `node scripts/check-module-boundaries.mjs` | 0 | 2.254 |

boundary 输出：`Module boundaries and test ownership verified.`；本轮仅这项门禁，无 vitest 项目计数。检查脚本全断言通过，结果为 `check.log`；运行器各命令原始 stdout/stderr 为同名 `.log`，命令、退出码与耗时在 `results.json`。

另执行 `git diff --check 5e9753030696d2e8ea177c27007c2f15253d3eba` 退出 0；`git diff --numstat` 仅任务包 65/58。无 CRLF。首轮 scope、HEAD、分支及受审前包 hash 在 `check.log` 可复核；本次最终值见 `f1-check.log`。

探索性只读搜索中曾误用不存在的 `src/engine/Core/Recording.ts`、`src/types/Recording.ts`（rg 返回 2）和未匹配的 `*Origin*` glob（zsh 报 no matches）；随后按实际 Game.ts/WholeRunSnapshot.ts/SaveDatabase.ts 定义完成版本核对。不是门禁失败，未用于结论。

## 未运行与交接

按本轮纯文档授权，没有运行 vue-tsc/build/完整 npm test/test:ext/test:drift、foraging 定向游戏测试、自然 trace、任何组合/删除矩阵、浏览器或 CE 门禁；没有重录基线，没有安装生产 foraging。该文档规定的是后续 dot 5G 实现验收，不把本轮 boundary 当作产品验收。

本报告与检查脚本/日志全部在 `/private/tmp/brogue-commander-20261007/`，不提交仓库。独立审查已完成并提出 F1（P2）；执行方修订见下，等待指挥核对，不冒称修订后再次独立验收；原执行会话保留供 resume。无需本轮另行请求用户逐条确认，临时采纳项已照实登记且不阻断派发。


## 独立审查响应与署名补充（本次 resume）

来源：`/Users/coolking70/Documents/同步空间/BrogueJS-p5/docs/ext/phase5g-dispatch.review-findings.md`（F1，P2）及 `/private/tmp/brogue-commander-20261007/package-extra.txt`。已读取全文，并只读核对实际 Game/worldHarness/RecordingFormat/RecordingV4 和 crafting trace helper 执行路径。

**F1 已修订，待指挥核对**：

- §8.1 删除当前执行说明中的“命令后 pending 循环可直接补答”方案，统一采用同步回调。每条命令重新取得当前 Game，在非回放、无待决命令的活局保存原两个确认回调，临时设 `onCommandConfirmRequest = null`，安装本条 `onConfirmRequest = () => answers[cursor++] ?? true`，执行公开 `h.command` 后在 `finally` 恢复两个回调。不会沿用上一条 `h.ext()` 遗留答案；命令后明确断言没有 pending。历史 A.2#19 不改，由当前 §8.1 明示补正。
- T-EAT、T-TRACE、§8.3 明确 No/Yes 两次各新增恰好一条事件、同步回调各调用一次。首次真实事件 `decisions` 严格为 `[false]`，背包/营养/currentTick/absoluteTurnNumber 不变，零成本；其次严格为 `[true]`，菌数量减少 1、eaten 计数增加 1、时间与回合推进。导出后按事件索引再次核对答案，不能只验证 trace 的 answers 输入。
- 与实际 recording v4 形状对齐：`RecordingEventV4.decisions: boolean[]`（RecordingV4.ts），`Game.recordInputEvent` 存储传入的布尔数组；RecordingFormat 校验数组的每项为 boolean。文档使用 `events[i].decisions` / `game.recordedInputEvents[beforeIndex].decisions`，没有新增 recording 字段，也没有把答案写成对象数组。No 会记录事件，因此不要求整份含录像来源的存档字节不变。
- 依据 Game.advanceCommand/confirmationDecision 的源码分支，默认无挂起回调时确认同步执行；未设同步回调时默认 true。此次修订采用审查推荐的同步路径，不保留挂起实现，不修改 Game、harness、crafting helper 或 SDK。这是源码与文档核对，没有做新游戏动态复现。

**指挥署名补充已完成**：§0 交付句和 §10.3 均要求每个 dot 提交信息末尾保留 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`，与交接单 §1 一致。仅记录未来 dot 提交要求，本进程未 commit/push。

### 本次实际检查

| 命令 | 退出码 | wall 秒 |
| --- | ---: | ---: |
| `python3 /private/tmp/brogue-commander-20261007/package-evidence/check.py` | 0 | 0.245 |
| `git diff --check 5e9753030696d2e8ea177c27007c2f15253d3eba` | 0 | 0.01 |
| `git diff --name-only 5e9753030696d2e8ea177c27007c2f15253d3eba` | 0 | 0.009 |
| `git diff --numstat` | 0 | 0.009 |
| `git status --short` | 0 | 0.012 |

另以临时 Python 文档检查断言本次增量仅限 §0 交付句、§8 确认/trace 与 §10.3 署名；两处署名完全相同，当前规范无 `resolveCommandDecision` 循环，同步回调在 finally 恢复，精确 `[false]`/`[true]` 及 boolean[] 形状说明齐全。全部断言通过，摘要在 `f1-document-check.log`，本次增量 diff 在 `f1-diff.patch`；命令结果与耗时在 `f1-results.json`。

重新运行原静态 `check.py` 全部通过（结果 `f1-check.log`）：权威 JSON/locale 与 34bb6c7 逐字相同，200 locale/35 禁用词零命中；9 个冻结文件、fixture 树、模块/格式版本及边界脚本未变；历史 A.2–A.4 整段逐字相同；无 CRLF。HEAD 和分支未变、无未跟踪仓库文件，相对 HEAD 仅任务包，相对代码基线仍仅任务包与边界脚本两文件。

最终任务包 SHA-256：`d407c169fa17488c5fcfbd702efa31ecad9fcec6f0ebbe26c1ef2ace425eedd3`。首轮边界检查结果仍为历史证据；此次只跑文档/字节/范围检查，没有重复 boundary、类型、构建或任何游戏门禁。停止供指挥核对，不提交推送。
