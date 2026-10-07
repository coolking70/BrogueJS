# foundation 调度器同 tick due 窗口修复

日期：2026-10-07。分支 `ext/fix-scheduler-due`，基于 `ext/foundation` / `5180f6c`；未 commit。

## 缺陷与归因

按 `/private/tmp/p5rev/repro.mjs`，使用 seed **7397**、`wizard`、`extended`，启用 `growth/narrative/combat/giants`，通过 registry 获取并执行各模块 `initialCommand`。原始 27 条命令为：

```text
wait × 11
move(-1, 0) × 5
wait × 2
move(0, -1) × 4
move(1, 0), move(-1, 0), move(1, 0), move(0, -1), move(0, -1)
```

未修改的生产树在第 **27** 条命令抛出 `Actor action scheduler: inconsistent phase clock`，原探针退出 **3**。堆栈经过 `commitBundle → PhasedAttackProduction.commit → selectNativeActorAction`。

`advanceActionTime` 同时递减前台全部 bundle；`TimeCoordinator.advancementLoop` 随后按 owner ID 派发。在这个窗口内，较小 ID 的空闲 owner 可以先提交新动作，较大 ID 的现存子动作已经到期为零，但尚未轮到派发。`commitBundle` 原来以空 due 集合校验整个 candidate，错误地把后者当成坏 codec。生产提交的 catch 随之使当前 action session/run 失效。

先加入回归、保持原生产实现运行：**3 文件，5 failed / 50 passed，exit 1**。三个不同 phase 的提交用例、循环内提交用例和自然种子用例分别在此校验处失败，自然种子仍精确失败于第 27 条。

## 实现与同类调用审计

- `ActorActionScheduler.commitBundle`：新提交的 bundle 先独立严格校验；整体 candidate 的 due 集合仅取**现存、前台、未结束、未取消、`phaseRemainingTicks === 0`** 的子动作，身份为 `actionId:sourceSubactionId:phaseIndex`。只承认这些精确身份；elapsed 等一致性条件仍由原 validator 校验。
- 修改 `boundaryOf` 注释：零可以存在于时钟推进后、各 owner 同 tick 派发前，而不只是在单个 resolver 内。
- `validateActorActionSchedulerState`、snapshot、rebind、production candidate-world validator、存读档 codec 均保持原来的严格默认行为。没有 schema、版本、Game 字段、RNG、费用或派发次序变更。
- 核对 `/private/tmp/p5fix` 后没有复制其阶段 5 重构。该副本 `PhasedAttackProduction.ts:404` 的显式 `new Set()` 对应本基线约 387 行的默认空集合；它在本基线仅用于**创建新会话**，随后创建 production scheduler 也严格验证绑定。已有 state 和 scheduler 身份一致时，前一行直接复用现存会话，不会严格重验 due 图。保留这一同 tick 语义，补充注释与专门回归；未把新绑定改成接受瞬态零，也未放宽任何 codec。
- `validateProductionActorAttackTransactionState` 已承认既有 due 身份，本轮未修改它。

唯一生产行为变更是 scheduler candidate 校验的 due 参数；`PhasedAttackProduction` 仅补充上述审计注释。没有修改旧守卫、旧断言、超时、生成基线或黄金 trace。

## 回归覆盖

| 层次 | 验证 |
|---|---|
| 单元 | A 的 windup / inter-segment / recovery 为零时提交另一 owner 的 B，不改 A 的值或镜像，随后 A 恰好派发一次，`onFault` 未调用 |
| 循环 | 原生 ID 顺序 sweep 中 owner 2 提交时 owner 3 的 inter-segment 已到期；随后派发 owner 3；不插入 native sweep、不重复消费时钟 |
| 反例 | 非前台零、仍活跃却已取消的零、elapsed 不一致的零均在写入前拒绝；新提交的零也不能借用另一 owner 的 due 身份 |
| 严格边界 | due 状态的 snapshot / rebind / production 新绑定与 save 继续拒绝；派发之后恢复正常保存；PhasedAttackProduction 活跃会话复用不写状态、不消耗 RNG |
| 自然端到端 | 原 27 条后再执行 **100 条有效命令**，未编辑地图、实体、HP、资源或时钟；每条均检查回合前进、录像事件数增加、未终局、run 未失效 |
| 存读档与续录 | 第 26、27、77、127 条后保存并载入，同一测试随后继续执行与导出完整录像；比较完整世界投影 |
| 逐条录像 | 每条 `replayStep(true)` 检查 cursor、无 OOS、tick / turn / depth / player / 扩展状态 / 双 RNG 状态；最终比较完整世界 |
| seek | 从终点逆序 seek 到 127、77、27、26 和 initial batch 结束，再回到终点；逐点比较完整世界 |

完整世界比较只归一化 `savedAt`、录像专有的输入缓冲与索引，其余 snapshot 字段均比较。自然端到端测试归 combat 模块所有，已登记 `src/ext/modules/combat/test-suites.json`，可选模块通过 catalog 发现，不 import 其他模块实现。

开发期第一版续跑使用原地 `wait × 100`，在第 32 条后进入玩家输入锁，第 33 条被忽略；断言如实失败（**1 failed / 54 passed**），没有把忽略命令计作续跑。本轮未扩展为该输入锁问题的修复；正式回归沿用原探针的只读 BFS 自然寻敌路线，并以每条回合/事件断言保证确实执行了全部 127 条。最终专项回归 **3 文件 / 55 项通过，exit 0，10.00 秒**。

## 门禁与证据

运行环境：Node **24.19.0**，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；`NODE_OPTIONS=--max-old-space-size=3072`；Vitest 一律 `--maxWorkers=2`。类型、构建和重型测试按次序执行。

| 门禁 | 结果 |
|---|---|
| `npm run check:modules` | 通过，exit 0；模块边界与测试归属校验 |
| `npx vue-tsc -b` | 通过，exit 0 |
| `npm run build` | 通过，exit 0；保留已有大 chunk 警告 |
| 调度 / 战斗 / 巨兽 / 录像 / 源码守卫相关集合 | **109 文件 / 2052 项通过，8 项既有跳过，exit 0；783.45 秒** |
| terrain catalog 生产读者守卫 | **1 文件 / 1 项通过，exit 0；1.21 秒**；另 29 项由 `-t` 明确过滤，未宣称运行完整 catalog 文件 |
| 全组合 smoke `--engine-only` | **16 / 16 组合通过，engine=passed、requestedScopePassed=true，exit 0**；覆盖精确 checkpoint、save/load、逐条回放、seek、续录和缺失模块拒绝；按参数未运行浏览器 |

相关集合命令（包含 combat **34** 文件、giants **17** 文件的全部测试；giants 两份 drift trace 也直接运行）：

```bash
npx vitest run \
  src/test/phase3*.test.ts src/test/phase4*.test.ts \
  src/ext/modules/combat/tests src/ext/modules/giants/tests \
  src/test/ext_actor_attack_validation.test.ts src/test/ext_actor_resources.test.ts \
  src/test/ext_combat*.test.ts src/test/ext_controlled_action_bridge.test.ts \
  src/test/ext_part_break_protocol.test.ts src/test/ext_module_boundaries.test.ts \
  src/test/ext_module_composition.test.ts src/test/ext_slaying_alignment.test.ts \
  src/test/p2_1_tick_architecture.test.ts src/test/p2_2_real_speed.test.ts \
  src/test/p2_3_objective_time.test.ts src/test/u_03_whole_run_snapshot.test.ts \
  src/test/u_27_recording.test.ts src/test/x2a_recording_checkpoint.test.ts \
  src/test/x3b_display_recording.test.ts src/test/ux_1d_recording_continuation.test.ts \
  src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts \
  src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts \
  --maxWorkers=2
```

按本次任务书不跑完整 npm test、CE full/gen、全局生成 drift、删除矩阵或浏览器验收。没有生成/存档录像格式变化，不重录任何基线。

组合 smoke 原命令为 `node scripts/check-module-composition-smoke.mjs --engine-only --output /private/tmp/fix-scheduler-due-composition-smoke.json`。启动时 Vite 尝试监听 HMR WebSocket，控制台记录 `listen EPERM 0.0.0.0:24678`；这是沙箱端口限制，未阻止 16 个引擎组合完成或改变原脚本退出码。未修改脚本、未隐藏该日志；JSON 的 `requestedScopePassed` 为 true，浏览器 `not-run`，全范围的 `passed` 为 false，不能把本结果冒充浏览器验收。

最终门禁开始前冻结 `src/scripts/public` 与构建输入共 **960** 文件，逐文件清单在 `/private/tmp/fix-scheduler-due-inputs-before.json`，汇总 SHA-256 为 `8b9686d6e8a362ba37fda976ac1fb6030b489ce411563f66de8e03021bf4af9c`；门禁后 `/private/tmp/fix-scheduler-due-inputs-after.json` 复核得到相同散列，**0 新增、0 删除、0 改写**。此后只补写本报告；`git diff --check` 通过，HEAD 仍为 `5180f6c`，没有 commit。

原始证据均留 `/private/tmp/`，没有加入截图或大型原始文件：

- `fix-scheduler-due-before.log`、`fix-scheduler-due-regression-before.log`：原引擎复现与失败回归。
- `fix-scheduler-due-regression-after.log`、`fix-scheduler-due-probe.log`：第一版原地续跑的输入锁失败，不作为通过证据。
- `fix-scheduler-due-route.log`、`fix-scheduler-due-route127.json`：独立原探针路线实际执行 127 条，终态 turn 127。
- `fix-scheduler-due-regression-final.log`：最终新增专项 55 项通过。
- `fix-scheduler-due-environment.log`、`fix-scheduler-due-boundary-final.log`、`fix-scheduler-due-typecheck-final.log`、`fix-scheduler-due-build-final.log`。
- `fix-scheduler-due-related-final.log`：完整相关集合，不以定向复核代替原退出码。
- `fix-scheduler-due-terrain-guard-final.log`：`npx vitest run src/test/c_4a_terrain_catalog.test.ts -t '生产读者' --maxWorkers=2`。
- `fix-scheduler-due-composition-smoke.log`、`fix-scheduler-due-composition-smoke.json`：16 组合原命令结果及非阻断的 Vite 端口日志。
