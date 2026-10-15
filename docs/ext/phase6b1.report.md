# 6B1 实施报告

2026-10-15。维护者 B1-D1～D6 全部 A 已写入[任务单第7节](phase6b1.task.md#7-维护者裁定2026-10-15b1-d1d6-全部采用-a)。在 `ext/phase6`、HEAD `26aaaf3` 上单主笔实施，未整体合并/cherry-pick 原型，未 commit、暂存或 push。本报告区分当前验收、历史证据和后续未验范围。第1轮审查 F1 的处理、当前散列及限定复验见 §9；§5、§6、§8 为该轮修复之前的验收记录。

## 1 输入、迁移和源码身份

固定原型：`93523fc596b173396a0d526ab2073b327ff7cf3e`。逐文件通过 git blob 迁入 loot 的74个文件和两个合同，共76项；逐项原始 SHA-256、当前 SHA-256、copied/adapted 状态见 [SDK/迁移清单](phase6b1.sdk-manifest.json)。其余原型路径全部不迁入，包括 narrative 像素资产、其它模块、旧共享底座/配置/测试发现文件、历史长报告及统计 JSON。历史文献仍可用 `git show 93523fc:<路径>` 复核，未改写成当前验收。

开工以 `git show HEAD:<path>` 核对6A1清单的全部283项，**0项不匹配**；旧 SDK 闭包聚合为 `eebf539720177aebbfe177e0769aa5b80a2d317731b37061b5ab0e44ceab12f5`。最终候选是开工完整 HEAD 加清单中的 `candidateChanges`，包含新增/修改及删除路径；文档不参与候选源聚合，避免自引用。未来合入 commit 不在本次工作范围。

历史纯包0.1.1的10文件/335项、β18文件/627项，以及300局×3预设、430730事件/157252件、最大单件/事件33/88抽、14项标记（3A/11D），只作为固定输入；本轮没有重跑统计，也没有把它们当真实游戏平衡结论。

**输入文档计数差异**：任务单写“33个非符文词缀”，但固定提交 `data/affixes.json` 实际为35条非符文定义+21条符文定义，原 `loot_data` 独立转录测试也明确检查35/56。此次保持固定数据与包指纹，未为匹配文字删两条；请维护者后续修正文档计数。此项不改变批准数值。

## 2 分步结果与合同对应

| 步骤 | 当前结果 | 主要证据 |
| --- | --- | --- |
| B1-1 | 完成逐文件迁移；保留固定向量、F-01/F-02修复、原β夹具/组件；原惰性“启用仍无效果”前提按授权更新 | 清单 migration；原数据/生成器/UI测试；未启用与未安装对照仍比较完整状态/RNG、存读、回放、seek |
| B1-2 | module/rules0.2.0、state v1、默认关闭/standard；创建配置桥、恰一次create、真实capability目录、碎片定义 | integration三预设首层、重复create、坏配置/目录/state拒绝；capabilities真实combat及growth缺席fallback |
| B1-3 | floor/vault/kill/encounter四来源；分桶、固定装配、accepted收据、水位；正常/部分/全跳过与异常分开验 | 原随机向量；bridge测试；真实D1掉落；真实giants split/lost/load与8191/8192根接纳；C6 drop定向回归及完整对象图晚失败 |
| B1-4 | C6属性草稿、单位/local公式、ring implicit一次、原怪物曲线、过滤/分解/碎片鉴定、受控部分知识 | R07真实端点/力量8与20/known-only/cache；同基底双戒对照；真实近战揭示；经济/CAS/No/Yes/多堆/晚失败 |
| B1-5 | 新局预设最小挂载、C6名称/前景色、四位置投影、真实hypothetical比较；F-03关闭 | R08/R12红绿证据；组件独立文本与快照；原F-01/F-02、i18n、硬编码检查 |
| B1-6 | 当前版本自然闭环、256/2048检查点、相关门禁及唯一全删行；报告和合同更新 | 见§5、§6；不运行全量、组合、CE、浏览器矩阵 |

| 原型合同 | 实际SDK与适配 | 验证口径 |
| --- | --- | --- |
| rollLoot / LootRandom | `itemDrops.roll`，随机闭区间直接桥接；beginItem仅通知，不重抽 | 事件前置骰+首件共桶0，不再次复位0；后件1…7，金币8；固定输出和抽取 tape 保持 |
| LootGeneratedItem | `DropItemSpec.native`固定26基底；熟悉度来自原函数 | 武/甲出生0；戒指原生附魔承载implicit/唯一覆盖；不写runicStrength、不随机spawn后覆盖 |
| newUniqueIds | 每件平行 uniqueIds + acceptance.newUniqueIds | 只登记实际接纳；全跳过不记唯一；消费遭遇仍推进watermark；公开收据校验拒绝篡改位图/水位 |
| availability | `foundation.stats.v1` / `foundation.item-encounters.v1` | combat实际注册键、giants实际公开form；growth.attributes未发布，adept→titan，缺能力按原fallback/omit合并权重 |
| modifier drafts | `StatModifierRow`逐字段构造、itemPolicy C6-1 | sourceId=`loot.item.<id>.affix.<n>`；本地flat→increased→floor；附魔×4、护甲点×10、感知×20；speed equipment槽；owner预算与final clamp分开 |
| monsterScaling | environment来源 +可信出生满血初始化 | 每个角色自身层深（包括旧楼层、carried/leader引用闭包和离线读档候选）；升容不补、降容钳制；原曲线未调参 |
| filter/salvage/identify | `itemCommands`纯prepare→宿主CAS/提交 | 0/每件100/100tick；十片；唯一Yes/No；费用、材料、状态、知识和时钟同事务 |
| known DTO/compare | `projectKnownItem`可信投影、`hypothetical(...,true)` | 未知行不计已知比较，四槽同源、双戒分列；真实六标量；条件/符文独立标明，不用β基础公式当机械结果 |

## 3 身份、状态与 SDK 补口

版本保持 foundation15 / whole-run7 / recording4 / origin2 / world5 schema4 / worldSdk1 / edibleSdk1 / itemSdk1。新增集成loot0.2.0/state1；纯包仍0.1.1，指纹 `sha256:7785d8e68e6486bd422e40c6a3f0d317b102683116dcea8e483f2256d9c84fd2`。空能力目录指纹仍 `sha256:ed86796fad38b1b7995aa94fb1ee4641a8d366e5c8f41c84295d206e9a1aa45c`。

manifest规则指纹绑定集成版本、静态包和preset配置；state的catalogFingerprint在每次会话建立时用真实能力重新计算并严格验证，两层身份共同防止静默换目录。locale不入机械指纹。state严格字段：v、presetId、created、revision、catalogFingerprint、uniqueMask（8位）、watermark、filter；UTF-8≤4096字节，不保存事件key历史或物品镜像。当前seed26存档state为276字节。

实例仍是 `Item.moduleData.loot` 唯一真相，沿宿主4 owner、单owner4KiB/总8KiB/深度16限制、quantity1。出生附魔/诅咒只在create相位核对；后续原生强化、解咒/否定合法变化不强制回出生值。旧 `{}` 状态、旧模块身份、坏数据及缺包严格拒绝，无迁移。无新增Game字段，U03状态字段登记不变；无格式黄金/trace重录。

| 缺口 / 最小复现 | 窄补口 | 定向证据 |
| --- | --- | --- |
| initialState/validateState早于stats初始化，目录无法基于真实注册能力建立 | `ExtensionModule.prepareItemSession(queryOptional)`在stats注册后、state校验前执行；新局重建初始state，加载不补默认 | 三预设、真实combat/growth与目录指纹篡改拒绝 |
| 创建组件只回initialCommand，预设未同步manifest | UI contribution `configurationFromCreation` + `buildModuleCreationConfigurations`，开局前校验配置及命令一致 | 三预设首层；MainMenu共享SFC测试；无模块ID硬编码 |
| stat provider没有可信角色层深；只接当前层会使旧层怪物load失败 | 可选 `StatSourceContext.depth`；runtime读actorQueryScope，`withStatWorld`接受离线角色层深映射，Game加载提供 | giants首次旧层load拒绝→修复后正常/lost通过；真实倍率3500bp及满血/物化回归 |
| 模块紧凑唯一账本无法校验宿主位图 | 可选 `DropProvider.validateReceipts`接冻结accepted ID与消费水位投影 | 伪造uniqueMask、水位拒绝并保持活局/双流/ID |
| 未约束vault也传空qualifiers，无法区分无约束和明确空约束 | vault DTO qualifiers可选；无约束省略，任何已定义值保留原生回退 | 原vault一次kind选择/throwing次序及全qualifier回归；loot空数组拒绝转换 |
| 首次触发没有item受控部分揭示入口 | `ItemKnowledgeProvider.trigger` + physical-hit事实，仅真实近战正物理伤害且hpLost>0后执行；纯准备、验证后原子应用 | R07真实攻击揭示brutal且不揭示其它行；R08条件判别；无变化不建对象图检查点 |
| UI缺少可复用可信已知投影入口 | host `projectKnownItem`，不向模块暴露活Item；幻觉绕过provider；未知held物等为null，ring baseId隐藏 | 四位置、读纯度、原生合法强化、未知数据；原C6幻觉/记忆/铭文回归 |
| 第1轮 F1：词缀已知但原生种类/符文未知被碎片命令拒绝 | `ItemCommandFacts.canBeIdentified`，宿主按原生卷轴共用纯规则计算；模块/宿主分别校验，提交前再检查原生知识变化 | 否定戒指即时/存读、仅符文未知、真正全已知模块/宿主拒绝、预检后同种类被学会的陈旧计划；见 §9 |
| 第768条命令增量extensions摘要与全量不符 | birth/prune/placement/transition补齐markRecordingRoot；prune仅实际变化返回true；空清理不标脏 | seed42失败 domain=extensions；修复后同路线通过768/1024/2048检查点，随后因路线失败退出；新增prune失效一次回归；最终seed26自然链及2049当前loot测试 |

这些是D4授权的通用窄补口，没有修改worldSdk/edibleSdk或关闭守卫。worldSdk文件SHA-256=`297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343`；edibleSdk=`fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b`，均与基线相同。审查前7个、F1修复后9个SDK闭包文件有变化；UI桥另外列于candidateChanges，完整逐文件散列见清单。

## 4 S2、知识与后续限制

F-03新增两条回归，先只放回归、保留原型DTO/模型/组件执行：`loot_ui_components.test.ts -t 'F-03'`，**exit1，2失败/77未选**，日志 `/private/tmp/phase6b1-s2-red.log`。修复后同筛选 **exit0，2通过/77未选**（`phase6b1-s2-green.log`）。最终全包再次通过。

R08仍以seed146/itemIndex0、全部揭示、pack/standard/空武器槽生成：公开行有condition文本引用，真实渲染含“对大型目标”。R12 seed707/0：公开行有runic文本引用，渲染含“力量”。组件不解析key、不临时拼限定字符串；分组继续区分条件/符文，未知部分不输出隐藏值/条件/符文。原组件快照通过原renderer仅更新一处限定span，另保留独立文本断言。F-01确认按钮冒泡、F-02预览i18n回归均在最终loot与U24批次执行。

D5首次触发覆盖如下（已鉴定、熟悉度和碎片全揭示不受此表限制）：

| 状态 | 词缀 / 固定行 | 事实与缺口 |
| --- | --- | --- |
| 已接：攻击方 | keen、brutal、honed、dull | melee正物理结算且目标实际失血；只揭示匹配本地武器伤害/附魔的行 |
| 已接：攻击方条件 | giantsbane | 同上且targetTags包含body.large；小型目标不揭示 |
| 已接：防守方 | warding | 真实受到近战物理伤害且失血；匹配physical-damage-taken |
| 已接：唯一固定行 | whisper.r0、ember-fang.r0、penitent.r2、colossus-maul.r0/r2、vigil-plate.r2（均加loot.unique前缀） | 与上述stat/角色/条件相同；不整件连带揭示 |
| 待补：防御/命中/时序 | reinforced、plated、brittle；precise、clumsy；swift、sluggish | 需要护甲减免、命中判定、动作耗时真正结算并能定位来源的事实 |
| 待补：容量/恢复 | vital、frail、titan、mending | 需要容量应用、力量贡献或实际恢复的提交事实；不能用collect/getter冒充触发 |
| 待补：感知/光照 | radiant、shadow、noisy、seeker、clairvoyant | 需要可归因的察觉/搜索/照明/视野提交事实 |
| 待补：抗性/资源proc | fireward、antivenom、leech、reaper、wisdom、fortune | 需要对应火/毒减免、转移/收割/充能、寻宝结算的受控知识入口；本轮physical-hit不覆盖 |
| 待补：combat | enduring、steadfast、tireless、stalwart | 实际能力存在时机械行已接；首次揭示仍缺物品来源可归因的stamina/poise容量/恢复结算端口 |
| 能力缺席 | sage、adept、scholar | growth属性能力未发布；按mending/titan/omit fallback，未虚构新能力或揭示事件 |
| 待补：其余唯一行 | whisper.r1–r3；ember-fang.r1–r3；penitent.r0/r1/r3；shadowweave.r0–r3；cinder-mail.r0–r3；colossus-maul.r1/r3/r4；vigil-plate.r0/r1/r3/r4；gambler.r0–r3 | 分别沿对应属性端口缺口；固定符文完整强度与触发事实留6B3 |

上述待补是明确交接，未声称“全部首次触发已完成”；维护者可据此安排端口或收窄后续范围。本轮不会自行扩成资源/战斗事件改造。原生侦测显示保留宿主行为，loot DTO没有可靠诅咒暴露事实时传false，保守不把历史corrupted推断成当前诅咒；未鉴定/未知行/物等不向生产已知DTO泄露。

固定唯一runicType已保留原生效果，数据runicStrength没有写成原生字段，也不宣称强度8已按6B3重塑。随机符文族、T7、套装/符文之语、强化操作仍未开放。完整详情/比较/分解/过滤面板挂载、真实浏览器布局/像素/触控、M4力量及怪物倍率平衡、原统计14项标记均留6B2/后续。当前真实比较六项是damage-min/max、defense、max-hp、strength、attack-speed；条件与固定符文行单列，扩展更多比较标量留完整UI阶段。

## 5 正常树验收与首败修复

环境：Node v24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`；每个Vitest批次`--maxWorkers=2`。最终批次串行；调查早期曾短暂重叠两条路线诊断进程，随后中断长路线并恢复串行，没有并发运行全量套件。未安装依赖。

| 批次 | 实际命令（共同node路径略） | exit / 结果 | 墙钟 |
| --- | --- | --- | --- |
| loot最终 | `node node_modules/vitest/vitest.mjs run src/ext/modules/loot/tests --maxWorkers=2` | 0；22文件658通过，0失败/跳过/todo/unhandled | 29.99s |
| 共享直接相关 | 下列11文件，Vitest run、maxWorkers2 | 0；11文件183通过，0失败/跳过/todo/unhandled | 56.19s |
| 录像筛选 | `src/test/ext_item_recording.test.ts -t 'tracks partial knowledge\|naturally generates, walks\|records natural kill'` | 0；1文件3通过、11未选，0失败/todo/unhandled | 10.76s |
| 类型 | `node node_modules/vue-tsc/bin/vue-tsc.js -b` | 0；后续所有权修复另复验 | 日志types-final |
| 构建 | `npm run build` | 0；保留既有>500kB chunk提示 | Vite3.29s（含typecheck命令完整日志另存） |
| 发现/边界/依赖 | `node scripts/test-discovery.mjs`、`check-module-boundaries.mjs`、`check-test-dependencies.mjs` | 0；8模块，依赖errors=[] | 原始日志另存 |
| 预览隔离 | `rg -l 'loot-item-card\|loot-compare\|LootUiGallery' dist/` | 零命中；预设选择生产chunk允许，完整β/画廊不入产品 | — |

11个共享文件：`src/test/ext_item_data.test.ts`、`ext_item_drop.test.ts`、`ext_item_stats.test.ts`、`ext_item_commands.test.ts`、`ext_item_presentation.test.ts`、`ext_item_roots.test.ts`、`ext_stats_review.test.ts`、`ext_module_creation_ui.test.ts`、`p1_30_i18n_gate.test.ts`、`u24_hardcoded_text.test.ts`，以及 `src/ext/modules/settlement/tests/resident_foraging_integration.test.ts`。该批执行时giants两条drop用例尚在共享文件，后续移属原断言定向重跑，数量不叠加。

loot22文件精确列表由当前 `src/ext/modules/loot/test-suites.json` 的test数组给出，并逐文件带散列收录candidateChanges：原18文件全部保留，加 integration、commands_integration、capabilities、stats_integration四文件。

首败及处理（重复批次不累加为新覆盖）：诊断批次的实际文件/筛选、exit、原始计数/耗时行及日志SHA另列在小型摘要的diagnosticHistory；没有结束摘要的中断批次不虚构通过数量。

- 原型整批18文件628通过/1快照失败：F-03新增限定文字导致旧组件快照差异；原捕获器更新一处span，未改固定数值/随机向量。随后相关2文件88通过。
- 新集成首轮8通过/1失败：测试误把runicStrength塞入固定装配；修夹具，不给SDK增加伪字段。
- boundary识别统计工具的`preset.layers`为原始地形访问：改统计输出字段为`depthRows`并同步自有统计测试；没有改白名单/扫描器。历史统计JSON仍是固定git blob原格式。
- 依赖检查发现旧中性stats fixture ID恰好叫loot，现已成为真实安装名：改为statsfixture，断言语义不变；resident_foraging的泛安装扫描改为精确installedOptionalModules(['foraging'])并校准声明；MainMenu测试注入新增通用配置桥和合成registry，不屏蔽新桥验证。
- 类型诊断修复可选depth兼容旧provider fixture、原recording3事件前提、未用导入、Item/Facts字段混用和测试固定原生装配前提。最终vue-tsc通过，未改TS严格选项。随后所有权迁移只修正同目录helpers的相对路径和SFC harness基准文件，定向2文件2通过/22未选。
- 自然链最初seed42材料不足；延伸路线暴露第768条extensions摘要差异，见§3。路线夹具补跨层停止、确认处理、录像flush；D5不可达目标/D8路线预算失败仍保留日志，未增加原60s超时或放宽断言。用34个D1种子的有限夹具搜索找到seed26现成材料，最终D1自然完整链通过，未重跑300局统计。纯pack数据不变。
- giants跨层load失败修正角色层深，lost诊断改用真实becomeAllyWith入口及物化，避免手改阵营留下未同步状态。最终正常/lost/partial/skip四场景通过。
- loot最终首批653通过/1失败，仅双戒对照夹具误用kindKey；改原生identityId/固定native template后657项通过（另增加两条根接纳与一条prune回归）；随后补携带怪物候选层深回归，最终658项通过。

### 自然生命周期与导出输入

当前输入为 seed26、wizard、loot单开、standard。wizard仅使用公开模式，不手塞moduleData、不搬玩家、不改掉率/RNG/材料。真实move造成击杀并取得origin.source=kill物品，拾取装备；保留未知目标，分解ID25/27/28，累计足够10片，鉴定ID26。录像含create、三个salvage、identify-shards、真实item:command与260次move/5次pickup；保存时271条，续录escape后272条，仍D1。save/load、逐事件replay零OOS、seek、续录均比较机械摘要。当前独立loot测试另跑到2049条，检查第256条fullCheckpoint、第2048条周期snapshot及续录。

导出原始文件仅在 `/private/tmp/phase6b1-current-save.json`（约2.2MiB）和 `phase6b1-current-recording.json`（约258KiB），未入库。缺包副本使用这些原始当前候选输入，不改manifest、不用旧codec。摘要与SHA见§6小型证据。

## 6 一行全移除（第1轮审查前证据）

准备命令：

```sh
node scripts/check-module-removal.mjs --profile=removal --retain=none --prepare-only --engine-only --output=/private/tmp/phase6b1-all-removed-20261015-0756
```

exit0，原runner结果保持 **prepared-not-verified**，没有伪造其全量通过字段。唯一副本为 `/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-C20YVp/candidate`。发现器列出的 combat/crafting/foraging/giants/growth/loot/narrative/settlement 八目录真实删除，无空壳；准备时删除243个模块测试，剩409个测试，remainingModules=[]。准备输入与源树最终hash均为 `166ffe318d30e9b175235d2a62560f1eca0a0a573a8bbfdd6d907709efc697c6`，副本删除后为 `40aa13b221043920147f5d8749bf71de2f80404e0722e8fe1f75b85127342d9f`。

首次副本boundary/依赖通过、vue-tsc失败，暴露既有共享 `ext_item_drop` 与 `ext_phase5_ui_open` 对已删除模块的静态导入。处理为真正归属修复：giants专属两条drop用例移动到giants/tests/item_drop_integration；界面用例移动到settlement/tests/phase5_ui_open；所有断言保持，导入和SFC harness基准路径等价换算，清单/required依赖随所有者更新。未改类型/依赖守卫、未增加空模块或动态any逃逸。**复用同一个副本**同步共享变更；移属后的可选测试随已删模块保持不存在。最终发现差量与限定验收见小型证据。

本轮没有调用runner默认的全部test:ext/composition-smoke。只执行boundary、静态依赖、vue-tsc、build、剩余直接相关文件，以及独立引擎probe中的一次全关new/play/save/load/replay/seek/续录和当前loot缺包拒绝。最终限定结果在 [小型验收摘要](phase6b1.evidence.json) 中单列，不等同原runner的全量policy。

### 限定执行结果

同一全删副本：boundary exit0/4.294s、依赖 exit0/2.904s、vue-tsc exit0/6.328s、build exit0/11.756s、7文件相关测试 exit0/28.735s（6文件97通过、1文件1具名占位跳过；`ext_stats_review` 声明缺combat/growth）、引擎probe exit0/6.474s。剩余相关测试为ext_item_data/drop/commands/presentation/roots/stats_review/module_creation_ui；没有全test:ext。准备后的所有权修复使最终删除归属245文件、保留408测试、安装模块0，见发现证据。

probe只运行一次全关完整生命周期，再分别拒绝候选whole-run7存档与recording4录像，断言完整对象图、RNG、ID allocator、原录像数组和机械摘要不变。输入manifest为loot0.2.0，拒绝发生于当前缺包校验，而非旧codec。文件散列：save `a83f341860ef70bf67228be1a22699cf05c16e9f2d4dc72a617b9534ed97a929`；recording `8e8ea5e4e35dd9bb39eb285a301c1dc3956c6d8b986a668e9061d306b10d4e46`。

最后的carried/leader层深闭包补全在此probe之后；追加真实携带者跨层load回归通过，并在同副本同步Game后重做类型/构建。probe的单层全关路径与缺包前置拒绝路径不进入该新增分支，没有重复全关生命周期或创建第二副本。所有权迁移另复验drop两文件34项通过（19.34s）；settlement单开camp=false及携带者load筛选两文件2项通过、22未选（2.82s），未执行其余七模块UI组合。

## 7 未验证与交接

未运行完整npm test/test:ext/test:drift、CE拉取/全量/生成、128/256组合、单删/单留/发布矩阵、全开长路线、浏览器/真机及长局性能测量。未宣称阶段6整体完成。D5缺口、完整UI与更多比较标量、固定符文强度、历史14项统计标记、M4平衡分别按§4交接。任务计数文字33/实际固定35的差异保持原数据等待文档审阅，不擅自调数值。

## 8 第1轮审查前候选冻结与卫生检查

最终候选108个src/scripts变化路径（删除项sha256=null）聚合SHA-256：`5c83235669921c52898063800e6c812d9d31891feee5e424e0439a1f7c812c8f`。283文件SDK闭包SHA-256：`893ff7f50a4160c734dffd0d079d079f18cffc2f690d813aeb08b5ad1e2ad540`。迁移76项中55项逐字节复制、21项适配；16个数据JSON的原字节与纯包固定指纹保持。公共导出变化单列publicApiChanges，7个闭包差量单列sdkDelta。聚合算法为path排序的紧凑UTF-8 JSON，逐文件散列为原始字节SHA-256。

最后正常树：UI/i18n两文件6通过；boundary exit0/5.479s、依赖exit0/3.555s、vue-tsc exit0/8.728s、build exit0/15.619s。全删同副本最终类型exit0/6.225s、build exit0/11.945s。独立同步核对：副本文件集合等于源树扣除全部模块所有权目录，源树在同步前后不变；最终src/scripts全树散列 `0f1c774638d9168bf8ce32a705a52e1b59cdd4c778468c2982a8da2989f0276c`，全删对应代码散列 `f354209b7431d695877206b19c643c271fadb0ce36d0d21b4739aaf1ca9e0eb5`。完整树在文档汇总后发生的差异仅为本报告/摘要，不冒充代码变化；准备原runner保持prepared-not-verified，实际限定结果单列。

当前git diff --check无输出；新增/修改文本无CRLF，无>1MiB原始证据入库。所有长命令已结束，未commit/暂存/push。交维护者审阅，不自动开始6B2/6B3/6C。

## 9 审查发现处理：第1轮 F1（2026-10-15）

**处理结果：F1 已修复并通过本轮限定复验，交第2轮独立审查。** 原[独立审查结论](phase6b1.review-findings.md)保持原文，未改写审查者的“需修”。A6/A7 的这条碎片鉴定缺口已补；D5 待补词缀及其它后续边界仍按 §4，不扩大完成声明。

### 复现与根因

先增加即时/读档两条真实 Game 用例，保持生产代码原样：seed42、loot 单开，R12 经公开 salvage + Yes 得80片；R05 放脚下，经真实否定卷轴及 pickup，实例/词缀已知但 ring_of_awareness 种类未知，原生卷轴可选。两条均在碎片计划应被接受的断言失败：exit1，2失败/4未选，3.21s，日志 `/private/tmp/phase6b1-f1-red.log`。这是固定装配布景，不冒称自然掉落链。

模块 `affixes.every(known)` 和宿主 `!itemKnown(target)` 都把 owner 知识当成整件鉴定资格；只修模块不能绕过宿主。沿6A1已修的原生规则，将 `ItemLoader.updateIdentifiableItem` 的原判断等价提取为纯函数 `canIdentifyItem`，原卷轴仍由 update 调用同一判断，保留实例/种类/符文与 NEVER_IDENTIFIABLE 语义。

### 修复及覆盖

- SDK 仅增加 `ItemCommandFacts extends ItemFacts` 的只读 `canBeIdentified`；`ItemCommandRead.inventory` 改用此事实类型。宿主计算、runtime 深复制/冻结后交模块；普通 ItemFacts、持久数据、版本和纯包指纹不变。没有模块私引 ItemLoader 或自行维护种类知识。
- loot 用上述资格判断是否提案；宿主 prepare 独立重新计算资格，保留 owner、十片、100tick、完整揭示、CAS 与回滚校验。commit 再检查当前资格，避免预检后其它实例学习同种类导致无知识可学仍扣费。
- 两条 loot 回归验证即时与真正 `toSaveSnapshot` JSON 往返后均可学习种类，80→70片、100tick、revision+1，整件已知后 provider 自身零成本拒绝。prepare 的完整对象图/RNG不变。成功命令正常推进世界，**不要求成功动作零 RNG**；从命令前快照重新执行实际记录的 `ext:command`，机械摘要、双流及ID一致。
- 三条共享回归覆盖“owner已知但原生戒指种类未知”“owner已知但符文未知”、强行提案时宿主独立拒绝全已知，以及预检后同种类被学会的陈旧计划拒绝；拒绝验证完整对象图与时钟不变。
- 上述记录输入回归由布景快照起步，不称为从种子完整录像。另定向重跑既有 seed26 自然击杀/掉落/拾取/分解/碎片鉴定链，验证真实当前版本 save/load、完整 replay 零OOS、seek、续录。两种证据分开记录。

新增测试诊断中修正了“有成本成功动作不推进RNG”和“world-only snapshot仍有录像来源”两个错误前提；最终使用真实持久存档与确定性重执行检查。类型首轮发现新测试 Array.at 超出项目 lib，以及未用 ItemFacts 导入；改索引访问并移除未用导入，没有改 tsconfig/守卫/旧断言/超时。构建脚本首次尝试的 Node24 bin 下无 npm，构建未启动；改为 PATH 中 npm 并保持 Node24 优先，实际构建结果如下。原始失败日志及 SHA 均保留在小型摘要 review1.diagnostics。

### 本轮实际验收

统一 Node v24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`，批次串行。

| 范围 | 结果 | 耗时 | 日志 |
| --- | --- | --- | --- |
| 6个相关文件 | exit0；117通过，0失败/跳过/todo/unhandled | 58.84s | `/private/tmp/phase6b1-f1-related.log` |
| loot 自然录像链筛选 | exit0；1通过，9未选 | 11.02s | `/private/tmp/phase6b1-f1-recording.log` |
| 类型兼容修正后两命令文件 | exit0；38通过，0失败/跳过/todo/unhandled | 20.06s | `/private/tmp/phase6b1-f1-commands-final.log` |
| boundary | exit0 | 6.311s | `/private/tmp/phase6b1-f1-boundary.log` |
| dependencies | exit0 | 3.912s | `/private/tmp/phase6b1-f1-dependencies.log` |
| types | exit0 | 9.572s | `/private/tmp/phase6b1-f1-types.log` |
| build | exit0 | 16.171s | `/private/tmp/phase6b1-f1-build.log` |

6个相关文件：`src/ext/modules/loot/tests/loot_commands_integration.test.ts`、`src/test/ext_item_commands.test.ts`、`src/test/b_1a_identification.test.ts`、`src/test/b_1b_identification_persistence.test.ts`、`src/test/ext_item_presentation.test.ts`、`src/test/ext_kind_knowledge_runtime.test.ts`。自然链为 `src/ext/modules/loot/tests/loot_integration.test.ts -t 'natural kill reward, shard identification'`。本轮去重118项通过；38项复跑不叠加。依赖 errors=[]；构建仅保留既有大 chunk 提示。

没有运行全量、drift、CE、组合、浏览器或一行全移除；§6全移除是审查前候选的历史证据，不伪称覆盖本次修改。此次没有重录黄金或改存档/录像格式，无新增 Game 字段，未 commit/暂存/push。

### 当前散列

[SDK/迁移清单](phase6b1.sdk-manifest.json)已重算：候选111个 src/scripts 路径，聚合 SHA-256 `838063a0330790329920bc603ab778f5b2b70602d5ead9bfd45ff92118b63af1`；SDK闭包283文件、相对HEAD差量9项，聚合 `cb4d8ec3ce777d075f801c542472dd7c6d0c4eadbbe2a9124d1c158f11f7d432`；基线逐项0不匹配，迁移仍76项（55 copied / 21 adapted）。worldSdk/edibleSdk原字节不变。§8的108路径与旧散列仅保留作审查输入定位；本节及清单是当前候选身份。散列算法不变，原始日志 SHA 与当前测试元数据见 [小型摘要 review1](phase6b1.evidence.json)。

| F1 生产/回归文件 | 当前原始字节 SHA-256 |
| --- | --- |
| `src/engine/Core/ItemCommands.ts` | `f3eb3c3f6cb075f4dbfa89d691509b05289682eb000dc71852577358ccecbc96` |
| `src/engine/Items/ItemLoader.ts` | `42bad042cd6f48cb1ef53407c752fc7815edd63279adbfd90f8a1a73487b32b0` |
| `src/ext/itemSdk.ts` | `567766ab26614be472b46b54e3341ed839b8d2f642f6a485c77d8cee587c8c7d` |
| `src/ext/runtime.ts` | `5d31c4cf4953dd17e65d53b9b0ee924697149e29cf390786da4c7a2977676900` |
| `src/ext/modules/loot/commands.ts` | `2c662f8646d4b92d4b8b5c48dd8862ec95e0638d9cb696a09acb085e31c755dc` |
| `src/ext/modules/loot/tests/loot_commands_integration.test.ts` | `d72449749e60362edff78d351262d1521559a1891437883c06262d1277688ac7` |
| `src/test/ext_item_commands.test.ts` | `29b2792ed07f7c56f3d34314e684c7bf022eb580c1577f3bf922d694b6a5add4` |
