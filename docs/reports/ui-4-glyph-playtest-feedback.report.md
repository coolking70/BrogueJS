# UI-4 刻符界面试玩反馈整改报告

日期：2026-10-02。任务书：[ui-4-glyph-playtest-feedback.md](../tasks/ui-4-glyph-playtest-feedback.md)。工作区 `/Users/coolking70/Documents/同步空间/BrogueJS-newtheme`，分支 `fix/glyph-ui-feedback`，执行基点 `b0860eb`。

五项实现已完成，仅涉及 Vue 组件、CSS、UI 显示辅助函数与中文文案。没有修改规则、Game 字段、存档/录像格式、随机流、生成基线或黄金 trace；没有 staging、commit、push 或提交截图。用户明确本轮浏览器不可用、截图由用户完成，因此下述几何与组件检查不代表实际浏览器视觉验收。完整 `npm test` 按任务书留给 Claude。

## 1. “更多”扩展命令

根因：`gameplay-layout.css` 的扩展层使用 `position:absolute; bottom:calc(100% + 8px)`，CommandBar 根节点没有定位属性；包含块落到 `position:relative` 的 App，而非命令栏。任务书记录的负 top/bottom 与这一执行路径一致。

改为固定视口定位，直接读取“更多”按钮矩形，在按钮上方保留 8px 间距，并约束左右/顶部边距与最大高度。考虑 `visualViewport` 的尺寸和偏移；监听窗口缩放、滚动、布局模式变化及 ResizeObserver，并在关闭/卸载时注销观察。扩展层使用 `border-box`，不受横屏命令栏滚动容器裁切。沉浸桌面展开面板的按钮较靠上，空间不足时扩展层内部滚动，六个命令仍可到达。命令继续经原 `dispatch` 入口执行，Escape、外部 pointerdown 关闭保持。

回归覆盖 1280×800、768×1024、390×844、844×390，分别检查底部按钮和高位沉浸按钮；另检查窄视口、visualViewport 偏移、实际组件按钮矩形接线、resize、关闭、监听清理。1280×800、按钮 top=754/right=1280、面板高度 140 的计算结果为 left=982/top=606/bottom=746，面板完整处于视口中。该结果是矩形合同测试，不是浏览器实测。

## 2. 位置描述行与日志抖动

根因：普通布局的 `.tl-flavor.empty{display:none}` 删除空行的布局占位；消息列表没有固定高度。沉浸单行使用 `v-if` 在有消息时删除 flavor，并对空列表使用 `display:none`。

flavor 节点始终存在，空文字使用 `visibility:hidden`，固定 25px 内容槽与 4px 外边距；多行列表按布局传入的行数固定为每行 22px，消息不足时保留空槽。沉浸单行的描述与最新消息位于同一个 grid 单元，通过可见性切换，底部消息区仍固定 32px 加安全区。临时展开的多行消息面板也使用固定目标高度与视口上限，内部列表可滚动，消息条数不会改变地图位置。

真实组件回归检查无消息/一条/多条/清空、描述出现/消失时，同一个 flavor 节点和行数样式不变；CSS 回归检查固定高度、空行占位和单行重叠槽。旧单行测试的必要前提修订及反事实见第 6 节。

## 3. “面板”按钮的实际用途与处理

原 App `toggleThemePanel` 在普通桌面会打开额外的 ContextPanel；它重复展示已常驻左栏的周围实体与悬停信息。紧凑布局则切换右侧 SideDrawer，显示原 ContextPanel；沉浸布局切换临时信息浮层，显示周围实体、多行消息及桌面扩展命令栏。

普通桌面不再显示这个按钮。紧凑与沉浸布局保留，文字改为“周围信息”/“收起信息”，提示为“展开周围实体与检视信息”，均走 i18n。App 回归覆盖 desktop/portrait/landscape 与沉浸开关的组合，检查显隐、展开/关闭与世界快照不变。

## 4. 点击消息区打开完整日志

ThemeLog 整个消息区可点击，也可聚焦后 Enter 打开；原小按钮调用同一事件并停止冒泡，避免重复打开。仍使用 App `journalOpen` → SideDrawer 的 journal 变体 → MessageJournal，没有创建第二套日志系统。

日志保持原来的最新消息在前顺序，每次挂载/重新打开滚到顶部最新消息；100ms 更新不会把已经滚动阅读的用户拉回顶部。日志容器改为 `border-box`，修正原 `height:100%` 另加 padding 导致超出抽屉的问题。原生滚动区域使用常驻滚动空间，Chromium/WebKit 配置 12px 明确轨道和滑块；其它浏览器用标准 scrollbar 属性。Chromium 路径避免标准非 auto 颜色覆盖 WebKit 尺寸样式。使用原生滚轮与滚动条拖动，触屏 `pan-y`，overscroll 限于日志区。

复用抽屉原有 Escape、背景点击、关闭按钮。回归检查整个消息区事件、每次打开到最新、阅读位置不被轮询重置、三种关闭与完整快照/双 RNG/录像事件不变。原生鼠标拖动和触屏实际手感待用户浏览器验收。

## 5. 周围实体点击详情

先核查原检视路径：`GameCanvas.vue:839` 的右键与 `:906` 的长按直接调用 `game.handleInspectAt`；`Game.ts:2019` 生成怪物/物品详情并赋给已有的 `inspectTarget`，不经过 `executeCommand`，不调用回合推进，也不记录输入。另一个 Tab/`examine` 的循环检视走命令边界，调用 `handleExamineNearest`，并维护已检查实体集合。本次沿用前者的纯显示模型路径，不使用会修改循环集合的后者。

新增 `ui/nearbyInspection.ts`：重新通过现有 `sidebarEntityRows` 验证当前可见性、类型、身份和坐标，拒绝已移动、消失或隐藏的旧轮询行；怪物与物品复用 `generateMonsterDetail` / `generateItemDetail` / `createItemDetailContext`，参数口径与原鼠标检视一致。楼梯等地形使用已有安全 `describeTerrain` 和本地化内容描述，包含 D1 出口口径，不泄露未知/秘密地形。

ThemeNearby 和紧凑抽屉的 ContextPanel 每项使用原生 button，支持聚焦与 Enter，隔离按键与游戏输入。组件只接收显示详情并 emit；App 存在局部 `nearbyInspection` 中，传入既有 DetailPanel，完全不写引擎状态或 `Game.inspectTarget`。DetailPanel 保留原检视入口，新增只针对局部详情的显示模态；其键盘优先级高于底下的抽屉，关闭按钮、背景与 Escape 都恢复原列表项焦点（该项仍存在时）。

回归逐一比较怪物、物品详情与原 `handleInspectAt` 输出；检查楼梯文字、旧行拒绝、三类实体完整存档快照、双随机流、命令事件、原检视字段、悬停、已检查集合、disturbed 全部不变。实际 Vue 接线覆盖普通 App、沉浸展开 App、紧凑抽屉，并验证详情中按游戏键没有派发命令、关闭后焦点返回列表。

## 6. 测试变更与失败归因

- 新增 `src/test/ui_4_glyph_feedback.test.ts`，23 项展开后的回归，覆盖全部五项。使用真实生产 SFC 的客户端脚本/模板/生命周期与 Vue host renderer；不模拟浏览器原生布局，不以它替代截图。
- 唯一旧测试修订：`immersive_polish.test.ts` 的单行日志测试原先用“flavor DOM 不存在”表示“有消息时 flavor 不可见”。新生产代码下原测试失败（`/tmp/ui4-first-existing.log`，2 文件中 1 项失败/17 项通过）；仅回退 `ThemeLog.vue` 的生产字节、保持其它生产文件与原测试，原测试通过（`/tmp/ui4-log-counterfactual.log`，1 项通过，退出 0），finally 恢复新文件。随后只把该观察前提改为持久 flavor 节点的 `aria-hidden=true`；最新消息单行与日志打开事件断言未改。新增 CSS/组件回归另外约束固定占位和实际隐藏规则。没有删除测试、放宽断言/容差、增加 skip、调整超时或改守卫白名单。
- 新测试装配首轮缺 TargetBar 模块映射，随后发现 host 节点被 Vue 深代理及日志 comment 节点索引前提；仅修新增夹具，使用完整模块映射、markRaw 的 host 节点和按 class 找最新条目。日志分别保留 `/tmp/ui4-new-first.log`、`/tmp/ui4-new-second.log`；修正后 21 项通过，追加 App 接线后 23 项通过。
- 首轮正式相关批次退出 1：22 文件中 21 通过/1 失败，343 项通过/1 失败，唯一为 i18n 的 `theme.panel_hint` 被判死键。原因是模板属性中三元调用未被现有扫描器识别；改生产 ThemeHud 的 computed 字面量 `t()`，没有修改守卫。复核 3 文件/58 项通过。原日志和冻结状态保留 `/tmp/ui4-initial-gates/`。

## 7. 最终门禁与原文

所有命令在仓库根执行，相关批次与源码守卫串行运行，未同时启动重门禁。最终代码/测试/脚本/资源的前后 SHA256 均为 `988d63632cc2f0ef80a74e95c89393896dde824f349c8ccc99e7ad75dfac7539`（`src/`、`scripts/`、`public/` 按路径排序后对路径与原字节累计）。冻结状态 `/tmp/ui4-gate-state.json`，完整 argv `/tmp/ui4-gate-commands.json`。补充 R-1 后源码仍未修改。

### 类型与构建

`npx vue-tsc -b`：退出 0，无输出，`/tmp/ui4-typecheck.log`。

`npm run build`：退出 0，`/tmp/ui4-build.log`，原文节选：

```text
> brogue-web@0.2.0 build
> vue-tsc -b && vite build

vite v7.3.1 building client environment for production...
✓ 951 modules transformed.
✓ built in 2.29s
```

构建保留既有“部分压缩 chunk 大于 500 kB”提示，没有隐藏提示或修改阈值。

### 完整相关前端/检视批次

覆盖任务书点名的 c_4a、p1_30、u24、repo_hygiene、ui_1、ui_2、i_1、fe_1，及 `rg` 反查的 CommandBar、ThemeLog、ThemeNearby、MessageJournal、DetailPanel、SideDrawer、检视和详情相关文件。命令：

```sh
npx vitest run \
  src/test/armor_display_effect.test.ts src/test/c_4a_terrain_catalog.test.ts \
  src/test/fe_1_touch.test.ts src/test/gameplay_layout.test.ts \
  src/test/i_1_interaction.test.ts src/test/immersive_mode.test.ts \
  src/test/immersive_polish.test.ts src/test/p1_30_i18n_gate.test.ts \
  src/test/p2_6_display_settings.test.ts src/test/repo_hygiene.test.ts \
  src/test/theme_shell_fixes.test.ts src/test/u24_hardcoded_text.test.ts \
  src/test/u_00_new_run.test.ts src/test/u_10_absorption_snapshot.test.ts \
  src/test/ui_1_rendering.test.ts src/test/ui_2_protection.test.ts \
  src/test/ui_4_glyph_feedback.test.ts src/test/ui_concepts.test.ts \
  src/test/x3_u5_ui.test.ts src/test/x4_r4_item_details.test.ts \
  src/test/x4_r6_integration.test.ts src/test/x4b_flavor_text.test.ts \
  --maxWorkers=2
```

退出 0，`/tmp/ui4-related.log` 原文：

```text
 Test Files  22 passed (22)
      Tests  344 passed (344)
   Start at  02:32:29
   Duration  115.58s (transform 1.64s, setup 0ms, import 9.31s, tests 174.52s, environment 4ms)
```

其中新增 23 项回归全部通过。测试进程的 `--localstorage-file` 环境提示保留在原日志中。

### 补充源码守卫

`rg` 查找读取源码的测试，再用 TypeScript AST 选择 70 文件内 99 个读取守卫/源码对照定义，参数化标题按其展开名称匹配。读取黄金 JSON 等夹具的普通行为测试不作为源码守卫全跑；未选用例不等于新增 skip。选择清单、正则、文件清单和执行脚本分别为 `/tmp/ui4-source-guards.json`、`/tmp/ui4-source-guard-pattern.txt`、`/tmp/ui4-source-guard-files.txt`、`/tmp/ui4-source-guards.cjs`；`ui4-gate-commands.json` 记录完整 `npx vitest run <70 files> --testNamePattern <pattern> --maxWorkers=2` argv。

退出 0，`/tmp/ui4-source-guards.log` 原文：

```text
 Test Files  70 passed (70)
      Tests  105 passed | 1471 skipped (1576)
   Start at  02:34:25
   Duration  55.77s (transform 2.11s, setup 0ms, import 29.29s, tests 64.35s, environment 14ms)
```

共享读取函数补查后，实例字段、环境 DF、内容目录和 CE 地形字段的守卫另跑：

```sh
npx vitest run src/test/u_01_instance_snapshot.test.ts \
  src/test/v_2b_9b_environment.test.ts src/test/x4_r5_content_text.test.ts \
  src/test/v_2b_9c_effects.test.ts \
  --testNamePattern 'field coverage: declarations|bulk promote uses the common|covers every current web terrain|55 retains CE data|seven tiles retain all CE flag' \
  --maxWorkers=2
```

退出 0，`/tmp/ui4-helper-guards.log` 原文：

```text
 Test Files  4 passed (4)
      Tests  5 passed | 36 skipped (41)
   Start at  02:35:21
   Duration  1.78s (transform 1.01s, setup 0ms, import 2.63s, tests 47ms, environment 1ms)
```

R-1 有在 describe 中共享读取 GameCanvas 源码的守卫，再跑完整文件：`npx vitest run src/test/r_1_appearance.test.ts --maxWorkers=1`，退出 0，`/tmp/ui4-shared-source-guards.log` 原文：

```text
 Test Files  1 passed (1)
      Tests  45 passed (45)
   Start at  02:37:13
   Duration  411ms (transform 248ms, setup 0ms, import 302ms, tests 9ms, environment 0ms)
```

源码批次的 1471 项、共享读取批次的 36 项 skipped 均来自名称筛选，不是改测试代码或完整套件的跳过结果。各批次有交叠，不能相加冒充全量通过数。

### 仓库检查

`git diff --check` 通过；本轮所有修改/新增文件无 CRLF，未添加截图或 >1 MB 原始证据。原本未跟踪的任务书保持原状态；全部改动未 staging、commit、push。

## 8. 用户/Claude 验收项

按任务书由验收方完成完整 `npm test`，并在 1280×800、768×1024、390×844、844×390 的默认/沉浸布局下检查“更多”位置、空/非空信息行和地图稳定性、周围信息按钮、完整日志的可见原生滑块/滚轮/拖动/触屏滚动、怪物/物品/楼梯详情及键盘焦点。高位沉浸命令面板可内部滚动。截图和 >1 MB 原始日志留在本地，不入仓库。

本轮是纯表现层，未运行 CE fetch/full 或 test:drift；没有声称已完成完整测试或浏览器验收。采用 develop-web-game 的小步实施/验证方法，用户本轮明确指定浏览器不可用，故未新增浏览器时间推进钩子或尝试 Playwright 启动。
