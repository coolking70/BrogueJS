# ext 深层性能架构可行性评估

日期：2026-10-15。评估树：`ext/camp-fix`，HEAD `a4a4f8c12f823916c8ebc4f3e295715a48ebe47f`（等于本次任务指定的 ext/foundation）。仅代码阅读、现有基准及临时只读探针；未改生产代码、测试、格式或门限，未 commit。

**建议先移植 main 的局部优化并建立 ext 深层基准，再做 A 的局部数据布局改造；B 按主线程响应目标立项；C 暂缓。** ext 额外成本包含跨楼层实体收集、事务写集捕获、扩展根摘要和显示 DTO，不能把 main 的光照收益直接套到整局，也不能用 WASM 掩盖重复全世界复制。B 可与 A 的后半段独立决策，不必等待完整数据导向重写；C 必须等待批量内核数据边界形成。

## 1. 证据、口径及当前缺口

### 1.1 读取的基线

- 本树 `AGENTS.md`、`docs/HANDOFF.md`、`docs/development.md`、`docs/architecture.md`；扩展性能、5Y、属性管线及测试政策报告。
- `git show origin/main:docs/perf-late-depth.report.md`，本次 `origin/main=c96f00b0334c444e8b0eadf6737544a09688857e`；`git show a595a4c` / `git show 9db964e` 的生产差量与基准脚本。报告正文保留历史“未提交”字样，实际两个提交对象均存在。
- party 仅作排期依赖阅读：`origin/ext/party-design=8bd271b4bc26dea697ca8af1257240d848f3665d` 的 `docs/ext/party-p1a.task.md`；loot 参考 `origin/ext/phase6-loot-core=93523fc596b173396a0d526ab2073b327ff7cf3e` 和设计分支。当前树没有 `src/ext/modules/loot/` 或 party 实现；已落地的是共享属性管线，后续 loot/P1 负载是预测，不能列作本树实测。

以下 `src/...:行` 均指本树 HEAD；main 数字标为“历史测量”，不冒充本次复测。热点排序是**优先验证顺序**，不是 ext D20+ CPU 百分比分解。

### 1.2 main 两轮已有证据

同一 v2 录像，seed `438491256`，17,737 条命令，动画推进开启、挂载视野准备回调，每条用 `replayStep(true)` 后排空 `tickAdvancement(1000)`。计时包含强制多回合、换层及回放校验，不含 Pixi/GPU/Vue DOM；按命令开始深度归组，含零回合命令。P95 用 nearest-rank，**这里的“每步”是命令，不是客观时间块**。

| 历史测量 | 结果 | 对 ext 的含义 |
| --- | --- | --- |
| 第一轮 CPU 采样，命令 13800–17737 | `hasCreatureAtForLight` self 49.8%；`updateVision` inclusive 63.2%；通用占位 self 4.0%；地形旗标 self 3.6% | 证实经典分支的重复占位查询；inclusive 重叠不可相加，不能把比例当 ext 比例 |
| 第一轮 `a595a4c` | D22 median 40.36→21.66 ms；D28 75.61→31.68 ms；D28 P95 135.29→65.87 ms；总命令时间 314.00→212.24 s | 单次光照批量缓存值得先移植；不是一次全面架构改造的成绩 |
| 第二轮 `9db964e` 独立基线/最终测量 | 总命令时间 193.41→67.82 s（−64.9%）；D22 P95 27.30→8.85 ms；D28 64.39→18.11 ms，复测 18.81 ms | 两轮采样环境有波动，不拼接成一个精确加速比；第二轮含多项引擎/显示优化 |
| 第二轮动态光照准备 | D28 dance median/P95 3.254/3.427→0.380/0.572 ms | CPU 准备结果，不等于手机 FPS 或 GPU 帧时间 |
| 两轮正确性 | 17,737 条零 OOS，32 个边界、最终 5,041,466 叶相等，只归一化 savedAt | 移植应保留同类对照方法，但必须换成 ext 同版本输入 |

D22 最多33怪、D28最多46怪；D28仅32命令，D26仅70命令，深层覆盖不足。第一轮出现37/42/45客观回合的一条命令和换层数百毫秒尖峰；这些不能为达标删去。

### 1.3 ext 已有历史测量

[`phase5y.report.md`](phase5y.report.md) §性能测量：Node24.19.0、3 GiB堆、受控D8八层结构布景（3072格/12288部件），每模式56个普通256边界、8个2048边界：

| 完整边界主线程占用 P95 | inline | 生产检查点 Worker |
| --- | ---: | ---: |
| classic / 256 | 57.341 ms | 11.094 ms |
| D8 / 256 | 383.519 ms | 71.567 ms |
| D8 / 2048 | 654.262 ms | 121.314 ms |

D8 Worker模式投影P95 35.428 ms、JSON/UTF-8编码35.338 ms；两chunk wire副本峰值53,043,056字节，饱和排空511.284 ms、抽样RSS约1.25 GB。证明**摘要已部分卸载，主线程投影/编码及内存仍有显著成本**。不是本次D20+测量，也不是所有设备上限。报告后续有维护者真实浏览器Worker补验，不应仅引用早期“浏览器未验”段落。

HANDOFF中的居民历史值为16人净增P95 3.672584 ms、64人需求结算峰值46.777167 ms；其场景和版本见 [`phase5d1.report.md`](phase5d1.report.md)，不能用它承诺深层所有模块全开仍≤5 ms。

### 1.4 本次只读验证

临时证据根：`/private/tmp/ext-perf-assessment-20261015/`，不入库。Node显式使用 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`（v24.19.0），避免 shell 默认v25.2.1混入比较。

`import-probe.mjs` 通过Vite SSR加载当前 `Game`，真实调用 `loadReplay()`。输入 `/private/tmp/mainperf/replay.json` SHA-256为 `da5becb23ff92f5878f1c33cfc2e9a515cdaf51e67781f9d362909f2041f8576`，v2/17,737事件；**返回false，提示“录像格式不受支持或已损坏。”** 无命令被回放。Vite初始化打印24678 WebSocket的EPERM，但SSR调用完成、进程退出0；不以该socket异常替代格式拒绝证据。结果见 `main-replay-import.json`。

原因在 `RecordingFormat.ts:39`：只接受recording4、wholeRun6、当前foundation、origin2，固定digestChunk256/checkpointPeriod2048；`Game.ts:4524 loadReplay` 还验证开局完整摘要。禁止仅改版本号或删检查点来“兼容”。

本次营地/居民现有计时测试结果见本文末尾“测量收尾”。未取得 ext D20+正式录像、CPU profile、GC或手机测量；下文的预算和收益区间均明确是建议/估算。

## 2. 深层每回合最可能的热路径

记 `N=W×H=79×29=2291`，`M`为当前层怪物数，`F`为其总占格数，`I`为地面物品数，`L`为光源数，`Q`为所有投射/通行查询数，`E`为所有已访问层可达实体数，`S`为相关扩展状态字节量，`W_all`为完整世界投影大小，`K`为一次输入实际推进的时间片/客观块数。`F`包含肢体，不能只数core。复杂度是代码上界或量级，常数和命中率仍须profile。

| 优先级/场景 | 来源及频率 | 复杂度与证据 |
| --- | --- | --- |
| 1：多怪、多光源的连续普通行动 | 视野/光照及每50ms dance | `Game.ts:3290 hasCreatureAtForLight`仍`.some(footprintContains)`；`:3312 updateVision`逐源`paintLight`，`:3389`视野/记忆发布；`LightMap.ts:93`每次新LightMap。占位最坏O(QF)，另O(N+Σr²)清图、mask分配/泼光；一命令可能多次刷新，显示帧额外重复。main有直接采样证据，ext沿用相同未优化路径且多格更贵 |
| 2：扩展全开、战斗密集或已访问层多 | 扩展结算、事务写集和可达图收集 | `Game.ts:3596 collectExtensionComponents`遍历缓存层/坠落队列并收集实体；`runtime.ts:1263 settle`条件成立时进`:1015 transaction`，复制states/components/world/causality等，再排序已绑定角色、发布hook；`:1715 collectComponents`扫描根。约O(E+S)，排序O(E log E)，重复hook可放大。`Game.ts:502 checkpointCombatFactWorld`、`:13941 checkpointResidentWorld`还可捕获多层写集；`WorldCheckpoint.ts:18`按对象图捕获属性/容器。**可能超过光照，尚无深层占比证据** |
| 3：移动、游荡、追击、逃跑、巨兽/肢体接触 | 占位×AI/路径、身体合法性和动作调度 | `Game.ts:13511 getMonsterAt`仍线性find，含ignore与DYING；`CreatureSpatial.ts:177–209`脚印/最近接触，后者O(f_a f_b)。普通A*使用堆但字符串key，约O(N log N+QF)；`Monster.ts:2514`已有单次通行缓存。`Pathfinding.ts:102`Dijkstra排序链表重插最坏O(N²)，不是所有寻路都已是堆。`FootprintPathing.ts:50`已用Uint8/Float64缓冲、最多8组缓存；`CreatureSpatial.ts:311`也已有派生索引，但通用Game查询没有全部走它。须区分命中/重建/动态重规划 |
| 4：环境活跃/麻痹/慢速多回合 | 气体、火、晋升、DF、环路/安全图 | `TimeCoordinator.ts:261,362`客观块；`Gas.ts:updateGases`每轮全图邻域、`Promotion.ts:runPromotionUpdate`两趟、`DungeonFeature.ts:fillSpawnMap`、`LoopMap.ts:analyzeLoopMap`。常规O(KN)，拓扑/递归DF/寻路另算；每格四层旗标还经过`CellProperties.ts:49–72`原生+结构组合。不能删一次环境块或改随机舍入次序 |
| 5：每条录制/回放命令，256/2048尖峰可跃为第一 | event摘要、full摘要、快照与序列化/GC | `Game.ts:3613 recordingEventDigest`→`RecordingDigest.ts:184 dirtyEventDigest`有域/叶修订缓存；命中不是全量hash。扩展域失效时仍调用runtime.snapshot克隆**整个扩展根**；world5按叶/层缓存。每256命令完整投影与独立full oracle，2048另有快照；O(W_all)及canonical键排序，代价随访问层数增加。`Game.ts:3726 enqueueRecordingCheckpoint`仍主线程投影/编码。`RecordingBackend.ts`已有最多两job，Node默认无Worker，真实录制与回放必须分别测 |
| 6：营地/居民/订单/袭击边界 | 前台任务选择/路径、需求批结算、离层经济补算 | `ResidentNeeds.ts:41`提前检查后事务结算；`ResidentWorld.ts:210`复用嵌套事务；`ResidentPathing.ts:18`最多32目标图，命中仍扫描永久阻挡怪。典型O(R×任务候选+缓存未命中路径+状态捕获)，周期事件排序/生产交接另算；长跳按实际结算批次，不应直接O(离线ticks)循环。world5时钟本身`world5.ts:188`是O(1)；`:196 indexWorldLevels`find+排序在索引更新时，**不是每回合模拟所有楼层**。16/64人测试是边界证据，非深层负载排名证据 |
| 7：属性来源多、预览/伤害查询多 | 已有StatPipeline，未来loot将增来源 | `StatPipeline.ts:203`结果/来源/校验签名缓存；`:262 rows`构造JSON stamp，失效后收集、过滤、校验；`evaluateStat`排序来源并用BigInt有理数。粗略每个miss O(B log B+条件/依赖求值)，hit仍有key/上下文成本。`runtime.ts:1297 invoke`有写入时会清缓存并遍历角色校验/物化；Game.updateVision还markStatsDirty。当前不可将“loot掉落生成”算作已有热路径；phase6应测miss比例而非禁用校验 |
| 8：动画/自动行动/打开扩展面板 | 显示投影、JSON比较、freeze、Vue刷新、Pixi提交 | `displayProjection.ts:48 observeDisplayMap`全图两遍、建物品索引、每格JSON.stringify比较、身体/标记投影；`:132 observeDisplayFrame`复制日志及模块公开态。约O(N+I+F+日志+公开态)，乘每命令捕获帧数。`presentationTimeline.ts:86`只限制可选细节128帧，必要消息仍保留。`useModuleUi.ts:20 refresh`和各useSession读DTO；settlement使用shallowRef，`Game.ts:15418`是普通new Game，**不是整个世界深响应式**。CPU分配/DOM/GPU三项须分测 |

另外两种长尾必须单列：新层生成/缓存层恢复（生成、全图连通检查、扩展事务和校验），以及保存/导出/导入/seek（全历史/世界复制与校验）。普通实时记录不是每步复制整份录像；当前看不到普通输入O(命令历史²)的证据。全世界实体收集、变化扩展根的snapshot和周期full则确实可能随局长增长。

“快照/校验”需拆开：`runtime.validateSnapshot`主要在构造/载入；`loaded()`用前后canonical验证只读回调；不应笼统称每hook都完整validateSnapshot。每步较值得测的是结算事务克隆、来源校验、增量摘要失效、原生事实的写集捕获。减少这些成本必须保留失败原子性和完整full oracle，不能靠关校验达标。

## 3. 方案A：数据导向布局与有界复用

### 3.1 可行边界及布局

建议先做**派生热缓冲**，再决定是否替换Cell事实存储。现有FootprintPathing和气体临时量已部分使用TypedArray，“全部从零改成TypedArray”不准确。地图只有2291格，收益主要来自去重复工作、避免对象分配/Proxy和提高批量访问效率；TypedArray本身不会自动解决O(QF)、事务克隆或跨世界hash。

建议内核统一 `index=y*width+x`，用适配函数连接现有大量 `x*height+y` 缓冲；**存储次序变化不等于允许改变x/y/layer遍历与RNG/平局次序**。

| 数据 | 建议表示 | 合同/限制 |
| --- | --- | --- |
| 四层地形及记忆地形 | 每层Uint16Array（先验证枚举范围），cold字段保对象 | Cell facade稳定身份，不能每次getCell新建包装；现存直接layers写入必须纳入写入口/观察器，不能保两份可变真值 |
| 原生/组合flags、opaque/passable/FOV/shadow | Int32/Uint32位集、Uint8掩码 | flags保持JS位运算符号语义；结构门/顶/墙、秘密门、气体、同回合DF、目录覆盖都要触发更新；记忆只读已知组合值，禁止泄露实时结构 |
| RGB与临时光图 | 先Float64平铺三通道，证明范围后再考虑Int32；scratch分层复用 | 黑暗光可负，不用Uint8累加；显示光/确定性光/flare知识临时图相互隔离，保原截断和叠加顺序 |
| 占位 | cell→槽位链/CSR桶，实体表保JS引用；active/reserved/death-contact分表或过滤 | 不能只存一个monster ID；保列表首匹配、ignore、DYING窗口、召唤/休眠即时语义和所有脚印格；持久entity ID可能超32位，缓冲存slot，不能截断ID |
| FOV/路径 | Uint8 blocked/visited，Int32 parent/next/prev，Float64或经范围证明的距离 | 先保持原Dijkstra队列及A*平局规则；换算法是另一项语义差分。多形状/区域/能力policy与地形revision进入key；动态占位不混入共享静态图 |
| 临时对象 | 有界mask/路径节点/DTO构建scratch池，generation/递归层各租独立缓冲 | 不池化活Creature/Item/历史DisplayFrame；池归还必须在所有读者结束后。失败回滚、嵌套DF、seek/newGame、异步job不能共享被覆盖的buffer |

世界simulationTicks及ID仍保safe integer；StatPipeline有理数仍保BigInt/明确舍入，不为了“统一32位”截断。每层基础新增缓冲按约40–64 bytes/格估计约90–143 KiB，28层约2.45–3.92 MiB；这只是拟议热数组，不含旧对象双存、mask缓存、实体和摘要副本，不能作为整局内存预测。

### 3.2 影响面、格式和API

| 面 | 文件/API | 是否改变存档/录像 |
| --- | --- | --- |
| 格子与写入口 | `Map/Grid.ts` Cell/layers/getCell/setTerrainLayer、`CellProperties.ts`结构WeakMap及observer、`Movement/SpatialRevision.ts`、`StructureWorld.ts` | 只改派生缓冲可不变；事实层改造须由LevelSnapshot显式转回原JSON字段/顺序，不可直接JSON.stringify TypedArray |
| 热消费者 | `Lighting/FOV.ts`、`LightMap.ts`、`Map/{Pathfind,PathFrontier,Pathfinding,FootprintPathing,LoopMap,DungeonFeature,Promotion}.ts`、`Environment/Gas.ts`、`ResidentPathing.ts` | 输出逐格/逐路径相等时无需升级；缓存不入机械摘要 |
| 实体/身体 | `Core/MonsterLifecycle.ts`、`Movement/CreatureSpatial.ts`、`entities/Monster.ts`、Game查询/出生/死亡/转换 | 保实体对象身份与所有权；索引是派生状态，载入/回滚重建或恢复；不可把临时slot写入持久ID |
| 事务与codec | `WorldCheckpoint.ts`、`GenerationCoordinator.ts`、Game各checkpoint、`LevelSnapshot.ts`、`WholeRunSnapshot.ts`、`EntitySnapshot.ts` | WorldCheckpoint已有TypedArray字节捕获，但WeakMap状态另恢复；相同buffer多视图、池复用、大小变化须专项测。新Game字段登记U03；图外机械根同样不能漏持久化 |
| 摘要/显示 | `RecordingDigest.ts` / `WorldCanonical.ts`、`displayProjection.ts`、`GameCanvas.vue` | 推荐维持v4事件及full逐域相等；若明确改变codec/可观察数值，独立升级并重录，不混在性能补丁中；不做旧档迁移 |

### 3.3 分步及收益估计

1. **A0（含main移植）**：批量脚印占位、光图复用、整数路径key、物品索引、按需GPU提交；先保证ext回滚/结构语义。按光照主导场景估计局部2–8倍、整命令减少20–60%；扩展事务主导场景可能只有0–15%。main历史64.9%只能支持方向，不能保证区间下限。
2. **A1**：统一派生mask/flags/占位缓冲、路径scratch池，保Cell事实/外部API；失效覆盖完整后再以revision代替逐格校验。相对A0估计这些内核快1.2–2倍，整命令再降5–20%，分配明显下降但GC效果待测。
3. **A2**：有profile证据再将Cell热字段/光图/距离图事实平铺，冷文本、Item、Creature继续对象；每一域保持codec和回滚差分。相对A1整命令预计0–15%额外收益，热数据内存可能少30–60%，不代表整局RSS。通过旧Cell facade逐格访问仍有包装成本，应让热循环直接用批量视图。
4. 与A独立的小步：对事务写集/属性来源/摘要失效做计数，按实际写域减少重复捕获、重复清cache；保完整oracle和异常注入验证。若这些占大头，优先级高于A2。

以上区间不能相加；优化收益服从原热点占比。终止条件：在固定基准上收益低于5%且增加持久化/回滚复杂度时停止该小步。风险最高的是隐藏的直接写入、同回合变更、回滚恢复旧revision、池对象逃逸与遍历顺序改变；不是TypedArray语法本身。

## 4. 方案B：模拟迁入Web Worker

### 4.1 现状与拆分边界

当前5Y只把**冻结世界的full/hash计算**交给 `RecordingCheckpoint.worker.ts`；`Game`、模拟、结算/event摘要、投影和UTF-8编码仍在主线程。`InlineRecordingBackend.enqueue()`里的Promise不会使计算异步卸载。不能把“已有Worker”写成“模拟已脱离Vue”。

建议一局只有一个模拟权威Worker。Worker拥有Game、实体/世界、双RNG、TimeCoordinator、模块registry/runtime、属性/空间服务、日志事实、录制/回放及命令generator。主线程拥有Vue/Pixi、DOM/输入设备、镜头、菜单草稿、文件选择/下载、存储适配和呈现队列，接收经过知识过滤的公开DTO。

现有 `observeDisplayFrame` 是起点，尚不是完整Worker接口：它依赖 `targetingState`、Game实例和模块公开投影；`ModuleUiHost.game()`、settlement的native库存读取、App的直接inspect/UI状态、Inventory/Target/Replay组件都须改为facade查询/intent。以模块逐个梳理，不能把Game class、函数、Proxy、WeakMap或能力scope发过去。`readModuleView`里的session对象身份改为显式generation/revision，definitions按manifest一次发布/主线程本地静态装载，不每帧重发。

规则涉及的FOV/知识/flare采样留Worker；纯显示随机与闪烁明确唯一所有者。第一版可在Worker产生最终公开色值/动画帧，保50ms采样顺序、积压门控和必需消息；主线程只绘制。后续若改为主线程闪烁，只传已经过滤的显示参数和独立装饰种子，不发未发现地图/敌人，也不让屏幕帧率改变实质RNG。

### 4.2 建议消息协议（提案，不是现有SDK）

公共信封：`{ protocol, generation, requestId, commandSeq, baseRevision, type, payload }`。生命周期generation、机械revision、呈现frameSeq分开，确认/ACK不靠当前焦点猜执行者。

| 方向/消息 | 内容和语义 |
| --- | --- |
| 主→模拟：Init/NewRun/Load/ReplayLoad/Seek | seed、mode、manifest/config及原文件字节；校验成功后切generation，失败保原活局；回包含codec/manifest身份 |
| 主→模拟：Command/ItemCommand | 原公开命令和数据，未来含已冻结actorId；Worker校验权限/expectedRevision，经executeCommand或executeItemCommand恰执行一次，不以消息重试再次收费 |
| 模拟→主：Accepted/Rejected/Settled | requestId、seq、输入锁/下一边界、稳定错误码；只一个机械命令在途；自动步进由明确调度所有者串行发起 |
| 模拟→主：Confirm；主→模拟：ConfirmResult | confirmId、commandSeq、generation、actorId、公开提示/风险、boolean答案；generator停在Worker，主线程不持continuation；恢复前沿现有CAS重验。取消/陈旧回复拒绝，禁止自动“Yes” |
| 模拟→主：DisplayFull/DisplayDelta/Interaction/Log | frameSeq、baseFrameSeq、地图/身体/telegraph/模块公开态/对话/输入门控；首包或缺基线请求full；可合并闲置地图帧，但必须消息、伤害次序、ACK和确认帧不丢 |
| 主→模拟：AckPresentation/Query | 呈现收尾/消息确认、只读检视/合法目标/换装预览；答复带revision，UI丢弃过期结果；改变状态的选择仍走Command，不藏在Query里 |
| 主→模拟：Save/Export/Flush；模拟→主：Bytes/Progress/Failure | 冻结安全前缀、等当前推进/确认及5Y校验完成；主线程只负责Blob/下载/IDB落盘。不得导出尚未验证的录像链 |

用有界缓冲和transfer发送**job/frame专属副本**；权威世界buffer不detach。第一版不采用SharedArrayBuffer，避免共享读写、版本屏障和部署隔离要求扩大范围。地图约2291格，先测完整DTO vs差分成本：每帧序列化大量对象可能比发一个紧凑全图更慢。UI草稿只在相关revision改变时刷新，保原面板选中态与陈旧提交保护。

### 4.3 确定性、录像和收益

- 模拟仍单线程串行，消息到达时间不得影响规则。不把多个怪物分到多个Worker；不按墙钟预算少算回合，不改变同tick原次序。UI焦点/窗口大小/网络抖动不能进入实质RNG或摘要。
- 回放在Worker内执行相同命令与原decisions；旧generation的回包隔离，seek/newGame取消未完成持久化。拒绝/OOS不得被“Worker重启成功”掩盖。确认期间不能序列化generator，保存等待安全边界，沿5Y/party合同。
- 若只改执行位置且边界相同，recording4/wholeRun6无需升级，要求inline与Worker同切点event/full/chain/双流/存档相等。party新的actor输入与有效codec独立处理，不能借B偷偷加格式字段。
- 现有摘要Worker可作为第二计算worker继续使用，但须显式验证worker内构造/后端选择；`defaultRecordingBackend`依赖`window`，迁入模拟Worker后默认会变成null，不能无声回退为同步。建议先保5Y传输/完整性/两chunk语义，比较独立摘要worker与模拟worker内串行计算；主线程已流畅后，后者也可能更省内存。
- B目标是**主线程响应**，不承诺总CPU减少。估计把原模拟阻塞的70–95%移离主线程，但新增DTO/复制/查询延迟；总CPU可能增加0–30%，动作完成时间可能略变慢，换层/确认仍需等待。取决于投影大小和设备线程数，均须实机验证。

工作量约20–35人日、10–18个完整Codex实现/验证轮次：先host facade和纯投影5–8日，协议/命令/确认5–8日，持久化/回放/取消4–7日，全部扩展UI/浏览器与压力验收6–12日。不是加一个worker入口的1–2日工作；七模块删除和匿名全局服务（rng/logger/time/ItemLoader）所有权也须审计。

## 5. 方案C：WASM热内核

### 5.1 必须先满足A的条件

不是要求A2全部完成，而是候选内核已经有：①连续输入/输出缓冲及唯一所有者；②批量blocked/footprint/cost数据，内循环零JS回调；③无Game/DOM/模块能力/RNG依赖；④可独立逐格/逐路径对照的JS参照；⑤同回合更新/回滚失效合同。若每个格子仍跨边界调用 `getCell` / `nativeStat` / `getMonsterAt`，WASM只会包住昂贵边界；若大头仍是快照/JSON/事务，WASM FOV不解决主要瓶颈。

仅在A0/A1之后profile显示候选内核仍占≥25% CPU或设备预算持续失败时做原型。FOV/光照可同一批调用；Dijkstra接受cost/blocked并输出distance/next；占位适合在JS先建平铺索引，单独跨WASM做一次O(1)查询通常无意义。

### 5.2 语言选择

| 选择 | 本项目收益/代价 | 建议 |
| --- | --- | --- |
| Rust | 便于把slice/索引/有界内存封成独立纯内核；需要新增Cargo工具链、编译产物管理及JS ABI测试 | 如正式立项首选；小导出C式ABI/ptr+len即可，不把整个引擎映射成复杂绑定对象 |
| AssemblyScript | TypeScript风格，团队阅读成本较低；仍非直接编译现有TS，Game/Vue/BigInt管线/动态对象不能原样搬；新增运行时与内存管理选择 | 仅在维护者明确只维护TS风格工具链时选；不能以“改后缀即可”估工 |
| C | 接近CE内核表达，适合独立纯整数函数；手工内存/ABI、未定义行为/溢出、Emscripten或clang构建均增测试面 | 有C维护者且能抽出小内核时可选；不直接搬整个CE状态机，它与ext结构/身体合同不同 |

这是基于项目边界的设计判断，本次未安装/比较这些工具链或宣称某语言的实测速度。

### 5.3 线性内存、确定性和成本

持久WASM memory里划分input flags/cost/source与output mask/RGB/distance/scratch；JS用TypedArray视图批量填入，一次导出调用处理整层或整批灯。若A数组仍在JS buffer，每次至少O(N+L+F)复制输入+O(N)输出；2291格的小图上搬运、适配和维护成本可能吃掉内核收益。优选共享同一WASM buffer的受控视图或仅同步dirty范围；memory.grow后重取所有view，绝不让持久快照或异步显示持有会失效/被覆盖的视图。

确定性不能只写“改成整数”：

- 光照保有符号累加和固定点比例、截断时点。当前 `LightMap.ts:17`及paintLight使用 `Math.round(Math.sqrt(d²)*65536)`近似；可以先预计算与当前JS逐项相同的整数表，不能换成CE另一sqrt算法却声称零行为变化。
- FOV阴影斜率比较、圆边界、对角遮挡和Dijkstra平局须逐格/逐路径精确；把斜率换成整数有理比较要证明乘积不溢出，必要用64位中间数。A*已有sqrt(2)代价不能直接截整数。
- 不启用改变结果的浮点快捷优化；明确i32/u32/i64的边界、负数、截断与哨兵。不得把world时钟、持久ID或StatPipeline的BigInt有理数塞入32位。
- 保JS参照和运行回退，WASM初始化失败明确选择参照；运行完整性差异必须报错，不能静默用另一结果掩盖。RNG仍由模拟所有者按旧序管理，首批内核不拥有RNG。

验证包括随机/穷举小图、边界/负光/重叠灯/结构门/巨兽占位、同回合失效、失败回滚、完整录像零OOS；Node、桌面浏览器、移动浏览器分别跑。构建需锁工具链、可复现wasm产物、Vite URL/加载路径、CI缓存/发布和JS回退测试。本次不引入依赖。

原型一个内核5–8人日/3–5轮；四内核生产化累计15–30人日/8–16轮（前置A、B不含在内）。估计已平铺的纯内核快1.2–3倍，整命令0–20%额外收益；若候选占25%、内核快2倍，整体仅约1.14倍，需以这类占比计算立项价值。

## 6. 深层性能预算门禁

### 6.1 基准来源与重录流程

main录像在本树已真实拒绝，不能作为ext正式输入。也不能把main动作列表喂ext后继续拿旧结果比较。建议新建以下**同版本自然录像+独立受控压力场景**，两者分开报告：

1. classic模式在ext树生成D1→D28长录像，作为移植优化的最小干扰对照；固定seed/mode、源SHA/manifest、Node/浏览器版本。可参考main路线重新游玩，但所有事件/检查点由当前引擎产生。
2. extended七模块全开，用当前真实开局/初始化命令，经过D20/D22/D25/D28，每个目标深度至少500个已结算行动、至少3个种子；覆盖≥40活跃怪物、多发光地形/燃烧、巨兽多格/断肢、气体、地形晋升。无法自然达到的组合另列受控压力场景，不伪装自然覆盖。
3. 加营地16居民（种植/搬运/守卫实际正活动）、四营64人需求长跳、跨层缓存/结构满预算、255/256/257与2047/2048/2049、长麻痹/换层/确认/ACK/保存续录。phase6加入loot多词缀/换装预览/掉落；P1加入1/2/4人共享感知/不同速度，同一simulation clock。
4. 录制用 `executeCommand` / `executeItemCommand` 或真实UI；动画路径逐次排空，保真实确认决策。不得直接设置depth、关校验、给世界补字段来制造“自然录像”。如用wizard模式须注明，压力fixture可以由现有harness建，但不计入自然可玩证据。
5. 安全边界调用 `exportRecordingAsync()`（无后端时对应同步入口也需已settled），再从开局 `loadReplay` 完整重放零OOS；定点save/load/seek/续录后核对双流、event/full/chain及规范化最终世界。冻结JSON SHA/源SHA/manifest。格式或规则确实变化时按原捕获方式重录、逐字段归因；保旧数据，不通过删慢命令换基准。

录像原始大文件留仓外固定制品存储，库内只放小manifest、生成/捕获方法、哈希和汇总；`/private/tmp`只适合本次证据，不是CI长期唯一来源。自然路线采集若未完成，门禁必须报告“缺基准”，不能0样本通过。

### 6.2 指标与统计

- **命令延迟**：接纳→结算、纯模拟CPU、摘要/投影、主线程忙时间、显示到达分别记录；逐深度P50/P95/max，保全命令分布（含零回合/换层/多回合/检查点），再分组解释。
- **每回合**：记录absoluteTurnNumber、玩家动作数、simulationTicks增量与实际客观块数；以后在TimeCoordinator原边界加只读计时，得到真正逐回合P95/max。`命令ms÷回合数`只作吞吐均值，不能声称回合P95，也不能用它掩盖单条长阻塞。
- **CPU工作量**：光照blocker查询数/投射数、路径visitedNodes/重建/命中、runtime快照次数与字节、事务捕获对象/字节、StatPipeline hits/misses、dirty/full域重算、显示捕获帧数。稳定计数断言优先于共享CI绝对毫秒。
- **GC/内存**：Node `PerformanceObserver` GC条目或独立`--trace-gc`采样，记录minor/major次数、总暂停、P95/max、heap/RSS/arrayBuffers峰值；注明GC观测是进程/线程口径，Worker另记。主机GC/trace和CPU profile单独跑，不混作正式wall-time样本。不在每回合强制gc；可另作末尾强制gc的存活内存诊断。浏览器记Long Task、主线程帧/P95及可用内存指标，不把Node GC当手机GC。
- 非计时预热后，固定全输入正式连续运行3次，同机串行、无本任务并行测试；保冷启动/首层单列。main原录像门禁保持全序列，不移除开局命令；内核微基准可明确预热。每次所有原始max和失败运行留存；重复测试不能只挑最快一轮。

### 6.3 阈值建议（待校准，不宣称当前已达标）

| 指标 | 初始建议 | 判定说明 |
| --- | --- | --- |
| ext树classic，D20–D28全命令P95 | 20 ms目标 | 沿main20ms方向，新录像更长/格式更重，先校准；256/2048亦计入总分布并单列 |
| 七模块extended，普通客观回合P95/max | 30 ms / 100 ms目标；全命令逐深度P95目标40 ms | 作为A0/A1验收目标草案；须在真正逐回合计时与≥500行动样本后冻结，不能由main推定通过 |
| 已有营地/居民增量 | 保原≤5 ms净增P95；64人长跳峰值≤50 ms | 原测试/场景不变，单列当前失败与历史值；不把净增当总耗时 |
| 256/2048完整边界主线程P95 | 受控D8先沿≤100 / ≤150 ms目标；D20+另以固定大小场景校准 | 历史71.567/121.314支持初值；远期B目标主线程每次消息处理P95≤8 ms，不能现在要求整个世界投影≤8 ms |
| 换层 / 单命令强制多回合max | 1 s / 2 s预警，另保同输入相对回归线 | 暂不以一个跨设备绝对max杀掉正确性构建；未达标保红色性能报告，不能裁剪回合 |
| GC | 暂停总量≤计时窗口5%，P95≤5 ms、max≤20 ms预警 | 尚无本树基线，先观测；长局末尾存活内存及arrayBuffers不持续爬升。内存按实体/访问层/保留录像规模解释 |
| 任意稳定场景回归 | P95不超过冻结基线10%，max不超过25%（至少1 ms噪声带） | 专用runner三次中至少两次超过则失败；单次max超限仍记录诊断，不能删离群点。新增语义/规模须单独审批新基线 |
| 正确性/资源界限 | 零OOS/双流一致/full独立oracle一致；摘要待决≤2；池/缓存有界 | 硬门禁，不因时限压力放宽，不降低256/2048验证频率来过性能 |

主线程16.7ms只是60Hz帧预算，不等于必须让每个游戏回合16.7ms完成。B的价值是在模拟仍需30ms时界面继续响应；自动动作吞吐、输入到显示延迟仍需独立达标。

### 6.4 接入方式及仓库政策差异

建议新增独立 `perf:late` runner及小manifest（**本次不实现**），复用main三个脚本的计时/逐字段比较思想，适配v4/异步flush及ext场景；主机绝对性能门禁放专用安静runner，PR常规测试只加稳定工作量/缓存失效合同。现有 `scripts/test-suites.json` 及各模块manifest是归属入口；模块计时测试留模块自有目录，不复制成未登记孤立测试。

本树实际 `package.json` / `run-test-suite.mjs`只有test/ext/drift；`phase5-test-policy.report.md`记录2026-10-13删除ce:fetch/test:full/test:gen及CE外部依赖，原gen已并入test。**这与本次用户给出的AGENTS及development全量档命令有差异**，不能写一组当前不存在的npm脚本并声称可执行。本次是只读评估，无须改政策或跑全量；后续实施任务需维护者统一入口，推荐保用户要求的验收强度、明确可执行的对应矩阵，不把历史报告当作自行降低当前指令的许可。

当前可执行的基线组合为check:modules、vue-tsc、build、npm test、test:ext、test:drift；重门禁串行，Node24/3GiB/单worker。移植/A/B涉及的U03、对象图回滚、录像、显示RNG、结构/身体/居民/属性差分及源码守卫必须覆盖；B增加真实浏览器Worker/确认/取消/导出；扩展合并发布沿适用政策做组合/物理删除与完整兜底。守卫失败改实现，确因旧前提失效按用户给定单变量反事实程序处理，不削断言。

## 7. main两轮移植的冲突面与建议顺序

以下是静态语义冲突评估，**未执行cherry-pick、merge或git apply**，不声称这些是Git实际报出的冲突行。相对`a595a4c^`，本树Game差量约4803增/846删、Monster约548增/112删，整文件覆盖不可取。

| 优化/文件 | ext冲突与建议 |
| --- | --- |
| 第一轮 `Game.updateVision`、`LightMap.paintLights/dance` | 最值得先落。保`bodyLightOrigin`、`footprintContains`、markStatsDirty及nativeStat透视/矿灯；只把同序光源改为批量提交，仍传实时脚印谓词。第一轮局部三态查询缓冲可先不改跨回合缓存，较容易验证 |
| 第二轮 `MonsterLifecycle.monsterAt/withMonsterLookup` + Game/Monster查询 | main按anchor入桶，ext必须按完整footprint；保ignore参数、活体光遮挡和DYING通用查询区别、休眠/reserved策略、原列表首匹配。不能包整个takeTurn/DF/事务；movement/spawn/death可能在其中发生。融合已有ownedMonsterList、squareListUsers、监听/恢复绑定，不另建失效不全的第二权威索引 |
| `LightMap`跨帧缓存、flareKnowledgeBuffers | **高风险回滚冲突**：ext`:77 checkpointRenderState`依据“dance新建图、旧visual只保引用”；复用后旧图会原地改写，这一假设不再成立。须扩充/失效派生缓存的回滚合同，验证失败生成/缓存层进入/身体转换/居民事务后完整显示及引用；stencil中channel引用不能指向已回收图。WeakMap callback/遮挡缓存保持图外，过U00/U03 |
| FOV/记忆物品索引/Appearance | 只缓存几何，不跳知识发布。结构门/顶/墙与native气体/秘密地形同回合更新；保`nativeStat`而非恢复ringBonus。itemsAt保find首匹配，适配ext物品显示知识；幻觉/结构外观/巨兽可见性逐项对比 |
| Grid/DF四层flags、Gas邻域缓存、Promotion稀疏第二趟 | ext有`CellProperties`组合层、结构observer和native地形损毁结算；不能用main原生四层OR覆盖composed flags。缓存刷新必须包含所有相关写点与结构变化；保两轮气体更新/RNG抽取、晋升x/y/layer和递归DF读实时mask的顺序 |
| LoopMap、Pathfind/PathFrontier、Monster游荡/安全图 | 整数key/缓冲复用可分拆；`PathFrontier`也服务FootprintPathing，保其平局。新增main用例与ext身体/区域/不可达回调差分共同跑；结构通路应进入LoopMap失效输入。无尺寸/越界起点兼容不能丢 |
| GameCanvas按需提交、MessageJournal分页/locale | Canvas已有模块选格/建造草稿、身体、telegraph、显示timeline/确认门控；地图、hover、选择层、镜头、resize、隐藏后恢复都要dirty，不能只移植main四个触发点。保模拟ticker和50ms采样，分页键走i18n、保全部档案可达；测idle GPU与真实浏览器，不能只靠SSR |
| main新增测试/三个profile脚本及test-suites登记 | v2脚本不能原样作为ext门禁。迁移正确性/工作量用例而非覆盖ext已改的测试和注册表；自然v4重录后比较字段，附模块删除/配置指纹。main的最终hash只用于历史引用 |

建议四个可回退小批次：①第一轮批量光照及脚印查询合同；②第二轮显示光复用/FOV/通用占位（先修回滚设计）；③地形/环境/路径；④Canvas/日志/投影刷新。每批测相同ext录像与事件/full/最终世界，先证明规则不变，再报性能。主分支之后若继续变动，固定两个提交逐hunk移植，避免无关合并扩大范围。

## 8. 推荐路线、工作量和维护者决定

工作量是熟悉本仓库的单一主笔、含定向回归/报告的工程估计；1 Codex轮次指一个范围明确的实现→测试→修复闭环，不是一次聊天或一个工具调用。长全量门禁/人工真机排队另计日历时间，各方案不能机械相加。

| 阶段 | 人日 / Codex轮次 | 退出条件及排期 |
| --- | --- | --- |
| P0：v4深层基准、计数和预算 | 2–4日 / 2–3轮 | 自然全程零OOS、场景覆盖和首个GC/分段耗时；**先于phase6/P1共享主干大改**，当前评估不算已完成此阶段 |
| P1：main两轮分批移植 | 5–9日 / 4–6轮 | ext语义/回滚差分+配对性能，预估比全量架构重写收益更确定 |
| P2：A1派生缓冲与有据可查的事务/属性失效优化 | 6–12日 / 4–7轮 | 普通深层预算、无新GC增长；每步有独立正确性oracle，不以关验证提速 |
| P3：A2事实存储平铺（可选） | 10–18日 / 6–10轮 | 只有剩余profile支持才做；schema保持或单独升级决策；合计A路径不含B/C |
| P4：B模拟Worker（条件立项） | 20–35日 / 10–18轮 | 设备主线程Long Task/帧预算达标，确认/回放/持久化/模块UI全闭环；总CPU与内存不可明显失控 |
| P5：C原型→生产（暂缓） | 原型5–8日/3–5轮；累计15–30日/8–16轮 | A后仍有≥25%可批量内核占比，端到端收益足以抵偿第二工具链 |

排期建议：先完成P0和main移植，再让phase6掉落接线接入同一基准；loot纯数值/内容工作可独立推进，但Game、属性失效、Item codec/摘要由单一共享主笔串行整合。当前树只评估已有StatPipeline，phase6落地后重新测其来源数量、已知预览、生成/掉落和词缀内存，不把已有缓存误认为未来免测。

party P1a引入1/2/4人、显式actor输入、共享感知、多目标AI及专用有效codec，还要求保无party字节/行为。建议在A0/A1稳定边界上开发P1a，提前冻结actor/query/display协议；**不同时重写TimeCoordinator、Game、codec和B桥接**。共享视野可能把FOV/知识发布放大至人数倍，目标相关路径缓存也增多，但环境仍只能每客观块算一次。P1b窗口/计划、P1c托管将进一步增加批量推进压力，B可在P1a之后、P1b/P1c之前按实机结果立项；若单人设备已明显阻塞，可先做不含party语义的B facade设计与小原型，但不能阻塞P1a去等A2/C。

| 需维护者决定 | 推荐 |
| --- | --- |
| 首要目标是吞吐还是手机响应，指定哪些设备？ | 双指标，先固定桌面Node runner和一台中端手机；桌面命令P95与手机主线程/输入延迟分开，不用FPS替代模拟耗时 |
| 优先局部移植还是全面数据重构？ | 批准P0+P1，A1逐项按profile推进；暂不批准A2整图替换 |
| 是否保持本版本录像逐域/最终状态相等？ | 性能阶段保持；确需格式/数值变化独立版本任务，不迁移旧档，不把变化藏进优化 |
| world/模块最大规模及预算由谁冻结？ | 按现有结构/空间/居民上限加自然D20+样本；phase6/P1新增规模单列，不用减怪、减光、少算居民作为优化 |
| Worker协议与5Y检查点后端关系？ | 一个模拟权威，先保5Y完整性/两job/安全前缀；明确选后端，测两worker内存再决定是否合并计算所有者 |
| A/B与party接口谁先定？ | 先冻结actorId、session/revision、确认DTO和只读投影接缝；P1a不必等待完整B，双方共享文件串行 |
| C语言/工具链是否现在引入？ | 现在不引入；条件满足再用Rust小内核试验，保JS精确参照与回退 |
| 性能预算如何转硬门禁？ | 先同机3次校准并冻结manifest；稳定计数/零OOS立即硬门禁，绝对耗时在专用runner启用，GC先观测 |
| AGENTS全量档与ext实际脚本不一致如何收口？ | 在下一实施任务前统一文档/可执行门禁，维持用户要求的验收强度；本次不修改政策、不伪称执行不存在入口 |

### 测量收尾

本次现有两文件/三项性能测试全部通过，实际exit0，Vitest 4.1.11，总时长111.79 s（tests 107.81 s）。原始日志 `perf-tests.log`，样本 `settlement.json`、`residents.json`、`residents.json.64.json`。命令：

```sh
NODE_OPTIONS=--max-old-space-size=3072 \
SETTLEMENT_PERF_OUT=/private/tmp/ext-perf-assessment-20261015/settlement.json \
RESIDENT_PERF_OUT=/private/tmp/ext-perf-assessment-20261015/residents.json \
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
node_modules/vitest/vitest.mjs run \
src/ext/modules/settlement/tests/settlement_performance.test.ts \
src/ext/modules/settlement/tests/resident_performance.test.ts \
--maxWorkers=1 --no-file-parallelism
```

| 当前树受控场景 | 普通命令 median / P95 / max（ms） | 完整摘要边界峰值（ms） |
| --- | --- | ---: |
| 营地测试control | 5.628 / 6.361 / 11.478 | 98.546 |
| 营地测试camp | 5.654 / 7.790 / 13.121 | 86.381 |
| 16居民测试匹配native control | 12.989 / 18.515 / 71.178 | 95.811 |
| 16居民实际plant/haul/guard负载 | 14.451 / 21.393 / 71.228 | 96.877 |

营地P95净增1.429834 ms，16居民P95净增2.878167 ms，均满足原≤5 ms断言。每档320条wait输入，前32条预热、287条普通样本、1个完整摘要边界，未把这1点P95化。居民四营64人长跳从simulationTicks 94,000到1,000,000,000：8次样本，冷45.759833 ms、其余41.312–45.487 ms，max45.759833 ms，满足原≤50 ms；world JSON 99,473 bytes、save 7,158,555 bytes。后者测试直接advanceWorldClock后计settleResidentNeeds，是受控需求结算，不能称自然录制了十亿tick。

两组seed均51020001，D1、settlement模块；harness关闭动画，场景构造/严格载入/存读验证在计时外，Node默认没有生产浏览器Worker，不含显示投影/Pixi/DOM。三项只执行一次原测试，计时期间未并行运行本任务其他测试或profiler，仍不能保证系统全局无外部负载。没有采集GC，也没有由此证明深层预算、手机流畅度或全部模块组合通过。

最终检查：仅新增本文件，未修改生产/测试/配置；文档LF及diff空白检查通过。本任务不需要构建或完整npm/ext/drift门禁，未将这三项定向测试冒称全量验收。
