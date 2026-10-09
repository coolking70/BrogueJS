# 5Y 摘要卡顿优化实施报告（作者交接，未提交）

日期：2026-10-09。实际开工 HEAD：`a41ba6fc7cf6af29c1bc1260bf87fa4bfbf5c6d0`，分支 `ext/phase5`，开工工作树干净。前置底座 `35045d9` 和固定 `357a473` 集成 `2709250` 已完成父审修推送；本步依已批准 [5Y任务书](phase5y.task.md) 的 Y1-A / Y2-A 执行。执行记录目录：`/private/tmp/brogue-commander-20261009-5y`。唯一本地作者实施和验证，未启动代理/独立审查，未 commit/push。

维护者已完成两轮独立审修并核对收口：摘要及异步回归通过，类型/模块边界/build通过；限定批保留原基线失败，作者子进程的真实浏览器权限阻断已由维护者在停写后补验解除，见末节。Node真实生产Worker成对性能满足本机保底指标及投影目标，**不能据此宣称浏览器Worker交付或浏览器性能达标**。未发现作者已确认而未修复的本步正确性缺陷；R1-F1已由原作者修复并经R2独立关闭；无本步剩余确证缺陷，发布记录见状态卡。

## 1 实现与边界

新增 `RecordingCheckpoint.ts` 纯计算入口、生产 `RecordingCheckpoint.worker.ts` 和 `RecordingBackend.ts`。Worker仅收到独立UTF-8完整world投影、inputState、event摘要及generation/边界/前一验证边界/codec/manifest/snapshot身份；没有Game、实体、RNG、getter或UI能力。主线程保持原机械结算及event域摘要顺序，然后 `projectWholeRun` → JSON编码 → UTF-8 → job专属transfer副本；Worker解码后调用原 `mechanicalDigest` / canonical / Merkle / SHA，2048同一冻结world按原规则设 `savedAt=0` 再计算snapshotDigest。没有用脏叶或event缓存替代独立full oracle，没有先在主线程完成canonical/full再伪称卸载。

Game沿已有录制WeakMap存backend、generation、最多两待决chunk、按序验证frontier、栅栏、取消signal与有界指标。结果先检查完整身份、域哈希形状与root及event/full一致，再按原命令次序发布full和chain；乱序完成留在队列，未完成边界及其后链留空而不能导出。2048快照由该job的原字节解码发布，boundedSnapshots策略保持；seek消费仍独立核对snapshot hash、full及prefix后才加入trusted集合。重复回包不重复补链，旧generation回包隔离。

队列达两chunk、消费者栅栏或完整性失败时，在 `executeCommand` 第一行门控，`executeItemCommand`仍经过该入口；GameCanvas自动步进和回放cadence同步门控，不生成空输入、不消耗tick/RNG/命令ID、不补造事件。UI等待/错误提示用两项中文i18n键，不经机械logger。确认响应与已接受命令的动画推进继续原路径，flush不替玩家回答或推进时间；正常命令结束后消费者读取一致切点。

`exportRecordingAsync`、`toSaveSnapshotAsync`、load/seek异步入口以立即栅栏串行消费者，等待已接受命令及队列，freeze世界/inputState/完整前缀；非256末行仍补临时full，续录仍撤销该临时full而保持最终链。App保存/覆盖、库写入、来源镜像、导出/download、读档/回放/seek接真实await，IO前后复检epoch/generation。Worker等待在IndexedDB事务之前；事务期间generation取消以AbortSignal在native commit之前abort，保留旧保存。候选坏档验证失败不先退休活局；成功读档、新局、清空及销毁取消旧backend。无Worker/headless默认保留原同步inline公开口；Worker pending误用同步save/export/seek，以及合法同步load，均明确拒绝；快照load在身份/来源预检后、实体解码前拒绝pending，回放候选预检有原服务恢复保护，拒绝均不耗ID/tick/RNG；坏load仍保持原session。

Worker构造/postMessage/崩溃/解码运输错误/默认30秒超时只对本session一次有界inline降级，使用保留的原payload并释放线程与定时器。计算、身份、full/root/snapshot协议或event/full错误不走运输降级：记录原错误、区间和域，abort持久消费者、停止输入、拒绝保存导出续录与可信快照。同步冻结或inline计算同样失败关闭。

Game无新增自有持久字段，派生状态不进入世界根；U03合同无须改登记。九冻结SDK、黄金、256/2048周期、whole-run6 / recording4 / origin2 / foundation13、manifest及模块格式、随机流、原生/扩展规则均未修改。编译配置和依赖未修改。

## 2 验证覆盖与真实浏览器限制

正式新增 `ext_recording_async.test.ts`（最终19项），模块归属 `settlement_raid_async.test.ts`（2项），存储回归追加2项，均登记原测试套件。覆盖0/1/255/256/257/511/512/2047/2048/2049/4096/4097、非周期末行、save→继续→export、重复/不带快照导出、两个2048快照、save/load/replay/seek及RNG一致；同步与异步inline摘要、chain、快照逐字节断言不放宽。classic、settlement、settlement+combat、七模块当前全开都经过真实Game；被围→原生返回→解围、结构损伤、离场生产及原生迁层代表路线跨256，原录像路线同时保留通过。

延迟/乱序/重复/旧generation、冻结后live变更、多消费者、换局取消、满队列前置拒绝、full/身份/event/snapshot损坏、同步冻结失败、坏load及IDB事务失败/换局提交前取消有正式测试。四种运输故障（构造/post/crash/timeout）实际触发有界降级；测试超时注入为5ms（生产默认30秒）；消息解码错误沿同一运输处理入口，未另独立注入一项。无Worker公开同步路径单独断言。源码守卫保留，未改变守卫或旧断言语义。

生产build生成 `dist/assets/RecordingCheckpoint.worker-C291Om_A.js`（69971字节）。外部Node24 `worker_threads`桥只供Web Worker消息全局，直接加载这份生产bundle，实际跑两档各64完整切点及真实两chunk饱和，不是替代计算的mock。另一真实生产Worker2048探针对同一冻结投影核对原同步full、inline结果、独立Node crypto替换SHA后所有域/root、snapshotDigest精确一致；chain另以Node crypto直接散列原canonical payload核对。已有canonical/Node crypto向量守卫通过。

真实浏览器实际尝试：Vite preview监听127.0.0.1:5195被EPERM拒绝；为避监听限制，Playwright route直接供生产dist，Chromium启动仍被 `MachPortRendezvous bootstrap_check_in Permission denied (1100)` 拒绝；技能原web-game客户端同样失败。未进入页面、没有真实浏览器Worker加载或256/2048/save/export/seek/新局取消证据，没有截图。未以mock或Node通过充数。重大覆盖阻断记录外部 `BLOCKED.md`，交父裁决，不请求已定设计或无限补采证。

## 3 最终代码成对性能（Node，不作浏览器交付裁决）

Node v24.19.0，同机串行、3GiB堆上限、Vitest单worker。classic与合法D8测试布景：8层3072格结构/12288部件，生产schema/root/reference/persistence校验及save→load通过；这是受控满结构布景，不声称自然8层世界或全面设备负载。每档64个256机械切点，分列56个普通完整边界及8个2048点。相邻inline/真实生产Worker交替对同一个冻结机械切点计算，中间不夹命令/tick/RNG，并核对full精确一致；第二次通过同一内部录制入口重算切点。普通wait/move/受控HP分别80对，避开完整边界计时，受控HP由executeCommand回调写入。

完整主线程边界包含原结算/event摘要、完整投影、JSON/UTF-8、dispatch和回包验证补链，2048包含原字节解码/快照发布。inline在同一最终实现选择inline backend；dispatch区间因此包含inline计算，不能把该列称纯传输。指标为最近128个观测的有界派生数组；取对应切点两阶段实际占用和，不把异步等待当主线程占用。Worker侧冷线程创建在计时外但compute及flush保留其启动/竞争成本，这比长驻暖线程保守。无历史5A3版本树或历史810ms数字参与基线。

单位ms；每格为中位 / P95 / max。

| 布景 / 完整边界 | n（每模式） | inline主线程 | Worker主线程 | P95降低 |
| --- | ---: | ---: | ---: | ---: |
| classic / 256（不含2048） | 56 | 50.701 / 57.341 / 70.633 | 10.112 / 11.094 / 11.386 | 80.65% |
| classic / 2048 | 8 | 92.011 / 94.188 / 94.188 | 17.193 / 17.709 / 17.709 | 81.20% |
| D8 / 256（不含2048） | 56 | 343.529 / 383.519 / 425.666 | 65.026 / 71.567 / 78.680 | 81.34% |
| D8 / 2048 | 8 | 606.452 / 654.262 / 654.262 | 112.332 / 121.314 / 121.314 | 81.46% |

Node完整256边界P95保底减半成立，两档均降低约80%。D8 Worker冻结投影（projectWholeRun）P95 35.428ms≤100ms；JSON/UTF-8编码P95 35.338ms仍留主线程。2048主线程P95 121.314ms单列，并未把它藏进普通命令或声称2048≤100ms。真实浏览器未验，以上数值只说明本机Node生产线程结果。

| 布景 / 普通命令 | n对 | inline | Worker | 成对新增（Worker-inline） |
| --- | ---: | ---: | ---: | ---: |
| classic / wait | 80 | 3.126 / 3.628 / 10.596 | 3.213 / 4.760 / 7.388 | 0.067 / 1.223 / 4.172 |
| classic / move | 80 | 2.596 / 3.253 / 4.091 | 2.606 / 3.342 / 5.035 | -0.005 / 0.730 / 2.723 |
| classic / hp | 80 | 0.024 / 0.052 / 0.059 | 0.025 / 0.094 / 0.140 | 0.002 / 0.035 / 0.114 |
| D8 / wait | 80 | 5.787 / 6.417 / 11.257 | 5.793 / 6.607 / 8.204 | 0.023 / 0.716 / 2.287 |
| D8 / move | 80 | 5.750 / 6.301 / 6.887 | 5.847 / 6.822 / 11.247 | 0.086 / 1.114 / 5.824 |
| D8 / hp | 80 | 0.094 / 0.111 / 2.154 | 0.096 / 0.109 / 0.136 | 0.002 / 0.007 / 0.026 |

普通命令成对新增P95均≤5ms。D8 move新增max 5.824ms如实保留，max不是P95门限，不隐去长尾。

下表均64个完整边界（含8个2048），单位ms。2048在回包侧解码世界/快照发布会造成publish长尾，不能把下面64点的P95当普通256专属值。

| 布景 / 成本 | inline中位 / P95 / max | Worker中位 / P95 / max |
| --- | ---: | ---: |
| classic / 冻结投影 | 3.534 / 4.000 / 10.615 | 3.572 / 4.048 / 4.823 |
| classic / JSON/UTF-8 | 6.143 / 6.448 / 11.125 | 6.293 / 6.699 / 7.152 |
| classic / dispatch（inline含计算） | 40.931 / 75.453 / 77.372 | 0.103 / 0.231 / 0.292 |
| classic / 回包验证/补链/快照发布 | 0.045 / 7.124 / 7.615 | 0.063 / 7.213 / 7.588 |
| classic / 纯计算（Worker侧含解码/快照hash） | 40.892 / 75.431 / 77.348 | 57.837 / 93.112 / 94.933 |
| classic / flush实际等待 | 0.003 / 0.005 / 0.010 | 59.736 / 100.750 / 103.009 |
| D8 / 冻结投影 | 31.922 / 34.680 / 35.716 | 31.747 / 35.428 / 41.660 |
| D8 / JSON/UTF-8 | 33.403 / 35.342 / 36.301 | 32.733 / 35.338 / 36.139 |
| D8 / dispatch（inline含计算） | 281.039 / 517.217 / 533.133 | 0.462 / 0.912 / 1.343 |
| D8 / 回包验证/补链/快照发布 | 0.063 / 50.711 / 53.094 | 0.077 / 49.440 / 50.796 |
| D8 / 纯计算（Worker侧含解码/快照hash） | 280.985 / 517.135 / 533.057 | 333.358 / 566.927 / 583.514 |
| D8 / flush实际等待 | 0.003 / 0.005 / 0.006 | 333.964 / 617.667 / 635.185 |

| 布景 | 最大队列 / 饱和次数 | 两chunk wire副本峰值（字节） | 样本RSS峰值 / 主线程heap峰值（字节） | 饱和点RSS / heap（字节） | 饱和排空等待ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| classic | 2 / 1 | 8028212 | 565067776 / 252850568 | 701579264 / 308841144 | 75.078 |
| D8 | 2 / 1 | 53043056 | 1171537920 / 622957816 | 1250508800 / 363088488 | 511.284 |

wire峰值计保留UTF-8及transfer专属副本，各job两份，共最多四份大字节buffer；D8两chunk为53043056字节（约50.586MiB）。另有每job主线程冻结投影/编码临时对象和Worker解码世界/canonical临时对象，2048发布时主线程再解码一份，完成/取消后队列不持有大buffer。snapshot仍受原boundedSnapshots约束。RSS包括进程线程，heapUsed仅主线程，表中抽样峰值不是精确全时刻内存极值或浏览器堆。两chunk饱和各实际一次、待决事件窗口最多512条，已有全录像事件数组不算新增无界payload副本；实测饱和下一输入不进入录像，flush后恢复。D8饱和排空511.284ms及约1.25GB RSS均保留。

残余主线程成本为完整投影、JSON/UTF-8和2048回包解码/快照发布；存档自身的完整投影、既有来源验证/序列化、长seek独立oracle成本也继续存在，本步未声称save总延迟/seek总延迟优化。未扩大到投影结构优化或5Z实现，浏览器设备/真实最大世界及这些余量登记5Z。

## 4 实际门禁、失败与反事实

统一执行环境：Node24.19 PATH前缀为 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；`NODE_OPTIONS=--max-old-space-size=3072`。直接调用的Vitest统一追加 `--maxWorkers=1 --no-file-parallelism`，重门禁串行。每个表格批次独立，不累加重叠通过数。任务指定范围内未跑完整npm/test:ext、full/gen、128组合或物理删除矩阵。

限定20文件准确命令（后缀未省略）：

```sh
node node_modules/vitest/vitest.mjs run src/test/ext_recording_v4_digest.test.ts src/test/ext_recording_v4_snapshots.test.ts src/test/ext_recording_v4_storage.test.ts src/test/u_03_whole_run_snapshot.test.ts src/test/u_27_recording.test.ts src/test/x2a_recording_checkpoint.test.ts src/test/ux_1d_recording_continuation.test.ts src/test/main_menu_replay_seek.test.ts src/test/replay_import_ui.test.ts src/test/perf_2_replay_cadence.test.ts src/test/u_r2_trace.test.ts src/test/u_r3_trace.test.ts src/test/u_r4_trace.test.ts src/test/x3b_display_recording.test.ts src/ext/modules/settlement/tests/settlement_raid_replay.test.ts src/ext/modules/settlement/tests/resident_production_replay.test.ts src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts --maxWorkers=1 --no-file-parallelism
```

最终受影响窄批准确命令：

```sh
node node_modules/vitest/vitest.mjs run src/test/ext_recording_async.test.ts src/test/ext_recording_v4_storage.test.ts src/test/u_03_whole_run_snapshot.test.ts src/test/ux_1d_recording_continuation.test.ts src/test/main_menu_replay_seek.test.ts src/test/perf_2_replay_cadence.test.ts src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts src/ext/modules/settlement/tests/settlement_raid_async.test.ts --maxWorkers=1 --no-file-parallelism
```

其余准确命令及实际结果：

| 命令 | exit | 结果 / 用时 |
| --- | ---: | --- |
| `node node_modules/vitest/vitest.mjs run src/test/ext_recording_async.test.ts src/ext/modules/settlement/tests/settlement_raid_async.test.ts --maxWorkers=1 --no-file-parallelism` | 0 | 2文件18项通过（当时async16+模块2）；141.599s |
| `node node_modules/vitest/vitest.mjs run src/test/replay_import_ui.test.ts -t 'accepts the newly' --maxWorkers=1 --no-file-parallelism` | 1 | 1失败 / 3仅按-t未选；原HEAD同一UI夹具断言；2.973s |
| `node node_modules/vitest/vitest.mjs run src/test/ext_recording_async.test.ts src/test/perf_2_replay_cadence.test.ts --maxWorkers=1 --no-file-parallelism` | 0 | 2文件27项通过（async19+cadence8）；51.209s |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 0 | 最终类型通过；8.890s |
| `npm run check:modules` | 0 | 模块边界与测试归属通过；2.628s |
| `npm run build` | 0 | 生产build通过；保留原>500kB bundle警告；12.514s |
| `node node_modules/vitest/vitest.mjs run --config /private/tmp/brogue-commander-20261009-5y/perf.config.mts --maxWorkers=1 --no-file-parallelism` | 1 | 成对性能1通过，附加crypto探针1失败：误读扁平recording.header.codec；只修外部探针前提后上述窄测通过；71.986s |
| `node node_modules/vitest/vitest.mjs run --config /private/tmp/brogue-commander-20261009-5y/perf.config.mts -t 'production Worker full' --maxWorkers=1 --no-file-parallelism` | 0 | 1通过 / 1仅按-t未选；真实生产Worker对独立crypto；2.910s |

限定20文件首批exit1：17文件通过/3失败，153项通过/3失败，用时421.421s。最终受影响11文件批exit1：10文件通过/1失败，119项通过/1失败，用时212.533s，唯一仍失败为既有i18n解析。补failure signal取消和回放fence cadence后，受影响async/cadence27项及types/boundary/build通过；随后收口发现合法同步load仍可越过pending，加入身份/来源预检后的拒绝并仅复核受影响项，见末节。未重复未受影响整批。

失败保留与归因：

- `p1_30_i18n_gate`原4处动态调用（MainMenu:382两调用、StructureProduction:1040两调用）与最新giants报告相同，本步两新键及调用可静态解析，没改守卫。
- `u_r4_trace`原chain黄金失败保持，沿父报告52链叶旧协议归因，无重录、无黄金修改。原phase4a0完整图4项本步未重跑，仍按父报告保留，不能被本步有限通过覆盖。
- 本步首次跑到旧 `replay_import_ui` 的foundation12 39条夹具失败：在实际导入前的public录制对fixture断言（:99）就失配。只把本步8个既有生产文件就地回退开工HEAD，单跑该用例，仍同一失败；318行归一摘要差量完全相同。finally已恢复当前修复字节；没有多版本树或Git索引操作，没有把夹具、黄金或断言语义改成绿。新增登记这一原基线发现供父专项归因。

作者实施中实际失败不隐藏：首轮手工types因Array.at与项目lib不符、次轮新测试引用private长度失败；初次build exit2为新测试private访问；改公开events.length后build通过。后续types-refined exit2为模块新测试unused imports/unknown参数，修测试类型前提后最终类型通过。最早手工shell末尾cat掩盖了types进程错误码，绝不计为通过；后续包装保真实exit。首版async单文件13项通过；组合18项通过，之后新增前提错误/快照损坏/节奏回归，最终async19项通过。

外部性能最初3次exit1只因D8布景漏level/persistenceReasons，不是生产规则守卫放宽；补合法生产布景后1项通过。早期分段性能不能作为最后完整边界成绩，最终性能使用本报告§3；最终附加crypto探针误读扁平header的一次exit1按原结果保留，只修外部前提、过滤重跑该一项通过。上述测试前提修正没有更改旧守卫/黄金或生产格式。

## 5 收口复核与交接

| 准确命令 | exit | 实际结果 / 用时 |
| --- | ---: | --- |
| `npm run test:drift` | 0 | 7文件14项通过；首次裸脚本为默认文件并行，保结果但不作单worker合规成绩；58.331s |
| `npm run test:drift -- --maxWorkers=1 --no-file-parallelism` | 0 | 7文件14项通过；显式单worker/文件串行，最终合规drift；153.893s |
| `node node_modules/vitest/vitest.mjs run src/test/c_4a_terrain_catalog.test.ts -t '留痕' --maxWorkers=1 --no-file-parallelism` | 0 | 1文件3通过 / 27仅按-t未选；未跑其gen部分；2.138s |
| `node node_modules/vitest/vitest.mjs run src/test/ext_recording_async.test.ts src/test/ext_recording_v4_snapshots.test.ts src/test/main_menu_replay_seek.test.ts --maxWorkers=1 --no-file-parallelism` | 0 | 3文件40项通过，async/snapshots/menu-seek；81.880s |
| `node node_modules/vitest/vitest.mjs run src/test/ext_recording_async.test.ts -t 'preserves a pending' --maxWorkers=1 --no-file-parallelism` | 0 | 1通过 / 18仅按-t未选；拒绝前移到实体解码之前后确认ID/tick/RNG不变；2.787s |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 0 | 末次类型通过；9.068s |
| `npm run check:modules` | 0 | 末次模块边界/归属通过；2.374s |
| `npm run build` | 0 | 末次生产build通过，原大bundle警告保持；12.294s |

首次裸drift脚本未附单worker参数，已实际用显式参数重跑，保留第一次结果，不掩盖运行方式偏差。收口load防线仅改pending加载接缝，未改已计时的机械边界、后台算法、回包发布或普通命令路径；最终build的Worker仍为上述同一 `C291Om_A` 生产文件，没有重跑未受影响性能矩阵或限定20文件批。

最终 `git diff --check` 通过，全部变化文件无CRLF/无>1MiB原始证据，套件/i18n JSON可解析；九冻结SDK逐字节等于开工HEAD，黄金/格式/manifest与U03登记未改。HEAD保持开工值，索引无暂存变化；父commander-status、HANDOFF、README、task和独立审查文件未编辑。5Z仅追加本步遗留，没有开展5Z实现或5C2/5D3/5E2。

本步剩余分列为浏览器/全面负载覆盖、同步冻结/编码/2048余量及新发现的原UI夹具基线门禁；原基线失败继续保留，有限通过不冒称全绿。详见[5Z本步追加](phase5z-remainders.md#5y-本步遗留作者交接2026-10-09)。没有作者已确认而未修复的本步正确性项，仍待父独立审查；不把作者自测写成独立关闭。

报告与外部READY交付后作者立即停止共享树写入、退出，由父同轮独立审查，再按必要发现resume原会话修复，最多两轮；不自行开代理/审查或下一阶段。

## 维护者交接后真实浏览器补验（R1之前）

作者停写退出后，维护者在系统授权环境对最终生产dist运行原browser-check.mjs与一份窄补脚本，均exit0。真实Chromium加载生产RecordingCheckpoint.worker资产；窄补脚本在2048摘要仍pending时并发保存/导出，完整前缀相等且发布2048快照；在256摘要pending时加载录像、seek2048通过；新局取消旧导出通过，页面错误0。Worker观测调用原生super，不替代计算：sent10、received9、error0，最后一job按预期取消。

原脚本先flush后保存的结果只计其实际覆盖；窄补明确pending=true，补足等待路径。功能启动阻断已解除，上文未验是作者沙箱交接时状态。Node成对性能仍按§3所列环境，不冒称D8浏览器性能或全设备矩阵已验；后者继续5Z。外部仅保存parent-browser-summary.md及小结果，不封存截图/多版本。随后立即进入独立R1。

## 6 第1轮作者修复：R1-F1（2026-10-09，待R2独立核对）

已完整读取[独立R1发现及复现](phase5y.review-findings.md)、父 `parent-browser-summary.md` 与上节补验记录。R1仅一项确证缺陷：完成历史淘汰后的合法重复回包误触发完整性失败。作者按本轮指令修复，自测通过；独立R1结论与原发现保留，是否关闭由父R2裁决。修复开工/结束HEAD仍为 `a41ba6fc7cf6af29c1bc1260bf87fa4bfbf5c6d0`，未commit/push，未自开代理/审查。

**修复：** 生产仅改 `RecordingBackend.ts` 及 `RecordingCheckpoint.worker.ts` 的传输接缝。移除最近128项 `completed Set`，使用一个连续递增、安全整数 `issuedThrough` 与原待决Map；请求号每backend从1连续发放，存在已发区间但已不在pending的编号就是完成回包，可永久忽略，无需任何完成历史Set或增长的区间数组。当前pending仍由Game两chunk上限约束；乱序只删除对应请求号，未完成的低编号仍在Map，不能误当已完成。达到安全整数上限明确拒绝，避免编号重用。

请求及回包外层新增 `requestId`，Worker成功/计算错误均原样回传；同一boundary再次提交会分配新编号，旧完成编号不能满足新请求。旧generation判断仍在编号处理前；未知/缺失/非法/未发请求号在当前有pending时failclosed，当前请求的boundary必须匹配原job，完整codec/manifest/域/root/event校验仍在Game原路径。原错误身份断言未改，只让消息注入按新外层编号指向当前待决请求；未把当前错误身份伪装为合法重复。

`requestId`不进入 `CheckpointJob` 的持久identity、`CheckpointResult`、世界投影、full/chain/snapshotDigest或保存录像。`computeCheckpoint`、冻结/编码/完整oracle、Game输入门控与frontier、九SDK、黄金和版本周期都未改。调度增加一个整数的结构化传输/回传及常数比较，删除Set历史增删；没有新增canonical/哈希/冻结/主线程full计算，也没有新增大payload副本。§3仍是修前作者Node本机测量，本轮未重新计时或宣称修后全面性能独立通过，原环境/布景/样本限制保持，不形式重建源树。

**正式回归：** 在原 `ext_recording_async.test.ts` 新增6项。协议回归在第128→129、129→130提交时重送首结果，另以同一boundary的两份新请求乱序完成、重复完成和旧回包验证不能提前满足请求；真实Game每条escape后导出，连续131次非周期job并逐次重复export，129/130/131期间重送首回包，最终完整录像各字段/chain/full与原同步131条路径精确相等，RNG相等、失败为空、输入恢复、peakJobs=1。另4项覆盖未发编号、缺编号、当前codec错身份及未来generation仍失败关闭，原未知boundary=900、旧generation和重复断言保留。

新增两主回归在生产未修时实际exit1，两项均复现原F1（真实Game区间1..130/domain identity），随后窄修通过；未改旧前提/守卫/黄金来消除失败。其他正式选择保留原两chunk输入不耗tick/RNG、多个flush/换局、full/event失败及四运输回退。消息运输为注入，计算使用生产纯函数；不将注入说成原生Worker自然重复。

**真实浏览器来源与复用脚本：** 父在本修之前已解除启动权限阻断，真实Chromium生产Worker待决256/2048的save/export/load/seek/取消通过，上节记录完整保持，本轮不再登记“功能浏览器未验”。本修更新作者外部 `browser-check.mjs --fix-r1` 窄模式，父原 `parent-browser-check.mjs`/摘要/结果未改；新模式仍调用原生Worker super及最终dist，只在129/130/131请求待决时重送捕获的首个真实结果，要求131次真实计算回包、131次同边界重复导出和3次故障注入成功，并核对新外层编号。仅返回小结果摘要，普通原模式仍可用。本轮只做脚本语法检查，该新协议/迟到重复窄模式交父按需执行；不是重新要求整套功能浏览器或全面矩阵。

更新生产Worker：`dist/assets/RecordingCheckpoint.worker-CyATMAxJ.js`（70015字节）。外部Node线程直接加载这份新bundle的单项核对已过：外层协议接通，full各域/root及snapshotDigest对原同步、inline、独立Node crypto一致，chain直接Node crypto核对一致；没有执行配置中的性能用例。

统一沿用Node24.19 PATH、3GiB、Vitest单worker/文件串行，重门禁串行；实际命令及exit/计数如下，不累计重叠通过数。

| 实际命令 | exit | 结果 / 用时 |
| --- | ---: | --- |
| `node node_modules/vitest/vitest.mjs run src/test/ext_recording_async.test.ts -t R1-F1 --maxWorkers=1 --no-file-parallelism` | 1 | 修前正式2项复现F1失败 / 19按-t未选（当时21项）；原Unexpected checkpoint identity；9.188s |
| `node node_modules/vitest/vitest.mjs run src/test/ext_recording_async.test.ts -t 'R1-F1|ignores duplicate|freezes before live|serializes multiple|fails closed for|downgrades only transport' --maxWorkers=1 --no-file-parallelism` | 0 | 修后1文件16通过 / 9按-t未选（最终25项）；含6项新增及原未知身份/两chunk/取消/运输回退；16.595s |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 0 | 类型通过；8.878s |
| `npm run check:modules` | 0 | 模块边界及测试归属通过；2.383s |
| `npm run build` | 0 | 生产build通过，原大bundle警告保持；12.144s |
| `node node_modules/vitest/vitest.mjs run --config /private/tmp/brogue-commander-20261009-5y/perf.config.mts -t 'production Worker full' --maxWorkers=1 --no-file-parallelism` | 0 | 真实更新生产Worker逐域/root/chain/snapshotDigest对同步inline及独立crypto：1通过 / 1性能用例按-t未选；不是性能重跑；2.903s |
| `node --check /private/tmp/brogue-commander-20261009-5y/browser-check.mjs` | 0 | 可复用浏览器脚本语法通过；本轮未执行浏览器窄模式，由父运行；0.021s |

本轮未跑整套drift、性能、全部组合、全量门禁或基线旧失败；父先前已登记结果与原失败保持。无作者已知的本修剩余确证错误，仍待R2只复核F1及本修新增问题；浏览器D8性能/全时内存/全面设备、自然最大世界及旧全局基线归因仍沿5Z真实遗留，未开启5Z实现。独立R1原文与结论保留，下面的作者回应不冒称独立关闭。

完成 `fix-r1.READY.md` 后原会话立即停写退出。父同轮R2，最多一次末修收口，无R3；不自开下一阶段，不改父status/HANDOFF/README/task。

本轮收口检查：`git diff --check` exit0；受保护父状态/HANDOFF/README/task及父浏览器记录未改，报告/审查/5Z原文本前缀完整保留，审查仅追加明确的作者回应。九冻结SDK、HEAD及空暂存索引保持，本轮变化无CRLF/大原始证据，backend无完成历史Set。

## 7 维护者最终收口

两轮审修到此结束，R1-F1长期重复回包误关闭已由R2独立关闭，未新增确证修复问题。R2实际9项通过/16按筛选未选，另协议探针通过；不与作者批次累计，不开R3。详见[独立审查](phase5y.review-findings.md)。

fix-r1停写后维护者运行最终生产Chromium的`browser-check.mjs --fix-r1`，exit0：原生Worker计算/回包131次、重复导出131次，第129/130/131待决注入首条真实回包3次，failure=null，Worker/page错误0，peakJobs1。新传输封装的真实浏览器窄路径通过。原256/2048待决保存导出、加载/seek及取消补验保留；不扩称D8浏览器性能或设备矩阵。

性能保留§3同机Node实测；F1仅增加传输请求整数及常数路由，不改纯计算/冻结/补链，按用户只跑受影响项规则未重复性能矩阵，未把原数据标成修后新测。既有六项全局失败、旧foundation12 UI夹具一项及未验覆盖分类登记[5Z](phase5z-remainders.md)；主线程冻结/编码、2048发布与save/seek余量保持，不扩大5Y。随后准备5Z任务书，不直接启动5Z实现。
