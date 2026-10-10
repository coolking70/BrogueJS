# narrative2 维护者验收（2026-10-11）

**结论：需底座修复后合入。** 当前候选不是全绿。三类阻断均已在未改生产代码的 `59b9ba6` 重现；当前远端 `ext/phase5` 也是该提交。未发现应归因于五名新增 NPC 的独立生产缺陷。录制来源一项同时是新任务包与旧底座明确策略的合同冲突，不能仅称普通实现 bug。下附补丁是维护者修复草案，不是已发布修复；不得据此把原候选的失败改记通过。

## 1. 身份、环境与范围

- 受验：`ext/narrative2-acc`，HEAD `d622bf2f5ce80a31ff303bada53ba4636bd76586`；派发起点 `0bb902bca2a9573005405b3c2fd1437e4b00a5a5`；代码基线 `59b9ba691daf66819eeea0299a0539f3641ad208`。
- 本地 `origin/ext/phase5` 与基线相同。原树 fetch 因 Git 元数据在沙箱外不可写而失败；独立副本 fetch 又遇 DNS 失败。随后通过 GitHub 只读 `fetch_commit(repo_full_name="coolking70/BrogueJS", commit_sha="ext/phase5")` 核实远端仍为上述 `59b9ba6`（06:22 CST）。因此两个对照目标是同一对象，不伪称测了两个不同版本。
- Node `v24.19.0`，PATH 首项 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；`NODE_OPTIONS=--max-old-space-size=3072`；全部 Vitest 命令 `--maxWorkers=2`。
- 已读 AGENTS、HANDOFF、development、architecture、任务包、dot 报告、配置手册及共享像素产线 README（其主体针对动作序列，本次按任务包静态立绘规范审查）。当前工作树不改 dot 的源码/测试/配置/资源；只新增本文和 `docs/ext/evidence/narrative2/` 的补丁、测试草案及测试输入。没有 push。
- `git diff 59b9ba6 d622bf2 -- src ':!src/ext/modules/narrative'` 为空。三个根因涉及的共享引擎/SDK 在两端字节完全相同。
- 原始交付证据：`/private/tmp/narrative2-delivery/narrative2-evidence/`；本次命令、日志、退出码、秒数、完整差异、16 MB 真存档及脚本：`/private/tmp/narrative2-acceptance/`。截图和大文件不入仓。

## 2. 原候选本地门禁

所有结果来自本轮实际运行，不继承 dot 的计数。逐命令 `.command/.log/.exit` 与 `gates.tsv` 在上述本次证据目录；无源码 skip、超时修改或弱化断言。

<!-- LOCAL_GATES -->
| 命令 | exit / 结果 | 本地耗时 |
|---|---|---|
| `node scripts/check-module-boundaries.mjs` | 0；收尾重验亦0 | 3s / 3s |
| `npx vue-tsc -b` | 0 | 10s |
| `npm run build` | 0；保留既有chunk体积警告 | 15s |
| `npx vitest run src/ext/modules/narrative/tests --maxWorkers=2` | **1；22文件：19通过/3失败；416项：404通过/12失败，0 skip/todo** | Vitest838.37s / 墙钟839s |
| 下述11份受影响回归 | **0；11文件189项通过，0失败/skip/todo** | Vitest51.63s / 墙钟53s |
| `npm run test:drift -- --maxWorkers=2` | **0；8文件16项通过，0失败/skip/todo** | Vitest140.49s / 墙钟140s |
| `git diff --check` | 0；逐一检查新增文件LF与<1MB | 收尾 |

首轮 affected/drift 均在启动时 exit1、未执行测试：审查员最初把文档目录中的测试草案命名为 `.test.ts`，全仓测试发现守卫正确拒绝未注册用例。只把交付草案改为 `.test.ts.txt` 后重跑；守卫和dot文件保持不变。首败 `affected.log/drift.log` 和收尾 `affected-final.log/drift-final.log` 分开保留，不归罪于dot，也不冒充首次全绿。1296个原src文件前后SHA-256全部一致。
<!-- /LOCAL_GATES -->

“受影响回归”是原任务包九文件加两个对话宿主文件：`ext_world_interactables`、`ext_optional_queries`、`ext_optional_rewards`、`ext_generation_checkpoint_differential`、`ext_module_boundaries`、`p1_30_i18n_gate`、`u24_hardcoded_text`、`repo_hygiene`、`test_suite_membership`、`dialog_host`、`dialog_service_input`（均位于 `src/test/`，后缀 `.test.ts`）。

本轮按用户指定的验收范围执行；没有执行完整 npm/test:ext、128 组合、实际删除、CE full/gen 或浏览器/真机矩阵。不把历史 5Z、定向复测或补丁副本通过数当成原候选全量通过。

## 3. 十二项失败逐行裁决

下列位置均指未修改的 d622bf2；五人的两个异常入口均先通过完整世界、玩家/runtime 身份、双 RNG、消息、事件前缀、游标、剧情/奖励回滚断言，然后在 `narrative2_rewards.test.ts:110` 失败。后面的续录来源/重试断言在原候选没有执行到，不能记通过。

| # | 自有测试失败行 | 实际失败/归因 | 责任 |
|---|---|---|---|
| 1 | cord.mender / failCommit | hasCompleteRecording true→false；ORIGIN | 底座合同 |
| 2 | cord.mender / failSettlement | 同上 | 底座合同 |
| 3 | cistern.listener / failCommit | 同上 | 底座合同 |
| 4 | cistern.listener / failSettlement | 同上 | 底座合同 |
| 5 | bone.clerk / failCommit | 同上 | 底座合同 |
| 6 | bone.clerk / failSettlement | 同上 | 底座合同 |
| 7 | salt.warden / failCommit | 同上 | 底座合同 |
| 8 | salt.warden / failSettlement | 同上 | 底座合同 |
| 9 | letter.carrier / failCommit | 同上 | 底座合同 |
| 10 | letter.carrier / failSettlement | 同上 | 底座合同 |
| 11 | persistence / N2-A01 | D6 末态缓存 D4 的 9 个 isVisible 叶不同；VISIBILITY | 底座既有缺陷 |
| 12 | combinations / 七模块全开 | load 成功，随后 world/toSnapshot 抛 Missing movement region or body outside bounds；SPATIAL | 底座既有缺陷 |

第 12 项就是九行组合的唯一失败，不另算第十三项。Vitest 会把该行名称显示为 `N2-COMBO 'combo-narrative-growth-combat-giants-…'`，定向筛选应使用未截断的前缀 `-t 'combo-narrative-growth-combat-giants'`。

| 组合行 | 结果/实际覆盖 |
|---|---|
| [] | 通过，扩展空集合 |
| narrative | 通过，五新人生命周期 |
| narrative + growth | 通过，缝绳人；默认奖励 disabled |
| narrative + combat | 通过，缝绳人 |
| narrative + giants | 通过，缝绳人 |
| narrative + crafting | 通过，缝绳人 |
| narrative + foraging | 通过，缝绳人 |
| narrative + settlement | 通过，缝绳人 |
| narrative + growth + combat + giants + crafting + foraging + settlement | 五人自然剧情/保存先完成；首次 load 后完整投影失败，后续续录/replay/seek在原候选未验到 |

## 4. 三项底座定位与最小复现

### ORIGIN：异常回滚后录制来源退役

- 根因：`src/engine/Core/Game.ts:3948–3951` 的 `advanceCommand` catch 不区分已完整回滚的扩展事务和留下原生写入的失败，均执行 `recordingFromNewGame=false`。扩展事务回滚在 `src/ext/runtime.ts:1004–1028`，`command` 在 `1388–1407` 经此事务执行。
- 旧合同：`docs/ext/phase2-narrative.md:430` 明确要求“提交阶段出现实现异常必须中止录制来源并暴露诊断”；dot 新任务要求完整录制来源也原子回滚。严格测试合理地揭示冲突，不能通过改断言、吞异常、删失败项解决。
- 独立旧底座复现：仅注册 consumer/provider 两个测试模块，不安装 narrative。provider commit 写状态/消息后抛错，或 simulationSettled 在支付后抛错；公开 `executeCommand('ext:command', claim)`。两个用例都先证明完整世界/消息/双 RNG/事件不变，再在完整录制资格断言失败。`base-probes.log`：2 项 ORIGIN 失败，旧底座 1.364s；不是从源码相同推测旧版必败。
- 当前最小入口：`npx vitest run src/ext/modules/narrative/tests/narrative2_rewards.test.ts -t 'cord.mender: failCommit' --maxWorkers=2`。
- 修复方向：只对确证完整回滚的同步事务保留来源，未知/原生部分写入、推进中止及确认取消仍失败关闭；继续抛出原异常。附 `01-recording-origin.draft.patch` 使用前后完整世界（仅去 savedAt）及输入状态比较作为保守原型。它不新增 Game 字段，也不改变共享格式；完整投影/序列化成本高，不宜未经性能验证直接落入命令热路径。正式方案宜由底座提供受控且不可伪造的完整回滚凭据，并审计完整写集、事务外预处理、原生动作及异常后的 recorder 状态。

### VISIBILITY：缓存 FOV 依赖闪光队列是否被观察清理

- 根因链：`Game.ts:11828` 的 toSnapshot 调用 `finishTransientDisplay(true)`；`12102` 的 load 丢弃闪光。`4119` 命令前也调用该函数，但 `6503` 在无闪光时直接返回，有闪光则在 `6511` 按当前玩家位置重新计算普通 FOV。`GenerationCoordinator.ts:212` 随后把原 grid 整体缓存，保留分叉的 isVisible。不是存档省字段，也不是 narrative 消耗随机数。
- 本次插桩定位：D4 从 `(4,22)` 移到 `(4,23)` 后、下层之前，live 的闪光队列为 0，FOV 清理跳过，9 格仍 true；replay 队列为 1，普通 FOV 重算后同 9 格 false。光照数值一致。记录在 `visibility-diagnostic.json`；无逐事件 toSnapshot 的探针避免清理闪光而掩盖问题。
- 完整差异恰为 `levels[3].grid[21/22/23/51/52/81/197/223/251].isVisible`，true→false；没有裁剪这些字段。`RecordingDigest.ts:267–276` 把派生可见性排除出摘要，所以 0 OOS 不证明完整快照相等。
- 旧底座复现：seed1、narrative1.4，执行交付固定路线仅删 40 条不存在的新对白，在物理事件 59/148/148/308 处作存读/回放/seek/继续。前三切点通过，D6 同样恰 9 叶失败；`base-probes.log`，36.091s。坐标、HP、turn、tick、完整双 RNG 与交付切点精确相同。
- 当前最小入口：`npx vitest run src/ext/modules/narrative/tests/narrative2_persistence.test.ts -t N2-A01 --maxWorkers=2`。
- 附 `02-cached-visibility.draft.patch`：无闪光分支也执行 `updateTransientVisibility(null,false)`，使命令/快照普通 FOV 边界一致；不记新知识、不取随机数、不删缓存字段。修复使 live 的陈旧可见性规范化，并非强制 replay 保留陈旧 true。需底座所有者继续验证所有瞬态显示、换层/坠层、无渲染/有渲染、RNG 和读取副作用守卫；如完整世界 trace 变化，先逐字段归因再按原法捕获。

### SPATIAL：恢复缓存 grid 时漏绑移动区域会话

- 根因：`WholeRunSnapshot.ts:254` 为每层新建 grid，读档验证在 `280–310` 用显式 inRegion 上下文，所以合法真档通过；`Game.ts:12199` 仅调用 `bindMovementRegionSession`，该函数 `13456–13458` 只绑定活动 grid。
- 再保存时 `WholeRunSnapshot.ts:182–185,398` 校验缓存层复合身体，经 `CreatureSpatial.ts:257–259` 查询 `MovementRegions.ts:7–12` 的 WeakMap；缓存 grid 没有 resolver，返回 false，合法角色被误判缺失区域。不应放松空间边界验证。
- 旧底座真实复现：七模块、seed2/wizard，执行交付 835 命令的物理子序列；保留正式 growth 初始命令，删新对白，不改存档身份，不注入 NPC、地图或玩家。到 D8 写出 `base-seven-save.json`（约16 MB）；load 返回 true，紧接 world/toSnapshot 抛同一异常。`base-spatial.log`：1 failed，112.15s。
- 首次自写路线探针漏传 required growth initialCommands，在 startNewGame 就报 Invalid extension creation commands；该次不是产品缺陷，已保留 `base-probes.log`，修正探针启动前提后才得到上述真实复现。
- 最小输入是上述真实 save（旧底座），或交付 `combo-narrative-growth-combat-giants-crafting-foraging-settlement-save.json`（d622bf2）；仅 createHeadlessGame→loadSnapshot→toSnapshot 即触发，不需 UI 查询/路线观察。
- 附 `03-cached-movement-regions.draft.patch`：在成功发布加载结果后，为每个缓存 grid 按其 depth 绑定当前 runtime 的区域查询。resolver 每次读 ledger，回滚后的 ledger 仍可见；不修改几何、区域内容、格式或守卫。需补真实重访、缓存复合体、区域负例、活局拒档保持和卸载/再次加载回归。

## 5. 修复草案与实测界限

三个 `.draft.patch` 均以未改共享源码为基准，可 `git apply --check`；实际只改临时工作树。附两个测试草案和两个物理路线 fixture，可在基线或候选的临时副本中原样运行：

```sh
# 仅在临时工作树展开；普通门禁不得扫描这些未注册草案。
for f in docs/ext/evidence/narrative2/*.test.ts.txt; do cp "$f" "${f%.txt}"; done
npx vitest run --config docs/ext/evidence/narrative2/sdk-regressions.draft.config.ts --maxWorkers=2
# 用完删除临时工作树；原分支保留 .txt 形式。
```

测试不是正式套件注册。本分支只保存草案，不往 src/test 或共享清单注册；底座所有者采纳时再正式登记。它们保留完整快照字段，原生部分写入仍应失去录制资格。fixture 没有 RNG/HP/位置注入；只含本次固定物理命令及 A01 切点断言。

<!-- PATCH_RESULTS -->
已完成的独立实测（原始日志均保留）：

| 副本 / 入口 | 结果 |
|---|---|
| 59b9ba6 + 三草案；旧 ORIGIN 两项 + 原 A01 探针 | 3/3 passed，49.22s（`fix-origin-a01.log`） |
| 同副本；真实旧七模块 D8 save→load→两次完整投影 | 1/1 passed，5.37s（`fix-saved.log`） |
| d622bf2 + 三草案；原五人 failCommit/failSettlement + A01 | 11/11 selected passed，67项筛选未运行，57.84s（`patched-twelve.log`；首次筛选使用完整组合名，未匹配Vitest截断名，因此没有测到第12项） |
| 同副本；原七模块组合 | 仍 exit1，173.02s，在最早 cord.mender:arrival 黄金 worldHash 断言处停止，尚未运行到 load（`patched-seven.log`） |

七模块黄金 hash 首败已作单变量定位：在同一安装包、seed2、公开物理命令、同一到达切点，只改变无闪光时的FOV规范化，原 hash `c9f033f847a2a9347aab5286a1c0d14fb296ffaadbc52456ed0789376260357f` 精确复现；新 hash 为 `4c49f44bb9309a71dc553b810e8e288b27c002c842e91b24a3a923fbc5f64dbc`。完整世界差异**仅** `levels[0].grid[124/125/238].isVisible` 的 true→false；所有其余字段相等。探针 `seven-hash-attribution.log` 1/1 passed、11.82s，逐叶记录 `seven-hash-attribution.json`。本轮没有改写 trace 或跳过哈希守卫，后续其余切点尚须底座所有者穷举归因并原法重录。

<!-- FINAL_DRAFT_RESULTS -->
随报告交付的测试草案：基线的两项世界回归均真实失败（`drafts-base.log`）；该次ORIGIN包装文件有相对导入拼接错误，未加载，不计入底座失败数。修正仅草案导入路径后，基线ORIGIN为2失败/1原生部分写入负例通过（`drafts-base-origin.log`，4.79s）。全部三补丁的旧底座副本上，同一套最终草案 **5/5 passed**，171.48s（`drafts-fixed.log`），涵盖ORIGIN两种异常、原生部分写入仍退役、A01完整世界/非单调seek、七模块缓存区域两次存读。

d622bf2 副本只应用03缓存区域补丁（撤销01/02），原七模块组合 **1/1 selected passed**、8项筛选未运行，396.62s（`spatial-only-seven.log`）。原黄金 trace、断言和门限保持，真实保存/加载、完整世界/消息/录制前缀、继续录制、逐条replay、非单调seek全部走完。它证明原组合失败行可由区域重绑单独关闭；不与原8行的通过拼成一次9/9，也不宣称三补丁一起已通过所有黄金trace。
<!-- /FINAL_DRAFT_RESULTS -->
<!-- /PATCH_RESULTS -->

原候选的 12 个失败仍然开放；临时补丁的定向成功不替代完整底座修复验收。录制策略及性能、全量集成、浏览器/真机均不在草案通过声明内。

## 6. NPC、资产、i18n 与零影响只读审查

- 从任务包标记块直接提取原始内容/编译器，运行基线输入；与 dot 的离线编译器及 definitions/portraits/locale/recruitment 四份安装 JSON 深等。精确为 8 NPC、59节点、15日志、9 flags、8 storyEvents、9 triggers；旧七类机械数组前缀和 config 不变。
- 五人分别在 D2–3、D3–4、D4–6、D6–8、D8–10 驻点；每人 9 节点、两互斥结局、两日志、唯一奖励收据、独立离开/回顾。线索旁支不阻塞主线。不是 Creature，没有新增 AI、HP、移动、战斗或招募入口。
- 两结局共用一次收据、默认 absent/disabled 如实 skipped；五个真实 growth 报价未实施。静态招募表仅作者工具/测试消费，4 候选、盐灯不招募；没有居民/岗位/跟随实现。
- 生产 TS 变更仅三处 1.4.0→1.5.0 精确版本与新增独立元数据校验器；UI 仅像素样式/布局。pack1/state4/input2 保持，display1.3.0；无共享 Game 字段、SDK 或 RNG 调用新增。关闭 narrative 时没有新增命令/故事订阅/机械状态路径；开启时新增实体/收据/身份本来就是预期变化，不能称开模块后所有实体 ID 不变。
- 新增135个 locale 键，任务包原文逐值匹配；数据与立绘引用闭合、无奖励数额硬编码、无共享 locale 改动。源码 i18n/硬编码/模块边界守卫结果见门禁。
- 旧测试前提修订仅新增五个 unresolved flags，以及 D2 由“没有新 NPC”改为精确新增 cord 实体/收据（含旧三人完整保留）。审阅 dot 原基线通过/新生产失败日志，失败仅此两类；现断言仍是完整等值，未放宽语义或增加 skip。

资产以本轮 Pillow 解码独立度量，并对照自有资产测试及深底5×联系表视觉查看：八图均 48×64、P模式、8bit、33个 PLTE 槽（透明0＋固定32色），alpha仅0/255，四角透明，无越色；只含 IHDR/PLTE/tRNS/IDAT/IEND。无文字元数据。三张旧 PNG 与 palette 与指定来源散列一致；新五张独立，轮廓、脸/手/道具可辨、整体朝右、无可见文字/火焰。没有把静态图查看当作实际浏览器渲染验收。

| 图 | 字节 | 头顶行 | 覆盖率 | 边界对比中位数 |
|---|---:|---:|---:|---:|
| archive-keeper | 1195 | 6 | 55.14% | 1.812 |
| bell-mender | 1175 | 7 | 53.32% | 1.695 |
| wick-listener | 1280 | 4 | 59.41% | 1.651 |
| cord-mender | 1111 | 7 | 45.80% | 1.611 |
| cistern-listener | 1314 | 6 | 56.15% | 1.994 |
| bone-clerk | 1250 | 6 | 56.48% | 1.611 |
| salt-warden | 1214 | 7 | 53.06% | 1.611 |
| letter-carrier | 1189 | 6 | 55.40% | 1.812 |

新五图6078 B、旧三图3650 B、全部9728 B；单图≤4 KiB，新五≤20 KiB，全套≤32 KiB，头顶极差3。纯深底和 pixelated 样式已接入；390/DPR1的1.5倍实际缩放、12行UI矩阵、横屏、图片失败、触屏/真机仍待验，不以数值资产测试关闭这些缺口。

## 7. ext/phase5 后续事项

合入前先由底座所有者解决三项共享问题、明确异常录制合同并更新旧文档；保持失败断言，完成原 12 项与九行生命周期、相关快照/录像/空间/瞬态显示守卫和录制性能验证。不能只采纳02/03而把10项ORIGIN留为“已知失败”。

底座修复后整合 narrative2，再在 ext/phase5 的真实合并结果上：

1. 重跑 boundary/types/build、narrative 全部、受影响回归、实际 drift；补完整 npm/test:ext、当前安装集合的128组合及获准真实删除布局，不能沿用5Z旧候选。
2. 按任务包补齐12行浏览器矩阵、五人三宽度/横屏、输入/保存/回放/seek、图片失败降级与真机。记录同一构建身份，未验项继续公开列出。
3. 维护者如要发XP，由growth所有者另行报价/启用story来源并升级规则身份；不在narrative里冒用旧报价或补发已skipped收据。
4. 5D3招募依然另案设计，明确静态元数据未来进入规则身份/存档的合同；本次不扩居民、岗位或跟随。
5. 合 main、发布标签或改变生成/RNG/格式时执行项目规定的CE全量档；本轮未做这些动作。

<!-- COMMIT_STATUS -->
## 8. 提交与环境限制

正常 `git add -- docs/ext/narrative2.acceptance.md docs/ext/evidence/narrative2/` 被沙箱拒绝创建 `/Users/coolking70/Documents/同步空间/BrogueJS/.git/worktrees/BrogueJS-narr2-acc/index.lock`（exit128）。因此**原工作树 HEAD 仍为 d622bf2，原分支引用未更新**；当前文件已完整写在授权文档路径中。

交付方式为可写区域的独立 Git 副本、同名 `ext/narrative2-acc` 分支，仅基于 d622bf2 提交本文及八份草案/fixture，提交末尾附用户要求的 Co-Authored-By；输出 `/private/tmp/narrative2-acceptance/narrative2-acceptance.bundle` 供导入。最终提交号见交付回执/bundle；本段不自引用提交号。所有生产修复都只以补丁文本交付，未提交任何修复源码，也未推送。临时 base/fix/candidate 工作树用后删除；原始日志、回归源码、真存档、补丁/草案和 bundle 保留在验收证据目录。此替代交付不冒称已经在原工作树完成提交。
<!-- /COMMIT_STATUS -->
