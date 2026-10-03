# 阶段 2a0：模块组合与物理可移除底座

状态：实现、最终云端门禁及本节列出的真实浏览器验收完成，等待维护者验收；未覆盖项明确单列。基线 `2c27ab10721900a8f64de43122ff135ffca76281`，仅 `ext/foundation`，不合 main、不打标签、不部署。维护者 P2-D01/02/03/04 全 A 已登记；本步完成后停止，等待验收，不启动 2a1。

## 范围与实际变更

- `src/ext/descriptor.ts`、`catalog.ts`：纯声明自动发现，稳定 ID 顺序，精确版本/rules/foundation 校验，选定集合才执行工厂；无具体阶段硬导入。默认开关属于模块配置；菜单默认 classic 与 extended 预选 growth 暂保现状，不是永久产品决定
- `src/ext/modules/growth/{data,locales,ui,tests}/` 与 `test-suites.json`：机械数据、专属文案、角色/创建/HUD/技能栏、composable 和真实专属测试归模块所有；example 移为 `src/test/fixtures/example-module`，不在生产 catalog/菜单。通用出生/策略/因果/指纹等测试留底座，不借删除模块删掉基础覆盖
- `src/ext/ui/`、`App.vue`、`MainMenu.vue`、`CommandBar.vue`、`theme/ThemeHud.vue`、`src/assets/theme-shells.css`：通用插槽、精确模块选择、初始化批与仅启用模块的显示会话。空集直接开局；有创建 UI 的模块提供自身选择，没有 UI 的模块使用自己声明的初始命令。取消草稿不改现有世界
- `src/ext/runtime.ts`、`types.ts` 与 `growth/module.ts`：底座验证完整有序初始化前缀，growth 创建不再硬锁录像第 0 条；仍保留唯一创建、完整状态跃迁、错误输入与命令边界检查。基础错误文本从 `Game.ts` 的 growth 命名空间移至通用命名空间
- `queryOptional`：只读、版本化可选协议；提供者缺席/未启用、不支持输入正常返回不可用；冲突、无效/异步返回报错。查询只见自身冻结 state/玩家组件，返回深拷贝冻结 JSON，无写能力/RNG。仅测试 descriptor 演示，未实现真实 growth XP/身份 adapter、奖励提交/事实队列或叙事效果
- `scripts/test-discovery.mjs` 为 npm/Vite/清单守卫共用发现结果，底座与每模块清单分别登记；漏项/过期/重复/越权登记即失败。`test:ext` 同时运行全部底座扩展与所有安装模块测试
- `scripts/check-module-boundaries.mjs` 解析 TS/Vue/import/export/type/dynamic import、资源引用、TS/Vite alias 与测试所有权；只给固定通用发现入口例外。`check-module-removal.mjs` 复制当前候选、校验 hash、真删目录、隔离缓存、重新发现后运行全部剩余门禁；禁止把禁用当删除

补充实际接线文件：`src/i18n.ts`/`src/locales/zh_CN.json` 合并/拆分文案；growth 的 `index.ts`、`definitions.ts`、`view.ts` 改本地资源及自身创建上下文。通用旧UI测试 `dpad_hold_input`、`immersive_polish`、`main_menu_replay_seek`、`ui_4_glyph_feedback` 更新真实通用导入/SFC夹具；`i18n_scan.ts` 与 `p1_30_i18n_gate.test.ts` 合并已发现locale并仅跟踪两个descriptor字段的有限键集，不用宽泛ext前缀放过缺键；`test_suite_membership`改验证共享发现结果。全部30个growth自有测试的精确清单在模块 `test-suites.json`，新底座文件在根 `scripts/test-suites.json`。

没有新增 Game 字段，因此 U03 登记无需改变。没有地图生成算法变更，没有重录生成基线/黄金 trace；本轮不运行 drift。没有新增 narrative 目录、NPC、对话、剧情内容或重世界能力。

## 测试所有权与旧断言

本步是所有权和组合迁移，不删除 classic/中性对等的有效历史覆盖。原具体目录/import/SFC mock 与专属 shell props 改为模块路径/通用 slot；行为、命令、状态、RNG、资源与 replay 断言保留。通用测试中的 example 由显式底座 fixture 注册，absence 测试使用空启用集；不把生产 catalog 中的 example 空壳留住。example 本来是阶段0展示注册/计数钩子的数据样例，没有产品玩法入口的长期承诺；按2a0已审阅的“开发样例转fixture”方案移到 `src/test/fixtures/example-module/`，当前不作为可独立安装的正式包提供。其注册/工厂延迟、依赖顺序、初始化/卸载、kill钩子、消息/计数、管理性死亡排除、真实存读/录像/seek/续录保留在 `src/test/ext_foundation.test.ts`，纯数据/恶意输入在该文件与 `ext_hardening.test.ts`；出生元数据在 `ext_births.test.ts`，通用策略在 `ext_engine_policies.test.ts`，基础版本/事务/GC在 `ext_foundation_contracts.test.ts`，SHA/canonical在 `ext_fingerprint.test.ts`。删growth后这些真实基础测试继续运行，没有因移除示例产品入口丢失其能力覆盖。

成长创建读模型仍读取实际注册工厂，单独选择 growth 而不依赖默认组合；定制包/默认身份/槽数测试继续验证同一个实际包。模块测试迁移同时拆出混合文件中的纯底座覆盖。测试发现器对实际文件集合逐项比对，没有 catch import、宽泛 exclude 或新 skip 掩盖残留导入。

## 独立复核与新增负例

- growth 原先只允许自己作为首个输入，录像也硬认第 0 条；现完整初始化顺序由底座处理，新增 alpha 先初始化再 growth、双模块顺序置换及每条 checkpoint/RNG 回放
- 重复初始化的识别与 payload 有效性分离；非法 revision/null/缺字段/额外字段的重复创建都在读取录像前拒绝，旧玩家、runtime、世界与 RNG 保持
- UI descriptor 所属目录必须等于 moduleId；模块命令必须使用自身 ID 前缀且唯一，不能劫持原生 wait 或别的模块入口
- 模块 UI 使用传入的 Game；未启用不创建会话，runtime 替换/卸载处理旧回调；创建异步加载、取消/重开与迟到结果单独测试
- 可选只读查询覆盖缺席/关闭/不支持输入、同能力重复 provider、冻结 DTO、非法数据/异步回调、无 RNG 或机械副作用
- 边界脚本通过临时 fixture 测静态/type/dynamic imports、别名、Vue/CSS/JSON/构建资源与缺失模块，不能只靠当前 growth 名字 grep

## 组合、物理删除与浏览器

最终云端门禁全部通过，实际结果如下；浏览器结果另列，未拿engine-only当真实浏览器。当前已实现模块只有 growth；安装集合的真实子集是空集、growth。额外 alpha/beta 为底座测试 descriptor，仅证明组合合同，不冒称 narrative 已实现。

物理删除脚本已在独立副本真删 growth 整目录，共60文件（含数据、文案、UI、30测试及清单），复用依赖但不复用dist/tsbuildinfo/Vite缓存。重新发现只移除这30个owner测试，余下266常规测试文件/21扩展文件全部运行；生产 example 目录已迁除且不被发现，基础 example fixture 保留用于真实底座测试。要求缺失模块的旧档/录像拒绝，与可选查询缺 provider 正常降级分别验证。删除副本空集真实Game验证存读、逐事件checkpoint/双RNG、seek、续录和缺growth拒绝均通过。

云端系统 Chromium 的进程启动受 socket 限制，未拿 SSR 或软件开关结果冒充真实浏览器通过。真实构建 UI 与删除副本的 dist 由已授权的 Mac QA 检查；仅托管产物，不在本地开发或跑长测试。原日志/截图留本地，不提交仓库。

### 真实浏览器分轮证据与限制

两轮使用同一个QA归档与同字节normal/deleted构建。首轮真实UI完成：normal空集/growth模块选择与取消、取消创建后空集键盘开局、双击创建只录1条初始命令、创建/角色页输入屏障、HUD/技能栏随选择出现或消失；自然保存/加载/续录、逐条回放及seek 0/中间/末尾均0 OOS。growth与删除版各在1440×900、390×844、320×844普通/沉浸6布局检查并截图，窄屏取消可达。删除版自然3回合保存、加载后续录到4事件、逐条回放及seek 0/2/4均0 OOS；导入normal自然growth录像被拒，玩家/runtime/双RNG/扩展状态保持。错误只显示集合/版本/状态不一致，未点名growth，见诊断限制。

首轮后续工具调用因参数约2MB超过1MiB接口上限失败，这是工具参数错误，不是游戏失败；不把该轮所有后续项目写成通过。恢复轮读取已有本地证据，以有界数据继续：两构建冷空集正式UI开局/资源检查，以及实际built Game的有界probe均通过，逐checkpoint/双RNG、续录、seek和缺模块拒绝断言通过。归档SHA256及40份dist在结束时再次全匹配。恢复任务的标签页/视口/监听已清理；确认服务归属后关闭8765/8766，已无监听。旧任务标签页不在恢复任务可见范围，清理无法独立核验。

未覆盖：物理手机真实触摸、浏览器异常chunk路由注入。加载失败/取消重试/迟到回调/退休会话/重复输入在真实生产SFC的定向测试中覆盖，但不冒充浏览器故障注入。阶段1e原生食物确认与剪贴板等既有未覆盖项不因本轮改成通过，也未扩张native-confirm范围。

Mac最终证据：`/Users/coolking70/Documents/Codex/2026-10-03/task-6/qa-2a0-closeout/qa-closeout-report.json`、同目录`manifest-verification-final.json`和`screenshot-index.json`；截图仅本地。使用Codex IAB，浏览器UA版本`Chrome/154.0.0.0`；UA中的Intel Mac/10_15_7不作为实际硬件或macOS版本证明。首轮证据在`/Users/coolking70/Documents/Codex/2026-10-03/task-5/qa-2a0-candidate/evidence`，24图；恢复轮1图，按路径/SHA合计25张唯一截图。

## 版本兼容与局限

- growth 仍为 `1.4.0`，底座包络仍为 1；无存档字段或现有集合的机械规则变化。`data/definitions.json` 移动前后字节相同，SHA256 `1eabb50f5f06d640569988ebed33a374580593562ac42a1b8c76cb2e7f8170d4`，rules fingerprint 不变
- 已实际验证基线 `2c27ab1` → 候选、候选 → 基线双向读取：classic/growth-only，normal、seed1141、growth中性创建；存档读取、逐事件 replay、seek 0/1/末尾、续录2次wait后重放，两个方向共96个完整世界+双RNG快照精确相等，唯一排除savedAt。仅证明这两种既有短局，不承诺任意旧版本/长局。新模块组合需要对应 descriptor 安装；旧 catalog 不会自动认识新模块。原生产 example 档当前缺包而拒绝，未提供迁移
- 缺包输入已在旧局退休前拒绝并保持玩家/runtime/双RNG；当前UI统一提示“启用的扩展集合、版本或状态不一致”及导入失败，不点名缺失growth，也不细分版本/状态原因。本步以明确拒绝/不静默剥除为合同，诊断粒度限制单列；结构化兼容错误可后续另做。
- 不热启停，不自动丢弃缺失模块状态，不迁移其它旧版本。能力 provider 冲突仍拒绝，不宣称多 provider 规则合成已经实现
- optional seam 仅只读查询。剧情 XP、分阶段事实/意图排空、重世界事务、通用交互对象与对话 gate 都在后续获准步骤实施；没有抢做阶段 2a1/2b/2c
- 到 2d 必须按需复用已完成的 main D1 DialogService/DialogHost 统一仲裁并扩展 dialogue；若未完成先问维护者，禁止另造弹窗容器。本轮不拉 main 无关改动

## 最终门禁

首次移动中间树的 ext 专项发现19项失败（example ownership 与配置工厂改接线），已据真实覆盖修正。首个冻结树 ext 51文件976项通过；完整npm test实际295文件通过/1文件失败，5381 passed、1 failed、8历史skip、5历史todo，exit1。唯一失败为 `gameplay_layout` 的旧源码字符串 `commands.filter(c => !primary.has(c.action))`，与通用模块命令同时置于主栏的有意迁移不符；更新为主栏“primary或moduleCommands”和溢出栏其严格补集，保留所有原生命令可达、dispatch及禁止直接改Game的断言，并补实际挂载的命令唯一性/分区/分发测试。生产源码与QA产物未改；新测试树重新冻结并完整复跑门禁，不拼接失败树绿灯。同期旧测试树的删除副本 boundary/type/build/ext（21文件431项）通过，npm test以exit130主动中断，smoke未运行；该轮不是完整删除通过。


### 第二冻结树最终结果

2026-10-03 13:49:43–14:37:45 UTC；Node 24.19.0/npm 11.9.0，NODE_OPTIONS=--max-old-space-size=3072，每个测试命令2 workers。正常树与删除副本各自执行完整命令，没有用定向复验替代npm test。现有CE缓存保留并复制到删除副本；未调用ce:fetch、test:full、test:gen，没有人为制造CE skip。

| 候选 | 实际命令 | 结果 / 实际耗时 | exit |
|---|---|---|---|
| 正常 | `npx vue-tsc -b` | 通过；22.82s | 0 |
| 正常 | `npm run build` | 通过；34.83s | 0 |
| 正常 | `node scripts/check-module-boundaries.mjs` | 通过；5.61s | 0 |
| 正常 | `npm run test:ext -- --maxWorkers=2` | 51文件，976 passed，0 skip/todo/failed；Vitest 273.37s | 0 |
| 正常 | `npm test -- --maxWorkers=2` | 296文件，5385 passed，8 skip、5 todo、0 failed；Vitest 2543.61s | 0 |
| 真删growth | `node scripts/check-module-boundaries.mjs` | 通过；3.51s | 0 |
| 真删growth | `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 新缓存类型检查通过；18.25s | 0 |
| 真删growth | `npm run build` | 新构建通过；31.79s | 0 |
| 真删growth | `npm run test:ext -- --maxWorkers=2` | 21文件，431 passed，0 skip/todo/failed；Vitest 192.83s | 0 |
| 真删growth | `npm test -- --maxWorkers=2` | 266文件，4840 passed，8 skip、5 todo、0 failed；Vitest 2296.95s | 0 |

删除总入口：`NODE_OPTIONS=--max-old-space-size=3072 node scripts/check-module-removal.mjs --retain=none --engine-only --maxWorkers=2 --output=<仓库外证据目录>`，于14:32:16 UTC结束，exit0。最后执行 `node scripts/check-module-composition-smoke.mjs --output <证据JSON> --engine-only --removed-modules growth`；安装清单为空，空集存读/回放/seek/续录及missing-module拒绝通过。脚本状态刻意是 `partial-browser-not-verified`，不会因engine-only出口0把浏览器写为passed；真实浏览器的同字节构建证据另列。正常树另以同一smoke入口engine-only验证空集/growth，两组均通过。

两套完整npm test的8 skip/5 todo均为历史项目，不新增skip/todo、不放宽种子/断言/超时。构建保留已有Vite大chunk和npm代理配置提示。没有FATAL/OOM、未处理错误或worker异常。

### 冻结与证据归属

- 第二冻结树2015份输入前后逐字相同，SHA256 `6291f89229bd60dc075a1576e2b62f43792e5249637f164bc1b55b8b93a19d60`；代码/测试等筛选727份，hash `b3e049d421ec9c64920f70ee975ad0bdc1bc098438c131da712d946284ded0d8`
- 首树到第二树只改变两份基础测试及本报告，2012份其它文件逐字相同；生产代码/资源/配置未改变。第二树新构建与已交Mac的QA包40份dist逐文件完全相同：normal 24文件hash `93258a3e03fe3fd8a2069ea25ed932e0869583f58f348b5891a272259fb49f57`；without-growth 16文件hash `6cde32ffdf3ace1e58ea8af541421c62fb22fc085da3c6c28d255c82760bfa11`
- 删除脚本先验证副本与第二树hash相同，再rm模块；删除后的输入在全部门禁前后也完全相同，源工作树未被删除/修改。只为实际安装的growth跑当前矩阵，不宣称未来narrative或阶段3–5已验收
- 最终门禁结束后仅补文档。原始日志/完整hash/隔离副本/兼容大快照保留云端仓库外 `cloud-extension-evidence/phase2a0-*` 与 `/tmp/brogue-2a0-compat-20261003/`；截图与Mac原始证据仅留Mac，不提交。精简命令原文见 [证据摘要](evidence/summary.md#阶段2a0组合与物理可移除底座)

提交前LF核验通过。staged `git diff --check`仅提示`src/ext/modules/growth/tests/ext_growth_data_contract.test.ts:60`末尾额外一个LF空行（非CRLF、无功能差异）；为保留最终已测字节，按维护者确认保留并如实记录此非功能warning，不改守卫、不改已冻测试树。
