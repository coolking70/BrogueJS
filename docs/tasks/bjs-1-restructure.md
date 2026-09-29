# BJS-1：独立项目重构（去除 BrogueCE-master 目录、归档旧开发文档、测试夹具迁移、CE 参照按需拉取）

> 本地执行（Mac，codex xhigh）。仓库：`BrogueJS`（本工作区）。门禁：全量（两种模式，见 §3）。
> **`docs/` 下除 `docs/archive/` 与本 `docs/tasks/` 外的文件由验收方并行编写，本单元不得创建或修改它们**（`docs/README.md`、`docs/*.md` 等）。

## 0. 目标布局

```
/                      ← 原 brogue-web/ 的内容整体上移到仓库根（package.json、src/、public/、index.html、各配置）
/src/test/fixtures/    ← 迁入测试实际读取的原 ai_docs 文件（黄金 trace、夹具、被测试解析的规格数据等），按用途分子目录
/scripts/              ← 只保留被 package.json、测试、门禁实际引用/导入的脚本与数据（如 u03-state-contract.json 及其消费者），外加新增的 CE 参照拉取脚本
/docs/archive/dev-history/   ← 原 ai_docs 下全部 .md（根部 md、reports/*.md、tasks/*.md）与 progress.md，保持原相对结构；顶部加一份 INDEX.md（按阶段列出目录与一句话说明）
/docs/archive/dev-scripts/   ← 未被引用的历史开发/验收脚本（原样归档，不要求可运行；INDEX.md 说明它们依赖已不存在的证据目录）
/.ce-reference/        ← gitignore；由 `npm run ce:fetch` 拉取 CE 参照源码到 .ce-reference/BrogueCE-master/src
```
删除 `BrogueCE-master/` 与空的 `brogue-web/`。根 `README.md` 暂保留（验收方稍后重写），但更新其中目录表以免失真。`LICENSE`（AGPL-3.0）保留。

## 1. CE 参照源码

- 新增 `scripts/fetch-ce-reference.mjs`（Node，无额外依赖），`package.json` 增加 `"ce:fetch"`：
  - 默认 `--source legacy`：从 `https://github.com/coolking70/BrogueCE-chs.git` 固定提交 `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9` 浅拉取并稀疏检出 `BrogueCE-master/src` 与 `BrogueCE-master/LICENSE.txt`，放到 `.ce-reference/BrogueCE-master/`（测试按此版本编写，含早期中文化改动与引用行号）。
  - `--source upstream [--ref <tag|sha>]`：从 `https://github.com/tmewett/BrogueCE.git` 拉取，放到同一位置；打印警告：测试按 legacy 版本校准，upstream 可能导致对照测试失败。
  - 已存在时校验来源与提交，`--force` 重拉；写入 `.ce-reference/SOURCE.json`（source、repo、commit、时间）。
- 新增测试支持模块 `src/test/support/ceSource.ts`：`CE_ROOT`（`process.env.BROGUE_CE_DIR` 优先，否则仓库根下 `.ce-reference/BrogueCE-master`）、`hasCeSource()`、`ceFile(rel)`、`readCe(rel)`。
- 全部读取 CE 源码的测试（约 72 个文件、197 处，路径形态包括 `'../BrogueCE-master/…'`、`'BrogueCE-master'`、`'../../../BrogueCE-master/…'` 等）改为经该模块解析；依赖 CE 源码的用例/describe 在缺少 CE 时 **显式跳过**（`describe.skipIf`/`it.skipIf`，说明文字统一为 "CE reference source not found; run npm run ce:fetch"），**不得改动任何断言**。只有部分用例依赖 CE 的文件，只跳过那部分。
- 新增 vitest globalSetup（或等效）：缺少 CE 时打印一次醒目提示；环境变量 `BROGUE_REQUIRE_CE=1` 时缺少 CE 直接失败。`package.json` 增加 `"test:full": "BROGUE_REQUIRE_CE=1 vitest run --exclude '**/generation_baseline.test.ts'"`（或等效跨平台写法），`npm test` 保持原语义。

## 2. 夹具与脚本

- 找出测试（`src/**`）实际读取的全部原 `ai_docs/**` 路径（含动态拼接），迁入 `src/test/fixtures/`，更新引用；读取报告 markdown 以取规格数据的测试，把所需数据迁为夹具，或改读 `docs/archive/dev-history/` 中对应文件（二选一并在报告说明）。
- 黄金 trace 捕获（`UR2_CAPTURE` 等）写回新夹具位置；生成基线 `generation_baseline.json` 等位置按需调整。
- `scripts/` 中被测试/门禁引用的保留并修正其内部路径；其余移入 `docs/archive/dev-scripts/`。
- 全仓库扫描：除 `docs/archive/**` 外，不得残留 `BrogueCE-master`（经 ceSource 模块的除外）、`brogue-web/`、`ai_docs/` 路径引用；源码守卫（repo_hygiene、p1_30、u24、c_4a 等）中写死的目录路径同步修正（只修路径前提，不改断言语义）。
- `.gitignore`：`node_modules/ dist/ output/ .ce-reference/ *.log`、本地验收证据 `docs/archive/**/*-evidence/*.png` 等。

## 3. 门禁（全量，两种模式都要跑）

在全新克隆副本中（不要复用本工作区 node_modules）：
1. `npm ci`；`npx vue-tsc -b`；`npm run build`。
2. **无 CE 模式**：不拉取 CE，`npm test` 完整跑完——必须 0 失败，CE 依赖用例为 skip；报告列出 skip 数与文件数。
3. **有 CE 模式**：`npm run ce:fetch`（legacy），`npm run test:full` 完整跑完——必须 0 失败、0 因缺 CE 的 skip，通过数应与重构前（240 文件、4521 通过、8 skip、5 todo）一致或逐项解释差异；`npm run test:drift` 通过。
4. 长测试若超时，按原门限单独复跑并说明。

## 4. 约束与报告

- 不改任何游戏逻辑与测试断言；只动路径、跳过条件、夹具位置、脚本与文档归档。不产生 CRLF。
- 报告写到 `docs/archive/dev-history/bjs-1.report.md`（归档区之外不写报告）：迁移清单（文件数/字节）、CE 依赖测试清单与跳过策略、两种模式门禁结果、残留路径扫描结果。不要提交、不要推送。
