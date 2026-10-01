# 细剑自动行进与刻符反色文字修复报告

- 工作区：`BrogueJS-newtheme`；分支：`fix/rapier-travel-inventory-contrast`；起点：`main ad3e902`。
- 任务书：`docs/tasks/fix-rapier-travel-inventory-contrast.md`。
- 原始证据：`.tmp-evidence/brogue-web-replay-1790882731795.json`，种子 `438182354`，普通模式，850 条命令。
- 未 commit/push；CE 目录只读；截图由验收方完成。

## 1. 结论与根因

**频繁无提示停步与细剑攻击无关：粉碎卷轴留下的远处力场逐渐消融，每次触发 DF 寻路缓存刷新时，web 错误地清空了整条自动路线和探索标志。CE 不会因为这个缓存刷新而中断自动行进。**

录像命令 476（记录回合 424）`read|j|` 的真实消息确认是粉碎卷轴（Scroll of Shattering）；它把附近墙体变为 `DUNGEON` 层力场。命令 553（回合 484）喝的是力量药水；命令 556（回合 485）装备细剑，并提示还差 2 点力量。这些时间上的相邻不构成武器因果：首次力场导致的无声停步已经发生在装备之前。

执行链（修改前行号）：

```text
auto_step → playerTurnEnded → objectiveTimeBlock → updateEnvironment
→ runPromotionUpdate → promoteTile → DF_FORCEFIELD_MELT
→ fillSpawnMap(pathingChanged) → Game.invalidatePathing
→ autoPath=[]; isAutoExploring=false; isMouseTraveling=false
→ stepAutoPathInner:11130 看见空路线 → stopAutoTravel → disturbed=true
```

直接缺陷在 `src/engine/Core/Game.ts:9746-9747`，DF 调用点在 `src/engine/Map/DungeonFeature.ts:993`。无声停步时，玩家已完成正常一步；清路线发生在环境推进中的远处地形事务，没有拾取、发现新敌人、危险状态或提示消息。少数时点身边有**已知**敌人，但该步没有攻击/新发现消息；实际停止路径仍是上述缓存回调。统计依据是实际调用栈，不是是否看见怪物的推测。

32 次无声停步中，25 次没有可见怪物；7 次可见已知老鼠（末命令 598、600、605、615、617、622、640），没有发生攻击或新发现打断。12 次有普通地面物品可见，但没有拾取、发现钥匙或危险地形消息；它们不构成这些停步的合法原因。完整实体/地形列表保留在本地逐帧审计 JSON。

## 2. CE 执行路径核对

本地 legacy 参照提交：`49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`（`.ce-reference/SOURCE.json`）。

| CE 文件与行号 | 实际行为与裁决 |
|---|---|
| `Items.c:4904-4939`，特别是 `4916-4917` | `crystalize` 将墙变为 DUNGEON 力场，再生成粉碎地形；解释录像中的远处消融来源。 |
| `Globals.c:477-478`、`Time.c:1627-1663` | 力场按邻居条件随机晋升，随后消融地形消失；环境更新可以连续多个回合触发。 |
| `Architect.c:3240-3244` | `T_PATHING_BLOCKER` 改变只置 `rogue.staleLoopMap=true`，没有清路线或置 disturbed。 |
| `Time.c:2554-2556` | 缓存过期调用 `analyzeMap(false)`，没有自动行动中断。 |
| `Movement.c:1842-1886`（travelRoute）、`1889-1924`（travelMap） | 因路线变得阻挡/危险、移动失败、合法 disturbed、用户输入或到达而结束；没有“任意远处 DF 刷新即停止”。 |
| `Movement.c:2307-2355`（explore）、`1767` 起（nextStep） | 每步重新求探索地图；下一步不存在、移动失败及合法 disturbed 会停止。 |
| `Movement.c:1368-1400`、`1479-1492`；`Combat.c:1180,1298-1300` | 细剑有真实可攻击目标才突刺；拒绝酸性/discordant 盟友攻击或实际战斗可以打断。空地行进不会因为装备细剑而置 disturbed。 |
| `Movement.c:837-850,859-919,919-1023,1025-1048,1225-1247` | abortAttack、鞭、矛/长柄、连枷、斧的攻击流程与缓存刷新分离；真实攻击或确认拒绝仍按原路径处理。 |

同时只读核对官方当前 master：[Architect.c](https://github.com/tmewett/BrogueCE/blob/master/src/brogue/Architect.c#L2984-L2988)、[Movement.c](https://github.com/tmewett/BrogueCE/blob/master/src/brogue/Movement.c#L1444-L1483)。对应缓存与旅行路径的裁决相同；上游行号与本地 legacy 不同。未同步 CE 或运行 ce:fetch，遵照本任务的只读参照约束。

## 3. 原录像逐次统计与修复后验证

用公开 `loadReplay` / `replayStep` 回放全部命令，并在测试侧包装 `disturbed`、`autoPath` 属性和 `logger.log`，捕获每次停止的调用栈、消息、位置、可见实体与地形变化。自动行动按“启动命令 + 后续连续 auto_step”分组；下面使用录像的 **0 起命令 index**，回合为录像 `turn`（CE absoluteTurnNumber），不是 UI stats 的动作计数。表格消息保留 headless harness 的 fallback 文案输出。

共 96 次自动行动启动（探索 55、鼠标旅行 39、楼梯旅行 2）：

| 原代码停止/结束类型 | 装备细剑前 | 装备细剑后 | 合计 |
|---|---:|---:|---:|
| 远处力场消融错误清路线，无消息 | 4 | 28 | **32** |
| 合法消息/发现/战斗/拾取/无路或无探索目标 | 38 | 22 | 60 |
| 正常到达目的地 | 2 | 0 | 2 |
| 路线仍在执行，用户改发另一条命令 | 1 | 1 | 2 |
| 合计 | 45 | 51 | 96 |

命令 559、561 的两次下楼旅行分别由 76、75 格路线在第 1 步被远处消融清空；玩家并未到达楼梯。D2 连续单步探索的末命令 **785/787/789/791/793** 分别对应：发现狗头人、突刺并被反击（未命中）、发现豺狼并被反击、击杀狗头人、发现豺狼。它们有合法消息和 CE 打断原因，保留原行为，没有补虚构的“力场停止”提示。

修复后同一份原始录像仍 **850/850、零 OOS**，每条已有位置/回合/双随机流检查点通过。32 个原无声停步时点均改为保留剩余路线；原录像仍按用户当时的点击继续播放，没有删命令或重录录像。合法停止保留。另从真实命令 559 之后的状态继续该下楼旅行，不再重复点路：从原来的 **1 步**增至 **22 步**，在 `(44,5)` 第 507 回合因“发现老鼠”正常结束。

原始调用栈与逐帧 JSON、探针代码、前后回放日志在 `.tmp-evidence/`；均不入库。以下小型表格记录每次行动的最终原因。

| 启动–末命令 | 层/末回合 | 类型/auto_step 数 | 最终位置 | 原代码直接结束原因 |
|---|---|---|---|---|
| 0–4 | D1/4 | 探索/4 | `(39,22)` | You see a Jackal. |
| 5–6 | D1/5 | 探索/1 | `(40,22)` | You see a Kobold. |
| 7–10 | D1/8 | 探索/3 | `(40,23)` | you defeated the Jackal |
| 11–12 | D1/9 | 探索/1 | `(41,23)` | You see a Kobold.；You see a Rat. |
| 13–28 | D1/24 | 探索/15 | `(49,14)` | you found 76 pieces of gold. |
| 29–31 | D1/26 | 探索/2 | `(50,13)` | You see a Rat. |
| 32–34 | D1/28 | 探索/2 | `(51,13)` | you dispatched the Rat, catching it unaware |
| 35–42 | D1/35 | 探索/7 | `(51,6)` | You see a Jackal. |
| 43–43 | D1/35 | 鼠标/0 | `(51,6)` | You have not explored that location. |
| 44–48 | D1/39 | 探索/4 | `(49,2)` | the Jackal mauls you |
| 49–51 | D1/42 | 探索/2 | `(49,2)` | You see a Jackal.；you defeated the Jackal |
| 52–63 | D1/53 | 探索/11 | `(43,7)` | you dispatched the Jackal, catching it unaware |
| 64–68 | D1/57 | 探索/4 | `(42,10)` | You see a Jackal. |
| 69–69 | D1/58 | 探索/0 | `(42,10)` | you dispatched the Jackal in its sleep |
| 70–73 | D1/61 | 探索/3 | `(40,8)` | you now have Red Potion (e). |
| 74–106 | D1/93 | 探索/32 | `(31,6)` | you now have 题为「天书无极虚空」的卷轴 (f). |
| 107–117 | D1/103 | 探索/10 | `(21,5)` | You see a Rat. |
| 118–123 | D1/108 | 探索/5 | `(20,5)` | you defeated the Rat |
| 124–133 | D1/117 | 探索/9 | `(13,7)` | You see a Jackal. |
| 134–146 | D1/129 | 探索/12 | `(3,7)` | you defeated the Jackal |
| 147–148 | D1/130 | 探索/1 | `(2,7)` | You see 一个向下的楼梯. |
| 149–152 | D1/133 | 探索/3 | `(1,4)` | you now have War Axe (g). |
| 153–174 | D1/154 | 探索/21 | `(6,17)` | You see a Jackal. |
| 175–182 | D1/161 | 探索/7 | `(5,23)` | you now have 紫红色药水 (h). |
| 183–184 | D1/162 | 探索/1 | `(6,24)` | You see a Jackal. |
| 185–187 | D1/165 | 探索/2 | `(6,24)` | you defeated the Jackal |
| 188–196 | D1/173 | 探索/8 | `(14,24)` | you now have 题为「水月法阵虚空灵符」的卷轴 (i). |
| 197–292 | D1/268 | 探索/95 | `(33,22)` | You see a Jackal. |
| 293–300 | D1/275 | 探索/7 | `(40,22)` | You see a Kobold. |
| 301–304 | D1/278 | 探索/3 | `(43,22)` | You see a Jackal. |
| 305–305 | D1/279 | 探索/0 | `(43,22)` | you dispatched the Kobold in its sleep |
| 306–318 | D1/291 | 探索/12 | `(55,26)` | 用户改发新命令，原路线仍有效 |
| 319–322 | D1/294 | 探索/3 | `(58,26)` | You see a Jackal. |
| 323–328 | D1/299 | 探索/5 | `(62,25)` | you now have 题为「玉简玉简火雷虚空」的卷轴 (j). |
| 329–344 | D1/314 | 探索/15 | `(62,14)` | You see a Jackal. |
| 345–349 | D1/318 | 探索/4 | `(61,14)` | you defeated the Jackal |
| 350–390 | D1/358 | 探索/40 | `(51,21)` | you now have War Pike (k). |
| 391–425 | D1/392 | 探索/34 | `(64,9)` | I see no path for further exploration. |
| 426–426 | D1/392 | 鼠标/0 | `(64,9)` | No path is available. |
| 429–433 | D1/396 | 鼠标/4 | `(68,8)` | 正常到达旅行目标 |
| 509–510 | D1/447 | 鼠标/1 | `(65,6)` | **错误清路线**；远处力场 `(62,7)` 消融 |
| 522–523 | D1/458 | 鼠标/1 | `(71,7)` | **错误清路线**；远处力场 `(68,4)` 消融 |
| 526–527 | D1/461 | 鼠标/1 | `(72,6)` | **错误清路线**；远处力场 `(61,9)` 消融 |
| 528–529 | D1/462 | 鼠标/1 | `(73,5)` | **错误清路线**；远处力场 `(60,4)` 消融 |
| 530–533 | D1/465 | 鼠标/3 | `(76,2)` | 正常到达旅行目标 |
| 558–558 | D1/485 | 探索/0 | `(66,8)` | I see no path for further exploration. |
| 559–560 | D1/486 | 下楼/1 | `(65,8)` | **错误清路线**；远处力场 `(70,15)` 消融 |
| 561–562 | D1/487 | 下楼/1 | `(64,8)` | **错误清路线**；远处力场 `(63,4)` 消融 |
| 563–568 | D1/492 | 鼠标/5 | `(59,6)` | **错误清路线**；远处力场 `(61,4)` 消融 |
| 569–570 | D1/493 | 鼠标/1 | `(58,6)` | **错误清路线**；远处力场 `(63,3)` 消融 |
| 571–572 | D1/494 | 鼠标/1 | `(57,6)` | **错误清路线**；远处力场 `(66,2)` 消融 |
| 573–575 | D1/496 | 鼠标/2 | `(55,6)` | **错误清路线**；远处力场 `(71,13)` 消融 |
| 576–579 | D1/499 | 鼠标/3 | `(52,6)` | **错误清路线**；远处力场 `(64,3)` 消融 |
| 580–581 | D1/500 | 鼠标/1 | `(51,6)` | **错误清路线**；远处力场 `(63,2)` 消融 |
| 582–584 | D1/502 | 鼠标/2 | `(49,5)` | **错误清路线**；远处力场 `(67,3)` 消融 |
| 585–586 | D1/503 | 鼠标/1 | `(48,5)` | **错误清路线**；远处力场 `(60,10)` 消融 |
| 587–588 | D1/504 | 鼠标/1 | `(47,5)` | **错误清路线**；远处力场 `(64,2)` 消融 |
| 589–591 | D1/506 | 鼠标/2 | `(45,5)` | 用户改发新命令，原路线仍有效 |
| 592–593 | D1/507 | 鼠标/1 | `(44,5)` | You see a Rat. |
| 594–598 | D1/511 | 鼠标/4 | `(42,9)` | **错误清路线**；远处力场 `(67,16)` 消融 |
| 599–600 | D1/512 | 鼠标/1 | `(41,10)` | **错误清路线**；远处力场 `(62,3)` 消融 |
| 601–603 | D1/514 | 鼠标/2 | `(40,12)` | You see a Rat.；the Rat misses you |
| 604–605 | D1/515 | 鼠标/1 | `(40,13)` | **错误清路线**；远处力场 `(71,14)` 消融 |
| 606–607 | D1/516 | 鼠标/1 | `(39,13)` | the Rat misses you |
| 608–615 | D1/523 | 鼠标/7 | `(32,14)` | **错误清路线**；远处力场 `(65,2)` 消融 |
| 616–617 | D1/524 | 鼠标/1 | `(31,14)` | **错误清路线**；远处力场 `(69,16)` 消融 |
| 618–622 | D1/528 | 鼠标/4 | `(27,14)` | **错误清路线**；远处力场 `(72,11)` 消融 |
| 627–634 | D1/537 | 鼠标/7 | `(20,13)` | **错误清路线**；远处力场 `(72,14)` 消融 |
| 635–638 | D1/540 | 鼠标/3 | `(17,13)` | You see a Rat. |
| 639–640 | D1/541 | 鼠标/1 | `(16,13)` | **错误清路线**；远处力场 `(73,11)` 消融 |
| 646–649 | D1/548 | 鼠标/3 | `(16,13)` | **错误清路线**；远处力场 `(62,2)` 消融 |
| 650–651 | D1/549 | 鼠标/1 | `(15,13)` | **错误清路线**；远处力场 `(63,1)` 消融 |
| 652–657 | D1/554 | 鼠标/5 | `(10,13)` | **错误清路线**；远处力场 `(72,15)` 消融 |
| 658–661 | D1/557 | 鼠标/3 | `(7,13)` | **错误清路线**；远处力场 `(68,2)` 消融 |
| 662–664 | D1/559 | 鼠标/2 | `(6,12)` | **错误清路线**；远处力场 `(74,11)` 消融 |
| 665–667 | D1/561 | 鼠标/2 | `(6,10)` | **错误清路线**；远处力场 `(74,12)` 消融 |
| 668–671 | D1/564 | 鼠标/3 | `(6,7)` | **错误清路线**；远处力场 `(73,14)` 消融 |
| 672–675 | D1/567 | 鼠标/3 | `(3,7)` | **错误清路线**；远处力场 `(65,1)` 消融 |
| 676–677 | D1/568 | 鼠标/1 | `(2,7)` | **错误清路线**；远处力场 `(73,15)` 消融 |
| 680–701 | D2/588 | 探索/21 | `(12,9)` | you defeated the Kobold |
| 702–745 | D2/631 | 探索/43 | `(32,17)` | You see a Kobold. |
| 746–778 | D2/663 | 探索/32 | `(39,23)` | You see a Jackal.；You see a Kobold. |
| 779–783 | D2/667 | 探索/4 | `(37,26)` | you now have 棕色药水 (e). |
| 784–785 | D2/668 | 探索/1 | `(37,25)` | You see a Kobold. |
| 786–787 | D2/669 | 探索/1 | `(38,24)` | you hit the Kobold with a vicious lunge attack；the Kobold misses you |
| 788–789 | D2/670 | 探索/1 | `(38,23)` | You see a Jackal.；the Kobold misses you |
| 790–791 | D2/671 | 探索/1 | `(38,23)` | you defeated the Kobold |
| 792–793 | D2/672 | 探索/1 | `(39,23)` | You see a Jackal. |
| 794–813 | D2/691 | 探索/19 | `(49,15)` | you now have Rapier (i). |
| 814–819 | D2/696 | 探索/5 | `(47,20)` | You see a Kobold. |
| 820–824 | D2/698 | 探索/4 | `(47,21)` | you defeated the Kobold |
| 825–827 | D2/700 | 探索/2 | `(47,23)` | You see a Pit bloat.；You see a Jackal. |
| 828–835 | D2/707 | 探索/7 | `(49,23)` | The Pit bloat bursts, causing the floor underneath it to disappear!；The Pit bloat lunges at you and bursts! |
| 836–836 | D2/707 | 探索/0 | `(49,23)` | I see no path for further exploration. |
| 838–842 | D3/712 | 探索/4 | `(56,17)` | you found 125 pieces of gold.；You see a Eel.；the Eel bites you |
| 843–845 | D3/713 | 探索/2 | `(56,17)` | you defeated the Rat |

## 4. 实现与同类武器

只删除 DF `invalidatePathing` 回调中清自动路线/探索/鼠标旅行的三处赋值；仍刷新 `loopMap` 和 safety map 过期标志。现有 travel 的完整已知路线检查、explore 每步重算、合法消息/伤害/发现/确认/换层/位移停止全部保留。

此缺陷不依赖武器：徒手、细剑、长矛、长柄、鞭、连枷、斧共用 DF 回调，均受影响，均由本次共同修复覆盖。没有更改突刺、穿透、鞭射程、连枷擦击、斧横扫的攻击规则、伤害、恢复速度、确认提示或 RNG 调用。

没有新增 Game 字段，无须改 U03 契约；状态输入仍走 `executeCommand` / `executeItemCommand`；未新增玩家文案。缓存刷新本身零 RNG，在构造用例中单独断言双流不变。

## 5. 反色文字与对比度

采用任务书第一方案：保留刻符 **浅底深字**。反色浅底 `--th-fg=#e4dfd1`，文字统一 `--th-bg=#050505`，按 sRGB 相对亮度公式计算对比度 **15.31:1**。

原背包 `.item-name` 的 scoped `#e4e4e7` 覆盖行级深色，和浅底只有 **1.05:1**。旧规则只修了字母、物品字形、已装备标记，漏掉名称、数量子元素、力量提示、魔法符号。选中态所有后代现在用 `color:var(--th-bg)!important` 覆盖 scoped 和 inline 颜色，并重置 `opacity:1!important`、`text-shadow:none!important`，保证字母键、名称、数量、附注、装备标记、彩色字形/符号均按 15.31:1 呈现；非选中态继续使用原物品颜色。

一并修复同样的后代颜色/透明度覆盖：附近实体/目标检视的 focused 行（字形、行为、HP 数值、距离、状态）、命令栏和更多命令的 hover/focus-visible（包括键帽）、背包操作按钮 hover、主菜单主项/hover（包括说明与暂停菜单 Esc 键帽）。主菜单原说明 `#9e998d` 在浅底为 2.13:1，键帽警告色 `#d8b25a` 为 1.51:1，附近装备/友好色 `#8fbf6a` 为 1.61:1；上述反色文字现在均为 15.31:1。

复核发现稍后声明的附近实体按钮 hover 规则会把 focused 行改回深底，沉浸模式命令按钮规则也会覆盖原来的反色背景/行级文字。反色状态根元素现在同时固定 `background:var(--th-fg)!important` 与 `color:var(--th-bg)!important`，保持浅底深字成对出现，避免仅改子元素颜色后在这些重叠状态落到深底。

设置面板的选项为普通深底控件，没有同类反色列表；图鉴 `aria-pressed=true` 已是浅底深字且无彩色后代。详情面板是深底，目标栏是深底按钮、目标选择本身在地图上，没有反色文字列表。未扩大到这些不同样式；附近实体 focused 列表已覆盖。

浏览器在本环境不可用；CSS/数值与组件结构检查不是截图验收。请验收方确认普通/沉浸背包、带数量/低力量/装备/魔法符号物品，以及附近实体状态、主菜单说明、更多命令键帽的实际呈现。

## 6. 回归与门禁

新增 `src/test/fix_rapier_travel.test.ts`（17 项）：七种武器状态 × 旅行/探索，真实晋升→DF→缓存回调后持续走 12 步；自然定时消融的一段 40 步旅行与镜像录像回放零 OOS；已知剩余路线新阻挡、合法消息与正常到达仍停止；拒绝移动不耗回合/RNG。

新增 `src/test/glyph_inverse_contrast.test.ts`（8 项）：从实际 CSS 读调色板计算 ≥4.5:1，断言所有反色状态固定背景/行级颜色并覆盖后代颜色、透明度、发光。修复前新增测试 **23 failed / 2 passed**；修复后 **25 passed**。测试开发时校正了新增夹具的力场层（粉碎卷轴写 DUNGEON）以及快照省略 false 的表示；没有改断言语义、门限、skip 或守卫名单。唯一旧测试前提修订见下节。

最后的样式复核补强了上述根元素背景/文字成对声明断言：补强前 CSS 测试 **7 failed / 1 passed**（exit 1，`.tmp-evidence/glyph-inverse-pair-before.log`）；补上生产 CSS 后，W-14 与两份新增回归再次 **49/49、exit 0**。当时进行中的六 worker 完整运行主动中止（exit 130，未形成完整结果），不计作门禁；最终八 worker 运行从头验证最终文件，见下方原文。没有改超时、守卫名单或任何旧断言。

修改后的首次扩展定向运行为 **7 failed / 89 passed**（5 文件，exit 1）：7 项均是新增旅行用例把快照省略的 `isAutoExploring` 误当成必须存在的字面 false。新增用例改为按现有快照合同读取 `?? false` 后，25 项全绿；既有 `x3_u4_auto_travel`、`b_1_weapon_specials`、`p4_7_player_weapon_geometry` 三文件 71 项在该次已通过。该次没有修改旧守卫，后续唯一修订见下节；没有以部分通过代替最终完整门禁。

### 唯一旧测试前提修订：W-14 阻障法术入口

首次完整 `test:full` 完整跑完，**1 failed / 4741 passed / 8 skipped / 5 todo**，266 文件中 265 通过，exit 1（2153.42s）。失败是 `w_14_obstruction.test.ts` 的 `invalidates active path/safety caches without adding a non-CE waypoint rebuild`：它在手设活动玩家路线后直接调用 `zapBoltFromPlayer`，依赖 DF 缓存回调越过输入边界清路线，正好依赖本次修掉的旧行为。

该次原文（exit 1，`.tmp-evidence/test-full.log`）：

```text
 Test Files  1 failed | 265 passed (266)
      Tests  1 failed | 4741 passed | 8 skipped | 5 todo (4755)
   Start at  03:42:16
   Duration  2153.42s (transform 4.97s, setup 0ms, import 132.65s, tests 8446.21s, environment 65ms)
```

单变量反事实没有改测试、CSS 或夹具：仅将 `Game.ts` 替换为起点 HEAD 版本，原 W-14 **24/24、exit 0**；随后恢复修复后的同一份 Game，原 W-14 **1 failed / 23 passed、exit 1**。原完整运行期间 560 个生产/测试/脚本/资源文件散列也全部不变。对应日志为 `.tmp-evidence/w14-counterfactual-original-game.log`、`w14-restored-fixed-game-old-test.log`。

修订仅把原 detonation 调用包入真实的 `g.executeCommand('item:command', undefined, callback)` 边界，模拟玩家主动施法先取消旅行的前提（`Game.ts:2764`），之后依旧执行同一个显式阻障 bolt、同一个 staff 与同一个目标。**原全部断言逐字保留**：自动路线为空、鼠标旅行关闭、safety 缓存过期、不重建 waypoint、loopMap 已刷新、needsRender=true。没有手工清状态、mock 取消方法、反转期望、删用例或加 skip；自发的远处 DF 保留旅行由新增用例守住。修订后 W-14 + 两份新增回归共 **3 文件 / 49 项通过**，另重新 build 通过。

未修改生成基线或黄金 trace；最终散列与门禁原文如下。

门禁分档：自动行动流程修复（中档），附加完整 CE 一致性门禁。使用现有只读 CE；没有运行 ce:fetch。独立的合并前 npm test 仍按任务书留给验收方，本轮 test:full 实际覆盖该完整测试集合并强制 CE 存在。

- `npx vue-tsc -b`：最终 exit 0，无诊断输出（`.tmp-evidence/vue-tsc-final.log`）。
- `npm run build`：最终 exit 0，951 modules transformed，`✓ built in 2.15s`；保留原有大 bundle 提示（`.tmp-evidence/build-final.log`）。
- 相关、录像（`u_27_recording`、`x2a_recording_checkpoint`、`x3b_display_recording`）、UR2/UR3/UR4、U03、前端与所有源码守卫：均纳入下述完整 test:full；定向回归原文（exit 0）：

```text
 Test Files  3 passed (3)
      Tests  49 passed (49)
   Start at  04:44:13
   Duration  4.61s (transform 932ms, setup 0ms, import 1.58s, tests 4.19s, environment 0ms)
```

`npm run test:drift -- --maxWorkers=1` 原文（exit 0；`.tmp-evidence/test-drift.log`）：

```text
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  04:44:26
   Duration  25.94s (transform 653ms, setup 0ms, import 1.03s, tests 24.80s, environment 0ms)
```

`npm run test:full -- --maxWorkers=8` 最终原文与退出码（`.tmp-evidence/test-full-final.log`）：

exit 0，原文：

```text
 Test Files  266 passed (266)
      Tests  4742 passed | 8 skipped | 5 todo (4755)
   Start at  04:44:56
   Duration  1449.48s (transform 8.45s, setup 0ms, import 191.96s, tests 11358.56s, environment 85ms)
```

8 项既有 skip 和 5 项既有 todo 未变化。运行中有与首轮相同的 Node `--localstorage-file` 提示；实际完整运行退出码为 0，没有更改超时、skip 或守卫名单。

最终门禁前 560 个生产/测试/脚本/资源文件联合 SHA-256：`f35caf296e82e3038c30c4da6f74f15e57533bd82932c82ab9a9cc0470d3dfc5`。

最终门禁后重新枚举同一范围，560 个文件联合 SHA-256 与上值相同；**新增 0、删除 0、内容变化 0**。测试期间没有修改最终生产/测试/脚本/资源文件。`git diff --check` 为 exit 0，本次六个交付文件均无 CRLF；分支及 HEAD 仍为 `fix/rapier-travel-inventory-contrast` / `ad3e902`，暂存区为空。

两份生成基线与三份黄金 trace 未重录，前后 SHA-256 保持如下：

| 文件 | SHA-256 |
|---|---|
| `src/test/fixtures/generation_baseline.json` | `329e38c22ebde8b2860b7512ef162765b23f1a09228b366debad068322526087` |
| `src/test/fixtures/deep_generation_baseline.json` | `14e8684e968b258cc9d32beff050600c886403e641a1e920714131ae90da6c46` |
| `src/test/fixtures/traces/u-r2-trace.json` | `2e438d68b2e1e032e3a73c95c9a3791fbfd9ba77a82a0c951d98411cad90fc68` |
| `src/test/fixtures/traces/u-r3-trace.json.gz` | `5e99edd8af3fe5d9056a9b8c6552c05da62b2f65a7cdffaa7c862da7915989c0` |
| `src/test/fixtures/traces/u-r4-trace.json.gz` | `0f524dac5f5f0c7376ee61f160a5ab6bf51dc4841b65ae9d2c6e4524bc9b4d6b` |


## 7. 交付范围

生产文件：`src/engine/Core/Game.ts`、`src/assets/theme-shells.css`；新增两份回归测试、仅修入口前提的 `src/test/w_14_obstruction.test.ts` 及本报告。原任务书是用户提供的未跟踪文件；工作期间出现的 `docs/tasks/fix-title-wordmark-mobile.md` 不属于本任务，未修改。

截图与原始证据留在忽略目录，未加入仓库。未 commit/push；单独的合并前 `npm test` 和浏览器截图按任务书由验收方完成。


## 8. 首页字标

### 范围与修复

以上细剑/对比度改动经 Claude 审查通过后，按用户追加授权执行 `docs/tasks/fix-title-wordmark-mobile.md`；仍在同一分支，本轮只修改表现层，不 commit/push。

原字标是五行 U+2588 方块文本，移动端字号下限 7px、行高 1.05，形状依赖设备字体的块字形、回退字体和行盒度量。任务书的 375×812 截图已显示断裂；本环境未使用浏览器，不能独立裁定设备实际使用了哪种回退字体。此次去掉字体渲染依赖，原 35×5 点阵逐位保留，改为同一份 0/1 数据生成内联 SVG 的 **83 个 rect**，每格 3×5，`viewBox="0 0 105 25"`。相邻格共享整数边界，根 SVG 使用 `shape-rendering="crispEdges"`、`preserveAspectRatio="xMidYMid meet"`，不再使用 pre、块字符文本、字号或行高来画字标。

3:5 网格保留原等宽文字的长宽观感；响应式宽度 `clamp(147px,30.45vw,315px)` 沿用原 7–15px 等宽字标约 0.6em 字宽的尺寸区间，辅以 `max-width:100%`、`height:auto`。保留 `--th-fg` 颜色和 4.5s 的 `th-flicker` 闪烁，原 text-shadow 换成同色同半径的 `filter:drop-shadow(0 0 10px #e4dfd155)`。SVG 继续 `aria-hidden=true`，原通过 i18n 显示的隐藏 h1 保留。

删除首页“刻符”与“GLYPH CONSOLE”，也删除所有菜单子页（含设置卡片右上角）的主题名徽标。移除 `chapter` / `chapterCode`、`.title-chapter` / `.title-code` / `.section-mark` 的失效 CSS，以及本任务明确要求删除的两个 active i18n 键 `title.glyph` / `title.glyph_code`；没有新增文案。字标下边距归零，以已有品牌块的桌面 42px / 手机 30px 下间距衔接菜单，移除副标题留下的多余占位。

### 回归与截图边界

新增 `src/test/title_wordmark.test.ts`，7 项测试渲染真实 MainMenu 模板：重建 35×5 点阵并逐位比较原字形、检查 83 个 rect 的尺寸/边界/无重复、SVG 装饰属性与隐藏标题、两标签和子页徽标及死样式/翻译键消失；五个指定视口检查响应式宽度、比例、DPR 1/2/3 的共用网格边界及发光/闪烁声明。每次实际模板渲染均断言双 RNG 状态不变。

测试开发最初两次收集因 Node 无 window、InputManager 导入失败，均没有执行用例。只修新增 SSR 夹具，替换浏览器键盘适配器；字标数据、实际组件模板和渲染逻辑均未 mock。随后只把 MainMenu 回退到本轮前的同一份生产文件，保持 CSS、资源、测试不变，7 项全部失败（exit 1）；恢复 SVG MainMenu 后 7 项通过（exit 0），字节恢复验证通过。没有修订任何旧测试、断言、超时或 skip。日志在 `.tmp-evidence/title-wordmark-before.log`、`title-wordmark-counterfactual-main-menu.log`、`title-wordmark-after.log`。

| 指定视口 | SVG 计算宽×高（CSS px） |
|---|---|
| 375×812 | 147×35 |
| 390×844 | 147×35 |
| 768×1024 | 233.856×55.68 |
| 1280×800 | 315×75 |
| 1920×1080 | 315×75 |

这些是模板、CSS 和 viewBox 的数值检查，**不代替浏览器截图**。五视口的真实像素呈现、发光和闪烁观感由 Claude/用户验收；本轮没有生成或提交截图。

### 轻档门禁原文

`npx vue-tsc -b`：exit 0，无诊断输出（`.tmp-evidence/title-vue-tsc.log`）。

`npm run build`：exit 0（`.tmp-evidence/title-build.log`），原文：

```text
✓ 951 modules transformed.
✓ built in 1.93s
```

保留既有 >500 kB bundle 提示。

相关前端与必跑守卫整文件批次（包括上一轮反色回归；exit 0，`.tmp-evidence/title-frontend.log`）：

```sh
npx vitest run src/test/title_wordmark.test.ts src/test/glyph_inverse_contrast.test.ts \
  src/test/ui_concepts.test.ts src/test/immersive_mode.test.ts src/test/immersive_polish.test.ts \
  src/test/theme_shell_fixes.test.ts src/test/gameplay_layout.test.ts \
  src/test/p2_6_display_settings.test.ts src/test/map_tile_modes.test.ts \
  src/test/repo_hygiene.test.ts src/test/u24_hardcoded_text.test.ts src/test/p1_30_i18n_gate.test.ts \
  src/test/r_1_appearance.test.ts src/test/x3_u5_ui.test.ts \
  src/test/ui_1_rendering.test.ts src/test/ui_2_protection.test.ts --maxWorkers=4
```

```text
 Test Files  16 passed (16)
      Tests  212 passed (212)
   Start at  05:24:07
   Duration  7.07s (transform 2.47s, setup 0ms, import 7.27s, tests 14.00s, environment 3ms)
```

读源码守卫：重新用 rg 和 TypeScript AST 反查当前测试，保留此前 DESIGN-3b 审计过的全部定义，补上动态/参数化标题与共享读取函数。首批 74 文件、106 个定义展开为 112 项；文件/标题清单与筛选式分别在 `.tmp-evidence/title-source-guards.json`、`title-source-guard-files.txt`、`title-source-guard-pattern.txt`，实际命令为 `npx vitest run <文件清单> -t <筛选式> --maxWorkers=4`。exit 0（`.tmp-evidence/title-source-guards.log`），原文：

```text
 Test Files  74 passed (74)
      Tests  112 passed | 1511 skipped (1623)
   Start at  05:26:15
   Duration  42.97s (transform 2.71s, setup 0ms, import 29.71s, tests 50.86s, environment 13ms)
```

再核对 93 个源码读取候选文件：9 个只读已存 fixture，排除出源码守卫；5 个由上面的整文件前端批次覆盖；余下 5 个共享读取入口补跑，包括 BoltCatalog 的 ce 别名、U05a 与 X4-R1 的顶层 CE 数据、UX-1A 的组件编译读取、blueprint_center 的扫描助手中的生产源码断言。清单/筛选式在 `.tmp-evidence/title-source-guard-extra.json`，日志 `.tmp-evidence/title-source-guard-extra.log`。

补查 exit 0，原文（完整清单中五文件，`--maxWorkers=2`）：

```text
 Test Files  5 passed (5)
      Tests  16 passed | 61 skipped (77)
   Start at  05:29:19
   Duration  266.71s (transform 843ms, setup 0ms, import 2.17s, tests 265.84s, environment 1ms)
```

上述 skipped 是 -t 未选的其它行为用例，不是新增 skip，也不作为完整测试通过的证据；本轮按用户要求只做轻档门禁，合并前完整 npm test 留给验收方。源码守卫运行中的既有 Node localstorage 提示保留。

源码守卫门禁前后重新枚举 561 个生产/测试/脚本/资源文件，联合 SHA-256 均为 `d4b396fa75cc34deffeddfb2b492e1e666653063a68ab66ee3e1de273497ecf6`，新增 0 / 删除 0 / 内容变化 0。相对已审查的上一轮，只增加字标测试并修改下述四个表现层生产文件，其余内容逐文件散列一致。`git diff --check` 为 exit 0，本轮五个源码/测试文件及报告没有 CRLF；报告原有内容逐字保留，仅末尾追加本章。

本轮生产文件为 `src/components/MainMenu.vue`、`src/assets/theme-shells.css`、`src/assets/title-screen.css`、`src/locales/zh_CN.json`，新增测试与本报告追加章节。上一轮 Game/旅行回归/旧 W-14 前提修订保持已审查内容；没有新增 Game 字段、规则或随机数调用，基线与黄金 trace 未动。任务书保持原样，未 staging、commit 或 push。
