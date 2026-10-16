6B4 独立审查 R1（最多两轮） — 结论：**需修**

审查对象：`ext/phase6`，HEAD `8d7c79974fee69d7ffdd45b286b9b6878f081be7` 的未提交实现。已读 AGENTS.md、HANDOFF、development、architecture、6B4 task/report/contract；按 D1–D7 全 A 审查。数值平衡延期、维护者浏览器责任均不列为缺陷。本轮没有修改仓库文件，没有 commit；探针、日志和本报告均在 `/private/tmp/`。

新增确认问题只有以下三项，均为**重要**；另保留作者已披露的 **D6/P0 收口阻断**。现有自动测试通过不覆盖下面的边界。

1. **R1-F1：分摊符文以“玩家伤害下降”代替“实际分摊结果”，漏揭示 1 点伤害。**

   位置：`src/engine/Core/Game.ts:9445`（mutuality 的 committed 判定及后面的邻敌 takeDamage）。输入伤害为 1、存在一个合格相邻敌人时，`share=floor((1+1)/2)=1`，所以 committed=false；但邻敌仍真实受到 1 点符文伤害。首次实际效果已发生，符文行及 runicKnown 却保持未知，违反任务 §3.3/D4 的实际可归因结果要求。实施合同把 mutuality 缩为“分摊并降低该击伤害”不能覆盖任务要求的实际分摊结果。

   仓外复现：loot 单开、未知 `loot.affix.rune-a-mutuality` 护甲，攻击者旁另放一只合格敌人，执行真实效果入口 `tryTriggerArmorRunic(attacker,1,true)`。实测 `{incoming:1,remaining:1,neighborHpBefore:100,neighborHpAfter:99,rowKnown:false,runicKnown:false}`。应以实际分摊/减伤结果归因，保留无对象、0 输入和失败回滚负例，增加此低伤害正例。

2. **R1-F2：呼吸符文在只有瞬时接触、尚无气体效果结算时提前揭示。**

   位置：`src/engine/Core/Game.ts:13072`–`13079`。仅 gasFlags 命中呼吸免疫集合便提交知识，未检查本次执行的效果种类/阶段及是否实际阻止结果。腐蚀气体 `POISON_GAS` 的伤害在本函数 `!instantTarget` 的渐进伤害分支；`applyEnvironmentalEffects(player)` 明确只处理瞬时接触，既不应结算此伤害，也没有对应状态效果。

   仓外复现：装备未知 respiration 护甲，将玩家格设为 POISON_GAS，调用生产瞬时接触入口 `applyEnvironmentalEffects(player)`。有甲与无甲对照均为 HP 45→45、statusDurations `{}`→`{}`、disturbed false→false；有甲却把符文行揭示为 true。探针还记录了已有更长混乱状态的边界，但本条以无任何机械变化的毒气瞬时接触为主要证据。知识回执应跟随实际渐进伤害或实际状态阻断提交，不能仅因危险旗标存在发布；原生原有自亮与 loot 行同步也须一并门控。

3. **R1-F3：已知地面装备详情仍用原生附魔投影，显示错误符文强度及下一次预测。**

   位置：`src/engine/UI/ItemDetailContext.ts:65`，`src/engine/UI/ItemDetailEquipment.ts:20`、`:26`。新管线投影仅对背包成员创建；地面物品回退到 `equipmentStats({...item})`。对象复制丢失该件的 WeakMap 扩展绑定，runic L0 回退原生净附魔；nextStats 还调用原生 +1/减需求的 projection。

   仓外复现：合法 rare 护甲含未知 fireward 与 T1 absorption；通过真实吸收效果仅揭示 absorption，强度管线为 8 quarter（2 当量）。背包原生详情显示“随机吸收 1–2 点；再附魔后最多 2 点”，并提示强化不增符文强度。卸下并移至地面，对同一实例调用 `createItemDetailContext` + `equipmentDetail` 后变为“1–1 点；再附魔后最多 2 点”，且丢失“不增加符文强度”说明。物品数值和已知行均未改变。应让地面/非背包的合法检视使用保留该件扩展语义的只读投影；新增相同实例背包↔地面一致性回归，不能为修显示揭示未知行。

三项的可执行复现文件：`/private/tmp/p6b4rev1.probe.mjs`；最终结果：`/private/tmp/p6b4rev1.probe.json`；完成日志：`/private/tmp/p6b4rev1.probe-final.log`。在仓库根运行：

```sh
NODE_OPTIONS=--max-old-space-size=3072 /Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/p6b4rev1.probe.mjs
```

探针断言当前错误结果以稳定复现，修复后这些断言应失败/更新为正确语义。它只建立受控布景并调用生产函数，不修改生产源码，不冒充自然掉落。准备探针时的两次布景错误（magic 双后缀不合法、读取不存在的 statuses）保留于 probe/probe3 日志，最终使用合法 rare 数据和 statusDurations。Vite 报出的 WebSocket EPERM 为当前环境监听限制；SSR 装载及最终全部断言完成，进程退出 0。

逐项判定与证据：

| 核查项 | 判定 | 证据/限制 |
| --- | --- | --- |
| 强化/精炼候选、已满行、拒绝零成本、解咒优先级、timesEnchanted、不额外鉴定 | 通过（已查范围） | enhancement.ts 的稳定行序、包含已满行、逐分量 max、单候选/固定区间不取骰；Game 延迟卷轴消费及完整回滚。loot_enhancement 11 项、loot_b4_runtime 70 项包括真实 read/select/cancel/full/late failure、原生偏移保持和只读图审计。精炼接受 1 单位，times+1；0 输出 times 不变。 |
| growth 多级/满级/收据 | 通过 | module.ts 在发收据前按 nativeLimit 钳制；未满只补剩余等级，已满最多精炼一次；0 输出不精炼；非 enchantment 替换不套物品上限。loot_b4_growth 5 项含 perItem/run cap、两种点数替换及跨边界长链。 |
| 符文强度重塑与 21 随机族 | 机械路径通过；详情需修 F3 | NativeStatSources 替换本件 L0，quarter 只转换一次；四唯一强度、投掷本件隔离及失败回滚有 runtime 实测。21 条真实生成字面骰带通过，正常正面池/腐化负面/互斥/maxTier/64 骰约束保留。 |
| vorpal 目标与实例 v2 | 通过 | 稳定 15 类的顺序、频率、深度与移出的原表相同；只有 slaying/immunity 末尾目标骰；drops→FixedItemAssembly 映射 vorpalEnemy；实例校验拒缺失/非法目标和错误版本，未知 DTO 不含 targetClass。loot_b4_vectors 22 项、item/schema 相关用例通过。 |
| 首次触发与查询无写 | **需修 F1/F2**；查询纯度通过 | 25 行常规正例/已实现负例和事务回滚通过；新探针揭出两个遗漏边界。runtime 100 次查询完整对象图及双 RNG 不变，执行/知识提交分离，重复回执幂等。不能据已有常规正例称 25 行完全闭合。 |
| 版本、指纹、拒旧 | 通过 | foundation17/itemSdk2/loot0.5.0 pack0.2.0实例v2/growth1.10.0；目标表纳入规则指纹；新 pending 字段登记 U03/摘要。额外 8 个存档/录像拒绝探针：foundation16、loot0.4、growth1.9、错误指纹均拒绝且完整活局/RNG/ID/录像保持，见 p6b4rev1.versions.json。 |
| 原 P0 保留、新 P0 校准和回退口径 | **已知收口阻断，未通过** | 原预算/比较器/观测器/两条原路线与 HEAD 字节一致；两身份及 8 拒绝 selector 检查通过。原版/候选共 10 份 summary 的 SHA256 与提交摘要一致；三次候选每 case 语义及入口计数一致。缺冻结预算与冻结后门禁，见下段。 |
| 同版本存读/回放/seek/续录 | 通过（功能限定链） | loot_b4_growth 的 2049 事件受控链实际通过：强化→精炼→吸收→部分揭示→save/load→完整 replay→255/256/257、2047/2048/2049 seek→续录。自然路线沿作者当前同源码证据，不冒称本轮重跑；两者不替代 P0。 |
| 模块边界/全移除 | 通过（本轮静态 + 同源既有全删证据） | 本轮 boundary 与静态测试依赖检查退出 0、errors=[]。唯一全删副本存在、剩余 885 个源码文件与当前树逐字节一致；核验已有 all-removed-smoke 的 installed=[]/requestedScopePassed=true 和 sealed-missing-inputs 的同版本 save/recording 拒绝且活局保持。没有新建删除布局；本轮未重跑 types/build 或删除矩阵。 |
| 共享补口是否越权 | 未发现越权 | provider 仅获冻结自有数据/有界 RNG，宿主校验提案且仅写自有 moduleData、戒指 enchantmentDelta、计数；growth 只获通用接受量上限；目标表属宿主公开目录；worldSdk/edibleSdk 字节未改，未发现模块私有横向导入。 |

D6/P0 的已知阻断不属于新增代码缺陷，但足以禁止本轮给出“可合入”。按同环境原版对照，P95 复核线 959.0070 ms、max 8476.7111 ms、墙钟 988.4915 s；三次候选 P95 850.9741/963.7788/1255.4743（2/3 超线），max 6836.5069/12146.7141/955235.5134（2/3），墙钟 959.9691/955.8093/2490.3295（1/3）。1 ms 噪声带不改变判定。可比前 1714 事件的前两次 P95 也高于原版 10%，不应只用规则路线改变解释。合盖休眠证据说明数据污染，不能据此认定确定的代码回退，也不能豁免重新配对测量、三次校准、冻结及最终门禁。本轮未另跑长基准或修改电源设置。

身份复核：当前全部 1456 个 src 文件 SHA256 为 `fb608a49780b4dec5fae81a2a84841e867dbb19e5e239645b76e0dc710dd6bb8`，与作者 identities.json 一致（包含未跟踪新源码）。

本轮验证的最终逐文件结果和运行限制附于下方。

另外实跑缺冻结预算入口：`node scripts/check-ext-perf.mjs /private/tmp/p6b4rev1.perf-input /private/tmp/p6b4rev1.perf-output --phase6b4`，预期 exit 1，错误为缺 `scripts/ext-perf-6b4-budget.json`；日志 `p6b4rev1.perf-unfrozen.log`。这是明确的失败关闭，不是一次性能回放，也不算通过新 P0。

最终相关测试：**16 个不同文件、659 项通过，所有最终命令 exit 0**，未按重复尝试累计。全部逐文件独立启动 Node24 / 3072MiB，Vitest `--pool=threads --maxWorkers=1 --no-isolate`；每个文件独立进程，文件之间不共享模块状态，未改测试代码、断言、快照或用例超时。完整 argv、退出码、进程耗时见 `/private/tmp/p6b4rev1.tests.json`；首个强化文件另见 single.log。

| 文件 | 通过数 | 仓外日志（/private/tmp/） |
| --- | ---: | --- |
| `src/ext/modules/loot/tests/loot_enhancement.test.ts` | 11 | `p6b4rev1.single.log` |
| `src/ext/modules/loot/tests/loot_b4_runtime.test.ts` | 70 | `p6b4rev1.loot_b4_runtime.test.log` |
| `src/ext/modules/loot/tests/loot_b4_growth.test.ts` | 5 | `p6b4rev1.loot_b4_growth.test.log` |
| `src/ext/modules/loot/tests/loot_b4_vectors.test.ts` | 22 | `p6b4rev1.loot_b4_vectors.test.log` |
| `src/ext/modules/loot/tests/loot_item.test.ts` | 100 | `p6b4rev1.loot_item.test.log` |
| `src/ext/modules/loot/tests/loot_schema.test.ts` | 91 | `p6b4rev1.loot_schema.test.log` |
| `src/ext/modules/loot/tests/loot_game_ui.test.ts` | 7 | `p6b4rev1.loot_game_ui.test.log` |
| `src/ext/modules/loot/tests/loot_game_sfc.test.ts` | 12 | `p6b4rev1.loot_game_sfc.test.log` |
| `src/test/ext_recording_v4_digest.test.ts` | 20 | `p6b4rev1.ext_recording_v4_digest.test.log` |
| `src/test/w_7_arcana_enchantment.test.ts` | 30 | `p6b4rev1.w_7_arcana_enchantment.test.log` |
| `src/test/u_15d_weapon_runic.test.ts` | 24 | `p6b4rev1.u_15d_weapon_runic.test.log` |
| `src/test/u_15d2_armor_runic.test.ts` | 7 | `p6b4rev1.u_15d2_armor_runic.test.log` |
| `src/test/w_4_bolt_reflection.test.ts` | 29 | `p6b4rev1.w_4_bolt_reflection.test.log` |
| `src/test/w_23_negation.test.ts` | 40 | `p6b4rev1.w_23_negation.test.log` |
| `src/test/ext_combat_neutral_differential.test.ts` | 173 | `p6b4rev1.ext_combat_neutral_differential.test.log` |
| `src/test/u_03_whole_run_snapshot.test.ts` | 18 | `p6b4rev1.u_03_whole_run_snapshot.test.log` |

其余独立检查：boundary exit 0（`p6b4rev1.boundary.log`）；测试依赖 exit 0、errors=[]（`p6b4rev1.dependencies.log`）；perf selector 两身份/8负例 exit 0（`p6b4rev1.perf-selector.log`）；三问题探针及8版本拒绝探针 exit 0；`git diff --check` 通过。

执行历史明确保留：最初16文件默认批次及 threads 批次长时间未返回用例结果，人工中止 exit130，不能称这两批通过；单文件 vmThreads 试跑在装载期因严格 JSON/跨 realm 原型检查报 fingerprint 错误，未执行用例，不当作产品失败；同一文件最终普通 threads 独立进程 11 项通过。最终15文件串行驱动另有180秒外部看门限，全部在其内结束、未触发中止；仓库既有用例超时不变。这些尝试日志均留在 `/private/tmp/p6b4rev1.*.log`，没有删失败或以串行通过冒称首次批次全绿。

未运行完整 npm/test:ext/drift、CE/full/gen、组合/删除矩阵、浏览器、types/build；不扩大本轮范围。最终源码哈希仍等于审查开始的身份。**本轮结论：需修；修复 R1-F1/F2/F3，且按既定 D6 关闭新 P0 收口阻断后再作合入判断。**
