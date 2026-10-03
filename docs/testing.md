# 测试指南

## 1. 组织

- 测试框架 Vitest。测试文件在 `src/test/*.test.ts`（少数与模块同目录，如 `src/engine/UI/Discoveries.test.ts`）。
- 命名大致对应开发单元编号（`u_19e_…`、`x3_u4_…`、`x4_r6_…`），报告在 `docs/archive/dev-history/reports/` 中可按编号查到来龙去脉。
- `src/test/harness.ts`：`createHeadlessGame(seed, mode)` 等无渲染游戏构造工具，大部分引擎测试从这里起。
- `src/test/support/ceSource.ts`：CE 参照源码定位（`CE_ROOT`、`hasCeSource()`、`readCe()`）。
- `src/test/fixtures/`：夹具（CE 目录抽取、自然机关场景、生成基线、黄金 trace 等）。
- `scripts/test-suites.json`：全部测试文件的唯一归属清单。`test`（含强制 CE 的 `test:full`）、`gen`（重型生成普查）、`drift`（生成基线）三组互斥且覆盖全仓库；新增文件必须登记，`test_suite_membership.test.ts` 会检查遗漏、重复与实际配置的归属。
- `npm test` / `npm run test:full` 排除重型生成普查与生成基线；`npm run test:gen` 只跑普查，`npm run test:drift` 只跑基线。普查按实测耗时（通常单文件 ≥60 秒）和多种子、多层生成的执行成本入选，登记依据见 [分档调整报告](reports/chore-test-tiers.report.md)。直接 `npx vitest run <文件>` 保留定向入口，可跑普查文件中的局部回归或源码守卫。

## 2. 守卫类型

| 类型 | 例子 | 说明 |
|---|---|---|
| CE 对照（oracle） | 状态机 10240 组、护符曲线、选点候选 | 从 CE C 源码提取函数编译成参照，与 web 实现逐组合比对；需要 CE 参照源码 |
| 目录全集 | 地形/DF/光源/外观全表、物品种类数 | 新增目录项时会失败，提示你同步其它目录；历史计数变化需按前提修订流程处理 |
| 真实入口端到端 | 机关自然场景、血根草治疗、燃烧飞镖 | 用真实玩家命令从入口操作到结果；夹具固定种子与场景 |
| 生成合理性 | 连通性、机器不切断关卡、楼梯可达、落点可通行 | 多种子 × 多层扫描；**这是生成改动的底线，不可放宽** |
| 录像/回放 | u_27、x2a、x3b | 回放零 OOS、seek、显示帧不影响结果 |
| 读源码守卫 | c_4a（mechFlags 读者白名单）、p1_30（i18n）、u24（硬编码文本）、repo_hygiene（冲突标记、JSON 合法） | 扫描源码文件；新增合法读者按守卫注释"扩清单"并写 CE 依据 |
| 状态契约 | u_03 | `Game` 每个字段都必须在 `scripts/u03-state-contract.json` 登记生命周期 |

## 3. 生成基线与黄金 trace

- **生成基线**：`src/test/fixtures/generation_baseline.json`（D1–D26）与 `deep_generation_baseline.json`（D27–D40），四个种子逐层指纹；`npm run test:drift` 分别通过 `generation_baseline.test.ts` 和 `u_26a_deep_baseline.test.ts` 校验两份基线。
- **黄金 trace**：UR2（法器/反射等整局检查点）、UR3（生成与重访、存读档）、UR4（客观时间块：减速、加速、坠落、死亡），位于 `src/test/fixtures/traces/`（`u-r2-trace.json`、`u-r3-trace.json.gz`、`u-r4-trace.json.gz`）。

**重录流程**（任何导致它们变化的改动都要走）：

1. 单变量归因：只把本单元的生产文件回退到改动前（新增模块暂时移走），不动测试与夹具，旧基线/trace 应精确通过。
2. 恢复新代码，用原捕获方法重录：

```bash
UR2_CAPTURE=1 npx vitest run src/test/u_r2_trace.test.ts --maxWorkers=1
UR3_CAPTURE=1 npx vitest run src/test/u_r3_trace.test.ts --maxWorkers=1
UR4_CAPTURE=1 npx vitest run src/test/u_r4_trace.test.ts --maxWorkers=1
```

   生成基线的重录方法见 `generation_baseline.test.ts` 顶部说明。
3. 逐叶比较前后差异，确认每个变化字段都能归到本单元的规则改动，在报告中登记（变化字段数、原因、前后 SHA）。
4. 两个单元都重录了同一份 trace 并发合并时：以已合并一方为底，在合并后的代码上重录，确认新增差异正好是另一方登记的字段集合。

## 4. CE 参照源码与跳过

- 没有 `.ce-reference/`（或 `BROGUE_CE_DIR`）时，`npm test` 会跳过 CE 对照用例并打印提示；日常门禁用 `npm test` 即可；需要做 CE 一致性检查时（改动按 CE 对齐的规则、同步新版 CE、发版前）用 `npm run test:full`，它在缺少 CE 时直接失败，避免"跳过即绿"。
- `test:gen` 沿用同一 CE 检查；全量档用 `BROGUE_REQUIRE_CE=1 npm run test:gen`，缺参照即失败。`test:full` 本身只覆盖常规组，完整验收须加上强制 CE 的普查与 drift，档位见 [开发指南 §4](development.md#4-门禁分档)。
- 新写 CE 对照测试：用 `ceSource` 模块读取，并加 `skipIf(!hasCeSource())`。

## 5. 写新测试的要点

- 修 bug 先写能复现的失败用例，再修代码。
- 用真实入口（`executeCommand`、`handlePlayerAction`、生成入口）验证，别只测内部函数。
- 同时写"正例"和"不应发生"的反例（例如确认被拒绝时不耗回合、不改状态、不动随机数）。
- 纯显示改动要断言随机流状态不变。
- 夹具里的固定种子是布景，不是 CE 同种子对照（项目不追求逐骰一致）；生成变化导致布景失效时，按前提修订流程换种子或调整布景，保留全部行为断言。
