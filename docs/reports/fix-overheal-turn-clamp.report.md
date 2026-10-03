# fix-overheal-turn-clamp 执行报告

日期：2026-10-03。工作区：`BrogueJS-newtheme`；分支：`fix/overheal-turn-clamp`；起点及当前 HEAD：`1ff39a842e65accd5d6f73b5ae091dca9c7d97a2`。没有 commit/push。

## 1. CE 核对与修改

先读 `AGENTS.md`、`docs/HANDOFF.md`、`docs/development.md`、`docs/architecture.md`、`docs/testing.md` 和任务书。CE 使用已有 `.ce-reference/BrogueCE-master/`，来源为 legacy `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`。`npm run ce:fetch` 仅复用校验，未拉取或修改参照；参照 Git 状态仍干净。

- `Combat.c:1847-1875`：转移先按 `min(damage, currentHP)` 限制，再计算玩家比例、盟友 40%、敌人 90%；只有玩家有最小 ±1。攻击者直接增加 HP，攻击瞬间不封顶。
- `Time.c:2717-2733`：怪物 tick 到期后立即封顶，先于激活、麻痹、入迷、俘虏的行动阻止条件。
- `Time.c:2857-2871`：玩家瞬时地形效果 → 游戏结束检查 → HP 封顶 → 坠落。

确认项目缺少两处封顶。生产改动仅在 `src/engine/Core/TimeCoordinator.ts`：

1. `advancementLoop` 的怪物到期分支开头补 `hp > maxHp` 截断，先于俘虏落物和所有行动门控；未轮到行动的怪物保留临时超额 HP。
2. `finishTurnEpilogue` 在已有环境结算、恢复/饥饿与死亡判定之后补玩家截断，并受 `!isGameOver` 保护。
3. 项目把客观块中置位的玩家坠落提前到推进循环处理，会绕过普通 epilogue。因此在该提前出口补同一玩家截断，同时将原游戏结束检查前移到坠落分支之前，保留“环境 → 结束检查 → 截断 → 坠落”的先后关系。只在即将坠落时截断，没有在每个客观块后普遍提前封顶。

保留 `Time.c:2480-2486` 对应的回合入口坠落出口：CE 在此直接坠落并返回，不经过末尾封顶。没有新增 Game 字段、RNG 调用、显示文案、存档或录像格式，也没有改转移计算、地图生成或既有守卫。

## 2. 转移实现与其它来源

`src/engine/Combat/Combat.ts:366-379` 的 `transferMonsterHealth` 与上述转移算术一致：玩家使用 `ringBonus` 和 `ringTransferencePercent = 5 * bonus`，向零截断后补最小 ±1；怪物使用 4/10 或 9/10，不套玩家的最小值。实际攻击在护盾吸收后、受害者 HP 扣除前调用它（同文件 `:304-313`；投掷为 `:468`）。无生命与无敌目标不转移，且没有攻击时 maxHp cap。

负转移通过忽略护盾的 `takeDamage` 扣玩家生命；真实命令回归确认 1 HP 玩家会死亡，保护护盾不能抵消反噬。**另发现既有差异**：CE `Combat.c:1872-1875` 在转移致死时即时 `gameOver("Drained by a cursed ring")` 并返回；项目目前由回合收尾判死，常见结果的死因是 unknown，受害者扣血也仍继续。本次任务仅修结算封顶，未扩展修复这条即时结束/死因路径，也不把它报告成完全 CE 对齐。

其它来源核对：

| 来源 | CE 执行路径 | 结论及项目对应 |
|---|---|---|
| 变形 | `Items.c:4595-4605` | 取比例生命与保持伤势的较大值，无上限截断；已有超额 HP 可延续到新形态。项目 `Combat/Polymorph.ts:polymorphHP`、`Monster.polymorph` 相同，本次怪物行动前封顶覆盖它。 |
| 玩家自然再生 | `Time.c:2524-2541` | 起始低于上限时，`currentHP++` / `+= regenPerTurn` 可在极高再生量下短暂越界，CE 末尾封顶负责收尾。项目 `Player.recoverPerTurn` 已在回血时封顶，本次不改其既有时机。 |
| 怪物自然再生 | `Monsters.c:1839-1848` | 低于上限才 +1，不独立产生超额。 |
| 普通治疗、治疗法杖、治疗护符 | `Items.c:4664-4666`、`:7522-7525` | `heal` 当场 `min(maxHP, …)`；项目 `Creature.heal` 同样封顶。 |
| 治疗地形 | `Time.c:645-657` | 仅缺血时生效且当场封顶；项目 `Map/TerrainHealing.ts` 同样限制治疗量。 |
| 赋能、复活 | `Monsters.c:547-556`、`:2925-2933` | 通过 `heal(100, true)` 封顶；项目 `Monster.empower` / `Game.resurrectAlly` 同样走 `heal`。 |
| 护盾 | `Items.c:5404-5410`、`:7527-7531` | 写独立 `STATUS_SHIELDED` / maxStatus，不增加 HP；本次不截断护盾。 |
| 负伤害治疗、复制/分裂 | `Combat.c:1882-1885`、`:288`；`Items.c:5378-5379` | 负伤害保留已有超额而不继续增加；复制/分裂将已有生命减半。这些可传播既有超额，但不是新的独立溢出来源。 |

## 3. 新增回归

新增 `src/test/overheal_turn_clamp.test.ts`，在 `scripts/test-suites.json` 登记到常规组。13 项回归覆盖：

- 正转移戒指的真实攻击命令：攻击返回时 30 → 31，同条命令结算后回到 30；同步与动画两条路径。
- 吸血蝙蝠真实行动：本次吸血后保留超额，下次行动入口先回到 maxHp，再吸血。
- tick 尚未到期不截断；麻痹、入迷、俘虏、激活型怪物即使不能行动也先截断；俘虏落物时已封顶。
- 负转移反噬致死且绕过保护护盾。
- 在隔离的玩家/怪物结算点比较完整 `rng.getState()`，两条流及计数不变。
- 蒸汽先消耗超额 HP，再封顶；客观块中失去悬浮后先封顶再坠落；游戏结束时不封顶且不处理坠落。

改生产代码前，最终布景的新测试原文结果为 **12 failed / 1 passed，exit 1**；修复后 **13 passed，exit 0**。前一轮布景中的俘虏方法名和悬浮观察时点已在生产修复前校正；最终失败记录为 `/private/tmp/brogue-overheal/red.log`。

## 4. 门禁与原始证据

局部规则档，不运行重型生成普查；其中源码守卫另行定向运行。以下命令均在仓库根执行，未放宽断言、种子、门限或容差。

| 原命令 | 结果 |
|---|---|
| `npm run ce:fetch` | exit 0；`CE reference already verified: legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9` |
| `npx vue-tsc -b` | 最终 exit 0，无输出。首次只因新增测试的两个类型错误 exit 2，已修正测试类型。 |
| `npm run build` | 两轮均 exit 0；最终 `✓ built in 2.59s`；保留既有大 chunk 提示。 |
| `npx vitest run src/test/overheal_turn_clamp.test.ts src/test/u_15b_rings.test.ts src/test/p4_5_melee_specials.test.ts src/test/c_5_fall_subsystem.test.ts src/test/x3_u8a_forced_turns.test.ts --maxWorkers=2` | exit 0；5 files / 73 tests passed。 |
| `npx vitest run src/test/overheal_turn_clamp.test.ts --maxWorkers=1` | exit 0；1 file / 13 tests passed。 |
| `npx vitest run src/test/c_4a_terrain_catalog.test.ts src/test/c_4a_0_layer_model.test.ts src/test/b_1a_identification.test.ts src/test/v_1a_blueprint_items.test.ts src/test/v_2b_4_altars.test.ts -t '留痕.*(promote/fire\|setTerrainLayer\|Grid.ts)\|静态守卫\|T1 墓碑\|D[1235] \|E4 直投守卫' --maxWorkers=1` | exit 0；5 files / 10 selected tests passed，118 tests 未被过滤器选中。 |
| `npx vitest run src/test/b_2_throwing.test.ts src/test/p2_3_objective_time.test.ts -t 'T2: 命中骰存在\|B2 饥饿伤害主观' --maxWorkers=1` | 只回退本次生产文件：exit 0，2 tests passed；恢复新代码、旧测试不动：exit 1，2 tests failed。两次均有 33 项未被过滤器选中。 |
| `npx vitest run src/test/overheal_turn_clamp.test.ts src/test/b_2_throwing.test.ts src/test/p2_3_objective_time.test.ts --maxWorkers=1` | 修夹具后 exit 0；3 files / 46 passed / 2 历史 skipped。 |
| `npx vitest run src/test/blueprint_center.test.ts -t '^蓝图宝藏落点.*c\)' --maxWorkers=1` | exit 0；1 file / 1 selected test passed，6 tests 未被过滤器选中；616.53s。其 population recorder 内包含读 `Game.ts` 的直投源码守卫，已经原扫描路径执行；没有缩减种子或层数。 |
| `npm run test:full`（首轮） | **exit 1**；`Test Files 2 failed / 243 passed (245)`；`Tests 2 failed / 4407 passed / 8 skipped / 5 todo (4422)`；733.42s。两处失败详见下节。 |
| `npm run test:full`（最终文件复跑） | **exit 0**；245 files / 4409 passed / 8 历史 skipped / 5 历史 todo；496.03s。全部常规组源码守卫、UR2/UR3/UR4、u_27/x2a/x3b 录像测试和 U03 契约均通过。 |
| `npm run test:drift` | exit 0；2 files / 2 tests passed；213.86s。 |
| `git diff --check` | exit 0。改动文件无 CRLF。 |

原始日志保存在 `/private/tmp/brogue-overheal/`，不进入仓库。临时 `progress.md` 也位于该目录。

首轮完整套件原文（exit 1，`full.log`）：

```text
Test Files  2 failed | 243 passed (245)
     Tests  2 failed | 4407 passed | 8 skipped | 5 todo (4422)
  Duration  733.42s (transform 15.70s, setup 0ms, import 275.64s, tests 6271.22s, environment 97ms)
```

生成漂移原文（exit 0，`drift.log`）：

```text
Test Files  2 passed (2)
     Tests  2 passed (2)
  Duration  213.86s (transform 3.27s, setup 0ms, import 7.34s, tests 338.42s, environment 2ms)
```

最终完整套件原文（exit 0，`full-final.log`）：

```text
Test Files  245 passed (245)
     Tests  4409 passed | 8 skipped | 5 todo (4422)
  Duration  496.03s (transform 9.36s, setup 0ms, import 216.88s, tests 4200.14s, environment 78ms)
```

补充浏览器尝试：运行 develop-web-game 原 Playwright 客户端；首次未打开新局表单便点击开始按钮，只有标题背景画布截图，**不计游戏验收**。后续真实命令浏览器探针启动 Chromium 被本机 sandbox 的 `bootstrap_check_in … Permission denied (1100)` 拒绝，没有取得本次规则的浏览器验收证据。规则验证使用上述真实引擎命令回归；本任务无 UI 生产修改。

## 5. 基线、旧守卫与收尾

两份生成基线和 UR2/UR3/UR4 黄金 trace 均通过，且文件逐字节与 HEAD 相同；没有重录，无需变化归因登记。

两处旧测试前提修订已经完成单变量反事实（只回退 `TimeCoordinator.ts`，未动测试、数据或夹具）：

| 旧用例 | 新代码下原失败 | 唯一前提修改 | 原断言保留 |
|---|---|---|---|
| `b_2_throwing` T2 强制 miss 零伤害 | rat HP 999 → 6（其原 maxHp），断言期望 999 | `rat.hp = 999` → `rat.hp = rat.maxHp = 999` | 强制 miss 必须不掉血，仍精确断言 999；命中 RNG spy 断言不动。 |
| `p2_3_objective_time` B2 加速下饥饿每动作 -1 | 玩家 HP 100 → 第一动作封顶到 30 → 第二动作 29，断言期望 98 | `player.hp = 100` → `player.hp = player.maxHp = 100` | 两动作仍精确断言 98；饥饿、加速和时钟布景不动。 |

仅两行前提修改；没有翻转断言、放宽容差、删除用例或新增 skip/todo。未修改任何黄金 trace 或生成夹具。首轮完整失败、反事实旧绿/新红、修前提后的绿各自保留，没有混用退出码。

最终完整复跑前后 562 个源码、测试、脚本和夹具文件 SHA-256 全部一致。首轮门禁期间仅修正了一处 CE 注释行号（2699-2701），没有执行代码变化；最终完整复跑已包含该修正。

开工已有未跟踪 `docs/tasks/chore-test-sfc-resolver.md` 与任务书，保持原样。

最终改动范围：`TimeCoordinator.ts`、新增回归文件、两处旧测试前提、测试归属清单和本报告。没有修改 CE 参照，没有 commit/push。
