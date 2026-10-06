# 阶段 3/4 收尾补丁报告

执行任务：`docs/ext/polish-3-4.task.md`。分支 `ext/polish-3-4`；开工时除未跟踪的任务书外工作树干净。本轮不暂存、不 commit、不 push。

八项修复已实现。按任务书执行相关回归、boundary、类型检查、构建，不跑完整 npm test、删除矩阵、CE 全量或生成普查。规则数值、数据包、版本号、Game 字段、存档/录像格式、旧基线与黄金 trace 均未修改。

## 逐项原因与改动

| 项目 | 原因 | 改动与验证 |
|---|---|---|
| 1. DEV 夹具污染后续对局 | WeakSet 本来按对象隔离；真正问题是页面复用同一 Game，`startNewGame` 只退役生产调度绑定，留下夹具标记。 | `ActorActionSession.ts` 新增仅供新局退役的清理函数；`Game.startNewGame` 在参数/模块/初始命令预检通过、旧调度与 runtime 退役后调用。当前夹具局仍禁止快照/存档/录像导出，错误新局参数也不能清掉标记；载入快照和普通 unbind 不获得清理能力。新增回归覆盖真实 DEV 夹具、全新 Game、同一 Game 再开 combat 局、等待命令与正常导出。 |
| 2. 预警 HUD 裁切 | 固定 `max-height:72px` 容纳不下体力、韧性、弹反和预警的换行内容。 | `CombatTelegraphHud.vue` 按内容高度、全容器宽度排版，上限为 `min(144px,20dvh)`，超限内部滚动并阻止滚动链传播。普通布局不被纵向 flex 压缩；沉浸布局保留可收缩的横向分配。没有新增覆盖地图的绝对定位层。 |
| 3. 篝火按钮过宽 | 名称、完整时长和完整禁用说明同时增加单行按钮宽度。 | `CombatAttackBar.vue` 主标签简写为篝火名称，时长和可用/禁用说明放到完整 title；禁用说明保留在按钮下方，限制到 4em，超出显示省略号。维持原来的单行横向滚动合同，多个休息点仍可在栏内滚动选择；说明对话框仍显示完整时长和条件。原 parry UI 单行守卫和 bonfire UI 测试通过，未改旧断言。 |
| 4. 怪物名称/状态截断 | 刻符周围列表和传统侧栏将名称强制单行；长状态缺少换行边界。 | `ThemeNearby.vue`、`Sidebar.vue` 和刻符 CSS 允许名称、行为、状态换行，限制最小宽度并允许长词断行；保留 HP 数字空间，名称/行为/状态补全文 title。仅渲染原有公开行，不读取额外隐藏信息。 |
| 5. 三类日志缺失 | 成功弹反和休息最终结算只改动作/收据，未写入消息通道。 | `PhasedAttackProduction.ts` 在玩家弹反成功、窗口已消费后记录一次；失败接触和再次接触不记录，NPC 弹反不泄露为玩家成功消息。`WorldRestProduction.ts` 在休息完成或中断、收据已提交且 active 已清除时记录一次，轮询/重复 settle 不重复。成功沿用 `#88ccff`，中断沿用警示色 `#ffaa44`。基础层键 `actor_action.parry_success`、`world_rest.completed`、`world_rest.interrupted` 同时提供中文、英文资源和英文 defaultValue，不依赖可删除模块的文案。新增回归覆盖成功/失败/重复接触、部分休息/完成/中断/重复结算，以及消费者拒绝后弹反日志随事务回滚。 |
| 6. NPC 空标题残留 | 附近日记仍存在时整个模块栏继续显示，而附近区块仅检查非回放，没有检查 nearby 列表。 | `NarrativeInteractionBar.vue` 仅在非回放且 nearby 非空时显示整个“附近的人”区块。新增真实组件渲染回归覆盖 NPC 存在→离开，空标题消失而日记入口保留。 |
| 7. 缩放按钮难辨 | 组件背景透明，刻符全局又将整个控制组降到 0.72，沉浸模式降到 0.45；仅改组件无法覆盖这些规则。 | `MapZoomControls.vue` 和 `theme-shells.css` 使用不透明按钮背景，控制组 opacity 为 1，边框由当前前景与边框色混合，提高对比。按钮位置、尺寸、四项操作及禁用判定不变。颜色继续读取主题变量，亮暗配色共用这一规则。 |
| 8. 角色页加载文字溢出 | 加载/失败文字比正常“角色”长很多，HUD/技能栏按钮和底部固定宽命令格缺少可收缩、截断的标签。 | `GrowthHud.vue` 将文字放入可收缩标签并省略超长部分；`GrowthSkillBar.vue` 的角色页入口可收缩且最大占 55%；刻符命令格标签统一在自身宽度内省略，`CommandBar.vue` 补完整 title。HUD/技能栏提示显示完整加载或失败文案；点击取消加载和重试逻辑保持原样，原异步 UI 回归通过。 |

## UI/样式清单与预期布局

修改的组件：`CombatTelegraphHud.vue`、`CombatAttackBar.vue`、`NarrativeInteractionBar.vue`、`GrowthHud.vue`、`GrowthSkillBar.vue`、`MapZoomControls.vue`、`Sidebar.vue`、`theme/ThemeNearby.vue`、`CommandBar.vue`。全局样式仅修改 `src/assets/theme-shells.css` 中对应缩放、名称/状态和命令标签规则。

下表是基于最终组件/CSS 的**预期效果**，不是浏览器实测像素或截图验收结果：

| 宽度 | 预期效果 |
|---|---|
| 320px（例：320×640） | HUD 随内容增长，最大 128px，长预警换行且末行可内部滚动到达；篝火短标签减少单行占用，过多按钮仍在栏内滚动；名字/状态在现有列表宽度内换行；长加载标签省略，完整 title 可查看；缩放组不再淡出。 |
| 390px（例：390×844） | HUD 上限 144px，更多资源/预警行可直接显示；篝火、怪物长名、加载/失败提示沿用相同宽度边界，不扩大容器。 |
| 桌面（例：1280×800） | HUD 上限 144px，正常短内容不留固定高度空白；侧栏名称和行为可多行显示，HP 数字保留；篝火时长在提示/说明框显示，加载长文案在有余量时完整显示；缩放背景与边框保持可辨。 |

亮/暗配色检查限于源代码：背景、前景和边框继续使用当前主题变量，opacity 不再降低整个组的文字对比。真实亮暗截图、320/390/桌面滚动末行和地图可见面积仍需浏览器复验。

## 验证命令与结果

所有 Node/npm/npx 命令均将 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` 放在 PATH 前；实际 `node --version` 为 `v24.19.0`，`NODE_OPTIONS=--max-old-space-size=3072`，所有 Vitest 命令均带 `--maxWorkers=2`。

最终统一批次于北京时间 2026-10-06 16:45:12 完成，五个命令全部 exit 0：

| 命令 | 结果 |
|---|---|
| `npm run check:modules` | 模块边界和测试归属通过；1.62s。 |
| `npx vue-tsc -b` | 通过；6.94s。 |
| `npm run build` | 类型检查与生产构建通过；9.58s。仅有构建产物超过 500kB 的常规提示。 |
| `npx vitest run <54 个相关文件> --maxWorkers=2` | **54 文件 / 1035 项全部通过**；Vitest 167.47s。完整参数数组见 `final/gate-state.json` 的 related.command，文件清单见 `final/related-files.json`。 |
| `npx vitest run src/test/c_4a_terrain_catalog.test.ts -t 'promote/fire 类字段的生产读者' --maxWorkers=2` | 1 项源码读者白名单守卫通过；其余 29 项因 `-t` 定向筛选未运行，未添加 skip。 |
| `git diff --check`、变更文件 LF 检查 | 通过，无 CRLF。 |

本批次执行入口为 `python3 /tmp/brogue-polish-3-4/final/run-gates.py`；完整 argv、文件清单、各命令日志与输入 SHA256 清单保存在 `/tmp/brogue-polish-3-4/final/`。960 个生产/测试/脚本/资源与根配置输入在门禁前后完全一致；`inputs-before.json` 文件 SHA256 为 `1e96d2ed8281db08b18573fd5cf1aca5b7f489f00a5dd635f2c84dcf40f7ec3a`。

相关集合包含 combat 模块现有 33 个测试文件，growth 创建/角色 UI、narrative UI、新局/夹具/状态合同、模块组合、身体 SFC/侧栏、布局/触控/刻符/沉浸显示，以及 i18n、硬编码文本、repo hygiene、套件归属，共 54 文件。没有执行删除矩阵。

过程证据：

- 修改生产代码前，新增的夹具/三类日志回归 4 项全部失败；修复后 4 项全过。日志：`red.log`、`green.log`。
- 首轮三个运行时文件完整 85 项通过，界面/事务五文件 130 项通过：`core-related.log`、`ui-related.log`。
- 首轮统一批次 boundary、54 文件/1035 项相关回归和 terrain 源码守卫通过；type/build 因新增 narrative SSR 测试的手写翻译函数缺少 i18next TFunction 品牌类型退出 2。随后只将这个新测试的桩改成真实 i18next 实例，并收窄篝火禁用提示宽度，最终批次从头运行。原日志和退出码保留在证据根目录，不覆盖为成功。
- 新增共 6 项行为回归，均追加到现有已登记测试文件。旧守卫、旧断言、旧夹具未修订；未重录任何基线/trace，无需旧测试前提反事实裁决。
- 三个新日志键通过独立 i18next 实例分别验证中文与英文资源实际输出。

## 浏览器验收边界

已按 develop-web-game 技能尝试运行原 Playwright 客户端，并检查可用浏览器工具。Vite 启动失败：`listen EPERM: operation not permitted 127.0.0.1:5407`；原客户端启动 Chromium 失败：`bootstrap_check_in … Permission denied (1100)`。共享 Browser Use runtime 不提供 `agent`，CUA 浏览器清单为空。

因此本轮没有产生可查看的真实游戏截图，也没有声称通过真实 320/390/桌面或亮暗主题像素验收。失败命令与日志：`/tmp/brogue-polish-3-4/dev.log`、`client.log`。客户端调用为：

```sh
node /Users/coolking70/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js --url http://127.0.0.1:5407 --actions-json '{"steps":[{"buttons":[],"frames":1}]}' --iterations 1 --screenshot-dir /tmp/brogue-polish-3-4/browser
```

组件渲染、现有 320/390 SFC/布局回归与源码检查不能替代上述浏览器验收。截图及原始门禁证据均未加入仓库。
