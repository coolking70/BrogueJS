# 收尾前独立代码审查发现（维护者侧转交，需在冻结前修复）

来源：独立只读审查（基于 7f6de96）。以下为审查者的结论摘要，请逐项复核、复现、修复并补回归测试，然后再冻结候选并继续收尾门禁。

## 1（中高，已有复现）主动 split 复活已破坏部位，绕过“同体再生不开放”守卫
- 位置：`src/engine/Core/Game.ts` 约 6206（只拦 `reason==='phase'`）；约 6345–6347（结果群体总是重建：成员全部 active、`appliedBreaks: []`）；`src/ext/bodyTransitions.ts` 41–77（`validActiveBodyTransitions` 允许 split 结果 formId 等于 sourceFormId）。
- 复现：`productionBodyScene()` 中先 `killMonster` 打断 leg00（appliedBreaks=[leg00]，槽位 removed）；同形态 phase 正确抛 `Same-body regeneration is not open`；同形态 split（reason:'split'，两个结果都是 `body-fixture.fixture-core`）返回 applied，两个结果群体 appliedBreaks=[]、9 槽全部 active——断腿被复活两份。测试夹具默认主动 move 恰为同形态 split。
- 修复方向：任何非 copy 转换，只要结果 body definition 与源相同且源群体有 appliedBreaks/已移除槽位，应拒绝或把破坏收据与墓碑映射到结果；安装期 `validActiveBodyTransitions` 也应拒绝 split 结果 form 等于源 form（或要求显式声明破坏继承）。在 `phase4e_body_transition.test.ts` 加 split 负例。

## 2（中，读码确认）复合体核心经成员传伤死亡时击杀计数/玩家击杀后置处理错误
- 位置：`Game.ts` 约 12309–12318（`finishBodyMemberDamage`），由 `src/ext/runtime.ts` 约 1262 的 damage 钩子无条件调用。
- 缺陷：原生只在玩家近战（约 9234）、玩家投掷（约 7903）、毒（约 8762）计 kill；这里成员传伤致核心死亡时一律 `killMonster(core)` + `stats.kills++`。盟友/怪物/爆炸/火焰地形/玩家法术 bolt 打成员致死都给玩家记击杀（同来源杀 1×1 不计）；反过来玩家近战打成员致核心死亡时 `isPeripheralBodyMember(member)` 为真，跳过 9234 分支，`dropMonsterLoot` 与 `decrementWeaponAutoIDTimer` 不发生，而直接打核心会发生——结果取决于打中哪格。
- 修复方向：kill 只按玩家/玩家投射物来源计（可用 `causality.deathOrigin(core.id)`）；玩家近战/投掷经成员传伤击杀核心时，补跑与直接击杀相同的后置处理（掉落、熟悉度等）。补两类回归。

## 3（低，语义）split 产生的新后代比保留核心早约 100 tick 行动
- 位置：`Game.ts` 约 6401–6413（`tryActiveBodyTransition` 只给原 core 设置 `ticksUntilTurn = max(move.ticks, …)`）。
- 观察：自然 Colossus split 后保留 core ticks 200、新后代 ticks 101。
- 维护者决定：**转换的行动成本应同样作用于全部结果核心**（所有结果在转换后不早于 `move.ticks` 行动），避免分裂即白得一次额外行动。补回归。

## 4（低，疑似）偷袭延迟写入 scheduler 镜像计时被覆盖
- 位置：`src/engine/Combat/Combat.ts` backstab 分支 `bodyDecisionActor(defender).ticksUntilTurn += …`。
- 缺陷：defender（或复合体核心）处在 actor-action bundle 中时 ticksUntilTurn 只是镜像，下次 mirror() 覆盖，CE 偷袭延迟丢失。
- 修复方向：对忙碌 owner 把延迟加到 bundle 恢复阶段或 actionLock 等唯一真相；先复现确认，再修。

审查认为 sound 的部分（无需处理）：3g 四处合并冲突解决、体力单次计费、事实发布去重、checkpointCombatFactWorld 回滚覆盖、确定性迭代、读档校验一致、TimeCoordinator 不重复扣时、篝火威胁判定。
