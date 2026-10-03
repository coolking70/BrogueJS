# 弹窗层 D3：显示事件序列（"--更多--"按顺序播放已结算的回合）

> 分支：`feat/dialog-d3-timeline`（工作区 `BrogueJS-newtheme`，基于 D2 提交 `53bd160`；D1+D2+D3 将一起上线）。
> 依据：`docs/design/in-app-dialogs.md`（已确认）§3、§5、§6、§7.1、§7.2、§7.3 表 D3 行。维护者已确认：死亡默认**按顺序播放**，同时提供"查看结算"直达。

## 目标
模拟仍按现规则同步/分步完成（结果、RNG、日志、录像完全不变）；显示层改为按发生顺序播放：在需要确认的消息（ACK）处停住显示游标，确认后继续播放之后已经发生的帧，直到终局。解决"警报弹出时后续回合已算完、画面直接跳到死亡"的问题。

## 要求（设计 §5.1–§5.3 全部适用，以下为要点）
1. `PresentationTimeline`（UI/会话 WeakMap）：记录 frame / message / acknowledgment / animation-delay / terminal / command-complete，每条有发生序号（非归档 id）。frame 为只读、复制的**已观察**事实（地图可见/记忆部分、位置、HP、状态、日志窗口、必要 HUD），不含可写实体、未知地图或 Game 快照；优先差量/共享不可变底图。
2. 观察点：Logger 现有 log 发生处（归档后、后续业务效果前）、原动画 yield 点、强制麻痹每轮原 epilogue、命令结束与终局。观察**不得**调用 toSnapshot/getState/updateVision/prepareFlareKnowledge，不得消耗两条存档随机流，不得写 Game；纯外观计算用显示专属随机源。headless 关闭捕获。
3. 地图（Pixi）、HUD、侧栏、日志、目标条等组件统一读同一个显示投影/显示游标，不能只冻结画布而 HUD 从 activeGame 提前显示未来；诊断区分 simulationTurn / displayTurn。
4. ACK 期间显示游标停住，Host 始终可交互；输入锁不用于 MORE；5 秒动画 deadline 不计入阅读时间；不暂停引擎迭代器（推荐只暂停显示游标）。显示 backlog 未看完时，admission 拒绝下一条实时命令，自动步计时不积攒。
5. 终局：默认按顺序播放到 terminal；任何时候都提供"查看结算"（D1 已有 view-result，改为接入时间线）：点击即停止剩余演示、直接显示结算，未读消息按原顺序保留在结算界面可浏览，日志归档不删不改 count；保存/导出/返回立即可用；返回标题/新局清该局时间线。
6. 运行方式（设计 §5.2 表）：animationEnabled 开/关、自动探索/旅行/长休息/奔跑/连搜、回放播放/单步（默认不等人，与 CE 一致）、seek/restart/导入（静默、不积压）。可选实现设计中的"诊断回放呈现"开关（默认关闭）以便浏览器重现；若实现，正常导入不继承该开关。
7. 扩展事务等不在主线范围；不做 D4。

## 顺带修复（i18n）
`Game.ts` 约 4083 `food.not_hungry_confirm`：把英文字面量 `'food'` / `'mango'` 改为本地化物品名（例如新增 i18n 键或使用物品显示名），中文提示应为"……这份口粮/芒果……"。

## 测试（设计 §7.1 "ACK/投影""麻痹/死亡"行）
- 21 个 ACK 源、相同文本重复事件逐个保留；序列中消息/地图/HUD/HP 不提前显示未来；不同等待时长/帧率/动画开关下最终世界与双 RNG 完全相同；观察不 flush combat、不提交发现、不写 Game。
- 构造 live 场景（压力板→麻痹气体→麻痹→被攻击→死亡），通过正式输入进入：等待时 displayTurn 不前进、确认后显示游标继续、可随时查看结算、日志不丢、保存/返回可用；动画开/关与自动步模式各一。
- 注意：证据录像 `.tmp-evidence/brogue-web-replay-1791020631948.json` 因 ad50a8e 的 HP 封顶修复已无法在当前代码零 OOS 重放到最后，不能作为端到端验收依据；以构造的 live 场景为准。
- UR2/UR3/UR4、u_27/x2a/x3b、U03、ux_1a_end_ui 默认顺序断言保留。

## 门禁
中档：vue-tsc -b、build、相关测试、全部读源码守卫、UR2/UR3/UR4、u_27/x2a/x3b、U03、test:drift；另跑完整 `npm test`。推进结果出现任何差异 → 退回修代码，不重录黄金 trace/基线。

## 约束与输出
撞上已有测试改代码不改测试（确需改按 AGENTS.md 登记）。不产生 CRLF。**不要 commit/push**。浏览器验收由 Claude 完成：请在报告中给出一个可在浏览器中稳定触发"麻痹→连续被攻击→死亡"的方法（例如测试模式入口、诊断回放或可复用的构造步骤）。报告 `docs/reports/dialog-d3-timeline.report.md`；中文简报。
