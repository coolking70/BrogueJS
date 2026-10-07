# 5G 前置修复：世界定义包 owner 查询

角色：本地执行进程。工作树 `/Users/coolking70/Documents/同步空间/BrogueJS-p5`，分支 `ext/phase5`，起点 `3134f1d`。本任务经维护者授权；不要 commit、push、改分支或改其他工作树。先读 AGENTS.md、docs/HANDOFF.md、docs/development.md、docs/architecture.md、docs/ext/README.md、docs/ext/commander-handoff.md。

## 目标与范围

修复交接 §3 的派发阻断：世界包 items 为空、通过 resourceNodes/stations/recipes/edibleItems 定义 owner 时，采集后快照/录像校验失败，投影 context.worldWork 缺席。审阅 `/private/tmp/p5g-owner-lookup.patch` 后应用或等效最小改进；检查同类 owner 查询是否遗漏，但不要开展无关重构。以当前包校验合同为准，不靠任意伪造 owner 放宽校验。生产范围 WorldWorkValidation.ts、WorldWorkWorld.ts；如确有必要可新增内部共享 helper，不得改冻结 SDK 或格式/模块版本。

补有意义回归，至少涵盖：
- items 为空时，resourceNodes/stations/recipes/edibleItems 各自 owner 可识别，未知 owner 不可识别；不要只复制生产表达式自证。
- 真实公开命令采集完成后的终端票据、work facts：save/load、逐条 replay、seek/续录保持一致；复用 fgfixture/现有 harness，不在生产安装 foraging。
- 仅 edibleItems 的 owner 可得到 worldWork 投影；不存在 owner 仍无投影；无效 definition/owner 仍拒绝。
- 现有 crafting 非空 items 行为不回归。
优先扩展相关现有测试文件，若新增必须登记到所有必要测试清单，不得扩大不相关范围。不改 i18n 已验收修复，不修改 5G 任务包。

## 环境和门禁（覆盖旧文档 full 档）

PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；Node 24.19.0；NODE_OPTIONS=--max-old-space-size=3072；vitest --maxWorkers=2。
只跑相关测试、node scripts/check-module-boundaries.mjs、npx vue-tsc -b、npm run build。若实际改生成/地形再加 npm run test:drift。不跑完整 npm test、全部 test:ext、完整组合/删除矩阵；留到 5Z。不放宽断言、不加 skip、不拉长超时，旧前提修订先单变量反事实。新回归应证明旧生产代码失败，保存真实命令和输出到 `/private/tmp/brogue-commander-20261007/owner-evidence`。

## 交付

写 `docs/ext/phase5g-owner-lookup.report.md`：问题/根因/修改范围、回归与反事实证据、门禁真实命令退出码数量耗时、冻结 SDK SHA 对照、未覆盖项、待用户确认（若有）。任务书由指挥复制至 docs/ext/phase5g-owner-lookup.task.md。
完成后报告改动文件、验证结果、风险。你不做自称独立审查；指挥会另起审查进程，之后 resume 本会话处理发现。
