# Party P1b 实施报告

2026-10-18；开工 `ext/party-p1a` / `a47a15b635284c84b4651ec28083adc052509c05`，工作区干净。维护者已裁定 B1–B7 全部按推荐，先回填任务单再实施。未commit/push/合并/发布。原始证据在 `/private/tmp/party-p1b/`，不提交截图、大日志或录像。

**状态：第 1 轮独立审查为“需修”；R1-F1–F5 已在作者侧修复，相关精简门禁已通过，等待独立复审。** 审查前性能证据保留历史来源；预算未冻结，正式云端与浏览器/真机待维护者，不把本地冒烟当云端 D6 通过。

## 第 1 轮审查发现处理（2026-10-18）

审查依据：[party-p1b.review-findings.md](party-p1b.review-findings.md)，结论为“需修”。下表为主笔修复与回归记录，**不代替独立复审的“可合入”裁定**。审查文件原样保留；未 commit。证据根目录 `/private/tmp/party-p1b-r1/`，其中 `before-*` 为未修生产代码上的原审查探针复现，`after-*` 为同场景修复后的断言；探针脚本与完整日志均留在仓库外。

| 发现 | 原样复现 | 修复与同类排查 | 回归结果 |
| --- | --- | --- | --- |
| R1-F1（阻断） | B 的 wand23 待决时 `validateInputState=false`、存档无 origin；读档选 `cell:37:12` 不扣次数，最终摘要与直接选择不同 | `RecordingFormat.validateInputState` 根据机械 `party.native.modal` 所有者选择库存，拒绝多模态所有者、缺失所有者及错属物品；不依据 UI focus，也不宽松接受任意成员物品。已有 load/entityGraph 与 seek/modal-owner 重建路径现在取得有效 origin | 原探针修复后 origin/complete 均 true，直接与读档都扣到 3 次且全摘要相同。新增 arcana、throw、malevolent 三种真实次成员待决，断言错属物品拒绝、origin 保留、实际选择耗用，以及 save/load/续录/seed replay/前后 seek 全域一致 |
| R1-F2 | unknown travel 首次 `INVALID_TARGET`，编辑 wait 后仍 `BAD_SEQUENCE`，seq=0 | 每次有效 edit/append/clear/keep 新 generation 重置 submitted；未编辑的重复尝试仍拒绝；旧 deadline token 与旧异步提交被 generation 隔离 | 原探针编辑后 seq=1；四种修订分别覆盖完整生命周期。真实 `usePartyUi` clear/append/advance 恢复拒绝，未完成 flush 的旧提交在编辑后丢弃 |
| R1-F3 | B 同层传送 `(37,25)→(64,7)`，旧窗口继续 search，cursor=2、budget=300、无事实 | 在原生 `placeCreature` 成功落点提交处记录独立硬中断 `displacement`，覆盖 teleport、blink/beckoning、击退等该入口；普通步行不经此入口。记录发生时刻，仍由既有安全原子边界判断停窗；不靠目的地敌人/陷阱推断。补 enum、严格收据校验及 i18n | 原探针仅 B 位移、A 不动，tick=100 停窗，位移事实 tick=0，cursor=1，search 保留到下一窗；save/load/续录/replay/seek 一致；普通走路无 displacement |
| R1-F4 | skip=1/3/4 原生 burning 各损 1 HP 后 regen 恢复至 20，原窗口跑满 300 且 facts=[] | 复用原生 `nativeDamageCommitted` 的实际 hpLost 记录伤害，并捕捉低血线；用窗口生命周期内的 WeakMap 订阅原生 status setter/apply/weaken/addPoison 的增加，覆盖状态同边界清除/衰减、虚弱层数加重。只写窗口收据，不改 CE 伤害/治疗/状态/时序；完整原子边界后才决策，事务回滚同步恢复观察基线，事实/锁存随已有机械图回滚 | burning 探针所有 skip 均 tick=100 停窗，skip=1 HP 仍 20 且 damage 保留。新增两成员真实 takeDamage/healPoints 与状态施加/清除的环境边界 fixture，stop/continue 分别 100/300，事实均完整；低血被治疗拉回也保留事实。均覆盖完整生命周期 |
| R1-F5 | 诅咒 unequip 返回 false，收据却 accepted/0，cursor=1，下窗 keep 执行 search | 单次窗口尝试记录原生提交信号与 boolean 结果，返回显式 rejected；调度写 rejected/plan-invalid 后硬停，游标不变。真实原生拒绝不抛异常做无谓回滚；真正异常/未批准确认仍沿原事务路径。补齐 native-item 的原生 boolean，区分合法零耗时成功、失败和模态打开；拾取空格也拒绝 | 原探针两窗均停在 unequip、cursor=0。覆盖 unequip/equip/drop/native-item unequip、已知空杖、冷却护符、非法 call/inscribe/relabel、空格 pickup，另有合法零耗时 inscription 对照；逐项 save/load/keep/续录/replay/seek 不跳过失败步 |

`party_window_review_r1.test.ts` 的 fixture 均在 initializeParty 原生初始化之后、recording header 创建之前建立；seed replay 重建同一 fixture。并非在录制后手改道具，再只测取消。多成员组合效果使用受控 objective-time 测试夹具调用真实原生效果方法，不宣称是自然地图随机遭遇；burning/regen 则直接复用审查的真实原生场景。

本轮新增的是瞬时观察/返回值会话，没有新增 Game own field、实体持久字段或 RNG/allocator 调用。party 的收据增加合法 `displacement` 事实种类；沿用本未发布候选的 F22/S9/R6/O4 与 schema1，旧的已发布无 party 格式及其字段顺序不变。Game/native 输入仍经 executeCommand；没有重录无 party 夹具、黄金 trace 或放宽守卫。

### 本轮精简门禁与首次失败

**本轮最终有效结果：20 个不同文件、579 项通过，0 失败、0 跳过。** `related.log` / `related-results.json` 首轮相关整文件门禁 20 文件 578 通过（468.06s）；同类排查补齐最后一个空格拾取用例、直接传递 unequip boolean 后，`final-windows.log` / `final-window-results.json` 对完整 R1 文件 25 项和无 party 字节夹具 1 项复验，2 文件 26 通过（92.25s）。按每个文件最后一次结果替换计数，见 `effective-results.json`，不把重复执行累加成 604 项覆盖。

boundary：`boundary-final.log` 通过。测试依赖：`dependencies-final.log` 扫描 693 文件、`errors=[]`。单独 vue-tsc：`types-final.log` 通过；最终源码再次由 `npm run build` 内的 `vue-tsc -b && vite build` 验证，`build-final.log` 通过。No-party 原五配置逐字节 save/recording/Game keys/RNG/messages 夹具不变（最终复验 2.99s），原生状态、传送/闪现、装备失败及完整录像相关文件均通过。

| 本轮相关整文件（最终有效） | 通过/总数 |
| --- | --- |
| `src/ext/modules/party/tests/party_actions.test.ts` | 29/29 |
| `src/ext/modules/party/tests/party_r1_environment.test.ts` | 47/47 |
| `src/ext/modules/party/tests/party_travel.test.ts` | 4/4 |
| `src/ext/modules/party/tests/party_window.test.ts` | 38/38 |
| `src/ext/modules/party/tests/party_window_decisions.test.ts` | 2/2 |
| `src/ext/modules/party/tests/party_window_review_r1.test.ts` | 25/25 |
| `src/ext/modules/party/tests/party_window_ui.test.ts` | 2/2 |
| `src/test/ext_causality.test.ts` | 22/22 |
| `src/test/ext_item_commands.test.ts` | 32/32 |
| `src/test/ext_party_inert.test.ts` | 1/1 |
| `src/test/ext_recording_v4_digest.test.ts` | 20/20 |
| `src/test/ext_recording_v4_snapshots.test.ts` | 11/11 |
| `src/test/u_03_whole_run_snapshot.test.ts` | 18/18 |
| `src/test/u_14a_status_gaps.test.ts` | 37/37 |
| `src/test/u_14b_status_gaps.test.ts` | 42/42 |
| `src/test/ux_1d_recording_continuation.test.ts` | 19/19 |
| `src/test/w_11_teleport_placement.test.ts` | 38/38 |
| `src/test/w_12_blink_beckoning.test.ts` | 50/50 |
| `src/test/w_9_directed_status.test.ts` | 77/77 |
| `src/test/x3_u3_cursed_equipment.test.ts` | 65/65 |

命令（Node v24.19.0；每次单 worker、禁止文件并行；完整路径表在证据目录的 `selected-tests.txt`）：

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
node node_modules/vitest/vitest.mjs run $(cat /private/tmp/party-p1b-r1/selected-tests.txt) --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=/private/tmp/party-p1b-r1/related-results.json
node node_modules/vitest/vitest.mjs run src/ext/modules/party/tests/party_window_review_r1.test.ts src/test/ext_party_inert.test.ts --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=/private/tmp/party-p1b-r1/final-window-results.json
node scripts/check-module-boundaries.mjs
node scripts/check-test-dependencies.mjs
node node_modules/vue-tsc/bin/vue-tsc.js -b
npm run build
```

首次失败完整保留：`r1-first.log` 新 17 项中 4 失败——UI harness 尚未读取惰性 hud，未启用 planner；3 个原生拒绝被初版修复抛成异常，触发冻结 stat owner 的多余回滚。已改为先激活真实 UI 会话、按原生拒绝结果返回 rejected，未改 checkpoint 守卫。`windows-second.log` 4 文件中原有 3 文件通过，新增组合效果的 2 项 fixture 错把 `heal(1)`（1%）当作 1 HP，改为真实 `healPoints(1)`；保持净 HP 相同及事实断言不变。新测试的 implicit-any/ES lib `.at()` 类型错误已修复，原测试断言未修改，也没有提高 timeout/新增 skip。修复后法杖辅助探针首次在切换到另一个 replay 的全局 RNG 后才比较旧实例摘要，位置错误（`after-modal.log`）；把比较移到创建 replay 前，保留旧日志并以 `after-modal2.log` 为复验结果，正式 Vitest 生命周期也按每个活跃实例依次比较。

`before-{modal,probe,damage}.log` 复现五项；`after-modal2.log`、`after-probe.log`、`after-damage.log` 的修复后断言通过。辅助 Vite boot 在受限环境记录监听权限告警，但 SSR 探针执行完成；不据此声称浏览器验证通过。build 的大 chunk 提示保持原状。

本轮仅运行上述相关测试、boundary、测试依赖检查、vue-tsc、build；未跑完整 npm test、drift、gen、物理删包矩阵、性能长跑、云端 dispatch 或浏览器。下文的 771/533 项、Worker 2049 边界、性能和旧 build 指纹均是**第一轮审查前候选的历史证据**，不改写成当前修复源码的门禁或性能结果。无 party 五配置字节夹具在本轮相关门禁重新验证，未重录。

### 本轮源码与交付身份

分支仍为 `ext/party-p1a`，HEAD 仍为 `a47a15b635284c84b4651ec28083adc052509c05`。最终复验前 `hashCandidate` 清单为 `1f42888d408b7d583ce00f72e9f0f95a408785ba1dfa223b584cd44aa72156dc`（3253 路径；回填本报告前的精确输入，后续只回填报告）。其中 `src/` 非 `/tests/`、`/test/`、`.test.` 路径的投影为 `1c0abf116eb9cbdef366389683d59b841972b58deb862c660993f79957bbb3b3`（687 文件）。最终 `dist` 为 `50444d9357988fe7361babf4b0b0d0e4677e867a4567e8f8198d200276395264`（63 文件）。`identity.json` 保存完整逐文件 SHA；构建摘要按英文顺序遍历相对 POSIX 路径，以 `path + NUL + fileSHA256 + LF` 聚合。生成脚本 `fingerprint.mjs`、最终仅报告变化核对及 CRLF/大文件/HEAD 检查一并放在本轮证据目录。

原性能输入 `9556692b232c1bd78ef12d6150fd4c7888773748f13886691d631738f4f342e8` 与旧 build `e973790e85f7e5c24aa7f1fee745aaf48510c070ec1d9915f9a7f726ef5d4d49` 仅标识审查前候选；现有 perf-summary JSON 保留历史来源，不重新盖章。下文精确 `gh` 命令仍由维护者在提交/推送**修复后候选**后派发，不能以审查前测量代替新候选校准。人工清单仍全部待维护者验证；本轮未代填。R1-F1–F5 作者侧修复后送独立复审，正式性能预算及发布决定仍待维护者。

## 裁定与实际接口

| 裁定 | 2026-10-18实际执行 |
| --- | --- |
| B1 | 手动推进+自动长度；ready/deadline是session接缝，无倒计时/投票UI |
| B2 | 仅local:0，显式actor授权；focus不移交控制；不存AI占位 |
| B3 | 25%低血、3安全窗、32/128计划、1024决策、fine1000；规则指纹含参数和默认值 |
| B4 | 单步底座保留；fineActorId明确；待决/失败拒绝绕过，有尾队列须显式policy清空再回单步 |
| B5 | party F22/S9/R6/O4、0.2.0/state2；无party F20/S7/R4/O2，world5根不变 |
| B6 | 本地分层归因→云端完整三轮→数字/指标等级裁定→独立验证；当前不产生假冻结阈值 |
| B7 | Codex实施自动部分，维护者浏览器及发布裁定；没有自动多代理或额外复审 |

窗口/decision/policy各schema1；旧actor-step/control schema1 payload保持；创建schema1保持。有效身份由 `partyIdentity` 路由，贯穿manifest/规则、whole-run、recording/header/origin、checkpoint/Worker job、full/event摘要及load/replay/seek。旧party格式拒绝；非party字节夹具不删版本字段、不重录。

合同差量见 [party-contract §10](party-contract.md#10-p1b-已裁定的实施合同2026-10-18)。实现以独立 `PartyWindow` 调度/协议、`PartyPlanning` session和已知世界模拟器为主，Game仅桥接原生命令、计时、事务和录像。原受击者作用域修复a502cea保持。确认不序列化闭包：回退尚未批准的单次尝试，持久化intent/批准答案，下一segment重新验证并只提交一次；完整风险文案由原生i18n产生并随待决保存。

## 自动验收矩阵

| ID | 实际覆盖及状态 |
| --- | --- |
| B-A01 | 通过：1/2/4人、非法revision/seq/tick/actor/slot/重复/超长/keep、尾队列与同格竞争；`party_window`整文件38项，`lock-test-2.log` |
| B-A02 | 通过：25/50/100/200/400、fine/固定预算/余时/麻痹；主副成员阶段动作跨窗；自然1/2/4人保存恢复/自动回放/seek/续录，`lock-test-0/2.log` |
| B-A03 | 通过：同tick多成员damage/status事实、自动3窗恢复、低血重置/锁存、变化预警、空队列、1024决策上限和硬停保留失败步，`lock-test-2.log` |
| B-A04 | 通过：三trigger机械等价、ready/deadline取消竞态、焦点/旧回调/双击；`lock-test-2.log`及UI整文件 |
| B-A05 | 通过所列自动路径：非主成员food Yes/No→save/load→同seq续段→续录/replay/seek；法器modal取消和diagnostic真实narrative选择的待决save/load/换焦点/陈旧拒绝。后两项不是自然生成整局录像覆盖，`lock-test-2/3.log`；实际浏览器另验 |
| B-A06 | 通过：P1a actions/travel/extensions/R1/R2整文件；自然双人窗口跨层与回放；制作/采食/成员死亡冻结回归。原生多目标受击者修复保持；日志映射见自动证据索引 |
| B-A07 | 通过：自然窗口生命周期、自然双人跨层、旧格式/待决/trace篡改拒绝保活局，及原录制/存读/seek/续录整文件；见索引 |
| B-A08 | 通过：生产Worker1/4人各2049路线，255/256/257/2047/2048/2049语义段重合/错开、save/load/root/seek/续录；`closed-1.log`。原async运输/降级/完整性整文件保留 |
| B-A09 | 通过：相同已知投影、不同隐藏地形；取消/修改/过期；主局全域/双流/allocator/前缀保持；`lock-test-2.log`。预演仅move/wait/search，其他明确不确定 |
| B-A10 | 通过自动范围：真实MainMenu12配置完整生命周期，独立2/4人计划面板SFC；`extra-1/2.log`与对应latest日志。浏览器/触屏/真机未验 |
| B-A11 | 通过：原5配置无party字节夹具不重录；全删9目录后26文件533通过、2原有skip、12拒档保活局及classic/空集生命周期；`lock-test-4.log`及`lock-deleted-*.log` |
| B-A12 | 本地分层归因与rounds=1工具冒烟见下节；正式云端三轮、预算数字/等级与独立验证待维护者，不称预算冻结完成 |

## 门禁与首次失败

使用Node24.19.0、3GiB heap、单worker无文件并发；早期窄探针Node25.2.1单列。完整选择初单在 `/private/tmp/party-p1b/selected-tests.txt`；最终44文件与每个有效日志见`gate-file-summary.json`和本报告的精简证据索引。正常树有效整文件结果合计 **771通过、2原有跳过**，不是一次全绿调用；按最后差量复验受影响整文件，其他有效文件日志保留原运行身份。新增decisions与回放节拍在最终44文件内。未运行完整npm test/test:ext/drift/full/gen或512穷举。

- 新增测试最初因未登记suite、随后误登记required party（没有静态依赖）被守卫拒绝；修正登记，没有改守卫。原日志保留。
- 初始窗口专项发现snapshot仍使用旧literal8，生产改为9；随后新测试误断言void replaySeek返回true，修正新测试API调用。`window-fifth.log` 26项通过；`window-combinations-first.log` 3文件42项通过；`window-ui-first.log` 2文件33项通过。批次重叠，不累计成一个总数。
- 旧 `party_lifecycle` 唯一前提差量是已批准格式8/5→9/6。新生产+旧测试7项中1败；隔离副本保留当前scripts/tests，仅生产回到a47a15b，原文件7项全过（`lifecycle-counterfactual-final.log`）。只更新两个版本前提，原成员图、存读和录像断言保持。`lifecycle-counterfactual.log`误在当前cwd运行、`lifecycle-counterfactual-actual.log`首次副本漏复制suite登记均保留，不作为反事实成功证据。
- terrain reader守卫发现新预演直接读rememberedTerrainFlags；改为既有 `knownCellFlags` 合成知识接口，未改守卫清单；`boundary-second.log`通过。


- 首批整文件39过、4败：R1用例超时、i18n缺键、硬编码文案、Worker四人摘要不一致，分别保留原输出并整文件关闭；没有抬timeout或改守卫。原locale缺键问题按物理可删依赖修到核心，不以跳过修复。
- 全删最初错误纳入要求growth/loot存在的固定五配置惰性测试；仅从全删适用集合移除，它在正常树完整运行并通过。全删剩余26文件保留。前两版全删的types/i18n失败与被中断批次仍留档，不记作成功。

### 最终门禁证据

最终生产/工具冻结源与物理全删输入均为 `9556692b232c1bd78ef12d6150fd4c7888773748f13886691d631738f4f342e8`（hashCandidate全源文件清单；最终仅报告文档新增/更新，生产与工具保持该冻结源）。Node v24.19.0；`NODE_OPTIONS=--max-old-space-size=3072`；单worker、无文件并发。`lock-results.json`记录命令、cwd、exit及耗时；`gate-file-summary.json`按文件给首次/后续及最终有效日志。

```bash
node node_modules/vitest/vitest.mjs run <完整测试文件> --maxWorkers=1 --no-file-parallelism
node scripts/check-module-boundaries.mjs
node scripts/check-test-dependencies.mjs
npm run build  # 原脚本内含 vue-tsc -b
node scripts/check-module-removal.mjs --root=/private/tmp/party-p1b/candidate \
  --retain=none --prepare-only --engine-only --output=/private/tmp/party-p1b/removal-final4
```

最后一条只是准备副本。实际副本 `/private/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-ZkEbih/candidate` 中9目录不存在，另执行boundary/dependencies/build（含types）、`removal-applicable-tests.json`的26整文件、endpoints engine-only、真实缺包拒档/续录脚本，全部exit0。删除矩阵JSON的prepared-not-verified不是成功证明；成功证据是`lock-results.json`中的后续命令。组合runner的浏览器passed=false/skip明确保留，requestedScopePassed=true只代表授权的引擎范围。

构建为63文件，dist SHA256 `e973790e85f7e5c24aa7f1fee745aaf48510c070ec1d9915f9a7f726ef5d4d49`；算法为按相对POSIX路径排序的`path + NUL + fileSHA256 + LF`串再SHA256。详细身份在`build-identity-lock.json`，Vite仅有既有大chunk提示。SSR工具在沙箱内报24678 websocket EPERM提示，但实际计算、Node Worker、oracle及CLIexit均另验；不据此宣称浏览器跑过。


## 实施差量与消费者

| 触点 | 最终行为/消费者 |
| --- | --- |
| `src/ext/partyWindow.ts`、`Core/PartyWindow.ts` | 严格批次/decision/policy、schema2状态、调度端口、稳定顺序、计划尾、单时钟、软硬停、待决、段收据；Game执行与存读校验共同消费 |
| `Core/PartyPlanning.ts` | WeakMap session草稿/ready/deadline/generation；已知世界副本预演，支持move/wait/search，未知、敌人、物品/技能给不确定性；主局重新验证 |
| `Core/Game.ts`、`TimeCoordinator.ts` | 公开命令桥接、actor作用域、原生modal/对话和答案、阶段动作余时、段末日志与full、存读/录制/seek。TimePorts.party新增可选windowRemaining/windowStop，仅party窗口提供 |
| `partyIdentity`、party descriptor、`WholeRunSnapshot`、`RecordingV4/Format/Digest` | 有效F22/S9/R6/O4贯穿规则、头、origin、Worker及摘要；语义段末full+receipt，不取代周期256/chunk2048；旧party拒绝，无party原F20/S7/R4/O2 |
| `ExtensionRuntime.hasRegisteredCommand` | 由private改public，仅给计划接受阶段做静态注册检查；原有动态allowsInput仍在实际执行时检查，未改变可选模块SDK版本 |
| party HUD/WindowPanel/usePartyUi、创建步骤 | 真实菜单配置、队列/旅行/档位/策略/确认/预演、原因与成员高亮；flush后复核session/世界revision，重复提交锁 |
| narrative UI/view | 待决优先绑定原actor；其他展示走focused成员；规划接收不会因尚未执行而误报拒绝，无party仍读主成员 |
| U03/摘要/测试登记及i18n | party持久根与session区分；四个基础party桥接文案移入核心locale，文本不变，使物理删包后核心仍无缺键；没有删守卫、改容差或加skip |

## 长跑暴露问题及闭环

首次生产Worker四人长边界发现段末combat日志尚未flush，live/save与replay根不同且续录origin丢失。生产在窗口段事务完成前flush，再生成语义full；整文件1/4人2049路线复验通过。另有续录新测试错误假设窗口末必有readyActor，改用下一窗口续录，保留full/前缀和origin断言。

最终性能长跑又发现主成员阶段动作跨100tick后通用输入锁拒绝后续窗口；旧专项只覆盖副成员。`commandInputLocked`仅为party:window/decision允许推进已有阶段工作，invalid run及动画锁保留；实玩、replayStep和tickReplay共用，普通动作及无party仍用原锁。补主/副成员及自然1/2/4人保存→恢复→自动回放→seek→续录回归，性能工具每次要求录像事件恰增1，并禁止回放游标停滞。旧工具误将未接受输入计为2049条，因此该批窗口结果**作废**，不因原输出smoke-only/OOS0而采信；原目录保存在`perf-invalid-primary-lock/`。

本轮新测试最初使用10000ms播放帧，被既有ActionCadence的250ms连续帧上限正确拒绝；改为100ms，不改生产节拍或原断言。依赖扫描发现同名局部extensions变量遮蔽观测后，改测试局部变量名，保留原依赖登记。日志`primary-lock-first/second/third.log`分别保留，third为2文件34项通过；之后最终整文件日志见lock-results。

旧测试仅party_lifecycle两个已批准版本前提发生变化（8/5→9/6），反事实证据已列上文。其余新增测试前提修正与生产bug修复分别记录；未重录黄金fixture/trace、未放宽旧断言。

## 本地归因的可复核结论

同机Apple M5 / Darwin arm64 / Node24.19.0；运行顺序串行，3GiB heap，无并发模拟负载。六场P1a基线各2049输入，rowsHash、双流与fullDigest均逐场匹配原云端第一轮；另核对每条实际录制数连续，避免同类空提交误计。新观察器不替换旧party-v1原脚本，计时数据属于另立身份。

1人only与all并非相同世界工作量：平均活动层实体（含成员）14.68 vs 9.13，原生NPC takeTurn 34987 vs 22068；NPC层计时15420 vs 4168ms，capture 73735 vs 69925ms，GC总持续9662 vs 7097ms。all同时增加stats层1804→8550ms及录制主线程428→2824ms。较少NPC/对象图/GC可以抵消扩展成本；这些是重叠观测，不能相加成因果百分比，更不能得出开启扩展必然加速。

二人all的598次零tick有精确机械来源：两个成员movementSpeed均100，无haste/麻痹/沉眠。真实受击产生5次poise耗尽stagger，输入index1195/1272/1742/1781/1988；原生`PhasedAttackProduction`将恢复余时取max，造成成员时相错开。主成员delta=0有598次，其余10/50/90分别358/38/30；另成员100/90/50/10分别599/358/38/30。不是一人一次必然各占一半，也不是扩展偷偷改速。`two-all-cause.json`保留实际事件和计时字段。

四人only的零tick为1537/2049，正tick P95约55.55ms，零tickP95约48.94ms；仍每输入支付事务捕获，capture合计约76044ms，实际只推进51200ticks。固定提交数减少了世界工作量，不等于单位tick成本下降。原云端四人是EPYC9V45，1/2人EPYC7763；本地同机结果不支持“4人比2人更快”。

记录增长与GC另存`baseline-record-growth.json`。例如1人only首256条P95约38.01ms、尾257条78.59ms，但实体均值也8.41→20.69、NPC行动2663→6111，GC与记录长度一起变化，不能单独归因给记录增长。GC事件有实际时间戳；内存为测量起止RSS/heap和双Game验证后进程终点，不声称峰值、浏览器内存或每成员净增。

## 性能口径与待维护者工作

旧run39092973578原工件在 `/private/tmp/perfci-39092973578/ext-perf-39092973578-1-aggregate/`；仍是party-v1、B=a502cea、三轮2049 ready-actor-wait-v1、无预算。1人party-only约173ms与party-all约142ms分列，4人CPU不同，不据此声称人数越多越快。

新工具 `profile-party-window-perf.mjs` / `run-party-window-perf.mjs` / `merge-party-window-perf.mjs` 使用 `party-window-v1`。旧party-v1脚本/输入/seed/2049路线保持原样。分层capture/restore、FOV、scheduler、environment/NPC、recordMain为**包含关系计时**，不可相加；正/零tick分桶及CPU/tick、实际blocks/NPC/actions、速度/强制状态/实体/记录长度一起输出。Worker compute与主线程可重叠。接受前等待及提交到可输入单列；本地focus/preview是Node API耗时，不是浏览器可见延迟/FPS。memory只报process终点，不冒称峰值。

本地数据、每场hash/输入/工作量、分层/Worker分位与体积/内存、测试日志SHA及完整CLI见 [精简证据JSON](party-p1b.perf-summary.json)。原始工件均在`/private/tmp/party-p1b/perf/`，不入库。以下计时均为本机观测，不是云端预算。

| 旧P1a 2049单步 / 配置 | 客观ticks | 零tick输入 | 输入到API可继续P95 ms | 总CPU ms/tick |
| --- | ---: | ---: | ---: | ---: |
| 1 / party-only | 204900 | 0 | 73.58 | 0.6968 |
| 1 / party-all | 206180 | 0 | 64.96 | 0.6017 |
| 2 / party-only | 102400 | 1025 | 51.81 | 1.0680 |
| 2 / party-all | 102500 | 598 | 44.12 | 0.9709 |
| 4 / party-only | 51200 | 1537 | 53.57 | 2.2938 |
| 4 / party-all | 51200 | 1537 | 60.10 | 2.2725 |

| P1b 2049混合输入 / 配置 | 实际ticks | 零tick输入 | P95 ms | 总CPU ms/tick | 实际Worker任务 | 独立full抽样n |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 / party-only | 213500 | 3 | 89.86 | 0.7876 | 46 | 9 |
| 1 / party-all | 273180 | 12 | 128.65 | 0.6031 | 128 | 13 |
| 2 / party-only | 154550 | 771 | 204.00 | 1.2860 | 128 | 9 |
| 2 / party-all | 110600 | 71 | 52.65 | 1.0822 | 112 | 13 |
| 4 / party-only | 81950 | 1437 | 215.82 | 2.0846 | 128 | 9 |
| 4 / party-all | 67690 | 1008 | 102.37 | 2.0427 | 128 | 13 |

六场均OOS=0、previewPollution=0；初始命令分别1/3，最终录像长度2050/2052，2049次提交均逐次恰增1条。full/RNG在存读/回放后匹配，汇总再次检验原始measurement/save/recording运输hash。全部档位、早停、确认续段及最大32×4=128接受计划均有实际样本；全开第128/129输入分别启动/续进主成员阶段动作，均100tick，长跑不再停在旧前缀。128是接受的计划长度，不冒称精细首窗执行了128动作。

混合路线因自然忙碌/强制状态/打断而包含不同数量的窗口和单步：这些工作量差异随逐输入数据保存。二人only及四人only的较高P95不能与旧单步P95直接判回归。独立full观察只有9或13个样本；Worker的语义full任务数另列，不能把二者混为一个n。UTF-8紧凑整档约4.66–5.33MB，Worker在途字节峰值约8.57–8.88MB；每段/每intent及加速快照开销在JSON分别给出，非旧64KiB/256KiB提案判定。

### 同机轮换与固定预算对照

顺序为1/2/4、2/4/1、4/1/2，only/all分列，全部36场exit0；每个场景三轮的输入、rowsHash、RNG、full、ticks、零tick数、源码和机器/Node一致。下表三轮中位数；每轮8窗×100tick，**实际均800tick、8个环境块、零tick=0**。

| 人数 / 配置 | 每轮成员动作 | 每轮NPC takeTurn | 输入P95中位 ms（每轮n=8） | 同步CPU ms/tick | 总CPU ms/tick（含诊断/最终导出） |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 / party-only | 8 | 80 | 92.66 | 0.8706 | 1.9048 |
| 1 / party-all | 8 | 87 | 142.73 | 1.0839 | 2.3772 |
| 2 / party-only | 16 | 80 | 121.41 | 1.2893 | 2.3653 |
| 2 / party-all | 16 | 87 | 141.01 | 1.5083 | 2.8026 |
| 4 / party-only | 32 | 80 | 185.59 | 2.0003 | 3.0861 |
| 4 / party-all | 32 | 87 | 199.55 | 2.1899 | 3.5149 |

固定预算对照中，only各人数NPC均80次，all均87次；成员动作8/16/32，单位tick成本随人数增长。本机没有“人数增加会更快”的结论。对照旧单步每轮固定32次输入，其实际ticks为3200/1600/800，说明固定提交数诊断如何改变世界工作量。三轮小样本用于归因，不能冻结P99/手机响应或长期吞吐。

### 缓存独立诊断

P1a一人only/all各3对×32步，顺序轮换cache on/off，12场的机械/输入/随机流/录制数严格相等。外部诊断脚本仅在测量期间查询前清缓存；首次临时目录缺esbuild的12次启动失败全部保存在`ablation-initial-import-failure/`，补依赖链接后12场成功，未改生产/测量源码。

| 配置 | stats层总ms 中位 on→off | 总CPU ms 中位 on→off | 输入P95 ms 中位 on→off |
| --- | ---: | ---: | ---: |
| party-only | 11.05 → 14.52 | 1621.20 → 1575.11 | 31.79 → 30.64 |
| party-all | 91.33 → 223.22 | 2235.38 → 2552.94 | 47.72 → 52.98 |

全开关闭缓存时总CPU中位增加约14.2%；only总CPU反低约2.8%，stats层只差约3.5ms，不能解释成普遍的总耗时收益。主动clear成本包含其中，层计时有重叠，结果是该短路线的受控诊断，不能外推为2049长跑中缓存的精确占比。结合NPC/实体/捕获/GC观测，旧“all更快”主要是不同工作量与成本组合，仍不作单因素定量归因。

### rounds=1 工具实际结果与复现

新window：3分片×2配置×2049输入，merge成功、`smoke-only/budget=null`。旧party：3分片×2配置×8输入，merge成功、`smoke-only/budget=null`。无party phase6：A=a47干净副本、B本地冻结候选，rounds=1/limit=8，正确性`hard=pass`，整体`status=incomplete`；包含classic、all-full/prefix及C1/C4有界补充，未跑完整D20，不能称D6通过。原`party-v1`工具与旧预算未改。

实际window命令（shard依次classic/all-full/all-prefix，全部串行）：

```bash
node scripts/run-party-window-perf.mjs --head /private/tmp/party-p1b/candidate \
  --out /private/tmp/party-p1b/perf/window-classic --shard classic --rounds 1 --steps 2049
node scripts/merge-party-window-perf.mjs /private/tmp/party-p1b/perf/window-aggregate \
  /private/tmp/party-p1b/perf/window-classic/result.json \
  /private/tmp/party-p1b/perf/window-all-full/result.json \
  /private/tmp/party-p1b/perf/window-all-prefix/result.json
node scripts/run-ext-perf-ab.mjs --party --calibration-only \
  --head /private/tmp/party-p1b/candidate --out /private/tmp/party-p1b/perf/party-classic \
  --shard classic --rounds 1 --steps 8
node scripts/run-ext-perf-ab.mjs --base /private/tmp/party-p1b/baseline-git --head "$PWD" \
  --out /private/tmp/party-p1b/perf/phase6-local-candidate --rounds 1 --limit 8 \
  --base-identity 6c4 --head-identity 6c4 \
  --head-source-hash aa6584e64c5132be81124121b09dddeb99dc6e27c7aaab2620b1cd188d6e7574
```

最后一条hash是测量时`sourceSnapshot`身份（算法不同于hashCandidate），不是当前文档更新后的工作树身份；重跑应重新计算，且使用新输出目录。完整命令/cwd/工具hash及36场轮换参数在证据JSON的commands。输入到API可继续只包含执行器必要flush；实际UI可额外等flush，提示可见/点击体验仍需浏览器计时。
无三轮完整云端窗口数据，不生成具体硬阈值；预算状态文件明确pending-cloud，不把历史suggestion或D6公式当批准绝对上限。

维护者提交并推送最终候选后，设定不可变提交再派发（本执行者不自行commit）：

```bash
P1B_SHA=$(git rev-parse HEAD)
P1A_SHA=a47a15b635284c84b4651ec28083adc052509c05
test "$P1B_SHA" != "$P1A_SHA"
# 新窗口只能先校准B，不能把没有窗口的P1a作为A。
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref ext/party-p1a \
  -f suite=party-window -f mode=calibration-only -f head_ref="$P1B_SHA" -f rounds=3
# 旧单步路线A/B，仍为report-only；版本/摘要差量须明列。
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref ext/party-p1a \
  -f suite=party -f mode=ab -f base_ref="$P1A_SHA" -f head_ref="$P1B_SHA" -f rounds=3
# 无party phase6三分片：完整classic、完整all及可比prefix。
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref ext/party-p1a \
  -f suite=phase6 -f mode=ab -f base_ref="$P1A_SHA" -f head_ref="$P1B_SHA" \
  -f base_identity=6c4 -f head_identity=6c4 -f rounds=3
```

前提：该远端ref已包含本次workflow和工具，P1B_SHA是维护者新提交，不能仍是a47a15b。D6保持严格大于、至少1ms噪声带、三轮至少两轮越线判退；all/full工作量不可比只报告时间，正确性仍硬验。完整云端校准后审定scene/metric/单位/样本/环境/数字/等级，另一次完整运行做独立验证；不能从三轮选一轮冒充第四次。

## 人工与未覆盖范围

浏览器/真机逐项见 [人工清单](party-p1b.manual-checklist.md)，均默认待验。512扩展子集中只精选11个+classic，其余501未穷举。物理删除仅retain=none；其他单删/单留布局不声称验证。P1a/phase6历史未覆盖项目不因本步通过而关闭。P1c AI、P1d完整手机计划编辑及平衡、P2联机未实现。

## 尚需维护者的裁定与交付边界

1. 发布不可变候选后派发上面三条gh命令；窗口完整三轮数据齐备后决定每个scene/metric的hard或report-only等级、数值/余量/环境，再做独立完整验证。B6只批准方法，`party-perf-p1b-budget.json`保持pending-cloud、hardLimits=null，旧预算/建议未改。
2. 按人工清单完成桌面、320/390模拟触屏、真实Worker后台恢复和真机；点击到提示可见、浏览器长任务/RSS峰值及手机FPS没有Node替代证据。
3. `inputMaxBytes=262144`、`stateMaxBytes=4194304`是已进入规则指纹的防御性协议资源界限，区别于性能预算、旧P0提案与浏览器交互阈值；没有据本地测量发明冻结数字。

本报告不关闭P1a/phase6历史未覆盖、其他501子集或其他删除布局。没有需要打断实施的新规则裁定；剩余数字/人工/发布按已批准B6/B7移交。未commit、未push。
