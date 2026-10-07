# 5B 本地集成报告

SDK-01…05、容器选择与窄屏抽屉已实现；crafting 最终自有17文件/729项通过，真实几何、自然 trace、32组合引擎smoke通过。完整 ext 按合同跑完并保留4100通过/6失败/1既有跳过的原始结果；六处旧前提经反事实后修订，五文件84项复核通过。完整 drift 8/8通过。浏览器像素验收受系统权限阻断，因此本报告不宣称构建后浏览器全通过。

## 1 范围与环境

基线 `ext/phase5` / `95d0d03`，foundation 9；开工只有未跟踪的本任务书。已读根 AGENTS.md、HANDOFF、development、architecture 和集成合同。使用 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` 放 PATH 首位，Node **24.19.0**，所有 Node 门禁 `NODE_OPTIONS=--max-old-space-size=3072`，Vitest **--maxWorkers=2**。未新增依赖、未改锁文件、未 commit/push。

门禁按本任务明确的开发期政策，加本地完整 ext/drift；不把本步当作 5Z，不运行主线完整 npm test、CE full/gen 或物理删除矩阵。原始日志、捕获、隔离反事实副本及脚本均在 `/private/tmp/phase5bi-evidence/`（副本在相邻 `phase5bi-*` 目录），不入仓库。

## 2 适配与真实几何

- crafting 的机械定义、版本、state schema、四个 payload v1 及规则指纹未改。只适配显示/命令边界及黄金 trace 的 foundation 派生摘要。
- 新增 `crafting_geometry.test.ts`：基线 **56ad210542433d942ba8f93c8e059e38b4ba3dbc**（5A3 迁移前，foundation 8）只安装原交付 crafting 目录；种子 51020001/42/7306，真实 D1/D2 自然节点，加公开放置的 table/hearth（材料、安静场景是显式测试布景）。不把布景称为纯公开自然 trace。
- 通过 `CRAFTING_CAPTURE_GEOMETRY=<外部路径> npx vitest run .../crafting_geometry.test.ts --maxWorkers=2` 捕获 57 个目标、330 个工作位、**130587 个逐格交互线布尔值**，连同定义指纹存成 144 KiB 的自有 `data/geometry-baseline.json`。当前树严格比较原集合/顺序/每格/指纹全部相等；没有重新生成旧基线迎合当前实现。
- seed2、normal、仅 crafting 的 **264 条公开命令**全量重放使用原 `executeTraceCommand` / `craftingFinal` 捕获方法；继续核验全部逐命令回执、库存、节点、模块历史、save/load、完整 replay、0/132/264 seek 与续录。

### 2.1 自然 trace 单变量归因

将底座生产来源回退到交付基线 `1ce8f76`（foundation 7），crafting 生产与原 trace 均保持交付版本，可精确复现原 `final`（包括原摘要）。当前 foundation 9 的改动前 HEAD 和本步候选再次分别捕获；除 `savedAt` / `recordedAt` 墙钟元数据外，**完整世界投影、输入状态、264 条录像及其所有检查点逐字段相等**。因此本步 SDK/显示改动没有新机械/RNG 差异。

| 仓内黄金字段 | 原值 | 新值 | 原因 |
| --- | --- | --- | --- |
| `natural-trace.json.final.digest` | `fa9fd43cd7071229c1321c5577a3af11721aaf99c9bad5f1473200de9a6844b4` | `2fa87af84e39ae4b0dc4abb0ae77c4cba0d9f77f6245e25f99d084765e111a51` | foundation 7→9；extensions 版本及 world5 摘要叶表变更 |

仓内只改这一叶。完整外部捕获差分共 1072 叶：2 叶墙钟元数据；manifest/foundation/version、recording/codec/foundation 各1（4）；initialDigest 的 extensions/world5/root 各1（3）；264 条事件的 checkpoint extensions/world5/root 及 chainDigest 各264（1056）；256/264 边界 fullCheckpoint 三叶各2（6）；final.digest（1）。native、actorActions、knowledge、random 域、所有 RNG 状态、库存/节点/工作历史与命令均不变。逐叶旧/新值在 `trace-leaf-diff.json`，SDK 零影响证明在 `trace-sdk-zero-impact.json`。

## 3 SDK-01…05

| 项目 | 初始复现 | 处理与回归 |
| --- | --- | --- |
| SDK-01 | `alpha.open` 被公共 useModuleUi 拒绝，colon 形式通过 | 底座接受 owner 点号/冒号两种格式；仍检查 owner、非空 suffix、重复 ID、会话退休。crafting 改用合同 `crafting.open`；公共 UI 两种格式各有回归 |
| SDK-02 | 真 SDK 无 `lastCommandError` 方法，模块 UI 无精确出口 | SDK1 可选 `lastCommandError?()`；WeakMap 会话诊断，运行时替换清空；DTO 增加 `lastError`。自身提交/确认后按有限码选择 i18n；真实 stale 及工具确认后重新 prepare 的 stale 都经真实 UI 验证。只读不推进世界/ID/RNG |
| SDK-03 | 真实箱在 WorkContext 中，原 DTO 无 containers | `ContainerRead.inReach?` 由底座距离+真实线判定；DTO 增加已知箱容量/revision/坐标/预留/资格及所选来源。只读 `readModuleView(id, displayQuery?)` 安全整数 JSON 复制冻结；制作预览随来源改变，采集目标独立可选。真实 UI 制作从箱扣料、产物入背包，采集入箱，命令带真实 CAS |
| SDK-04 | 真实 `fixture.slash` bundle 存活时 `{recorded:false,error:null}` | 空闲命令边界允许已注册世界工作输入进入录制，先返回 `C5_BUSY`，不调用 provider、不停止自动行动、不推进时钟。回归比较完整 mechanics、双方 RNG/ID 与 bundle，普通 wait 仍被锁 |
| SDK-05 | batchCount=1.5/9007199254740992 抛 Unknown extension command | 路由只按已注册 module/action 识别，不提前校验 payload；严格 commandEnvelope/模块校验仍在世界错误路径内。两值现录制一条 `C5_BAD_PAYLOAD`，完整 mechanics 不变；原0/17/MAX_SAFE_INTEGER及全部其他拒绝回归保留 |

初始路由专项 **4失败/4通过**；修复后同一选择 **8通过**。只读缺口专项在原 HEAD 副本 **2失败**，当前真实 Game 4项通过。初始复现、修复和基线副本日志分开保留；`-t` 过滤未选用例的 skipped 数不等于新增 skip。

### 3.1 自定细节与兼容边界

1. SDK版本/合同版本、foundation、whole-run5、recording4、origin2 不升号。仅增加 SDK1 可选字段/方法和可选显示参数；省略查询仍为原背包视图。`worldSdk.ts` 新 SHA-256：**297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343**，原冻结值 `e2f3cbbf06fa9afd939ec3a3a5f75193d47003a08410fd1c5d2e8899051da05f`。历史派发/报告 SHA 不追改。
2. 每次投影只预览**所选的一个材料来源**，避免按箱数放大调用。正式包 previewRecipe≤7×16=112；自定义包≤recipes.length×batchMax。读库存一次、附近自有节点各至多一次，不额外 queryContainers/queryStations。完整容器清单最多112箱，不隐藏合法箱以省预算。
3. 制作来源只影响输入，产物仍去背包；采集目标箱独立；放置仍用背包。未知/非法查询不可用，远处已知箱不可选；真实提交由底座 CAS/距离/容量作最终裁决。
4. 最后工作错误是只读会话诊断，不加入 Game 自有字段、U03 或机械摘要。当前命令确认/推进中继续禁止重入；不为报告 busy 破坏正在形成的前一条录像事件。
5. `crafting_ui` 夹具补充新 DTO 字段及真实箱来源；保留四种命令精确字段断言。额外拒绝“用背包预览向任意箱发送制作”的旧构造器用法，要求展示与提交属于同一来源。
6. 额外 i18n 守卫发现原交付面板3个不可解析调用：Map 查名称、函数返回错误键、开放 error prop。只改生产显示：名称沿实际 `nameKey` 数据字段读取，新增 `data/ui-errors.json` 的48行有限候选（13模块错误、33基础错误、2通用UI键），同时用于错误选择与显示，按模块→基础→通用顺序，不增加前缀豁免或改守卫。该表不参与机械pack/指纹；新增真实SFC回归验证精确stale、基础bad_payload及未知键安全回退。

## 4 旧 test:ext/drift 失败归因

本地初始三文件验证：phase4a0 完整图4项与旧工作几何1项直接通过；world5 clock 26项中24通过/2失败。world5 的两项旧前提错误仍可复现：把是否有 world5 等同于 `ids.includes('world5-fixture')`，遗漏 crafting 的 worldDefinitions。

反事实只在隔离 HEAD 副本移除 crafting `module.ts` 的 `worldDefinitions` 一行，其余生产/原测试不变：原 crafting-only 和五模块断言均通过（2项、6.509s）；恢复该行两项失败。最终仅将 enabled 前提改为“fixture 或任一真实模块声明 worldDefinitions”，断言、容差、用例均保留。没有让合法 crafting 隐藏世界定义。

本次完整运行还发现六项 foundation 8 迁移时漏改的旧前提（五文件），原 HEAD 隔离副本均可复现（下列2+3+1项；首两项2.675s），与本步 SDK 改动无关。分别恢复对应旧生产行为：

- `narrative_rewards` 的准备上下文白名单漏了 5A2-S 合法新增的 `stats` / `previewStats`。只在 `runtime.ts.prepareReward` 去掉这两个显示查询能力，原白名单断言通过。正式修订将合法字段纳入严格白名单，继续验证冻结、失效和零状态变化。
- `ext_causality` 的负转移夹具只把新戒指写入槽，未加入 inventory 根；S7 正式规则排除悬挂槽。只在 `NativeStatSources.ts.nativeEquippedItems` 恢复旧槽成员条件，原归属断言通过。正式修订只补戒指所有权前提，保留独立 transference 原因和 incoming origin 恢复断言。

同样遗漏还出现在两文件三项：`ext_prepared_controlled_commands` 的精确上下文白名单漏列合法 `stats`，`ext_bolt_causality` 两项反射夹具把护甲挂槽但未加入 inventory。原 HEAD 副本3失败（3.031s）；分别仅删除 `runtime.ts` 控制准备上下文的 stats getter、恢复 `NativeStatSources.ts` 旧槽成员条件，原3项均通过（2.802s，`foundation9-more-counterfactual`）。最终修订只登记合法只读能力并补真实护甲所有权，保留撤销/无变更/反射顺序/归属断言。

最终第六项 `ext_optional_rewards` 也漏列同一 reward stats/previewStats 能力：原隔离测试失败1项（1.671s），只回退 `runtime.ts.prepareReward` 该能力暴露后原1项通过（1.935s）。这五文件修订后完整定向运行 **84/84通过、14.144s**；补了 stats facade 冻结、previewStats 失效、controlled context stats getter 失效断言，未新增 skip/放宽容差。完整 ext 的原退出1仍保留，没有将84项定向复核冒称完整 ext 一次全绿。

两个独立生产前提回退一起运行 **2通过、2.554s**（其余35项由 `-t` 过滤），记录 `foundation9-premise-counterfactual`；另用转移读者旧 ringBonus 路径也得到2通过（2.336s）。原生产树继续保留新能力/S7规则，没有修改守卫以容忍额外能力或放宽因果断言。

其余旧失败及最终完整结果在下表登记；不把定向结果拼成完整门禁，不加 skip、不放宽断言、不拉长任何超时。

| 完整门禁 | exit | 结果（通过/失败/跳过） | 外层耗时 |
| --- | ---: | --- | ---: |
| `npm run test:ext -- --maxWorkers=2` | 1 | 4100/6/1；201文件通过、5失败、1跳过，共207 | 1675.428s |
| `npm run test:drift -- --maxWorkers=2` | 0 | 8/0/0；5文件全部通过 | 64.732s |
| 上述五个前提修订文件完整定向运行 | 0 | 84/0/0；5文件全部通过 | 14.144s |

完整 ext 的唯一 skipped 为既有 `ext_structure_performance` 的 `C5_PERF=1` 可选人工性能观察（默认关闭），不是本步增加的跳过。CE 缺失的 setup 提示与此单项 skipped 原因不同。crafting 自有17文件全部通过，包括几何、SDK/UI、组合和3项自然 trace；同3项 trace 在完整 drift 再通过。

| dot 原失败类别/数量 | 本地完整 ext 结果与归因（文件执行耗时取原运行 Vitest 缓存） |
| --- | --- |
| combat_combinations 超时9 | 全部16个组合通过，文件295.076s；未改原单项60秒门限 |
| ext_module_composition 超时1 | 全部组合/契约通过，文件189.501s；原单项30秒门限未改 |
| giants_colossus 超时1 | 全文件通过，74.613s；原门限未改 |
| giants_rigid 超时2 | 全文件通过，121.544s；原60秒自然场地/300秒续录门限未改 |
| giants_spine_trace 超时1（drift另1） | ext 20.653s、drift 20.495s，原60秒门限；原黄金严格一致 |
| giants_zones_natural 超时1 | 原自然闭环通过，127.203s，原门限未改 |
| giants_composite_natural 外部写入失败5 | 全文件通过，509.338s；原 `/private/tmp` 路径可写，未改生产/测试路径或相关断言 |
| phase4a1_game_perf / pathing_perf 外部写入各1 | 各自通过，2.179s / 0.171s，原证据文件成功产生 |
| phase4d_playable_recording 外部写入1 | 通过，0.797s，原证据文件成功产生 |
| ext_world_work_boundaries D15写入1 | 全文件通过，14.819s；原D15机械断言与证据写入均执行 |
| phase4a0 完整图散列4 | empty/growth/narrative/growth+narrative原严格对照通过，20.795s。5A3已按原方法归因/重录共享图基线（见 `phase5a3.report.md` §3/附录C）；本步未改该基线 |
| world5 旧前提2 | 反事实及最小 enabled 修订见上；完整26项通过，31.371s |

额外逐用例 JSON 计时（`original-timeouts-local-cases.data.json`，原完整 ext 缓存另存 `ext-cache.data.json`）覆盖原超时所在六文件全部82项：combat16项最大31.684s（60s）；实际模块组合32项最大6.189s（30s）；colossus自然保存/逐检查点回放43.113s（120s）；rigid自然场地23.316s（60s）、自然续录96.083s（300s）；spine21.139s（60s）；zones153.834s（240s）。其余同文件用例也通过。该计时与相关守卫合并运行18文件/168项，exit1、167通过/1失败（543.580s）：唯一失败是上列i18n生产调用，修复后相关七文件复核通过。所有原超时文件与U03/UR2/3/4/u27/x2a/x3b/续录文件在该命令中通过；不隐去这次失败退出码。

15个原超时在本地完整运行中均未复现。当前硬件/运行时与交付环境不同，foundation 8/9也已做属性/结构/摘要性能改进，因此只归为“当前原门限通过，旧慢环境/旧底座性能边界未复现”，不声称上述耗时是仅切换操作系统的因果实验。逐项定向耗时补证见最终检查；它不替代完整 ext 的原始结果。

组合引擎 smoke：`node scripts/check-module-composition-smoke.mjs --output /private/tmp/phase5bi-evidence/composition-full.data.json --engine-only`，exit0、342.358s，**32/32组合**及含crafting的**16/16子集**均通过。每行精确检查点、save/load、逐事件 replay、seek、续录和缺模块输入拒绝全部为true；giants行还经原自然公开路线到D3并验证真实自然贡献出生（combat行按原脚本使用公开wizard模式）。报告 `requestedScopePassed=true`、`engine.status=passed`；`browser.status=not-run`、`passed=false`原样保留，不把engine-only当作浏览器通过。Vite中间件记录24678 WebSocket监听EPERM警告，但SSR真实Game流程和32行全部执行完成，无监听成功或权限变更。

## 5 界面与验证边界

窄屏底部抽屉从48dvh减为 `min(36dvh,320px)`，地图所在 shell 相应保留其余视口；header 新增收起/展开，收起52px并隐藏其余面板内容、恢复地图空间。正文独立滚动，取消/确认仍在固定 footer。桌面370px侧栏规则保留。新增箱选择器使用模块 i18n；SFC回归覆盖四tab、七配方、选择器、收起/展开、只读/历史帧/生命周期/连点/确认锁。

**浏览器像素验收 blocked**：已构建候选上 `npm run preview -- --host 127.0.0.1 --port 5416` 与24行构建浏览器矩阵脚本均在绑定127.0.0.1时被沙箱拒绝，`listen EPERM`，没有启动服务器/矩阵、没有截图，不能报告390/320的实测地图高度。另经提供的 CUA 工具查可用表面，browser列表为空，没有可绑定的已有候选预览。没有提升权限、修改网络隔离或借旧 dist 冒充候选。矩阵脚本、拒绝日志在外部证据目录；真实设备未验证。补尝试不监听端口的静态产物 route-fulfill 方案（`browser-offline.mjs`）：Playwright 默认 Chromium 在页面加载前因 macOS `bootstrap_check_in ... MachPortRendezvousServer: Permission denied (1100)` 退出（0.507s）；没有更改浏览器安全参数或系统策略。上述启动尝试发生于最终i18n修正前的候选；修正后已重新 build，但操作系统阻断未解除，最终产品没有像素验收。

## 6 最终检查与交付

| 最终检查命令（全部继承§1环境） | exit | 结果 | 外层耗时 |
| --- | ---: | --- | ---: |
| `npx vitest run src/ext/modules/crafting/tests --maxWorkers=2` | 0 | 17文件、729/729，无跳过；含全部SDK回归、真实几何、3项trace | 76.964s |
| `npx vitest run <I7> --maxWorkers=2` | 0 | 7文件、316/316，无跳过 | 7.457s |
| `npx vitest run src/test/c_4a_terrain_catalog.test.ts --maxWorkers=2 -t '生产读者只出现在白名单文件'` | 0 | 源码守卫1通过，29项由过滤未选 | 2.531s |
| `node scripts/check-module-boundaries.mjs` | 0 | 模块边界/测试归属通过 | 2.215s |
| `npm run build` | 0 | 最终树vue-tsc + Vite构建通过，1208模块；原有大chunk提示 | 11.836s |
| `git diff --check` | 0 | 通过 | — |

`I7`精确文件：`src/test/{p1_30_i18n_gate,u24_hardcoded_text,repo_hygiene,test_suite_membership,ext_module_ui}.test.ts` 与 `src/ext/modules/crafting/tests/{crafting_ui,crafting_sdk_integration}.test.ts`。i18n修复首轮315通过（7.710s），增加SFC错误显示回归后的最终轮316通过（7.457s）。

`related-and-timeouts`原命令：`npx vitest run <R18> --maxWorkers=2 --reporter=default --reporter=json --outputFile=/private/tmp/phase5bi-evidence/related-and-timeouts.data.json`。`R18`为 `src/test/{repo_hygiene,test_suite_membership,u24_hardcoded_text,p1_30_i18n_gate,u_03_whole_run_snapshot,u_27_recording,x2a_recording_checkpoint,x3b_display_recording,u_r2_trace,u_r3_trace,u_r4_trace,ux_1d_recording_continuation,ext_module_composition}.test.ts`（13文件），加 `src/ext/modules/combat/tests/combat_combinations.test.ts` 和 `src/ext/modules/giants/tests/{giants_colossus,giants_rigid,giants_spine_trace,giants_zones_natural}.test.ts`（5文件）。原167/1、exit1完整保留；唯一i18n问题的生产修正与最终绿色复核见§3.1/上表，没有重复跑无关长测来拼造完整ext绿灯。

源树审计：完整 ext 开始/结束 `src/scripts/public`及根配置的1087文件SHA逐字相同（`inputs-before.json` / `inputs-ext-after.json`）。之后先只修五个旧前提测试；额外守卫之后再改两份crafting显示生产文件、新增显示错误键表及一项SFC测试。底座生产/机械定义/黄金trace自完整ext开始后一直未再改。最终729项自有测试在包含i18n修正的树上完成；组合smoke和完整drift执行于该纯显示修正前，之后3项trace/几何/SDK全部在最终自有轮再次通过。

没有新增Game字段，`u03-state-contract.json`未动；SDK SHA复核为§3.1的新值。foundation9、whole-run5、recording4、origin2、crafting1.0.0、payload v1、机械pack/指纹保持。`natural-trace.json`仓内只改变`final.digest`一叶，已经按原捕获方法和单变量归因逐叶登记。最终source/delivery文件审计与哈希在外部证据目录；没有CRLF、截图或>1MiB原始证据入仓库。用户任务书保留原文件；HEAD仍为`95d0d0327654d149e41609e17708ee971d8db5c1`，未commit/push。

**剩余真实阻断仅浏览器像素验收**（§5）：390/320、桌面、normal/immersive及四地图的24行矩阵没有执行到页面；不能宣称像素高度、截图或构建浏览器组合通过。代码实现与可执行门禁已完成，报告同时保留完整ext/额外守卫的失败原结果及修复复核。
