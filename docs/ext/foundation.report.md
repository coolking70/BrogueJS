# EXT-0 扩展底座阶段 0 交付报告

状态：**阶段 0 实现及云端最终四项门禁全部通过，停止在阶段 0，交由维护者审阅。** 本报告保留本地迁移前的中断/失败历史，不把定向检查或历史输出拼成最终通过。

任务范围：仅阶段 0。基线 main `3c1407fcb0b074a7b4dd4879d15eb7c0be346749`；本任务独立克隆 `/Users/coolking70/Documents/Codex/2026-10-02/task/BrogueJS`，工作/提交/推送分支 `ext/foundation`。云端从交接提交 `ed8d270db76e0960a2ec419cae06c3a9c0a1d2da` 接续，独立目录 `/workspace/scratch/db2caf941a8f/BrogueJS-cloud-ext`；没有继续使用用户的 Mac。其他本地工作区未使用。发布目标仅为 `ext/foundation`，未推 main、合并/rebase、打标签、创建 PR、修改 Pages 工作流或开始阶段 1。

## 云端最终验收（2026-10-01 UTC）

冻结版本为交接提交加本轮边界修复/6项新增测试。生产、测试、脚本、资源及构建配置的路径→文件散列清单见 [cloud-final/state.json](evidence/cloud-final/state.json)，整体SHA256为 `7b653cc1288d62b11c350e9238451373fb7861ea7e1859e56b33b90e6abff9a0`；四项门禁前后完全一致。门禁后仅整理文档/原文证据，没有改变已验收源码。散列算法及执行器原文见 [run-gates.py](evidence/cloud-final/run-gates.py)。

云端 Linux x86_64、9逻辑CPU、约9.7GiB内存、Node24.19.0/npm11.9.0。`npm ci` 成功，最终环境为 `NODE_OPTIONS=--max-old-space-size=4096`、`VITEST_MAX_WORKERS=4`、`TZ=UTC`。没有修改测试集合、原900秒超时、旧断言或黄金/生成夹具；没有获取CE源码、运行ce:fetch/test:full。

| 命令 | 最终结果 | 退出码 | 实测时长 | 原文 |
|---|---|---|---|---|
| `npx vue-tsc -b` | 通过 | 0 | 15.15s | [vue-tsc.txt](evidence/cloud-final/vue-tsc.txt) |
| `npm run build` | 通过；既有大分块提示保留 | 0 | 19.31s | [build.txt](evidence/cloud-final/build.txt) |
| 完整 `npm test` | 262文件；4594通过、83跳过、5 todo | 0 | 3193.95s（53分14秒） | [npm-test.txt](evidence/cloud-final/npm-test.txt) |
| `npm run test:drift` | 1文件/1项通过 | 0 | 51.05s | [test-drift.txt](evidence/cloud-final/test-drift.txt) |

83项跳过已逐项核对为75项缺CE条件跳过+8项历史skip；5项todo未修改，没有为本轮新增skip。没有把这些用例声称为已执行通过。当前分支完整262文件一次退出0，未以定向拼接替代完整门禁。下方按用户要求保留四条命令stdout/stderr结果原文（含npm环境/版本提示；未为此升级依赖）：

### `npx vue-tsc -b`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
npm notice
npm notice New major version of npm available! 11.9.0 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
```

### `npm run build`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> brogue-web@0.2.0 build
> vue-tsc -b && vite build

vite v7.3.1 building client environment for production...
transforming...
✓ 948 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                 0.62 kB │ gzip:   0.47 kB
dist/assets/index-BaG6iM1Q.css                 81.52 kB │ gzip:  16.32 kB
dist/assets/Filter-CtXn0QNx.js                  0.90 kB │ gzip:   0.48 kB
dist/assets/BufferResource-CdFyYx6N.js         10.60 kB │ gzip:   2.80 kB
dist/assets/webworkerAll-Bh8NOXS0.js           11.88 kB │ gzip:   3.93 kB
dist/assets/CanvasRenderer-DNHthdZq.js         22.67 kB │ gzip:   7.08 kB
dist/assets/WebGPURenderer-DNv0mWjQ.js         38.19 kB │ gzip:  10.65 kB
dist/assets/browserAll-BbF5kfZT.js             41.30 kB │ gzip:  10.82 kB
dist/assets/RenderTargetSystem-DHkvKYwr.js     45.60 kB │ gzip:  12.57 kB
dist/assets/WebGLRenderer-Ck6eLCQA.js          68.42 kB │ gzip:  18.76 kB
dist/assets/index-BIbDXZqO.js               1,605.84 kB │ gzip: 476.07 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 6.00s
npm notice
npm notice New major version of npm available! 11.9.0 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
```

### `npm test`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> brogue-web@0.2.0 test
> vitest run --exclude '**/generation_baseline.test.ts'


 RUN  v4.1.11 /workspace/scratch/db2caf941a8f/BrogueJS-cloud-ext


*** CE reference source not found; run npm run ce:fetch ***
CE-dependent tests will be explicitly skipped.


 Test Files  262 passed (262)
      Tests  4594 passed | 83 skipped | 5 todo (4682)
   Start at  19:37:27
   Duration  3193.30s (transform 10.88s, setup 0ms, import 199.37s, tests 12289.51s, environment 104ms)

npm notice
npm notice New major version of npm available! 11.9.0 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
```

### `npm run test:drift`

```text
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.

> brogue-web@0.2.0 test:drift
> vitest run src/test/generation_baseline.test.ts


 RUN  v4.1.11 /workspace/scratch/db2caf941a8f/BrogueJS-cloud-ext


*** CE reference source not found; run npm run ce:fetch ***
CE-dependent tests will be explicitly skipped.


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  20:30:41
   Duration  50.40s (transform 1.49s, setup 0ms, import 2.20s, tests 47.99s, environment 0ms)

npm notice
npm notice New major version of npm available! 11.9.0 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
```

## 跳过项与经典安全网的实际覆盖

在最终门禁后，对同一未变源码调用Vitest `collect`，只收集测试定义、**不运行测试体**。清单精确复现83 skip和5 todo：[skip-inventory.json](evidence/cloud-final/skip-inventory.json)，执行输出：[skip-inventory-collection.txt](evidence/cloud-final/skip-inventory-collection.txt)。原始最终结果缓存在收集前保存为 [vitest-results-cache.json](evidence/cloud-final/vitest-results-cache.json)。

- **75项**由缺CE源码触发既有 `skipIf(!hasCeSource())`；逐文件见下表。部分测试将CE出处检查与规则/存档断言放在同一用例或suite里，整个测试体均未执行，不能把这些非CE断言也声称已覆盖
- **8项**是原本就显式skip的历史阶段基线/恒速架构快照，位于P2-1（4项）、P2-2（2项）、P2-3（2项）；文件头说明旧阶段快照已退役/被后续模型替代，现行生成漂移由滚动基线承担
- **5项todo**保持原状：CombatFormulas的4项旧符文占位与smoke的1项旧占位
- 没有拉取CE、从缓存重建参照源码、移除skip或修改旧测试。本轮不提供上述75项的CE对照验收结果

### 75项缺CE跳过清单

各行原因均为缺CE参照源码；完整测试名称和suite级原因保存在JSON中。

| 文件 | 跳过数 |
|---|---|
| `src/engine/Combat/BoltCatalog.test.ts` | 3 |
| `src/test/captive_manacles.test.ts` | 1 |
| `src/test/u_05a_item_ownership.test.ts` | 42 |
| `src/test/u_09_learning_consumers.test.ts` | 1 |
| `src/test/u_14a_status_gaps.test.ts` | 1 |
| `src/test/u_15b2_ring_birth.test.ts` | 1 |
| `src/test/u_19a_machine_view.test.ts` | 2 |
| `src/test/u_19d_machine_families.test.ts` | 1 |
| `src/test/u_19e_machine_families.test.ts` | 1 |
| `src/test/u_19f_autogen.test.ts` | 1 |
| `src/test/u_26a_deep_levels.test.ts` | 1 |
| `src/test/v_2b_9c_effects.test.ts` | 1 |
| `src/test/v_2b_9d_dungeon_profile.test.ts` | 1 |
| `src/test/w_10_poison.test.ts` | 1 |
| `src/test/w_24_wand_catalog.test.ts` | 1 |
| `src/test/w_25_staff_catalog.test.ts` | 1 |
| `src/test/x2e_charms.test.ts` | 1 |
| `src/test/x2g_native_effects.test.ts` | 2 |
| `src/test/x2m_lighting.test.ts` | 1 |
| `src/test/x2o_horde_clump.test.ts` | 1 |
| `src/test/x3_u8c_combat_items.test.ts` | 1 |
| `src/test/x4_r1_world_catalog.test.ts` | 3 |
| `src/test/x4_r3_creature_items.test.ts` | 2 |
| `src/test/x4_r5_content_text.test.ts` | 4 |

### 请求中的现行黄金trace与生成基线

以下5项均读取仓库已有夹具，无CE条件skip；测试文件和夹具均与基线3c1407f完全一致。最终完整套件/独立drift的实际结果缓存显示failed=false，并有非零执行时长，结合完整门禁0退出，不是只从源代码猜测已运行：

| 安全网 | 实际执行处 | 本轮缓存时长 |
|---|---|---|
| UR2物品命令黄金trace：`src/test/u_r2_trace.test.ts` | 完整npm test | 4.21s |
| UR3生成/重访/存读档黄金trace：`src/test/u_r3_trace.test.ts` | 完整npm test | 107.59s |
| UR4客观时间块黄金trace：`src/test/u_r4_trace.test.ts` | 完整npm test | 5.61s |
| D27–40深层生成基线：`src/test/u_26a_deep_baseline.test.ts` | 完整npm test | 94.44s |
| D1–26滚动生成基线：`src/test/generation_baseline.test.ts` | 独立test:drift | 47.99s |

原经典RNG守卫及扩展23项同样包含在完整门禁内；以上现行安全网通过与75项CE对照跳过是两个独立事实。

## 云端复核与边界修复

- 交接后的旧近战24项及原17项扩展测试首次共41/41通过，证实 `CombatSystem.resolveAttack` 显式引用修复了取出函数直接调用兼容性。原文：[targeted.txt](evidence/cloud-final/targeted.txt)。
- 独立只读复核发现4个底座边界缺口：结束/只读context在后续回调复活权限；命令可误派发继承属性；损坏存档历史在退休旧局后触发异常；超宽随机区间令原采样器除数为0。前两个先由新增测试复现2红，损坏历史另复现TypeError：[hardening-red.txt](evidence/cloud-final/hardening-red.txt)、[save-boundary-red.txt](evidence/cloud-final/save-boundary-red.txt)。
- 修复只针对底座边界：单次回调令牌与卸载即失效；严格module/action/payload包络及自身函数查找；退休旧局前检查历史数组；调用原随机端口前拒绝跨度超过0xffffffff。不改变经典战斗/随机算法。第一次补充类型检查发现Object.hasOwn不在原lib目标中，改为等价hasOwnProperty.call，未升级tsconfig；失败原文保留为 [typecheck.txt](evidence/cloud-final/typecheck.txt)，随后最终类型检查已通过。
- `ext_hardening.test.ts` 新增6项，另覆盖扩展模式取出attack函数调用及真正通过executeCommand录制/回放的模块命令。连同旧近战/原扩展/录制续录5个文件65项定向全过：[hardening-green.txt](evidence/cloud-final/hardening-green.txt)。最终完整门禁已包含全部23项新增扩展测试。
- 独立修复复核无剩余阻塞。阶段1所需归属传播、生成事务回滚、组件回收等仍只是设计风险，没有提前实现。

## 当前 main 的最终只读整合预览

2026-10-01T19:55:18Z核验远端main为 `ad3e902a02a79b694dfbf6aa58730dec4faa53ec`，已在b0860eb之上加入UI-4。只使用临时文件与 `git merge-file -p`，没有合并/rebase或改冻结源码。新证据：[cloud-final/main-integration.json](evidence/cloud-final/main-integration.json)。

| 重叠文件 | 文本冲突 | 后续整合要求 |
|---|---|---|
| `src/App.vue` | 0 | 保留main的glyph/沉浸和UI-4详情交互，再接规则模式参数 |
| `src/components/MainMenu.vue` | 0 | 保留main新局页/设置布局，追加经典/扩展规则选择，不能恢复已删除的主题实验UI |
| `src/locales/zh_CN.json` | 1 | 保留main的map/theme/UI-4词条与旧lab键删除，再追加12条ext词条；禁止整文件覆盖 |
| `progress.md` | 1 | 保留两条开发线的独立进度和实际验收状态 |

**本报告的最终门禁只覆盖3c1407f基线上的ext/foundation，不能代表与ad3e902整合后的代码通过。** main的UI-4报告把完整npm test和四视口浏览器验收留给维护者/用户；本任务没有代为执行或声称其完成。将来维护者在独立集成分支解决冲突后，需对集成代码重跑门禁和新局模式/设置/详情/沉浸的桌面手机流程。没有扩大本任务到UI-4。

## 发布恢复记录（2026-10-01T21:25 UTC）

云端所有实现/测试/报告已经完成。git CLI只读访问正常，但没有可用写入凭据。GitHub API的一次约1.05MB内联create_tree调用长期无返回，已中断等待；该操作是否创建无引用tree未知，没有随后调用create_commit/update_ref，也没有盲目重试。短时只读核验ext/foundation仍为迁移提交ed8d270，main仍为ad3e902。

最终源码和原文证据保留在本地提交及自包含git bundle中，供已有认证环境仅导入并推送同一最终提交；开发和测试不迁回Mac，也不重跑门禁。Git bundle验证、最终提交/文件散列及传输身份由交付消息提供。实际远端SHA核验成功前，不声称发布完成。

## 交付与架构决定

完整设计见 [architecture.md](architecture.md)：注册/依赖排序、固定启用集合、生命周期、准确钩子位置/时机/读写/RNG合同、原创 JSON 定义+TS类型+校验、通用生物组件、独立存档区块/u03契约、录像版本与集合校验、后续阶段风险。

- 核心在 `src/ext/`。经典默认空运行时，不调用模块或改变原存档/录像投影；所有新增引擎代码为模式/钩子接线及存档录像包络接入，原战斗解决函数保持原代码。
- 模块只有自己的 JSON 状态/生物组件可写。钩子是冻结 DTO，所有随机来自原实质流；命令通过原 `executeCommand`，物品仍通过 `executeItemCommand`。读取、保存、卸载、显示没有规则随机调用。
- 示例 example 1.0.0 显示本地化死亡消息、累积非行政怪物死亡数，并走存档/读档/录像/seek/续录；不实现经验/成长。数据包的职业、技能、NPC、对话、敌人模板只是底座格式例子，不生成新内容。
- 新增 Game 字段 `extensionRuntime` 已登记 u03；Creature 回调用 WeakMap 访问器，原实体字段/codec 守卫未改。旧测试/断言、两份生成基线、三份黄金 trace 均未修改。

## 验证证据

迁移前阶段0新增17项测试（ext_foundation 13 + ext_validation 4）；云端新增6项后共23项，全部纳入最终完整门禁。原17项，覆盖注册表/生命周期/排序/严格JSON/组件校验、生成和物品钩子、状态往返、录像集合版本拒绝、示例自然击杀与续录/seek/OOS、随机接入和经典零调用守卫。经典 RNG 夹具来自未改 main 的独立 `/tmp/bjs-ext-baseline` 归档，记录原 seed4101 的开局/真实攻击/等待双流完整tuple，捕获命令原文：[classic-baseline-capture.txt](evidence/classic-baseline-capture.txt)。没有从扩展实现计算期望来冒充旧基线。

最后两行兼容性修正前，定向7文件69项通过；另外原三份黄金trace等9文件66项已通过。这些定向结果不替代完整门禁。

浏览器使用技能标准客户端与补充Playwright集成脚本：1440×1000桌面、390×844手机模拟，新局默认经典/选择扩展成功，seed1141巫师局21条自然命令产生一次击杀；中文扩展消息可见，存读档、完整来源、回放及版本不匹配拒绝通过，pageerror/console.error均为空。摘要：[browser-summary.json](evidence/browser-summary.json)。截图已实际查看，仅在 `/tmp/bjs-ext-browser`，不提交。手机为尺寸模拟，安卓实机未测。

## 本地迁移前门禁历史（中断，不能替代云端最终结果）

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

## 用户要求的云端迁移历史 / 当时剩余验证

2026-10-01T18:53:19Z 按用户要求停止本任务runner PID91203及其测试子进程，避免占用本机CPU；先冻结runner，再只终止所属进程树，恢复后确认本任务测试/构建进程为空。未影响其他工作区。停止证据：[migration-stop.json](evidence/migration-stop.json)。没有启动drift或新的本地重型测试。

中断前旧 `p4_5_melee_specials.test.ts` 报告3项失败。原main独立归档同文件24项通过，原文：[melee-original-main.txt](evidence/melee-original-main.txt)。定位为新增attack包装器引入了 `this.resolveAttack` 依赖，而旧API及测试允许 `const attack = CombatSystem.attack; attack(...)` 的直接函数调用。交接前已仅将两处引用改为 `CombatSystem.resolveAttack`，不改原战斗解决函数或任何旧断言；**这两行修正尚未复验**。当前迁移源SHA256为 `934bb0f09b05b3bb246cc5a17d962fd0a91ad5e241835a19642f0d9ff6511814`，不是前面已跑类型检查/构建的源版本。

云端接续入口见 [cloud-handoff.md](cloud-handoff.md)：检出远端ext/foundation，确认WIP SHA，然后先验证旧24项近战守卫及17项扩展测试；如失败修代码，旧断言不改。对最终稳定代码执行 `npx vue-tsc -b`、`npm run build`、完整 `npm test`、`npm run test:drift`，保存新一轮完整原文/退出码，不以本地定向或中断日志代替。可按云端资源选worker数，不能改变测试集合或原超时。通过后再更新报告并仅推送ext/foundation；不创建PR，不合并/rebase/main/标签/Pages，不进入阶段1。

## 迁移时 main b0860eb 的整合影响（历史只读比较）

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

下列为基线至交接实现的清单，另新增完整云端证据目录 `docs/ext/evidence/cloud-final/`（原文、状态散列、运行器、定向红绿证据、只读整合摘要）。本轮继续更新architecture/report/cloud-handoff/progress，以及runtime/Game边界修复。

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
- `src/test/ext_hardening.test.ts`
- `src/test/fixtures/ext-classic-rng.json`

## 后续建议与风险

继续顺序为阶段1成长 → 2叙事 → 3预警/多回合攻击，再体力/韧性/弹反 → 4独立2×2场地，再3×3 → 5世界图设计和原型。每阶段先审设计及确定性合同，再实施并交接。

阶段1先明确击杀归属/环境和持续伤害来源、生成事务提交/回滚与死亡组件回收；只读attack钩子不能替代规则策略接口。阶段3需要AI行动选择/耗时/取消端口。阶段4必须统一占位表、体型寻路/缓存、视野、鼠标与AOE去重、四种地图渲染/记忆、Boss净空与跨层落点；不应直接把footprint元数据映射成放大字形。阶段5再设计独立世界时钟/随机域与上下层结算守恒。详细风险在设计§8。

每命令完整扩展checkpoint会随成长状态变大而增加录像体积，后续要测量再改摘要/周期快照；本阶段没有做旧档迁移或模块热切换。示例的kill统计是生命周期死亡数，sourceId仅attack栈内可信，不能直接当玩家XP归属。

云端已完成阶段0的实现、23项新增扩展测试、完整四项最终门禁与原文交付。到此停止，等待维护者审阅；不开始阶段1，也不自行整合main。
