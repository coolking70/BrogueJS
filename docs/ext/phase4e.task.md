# 4e 任务书：主动换形、分裂、复制与召唤

> 分支 `ext/phase4`（= ext/foundation `80640d1`：4a–4d 全部完成；dot 的 combat 3a0–3f 已合入）。设计：`docs/ext/phase4-giants.md` r3 §4.4（`BodyTransitionRequest` 原子事务、身份/状态/落点/事实表）、§5.4（再生 D13=A 不启用）、§11.3（与阶段 3 计划取消）、§12 **D07=A**（无 Boss 额外免疫；主动换形/换体型、单体↔群体、分裂、复制、召唤自身副本都走同一转换底座）、§14.2 表 4e 行。前序报告 `phase4a0`–`phase4d`。
> 维护者要求：**做到完整为止，不缩减范围**；每轮报告把剩余项拆成具体子项清单逐项标注“已完成/未完成”。

## 版本约束（重要）
dot 的 3g（`growth.combat-stats.v1` / `combat.event.v1`）将把**底座协议版本 4→5**。阶段 4 本步**不得升底座 foundation 版本**；giants 模块自身 module/rules 版本可按内容变化提升。dot 的 3g 也会改 `MonsterLifecycle`、`CreatureSpatial`、`SpatialRevision`、`Game` 的检查点，相关改动请做成独立函数/附加字段，便于合并。

## 范围

1. **主动转换声明**：giants 数据中有限、可验证的主动转换招式/阶段条件（例如 HP 阈值触发的阶段换形、一次性分裂、召唤自身副本），不接受脚本；声明经底座校验后才能生效。
2. **统一转换事务**（§4.4）：换形/换体型（含单体↔复合体）、分裂（一分为二或多体，HP 守恒分配、奖励权利不复制、原 encounter 绑定所有后裔，全部终结才算击败一次）、复制/召唤自身副本（全新 ID、深拷贝、无奖励权利、数量与活动层实体/占格预算约束防指数膨胀）；纯校验 → 必需随机抽样 → 虚拟 ID 与全结果落点/约束/区域预留 → 暂存 → 复核 revision → 一次提交；任一结果无位整次无效（主动招式按设计保留已付耗时/费用并记录无效果，不同 tick 无限重试）；异常完整回滚。
3. **身份与引用**：主体保留原核心 ID，按 partId 显式映射保留成员 ID，其余新建/无死亡退休（不发 kill/XP/DF/掉落）；抓持/leader/目标/携带/计划入边清理；3b/3d 已付款或蓄力中的计划按合同取消或重定位，不重放。
4. **与场地/守场**：转换结果受场地 movementBounds 约束；分裂/复制产物的场地归属与击败判定明确。
5. **正式内容**：为一个现有 giants Boss 加原创主动转换（建议沉渊巨像 HP 半血时“崩解为两个 2×2 碎岩像”，或页岩织兽召唤小型副本/断足再组，任选其一或两个），数值临时、数据驱动；自然遭遇可触发、可击败，给验收种子。
6. **UI**：Boss 血条/侧栏在换形、分裂后正确反映主体与后裔（同一 encounter 的多个后裔如何显示需明确），历史帧隔离、320/390 可读。

不做：再生（D13=A 保持拒绝）、残骸地形、镜像。

## 测试与门禁（开发期功能测试政策）
- boundary、`npx vue-tsc -b`、`npm run build`。
- 专项：shape/member 数量变化、ID 保留/映射/退休无 kill；多结果预留中任一无位全无效；ID/HP/群表/费用/RNG/消息故障回滚；split HP/奖励权利守恒与 encounter 一次击败；clone/summon 不共享状态、预算阻止膨胀；已有计划取消/重预警；主动失败正耗时；转换前后/等待时 save/load/逐条 replay/seek/续录；无阶段 3 的即时行为与有 combat 时的组合；篝火休息被转换/新敌情打断。
- 4a0 零影响差分、4a–4d 专项、giants、combat 相关、UR2/3/4、`npm run test:drift`（trace 变化先单变量归因再重录说明）、`check-module-composition-smoke.mjs --engine-only` 全部通过。
- 不跑完整 npm test / 全部 test:ext / removal（4f 统一）。Node 24.19.0（PATH 前置），`NODE_OPTIONS=--max-old-space-size=3072`，`--maxWorkers=2`。浏览器验收由维护者执行，不必启动浏览器。

## 交付
- 代码、测试、`docs/ext/phase4e.report.md`（逐子项清单与证据、共享文件函数级改动、数据位置、验收种子、实际测试与结果、已知限制）。可在干净子里程碑停下，但须列清剩余子项。**不要 commit**。
