# 6A1 实施报告（第二轮 N1 已修复，C6-1 v1 本地候选）

**2026-10-15：第二轮新增S2（N1，否定后戒指鉴定目标资格）已修复，新增即时/存读档2项回归。相关5文件93项、boundary/测试依赖/vue-tsc均通过；本轮未跑build或性能。第一轮18项回归及性能结果保留为历史，当前修复与冻结散列以文末“第二轮审查 N1”为准。未commit。**

以下为首次实施记录：已按a→b→s→c→d串行完成实施，未commit。新增109项、drift 16项及boundary/测试依赖/vue-tsc/build通过；相关旧失败已定向关闭。N2七包普通复验仍900秒超时，按[阶段5既有精确非阻塞裁定](phase5-final-fix.report.md)保留，未声称全绿；冷查询/装备比较也超性能目标。基线与行号差量见下，最终版本/验证/限制见文末，[SDK及候选源码散列清单](phase6a1.sdk-manifest.json)已落盘。

Original prompt: 完整执行 phase6a1.task.md，6A1a→6A1b→6A1s→6A1c→6A1d 串行，唯一写入者，不 commit。

## 开工核对

- 分支 `ext/phase6`，HEAD `ff9dee3d3dfba3daf752c74e097467c0ed4c50be`；开工工作树干净。用户指定阶段5最终底座 `9cf8366` + 6A0 文档；生产参照 `59b9ba6` 只作历史比较，设计输入固定 `93523fc596b173396a0d526ab2073b327ff7cf3e`，未合入远端模块。
- Node `v24.19.0`，PATH 前置 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin`；NODE_OPTIONS=`--max-old-space-size=3072`；Vitest每批 `--maxWorkers=2`，a→b→s→c→d串行，命令前台完成。d尾声长叙事原法重录与不共享黄金的4A0/居民/守卫验证有限并发；测量也记录了该竞争，不声称机器独占。
- 实际 foundation **14**，任务书13已过时；来源 `63a279e`（阶段5六项底座修复）。whole-run6 / recording4 / origin2 保持开工实值。C6 本批统一候选拟15/7/4/2，最终在d核对，不将子步当独立发布。
- worldSdk `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343`、edibleSdk `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b`、stats `c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84`，三者与输入一致。
- 按用户最新政策：不跑CE对照/完整套件/完整组合矩阵或删除/浏览器；开发只跑直接相关测试、boundary、测试依赖、vue-tsc、build。格式升级直接拒旧档，纯格式黄金按原法重录不做反事实；前提修改不改变断言语义时直接最小修订。技能的浏览器流程与额外progress文件由本任务专用报告/门禁覆盖。
- C6-D4执行唯一可分解且警告，批量每件100 tick、10片鉴定100 tick，失败整单0成本。growth属性能力不存在时采取明确 unavailable/adept→titan；不读私有state。

### C6 §2/全文锚点对照（开工源码，后续实现行号以最终文件为准）

逐行比较历史与当前源码；本表记录文本锚点迁移，方法语义再随各子步核对。

| 历史锚点 | 当前锚点 | 差量 |
| --- | --- | --- |
| `src/engine/Items/Item.ts:71` | `src/engine/Items/Item.ts:71` | 原行内容保持 |
| `src/engine/Core/EntitySnapshot.ts:11` | `src/engine/Core/EntitySnapshot.ts:11` | 原行内容保持 |
| `src/test/u_01_instance_snapshot.test.ts:24` | `src/test/u_01_instance_snapshot.test.ts:24` | 原行内容保持 |
| `src/engine/Core/WholeRunSnapshot.ts:163` | `src/engine/Core/WholeRunSnapshot.ts:163` | 原行内容保持 |
| `src/engine/Core/WorldItemRoots.ts:6` | `src/engine/Core/WorldItemRoots.ts:6` | 原行内容保持 |
| `src/engine/Core/WorldWork.ts:695` | `src/engine/Core/WorldWork.ts:695` | 原行内容保持 |
| `src/engine/Core/WorldWorkValidation.ts:318` | `src/engine/Core/WorldWorkValidation.ts:318` | 原行内容保持 |
| `src/engine/Core/Game.ts:11929` | `src/engine/Core/Game.ts:12000` | 原行内容保持 |
| `src/engine/Items/Inventory.ts:40` | `src/engine/Items/Inventory.ts:40` | 原行内容保持 |
| `src/engine/Items/WorldItems.ts:22` | `src/engine/Items/WorldItems.ts:22` | 原行内容保持 |
| `src/ext/worldSdk.ts:118` | `src/ext/worldSdk.ts:118` | 原行内容保持 |
| `src/engine/Core/Game.ts:1199` | `src/engine/Core/Game.ts:1202` | 原行内容保持 |
| `src/engine/Core/Game.ts:1369` | `src/engine/Core/Game.ts:1372` | 原行内容保持 |
| `src/engine/Items/ItemLoader.ts:1325` | `src/engine/Items/ItemLoader.ts:1325` | 原行内容保持 |
| `src/engine/Core/Game.ts:10922` | `src/engine/Core/Game.ts:10993` | 原行内容保持 |
| `src/engine/Core/Game.ts:9327` | `src/engine/Core/Game.ts:9398` | 原行内容保持 |
| `src/ext/runtime.ts:1540` | `src/ext/runtime.ts:1571` | 原行内容保持 |
| `src/ext/modules/giants/module.ts:32` | `src/ext/modules/giants/module.ts:32` | 原行内容保持 |
| `src/engine/Core/Game.ts:499` | `src/engine/Core/Game.ts:502` | 原行内容保持 |
| `src/engine/Core/WorldCheckpoint.ts:18` | `src/engine/Core/WorldCheckpoint.ts:18` | 原行内容保持 |
| `src/ext/types.ts:289` | `src/ext/types.ts:289` | 原行内容保持 |
| `src/engine/Core/Game.ts:3833` | `src/engine/Core/Game.ts:3836` | 原行内容保持 |
| `src/ext/runtime.ts:1388` | `src/ext/runtime.ts:1416` | command新增rolledBack回调；当前开工实现为准 |
| `src/ext/registry.ts:22` | `src/ext/registry.ts:22` | 原行内容保持 |
| `src/ext/ui/creation.ts:27` | `src/ext/ui/creation.ts:27` | 原行内容保持 |
| `src/engine/Core/Game.ts:1185` | `src/engine/Core/Game.ts:1188` | 原行内容保持 |
| `src/engine/Items/Item.ts:200` | `src/engine/Items/Item.ts:200` | 原行内容保持 |
| `src/engine/Items/WorldItemPresentation.ts:8` | `src/engine/Items/WorldItemPresentation.ts:8` | 原行内容保持 |
| `src/engine/UI/Appearance.ts:492` | `src/engine/UI/Appearance.ts:492` | 原行内容保持 |
| `src/engine/Items/ItemLoader.ts:851` | `src/engine/Items/ItemLoader.ts:851` | 原行内容保持 |
| `src/ext/stats.ts:78` | `src/ext/stats.ts:78` | 原行内容保持 |
| `src/ext/runtime.ts:396` | `src/ext/runtime.ts:406` | 原行内容保持 |
| `src/ext/stats.ts:125` | `src/ext/stats.ts:125` | 原行内容保持 |
| `src/engine/Stats/StatPipeline.ts:404` | `src/engine/Stats/StatPipeline.ts:404` | 原行内容保持 |
| `src/engine/Stats/NativeStatKeys.ts:30` | `src/engine/Stats/NativeStatKeys.ts:30` | 原行内容保持 |
| `src/engine/Stats/NativeStatSources.ts:88` | `src/engine/Stats/NativeStatSources.ts:88` | 原行内容保持 |
| `src/ext/modules/growth/statSources.ts:16` | `src/ext/modules/growth/statSources.ts:16` | 原行内容保持 |
| `src/ext/modules/growth/module.ts:499` | `src/ext/modules/growth/module.ts:499` | 原行内容保持 |
| `src/ext/descriptor.ts:5` | `src/ext/descriptor.ts:5` | 原行已修改，按当前方法复核 |
| `src/engine/Core/WholeRunSnapshot.ts:188` | `src/engine/Core/WholeRunSnapshot.ts:188` | 原行内容保持 |
| `src/engine/Core/RecordingV4.ts:64` | `src/engine/Core/RecordingV4.ts:64` | 原行内容保持 |
| `src/ext/worldSdk.ts:449` | `src/ext/worldSdk.ts:449` | 原行内容保持 |
| `src/ext/types.ts:152` | `src/ext/types.ts:152` | 原行内容保持 |
| `src/engine/Core/RecordingV4.ts:15` | `src/engine/Core/RecordingV4.ts:15` | 原行内容保持 |
| `src/engine/Core/RecordingDigest.ts:20` | `src/engine/Core/RecordingDigest.ts:20` | 原行内容保持 |
| `src/engine/Core/Game.ts:3724` | `src/engine/Core/Game.ts:3727` | 原行内容保持 |
| `src/engine/Core/RecordingCheckpoint.ts:29` | `src/engine/Core/RecordingCheckpoint.ts:29` | 原行内容保持 |
| `src/engine/Core/RecordingV4.ts:98` | `src/engine/Core/RecordingV4.ts:98` | 原行内容保持 |
| `src/engine/Core/RecordingFormat.ts:205` | `src/engine/Core/RecordingFormat.ts:206` | 原行内容保持 |

## 子步状态

6A1a → 6A1b → 6A1s → 6A1c → 6A1d按序完成。C6-1 v1在本工作树本地冻结；维护者验收合入commit待填写，6B1未派发。以下保留过程中的首败及中间状态，最终停点与限制见文末。

### 6A1a 实施中的核实与首败

- 当前C5真实合同是**新增接纳7168=8192−1024**，原生生成允许超8192，load只限C5自有根；见 WorldWorkWorld.checkItemBudget、phase5a-contract §5.3。任务书“沿C5全局8192硬读档上限”不准确。本批保留C5行为，C6新掉落按8192总机械根接纳，不把自然增长变成不可读档。
- 原U01刻意构造无moduleData的共享携带/地面引用（同一实例），并检查引用图保持。C6强所有权应用于带数据物品；原生图语义不改。首批3文件52项，46过/6败（5个U01共享原生根，1个C5预算测试故意清包仍留原生装备引用）；已收窄新增检查至C6数据物品，未改旧测试。
- 首次types出现新代码TS收窄/Object.hasOwn库版本和fixture类型错误，已修本次代码；不更改编译配置。初次日志外层cat掩盖退出码，按实际报错明确记失败；后续命令保留真实exit。

- `npm run check:modules`首轮exit1：6A0遗留体积探针以模块目录路径加载固定Git提取数据，被阶段5新boundary识别为跨owner加载。只把临时提取目录改为`src/ext/inputs/loot`（相对导入层级保持），不修改守卫/白名单；远端输入仍固定，生产未安装loot。此脚本是共享清单外的必要修订。

## 6A1a 停点（2026-10-14）

实现：`ItemData.ts` 安全描述符检查→预算→冻结脱离事实→owner validator；`itemSdk.ts`/runtime 注册；Item/EntitySnapshot 缺席及深拷贝；`ItemDataValidation.ts` 全原始行及机械所有权；Game save/load 发布前校验；Inventory/WorldMaterialTransfer 拒合并拆分。未新增Game字段。原生强化enchantment与解咒isCursed不由底座强制出生等式；交由owner校验当前合法数据。深度定义根map=0，owner=1，每条边计1（含标量叶），上限16。

| 验证 | 实际结果 |
| --- | --- |
| vitest 六文件：ext_item_data/u_01_instance_snapshot/u_03_whole_run_snapshot/ext_world_items_roots/ext_world_work_boundaries/ext_world_work_transactions（全部`src/test/*.test.ts`，maxWorkers=2） | exit0，108 passed，93.91s；`/private/tmp/phase6a1-a-test2.log` |
| 新ext_item_data最后增量（描述符/预算/非堆叠/注册/历史图/引用/坏档完整对象图） | exit0，17 passed，6.89s；`/private/tmp/phase6a1-a-test3.log`；与上行重叠不累加 |
| npm run check:modules | 修复6A0探针临时输入路径后exit0，boundary与测试依赖均无错误 |
| node node_modules/vue-tsc/bin/vue-tsc.js -b | exit0 |
| npm run build | exit0；Vite1309模块，构建5.87s，保留现有大chunk提示 |

中性fixture只依赖公开item/type/descriptor；harness走真实Game与发现注册。当前fixture生成入口尚未接，测试由原生Item构造放入真实Game验证codec。原始行毒化按五种编码位置（active、cached、pack、fallen-items、entityGraph）验证；carried/passenger/purgatory/container/escrow均归entityGraph行，不把重复注入当独立合法生产迁移证明。完整合法迁移、真实生成与replay/seek在b/d继续补齐。C6未冻结。

6A1a数据/codec核心停点已交；继续6A1b，冻结前仍需d汇总关闭全链覆盖。


### 6A1b 实施进度与差量

- 新 `FixedItemAssembly.ts` 共用C5原三模板与C6的12武/6甲/8戒；`worldSdk.ts`不变。新`itemDrops.ts`内部宿主协调器持有一次性WeakMap计划，`itemSdk.ts`只公开声明；Game四来源接线、死亡前外层完整checkpoint、carry→服务→DF。
- 出生资格保存在foundation.itemDrops（仅有kill provider才登记），不从物种推断。births最多32768活动/可达actor，GC清除失去的记录；未知出生保守无奖励。活动遭遇≤128，每个≤64主体；只接本owner声明的真实generation模板，split/phase转移由宿主实际bodyTransition驱动。真实giants加模板声明，module/rules=1.1.0，state schema不变。
- **候选→实际**：DropProvider新增`uniqueCatalog`（≤128）与`statKeys`（≤16）以验证目录和在roll前冻结属性。foundation保存目录签名和32字符十六进制位图（128bit）；目录换序也拒档。DropRollContext新增`beginItem(index)`，单调桶0..7及金币桶8；每桶≤64、整事件≤512。未调用时默认桶0（保守≤64）。这些限制可真正执行，原候选无每件分段信息。
- encounterOrdinal在**终结消费时**分配，不在登记时分配。逆登记顺序终结仍为ordinal1→2，丢失主体不发奖；成功全跳过也推进，异常外层恢复。计划不持久化。
- floor武器先以原genWeapons频率总和作投掷/近战分流，近战不先roll被替换基底；provider缺席原路径。vault仅无qualifiers的普通请求可接管；`[]`仍有原生非诅咒/去重约束，所以整次回退；`MF_REQUIRE_GOOD_RUNIC`（原生runic与loot稀有度不等价）、`MF_REQUIRE_HEAVY_WEAPON`（要求原生enchantment>0与C6武器出生0冲突）、`MF_NO_THROWING_WEAPONS`（仍附带非诅咒/去重约束）均完整原生回退，无收据。v1未承诺可转换的highValue qualifier。
- C6接纳装备后再判金币，均计8192机械根；C6实际落地金币累加goldGenerated，原生legacy计数路径不改。所有提案先校验（含将跳过者）；跳过不分配ID/唯一收据，无候选不掷落点骰。
- 首轮新测试未登记giants静态依赖，被启动门禁拒绝；补了实际required依赖，未改检查器。下一轮15项12过3败：新测试错误地期待quiverNumber=0（原生为undefined），误认为固定首层必有普通装备，及真正的RNG数组引用回滚缺口。前两项改新测试前提，后一项改生产checkpoint以原位恢复RNG图。旧测试未改。
- 修复后数据/掉落/真实giants分裂三文件36项通过（62.86s）；随后掉落、C5根、原完整generation差分三文件55项通过（73.03s）。日志`/private/tmp/phase6a1-b-tests3.log`、`/private/tmp/phase6a1-b-tests4.log`。后续补充测试与最终公共门禁进行中，尚不称b验收完成。

## 6A1b 核心停点（2026-10-14）

最终新增定向`ext_item_drop`23项exit0（30.15s，`/private/tmp/phase6a1-b-tests6.log`）；中性遭遇首轮因fixture未声明ownedRegions被原守卫拒绝，修fixture补公开声明后通过。公共`npm run check:modules`、`vue-tsc -b`、`npm run build`全exit0（build5.65s；既有chunk提示）。类型检查期间发现giants类型字面版本未随module/rules同步、测试unused/.at不受目标库支持，均修本批代码后通过。

b核心接线/定向回滚停点已交。独立完整generation差分原保护仍通过；完整录像/seek、各来源组合与所有合法根迁移仍由d汇总，不把现有测试数称为任务书所有交叉组合已验。现在串行进入6A1s，C6尚未冻结。


### 6A1s 实施进度

新增`native.weapon-base-min/max`（HP）、`native.armor-base`（十分之一护甲）、`native.stealth-points`/`native.light-points`（戒指点），均为固定DAG。local flat→increased后按节点单位向下取整，再进原附魔/力量/穿戴公式；真实Combat两条伤害入口原已读取damage-min/max，新增向量检查实掷区间。戒指implicit仍仅原生enchantment一次；regeneration-bonus沿原精确分数，awareness使用×20一次，光照在聚合点数后跳过零点，潜行负点×4后沿原环境/下限。

`EquippedStatItem`新增四槽slot、深冻结moduleData与基底；同种双戒仍按实体ID来源分离，hypothetical保持原槽。`StatSourceProvider.itemPolicy='C6-1'`显式选择owner预算（非按模块名称硬编码）：实例≤24行、附魔pool上限40 quarter、awareness上限160、减伤pool最低−5000bp、速度equipment pool最低−4000bp及最终25…400。StatModifierRow.budget扩展支持more，和其它owner聚合分开。

`foundation.stats.v1`只按实际已注册key返回规范排序/去重的metadata及指纹。growth.attributes.v1仍unavailable，不新增growth属性映射，adept→titan；未修改growth身份。声明initializeHealthOnBirth只在真实非复制、原满血新生宿主安全点初始化，之后升容不补。纯知识刷新与机械dirty分开；原生正附魔戒指鉴定若实际点数改变仍机械dirty。

首轮原属性四文件115项112过3败：growth的base('native.stealth-range')因新DAG依赖拒绝，修生产`nativeTemplateBase`，只递归L0原生节点不收集provider；旧测试未改。第二轮含新向量5文件129项全过（40.56s，`/private/tmp/phase6a1-s-tests2.log`）。增量46项45过1败是新foreign fixture复用错误labelKey，被文本owner守卫拒绝，正在修fixture命名并复验。尚未宣称s完成。

## 6A1s 核心停点（2026-10-14）

新向量17项（首轮16过，foreign fixture labelKey修正后定向1过）与原review29项通过；之前原属性全4文件115项已与新向量一起通过。新增验证实际伤害掷骰端点、其它owner附魔/速度/减伤pool不被C6截断、combat真实注册键存在与growth缺能力fallback。无旧断言修改。最终boundary+测试依赖、vue-tsc、build均exit0，build9.53s（现有chunk提示）。日志`/private/tmp/phase6a1-s-tests3.log`、`-tests4.log`、`-boundary.log`、`-types3.log`、`-build.log`。

stats.ts有意解冻增量为装备事实、provider策略/出生声明及more budget；原StatQuery方法保持，worldSdk/edibleSdk不改。最终散列在d统一发布。s接线停点已交，save/load/seek/命令知识同步联合矩阵在c/d收口。串行进入6A1c。

### 6A1c 实施进度

新增`Core/ItemCommands.ts`宿主私有WeakMap计划，四类声明create/filter/salvage/identify；公开payload仍ext:command。preview使用真实C5材料/堆叠模拟，按移除输入后容量预检，材料最多99/堆；whole-item分解1–26件，每件100 tick，identify指定本owner材料10单位/100 tick。计划CAS包括完整序列化背包事实、四槽ID、原对象身份、模块revision、位置、容量/预留。唯一由公开knowledge判定且必须确认；状态revision严格+1。未放开任意callback写Item。SDK新增materialDefinitionId只读事实及命令kind/materialDefinitionId约束，补原初始化校验对白名单itemCommands.create的识别。

知识/装饰为会话绑定，project内可读raw，name/appearance只读脱敏冻结DTO；floor只留rarity，未知row剔除机械身份，未知戒指剔除baseId，诅咒缺可靠暴露位始终不透传。无位置getter按floor，铭文最后拼接；幻觉和记忆入口不调用扩展投影。自动拾取走已录像filter，显式pickup仍原生入口。原生identifyInstance/种类鉴定/击杀熟悉度/穿戴熟悉度同步自有data；受控trigger揭示仅宿主入口，非collect首次触发。

首轮新17项全部在建局前失败：初始化旧入口只认commands，补itemCommands.create白名单，不改守卫。第二轮14过3败：纯知识揭示误用通用事务导致回滚替换runtime/RNG内部引用，改为纯知识写集原位恢复；其余新测试修复100tick原生回合会增加机械revision（改在回合开始前断言）与savedAt非机械时间戳。追加命令失败使用runtime原位状态checkpoint、RNG图恢复；generation回滚清理新装饰绑定。s复核补最终defense≤220 clamp，限定声明C6策略且实际护甲行的provider。

## 6A1c 核心停点（2026-10-14）

`ext_item_commands`/`ext_item_presentation`与原`b_1a_identification`/`b_1b_identification_persistence`/`x3b_item_details`五文件78项exit0，125.24s（含原26层物品哨兵，未调用CE）。追加容量/跨owner/只读指针/冲突注册/prepare越权注入后，新命令18项+i18n26项44项exit0，27.92s；上一轮公共源码守卫57项56过1败为两个动态i18next.t调用，改用现有worldText扩展桥后复验通过。无旧断言变化。日志`/private/tmp/phase6a1-c-tests3.log`、`-tests4.log`、`-tests5.log`。

boundary+测试依赖exit0；最终vue-tsc exit0，build exit0/5.87s（原chunk警告）。types曾因ReadonlyJson数组联合不能自动收窄失败，补显式只读record收窄后通过；未改配置。实际types/build日志`-types6.log`、`-build.log`。c核心停点已交；确认/知识的完整录像、组合与格式在d收口。SDK仍未冻结。

### 6A1d 进度：身份、集成与真实codec测量

统一候选15/7/4/2已实施：WholeRunSnapshot、RecordingV4、RecordingFormat、Game header/snapshotCodec、RecordingDigest codecIdentity同批更新；旧whole-run6严格拒绝。worker直接复用computeCheckpoint，不复制常量。moduleData保持native，并以`knowledge['item-data.<id>']`再哈希一份以捕获任意owner的部分known变化，不解析私有schema；这是摘要投影，非第二份持久物品真相。无Game新字段；记录合同登记会话缓存排除。

首轮集成因新测试未套installed-package guard被依赖检查拒绝，补原有installedOptionalModules用法，未修改检查器。13项第二轮11过2败：所选7309首层没有任何装备转换，不能当自然拾取前提；只读实测seed42实际有id13 dagger，改新测试seed。自然寻路→拾取→装备→比较→卸下→丢弃→拾取→分解→save/load/replay/seek已定向通过。另一项发现测试harness未安装descriptor locales，补测试harness资源安装，生产文本仍走worldText，待复验。十组烟测与2048边界首轮已通过，最终同候选重跑。

新增`src/ext/testing/probes/phase6a1-size-probe.mjs`（必要共享清单外测量文件）完成首次生产codec复测。固定输入及抽样次数/分布和6A0完全相同，owner改为测试c6fixture，以真实纯包validator验证值；**未安装loot、不代表真实loot manifest已验**。2000件按26背包+四层494/494/493/493根；真实Item字段→serialize/deserialize→Game.toSnapshot/JSON/UTF-8→Game.loadSnapshot，逐件无损、双流不变，源文件测量前后散列一致。没有DTO覆盖。Node24.19.0、预热3/15样本、nearest-rank P95；初轮与集成/寻种子进程有竞争，性能非独占。完整小JSON证据`/private/tmp/phase6a1-size.json`，原始日志不提交。

| 分布 | 控制/带数据完整UTF-8字节 | 净增/每件字节 | 生产投影+编码 median/P95 ms | parse+生产load median/P95 ms |
| --- | --- | --- | --- | --- |
| mixed | 8,376,824 / 9,180,932 | 804,108 / 402.054 | 291.650 / 297.962 | 197.936 / 216.896 |
| 五词缀 | 8,376,772 / 9,501,204 | 1,124,432 / 562.216 | 392.417 / 418.797 | 254.287 / 271.048 |
| 六词缀 | 8,376,819 / 9,630,820 | 1,254,001 / 627.0005 | 429.381 / 434.889 | 266.418 / 322.335 |

与6A0每件净增恰多5B，为owner名`c6fixture`对`loot`的包装差；实例值字节748108/1068432/1198001保持。6A0只有DTO覆盖/编码，本次生产投影含全根/owner预算和validator校验，不能拿两者时间相减宣称回归或增量成本。最大完整快照9.185MiB，64MiB仅粗算最多6份，未削减缓存校验/预算。出生数据/持久validator成本如实纳入测量，未缩小样本或放宽预算。

### d 补充：真实链、性能与冻结口径

新增十组引擎烟测覆盖经典、扩展空、原七模块、fixture及六种相关安装；均由公开命令录制、save/load、逐事件replay、seek、续录验证。seed42自然链另覆盖真实击杀、四槽装备、唯一分解No/Yes、十碎片鉴定、收据不返还。容器合法迁移用C5真实存取事务，保持同实例/ID；它是可信事务专项，不冒称自然寻路录像。escrow只接受原C5材料，C6装备不强行伪造合法工作输入；其编码坏行通过全entityGraph校验拒绝。

七个新增文件首个完整d批次100项exit0/158.23s（`/private/tmp/phase6a1-d-new-all1.log`）；之后追加自然击杀链定向1项exit0/18.59s（`-d-journey1.log`）、混合原生/数据重复ID双顺序拒绝、giants公开形态查询与真实split交接；最终计数以下方收尾批次为准。同步与异步测试补真实WorkerRecordingBackend的transferable消息协议及失败fallback；engine-only假worker传输实际computeCheckpoint，**未运行浏览器Worker线程**。

`src/ext/testing/probes/phase6a1-perf-probe.mjs`实测（Apple M5、darwin-arm64、Node24.19.0，四槽C6装备、一个owner）：查询预热50/样本500，hypothetical预热10/样本100，八件死亡提交预热3/样本25，nearest-rank P95。输出`/private/tmp/phase6a1-perf.json`。

| 测项 | median / P95 ms | 设计目标与结论 |
| --- | --- | --- |
| 缓存查询 | 0.003 / 0.003959 | P95≤0.01，通过 |
| clear后冷查询 | 0.168750 / 0.189959 | P95≤0.1，超目标 |
| 全键known-only装备比较 | 5.265375 / 5.474542 | ≤2，超目标 |
| 八件完整死亡提交 | 57.352917 / 67.809458 | 含完整世界checkpoint、8次抽骰、校验/装配/落点/settle/发布；远高于1ms生成目标，不宣称达标，也不把完整死亡耗时等同单件纯生成耗时 |

冷查询包含签名、固定DAG依赖与provider收集/预算；比较重复求值全部key；死亡测量包含整个原生对象图checkpoint和事务验证。此为代码路径范围定位，非采样CPU剖析；未通过省校验、修改目标或减小样本掩盖超标。纯loot目录生成≤20ms、真实长局与M4平衡不在本次实测范围，仍待6B1/后续排期。

保守决定：growth.attributes.v1未发布就unavailable/adept→titan；vault任何已定义qualifiers整次原生回退；诅咒缺明确暴露事实不显示；未知出生无掉落；容量边界按当前C5的7168新增接纳与C6的8192区分。giants无掉落provider仍新增foundation.itemDrops遭遇登记元数据（module/rules1.1.0），不新增骰或掉落。上述均不读私有模块state推断能力。

### d 首败与生产复修（非黄金豁免）

- giants原法捕获3文件5项：4过/1超时，exit1/207.27s（`-d-giants-capture.log`）；spine单独复跑仍62.95s超过原60s（`-d-spine-verify.log`）。定位新增hasItemDrops(active含声明)导致无provider普通死亡也取完整世界checkpoint。修Game入口：居民/kill provider/实际遭遇主体才需该外层；真实掉落和遭遇结算写集不缩减。spine+真实giants/C6 split两项exit0/35.02s（`-d-giants-recheck.log`），原超时与断言保持。
- 严格payload复查发现filter.classes用String转换可能接纳嵌套数组，改生产要求typeof string，新增拒绝且不调用provider/不耗资源的负例。
- d首轮旧codec摘要oracle仍能独立计算，只有写死旧身份的root失败；按新15/7身份更新固定向量。combat/giants2合同中的foundation14断言更新15；narrative2_imports四个声明指纹用该测试原declarationHash计算器重取（descriptor/types/WholeRunSnapshot/RecordingV4），未放宽守卫、未改Game字段指纹或world/ui指纹。属于当前正式接口/格式登记，不是降低断言语义；不做无收益反事实。

## 实际接口与验收映射（6A1d冻结表）

| 条目 | 实际实现及测试见证 |
| --- | --- |
| C6-D1 属性接线 | stats.ts + NativeStatKeys/Sources + ItemStatPolicy；ext_item_stats及原stats四文件；growth unavailable/fallback，公开stats/encounters查询 |
| C6-D2 收据/遭遇 | itemDrops.ts；128位unique目录+128活动遭遇×64主体，终结分配ordinal；ext_item_drop逆序、split、lost、reload及真实giants |
| C6-D3 预算 | ItemData.ts + ItemDataValidation；4owner/4KiB/8KiB/深16、C6新根8192；ext_item_data精确边界/UTF8/描述符与ext_item_roots全编码路径 |
| C6-D4 唯一/时间 | ItemCommands；唯一允许+确认、26件2600tick、10材料100tick；ext_item_commands及recording自然No/Yes链 |
| C6-D5 原生回退 | Game.spawnPopulateItem/spawnBlueprintItem；全部qualifiers回退表、26装配、converted=false与generation独立差分 |
| C6-D6 身份/门禁 | 15/7/4/2统一批次；原法重录、开发期相关测试+boundary/test-deps/types/build；不执行CE/全量/全部组合/删除 |
| a 原始数据 | serializeItem/deserializeItem在normalize前验证，save扫机械根；load全原始行再候选校验；历史引用校验但不重复计根 |
| b 掉落事务 | 死亡前native完整checkpoint+runtime状态事务+双流图+ID；roll→校验→顺序接纳→settle→validateSources/reconcile；原carry→C6→DF |
| s 物化/知识 | markItemStatsDirty与markItemKnowledgeDirty分离；满血新生初始化、后来升容不补、降容钳制；同四槽实际/hypothetical |
| c 展示/命令 | itemDisplayName/Appearance.itemAppearance + project/name/appearance；公开ext:command与native item边界；不新增产品UI |
| d 持久/录像 | ITEM_FIELDS moduleData，native+knowledge摘要，extensions.itemDrops；10组生命周期+自然四槽链+256/2048/seek/worker协议 |

固定装配表（运行时由数据目录筛选，测试逐字段核对26项，双随机流零消耗）：

| 类别 | identityId |
| --- | --- |
| 武器12 | `dagger`, `whip`, `spear`, `rapier`, `sword`, `mace`, `axe`, `flail`, `broadsword`, `war_pike`, `war_hammer`, `war_axe` |
| 护甲6 | `leather_armor`, `scale_mail`, `chain_mail`, `banded_mail`, `splint_mail`, `plate_mail` |
| 戒指8 | `ring_of_clairvoyance`, `ring_of_stealth`, `ring_of_regeneration`, `ring_of_transference`, `ring_of_light`, `ring_of_awareness`, `ring_of_wisdom`, `ring_of_reaping` |

排除投掷三种及halberd是批准26基底口径，未删原生生成内容。C5 ration/dagger/leather_armor沿同构造器，原模板联合与SDK字节不变。武甲出生+0；ring enchant±100、熟悉度0…100000为宿主形状安全界，真实loot较窄数值由owner validator/静态包约束。合法强化与解咒后的当前值不按出生等式拒绝；6B3强度重塑未实施。

| 属性/事实 | 单位、顺序、边界 |
| --- | --- |
| native.weapon-base-min/max | HP；本件flat→increased→floor，再进原附魔/有效力量与clumping |
| native.armor-base / native.defense | 十分之一护甲；display armor×10后本件flat/%，再附魔/穿戴；C6护甲参与时最终defense≤220 |
| native.weapon-enchant / armor-enchant | quarter；纯整附魔×4；C6 owner flat pool上限40，不截其它owner |
| native.regeneration-bonus | 原生ring-point；regeneration保留精确有理HP/turn，非把点数直加HP |
| native.stealth-points | 原生点，负点×4、环境折半、最终范围下限仍走原生 |
| native.awareness | search strength；纯点×20一次；C6 flat pool上限160 |
| native.light-points | 与原生ring implicit聚合后进入零光跳过规则；不是最终倍率简单加点 |
| native.attack-speed / move-speed | tick；more的slot='equipment'，C6 pool≥−4000bp；最终25…400 |
| native.physical-damage-taken | C6 increased/more pool≥−5000bp，其它owner保留；无随意截全局来源 |
| monsterScaling | environment行，禁止base/grantPolicy；声明initializeHealthOnBirth，非复制/原满血/首次宿主出生才填新上限 |
| 四槽/sourceId | weapon/armor/left-ring/right-ring；`<owner>.item.<entityId>.*`；同种双戒互异；每实例equipment行≤24、原总256/每owner64守卫仍在 |

能力：`queryOptional('foundation.stats.v1',{keys:[...]})` 最多128，排序去重，available=false代表缺key；返回metadata+fingerprint。`foundation.item-encounters.v1,{}`按owner/templateIds/formIds规范排序，缺声明unavailable/absent。growth.attributes.v1实际仍absent，不因包名猜测；combat容量/恢复仅按真实key查询。能力指纹不是替代6B1的pack/preset规则指纹。

遭遇持久字段为`nextEventId,nextEncounterOrdinal,unique,catalogs,births,encounters`。计数起点1、safe integer溢出拒绝；terminal取当前ordinal再+1，第二登记的遭遇先终结拿1，第一遭遇后终结拿2，所以watermark不会跳过迟到终结。分裂/phase从实际BodyTransitionFact转移subject；任一行政失去令lost=true，最后主体消失后不奖励并删活动行。活动≤128、每行≤64主体、key≤256字符、form必须属于owner所声明模板，births≤32768并随可达actor GC；唯一目录≤128且目录顺序受hash保护，位图固定32十六进制字符。registry不是loot state，不挤入4KiB模块状态；roll settle/命令nextState紧凑UTF8≤4096实际强制。总registry大小由这些计数和已安装静态ID长度约束，没有声称整个foundation仅4KiB。

公开错误对象`ItemDataError.code`实际为C6_DATA/C6_BUDGET/C6_OWNER/C6_VALIDATOR/C6_OWNERSHIP，消息走`ext.foundation.item.invalid`。命令拒绝是现有边界false/null，C6_COMMAND/C6_CAPACITY仅内部抛错后转拒绝，不伪装为另一个公开诊断接口。所有失败保留资源，确认No可依原录像边界留下拒绝决策事件。

候选接口差量：新增itemCommands.kind约束四操作与identify.materialDefinitionId；ItemCommandRead含configuration/equippedIds，ItemFacts含只读materialDefinitionId；ItemKnowledgeProvider明确known/unique/reveal；DropProvider加uniqueCatalog/statKeys，Roll加beginItem分桶；itemPickup为纯自动拾取过滤；公开形态查询为foundation.item-encounters.v1。DropAuthority是宿主类型说明，不提供给模块可调用的prepare/commit服务或自由能力工厂。模块只声明provider，实际一次性计划在宿主WeakMap内。

事务写集：原生world/actor/item图及别名、地层/携带/消息/DF/物化/动作/原生知识、双RNG图与计数、ID和机器allocator、foundation状态与唯一收据、stat缓存/绑定。死亡及生成回滚另恢复所有已有actor的dying/converted-drop弱集合成员，覆盖嵌套死亡成功后外层失败。新增功能均为会话WeakMap或Item字段，没有Game自有字段新增，故U03清单保持；ITEM_FIELDS与recording-digest-contract正式登记。知识更新同时标记Item/runtime录像root并清已知缓存，不以机械revision代替记录通知。

### 格式与黄金重录账

执行同一Node/heap/worker环境。原始文件在`/private/tmp/phase6a1-module-traces-before`只读备份，变化清单在`/private/tmp/phase6a1-module-trace-diff.json`。新政策允许格式直接原法重录；没有迁移旧格式，也没有拿旧文件伪造当前导出。

| 文件/原捕获入口 | 变化范围/结果 |
| --- | --- |
| u_r2/u_r3/u_r4，UR2_CAPTURE/UR3_CAPTURE/UR4_CAPTURE=1 | 3项exit0/89.84s；UR2完全不变，UR3仅120个摘要叶，UR4版本/schema/chainDigest共112叶，其他世界/RNG字段不变；`-d-traces-capture.log` |
| crafting_trace，CRAFTING_CAPTURE_TRACE指定tmp | 按原公开commands跑完取craftingFinal，仅final.digest变化；与foraging捕获合批3项exit0/26.30s |
| foraging_trace，FORAGING_CAPTURE_DIRECTORY指定tmp | A/B原自然捕获，同seed与commands；两文件各仅final.digest变化 |
| giants_trace/giants_spine_trace，BROGUE_CAPTURE_GIANTS_TRACE=1 | 三文件各仅extensionsHash变化，nativeWorldHash/commandsHash/双流/状态相同；通用遭遇登记与giants规则身份属于本步批准的元数据变化，不只称格式外壳 |
| giants2_trace，BROGUE_CAPTURE_GIANTS2_TRACE=1 | lantern/copper仍原seed1/2，命令/双流/战斗事实未变，仅worldHash/finalHash共11/16叶；捕获批次中4项通过，spine超时修复见上 |
| narrative2_trace，BROGUE_CAPTURE_NARRATIVE2_TRACE=1 | five-wizard/cord-normal仍原seed2/1、命令/消息/双流不变；worldHash/finalHash共37/9叶 |
| resident_natural/resident_captive_natural，RESIDENT_FORMAT_CAPTURE指定tmp | 各24个既有checkpoint.digest更新；其余路线/命令/事实不变；与narrative捕获合批5项exit0/369.23s，`-d-ns-capture.log` |
| replay_import_ui，FORAGING_IMPORT_CAPTURE指定tmp | 原39公开命令得到foundation15文件59162B，SHA256=f1b284e4bd1ae84d85c1cd091b66b91f87d77d42e42142e18576e49b7c255f3f；旧14文件保持，新增拒绝保活局用例；捕获1项exit0/4.90s |

生产复查后增加：嵌套死亡converted弱集合恢复、generation同集合恢复、声明形态匹配、filter.classes严格类型；这些不改变成功路径的原自然命令/双流，最终相关批次使用这些修复后的源码，早期捕获模式本身不冒称最终普通门禁。

### 6B1交接清单（任务书§10）

1. 可复现基线：开工ff9dee3/ext/phase6；最终候选源码清单散列见下。**维护者验收合入完整commit：待维护者填写**，不拿开工HEAD冒充。
2. 实际导出：itemSdk.ts、types.ts、stats.ts、descriptor.ts、公开queryOptional、itemHarness与fixture列入下方散列；真实provider从SDK类型声明编译并由Game运行。worldSdk/edibleSdk原散列保持。
3. 固定输入93523fc596b173396a0d526ab2073b327ff7cf3e；33非符文+21符文变体+8唯一、scarce/standard/bountiful、遭遇5000/10000/5000、warding仅甲、bountiful elite1–3不重新审批。保留纯生成/严格校验，M4仍后续。
4. 实例：6B1只能moduleData.loot保存一份LootItemDataV1，v1/corrupted/数组顺序不重排；6词缀/8固定行是纯包上限，底座不硬编码私有结构。owner注册与通用4/4096/8192/16预算、非堆叠、全行校验、缺包/坏档拒绝已实现。
5. 装配：上表26基底与固定构造器；C5三模板不扩联合；无随机spawn；ring implicit一次，武甲出生+0，合法强化/解咒当前值可存；6B3符文强度尚未重塑。
6. 生成：SDK randomInt闭区间，底层lo=hi不消耗实质骰（调用仍计请求预算）；beginItem单调桶，64/件512/事件；8装备+金币、部分接纳/全跳过/唯一实际落地记账。纯包腐化/命名/金币内部次序仍由固定输入实现；底座不另写生成器。
7. 遭遇：上述字段/上限/终结全序、giants声明真实接线；6B1不读giants私有state，不开放part/craft/site。新queryOptional只公开声明形态，不暴露活动记录或actor写口。
8. 属性：上表固定节点/单位/四槽/sourceId/预算。6B1把草稿显式转成合法StatModifierRow，不能类型强转，β临时公式换hypothetical；未知机械仍生效，knownOnly与缓存独立。
9. 可选能力：真实key查询/规范指纹；growth缺属性能力的adept→titan已定，combat按key，giants按公开声明；静态pack+availability+manifest preset共同构成6B1有效目录身份。
10. 命令：create/set-filter/salvage/identify-shards对应kind，严格v1、CAS/一次性计划、唯一No/Yes、100 tick规则与失败0成本；未注册socket/工位占位命令。preset同时进manifest与恰一次create。
11. 显示：四种location及保守未知投影；六token item-common/uncommon/rare/epic/unique/corrupted；nameKey必须ext.<owner>.前缀，原生名→装饰→铭文。β需扩container联合；通用真实UI/主题验收留6B2，不把engine-only测试称浏览器验收。
12. 6B1身份计划：真正安装时显式分配新的module/rules/state（由集成人验收值，不能沿用纯输入0.1.1）；机械pack/availability/preset纳入rules，locale排除。loot.shard通过worldDefinitions.items注册MATERIAL/stack99/无moduleData，沿C5存取；无虚构registerItemDefinitions。
13. dot写边界：仅src/ext/modules/loot/**和自身文档/descriptor/locales/test-suites；自动发现沿scripts/test-discovery.mjs + scripts/check-test-dependencies.mjs。共享缺口交本地补，禁止模块私引Game/runtime或改package/其它模块。本轮不派发dot、不安装loot。
14. 6B1另验真实loot自然完整闭环及包内schema/预算/fallback/指纹；本次中性fixture和生产codec提供底座证据，不能代替内容验收。完整npm/test:ext/正常启用组合/全删及浏览器/最大负载长局在后续统一排期；CE对照按新政策不执行。6B2/6B3/6C未实施。

新增七文件最终批次：107 passed / 7 files / exit0 / 150.31s（`/private/tmp/phase6a1-d-new-final.log`）。随后只将encounterForms构造的可选空generation声明改成空数组安全处理；将由drop专项复核，未改已验行为。原有直接相关42文件正在复跑。

### 实施后符号锚点

以下为当前候选代码位置，和开工表区分；后续维护者若移动代码以符号名为准。

| 实际文件:行 | 符号 |
| --- | --- |
| `src/engine/Core/EntitySnapshot.ts:12` | `const ITEM_FIELDS` |
| `src/engine/Core/WorldItemRoots.ts:6` | `function forEachItemRoot` |
| `src/engine/Core/ItemDataValidation.ts:24` | `function validateSnapshotItems` |
| `src/engine/Items/FixedItemAssembly.ts:38` | `function assembleDropItem` |
| `src/engine/Core/Game.ts:1212` | `private spawnPopulateItem` |
| `src/engine/Core/Game.ts:1323` | `private spawnExtensionDrop` |
| `src/engine/Core/Game.ts:1416` | `private spawnBlueprintItem` |
| `src/engine/Core/Game.ts:11067` | `public killMonster` |
| `src/engine/Core/ItemCommands.ts:66` | `export function prepareItemCommand` |
| `src/engine/Core/ItemCommands.ts:76` | `export function commitItemCommand` |
| `src/ext/runtime.ts:842` | `queryOptional(` |
| `src/ext/runtime.ts:1863` | `revealItemKnowledge(` |
| `src/ext/runtime.ts:1918` | `resolveItemDrop(` |
| `src/ext/stats.ts:71` | `export interface EquippedStatItem` |
| `src/engine/Stats/NativeStatKeys.ts:29` | `export const NATIVE_STAT_KEYS` |
| `src/engine/Stats/NativeStatSources.ts:80` | `export function equippedStatItems` |
| `src/engine/Items/ItemLoader.ts:862` | `public static identifyInstance` |
| `src/engine/UI/Appearance.ts:493` | `export function itemAppearance` |
| `src/ext/descriptor.ts:5` | `export const FOUNDATION_PROTOCOL` |
| `src/engine/Core/RecordingDigest.ts:20` | `codecIdentity` |
| `src/engine/Items/Item.ts:54` | `moduleData` |
| `src/engine/Core/WholeRunSnapshot.ts:37` | `WHOLE_RUN_SCHEMA` |
| `src/engine/Core/Game.ts:12093` | `loadSnapshot` |

### 最终门禁命令与文件清单

统一环境：

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
```

新增七文件命令（最终结果见后表，原107项批次保留）：

```sh
node node_modules/vitest/vitest.mjs run src/test/ext_item_{data,drop,stats,commands,presentation,roots,recording}.test.ts --maxWorkers=2
```

直接受影响42文件批次的完整实参（node node_modules/vitest/vitest.mjs run，加--maxWorkers=2；不等于完整npm套件）：

```text
src/test/u_01_instance_snapshot.test.ts
src/test/u_03_whole_run_snapshot.test.ts
src/test/ext_world_items_roots.test.ts
src/test/ext_world_work_boundaries.test.ts
src/test/ext_world_work_transactions.test.ts
src/test/ext_generation_checkpoint.test.ts
src/test/ext_generation_checkpoint_differential.test.ts
src/test/ext_stats_pipeline.test.ts
src/test/ext_stats_native.test.ts
src/test/ext_stats_runtime.test.ts
src/test/ext_stats_review.test.ts
src/test/ext_combat_neutral_differential.test.ts
src/test/ext_slaying_alignment.test.ts
src/test/b_1a_identification.test.ts
src/test/b_1b_identification_persistence.test.ts
src/test/x3b_item_details.test.ts
src/test/u_27_recording.test.ts
src/test/x2a_recording_checkpoint.test.ts
src/test/x3b_display_recording.test.ts
src/test/u_r2_trace.test.ts
src/test/u_r3_trace.test.ts
src/test/u_r4_trace.test.ts
src/test/ext_recording_v4_digest.test.ts
src/test/ext_recording_v4_snapshots.test.ts
src/test/ext_recording_v4_storage.test.ts
src/test/ext_recording_async.test.ts
src/test/ext_foundation_contracts.test.ts
src/test/ext_compatibility_diagnostics.test.ts
src/test/replay_import_ui.test.ts
src/test/phase4a0_spatial_differential.test.ts
src/test/p1_30_i18n_gate.test.ts
src/test/u24_hardcoded_text.test.ts
src/test/repo_hygiene.test.ts
src/test/test_suite_membership.test.ts
src/ext/modules/growth/tests/ext_growth_combat_stats.test.ts
src/ext/modules/combat/tests/combat2_content.test.ts
src/ext/modules/combat/tests/combat2_persistence.test.ts
src/ext/modules/giants/tests/giants_contract.test.ts
src/ext/modules/giants/tests/giants2_contract.test.ts
src/ext/modules/giants/tests/giants_transitions.test.ts
src/ext/modules/giants/tests/giants2_persistence.test.ts
src/ext/modules/narrative/tests/narrative2_imports.test.ts
```

最终复查另外收紧命令revision为非负安全整数且未耗尽，避免受信模块的错误state借用字符串加法；金币计数溢出改用同一已本地化ItemDataError/C6_BUDGET，新增完整死亡回滚用例。公开appearance.marker保留受限字符串形状，当前原生Appearance只消费前景colorToken，保留glyph；未承诺marker徽标UI，属于6B2显示接入范围。


42文件批次exit1：708项中684过/24败，40文件通过，903.20s（`/private/tmp/phase6a1-d-old-final1.log`）。失败仅4A0对象图黄金4项与giants2_contract旧版本输入前提20项。40通过文件含完整原generation写集差分、U03、stats/战斗中性、鉴定/细节、录像/async/存储/seek、giants真实分裂和持久链；不是缩小断言或跳过失败。

giants2_contract保留历史JSON字节SHA及内容数组：raw1.0.0明确拒绝，测试在当前1.1.0版本外壳下验证相同历史内容/子包；负例恢复到真正内容校验，不让旧版本提前拒绝掩盖错误。既有“不同规则包存档/录像拒绝保活局”继续用实际生成的当前格式旧内容包，未篡改recording manifest，未迁移旧存档。同步当前giants-config示例与module/rules版本，历史giants2.dot-package原文不改。断言语义仍是内容不漂移、坏包拒绝、错规则保活局；按新政策不需反事实。

4A0原捕获输出在`/private/tmp/phase6a1-p4-capture`（大对象图不入仓）；四组×13场景比较仅86个sha256变化，所有对象计数、RNG状态/计数与消息字段逐字段相同。变化是15/7 codec与当前初始/周期摘要身份；按原捕获器重录固定JSON，不更改graphDigest/任何过滤规则。普通模式复核另列，捕获模式不代替正常断言。

最终boundary首轮exit1：新测量脚本放scripts时被正确识别为生产文件，禁止引用测试harness。将两份脚本迁入src/ext/testing/probes/，不改boundary规则/白名单。早期测量命令从旧scripts路径执行，复现实物与最终复测使用现路径。最终vue-tsc已exit0。

最终修复后批次：新增七文件109项、giants2_contract 21项（普通模式）、4A0原捕获4项，合计134 passed / 9 files / exit0 / 160.18s（`/private/tmp/phase6a1-d-final-fixes.log`）。该批覆盖revision/金币溢出、声明形态、完整回滚等最终生产改动；捕获4项仍待普通模式复核。boundary与静态测试依赖复跑exit0（`-d-boundary2.log`）；vue-tsc -b exit0（`-d-types-final.log`）；build exit0/5.89s（`-d-build-final.log`），保留既有chunk体积提示。

### 既有九冻结导出核对

对开工HEAD ff9dee3逐字节比较，仅授权的stats.ts变化，其余八文件及整个forageFixture树保持；没有宣称九文件全不变。

| 路径（src/ext/） | 最终SHA-256 | 对开工HEAD |
| --- | --- | --- |
| `worldSdk.ts` | `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343` | 保持 |
| `edibleSdk.ts` | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` | 保持 |
| `worldEdible.ts` | `7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67` | 保持 |
| `kindKnowledge.ts` | `4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f` | 保持 |
| `actorNeeds.ts` | `8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e` | 保持 |
| `stats.ts` | `c04074552addef6c6bb66abf2ed95da93743b5a9e611f59de50e6f4067b7ac31` | 授权扩充装备DTO，重新冻结 |
| `testing/worldHarness.ts` | `a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0` | 保持 |
| `testing/forageHarness.ts` | `ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38` | 保持 |
| `testing/fixtures/forageFixture/index.ts` | `e775b869c5469d10efd98cd0d36a69c3f642a9c79bf35606a173d86e140eda52` | 保持 |

### 实际SDK导出与闭包清单

`docs/ext/phase6a1.sdk-manifest.json`逐文件登记六个公共SDK入口及harness/fixture入口的相对字面量import/re-export闭包（含TypeScript import()类型），共283文件；类型依赖也计入，未把类型消除误当源码无需交接。动态生产目录仍由module boundary与test-dependency约束，清单不是允许dot私引engine的白名单。闭包SHA-256：`38edca12c20373b945b780fe5f3f60d6016d89b3af4a57b225364b399dc7b416`（对按path排序的`[{path,sha256}]`做UTF-8紧凑JSON后求SHA-256）。

| 入口/见证 | SHA-256 |
| --- | --- |
| `src/ext/itemSdk.ts` | `8139ea4b65533225d23810575dfd861b52225bedb7677f3f0319b7eb918a6496` |
| `src/ext/types.ts` | `96922b6d5d7131a3e397786cc7dfb906d226b6c40741556c8167ad62b64fd15c` |
| `src/ext/stats.ts` | `c04074552addef6c6bb66abf2ed95da93743b5a9e611f59de50e6f4067b7ac31` |
| `src/ext/descriptor.ts` | `7d9046a87dd123dd1e43b28883ec83eb22604a5a82a66655a7d19e46a879225e` |
| `src/ext/testing/itemHarness.ts` | `2c58ca72a874325859a8466827521733eb7c975b43c584f3619809fd7def2109` |
| `src/ext/testing/fixtures/itemFixture/index.ts` | `8a2570f9b8adf75b7f9711ae251c4327b21556ac965bb6a5cc71f8f492904511` |

itemSdk实际导出：`ITEM_SDK_VERSION`, `ItemModuleData`, `ItemDataPhase`, `ItemFacts`, `ItemDataValidationContext`, `ItemDataValidator`, `ItemContribution`, `ItemClass`, `DropSource`, `At`, `DropEvent`, `NativeAssembly`, `DropItemSpec`, `DropRollContext`, `DropProposal`, `DropAcceptance`, `DropPlanHandle`, `DropProvider`, `DropAuthority`, `KnownItemFacts`, `TextRef`, `ItemPresentationProvider`, `ItemCommandRead`, `ItemCommandProposal`, `ItemCommandProvider`, `ItemKnowledgeProvider`, `ItemEncounterCapability`。完整签名同步C6合同§4；版本常量`ITEM_SDK_VERSION=1`。贡献入口为`ExtensionModule`上的itemDataValidators/itemDrops/itemEncounters/itemKnowledge/itemPresentation/itemCommands/itemPickup，名称以types.ts真实声明为准；stats的`EquippedStatItem`四槽事实和`StatPipeline`仍沿既有接口。

类型见证`createItemFixture/createItemDropFixture/createItemEncounterFixture/createItemStatsFixture/createItemCompleteFixture`和`descriptor/completeDescriptor/journeyDescriptor`均经vue-tsc；`createItemHarness(options: Partial<WorldHarnessOptions> = {}, overrides: readonly ModuleDescriptor[] = [])`返回原worldHarness并安装测试locale/覆盖描述符，未改冻结worldHarness/forageHarness。错误类由宿主ItemData.ts实现，稳定code见上，不虚构itemSdk导出的Error类。

### 最终生产体积/性能复测

两份`src/ext/testing/probes/phase6a1-{size,perf}-probe.mjs`依次以前述Node/heap运行，exit0（`/private/tmp/phase6a1-d-size-final.log`、`-d-perf-final.log`）。最终JSON沿原路径，初轮副本改存`phase6a1-{size,perf}-initial.json`。本轮仍与一个叙事路线捕获进程并发，不保证机器独占；采用相同预热/样本/nearest-rank算法，没有因超标换口径。体积探针全过程源码散列相等，三个分布字节数/每件净增与初轮逐字节一致。

| 分布 | 生产投影+编码 median/P95 ms | parse+生产load median/P95 ms |
| --- | --- | --- |
| mixed-vault | 279.470 / 281.190 | 190.421 / 212.958 |
| rare-five | 373.427 / 375.124 | 243.978 / 261.276 |
| rare-six | 406.524 / 417.433 | 265.018 / 285.580 |

| 测项 | median/P95 ms | 结果 |
| --- | --- | --- |
| 缓存查询 | 0.002958 / 0.003791 | P95≤0.01通过 |
| 冷查询 | 0.170791 / 0.192875 | P95≤0.1超标 |
| 全键已知装备比较 | 5.243709 / 5.569834 | ≤2超标 |
| 八件完整死亡提交 | 56.448375 / 58.093750 | 高于1ms单掉落生成目标；范围不同，不宣称达标 |

八件事务新增分段wall-time定位：完整世界checkpoint median/P95 **48.716/50.282 ms**，drop service（含8次随机请求、固定装配、owner校验、落点/接纳/settle/发布）**6.430/11.051 ms**。checkpoint占整体中位数约86.3%；分位数不作相加。仍不省去原子回滚保护，也不把服务总时长除8当作真实loot纯生成性能。缓存未命中与hypothetical超标属于已公开性能限制，后续优化需保留本轮完整校验和状态差分。

叙事九条既有格式fixture的首个原法捕获命令在第九条seed1重复旧寻路搜索，前八条lifecycle.json已写出（表示save/replay/seek/续录断言全部经过）；主动Ctrl-C退出130，不登记为九项通过。新增显式测试捕获开关`BROGUE_RECAPTURE_NARRATIVE2_SEED=1`只复用readTrace(name).seed，保持captureNatural算法、普通模式全部断言和900s限制。第九条使用原黄金seed2，不重新选择世界，不修改生产规则，复验结果见后。该额外共享测试改动仅缩短纯格式重录的历史种子搜索，未改变断言语义，无需反事实。

普通模式黄金/守卫闭合：4A0、resident_natural、resident_captive_natural、p1_30_i18n_gate、u24_hardcoded_text、repo_hygiene、test_suite_membership共7文件44项，exit0/317.95s（`/private/tmp/phase6a1-d-golden-verify.log`）。4A0四项首败至此按原断言闭合，居民两个新摘要也由非捕获模式复验。

额外共享脚本差量：`scripts/phase6a0-size-probe.mjs`只将临时解包/读取位置从`src/ext/modules/loot`改成`src/ext/inputs/loot`，纯输入、相对依赖、采样与编码算法均不改。最终审计曾恢复旧路径核实必要性，boundary确实exit1（`-d-boundary-final.log`）：第60行load resource被判跨模块实现引用。重新保留这两行最小修正，不扩大checker白名单。这是旧6A0测量脚本的临时输入组织修正，不是安装loot。

最后一条叙事定向运行曾两次因Vitest将过长参数化标题截断而匹配0项（`-d-narrative-fixed.log`、`fixed2.log`，exit0但全skip，不计通过）。用vitest list确认实际标题后按唯一前缀combo-narrative-growth-combat运行；普通模式另验其余八条，避免将已中止捕获进程当作整批通过。

最终静态门禁复核：`npm run check:modules`（boundary + test-dependency）exit0，日志`/private/tmp/phase6a1-d-boundary-final2.log`；新增捕获开关之后`npm run build`（包含vue-tsc -b）exit0，Vite 8.04s，日志`-d-build-final2.log`，仍仅既有chunk体积警告。未改构建警告阈值。

叙事前八条普通模式：`vitest run src/ext/modules/narrative/tests/narrative2_combinations.test.ts -t '^(?!.*combo-narrative-growth-combat)' --maxWorkers=2`，8 passed/1有意排除、exit0/243.50s（`-d-narrative-eight-verify.log`）。第九条是另一独立定向捕获/全生命周期验证，不把skip算通过。生产terrain字段读者白名单专项 `c_4a_terrain_catalog -t 'promote/fire 类字段的生产读者'` 1 passed/29非本任务项未选、exit0/4.32s；只检查源字段访问者，不执行CE规则对照。

最终叙事九文件逐字段变化：empty 3个摘要、narrative单包37个、六对安装各9个、七包37个；均仅worldHash/finalHash。第九条固定seed2、1569条寻路命令、1620事件与旧黄金相同，消息、出生记录、双流和命令没有变化。逐叶路径/前后文件SHA在`/private/tmp/phase6a1-module-trace-diff.json`；所有21个模块trace/route文件均按原捕获器产生，不手填摘要。

候选源身份：开工ff9dee3 + 本工作树82个已修改/新增src或scripts文件，`candidateChanges`逐文件记录在`docs/ext/phase6a1.sdk-manifest.json`。该数组按path排序、UTF-8紧凑JSON求SHA-256为`0036bb5482660d8109eb8e1ace7181fc1a067cf65991328531f1431cf9773625`；公共SDK闭包仍为前述283文件/38edca12…b416。基线+变更数组可复核整个候选，清单包括测试/黄金/测量脚本，未将其冒充全部生产文件。文档不参与该源数组，自身不做循环散列。未来合入commit继续为null/待维护者填写。

最终`npm run test:drift -- --maxWorkers=2`：8 files/16 passed，exit0/247.94s（`/private/tmp/phase6a1-d-drift-final.log`）。两个原生生成基线及各module drift均普通模式通过；未触碰原生生成基线/CE对照。最终hash核对283个SDK闭包行+2见证+82候选改动行，共367行全部匹配；23个新增文件均小于1MiB，变更文本无CRLF，git diff --check通过。

清单末次复查将TypeScript字面量import()类型边和harness/fixture入口也纳入遍历；最终闭包283文件（早先278为仅六入口的中间清单），aggregate为38edca12…b416；SDK实现及82文件候选源码散列均未改变。该扩充只是补足交接散列覆盖，不是扩大模块允许import的边界。

第九条原seed2捕获+完整生命周期组合运行exit1，Vitest报900000ms超时；实际1788.27s（测试1783.82s，`/private/tmp/phase6a1-d-narrative-fixed3.log`）。末尾`*-lifecycle.json`已生成，证明所有保存/加载、逐事件回放、四次seek、续录断言都执行到末尾，1622事件/OOS=0；但不把该超时运行算门禁通过。1622事件低于2048周期快照边界，几次seek都从种子重放；捕获、全图证据导出和验证叠加耗时。随后以相同最终黄金单独运行第九条普通模式，保留900秒限制，结果见后；未改测试断言、路线或超时值。

基线政策补核：`phase5-final-fix.report.md` §3/§4及第54、78、109行，已将这个精确N2七包900s用例列为批准的非阻塞性能调查；`phase5-final-policy-gates.report.md:82`同时保留独立ext该行588.337s通过和npm超时，两者不覆盖。不是本次创设豁免，更不扩到新C6测试或其它门禁；不因这一个历史性能项扩成完整阶段5优化工程。当前普通模式复验仍以前台实际退出结果登记，不能用历史通过替代本次结果。

## 6A1d 停点与本地冻结（2026-10-14）

第九条叙事路线普通模式独立复验：1 timeout/8有意未选，exit1/1218.42s（`/private/tmp/phase6a1-d-narrative-nine-verify.log`）。原900秒门限、1622事件和全部save/load/replay/四次seek/续录断言保留；捕获模式超时不改判为通过。前八条普通模式通过；第九条普通模式仍900秒超时，按阶段5最终报告已有的精确非阻塞性能范围保留，不称该项门禁通过。捕获末尾完整lifecycle证据确认1622事件零OOS及全部内容断言执行到末尾；此事实不抹掉超时。未运行128/256组合矩阵。

| 最终验证范围 | 结果 |
| --- | --- |
| 七个C6新增测试文件 | 109项通过；最终修复同批134项中含giants2_contract 21与4A0捕获4项 |
| 原直接相关42文件 | 初批684/708；24项首败已由giants2_contract与4A0普通模式定向关闭，未伪报初批exit0 |
| 4A0、两条居民路线、四类守卫 | 普通模式7文件44项通过 |
| 九条叙事固定路线 | 普通模式8项通过，第九条仍属既有900秒非阻塞性能调查；capture与中止历史保留 |
| test:drift | 8文件16项通过；原生生成基线不变 |
| terrain生产读者、文档声明 | 1项白名单守卫通过（无CE对照）；合同49锚点/类型错误0 |
| boundary / 测试依赖 / vue-tsc / build | 全部exit0；既有大chunk警告未调整 |
| 生产codec/性能/散列 | 2000件三分布无损；性能限制如上；283文件SDK闭包和82文件候选变化已逐字节核对 |

最终身份：**foundation15 / whole-run7（schema v7）/ recording4 / origin2 / world5 schema4 / worldSdk1 / edibleSdk1 / itemSdk1**。giants module/rules1.1.0，state/schema1；growth未发布属性能力，身份保持。C6-D1至D6的实际合同、预算、错误码、能力响应、固定向量、计划与回滚写集、知识/显示/命令、provider类型见证及SHA均已登记；任务书§10除维护者未来合入commit外有实物。

本地冻结保留既有N2七包900秒非阻塞调查，也不代表性能目标全部达成：冷查询与全键hypothetical超目标，八件完整死亡提交的主要成本是原子checkpoint，不能用含装配/校验/提交的时长冒充纯loot生成。测量带并发竞争说明；不放宽预算或省校验。完整npm/test:ext、完整组合、真实删除、浏览器/Worker线程、真实loot目录与自然长局/M4均未验证，按后续阶段排期；CE对照按现行政策不执行。

**维护者验收合入完整commit：待填写。** 本轮未commit、未暂存、未push、未安装loot、未派发6B1，未开6B2/6B3/6C。本地候选基线、完整变更散列与SDK闭包以`phase6a1.sdk-manifest.json`为准；所有长命令结束后交付，原始大证据仅在/private/tmp。

N2性能归因限制：本轮确认的是同一既有用例的超时与捕获模式完整断言零OOS；未确证其产品热点，也未证明C6没有性能回归。普通模式实际1218.42s、test1215.53s，唯一报告错误仍为900000ms超时。按已有精确非阻塞调查范围交接，不扩大到任何C6新增用例，后续优化不得改守卫或拿历史通过覆盖本次失败。最终HEAD仍ff9dee3、index为空，所有前台测试/测量/构建命令已退出。


## 审查发现处理（2026-10-15）

当前进度：七项逐项复现、生产修复及回归已完成；相关门禁通过，冻结散列已重算并逐项核验。仍在 `ext/phase6` / `ff9dee3d3dfba3daf752c74e097467c0ed4c50be`，未 commit。审查引用行号对应修复前候选，最终入口以本节定位为准；候选分配仍沿用 15/7/4/2 与 itemSdk1（本批尚未发布）。启用 encounter provider 时的活动遭遇新增必需 splitSubjects 来源字段；缺字段的前一候选档严格拒绝，不迁移。没有 encounter provider 的既有七模块格式保持。

- **R1 否定爆发**：新增实例级受控知识揭示，保持戒指种类未知；原生世界、扩展因果/状态/属性会话与 RNG 对象图共同回滚。首轮失败证明 known 仍为 false；完整图回归进一步抓到因果 ID 与 RNG 内部对象身份漏恢复，已补齐。
- **R2 碎片鉴定**：提交经完整原生实例鉴定，学习种类、符文并以 command 原因同步所有 owner；复核产物与已封存提案一致。知识缓存/摘要失效，原生戒指有效点数改变仍机械 dirty。戒指 fixture 自带额外 1 点，新增回归前提已校正为 2→5（原生 1→4）；符文分支首轮确认 runicKnown 未亮。
- **R3 vault 回退**：未指定武器用原生单次 chooseKind 保留选定结果；投掷直接原生，近战拒绝时复用同一结果，不再重抽全池。新增闭区间全部 140 个权重点的类别/种类抽骰次序向量；保守采用一枚原生 kind 骰同时确定资格和回退候选，provider 仍收到 baseId=null；floor 原分流不改。
- **R4 遭遇资格**：终结前以死者行政/盟友/克隆/无奖励事实标记 lost；普通 kill 的出生资格与遭遇登记分开。仅 encounter provider、无 kill 出生表的三种新负例首败均实际发奖；行政原来已通过。分裂主体失效持续到剩余主体并跨存读档。
- **R5 JSON 访问器**：数组完全通过 length/索引描述符检查稠密性，再只递归 descriptor.value；首败 getter 实际执行 1 次，修复回归为 0 次。
- **R6 熟悉度**：无操作和普通扣减提前返回，真正揭示才建完整快照；同一物品的嵌套鉴定共用最外事务。首败普通扣减仍建 1 次世界快照；新回归验证扣减/已知空操作 0 次、护甲/戒指揭示各 1 次、失败完整图回滚。
- **R7 属性性能**：单次 hypothetical 共用冻结装备/actor/pair 事实、一次 provider 收集和 DAG memo；按 actor revision、登记键数量、策略、装备 ID、描述符安全检查后的实际来源内容缓存不可变已验证结果。provider 每次仍执行，改变输出不能借旧 revision 跳过；深冻结来源凭证只复用逐行校验，聚合来源/覆盖/预算守卫保留，hypothetical 不写活局缓存。

初次定向红灯：3 文件 12 失败（含新遭遇 fixture 前提误设 kill、戒指加点前提错误）；前提校正后仅 encounter 子集 3 失败/1 通过，性能结构回归 2 失败。之后每次注入失败发现的回滚遗漏均修生产实现，不改断言；尚不把中间运行称最终通过。原始日志 `/private/tmp/c6-review-*.log`，不入仓库。

首次同机独立性能复测（Node24.19.0、3072MB、Apple M5/darwin-arm64；方法/预热/样本数沿用原真实宿主探针，无并行测试）冷查询 median/P95 0.171125/0.190750ms、hypothetical 5.242250/5.456833ms；优化后 0.067208/0.083083ms、0.253041/0.280542ms，分别达到 P95≤0.1ms、比较≤2ms。最终散列前将保留普通相关回归与最终测量结果；不把八件完整死亡事务≈60ms改报为纯生成≤1ms。


R4 相关旧回归首次复核：10 文件 225 项中 224 通过、真实 giants split 1 失败。未改旧断言：其新生子体原本具有 isClone/bodyTransitionRewardless，用于抑制独立击杀奖励；若直接视为整场遭遇无奖励，会破坏合同的合法 split 结算。最终改为只在启用 encounter provider 时持久化 `splitSubjects`，仅可信 split/phase 转移产生的新增主体获得原遭遇资格，仍无普通 kill 奖励。原生转移前的盟友/无资格状态先标记 lost，不能通过 relationships=clear 洗掉；任一主体之后变盟友仍 lost，行政死亡始终 lost。仅声明遭遇而无掉落 provider 的七模块路径保持原字节形状及终结语义，避免扩散到无关黄金。

R1–R7 第一批相关检查：225 项首败如上；修复后遭遇/录像/原生 body transition/giants transition 4 文件 90 项通过（136.52s）。包含当前 codec 存读、回放、seek、续录与 256/2048 检查点。定向性能结构回归已通过一次收集/同一冻结装备引用/DAG 单次求值，并补了同 revision 输出变坏、访问器与每件预算越界不能命中旧校验结果的回归。首次 vue-tsc 只发现新增测试使用了本仓库目标库不支持的 Array.at，已换索引；不改 tsconfig 或守卫。独立 vue-tsc 随后 exit0。


最终相关批次补记：6 文件 104 项，103 通过、1 新增晚失败回滚用例失败（148.13s）。通过项含真实 giants D3/D7 原法黄金（无重录）、C6 同版本录像链路、原生鉴定持久化及物品详情；新失败定位为完整原生鉴定成功后、模块状态提交抛错时，最外层 C5 世界检查点不含 ItemLoader 种类知识集合。生产 commitItemCommand 已把 identifiedItems/callTitles/magicPolarityRevealed 与 RNG 共同纳入辅助检查点，完整对象图和机械 revision 原断言保持，定向复核中。没有更改旧测试断言语义，没有需要反事实的前提调整。

最后一次 boundary exit0；测试依赖检查实际发现 630 文件、七模块齐全、errors=[]；build（含 vue-tsc -b）exit0，Vite 7.56s，仅保留既有大 chunk 提示。以上均为本轮实际执行，不复用上轮验收结果；最终知识回滚小修后再跑类型/构建。


R2 晚失败复核完成：`ext_item_commands.test.ts` 27/27 通过（31.50s，普通模式），原生种类集合、物品/材料、模块状态、时钟/随机与机械 revision 一并恢复。至此本轮相关测试所有首败均由修生产代码后定向复核关闭；首败记录保留，不声称上述多批次是单次全绿。


R1 最后写集核查：给同一否定失败回归补上 owner reveal 内分配 ID/消耗 RNG 的注入，发现 allocator 34→35 未复原（对象图及 RNG 已复原）。原生世界检查点本就不负责 allocator，扩展一般事务也不保证该项；已在否定最外层显式捕获/恢复 allocator，不改断言。此增强用例仍计同一回归，不增加通过数量。


### 审查修复最终验收

- 新增 **18项** 回归（其中1项在既有 `ext_stats_pipeline.test.ts`，其余17项在C6测试文件）。最后知识子集 6/6 通过、21项有意未选（10.70s），涵盖增强后的否定 RNG/allocator/完整图回滚；之前命令全文件 27/27 通过。前述首败全部定向关闭，未删测试、未加 skip、未放宽断言/容差/超时。当时分批汇总曾记为16个文件、318项；该去重计数有误，现以文末同一16文件一次运行的315项为准。以上仍为分批历史结果。
- 相关范围：C6七文件、四个 ext_stats 文件、原生 body transition、giants transitions及D3/D7原法黄金、原生鉴定持久化、物品详情。普通存读/录像/replay/seek/续录与256/2048检查点通过；原法 giants 黄金无需改写。
- boundary：exit0。测试依赖：630文件、七模块齐全、errors=[]、exit0。独立 vue-tsc -b 已通过；最终 `npm run build` 再次包含最新生产代码的 vue-tsc -b 与 Vite 构建，exit0，Vite **5.69s**。仅既有大chunk提示，不更改阈值。
- 未运行完整 npm test/test:ext/drift、CE对照、删除矩阵、N2长路线或浏览器。此前报告的N2既有非阻塞调查仍保留；本轮不重判其性能或黄金，不把这次局部通过扩大为阶段6全量验收。所有命令使用Node24.19.0/3072MB，Vitest --maxWorkers=2，均前台等到结束。

上次收口性能（本次复核见文末）：探针 `src/ext/testing/probes/phase6a1-perf-probe.mjs`，Apple M5/darwin-arm64；本次测量不与本代理的测试/构建并行，不声称整机独占。冷/热查询500样本、50次预热，比较100样本、10次预热；median取排序后floor(N/2)，P95取ceil(0.95N)-1。查询/比较均为4件C6实装+1件替换候选、一个owner，包含描述符/来源校验与真实管线；比较返回全部标量键、knownOnly=true。

| 项目 | median (ms) | P95 (ms) | 最大值 (ms) | 结论 |
| --- | ---: | ---: | ---: | --- |
| 缓存命中 | 0.002958 | 0.003750 | 0.013083 | P95≤0.01达标 |
| 冷查询（清结果/来源缓存，保留可靠校验缓存） | 0.071250 | 0.085708 | 0.897000 | P95≤0.1达标 |
| 装备比较 | 0.245708 | 0.284875 | 0.970958 | ≤2达标；本批最大值亦达标 |
| 已鉴定熟悉度空操作 | 0.000250 | 0.000333 | 0.012667 | 0次世界checkpoint |
| 普通熟悉度扣减 | 0.000208 | 0.000250 | 0.008708 | 0次世界checkpoint |

一次装备比较 provider.collect：**1次**（审查为35次）；熟悉度两组各500样本/50预热，总世界checkpoint **0次**，真正揭示的完整事务由回归验证。首次新增熟悉度探针漏绑手工装配物品，导致保存C6_VALIDATOR，补齐正常会话绑定后通过；另一版计数器覆盖了后续28次死亡检查点，现已把计数作用域收回熟悉度段。两者均为探针修正，未修改生产校验或门限。

八件完整死亡事务仅保留范围限制：最终median/P95 **58.091000/70.352167ms**，其中世界checkpoint **51.032042/62.601875ms**，服务段 **6.276500/8.110084ms**。25样本/3预热，包含真实死亡、校验、装配、落地、结算/发布，reset/load不计时；新增熟悉度段后还持有1件未装备测试护甲，因此不拿这组与旧状态做严格速度归因。它不是纯loot生成耗时，≤1ms单件目标仍未证明，本轮只关闭审查要求的冷查询/比较/熟悉度问题。

### 审查引用的当前入口

| 审查项 | 最终实现入口 |
| --- | --- |
| R1 | `src/engine/Core/Game.ts:8235` |
| R2 | `src/engine/Core/ItemCommands.ts:77` |
| R3 | `src/engine/Core/Game.ts:1458` |
| R4 | `src/ext/runtime.ts:1939` |
| R4 持久来源 | `src/ext/itemDrops.ts:89` |
| R5 | `src/engine/Items/ItemData.ts:15` |
| R6 | `src/engine/Items/ItemLoader.ts:938` |
| R7 DAG | `src/engine/Stats/StatPipeline.ts:306` |
| R7 校验缓存 | `src/ext/runtime.ts:458` |

### 审查后冻结清单

[phase6a1.sdk-manifest.json](phase6a1.sdk-manifest.json)已更新；283文件SDK闭包、2条见证、83文件候选变化，共 **368条文件SHA-256全部匹配**，两个聚合散列也以排序后的紧凑JSON重新独立计算。报告此前各节旧散列只保留为首次实施历史，本次候选以此表及清单为准。

| 范围 | SHA-256 |
| --- | --- |
| SDK闭包（283文件） | `3626672306a652c679a4dc35177c7ab0cb99a0d0175db30dca2db4aba16e112d` |
| 全候选src/scripts变化（83文件） | `585790e7d2317bfa463258c223de7805b008c768121a9cf9ba0756ae19996337` |

HEAD/基线仍 `ff9dee3d3dfba3daf752c74e097467c0ed4c50be`，foundation15/whole-run7/recording4/origin2、itemSdk1及旧world/edible SDK身份不变；本批未发布，不逐修复另分版本号。启用遭遇provider的旧候选缺splitSubjects直接拒绝；没有遭遇provider的七模块登记形状不变，D3/D7黄金普通模式确认。SDK public itemSdk/stats声明未扩大，内部原生鉴定/来源凭证及持久遭遇字段见上述实现与散列。维护者合入commit仍null；本轮没有commit、暂存、push、安装loot或派发6B1。


### 同一七项审查的再次复核（2026-10-15）

再次完整读取审查文件，未增加新条目；生产实现与18项新增回归均已在当前工作树。原报告引用的 `/private/tmp/c6-review-*.log` 在本次检查时已不存在，因此重新实际运行以下限定检查，未重复修改已修复的生产代码或测试。旧复现过程保留为历史记录，不宣称旧临时日志仍可读取。

- **相关回归一次全绿：16文件、315项通过，0失败、0 skip/todo，无 unhandled，117.80s。** 命令为 `vitest run --maxWorkers=2`，明确选定 C6七文件（ext_item_data/drop/stats/commands/presentation/recording/roots）、ext_stats_pipeline/native/runtime/review 四文件，以及 phase4e_body_transition、giants_transitions、giants_trace、b_1b_identification_persistence、x3b_item_details。未扩大到完整套件。报告先前318项为分批去重计数错误，已更正；18项新增审查回归数不变。
- **boundary、测试依赖检查、独立 vue-tsc -b、npm run build 全部 exit0。** 依赖检查发现630文件，七模块齐全，errors=[]；Vite构建3.19s，仅既有500kB chunk提示。
- 全部命令使用 PATH 前置 Node24.19.0、NODE_OPTIONS=`--max-old-space-size=3072`；测试 `--maxWorkers=2`。测试、门禁完成后才独立运行原性能探针，未并行测试/构建，所有命令前台等待退出。没有运行 CE对照、全量、删除矩阵、浏览器或N2长路线。

本次实际日志：`/private/tmp/c6-review-recheck-related.log`、`c6-review-recheck-boundary.log`、`c6-review-recheck-dependencies.json`（stderr为空）、`c6-review-recheck-types.log`、`c6-review-recheck-build.log`、`c6-review-recheck-perf.log`；性能结构结果 `/private/tmp/phase6a1-perf.json`。临时日志不入库，关键结果在本节固化。

本次性能仍用原探针、原预热/样本/P95定义、Apple M5/darwin-arm64、4件实装加1件替换候选、一个owner。冷查询清结果与来源缓存、保留按revision及实际输出校验的不可变缓存；不声称覆盖不同机器或所有模块组合。

| 项目 | median (ms) | P95 (ms) | 最大值 (ms) | 结论 |
| --- | ---: | ---: | ---: | --- |
| 缓存命中 | 0.001542 | 0.002416 | 0.009417 | 达标 |
| 冷查询 | 0.034416 | 0.045166 | 0.547041 | P95≤0.1达标 |
| 装备比较 | 0.126375 | 0.153291 | 0.492667 | ≤2达标；本批最大值也达标 |
| 已鉴定熟悉度空操作 | 0.000125 | 0.000167 | 0.006541 | 0次完整checkpoint |
| 普通熟悉度扣减 | 0.000125 | 0.000125 | 0.003792 | 0次完整checkpoint |

一次比较 provider.collect=1；熟悉度两组共1100次（含预热）完整checkpoint=0。八件完整死亡事务median/P95为29.725333/30.179667ms，其中checkpoint为26.057084/26.521083ms、服务段3.176083/3.396916ms；保持原范围限制，仍不据此宣称纯生成单件≤1ms或把本次机器时序差异归因为新优化。

冻结清单再次逐文件重算：283条SDK闭包、2条见证、83条候选变化，共368条全部匹配；两个排序紧凑JSON聚合散列分别仍为 `3626672306a652c679a4dc35177c7ab0cb99a0d0175db30dca2db4aba16e112d` 与 `585790e7d2317bfa463258c223de7805b008c768121a9cf9ba0756ae19996337`。本次仅更正/追加报告，源文件身份未变，因此清单散列无需人为改变。HEAD仍ff9dee3，未暂存、未commit、未push。


### 第二轮审查 N1：否定后戒指鉴定目标资格（2026-10-15）

已完整阅读 `phase6a1.review2-findings.md`。本轮限定为唯一新增S2；六项已修结论与R1剩余目标资格问题分别记录，不以既有315项通过覆盖N1。

**复现完成：** 在 `ext_item_commands.test.ts` 新增两条参数化回归（即时/JSON存读档）。真实Game经 `executeItemCommand('read', 否定卷轴)`、`executeCommand('pickup')` 拾取；同种原生戒指作为控制。修复前两条均在C6戒指 `canBeIdentified` 期待true而实际false处失败，原生控制可选、种类仍未知；红灯日志 `/private/tmp/c6-review2-n1-red.log`，2失败、27项未选，exit1，2.95s。没有改旧断言或前提。

**生产修复：** `revealItemKnowledge` 不再以 `!identified` 推导鉴定资格。提交合法owner数据/实例知识后，重新开放候选，再调用既有 `ItemLoader.updateIdentifiableItem` 按原生种类/实例/符文规则清除已无知识可学的目标。种类未知的否定戒指保持可选；完整鉴定的戒指恢复不可选。没有修改原生规则、SDK声明、版本或存档格式，没有迁移旧候选档。

**回归范围：** 两条新增用例都继续经真实鉴定卷轴及选择命令，验证待选结束、种类学习、owner已知保持、鉴定资格清除及保存成功。相关五文件与boundary/依赖/vue-tsc已通过，实际结果见下；本轮按用户要求不跑build或性能探针。


**N1最终验收：** `vitest run --maxWorkers=2 src/test/ext_item_commands.test.ts src/test/ext_item_presentation.test.ts src/test/ext_item_recording.test.ts src/test/b_1a_identification.test.ts src/test/b_1b_identification_persistence.test.ts` 一次通过，5文件93项、0失败、无skip/todo/unhandled，exit0，81.74s。包含新增2项、第一轮知识同步与回滚、原生鉴定语义、物品显示、当前存档及录像链路；不把这93项与第一轮315项重叠累加。

`node scripts/check-module-boundaries.mjs`、`node scripts/check-test-dependencies.mjs`、独立 `vue-tsc -b` 均exit0。依赖检查630文件、7模块、errors=[]，stderr为空。日志为 `/private/tmp/c6-review2-n1-related.log`、`c6-review2-n1-boundary.log`、`c6-review2-n1-dependencies.json`、`c6-review2-n1-types.log`。全部命令均使用PATH前置Node24.19.0、NODE_OPTIONS=`--max-old-space-size=3072`，测试maxWorkers=2，前台等待结束。未跑build、性能探针、CE对照、全量或浏览器；未改守卫/断言语义/黄金，无需反事实或重录。

本轮实际源码差量只有 `src/ext/runtime.ts:1887` 的 `revealItemKnowledge` 与 `src/test/ext_item_commands.test.ts:116` 起的新增回归；报告与冻结清单同步更新。原生 `ItemLoader.updateIdentifiableItem` 保持原样，当前审查行号1893对应的错误赋值已移除；无新Game字段、公开SDK声明或版本/格式变化。

**N1修复后冻结清单：** 重新读取磁盘计算全部368条SHA-256并核验（SDK闭包283、见证2、候选变化83）；相比上一轮，仅runtime与命令测试文件散列发生变化，清单条目集合不变。当前聚合值如下，覆盖文中此前候选散列：

| 范围 | SHA-256 |
| --- | --- |
| SDK闭包（283文件） | `eebf539720177aebbfe177e0769aa5b80a2d317731b37061b5ab0e44ceab12f5` |
| 全候选src/scripts变化（83文件） | `4c96e6c276a2a5ccd4e640dd2ee006a061072a1d790f3ad53b1e6932a93b617e` |

HEAD仍 `ff9dee3d3dfba3daf752c74e097467c0ed4c50be`，分支ext/phase6、index为空，未commit/push。本节为第二轮发现的作者修复与限定验证，不冒称第三轮独立审查或整个阶段全量验收。
