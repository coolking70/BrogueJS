# 屠戮符文近战必中修复报告

- 工作区：`BrogueJS-newtheme`；分支：`fix/slaying-melee-autohit`；基点：`830ad74`。
- 任务书：`docs/tasks/fix-slaying-melee-autohit.md`。已读 AGENTS.md、HANDOFF、development、architecture、testing。
- 未 commit/push；任务书是用户原有的未跟踪文件，保留原文。

## CE 依据

参照 `.ce-reference/BrogueCE-master`，legacy 固定提交 `49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9`；`npm run ce:fetch` 只验证并复用已有参照，未修改该目录。

- `src/brogue/Combat.c:116–146`：先处理 stuck/captive，再处理 seized/seizing，再检查 `attacker == &player`、装备武器的 `ITEM_RUNIC`、`W_SLAYING` 和 `monsterIsInClass`；符合即返回 100，否则附魔命中公式并钳制 0–100。
- `Combat.c:149–158`：`attackHit` 对 stuck/paralyzed/captive 短路；其它情况仍调用 `rand_percent(hitProbability(...))`。
- `Combat.c:1190–1205,1239–1246`：`attack` 的偷袭/睡眠/麻痹/突进先于 `attackHit` 短路，命中后才掷伤害骰。
- `Math.c:62–64`：`rand_percent(100)` 仍取一次 `rand_range(0,99)`。
- `Monsters.c:4677–4688`：怪物详情需要显示命中率时调用 `hitProbability(&player, monst)`；未鉴定武器只暂时将 `enchant1` 归零，没有移除实际符文。
- `Items.c:6804–6811`：投掷命中期间临时装备投掷物，故屠戮判断应使用投掷物。

同时以 GitHub 只读接口核对[官方当前 Combat.c](https://github.com/tmewett/BrogueCE/blob/master/src/brogue/Combat.c#L105-L147)，文件 blob SHA `d897430b14499453ecb987e441ca5f1bbeb4829e`（2026-10-03 读取），上述执行顺序与规则一致。任务书无需裁决修订。

## 改动

- `src/engine/Combat/MonsterClass.ts`：增加纯谓词 `weaponSlaysMonster`，检查实际 `flags` 的 `ITEM_RUNIC`、`runicType === 'slaying'`、`vorpalEnemy` 对应种类。不读取 `identified/runicKnown`，不消耗 RNG。
- `src/engine/Combat/Combat.ts`：在原来的命中取骰位置，seized/seizing 之后、普通公式之前加入仅玩家装备武器的匹配判断，概率改为 100；不加入 autoHit 短路。既有命中/伤害/符文取骰调用保持原位。
- `src/engine/UI/DetailGenerator.ts`：详情预估共用上述谓词；`Game.ts` 的地点检视和循环检视两处调用传入当前装备武器。
- `src/test/slaying_melee_autohit.test.ts`：新增 17 项回归。
- `progress.md`：追加本轮工作记录，保留历史原文。

怪物携带武器和盟友攻击不读取玩家装备；背包里未装备的符文不生效。投掷实现、基础数值公式、Game 字段、状态契约、存档/录像格式、显示文本均未改。

## 回归证据

旧生产代码运行新增回归：6 失败 / 11 通过，日志 `/tmp/slaying-melee-autohit/red-corrected.log`。失败包括匹配普通近战、真实 RNG 对照、未鉴定符文、两条详情入口（35% 而非 100%）及真实命令结算。

修复后定向 5 文件 / 97 项通过，日志 `/tmp/slaying-melee-autohit/targeted.log`。新增回归覆盖：

1. 枚举全部 0–99 命中骰，匹配时全部命中，并逐次核对 `randPercent` 参数和 `randRange` 顺序为命中 `[0,99]` → 伤害 `[1,2]` → 符文 `[0,99]`。
2. 用独立 `Random(901)` 按成功攻击原路径推进，与实战的双流、完整 RNG 状态及实质计数 3 精确比较。
3. 种类不匹配、非屠戮、缺 `ITEM_RUNIC`、未装备保持普通命中率；未鉴定屠戮照常必中。
4. 怪物携带屠戮武器且玩家仍装备匹配武器，敌方/盟友两例仍走普通命中。
5. stuck/paralyzed/captive 保留短路；seized/seizing 保留一次命中骰。
6. 投掷自身种类不匹配时仍会 miss、匹配时仍取一次命中骰，与玩家当前装备分开判定；旧 X2f 投掷数学守卫也通过。
7. 两条实际详情入口均显示 100%，未鉴定同样成立；反例显示普通概率，前后完整 RNG 状态不变。
8. `executeCommand('move')` 对 HUNTING 目标产生命中并由 Game 应用屠戮致死效果。

没有修改任何既有测试、断言、超时、skip 或夹具。新增测试编写时曾误用不存在的检视方法，改为真实命令入口后重新在旧生产上完成上述 6 红 / 11 绿验证；初次类型检查另暴露测试夹具的 StatusId/不存在 Cell 字段，均仅修正新增测试，再通过类型检查。

## 门禁

按用户续轮指令，本轮只执行类型检查、构建、新增与战斗/命中/详情/符文相关的定向测试，以及 UR2/UR3/UR4 黄金 trace；**完整 CE 门禁由 Claude 在本地另行执行**。本轮未启动完整 `npm test`、`test:full` 或 `test:drift`。

上一轮 `test:full` 因宿主后台任务时限中断，原 exec session 3965 已不可恢复；日志只有启动头，没有退出码或统计，不能计作通过，原 runner 未进入 drift。旧原始记录保留在 `/tmp/slaying-melee-autohit/gates/`，中断说明见 `interruption.json`。

| 门禁 | 退出码 | 耗时 |
|---|---:|---:|
| `npx vue-tsc -b` | 0 | 5.23s |
| `npm run build` | 0 | 7.15s |
| 新增与相关测试：26 文件 / 447 项 | 0 | 156.87s |
| UR2/UR3/UR4：3 文件 / 3 项 | 0 | 72.40s |

所有定向 Vitest 命令使用 `--maxWorkers=1`，显式设置 `BROGUE_REQUIRE_CE=1`，没有 CAPTURE 变量；CE 对照不因缺源码而静默跳过。完整命令见 `targeted-final/state.json`；日志均在 `/tmp/slaying-melee-autohit/targeted-final/`。

定向范围（除特别注明外，均在 `src/test/`）：

- 新增与命中：`slaying_melee_autohit`、`u_13_combat_math`、`x2c_hit_status_owner`。
- 武器/符文：`u_15d_weapon_runic`、`u_15d2_armor_runic`、`u_15d3_runic_generation`、`armor_runic_effect`、`b_1_weapon_specials`。
- 投掷：`x2f_thrown_math`、`b_2_throwing`。
- 详情/预估：`armor_display_effect`、`x3b_item_details`、`x4_r4_item_details`、`ui_2_protection`、`src/engine/UI/DetailGenerator.test.ts`。
- 实际战斗路径：`x3_u8c_combat_items`、`u_14b_status_gaps`、`monster_damage_balance`、`p4_6_attack_geometry`、`p4_7_player_weapon_geometry`、`p4_4_split_kamikaze`、`p4_5_melee_specials`。
- 状态/源码/文本守卫：`u_03_whole_run_snapshot`、`p1_30_i18n_gate`、`u24_hardcoded_text`、`repo_hygiene`。

以上文件名省略 `.test.ts` 后缀；三份 trace 命令为：

```bash
BROGUE_REQUIRE_CE=1 npx vitest run src/test/u_r2_trace.test.ts src/test/u_r3_trace.test.ts src/test/u_r4_trace.test.ts --maxWorkers=1
```

日志原文摘录：类型检查 stdout 为空（退出码 0）。构建：

```text
> brogue-web@0.2.0 build
> vue-tsc -b && vite build
vite v7.3.1 building client environment for production...
✓ 953 modules transformed.
✓ built in 2.09s
```

相关定向：

```text
 Test Files  26 passed (26)
      Tests  447 passed (447)
   Start at  06:07:33
   Duration  156.49s (transform 738ms, setup 0ms, import 10.56s, tests 143.42s, environment 5ms)
```

黄金 trace：

```text
 Test Files  3 passed (3)
      Tests  3 passed (3)
   Start at  06:10:10
   Duration  71.93s (transform 589ms, setup 0ms, import 1.69s, tests 69.92s, environment 1ms)
```

冻结前后 `src/scripts/public` 及包配置清单相同，变化路径为空，清单 SHA256：

```text
0c1b349f8d5bb8a5b214e1a3872cd33e83aff54939e697de675de97e18859dbc
```

## 基线、trace 与环境补充

三份黄金 trace 对原夹具的逐字段断言全部通过，本修复没有产生 trace 差异。两份生成基线及三份 trace 均未重录，文件字节与本分支 HEAD（`830ad74`）及冻结前清单一致；无基线/trace 变更需要归因。**生成 drift 未运行，其结果由 Claude 本地补验**，不能由文件哈希相同推断生成运行结果通过。

| 文件 | 前后相同的 SHA256 |
|---|---|
| `generation_baseline.json` | `329e38c22ebde8b2860b7512ef162765b23f1a09228b366debad068322526087` |
| `deep_generation_baseline.json` | `14e8684e968b258cc9d32beff050600c886403e641a1e920714131ae90da6c46` |
| `u-r2-trace.json` | `2e438d68b2e1e032e3a73c95c9a3791fbfd9ba77a82a0c951d98411cad90fc68` |
| `u-r3-trace.json.gz` | `5e99edd8af3fe5d9056a9b8c6552c05da62b2f65a7cdffaa7c862da7915989c0` |
| `u-r4-trace.json.gz` | `0f524dac5f5f0c7376ee61f160a5ab6bf51dc4841b65ae9d2c6e4524bc9b4d6b` |


按 develop-web-game 技能尝试 Vite 和原标准 Playwright 客户端（客户端原文复制到临时目录，仅为复用工作区依赖），但沙箱拒绝 `127.0.0.1:5401` 监听（EPERM）和 Chromium MachPort 注册（Permission denied）。未绕过限制，未得到浏览器截图；没有声称浏览器视觉验收通过。日志：`/tmp/slaying-melee-autohit/vite.log`、`browser-standard.log`。任务书规定的引擎/详情自动化入口已覆盖。

所有原始日志和运行清单均在 `/tmp/slaying-melee-autohit/`，不纳入仓库。
