# 修复：搜索进度没有任何显示

> 分支：`fix/search-progress-bar`（工作区 `BrogueJS-newtheme`，基于 main `0ca1c67`）。来源：用户试玩反馈。

## 现象
主动搜索（`s`）需要连续使用 5 回合才完成一次细致搜索，但界面上没有任何进度显示；玩家按了 `s` 只会觉得"没反应"。

## 对照 CE（已由 Claude 核对）
- CE 把进度存为玩家状态 `STATUS_SEARCHING`（`Time.c:2394-2430` manualSearch：每次 +1，`maxStatus=5`；第 5 次做强度 160 的终搜、提示 "you finish your detailed search of the area." 并归零），`Time.c:2550-2553`：若本回合没有继续搜索则清零。
- CE 侧栏把它当作普通状态渲染为进度条：`Globals.c:1795` 状态目录 `{"Searching", false, 0}`，`IO.c:4824` 的通用 `printProgressBar(name, status, maxStatus)`。
- `Ctrl+S`（IO.c:2531-2541）连续搜索到 5 次或被打断；本项目"更多"里已有"长搜索 [Ctrl-S]"。

## 本项目现状
`src/engine/Core/Game.ts` 的 manualSearch 规则移植正确，但计数存在私有字段 `searchingCharge`（约 6332 行），不是玩家状态，所以 `creatureStatusRows` / 侧栏状态列表看不到它。

## 要求（纯显示，不改规则）
1. 在刻符界面的状态区显示"搜索中"进度条（文本走 i18n，例如"搜索 3/5"），数值来自 `searchingCharge`，满格为 5；与其它状态条风格一致，CE 用的是通用状态条样式。计数为 0 时不显示。
2. 覆盖所有布局：桌面左侧栏、手机/平板紧凑 HUD、沉浸模式单行状态（可用简短形式），以及 ThemeHud 等使用 `useGameHud` 的位置。
3. 只读暴露：给 Game 加一个只读 getter（或纳入现有 HUD 状态读取），**不要**把它改成玩家 status、不改变存档/录像格式、不改变 manualSearch / TimeCoordinator 的规则与 RNG 消耗。
4. 若未连续搜索导致清零（CE Time.c:2550 语义），进度条随之消失；第 5 次终搜后归零消失，原有完成提示保持。
5. 可选：在"搜索"命令按钮的提示文字里说明"连续 5 回合完成细致搜索；长搜索自动连搜"，文本走 i18n。

## 硬约束
- 只做表现层；不改规则、存档、录像、随机数；不给 Game 加字段（getter 不算字段；如确需新字段须登记 u03 契约并说明）。
- 撞上已有测试改代码不改测试；确需改测试按 AGENTS.md 逐条登记理由。
- 不产生 CRLF；截图不提交；**不要 commit/push**。

## 验证（轻档）
- 回归测试：连续 s 1–4 次显示 1/5–4/5，第 5 次后消失并有完成提示；中途做别的动作后清零消失；长搜索过程显示递增；读档/回放时显示与状态一致；显示不消耗 RNG、不改回合。
- `npx vue-tsc -b`、`npm run build`、相关测试与全部读源码守卫（p1_30_i18n_gate、u24_hardcoded_text、repo_hygiene、ui_1/ui_2、i_1、fe_1、gameplay_layout 等）。

## 输出
报告 `docs/reports/fix-search-progress-bar.report.md`；用中文给出简明报告。
