# BJS-1 验收与收尾手册（可由 codex 或人工执行）

> 背景：BJS-1（`docs/tasks/bjs-1-restructure.md`）由 codex 在工作树 `~/.codex/worktrees/04e4/BrogueJS` 执行（未提交）。主仓为 `~/Documents/同步空间/BrogueJS`（main 已含任务书 3b18cee 与说明文档 df42021）。本手册完成：审核 → 合并 → 门禁 → README → 推送。
> 执行者**不是**原执行方时也照此执行；是原执行方时，第 2 步的核对必须逐项给出命令输出，不能凭记忆声明。

## 1. 前提

- 执行方已结束（报告 `docs/archive/dev-history/bjs-1.report.md` 存在于工作树），并声明两种模式门禁全绿。
- 主仓 `git status` 干净。

## 2. 审核（逐项输出证据）

1. 读报告：两种门禁结果（无 CE：0 失败；有 CE：0 失败、0 因缺 CE 的 skip，通过数与重构前 4521 一致或逐项解释）。
2. 在工作树执行：
   - `git status --short | grep -v '^ D\|^D ' | head -50`：只应出现目录上移、`src/test/support/ceSource.ts`、`scripts/fetch-ce-reference.mjs`、globalSetup、测试路径/skip 改动、`package.json` 脚本、`.gitignore`、`docs/archive/**`。
   - **断言未改**：`git diff -U0 -- src | grep '^[-+].*expect(' | head -40`，新增/删除的 `expect(` 行只允许是路径参数变化；发现断言语义变化立即停止并在报告中说明。
   - **游戏逻辑未改**：`git diff --stat -- src/engine src/entities src/components src/ui src/data src/locales` 应仅为移动（重命名）且无内容改动（`git diff -M --stat` 的改动行数应为 0 或仅路径常量）。
   - 残留路径：`git grep -nE "BrogueCE-master|brogue-web/|ai_docs/" -- ':!docs/archive' ':!src/test/support/ceSource.ts' ':!scripts/fetch-ce-reference.mjs'` 应为空（或每条有合理说明）。
   - 无 CRLF、无 PNG、无 >1MB 新文件：`git diff --cached --numstat` / `find . -size +1M -not -path './node_modules/*' -not -path './.git/*' -not -path './.ce-reference/*'`。
3. `docs/` 下验收方的文档（`docs/*.md`、`AGENTS.md`、`CLAUDE.md`）不应被执行方修改（工作树基于 3b18cee，本就没有这些文件；合并时应无冲突）。

## 3. 合并

```bash
W=~/.codex/worktrees/04e4/BrogueJS
cd "$W" && git add -A && git diff --cached --binary HEAD > /tmp/bjs1.patch && git reset -q
cd ~/Documents/同步空间/BrogueJS && git apply -3 /tmp/bjs1.patch
git diff --name-only --diff-filter=U            # 必须为空
git grep -lE '^(<<<<<<<|>>>>>>>)' -- src scripts docs   # 必须为空
```

提交（显式说明）：`refactor(BJS-1): 独立项目布局——项目上移至仓库根，移除 CE 源码目录，CE 参照按需拉取（npm run ce:fetch），夹具迁入 src/test/fixtures，旧开发文档归档至 docs/archive`，结尾加一行 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。**先不要推送。**

## 4. 合并后门禁（在全新克隆中）

```bash
rm -rf /tmp/bjs-accept && git clone -q ~/Documents/同步空间/BrogueJS /tmp/bjs-accept && cd /tmp/bjs-accept
npm ci && npx vue-tsc -b && npm run build
npm test                 # 无 CE：必须 0 失败（CE 用例 skip）
npm run ce:fetch
npm run test:full        # 有 CE：必须 0 失败
npm run test:drift
```

超时的长测试（blueprint_center、b2_transcription、v_2b_7_features 等）按原门限单独复跑：`npx vitest run <文件> --maxWorkers=1 --no-file-parallelism`。任何非超时失败：停止，不推送，写明失败并交回。

## 5. README 与文档收尾

1. 重写根 `README.md` 为独立项目版本：去掉 `brogue-web/`、`BrogueCE-master/` 目录描述；运行步骤改为仓库根下 `npm ci` → `npm run ce:fetch`（可选，对照测试需要）→ `npm run dev`；指向 `docs/README.md` 与 `docs/HANDOFF.md`；保留许可与操作说明。
2. 核对 `docs/*.md` 中的路径与命令和实际一致（`npm run test:full`、`npm run ce:fetch` 参数、`src/test/support/ceSource.ts`、夹具实际位置、`docs/archive/dev-history/`、`docs/archive/dev-scripts/`）；不一致处按实际改文档。
3. `docs/HANDOFF.md` §2 追加："BJS-1 已完成（提交 <sha>）"。
4. 提交：`docs: 独立项目 README 与文档路径核对`。

## 6. 推送

确认第 4 步全部通过后，**单独**执行：

```bash
git push origin main
```

不打新标签（v0.2.0 保持指向初始提交）；如需标记，可打 `v0.2.1`（"独立项目布局"），并按 `docs/release.md` 建 Release。

## 7. 清理

`git worktree remove --force ~/.codex/worktrees/04e4/BrogueJS && git worktree prune`（在主仓执行）；删除 `/tmp/bjs1.patch`、`/tmp/bjs-accept`。
