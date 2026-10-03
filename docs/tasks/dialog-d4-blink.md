# 弹窗层 D4：闪现越过熔岩的确认（移除最后一个原生 window.confirm）

> 分支：`feat/dialog-d4-blink`（工作区 `BrogueJS-newtheme`，基于 main `3e2d64d`，D1–D3 已上线）。
> 依据：`docs/design/in-app-dialogs.md`（已确认）§2.3 首行、§4.4、§7.1、§7.3 表 D4 行；D2/D3 报告 `docs/reports/dialog-d2-continuations.report.md`、`dialog-d3-timeline.report.md`。

## 目标
`Game.ts` 中直接调用 `onConfirmRequest` 的"未知射程闪现跨越熔岩"确认（设计 §2.3，D2 时约 4369 行，请按当前代码重新定位）改为与 D2 相同的界面内确认 + 命令续体；完成后游戏中**不再有任何原生 `window.confirm`**，并移除 App.vue 中原生确认的兜底接线（headless/测试仍用同步解析器）。

## 要求（设计 §4.4）
1. 新风险确认使用有语义区分的命令 action（建议 `arcana:risk-confirm`，data 沿用现有类型），其答案写入标准 `decisions`；初次 `confirm_target` 仍经 executeCommand 进入，P0 恰好一次；走到实际风险点时由引擎为当前命令设置最终记录 action 并保存继续阶段；Host 回答只恢复同一命令，最后以该 action 记录一次，不重跑 P0。无风险的 `confirm_target` 不变。
2. 拒绝分支：只清选择，不施法、不扣充能、不耗时、不掷实质骰；批准：施法/扣充能/耗时恰好一次。
3. 录像兼容：录像/存档结构与 version 不变；新 action 的回放/单步/seek 消费一个 recorded decision，不弹 Host，缺/多答案仍 OOS。旧 `confirm_target` 事件保留原确定性旧解释且不再调用真实 UI；旧录像中"取消"信息缺失的事件**不补造 decisions、不倒推**，作为已知旧缺口在报告中说明；能正确回放的旧批准事件与全部黄金 trace 必须不变。
4. 法器瞄准 UI（TargetBar/触屏/键盘）与 D1 输入仲裁、heldInput、admission 一致；pending 时其它输入、保存/导出按 D2 规则等待。
5. 新增可见文本走 i18n；CE 依据 `Items.c:7261-7319`、`7370-7376`。

## 测试
- 新 action true/false 两分支经真实命令；拒绝前后库存/充能/位置/时钟/双 RNG 比较（P0 cosmetic 例外按 D2 口径）；批准后费用一次。
- 新 action 的录像回放/seek/存档续录零 OOS；构造旧 `confirm_target` 批准事件夹具证明旧解释不变；所有黄金 trace 不变。
- 全局扫描证明生产代码中不再调用 `window.confirm`；原 D4 原生闪现测试（D2 时保留的）按 AGENTS.md 转为新前提并登记。

## 门禁（全量档，设计规定：命令协议语义扩展）
`npm run ce:fetch`（已有本地参照，复用即可）→ `npx vue-tsc -b`、`npm run build`、`npm run test:full`、`BROGUE_REQUIRE_CE=1 npm run test:gen`、`npm run test:drift`。普查在 CPU 争用下若超时，按 docs/development.md 单 worker 单独复跑确认，不改超时；保留原完整命令退出码。

## 约束与输出
撞上已有测试改代码不改测试（确需改按 AGENTS.md 登记）。不产生 CRLF。**不要 commit/push**。浏览器验收由 Claude 完成：请提供一个可在浏览器稳定触发"闪现跨熔岩确认"的方法（类似 D3 的 `src/test/support/` 布景）。报告 `docs/reports/dialog-d4-blink.report.md`；中文简报。
