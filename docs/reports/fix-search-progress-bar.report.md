# 搜索进度与状态区排版修复报告

2026-10-03；分支 `fix/search-progress-bar`，基于 main `0ca1c67`。按 [任务书](../tasks/fix-search-progress-bar.md) 和用户后续浏览器反馈完成只读显示与状态区排版修复。未 staging、commit 或 push；浏览器按用户说明由 Claude/用户验收。

## 最终实现与边界

- `Game.ts` 仅新增只读 getter `searchProgress`，直接返回已有 `searchingCharge`，没有新增实例字段，U03 契约不变。
- `useGameHud.ts` 的共享 `playerHudStatusRows` 将正计数投影成“搜索中 n/5”和比例 n/5。Sidebar 和所有 `useGameHud` 消费者共用此数据，保留 `isSidebarVisibleStatus` 过滤。文字使用 i18n 键 `sidebar.searching`，英文兜底 `Searching`。
- ThemeHud 搜索与其它状态共用进度条样式。普通桌面/横屏侧栏不再纵向换列，状态区在力量、护甲、金币、潜行信息下方按栏宽排列，宽度/max-width 为 100%、高度按内容确定；多个状态在内部自动换行。竖屏紧凑 HUD 的状态区也独占内容宽度，并放在面板按钮之后，避免按钮被挤到额外一行。
- 桌面、手机竖横屏、平板的沉浸模式都显示多个有效状态，保持单行；状态区可在 HUD 剩余宽度内收缩，超出时横向滚动，隐藏滚动条、不增加栏高。搜索、中毒、加速等状态不再因紧凑沉浸样式被隐藏。竖屏搜索期间仍暂收起回合数字，归零后恢复。
- 显示层不写计数。原引擎在非搜索回合或第五次终搜后归零，下一次轮询自然移除进度；原完成提示保持。`manualSearch`、TimeCoordinator、命令边界、双 RNG、存档/录像格式、玩家 status、基线和黄金 trace 均未改变。本次排版续修的生产改动仅在 `theme-shells.css`。

只读抽查本地 CE：`Time.c:2394–2430` 连搜充能与第五次终搜，`Time.c:2550–2553` 非连续回合归零；`Globals.c:1795` Searching 目录项、`IO.c:4823–4825` 对所有有名正计数状态绘制通用进度条。`.ce-reference/` 未修改。

## 浏览器反馈与根因

Claude 在 1280×800 桌面布局测得原 `.th-statuses` 为 x=176、y=12、width=73、height=222，换列到侧栏右缘并与地图重叠。这不是状态区进入了新的 App 网格区域：HUD 自身是纵向 flex，但继承 `flex-wrap:wrap`，而状态区使用 `flex-basis:100%`，百分比作用于纵向主轴高度。受侧栏高度约束时，它占满主轴并被换到下一列。同一规则也影响其它状态。

修复取消纵向换列，状态区改为 `flex:0 0 auto`、内容高度、栏内全宽与内部换行；仅 HUD 根参与 App 的 `vitals` 网格区域，状态容器保持内部普通子项（`grid-area:auto`）。沉浸模式覆盖为横向单行、自动宽度、允许收缩及内部滚动。首轮测试只检查了显隐，未检查轴向尺寸；本轮已补齐这些约束。

## 回归与期望更新

`search_progress_hud.test.ts` 最终 19 项全部通过。原 14 项覆盖真实命令连续搜索 1/5–4/5、第五次消失及完成提示、wait/move 清零、长搜索递增、3/5 存读档续搜、回放/seek 零 OOS、实际 Vue HUD/Sidebar 轮询保持世界/时间/双 RNG/录像事件不变，以及三种布局的普通/沉浸显隐。

新增 5 项覆盖 1280×800、390×844、844×390、768×1024、1024×768，每项各验证普通与沉浸模式，共 10 个布局场景。实际 ThemeHud 根带 `area-vitals`，同时显示“搜索中 3/5”、中毒和急行；断言容器父子关系、HUD 的 `vitals` 网格归属、内部状态区的 auto 网格归属、主轴 basis、纵向不换列、宽度/高度边界、在数值信息之后的顺序、多状态可见与滚动规则，并验证状态清空后不留空容器。

先红证据：原 CSS 上新增 5 项全部失败，原 14 项通过（`/tmp/search-progress-layout-before.log`）；仅改 CSS 后新增 5 项全部通过，唯一失败是原显隐测试中两个“紧凑沉浸隐藏其它状态”的参数场景（`/tmp/search-progress-layout-after.log`）。

本轮依据用户新增的多状态要求及 CE `IO.c:4823–4825`，将这两个参数场景的“其它状态隐藏”期望改为“其它状态可见”。这是本任务新增测试的期望更新，不是夹具前提修订；没有放宽容差、删除用例或增加 skip，其它原有测试文件和守卫未改。固定原六项显隐断言、仅切换本轮 CSS 的反事实：旧 CSS 6/6 通过，新 CSS 4 通过/2 失败；测试源码在两次运行间一致，finally 逐字节恢复最终 CSS/测试。证据 `/tmp/search-progress-layout-counterfactual.json` 及对应 `-old.log`、`-new.log`。首轮最初 8 项搜索回归先红日志仍保留在 `/tmp/search-progress-before.log`。

## 最终轻档门禁

续修后重新串行执行，全部退出 0：

| 门禁 | 结果 | 耗时 |
|---|---|---|
| `npx vue-tsc -b` | 通过 | 5.44 秒 |
| `npm run build` | 通过；保留既有大 chunk 提示 | 7.6 秒 |
| 相关测试，`--maxWorkers=2` | 24 文件、421 项通过 | 80.87 秒 |
| 源码读取守卫，`--maxWorkers=2` | 72 文件、107 项通过；1496 项名称筛选未选 | 51.48 秒 |
| 共享读取补充守卫，`--maxWorkers=1` | 7 文件、12 项通过；97 项名称筛选未选 | 312.73 秒 |

相关批次含任务书点名的 i18n、硬编码文本、repo_hygiene、UI-1/UI-2、I-1、FE-1、gameplay_layout，以及原搜索、长搜索、U03、录像、状态列表与 App/SFC 回归。源码守卫采用 `rg` 反查和 TypeScript AST 选取，另补共享读取函数、模块级 CE 目录读取与蓝图中心守卫。各批次有交叠，筛选未选不是新增 skip，也不表示完整套件通过。

本轮完整 argv、阶段结果与原始日志：`/tmp/search-progress-layout-gates/state.json` 及同目录各 `.log`；首轮门禁保留在 `/tmp/search-progress-gates/`。清单与筛选式为 `/tmp/search-progress-related-tests.txt`、`/tmp/search-progress-source-guards.json`、`/tmp/search-progress-source-guard-pattern.txt`、`/tmp/search-progress-shared-source-guards.json`。`src/`、`scripts/`、`public/` 按路径与原始字节累计的冻结前后 SHA256 相同：`282c8d6fa836bf276d02aa6598c47621bc24a97e96c54c1654b1f30fc25c8252`。

按纯显示轻档未运行完整 `npm test`、`test:drift`、`ce:fetch` 或 `test:full`。`git diff --check` 通过；修改/新增文件无 CRLF、无超过 1 MB 的原始证据、无截图。原未跟踪任务书保持原状。

## 浏览器复验项

本轮验证实际 Vue 模板、CSS 规则和网格归属，没有重新测量浏览器像素矩形。请 Claude/用户复验 1280×800 下连搜 3 次，状态容器应位于侧栏数值区下方、宽度跟随栏内可用宽度、高度仅为内容行；再验证中毒/加速与搜索并存及搜索归零、手机竖横屏/平板、各沉浸模式的单行与横向滚动，确保无地图重叠、无异常栏高。原搜索完成提示、长搜索、读档与回放进度继续按任务书验收。
