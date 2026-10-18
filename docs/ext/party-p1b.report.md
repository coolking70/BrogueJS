# Party P1b 实施报告

2026-10-18；开工 `ext/party-p1a` / `a47a15b635284c84b4651ec28083adc052509c05`，工作区干净。维护者已裁定 B1–B7 全部按推荐，先回填任务单再实施。未commit/push/合并/发布。原始证据在 `/private/tmp/party-p1b/`，不提交截图、大日志或录像。

> 2026-10-19更新：P1b已发布a4117b2；性能跟进、预算建议与非party回归见[最新性能节](#性能跟进云端校准与单步归因2026-10-19)。以下实施与审查状态按当时证据保留。

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

## 性能跟进：云端校准与单步归因（2026-10-19）

**最新状态覆盖下方历史待办：P1b 已发布为 `a4117b225a73f68b697fabe552aa168a17fee4a7`。四人“慢约30%”来自跨 runner 的旧校准与新 B 测量比较；同一次 A/B 三轮并未复现该回归。非 party 云端回归 pass。窗口预算建议如下，全部待维护者审定，尚未冻结或独立验证。** 本次不改生产代码、玩法、录像或旧基线，不 commit/push；本地 profile 及限定检查见下文。

### 云端单步：先纠正比较基准

[单步 A/B run 39132732252](https://github.com/coolking70/BrogueJS/actions/runs/39132732252)：A=`a502ceade31fa764d9b1aab03e6179d88c1f9224`，B=`a4117b225a73f68b697fabe552aa168a17fee4a7`。六场各三轮、每侧2049次 `ready-actor-wait-v1`，seed42，Node v24.21.0；每个配对的 rowsHash、rngHash 一致，OOS=0。格式由 F21/S8/R5/O3 升到 F22/S9/R6/O4，party schema1→2 多了 window，模块版本/指纹不同，fullDigest 不要求跨版相等；各自存读/回放必须等于各自末态。原工具结论仍是 **report-only / measured-no-budget**，不改称 D6 pass。

| 人数 / 配置 | A P95 三轮 ms | B P95 三轮 ms | B/A 变化三轮 |
| --- | ---: | ---: | ---: |
| 1 / party-only | 173.941 / 174.528 / 174.538 | 175.865 / 174.170 / 174.004 | +1.11% / -0.20% / -0.31% |
| 1 / party-all | 143.211 / 144.281 / 142.276 | 144.387 / 142.955 / 142.683 | +0.82% / -0.92% / +0.29% |
| 2 / party-only | 118.281 / 117.609 / 118.191 | 116.941 / 117.024 / 117.850 | -1.13% / -0.50% / -0.29% |
| 2 / party-all | 123.559 / 125.495 / 123.863 | 123.408 / 123.192 / 124.005 | -0.12% / -1.84% / +0.12% |
| 4 / party-only | 92.953 / 92.546 / 94.146 | 92.617 / 92.596 / 91.672 | -0.36% / +0.05% / -2.63% |
| 4 / party-all | 98.411 / 99.927 / 99.650 | 102.851 / 99.293 / 96.610 | +4.51% / -0.63% / -3.05% |

四人分片在新 run 中，A/B **同为 EPYC 9V74**。P1a 旧校准 [39092973578](https://github.com/coolking70/BrogueJS/actions/runs/39092973578) 是 **EPYC 9V45**：四人 only P95 三轮73.231/71.768/70.194ms，all75.806/76.516/70.414ms。旧P1a→新P1a的中位变化已经是约+29.5%/+31.5%；旧P1a→新P1b约+29.0%/+31.0%。同源码的环境差异足以解释所报现象；不能把这两次跨 runner 数字归因于P1b。CPU型号只是明确可见的环境差异，未做CPU因果隔离，不能断言全部差值仅由型号造成。新run四人only同机三轮为−0.36%/+0.05%/−2.63%，all为+4.51%/−0.63%/−3.05%；不存在持续约30%的增长。

### 本地同输入 profile 与分段计数

在仓外 `git archive a502cea` 与 `git archive a4117b2` 副本运行同一诊断脚本，顺序only A→B、all B→A，每场4人/2049次wait；没有删减路线或改seed。两副本分别1502/1512个src文件逐个Git blob核对等于提交；诊断仅包装方法计时/计数并启用Node Inspector，生产文件未修改。Apple M5 / macOS arm64 / Node v24.19.0 / heap3072MiB，生产Worker保留，四场串行，性能期间不运行测试。原始profile/逐输入分段/存档/录像在 `/private/tmp/party-p1b-perf-followup/results/`，不提交大文件。

| 四人配置 | 单步P95 A→B ms | 累计单步墙钟 A→B ms | capture A→B ms | capture占累计墙钟 A→B |
| --- | ---: | ---: | ---: | ---: |
| party-only | 43.464 → 44.345（+2.03%） | 74455.7 → 75385.9 | 60275.0 → 60735.8 | 80.95% → 80.57% |
| party-all | 46.097 → 46.255（+0.34%） | 73386.5 → 72918.5 | 57814.9 → 57075.5 | 78.78% → 78.27% |

| 分段方法 | only调用数 A=B | only总ms A→B | all调用数 A=B | all总ms A→B |
| --- | ---: | ---: | ---: | ---: |
| preparePartyInput | 4098 | 11.47 → 10.89 | 4098 | 9.93 → 10.01 |
| checkpointCombatFactWorld | 2049 | 60274.95 → 60735.79 | 2051 | 57814.89 → 57075.54 |
| updateVision | 4097 | 3905.59 → 4090.91 | 4097 | 4249.36 → 4374.65 |
| scheduler | 2049 | 2786.11 → 2924.37 | 2049 | 5210.84 → 5237.86 |
| objectiveTimeBlock | 512 | 534.39 → 581.02 | 512 | 569.80 → 589.79 |
| npc | 5804 | 442.12 → 425.80 | 5751 | 885.61 → 870.57 |
| updateRecordedCheckpoint | 2049 | 336.78 → 385.20 | 2049 | 2377.53 → 2464.38 |
| recordingEventDigest | 2056 | 135.14 → 185.61 | 2056 | 1360.25 → 1426.41 |

各层为包含关系墙钟计时，不能相加当总CPU。`recordingEventDigest`含2049个输入的2049次与原工具7次独立摘要抽样；其他原工具诊断不在`step`计时内。两配置均51200ticks、1537个零tick输入、512个环境块；NPC only5804/all5751次；周期主线程boundary8次、Worker compute9次均跨版相同。按输入1–512、513–1024、1025–1536、1537–2049再分段，每段ticks均12800，A/B各方法调用数逐段相等；only capture为512/512/512/513，all为513/512/512/514（两个额外原生事务），不是把总次数相同当作执行顺序相同。分段P95/耗时和完整计数见派生JSON。

CPU profile只覆盖测量循环（含原工具诊断、排除初始化与回放），以采样栈self time归类；两版最大的热点均为 `WorldCheckpoint.ts` 的 `capture`，其次主要为GC及快照拷贝。party-only的capture采样占比为64.63%→64.39%。party-all的capture采样占比为75.31%→74.75%。采样占比与上述单步包围计时分母不同，Worker自身CPU也不在主线程profile里，不能直接相加。

四场完整运行exit0，原生产存读/seed replay校验均OOS=0；各自的rowsHash、rngHash、fullDigest又逐一等于同版本同场景的云端结果。A/B逐步rows/RNG相等，保存对象差异仅为时间戳、批准的版本/模块指纹、schema2空闲window及由此派生的摘要/链，不删除版本字段后伪造full相等。四人partyControl JSON为536→1838bytes，空闲window增加1302bytes；这是新增状态的实际成本，但没有新增单步环境块或周期Worker任务。单步路径的窗口检查为idle状态检查；semanticFull只对`party:window/party:decision`触发。

**归因与处理：未确认P1b约30%的单步代码回归，不做无依据的优化补丁。** 已知主要成本登记为P1a就有的每输入全写集事务捕获，当前约占单步累计墙钟78–81%；入口为`Game.partyCommandStages → checkpointCombatFactWorld → checkpointGenerationWorld`。去掉捕获或跨写边界复用会牵涉失败回滚、对象身份与录像合同，不能作为本次低成本语义不变修复。此次仅一对完整本地profile/配置，带观察器开销；它与云端三轮同机结果一致，不冒称统计上零开销、性能改善或新预算通过。没有生产修复，故无需新增玩法回归；性能工具的可比性/身份/完整性相关测试另列。

复现入口（副本已准备；脚本SHA256 `67665d421751c552f2999ec05493b62ca1e4dbbb4810fb3c9c4f4b04eb2d090d`，脚本和生成器留在证据目录；重跑请改新输出名，避免覆盖原证据）：

```bash
# cwd分别为 /private/tmp/party-p1b-perf-followup/A 或 B
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --max-old-space-size=3072 scripts/diagnose-party-step.mjs \
  /private/tmp/party-step-rerun-A-only.json party-only 4 2049
# 同样对B/only，然后B/all、A/all；精确原四条命令在commands.json及派生JSON。
```


### B6 窗口预算数字与等级建议（待维护者审定）

来源：[窗口校准 run 39132723627](https://github.com/coolking70/BrogueJS/actions/runs/39132723627)，`party-window-v1` / `window-mixed-v1` / seed42，**6场景×3轮=18项测量**，每项2049输入；`measured-no-budget`、budget=null。源SHA为a4117b2，sourceHash=`2fb116bab6376ab3774022f3be2d1b1e4119ab9f8ac7dddc53904e91f5515b43`，Linux x64/Node v24.21.0/heap3072MiB。人数分片使用的CPU不同，禁止跨人数用绝对耗时推导扩展比例。三轮内每场的输入hash、rowsHash、RNG、fullDigest、ticks及零tick数固定，OOS=0、previewPollution=0，逐输入录像增长校验通过。原始产物在 `/private/tmp/perfci-39132723627/`；逐场三轮数值、hash、工具身份与候选计算在 [精简派生证据](party-p1b.perf-followup.json)，离线计算脚本为 `/private/tmp/party-p1b-perf-followup/derive.py`。

| 人数 / 配置 | runner CPU | ticks / 零tick输入 | 环境块 / NPC动作 / 成员动作 | 输入 / full / Worker 样本（每轮） |
| --- | --- | ---: | ---: | ---: |
| 1 / party-only | 9V74 | 205200 / 3 | 2052 / 35065 / 2053 | 2049 / 9 / 46 |
| 1 / party-all | 9V74 | 248480 / 10 | 2484 / 25379 / 2472 | 2049 / 13 / 128 |
| 2 / party-only | 7763 | 106900 / 1014 | 1069 / 14264 / 2139 | 2049 / 9 / 54 |
| 2 / party-all | 7763 | 109000 / 74 | 1090 / 11529 / 2180 | 2049 / 13 / 61 |
| 4 / party-only | 7763 | 52800 / 1529 | 528 / 6012 / 2113 | 2049 / 9 / 47 |
| 4 / party-all | 7763 | 60600 / 1048 | 606 / 6909 / 2425 | 2049 / 13 / 59 |

计时边界：`inputToReady` 为Node提交前等待→执行器必要flush完成，含同步模拟及可能的Worker等待；并非浏览器点击→画面可见。`positive/zero`只计同步输入；层计时嵌套、Worker与主线程重叠，禁止相加。模拟CPU/tick包含并行Worker CPU，不拿墙钟ms的1ms余量套到CPU/tick。当前各场输入多数为单步（1854–2008条），以下“混合路线”预算不能称作每个窗口档位的响应预算。

计算严格采用B6起点：每项指标参考值=三轮分位数中位数；`U=max(三轮该分位数)`，P50/P95建议=`U+max(1ms,0.10U)`，P99/max建议=`U+max(1ms,0.25U)`，向上取整到0.01ms。不是“中位数×1.1”，不是D6相对判退公式，也不是已批准产品体验标准。

**等级建议：** 下表混合路线P50/P95列为 **hard候选**，仅适用于上表完全相同的输入/工作量/工具/Node与CPU环境，并经维护者批准及另次完整验证后生效。P99/max均为 **report-only**；单一混合尾分位数难以代表各档位，先保留解释性指标。正确性、完整三轮/三分片、输入与身份一致性仍为必需条件。环境不匹配时这些绝对上限不作pass/fail裁定，应保持未验证或另行校准，不从同次结果挑快轮通过。

| 人数 / 配置 | P50 中位→建议上限 ms | P95 中位→建议上限 ms | P99 中位→参考上限 ms | max 中位→参考上限 ms |
| --- | ---: | ---: | ---: | ---: |
| 1 / party-only | 100.85 → 111.07 | 164.70 → 182.57 | 204.63 → 256.04 | 297.77 → 380.68 |
| 1 / party-all | 86.67 → 96.23 | 241.41 → 267.82 | 781.32 → 984.53 | 949.29 → 1245.75 |
| 2 / party-only | 100.06 → 110.40 | 127.87 → 143.43 | 267.87 → 337.91 | 1867.51 → 2349.80 |
| 2 / party-all | 109.13 → 120.55 | 139.51 → 154.40 | 287.52 → 367.73 | 2015.41 → 2538.46 |
| 4 / party-only | 92.82 → 102.46 | 116.96 → 129.38 | 251.41 → 321.65 | 1423.30 → 1826.74 |
| 4 / party-all | 92.14 → 102.19 | 137.13 → 151.54 | 437.82 → 565.26 | 3658.37 → 4621.68 |

摘要/flush/模拟预演/切焦点建议全部 **report-only**。下表为P95参考上限ms，括号是每轮样本n；独立full仅9/13样本，不能把Worker任务数替代它。接受前等待、positive/zero同步输入、Worker主线程投影/编码/派发/发布各项三轮P95建议也在派生JSON内，均只报告；不因较低耗时就冻结低样本分位数。CPU/tick、分层总耗时、GC维持归因指标，不设置硬阈值。

| 人数 / 配置 | projection | full摘要 | encoding | flush | preview | focus | Worker compute |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 / party-only | 21.48 (9) | 118.44 (9) | 23.28 (9) | 144.25 (19) | 3.03 (9) | 1.17 (9) | 155.91 (46) |
| 1 / party-all | 23.64 (13) | 163.14 (13) | 17.63 (13) | 170.29 (94) | 3.20 (13) | 1.16 (13) | 128.99 (128) |
| 2 / party-only | 29.94 (9) | 222.75 (9) | 43.71 (9) | 227.15 (23) | 4.16 (9) | 1.18 (9) | 229.48 (54) |
| 2 / party-all | 37.98 (13) | 163.42 (13) | 23.62 (13) | 183.53 (25) | 3.76 (13) | 1.19 (13) | 182.58 (61) |
| 4 / party-only | 27.34 (9) | 180.33 (9) | 20.04 (9) | 170.94 (19) | 4.40 (9) | 1.16 (9) | 171.79 (47) |
| 4 / party-all | 35.60 (13) | 146.09 (13) | 22.06 (13) | 179.92 (24) | 4.09 (13) | 1.16 (13) | 170.90 (59) |

按窗口档位/场景的具体建议如下，**全部report-only、待维护者审定**。label内合并自然结束原因，仅用于呈现；每个 `label:reason` 的n、三轮P95/max与建议值另存派生JSON，独立验证仍逐桶核对工作量。fine/100/300/1000/auto、confirmation/decision和阶段动作不可混用上限。样本最大仅77/轮，许多n=1，此时P95=max只是样本值，不能当稳定尾分位数。1000/auto四人全开实测约3.7秒的尾部属于需要浏览器评估的已知长窗口开销，本表约4秒的参考上限不表示交互体验合格；后续如优化须保持相同tick/成员动作/环境块。

| 人数 / 配置 | 窗口场景 label | 每轮样本 n | P95 中位→参考上限 ms | max 中位→参考上限 ms |
| --- | --- | ---: | ---: | ---: |
| 1 / party-only | fine | 7 | 275.08 → 307.04 | 275.08 → 348.91 |
| 1 / party-only | confirmation | 1 | 153.44 → 168.96 | 153.44 → 192.00 |
| 1 / party-only | decision | 1 | 228.31 → 262.63 | 228.31 → 298.44 |
| 1 / party-only | 300 | 7 | 273.02 → 335.00 | 273.02 → 380.68 |
| 1 / party-only | 1000 | 9 | 272.01 → 327.55 | 272.01 → 372.21 |
| 1 / party-only | auto | 6 | 231.56 → 272.37 | 231.56 → 309.51 |
| 1 / party-only | 100 | 9 | 294.15 → 327.21 | 294.15 → 371.82 |
| 1 / party-all | fine | 8 | 185.84 → 237.75 | 185.84 → 270.17 |
| 1 / party-all | confirmation | 1 | 168.45 → 186.73 | 168.45 → 212.19 |
| 1 / party-all | decision | 1 | 201.61 → 247.95 | 201.61 → 281.77 |
| 1 / party-all | phased | 1 | 136.94 → 172.86 | 136.94 → 196.43 |
| 1 / party-all | phased-resume | 1 | 205.97 → 232.47 | 205.97 → 264.17 |
| 1 / party-all | 300 | 77 | 347.75 → 391.14 | 361.83 → 470.19 |
| 1 / party-all | 1000 | 67 | 884.46 → 976.80 | 941.28 → 1182.55 |
| 1 / party-all | auto | 27 | 758.29 → 835.59 | 949.29 → 1245.75 |
| 1 / party-all | 100 | 11 | 209.69 → 258.25 | 209.69 → 293.47 |
| 2 / party-only | fine | 9 | 354.25 → 392.63 | 354.25 → 446.17 |
| 2 / party-only | confirmation | 1 | 289.86 → 321.07 | 289.86 → 364.86 |
| 2 / party-only | decision | 1 | 304.95 → 372.55 | 304.95 → 423.35 |
| 2 / party-only | 300 | 10 | 617.98 → 723.54 | 617.98 → 822.21 |
| 2 / party-only | 1000 | 10 | 1867.51 → 2067.82 | 1867.51 → 2349.80 |
| 2 / party-only | auto | 8 | 273.25 → 328.87 | 273.25 → 373.72 |
| 2 / party-only | 100 | 9 | 377.11 → 440.49 | 377.11 → 500.55 |
| 2 / party-all | fine | 7 | 295.89 → 341.11 | 295.89 → 387.63 |
| 2 / party-all | confirmation | 1 | 285.72 → 332.56 | 285.72 → 377.91 |
| 2 / party-all | decision | 1 | 287.09 → 336.28 | 287.09 → 382.14 |
| 2 / party-all | phased | 1 | 133.97 → 155.56 | 133.97 → 176.77 |
| 2 / party-all | phased-resume | 1 | 370.10 → 416.90 | 370.10 → 473.74 |
| 2 / party-all | 1000 | 12 | 2015.41 → 2233.84 | 2015.41 → 2538.46 |
| 2 / party-all | auto | 11 | 1907.83 → 2118.44 | 1907.83 → 2407.32 |
| 2 / party-all | 100 | 13 | 400.16 → 449.83 | 400.16 → 511.17 |
| 2 / party-all | 300 | 8 | 567.93 → 673.18 | 567.93 → 764.98 |
| 4 / party-only | fine | 8 | 407.04 → 487.41 | 407.04 → 553.88 |
| 4 / party-only | confirmation | 1 | 273.75 → 317.07 | 273.75 → 360.30 |
| 4 / party-only | decision | 1 | 265.62 → 292.65 | 265.62 → 332.56 |
| 4 / party-only | 300 | 7 | 967.33 → 1087.33 | 967.33 → 1235.60 |
| 4 / party-only | 1000 | 9 | 1423.30 → 1607.53 | 1423.30 → 1826.74 |
| 4 / party-only | auto | 6 | 366.45 → 405.05 | 366.45 → 460.29 |
| 4 / party-only | 100 | 9 | 439.51 → 488.11 | 439.51 → 554.67 |
| 4 / party-all | fine | 7 | 481.17 → 539.18 | 481.17 → 612.70 |
| 4 / party-all | confirmation | 1 | 291.52 → 322.23 | 291.52 → 366.17 |
| 4 / party-all | decision | 1 | 277.81 → 308.98 | 277.81 → 351.11 |
| 4 / party-all | phased | 1 | 309.35 → 344.42 | 309.35 → 391.38 |
| 4 / party-all | phased-resume | 1 | 548.62 → 606.13 | 548.62 → 688.78 |
| 4 / party-all | 1000 | 13 | 3658.37 → 4067.08 | 3658.37 → 4621.68 |
| 4 / party-all | auto | 7 | 3573.73 → 3962.81 | 3573.73 → 4503.19 |
| 4 / party-all | 100 | 12 | 467.08 → 535.31 | 467.08 → 608.31 |
| 4 / party-all | 300 | 10 | 1237.80 → 1365.89 | 1237.80 → 1552.14 |

体积与内存建议全部 **report-only**，只给三轮观测最大值，不发明硬上限或沿用旧64KiB/256KiB提案。Worker在途峰值不等于总RSS峰值；RSS/heap是测量结束端点、不是峰值，也不是每多一名成员的净开销。以下bytes为紧凑JSON/原始字节，不是压缩下载大小。

| 人数 / 配置 | save / recording bytes | Worker在途峰值 bytes | RSS端点 / heapUsed端点 bytes |
| --- | ---: | ---: | ---: |
| 1 / party-only | 4656117 / 4656970 | 8763008 | 1345277952 / 631796008 |
| 1 / party-all | 4872837 / 4873394 | 8844226 | 1499901952 / 678450432 |
| 2 / party-only | 4672951 / 4673789 | 8756268 | 1265549312 / 466983904 |
| 2 / party-all | 4723288 / 4725911 | 8881032 | 1377247232 / 673036048 |
| 4 / party-only | 4652882 / 4652085 | 8636356 | 1246437376 / 676189688 |
| 4 / party-all | 4650586 / 4650807 | 8442698 | 1375748096 / 715824128 |

### 独立验证的精确命令与判读

本次没有生产或测量工具代码变更，因此新运行的head继续固定为已发布的a4117b2。**维护者先审定上述数字/等级/环境，再另行运行**；现有三轮校准不可抽一轮充当独立验证。本次只提供命令，未dispatch。

```bash
gh workflow run ext-perf.yml --repo coolking70/BrogueJS --ref ext/party-p1a \
  -f suite=party-window -f mode=calibration-only \
  -f head_ref=a4117b225a73f68b697fabe552aa168a17fee4a7 -f rounds=3
```

`--ref`选择工具工作流的分支，`head_ref`固定被测源码；运行前核对分支里的profile/run/merge/common四工具hash与派生JSON的windowTools相同。该命令生成另次三分片18项完整测量。工具仍输出 `measured-no-budget`，**没有自动窗口硬预算判定器**。下载新aggregate后用原 `readShard`/`merge`校验全部原始measurement/save/recording运输hash，再逐场与已审表比对，不改工具状态为pass。建议独立验证准则（同样待审定）：身份、hash、工作量、样本匹配且OOS/污染=0；获批hard项每场三轮均不得严格大于上限，report-only项记录差值与原因。此准则与D6“两轮越线”分开，不冒称现有脚本已实现。新runner型号不匹配时保留未验证，不能按新数据抬高预算直接关闭；可安排同机配对/匹配runner后再审。

若维护者在验证前另有生产或测量代码修订，改用其**提交并推送后的完整SHA**作为head，更新工具身份并重新校准/审定；不能继续拿a4117b2的数字冒充新候选。`scripts/party-perf-p1b-budget.json`仅将流程状态更新为待审定，hardLimits仍null，不提前写入获批阈值。

### 非 party 云端回归：pass

[run 39132740608](https://github.com/coolking70/BrogueJS/actions/runs/39132740608)，A=a502cea、B=a4117b2，双方6c4身份，三轮完整运行、limit=0：aggregate `status=pass`、`hard=pass`，D6-2026-10-16。classic/full两侧2208输入/2431环境块；all/full与prefix均2423输入/2549块，配对工作量未变。classic/full、all/full、all/prefix越线轮数分别0/3、0/3、1/3，均pass；C1/C4及独立冻结验证按原artifact结果记录通过。本结论来自既有云端产物，不是本次重跑，也不替代party窗口预算或浏览器验收。

phase6的 `sourceHash` 表示工作区差量摘要，干净树为SHA256空输入值；源码身份按A/B/control不可变commit及srcTree核对：A `50d3dc423705ddd23f6aca1f447042be1b4e4728`，B/control `cc195521e81a8f63143105b2e0a4c2def0853eb0`。这与party工具的全候选sourceHash口径不同，原证据均保留。

### 本次限定检查与证据

Node v24.19.0下，相关性能工具测试2文件25项通过（`party_perf_tools` 11项、`party_window_perf_tools` 14项），D6脚本测试通过；测试依赖扫描693文件，errors=[]。全部exit0。没有生产修改，本次未跑boundary/vue-tsc/build、完整npm test/drift/full/gen或浏览器，也未派发新云端任务。

```bash
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
node node_modules/vitest/vitest.mjs run src/test/party_perf_tools.test.mjs \
  src/test/party_window_perf_tools.test.mjs --maxWorkers=1 --no-file-parallelism \
  --reporter=default --reporter=json \
  --outputFile=/private/tmp/party-p1b-perf-followup/tests.json
node scripts/test-ext-perf-ab.mjs
node scripts/check-test-dependencies.mjs
node /private/tmp/party-p1b-perf-followup/validate-cloud.mjs
```

最后一条是本次仓外离线核验：原window `readShard/merge`重新验证18个measurement及其save/recording运输hash与aggregate一致；单步36个原始measurement hash、18对同机rows/RNG与比值核对一致；phase6原始summary/rounds与aggregate一致，重新应用原D6得到0/3、0/3、1/3越线、pass。此步骤没有新测量，不是B6独立验证。候选数字另按原始samples/分位数离线推导，没有修改云端artifact或旧基线。日志、命令、源blob验证、profile与生命周期差异统计均在 `/private/tmp/party-p1b-perf-followup/`；小型身份/数据/日志hash汇入派生JSON。

本次四场profile全部首次exit0；Vite SSR初始化仍记录本地WebSocket监听EPERM提示，但测量与完整回放都完成，不将其当浏览器验证。另一次只读`ps`诊断受沙箱拒绝，未依赖该输出；所有数据由进程结果与工件核实。最终`git diff --check`通过，无CRLF、无>1MB新增文件；工作区只改本报告、派生证据JSON和预算状态JSON。HEAD仍a4117b2，未commit/push。

## 历史性能口径与待维护者工作（审查前记录）

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

## 历史裁定与交付边界（由上方2026-10-19性能节更新）

1. 发布不可变候选后派发上面三条gh命令；窗口完整三轮数据齐备后决定每个scene/metric的hard或report-only等级、数值/余量/环境，再做独立完整验证。B6只批准方法，`party-perf-p1b-budget.json`保持pending-cloud、hardLimits=null，旧预算/建议未改。
2. 按人工清单完成桌面、320/390模拟触屏、真实Worker后台恢复和真机；点击到提示可见、浏览器长任务/RSS峰值及手机FPS没有Node替代证据。
3. `inputMaxBytes=262144`、`stateMaxBytes=4194304`是已进入规则指纹的防御性协议资源界限，区别于性能预算、旧P0提案与浏览器交互阈值；没有据本地测量发明冻结数字。

本报告不关闭P1a/phase6历史未覆盖、其他501子集或其他删除布局。没有需要打断实施的新规则裁定；剩余数字/人工/发布按已批准B6/B7移交。未commit、未push。
