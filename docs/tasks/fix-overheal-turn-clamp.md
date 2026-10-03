# 修复：转移（吸血）等效果使生命超过上限后没有在回合结算时截回（CE 对齐）

> 分支：`fix/overheal-turn-clamp`（工作区 `BrogueJS-newtheme`，基于 main `1ff39a8`）。来源：用户人工试玩——装备转移戒指攻击触发吸血后，生命似乎可以持续超过上限。Claude 已核对 CE。

## CE 规格
- `Combat.c:1847-1875` inflictDamage：转移（玩家 `rogue.transference`、怪物 `MA_TRANSFERENCE`）直接 `attacker->currentHP += transferenceAmount;`，此刻**不**按 maxHP 封顶（玩家为负值转移且 HP≤0 时 gameOver "Drained by a cursed ring"）。
- `Time.c:2862-2864` playerTurnEnded：在 `applyInstantTileEffectsToCreature(&player)` 与 gameHasEnded 检查之后、`MB_IS_FALLING` 处理之前，`if (player.currentHP > player.info.maxHP) player.currentHP = player.info.maxHP;`
- `Time.c:2717-2723` playerTurnEnded 的怪物循环：怪物 `ticksUntilTurn <= 0` 轮到它行动时，先 `if (monst->currentHP > monst->info.maxHP) monst->currentHP = monst->info.maxHP;` 再处理 MONST_GETS_TURN_ON_ACTIVATION / 行动。
- 结论：短暂超出上限是原版行为；但玩家在回合结算、怪物在其行动前都会被截回上限。

## 本项目现状（Claude 初查）
`src/engine/Core/TimeCoordinator.ts` 的推进循环与回合收尾中未找到上述两处截断（怪物行动循环约 156–168 行；玩家收尾约 480–500 行附近）。请确认是否确实缺失，以及转移在本项目中的实现位置（Combat.ts 的 transferMonsterHealth / 玩家转移路径）是否与 CE 一致（含盟友 40%、敌人 90%、玩家按比例、最小 ±1、不超过受害者剩余生命）。

## 要求
1. 按 CE 在对应位置补上玩家与怪物的截断，严格保持 CE 中的先后顺序（相对瞬时地形效果、游戏结束检查、坠落处理、怪物行动前的其它处理），不新增或改变随机数调用。
2. 检查是否还有其它 CE 允许暂时超上限、依赖这两处截断收尾的来源（例如护盾/治疗/变形/复活等），一并说明。
3. 回归测试：玩家装备正向转移戒指吸血后，当次攻击后生命可短暂超过上限，回合结算后等于上限；怪物 MA_TRANSFERENCE 吸血后在其下次行动前截回；负向（诅咒）转移致死；截断不消耗随机数。
4. 黄金 trace / 生成基线若有变化，按 docs/testing.md §3 单变量归因并逐字段登记。

## 硬约束与门禁
- AGENTS.md 全部规则；CE 是规格；撞上已有测试改代码不改测试（确需改按规则登记）。不产生 CRLF；**不要 commit/push**。
- 门禁按 docs/development.md §4 **局部规则档**：`vue-tsc -b`、`build`、相关测试、全部读源码守卫、UR2/UR3/UR4 黄金 trace、录像测试（u_27、x2a、x3b）、U03、`npm run test:full`（CE 参照在 .ce-reference/）、`npm run test:drift`。

## 输出
报告 `docs/reports/fix-overheal-turn-clamp.report.md`（CE 依据文件:行号、改动、测试、门禁原文）；中文简报。
