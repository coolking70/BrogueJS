# DESIGN-2 本地评审整改

日期：2026-10-01。工作区：BrogueJS-newtheme，design/new-theme，基于 5ee4630。

用户浏览器已确认原五项基本修好；本轮继续修复反馈 A（codex 偏好污染）与 B（umbra 浮层遮挡），并在最终代码上重跑轻档门禁。浏览器截图继续由用户验收。

## 修改与根因

| 问题 | 根因 | 改动 |
|---|---|---|
| umbra / ember 黑边 | 外壳 CSS 已让地图容器占满可用区域；原 `computeMapLayout` 的 uniform 适配仍受长宽比和只缩不放约束，完整地图居中产生空白。 | `src/components/GameCanvas.vue` 仅向这两套主题传 `fillViewport`；`src/ui/mapCamera.ts` 按实际容器尺寸等比覆盖并跟随，不拉伸方格。小屏仍保持可读格尺寸。显式“整图”仍保留完整地图概览。 |
| 展开工具栏遮挡 HUD | 工具栏 fixed 在顶部，新主题却固定 `--lab-h:0` 和外壳高度 100dvh。 | `src/components/UiLabToolbar.vue` 用 ResizeObserver 测量实际展开高度（覆盖换行/resize），只在展开的新主题登记 `--shell-toolbar-height`。`src/assets/theme-shells.css` 下推并缩短外壳，同步菜单/抽屉及工具栏弹层位置；收起仍为原角落按钮。 |
| codex 玩家贴底 | GameCanvas 已使用真实画布容器尺寸，侧栏/底部行由 grid 扣除；问题是严格边界钳制，且自动钳制修正被当作 pan 写回，后续 resize 可沿用过时修正。 | `src/ui/mapCamera.ts` 仅 codex 跟随允许三格地图外余量，以钳制后的跟随原点计算用户 pan；无拖动时不把自动修正留在 pan 中。`src/App.vue` 进入 codex 清平移，退出恢复进入前的 zoom/fit/pan。 |
| zen 桌面无命令入口 | App 仅在 showTouch 时挂载命令环，而 zen CSS 隐藏常规命令栏。 | `src/App.vue` 在非回放的 zen 中均挂载 RadialCommands；`src/assets/theme-shells.css` 展开时把圆环移入视口，`src/components/theme/RadialCommands.vue` 捕获指针以保留拖选。全部命令仍经 `ui/commands.dispatch`。 |
| 回合不刷新及同类响应式问题 | 引擎单例不响应式，ThemeHud 的 computed 仅依赖 hp；ThemeLog 的 `props.lines` 又被当作初值传入轮询。 | `src/ui/useGameHud.ts` 每 100ms 轮询回合 ref，`src/components/theme/ThemeHud.vue` 直接使用。ThemeLog 改传 props getter，轮询时 toValue 读取最新行数，切主题和展开 zen 日志均可更新。 |
| A：codex 临时 zoom 污染全局偏好 | `mapCamera.ts` 对所有 zoom 变动统一写 localStorage，无法区分主题强制赋值和用户全局偏好；原 App 的退出恢复只修复会话内镜头，刷新前已保存了 2。 | `src/ui/mapCamera.ts` 用 `setCodexCamera` 管理主题进入前的 zoom/fit/pan 快照；主题内禁止保存缩放，退出先恢复再释放临时状态。保存 watcher 同步判断临时状态，避免同一 tick 的进入/退出或异步恢复漏写。`src/App.vue` 调用该边界，卸载时也恢复。 |
| B：umbra 玩家被浮层遮挡 | 覆盖模式只保证画布尺寸，没有避开浮层；地图高度等于视口时，严格纵向边界钳制使底部玩家无法离开命令坞。 | 新增 `src/ui/mapOcclusion.ts` 读取 HUD、实体面板、命令坞、日志、方向盘、缩放钮、目标栏/命令展开层的实际矩形，换算到画布坐标。`src/components/GameCanvas.vue` 仅 umbra 启用浮层 ResizeObserver / MutationObserver。`src/ui/mapCamera.ts` 按玩家及左右三格所在范围，选最长的无遮挡纵向区间，并允许纵向三格地图外余量；横向仍按完整画布覆盖并严格钳制，不新增左右黑边。覆盖镜头的自动边界修正不再写成用户 pan，浮层变高和 resize 后仍正确跟随。 |

## A / B 的取舍

codex 内手动缩放、滚轮/捏合和“整图”都仅在本次主题会话有效，与强制跟随采用同一口径。离开或卸载恢复进入前的镜头；刷新 codex 则重新从全局偏好开始，再临时放大到至少 2。这样临时侧栏布局不会改变其它主题的偏好，用户仍可在其它主题设置持久化缩放。

此前已污染的 `{"zoom":2}` 与合法的用户 2 倍偏好无法区分，故没有自动清除。若需要重设，在 codex 以外的任意主题点一次“整图”，会把持久化 zoom 重设为 1。

umbra 默认自动跟随的目标是保留完整玩家格和上下三格；测量以实际浮层尺寸为准，不写死桌面 HUD 高度或手机换行数。侧面板仅在与玩家及相邻格横向重叠时影响纵向安全区，避免整张地图都被宽侧栏挤缩。必要时上下会显示地图外背景余量，横向仍铺满。空间不足的横屏/高缩放场景会把玩家放到最大可用区间中央，周围可见格数受实际剩余高度限制。显式“整图”和手动拖动仍遵从用户概览/平移意图；下一次玩家移动清平移并恢复安全跟随。

## 回合口径核对

读取已有 CE 参照 `/Users/coolking70/.codex/worktrees/playtest-fixes/BrogueJS/.ce-reference/BrogueCE-master/src/brogue/Time.c:2494-2503`，未执行 ce:fetch。

CE 的 `rogue.playerTurnNumber` 仅在非麻痹时递增，对应本项目 `logger.turn`（TimeCoordinator.playerTurnEnded）；`activeGame.stats.turns` 在 finishTurnEpilogue 中递增，包含强制麻痹结算，不是严格相同的玩家回合计数。HUD 采用 logger.turn，与消息编号一致。`absoluteTurnNumber` 是本项目客观 100-tick 调度时钟，不能代替玩家回合。

旧主题没有独立实时回合 HUD；消息编号读 LogMessage.turn（来自 logger.turn），结算页轮询复制 activeGame.stats 后显示 stats.turns。没有修改旧主题的这些行为。ThemeKit/ThemeNearby 已直接轮询 ref，没有发现同样的 computed 依赖错误。

## 新测试与范围

新增回归共 22 项：

- `src/test/theme_shell_fixes.test.ts`：20 项。原 14 项覆盖覆盖视口、codex 边缘与 resize、旧默认布局、工具栏、动态日志、回合/RNG、命令环 dispatch；本轮新增桌面/手机 umbra 边缘玩家及三行余量、横屏侧命令坞、种子 12345 开局/RNG、遮挡合并/区间选择、真实坐标换算与观察器更新/清理。
- `src/test/theme_camera_preferences.test.ts`：2 项。覆盖初始主题强制放大、主题内手动缩放/整图、恢复 zoom/fit/pan、刷新读取原偏好、其它主题正常保存、重复进入与同一 tick 快速切换。独立文件隔离重新加载模块，避免影响已编译命令环持有的 Input 单例。

该测试使用 Vue 自定义 host renderer。Vitest 的 Node SFC 转换为 SSR，因此按已有 x3_u5_ui 流程编译同一生产 SFC 的客户端脚本/模板；用 I18NextVue 安装真实 TFunction，修复原第 95 行品牌类型错误。未修改任何已有测试的前提、断言、容差、超时或 skip。

未改 src/engine、src/entities、src/data；未增加 Game 字段或随机数调用。未新增玩家可见文案，全部沿用已有 i18n 键。未重录基线/trace，未产生 CRLF，未 commit/push。

## 轻档门禁

最终原始日志与命令清单在 `/tmp/brogue-theme-fixes/`，gate-state.json 登记实际退出码及完整 argv。

| 门禁 | 最终结果原文 | 退出码 |
|---|---|---|
| npx vue-tsc -b | 无诊断输出 | 0 |
| npm run build | `✓ built in 1.98s` | 0 |
| 指定及相关前端 27 文件 | `Test Files  27 passed (27)` / `Tests  391 passed (391)` | 0 |
| 补充源码守卫 13 文件 | `Test Files  13 passed (13)` / `Tests  21 passed | 238 skipped (259)` | 0 |

补充守卫的 238 skipped 是 testNamePattern 排除的非源码守卫/生成普查用例；没有改测试 skip。完整前端 391 项没有 skipped。新增回归 22 项全部包含在最终前端门禁中。构建有现存的大 chunk 提示，没有类型/构建错误。

本轮 `rg` 反查相关组件与镜头，沿用原相关前端文件并加入偏好测试；重新普查源码读取测试，补充源码守卫仍为原 13 文件/21 项。仅读取 CE oracle、黄金 trace 等夹具或用 JSON 构造运行场景的测试不属于源码扫描守卫。普查候选在 `/tmp/brogue-theme-fixes/ab-guard-search.json`。上一轮日志保留在 `round-1/`，本轮日志在上述目录根部。

类型检查：`npx vue-tsc -b`。

构建：`npm run build`。

指定测试及 grep/rg 反查到的相关前端测试（完整文件）：

```sh
npx vitest run \
  src/test/ui_concepts.test.ts \
  src/test/c_4a_terrain_catalog.test.ts \
  src/test/p1_30_i18n_gate.test.ts \
  src/test/u24_hardcoded_text.test.ts \
  src/test/repo_hygiene.test.ts \
  src/test/ui_1_rendering.test.ts \
  src/test/ui_2_protection.test.ts \
  src/test/i_1_interaction.test.ts \
  src/test/fe_1_touch.test.ts \
  src/test/r_1_appearance.test.ts \
  src/test/p2_4_animation_cadence.test.ts \
  src/test/ux_1c_display.test.ts \
  src/test/p2_0_seeded_rng.test.ts \
  src/test/x4a_movement_rendering.test.ts \
  src/test/map_tile_modes.test.ts \
  src/test/vector_atlas.test.ts \
  src/test/c_7_lighting.test.ts \
  src/test/x4b_flavor_text.test.ts \
  src/test/ux_1c_hallucination_display_rng.test.ts \
  src/test/p2_6_display_settings.test.ts \
  src/test/gameplay_layout.test.ts \
  src/test/theme_shell_fixes.test.ts \
  src/test/theme_camera_preferences.test.ts \
  src/test/x3_u5_ui.test.ts \
  src/test/x3_u6_messages.test.ts \
  src/test/ux_1a_end_ui.test.ts \
  src/test/x3_u8a_forced_turns.test.ts \
  --maxWorkers=2
```

补充源码守卫用 `npx vitest run <下面文件> --testNamePattern <守卫全名组成的正则> --maxWorkers=2`；完整 argv 在 `/tmp/brogue-theme-fixes/source-guards-command.json`，用例清单在 `source-guards-selection.json`。仅选源码守卫，不执行这些文件内的生成普查等重测试。

- `src/test/b_1a_identification.test.ts`
- `src/test/c_4a_0_layer_model.test.ts`
- `src/test/c_4b_dungeon_feature.test.ts`
- `src/test/c_4c_promotion.test.ts`
- `src/test/p1_42_secret_door_search.test.ts`
- `src/test/p2_1_tick_architecture.test.ts`
- `src/test/u_01_instance_snapshot.test.ts`
- `src/test/u_03_whole_run_snapshot.test.ts`
- `src/test/v_1a_blueprint_items.test.ts`
- `src/test/v_2b_4_altars.test.ts`
- `src/test/v_2b_9b_environment.test.ts`
- `src/test/w_7_arcana_enchantment.test.ts`
- `src/test/x2b_terrain_derivation.test.ts`

没有运行完整 npm test、ce:fetch、test:full 或 drift。

## 浏览器验收状态

用户已反馈工具栏下推、ember 无黑边、codex 底部留边、回合刷新、zen 桌面命令环均通过。本轮 A / B 未由执行方做真实浏览器截图；按用户指示留给用户在 1280×800、390×844、seed12345 下复核，重点是 codex 进入/手动缩放后其它主题刷新，以及 umbra 开局、地图上下边缘和实体面板变高后的避让。

自定义 host renderer、存储与几何回归不能替代 CSS/Pixi 的真实截图验收。umbra/ember 的等比覆盖会裁去视口外的地图部分；“整图”概览允许留白。codex 的三格地图外余量保持上一轮做法，旧三主题未增加覆盖/遮挡参数或浮层观察器。
