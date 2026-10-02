# 修复：屠戮符文武器近战对匹配种类应必中（CE 对齐）

> 分支：`fix/slaying-melee-autohit`（工作区 `BrogueJS-newtheme`，基于 main `830ad74`）。
> 来源：扩展分支 dot 在 1c 中性策略对等测试中发现的既存偏差，Claude 已核对 CE 源码。

## CE 规格
`.ce-reference/BrogueCE-master/src/brogue/Combat.c` hitProbability（约 129–134 行）：
```c
if (attacker == &player && rogue.weapon) {
    if ((rogue.weapon->flags & ITEM_RUNIC) &&
        rogue.weapon->enchant2 == W_SLAYING &&
        monsterIsInClass(defender, rogue.weapon->vorpalEnemy)) {
        return 100;
    }
    ...
}
```
即玩家装备屠戮（slaying）符文武器、目标属于该武器的克敌种类时，命中率为 100%。注意 CE 的 attack() 随后仍按 `rand_percent(hitProbability)` 取骰（100% 仍消耗一次随机数），请核对 CE attack() 中命中判定的确切取骰方式并保持本项目原有的取骰位置与次数，不要因"必中"而省略或新增随机数调用。

## 本项目现状
近战求值（`src/engine/Combat/Combat.ts` 的 `resolveAttack` 及其使用的命中概率计算）遗漏了这条规则；独立诊断：防御 80、动物类匹配时近战命中 35%（应为 100%）。投掷路径已有对应处理（可对照参考）。命中预览/详情面板若显示命中率，也应一致。

## 要求
1. 在近战命中概率中按 CE 加入该规则（仅玩家、仅装备的武器为屠戮符文、仅目标匹配克敌种类）；保持与 CE hitProbability 中其它分支（stuck/captive/seized、钳制 0–100）的先后顺序一致。
2. 检查同一命中概率是否也用于详情面板/命中预估，保证显示一致。
3. 检查怪物持有武器/盟友等情况不受影响（CE 仅 attacker == &player）。
4. 回归测试：匹配种类 100% 命中且 RNG 消耗与原取骰路径一致；不匹配种类、非屠戮符文、未鉴定符文（CE 判定用的是 flags/enchant2，与是否已鉴定无关——请按 CE 实际字段核对）各一例；投掷路径不变。
5. 黄金 trace / 生成基线如有变化，按 docs/testing.md §3 单变量归因并逐字段登记；预计普通黄金 trace 不涉及匹配屠戮符文的近战，若无变化请在报告中说明。

## 硬约束
- AGENTS.md 全部规则；CE 是规格。撞上已有测试改代码不改测试；确需改测试按规则逐条登记（含单变量反事实）。
- 不产生 CRLF；**不要 commit/push**。

## 门禁（规则修改 → 完整/CE 档）
`npx vue-tsc -b`、`npm run build`、`npm run test:full`（CE 参照已在 .ce-reference/）、`npm run test:drift`。

## 输出
报告 `docs/reports/fix-slaying-melee-autohit.report.md`（CE 依据文件:行号、改动、测试、门禁原文）；中文简报。
