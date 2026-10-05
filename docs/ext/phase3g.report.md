# 3g：成长容量与已提交战斗事实 adapters

## 决定与边界

2026-10-05 维护者明确批准 `phase3-adapters.proposal.md` 的 A/A/A/A，提案已先标记“已决定”。开工从 `fe76575baa60bffad969180688519638a786835e` 干净工作树出发，实查 GitHub 后先快进合入 `ext/foundation` 的 `312e9eb05deb5e8cc82964da6a1b628fb6f1fa41`（含 4d-5）。本步只实施 3g，不含 4e/4f，不改 main、tag 或部署。

最终门禁前再次实查并合入维护者完成的 4d-6 `80640d1f0aa701d71e34758403bf18967fbff097`。3g checkpoint 为 `78a969f`。之后按维护者要求再合入4e `97988d5`，完整154文件门禁候选为 `e6ad385dd7807b6eaae2c689b0d4a65dbecff35a`。交付前再次并入最新9331104，最新生产候选为 `ba83835`，增量门禁另列于文末。

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

独立审查先发现并要求修复：新生实体在 runtime 私有集合残留、保留 carried/purgatory actor 错误拒绝、同 tick 退休来源失去 part/generation、DF/陷阱 WeakMap 状态、proxy 列表计数及空间监听 epoch。逐项修复并加入回归；共享运行时/群体伤害/跨grid恢复独立复核无剩余阻断。最终17af360的增量只读独立复核同样无阻断：已提交story消费者识别、旧夹具限定修订、版本/候选世界校验与§5覆盖均成立。

## 旧测试前提变更

1. foundation 精确版本断言 4→5：旧 production 的原测试通过；候选原测试仅报实际 5 与历史 4 不符。保留身份/拒绝语义，改成授权的新协议版本。
2. growth 空属性包夹具：旧 production 原测通过；新映射引用已删除属性导致严格校验拒绝。夹具明确 `combatStats:null`，原断言不变。
3. narrative entered-level 派生范围：旧 module/planner/commit 的原测试通过；候选预留最大派生区间产生 34 而非历史 3。仅把 nextFactId 前提改为 `2 + eventsPerCommand`，奖励顺序/收据语义不变。
4. narrative 默认新增 `bonfire.rested:false`：隔离旧内容的对应原测通过，只补精确 false flag，旧结局断言不变。
5. combat 版本 1.4→1.5：隔离副本仅回退四处生产版本字面量，176/176 原测通过；更新四处历史版本期望。
6. bonfire 的8组合原测认为 narrative namespace 完全不变：隔离副本只移除 `bonfire.first-rest` 新订阅后8组合通过。候选保留完整 namespace 深比较，只增加确切的授权 flag、revision、lastFactId 和唯一六字段收据，其他 ledger 断言原文不变。

## 验证状态

开发期独立模块结果：growth 35 文件/641 项通过；最终合并候选限定范围154文件/2914项通过，包含一次原期限下的单文件串行复跑，详见最终表。3g 不重录原生生成基线或 UR 黄金 trace；giants 三份 trace 仅因 foundation 版本信封变更重录 extensionsHash，见后文。完整 npm test、全部 test:ext、实际删除矩阵、CE full/gen 依维护者指示保留给 4f 统一收尾，不能以本步功能集合冒充全量通过。

最终候选、逐命令退出码/耗时、941份输入散列、154个相关文件清单与复跑原因：`evidence/phase3g-final-gates.json`。


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

Compact evidence: `evidence/phase3g-p4a0-attribution.json` (52 checkpoint old/candidate hashes, changes, alias/native verdicts, source restoration and test commands/exit codes). Raw graphs remain outside the repository under `/tmp/p3g-p4a0-audit/`.

Actual final capture: original `P4A0_CAPTURE=1 npx vitest run src/test/phase4a0_spatial_differential.test.ts --maxWorkers=1` passed 4/4 in26.29s, exit0. Independently verified exactly117 expected digest/count leaves changed, empty unchanged, and actual fixture SHA-256 equals the predicted `1ef488d3fa2741d410faa363d431a264997f81a2a972cafec77b164eb47fe044`. The original guard/filter/assertions remain byte-identical.

追加严格profile校验后，原4d变形回归发现已闲置的rat仍残留旧fixture.profile且无bundle/action。修复在sourceChanged/finishAction机械边界同步已有闲置资源，保留有效已付款pin，不在load归一化；原生命周期断言保持，64项回归通过。跨grid terrain owner恢复改为先统一清理新增关联再恢复旧关联，防止后处理grid误删先前恢复的owner。独立最终审查未发现剩余阻断。


## Foundation 版本与 giants trace 的单变量归因

冻结 d964453 的原两份 trace 测试（3个场景）原样失败，差异只有 extensionsHash。隔离副本只将8个生产/descriptor文件中的12处 foundation 数字5改回4，其余全部候选代码、原测试、原fixture不动：原trace＋giants contract共3文件6项通过。恢复版本5后依原 `BROGUE_CAPTURE_GIANTS_TRACE=1` 捕获入口生成；再次关闭capture运行原guard＋contract，3文件6项通过，两侧模块边界检查均通过。

实际合入的fixture补丁只有三个 `/extensionsHash` 叶子：
- natural-trace：`deb56ea35e97751828efbca1312be782f191a106efe8b089ffcc77ade1deac7e` → `4c533f91ecec90fe61300c0227a691f7525c3a02a2c39c33a3614078afc2c1fb`
- colossus-natural-trace：`b6a806199e09ccca4cd2dbb67c8c6c6882c9690c29bc665a35b0d0bbcdf8fa79` → `11ed15e6b36f5fcf9f25df660c4f746430c1ba13d9f0771b887c1dd52c07607e`
- spine-natural-trace：`17b2e605c2b224c0e2399df4cfeb2cad3c56dff3ecb5603521109879dca8220b` → `604d53ba075efdb3d73ecc7768211311bfcc47a80d63fc336dafd1f742451bbe`

所有 commands、commandsHash、nativeWorldHash、两RNG/计数、state、boss与适用region字段逐字段相同；不是新行为黄金化。原文件与继承80640d逐字节一致，测试和守卫未改。完整小型证据见 `evidence/phase3g-foundation-trace-audit.json`。

## 冻结门禁早期运行记录（不算通过）

- v1：boundary/type/build通过，natural实跑3失败/2通过，exit1，1180.909s。三个失败全部为上游硬编码 `/private/tmp/p4d3-natural-acceptance.json` 在云环境不存在导致ENOENT，不是断言/timeout；源码933份输入始终不变，后续门未跑。经许可创建 `/private/tmp` 到可写 `/tmp` 的兼容映射并以非提升权限写入探针验证，没有改测试、种子或480s门限。修复后的后两项fresh seek通过，但不能与后续结果拼接。
- v2：同候选boundary/type/build再次通过；确认后续drift三份fixture需要上述纯版本更新后主动中断natural，runner exit130，未算完成，没有拼接前后结果。源码在中断时仍完全相同。
- v3：更新已归因的三个hash后重新冻结，先运行短门与全部相关测试/组合/drift，再独立运行自然长测，所有门顺序串行，仍各保留原deadline。最终结果见最终验证表。


### v3 完整相关集合与修复

v3 boundary/type/build均exit0；139相关文件完整跑完：137文件通过/2失败，2785项通过/2失败，0 skipped/todo，914.970s，源码输入changedInputs=[]。未继续terrain/组合/drift/natural；不算统一验收通过。

- `ext_module_composition` 的16真实标准子集通过，只有附加任意alpha初始化模块失败。3g的snapshot校验遗漏了新`foundation.story.v1`消费者，仍只认旧storyFact hook，导致成长尚未初始化时的合法pending entered-level快照被拒绝并丢失recordingOrigin。修复生产条件同时识别两种注册形式；原组合守卫未改。新增合法pending消费者恢复、无消费者拒绝、仅combat消费者拒绝三个回归。隔离原生产的新正例先红，修复后原composition＋foundation专项＋旧optional rewards共74项及类型检查通过。
- `ux_1d_recording_continuation` 的60秒墙钟负例在候选70d2844和干净80640d1都同样失败：hasCompleteRecording实际true而原断言期待false。98f9d15已明确修复为drain同一已接受iterator、保留完整机械checkpoint；3g没有修改该watchdog。隔离副本只回退98f9d15生产hunk，原测试字节保持相同，负例通过。不能回退该生产修复重引入已付款防御锁/NPC停滞。维护者已明确授权限定夹具修订：仅让负例的expired drain自身抛错，全部原失效/继续记录断言逐字保留，另增正常60秒停帧保持完整录像、保存/加载继续、独立replay世界与RNG一致的正例。实际历史提交98f9d15的父提交a01a8927运行原测试通过、98f9d15运行同一原测试失败；两份原测试SHA-256均为608f81f2ec5a8ad2dfd8e53d9d93362f6a17fc9103a6e6bfcfff2c0a5add3d13。限定修订后完整UX＋animated-defense共32项通过，0 skipped，exit0，52.28s。原反事实证据见`evidence/phase3g-recording-watchdog-diagnosis.json`，实际历史命令/退出码及限定修订证据见`phase3g-recording-premise-evidence.json`。

### 非阻塞查询开销观察

隔离合成微基准通过真实可信actor查询路径测量DTO复制冻结开销：10次预热后200次查询，1行provider state为4.99ms，1000行约79KB state为272.03ms。该结果不是自然局/FPS结论。未采用实验缓存：虽然原型降低重复复制成本，通用正确性还依赖validateWorld回调纯读约定；本步保留直接冻结复制的安全语义，不引入未审计缓存。

## 4e合并前完整冻结门禁（17af360）

v4统一运行全部8门通过，933份源码输入每门前后一致。139相关文件2791项＋自然1文件5项全绿；16个engine-only组合通过；drift4文件5项通过；boundary/type/build/terrain白名单通过。自然长测938.869s，原期限未改。完整命令、耗时、源码散列与文件清单见`evidence/phase3g-pre-4e-gates.json`。维护者在自然长测进行中要求再合入4e的97988d5，因此这些是明确的合并前证据，不替代合并后交付门禁。

## 4e（97988d5）并入与交叉事务修复

维护者要求交付前合入完整4e；先完成原冻结自然长测，再fetch并合并`97988d5`，不打断长测或混称前后结果。保留4e的主动phase/split/clone/summon、显式成员映射与无死亡退休、零奖励后裔、多subject遭遇与可见帧分组，foundation仍为3g分配的5。runtime冲突取已提交事实/actor查询与4e声明冻结/历史校验的并集；成长provider与rewardEligible:false拒奖同时保留，测试清单取并集。

独立预审发现外层3g事实事务缺少4e窄事务已覆盖的光照深状态与Game自身属性顺序。新增真实4e换形成功、后置combat消费者抛错的全对象图回归先红：2291个既有光照颜色引用差异，以及bodyGroups删除/恢复后Game属性顺序变化。最小修复只在checkpointCombatFactWorld增加当前/缓存lightMap深写集，并把Game自身加入descriptor顺序恢复；不重写内部4e事务。新测试`src/test/ext_combat_transition_facts.test.ts`在四模块共同启用时覆盖phase/split、退休来源事实身份、显式成员映射后的可信/伪造引用、全图/原对象身份/动作行/两RNG/ID/模块/事实计数恢复、正常重试、真实stagger及真实玩家命令驱动的主动split后两段attack。

三份giants trace不能选任一侧旧hash。暂用97988d5原fixture，在不可变合并index树`a284120c8ec1b8c2db9c256fed72bc9ee2cb8e31`隔离审计：原测试仅三个extensionsHash失败；只改12处foundation5→4字面量后原trace＋contract3文件6项全绿。恢复5、原捕获入口重录后独立无capture重放与边界守卫全绿。实际只有三个extensionsHash叶子变化，原生世界/命令/RNG/遭遇/区域逐字段不变。精确命令、退出码、源树与新hash见`phase3g-4e-trace-version-evidence.json`；后续Game checkpoint补丁由最终完整门禁再验证。

交叉修复最终专项：`npx vitest run src/test/ext_combat_transition_facts.test.ts src/test/ext_combat_adapter_foundation.test.ts src/test/phase4e_body_transition.test.ts --maxWorkers=1`，3文件66项通过，exit0，40.71s；vue-tsc与diff检查通过。独立合并复核确认6个共享生产文件完整保留两侧增量、22个上游独占文件逐字一致、清单并集无重复、foundation5保持、最小checkpoint修复与4个新回归无阻断。

## 最终合并后开发期门禁

候选 `e6ad385dd7807b6eaae2c689b0d4a65dbecff35a` 已包含 foundation `97988d5cb94196d388f0a53ccac25bf5b1b5ff57`。Node v24.19.0；NODE_OPTIONS=--max-old-space-size=3072；相关批maxWorkers=2，长自然项maxWorkers=1。941份生产/测试/脚本/配置输入每门前后相同，输入映射散列 `79d15959c13f66f518125299a4911fa026f0bbaf44503939f204f2ba0e84f32d`。最终补报告也逐文件核对，无源码改动。

| 门禁 | 实际结果 | exit | 秒 |
| --- | --- | --- | --- |
| module boundaries | 通过 | 0 | 3.917 |
| vue-tsc -b | 通过 | 0 | 22.600 |
| npm run build | 通过 | 0 | 29.582 |
| 153文件相关批 | 152文件/2908项通过，1项原240秒期限超时 | 1 | 1295.077 |
| 原giants_zones_natural单文件串行复跑 | 1/1通过，原240秒期限未改 | 0 | 233.740总时长；测试230.520 |
| terrain白名单 | 1项通过；29项因明确过滤不选 | 0 | 3.559 |
| engine-only组合烟测 | 16/16；requestedScopePassed=true | 0 | 160.253 |
| drift | 4文件5项通过 | 0 | 100.778 |
| giants_composite_natural | 5/5；原480秒单项期限不变 | 0 | 925.887 |

相关范围包括所有growth/narrative/combat/giants模块test清单、全部phase4d_*、全部giants_composite*、4e两份共享专项及3g/4e交叉回滚。最终去重154文件2914项通过，0 skip/todo；drift另计。不能称首轮零失败：`giants_zones_natural.test.ts`在并发相关批实际250.854s超原240s期限，同一候选串行测试230.520s通过，未修改源码/断言/种子/门限。只复跑该项，保留其他152个已绿文件同一冻结输入证据，并继续未执行的后续门；未把4e合并前结果替代合并后结果。

自然D15 seed7309／wizard／only giants 完整杀死原身、broken save续录、逐事件replay和三个fresh seek均通过。engine-only报告的browser=not-run；本轮不声明浏览器/CSS/触控、实际删除矩阵、完整npm/all test:ext或CE full/gen通过。完整联合收尾继续等待4f维护者通知。

## 最新foundation 4f第一部分（9331104）的交付前合并

上述完整154文件门禁完成后再次实查远端，发现最新foundation为`93311044db4c63ea987ff0cf8d623a63d762287b`，因此交付前继续合并，未发布过时祖先。该上游增量不是只有文档：增加确定性的128对LOS预算、片段转换命名、底座自有群体fixture与删除准备。Game/runtime/3g checkpoint未被上游修改，保留完整两侧历史；不执行4f联合全量或实际删除矩阵。

必要fixture适配仅三文件：新`bodyModule` foundation4→5；`combat_adapters`与`ext_combat_transition_facts`诊断声明/安装命名空间迁移到body-fixture。后者原合并后4/4因旧giants fixture不存在失败，适配后4/4通过10.60s，所有expect断言及真实giants四模块split→attack用例逐字保留。combat adapter专项30/30通过，socket zone的nameKey也必须符合新owner命名空间。未放宽生产验证、旧断言或期限，无新增skip。仅修正上游手册末尾多余空行，机械示例不改。

独立审查指定增量范围34文件：全部13份phase4d、两份phase4e、4f audit、LOS直接效应、paid lifecycle、3g foundation/transition/adapters/combinations/parry/part-break、两份growth奖励、giants配置/contract/transition/SFC及所有权/源码/i18n守卫；另重跑boundary、type、build、terrain、真实16组合、drift。上游正式形态均不超过128对，新增audit直接覆盖256→128；未再无差别重跑刚完成的长自然项。完整旧候选证据和最新增量证据分开记录，不称旧输入等于新输入。

最新候选`ba8383596b1043c7340b21d1e94ea2d9419d16fd`增量门禁全部通过：34文件442项，0失败/skip/todo；boundary 3.624s、vue-tsc 20.334s、build 28.365s、相关批 306.545s、terrain 3.829s、16真实engine组合 158.906s、drift4文件5项 102.904s，均exit0。另验证composition --plan正常产出16计划（不将计划算Game验证）。944份输入每门及报告补写前逐文件一致，汇总SHA-256 `e413f3e9c7b2eda7614aac926cf8c25c2afab2a8aee5c1a02c5cffb4c8c702d9`。完整命令/文件/输入散列见`evidence/phase3g-latest-foundation-gates.json`。这份增量证据与前述完整候选证据分别保存，不重复累加测试数。
