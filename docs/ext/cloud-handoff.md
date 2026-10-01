# EXT-0 云端接续记录（阶段0最终门禁已完成）

当前状态：云端已在原ext/foundation基线上完成边界修复，四项完整门禁全部退出0，源码前后散列一致。完整npm test为262文件、4594通过/83跳过/5todo；drift为1/1通过。交付与命令原文见 [foundation.report.md](foundation.report.md)，最新证据见 [evidence/cloud-final/state.json](evidence/cloud-final/state.json)。停止在阶段0，等维护者审阅；本任务没有整合最新main ad3e902。

以下保留迁移时的WIP记录，仅作为历史，不是当前验收状态。

# EXT-0 云端接续：WIP，门禁未完成

用户要求开发/测试尽量迁至云端，避免与本机其他任务抢CPU。本地已停止本任务全部测试/构建进程，不再启动重型测试。只保存并推送 `ext/foundation`，未创建PR、合并/rebase、推main、打标签、改Pages或开始阶段1。

- 本地独立工作区：`/Users/coolking70/Documents/Codex/2026-10-02/task/BrogueJS`。
- 分支基线：main `3c1407fcb0b074a7b4dd4879d15eb7c0be346749`，是开始任务时最新main。
- 只读比较的最新main：`b0860eb27ed4a64bb822ad10876ade03a9861416`，保留刻符/glyph主题、显示模式/图例在设置中。没有把并行工作合入本分支。
- 当前迁移源SHA256：`934bb0f09b05b3bb246cc5a17d962fd0a91ad5e241835a19642f0d9ff6511814`（算法及门禁版本见 `evidence/state.json`；提交SHA由最终交接消息提供）。

已交付设计、扩展注册/生命周期/钩子/定义与组件底座、示例、模式选择、存档录像、17项新增测试。先读 [README.md](README.md)、两份references笔记、仓库AGENTS/HANDOFF/architecture/development/testing及 [architecture.md](architecture.md)。详细改动清单、已有原文与整合风险见 [foundation.report.md](foundation.report.md)。

## 已有证据与真实状态

| 门禁/检查 | 本地状态 |
|---|---|
| `npx vue-tsc -b` | 在源9a2519d上退出0，14.70s；两行最后修正未复验 |
| `npm run build` | 在同一源上退出0，20.33s；原分块警告保留；两行最后修正未复验 |
| 完整 `npm test` | 运行约84分钟后按用户要求中断；已报告旧近战文件3失败，无完整汇总，不能判通过 |
| `npm run test:drift` | 尚未启动，没有输出文件 |
| 定向检查 | 两行最后修正前，17项扩展测试通过；原U01/U03/i18n/hygiene等合计69项通过；三份原黄金trace等另一轮66项通过；均不能替代完整门禁 |
| 浏览器 | 桌面和手机尺寸模拟，自然21命令击杀、中文消息、存读档/录像/版本拒绝通过，控制台无错误；截图只留tmp，不提交；不是安卓实机验证 |

近战回归原因：旧测试将 `CombatSystem.attack` 取出作为普通函数调用；新增包装器用了 `this.resolveAttack`，破坏原调用兼容性。原main独立归档该文件24项通过。交接前已把两处引用改为 `CombatSystem.resolveAttack`，保留原解决函数与旧断言；该修正未在本地复验。云端应优先验证此问题，也可补扩展模式下的直接函数引用回归。

证据目录 `docs/ext/evidence/`：当前 `state.json`、`vue-tsc.txt`、`build.txt`、未完成 `npm-test.txt`、`migration-stop.json`、`melee-original-main.txt`、`browser-summary.json`、`classic-baseline-capture.txt`、`main-integration.json`；另有首轮边界修正、连接中断、录像输入边界修正时的明确中断档案。所有中断轮均未声称完整通过。

## 云端下一步

1. 在独立云端工作区检出远端 `ext/foundation`，核验最终交接消息中的WIP提交SHA；不接续本机其他工作区。依赖按仓库方式安装。
2. 优先运行旧 `src/test/p4_5_melee_specials.test.ts` 与新 `ext_foundation.test.ts` / `ext_validation.test.ts`，验证最后两行修正。遇到旧守卫修代码，不改旧断言或黄金/生成夹具。
3. 对最终稳定代码完整执行下列四项并保存原文，等待全部结束，不拼接本地中断结果：

```sh
npx vue-tsc -b
npm run build
npm test
npm run test:drift
```

可按云端资源设置 `NODE_OPTIONS` 和 `VITEST_MAX_WORKERS`；本机单worker的耗时不是云端并发建议。不要 `ce:fetch` / `test:full`，不查CE源；扩展所有改状态输入仍经原命令边界，随机走引擎流；新增Game字段登记u03，文本走i18n，LF，无截图。

4. 原门禁日志先归档，新的完整结果独立保存并注明对应源版本，更新交接报告。四项通过后再按用户原要求完成阶段0交付，仅提交推送此分支，核验远端SHA；不自行开始阶段1。

最新main的临时三方预览：App.vue/MainMenu.vue没有文本冲突，zh_CN.json与progress.md各1处。后续由维护者在单独集成分支保留main的glyph/设置/沉浸界面及旧主题资源删除，追加规则选择和12条ext词条；整合后重跑门禁与桌面/手机界面验证。此任务不执行整合。
