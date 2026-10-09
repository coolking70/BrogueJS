# 5Y 第1轮独立审查

日期：2026-10-09。审查基线取自外部 `dispatch.json`：`a41ba6fc7cf6af29c1bc1260bf87fa4bfbf5c6d0`，分支 `ext/phase5`；结束时HEAD相同。作者已退出停写；本轮未修改生产、测试、配置、黄金，未commit/push、未启动代理。

**结论：发现1项确证的异步录制可靠性缺陷（R1-F1），交原作者修复。** 未发现本轮证据范围内的摘要算法/版本变更或通常路径的玩法、存档录像不一致。以下通过项不能覆盖R1-F1，也不等于全量通过。

## R1-F1（S2）：完成历史淘汰后，合法重复回包被误判为完整性错误

- 位置：`src/engine/Core/RecordingBackend.ts:44`、`:48`、`:54`；失败向Game传播的位置为 `src/engine/Core/Game.ts:3760`、`:3695`、`:3833`。
- 根因：backend只保存最近128个完成的boundary。第129个job完成后，首个合法身份从 `completed` 删除；若它的重复结果在同generation另有job待决时到达，既不匹配pending，也不匹配completed，遂调用 `failIntegrity('Unexpected checkpoint identity')`。这违反已批准的“重复结果不得重复补链、正确忽略”合同。
- 可复现触发：同一Game逐次 `executeCommand('escape')` 后调用 `exportRecordingAsync()`，通过真实 `computeCheckpoint` 完成每次临时末行job，共129次。在第130次导出job待决时，原样重送第1次结果。无需33280条命令：非周期末行导出也占据这个128项历史窗口。
- 实测：129次导出成功；合法重复boundary=1，待决boundary=130。第130次导出拒绝：`Recording integrity failure`，原诊断为 `Unexpected checkpoint identity`，区间1..130/domain=identity；`recordingInputBlocked=true`，下一wait不改变事件数/tick/RNG。`fallbackReason=null`，故不是正常运输降级。较早backend单独探针在129个周期job后重送boundary256，同样终止当前boundary33280。
- 影响：一次本应无害的迟到重复回包永久阻断本局机械输入、保存和导出，UI要求重新开始。已验证前缀没有被改坏；缺陷是错误关闭及可用性丧失。探针显式注入重复消息，**不声称原生浏览器Worker自然产生重复**，但重复消息处理正是本步明确要求支持的故障条件。
- 最小建议：采用有界的作业序号/完成水位等方案，使已提交并完成的旧job能永久按过期回包丢弃，同时保持当前未知身份/错身份失败关闭及两chunk上限；不要改成无界历史Set。补128→129淘汰边界以及频繁非周期导出回归，保留现有未知身份错误断言。修复后只跑受影响项。

## 合同核对与证据范围

已读仓库AGENTS、HANDOFF、development、architecture、完整5Y任务书、作者报告/READY、父浏览器摘要/脚本/结果及实际差异（含新增文件）。

- 完整冻结后，Worker/inline共用 `computeCheckpoint` → 原 `mechanicalDigest`；full使用新投影，未以事件缓存替代native/knowledge完整oracle。主线程投影及JSON/UTF-8、保留字节与transfer副本的所有权明确；2048发布取该job字节，未取较晚live世界。
- 身份/root/event域检查后按Map插入顺序补链；未验证边界使后续chain停在frontier。运输构造/post/crash/timeout回退仅一次；计算及身份错误进入失败关闭。R1-F1是其中确证的误判。
- save/export消费者立即设栅栏，等待机械命令与队列，串行冻结前缀及世界；IDB前await，持久写入使用局生命周期signal与身份检查。选定坏load、换局取消、饱和前置门控及存储取消用例独立复测通过。未另独立复测确认对话框/动画未完成时的全部消费者组合。
- 队列按机械输入入口最多2个未验证chunk；乱序结果保留在同一有界队列，取消/失败清队列并释放backend。字节副本随job持有，指标数组限128；既有完整录像数组和boundedSnapshots沿原策略。未独立测全时内存峰值。
- 九冻结文件已定位并对基线检查无差异：worldSdk、edibleSdk、worldEdible、kindKnowledge、actorNeeds、stats、testing/worldHarness、testing/forageHarness、testing/fixtures/forageFixture/index。U03状态合同未变；新状态在既有WeakMap内。RecordingDigest/Format/V4、WholeRunSnapshot、WorldCanonical、fingerprint、descriptor、模块descriptor及黄金无差异；256/2048和格式身份保持。没有要求逐字节封存或重建历史源树。

父补验已读，**属于父的真实Chromium生产Worker证据，非本轮独立复测**：待决2048并发save/export前缀一致并有快照，待决256下loadReplay及seek2048，换局取消，sent10/received9/errors0、pageerror0；最后一job按预期取消。不能再把已解除的启动阻断当缺陷。该脚本主要执行引擎入口，不覆盖所有UI点击/设备矩阵。

作者Node性能证据的脚本与结果已核读，未独立重跑：每档64个切点，分56个普通256点和8个2048点；完整边界成对取同一机械切点，full精确比较；普通wait/move/受控HP各80对。脚本统计boundaryMain加publish，包含冻结、编码、dispatch、回包补链；Worker/flush/2048及wire/RSS另列，没有拿历史5A3数字当基线。普通命令是在同一受控布景连续交替执行，没有逐对回滚整个Game，不能解释为每对完全相同的机械状态。

据作者表，Node两档完整256主线程P95降低约80%，普通新增P95≤5ms；D8投影35.428ms，2048主线程121.314ms。**这些是作者Node测量，浏览器D8性能、全时内存、自然最大世界与全面矩阵仍未验，继续5Z。** 不把100ms投影目标扩成2048总成本硬门限，不要求本轮补全矩阵。既有六全局失败未复跑/未修改；作者新增发现的旧replay_import_ui夹具及反事实仅按报告引用，不冒称独立归因。

## 本轮实际窄复核

统一Node路径前缀：`/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；`NODE_OPTIONS=--max-old-space-size=3072`。以下各批独立，不累加重叠统计。

| 实际命令 | exit | 实际结果 |
| --- | ---: | --- |
| `node node_modules/vitest/vitest.mjs run src/test/ext_recording_async.test.ts -t 'freezes before live|serializes multiple|fails closed for|ignores duplicate|preserves a pending|holds playback cadence' --maxWorkers=1 --no-file-parallelism` | 0 | 1文件8通过/11按-t未选；7.18s |
| `node node_modules/vitest/vitest.mjs run src/test/ext_recording_v4_storage.test.ts -t '5Y' --maxWorkers=1 --no-file-parallelism` | 0 | 1文件2通过/6按-t未选；4.07s，使用既有MemoryIndexedDB，不冒称真实浏览器IDB |
| `node --input-type=module`（stdin：esbuild在内存bundle实际RecordingBackend，129完成消息后重送首消息） | 0 | 1协议探针，观察到当前job拒绝/terminate1/fallback=null；不是完整Game或真实Worker验证 |
| `node --input-type=module`（stdin：下附真实Game探针） | 0 | 1真实Game探针，确证R1-F1及下一输入无tick/RNG变化；计算用生产纯函数，运输用消息注入 |
| `git diff --check` | 0 | 审前与收口均通过 |

Vitest启动提示无CE源码；本次选定用例不依赖CE，无因缺CE新增skip，表内未选数均来自-t。Vite SSR探针启动时附带WebSocket监听EPERM提示，但SSR装载及探针完整执行并exit0；未进入浏览器，不能将它算真实浏览器补验。只读探索中一次缺失 `vitest.config.ts` 和一次zsh无匹配通配符使相应读取命令exit1，随后读取实际 `vite.config.ts` 并显式路径复核完成，不计为测试失败或通过。

没有跑npm全套、full/gen/drift、全面组合/删除或性能长门禁；作者结果和父结果各按来源引用。本轮只写本报告、外部窄结果摘要及review-r1.READY.md，READY后立即退出停写。R2仅关闭本轮问题及审修新增缺陷，余项5Z；不自行修复或启动第三轮。

### 复现摘要归档

上文已记录触发、影响及实际结果；长期重复与真实Game频繁导出现已落为正式回归，见`src/test/ext_recording_async.test.ts`。依用户规则仅保留结果摘要，不在报告封存原探针全文。

## 原作者对R1-F1的回应（2026-10-09，作者自测，待R2）

已按原发现复现并修复；上文独立R1原结论、严重度与复现结果保持，不作作者自行关闭。完成历史128项Set已移除，改为连续传输请求号上界及原有界pending Map，已发但不再pending的旧编号忽略；同boundary重提交分配新编号，乱序仍精确匹配未完成请求。旧generation隔离、当前未知请求/错boundary/codec等完整性失败、两chunk门控及摘要算法/字节均保持；requestId仅在Worker传输外层回显。

正式新增128→129/真实Game131次非周期导出两项在修前均复现原错误（exit1，2失败/19按-t未选）；修后窄批exit0，16通过/9按-t未选，包括新6项及原错误身份断言。必要类型、boundary、build通过；更新生产Worker在Node真线程对同步inline/独立crypto的各域/root/chain/snapshotDigest单项通过，性能用例未执行。父已有真实浏览器功能补验保持；作者browser脚本新增--fix-r1原生Worker迟到重复窄模式，由父按需运行，不重跑或重建性能/全面组合。准确命令、成本及来源限制见[实施报告§6](phase5y.report.md#6-第1轮作者修复r1-f12026-10-09待r2独立核对)。

作者未commit/push、未开代理/审查；fix-r1.READY后立即停写。F1由父R2核对，之后最多一次末修收口，无R3。

## 第2轮独立窄复核（2026-10-09，最后一轮）

**结论：R1-F1独立关闭；本轮范围内无剩余确证修复问题。** 本轮仅复核完成历史淘汰问题及修复引入的风险，不重开第1轮完整审查。基线及结束HEAD均为 `a41ba6fc7cf6af29c1bc1260bf87fa4bfbf5c6d0` / `ext/phase5`；已读批准任务合同、原发现、`fix-r1.READY.md`、报告§6、作者实际修前后差量及父本修浏览器摘要/小结果。作者退出exit0记录在先，本轮未修改生产、测试、配置、黄金，未commit/push或启动代理。

### R1-F1关闭依据及修复接缝

- `RecordingBackend.ts:27-30,45-53,64-73`：删除完成历史Set，仅保留连续发放上界 `issuedThrough` 和原pending Map。编号处于已发区间且不在pending，表示该请求已结束，旧合法重复永久忽略；不再受128项淘汰影响。安全整数用尽时明确拒绝，不绕回或复用编号。
- 请求按 `requestId` 定位而非boundary定位。同边界重提仍发新编号；旧完成编号不能满足新请求。两待决乱序只删除实际返回的请求，低编号仍pending时不会被上界判断误丢弃。正式协议回归覆盖130项完成、128→129/129→130的首条重送及同边界两新请求逆序完成/再次重复；独立执行通过。
- 当前缺失/未发/非法编号仍失败关闭；当前请求错boundary在backend拒绝，codec/完整identity等仍经 `Game.enqueueRecordingCheckpoint` 原校验拒绝，不作运输回退。正式6项新增中4项当前失败用例及原未知boundary=900断言均独立通过；额外协议探针对8种非法编号确认拒绝、清pending、无inline降级。
- 旧generation判断仍先于编号路由；退休backend直接忽略。正式旧generation、换局取消用例及补充旧generation/缺编号组合均通过。Worker成功与计算错误外层都回显编号（`RecordingCheckpoint.worker.ts:4,8-9`），编号不进入纯计算返回identity及持久摘要。
- 真实Game正式回归逐条escape并导出，共131个非周期job；129/130/131待决时重送首回包，各次重复导出不新增job，最终完整录像与同步131条路径精确相等、RNG相等、failure为空、输入恢复、peakJobs=1。独立通过，关闭原129次后误拒当前导出的路径。运输为注入，计算为生产 `computeCheckpoint`；不声称原生Worker自然重复。
- Game既有两chunk门控/按序补链未改；独立选定乱序冻结回归确认第二结果先到时首边界仍未发布、饱和输入不消耗tick/RNG/事件、两结果完成后恢复。backend新增历史状态仅一个数值，上界不保留历史payload、Set或区间数组；完成删除pending，失败/退休清表，Game继续约束最多2个未验证chunk。这个结构判断支持长期历史内存有界，不冒称全时堆峰值已测。

已将作者日志中的两生产文件实际修前后diff与当前文件核对一致；变化集中于编号发放、路由及Worker回显。纯摘要算法、冻结投影、Game发布路径没有本修差量；原未知身份测试只补新外层实际编号，未放宽错误断言。未重建历史多版本，也未复制完整探针脚本。

### 本轮独立实际执行

环境沿用Node24.19 PATH前缀 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`、`NODE_OPTIONS=--max-old-space-size=3072`。各项独立，不累计重叠计数。

| 实际命令 | exit | 实际结果与边界 |
| --- | ---: | --- |
| `node node_modules/vitest/vitest.mjs run src/test/ext_recording_async.test.ts -t 'R1-F1\|ignores duplicate\|freezes before live\|serializes multiple' --maxWorkers=1 --no-file-parallelism` | 0 | 1文件9通过/16按-t未选，总25项；13.02s。含6项新增、原重复/旧generation/未知boundary、两chunk乱序门控、并发消费者/换局取消 |
| `node --input-type=module`（stdin：esbuild在内存加载实际backend的补充协议探针） | 0 | 1探针：8种非法编号失败关闭；旧generation先于缺编号判断；直接设置水位至安全整数末段，末个合法编号完成后下一请求拒绝、额外post为0、pending为0。仅backend协议，不是Game摘要、真实Worker或性能验证 |
| `git diff --check` | 0 | 审前、窄复核后及文档收口检查通过 |

8种非法编号为缺失、0、-1、小数、NaN、Infinity、超过安全整数上限、字符串。安全整数末段直接设置运行期水位，只验证新分支，不模拟实际执行约9千万亿个job。Vitest提示缺CE源码；选定用例不依赖CE，无因缺CE新增skip，16项均仅按-t未选。未跑作者整批、类型/build/boundary、drift、长性能或全量门禁；未再次申请或尝试浏览器。

### 引用范围与5Z分类交接

父 `parent-fix-r1-browser-summary.md` / `fix-r1-browser-result.json` 已读取，**仅引用父补验，非本轮独立复测**：最终生产Chromium Worker原生计算/回包131次、重复导出131次、第129/130/131待决注入首条真实回包3次，failure=null、Worker errors0、pageerrors0、peakJobs1，父命令exit0。它支持更新外层协议和迟到重复的真实浏览器窄路径，不扩称完整UI/设备/性能矩阵。

作者修前2项失败、修后16项通过、类型/boundary/build和更新生产Worker摘要单项仅按报告§6引用；本轮没有独立重跑这些整批或独立重做修前反事实。原R1、作者及父既有结果不改写、不合并为一次全绿。

交父编写5Z任务书的分类保持：**正确性：** 本修无剩余确证问题；**覆盖：** 浏览器D8/跨设备成对性能、全时内存/自然最大世界、全面UI/设备/组合/删除及全量兜底仍未覆盖；**成本余量：** 同步冻结/编码、2048发布、save/seek总成本沿原记录；**既有基线：** 原全局门禁失败及夹具归因继续独立登记，不被本轮9项通过覆盖。本轮不改5Z遗留文件或开启5Z实现，无需第三轮。父同轮至多必要末修一次后收口提交推送并准备5Z任务书；READY完成后本审查者立即停写退出。
