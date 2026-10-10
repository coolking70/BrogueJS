# 5Z 收口报告（独立R1通过，人工待验）

<!-- 5Z FINAL RERUN START -->
## 用户追加：当前候选完整复测（2026-10-11）

候选实现 `0ec7c56`；实际启动HEAD `59b9ba691daf66819eeea0299a0539f3641ad208`（仅文档后继）。源码聚合 `3321b89a32517e497a2485479fdcf147eb2696bb0597aaca7da6310d1c9ce3f5`。只运行测试、记录结果，不修改生产源码、测试、黄金或门限；失败仅归类报告，不自行修复。人工验收改由Claude抽样，回执未到前仍待验。

运行环境：Node v24.19.0，NODE_OPTIONS=--max-old-space-size=3072；三套串行，均使用 --maxWorkers=1 --no-file-parallelism。不主动ce:fetch/test:full/test:gen，不修改既有skip/todo。

| 套件 | exit | 秒 | 原始计数摘要 |
| --- | --- | --- | --- |
| npm-test | 0 | 8521.12 | Test Files  547 passed / 1 skipped (548)；Tests  10624 passed / 84 skipped / 5 todo (10713)；Duration  8520.58s (transform 6.77s, setup 0ms, import 231.38s, tests 8261.68s, environment 78ms) |
| test-ext | 0 | 6706.4 | Test Files  292 passed / 1 skipped (293)；Tests  5863 passed / 1 skipped (5864)；Duration  6706.01s (transform 4.57s, setup 0ms, import 128.95s, tests 6561.84s, environment 43ms) |
| test-drift | 0 | 161.15 | Test Files  7 passed (7)；Tests  14 passed (14)；Duration  160.85s (transform 1.13s, setup 0ms, import 4.93s, tests 155.55s, environment 1ms) |

维护者已核对三套完整日志、done=exit0、实际进程退出及末次源码指纹：三套均0失败、0已报告unhandled。npm保留84真实skip/5todo，ext保留1真实skip，drift无skip/todo。三套有重叠，不累加测试数量。

末次源码聚合 `3321b89a32517e497a2485479fdcf147eb2696bb0597aaca7da6310d1c9ce3f5`；与开始一致：True。

原始日志与命令/退出码摘要：`/private/tmp/brogue-commander-20261009-5z/final-rerun`。失败的具体原因及影响由维护者读取完整失败段后归类，未经复现不将时限/资源错误判作产品缺陷或过时前提。
<!-- 5Z FINAL RERUN END -->

本地实现与授权引擎门禁已完成；独立R1未发现确证缺陷，七项基线、64项首败及N40边界获独立核对，无需修复或R2。见[独立审查](phase5z.review.md)。维护者确认源码与dist仍匹配下列候选身份，5Z实现提交`0ec7c561f278b3b1ae9319fb5d774ae9ebf5b509`已推送`ext/phase5`；原5Z本地收口完成。用户随后授权六项底座修复及narrative2集成；旧收口不代表新确认缺陷已关闭。见[状态卡](commander-status.md)。浏览器/真机全部待人工，不称阶段5整体验收完成。开工基线`f1df6907b3bc4187643387225563994281416261`。

当前合同完成 **15/15真实物理布局、29/29删除双场景要求＋原正常128/128＝157/157**。前两行旧64批额外124单列保留，未加入157分母；463/591及127/2059/2187均为废止历史范围，另外112物理布局范围外未验。每行boundary/types/build、全部剩余ext、真实缺模块save/录像拒绝均已完成；前七行首败按受影响复测关闭并沿用明确未受影响部分，后八行当前候选完整首次通过。没有把plan、中断或定向拼接称为一次全量全绿。

正常树实际完整npm首次exit1：548文件523过/24败/1跳过；10708项10555过/64败/84真实skip/5todo，另7个unhandled。七项基线失败与64项原测试名逐项关闭映射见下文；7个unhandled来自同一SFC轻DOM夹具几何方法遗漏，修后整文件及全部ext未再产生。**原5Z收口当时尚无第二次完整npm exit0；用户追加完整复跑现已exit0，详见顶部新批次结果**；首次结果与修后受影响整文件、全部ext的覆盖对应关系保留。全部ext exit0（5862过/1原skip）、实际drift exit0（14过）、原正常128 engine-only exit0均沿用已核未受影响范围。正常128读口重复批及旧删除64补验由维护者范围调整SIGINT中断，不计新通过、不算产品失败。

候选源码聚合 `3321b89a32517e497a2485479fdcf147eb2696bb0597aaca7da6310d1c9ce3f5`（1298输入）；实际dist聚合 `d81dcb925dd2bf38f03a28d6fe6da25d34849c9f1201fa8b86d97a8fa87a561f`（60文件）。正常正式128、allExt及性能所测较早候选和后来读口/测试前提差量的影响核对见执行记录，未宣称所有历史命令都在这一身份执行。最后八删除布局使用该当前源码。Z1-A不主动CE获取/full/gen；真实缓存缺失，既有CE skip照实列出。Node24.19.0、3072MiB、重负载串行、Vitest单worker；门限、守卫及黄金原捕获方法保持。

生产修复：旧世界计划/短期权限增加实际world根身份校验并在新局/读档重置既有epoch；run方向快照严格按真实writer的整数0–7校验；reward组件查询执行原到期检查；DF写入回到既有合法writer；动态文本经既有i18n边界；两纯地图预览谓词迁入既有CellProperties以支持物理删除。其它主要是经单变量反事实证实的过时布景、可选安装前提及按原入口捕获的格式元数据黄金差量，没有新增玩法或协议升级。

缺combat布局中六项能力正例显式使用完整测试后端（namespace combat / 独立0.0.1），正常有pack仍用真实1.6。它验证底座排程/资源/poise/炉火及完整校验器，不能作为实际缺包仍有combat玩法证据。所有正式生产endpoint与真实旧档录像拒绝均不加载或注入该单元后端，保留真实剩余manifest；完整前提、反事实和影响核对见Z-N40，供R1特别复核。没有空壳、恒真validator、扩skip/exclude或宽化产品守卫。

下表“完整ext”是原完整运行计数；首败保留，不改写成0失败。前七行修后精确沿用/替换与后续全局影响范围在Z-N32–40逐项登记。全部真实输入拒绝合计72份（144次save/录像拒绝）；包含giants两自然输入，giants仍在的布局不把它们算缺包负例。十五行strict classic均过，完整活局、双RNG、ID及根身份保持。

| 行 | 实际布局 | 原完整ext结果 | 最终关闭依据 | 必验smoke | 真实输入份数 |
| --- | --- | --- | --- | --- | --- |
| 1 | 单删 settlement | 5 failed / 5412 passed / 1 skipped (5418) | 首败按Z-N32及后续影响审计关闭；原未受影响全量沿用，非新一次全量 | 2 | 1 |
| 2 | 单删 narrative | 8 failed / 5501 passed / 16 skipped (5525) | 首败按Z-N33及后续影响审计关闭；原未受影响全量沿用，非新一次全量 | 2 | 1 |
| 3 | 单删 growth | 5 failed / 5074 passed / 2 skipped (5081) | 首败按Z-N35及后续影响审计关闭；原未受影响全量沿用，非新一次全量 | 2 | 1 |
| 4 | 单删 giants | 11 failed / 5496 passed / 8 skipped (5515) | 首败按Z-N37及后续影响审计关闭；原未受影响全量沿用，非新一次全量 | 2 | 3 |
| 5 | 单删 foraging | 2 failed / 4905 passed / 1 skipped (4908) | 首败按Z-N38及后续影响审计关闭；原未受影响全量沿用，非新一次全量 | 2 | 1 |
| 6 | 单删 crafting | 23 failed / 5000 passed / 1 skipped (5024) | 首败按Z-N39及后续影响审计关闭；原未受影响全量沿用，非新一次全量 | 2 | 1 |
| 7 | 单删 combat | 18 failed / 4949 passed / 1 skipped (4968) | 首败按Z-N40及后续影响审计关闭；原未受影响全量沿用，非新一次全量 | 2 | 1 |
| 8 | 单留 combat | 2594 passed / 16 skipped (2610) | 当前源码全部剩余ext首次完整通过 | 2 | 8 |
| 9 | 单留 crafting | 2636 passed / 1 skipped (2637) | 当前源码全部剩余ext首次完整通过 | 2 | 8 |
| 10 | 单留 foraging | 2744 passed / 1 skipped (2745) | 当前源码全部剩余ext首次完整通过 | 2 | 8 |
| 11 | 单留 giants | 2097 passed / 1 skipped (2098) | 当前源码全部剩余ext首次完整通过 | 2 | 6 |
| 12 | 单留 growth | 2552 passed / 1 skipped (2553) | 当前源码全部剩余ext首次完整通过 | 2 | 8 |
| 13 | 单留 narrative | 2121 passed / 1 skipped (2122) | 当前源码全部剩余ext首次完整通过 | 2 | 8 |
| 14 | 单留 settlement | 2229 passed / 1 skipped (2230) | 当前源码全部剩余ext首次完整通过 | 2 | 8 |
| 15 | 全删 | 1908 passed / 1 skipped (1909) | 当前源码全部剩余ext首次完整通过 | 1 | 9 |

[人工清单](phase5z.manual-checklist.md)交Claude侧或用户：24视口、营地/居民/袭击全离线暂停且解围不追补、采食/合成、灯褶/铜须、原giants120格、V17十手势、self955三完整场景、5Y UI/Worker和性能全部标待人工，提供公开入口、种子、步骤、预期、候选build与回执栏。Node Worker/受控最大预算证据与自然路线、浏览器/真机性能严格分列。5C2/5D3阶段5之后，5E2/5F不扩。

以下保留首败、单变量反事实、逐项修复和复测的执行时点记录；历史“当前/仍待/执行中”不覆盖本节收口状态。独立R1→作者修复→R2上限，无R3。

## 七项基线失败与关闭

开工原入口：`node node_modules/vitest/vitest.mjs run src/test/phase4a0_spatial_differential.test.ts src/test/u_r4_trace.test.ts src/test/p1_30_i18n_gate.test.ts src/test/replay_import_ui.test.ts --maxWorkers=1 --no-file-parallelism`，exit1，四文件35项中7失败/28通过，32.59s。首次结果摘要保留 `results/baseline-seven.json`。没有降低门限、删断言、加skip、exclude或改扫描器。

| 编号 | 原失败/根因 | 单变量反事实及最小修复 | 复测/关闭 |
| --- | --- | --- | --- |
| Z-F01 | 完整图empty：旧foundation9/whole-run5黄金与新codec/只读端口不匹配 | 下述旧外壳+四端口窄反事实精确通过；原P4A0_CAPTURE捕获当前完整图 | 关闭；原完整图用例通过 |
| Z-F02 | 完整图growth：同一外壳变化，growth机械内容未变 | 同上，保growth完整世界/双RNG/别名/所有权比较 | 关闭；原growth图用例通过 |
| Z-F03 | 完整图narrative：同一外壳变化，narrative机械内容未变 | 同上，保narrative完整世界比较 | 关闭；原narrative图用例通过 |
| Z-F04 | 完整图growth+narrative：同一外壳变化 | 同上，保联合完整世界比较 | 关闭；原联合图用例通过 |
| Z-F05 | UR4旧foundation11链起点与当前foundation13不同 | 仅临时descriptor协议11及相应RecordingFormat校验恢复，原UR4完整黄金精确通过；恢复13后原失败，原UR4_CAPTURE重录 | 关闭；恰52个chainDigest叶，其余叶零变化 |
| Z-F06 | MainMenu两配置文本调用、StructureProduction两动态翻译不能被扫描器解析 | 原调用四处全部复现；MainMenu依据descriptor已校验ext所有权翻译真实ext后缀，修缮名称沿既有worldText翻译边界；字串/选取/RNG/机械逻辑不变 | 关闭；扫描器不改，整i18n26项exit0 |
| Z-F07 | foundation12 UI旧夹具的外壳及world schema3摘要前提已过时 | 临时仅protocol12+旧world摘要外壳（schema3、无raidCamps/raidAdmissionCursor）后，原文件四项UI导入/seek/续录原断言精确通过；恢复后失配。原39输入捕获当前13文件，旧12与10原文件均不改，新增真实App导入12拒绝/活局保持 | 关闭；当前UI接受/回放/续录和旧10/12拒绝均通过 |

### 完整图精确因果与重录

最后实际捕获提交是 `d32c666`（5A3），不是后来UR4的foundation11。早期只恢复foundation11/10/9均exit1；再仅恢复codec9/whole-run5也exit1，因仍有四个新增运行端口及完整投影版本。临时副本复用后清理，旧5A3生产及相应原生状态词汇、当前测试/原捕获入口得到**与原fixture精确相同**的完整图；当前与旧图对象数全部相同，所有非下述差量完全相等。副本启动的缺descriptor/测试归属/状态词汇三种不完整回退失败保留为实验失败，未当产品门禁。

最终窄生产反事实只恢复descriptor协议9、RecordingFormat对应codec校验、RecordingDigest.codecIdentity v5/5、Game录制头wholeRun5/快照codec、WholeRunSnapshot v5/5，并临时撤四端口 `edibleRead/needTrigger/simulationTicks/structureRead`。原四图测试**4通过、exit0**，19.85s；finally恢复全部生产文件。未过滤这些端口，也未把黄金图比较改为投影比较。

逐字段差量摘要：52个端口对象各增加四个function属性，原有属性描述符、引用与机械状态不变；44个codec.foundation（9→13）、44个codec.wholeRun（5→6）、370个root、370个extensions摘要、128个native摘要、242个chainDigest、36个prefixDigest。native摘要含整局schema/version外壳，extensions含manifest/foundation格式号，root/链/前缀由这些变化派生。4×13观察点共52个完整图hash更新，36个含录制来源的snapshot hash更新；objects/双RNG/消息/空间与所有其它机械叶全部相同。没有新增对象图排除规则。 baseline JSON SHA256 `4bbc60360b9dbead3aee3180a6c99901e4046b8bfbeb0a0602fb3c4dcc5e8efe` → `6e7b528c46bb1393b070d905d02917d55d4bc455000a9d73eb3053fc700a2d06`。原 `P4A0_CAPTURE=1` 重录，完整图比较器及捕获函数零改动，原机械/回滚保险继续由最终全套验证。

### UR4和UI字段登记

UR4按原 `UR4_CAPTURE=1` 捕获：旧gzip SHA256 `730a78a8af493d192fcc426fdcdfb37d02c0b27c1b415d1517e66b03241a0ee6` → `a3f84fd08628f7bee7cb18b2a4c3e69c272cb80293fbaed27a5466628904e3a8`；52个chainDigest，所有snapshot/events/tick/两流/机械域保持。原gzip已超过1MB，是既有黄金fixture更新；没有新增大raw或截图。

UI原 `FORAGING_IMPORT_CAPTURE` 入口仅同步codec断言12→13，仍从原foundation10的39条公开输入捕获，并保action/data/decisions精确比较；当前13文件59162B、SHA256 `c52680444ee55b7c8c90d9c1acf055d8b185645a01360a086c94daf26472c9d9`。相对于原12文件165个叶差：2个foundation、1个recordedAt（真实导出时间）、41个world5摘要（schema3→4及新增空袭击根）、41个extensions摘要（foundation）、41个root（派生）、39个chainDigest（派生）；其它机械字段与输入完全相同。新fixture单独命名13，旧12与10不可变字节拒绝证据保留。正常原接受/反应式渲染/seek0/39/load/续录40断言保持，新增12拒绝经同一App文件导入事件，核旧根身份/完整存档/双RNG/ID/logger保持。

七项修后原四文件整批：exit0，**36通过/0失败/0skip/0todo**，37.45s（多一项旧12 UI拒绝）。捕获批次与此复测重叠，不累计为最终全量数字。捕获UI单项显示4项未选择，不是生产skip；不以捕获替代导入门禁。

完整npm首次结果所属旧候选身份：1293个src/scripts/public与根构建配置输入的排序[path,SHA]紧凑UTF-8 JSON聚合SHA256 `ae769afdbf6827d76082f083f849cd3969545aa0879c3b09aed8fa822cf5aba9`；实际dist 60文件同口径聚合SHA256 `898c9d792b544cc2acdf67373d793fe301321c5e1fcc42ed34a6f67f11fc621d`。只保聚合身份，不保逐文件清单。这是完整npm阶段的历史身份；后续生产修复已另跑boundary/types/build，最终身份见下文，不把该旧build冒称最终候选。

## 正常树门禁与范围变更前执行历史

下述127行/2059条删除路径及2187总目标是当时合同，已被顶部15行/29删除必验/157总要求替代，额外124单列；首败命令、计数与修复经过保留为历史，均不触发旧调度。

| 真入口 | exit | 结果 |
| --- | --- | --- |
| npm run check:modules | 0 | 已运行 |
| node node_modules/vue-tsc/bin/vue-tsc.js -b | 0 | 已运行 |
| npm run build | 0 | 实际dist构建完成，既有chunk>500kB提示保持 |
| npm test首次 -- --maxWorkers=1 --no-file-parallelism | 130（worker先OOM） | 首轮无完整计数；worker在474525ms达3056MiB存活堆并abort，父仍等待，已由原工具会话SIGINT结束；OOM窄修已关闭；修后完整真入口已结束，结果见下一行 |
| 修复OOM/布景后完整npm同入口 | 1 | 548文件：523过/24败/1跳过；10708项：10555过/64败/84真实skip/5todo，另7个unhandled rejection，7941.81s；首次结果保留，不称全绿 |
| npm run test:ext -- --maxWorkers=1 --no-file-parallelism | 0 | 293文件：292过/1原条件skip；5863项：5862过/0败/1skip/0todo，6179.15s |
| npm run test:drift -- --maxWorkers=1 --no-file-parallelism | 0 | 7文件14项通过/0失败/0skip/todo，148.35s；未改生成黄金 |
| composition --engine-only首次 / 修后新输出 | 1 / 0 | 首次No natural contributed creature保留；原函数数据单变量反事实及种子最小调整后，全部128真实Game路径通过，770.72s；浏览器not-run |

正常树完成后的原调度计划是按removal档分片串行覆盖127行；旧范围已启动但未完成，后经用户两次缩减。原计划每行真正删整个目录、清缓存、boundary/types/build/剩余全部ext/剩余全部子集/缺模块旧档录像拒绝。原smoke缺模块负例属于有效输入上追加缺失manifest；原断言保留，另由本次外部串行矩阵装配增加真实当前模块存档/录像捕获后拒绝，并覆盖灯褶155/铜须615公开输入自然路线的有效save/replay。实际输入先在正常安装证明可接受，删除后核完整活局（允许拒绝错误日志）、对象根身份、双RNG和分配器保持；临时原输入用完清理，只保命令与结果摘要。真实输入捕获已完成；首行删除settlement后的严格拒绝及classic已通过，其余随对应实际删除行运行。128正常+2059删除=2187保留×启用路径；当前已验192，不将目标当实际计数。只保命令/exit/计数/耗时/首次失败摘要，临时副本清理；外部progress记录真实完成数与客观估时。后续修复仅重跑受影响项，并单列沿用理由；全局变更按全行影响，不武断只复测一行。

## 正常树新增失败 Z-N01（窄修关闭、完整npm及全部ext该文件已复核）

首次完整npm命令worker在3GiB限制内OOM，父持续等待后由所属工具会话SIGINT结束/exit130；无完整文件/测试计数，不伪造首轮一次全绿。串行定向combat_combinations保原候选再现：第25项combat+growth+narrative超时/OOM，24通过、1失败、其余未完成，exit1，482.83s。该项单独原断言通过（22.51s，63项筛选未运行）；临时阶段日志恢复后删除，证明不能当单例规则失败。

本地Vitest真实实现 `@vitest/spy/dist/index.js` 的REGISTERED_MOCKS强Set保留所有mock；spy的restore闭包拥有目标Game/runtime，restoreAllMocks仅清MOCK_RESTORE而不释放这些强引用。64个用例的两个目标对象spy累积整世界；没有提高3072MiB或60秒门限。最小夹具修复：unbound原方法的vi.fn保原mock.calls/results及not.toHaveBeenCalled断言，每项结束恢复原目标属性描述符并清mock contexts，恢复队列立即清空；无生产/RNG/输入/机械断言变化。修后整64项已结束：32通过/32失败，exit1，730.03s，未再OOM；剩余为下述settlement旧布景，不能称该批文件全绿。最终正常npm候选已在原完整64发现下通过该文件（64/0，894.359s，完整npm最终exit1，64项其它失败），不以先前32/32退出冒充通过。修复前已在同3GiB下24项后OOM，修复后越过该点并结束全部64项，内存归因与玩法前提分别关闭/处理。

## 新增前提 Z-N02 / Z-N03（窄修关闭）

Z-N02：combat组合中含settlement的32项仍触发原encounters<30。真实公开命令诊断：5D1新行脚人盟友追赶seed7397的远端kobold，玩家原“原地wait至敌人近身”场景始终看到远敌；不是新袭击或伤害/录像错误。仅临时撤Game的spawnResidentCandidates入口调用，其余生产/原断言不动，原combat+settlement用例精确通过（9.18s/exit0），finally恢复。维持原normal/自然生成、walk<10、encounters<30、positive原生玩家近战和全部存读/回放断言；有界候选7398因无玩家近战失败；7399原单例通过（10.01s/exit0，63项未选择），未继续扫描7400/7401。仅含settlement布景改7399，其余保7397；受影响32项临时窄选择后完整通过（390.36s/exit0，无skip），finally恢复完整64发现。保持原正例及门限。最终完整npm已在完整64发现下复核通过；spy恢复明确调用原描述符恢复函数，避免vi.fn.mockRestore仅清实现却留空mock在原对象。

Z-N03：基础ext_recording_async把3个可选模块计划硬编码成必须安装。真实临时副本整目录删除combat，原三组合1过2败/Unavailable extension:combat；整文件原复现23过2败/exit1（38.23s）。第一次拟复核因cp在副本内指向自身，没有复制修复文件，仍是原失败，记录保留，未称通过。仅将3个原计划投影为实际安装模块并去重，保空集和全部save/load/续录/replay/seek/摘要等断言；无skip/exclude或豁免。正确复制后缺combat副本整文件24项通过/exit0（45.94s）；完整安装仍恰原3计划/25项，正常树整文件25项通过/exit0（60.06s；Vitest实际50.85s，包装轮询余量单列）。Z-N02/03窄修已关闭；随后完整正常npm及全部ext均在原完整发现下复核该两文件。副本已清理，**不计为完整removal档行**，127实际行仍全部必跑。

## 新增失败 Z-N04 / Z-N07（已归因关闭）

完整正常npm内 `resident_natural` 原956 normal路线首次失败；该文件1过1败，3934ms，失败用例543ms。完整npm最终exit1，摘要见下文。原断言/路线/门限保持；实际失败为命令0摘要：当前2432c191… vs旧e966393b…。仅foundation12/schema3摘要外壳反事实仍失败；恢复ce7a2da六份settlement生产包文件+该外壳，原956完整语义及存读/续录957/逐条回放/所有seek精确通过（exit0，122.72s，1项未选择）。当前所有生产文件finally恢复；证明旧版本/固定规则/配置及world schema3摘要前提，原路线输入/机械断言未改。串行总控在完整npm结束后预留作者窄因果窗口，先归因修复，再接全部ext及独立门禁；不与在跑重负载并行，不重复正常整套来掩盖首个结果。

Z-N05/06：同轮发现 `settlement_raids` 原生变形的settlement+giants、settlement+combat+giants两项失败；其它两同组组合已返回通过。Z-N07：normal/seed3自然俘虏路线首次失败。两自然路线最后摘要捕获提交为ce7a2da（foundation12/schema3），当前为13/4；该段记录首次定位线索；反事实结果及修复见下文。四项首次失败保留，原断言/门限不改。Z-N07相同旧12包窄反事实精确通过（98.20s）；Z-N05/06严格载入诊断为Creature outside movement region，追到离层测试布景将新D2灯褶搬出自有区域，仅修正该离层夹具：不迁移带movementRegionId的怪物，保原世界校验及所有断言；28项袭击在后续原整文件复核通过。

## 专项、人工边界及文档

最大预算与自然路线、劳动→被围→解围连续链、全部岗位配额、原生生命周期/奖励/回迁和故障回滚以实际本轮门禁结果更新。现有常规/扩展中受控fixture与自然路线分别引用，不把结构8营/3072/12288或人口64单独布景拼成最大联合自然世界。原5Y成绩按历史测量版本引用；本步另有生产bundle的Node成对测量，结果见后文。真实浏览器性能/移动设备/全时内存及UI save-seek成本均在人工清单待填。

七模块手册已核对公共安装格式与独立启用；修正旧foundation7/10/11/12、combat/narrative旧表及settlement“未提交待审”历史状态。foundation13/world5.schema4、whole-run6/recording4/origin2及九冻结SDK保持；本步无玩法/格式升号。5C2/5D3阶段5后；5E2/5F无授权，无dot。待作者完成本步READY后停止写入，父独立R1→作者resume→R2→必要末修一次，无R3。

## 完整正常npm首次最终结果与新增失败台账（已归因关闭）

`npm test -- --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=<仓外进度reporter>`，exit1；548文件：24失败/523通过/1真实skip；10708项：64失败/10555通过/84真实skip/5todo；另7个未处理错误。Vitest 7941.81s，包装7947.17s。进度reporter的中途计数没有包含未进入ready的13项native prelude，最终Vitest64为准。原失败摘要 `results/normal-test-fixture-fix.json` 保留。此批是完整入口，后续只复测受影响项，并明确沿用范围，不能改称最终修复候选完整npm全绿。

| 编号 | 首次失败数 | 根因及因果定位 | 修复及受影响复测状态 |
| --- | ---: | --- | --- |
| Z-N08 | 1 | DF写口分散到FireContact，模块测试/DEV夹具的布景代码也被生产符号守卫扫描 | 不改白名单/扫描器；DF实际提交归既有Gas火侧writer，测试布景归src/test/support；原31项DF及采食火段在21文件批通过 |
| Z-N09 | 1 | DPad实际App夹具没有disposeRecording | 只临时撤实际卸载释放调用，原29项通过；补夹具接口，已通过 |
| Z-N10 | 3 | 提取的实际App失败处理闭包缺runEpoch和load*Async | 只撤该三个handler的新异步时期前提，原10项通过；补真实依赖，已通过 |
| Z-N11 | 1 | header.foundation旧字面量10 | 临时旧协议壳原身份/工厂用例通过；只更新当前13前提，已通过 |
| Z-N12/13/28 | 3 | query/reward上下文已增加5D同owner actor组件只读口getComponent，旧严格键表尚未更新 | 临时仅移除两个只读口，原35项通过；保严格exact keys/冻结/外owner隔离，更新唯一合法键，并补reward该口的过期检查；已通过 |
| Z-N14 | 1 | 同一handlePlayerAction→executeCommand输入线路搬到canvasGameInput，旧守卫仍只读Canvas | 原绑定块窄恢复到Canvas，原用例通过；将同一字面量检查定位到实际绑定文件，原整文件15项在21文件批通过 |
| Z-N15 | 1 | 布局已使用容器尺寸算出的可用视口，旧静态前提要求直接client宽高 | 临时只恢复两个调用参数，原用例通过；保持第三参设置、watch、禁止window口径，验证实际usable读口，原整文件19项在21文件批通过 |
| Z-N16/21 | 2 | whole-run旧字面量5 | 临时原5外壳，原禁fixture导出/真实破墙存读用例通过；只改当前6前提，已通过 |
| Z-N17 | 13 | 原生决策轻夹具缺departureTurn；死亡早退一项本来通过 | 临时只撤两个departure分支，原14项通过；无离开者夹具返回false，原顺序/回调次数/RNG/时间断言保留，已通过 |
| Z-N18 | 7 | 轻DOM容器缺getBoundingClientRect/querySelectorAll，挂载中止引发7个未处理错误及缺advanceTime | 只临时恢复原client视口读口，原11项通过；补同client几何和空抽屉，原全部断言已通过，无未处理错误 |
| Z-N19 | 1 | 新slumber成为状态表第0项；原“损坏rows[0].owner=group”变成无变化 | 只将slumber行移到表末，原拒绝用例精确通过；按paralyzed身份定位原entity→group损坏，拒绝/持续期断言保留，已通过 |
| Z-N20 | 16 | 新局/载入遗漏重置worldWorkCommandEpoch，整对象图唯一区别 | 初次仅新局归零12项关闭，seek4项仍失败；成功载入归零后U00/整局/工作事务60通过。所有工作/结构句柄另绑世界根身份，旧句柄不能复活回归及相关原图已在21文件批通过 |
| Z-N22 | 1 | Object.create(Game.prototype)的传送夹具缺真实depth，新结构火推进要求合法层引用 | 仅撤Game环境推进中的新结构火调用，原38项通过（3.67s）；补夹具depth=1，保真实环境解压板断言，原整文件38项在21文件批通过 |
| Z-N23 | 1 | 真实run写入Direction整数，但存档校验误按{x,y}向量拒绝 | 严格诊断定位方向校验；修生产为原Writer的0..7整数，非run仍禁止方向字段；原44项完整通过，畸形方向拒绝已在21文件批通过 |
| Z-N24 | 1 | 3f6e237已修订公开节点读口为纯虚拟物化，旧测试仍用过期节点却期望已物化3/1 | 仅临时原SDK非虚拟读口，原4项通过；将同一3/1夹具明确为当前tick已物化，保持不写节点/预留/空节点全部断言；原4项通过，过期纯虚拟读已补并在21文件批通过 |
| Z-N25 | 1 | 自然seed7306在新增D2灯褶路线中死亡，未到D3 | 仅撤giants2两项生成贡献，原自然路线+四个袭击变形5项通过（24.21s，33项筛选未运行）；改用现有giants自然验收种子7328，原自然/公开输入/阶段/持久化/录像语义不改；7328仍自然死亡；最终选7308，原整文件10项及两居民文件共13项通过 |
| Z-N26/27 | 6 | 实际displayFrame提取闭包缺新相机跟随几何变量/布局调用 | 仅撤新focus分支，原17项通过；补纯显示closure依赖。17文件271项已过，creation的request夹具缺口仍1失败，已补，该文件在21文件批通过 |

所有反事实finally恢复生产，不封存历史源码；选择过滤数与真实skip分列。真实CE缓存缺失沿原机制；完整正常npm的真实skip归属见下文，未运行的删除行和人工项保持待验。

### Z-N20 对原完整图的单变量再归因（未宽化守卫）

成功载入/新局归零修复后，原七项四文件复核36项中32过4败（仅四个完整图，35.01s，首次摘要保留），UR4/i18n/UI仍过。临时只撤本次Game生产文件两处epoch归零，原四个完整图再次精确通过（19.17s）；原P4A0_CAPTURE旧侧捕获与修前当前fixture精确相同。恢复修复后沿同一捕获法比较52个原始完整图：对象/结构数量、描述符、别名、双RNG、消息、原生/扩展字段、全部snapshot均不变，**恰16个worldWorkCommandEpoch值**改变。对应四模块组的loaded/continued/replayed/seek四个graph.sha256叶，共16；其余fixture叶零变化。按原方法重录这16叶，fixture SHA `6e7b528c…`→`dd3c837e…`；两侧临时raw立即清理，只留命令/字段计数/必要样例摘要。最终原四文件已在21文件批和全部test:ext按原断言复核通过；这不是忽略U00修复造成的黄金变化。

完整npm的84个真实skip已按原用例核对：75项由缺CE缓存的原机制产生；8项是P2-1/2/3既有退役相位基线显式skip；1项是C5_PERF默认未启用的性能专项，后续单独启用原入口。5个todo沿原定义保留。没有隐藏缓存、新增skip或改变门限；定向反事实里的名称过滤数不冒充这些真实skip。

窄修最终批（21文件）实际结果：20文件通过、1失败；368项通过/1失败/0skip/todo，278.92s，exit1。七项开工原文件全部通过，包含epoch归因后原完整图四项；DF原守卫、传送、输入/布局、U00、方向严格拒绝、旧世界工作/结构句柄拒绝、袭击28项及其它原断言均通过。该批当时唯一未关闭为Z-N25：7328已到D3，但原战斗approach在第278行仍自然死亡，不能当自然战斗通过；首次7328失败保留，继续有界正常种子选择，原600/200步、HP/攻击/阶段/存读/录像断言不改。居民两路线摘要重录独立进行。

### Z-N04/Z-N07 原居民路线格式摘要更新

完整原RESIDENT_FORMAT_CAPTURE入口两文件3项通过/0失败/0skip/todo，220.92s。normal28原956及续录957、normal3原239及续录240、存读/逐条回放/全部seek均经过原断言。只改两个紧凑route的checkpoints.digest共48叶；所有步骤、决策、事件号、人物/物品ID、坐标、HP、时钟、材料、No纯度、同一actor/crop搬运与跨层归属断言及历史输入身份引用保持。两条旧12包/摘要外壳反事实已分别精确通过，原因是foundation13、world4新增raidCamps/raidAdmissionCursor以及settlement1.3固定规则/新局raids=false配置身份；不更改玩法或数值。历史original/continuedRecording SHA仍标原始不可变参考，不冒称当前F13格式输出。当前原断言入口已在最后三文件13项批及全部test:ext复测通过。

- `resident-natural-route.json`：`checkpoints[events].digest` 24叶，事件 0,387,388,399,430,444,456,628,654,785,786,787,789,808,873,874,876,908,910,913,914,916,917,956；SHA `f494abbb467db3a07c0ce7b5387872e321044db10fdbca3ea8b78a49ae4a505a` → `0bcc08a0023879c8afb5aff90c9febaac61535c5297446bd223996448bae7cc8`。
- `resident-captive-route.json`：`checkpoints[events].digest` 24叶，事件 0,45,145,191,192,193,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,237,238,239；SHA `52b02fb382af7a70f37405d12bd810a5ed7576d3f50e1eddfadb28ae0b7bff3a` → `6d9c7d07fd5ddc09c0b694e3e9733a61363ae818373f9ce19da61028db12c5d4`。

Z-N25有界种子结果：7328到D3后approach死亡；7329、7330、7307未到D3，首次结果各保留。预定7307–7318相邻范围在7308即停止，未测试7309–7318。7308原完整自然用例通过（10.11s，1过/9项名称过滤未运行），保持normal/公开命令、600/200/8门限、自然敌对出生/4格与HP、windup/inter-segment/recovery、两次真实原生近战、同RNG、逐条replay、seek、续录以及原包规则不改。永久差量只有原种子前提7306→7308及用例标题；正例定义/任何断言不变。原三个自然文件整体复测已通过（13项），其后全部test:ext也已通过，不用单用例当整文件通过。

完整正常npm的64项首次失败至此全部有因果归因及受影响原断言复测通过，不再次转登记。最后三个自然文件的原断言入口（无捕获环境）3文件13项/0失败/0skip/todo，248.86s；单独已闭的其它17文件/271项、随后21文件20过368项/1旧seed失败的范围如上，不累计重叠通过数。原64个combat组合已在先前完整npm通过，后续完整test:ext已在修复后的生产代码下重新运行并通过。epoch/通用载入/上下文与DF writer变更影响所有删除候选，127行尚未启动，全部使用最终冻结输入；不把它们当成仅一行影响。

沿用说明：完整npm记录所属源身份 `ae769afdbf6827d76082f083f849cd3969545aa0879c3b09aed8fa822cf5aba9`，已保存exit1及64失败/7未处理错误。之后没有重跑完整npm去覆盖首次结果：按任务书只补受影响24文件及直接相关整局/句柄/存档/火段等，所有新增失败已闭。其它完整npm通过/既有skip/todo仍是修前候选结果；不声称最终修复树完整npm同一次全绿。最新正常check:modules/types已exit0，实际build及全部ext/drift/组合已另列修后身份，删除行使用最新测试前提身份。

全部ext/drift与实际build门禁所属候选（后续脚本/测试输入差量另列）：实际HEAD仍`f1df690`+未提交差量；源聚合身份 `8f3b14c251d497df8e463b3ff641c2de647026d7e3264ed49d4c44b62a85cf78`（1294个src/scripts/public及七根配置输入），实际dist聚合身份 `27e2845b9e31405b040e62c72b29b4dff8044b48cf0aa41bb5ad87cbd4ede04e`（60文件）。这是必要构建身份摘要，不保存逐文件SHA表。final-modules/types/build均exit0；该身份下全部test:ext及drift已通过。此后仅组合脚本自然种子与SSR禁用无用WebSocket变更，生产源码及实际dist不变；脚本原守卫及全部128/127均使用更新脚本验证，最终源聚合身份另列。浏览器未运行，人工使用该实际build；若后续修复改变输入则另列新候选与受影响复测范围。

全部test:ext真实入口最新候选exit0：293文件292通过/1原条件skip；5862通过/0失败/1skip/0todo，6179.15s。唯一skip为C5_PERF默认未开启，已接原入口显式启用。实际drift：7文件14项通过/0失败/0skip/todo，148.35s，exit0；未重录生成基线。独立128首轮exit1（30.03s）：源码SSR旁支HMR监听EPERM但引擎继续，实际拒绝为No natural contributed creature；新增giants2把贡献最小深度3→2，原seed7306的D2未放置贡献，该首次运行当时0/128正式完成；修后128通过结果见下文。首次composition.json保留，不把半途启用计为全过。随后沿原exerciseGame函数完成单变量归因及窄修；预算/Node Worker/实际输入捕获也已串行完成，不以该首次失败替代独立验收。

## 补充门禁首次失败与因果关闭（继续执行）

Z-N29组合：原exerciseGame函数在单giants原seed7306精确复现No natural contributed creature；临时只撤两项giants2模板（不撤形态、函数/断言/600步/depth检查），原函数全部通过，finally恢复。giants2最小贡献深度3→2，D2 chance50并不保证旧seed出生。仅换自然场景种子1后原函数全部通过；修后128整入口已实际通过，原首次失败不覆盖。SSR hmr:false仍尝试无用端口24678；按本地Vite已支持的server.ws:false关闭SSR用不到的socket，保持同一真实ssrLoadModule引擎路径，不新增skip。组合脚本变化影响所有128/127入口，后者未开跑，不能沿用旧脚本行。

Z-N30最大营地外部夹具：首轮两项Worker/独立crypto断言通过、最大营地失败；诊断原失败格D5(20,8)被真实已招募盟友居民269占据，C5_PROTECTED正确。只把14箱付费建造移到招募前后，继续越过该点，D6床因剩余木材仅2个正确拒绝C5_INPUT，首次两结果保留。受控origin每层补齐合法99堆叠木材，继续原112箱/64人口/7168根/存读回放断言；不改生产守卫、费用、库存或人口上限。后续仍发现录制origin前提失败，已进一步归因并最终通过，详见下文；各首次结果保留。

Z-N31真实输入外部捕获：首轮missing public confirmation，因headless默认同步true消费，而捕获器还试图回答同一decision。只安装公开onCommandConfirmRequest展示回调，使原确认在公开resolveCommandDecision恢复；每条记录decision与原trace精确比较。修后exit0，九份真实输入（七单模块各2次wait，灯褶155/铜须615原公开命令），当前save/replay在删除前真实load接受。原smoke缺模块断言保留；127删除后再逐份拒绝及完整活局/RNG/ID/根身份保持，临时输入用完删除。

## Node最大预算与生产Worker（浏览器/真机未验）

原C5_PERF=1性能专项exit0，1文件1项，10.53s；只临时将原输出路径转本次仓外目录，finally恢复，门限/布景/捕获入口不改。原8区3072格/12288部件与385格拒绝断言通过。zero/full FOV P95 0.0391/0.0314ms，路径0.3247/0.3786ms，gas1.0386/1.3372ms，房间0.1350/0.0019ms；原2080条命令中含32预热及2048实测。

最终生产dist Worker以Node24 worker_threads提供消息全局直接加载：每档64个256切点（56普通完整点、8个2048点）、inline/Worker交替在同一机械切点核full字节精确；另独立Node crypto核full各域/root、snapshot及chain精确一致。这两项首轮已通过，不受最大营地外部布景修复影响，不重跑未受影响测量。所有结果只是本机Node受控场景，不代替浏览器Worker、自然最大世界、移动设备或全时内存。

| 本机P95 ms | classic inline→Worker | D8满结构 inline→Worker |
| --- | --- | --- |
| 普通完整256边界主线程（含回包发布） | 53.1395→10.3255 | 347.2748→64.6776 |
| 2048边界主线程（独立8点） | 92.7630→16.9951 | 600.0795→110.0662 |
| Worker冻结投影/JSON+UTF8/transfer | 4.0247 / 6.3553 / 0.1657 | 31.7083 / 31.9651 / 0.7650 |
| Worker发布/计算/flush | 6.9685 / 90.9057 / 98.2955 | 45.9194 / 523.5351 / 570.7816 |
| 普通wait/move/受控HP成对新增 | 0.8538 / 0.7500 / 0.0124 | 0.7198 / 0.5338 / 0.0177 |

完整256主线程P95减半及普通新增≤5ms均达保底；既有冻结projectWholeRun≤100ms目标达标，2048总110.07ms单列，不将100ms目标偷换成2048总成本硬门限，不优化投影结构。两档真实两chunk饱和各一次，下一公开输入拒绝/事件不增加，flush后恢复；D8 wire峰值53043056B，两份UTF8×两job，饱和RSS1299005440B、主堆437237624B，排空452.431ms；RSS含线程，heapUsed仅主线程，均为抽样峰值，未测全时极值。

classic save UTF8 13026958B/gzip844151B，投影save415.005ms/load855.512ms；D8 29887473B/1019931B，save908.807ms/load1826.189ms。save编码体积包括完整录制来源；gzip为Node gzipSync默认级别，UTF8实际Buffer字节，不混用JS字符数。Worker计算/flush为消费者等待时间，不能当主线程冻结；长seek和真实UI各路线仍见待人工清单。

最终组合脚本候选源聚合身份 `541ae0eda1e666b3ed3ab1b6dffea87508e0ba0478252289b2517526c40a68ca`，1294个输入；dist仍为 `27e2845b9e31405b040e62c72b29b4dff8044b48cf0aa41bb5ad87cbd4ede04e`。脚本种子/socket变化不进入生产bundle，故沿用前述final-build实际产品，不无故重复未受影响build/ext/drift；脚本直接守卫和新128/127入口另列结果。

正式独立128启用子集已结束：`node scripts/check-module-composition-smoke.mjs --engine-only --output /private/tmp/brogue-commander-20261009-5z/composition-fixed.json`，exit0，770.72s，engine.status=passed/128，browser.status=not-run；每条均真实new/save/load/replay/seek/continuation/双RNG及原缺模块负例。首次`composition.json`失败保留。原两文件脚本/组合回归150项、2文件、0失败/skip/todo，590.21s，exit0；不将其128内部用例与独立CLI路径累加。该128结束时删除尚未启动；当前删除1/127、64/2059，正式128已完成，不声称2187全过。

最大营地后续实际归因：stock补齐后8营/64人/112箱/7168根/128收据与存读原断言均过；录制步0→1未增加。最初猜测D8初始层不符，公开回D1单变量仍失败，证明该猜测不足；不改生产initialLevel/连续性校验。诊断真实初始与当前完整root及六域精确相同（root48653fd9…），却残留708个准备event：Game构造器旧origin仍存在，外部fixture只设recordingFromNewGame=false并未清它，准备命令沿旧header记录，新header随后替换，原链严格拒绝。只在本受控布景准备前公开clearRecording清旧会话；同一付费prepare与原捕获继续，原112箱/64人口/7168根/128收据/3公开wait/存读回放断言不删。修后结果已实际复测通过，详见下一段；首次失败及被反事实否定的猜测均保留。此项只改仓外受控布景，不影响已过生产ext/drift/128或Worker两项。

最大营地修后原专项实际exit0，1项通过、2项按名字未选择（非真实skip），363.37s（包装370.33s）。清旧origin后初始化event恰0（最终共3event，三次公开wait各实增1）；准备命令位于origin之前，新原生捕获通过原严格连续性/存读回放校验。48653fd9…及六域相同是修前诊断的初始/当前比较，不冒称未保存的修后完整图比对；后续三条公开wait实际新增3event，save/load及逐条replay全过。完成8付费营地、64真实居民（0/0/0/0/16/16/16/16）、112付费箱、7168真实Item根、每箱容量≤64、下一根C5_BUDGET，128收据已饱和并保顺序；未按期望数量伪造档/票据。不声称与满3072格布景是同一个自然世界，8营地布景结构数量与体积见仓外maximum-camps.json。只做同一合法受控origin，材料与坐标在捕获前明示staging，maxShape和保存规则不改。原4营64人10亿tick需求/人口GC长局及140次工作退休/64终结摘要/128事实环原用例已在全部test:ext通过，沿用其范围；8192是并发活票据防御上限，并非累计工作ID上限，每actor唯一活票据，未将8192个伪actor拼成合法最大世界。

127实际删除矩阵正在串行真实执行。启动前粗估：正常全ext6179s×平均一半工作量×127≈109小时，另加build/smoke；这是量级估算，无实际行均值，首行后按真实耗时修正，大保留子集先跑可能高估。全部127行范围保持；不是plan代运行，不因耗时自缩范围。每行完成立即更新仓外progress与五行状态，失败留首次并窄归因，再实际续跑。

已结束的仓外原始stdout日志已清理，仅保留首轮/修后命令、exit、计数、耗时、失败摘要和必要因果差量；当前真实删除行仍需临时日志供结束归纳，逐行归纳后清理。父拥有的implementation日志/提示/审查草稿不触碰。最大真实营地受控origin实际463格/532部件、120容器（112箱+8托管）、收据序号1174–1301共128，3个公开event；保存UTF8 17929004B、默认gzip309991B。满结构3072/12288另由原C5_PERF及生产Worker布景验证，不混称同一个自然最大场景。

空集口径核对：原smoke的128选择均用extended启动，包括空manifest；保留原所有断言，不能把该protocol外壳直接改为classic而削弱原缺manifest负例。额外本地引擎探针明确start ruleSet=classic、extensionRuntime=null、save无extensions/replay.extensions=null，逐个完整世界根/双RNG/公开2wait/存读/回放/seek/续录验证。此探针串接每个实际删除行的真实旧输入拒绝之后，并由首行同一串行子进程另验正常树一次；空集仍只计一个启用选择，不将额外classic检查计为第129条或虚增2187。正常树及首行补充已通过，其余随对应行执行；不以“空列表”等同严格classic存档外壳。只有仓外QA脚本变化，原候选541ae0ed…及冻结副本不变，无额外浏览器。

## 真实删除新增 Z-N32（五项，已归因关闭）

首个真实行删除settlement：boundary/types/build均exit0；全剩余ext exit1，252文件250过/1败/1原条件skip，5418项5412过/5败/1skip，4046.02s。五项全部在giants2_combinations，固定输入强制要求settlement，报Unavailable extension；registry严格拒绝正确。首次summary保留；首次失败阶段不计该行通过或其64smoke路径，修复后计数见下文。原真实settlement存档/录像拒绝及完整活局/RNG/ID/根身份保持通过，正常树和已删settlement树严格classic补充均通过。首行总4073.71s，简单按126未跑行外推142.94小时，大子集先跑可能高估，范围仍127。

同一临时副本原测试：只删除settlement目录，8个原目标中5失败/3通过、8项名字过滤未选择，4.38s；只恢复整个settlement目录，其余全部源码/测试/断言不改，复测随后原8项精确通过，结果见下文。同源正常树原8目标也已通过（89.24s），不以该普通范围代替副本单变量。只按实际installedOptionalModules构造原组合，原combat provider/原生fallback、自然出生/接触、完整成员/8格足迹、双RNG/持久化/非单调seek/续录及终结kill/不掉物/不重复奖励断言保持。growth缺席时明确断言无growth奖励组件、前后无progression；有growth时原amount0断言不变。无world5包时世界reservations为空集合，原不重叠与完整自然身体断言保持。没有新增skip/exclude或降低步数/timeout。此测试前提影响所有保留giants且可选包缺席行（仍需实际跑，不称只一行），生产/SDK/格式/黄金/脚本未改；随后正常16项及删除窄场景均通过，具体结果见下文。

Z-N32单变量availability反事实已结束：同一副本只恢复settlement整目录，原8目标全部通过/8按名字未选择，90.48s；原5失败由缺模块输入前提导致，registry不改。修后正常完整巨兽文件16通过（165.95s）、实删settlement后完整15通过（148.10s）、仅保留giants7通过（39.51s），types/boundary均0；所有原自然/持久化/脚步/碰撞/奖励断言保留，无新skip。后两个是因果/受影响窄副本，不冒充完整127行。正常全ext和128先前结果的生产/SDK/格式/脚本输入未变，仅本文件再验；正常16项覆盖正例，两个缺模块场景覆盖原生/无growth/无world5 fallback。
首行修后只补受影响文件（已实际15通过，不重复）、新的真实删除copy的边界/types、首次未运行的64smoke及真实输入/classic；原全剩余ext未受影响250通过文件+1跳过文件、5401通过测试+1原条件skip，以及实际build沿用4073.71s试跑候选。原失败5及原exit1保留，不拼称一次同树全ext绿。后续全部未跑126行使用更新后的测试输入身份，保留giants的行都受本夹具调整影响，不能说只影响首行。

首行affected-repair已关闭：新副本确证整settlement目录缺席，boundary/types均0；原affected15项结果沿用同一生产源码与实际缺目录窄副本（不重复跑），新原smoke全部64子集exit0，真实settlement旧档/录像严格拒绝及完整活局/RNG/ID/根身份保持、严格classic均0。旧250通过文件+1跳过文件、5401过+1原skip和实际build沿用理由见repair summary；第一轮完整ext的5败/exit1保留在firstFailures，不冒称同候选单次全绿。唯一行最终1/127过、64/2059删除路径；正常128单列，累计已验192/2187，不把修前/修后重复尝试计为新增行。
新输入聚合 `6249583296c3d7c2ea0bc87e2262a6ef24b7bc34c674243650ddecf8b1a4b583`，仍1294文件；唯一后续code差量是giants-owned测试前提，生产dist仍27e2845b…，生产ext/drift/128/Node Worker沿用已列版本，正常该文件16项在新树复核。矩阵已立即续跑余下126行，当前下一行实际删除narrative。首行含首次+修复耗时4494.37s；当前估时以实际已结束行均值滚动，保大子集先跑限制。

## 真实删除新增 Z-N33（八项，已归因关闭，补完首次未运行子集）

第二个真实行整目录删除narrative：boundary/types/build均exit0；全剩余ext exit1，283文件279过/3败/1原条件skip，5525项5501过/8败/16原条件skip，4990.67s（整行5014.56s）。三文件为底座ext_edible_combinations、ext_world_harness_combinations与ext_recording_v4_digest；硬编码narrative计划被严格registry正确拒绝。16真实skip为原combat_adapters中narrative依赖两组15项及C5_PERF默认1项；未加或扩大条件。原真实narrative存档/录像拒绝及完整活局/两流/ID/根身份保持、严格classic均通过；smoke尚未执行，不将第二行64路径计为通过。首次完整行摘要保留。

同一临时副本只删除narrative整目录，原三文件8失败/37通过（45项，93.51s）；只恢复该整目录，其余源码/测试/断言不变，原三文件45全过（126.81s），证实仅可选输入可用性前提。最小修复仅三个测试文件：原计划投影为实际安装可选模块并按相同计划去重，原fgfixture/craftskel/c5fixture底座正例保留；六域/locale/两流/Unicode/Merkle独立向量、真实新局/命令/存读/回放/seek/续录及配方付时/完整批次断言均不改，没有新增skip/exclude或改门限/捕获。

这些底座测试前提影响全部可选模块缺席行，不能说只影响第二行。已完成首行（缺settlement）三文件实际缺目录复核也通过；正常树45项（122.50s）、缺narrative43项（118.21s）、缺settlement45项（126.71s）、全七可选包缺席25项（45.57s），各三文件全过且0skip/todo；类型/边界均exit0。生产/SDK/格式/黄金/脚本及实际build未变；全ext/drift/正常128、首行64脚本路径及Node Worker原结果按已列身份沿用，三个测试文件新树结果单列。受影响窄副本不冒充完整正式删除行。

Z-N33修复后的当前源聚合身份 `e31d183c543f045e1091f85f90a5bed3c5690fe6e17b6e1b00fb571bced282a3`（1294个输入），dist仍 `27e2845b9e31405b040e62c72b29b4dff8044b48cf0aa41bb5ad87cbd4ede04e`（60文件）。只改上述三个底座测试前提；首行实际缺settlement的三文件已补复核，其余原250通过文件中247文件/5356通过测试及1跳过文件/1原skip仍沿用首行完整结果；giants受影响15项及原64脚本路径不受本次输入构造变更影响。正常三文件45项新树复核，不声称重新跑了完整npm或全ext。第二行原279通过文件+1跳过文件（5464通过测试/16原skip，排除失败三文件中37旧通过）和实际build不受测试前提修复影响；新三文件43项及新真实删除副本边界/types、首次未运行smoke64与真实输入/classic分别记录。余125行全部在e31d新树实际运行；这不是只验失败行的全局豁免。

第二行affected-repair已实际完成：新副本整narrative目录缺席，边界/types exit0，原smoke64子集exit0（390.36s包装耗时），真实narrative档/录像严格拒绝、完整活局/两流/ID/根身份及strict classic均0。第二行首次5525项/8失败及exit1保留，受影响三文件43项复测和未受影响279通过文件+1跳过文件沿用范围见summary；没有声称同候选单次全ext绿。第一行三底座文件实删settlement45项复核也通过。累计2/127通过、128/2059删除路径，正常128单列，共256/2187；即刻接第三行实删growth，不因新失败放弃余行。

## 真实删除新增 Z-N34（地形读口所有权，生产修复后复核中）

第三行实删growth，原boundary exit1、三个Stale raw terrain reader；未进入types/build/ext/smoke，不计该行64路径。真实growth档/录像严格拒绝、完整活局/两流/ID/根身份及strict classic独立通过，首次10.01s行摘要保留。三个指纹对应growth/view的knownGrowthMoveCandidate中visible/remembered层和钥匙晋升标志读取。全清单另有combat DEV诊断一处native floor读取，实删combat会同样stale。

同一副本只删除growth原boundary exit1（恰3个stale），只恢复growth整目录exit0；再只删除combat exit1（恰1个stale），只恢复combat整目录exit0。原扫描器和inventory均不改，证明可选目录中的原生地形读口被底座全局指纹合同持有，实际删除无法满足该所有权布局。生产修复将原知识边界/钥匙/stairs/altar判定和DEV可见native floor判定迁入既有CellProperties；growth保原actor/可见性/对角检查，combat保machine/items/interactables/足迹及付时命令。DungeonFeature.terrainMechFlags原实现恰TERRAIN_FLAGS[t].mechFlags，新底座读口直接同表取值避免新增加载环；无新规则、状态、概率、随机消耗或隐藏信息读取。

迁移后保旧inventory的原boundary仍严格拒绝（4新unreviewed+4旧stale），证明没有绕过扫描。沿原terrainReaderInventory捕获，仅更新scripts/structure-readers.json的4个raw[原索引].key；schema/count/classification/handling/coverage与所有其余叶不变，仍577个key/650次raw或write出现。旧manifest SHA `e4bf03d814948f8fcbe7521c0fba25aa901bef3e1db0ccebc390dc3a361b28ad` → `6baf02e5f692f267052f06c2975c627e99fde8e6241f46fd3dd7b704b9e0ae85`。扫描器/规则/负例断言零改动，不扩名单计数、不按缺目录豁免、不加exclude/skip。逐个旧/new指纹和原表达式范围在仓外reader-relocation-summary.json，只保四叶必要归因。

此底座文件与全局指纹变化影响全部删除行：正常树补boundary/types/build、直接知识/诊断原测试及C4/完整图/守卫负例，缺growth/缺combat/全包缺席补守卫和types/build；正式正常128与先前通过两行的边界/types/build、相关文件及64脚本子集都将在新候选补验。不是只重跑第三行；第三行此前未运行的全部剩余ext等门禁仍须真实完整执行，其余124行用新候选串行执行。未影响生产段的完整npm/全ext/drift/Node历史测量按原版本和范围沿用；当前不能将上述待复核项写成通过。

N34修后正常boundary/types/build均exit0；7个完整受影响文件80项通过/0失败/0skip/todo，137.25s，包括四原完整图（无需再捕获）、知识不泄露/两流纯度、真实DEV诊断的公开付时与严格原守卫负例。实删growth/实删combat的原boundary均exit0，全七包实际缺席的boundary/types/build均exit0；这些是窄因果/缺包检查，不增加正式行计数。只读AST核对actual HEAD f1df690的19个既有CellProperties函数体全部未变，仅新增两纯谓词。当前源聚合 `ccba41f3fc15c01d2435243dad7c06c10f9ec2662713d3942eedb34db8ab64dc`（1294输入），新实际dist `d81dcb925dd2bf38f03a28d6fe6da25d34849c9f1201fa8b86d97a8fa87a561f`（60文件）；人工使用该新build。Worker资产仍RecordingCheckpoint.worker-CyATMAxJ.js，先前Node测量保留原生产版本/布景身份，不把新主bundle冒称重新计时。

范围变更前计划重复128与既过行64；该128重复已被维护者为范围调整中断，未通过且不计新结果。新合同保留原128和两行64；只复核真正受影响的边界/types/build与七个完整直接消费/守卫文件，必要真实输入/classic；不无故重跑未受影响的原脚本路径。之后按15明确retain接growth完整门禁及剩余12行，目标591；112其它布局范围外未验。

## 完整npm首次64项失败逐项关闭映射（Z-T01–64）

以下64行按首次完整npm失败摘要的原顺序与原测试名一一对应，非把七项基线或后续删除失败混入64。原因编号对应前文详细反事实/修复段；全部保原断言、门限与捕获入口。结果不累加：final-causal整批exit1的唯一失败是Z-T53中间候选7328，最后自然整文件13/0将其关闭；fixture/API整批exit1的唯一失败是Z-T54当时缺renders.request，补齐后final-causal及全ext该完整文件通过。14个原失败文件属于全ext，其余10个文件由注明的整文件受影响批关闭；不冒称不同候选同一次完整npm全绿。读口迁移只有两纯UI谓词，19个既有基础函数体未变；直接消费/完整图/守卫又80/0，未涉及下列其它已关闭修复。当前作者无未关项；独立审修次数0，仍须维护者R1核对。

| 稳定编号 | 首次原文件/测试名 | 原因、最小修复/单变量证据 | 受影响原入口结果 | 关闭状态/未关影响 |
| --- | --- | --- | --- | --- |
| Z-T01 | [c_4b_dungeon_feature.test.ts](../../src/test/c_4b_dungeon_feature.test.ts)<br>C-4b F：留痕（本轮明确不做的事；C-4c 翻转） > F1 留痕：DF 子系统符号的生产引用只出现在白名单文件（C-4d 接线机器时再扩清单） | Z-N08：DF提交迁入既有Gas writer、布景迁到原support；原符号守卫不改 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T02 | [dpad_hold_input.test.ts](../../src/test/dpad_hold_input.test.ts)<br>DPad held input > 实际 App 打开 menu 同步停止 DPad | Z-N09：仅撤App dispose调用原29项过；补FakeGame.disposeRecording | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T03 | [ext_compatibility_diagnostics.test.ts](../../src/test/ext_compatibility_diagnostics.test.ts)<br>menu compatibility diagnostic forwarding > runs the actual continueGame failure handler with precise diagnostics and its generic fallback | Z-N10：仅回退三个旧同步handler原10项过；补runEpoch与异步载入口 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T04 | [ext_compatibility_diagnostics.test.ts](../../src/test/ext_compatibility_diagnostics.test.ts)<br>menu compatibility diagnostic forwarding > runs the actual loadReplay failure handler with precise diagnostics and its generic fallback | Z-N10：仅回退三个旧同步handler原10项过；补runEpoch与异步载入口 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T05 | [ext_compatibility_diagnostics.test.ts](../../src/test/ext_compatibility_diagnostics.test.ts)<br>menu compatibility diagnostic forwarding > runs the actual importReplayJson failure handler with precise diagnostics and its generic fallback | Z-N10：仅回退三个旧同步handler原10项过；补runEpoch与异步载入口 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T06 | [ext_foundation_contracts.test.ts](../../src/test/ext_foundation_contracts.test.ts)<br>EXT-1a0 foundation versions and retained data > binds complete data identity and foundation version before invoking any factory | Z-N11：旧协议外壳原目标过；前提foundation10→13，身份/工厂断言保留 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T07 | [ext_optional_queries.test.ts](../../src/test/ext_optional_queries.test.ts)<br>2a0 optional read-only capabilities > exposes only frozen own state and selected player components, with detached frozen reply | Z-N12/13/28：仅移两只读口原35项过；严格键表加既有getComponent，补reward过期check | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T08 | [ext_optional_rewards.test.ts](../../src/test/ext_optional_rewards.test.ts)<br>2c optional reward preparation and atomic commit > prepares frozen own player data, expires live access and reruns preparation before applying | Z-N12/13/28：仅移两只读口原35项过；严格键表加既有getComponent，补reward过期check | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T09 | [map_tile_modes.test.ts](../../src/test/map_tile_modes.test.ts)<br>Independent map renderer catalog and knowledge boundaries > retains engine appearance and command pipeline; maps only at renderer boundaries | Z-N14：仅恢复原Canvas绑定块原断言过；检查实际canvasGameInput，输入边界不改 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T10 | [p2_6_display_settings.test.ts](../../src/test/p2_6_display_settings.test.ts)<br>P2-6 F: 源码守卫（设置 → 即时生效接线） > F1 GameCanvas：computeMapLayout 吃设置值，且 watch 模式切换触发 applyLayout | Z-N15：仅恢复旧布局两参数原断言过；检查真实usable视口及原第三参/watch | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T11 | [phase3a0_actor_action.test.ts](../../src/test/phase3a0_actor_action.test.ts)<br>3a0 engine actor preparation and synchronous authority > never exports an active fixture as a supported production save | Z-N16/21：旧wholeRun5外壳原4目标过；字面量前提5→6，原导出/存读语义不改 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T12 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > keeps the original ordering and forwards the perception range | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T13 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > runs the native remainder without repeating prelude effects or assigning movement time | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T14 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > keeps takeTurn as the same prelude-then-native wrapper | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T15 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > lets corpse absorption consume the decision before activation or state updates | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T16 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > retains the negative corpse-counter bypass | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T17 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > preserves the inner paralyzed gate after native terrain effects | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T18 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > preserves the inner entranced gate after native terrain effects | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T19 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > drops captive items at the original inner gate and skips perception | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T20 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > awakening spends the current decision and cannot enter the native remainder | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T21 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > a monster put to sleep by perception keeps original time ownership (ticks=0) | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T22 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > a monster put to sleep by perception keeps original time ownership (ticks=47) | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T23 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > does not apply hostile sleep consumption to an ally | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T24 | [phase3a0_native_prelude.test.ts](../../src/test/phase3a0_native_prelude.test.ts)<br>3a0 one-time native decision prelude > does not add its own random draws between the existing decision steps | Z-N17：仅撤两departure分支原14项过；非离开FakeGame补departureTurn=false | fixture/API批本文件完整通过（整批271过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T25 | [phase4a3_body_sfc.test.ts](../../src/test/phase4a3_body_sfc.test.ts)<br>4a-3 real client SFC paths via shared harness > GameCanvas shares mask geometry in four modes, one glyph, clears absent bodies and leaves ordinary sprite count | Z-N18：仅旧client视口原11项过；轻DOM补同几何getBoundingClientRect和空querySelectorAll | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T26 | [phase4a3_body_sfc.test.ts](../../src/test/phase4a3_body_sfc.test.ts)<br>4a-3 real client SFC paths via shared harness > GameCanvas mouse hover and right click resolve a tail, with public-mask hover and target edges only | Z-N18：仅旧client视口原11项过；轻DOM补同几何getBoundingClientRect和空querySelectorAll | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T27 | [phase4a3_body_sfc.test.ts](../../src/test/phase4a3_body_sfc.test.ts)<br>4a-3 real client SFC paths via shared harness > GameCanvas mouse throw clicks on another body cell only re-aim; same-cell third click confirms | Z-N18：仅旧client视口原11项过；轻DOM补同几何getBoundingClientRect和空querySelectorAll | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T28 | [phase4a3_body_sfc.test.ts](../../src/test/phase4a3_body_sfc.test.ts)<br>4a-3 real client SFC paths via shared harness > GameCanvas mouse arcana clicks on another body cell only re-aim; same-cell third click confirms | Z-N18：仅旧client视口原11项过；轻DOM补同几何getBoundingClientRect和空querySelectorAll | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T29 | [phase4a3_body_sfc.test.ts](../../src/test/phase4a3_body_sfc.test.ts)<br>4a-3 real client SFC paths via shared harness > GameCanvas mobile long press at the tail inspects the same creature without a command or RNG | Z-N18：仅旧client视口原11项过；轻DOM补同几何getBoundingClientRect和空querySelectorAll | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T30 | [phase4a3_body_sfc.test.ts](../../src/test/phase4a3_body_sfc.test.ts)<br>4a-3 real client SFC paths via shared harness > GameCanvas renders old ACK body geometry, then clears the old group, hover and target on a frame reset | Z-N18：仅旧client视口原11项过；轻DOM补同几何getBoundingClientRect和空querySelectorAll | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T31 | [phase4a3_body_sfc.test.ts](../../src/test/phase4a3_body_sfc.test.ts)<br>4a-3 real client SFC paths via shared harness > GameCanvas real replay seek replaces the old body drawing and removes hover/throw focus | Z-N18：仅旧client视口原11项过；轻DOM补同几何getBoundingClientRect和空querySelectorAll | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T32 | [phase4d_declarations.test.ts](../../src/test/phase4d_declarations.test.ts)<br>4d declared fixed zones, finite statuses and optional member profiles > peripheral mental overrides replace locally while shared fear stacks once and custom closure is strict | Z-N19：仅将slumber移到表末原拒绝过；按paralyzed身份做原entity→group损坏 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T33 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > title → normal: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T34 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > death → normal: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T35 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > restart → normal: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T36 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > seek → normal: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T37 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > title → easy: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T38 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > death → easy: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T39 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > restart → easy: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T40 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > seek → easy: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T41 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > title → wizard: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T42 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > death → wizard: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T43 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > restart → wizard: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T44 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > seek → wizard: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T45 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > title → test: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T46 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > death → test: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T47 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > restart → test: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T48 | [u_00_new_run.test.ts](../../src/test/u_00_new_run.test.ts)<br>U00 full new-run equivalence > seek → test: reused A→B equals fresh B, whole graph and both RNG streams | Z-N20：唯一区别worldWorkCommandEpoch；新局/成功载入归零，并以world5根身份拒绝旧工作句柄 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T49 | [u_15a_shattering.test.ts](../../src/test/u_15a_shattering.test.ts)<br>U15a real inventory read + U01 v2 JSON round trip > protected machine and ordinary wall behave identically after reload=true | Z-N16/21：旧wholeRun5外壳原4目标过；字面量前提5→6，原导出/存读语义不改 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T50 | [w_11_teleport_placement.test.ts](../../src/test/w_11_teleport_placement.test.ts)<br>W-11 generic placement and C-5 entry effects > CE fire-trap depression prevents retrigger until the next objective environmental update | Z-N22：仅撤新增结构火推进原38项过；FakeGame补depth1，原环境步断言保留 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T51 | [x3_u5_commands.test.ts](../../src/test/x3_u5_commands.test.ts)<br>X3-U5 command intent, snapshots and replay > run survives JSON save/load at the same yielded step | Z-N23：真实Writer为Direction整数；生产严格验证0..7，非run仍禁字段，并加畸形拒绝 | final-causal批本文件完整通过（整批368过/1别文件败） | 关闭（作者复测，待R1） |
| Z-T52 | [crafting_projection.test.ts](../../src/ext/modules/crafting/tests/crafting_projection.test.ts)<br>crafting deterministic real-world projection > projects nearby owned node availability and never virtually regenerates it | Z-N24：仅旧非虚拟SDK原4项过；原3/1节点显式当前tick已物化，另20次虚拟读7/5且零写 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T53 | [combat_square_replay.test.ts](../../src/ext/modules/combat/tests/combat_square_replay.test.ts)<br>3b configured combat with an actual naturally generated optional square actor > seed 7306 D3 ridgeback uses telegraphed native segments, each phase survives save/load, and the natural command recording replays | Z-N25：只撤两giants2模板原自然+raid五目标过；有界正常seed7308，600/200/8及全部断言不改 | 最后三自然文件13/0；随后全ext exit0；原失败标题7306，现7308 | 关闭（作者复测，待R1） |
| Z-T54 | [ext_growth_creation_ui.test.ts](../../src/ext/modules/growth/tests/ext_growth_creation_ui.test.ts)<br>EXT-1e mounted new-game identity chooser > absorbs a selected-start double-click transition for 600ms without simulation/RNG or keyboard dispatch, then restores focus | Z-N26/27：仅撤新focus分支原17项过；补纯显示closure/布局/request依赖 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T55 | [ext_growth_modal_advancement.test.ts](../../src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts)<br>EXT-1d actual canvas display loop while the skill modal remains open > finishes a committed animated equip once, including checkpoint, without waiting for the panel to close | Z-N26/27：仅撤新focus分支原17项过；补纯显示closure/布局/request依赖 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T56 | [ext_growth_modal_advancement.test.ts](../../src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts)<br>EXT-1d actual canvas display loop while the skill modal remains open > settles one animated brace skill and its final recording while keeping automatic actions frozen | Z-N26/27：仅撤新focus分支原17项过；补纯显示closure/布局/request依赖 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T57 | [ext_growth_modal_advancement.test.ts](../../src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts)<br>EXT-1d actual canvas display loop while the skill modal remains open > settles one animated survey skill and its final recording while keeping automatic actions frozen | Z-N26/27：仅撤新focus分支原17项过；补纯显示closure/布局/request依赖 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T58 | [ext_growth_modal_advancement.test.ts](../../src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts)<br>EXT-1d actual canvas display loop while the skill modal remains open > drains native hunger ACK-following display delays while the character panel stays open | Z-N26/27：仅撤新focus分支原17项过；补纯显示closure/布局/request依赖 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T59 | [ext_growth_modal_advancement.test.ts](../../src/ext/modules/growth/tests/ext_growth_modal_advancement.test.ts)<br>EXT-1d actual canvas display loop while the skill modal remains open > does not advance a read-only replay, even if it has a pending native action | Z-N26/27：仅撤新focus分支原17项过；补纯显示closure/布局/request依赖 | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T60 | [narrative_rewards.test.ts](../../src/ext/modules/narrative/tests/narrative_rewards.test.ts)<br>EXT-2c narrative optional reward transactions > gives preparation only deeply frozen own-state, player-component, actor and resource inputs | Z-N12/13/28：仅移两只读口原35项过；严格键表加既有getComponent，补reward过期check | 全ext exit0（292过/1原skip文件，5862过/1原skip项） | 关闭（作者复测，待R1） |
| Z-T61 | [resident_captive_natural.test.ts](../../src/ext/modules/settlement/tests/resident_captive_natural.test.ts)<br>normal seed3 current-source UI route rescues the natural D3 original goblin, builds a paid camp/bed and recruits No/Yes with replay/continuation | Z-N07：旧12包+旧摘要壳原239过；原RESIDENT_FORMAT_CAPTURE仅24摘要叶更新，输入/机械原断言不改 | 最后三自然文件13/0；随后全ext exit0 | 关闭（作者复测，待R1） |
| Z-T62 | [resident_natural.test.ts](../../src/ext/modules/settlement/tests/resident_natural.test.ts)<br>normal new-game core/day-food: original956, same actor/crop carry, guard, stairs, home and persistence | Z-N04：旧12包+旧摘要壳原956过；原RESIDENT_FORMAT_CAPTURE仅24摘要叶更新，输入/机械原断言不改 | 最后三自然文件13/0；随后全ext exit0 | 关闭（作者复测，待R1） |
| Z-T63 | [settlement_raids.test.ts](../../src/ext/modules/settlement/tests/settlement_raids.test.ts)<br>R1-F1 native polymorph preserves raid identity and strict references with [ 'settlement', 'giants' ] | Z-N05/06：只撤两giants2模板原五目标过；离层夹具不搬动有movementRegionId怪物，严格loader不改 | raid整文件28/0；随后全ext exit0 | 关闭（作者复测，待R1） |
| Z-T64 | [settlement_raids.test.ts](../../src/ext/modules/settlement/tests/settlement_raids.test.ts)<br>R1-F1 native polymorph preserves raid identity and strict references with [ 'settlement', 'combat', 'giants' ] | Z-N05/06：只撤两giants2模板原五目标过；离层夹具不搬动有movementRegionId怪物，严格loader不改 | raid整文件28/0；随后全ext exit0 | 关闭（作者复测，待R1） |

七个unhandled rejection单列，不算第65–71个测试失败：首次完整结果实际七次TypeError `el.getBoundingClientRect is not a function`，均来自同一轻DOM挂载前提，并造成Z-T25–31原七项失败。仅回旧client视口的原11项反事实通过；当前夹具补真实同client几何和空抽屉querySelectorAll，fixture/API该整文件11项通过且无unhandled，随后全ext也通过。没有吞错、加异常排除或以浏览器通过替代轻DOM结果；真实浏览器仍待人工。首次七错误消息与exit1保留在results/normal-test-fixture-fix.json。

## 历史15行范围续跑与中断处置（2026-10-10，463/591后来废止）

已读取scope-update-15、更新任务书§5与维护者顶部；matrix.py现只有15个字面retain集合（7个长度6、7个长度1、1个长度0），启动校验唯一集合数15及路径和463，所有原CLI调用均显式--retain。status.py/run.py/progress、README/HANDOFF/设计§14/当前遗留已切15/463/591。旧默认127衔接与重复128链已禁用，不启动。

维护者列出的39577/66903/66904/66905/66906在libproc实际核对均不存在且无子进程（live self对照成功；ps受沙箱拒绝，无提权）。中断的normal128重复无最终通过结果；scope-interruption-summary.json保留维护者SIGINT/旧wrapper exit1原因，删除其临时部分输出，不把中断列产品失败或实现完成。原正式128及两既过行64均保留、重复不累计。旧只有临时用途的counter副本已清理。

必要受影响补验已完成：新源ccba41f3…，实删settlement与实删narrative各新copy的boundary/types/build均exit0；七直接消费/完整图/C4/守卫整文件分别80通过（131.56s）与78通过（124.25s），0真实skip/todo。差两项来自原P4按实际安装组合发现，未加skip。真实缺包档/录像拒绝与完整活局/两流/ID/根身份、strict classic均通过。此前原完整剩余ext及所注明的窄修范围沿用；19个既有CellProperties函数体逐一未变，仅纯UI知识/DEV floor谓词搬移且原条件完全保持，不涉及录制/随机/生成/实际输入路径，所以不再次运行原128或既过行64。正常原7受影响文件80项也已通过。

growth单删新尝试用ccba41f3候选真实整目录删除、清缓存，boundary/types/build已过，正串行执行全部剩余ext；后续完整smoke64与真实缺包旧档/录像拒绝仍需实际运行。当前唯一已过2/15、128/463删除路径，加原正常128共256/591；其余13批准行继续实际门禁，112其它物理布局未验且范围外。独立审查仍0轮，完成后READY→停写→父R1，不能将维护者范围中断当READY。

第三行运行中已输出五项失败（尚无最终计数）：settlement_raids 的 R1-F1 surviving fall；ext_stats_runtime 的 growth component proposal；ext_stats_review 的 acid corrosion geometry / takeTurn；giants2_parts 的 G2-REWARD giants+growth。源输入尚未修改；待完整首次结果结束，串行进行仅恢复growth目录的单变量反事实及保原断言的最小前提修复。

## Z-N35 growth缺席测试前提（第三行，执行中）

第三行ccba41f3候选整growth目录真实删除，boundary/types/build各exit0；全部剩余ext实际exit1：256文件251过/4败/1原条件跳过，5081项5074过/5败/2真实skip，4988.37s。两skip是原C5_PERF默认条件与combat_adapters原growth专属part-break用例，未新增或扩大skip。真实growth旧档/录像拒绝、严格classic及完整活局/双RNG/ID/根身份保持均exit0；smoke尚未执行，不计该行路径通过。首败summary保留在removal/keep-combat+crafting+foraging+giants+narrative+settlement-retry2/summary.json。

同一临时副本原目标六项（五失败加原giants奖励控制项），仅删除growth时5败/1过，原Vitest5.27s；只恢复growth目录、不改任何测试/生产文件后6过，15.94s。84项为名字未选择，不是新增真实skip。四个缺growth manifest失败和一个缺descriptor解引用由安装前提造成；registry保持严格拒绝，守卫/扫描器/黄金/生产规则均未改。

最小修复只改四个测试文件：酸蚀两入口使用实际安装的原growth计划，缺席时真实extended空manifest仍走完整原生防御缓存与存读；属性提案仍优先实际growth provider，缺席时以独立proposal-fixture组件provider加另一实际stats-fixture provider倍增，维持+6/完整快照/RNG不变断言，绝不注册伪growth或空壳；巨兽原两组可选计划投影实际安装并去重，完整终结/kill唯一/零掉落等断言不变；袭击幸存坠层计划投影实际安装，growth存在仍核原整数经验与零增益，缺席核无经验组件且坠层前后一致，全部离层/返回/原生死亡/经济暂停/完整拒绝断言保留。正在串行复测四整文件正常树、growth缺席及已过两行的相关范围，另验全删时两底座整文件；未将窄副本当正式删除行。

Z-N36 独立全删底座补验：两个底座文件55项中54过/1败，力量药水用例硬编码combat manifest。该同一全删副本只恢复combat目录，原目标1通过（2.06s；28为名字未选），其余六模块仍缺席。最小调整仅将其combat输入投影为实际安装列表，并以同一registry构造原初始化；完整原生药水消耗/flare前力量+1与堆叠量2→1断言不变。随后只补验这个受影响文件及全删两底座；先前四文件正常90、缺growth89、既过两行62/90结果保留，其它三文件源码不变。一次反事实准备命令因临时cwd路径指向自身以及系统Python3.9解析旧wrapper引号失败，未启动测试；改为绝对仓库输入及兼容引号后执行上述真实反事实，不计产品失败或通过。

Z-N35/36受影响复测结论：四整文件正常90过（109.99s）、growth缺席89过（108.87s）、已过删除settlement行相关三文件62过（14.64s）、删除narrative行四文件90过（112.06s），均0真实skip/todo。力量药水追加窄修后，全删两底座整文件55过（8.06s），最新stats-review整文件在正常/growth/settlement/narrative各29过（5.36/5.16/5.39/5.27s）；其它三文件不变。旧全删55项的1败/exit1保留，不能把该失败批次称绿。最新源聚合a3868d2afd140bd1eafbf9b43399fff5cc9ea2b314711f10e4080a34e12fc074（1294输入），只四测试文件变化；实际生产dist仍d81dcb925dd2bf38f03a28d6fe6da25d34849c9f1201fa8b86d97a8fa87a561f（60文件），无需重复未受影响正常128/全ext/drift/生产build。第三行新copy已真删growth，正在boundary/types和原smoke64；两既过行所有保留的受影响文件及最新stats-review均补验，不将该修复解释为只影响一行。

## 双场景合同落实（执行中）

新源码选择`--combinations endpoints`仅改变输入计划，不改exerciseGame、原存读/回放/seek/续录/两RNG/缺模块断言。删除脚本在真实removed行显式传入，正常full行及独立脚本不传时仍全部子集。独立纯选择器验默认128唯一、双端点、单留双端点、全删仅空集及错误选项严格拒绝；原removalGates精确命令断言仅按用户新合同新增endpoint参数，所有其它门禁、CE禁调用、真实物理删除/归属/cache断言保持。

源码脚本选择变化影响全部删除入口；已过两行原64含各空集/全开，不需重复smoke，额外124保留。只补验新脚本守卫在正常和两已过物理布局的整文件；正常默认all同原计划枚举、真实Game函数不变，原128保留。类型首次TS7016缺新mjs声明已保留结果；按现有脚本模式新增.d.mts，未改类型守卫或断言。恢复growth行唯一已准备物理副本，更新必要脚本/守卫后只跑受影响boundary/types/守卫、双endpoint和真实旧档/录像拒绝；沿用其完整ext的未受影响部分及build，四失败文件89项和最新stats-review29项准确归入该真实行，不冒称新整批全绿。

第三行正式受影响收口已结束（新endpoint合同）：复用中断前真实growth缺席副本，最新boundary/types均exit0，脚本守卫整文件8通过（107ms），原smoke显式--combinations endpoints的空集/六模块全开两项均真实Game通过（20.02s包装）；真实growth档/录像拒绝、完整活局/双RNG/ID/根身份保持及严格classic均exit0。没有重跑全growth ext，也没有重启64批次。原完整ext251过文件中已改变的脚本守卫原7项另以最新8项替代，沿用剩余250过文件/4982项及1跳过文件/2skip；四失败文件原85过不沿用，以修后89项（最新stats-review29补验）替代，加守卫8共97唯一受影响项，不能把重叠的29再次相加。原5败/exit1保持firstFailures，build沿用原真正缺growth的exit0（仅测试/CLI计划改变，不进入生产bundle）。两既过行保留的全部变化测试前提、最新stats-review及新脚本守卫各整文件均已补验，原各64包含的2必验+62额外继续保留，不重复累计。

当前候选源聚合e9f243860dd2fe1ae285e9250cfd43e92c7279ada629585a7804307539b4fd8e（1296输入），实际dist仍d81dcb925dd2bf38f03a28d6fe6da25d34849c9f1201fa8b86d97a8fa87a561f（60文件）。原真实正常128默认all、完整Game断言与生产源无变化，结果保留；脚本选择和守卫新差量已补验。当前唯一通过3/15、删除必验6/29、正常128/128，共134/157要求；历史额外124，不将其放入157分子。第四行实删giants正运行；余12批准布局仍需全部原门禁及双场景。浏览器/真机未验，READY尚未交。

第四行运行中已输出6项旧可选giants前提失败（尚无最终计数）：settlement_raids的两bounded-wave参数、现存巨兽组邻接袭击用例、两polymorph参数；ext_world5_offline的world5-fixture+combat+giants原楼层返回闭环。源输入尚未修；完整剩余ext结束后保留首次结果，再仅恢复giants目录作单变量反事实，窄修后只受影响整文件及必要endpoint/拒档，不重跑未受影响全量。

第四行继续运行又输出第7项：ext_edible_review 的 P1 real body departure preserves formation and rejects hazards for every part。活动worker75246有1运行线程、RSS约1392MiB；非卡死或OOM。该用例也直接要求巨兽体型，将与前六项一并保留首败和单变量反事实；尚无最终批次计数。

## Z-N37 giants缺席前提（第四行，执行中）

完整首次实删giants原门禁：boundary/types/build均exit0，全部剩余ext exit1，265文件257过/7败/1原条件跳过，5515项5496过/11败/8真实skip，4278.61s；三份真正giants输入（基础、灯褶155、铜须615）的save/录像拒绝、完整活局/两RNG/ID/根身份及strict classic已过，尚不计该行smoke。11原名保留首败summary，包括此前日志未及显示的departure-runtime、structure-combinations/protection与settlement-persistence四项。

同一临时副本，第一组原目标12项在giants缺席时7败/5过（25.14s）；只恢复giants目录后12过（51.93s），96为名字未选。第二组同副本只删giants原8目标4败/4过（13.53s）；只恢复后8过（25.73s），35为名字未选。覆盖全部11失败，无断言/生产代码/守卫修改；因果是测试输入要求已被物理删除的可选pack。

修复仅测试前提与既有可执行fixture：一般组合计划投影实际安装模块并去重，保world5-fixture/c5fixture及原付费/游玩/存读/回放/seek/续录断言；三项真实body机制在giants缺席时使用已有完整body-fixture（独立nativeForms、nativeBodies、规则指纹），安装时仍原真实giants，不建立假giants目录或空壳，新增manifest证明实际giants是否存在。fgfixture原group命令只加可选bodyOwner，默认仍giants；原两调用之外没有其它group消费者。区域保护在缺席时同完整fixture加真实D3生成贡献，仍走原generateDepth及C5_OVERLAP断言，不注入region、不降低保护规则。原捕获/黄金/门限均未变。最新正常七整文件复测中；类型与边界已过，后续实删giants、已过三行保留的受影响整文件补验，不将全局fixture前提修改武断说成只影响一行。

Z-N37受影响复测完成：正常七整文件151/0（291.13s）、实删giants七整文件146/0（276.88s）；前三实际已过布局的所有保留变化文件各整批通过：实删settlement五文件113/0（169.40s）、实删narrative七文件151/0（288.20s）、实删growth七文件151/0（286.75s），均0真实skip/todo。全删窄副本五底座文件111/0（149.57s）亦过，不冒充正式全删行；两项参数折叠只因可选combat/giants皆缺席时原计划相同。body/arena在缺Giants时走既有独立完整fixture的真实引擎与生成接口，全部原形成/生命/成员/need/无死亡/存读/回放/危险拒绝/区域重叠等断言未削弱。当前dist不包含body-fixture、fgfixture或新arena fixture工厂（仅测试代码）；生产bundle输入/规则/协议和Game过程不变，旧实删build沿用、最新type/boundary另验。

11项逐项关闭映射（待正式endpoint收口，不混原npm64项）：N37-01/02两bounded-wave参数→实际安装投影/去重，保两敌预算/警告/独立持久化；03现存组旁袭击→安装时原giants、缺席已有完整body fixture，保占格无重叠/身份/受伤/核心死亡全组退场/袭击仍活跃；04/05两polymorph参数→实际计划，保原合法当前形态/原生死亡/出生白名单/原完整拒档图；06world5两层返回组合→保必需world5-fixture仅投影可选模块，保原公开返回一次结算/存读/回放/seek/续录；07 P1 body departure→完整fixture真实body，保危险全成员拒绝/队形/HP/组ID；08departure runtime→同真实body，保仅核心need、整体离队、不captureDeath和闭环；09结构组合→原可选计划投影，保真实付费floor/roof/door/bed、精确auto步骤与回放/seek/续录；10区域保护→安装原giants生成、缺席完整fixture真实D3生成，保revision0和C5_OVERLAP；11settlement持久化组合→投影实际可选pack并去重，保营地/地板付费及完整存读/回放摘要。上述分别由正常151与缺giants146整文件原断言通过关闭；原11失败/exit1保留，不能把首批说绿。

第四行正式受影响收口已完成：新copy真删giants，boundary/types exit0，原smoke显式endpoints的空集/六模块全开均真实Game通过（10.02s包装）；基础giants、灯褶155、铜须615三份真实档/录像拒绝、完整活局/两RNG/ID/根身份及strict classic均exit0。原265文件/11败首批保留；沿用257原过文件/5356过项+1跳过文件/8真实skip，七原失败文件的140过不沿用，改用修后七整文件146过；5重复可选输入参数折叠，不新增skip。生产bundle输入未变，旧真删build exit0沿用；模板规则/格式/正常默认all/真实Game过程未改，原128及未受影响正常ext/drift保留。既过三行相关所有保留文件已全补验，不能说只影响本行。

最新源聚合ee31f90e4afad091c1625d78f9d29e63ddbbe6a72093950f6a210395e379efb7（1296输入），dist仍d81dcb925dd2bf38f03a28d6fe6da25d34849c9f1201fa8b86d97a8fa87a561f（60文件）。当前4/15布局通过、删除必验8/29+正常128=136/157要求，历史额外124单列；第五行实删foraging串行运行。后续11行范围/门禁保持，浏览器/真机仍待人工，READY未交。（本段为Z-N37收口时的历史阶段；Z-N38实际首败/修复见下文。）

第五行实删foraging运行中输出两项（最终计数待结束）：resident_production_food 的 mixed raw/roasted mushrooms... 与 registered offlineEligible crafting recipe... settlement 参数，涉及固定foraging前提。活动worker80150有1运行线程、RSS约993MiB；全量尚在运行，源输入未改，结束后保首败并仅恢复foraging归因。

第五行又输出resident_foraging_integration套件0 test：原文件已有if安装foraging才声明describe，缺包时Vitest没有测试而报套件失败；该旧安装守卫将保留，拟补真实缺包时原生居民/口粮/存读的负向场景，不放宽guard或加skip。完整原首批尚未结束，不将已输出2测试失败及空套件误说成最终2项全结果。

## Z-N38 foraging缺席测试前提（第五行，执行中）

首次实际整目录删除foraging，boundary/types/build均exit0；完整剩余ext exit1：273文件270过/2失败/1原跳过，4908测试4905过/2败/1真实skip，5372.46s，包装5404.84s。两失败原名为resident_production_food的mixed raw/roasted mushrooms...及registered offlineEligible crafting recipe...；另resident_foraging_integration原if安装才声明describe使缺包时0测试，真实套件失败。真实foraging档/录像拒绝、完整活局/两流/ID/根身份及严格classic已过，未跑smoke，不计该行路径。首次结果保留。

同一临时副本原选10个目标，只删foraging时原2败/1控制通过加空套件失败（14.62s）；只恢复foraging目录、不改其它代码后原10目标全部通过（72.13s）；5项为名字未选择，非真实新增skip。最小修改两测试文件：配方计划仅投影可选foraging并去重，原crafting-only写入故障整图回滚/批次/产物/存读断言保留；食材用例正常仍真实venom/prism-roasted/char，缺席用既有独立完整fgfixture，私有定义给原料毒/烤料幻觉及焦料无食材tag，保混合数量2+3、焦料残留1、知识不变、无毒/幻觉和resupply C5_INPUT断言，不伪造foraging模块。原真实foraging所有权七项和安装守卫原样保留，缺席新增真实No纯读/Yes招聘/释放不创伴随根、离层只耗家口粮和真实待坠层归属三项，均存读闭环；不是skip或宽化守卫。当前仅做正常及实际缺包受影响整文件复测，随后补既过布局保留文件与本行必要门禁，不重跑整行全ext。

N38类型首次exit2（TS2322）：新私有fixture从descriptor可选rules展开造成schema类型可能undefined；改显式schema1及descriptor.version，实际运行时规则对象值相同，不宽化类型。正常types复验exit0。补验准备一度误用临时cwd源路径，copy报SameFileError，随后的旧副本正常8项结果不计缺包补验；首次结果保留，正确绝对源更新+实际删foraging后只复测受影响食物整文件。其它三缺包所有权项与既过正常foraging分支未变，不重复。

Z-N38受影响复测完成：正常两整文件15过（90.64s）；实际缺foraging两整文件10过（49.79s，7食物+3真实缺包所有权），0真实skip/todo；既过删除narrative、growth、giants行各两整文件15过（85.99/85.46/91.67s）。删除settlement行两个变化文件皆真实缺席且私有fixture无其它消费者，不运行空文件列表、不虚报通过。正常types与本行新真删copy边界/types均exit0，两个endpoint均真实Game通过，真实foraging档/录像拒绝及strict classic仍过。

逐项关闭：N38-01 mixed raw/roasted mushrooms→正常真实原pack/缺席独立完整食材fixture，原混合2+3/焦1、知识/毒幻觉/再供应拒绝断言保持；N38-02 registered offlineEligible crafting recipe含可选foraging计划→仅投影这个可选安装前提并去重，原crafting-only写入故障整图/RNG/ID/时钟回滚、唯一产物/1批次/存读断言保持；N38-03原空suite→真实foraging七项与安装guard保持，实际缺席新增三项无伴随根及居民口粮归属测试，非skip/放宽guard。首次2失败+空suite保留；同一临时副本只恢复foraging原10目标过提供因果依据。

第五行正式收口沿用原270通过文件/4899过项及1跳过文件/1真实skip（排除原失败food文件6过，原integration0测试），两完整失败文件以最新10过替代。旧实际缺包build exit0沿用，仅两个测试文件内前提变化，不进入生产bundle；最新边界/types另验，既过四行所有保留变化文件影响已核，不声称只一行或新单次全ext绿。最新源聚合 ffbbe5924def9d59002c4bbaad5d016977aecfde885b8b9677a3aa8f7c497db5（1296输入），dist仍d81dcb925dd2bf38f03a28d6fe6da25d34849c9f1201fa8b86d97a8fa87a561f（60文件）。当前5/15布局关闭，删除必验10/29+正常128=138/157，额外124单列；第六行实删crafting接续，剩余10行门禁完整保留。浏览器/真机未验、READY未交。

N38补验流程失误补充：上述旧副本正常8项在尚未取得类型子进程完成回执时误启动，发生短时重叠；不计缺包/新源门禁，也不纳入串行正式结果。类型exit0回执确认后，正确7项实际缺包食物复验与后续正式边界/types/endpoint/拒档均按串行完成。未用该错误尝试证明新候选。

第六行首次完整ext运行中又输出composition原整文件3失败：combat、combat+growth+narrative、foraging+giants+growth+narrative开局/游玩/存读/回放/seek/续录；该原79项文件在全部剩余test:ext门禁中执行，未改其枚举或断言。它不是独立删除smoke，删除CLI仍显式只选两endpoint。本批另growth反向注册闭环1失败，最终计数/错误原因待完整退出后核对，不预认全部为安装前提或超时。

第六行完整ext当前已输出19失败（未终局计数）：growth反向注册1、composition原整文件3、resident_production_food的provider fault及两recipe参数3、resident_production_codec四bad catalog4、ext_fire_contact_runtime的真实crafting炉灶/六故障写口/真实炉灶投掷8。原测试名/首次诊断待完整结果汇总；生产源未改，不以持续安静日志判死或通过。人工清单已补明确候选dist和跨24视口用公开当前版本存档复用，三个self955完整新局不省略；作者/父浏览器0项。

## crafting 删除行：维护者初步分类（2026-10-10 12:37，完整批次未结束）

当前5/15删除行关闭、删除必验10/29；正常128通过保留，历史额外124单列。原20项现新增resident_performance 1项，共21项输出失败，均不是最终批次计数。

| 分类 | 用例组及数量 | 证据与处理 |
| --- | --- | --- |
| 硬编码安装前提，待单变量证实（16） | resident_production_food：provider rollback 1、registered recipe 2；resident_production_codec：bad catalog四种4；ext_fire_contact_runtime：hearth1、六个故障回滚6、thrown hearth1；settlement_persistence：no settlement1 | 源码直接residentScene/setup/forage传入crafting，或直接读取crafting桌/配方/炉灶。只恢复crafting目录、不改断言作反事实；确认后按实际安装构造。正常安装仍走原真实crafting；缺包时对通用能力用独立fixture提供完整配方/炉灶语义，或明确验证能力不可用，不伪造crafting模块、不删断言、不新增skip。不能只filter掉crafting再解引用其定义。 |
| 独立归因，不能归入缺包前提（4） | ext_growth_optional_rewards反向注册1；ext_module_composition中combat、combat+growth+narrative、foraging+giants+growth+narrative各1 | composition已从实际安装描述符枚举；这些组合无crafting。4项时长约49.6/63.1/34.4/34.8秒，原门限30秒，但完整错误尚未输出，暂不能断定纯超时。完整批次结束后按原门限单worker窄复现，区分耗时、断言及存读/录像缺陷，不提高门限。 |
| 新增独立性能失败（1） | resident_performance：4营地64工人长期needs/FOOD/事实与源GC | 耗时约71秒，包含状态断言及peak≤50ms门限；完整错误待输出，不能由标题判断缺陷类别。原场景/断言/门限串行复核，若真实预算或状态缺陷，单列原因、影响、修复建议交用户。 |

当前没有已确证的新增生产缺陷；以上独立归因5项仍未关闭，不代表无缺陷。可能影响分别是奖励与存档录像一致性（1）、组合生命周期/重放seek（3）、64居民性能/回收与状态正确性（1）。

当前完整剩余test:ext持续换worker，不打断、不并发重测。原作者已准备crafting-row-availability-counter.py，强制首轮全ext结束后，在同一临时副本仅恢复crafting目录进行对照。其现有脚本尚未纳入新出现的resident_performance，收尾须按最终失败清单补齐独立窄复现。保持唯一作者，不启动第二个生产写入者；修复后只复测受影响文件及之前已通过删除行中仍保留的受影响文件，再完成当前行门禁。

剩余时间：progress按已关闭行平均给出13.82小时，仅作剩余矩阵约14小时的机械粗估。当前crafting行已接近3小时，后续单留/全删布局更小，误差较大；归因修复、R1/R2和推送时间另计，尚不能给可靠收口时刻。

## Z-N39 crafting缺席首次结果与窄归因（第六行，执行中）

最新ffbbe592…候选真删crafting，boundary/types/build均exit0；全部剩余ext首次exit1：275文件266过/8败/1原skip，5024项5000过/23败/1原skip，10765.71s，包装10816.59s。真实crafting档/录像严格拒绝、完整活局/两流/ID/根身份及strict classic均过；独立smoke尚未跑，不计本行要求完成。首次结果保留removal/keep-combat+foraging+giants+growth+narrative+settlement/summary.json。

23项明确分开：18个Unavailable crafting（火接触8、food3、codec4、materials2、persistence1）；4原30秒超时（composition的combat、combat+growth+narrative、foraging+giants+growth+narrative，growth ready反向注册true）；1居民四营64worker性能P95 53.08024999999907ms超过原50ms。不能把后五项归成安装前提，不提高30秒或50ms，不修改原捕获方法。已在一份临时副本按具体原名选择29目标（包括控制项），先只删crafting，再只恢复其目录，原测试/生产不改；未枚举独立64删除smoke。

N39同一副本原29目标，缺crafting18败/11过（156.76s），只恢复crafting后29过（224.27s）；分别134/199项是名字未选择，不是真实新增skip。18缺包前提有单变量复现/恢复因果；后5项在仍缺包、原源码、原30秒/50ms门限下已过，不能归因crafting，具体调度/热状态未测量，不声称查明某个系统原因。首次超时及P95 53.08025仍保留；受影响原门限用例同候选复验关闭，不修改阈值/捕获/生产代码。

五测试文件最小前提：坏目录四项及prepare provider fault只投影可选crafting初始化，原故障返回/整图/ID/两流断言全保；无settlement的定义/营地UI空态用实际可选输入，原三个断言全保；材料与炉灶缺包时用既有完整craftskel执行模块的私有定义（木tag、床kit tag、hearth station tag及规则指纹），真实pack存在仍原ID/路径，原消耗8→扣2/退款1、kit不转换/不返套件、热接触全链/六写口回滚/逐条存读回放/seek续录保持。配方生产真实crafting仍原桌台/木6/kit1/模块craftBatches1；缺席以真实已安装settlement的私有声明注册同workTicks500/输入木6/输出kit1的配方，并用真实own-state writer检验原validateState故障整图/两流/ID/时钟回滚。两分支补明确terminal completedBatches1；缺包额外核没有crafting状态、catalog能力真实absent，不注册假crafting、不宽化生产的owner/schema守卫。公开订单/40wait/存读捕获不变，参数仅按实际可选foraging/crafting投影并去重，没有skip。

N39正常类型首次TS2339（新私有定义的readonly数组不能push）exit2已保留；改为按WorldDefinitionPack类型构造新items/recipes数组，无类型放宽，复验exit0。正常五整文件65项通过（313.34s）；正在真实无crafting和既过五行的全部保留变化文件复测，新增夹具无生产bundle消费者；NoForaging私有edible fixture同时改为保留原注册模块对象再赋定义/规则，避免丢其WeakMap fixture口，原模块与行为不动，相关食物整文件纳入实删foraging影响补验。

N39夹具首轮纠错结果保留：五整文件缺CRAFT 52过/12败（火8 tags未按schema排序、材料2重复craftskel、持久化1经典runtime为空、食物1故障作用域过早）；codec整23已过且之后未改。改为独立material-fixture全定义/内部引用/文本owner、排序stationTags、真实扩展runtime后，四文件40过/1食物败（229.64s）：其它三文件33过，食物原故障注入Raw worldWorkFact返回原异常而非C5_PROVIDER，不能称该批绿；全删火接触22过、正常食物8过为独立窄补验，不计正式行。replaceAll超出现行lib类型首次TS2550保留，改等价split/join后types过。

最终食物故障前提恢复原真实writer机制：合法participant调用tx.replaceState(tx.state)，仅该调用期间真实validateState返回false，原Runtime.writerFailed纵使participant捕获异常仍必须以C5_PROVIDER拒绝；注入之后捕获整图，原整图/双RNG/ID/时钟/产物/重试断言原样。正常CRAFT仍原无条件validator false路径。最新正常types exit0（76.53s），缺CRAFT食物整8过（73.72s）、正常食物整8过（41.34s）；旧7过/1败食物结果不沿用，原codec23+纠错其它三文件33+最新food8=64唯一受影响通过项，不能累加重叠。五既过物理布局所有保留变化整文件已过（22/65/65/64/64项），有CRAFT时这些后续私有缺包纠错分支不执行，正常食物最新8另验；不声称仅影响第六行。

N39原23项逐项关闭映射（作者结论，正式endpoint/拒档另计；原首败不覆盖）：

| 稳定编号／原测试名 | 原因与单变量证据 | 最小修复与受影响复测 |
| --- | --- | --- |
| Z-N39-01 `src/test/ext_fire_contact_runtime.test.ts > fire contact foundation > real crafting hearth definition authorizes roast with whole stack and no native draw` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 有pack保持原真实炉灶；缺pack独立完整material-fixture真实hearth/规则/所有权，保持热接触全链与六写口回滚。 修后缺包火接触整文件22过（纠错批中），原断言/捕获不变。 |
| Z-N39-02 `src/test/ext_fire_contact_runtime.test.ts > roast failure after transform restores every independent native write and owner` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 有pack保持原真实炉灶；缺pack独立完整material-fixture真实hearth/规则/所有权，保持热接触全链与六写口回滚。 修后缺包火接触整文件22过（纠错批中），原断言/捕获不变。 |
| Z-N39-03 `src/test/ext_fire_contact_runtime.test.ts > roast failure after fact restores every independent native write and owner` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 有pack保持原真实炉灶；缺pack独立完整material-fixture真实hearth/规则/所有权，保持热接触全链与六写口回滚。 修后缺包火接触整文件22过（纠错批中），原断言/捕获不变。 |
| Z-N39-04 `src/test/ext_fire_contact_runtime.test.ts > roast failure after participant restores every independent native write and owner` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 有pack保持原真实炉灶；缺pack独立完整material-fixture真实hearth/规则/所有权，保持热接触全链与六写口回滚。 修后缺包火接触整文件22过（纠错批中），原断言/捕获不变。 |
| Z-N39-05 `src/test/ext_fire_contact_runtime.test.ts > roast failure after message restores every independent native write and owner` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 有pack保持原真实炉灶；缺pack独立完整material-fixture真实hearth/规则/所有权，保持热接触全链与六写口回滚。 修后缺包火接触整文件22过（纠错批中），原断言/捕获不变。 |
| Z-N39-06 `src/test/ext_fire_contact_runtime.test.ts > roast failure after DF restores every independent native write and owner` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 有pack保持原真实炉灶；缺pack独立完整material-fixture真实hearth/规则/所有权，保持热接触全链与六写口回滚。 修后缺包火接触整文件22过（纠错批中），原断言/捕获不变。 |
| Z-N39-07 `src/test/ext_fire_contact_runtime.test.ts > roast failure after render restores every independent native write and owner` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 有pack保持原真实炉灶；缺pack独立完整material-fixture真实hearth/规则/所有权，保持热接触全链与六写口回滚。 修后缺包火接触整文件22过（纠错批中），原断言/捕获不变。 |
| Z-N39-08 `src/test/ext_fire_contact_runtime.test.ts > real thrown stack landing into real-hearth preserves identity/quantity and recording` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 有pack保持原真实炉灶；缺pack独立完整material-fixture真实hearth/规则/所有权，保持热接触全链与六写口回滚。 修后缺包火接触整文件22过（纠错批中），原断言/捕获不变。 |
| Z-N39-09 `src/test/ext_module_composition.test.ts > EXT-2a0 installed module combinations > opens, plays, saves, loads, replays, seeks and continues combat` | 首次超过原30000ms；与缺crafting无已证实因果，未测量调度/热状态精确原因。 同候选crafting仍缺席、原源码及原30000ms通过；只恢复crafting后亦过，不支持缺包归因。 | 无生产/测试源码或门限变更；原失败目标窄复验。 row6-crafting-absent-original.json原29目标11过中的本项；原18前提失败仍保留。 |
| Z-N39-10 `src/test/ext_module_composition.test.ts > EXT-2a0 installed module combinations > opens, plays, saves, loads, replays, seeks and continues combat+growth+narrative` | 首次超过原30000ms；与缺crafting无已证实因果，未测量调度/热状态精确原因。 同候选crafting仍缺席、原源码及原30000ms通过；只恢复crafting后亦过，不支持缺包归因。 | 无生产/测试源码或门限变更；原失败目标窄复验。 row6-crafting-absent-original.json原29目标11过中的本项；原18前提失败仍保留。 |
| Z-N39-11 `src/test/ext_module_composition.test.ts > EXT-2a0 installed module combinations > opens, plays, saves, loads, replays, seeks and continues foraging+giants+growth+narrative` | 首次超过原30000ms；与缺crafting无已证实因果，未测量调度/热状态精确原因。 同候选crafting仍缺席、原源码及原30000ms通过；只恢复crafting后亦过，不支持缺包归因。 | 无生产/测试源码或门限变更；原失败目标窄复验。 row6-crafting-absent-original.json原29目标11过中的本项；原18前提失败仍保留。 |
| Z-N39-12 `src/ext/modules/growth/tests/ext_growth_optional_rewards.test.ts > EXT-2c discovered narrative and growth ready > keeps choice, rewards, saves, replay and seek coherent with reverse registration=true` | 首次超过原30000ms；与缺crafting无已证实因果，未测量调度/热状态精确原因。 同候选crafting仍缺席、原源码及原30000ms通过；只恢复crafting后亦过，不支持缺包归因。 | 无生产/测试源码或门限变更；原失败目标窄复验。 row6-crafting-absent-original.json原29目标11过中的本项；原18前提失败仍保留。 |
| Z-N39-13 `src/ext/modules/settlement/tests/resident_performance.test.ts > measures real four-camp/64-worker long needs commits with native FOOD, bounded facts and source GC` | 首次P95 53.08024999999907ms>50ms；系统原因未测量，不能归于缺包。 相同缺包源码/场景/捕获在原50ms门限通过；只恢复crafting后亦过。 | 无生产/测试源码或阈值变更，原四营64工人/GC状态及P95断言窄复验。 同原29目标中本项过；不是新提高预算或删除性能断言。 |
| Z-N39-14 `src/ext/modules/settlement/tests/resident_production_codec.test.ts > bad catalog throw is an explicit atomic prepare refusal` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 仅可选初始化计划投影实际crafting；坏目录四种显式C5_INPUT/整图/ID/两流原断言保留。 修后缺包codec整文件23过，之后该文件未改。 |
| Z-N39-15 `src/ext/modules/settlement/tests/resident_production_codec.test.ts > bad catalog async is an explicit atomic prepare refusal` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 仅可选初始化计划投影实际crafting；坏目录四种显式C5_INPUT/整图/ID/两流原断言保留。 修后缺包codec整文件23过，之后该文件未改。 |
| Z-N39-16 `src/ext/modules/settlement/tests/resident_production_codec.test.ts > bad catalog foreign is an explicit atomic prepare refusal` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 仅可选初始化计划投影实际crafting；坏目录四种显式C5_INPUT/整图/ID/两流原断言保留。 修后缺包codec整文件23过，之后该文件未改。 |
| Z-N39-17 `src/ext/modules/settlement/tests/resident_production_codec.test.ts > bad catalog malformed is an explicit atomic prepare refusal` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 仅可选初始化计划投影实际crafting；坏目录四种显式C5_INPUT/整图/ID/两流原断言保留。 修后缺包codec整文件23过，之后该文件未改。 |
| Z-N39-18 `src/ext/modules/settlement/tests/resident_production_food.test.ts > provider failures restore the complete prepare object graph including references, IDs and random` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 仅可选初始化计划投影，保原故障口与完整prepare对象图/引用/ID/两流回滚。 最新缺包food整文件8过，正常food8过。 |
| Z-N39-19 `src/ext/modules/settlement/tests/resident_production_food.test.ts > registered offlineEligible crafting recipe actually produces with "settlement"` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 实际settlement私有完整配方木6→kit1/work500，公开订单/40wait/存读原流程；合法participant自状态写时validateFalse模拟原真实writer故障，runtime.writerFailed必须拒绝C5_PROVIDER/整图回滚。正常保持原真实crafting。两个原参数稳定编号按首次顺序保留，去重后缺包唯一同前提用例覆盖。 最新缺包food整文件8过/正常8过；增加terminal.completedBatches1及真实无crafting状态/catalog断言，未减原断言。 |
| Z-N39-20 `src/ext/modules/settlement/tests/resident_production_food.test.ts > registered offlineEligible crafting recipe actually produces with "settlement"` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 实际settlement私有完整配方木6→kit1/work500，公开订单/40wait/存读原流程；合法participant自状态写时validateFalse模拟原真实writer故障，runtime.writerFailed必须拒绝C5_PROVIDER/整图回滚。正常保持原真实crafting。两个原参数稳定编号按首次顺序保留，去重后缺包唯一同前提用例覆盖。 最新缺包food整文件8过/正常8过；增加terminal.completedBatches1及真实无crafting状态/catalog断言，未减原断言。 |
| Z-N39-21 `src/ext/modules/settlement/tests/settlement_materials.test.ts > accepts an explicitly selected optional bed kit without importing or converting its identity` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 缺包独立完整material-fixture；正常原wood/kit。kit身份不变、不转套件；木8消耗2/按实际定义退款1原断言保持。 修后缺包materials整文件2过（纠错批中）。 |
| Z-N39-22 `src/ext/modules/settlement/tests/settlement_materials.test.ts > consumes selected tagged material from one box and refunds its actual definition at remaining durability` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 缺包独立完整material-fixture；正常原wood/kit。kit身份不变、不转套件；木8消耗2/按实际定义退款1原断言保持。 修后缺包materials整文件2过（纠错批中）。 |
| Z-N39-23 `src/ext/modules/settlement/tests/settlement_persistence.test.ts > settlement traversal/persistence public commands > no settlement installs no production definitions or camp UI state` | 硬编码实际已删除crafting安装/定义前提，初始化Unavailable crafting。 相同副本只恢复crafting目录，原18失败目标均过（29/29）；缺包原18失败。 | 无settlement场景由真实完整独立material-fixture提供扩展runtime，仍无camp/生产定义/settlement UI原三个断言。 修后缺包persistence整文件9过（纠错批中）。 |

第六行正式收口：新临时副本真删crafting，最新boundary/types、原CLI显式2endpoint、真实crafting档/录像严格拒绝及strict classic均exit0。沿用原266过文件4860项、三未改失败文件94原过项及1真实skip；五变化整文件64唯一过项替代其原46过/18败，另5原时限/P95失败以同候选未改源码原门限通过替代。共5023有效通过+1原skip，不声称一轮新完整ext绿。build原真删exit0沿用（变化只测试/fixture，不进bundle）。源聚合 2ad7db7f3f65f97e3204a879246c3dae82cc95b2e7fcf7807420160b7a6ebbe6（1297输入），实际dist仍d81dcb925dd2bf38f03a28d6fe6da25d34849c9f1201fa8b86d97a8fa87a561f（60文件）。当前6/15布局、12/29删除要求+原正常128=140/157，额外124单列，余9布局串行；人工未验，READY未交。

## Z-N40 combat缺席首次结果与逐项修复（第七行，执行中）

源2ad7db7f…（1297输入）真删combat：boundary/types/build均exit0；全部剩余ext首次exit1，259文件248过/10败/1原skip，4968项4949过/18败/1原skip，10036.61s（包装10086.79s）；真实combat档/录像拒绝、全活局/两RNG/ID/根身份及strict classic过。尚未跑本行两endpoint，不计新路径。首次summary保留。

同一副本原名单窄复现17败/2过（39.36s；116名字未选），只恢复combat目录后19过（370.19s；120名字未选）。差量是14个硬编码不可用combat、2个无combat属性键声明错误、1个巨兽拒绝输入快照前提；原narrative 30秒超时在仍缺combat未改代码、原门限已通过，不归因为缺包或声称测明系统波动原因。

巨兽拒绝输入的临时叶诊断只发现旧预期多一条持久日志和nextId+1；当前Game拒绝走presentationOnly，只进displayMessages。只临时把Logger的presentationOnly反馈改送档案（不改机械证据、其它状态），combat仍实删，原完整图断言1过（22.93s）；临时Logger已恢复。正式用原toSaveSnapshot捕获验证全部世界/存档不变，并精确检查瞬时提示id−1/文本/颜色/次数/回合，实际生产Logger不改。两身体变换回滚测试原已允许无actor binding/resources，只错误固定查询不存在的combat容量键；正常仍原容量查询，缺包用实际native.max-hp验证原可信生效/回滚后的Actor查询，原完整图/资源身份（若存在）/两流/ID/事件唯一/死亡与成员断言保持。正常两整文件3过（11.41s），真实缺combat两整文件3过（10.72s）。两个命令名称误标absence/counter但cwd实为正常树，结果按实际正常控制归类，不充当缺包证据；正确缺包与单通道反事实各另验，首次结果不覆盖。

六个能力专用正例（world-work三个到期phase、篝火/制作双时钟、营地预警/韧性、离层冻结）的原全部断言在完整数据型底座协议夹具原型下已通过6项（23.99s，44为名字未选）。夹具完整声明双段攻击/资源/原生profile/篝火、使用真实底座排程/伤害/状态与世界验证；不是空壳、恒真validator或假成功返回。底座协议硬编码combat.*属性与combat bundle owner，所以此**单元测试后端**使用保留命名空间combat，但版本0.0.1/独立rules，绝非真实1.6.0 pack；仅这六项显式opt-in，正常仍实际生产pack。真实删除CLI、两endpoint与真正旧档/录像拒绝运行新生产registry，绝不注入该夹具；不把这六个受控SDK正例称“缺combat仍有真实combat玩法”。

其它通用测试前提最小调整：居民两公开raid replay与async的可选计划实际投影/去重，保原全过程；NPC同tick工作按实际计划去重；篝火/基础床的持久化原等值断言保留实际combat状态存在或缺席；每owner 128事实环用实际combat或已完整验证的独立material-fixture作为第二owner，环门限/另一个owner/重复收据拒档原断言不改；不注册空combat。无combat的foundation bundle拒档只在恶意候选中补原root，再送原foundation bundle，实际Game根不添加，原拒绝/旧玩家身份保持。活袭击伪造departed拒档保原全图/存档/活敌与scheduler身份，绑定状态/定义按实际可选有无捕获并保持；不虚造池或跳过断言。正常与实删combat十个原失败整文件串行补验中；首次18失败和夹具准备脚本ValueError保留，未重跑整行全ext。

N40逐项作者关闭映射（18原名；正式endpoint/拒档收口另计，首败保留）：

| 稳定编号／原测试名 | 原因／反事实／最小修复 | 受影响复测 |
| --- | --- | --- |
| Z-N40-01 `src/test/ext_actor_actions_root_world.test.ts > combat-only load rejects a foundation bundle before retiring the current Game` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 实际可选输入；仅恶意快照DTO缺root时补root再送原foundation bundle，实际Game不添根，原拒绝与旧玩家身份不变。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-02 `src/test/ext_combat_transition_facts.test.ts > 3g committed facts around successful 4e body transitions > phase restores the complete original graph when a later consumer rejects and succeeds on retry` | 无actor binding原已合法，但固定查询无声明combat容量键。 实际绑定有则原capacity、缺席native.max-hp可信查询；完整回滚/两流/ID/资源引用（存在时）/成员/事件与死亡断言保留。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-03 `src/test/ext_combat_transition_facts.test.ts > 3g committed facts around successful 4e body transitions > split restores the complete original graph when a later consumer rejects and succeeds on retry` | 无actor binding原已合法，但固定查询无声明combat容量键。 实际绑定有则原capacity、缺席native.max-hp可信查询；完整回滚/两流/ID/资源引用（存在时）/成员/事件与死亡断言保留。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-04 `src/test/ext_rest_point_runtime.test.ts > foundation RestPoint > combat bonfires and foundation rest points keep separate ledgers and survive load` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 实际可选初始化，原床数/模块状态完整等值存读断言保留（缺席确实无optional ledger）。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-05 `src/test/ext_world_work_review.test.ts > 5A2 independent review regressions > fact rings preserve 128 per owner and receipt ordinals cannot duplicate on load` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 实际combat或完整独立material-fixture作第二owner；每owner128上限、互不覆盖及重复收据拒绝原断言不变。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-06 `src/test/ext_world_work_transactions.test.ts > C5 scoped transactions and real clocks > starts NPC work before a later same-tick due work owner (modules=[ 'combat' ])` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 只投影可选combat并去重，原同tick顺序/工作根/资源/时间/无扫尾/存读断言保留。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-07 `src/test/ext_world_work_transactions.test.ts > C5 scoped transactions and real clocks > commits world work while combat phase 0 is due without rebinding its live clock` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 只六能力正例显式完整底座协议后端；固定位namespace combat/独立0.0.1与rules，真实排程/资源/双段/炉火/全验证，原正例断言全部不改；正常原真实1.6pack。实际生产缺包和拒档另由无夹具CLI验，不能称缺包仍有真实combat玩法。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-08 `src/test/ext_world_work_transactions.test.ts > C5 scoped transactions and real clocks > commits world work while combat phase 1 is due without rebinding its live clock` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 只六能力正例显式完整底座协议后端；固定位namespace combat/独立0.0.1与rules，真实排程/资源/双段/炉火/全验证，原正例断言全部不改；正常原真实1.6pack。实际生产缺包和拒档另由无夹具CLI验，不能称缺包仍有真实combat玩法。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-09 `src/test/ext_world_work_transactions.test.ts > C5 scoped transactions and real clocks > commits world work while combat phase 2 is due without rebinding its live clock` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 只六能力正例显式完整底座协议后端；固定位namespace combat/独立0.0.1与rules，真实排程/资源/双段/炉火/全验证，原正例断言全部不改；正常原真实1.6pack。实际生产缺包和拒档另由无夹具CLI验，不能称缺包仍有真实combat玩法。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-10 `src/test/ext_world_work_transactions.test.ts > combat bonfire and foundation crafting share one clock, reject each other while busy, and keep separate receipts` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 只六能力正例显式完整底座协议后端；固定位namespace combat/独立0.0.1与rules，真实排程/资源/双段/炉火/全验证，原正例断言全部不改；正常原真实1.6pack。实际生产缺包和拒档另由无夹具CLI验，不能称缺包仍有真实combat玩法。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-11 `src/ext/modules/giants/tests/giants_committed_transition.test.ts > executes the formal active split and subsequent committed attack through normal commands with every installed optional module` | 错误把presentationOnly拒绝提示写入持久档案预期。叶差只多一条消息/nextId，单通道反事实原图过。 生产Logger不改；原捕获完整存档全部相等，精确瞬时提示id-1/文本/颜色/次数/回合另验。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-12 `src/ext/modules/narrative/tests/narrative_runtime.test.ts > EXT-2b actual Game dialogue with "narrative" > uses a natural nearby NPC and freezes resources while preserving active-save, continuation, replay and seek checkpoints` | 首次超原30000ms，具体波动原因未测量，缺combat原源码/原门限已过。 无源码/阈值/捕获变化，原候选原用例窄复验并十整文件复核；不归因缺包。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-13 `src/ext/modules/settlement/tests/settlement_raid_async.test.ts > 5Y async complete-boundary raid pause/return/recovery, damage and offline production with [ 'settlement', 'combat' ]` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 原可选计划按实际安装投影并去重，保全原公开袭击/暂停/返回/修复/原生变形/存读/回放/seek/续录断言。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-14 `src/ext/modules/settlement/tests/settlement_raid_replay.test.ts > S4 public controlled-origin raid, fixed enabled rules and actual freeze/close/recovery save/replay/seek with [ 'settlement', 'combat' ]` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 原可选计划按实际安装投影并去重，保全原公开袭击/暂停/返回/修复/原生变形/存读/回放/seek/续录断言。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-15 `src/ext/modules/settlement/tests/settlement_raid_replay.test.ts > R1-F1 public native polymorph, pause/return save/load/replay/seek with [ 'settlement', 'combat' ]` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 原可选计划按实际安装投影并去重，保全原公开袭击/暂停/返回/修复/原生变形/存读/回放/seek/续录断言。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-16 `src/ext/modules/settlement/tests/settlement_raids.test.ts > combat ordinary raid enters the existing native warning and poise pool, without treating walls as actors` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 只六能力正例显式完整底座协议后端；固定位namespace combat/独立0.0.1与rules，真实排程/资源/双段/炉火/全验证，原正例断言全部不改；正常原真实1.6pack。实际生产缺包和拒档另由无夹具CLI验，不能称缺包仍有真实combat玩法。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-17 `src/ext/modules/settlement/tests/settlement_raids.test.ts > combat S1/S4: a real raid windup, locked cells and resource pool freeze intact across public stairs, long cached time and save/load; return resumes that action once` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 只六能力正例显式完整底座协议后端；固定位namespace combat/独立0.0.1与rules，真实排程/资源/双段/炉火/全验证，原正例断言全部不改；正常原真实1.6pack。实际生产缺包和拒档另由无夹具CLI验，不能称缺包仍有真实combat玩法。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |
| Z-N40-18 `src/ext/modules/settlement/tests/settlement_raids.test.ts > R2-F1 forged departed cannot retire living camp invaders; candidate rejection preserves graph and session` | 固定要求实际已删除的combat安装前提；原同副本缺席复现、只恢复目录原19过。 实际可选安装，保原全图/存档/玩家会话/活敌/scheduler身份；绑定state/definition按真实存在或缺席捕获并保持。 | Normal whole10files139passed; physicalcombat absent whole10files131passed, 4 equivalent optional plans deduplicated; shareddefault4whole86passed normal/absent. |

N40最终影响核对：正常十整文件139过（1576.03s）、实删combat十整文件131过（619.90s），0真实skip/todo，四重复可选计划实际相同后去重；共享workGame其余四完整消费者（测试源码自HEAD未改，默认flag false）正常/实删各86过（154.57/139.54s），0真实skip。最新types91.8s exit0。六既过retain均实际保留combat：新缺包分支不执行，可选计划与原相同、容量键原样、巨兽缺combat分支不进、恶意候选原root存在、绑定等值对象原样、事实peer仍实际combat；opt-in后端检测实际combat即返回且不mock，导入只有纯定义校验，普通workGame默认false保持原工厂。正常139及默认消费者86验证共享活跃分支，逐六行按保留集合/源码路径作等价影响核对，**这不是六份新物理补验结果**；原实际production/layout/CLI/save输入不变因此沿用其既过门禁与路径，未来八缺combat布局必须用当前候选完整门禁。此全局测试前提影响说明不声称只一行；真实新第七行边界/types/2endpoint/拒档仍待结束。

第七行正式收口：新copy确证整个combat缺席，最新boundary/types、2个实际生产endpoint、真正combat1.6档/录像拒绝和strict classic全exit0，Node CLI无单元夹具mock。沿用244过文件4746过（原248过/4832剔四shared默认86），原十败文件117过不沿用，替换最新131过；四shared消费者最新86过另替换，合计4963有效过+1原skip，四重复计划去重，不虚增路径或新skip。旧真实缺包build exit0沿用，SDK/规则/格式/产品bundle输入未变。源聚合 3321b89a32517e497a2485479fdcf147eb2696bb0597aaca7da6310d1c9ce3f5（1298输入），dist仍d81dcb925dd2bf38f03a28d6fe6da25d34849c9f1201fa8b86d97a8fa87a561f（60文件）。当前7/15闭、14/29删除+原正常128=142/157要求，额外124单列；余8布局全部原门禁串行。浏览器/真机待人工，READY未交。

第八行仅留combat（实删其它六个完整目录）正常整档首次通过：boundary/types/build/全部剩余ext/实际生产2endpoint/真实六模块旧档录像拒绝全部exit0；139ext文件138过/1原skip，2610项2594过/16原skip，2320.82s（整行2373.4s）。16跳过为原C5性能1及combat adapters既有可选narrative/growth条件15，不新增skip/exclude。真实输入8份（六缺包基础+giants两自然输入），每份save/录像皆拒绝，全活局/双RNG/ID/根身份保持，严格classic过。SDK能力正例此布局直接用真实combat1.6，不启用0.0.1单元后端。当前8/15、16/29删除+原128=144/157，额外124单列；第九行仅留crafting继续。候选源3321b89a…/1298输入，产品dist仍d81dcb925…/60文件；浏览器/真机未验，READY未交。

第九行仅留crafting完整首次通过：整个其它六包删除、清缓存后boundary/types/build/全部剩余ext/2个新生产registry endpoint/真实缺包拒档全部exit0；123ext文件122过/1原skip，2637项2636过/1原skip，1460.15s（整行1491.4s），0新skip/todo。8真实输入的save/录像严格拒绝及完整活局/两流/ID/根身份、strict classic过。六能力专用单元正例按明确opt-in用完整0.0.1底座后端，不将其当真实combat可用或新生产路径；2CLI实际production场景不注入后端，确实仅crafting或空manifest。当前9/15、18/29删除+原正常128=146/157，额外124单列，第十行仅foraging/余6继续。产品bundle仍d81dcb925…，源3321b89a…/1298输入不变；浏览器/真机未验。

第十行仅留foraging完整首次通过：全部原门禁exit0，125ext文件124过/1原skip，2745项2744过/1原C5性能skip，1500.71s（整行1541.49s），0新skip/todo。2个实际生产endpoint、8份真实缺包save/录像拒绝、全活局/双RNG/ID/根身份及strict classic皆过。受控单元动作后端仍只六项显式调用，不混同实际production剩余模块；本行CLI真实只有foraging或空manifest。当前10/15、20/29删除+原128=148/157，额外124单列，第十一行giants和余5布局继续。源3321b89a…/1298、产品d81dcb925…/60不变，浏览器/真机未验。

第十一行仅留giants完整首次通过：原全部门禁exit0，133ext文件132过/1原skip，2098项2097过/1原C5性能skip，2275.31s（整行2312.24s），0新增skip/todo。实际production两endpoint、六份真实其它模块save/录像拒绝、全部活局/两流/ID/根身份及strict classic过；本行giants真实存在，因此灯褶/铜须输入不属于缺包负例、不虚增检查数。当前11/15、22/29删除+原128=150/157，额外124单列；第十二行growth和余4布局继续。源3321b89a…/1298、产品d81dcb925…/60不变，浏览器/真机未验。

第十二行仅留growth完整首次通过：真实删除目录并清缓存，boundary/types/build/全部剩余ext/实际生产endpoint/真实缺包save及录像拒绝全部exit0；Test Files  141 passed | 1 skipped (142)；Tests  2552 passed | 1 skipped (2553)；Duration  1476.01s (transform 2.48s, setup 0ms, import 59.36s, tests 1408.98s, environment 21ms)；整行1511.4s。必验endpoint 2（全删只空集一次），真实输入8份、每份save/录像皆拒绝且完整活局/两流/ID/根身份保持，strict classic过；未注入单元夹具到生产CLI。当前12/15、24/29删除+原正常128=152/157，额外124单列。源码3321b89a…/1298、产品dist d81dcb925…/60不变，浏览器/真机未验。

最终配置核对补注：combat当前1.6.0/schema4，唯一nextActionId/bundles在底座run.actorActions；growth当前1.8.0，由statSources接统一Stat而非旧3g optionalActorQueries/容量revision DTO。修正两手册当前版本/根归属/接线，保留3g历史并明确当前覆盖；其余五包机械身份按实际definitions核对无变化。仅文档变更，不改变矩阵源码/产品build，不重复运行已过门禁。

第十三行仅留narrative完整首次通过：真实删除目录并清缓存，boundary/types/build/全部剩余ext/实际生产endpoint/真实缺包save及录像拒绝全部exit0；Test Files  114 passed | 1 skipped (115)；Tests  2121 passed | 1 skipped (2122)；Duration  1337.01s (transform 2.47s, setup 0ms, import 47.63s, tests 1283.24s, environment 17ms)；整行1371.24s。必验endpoint 2（全删只空集一次），真实输入8份、每份save/录像皆拒绝且完整活局/两流/ID/根身份保持，strict classic过；未注入单元夹具到生产CLI。当前13/15、26/29删除+原正常128=154/157，额外124单列。源码3321b89a…/1298、产品dist d81dcb925…/60不变，浏览器/真机未验。

第十四行仅留settlement完整首次通过：真实删除目录并清缓存，boundary/types/build/全部剩余ext/实际生产endpoint/真实缺包save及录像拒绝全部exit0；Test Files  145 passed | 1 skipped (146)；Tests  2229 passed | 1 skipped (2230)；Duration  2351.39s (transform 2.71s, setup 0ms, import 65.40s, tests 2278.07s, environment 22ms)；整行2382.21s。必验endpoint 2（全删只空集一次），真实输入8份、每份save/录像皆拒绝且完整活局/两流/ID/根身份保持，strict classic过；未注入单元夹具到生产CLI。当前14/15、28/29删除+原正常128=156/157，额外124单列。源码3321b89a…/1298、产品dist d81dcb925…/60不变，浏览器/真机未验。

第十五行全删完整首次通过：真实删除目录并清缓存，boundary/types/build/全部剩余ext/实际生产endpoint/真实缺包save及录像拒绝全部exit0；Test Files  104 passed | 1 skipped (105)；Tests  1908 passed | 1 skipped (1909)；Duration  1212.50s (transform 2.29s, setup 0ms, import 45.04s, tests 1161.82s, environment 16ms)；整行1241.08s。必验endpoint 1（全删只空集一次），真实输入9份、每份save/录像皆拒绝且完整活局/两流/ID/根身份保持，strict classic过；未注入单元夹具到生产CLI。当前15/15、29/29删除+原正常128=157/157，额外124单列。源码3321b89a…/1298、产品dist d81dcb925…/60不变，浏览器/真机未验。

## 最终交接核对

串行修复/矩阵wrapper实际exit0；15/15、29删除要求、额外124与原正常128的来源已核，全部72真实输入拒绝回执和strict classic皆过。当前源码/实际dist聚合与本报告顶部一致，实际HEAD/分支仍f1df690/ext/phase5；git diff --check通过，变更文本无CRLF、没有新增超过1MB文件。临时matrix-source和9份真实输入原gzip已清理，首败及命令/exit/计数摘要保留；父原implementation日志与续跑日志未删除。

进程核对范围：维护者已确认被中断旧链全部退出；本作者所有启动门禁均有退出回执，末wrapper exit0、progress PID0，已无本作者在跑门禁。末次ps清单调用被本机sandbox拒绝（operation not permitted，exit127），没有把未取得的OS全进程清单当证据。独立审查0轮；本地无已知未关闭必需门禁/正确性项。既有时限/P95首败在原门限复验通过，系统波动精确原因未测量，首次结果/限制不抹去。浏览器/真机及其性能、24/120格和self955完整人工回执全部待人工，R1特别核对六项完整单元后端与真实生产缺包证据的边界。

## 维护者独立收口（2026-10-11）

R1有效只读审查一轮，exit0，全部89个tracked差量及8个untracked文件被审阅；零确证阻断或非阻断发现。首次stdin丢失的启动失败没有执行审查，未算额外轮次。无需原作者修复或R2，不开R3。父核对真实进程均已结束，并复核源码1298输入聚合与dist60文件聚合匹配作者交付及审查候选，git diff --check通过；本阶段只改交付文档，没有重复全量测试。原完整npm exit1、相关复测和沿用边界继续保留。提交推送后停止本地监控，交Claude或用户按人工清单验收，不自动合main/foundation、打标签或开下一步。

推送回执：维护者已将5Z实现`0ec7c561f278b3b1ae9319fb5d774ae9ebf5b509`推送至origin/ext/phase5，未修改main/foundation或标签。人工候选为该提交及同源码构建；后续文档回执不改变源码/测试/dist身份。交付人工清单后停止本地监督。

维护者阶段核对（2026-10-11 06:22）：本批完整npm test实际exit0，547文件通过/1跳过；10624项通过、0失败、84既有skip、5todo，日志未报告unhandled；耗时8521.12秒，结束后源码聚合未变。test:ext仍运行，test:drift未开始，不能称三套已全绿。同时观察到其它目录的narrative验收worker占用CPU（BrogueJS-narr2-acc、仓外narrative2-acceptance/fix）；未干预这些独立任务，若出现时限/性能失败需考虑但不能据此直接归因。
