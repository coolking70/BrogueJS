# 修复：移动端首页 BROGUE 字标渲染错误 + 删除副标题"刻符"与 "GLYPH CONSOLE"

> 分支：与 `fix/rapier-travel-inventory-contrast` 同一分支，在问题 1、2 完成后接着做。
> 来源：用户在手机上试玩反馈；Claude 在 375×812 下复现。

## 问题 1：移动端 BROGUE 字标渲染错误（表现层）

### 现状
`src/components/MainMenu.vue` 的 `glyphWordmark` 是用 `█` 方块字符拼成的多行文本，放在 `<pre class="title-glyph">` 中；样式在 `src/assets/theme-shells.css`（约 192、232 行）：`font: clamp(7px,1.45vw,15px)` / `line-height: 1.05`，字体为 `var(--th-font)`。

在 375×812 下截图可见：字标的方块之间出现明显的横向/纵向缝隙，笔画断裂，呈"条纹/破碎"效果。原因推测：
- 字号被 clamp 到约 7px，`line-height: 1.05` 与像素网格不对齐，行与行之间露缝；
- 移动端的等宽字体若不包含 `█`（U+2588），会回退到其它字体，字形宽度/高度与等宽列不一致，造成错位；
- 不同设备的字体与像素比不同，表现不稳定。

### 要求
- 不再依赖字体渲染方块字符。改为由同一份点阵数据（保留现有 `glyphWordmark` 的字形，或改为 0/1 位图）生成**内联 SVG**（每个点一个 `rect`，或合并为路径），`shape-rendering: crispEdges`，用 viewBox 按宽度缩放，在任何尺寸下方块相互紧贴、无缝隙、不错位。
- 保留现有的颜色、发光（text-shadow 可改为 SVG filter 或 CSS `filter: drop-shadow`）与闪烁动画的观感；桌面端外观尽量不变。
- 字标仍是装饰（`aria-hidden`），可读标题仍由现有隐藏的 `<h1>` 提供。
- 在 375×812、390×844、768×1024、1280×800、1920×1080 下都正确（截图由 Claude 验收）。

## 问题 2：删除副标题"刻符"
- 首页字标下方的"刻符"（`title.glyph`，MainMenu 的 `chapter`，`.title-chapter`）删除。现在只有一套界面，主题名不再需要展示。
- 同时检查其它地方是否还把"刻符"作为主题名标签显示（例如设置卡片右上角曾显示"刻符"），一并删除；删除不再使用的 i18n 键。
- 字标下方的英文代号 "GLYPH CONSOLE"（`title.glyph_code`，MainMenu 的 `chapterCode`，`.title-code`）**也一并删除**（用户已确认），删除对应 i18n 键。
- 删除后调整间距，使字标与菜单的纵向节奏协调。

## 硬约束
- 只做表现层；文本走 i18n；不产生 CRLF；截图不提交；**不要 commit/push**。
- 撞上已有测试改代码不改测试；确需改测试按 AGENTS.md 逐条登记理由。
- 补回归测试：SVG 字标由点阵生成且尺寸/网格正确、不再使用 `<pre>` 方块文本；"刻符"与 "GLYPH CONSOLE" 标签不再渲染且其 i18n 键已删除。

## 验证与输出
- `npx vue-tsc -b`、`npm run build`、相关测试与所有读源码守卫（含 p1_30_i18n_gate、u24_hardcoded_text、repo_hygiene、ui_concepts 等）。
- 在 `docs/reports/fix-rapier-travel-inventory-contrast.report.md` 末尾追加"首页字标"章节；用中文给出简明报告。
