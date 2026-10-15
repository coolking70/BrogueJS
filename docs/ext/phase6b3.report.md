# 6B3 实施报告

日期：2026-10-15；分支 `ext/phase6`；开工及未提交候选的父HEAD `944615f45a2647af6a197f621ffac6f31c9ea6f3`。初始工作树干净，单主笔；没有commit/push。B3-D1..D7全A已先写入任务单；D7由维护者侧Claude执行三档浏览器，主笔交清单。数值平衡整体延期。

实现及正常树限定门禁已收口；R1-F1作者修复与复验见“审查发现处理”节，尚未宣称独立复审关闭。唯一全移除行结果见下文（本轮未重跑）。**浏览器三档未执行，待维护者验收**，不宣称阶段6或平衡完成。没有需要新增维护者裁定而无法继续的事项。

## 分步交付及权限

| 步骤 | 实际交付与证据 |
| --- | --- |
| B3-0 | 任务单记入已批准A、D7责任和版本批次；[实施合同](phase6b3-contract.md)列选择状态、DTO、公式、cap/前置/快照、失效/知识/写集及贡献schema |
| B3-1 | descriptor软推荐、通用纯选择器、菜单原因/拒绝/恢复；精确集合入口不隐式补包；推荐解析、真实SFC、新局3预设+growth批次与坏批次保活局测试 |
| B3-2 | 完整属性ID能力、受限Stat根、全provider基础→派生两阶段；knownOnly先过滤根；禁止缺键、回边、条件根、超预算；原缓存/物化/纯函数守卫保持 |
| B3-3 | loot正式发现真实属性/专注/XP键，fallback保留；sage/adept装备提交与scholar实际XP递增提交逐行揭示；角色永久/来源/有效cap、已知比较和预览；过时符文文案及生产注释改6B4 |
| B3-4 | 通用content贡献汇总及growth领域严格适配；职业/树/既有属性有限规则，无新执行器或持久树状态；b3fixture正负路径、保存/读取、通用组件SSR名称/树渲染，生产外部贡献为空 |
| B3-5 | 明列相关文件分批测试、boundary/依赖/vue-tsc/build、唯一全删布局与当前导出拒绝；[三档浏览器清单](phase6b3.browser-checklist.md)交维护者，历史6B2结果不冒充本次 |

共享改动最小边界：`descriptor/catalog/selection/ui/creation/MainMenu`只管理新草稿；`attributeCatalog/stats/runtime`只提供声明式根→下游和自身组件正增收据；`content/registry/types`只提供有预算的纯数据组装；`Game.equipItem`转用通用真实装备知识提交。没有给模块新增原生写权、递归stats入口或任意脚本入口。角色点数/身份/技能仍由growth原命令写自身组件；装备只写原Item知识，不回写永久属性。Game未新增字段，无U03字段登记差量。

完整实际文件范围为本工作树diff：共享底座/菜单/locale、growth属性/技能快照/领域组装/读模型和组件、loot能力/比较/读模型、测试及测试清单、任务/现行合同/本报告。`docs/ext/stats-config.md`、`growth-config.md`、C6及loot两合同追加当前差量，未重写旧报告结论。

## 当前版本与确定性证据

生产growth定义JSON只变moduleVersion/rulesVersion，去掉这两字段与HEAD深比较完全相同；loot的16份静态JSON逐字节未变。没有调整怪物/成长/掉率/词缀/XP/成本/技能数值。数据检查及三个SDK SHA在仓外 `data-sdk-check.json`。

| 身份 | 当前值 / 真实差量 |
| --- | --- |
| foundation | 15→16：属性根/两阶段派生、正增知识收据、内容组装合同 |
| growth module/rules | 1.8.0→1.9.0；原数据schema1；非空贡献有独立schema1，生产为空 |
| loot module/rules | 0.3.0→0.4.0；静态pack0.1.1、state1、实例v1不变 |
| whole-run / recording / origin | 7 / 4 / 2；未加持久字段，无旧档迁移 |
| world5 / worldSdk / edibleSdk / itemSdk | schema4 / 1 / 1 / 1；三个SDK与HEAD逐字节一致，没有新增导出权限 |

当前自然见证为 **seed26、wizard、growth+loot、standard**：真实初始创建→地图行走/战斗/拾取→自然adept装备/卸装→升到L2、XP64→体质分配1点，剩AP0/SP1，D2保存。保存前125个事件，续录追加escape后126个事件；save/load同digest，完整录像zero OOS，半程/末尾seek，载档续录再完整回放通过。`current-save.json`和`current-recording.json`是原方法当前真实命令导出，没有编辑manifest；文件均在仓外。wizard仅用于可靠功能见证，不代表普通模式难度验收。

显式loot单开fallback自然路线、真实击杀/鉴定/分解与录像继承由原 `loot_integration` 原断言通过；其256摘要/2048快照边界、2049输入seek/续录也通过。受控场景单列：合法adept/sage/scholar戒指、HP1的自然出生rat击杀、模拟首次层/辨识奖励钩子；这些用于端口/知识/数值边界，不宣称为自然掉落录像。XP封顶负例使用测试专用L1上限并同步合法前置/发点表，生产数据不变。

独立算例：训练双戒3+3合并cap4，knownOnly先剔除未知一枚得到3，永久values/allocated不变；敏捷攻方+100bp、守方−50bp而accuracy不变；意志双戒1+1跨floor后专注+1；体质+1派生生命+3且不补当前HP；施放时有效意志3被捕获，卸装后属性0而已施放source仍为3。未知体质的角色/分配预览不包含隐藏生命增量，纯读取完整对象图及RNG/ID不变。

注册准入另限制每个外部职业的直接/誓约效果合计16、全部属性效果64，避免合法JSON直到运行时才撞上256行预算；新增超预算负例通过，生产空贡献及规则数值未变。

内容fixture经公开descriptor组装进入创建、赠技/学习、树、属性规则和save/load；拒绝重复ID、越权ID、悬空引用、树环、非法端口/预算/字段、缺receiver及同版本不同目录指纹。原12技能、4职业、4血统、4信仰继续使用既有数据，外部fixture只在测试安装。SSR验证通用组件真实文本/Teleport内容；Input为SSR隔离桩，不能代替焦点/键盘/浏览器验收。

## 正常树最终限定结果与失败归因

下表是逐批日志，**不将重叠复验相加**。无`-t`的批次未选=0；全部todo/unhandled=0，声明依赖skip=0。退出1的行保留历史失败，按修复后的相关文件结果裁决，不抹掉失败日志。所有路径以 `/private/tmp/phase6b3/` 为根。

| 日志 | 文件结果 | 测试结果 | exit / Vitest耗时 | 首败及关闭方式 |
| --- | --- | --- | --- | --- |
| final-foundation.log | 6过1败 | 144过1败 | 1 / 28.59s | 旧测试假设growth能力永远缺席；反事实后仅改缺席场景启用集合 |
| final-growth-rules.log | 10过1败 | 319过1败 | 1 / 49.19s | 新封顶夹具的技能前置高于测试L1 cap；修合法夹具，原schema不改 |
| final-growth-lifecycle.log | 6过1败 | 72过1败 | 1 / 36.82s | 原SFC夹具调用已替换的v-model事件；反事实后改用change事件 |
| final-loot.log | 10过1败 | 169过1败 | 1 / 125.63s | 同类菜单事件夹具；机械/触发/自然录像原断言均通过 |
| final-guards.log | 4过1败 | 39过1败 | 1 / 15.63s | 新动态i18n调用不可扫描；修生产调用形式，不改扫描器/守卫 |
| final-recheck.log | 9过1套件载入失败 | 153过；content未载入 | 1 / 79.34s | 上述旧前提、i18n及新知识/快照全部通过；新SSR测试静态导入Input需要window，改SSR局部输入隔离 |
| final-content-journey.log | 1过1败 | 22过1败 | 1 / 44.87s | 新3预设与13项成长loot链全部过；SSR断言取错Teleport容器，改读SSR teleports.body |
| close-content.log | 1过 | 10过 | 0 / 5.48s | 内容组装、负例、保存/学习及中文组件渲染全部通过 |
| content-budget-final.log | 1过 | 11过 | 0 / 5.64s | 最终补充职业效果准入预算；含原全部内容用例 |

最终静态门禁前 `budget-close-content.log` 再验11项全部通过（exit0，命令墙钟13.52s），身份probe亦exit0；不累加重复覆盖。

复验命令（其余五批完整文件清单见文末）：

```sh
node node_modules/vitest/vitest.mjs run src/test/ext_item_stats.test.ts src/test/ext_stats_runtime.test.ts src/ext/modules/growth/tests/ext_growth_creation_ui.test.ts src/ext/modules/loot/tests/loot_game_sfc.test.ts src/ext/modules/growth/tests/ext_growth_content.test.ts src/ext/modules/growth/tests/ext_growth_loot_receipts.test.ts src/ext/modules/loot/tests/loot_growth_attributes.test.ts src/ext/modules/growth/tests/ext_growth_ui.test.ts src/ext/modules/growth/tests/ext_growth_descriptions.test.ts src/test/p1_30_i18n_gate.test.ts --maxWorkers=2
node node_modules/vitest/vitest.mjs run src/ext/modules/growth/tests/ext_growth_content.test.ts src/ext/modules/loot/tests/loot_growth_attributes.test.ts --maxWorkers=2
node node_modules/vitest/vitest.mjs run src/ext/modules/growth/tests/ext_growth_content.test.ts --maxWorkers=2
```

生产修复还包括：gainReceipts必须有本组件validator，补progression原验证器；两阶段累计仍受原256行预算约束；根忽略调用者baseValue，避免根查询与派生不一致；已知技能预览与施放使用有效属性；外部文本保留完整命名空间。均没有放松守卫、时限、容差或原断言。

### 旧测试单变量反事实

隔离工作目录 `/private/tmp/phase6b3-counterfactual`，复制当前候选，仅对本次变更的已跟踪生产文件恢复HEAD，测试保留原样；新生产文件不参与旧路径。回退文件清单为 `counterfactual-production*.json`，源工作树未回退。这不是全移除布局。

| 原测试/筛选 | 反事实结果 | 仅调整的前提 |
| --- | --- | --- |
| ext_module_creation_ui + ext_growth_combat_stats（整文件） | 13过，exit0，10.59s | SFC导入selection；纯provider夹具适配基础+派生；批准版本1.9.0 |
| loot_capabilities -t 'uses actual combat keys' | 1过，5未选，exit0，3.96s | 将缺growth fallback场景改为启用loot+combat；原缺席断言保留 |
| ext_item_stats + growth/ext_growth_creation_ui + loot/loot_game_sfc；-t 'combat capability discovery\|explicitly empty installed\|D7 growth confirmation' | 3过，39未选，exit0，6.79s | 缺席场景去掉growth；两个checkbox事件夹具改change；所有行为断言保持 |

新增覆盖同时证明growth启用时能力真实可用、完整创建推荐链与显式退出，不用旧缺席断言掩盖新行为。跨模块依赖声明随实际启用前提更新；没有修改任何守卫脚本/扫描器。

### 早期分步日志

以下也保留，不能替代最终结果；`-t`造成的skip在此记“未选”，beforeAll故障造成的skip单列未执行。命令统一 `node node_modules/vitest/vitest.mjs run <文件> [筛选] --maxWorkers=2`，用下列短名定位同名测试；shared在src/test、growth/loot在各模块tests。

| 日志 / 精确文件短名 | 结果 / exit / 秒 | 原因 |
| --- | --- | --- |
| initial-related；ext_stats_pipeline、ext_stats_runtime、ext_growth_attributes、ext_growth_progression、loot_stats_integration | 99过23败 / 1 / 17.24 | 正增收据缺progression组件validator；补生产验证器 |
| attribute-retest；ext_stats_runtime、ext_growth_attributes | 48过 / 0 / 23.34 | 上述关闭 |
| new-core、new-core-2；ext_module_recommendations、loot_growth_attributes | 启动失败，0执行 / 1 | 静态依赖分析不识别模块参数简写；显式参数/调用及依赖声明修正 |
| new-core-3；同上 | 7过 / 0 / 11.02 | 上述关闭 |
| content-stage；ext_growth_content、ext_stats_runtime | 38过1败 / 1 / 8.20 | 新fixture显式身份不能传缺省null；补合法血统/信仰 |
| affected-old；ext_growth_content、ext_module_creation_ui、ext_growth_combat_stats、loot_capabilities | 18过7败，4因beforeAll未执行 / 1 / 24.23 | 旧前提见反事实表；内容奖励需原settled钩子提交 |
| affected-fixed；同上 | 29过 / 0 / 23.64 | 上述关闭 |
| growth-journey；loot_growth_attributes | 6过 / 0 / 33.86 | 首轮自然完整链 |
| supplement；loot_growth_attributes、ext_growth_content、ext_module_creation_ui、ext_stats_runtime | 51过1败 / 1 / 46.94 | 新rat击杀夹具误设caged导致救援；改合法敌对rat |
| scholar-command；loot_growth_attributes -t 'real command kill' | 1过7未选 / 0 / 4.25 | 实际击杀XP揭示通过 |
| caps；ext_growth_loot_receipts、loot_growth_attributes -t 'capped XP\|two training' | 1过1败8未选 / 1 / 4.48 | 新L1夹具发点表firstLevel仍2；同步合法测试前提，后续全文件通过 |

早期types错误均为新增DTO推断/导入/测试回调类型问题，最终vue-tsc关闭；没有为消除错误关闭类型检查。

## 最终静态/构建和唯一全移除

最后文本修复的来源：全删副本的原i18n守卫发现共享Game/ResidentProduction/SettlementRaids/StructureProduction直接引用被删settlement的文案（5个静态键和1个动态前缀）。这是删除后留下的生产引用，未改守卫。将引擎实际使用的10条相同文案复制到共享 `ext.world.resident.* / ext.world.raid.*` 并更新共享调用；模块自身UI文案保留。只有文案所有权变化，没有袭击/居民规则或SDK变化。同步文件清单见 `removal-sync.json`；复验使用同一个副本。

正常树 `locale-normal.log`：p1_30_i18n_gate、u24_hardcoded_text 两文件29过，exit0，14.28s。文案修复后再次通过自然成长链原捕获：`sealed-export.log`，`loot_growth_attributes -t 'natural growth' --maxWorkers=2`，1过12未选，exit0，30.60s；最后导出含合法时间元数据，未编辑文件。此后仅收紧外部内容准入预算，生产空贡献、目录身份及该自然路线输入不变。

| 最后门禁 | 正常树 exit / 命令墙钟秒 | 全删副本 exit / 命令墙钟秒 |
| --- | --- | --- |
| `node scripts/check-module-boundaries.mjs` | 0 / 11.01 | 0 / 7.8 |
| `node scripts/check-test-dependencies.mjs` | 0 / 6.9 | 0 / 5.57 |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 0 / 17.7 | 0 / 11.78 |
| `npm run build` | 0 / 31.67 | 0 / 21.92 |

正常树最终预算收紧后日志为 `budget-close-{boundary,dependencies,types,build}.log`，记录器 `budget-close-gates.json`；全删副本仍为 `sealed-removed-{boundary,dependencies,types,build}.log` / `sealed-gates.json`。最后改动仅在已删除的growth目录，保留代码逐字节一致，未再建全删布局。命令逐项与表一致。build仅有既有大chunk提示，exit0；没有新增构建错误。早期正常discovery/boundary/依赖/types/build亦有exit0记录，不能重复计为更多覆盖。

实际准备命令：

```sh
node scripts/check-module-removal.mjs --profile=removal --retain=none --prepare-only --engine-only --output=/private/tmp/phase6b3-all-removed-20261015-a
```

唯一副本：`/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-CQ2XbC/candidate`。真实删除8目录：`src/ext/modules/combat`, `src/ext/modules/crafting`, `src/ext/modules/foraging`, `src/ext/modules/giants`, `src/ext/modules/growth`, `src/ext/modules/loot`, `src/ext/modules/narrative`, `src/ext/modules/settlement`。发现器由663测试文件变为409，删除254份模块自有测试；剩余owner一致，installed=[]，没有空壳、桩目录或白名单。准备输入hash `9ad44341d9aed1c2b879d94ce164d25f5bd7cb984dac98207606a4b256f4b25b`；原runner状态始终保留 **prepared-not-verified**，不将准备当通过。限定结果另存 `removed-gates.json` 和 `sealed-gates.json`。

副本相关批次精确命令：

```sh
node node_modules/vitest/vitest.mjs run src/test/ext_module_recommendations.test.ts src/test/ext_module_creation_ui.test.ts src/test/ext_stats_pipeline.test.ts src/test/ext_stats_native.test.ts src/test/ext_stats_runtime.test.ts src/test/ext_stats_review.test.ts src/test/ext_item_stats.test.ts src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/test_suite_membership.test.ts --maxWorkers=2
```

`removed-related.log`：7文件过、1败、2声明跳过；130过、2败、2跳过占位，exit1，21.68s。仅i18n两项缺键/空前缀失败，修生产文案后同副本 `sealed-removed-locale.log`（p1_30_i18n_gate、u24_hardcoded_text）29过，exit0，12.42s；其余已过文件不重复跑。声明跳过为 `ext_stats_review`（缺combat/growth）、`ext_item_stats`（缺combat），是整个文件的具名依赖跳过，不把占位2项算机械测试通过。无其他skip、未选、todo或unhandled。

`removed-probe.mjs` / `removed-probe.json`：全关真实new→3次wait→保存/加载→续录第4次wait→完整replay/seek[0,1,4]通过；当前growth+loot输入缺包拒绝，活局对象图、双RNG、ID、录像保持，exit0、7.72s。最终导出再由 `removed-missing-final.mjs` 专门拒绝验证（不重跑组合矩阵）：真实当前save7/recording4/foundation16、growth1.9.0/loot0.4.0，无manifest改写；完整对象图、双RNG、ID、录像不变且活局能继续escape。首次补充probe比较两次带 `savedAt=Date.now()` 的序列化误报，仅测试时钟固定后复验；保留 `removed-missing-final-first.*`，未更改生产或剔除状态断言。

## 审查发现处理：R1-F1（2026-10-15）

**作者已修复并完成限定复验，待独立复审。** 原独立审查结论保留在 [审查记录](phase6b3.review-findings.md)，未编辑该记录或冒称审查者关闭。R1基线源码scope为 `c71ba83e93f954ccc4b541f07b53a51469a7a003e4c9dda58c169a3964aacd6d`；本节结果覆盖此前默认配置验证未发现的合法自定义配置缺口。

生产改动仅 `src/ext/modules/growth/skills.ts:isGrowthSkillBuild`：source是施放时的有效属性快照，验证完整属性键集、非负安全整数、每项属性cap及训练cap；移除误套的永久 `attributeTotalCap` 和永久 `attribute.min`。与属性目录/Stat根的minimum=0、maximum=min(属性cap,训练cap)一致。效果ID、来源、等级、标签、期限与消费等原校验保持；永久values/allocated的min、总cap、支付和前置限制保持。没有修改配置数值、规则公式、生产JSON、持久字段或版本；不重录黄金trace，未修改守卫。

同类位置审计：所有生产 `attributeTotalCap` 使用点已逐项核对。`attributes.ts`/`state.ts`校验永久组件及投资；`identities.ts`/`templates.ts`分配创建/出生/继承的永久预算；`schema.ts`检查初始及身份赠予，`view.ts`约束创建选择；均应保留。`module.ts`的duration/cooldown/施放source及`statSources.ts`派生读取有效根，未再把有效值传入永久属性验证器。另在本次快照校验中发现的永久min混用一并修正，并补正min配置的零有效值正例。

回归及复现：

- `ext_growth_skills`新增边界用例：合法cap4配置下快照可达各项有效cap；永久min=1时有效值0合法；负值、小数、超单项cap、超训练cap、不安全整数、缺键/多键仍拒绝。永久属性的超总cap/低于min仍拒绝。
- `loot_growth_attributes`新增真实链：seed42/wizard、growth+loot，scout+stoneborn+unaffiliated永久总和3；测试专用合法T6 +3意志戒指由`deriveNativeFacts`组装，真实equip和use-skill屏息生成总和6的source。装备后和施放后均存读成功；完整回放zero OOS、施放前/末尾seek、载档卸装、快照仍保留意志3、再次存读和续录完整回放通过，永久组件始终不变。
- 装备是测试专用首层场景注入，所有实时/回放/seek临时Game按同一场景重建；并非自然掉落见证。生产存读、录像和技能执行未mock。
- 最终两项回归保持原样、仅临时回退本轮生产验证器：`final-regression-before-fix.log`为2失败/43未选，exit1；集成用例准确失败于施放后读档。恢复修复后`fixed-scene-2.log`为2通过/43未选、exit0、14.24s，最终完整相关批次结果见下表。未改旧测试断言或前提，无旧断言反事实修订。

运行环境Node **v24.19.0**、`NODE_OPTIONS=--max-old-space-size=3072`；Vitest `--maxWorkers=2`，串行。证据目录 `/private/tmp/phase6b3-r1/`，精确命令见 `commands.json` / `gates.json`。相关测试未选/skip/todo/unhandled均0；不累加定向复验：

```text
Test Files  8 passed (8)
      Tests  103 passed (103)
   Start at  13:46:56
   Duration  53.78s (transform 3.15s, setup 0ms, import 8.57s, tests 92.51s, environment 2ms)
```

| 最终日志 | exit | 命令墙钟耗时 |
| --- | --- | --- |
| `related.log` | 0 | 62.13s |
| `boundary.log` | 0 | 11.15s |
| `dependencies.log` | 0 | 6.88s |
| `types.log` | 0 | 17.29s |
| `build.log` | 0 | 31.8s |

```sh
node node_modules/vitest/vitest.mjs run src/ext/modules/growth/tests/ext_growth_attributes.test.ts src/ext/modules/growth/tests/ext_growth_skills.test.ts src/ext/modules/growth/tests/ext_growth_skill_integration.test.ts src/ext/modules/growth/tests/ext_growth_public_effects.test.ts src/ext/modules/growth/tests/ext_growth_templates.test.ts src/ext/modules/growth/tests/ext_growth_clone_overhealth.test.ts src/ext/modules/growth/tests/ext_growth_npc_replay.test.ts src/ext/modules/loot/tests/loot_growth_attributes.test.ts --maxWorkers=2
node scripts/check-module-boundaries.mjs
node scripts/check-test-dependencies.mjs
node node_modules/vue-tsc/bin/vue-tsc.js -b
npm run build
```

探索失败单列保留：`reproduce.log`是新夹具尚未合法（正min需同步测试poise baseline、测试命令被原输入门拒绝）；修夹具后`reproduce-valid.log`2项准确复现缺陷。`fixed-focused.log`为1通过/1失败：测试命令闭包捕获原Game，seek临时Game出现OOS；改为按各Game重建首层场景，`fixed-scene.log`首次漏排除构造器经典空runtime，修夹具后`fixed-scene-2.log`全部通过。以上均未放松生产校验、断言或时限。最终build仅既有大chunk提示。

当前源码/dist身份已更新到下方“最终候选身份”，文件级指纹在本轮`final-hashes.json`；原默认配置存档/录像证据保留不改。此前全移除属于原限定结果，本轮按指令不重跑、不新增布局；本次生产/测试改动均在该副本已删除的growth/loot目录。浏览器三档仍由维护者执行，本轮不跑全量、CE、drift、数值平衡或全移除。没有commit/push。

## 最终候选身份与交付边界

- 源码scope SHA256：`d4ed28375f215f6cc825b9193a7504260bb4367fa0bfb721504f3fc42dd0caf8`（1487文件）。scope=src、scripts、public及package/package-lock/vite/三份tsconfig；逐路径排序，每文件SHA再hash `path\0sha\n`。不含docs/self-report、dist、node_modules、.git，避免报告自引用。
- dist SHA256：`3c952e2a8c276efdf184081e7aedabbc177460a9026201447e8014636a89cb6c`（61文件，同一规则含dist相对路径）；完整文件清单 `/private/tmp/phase6b3-r1/final-hashes.json`（R1修复后重新构建）。
- growth静态/生产空注册有效rules：`sha256:75f3e6cac555b6d774b6461e2ed2e6f2c586aeedd6eb47983eb9e83aa742c39f`。
- 属性目录：`sha256:368462be0a54bbb20c8aa647015fec9c68ebbcc650b9bf49082141dd4b9bf9c4`，rulesFingerprint指向上述growth规则。
- loot静态pack：`sha256:7785d8e68e6486bd422e40c6a3f0d317b102683116dcea8e483f2256d9c84fd2`；growth+loot有效词缀目录：`sha256:fbad13aad5284fcfecb39554cf73bf27c22b49ca2c019d87a859c88c6b20ab62`。目录不因三预设改变；预设进入独立run configuration/rules身份。

| loot预设 | rules fingerprint（module/rules0.4.0，schema1） |
| --- | --- |
| scarce | `sha256:0253eee332eb4aab6f4414673ee17e7007ff74a77cab747075bd4c4b54ead8da` |
| standard | `sha256:37210b065d7ded0e2f3a45adb419ea61ade435f515b06abb3048bf792ca21f1a` |
| bountiful | `sha256:d5abde22df7bd9355253df8453e897cf1440a49971da52eb9e4838005ad420b2` |

原交付默认配置导出SHA256（R1未重录）：save `9f50781fc3ff6d9aceebbb88f6ffc82336651b9e2ff1f1a44bd7c39d327208be`，recording `fe26f2b5a2cec60c59f95d5f07c48eed21a547b87ffe0c246c21b78c67789efb`；原始文件和逐文件记录在仓外证据目录。

精确manifest/config、属性目录DTO见 `identity.json`；源码/生成物/规则/locale身份分开，没有把pack版本当module版本。worldSdk、edibleSdk、itemSdk与HEAD逐字节相同，证据 `data-sdk-check.json`。

[维护者浏览器清单](phase6b3.browser-checklist.md)已按320×568、800×900、1440×900列9项（共27格）操作和证据要求，均标“未执行，维护者执行”。这是约定的交接责任，不是工具失败或重复请求许可；主笔不把SFC/SSR/无头自动结果写成浏览器通过。

未运行完整npm test、全部test:ext、drift、CE/full/gen、组合矩阵、300局/TTK/EHP或长局性能。未做6B4强化/精炼/符文强度/随机符文，未做6C，也未新增生产职业内容。相关限定门禁通过只覆盖本报告范围；数值平衡仍延期。原始日志、存档、录像留仓外，不提交截图或大于1MiB证据。没有commit/push，交维护者复核后停止。

## 最终门禁预列

采用Node24、NODE_OPTIONS=--max-old-space-size=3072；每批Vitest --maxWorkers=2，批次串行。以下文件清单在执行前冻结。静态门禁为discovery、boundary、依赖检查、vue-tsc -b及npm run build；全移除只准备一份布局，单列结果。不跑全量/CE/drift/组合矩阵。

### foundation：推荐/创建及共享属性管线、原生物化/装备预算

```sh
node node_modules/vitest/vitest.mjs run src/test/ext_module_recommendations.test.ts src/test/ext_module_creation_ui.test.ts src/test/ext_stats_pipeline.test.ts src/test/ext_stats_native.test.ts src/test/ext_stats_runtime.test.ts src/test/ext_stats_review.test.ts src/test/ext_item_stats.test.ts --maxWorkers=2
```

### growth-rules：属性数学、实际派生、内容注册、永久前置与技能施放

```sh
node node_modules/vitest/vitest.mjs run src/ext/modules/growth/tests/ext_growth_attributes.test.ts src/ext/modules/growth/tests/ext_growth_progression.test.ts src/ext/modules/growth/tests/ext_growth_evaluator.test.ts src/ext/modules/growth/tests/ext_growth_combat_stats.test.ts src/ext/modules/growth/tests/ext_growth_config.test.ts src/ext/modules/growth/tests/ext_growth_content.test.ts src/ext/modules/growth/tests/ext_growth_loot_receipts.test.ts src/ext/modules/growth/tests/ext_growth_identities.test.ts src/ext/modules/growth/tests/ext_growth_identity_runtime.test.ts src/ext/modules/growth/tests/ext_growth_skills.test.ts src/ext/modules/growth/tests/ext_growth_skill_integration.test.ts --maxWorkers=2
```

### growth-lifecycle：已知视图、创建、效果快照、克隆/形态/药水

```sh
node node_modules/vitest/vitest.mjs run src/ext/modules/growth/tests/ext_growth_view.test.ts src/ext/modules/growth/tests/ext_growth_creation_ui.test.ts src/ext/modules/growth/tests/ext_growth_creation_view.test.ts src/ext/modules/growth/tests/ext_growth_public_effects.test.ts src/ext/modules/growth/tests/ext_growth_clone_overhealth.test.ts src/ext/modules/growth/tests/ext_growth_body_transitions_rewards.test.ts src/ext/modules/growth/tests/ext_growth_item_runtime.test.ts --maxWorkers=2
```

### loot：真实能力、目录、触发与UI、自然成长/掉落录像以及256/2048边界

```sh
node node_modules/vitest/vitest.mjs run src/ext/modules/loot/tests/loot_growth_attributes.test.ts src/ext/modules/loot/tests/loot_capabilities.test.ts src/ext/modules/loot/tests/loot_catalog.test.ts src/ext/modules/loot/tests/loot_stats_integration.test.ts src/ext/modules/loot/tests/loot_integration.test.ts src/ext/modules/loot/tests/loot_game_ui.test.ts src/ext/modules/loot/tests/loot_game_sfc.test.ts src/ext/modules/loot/tests/loot_review_r1.test.ts src/ext/modules/loot/tests/loot_trigger_settlements.test.ts src/ext/modules/loot/tests/loot_trigger_commits.test.ts src/ext/modules/loot/tests/loot_ui_knowledge.test.ts --maxWorkers=2
```

### guards：i18n、硬编码、卫生、测试归属

```sh
node node_modules/vitest/vitest.mjs run src/test/p1_30_i18n_gate.test.ts src/test/u24_hardcoded_text.test.ts src/test/repo_hygiene.test.ts src/test/test_suite_membership.test.ts src/ext/modules/loot/tests/loot_ui_i18n.test.ts --maxWorkers=2
```

