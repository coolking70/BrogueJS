# 3g：成长容量与已提交战斗事实 adapters

## 决定与边界

2026-10-05 维护者明确批准 `phase3-adapters.proposal.md` 的 A/A/A/A，提案已先标记“已决定”。开工从 `fe76575baa60bffad969180688519638a786835e` 干净工作树出发，实查 GitHub 后先快进合入 `ext/foundation` 的 `312e9eb05deb5e8cc82964da6a1b628fb6f1fa41`（含 4d-5）。本步只实施 3g，不含 4e/4f，不改 main、tag 或部署。

最终门禁前再次实查并合入维护者完成的 4d-6 `80640d1f0aa701d71e34758403bf18967fbff097`。3g checkpoint 为 `78a969f`；最终门禁尚未填入前不是验收完成声明。

## 协议与持久化

- foundation 4 → 5：manifest 与 foundation snapshot 精确版本同时变更；旧档拒绝，不迁移。根 fact ID 与稳定 module ID 排序的派生范围属于底座。
- growth 1.7.0：`growth.combat-stats.v1`，独立体力/韧性数据映射、可调临时值、严格有限整数 DTO、规则指纹。
- combat 1.5.0：记录有效容量及 growth revision；load 在解码候选世界里只读复核，不能以旧 live Game 替候选授权，不能读档补余额。
- narrative 1.4.0 / state 4：声明式战斗事实订阅与唯一收据，示例首次玩家篝火休息设置 flag 并解锁 NPC 旁支；不自动打开对话，不允许订阅发奖励或任意脚本。
- giants 的机械规则和群体资源所有权不变；其 descriptor 仅跟随 foundation 5。

## 可信 actor 查询

只有原生引擎能持真实 Creature 引用调用查询；模块 context、UI/public payload 不获得该入口。底座校验直接当前/缓存/pending 层、purgatory 与被持有/leader 的保留图闭包；直接层归属优先于关系边。相同数字 ID 的另一对象不获授权。群成员额外核验 core/slot/entity/generation 与层归属，NPC 不借用 player-only 查询。

provider 只读取自己命名空间下该 actor 的深冻结组件与冻结状态，查询作用域同步结束即失效。缺 provider 与 unsupported actor 退回 combat 模板；非法、非同步或越界结果抛错。容量更新仅在获准机械提交/安全结算点发生；提高不补新增容量，降低截断绝对余额，保留恢复参数、定点余数、延迟、窗口、已付款束与既有硬直。

## 已提交事实事务

底座为每个有消费者的根事实分配一次 ID，按 ASCII module ID 顺序给每个消费者互不碰撞的有界派生范围。先全部纯 prepare，后全部 commit；总根/派生预算受共同 4096 上限约束，注册次序不影响事实身份。没有 combat 订阅时不建立事件队列或消耗事件 ID；没有 narrative 或没有对应订阅，不补发历史事实。

四类事实：段 `attack-resolved`（action/subaction/segment）、实际开始的 `staggered`、真实 resolutionId 的 `parried`、完整恢复/收据提交的 `rest-completed`。windup、半休息、取消/失败不冒充成功。原生没有 phased action 的 stagger/parry 使用 actionId=0，仍保留弹反真实 resolutionId；群成员 generation 从 0 起。来源公开 DTO 只给 entity/part/generation、公开角色/标签，不包含坐标、隐藏名字或未来计划。外层事务在接触前保留可信来源身份，来源同 tick 退休不抹掉已解算段的来源。

原生接触、scheduler 完整 phase 推进及休息结算都进入同步原生事务；新事实等外层工作全部完成后发布。故障恢复原实体/列表/资源/动作对象身份、模块状态/组件、根和派生计数、消息、实体 ID 和两 RNG。显式原生写集覆盖地图/环境、当前和缓存实体及物品、群表、玩家/统计/公开知识、显示队列和派生 spatial/action 状态；另由各生命周期所有者恢复 DF 消息状态、陷阱凹陷、proxy 列表方形计数、空间监听和 terrain revision。4d-6 新增 seenBodyCoreIds、machineCells/path/safety/loop/lighting/retry 写集和 machine allocator 同时保留。完整伤害边界包含 Monster/Player 的 shield/absorption/logger 前置及 Creature 的 damage/death 尾部，避免 bolt 成员 zone 先发事实、后续 transfer/hook 失败。相同原子接触最终致死时不发布短暂硬直。不是 save/load 替换对象的回滚，也不声称通用 transaction 原先已覆盖任意原生动作。

## 独立审查修复

独立审查先发现并要求修复：新生实体在 runtime 私有集合残留、保留 carried/purgatory actor 错误拒绝、同 tick 退休来源失去 part/generation、DF/陷阱 WeakMap 状态、proxy 列表计数及空间监听 epoch。逐项修复并加入回归，最终复核结论另填。

## 旧测试前提变更

1. foundation 精确版本断言 4→5：旧 production 的原测试通过；候选原测试仅报实际 5 与历史 4 不符。保留身份/拒绝语义，改成授权的新协议版本。
2. growth 空属性包夹具：旧 production 原测通过；新映射引用已删除属性导致严格校验拒绝。夹具明确 `combatStats:null`，原断言不变。
3. narrative entered-level 派生范围：旧 module/planner/commit 的原测试通过；候选预留最大派生区间产生 34 而非历史 3。仅把 nextFactId 前提改为 `2 + eventsPerCommand`，奖励顺序/收据语义不变。
4. narrative 默认新增 `bonfire.rested:false`：隔离旧内容的对应原测通过，只补精确 false flag，旧结局断言不变。
5. combat 版本 1.4→1.5：隔离副本仅回退四处生产版本字面量，176/176 原测通过；更新四处历史版本期望。
6. bonfire 的8组合原测认为 narrative namespace 完全不变：隔离副本只移除 `bonfire.first-rest` 新订阅后8组合通过。候选保留完整 namespace 深比较，只增加确切的授权 flag、revision、lastFactId 和唯一六字段收据，其他 ledger 断言原文不变。

## 验证状态

开发期独立模块结果：growth 35 文件/641 项通过；其余最终合并候选结果待下表填入。生成基线/黄金 trace 不重录。完整 npm test、全部 test:ext、实际删除矩阵、CE full/gen 依维护者指示保留给 4f 统一收尾，不能以本步功能集合冒充全量通过。

最终候选、逐命令退出码/耗时、相关文件清单、组合范围和散列：待最终冻结门禁。


## 4d-6 合并逐项核对

- Game imports、候选容量校验与4d status/attack profile几何校验并存，不用旧profile闭包覆盖新声明
- runtime 同时保留4d的restHandlers弱关联、member/zone证明、prepare/commit双证明，以及3g查询/事实注册弱关联；新增可选ports不改变旧runtime自有字段图
- SpatialRevision同名checkpoint取语义并集：保留4d watch epoch/每格观测值，增加3g订阅集合和原watch身份恢复；CreatureSpatial保留新pose/状态归属逻辑与3g监听/来源revision恢复
- ActorActionProduction保留4d suspendedDepth/resolving/resumePending恢复并加3g scheduler故障恢复；仅可能发布事实的完整dispatch进入checkpoint
- body-zone-hit与完整takeDamage原子边界嵌套合并；保留4d部位到核心传伤、破坏证明和整组退休，只延后事实发布至全部伤害尾部成功
- scripts/test-suites与growth test-suites取两侧并集；最终额外运行全部phase4d_*和giants_composite*，没有删4d测试或改其门限
### 4a0 module-content baseline attribution

The unchanged P4A0 guard reproduces 1 pass / 3 failures on the merged candidate (28.73s, exit 1). An isolated single-variable counterfactual restores only growth/narrative production to `80640d`, retains descriptor `foundation: 5`, and preserves every shared runtime/core file, original test and original fixture: 4/4 pass (29.27s, exit 0). Exactly 20 module production files differ between the copies, including removal of new growth/combatStats.ts. No shared repository file was edited for this audit.

Diagnostic instrumentation was confined to the two temporary copies. All 104 counterfactual graph/snapshot digests exactly reproduce the old fixture. Semantic comparison covers all 52 checkpoints, matches every old object by property/map paths, and preserves all existing aliases, prototypes and property descriptors. Native world/entity state, both RNG streams/counts, messages, clocks and entity/machine allocators are unchanged.

Raw snapshots contain only growth/narrative module version/rules-fingerprint changes, narrative schema 3→4 and added `bonfire.rested=false`, including their recording-origin/event copies. Exact changed-leaf totals are empty 0, growth 189, narrative 246, growth+narrative 490. Full graph changes additionally include growth combat-capacity config in its two definitions projections plus the optional actor-query provider (+30 objects), narrative committed-fact consumers replacing the old storyFact hook (+4), or both (+34). No unrelated native or shared-port drift exists in these checkpoints.

Recapture is justified only for these intentional module changes and must use the original `P4A0_CAPTURE=1` entry after final production freezes. The guard/filter/assertions stay unchanged. Expected fixture delta: 117 leaves (39 graph hashes, 39 graph object counts, 39 snapshot hashes); snapshot object counts, RNG and messages are unchanged; the empty set is exact. Old fixture SHA-256 `3dd6e94c091c1d4d502e69d5d381f7702884c51227c9f34531c525e01986cfb8`; diagnostic predicted hash `1ef488d3fa2741d410faa363d431a264997f81a2a972cafec77b164eb47fe044`. The prediction is not a capture; verify the actual final capture independently.

Compact evidence: `phase3g-p4a0-attribution.json` (52 checkpoint old/candidate hashes, changes, alias/native verdicts, source restoration and test commands/exit codes). Raw graphs remain outside the repository under `/tmp/p3g-p4a0-audit/`.

Actual final capture: original `P4A0_CAPTURE=1 npx vitest run src/test/phase4a0_spatial_differential.test.ts --maxWorkers=1` passed 4/4 in26.29s, exit0. Independently verified exactly117 expected digest/count leaves changed, empty unchanged, and actual fixture SHA-256 equals the predicted `1ef488d3fa2741d410faa363d431a264997f81a2a972cafec77b164eb47fe044`. The original guard/filter/assertions remain byte-identical.

追加严格profile校验后，原4d变形回归发现已闲置的rat仍残留旧fixture.profile且无bundle/action。修复在sourceChanged/finishAction机械边界同步已有闲置资源，保留有效已付款pin，不在load归一化；原生命周期断言保持，64项回归通过。跨grid terrain owner恢复改为先统一清理新增关联再恢复旧关联，防止后处理grid误删先前恢复的owner。独立最终审查未发现剩余阻断。
