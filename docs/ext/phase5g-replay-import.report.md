# 5G 原始公开录像导入卡死修复

已复现真实 App 导入后的响应式循环，并作单一生产文件的最小修复。456 项相关测试、41 项源码守卫、实际 npm run test:drift 的12项及 boundary/types/build 通过。没有启动真实浏览器或作性能测量，原 critical 中断仍保留为未完成批次；交独立审查及 parent 新构建浏览器复验。

HEAD始终为8af6ef55342ac30bb68b3b4035ce0743b0939d02，分支codex/phase5g-maintainer，没有commit/push、代理、切分支、git索引或main/foundation/dot/5D1修改。原UI2三文件、已有报告/失败证据、九冻结SDK/stats/harness及已接受的四个SDK时钟文件全部逐SHA保持。

## 原证据与归因

使用原 browser/ui2-critical-first/critical-1440x900-normal-original/recording.json：正常公开新局seed2，foraging唯一模块，真实采集3次、食用No/Yes后导出的39事件录像。39402字节，SHA256 **f2a22fc3b3b7eb81ae68630c8f0c760ad83342b444bc780dc3f161b908daca9e**。原事件/header/数据和黄金trace没有编辑。原文件另存于本轮仓库外证据，并逐字复制为小型回归fixture。

parent的browser-import-hang-observation.json记录0105-upload-own-valid-recording卡住、渲染线程持续占用CPU，约205秒终止其QA node，批次exit1。原console、中断后日志、快照错误及候选candidate-ui2均保留。这不是常规完整测试失败或通过；原24矩阵、名称和No/Yes浏览器通过属于旧UI2构建，不能作为本轮新构建结果。

先以绝对Node24子进程运行真实Game/loadReplay/seek原录像，设25/30秒外部进程上限，仅用于阻止挂死，超时会明确exit124并记timedOut，不能算pass。本轮有界探针未发生超时。

初次headless缺生产i18n，loadReplay在初始世界校验处返回false而非卡死。补上真实src/i18n初始化后，当前候选及固定bca/review-tree均导入成功、seek39/0且无OOS；初始六域digest与原录像匹配。进一步按原事件经公开命令构造真实live39状态，再加实际PresentationTimeline、DialogService绑定和模块UI，独立读模型探针也通过。constructor/seed1候选、extended seed2初始化及initialDigest验证都有进入/退出阶段记录，未修改私有状态绕过校验。

挂载真实client App、原DialogHost和Inventory后，使用菜单组件公开事件传入原文件内容的真实File，导入处理本身完成，后续渲染/轮询出现 **Maximum recursive updates exceeded in component <App>**。同一探针在bca底座也失败，证明不是UI2名称/布局或8af时钟修改引入。旧Logger与bca逐SHA相同。

只读Vue触发观察及原方法调用栈定位到：App/模块命令的isPresentationBusy读取logger.pendingAcknowledgment；回放时display.enabled为false，旧getter即使pending/unread/terminal已经为空仍调用clearAcknowledgments，通知DialogService.sync；采食session.refresh写入新的view/draft，触发App重新渲染，再次读取getter。观察文件中view/draft与computed触发重复出现，没有新增世界命令。开发Vue有递归报错保护，安装的生产runtime没有该保护；该循环与parent生产页面持续卡死相符。本进程没有用SFC代替真实浏览器关闭发现。

## 精确增量

- **src/engine/Systems/Logger.ts**：唯一生产文件。disabled展示只有pending/unread/terminal存在旧内容时才清理；旧内容仍清理一次，已空展示的后续读取不发通知。没有foraging分支、节流、等待、吞异常或放宽录制校验；明确clear/reset行为保持。没有新增Game字段、随机抽取、命令或机械状态。
- **src/test/replay_import_ui.test.ts**：新增3项，真实App/模块session/Host/Inventory与Game。只隔离Pixi及视觉兄弟组件，菜单/HUD转发公开组件事件，activeGame绑定使用真实Game对象。没有mock模板、Logger、loadReplay、seek、知识、消费或事务。不会宣称物理文件选择器、GPU、CSS或触摸已测试。
- **src/test/fixtures/foraging-ui2-import.json**：原39402字节录像逐字复制；测试固定长度/SHA并要求公开命令重建后的全部39事件与原事件完整相同。
- **scripts/test-suites.json**：仅在常规test登记新文件一行，原分区/发现断言和其它次序保持。
- 本报告为唯一新增文档。完整production-incremental.diff、candidate.diff、逐文件源清单与scope-check.json在[证据目录](../../../browser-import-fix-evidence/)。

原InventoryOverlay.vue、ForagingPanel.vue、dialog_host.test.ts均与UI2开工字节一致，未覆盖或撤销其未提交改动。九冻结接口、Game/runtime及两份SDK时钟测试、数据/locale/版本/类别/生成基线/黄金trace未改；U03原18项实际运行通过。

## 回归及保存/随机数边界

新App回归先通过真实公开新局处理及executeCommand构造live39状态，确认.presenter仅使用录像里原已观察的答案，未伪造世界或知识；exportRecording全部39事件精确匹配原录像。经App实际导入处理后，replay0、事件39完整保留、无OOS。五轮真实轮询/渲染前后完整save投影（仅归一savedAt）、双RNG、实体ID、logger机械归档不变。

随后seek39/0/39，完整save及双RNG相同；同Game真实load恢复live可续录状态，追加公开escape得到40事件录像，再真实导入/seek40，完整世界/前缀和RNG保持。原始录像不改。续录导出会使用实际公开export的recordedAt，诊断证明初版新测试只有save.run.recordingOrigin.header.recordedAt一个非机械元数据预期不同；最终期望使用实际continued.recordedAt，仍逐字段比较其它全部save内容，并不改原header或放宽世界/前缀断言。RecordingDigest既有recordingStart也排除recordedAt；生产录制行为未修改。

另两项保护：disabled且为空时反复读取ACK不通知、不改归档/RNG/ID；旧pending/unread/terminal内容转为disabled时只清理一次，后续读安静，机械归档保持。原静默回放、ACK/MORE/终局与事务恢复测试均保留。

最终相关20文件 **456pass/0fail/0skip/0todo**：DialogHost49（原26+UI1十二+UI2十一）、D2 continuations56、dialog_service35、presentation23、edible runtime61（含真实消费回滚及候选时钟）、stats runtime26、recording digest20/snapshots11/storage6、U27五、UX1d十九、X2a四、X3b四、U03十八、SFC harness10、foraging UI103、新导入3、UR2/3/4各1。逐用例结果见related.json。原六组pointer/e/a×No/Yes、只读/load/真实名称断言全部保持。

实际 **npm run test:drift -- --maxWorkers=2**，6文件12pass/0fail/skip/todo：generation baseline1、U26a深层baseline1、crafting trace3、giants spine1、giants trace2、foraging trace4。没有重录任何基线。该命令按原严格discovery包含模块drift，不冒称仅跑根目录两文件。

源码守卫8文件41pass，101为-t未选：P1-30完整26、U24完整3、hygiene完整2、membership完整6，c_4a生产字段读者白名单、b_1a识别、w_7强制附魔/toRaw、ui_2受保护括号各1。未改守卫或跑c_4a种子×层普查。boundary、vue-tsc -b、npm run build、git diff --check全部exit0；build保留既有大chunk提示。

## 原红、反事实及每步退出

实际Node绝对路径 /Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node，v24.19.0；NODE_OPTIONS=--max-old-space-size=3072，Vitest4.1.11、maxWorkers2。每个标签有完整.command.json（argv/cwd/PATH/堆/上限/exit/wall）、.log，测试另有JSON。以下wall仅命令记录，不是性能测量；重复通过不累加成唯一覆盖。

| 标签 | exit | 结果或归因 | wall秒 |
| --- | ---: | --- | ---: |
| red-current | 1 | 缺生产i18n的headless初始digest拒绝，1fail/11未选 | 2.775 |
| red-current-i18n | 0 | 原录像真实Game导入/seek39/0，1pass/11未选 | 4.186 |
| baseline-bca | 0 | 初版探针路径未正规化，0项注入、11未选，不能计通过 | 1.869 |
| baseline-bca-fixed | 0 | 路径修正后固定bca原录像导入/seek通过 | 3.908 |
| red-current-presentation | 0 | live39+真实展示时间线，原导入/seek通过 | 4.188 |
| red-current-dialog | 0 | 真实DialogService ACK/command绑定通过 | 4.438 |
| red-current-module | 0 | 再加真实模块UI读模型通过 | 4.740 |
| red-current-app | 1 | 初版SFC stub相对路径错误，未进入导入 | 2.335 |
| red-current-app-fixed | 1 | 原App导入后响应式递归，1fail/49未选、1 unhandled rejection | 5.513 |
| red-current-app-observe | 1 | 初版观察钩子对无target的computed事件使用WeakMap，辅助错误 | 3.265 |
| red-current-app-observe-fixed | 1 | 修正观察钩子后同一真实递归红灯，view/draft与getter调用栈留存 | 5.311 |
| red-bca-app | 1 | 固定bca同一递归，1fail/26未选、1 unhandled rejection | 5.323 |
| green-current-app | 0 | 只改Logger getter后同一App探针完成import/nextTick/settle，1pass/49未选 | 3.758 |
| regression-initial | 1 | 新3项2pass/1fail，续录save仅recordedAt预期不同 | 6.936 |
| regression-diagnostic | 1 | 保留同一失败，独立逐叶诊断仅一个时间字段 | 6.996 |
| regression-final | 0 | 新3项通过，期望使用实际公开导出header时间 | 8.399 |
| types-initial | 2 | 新host renderer props推断为{}的4处类型错误 | 9.977 |
| types-final | 0 | 补明确Record类型，断言/行为不变 | 9.730 |
| related | 0 | 20文件456pass | 226.707 |
| boundary | 0 | 模块边界/归属通过 | 2.664 |
| drift | 0 | 实际npm test:drift，6文件12pass | 89.398 |
| build | 0 | 实际npm run build | 14.214 |
| source-guards | 0 | 8文件41pass、过滤未选101 | 8.322 |
| diff-check | 0 | 无空白错误 | 0.012 |

辅助脚本和所有初版探针/测试版本均保留，没有把helper错误或未选用例伪报为产品通过。单变量绿色发生在永久测试新增前，仅Logger生产读口变化；继承红灯也在固定bca独立复现。没有旧测试前提修订、断言删除、skip/timeout新增，未放宽任何原守卫。

## 固定源/新构建与交回

所有门禁前后2660源文件逐SHA一致，input-gates-source.json/after-gates-source.json聚合均为 **4fc71d19f06f045137f539712aabf0ed71400e65367727b836a4a15f5c1c57e5**。随后仅新增本报告；最终完整源（含本报告）固定清单、副本及SHA见browser-import-fix.ready.md和evidence/manifest.json/final-source.json，算法为排序路径+NUL+SHA256+LF。

最终build后的dist59文件聚合 **cb422083c8f81050bb38a7a92380492b56d8a39d740224ecb9b2451499f34b03**；index.html SHA **f5e21032ba8466b37b618466aa41dad038e0cc9b078453902babb34eeb5118f6**。逐文件清单final-dist.json；maintenance-tree/dist及证据中的固定dist副本一致。旧build-ui2与原UI2 dist清单59文件逐SHA仍相同；没有覆盖build-ui1/build-ui2或review-tree/input-v2。

本轮修复共享Logger/实际App回放渲染路径，因此parent必须使用本次新构建重做浏览器：原文件实际选择器导入、菜单关闭/响应、回放step/seek/restart、存读档/续录、ACK/MORE/终局、真实菌名称/食用NoYes/触摸/只读，以及UI2控件与24矩阵（含320普通回放四控件几何/点击）。此前24矩阵仅是旧UI2结果，不是本build证据。本进程没有启动真实浏览器、改QA工具、运行849全套/test:full/test:gen/5Z/删除矩阵或CE fetch，也未测性能。所有大原始证据及构建在仓库外，新回归fixture仅39KB，无CRLF。完成停止交独立审查，由parent实际浏览器关闭发现。
