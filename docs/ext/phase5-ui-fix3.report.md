# P5 UI fix3：营地储粮预填与拒绝反馈

任务书 `p5-ui-fix3.task.md`；开工 `ext/phase5` / `b820733`，工作区干净。唯一写入者，未 commit/push。

## 实现与边界

- `useSettlementUi` 在打开面板时预填合计两份，优先原生口粮，再选芒果；不足时填已有数量。按食物实体 ID、可用数量和原生身份建立签名，食物改变才重算；普通 DTO 轮询、非食物库存改变保留手动选择。重新打开会重新预填。食物判断与底座 `StructureProduction.foods` 一致，不按中文名称推断身份。
- `SettlementPanel` 消费既有 SDK-02 只读出口：`structureReadSDK.read().lastError` → 面板模型 → 精确中文提示。有限错误表覆盖全部 `WorldErrorCode`，复用基础层 i18n 文案；不依赖 crafting 包，不调用 plan/commit 做显示预检。建营、建造、存取、采集及居民操作共用这条拒绝反馈路径。
- 当前材料来源的不足项显示“建材不足：名称 已有/所需”；食物未满两份显示“还缺 N 份口粮或芒果”，超额给出恰好两份的要求。现有置灰条件均有可见原因：回放/暂不能行动、缺营地、空草稿、草稿上限、锁定储粮，以及居民的距离、回营、箱子/实物/种植床、已有订单、批数和班次条件。材料提示只是可见库存提示，最终合法性仍由公开命令检查。
- 仅改模块 UI、本地化、UI 错误词表与测试。无引擎规则、Game 字段、RNG、存档/录像格式或定义指纹改动；全部写入仍走原 `executeCommand` 路径；无基线/trace 重录、无旧测试或守卫改动。

## 自动化证据

新增 `settlement_feedback_ui.test.ts` 编译真实客户端 SFC、挂载 Vue 自定义 renderer，并连接真实 Game 与公开命令；不是浏览器像素或真机证据。覆盖默认预填、口粮优先于更早出现的芒果、混合补足、仅芒果、手调与轮询保持、食物耗尽/移除、重开、建营真实锁粮、准确错误文案、置灰原因和回放只读。读显示/改草稿检查世界、库存、回合、实体 ID、RNG 和录制事件不变；拒绝命令检查除增加一条真实录制输入外均不变。

首轮新测试 8 项：6 通过 / 2 失败（exit1）。两项均为本次新测试布景问题：墙格被底座交互线先拒为距离错误，改为真正未见目标验证 `C5_BLOCKED`；另一次修改食物后未等 Vue 刷新便点击，补 `nextTick`。未改旧测试前提或生产规则。

相关首次批次：9 文件、65 项通过（exit0），包括新回归 9 项，以及 settlement 的 ui/review/input/inventory_ui/safety/materials/harvest 和 `ext_phase5_ui_open`。此后错误映射收束为有限词表并增加完整性回归，收尾结果见下文。

## 环境与验证限制

全部 Node 命令前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`，实测 Node 24.19.0；`NODE_OPTIONS=--max-old-space-size=3072`；Vitest `--maxWorkers=2`。长命令跟进实际退出码，日志位于 `/private/tmp/p5-ui-fix3-*.log`，不提交原始日志或截图。

浏览器：Vite 监听 `127.0.0.1:5199` 被沙箱以 EPERM 拒绝；按 develop-web-game 技能调用原 Playwright client，Chromium 初始化失败，未到页面。没有本候选浏览器截图，窄屏排版与真实触屏仍待人工。该限制不冒充浏览器通过。

## 收尾结果与既有失败

- 补充批次（5 文件）退出 1：51 通过 / 2 失败 / 11 因失败的 `beforeAll` 未执行。其中新增居民回归先因布景在墙外看不到居民而失败；改到房内两格距离后，暴露自定义 renderer 缺少 v-model 所需 DOM 接口（再次 12 通过 / 1 失败）。已补齐测试宿主接口；最终新回归 **13/13 通过**，无 skip/todo/unhandled。
- 该批次中的完整 `p1_30_i18n_gate`、完整 `test_suite_membership`、完整 `ext_structure_source_guard` 通过。
- 既有 `resident_replay_import_ui` 的自然 seed28 source398 用例及“同值 DTO 草稿”组的前置步骤，在创建 UI 之前执行 `naturalRoute.steps` 时已留下一项未消费确认 `[true]`（原文件 510/642 行）。用 **开工 HEAD b820733 的完整 `git archive` 副本**、相同 Node/参数及原测试重跑，两个位置同样失败（exit1，1 用例失败 + 1 组 beforeAll 失败，17 未选或未执行）。不是本次改动造成；没有更改旧断言、自然路线或用 skip 掩盖。当前原文件其余 6 项通过；自然路线相关 12 项不能报通过。
- 初次源码守卫枚举把读取黄金夹具/测试局部变量也当作源码依赖，误选了大范围生成与 trace；主动中止，exit130，无验收结论。后改用函数读取关系，排除已确认的纯黄金文件读取，批次仍包含部分读取共享输入的行为用例；相同共享源码读取函数只选一个原用例执行。最终清单与可复现 runner 分别在 `/private/tmp/p5-ui-fix3-precise-guards.json`、`/private/tmp/p5-ui-fix3-precise-guards.cjs`。
- 最终 `npm run check:modules`（模块边界 + 测试依赖）exit0；生产候选 `vue-tsc -b` 与 `npm run build` exit0，构建仅既有大 chunk 提示；未运行完整 npm/test:ext、全量生成/删除矩阵或 drift，不冒称全量通过。

复现本次核心新回归：

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
node node_modules/vitest/vitest.mjs run src/ext/modules/settlement/tests/settlement_feedback_ui.test.ts --maxWorkers=2
```

既有失败反事实日志：`/private/tmp/p5-ui-fix3-head-counterfactual.log`；完整失败批次：`/private/tmp/p5-ui-fix3-final-tests.log`；新回归最终通过：`/private/tmp/p5-ui-fix3-feedback-verified.log`。测试中的受控 Game 布景不称自然路线验证；浏览器/真机限制见上文。

补充共享源码/SFC 完整文件检查：`glyph_inverse_contrast`、`main_menu_replay_seek`、`search_progress_hud`、`ui_2_protection`、`ext_module_creation_ui` 共 **5 文件、52 项通过**（exit0）；最终测试代码的显式 `vue-tsc -b` 亦 exit0。`git diff --check` 通过，改动文件无 CRLF、无超过 1 MB 文件。

最终源码守卫及附带行为批次 **56 文件、100 项通过，905 项因名称筛选未运行，exit0**，耗时 772.55 秒；完整日志 `/private/tmp/p5-ui-fix3-precise-guards.log`。没有新增 skip/todo 或未处理异常。至此本任务实现、新回归、源码守卫、boundary、显式类型检查及实际构建完成；仅上述开工 HEAD 即存在的居民自然路线失败与浏览器/真机验证缺口保留。未提交、未推送。
