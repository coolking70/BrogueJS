# 按住方向键遇确认框后的重复输入修复报告

日期：2026-10-02。分支 `fix/dpad-repeat-confirm`，基点 `912d7a1c1d5acda92474d8e6cdb73260eb7f1912`。依据 [任务书](../tasks/fix-dpad-repeat-confirm.md)。未 commit/push；完整 `npm test` 和真实浏览器验收按任务书交由用户/Claude 完成。

## 根因与修复

沿用 Claude 已确认的录像结论：`.tmp-evidence/brogue-web-replay-1790903526009.json` 的 1176–1194 条各为带 `[false]` 的独立 `move 1`，1195 条 `[true]` 后仍持续派发，换方向才停止。原生确认框吞掉松手事件，DPad 延迟/重复计时器没有被取消。另有一个同步竞态：首条 move 内弹框后，旧 `press()` 返回时仍会创建新的计时器。

- 新增 `src/ui/heldInput.ts`：统一登记按住输入的停止函数，确认、失焦、页面隐藏和模态入口调用同一取消机制。引擎不是 Vue 响应式对象，因此登记只读模态上下文，在输入、渲染请求、显示帧以及重复派发前检查新开启的模态；关闭模态不重启旧按住。
- `App.vue` 的确认钩子先取消所有按住输入，再调用原来的同步 `window.confirm()`。答案返回值和回放旁路保持原语义。
- `DPad.vue` 增加活动标志，首条命令内发生取消后不会重新创建计时器。正常节奏仍为立即一条、350ms 延迟后每 140ms 一条；中心休息仍不重复。注册指针捕获，处理抬起、取消、离开、丢失捕获；捕获期间根据原按钮矩形检测越界移动。
- 地图长按轮询抽到 `src/ui/mapTouchInput.ts`，由 `GameCanvas.vue` 使用。取消同时清计时器、手势指针和捕获，迟到的抬起不会变成 tap。正常短按、一次长按查看、拖动、双指捏合保持原输出；长按消费后立即结束轮询。`GestureTracker` 仅新增 `reset()`。
- App 同步观察菜单、侧栏/沉浸展开面板、日志和列表详情入口；GameCanvas 观察背包、帮助/发现、检视、目标选择、鉴定/刻符/物品确认、消息确认、终局和回放。命令栏“更多”及命令环展开同步通知 App 取消。菜单与游戏内回放播放入口也先取消。
- 已开启的目标选择允许新的按住继续移动瞄准光标；只有此前那次按住被取消，不存在自动恢复路径。

## 输入边界审计

仅修改输入/表现层。DPad 仍经 `ui/commands.dispatch`，地图手势输出仍交给 GameCanvas 原有命令/查看落地路径；没有改 `Game`、规则、确认决策记录、随机数、存档或录像格式，没有新增 Game 字段，没有重录基线或黄金 trace，也没有新增玩家可见文本。

扫描全部生产 `setTimeout` / `setInterval`：仅 DPad 移动重复和地图长按轮询属于自建按住计时器；其余为显示轮询、动画、布局或导出等待。`Input.ts` 的 `keybMap` 只在 keydown/keyup 写入，没有读者、计时器或逐帧派发，不会因 keyup 丢失自行继续发命令；本轮没有修改它。

## 回归与旧测试前提修订

新增 `dpad_hold_input.test.ts`（25 项）与 `map_touch_input.test.ts`（20 项），覆盖首条/重复 move 的确认与取消、正常节奏、重新按下、抬起/取消/离开/丢失捕获、捕获越界、失焦/隐藏及恢复、模态开启/关闭、卸载清理、地图迟到 tap、正常地图手势。使用真实客户端 SFC 脚本/模板/生命周期和 EventTarget/假时钟；原生浏览器事件仍待用户验收。

实际 App 组件回归覆盖菜单、面板、日志、详情、命令面板和命令环的取消接线；目标选择期间新的按住仍可重复。实际引擎回归验证 4 次正常派发录成 4 条独立 move，导出后另一实例零 OOS 回放。既有 UI-1 确认与 FE-1 录像边界用例另在相关批次运行。

先红证据：在旧生产代码上新增初始 8 项测试，6 失败/2 通过；首条确认后 5 秒累计 34 条 move，重复确认后累计 37 条，blur/visibilitychange 也未停止。日志 `/tmp/dpad-hold-before.log`。补齐生产机制后初始及扩展回归全部通过。

仅修订三份旧测试的模块装配前提，未修改任何断言、容差、超时、skip 或守卫白名单：

| 测试 | 原失败与单变量反事实 | 唯一修订 |
|---|---|---|
| `ui_4_glyph_feedback.test.ts` | 新 App 缺 `./ui/heldInput` 映射，装配失败；只回退 App.vue，原 23 项全过；finally 逐字节恢复 | 模块表加入真实 `./ui/heldInput` |
| `x3_u5_ui.test.ts` | 新 DPad 缺 `../ui/heldInput` 映射；只回退本轮 App/DPad 生产文件，两份原组件测试共 18 项全过；finally 逐字节恢复 | 模块表加入真实 `../ui/heldInput` |
| `immersive_polish.test.ts` | 同上；新 App/DPad 的依赖未在手工 SFC 编译映射中登记 | 模块表加入真实 `./ui/heldInput` 和 `../ui/heldInput` |

原失败日志 `/tmp/dpad-hold-after.log`、`/tmp/dpad-existing-before.log`；反事实日志 `/tmp/dpad-ui4-counterfactual.log`、`/tmp/dpad-components-counterfactual.log`。恢复新生产、补映射后的 5 文件扩展批次 85 项通过；后续另加 1 项真实重复录制/回放回归，通过。

## 最终门禁

全部串行运行并退出 0。日志与完整 argv 在 `/tmp/brogue-dpad-gates/state.json`；该目录保存每批原始日志。`src/`、`scripts/`、`public/` 按路径排序后累计路径与原始字节，冻结前后 SHA256 均为 `9622e8db75ccbb4e0cd266ce6f20c1174dfd96078fd7e907d445e02b2681d220`。

| 门禁 | 结果 | 日志 |
|---|---|---|
| `npx vue-tsc -b` | 退出 0，4.79 秒 | `typecheck.log` |
| `npm run build` | 退出 0，6.81 秒，953 modules；保留既有 chunk 大于 500 kB 提示 | `build.log` |
| 相关前端/输入批次，`--maxWorkers=2` | 24 文件、322 项通过，21.15 秒 | `related.log` |
| 源码读取守卫，`--maxWorkers=2` | 72 文件、107 项通过，1496 项因名称筛选未选，46.93 秒 | `source-guards.log` |
| 共享读取守卫，`--maxWorkers=1` | 5 文件、7 项通过，41 项因名称筛选未选，269.01 秒 | `shared-source-guards.log` |

相关批次包含任务书点名的 FE-1、I-1、UI-1/UI-2、gameplay_layout、i18n、硬编码文本、repo_hygiene；另含全部新增 45 项、键盘/模态、实际 App/SFC、既有移动安全确认、R-1 显示边界、绘制合并确定性、自动行动/回放节奏、主题与终局组件回归。文件清单 `/tmp/dpad-related-tests.txt`。

源码读取守卫采用 `rg` 文件反查与 TypeScript AST 选择（101 个定义展开为 107 项），清单/筛选式保留在 `/tmp/dpad-source-guards.json`、`/tmp/dpad-source-guard-pattern.txt`。另外补查共享读取函数和模块级读取：真实组件/CSS读取文件完整运行；共享读取批次覆盖实例字段、环境 DF、内容目录、CE 地形字段和蓝图中心人口记录帮助函数的源码断言。蓝图中心两用例按原种子与原门限完成真实扫描，没有删种子或改超时。共享读取清单 `/tmp/dpad-shared-source-guards.json`。各批次有交叠，不能相加冒充全量通过数；1496/41 项是筛选未选，不是新增 skip。

`git diff --check` 通过，修改/新增文件无 CRLF、无 >1 MB 原始证据；未 staging/commit/push。原未跟踪任务书保持原状态，`.tmp-evidence/` 未改动。按轻档任务书未运行完整 `npm test`、`test:drift`、`ce:fetch` 或 `test:full`；规则层未变，浏览器与完整套件结果不在本报告的通过结论内。

## 用户/Claude 验收项

在真实触屏/指针环境按住方向进入危险区域，分别取消、确认后继续等待，检查只弹一次、松手无残留移动，重新按下才恢复正常移动；另测地图长按、捕获移出、抬起/取消/丢失捕获、切换窗口/隐藏页面、各模态、目标选择、终局及回放。确认每次正常重复仍独立录制，回放零 OOS。完整 `npm test` 按任务书由验收方运行。

浏览器按用户说明未使用，未采集截图。`.tmp-evidence/` 及大体积证据保持本地，不加入交付。
