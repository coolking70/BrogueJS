# 3a0 共用 actor-action 底座报告

日期：2026-10-04 UTC。候选分支 `ext/phase3`。本步基于已合并 4a0 的 hosted `ext/foundation` **399df979f991434441182373c2fbc022645cab10**，保留全部 4a0 历史。

## 基线与范围

原指定内容工作树在本执行环境不存在。因此从真正的 `https://github.com/coolking70/BrogueJS.git` 独立克隆 `ext/phase3`（06bf327414ccb0c1907a4e4758f35c8591dba8d5），显式 fetch hosted foundation，核对 `phase4a0.report.md` 和 foundation=4 后快进本地工作分支。没有使用旧树的本地 origin，没有修改旧脏工作树，没有重做或覆盖 4a0。

本步交付 **foundation fixture 与可信引擎接缝**：纯 prepare / 同步 commit、可序列化 phase clock、核心调度、原生决策前置和有限 native-melee 防御权限。3a1 的正式 combat 包仍是 inert 安装；本步不声称已经可玩，也不把尚未接入完整生命周期的 fixture 写进生产存档。

## 已实现合同

### 动作与准备权限

- `ActorActionAuthority` 接受严格 schema=1 `phased-native` 意图。当前真实 Game 只开放 4a0 的原生单格 / 隐式单成员群：source、decision owner、time-charge owner 必须相同；生产复合体仍拒绝，不能仅取消空间 guard。
- prepare 只返回冻结 DTO，不扣资源、不分配 action ID、不耗 RNG、不写 timer。记录状态 revision、临时 sessionRevision、源对象 / grid / runtime 身份、机械源足迹和当前风险；提交前重新计算并逐项比较。getter、稀疏或装饰数组、未知字段、错误整数、耗尽计数器和变更后的计划拒绝。
- `ActorActionScope` 是仅可信引擎持有的同步令牌；函数结束撤销，thenable 拒绝。NPC 的新动作还必须持有 **原生 prelude 已完成** 的专用 decision scope，普通 npc-scheduler scope 不能越过该门。
- `Game.prepareActorAttackRisks` 复用原生目标风险谓词。suppliedAnswers 与 recorder decisions 分开；提交时经原 `requestConfirm` 消费一次。No 不扣费、不分 ID、不推进时间或 RNG；缺失、多余、错序答案拒绝。原受控 growth / native prepared request 合同保持。
- 一次成功提交只扣一次明确费用、递增一次 action ID/revision；有限 scheduler 安装写入失败恢复费用/ID，并使当前 authority 失效。不是任意世界攻击的回滚事务。

### 唯一阶段时钟和核心调度

- `ActorActionScheduler` 的机械真相是调用方持有的 schema=1 bundle / subaction phase remaining。自身只持会话绑定，snapshot/rebind 严格校验，不恢复资源、不补攻击、不取骰。
- 每核心最多 4 个不同成员子动作；按稳定 part/source 顺序分配 sourceSubactionId。bundle 完成时间取子动作完整耗时 **max**，下一边界取正 remaining **min**，elapsed 每次只累积一次。成员从不写原生 timer。3a1 的有界纯 bundle planner 继续负责多子动作费用求和；本步真实 Game action authority 只提交已开放的单成员费用，不声称生产多成员资源事务已开放。
- `TimeCoordinator` 的 soonest、递减、ready **三处** 都排除非核心成员。busy owner 的原生 ticksUntilTurn 仅由 scheduler 镜像写入，不再原生重复扣减或 movementSpeed 兜底覆盖。
- opt-in 路径先扣 elapsed，后环境/致死，再按 owner ID 解析同 tick phase / 自由决策；所有同 tick 解析结束后才开放玩家输入。未绑定能力的局继续原有怪物数组顺序。
- `Monster.prepareNativeDecision` 抽出尸体吸收、activation、显露、缠绕、状态/感知与睡醒消耗；`takeNativeDecision` 是原行为余部，`takeTurn` 保留包装。重组后与旧函数体逐字一致（仅 return true 归一为原 return）。真实 Game handled 路径证明只在新自由决策前运行一次，阶段边界不重跑；prelude 已消费、睡眠/麻痹/俘虏/activation 门不能被选择器绕过。
- 选择器在启动 busy bundle 后却返回 native-fallback 会直接失败，绝不再进原生 AI。新动作期间不执行每相位 deep-water sweep，terminal host 接受实际 elapsed；原生 fallback 保留原 sweep。
- 有限 timer commit 写入失败会移除新增 bundle、尝试恢复原镜像并永久关闭 scheduler。解析回调异常不吞错重试：host 必须停止失效录制/fixture。本步没有声称任意 HP/世界写集可回滚。

### 几何、来源和防御

- `Movement/AttackShape.ts` 使用 4a0 facade 返回的 **发起成员足迹 + 相对整数偏移**；整群足迹只参与 self-exclusion，不当攻击源。执行预算、去重、y/x 排序、边界和既有 LOS 过滤；没有新空间世界/碰撞库。
- `sourceFootprintVersion` 是现有机械字段的 SHA-256（entity/group/part/generation、footprint/pose、anchor 和带 zone 标签格集）。持久 bundle 保存该指纹和 depth；sessionRevision 不进机械数据。恢复由 host 在候选世界交叉验证机械源和 native timer，重新创建会话。
- D08 目标查询仍由 4a0 `collectBodyTargets` 的 part 默认与稳定接触顺序拥有；不改 bolt 反射的旧 scope。
- `ActorCombatResolutionAuthority` 只允许已验证、相邻、合法敌对的 native-melee。依序做资格/空间、dodge、parry，未防御才进入原 `CombatSystem.attack`。成功防御返回独立 defended fact，无普通 hit/damage RNG，无伪 physicalResolved；parry 窗口一次消费，到期边界先扣 elapsed。环境/投射物/任意伤害回调不在白名单。
- 需要玩家风险确认的延迟目标当前明确拒绝；不能凭一个 scope 偷用别的启动授权。parry 的后续攻击取消是有界 sourceInterruption 意图，未宣称已经接上正式 combat 的 pending-action 生命周期。
- `selectPartBreakConsequence` 是严格纯分支：无 balance loss、combat handled、native fallback 互斥；非法 provider DTO/异常不能当 unavailable 再叠 fallback。没有注册正式 `combat.part-break.v1` provider，也没有虚构尚未落地的 body-transition receipt 账本。

## 生产边界与版本

所有进入 fixture scheduler 的 Game、以及单独提交过 action / defense fixture 的 Game 都永久标记为 **不可导出生产 save/recording**，成功执行结束也不能解除。失败/未完成 session 同样阻止导出；这是防止 fixture 输入、外置状态或半事务被误当可重放产品存档。准备本身不污染普通 Game。普通未使用 fixture 的 save/load/replay 继续原路径。

| 项目 | 本步 |
|---|---|
| foundation / descriptor 要求 | 保持 **4**，不占用或覆盖 4a0 分配 |
| Entity / whole-run / recording | 保持 **3**，未开放新生产序列化字段 |
| manifest.schema | 保持 1 |
| combat / growth / narrative 版本 | 不变 |
| 新 foundation fixture DTO | action request/resources、scheduler state、defense state 各 schema=1 |
| Game own 字段 / U03 合同 | 无新增 own 字段；仅派生会话 WeakMap/WeakSet，未持有隐蔽机械 countdown |

共享修改只有 `Game.ts` 的风险/答案接缝、timePorts / NPC 选择桥和 fixture 导出 guard，`TimeCoordinator.ts` 的 opt-in 调度，`Monster.ts` 的小范围函数抽取，以及测试登记和本报告链接。没有整文件覆盖；`Combat.ts`、4a0 空间/codec 文件、正式 combat guard 与其它模块生产文件未修改。

## 实际验证

Node **24.19.0**，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。最终候选门禁：

| 检查 | 实际结果 |
|---|---|
| `node scripts/check-module-boundaries.mjs` | 通过，exit 0 |
| `npx vue-tsc -b` | 通过，exit 0 |
| `npm run build` | 通过，exit 0；保留已有大 chunk 警告 |
| 下列 25 文件功能相关集合 | **25 文件 / 694 项通过，10 项跳过，exit 0**；153.78 秒 |
| 原生 prelude 直接回归集合 | **5 文件 / 200 项通过，0 skipped，exit 0**；含新增 prelude 文件，不能与上行简单相加当独立总数 |
| combat 相关四子集真实 Game smoke | **4 项通过，exit 0**；同文件其余 19 项被明确 `-t` 过滤，不代表执行了全部子集 |
| `c_4a_terrain_catalog -t 白名单` | 1 项源守卫通过，29 项被名称过滤，exit 0 |
| `git diff --check` | 通过 |

25 文件的 10 skipped 逐项归因：`p2_1_tick_architecture` 4 项、`p2_2_real_speed` 2 项、`p2_3_objective_time` 2 项是原文件保留的历史退役基线；`x4_r3_creature_items` 2 项是缺少 CE 参照源码的条件 skip。没有新增 skip、修改旧断言、放宽超时或重录黄金。runner 通用 CE 缺失提示不是把其它通过项算成跳过的依据。本步按批准范围未 fetch CE。

最终功能集合（全部使用上述 NODE_OPTIONS）：

```sh
npx vitest run \
  src/test/phase3a0_actor_action.test.ts \
  src/test/phase3a0_scheduler.test.ts \
  src/test/phase3a0_defense.test.ts \
  src/test/phase3a0_native_prelude.test.ts \
  src/test/ext_prepared_controlled_commands.test.ts \
  src/test/ext_controlled_action_bridge.test.ts \
  src/test/ext_combat_neutral_differential.test.ts \
  src/test/phase4a0_spatial.test.ts \
  src/test/phase4a0_spatial_differential.test.ts \
  src/test/u_03_whole_run_snapshot.test.ts \
  src/test/u_27_recording.test.ts \
  src/test/p2_1_tick_architecture.test.ts \
  src/test/p2_2_real_speed.test.ts \
  src/test/p2_3_objective_time.test.ts \
  src/test/u_18_water_cage.test.ts \
  src/test/x4_r3_creature_items.test.ts \
  src/test/ext_module_boundaries.test.ts \
  src/test/test_suite_membership.test.ts \
  src/test/p1_30_i18n_gate.test.ts \
  src/test/u24_hardcoded_text.test.ts \
  src/test/repo_hygiene.test.ts \
  src/ext/modules/combat/tests/combat_schema.test.ts \
  src/ext/modules/combat/tests/combat_planner.test.ts \
  src/ext/modules/combat/tests/combat_runtime.test.ts \
  src/ext/modules/growth/tests/ext_growth_prepared_commands.test.ts --maxWorkers=2

npx vitest run src/test/phase3a0_native_prelude.test.ts \
  src/test/x2j_monster_ai.test.ts src/test/u_11_corpse_learning.test.ts \
  src/test/u_07_monster_blink.test.ts src/test/u_12b_ally_mode.test.ts --maxWorkers=2

npx vitest run src/test/ext_module_composition.test.ts \
  -t 'opens, plays, saves, loads, replays, seeks and continues combat' --maxWorkers=2

npx vitest run src/test/c_4a_terrain_catalog.test.ts -t '白名单' --maxWorkers=2
```

真实 Game 额外验证包括：实际 `executeCommand` / `timePorts` / `playerTurnEnded` 长动作桥、一次 NPC prelude 后 handled、阶段中零重复 AI、完成同 tick 的 native fallback、睡醒消耗、伪 fallback 失败关闭、No 的原始 decisions 消费、坏答案/陈旧计划/未授权 NPC scope、候选 timer 写失败、完成及失败 fixture 的持久化拒绝。4a0 的 52 观测点差分继续通过。

开发中曾在另一个新测试文件尚未写出时启动定向 runner，因已注册路径不存在而 startup exit 1；随后文件到位后重新运行成功。开发期发现的类型错误与独立审查发现的 fixture 导出、NPC prelude 许可、getter DTO、计数器边界和 busy fallback 问题已修复，均进入最终相关集合；不把初始失败当成通过，也不把早期小集合替代最终门禁。

原始日志保存在本执行环境 `/tmp/phase3a0-final-related.log`、`/tmp/phase3a0-native-prelude-regression.log`、`/tmp/phase3a0-composition-smoke.log` 和 `phase3a0-{boundary,typecheck,build}-final.log`。没有把大型原始转储或截图加入仓库。

## 明确未开放 / 未验证

- 无 3b 招式内容、自然 NPC 绑定、正式模块 scheduler 安装、玩家新命令/UI、预警、stamina regen、闪避移动、篝火或成长/叙事联动。
- 本步的 DTO roundtrip / rebind 是 fixture codec，不是生产 busy-action whole-run save/replay。真实 Game 检查现有产品命令、原 prepared decisions 和当前 inert combat 模块子集的 save/load/replay/seek/续录；没有把注入后的 fixture 录像冒充自然可重播开局。
- 生产复合群、source 被迫位移后的 break-recovery、部位破坏/转换的机械账本、parry 后队列取消、跨层 active-action 生命周期仍须在开放相应能力时连接和验证。scheduler 的 source-invalid 目前表示 fixture 来源退休，不能冒称完整位移打断规则。
- 完整 npm test、全部 test:ext、全安装子集/物理 removal 矩阵留 3f；本步不运行。无生成改动，不跑 drift/CE full/gen。不声称浏览器、移动端、真实触摸或 FPS 已验收。
- 未 push、未合并 hosted foundation/main、未打 tag、未部署。候选提交后停止，交由独立审查和维护者发布。
