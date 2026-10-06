# 阶段 3 + 阶段 4 统一收尾门禁任务书

> 分支 `ext/phase4`（= ext/foundation `7f6de96`：阶段 3 的 3a0–3g 与阶段 4 的 4a–4f 第一部分全部合入；底座协议 foundation=5）。依据：`docs/ext/README.md` 当前门禁、`phase4-giants.md` r3 §14.1、`phase3-combat.md` §12、`phase3f.report.md` §“与4f共同收尾”、`phase4f.report.md` §7。
> 这是阶段 3/4 的**最终完整门禁**（区别于开发期功能测试政策）。浏览器全面验收由维护者另行执行。

## 0 冻结前核对（发现问题先修再冻结）
- 底座/各模块版本一致性（foundation=5，各模块 descriptor/rules/state 版本与报告一致）；可选 provider（`combat.part-break.v1`、`growth.combat-stats.v1`、`combat.event.v1` 等）注册唯一、重复注册拒绝；底座测试归属（删任一模块后底座 fixture 测试仍在）。
- 若需改动生产代码，按开发期政策修复并补相关测试，然后重新冻结。

## 1 正常树完整门禁（同一冻结候选，一次）
1. `node scripts/check-module-boundaries.mjs`
2. `npx vue-tsc -b`
3. `npm run build`
4. 全部 `npm run test:ext`
5. 完整 `npm test` 一次（仓库默认入口与清单，不拼接）
6. `node scripts/check-module-composition-smoke.mjs --engine-only`：全部已安装模块子集（combat/giants/growth/narrative → 16 种）真实 Game 新局/游玩/save-load/逐条 replay/seek/续录
7. `npm run test:drift`（含 giants 三份自然 trace 与普通生成基线）

## 2 物理删除矩阵（removal 档）
- `node scripts/check-module-removal.mjs --profile=removal --engine-only --maxWorkers=2 --output=<仓库外证据目录>`：发现器应得到 15 个实际删除行。每行：删除整个模块目录/数据/自有测试、清缓存，boundary/type/build/全部剩余 test:ext/全部剩余子集 smoke/缺模块旧档与录像拒绝。不重复完整 npm test。

## 3 失败处理
- 任何失败：先定位与归因（单变量反事实），属于真实缺陷则修生产代码并补回归；属于过时测试前提则在报告中给出旧前提、证据与最小化调整，不放宽有效断言、不加 skip、不延长超时掩盖性能问题（若确需调整超时，给出实测数据与理由）。修复后重新冻结并重跑受影响门禁；若修改影响面广，重跑完整第 1、2 节。
- 记录真实 skip/todo（历史既有 skip 列明来源）。

## 4 交付
- `docs/ext/closeout-3-4.report.md`：冻结候选 hash、每项实际命令/结果/数量/耗时/退出码、删除矩阵 15 行明细、失败与修复记录、已知限制清单（引用各阶段报告），以及“浏览器全面验收：待维护者执行”。
- 环境：Node 24.19.0（PATH 前置），`NODE_OPTIONS=--max-old-space-size=3072`，`--maxWorkers=2`。证据原始日志放仓库外。
- **不要 commit**。
