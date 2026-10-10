# P1a 任务书：多成员底座与单步闭环

> 编写：2026-10-11；文档基线 `79bb26ed3d52d4f06955f32408404bed86d9faa7`，分支 `ext/party-design`，已含阶段 5Z。依据：[已批准设计](party-multiplayer-design.md)、[P0 合同草案](party-contract.md)、[5Z 后重扫](party-p0.report.md#8-5z-后重扫2026-10-11)。**本次交付仅任务书，不启动生产实施。** 设计 D-01～D-17 已批准；P0 的新增细节仍是提案。本任务的预裁定区分既定约束与待确认建议，§8 的决定须在对应实现前登记。

## 1 目标、范围与开工基线

交付能实际游玩的单机多成员底座：两名成员通过公开命令共同完成一层，分别移动、战斗、拾取、装备、吃食、投掷、交换；主成员死亡后另一人继续；留守/强制坠落/恢复选择可用；存读、自然种子录像、seek、续录一致。上限仍为4，需测1/2/4成员，不以两人演示放弃4人的所有权和调度保险。所有成员先由同一个本地人工槽控制。

纳入：惰性 party 生命周期、成员实体能力及唯一所有权、焦点与显式 actor 输入、最小多成员就绪调度、独立背包/装备/饥饿/状态/恢复/成长组件、共享合法感知与知识、敌人目标集合、死亡/终局、单活动层迁移/留守、单步成员事件、party 专用 codec/摘要及5Y Worker接线。提供最小开局两人入口、成员切换、背包归属提示、留守/恢复选择和 actor 确认，不能只用测试私改状态替代产品闭环。

不纳入本步：P1b 窗口100/300/1000/自动档、队列计划/打断策略/预演；P1c 托管和队长指令；P1d 数量缩放、完整成员创建/招募体验与手机计划层；P2 联机、房间、倒计时；5C2 site 内容、5D3 叙事招募、5E2/5F。不改 CE 数值，不借 P1 顺手重做5Z或升级依赖。保留上述后续能力所需 actor/codec 接缝，不持久化尚无语义的占位窗口/AI状态。

开工核对实际 HEAD、工作区、七模块 descriptor/configuration 指纹以及版本：当前 foundation13 / whole-run6 / recording4 / origin2 / world5.schema4，worldSdk1 / edibleSdk1。不按 P0 的 foundation10 分配新号。基线后有新提交时先记差量并重核相关锚点；不得把另一个工作树的完整测试结果当作本步最终树通过。阶段5人工遗留见 [5Z人工清单](phase5z.manual-checklist.md)，不要求用 P1a 文档声称已关闭。

## 2 精确规格引用与适用裁定

本表的“合同”均指 [party-contract.md](party-contract.md)；按节号、条目/类型名定位，避免仅写“遵守合同”。批准设计优先于 P0 提案；单人原生行为以 CE 执行路径为准，多人新增规则不得假称 CE 规格。

| 实施面 | 精确合同引用 | P1a 落点 / 限定 |
|---|---|---|
| 实体、主成员、上限 | §1 第1–3条；§2 `PartyState/MemberState`；§2.1 第1、3段 | 4人在籍含冻结者；primary不变，leader可显式移交，焦点不替换 `Game.player`；实体/背包/计时所有者各一份 |
| 命令边界与焦点 | §1 第4–5条；§2 `PartySession/ActorIntent/PartyError`；§8 | UI提交前固定 actorId；公开边界校验控制槽后才授予内部scope；经典/NPC公开入口不因此接受任意actorId |
| 单步就绪调度 | §1 第6条；§3.2 第3–7项；§4“状态/恢复” | 承接顺序/唯一计时/强制等待，P1a新增“最近人工成员决策点”规则见§3.3；不实现§3.2精细窗口预算或无计划自动wait |
| 库存与交换 | §2.1 第2–3段；§4“背包/装备/使用”“交换” | ID寻址、容量/装备/预留/墙角验证；失败零副作用，交易费用提案由§8 M2确认 |
| 饥饿与身份 | §1 第6条；§4“饥饿”“营地/同伴/休息” | native nutrition、foraging need、居民home需求互斥；普通留守成员冻结，不走居民补算 |
| 共享感知和敌人 | §4“知识/视野”“敌方 AI/气味”；§6.2 `knowledge` | 独立感官计算后并集，射击资格仍属实际actor；稳定敌对目标与能力相关寻路，不借焦点写发现 |
| 成长 | §4“成长”；设计§5.3/D-08 | 组件按actor且不重复奖励；参与权重和首访/鉴定归属未定，按§8 M4裁定，不能临时全发给队长 |
| 死亡/胜利/换层 | §4“死亡/胜利”“换层”“坠落/传送”“营地/同伴/休息” | 全灭含冻结者；护符/出口条件沿原生，全队物品根去重；距离/坠层/无活动者恢复按§8 M2冻结 |
| 存档与单步录像 | §6.1 第1、3段；§6.2全表；§6.3 | 单次执行、actor上下文、完整实体图及有效codec；§6.1的窗口收据在P1b实现，P1a新增单步事件须先按§8 M1确认，不能伪造window |
| 零影响与删除 | §6.3 第2–3段；§7末尾四项；设计§5.2/§12 | classic/无party保5Z字节、形状、RNG、日志；物理删除party后拒绝party档，正常单人照常；netplay删除验收归P2，P1a不造空包 |
| 确认与Worker | §1 第5条；§3.3末段；§6.2排除项；§8；[5Y报告§1](phase5y.report.md) | P1a已有确认必须带actor并用原continuation完成；可序列化窗口待决DTO留P1b。P1a存档只能等待确认完成后的安全前缀，不能序列化generator或悄悄默认“是” |

## 3 预先裁定与实施顺序

### 3.1 已定约束（不重复申请产品批准）

1. D-01～D-17按推荐全部已批准：最多4人、共享视野/鉴定、独立背包/饥饿、全员就近换层可留守、按参与分配经验、全员篝火休息、先单机后联机。本步不改为各自时钟，不重新询问是否立项或是否4人。
2. `Game.player` 永远是主成员兼容引用。禁止执行前后临时换player、把其他成员伪装成队长、直接调用UI setter改世界。单步人工/回放共用同一prepare/commit；内部动作不嵌套公开executeCommand，不给NPC调用playerTurnEnded。成员可能由Monster承载，但不能又跑一遍原生盟友AI。
3. 一个活动层、一个simulation clock、一次环境块；body core/member与party成员概念分离。现有怪物顺序、原生prelude/客观块/恢复顺序与5D居民边界保留，不能全局改成actorId排序来通过新增测试。
4. party禁用时惰性状态**不存在**，不能新增`party: undefined`或空成员表。按合同§6.3采用有效codec路由满足严格零影响；若实现认为做不到，列真实阻断，不能偷偷忽略版本字段。旧不兼容party格式拒绝，不做迁移。
5. 所有改状态输入仍经executeCommand/executeItemCommand；实际actor权限来自引擎授予scope，不能仅信任payload的actorId/slot。readonly SDK/显示/焦点不消耗实质RNG。新增Game字段登记U03，WeakMap机械根也登记持久入口及摘要合同。
6. 全部玩家文本走i18n。保持5G严格事务写者抛错与普通事件降级的区分；不吞错伪造成功。九冻结SDK先保持字节，优先新增独立party能力口；若不可避免修改，先列逐字段兼容影响并按M5裁定，不顺手扩大冻结接口。

### 3.2 实施分段（串行共享主笔）

| 分段 | 内容 | 完成标志 |
|---|---|---|
| A：actor与codec定形 | 明确实体承载、能力读写口、所有权枚举、member/state与session边界、单步输入schema及有效codec分支；登记§8决定 | 可类型检查声明、拒绝非法actor/版本/重复根；无party基线捕获，不能先大规模机械替换player |
| B：原生动作与最小调度 | 移动/等待/搜索/攻击、背包/装备/食物/投掷/交换、状态/恢复、感知/敌对、成长组件；接5D/5E/5G边界 | 不同速度成员逐次就绪；真实命令双人一层，物品/时间/RNG守恒 |
| C：跨层与持久化 | 死亡/胜利、楼梯/留守/坑洞/幸存者恢复；成员图/codec/actor inputState、Worker/event/full/seek | 同一自然局save→load→续录→replay/seek零OOS，非主成员可独立行动；坏档拒绝保活局 |
| D：最小产品入口与验收 | 两人开局/焦点/明确执行者/留守选择；模块组合、物理删除、全量与报告 | 最终树门禁及最小浏览器闭环有实际结果；未验项明列，不以P1d为由缺失基础交互 |

不得并行改Game/TimeCoordinator/codec等共享文件。独立模块工作是否委派由后续维护者另行安排，本任务书不授权自动启动多代理。

### 3.3 待确认的单步执行细则（M1/M2）

P1a建议引入严格的 `party:actor-step` schema1输入：`expectedRevision`、`issuerSlot`、`actorId`、一个`ActorIntent`；回放保存稳定actorId与确认答案，不读焦点。仅接受本步支持的intent和明确声明的actor模块命令；未开放的计划、AI、网络字段直接拒绝。索引使用整局command index，不伪装窗口seq。引擎验证活动层、存活、控制权、ready/busy、物品根与目标资格后提交；错误映射合同§2的稳定PartyError，拒绝不分配实体ID/不消耗RNG/不推进索引。

调度停在**最早空闲人工成员需要输入的决策点**：有其他同tick成员就绪时先保留该边界，不替未输入者自动wait；界面焦点可查看任何人，但可行动提示只指当前合法决策者。新增受控槽同tick按稳定actorId领取；先完成既有到期原子效果/居民结算，再请求人工输入，保留经典和NPC原顺序。一个成员提交行动不保证整局立即走完整个该成员耗时；下一位就绪即暂停，已接受动作的余时/后摇保留。麻痹等强制状态照原生结算，不等待不可能的人工输入。禁止反复提交零耗时动作造成零tick无限循环；失败返回规划，不能内部自旋。这里是单步模型，人工缺计划自动wait（D-05）在P1b的窗口模型才适用。

确认/目标选择锁定发起actor、物品、world/command epoch和有效revision，切焦点不改已接受动作的归属。5Y的栅栏在接受前生效；已接受命令的确认/动画可继续，保存等待其完成，不能造成确认等flush、flush等确认的死锁。主成员死亡不使幸存成员无法推进或保存。

## 4 阶段5必须接入的执行链

以下约束不因P0词法命中较少而免验；定位和差量见重扫§8.3–8.4。

- **营地/容器/合成**：WorldItemRoots遍历活动及冻结成员库存、所有cached/fallen/container/escrow根，装备只是引用。WorldWork/StructureProduction/WorldMaterialTransfer/EdibleCommands/ResidentProduction全链用实际actor定位、验证库存戳/距离/工具/busy、收费；UI目标提示和提交者一致。订单actor与发令成员不同，不能把居民劳动耗时收给发令成员，或让成员抢居民生产票据。
- **居民身份**：若M3选择后置互转，本步仍须拒绝把resident/raid actor/多格body/临时召唤直接编入；原生居民继续工作、吃粮、离营。若批准互转，本步交付同ID原子交接、来源一次消费、床位/岗位/票据/预留/日粮退出与重新建立，失败完整回滚。不能clone成第二个Player。
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
| A12 零影响/删除 | classic及全部无party已安装组合；party-only及软联动；物理删除party和每个旧可选模块 | 5Z配对对象图/消息/确认/RNG/规范化save/replay字节精确；固定时间处理savedAt，不能删除新字段比较；有效party档删包后明确拒绝 |
| A13 最小UI/预算 | 桌面键鼠与320/390模拟触屏，两人自然闭环、四人切换/确认；动画开关；保存与Worker等待 | 可识别实际执行者，所有文案i18n；focus零规则副作用；记录主线程投影/编码/发布、Worker计算/flush及1/2/4人内存/体积，真机未测明列 |

性能按[P0报告§6.1](party-p0.report.md#61-p1-落地后的测量方法)记录环境/配对样本/分位/完整边界长尾；P1a测单步与成员图，窗口/AI预算不冒称通过。控制状态64KiB、额外三成员实体/库存256KiB、full摘要增量预算仍是提案，是否转为阻断门槛由M5冻结；不得通过少算成员、缩小写集或摘要字段“优化达标”。

## 6 门禁与运行纪律

本步改变时间/RNG路径、存档录像，按 [development §4](../development.md#4-门禁分档) **全量档**，不能按“接口调整”降档。新测试登记 `scripts/test-suites.json` 唯一归属；运行全部读源码守卫、U03、UR2/UR3/UR4、录像/续录/seek、战斗中性与slaying对等、扩展checkpoint完整图回滚、新增party专项及5D/5E/5G/5Y受影响原回归。

实施时资源纪律：Node24.19.0前置PATH，`NODE_OPTIONS=--max-old-space-size=3072`；所有Vitest `--maxWorkers=1 --no-file-parallelism`，重门禁串行。**BrogueJS-p5的指挥测试仍在运行时，不触碰其目录，不同时启动本步大批测试**；开发只运行必要少量定向整文件。以下是未来P1a最终候选必须排队执行的门禁，不是本次文档任务已经执行或可立即启动的指令：

```bash
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
npm run ce:fetch
npx vue-tsc -b
npm run build
npm run check:modules
npm run test:full -- --maxWorkers=1 --no-file-parallelism
BROGUE_REQUIRE_CE=1 npm run test:gen -- --maxWorkers=1 --no-file-parallelism
npm run test:drift -- --maxWorkers=1 --no-file-parallelism
npm run test:ext -- --maxWorkers=1 --no-file-parallelism
```

`test:full`由现有runner运行常规test集合并强制CE，不再为同一最终树额外跑一份同集合npm test；开发日常仍按AGENTS的npm test+drift。本步不沿用5Z的阶段性完整exit1作为最终通过。每命令独立留exit/计数/耗时/首次失败；少量串行复核通过不能改写完整批次exit1。完整门禁前后确认生产身份未变；发生改动按影响范围及development复跑规则处理。

组合/删除计划（M5确认覆盖成本，不暗继承5Z豁免）：正常树现有七模块128子集均在party off/on跑真实引擎路径，共256配置；各模块缺失时动态发现、不硬编码安装成功。物理布局至少“单删party、逐个单删旧七模块、只留party、全删”，每个唯一布局先boundary/types/build/全部剩余ext，再跑剩余模块全关/全开（party保留时分别party off/on，去重），真实缺包save/replay拒绝；所有其余删除子集未验须明列。用当前候选复制到仓外临时目录进行真删除，不在主工作树或BrogueJS-p5删包。扩展现有检查脚本前先核对发现机制；不能只写disabled标志冒充删除。

守卫失败先改实现；旧前提依赖已修行为时先只回退本次生产文件做单变量反事实，原测试应通过，再只改前提、保持断言语义。生成/黄金变化先单变量归因，用原捕获方式重录，按[testing §3](../testing.md)逐字段登记。禁止加skip、改门限、改守卫白名单来逃避成员覆盖。

## 7 共享文件清单与报告交付

按消费者分组，不是允许任意重写的白名单；精确文件/符号在实施A段冻结。新模块不能直接import其它可选包源码。

| 归属 | 预计共享文件/路径 | 必须同步 |
|---|---|---|
| 主控/时间 | `src/engine/Core/Game.ts`、`TimeCoordinator.ts`、`ActorActionAuthority.ts`、`ActorActionScope.ts`、`ActorActionProduction.ts`、`ActorActionScheduler.ts`、`PhasedAttackProduction.ts` | actor授权、prelude/恢复、确认、唯一计时、居民与袭击冻结 |
| 实体/战斗/感知 | `src/entities/{Player,Creature,Monster}.ts`；`src/engine/Combat/{Combat,ActorCombatResolution,MonsterAI,MonsterBlink,MonsterTheft}.ts`；`src/engine/Map/{SafetyMap,Scent}.ts`；`src/engine/Lighting/FOV.ts`；UI感知工具 | 能力口/双解算器/目标集合/空间缓存；禁止遗漏法术/物品协调消费者 |
| 层与物品 | `src/engine/Movement/{CreatureSpatial,CreaturePlacement,PlayerTravel,LevelTravel}.ts`；`Core/{GenerationCoordinator,LevelState,WorldItemRoots,WorldWork,WorldMaterialTransfer,WorldRestProduction,StructureProduction,EdibleCommands,EdibleEffects,ActorNeeds,ActorDeparture}.ts`；`Map/StructureWorld.ts` | 活动/冻结归属，唯一库存与预留，需求互斥，离层动作，完整写集 |
| 居民/经济/袭击 | `Core/{ResidentProduction,ResidentWorld,ResidentNeeds,ResidentJobs,ResidentPathing,ResidentOrders,ResidentOrderEconomy,ResidentValidation,WorldSettlement,SettlementRaids}.ts` | actor上下文、home经济时钟、escrow、下周期交付、excludedTicks、事件身份 |
| 格式/异步 | `Core/{EntitySnapshot,WholeRunSnapshot,RecordingFormat,RecordingV4,RecordingDigest,RecordingCheckpoint,RecordingCheckpoint.worker,RecordingBackend,RecordingStorage}.ts`；`src/ext/{descriptor,types,runtime,recordingRevisions}.ts` | 有效codec、所有成员实体图/知识/party域、Worker完整身份与消费者栅栏 |
| 扩展接口/模块 | `src/ext/{runtime,types,actorQuery,world,world5}.ts`及新增party能力文件；growth/foraging/crafting/settlement/narrative/combat的实际命令/组件/view接线；新增`src/ext/modules/party/` | 冻结SDK审计、optional查询、奖励归属与模块删除，禁止隐式leader回退 |
| UI与登记 | `src/App.vue`、`components/{GameCanvas,Sidebar,InventoryOverlay,DetailPanel}.vue`、`src/ui/commands.ts`/`displayProjection.ts`/actor输入相关工具；`src/locales/`；`scripts/u03-state-contract.json`、`scripts/recording-digest-contract.json`、`scripts/test-suites.json`及必要组合/删除脚本 | actor inputState、焦点session、中文文案、源码守卫、域写入登记、测试发现 |

本清单路径含花括号分组表示法；实施时以 `rg --files` 确认实际文件，不根据旧架构文档猜格式。需超出范围时先说明因果与受影响合同，再作最小调整；不改阶段5既有报告来抹掉失败历史。

交付路径：`docs/ext/party-p1a.report.md`（实际范围/版本/决定落实/源码身份/门禁/失败与反事实/逐字段重录/遗留）、`docs/ext/party-p1a.review-findings.md`（如维护者安排审查）、`docs/ext/party-p1a.manual-checklist.md`（最小浏览器路径与真机待验）、同步已批准的 `party-contract.md` 差量。原始JSON/日志/录像/截图放 `/private/tmp/party-p1a/`，只提交小型汇总，>1MiB证据不进仓库。报告逐项回填A01–A13，未运行明确写not-run，不累计重叠通过数；不要只交“全部通过”。

未来实施提交/推送按届时维护者授权；本次文档任务的提交授权不自动等于开工、合main或发布授权。测试与推送分别执行。

## 8 单列：需维护者决定的事项

这些是5Z后仍未冻结的**补充执行口径**，不是重新审议D-01～D-17。可在本表回填选择与日期；实现者不得把“推荐”写成“已批准”。

| 编号 | 需要决定 | 推荐 / 影响 | 阻塞范围 |
|---|---|---|---|
| M1 | P1a的单步事件、同tick人工就绪规则和有效codec分配 | 采用§3.3单步actor事件；沿合同§6.3双有效身份，party分支候选F14/S7/R5/O3（开工按实际写集最终确认），非party保持13/6/4/2；party域独立，不把单步伪装成window。无需变world5根时不升其schema | A段格式/路由与调度；合同当前PartyInput仅列窗口/控制/选择，必须补入单步声明及拒旧规则 |
| M2 | P0§4尚属提案的交换费用、近梯定义、强制坠层和仅留守者存活时恢复 | 接受八邻接且不穿墙角；交换发起者付一个移动单位、收方不扣时、busy收方拒绝；楼梯Chebyshev≤1且可达；坠者进入新活动层其余冻结；仅留守者存活时零时间进入明确恢复选择，选中层按正常入层事务激活且其余仍冻结 | 交换、跨层、死亡/保存；都须显式事件记录，不能靠focus隐式决定 |
| M3 | P1a招募/居民互转做到哪一步 | 开局两人闭环优先，4人只提供合法开局配置/受控验收；俘虏/叙事/居民来源正式入口后置至P1d，P1a落实身份排他、保留同ID转换接口与拒绝守卫。若要求本步居民双向互转，扩大报告/验收含订单退款与日粮交接，不等待5D3 | 成员来源与营地身份转换范围；既有居民系统适配与A08不能后置 |
| M4 | P1a启用growth时参与XP及首访/鉴定奖励的最小口径 | 建议本步即冻结一个配置：实际攻击造成伤害或成功辅助影响该战斗者入参与集，死亡/离层不抹历史；按参与者等权、整数余数稳定actorId；首访/鉴定作为全队一次奖励池按该事实时活动存活成员分配。具体“辅助”事件白名单与总池取既有奖励定义，必须审后入指纹。P1d只调参数/扩体验 | growth联动验收；这是补充建议，不能称D-08已批准此权重，也不能用全给主角或禁用growth规避 |
| M5 | 开工窗口、冻结SDK新增能力方式、组合/删除范围及性能阻断指标 | 指挥完整测试释放资源后开工重门禁；优先新增party能力口保持九SDK；确认§6的256正常配置与10种唯一物理布局范围，若缩减需逐项书面留未验；P1a先报告单步/摘要/体积实测，P1b再冻结窗口交互指标，不复用5Y Node数字作为四人阈值 | 共享接口冻结与最终验收排程；不降低必须的full/强制gen/drift等全量门禁 |

决定后将本表回填，并把M1/M2/M4及任何SDK变化同步进合同；测试以批准后的合同为准。M3后置只减少新招募产品入口，不能减少非主成员使用现有营地/采食/合成、居民继续运作、袭击冻结和Worker持久化的验收。
