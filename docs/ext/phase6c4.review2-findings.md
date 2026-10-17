# 6C4 独立复审，第 2 轮（最后一轮）

结论：**可合入**。R1-F1 已修复并独立关闭；本轮定向审查未发现修复引入新的阻断或重要问题。浏览器、数值平衡、云端性能依用户要求不计缺陷，本结论不替代这些验收。

审查基线为 HEAD `0d2e98a91e238e9c988017e87c7a51fb31569691`，对象为工作区全部未提交的 6C4 实现及修复。已读根 AGENTS.md、HANDOFF、development、architecture、C0 合同 §2/§6/§6.1、第 1 轮发现及作者报告的审查发现处理节。没有修改仓库文件，没有 commit。

## R1-F1 核实

- `src/ext/modules/loot/schema.ts:155` 的匹配交集检查及 `:451` 的成对准入检查在逐表结构验证之后执行。相同来源、相同 priority、相交的闭区间深度及可同时成立的选择条件会报 `INVALID_COMBINATION`，错误路径指向冲突表 `.match`。概率为零、奖励内容不同均不能绕过；没有排序、挑选一条或修改冻结合同来掩盖歧义。
- part 按 body ID 和部位集合交集判断，部位排列无关；缺省深度按 1…99。不同 body、互斥部位、相邻不相交深度及不同 priority 保持合法。原复现所用“零概率同匹配表插到默认 part 表前，再交换顺序”的两种输入现在均被拒绝。
- kill 的类别/ID 通配、显式 ID 的实际类别及未知 ID 的 defaultClass 均纳入交集判断；类别查询与 `generator.ts:140` 使用相同目录，members 的 ID 唯一性在先校验。encounter 的 formId 通配和具体形态得到同样保护。
- floor/vault 的 DropTable 声明统一受守卫约束；实际生成仍不调用 selectTable。runeDrops 在 `schema.ts:424` 已有 `(presetId, source)` 唯一性检查，gold 使用严格对象按来源/类别索引，没有首条命中竞争。craft 不使用 DropTable，site 仍无生成入口。本次没有发现遗漏的同类可达表间歧义。
- 修复不触及 `generator.ts:101` 的选表逻辑、随机数、数据表、宿主台账、事务或版本。对比第 1 轮源清单，只有 schema.ts 和两个测试文件变化。现有 256 表上限限定成对检查至多 32,640 对；检查只在目录准入发生。

## 独立验证

Node 24.19.0，3072 MiB，Vitest 单 worker、禁文件并行。只运行相关测试、boundary、测试依赖检查及相关仓外探针；没有运行完整 npm/ext/drift、构建、组合枚举、浏览器或性能计时。

| 项目 | 实际结果 |
| --- | --- |
| 相关测试 | 7 文件，294 pass，0 fail/pending/todo，无 unhandled error，退出 0 |
| 模块 boundary | 退出 0 |
| 测试依赖检查 | 退出 0，errors=[] |
| 原 R1-F1 独立复现 | 两种表序均拒绝 |
| 独立匹配交集矩阵 | 1,119 对配置，每对检查正反两种表序；664 次应拒绝、1,574 次应准入，全部符合独立事件枚举判据 |
| 独立合法选表顺序检查 | part/kill/encounter × 不同 priority/互斥深度/互斥选择条件，共 9 场景；交换表序及 partIds 顺序后，完整结果和每次随机区间完全相同 |

测试文件及项数：loot_schema 137、loot_catalog 12、loot_data 11、loot_generator_vectors 27、loot_generator_props 53、loot_b4_vectors 22、loot_sources 32。作者新增用例中的零概率遮蔽、部分交集、闭区间端点、全深度、不同来源及恰好 256 表边界均随本次测试通过。原骰带回归保持。

独立矩阵分布：part 171 对、kill 903 对、encounter 45 对；判据通过枚举深度及代表性事件计算可同时匹配性，没有调用生产交集助手。合法顺序场景分别保持 part 1 件/5 骰、kill 1 件/9 骰、encounter 2 件/39 骰（完整材料、金币、实例结果也参与比较）。此处计数限所构造的场景，不泛称所有输入已穷尽。

V25 旧测试修订可接受：核对作者留存的修复前测试、单变量 schema 回退日志及首次失败 JSON；修复仅将第二张表 priority 从 500 改为 499，并更新描述。结果、ilvl、类别和字面骰带断言保持。当前独立运行 V25 所在整文件 27 项通过；本轮没有回退仓库文件来重做作者反事实。

证据：

- `/private/tmp/p6c4rev2.tests.json`、`.tests.log`
- `/private/tmp/p6c4rev2.boundary.log`
- `/private/tmp/p6c4rev2.dependencies.log`
- `/private/tmp/p6c4rev2.probe.mjs`、`.probe.json`、`.probe.log`
- `/private/tmp/p6c4rev2.before.json`、`.integrity.json`

探针首跑完成匹配矩阵后，在合法深度场景误将获胜表保留为全深度，因实际重叠被守卫拒绝，退出 1；原日志保留为 `/private/tmp/p6c4rev2.probe-first.log`。只修正仓外探针的获胜表范围为 [1,10]，重新完整运行退出 0，未修改生产代码或放松断言。SSR 的沙箱 HMR `listen EPERM` 提示保留；SSR 模块加载和全部断言正常完成。

## 身份与审查边界

当前 src 1,475 文件及 dist 61 文件逐文件符合作者 R1 修复后清单。src 清单散列为 `6cf83cd238698fb37da0f3f556e1bf1384c33af06733e2fcdeecec179e9ddf65`。对照第 1 轮，src 变化恰为 `schema.ts`、`loot_schema.test.ts`、`loot_generator_vectors.test.ts`；冻结数据、生成器、运行时及 SDK 字节保持。

审查前后仓库受跟踪与未忽略文件清单及散列核对一致（3,163 文件），所有本轮探针、日志和报告均位于 `/private/tmp/`。本轮针对 R1-F1 及修复相邻风险收口，不宣称重跑第 1 轮的全部生命周期、物理删除布局或自然路线证据；没有剩余已确认需修项，不建议新增审查轮次。
