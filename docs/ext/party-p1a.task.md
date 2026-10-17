# P1a 任务书：多成员底座与单步闭环

> 原稿：2026-10-11，`origin/ext/party-design` 文档提交 `8bd271b4bc26dea697ca8af1257240d848f3665d`（原稿所列生产基线 `79bb26e`）。刷新：**2026-10-18**，`ext/phase6` / HEAD `0e684d100146af38b1e2056811fef821001f7555`，并只读核对当前试玩未提交差量。依据：[已批准设计](https://github.com/coolking70/BrogueJS/blob/8bd271b4bc26dea697ca8af1257240d848f3665d/docs/ext/party-multiplayer-design.md)、[刷新合同](party-contract.md)、[P0 审计](https://github.com/coolking70/BrogueJS/blob/8bd271b4bc26dea697ca8af1257240d848f3665d/docs/ext/party-p0.report.md)。D-01～D-17 保持；§8 **M1–M5 已由维护者 2026-10-18 裁定**，M5 以本版精简门禁为准；§10 新问题仍待决定。本次仅新增三份文档，不启动实施、不改代码、不 commit，不覆盖或提交试玩改动。

## 1 目标、范围与开工基线

交付能实际游玩的单机多成员底座：两名成员通过公开命令共同完成一层，分别移动、战斗、拾取、装备、吃食、投掷、交换；主成员死亡后另一人继续；留守/强制坠落/恢复选择可用；存读、自然种子录像、seek、续录一致。上限仍为4，需测1/2/4成员，不以两人演示放弃4人的所有权和调度保险。所有成员先由同一个本地人工槽控制。

纳入：惰性 party 生命周期、成员实体能力及唯一所有权、焦点与显式 actor 输入、最小多成员就绪调度、独立背包/装备/饥饿/状态/恢复/成长组件、共享合法感知与知识、敌人目标集合、死亡/终局、单活动层迁移/留守、单步成员事件、party 专用 codec/摘要及5Y Worker接线。提供最小开局两人入口、成员切换、背包归属提示、留守/恢复选择和 actor 确认，不能只用测试私改状态替代产品闭环。

不纳入本步：P1b 窗口100/300/1000/自动档、队列计划/打断策略/预演；P1c 托管和队长指令；P1d 数量缩放、完整成员创建/招募体验与手机计划层；P2 联机、房间、倒计时；5C2 site 内容、5D3 叙事招募、5E2/5F。不改 CE 数值，不借 P1 顺手重做5Z或升级依赖。保留上述后续能力所需 actor/codec 接缝，不持久化尚无语义的占位窗口/AI状态。

开工核对 HEAD、工作区、**八模块**（combat/crafting/foraging/giants/growth/loot/narrative/settlement）的 descriptor、规则与 configuration 指纹。当前 **foundation20 / whole-run7 / recording4 / origin2 / world5.schema6 / worldSdk2 / edibleSdk1 / itemSdk4**；growth1.10.0、combat1.6.0、crafting1.1.0、foraging1.0.0、giants1.1.0、narrative1.5.0、settlement1.4.0（state2）。loot 在 HEAD 是0.9.0，当前试玩工作区是 **0.9.1**；pack0.6.0/schema5、实例6/state2/dropTables2。不能把工作区0.9.1写成已提交版本，实际实施前重新冻结。

旧候选 F14/S7/R5/O3 已过期；本版 M1 候选是 party **F21/S8/R5/O3**，无 party 沿实际冻结源 **F20/S7/R4/O2**。不预占号；身份与模块有效指纹须在实际写集确定后一起审查。零影响比较对象是这份 phase6 开工源，不再是5Z老字节。阶段6门禁及人工遗留按 [6Z报告](phase6z.report.md)、[6Z遗留](phase6z-remainders.md)原样保留，本次不宣称关闭。试玩差量清单和校验见[刷新报告](party-p1a-refresh.report.md)。

## 2 精确规格引用与适用裁定

本表的“合同”均指 [party-contract.md](party-contract.md)；按节号、条目/类型名定位，避免仅写“遵守合同”。批准设计优先于 P0 提案；单人原生行为以 CE 执行路径为准，多人新增规则不得假称 CE 规格。

| 实施面 | 精确合同引用 | P1a 落点 / 限定 |
|---|---|---|
| 实体、主成员、上限 | §1 第1–3条；§2 `PartyState/MemberState`；§2.1 第1、3段 | 4人在籍含冻结者；primary不变，leader可显式移交，焦点不替换 `Game.player`；实体/背包/计时所有者各一份 |
| 命令边界与焦点 | §1 第4–5条；§2 `PartySession/ActorIntent/PartyError`；§8 | UI提交前固定 actorId；公开边界校验控制槽后才授予内部scope；经典/NPC公开入口不因此接受任意actorId |
| 单步就绪调度 | §1 第6条；§3.0；§3.2 第3–7项（仅时间不变量）；§4“状态/恢复” | 承接顺序/唯一计时/强制等待，P1a新增“最近人工成员决策点”规则见§3.3；不实现§3.2精细窗口预算或无计划自动wait |
| 库存与交换 | §2.1 第2–3段；§4“背包/装备/使用”“交换” | ID寻址、容量/装备/预留/墙角验证；失败零副作用，交易费用按§8 M2已批准口径 |
| 饥饿与身份 | §1 第6条；§4“饥饿”“营地/同伴/休息” | native nutrition、foraging need、居民home需求互斥；普通留守成员冻结，不走居民补算 |
| 共享感知和敌人 | §4“知识/视野”“敌方 AI/气味”；§6.2 `knowledge` | 独立感官计算后并集，射击资格仍属实际actor；稳定敌对目标与能力相关寻路，不借焦点写发现 |
| 成长 | §4“成长”；设计§5.3/D-08 | 组件按actor且不重复奖励；参与分池和首访/鉴定归属按§8 M4；phase6增益细则见M6，不能临时全发给队长 |
| 死亡/胜利/换层 | §4“死亡/胜利”“换层”“坠落/传送”“营地/同伴/休息” | 全灭含冻结者；护符/出口条件沿原生，全队物品根去重；距离/坠层/无活动者恢复按§8 M2冻结 |
| 存档与单步录像 | §6.1单步分支；§6.2全表；§6.3–6.4 | 单次执行、actor上下文、完整实体图及有效codec；§6.1的窗口收据在P1b实现，P1a新增单步事件按§8 M1已批准口径，不能伪造window |
| 零影响与删除 | §6.3 第2–3段；§7末尾四项；设计§5.2/§12 | classic/无party保phase6冻结基线字节、形状、RNG、日志；物理删除party后拒绝party档，正常单人照常；netplay删除验收归P2，P1a不造空包 |
| 确认与Worker | §1 第5条；§3.0；§3.3末段（P1b）；§6.2排除项；§8；[5Y报告§1](phase5y.report.md) | P1a已有确认必须带actor并用原continuation完成；可序列化窗口待决DTO留P1b。P1a存档只能等待确认完成后的安全前缀，不能序列化generator或悄悄默认“是” |

## 3 预先裁定与实施顺序

### 3.1 已定约束（不重复申请产品批准）

1. D-01～D-17按推荐全部已批准：最多4人、共享视野/鉴定、独立背包/饥饿、全员就近换层可留守、按参与分配经验、全员篝火休息、先单机后联机。本步不改为各自时钟，不重新询问是否立项或是否4人。
2. `Game.player` 永远是主成员兼容引用。禁止执行前后临时换player、把其他成员伪装成队长、直接调用UI setter改世界。单步人工/回放共用同一prepare/commit；内部动作不嵌套公开executeCommand，不给NPC调用playerTurnEnded。成员可能由Monster承载，但不能又跑一遍原生盟友AI。
3. 一个活动层、一个simulation clock、一次环境块；body core/member与party成员概念分离。现有怪物顺序、原生prelude/客观块/恢复顺序与5D居民边界保留，不能全局改成actorId排序来通过新增测试。
4. party禁用时惰性状态**不存在**，不能新增`party: undefined`或空成员表。按合同§6.3采用有效codec路由满足严格零影响；若实现认为做不到，列真实阻断，不能偷偷忽略版本字段。旧不兼容party格式拒绝，不做迁移。
5. 所有改状态输入仍经executeCommand/executeItemCommand；实际actor权限来自引擎授予scope，不能仅信任payload的actorId/slot。readonly SDK/显示/焦点不消耗实质RNG。新增Game字段登记U03，WeakMap机械根也登记持久入口及摘要合同。
6. 全部玩家文本走i18n。保持5G严格事务写者抛错与普通事件降级的区分；不吞错伪造成功。优先新增独立 party 能力口；旧“九冻结SDK”以 phase6 当前文件为保护基线，并纳入 itemSdk4/属性管线。worldSdk/stats/forageFixture 已在 phase6 变化，不能声称仍为5Z字节；见[6Z合同差量](phase6z-contract-delta.md)。新增修改须列逐字段消费者、有效身份及兼容影响，不因 M5 精简门禁放宽 SDK 守卫。

### 3.2 实施分段（串行共享主笔）

| 分段 | 内容 | 完成标志 |
|---|---|---|
| A：actor与codec定形 | 明确实体承载、能力读写口、所有权枚举、member/state与session边界、单步输入schema及有效codec分支；登记§8决定 | 可类型检查声明、拒绝非法actor/版本/重复根；无party基线捕获，不能先大规模机械替换player |
| B：原生动作与最小调度 | 移动/等待/搜索/攻击、背包/装备/食物/投掷/交换、状态/恢复、感知/敌对、成长组件；接5D/5E/5G边界 | 不同速度成员逐次就绪；真实命令双人一层，物品/时间/RNG守恒 |
| C：跨层与持久化 | 死亡/胜利、楼梯/留守/坑洞/幸存者恢复；成员图/codec/actor inputState、Worker/event/full/seek | 同一自然局save→load→续录→replay/seek零OOS，非主成员可独立行动；坏档拒绝保活局 |
| D：最小产品入口与验收 | 两人开局/焦点/明确执行者/留守选择；精选组合/创建流程、一行物理全删与报告 | 最终树门禁及最小浏览器闭环有实际结果；未验项明列，不以P1d为由缺失基础交互 |

不得并行改Game/TimeCoordinator/codec等共享文件。独立模块工作是否委派由后续维护者另行安排，本任务书不授权自动启动多代理。

### 3.3 已批准的单步执行细则（M1/M2，2026-10-18）

P1a采用严格的 `party:actor-step` schema1输入：`expectedRevision`、`issuerSlot`、`actorId`、一个`ActorIntent`；回放保存稳定actorId与确认答案，不读焦点。仅接受本步支持的intent和明确声明的actor模块命令；未开放的计划、AI、网络字段直接拒绝。索引使用整局command index，不伪装窗口seq。引擎验证活动层、存活、控制权、ready/busy、物品根与目标资格后提交；错误映射合同§2的稳定PartyError，拒绝不分配实体ID/不消耗RNG/不推进索引。

调度停在**最早空闲人工成员需要输入的决策点**：有其他同tick成员就绪时先保留该边界，不替未输入者自动wait；界面焦点可查看任何人，但可行动提示只指当前合法决策者。新增受控槽同tick按稳定actorId领取；先完成既有到期原子效果/居民结算，再请求人工输入，保留经典和NPC原顺序。一个成员提交行动不保证整局立即走完整个该成员耗时；下一位就绪即暂停，已接受动作的余时/后摇保留。麻痹等强制状态照原生结算，不等待不可能的人工输入。禁止反复提交零耗时动作造成零tick无限循环；失败返回规划，不能内部自旋。这里是单步模型，人工缺计划自动wait（D-05）在P1b的窗口模型才适用。

确认/目标选择锁定发起actor、物品、world/command epoch和有效revision，切焦点不改已接受动作的归属。5Y的栅栏在接受前生效；已接受命令的确认/动画可继续，保存等待其完成，不能造成确认等flush、flush等确认的死锁。主成员死亡不使幸存成员无法推进或保存。

## 4 阶段5保留的执行链与phase6接缝

以下约束不因P0词法命中较少而免验；定位和差量见重扫§8.3–8.4。

- **营地/容器/合成**：WorldItemRoots遍历活动及冻结成员库存、所有cached/fallen/container/escrow根，装备只是引用。WorldWork/StructureProduction/WorldMaterialTransfer/EdibleCommands/ResidentProduction全链用实际actor定位、验证库存戳/距离/工具/busy、收费；UI目标提示和提交者一致。订单actor与发令成员不同，不能把居民劳动耗时收给发令成员，或让成员抢居民生产票据。
- **居民身份**：M3已批准互转正式入口后置P1d；P1a拒绝把resident/raid actor/多格body/临时召唤直接编入，保留同ID转换接缝与身份排他守卫。原生居民继续工作、吃粮、离营，非主成员使用营地的适配不能后置。未来互转必须原子交接来源/床位/岗位/票据/预留/日粮，失败完整回滚。
- **饥饿**：native nutrition为成员权威；foraging通过能力适配这个值，不额外挂普通companion-satiety倒计时/离营deadline；resident-status查询保持可选，卸载settlement不能破坏party-only。成员冻结不补扣，居民按home账，二者不能同时生效。
- **居民/离线时序**：TimeCoordinator的residentBoundaryTicks、settlePendingResidentNeeds、settleResidentBoundary与块末清理不得漏掉；每次正elapsed只推进一次世界，不每成员重跑离线结算。需求优先、产物次周期交付、有限生产/配额/escrow退款以及长跳有界性保持。
- **袭击**：5E1 active入侵者的登记/HP/动作/坠离白名单继续有效；被围离场暂停全部该营离线经济，结束不追补。普通留守成员并不激活该层。入营报告/重新武装由真实活动成员进入region产生一次队伍事实；全灭才停整局经济，主成员死不提前停。检查点与对象图必须涵盖新写集。
- **Worker**：新增party域与所有成员native/knowledge投影一起进入同一冻结job；有效codec、manifest、generation、boundary、previousVerifiedBoundary全链检查。保留2待决chunk限额、异步消费者栅栏、乱序缓存顺序发布、旧generation隔离、运输错误一次inline降级、完整性错禁止保存导出。P1a先沿256/2048节奏与非整块末行full；P1b才增加每窗口段末full，不重写掉5Y消费者协议。

## 5 验收矩阵（必须有结果与失败入口）

使用真实Game命令链；允许受控布景专测边界，但与自然可玩录像分列。不用只测纯函数、snapshot投影或mock Worker来替代端到端结果。

| ID | 必验场景 | 判定 / 证据 |
|---|---|---|
| A01 生命周期/权限 | 1/2/4人；第5人；重复ID/实体/物品根、frozen/dead/busy、错误slot/revision、未安装模块 | 非法输入零写入/零两流/零ID消耗；有效成员仅一个实体/计时/背包根，关闭party无额外own keys |
| A02 时间 | 速度25/50/100/200/400配对；同tick原生攻击+阶段释放+环境+居民周期；主成员慢/死 | 时间守恒、快者先就绪/多动、长动作剩余保留，环境与居民只算一次；成员不额外跑Monster.takeTurn；经典删除投影顺序相同 |
| A03 原生能力 | 两人各拾取/装备/双戒指/符文/投掷/吃食/搜索；受伤/毒/麻痹/恢复/免疫 | 实际actor收费与状态；经典/扩展中性战斗完整对象图、消息、两流严格对等；不能仅平均伤害通过 |
| A04 交换/生产根 | 相邻/墙角/满包/装备/预留/busy；双方抢同物；非主成员箱子、建造、采食、制作、取消 | 原子转根一次；费用、容量、CAS、退款守恒；writer注入失败恢复对象身份/库存/组件/两流 |
| A05 感知/输入 | 两人不同LOS/黑暗/隐形/心灵感应；换焦点/看背包/目标确认期间切焦点 | 共享合法并集，实际射击不借别人感官；同命令不同focus结果/摘要/RNG/前缀相同；敌人可攻击非主成员 |
| A06 死亡/终局 | 主成员先死、另一人死、仅冻结者存活、全灭；护符在非主成员或冻结成员背包 | 继续/恢复/终局各一次；死亡清预留与动作；必须真实出口条件和队伍确认，不能远程持符自动胜利；唯一物品计分 |
| A07 层迁移 | 全员近梯/远离拒绝/显式留守/busy/无合法落点；坑洞只坠一人、同层传送、返回恢复 | 失败无人先移动；保持ID/物品根，冻结余时，windup取消/恢复沿原跨层合同；不启用第二活动层；全部存读/回放 |
| A08 阶段5联动 | 非主成员营地命令；居民需求/岗位/订单；采食；袭击离层→多周期→返回→解围 | 成员与居民需求互斥，生产/退款一次；被围excludedTicks永久排除、别营正常；一次长离场=分段，load/seek/查看不生产 |
| A09 录制持久化 | 双人自然一层；1/4人受控长状态；255/256/257/2047/2048/2049命令边界；非周期保存后续录 | 完整成员实体/装备别名/冻结层/双流/摘要/链相等；seed replay与seek零OOS；单步输入执行一次，不能重放收据再执行一次 |
| A10 拒档/OOS | 缺成员/多根/错误codec/actor/revision/非法层/坏party域；篡改非主成员HP、库存、冻结者 | 独立full oracle检出全部机械域；失败保活局、ID分配器与两流；按现有“首个可验证分歧+区间”报告，不虚报精确发生时刻 |
| A11 Worker | inline与生产Worker同切点逐域/链/快照相等；延迟/乱序/重复/旧generation/2chunk满；save/load/seek/新局取消 | 栅栏拒绝不耗时或造空命令；确认不死锁；运输降级与完整性fail-closed分测；真实浏览器Worker与Node证据分列 |
| A12 零影响/删除 | classic与精选无party/有party组合；party-only及软联动；一行物理全删（含party），其它删除布局未验明列 | phase6开工源配对对象图/消息/确认/RNG/规范化save/replay字节精确；固定时间处理savedAt，不能删除新字段比较；有效party档删包后明确拒绝 |
| A13 最小UI/预算 | 桌面键鼠与320/390模拟触屏，两人自然闭环、四人切换/确认；动画开关；保存与Worker等待 | 可识别实际执行者，所有文案i18n；focus零规则副作用；记录主线程投影/编码/发布、Worker计算/flush及1/2/4人内存/体积，真机未测明列 |

性能按[P0报告§6.1](https://github.com/coolking70/BrogueJS/blob/8bd271b4bc26dea697ca8af1257240d848f3665d/docs/ext/party-p0.report.md#61-p1-落地后的测量方法)记录环境/配对样本/分位/完整边界长尾；P1a测单步与成员图，窗口/AI预算不冒称通过。控制状态64KiB、额外三成员实体/库存256KiB、full摘要增量预算只保留为历史估算；M5已决定P1a先实测，P1b再定阈值；不得通过少算成员、缩小写集或摘要字段“优化达标”。

## 6 当前 ext 精简门禁与运行纪律（M5，2026-10-18）

本节按维护者本次明确裁定，覆盖旧稿援引 development 全量档的 P1a 执行要求。**不跑完整 npm test、test:ext、drift 套件，不跑256/512组合穷举，不恢复 test:full/强制test:gen**；现行 package.json 也已没有 ce:fetch/test:full/test:gen 入口。正确性合同仍严格，节省的是运行集合和重复成本，不是断言/写集/失败披露。本次纯文档刷新不执行下述生产门禁。

### 6.1 影响面与静态门禁

按最终生产差量选整文件一次运行，登记静态依赖与动态 descriptor/模块加载闭包；包含受影响读源码守卫、U03、录制inputState/存读/续录/seek/Worker、战斗中性和slaying、checkpoint完整对象图回滚、growth/loot/stat来源/居民时间/创建UI及party新专项。UR2/UR3/UR4、生成或drift成员仅在影响命中时定向选测/归因，不另启完整drift。测试归属为根 `scripts/test-suites.json` 与各模块 `test-suites.json`，依赖登记 `scripts/test-dependencies.json`；不能只登旧根清单导致删包后残留硬引用。

使用当前可用 Node24、`NODE_OPTIONS=--max-old-space-size=3072`；Vitest单worker、无文件并行。影响面集合在冻结候选后串行运行；以下为独立命令入口，文件列表须由实际影响表生成，不把省略号当可执行参数：

```sh
node scripts/check-module-boundaries.mjs
node scripts/check-test-dependencies.mjs
npx vue-tsc -b
npm run build
# 按已登记影响清单执行 npx vitest run <整文件列表> --maxWorkers=1 --no-file-parallelism
```

正常树 boundary/依赖/types/build 各做一次有效结果；build内含vue-tsc属现有脚本。只在后续差量使证据失效时必要复验；每批保留exit、计数、耗时、首次失败，定向关闭不能改写首批exit1。旧前提修订/黄金变化仍须单变量反事实、原捕获重录及逐字段登记，不改守卫放宽语义。不能在本树回退他人试玩改动做反事实，使用仓外隔离副本。

### 6.2 精选组合、UI创建与一行全删

当前八模块有 **2^8=256** 个启用子集；未来加party成为九模块、**2^9=512** 个子集。旧稿“七模块128 × party off/on =256”作废；这些只是理论空间，**不是本步运行计划**。

本版精选表（`E`=当前八个旧模块，`P`=party；all必须动态发现并核对集合，不把历史all当新全开）：

| 正常树启用集合 | 必验目的 |
|---|---|
| classic；extended ∅ | 两种规则入口无party零影响、无创建步骤 |
| E | 继承八模块完整创建/营地配置，作无party配对基线 |
| P | 无growth/loot/settlement也可真实两人创建、单步/饥饿/存读 |
| P+growth；P+loot；P+growth+loot | 独立属性/掉落、缺可选能力fallback、两模块创建与M4奖励 |
| P+settlement+crafting+foraging | 非主成员营地/需求/加工、居民身份排他、嵌套配置快照 |
| P+combat+giants | 阶段动作、身体成员与party成员区别、敌人目标/掉落事实 |
| E+P；(E−growth)+P；(E−loot)+P | 新全开及缺growth/loot的多步骤创建、共享感知、持久化 |

共12条明确配置（classic与extended空集分列），按fixture依赖可再增加有理由的少量案例，不扩成笛卡尔穷举。每条经真实 Game 生命周期做自然命令→save/load→完整 replay/seek→续录；party行至少两人、1/4人重点复用 A01/A02/A09/A13。无party按同启用集合与phase6基线配对，不能只拿classic代表所有无party模块组合。零影响合同适用于全部配置，证据仅声明上述抽样，classic不属于启用子集，范围准确列示为：**扩展已选11、未穷举501**。

每条正常配置还要覆盖 MainMenu 的真实创建链（动态发现→设置→实际 growth/loot/party 步骤→configuration桥→manifest→initialCommands→新局），保留 settlement raids 嵌套对象。继承 `src/test/ext_creation_combinations_ui.test.ts`、`ext_module_creation_ui.test.ts`，不能只用引擎helper开局。取消/重试/双击/异步旧回调/提交拒绝可集中定向测；真实浏览器桌面及320/390两人闭环按A13另录，SFC harness通过不冒称浏览器通过，真机未验明列。

删除只做 **retain=none一行**：复制当前冻结候选到仓外，真实删除全部可选模块（实施后含party），验证动态发现为空、boundary/依赖/vue-tsc/build、剩余适用测试及classic/extended空集生命周期；对删除前真实捕获的party与loot档/录像做缺包拒绝且保活局/allocator/双流。此行提供party确实缺席的证据，**不等同于只删party后八模块仍在的布局验收**；单删party、逐个单删旧八模块、只留party及其余物理子集均未验明列。netplay删除归P2。

`check-module-removal.mjs`默认removal是全删一行，`--plan`先核对布局；不要用`--profile=full`/`--release-matrix`误跑扩大集合。现有`check-module-composition-smoke.mjs`仍有全组合默认，按6Z方法显式选择上述集合（必要时仓外选择驱动，保留差量与原断言），不修改守卫、不用disabled冒充删除。原runner自身的全量/浏览器标签不能充当已执行证据。

### 6.3 性能：云端拆分 A/B、D6修订与P1a测量

采用 `.github/workflows/ext-perf.yml` 的 **classic / all-full / all-prefix** 独立job，各自交错A/B三轮，`scripts/merge-ext-perf-ab.mjs`汇总；按`ext-perf-ab-policy.mjs`与2026-10-16 D6修订：命令/客观回合P95 +10%，命令max与客观回合P99 +25%，总墙钟+10%，至少1ms噪声带且严格大于，三轮中两轮任意指标越线判退。客观回合max仅报告；完整路线D20指标与全程并列，前缀不冒充D20。

当all完整路线的事件/客观块/回合工作量不同，all/full只报告相对时间，仍须通过各自完整正确性硬检查；**all/prefix必须同输入 rowsHash、双流、blocks/rounds/roundTicks可比**才判定相对时间。classic/full同样要求可比。缺轮、缺分片、短跑、OOS、输入hash/观察器/身份漂移都不能冻结或标pass。重建、profile、compare、预算、split/merge各工具身份及候选源码都绑定不可变SHA/文件散列；旧6C3/6C4预算不代表party通过，不能抹掉历史超线或accepted-known-overhead限制。现有云端需已提交ref，本次不得为启动测量擅自提交试玩改动；本次也不触发云任务。

P1a先报告1/2/4人的真实单步耗时（含零tick、强制状态、多行动、跨层）、属性/FOV/回滚成本，event/full摘要的主线程投影/编码/发布与Worker计算/flush，完整save/replay UTF-8字节及party控制根/新增成员实体库存增量、内存采样。保留255/256/257、2047/2048/2049及非周期末行，P50/P95/P99/max/样本数/冷暖/机器/Node/输入身份完整披露。规则摘要、工作量和RNG正确性仍是硬条件；P0的64KiB/256KiB及旧窗口毫秒数仅历史提案，不作P1a新阈值。P1b基于云端数据再冻结窗口/交互/体积阈值。party场景/工具身份具体接线见M11；Node性能不替代浏览器交互或手机FPS。

## 7 共享文件清单与报告交付

按消费者分组，不是允许任意重写的白名单；精确文件/符号在实施A段冻结。新模块不能直接import其它可选包源码。

| 归属 | 预计共享文件/路径 | 必须同步 |
|---|---|---|
| 主控/时间 | `src/engine/Core/Game.ts`、`TimeCoordinator.ts`、`ActorActionAuthority.ts`、`ActorActionScope.ts`、`ActorActionProduction.ts`、`ActorActionScheduler.ts`、`PhasedAttackProduction.ts` | actor授权、prelude/恢复、确认、唯一计时、居民与袭击冻结 |
| 实体/战斗/感知 | `src/entities/{Player,Creature,Monster}.ts`；`src/engine/Combat/{Combat,ActorCombatResolution,MonsterAI,MonsterBlink,MonsterTheft}.ts`；`src/engine/Map/{SafetyMap,Scent}.ts`；`src/engine/Lighting/FOV.ts`；UI感知工具 | 能力口/双解算器/目标集合/空间缓存；禁止遗漏法术/物品协调消费者 |
| 层与物品 | `src/engine/Movement/{CreatureSpatial,CreaturePlacement,PlayerTravel,LevelTravel}.ts`；`Core/{GenerationCoordinator,LevelState,WorldItemRoots,WorldWork,WorldMaterialTransfer,WorldRestProduction,StructureProduction,EdibleCommands,EdibleEffects,ActorNeeds,ActorDeparture}.ts`；`Map/StructureWorld.ts` | 活动/冻结归属，唯一库存与预留，需求互斥，离层动作，完整写集 |
| 居民/经济/袭击 | `Core/{ResidentProduction,ResidentWorld,ResidentNeeds,ResidentJobs,ResidentPathing,ResidentOrders,ResidentOrderEconomy,ResidentValidation,WorldSettlement,SettlementRaids}.ts` | actor上下文、home经济时钟、escrow、下周期交付、excludedTicks、事件身份 |
| 格式/异步 | `Core/{EntitySnapshot,WholeRunSnapshot,RecordingFormat,RecordingV4,RecordingDigest,RecordingCheckpoint,RecordingCheckpoint.worker,RecordingBackend,RecordingStorage}.ts`；`src/ext/{descriptor,types,runtime,recordingRevisions}.ts` | 有效codec、所有成员实体图/知识/party域、Worker完整身份与消费者栅栏 |
| 扩展接口/模块 | `src/ext/{runtime,types,actorQuery,world,world5}.ts`及新增party能力文件；growth/loot/foraging/crafting/settlement/narrative/combat/giants的实际命令/组件/view接线；新增`src/ext/modules/party/` | 冻结SDK审计、optional查询、奖励归属与模块删除，禁止隐式leader回退 |
| UI与登记 | `src/App.vue`、`components/{MainMenu,GameCanvas,Sidebar,InventoryOverlay,DetailPanel}.vue`、`src/ui/commands.ts`/`displayProjection.ts`/actor输入相关工具；`src/locales/`；`scripts/u03-state-contract.json`、`scripts/recording-digest-contract.json`、`scripts/test-suites.json`及必要组合/删除脚本 | actor inputState、焦点session、中文文案、源码守卫、域写入登记、测试发现 |

phase6补充候选写集（供未来P1a确定实施范围；本次一律不写生产文件）：

| 新增范围 | 实际路径 / 必须登记的写入 |
|---|---|
| 属性与物品来源 | `src/engine/Stats/{StatPipeline,NativeStatSources,MaterializedStats}.ts`、`src/ext/{attributeCatalog,stats,itemSdk,itemDrops,json}.ts`；`src/ext/modules/growth/{module,state,statSources,attributes,components,identities}.ts`；`src/ext/modules/loot/{drops,statSources,gameView,gameSession,session,work}.ts`；参与收据、属性材料化、物主、装备/escrow根、全局掉落来源账 |
| 事务与缓存 | `src/engine/Core/WorldCheckpoint.ts`、`Game.ts` 的 `checkpointGenerationWorld`、`src/ext/runtime.ts`；成员native/资源/组件/revision及依赖失效、嵌套回滚、冻结根，不删原居民/多格/掉落写集 |
| 创建产品链 | `src/components/MainMenu.vue`、`src/ext/ui/{creation,types,registry}.ts`、`src/ext/registry.ts`、growth/loot实际creationStep、party新增UI与i18n；draft/session不入规则，提交后配置/初始命令入指纹与录像 |
| 登记与测试 | 原U03/digest合同之外，`scripts/test-dependencies.json`及各模块`test-suites.json`；`src/test/ext_creation_combinations_ui.test.ts`、`ext_module_creation_ui.test.ts`和actor/属性/loot/录像的受影响测试 |
| 性能工具（M11定案后） | `.github/workflows/ext-perf.yml`、`scripts/{run-ext-perf-ab,merge-ext-perf-ab,ext-perf-selection,ext-perf-ab-policy,ext-perf-source-snapshot,profile-ext-perf,generate-ext-perf,regenerate-ext-perf,capture-ext-perf-prefix}.mjs`、相应脚本测试及新party路线/预算身份；不覆盖旧phase6预算/路线，不为测量改变生产规则 |

本清单路径含花括号分组表示法；实施时以 `rg --files` 确认实际文件，不根据旧架构文档猜格式。需超出范围时先说明因果与受影响合同，再作最小调整；不改阶段5既有报告来抹掉失败历史。

交付路径：`docs/ext/party-p1a.report.md`（实际范围/版本/决定落实/源码身份/门禁/失败与反事实/逐字段重录/遗留）、`docs/ext/party-p1a.review-findings.md`（如维护者安排审查）、`docs/ext/party-p1a.manual-checklist.md`（最小浏览器路径与真机待验）、同步已批准的 `party-contract.md` 差量。原始JSON/日志/录像/截图放 `/private/tmp/party-p1a/`，只提交小型汇总，>1MiB证据不进仓库。报告逐项回填A01–A13，未运行明确写not-run，不累计重叠通过数；不要只交“全部通过”。

未来实施提交/推送按届时维护者授权；本次文档任务没有提交授权，也不等于开工、合main或发布授权。测试与推送分别执行。

## 8 维护者已裁定事项（2026-10-18）

用户本次指令确认M1–M5全部按推荐，其中M5改为当前ext精简门禁。本表覆盖原稿的“待确认”，不再重复请示；新问题仅见§10。

| 编号 | 2026-10-18 裁定 | 落实位置 / 边界 |
|---|---|---|
| M1 | **按推荐批准**单步 `party:actor-step` schema1、最近人工决策点、同 tick 新成员槽按稳定 actorId、party 独立域及双有效 codec。身份候选随当前基线更新为 **party F21/S8/R5/O3，非 party F20/S7/R4/O2**；候选不等于已占号 | 任务书§3.3、合同§2/§3.0/§6.3；开工按实际写集复核。不改 world5 根形状则维持 schema6，不因旧稿 schema4 盲升号 |
| M2 | **按推荐批准**八邻接交换且不穿墙角；发起者付一个移动单位，收方不扣时，busy 收方拒绝；楼梯 Chebyshev≤1 且可达；强制坠者进入新活动层、其他成员冻结；仅留守者存活时零时间进入明确恢复选择，按正常入层事务激活选中层，其余冻结 | 合同§4；换层/留守/恢复为显式录制输入，确认绑定发起 actor，不能由焦点代选 |
| M3 | **按推荐批准**P1a 开局两人产品闭环，4 人合法开局配置/受控验收；俘虏、叙事、居民正式招募入口及居民双向互转后置 P1d | 本步身份排他、同 ID 转换接缝/拒绝守卫及现有营地联动仍必做；不实现 clone 成第二个 Player |
| M4 | **按推荐批准**攻击实际伤害或成功辅助影响该战斗者入参与集；死亡/离层不抹历史；参与者等权、整数余数按稳定 actorId；首访/鉴定全队一次奖励池按事实发生时活动存活成员分配 | 总池取既有奖励定义；辅助事件白名单必须审后入规则指纹。phase6 新增 XP 增益先后等细则另见 M6，不得改回全给主成员，也不得禁用 growth 规避 |
| M5 | **按维护者修订批准**当前 ext 精简门禁：影响面选测、精选组合冒烟（含 UI 创建流程）、一行物理全删、boundary/依赖/vue-tsc/build。性能走云端拆分 A/B 与 D6 修订口径；P1a 先实测单步/摘要/体积，P1b 再定阈值 | §6；不跑 256/512 穷举冒烟、完整 npm/test:ext 或 drift 套件，不恢复旧 full/gen 要求。新增 party 能力口优先；SDK 以 phase6 当前字节为基线逐项审计，不声称历史九文件从未变化 |

M3后置不减少非主成员现有营地/采食/合成、居民运作、袭击冻结和Worker持久化验收。

## 9 phase6 差量、冲突点与处理建议

以下是现行单人代码接入 party 的迁移风险，不是宣称这些路径当前单人玩法有缺陷。按符号定位；行号随试玩修复漂移时以内容为准。

| 冲突点 / 现行证据 | P1a 必须处理 / 建议 | 验收对应 |
|---|---|---|
| `growth/module.ts` 的 `settle/planAward`、`growth/state.ts`：组件已有 actorId，首访/鉴定仍发 `state.playerId`，击杀仍有 player/ally 分账；`planAward` 经 `growth.xp-gain` | M4 池与收据一次性、参与历史持久化；按 M6 冻结倍率先后和辅助定义。不得既原 allySplit 又成员分池；物品/身份首访资源奖励不混进 XP 池 | A03/A08/A09，基础池守恒、倍率逐人一次、同一死亡多消费者不重发 |
| `growth/statSources.ts`、`engine/Stats/{StatPipeline,NativeStatSources}.ts`、`loot/statSources.ts`：`growth.attribute:<完整ID>` 经装备 L2 与派生 DAG；loot `!actor.player` 走怪物缩放，growth combatStats 有 player/template 分支 | M8 能力口区分受控成员与原生 NPC；全部装备槽、套装/孔/符文词与永久来源按 actor；交换/卸装同步失效、容量政策保留；knownOnly 比较不可污染真实值 | A03/A04/A05；不同成员装备/身份，同值与异值、卸装回滚、未鉴定不泄露 |
| `loot/drops.ts` 用 `event.playerId` 取 rarity-find，`ext/itemDrops.ts` 只允许同 ID 查询；Game 宿主负责生成/kill/part 接纳；unique/set/watermark/part 出生台账全局 | M7 冻结掉落属性主体；共享地面不等于复制四份掉落，也不等于全给队长。part 身体资格/来源代数和 encounter 收据不按队伍人数扩增；site 真实入口仍后置 | A03/A04/A09；抢同物、双人击杀/断肢、反复入层/seek 不重复掉落 |
| Game `pickUpItemAfterDisplacement` / 自动探索；`loot/gameView.ts`/`gameSession.ts` 仍读主成员装备/库存/工位；本树试玩改动让移动与探索遵守过滤、loot 0.9.1 | 显式 actor 拾取/容量/金币/碎片/选中物品/比较与操作预留；移动附带拾取只付原移动耗时；确认/切 focus 不换物主。保留本树修复语义，不覆盖未提交文件 | A03–A05；关闭/切换过滤、多物同格、满包、手动与探索，非主成员工位 |
| `WorldWork/WorldMaterialTransfer/WorldItemRoots` 与 loot `work.ts`：world schema6、worldSdk2、装备 escrow、退款/完成票据/ordinal、craft 来源 | 收费/工具/距离/库存戳绑定真实 actor；装备转根及预留唯一，取消/死亡/冻结后的退款仍找原物主；冻结背包、容器、cached/fallen、escrow 一并枚举。成员不能拿居民工作票据 | A04/A08；失败恢复别名/物品模块数据/账本，套装属性同步失效 |
| `runtime.ts` 的 StatSession/componentReaders、`StatPipeline`、growth derivedRows；P0–P2 减少重算/事务克隆，非“全部仍单一 player cache” | 保留已有 actor/target/facts/revision 键及跨 actor 组件依赖；新 actor 来源、死亡/冻结/GC/load/seek/回滚必须正确通知读者。knownOnly/hypothetical 不填 live cache；4096 依赖溢出全局失效保留 | A04/A05/A10；交换后两人分别读、跨角色读缺组件后创建/删除、GC 回滚、冷/热一致 |
| P0/P1 的光照/FOV几何与占位同步查询缓存，`WorldCheckpoint.ts`/`ext/json.ts` 的不可变分支共享与捕获池 | 多成员几何共享只限相同层/地形/能力/位置读集；合法感知逐 actor 算后并集。新成员原生/库存/属性 materialization 写根全部入回滚；不得把共享只读缓存当持久机械根，写开始后不可复用未封口捕获池 | A02/A05/A10，完整对象图 oracle 与嵌套失败，不能只比 save 投影 |
| growth `settle` 会按全局 objectiveClock 清理可达 actor 临时效果，而 party 留守须冻结；居民离线需求不冻结 | M10 处理 effect.expiresAt、技能 readyAt、focus/恢复与 action owner；世界/居民只推进一次，普通 party 不进入居民补算或伴随饥饿第二账 | A02/A07/A08/A09，长离场=分段，恢复不追扣 |
| `MainMenu.vue:submitCreation`、`ext/ui/creation.ts`：步骤按模块收集，每 owner 仅一个初始输入；settlement raids 嵌套配置由 `structuredClone(toRaw(...))` 转 JSON | M9 扩多成员草稿/初始化契约，保留异步 load session/attempt、取消/重试、双击锁与 onRejected；新模块 UI 不得绕过真实 manifest/configuration。`ext_creation_combinations_ui.test.ts` 是本次必须继承的创建链证据入口 | A01/A13；增长/loot 两步、无 growth/无 loot/含 settlement、重新开局、延迟旧回调 |
| `Game.recordInputEvent` 撤销非256末行临时 fullCheckpoint并重算前链；`exportRecordingAsync/toSaveSnapshot`、5Y Worker 冻结 job 与消费者栅栏 | party 身份贯穿 header/codec/checkpoint/Worker/seek/origin。非周期保存→继续→再保存与不保存路线相等；只清临时导出边界，不能清将来 P1b 有语义的段末 full；同一单步不重复执行 | A09/A11；255/256/257、2047/2048/2049、非整块末行、读档续录、延迟/乱序/取消 |
| `.github/workflows/ext-perf.yml` / `run-ext-perf-ab.mjs` / `merge-ext-perf-ab.mjs`：classic/all-full/all-prefix 三分片，输入身份仍仅 phase6 | M11 新身份接入前不声称工具支持 party；最终树含试玩差量须独立绑定 SHA/文件 hash。沿 M5/D6，完整 all 工作量变化仅报告，可比前缀才参与相对退化判定 | A13、§6.3；缺分片/缺轮/短跑/哈希漂移不得输出正式 pass |

## 10 新增待维护者决定（不回开 M1–M5）

| 编号 | 新问题（截至本次仍待决定） | 推荐 | 影响 / 决定前边界 |
|---|---|---|---|
| M6 | growth 1.10 XP 增益、辅助白名单、盟友旧分账与死亡参与者如何衔接 M4？ | 先按现有资格/总池/一次收据取基础 XP，再按 M4 等权整数分池，最后各领取者各调用一次 `growth.xp-gain`；倍率后总和可变，不再次均分。辅助先限成功造成实际治疗/护盾吸收/有效增益或控制的权威结果，禁止仅按施放、日志或 UI 声明入集；逐事件映射审后入指纹；缺权威事实的辅助暂不列入，不借此新增技能。party 成员不再走原 player/ally 二次分账；未升格盟友仍走原规则，把原 player 份作为队伍池，不能直接变成员。死亡/离层保留参与席位，冻结存活者可领取 XP；死者份记入终结收据但不复活、不转赠 | M4 未决定倍率先后、辅助事件全集和死者发奖细则；B 段 XP 实现前定案。故事奖保持原显式收据语义，本步不扩叙事招募；不能以本建议冒称已批准 |
| M7 | 共享掉落下 rarity-find 从谁取值，拾取过滤和金币归谁？ | D-16 共享地面掉落保持；kill/part 用权威 `EffectOrigin.creditActorId`（不合资格则固定主成员基准），floor/vault/encounter 用固定 primaryActorId，均不取 focus/leader/最近查看者；成员死亡后允许读取其冻结终态属性。唯一/套装/part/encounter 收据仍全局一次。拾取归实际位移/手动命令 actor，沿当前局级 loot 过滤偏好，不在 P1a 新增每人过滤配置；金币沿现有局级权威账，独立背包不自动改为四份钱 | `DropEvent.playerId` 与宿主取值守卫需 actor 适配，字段名不能直接换成未经授权的 payload；B/C 段前定案。此推荐为首版稳定口径，非 D-16 自动推导 |
| M8 | 非主成员如何获得 growth 身份/装备属性，又避免被 loot 当怪物缩放？ | 增加明确受控成员能力/身份读取，不篡改 `Game.player` 或全局 `ActorFacts.player` 语义；成员使用各自 creation identity、装备、L0 原生基值与 L2 装备→growth 属性→派生值；loot 怪物环境缩放排除全部 party 成员。原非成员 NPC 的模板白名单保留；容量增长政策沿来源 `grantPolicy`（装备容量升不补、降钳制；永久成长保原授予） | 已批准独立成长不等于已批准把所有 Monster 标成 player；A/B 段能力分类与版本/规则指纹前定案 |
| M9 | MainMenu 如何同时收集多成员身份并维持每模块一个 initialCommand？ | 在现有创建会话中增加 party roster 草稿；growth 一步收齐各成员身份并输出一个版本化批量 initialCommand，party 步收成员数/稳定槽。最终配置与全部初始命令统一预检、只发一次 new-game；引擎内 roster→actor 映射→按 actor 初始化，实际命令按公开录制边界执行。不靠 UI 预分配实体 ID，不改成多个同 owner 字符串绕过计数检查 | 具体跨模块步骤依赖/批量 payload 与成长模块有效版本仍待定；需保留无 growth 的两人创建。不能仅复制现有单角色面板、按数组顺序猜执行 actor |
| M10 | 留守冻结与 growth 的全局 `objectiveClock` 到期清理冲突如何处理？ | 单世界时钟保持；成员冻结时保存效果/冷却/focus 的剩余时长或冻结起点，恢复时平移绝对截止值，使非活动期间不扣时；不整体回退 growth 时钟、不冻结居民经济或普通 NPC。XP 收据可在冻结期间发布，计时仍不前进 | 合同“普通成员冻结”已定；需决定具体表示与 `extensions` 写集/容量，A/C 段前定案，并测长跳、恢复、seek |
| M11 | 如何给尚不存在的 party 接入云端 A/B，而不冒用 6C4 基准？ | 保留 classic/现有八模块无 party 的可比路线作为回归对照；新增显式 party-only / party+all 的 1/2/4 人固定命令场景、独立 identity/路线/预算来源，分别测单步、摘要、体积。为 runner/selector/workflow 增加已审 party 身份后沿用三分片与汇总校验；四人数据不能拿单人路线直接判退。P1a 不设新绝对性能硬阈值，P1b 据云端完整样本定案 | M5 的云端/D6 方法已定，此项决定新增场景与工具写集。现有工具仅有 p0/6b4/6c1–6c4 身份，尚不能直接选择 party；不得改旧输入 hash 或用 `--limit` 当正式结果 |

以上各项均为推荐、未批准；本次只刷新文档，不需要据此暂停文档交付。未来实施在对应分段前取得裁定，独立工作可继续；不得把等待新决定扩大成重新审批已批准的 P1a 目标。
