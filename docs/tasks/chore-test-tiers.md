# 门禁分档调整：拆出重型生成普查测试，细分规则改动档位

> 分支：`chore/test-tiers`（工作区 `BrogueJS-newtheme`，基于 main `ff48147`）。用户已批准。

## 背景
完整 `npm test` / `test:full` 现在本地约 30–40 分钟、云端（2 worker）约 90 分钟。其中最重的是对 26 层地图/物品做多种子全量生成的普查测试（如 `blueprint_center` 45 种子×26 层、`w_5_arcana_instance` 12 种子×26 层、`b2_transcription`、`v_2b_7_features` 等），单项可达 10–15 分钟，CPU 争用时会撞 900 秒超时（最近一次：主机负载 12.67 时两项超时）。而只改战斗、物品效果等局部规则时，这些生成普查与改动无关；生成是否变化已由 `test:drift`（生成基线）兜底。

当前 `docs/development.md` §4 规定"规则、生成、随机数、存档"一律全量，偏保守。

## 要求

### 1. 拆分重型生成普查测试
- 实测（不要凭名字猜）找出"主要成本在多种子×多层完整生成"的测试文件：可对候选文件用 `vitest run --reporter=json` 或 verbose 计时测量单文件耗时；候选可从 grep `SCAN_SEEDS`、`D1..D26`、`× D1`、`seeds ×`、生成 census 等入手。阈值建议：单文件 ≥ 60 秒且主体为生成普查。在报告中列出每个文件的实测耗时与入选理由。
- 新增脚本 `npm run test:gen`：只跑这些普查文件（CE 相关的也应在 `BROGUE_REQUIRE_CE=1` 下可跑，若需要提供 `test:gen` 与 CE 要求的组合方式）。
- `npm test` 与 `npm run test:full` 排除这些文件（与已排除的 generation_baseline 同一机制）。用**单一清单文件**（例如 `scripts/test-suites.json` 或 vitest 配置中的共享常量）定义"普查文件列表"，脚本与配置都从这里读，不要在多处重复写文件名。
- 新增守卫测试：仓库中每个测试文件必须恰好属于 `test`（含 test:full）、`test:gen`、`test:drift` 之一，不能遗漏或重复；新增普查文件时必须登记清单。
- 不修改任何测试的断言、超时、种子集合或内容；只调整它们归属哪个命令。

### 2. 更新门禁分档（docs/development.md §4，AGENTS.md 相应一句）
建议的新分档（可按实测微调，并说明理由）：

| 档位 | 适用 | 内容 |
|---|---|---|
| 轻 | 纯前端（组件、样式、界面文案、只读显示） | `vue-tsc -b` + `build` + 相关前端测试 + 所有读源码守卫 |
| 中 | 引擎里不改规则的部分（消息、显示、日志、自动行动流程、输入） | 轻档 + 相关单测 + UR2/UR3/UR4 黄金 trace + 录像测试（u_27、x2a、x3b）+ U03 契约 + `test:drift` |
| 局部规则 | 只改战斗、物品效果、状态、AI 等局部规则，不改生成、随机数消耗次数/顺序、存档格式 | 中档 + 与改动相关的全部测试 + `test:full`（已不含普查）+ `test:drift` |
| 全量 | 改地图/物品/怪物生成、随机数消耗、存档/录像格式；同步新版 CE；合并扩展分支进 main；打版本标签前 | `vue-tsc -b` + `build` + `test:full` + `test:gen` + `test:drift` |

- 保留并更新现有说明：长普查测试 CPU 争用下的处理（单独复跑、不改超时）、跳过全量复跑的条件、读源码守卫轻/中档也必须跑。
- `docs/ext/README.md` 中的扩展开发门禁说明同步引用新分档（扩展各步：改了对齐 CE 的规则文件→局部规则档；改了生成/事务/存档→全量）。

### 3. 顺带修正
- `progress.md` 最新一条（屠戮符文修复）中"用户调整验收范围"实际是 Claude 调整的，改为"Claude 调整验收范围"。

## 验证
- `npx vue-tsc -b`、`npm run build`。
- 完整跑一次新的 `npm test`（不含普查）与一次 `npm run test:gen`，两者都通过，并记录各自耗时；`test:drift` 通过。
- 新守卫测试通过；并证明三个命令覆盖的文件并集 = 全部测试文件、交集为空。
- 不产生 CRLF；**不要 commit/push**。

## 输出
报告 `docs/reports/chore-test-tiers.report.md`：入选普查文件及实测耗时、新旧 `npm test` 耗时对比、分档表、改动文件；中文简报。
