## 维护者收口（2026-10-09）

两轮独立审查及最后一次作者修复已完成，维护者已核对实际改动与测试日志并按本步限定范围收口。R1-F1原合法变形/坠层存读、F2摘要发布、F3时序拒档均已修复；R2-F1伪造坠离在末次窄修后被拒，原独立2探针与真实生命周期/活局保持回归通过，最终boundary/types通过。没有第3轮审查，最后修复不冒称独立关闭。当前无剩余已确认未修复正确性缺陷；全量、组合/删除、浏览器/真机、最大负载和细分覆盖留5Z。 实现提交号随后记录于[状态卡](commander-status.md)。首实施性能、R1实际build、drift初批与受影响复测仅按各自批次引用，没有重跑或冒称最终全套全绿。各历史失败、修复和过滤数保留下文；证据仅结果摘要。

# 5E1 实施与必要自测报告（2026-10-09，未提交）

开工与交接分支为 `ext/phase5`，实际 HEAD `5c34f50f56bcf85f4cee890ae80dec87fa927831`；5D2 已有提交 `ce7a2da`（含5D1/5G）。本执行者完成一次实施与相关自测，没有派代理、commit/push、改其它分支或操作 dot/giants2。第1轮父独立审查已确认F1–F3，本会话按父resume进行第1轮修复；最多两轮审查→原会话修复；本报告不冒充独立审查。批准范围见[任务书](phase5e1.task.md)。

## 实现范围及版本

固定开局 `{raids:boolean}` 默认关；通用 descriptor 配置声明→MainMenu→App→Game→manifest，保存、载入、回放、seek 和续录均由原 manifest 重建，游戏内没有开关。未知配置、缺席 owner、缺失/错配配置身份拒绝，不取当前菜单草稿，不迁移旧档。

| 合同 | 基线 → 候选 | 实际原因 |
| --- | --- | --- |
| foundation | 12 → 13 | 固定每局配置/规则身份、机械事件及有效经济时钟；拒旧 |
| world5 schema | 3 → 4 | `raidCamps`、`raidAdmissionCursor`，事件/暂停边界/排除累计、上次已知报告、准入延期原因 |
| settlement module/rules | 1.2.0 → 1.3.0 | 袭击自有规则指纹、固定配置、普通阵容及公开修缮 |
| settlement state | 2，保持 | 新持久事件归 world5，没有模块第二份实体或库存 |
| ResidentEconomy / WorldSettlement 纯计划合同 | 1.2.0，保持 | DTO及纯公式未改；提供者投影时间的变化由 foundation13/world4承担 |
| whole-run / recording / origin / IDB | 6 / 4 / 2 / 2，保持 | 原外壳及原生实体图保持；recording codec 中 foundation 改13 |
| worldSdk / edibleSdk；九冻结文件 | 1 / 1；均保持 | 最终九文件逐项等开工 HEAD，fgfixture 子树无 diff |

没有新增 Game/Item/Creature 持久字段；`scripts/u03-state-contract.json` 登记现有 `world5` 合同。repair 采用可信 Map 内部窄分支及 foundation 命令识别，不改冻结 `STRUCTURE_ACTIONS`、structure SDK 签名或授权边界。构造/摘要仍统一 world5、extensions、actorActions 原域。

开发中曾给 `worldHarness.ts` 加配置参数，最终冻结核对发现该文件也在九冻结名单，已完整恢复其 HEAD 原字节。新增 `configuredWorldHarness.ts` 仅使用已有 descriptor override 入口，测试声明的默认值和 rules 同用生产配置 identity；不复制 Game、时钟、planner 或存录实现，不扩 SDK。

## 机械语义与生命周期

集中默认参数：周期1000、建营宽限32000、冷却32000、预警2000，阈值 `64+8*(lastOrdinal%3)`；人口/深度/上一完整周期真实完成批数影响压力。取消、预存、未完成和查看无生产噪声。触发锁定 P/F/D，合并严重度最多2，普通原生单格阵容人数最多8。完好且有真实生产用途的设施最多计4；不新增大型袭击。

| 状态 | 进入与退出 | 身份、槽及经济 |
| --- | --- | --- |
| 无事件 / closed | 合格留营人口、宽限/冷却和压力达标后准入 warning | 每营仅一根；全局 warning/deferred/active 最多4，满槽保有界压力及原因，按 campId/持久 cursor 公平准入 |
| warning | 同一 eventId 等待2000；到期先检查整个波次 | 固定预算与合并严重度，不刷 ordinal，不半批生成 |
| deferred | 合法落点或实体/空间预算不足；下一真实有效边界重试 | 同 ID、同有限预算，查看不重试，不改地形 |
| active | 一次完整合法物化；全部真实死亡或转为盟友才 closed | 原生实体/AI/战斗时钟；占槽，关闭不补奖励；离层冻结同一批实体 |
| active 且缓存离层 | 暂停该营经济；返回仅恢复在场规则，事件仍 active | 持久暂停边界/排除水位；多次离层不重置敌人、HP或事件，不跑同事件摘要 |
| aftermath | 未物化且在别层到期，只做一次有限静态提交 | 无残敌，释放全局槽；同营禁止再开，连续离场只结一次 |
| aftermath → closed | 玩家实际进入该营 region，经机械输入汇总 | 单次已知损失/欠粮/停工报告；只进该层、load/seek/查看不重新武装；后续仍受冷却 |

合法物化检查营外已知边缘、原生入口可达性、完整占位、所有 owned region/结构/interactable、128实体/512空间格预算。派生 SHA 抽样只选深度相称的 rat/kobold、goblin/jackal、goblin/ogre、ogre/troll 白名单；不污染实质/装饰 RNG，不含召唤/分裂/body 生成。A1还保存真正的combat原actionId、windup/segment/锁定格和资源池：可信ActorActionScheduler只对world4已登记active+paused、单格且自有source的combat bundle跳过离层取消；其它缓存待释放攻击仍拒绝。候选读取同受严检raid根派生的白名单，资源保护/几何/镜像继续校验，缓存不推进，返回后的下一真实elapsed续原动作，不新建动作。此例外属于已批准A1，不改九冻结SDK或actorActions外壳。

出生后走原生 AI；守卫仍由公开岗位命令管理，食物/休息/危险优先及战后回岗沿旧规则。有 combat 复用真实预警、资源和 poise；墙保持结构。已有 giants group 保自己的成员、完整足迹、HP/目标/死亡事实，不为袭击生成巨型单位。

被围离层先排除缓存经过时间，再选择经济到期项。只更新该营绝对账本水位和累计排除量；劳动、订单寿命/剩余32周期、产物截止、日配额和需求使用 `absoluteTick-excludedTicks`。已有 escrow、预留及待交付所有权保持，缓存期间不交付、不扣粮、不加欠额/离营、不提交袭击损失；返回且未解围后再次离层仍排除。真正终结以后只有后续合格时间恢复，不补产、不补扣、绝对日期不刷新配额/寿命。其他营地及全局时间照常；玩家真实 game-over 后不解围或补结。

5D同周期顺序保持：上一周期合法产物交付→需求资格→本周期袭击→新生产扣料/劳动→次周期输出。静态 summary 仅用 detached 值对象计划，不跑隐藏AI/火毒/寻路/战斗 RNG；活着、有粮、合法岗位且不在休息窗的守卫每名2点，完好门墙贡献封顶8。材料/FOOD按种类总量先取 `floor(total*q/4)` 再稳定派生分摊，避免小栈先取整；唯一装备/护符、锁粮、escrow、在途/待交付及有容量预留的箱不盗（对预留箱保守排除全部库存）。结构损伤经可信抗性事务，合计预算有限、不得低于25% maxHp，已有更低HP不补修；不产生离场居民死亡、虚构掉落或XP。

公开 repair 只修尚存在的 owned 组件：显示目标/恢复量/原配方按HP比例逐项向上取整材料/同比耗时（至少100tick），确认后重验距离/可见性、revision/CAS、inventoryStamp、账单和材料源；同原同步付费施工事务扣真实物料、改HP及支付时间。No/陈旧/失败无免费HP；已毁坏沿原建造重建。允许袭击尚未结束时修缮，没有居民自动维修订单或负 damage 入口。

summary、物化、有效关闭、暂停水位和付费修缮的 provider/writer 失败走共有检查点/事务回滚；静态计划预验完整写集后提交，不先推进事件水位。原5A3毁坏、居民死亡/离队、订单取消与退款沿原所有权清理。

## UI、严格存录及实测覆盖

开局中文默认关/整局固定说明、营地预警/延期/被围及离线暂停原因、已知损失/停工与付费修缮按钮/确认均走 i18n。远营只显示持久的上次已知报告，离场 summary 不泄露到当前菜单；实际回 region 才发布报告。菜单/查看/取消预览不推动压力、抽样、账本或随机流；回放沿原只读面板。

world4 严检精确键、enum、安全整数、8营/4事件/8单位、ordinal/eventId/预算/严重度、暂停边界与累计排除等式、phase→actor/损失/结束水位、owner/camp/层/原生 actor 引用，拒绝缺事件被围、错阶段原因、伪造排除/损失/预算/不存在实体。解码候选失败不退役原活局。保存、载入、回放、seek 共用生产规则配置；不通过菜单补默认开关。

| 专项 | 实际链路证据 |
| --- | --- |
| S1 | 真实公开营地/居民/物化、stairs离层，超过32周期不结经济，原敌ID/HP/动作冻结；第二个真实营地仍支付需求/产肉 |
| S2 | 返回未解围、再次stairs离层仍暂停；真实死亡终结只恢复未来，原排除累计保留，不刷新寿命/配额 |
| S3 | 真订单部分劳动、escrow/预留及已完成待交付保留；公开取消只退款一次，恢复合法输出只兑现一次 |
| S4 | 坏档拒绝/原图不变、UI零写；whole与17段相同；公开构建→等待物化→stairs暂停→返回→公开原生击杀解围→后续时间，save/load/replay/关键seek及续录一致 |
| S5 | 真实物化失败恢复allocator/实体；解围/排除水位writer失败恢复完整原图；非零summary及修缮HP之后writer失败恢复库存/耐久/事件/水位，合法重试；真实triggerGameOver不补结 |
| 组合/原生 | settlement、+combat、+giants、+两者真实启用波次；实际袭击者守卫危险优先、combat windup/poise，既有giants完整成员占位/伤害/死亡，空营/无整批落点/四槽被缓存波次占满 |
| 满槽 | 五个真实付费营地/招募；前四营原生active离层继续占槽，第五营无新event/ordinal且压力有界/原因持久，释放第四营后原第五营公平准入并存读 |

极长尾/故障/满槽采用 controlled geometry/stock 的真实Game局部夹具，施工、招募、订单、stairs和结算仍走实际命令；不称自然地牢玩法路线。公开录制用例只在 origin 布置地形/材料/原生装备，header之后全为可回放公开输入，真实击杀与恢复也在录像中。pure loss planner 不代替这些 Game 链路。

## 实际门禁及失败归因

重任务串行，Node `v24.19.0` 绝对PATH、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=1`。每行按一次实际批次记通过/失败，重叠复测不累加为总通过数；`-t` 的未选项不算覆盖，没有新增skip或延超时。没有执行完整npm/test:ext、CE/full/gen、128子集、删除矩阵或最大世界门禁。

| 实际命令/范围 | exit；通过/失败/未选 | 结果说明 |
| --- | --- | --- |
| 相关18文件（完整命令见下） | 1；246/15/0 | 13通用fixture被误认生产进度、1新配置夹具错误、1当前codec空根向量变化 |
| 受影响9文件（完整命令见下） | 0；141/0/0 | 原13及坏档R1、默认无settlement、当前向量、真实回放/UI/性能 |
| `npm run test:drift -- --maxWorkers=1`，实际一次 | 1；2/10/0 | 6文件12项；10失败只有版本身份相关摘要，不改首次结果 |
| giants两trace文件，只回退descriptor 13→12 | 0；3/0/0 | 旧trace精确通过，随后恢复新源；单变量归因 |
| foraging/crafting两文件，单一RecordingDigest历史身份投影探针 | 1；0/7/0，修投影后1；1/6/0 | 旧final精确匹配；局部历史投影与新事件/录像根内部一致性冲突，不能把完整回放称通过；生产文件已恢复，不保留探针代码 |
| 原捕获入口重录四trace文件，`-t 'reproduces\|naturally'` | 0；6/0/4 | capture选择项不是普通完整门禁 |
| 同四个受影响trace文件正常复验 | 0；10/0/0 | 不重复完整drift其它2项 |
| 最新新增三文件（首次加非零/修缮writer/守卫/战斗/空营） | 1；20/2/0 | 两个新断言前提错误：view漏取state、provider错误码误写transaction |
| 两文件 `-t 'A2/A3\|paid repair writer\|S4 public'` | 0；3/0/18 | 非零summary/writer、修缮实际HP后失败、公开解围恢复回放/seek |
| raids单文件 `-t 'five real\|S4: forged\|A2/A3\|real native bounded'` | 1；6/1/13 | 五营夹具建材不足；原6项保持通过 |
| raids单文件 `-t 'five real'` | 1；0/1/19；补足后0；1/0/19 | 前两次同为真实夹具wood不足；补足库存，不改生产账单/断言 |
| 九冻结复原后的配置测试适配，三新增文件 | 1；4/19/0 | override默认改为on却未同步rules；已按生产identity同步，未改守卫 |
| 九冻结适配修正后三新增文件复验 | 0；23/0/0 | 只复测受新适配影响的范围 |
| 两文件 `-t 'S5: failed\|S1/S2\|S4 public'` | 0；3/0/19 | 真实关闭同步最后已知报告，回滚/公开解围恢复录像仍一致 |
| raids `-t 'five real\|S5: failed'` | 0；2/0/18 | 满槽原因投影及关闭报告最终字段复验 |
| windup单用例开发窄测（每次21项中只执行1项） | 前6次均1；0/1/20 | 前3次player已不在楼梯；第4/5次新增单格检查误调用候选Game方法；第6次错误假设stairs支付elapsed；修正确入口，不弱动作/资源/存读断言 |
| 四文件 `-t 'combat S1/S4\|3b\|3d\|S4 public'` | 0；26/0/34 | 3执行文件；animated-defense整文件未选。真实windup冻结、原3b正常cached攻击守卫、两组合公开freeze/close/recovery录像/seek |
| animated-defense + raid-performance 两文件 | 0；14/0/0 | 窄回归与更新受影响性能，串行 |
| raids `-t 'five real'`，满槽已知延期显示 | 0；1/0/20；随后最后已知报告/存读复验同为0；1/0/20 | 不创建第五事件，但本地/最后报告显示延期及原因，避免显示暂无已知威胁 |
| `npm run check:modules` | 0 | boundary及测试归属；初次及最终均通过 |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 0 | 初次重复import/codec类型等开发错误及新测试隐式any/at/nullable已修；最终适配后也通过 |
| `npm run build` | 0 | 实际vue-tsc+Vite，1294模块；仅原有chunk体积提示，未提高阈值 |
| `git diff --check`；九冻结与HEAD比较 | 0 | 无CRLF/空白错误；九文件及fgfixture保持 |
| Vite preview与原web-game Playwright client | 1；1 | listen EPERM；Chromium MachPort `Permission denied (1100)`，没有截图或真实页面结果 |

首次相关批次的13个失败归因于5D2 `ResidentOrderValidation` 以任何 residentRecord 识别production，包括不声明residentPolicy的旧world5-fixture订单。生产代码只收窄到实际 residentPolicy 提供者或有production者；R1缺失真实production仍严格拒绝，原13断言不改。setup缺席settlement却传配置的新夹具已修。

当前空根向量只变codecIdentity的12→13，单变量只回退RecordingDigest该项使旧断言1项通过（19未选），恢复后独立计算新SHA再改当前向量；历史foundation11链向量不动。早期窄开发回归曾有真实open-generation内snapshot、未注册repair入口等失败，已修；另有新夹具落点用了移动后位置、无command scope准备、迟于预警边界、stale camp引用及due-only水位前提错误，修前提不弱化行为断言。初始9项0过9败→3过6败，受影响6项5过1败→公开repair等受影响4项全过；录制初两项失败、修后1过1败、再受影响1败，均在后续真回放复验中通过。不是独立审查轮次，不重复全批采证。

实际18文件命令：

```sh
node node_modules/vitest/vitest.mjs run src/ext/modules/settlement/tests/settlement_raids.test.ts src/ext/modules/settlement/tests/settlement_raid_replay.test.ts src/ext/modules/settlement/tests/settlement_raid_performance.test.ts src/ext/modules/settlement/tests/resident_production.test.ts src/ext/modules/settlement/tests/resident_production_food.test.ts src/ext/modules/settlement/tests/resident_production_codec.test.ts src/ext/modules/settlement/tests/resident_needs.test.ts src/ext/modules/settlement/tests/resident_jobs.test.ts src/ext/modules/settlement/tests/resident_failures.test.ts src/ext/modules/settlement/tests/settlement_validation.test.ts src/ext/modules/settlement/tests/settlement_persistence.test.ts src/ext/modules/settlement/tests/settlement_ui.test.ts src/test/ext_world5_clock_levels.test.ts src/test/ext_world5_offline.test.ts src/test/ext_structure_transactions.test.ts src/test/ext_generation_checkpoint_differential.test.ts src/test/ext_recording_v4_digest.test.ts src/test/u_03_whole_run_snapshot.test.ts --maxWorkers=1
```

实际9文件受影响命令：

```sh
node node_modules/vitest/vitest.mjs run src/ext/modules/settlement/tests/settlement_raids.test.ts src/ext/modules/settlement/tests/settlement_raid_replay.test.ts src/ext/modules/settlement/tests/settlement_raid_performance.test.ts src/test/ext_world5_clock_levels.test.ts src/test/ext_world5_offline.test.ts src/test/ext_recording_v4_digest.test.ts src/ext/modules/settlement/tests/settlement_persistence.test.ts src/ext/modules/settlement/tests/resident_production_codec.test.ts src/test/ext_module_creation_ui.test.ts --maxWorkers=1
```

其余Vitest命令共同前缀为 `node node_modules/vitest/vitest.mjs run`，均带 `--maxWorkers=1`；“三新增文件”为 `src/ext/modules/settlement/tests/{settlement_raids,settlement_raid_replay,settlement_raid_performance}.test.ts`；“四trace文件”为 foraging/crafting 的 `tests/*_trace.test.ts` 与 giants 的 `tests/giants_trace.test.ts`、`tests/giants_spine_trace.test.ts`。原捕获参数是 `FORAGING_CAPTURE_DIRECTORY=/private/tmp/5e1-trace-capture`、`CRAFTING_CAPTURE_TRACE=/private/tmp/5e1-trace-capture/crafting.json`、`BROGUE_CAPTURE_GIANTS_TRACE=1`，随后用真实captured final/原捕获输出更新黄金，不手填摘要或改命令。

6份自然trace逐字段差量：crafting natural、foraging natural/hearth 各仅 `final.digest`；giants natural/colossus/spine 各仅 `extensionsHash`，合计6字段。前后命令、判定、原生世界、两条随机流、库存、节点、模块state均不变；原因只有foundation13与world4空根身份。没有刷新CE经典生成基线/原生黄金，临时归因源已恢复，不建立多版源树；结果/命令摘要保本报告，原始日志/截图/大文件不进入仓库。

受影响性能为真实16居民已付场景/匹配raid-off对照、160次公开wait及32,000,000tick缓存长暂停，跳过测量中的fullCheckpoint只避免把既有全快照混入热路径P95，不跳过游戏输入。最后动作冻结修正后raid-off P95 5.931917ms、raid-on P95 6.547333ms，净增 **0.615416ms**；缓存长暂停 **8.382041ms**；预算仍为净增P95≤5ms、长尾≤50ms。不是浏览器FPS、64居民/8营最大负载结论。

## 剩余玩法/存录问题

首交接时A1原动作冻结已通过作者窄回归；随后第1轮[独立审查](phase5e1.review-findings.md)确认F1原生形态/坠层、F2未发布摘要投影、F3事件时序三项失败，父已采纳并resume本会话修复。修复细节与实际复测见下文追加，不覆盖独立发现原文，也不宣称已独立关闭。没有不可逆冻结合同缺口；修复交接后停止共享树写入，等待父第2轮独立复审。5E2大型袭击另批；5C2营地选址/地表site、5D3叙事招募继续后置且是否纳入5Z前范围待定。

## 证据及覆盖缺口（5Z）

- 本步实际浏览器窄检受环境阻止。已执行[develop-web-game skill](/Users/coolking70/.codex/skills/develop-web-game/SKILL.md)原client，未取得菜单/默认配置/暂停/修缮的真实截图，不能用Game/component测试冒充视觉通过。skill要求“must actually open and visually inspect the latest screenshots”；本环境preview监听EPERM且Chromium在MachPort启动前被拒，没有可检视截图。本步没有申请扩大沙箱权限或改变浏览器工具。
- 全量npm/test:ext、强制CE/full/gen、128组合/物理删除、完整24格浏览器/真机/原生失焦，最终8营64居民3072结构/满箱、体积和长局压力仍留5Z。本步五营四槽正确性测试不冒充上述最大负载性能。
- 四种启用组合有真实波次/存读；完整四组合自然录像（本步公开controlled-origin录像现覆盖settlement及+combat）、所有writer故障点×每个phase/组合的笛卡尔积、小栈分摊/结构抗性全目录及生命周期全排列未穷举。S1—S5必需生产链已落代码/真实测试；窄证明不声称无限场景覆盖。

[5Z差量](phase5z-remainders.md)、[当前状态](commander-status.md)、[配置手册](settlement-config.md)同步。最终vue-tsc、boundary和实际build均exit0（最终build 1294模块/3.10s）；冻结/分支/HEAD/CRLF及大原始材料检查通过。外部READY已交，作者自此停止共享树写入。本报告交接后没有自行开启独立审查，也没有第三轮。


## 第1轮独立审查后的作者修复（2026-10-09）

父采纳[第1轮独立发现](phase5e1.review-findings.md)的R1-F1（P1）、R1-F2/F3（P2）后resume原实施会话。本轮只修三项根因及直接回归，独立报告原文保持；以下是作者修复/自测结果，**尚待父第2轮独立复审，不宣称已独立关闭**。实际HEAD仍`5c34f50`，未commit/push；未派代理、新开审查、操作其它分支/dot/giants2或浏览器采证。

### 根因与具体语义

- **F1出生许可与原生生命周期分开。** `event.actors`在唯一world5事件根保存最多8条`actorId/birthTypeId/currentTypeId/departed`登记。出生仍按该营深度的有限普通白名单和原落点/单格预算；当前形态必须是本局可信原生目录且匹配真实实体，出生登记、预算、身份及引用不能缺失/错配。仅真实原生变形/whole-body替换提交更新同一身份的当前形态；不会换type就复制、丢弃或新增袭击成员。原生敌我关系决定是否仍为有效入侵者。
- **幸存坠层只退出本营有效阵容。** 原生fall实际转移后登记目标层和发生tick，保留引擎实体、实际HP及pending/目标层归属；不伪造死亡、掉落、XP，不删除实体，不再加入本营缓存动作例外。出生ID集合保有界登记，`departed`标识有效成员已退出；其后在目标层真的死亡，才由原死亡路径登记真实死亡事实。其它成员仍有效则袭击继续；全部有效成员真实死亡、转盟友或坠离才用原生结束路径关闭。最后坠离在原转层事务内完成关闭，避免玩家同一输入随落时把空阵容冻结。关闭沿既有`combat`原因枚举，不另设奖励。既有排除累计保留，只推进以后实际时间，不补生产/扣粮/刷新订单寿命或日配额。
- **缓存许可仍严格。** 只从active+paused、未坠离、真实同营层、存活、已登记当前形态匹配、单格且无bodyMember的实体派生白名单；原production校验仍要求combat bundle的全部source为该自身身份。跨层pending/目标层旅客、任意普通怪物和群体动作不获例外；普通缓存未释放攻击守卫保持。候选先完成时序/引用校验才派生白名单，失败不替换活局/session。
- **F2统一读取已发布report。** 袭击面板所有阶段/原因/损失来自`r.report`；同层也不读尚未汇报的aftermath。真实region入口仍由机械命令发布一次并重武装，UI/load/seek零写入。未发布时phase/损失保null，已知active才显示其暂停标识。
- **F3本局规则先验。** 除原精确codec外，按安装规则核验建营/宽限、trigger/due、尝试/压力水位、深度因素、冷却、结束及当前pause边界；至少拒绝`trigger=created+1`、建营晚于合法触发、尝试晚于暂停开始、due错配等矛盾候选。真实windup/actionId/锁格/资源仍按原引用、几何及mirror守卫验证。

版本仍为本次**未提交候选**foundation13/world5 schema4/settlement1.3.0 state2；本轮完善schema4事件根的出生/原生生命周期记录，不另建Game/Creature/Item根或第二份实体，不增加迁移/兼容旧候选。whole-run6/recording4/origin2/IDB2及九冻结SDK保持；`u03-state-contract.json`同步登记派生许可边界与新事件子字段。

### 实际限定复测与门禁

环境：Node v24.19.0，绝对PATH与前述一致，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest均`--maxWorkers=1`，昂贵检查串行。公共前缀`node node_modules/vitest/vitest.mjs run`；下表各批独立计数，**不合并重叠通过数**。未选来自`-t`过滤，没有新增skip、弱化断言或延长超时。

| 本轮实际参数/检查 | exit | 通过/失败/未选 | 结果与准确归因 |
| --- | --- | --- | --- |
| `--config /private/tmp/brogue-commander-20261009-5e1/review-r1-probes.config.ts --maxWorkers=1`，首修 | 0 | 6/0/0 | 独立最终外部探针未改；四失败对应三根因及原两经济/分摊正确预期均过 |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b`，首轮 | 2 | 不适用 | 将NativeFormDefinition传给MonsterData参数的类型错误；改为可信目录ID检查，未放宽物种/引用断言 |
| `src/ext/modules/settlement/tests/settlement_raids.test.ts -t 'R1-F\|combat S1/S4' --maxWorkers=1` | 1 | 6/1/20 | 新fall测试把发生tick误作wait结束tick（后者多100）；修为实际开始tick，保精确等值断言 |
| 两袭击文件`src/ext/modules/settlement/tests/settlement_raids.test.ts src/ext/modules/settlement/tests/settlement_raid_replay.test.ts --maxWorkers=1` | 1 | 28/2/0 | 新录像前缀用错wand身份字段、向移动敌人走的受控路线受阻；本批其它原回归通过 |
| 同两文件`-t 'S4 public\|R1-F1 native surviving\|combat S1/S4' --maxWorkers=1` | 1 | 3/1/26 | 字段/施杖前缀修正；plain新增变形布景改变原后续walking route，失败并非raidActor/时序/OOS |
| 同两文件`-t 'S4 public\|R1-F1\|combat S1/S4\|S5' --maxWorkers=1` | 1 | 8/2/20 | F1四组合长暂停、目标层实际到达/真实死亡、动作及writer窄回归过；两失败仍为改动原录像布景后的walking route |
| `src/ext/modules/settlement/tests/settlement_raid_replay.test.ts --maxWorkers=1`，最终 | 0 | 5/0/0 | 原完整公开击杀解围布景/断言恢复；另加独立命名的两组合公开变形→暂停→返回存录回归。save/load、完整replay及关键seek均过 |
| `src/ext/modules/settlement/tests/settlement_raids.test.ts src/test/phase3b_action_lifecycle.test.ts src/test/c_5_fall_subsystem.test.ts -t 'R1-F\|combat S1/S4\|S1/S2\|S4\|S5\|cached\|failed floor\|polymorph\|高血怪\|飞行怪' --maxWorkers=1`，最终 | 0 | 20/0/43，3文件 | 原生变形取消/坠落守卫、普通缓存攻击拒绝、真实冻结/返回未解围、多次离层、有效结束不追补、坏档原图不变、UI零写、17段等价及关闭/水位writer回滚 |
| 原外部config同命令，最终生产源 | 0 | 6/0/0 | 未改独立脚本/config或正确预期；原offset/有限订单、分摊/耐久保底两项保持通过 |
| `npm run check:modules` | 0 | 不适用 | 模块边界及测试归属过 |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b`，最终 | 0 | 不适用 | 实际类型检查过 |
| `npm run build`，最终 | 0 | 不适用 | 实际vue-tsc+vite构建过（5.69s）；既有500kB chunk提示仍在 |

新仓库回归不是纯planner/布尔：四组合公开变形后同身份与出生登记、超过32周期缓存再存读/返回；第9层原生幸存fall→pending/目标层实际到达→真死亡另一分支及save/load；非终结成员仍保持袭击、最后结束后排除累计不变。坠落前后实际原生death事实、场上item ID、玩家gold及真实growth progression experience精确守恒；恢复存档后原生存活实体仍由原所有权根持有。伪改当前形态/出生白名单、抹去真实坠离及矛盾时序均拒绝且原对象图不变。原动作冻结用例增加四组矛盾时间，仍保原bundle/资源/return推进断言。UI用真实非零摘要、楼梯返回而未进region、保存读取、实际region发布和重复读/重复wait一次性断言。

新增变形录像的初始wand/材料/几何是受控origin准备，其后营地、施工、招募、施杖、楼梯及等待走公开Game命令；覆盖到变形后的暂停和返回。原有公开原生击杀→关闭→恢复录像保持独立覆盖，不把新增用例称为自然地牢全路线或穷举变形击杀矩阵。

### 交接与剩余项

F1–F3的确认复现现已通过作者复测，尚待父第2轮独立复审；本轮没有剩余已复现未修复玩法/存录失败，没有不可逆合同阻断。独立报告原文保留。浏览器/截图、全部原生形态/盟友/奖励及writer×阶段矩阵、真实劳动信用连续路线/全部日配额、完整组合/删除/最大负载等覆盖仍列5Z。此处只引用首实施及第1轮审查已有通过摘要，不累计47/141等重叠数量。

本轮未重跑整套drift/性能、全量或浏览器，也未更新黄金/生成基线。此前0.615416ms/8.382041ms是首实施版本的已测摘要，不冒充R1修复后重新计时；本轮未改压力/分摊/生产公式、规则指纹或黄金输入，缓存许可无暂停事件时先短路。结束交接至`fix-r1.READY.md`后停止共享树写入，仅等待父安排最终独立复审及必要resume修复。

R1交接最终静态检查：`git diff --check` exit0；九冻结SDK 9/9与HEAD相同；实际分支`ext/phase5`、HEAD`5c34f50f56bcf85f4cee890ae80dec87fa927831`；改动文件无CRLF或>1MB原始材料。独立报告未改，最终门禁后仅追加报告/入口/状态/5Z及外部交接摘要。


## 第2轮独立审查后的最后一次作者修复（2026-10-09）

父采纳独立报告末章的**R2-F1：伪造departed可关闭仍在营地层的真实袭击者**，resume本会话仅做末次窄修。独立[发现原文](phase5e1.review-findings.md)及外部`review-r2-probes.test.ts/config.ts`均未改；此处追加作者结果，不改独立裁决。第2轮也是最后一次作者修复，后续交父核对提交，不开启第三轮独立审查，不等待其它任务。

### 修复及必要生命周期影响

候选引用校验现把非null坠离声明与真实实体所有权核对：存活实体须真正离开营地层的在场/缓存阵容，或仍由原生pending队列持有；仍实际在营地层的成员不能凭声明退休。事件终结同样核对真实离营，不能仅凭布尔式非null事实关闭。校验发生在候选替换活局之前；新仓库回归检查原runtime、combat state/definition、真实scheduler、actorActions及完整对象图/digest保持原身份/内容，后续公开wait仍active、敌人仍存活，再存读一致。

不把初次目标层变成永久位置限制，也不恢复旧出生形态限制：真实幸存fall保原实体、HP、pending/目标层及以后真实死亡；后来其它层所有权不要求永远等于首次目标层。pending尚未落地不等于在营。若未结束事件的原成员通过原生接近楼梯/前台恢复路径真正发布回营，其坠离有效状态清除，重新计入同一事件的有效成员；只在成功原生实体发布后处理，失败落点仍保pending，不由load/UI补写事实。此必要处理避免严格拒档把合法后续回营也当坏档。没有新出生/新波次、伪死亡/掉落/XP、实体删除或经济追补；原被围暂停、排除累计、奖励/死亡路径不改。

只改`SettlementRaids.ts`的真实离营核对/终结资格及原生回营登记、Game原生发布接点和现有袭击测试。没有新增持久字段、版本或迁移；foundation13/world5 schema4/settlement1.3.0 state2及九冻结SDK/golden保持本候选原状，实际HEAD仍`5c34f50`。未commit/push/切分支/派代理；未改父维护的commander-status/HANDOFF/README入口。

### 实际命令与结果（分批不累计）

Node24.19 PATH、`NODE_OPTIONS=--max-old-space-size=3072`；Vitest均`--maxWorkers=1`，重检查串行。Vitest公共前缀为`node node_modules/vitest/vitest.mjs run`。过滤来自`-t`，没有新增skip、改独立/旧断言或延长超时。

| 实际参数/检查 | exit | 通过/失败/过滤 | 结果与准确归因 |
| --- | --- | --- | --- |
| `--config /private/tmp/brogue-commander-20261009-5e1/review-r2-probes.config.ts --maxWorkers=1` | 0 | 2/0/0 | 原外部2项：伪造声明拒绝；同输入末成员与玩家真实坠层，关闭先于冻结，原实体/HP、排除、death/XP/gold及存读保持 |
| `src/ext/modules/settlement/tests/settlement_raids.test.ts -t 'R2-F1\|R1-F1 native surviving' --maxWorkers=1` | 1 | 1/1/26 | 原真实fall链通过（新增原生回营分支亦过）；新拒档用例误把每次新建的actorActionBinding DTO外壳当session身份，拒绝已经发生，失败并非活局替换 |
| 同文件`-t 'R2-F1' --maxWorkers=1` | 0 | 1/0/27 | 前提改为实际持久state/definition/真实scheduler身份，完整图/session/digest及公开wait不假关闭/存读均过；没有改原独立或旧测试断言 |
| `npm run check:modules` | 0 | 不适用 | 边界及测试归属通过 |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b`，首轮 | 2 | 不适用 | 内部camp条件表达式带false联合类型，`.depth`报TS2339；明确undefined分支后保持运行期条件语义 |
| 同类型命令，最小修正后 | 0 | 不适用 | 仅复验受影响类型检查，不重复已通过测试批次 |
| `git diff --check`及九冻结只读核对 | 0 | 九冻结9/9 | 原SDK保持，无新封存或多版本源树 |

现有真实fall用例保持原断言：长被围区间不补经济、非末成员坠离后事件继续、pending/目标层保实体、后来真死亡可存读、末次关闭排除累计不变及奖励/死亡事实守恒。本轮增加后续真实回营分支：受控原生接近楼梯队列前置，转移由公开wait的原生sink执行；回营同身份存活，坠离有效状态清除，同事件仍active，save/load一致。不是全自然地牢路线或完整原生迁移矩阵。

### 确认遗留与覆盖分别登记

R2-F1已完成作者修复及上述窄复测，交父核对，不宣称新独立审查或已独立关闭；当前没有作者已知未修复的确认正确性失败。历史独立失败和本轮DTO/类型前提失败均保留，不合并累计。R1-F2/F3的closed裁决及此前原6探针/回放等通过只引用第2轮独立报告，不重新执行或冒充本轮结果。

覆盖仍留5Z：全部形态/盟友奖励/原生回迁和writer阶段矩阵、真实劳动信用连续链/全部日配额、组合/删除/最大负载、完整门禁及浏览器/真机等。本轮没有穷举全部恶意存档，没有build、全量、整套drift、性能、新浏览器/证据矩阵或其它任务。最后交接`fix-r2.READY.md`后立即停止共享树及外部摘要写入并退出，由父核对提交，不自行循环。
