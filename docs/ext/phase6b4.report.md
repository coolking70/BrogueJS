# 6B4 主笔报告

2026-10-16；分支 `ext/phase6`，起点 `8d7c799`，6B4 功能及 R1 修复现已提交为 `c5863ab`。**R1 三项重要问题均已复现并修复，含存读档的新回归及 14 文件 / 487 项限定测试通过；boundary、依赖检查、vue-tsc、build 通过。B4-5 仍未收口，6B4 P0 待验。** 本地原版对照再次遇到确证 Sleep/DarkWake，首轮作废；尚未取得有效的原版配对及三轮候选计时，未冻结预算。维护者已批准改用 GitHub Actions 同 runner 交错 A/B，入口及本次工具验收见文末“B4-5 云端 A/B 测量”。本次只交付工作流与脚本，未实际触发云端测量，不能给出 D6 性能通过或代码回退已排除的结论。下文保留首轮实施及失败历史；其中“未 commit/push”描述对应历史轮次。本次工具改动未 commit/push、未调数值、未进入 6C；D1–D7 全部 A，D7 浏览器仍待维护者。

## 交付差量

- B4-0：记录强化接受量/精炼抽取/growth收据、目标目录与新版本身份；原 P0 保留，白名单 `--phase6b4` 接入独立基准。没有任意路径、单case、跳过oracle或放宽预算入口。
- B4-1：真实读卷轴只开启选择，成功目标提交才消费一次、解咒、自亮及结算回合；取消、无容量和失败保留卷轴。强化与精炼共享原提交入口，完整世界、双随机流、实体ID和扩展收据失败回滚。growth按目标接受量发收据；0不精炼，多级不越cap，替换其它奖励保留原政策。原生附魔偏移以增量保留，不会恢复被否定/削弱的装备。
- B4-2：四条唯一符文拥有本件L0；武器、护甲、反射、投掷及原生详情统一使用对应管线。整当量×4只转换一次；未知仍生效、knownOnly不泄露；不叠原生净附魔。否定的原生开关不被数据绑定复活。
- B4-3：开启已有21条随机符文族；slaying/immunity使用稳定15类目录、末尾一次目标骰及实例v2持久化。21条实际生成字面骰带覆盖合法可达、≤64骰和目标条件。原数值、T7关闭、词缀阶数/腐化约束不变。首次知识绑定actor/item/type/target与实际效果，只揭示匹配行；失败、无实际变化和重复事实不发布。
- B4-4：游戏面板强化按钮进入原生目标选择；详情、已知比较、目标类名称、满级精炼和无收益文案走i18n。重复点击仅一次提交。三档真实浏览器由维护者执行，[逐项清单](phase6b4.manual-checklist.md)目前全部待验，不以SSR/SFC替代。
- B4-5：限定门禁与唯一全删通过；原P0通过，新版本历史三轮完整回放零OOS且计数稳定；受休眠污染的计时不采纳。现改为云端交错 A/B，接受基准及最终门禁仍待实际云端结果，详见文末。

## 版本与范围

foundation17、itemSdk2；loot module/rules0.5.0、pack0.2.0/schema1、实例v2/state1；growth1.10.0。whole-run7、recording4、origin2不变；新增延迟卷轴ID登记U03与摘要写集。旧开发版本拒绝，不迁移、不伪造旧录像头。静态pack指纹 `sha256:cd6afd51bcbcb6e012f914f073aa637bae6d3e702d9f3aef25022de8713e6590`。源码、构建、SDK及六个预设/growth组合的最终身份另附。

没有运行完整npm test、全部test:ext/drift、CE/full/gen、128/256子集或单删/单留矩阵；没有浏览器、真机、D22+或最大居民/结构性能声明。

## 反事实、固定数据与失败处理

原 `43f115b` 的src与开工 `8d7c799` 相同。仓外原生产树配原28个loot测试为743通过、1个原有失败：inert仍期待module0.2.0，实际早为0.4.0；该前提本次改成0.5.0。原摘要两个定向用例通过。原始日志保留为 `/private/tmp/phase6b4-counterfactual.log`、`phase6b4-digest-counterfactual.log`。

| 变化 | 归因与处理 |
| --- | --- |
| 合法实例版本/非法版本 | 合法v1→v2；非法v2→v1，保留拒绝语义 |
| 禁用符文负例 | 新规则允许符文；换为武甲错配，仍断言非法装配/数据被拒 |
| runeFamilyEnabled schema负例 | 改为非boolean；不削弱schema |
| 旧非符文生成骰带 | 显式使用关闭符文族的旧前提，原骰序和值断言保留；新开启族另有21条生产生成字面向量 |
| pack/module/growth身份 | 由当前定义与目标表重新计算；不写旧指纹绕过校验 |
| UI first-hit/9个SSR快照 | 原finder与原Vitest捕获法更新；R06明确四行，R07明确brutal+titan；R08旧seed146已变成腐化sluggish，按原“可换装正收益”前提选非腐化/非符文；R16改seed39/index0；未删除原比较断言 |
| 自然成长路线seed26→36 | 原D6坐标33,8到17,14在500步内不可达，保留失败；原生成路径找到首层adept.will的seed36，仍6层/每段500步/60秒及原全部断言 |
| 全局摘要黄金 | 新增pending卷轴ID与foundation16→17；独立SHA先复现旧值，再登记新根；历史foundation11链不变 |
| 统计工具−0 | 规范JSON往返的−0为0，无数值平衡变化 |

测试中发现并修复了生产问题：完整世界回滚中随机对象身份未还原、原生slaying/immunity路径被新同步误影响，以及强化提案可能恢复被削弱的原生附魔。相关回归不改旧断言。新增用例自身错误（读取基础甲代替最终防御、戒指2→3误当增长边界、scroll查错identityId、瞬时气体/无喷口陷阱夹具）均单独修正，不作为生产缺陷或通过证据。

首次旧P0在仓外无.git失败，保留 `/private/tmp/phase6b4-before.log`；用正确 `GIT_DIR/GIT_WORK_TREE` 重试同入口通过。限定loot批次曾有inert 30秒超时；限定复跑通过，未放宽超时。全部原始失败日志均留仓外，不覆盖。

## 门禁与证据

统一Node24、3072MiB，Vitest显式文件、maxWorkers2、批次串行；正式性能期间不并行测试或构建。大于1MB原始录像/日志/截图不提交。Node路径为 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`，`NODE_OPTIONS=--max-old-space-size=3072`。Vitest经 `node node_modules/vitest/vitest.mjs run <显式文件> --maxWorkers=2`，types经 `node node_modules/vue-tsc/bin/vue-tsc.js -b`，最终构建经 `node node_modules/vite/bin/vite.js build`（此前同树 `npm run build`亦exit0）。各批次实际argv、耗时和exit另存 `phase6b4-checks.json`、`phase6b4-followup.json`、`phase6b4-calibration-results.json`。

### 正常树限定结果

| 批次/证据（均在 `/private/tmp/`） | 实际结果 | 说明 |
| --- | --- | --- |
| `phase6b4-loot-final-1.log` | 32文件，836通过/2失败 | 限定为loot登记文件；新增护甲用例读错层已修，inert超时在后续原限额复跑关闭 |
| `phase6b4-final-fixes.log` | 5文件，100通过/2失败 | UI重复按钮、inert、x3b/x4详情通过；两项新增算例前提随后修正 |
| `phase6b4-final-fixes-2.log` | 2文件63通过 | 强化/符文runtime及实际 `src/engine/UI/DetailGenerator.test.ts`；此前误写的不存在路径不算已执行 |
| `phase6b4-lifecycle-test-5.log` | 2文件68通过/1失败 | runtime新增正负例及100次只读探针全部通过；长链夹具另一词缀也因真实命中揭示，换独立火抗行 |
| `phase6b4-lifecycle-test-7.log` | 1文件5通过 | 受控链首次完整通过；随后改用harness公开easy模式，在最终批次再通过 |
| `phase6b4-final-related.log` | 6文件56通过 | `loot_b4_growth`、`loot_growth_attributes`、`p1_30_i18n_gate`、`u24_hardcoded_text`、`test_suite_membership`、`repo_hygiene`；重新导出当前候选自然存档/录像 |
| `phase6b4-shared-1.log` | 28文件696通过/4失败 | 共享原生/stats/成长/战斗/摘要/写集守卫；两项摘要身份前提、两项原生行为回归已在下一批关闭 |
| `phase6b4-shared-fixes-1.log` | 6文件161通过 | b4runtime、原生武器、反射、投掷、U03及recording摘要 |
| `phase6b4-loot-fixes-2.log` | 4文件60通过 | growth属性、review_r1、21条随机符文向量、growth强化组合 |
| `phase6b4-ui-recapture.log` | 79通过，9快照更新 | 原捕获法；[逐字段表](phase6b4-fixture-delta.md) |
| `phase6b4-normal-{discovery,boundary,dependencies}.log` | exit0 | 显式发现集合与真实跨模块依赖；无扩大矩阵 |
| `phase6b4-final-types.log`、`phase6b4-final-build.log` | exit0/exit0 | `vue-tsc -b`；`npm run build`。前一次均exit2是新增harness模式类型前提，未改公开类型绕过 |
| `phase6b4-perf-selector.log` | exit0 | 两个固定身份和8个拒绝负例 |
| `phase6b4-fixed-negative.log` | 6通过，64项名称筛除 | 四固定唯一负例、实际投掷本件强度及失败回滚；筛除不是依赖skip |
| `phase6b4-final-ui.log` | 8文件102通过 | 真实SFC/游戏DTO、原生强化、U03、UI惯性/i18n及文本守卫 |
| `phase6b4-final-ui-null-fix.log`、`sealed-types-2.log`、`sealed-build-2.log` | 均exit0 | 新UI测试将非法类型null前提改为undefined后定向复验及最终types/build；此前sealed-types exit2保留 |
| `phase6b4-sealed-natural.log` | 1通过、13项名称筛除，exit0 | 最终源码重新执行自然成长生命周期并导出真实save/recording；Vitest42.31s，进程墙钟58.31s |
| `phase6b4-sealed-boundary.log`、`sealed-dependencies.log` | exit0/exit0 | 最终正常树boundary/静态依赖；21.21s/12.43s |

完整32文件列表在 `src/ext/modules/loot/test-suites.json`；调用时展开为显式文件，不用目录参数。共享28文件为：ext_item_data/item_stats/item_commands/item_drop、ext_stats_native/runtime/review/pipeline、w_7_arcana_enchantment、u_15d_weapon_runic/u_15d2_armor_runic/u_15d3_runic_generation、w_4_bolt_reflection、w_23_negation、x2f_thrown_math、ext_combat_neutral_differential/transition_facts、growth的ext_growth_items/item_runtime、u_03_whole_run_snapshot、ext_recording_v4_digest、ext_generation_checkpoint_differential、p1_30_i18n_gate、u24_hardcoded_text、repo_hygiene、test_suite_membership、ext_module_boundaries、ext_test_dependencies。不同批次有重叠，不累计冒称独立测试总数。

### 唯一全移除

准备命令：`node scripts/check-module-removal.mjs --profile=removal --retain=none --prepare-only --engine-only --output=/private/tmp/phase6b4-all-removed-20261016`，exit0。原准备报告仍为 `prepared-not-verified`；后续手动限定门禁另列，未修改原runner政策来伪造通过。

唯一副本 `/private/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-ToVBM1/candidate`。实际删除 combat、crafting、foraging、giants、growth、loot、narrative、settlement 的完整所有权目录；发现器installed=[]。未留类型桩，未追加布局；最终共享src与源树逐字节相同。

副本 discovery/boundary/静态依赖/vue-tsc/npm build 均exit0。显式12文件为 ext_item_data/item_stats/item_commands、u_15d_weapon_runic/u_15d2_armor_runic、w_4_bolt_reflection/w_23_negation、u_03_whole_run_snapshot、ext_recording_v4_digest、ext_module_boundaries/ext_test_dependencies/test_suite_membership：11文件231项通过；`ext_item_stats`因声明required combat已物理删除，具名1项skip。未跑全部剩余ext。

`check-module-composition-smoke --engine-only --removed-modules combat,crafting,foraging,giants,growth,loot,narrative,settlement --combinations endpoints` exit0：全关new/play/save/load/replay/seek/续录，2事件→3事件。另用最终正常树真实命令导出的同foundation17、loot0.5.0/growth1.10.0输入运行 `/private/tmp/phase6b4-missing-inputs.mjs`，最终exit0；拒绝同时保持完整活局、双流、实体ID与录像。前两次探针失败分别是审计后导出补检查点、两次导出墙钟metadata不同；调整探针建立时序并固定metadata时钟，没有改生产拒绝逻辑或放宽比较。证据：`phase6b4-checks.json`、`phase6b4-followup.json`、`phase6b4-final-missing-2.log`、`phase6b4-missing-inputs.json`及`phase6b4-all-removed-smoke.json`。

末次共享UI/派生getter同步至这同一副本后，boundary、静态依赖、types、build再次exit0；原生强化及U03两文件48项通过（`phase6b4-removed-sync-related.log`，39.60s）。未创建第二全删副本，也未扩大测试集合。

最后再用当前源码自然测试导出 `phase6b4-sealed-lifecycle-{save,recording}.json`，在同一副本执行 `phase6b4-sealed-missing-inputs.mjs`，exit0（6.59s）：两种同版本输入均拒绝，完整活局/双流/ID/录像保持。结果为 `phase6b4-sealed-missing-inputs.json`；原输入与前述失败日志均保留，没有覆盖。最终独立命令与耗时见 `phase6b4-final-independent-results.json`。

### P0 换版与计时归因：D6阻断，未冻结接受基准

开工原入口 `node scripts/check-ext-perf.mjs /private/tmp/phase6b4-perf-input /private/tmp/phase6b4-perf-before-retry --regenerate` 在原树exit0。原输入、预算、两条路线、比较器和instrumentation保留。

classic原2208命令全部复用；身份重录差量仅foundation/初始根/9个完整根/2208条链摘要，其余逐事件字段及双流一致。all旧路线在1841的 `equip r` 不再有该物品而拒绝；1840条已接受前缀与失败保留。新旧首个实质随机分歧为1715，先于动作分歧1762；不能改头或强迫旧骰带。按D5 A经原 `generate-ext-perf.mjs <dir> all 438491256 500` 重新探索，得到2528事件、D20恰好500已结算行动、最大34怪/212地形光源。两条新录像来自生产导出。

新classic录像hash `651a38e00d142d91ba18b8d4fe86d4dab976750a2057815f217b8bec56917bca`；新all `47f5d69eb48ee40681b799e5daff113e3439dce4bdc44a01af36d125dc1ac359`。首次classic计时38.82s，开工同机原版19.63s。随后原代码+原录像配对复测40.79s，其全部语义、双流及计数与开工一致，气体/环境/客观块等独立段同步约2.06–2.15倍；不能把这组运行环境漂移归为6B4开销。首次all在2000事件后主动中止以先做原版对照，未产出完整结果，不计入三次校准、不冒称OOS失败或通过。保留 `phase6b4-calibration-1-all.log` 与原编排KeyboardInterrupt。

原版all配对复测已完整exit0：898.6287s/P95 871.8246ms/max 6781.3689ms；开工为432.9879s/410.5502ms/3374.3642ms。原代码两case的墙钟倍数分别2.0777/2.0754，全部语义、双流、调度与计数精确一致，原代码差量hash同为空diff的SHA256。由此补充同环境配对基线，未覆盖开工结果、未放宽计数/语义门禁；具体系统功耗/调度原因未作结论。原all D20最大33怪/211地形光源，新all为34/212。

三次完整候选均exit0：classic2208事件/all2528事件，三个源码差量hash相同；各case完整终态、逐事件/完整域摘要、双随机流、调度和17项计数精确一致。它们是未经接受的校准结果，**不等于冻结后门禁通过**。完整摘要、源元数据、17项计数、双流、内存和日志时间见 [phase6b4.perf.json](phase6b4.perf.json)。原观测器、比较器、预算、两条原路线均未改。

相对同上下文原版all，复核线为P95 **959.0070ms**、max **8476.7111ms**、墙钟 **988.4915s**。候选三次P95为850.9741/963.7788/1255.4743ms（**2/3越线**）；max为6836.5069/12146.7141/955235.5134ms（**2/3越线**）；墙钟959.9691/955.8093/2490.3295s（1/3越线）。相对开工原版则三项全部3/3越线，原始数据未删除。第一轮墙钟+6.83%、P95−2.39%、max+0.81%；不能据这一轮代替三次结论。

`pmset -g log`确证 **11:05:35 Clamshell Sleep → 11:49:42 FullWake**，期间多次Maintenance Sleep/DarkWake；11:53:41再次合盖。第二轮all日志时间10:51:42–11:07:46，第三轮classic11:07:46–11:09:00、第三轮all11:09:01–11:50:38，均与睡眠窗口相交。第三轮all第1908条普通D17移动记955235.51ms，只有1客观块/100ticks，另有112s/96s/89s等停顿。证据 `phase6b4-power-sleep-wake.log` 保留仓外；没有扣除睡眠时段、删除慢命令、取消校验或以更高预算覆盖失败。合盖影响可确认，但尚不能从受污染墙钟中量化所有新增代码开销，因此按D6 A阻断收口，不声称每一个慢点都已排除代码因素。

可比负载另取首次RNG分歧之前的1714条：所有记录的工作字段一致。原版命令P95/总耗时为674.0044ms/364.2947s，三次候选分别817.6421/402.8041、782.7744/373.0146、672.3513/585.3408；保留前两次P95增幅和第三次长停顿，不以完整路线变化掩盖局部风险。候选all比原路线多12事件、65客观块、6550ticks；属性命中/未命中从3521313/2564760变3657780/2612203。D20最大怪/光源为34/212，原为33/211，没有降负载。

规则差量的具体见证是D16物品800（背包q、mace、ilvl24、magic）：原leech T2[1]+keen T4[7677]，新reaper T2[1]+honed T3[2]；两者都没有runicType、强化均0、原生附魔均0。启用符文族改变加权候选池，即使最终抽到普通词缀，结果也会变化。第1714条装备后第1715条首次交战出现RNG分歧；新旧暴击/平伤等属性路径不同，不能把它笼统归成格式变化或“新增符文触发”。原最终两行皆known，新reaper未知/honed已知、熟悉度/鉴定尾状态不同，与实际交战路径相符。原始物品见 `phase6b4-{old,new}-item800.json`；首次data/action/tick/turn/levelRef差异分别1720/1762/1726/1725/1743，HP字段无差异。这条P0路线不冒充25行符文全覆盖，后者来自独立功能算例和真实效果测试。

新增开销微场景三次计数/hash一致：强化、精炼各为transaction/itemCommandTransaction/collect=5/1/4，实质抽取47/49、外观14/14（含既有整回合收尾）；真实效果为1/1/0，实质2/外观0；100次查询为0/0/0、双流0抽取且完整图不变。证据 `phase6b4-feature-counts.json`；不将这些受控场景冒充完整路线或平衡验收。

### 候选身份与人工交接

完整身份见 [phase6b4.identities.json](phase6b4.identities.json)，使用排序相对路径+NUL+文件字节+NUL的SHA256，包含未跟踪的新源码：

- src：`fb608a49780b4dec5fae81a2a84841e867dbb19e5e239645b76e0dc710dd6bb8`
- dist：`012d309c648dee31ba31c446867a0cdb37435b127886a627e81d59d4b2f1c65d`
- itemSdk.ts+itemTargets.ts：`b33756df2fa7301defd0818a4f2f0366cf43716683026d4f11e1160d09176859`
- loot静态数据16文件：`343a20c71ee5b9260df8eb52dd4cdd5aca196d26c31fe34c81b91347707780c3`

最终复核src1456文件、dist61文件均与校准前身份相同；唯一全删副本余下885个src文件逐字节等于正常树相应文件。观测脚本原`sourceHash`只覆盖`git diff HEAD -- src`，因此另用上述完整src哈希覆盖新建未跟踪源码，未修改观测器。身份JSON还保存原P0 manifest字节hash、新录像的物理文件SHA256与原工具canonicalRecordingHash、两条路线及来源元数据hash；6B4接受manifest明确为null。两种录像hash口径分别列出，不混淆文件排版字节和`JSON.stringify`编码。

三预设都用相同内容目录；预设差别保存在manifest.configuration及loot状态，不伪造不同目录身份。growth关闭目录为 `sha256:480f446cad167d6d46bdc8fa96a46c04ea9d57a5bdb7c14d7d50f9b27e4f3a93`；开启为 `sha256:664ab376a339e1bb63f7276d9071a473c1057f4c2e984cfa987467560e45d4c2`。六次生产创建均created=true，完整manifest、规则与配置保存在身份文件。

D7三档均待维护者：[320/800/桌面逐项清单](phase6b4.manual-checklist.md)。未报告浏览器通过。D6不请求降低标准或改选B；需要维护者侧提供持续开盖、供电状态一致的测量窗口/运行机，之后按原规则复验。任务单要求“新基准尚未冻结……明确P0待验并停在收口前”，本次据此保留B4-5未完成，独立工作已全部继续执行。

末次显示修复：原生符文已被关闭时，游戏卡片和来源卡明确标注已知行失效，未知行不泄露；背包真实关闭按钮/Esc通过只读派生 `canCancelEnchantment` 区分延迟消费与原生强制选择。原生强制选择守卫保持，未修改原断言。新增6个固定唯一/投掷定向用例通过（64项为名称筛选）；最终UI/原生强化/U03等8文件102项通过，末次测试null→undefined前提修正后定向用例与types/build再通过。两个共享文件已同步至同一个全删副本，受影响门禁另行复验。


### 完整计时与入口计数（未接受校准，不是最终门禁）

客观块使用原TimeCoordinator活跃段口径，包含环境/怪物/块尾结算；`objectiveTimeBlock`函数自身分段另存JSON，不与完整客观块混淆。分位数沿原脚本。表中最大值不裁剪，三轮均列出。

| 组合/测量 | 墙钟s | 全程命令 P50/P95/max ms | 全程客观块 P50/P95/max ms | D20命令 P50/P95/max ms | D20客观块 P50/P95/max ms |
| --- | ---: | --- | --- | --- | --- |
| classic/开工 | 19.63 | 3.84/12.08/884.73 | 2.40/6.91/17.81 | 7.73/13.95/884.73 | 3.20/7.33/14.67 |
| classic/配对原版 | 40.79 | 7.96/24.72/1843.01 | 4.86/14.48/65.14 | 15.23/29.08/1732.06 | 6.20/14.89/65.14 |
| classic/校准1 | 38.82 | 7.57/23.45/1701.64 | 4.82/13.74/40.98 | 14.99/27.92/1701.64 | 6.24/14.46/29.47 |
| classic/校准2 | 39.11 | 7.49/24.29/1732.80 | 4.77/14.04/90.01 | 15.63/30.00/1732.80 | 6.30/15.22/90.01 |
| classic/校准3 | 65.24 | 13.24/36.05/4073.55 | 7.58/23.36/126.88 | 14.48/27.19/1784.70 | 6.09/13.93/26.60 |
| all/开工 | 432.99 | 68.25/410.55/3374.36 | 25.72/116.88/1099.85 | 341.30/442.85/1303.83 | 96.80/122.65/456.56 |
| all/配对原版 | 898.63 | 141.42/871.82/6781.37 | 53.39/246.43/2204.81 | 709.89/947.66/3011.02 | 199.68/285.16/752.79 |
| all/校准1 | 959.97 | 168.52/850.97/6836.51 | 82.55/242.49/4387.42 | 715.51/944.87/3767.77 | 190.71/249.87/791.47 |
| all/校准2 | 955.81 | 151.17/963.78/12146.71 | 63.28/261.35/3556.26 | 701.77/1374.72/12146.71 | 188.75/384.02/3556.26 |
| all/校准3 | 2490.33 | 138.46/1255.47/955235.51 | 55.57/337.42/954743.59 | 1029.34/1422.90/96353.26 | 240.19/373.86/1857.92 |

| 入口 | 原classic | 新classic | 原all | 新all |
| --- | ---: | ---: | ---: | ---: |
| updateVision | 6944 | 6944 | 7234 | 7296 |
| hasCreatureAtForLight | 5802024 | 5802024 | 6663421 | 6719910 |
| objectiveTimeBlock | 2431 | 2431 | 2326 | 2391 |
| updateEnvironment | 3381 | 3381 | 3276 | 3341 |
| collectExtensionComponents | 0 | 0 | 4813 | 4843 |
| projectWholeRun | 9 | 9 | 10 | 10 |
| recordingEventDigest | 2208 | 2208 | 2516 | 2528 |
| getMonsterAt | 6551356 | 6551356 | 6962473 | 5251372 |
| checkpointCombatFactWorld | 0 | 0 | 134 | 130 |
| checkpointResidentWorld | 0 | 0 | 129 | 126 |
| light.buildLightMask | 367790 | 367790 | 398643 | 409718 |
| light.paintLight | 756 | 756 | 2296 | 2296 |
| light.dance | 0 | 0 | 0 | 0 |
| gas.update | 5132 | 5132 | 5046 | 4586 |
| extension.snapshot | 0 | 0 | 2526 | 2538 |
| extension.transaction | 0 | 0 | 5017 | 5041 |
| extension.settle | 0 | 0 | 4813 | 4843 |

新case的三次计数完全相同，计数表取第一轮列值。classic均2431客观块/241350ticks；旧all2326/231034，新all2391/237584。classic9个、all10个完整边界均保留，包含256/2048及末尾完整校验。

| 组合/测量 | 抽样RSS峰值 MiB | 抽样heapUsed峰值 MiB |
| --- | ---: | ---: |
| classic开工 / 配对原版 | 1569.84 / 1724.70 | 1117.23 / 1338.42 |
| classic校准1 / 2 / 3 | 1744.81 / 1747.83 / 1728.92 | 1366.93 / 1368.27 / 1327.43 |
| all开工 / 配对原版 | 2407.03 / 2450.38 | 1358.15 / 1796.67 |
| all校准1 / 2 / 3 | 2290.14 / 2276.42 / 2474.42 | 1717.53 / 1460.46 / 1434.14 |

这是进程抽样值，不是浏览器内存或精确峰值；未额外跑GC/CPU采样。原版配对与候选采用同一`profile-ext-perf.mjs`、Node/堆上限和串行调用方式，未改变观测器。开工基线来自原`check-ext-perf`入口；两组上下文与全部原始结果分别保留。

### 命令、阻断与恢复顺序

实际观测命令统一为 `node scripts/profile-ext-perf.mjs INPUT_RECORDING OUTPUT_PREFIX`。候选路径为：classic校准1=`/private/tmp/phase6b4-calibration-1/classic`，其余=`/private/tmp/phase6b4-paired-{1,2,3}/{classic,all}`（不使用不存在的paired-1/classic）；源输入=`/private/tmp/phase6b4-new-input/{classic,all}-438491256.recording.json`。三轮6次均exit0。进程argv/耗时/exit在`phase6b4-calibration-results.json`、`phase6b4-paired-results.json`，精确前缀在`phase6b4-calibration-prefixes.json`。原版配对在`/private/tmp/phase6b4`执行，设置对应`GIT_DIR/GIT_WORK_TREE`，输出`phase6b4-original-control/{classic,all}`，两次exit0；与开工的所有语义和计数相等。

**未执行**：6B4预算freeze、冻结后`check-ext-perf --phase6b4`。`scripts/ext-perf-6b4-budget.json`有意尚未生成；白名单入口在缺少接受基准时失败关闭，不绕过oracle或回退原manifest。不能称新P0硬门禁通过，不能把三次自回放一致当作冻结后独立验收。原P0通过证据仍有效且未被覆盖。

需要维护者侧处理的唯一新增阻断是运行环境：保持连续开盖、供电状态一致且无休眠的基准窗口（或提供稳定运行机），不是请求改变D6裁定。系统日志已证实合盖，后续又再次合盖，继续无条件重跑不能保证得到可比计时。本次不更改系统电源设置、不从测量中扣除停顿；完成独立交付后停在B4-5之前。

恢复时使用本次工作树候选内容中的两条新路线与`*.source.json`来源元数据，重新运行而非选删本批慢样本。先补同运行环境的原版完整配对，再串行测新版本三次，按D6处置全程与可比负载差异；只有符合条件后才冻结新manifest并执行最终门禁。例如（在工作树根目录，Node24/3072MiB；输入/输出留仓外）：

```sh
node scripts/regenerate-ext-perf.mjs scripts/perf/ext-6b4-late-classic.route.json /private/tmp/phase6b4-clean-input/classic-438491256.recording.json
node scripts/regenerate-ext-perf.mjs scripts/perf/ext-6b4-late-all.route.json /private/tmp/phase6b4-clean-input/all-438491256.recording.json
for b4_pass in 1 2 3
do
  node scripts/profile-ext-perf.mjs /private/tmp/phase6b4-clean-input/classic-438491256.recording.json /private/tmp/phase6b4-clean-${b4_pass}/classic
  node scripts/profile-ext-perf.mjs /private/tmp/phase6b4-clean-input/all-438491256.recording.json /private/tmp/phase6b4-clean-${b4_pass}/all
done
```

下两条仅在D6处置且三个完整结果获接受后执行；保留原freeze比较强度，不手改计数、计时或hash：

```sh
node scripts/ext-perf-budget.mjs freeze scripts/ext-perf-6b4-budget.json classic=scripts/perf/ext-6b4-late-classic.source.json,/private/tmp/phase6b4-clean-1/classic,/private/tmp/phase6b4-clean-2/classic,/private/tmp/phase6b4-clean-3/classic all=scripts/perf/ext-6b4-late-all.source.json,/private/tmp/phase6b4-clean-1/all,/private/tmp/phase6b4-clean-2/all,/private/tmp/phase6b4-clean-3/all
node scripts/check-ext-perf.mjs /private/tmp/phase6b4-clean-input /private/tmp/phase6b4-clean-final --phase6b4
```

最终`git diff --check`通过；原P0预算/比较器/观测器/两条原路线字节未改；变更文件无CRLF/冲突标记，Markdown围栏配对，新证据无>1MiB原始制品。HEAD仍为`8d7c799`，分支仍为`ext/phase6`，无暂存、commit或push。

本报告不替代D7浏览器逐格结果，不声称平衡、CE、全组合、移动端性能、D22+或最大居民/结构验收。功能代码、相关测试及交接材料已留工作树；尚未获得完整6B4收口结论。

## 第 1 轮独立审查发现处理（2026-10-16）

原始结论保留在 [review-findings](phase6b4.review-findings.md)。本节记录主笔修复，不能替代复审结论。上文首轮 B4-5 失败及休眠证据作为历史保留；本轮性能结果另列。

| 问题 | 复现与修复 | 新回归 |
| --- | --- | --- |
| R1-F1 分摊漏揭示 | 1 点输入、玩家余伤仍 1、邻敌 100→99，原实现只看玩家减伤；现按玩家减伤或邻敌实际失血提交匹配行回执，账本同步修正 | 揭示前存读档→真实分摊→仅符文行已知→再次存读档；知识验证失败完整世界/双流回滚 |
| R1-F2 呼吸提前揭示 | 瞬时毒气接触尚未结算伤害，原实现却按气体旗标揭示；现去除旗标处提交，在渐进伤害或实际会增加气体状态时长的位置提交，原生自亮和 loot 行知识共用门槛 | 瞬时毒气不揭示、存读档后渐进伤害才揭示；混乱/麻痹/恶心已有更长时长不揭示、短时长阻断则揭示；原生无 loot 甲同阶段门槛 |
| R1-F3 地面详情强度错误 | 原地面物品没有扩展属性投影、对象展开又丢失会话 WeakMap 绑定；现提供限定于只读查询期间的待察看物品，经同一属性管线投影当前值和强化提案，查询后清理，不修改背包 | 吸收行 L0=8 quarter、当前/下级均 2 当量；背包→地面→存读档→拾取一致；未知火抗行始终未知；未知地面符文过滤、读取无事务/无 RNG/完整图无变化、地面装备资格仍拒绝 |

复现证据：原审查探针复跑日志 `/private/tmp/p6b4rev1-before-fix.log`。新回归合法夹具在未修生产代码上 7 项全部失败（`p6b4-r1-red-valid.log`），修复后 7 项全部通过（`p6b4-r1-green-attempt1.log`）。首次测试准备曾漏填稀有物品 nameParts 并误写气体枚举，产生夹具校验错误；已修正测试前提后才执行上述红绿验证，未修改生产守卫或既有断言。后续补入未知地面和原生呼吸边界，最终测试结果以本轮限定门禁表为准。

本轮没有调整任何数值数据、没有升级格式版本、没有改旧断言语义或重录黄金快照。未重跑全量、drift、CE、删除/组合矩阵；先前唯一全移除的证据保留其原源码身份，不冒称本轮新源码已再次全移除。

### R1 限定回归结果

14 个不同文件、487 项不同用例通过（不累计复跑）。逐文件 Node24 / 3072MiB，`--pool=threads --maxWorkers=1 --no-isolate`；完整 argv、耗时、结果在 `/private/tmp/p6b4-r1-test-results.json`。

| 文件 | 不同用例通过数 |
| --- | ---: |
| `src/ext/modules/loot/tests/loot_b4_runtime.test.ts` | 78 |
| `src/ext/modules/loot/tests/loot_b4_growth.test.ts` | 5 |
| `src/ext/modules/loot/tests/loot_enhancement.test.ts` | 11 |
| `src/ext/modules/loot/tests/loot_game_ui.test.ts` | 7 |
| `src/ext/modules/loot/tests/loot_game_sfc.test.ts` | 12 |
| `src/ext/modules/loot/tests/loot_ui_knowledge.test.ts` | 53 |
| `src/test/g_3_gas_effects.test.ts` | 27 |
| `src/test/u_15d2_armor_runic.test.ts` | 7 |
| `src/test/x3b_item_details.test.ts` | 13 |
| `src/test/x4_r4_item_details.test.ts` | 23 |
| `src/test/ext_stats_pipeline.test.ts` | 40 |
| `src/test/ext_recording_v4_digest.test.ts` | 20 |
| `src/test/u_03_whole_run_snapshot.test.ts` | 18 |
| `src/test/ext_combat_neutral_differential.test.ts` | 173 |

保留失败历史：首次整文件运行的新增未知地面检查在安装 spy 之前取完整图快照，spy 自己增加了对象 own key；调整为先装 spy 再取快照后，78 项全过，生产逻辑未因此变更。成长长链首次 70.31s 触发原有 60s 超时，其他 4 项通过；同参数独立复跑该原用例 40.60s 通过，4 项名称过滤跳过不重复计数，未改超时、流程或断言。原日志分别为 `p6b4-r1-loot_b4_runtime.test.log`、`p6b4-r1-final-loot_b4_growth.test.log`，复跑 `p6b4-r1-growth-isolated.log`。

限定独立门禁：boundary exit 0（10.95s），测试依赖 exit 0（6.79s），P0 selector 两身份/8 负例 exit 0。vue-tsc 首次因新测试使用目标库不支持的 `Array.at` 报错；只改为兼容的 `slice(-1)[0]`，8 项 R1 回归复验全过（70 项名称过滤跳过不重复计数），最终 vue-tsc exit 0（22.74s）、Vite build exit 0（17.11s，保留既有大 chunk 提示）、diff-check exit 0。命令与日志在 `/private/tmp/p6b4-r1-gates.json`、`p6b4-r1-final-gates.json`、`p6b4-r1-final-regressions.log`。

正式计时前源码冻结：1456 个 src 文件 SHA256 `650ea6258f5e5b208ab38cd99195532dc1c0ffd83bed070b54b86cac71c53479`；61 个 dist 文件 `fb26405cb63c2bfc983dab010318e2d26f415543f74979e4e9b8401e63ccae07`。编码均为排序后的仓库相对 UTF-8 路径+NUL+文件字节+NUL。原版 src 1448 文件 `b3e435809fc78aaaf2234936b0c73068bda90fcc687d4e99d05e0c96ff8e00c5`。原观测器、比较器和原预算未修改。

### R1 B4-5 重测记录（环境阻断，未收口）

正式原版首轮 classic 窗口 12:55:24.321–12:56:23.507（+08:00），exit 0、2208 事件零 OOS，但日志含 12:55:31 Sleep、12:55:34 DarkWake、12:56:19 Sleep、12:56:22 DarkWake，故整轮计时作废。该轮 all 在 12:56:30.028 开始，确认 classic 已无效后中断（exit 130）；部分日志保留，不能作为完整性能或正确性通过。审计在 `/private/tmp/p6b4-r1-perf/original-attempt-1-classic.audit.json`、`original-attempt-1.round-audit.json`。

临时进程级 `caffeinate -i -s` 不能阻止当前合盖维护休眠；补充显示/用户活动断言后 12:58:45 仍有 Sleep。未修改系统电源配置。已向维护者说明需要持续开盖唤醒的物理测量窗口；不请求变更裁定、不以无效轮冻结预算。原始观测/比较器、D6 门槛均保持。仓外驱动 `p6b4-r1-perf-runner.py` 每轮前落盘起始时间，测后检查 pmset 日志与前序电源状态，并覆盖两 case 间隔；任何 Sleep/Wake/DarkWake 作废整轮，保留输出并另建 attempt 目录重测。

13:04:02 最后核对仍见 13:02:53 Sleep、13:02:56 DarkWake、13:03:41 Sleep、13:03:44 DarkWake（+08:00），证据 `/private/tmp/p6b4-r1-power-final.json`。因此当前有效原版配对 0 轮、有效候选校准 0 轮；未执行冻结后门禁。尚不能区分新增开销与环境波动，不能宣布 D6 通过，也不能用首轮污染样本冻结新预算。独立工作已完成，剩余工作依赖持续开盖唤醒的实际运行窗口。临时 caffeinate 进程已释放，未改全局电源设置，没有后台基准仍在运行。

恢复后先执行仓外驱动 `python3 /private/tmp/p6b4-r1-perf-runner.py original`，再执行同一驱动 `candidate`；自动从新 attempt 编号开始，不覆盖旧失败。每轮的起止时刻、Sleep/Wake 审计和完整原始回放输出均落盘；接受三个干净完整候选后，仍须先按 D6 对照原版（含可比前 1714 事件负载）归因，再用原 freeze 工具创建新预算及执行完整 `check-ext-perf --phase6b4`。这些后续步骤本轮未完成，不作为已通过项目列报。

本轮最终静态核对：源码和 dist 与正式计时前冻结身份一致，HEAD `8d7c799`、暂存文件 0，diff-check 通过；变更文件 LF、Markdown 围栏配对，新证据小于 1 MiB。未 commit。R1 修复可供复审，B4-5 仍需上述环境恢复后验收。

### B4-5 云端 A/B 测量（2026-10-16，工具交付，正式测量待触发）

维护者批准在公开仓库的 GitHub Actions 测量，替代上述需要持续开盖的本地恢复流程；原 Sleep/DarkWake 失败证据继续保留。新增 `.github/workflows/ext-perf.yml` 仅有 `workflow_dispatch`，不监听 push，不修改 `pages.yml`，权限仅 `contents: read`，不提交预算或推送代码。

工作流在单个 `ubuntu-24.04` runner 上检出测量工具、A、B 三个目录；先拉完整历史，将短 SHA/分支/tag 解析成不可变完整提交号再检出 A/B。使用 Node 24、三份 lockfile 的 npm 下载缓存、分别 `npm ci`。测量子进程统一 3072 MiB 堆，串行运行，避免同时驻留多个引擎。job 上限 360 分钟，测量 step 上限 330 分钟，为报告和 artifact 上传留余量；单个捕获/回放子进程超过 90 分钟失败。每步开始和结束持久化 JSON/Markdown，失败或超时保留已落盘原始数据和日志；未完成报告的 running/pending 状态不代表通过，超时任务不能冻结。

`run-ext-perf-ab.mjs` 通过子进程 cwd 选择引擎 checkout，并传绝对输入/输出路径。原 `profile-ext-perf.mjs`、common、重录器、比较器、freezer/checker **均未改动**；执行前核对两版与控制目录的这些文件字节，核对原 instrumentationHash，拒绝脏引擎源码。结果另存 A/B 完整 commit、src tree、lockfile、实际工具文件 hash、Node/CPU/内存、run ID/attempt，补足原 observer 仅记录 `git diff HEAD -- src` 哈希的身份局限。

配对口径遵守 D5，不能把旧版本录像直接塞给新引擎，也不能把不同路线称为同输入：

- **classic**：原 P0 的 2208 条命令与 6B4 完整路线逐条相同。分别从生产导出各自版本录像，原重录器核对完整冻结 hash，再完整回放配对；保留全部 full checkpoint。
- **all 完整路线**：A 原 P0 2516 条、B 6B4 2528 条分别按各自冻结路线重建并回放。报告原始全程、D20 命令/客观回合 P50/P95/max、墙钟、收集/事务次数、客观块/ticks、RSS/heap 抽样峰值；两条路线的工作量不同，不自动豁免越线。
- **all 同输入补充**：按已有归因，实质 RNG 首次分歧为 1715。新增通用 `capture-ext-perf-prefix.mjs` 在两版从真实新局执行原 P0 前 1714 条命令，经生产导出再完整回放这份独立前缀录像；不截改录像、版本头、检查点或预算。不替代 D20 完整测量或新预算输入。跨 A/B 检查非计时 rowsHash、双流、块数、回合与 ticks 相等；失配立即失败，不能继续冒称可比。前缀没有 D20 样本时不计算 D20 指标。

每轮先 classic A/B，再 all A/B；all 的每侧包含完整路线和上述额外前缀。因此每个组合/输入序列严格为 A1,B1,A2,B2,A3,B3，不并行计时、不挑最好轮。所有流每次检查完整事件数、原始录像 hash、wall 模式、零 OOS；第二、三次与第一次逐域/完整终态递归比较，并要求全部 17 项调用计数、语义、双流、调度、属性诊断精确稳定。A 两条完整路线每轮另过原冻结预算硬检查，缺组合、hash 漂移、语义差异或计数增长都失败。

D6 使用**本 runner 每轮对应 A/B**，不与旧笔记本绝对毫秒相比。命令与客观回合的全程/D20 P95 +10%、max +25%，以及完整回放墙钟 +10%；前缀使用其全程命令/客观回合与墙钟。统一判式 `B > A + max(1ms, A × 比例)`，恰好等于不越线。任一指标越线算该轮越线，同一对比三轮至少两轮越线即 `regression`、非零退出，要求回退/修复复验，不自动改 git。单轮失败不删样本；不同指标在不同轮越线也算两轮。原 30/40ms 目标仍仅报告。

只有两组合完整三轮、三组相对比较（classic/full、all/full、all/prefix）全部通过且硬检查通过，才用**原 freeze 工具**生成 artifact 内的 candidate manifest；再独立回放 B 两条完整录像，与首次结果逐域/计数比较并执行原预算 check。最终通过才复制为 `ext-perf-6b4-budget.suggested.json`。候选或建议文件均不写回仓库，失败的 candidate 不称为可接受预算。维护者审阅实际云端归因和结果后才可采用建议；现有 `scripts/ext-perf-budget.json` 不改，当前仍无正式 `scripts/ext-perf-6b4-budget.json`。新 manifest 保留原绝对时间 report-only 策略；D6 相对时间由新驱动单独执行硬拦。

触发前，维护者需自行提交/推送本次工具到待运行分支；GitHub 要求默认分支也存在 `workflow_dispatch` 工作流，随后可选择运行分支，见 [GitHub 手动运行说明](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)。本次不代为提交、合并默认分支或触发运行。Actions → **ext 6B4 performance A/B** → **Run workflow**，选择含本次工具的 `ext/phase6`，输入默认 `base_ref=43f115b`、`head_ref=ext/phase6`、`rounds=3`；等价 CLI：

```sh
gh workflow run ext-perf.yml --ref ext/phase6 \
  -f base_ref=43f115b -f head_ref=ext/phase6 -f rounds=3
gh run watch
```

`rounds=1/2` 仅诊断，报告为 incomplete（已达两次越线则 regression），不冻结。Actions Summary 展示时间、相对差、硬检查与裁决；artifact `ext-perf-<run_id>-<attempt>` 保留 7 天，含 `result.json`、`summary.md`、原始录像/逐命令与完整域/终态、比较结果及逐步日志；符合条件时另有建议 manifest。需长期保留时下载 artifact，不提交 >1 MiB 原始证据。

本地工具验证使用 Node 24.19.0、独立临时 clone A=`43f115b` / B=`c5863ab`，复用本机已有依赖；没有声称本地执行了 Actions 的 npm 缓存/安装或完整云端性能测量。缩短模式示例（输出必须是新的仓外目录，避免覆盖失败）：

```sh
node scripts/run-ext-perf-ab.mjs --base /path/to/base --head /path/to/head \
  --out /private/tmp/ext-perf-smoke-new --case classic --rounds 1 --limit 32
node scripts/test-ext-perf-ab.mjs
node scripts/test-ext-perf-selection.mjs
npm run check:test-dependencies
```

实际验收（均 exit 0，短跑不代表原 P0/新 P0 或 D6 通过）：

- 最终 classic 32 命令一轮 A/B：2 次生产回放零 OOS，可比 rowsHash、双流与调度相等，报告 `incomplete`、未输出 manifest。
- all 32 命令三轮：完整流诊断/前缀流诊断共 12 次生产回放零 OOS；8 次与首轮的逐域/终态比较通过，全部计数与属性诊断稳定，跨 A/B 可比负载检查通过；报告仍为 `incomplete`、未输出 manifest。此处“完整流诊断”也被显式 `--limit 32` 缩短，不能冒称完整原/新路线。
- `test-ext-perf-ab.mjs`：参数拒绝、非零 OOS/hash/事件数/计数/语义/机器漂移、缺失/非有限计时、1ms 边界、三轮两次越线（含不同指标）、不足轮数/缺组合/截短禁止冻结、失败 JSON/Markdown 持久化通过；临时合成制品调用原 freeze/check、拒绝覆盖和零值计数增长负例通过，不作为真实基准校准。
- `test-ext-perf-selection.mjs` 原两身份及 8 个拒绝用例通过。相关 Vitest `repo_hygiene`、`test_suite_membership`、`ext_test_dependencies` 三文件 **22 项通过**；测试依赖检查 `errors=[]`。
- 工作流 YAML 解析、仅 dispatch/360 分钟配置核对、内嵌 ref 解析脚本实跑通过：默认参数解析到 `43f115b28a63922086fe9734f431f9b77d3bf1c7` / `c5863abd6abe3ffe33b15bf81288af33735ccb80`，非法 shell 文本作为普通 ref 被拒。`git diff --check`、LF 与变更范围核对通过；`pages.yml`、原性能工具/预算/路线和生产代码均未修改。

原始短跑证据在 `/private/tmp/ext-perf-ab-smoke-n0_t1azu/`，最终 classic 为 `classic-32-final/`，all 为 `all-32-three/`，首次 classic 另存 `classic-32/`；相关测试日志 `/private/tmp/ext-perf-ab-related.log`，最终依赖报告 `/private/tmp/ext-perf-ab-dependencies-final.json`。本地复用已有 node_modules，未实际跑 GitHub、npm ci/缓存或完整两组合三轮测量；未跑全项目测试、构建、CE 或删除矩阵，未 commit。
