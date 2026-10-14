# Phase 5 UI 修复报告

日期：2026-10-14。工作树：`BrogueJS-p5`，分支 `ext/phase5`，基线 `6cabb05`。按 `p5-ui-fix.task.md` 完成 P1/P2；保留此前中断时的改动继续实施，未 commit/push。

## P1：只读营地投影触发回滚通知并重入

### 根因与复现

问题不是 9×9 选址本身的计算规模。仅用真实 Game 调用营地投影或独立挂载 SettlementPanel，缺少实际画布和消息时间线宿主时，无法覆盖故障路径。

真实调用链如下（行号对应本次交付）：

1. `src/ext/modules/settlement/ui/useSettlementUi.ts:73` 的 `read()` 读取营地视图；同文件 `:397` 将刷新注册为 DialogService source。
2. `src/engine/Core/StructureProduction.ts:894` 读取居民配方目录。`src/engine/Core/ResidentOrders.ts:59–67` 在 crafting 启用时，用 `checkpointResidentWorld()` 包裹可选提供者查询，finally 无条件恢复。这是原有防提供者越权写入的事务保护，不能删除。
3. `src/engine/Core/Game.ts:13937` 创建居民检查点；其基础世界恢复在 `:14141` 调用 Logger 恢复，然后外层 `:13957` 才恢复 stat session。
4. `src/engine/Systems/Logger.ts:197` 调用展示观察器的恢复。旧 `src/ui/presentationTimeline.ts:71–75` 无条件 `notify()`，即使这次查询完全没有修改展示状态。
5. `src/ui/dialogAcknowledgments.ts:16` 的时间线 changed 回调调用 `service.sync()`，再次进入模块投影。`DialogService.sync()` 的局部 syncing 标记只能阻止该轮 sync 自身继续嵌套，不能阻止从外侧投影的世界回滚进入新一轮 sync。
6. 在真实 GameCanvas 已经读取属性缓存的宿主中，该重入会读取／冻结 stat 行，外层随后恢复 stat session 时在 `src/engine/Core/WorldCheckpoint.ts:51` 报 `Cannot redefine property: stat`。画布选址绘制本身也在 `src/components/GameCanvas.vue:284` 经 `dialogInput.busy()` 同步 dialog sources，使普通投影测试遗漏了这条 UI 反馈路径。

因此更准确的描述是“只读查询的回滚无条件通知共享 dialog sources，在世界恢复中重入投影”；通知不直接调用画布绘制函数。headless 中确证的是重入导致的打开失败和异步异常，没有将它冒称为已录到浏览器永久阻塞的视频或 CPU trace。

新增 `src/test/ext_phase5_ui_open.test.ts` 使用真实 `Game.startNewGame()`、种子 7306、wizard、菜单同等的 `prepareModuleCreation` / `buildModuleCreationCommands`，growth 使用默认创建草稿生成命令（卫士／人类／无信仰）。有营地场景在真实开局后用既有 helper 准备合法场地，再经 `executeCommand` 建营；这是受控布景，不冒称自然游玩路线。

单变量反事实：保留全部新测试，只将 `src/ui/presentationTimeline.ts` 临时替换为 HEAD 原文件，选择 `actual GameCanvas|read-only checkpoint` 执行。结果 exit 1：七模块无／有营地两项失败，settlement 单开无／有营地两项通过，静默回滚用例失败（观察到 3 次多余 sync），2 个 unhandled `Cannot redefine property: stat`。共选中 5 项，3 fail / 2 pass；另外 32 项只是名称过滤未选。恢复修复后同路径通过。日志：`/tmp/p5-ui-counterfactual.log`。

### 修复及回归覆盖

生产修复仅在 `src/ui/presentationTimeline.ts:72–81`：恢复前比较所有已捕获的时间线字段，以及事件队列长度、顺序和不可变事件身份；原样恢复状态，仅当内容确有改变时通知。只读查询仍受到完整世界／RNG／实体 ID／属性 session 回滚保护，但不再因为同值恢复产生 UI 通知。真正删除试探消息、撤销 ACK 的回滚继续通知，不吞掉异常或放宽 WorldCheckpoint 守卫。

新增或扩展测试：

- 真实营地 SFC：七模块／settlement 单开 × 无／有营地；开关面板、81 格选址、build 光标与草稿追加、residents 页和重复刷新。
- 真实 GameCanvas SFC：上述四场景，真实 `useModuleUi`、dialog commands/ACK sources、dialogInput、地图绘制和帧循环。只替换 GPU Application/Text 与 DOM 平台设施，保留真实 Pixi Container/Graphics 和生产 GameCanvas CPU 路径。连续 10 次请求渲染并 `advanceTime(1)`，断言投影最大嵌套深度为 1、读取次数有界、面板可打开和关闭。
- 真实 CommandBar 点击到七模块共享 UI 的营地入口。
- 七模块下合成、采食、角色面板的真实 SFC 打开／刷新／关闭。
- 上述面板循环限时 1000 ms（不含 Game 开局和 SFC 编译），检查 world5、RNG、实体 ID、录像事件数和回合完全不变；单测试硬超时 20 秒。
- `presentation_timeline.test.ts` 新增同值嵌套／重复恢复不通知、真正回滚试探 ACK 仍通知；保留原有 ACK 身份、消息顺序、回放与终局断言。
- 新测试按实际七模块依赖登记到 `scripts/test-dependencies.json` 和测试发现清单；未调整旧断言或守卫。

相关集合实测耗时（打开及重复刷新，毫秒，不含开局／编译）：

| 场景 | 独立营地 SFC | GameCanvas 宿主 | 画布循环投影次数／最大深度 |
|---|---:|---:|---:|
| 七模块，无营地 | 170.6 | 113.7 | 111 / 1 |
| 七模块，有营地 | 153.1 | 128.6 | 61 / 1 |
| settlement，无营地 | 13.4 | 18.3 | 31 / 1 |
| settlement，有营地 | 20.7 | 48.9 | 21 / 1 |

合成 11.2 ms、采食 5.3 ms、角色 160.5 ms，均低于 1000 ms。这里只是当前机器的回归用例耗时，不作为浏览器 FPS 或最大居民负载指标。

## P2：限制窄屏次要行，保留地图

旧 `src/App.vue:538` 的五行使用 `auto auto minmax(0,1fr) auto auto`；七模块 HUD、技能行和命令内容的自然高度先占空间，地图只拿剩余部分，最小可缩到 0。

改为只作用于非沉浸、含模块栏的 portrait 布局：

```css
grid-template-rows:
  fit-content(22%) fit-content(10%) minmax(40%,1fr)
  fit-content(10%) fit-content(18%);
```

子区域的滚动和排列样式放在既有 `src/assets/gameplay-layout.css:26`，App 只定义网格轨道。HUD、日志、技能和命令／方向键行的高度上限合计 60%；各次要区域设置 `min-height:0`、`overflow:auto`，不会因内容增多继续挤地图。技能模块横向排列，每个占一个栏宽；命令横向滚动，按钮至少 60×44 px；HUD／方向键等超出区域仍可滚动操作。附近列表继续使用既有窄屏抽屉入口。地图获得至少 shell 高度 40%，内容较少时继续获得剩余高度。桌面、横屏、沉浸模式的 grid 定义未改。

`gameplay_layout.test.ts` 编译实际 App SFC 的 scoped CSS，并合并检查共享布局 CSS，检查最终全局选择器、网格轨道、滚动／最小尺寸规则及实际 `computeLayoutMode`：

| 视口 | 布局 | 地图预算 |
|---|---|---|
| 390×844 | portrait | ≥337.6 px |
| 320×844 | portrait | ≥337.6 px |
| 800×991 | portrait | ≥396.4 px |
| 1440×900 | desktop | 原桌面五行定义与两列区域不变 |

上表为全高游戏 shell 的 CSS 下限推导，不是浏览器实测像素。营地抽屉打开时，既有 SettlementPanel 会缩短 shell；此时保留缩短后 shell 的 40%，未覆盖地图与抽屉共用视口的既有行为。测试保留已有单 Canvas、命令可达、抽屉 Escape、可见性投影断言。

## 门禁与验证边界

所有命令使用 Node 24.19.0：

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
node node_modules/vitest/vitest.mjs run \
  src/test/ext_phase5_ui_open.test.ts src/test/gameplay_layout.test.ts \
  src/test/presentation_timeline.test.ts src/test/dialog_continuations.test.ts \
  src/test/dialog_host.test.ts src/test/dialog_service_input.test.ts \
  src/test/dialog_d4_blink.test.ts src/test/phase4a3_body_sfc.test.ts \
  src/test/ext_generation_checkpoint.test.ts src/test/ext_checkpoint_imports.test.ts \
  src/ext/modules/settlement/tests/settlement_ui.test.ts \
  src/ext/modules/settlement/tests/settlement_camera.test.ts \
  src/ext/modules/settlement/tests/settlement_inventory_ui.test.ts \
  src/ext/modules/settlement/tests/resident_production_food.test.ts \
  src/ext/modules/settlement/tests/resident_production_codec.test.ts \
  src/ext/modules/settlement/tests/resident_replay_import_ui.test.ts \
  src/ext/modules/crafting/tests/crafting_ui.test.ts \
  src/ext/modules/foraging/tests/foraging_ui.test.ts \
  src/ext/modules/growth/tests/ext_growth_ui.test.ts --maxWorkers=2
npm run check:modules
node node_modules/vue-tsc/bin/vue-tsc.js -b
npm run build
git diff --check
```

实际结果分批记录，不把重叠测试数相加：

| 门禁 | 结果 | 日志 |
|---|---|---|
| 首轮相关集合（上述 19 文件） | exit 1；714 pass / 1 fail；0 skip / todo / unhandled | `/tmp/p5-ui-related.log` |
| 布局收尾后受影响两文件复测 | exit 0；2 文件 47 pass；0 skip / todo / unhandled | `/tmp/p5-ui-layout-final.log` |
| boundary + 测试依赖检查（最终源码） | exit 0；errors 为空 | `/tmp/p5-ui-final-boundary.log` |
| vue-tsc（最终源码） | exit 0 | `/tmp/p5-ui-final-types.log` |
| build（最终源码） | exit 0；Vite 3.39 秒，保留大 chunk 提示 | `/tmp/p5-ui-final-build.log` |
| `git diff --check` | exit 0 | 无错误输出 |

首轮唯一失败是原 `ext_growth_ui.test.ts:751` 的布局守卫：它禁止 App 的模块网格定义区出现 `display`。本次起初把子区域 `display:flex` 也放在 App，因此触发。已将滚动／子区域排列规则移至既有共享 `gameplay-layout.css`，App 仅保留轨道定义；新布局测试同时读取两个实际生产样式来源。原守卫及断言没有改动。复测命令：

```sh
node node_modules/vitest/vitest.mjs run src/test/gameplay_layout.test.ts \
  src/ext/modules/growth/tests/ext_growth_ui.test.ts --maxWorkers=2
```

上述 47 项包含首轮失败项，已关闭；其余源码和测试保持首轮通过状态，未将这次局部复测写成新的“19 文件一次全绿”。前期夹具缺少 DOM focus／window 定时器等失败已修正，不充作产品回归证据；有意义的旧生产反事实失败另见 P1。

浏览器限制：按 develop-web-game 技能运行官方 Playwright client，Chromium 在导航前即因 macOS `MachPortRendezvousServer ... Permission denied (1100)` 退出 1（`/tmp/p5-ui-playwright.log`）；本地 Vite 5199 监听此前亦被沙箱 EPERM 阻止。浏览器连接曾断开，原生 Google Chrome 控制另被自动审批拒绝，原文为 “Computer Use was not approved to use Google Chrome.” 没有取得本候选的浏览器截图或真机触控证据。此次完成任务书允许的 SFC／布局验证，浏览器抽样仍由维护者执行；未借用另一工作树 localhost:5196 的页面作为本次验证。

未执行完整 npm test／test:ext／drift、CE 对照或删除矩阵，符合本任务限定门禁。未修改规则、Game 状态字段、存档／录像格式或生成基线，未新增玩家文本。截图与大体积原始证据未写入仓库。
