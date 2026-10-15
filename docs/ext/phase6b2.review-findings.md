# 6B2 独立审查，第 1 轮

结论：**需修**。确认 4 项重要问题，无另列阻断问题。本轮不修改仓库文件、不 commit，不开第 2 轮。

审查基线：`9ab574550dabb88f6cfa9b1e94e6a5fa8450b737` 的全部未提交实现（含新文件）。已读 AGENTS.md、项目入口文档、6B2 任务书/报告及相关合同。按维护者最新裁定，D4 整体平衡延后；原 M4 曲线与基线存档不算缺陷。D7 三档真实浏览器由维护者执行，本轮不把未执行浏览器列成新增代码问题，也不宣称浏览器验收通过。

## 新问题（均为重要）

### R1-F1：原生破防的固定韧性重置被当成普通恢复，提前揭示 stalwart

- 位置：`src/engine/Core/PhasedAttackProduction.ts:245–250`；实际重置在 `src/engine/Core/ActorResources.ts:108–112`。
- 原因：没有 scheduler bundle 时 `phases=[]`。247 行确实将原生 stagger 的区间传为 `['break-recovery']`，但 250 行判断的是外面的空 `phases`；只要韧性增长就发送 `combat.poise-recovery` 回执。破防结束的 `poiseBreakRecoveryValue` 固定重置不使用该恢复属性，却使词缀变已知。
- 最小复现：loot+combat；真实生成带未知 `loot.affix.stalwart` 的装备并装备；调用真实 `applyActorPoiseDamage(playerId,100000)` 使原生角色破防，再让生产 scheduler 只推进 `staggerRemainingTicks=50`。
- 实测：推进前 `poise=0, poiseRecoveryDelayRemaining=40, staggerRemainingTicks=50, known=false`；推进后 `poise=12, remainder=0, staggerRemainingTicks=0, known=true`。整个 50tick 都是原生破防恢复，普通韧性恢复未参与。报告账本“韧性破防恢复不冒充普通恢复”的声明不成立。
- 修复要求：分别识别两个实际推进区间中普通恢复产生的整数/分数增量；排除固定破防重置，保留真正恢复及跨边界剩余区间的正例。不能仅检查 bundle 的 phase。
- 证据：`/private/tmp/p6b2rev1.probe.mjs` / `.probe.log` 的 `native-stagger-recovery`。

### R1-F2：空槽情况下“替换左戒”的命令与比较列不一致

- 位置：`src/ext/modules/loot/gameSession.ts:50–55`，`src/ext/modules/loot/ui/game/LootGamePanel.vue:35`；宿主规则在 `src/engine/Core/Game.ts:5508` 附近。
- 原因：UI 始终提供左右替换按钮，将目标戒指字母交给原生命令；但 `Game.equipItem` 仅在两槽都占用时解释 replacement。只有一枚戒指时直接填空槽。
- 最小复现：左槽已知戒指 id18、右槽空，选择包内已知原生恢复戒指 id19；比较列“替换左戒”恢复强度为 `2→2`，“替换右戒”为 `2→4`；调用实际会话回调 `onEquip(false,'left')`。
- 实测：左槽仍为 id18，右槽变成 id19，恢复强度为 4；执行了右列的装配。按钮文字、比较与命令不对应，可能让玩家误判装备效果。
- 修复要求：根据宿主实际槽位语义展示可执行动作，或增加经正式命令边界验证的替换操作；不要把当前只接受满双槽 replacement 的接口当成任意槽位操作。补单戒、双空、双满及已装备候选回归。
- 证据：探针 `replace-occupied-left-with-right-empty`。全部通过的现有 UI 测试没有覆盖此组合。

### R1-F3：未知物品分解显示确定的 0 碎片，实际有正产量

- 新接线位置：`src/ext/modules/loot/gameView.ts:46`；旧 β helper 的触发分支：`src/ext/modules/loot/ui/viewModel.ts:277–286`；生产 `LootSalvagePanel` 将 min=max 的 0 直接显示为确定值。
- 原因：未知物品的可信 DTO 正确保留 `ilvl=null`，但 `yieldFor` 因此返回 0，最终生成 `{min:0,max:0}`，未生成保守范围或未知提示。这是本轮挂入游戏后暴露的旧 helper 不兼容，不能把隐藏物等传入 UI 来补数值。
- 最小复现：真实生成带未知 mending 的戒指，包内选中并查看分解；随后通过真实 loot salvage 命令执行。
- 实测：`knownIlvl=null`，显示总产量 `0–0`，实际余额增加 **32** 碎片。单件、批量总计及确认按钮都会带入错误值。
- 修复要求：从已知稀有度、公开合法物等范围与可能腐化状态计算可信区间，或在合同允许下明确显示未知；不能把未知当零，也不能暴露隐藏精确值。补未知/部分已知/混合批次回归。
- 证据：探针 `unknown-salvage-preview`。违反任务书 §3.1.6 的已知产量/可信区间要求。

### R1-F4：原生候选对比 loot 装备时丢失当前物品及条件/符文行

- 位置：`src/ext/modules/loot/comparison.ts:39,46–49`。
- 原因：候选没有 loot DTO 时 fallback 创建 `equipped:null, rows:[]`；后续仅为 `previous.native` 填当前物品，不处理 `previous.known`。因此当前 loot 装备被标成空槽，已有条件/符文行也没有进入最终列表。标量部分仍使用当前装备计算，导致表头与数值互相矛盾。
- 最小复现：装备已鉴定、带 giantsbane 的真实生成连枷，选择起始原生匕首做比较。
- 实测：当前连枷有已知 `loot.affix.giantsbane`，值 6136bp；返回 `columnEquipped=null, qualifiers=[]`。组件显示空槽且没有“大型目标”收益丢失行；无条件标量不能表达这部分差异。
- 修复要求：候选/当前两侧分别投影 chip 和已知条件/符文行，支持 native↔loot 两个方向；不得为原生物品伪造不合法 loot DTO。补反向混合比较和未知行不泄露测试。
- 证据：探针 `native-candidate-vs-conditional-loot`。违反 D2 条件独列及原生对照要求。

## 逐项判定

| 核查项 | 判定与证据 |
| --- | --- |
| UI 入口→已知 DTO | 主要边界成立：共享组件仅传 itemId；适配器从实际包/装备/可见地面/公开可达容器取值；地面只提供保守投影，幻觉不列地面；Vue 不接 raw Item/moduleData。`loot_game_ui`、`loot_ui_knowledge`、`loot_ui_inert` 本轮通过。未发现新的隐藏行 ID/值直泄漏。 |
| 比较/来源→命令 | **需修 F2/F3/F4**。命令本身仍走 executeCommand/executeItemCommand；过滤、批分解、唯一 Yes/No、碎片鉴定及陈旧会话失效测试通过，但不能据此声称所有槽位/产量预览正确。 |
| D2 字段单位与条件 | 护甲÷10、抗性/寻宝 bp、耗时与潜行低值更好、每100物理输入探针、恢复有理数及 max-hp 依赖均能沿真实管线追踪；能力缺席不虚构 combat/growth。**原生候选的已知条件行丢失见 F4**。来源页使用已知行、玩家物品名，bp 来源÷100显示百分数，未把 sourceId 直接给玩家。 |
| D5 逐行账本/真实结算 | 35 条非符文、唯一行及 fallback 映射有枚举；物理、容量、视野/搜索、恢复、抗性、收割/充能/寻宝等有生产结算点和分组回归，不是以 UI 查询触发。固定符文留6B3、growth缺席处理符合范围。**不能判全覆盖通过：F1 的回执错误归因直接揭示未知行**。 |
| 查询纯度/事务 | 重复真实面板读取、hypothetical、ordinary updateVision、载入重建的现有纯度测试通过；知识应用异常的完整对象图回滚通过，未发现新的查询写状态或额外 RNG 证据。此结论限于检查与测试路径，不替代 F1 修复。 |
| 共享补口权限/最小复现 | itemActions/beforeOpenItemPanel/itemId、宿主 hypotheticalValue、恢复 DAG、可选 stat-commit 通知均服务本步具体缺口；没有新增 Game 字段、worldSdk/edibleSdk 差量或模块活 Item 写权限；门面仍为旧五方法。相关12文件398项通过，边界守卫未改。**正确性仍需修 F1/F2**，权限本身无越权证据。 |
| 0.3.0 与拒旧 | loot module/rules均0.3.0，pack0.1.1/state1/foundation15/whole-run7/recording4保持；检查与探针通过。把当前真实导出输入的模块身份改为真实0.2.0版本/旧rules指纹，save/replay均在版本检查拒绝，明确报0.2.0→0.3.0；完整图、双流、ID、录像保持。该探针是旧身份负例，不冒充重新运行历史0.2.0生成器。 |
| 同版本存读/回放/seek/续录 | 本轮 `loot_integration` 的自然拾取/装备/分解/过滤链、256/2048检查点、save/load/replay/seek/continuation，以及 `ext_recording_async` 均通过；没有新确定性失败。自然与受控布景分列，不把受控探针算自然路线。 |
| 模块边界/测试依赖 | 本轮两条静态命令均exit0；依赖 errors=[]。正常树没有声明缺包skip；C批37项为明确 -t 未选。新增 settlements 测试将 combat 登为 required，未用 optional 掩盖。 |
| 全移除 | 复用作者唯一已物理全删副本，未建立第二布局。核实8模块目录全无，剩余878个源文件与当前源树逐字节相同；1488文件源冻结清单全部匹配。作者该同源副本的boundary/依赖/types/build/125相关测试日志可对应；本轮独立重跑其生命周期/缺包探针exit0：new→3 wait→save/load→第4 wait续录→逐事件replay→seek(0,1,4)，真实当前loot0.3.0原始导出缺包拒绝且完整图/双流/ID/录像不变。runner依旧prepared-not-verified，不冒称全量。 |
| D4 / D7 | D4按最新裁定整体延后，无数值平衡缺陷；D7仍是维护者三档浏览器待验，无以SFC冒充浏览器的报告结论。 |

旧测试前提变更仅两处：生产会话已挂载，以及装备后 titan 容量提交已知。核对作者 `/private/tmp/phase6b2/counterfactual.log` 的旧生产2项通过；当前差量未放宽其他知识/纯度断言。本轮为只读审查，未自行回退生产做第二次反事实。

另核实的非问题：满血 leech 探针从45/45实际变成50/45，有原有超量生命收益；因此未把它报成“无实际收益却揭示”。报告中的“满血无收益不发”不能直接用作该原生路径的事实前提。

## 本轮运行记录

全部在仓库根执行相关测试；未跑完整 npm test/test:ext、drift、CE、生成普查、build/types 或组合矩阵。探针与报告均在 /private/tmp。

- A：10文件 **127通过，0失败**，exit0，Vitest 66.00s，Node25.2.1。文件：loot 的 `loot_game_ui`、`loot_game_sfc`、`loot_trigger_commits`、`loot_trigger_settlements`、`loot_integration`、`loot_commands_integration`、`loot_stats_integration`、`loot_ui_knowledge`、`loot_ui_inert`、`loot_capabilities`（均 `src/ext/modules/loot/tests/*.test.ts`）。命令入口 `node node_modules/vitest/vitest.mjs run <上述文件> --maxWorkers=2`；`NODE_OPTIONS=--max-old-space-size=3072`。日志 `/private/tmp/p6b2rev1.related-A.log`。
- B：12文件 **398通过，0失败**，exit0，161.67s，Node24.19.0。文件：`src/test/ext_item_commands.test.ts`、`ext_item_presentation`、`ext_item_stats`、`ext_module_creation_ui`、`ext_stats_pipeline`、`ext_stats_native`、`ext_stats_runtime`、`ext_stats_review`、`ext_combat_neutral_differential`、`ext_slaying_alignment`、`slaying_melee_autohit`、`ext_recording_async`（后11项同为 `src/test/*.test.ts`）。同一入口、内存参数与workers。日志 `/private/tmp/p6b2rev1.related-B.log`。
- C：4文件 **5通过，0失败，37未选**，exit0，13.22s，Node24.19.0。`src/ext/modules/settlement/tests/{phase5_ui_open,camp_recording,settlement_input,settlement_feedback_ui}.test.ts`，筛选 `-t 'shared seven-module shell|DEV wait|delayed checkpoint|canvas native keyboard|build, storage and harvest'`，同workers/内存。日志 `/private/tmp/p6b2rev1.related-C.log`。
- 三批合计26文件、530项通过；无todo/unhandled报告。不用这一结果掩盖四个额外探针确认的问题。
- `node scripts/check-module-boundaries.mjs`：exit0，`/private/tmp/p6b2rev1.boundary.log`。
- `node scripts/check-test-dependencies.mjs`：exit0，errors=[]，`/private/tmp/p6b2rev1.dependencies.log`。
- 独立缺陷探针：`node /private/tmp/p6b2rev1.probe.mjs`，exit0，输出上述5组观察（含一个排除的问题）；这是观察脚本，不将exit0写成缺陷预期测试全绿。脚本使用真实生成词缀、生产模块/调度/命令；全部受控布景。
- 旧身份负例：`node /private/tmp/p6b2rev1.version.mjs`，exit0，日志 `/private/tmp/p6b2rev1.version.log`。
- 全移除副本：cwd `/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-knbBgL/candidate`，`node /private/tmp/p6b2rev1.removed-probe.mjs`，exit0；结果 `/private/tmp/p6b2rev1.removed-probe.json`。只改了脚本结果输出路径，未覆盖作者证据或编辑候选输入。

结束核对：HEAD仍9ab5745；作者冻结的1488个生产/脚本/测试等输入逐文件SHA256全部相同，摘要仍 `baf7e9f04ccf753434ffb1fd55561dbf0dffd49f74bb26db750d67c9dc340195`。`git diff --check`通过。无仓库生产、测试、文档修订，无commit。
