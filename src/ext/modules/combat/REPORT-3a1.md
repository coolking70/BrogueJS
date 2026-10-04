# 3a1 — 独立 combat 包与纯计划候选

日期：2026-10-04 UTC。分支：`ext/phase3`。实施基线：`0a72802d9bdfee200360522fe639528b071fa6cf`；foundation 基线及本步前后只读远端核对均为 `70a5e1db1959107c5fceca6a91bf5b942ee053cd`。本候选等待独立验收，不代表已经发布/合并。

## 交付边界

- 所有变更在本目录。没有修改 Game、TimeCoordinator、Monster、CombatSystem、ext/types/runtime/world、共用文档或其它模块；没有 merge、改 main、升级 foundation/save/replay 格式或导入阶段4开发提交。
- 自动 descriptor/UI/test discovery 安装 `combat`，默认关闭。模块与机械规则版本 `1.0.0`；data/state/纯规划请求 schema `1`。没有注册玩家命令，故不宣称已提供命令输入协议。
- 严格、有预算、引用预检、规范指纹的独立数据包；三种原创**纯夹具**为扇锋、震环、续刺。它们没有生物绑定/自然生成/AI 选招。只有 `native-melee`/`part`/`locked-world` 等本步明确支持的数据枚举；未知形状、provider、效果、字段、版本直接拒绝。
- 自有 state、resource/action 结构及纯校验器。持久来源保存 entity/part/generation、footprintId/pose 与机械 `sourceFootprintVersion` 指纹；临时 `sessionRevision` 只在纯计划外层，不能写进动作组件。
- 纯 `planCombatBundle` 只预检/返回不可变计划：核心是唯一 decision/time-charge owner；最多4个不同成员；按 partId 稳定分配 sourceSubactionId；合计一次费用，完整束耗时取各子动作最大值，下一边界取最小值。无扣费、ID 分配、RNG、执行器或原生计时器写入。
- 几何只通过显式纯 adapter seam 传入：发起成员足迹与相对 shape 单独传递，整群足迹只作为 self-exclusion 输入。没有 adapter 明确返回 foundation-unavailable；非法返回/异常报错，不伪装缺席。模块没有第二套空间/碰撞/LOS/投射库。测试中的 adapter 是受控 test double，**不是4a0空间能力已实现的证明**。
- 只锁第一段的投影；后段锁定、来源版本与真实世界交叉核对、session 重绑定、动作执行/取消/调度、命中 receipt、伤害与防御事务留后续基础步骤。本步的 part-contact 纯去重保留底座输入顺序，并区分不同 part/generation；它不是全局命中账本。
- `combat:resources` / `combat:action` 校验器已登记，但当前 runtime 的整体校验拒绝任何持久 combat 组件或已推进的 combat state。这样手工注入即使结构合法的动作也不会在尚无3a0调度器时被加载为可运行状态。新局、出生、等待、load/unload不创建这些组件。
- 空公共投影及合法空 UI session，没有HUD/bar/panel/按键监听/创建步骤/按钮。没有可玩攻击、闪避、弹反、篝火、资源恢复、NPC prelude 抽取或共享动作基础设施。
- 不注册 `combat.part-break.v1`、actor-scope 或 stat/event provider；不会写 fallbackStun，后续 provider/fallback 互斥仍由基础事务负责。growth/narrative/giants不是硬依赖。

## 验证

环境 Node `v24.19.0`；类型/构建/测试均使用 `NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`。全部命令在仓库根执行。

最终门禁：

1. `node scripts/check-module-boundaries.mjs`：通过，exit 0；模块边界与测试归属正常
2. `npx vue-tsc -b`：通过，exit 0
3. `npm run build`：通过，exit 0；保留既有大 chunk 警告，无新增失败
4. 定向 Vitest 11文件233项：通过，exit 0，无 skip/todo
   - 自有 `combat_schema.test.ts` 93项、`combat_planner.test.ts` 51项、`combat_runtime.test.ts` 10项，共154项
   - 直接相关既有8文件79项：ext_module_boundaries、ext_module_ui、ext_module_creation_ui、ext_fingerprint、test_suite_membership、p1_30_i18n_gate、u24_hardcoded_text、repo_hygiene
5. `npx vitest run src/test/ext_module_composition.test.ts -t 'opens, plays, saves, loads, replays, seeks and continues combat' --maxWorkers=2`：相关 combat-only、combat+growth、combat+narrative、combat+growth+narrative 四行真实 Game smoke通过，exit 0；同文件其余19项被名称过滤而未运行（没有新增 skip）
6. `git diff --check` 与范围审计：通过；根 `scripts/test-suites.json` 无需修改，自有三测试由模块 test-suites.json 自动登记

真实Game覆盖原生命令等待、save/load、逐条replay、seek、续录，比较世界/checkpoint/双RNG；缺包、坏状态/manifest及注入组件在退休旧局前拒绝。空显示/空UI/生命周期不消费双RNG，未知combat命令不制造录像动作。所有这些都是 **headless engine smoke**，不是浏览器/手机验收，也不是新战斗玩法闭环。

完整 `npm test`、全部 `test:ext`、全部启用子集矩阵、物理删除/removal矩阵、CE fetch/full/gen、drift、浏览器/触屏均未执行。本步没有地图生成变更；完整测试和实际删除矩阵留3f。registry级缺包拒绝不冒充真实物理删除证明。

开发期间先修复了 `.at` 与当前TS lib不匹配、cells参数字面量推断、测试空数组的implicit-any类型错误，以及空UI声明不满足现有discovery合同的问题。早期测试在文件尚未落盘时因测试归属预检退出，未执行测试。最终结果不把这些失败计为通过。独立只读代码复核未发现阻断问题；其指出的空lockedCells数组直接helper校验缺口已加无条件JSON检查与恶意空数组回归。未放宽共享守卫、未改旧断言或加skip。

## 精确变更文件

全部位于 `src/ext/modules/combat/`：

- REPORT-3a1.md
- types.ts
- schema.ts
- definitions.ts
- data/definitions.json
- locales/zh_CN.json
- state.ts
- components.ts
- planner.ts
- module.ts
- index.ts
- descriptor.ts
- view.ts
- ui/descriptor.ts
- test-suites.json
- tests/combat_schema.test.ts
- tests/combat_planner.test.ts
- tests/combat_runtime.test.ts

## 后续停止点

本步提交供维护者独立审阅。没有继续3a0/3b或合并foundation。需先接收维护者完成的4a0基础合同，再另批3a0并统一版本；届时更新本模块精确规则版本及执行/候选世界校验，不能直接解除当前inactive load防线而让fixture成为可玩动作。
