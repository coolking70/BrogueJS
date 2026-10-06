# 5A0 执行报告：合同冻结与体积探针

日期：2026-10-06。执行分支 ext/phase5-design，HEAD 87d92c8；用户要求不改生产代码、不 commit，已遵守。交付 [C5-1 合同](phase5a-contract.md)、本文及 [只读探针](../../scripts/phase5a0-size-probe.mjs)。任务原文件 [phase5a0.task.md](phase5a0.task.md) 开工前已是未跟踪文件，本步保留。

## 1 结论与证据边界

1. C5-1 / 1.0.0 已形成精确 TS 声明草案：LevelRef/唯一层所有权、权威 simulationTicks、在场/离场精度、离线计划和提交、窄世界事务、物品/容器/节点/工位/工作票据、结构/房间/运行期 region、通用 RestPoint、5B SDK 子集与错误码。没有创建生产实现。
2. 任务指定 7f6de96 确实是 **foundation=5，growth=1.7.0、narrative=1.4.0、combat=1.5.0、giants=1.0.0**。当前设计工作树仍是 foundation=4，未包含该提交。探针使用指定提交的仓库外固定副本，不合并共享代码，也不把阶段3/4尚在执行的收尾门禁写成已通过。
3. 当前完整 checkpoint 方案不足以承诺长期建设。预算内八营地体积夹具：单事件 **6,039,216 B（约5.76 MiB）**；64条真实零时间命令的导出录像 **386,510,068 B（368.61 MiB）**，带前缀存档 **407,574,983 B（388.69 MiB）**。固定末事件规模外推1万条约 **56.25 GiB**，不是实造1万条/写入56 GiB。
4. 摘要可减记录体积，逐命令全量 stringify/canonical/hash 的成本仍高。预算内八营地全世界 canonical+SHA-256 中位 **190.10 ms**；仅 SHA-256 已编码字符串仍 **21.03 ms**。推荐版本化分域/分块摘要及完整重算差分保险，周期快照剥除录像前缀。不能用“改成 hash”宣称达成新增命令 P95≤5ms。
5. 本步完成设计和探针；新版录像实现、5A生产代码、5B正式派发均未开始。数值草案在§5，维护者确认后由5A2交付具体SDK基线再派发dot。

## 2 探针方法、运行命令和结果

### 2.1 固定输入与环境

运行设备 Apple M5、10个逻辑CPU、32 GiB内存，darwin-arm64。Node **v24.19.0**，NODE_OPTIONS=--max-old-space-size=3072。使用本机已有运行时，不下载依赖。完整命令在仓库根执行：

准备导出/链接命令用于尚不存在的固定副本目录；已有相同commit的固定副本时直接重跑node探针行。

~~~bash
mkdir -p /private/tmp/brogue-phase5a0-7f6de96
git archive 7f6de96 | tar -x -C /private/tmp/brogue-phase5a0-7f6de96
ln -s '/Users/coolking70/Documents/同步空间/BrogueJS/node_modules' \
  /private/tmp/brogue-phase5a0-7f6de96/node_modules
export PATH='/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':"$PATH"
export NODE_OPTIONS=--max-old-space-size=3072
node scripts/phase5a0-size-probe.mjs \
  /private/tmp/brogue-phase5a0-7f6de96 \
  /private/tmp/phase5a0-size-results.json \
  > /private/tmp/phase5a0-size-probe.log 2>&1
~~~

最终命令完整退出 **0**，四种规模均运行完。脚本只通过Vite SSR加载固定副本，watch/ws关闭，不访问浏览器保存库；为探针在**内存的registry加载结果**注册一个 sizeprobe 数据模块，不改磁盘生产文件、不改生产校验器。初轮退出1：Item显式字段含undefined，未经JSON边界的模拟状态被现有 isJson 拒绝；同时Vite默认WS监听遇沙箱EPERM。修正探针为先JSON投影、显式 ws:false 后全组重跑；没有绕过生产守卫或扩大权限。

固定副本的 src/scripts/public/七个配置文件共 **950** 个输入，脚本前后完整逐文件汇总SHA-256相同：

~~~text
d7a18323e246cb9719b66e492df7c3fb582e328ef1b532364a30d1bc17e105be
~~~

原始小型统计在 /private/tmp/phase5a0-size-results.json（含每组样本统计、规模、外推及前后hash）；运行日志在 /private/tmp/phase5a0-size-probe.log。没有把大型世界/录像JSON写盘或加入仓库。仓库内探针不进入任何测试清单、构建配置或package命令。

### 2.2 真实实现与模拟数据的区分

每组使用现有 createHeadlessGame(51005000,'wizard') / Game，再开固定seed的extended局，仅启用数据探针模块。真实原生79×29地牢通过 generateDepth 构造1或8层，使用现有活动/缓存移交；到达深度是**合成跳层布景**。居民用真实Monster（rat模板、盟友/不跟随标志），箱内物品用真实Item构造及 serializeItem 投影。结构/容器/材料字段/预留/票据/订单/离线输入均为模块状态中的**体积代理数据**，尚未执行C5能力。模拟容器引用及Item行各保存一次，不把同一物品再放到真实地面根；原生物品另计。

随后调用真实 ExtensionRuntime.snapshot、Game.toSnapshot、toSaveSnapshot、exportRecording、JSON stringify/parse。canonical/hash输入先过实际JSON投影边界去掉原生显式字段中的undefined；归一化在该项计时外，完整新编码器仍需另计投影成本。64条记录都经 **executeCommand('escape')** 产生，完整大状态每事件重复捕获；这些是零时间命令，没有真实劳动。采样期间两条RNG状态完全不变。2次预热后9次测量；前缀导出/存档1次预热后5次；P95是小样本经验分位，9次时等于最大样本，不是广泛设备性能结论。顺序跑，未停另一工作树门禁；并发系统负载可能影响延迟。

“预算内”仅指**对象计数符合§12.2**，不证明结构布景能建成/连通、资源来源/escrow有合法流程。夹具为了上限体积每格有4个部件，部分序列化字段比最终C5声明更冗长，实际新codec尺寸须在实现后重测。初始new-game录像来源在安装长局数据前形成；后续save的 recordingOrigin 可以通过现有结构连续性检查，但**不能证明合成跳层/状态可从种子重放**。本探针没有load/replay/seek/续录的可玩验收，不能以 hasRecordingOrigin=true 冒称通过。

### 2.3 数据规模

每个营地region为24×20（480范围格）；预算内每营地384有结构格。每个箱capacity64，八营地用63个实物槽+1个输出预留槽，给原生物品留全局额度。订单每营地32，资源点每层32，通知128。

| 样本 | 营地/层 | 居民 | 结构格/部件 | 箱/模拟stack | 原生Item / 总Item roots | 节点/ticket/订单 |
| --- | --- | --- | --- | --- | --- | --- |
| control-1-floor | 0/1 | 0 | 0/0 | 0/0 | 9/9 | 0/0/0 |
| one-camp | 1/1 | 16 | 384/1536 | 16/1024 | 9/1033 | 32/16/32 |
| eight-camps-legal | 8/8 | **64（各8）** | **3072/12288** | 128/8064 | 67/**8131** | 256/64/256 |
| eight-camps-stress-not-legal | 8/8 | **128（各16，超上限）** | **3840/15360（超上限）** | 128/8064 | 67/8131 | 256/128/256 |

最后一组是任务所举“8×24×20×16”的压力解释，**不批准人口/结构上限翻倍**。每层79×29未扩大；首版最多40地牢+1site还未在本探针实造全部41层，因此20MiB不是整局存档最大值。全部128箱64槽都装满会超过另含原生Item/escrow的8192全局上限，不应拿“箱预算合规”代替根预算。

### 2.4 实测体积

所有数字是紧凑JSON的 **UTF-8字节数**（MiB=2^20B），不是压缩值或localStorage内存占用；UTF-16字符串/对象峰值另有开销。

| 样本 | 完整extension checkpoint B | 无命令前缀的存档 B | 16命令录像 B | 64命令录像 B | 64命令存档 B |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0营地 | 577 | 1,922,191 | 15,892 | 63,028 | 1,986,026 |
| 1营地 | 776,120 | 2,730,484 | 12,424,532 | 49,697,588 | 52,428,879 |
| 8营地预算内 | 6,038,809 | 21,064,108 | 96,627,652 | 386,510,068 | 407,574,983 |
| 8营地超预算压力 | 6,701,446 | 21,857,868 | 107,229,844 | 428,918,836 | 450,777,511 |

重要差异：toSnapshot().run.recordedInputEvents 已包含命令前缀，toSaveSnapshot 在此基础上补来源/影响输入解释的模态。**只删recordingOrigin不会消除历史前缀膨胀**。无前缀存档这里是在命令数0的安全点测得，不是修改现有codec得到的新“轻量save”。

### 2.5 实测耗时

单位ms，表格为中位数 / P95；均是CPU序列化/投影，不含IndexedDB/localStorage磁盘I/O、压缩或渲染。

| 测量 | 0营地 | 1营地 | 8预算内 | 8超预算 |
| --- | ---: | ---: | ---: | ---: |
| 完整extension snapshot | 0.01/0.01 | 3.97/4.17 | 22.93/25.77 | 26.41/27.14 |
| toSnapshot，命令数0 | 4.37/4.92 | 8.18/8.75 | 52.88/55.33 | 59.41/59.89 |
| toSaveSnapshot，命令数0 | 4.64/5.44 | 15.71/16.10 | 100.05/104.25 | 110.31/136.50 |
| stringify已得存档，命令数0 | 4.78/5.11 | 5.99/6.34 | 39.00/39.68 | 41.13/42.42 |
| parse已编码存档 | 2.65/3.38 | 4.71/4.96 | 27.99/29.15 | 29.65/29.94 |
| canonical完整世界 | 18.51/19.26 | 26.48/29.53 | 166.86/184.51 | 181.93/185.81 |
| SHA-256已canonical字符串 | 2.35/2.36 | 3.34/3.67 | 21.03/21.05 | 21.81/21.87 |
| canonical+SHA-256 | 20.97/21.44 | 31.14/31.80 | 190.10/201.72 | 194.31/218.87 |
| executeCommand escape，64样本 | 0.02/0.06 | 3.57/4.16 | 23.17/28.14 | 26.38/31.98 |
| exportRecording，64前缀 | 0.44/0.47 | 250.50/252.90 | 1824.59/1852.90 | 2296.42/2322.88 |
| toSaveSnapshot，64前缀 | 5.04/6.23 | 286.07/286.44 | 2619.68/2621.98 | 3269.21/3327.35 |
| stringify已得存档，64前缀 | 2.64/2.73 | 71.08/71.57 | 737.29/745.84 | 815.08/860.87 |

计时分别列出，不能把toSaveSnapshot和stringify的分位数相加冒称端到端P95。toSaveSnapshot在来源校验时还做现有canonical/录像校验，故不等于单纯toSnapshot。没有测新的离线planner/结构迁移/真实NPC劳动性能，不能声称≤50ms恢复目标已通过。全量canonical的成本证实还要做摘要计算成本设计。

### 2.6 录像新版的体积外推

以测得末事件的其余字段固定、仅index位数变化计算1000/10000事件。实际长局tick/turn/data/decisions会变化；这是**固定状态体积代理外推**，不是自然长局尺寸。试验摘要用311…314B对象替代extensions，保留位置/tick/turn/双RNG等；单完整事件→代理摘要事件：1营地776,521→714B，8营地6,039,216→721B。它没有实现下文全部新版字段/分域digest，因此是方案量级估算，不是v4实际字节承诺。

周期快照取实际无前缀world快照，明确剥除 run.recordedInputEvents 和 run.recordingOrigin，只保一个起点加完整周期位置。下表包含起点；不含快照索引/digest/JSON外壳的少量开销，也未压缩。

| 1万命令外推 | 旧完整checkpoint | 仅代理摘要 | 每256命令快照 | 每1024命令快照 | 每2048命令快照 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1营地 | **7.232 GiB** | 6.837 MiB | 110.997 MiB（40份） | 32.877 MiB（10份） | 19.857 MiB（5份） |
| 8营地预算内 | **56.245 GiB** | 6.904 MiB | 810.436 MiB（40份） | 207.787 MiB（10份） | **107.345 MiB（5份）** |
| 8营地超预算压力 | 62.416 GiB | 6.904 MiB | 840.715 MiB | 215.357 MiB | 111.130 MiB |

推荐默认每**2048条已完成输入命令**一次可选加速快照，最多**64MiB加速缓存**，剔除最老加速快照（保留最新可容纳者），种子/完整命令/摘要永不为省空间截断。起点从seed重建，不要求常驻一份长局起点world。到1万命令预算内样本，若保留3份20.09MiB快照，加摘要约67.17MiB；比未限额5份更小，但seek可能回退更远。≥41层/更大world时单份快照可能超过64MiB，直接不保存加速快照，仍可从seed重放。

为何不是256：只8层状态就外推810MiB。为何不能承诺快seek：2048步实际耗时未知，不能从字节估算推FPS/秒数；在场长劳动/大量NPC也可能更贵。周期/64MiB是待审批实现建议，存储性能和seek延迟另作专项。

## 3 “摘要+周期快照”独立新版录像设计

以下为 **C5-recording / draft 1**；P5-D12=A批准了独立设计/验收方向，没有授权本步改实现。建议在5A1共同分配foundation6/whole-run4/recording4/来源2，若收尾抢占格式号则由集成人改一个版本表并重新冻结，不能在两个分支分别升级。

### 3.1 字段与机械摘要

~~~ts
type Digest = string; // 64个小写十六进制字符，SHA-256
interface RecordingV4 {
  version: 4; recordedAt: number; seed: string; mode: string;
  initialLevel: LevelRef; extensions: ExtensionManifest | null;
  codec: { wholeRun: 4; foundation: 6; origin: 2 };
  digestAlgorithm: 'sha256-c5-merkle-v1';
  checkpointPeriod: 2048;
  initialDigest: MechanicalDigest;
  events: RecordingEventV4[];
  snapshots: ReplaySnapshotV4[]; // 可为空，仅加速；按afterCommand递增
}
interface MechanicalDigest {
  root: Digest;
  domains: { native: Digest; extensions: Digest; world5: Digest;
    actorActions: Digest; knowledge: Digest; random: Digest };
}
interface RecordingEventV4 {
  index: number; action: string; data: RecordedInputData;
  decisions: boolean[]; tick: number; turn: number;
  simulationTicks: number | null; levelRef: LevelRef; player: Position;
  rng: RandomState; terminal: null | { won: boolean; superVictory: boolean; score: number };
  checkpoint: MechanicalDigest; chainDigest: Digest;
}
interface ReplaySnapshotV4 {
  afterCommand: number; tick: number; simulationTicks: number | null;
  levelRef: LevelRef; prefixDigest: Digest; checkpoint: MechanicalDigest;
  snapshotCodec: 'brogue-web-whole-run-v4'; snapshotDigest: Digest;
  world: WorldOnlySnapshotV4;
  inputState: RecordingInputStateV2;
}
interface RecordingInputStateV2 {
  inventoryOpen: boolean; inventoryAction: string | null; referenceScreen: string | null;
  arcana: null | { itemId: number; cursor: Position };
  throwItemId: number | null; pendingUseConfirmId: number | null;
}
interface RecordingOriginV2 {
  version: 2; header: Omit<RecordingV4, 'events' | 'snapshots'>;
  events: RecordingEventV4[]; prefixDigest: Digest; inputState: RecordingInputStateV2;
}
~~~

此块描述新版格式，复用C5类型与既有原生类型，不是假称当前TS存在这些符号。WorldOnlySnapshotV4 是新whole-run原生/扩展/世界/实体根，**不含所有录像event、origin、快照列表本身、旧UI缓存**；inputState保留影响下一条输入解释的模态。save包含world+一份RecordingOriginV2摘要前缀，不能再同时保存run.recordedInputEvents的第二份可写历史。内部运行录像数组仍是唯一录制者，只在一个持久路径导出；快照不能递归包含origin/events/snapshots。

哈希规范：JSON对象键按码点排序；无undefined/NaN/Infinity/BigInt/循环，UTF-8。C5整数使用安全整数；原生允许的有限非整数按JSON数字规范编码，不在hash时自行舍入，负零规范为0；数组保持规则顺序，逻辑Set/Map由codec显式规范（不能随便重排monster AI数组）。空域也有带域标签的固定摘要。叶子采用canonical JSON ["c5-leaf-v1",domain,key,payload]；域节点采用 ["c5-domain-v1",domain,orderedLeafHashes]；根采用 ["c5-root-v1",codecIdentity,manifestFingerprint,orderedDomainHashes]，全部SHA-256。每个algorithm/domain字段和排序约定形成规则指纹/固定向量。

覆盖：完整新增world5账本（结构、容器及Item引用/数量、node、ticket/escrow/输出预留、离线余数/planID/种子/ordinal/收据）、全部模块state/components/foundation世界事实、原生实体/所有权/层图/时间/生成与输入资格、唯一动作根、持久已知/记忆以及双RNG完整状态和计数、离线派生域键/高水位。不能只比较revision或可见显示投影。纯派生light/FOV/path/draw缓存可排除，需字段清单证明可确定重建，**持久知识/记忆不能当显示缓存排除**。

性能实现建议：每层固定32×8格分块；Item/components按稳定ID分桶，层/动作/经济账本按所有权分块；显式dirty写入口重算受影响叶，形成Merkle root。记录独立全量重算实现，在周期安全点和测试逐事件验证增量root==完整root，覆盖所有原生直接写入与新事务写集。dirty漏登记守卫失败即修生产入口，不能缩小hash覆盖；在完成这种证明前只能用全量hash并如实报告成本。哈希函数本身无Game写入/RNG，也不让UI发dirty标志改变机械摘要。

chainDigest：起点为SHA-256 of canonical ["c5-recording-start-v1",headerWithoutRecordedAtAndInitialDigest,initialDigest]；第i条为SHA-256 of canonical ["c5-recording-event-v1",previousChain,eventWithoutChainDigest]。排除recordedAt是因为它是导出元数据；规则/seed/manifest/codec必须进入起点链。event.index从0连续递增；afterCommand是已完成条数，prefixDigest指该条数之后的chain（0用起点）。初始摘要允许既有合法的尚未就绪模块初始化态，角色创建等真实输入随后记events，不在load重发初始化。这是完整性/对应关系校验，**不是带签名的反作弊证明**。

### 3.2 周期、seek、损坏与保存续录

每2048条完整完成的命令后，在没有advancement/确认/未提交事务的安全点可保存一份world-only快照；长动作中不截generator。命令被No拒绝仍是完成的一条输入，可计周期；UI帧、动画/墙钟不计。加速缓存64MiB、快照总数≤128，按afterCommand稳定淘汰老加速项；不删除命令/摘要/起点。不因窗口时长、设备速度或保存次数改变事件/随机域。原生世界自身的硬预算仍是机械限制，与加速缓存预算分离。

基础replay从seed/精确manifest重新开局，通过同一executeCommand/决定记录重放，每条比较全部root及诊断域/双流。seek选≤目标的最近有效快照，先完整验证schema/manifest/预算/所有权/跨引用/snapshotDigest/prefix链/该位置checkpoint，再在候选Game恢复，设置对应输入模态，重放后续输入，逐条摘要检验；seek清旧UI草稿/焦点、派生缓存，不恢复异步动画/context。无快照可从seed走同路径。

没有验证来源的外部快照不能仅凭自写snapshotDigest当作真实前缀结果。首次导入/未验证文件按seed重放到快照位置验证root，然后给该文件hash+session保存“前缀已核实”标志；同session后续seek可加速。已录制本局的快照可由录制者在生成安全点验证。快照不是替代命令日志的权威，用户手改文件仍不是安全证明。

命令/摘要链不连续、坏版本/缺模块/指纹不符/非法世界→在退休当前局前拒绝；坏加速快照→跳过该快照并从更早可信点/seed重放，保留可诊断“加速资料损坏”记录，不 silently fix 命令日志。真实replay摘要不同→停止OOS，报首个command/域/tick/位置诊断，禁止继续模拟新世界。快照恢复失败不能半替换当前Game或发enteredLevel/奖励/出生；load仅恢复，真实历史入层命令才做一次离线结算。

续录save：world中完整摘要和origin最后事件一致、header精确版本/seed/manifest匹配、index/chain连续、inputState合法，才恢复原prefix append；无来源诊断快照可load但不伪造完整录像。分支续录丢弃原suffix/大于边界快照，以最后chain接新事件；不重发工作/离线/招募事实。IndexedDB的一次事务提交save world与摘要前缀，失败保留原save；事件archive引用若使用外置chunk，commit须先保证所有chunks与清单同时可读，不能因“录像ID存在”恢复缺前缀的save。

### 3.3 存储与独立验收

建议录像库迁IndexedDB（新对象仓库recordings / eventChunks / snapshots；浏览器JSON导入导出保持），localStorage仅保存小偏好/索引且不保存完整录像。不迁移旧v3内容，旧档明确拒绝。录像event每256条一个持久chunk，chunk只是存储分组，不改变2048快照周期；写入与清单使用同一IDB事务，压缩若后续增加必须自带算法/编码版本。导出仍完整JSON可选择携带加速快照；无快照导出可从seed重放，不因省空间缺命令。

实施专项必须含：坏header/链/域/快照/越界/重复Item/伪种子/缺模块/未知键/超预算；旧v3拒绝；实际非零时间的采集/制造/建造/两层离线/No/中断完整replay；0/1/2047/2048/2049边界、从seed/有效快照/坏快照回退seek等价；活动模态保存/续录；OOS首位置；长前缀save不二次嵌历史；64MiB缓存淘汰/单份过大仍可从seed；增量root对独立全量root逐事件一致和失败回滚；IDB失败原记录不丢。最终最大状态/长局测**实际v4字节、摘要计算P95、保存/导出/seek耗时和峰值内存**，不能用本节代理计算冒称新格式通过。

## 4 5A1 / 5A2 / 5A3 拆分建议

按已批准P5-D14=A：开发期相关功能门禁、5Z最终统一完整/组合/真实删除。每个小步验收完停下，由维护者批准下一步；5A0没有实施授权。共用源码由本地单一主笔，dot只做自有crafting包。若阶段3/4收尾有小修复，先确定最终commit再开5A1，不在两个树上争夺格式号。

| 小步 | 范围和可停下的结果 | 验收重点 | 预计共享文件 |
| --- | --- | --- | --- |
| **5A1 层/钟/受控离线fixture** | dungeon LevelRecord/唯一根、可选world5、simulationTicks，管理层冻结生态、纯离线经济核与显式提交；site类型预留、不开放地表；用foundation-owned fixture测有限订单，不加入settlement内容 | elapsed不双计；native层路径不变；0/999/1000/1001、31/32/33/长尾、2/17段一致；当前/缓存/跟随/坠落写边界；load不结算/终局冻结；入层失败全对象图恢复；save/load/replay/seek/续录 | Game、TimeCoordinator、GenerationCoordinator、LevelState/WholeRunSnapshot/EntitySnapshot、runtime/types/compatibility、LevelTravel、U03、新WorldSettlement/world5 codec |
| **5A1-R 录像专项，归5A1格式批次** | §3方案批准后实现摘要/周期/完整机械投影、独立hash差分、world-only快照、来源2和IDB录像库；先锁一份版本表 | §3.3全部；不能只删checkpoint；没有增量证明就先全量hash并报告成本；保存前缀唯一、旧版本拒绝 | Game录制/校验/seek/来源、WholeRunSnapshot、SaveStorage或独立RecordingStorage、App/MainMenu录像UI、codec/兼容/i18n/U03、新摘要模块 |
| **5A2 物品/容器/节点/工作SDK** | MATERIAL/工具/kit与固定native装配；真实箱/escrow/refund roots、节点再生、非阻挡独立工位；唯一中立scheduler及ticket；交付C5-1真实TS导出/fixture，让dot可以独立开发 | 26字母与stack99/部分转移/满仓/实体预算；材料守恒、退款残骸、ID计数；一actor一动作、combat absent/同开；时间不重复；No/过期/中断/工具破损/节点预留；坏定义/坏档/真实命令replay；旧combat+giants来源/费用/interrupt不倒退 | Game、Items/Item/Inventory/ItemLoader/ItemUse/UI详情、EntitySnapshot/WholeRunSnapshot、ActorActionProduction/Scheduler/Scope、PhasedAttackProduction、runtime/types/world、combat保存layout adapter、U03、SDK/工作/定义模块 |
| **5A3 结构/房间/region/RestPoint** | 所有机械性质读者和写入口完整迁移；稀疏部件/统一失效/损毁、运行期region/房间/通用休息；只开放底座fixture，不交付营地产品 | gas/液体/火/DF/Promotion、门/窗/天然岩石、全足迹/逃生/保护格；房间2/128/角洞/破顶/通风；区域8/128/拆营高水位；箱损毁掉落/托管守恒；无combat床与有combat篝火分别恢复；provider失败回滚 | Grid/TerrainRules/DungeonFeature/Promotion/Gas、FOV/Light/Pathfind/Scent/Loop/Waypoint/射线与法术读者、CreatureSpatial/SpatialRevision/位姿、Game/regions/world/codec、WorldRestProduction、DisplayFrame/PresentationObserver、U03 |

5A1-R的审批是对具体格式/hash/周期/存储/验收任务的批准；不把P5-D12方向选择当作本轮实现授权。版本6首次在5A1分配；若5A2拆出独立格式批次，任何保存布局变化再升级对应版本并登记，不让同号文件靠“是开发阶段”蒙混通过。

各步门禁的具体运行清单由该步任务冻结，最低包含：

- node scripts/check-module-boundaries.mjs、Node24.19.0下 vue-tsc -b、npm run build，新增/受影响测试和所有读源码守卫（包括gen内terrain白名单的定向守卫）。
- 真实Game相关组合：空/旧模块独立/旧四模块全开、fixture工作+combat/giants，保存/重放/seek/续录；5A2必须覆盖无combat。受影响UR2/UR3/UR4、u_27/x2a/x3b/U03，生成/生态改动跑相应drift。跨版本trace变化先归因，原捕获重录并逐字段登记，不因换版本直接全部重录。
- 显式写集与独立全对象图差分，故障在分配ID/扣料/改层/消费escrow/输出/模块参与者/消息事实等每个发布点注入；拒绝case不放宽旧守卫。
- 每步报告命令、退出码、输入hash、失败/复核与未覆盖；不混称engine-only是浏览器验收。5Z最终正常树完整 npm test、全部 test:ext、动态64启用子集、64保留/删除行及每行剩余子集真实smoke、当次生产包浏览器、最大体积/长局；删除用removal档，不能留壳或隐藏剩余测试。

5A2冻结后dot可与本地5A3并行，因为crafting台首版非阻挡，不调用结构/居民/房间接口；5C/5D/5E分别另批，5C2 site必须迁region/world/spatial/action/实体codec，不是多加一个depth=0。任何后续SDK需求由本地一次修订合同/fixture，dot不能直接改共享Game排除阻碍。

## 5 5B 可转贴给 dot 的完整任务包草稿

### 5.1 派发抬头与依赖冻结

> 任务：5B1 独立 crafting 整包。基于C5-1/1.0.0，实现“徒手采资源→造工具/台→固定+0装备/口粮/床箱台套件”，仅crafting也可玩。不要增加生产XP、随机质量、强化/生命/力量药水、护符/宝石、商店、居民或跨层物流。
>
> 本任务当前是草稿，**不得以87d92c8作为正式SDK基线开始实施**。维护者派发前填齐：
>
> - 集成后5A2精确commit：待5A2验收；foundation/whole-run/录像/来源精确版本：按5A1最终版本表。
> - SDK真实导出路径、fixture路径与SHA-256：待5A2提供，合同C5-1/1.0.0；sdk兼容标识须进入模块声明。
> - 数值审批：§5.3–5.6逐表批准或一次给修订表；选定版本候选 module/rules=1.0.0、state=1、input=1、display=1，未批准前不写正式descriptor。
> - 门禁清单与集成人：维护者冻结相关文件/组合，Claude审查、本地集成；不是要求dot自改发现器/通用清单。

已固定的产品选择不再提问：**手采100tick/1单位、材料stack99、手工/桌/炉、固定普通材料、+0已知简单装备、普通口粮、床箱台套件、单包≤128配方**。所有新定义/算法/版本都在自己模块，只有foundation硬依赖；growth/narrative/combat/giants/settlement缺席照常闭环。

### 5.2 文件范围、模块结构与命令

允许 src/ext/modules/crafting/**（descriptor/module/schema/definitions/data/state/view/ui/locales/tests/test-suites），以及自有 docs/ext/crafting-config.md 和 docs/ext/phase5b.report.md。禁止Game、共用types/runtime/codec/时间/Items/发现器/package/通用测试清单、其他模块、共享黄金trace/基线改动。模块用已有descriptor发现器安装，不加硬编码catalog import。缺SDK实现/导出/资格时汇总一个接口问题清单交本地修复；不得另建scheduler或WeakMap动作根。

完整数据根：schema:1,moduleId:'crafting',moduleVersion,rulesVersion,materials,tools,resourceNodes,stations,recipes,limits；strict unknown-key、有限安全整数、唯一命名空间ID、启用owner、跨引用、locale和原生模板白名单。机械数组顺序进入canonical fingerprint，显示资产displayVersion独立。数据只能贡献定义，不带JS脚本/任意原生属性/自报输出。

公开命令只用合同§8的harvest/craft/place-station/cancel-work四种payload，经 executeCommand('ext:command',JSON.stringify(input))；不带actorId。prepare无料/时间/RNG/ID，确认后底座重验CAS并承接唯一正耗时动作。batchCount=1…16，每批原子完成；输出到当前玩家背包，来源为明确背包或同层邻箱。NPC工作接后续settlement订单adapter，不在5B自己实现招募或NPC日程。

UI复用刻符module bar/HUD/DialogService/DialogHost/DialogInput，模块locale/i18n。配方先显示来源/台/工具/缺项/固定产出/时间、批量−/数值/+，失败/退款/停工原因简洁中文；远方信息不补结算。回放只读、seek清临时预览；反复查看不动时钟/库存/票据/任何RNG。不增加window键盘屏障；保存/伤害ACK历史帧沿既有生产合同。

### 5.3 待批准物品表

以下数值是完整首包提案，**不是已运行/已批准数据**。definition ID均加 crafting. 前缀；nameKey/descriptionKey采用 ext.crafting.item.<id>.name/description，字形/颜色归自有显示表。没有数据缺口需要dot自行定平衡。

| 短ID | 类别/通用tag | maxStack | unitWeight | 固定装配 |
| --- | --- | ---: | ---: | --- |
| wood | material | 99 | 1 | basic木材 |
| stone | material | 99 | 2 | basic石材 |
| metal | material | 99 | 2 | 普通金属，无随机品质 |
| fiber | material | 99 | 1 | 普通纤维 |
| leather | material | 99 | 1 | 普通皮革；有独立节点，不修改怪物掉落 |
| fungus | material | 99 | 1 | 原料，不能直接冒充FOOD食用 |
| pick | tool / basic.pick | 1 | 3 | 初始耐久40，每次成功采矿扣1；破损仍是同Item，停止采矿 |
| kit-bed | kit / kit.bed | 99 | 4 | 可搬运/保存；settlement缺席不生居民 |
| kit-chest | kit / kit.chest | 99 | 6 | 同上；没有虚拟全局共享箱 |
| kit-table | kit / kit.station.table | 99 | 6 | 放桌可消费，或交settlement |
| kit-hearth | kit / kit.station.hearth | 99 | 8 | 放炉可消费，或交settlement |
| plain-dagger | native | 1 | 原模板 | 原生dagger，+0、已知、无诅咒/符文 |
| plain-leather-armor | native | 1 | 原模板 | 原生leather_armor，同上 |
| ration | native | 99（C5产出预留） | 原模板 | 原生ration_of_food，nutrition=1800，不给XP |

native物品的ItemDefinition maxStack声明明确为dagger/armor=1，ration=99仅用于C5制造输出的容量预留；已有非C5原生FOOD的拾取/合并与背包计数保持原规则，不借本表重写经典食物行为。数量仍受安全整数/槽/实体根预算。首包定义14种Item+2实体工位，合计16≤128；不将native模板新增到随机掉落表。显示字形/颜色建议材料 % / #C7B083、工具 † / #D2D6D8、套件 ▣ / #A8B2C0，模板物品沿原外观；所有文案都自有i18n，不向玩家露错误码。

### 5.4 待批准资源和启动表

每点每次固定扣1容量→产1同类材料，100tick；capacity/remaining在foundation节点根，crafting仅保存定义/放置收据。所有节点单格非阻挡、有已知可达相邻工位，不写地形。资源点按实际规则字段，而非特定ID分支。

| 节点短ID（kind） | 输出 | capacity | 再生 | 工具 | dungeon深度 / 每层上限 / 整局上限 |
| --- | --- | ---: | --- | --- | --- |
| wood-node（wood） | wood1 | 20 | 1/2000tick | 无 | 1…40 / 2 / 32 |
| stone-node（stone） | stone1 | 20 | 无 | 无 | 1…40 / 2 / 32 |
| fiber-node（fiber） | fiber1 | 20 | 1/1000tick | 无 | 1…40 / 2 / 32 |
| metal-node（ore） | metal1 | 20 | 无 | basic.pick | 2…40 / 1 / 24 |
| hide-cache（fiber） | leather1 | 12 | 无 | 无 | 1…20 / 1 / 24 |
| fungus-node（fungus） | fungus1 | 20 | 1/2000tick | 无 | 1…40 / 2 / 32 |

kind是有限行为分类，hide-cache显示“皮革存料”并非纤维材料或新动物尸体规则。默认site placement=null，5C2另批site资格；不以depth=0放资源。单层配置总上限10≤32，整局176≤512。无合法位 onNoSpace='skip'，存唯一收据不反复试图重掷；D1徒手wood源可 defer 在首次真实enteredLevel安全点再尝试一次，仍无位记skip，不改房间/楼梯/giants reservation。随机候选顺序由底座确定并记录生成归因；手采/产出本身不抽概率。

启动礼包仅新局一次：**wood6 + stone4 + fiber2**，用同foundation物品事务加入真实背包；有一次startup receipt，满包则同层合法安全地面、再无容量则skip receipt，禁止静默删旧物或每次load补发。它足够选择造table(wood4+stone2)及pick(wood2+stone2)，不含金属/皮革/装备/口粮。通过已启用模块初始化合法scope发，不伪造玩家采集奖励。D1尝试放徒手wood/fiber/fungus/stone源，其他节点沿深度/额度；不承诺任一拥挤层强制成功。5B必须在自然公开命令的可行种子证明D1取材/口粮与D2金属链，不只用无限库存fixture。

### 5.5 待批准工位和配方表

三类station：**手工虚拟工位**（stationId=null、stationTags=[]、无房间）、单格非阻挡桌（tag=station.table）、单格非阻挡炉（tag=station.hearth）。桌/炉交互距1，工作位相邻可通行，placementTicks=300；首版炉是制造工位资格，**不新增持续火/烟/氧气模拟**，危险原生火气照常阻断工作。实体台不强制有屋顶/settlement。后续室内高级配方另批。

| 工位definition | 原材料placementCost | 可替代的单一kit | 放置/回收政策 |
| --- | --- | --- | --- |
| crafting.table | wood4+stone2 | crafting.kit-table1 | 当前已知安全格，300tick，至少1合法工作位 |
| crafting.hearth | stone6+wood2 | crafting.kit-hearth1 | 同上 |

place-station从明确玩家背包付费；若合法kit存在优先用1kit，否则用原材料，**预览明确显示本次来源且底座计划重验**，不会kit和材料一起扣。kit与原材料成本相等，不产生兑换套利。5B不开放免费拆台/返还接口；结构统一拆卸晚于5A3并经settlement命令，不能自己移动world根退款。

| 配方短ID | 每批输入 | 输出 | 每批tick | stationTags / toolTag | offlineEligible |
| --- | --- | --- | ---: | --- | --- |
| make-pick | wood2+stone2 | pick1 | 500 | [] / null | false |
| make-table-kit | wood4+stone2 | kit-table1 | 500 | [] / null | false |
| make-hearth-kit | stone6+wood2 | kit-hearth1 | 500 | [] / null | false |
| make-dagger | metal4+wood1 | plain-dagger1 | 1000 | [station.table] / null | false |
| make-leather-armor | fiber6+leather4 | plain-leather-armor1 | 1500 | [station.table] / null | false |
| cook-ration | fungus3+fiber1 | ration1 | 500 | [station.hearth] / null | true |
| make-bed-kit | wood4+fiber2 | kit-bed1 | 500 | [station.table] / null | true |
| make-chest-kit | wood6 | kit-chest1 | 500 | [station.table] / null | true |

共8配方≤128，所有批量1…16，耗时/总输入/最大输出先安全整数预检。offlineEligible只是后续离线居民订单是否允许，不会在单独crafting关闭游戏时工作；5B不自己创建订单/32周期工资。完成批才扣工具耐久（只有采矿要求镐），取消当前批不倒退已完成装备/食物、不重复退款。自然装备制造必须调用5A2确定native装配，不用有附魔/诅咒骰的spawn。

### 5.6 配置上限、公开数值和审批项

建议limits固定：recipes128；itemAndStationDefinitions128（materials/tools/stations及输出定义合计）；nodeDefinitions128；nodesPerLevel32；nodesPerRun512；stationsPerLevel16；stationsPerRun128；startupReceipts1；placementReceipts512（高水位另保，不因滚动删除允许重放）；workHistory128；batchMax16；stack99；world Item roots8192由foundation共同核验。crafting不绕过更严格全世界region/stack/ticket预算，不拿自己包的局部上限追加另一份总额。

仍需维护者批准/填写的是**数值和实施细节**，不是重议P5-D01–D14：

- §5.3物品重量、工具耐久40/成功采矿扣1、三种原生输出适配maxStack（1/1/99）；字段全部可按一个修订表批准。
- §5.4各资源容量/再生间隔/深度/次数、startup6木4石2纤维、D1候选与skip/defer规则；不要让dot自行补怪物掉皮革。
- §5.5台费用/300tick、kit优先来源、8配方输入/输出/每批时长/offlineEligible。
- §3录像4/来源2的具体格式任务、sha256分块算法/覆盖、2048命令/64MiB/128快照缓存、IDB仓库与首次导入验证策略。
- C5新增clock/world5/actorActions codec路径与scope/SDK导出实际映射；5A1最终分配格式号、5A2受影响combat保存布局版本、SDK hash与fixture。没有这些实际输入不得正式发dot。

其余首包显示文案/字形可在上述规则和i18n守卫内自行实现，不要求逐句往返审批；5D短缺效率/袭击强度/作物周期不是5B任务，不让dot临时定居民数值。

### 5.7 dot 必须执行的验收和交付

- 严格包schema/引用/未知键/整数/预算/指纹、disabled/未安装能力不生资源/不抽RNG；显示view/UI反复打开不写世界。
- 真实Game仅crafting：启动一次→D1徒手取材→pick/table/hearth→D2金属→dagger、皮甲、口粮/套件；每个结果是原生Item或kit，正确stack/费用/时长/鉴定；原生饥饿/敌情继续。
- No/陈旧revision/伪actorId/错误owner/跨层/未见目标/无工具/工具破损/节点空或已预留/满背包/满箱/输出槽被占/ID预算/unsafe乘法；接收前零成本，接收后中断保已完成批、未完成退escrow/可检索托管且只一次。
- 真实命令save/load/replay/seek/续录，包括中途labor ticket、资源余数、台放置、确认答案、取消/伤害/离层。全每事件摘要和两RNG一致；不以planner/mock pass代替生产链路。
- 仅crafting、crafting+growth/narrative/combat/giants分别，以及crafting+既有四模块全开；settlement已合入时再测仅settlement/双开软工位兼容。生成零空间/giants reservation不抢占；剩余旧模块可物理删除后crafting仍通过相关fixture。
- Node24.19.0、3072MiB堆，boundary/type/build/自有及受影响门禁和真实组合按派发清单执行；开发期不擅自启动5Z全部删除矩阵。实际视口1440×900、390×844、320×844×普通/沉浸，四地图模式；手机数值/长名/取消/连点/blur/触摸与旧ACK/重放，真实与模拟设备分类，截图留仓库外。
- 交付完整包、自有配置手册、报告、机械fingerprint/SDK兼容标识、精确commit输入（提交由派发任务另定，当前5A0不提交）、实际命令/退出码/测试数量/自然trace、save/replay证据及明确未覆盖/待本地集成清单。不要发送未授权外部消息，本报告只是供维护者手动转贴的任务包草稿。

## 6 本步检查与修改范围

只新增 docs/ext/phase5a-contract.md、docs/ext/phase5a0.report.md、scripts/phase5a0-size-probe.mjs；未改生产源码/测试/数据、版本、package/构建配置、测试清单、黄金trace/生成基线，未commit/push。探针在固定副本上完整跑完exit0，hash前后一致；当前设计树942份开工已有的源码/测试/脚本/资源/配置逐文件校验不变，汇总SHA-256：

~~~text
ebaa831e98d40c9ea086a64ddbe8d0b35af226219b8b7604485ba7f52c4e3be6
~~~

交付检查包括：相对文档链接目标、代码块闭合、LF/冲突标记、C5各TS块组合的独立strict类型检查、探针语法、git diff --check和新文件的--no-index空白检查、探针未进入测试清单/构建、修改范围与未提交状态。已执行上述检查并通过；不跑npm功能/CE/drift/build整套，因为本步任务书仅要求文档和只读探针门禁，没有生产功能改动。没有把文档/代理体积通过当成5A功能或阶段3/4完整收尾通过。

| 实际检查 | 结果 |
| --- | --- |
| 9个C5 TS块提取到仓库外d.ts；Node24.19.0运行 TypeScript：--strict --noEmit --skipLibCheck false --lib es2022 --types node | exit0；只检查声明一致性 |
| node --check scripts/phase5a0-size-probe.mjs | exit0 |
| 当前实际getTestDiscovery：433个已发现测试文件/全部suite均无探针；tsconfig.node仅vite.config、app仅src | exit0；探针不进入测试/构建 |
| 两文档相对链接存在、代码围栏配对、三新文件无CRLF/冲突标记/无尾随空白 | exit0 |
| git diff --check / --cached --check；三新文件git diff --no-index --check检查 | 无空白错误；no-index exit1只是与/dev/null有新增差异 |
| 942已有输入逐文件hash，HEAD=87d92c8，tracked/staged diff为空 | exit0；没有commit |

最终只新增三个交付文件，另有用户原先的未跟踪任务书；原始JSON统计/日志及声明检查临时文件均在仓库外。
