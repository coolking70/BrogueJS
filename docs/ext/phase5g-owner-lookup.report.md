# 5G 前置修复：世界定义包 owner 查询报告

## 范围与结论

最终相关 15 文件 / 242 项测试、boundary、vue-tsc、build 全部通过；空 items 的合法采食包存读档/录像与 worldWork 投影阻断已修复。

在 `ext/phase5`、起点 `3134f1df9b581e2bec9da78e647345bb7b58b144` 执行维护者授权的 owner 修复。审阅了 `/private/tmp/p5g-owner-lookup.patch`，采用等效的内部共享 helper，统一终端票据、work facts、活跃票据与只读 SDK 的查询。没有 commit/push、改分支或操作其他工作树；本报告是执行报告，独立审查由指挥另行安排。

原实现用 `pack.items.some(owner)` 判断包归属，但合法 fgfixture 的 `items=[]`，节点产物由 `edibleItems` 定义。采集完成后的终端票据因此报 `C5_BAD_REFERENCE: terminal definition`，独立保留的 work facts 报 `C5_BAD_REFERENCE: workFact`；模块投影拿不到 `context.worldWork`。

修改文件：

- `src/engine/Core/WorldWorkOwner.ts`：内部纯查询，检查 items/resourceNodes/stations/recipes/edibleItems 的定义 owner；不修改或替代包校验。
- `src/engine/Core/WorldWorkValidation.ts`：终端票据、facts 两处、活跃票据使用同一查询。具体 definitionId、owner、操作类型与引用闭包断言保留。
- `src/engine/Core/WorldWorkWorld.ts`：只读 worldWork SDK 使用同一查询。
- `src/test/ext_world_work_sdk_contract.test.ts`、`src/test/ext_edible_runtime.test.ts`：扩展原有测试，新增 14 项；两个文件已在既有清单中，无需新增清单项。
- 本报告。任务书在开工时已是未跟踪文件，本次未修改。

没有改冻结 SDK、格式/模块版本、Game 字段、生成/地形、随机数调用、i18n 修复或 5G 任务包；没有安装生产 foraging。

## 当前合同与同类查询核对

`WorldDefinitions.ts` 的执行路径允许四个基础列表为空；节点 yield 可引用 edibleItems，所以空 items 的采食包合法。它仍要求 station 的非空 placementCost 引用本包 material/kit，recipe 的非空 inputs/outputs 引用本包 items。因此“stations/recipes 各自带 owner 且 items 为空”可以做查询单元测试，但不是当前能注册的合法内容包。本次不通过伪造跨 owner 定义或放宽 amounts 校验制造合法性。

查询单测使用原 fixture 定义切片、保留原 owner，逐一证明五个列表的 owner 可识别，缺失 owner 返回 undefined；同时断言不满足产物/成本引用的 resourceNodes/stations/recipes 切片仍被 `assertWorldDefinitionPack` 拒绝。合法 resourceNodes + edibleItems 和仅 edibleItems 的行为另由真实 Game 验证。

同类检查结果（原始搜索见 `owner-audit.log`）：

- 活跃票据已检查四类工作定义，本次同步 helper；仅有 edibleItems 不会因此通过不存在的 harvest/craft/station 定义校验。
- `worldPack` 已含 edibleItems/resourceNodes/stations/recipes 以及 actorNeeds/structures/restPoints，无遗漏，保持原语义。
- `enterWorldWorkLevel` 首段按四类基础定义选 owner，处理节点/待放置节点；仅 edibleItems 没有这些节点，无须改生成。派生节点独立走 `placeResourceGroups`。
- startup 段已含 edibleItems 回退；合法 startupItems 当前仍必须引用 items，不改变这条合同。普通 itemDefinition/native item 查询不是包 owner 查询。

## 回归与单变量反事实

新增 14 项包括：

1. 五列表逐项查询、未知 owner 拒绝；空 items 包中的 resourceNodes/edibleItems 外来 owner 或非法 id 仍拒绝（7 项）。
2. fgfixture 经公开 `ext:command` 放置中性节点并采集，明确断言产物、完成终端票据、accepted/completed facts；保存/载入、逐条 replay、seek 到采集前再单步、seek 到末尾、存档续录后的完整 digest、票据、facts 和投影一致（1 项）。无生产 foraging 内容。
3. 仅 edibleItems 的真实注册包能经 `readModuleView` 获得 worldWork；不存在 owner 仍无 SDK/投影；读取不改存档或 RNG（1 项）。
4. 对采集后的终端票据/facts 分别注入非法 owner/definition，仍拒绝；facts 校验前移除终端票据，隔离两条校验路径（4 项）。
5. 终端票据离开有界 ledger 后，独立保留的合法 facts 仍可校验/保存（1 项）。

反事实只把 `WorldWorkValidation.ts` 和 `WorldWorkWorld.ts` 换为 HEAD 原字节；新增 helper 留在磁盘但旧生产代码没有引用。测试文件不变，运行同一两个测试文件：**exit 1，52 passed / 11 failed**。失败包含四个非 items 查询、仅 edibleItems 投影、合法终端票据误拒绝，以及独立 facts 的 `C5_BAD_REFERENCE: workFact`。随后 finally 恢复修复文件，`counterfactual-inputs.json` 记录测试前后 SHA 一致及 productionRestored=true。不是 import 缺失或夹具未注册导致的假失败。

没有修改旧测试前提、断言、超时或 skip；没有重录基线/黄金。首轮新测试有 3 项编写错误（59 passed）：2 项直接修改冻结 facts，1 项误要求导出录像末尾完整检查点/链摘要在续录后逐字相同。已改为克隆后注入损坏，并按导出合同比较全部命令字段与增量检查点，保留完整 replay 零 OOS 和终局 digest 校验。修正后两文件 62 项全过；再增加上述独立 facts 正向用例后，最终集合包含 63 项。

## 环境、门禁与原始证据

证据目录：`/private/tmp/brogue-commander-20261007/owner-evidence/`。每条命令的原始 stdout/stderr 为同名 `.log`，真实退出码和 wall 秒数为 `.json`；运行器为 `run.py`，反事实恢复脚本为 `counterfactual.py`。反事实外层脚本正常恢复后退出 0，**测试子命令真实退出码为 1**，以 `counterfactual.json` 为准。

统一环境：PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，实际 `node --version` 为 `v24.19.0`；`NODE_OPTIONS=--max-old-space-size=3072`；所有 vitest 命令均 `--maxWorkers=2`。

最终相关集合的真实命令：

```bash
npx vitest run src/test/ext_world_work_sdk_contract.test.ts src/test/ext_world_work_boundaries.test.ts src/test/ext_world_work_failures.test.ts src/test/ext_world_work_review.test.ts src/test/ext_world_work_transactions.test.ts src/test/ext_world_harness_closed_loop.test.ts src/test/ext_edible_runtime.test.ts src/test/ext_edible_review.test.ts src/ext/modules/crafting/tests/crafting_runtime.test.ts src/ext/modules/crafting/tests/crafting_persistence.test.ts src/ext/modules/crafting/tests/crafting_projection.test.ts src/ext/modules/crafting/tests/crafting_sdk_integration.test.ts src/ext/modules/crafting/tests/crafting_trace.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts --maxWorkers=2
```

反事实及两次开发期定向命令均为 `npx vitest run src/test/ext_world_work_sdk_contract.test.ts src/test/ext_edible_runtime.test.ts --maxWorkers=2`；首轮另在前面执行 `node --version &&`。最终相关集合包含非空 items 的真实 crafting runtime/persistence/projection/SDK integration/natural trace，覆盖其原有行为。

| 证据前缀 / 命令 | 退出码 | wall 秒 | 结果 |
| --- | ---: | ---: | --- |
| `focused` / 初次新回归（含 node --version） | 1 | 36.049 | 2 文件；59 passed / 3 failed（新测试编写错误） |
| `types` / npx vue-tsc -b（开发期） | 0 | 9.502 | 类型检查通过 |
| `focused-fixed` / 修正后的两文件定向回归 | 0 | 36.631 | 2 文件；62 passed |
| `counterfactual` / 旧生产代码 + 不变新测试 | 1 | 33.826 | 2 文件；52 passed / 11 failed（预期反事实） |
| `related` / 上列最终相关集合 | 0 | 198.624 | 15 文件；242 passed，0 failed / skipped / todo |
| `boundary` / node scripts/check-module-boundaries.mjs | 0 | 2.484 | 模块边界与测试归属通过 |
| `final-types` / npx vue-tsc -b（最终候选） | 0 | 10.353 | 类型检查通过 |
| `build` / npm run build | 0 | 18.085 | 类型检查 + Vite 构建通过 |


构建保留 Vite 的大 chunk 提示，没有改变门限。测试启动时提示未找到 CE 缓存；本步不拉取 CE，所选最终集合实际无 skipped/todo。

## 冻结 SHA 与最终输入

以下文件均与 HEAD **逐字节相等**，SHA-256 亦与 5A4 报告冻结表一致；逐项 head/candidate 值见 `frozen-sha.json`。

| 文件 | HEAD = 候选 SHA-256 |
| --- | --- |
| `src/ext/worldSdk.ts` | `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343` |
| `src/ext/edibleSdk.ts` | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` |
| `src/ext/worldEdible.ts` | `7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67` |
| `src/ext/kindKnowledge.ts` | `4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f` |
| `src/ext/actorNeeds.ts` | `8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e` |
| `src/ext/stats.ts` | `c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84` |
| `src/ext/testing/forageHarness.ts` | `ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38` |
| `src/ext/testing/fixtures/forageFixture/index.ts` | `adc02caaa085519c54a4c0c202ef9f06f1a2b818806bd6b819773f81a4b1abea` |

最终 `src/scripts/public` 输入共 1114 文件，按排序的 `relativePath + NUL + fileSHA256 + LF` 计算树 SHA-256：`d1a57bf1c25923f9d41fb7462c2e6f1f9f7d979e9d07d70f010fe1b86b602b79`。详见 `final-inputs.json`；交付前复核见 `final-integrity.json`。

## 未覆盖项、风险及待用户确认

- 没有改生成/地形，按任务书不运行 drift。完整 npm test、全部 test:ext、完整组合/物理删除矩阵留到 5Z；未执行浏览器验收或生产 foraging 集成，不能把中性 fixture 结果称作这些门禁通过。
- 仅 stations/recipes 且 items 为空的内容包仍被当前合同拒绝，这是保留的定义约束。查询 helper 只供可信引擎处理已校验包，不能用于绕过静态校验。
- 风险限于包查询由 items 扩至合法工作定义；原具体定义与引用闭包校验保留，相关负向回归与 crafting 回归验证该边界。
- 待用户确认：无。本步不处理交接单中的命名、nonEaters、5C/5D/5Z 或其他排期事项；等待指挥另起独立审查。
