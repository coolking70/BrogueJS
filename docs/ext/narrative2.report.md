# narrative2 第二批中立驻点 NPC 报告

## 1. 结论

**部分完成。** 五名新人按固定内容/装配器追加，45节点、10结局日志、两分支、回顾及静态招募预留已实现；五人自然A/B与所选存读/回放闭环开发实测通过，固定八张像素资产数值与视觉通过。严格测试保留三个冻结共享底座问题：异常提交的完整录制来源、seed1跨层可见性完整状态、七全开缓存移动区域恢复。浏览器矩阵受连接与能力限制未执行，不能宣称总体验收通过。默认可选奖励为absent/disabled的skipped，不宣称收到XP；无growth新报价、金币/物品provider或5D3实现。最终候选门禁另列§7。

## 2. 基线与环境

- 代码基线：`59b9ba691daf66819eeea0299a0539f3641ad208`。
- 实际派发tip：`0bb902bca2a9573005405b3c2fd1437e4b00a5a5`；`git fetch origin`后创建全新隔离worktree/分支`ext/narrative2`，开工`git status --porcelain`为空。
- `git diff --name-only 59b9ba691daf66819eeea0299a0539f3641ad208 HEAD`开工仅列任务包；没有reset、覆盖旧工作树、merge/rebase/tag。
- 实际Node：`/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node` = `v24.19.0`，PATH最前；`NODE_OPTIONS=--max-old-space-size=3072`，Vitest最多2workers，重型Game测试排他执行。
- Python3.12.14、Pillow12.3.0、numpy2.3.5用于离线资产流程；不改根依赖。
- 云工作树：`/workspace/scratch/db2caf941a8f/BrogueJS-narrative2`；原始证据：同级`narrative2-evidence/`。这些绝对路径只在本执行环境可读，下面同时保留可复制入口与重建说明。
- 最终提交由本文所在分支`git rev-parse HEAD`获得；提交前候选树/发布结果在最终回执记录。

## 3. 写入与版本

只允许`src/ext/modules/narrative/**`、本报告及`docs/ext/narrative-config.md`。共享文件、其他模块、任务包、根依赖/脚本及冻结SDK不改。仓外`a01-shared-byte-comparison.json`对照59b9归档与候选，1217个非narrative共享src文件逐字节一致；`a01-tree-identities.json`固定相关源文件SHA。此为源码范围证据，不替代生命周期实测。

<!-- narrative2-scope-start -->

相对派发tip的显式变更清单/numstat（含未跟踪新增文件，二进制以`—`计）：

| 路径 | 新增行 | 删除行 |
|---|---:|---:|
| `docs/ext/narrative-config.md` | 65 | 6 |
| `docs/ext/narrative2.report.md` | 426 | 0 |
| `src/ext/modules/narrative/assets/portraits/archive-keeper.png` | — | — |
| `src/ext/modules/narrative/assets/portraits/bell-mender.png` | — | — |
| `src/ext/modules/narrative/assets/portraits/bone-clerk.png` | — | — |
| `src/ext/modules/narrative/assets/portraits/cistern-listener.png` | — | — |
| `src/ext/modules/narrative/assets/portraits/cord-mender.png` | — | — |
| `src/ext/modules/narrative/assets/portraits/letter-carrier.png` | — | — |
| `src/ext/modules/narrative/assets/portraits/palette.json` | 34 | 0 |
| `src/ext/modules/narrative/assets/portraits/salt-warden.png` | — | — |
| `src/ext/modules/narrative/assets/portraits/wick-listener.png` | — | — |
| `src/ext/modules/narrative/data/definitions.json` | 2089 | 109 |
| `src/ext/modules/narrative/data/narrative2-combo-empty.trace.json` | 59 | 0 |
| `src/ext/modules/narrative/data/narrative2-combo-narrative-combat.trace.json` | 662 | 0 |
| `src/ext/modules/narrative/data/narrative2-combo-narrative-crafting.trace.json` | 662 | 0 |
| `src/ext/modules/narrative/data/narrative2-combo-narrative-foraging.trace.json` | 662 | 0 |
| `src/ext/modules/narrative/data/narrative2-combo-narrative-giants.trace.json` | 662 | 0 |
| `src/ext/modules/narrative/data/narrative2-combo-narrative-growth-combat-giants-crafting-foraging-settlement.trace.json` | 7031 | 0 |
| `src/ext/modules/narrative/data/narrative2-combo-narrative-growth.trace.json` | 667 | 0 |
| `src/ext/modules/narrative/data/narrative2-combo-narrative-settlement.trace.json` | 638 | 0 |
| `src/ext/modules/narrative/data/narrative2-combo-narrative.trace.json` | 4638 | 0 |
| `src/ext/modules/narrative/data/narrative2-cord-normal.trace.json` | 657 | 0 |
| `src/ext/modules/narrative/data/narrative2-five-wizard.trace.json` | 4638 | 0 |
| `src/ext/modules/narrative/data/narrative2-old14.trace.json` | 114 | 0 |
| `src/ext/modules/narrative/data/portraits.json` | 57 | 7 |
| `src/ext/modules/narrative/data/recruitment.json` | 51 | 0 |
| `src/ext/modules/narrative/definitions.ts` | 1 | 1 |
| `src/ext/modules/narrative/locales/zh_CN.json` | 136 | 1 |
| `src/ext/modules/narrative/recruitment.ts` | 71 | 0 |
| `src/ext/modules/narrative/schema.ts` | 1 | 1 |
| `src/ext/modules/narrative/test-suites.json` | 15 | 2 |
| `src/ext/modules/narrative/tests/narrative2_combinations.test.ts` | 201 | 0 |
| `src/ext/modules/narrative/tests/narrative2_data.test.ts` | 137 | 0 |
| `src/ext/modules/narrative/tests/narrative2_graph.test.ts` | 130 | 0 |
| `src/ext/modules/narrative/tests/narrative2_imports.test.ts` | 190 | 0 |
| `src/ext/modules/narrative/tests/narrative2_metadata.test.ts` | 208 | 0 |
| `src/ext/modules/narrative/tests/narrative2_naturalFixture.ts` | 518 | 0 |
| `src/ext/modules/narrative/tests/narrative2_persistence.test.ts` | 362 | 0 |
| `src/ext/modules/narrative/tests/narrative2_rewardFixture.ts` | 180 | 0 |
| `src/ext/modules/narrative/tests/narrative2_rewards.test.ts` | 144 | 0 |
| `src/ext/modules/narrative/tests/narrative2_runtime.test.ts` | 111 | 0 |
| `src/ext/modules/narrative/tests/narrative2_trace.test.ts` | 60 | 0 |
| `src/ext/modules/narrative/tests/narrative2_ui.test.ts` | 159 | 0 |
| `src/ext/modules/narrative/tests/narrative2_uiFixture.ts` | 42 | 0 |
| `src/ext/modules/narrative/tests/narrative2_world.test.ts` | 103 | 0 |
| `src/ext/modules/narrative/tests/narrative_content.test.ts` | 6 | 2 |
| `src/ext/modules/narrative/tests/narrative_portrait_pixels.test.ts` | 173 | 0 |
| `src/ext/modules/narrative/tests/narrative_runtime.test.ts` | 20 | 8 |
| `src/ext/modules/narrative/tools/compile_narrative2.mjs` | 80 | 0 |
| `src/ext/modules/narrative/tools/pixelize_portraits.py` | 294 | 0 |
| `src/ext/modules/narrative/types.ts` | 1 | 1 |
| `src/ext/modules/narrative/ui/NarrativeDialogue.vue` | 1 | 1 |
| `src/ext/modules/narrative/ui/NarrativePortrait.vue` | 2 | 2 |

合计53个文件，文本+27158/−141；提交后可用`git diff --stat 0bb902bca2a9573005405b3c2fd1437e4b00a5a5 HEAD`复核。无白名单外路径。

<!-- narrative2-scope-end -->

module/rules=1.5.0，displayVersion=1.3.0；pack schema1/state4/input2保持。foundation13/whole-run6/recording4/origin2/world5 schema4及所有共享协议保持。完整机械指纹为`sha256:c22c646d3b86ee57ab3d36069992e317bf355f8d105bacc92114a67176f04beb`，正式加载器/descriptor/工厂一致；locale、像素、静态招募表不进机械指纹。

来源脚本原SHA-256为`1a57b64bc2912fa6bd05142df28ec21988825e558484266e431897a739f08e5c`，原资产测试为`e9aecee179ec522cae8ec33f01dd65aa17d68c2268f18c56e3483a1d8756bf95`；三个PNG和palette的源/现散列见§10。

固定美术来源：`93523fc596b173396a0d526ab2073b327ff7cf3e`，仅任务包§5.1六文件逐个git show择取，未合入loot分支。原三PNG与palette字节保持；脚本/资产测试在模块内扩展。

## 4. 内容表

| 人物 / ID | 深度 | A/B | rewardId |
|---|---|---|---|
| 缝绳人 / cord.mender | 2–3 | splice / sever | cord.settled |
| 听水员 / cistern.listener | 3–4 | mark / erase | cistern.settled |
| 拾骨书记 / bone.clerk | 4–6 | blank / number | bone.settled |
| 盐灯看守 / salt.warden | 6–8 | share / keep | salt.settled |
| 末班递信人 / letter.carrier | 8–10 | return / wait | letter.settled |

每人九节点hello/account/detail/clue/decision/a/b/recall-a/recall-b；独立双结局、恒真无效果leave出口，detail/clue返回不执行结局。每人两日志`${npcId}.${verdict}.note`、一次收据`${npcId}.reward.receipt`。五人均固定可穿行交互对象，不是Creature。

新增135个locale键；每名9节点/19选项。全部新文案为`ext.narrative.n2.<npcId>.*`字面键，来自任务包原文，没有自主剧情/数值/人称修订。精确计数8 NPC/8对话/59节点/15日志/9 flags/8 storyEvents/9 triggers；旧七类机械数组前缀与预算保持。独立主线无需先遇到旧人或其他新人。没有修订任务包错字或人称。

五名的驻点ID均为`${npcId}.first`，每局/每层上限1、楼梯最小距离1、入口最大距离8、无位defer。全部135个新locale键可精确展开为：前缀`ext.narrative.n2.<npcId>.`，对上述五个ID分别追加`settled,later,name,description,choice.ask,choice.recall,text.hello,choice.detail,choice.clue,clueLocked,choice.consider,text.account,choice.back,text.detail,text.clue,choice.a,choice.b,text.decision,text.a,text.b,text.recall-a,text.recall-b,portrait`，再追加该行A/B各自的`journal.<verdict>.title`和`journal.<verdict>.body`。27键×5，无未列出的新命名空间。

## 5. 招募预留

五行独立schema1/targetPhase=5D3：cord/splice、cistern/mark、bone/blank、letter/return是四个候选；salt不可招募且eligibility=null。`recruitment.ts`只供内容工具和测试严格校验、克隆深冻结，生产入口不消费。无居民、岗位、跟随、成本或招募按钮，未来消费须另定跨模块DTO与规则身份。

## 6. 奖励

生产缺席absent、默认growth关闭disabled、有provider无报价unsupported-key均skipped；当次故事/日志落地，以后不补发。测试自有provider按每项5兑现的applied和失败原子性另列实测，不能称真实growth新报价已实施。两结局共享同一NPC的一次收据，不同NPC五种rewardId独立。

开发真实Game奖励矩阵：五人各自absent/disabled/unsupported-key/applied四路、每路A/B两结局及重复点击，全部通过；其中absent使用生产narrative-only，disabled使用生产growth默认配置；unsupported-key和applied使用自有事务provider。applied每项5支付，重复支付0。各路的真实存档续录、逐条回放和非单调seek通过。prepare失败原子性通过。五人commit异常与结算异常共10项：完整世界、玩家、模块、双RNG、消息、事件前缀、游标回滚断言先通过，但完整录制来源被底座退役，故严格测试保留失败，见§12。不能把这10项称整体原子性通过；其后的异常恢复重试断言尚未到达，也不记为通过。

## 7. 测试与门禁

开发与最终候选分开；日志保留每次原始exit，不以复跑覆盖首败。不运行完整npm/test:ext/128组合/实际删除/CE或全项目性能。

规范机械快照保留完整世界、缓存层、玩家、双RNG、时钟、模块状态、实体与收据；仅排除savedAt/recordedAt等非机械时间。若分离logger/recordingOrigin，则另比真实消息与合法完整录制前后缀。逐项最终结果如下；共享缺陷失败没有改为expected-failure。

| 包内编号 | 本次自有入口 |
|---|---|
| N2-DATA | narrative2_data.test.ts |
| N2-META | narrative2_metadata.test.ts |
| N2-GRAPH | narrative2_graph.test.ts；真实Game补narrative2_runtime.test.ts |
| N2-REWARD | narrative2_rewards.test.ts |
| N2-WORLD | narrative2_world.test.ts诊断边界；narrative2_trace.test.ts/narrative2_naturalFixture.ts真实生产放置 |
| N2-PERSIST / N2-A01 | narrative2_persistence.test.ts |
| N2-UI | narrative2_ui.test.ts；浏览器另见§11 |
| N2-PIXEL | narrative_portrait_pixels.test.ts |
| N2-IMPORT | narrative2_imports.test.ts |
| N2-COMBO | narrative2_combinations.test.ts |
| N2-TRACE | narrative2_trace.test.ts，登记drift |

所有路径在`src/ext/modules/narrative/tests/`。包内建议文件名与这里META/GRAPH/WORLD名称不同，语义覆盖分别登记，没有另设平行测试入口。

开发已完成：

| 阶段/证据 | exit / 结果 | 耗时 |
|---|---|---|
| M1四份data/metadata/graph/imports | 首次exit1：15项诊断fixture的revision0前提错误及清单登记竞态；修复只在新测试夹具/自有清单 | 首次日志保留 |
| M1四份纯测试复跑 `m1-data-rerun.log` | exit0，4文件71 passed，0 failed/skip/todo | 1.60s |
| M1最终纯测试 `m1-data-complete.log` | exit0，4文件72 passed，0 failed/skip/todo；增加原加载器非法新内容探针 | 1.77s |
| `n2-metadata-imports-followup.log` | exit0，2文件47 passed/0 failed/skip/todo；补真实Game元数据独立性、四个缺键负例与共享字段/协议声明守卫 | 12.13s |
| `m1-assembly-audit.log` | exit0：从文档提取原始编译器/内容，与带防重复工具及四份安装JSON深等；基线输入不变 | 作者静态交叉核对 |
| `counterfactual-old-content-baseline.log` | exit0，2 passed/12筛选未运行 | 26.43s |
| `counterfactual-old-runtime-baseline.log` | exit0，1 passed/13筛选未运行 | 9.23s |
| 新生产原断言 `counterfactual-new-content-first.log` | exit1，2 failed/12筛选未运行，仅新增五flags | 9.80s |
| 新生产原断言 `counterfactual-new-runtime-first.log` | exit1，1 failed/13筛选未运行，仅D2新增NPC | 7.67s |
| `counterfactual-repaired.log` / `m1-world.log` | 两次exit1，新增trace/persistence文件与清单登记竞态，测试未启动 | 原日志保留 |
| `m1-world-counterfactual-rerun.log` | exit0，3文件19 passed/25筛选未运行，含16新world诊断 | 26.25s |
| `m1-boundary.log` | exit0，模块边界与测试归属 | 9s |
| `m1-types.first.log` | exit2，8处新测试类型/ES目标问题（replaceAll/at/类型品牌），无生产错误 | 首次保留 |
| `m1-types.rerun.log` | exit0，精确修正新测试，无配置/目标放宽 | 类型检查 |
| `m2-development-build.first.log` | exit0，1302模块；已有chunk-size警告 | Vite12.39s |
| `m2-direct-world-optional.log` | exit0，3文件30 passed/0 failed/skip/todo，真实world/optional底座受影响回归 | 8.19s |
| `m2-boundary-current` / `m2-types-current` / `m2-build-current` | 开发补充均exit0；元数据补充与更强replay观察类型通过；index SHA保持354a8402…177a0 | 8s / 34s / 49s（Vite13.43s） |
| `art/pixel-tests.log` | exit0，1文件11 passed，0 failed/skip/todo | 506ms |
| `n2-ui-runtime-rewards.first.log/.status` | 首次exit1，64项中2 passed/62 failed；新观察夹具在save补全checkpoint之前克隆事件，导致自身前后不等；仅调整观察顺序，完整字段不减 | 140.28s |
| `n2-ui-runtime-rewards.focused.log` | exit1，15定向项中13 passed/2 failed，49筛选未运行；仅cord提交/结算异常的录制来源状态冲突 | 137.71s |
| `n2-ui-runtime-rewards.rerun.log/.status` | exit1，64项54 passed/10 failed/0 skip/todo；runtime10/10、UI8/8、reward36/46；十项均为五人的commit/结算异常录制来源冲突 | 615.74s |
| `n2-persistence-first.log` | 更强观察后exit1，23项22 passed/1 failed/0 skip/todo，仅保留seed1 N2-A01；所选五人A/B与所有持久切点通过 | 769.42s |

筛选未运行数来自定向`-t`，没有在源码添加skip/todo，不作完整套件通过数。

上述runtime/reward 54/64是无副作用replay观察改进之前的历史结果；发现N2-A01观察掩盖后，runtime/reward/persistence/combinations逐事件观察统一改用公开只读RNG/runtime/turn。没有变更生产代码或削减端点断言；最终候选必须用此更强预言重跑，以收尾结果为准，不能沿用旧通过数。

### 最终冻结候选门禁

最终生产/测试候选与R1源文件完全一致，79个源文件散列清单SHA-256为`25d73299e8304872af958f81e9e77def6e4378aec234d1750ec28f452b856188`；之后仅完善本报告。以下是独立于开发轮次的首次收尾执行，不覆盖历史日志。每条精确命令、完整输出、退出码、墙钟秒数均保存在仓外`final-<gate>.command/.log/.exit/.seconds`，汇总`final-gates.tsv`；整个序列由`run-final-gates.sh`记录。Vitest时长与命令墙钟分别列明。

| 最终命令 | exit / 数量 | 时长 |
|---|---|---|
| `node scripts/check-module-boundaries.mjs` | 0 | 8s |
| `npx vue-tsc -b` | 0 | 34s |
| `npm run build` | 0；index SHA与§11一致，已有chunk-size警告 | 46s，Vite11.15s |
| `npx vitest run src/ext/modules/narrative/tests --maxWorkers=2` | 1；22文件，19 passed/3 failed；416项404 passed/12 failed/0 skip/todo | Vitest1655.07s / 墙钟1656s |
| 下列9份直接受影响回归，`npx vitest run … --maxWorkers=2` | 0；9文件105 passed/0 failed/skip/todo | Vitest81.37s / 墙钟83s |
| `npx vitest run src/test/dialog_host.test.ts src/test/dialog_service_input.test.ts --maxWorkers=2` | 0；2文件84 passed/0 failed/skip/todo | Vitest59.96s / 墙钟60s |
| `npm run test:drift -- --maxWorkers=2` | 0；8文件16 passed/0 failed/skip/todo，包含实际root与自有登记drift | Vitest274.35s / 墙钟276s |
| §9精确`check-module-removal.mjs --plan`命令 | 0；恰一行removed=narrative、retained六模块；不实际删除 | <1s |
| `git diff --check` | 0 | <1s |

整个最终序列首跑exit1，仅来自自有12项已保留失败；没有将总体结果标成绿灯。最终报告文字完成后另做只读范围与`git diff --check`复核，不重复重型测试。

9份直接受影响入口全部为`src/test/`下：`ext_world_interactables.test.ts`、`ext_optional_queries.test.ts`、`ext_optional_rewards.test.ts`、`ext_generation_checkpoint_differential.test.ts`、`ext_module_boundaries.test.ts`、`p1_30_i18n_gate.test.ts`、`u24_hardcoded_text.test.ts`、`repo_hygiene.test.ts`、`test_suite_membership.test.ts`。未扩大为完整测试目录。

最终自有12失败恰为已知三个原因：persistence22/23（825.757s，仅A01）；rewards36/46（645.013s，五人各commit/settlement异常）；combinations8/9（586.831s，仅七全开缓存region恢复）。其余19文件通过，未出现新增失败类别。测试启动提示CE reference缺失属于全局setup提示，本次已执行自有/受影响/UI集合的结果均0 skipped，未获取CE。

## 8. 自然与持久

真实生产包、公开commands、有界BFS读全图规划并非玩家探索策略；禁止传送、改HP/营养/RNG、注入NPC或修改生成。wizard用于深层覆盖，不作normal平衡结论。路线失败与持久断言失败分开记录，不换seed掩盖save/replay/seek缺陷。


实际自然采集第三次运行`trace-capture-local-progress.log` exit0，2 passed/0 failed/skip/todo，293.89s。前两次探索使用全图环境/怪物变化判定进展，会被远处活动不断重置停滞；主动中断两次exit130均保留。修正为单条命令前后玩家/深度/局部3×3地形/背包进展，或实际相邻攻击目标HP减少；不以远处游走/回血算路线进展。

五人主线：wizard seed2，490条路线命令+50条对话=540事件，真实录像529446 B。seed1在D7(13,13)触发64连续无有效进展而终止（729路线命令/769事件），随后seed2成功；未扩到65–256，完整搜索见`five-wizard-search.json`。这是路线失败，不是持久失败。

| NPC | seed / 深度 | 实体ID / instanceKey | 到达事件索引 / turn / tick | A / 奖励 |
|---|---|---|---|---|
| cord.mender | 2 / D2 | 44 / cord.mender.first.slot.1 | 56 / 55 / 5500 | 完成 / skipped absent |
| cistern.listener | 2 / D3 | 57 / cistern.listener.first.slot.1 | 118 / 107 / 10600 | 完成 / skipped absent |
| bone.clerk | 2 / D4 | 70 / bone.clerk.first.slot.1 | 183 / 162 / 16000 | 完成 / skipped absent |
| salt.warden | 2 / D6 | 107 / salt.warden.first.slot.1 | 354 / 324 / 31900 | 完成 / skipped absent |
| letter.carrier | 2 / D8 | 174 / letter.carrier.first.slot.1 | 530 / 489 / 48300 | 完成 / skipped absent |

normal补充：seed1，缝绳人D2首次成功，69事件、录像69120 B；完整搜索`cord-normal-search.json`。没有将wizard生存能力计作normal平衡。

可复制自然固定回归：`npx vitest run src/ext/modules/narrative/tests/narrative2_trace.test.ts --maxWorkers=2`；常规仅重建已选seed与真实commands，不重新搜索。首次重新采集才设`BROGUE_CAPTURE_NARRATIVE2_TRACE=1`及`NARRATIVE2_EVIDENCE=<仓外目录>`。完整录像/真实save为`five-wizard-{recording,save}.json`与`cord-normal-{recording,save}.json`，五人arrival/open/decision另有15份真实save。重建不需要仓外路径：模块data/narrative2-five-wizard.trace.json、narrative2-cord-normal.trace.json保存seed/modules/mode/真实action/data/decisions与完整状态/消息摘要；最终固定重建同时再检查真实NPC几何。

固定seed/commands回归在补足几何预言后再次实测：2/2 passed，exit0，86.42s，0 skip/todo；逐人重查owner/content/depth/instance、真实绑定与收据、可见安全FLOOR、非Creature ID、楼梯/实际入口距离，没有重采trace。

后续使用无副作用逐事件观察的完整持久门禁已实测：`n2-persistence-first.log` exit1，23项22 passed/1 failed，0 skip/todo，769.42s。所选seed2五人均通过arrival/open/decision/ending/close/recall的真实save继续、完整回放、末→0→结局前→open→结局后→回顾→末的非单调seek，以及各自真实decision档B分支与跨层重访。真实新局0存档继续完整540命令、旧1.4/篡改/缺模块输入拒绝且现存局不退休也通过；真实仓外旧save由`NARRATIVE2_OLD_SAVE`显式提供。唯一失败为独立保留的seed1 N2-A01，见§12；所有回放0 OOS，不能因此忽略其完整末态不等。

五份B结局真实录像仓外：`cord.mender-ending-b-recording.json`66330 B、`cistern.listener-ending-b-recording.json`127305 B、`bone.clerk-ending-b-recording.json`191257 B、`salt.warden-ending-b-recording.json`358049 B、`letter.carrier-ending-b-recording.json`529446 B。它们从真实decision存档继续公开B/关闭/回顾命令，未编辑录像或存档；各自完整回放已由上述通过用例验证。

开工前真实旧1.4输入已在独立基线副本捕获：`narrative2-evidence/old14-save.json`及`old14-recording.json`。可加载当前真实save为`five-wizard-save.json`15924341 B及`cord-normal-save.json`3933740 B，不是诊断world投影；字节/SHA清单为`narrative2-natural-artifacts.json`，逐人持久结果为`narrative2-persistence-matrix.json`。原旧save约1.97MB留仓外，不压缩伪装小型trace提交。重建采用基线git archive、同Node/依赖，经真实startNewGame和公开命令导出。

## 9. 组合和删除计划

开发九组合实际exit1，8 passed/1 failed，0 skip/todo，1272.86s；最终固定trace复跑同样8 passed/1 failed，586.831s。普通回归只读取九个固定命令fixture，不重新搜索。

| 组合 | seed | 新人深度 | 捕获→续录事件数 | 实际录像字节 | 结果 |
|---|---:|---|---|---:|---|
| 空集 | 1 | 无NPC | 1→3 | 4291 | 全闭环通过；0 OOS |
| narrative | 2 | 2/3/4/6/8 | 540→542 | 531360 | 全闭环通过；0 OOS |
| narrative+growth | 1 | 2 | 70→72 | 72296 | 全闭环通过；0 OOS |
| narrative+combat | 1 | 2 | 69→71 | 71262 | 全闭环通过；0 OOS |
| narrative+giants | 1 | 2 | 69→71 | 71248 | 全闭环通过；0 OOS |
| narrative+crafting | 1 | 2 | 69→71 | 71255 | 全闭环通过；0 OOS |
| narrative+foraging | 1 | 2 | 69→71 | 71255 | 全闭环通过；0 OOS |
| narrative+settlement | 1 | 2 | 66→68 | 68382 | 全闭环通过；0 OOS |
| narrative+growth+combat+giants+crafting+foraging+settlement | 2 | 2/4/4/6/8 | 835→未到达 | 817123 | load返回true后snapshot抛异常；后续未执行 |

前八行均完成实际play→save/load→正常继续→完整replay→seek0/中/末→续录存档再载入。空集先真实wait再存档，保留原始0边界；growth相关行保留真实初始创建命令，不删除index0事件。growth默认奖励disabled；其余含narrative行absent。所有含narrative行自然完成至少一新人，单独与七全开实际遇齐五人；对话前后其他模块状态、玩家、双RNG不变，settlement无居民/招募效果。

七全开有界搜索：seed1在D7(7,13)、775路线命令/816事件/HP1001处64次无进展，按路线失败停止；seed2真实完成五人，784路线+50对白+1成长初始命令=835事件。其可加载原始save为16357281 B，完整录制817123 B；首次load返回true且hasCompleteRecording=true，但随后的完整world投影抛SpatialValidationError。因此该行完整存读相等、消息/前缀、继续移动、replay/seek/续录后载入均未达，不算0 OOS通过，见§12。没有将这个持久失败换seed重试。

完整逐行原始输入/命令/散列/未达阶段见`narrative2-combinations-matrix.json`，各`combo-*-continued-{save,recording}.json`是前八行实际续录真值。七全开只提供真实捕获的`combo-narrative-growth-combat-giants-crafting-foraging-settlement-{save,recording}.json`，无伪造continued文件。重建命令：`npx vitest run src/ext/modules/narrative/tests/narrative2_combinations.test.ts --maxWorkers=2`；首次采集才加`BROGUE_CAPTURE_NARRATIVE2_COMBOS=1`和新的仓外`NARRATIVE2_EVIDENCE`。

唯一允许删除步骤：`node scripts/check-module-removal.mjs --plan --profile=removal --retain=combat,crafting,foraging,giants,growth,settlement --engine-only --maxWorkers=2`。不prepare-only、不实删；正常full是外部必要门禁not-run。后续维护者实删须检查剩余全开/全关两端点，不是64子集，并用本轮真实含新人档/录像证明拒绝而不退休活局。

开发plan已exit0，恰一行`keep-combat+crafting+foraging+giants+growth+settlement`，removed=[narrative]。展开的**计划**命令为：`node scripts/check-module-boundaries.mjs`；`node node_modules/vue-tsc/bin/vue-tsc.js -b`；`npm run build`；`npm run test:ext -- --maxWorkers=2`；`node scripts/check-module-composition-smoke.mjs --output <evidence>/keep-combat+crafting+foraging+giants+growth+settlement-smoke.json --engine-only --removed-modules narrative --combinations endpoints`。这些是删除副本未来计划，不是本次执行了test:ext或smoke。`normalTreeFullGate={required:true,includedInMatrix:false,status:not-run}`；收尾同一个plan已exit0，仍恰一行；没有实际执行展开的删除副本门禁。

## 10. 美术

完成：原三图固定来源字节保留，新五图九次正式生成尝试，逐图数值与1×/5×/8×视觉通过后整批安装。没有降低阈值、扩色、手绘、缩放生成源或改每人裁切。

### 10.1 环境与实际检查
Python3.12.14 / Pillow12.3.0 / numpy2.3.5; Nodev24.19.0 / Vitest4.1.11; NODE_OPTIONS=--max-old-space-size=3072; maxWorkers2.
Image tool image_gen.imagegen; model identifier not exposed by actual tool result. Date2026-10-10 UTC. All nine sources verified native1024×1536 by Pillow; no source resizing, per-character crop, dithering, hand drawing or remapping beyond approved fixed pipeline.

First complete pipeline exit0, about1.03s; failures=[]; headTopRange3; newBytes6078; totalBytes9728. Old3 bytes3650. Python syntax/help and rejection of in-repository output verified. No threshold weakened.
First single pixel Vitest run exit0:1file/11tests passed,0failed/skip/todo;506ms (test126ms); shell1.78s. CE cache warning emitted, but this asset test has no CE test/skip. Full final gate remains 本次收尾统一执行.

```bash
python src/ext/modules/narrative/tools/pixelize_portraits.py --new-sources /workspace/scratch/db2caf941a8f/generated_images/exec-1269c0fa-966b-4aca-92b4-b43cf9c87b25.png /workspace/scratch/db2caf941a8f/generated_images/exec-4f9e827f-5107-42ab-b0d1-20f15feafaba.png /workspace/scratch/db2caf941a8f/generated_images/exec-d8840f12-7c96-4056-8c9c-0c95a545f85c.png /workspace/scratch/db2caf941a8f/generated_images/exec-d36f92f1-41f5-4fdc-a450-b4888789467b.png /workspace/scratch/db2caf941a8f/generated_images/exec-767ebde5-a982-4464-b54c-c0df510a8cc8.png --palette src/ext/modules/narrative/assets/portraits/palette.json --out /tmp/narrative2-art/candidates --evidence /tmp/narrative2-art/evidence
PATH=/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin:$PATH NODE_OPTIONS=--max-old-space-size=3072 npx vitest run src/ext/modules/narrative/tests/narrative_portrait_pixels.test.ts --maxWorkers=2
git diff --check -- src/ext/modules/narrative/assets/portraits src/ext/modules/narrative/tools/pixelize_portraits.py src/ext/modules/narrative/tests/narrative_portrait_pixels.test.ts
```

可迁移重建：交付证据包中九原图位于`art/sources/`，文件名与上面命令的`exec-*.png`完全一致。解包后将五个绝对生成图路径分别替换为该目录同名文件，将out/evidence改为新的仓外目录，即可复算候选、数值与1×/5×/8×联系表；不需要本云工作树仍存活。完整尝试/提示词在`art/generation-attempts-verified.json`，本报告亦保留最终原文。

### 10.2 数值与散列

|PNG|head|coverage|contrast median|bytes|SHA-256|
|---|---:|---:|---:|---:|---|
|archive-keeper|6|0.551432291667|1.811681733421|1195|8495d1db899170c3dc96ce8dfb894f78c790777497f39f82d6f5ebced1a617ba|
|bell-mender|7|0.533203125000|1.694960289529|1175|bf58147f8c1fd2646354e3744da08c72661bb44ac3b9b7a969a2ee58b2cdbe45|
|wick-listener|4|0.594075520833|1.650592696444|1280|551fe53ae60f7de2c04fbdf907d4d338a1e52db189db5d0a8c18074200a36606|
|cord-mender|7|0.458007812500|1.610627409090|1111|23002aee0ac29bf9a2fbc879218a5479445cc4959df3af7f1e26c4487cf926af|
|cistern-listener|6|0.561523437500|1.994197984492|1314|72dee0229640b7b6c0962781963f0f4c6c04e9b02e2c26cbf689f7b508f04a06|
|bone-clerk|6|0.564778645833|1.610627409090|1250|53eda69970dc3984ff6f1a2d825bd55d2f0e17f4284f9d5c662cff4e1efa34fe|
|salt-warden|7|0.530598958333|1.610627409090|1214|1327357bcc99b452e9910986cb7692ec45b6f595083fd05c5d259fa6eb9933e3|
|letter-carrier|6|0.554036458333|1.811681733421|1189|2581a00c4233cecc005246af7d82eedeeb18cafe8feacea80a4f5c190986a1ad|

All8:48×64, bitdepth8, indexedtype3,33PLTE entries, one transparent index0 and other alpha255, chunks onlyIHDR/PLTE/tRNS/IDAT/IEND; corners transparent;toprow0;upperleft/right0;paletteOutOfBounds0. All5 accepted sources:cropedges0/0/0,removedspecks0. Complete per-source corner measurements and sourceSHA in evidence/measurements.json.

Fixed paletteSHA6e7dcdbb904c3337f951d4df4f5b53136772c351c4019bcbb50f605017f21905. Palette copied byte-for-byte,32opaque colours:
#211f1b #272018 #252422 #2e241a #292929 #34291e #3d2819 #2f3032 #402e1d #403224 #4b341f #343b44 #3c3e41 #4a3d2f #553b23 #613f21 #414954 #5a4837 #6e4923 #4e545c #735637 #525e6d #885527 #94612d #657484 #8f6f49 #ae6f31 #b67932 #b08b5c #d48f46 #daa267 #dcbd93

### 10.3 九次生成尝试

- cord_prompt: rejected: exec-633b56e4-58d6-4d6d-a20e-13149bc8d213.png: source crop clips head/prop: [155, 0, 0];sourceSHA896e02930b9786efbf47bed47d149d789c9035fa78e63b00c559ebd74d3c6f07;/workspace/scratch/db2caf941a8f/generated_images/exec-633b56e4-58d6-4d6d-a20e-13149bc8d213.png
- cord_prompt2: rejected: contrast=1.3185876573679838;sourceSHA7348a9b82f0730b0c4751fd9494f4bfcb638a0c5b6ce1a15812a4f3639897fe3;/workspace/scratch/db2caf941a8f/generated_images/exec-45f71821-e71b-4441-8f9d-6abe3c74c26a.png
- cord_prompt3: rejected: contrast=1.3488742306055141;sourceSHAdf40aeaf2767de589b0778ee6a0782ce2d9f78935a6585ffdca23873cc5ae719;/workspace/scratch/db2caf941a8f/generated_images/exec-5fcf73cc-b327-4478-8d6a-f3dc0c0fd6c1.png
- cord_prompt4: accepted;sourceSHAe29d7bcd992bbddcb355f2ac9cf684180d226344477d88fab9284a8993902559;/workspace/scratch/db2caf941a8f/generated_images/exec-1269c0fa-966b-4aca-92b4-b43cf9c87b25.png
- cistern_prompt: rejected: contrast=1.230944576587887;sourceSHAd192e13f1443a56dbc5fbe5d4707c9127d1da89afe6c8a8a5667c227dd807f78;/workspace/scratch/db2caf941a8f/generated_images/exec-d9863f28-aec3-479a-8a62-fe862da32097.png
- cistern_prompt2: accepted;sourceSHA2326f8b0c8950cd5474b00abff8be75e4a8c0161068b8c4c9f75c722e9561832;/workspace/scratch/db2caf941a8f/generated_images/exec-4f9e827f-5107-42ab-b0d1-20f15feafaba.png
- bone_prompt: accepted;sourceSHAd53c0ecb14706e3307209fdd1a183c8ad13ec646a668be3d82ec406cd9aeb8bf;/workspace/scratch/db2caf941a8f/generated_images/exec-d8840f12-7c96-4056-8c9c-0c95a545f85c.png
- salt_prompt: accepted;sourceSHAd1d67ff9f2521f0a01037a8d62adecfd8b6db1929eeed53a411b81713c08eb33;/workspace/scratch/db2caf941a8f/generated_images/exec-d36f92f1-41f5-4fdc-a450-b4888789467b.png
- letter_prompt: accepted;sourceSHA7e8d1183bbd4359ab49987e949e087615cd490febba01a5bd3acabb7a2f9b194;/workspace/scratch/db2caf941a8f/generated_images/exec-767ebde5-a982-4464-b54c-c0df510a8cc8.png

Actual counts cord4/cistern2/bone1/salt1/letter1, within≤6 each. Original complete prompts and rejected source hashes retained in generation-attempts-verified.json. Cord1 rejected fixed crop top155 opaque; cord2/3 contrast1.31859/1.34887; cistern1 contrast1.23094. Other individual failures none.

### 10.4 本轮视觉检查
独立视觉检查实际查看 contact-1x.png/contact-5x.png/contact-8x.png on#11130f, accepted all8 as one batch before installation.
- Same upper-left warm light: yes; observed left-facing planes lit and right sides in shadow.
- Rightward three-quarter orientation: yes, coherent all8.
- Outline thickness and pixel density: yes, coherent muted low-resolution set.
-1× face and major prop distinguishability: yes; rope/tallies, hollowbowl, ledger+quill, sealed amberlamp, foldedletter distinct.
- Subject/glyph colour families: yes; cord ochre, cistern slateblue, bone parchment, salt ochre/amber, letter russet.
- No text/watermark/frame: yes. No glow/flame in either salt or wick lamp: yes.
- Old3 continuity: yes, exact approvedsource bytes preserved.
- Honest limitation: bone tiny accent subtle and clearer enlarged; do not claim detailed anatomical visibility at1×. Cord ends higher/looks slightly smaller, observed and accepted with actual coverage45.80%/head7/fullsetrange3.

### 10.5 来源记录与许可边界
Old3 not generated this round; original generation record only: git show93523fc596b173396a0d526ab2073b327ff7cf3e:docs/ext/phase6b1a.report.md §8.2–8.8 (record date2026-10-06, image_gen.imagegen, model not exposed; attempts3/6/3). Original output/raw-source history is not claimed newly verified. Current PNG/palette hashes independently verified.
New5 original project character subjects, no third-party characters or artist references. 生成服务账户实际条款未在本轮独立核验，不对账户特定许可或知识产权作保证；未提供第三方角色/作品/艺术家参考。

### 10.6 资产写入范围
Three fixedPNG+palette;five newPNG;src/ext/modules/narrative/tools/pixelize_portraits.py;src/ext/modules/narrative/tests/narrative_portrait_pixels.test.ts.
Script preserves legacy3-source entry and adds explicit--new-sources/--palette fixed32 mode; exact old3/palette hashes enforced, outside-repository candidates mandatory, fixed crop/key/premultipliedBOX/binaryalpha/speck/L1quantization unchanged. All8 contacts assembled without reprocessing old3.
Pixel tests retain every inherited pixel gate and add8-item/1.3.0 premise, exact old3/paletteSHA, byte+decodedpixel distinctness, five20KiB/eight32KiB while retaining oldthree12KiB bound.

### 10.7 脚本和测试最终散列
-tools/pixelize_portraits.py: 08470e92a5f41fb09bd3492c0fed92d7e586bac9fd62500c86a490f01249dfec
-tests/narrative_portrait_pixels.test.ts: d6ac80146a73066a3468065bb90cd1bf040fd783cdce385df5ea66a5c546e4f4

### 10.8 最终完整提示词（原文）

#### cord_prompt4
Generate a native 1024 by 1536 PNG image. Pixel art character portrait for a dark fantasy roguelike game. a weathered adult missing the left outer ear, ochre patched coat, holding a thick spliced rope and blank wooden tally pieces at chest height, no readable marks.
Bust-to-waist portrait, three-quarter view, the body and face turned toward the right side of the image, eyes looking slightly to the right. Exactly one figure, centered horizontally. The top of the head sits about one fifth of the image height below the top edge; the bottom edge of the image cuts straight across the waist. Both hands and the held object are fully inside the frame, in front of the chest.
Chunky low-resolution pixel art drawn on a 48 by 64 pixel grid and enlarged with hard square pixels. Every pixel is one flat solid colour. Limited muted palette: ochre patched coat and copper-brown rope, grey shadows, restrained bone-white highlights; shared fixed colors #211f1b #272018 #252422 #2e241a #292929 #34291e #3d2819 #2f3032 #402e1d #403224 #4b341f #343b44 #3c3e41 #4a3d2f #553b23 #613f21 #414954 #5a4837 #6e4923 #4e545c #735637 #525e6d #885527 #94612d #657484 #8f6f49 #ae6f31 #b67932 #b08b5c #d48f46 #daa267 #dcbd93. One dark brown-black outline one pixel wide around the whole silhouette. Simple cel shading in two or three flat steps. A single warm light from the upper left; the right side of the figure falls into deep shadow.
The entire background is one flat pure magenta colour, hex FF00FF, from edge to edge, with nothing else in it.
There is no text, no letters, no numbers, no signature, no watermark, no border, no frame, no scenery, no floor, no cast shadow, no glow, no light rays, no sparkles, no smoke, no gradient, no blur, no soft edges, no anti-aliasing, no noise, no second character.
Original character design, not based on any existing game, film, comic, artwork or artist.
CRITICAL LAYOUT: The uppermost 300 pixels of the 1536-pixel canvas must be entirely empty solid magenta. Start the top of the hair at y=310, never above y=300. Keep the entire body and both elbows within x=110 to x=914 at every height above y=1400. The bottom cuts the torso at waist. This is a smallish figure with wide magenta margins, not a close-up head crop. LEFT EAR IS MISSING: the viewer-visible left outer ear has been lost, show a small healed flat scar where that ear should be; do not draw a protruding ear. Keep chunky very simple pixels suitable for48x64 downsample, not intricate realistic pixel painting.
Use a very thin dark-brown silhouette contour #553b23 or #4a3d2f, never absolute black. Most boundary pixels should be medium warm brown ochre on the light-facing edges, slate-gray on shadow edges. Strong upper-left warm light keeps the silhouette clearly visible on a near-black game UI. Preserve a simple single-pixel outline, no glow. Show the thick rope visibly spliced in a prominent knot at chest center.
Final silhouette instruction is decisive: the ENTIRE outer contour around hair, coat, shoulders and arms is muted medium-brown #735637, one thin pixel stroke. There must be no near-black pixels on the outer boundary. Black-brown shadows are only inside the silhouette. Hair perimeter also brown#735637. This is not glow or a second outline; it is the single normal dark-brown contour that remains legible against black game UI. Headtop y=305.

#### cistern_prompt2
Generate a native 1024 by 1536 PNG image. Pixel art character portrait for a dark fantasy roguelike game. a young adult woman with short dark hair, slate blue sleeves with pale salt cuffs, holding an empty chipped clay bowl with both hands, calm attentive face.
Bust-to-waist portrait, three-quarter view, the body and face turned toward the right side of the image, eyes looking slightly to the right. Exactly one figure, centered horizontally. The top of the head sits about one fifth of the image height below the top edge; the bottom edge of the image cuts straight across the waist. Both hands and the held object are fully inside the frame, in front of the chest.
Chunky low-resolution pixel art drawn on a 48 by 64 pixel grid and enlarged with hard square pixels. Every pixel is one flat solid colour. Limited muted palette: slate blue sleeves, pale salt cuffs, dark grey hair, muted brown clay bowl, bone-white skin highlights; shared fixed colors #211f1b #272018 #252422 #2e241a #292929 #34291e #3d2819 #2f3032 #402e1d #403224 #4b341f #343b44 #3c3e41 #4a3d2f #553b23 #613f21 #414954 #5a4837 #6e4923 #4e545c #735637 #525e6d #885527 #94612d #657484 #8f6f49 #ae6f31 #b67932 #b08b5c #d48f46 #daa267 #dcbd93. One dark brown-black outline one pixel wide around the whole silhouette. Simple cel shading in two or three flat steps. A single warm light from the upper left; the right side of the figure falls into deep shadow.
The entire background is one flat pure magenta colour, hex FF00FF, from edge to edge, with nothing else in it.
There is no text, no letters, no numbers, no signature, no watermark, no border, no frame, no scenery, no floor, no cast shadow, no glow, no light rays, no sparkles, no smoke, no gradient, no blur, no soft edges, no anti-aliasing, no noise, no second character.
Original character design, not based on any existing game, film, comic, artwork or artist.
CRITICAL composition: uppermost300 pixels of1536 canvas solid empty magenta. Top of hair at y=300 to320. Figure centered, hands/object entirely visible. Body extends beyond bottom edge so canvas cuts waist, never floating above bottom. Keep silhouette within x=90 to934 above bottom20% of image. Calm neutral noncombat character. Clay bowl clearly EMPTY with visible dark hollow interior and chipped rim. Very simple chunky pixels suitable for48x64.
Important game-asset readability: silhouette contour must be a thin muted medium brown #6e4923, not black and not near-black. Keep the outermost visible edges of sleeves in slate blue #657484, and cuffs in bone beige #dcbd93. Light the whole figure sufficiently that medium-value boundary colors remain readable on a near-black UI. Preserve warm upper-left highlights and deeper right shadows using midtone browns/slate, without crushing the right silhouette into black. Hair outer edge gray #657484. No glow.

#### bone_prompt
Generate a native 1024 by 1536 PNG image. Pixel art character portrait for a dark fantasy roguelike game. a tall gaunt elderly man with a bald brow, parchment beige scarf and dark coat, holding a closed blank ledger and a blunt quill, a small pale bone resting on cloth at his chest.
Bust-to-waist portrait, three-quarter view, the body and face turned toward the right side of the image, eyes looking slightly to the right. Exactly one figure, centered horizontally. The top of the head sits about one fifth of the image height below the top edge; the bottom edge of the image cuts straight across the waist. Both hands and the held object are fully inside the frame, in front of the chest.
Chunky low-resolution pixel art drawn on a 48 by 64 pixel grid and enlarged with hard square pixels. Every pixel is one flat solid colour. Limited muted palette: parchment bone-beige scarf, dark slate and brown coat, bone-white highlights, muted brown ledger; shared fixed colors #211f1b #272018 #252422 #2e241a #292929 #34291e #3d2819 #2f3032 #402e1d #403224 #4b341f #343b44 #3c3e41 #4a3d2f #553b23 #613f21 #414954 #5a4837 #6e4923 #4e545c #735637 #525e6d #885527 #94612d #657484 #8f6f49 #ae6f31 #b67932 #b08b5c #d48f46 #daa267 #dcbd93. One dark brown-black outline one pixel wide around the whole silhouette. Simple cel shading in two or three flat steps. A single warm light from the upper left; the right side of the figure falls into deep shadow.
The entire background is one flat pure magenta colour, hex FF00FF, from edge to edge, with nothing else in it.
There is no text, no letters, no numbers, no signature, no watermark, no border, no frame, no scenery, no floor, no cast shadow, no glow, no light rays, no sparkles, no smoke, no gradient, no blur, no soft edges, no anti-aliasing, no noise, no second character.
Original character design, not based on any existing game, film, comic, artwork or artist.
CRITICAL composition: top300 pixels of1536 canvas solid empty magenta; headtop aroundy305. Body/hands/objects centered fully inside width, silhouette never touches left/right edges. Bottom cuts torso at waist. For readability on black UI, single thin dark-brown silhouette contour is muted medium-brown #735637, never near-black. Most light-facing edges bone beige or ochre and shadow-facing edges slate-gray or mediumbrown. Darker shadows inside only. No glow. Chunky simplified pixels.

#### salt_prompt
Generate a native 1024 by 1536 PNG image. Pixel art character portrait for a dark fantasy roguelike game. an adult with a coarse ochre head wrap and square patient face, dark work robe, holding a sealed unlit amber salt lamp tied at the neck, absolutely no flame or glow.
Bust-to-waist portrait, three-quarter view, the body and face turned toward the right side of the image, eyes looking slightly to the right. Exactly one figure, centered horizontally. The top of the head sits about one fifth of the image height below the top edge; the bottom edge of the image cuts straight across the waist. Both hands and the held object are fully inside the frame, in front of the chest.
Chunky low-resolution pixel art drawn on a 48 by 64 pixel grid and enlarged with hard square pixels. Every pixel is one flat solid colour. Limited muted palette: ochre head wrap, muted copper-brown robe and amber salt vessel, bonewhite skin highlights; shared fixed colors #211f1b #272018 #252422 #2e241a #292929 #34291e #3d2819 #2f3032 #402e1d #403224 #4b341f #343b44 #3c3e41 #4a3d2f #553b23 #613f21 #414954 #5a4837 #6e4923 #4e545c #735637 #525e6d #885527 #94612d #657484 #8f6f49 #ae6f31 #b67932 #b08b5c #d48f46 #daa267 #dcbd93. One dark brown-black outline one pixel wide around the whole silhouette. Simple cel shading in two or three flat steps. A single warm light from the upper left; the right side of the figure falls into deep shadow.
The entire background is one flat pure magenta colour, hex FF00FF, from edge to edge, with nothing else in it.
There is no text, no letters, no numbers, no signature, no watermark, no border, no frame, no scenery, no floor, no cast shadow, no glow, no light rays, no sparkles, no smoke, no gradient, no blur, no soft edges, no anti-aliasing, no noise, no second character.
Original character design, not based on any existing game, film, comic, artwork or artist.
CRITICAL composition: top300 pixels of1536 canvas solid empty magenta; headtop aroundy305. Body/hands/objects centered fully inside width, silhouette never touches left/right edges. Bottom cuts torso at waist. For readability on black UI, single thin dark-brown silhouette contour is muted medium-brown #735637, never near-black. Most light-facing edges bone beige or ochre and shadow-facing edges slate-gray or mediumbrown. Darker shadows inside only. No glow. Chunky simplified pixels.
The lamp is an opaque sealed amber salt vessel, capped and tied with cord at its narrow neck; no visible wick, no flame, no emitted light, no lantern glow. Hands cradle the vessel.

#### letter_prompt
Generate a native 1024 by 1536 PNG image. Pixel art character portrait for a dark fantasy roguelike game. an elderly courier with a lined face and russet travel coat, flat leather mail satchel, holding one folded blank unsealed letter, tired but direct eyes, no text or symbols.
Bust-to-waist portrait, three-quarter view, the body and face turned toward the right side of the image, eyes looking slightly to the right. Exactly one figure, centered horizontally. The top of the head sits about one fifth of the image height below the top edge; the bottom edge of the image cuts straight across the waist. Both hands and the held object are fully inside the frame, in front of the chest.
Chunky low-resolution pixel art drawn on a 48 by 64 pixel grid and enlarged with hard square pixels. Every pixel is one flat solid colour. Limited muted palette: russet and copper-brown travel coat, brown leather, bonebeige folded blank letter, slategray shadows; shared fixed colors #211f1b #272018 #252422 #2e241a #292929 #34291e #3d2819 #2f3032 #402e1d #403224 #4b341f #343b44 #3c3e41 #4a3d2f #553b23 #613f21 #414954 #5a4837 #6e4923 #4e545c #735637 #525e6d #885527 #94612d #657484 #8f6f49 #ae6f31 #b67932 #b08b5c #d48f46 #daa267 #dcbd93. One dark brown-black outline one pixel wide around the whole silhouette. Simple cel shading in two or three flat steps. A single warm light from the upper left; the right side of the figure falls into deep shadow.
The entire background is one flat pure magenta colour, hex FF00FF, from edge to edge, with nothing else in it.
There is no text, no letters, no numbers, no signature, no watermark, no border, no frame, no scenery, no floor, no cast shadow, no glow, no light rays, no sparkles, no smoke, no gradient, no blur, no soft edges, no anti-aliasing, no noise, no second character.
Original character design, not based on any existing game, film, comic, artwork or artist.
CRITICAL composition: top300 pixels of1536 canvas solid empty magenta; headtop aroundy305. Body/hands/objects centered fully inside width, silhouette never touches left/right edges. Bottom cuts torso at waist. For readability on black UI, single thin dark-brown silhouette contour is muted medium-brown #735637, never near-black. Most light-facing edges bone beige or ochre and shadow-facing edges slate-gray or mediumbrown. Darker shadows inside only. No glow. Chunky simplified pixels.
One plainly folded rectangular letter with no wax seal or writing, both hands holding it in front of chest, flat leather mail satchel visible at side of torso. Elderly weary but alert, not youthful.


## 11. UI

仅NarrativePortrait.vue使用crisp-edges/pixelated与纯深底，NarrativeDialogue.vue立绘页上限384px；不新增host或输入屏障。桌面240×320、≤700px72×96、≤350px48×64保持。

本次真实开发构建：index.html SHA-256 `354a8402f0a9ebd221477db987cf15a25a31b7f31b151fef00d7ca5db75177a0`；生产源清单指纹`bf2755300d119a2c224e2ac07c8e1192afd9c4d191b095c808db790067424fda`；main `index-BadwrZJz.js`，对话`NarrativeDialogue-B4ngjhSk.js`，立绘`portraits-DT0CPnhX.js`。构建前后生产输入相同；这是磁盘构建身份，**不是已加载的浏览器页面身份**。

实际工具为dot云Chromium，不是用户Mac。2026-10-10 20:03:43 UTC，F12明确显示组织策略禁止开发者工具；未绕过。20:06:34与20:07:34 UTC，对正常preview URL `http://127.0.0.1:4173/`两次导航均为ERR_CONNECTION_REFUSED；后一次已重启到获准的宿主网络预览。错误页非http(s)协议又被浏览器读取策略拒绝，未尝试规避。支持的浏览器工具没有精确viewport/DPR或网络拦截接口。

| 视口 | DPR | 模式 | 本次结果 |
|---|---:|---|---|
| 1440×900 | 1 | 普通 | blocked/未执行 |
| 1440×900 | 1 | 沉浸 | blocked/未执行 |
| 1440×900 | 2 | 普通 | blocked/未执行 |
| 1440×900 | 2 | 沉浸 | blocked/未执行 |
| 390×844 | 1 | 普通 | blocked/未执行 |
| 390×844 | 1 | 沉浸 | blocked/未执行 |
| 390×844 | 2 | 普通 | blocked/未执行 |
| 390×844 | 2 | 沉浸 | blocked/未执行 |
| 320×844 | 1 | 普通 | blocked/未执行 |
| 320×844 | 1 | 沉浸 | blocked/未执行 |
| 320×844 | 2 | 普通 | blocked/未执行 |
| 320×844 | 2 | 沉浸 | blocked/未执行 |

0/12通过；另844×390横屏未执行。五人各三种宽度共15格均未执行。没有页面加载，故对话/日志/立绘/返回/关闭、长正文/名字/禁用原因、无溢出/不裁图/按钮44px/滚动、Escape/数字/Enter、快速双击、切页零命令、关闭不续跑、活动save/load、回放只读/非单调seek，以及404/延迟/迟到error降级，**全部浏览器未执行**。键鼠和触摸模拟均未完成；真手机未实测。原窗口1196×852不是content viewport/DPR，不代替矩阵任何一行。

策略截图：仓外`narrative2-browser-evidence/20261010-devtools-policy-block.png`；机器矩阵`qa-results.json`。SFC、真实引擎和像素联系表各自单列，不冒充浏览器。此缺口是基础设施/能力阻断，没有据此推断产品UI缺陷。维护者须用可访问真实preview的Chromium，按真实录制命令路线或菜单导入录像复核，记录其实际构建身份并执行全部§5.4。

## 12. 反事实与SDK问题

- CF-N2-FLAGS：旧content整flags等值断言在基线targeted2项通过；新生产同入口2项失败，仅多五个unresolved初始flag。精确扩展全对象期望，不删除原D1三人或旧结局语义。
- CF-N2-D2：旧runtime缓存层测试基线1项通过；新生产首败仅D2自然新增cord.mender，旧“D2没有新实体”前提失效。更新为完整旧三实体前缀+精确cord实体/收据，然后全量比较扩大后的世界、绑定与收据。
- 调整后首次复跑被并发新增测试尚未登记的发现守卫拦截，两命令exit1保留；仅补模块自有清单，不宽化守卫。
- N2-A01：已复现并作基线单变量归因。seed1固定A+回顾，前三切点69/168/178，盐灯D6切点348；save/load与人工逐条replay通过，加入原派发cycle的seek0→末后，完整末态恰9叶失败：`levels[3].grid[21/22/23/51/52/81/197/223/251].isVisible`由true变false，0 OOS。候选exit1，107.93s；仓外23MB全差异与穷举叶差保留。未改动1.4基线按同一物理命令，仅删40条不存在的新对白命令，在seek0→308得到完全相同9叶差，exit1，94.99s；每切点完整双RNG/玩家坐标与HP/turn/tick一致，共享1217个src文件逐字节一致，故不是本次新内容引入。最初遗漏seek的候选/基线探针分别exit0、85.17s/71.86s，单列保存，不冒称关闭N2-A01。观察时机单变量反事实同样失败：候选78.10s、旧基线72.14s，均exit1。仅用公开rng/runtime/turn读取替代逐事件toSnapshot后，人工replay本身已出现同样9叶差；原逐步save观察会清理瞬态并掩盖该差异。故不是靠调整比较口径变绿，也不把原人工replay通过当作一般正确性证明。普通自有replay oracle已改为无副作用读取：仍逐事件检查游标、0 OOS、双RNG含计数/当前流、turn及extension checkpoint；tick/depth/玩家等逐事件验证仍由冻结`Game.ts:4530–4552`的completeReplayEvent执行，无获准的无副作用tick getter，不越权导入Time。全部端点/消息/前缀/seek完整比较保持，后续新暴露失败继续保留。严格失败不删除、完整visibility不裁剪。最小入口：`npx vitest run src/ext/modules/narrative/tests/narrative2_persistence.test.ts -t N2-A01 --maxWorkers=2`。实际影响是跨层缓存的完整持久状态在seek后不一致，不能以0 OOS或“纯显示”结案；RecordingDigest排除派生可见性只能解释OOS为何未响。建议共享引擎所有者复核snapshot/seek的瞬态清理与缓存可见性规范化时机，保持完整端点对比后修复，不在本模块删字段。
- N2-SDK-RECORDING-ORIGIN：新增真实provider的commit/结算实现异常定向复测，完整世界/玩家/模块/双RNG/消息/已录事件前缀/游标均保持，随后`hasCompleteRecording`期望true实际false。`Game.ts`的命令异常捕获无条件设置`recordingFromNewGame=false`；既有`phase2-narrative.md`§6.4明确要求提交异常中止录制来源。这里是包内完整录制原子性要求与冻结底座策略的冲突，不能按新增内容回归归罪，也不能称已经实测旧基线同例。保留严格失败；需要维护者决定新合同或共享引擎修复，本次白名单不能处理。最终全矩阵结果另列§7。最小入口：`npx vitest run src/ext/modules/narrative/tests/narrative2_rewards.test.ts -t "cord.mender: failCommit" --maxWorkers=2`，保留`narrative2_rewards.test.ts:110`完整录制断言（历史首败日志的102行号原样保留）。

- N2-SDK-SPATIAL-LOAD：七全开seed2的真实D8存档接受load后，直接toSnapshot抛`SpatialValidationError: Missing movement region or body outside bounds`。仓外主复现只用harness/fs/Vitest：真实loadSnapshot成功后直接toSnapshot，exit1，1 failed/0 skip/todo，10.43s，无空间查询或路线/helper观察。源码`reproduction-sources/narrative2_saved_input_minimal.test.ts`第12行，SHA-256 `7e9ce118ef0ec7d3ba953de79aa8aec22e9c5d1840c4b0c627c647060f0fcf26`；命令/首败为`n2-seven-saved-input-minimal.*`。额外只读空间归因探针9.60s同样失败，作为仓外诊断单列，不进入注册测试或生产导入。8个有界actor的region ledger均存在、所有footprint都在界内；活动D8 actor321/region320关联为true，缓存D2 actor66/65、D6 actor219/218、D7组277–281/276关联均false。共享`Game.ts:12199,13456–13458`仅重绑活动grid；`MovementRegions.ts:7–12`未绑定grid返回false，`WholeRunSnapshot.ts:182–185,398`在缓存层组校验触发`CreatureSpatial.ts:257–259`错误。现象与源码指向缓存移动区域session恢复，修复越过本次白名单；没有声称实测旧版本反事实，也不与A01混为一谈。保留真save SHA-256 `e0e39ac5367c174c84a96074e3f4a3aa908a679df04bf1d3a178527b3f0cff7e`、原错误与复现源，详见仓外`N2-all-seven-save-load-analysis.md`。建议共享所有者恢复缓存grid的区域解析关联或为校验提供明确上下文，再跑此真实输入及完整九行；本次不弱化空间守卫。

## 13. 自行决定、签认与审查

按用户转贴采用N2-D01–D07：五人固定故事/深度、独立可选奖励默认skip、静态四候选一不可招募、仅自有版本、固定资产来源与调色板、定向验收、最多两轮独立审查→修复。没有越白名单补growth或共享引擎。

新增5项可逆执行决定：①全新worktree保留既有工程；②重型测试排他避免OOM；③图像/大录像/原save留仓外并周期归档；④诊断UI/provider夹具仅移动放置深度而保留真实内容，并与自然证据分开；⑤依据N2-A01实测，把普通replay逐事件观察改为无副作用公开读取，保留所有完整端点与失败。没有改变D01–D07的内容/奖励/版本/资产/范围裁决。

实际独立审查为**1轮R1**，在81个自有文件冻结后执行，候选清单SHA-256 `a61aa63f992ff93dbcdb8a868ed2138a8fb4841ae0313a88d06bdb2ec0d4b916`。独立复核全部81散列、原包编译器与四份JSON完全相等、生产范围、招募隔离、真实测试预言、原像素阈值与旧断言前提；另有限5×视觉抽查。没有新增确认的正确性或越权问题，不要求源代码修复或R2。已知A01、录制来源冲突、浏览器缺口继续开放，审查不是维护者签认。R1结束时第九组合仍在执行；其后确认的N2-SDK-SPATIAL-LOAD由真实保存输入保留为新增阻断，没有在本模块修复，也没有把R1当作该缺陷关闭。唯一编辑意见是报告的奖励断言源码行号102→110；已由作者核对修正，历史日志不改。后续填入最终门禁与提交事实属于作者交付编辑，不称第二轮独立关闭，也不启动第三轮。

## 14. 遗留

- **功能正确性阻断**：N2-SDK-RECORDING-ORIGIN、N2-A01、N2-SDK-SPATIAL-LOAD均保留严格失败与原始输入/退出码。需要共享引擎/合同所有者裁决并在其授权范围修复，再执行对应最小复现与完整生命周期；本次不裁剪字段、不降低守卫。
- **图像交付阻断**：无。五张新图与三张指定旧图全部安装，固定共享调色板、数值闸门与独立视觉查看通过。生成工具未公开模型名称、服务条款许可未知项按§10披露。
- **证据缺口**：浏览器12行、横屏、五人三宽度、输入/保存/回放/图片失败降级全部未执行，真机未验。维护者需在可访问同一构建的真实浏览器补齐§11矩阵，不能用SFC测试或联系表代替。
- **延期集成门禁**：本次只执行九行相关组合与只删narrative的精确plan；完整npm/test:ext、128组合、实际删除、CE及全项目性能均未运行。交维护者针对新候选重新集成，不沿用已结束5Z背书。
- **后续边界**：真实growth新报价由growth所有者另行配置；5D3招募/居民/岗位/跟随尚未实施。维护者应先处理以上功能与证据缺口，再决定新阶段；本次收尾后停止。
