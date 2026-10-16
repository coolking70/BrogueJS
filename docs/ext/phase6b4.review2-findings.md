# 6B4 独立复审 R2（最后一轮）

结论：**需修**。R1-F1、R1-F2、R1-F3 的修复均已核对；当前剩余合入阻断是 B4-5 / D6 性能验收尚未完成，不能给出“可合入”。该阻断属于缺失有效验收证据，不是已经证明存在代码性能回退。

审查对象：`ext/phase6`，HEAD `8d7c79974fee69d7ffdd45b286b9b6878f081be7` 的未提交实现及修复。已读 AGENTS.md、HANDOFF、development、architecture、6B4 task、R1 findings、report 的修复处理与 B4-5 节。按 D1–D7 全 A；数值平衡延期、浏览器由维护者执行均不列为缺陷。不修改仓库文件、不 commit，不要求第 3 轮独立审查。

## 唯一剩余阻断：B4-5 缺少无休眠窗口的 D6 完整证据

位置：`docs/ext/phase6b4.report.md:243–251`；`scripts/check-ext-perf.mjs:11`。

- R1 重测 classic 的实际窗口为 2026-10-16 12:55:24.321–12:56:23.507 +08:00。已直接读取 audit JSON 及 power.log：12:55:31 / 12:56:19 出现 Sleep，12:55:34 / 12:56:22 出现 DarkWake，窗口开始前也是 DarkWake。此轮计时无效；all 被中断 exit 130，整轮不完整。
- 当前修复版本无有效原版配对、无三轮干净候选校准、无冻结预算、无冻结后完整门禁。当前源码 hash 与作者 R1 正式计时前身份相符；首轮实施的三次自回放不能冒充当前修复版本的 D6 通过证据。
- 原观测器、common、比较器、预算工具、旧预算和两条旧路线与 HEAD 字节相同，没有通过降级旧门禁掩盖缺口。
- 本轮实跑 `node scripts/check-ext-perf.mjs /private/tmp/p6b4rev2-perf-input /private/tmp/p6b4rev2-perf-output --phase6b4`：exit 1，缺少 `scripts/ext-perf-6b4-budget.json`。这是预期失败关闭，未执行性能回放，不算 P0 通过。日志：`/private/tmp/p6b4rev2.perf-unfrozen.log`。

收口条件保持原 D6：在连续唤醒且供电/运行环境可比的窗口，取得完整原版配对与三次候选；报告全程及 D20 命令/客观块 P50/P95/max、墙钟、计数与内存，并补可比前 1714 事件负载归因。P95 +10%、max +25%（至少 1ms 噪声带）、墙钟 +10%，三次中至少两次越线须定位处置并复验。之后按原 freeze 方法冻结新预算，再完整执行新 P0，保持零 OOS、逐域/终态/双流/调度相等、计数稳定及上限硬检查。不能删除慢样本、扣除休眠时间或用自校准豁免回退。

作者对“P0 待验 / 未收口”的报告是准确的；不能把这个准确披露理解为已经具备合入证据。本轮未另跑长基准，也未改变电源设置。

## R1 三项定向复核

| 项目 | 判定 | 核对要点 |
| --- | --- | --- |
| R1-F1 分摊漏揭示 | 已修复 | `Game.ts:9444–9454` 保留玩家减伤判定，另在每次邻敌 takeDamage 后比较实际 HP。输入 1、玩家余伤仍 1、邻敌 100→99 也会揭示对应行。覆盖存读档和知识提交失败的完整图/双 RNG 回滚。 |
| R1-F2 呼吸提前揭示 | 已修复 | `Game.ts:12824–12847`、`:13025–13030`、`:13091`、`:13121` 将揭示移至渐进伤害或实际会增加混乱/麻痹/恶心时长的阻断点；其他状态免疫、已有足够长时长不冒领。瞬时毒气接触不揭示，渐进伤害被阻止才揭示，原生 runicKnown 同步门控。 |
| R1-F3 地面详情错误 | 已修复 | `ItemDetailContext.ts:72–76` 对背包/地面统一调用 `hypotheticalEquipment`；`NativeStatSources.ts:108–111,135–136` 仅在同步查询期间保存原 Item 绑定，当前/强化提案同走属性管线，并用 finally 恢复。已知 T1 吸收保持 8 quarter / 2 当量；未知行过滤，地面物品不获得背包操作资格。 |

## 本轮实测与审查边界

在本轮定向范围内，**未发现修复引入新的阻断或重要问题**。三项原问题关闭；此判断不扩张为全部 6B4 或浏览器验收通过。

相关测试逐文件独立进程、串行执行，Node24 / 3072MiB，Vitest `--pool=threads --maxWorkers=1 --no-isolate --no-cache`；原用例超时、断言和夹具未修改。**7 文件、193 项全部通过，每条命令 exit 0**，没有中止或失败后拼接通过：

| 文件 | 通过数 |
| --- | ---: |
| loot_b4_runtime.test.ts | 78 |
| g_3_gas_effects.test.ts | 27 |
| u_15d2_armor_runic.test.ts | 7 |
| x3b_item_details.test.ts | 13 |
| x4_r4_item_details.test.ts | 23 |
| ext_stats_pipeline.test.ts | 40 |
| loot_b4_growth.test.ts | 5 |

boundary exit 0；测试依赖检查 exit 0、errors=[]；性能 selector 两身份/8拒绝用例 exit 0；`git diff --check` 通过。完整 argv、退出码、耗时和日志位置见 `/private/tmp/p6b4rev2.tests.json`。

独立仓外探针 `/private/tmp/p6b4rev2.probe.mjs`：复用 R1 原布景，只将原缺陷断言改为正确行为，并补充三个状态的其他免疫来源、三种呼吸知识提交失败及详情查询异常清理。实跑 exit 0，结果 `/private/tmp/p6b4rev2.probe.json`，日志 `/private/tmp/p6b4rev2.probe.log`：

- 分摊：incoming=1、remaining=1、邻敌100→99、rowKnown/runicKnown=true。
- 呼吸：瞬时毒气有甲/无甲均 HP45、空状态、disturbed=false；有甲仍不揭示。已有9999混乱时长不揭示；confused/paralyzed/nauseous 其他免疫均不冒领。
- 地面：背包/地面完整符文详情相同，均吸收1–2、下一次上限2，并保留“强化不会增加符文强度”说明。
- 对毒气渐进伤害、混乱瞬时接触、恶心瞬时接触，注入知识提交异常后完整 Game 对象图与双 RNG 恢复，符文知识保持未知。
- 详情字段校验失败及属性管线中途抛错后，地面物品均仍无法通过普通 hypothetical 背包装备准入；后续合法详情查询正常，证明临时绑定没有泄漏。

探针的 Vite 启动日志出现环境 WebSocket 监听 EPERM，但 SSR 装载和所有断言实际完成，进程 exit 0；未把监听报错隐藏或当作浏览器通过。探针使用受控布景，不冒充自然路线。

源码1456文件 SHA256：`650ea6258f5e5b208ab38cd99195532dc1c0ffd83bed070b54b86cac71c53479`；dist61文件 SHA256：`fb26405cb63c2bfc983dab010318e2d26f415543f74979e4e9b8401e63ccae07`，与作者 R1 记录一致。口径为排序相对路径+NUL+文件字节+NUL。对所有 Git 已跟踪及未忽略的未跟踪文件做审查前后逐文件 SHA256 比较，差异为空；证据 `/private/tmp/p6b4rev2.before.json`、`/private/tmp/p6b4rev2.integrity.json`。没有修改仓库文件或 commit。

未跑完整 npm/test:ext/drift、CE、types/build、组合/删除矩阵或浏览器；未冻结预算、未重跑长基准。本轮为最后一轮独立复审，剩余 B4-5 按既定 D6 交维护者收口，不再要求第三轮审查。最终结论：**需修（R1 三项已关闭，性能验收阻断未关闭）**。
