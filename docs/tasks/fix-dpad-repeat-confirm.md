# 修复：按住方向键遇到确认框时，取消后反复弹窗（自动重复失控）

> 分支：`fix/dpad-repeat-confirm`（工作区 `BrogueJS-newtheme`，基于 main `912d7a1`）。
> 来源：用户试玩反馈，录像 `.tmp-evidence/brogue-web-replay-1790903526009.json`（种子 438203017，普通模式；该目录不入库）。

## 现象
玩家要走进点燃的区域时，弹出"是否进入"的确认框；点"取消"后确认框立刻再次弹出，反复出现，只有点"确认"才能结束。

## Claude 已确认的根因（录像证据）
- 录像第 1176–1194 条：玩家停在 (65,5)，连续 19 条**各自独立**的 `move 1`（向下）命令，每条都带一次确认决策 `[false]`；第 1195 条 `[true]` 后走到 (65,6)。
- 第 1196–1222 条：确认之后仍有 27 条 `move 1` 持续发出（撞墙不推进回合）；直到第 1223 条玩家按了另一个方向（`move 3`）才停止。
- 结论：`src/components/DPad.vue` 的按住重复（350ms 后每 140ms `dispatch('move')`）靠 `pointerup` 等事件调用 `stop()`。引擎的确认走 `App.vue` 里的同步 `window.confirm()`（原生模态会阻塞页面），用户松手的指针事件被原生对话框吞掉，`stop()` 没有被调用，重复计时器一直运行；每次取消后下一个重复又触发移动 → 再次确认。按下另一个方向时 `press()` 先 `stop()`，所以换方向才停。

## 要求
1. DPad 的自动重复在以下任一情况必须立即停止，并且不会在之后自行恢复：
   - 引擎发起任何确认（`requestConfirm` / App.vue 的 confirm 钩子）之前——在弹出原生确认框前先取消所有"按住重复"；
   - 指针抬起/取消/丢失捕获（`pointerup`、`pointercancel`、`lostpointercapture`，建议用 `setPointerCapture` 保证收到）、指针离开按钮、`window` 失焦（`blur`）、页面隐藏（`visibilitychange`）；
   - 打开任何模态（背包、菜单、详情、日志、目标选择等）或游戏结束、回放开始。
2. 同样检查并修复 `src/components/GameCanvas.vue`（约 927 行）的地图长按重复，以及项目中其它"按住重复"的输入（键盘自身的系统重复在 keyup 丢失时不会继续，但请确认 Input.ts 没有自建的按住状态）。
3. 优先做一个小的共享机制（例如 `ui/` 下的"取消所有按住重复"函数或事件），由确认钩子和上述事件统一调用，不要在各处复制逻辑。
4. 不改变正常行为：按住方向键仍然连续移动；确认框的语义、录像中的决策记录、回放都不变。重复产生的每一步仍是一条独立的录制命令。

## 硬约束
- 只改输入/表现层；所有改状态的输入仍经 `ui/commands.dispatch` → `game.executeCommand`；不消耗实质随机流；不给 Game 加字段。
- 撞上已有测试改代码不改测试；确需改测试按 AGENTS.md 逐条登记理由。
- 不产生 CRLF；`.tmp-evidence/` 与截图不提交；**不要 commit/push**。

## 验证
- 回归测试：模拟"按住 DPad → 触发确认 → 取消"后不再派发 move；"确认"后也不再派发；blur / visibilitychange / pointercancel / 打开模态都停止重复；正常按住仍重复。地图长按同理。
- `npx vue-tsc -b`、`npm run build`、相关测试与所有读源码守卫（fe_1_touch、i_1_interaction、ui_1/ui_2、gameplay_layout、p1_30_i18n_gate、u24_hardcoded_text、repo_hygiene 等）。完整 `npm test` 与浏览器验收由 Claude 完成。

## 输出
报告 `docs/reports/fix-dpad-repeat-confirm.report.md`；用中文给出简明报告。
