# 6C3 工位、craft 与原生装备托管报告

> 性能补录（2026-10-17）见§12：拆分run39028334751硬门禁通过；同路线尾部偏噪声但不能证明纯噪声，原D6 regression保留，以known-tail-risk采纳并冻结。无完整独立第四轮云端验证；浏览器仍待验。下方旧性能待办为历史。

日期：2026-10-17。分支 `ext/phase6`；开工及交付时 HEAD 均为 `33d7aba6e458529ae126dee2d889c7b2c24507bd`，本轮不 commit、不 push、不发布、不开始 C4。依据 [任务单 §4.3](phase6c.task.md#43-6c3工位拆卸重铸craft来源和容器软联动)、已冻结 [C0 合同 §5](phase6c0-contract.md#5-c3工位装备所有权与craft) 及 [C2 报告](phase6c2.report.md)。未修改冻结合同或其数值。

第 1 轮独立审查发现的三项重要问题及本轮修复、验证结果见 §11；该节取代首轮关于当前字节全部通过的结论。生产实施已完成。**正式性能验收和三档浏览器人工复核待维护者执行，因此不宣称 C3 已通过全部验收。** 首轮原始证据留在仓外 `/private/tmp/phase6c3/`，§1–10 相对证据路径均相对于该目录；R1 修复证据另在 `/private/tmp/phase6c3-r1/`。

## 1 交付行为

| 入口 | 接受条件与结果 | 固定成本 |
| --- | --- | --- |
| `crafting.forge` | 现有放置命令；8 邻接工作位、距离 1、无需 kit、无需 settlement | 石材 6、金属 4；300 tick |
| `loot.work.unsocket-last` | 自己背包中未装备 normal/runeword；同 ID、同对象取下末枚并返还材料 | 10 碎片、100 tick |
| `loot.work.unsocket-all` | 一批原子拆除接单时全部 n 枚；按材料 ID 合并返还；成词退回 normal | n×10 碎片、n×100 tick，n≤4 |
| `loot.work.reforge` | 已完整鉴定 magic/rare；选择一条正面非原生符文族随机行；允许同结果或变差 | 10 碎片、100 tick |
| `crafting.forge-dagger` | 固定 dagger 基底；锻炉、无工具、不可离线；每批 1 件 | 金属 4、木材 1；1000 tick |
| `crafting.forge-leather-armor` | 固定 leather_armor 基底；其余同上 | 纤维 6、皮革 4；1500 tick |

旧七条配方保持原行为。两条新配方均声明 `lootRoll:{maxRarity:'magic'}`，沿 C5 批数 1…16 逐批结算。仅 crafting 时产出原生 +0 已知装备且不调用 loot RNG；双开时接单绑定 `loot.item-roll.v1` 的身份，产出至多 magic、+0、词缀全已知，ilvl 使用接单地点深度及 craft 加值 0。只抽 normal/magic 权重、魔法词缀或普通空孔；不抽类别、基底、腐化或金币。仅 loot 时原有套装、镶嵌继续可玩，工位动作没有可达入口。无 settlement、无 giants 不影响背包工位功能。

重铸保留行的前/后缀位置，使用类别适用、有效权重、其他行互斥组及当前 ilvl 阶窗口筛候选；按候选→阶→值的既有顺序抽取，新行 `known=true`。负面行、腐化补偿行、未选行、稀有度、原生符文、强化、诅咒/否定偏移与物品 ID 不变。字面骰带用例独立验证 keen T3=6000 可变为 keen T1=1500，并核对恰好 100 tick/10 碎片。unique/set/runeword 固定行及原生符文族没有重铸入口。

## 2 最小通用补口及权限

| 原缺口 | 本轮接口 / 写集 | 失败与版本归属 |
| --- | --- | --- |
| WorldWork 只接受 worldItem 材料 | `WorkTicket.kind='item-operation'`，`WorkItemOperation` ≤1 KiB；唯一原生目标进入真实 escrow。`ItemRevision.ts` 对完整原生序列化与 moduleData 作 SHA256，无持久 revision 字段 | 接受前 CAS、同对象、单 owner 检查；worldSdk 2、world5 schema 6 |
| 模块不能受控完成装备修改/roll | `WorkItemProvider.prepare / validateStored / commit / validateProposal`；分离纯准备、纯读档准入、完成回调与绑定提案校验；`WorkItemProposal` 仅自有 data 或固定原生装配提案 | 无 Game/Item 活引用；RNG 完成期最多 64 次非退化抽取、beginItem(0) 一次，提案校验前及 finally 撤销句柄；foundation 19 |
| craft 可选分支没有可保存身份 | `RecipeDefinition.lootRoll`、票据 `workRoll` 绑定 capability/providerIdentity/depth/recipeId/baseId/maxRarity | absent 在接单时绑定 plain；坏数据、不支持、异常均失败，绝不自动降为 plain |
| 原工作回滚会替换模块状态/RNG 子对象 | WorldWork 使用既有 itemCommand 完整图事务；C5 checkpoint 显式捕获实际 RNG 对象图 | 恢复对象身份、双流、allocator、组件/state、消息、物化与缓存；不只恢复 JSON 值 |
| 工位 UI 缺公开只读信息 | loot 模块 `projectView` 发布脱离活体的工作/容器读模型；游戏 view 再收窄为已知按钮 DTO | UI 不导入宿主 WorldWork 实现，不开事务、不耗实质随机；boundary 守卫保持 |

主要实现：[WorldWorkItems.ts](../../src/engine/Core/WorldWorkItems.ts)、[WorldWork.ts](../../src/engine/Core/WorldWork.ts)、[WorldWorkValidation.ts](../../src/engine/Core/WorldWorkValidation.ts)、[worldSdk.ts](../../src/ext/worldSdk.ts)、[loot/work.ts](../../src/ext/modules/loot/work.ts)。没有给 `Game` 增加字段，U03 状态登记无需变更。没有把原生装备伪装成 worldItem，没有新增仓库、装备槽或任意写回调。

## 3 C5 所有权、容量、失败和确定性

- 请求只接收 operationId、itemId/itemRevision、stationId/stationRevision、inventoryStamp，重铸另带稳定 rowId（R1 用户明确要求替代 rowIndex）；拒绝客户端成本、时间、batchCount、产物、actorId 等多余字段。确认 No、无工位、已装备、费用不足、陈旧签名、预留不足均 0 成本。确认 Yes 后再次 prepare/CAS，原生字段变更同样失效。
- 一次接受事务把目标和费用放入真实 inputEscrow；原装备不再同时存在于背包、装备、地面或箱子。输出预留含同 ID 装备槽及符文剩余堆容量（上限 99），退款预留含目标与未耗碎片；输出/退款取最大占用而不双计。沿原 7168/8192 根预算，无容量拒绝，不丢地吞物。
- bundle 是劳动时钟，remainingTicks 只是镜像。全部拆卸为最多 400 tick 的单批，100 tick 后取消仍返原完整装备和全部费用；时间不退。完成入口先捕获图，再校验、roll、更新目标/消耗材料、接纳输出、递增 ordinal、记事实。
- 完成失败先回到**完成入口**，再显式取消退款未完成投入；保留已耗劳动和早先已完成批。provider 抛错、更新、材料输出、事实发布边界分别注入故障。失败不会改成普通产物，不静默重试；旧 ticket/ordinal 不再发放。
- 取消、受伤、离层、工位销毁、死亡有本轮原生 escrow 用例；威胁沿既有 C5 中断检查及相关宿主回归。退款沿原 C5 路径，非法重复根、错误数量、错误 escrow 元数据及旧身份拒绝。
- 当前版接受中的装备可 save/load，load 调用独立 `validateStored`，测试断言没有重新调用 prepare/commit。真实命令录像、seek、续录及通用 255/256/257、2047/2048/2049 边界/同步与 worker 路径通过定向测试。
- 完成提案另经纯 `validateProposal` 对照绑定请求：craft 基底、来源/地点/配方、绑定物等、maxRarity、孔数和词缀生成域、已知/+0/无腐化；拆卸只改序列与成词状态；重铸只改选中行且属于当前最高三阶窗口。越级稀有度、错误来源/配方、顺带改鉴定/强化的负例拒绝。craft 存量不允许 rare/unique/set，但允许原 normal 后续合法镶嵌成为 runeword。
- forge 建造与使用测试从合法受控初始场景执行生产命令；稀有 4 符文目标和故障票据属于受控见证，不标成自然掉落。旧 crafting 自然公共命令路线单独按原入口重录。

## 4 知识、容器和预算

工位按钮按详情顺序排列，以已知词缀名称标记重铸行，事件和命令均使用稳定 rowId；显示碎片/工时及“可能变差”的重铸提示。只在当前合法锻炉工作位、自己包内未装备目标上提供操作；未知底材拆卸不揭露其余秘密，未知装备不暴露重铸候选。所有新增玩家文本进入 i18n，关闭面板后的陈旧回调不提交。

箱内装备进入原只读列表、筛选和已知投影，提示先取回，没有箱内改装按钮。`loot_work_container.test.ts` 使用真实 settlement 箱子，100 次读取保持图/RNG/ID不变，先走现取回命令 100 tick，再工位操作 100 tick，存读保持材料与装备守恒。跨模块测试依赖明确登记 crafting/settlement；生产代码没有跨模块私有导入。

`computeEquipmentRowBudget` 在目录准入时计算保守上界：包含随机行互斥组、局部伤害展开、按对应品质强化上限启用的强化行、unique/set 固定行、套装累计阈值、四孔/整词路径。当前每件武器 **11**、甲 **8**、戒指 **6**，四槽合计 **31**，加 **4 条 final cap 行**得到 provider 总计 **35**；每件上限 24、provider 上限 256 均未提高。6 随机行/8 固定行/4 孔、owner 4 KiB、总 moduleData 8 KiB、深度 16、loot state 4 KiB 等旧约束保留。目录数值、引用、堆叠及工位成本的非法输入测试保持拒绝；不以降低运行守卫通过预算。

## 5 版本和机械身份

| 身份 | C2 → C3 |
| --- | --- |
| foundation | 18 → 19 |
| worldSdk / world5 schema | 1 → 2 / 5 → 6 |
| loot module / rules | 0.7.0 → 0.8.0 |
| loot pack / identity schema | 0.4.0 → 0.5.0 / 3 → 4 |
| loot instance / state | v4 → v5 / v2 不变 |
| crafting module / rules / definitions schema | 1.0.0 → 1.1.0 / schema 1 → 2 |
| itemSdk | 3 不变 |

所有 worldSdk 使用者（含 foraging、settlement 和中性 fixtures）同步声明 2；其数值/玩法不因此改变。公开 WorldDefinitionPack 仍 schema 1。craft origin 严格为 source/depth/recipeId，配方须在当前公开配方目录声明 lootRoll；未知配方和混搭 origin 拒绝。part/site 仍无生产入口，不实施 C4。

候选没有提交 SHA。源码哈希包含未跟踪新文件：按每层文件名排序递归收集 `src` 的 `[相对路径, 文件 SHA256]`，对紧凑 JSON 作 SHA256；与本地 A/B `sourceSnapshot()` 相同。dist 同算法。下表是 R1 修复前的明细 `final-identities.json`，当前源码/构建散列见 §11：

| 制品 | SHA256 |
| --- | --- |
| 首轮 src | `51b16631cdb01433ef20b1bdadbde7dc3e7531325d9ae15e1171b5a44dc7a267` |
| 首轮 dist | `1bda6560746685feab14958fa28806bf15d48708018361e8556336b118d725bc` |
| worldSdk.ts | `b760eceb08158337d3ec895c91aac65a3996357ca38ecabedaaa4c212c85e75d` |
| itemSdk.ts | `ba0b8a4d7401da0972ebb9ecc2f260993cbe9910d2908f5b5c6044289add69f6` |
| loot pack fingerprint | `c24a7b78a83a2fd7d3d5589f2c8eda41fec3ca058951fe49e561cda7d85108e6` |
| loot-only effective catalog | `bf56edff097ada8206cd8c3c3b72c93564970d9a53207347a5986c8e5b54813c` |
| loot rules fingerprint | `c4659bf9870387e902f78e253b2142bf79880adcad031ddd93ef3a1882a890ea` |
| crafting pack fingerprint | `6c92dced97fb2f6f192be73ceb432c558c826d5bdf0e1de2b0ff2437cdbe2e3a` |
| crafting world definitions | `c06959e7cbc189eb02aa32dbaa14576c2a5c3174c754ea5b3074d36d08bf22a2` |

manifest 按实际模块组合由上述 foundation/module/rules/definitions 身份产生，完整身份随真实 `current-save.json`、`current-recording.json` 与 A/B 输入保存；不伪造统一的跨组合 manifest。无旧存档迁移。

## 6 黄金、旧前提与首次失败

保留第一次失败和重测日志，不将失败运行改写成通过。旧测试固定，原 HEAD 生产树作为反事实对照（`base/`）；更改的旧前提限于版本号、新增目录数量/指纹及现在合法的 null kit，断言仍检查拒绝非法类型、严格身份和完整输出。

| 原断言/制品 | 归因及处理 |
| --- | --- |
| crafting 模块/投影/UI、loot i18n、geometry 的旧数量/身份 | 原生产版本的五文件 321 项通过（`counterfactual-ui.log`）；更新为 9 配方、3 工位、24 方向及新身份，保留断言语义 |
| 其余固定 module/pack/schema/item/worldSdk 见证 | 原版本相关数据/SDK反事实 40 项通过，inert 版本见证 1 项通过；只更新已冻结结构扩展的前提，非法未来 schema 继续拒绝 |
| crafting_schema 原生 Appearance 源码守卫 | 原 HEAD 已失败（`baseline-small.log`，342 pass/1 fail）。保持守卫原样，将生产原生颜色选择与扩展覆盖分成两步，保留幻觉 RNG 顺序/结果；定向 Appearance、crafting schema 复验通过 |
| B4 符文黄金 21 条 | `capture.mjs` 用每条原 draw tape 重新调用原 `rollLoot`，核对每次区间、draw 数及 native 全等。语义差量仅 21 个 `data.v:4→5`；JSON 键顺序随实际生成器输出。没有换骰或降低比较 |
| crafting natural-trace | 原 HEAD 旧 fixture digest `78a9…b50a` 已失配，原入口实测 `27bb…84b7`，三个测试仅摘要失败。用原 `CRAFTING_CAPTURE_TRACE` 捕获 base/head，候选 `ec80c3ea8150a23eecedf50704c1d159f7a29a5b7f781d71b14d7e864b02afea`；仅替换 fixture 的 final.digest，保留全部命令/期望 |
| crafting geometry | 原 `CRAFTING_CAPTURE_GEOMETRY` 重录；3 个场景只变 definitions fingerprint，光线格、工作位和其他几何逐字段不变 |

自然 trace 逐字段清单在 `trace-diff.json`（1082 个叶差量）：snapshot 的 foundation、crafting manifest/rules/schema/fingerprint、world5 schema/definitions；recording codec/extension 身份、每事件 chainDigest、周期 checkpoint 的 extensions/world5/root，以及捕获时间戳和最终摘要。库存、节点、模块玩法状态、命令及 RNG 不变。对比 `trace-base.json` 与 `trace-head.json` 可复核，不用“版本变了”掩盖未归因的玩法差量。

其中事件级差量明确为 264 个 chainDigest、264×3 个 checkpoint 字段（extensions/world5/root）、2×3 个 fullCheckpoint 字段；其余为 recording 顶层 10 项、snapshot 9 项、final.digest 1 项。没有改断言范围、RNG 容差或自然路线命令。

本轮首次功能测试还暴露了：回滚替换对象身份、UI 私引 WorldWork 的 boundary 违规、动态 i18n 键无法被守卫解析，以及性能受控场景在同一背包堆叠全部压力数据的容量冲突。分别修正生产图捕获、公开 view 接口、字面 i18n 分支，及拆为独立 craft 压力场景；未调大背包或放宽守卫。新写的重铸骰带测试曾把最小抽样错判为 T3，按既有升序阶权重修正为 T1=1500，新增恰成本与未选字段断言。早期导出未加载是测试与编辑并行期间的陈旧 worker，最终新进程通过。诊断阶段有中止运行和重叠批次，均不作为性能证据。

## 7 首轮限定验证（R1 修复前的历史记录）

Node **24.19.0**，`NODE_OPTIONS=--max-old-space-size=3072`；最终 Vitest 批次 `--maxWorkers=1 --no-file-parallelism`，无性能/构建并行。执行实际 `vue-tsc -b` 后 `vite build`，等价于项目 build 的两个步骤。没有跑完整 npm/ext/drift、CE/full/gen、平衡普查、全子集、单删或单留。

| 运行 | 实际结果 / 证据 |
| --- | --- |
| 相关规则、UI、原有 C5/C6 回归诊断 | `related-second.log`：61 文件，1981 pass/10 fail；失败归因见上，不能称整批通过 |
| 对受影响失败/版本文件的定向复验 | `related-final-retest.log`：17 文件，1209 pass/1 fail；唯一新骰带测试前提错误后在下一行通过 |
| 最终工位及 UI/SDK | `final-work.log`：5 文件 **66 pass，0 skip**，其中 work 31、容器 1；exit 0 |
| 最终完整图及录像边界 | `recording-and-graph.log`：3 文件 **41 pass，0 skip**；exit 0 |
| 提案校验补齐后的末次定向复验 | `delivery-tests.log`：8 文件 **225 pass，0 skip**，其中 work **36**；包括物品/生成性质、SDK、测试归属、硬编码及源码卫生；exit 0 |
| 各文件最后一次结果去重 | `final-test-inventory.json` 曾汇总 74 文件、2603 项 pass，但 R1 在同一候选源码复现了 2 项既有 schema 失败；**撤回以该清单证明当前字节均通过的结论**，保留原清单作历史记录。当前限定验证以 §11 的同一最终源码批次为准 |
| boundary / 测试依赖检查 | `delivery-boundary.log`、`delivery-dependencies.log`；exit 0，依赖 errors=[] |
| vue-tsc / build | `delivery-types.log`、`delivery-build.log`；exit 0；仅既有大 chunk 提示 |
| A/B 身份及策略脚本 | `delivery-perf-selection.log`、`delivery-perf-policy.log`；exit 0；保留缺制品/hash漂移、阈值、2/3 与不能 freeze 负例 |

最终批次没有 todo、unhandled error。Vite SSR 小场景可能打印沙箱拒绝 HMR 端口 `EPERM 0.0.0.0:24678`，服务器仍使用 SSR 完成并 exit 0；与测试失败/随机漂移分开记录。

提案校验增补的首轮 `proposal-final.log` 为 209 pass/3 fail：三个新退款用例误把新加 1 木材当作总库存，遗漏已有启动材料；改为核对操作前后总量守恒。测试中误用目标 lib 不支持的 `Array.at` 改回既有 `slice(-1)[0]`。随后 224 项通过，再补“选定修改以外字段不可改”的独立负例后得到末次 225 项通过；未削弱生产守卫或既有断言。

### 一行全移除

只用一次 `check-module-removal.mjs --profile=removal --retain=none --prepare-only --engine-only` 创建布局，真实删除 combat/crafting/foraging/giants/growth/loot/narrative/settlement 八目录，不留桩。副本路径由 `all-removed/module-removal-results.json` 的 temporaryCopy 指定；后续仅同步同副本的非模块最终修复。原 preparation 状态保持 `prepared-not-verified`，手动限定门禁的实际结果另记，不冒充全 ext runner。

第一次限定门禁六步均 exit 0，选定测试 131 pass/1 skip。具名 skip 是 `ext_world_work_transactions.test.ts` 依赖 combat，在全移除树按声明缺失；不是修改生产断言或把正常树测试跳过。无模块 new/play/save/load/replay/seek/continue 全链通过。真实当前版本 loot+crafting 导出的存档/录像在此副本缺包拒绝，审计活局图、双流、allocator 不变，没有编辑 manifest 或借旧版本提前拒绝。末次同步后的结果见下文补记。

## 8 性能交付

注册 `6c3` 为未接受、需从新局生成的身份，沿原完整 classic/all 路线规划器与 observer；C3 不借 C2 预算自动通过。新增 `profile-ext-6c3.mjs` 的受控补充场景覆盖纯读、拆四枚、容量拒绝、中断/离层、16 批 craft 与失败退款；不把它替代自然 D20 路线。`profile-ext-6c1.mjs` 只适配 C3 合法实例 v5，旧计数与断言保留。

用户要求不 commit，而正式 A/B 原本只允许干净提交，因此增加**仅本地 rounds=1、classic/all 两组合** 的 `--head-source-hash` 诊断入口；要求完整 src（含未跟踪文件）哈希前后不变、无源文件符号链接，A 仍须干净；`GITHUB_ACTIONS` 下拒绝。沿既有工具支持 limit=0（全程）或 1…1714（局部诊断），最终本地选用 **limit=257** 覆盖第一检查点；仍生成完整 D20 路线，但不称完成本地全程计时/原预算检查。该入口永远 incomplete、不能 freeze，正式云端仍要求干净提交、limit=0 和三轮。云端、缺组合、越界 limit、三轮 snapshot、hash 漂移负例拒绝；observer、比较器、路线恢复器、D6 阈值及正式 freeze 条件保持。C1/C3 受控补充场景在局部冒烟中也执行。

本地诊断用独立 A/B checkout，均以原 HEAD 为 git 基点；B 叠加上述 src 快照，不能把 B 的 git HEAD `33d7aba` 误认成候选身份。`ab-smoke/`、`ab-smoke-final/` 均在计时回放前中止（exit 130），不计通过；第二次已捕获双方完整输入，复核发现提案绑定校验缺口后保留旧快照证据并修生产。最终独立串行运行证据为 `ab-smoke-delivery/`，结果在下文补记。正式性能结论只由云端三轮给出，不采用本地毫秒数或预算。

最终 all 生成保留原规划器的首尝试失败：D6 `(33,17)`，448 条命令后 `No stairs path`；既有有界恢复器按原规则将 nextEntryWaits 置 1 后完成。`candidate-artifacts/all/attempt-0-failure.json`、`route-attempts.json` 和 `.recovery.json` 保留原证据，没有编辑世界或改种子。成功输入为 classic 2208/all 2423 事件，均满足 D20 500 次结算；all 与 C2 的生产命令/决策/RNG 前缀覆盖全部 2423 事件。

维护者提交后触发参数：

```text
workflow: ext-perf.yml
workflow ref: ext/phase6（须包含本轮工具/实现提交）
base_ref: 33d7aba6e458529ae126dee2d889c7b2c24507bd
head_ref: <维护者提交后的完整 SHA>
base_identity: 6c2
head_identity: 6c3
rounds: 3
```

要求保留完整输入、D20≥500、256/2048 边界、同输入逐域/RNG/计数、相同结果前缀和全部三轮；按既有 D6 裁决，若通过再按原工具 freeze 并独立完整回放检查。本轮不生成已接受 C3 预算，不触发云端。

## 9 浏览器三档清单（待维护者逐项执行）

三档均**未做浏览器人工验收**，SFC/纯读测试不替代视觉结果。固定候选 src/dist 身份见 §5；新局 easy、standard 预设，可用 seed `51020001`，主要组合 loot+crafting，容器场景加 settlement。自然获取锻炉材料沿现 D2 金属节点及 make-pick；四孔/特定词缀压力数据可使用合法受控场景，但须标注受控，不能冒充自然路线。

| 尺寸 | 必查项目 | 当前结果 |
| --- | --- | --- |
| 320×568 | 竖屏列表/详情滚动、长词缀和按钮换行、末枚/全部/行选择可触达、成本与变差提示不截断、确认 No/Yes | 待验 |
| 800×900 | 详情/比较与工位切换、材料不足/非工作位/装备中不可提交、选行后取消再选、操作后清除失效按钮、未知底材不泄密 | 待验 |
| 1440×900 | 套装/词奖励拆除后来源更新、背包与箱内筛选、容器提示和原取回流程、制造批次与工作完成/中断消息、长列表无错位 | 待验 |

每档共同复核：建锻炉→接单 No/Yes→中断退款→再次完成→箱内取回再操作→save/load→回放/seek；检查无重复发放、已耗时不退。再检查仅 loot 无工位按钮、仅 crafting 两配方 +0 已知、无 settlement 背包工作可用、幻觉和未知装备不显示不应知道的信息。记录浏览器/版本、实际 src/dist、截图路径和逐项结果；截图及 >1 MiB 原始制品不提交。

## 10 首轮交付补记（R1 修复前源码）

末次全移除同步后六步均 exit 0（`all-removed/delivery-gates.json`）：boundary、测试依赖、vue-tsc、build、选定测试 **132 pass/1 skip**、全关生命周期/缺包拒绝。比前次多 1 项是本轮新增的中性 SDK 类型/请求见证；具名缺 combat skip 不变。`all-removed/lifecycle.json` 状态 pass，完整图/RNG/allocator 审计通过。

`all-removed/final-source-verification.json` 进一步核对 887 个非模块源文件与候选逐字节相等，八模块目录全部缺席；该非模块清单 SHA256 为 `aba356f5e37479c0b2b759a24c1b6536163fa708b48da08e7b03804b5eb6f580`。

最终本地 **rounds=1、limit=257** 的 A/B 冒烟已完成，`ab-delivery-exit.json` 为 **exit 0**；`ab-smoke-delivery/result.json` 为 **hard=pass、status=incomplete**，没有生成预算。起止 UTC 为 02:01:38—02:11:28。最终 src 快照在运行前后相等；生成器完整输出仍为 classic 2208/all 2423 事件，D20 均结算 500 次，但最终观察器只回放每侧前 257 个事件，不能据此宣称完整 D20 回放或原预算通过。

| 冒烟观察器输入 | A/B 事件 / OOS | A/B 客观块 / tick | 收集 / extension.transaction 次数 |
| --- | --- | --- | --- |
| classic，前 257 输入 | 257 / 0 | 221 / 21800 | 0 / 0 |
| all，前 257 输入 | 257 / 0 | 255 / 25200 | 510 / 530 |
| all，可比前缀独立再捕获/回放 | 257 / 0 | 255 / 25200 | 510 / 530 |

六次 observer 均零 OOS。257 事件可比前缀命令/结果/RNG 哈希均为 `c177f30aee2c52669b7e201acbb408802640e9e1f71542bed45a47b721a37471`。同版本 all 的两次同输入回放另用未改的 `compare-ext-perf.mjs` 比较：A 为 665523 个终态叶、B 为 665604 个终态叶，各 1044 个域叶，差量均 **0**（`A/B-same-input-comparison.json`）；17 项计数及完整终态/逐域/双流保留在原观察器制品中。所有计时分位数、墙钟、RSS/heap见 `ab-smoke-delivery/summary.md` 与原始 JSON，不作正式 D6 裁决。

单轮计时并非全项未越线：all/prefix 的 command P95 为 A **44.798 ms**、B **52.024 ms**（+16.13%，阈值 49.277 ms），该对比 1/1 轮越线；classic/full、all/full 本轮没有越线。少于三轮不能归因或裁决 D6，既不把它改写成性能通过，也不擅自采用预算；交云端原规则三轮判断。

完整新输入 recordingHash：classic `2c42da63a126342cdc9cd66dabc5ded85affe17a7e951094d516c490e4254249`，all `5d9af59885faf2e6c7214ba1b1c31e039f86bc2f3e0561a7483c132ca21a4477`。observer instrumentationHash 保持 `6e23847b7d9d97a01ee42c77388bf012be62fb45f9ac4895e69434432879bef3`；最终 runner hash `03a950b63eaeb1e3c96082d90d3d38ef924535539b53712c5a37d1a80fe8ac3e`，C3 场景脚本 hash `eb8a7fff19feab5cea21c4f8535c44352b04a15eb5018ea4e464d65421ebc5ce`，其余控制工具逐文件散列见 result.toolHashes。

C1 受控补充场景 pass。C3 三次计数及两条 RNG 流完全一致：事务 41、热读取 100、查询事务 0；拆四枚 400 tick/40 碎片、返 4 枚；取消及离层各保留 100 tick 已付劳动；16 批制造 16000 tick、16 产物；失败批保留 1000 tick。热读完整图/双流/allocator 不变。冷读耗时 6.275/3.345/3.080 ms，热读各次 P95 1.729/2.062/1.411 ms，只记录本机诊断，不与历史机器或云端预算比高低。

最终 `git diff --check`、LF 与文件大小检查通过；91 个改动/新增文件均小于 1 MiB，原始证据不在仓内。末次源码快照复核无漂移，HEAD 仍为 `33d7aba6e458529ae126dee2d889c7b2c24507bd`。

正式云端三轮性能和 §9 浏览器三档仍待验。交付停在 C3，不开 C4，不 commit。


## 11 第 1 轮审查发现处理

依据 [第 1 轮独立审查](phase6c3.review-findings.md) 及用户本轮明确指示逐项复现和修复。未编辑审查文件、冻结合同或任何数值表；不 commit、不开始 C4。此次只运行相关测试、boundary、测试依赖检查、vue-tsc 和 build，没有重跑全移除、性能或浏览器三档。

### 11.1 原问题复现与修复

| 发现 | 修复前复现 | 生产修复及回归 |
| --- | --- | --- |
| R1-F1：显示行与重铸目标不一致 | 原审查 probe 实测底层 `[precise, keen]`、详情 `[keen, precise]`；首个按钮提交 rowIndex=0，实际 precise→leech，而 keen 未动。`repro-probe.log` 保留原结果 | 请求、SDK、持久票据、prepare/完成/load 均改传 rowId。loot 使用当前词缀 ID（合法随机行的互斥组保证 ID 唯一），与完整 targetStamp 一起绑定；只在内部按 ID 找原始数组槽。UI 事件同样携带 operationId+rowId，按钮与详情同序、显示已知词缀名称。拒绝旧 rowIndex、数字/缺失/未知 ID。实际 SFC 点击、真实命令、托管中 save/load、终态重复继续、recording replay/seek 均检查只改 keen、precise 不动及 100 tick/10 片 |
| R1-F2：craft 完成未绑定物等及生成域 | 原 probe 中 D1 ilvl=99 / sockets=4 的实例校验和提案校验均为 true；仅注入 ilvl=99 的真实命令花费 1000 tick 后完成并发放错误产物。`repro-probe.log` | 完成校验先按绑定 depth 和冻结 craft 公式核对 ilvl，再核对 normal 的对应基底/物等孔数正权重；magic 的品质正权重、可抽词缀/阶窗口正权重、预设数量或候选耗尽、目标符文深度域。保留通用存量物品校验的后续合法改造语义。新增 D1 单变量 ilvl=99、3/4 孔、D40 窗口外 T1/空 magic 行负例；D1/8/20/40/99 双端骰生成合法输出正例。真实故障完成、托管中读档、终态读档及回放/seek 验证：取消、0 产物、材料全退、已耗 1000 tick 不退、不重复退款 |
| R1-F3：cap=0 仍加强化行 | 原 `loot_schema.test.ts -t 'zero enhancement cap'`：武器/甲 2 fail、戒指 1 pass（99 项仅过滤未选中）；`repro-budget.log` | `computeEquipmentRowBudget` 分别看 normal、magic/rare、unique、set 的实际强化 cap；cap=0 不加相应强化行，正 cap 仍计入零值行，与运行时一致。随机行按 magic/rare 各自的数量上限和 cap 分别取界；新增稀有 cap=0 的合法 24 行目录，避免借用 magic 的强化额度。未修改 `loot_schema.test.ts`，原有恰 24 行接受/25 行拒绝及 3 个 cap=0 用例复验。默认预算仍 11/8/6，每四槽加 final cap 共 35；24/256 守卫未改 |

rowId 字段替代依据本轮用户明确要求，冻结 C0 文档保持原文；只修正未提交 C3 候选中的选择身份，不改数值。仍使用已分配的 foundation19、worldSdk2/world schema6、loot v5/0.8.0、crafting schema2/1.1.0，不迁移修复前候选票据。新 SFC 跨模块工位测试如实将 crafting 加入该文件的 required 依赖，不绕开依赖守卫。

### 11.2 验证与证据

本轮证据目录 `/private/tmp/phase6c3-r1/`。Node 24.19.0、Vitest 单 worker / 禁文件并行；最终相关测试在生产源码停止编辑后执行。原始失败日志保留：`fix-tests-1.log` 是新 SFC 尚未登记 crafting 依赖的启动拒绝；`types-1.log` 是新增代码/测试的类型错误；`fix-tests-2.log` 为 181 pass/2 fail，两个新中点用例没有派发 ActorAction 调度边界；`midpoint-retest.log` 保留同一测试推进问题，修正后 `midpoint-retest-2.log` 两项通过。没有因此修改旧断言、放宽守卫或增加超时。

`final-related.log/json` 的第一次完整相关批次为 14 文件、424 pass。随后补出的随机品质预算反例在 `repro-random-budget.log` 精确复现 24→27 误计；生产修正后 `budget-retest.log` 为原有 3 个 cap=0 用例与新增 rare cap=0 用例共 4 pass（其余仅 `-t` 过滤）。最终验证重新覆盖全部 14 文件，不把前一候选的日志充当最终源码证明。

| 最终限定门禁 | 结果 / 原始证据 |
| --- | --- |
| 相关 Vitest（一次完整批次） | **14 文件、425 pass、0 fail、0 skip**；`verified-related.log/json`，exit 0 |
| loot 工位/容器/schema/UI/i18n/item | 上述批次 7 文件、271 pass，其中 work 44、schema 102、实际 SFC 14 |
| C5 SDK/边界/失败/事务/审查回归 | 上述批次 5 文件、118 pass |
| 异步录像 / 周期快照 | 上述批次 2 文件、36 pass，含 256/2048 边界 |
| boundary | `verified-boundary.log`，exit 0 |
| 测试依赖检查 | `verified-dependencies.log`，exit 0、errors=[] |
| vue-tsc -b / vite build | `verified-types.log`、`verified-build.log`，均 exit 0；这两个步骤与项目 build 脚本相同，仅既有大 chunk 提示 |
| diff / LF / 大文件 | `git diff --check` 通过；`hygiene.json` 的 92 个改动/新增文件（包含原审查文件）无 CRLF 或 >1 MiB 文件，原始证据均在仓外 |

完整命令及退出码在 `verified-gates.json`，最终批次开始后不再编辑生产或测试源码；`before-final-gates.json` 与 `final-identities.json` 的 src 清单逐项相等。对照首轮源清单，本轮仅 14 个 src 文件变化；原有 `loot_schema.test.ts` 及所有数值数据文件逐字节未变。没有更新黄金或 trace。

| 最终制品 | SHA256 |
| --- | --- |
| src（1473 文件） | `b0098a658c398131998f0553b74d4d5a45b4a543ef61eeded5a783875b7d5f03` |
| dist（61 文件） | `0699f70f96b381072237eabbd20029e13adab2507d1b92314594d976ad39a7dc` |
| worldSdk.ts | `34695c7a2d845d7de9cb5ea96ed1593ad9269bcda2c7841be2df331a14e5f5ce` |
| itemSdk.ts（不变） | `ba0b8a4d7401da0972ebb9ecc2f260993cbe9910d2908f5b5c6044289add69f6` |

源码/构建散列算法沿 §5，完整文件清单保留于 `final-identities.json`。loot/crafting 数据表及 §5 的 pack/catalog/rules 指纹未变；当前候选以本节新 src/dist/SDK 散列识别。HEAD 仍为 `33d7aba6e458529ae126dee2d889c7b2c24507bd`。

### 11.3 尚未执行的验收及交付边界

§7、§10 的首轮日志及 §8 A/B、全移除证据只属于修复前 `src=51b16631cdb01433ef20b1bdadbde7dc3e7531325d9ae15e1171b5a44dc7a267`，**不能作为当前修复源码的性能或全移除通过证明**。本轮遵照限定测试范围未重跑它们，也未添加性能身份/路线；§9 三档浏览器清单仍待验，SFC 自动测试不等于实际浏览器验收。

云端交接参数保持 `base=33d7aba`、`head=<提交后 SHA>`、`base_identity=6c2`、`head_identity=6c3`，正式完整路线 rounds=3。当前没有提交 SHA，不伪填 head。本轮止于 R1 三项修复与限定门禁，不 commit，不开 C4。


## 12 拆分云端性能裁定与冻结（2026-10-17）

维护者本次授权先分析噪声/执行路径，不能确证低成本无语义修复时沿既有方式登记开销并冻结。原完整artifact `/private/tmp/perfci-39028334751/`，run **39028334751**，A=`33d7aba6e458529ae126dee2d889c7b2c24507bd`（6c2），B=`0d2e98a91e238e9c988017e87c7a51fb31569691`（6c3），control=`1094801`。原汇总及三个shard重新离线验证，hard pass；classic **0/3**、all/full **2/3**、all/prefix **1/3**，**原D6 regression保持**。没有将前缀通过当成完整路线通过；prefix门禁虽在本次覆盖全部输入，仍不含D20分层指标，且在另一runner配对计时。

两侧完整工作量相同：classic2208输入/2431块，all2423输入/2549块与客观回合/253375ticks；all去耗时rowsHash、双RNG与全部observer计数相同，最长同结果前缀就是完整2423输入。版本身份导致state/domain摘要不同，不要求跨版本这些摘要相同；各自三轮完整状态/域一致且0 OOS。完整all不能按不同工作量降为report-only。

all/full三轮命令P95变化 **+0.73%／−1.65%／+1.94%**，墙钟 **+0.21%／+0.30%／+3.47%**；P95/墙钟无越线。越线仅第1轮round.p99 +66.16%、D20命令max +46.80%、D20 round.p99 +49.21%，以及第3轮D20 round.p99 +35.07%。第2轮B的D20命令max反而−27.52%，第3轮−23.80%。D20每轮570客观回合，P99取第6大；>500ms尖峰A三轮1/2/1个、B为3/0/2个，发生命令随轮次漂移，A也有775–984ms尖峰。逐轮完整数值及命令位置见[6Z §5.1](phase6z.report.md#51-拆分云端复核与预算采纳2026-10-17)与[小型证据](evidence/phase6c3-c4-perf-review.json)。不同shard机器的绝对耗时不互比。

本地 profile 使用隔离的A=`33d7aba`、B=`0d2e98a`源码副本和各自云端原all输入，从origin完整串行回放；只在副本加诊断计数，主仓生产未改。每侧2423输入、0 OOS，最终完整状态hash分别精确等于云端A/B，两条RNG也一致。计数窗口是loadReplay后的输入执行；CPU仅采D19–D20，不包括冷启动。原始脚本、log、`.cpuprofile`及小型汇总在 `/private/tmp/p6-perf-review/`，不将单次本机耗时用于D6或预算。

D19–D20共551输入/622客观块：两侧`validateLootItemData`均80次，新增`prepareWorkOperation`、`bindCraftRoll`、`completeWorkOperation`、`completeCraftRoll`及runtime work-item provider入口均0次，`computeEquipmentRowBudget`在本次回放计数窗口内0次。来源校验函数会检查新增craft条件，但这条路线的craft来源为0；最终保存图的loot来源出现15个floor、2个kill，工作事实仅2条startup，没有制造/重铸/拆符文。不能以入口未触发为理由跳过通用校验开销。

D1–18两侧`worldWorkTransaction`均145次、`checkpointWorldWork`均147次；C3把前者转入`itemCommandTransaction`，因此后者A=1、B=146，确有共享回滚保护增加的内部工作，并非“所有新增代码都未执行”。这些调用在D19–D20均0，不能直接解释D20尾部；撤掉回滚保护会改变语义，未发现由证据支持的低成本等价修复。D19–D20 self CPU采样仍以既有`structuredClone`（A36.08%／B35.79%）、`isStatJson`（5.90%／5.69%）等为主；新增工位函数和`validateLootItemData`没有self样本，零采样不等于零耗时。GC采样占比3.99%／4.80%，单次profile的差别不能归因为云端某次暂停或证明纯噪声。综合结论为排除路线工作量差异、尾部偏噪声但保留真实分配/回滚开销风险；原D6 regression不变，按本次授权登记已知尾部开销/风险。

归因结论：**排除工作量差异；尾部更符合噪声特征，但不能证明纯噪声，也未确证真实代码回退**。B的全程round.p99三轮都高于A（只有首轮越线），因此不能凭尖峰漂移忽略系统性尾部风险；可能存在微小校验/分配开销。wall artifact未采GC/调度，不能给漂移尖峰指定确定的GC原因；不凭本地profile推翻原D6。没有可由证据支持的低成本生产修复，本次不改语义/回放/生产代码，以 **`known-tail-risk`** 记录限制并冻结C3预算。该采纳是本次维护者授权的人工裁定，不是自动performance pass。

`scripts/ext-perf-6c3-budget.json`由原B完整classic/all第1/2/3轮通过原`freeze-split`生成，各case三轮机器/输入/状态/计数保持，复查三轮均hard pass；完整route/source一同登记，D20均settled500。只在全部文件/hash检查通过后登记accepted=true。已有classic held-out第4轮，all/full因regression没有第4轮，故无完整独立验证；本地诊断回放也不冒充第4轮云端预算检查。预算只代表B历史commit，不追认6Z当前HEAD；不覆盖D22+、浏览器/真机、最大负载或活跃工位/craft。原预算文件及六次离线检查、重合并记录在 `/private/tmp/p6-perf-review/`，没有新云端任务。

本轮限定验证全部exit0：`node scripts/test-ext-perf-selection.mjs`、`node scripts/test-ext-perf-ab.mjs`、`node scripts/test-ext-perf-split.mjs`及`npm run check:test-dependencies`。身份测试随已采纳预算更新；缺产物/hash漂移/轮次/阈值/缺第四轮拒绝断言保留，原pending基线拒绝语义移到隔离的未接受C3注册表夹具继续验证，未放宽守卫。测试在两次诊断回放结束后串行执行。主仓无生产代码修改，因此未跑生产相关测试、boundary、vue-tsc、build或全量门禁。没有commit/push。日志及退出码见[联合证据](evidence/phase6c3-c4-perf-review.json)。
