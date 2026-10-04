# 4a-2 执行报告：原生物理战斗子里程碑

日期：2026-10-05。基于 `ext/phase4` / `3c403983ffeb0eae9a959c9c3d5061884fb4dffb` 工作树执行，**未 commit**。

本轮按任务书“可在干净子里程碑停下并列剩余项”交付近战与几何武器的引擎闭环。**4a-2 整步尚未完成**：弹道/投掷、范围效果、自动目标排序、视野/感知留待接续。没有增加 giants 生产内容或修改渲染、组件、UI。

## 已完成与能力边界

- 独立 `builtin:square-2`、`builtin:square-3` 的原生玩家/NPC 普通近战使用最近合法接触格对。枚举全部相邻身体格对，过滤双方通行和斜角；首个等距候选不合法时继续找其他候选。防守方原 `MONST_ATTACKABLE_THRU_WALLS` 例外保留。没有合法接触时不结算伤害/命中 RNG；大型 NPC 可继续用 4a-1 的接触位姿图绕到合法位置。
- 大型普通攻击仍只打一个目标。原生盟友、敌对、纷争以及入迷接触入口共用完整单目标物理后处理，NPC 仍由 `endTurnWithAttack()` 提交自己的耗时，没有嵌套玩家命令或改 3a0 调度。
- 玩家横扫、矛、连枷、突进及 NPC 横扫/矛按调用方短命 `Set<string>` 作用域调用 4a0 `collectBodyTargets(..., { effect: 'geometry' }, scope)`，默认 part 键。独立无 zone 刚体每实体一次；不同实体分别受击，不同行动重新建立 scope。鞭第一接触只结算一个生物。矛保留远→近的原顺序；同一身体的第二格不增加一次完整攻击。
- 大型横扫遍历 footprint 的邻接并集；自己的身体由攻击资格排除。NPC 射线从面向目标的身体边缘发起，候选射线按距离稳定选择；相邻目标使用合法接触的攻击者格，覆盖身体下沿目标，而非始终从左上锚点发射。square 来源的射线逐段检查斜角，普通来源在 square 接触段复核斜角。
- 一击内的血迹、伤害/状态浮字、符文闪光与力场/钝器方向使用实际接触格，不临时改 `loc`。纯接触摘要不取随机数或写探索知识。位置 scope 是同步、可嵌套、异常时恢复的派生 WeakMap，不进入实体状态/存档/录像；普通 1×1 不建立 scope 条目。
- 抓持仍在命中骰前进行。square 只在合法相邻接触时抓持；**可隔墙攻击不授予跨非法斜角抓持**。classic、extended 和命中预览同步这项资格。带 `grid` 的预览能检验地形；不带 `grid` 的预览只有足迹距离摘要，地形合法性仍须由攻击入口判定。
- growth 的现有原生 `validateAction`/controlled attack 按合法身体格瞄向同一实体，保留风险准备协议。确认守卫纳入 square 组件及 `squareAnchorRevision`，覆盖目标移动、离开后回到原位、换形和墙角变化。No 不支付资源/冷却、不改变 RNG/耗时；Yes 的矛双格接触只调用一次 `physicalResolved`、一次酸性武器降级。
- 支配没有体型免疫；真实支配效果可把 square 转成盟友，再使用 4a-1 的整体移动与禁止交换。支配沿原规则清空 `leader`，没有强行写玩家 leader。此项是既有关系底座的专项确认，不声称自然大型盟友内容已开放。

`ActorCombatResolution.eligible` 的 spatial 拒绝守卫**保持原文件不变**。本轮只接原生 CombatSystem/Game/Monster 和既有 growth controlled native action；combat 模块的 actor-action 多格资格仍留给 3b。任意 mask/pose/zone/复合体/玩家 spatial/主动形态转换的原边界没有开放。

规格复核同时读取本地 legacy 的 `Combat.c:1212–1237`、`Monsters.c:3823–3827` 与官方当前 master 的 [Combat.c](https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Combat.c)（抓持执行条件）和 [Monsters.c](https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Monsters.c)（moveMonster 近战准入）。本轮涉及的距离、斜角、穿墙攻击例外相同；抓持本身不额外检查两个端点的通行，已用动态墙中 square 的正交抓持锁定这一差别。未同步 CE 版本或改 1×1 的既有执行语义。

## 共享文件函数级改动

| 文件 | 函数与用途 |
|---|---|
| `engine/Combat/BodyCombat.ts`（新增） | `nearestLegalMeleeContact`：纯合法接触查询；`withBodyAttackContact`、`physicalContactOf`、`bodyAttackContactOf`：同步接触位置 scope；`bodyRayOrigin`、`bodyRayContact`：身体前缘/具体射线受击格。 |
| `engine/Combat/Combat.ts` | `attack`/抽出的 `attackAtContact`：只包接触位置，原 hook/因果/逐击事实次序不变；`resolveAttack`、`resolveAttackExtended` 与 `previewHitChance`：square 抓持的距离/斜角资格同步。没有合并 classic/extended 两套解算器。 |
| `entities/Creature.ts` | `takeDamage`：血迹位置读取当前物理接触；其余护盾、转血、HP、伤害 hook、死亡顺序保留。 |
| `engine/Core/Game.ts` | `meleeContact` 公共端口；controlled attack 的校验、准备与执行方向；`confirmationGuard`、`captureControlledAttackTargets` 的组件/移动 revision 复核；普通近战名单与横扫/矛/突进/连枷唯一 part 收集；`resolvePlayerMeleeAttackOn`/抽出的 `resolvePlayerMeleeAttackAt` 包整个原后处理；`applyWeaponRunicEffect`、`tryTriggerArmorRunic`、`processStaggerHit` 使用实际位置/方向；`findLiveSeizer` 的 square 合法接触检查。 |
| `entities/Monster.ts` | `resolveBodyMeleeAdjacent` 及 `resolveGeometryAttackOn`/抽出的 `resolveGeometryAttackAt`；盟友/敌对/困境/纷争的 square 单目标分发；`performWhipAttack`、`performSpearAttack`、`performSweepAttack` 的身体原点/作用域；`tryGeometryMeleeAdjacent`、`tryGeometryRayTo`；`takeSquareMovementTurn` 的外围纷争目标、非法接触绕路与几何射线；`moveEntranced` 的 square 接触攻击/抓持。没有改 `prepareNativeDecision`、`takeTurn` 包装或 TimeCoordinator。 |
| 测试清单 | `scripts/test-suites.json` 只注册新原生专项；growth 自有 `test-suites.json` 只注册其自有专项，没有挪动测试归属或改旧守卫。 |

## 供 3b 直接复用的接口

1. `Game.collectBodyTargets(cells, policy, scope)` / 底座同名函数：caller 生成合法范围格，传 `{ effect: 'direct' | 'geometry' | 'area-damage' | 'mental' | 'identity' | ... }` 或显式 `dedup`，并持有该独立子段的 scope。返回 `BodyTarget`（entity/entityId/groupId/partId/zoneId/dedupKey/contact）；独立子段换新 scope，不能跨整束攻击全局合并。D08 的 part/group 默认仍在 4a0 的 `EFFECT_TARGET_POLICY`，本轮没有重定义它。
2. `Game.meleeContact(attacker, defender)` / `nearestLegalMeleeContact(grid, attacker, defender, options?)`：返回冻结的 `{ from, to, distance: 1 }` 或 null；`allowThroughWalls: false` 用于不继承穿墙攻击例外的斜角资格；抓持另传 `requirePassableTerrain: false`，与 CE 仅检查距离/斜角的执行条件一致。接收只读足迹 actor，也可查询未来位置，不先移动再回滚。
3. `bodyRayOrigin`/`bodyRayContact` 与 `withBodyAttackContact`：几何调用方传真实来源与第一次碰到的身体格，再包一次完整生物效果。它们不是通用 projectile/AoE 运行器，也不会自动改变费用、目标知识或 scope 的去重政策。

Native scope 仍调用 `assertNativeSpatial`，只接受当前已开放的独立 square；3b 不应因为已有这些接口而删除 actor-action 守卫，需先在自己的资格、目标/费用计划与真实格接触上明确接线。

## 专项证据

新增原生专项覆盖 2×2/3×3 尾格普通攻击、全邻接合法格对、隔墙/斜角与穿墙例外、一次单目标攻击/抓持/反伤/击杀/掉落、真实 `ITEM_RUNIC` 力场、血迹/浮字/射线方向、异常与嵌套 scope、鞭/矛/横扫、连枷/突进、独立目标/行动、下沿 NPC 射线、入迷、支配盟友整体移动。

新增 growth 自有专项使用真实 `createGrowthGameplay`、解析过的测试定义包及实际技能命令。除了配置初始技能点/学习条件与 equip 不耗时，pressure 的消费数声明为 2、持续声明为 10 个客观块以保留观察窗口；效果仍施加到原定义的 target，经原 `physicalResolved` 消费，未用假 hook/手改组件制造结果。覆盖 prepared No/Yes 与移动/返回/换形/墙角陈旧取消、酸性降级一次、目标的独立两击预算分别 2→1→移除。

真实 Game 的 fixture 注入 2×2/3×3 与武器/布景，保留原开局方法，以同一开局装配重现录像。五条真实 `executeCommand('move', ...)` 逐条比较完整存档世界投影（包括双 RNG，去掉 savedAt 和录像前缀字段），并比对存档续录事件、每条 replay、四个 seek 位置。没有合成录像事件或加载后补写世界，没有改存档/录像 schema、黄金 trace 或生成基线。

## 实际门禁

Node **24.19.0**，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。没有运行完整 `npm test` / 全部 `test:ext` / removal / CE full/gen / drift。

| 实际执行 | 结果与本地证据 |
|---|---|
| **最终 51 文件相关集合**（下列完整清单） | **51/51 文件、1120/1120 项通过，exit=0，200.06s**；`/private/tmp/p4a2-related-ce-qualified-final.log`。包括 4a0 零影响差分、全部 4a-1/3a0 专项、UR2/3/4、独立 classic/extension 中性差分与真实屠戮旗标保险，以及相关战斗/几何/关系/growth/录像/源码守卫。 |
| 最终新增专项，两文件 | **36/36 通过，exit=0，9.20s**；`/private/tmp/p4a2-special-ce-qualified.log`。已包含在最终 51 文件中，不相加计总数。 |
| 最终 `node scripts/check-module-boundaries.mjs` | exit=0；`/private/tmp/p4a2-boundary-ce-qualified-final.log`，另同代码独立命令确认 exit=0。 |
| 最终 `npx vue-tsc -b` | exit=0；`/private/tmp/p4a2-type-ce-qualified-final.log`，另同代码独立命令确认 exit=0。 |
| 最终 `npm run build` | exit=0，Vite 2.84s；`/private/tmp/p4a2-build-ce-qualified-final.log`。保留既有 >500 KB chunk 提示。 |
| 最终 `c_4a_terrain_catalog.test.ts -t 白名单` | 源守卫 1 项通过、29 项由 `-t` 过滤，exit=0，2.05s；`/private/tmp/p4a2-terrain-guard-ce-qualified-final.log`。不声称完整目录文件已跑。 |
| 文件核对 | `git diff --check` 通过；9 个生产/测试/清单文件在最终门禁前后 SHA-256 一致，全部 LF；散列清单 `/private/tmp/p4a2-delivery-hashes.json`。 |

前一轮 51 文件也完整通过（1119 项、exit=0、195.80s，`/private/tmp/p4a2-related-delivery.log`）；随后官方 CE 复核补充正交墙中抓持资格及其专项，再按上表用最终代码完整重跑，没有以早一版测试替代最终结果。各轮重叠测试不累计为独立总数。原始日志保存在 `/private/tmp/p4a2-*.log`，没有提交截图或大体积原始证据。


完整相关集合的可复现命令（先设置上述 Node 环境）：

```sh
npx vitest run \
  src/test/phase4a2_body_combat.test.ts \
  src/test/phase4a0_spatial.test.ts \
  src/test/phase4a0_spatial_differential.test.ts \
  src/test/phase4a1_game_square.test.ts \
  src/test/phase4a1_square_pathing.test.ts \
  src/test/phase4a1_pathing_perf.test.ts \
  src/test/phase4a1_game_perf.test.ts \
  src/test/phase3a0_actor_action.test.ts \
  src/test/phase3a0_defense.test.ts \
  src/test/phase3a0_native_prelude.test.ts \
  src/test/phase3a0_scheduler.test.ts \
  src/test/u_r2_trace.test.ts \
  src/test/u_r3_trace.test.ts \
  src/test/u_r4_trace.test.ts \
  src/test/ext_combat_neutral_differential.test.ts \
  src/test/ext_slaying_alignment.test.ts \
  src/test/slaying_melee_autohit.test.ts \
  src/test/ext_controlled_action_bridge.test.ts \
  src/test/ext_prepared_controlled_commands.test.ts \
  src/test/u_13_combat_math.test.ts \
  src/test/p4_4_split_kamikaze.test.ts \
  src/test/p4_5_melee_specials.test.ts \
  src/test/p4_6_attack_geometry.test.ts \
  src/test/p4_7_player_weapon_geometry.test.ts \
  src/test/b_1_weapon_specials.test.ts \
  src/test/u_15d_weapon_runic.test.ts \
  src/test/u_15d2_armor_runic.test.ts \
  src/test/u_11_corpse_learning.test.ts \
  src/test/w_10_poison.test.ts \
  src/test/w_18_entrancement.test.ts \
  src/test/x3_u1_movement_safety.test.ts \
  src/test/x3_u2_ally_captive.test.ts \
  src/test/u_03_whole_run_snapshot.test.ts \
  src/test/u_27_recording.test.ts \
  src/test/x2a_recording_checkpoint.test.ts \
  src/test/x3b_display_recording.test.ts \
  src/test/u24_hardcoded_text.test.ts \
  src/test/p1_30_i18n_gate.test.ts \
  src/test/repo_hygiene.test.ts \
  src/test/test_suite_membership.test.ts \
  src/test/w_4_bolt_reflection.test.ts \
  src/test/w_3_bolt_trajectory.test.ts \
  src/test/ext_bolt_causality.test.ts \
  src/ext/modules/growth/tests/ext_growth_square_melee.test.ts \
  src/ext/modules/growth/tests/ext_growth_skill_integration.test.ts \
  src/ext/modules/growth/tests/ext_growth_prepared_commands.test.ts \
  src/ext/modules/growth/tests/ext_growth_skills_movement.test.ts \
  src/ext/modules/growth/tests/ext_growth_target_knowledge.test.ts \
  src/ext/modules/growth/tests/ext_growth_classic_isolation.test.ts \
  src/ext/modules/growth/tests/ext_growth_public_effects.test.ts \
  src/ext/modules/growth/tests/ext_growth_npc_replay.test.ts \
  --maxWorkers=2
```

## 失败、旧守卫与基线

旧生产守卫、旧测试断言与夹具、黄金 trace、生成基线没有修改或重录，因此无旧测试前提修订/反事实登记。

开发期新专项先后暴露并修正：3×3 出生布景覆盖玩家；普通 NPC 目标意外睡眠触发三倍伤；死亡方法的幂等/独立 scope 包装调用应观察实际独立死亡出口；pressure 的持续效果实际属于 target，且技能本身是攻击；NPC 合法绕路后再检查原位置须重新布景；支配按原规则把 leader 清空。没有把这些失败算作通过。首轮 48 文件集合完整退出 1（47 文件通过，唯一失败文件是上述尚未修正的新增专项，2 failed/1041 passed），最终集合另外完整重跑，不用定向拼接声称首轮全绿。

## 尚未完成的 4a-2 项目

1. **弹道/投掷**：以首个真实身体格保存 contact，穿透对同一多格 part 生物效果及反射骰只一次；混合 1×1 反射重访语义与真实投掷专项。当前占位查询可命中尾格，不等于 projectile scope 已完整迁移。
2. **范围效果**：闪电、火球、爆炸等按 D08 part scope 收集；否定/纷争/支配等整体效果按 group scope。4a-1 的环境/DF 作用域不是本步全部范围攻击验收。
3. **自动目标**：唯一实体候选按最近合法公开接触排序、隐藏格知识过滤；手动点击格保存及尾格瞄准专项。当前完成的是原生近战和 controlled targetId 的身体解析/风险准备。
4. **视野与感知**：任一身体观察格 LOS，footprint 距离/嗅觉/警觉摘要后一次掷骰，噪声图最小值唤醒一次，稳定身体中央发光原点，以及部分可见/气体显影不泄漏其他隐藏格。4a-1 已有部分占格可见与遮光 helper 不足以声称此项完成。
5. 接续以上路径后，补混合攻击/范围/感知/目标的真实 save/load/replay/seek/续录，并按任务书开发期政策跑其直接相关门禁。4a-3 UI/渲染和 4a-4 内容继续独立实施。
