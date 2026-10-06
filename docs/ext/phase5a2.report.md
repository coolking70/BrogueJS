# 5A2 交付报告

> 5A2a–f 与独立审查 H1–H3/M1–M5/L1–L11 已修复；审查处理、最终开发期门禁与性能门槛见 §9，修订冻结候选见 §7。按授权不 commit、不 push；候选提交位由集成人填写。骨架使用纤维、工具、桌套件和匕首，fixture 使用石材；均不依赖菌丛或口粮配方。

## 1 基线与范围

开工 HEAD `8e946bb`（`ext/phase5`），工作区干净；任务所填 `c3319ae` 是其直接父提交，已包含 `b2547d6` 的 5A1/5A1-R 验收内容。预先裁定按维护者全部批准执行。读取 AGENTS、HANDOFF、development、architecture、ext README、任务书、C5-1/1.0.0 r2、5A0/5A1 报告和 5B 删除菌丛/口粮后的设计。

硬前置核对通过：RecordingV4、RecordingStorage、三逐事件域与 chunk 完整摘要、U03 绑定均存在；起始 actorActions 是空域。初始 foundation 6、whole-run v4、录像 4、来源 2、IDB 2、combat 1.5.0/schema 3；无独立实体 codec。growth 1.7.0、narrative 1.4.0、giants 1.0.0 与报告相符。`escape` 经 executeCommand 录制且零时间，审查后确认地图三处 UI 都走录制 mouse_travel，移除多余 escape 前置。没有修改生成算法、属性求值读取点、growth policy、正式 crafting 内容或依赖。

原代码事实均成立：combat 持 scheduler/nextActionId；runtime 限制单一攻击定义 provider；三分配者及篝火依赖私有根；扩展命令先 rest/parry/dodge/phased 再通用分派；背包 26 字母、ItemCategory 止于 12；自动行为原有 rest/search/run。迁移后的实际位置见 §3、§4。独立基线导出在 `/private/tmp/phase5a2-baseline`，用于反事实，不触及当前工作区。

| 协议/模块 | 起始 | 本步最终 |
| --- | --- | --- |
| FOUNDATION_PROTOCOL | 6 | **7** |
| whole-run / 实体共用外壳 | v4 | **v5**，无独立实体槽 |
| 录像 / 来源 / IDB | 4 / 2 / 2 | **4 / 2 / 2**，头 codec 为 wholeRun 5/foundation 7/origin 2 |
| combat module/rules/state | 1.5.0 / 1.5.0 / 3 | **1.6.0 / 1.6.0 / 4** |
| growth / narrative / giants | 1.7.0 / 1.4.0 / 1.0.0 | 不变 |
| World SDK / C5 合同 | — / 1.0.0 r2 | **1 / 1.0.0** |

combat 数据指纹包含 module/rules 版本，随 1.6.0 重算；攻击数值和规则未改。giants 持久布局没有私有 scheduler，故不升号。纯 planner 的 schema 1 试算状态保留局部计数；生产 combat state 是 schema 4，不再拥有动作钟或分配器。growth 同名计数保持原义。

## 2 实现与内部选择

| 子项 | 结果与代码 |
| --- | --- |
| 5A2a 中立动作根 | `ActorActionsRoot.ts`，run 根静态随 combat provider 或 world5 建立；owner 严格为 combat/foundation。全部生产 ID 与唯一倒计时迁出；攻击、闪避、弹反、身体动作及 combat 篝火仍用原费用/阶段/收据。runtime provider 仅声明 definitions，保留单一 provider 检查。严格 load 在退休当前局前检查根存在性、ID、高水位、owner、引用与票据镜像。 |
| 5A2b 物品与所有权 | MATERIAL=13；仅 MATERIAL 持 `worldItem`，native 省略属性。固定 +0/已知名原生装配不抽 RNG。99 上限、工具不合并、FOOD quantity 占格、原生拆分重绑定义。唯一 `WorldItemRoots.ts` 供预算/所有权/容器实体图收集；C5 新增 admission 7168，原生生成不受此门槛限制。D9 各使用入口零时间拒绝；原生掉落、漂走、坠落、偷取延用现有路径。可信内部 transfer 原子修改归属并返回 100 tick 报价；公开命令表已移除 world:transfer，5C adapter 尚未开放。 |
| 5A2c 世界根与放置 | world5 打开 containers/nodes/stations/活跃 tickets/terminalTickets/definitionsFingerprint/pendingPlacements/startupGrants；structures/restPoints 保持关闭。实体图提供容器真实 Item，escrow 不复制第二 owner。虚拟整型再生纯读，commit 物化不升 node.revision。SHA 拒绝抽样、稳定候选顺序、maxPerDepth/maxPerRun、skip/defer 一次重试、一次启动礼包与预建 remains。832 子预算及 1024 全局预算；`setOwnedRegions(world, list)`，空列表删除键。 |
| 5A2d 工作 SDK/事务 | `worldSdk.ts` 对齐合同导出类型；运行期仅两个常量和两个层助手。descriptor worldSdk=1 与模块能力一致；pure/sync prepare、短命 scope/handle、CAS、canonical 重 prepare、tool-break Yes/No。全部批次先 escrow 并预留输出与退款；每批一个 bundle/录制命令，间隙 auto_step 续作；中断/取消退款一次。完成失败按真实错误分类、回滚后尝试送达取消参与者；取消参与者自身失败才走不送达兜底，NPC 真实原生自由决策一批一次。冻结读 DTO、投影及同一已提交事实。 |
| 5A2e 自动行为审计 | 21 调用 + 定义、三原直接写全部归类；执行期间的 session 断言、确认挂起时清执行标志、B 入口早退；地图三处 A 路径各录一条 mouse_travel。审计与对应测试见 §4。 |
| 5A2f harness/冻结示例 | 真实 Game、save/load/v4 replay/seek/续录及首个可验证分歧；craftskel 四命令、参与者/投影和 c5fixture。不进 catalog/生产构建；模块边界拒绝内容模块引用可信写口，拒绝生产引用 ext/testing。11 组合 smoke。冻结清单见 §7。 |

自行决定的实现细节：

- 内部按 definitions、唯一 Item 根、读/预算/空间助手、放置、事务、load 引用校验与 transfer 拆文件；未派发的 SDK 1 修订 CommittedWorkFact.result 增加 accepted，并导出 TerminalWorkTicket 摘要类型。
- `worldWorkDetails` 是 foundation 的持久 sidecar，保存 anchor/HP/toolId/workTicks/放台位置/中断理由；事实按每 owner 滚动 128 条。二者登记 world5 摘要域；并未建立第二倒计时。
- 事务按明确写集使用 scoped 检查点与 runtime.transaction；恢复世界/动作/容器/背包/地面/事实/详情/autoAction、原生 actor 时钟、ID/RNG/日志与 session。完整 native 图 oracle 保留，runtime JSON 值单独比较；缓存层和 grid 不在生产事务遍历中。
- 输出/退款按可独立存放的 fallback stack 预留槽，`mergeTargets=[]`；实际发布仍稳定合并。此保守策略可能拒绝只能依靠填满既有 stack 才能容纳的方案，但保证原生拾取等入口占用合并空间后仍能退款。counts 同时保留全部尚未产出/退款数量。
- `cancel-work` 不先走通用输入取消，否则 payload 的 ticketRevision 会被前缀修改；由其自身 CAS/取消事务执行。其它非 auto_step 输入在录制栈中取消。
- NPC 本步证明为有真实实体的 fixture 采集→箱；没有招募、订单或离线生产。`suspended` 只接受 schema；item-delta/ticket-progress 离线效果仍 C5_UNSUPPORTED。
- 合同 WorldErrorCode 实际列 **33** 个，任务书所称 34 与冻结联合类型不符；以合同为准，33 个 foundation locale 键齐全，不新增错误码。
- SDK 保留合同的 fungus kind 与原生 ration template 类型；示例和 fixture 没有菌丛/口粮内容，未替 5B 恢复已删除配方。

## 3 状态、摘要与定位

新 run 字段：actorActions→actorActions 域；worldWorkFacts/worldWorkDetails→world5 域。worldContainerItems 为实体图的 derived 索引，不形成第二 owner；executingRecordedCommand/worldWorkCommandEpoch 为 session，不持久化。autoAction 增加 auto_work/ticketId，仍归原 native 摘要域。Item 的 ITEM_FIELDS 增 worldItem；native 行无 own worldItem，明确的 undefined 也拒绝。新字段在 U03 与 recording-digest 合同一一登记。

`ActorActionScheduler` 在扣钟后同步 ticket.remainingTicks，镜像不递增 revision。world5.simulationTicks 继续只有原唯一 clock commit；foundation 工作只经 bundle 承担世界时间。没有给 commit 额外加世界钟。投影读最后物化节点；prepare/readWorkContext 计算虚拟物化值。

| 核对点 | 最终代码定位 |
| --- | --- |
| production combat schema 4，无私有 scheduler/nextActionId | `src/ext/actorActions.ts:51`；provider 单一检查 `src/ext/runtime.ts:232`，binding `:1516` |
| 中立根存在性、严格读取 | `Game.ts:964` 新局，`:11387` 保存，`:11508` load 预检；`ActorActionsRoot.ts:14` |
| phased / rest / fixture ID 分配 | `PhasedAttackProduction.ts:275`、`:307`；`WorldRestProduction.ts:111`；`ActorActionAuthority.ts:57`（纯 fixture 的独立局部根不持久化） |
| ext 分派顺序、命令栈标志 | `Game.ts:3737`、`:3759` rest→world-work→parry→dodge→phased→generic |
| autoAction 联合类型/自动工作写口 | `Game.ts:654`、`:13373`–`:13380`；原生 autoAction 写入 `:14453` |
| MATERIAL / worldItem / 26 格、99 堆叠 | `Items/Item.ts:25`、`:68`；`Items/Inventory.ts:14`；`Items/WorldItems.ts:19` |
| 实体行 / 图 / 容器根 | `EntitySnapshot.ts:11`、`:99`、`:115`；`WorldItemRoots.ts:6`、`:64`；`WholeRunSnapshot.ts:175` |
| whole-run v5 / 三域摘要 | `WholeRunSnapshot.ts:37`、`:188`；`RecordingDigest.ts:43`、`:197`；U03 登记 `scripts/u03-state-contract.json:486`，域绑定 `scripts/recording-digest-contract.json:42` |
| 原篝火中断 / 工作相同谓词 | `WorldRestProduction.ts:148` 的 `interruption` / `:131` interruptWorldRest；`WorldWork.ts` 的 `interruptReason`，另在状态失效时检查工具/工位/资源/交互线 |
| 保护生成 arena | `runtime.ts:1526`，只读取有 generationContributions owner 的持久 region；`WorldWorkWorld.clearWorldCell` 使用该只读资格 |

原来 `stateField==='scheduler'` 的模块根声明已删除；actorActionBinding 仅提供 combat 定义与 ledger，不再持有 clock。native 局没有 world5/actorActions/material 域；MATERIAL 材质采用底座显示与 i18n，不引入正式 crafting 模块。

## 4 stopAutoTravel / autoAction 审计

A = executeCommand → applyCommandStages → 相应 stages；非 auto_step 输入前缀是工作取消主入口。B = UI/session 可直接调用，auto_work 时先早退。GameCanvas 地图三处都是 A：executeCommand('mouse_travel')，由同一命令前缀取消工作，无需额外 escape。`stopAutoWorkInCommand` 在 session 标志为 false 时抛内部错误。初始化/恢复不是停止，不进入取消事务。

下表逐点覆盖全部 21 个调用；行号均为最终 `src/engine/Core/Game.ts`。测试缩写 R 指 `ext_actor_actions_root_world.test.ts`，分别包括五个 B 入口快照守卫、六种 A 命令取消退款+真实 replay、内部断言与单条 UI mouse_travel。

| 行 | 函数 | 类别/调用链 | 处理与测试 |
| ---: | --- | --- | --- |
| 3765 | applyCommandBodyStages | A：executeCommand→applyCommandStages | 非 auto_step 前缀取消；cancel-work 留自身 CAS；R 六种输入 |
| 4526 | performPlayerActionStages | A：move→performPlayerAction | 非自动步停止；R move |
| 4899 | performPlayerActionStages | A：auto_step→自动移动/拾取 | 命令内；work 分支在路径前，R auto_work 多批/取消 |
| 9818 | requestConfirm | A：命令 generator→确认 | 命令标志在确认 yield 期间为 false、恢复执行时为 true；R item:command，SDK tool Yes/No |
| 9978 | confirmPlayerMoveStages | A：move→必死移动确认 | 命令内；R move |
| 13450 | handleAutoExploreStages | A；public raw handleAutoExplore 是 B | B wrapper auto_work 早退；R auto_explore / B snapshot |
| 13470 | handleAutoExploreStages | A：auto_explore→探路失败 | 同上 |
| 13512 | recomputeExplorePath | A：auto_explore/auto_step；raw 是 B | raw auto_work 早退；R B snapshot / auto_explore |
| 13536 | handleMouseTravelStages | A：mouse_travel；public raw 是 B | raw auto_work 早退；UI 单条 mouse_travel；R mouse_travel / B snapshot / UI |
| 14377 | setAutoPath | B：公开 UI 路径（也可由 A 调用） | 函数最前 auto_work 早退；R setAutoPath snapshot |
| 14390 | setAutoPath | B：公开 UI 路径第二分支 | 同上 |
| 14422 | autoTravelDisturbed | A：auto_step/beginAutoAction；raw 是 B | raw auto_work 返回 false；R B snapshot；威胁中断 failures |
| 14468 | beginAutoActionStages | A：rest/search/run | 输入前缀先取消；R rest |
| 14513 | stepAutoActionStages | A：auto_step | work 分支先返回；其余原逻辑保留；harness auto_step |
| 14524 | stepAutoActionStages | A：auto_step run | 同上 |
| 14531 | stepAutoActionStages | A：auto_step rest/search | 同上 |
| 14553 | stepAutoPathInnerStages | A：auto_step→performAutoPathStep | work 在路径调用前处理；R/UI mouse_travel 与组合 smoke |
| 14570 | stepAutoPathInnerStages | A：auto_step→探路 | 同上 |
| 14597 | stepAutoPathInnerStages | A：auto_step→移动失败 | 同上 |
| 14602 | stepAutoPathInnerStages | A：auto_step→停止 | 同上 |
| 14612 | stepAutoPathInnerStages | A：auto_step→路径耗尽 | 同上 |

第 22 个 grep 命中为定义 `Game.ts:13410`：auto_work 调 stopAutoWorkInCommand，只有实际执行命令时标志才为 true，确认等待期间为 false。三原直接写：`:949` 新局初始化（B）、`:11695` load 恢复（B）、`:14368` setAutoPath（B，早退保护）。beginWorldAutoWork / clearWorldAutoWork 是 scoped commit/settlement/取消写口；普通 beginAutoAction 在 A 栈中。`GameCanvas.vue:1002/:1019/:1045` 三处均直接 executeCommand('mouse_travel')，分类全部为 A；已移除 prepareTravel 与 escape 前置。R 保留五个 B 入口完整快照守卫、六类 A 命令取消/退款一次并真实 replay；UI 测试验证只录一条 mouse_travel。新增审查回归检查确认挂起标志和 disturbed 取消来源。旧审计原始索引仅作历史证据，当前行号以本表为准。

## 5 首轮测试、反事实与黄金（审查前证据）

统一环境：Node 24.19.0 PATH 前置，NODE_OPTIONS=--max-old-space-size=3072，Vitest --maxWorkers=2。只跑开发期相关文件，没有 npm test、全部 test:ext、removal、CE full/gen。没有触及原生生成算法，因此未额外跑 drift；UR 与 giants 自然生成证据独立校验原生状态/RNG。

```sh
export PATH='/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':"$PATH"
export NODE_OPTIONS=--max-old-space-size=3072
node scripts/check-module-boundaries.mjs
npx vue-tsc -b
npm run build
npx vitest run $(cat /private/tmp/phase5a2-final-related-files.txt) --maxWorkers=2
npx vitest run $(cat /private/tmp/phase5a2-final-combat-files.txt) --maxWorkers=2
```

| 门禁 | 退出/实际结果 | 耗时与证据 |
| --- | --- | --- |
| 最终 boundary/ownership | 0；包含 SDK 私有入口与生产测试目录隔离 | 1.67s，`phase5a2-boundaries-final8.log` |
| 最终 vue-tsc | 0，含可信入口负向类型检查 | 7.95s，`phase5a2-types-final8.log` |
| 最终 build | 0；既有 >500kB chunk 提示仍在；生产 JS 扫描 craftskel/c5fixture/world-work-basic/createWorldHarness/crafting-skeleton 全部无命中 | 10.09s（Vite 2.68s），`phase5a2-build-final9.log`；隔离扫描 `phase5a2-build-isolation.json` |
| 最终相关集 | 0；**77 文件、1381 pass、2 skip** | 1015.47s，`phase5a2-final-related.log`；逐文件清单见附录 A |
| 全 combat + 直接关联 giants | 首次 54 文件，942 pass/4 fail；三黄金随后归因重录、D11 原 timeout 单独复测通过 | 1506.59s；详见下文；完整文件清单 `phase5a2-final-combat-files.txt` |
| 收尾 C5 / NPC 取消回归 | 0；**8 文件、124/124**；其后 transactions 新增共存测试单独 **20/20**，底座新增合计125项 | 150.93s（JSON 最晚完成边界），`phase5a2-final-c5.log` / `.json`；共存32.65s，`phase5a2-final-coexistence2.log` |
| 迁移后三个 giants 自然黄金正常守卫与 arena | 0；**4 文件、16/16**（三个黄金 + arena +12条 boundaries） | 32.81s，`phase5a2-final-giants.log` |

77文件批次在最后 NPC 取消重入修复前完成；其后仅该 C5 finish 回调有生产行为变化，已重跑全部底座新增 C5（124项）和新增共存后的 transactions20项、giants自然/arena/边界16项、boundary/types/build。没有把不同输入候选混称为一次冻结全量执行。本步新增9文件126项（底座8文件125项、giants arena1项）最终均通过；11组合 smoke 包含真实多批工作、存档、逐条 replay、seek 与续录。

2 个真实 skip 都是既有 CE 源码对照：`u_14a_status_gaps:184` 的 fear/darkness CE 引文，以及 `u_26a_deep_levels:30` 的 26/40 常量与 lumenstone 配额。原因是 `.ce-reference` 缺失；其它无 CE 的功能仍实际运行。没有新增 skip/todo。使用 `-t` 的 NPC 反证批次中 18 项是过滤未执行，不计入真实门禁 skip。

旧测试前提迁移遵守反事实规则：原 `8e946bb` 生产及原测试在独立导出中，combat_runtime/bonfire_runtime/giants_zones **95/95** 通过（62.59s，`phase5a2-counterfactual-baseline.log`）；foundation/recording/world5 与 UR3/UR4 **55/55** 通过（111.94s，`phase5a2-baseline-attribution.log`）。修改的旧测试仅把私有 scheduler/nextActionId 读取或构造移到 Game 中立根、state schema 3→4、module 1.5→1.6、foundation 6→7、whole-run 4→5，并向 provider fixture 提供真实中立根。part-break fixture 读 detached DTO 后通过可信中立根适配器发布；断言的费用、打断、来源、历史、重放与整体身体语义未放宽，无 skip/todo 或超时调整。

进一步在当前实现独立副本 `/private/tmp/phase5a2-root-counterfactual`，**只回退中立根迁移及耦合格式/模块身份这一变量组的 27 个原生产文件**；当前 Item/Inventory/EntitySnapshot/theft/display/C5 helpers/scripts 保持。原测试版本恢复作为旧守卫输入（不改原断言），相同 runtime/bonfire/giants zones **95/95 通过、115.33s**。精确变量组与原测试路径登记 `phase5a2-root-counterfactual-fields.json`；这是跨文件表示迁移的单变量组，未声称只回退单文件或全部 29 个旧文件均做过此反证。实际旧前提调整 29 个文件完整列于附录 B。

生产缺陷修复：迁出后的动作根必须进入回滚检查点；load 候选用普通 detached host，避免 Object.create(Game.prototype) 触发 monsters setter；NPC 完成需在原生边界立即结算，避免下一次 prelude 再启动同批；异步 prepare 要消费拒绝 Promise；材料原生拆分需重绑定义；unitsPerHarvest 不能固定为 1。收尾 NPC 取消新回归在修复前实际失败（期望一条 cancel fact，得到两条；`phase5a2-npc-cancel-before.log`）；只修 production，结束回调在同 ticket 发布事务内不重入取消，回归断言未改。其它失败涉及新测试场景、时间戳归一、未初始化 growth 起始命令，按实际前提修复。共存测试首轮误给 StationRecord 添加非合同字段 at，严格保存与 TS 守卫拒绝（19 pass/1 fail；types exit2）；只移除测试的额外字段、移动既有实体位置，改用当前 TS lib 支持的数组读取，原 BUSY/收据/快照断言不变，20/20 复测通过。新 arena 测试的跨模块 helper import 被 boundary 拒绝；测试移入 giants 自有目录、登记当地 manifest，守卫未放宽。

完整 combat/giants/生命周期 54 文件 **942/946** 通过（1506.59s）：三个自然 trace 仅 extensionsHash 改变；D11 自然路线所有断言完成但并行耗时 254.642s，超过原 240s。保持超时，单独复测 **1/1** 通过（157.09s 测试 /158.55s 总计），`phase5a2-giants-natural-alone.log`。不将超时批次冒称通过。

### 黄金归因

- UR3：四 seed×30 断面，120 原始文件、240 叶仅 `snapshot.schema` v4→v5、`snapshot.version` 4→5；归一后全部对象完全相等。每个原生/RNG 字段保留。
- UR4：112 叶，30 schema、30 version、52 recorded chainDigest。链摘要变化由 codecIdentity 和新外壳派生；所有其它字段完全相等。
- 六个生产协议文件组成单一外壳变量组，在独立当前代码副本只回退该组到 wholeRun4/foundation6（包含 RecordingDigest.codecIdentity），原 UR3/UR4 守卫通过。首次漏回退 codecIdentity 的失败保留，不用于通过证据。日志为 `phase5a2-format-counterfactual-real.log`（UR3）和 `phase5a2-format-counterfactual-ur4-fixed.log`（UR4）。
- 按原 UR3_CAPTURE / UR4_CAPTURE 方法捕获，`phase5a2-golden-current.log` **2/2** 通过、54.65s；原始 before/after 在 `/private/tmp/phase5a2-golden/`，逐叶登记 `/private/tmp/phase5a2-golden-fields.json`。两份 gzip 黄金按原方法发布；既有 >1MB 的 UR4 gzip 是仓库黄金，不提交额外原始大证据。
- giants：同一真实自然路线 before/after 完整 extensions 对象，仅各自 `foundation.version` 与 `manifest.foundation` 两叶 **6→7**；其余逐叶完全相等。六叶登记 `phase5a2-giants-fields.json`，原始 `phase5a2-giants-{before,after}-{natural,colossus,spine}.json`。单一协议变量组回退后原守卫 **3/3 pass，36.56s**（`phase5a2-giants-format-counterfactual.log`）。按原 `BROGUE_CAPTURE_GIANTS_TRACE=1 npx vitest run src/ext/modules/giants/tests/giants_trace.test.ts src/ext/modules/giants/tests/giants_spine_trace.test.ts --maxWorkers=2` 重录，**3/3 pass，34.55s**（`phase5a2-giants-capture.log`）。三个仓库黄金仅以下派生叶变化；commands/state/world/RNG 的其它字段严格相同。

| 黄金文件（giants/data） | 字段 | 原值 → 新值 |
| --- | --- | --- |
| `natural-trace.json` | extensionsHash | `9dfc37efea718c3e8c53ff371d4aa60184352bcc2b7d66b78350744e063df6fb` → `b9b32e012e9d5aa3e45c967cc054ae1541152af96c41e55a8dc30b985aff9075` |
| `colossus-natural-trace.json` | extensionsHash | `534aea914dd904ec011f5ba6a3eb8d0b29c15ca4c5be235a326b5b00c85ee962` → `c91c21b13e36aade93235c3e2073562ef2191921b60f3e13a27721126fefd6e6` |
| `spine-natural-trace.json` | extensionsHash | `3524312501d49f65201435acabe7942d38bd7802a8cc650dac71c187d5cf7c04` → `964b29e2e5a0c6773cd412681200ba464fa4a49869718aa4fdb86258df9e5237` |

UR2 不改。UR3/4 每一变更文件、叶路径、前后值登记在上述仓库外 JSON；不存在其它未登记变化。

### D15 与首轮录像 P95

D15 初始 HP=1/maxHp=300、regen carry=0.1、nutrition=1800，清除敌人；同 10000 客观 tick，对照原回血公式，没有改回合/饥饿/回血读取点。证据 `/private/tmp/phase5a2-D15.json`。

| 分批 | 末 HP | regen carry | nutrition | elapsed | 回合 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 10000 tick×1 | 2 | 0.0940357852882705 | 1700 | 10000 | 1 |
| 1000 tick×10 | 11 | 0.040357852882704215 | 1700 | 10000 | 10 |

交接 5B：配方每批保持短，建议 ≤1500 tick；长工序拆多批。总时长相同不等于回血次数相同。

以下为审查前历史数据，工作局性能与最终候选门禁由 §9 取代。P95 按 5A1-R 同轮配对法：2049 条真实命令，前 32 预热排除、每 256 边界单列，2009 对 current−v3 差值取分位数。经典/0 营地使用实际 2cd10a5 v3 Game 的 Vite 内存替换与当前周边模块；工作局维持当前 C5 Game，仅回退两个 v3 录制方法，真实每批执行。测量期间不与自己的测试/构建并跑。证据 `phase5a2-perf.mjs` / `.json` / `.log`。测量前后 996 个 src/scripts/public 输入一致，聚合 SHA-256 `03202fb6fc532a4def5fd49d84b00a121aa1d715ce3b078a15a9a797409a727a`。测后新增 arena 保护/定义输出计数校验/ticket admission/NPC 取消保护及相关测试；2049 条该采样路线未走这些分支，录制方法未再修改。本轮性能数值对应该明确采样输入，不声称是最终最大状态压力结果。

| 场景 | 5A1-R 新增 median / P95 ms | 5A2 新增 median / P95 ms | current 整条 median / P95 ms | chunk median / P95 ms（n=8） | 已批准阈值/结论 |
| --- | ---: | ---: | ---: | ---: | --- |
| 经典 control | 0.050 / 0.053 | **0.048624 / 0.052250** | 0.050166 / 0.054750 | 130.752750 / 316.404167 | 新增 P95≤1ms，通过，未观察经典成本增加 |
| 扩展 0 营地 | 0.116 / 0.122 | **0.122417 / 0.133875** | 0.132334 / 0.150041 | 135.174542 / 324.850958 | 新增 P95≤5ms，通过 |
| 骨架工作局 | 5A1 无 WorldWork 路线 | **58.150083 / 113.716500** | 135.142459 / 214.491500 | 386.954708 / 828.028417 | 没有已批准独立工作阈值；明显成本，不能标为性能通过 |

工作局完成 2049 批，使用无怪物、1 tick 纤维→纤维、耐久 10000 的合成定义以持续闭环，累计 1025 个票据；v3 recorder 对照 median/P95 76.040792/102.260667ms。这些历史数据揭示 H1/H2/M1；审查修复后的有界历史、scoped 检查点和标脏域摘要结果见 §9。经典/0 营地已批准阈值未超，故未触发合同回退顺序。

## 6 交接 5A2-S / 5A3

5A2-S：combat module/rules **1.6.0**、production schema **4** 已分配，容量物化共用，不再升号。actors 中 combatStats 尚按既有读取点保留，本步没有预改统一属性管线。容器/escrow/refund/remains 不贡献装备属性。属性来源收集必须使用唯一 forEachItemRoot。不得改 worldSdk 的 ItemDefinitionContribution/WorldItemFields、ResourceDefinition、StationDefinition、RecipeDefinition、WorkTicket、WorkContext、WorldPlanHandle/WorldCommit/CommittedWorkFact 或四 payload；合入后重跑 crafting save/replay/seek/自然 trace，不承诺开发期中间存档兼容。

5A3：复用 setOwnedRegions(world,list)，空列表删除键。C5 创建使用 832 子预算，给其它扩展留下 192 个 interactable；同一全局 1024，不另建 ID 空间。结构/RestPoint 仍未开放。现有工作位/对角/交互线实现位于 WorldWorkWorld.workPositions/stableGround/clearWorldCell 与 ext/worldSpatial.hasInteractionLine，新增空间适配不得悄改逐格资格。生成 coordinator 的临时 reservedMask 在 enteredLevel 前已回收；本步因此读取持久生成贡献 owner region 作为 C5 放置保护，真实 seed7306 D3 arena 与 save/load 后测试通过（`giants_c5_placement.test.ts`），没有改 native 生成或 reservation。工作位与交互线资格不变。

## 7 5B 冻结候选清单

| 项目 | 实际接口/政策 |
| --- | --- |
| 集成候选 commit | **集成人填写**；本轮未 commit。填写并验收后才作为正式派发基线。 |
| SDK | `src/ext/worldSdk.ts`，C5_CONTRACT_VERSION='1.0.0'/WORLD_SDK_VERSION=1；SHA-256 `e2f3cbbf06fa9afd939ec3a3a5f75193d47003a08410fd1c5d2e8899051da05f` |
| harness | `src/ext/testing/worldHarness.ts`；SHA-256 `0cc14ecd4cf734591616b291239b3ef23b99e451af6f954a3de6de3f3143ba26` |
| crafting 骨架 | `src/ext/testing/fixtures/craftingSkeleton/`；目前唯一文件 `index.ts` SHA-256 `f4d70fd3b9be75444f181448ced4005c20d546c0cff7ce11eef366bb4a1a5372`；聚合 `7da2f828d4363cb8c09e024be4ac1ca32d907298f00d8ec029ab87f7aad5c6ad`（排序的 relativePath\tfileSHA\n UTF-8） |
| world-work-basic | `src/ext/testing/fixtures/worldWorkBasic.ts`；SHA-256 `a0267454f15f1b3c90649ab1a4945ddf1e055d40dc0072e776ab74265ca61ee1` |
| descriptor | foundation: FOUNDATION_PROTOCOL（导入 ext/descriptor），worldSdk:1；module.create() 填 worldDefinitions/worldWorkCommands/worldWorkParticipant。worldDefinitions = `{schema:1,worldSdk:1,items,resourceNodes,stations,recipes,startupItems}`（无礼包时 startupItems:null）。整包校验一次失败全拒绝。 |
| payload v1 | harvest：nodeId/nodeRevision/destinationId/destinationRevision/inventoryStamp；craft：recipeId/batchCount/stationId/stationRevision/sourceContainerId/sourceRevision/inventoryStamp；place-station：definitionId/x/y/inventoryStamp；cancel-work：ticketId/ticketRevision。module 为正式 crafting，自有 ID 前缀 crafting.，不得挪用 craftskel.。 |
| CAS | 底座按触及背包、节点、工位、箱、ticket 构造 casKeys；inventoryStamp 是 c5-inventory-v1 的排序 rows SHA 前16位。只有触及对象的版本进入 CAS。 |
| 命令/确认 | executeCommand('ext:command', JSON.stringify({module,action,payload}))。纯 prepare→临时收集 tool-break 答案→canonical 重 prepare→requestConfirm 记录一次→commit。No 一条事件、末 decision=false、0 tick/RNG/持久 ID。 |
| 读/显示 | `projection.worldWork` 只读最后物化状态，owner-bound readWorkContext/queryStations/queryContainers/previewRecipe/recentFacts；自有工位全当前层可读，其它 owner 工位/箱要已见。node/station interactable owner 为定义模块；地图/详情/完成取消礼包文案归 foundation；native 装配外观沿原生模板。 |
| 放置/礼包 | c5-place-v1 SHA 首32位拒绝抽样，候选 y/x 排序且不抽原生 RNG；固定向量见 ext_world_work_boundaries：seed51020001/dungeon.1/ordinal0/count5→index3/attempt0/word42723738；seed42/dungeon.7/ordinal2/count123→52/0/149204218；seed4/dungeon.1/ordinal0/count2147483649→561148371/3/561148371（definition均 craftskel.fiber-node）。defer 下次入层仅重试一次。D1 每 owner 一次礼包，入包→稳定近邻地面→skip；load/replay 不补发。 |
| participant | onCommitted(fact, tx)，tx.state 深冻结、replaceState 写自身 JSON；仅同步且返回 void。result=accepted 明确表示接收，completed 表示批次完成；放台接收无 PlacementReceipt。完成失败分类后尝试送达取消，仅取消参与者本身失败时采用不送达兜底。recentFacts 每 owner 保留 128 条，与 participant 所见事实一致。 |
| errors/i18n | 合同固定33码；foundation 键 ext.foundation.world.error.<去 C5_ 小写>，tool-break 键 ext.foundation.world.confirm.tool-break；模块可补更具体的自身 locale，玩家不见错误码。 |
| harness API | createWorldHarness({seed,mode?,modules,fixtures?})；ext/command/runAutoUntilIdle/readWorkContext/world5/save/load/exportRecording/replay/seek/digest/dispose；真实 Game，无 mock。firstMismatch 为首个可验证分歧，底座诊断保留上一个已验证边界到该命令的区间。 |
| auto_work | load 必须对应本玩家 working、多批、未完成的活跃票据，反向缺失也拒绝。每 actor 一张未终结票据；首批同步承时，多批 autoAction 保存 ticketId。每续作一条 auto_step；输入/威胁/伤害/移动/离层/失能/目标/工具失效取消未完批、释放预留、一次退款。bundle 存活时 ticket.remainingTicks 仅镜像。 |
| 票据退休 | tickets 只含 working/suspended，预算仅计活跃数（8192）。终结票据送达后解除关联并退休，nextWorldId 高水位不复用；terminalTickets 最近 64 条只供 UI/harness。已退休事实只放宽票据实体闭包，owner/定义/事实高水位仍严格校验。 |
| 基础定义指纹 | foundation 在 world5.definitionsFingerprint 持久绑定每 owner 的 canonical pack SHA-256；模块 rules 指纹遗漏定义变化也会拒绝旧候选 load。 |
| 硬数值 | 包26；material/kit stack≤99，tool stack1；无 unitWeight；FOOD quantity占格；C5新增 Item root≤7168，原生总预算8192预留1024；node≤512且每层32、station≤128、chest≤112/remains≤16、chest capacity≤64/remains1024；interactable子832/总1024；batchCount1…16/workTicks1…10000。 |
| 测试发现 | dot 在 `src/ext/modules/crafting/test-suites.json` 注册 `tests/**` 路径；`scripts/test-discovery.mjs` 自动发现模块 manifest 并归属/合成 test 与 ext。无需改共享 `scripts/test-suites.json`，未注册的新文件会被 ownership 拒绝。底座新测试已登记 test 清单；ext 分区按既有发现器规则纳入。 |
| 限制 | D15 一批只一次回血；5A2-S 后重跑 trace；结构/房间/RestPoint/招募/订单/离线生产未开放；真实 UI 和最大状态长局未验证；5Z 全量/组合/删除矩阵未跑。 |

## 8 验收边界

真实浏览器 UI：**未验证**。已执行 Vite 与 skill Playwright client，分别遭 localhost listen EPERM、Chromium MachPort bootstrap Permission denied；证据 `phase5a2-ui-server.log` / `phase5a2-ui-client.log`。没有截图，不把 SFC/engine 测试冒称浏览器验收。最大状态长局：**未验证**。5Z 完整门禁/删除矩阵：**未验证**，按开发期政策留后续。

全部原始日志/测量 JSON/逐叶归因放 `/private/tmp/phase5a2-*`，没有新增截图或原始大证据进仓库。审查前 src/scripts/public **997** 输入聚合 SHA-256 `5233e07ea47cbb8a851b13a8668f31b0b8706ca87b271531aa38815948354a5b`，旧清单 `phase5a2-final-input.json`；当前输入清单和 SHA 见 §9。聚合方式为排序 [path,fileSHA] rows 的紧凑 JSON SHA-256。冻结 SDK/harness/骨架/fixture 与 §7 一致。`git diff --check` 通过，无 CRLF；原 HEAD 保持 `8e946bb`，未暂存、commit、push。候选等待集成人验收与填写 commit 后才作为正式 5B 派发基线。

## 9 审查发现处理

依据 `phase5a2.review-findings.md` 逐项复核，执行维护者本轮裁定。worldSdk 1 尚未派发，修订 SDK 而不加版本槽；foundation 7 / wholeRun 5 / 录像 4 / 来源 2 / IDB 2 / combat 1.6.0(schema4) 保持当前候选版本。没有修改正式 5B 包、菌丛/口粮删除决策、CE 原生规则或属性管线。

| 发现 | 修复与回归证据 |
| --- | --- |
| H1 | Game.checkpointWorldWork 独立 scoped 写集：world5、动作根、Map 与容器 Item、facts/details、背包/地面、autoAction、active actor 浅字段与 carriedItem、ID/RNG/时钟/日志/session；runtime.transaction 负责扩展状态/实体/事实高水位。嵌套取消复用外层事务。保留原完整图 oracle 八类故障；D8 新 oracle 审计整个 native Game（包含七缓存层和活动层），runtime 值独立对比，并用 grid ownKeys 陷阱证明生产检查点不遍历 grid。 |
| H2 | 终结事实先送达参与者，再解除 escrow/预留/时钟/autoAction/details 并移出 tickets；只保留 terminalTickets 最近64条摘要。预算和工作扫描只计活跃票据，Map 索引按根/数组/长度/nextWorldId 失效；leftDepth 用一轮活跃ID集合处理中断。nextWorldId 不重用；load 对退休事实放宽 ticket 实体存在性，仍检查高水位/owner/定义。140 单退休/有界历史、超过8192历史高水位再接单、跨 owner 摘要被挤出后仍保存/load 均有回归。 |
| H3 | CommittedWorkFact.result 新增 accepted；接收保持原 operation 和 ordinal，但消费者只按显式 result 分类。一次 harvest 只有一条 completed；放台接收不写收据也不增加工位。 |
| M1 | 三个事件域按显式写入口的会话 dirty generation 缓存，干净域不 clone/hash；world clock/事务/事实/详情镜像、scheduler 写入口、runtime 写能力/事务/causality 与 combat ledger revision 都纳入失效。失败回滚标脏，load/newGame 根身份失效。全量 eventDigest/mechanicalDigest 保持独立，并在256边界比对。compareCodePoints 码元快路径，遇代理项才回落码点；BMP/补充平面/前缀/孤立代理项排序与原算法一致。骨架 history 严格限128。 |
| M2 | load 拒绝 classic 的 auto_work、悬空/终结/非本人/单批/非working票据和多批玩家活跃票据缺失auto_work；原生自动动作也校验形状。候选失败不退休当前 Game。R1 使用合法且无来源前缀的完整 world 快照，避免来源摘要先拒绝而掩盖缺陷。 |
| M3 | 普通放置、defer retry 和 trusted fixture 的节点预算失败记录 skipped/budget 收据，其它错误仍回滚；同包按重叠深度合计 maxPerDepth≤32，dungeon+site 的 maxPerRun 合计≤512。回归覆盖定义提前拒绝和真实32节点预算的skip、不换grid。 |
| M4 | 完成/续批的 World5Error 取真实错误类别，其它底座异常为 transaction，参与者错误为 provider；provider 取消仍尝试送达。取消参与者再次失败才采用不送达兜底，保留 foundation 事实。接单时 Item 预算计入活跃输出预留，完成消费已获准预留、不因后续原生根增长重新拒绝；7169个新增原生根后已付批次仍完成。原输出/耐久/消息失败注入保留、断言改为真实分类。 |
| M5 | foundation 的 world5.definitionsFingerprint 为 owner→sha256:c5Hash(pack)，保存/load 严格核对。回归实际构造两套模块 rules 指纹完全相同但 workTicks 不同的定义，旧候选拒载。 |
| L1 | prepare 失败码必须属于固定33码，field 合法；非法降为 C5_PROVIDER。payload clone 后深冻结；回归验证两项。 |
| L2 | 公开 world:transfer 分派移除；WorldMaterialTransfer 只供 trusted engine adapter，短命计划/epoch/一次性/CAS不变，返回100tick报价。内部 commit 不借公开玩家命令标志取权；module boundary 阻止内容调用。回归检查旧命令不转移物品；原转移测试经内部入口验证物品归属、FOOD槽、拆分与round trip。 |
| L3 | stopAutoWorkInCommand 接收来源；玩家输入为input、autoTravelDisturbed先读同一工作中断谓词，敌情为threat、HP损失为damage等；无更具体机械原因才为disturbed。四项回归经executeCommand检查真实来源。 |
| L4 | applyCommandStages 只在 body.next/body.return 期间设置执行标志，确认yield等待为false；恢复与清理不泄露标志。 |
| L5 | 移除 prepareTravel 与三处 escape 前置。GameCanvas :1002/:1019/:1045 都是 A（executeCommand mouse_travel）；§4 分类及当前行号已修正。 |
| L6 | crafting 生产导入白名单：worldSdk/types/descriptor/fingerprint、world仅类型、共享UI、自有文件；别名/动态引用仍经原语法解析。SDK值助手移至无引擎依赖的worldBasics，canonical/校验分别为worldJson/worldWorkSchema；新增纯叶禁引擎值依赖守卫与边界回归。 |
| L7 | ActorActionBundleDefinition.owner 必填，factory 无缺省；全部生产与旧fixture显式填写combat/foundation，新增有效子动作缺owner拒绝回归。 |
| L8 | 工位 workPositions 资格同时使用 StationDefinition.interactionDistance；distance0无邻接资格，prepare明确 C5_DISTANCE。 |
| L9 | world5 不再值依赖 WorldWorkValidation；纯根形状校验移至 ext/worldWorkSchema，实体引用校验留 engine。 |
| L10 | worldWorkFacts 按owner各128条保留，保持全局factId顺序；跨owner保留和已退休闭包回归覆盖。 |
| L11 | 收据ordinal用上一条持久收据高水位+1，递增CAS revision独立；同事务连续skip不重复，load拒绝重复或逆序。离线plan的局部event ordinal仍保留，发布时统一换为全局收据ordinal；原130条截尾语义测试原样通过。 |

自行决定并冻结的细节：退休摘要是十个必要诊断字段，不持 escrow/预留/倒计时；最近64条为全 owner 共享窗口，facts仍各owner128。定义指纹采用canonical C5 SHA-256加`sha256:`前缀，包含静态包全部内容。输出根预算保守按尚未产出reservation.slots预留；native增长不撤销已批准额度，后续新接单仍受门槛。provider取消的兜底只处理取消参与者自身失败，不吞掉其它底座错误。dirty计数存WeakMap，不新增Game持久字段或随机流，不改变Merkle树/codec算法。原生Item转移只是内部报价入口，正式承时/状态资格由未来5C受录制的adapter承担。

复现与反事实：原审查副本 R1–R4 **4/4** 重跑成功（`p5a2-fix-reproduce.log` / `p5a2-fix-review-original-evidence.log`）。修复前源树封存在`/private/tmp/p5a2-fix-before`，同一批新增断言在该副本 **10/10失败**（`p5a2-fix-counterproof-verified.log`，最终扩展过滤组14项均失败，`p5a2-fix-counterproof-release-verified.log`）：悬空load、两项合计预算、accepted语义、活跃票据退休、grid遍历、非法错误码、缺owner、确认执行标志、interactionDistance。原守卫未放宽；只有终结结果读取前提改看terminalTickets、公开转移测试改经内部入口、错误取消reason改为真实分类。SDK独立全量摘要算法不变，本轮没有新增黄金/生成基线变化。

### 最终开发期门禁

同一规定环境：Node24.19.0在PATH首位，NODE_OPTIONS=--max-old-space-size=3072，Vitest每次--maxWorkers=2。仅25个相关文件（清单`/private/tmp/p5a2-fix-related-files.txt`），没有全量/CE full/gen/删除矩阵。分组存在重叠，以下数字不相加。

| 门禁 | 实际结果 | 原始日志（均在/private/tmp） |
| --- | --- | --- |
| 8个原C5/actor-root相关文件 | 125/125通过 | p5a2-fix-tests2.log |
| foundation/v4/时钟/原生自动行动/触屏/边界等12文件 | 初跑256通过/1失败：离线收据ordinal引入了事务间隙；改生产为全局连续高水位，原断言不改 | p5a2-fix-gate-related.log |
| 修正收据后的离线、预算、Item、边界与arena 6文件 | 112/112通过，含原离线130条收据截尾守卫 | p5a2-fix-gate-final-related.log |
| combat篝火、方形/4e录像、dodge UI、生命周期/摘要与审查7文件 | 137/137通过 | p5a2-fix-last-gate.log |
| 退休事实、严格load与harness闭环/组合3文件 | 36/36通过 | p5a2-fix-final-load-gate.log |
| 最终审查24项、actor-root与工作故障注入3文件 | **67/67通过** | p5a2-fix-source-reason-gate.log |
| 公共harness normal模式、R1及有效子动作缺owner定点复核 | 3/3通过（其余18按过滤跳过） | p5a2-fix-final-fixture-gate.log |
| boundary/ownership | exit0，白名单/纯SDK叶与原模块边界同时启用 | p5a2-fix-boundary-release.log |
| vue-tsc -b | exit0 | p5a2-fix-types-release.log |
| npm run build | exit0，2.62s；只有既有大chunk提示 | p5a2-fix-build-release.log |

曾有新测试将公开harness的mode误写为wizard，类型门禁拒绝；已改为SDK允许的normal并定点复核，最终类型与build重新通过。没有改SDK的mode联合类型。生成源码缺失提示仅来自既有globalSetup，本轮所选用例没有因此跳过的CE断言。真实浏览器与最大全部状态压力仍按§8标为未验证。


### 最终性能门槛与冻结

沿5A1-R和首轮5A2的同口径配对法：当前真实Game与只替换为2cd10a5两个v3录制方法的同一当前C5 Game比较；经典/0营地对照使用实际v3 Game。每场2049条实际命令，交替配对顺序；首32预热和每256完整摘要边界单列，2009对差值取分位数，不是两条P95相减。定时段无存储IO、没有并行自己的测试/构建。骨架为活动层无怪、1tick纤维→纤维、耐久10000；D8有7缓存层+1活动层，trusted fixture放在D8入口附近。每条命令检查新发布的completed事实，并检查nextActionId：两端均真实完成2049批，没有因拒单少做工作。

| 场景 | 新增median / P95 ms | 实际整条median / P95 ms | chunk median / P95 ms（8次） | 阈值 |
| --- | ---: | ---: | ---: | --- |
| classic | 0.028084 / **0.031208** | 0.029333 / 0.033458 | 66.762792 / 136.647916 | ≤1ms，通过 |
| zero-camp | 0.048375 / **0.054667** | 0.057500 / 0.066625 | 70.138667 / 148.852084 | ≤5ms，通过 |
| D1（0缓存+1活动层） | 2.624625 / **2.948333** | 6.037125 / 6.588458 | 84.181208 / 168.808458 | ≤10ms，通过 |
| D8（7缓存+1活动层） | 2.762458 / **3.171291** | 5.875833 / 6.494167 | 561.970708 / 1130.836416 | ≤10ms，通过 |

D1前半/后半新增P95为2.937875/2.952000ms（988/1021对），增长0.014125ms。D8前半/后半新增P95为3.136875/3.191417ms（988/1021对），增长0.054542ms。 D1→D8新增P95只差0.222958ms；没有观察到随层数/历史线性增长，且实际整批P95也低于10ms。两场末态均1个未结束的两批订单（首批已完成）、64终结摘要、128骨架历史。没有把chunk全图摘要成本归入普通批次：D8 chunk仍随8层完整原生世界体积增长，已单列1130.836416ms的P95；这不是已优化到10ms的路径。

测量脚本/结果/配对样本：`/private/tmp/p5a2-fix-perf.mjs`、`p5a2-fix-perf.json`、`p5a2-fix-perf-release.log`、`p5a2-fix-perf-D1-pairs.json`/`D8-pairs.json`。此前测量和失败门禁均保留，不用旧数值冒充最终候选。最终测前/测后/交付输入一致：**1002**个src/scripts/public文件，排序[path,fileSHA]紧凑JSON的SHA-256为`922ca79ebe6892955a9922777df1a43f9d886b2f37b34cb430b7b1091e516ae1`，清单`/private/tmp/p5a2-fix-final-input.json`。

SDK修订冻结清单：result增加accepted；新增TerminalWorkTicket诊断类型；harness world5()所返回的root增加terminalTickets/definitionsFingerprint、tickets改为仅活跃；levelKey/compareLevelRefs的运行期实现移至纯叶worldBasics。骨架history追加及load形状均限128。SDK/harness/骨架/fixture的最新SHA见§7；harness与basic fixture文件字节不变，但可见root语义按本节冻结。世界错误码仍33项，SDK1与各协议槽不再增加版本。纯叶的转移不扩大内容写权限，新的内部中断原因函数也不进入SDK。

`git diff --check`通过，源文件无CRLF；HEAD仍8e946bb，没有暂存/commit/push。维护者可按§7的具体文件和本节整树SHA复核，集成commit位仍待集成人填写。


## 附录 A：首轮相关门禁文件

以下完整清单也是 `/private/tmp/phase5a2-final-related-files.txt` 的内容；同一环境 `npx vitest run <以下全部路径> --maxWorkers=2` 可复现。背包/物品入口由 packCount/stacksWith/ItemCategory 搜索补入 u20、U01、details/Discoveries、identification、throw、fall、水域、carriers/theft/status；全部 combat 33 文件、world5/foundation/v4/U03/U03b/U27/x2a/x3b/UR2/3/4 与 replay cadence 均覆盖。

```text
src/engine/UI/DetailGenerator.test.ts
src/engine/UI/Discoveries.test.ts
src/ext/modules/combat/tests/combat_adapters.test.ts
src/ext/modules/combat/tests/combat_animated_defense.test.ts
src/ext/modules/combat/tests/combat_body_transition_facts.test.ts
src/ext/modules/combat/tests/combat_bonfire_definitions.test.ts
src/ext/modules/combat/tests/combat_bonfire_runtime.test.ts
src/ext/modules/combat/tests/combat_bonfire_ui.test.ts
src/ext/modules/combat/tests/combat_combinations.test.ts
src/ext/modules/combat/tests/combat_defense_state.test.ts
src/ext/modules/combat/tests/combat_display.test.ts
src/ext/modules/combat/tests/combat_dodge.test.ts
src/ext/modules/combat/tests/combat_dodge_ui.test.ts
src/ext/modules/combat/tests/combat_foundation_dodge_gate.test.ts
src/ext/modules/combat/tests/combat_native_defense.test.ts
src/ext/modules/combat/tests/combat_native_stamina.test.ts
src/ext/modules/combat/tests/combat_parry.test.ts
src/ext/modules/combat/tests/combat_parry_advisory.test.ts
src/ext/modules/combat/tests/combat_parry_decision.test.ts
src/ext/modules/combat/tests/combat_parry_ui.test.ts
src/ext/modules/combat/tests/combat_part_break.test.ts
src/ext/modules/combat/tests/combat_part_break_runtime.test.ts
src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts
src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts
src/ext/modules/combat/tests/combat_phase4d_declarations.test.ts
src/ext/modules/combat/tests/combat_phase4d_playable_recording.test.ts
src/ext/modules/combat/tests/combat_phase4d_rest_relations.test.ts
src/ext/modules/combat/tests/combat_phase4d_travel_ai.test.ts
src/ext/modules/combat/tests/combat_phase4e_recording.test.ts
src/ext/modules/combat/tests/combat_planner.test.ts
src/ext/modules/combat/tests/combat_runtime.test.ts
src/ext/modules/combat/tests/combat_schema.test.ts
src/ext/modules/combat/tests/combat_square_replay.test.ts
src/ext/modules/combat/tests/combat_ui.test.ts
src/ext/modules/combat/tests/combat_warning_map.test.ts
src/test/b_1a_identification.test.ts
src/test/b_1b_identification_persistence.test.ts
src/test/b_2_throwing.test.ts
src/test/c_5_fall_subsystem.test.ts
src/test/ext_actor_actions_root_world.test.ts
src/test/ext_compatibility_diagnostics.test.ts
src/test/ext_foundation.test.ts
src/test/ext_foundation_contracts.test.ts
src/test/ext_module_composition.test.ts
src/test/ext_recording_v4_digest.test.ts
src/test/ext_recording_v4_snapshots.test.ts
src/test/ext_recording_v4_storage.test.ts
src/test/ext_world5_clock_levels.test.ts
src/test/ext_world5_offline.test.ts
src/test/ext_world_display.test.ts
src/test/ext_world_harness_closed_loop.test.ts
src/test/ext_world_harness_combinations.test.ts
src/test/ext_world_interactables.test.ts
src/test/ext_world_items_roots.test.ts
src/test/ext_world_work_boundaries.test.ts
src/test/ext_world_work_failures.test.ts
src/test/ext_world_work_sdk_contract.test.ts
src/test/ext_world_work_transactions.test.ts
src/test/main_menu_replay_seek.test.ts
src/test/perf_2_replay_cadence.test.ts
src/test/u20_inventory.test.ts
src/test/u_01_instance_snapshot.test.ts
src/test/u_03_whole_run_snapshot.test.ts
src/test/u_03b_level_travel.test.ts
src/test/u_14a_status_gaps.test.ts
src/test/u_17b_carriers.test.ts
src/test/u_17f_carriers.test.ts
src/test/u_18_water_cage.test.ts
src/test/u_26a_deep_levels.test.ts
src/test/u_27_recording.test.ts
src/test/u_r2_trace.test.ts
src/test/u_r3_trace.test.ts
src/test/u_r4_trace.test.ts
src/test/x2a_recording_checkpoint.test.ts
src/test/x3b_display_recording.test.ts
src/test/x3b_item_details.test.ts
src/test/x4_r4_item_details.test.ts
```

收尾补充可复现命令：

```sh
npx vitest run src/test/ext_actor_actions_root_world.test.ts src/test/ext_world_items_roots.test.ts src/test/ext_world_work_transactions.test.ts src/test/ext_world_work_sdk_contract.test.ts src/test/ext_world_work_boundaries.test.ts src/test/ext_world_work_failures.test.ts src/test/ext_world_harness_closed_loop.test.ts src/test/ext_world_harness_combinations.test.ts --maxWorkers=2 --reporter=json --outputFile=/private/tmp/phase5a2-final-c5.json
npx vitest run src/test/ext_world_work_transactions.test.ts --maxWorkers=2
npx vitest run src/ext/modules/giants/tests/giants_trace.test.ts src/ext/modules/giants/tests/giants_spine_trace.test.ts src/ext/modules/giants/tests/giants_c5_placement.test.ts src/test/ext_world_work_boundaries.test.ts --maxWorkers=2
```

## 附录 B：仅修旧前提的测试文件

下列 29 个旧文件移到中立根或升级版本前提；断言费用/退款/来源/主体/历史/录像语义保留。part-break 需要写真实根的 fixture 使用可信测试适配器，读 DTO 本身仍不可变。原反证实际运行的三文件及结果见 §5，版本外壳反证另见黄金归因。

```text
src/ext/modules/combat/tests/combat_adapters.test.ts
src/ext/modules/combat/tests/combat_animated_defense.test.ts
src/ext/modules/combat/tests/combat_bonfire_definitions.test.ts
src/ext/modules/combat/tests/combat_bonfire_runtime.test.ts
src/ext/modules/combat/tests/combat_combinations.test.ts
src/ext/modules/combat/tests/combat_defense_state.test.ts
src/ext/modules/combat/tests/combat_display.test.ts
src/ext/modules/combat/tests/combat_dodge.test.ts
src/ext/modules/combat/tests/combat_dodge_ui.test.ts
src/ext/modules/combat/tests/combat_foundation_dodge_gate.test.ts
src/ext/modules/combat/tests/combat_parry.test.ts
src/ext/modules/combat/tests/combat_parry_decision.test.ts
src/ext/modules/combat/tests/combat_part_break.test.ts
src/ext/modules/combat/tests/combat_part_break_runtime.test.ts
src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts
src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts
src/ext/modules/combat/tests/combat_phase4d_declarations.test.ts
src/ext/modules/combat/tests/combat_phase4d_playable_recording.test.ts
src/ext/modules/combat/tests/combat_phase4d_travel_ai.test.ts
src/ext/modules/combat/tests/combat_phase4e_recording.test.ts
src/ext/modules/combat/tests/combat_runtime.test.ts
src/ext/modules/combat/tests/combat_schema.test.ts
src/ext/modules/combat/tests/combat_square_replay.test.ts
src/ext/modules/giants/tests/giants_zones.test.ts
src/test/ext_actor_attack_validation.test.ts
src/test/ext_foundation_contracts.test.ts
src/test/ext_recording_v4_digest.test.ts
src/test/phase3b_action_lifecycle.test.ts
src/test/phase4d_declarations.test.ts
```
