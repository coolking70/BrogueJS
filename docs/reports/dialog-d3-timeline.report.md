# Dialog D3：按发生顺序播放已结算回合

执行日期：2026-10-03 至 2026-10-04。工作区 `BrogueJS-newtheme`，分支 `feat/dialog-d3-timeline`，基点 `53bd160`。依据 [D3 任务书](../tasks/dialog-d3-timeline.md) 和已确认的 [设计 §5](../design/in-app-dialogs.md)。已阅读全部指定交接、架构、测试及 D1/D2 报告；未 commit/push。开工时已有的 D3、SFC resolver 两份未跟踪任务书未改动。

## 实现

- `PresentationTimeline` 由挂载的 Host 启用，以 UI/会话 WeakMap 持有；引擎仅增加可选观察端口。frame、message、acknowledgment、animation-delay、terminal、command-complete 都使用递增发生序号，重复文本不共用归档 id 作为事件身份。无 Host 的 headless 不捕获。
- Logger 在原归档及 ACK occurrence 插入之后、调用者后续效果之前通知观察者；另在原慢回合 yield、每轮原 epilogue 之后、原命令提交/最终检查点完成及终局收尾处观察。没有移动规则效果、修改原 yield 或暂停引擎迭代器。MORE 只推进显示游标，不追加命令、答案、骰子或 disturbed。
- 投影复制并深冻结当前已经观察到的地图、实体显示结果、HP/位置/状态、HUD、侧栏、日志窗口及目标信息；不含 Item/Monster/Cell 可写引用、完整地图或 Game 快照。未知格为 null；沿用原 Appearance/知识门、显示专属随机 owner，并共享相同的不可变格/列。观察不调用 toSnapshot/getState/updateVision/prepareFlareKnowledge，不 flush combat，不写 Game，不使用两条存档 RNG。
- Pixi、经典 Sidebar、主题 HUD/附近列表、ContextPanel、MessageJournal、TargetBar 统一读取该游标。光标期间地图 hover/附近详情不会查询未来实体。背包持有可写物品引用，因此 backlog 期间隐藏，卷轴揭示 ACK 播放完后才开放原必选目标列表；喝药/食用后的延迟 escape 等推进、确认和演示都完成后经原命令入口补发。两条 ACK 之间无 Host 请求的动画间隔也保持延迟关闭。
- ACK 等待不累计显示动画时间，原 iterator 继续完成。backlog 期间正式 live 命令及外部 system 输入被 admission 拒绝；保留引擎驱动栈内的原嵌套自动入口。自动步计时沿用 stepCadence，阻塞期间丢弃 elapsedMs。原五秒动画 deadline 不等待显示阅读。
- 死亡默认播放到 terminal 后开放结算。模拟已终局时，MORE 内和两条 ACK 间的动画间隔都有“查看结算”；其键盘/指针生命周期仍由 DialogInput 仲裁。直达会停止剩余演示，把原未读 occurrence 按序留在结算，归档及 count 不变；终局晚到消息留在非模态未读区。新局、有效读档、返回标题、Host epoch/卸载清理该局队列及旧 token。
- replay loaded/playing/step/seek/restart 均以 replayRecording 静默关闭捕获，不累积 ACK。未实现可选诊断回放开关。保存/导出仍使用模拟完成的最终检查点；菜单反馈说明演示尚未看完。规则确认未完成时保留 D2 的保存/导出限制。
- 饱腹食用提示的 food/mango 参数改为 `name.Ration of Food` / `name.Mango` 本地化值；中文显示口粮/芒果。新增一条菜单反馈 i18n 键。没有新增 Game 字段，不需改 U03 契约或存档/录像格式。
- 内存保护在同一 backlog 详细帧达到 128 后省略可选动画帧及对应延迟，保留消息、全部 ACK 帧和终局。诊断记录 suppressedFrames/captureFailures；观察失败不会吞掉 ACK 或进入引擎业务异常路径。`render_game_to_text` 同时报告 simulationTurn、displayTurn、发生游标、backlog 与终局资格。

CE 使用给定只读 `.ce-reference/`，未 fetch/修改。核对了 `IO.c:2914–2927` 的 MORE 接受键与回放免等待、`Time.c:240–266` 的压力板警报先于陷阱效果、`Time.c:475–490` 的玩家麻痹警报先于状态写入。主线扩展事务不在本任务范围；D4 原生闪现确认未改。

## 回归与失败处理

新增 `presentation_timeline.test.ts` 21 项，已登记常规套件；真实客户端 Host 测试新增 7 项（原 13 项保留）。

| 范围 | 证据内容 |
|---|---|
| 21 个 ACK 源 | AST 钉住现有 21 处生产 ACK 发源，并逐一经公共 Logger 观察入口证明有独立投影及顺序；不是宣称独立构造了全部 21 条规则分支 |
| 重复、只读、内存 | 102 次相同文本逐次确认、归档 count 封顶 100、独立序号/旧 token 无效；冻结 DTO/未知格/共享列；禁止观察副作用与双 RNG 变化；可选动画压缩保留 ACK/terminal |
| 真实 live 场景 | 单条正式 move 或 auto_step 进入隐藏压力板→麻痹气体→强制回合→连续攻击→死亡；动画开/关；首条警报 HP=36 而模拟已 HP=0，等待 60 秒游标不动，继续后按序看到后续状态和终局 |
| 最终推进一致性 | 手动/自动入口 × 动画开/关 × 1/25/1000ms 显示帧，完整世界快照、原录像事件与双 RNG 对无 UI 推进严格相等；保存时间戳固定或只规范化该元数据。慢回合在原 yield 内出现 ACK 后 iterator 继续，原最终检查点不变 |
| UI 与生命周期 | 实际 Vue 客户端 Host/HUD/附近列表/日志/目标条/结算组件共用显示游标；查看结算保留未读且保存/返回可用；动画间隔匹配的新指针释放；新局/读档/reset 失效旧 token；鉴定/附魔揭示之后才开放强制目标；背包延迟关闭保留 |
| 自动/回放/决策 | auto_explore、mouse_travel、auto_rest、run、search_long 的 backlog admission 与 cadence 丢时；ACK 先于原经典确认；自动吃食物原效果前观察；回放载入/播放/单步/seek/restart 不发 Host、零 OOS |

**旧测试断言、白名单、容差、种子、超时、skip、黄金 trace 和生成基线均未改。** `dialog_host` 只增加新客户端组件所需模块映射及 D3 用例；原 D1/D2 用例语义保留。

- 初轮已有 R1 色值计数和 UI4 手写 SFC 依赖守卫失败，分别改生产代码共用光标 stroke、通过已有 UI 模块出口接线解决，守卫未改。
- 新测试编写期间修正了 ACK AST 动态参数计数、保存时间戳、重复归档查找和新客户端计时夹具；没有据此修改生产规则或旧断言。
- `new-regression-counterfactual.log`：只把 Game.ts 暂时回退到 D2，保持其余生产/新增测试，真实死亡序列新增回归失败；finally 恢复生产字节。它证明新增回归可抓到缺失观察点，不作为旧测试前提修订。
- 冻结复查发现背包会在揭示 ACK 前暴露目标、动画间隔会丢失延迟关闭，因此中止第一次门禁。`inventory-before-fix.log` 三项新增回归均失败；修复后两类目标及延迟关闭通过。鉴定测试布景另明确加入未知药水，避免依赖开局是否恰有可鉴目标。
- 第一次门禁仅 type/build exit 0；完整 npm test 被人为中止，没有完成结果，不能计作通过。原日志及中止原因保存在 `gates-interrupted/`。最终冻结门禁重新从头执行。

## 最终门禁

本地原始证据在 `/private/tmp/dialog-d3/`，不入仓库。最终代码冻结后重新完整执行，以下全部 exit 0：

| 门禁 | 结果 | 本地证据 |
|---|---|---|
| `npx vue-tsc -b` | 通过 | `type-final.log` |
| `npm run build` | 通过；仅既有大 chunk 提示 | `build-final.log` |
| 相关回归（2 workers） | **9 文件 / 197 项通过**，38.79 秒 | `related-final-inventory.log` |
| 完整 `npm test -- --maxWorkers=2` | **250 文件 / 4550 项通过**；既有 8 skip / 5 todo，1140.65 秒 | `npm-test-final.log` |
| 生成套件源码守卫（单 worker） | **7 文件 / 12 项通过**；132 项为名称筛选未选，370.67 秒 | `source-guards-final.log` |
| `npm run test:drift` | **2 文件 / 2 项通过**，49.48 秒 | `drift-final.log` |

完整常规套件含 UR2/UR3/UR4、U27、x2a/x3b、U03、UX-1 默认顺序及常规全部读源码守卫。生成套件补跑 c_4a 的生产读写白名单、b_1a 免费入口、v_1a 墓碑、v_2b_4 的 D1/D2/D3/D5/E4 扫描、p1_37 扫描器门和 blueprint_center 的 b 全局扫描；蓝图中心按原种子/门限完成。完整命令、逐阶段退出码和有序路径/字节散列在 `gates-state.json`，runner 在 `run-gates.py`。

门禁前后 `src/` + `scripts/` **576 文件** SHA-256 完全一致：`af3e24279d4a777e45c0b84e8e2bfb1484203fef50ecbac5f8a9fe6683f7b9ca`。随后仅补报告和 progress 文档。`git diff --check` 通过，本轮 29 个变更文件均无 CRLF、无超过 1 MB 的文件；`src/test/fixtures` 零变更，未 staging/commit/push。产物检查记录在 `artifact-audit.json`。

## Claude 浏览器复现

本轮标准 Playwright 客户端启动 Chromium 被 macOS MachPort `bootstrap_check_in: Permission denied` 拒绝，未产生可验收的游戏截图。上述组件测试使用实际 Vue 客户端 SFC 宿主，不能替代 Pixi、四视口、物理触摸及几何验收；按任务书交 Claude。

开发浏览器的稳定 live 布景复用 `src/test/support/dialogD3Scene.ts`，不是历史失效录像：

1. 在本工作区 `npm run dev`，打开 Vite 地址，正常开始新游戏。
2. 浏览器控制台执行（构造布景后实际行动仍由正常按键进入）：

   ```js
   const { setupDialogD3Scene } = await import('/src/test/support/dialogD3Scene.ts');
   window.activeGame.startNewGame({ seed: 33421 });
   setupDialogD3Scene(window.activeGame, true);
   ```

3. 释放旧按键，按一次右箭头，进入 (11,10) 隐藏麻痹板。邻接 (12,10) 哥布林会在麻痹气体内继续攻击；测试怪物明确免疫麻痹、HP=1000、准确率=100，玩家 HP=36、无武器/护甲，因此可稳定死亡。
4. 在首条压力板 MORE 等待超过 6 秒：应显示当时地图/HP=36，HUD/日志/附近信息没有提前显示死亡；`JSON.parse(window.render_game_to_text()).presentation` 应看到 simulationTurn 大于 displayTurn，显示游标不变。先松开触发方向键，再用新的 Space/Esc 或 MORE 按下/释放逐条继续；后续麻痹、攻击帧、HP 与日志依序前进，最后才出现结算。
5. 另开新局重新布景，首条 MORE 或两条 ACK 的动画间隔点击“查看结算”：立即到结算，剩余 occurrence 在未读区按序可读，返回可用。死亡世界可保存；返回标题再开局应没有旧警报/投影。
6. 每轮均重新 startNewGame 使用 seed=33421，再布景。动画关闭复验把参数换成 false；自动步复验在布景后通过正式入口执行：

   ```js
   window.activeGame.autoPath = [{ x: 11, y: 10 }]; // 仅诊断布景
   window.activeGame.executeCommand('auto_step');
   ```

手工布景会明确撤销“从 seed 开始的完整录像”资格，不能把其录像导出误称为可零 OOS 重建的完整局；因此该 fixture 不用于证明完整录像导出资格。正常局录制/回放/保存续录由原 U27、x2a/x3b、UR2/UR3/UR4 及新增静默回放测试验证。任务书指出的旧证据录像未用作端到端依据。
