# Dialog D4：闪现越过熔岩的界面内确认

日期：2026-10-04。工作区 `BrogueJS-newtheme`，分支 `feat/dialog-d4-blink`，基点 `3e2d64d9da3e960a43fa26538f6e568d1572e806`。按 [D4 任务书](../tasks/dialog-d4-blink.md) 与已确认的 [设计 §4.4](../design/in-app-dialogs.md) 执行；指定文档全部已读。开工时两份未跟踪任务书 `dialog-d4-blink.md`、`chore-test-sfc-resolver.md` 未改。未 staging/commit/push。

## 实现与兼容边界

- 键盘/TargetBar 的 `confirm_target` 和地图点选的 `mouse_travel` 均在原正式命令内进入法器 generator。到实际未知射程熔岩风险点时，将当前 `CommandExecution.action` 改为 `arcana:risk-confirm`，保留 data 与已经执行的 P0。Host 只恢复当前命令；等待期间没有 provisional event/index，回答后一次提交标准 `[false]` 或 `[true]`，不重入 executeCommand、不再跑 P0。
- 否只清法器选择；是沿原 commitArcanaTarget 施法/自动鉴定/扣充能/原计时路径执行一次。沿用原风险谓词和 `arcana.blink_unknown_lava` i18n 键，未增加玩家文案。无风险和已知致死目标仍记录原 `confirm_target, decisions=[]`。
- 等待使用 D2 的确认 token、Host、heldInput、admission、保存与导出边界。补充等待事实校验：法器选择对象/光标、物品身份/射程知识/种类知识，以及包含瞄准点之后、未知格在内的整条只读射线。外部变化使旧答案失效，不收费、不补造否事件。新局/读档/取消/Host 生命周期复用原续体清理。
- App 移除 `wireConfirmRequest` 与 `window.confirm` 兜底接线，全部游戏风险确认由常驻 DialogHost 处理。`onConfirmRequest` 仍是 headless/测试的同步解析器；无 Host 且解析器为 null 时采用 D2 的默认批准。没有新增 Game 字段；U03 清单、存档/录像结构及 version 2 均未改。
- 新 action 在 loaded 单步、playing、restart/seek 中经同一继续阶段严格消费一个 recorded decision，缺失/多余答案仍 OOS，不发 Host。地图点击保留目标坐标 data，回放走原地图入口，保留 justRested 等前缀，再设相同光标进入该阶段。
- 历史 `confirm_target`（及旧地图点选）可能带 `decisions=[]`。未知射程风险在所有回放模式沿原批准解释，不调用真人 UI，不追加默认 true。普通/已知致死检查仍保留原解释，未笼统取消全部预检。**旧取消事件缺失答案，无法可靠恢复**：其检查点与批准路径不一致时继续 OOS，不依据后续位置/时钟猜答案，不迁移、不补造 decisions。老构建不承诺认识新 action，虽然 schema/version 未变。

CE 本地参照为只读 legacy `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`，`ce:fetch` 仅验证并复用，未 fetch/修改参照。核对 `Items.c:7261–7319`、`7370–7376` 的执行路径：先风险检查，取消目标后返回，批准才记录并施法。另只读核对 [官方当前 Items.c](https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Items.c) 的对应路径（约 6061–6115、6160–6176），本次涉及的条件和效果先后相同。

## 回归与旧测试前提登记

新增 `dialog_d4_blink.test.ts` **29 项**（已登记常规套件），真实客户端 `dialog_host.test.ts` 增加 **3 项**；保留原 20 项 Host 用例。

| 范围 | 证据 |
|---|---|
| 正式 true/false | 真 executeCommand/executeItemCommand，等待边界库存/充能/位置/HP/营养/时钟/双 RNG 不变；false 最终不变，true 一次 zap、一充能、一回合；重复 token 无效；P0 恰好一次 |
| P0 cosmetic 例外 | 未采样 flare 的同步拒绝与异步拒绝完整只读比较相等；只有 P0 cosmetic 前进，实质流不变；答案恢复不再抽取双流 |
| 录像/续录 | 两种答案各覆盖 loaded 单步、playing、restart/seek、有效存档续录，严格最终世界与双流比较；新 action 缺/多答案 OOS；构造历史 answerless 批准事件覆盖三种回放模式；旧取消夹具保留缺口/OOS |
| 对象与生命周期 | 光标/选择对象/充能/身份/射程知识/种类知识/远端已知与未知射线格变化失效；新局/读档/取消不制造 No；保存/导出等待超过六秒，等待后正常提交 |
| 实际 UI | 真实 TargetBar、触屏 targetingTapCommand 与键盘命令通道绑定真实引擎/Host；问题中文原样，否/批准、heldInput 取消、admission、旧 pointerup 与 repeat 不回答、释放后新输入有效；无 native resolver 调用 |
| 全局扫描 | 遍历生产 `.ts/.vue`，AST 检查原生 confirm 调用并扫 window.confirm 属性/索引访问；App 常驻 Host，无旧兜底导出/接线 |

新增首版 21 项回归在旧生产上 **16 失败 / 5 通过**（`before-implementation.log`）；原 UI-1 **33/33 通过**。首版实现后四文件 **138 通过 / 3 失败，exit 1**（`after-implementation.log`）：两项正是旧原生接口前提，另一项是本轮新 seek 夹具固定打开动画，覆盖 seek 自己的静默关闭；夹具改为保留调用时的动画设置，生产回放流程不改。随后两文件 **54/54 通过**（`refined-regressions.log`）。

**唯一旧前提转换：`ui_1_rendering.test.ts` 的两项 D4 原生接线测试。**

1. 原测试不动，新的 Game/App 下两项失败：导出的 `wireConfirmRequest` 已移除，App 也不应再接线它（`after-implementation.log`）。
2. 仅把 `src/App.vue` 回退到 HEAD；Game 和其它生产代码仍为本轮实现，原测试完全不改，UI-1 **33/33 通过，exit 0**（`old-ui-counterfactual.log/json`）。finally 逐字节恢复 App；备份 `app-new-backup.vue`。
3. 将明确延期的 native stub 前提换为 D2 同一可控 Host capability，保留问题原样、否/是分支、回放不询问；生产接线针脚由旧 App 函数调用换为 App 常驻 Host + Host 实际 `bindDialogCommands(service, activeGame)`。本轮真实 D4 UI/引擎测试另覆盖实际批准效果与全部回放模式。移除仅服务旧导出的 beforeAll/stubGame，不删用例、不 skip。这是任务书明确要求的接口替换，不宣称旧 native 调用断言可以原样保留。

`dpad_hold_input` / `map_touch_input` 的 D2 可控答案前提保持；原 W25 的同步 headless resolver 测试也保持。没有改白名单、容差、种子、超时、规则期望、黄金 trace 或生成基线。

新增真实 Host 测试初次在 window stub 之前静态导入 Input 单例，文件初始化失败（`ui-regressions.log`），改为现有 beforeAll 时点动态加载。修正后原及新增 Host **23/23 通过**（`host-refined.log`）；生产代码未因此改动。

冻结复查另发现：地图点选的原入口保留 `justRested`，新 action 若回放到键盘入口会将它清零。增加真实 wait→use→mouse_travel 的 false/true 保存状态回归，两项修前均失败（`mouse-prefix-before-fix.log`），生产改为带坐标 risk action 沿原地图入口执行后两项通过（`mouse-prefix-after-fix.log`）。名称筛选的另外27项未运行，不是新增 skip。第一次门禁 CE/type/build/10文件326项已过，但完整 full 人为中止 **exit 130**；完整结果缺失，gen/drift 未进入，不计全量通过，证据保留 `gates-interrupted/`。修后从头重跑最终全链。

## 全量门禁

最终代码冻结后从头执行，以下全部 exit 0。原始证据仅在 `/private/tmp/dialog-d4/`，runner 为 `run-gates.py`，完整命令、时长与实际退出码在 `gates-state.json`。

| 门禁 | 最终结果 | 证据 |
|---|---|---|
| ce:fetch（复用只读本地参照） | exit 0 | `ce-fetch.log` |
| npx vue-tsc -b | exit 0 | `type-final.log` |
| npm run build | exit 0，仅既有大 chunk 提示 | `build-final.log` |
| 相关回归（2 workers） | **10 文件 / 327 项通过**，53.60 秒 | `related-final.log` |
| npm run test:full -- --maxWorkers=2 | **251 文件 / 4582 项通过**；既有 8 skip / 5 todo 未变，1089.45 秒 | `full-final.log` |
| BROGUE_REQUIRE_CE=1 npm run test:gen -- --maxWorkers=2 | **27 文件 / 436 项通过**，2661.83 秒，无超时/复跑 | `gen-final.log` |
| npm run test:drift -- --maxWorkers=1 | **2 文件 / 2 项通过**，68.04 秒 | `drift-final.log` |

完整常规套件包含 UR2/UR3/UR4、U27、x2a/x3b、U03、存档续录与常规源码守卫。生成普查覆盖生成套件全部源码守卫与 CE 对照。本轮没有用定向拼接或串行复核替代完整套件；第一次中止的 full 与最终完整通过结果分别保留。

门禁前后 `src/` + `scripts/` **578 文件**的有序路径/字节 SHA-256 完全一致：`3a4ab01e50a7a3b2765524b09d32cc0ed509b5d2832177d08578c443ce4316ba`（`freeze-before.json` / `freeze-after.json`，`gates-state.json: unchanged=true`）。结束后仅更新报告与 progress。`git diff --check` 通过；本轮改动文件无 CRLF、无超过 1 MB 的文件、无截图，`src/test/fixtures` 与 HEAD 逐字节相同，生成基线与黄金 trace 未重录。产物检查在 `artifact-audit.json`。HEAD 和分支未变，index 无 staging，未 commit/push。

## Claude 浏览器稳定复现

标准 Playwright 客户端已尝试，但 Chromium 被 macOS MachPort `bootstrap_check_in: Permission denied` 拒绝（`playwright.log`），Vite 监听也被沙箱 EPERM 拒绝（`vite.log`），没有有效截图。真实 Vue 客户端宿主测试不代表 Pixi/四视口/物理触摸验收；按任务书交 Claude。

1. 在本工作区运行 `npm run dev`，打开页面，正常开始新游戏。
2. 控制台构造稳定场景，并通过正式命令进入瞄准：

   ```js
   const { setupDialogD4Scene } = await import('/src/test/support/dialogD4Scene.ts');
   const game = window.activeGame;
   game.startNewGame({ seed: 33441 });
   const { item, aim } = setupDialogD4Scene(game, true);
   game.executeItemCommand('use', item);
   for (let i = 0; i < 10; i++) game.executeCommand('move', { x: 1, y: 0 });
   game.update();
   ```

3. 玩家在 (10,10)，已知熔岩在 (13,10)，光标在 (20,10)。已知法器种类但实例射程未知，E=2 的实际安全落点为 (16,10)。按一次 Enter，或点击目标栏“确认”，或触屏点当前光标格；应显示“射程未知，仍要跨越熔岩瞬移吗？”界面内确认，默认聚焦否，无浏览器原生框。
4. 等待超过六秒，查看 `JSON.parse(window.render_game_to_text())` 中 pendingCommand/确认文本；玩家位置、两充能、时钟保持。旧 Enter/方向键 repeat、旧指针释放以及背景点击都不能批准。期间菜单保存反馈等待完成，导出不能截出部分命令。
5. 先释放触发键，再用新的 n/Esc/Space 或“否”：选择关闭，仍在 (10,10)、两充能、零费用；本条事件 action 为 `arcana:risk-confirm`，decisions=[false]。重新新局并重新布景，以新的 Enter/y 或“是”批准：到 (16,10)，一充能、一回合，事件仅一次且 decisions=[true]。
6. 桌面/平板/手机竖横屏，沉浸开/关，动画开/关复验；验证连续双击、触摸合成 click、取消后的旧持有不再移动，新输入可正常行动。返回标题/新局后旧 token 不可回答。

该布景明确撤销从 seed 开始的完整录像资格；不能把其导出称为自然完整局。引擎协议回放测试使用显式同 seed 布景重建（与 D2 同口径），存档续录测试保持前缀与实际检查点校验；自然局的完整录像、全部黄金 trace 另由原回归/全量门禁覆盖。
