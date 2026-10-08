# 5G 维护者验收记录（2026-10-08）

dot 集中返工 `bca0c5b5c06a2c01395ddb132f8b8bd0a14df8c0` 的代码审查与本地相关门禁通过；维护者补齐三项界面问题、录像导入循环和共享候选存档时钟问题。上述修复可提交至 `codex/phase5g-maintainer`。本记录不代表已经合入 `ext/phase5`，也不把原生窗口失焦、真机及 5Z 缺口记为通过。

## 修复与独立审查

- `8af6ef55342ac30bb68b3b4035ce0743b0939d02` 已修复 R-E01：候选存档属性校验使用候选时钟，合法旧档不再因目标活局增益已过期而拒绝。详见 [报告](phase5g-load-clock.report.md)及[独立审查](phase5g-load-clock.review-findings.md)。相关 346 项、独立加载边界和实际 drift 通过。
- 背包按共享可食定义开放生菌、烤菌和实际可食焦炭的食用入口；名称和详情从原始 Item 身份读取，避免 Vue 代理丢失外观知识。320 宽普通竖屏的地图四控件改为两列，保留 44px 目标。见 [报告](phase5g-browser-fix.report.md)及[独立审查](phase5g-browser.review-findings.md)。UI2 相关 188 项、独立真实 SFC 73 项通过。
- Logger 在回放显示已禁用且确认队列已经为空时不再重复发送清空通知，解除真实 App 导入录像时的响应循环；有陈旧确认内容时仍清理一次。原 39 事件录像逐字保留为回归 fixture。见 [报告](phase5g-replay-import.report.md)及[独立审查](phase5g-replay-import.review-findings.md)。相关 20 文件 456 项、独立 12 项通过，旧 Logger 单变量反事实失败符合预期。

三个开发增量均由原执行会话实现，另一个只读会话独立审查；指挥核对后提交。九冻结接口、foraging 数据、locale 和两条原自然 trace 未改。无新 Game 字段或协议版本改动。

## 最终固定候选与门禁

外部证据根 `/private/tmp/brogue-commander-20261008-5g-revision`。UI3 源快照 2660 文件，路径排序后“路径+NUL+SHA256+LF”聚合为 `4fc71d19f06f045137f539712aabf0ed71400e65367727b836a4a15f5c1c57e5`；59 文件构建聚合为 `cb422083c8f81050bb38a7a92380492b56d8a39d740224ecb9b2451499f34b03`。`candidate-ui3/candidate.json` SHA256 为 `5da841f7915da8545fbe762adc8bb82854f1eca7c98026cec989c9fb704bd0bb`。门禁及浏览器均核对同一输入，后来新增报告不改变生产或测试源。

Node 24.19.0、3 GiB、Vitest 最多 2 workers。最终 foraging 20 文件 **849 passed，0 failed/skipped/todo，exit 0**；共享相关 **456 passed**；boundary、vue-tsc、build 均 exit 0；**实际 `npm run test:drift` 6 文件 12 passed，exit 0**。各集合有交叠，不累加成唯一测试总数。读源码守卫 41 项通过，101 项为选择范围之外，不是新增 skip。

dot 回执的共享 347 项和四份删除副本 845/846/846/833 仍分别归属 dot 的证据；本地未重复这四份物理删除副本。所有早期红灯、布景错误和脚本前提错误保留，没有用后续通过覆盖原始退出码。

## 实际浏览器证据

固定 UI3、Chromium 145，1440/390/320 × 普通/沉浸 × 四种地图 **24/24 通过**，`browser-ui3-tools/ui3-matrix-first` exit 0。指挥直接查看 UI3 四张代表图及相关功能截图；此前同字节组件的 UI2 全 24 图检查作为补充，不冒称全部是 UI3 新截图。

- 三个关键容器及额外 320 普通容器：真实采集、未知菌外观、背包食用 No/Yes、原生导出/文件选择器导入、seek 和三页签只读操作均无失败；批次 exit 2 的唯一未覆盖项为原生窗口失焦。路径 `browser-ui3-tools-second/ui3-critical-second` 和 `ui3-critical-320-normal-second`。
- 再生：正常 seed 2 中通过实际移动和攻击解除豺狗威胁；32700 tick 节点仍空，32800 再生按钮可用，原生重采后 32900、库存 21→22。无注入时钟、生命、敌人或 RNG。`ui3-regrowth-second` exit 0，录像和节点前后截图完整。
- 烤制：正常 seed 6，实际放置热源、采集、烤制、确认食用、再烤成焦炭；27 条机械命令及成本与原 trace B 语义一致，实际 65 事件录像导入/seek/只读通过。`browser-ui3-tools-fourth/ui3-roast-fourth` exit 0。当前 UI `item:command eat|f|` 与旧 trace `item:execute eat|f` 仅按已审明的同一公开命令含义比较；未知、额外命令和成本差异仍拒绝，原 trace 未改。
- 原导入卡死的 39 事件文件 SHA256 `f2a22fc3b3b7eb81ae68630c8f0c760ad83342b444bc780dc3f161b908daca9e` 在 UI3 原生文件选择器导入成功，菜单自动关闭，seek 39→0→39 正常。`browser-ui3-diagnostics-second/original-import-first` exit 0。
- 42 个受控组件展示场景通过，包括长名称、多食物、多同伴、无热源、满背包、零同伴、只读、提交中及隐藏态。该 Game-less fixture 只证明实际组件显示和事件隔离，不等于自然游戏或真机证据；组件源与 UI3 逐字相同。

## 保留的缺口与后续

原生窗口失焦 **未覆盖**：三容器中两个不同窗口都报告 `document.hasFocus() === true`，没有进入严格测量区间。独立审查通过的外部预加载器仅在内存将 Playwright 主初始化焦点模拟设为 false；协议日志确认 12 次 false 均获响应、六个主会话发生于导航之前，但仍未建立唯一焦点。`browser-ui3-focus-primary-first/native-blur-first` exit 2、零产品断言失败。旧关键批次的 exit 2 原样保留；不得以配置成功或模拟 dispatchEvent 替代真实 trusted blur。

真实设备按返工包约定留用户/5Z；自动化触摸模拟不是真机。各特殊布景独立完整自然录像、完整 npm test、全部 test:ext、128 子集、完整阶段删除矩阵和极限压力仍留 5Z。本文允许提交已审通过的代码，不宣布所有浏览器/阶段门禁完成。

5D1 仍在另一工作树开发；其完整验收后再做语义集成，尤其保留该线 Logger 事务身份回滚，同时纳入本次无变化读不通知的修复。不得用整文件覆盖跨线变更，不推进 main 或 foundation。
