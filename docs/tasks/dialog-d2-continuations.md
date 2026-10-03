# 弹窗层 D2：经典确认的命令续体（移除这些点的原生 window.confirm）

> 分支：`feat/dialog-d2-continuations`（工作区 `BrogueJS-newtheme`，基于 D1 提交 `189559d`，D1 尚未合入 main，与 D1 一并上线）。
> 依据：`docs/design/in-app-dialogs.md`（已确认）§2.1–§2.2、§4.1–§4.3、§6、§7.1、§7.3 表 D2 行。D3（显示事件序列）、D4（闪现直连确认 Game.ts:4369）不在本步。

## 目标
把设计 §2.2 的 Q1–Q10 全部 `requestConfirm` 点改为"显式命令续体"：前缀（P0–P3）照原顺序只执行一次 → 在确认边界保存继续阶段并通过 DialogService 发布 ConfirmSpec → 浏览器返回、Host 可交互 → 用户回答后由引擎恢复原位置后缀。完成后，除 D4 的闪现直连点外，游戏中不再出现原生 `window.confirm`。

## 必须满足（设计 §4.2 实施契约 1–8 全部适用，以下为要点）
1. 前缀恰好一次、不重跑、不靠快照回滚；待答案期间不扣费、不推进时间、不掷实质骰。Q1 的混乱方向骰在确认之后；Q2/Q4 回答后复查对象；Q5/Q6 保存 hitList 与问题游标，先酸性后盟友，不重复提问；Q7–Q10 保持整条风险链与先前答案。
2. 录像：`decisions: boolean[]` 语义不变；答否仍完成同一条命令并记录 `[false]`（或 `[true,false]`）；等待期间不建临时事件、不增加记录索引。回放/单步/seek 直接消费 decisions，不弹 Host、不等待 DOM；用 `replayRecording` 区分 live/loaded/playing。
3. admission：有待决确认时拒绝其它改状态输入（键盘、DPad、地图点击、命令栏、自动步、代理命令）；新局/读档/返回标题用 epoch 使旧 token 失效，不把旧答案录进新局；对象意外变化时放弃尚未收费的后缀并提示重新输入，不自动批准新目标。
4. 自动步（performAutoPathStep 的 blockCombatText/inAutoTravelStep 作用域）转为显式任务状态，返回 UI 时恢复全局 Logger 配置，取消不残留。
5. 保存世界/导出录像在有待决命令时不得截出"有前缀、无事件"的状态：等待决策完成或给出待完成反馈，不强行批准，不借 5 秒动画超时。
6. `executeItemCommand` 的生产调用改为引擎可恢复的操作描述，不把任意闭包交给 UI。
7. headless/无 Host：按既有同步解析器（null 默认是）驱动同一状态机，测试与回放语义不变。
8. 经典 CE 键位 profile（§4.3）：y/Y/Enter 是，n/N/Space/Esc 否；默认焦点可在"否"，但 Enter 语义固定为是；危险样式；同一按键 repeat、晚到 pointerup、双击不连续回答下一题。

## 不做
不改任何规则条件、RNG 次序、确认文案、录像/存档格式；不实现 D3/D4；不顺手修设计 §2.2 末尾列出的跳渊条件旁支差异。

## 测试（设计 §7.1 "Q1–Q10""多问题/路线""异步生命周期""录像/存档"行）
- 每个 Q 点 true/false 两分支，经真实 executeCommand/executeItemCommand；比较库存/钥匙/充能/HP/营养/位置/时钟；普通夹具输入前至拒绝后双 RNG 不变；另设未采样闪光夹具核对 P0 的 cosmetic 消耗与旧同步路径一致。
- 多问题链、鞭/矛/斧命中列表、自动步只恢复原步骤、混乱方向骰 0/1 次。
- pending 时菜单/保存/导出/新局/载入、对象失效；headless 同步。
- U27、x2a、x3b、UR2/UR3/UR4、U03、存档续录：每种 false/true 决策重放零 OOS。
- 设计 §7.1 末尾列出的旧用例（ui_1_rendering 原生 confirm stub、dpad_hold_input、map_touch_input）转为可控回答服务前提，保留原断言语义；按 AGENTS.md 逐条单变量反事实登记。

## 门禁
中档（docs/development.md §4）：vue-tsc -b、build、相关测试、全部读源码守卫、UR2/UR3/UR4、u_27/x2a/x3b、U03、test:drift；另跑完整 `npm test`（不含普查）确认无连带影响。若检查发现规则变化，停止并报告，不在本步改规则。

## 约束与输出
撞上已有测试改代码不改测试（确需改按规则登记）。不产生 CRLF。**不要 commit/push**。浏览器验收由 Claude 完成。报告 `docs/reports/dialog-d2-continuations.report.md`；中文简报。
