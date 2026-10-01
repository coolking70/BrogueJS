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
