# EXT-0 扩展底座 WIP / 云端迁移交接报告

状态：**阶段0实现WIP，门禁未完成，不代表验收通过。** 用户要求后续开发/测试尽量在云端，本地重型测试已停止。

任务范围：仅阶段 0。基线 main `3c1407fcb0b074a7b4dd4879d15eb7c0be346749`；本任务独立克隆 `/Users/coolking70/Documents/Codex/2026-10-02/task/BrogueJS`，工作/提交/推送分支 `ext/foundation`。其他本地工作区未使用。未推 main、合并、打标签、创建 PR、修改 Pages 工作流或开始阶段 1。

## 交付与架构决定

完整设计见 [architecture.md](architecture.md)：注册/依赖排序、固定启用集合、生命周期、准确钩子位置/时机/读写/RNG合同、原创 JSON 定义+TS类型+校验、通用生物组件、独立存档区块/u03契约、录像版本与集合校验、后续阶段风险。

- 核心在 `src/ext/`。经典默认空运行时，不调用模块或改变原存档/录像投影；所有新增引擎代码为模式/钩子接线及存档录像包络接入，原战斗解决函数保持原代码。
- 模块只有自己的 JSON 状态/生物组件可写。钩子是冻结 DTO，所有随机来自原实质流；命令通过原 `executeCommand`，物品仍通过 `executeItemCommand`。读取、保存、卸载、显示没有规则随机调用。
- 示例 example 1.0.0 显示本地化死亡消息、累积非行政怪物死亡数，并走存档/读档/录像/seek/续录；不实现经验/成长。数据包的职业、技能、NPC、对话、敌人模板只是底座格式例子，不生成新内容。
- 新增 Game 字段 `extensionRuntime` 已登记 u03；Creature 回调用 WeakMap 访问器，原实体字段/codec 守卫未改。旧测试/断言、两份生成基线、三份黄金 trace 均未修改。

## 验证证据

阶段0新增17项测试（ext_foundation 13 + ext_validation 4），覆盖注册表/生命周期/排序/严格JSON/组件校验、生成和物品钩子、状态往返、录像集合版本拒绝、示例自然击杀与续录/seek/OOS、随机接入和经典零调用守卫。经典 RNG 夹具来自未改 main 的独立 `/tmp/bjs-ext-baseline` 归档，记录原 seed4101 的开局/真实攻击/等待双流完整tuple，捕获命令原文：[classic-baseline-capture.txt](evidence/classic-baseline-capture.txt)。没有从扩展实现计算期望来冒充旧基线。

最后两行兼容性修正前，定向7文件69项通过；另外原三份黄金trace等9文件66项已通过。这些定向结果不替代完整门禁。

浏览器使用技能标准客户端与补充Playwright集成脚本：1440×1000桌面、390×844手机模拟，新局默认经典/选择扩展成功，seed1141巫师局21条自然命令产生一次击杀；中文扩展消息可见，存读档、完整来源、回放及版本不匹配拒绝通过，pageerror/console.error均为空。摘要：[browser-summary.json](evidence/browser-summary.json)。截图已实际查看，仅在 `/tmp/bjs-ext-browser`，不提交。手机为尺寸模拟，安卓实机未测。

## 门禁状态与已有原文（未验收）

中断轮执行原命令，使用环境 `NODE_OPTIONS=--max-old-space-size=4096`、`VITEST_MAX_WORKERS=1` 限制本机资源；未改变测试集合、原超时、断言或生成夹具。没有 CE 源码，CE 对照测试按仓库既定逻辑显式跳过；没有运行 ce:fetch / test:full。

类型检查与构建在源SHA256 `9a2519d9295e7214458835645de11a1b83eeb348742c35731b70c10979cc6439` 上退出0。完整npm test运行约84分钟后按用户云端迁移要求中断；已报告近战特殊效果文件3项失败，无全套汇总；drift尚未启动。随后只修正两行调用兼容性，未启动任何新本地测试，因此当前WIP代码的四项最终门禁均需在云端重新执行。已有原文保存如下，成功的类型检查本身没有stdout：

| 命令 | 原文输出 | 退出码 / 时长 |
|---|---|---|
| `npx vue-tsc -b` | [vue-tsc.txt](evidence/vue-tsc.txt) | 0 / 14.70s |
| `npm run build` | [build.txt](evidence/build.txt) | 0 / 20.33s |
| `npm test` | [npm-test.txt](evidence/npm-test.txt) | 用户要求中断 / 已报告3失败 / 无最终退出汇总 |
| `npm run test:drift` | 未启动，无输出文件 | 未执行 |

`npx vue-tsc -b` 原文 stdout/stderr 为空，退出码0（由 runner 记录）。`npm run build` 原文：

```text

> brogue-web@0.2.0 build
> vue-tsc -b && vite build

vite v7.3.1 building client environment for production...
transforming...
✓ 948 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                 0.62 kB │ gzip:   0.46 kB
dist/assets/index-BaG6iM1Q.css                 81.52 kB │ gzip:  16.34 kB
dist/assets/Filter-DEcJIhA5.js                  0.90 kB │ gzip:   0.48 kB
dist/assets/BufferResource-LIqL-N2k.js         10.60 kB │ gzip:   2.79 kB
dist/assets/webworkerAll-BDXa-Fn3.js           11.88 kB │ gzip:   3.94 kB
dist/assets/CanvasRenderer-NboqOas5.js         22.67 kB │ gzip:   7.09 kB
dist/assets/WebGPURenderer-BF54IZT_.js         38.19 kB │ gzip:  10.65 kB
dist/assets/browserAll-Cop1fkMg.js             41.30 kB │ gzip:  10.83 kB
dist/assets/RenderTargetSystem-_jBQoQs5.js     45.60 kB │ gzip:  12.57 kB
dist/assets/WebGLRenderer-CBV22ufW.js          68.42 kB │ gzip:  18.71 kB
dist/assets/index-B0eYRljS.js               1,605.30 kB │ gzip: 471.52 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 5.46s
```

命令、环境、已完成退出码、开始/中断时间及迁移前后源文件SHA256：[state.json](evidence/state.json)。构建的 >500kB 分块提示保留在原文，未据此改打包或工作流。

首轮在完整npm test尚未结束时主动停止，原因是复核发现稀疏数组/非法状态容器及异步load/unload边界缺口；未声称该轮完整通过。先新增边界回归复现3红1绿，再改底座代码使其4项通过，未改任何旧测试。原首轮输出及终止记录：[initial-interrupted/state.json](evidence/initial-interrupted/state.json)，[先红原文](evidence/initial-interrupted/validation-red.txt)。修正后的第二轮因 exec-server 连接中断而消失，恢复后只读确认本任务进程不在运行，原日志尚无完整结果；保留 [连接中断记录](evidence/transport-interrupted/state.json)。为避免与其他工作区运行中的测试争用，以单worker启动完整最终复验，独立会话/日志使执行不依赖交互连接。仅以最后完整一轮为最终验收，不拼接定向结果。 随后复核录像拒绝路径发现 malformed events 可能触发新增提示分支的 TypeError；先红回归准确复现，补 Array.isArray 守卫后17项扩展测试通过，再重启完整四项门禁。此前未完成的单worker轮次保留于 [录像边界修正记录](evidence/recording-boundary-interrupted/state.json)、[先红原文](evidence/recording-boundary-interrupted/regression-red.txt)，同样不计完整通过。

## 用户要求的云端迁移 / 剩余验证

2026-10-01T18:53:19Z 按用户要求停止本任务runner PID91203及其测试子进程，避免占用本机CPU；先冻结runner，再只终止所属进程树，恢复后确认本任务测试/构建进程为空。未影响其他工作区。停止证据：[migration-stop.json](evidence/migration-stop.json)。没有启动drift或新的本地重型测试。

中断前旧 `p4_5_melee_specials.test.ts` 报告3项失败。原main独立归档同文件24项通过，原文：[melee-original-main.txt](evidence/melee-original-main.txt)。定位为新增attack包装器引入了 `this.resolveAttack` 依赖，而旧API及测试允许 `const attack = CombatSystem.attack; attack(...)` 的直接函数调用。交接前已仅将两处引用改为 `CombatSystem.resolveAttack`，不改原战斗解决函数或任何旧断言；**这两行修正尚未复验**。当前迁移源SHA256为 `934bb0f09b05b3bb246cc5a17d962fd0a91ad5e241835a19642f0d9ff6511814`，不是前面已跑类型检查/构建的源版本。

云端接续入口见 [cloud-handoff.md](cloud-handoff.md)：检出远端ext/foundation，确认WIP SHA，然后先验证旧24项近战守卫及17项扩展测试；如失败修代码，旧断言不改。对最终稳定代码执行 `npx vue-tsc -b`、`npm run build`、完整 `npm test`、`npm run test:drift`，保存新一轮完整原文/退出码，不以本地定向或中断日志代替。可按云端资源选worker数，不能改变测试集合或原超时。通过后再更新报告并仅推送ext/foundation；不创建PR，不合并/rebase/main/标签/Pages，不进入阶段1。

## 最新 main 的整合影响（只读比较）

阶段0开始时的正确基线仍是 `3c1407f`。执行期间远端 main 合入 DESIGN-2/3/3b，已只读 fetch 核验最新 SHA 为 `b0860eb27ed4a64bb822ad10876ade03a9861416`。没有合并、rebase、切换工作树或覆盖并行工作；本报告已有测试针对 `3c1407f + EXT-0` 的相应源版本，完整门禁未完成，**不代表当前WIP或与b0860eb整合后的代码已通过验收**。

使用 `git merge-file -p` 对当前改动、3c基线、b086最新main的临时副本做三方预览；该命令只输出预览，不写仓库。证据：[main-integration.json](evidence/main-integration.json)。重叠文件如下：

| 文件 | 文本冲突预览 | 整合建议 / 语义影响 |
|---|---|---|
| `src/App.vue` | 0处 | 主线修改主题HUD、沉浸布局/快捷键；本分支仅追加 ruleSet 参数及转交 startNewGame，两组变更位置不重叠。保留主线布局，接入规则参数 |
| `src/components/MainMenu.vue` | 0处 | 主线统一刻符/glyph标题、移除三主题选择、把地图显示与图例迁入设置；本分支添加独立的开局规则选择。保留glyph、设置和沉浸选项，在新局页追加“经典 CE / 扩展模式”，不要恢复旧主题实验界面。玩法ruleSet与显示模式/沉浸模式分开 |
| `src/locales/zh_CN.json` | 1处 | 两侧均改文件尾；保留主线新的 title/map/theme/menu.display 等词条及旧 lab.* 删除，再追加本分支12条 ext.*，保留正确逗号、无重名键、LF。不能用任一侧整文件覆盖 |
| `progress.md` | 1处 | 双方追加历史进展，按各自时间/任务保留，避免覆盖记录 |

主线保留四种地图显示方式（原版/精修ASCII/全汉字/简约图块），现在在设置页；“仅glyph界面”指界面主题，不是只剩一种地图表示。阶段4设计里的四种地图渲染风险仍适用。引擎钩子、扩展核心、新测试和u03契约未与这些并行改动重叠。

建议维护者在最新main的独立集成分支应用本分支提交，人工解决上述JSON/进展冲突，保留主线对旧主题资源的删除；随后重跑四项门禁与主线新增主题/沉浸测试，并复验桌面/手机的新局规则选择、设置/图例、沉浸切换及扩展消息/存档/录像。文本自动合并成功不等于界面整合通过，新增开局字段也应检查小屏滚动与布局。本任务保持ext/foundation原基线，交接后停止。

文件卫生核验：旧测试/工作流未改，所有改动LF，无截图或超过1MB的新证据。源码/文档（不含证据原文）的 `git diff --cached --check` 退出0；全范围检查仅提示7份原文日志末尾终端输出的空白行，保留原文，不据此修改测试。

## 改动文件清单

- `docs/ext/architecture.md`
- `docs/ext/cloud-handoff.md`
- `docs/ext/evidence/browser-summary.json`
- `docs/ext/evidence/build.txt`
- `docs/ext/evidence/classic-baseline-capture.txt`
- `docs/ext/evidence/initial-interrupted/build.txt`
- `docs/ext/evidence/initial-interrupted/npm-test.txt`
- `docs/ext/evidence/initial-interrupted/state.json`
- `docs/ext/evidence/initial-interrupted/validation-red.txt`
- `docs/ext/evidence/initial-interrupted/vue-tsc.txt`
- `docs/ext/evidence/main-integration.json`
- `docs/ext/evidence/melee-original-main.txt`
- `docs/ext/evidence/migration-stop.json`
- `docs/ext/evidence/npm-test.txt`
- `docs/ext/evidence/recording-boundary-interrupted/build.txt`
- `docs/ext/evidence/recording-boundary-interrupted/npm-test.txt`
- `docs/ext/evidence/recording-boundary-interrupted/regression-red.txt`
- `docs/ext/evidence/recording-boundary-interrupted/state.json`
- `docs/ext/evidence/recording-boundary-interrupted/vue-tsc.txt`
- `docs/ext/evidence/state.json`
- `docs/ext/evidence/transport-interrupted/build.txt`
- `docs/ext/evidence/transport-interrupted/npm-test.txt`
- `docs/ext/evidence/transport-interrupted/state.json`
- `docs/ext/evidence/transport-interrupted/vue-tsc.txt`
- `docs/ext/evidence/vue-tsc.txt`
- `docs/ext/foundation.report.md`
- `progress.md`
- `scripts/u03-state-contract.json`
- `src/App.vue`
- `src/components/MainMenu.vue`
- `src/engine/Combat/Combat.ts`
- `src/engine/Core/Game.ts`
- `src/engine/Core/MonsterLifecycle.ts`
- `src/engine/Core/WholeRunSnapshot.ts`
- `src/entities/Creature.ts`
- `src/entities/Player.ts`
- `src/ext/catalog.ts`
- `src/ext/definitions.ts`
- `src/ext/json.ts`
- `src/ext/modules/example/definitions.json`
- `src/ext/modules/example/index.ts`
- `src/ext/modules/example/text.ts`
- `src/ext/registry.ts`
- `src/ext/runtime.ts`
- `src/ext/types.ts`
- `src/locales/zh_CN.json`
- `src/test/ext_foundation.test.ts`
- `src/test/ext_validation.test.ts`
- `src/test/fixtures/ext-classic-rng.json`

## 后续建议与风险

继续顺序为阶段1成长 → 2叙事 → 3预警/多回合攻击，再体力/韧性/弹反 → 4独立2×2场地，再3×3 → 5世界图设计和原型。每阶段先审设计及确定性合同，再实施并交接。

阶段1先明确击杀归属/环境和持续伤害来源、生成事务提交/回滚与死亡组件回收；只读attack钩子不能替代规则策略接口。阶段3需要AI行动选择/耗时/取消端口。阶段4必须统一占位表、体型寻路/缓存、视野、鼠标与AOE去重、四种地图渲染/记忆、Boss净空与跨层落点；不应直接把footprint元数据映射成放大字形。阶段5再设计独立世界时钟/随机域与上下层结算守恒。详细风险在设计§8。

每命令完整扩展checkpoint会随成长状态变大而增加录像体积，后续要测量再改摘要/周期快照；本阶段没有做旧档迁移或模块热切换。示例的kill统计是生命周期死亡数，sourceId仅attack栈内可信，不能直接当玩家XP归属。

本地迁移交接后停止。阶段0验收仍待云端接续，不进入阶段1。
