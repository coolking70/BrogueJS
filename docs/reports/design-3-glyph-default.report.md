# DESIGN-3：刻符唯一界面与沉浸模式

日期：2026-10-01。工作区：`/Users/coolking70/Documents/同步空间/BrogueJS-newtheme`，分支 `design/new-theme`，基点 `bec53f9`。依据：[任务书](../tasks/design-3-glyph-default.md)、AGENTS.md、HANDOFF / development / architecture。未 commit、未 push。

## 实现结果与删除清单

- glyph（刻符）成为唯一界面。`src/ui/concept.ts` 只初始化固定的 `html[data-ui-concept="glyph"]`，不再导出选择状态、主题枚举或切换函数。保留固定 CSS 作用域可以沿用原刻符的浮层样式，降低本次删除的覆盖风险；生产代码中不存在其它主题分支。
- 删除 `src/components/UiLabToolbar.vue` 及 App 挂载；删除 `?concept=` 解析、URL 写入、偏好选择及 `registerConceptTool` / `select_ui_concept` WebMCP 注册。
- 删除 `src/assets/ui-concepts.css`。其中仍需要的菜单结构、响应式菜单、字体与浮层边界提取到 `src/assets/title-screen.css`；没有复制旧主题选择器、背景图片或切换栏占位。
- `theme-shells.css` 仅保留刻符配色、字体、外壳及沉浸布局；删除 classic / tactical / immersive / umbra / ember / codex / zen / manual 的主题令牌、选择器和特有效果。旧 zen 的布局改由 `.immersive-mode` 控制，删除随深度换强调色、zen 标题和背包配色。`gameplay-layout.css` 收敛为抽屉、日志、命令溢出及回放控件公共样式。
- 删除专属组件 `ThemeCodex.vue`、`ThemeKit.vue`，以及只为旧布局挂载、现已无生产调用的 `MobileHud.vue`、`MessageStrip.vue`。`ThemeNearby.vue` 仍服务于刻符的左栏与沉浸模式展开面板，保留其可见性模型。
- `MainMenu.vue` 固定刻符字标、标题和字形背景；`TitleFx.vue` 删除孢子、余烬、星图与网格分支，仅保留字形 Canvas 装饰。`ThemeHud.vue` 删除被删主题专用的分段条、深度带与深度刻度。
- `mapTileDrawing.ts` 将 `MAP_INK` 收敛为原 glyph 色值 `0xc9c2b0`，去掉绘制函数的主题参数；原版颜色、饱和危险地形、生物状态色、白色地形纹理 tint 和字形定位仍保留。
- `GameCanvas.vue` 删除 umbra / ember / codex 的地图呈现分支及 umbra 专属观察器；`mapCamera.ts` 删除 `setCodexCamera` 与临时镜头快照。普通镜头、缩放、Fit、手势与保留绘制未改变；通用相机/遮挡几何测试保留。
- 删除无生产引用的 `public/art/obsidian-reliquary.png`（2,056,951 字节）、`the-cartographer.png`（3,171,635 字节）、`verdant-abyss.png`（2,575,561 字节），合计 7,804,147 字节；同时删除 `public/art/README.md` / `provenance.json`。汉字字体及 OFL 许可保留。`docs/UI_LAB_HANDOFF.md` 的美术链接改为明确的历史说明；`docs/HANDOFF.md` 增加本分支的界面现状和待验收状态。
- `zh_CN.json` 删除全部 80 个 `lab.*` 键：仍使用的文本迁到 `title.*`、`map.*`、`theme.*`；删除旧主题介绍、偏好投票、地图切换栏提示及 ThemeCodex / ThemeKit 的死键。设置与帮助的新文本全部使用 i18n。

## 地图模式与图鉴迁移

菜单 → 设置新增四种地图显示选项，连接 `mapMode` / `selectMapMode`，保留原持久化键 `brogue-ui-map-style` 和 `?map=` 入口、默认精修模式、非法值拒绝行为。它与 `displaySettings` 内的缩放和沉浸开关独立，切换不重新开局。

字形图鉴移入同一设置页，保留四组分类、检索、矢量图标与地形/生物/物品全集。图鉴在设置卡片内展开并限制列表高度，不再定位到已经删除的顶部工具栏。Escape 先关闭图鉴，再返回设置上一级；菜单现有模态优先级保持。

## 沉浸模式与快捷键依据

- `Settings.ts` 只增加显示偏好 `immersiveMode: boolean`，默认 `false`，沿用 `brogue-web-display-v1` 的校验和同步持久化。存储不可用时仍可在本次会话切换。未改任何规则代码，未给 Game 加字段，未改存档/录像合同、命令类型、随机数或生成夹具。
- App 通过 CSS class 收起为顶部单行状态、底部单行消息和全宽地图。桌面和触屏保留 `RadialCommands`；回放时不挂载命令环，回放控件有独立网格行。“面板”临时展开原 zen 的周围信息与消息面板；退出/进入沉浸模式时清掉临时展开状态。配色、字体和地图墨色均继承 glyph。
- App 只挂载一处 GameCanvas；切换布局或转屏不通过条件分支重建 Pixi。bec53f9 的命令环 dispatch、桌面指针操作、日志行数响应和 CE 回合钟轮询保持，相关实际组件测试继续通过。
- 快捷键选择 **反引号（`）**。只读核查 `.ce-reference/BrogueCE-master/src/brogue/Rogue.h:1162–1223` 的按键定义和 `IO.c:2455–2714` 的 `executeKeystroke` 执行分支：反斜杠已经是 `TRUE_COLORS_KEY`（Rogue.h:1187），IO.c:2575–2586 实际切换真实颜色；反引号未绑定。项目 `src/engine/Input.ts`、`src/ui/commands.ts`、现有组件和 ui 键盘处理器也没有反引号绑定。
- 新 `src/ui/immersiveMode.ts` 经现有 `inputManager.registerModalKeyHandler` 注册，优先级 `-1000`，在其它模态之后、游戏按键及未绑定键中断逻辑之前处理。不另加 window 监听、不派发游戏命令。菜单、背包、投掷、法器目标选择、帮助/发现、暂停/结算、文本输入及上级模态时不切换；拒绝修饰键和按住重复事件，卸载时注销。

## 响应式处理与视觉验收边界

移除所有 `--lab-h` 和工具栏高度依赖，应用恢复完整 `100dvh`；地图缩放按钮回到地图右上角。刻符桌面左栏使用现有宽度偏好，生命/饥饿网格减少空标签列并允许剩余列收缩；左栏内容过长可滚动。紧凑视口保留顶部状态、地图及触控区域，手机横屏命令改为四列换行，避免八个按钮撑宽地图。粗指针桌面与回放分别设置方向盘/控制行，沉浸模式顶部控件保持单行，手机上隐藏可在面板查看的附加信息。

本轮只能做结构与源码检查，没有浏览器或截图；不能据此声称四视口视觉验收已通过。验收方请对 1280×800、768×1024、390×844、844×390 分别检查默认刻符与沉浸模式，覆盖设置/图鉴、展开面板、命令环、目标条和回放控制条。截图不入仓库。手机默认沉浸仍关闭：目前没有截图依据支持改变默认值；若后续对照截图显示 390×844 的刻符状态/操作区明显挤占地图，再据两种布局的实际截图提出建议，本轮不擅改默认。

## 测试增删改逐条登记

以下删除/改写均来自任务书明确删除主题与切换栏的授权；没有放宽规则、随机数、可见性、触屏命令边界、回合钟或相机几何断言。

1. `ui_concepts.test.ts`：删除“三种旧主题切换”用例，因为切换 API 已删除；替换为旧查询参数被忽略、固定 glyph 作用域的回归。删除 WebMCP 注册/枚举/执行/注销用例，因为工具已删除；替换为组件、工具、旧样式与位图资源不存在的结构守卫。
2. `theme_camera_preferences.test.ts`：删除两个 codex 专属用例及文件：①进入/手动缩放/Fit 不写全局偏好、退出恢复镜头；②同 tick 进入/退出恢复高于 2 的缩放。codex 与 `setCodexCamera` 明确删除，已不存在相应行为。普通镜头测试未删。
3. `theme_shell_fixes.test.ts`：删除一个切换栏高度测量/换行/旧主题/折叠释放空间用例，以及仅服务该用例的概念切换、组件编译和 ResizeObserver 回调夹具。其余 19 个展开后的几何/实际组件用例保留；两处 codex / umbra 的几何用例名称改为通用“padded viewport / floating dock”，布景和断言不变。命令环一次 dispatch、回合数刷新、RNG 不变、日志行数响应和通用遮挡测量断言均保留。
4. `gameplay_layout.test.ts`：旧“全部主题共同使用 MobileHud / MessageStrip / context rail 网格”的用例改为固定 ThemeHud / ThemeLog / ThemeNearby、唯一画布、三种视口布局、独立回放行及无顶部占位的合同；保留面板宽度、日志抽屉和单画布断言。模态隔离列表只删除 UiLabToolbar，SideDrawer / CommandBar 的隔离与 Escape 断言保留。全部命令可达、dispatch 边界和可见性模型的另两项断言不变。
5. `map_tile_modes.test.ts`：主题切换独立性用例改为地图与沉浸偏好独立，并继续断言四模式及非法值无效；各 `paintMapText` 调用去掉已删除的主题参数，定位/字形/颜色/tint 断言不变；危险色保护用例删除三种被删主题的重复循环，保留相同的三项颜色断言；画布源码标记从 `watch([mapMode, concept]` 改成 `watch(mapMode`，其它边界标记与命令管线断言不变。所有目录覆盖、秘密伪装、记忆和幻觉断言未改。
6. `vector_atlas.test.ts`：仅去掉 `paintMapText` 的旧主题参数，保留 tiles 模式不请求文本纹理的断言。
7. `x4a_movement_rendering.test.ts`：仅去掉 `paintMapText` 的旧主题参数，保留原移动/字形/tint 回归断言。
8. `fe_1_touch.test.ts`：只读状态/消息组件的扫描对象从已删 MobileHud / MessageStrip 换成当前 ThemeHud / ThemeLog，仍使用同一个“不得调用 activeGame 方法”断言；其它触屏组件和输入/录像断言不变。`gameplay_layout.test.ts` 的潜行数值接线守卫同样改读 ThemeHud，仍断言 `stats.stealthRange`。
9. `x4b_flavor_text.test.ts`：仅将位置描述行接线守卫的读取对象从 MessageStrip 换成 ThemeLog，描述行 CSS 标记 `strip-hover` → `tl-flavor`，日志行数传入标记 `useGameHud(props.lines)` → `useGameHud(() => props.lines)`；仍验证同一位置描述行与既有 HUD model 的检查优先于 flavor，Sidebar / useGameHud 的优先级断言和全部游戏行为、消息归档、双 RNG、录像断言不变。旧行组件删除是任务授权的界面删除，这里将相同合同指向真实的新入口。
10. 新增 `immersive_mode.test.ts` 共 11 项（含参数展开）：默认关闭与同步持久化/刷新、四种非法存储输入、快捷键往返/重复/注销/无命令及无 RNG、真实存档快照与命令记录不变、存储不可用、上级模态及菜单/背包/目标/帮助/暂停隔离、文本输入与修饰键隔离、四种地图偏好独立持久化及设置/图鉴入口注册。

未修改守卫白名单、既有超时、断言容差、历史 skip/todo、黄金 trace 或生成基线。任务书已经授权移除被删功能的合同，本轮没有旧规则测试依赖修复行为的“前提修订”，因此不涉及生产文件回退的单变量反事实或重录。

## 门禁与原文结果

执行目录均为仓库根；原始小型日志保留在 `/tmp/design3-*.log`，不提交。最终相关批次覆盖任务书列出的 c_4a、p1_30、u24、repo_hygiene、ui_1、ui_2、i_1、fe_1，以及 grep 反查到的主题、地图、布局、设置、移动绘制、测试模式可达性和菜单/结算保存录像测试。

### 类型检查与构建

`npx vue-tsc -b`：退出 0，无输出，日志 `/tmp/design3-final-typecheck.log`。最终 `npm run build`：退出 0，日志 `/tmp/design3-production-build.log`。

```text
> brogue-web@0.2.0 build
> vue-tsc -b && vite build

vite v7.3.1 building client environment for production...
✓ 949 modules transformed.
✓ built in 2.18s
```

构建仍提示部分压缩 chunk 超过 500 kB；构建成功，没有把体积提示隐藏或改阈值。

### 完整相关前端文件批次

最终命令与原文汇总如下，日志 `/tmp/design3-acceptance.log`。

```sh
npx vitest run \
  src/test/ui_concepts.test.ts src/test/immersive_mode.test.ts \
  src/test/gameplay_layout.test.ts src/test/map_tile_modes.test.ts \
  src/test/theme_shell_fixes.test.ts src/test/vector_atlas.test.ts \
  src/test/p2_6_display_settings.test.ts src/test/ui_1_rendering.test.ts \
  src/test/ui_2_protection.test.ts src/test/i_1_interaction.test.ts \
  src/test/fe_1_touch.test.ts src/test/x4a_movement_rendering.test.ts \
  src/test/x2h_test_mode_reachability.test.ts src/test/repo_hygiene.test.ts \
  src/test/u24_hardcoded_text.test.ts src/test/p1_30_i18n_gate.test.ts \
  src/test/c_4a_terrain_catalog.test.ts src/test/ux_1a_end_ui.test.ts \
  src/test/r_1_appearance.test.ts src/test/x3_u5_ui.test.ts \
  src/test/x4b_flavor_text.test.ts
```

退出 0，原文：

```text
Test Files  21 passed (21)
      Tests  277 passed (277)
   Start at  23:30:14
   Duration  97.17s (transform 5.56s, setup 0ms, import 21.93s, tests 140.97s, environment 4ms)
```


### 扩展源码守卫

对 `rg` 找到的源码读取文件做 AST 读取调用反查，选出 47 文件内 72 个读取守卫/源码对照定义；只读夹具或其它行为用例不作为这批全跑。初次名称筛选的三组参数化标题含 `%s` / `%i` / `$name`，另以标题前缀补跑，合计这些定义展开后的 78 项通过。筛选产生的 skipped 是未选用例，不是给测试代码添加 skip，不能冒充全量测试。

`/tmp/design3-source-guards.log`，退出 0，原文：

```text
 Test Files  45 passed | 2 skipped (47)
      Tests  69 passed | 1071 skipped (1140)
   Start at  23:04:00
   Duration  56.14s (transform 7.47s, setup 0ms, import 73.82s, tests 86.01s, environment 34ms)
```

遗漏参数化定义的补跑命令：

```sh
npx vitest run src/test/w_23_negation.test.ts src/test/w_21_empowerment.test.ts src/test/u_06_monster_damage.test.ts -t 'matches original compiled CE status rows|matches compiled CE for all modeled statuses when duration|catalog magnitude and exhaustive CE distribution'
```

`/tmp/design3-source-guards-parameters.log`，退出 0，原文：

```text
 Test Files  3 passed (3)
      Tests  9 passed | 99 skipped (108)
   Start at  23:07:59
   Duration  858ms (transform 1.27s, setup 0ms, import 2.22s, tests 39ms, environment 0ms)
```

反查清单/筛选式保留在 `/tmp/design3-source-guards.json`、`/tmp/design3-source-guard-files.txt`、`/tmp/design3-source-guard-pattern.txt`，便于复核。它补充了现有 U03 字段合同、地形/DF/source 白名单、UI/i18n 以外的源码读取检查。

共享读取函数再次反查后，补跑 R-1 GameCanvas 渲染纯函数/颜色字形/随机数源码守卫和 X3-U5 实际输入组件，以及实例字段、环境 DF 路径、内容覆盖和地形 CE 字段等共享读取合同。没有运行其中无关的长生成普查。

`npx vitest run src/test/r_1_appearance.test.ts src/test/x3_u5_ui.test.ts`，退出 0，`/tmp/design3-render-input-guards.log` 原文：

```text
 Test Files  2 passed (2)
      Tests  52 passed (52)
   Start at  23:22:26
   Duration  1.28s (transform 772ms, setup 0ms, import 1.42s, tests 274ms, environment 0ms)
```

`npx vitest run src/test/u_01_instance_snapshot.test.ts src/test/v_2b_9b_environment.test.ts src/test/x4_r5_content_text.test.ts src/test/v_2b_9c_effects.test.ts -t 'field coverage: declarations|bulk promote uses the common|covers every current web terrain|55 retains CE data|seven tiles retain all CE flag'`，退出 0，`/tmp/design3-helper-guards.log` 原文：

```text
 Test Files  4 passed (4)
      Tests  5 passed | 36 skipped (41)
   Start at  23:22:26
   Duration  1.05s (transform 1.55s, setup 0ms, import 3.08s, tests 42ms, environment 1ms)
```

### 首轮问题与修正

首轮相关批次 17 文件实际退出 1（`/tmp/design3-frontend.log`），2 文件失败、15 文件通过，10 项失败、201 项通过：新测试的简化 document 夹具在 Vue 首次加载时缺 `createElement` 导致 9 项失败；i18n 守卫报告 10 个删除组件留下的死键。修正夹具的 Vue 初始化顺序，并删除生产翻译死键，未修改 i18n 守卫。定向复跑 2 文件 / 25 项退出 0，后续相关 18 文件 / 214 项全过。

追加的真实快照用例首轮只差 `savedAt` 捕获时间戳（4 ms）；为新测试固定 Date.now，保留完整快照相等断言，单文件 11 项全部通过（`/tmp/design3-immersive-verified.log`）。最后调整窄左栏的生命/饥饿标签列后再次 build，并重跑相关批次 18 文件 / 216 项全绿。

收尾删除 MobileHud / MessageStrip 后，扩大批次 21 文件实际退出 1（`/tmp/design3-frontend-delivered.log`）：1 文件失败、20 文件通过，1 项失败、276 项通过。唯一失败是 `theme.context`：它仍由 SideDrawer 使用，但旧模板三元属性里的 `$t` 调用未被静态扫描器识别；此前 MobileHud 的字面量调用掩盖了此问题。保留该活跃文本，将抽屉标签改为脚本 computed 中可静态解析的 `t` 字面量调用，未改守卫。包含 i18n / 触屏 / 布局 / 位置描述的定向复跑 4 文件 / 45 项通过（`/tmp/design3-hud-migration-check.log`），随后冻结实现并重跑交付批次及类型/构建。

## 遗留与交付边界

- 四视口截图与浏览器实际操作验收由用户/验收方完成，本轮未启动浏览器、未制作或提交截图。
- 合并前完整 `npm test` 按任务书留给验收方；本轮未跑完整 npm test、ce:fetch、test:full 或 test:drift。
- 本地引用的 CE 源码仅只读核查；规则、实体、目录、Game 状态合同、存档/录像格式、生成基线与黄金 trace 无改动。`src/engine` 唯一修改是表现偏好 `Settings.ts`。
- `git diff --check` 通过；源码检查没有 CRLF；未新增大体积证据。原本未跟踪的任务书保持未跟踪，未 staging/commit/push。

## DESIGN-3b 打磨

日期：2026-10-02。依据：[DESIGN-3b 任务书](../tasks/design-3b-immersive-polish.md)。工作区与分支不变，执行基点为 DESIGN-3 提交 `7930a6c`。问题来源为 Claude 四视口浏览器实测，整改已获用户确认。本轮没有使用浏览器；下面的通过结果限于类型、构建、组件、几何与源码守卫，截图验收仍由用户/Claude 完成。未 staging、commit 或 push。

### 逐项根因与改动

| 任务项 | 根因 | 改动与可复核证据 |
|---|---|---|
| 1. 桌面地图左右黑边、浮层遮挡 | DESIGN-3 删除旧主题分支后，GameCanvas 不再向 `computeMapCamera` 传覆盖呈现参数，也没有启用浮层观察器；桌面继续采用原整图适配。 | 仅在 `displaySettings.immersiveMode` 为真时启用 `fillViewport`、上下两格安全余量及真实 DOM 遮挡测量。四视口、地图中心/四边、命令环收起/展开的几何回归验证横向覆盖与玩家上下两格无遮挡，自动避让不累积为用户平移。浏览器复验另发现实际 canvas 未随容器变大，后续已补 renderer 尺寸同步，见下方“浏览器复验补修”。普通刻符仍传关闭覆盖、零余量，桌面原布局精确相等断言保留。主动“整图”按钮仍沿用原 Fit 观察入口；覆盖模式针对正常跟随呈现。 |
| 2. 桌面消息带过高、文字偏右、命令环压消息 | 默认桌面消息区的 `min-height:86px` 选择器优先级高于旧沉浸覆盖；日志与位置描述横排时，空日志列表仍占据伸缩空间，把描述推到右侧；命令环原先相对整个 App 定位。 | 用足够优先级的沉浸选择器覆盖为固定 32px 单行（另加底部安全区），文本左对齐。ThemeLog 新增仅显示用的 `singleLine` 属性：有消息时显示最近一条，没有消息时显示位置描述，空列表不占宽度；右侧保留打开完整日志的小按钮。命令环移入地图容器，展开/收起都不能跨进底部消息行。默认日志及展开面板仍保留原多行行为。 |
| 3. 手机状态数字无标签 | 旧手机沉浸选择器隐藏全部 `.th-label`，又单独隐藏回合标签。 | 删除这两处沉浸隐藏规则，保留现有 i18n 的“深度 / 回合 / 生命”标签；饥饿仍用可辨认的状态词。收紧手机组间距，保持一行；菜单和面板按钮保持触控高度。默认刻符标签/布局未改。 |
| 4. 手机没有逐格移动入口 | App 的 DPad 挂载只依赖粗指针，沉浸 CSS 又无条件 `display:none!important` 隐藏 DPad。 | 沉浸下粗指针或紧凑视口均挂载原 DPad，置于地图左下，继续提供八方向及中心休息；默认刻符沿用原粗指针条件，回放不显示 DPad。选择复用 DPad，避免把战斗移动藏进命令环。没有改 DPad 脚本：仍经 dispatch → 既有命令录制入口，保留原按住重复节奏。实际 App 组件测试覆盖细指针紧凑视口、粗指针、切换、转屏、回放隔离和单画布；实际 DPad 按下/抬起/随后 click 验证只记录一次 move。 |
| 5. 手机看不到消息 | 手机沉浸明确隐藏位置描述；开局还没有消息时，整个日志区因此没有可见内容。 | 手机沿用同一固定单行消息区；没有日志时显示位置描述，有日志时显示最新消息，截断内容可打开完整日志。实际 ThemeLog 测试覆盖这两个时点与日志打开事件。 |
| 6. 手机地图上方大块空白 | 普通适配/跟随镜头未按沉浸可用画布执行覆盖；原布局还混有消息区尺寸与控制区隐藏规则。 | HUD / 地图 / 消息独立三行，方向键与命令环叠在地图内，地图占满其余高度。覆盖镜头直接采用覆盖比例及 12px 可读下限；不再在短横屏额外按普通跟随镜头的约 18 行放大，确保方向键、展开命令环上方有足够相邻格空间。短横屏缩放按钮横排于左上，与右侧命令环分开。地图边缘的少量上下安全余量属于玩家避让；未恢复整图居中的大片留白。 |
| 7. 图鉴入口是大方块 | 图鉴按钮直接作为显示设置网格项，被相邻的设置字段撑高并默认拉伸。 | 改成普通 `.field` 行“字形图鉴 / 查看”；字段与按钮均从顶部起排，按钮自身 44px 最小高度、正常内边距，不随网格行拉伸。新增中文键 `map.legend_view`；i18n 与硬编码文本守卫通过。 |
| 8. 展开图鉴使左侧 logo 下跳 | 子页面标题与菜单卡片均垂直居中；图鉴增高卡片，随之改变父容器高度和标题居中位置。 | 仅设置页增加 `settings-open` / `settings-card` 作用域：标题顶对齐，卡片限制可视高度并独立纵向滚动，保留图鉴列表原 280px 上限。手机/平板和短横屏按现有内边距调整最大高度；暂停菜单标题继续沿用原隐藏行为。真实菜单组件测试确认展开/收起不替换标题实例，Escape 先关闭图鉴，再退出设置。实际像素位置须由截图确认。 |

命令环遮挡测量覆盖中心及展开的每个按钮的变换后矩形，而不是只测 60px 中心盒；观察器新增 class 变化观察，覆盖开合、展开面板及布局状态变化。按钮位移即时落位，只保留透明度过渡，避免观察器读到移动动画起点后漏掉终点遮挡。触控环按钮为 48px、半径 80px，在 390px 竖屏与约 160px DPad 并排；普通桌面仍为 52px、半径 92px。卸载或退出沉浸模式时注销观察器及 watcher。

快捷键仍为反引号，手机/桌面默认沉浸仍关闭；未改 Settings、Game、规则、实体、命令类型、随机流、存档/录像合同、黄金 trace 或生成基线。App 仍只有一个 GameCanvas，切换/转屏不重建画布。未修改默认刻符布局的 CSS 规则；`mapCamera` 变化限于覆盖分支。

### 首轮测试增删改登记

只新增 `src/test/immersive_polish.test.ts`，共 11 项（含四视口参数展开）：

- 4 项覆盖几何：横向铺满、上下两格避让、中心/边缘、命令环开合、DPad/缩放工具、零自动平移与零 RNG 消耗。
- 1 项真实几何读取/观察生命周期：class 变化、展开按钮矩形、两个观察器注销。
- 1 项生产接线守卫及默认桌面布局精确相等。
- 1 项实际 App：紧凑细指针与粗指针移动入口、转屏/切换、回放隔离、画布不重建、命令与随机流不变。
- 1 项实际 DPad：经真实命令录制入口只记录一次方向移动。
- 1 项实际 ThemeLog：开局位置描述、最新消息、单条日志及完整日志入口。
- 1 项实际 MainMenu：普通图鉴入口、展开/收起、标题实例不替换与 Escape 层级。
- 1 项 CSS/模板合同：单行高度、左对齐、可见 DPad、手机标签、地图内命令环、设置内滚动与标题对齐。

没有删改旧测试、断言语义、超时、容差、白名单、skip/todo 或夹具；无需旧测试前提修订、生产回退反事实或基线重录。

新增用例首轮实际退出 1：9 项通过、2 项失败，并有 1 个未处理异步错误（`/tmp/design3b-polish-first.log`）。原因都是新夹具：ThemeLog 的 mounted 轮询结果尚未经过 Vue nextTick 更新，且菜单 v-model 指令需要自定义渲染节点支持 addEventListener/options/value。只修新夹具并等待正确观察时点，断言保留；复跑 11 项全部通过，无未处理错误（`/tmp/design3b-polish-verified.log`）。原有四文件首轮 50 项也全部通过（`/tmp/design3b-first-check.log`）。

### 首轮门禁命令与原文

所有命令在仓库根执行，以下均实际退出 0。原始日志放 `/tmp/design3b-*.log`，不提交。

`npx vue-tsc -b`：退出 0，无输出，日志 `/tmp/design3b-typecheck.log`。

`npm run build`：日志 `/tmp/design3b-build.log`，原文摘要：

```text
> brogue-web@0.2.0 build
> vue-tsc -b && vite build

vite v7.3.1 building client environment for production...
✓ 949 modules transformed.
✓ built in 2.84s
```

原有压缩 chunk >500 kB 提示仍保留，未修改阈值。

原 DESIGN-3 报告的 21 文件批次全部重跑，并加入新文件：

```sh
npx vitest run \
  src/test/ui_concepts.test.ts src/test/immersive_mode.test.ts \
  src/test/gameplay_layout.test.ts src/test/map_tile_modes.test.ts \
  src/test/theme_shell_fixes.test.ts src/test/vector_atlas.test.ts \
  src/test/p2_6_display_settings.test.ts src/test/ui_1_rendering.test.ts \
  src/test/ui_2_protection.test.ts src/test/i_1_interaction.test.ts \
  src/test/fe_1_touch.test.ts src/test/x4a_movement_rendering.test.ts \
  src/test/x2h_test_mode_reachability.test.ts src/test/repo_hygiene.test.ts \
  src/test/u24_hardcoded_text.test.ts src/test/p1_30_i18n_gate.test.ts \
  src/test/c_4a_terrain_catalog.test.ts src/test/ux_1a_end_ui.test.ts \
  src/test/r_1_appearance.test.ts src/test/x3_u5_ui.test.ts \
  src/test/x4b_flavor_text.test.ts src/test/immersive_polish.test.ts
```

`/tmp/design3b-acceptance.log` 原文：

```text
 Test Files  22 passed (22)
      Tests  288 passed (288)
   Start at  00:20:36
   Duration  117.43s (transform 7.72s, setup 0ms, import 34.90s, tests 212.29s, environment 50ms)
```

源码守卫沿用 DESIGN-3 的 rg + TypeScript AST 反查方法，重新扫描当前测试文件，并将参数化标题中的 `%i` / `%s` / `$name` 转成筛选通配，避免原报告的参数化漏选。首批 50 文件内 76 个读取定义展开为 82 项；清单、筛选式与脚本位于 `/tmp/design3b-source-guards.json`、`/tmp/design3b-source-guard-files.txt`、`/tmp/design3b-source-guard-pattern.txt`、`/tmp/design3b-source-guards.cjs`。按文件清单及 `-t` 筛选式运行，日志 `/tmp/design3b-source-guards.log`：

```text
 Test Files  50 passed (50)
      Tests  82 passed | 1082 skipped (1164)
   Start at  00:20:36
   Duration  62.88s (transform 9.78s, setup 0ms, import 90.10s, tests 94.99s, environment 13ms)
```

进一步检查动态拼接的 skipIf 标题，以及同时读取 fixture 与 CE 源码的合同，补选 19 文件 / 21 项。完整反查清单 `/tmp/design3b-source-guards-expanded.json`，补选文件/筛选式 `/tmp/design3b-source-guard-extra-files.txt`、`/tmp/design3b-source-guard-extra-pattern.txt`，脚本 `/tmp/design3b-source-guard-extra.cjs`。日志 `/tmp/design3b-source-guard-extra.log`：

```text
 Test Files  19 passed (19)
      Tests  21 passed | 433 skipped (454)
   Start at  00:23:25
   Duration  3.60s (transform 3.55s, setup 0ms, import 25.04s, tests 1.31s, environment 4ms)
```

共享读取辅助函数补跑沿用原报告命令；R-1 / X3-U5 已在完整相关批次中覆盖，另补字段声明、环境 DF、地形文本全集及 CE 字段合同：

```sh
npx vitest run src/test/u_01_instance_snapshot.test.ts \
  src/test/v_2b_9b_environment.test.ts src/test/x4_r5_content_text.test.ts \
  src/test/v_2b_9c_effects.test.ts \
  -t 'field coverage: declarations|bulk promote uses the common|covers every current web terrain|55 retains CE data|seven tiles retain all CE flag'
```

`/tmp/design3b-helper-guards.log` 原文：

```text
 Test Files  4 passed (4)
      Tests  5 passed | 36 skipped (41)
   Start at  00:20:52
   Duration  2.36s (transform 3.02s, setup 0ms, import 6.72s, tests 107ms, environment 1ms)
```

以上 `-t` 日志中的 skipped 均为未选用例，不是新增 skip，也不代表全量已跑。未跑完整 `npm test`、ce:fetch、test:full、test:drift。现有本地 CE 参照仅由这些原有源码合同读取，没有同步版本。

### 首轮交付与截图验收边界

`git diff --check` 通过，修改/新增文件无 CRLF，没有截图或 >1 MB 原始证据进入工作区。任务书原先未跟踪，保持原样；只交付源码、新增测试及本报告追加章节，未提交或推送。

用户/Claude 请在 1280×800、768×1024、390×844、844×390 检查普通刻符与沉浸开关往返，以及：状态标签、最新消息/开局描述、DPad 八方向与中心休息、命令环收起/展开/执行、玩家靠近地图上下边缘时的避让、短横屏缩放按钮、目标条、展开面板、回放控制条；设置页请比较图鉴展开/收起前后 logo 的实际像素位置，确认卡片内可滚动、查看按钮尺寸正常。没有浏览器证据，本轮不宣称视觉验收通过。

### 浏览器复验补修：容器尺寸与 Pixi 画布同步

日期：2026-10-02。用户转述 Claude 浏览器验收：设置页两项、手机沉浸四项、桌面单行消息均通过；剩余桌面黑边可稳定复现：在 1280×800 按反引号，地图容器从刻符布局变为 1280×729，canvas 却仍是 1040×660；手动 window resize 才恢复铺满。上面的首轮几何与组件测试只验证镜头和画布实例，漏查了实际画布尺寸，不能作为桌面铺满通过的证据。

**根因核查**：GameCanvas 已有容器 ResizeObserver，但回调仅调用 `applyLayout` 更新四个图层、相机和 hitArea，未 resize Pixi renderer。依赖的 PixiJS 8.16.0 `lib/app/ResizePlugin.mjs` 实际执行路径只在 `resizeTo` 设置时做初次 resize，然后监听全局 `resize`；它不会观察所指定元素的尺寸变化。所以布局切换已重算镜头，renderer screen、canvas CSS 尺寸及 backing buffer 仍停留在旧尺寸。

**最终修复**：

- 新 `src/ui/canvasResize.ts` 用 ResizeObserver 观察 GameCanvas 容器 `.game-container`，以容器 clientWidth/clientHeight 为真值。初次同步后，通知只排入一个 requestAnimationFrame；同帧多次通知合并，执行时重新读取最终尺寸。
- 尺寸变化先调用既有 renderer.resize，再执行 GameCanvas 的 `applyLayout`（相机、四图层、hitArea）并请求重绘。初始尺寸已相同、相同尺寸重复通知、同帧变化后又回原尺寸均不重复 resize；隐藏/零尺寸时保留最后可用画布，重新显示后再同步。DOM 写入不在 ResizeObserver 通知回调中执行，防止尺寸反馈形成循环。
- GameCanvas 初始化明确传容器 width/height，保留原 resolution 和 autoDensity，删除 `resizeTo`，由上述容器管线独占尺寸同步；窗口变化、沉浸往返、侧栏宽度/面板造成的容器变化均走同一路径。画布 CSS 尺寸和像素缓冲由 Pixi 自身 ViewSystem/CanvasSource 更新，不用 CSS 拉伸掩盖旧缓冲尺寸。
- 卸载先断开观察器并取消尚未执行的 rAF，包括编号 0；迟到的通知/帧回调也被 disposed 阻止，再按原流程销毁 Pixi。没有重建 Application、画布或图层，没有新增 Game 字段、命令或 RNG 调用；上轮已验收的设置、手机与消息布局不变。

**新增回归**：只新增 `src/test/canvas_resize.test.ts`，7 项；未改旧测试。使用真实 Pixi ViewSystem/CanvasSource 和可控 ResizeObserver/rAF，不启动浏览器或 GPU：

1. 精确覆盖 1040×660 → 1280×729 → 1040×660，验证 CSS 尺寸、DPR=2 backing pixels、renderer screen、相机及命中区同步；不派发 window 事件，同一 view/canvas 保持，真实存档快照/录像及 RNG 不变。
2. 同帧通知合并，并采用排队之后的最终容器尺寸。
3. 相同尺寸反馈和同帧回原尺寸不触发重复 resize/布局。
4. 初始/途中零尺寸与恢复显示。
5. 卸载断开、取消编号 0 的帧、阻止迟到通知与回调。
6. 面板/侧栏造成的尺寸变化与 DPR=1 像素大小。
7. 生产接线守卫：容器所有者收到真实 renderer，resize 后接布局/重绘，初始化读取容器尺寸，注销先于应用销毁，Application 仍只创建一次。

初次定向 3 文件退出 1：36 项通过、1 项失败，仅存档捕获元数据 savedAt 相差 7ms；给新测试固定 Date.now，保持完整快照相等断言。初次类型检查退出 2：新测试调用真实 ViewSystem.resize 漏了声明要求的第三个 resolution 参数；补传原 view.resolution。均只修新夹具，没有放宽断言。日志 `/tmp/design3b-resize-first.log`、`/tmp/design3b-resize-typecheck.log`；后续定向 3 文件 / 37 项退出 0，日志 `/tmp/design3b-resize-verified.log`。

另做针对漏 resize 的单变量对抗探针：临时只省掉新辅助函数中的 renderer.resize，保留布局回调。第一项回归准确失败，读取到旧 `[1040, 660]`，期望 `[1280, 729]`，退出 1；随后在 finally 中恢复原生产文件并核对字节相同。探针日志 `/tmp/design3b-resize-adversarial.log`。这不是修改旧测试前提，也没有重新生成任何基线。

**本次最终门禁**：所有最终命令实际退出 0，日志独立保留在 `/tmp/design3b-resize-*.log`。首轮门禁保留为历史记录，最终结论以下列结果为准。

`npx vue-tsc -b` 无输出，日志 `/tmp/design3b-resize-typecheck-final.log`。`npm run build` 日志 `/tmp/design3b-resize-build.log`：

```text
> brogue-web@0.2.0 build
> vue-tsc -b && vite build

vite v7.3.1 building client environment for production...
✓ 950 modules transformed.
✓ built in 2.36s
```

原 >500 kB chunk 提示仍保留。相关批次沿用上述首轮 22 文件完整命令，再加入 `src/test/canvas_resize.test.ts`、`src/test/p2_4_animation_cadence.test.ts`（容器居中、输入/动画节奏相关），日志 `/tmp/design3b-resize-acceptance.log`：

```text
 Test Files  24 passed (24)
      Tests  308 passed (308)
   Start at  00:43:52
   Duration  115.01s (transform 8.24s, setup 0ms, import 34.23s, tests 210.84s, environment 5ms)
```

重新反查全部源码读取守卫，采用相同脚本及参数/动态标题筛选方式，包含新文件的生产接线断言；首批 51 文件 / 77 个定义展开 83 项。清单与脚本在 `/tmp/design3b-resize-source-guards.json`、`/tmp/design3b-resize-source-guard-files.txt`、`/tmp/design3b-resize-source-guard-pattern.txt`、`/tmp/design3b-resize-source-guards.cjs`。日志 `/tmp/design3b-resize-source-guards.log`：

```text
 Test Files  51 passed (51)
      Tests  83 passed | 1088 skipped (1171)
   Start at  00:43:53
   Duration  58.92s (transform 9.06s, setup 0ms, import 78.48s, tests 89.25s, environment 11ms)
```

动态 skipIf 标题/混合 fixture 与 CE 读取的 19 文件 / 21 项同样重跑。完整清单 `/tmp/design3b-resize-source-guards-expanded.json`，补选脚本、文件、筛选式沿用 `design3b-resize-source-guard-extra` 前缀。日志 `/tmp/design3b-resize-source-guard-extra.log`：

```text
 Test Files  19 passed (19)
      Tests  21 passed | 433 skipped (454)
   Start at  00:44:52
   Duration  3.25s (transform 3.43s, setup 0ms, import 21.49s, tests 1.29s, environment 5ms)
```

共享读取合同按上方同一命令重跑，日志 `/tmp/design3b-resize-helper-guards.log`：

```text
 Test Files  4 passed (4)
      Tests  5 passed | 36 skipped (41)
   Start at  00:44:46
   Duration  1.23s (transform 1.70s, setup 0ms, import 3.55s, tests 52ms, environment 1ms)
```

`-t` 的 skipped 是筛选未运行的用例；未修改历史 skip/todo。仍未跑完整 npm test、ce:fetch、test:full 或 test:drift。git diff --check 通过，改动无 CRLF，无截图或大体积证据入仓库，未 staging/commit/push，HEAD 仍为 7930a6c。

本轮接受用户转述的七项浏览器通过结果，没有自行运行浏览器，也不宣称已完成剩余桌面 bug 的视觉复验。请验收方在 1280×800 反引号往返切换，无需手动 window resize 即确认 canvas CSS/renderer screen 与 .map-area 尺寸一致，并检查面板/侧栏宽度变化和浏览器控制台没有 ResizeObserver 循环警告。
