# 6B3 独立复审 R2（最后一轮）

结论：**可合入**。R1-F1 已修复并经本轮独立复核关闭；未发现修复引入的新阻断或重要问题。结论限本轮定向复审范围；数值平衡延期、三档浏览器由维护者执行，按明确裁定不列缺陷。

审查对象：HEAD `944615f45a2647af6a197f621ffac6f31c9ea6f3` 之上的未提交 6B3 实现及修复。已读 AGENTS.md、HANDOFF、development、architecture、6B3 任务书、第 1 轮 R1-F1 和实施报告“审查发现处理”节。实际运行环境 Node **v25.2.1**，与作者记录的 Node24 分开说明。

## R1-F1 判定与代码证据

**关闭。** `src/ext/modules/growth/skills.ts:202`–`:205` 仅对施放快照移除永久总预算及永久 minimum 校验，保留完整属性键集、非负安全整数、单属性 cap、训练 cap。该范围与 `statSources.ts:14`、`:17` 的有效属性根 minimum=0、maximum=min(属性 cap,训练 cap) 一致；允许有效总值超过永久总 cap 是既定合同，不是放宽永久投资。

`module.ts:114` 从真实属性 Stat 根取得有效值；`:371` 的期限预检、`:384` 的施放来源均使用它。`skills.ts:144` 的效果构造深拷贝来源；后续卸装不改施放快照。原来源身份、等级、效果 ID、标签、期限、消费计数等校验保持，未删除其他拒档检查。

同类位置逐项核查：

| 位置 | 判定 |
| --- | --- |
| `attributes.ts:38`–`:56`、`state.ts:117` | 仍验证永久 values/allocated 的 minimum、单项/总 cap、支付与基线；没有将装备有效值写回永久组件。 |
| `identities.ts:61`–`:69`、`:173` | 创建身份/选择的永久值与剩余分配预算，应保留总 cap。 |
| `templates.ts:72` | NPC/盟友永久分配预算，应保留；继承路径复制永久 attributes.values。 |
| `schema.ts:250`、`:351` | 初始值及身份赠予的永久配置预算，应保留。 |
| `view.ts:460` | 创建选择的永久预算提示，应保留。 |
| `module.ts:362` | 学习前置继续使用永久 view；没有因快照修复改为装备解锁。 |
| `statSources.ts` 与 `skills.ts` | 派生消费有效根，持久临时效果使用冻结 source；未发现另一处把有效快照套入永久总预算或 minimum。 |

复算修复后 1487 文件源码 scope 为 `d4ed28375f215f6cc825b9193a7504260bb4367fa0bfb721504f3fc42dd0caf8`，与报告一致。对比作者保存的 R1 文件级指纹（对应 R1 报告 scope `c71ba83e…`），差量恰为 `growth/skills.ts`、`growth/tests/ext_growth_skills.test.ts`、`loot/tests/loot_growth_attributes.test.ts`。生产修复只有上述验证器分支；未改配置数值、持久字段、版本或守卫。并直接对比了仓外 `skills.before.ts`，差量吻合。

## 独立复现与存读档／回放证据

1. 复用第 1 轮独立探针，仅改仓外输出路径并补断言/非法输入检查，脚本为 `/private/tmp/p6b3rev2.cap-probe.mjs`。合法 cap4 配置下，seed42/wizard、scout+stoneborn+unaffiliated，永久总值3；通过 `deriveNativeFacts` 构造合法 T6 +3 意志戒指并真实 equip，施放 hold-breath 后快照总值6。**施放前 load=true，技能快照验证=true，施放后 load=true**。默认 cap36 对照亦通过，两次均 exit0。结果分别为 `p6b3rev2.cap-4.json`、`p6b3rev2.cap-36.json`。
2. 两种配置各以真实保存快照测试负数、小数、超过属性 cap、超过训练 cap、不安全整数、缺键、多键七类损坏。全部 load=false，完整活局对象图（含 Game/录像及双 RNG）无差异，实体 ID 分配器保持。未通过修改有效快照或永久预算来绕过拒档。
3. 本轮完整执行新增 `loot_growth_attributes.test.ts:134` 回归：装备后存读、施放后存读、完整回放零 OOS、施放前及末尾 seek、读档卸装、意志降回0而冻结快照仍为3、再次存读、载档续录完整回放及摘要一致，永久属性始终不变。已检查 harness 的 load/replay/seek 调用真实引擎；只在测试首层生成后注入同一装备场景，各 live/replay/seek Game 使用自身实例。**这是受控布景，不宣称自然掉落。** 同文件默认自然成长链也实际运行通过。
4. `ext_growth_skills.test.ts:105` 的正 minimum 配置证明有效值0及各项有效 cap 合法，非法数值/键集合仍拒绝，永久超总 cap/低于 minimum 仍拒绝。技能集成、公共效果投影、NPC 回放、模板与克隆相关原回归同时通过。

## 本轮实际执行

单批显式相关测试，无 `-t`：**8 文件、103 项通过，exit0，Vitest 68.00s；失败、skip、未选、todo、unhandled 均0**。没有把探针或重叠检查累加成更多测试项。

```sh
NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run src/ext/modules/growth/tests/ext_growth_attributes.test.ts src/ext/modules/growth/tests/ext_growth_skills.test.ts src/ext/modules/growth/tests/ext_growth_skill_integration.test.ts src/ext/modules/growth/tests/ext_growth_public_effects.test.ts src/ext/modules/growth/tests/ext_growth_templates.test.ts src/ext/modules/growth/tests/ext_growth_clone_overhealth.test.ts src/ext/modules/growth/tests/ext_growth_npc_replay.test.ts src/ext/modules/loot/tests/loot_growth_attributes.test.ts --maxWorkers=2
node scripts/check-module-boundaries.mjs
node scripts/check-test-dependencies.mjs
NODE_OPTIONS=--max-old-space-size=3072 node /private/tmp/p6b3rev2.cap-probe.mjs
PROBE_CAP=36 NODE_OPTIONS=--max-old-space-size=3072 node /private/tmp/p6b3rev2.cap-probe.mjs
```

| 证据（均在 `/private/tmp/`） | 结果 |
| --- | --- |
| `p6b3rev2.related.log` | 8/103 全过，exit0 |
| `p6b3rev2.boundary.log` | Module boundaries and test ownership verified，exit0 |
| `p6b3rev2.dependencies.log` / `p6b3rev2.dependencies-summary.json` | 663 测试文件，8 已安装模块，errors=[]，exit0 |
| `p6b3rev2.cap-{4,36}.log` / `.json` | 两次独立探针及全部补充断言通过，均 exit0；非法读档拒绝日志是预期负例 |
| `p6b3rev2.before.json` / `p6b3rev2.integrity.json` | 前后 3062 个已跟踪/非忽略未跟踪文件路径及字节一致，changed=[]；HEAD 未变 |

未运行全量、CE、drift、types、build、浏览器、平衡或新增物理移除布局；不将作者及 R1 历史结果冒称本轮执行。未修改仓库文件、未 commit/push。原始证据全部留仓外。
