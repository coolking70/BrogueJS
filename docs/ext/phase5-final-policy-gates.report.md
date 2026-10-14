# 新政策最终门禁交付核对

**delivery BLOCKED；未提交、未推送。** 核对时间 2026-10-13T23:16:07.741133+08:00。`policy-final-gates-v1` 本轮独立一次完整批次实际结束于 2026-10-13T23:07:01.420386+08:00，done `exit=1`、summary `completed-with-failures`。正常 npm 的96项未获豁免失败与5个空套件错误仍未关闭；正常 ext 5败中3项亦未获豁免。获准非阻塞范围仅zombie自然出招、giant正伤害/群体handled内容证据缺口及N2七包原900s性能调查，不能覆盖其它失败。此处96=99减原批准3项，仅说明同一npm套件的分类，不与ext相加。

本执行者只核对已有结果、更新交付文档与状态；没有生产/测试/脚本源修订、重跑门禁、探针、获准内容搜索或R3。R2限定R1-F1已PASS，清理53项相关合同此前通过，均不替代本轮最终结果。源码稳定不等于验收通过。旧5Z/15行/29endpoint未用于本轮通过计数。

## 身份、执行与进程

| 身份 | 本轮实物 |
|---|---|
| 分支/工作树 | `ext/phase5` / `/Users/coolking70/Documents/同步空间/BrogueJS-p5` |
| 门禁开工及核对HEAD | `a15c9800877db8280ab031e9e600d33f019db33c`，加未提交集成/R1/政策差量；该HEAD是流程merge检查点，非已验收代码commit |
| HEAD父系 | `70a8e98b5ab86833a10ddeba068ffb8caf18d9b4` + `4ea702c0fce7a25cea9be0bf92b27dbd3ff29677` |
| 前一merge父系 | `70a8e98`：`c7bee4ffe6190a1173319ab3730df5f5143f26e6` + `1d0d900212c94e5acfccdd63d244e24d6f2d1bd2` |
| 正常树src/scripts/config | 1343文件，前、后及本执行者当前只读重算均 `fb8be72f22f7bf43272de36a889ba3eec4dbeb72d1356d1fc2a12d0cee20c086` |
| 全删树src/scripts/config | 各删除后命令前后均 `dd32f5c8254b8486e686db1604c2d3573c17cb9e0139d39f55c2b8dde986047d` |
| 删除实现的完整输入哈希（口径含docs/build输入） | 正常前/后 `3127df5938c4443162acb9e3af472bbe57d831fa3351c3747ad1dd9123a6e143`；删除后/末次副本 `838362d7a30d5a67cb71544241d1015d210e8da1d9177d469cec0245d1d5463e`；两种哈希口径分列 |
| 运行环境 | Node v24.19.0；3072MiB；maxWorkers=1、no-file-parallelism；未设名称过滤或capture搜索开关 |
| 门禁时间/生命周期 | 2026-10-13T11:22:08.838005+08:00 → 2026-10-13T23:07:01.420386+08:00；launch-detached新OS session/nohup，文件stdin/out、run-child真实wait/done |
| 实际ps | 已升级只读核实runner58500、wrapper58499、原handoff57375及完成接续器58543均退出；只本交付7885/wrapper7884与看门狗在运行，无本仓库其它测试或生产作者；另仓库5391旧Vite服务不属本批次 |
| 已验收代码提交 | 本候选没有最终验收代码提交；R2 PASS只涵盖清理前1373路径SHA `027cdd47e9c03c29b12027c1bfd1480743ec25a30a3bf541cdb31dfcd614fc56` |
| 最终交付commit / remote SHA | 均无；未执行commit/push/ls-remote验证，不把本地HEAD称为本轮已推送身份 |

核对已读完整tracked diff、未跟踪候选文件、branch/index/父系及`commit-paths-before.txt`/`worktree-status-before.txt`；index保持空。Game的既有controlled-input `justRested` 提交时机修复属于已集成差量，本执行者未改。清理的测试/发现/依赖脚本差量与父专属README/status/task差量分列。候选路径清单中的现存文件无>1MB；本轮原Vitest JSON、依赖分析日志、真实输入raw和全diff留执行根，不提交。新增父npm初分类报告与本交付报告/清单属文档差量，未擅自纳入index。阻塞下不盲add、不合main/foundation、不merge/tag/reset。

## 逐命令真实结果

`NODE=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`，`E=/private/tmp/brogue-commander-20261009-5z/policy-final-gates-v1`，`COPY=/private/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-byi1pT/candidate`，`R=/private/tmp/brogue-commander-20261009-5z`。命令中以这些变量缩写绝对路径；完整argv/cwd/pid/seconds在执行根原summary，原命令与日志均留存。正常命令在工作树，全删命令在COPY。所有19项实际执行，无首败break漏后继。

| gate / 实际命令 | exit | 实际通过/失败或范围 | skip/todo/unhandled；名称过滤 |
|---|---:|---|---|
| `normal-discovery`：`$NODE scripts/test-discovery.mjs` | 0 | 完整620发现（test612/ext333/drift8；ext重叠不相加） | 无Vitest计数；日志无unhandled标记；过滤0 |
| `normal-check-modules`：`npm run check:modules` | 0 | boundary/导入白名单＋依赖检查通过 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `normal-test-dependencies`：`npm run check:test-dependencies` | 0 | 620/620文件；errors=[]；七包齐全 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `normal-types`：`$NODE node_modules/vue-tsc/bin/vue-tsc.js -b` | 0 | 完整vue-tsc -b通过 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `normal-build`：`npm run build` | 0 | 完整类型＋Vite build通过 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `normal-npm-test`：`npm test -- --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=$E/normal-npm-test.vitest.json` | 1 | 11259过/99败；612/612文件 | 9/5/0；0 |
| `normal-test-ext`：`npm run test:ext -- --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=$E/normal-test-ext.vitest.json` | 1 | 6314过/5败；333/333文件 | 1/0/0；0 |
| `normal-test-drift`：`npm run test:drift -- --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=$E/normal-test-drift.vitest.json` | 0 | 16过/0败；8/8文件 | 0/0/0；0 |
| `normal128`：`$NODE scripts/check-module-composition-smoke.mjs --engine-only --output $E/normal128.json` | 0 | 128唯一组合完整引擎生命周期通过；浏览器未验 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `capture-real-current-inputs`：`$NODE $R/policy-final-real-inputs-v1.mjs capture '/Users/coolking70/Documents/同步空间/BrogueJS-p5' '' $E/real-inputs-capture.json` | 0 | 七个真实当前格式save/recording正常树合法 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `prepare-physical-all-deleted`：`$NODE scripts/check-module-removal.mjs --prepare-only --profile=removal --retain=none --engine-only --maxWorkers=1 --output=$E/all-deleted` | 0 | 实际删7目录/457文件；仅prepared-not-verified | 无Vitest计数；日志无unhandled标记；过滤0 |
| `all-deleted-discovery`：`$NODE scripts/test-discovery.mjs` | 0 | 剩余400发现；ext113/test398/drift2 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `all-deleted-boundaries`：`$NODE scripts/check-module-boundaries.mjs` | 0 | boundary/导入白名单＋所有权通过 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `all-deleted-test-dependencies`：`$NODE scripts/check-test-dependencies.mjs` | 0 | 400/400文件；errors=[]；无已安装可选包 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `all-deleted-typecheck`：`$NODE node_modules/vue-tsc/bin/vue-tsc.js -b` | 0 | 完整vue-tsc -b通过 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `all-deleted-build`：`npm run build` | 0 | 完整类型＋Vite build通过 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `all-deleted-extension-tests`：`npm run test:ext -- --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=$E/all-deleted-extension-tests.vitest.json` | 0 | 1548过/0败；113/113文件 | 24/0/0；0 |
| `all-deleted-composition-smoke`：`$NODE scripts/check-module-composition-smoke.mjs --output $E/all-deleted/keep-none-smoke.json --engine-only --removed-modules combat,crafting,foraging,giants,growth,narrative,settlement --combinations endpoints` | 0 | 全关去重1完整引擎生命周期通过；浏览器未验 | 无Vitest计数；日志无unhandled标记；过滤0 |
| `all-deleted-real-save-recording-rejection`：`$NODE $R/policy-final-real-inputs-v1.mjs reject $COPY combat,crafting,foraging,giants,growth,narrative,settlement $E/real-inputs-rejection.json` | 0 | 7组真实save及recording拒绝，活局保持；classic完整生命周期通过 | 无Vitest计数；日志无unhandled标记；过滤0 |

四套Vitest逐assertion status重新计数并核对原log：npm文件29败/582过/1skip（612）；ext文件4败/328过/1skip（333）；drift文件8过；全删ext文件89过/24skip（113）。JSON里的numTotalTestSuites含嵌套describe，不用其1841/705等数字当文件数。各套expected/actual无缺文件、额外文件或重复文件，名称过滤0，snapshot没有用重录掩盖本次首败。所有报告完整可解析，损坏/缺报告没有归零；超时保原exit1及timeout文本，JSON仅STACK_TRACE_ERROR时按原log核实。0 unhandled表示本轮已报告的未处理异常为0，不把测试断言错误算unhandled。

已完整读取最终证据目录50个文件（21个JSON全部可解析）及runner/stage/done/launch/原日志；只读核对清单、每套状态与SHA保存在执行根`policy-final-delivery-v1.audit.json`，不是新测试。正常树和全删树的checker测试均14原assertion通过，独立child正常1过、实际缺beta1具名skip分别exit0，signal=null；不计入父14项再相加。

## 未关闭失败及批准非阻塞首败

完整npm99条原首败逐项ID、文件、完整用例名及证据见[本轮npm初分类](phase5-final-npm-triage.md)和执行根`policy-final-npm-classification.json/.md`，已与最终npm JSON全99条一一核对。初分类仅根据现存日志，未修复或重跑；79行为失败仍未区分生产缺陷与测试前提，不能标“过时前提已确认”。

| npm分类 | 真实失败条数 | 裁决 |
|---|---:|---|
| 其它超时，根因未定 | 11 | 未获豁免；未关闭，阻塞交付 |
| 测试扫描前提 | 2 | 未获豁免；未关闭，阻塞交付 |
| 行为失败，生产缺陷/测试前提尚未区分 | 79 | 未获豁免；未关闭，阻塞交付 |
| 测试夹具初始化缺口 | 3 | 未获豁免；未关闭，阻塞交付 |
| 已批准内容缺口 | 2 | 已批准非阻塞，保首败与exit1 |
| 已批准N2性能调查 | 1 | 已批准非阻塞，保首败与exit1 |
| 测试清单前提 | 1 | 未获豁免；未关闭，阻塞交付 |

另5个空describe套件错误（不计入99条assertion失败）：`u_13_combat_math.test.ts` / `u_19a_machine_view.test.ts` / `x2e_charms.test.ts` / `x2o_horde_clump.test.ts` / `x4_r1_world_catalog.test.ts`。原log明确`No test found in suite`，均为CE组清理后遗留空describe；文件内仍有项目测试，故静态“非空文件”检查和完整发现通过不能消除此错误。清理报告“无空测试文件”不等于运行时无空套件。

正常ext全部5项原首败（与npm同名失败重叠，不累加）：

| npm ID / 文件 | 用例与首败 | 本轮结论 |
|---|---|---|
| NPM-036 / `src/test/phase4a0_spatial_differential.test.ts:141` | `exact pre-migration graph: narrative`；完整graph/snapshot深等失败，例blink graph期望e10a1e…、实际a7b27a…；level graph对象44799→44801 | 根因未区分；不是已批准内容缺口，不能直接换黄金 |
| NPM-037 / 同文件:141 | `exact pre-migration graph: growth+narrative`；例blink graph期望f9f4c8…、实际0a2c48…；level对象46520→46522 | 根因未区分；保完整差分，阻塞 |
| NPM-090 / `src/ext/modules/combat/tests/combat2_links.test.ts:47` | `C2-NAT optional giants target and public growth skill share a genuine origin and complete persistence`；`giantHit=false`而原断言true | 已批准giant自然有效命中证据缺口；本轮仍真实失败、原断言未skip |
| NPM-091 / `src/ext/modules/combat/tests/combat2_natural.test.ts:81` | `C2-NAT bounded original-world capture or complete compact-trace replay`；NPC release集合缺`combat.anchor-break`，definitions映射zombie | 已批准zombie自然出招证据缺口；本轮仍真实失败、原断言未skip |
| NPM-098 / `src/ext/modules/narrative/tests/narrative2_imports.test.ts:176` | `has exact test discovery membership without duplicate, stale or omitted tests`；期待`drift/gen/test`，实际`drift/test` | 新政策已删gen而守卫仍硬编码旧入口，确证清理前提缺口；不能称此导入/发现守卫全部通过 |

npm NPM-097 N2七包`installed NPC/persistence lifecycle`原900000ms超时，属于已批准性能调查，仍记npm失败；同批ext该原九行完整文件9项通过，七包588337.267ms，通过结果独立保留，不能覆盖npm首败或证明性能根因。N2旧探针只551/1620事件且监督异常，未确证产品热点或纯路线过重，不重复探针、不缩测、不放宽timeout。其它11项npm超时均未自动豁免。

npm失败而ext同名通过共11项：ext_module_composition四个组合、combat_combinations五个组合、N2七包和bone.clerk两结局奖励；完整名单保执行根`policy-final-delivery-v1.npm-ext-overlap.json`。不同suite的成功与首败分列，不相互覆盖，不累计重复用例。原内容群体handled缺口仍待证，本轮不增加获准范围。

## 真实skip、todo与声明原因

正常npm的9个真实skip：P2-1四项（两历史基线＋恒速过渡期B1/B3）、P2-2两历史基线、P2-3两历史基线（旧相位快照退役）、C5_PERF性能观察1项。理由在对应文件既有注释；本轮未改skip。正常ext只有同一C5_PERF性能skip；`process.env.C5_PERF !== '1'`，不是缺包声明或内容豁免。

npm5todo：smoke hordes重提取占位1项；CombatFormulas的weaponSlowDuration/weaponConfusionDuration/weaponImageCount/weaponForceDistance旧CE公式占位4项。均未执行、未称通过，仍在原JSON/log中；ext/drift/全删ext todo=0。XP功能按既定决策保持skip/disabled，不将产品XP禁用冒充这9个Vitest skip中的另一个已执行用例。

全删24skip中**23个声明文件组**与`test-dependencies.json.required`逐项相同；组名均为`Declared test dependencies missing: <具名模块> (<文件>)`，不是执行原N个断言后skip。其余1个是正常树也已有的C5_PERF性能skip，单列，绝不说24个全来自required。正常树七包齐全时无声明组skip，原断言实际运行（即使失败仍保留）。

| 全删声明组文件 | 缺少required包 / 具名原因 | 正常npm实际原断言 |
|---|---|---|
| `src/test/ext_actor_actions_root_world.test.ts` | required：combat；物理目录已删除 | 11过/0败，原断言执行 |
| `src/test/ext_combat_adapter_foundation.test.ts` | required：growth；物理目录已删除 | 28过/0败，原断言执行 |
| `src/test/ext_combat_transition_facts.test.ts` | required：combat, giants, growth, narrative；物理目录已删除 | 2过/0败，原断言执行 |
| `src/test/ext_compatibility_diagnostics.test.ts` | required：narrative；物理目录已删除 | 10过/0败，原断言执行 |
| `src/test/ext_departure_runtime.test.ts` | required：combat, giants；物理目录已删除 | 12过/0败，原断言执行 |
| `src/test/ext_edible_review.test.ts` | required：combat, giants；物理目录已删除 | 42过/0败，原断言执行 |
| `src/test/ext_edible_runtime.test.ts` | required：growth；物理目录已删除 | 61过/0败，原断言执行 |
| `src/test/ext_fire_contact_runtime.test.ts` | required：crafting；物理目录已删除 | 22过/0败，原断言执行 |
| `src/test/ext_foundation_boundary_audit.test.ts` | required：combat, crafting, foraging, giants, settlement；物理目录已删除 | 8过/0败，原断言执行 |
| `src/test/ext_foundation_retirement_atomicity.test.ts` | required：combat；物理目录已删除 | 6过/0败，原断言执行 |
| `src/test/ext_foundation_world_repair.test.ts` | required：combat, crafting, foraging, giants, growth, narrative, settlement；物理目录已删除 | 2过/0败，原断言执行 |
| `src/test/ext_generation_actor_identity.test.ts` | required：combat；物理目录已删除 | 11过/0败，原断言执行 |
| `src/test/ext_rest_point_runtime.test.ts` | required：combat；物理目录已删除 | 26过/0败，原断言执行 |
| `src/test/ext_stats_review.test.ts` | required：combat, growth；物理目录已删除 | 29过/0败，原断言执行 |
| `src/test/ext_world_work_review.test.ts` | required：combat；物理目录已删除 | 24过/0败，原断言执行 |
| `src/test/ext_world_work_transactions.test.ts` | required：combat；物理目录已删除 | 26过/0败，原断言执行 |
| `src/test/phase4a0_spatial_differential.test.ts` | required：growth, narrative；物理目录已删除 | 2过/2败，原断言执行 |
| `src/test/phase4d_body_lifecycle.test.ts` | required：combat, growth；物理目录已删除 | 17过/0败，原断言执行 |
| `src/test/phase4d_declarations.test.ts` | required：combat；物理目录已删除 | 5过/0败，原断言执行 |
| `src/test/phase4d_effects_rewards.test.ts` | required：combat, growth；物理目录已删除 | 8过/0败，原断言执行 |
| `src/test/phase4d_production_body.test.ts` | required：combat；物理目录已删除 | 21过/0败，原断言执行 |
| `src/test/phase4e_body_transition.test.ts` | required：combat；物理目录已删除 | 40过/0败，原断言执行 |
| `src/test/phase4e_recording.test.ts` | required：combat；物理目录已删除 | 6过/0败，原断言执行 |

`phase4a0_spatial_differential`正常原2过/2败仍保留；全删后因实际required缺包跳过该文件组，不用其skip覆盖正常失败。正常树内容2败没有静默skip或文件exclude。

## 全删实物、128与真实同版本输入

prepare-only真实exit0但原报告持续`prepared-not-verified`，只表示准备成功。删除combat93/crafting42/foraging47/giants52/growth71/narrative79/settlement73文件，共7目录/457文件；核所有权与剩余发现，并由本执行者再次只读确认目录实际不存在。剩余发现400文件，依赖JSON逐文件400完全相同；全部剩余ext113发现完整。原plannedGates六项全部由外部runner逐项执行exit0，再独立真实输入拒绝exit0，完整前后输入哈希相同，因此可陈述本轮全删要求通过，不能拿prepare报告单独证明通过。

正常smoke128唯一模块集合，各组合exactCheckpoints/saveLoad/replaySeek/continuation均true；七包组合含正常真实D2贡献出生、59事件及60续录事件。全删smoke全开/全关去重为1，各生命周期字段true。两个JSON`engine.status=passed`、`requestedScopePassed=true`、总`passed=false`（浏览器not-run），此false不能偷改为全面通过。引擎检查不能代替桌面/移动/实际built UI验证。

七包缺包拒绝输入为**本轮正常候选真实Game生成**：每包单独安装、seed7301/test模式、两个公开wait，当前save版本6/recording版本4；正常树逐组loadSnapshot/loadReplay实际接受。无需自然搜索，未伪造manifest、未沿用旧输入。raw gzip在执行根，解压每组约1.92MB；本执行者逐组SHA/字节数和版本重核全部一致。

| 真实输入包 | raw SHA256 | 缺包save/recording/活局 |
|---|---|---|
| combat | `0e0120384f640ae33625632bc8f9c87674c6605ce22066fc0da2a4c3fca1c86b` | false拒绝 / false拒绝 / 完整活局保持 |
| crafting | `196e03ddd33f24dbad51b36a419798df0ec42f6bca7448ef5f40d21e7b791def` | false拒绝 / false拒绝 / 完整活局保持 |
| foraging | `17544c3c10599cd9f7276ab697165ea29bf5e4a573b4dbb5538732fd6905f49f` | false拒绝 / false拒绝 / 完整活局保持 |
| giants | `2b99c1224fa8d60760752fd88153e4a85090d731f7a0cb8174acb81a0110aa48` | false拒绝 / false拒绝 / 完整活局保持 |
| growth | `0e8996d32c8d96c73f51b171f77a3596fc4372d60a3bb9bdd2d48dddf3563b42` | false拒绝 / false拒绝 / 完整活局保持 |
| narrative | `41cbf255f4c1317ff56b620d4b985cce114f81dac74179d9de5c89fe2d993492` | false拒绝 / false拒绝 / 完整活局保持 |
| settlement | `159c771c4a3c3231cc26cd1564ddb3be45f9b22a371a27ffa5a221f1ea18b327` | false拒绝 / false拒绝 / 完整活局保持 |

真实拒绝逐组核完整快照、录制events、双RNG、allocator及六个活根对象身份；允许的拒绝提示logger差量在比较前按原方法归一，不能称连提示日志都逐字不变。全部七组没有成功导入缺失包。另classic seed7301/test无extensionRuntime，2事件存读/回放/seek0、1、2与3事件续录/完整回放通过，mechanical whole root及双RNG保持。上述合法性/拒绝/生命周期仅是此短真实输入边界，不能替代自然长局1620事件或浏览器。

## 人工交付与父接续

[最终候选人工清单](phase5-final-policy.manual-checklist.md)已准备，Claude无回执，桌面/移动/真机与模块UI、完整存读回放seek续录、缓存冻结、seed23/118原安全prefix等全部待验。XP skip、5D3另案、Z1-A不主动CEfetch/full/gen；不发动新人工模型。

本执行者交父`policy-final-delivery-v1.BLOCKED.md`/`final.md`，dispatch/monitor明确delivery READY=false、未提交/未remote验证及路径。quick-check已保summary/done，并补stage实物标记。父负责面向用户裁决未关闭项和后续流程；本执行者结束模型轮次，不依赖父CLI resume、不重試active-writer、不停止父尚未完成的自动化、不自动派下一步。任何需重负载的后继只能由父另行授权并使用launch-detached新OS session/nohup/run-child/文件stdin-out/done，本报告不启动它。
