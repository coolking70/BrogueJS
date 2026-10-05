# 4c 任务书：固定命中区与部位破坏

> 分支 `ext/phase4`（= ext/foundation `2eb3181`：4a 全部、4b 任意 mask/四向旋转/棘脊爬兽，以及 dot 的 combat 3a1/3a0/3b 预警多段攻击）。设计：`docs/ext/phase4-giants.md` r3 §5.4（部位破坏/传伤/再生）、§6.1（效果类别决定目标粒度，**D08** 已决定：物理/范围伤害按 part，整体精神/身份按 group）、§3.1 schema（zone）、§11.3（与阶段 3 的 `combat.part-break.v1` 软接口）、§12 **D09=A**（固定 local zone 1:1 传核心；外围成员 1:4 属 4d）、**D10=A**（zone 默认 keep-zone，不移身体格）、**D13=A**（再生只预留不启用）、**D15=A** 留给 4d；§14.2 表 4c 行。前序报告 `phase4a0`–`phase4b`、阶段 3 报告 `phase3b.report.md`（了解 actor-action 防御/命中出口）。

## 范围（单刚体的固定 local zone；不含独立移动成员）

1. 开放 zone 能力门：单个独立刚体（方形或任意 mask）上声明的固定 local zone（标签格子集），每个 zone 有独立 HP、护甲/弱点倍率、破坏表；未声明 zone 的生物行为完全不变。
2. 命中路由：一次局部命中定位到“实体+zone”（part 键），只解算一次命中/防护/伤害；zone 的局部 HP 扣减后按 **1:1** 传给所属实体原生 HP（D09=A；传导基数 = min(防护后伤量, 本次命中前 zone 正 HP)，不传溢出、不重投骰、不重复触发符文/吸血/反伤/growth 逐击效果/阶段 3 poise 消费）。直接打到无 zone 身体格仍只扣原生 HP 一次。
3. D08 去重：同一子段/范围效果对同一 zone 多格只一次；横扫/火球覆盖两个不同 zone 各一次（这是有意设计）；整体精神效果按 group 一次。
4. 部位破坏：zone HP 到 0 发布唯一破坏收据（groupId/partId/zoneId/generation），只一次；**不发 kill、不给 XP、不触发死亡 DF/掉落**。破坏修正从破坏集派生且幂等（读档/重入不重复）：可声明“失去某攻击”“暴露另一 zone 为弱点（倍率变化）”“速度倍率”等有限效果；首批正式内容至少用到一种。keep-zone：身体格不变。
5. 与阶段 3 联动：通过可选软接口 `combat.part-break.v1`（底座定义、combat 提供 provider）把破坏事实交给 combat 处理韧性/硬直；combat 未启用或不支持时底座使用声明的 fallbackStun（短 actionLock），两者互斥、不叠加；provider 异常视为同一事务失败。本步只实现底座侧协议与 fallback，并用 fixture provider 测互斥；**不改 combat 模块代码**（dot 之后接 provider）。已准备/蓄力中的、以被破坏 zone 为来源或目标的计划按 3b 合同取消。
6. 再生：schema 预留 `regenerateInTicks/generation/maxCycles`，D13=A 不启用——数据与读档里出现再生声明一律拒绝。
7. 公开显示：玩家可瞄准/检视具体 zone；Boss 血条或检视面板显示当前选中/最近公开 zone 的 HP 与“已破坏”状态；历史帧不泄露新弱点/新 HP；破坏后清理选中；手机 320/390 不遮地图。只显示公开知识。
8. 正式内容：给一个现有 giants 敌人（建议沉渊巨像或岩脊兽）加原创 zone 方案（例如“背甲”破坏后暴露“核心”弱点、或“前肢”破坏后失去一种攻击/减速），数值临时、数据驱动；无 growth、无 combat 也能完整击败。

不做：独立移动成员/复合体（4d）、主动转换（4e）、再生启用、zone 改变身体形状（replacementFootprint）、残骸地形。

## 测试与门禁（开发期功能测试政策）

- boundary、`npx vue-tsc -b`、`npm run build`。
- 专项：zone 多格多次接触一次；横扫/火球两 zone 各一次；直接打核心不自传；传导不重投/不重复符文/反伤/growth/阶段 3 消费；zone HP=0 只破坏一次、不 kill/XP/DF/掉落；破坏修正幂等（读档/seek/续录不累乘）；弱点暴露；fallbackStun 与 fixture provider 互斥、provider 异常回滚；已准备计划在 zone 被毁时取消（含 3b 原生计划）；再生声明拒绝；zone 状态 save/load/replay/seek/续录与坏 HP/标签拒绝；公开显示与历史帧隔离；正式内容自然生成并可击败（给验收种子）。
- 4a0 零影响差分、4a/4b 专项、giants、combat（3b）相关测试、UR2/3/4 保持通过；`npm run test:drift`（giants trace 若因内容变化需重录，先单变量归因再按原入口重录并说明）；`check-module-composition-smoke.mjs --engine-only` 全部通过。
- 不跑完整 npm test / 全部 test:ext / removal。Node 24.19.0（PATH 前置），`NODE_OPTIONS=--max-old-space-size=3072`，`--maxWorkers=2`。

## 交付

- 代码、测试、`docs/ext/phase4c.report.md`（范围、共享文件函数级改动、`combat.part-break.v1` 协议最终签名（供 dot 接 provider）、数据位置与可调字段、验收种子、实际测试与结果、已知限制）。可在干净子里程碑停下并列剩余项。**不要 commit**。
