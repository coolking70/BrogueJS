# 4a-2 完整执行报告：方形身体的攻击、目标与视野

日期：2026-10-05。首轮近战/几何子里程碑基于 `3c403983ffeb0eae9a959c9c3d5061884fb4dffb`，已由维护者审阅并提交。本轮从 `ext/phase4` HEAD `d1eed903b54fc17ce343bbec60f9241974278f0b` 接续，**未 commit**；以下保留首轮实现与历史证据，并补充完整 4a-2 的交付。

4a-2 的原生引擎功能现已补齐：近战/几何、弹道/投掷、D08 范围效果、公开目标、身体视野/一次感知以及混合真实存档录像。仍只开放 fixture 创建的独立 `builtin:square-2/3`；没有增加 giants 生产内容或修改组件、身体渲染。知识过滤位于引擎显示模型，不提前实施 4a-3。

## 首轮已完成与能力边界（保留）

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

## 首轮共享文件函数级改动（保留）

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

## 首轮专项证据（保留）

新增原生专项覆盖 2×2/3×3 尾格普通攻击、全邻接合法格对、隔墙/斜角与穿墙例外、一次单目标攻击/抓持/反伤/击杀/掉落、真实 `ITEM_RUNIC` 力场、血迹/浮字/射线方向、异常与嵌套 scope、鞭/矛/横扫、连枷/突进、独立目标/行动、下沿 NPC 射线、入迷、支配盟友整体移动。

新增 growth 自有专项使用真实 `createGrowthGameplay`、解析过的测试定义包及实际技能命令。除了配置初始技能点/学习条件与 equip 不耗时，pressure 的消费数声明为 2、持续声明为 10 个客观块以保留观察窗口；效果仍施加到原定义的 target，经原 `physicalResolved` 消费，未用假 hook/手改组件制造结果。覆盖 prepared No/Yes 与移动/返回/换形/墙角陈旧取消、酸性降级一次、目标的独立两击预算分别 2→1→移除。

真实 Game 的 fixture 注入 2×2/3×3 与武器/布景，保留原开局方法，以同一开局装配重现录像。五条真实 `executeCommand('move', ...)` 逐条比较完整存档世界投影（包括双 RNG，去掉 savedAt 和录像前缀字段），并比对存档续录事件、每条 replay、四个 seek 位置。没有合成录像事件或加载后补写世界，没有改存档/录像 schema、黄金 trace 或生成基线。

## 首轮实际门禁（维护者提交前的历史证据）

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

## 首轮失败、旧守卫与基线（保留）

旧生产守卫、旧测试断言与夹具、黄金 trace、生成基线没有修改或重录，因此无旧测试前提修订/反事实登记。

开发期新专项先后暴露并修正：3×3 出生布景覆盖玩家；普通 NPC 目标意外睡眠触发三倍伤；死亡方法的幂等/独立 scope 包装调用应观察实际独立死亡出口；pressure 的持续效果实际属于 target，且技能本身是攻击；NPC 合法绕路后再检查原位置须重新布景；支配按原规则把 leader 清空。没有把这些失败算作通过。首轮 48 文件集合完整退出 1（47 文件通过，唯一失败文件是上述尚未修正的新增专项，2 failed/1041 passed），最终集合另外完整重跑，不用定向拼接声称首轮全绿。

## 接续完成原剩余项 1–5

| 原剩余项 | 完成行为与证据 |
|---|---|
| 1. 弹道/投掷 | `traceBolt` 的首次真实身体格保留 contact，同一 projectile 的反射段共用 D08 scope；穿透同一 square 的 part 只一次生物效果。反射只在首次碰撞进入原 CE 决策，**成功反射仍保留第二次“朝施法者或随机方向”骰**，后续身体格不重复尝试。普通 1×1 原反射重访、每次伤害保持。真实投掷在尾格首碰撞停，伤害、血迹和完整符文后处理使用该格；真实力场符文验证了不同于锚点方向的击退。 |
| 2. 范围效果（D08） | `collectAreaBodyTargets` 先生成原欧氏半径/LOS 的合法格，再交实际占格；伤害按 part，否定/纷争及整体身份/精神按 group。闪电走 projectile 的 `area-damage`；真实爆炸 DF 用 `area-damage` 接触键且保留 CE 免疫窗口。焚化的原 DF 铺火仍是地形暴露：投掷九个、饮用三个原点在同一行动内共用短命 scope，一份燃烧状态，独立死亡 DF 仍新建 scope。没有增加任务书举例中的新生产火球招式。 |
| 3. 自动目标/尾格 | 唯一实体候选按最近合法**公开**接触格排序；最邻近格被阻挡时继续找其他公开格。自动光标、循环、默认施法、自动探索近战选择实际格；手动鼠标命令仍原样保存点击 `{x,y}`。controlled skill/风险确认要求公开合法近战接触，隐藏邻格不因远格可见而获得资格；等待后知识丢失会无资源/RNG/耗时/录像事件取消。 |
| 4. 视野/感知 | 可信 NPC LOS 枚举双方身体格，带空间斜角约束；恐惧路径、盟友找敌/瞬移接近也接全身体。嗅觉/可见性/最近距离先摘要，再执行一次原 25% 警觉或 97% 保持骰，免骰分支继续免骰。警报取身体格距离图最小值、一次唤醒。固有/突变/燃烧光每种源只取一个稳定中央占格，遮光仍覆盖全身体。身份门槛保留；气体只公开可见气体格；telepathy/entranced 只保留原单位置标记，不公开隐藏身体拓扑。悬停/检视也逐格检查知识，不写玩家探索。 |
| 5. 混合真实持久化 | 2×2/3×3 同场，加普通受击者、普通必反射者、真实爆炸死亡 DF 和正常行动的 SPARK NPC。11 条真实命令含自动选敌/循环、尾格点击、投掷武器/焚化、纷争/否定、等待；在 pendingArcana 中保存 `toSaveSnapshot` 经 JSON 读回 `loadSnapshot`，接续记录前缀；逐条 `loadReplay/replayStep` 及前后 seek 1/3/7/5/11，比较完整世界投影与双 RNG。没有合成录像事件、加载后补写世界或绕过真实调度。 |

原近战/几何及支配盟友移动专项继续保留。`ActorCombatResolution.eligible` 与 3a0 调度文件未改，任意 mask/pose/zone/复合体/玩家 spatial/主动换形仍拒绝；没有新增 Game 状态字段或存档/录像格式。

CE 执行路径同时复核本地 legacy 与官方 master：[Items.c](https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Items.c) 的首次碰撞、两段反射决定、自动目标与警报距离图，[Monsters.c](https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Monsters.c) 的 awarenessDistance/25%/97% 分支，[Time.c](https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Time.c) 的爆炸骰、半最大 HP 下限与免疫窗口，[Light.c](https://raw.githubusercontent.com/tmewett/BrogueCE/master/src/brogue/Light.c) 的按生物光源调用。本轮将这些入口提升到独立 square 接触摘要，没有同步 CE 版本或重写普通 1×1 规则。

## 本轮共享文件函数级改动

| 文件 | 函数与用途 |
|---|---|
| `engine/Combat/BodyCombat.ts` | 新增 `withBodyContact`：弹道/AoE 包整个原生效果流程的真实位置 scope，异常/嵌套恢复；普通 1×1 直通。 |
| `engine/Combat/BodyEffects.ts`（新增） | `collectAreaBodyTargets`：半径/LOS 区域与真实占格相交，D08 类别与 scope 由 caller 明示。 |
| `engine/Combat/BodyPerception.ts`（新增） | `bodySightContact`、`bodySightCornerClear`：纯可信身体 LOS/斜角查询；`bodyLightOrigin`：稳定单光源原点。 |
| `engine/Combat/Bolt.ts` | `boltTargetCategory`：沿 4a0 已定表选择 direct/area-damage/mental/identity/healing；没有另定义 D08 表。 |
| `engine/Combat/BoltTrajectory.ts` | `traceBolt`：首次 part/group 碰撞、跨反射作用域；`boltLine`：每候选射线的身体评分一次。普通 1×1 的旧评分/反射重访保留。 |
| `engine/Combat/BoltTargeting.ts` | `automaticBoltContact`：最近合法公开接触；`arcanaTargetCandidates`：唯一实体、公开接触距离排序，原 CE 身份/敌我/能力资格保留。 |
| `engine/Map/Scent.ts` | `awareOfBodyTarget`：原 awarenessDistance 的足迹摘要；抽出 `resolveAwareness` 共用原一次概率决策。 |
| `engine/Combat/MonsterAI.ts` | `updateMonsterState`：一次身体警觉摘要；恐惧查询传完整 creature。 |
| `engine/Combat/MonsterBlink.ts` | `blinkTraversiblePath`/`openCreaturePath`/`playerTraversiblePath`：接收 Pos 或 Creature 并枚举身体 LOS；`closestBlinkEnemy`、`blinkAllyFlees`、`allyShouldPursue`、`blinkTowardCreature`/`blinkAllyAfterMagic`：足迹距离；`buildBlinkEnemyMap`/`buildBlinkTargetMap`：真实目标身体格作源，普通单格原算法保留。 |
| `entities/Monster.ts` | `monsterBoltContact`、`generallyValidBoltTarget`：身体边缘/合法目标与气体接触；原生决策的 canSeePlayer 使用可信身体 LOS。 |
| `engine/UI/MonsterVisibility.ts` | `publicMonsterCells`、`canSeeMonsterAt`、`canDisplayMonsterAt`：逐格公开几何，隐藏身份与位置标记分离；空间 `monsterHidden`/`canSeeMonster`/`canDirectlySeeMonster` 接该门槛。 |
| `engine/Core/Game.ts` | `applyBoltEffect`/抽出的 `applyBoltEffectAt` 与 `castMonsterBolt` 包真实接触；`throwItemAtStages` 的投掷/符文接触；`negationBlastFromPlayer`/`discordBlastFromPlayer` 身体范围收集；`resolveExplosionDamage`/抽出的 `resolveExplosionDamageAt` 按 part 伤害；`igniteIncinerationCells`/`applyDungeonFeatureContact` 共用原 DF 行动作用域；公开光标/`publicMeleeContact`/controlled attack/准备确认/自动探索、悬停检视、`runIsDisturbed`、`aggravateMonsters` 读公开或可信身体摘要；`updateVision` 只替换生物光源原点。 |
| 测试与清单 | 新增 `phase4a2_body_effects.test.ts`（29 项），在核心清单注册；growth 自有 `ext_growth_square_melee.test.ts` 新增 2 项公开知识/陈旧确认专项，原 8 项保持。 |

## 补充供 3b 使用的接口

- `collectAreaBodyTargets(world, origin, radius, effect, line, scope?)` / `Game.collectAreaBodyTargets(...)`：返回既有 `BodyTarget[]`，`effect` 必填；机械占格接口不提供目标知识或敌我资格。独立子段新建 scope，同一 projectile 的反射段共用 scope；普通 1×1 弹道不使用身体折叠策略。
- `withBodyContact(creature, actualContact, run)` / 既有 `withBodyAttackContact`：包完整原生效果，不改实体锚点；不承担费用/资格/确认/伤害政策。
- `publicMonsterCells(player, grid, monster)` / `automaticBoltContact(...)`：只返回可用公开 `{x,y}`，不把 `zoneId` 等派生元数据写入光标、自动路径或录像输入。可信 `bodySightContact`/`monsterBoltContact` 与它们分开，不能拿来授权玩家隐藏目标。
- `ScentMap.awareOfBodyTarget`：调用方先做一次实体决策，不对身体格循环执行概率；`bodyLightOrigin` 不复制光源，不写 FOV/探索或取 RNG。

以上不是 actor-action 多格准入许可。3b 仍需自行接费用、资格、确认、scope 与真实接触，不能删守卫即开放。

## 本轮专项证据

新增核心 29 项覆盖两尺寸闪电/反射、第一次尾格碰撞、真实投掷力场/血迹、空间 NPC 来源与目标、D08 part/group/独立 scope、真实爆炸骰与绕过免疫计时器后的显式去重、尾格否定/纷争、投掷/饮用焚化、自动目标排序/备选合法格/循环、自动探索尾格、悬停检视防泄露、可见气体/隐藏气体、telepathy/entranced 标记、双方身体 LOS/斜角、恐惧路径/盟友找敌、25%/97% 实质 RNG 计数、警报一次唤醒、稳定中央单光源/全足迹遮光，以及两种混合真实存档录像场景。

仅两个焚化状态专项在局部子段内隔离 `playerTurnEnded`，用于区分“本次 DF 的重复状态刷新”与随后客观燃烧时间；混合持久化专项不替换 scheduler/感知/攻击/环境。其他布景修改只发生在 fixture 初始化，重放用保留原开局后的同一装配；每条命令都经 `executeCommand`/`executeItemCommand`。世界比较仅排除 savedAt 和录像前缀字段（前缀另作完全相等断言）。

## 本轮实际门禁

环境与首轮相同：Node 24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=2`。相关集合加 `BROGUE_REQUIRE_CE=1` 使用现有本地 legacy 参照，避免缺 CE 静默跳过。依任务书和用户开发期政策，没有跑完整 npm test / 全部 test:ext / removal / CE full/gen / drift。

| 实际执行 | 最终结果与本地证据 |
|---|---|
| **最终 89 文件相关集合**（首轮 51 + 下列 38） | **89/89 文件、2362/2362 项通过，exit=0，293.55s**；`/private/tmp/p4a2b-related-final.log`。包含 4a0 零影响差分、全部 4a-1/3a0、UR2/3/4、ordinary/classic/extension 差分、原近战 28 项/本轮核心 29 项/growth 10 项，以及改动模块的直接相关旧测试和读源码守卫；无跳过。 |
| `node scripts/check-module-boundaries.mjs` | exit=0；`/private/tmp/p4a2b-boundary-final.log`。 |
| `npx vue-tsc -b` | exit=0；`/private/tmp/p4a2b-type-final.log`。 |
| `npm run build` | exit=0，Vite 3.11s；`/private/tmp/p4a2b-build-final.log`。保留既有 >500 KB chunk 提示。 |
| `c_4a_terrain_catalog.test.ts -t 白名单` | 源码守卫 1 项通过、29 项由 `-t` 过滤，exit=0，1.01s；`/private/tmp/p4a2b-terrain-guard-final.log`。未运行完整目录普查。 |
| 文件核对 | 15 个生产/测试/清单文件在最终门禁前后 SHA-256 一致（`/private/tmp/p4a2b-delivery-hashes.json`）；交付文件全 LF、`git diff --check` 通过；HEAD 保持 `d1eed903b54fc17ce343bbec60f9241974278f0b`、暂存区为空、未 commit。 |

开发期最后一次焚化专项的 2 文件 41 项也通过（exit=0，13.40s，`/private/tmp/p4a2b-incineration-dev.log`），已包含在最终集合，不另行累计。原始证据仅在 `/private/tmp`，没有提交日志、截图或大体积文件。

复现最终相关集合（先设置上述 Node/PATH 与环境）：保留首轮清单的全部 51 文件，再追加以下 38 文件，同一条 `npx vitest run ... --maxWorkers=2` 执行；原命令及完整文件清单分别保存在 `/private/tmp/p4a2b-related-final.sh` 与 `/private/tmp/p4a2b-related-final-files.json`。

```text
src/test/phase4a2_body_effects.test.ts
src/test/u_06_monster_damage.test.ts
src/test/u_07_monster_blink.test.ts
src/test/u_08_terrain_bolts.test.ts
src/test/u_09_learning_consumers.test.ts
src/test/u_12a_cast_eligibility.test.ts
src/test/u_12b_ally_mode.test.ts
src/test/w_2_arcana_submission.test.ts
src/test/w_8_staff_damage.test.ts
src/test/w_9_directed_status.test.ts
src/test/w_11_teleport_placement.test.ts
src/test/w_12_blink_beckoning.test.ts
src/test/w_13_tunneling.test.ts
src/test/w_14_obstruction.test.ts
src/test/w_15_shielding.test.ts
src/test/w_16_conjuration.test.ts
src/test/w_17_domination.test.ts
src/test/w_19_polymorph.test.ts
src/test/w_20_cloning.test.ts
src/test/w_21_empowerment.test.ts
src/test/w_23_negation.test.ts
src/test/w_24_wand_catalog.test.ts
src/test/w_25_staff_catalog.test.ts
src/test/w_26_arcana_closure.test.ts
src/test/b_2_throwing.test.ts
src/test/x2f_thrown_math.test.ts
src/test/f_2a_fire_mechanics.test.ts
src/test/f_2b_creature_burning.test.ts
src/test/f_2c_explosion.test.ts
src/test/c_7_lighting.test.ts
src/test/x2m_lighting.test.ts
src/test/p4_8_scent_map.test.ts
src/test/ai_1_scent_tracking.test.ts
src/test/x3_u4_auto_travel.test.ts
src/test/x3_u5_commands.test.ts
src/test/x3_u5_ui.test.ts
src/test/x3_u6_messages.test.ts
src/test/x3_u7_sidebar.test.ts
```

## 本轮失败、旧守卫与基线

旧测试前提/断言、生产源码守卫、黄金 trace 与生成基线未改。growth 的原有专项只追加新用例。因此没有旧断言变更、前提修订或基线重录/反事实登记。

开发期新增专项曾暴露：鼠标命令名/状态载体/悬停 API 使用错误；燃烧客观时间应与投掷伤害分开计数；身体来源的 CE 等距候选应检查合法前缘而非误指定 y；墙布景未遮住实际射线；公开光标/自动路径不应带 `zoneId`；焚化多次 DF 会重复刷新身体状态。前提问题只修新夹具，位置元数据和 DF 作用域问题修生产入口。补充 telepathy 用例曾调用不存在的 removeStatus，改用既有 setStatusDuration；新路径的 Pos/Creature 联合类型也经类型检查修正。失败不计入通过。

89 文件集合首次在最后补齐饮用焚化入口时主动终止（exit=130，`/private/tmp/p4a2b-related-before-incineration.log`）；它不作为完整通过证据。最终集合使用最终代码从头完整重跑，各轮重叠用例不累加。

## 已知边界与后续

本任务书范围内无剩余实现项。4a-3 身体渲染/组件/UI、4a-4 giants 内容/生产生成与场地，以及 3b actor-action 多格资格仍是独立后续任务。现有区域收集接口是可信引擎原语，不声称开放任意 mask/zone/复合体；测试使用独立 square fixture，没有自然多格怪物目录。没有承诺旧存档迁移或 CE 同种子逐骰一致。
