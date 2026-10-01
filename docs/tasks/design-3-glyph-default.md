# DESIGN-3：刻符定为唯一界面 + 沉浸模式开关

> 分支：`design/new-theme`（工作区 `BrogueJS-newtheme`）。前置：DESIGN-2（5ee4630）、评审整改（bec53f9）。

## 背景与决策（用户已拍板）

DESIGN-2 引入 6 套新主题，加上旧的 classic / tactical / immersive 共 9 套，用顶部切换栏（UiLabToolbar）比较。用户试玩后决定：

1. **刻符（glyph）成为唯一的界面主题**，其余 8 套（新：umbra / ember / codex / zen / manual；旧：classic / tactical / immersive）全部删除。
2. **主题切换栏删除**。
3. **一线（zen）的布局保留为"沉浸模式"**：作为设置里的开关，并配一个快捷键。沉浸模式**沿用刻符的配色与字体**，只借用一线的布局：顶部单行状态、底部单行消息、地图铺满、命令环；切换只是"收起面板"，不应像换了游戏。

## 要求

### 1. 删除其余主题与切换栏
- 删除 `src/components/UiLabToolbar.vue` 及其挂载、`?concept=` 参数解析、WebMCP 工具 `select_ui_concept`（`registerConceptTool`）。
- 删除其余 8 套主题的样式、组件分支与资源：`src/assets/ui-concepts.css`、`src/assets/theme-shells.css` 中非 glyph/zen 部分、`MAP_INK` 中多余条目、只服务于被删主题的组件（如 ThemeCodex、ThemeKit、ThemeNearby 若仅被删主题使用）、MainMenu 中按主题分支的标题/背景。
- 旧主题的标题背景图 `public/art/*.png`（约 7.5MB）及 `provenance.json`、`README.md`：若删除后无引用则一并删除；`docs/UI_LAB_HANDOFF.md` 中的引用改为历史说明。
- `src/ui/concept.ts`：可以收敛为固定的 glyph（例如保留 `html[data-ui-concept="glyph"]` 作用域以减小 CSS 改动），或彻底去掉 concept 概念——选风险更小、更干净的一种并在报告说明。不要留下死代码分支。

### 2. 地图显示模式迁入设置
- 目前 original / refined / hanzi / tiles 四种地图模式只能在切换栏里选。删切换栏前，必须把它（以及切换栏里的字形图鉴 legend，如仍有价值）迁入现有的设置界面（找到 MainMenu / 设置面板 / displaySettings 的现有实现，沿用其持久化方式）。四种模式都必须仍可用。

### 3. 沉浸模式
- 显示偏好：存进现有的显示设置（localStorage），**不进存档、不进录像、不消耗随机数、不给 Game 加字段**。
- 设置界面加开关；游戏内加快捷键切换。快捷键选择前**先查 CE 键位**（`.ce-reference/` 中 Rogue.h / 键位表，或项目已有的键位映射 `src/engine/Input*`、`src/ui/commands.ts`），选一个与 CE 及本项目现有绑定都不冲突的键（候选：`\`、`` ` ``），并在报告中列出核查依据。快捷键经现有输入管线注册，打开模态/背包/目标选择时不应误触。
- 沉浸模式布局 = 原 zen 布局（单行状态 + 单行消息 + 地图铺满 + RadialCommands 命令环 + "面板"按钮可临时展开详情），配色字体 = glyph。
- 保留 bec53f9 的修复：命令环桌面可用、回放时隐藏；回合数正确刷新。
- 手机竖屏：刻符左侧状态栏若挤占地图，沉浸模式应在手机上同样可用；是否在手机默认开启**不要自作主张**，默认关闭，在报告里给出截图依据下的建议。

### 4. 刻符本身
- 刻符成为默认且唯一布局后，检查桌面（1280×800）、平板（768×1024）、手机竖屏（390×844）、手机横屏（844×390）四个视口下没有遮挡、溢出或空白浪费；原先切换栏让出的顶部空间要收回。

## 硬约束
- 只做表现层：不改 `src/engine`、`src/entities`、`src/data` 的规则逻辑；所有改状态的输入仍经 `game.executeCommand` / `executeItemCommand` / `ui/commands.dispatch`。
- 所有玩家可见文本走 i18n（`src/locales/zh_CN.json`）；删掉不再使用的翻译键（`lab.*` 等），并确保 i18n 守卫通过。
- 不产生 CRLF；截图不提交。
- **测试**：被删功能的测试（如 ui_concepts、theme_shell_fixes 中只针对被删主题的用例、map_tile_modes / gameplay_layout 中依赖切换栏的部分）按 AGENTS.md 处理——这是用户明确要求删除功能，相关断言可以删除或改为针对新入口（设置里的地图模式、沉浸模式），但**每一处删除/改写都要在报告中逐条列出理由**；与被删功能无关的断言不得削弱。为地图模式迁移和沉浸模式开关/快捷键补充回归测试。
- 不要 git commit、不要 push（由 Claude 审查后提交）。

## 验证
- `npx vue-tsc -b`、`npm run build`
- 相关前端测试与所有读源码的守卫（c_4a_terrain_catalog、p1_30_i18n_gate、u24_hardcoded_text、repo_hygiene、ui_1_rendering、ui_2_protection、i_1_interaction、fe_1_touch，以及 grep 反查到的与改动组件相关的测试）。
- 完整 `npm test`（约 30 分钟）由 Claude 在合并前跑，你不用跑；ce:fetch / test:full 不跑。
- 浏览器截图验收由 Claude 完成。

## 输出
- 报告写到 `docs/reports/design-3-glyph-default.report.md`：删除清单、迁移说明、快捷键核查依据、测试增删改逐条说明、门禁原文结果、遗留项。
- 更新 `docs/HANDOFF.md` 中关于界面主题的现状描述。
- 最后用中文给出简明报告。
