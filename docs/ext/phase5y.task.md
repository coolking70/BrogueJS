# 5Y 摘要卡顿优化任务书（已批准，前置修复与集成后执行）

日期：2026-10-09。准备基线：`ext/phase5` / `5b5edbe`（5E1实现 `a9f554b`）。**用户已批准Y1-A、Y2-A及100ms目标补充；前置底座`35045d9`、固定giants2集成`2709250`已审修推送；5Y已于`a4932d1`完成两轮审修并推送，实际开工HEAD为`a41ba6f`，见报告与状态卡。** 开工时记录实际HEAD，不把文档提交视作批准。

## 1 目标与已定范围

依[5A3报告 §7.5](phase5a3.report.md#75-worker异步摘要管线接口草案后续步骤未实现)，将每256条已完成命令的完整摘要计算移出主流程：机械边界冻结独立投影 → Worker后台计算 → 按命令顺序验证/补链 → 存档、导出、seek等消费者先flush。无Worker时内联回退。**同一机械状态和输入下，全部摘要字节必须与当前同步实现完全相同。** 不改256/2048周期、摘要算法、域/叶排序、格式版本、世界规则或随机流，不以重录黄金消除差异。

用户已定：5C2营地选址、5D3叙事招募均放到阶段5之后，不是5Z前交付；5D3随narrative扩充考虑。giants2验收结论已收到：先在ext/phase5修复三项底座问题并推送，再合入`357a473`、在giants目录修复旧D12五项路线前提并验收推送，然后启动5Y；5Y完成后再准备5Z任务书；本步不擅自开启5E2、5C2、5D3或5Z实现。

这里的“摘要”是录像完整性哈希，不是营地离场经济结算；5E1被围暂停与解围不追补规则不改。

## 2 开工前待决清单

**用户已确认Y1-A、Y2-A。** 下表保留原备选作决策记录，不再询问。Y2的“完整边界主线程P95至少减半”为保底线；优化目标为**D8满结构时主线程边界冻结投影P95≤100ms**。报告分别写保底指标、投影实测值及2048成本；未达100ms时分解剩余耗时点登记5Z，不扩大本步范围。普通命令新增P95≤5ms保持。

| 编号 | A（推荐） | B | 推荐理由 |
| --- | --- | --- | --- |
| Y1：后台积压时如何处理输入 | 最多2个待决chunk；满额后在下一条机械命令开始前暂缓接受输入/自动步进，界面继续绘制，清空后恢复 | 同样最多2个chunk，满额时在主线程内联补算后继续 | A保持内存有界且避免积压再次变成长卡顿；代价是极端负载下会短暂停等 |
| Y2：本步性能收口标准 | 同机同布景成对测量，256完整边界主线程P95比同步对照降低至少50%，普通命令成对新增P95≤5ms；2048另列，残余投影卡顿如实登记 | 在A基础上，要求最大结构布景的256和2048边界主线程P95都≤50ms，必要时扩充投影/快照优化 | A先交可验证的后台摘要收益，保留同步冻结成本；B可能把本步扩大为全快照投影优化 |

Y1的暂缓不是把输入记录为一次空操作：不得消耗tick/RNG/ID、丢弃已接受命令、重复执行或补造录像。界面提示走i18n，不通过会打断自动行动的机械日志输出。Y2不允许把Worker耗时、flush等待或2048峰值藏进“普通命令”。

## 3 当前实现与需要接通的消费者

只读勘察基于准备HEAD；执行者开工复核符号，不依赖行号。

| 现有入口 | 当前行为 / 本步要求 |
| --- | --- |
| `Game.updateRecordedCheckpoint` | 命令机械结算、增量event域摘要后，同步`projectWholeRun`+`mechanicalDigest`，每2048条复制world并计算snapshot哈希；保结算顺序，只分离只读冻结后的计算 |
| `RecordingDigest.ts`、`WorldCanonical.ts`、`ext/fingerprint.ts` | canonical/Merkle/SHA唯一算法；Worker与inline共用同一纯计算实现，保持独立full校验，不以脏叶缓存代替full |
| `recordInputEvent` / `finishRecordingPrefix` / `exportRecording` | 导出在非256末行补临时full，续录会撤销它；异步化仍须保证不同保存频率不改变最终命令链 |
| `toSaveSnapshot`、来源镜像、`SaveStorage`、`RecordingStorage` | 世界与唯一录像前缀原子保存；先flush/冻结同一逻辑切点再开IndexedDB事务，不能在事务中等待Worker |
| `loadReplay` / `replayStep` / `replaySeek`及trustedSnapshots | 先处理旧generation，再验证/使用当前来源；2048快照仅在对应checkpoint及snapshot哈希验证后受信任 |
| `App.vue` / `ui/recordingExport.ts` / 菜单、GameCanvas输入与自动步进 | 已有异步保存/导出壳仍调用同步引擎方法；补真实await、输入门控及await后局身份复检，不在UI投影中执行机械命令 |
| 内部`recordingState`、U03与digest合同 | 队列/frontier/generation/backend属于运行期派生状态，不进入世界持久根；新增Game字段须登记U03，优先沿现有内部状态 |

5A3历史满结构256/2048合计8点的完整checkpoint P95约810.9228ms，属于旧版本历史结果，**不能作为本步同步基线，也不能据8点宣称新P95**。本步在同一最终实现选择inline/Worker做对照，不封存或重建历史多版本源树。

## 4 后台与冻结合同

- 内部backend提供`enqueue(job): Promise<CheckpointResult>`、`flush(): Promise<VerifiedFrontier>`及取消/释放能力；名称可按仓库风格调整。浏览器使用真实Worker；headless/无Worker使用同算法inline适配，测试可注入延迟/乱序/失败backend。
- job携带session generation、job/boundary ID、codecIdentity、manifestFingerprint、boundaryCommand、previousVerifiedBoundary、边界inputState、event域摘要及是否为2048快照边界。冻结的是完整独立world投影及其确定的编码数据（按草案可用UTF-8）；不得把live Game、实体、RNG、getter、UI或可写context交给后台。
- 明确投影/clone/canonical/UTF-8/传输/计算分别在哪一侧发生及所有权。保真冻结必需的工作留主线程，纯canonical/哈希尽量在Worker。若先编码UTF-8，不能先在主线程算完全部canonical/哈希再把余量称为卸载；编码成本计入主线程指标。transfer只移动job独占buffer，不detach活局或其它消费者数据。
- 取投影前保持原机械边界完整：结构/居民/袭击等结算与event摘要时点不变。边界之后活局继续变化不能改变job；非活动层/native/knowledge仍做独立完整计算，不借事件缓存绕过oracle。
- 结果带回generation/boundary/codec/manifest身份、完整分域/root摘要及可选world/snapshotDigest；只接纳当前generation且确属待决job的结果。旧局回包忽略，重复结果不得重复补链，错身份/错边界明确失败。
- 维护已验证frontier与暂存事件payload；full未完成时不生成虚假chainDigest，不把未验证事件或快照暴露为可持久完整录像。即使乱序完成也按原命令序补链。
- 2048快照与该边界冻结投影一致，`savedAt=0`等原规范保持，boundedSnapshots保留策略不改；只能在前缀校验成功后进入trusted集合。不从较晚的live world补做较早快照。

## 5 flush、取消与错误

- flush覆盖调用时确定的命令切点：先等待正在执行的机械命令/确认按现有规则结束，再建立短暂输入栅栏，排空到该切点并冻结世界、inputState和前缀的一致副本。await期间不能让保存世界与前缀错位；多个保存/导出请求串行或共享同一验证工作，不重复交付。
- 必须接通：保存及覆盖保存、录像导出/库写入、recordingOrigin来源镜像、IndexedDB、seek/trustedSnapshot消费、读档/新局/清空录像/销毁时的旧队列处置。await后复检局generation与请求身份，不能把旧局成功回包写进新局。
- 同步`toSnapshot`诊断世界投影可以保留；同步headless公开口沿inline实现。Worker模式提供明确异步持久入口；若有人误用同步入口且仍有待决job，必须明确拒绝/报告pending，不能默默返回不完整数据或全局改成假同步。冻结九SDK签名不改，测试通过内部适配接异步口。
- 录制与UI回放/seek均不能因后台顺序改变命令、输入状态、机械tick或两条RNG。先flush当前需要保留的来源，再换generation；明确的放弃旧局操作可以取消未保存队列，按原确认语义处理。失败load不得先退休原活局或破坏其录制session。
- Worker不支持/构造失败/加载失败、postMessage失败、运行期崩溃或超时：持有原冻结payload，有界地转inline重算未完成job并降级本session，释放Worker/队列，不无限重试。超时只影响调度，不能影响机械结果；默认30秒为可逆调度值，报告实际触发原因。
- event域与full不一致、计算结果身份错误或inline同样失败：记录`(previousVerifiedBoundary, boundaryCommand]`与域，保留原诊断；停止后续机械输入/录制扩展，拒绝保存、导出、续录及trusted快照发布。不能通过回退刷新event摘要或删掉坏边界伪装成功。纯传输故障和完整性错误必须区分。
- 队列按Y1执行，默认上限2个未验证chunk；事件payload、投影/快照副本和乱序结果同样有界，结果消费/取消后释放大buffer。测量最大暂存字节和并存副本数，不只限制Promise数量。局dispose/新局/失败收尾后无遗留Worker或悬空flush。

## 6 必验测试与性能

1. **逐字节不变**：保留当前同步机械摘要作为基准路径；同一冻结投影用inline、真实Worker及独立Node crypto/既有canonical向量核验各域、root、chain、snapshotDigest精确相等。旧黄金/版本身份保持，禁止为此重录。仅`recordedAt/savedAt`这类既有墙钟非摘要字段按原规则固定或排除，不放宽摘要相等。
2. **边界**：0、1、255/256/257、511/512、2047/2048/2049及非周期末行；保存→继续→导出、重复导出、启用/不带快照的输出与同步路径一致。一次至少跨两个2048点，不能只测mock消息。
3. **真实Game组合**：classic、settlement单独、settlement+combat、七模块当前全开；已有5E1被围→返回→解围、结构损伤、离场生产、原生迁层取代表路线穿过完整边界，save/load/replay/关键seek/续录无OOS且随机流保持。不是本步重跑128子集。
4. **异步调度**：冻结后活局变更、延迟/乱序/重复结果、旧generation、多个flush、请求期间换局、取消、队列饱和、Worker不可用/崩溃/传输异常/超时与inline回退；验证输入精确一次和内存上界。
5. **失败原子性**：损坏full/身份/快照、event/full不一致、错误load与IDB失败均不得发布半可信前缀、覆盖旧保存或泄漏到新局；failure区间与域可定位，不靠日志文字冒充保持原状态。
6. **真实浏览器Worker**：验证生产build中的Worker入口/加载及一次真实256/2048路线，验证保存/导出/seek等待与新局取消。无Worker路径单独测试；纯mock或Node通过不能称浏览器Worker交付通过。若环境阻断，如实登记未验，提交维护者裁决，不无限补截图/封存，也不宣称性能达标。
7. **性能**：最终实现同机同布景、inline/Worker交替成对测量，测试/构建串行；classic与8层3072结构/12288部件合法布景。每档至少32个256边界，2048至少8点单列样本数和max/中位/P95；普通wait/move/受控HP写入分别列。统计包含冻结、编码、传输及回包补链的主线程占用，同时列Worker耗时、flush等待、2048快照成本、峰值暂存字节及队列饱和次数。按Y2已批准保底门槛裁决；额外报告D8满结构冻结投影P95≤100ms目标的实测值，未达目标列耗时分解并登记5Z，不扩大本步范围。不把历史5A3数字当本步成绩。

## 7 修改范围与限定门禁

允许窄改Game录制/消费者接缝、RecordingDigest/RecordingV4相关内部类型、纯后台计算与backend/Worker新文件、保存/录像存储与UI输入栅栏、i18n、U03/digest合同和相关测试归属；不改原生规则、扩展数值、5E1玩法、九冻结SDK、黄金、manifest/format版本或模块发现方式。Worker不得import有副作用的Game/UI全局，只接纯数据计算。编译打包若需窄配置变更须在报告解释，不升级依赖作为默认方案。

正式实现至少运行：`npm run check:modules`、`node node_modules/vue-tsc/bin/vue-tsc.js -b`、`npm run build`、实际`npm run test:drift`；新增异步测试及受影响`ext_recording_v4_{digest,snapshots,storage}`、`u_03_whole_run_snapshot`、`u_27_recording`、`x2a_recording_checkpoint`、`ux_1d_recording_continuation`、`main_menu_replay_seek`、`replay_import_ui`、`perf_2_replay_cadence`，受影响UR黄金/5E1录像和源码守卫按实际改动明确到文件。首次报告列准确命令/exit/计数；修复后只跑受影响项，不重复整批。完整npm/test:ext、128子集、物理删除和全面设备矩阵留5Z。

环境沿用Node24.19 PATH、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest单worker优先、重门禁串行。每步最多两轮独立审查→原作者修复；第2轮后余项按正确性/覆盖登记5Z，不开第3轮。只存结果摘要，不逐字节封存或多版本重建；“摘要值逐字节不变”是程序断言要求，不等于保存原始大文件。

## 8 派发与收口

§2已确认，giants2底座修复及合入验收推送完成后才派单一本地CLI执行进程，默认`gpt-6.1-sol/high`；执行者不commit/push。完成后独立进程审查，发现交原会话resume；每个子进程结束由维护者在同轮立即推进下一环节。最多两轮后维护者核对、登记、提交推送`ext/phase5`，不动其它分支。每完成一步或满6小时更新状态顶部≤5行。报告为`docs/ext/phase5y.report.md`，审查为`docs/ext/phase5y.review-findings.md`，实施与两轮审查报告现已交付，结果和遗留以实际报告为准。
