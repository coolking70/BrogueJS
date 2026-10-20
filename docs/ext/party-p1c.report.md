# Party P1c 实施报告

最新性能追查（2026-10-20）：P1c已提交 `006cd7d`、未发布。本次工具修复及限定测试完成，party/window云端校准已登记；AI仅完成修复后短冒烟，非party all/full回退仍未关闭。本地存在系统休眠污染，详见“性能与维护者派发”最新节。以下功能实施/审查记录保留当时身份与状态，其中“未提交/待云端”措辞不代表最新性能状态。

2026-10-20；维护者 C1–C7 于 **2026-10-18 全部按推荐批准**，已先回填任务单。开工为 `ext/party-p1a` / `075b7eb` 干净工作树。本次不 commit、不 push、不派发云端。候选仍是未提交差量，不能把 HEAD 当作可检出的 P1c 源码。

状态：初次实施的功能代码、限定自动门禁、历史内部 R1/R2 修复及本地 party 三套工具冒烟已完成。2026-10-20 第1轮独立审查另报 N1–N3，作者处理与本轮证据见“审查发现处理”；独立复审尚未执行。正式云端三轮、浏览器/真机、发布分别待维护者；旧party/window跨格式A/B适配器及AI正式计时的无路预算/受命同伴场景尚缺；额外本地phase6冒烟被原Node24守卫拒绝，均未冒称通过。

## 实现和裁定

| 裁定 | 实施 |
| --- | --- |
| C1 | 默认全人工；手动有限窗口；显式混合单步推进到最近人工决策点，1000 tick/1024决策上限；全AI单步拒绝并提示窗口 |
| C2 | local:0 始终有管理/答待决权限；busy/frozen/pending可登记；最后请求胜出；同值不改变revision/录像；空闲原子边界应用，旧tail清理；human生效清临时AI |
| C3 | 本窗计划及软反应独立 temporaryAiSeq；暂停原tail/cursor，同seq待决恢复；窗末/死亡/换层清理；stop和硬停优先 |
| C4 | 五档及默认设置、25%治疗阈值、恢复品白名单、稳定派生选择、累计4096节点、实际失败完整回滚后一次正常wait，均入规则指纹 |
| C5 | 明确多选接收人；五类目标及取消；人工须先托管；原生盟友唯一decision owner；居民/raid/俘虏/非owner拒绝；显式移交队长 |
| C6 | party F23/S10/R7/O5、module0.3.0/state3；无party F20/S7/R4/O2保持；旧party不迁移 |
| C7 | 新party-ai-v1 B校准/report-only；旧strict摘要比较保留；phase6 D6不改。跨格式适配器欠缺、正式云端待维护者，未转成通过 |

foundation `PartyAi.ts` 负责控制生效、资格和合法已知投影；模块 `PartyAiV1.ts` 只接分离 DTO 产 ActorIntent。成员复用原 actor prepare/commit；同伴在原NPC决策点经过一次原生prelude，再由原生攻击/whole-body移动执行。没有临时替换Game.player，没有新增Game机械字段或第二套计时。

新增权威字段均在既有party整根：成员 controller/pendingController/controlEpoch/temporaryAiSeq/ai；同伴 companionOrders；窗口 singleStep。HP、库存、长动作仍在原native/actorActions根。U03和recording-digest合同注明整根覆盖；原完整属性/对象图及生成写集不裁减。快照验证包含同伴当前层、盟友、非俘虏、非居民/raid及唯一body owner身份。

协议逐消费者：partyIdentity、descriptor/manifest准入、RecordingV4头/有效foundation、WholeRunSnapshot v10、origin5、checkpoint/Worker摘要一致。创建配置与模块初始化state仍schema1；actor-step/control/decision仍schema1；window/policy升级schema2；party:ai独立schema1。world5.schema6及未改模块版本不变。

UI补永久/待切换/本窗托管状态、五档及开关、明确接收人列表、五指令与取消、地图选点、人工接管/队长移交/显式推进；全部文案i18n。map callback绑定root/revision/focus，旧回调失效。预演采用同一纯策略、隔离ordinal和合法公开身体格，并标记不确定。地图/触屏真实性留人工清单。

CE依据为本机 `.ce-reference/BrogueCE-master/src/brogue/Monsters.c` 3788–3830附近的原生攻击/耗时路径及项目现有body适配，不把新增AI规则归称CE已有；没有恢复当前package不存在的ce:fetch/full/gen入口。

## 限定自动门禁与证据

环境固定当前Node **v25.2.1**，heap3072MB，Vitest单worker、no-file-parallelism；测试/性能串行。云端workflow仍Node24，两个环境不混作同机性能结论。原始证据统一在 `/private/tmp/party-p1c/`，不提交截图或大于1MB工件。

初批清单：`selected-files.txt`，47个整文件：当时party所有20个文件（AI/控制/环境/占位/旅行/确认/生成事务/Worker/复审回归）；真实创建12配置；无party夹具；U03/摘要/快照/存储/异步/续录/物品录制；foundation/source/module守卫；原生盟友/俘虏；生产body/近战；neutral/slaying保险；actor资源、canvas/通用输入；party/window工具守卫及combat body动作/生命周期。它是影响面清单，不是完整test/test:ext/drift。

```sh
PARTY_P1C_EVIDENCE=/private/tmp/party-p1c NODE_OPTIONS=--max-old-space-size=3072 \
  node node_modules/vitest/vitest.mjs run $(cat /private/tmp/party-p1c/selected-files.txt) \
  --maxWorkers=1 --no-file-parallelism
node scripts/check-module-boundaries.mjs
node scripts/check-test-dependencies.mjs
NODE_OPTIONS=--max-old-space-size=3072 npx vue-tsc -b
npm run build
```

补充集合角安全、拾取、坠层与loot拾取后，最终影响面并集为 `final-files.txt` 的51个整文件（party23个）；不是把重跑次数叠加。最终结果、源/build hash及删除/性能汇总见下方收尾登记。AI输入路线单独命名party-ai-managed-v1。首次失败不删：

- baseline整批含Worker的预跑手动中止exit130；不称通过。`counterfactual-protocol.log`：075b7eb归档副本、原生产+原测试，5文件54项通过（89.89s）。
- `ai-first.log`：新专项误把自身party登记为required，依赖守卫拒绝；修测试登记，不改守卫。`ai-second.log`：18项通过。
- `selected-first.log`：9文件123项，122通过；唯一失败为party_window期望S9/R6，实际S10/R7。基线原断言通过；只更新已批准格式身份前提及window/policy payload schema，未削弱断言。没有重录无party黄金夹具。
- `integration-first.log`：4文件77项，76通过；自然探索160窗未到楼梯。`explore-debug2.log`同seed42延长至650发现窄道follow阻塞；未换seed/添资源/削敌。策略现在优先已知向下楼梯；自然演示两人均明确explore。`ai-final-first.log`：3文件53项通过。后补自然全录制、集合及显式下楼纳入最终文件。
- `selected-final.log`：作者发现新增多格自身占位问题后主动中止exit130，不能算最终有效整批。
- `selected-final2.log`：47文件805项，42文件/779项通过，5文件/26项失败，1421.69s；两项旧敌人入口守卫通过恢复原takeTurn修复；23项body fixture在重建descriptor时套用已变体party规则身份；`baseline-body-inert.log`在075b7eb原生产/原测试同样23失败，非本次引入。两测试仅保留无关party原descriptor，未更改动作/耗时/回滚断言；同批无party五配置字节夹具通过；自然路线新增集合后下楼暴露gather以Chebyshev相邻误把隔墙角当成到达；`natural-body-fix.log`重现，修正策略使用已知对角阻挡投影后再复验，保留原旅行守卫。抵达楼梯后明确人工接管再集合同伴，不改地图/血量/资源。后续整文件复验单列。
- 全删准备时发现既有 `ext_party_inert` 固定五配置需要八旧模块，但原for-of裸数组未被静态依赖扫描发现。只将同一八模块列表写为显式modules配置并登记required，五输入/黄金/断言不变；完整包重新执行，全删用既有文件级缺包守卫跳过。未改依赖扫描器或黄金值；第一次只登记而未显式配置被stale-declaration守卫拒绝，日志保留。
- type修复包括新增探针readonly构造和未使用import；门禁本身未改。中间build通过不代替最终源码build。

## 历史内部审查（不代替本轮独立结论）

历史内部 R1 八项（旧 findings 在本轮独立审查时备份到 `/private/tmp/p1crev1/previous-review-findings.md`）：真实busy管理锁、旧人工绕pending、多格攻击、指令优先级、多人guard、累计预算、隐藏锚点、性能预演污染。作者逐项修复。

[R2](party-p1c.review2-findings.md)独立补查公开contact、冻结恢复、跨层自产拒档、临时AI travel预演、known container隐藏anchor、友军公开占位、多格自身占位和实际rejected回退。全部确证问题已独立关闭；后置拾取/坠层10项也已独立复验，后补集合角安全5项首次全过，合计32项不重叠探针转入共享回归。移动探针首次误将100tick端点两次NPC行动预期为一次，原日志保留，后按实际原生边界精确两格/ordinal2复验；不是修改生产配合错误断言。独立报告列每批源hash/退出码，静态结论与动态覆盖分开。

## 审查发现处理

2026-10-20，按 [第1轮独立审查](party-p1c.review-findings.md) 的 **需修** 结论处理。保留审查报告原文和结论，不将作者回归通过写成独立审查“可合入”。本节 N1–N3 与上节历史内部 R1/R2 分开计数。

### 逐项复现与修复

| 新发现 | 复现与修复 | 新增回归 |
| --- | --- | --- |
| P1c-R1-N1 | 原探针实际抛 NOT_CONTROLLER。`applyIdleControllers` 将成员 native.modal 纳入非空闲；`partyCommandStages` 在重算 modal 后收尾待切换，零耗时取消也到达生效边界，正耗时动作仍等计时/长动作空闲。 | 主/非主成员 wand 选点、游标移动、重复 AI 请求、escape；原生飞镖投掷取消/完成；鉴定/附魔目标回答；已知有害物品确认取消。保存拒绝/完成后存读、逐事件 seed replay、待选中间点与结束点 seek 均比较完整机械摘要。 |
| P1c-R1-N2 | 原探针凤凰蛋 (40,26)→(40,27)。接单资格与行动能力分开；IMMOBILE/TURRET 在同伴策略入口退回原 native remainder，保留同一次 prelude 后的特殊能力、身体逐源约束和原调度计时。Game 意图提交与 Monster 同伴近战口也加能力防线，禁止直接适配调用绕过。 | 真实目录凤凰蛋/箭塔，party-only 与 combat 调度；方形与 composite 的两类不可动标记；守点/攻击指令、直接移动/近战适配；断言位置、HP、双流、序号、原生 prelude 次数、箭塔射击与 250tick 攻击耗时（100tick 窗末余150）。同伴存读、续录、逐事件回放、双向 seek。 |
| P1c-R1-N3 | 原探针第二次 human 请求 revision 4→5，epoch 1→2，事件3→4。只有尚无 pending 时，首次 human 才可取消 temporary AI；已有同值 pending 返回 no-op，反向请求仍最后胜出。待决时不提前清 temporaryAiSeq。 | 未布景的开局食物窗口确认；human→同值→AI→同值→human→同值。每个 no-op 比较完整摘要、双流、allocator、完整事件列表；首次/反向 epoch 精确递增。待决保存、恢复后再次 no-op、回答后耗尽剩余计时再生效、续录回放与中间/末尾 seek。 |

新增整文件为 `party_ai_r1_control.test.ts`、`party_ai_r1_companion.test.ts`，登记 party 所有权与依赖；未修改任何旧断言、黄金字节或守卫。三条控制/同伴能力语义进入 `PARTY_AI_RULES` 指纹；格式仍为 party F23/S10/R7/O5，不新增机械字段。旧候选指纹的 party 档不迁移；无 party 身份和原生入口保持。

### 同类排查与证据边界

- 原生待选共用 modal 根覆盖 pendingArcana、pendingUseConfirm、pendingIdentify、pendingEnchantment、isThrowing；目标 UI 与库存回答均回到相同 actor 命令收尾。窗口 decision 仍由原窗口事务收尾，busy/frozen/长动作闸不放宽。
- **保留 P1a 原守卫**：没有 window.decision 的单步 native modal 不允许保存，仍抛 DECISION_REQUIRED，且拒绝不改变摘要。此类测试在回答后保存/载入，并从完整 seed 录像 seek 回待选态；N3 窗口待决则直接存读。没有为了“含存读”删掉守卫。
- 同伴入口逐一检查普通、actorActions、square、composite。不可动怪物退回各自原生分支；MONST_TURRET 用既有 `hasCEBehavior` 展开复合语义；不改全局原生决策、随机抽样或怪物计时。原生麻痹/entranced/actionLock/corpse absorption 仍在单次 prelude/外层 scheduler，混乱/敌对/俘虏/非 owner 仍按原资格拒绝；shape 地形、身体支撑/锁定/束缚由原移动规划验证，攻击接触/资源由原攻击口验证。
- 新测试的 wand/卷轴/怪物与场地是确定性诊断布景，放在真正录像 origin 之前，每次 seed replay 重新构造；没有替换执行器、摘要、codec 或录像事件。飞镖与 N3 食物使用原开局物品和自然地图。布景测试不冒称自然生成路线。
- 本轮仅相关整文件与 boundary/依赖/vue-tsc/build；未重新跑全量、drift、Worker 长链、删除布局、性能或云端，亦未提交。原性能数据只属于审查前身份，不作为修复后性能结论。

### 本轮执行记录

原始证据目录：`/private/tmp/party-p1c-r1-fix/`。

- `before.log`：原审查三个正确行为断言全失败，exit1，3.35s；`after-probe.log`：同一探针未改，3项通过，exit0，3.42s。
- 新回归调试日志保留：`control-first.log` / `control-second.log` / `regressions-first.log` / `regressions-second.log`。首批误把 P1a native modal 当作可存、卷轴 ID/待鉴定物布景不完整、将 Game 构造置于取样前影响全局随机、误用投掷 cancel/confirm 接口，以及把箭塔攻击间隔按普通移动间隔断言，均按原生产接口与规则修正测试前提；未因此改生产或降低摘要断言。N3 回答后有剩余计时，测试明确推进到下一空闲点，未要求提前切换。
- boundary 与测试依赖检查均 exit0，扫描707文件、errors=[]；`git diff --check` 通过。

本轮相关整文件命令（heap3072、单 worker、不并行文件）：

```sh
NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vitest/vitest.mjs run \
  src/ext/modules/party/tests/party_ai \
  src/ext/modules/party/tests/party_actions.test.ts \
  src/ext/modules/party/tests/party_window.test.ts \
  src/ext/modules/party/tests/party_window_decisions.test.ts \
  src/ext/modules/party/tests/party_lifecycle.test.ts \
  src/test/ext_party_inert.test.ts \
  src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts \
  src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts \
  --maxWorkers=1 --no-file-parallelism
node scripts/check-module-boundaries.mjs
node scripts/check-test-dependencies.mjs
NODE_OPTIONS=--max-old-space-size=3072 node node_modules/vue-tsc/bin/vue-tsc.js -b
NODE_OPTIONS=--max-old-space-size=3072 npm run build
```

### 修复后门禁与身份

- `related.log`：**19 文件 / 173 项全部通过**，exit0，202.41s；包含新增两文件16项、已有全部 AI 整文件、actions/window/window_decisions/lifecycle、两个 combat body 整文件，以及原无 party 五配置字节夹具。原黄金夹具/断言未改、未重录。
- `boundary.log`、`dependencies.log`：exit0，依赖707文件、errors=[]；`types.log`：vue-tsc -b exit0；`build.log`：npm run build exit0，Vite 3.53s，仅既有 >500kB bundle 提示。相关测试日志另有 Node localstorage-file 警告，不是失败。
- 修复后源码 SHA-256：`65d56f6f50e9d2677b8ff0150449e5b89a0cc2ea58eb59b67cd18a373b21dbc1`；dist SHA-256：`7e6e25f9a8182d60fbbe4837a0b16f746f4d468ac890aee370da00188c6c4422`。范围/算法与审查前一致；完整清单为 `/private/tmp/party-p1c-r1-fix/source-manifest.json`、`build-manifest.json`。
- `source-delta.json` 对审查前 `8b64f05a3f807d4caa42f8728e312b30695d4cc604c39e65890c03b869bf3ee8` 核验：源码集合只变更8文件，即 Game/PartyAi/Monster/partyAi 四生产文件、两新回归文件和两测试登记文件。另更新本报告与人工清单；独立 findings 原文未改。
- 分支仍为 `ext/party-p1a`，HEAD仍为 `075b7eb10c87394fa5497fca3ff98e4ff63ac3c6`；没有 commit/push/云端派发。本轮作者处理结果为 **N1–N3 已修复并通过限定回归，待独立复审**，不替审查人改“需修”为“可合入”。

## 验收矩阵

| ID | 证据/边界 |
| --- | --- |
| C-A01 | 1/2/4人有限AI、no-op、epoch/revision/资格拒绝；真实phased busy、冻结回层、全AI接管由专项与复审覆盖 |
| C-A02 | 复用既有party时间/环境/occupancy/window边界整文件；原生body tick0/100唯一owner已测，不另造速度体系 |
| C-A03 | 五档纯策略、已知恢复及自身库存、危险/未知/占位、累计4096、stale memory实际失败wait；保守路径可能无路等玩家处理，不保证所有免疫/复杂地形最佳路线 |
| C-A04 | 纯派生决策、预演零污染；隐藏body pose/anchor等已知投影对照、完整双流和allocator回滚 |
| C-A05 | 本窗tail暂停、真实非主成员食物待决save/load/同seq续段；stop/hard规则及确认整文件 |
| C-A06 | 成员/同伴指令、guard邻位、目标失效与取消；生产composite攻击及右/下移动、资格/codec坏引用拒绝；招募不开放 |
| C-A07 | seed42普通双人自然探索，无改图/改血/赠物；450窗上限到向下楼梯，再有界集合、人工显式下楼、恢复AI、完整save/replay；真实菜单12配置链独立测，不能拼称浏览器实测 |
| C-A08 | 既有事务/生成/跨层/环境/资源整文件；新pending恢复、同伴换层、AI失败原图/双流/id回滚 |
| C-A09 | AI混合save/replay/seek/续录、篡改/旧格式/缺包守卫；自然原录像在仓外 |
| C-A10 | production Worker 1/4人256/2048等边界加入真实AI切换；既有async栅栏/降级/完整性和预演整文件 |
| C-A11 | MainMenu动态12配置、一次new-game、manifest/initialCommands、party托管→发令→窗口→接管→save/replay/seek/续录；SFC不等于浏览器 |
| C-A12 | 既有五配置逐字节夹具不重录；physical retain=none九目录删除、真实AI/pending+temporary/loot档与录像拒绝；只验这一删除布局 |
| C-A13 | R1→修复→R2已闭环；本地分层/rounds1冒烟另列；正式云端、跨格式A/B、浏览器、发布均不混作通过 |

## 性能与维护者派发

### 云端结果复核与工具修复（2026-10-20，开工 HEAD 006cd7d）

本节覆盖下方首次实施时的“云端未派发”状态。分支 `ext/party-p1a`，开工完整 SHA `006cd7d7ef357c15572af1f7daa2588dd826963d`；本次不 commit/push，不改 D6 或冻结预算。原始下载在 `/private/tmp/perfci-{runId}/`，本地追加证据在 `/private/tmp/p1c-perf-followup/`，均不提交。

#### 非 party phase6：工作量相同，原 regression 保留

[run 39338476889](https://github.com/coolking70/BrogueJS/actions/runs/39338476889)，A=`72aa412c0c2a20dba316df01b33993cd6f88976d` → B=`006cd7d7ef357c15572af1f7daa2588dd826963d`，双方 benchmark identity=`6c4`。三分片硬检查 pass；classic/full 0/3、all/full **3/3**、all/prefix 0/3。all/full 分片与 aggregate exit 1 是现行 D6 的正确结果，不能按 report-only 关闭。

逐轮复核 all/full 原始 summary/rounds/输入（A/B完整录像JSON逐字段相等，含recordedAt及snapshots）：A/B 各 **2423 events / 2549 blocks / 2549 objective rounds / 253375 roundTicks**；16 项 segment 调用数、stats hits=3557870/misses=2784487、最大 footprint=83/body members=9 完全一致。完整 semantic 对象也相同（state/event/full-domain/rows hash、双 RNG 及调用次数）；不是只比较最终摘要。主要计数：transaction=5000、collectExtensionComponents=settle=4794、recordingEventDigest=2423、snapshot=2433、checkpointCombatFactWorld=148、checkpointResidentWorld=145。all/prefix 恰好也覆盖这 **2423 条完整输入**，其三组 A/B 同样工作量/语义相等。核对摘要见仓外 `cloud-workload-audit.json`。

`evaluateGates` 只有 all/full 的事件/块/round 数不同时才降为 report-only；本次 `workloadChanged=false`。以下是实际触线项（ms），任一项触线计该轮失败，三轮至少两轮判 regression；不存在“不同指标不能累计轮数”的例外。

| 轮次 | 触线指标 | A → B | 门限 |
| --- | --- | --- | --- |
| 1 | D20 command max | 2112.725 → 2731.560 | +25% |
| 2 | objective P99 / D20 objective P99 | 442.121 → 592.113 / 180.141 → 251.560 | +25% |
| 3 | objective P99 / D20 objective P99 | 372.787 → 591.914 / 181.778 → 253.325 | +25% |

三轮 command P95（A→B）707.984→694.862、676.745→693.517、693.729→697.751；elapsed 760289→743151、735698→740679、733975→742393，均未触线。D20 尾部尖峰所处指令随轮次/侧变化，而 all/prefix 同输入的总 P99 全部未触线，这支持运行时/GC 抖动的可能性；原云端没有 GC trace，不能将其确证为唯一原因，更不能据此改判。

本地诊断使用原 `profile-ext-perf.mjs`、同一份云端A输入、Node **v25.2.1 / Apple M5 / heap3072MB**，依次在仓外A=`72aa412`与当前B=`006cd7d`执行 `--cpu`；不是绕过Node24正式runner来出D6结论。两侧均完整2423事件、零OOS，semantic与上述云端对象相同，16项调用计数相同。采样热点如下，单位秒，为V8 self采样估算，不能与包含它们的分段墙钟相加：

| 热点 | A | B |
| --- | ---: | ---: |
| structuredClone（js_transferable） | 255.584 | 253.542 |
| WorldCheckpoint.capture | 83.977 | 87.704 |
| GC | 53.322 | 56.054 |
| isStatJson | 47.546 | 47.147 |
| runtime.collect | 40.983 | 39.395 |

V8采样时钟跨度936.799→937.248秒（约+0.048%），`PartyAi.ts`/`partyAi.ts`没有self样本；主要热点的生产实现未在P1c改变。逐项审计新增调用：视图/策略/AI事务都受party状态约束；无party怪物路径新增的是party条件检查，拾取路径的成员查找也由可选链短路。**未定位到可归因于P1c的新增重活；本次没有生产修复，不能声称已完成“修复后的有效本地配对证明”。** 采样零命中也不等于证明所有新增检查绝对零成本。

本地测量有明确环境限制：上述CPU运行的墙钟elapsed为960.783/1087.149秒，与采样时钟分别相差约24/150秒；`benchmark-sleep-events.txt`、`power-events.txt`记录测量期间多次 **Maintenance Sleep / DarkWake**。随后未启用采样器的A-wall也受同一睡眠循环污染，在2300条进度之后中断，未产出完整summary，队列exit130；B-wall及原排队的完整AI运行未启动。临时caffeinate的idle/display/user-active断言也未阻止该状态，已向维护者请求保持本机唤醒。这些墙钟不能证明性能改善或回退，不能择取部分较快区段代替完整配对；两份CPU文件只用于热点诊断和语义/计数核对。日志、完整cpuprofile、分析JSON及原中断记录都在仓外证据目录。

临时环境清理：由工具会话启动的idle断言已终止；另一个限时 `caffeinate -d -i -u -t 10800`（PID86530）清理时被沙箱以EPERM拒绝，约2026-10-20 13:06（Asia/Shanghai）自动到期。维护者可在本机终端执行 `kill 86530` 提前结束；未修改系统电源设置。

因此优先级1仅完成工作量审计与本地热点诊断，**all/full回退仍未关闭**；仍需在持续唤醒的环境完成有效配对/归因，或维护者按下方命令复跑Node24正式证据。本次未改工具的D6判定、原回退结果、生产代码或字节夹具。

#### party-ai：原因为 4 人子进程超时，汇总只是在严格拒绝失败分片

[run 39338464217](https://github.com/coolking70/BrogueJS/actions/runs/39338464217) 的 classic(1人)、all-full(2人) 各完成6项；all-prefix(4人) 在首项 `1-4-party-only.json` 失败。原 `.log.json` 为 **exit=null / signal=SIGTERM / error.code=ETIMEDOUT / elapsedMs=1200219.451 / timeoutMs=1200000**，stderr 为空。并非摘要/OOS错误或 aggregate 安装失败：汇总的 `merge` 拒绝 `status=failed`，没有写出 summary，workflow 最后才用通用文字 “Aggregate setup failed” 兜底。

已完成的2人测量连同存读档和完整seed replay耗时759–839秒；首轮only测量356.885秒、验证396.656秒，主耗时不只是计时循环。旧20分钟子进程上限没有容纳4人负载。修复限定工具：AI按人数设置执行预算 `max(1200000, actors×600000)` ms，即1/2人20分钟、4人40分钟；其它场景仍20分钟，6个4人子进程最多240分钟，留在360分钟job上限内。保留默认2049输入、完整生命周期验证、硬拒绝和预算null；执行上限不是性能验收阈值。子进程错误现在包含exit/signal/error/timeout；merge失败仍exit1，同时生成带原始分片错误的result/summary，不再把已知测量失败混作setup失败。不自动重试，不丢弃慢轮，不调整D6。

本地因上述睡眠限制，改跑 **rounds=1、steps=24** 的三分片功能冒烟（显式短步，不冒称默认2049输入已跑通）：classic=1人、all-full=2人、all-prefix=4人，各only/all；三个run及merge均exit0，汇总6/6、`smoke-only`、budget=null。每场24条输入=19个100tick窗口+5条零时控制，共1900tick；1/2/4人真实AI调用与接受决策分别19/38/76，only/all展开节点分别534/581、391/448、701/732；全部完整save/load及该24输入录像的seed replay零OOS、预演污染0，cacheHits/budgetFallbacks均0。merge重新核对measurement及save/recording原工件hash。

运行时候选hashCandidate=`7f982ba129dfeb86300e46f7d14a4fc4e7fe4c4463be624098cbb2394b7ca703`（包含当时工具/测试及报告更新前文档；生产源码仍006cd7d），三分片开始/结束身份守卫通过。工具hash、全部命令及退出码见仓外 `ai-smoke-merged/result.json`、`ai-smoke-steps.json`；三分片各耗时51.306/33.266/52.899秒，merge0.443秒，这些受本机睡眠影响的时间仅作执行记录。4人子进程日志的timeoutMs=2400000，1/2人为1200000；短冒烟没有实际触及超时边界。**默认2049输入完整本地复跑未完成**，新增上限能否覆盖正式云端负载仍需下方party-ai重跑确认。

原云端三分片另用新merge重算到 `cloud-ai-remerged/`，仍exit1，summary明确为 `Shard all-prefix failed: ... Failed 1-4-party-only.json`；旧run.error本身没有ETIMEDOUT，详细原因由原子进程日志提供。没有把失败工件补写成成功。

#### party / party-window：完整校准，仅报告

[party run 39338438938](https://github.com/coolking70/BrogueJS/actions/runs/39338438938) 与 [window run 39338451392](https://github.com/coolking70/BrogueJS/actions/runs/39338451392) 均为B=`006cd7d`、Node24云端、1/2/4人×only/all×3轮，每项2049输入、各18项，`measured-no-budget`。party汇总另产出 `party-perf-budget.suggested.json`（suggested-only，未采纳/未冻结、没有独立第四轮验证）；window的budget=null。每场OOS=0；window预演污染=0。以下每格按原轮序列出，单位ms，不取最好值，不跨机器比较绝对耗时；party的step与window的input-to-ready计时口径分别保留。

**party step**

| 场景 | P95（1 / 2 / 3轮） | P99（1 / 2 / 3轮） | max（1 / 2 / 3轮） |
| --- | --- | --- | --- |
| 1 party-only | 136.40 / 134.45 / 136.17 | 150.60 / 155.36 / 151.51 | 193.07 / 193.42 / 181.07 |
| 1 party-all | 107.26 / 106.70 / 105.75 | 140.27 / 141.19 / 140.29 | 199.58 / 221.66 / 188.39 |
| 2 party-only | 66.57 / 66.52 / 67.63 | 83.16 / 82.45 / 82.85 | 117.50 / 105.78 / 102.71 |
| 2 party-all | 74.53 / 75.74 / 77.94 | 96.84 / 97.75 / 101.45 | 132.39 / 141.90 / 144.92 |
| 4 party-only | 51.43 / 49.87 / 51.80 | 72.30 / 66.51 / 68.69 | 115.45 / 83.40 / 106.06 |
| 4 party-all | 60.41 / 62.69 / 58.80 | 80.21 / 77.90 / 73.36 | 144.81 / 110.99 / 143.99 |

**window input-to-ready**

| 场景 | P95（1 / 2 / 3轮） | P99（1 / 2 / 3轮） | max（1 / 2 / 3轮） |
| --- | --- | --- | --- |
| 1 party-only | 155.23 / 154.35 / 154.13 | 201.80 / 200.92 / 202.80 | 325.85 / 322.95 / 319.58 |
| 1 party-all | 244.38 / 240.44 / 237.18 | 772.55 / 719.20 / 709.86 | 1018.26 / 939.31 / 884.47 |
| 2 party-only | 95.28 / 96.00 / 96.49 | 223.23 / 225.61 / 243.98 | 1332.49 / 1358.47 / 1321.30 |
| 2 party-all | 108.44 / 111.19 / 111.92 | 255.64 / 256.00 / 260.67 | 1472.38 / 1464.06 / 1404.84 |
| 4 party-only | 60.47 / 62.32 / 63.26 | 135.68 / 136.94 / 148.31 | 634.99 / 628.58 / 649.61 |
| 4 party-all | 67.97 / 73.88 / 73.69 | 218.65 / 239.09 / 224.36 | 1528.98 / 1655.18 / 1614.02 |

window三轮各配置总tick稳定：only1=205200、all1=248480、only2=106900、all2=109000、only4=52800、all4=60600；人数间推进工作量不同，不能据单输入P95下降声称多人更快。

#### 本次限定验收

- `node node_modules/vitest/vitest.mjs run src/test/party_window_perf_tools.test.mjs src/test/party_perf_tools.test.mjs src/test/ext_party_inert.test.ts --maxWorkers=1 --no-file-parallelism`：**3文件45项通过，exit0**，18.70秒；包括原五配置无party存档/录像/消息/RNG/自有键字节夹具，未重录。日志 `targeted-tests.log`。
- `node scripts/test-ext-perf-ab.mjs`：exit0，原P99/工作量、1ms容差、2-of-3及冻结资格正负例保持。`node scripts/check-test-dependencies.mjs`：exit0。日志 `d6-tests.log` / `test-dependencies.log`。
- 新增测试覆盖4人AI有限执行预算和默认2049输入保持、失败分片继续拒绝、真实merge CLI exit1且写出原始错误报告。旧断言未放宽；没有生产文件回退/基线重录或守卫前提修订。
- 原party/window下载的三分片分别重新合并，均exit0（`cloud-party-remerged/`、`cloud-window-remerged/`）；校验原始measurement身份/hash和重复轮稳定性，window另校验save/recording工件hash。party预算建议仍只是原有suggested-only产物，未采纳。
- 本次只改性能工具、其测试和本报告；无生产代码改动，因此未新增boundary/vue-tsc/build，也未跑完整npm/test:full/drift。所有原始证据留仓外；未commit/push/派发。

#### 维护者提交后需要重跑的精确命令

仅需重跑 **party-ai完整校准**及**phase6正式A/B**。本次不改party/window测量内容与生产源码时，以上两套成功校准可以保留，不要求为文档/超时诊断重复派发。令 `P1C_SHA` 为维护者提交、推送本修复后的完整40位SHA；不能填旧006cd7d。`PERF_TOOLS_REF` 必须指向包含本工具修复的同一提交（workflow dispatch用远端分支/标签）。先核对远端ref，下面每条单独执行；本地不派发。

```sh
set -eu
: "${P1C_SHA:?设置为维护者提交并推送本修复后的40位SHA}"
: "${PERF_TOOLS_REF:?设置为指向该SHA的远端分支或标签，例如ext/party-p1a}"
test "$(gh api "repos/coolking70/BrogueJS/commits/$PERF_TOOLS_REF" --jq .sha)" = "$P1C_SHA"

gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$PERF_TOOLS_REF" \
  -f suite=party-ai -f mode=calibration-only -f head_ref="$P1C_SHA" -f rounds=3

gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$PERF_TOOLS_REF" \
  -f suite=phase6 -f mode=ab \
  -f base_ref=72aa412c0c2a20dba316df01b33993cd6f88976d \
  -f head_ref="$P1C_SHA" -f base_identity=6c4 -f head_identity=6c4 -f rounds=3
```

需要下载三分片及aggregate，复核工具/源码身份、输入/原始工件hash与退出码；本地诊断不能替代Node24正式D6。party-ai成功后仍只校准/report-only，不自动冻结；phase6原回退只有新的完整证据和维护者裁定才能关闭。

### 首次实施时的性能说明与派发方案（历史）


原party-v1/party-window-v1输入身份不冒用；新增party-ai-v1。AI场景为seed42 wizard受控计时，1/2/4人×only/all，含有限窗口、跟随/探索、设置、取消/恢复目标、永久切换与本窗AI。策略与视图、验证/事务捕获、模拟、主线程录制、Worker等待、预演、摘要/编码分别计时，包含关系不相加。calls/nodes只计真实模拟，acceptedDecisions取权威ordinal差量；cacheHits=0（未引入共享路径缓存）。预算4096及原生同伴负载有功能专项，尚未组成完整独立云端性能场景；不得把自然演示或纯策略探针说成这两类正式计时。

本地rounds1短步只能标smoke-only，正式AI预算仍null/report-only；不可据短样本P95推断浏览器延迟。旧party/window跨格式完整摘要必异，目前缺独立经审适配器：保持原strict硬拒绝，A/B阻断需后续工具任务；本次给B校准命令，同时保留phase6真正A/B回归。三套旧版A/B完整要求未达成，不能宣称C7全验收。

维护者提交/推送本候选后，令 `P1C_SHA` 为那次40位SHA，`PERF_TOOLS_REF` 为指向同一已审代码的分支或标签（例如ext/party-p1a；不是本次旧HEAD075b7eb）。先确认远端工具ref与候选一致；以下每条独立派发，workflow默认完整2049步/phase6 limit=0、三轮三分片，不带本地短步参数：

```sh
: "${P1C_SHA:?设置为维护者提交并推送后的P1c完整SHA}"
: "${PERF_TOOLS_REF:?设置为包含本次已审工具的远端分支或标签}"
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$PERF_TOOLS_REF" \
  -f suite=party -f mode=calibration-only -f head_ref="$P1C_SHA" -f rounds=3
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$PERF_TOOLS_REF" \
  -f suite=party-window -f mode=calibration-only -f head_ref="$P1C_SHA" -f rounds=3
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$PERF_TOOLS_REF" \
  -f suite=party-ai -f mode=calibration-only -f head_ref="$P1C_SHA" -f rounds=3
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref "$PERF_TOOLS_REF" \
  -f suite=phase6 -f mode=ab -f base_ref=72aa412c0c2a20dba316df01b33993cd6f88976d \
  -f head_ref="$P1C_SHA" -f base_identity=6c4 -f head_identity=6c4 -f rounds=3
```

phase6仍按D6-2026-10-16逐轮硬检查、同机AB/BA/AB、三轮至少两轮越线判退。party/window校准不替代旧版A/B；适配器未审前不提供一条必然跨格式失败却标“可比”的命令。运行后核对run.headSha/三分片、下载原始save/recording及measurement工件、验证hash并用相应merge重算；缺片/timeout/OOS/身份错均不通过。本次无run URL，因为没有派发。

## 留项

维护者人工操作见 [清单](party-p1c.manual-checklist.md)。正式跨格式比较工具及云端证据尚缺；浏览器/320与390/真机/真实Web Worker互动待验。狭道拥堵可停等，AI不保证通所有种子；保守避险不做最优免疫寻路。P1d招募/居民正式互转/完整手机计划层，P2网络，P3条件表，数值平衡延期。未运行完整npm test/test:ext/drift、512组合或其它删除布局；没有自动发布。

## 收尾登记

以下为初次实施/本轮独立审查前证据，修复后门禁及身份以“审查发现处理”为准。

- 主批 `selected-final2.log`：42过/5失败，805项中779过/26失败，exit1，1421.69s。修复后 `followup-final.log`：25文件323项通过，exit0，534.99s；`natural-corner-fix.log`：2文件24项通过，45.38s；`natural-body-fix.log`中的两个body整文件24项通过（同批自然1项失败另归因/复验）；`rally-final.log`：1文件5项通过，4.86s。旧完整Worker 1/4人256/2048链在主批通过；后补差量为拾取/坠层/集合、恢复无指令NPC原入口及策略指纹，未改变该wait窗口工作负载，未重复长跑。
- 无party：075b7eb归档副本及最终候选都通过原五配置字节夹具；最终 `inert-final.log`：1项通过，5.57s，fixture未重录。固定列表显式声明后的输入/断言完全相同。
- 最终静态：boundary-final、dependencies-inert-final2、types-inert-final、build-final均exit0；Vite只有既有大于500KB的bundle提示。补入探针只修readonly构造，不改断言；后续测试登记/工具路线标签差量不改产品build。
- 自然证据：`natural.save.json`/`natural.recording.json`，133条事件，两名成员均active于D2，ordinal分别74/122；完整save/load/replay摘要一致。原始存档大于1MB，留仓外。
- 全删：`removal-release`准备九目录缺失、发现为空；准备器原status仍保留prepared-not-verified，不篡成通过。隔离副本另跑boundary/deps/types/build均exit0；首批25文件22过/1失败/2跳过，479过/1失败/2跳过，345.78s，唯一失败为未登记前的固定八模块inert夹具。仅同步该测试显式配置及required登记后，全删文件级跳过通过，完整包实际执行也通过；其余22整文件证据有效，最终3个不适用文件明确跳过（inert、创建12组合、需combat的production-body）。
- 删除前3类真实样本在完整包capture/load/replay成功；全删classic/extended-empty分别拒绝其save/record并保对象身份、机械摘要、双流、allocator、完整录制前缀。`removal-release-missing-samples-final.log` exit0；首次仓外探针因export.recordedAt墙钟变化误报，冻结Date.now后完整比较，不删字段、不改生产，首次日志保留。`removal-release-lifecycle.log`引擎端点生命周期requestedScopePassed=true；顶层passed=false因browser未跑，按任务engine-only范围登记。其它删除布局/512组合未跑。

### 初次实施身份（审查前）

- 分支仍为 `ext/party-p1a`，HEAD仍为 `075b7eb10c87394fa5497fca3ff98e4ff63ac3c6`；未commit/push/派发。
- 源码集合 SHA-256：`8b64f05a3f807d4caa42f8728e312b30695d4cc604c39e65890c03b869bf3ee8`。范围精确为src/**、scripts/**、.github/**、package.json、package-lock.json、vite.config.ts；逐文件SHA按相对路径排序，以path+NUL+sha+LF汇总。docs不在此集合，避免报告自引用。完整清单在仓外final-source-manifest.json。
- dist集合 SHA-256：`e068d11dd2497cacb3f91fabcf5b3dd7f17cecd9eb3a517f1bf6e4cb07476233`，同法，清单final-build-manifest.json。静态类型的后置改动只在测试；最终产品源码与此build对应。
- 计时时完整候选树hash为 `7e65c76d3bfc5165f0be4d814ee35ed697d4b33a1b2ae555cfc14beadd1d4e9e`（工具hashCandidate范围含当时docs），三套运行开始/结束守卫均一致。此为当时性能候选身份；本轮 N1–N3 修复已改变源码，不把该 hash 或当时性能值称为修复后身份/测量。
- observer/run/merge/shared工具各自hash见 [小型性能摘要](party-p1c.perf-summary.json)，原JSON和18份子进程诊断保留在仓外。18份均exit0、signal/error=null、timeoutMs=1200000，elapsedMs完整；没有自动重试或择快。

### 本地性能结果与归因

Node25.2.1、3072MB、串行，同机仅B测量；`party-ai-v1` / `party-ai-managed-v1` 三分片分别1/2/4人，各only/all，rounds=1、steps=24。六场全部save/load及完整seed replay零OOS，预演零污染；merge重新核验每份measurement及save/recording原工件hash，6/6合并成功，状态仅 **smoke-only**。每场24条输入、19个100tick窗口、1900tick；5条零时设置/控制指令不混作AI行动。

| 配置 | 输入到可操作 P50 / P95 / P99=max（ms） | AI调用=接受决策 | 展开节点 |
| --- | --- | ---: | ---: |
| only 1 | 34.88 / 89.69 / 90.90 | 19 | 534 |
| all 1 | 44.25 / 92.07 / 93.16 | 19 | 581 |
| only 2 | 51.05 / 97.74 / 100.91 | 38 | 391 |
| all 2 | 66.17 / 139.72 / 151.40 | 38 | 448 |
| only 4 | 99.60 / 143.30 / 148.53 | 76 | 701 |
| all 4 | 108.61 / 156.71 / 184.58 | 76 | 732 |

分层归因（24输入累计毫秒，计时存在包含关系，不能相加）：all4中已知视图+策略39.80（其中策略查询31.83）、原生验证1.46、完整事务捕获1178.30、调度234.05、主线程录制276.44、测量循环内flush399.57；only4对应视图+策略41.23、捕获1202.96、调度134.98、录制248.27、flush382.65。此短路线的主要成本是既有完整事务捕获、录制与等待，策略本身较小；这只是本地分层归因，不能外推预算最坏情况或据此裁剪事务/摘要。all1→all4捕获约303→1178ms，随实际AI决策19→76增长；不能把成员工作量增长直接当回归。

all4独立full oracle两次共82.47ms、投影9.07ms、编码14.59ms、预演6.26ms；Worker峰值挂起2job/7,939,602bytes，端点RSS约1102.6MiB、heap约374.4MiB（含SSR/Worker/诊断，不是峰值或每成员净增）。存档2,055,655bytes、录像72,638bytes、party控制根3446bytes。六场cacheHits=0、budgetFallbacks=0；没有声称短跑覆盖4096预算或受命同伴计时。节点预算和同伴真实原生调度已由功能/独立探针覆盖，但完整云端计时场景仍列留项。

旧 `party-v1` 与 `party-window-v1` 各1/2/4×only/all、rounds=1、steps=8，共另12场，全部独立生命周期零OOS，状态smoke-only；B校准不冒称跨格式A/B。AI三分片+merge、party、window进程分别exit0；日志local-perf-steps.json给出全部实参和elapsed。对应结果目录为perf-ai-merged、perf-party-smoke、perf-window-smoke。

额外 `phase6` 本地短程A/B尝试采用A=72aa412、同6c4输入、rounds=1、limit=4、候选sourceSnapshot见实参；启动113.55ms即被 `run-ext-perf-ab.mjs:72` 的“Use Node 24 on both sides”拒绝，未产生计时样本。日志perf-phase6-smoke.log，exit1；未改守卫/Node约束，未按快慢重试。无party的原五配置字节配对已通过；正式phase6回归仍须执行上文Node24 workflow命令，不能由该配对或本地B数据替代。

正式云端、独立跨格式适配器、AI扩展计时场景、浏览器/真机均未验收，发布未执行。当前可交付的是未提交代码、限定自动证据、作者审查修复、审查前的三套工具本地冒烟和维护者命令；本轮独立复审另待执行。
