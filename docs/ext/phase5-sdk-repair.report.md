# SDK维护者收口（2026-10-12）

独立[R2](phase5-sdk-repair.review-r2.md)通过，R1-C1真实冻结袭击动作合同已关闭，无新确证S1/S2/S3生产发现，无需末修，不开R3。维护者复核最终十路径与被审候选全部一致；本提交收口SDK-1/SDK-2、正式回归与R1响应。仅按R2澄清报告中finish参数为depth=1，不是actionId，未改任何源码/测试。

正式SDK三文件24过、隔离原seed23/118及完整存读4过、相关生成/动作224、growth65、combat74、守卫86、drift14各套通过；C1新文件2过、既有raid28过、归属6过及types/boundary通过。各套不累加重叠，保真实首败与单变量反事实，不把wrapper exit0中的预期失败称通过。具体身份、计数、过滤、来源及限制见两轮审查。C1不构成新增XP死亡奖励证据；有限性能样本不等于最大ledger性能已验，恢复器自身异常的原有边界保持。

收口后按用户授权推送ext/phase5，再依次集成固定narrative2 1d0d900与combat2 4ea702c，关闭原失败、组合及自然证据待办。完整npm/ext/drift、128启用和15物理删除在最终组合候选统一跑，不沿用旧5Z结果；Claude最终人工待验。XP skip、5D3另案。

以下作者阶段记录中的“待R2/未收口”由本段覆盖。

---

# SDK-1 / SDK-2 作者实施报告

当前状态：READY，交父安排独立 R2。R1-C1 已补正式 settlement 归属回归：真实有效 raid 的付费 windup/待释放段，生成子回滚、跨层冻结、完整冻结存读及返回单次完成，两条路径均通过；现有 raid 整文件28项、membership6项、types/boundary也通过。SDK1 单变量撤回时新原文件两项均在 ledger 身份断言首败。本次没有生产修改，R1原八路径身份保持；这不是独立R2通过或SDK步骤已收口。R1无确证S1/S2/S3，SDK2及无关既有批次不重跑。末节记录C1全部结果与限制。

R1前历史状态：READY（SDK-1/SDK-2生产修复、正式回归与相关复测完成，交父安排独立R1；当时尚未独立审查）。以下原实施证据保留。本步骤是六项收口后的独立 SDK 小底座；作者未派代理、未 commit/push/merge/tag。生产基线为 `63a279e`；实际归档开工 HEAD 为仅追加父文档的 `6954ee770a92e2dec6bc79a53e5245e42561f6de`，其相对 63a279e 只改 commander-status、六项报告及本任务书。作者未修改这些父所有文件。

已完整读取任务书、执行根 pipeline-supplement-20261011.md、AGENTS.md/HANDOFF/development/architecture，以及固定 `4ea702c0fce7a25cea9be0bf92b27dbd3ff29677` 的 combat2 acceptance 和三份 SDK 草案（git show，没有合入）。草案仅作为根因参考，正式回归与实测如下。

## 生产实现与保持的边界

- `src/ext/runtime.ts`：每个 GenerationFrame 在 beginGeneration 保存既有 checkpointActorStateIdentity 恢复器。rollbackGeneration 恢复模块值后立即恢复原活 ledger 及其全部子对象，再继续资源、其它模块状态、统计和事实回滚。嵌套子提交后父失败使用父自己的检查点。复用普通事务已经存在的对象图恢复器；无新增 Game 字段、随机数调用或缓存世界遍历。
- `src/ext/modules/growth/module.ts`：deathCaptured 显式投影 id/name/hp/maxHp/x/y/player/monsterId/allied/hostile 十字段。保留 origin、administrative、rewardEligible 过滤和奖励结算；合法 ActorFacts.movementRegionId 不进入持久 DTO。没有改 growth/state.ts、schema/version、来源过滤或 GC/收集逻辑，无旧档迁移。
- 未删除 metadata、未放宽 ledger/scheduler 镜像、存档或录像守卫；未修改任何既有测试断言、前提或 skip。XP skip 保持，5D3另案。bonfire/jackal 内容绑定和自然 giantHit/zombie 缺口留内容集成，本步没有改这些内容。

## 正式回归归属

新文件分别登记于根、growth、combat 三个 test-suites.json（最终24项：根11/growth11/combat2）：

1. `src/test/ext_generation_actor_identity.test.ts`：独立底座 actorActionProtocolFixture，每次显式安装独立 descriptor，即使真实 combat 已安装也不借用其内容。覆盖 no-op/真实修改后子回滚、嵌套提交后父回滚、其它模块发布异常、并发 NPC/玩家、多来源资源、真实休息、缓存 NPC 冻结及返回完成。独立对象图 oracle 检查所有值、引用/数组/子对象身份；检查后续结束与真实 save/load，完整快照只同步 savedAt。另测有界检查点、实际原生楼层生成及 session/ledger 同一对象、每次离层/入层精确两次revision增量，以及撤掉 fixture 后真实 registry 拒绝其 save/recording（不掩盖真实缺包/规则身份校验）。
2. `src/ext/modules/combat/tests/combat_sdk_generation_identity.test.ts`：真实旧 fixture.stomp 付费公开命令、no-op blueprint rollback、后续推进和存读；实际复合体多个付费来源完成。诊断复合体声明/种类绑定只在测试隔离 registry，未改生产数据。
3. `src/ext/modules/growth/tests/ext_growth_death_projection.test.ts`：严格原工厂 DTO 复现；movementRegionId/任意 extra 字段写入持久 DTO 的负例仍拒绝，rewardEligible=false 仍无 pending。独立 square、fixed-zone、composite-core × 玩家/盟友/行政死亡九场实际 Game 路径；保 origin、行政标记、27全奖、21/6分成、重复收据、重复收集幂等及完整存读。只安装 growth 和独立 body-fixture，不依赖 combat/giants。

## 首败与归因（全部为本步真实执行）

执行根：`/private/tmp/brogue-commander-20261009-5z/`。所有长门禁经 launch-detached.py + run-child.sh 独立 OS session/nohup、文件 stdin/stdout、done；Node v24.19.0、NODE_OPTIONS=--max-old-space-size=3072、Vitest --maxWorkers=1 --no-file-parallelism，重负载串行。

| 批次 | exit | 实测 | 裁定 |
| --- | ---: | --- | --- |
| before-public | 1 | 原 combat2_sdk_repro 整文件 2败 | seed23 第91公开输入 metadata/scheduler mismatch；seed118 第152输入 Invalid module state: growth。原输入与初始命令未改、未换 seed。 |
| before-formal 初稿 | 1 | 20败/1过 | 8项错误 labelKey 所有权、复合体尚未配置合法 native 绑定等新夹具搭建错误，原日志保留，不冒称20生产缺陷。 |
| before-formal-valid | 1 | 20败/1过 | 修正新夹具后实际 ledger 身份和区域 DTO 首败；父回滚两项另发现初始模块计数断言布景错误。 |
| before-formal-final | 1 | 20败/1过 | 修正模块初始计数记录后，两SDK根因都在正式回归真实复现。 |
| fixed-first-formal | 1 | 17败/4过 | 所有身份/死亡检查已越过首败，17项到完整存读后因诊断 arena 没刷新原生 FOV 而失败；没有裁快照字段。 |
| fixed-first-public | 0 | 原整文件 2过 | 首次生产修后原 seed23/118 完成，仍不是完整持久化补充证据。 |
| fixture-fixed/sdk1-off/sdk2-off | 各1 | 各1过/1败 | 三个完全相同的诊断命令，分别只撤一个生产文件；未刷新各有1939个相同 isVisible 叶差异；刷新后全部快照零差。证明诊断几何修改的观察前提独立于SDK修复。只补新夹具 updateVision，完整值断言保持。包装脚本exit0只表示三配置执行结束，不把内部exit1记作通过。 |
| fixed-formal-v2 | 0 | 3文件21过 | 新回归修正合法视野布景后全过。 |
| cause-sdk1-off | 1 | 3文件11败/2过 | 外部隔离树仅回退 runtime.ts 到同生产基线：根8/旧stomp与复合来源2/原seed23共11败；独立生成性能与原seed118过。 |
| cause-sdk2-off | 1 | 2文件11败/2过 | 仅回退 growth/module.ts：区域DTO10/原seed118共11败；无可选字段DTO与原seed23过。 |

单变量实验只在独立外部归档树改对应生产文件，未回退主工作树，结束后恢复两处最终生产文件。两个 cause wrapper 的exit0表示预期失败批次全部完成，实际每套Vitest exit1如表。常规批次/最终批次的前后生产 SHA256 在 foundation-sdk-*.results.json；早期 cause/fixture runner 记录逐套exit和唯一回退路径，其源码哈希按明确 copy/git-show 操作重建于 foundation-sdk-cause-source-identities.json，清楚标注重建而非事后冒称现场捕获。末次 performance/revision/cause-final 对照另实际捕获逐套前后源身份。首败大日志留/tmp，不入仓库。

## 隔离 combat2 原场景

`foundation-sdk-external-tree/` 为实际 HEAD 归档加固定4ea702c的 combat 包，再复制本步两处SDK生产修复；其余内容仍是phase5，没有 narrative2，也没有将 combat2 合进主树。原 combat2_sdk_repro 文件、seed23/118 fixtures 和全部初始命令保持原字节。增加外部持久化诊断只续原安全prefix与原attempted，保存/读取完整原生快照，不抽掉失败seed、不用0OOS替代值比较。最终原文件2项和新增完整存读2项均通过（下表 public-persistence）；完整 expected/actual 在 foundation-sdk-public-seed23-full.json.gz 与 foundation-sdk-public-seed118-full.json.gz，实际逐对象深等，不只比较 hash 或0OOS。

## 最终受影响门禁

最终主批次 `foundation-sdk-final-v1`（wrapper PID68425）；末次只新增同因根回归，三个完整SDK文件与types已补验，下表列明两次正式结果不累加。源清单 `foundation-sdk-candidate-before-gates.json`。各套独立列数，不累加首败/复测或重叠 drift。此处只引用本步运行，不借5Z通过。

`foundation-sdk-final-v1.done` 实际 exit=0，全部11套结束；没有并行重负载。表中的 c4a 名称过滤独立列出，不作真实 skip。

| 门禁（本步完整受影响文件，非完整全套） | exit | 文件 | 过/败 | 真实 skip / todo / unhandled | 名称过滤 | 用时 |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| 正式 SDK 回归（追加修订号回归前） | 0 | 3 | 23/0 | 0/0/0 | 0 | 19.17s |
| 末次正式 SDK 回归（最终源，覆盖上行） | 0 | 3 | 24/0 | 0/0/0 | 0 | 20.74s |
| 末次 types（新增根回归后） | 0 | — | — | — | 0 | 8.85s |
| 生成/动作生命周期 | 0 | 12 | 224/0 | 0/0/0 | 0 | 93.39s |
| growth 来源/奖励/GC（含整个 giants2_foundation） | 0 | 6 | 65/0 | 0/0/0 | 0 | 57.74s |
| 旧 combat 生命周期/多来源/篝火/实际 scheduler trace | 0 | 4 | 74/0 | 0/0/0 | 0 | 60.91s |
| 源码守卫/整局存档/模块边界与删除策略 | 0 | 7 | 86/0 | 0/0/0 | 0 | 27.19s |
| 隔离原公开输入 + 完整存读 | 0 | 2 | 4/0 | 0/0/0 | 0 | 25.11s |
| module boundary | 0 | — | — | — | 0 | 2.42s |
| vue-tsc -b | 0 | — | — | — | 0 | 9.15s |
| 实际 Vite production build（前套已独立 types） | 0 | — | — | — | 0 | 3.34s |
| c4a 三个读源码守卫 | 0 | 1 | 3/0 | 0/0/0 | 27 | 2.08s |
| 实际相关 drift | 0 | 7 | 14/0 | 0/0/0 | 0 | 157.22s |

所有实测正向最终套件无失败、真实skip/todo或报告的unhandled；无 CE 提示不代表执行了 CE 专属门禁，未将名称过滤27项计作真实skip。每套 before/after 的两处生产哈希相同，主树八路径候选散列也保持。`foundation-sdk-final.summary.json` 与逐套 raw/reporters 在执行根。

没有跑完整 npm test/test:ext/128启用组合/15物理删除、CE fetch/full/gen；最终组合和人工由父按补充合同另排。本步不冒称最终组合或人工验收通过。

## 性能与实际生成的两叶归因

- 活付费动作的60次嵌套 begin/rollback/commit，前10次预热、后50次计时：P50=0.050292ms、P95=0.060459ms、max=0.065792ms。结构守卫确认没有 projectWholeRun 调用，完整活对象图保持，后续结束/save/load通过；不是新放宽的墙钟门限。
- 真实原生生成：独立串行同入口、同seed23/118/7397、D2-D4共9样本，只撤SDK1 runtime.ts。基线median148.028ms/max188.001ms，修后median157.426ms/max201.222ms；9样本有限，仅给实际测量，不宣称硬件通用性能阈值或零耗时。两套均exit0、各1过、0真实skip/todo/unhandled；每套8项名称过滤单列。`foundation-sdk-perf-v1.done` exit0，逐套源码前后相同。
- 不冒称9份完整快照全部相同：7份完全相同；seed23 D3仅 `extensions.modules.combat.revision` 4→5，D4仅该叶5→7。完整JSON逐叶对照保全部缓存/世界/RNG/模块字段，除此零差；压缩完整对象与两叶在 foundation-sdk-perf-{sdk1-off,fixed}-*.json.gz / foundation-sdk-perf-23-{3,4}-leaves.json。首次将cause批内性能与正式批对照的两处hash差异也保留，随后同入口独立采完整对象落实上述两叶，没有归一化删除revision。
- 实际因果观察器只撤同一个runtime.ts：SDK1-off在D2首次 `rollback blueprint` 后 session/live身份失配（revision当时都为2）；后续D2/D3/D4 live/session分别3/2、4/3、5/4。修后全部同对象，分别3/3、5/5、7/7。`PhasedAttackProduction.ts` 的真实 leftDepth 闭包每次 bumpRevision；旧失联ledger使离层增量丢在旧对象，新实现把合法增量写入活持久状态。进入层的独立 protocol placement 也正常每次增一。不是生成RNG/地图变化。
- revision因果原探针单变量off整文件exit1/1败，fixed整文件exit0/1过，0真实skip/todo/unhandled，wrapper只表示执行结束。补入根正式回归检查真实session/ledger身份、每层精确revision+2及完整save/load；末次3完整SDK文件实际24/24过、0skip/todo/unhandled，vue-tsc补验exit0（foundation-sdk-revision-final-v1.done exit0）。只追加这个同因根回归，生产两个文件与已通过完整受影响门禁相同，没有重跑不受影响批次。

既有相关drift14项全部通过，没有生成基线/黄金trace文件变化或重录。诊断两叶逐字段归因留在本报告，不把不等完整hash写成相等。

末次最终根文件单变量回退也实际完成：仅撤runtime.ts、最终11项原封不动，exit1/9败/2过（8个既有身份场景加新增真实生成场景失败，独立生成性能和真实registry拒绝过）；0真实skip/todo/unhandled，日志和两处生产/根测试的前后SHA256在 foundation-sdk-cause-final.*。没有把新增正式回归只留为静态推断。

## R1前最终源码与交付（历史记录）

两处生产最终 SHA256：

- runtime.ts：`df45a559a86729e910d23150ac9c33f87f603e543a0c0ee09d3b6925ad525e3b`
- growth/module.ts：`6f22517d300af369a85af51da396102e6cbd1d4481eb9b1dc356533e00c4c99e`

最终八路径清单在 foundation-sdk-candidate-final.json；所有派出的12个长批次done已核，预期失败保原exit1，正向最终门禁均exit0。最后主门禁之后仅添加同因根测试，生产/三个套件登记/其它两新测试未变，24项整文件及types补验同源。报告与进度/READY是结果文档，不混入代码身份。

无本步已确认未修复阻断。READY只交父安排独立R1，最多R2由父安排；作者未派审查或代理。未commit/push/merge/tag，未改commander-status/dispatch/monitor/quick-check/任务书，未合narrative2/combat2，未主动CE fetch/full/gen，未跑最终完整npm/test:ext/128/15。已有XP skip保持、5D3另案；内容/组合/删除布局/Claude最终候选人工仍按父流程后续完成，不借旧5Z验收。

## R1-C1 响应：真实冻结袭击动作

已完整复读执行根 `foundation-sdk-r1.final.md`、已入库R1报告、SDK任务书/本报告及 `pipeline-supplement-20261011.md`。本次只响应C1；R1没有确证S1/S2/S3生产发现，没有证据改既有生产。R1报告及任务书保持父所有，未修改。

### 两条缓存路径与测试归属

- 原根回归普通rat离层后进入 `break-recovery`，核普通缓存恢复与结束；保留原名称、布景和断言，八路径R1候选全部不变。此前所称“缓存NPC冻结”只表示该路径的缓存时钟冻结，不代表袭击攻击段被保留。
- 新 `src/ext/modules/settlement/tests/settlement_sdk_generation_raid.test.ts` 登记在 settlement `test-suites.json`。根测试没有硬导入可删除settlement。真实settlement规则开启raids，先通过公开命令支付home、招募resident，再推进权威世界时钟和等待，生成真正active raid及原生成员；检查budget、event和 `validateRaidReferences`。没有直接写raid ledger、冻结ID或伪造袭击身份。
- 组合协议明确隔离：仅将测试registry的可选combat descriptor替换为根所有 `actorActionProtocolFixture`（0.0.1及自身规则指纹）；settlement仍使用真实descriptor/准入。测试实际原生rat/kobold决策支付4点、建立双段攻击（windup80、首步后剩79；两段待释放），不借combat2内容、也没有提前合包。这是SDK与袭击生命周期组合回归，不冒称自然内容trace。

离层使用真实公开楼梯命令及确认，raid根进入pause，真正 `frozenRaidActors` 和 `actorActionWorld().frozenRaidActorIds` 包含该成员，从而走生产 `preserveOnDepthExit` 分支。完整原bundle/metadata/resource/native状态保持，明确无break-recovery。随后实际 `beginGeneration('floor') → beginGeneration('blueprint') → rollbackGeneration(child) → commitGeneration(parent)`；全ledger值、独立整个ledger/root对象图oracle、action/resource子对象引用、root/scheduler引用、资源/metadata/动作镜像及守卫均核对，RNG和整个 `toSaveSnapshot()` 零差，仅 `savedAt=0` 同口径。

另一层真实世界推进96000并wait六次，攻击/资源/原生ticks、HP、位置和全部statusDurations仍等于原值；nextActionId、raid事件/ordinal、loss、营地消耗和gold不变。冻结时保存包含全部缓存/世界/模块的原生完整快照；两项分别真实 `h.load` 替换会话，或在Game原生 `withReplayCandidate` 范围实际 `candidate.loadSnapshot` 后恢复全局服务。后者保留原活scheduler/ledger/action/resource和旧结束闭包，没有用mock解码器替代存读。两者均完整深等，无裁字段。

真实返回后raid解除pause，原攻击值仍保留；未替换会话的一项额外检查原scheduler/ledger/action/resource引用。仅准备原锁定攻击格上的合法玩家目标，生产scheduler实际推进原两段，释放顺序必须为 `[0,1]`，原生成员两次原生近战，结束回调精确一次 `[actorId, depth=1, elapsedTicks=180]`；原action/bundle清除，原费用不重收、只按50tick恢复阶段正常回2点，nextActionId及袭击经济值不变。完成后再次真实load完整快照，metadata不复活。本回归没有杀死袭击成员，也未安装growth；奖励不重计证据限于袭击事件/消耗/loss/gold没有重复结算，不扩称新XP死亡奖励覆盖，SDK2既有收据/奖励证据不重跑。

### 保真首败与单变量归因

全部原日志/JSON在执行根，无skip、todo或名称过滤；以下失败均真实保留，不作产品缺陷计数，不据Vitest“改用deep equality”提示放宽身份断言。

| 批次/内部命令 | exit | 过/败 | 原首败与处理 |
| --- | ---: | --- | --- |
| c1-first | 1 | 0/2 | wait后玩家实际在(29,26)普通floor，楼梯命令未离层（depth1≠2）。 |
| c1-stairs-diagnostic | 1 | 0/2 | 记录实际入口、无锁/无确认/无advancement错误，windup剩79。 |
| c1-stairs-sdk1-off | 1 | 0/2 | 外部树只撤runtime.ts，原入口首败和诊断值完全相同，证明不是SDK1修复造成；counter wrapper exit0仅表示完成。 |
| c1-stairs-prepared | 1 | 0/2 | 新布景在wait后重新准备真实楼梯入口，越过离层/回滚/存读；返回后期望2次接触实际0。 |
| c1-contact-diagnostic | 1 | 0/2 | 原锁定目标(30,25)，原生返回落点(30,24)，原结束回调已经恰好一次180；目标格空，合法生产过滤未接触。仅准备原锁定格上的目标，不改metadata/敌人/断言语义。 |
| c1-target-prepared | 0 | 2/0 | 两段接触和单次结束通过。随后增加返回时旧会话引用断言，最终原文件如下独立对照及正式整文件均执行。 |
| c1-sdk1-off（最终原文件） | 1 | 0/2 | 仅撤runtime.ts到6954ee7生产基线；真实冻结raid子回滚后live ledger值相同但身份不同，首败 `state.toBe(ledger)`，两项同因。 |
| c1-isolated-fixed（最终原文件） | 0 | 2/0 | 同一个完整新文件、同registry/布景，恢复SDK1后全闭环通过；cause wrapper exit0不把上行内部exit1记作通过。 |

入口修正沿用既有真实raid冻结测试的合法楼梯布景方式；返回修正只补实际目标接触前提，保两段接触、单次结束和完整快照原断言，不弱化守卫或门限。外部 `foundation-sdk-c1-tree` 为当前HEAD归档加原八路径候选和两个C1路径，不含combat2。对照逐套before/after实际记录四路径SHA；只有runtime一个生产变量，growth及最终测试/登记相同。SDK1-off runtime哈希 `8419ddfde696bbd9671d33dc58ff65925389a604472f6f41a2c28dfb95d2ef0b`；结束后隔离树也恢复最终生产。

### 最终相关复测与命令

Node路径 `N=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`，实际v24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`。Vitest命令均为 `N node_modules/vitest/vitest.mjs run <整文件> --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=<执行根对应vitest.json>`，无 `-t` 或其他名称过滤。真实skip/todo来自JSON pending/todo及逐项状态；unhandled列表示raw未报告，JSON不含独立unhandled计数键。

| 内部命令/完整目标 | exit | 过/败 | 真实skip/todo/报告unhandled | 名称过滤 | 用时 |
| --- | ---: | --- | --- | ---: | ---: |
| c1-sdk1-off：新C1整文件（隔离树） | 1 | 0/2 | 0/0/0 | 0 | 6.60s |
| c1-isolated-fixed：新C1整文件（隔离树） | 0 | 2/0 | 0/0/0 | 0 | 8.73s |
| c1-formal-final：`src/ext/modules/settlement/tests/settlement_sdk_generation_raid.test.ts` | 0 | 2/0 | 0/0/0 | 0 | 8.72s |
| c1-raid-lifecycle：`src/ext/modules/settlement/tests/settlement_raids.test.ts` | 0 | 28/0 | 0/0/0 | 0 | 98.86s |
| c1-membership：`src/test/test_suite_membership.test.ts` | 0 | 6/0 | 0/0/0 | 0 | 0.44s |
| c1-types：`N node_modules/vue-tsc/bin/vue-tsc.js -b` | 0 | — | — | 0 | 9.08s |
| c1-boundary：`N scripts/check-module-boundaries.mjs` | 0 | — | — | 0 | 2.36s |

不累加诊断、反事实和重复复测为覆盖总数。SDK2、六项及未受影响的224/65/74/86/drift/原seed23和118批次没有重跑；没有最终完整npm/ext/128/15或CE fetch/full/gen。只追加测试/归属，没有生产、黄金或生成基线变化，无须重录。

### 身份、子进程与R2交接

最终新测试SHA256：`f660ef0bf45c8c6752bb1c27787af89c95630e688961280871ade374cfcc8cd4`；settlement登记：`d15c651cc60fc5a32d33c31fac91848d1b92740df4e2efcc65afee9ea58ee71f`。最早新测试哈希 `8b2d12d6a12bd34c4231950e342854ae6092413f51f8d9e767afcd5bfa6c0ff1` 保存在source-before，明确不同于修正布景后的最终文件。最终十路径与 `foundation-sdk-c1-candidate-before-gates.json` 相同，原八路径与R1清单逐字节相同；两生产哈希仍为上节值。各正式内部命令before/after生产身份相同；最终原文件和登记在cause对照前后相同，交付时十路径复核相同。

八个新批次都由 `launch-detached.py` + nohup/run-child独立启动并写done，Node重负载串行：first(71195)/stairs-diagnostic(71253)/stairs-counter(71338)/stairs-prepared(71384)/contact-diagnostic(71469)/target-prepared(71521)/cause(71609)/final(71656)。八个实际done齐全；first/diagnostic/prepared/contact wrapper保exit1，counter/cause wrapper exit0但其预期失败内部命令保exit1，final五套全部exit0。结束检查进程表未见这些wrapper或C1门禁子进程，无作者门禁PID待交接。summary、逐套results/commands/raw/JSON和最终十路径清单在执行根，未巨量封存到仓库。

保留R1限制：60次小图及9次固定顺序原生生成只是有限样本，捕获成本随ledger图增长，最大ledger负载未测；没有承诺恢复器自身抛错还能原子完成后续清理，未找到合法输入触发该异常。本次不扩改生产或扩性能合同。新的物理删除布局、内容集成/全量及人工未验；XP skip、5D3另案、giantHit/zombie及bonfire/jackal仍按父后续集成。

**作者裁定READY，仅交父独立R2，尚不宣称审查收口。** 执行根已写 `foundation-sdk-r1-fix.progress.md`、`foundation-sdk-r1-fix.READY.md` 和 `foundation-sdk-r1-fix-candidate-final.json`。唯一作者没有派代理/审查、commit/push/merge/tag，也未改父专属commander-status/dispatch/monitor/quick-check/任务书/R1报告；本次无新已确认生产阻断。
