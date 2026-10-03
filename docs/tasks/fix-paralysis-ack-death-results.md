# 快速修复：麻痹重复警报、死亡结算被消息队列挡住、诅咒转移即时致死

> 分支：`fix/paralysis-ack-death-results`（工作区 `BrogueJS-newtheme`，基于 main `1c9c337`）。用户已批准，作为 `docs/design/in-app-dialogs.md`（已确认）完整方案 D1–D4 之前的快速修复。
> 证据录像：`.tmp-evidence/brogue-web-replay-1791020631948.json`（不入库）。设计文档 §3.1、§3.2、§5.3、§8 已有详细盘点。

## 1. "You are paralyzed!" 重复确认警报（CE 对齐）
- 现状：`Game.ts` 约 9635–9639 以 `applyStatus` 成功为门槛记录 ACK 消息；站在已扩散的麻痹气体里每回合刷新麻痹，录像最后一条命令中连续产生 6 次 "You are paralyzed!"（设计文档 §8.1/§8.2）。
- CE：`Time.c:475-490` 只在玩家原本没有麻痹时提示（请核对精确条件，并检查 `Game.ts` 约 6442 `applyTimedStatus` 给玩家施加麻痹的通用入口是否有同类问题，按 CE 各来源实际行为处理）。
- 要求：消息仅在 CE 会提示时产生；麻痹状态的施加、持续时间、随机数与原来完全一致；只改消息条件。

## 2. 游戏结束时被未确认消息挡住结算（呈现层，过渡方案）
- 现状：`GameEndOverlay.vue` 约 35–44、75–77：有任何 pending ACK 就不渲染结算，且 z-index 低于 ACK 层；玩家必须逐条点掉"--更多--"才能看到结算（设计 §3.2 第 8 点）。
- 要求（与设计 §5.3 一致的过渡实现，完整显示序列留给 D3）：
  - 默认仍按顺序显示消息；但只要游戏已结束，ACK 层上提供明显的"查看结算"按钮（i18n），点击/触摸/键盘均可，任何推进状态下都可交互。
  - 点击后：停止剩余消息逐条确认，直接显示结算；未读消息不丢失，Logger 归档不删除、不改 count，可在结算界面或日志中按原顺序查看（标记未读即可）。
  - 保存/导出录像/返回标题立即可用；返回标题或开新局时清掉上一局的待确认队列，不串局。
  - 回放/seek 行为不变（回放本来不等待 ACK）。
- 只改呈现：不改模拟、日志内容、RNG、录像。

## 3. 诅咒转移戒指即时致死（CE 对齐）
- CE：`Combat.c:1870-1875`：`attacker->currentHP += transferenceAmount; if (attacker == &player && player.currentHP <= 0) { gameOver("Drained by a cursed ring", true); return false; }` —— 玩家被负转移吸到 ≤0 时**立即**结束游戏，死因为 "Drained by a cursed ring"，并**返回**（受害者不再继续扣血/死亡判定）。
- 现状：上一步修复报告 `docs/reports/fix-overheal-turn-clamp.report.md` 已记录：项目由回合收尾判死、死因常为 unknown、受害者扣血仍继续。
- 要求：按 CE 实现即时结束、死因文本（走 i18n，沿用项目死因机制）及提前返回；核对 CE inflictDamage 返回值语义在调用方的后续影响（击杀判定、消息、符文等）并保持一致；不改变其它路径的 RNG 消耗次序。

## 硬约束
- AGENTS.md 全部规则；CE 是规格。撞上已有测试改代码不改测试；确需改测试按规则逐条登记（含单变量反事实）。
- 黄金 trace / 生成基线如有变化，按 docs/testing.md §3 单变量归因并逐字段登记（预计第 1 项可能改变黄金 trace 中的消息/ACK 计数，若有请精确归因到该修改）。
- 不产生 CRLF；`.tmp-evidence/` 不入库；**不要 commit/push**。

## 验证（局部规则档，docs/development.md §4）
- 回归测试：第 1 项用录像或构造场景证明同一次麻痹期间只提示一次、首次麻痹仍提示、麻痹数值/RNG 不变；第 2 项组件测试：游戏结束+pending ACK 时可直接查看结算、未读消息保留、返回标题清队列；第 3 项：负转移致死即时结束、死因、受害者不再扣血。
- 用证据录像重放：最终命令只出现一次麻痹警报，最终检查点（turn/HP/score/RNG）与原来一致、无 OOS。
- `vue-tsc -b`、`build`、相关测试、全部读源码守卫、UR2/UR3/UR4、u_27/x2a/x3b、U03、`npm run test:full`、`npm run test:drift`。

## 输出
报告 `docs/reports/fix-paralysis-ack-death-results.report.md`；中文简报。
