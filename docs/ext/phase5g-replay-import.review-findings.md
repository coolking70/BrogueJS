# UI3 原始录像导入修复独立审查

本轮没有剩余的范围内 P1/P2 发现。Logger 空 disabled ACK 读取不再反复通知，原始39事件在真实挂载 App 中导入/渲染/seek/读档续录的定向回归通过。独立候选复测12项通过（主批9项、正常Host/MORE3项），仅换回旧Logger的单变量反事实按预期失败。本结论是固定UI3的代码/定向复测签认，真实浏览器修复关闭仍由指挥负责；此前UI2浏览器或名称验收不自动扩展到UI3。

## 固定身份与范围

完整读取 browser-import-root-evidence.md、原 review-name-findings.md、固定 Logger/新测试/增量、执行者全部命令与结果汇总、原App红绿证据、continuation-differences.json、候选描述符。执行正式报告最初尚未出现，后续已完整读取明确获准路径 `../maintenance-tree/docs/ext/phase5g-replay-import.report.md`；没有读取该移动树的生产文件或写入它。

UI3是基于8af6ef55342ac30bb68b3b4035ce0743b0939d02的固定源码快照，不声称该HEAD已包含UI3。2660个源文件逐SHA与manifest、candidate source descriptor及执行者after-gates-source完全一致：

- 排序紧凑JSON源码聚合：`9fce92ea95035c49fd7839d21b47645fb4b59dd2dca0b1d1a392b595f02314ad`。
- 路径+NUL+SHA+LF聚合：`4fc71d19f06f045137f539712aabf0ed71400e65367727b836a4a15f5c1c57e5`。
- manifest-ui3文件SHA：`7b4368c80837ceae0b5e0993954ebe9e33b6f898b180a89d353fc3b1d3642c6d`。
- candidate source-manifest文件SHA：`d684a4c358eb23aff9756f43274abc4685daf3186962cae31c3de3cf1ee50cfd`。

相对固定UI2，唯一生产差异为Logger.ts。scripts/test-suites.json只登记一个新测试；新增 replay_import_ui.test.ts、原39事件fixture。另两份已有UI报告元数据更新，未混作生产改动。InventoryOverlay.vue、ForagingPanel.vue、dialog_host.test.ts逐字保持UI2；九冻结SDK/stats/harness及Game/runtime/两份时钟测试四文件SHA相同。没有Game字段、规则、协议、数据/locale/category、随机抽取、旧测试断言、黄金trace或基线变化。

候选59个build-ui3文件逐SHA均匹配dist descriptor和manifest-ui3.distFiles，构建聚合 `cb422083c8f81050bb38a7a92380492b56d8a39d740224ecb9b2451499f34b03`，index.html `f5e21032ba8466b37b618466aa41dad038e0cc9b078453902babb34eeb5118f6`。build-report引用的源码/构建清单哈希也匹配。本会话只核对固定产物，不重跑build。

审查创建 import-review-work完整隔离副本，保留依赖symlink；所有副本源码均与固定input-ui3相同。适配只在外部配置中内存追加probe；反事实只内存替换Logger源，不编辑副本生产文件。前后 import-audit 验证固定UI3、UI2、旧根目录原probe/报告/日志及全部原浏览器红灯文件不变，副本也未改字节。无产品/fixture/旧证据写入、commit/push、代理或浏览器操作。

## 原浏览器红灯及根因可归属

已核对 `../browser/import-direct-first`：全新seed2/normal/foraging局直接选择原录像，driver实际exit1、hung=true，公开响应10秒期限超时；CDP恢复后Debugger.disable另有3秒清理超时保留。不是通关/原critical完成，也不是本会话启动的浏览器。

原录像39402字节、39事件，SHA `f2a22fc3b3b7eb81ae68630c8f0c760ad83342b444bc780dc3f161b908daca9e`；固定fixture与该原文件逐字相同，没有重建或编辑事件/header。暂停调用栈中存在：

`canOpenPanel → get pendingAcknowledgment → clearAcknowledgments → zp通知 → sync → 采食refresh → readDisplayFrame → computed/render`。

捕获script-13.js的SHA `1be036b0574a128aef5ee837dfb406cb6925af4c58c45ce46965a68ca5205f58`，独立计算与原dist manifest的assets/index-3f_fBaEa.js及frame-bundle-sources记录一致。没有sourcemap，不将压缩行列虚报成源码行号。原证据所有文件SHA前后保存于import-audit，driver哈希另见import-identity.json。

执行者真实App旧源探针出现Maximum recursive updates，固定bca同样红；green-current-app仅Logger改动后完成import/nextTick/settle。基于已有源范围及单变量证据，归因不是UI2名称修复或已接受的load-clock增量。非App层Game/Presentation/Dialog/Module探针通过，只能说明那些被测层不重现，不能算App卡死已解决。baseline-bca初版0项被选中，明确不计通过。

## 最小修复正确性

Logger.ts:87–95新增条件在display存在且disabled时，仅当pending非空、unread非空或terminalShown为真才调用原clearAcknowledgments。清理仍先置空三个状态再通知，故同步重入的getter观察到空状态，不再通知。该条件覆盖三种残留状态，没有foraging分支、节流、异常吞掉或ACK禁用规则变化。

enabled=true时完全保留原读取/队列语义；显式clear/reset/setState、日志归档、机械证据、发生次序、checkpoint身份恢复均未改。空disabled读取安静不影响归档或RNG/ID；disabled残留清理一次后，重新enabled的新ACK应落回pending，terminalShown必须已复位。本轮分别验证了这些条件，未仅用一个unread案例代表全部分支。

## 独立实际回归

完整运行固定新增3项，加本目录6项，共9项全过：

1. 固定产品App回归：真实client App/模块session/DialogHost/Inventory，菜单/HUD只转发公共组件事件，隔离Pixi/视觉兄弟。先按原39事件公开命令重建live状态，export全部事件精确等于原文件；通过真实File和App导入handler，replay0/39事件无OOS，轮询前后完整save（仅savedAt归零）、双RNG、ID和logger档案不变。
2. seek39→0→39保存和RNG一致；同Game load恢复live完整前缀，公开escape续为40事件，重新loadReplay/seek40，全部保存内容及RNG一致。仅期望的recordingOrigin.header.recordedAt使用当次公共export值，未放宽其它字段。
3. 原两项Logger重复空读/残留一次清理通过。
4. 独立空disabled读含同步读取通知消费者，25轮单/复数getter都无通知，归档/RNG/ID相同。
5. 独立三种状态pending、unread、terminal-empty各清理一次；通知内同步重入两个getter不造成第二次通知，后续25读安静，归档保持；恢复enabled后真实新警告在pending而不滞留unread。
6. 独立enabled重复警告保留不同冻结occurrence身份和次序，读取不通知，acknowledgeNext推进、终局unread正确；checkpoint在retirement后恢复同一两个occurrence身份与原机械档案，再正常完成两次ACK。
7. 独立全新真实App直接导入原39文件，匹配指挥direct-first场景，未先重走采集/食用事件。10次100ms轮询保存/RNG/ID/归档不变；经菜单公开onReplaySeek往返0/39、无OOS。成功load后制造真实pending警告，拒绝无效版本snapshot仍保持完整世界、player/inventory/runtime引用、ACK occurrence身份、档案/RNG/ID。该拒绝例验证早期拒绝不变性，不冒称覆盖所有深层候选错误；执行者相关456项另含真实消费回滚和候选load-clock既有测试。

另独立选跑原dialog_host3项：真正MORE无效键/指针回答，以及animation=false/true时HUD/journal/nearby在MORE冻结/恢复，均通过；其余46项名称过滤未选，未计执行。未新造Host/ACK行为来代替真实SFC。

反事实仅内存换回固定UI2旧Logger（与执行者Logger-original逐字相同）：同一独立空disabled读断言期望0次通知，实际53次，exit1。消费者只在前3次通知中再次读getter，给复现设有界重入；候选同一代码为0次。此为预期归因红灯，不是新增UI3缺陷，也不是再次运行浏览器。

## 新测试和执行者失败历史

固定新测试确实编译client App，真实loadReplay/seek/知识/消费/日志/事务未mock；Game binding为实际对象。原39事件fixture按长度/SHA以及完整事件重建结果验证，测试发现分区只加登记一行，原守卫保留。测试不声称真实文件选择器、浏览器CSS、触摸、GPU或性能。

初版新回归的save失败由continuation-differences.json逐叶确认，仅 `save.run.recordingOrigin.header.recordedAt` 不同。Game.ts:4081公共导出刻意使用Date.now，RecordingDigest.ts:493–494排除此时间字段；最终期望取实际continued.recordedAt而保留完整其它字段比较正确。不是修改原录像或修世界断言来迎合失败。本次固定回归独立再次通过。

types-initial exit2四处HostNode props被推断为{}，最终加Record类型；行为/断言未放宽。其它初版probe错误（缺i18n、错误stub路径、观察钩子WeakMap无target、0项被选）均在执行报告/命令/结果保留，不充当生产red或pass。可归属App red是red-current-app-fixed/observe-fixed及red-bca-app；对应green-current-app只有1项执行、49过滤。

所有执行者.command.json的精确argv/exit/wall及测试选中数量已独立整理到 import-executor-command-summary.json。关键最终记录：regression-final3pass/exit0；related20文件456pass/0skip/todo、exit0；实际npm test:drift6文件12pass/exit0；source-guards8文件41pass/101过滤、exit0；boundary/types-final/build/diff-check均exit0。输入逐SHA与本固定UI3相同。本会话没有重复456、drift12、守卫41或build，不把这些算独立通过数量。

## 本会话准确命令和退出

绝对Node为 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`，实测v24.19.0，显式PATH、NODE_OPTIONS=--max-old-space-size=3072，cwd为本目录import-review-work，所有批次maxWorkers=1（任务上限2）。配置native loader，缓存只在本审查目录；没有固定输入或共享node_modules缓存权限失败。

主复测：

```sh
python3 import-run.py import-independent node_modules/vitest/vitest.mjs run \
  src/test/replay_import_ui.test.ts --config ../review-import.config.mjs \
  --configLoader native --maxWorkers=1 --reporter=default --reporter=json \
  --outputFile.json=/private/tmp/brogue-commander-20261008-5g-revision/browser-review/import-independent.json
```

另外两次同一launcher/选项：

- import-enabled-host：dialog_host.test.ts，`-t 'MORE keeps invalid movement keys|animation=(false|true): HUD/journal/nearby'`，候选配置。
- import-counterfactual：replay_import_ui.test.ts，`-t 'empty disabled reads do not reenter a real notification consumer'`，review-import-red.config.mjs。

完整argv/cwd/退出保留于对应.command.json；所有原.log/.json保留：

| 标签 | exit | 实际执行结果 | wall秒 |
| --- | ---: | --- | ---: |
| import-independent | 0 | 9pass，0fail/skip/todo | 10.601 |
| import-enabled-host | 0 | 3pass，46名称过滤未选 | 3.043 |
| import-counterfactual | 1 | 旧Logger1项预期失败，8名称过滤未选 | 2.493 |
| import-audit before/after | 0 | 固定源、旧证据与隔离副本逐SHA不变 | 不作测试计数 |

本轮未启动浏览器、修改QA工具、跑CE/full/gen/849/大门禁/性能/5Z/删除矩阵/5D1，未提交或推送。只读固定build并检查描述符，未再build。缺CE提示保留，独立候选执行的12项无CE skip。

## 交回

在这次固定源及明确已测边界内，没有剩余可证实的导入/ACK/身份/回滚/load回归；UI2名称和布局代码、8af时钟修复保留。请指挥以candidate-ui3当次构建完成真实原文件选择器导入、响应/菜单关闭、seek/step/restart、ACK/MORE/终局、存读档续录及受影响UI矩阵；旧UI2结果不能签新UI3。审查输出READY后停止，修复仍回原执行者。
