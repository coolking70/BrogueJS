# 5A4 采食底座交付报告

日期：2026-10-07。工作分支：`ext/phase5`。状态：5A4a–d 及独立审查选定 P1–P10 修复的工作树候选已交付；不 commit、不 push。E1–E30 与附录设计缺口按维护者本次授权执行。

本步只提供通用底座和中性测试模块 `fgfixture`；未创建生产 `foraging` 模块、蘑菇内容、居民生产登记、feed/roast UI，也未增加 npm 依赖。真实 crafting 的 `station.hearth` 定义用于 E17 验证。

## 1. 基线、版本与开工核对

任务书实施基线 `4de793d`（5A3、5B 集成已合入）；实际开工 HEAD 为 `53efa07`（`docs(ext): set 5A4 baseline`），工作区当时干净。基线副本来自 `git archive HEAD`，证据、反事实和原始捕获全部留在 `/private/tmp/phase5a4-evidence/`。该路径为本次本机证据，不是提交产物。

| 合同 | 基线 | 最终实际值 |
| --- | --- | --- |
| FOUNDATION_PROTOCOL / manifest / foundation.version | 9 | 10 |
| whole-run / schema | 5 / brogue-web-whole-run-v5 | 6 / brogue-web-whole-run-v6 |
| 录像 format / origin / IDB | 4 / 2 / 2 | 4 / 2 / 2（不变） |
| World5Snapshot.schema / worldSdk | 1 / 1 | 1 / 1（不变） |
| EDIBLE_SDK_VERSION | 不存在 | 1 |
| growth / narrative / combat / giants / crafting | 1.8.0 / 1.4.0 / 1.6.0 / 1.0.0 / 1.0.0 | 不变；rules 版本也未修改 |
| c5fixture / craftskel | 1.0.0 / 1.0.0 | 不变 |
| fgfixture | 不存在 | 测试专用 1.0.0 |

`worldSdk.ts` 与 HEAD 字节比较相同，SHA-256：`297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343`；与 5A2 冻结值相同。5A3 包类型实际导出于 `src/ext/structureTypes.ts`，既有 `structures?` / `restPoints?` 保留，新键仍为可选键，不把缺省键归一为数组。

下表行号为本次最终源码实际语义位置。任务书的 `8e946bb` 行号未直接沿用。

| 核对项 | 最终源码锚点 | 核对结果 |
| --- | --- | --- |
| item: 分派 / ext edible 分派 | Game.ts:3843 / 3917 | 都经 executeCommand / executeItemCommand |
| 吃 / 可食吃 / 原生 FOOD | Game.ts:5489 / 5501 / 5518 | 可食新分支；原生耗时与 itemUsed 顺序保留 |
| 自动进食 | TimeCoordinator.ts:315 | 仍只寻找 ItemCategory.FOOD；MATERIAL 排除 |
| 环境 / 地面燃烧 / 单格回调 / 原生烧毁 | TimeCoordinator.ts:346、419；Game.ts:12415、13175、13184 | 所有新增可食接触走同一队列，卷轴分支保持 |
| 玩家首次着火 | Game.ts:11862、11879 | setBurningDuration 后，仅玩家 0→正抽取 |
| 投掷 / 落地 | Game.ts:8090、8311 | 原生通用落地后识别火或热源 |
| 原生 DF | DungeonFeatureCatalog.ts:609、642、657；Game.ts:13058–13059 | ITEM_FIRE / EXPLOSION_FIRE / BLOAT_EXPLOSION；回调外层排空 |
| 原生知识 | ItemLoader.ts:457–480；Game.ts:5254、5276、7423、7440、7490 | MATERIAL 不进入原生种类知识；可食 call 独立 |
| call 长度 | InventoryOverlay.vue:552；KindKnowledge.ts:132–135 | 沿原生 29 字上限；按码点截断，控制字符剔除，空白清除 |
| 状态 / 正伤害唤醒 | Creature.ts:15、86、369；Monster.ts:360、433、442 | 新 slumber；免疫沿 paralysis；护盾前醒来 |
| 盟友 / 关系 / 群体 | Game.ts:14239、14243、6607、12789；runtime.ts:1404 | 固定资格触发，不按回合轮询 |
| 原生双流 / offlineDraw | Random.ts:149；WorldSettlement.ts:166、181 | 不改两流与既有离线算法 |
| 已有放置候选 | WorldWorkPlacement.ts；PlacementGroups.ts:6 | 复用 D8 候选，不复制生成算法 |
| 原生属性表 | NativeStatKeys.ts；docs/ext/stats-config.md | strength 为物化键；hit-chance / physical-damage-dealt 为 query |
| 唯一世界时钟提交 | TimeCoordinator.ts:154–155 | soonestTurn>0 时 worldClock.advance，客观块之前；未增加提交点 |

## 2. 逐项交付与状态登记

| 子步 | 状态 | 实现与验证 |
| --- | --- | --- |
| 5A4a / H1、H8 | done | 包/模块构造校验、MATERIAL 可食身份、吃/扔/call、确认、原生效果与定时 L4、沉眠免疫/续推/伤害唤醒/必中与三倍伤害；命令拒绝和独立写集回滚 |
| 5A4b / H2 | done | 所有火接触入口、10 块冷却与清键、FIFO/最外层 DF 排空、原生爆炸/熔岩/卷轴共存、首次玩家着火抽取、真实 crafting hearth 与 combat 篝火 |
| 5A4c / H3–H5 | done | 非魔法知识与名称/详情/节点投影、派生抽样冻结向量、分组候选/深度/权重/地形偏好/收据/预算；native 生成及双流对照 |
| 5A4d / H6–H7 | done | 惰性整数需求时钟、精确跨越/deadline/deferred、资格触发、feed CAS/拒绝/确认、非死亡离队/稳定落物/群体整体退役、actorDeparted；保存与录像闭环 |

实现文件为任务书 E2 所列可信路径，另增 `EdibleState.ts`（可选 run 根）、`EdibleValidation.ts`（构造后及读档校验）、`EdibleFixturePort.ts`（DEV 测试专用登记）、`Items/WorldItemPresentation.ts`（统一动态名称 WeakMap）、`Status/Incapacitation.ts`（谓词与醒来绑定）。`edibleSdk.ts` 只再导出类型/常量；boundary 限定模块获取能力的入口，未开放可信实现给内容模块。

| 状态 | 生命周期 / 摘要域 | 登记与规则 |
| --- | --- | --- |
| Item.fireContactCooldownUntilTurn | run / native | ITEM_FIELDS 与 EntitySnapshot 编解码；非地面必须 delete，不写 undefined |
| foundation.kindKnowledge / actorNeeds / timedStats / departures | run / extensions | u03-state-contract、recording-digest-contract；空根省略；schema 均 1 |
| 火接触队列 / draining / DF 活动嵌套 | session | WeakMap 与 DF 既有活动上下文；命令和 save 边界为空，不写存档 |
| 外观池 / 效果解析 / 名称绑定 / nextDue | derived | WeakMap；load/seek 新 runtime 重算，显示不消费 RNG，不创建 run 根 |
| worldWorkCommandEpoch | 既有 session | edible handle 复用命令 epoch，单次 prepare issuer；不新增 Game 字段 |

字段登记更新在 `scripts/u03-state-contract.json` 与 `scripts/recording-digest-contract.json`；u_01、u_03 与 boundary 相关验收已经运行。坏档在旧 live game 退役前拒绝；不修补、不迁移旧版本。

## 3. 自定细节与修复

1. 整堆就地转化要求目标 `maxStack >= 来源 maxStack`，构造期拒绝较小上限，避免合法整堆转化立即生成无法存读的 Item。其余原数量、ID、letter 不变，不自动合堆。
2. H4 的 owner 规则盐采用 `runtime.worldDefinitionFingerprints()[owner]` 去掉 `sha256:`，也就是包加 foundation 食物算法规则的世界定义指纹；不用只覆盖模块自有数据的 manifest rules 指纹。`c5-derive-seed-v1`、`c5-derive-v1`、`c5-group-place-v1` 和冷却 10 进入声明新包键的 owner 世界规则指纹。旧包的算法/指纹字节不变。
3. command 事务组合既有 WorldWork/runtime 事务和 `checkpointCombatFactWorld` / `checkpointWorldWork`；恢复实体/地图写集、世界项、ID 分配、两流、logger 和时间，重新绑定动态 Item 投影。可选食物根原位恢复，避免时间事件手中的 row 在失败后变成脱离持久根的旧对象。参与者仅写本 owner 的同步暂存内容。
4. `spawnSettled` 接在 DF 最外层成功返回、活动上下文解除之后（DungeonFeature.ts）；DF 抛错只清理上下文，不调用 settled，见 §10。生成期 effects 为 null，无回调。Game 的 `burnItems` 对可食物只排队，外层回调排空；`draining` 抑制重入，同次 drain 的 processed ID 集合再兜底一次性处理。
5. 可食 FIFO 排空后一次调用既有 `prepareFlareKnowledge`（P7 修复，见 §10），在 recorder checkpoint 前完成 native flare 的 cosmetic 抽样。此前仅置 needsRender 会使下一次 save 发生额外抽样，导致 replay/seek 摘要不一致；修复后真实爆炸、烤制和连续录像闭环通过。纯名称/详情读取仍为零 RNG。
6. 节点名称严格按生定义是否 known 解析；节点详情按节点自身 knowledge 行解析。生已知、烤未知显示种类真名和未知烤制提示，不披露 effect。绰号不跨定义自动复制；烤揭示联动留给 5G 参与者。
7. 离队保留 isAlly，解除 leadership/boundToLeader/entersLevelIn 与准备中的攻击；退役同时清理 active、dormant、cached level、pending fallen、purgatory、bodyGroups、可见集合、追随/携带引用、扩展组件与属性账本。原生携带乘客若不属退役群体则在原格释放。5D 自有居民/订单账本清理责任见 §8。
8. 首交曾把离队放在失能 gate 后；审查 P1 为避免 activation DF/尸体吸收，最终改为 action lock 后直接分派离队，离队内部检查 isIncapacitated/entranced/caged/body decision disability，沉眠与麻痹仍只等待。入迷和直接 native fallback 入口也排除离队攻击，见 §10。
9. `createForageHarness` 只向当前语言注入新增 foundation 六键和自身 fixture locale；不把整个 zh_CN 或其他模块 locale 加进既有 worldHarness。原始 crafting 捕获曾发现 native 英文名字被测试初始化改为中文，已修正并重捕，非版本字段全部恢复一致。覆盖 descriptor 保持原 module 实例身份，避免丢失 WeakMap 测试登记。
10. 需求上下文和离队的“可见”采用现有 canDirectlySeeMonster（直接可见的公开身体格），远处仅 telepathy/entranced 的位置揭示不延长离队 grace，也不成为 feed 目标；沿用交互需直接可见的语义，未增加额外感知规则。
11. 新结构基础类型读者登记 E23/E26 的三处（菌地形、两处楼梯身份）；这些 pin 保持原字节。P6 补齐原生拾取名称插值时，另有两处旧 if statement 的消息文本指纹重登记，条件/count/守卫算法不变；逐项归因与新旧 key 见 §10.2。

## 4. H4 生产 API 与独立向量

`ext_derived_draw_vectors.test.ts` 直接调用生产 API，10 个向量/拒绝用例通过；另外以仓库外 Node 24 crypto 与 Python hashlib 独立重算，逐字段相等（`derive-independent.log` / `derive-independent-python.json`）。canonical 为 UTF-8 紧凑 JSON；draw 为 SHA-256 首四字节的大端无符号整数。

| 输入 / 算法 | 实际结果 |
| --- | --- |
| seed(51005000, fgfixture, 64 个 0) | 8c10e2b890bbc28b47cff53059cea1f694cb20231560996d4393977f148eed80 |
| seed(1, foraging, 64 个 f) | a004cac75de63d19bc5b26395d7f0375594be437264efc7dc4652cbabcdacb61 |
| 第一 seed / appearance / ordinal 0、1 | 1692360874 / 1906428524 |
| 第二 seed / roast-policy / ordinal 9007199254740991 | 479313020 |
| reject，n=2147483649 | attempt0=4090733778 被拒；attempt1=1916848773；range=1916848773 |
| appearance，倒序 Fisher–Yates，池 a0…a5 | a0,a2,a1,a3,a5,a4 |

空/坏/过长 seed、非 validId domain、负/非安全整数 ordinal/attempt、n=0/超过 2^32 均拒绝。API 不读取原生 RNG。

## 5. 首交门禁与失败归因（历史）

所有 Node 命令把 `/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` 放 PATH 第一位（实际 `v24.19.0`）；`NODE_OPTIONS=--max-old-space-size=3072`；所有 vitest 命令 `--maxWorkers=2`。遵照任务书开发期政策，没有运行完整 npm test、全部 test:ext、removal 矩阵或 CE fetch。表中耗时为外层命令 wall seconds，测试数量来自 vitest 汇总；重叠批次不相加成独立用例总数。

| 批次 / 实际命令见附录 A | 退出码 | 文件 / 用例 | 耗时 s |
| --- | --- | --- | --- |
| A 首次相关集合 | 1 | 6 failed \| 101 passed \| 1 skipped (108) / 7 failed \| 1801 passed \| 7 skipped (1815) | 1195.22 |
| B harness/结构/工作位回归 | 0 | 7 passed (7) / 108 passed (108) | 89.70 |
| C 版本/摘要/UR/giants 重录后 | 0 | 7 passed (7) / 34 passed (34) | 57.10 |
| D 新增九文件完整批次 | 0 | 9 passed (9) / 164 passed (164) | 133.82 |
| E 追加沉眠战斗覆盖 | 0 | 1 passed (1) / 13 passed (13) | 20.65 |
| F feed/call/退役失败追加覆盖 | 0 | 2 passed (2) / 45 passed (45) | 38.48 |
| G 离队 gate 调整后原生回归 | 0 | 4 passed (4) / 119 passed \| 1 skipped (120) | 18.36 |
| H 最终生产树 drift | 0 | 5 passed (5) / 8 passed (8) | 71.93 |
| I 最终 boundary | 0 | — / — | 2.18 |
| J 最终 types | 0 | — / — | 7.71 |
| K 最终生产树 build | 0 | — / — | 11.12 |

新增九文件按逐文件最后结果共 **172 个通过**：D 的 164 个全通过后，E 将 slumber 文件从 12 增至 13，F 将 edible 从 27 增至 33、departure 从 11 增至 12；其余六文件保持 D 的通过结果。不是宣称某一次单批输出为 172。

A 的 7 项失败全部是 E1 固定版本/摘要/trace 旧基线（foundation 断言、冻结摘要向量、UR3、UR4、giants 自然 trace 两项与 spine 一项）。A 的 7 个 skip 及 G 的 1 个 skip 是已有 CE 源码条件，本次环境没有 `.ce-reference/`，没有新增 skip；这些 CE 条件项未验证。最终 drift：5 文件 8 项通过，含自动发现的真实 crafting trace。

其余开发阶段失败已逐项修复：

- 新增可食测试曾使用错误的原生药水 action 或绕过真实命令调用探测路径；改用实际 `item:execute` 的 quaff 和真实探测药水，没有改生产 ItemLoader，也未弱化隔离断言。
- 为测试 cached alias 清理暂建 active Grid 同身份的缓存层，之后保存撞上原有物理所有权守卫；保留清理断言，保存前移除该测试专用 alias。该守卫与断言语义未改。此时九文件批次是 161 通过、1 失败；修正后 D 为 164 全通过（另含两项离队失能测试）。
- 新增 actorDeparted 故障用例最初把已成功提交的 need detached 历史也当成应回退，得到44通过/1失败；修正预期为准确保留前一个合法 detached 事实、丢弃失败 hook 的 uncommitted 写入，生产代码未改。最终 F 全通过。
- descriptor 测试替换需保留 WeakMap 登记实例身份，纯 spread module 会失去测试 trusted handler；改测试前提为原位替换定义字段，不改生产授权。
- 边界格式化 pin 失败修生产表达式，未改旧审计键；最后 I 成功。

独立写集失败注入覆盖 eat / feed 的扣物、意图、fact 分配、participant、render；roast 的转化、fact、participant、message、原生 DF、render；call 的 knowledge 发布，以及时间 fire / need / actorDeparted 的参与者失败。写集以 `auditFullObjectGraph(fullGenerationRoots(...))` 独立遍历比对，加上 runtime 快照、两流、实体分配器、logger、native/world clock 和 Item owner，不是只比较序列化 JSON。command 路径全回滚，时间路径保留机械结果并丢弃模块写入，诊断不入持久摘要。生产已连接所有时间入口；未宣称上述故障点与每个入口/模块组合的笛卡尔积穷举。

engine smoke 为真实 Game 的 14 组合：空、growth/narrative/combat/giants 各单独及四模块全开、craftskel、crafting、fgfixture、fgfixture+combat、fgfixture+craftskel、fgfixture+crafting、fgfixture+combat+giants、fgfixture+四模块全开。每组新局、wait/escape、save/load、逐条 replay、seek、续录；没有浏览器替身或 mock persistence。

### 5.1 单变量反事实与原方法重录

在仓库外当前副本仅回退 E1 元数据 tuple 6/10→5/9（WholeRunSnapshot、RecordingV4、RecordingFormat、RecordingDigest、Game、descriptor 六个生产文件的版本值；保留食物/火/需求/状态代码）。原 UR2/UR3/UR4 三文件三项通过，54.18 s；冻结向量/giants 选定四项通过，23.99 s（其余 19 为 testNamePattern 过滤，并非新 skip）；原 crafting trace 三项通过，25.60 s。另只回退 descriptor.ts 的单文件反事实使旧 foundation 断言一项通过，1.50 s（七项被名字过滤）。实际命令与副本日志见附录 B。

完成归因后才重录：UR3/UR4 用原 `UR3_CAPTURE=1` / `UR4_CAPTURE=1` 与各自捕获目录参数，基线和当前各跑原两测试（两文件两项，约 56 s）；giants 用原 `BROGUE_CAPTURE_GIANTS_TRACE=1` 在隔离副本跑两文件三自然样本（20.58 s）；crafting 用原 `CRAFTING_CAPTURE_TRACE=<仓库外文件>`，基线/当前同方法捕获原自然测试（最后当前捕获 3.45 s）。所有原始 JSON 均留仓库外；仓库仅保留原规范黄金文件。

| 黄金 / 预期 | 逐字段变化 | 其他字段 |
| --- | --- | --- |
| UR3 compressed trace | 120 raw rows 的 snapshot.version 5→6、schema v5→v6，共 240 项 | 地形、生成、怪物、物品、两流、回访/存读/fall 字段相同 |
| UR4 compressed trace | 60 项 state.version/schema；52 项 recording.chainDigest，共 112 项 | 客观块事件、时钟、原生实体、两流相同 |
| crafting natural-trace.json | 仅 final.digest；raw 捕获 809 处外壳及其派生摘要变化，见下表 | 命令/实体/数量/成本/recipe/state/native 字段相同 |
| giants 三自然 trace | 各仅 extensionsHash，见下表 | nativeWorldHash、commandsHash、两流、boss、region/state 相同 |
| UR2 | 无黄金变更 | 原 goldens 直接通过 |

crafting raw 的逐字段登记（`#` 为各事件索引，809 处全部匹配以下路径）：

| 路径 | 变化次数 |
| --- | --- |
| `/recording/extensions/foundation` | 1 |
| `/recording/codec/foundation` | 1 |
| `/recording/codec/wholeRun` | 1 |
| `/recording/events/#/checkpoint/root` | 264 |
| `/recording/events/#/checkpoint/domains/extensions` | 264 |
| `/recording/events/#/chainDigest` | 264 |
| `/recording/events/#/fullCheckpoint/root` | 2 |
| `/recording/events/#/fullCheckpoint/domains/extensions` | 2 |
| `/recording/events/#/fullCheckpoint/domains/native` | 2 |
| `/recording/initialDigest/root` | 1 |
| `/recording/initialDigest/domains/extensions` | 1 |
| `/recording/initialDigest/domains/native` | 1 |
| `/final/digest` | 1 |
| `/snapshot/version` | 1 |
| `/snapshot/schema` | 1 |
| `/snapshot/extensions/manifest/foundation` | 1 |
| `/snapshot/extensions/foundation/version` | 1 |

codec.wholeRun 5→6、codec.foundation / extensions.foundation / manifest.foundation / foundation.version 9→10；其余路径均为这些字段导致的 root/domain/chain 摘要。full/initial checkpoint native 域包含 whole-run version/schema，故 native 摘要变更并非原生游戏状态变化。普通 checkpoint 是缓存增量域，仅 extensions 更新。完整原始 before/after 值逐条在 `crafting-field-diff.json`，未经逐字段 whitelist 匹配不接受重录。

| 黄金字段 | 旧值 | 新值 |
| --- | --- | --- |
| crafting final.digest | 2fa87af84e39ae4b0dc4abb0ae77c4cba0d9f77f6245e25f99d084765e111a51 | b52cb4a64add710c68c615b3d05af27ada228f0efaeb63e4da45ee5ff189b060 |
| natural-trace.json extensionsHash | f1d96df1a1efbffc237081ed8e9ea152ecdc1b11f03c95f4266654a6e48c8096 | 484324ffedadb63d8723758bdb646dde77e11efdaf6d268c7bf751e996ddb1bb |
| colossus-natural-trace.json extensionsHash | fafd76e8260b6b4fa7d9384fac305eda2335ce6e4b026849f89258b974afb0da | f3f2496bd7a4b71c75d90cbc6a047b8eaced16eaf43ce61863f5ecf9d4b49a48 |
| spine-natural-trace.json extensionsHash | 6d24f33b75be6a96e31caeb01264f36895cf33c560bd828ad52fbe58f50176b9 | 48e7e461cd85b0df677cc58834ceb5249496502b98525f16a649f03e8c65c770 |

冻结摘要也先用独立 Python canonical JSON/hashlib 计算，Node 测试的独立 Merkle 实现交叉验证，再更新 E1 前提，未调整断言逻辑：

| 向量 | 5/9 | 6/10 |
| --- | --- | --- |
| root | fc57fcd32ee81a2355097f38af73994ede7fff302e8751a9793d148e05788e2e | 9d5107a7acbbeb18327718e80dadb26c61f3d3586a827873790e7b04e181c929 |
| start | 865018a2402e0f8609787c2c30066723e5db70c088c846a4040c4b54350ed0fa | 92843353301e3135be842272d4d1eaf160c31f7f42320b94675b4a27a41fc627 |
| chain | 0d99d87444ebcef52f4c7754b72ee2a40f9d21d588a54ae06caf577b2383a78c | 0c5dc5ed5167462a5206bf03453f4a7041f91cac047faf095424e78187a1297f |

同种子有/无 fgfixture 的 native terrain、monster、native item 和双流逐项相同（实体编号允许新增后的偏移）。另以真正 5A3 HEAD archive 对当前：经典、四模块、crafting、craftskel、c5fixture 五个完整初始快照，仅规范化 savedAt 与 E1 版本外壳后深比较相同，新根全部省略，world 包指纹逐字相同。证据 `no-impact-baseline.json`。

| 无采食包 | 前后相同规则指纹 |
| --- | --- |
| crafting | sha256:c77144c721e3686bda3ac26efef120a348517ab2b4b7fb9e71c9ed9763746f4e |
| craftskel | sha256:3a8374fb84848c24a5c9ac193845f4bf68524b6d5c993fb361f53f88c4b2fa1b |
| c5fixture | sha256:a46caa8e6e8690b468c6ba0cf2b6f93b47657c9e1195a069a0c017aefcd0bbb7 |

## 6. 首交性能实测（历史；P7 复测见 §10.3）

最后一次测量在门禁/构建结束后独占运行，使用真实 Node v24.19.0 / Apple M5，10 核。当前树与 git archive HEAD 两个隔离 Vite SSR runtime；每组交替 321 次真实 executeCommand(wait)，32 次预热，288 次普通记录行；第 256 个完整 checkpoint 单列。场景清除 native foe/物品，铺安全地面、wizard/高 HP/长 spawn fuse，确保 wait 推进并没有 UI/死局干扰；这是测量控制场景，持久确定性由另行自然 trace / closedLoop 验证。

`新增 P95` 是成对 current−baseline 样本的 P95，不是两个 P95 相减。记录器时间仅包裹 updateRecordedCheckpoint；同时列整条命令 wall 增量。fgfixture 的 5A3 对照为同 craftskel 无食物局，反映新增能力负担。单位 ms。

| 局 | 普通行 n | 记录器旧 P95 | 记录器现 P95 | 成对新增 P95 | 整命令新增 P95 | 导出录像 UTF-16 code units |
| --- | --- | --- | --- | --- | --- | --- |
| classic | 288 | 0.032250 | 0.032416 | 0.003125 | 0.277042 | 206121→206122 |
| without-edible | 288 | 0.182958 | 0.184458 | 0.010084 | 0.342375 | 309573→309575 |
| fgfixture | 288 | 0.138416 | 0.152125 | 0.025084 | 0.294666 | 309574→309740 |

本控制场景导出内容为 ASCII，code units 也等于 UTF-8 bytes；经典 +1、crafting +2、fgfixture 对骨架 +166，未建立食物运行根的录像增长来自版本/能力外壳。不是最大状态录像体积测量。

| 局 | 完整 checkpoint 旧 / 现 ms | 样本数 |
| --- | --- | --- |
| classic | 52.610 / 51.174 | 1 |
| without-edible | 50.011 / 50.003 | 1 |
| fgfixture | 50.941 / 50.642 | 1 |

压力操作：

| 场景 | 实际耗时 / 样本 | 含义 |
| --- | --- | --- |
| 满背包 26 堆×20、玩家首次着火 | 1.408 ms / 1 次 | 包含原生暴露与 26 次固定位置实质抽取 |
| 单格 20 件爆裂物 FIFO 连锁 | 725.887 ms / 1 次 | 含原生 DF 传播、伤害、点火、连锁，队列完成并全删 |
| 64 个真实 actor 需求无到期检查 | P95 0.000125 ms / 200 次 | 验证 nextDue 热路径 O(1)，不等于完整客观块 |
| 64 需求含越 band 的真实 recorded wait | median 5.768，max 6.778 ms / 3 次 | 包含客观块、事件、组件重算和记录；三次不足以声明长局 P95 |

**首交记录：20 件同步爆炸链产生约 0.7 秒的单次停顿**；该样本没有分离逐接触 flare 准备的平方开销。最终 P7 成对复测及剩余停顿见 §10.3；保持任务书同步 FIFO 时序。完整 checkpoint 约 50–56 ms，也不混入普通命令新增 P95。所有常规成对新增指标低于 5 ms，压力单次结果单列；不把单次值当 P95，也未声称浏览器流畅度或最大状态长局验收。

## 7. 5G 冻结清单

### 7.1 身份、路径与 hash

5A4 合入 commit：**未产生，待维护者验收/合入后填写**（本次明确禁止 commit）。此处冻结的是当前未提交工作树，不能用虚构 merge hash 派发 dot。维护者补实际 commit 后再按任务书 §10 确认派发；其余接口值已具备。

最终源树指纹（src/scripts/public，共 1113 个文件，算法为码点排序的 `relativePath + NUL + fileSHA256 + LF` 连接后 SHA-256）：`597ad0fc08eb3d3afd04171589031cea6df2928a41a14d077e1f36a3f9a19229`。审查修复后的输入在 `/private/tmp/phase5a4-fixes/review-source-hashes.json`，测量前与写报告时复核相等；首交历史指纹 `0a095ae9324b39ba0cfc8fea2eb53c93a757e163444c9edd8058260cc737d10c` 及其测量输入仍保留在首交证据目录。

| 文件 | SHA-256 |
| --- | --- |
| `src/ext/worldSdk.ts` | 297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343 |
| `src/ext/edibleSdk.ts` | fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b |
| `src/ext/worldEdible.ts` | 7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67 |
| `src/ext/kindKnowledge.ts` | 4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f |
| `src/ext/actorNeeds.ts` | 8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e |
| `src/ext/stats.ts` | c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84 |
| `src/ext/testing/forageHarness.ts` | ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38 |
| `src/ext/testing/fixtures/forageFixture/index.ts` | adc02caaa085519c54a4c0c202ef9f06f1a2b818806bd6b819773f81a4b1abea |
| fgfixture 目录树（同上述 tree 算法） | 7c31db01609c097285a21493bf9771bda92e2eb6464fcad124314368f9e1c10c |

foundation=10，whole-run=6，EDIBLE_SDK_VERSION=1，worldSdk=1。模块 descriptor 通过 `FOUNDATION_PROTOCOL` 声明 foundation，声明 E3 任意可选包键或 E4 字段必须同时 worldSdk:1 和 worldDefinitions；不满足 C5_BAD_VERSION。模块只能通过冻结的 worldSdk、edibleSdk、stats 能力边界，可信实现不属内容 API。

### 7.2 包 schema 与全部新增上限

定义类型以冻结文件为准；strict unknown keys、安全整数、owner 前缀 validId、DTO 深复制深冻结、locale owner 校验。已有 world pack schema/worldSdk 均 1。

| 声明 | 冻结约束 |
| --- | --- |
| edibleItems? | 每 owner 0…128；MATERIAL(13)，quality basic、toolDurability null；maxStack 1…20、tags ≤16 去重码点序、satiety 0…2150、单码点 glyph、#RRGGBB |
| effect | none / heal-fraction(percent 1…100,min 0…1000) / status(turns 1…1000) / status-and-satiety(nauseous,turns 1…1000,loss 1…2150,floor 0…2150) / temp-stat(turns 1…2000) / explosive；derived-choice 2…8 非嵌套 options、安全非负 ordinal、valid domain |
| fire | transform / burn-up / explode；threshold 1…20；transform 同 owner、无环、目标 maxStack 不小于来源 |
| knowledgeGroups? | 每 owner ≤8；kinds 1…32，appearancePool kinds.length…64，ID 去重；raw 可食、roasted 可食或 null、node resource 或 null；定义不得跨组重复 |
| placementGroups? | 每 owner ≤8；members 1…64，minDepth 1…40，weight 1…100；perDepth ≤40 个不重叠区间，范围 1…40，min/max 0…32；maxPerRun 0…512；preference tags ≤2、radius 0…8、两个权重 1…16 |
| actorNeeds? | 每 owner ≤4；role satiety；max 1…1000000，initial 0…max，ticksPerPoint 1…1000000；bands 1…8，首阈值=max、其后严格递减、ID 唯一；deadline null 或 1…10000000；departure null 或 grace 0…100000 且为 100 倍数；必须 qualifies |
| 引用 | Resource.yield 可引用同 owner 可食定义；startupItems/recipe inputs/outputs 禁止可食；分组成员 placement 必须 dungeon:null,site:null，此特例由 WorldDefinitions 放宽 |

temp-stat 玩家可用物化键 `native.strength`、`native.max-hp`，flat value 为有符号安全整数；key 本身求值上下限和 S6 同事务物化约束仍生效。other 只可用 query 键：regeneration、regeneration-bonus、weapon-enchant、armor-enchant、accuracy、hit-chance、defense、evasion、damage-min/max、physical-damage-dealt/taken、effective-strength、stealth-range、search-strength、awareness、clairvoyance、light、reaping、transference、wisdom、attack-speed、move-speed、runic-power、armor-runic-power、resist.physical/fire/poison/other（均有 `native.` 前缀）。所有 query increased 为 −9000…+50000 bp；temporary more 为 0…40000 bp，**attack-speed/move-speed 的 temporary more 特例为 −5000…40000**，以未修改的 NativeStatKeys.ts / stats-config 为准。physical-damage-dealt 的 more 下限 0，5G 虚弱必须使用 increased 负值。

### 7.3 意图、火、知识与派生算法

EdibleStatusId = poisoned / hallucinating / confused / nauseous / telepathy / darkness / haste / paralyzed / slumber。poisoned 走 addPoison 累加；其他 max-duration 沿原生施加与免疫。haste 玩家写 haste、怪物写 hasted，清 slowed；telepathy/hallucinating/darkness 对非玩家不写状态，outcome.notApplicable=true。slumber 用 paralysis 免疫；正伤害（包括 shield 全吸收）先清 slumber，再沿原生伤害。临时来源同 actor+owner+key 再授予只刷新 max(until)，不叠加；有效性 simulationTicks<until，活动块/入层删除过期并物化。

火 cause 联合类型实际有七值：spawn-fire、thrown、floor-burning、carrier-ignited、roast-command、heat-source-throw、lava；任务书的“六类入口”把两种 throw 归一类。所有地面接触（lava 例外）检查 absoluteTurnNumber<until；transform 写 +10，拾取/容器接纳/生物携带成功后 delete。背包和 roast 不看冷却；仅首次玩家着火，在 setBurningDuration 后按 letter 升序对每堆 randRange(1,3)==1，无食物零 draw。整堆爆裂 quantity<threshold 用 EXPLOSION_FIRE，否则 BLOAT；floor/player/roast heat 格为效果位置。熔岩 explode 爆炸、其余毁掉沿原生 ITEM_FIRE。先移除/转化/冷却，后 participant、名称解析/message、DF；同回调 ID 升序、跨回调 FIFO，每件同次最多一次。

热源为 combat 既有篝火 worldRest 绑定，或任意 owner 的真实 station 定义带 station.hearth。同层、seen、Chebyshev≤各定义 interactionDistance 且 hasInteractionLine；无威胁限制，不生成火地形，不要求 providing module 改代码。真实 crafting hearth 已测试。可食投掷仍沿原生非武器 landing，火/热源处一次接触后正常回合结算。

知识 unknown→tasted→known / unknown→known，markKnowledge 只能本 owner 成员，退回/越组 false 不写；call 写本定义 title，29 码点，已 known 沿原生“已经知道”拒绝。模板 roasted/node 只含 {{name}} 一次；called 为 {{name}}/{{title}} 各一次，其余 tastedNote/roastUnknownNote/unknownDetail 不含占位符。外观为整局倒序 Fisher–Yates，用 appearancePool.length−1−i 为 ordinal。原生鉴定/探测/最后种类升格/揭示全部/knownKinds/itemKnowledgeChanged 不读写登记表；幻觉名称不随机化。

| 对象 | unknown / tasted | known | title |
| --- | --- | --- | --- |
| 生 | 外观名；tasted 加 tastedNote | 种类真名 | 非 known 加 called |
| 烤 | 外观烤名；若生已知则用种类真名并在 unknown 加 roastUnknownNote；tasted 加 tastedNote | 种类真名的烤模板 | 非 known 加 called |
| 节点 | 由生是否 known 决定外观/真名，再套 node；详情仍由节点 own knowledge 决定 | 同左名称规则 | 不拼玩家物品 title |
| 无组定义 | 自身 nameKey/descriptionKey，恒 known | 同左 | 不属未知种类 call |

unknown/tasted 详情只外观描述+unknownDetail，effect/satiety 不显示；known 才显示种类描述和饱腹。unknown/tasted 吃/feed 确认取整个组 raw/roasted satiety 的最大值，不随隐藏种类泄露。

H4 算法与向量见 §4，实际 owner 盐见 §3.2。H5 为 c5-group-place-v1，首 visited enteredLevel 事务中：原 c5-place-v1→group→startup→模块 enteredLevel。排序 owner/group 码点；count/kind/cell domains=`<groupId>.<count|kind|cell>.dungeon.<d>`；候选复用 D8 并按 y,x，加权无放回；Chebyshev radius 内基础类型命中标签即 preferredWeight，否则 otherWeight。首版标签只 terrain.luminescent-fungus（LUMINESCENT_FUNGUS）和 terrain.fungus-forest（FUNGUS_FOREST/TRAMPLED_FUNGUS_FOREST），不支持洞穴房间偏好。

实例 key `<groupId>#dungeon.<d>#<k>`；每组层收据 kind:'placement'、identity:'<groupId>@dungeon.<d>'、result:'completed'|'skipped'、reason:null|'no-space'|'budget'|'run-limit'。遵守每层节点32/整局512及既有 world interactable 子预算，0 native RNG；不改楼梯、reservation 或生成。32/512 单元探针使用隔离 trusted 预置计数，不能据此声称满512合法节点长局已验收。

### 7.4 需求、离开、命令与投影

需求公式：elapsed=now−lastSettledTick+remainder，points=floor(elapsed/ticksPerPoint)，value=max(0,value−points)；正值余数=elapsed%ticksPerPoint，零值余数=0；首次零点=oldLast−oldRemainder+oldValue×ticksPerPoint。读取纯计算不写，写点物化。物化本身不增 revision；挂载、喂食、事件写、离开开始增 revision。按 actorId/needId 稳定序；活动客观块在玩家饥饿段后发精确 band/crossedAtTick 和一次 deadline，入层补 deferred:true，离开者不再需求事件。qualifies 仅固定触发：ally-gained/lost、group-changed、resident-changed、trusted；facts 为 actorId/monsterId/allied/inanimate/timedSummon/groupRole，ctx 只有 queryOptional。Promise/异常不作为资格 true；诊断。死亡删行，不保留待复活；复活通过 gained 重新 initial。模块 onNeedEvent 只写本 actor 的 own component；标脏 actorStatRevision 并沿 S6 同事务物化。

Departure public type由 NeedTransaction.depart 暴露模块；beginDeparture/retireActor 是 foundation 可信 API（§8 示例）。保留盟友但不跟随/攻击/指挥/换层，向最近可达楼梯，否则远离玩家；isIncapacitated 与 native action lock gate 阻止移动。不可见/grace=0 立即退役；客观块楼梯/不可见/until、玩家离层时退役。稳定近邻落携带物，无位原格；核心带整个 giants 群体清理，无 kill/death/XP/deathDF/死亡消息、不进复活池。actorDeparted={actor,owner,reason,deferred}；receipt schema1，ordinal 单调，≤128 滚动。

feed payload v1 是 `{targetId,targetRevision,itemId,inventoryStamp}`；targetRevision=需求行 revision。roast 为 `{heatSourceId,itemId,inventoryStamp}`。没有额外 `v` 字段（strict unknown key）；v1 指 SDK 接口版本。prepare 深冻结读取、0 tick/RNG/ID；句柄作用域按 prepare issuer + command epoch，过期 C5_SCOPE、使用一次、提交 canonical 重算不等 C5_STALE。风险确认先 recordDecision:false 收集，重 prepare/CAS 相等后只记一次决定；No 仍一条记录，机械状态/双流不变。eat/feed/roast 均 movementSpeed+playerTurnEnded，throw 原生耗时。

feed 拒绝：BAD_PAYLOAD（键/型）、UNKNOWN_TARGET（无/不可见/无本 owner 行）、WRONG_LEVEL、DISTANCE（不相邻/无交互线）、GATE（目标失能/离开）、INPUT（非背包可食/FOOD）、STALE（CAS）、BUSY（玩家失能/锁）。roast 未见 UNKNOWN_TARGET，无/超距/无线 DISTANCE，物品 INPUT/CAS STALE/玩家 BUSY；异常/Promise/返回形状 PROVIDER、越句柄 scope SCOPE。不增 WorldErrorCode，玩家用现有 `ext.foundation.world.error.*`。

feed 永接受合格目标；扣1、饱腹封顶max，>0清零点/截止；原生口粮1800、芒果1550不改。意图作用目标，status-and-satiety 减目标需求。roast 对整堆一次 strict 火接触；owner participant 失败整个 eat/feed/roast/call 回滚为已记录0成本 PROVIDER；时间火/需求/离队 participant失败丢模块暂存写，机械提交、session诊断。onConsumed/onFireContact/NeedTransaction 以冻结类型为准，同步纯JSON、不可启动事务或取RNG。

ProjectionContext.edible? 仅对声明新包键 owner 提供 readEdibleContext/knowledge；背包 displayName、详情、地图 hover、可见 node/station 列表由 foundation 动态解析，同一来源无需改Vue新UI。新增 foundation locale 六键：

- ext.foundation.edible.confirm.not_hungry
- ext.foundation.edible.confirm.overfeed
- ext.foundation.edible.satiety
- ext.foundation.status.slumber
- ext.foundation.status.slumber_wake_player
- ext.foundation.status.slumber_wake_monster

`createForageHarness(options: WorldHarnessOptions, overrides?: readonly ModuleDescriptor[])` 自动加入 fgfixture，返回原 WorldHarness 全方法加 `fixture(payload)` / `readEdibleContext(owner='fgfixture')` / `game()`。原 `WorldHarnessOptions.fixtures` 联合未改；fixture 是 test/DEV，生产 catalog 不登记，构建 assets 中无 fgfixture。参照范围仅 DTO/commands/participants/neutral data，不能把 fixture 样本数值当生产设计。5G 在 `src/ext/modules/foraging/tests/**` 放测试并提供模块自有 test-suites.json，由现有模块发现器合并/防漏，不改共享底座清单（参照 crafting）；本步九底座测试及审查新增第十文件已登记 scripts/test-suites.json。

5G 必须带走：物理伤害虚弱用 increased 负值；离开态内部继续 allied；揭示烤物时模块参与者同时 markKnowledge 生定义 known（foundation 不自动联动）。本步不填写 foraging 生产种类/数值。

## 8. 交接 5D

可信 settlement 路径在自己的提交事务内，居民写入 world5.residents **后**调用 `triggerActorNeeds(game,[actor],'resident-changed')`。现有实际接线在 Game.ts:1858 的 managed world resident 登记；fixture 也有真实触发。生产居民登记本步非目标；5D 不应在每个回合轮询 qualifies。

5D 若有自己的 resident/order/frozen ledger 引用，应在同一 settlement 事务内解除这些引用，再调用可信离队 API；本步 retirement 清理实体、组件、need/timed/departure 和 native 缓存，并不替未来 production settlement 决定居民订单归属/退款策略。

```ts
// foundation trusted settlement implementation, never imported by a content module
beginDeparture(game, actorId, {
  owner: 'settlement', reason: 'resident-left', visibleGraceTicks: 300
});
// settlement 必须具备合法 edible/need worldDefinitions owner 身份。
// 已离开、不可见或 grace=0 会同步 retire；其余由客观块/离层结算。
```

计粮只用冻结 `ItemRead`：筛 tags.includes('food.ingredient.mushroom')，对 quantity 求和，不把 ItemCategory.FOOD 当蘑菇判据，也不依赖隐藏定义、名称或 effect。fgfixture 全部可食定义带此 tag，可用于 5D2 soft interface 测试；真实 foraging 内容将由 5G 提供。

## 9. 验证边界

真实浏览器 UI、最大状态/512节点/长时需求/大录像长期运行、5Z 的完整 npm test/全部 test:ext/物理删除矩阵与全子集：**未验证**。CE 源码条件测试：**未验证**。本步只交相关开发期门禁；engine-only smoke 不代表 UI 验收。尚无 merge commit，不宣称已合入或已满足派发 dot 所需的合入身份。

原始截图未产生，>1MB 的 raw 证据均在仓库外。没有新增 CRLF；最终 diff --check 通过。原有 compressed UR4 规范黄金本已超过1MB，本次仍按原捕获方法维护它，不作为 raw 证据新提交。

## 10. 审查发现处理

本节记录独立审查后的最终候选；§5、附录 A/B 是首交实施的历史证据。本次先读 `phase5a4.review-findings.md`，复核审查副本 `/private/tmp/p5a4-review` 的 P5/P7 改法，再按维护者裁定实施。审查修复的只读原始证据、修复前副本、命令 stdout/exit/耗时及归因留在 `/private/tmp/phase5a4-fixes/`，不提交这些 raw 产物。

### 10.1 复现、修复与回归

以接收审查时的完整候选复制为 `before/`，只放入新增回归文件及其清单登记，生产文件保持原样；最初 25 项回归 **25 项全部失败**（`repro-before-final`，17.764 s），覆盖下面选定的问题。随后补充真实换层、保存/录像闭环、体群与原生入口等用例，最终 `ext_edible_review.test.ts` 共 **42 项**。未降低原测试断言或把失败项改成 skip。

| 发现 | 复核及最终行为 | 新回归与既有验证 |
| --- | --- | --- |
| P1 离队攻击、多次尝试及危险落位 | 确认 goblin 矛击及熔岩问题。候选通过原生 `canEnterMovementTerrain`（monsterAvoids）和危险 flags 检查，只尝试排序后的第一个格；失败消耗一个移动计时。单体用 `commitCreatureAnchor`，体群用原 compositor，均不进入攻击或会产生伤害/DF 的环境落位路径。到楼梯后先退役。 | 矛攻击/失败一步、熔岩/坠落/火/毒气拒绝、蛛网/呕吐各只一次，另测原生 activation DF/尸体吸收、入迷、直接 native fallback 入口及真实 giants 体群完整落位。原 departure/slumber/giants 回归保留。 |
| P2 qualifies 错误 | 抛错、非布尔和 Promise 均降级为 false，并记 `{owner,method:'qualifies'}`，原生盟友/关系流程继续；Promise rejection 被接住。 | 3 类故障的真实盟友挂载，及已有需求行失败重评；诊断、盟友状态、行移除和 native 流程不中断均断言。 |
| P3 在途需求缓存 | nextDue 对全部需求行计算，只排除离队者；活动层过滤仅在实际结算时使用。 | 原生 `monsterEntersLevel`，以及真实 stairs 命令、源层缓存持有者、`entersLevelIn` 倒计时入层、过期 band/deadline；save/load/replay/seek/续录。 |
| P4 复活需求 | 原生 resurrectAlly 成功发布之后以 `ally-gained` 触发资格；体群按同组活动成员一并传入。 | 同一 actor ID 死亡→purgatory→复活，需求恢复 initial，hp/isAlly 正确；真实命令录像闭环。 |
| P5 DF 中排空 | 与审查副本已验证改法一致：DF active 时 drain 立即返回；最外层成功 spawnSettled 解开上下文后排空。 | 真正 DF 点燃玩家背包，onFireContact 时 DF contact 活动深度为 0；FIFO/冷却/原生 DF/闭环由原 fire-contact 集合覆盖。 |
| P6 定义键泄露 | 可食 MATERIAL 恢复装备拒绝；原生 equip/unequip/drop、识别、护符、武器及深水/熔岩拾取消息统一使用 displayName。拾取 i18n 还补齐 name 参数。 | 未知可食物拒绝装备与丢弃日志无内部键、无知识误揭示；深水/熔岩拾取插值；全仓审计详见 §10.2。 |
| P7 重复渲染准备 | 与审查副本已验证改法一致：处理循环仅累积 render 标记，FIFO 排空后一次 requestEdibleRender。仍在 recorder checkpoint 前完成。 | 20 堆×quantity 1/3 真实连锁只准备 1 次、产生 20 个接触事实、物品移除；save/load/replay/seek/续录，性能与黄金归因见 §10.3。 |
| P8 非活动持有与旧调度快照 | 离队查找统一覆盖 active/dormant/cached/purgatory/pending fallen；坠落后从 pending 持有者退役、清行并只留一张收据。调度、native fallback 和深水扫荡均复查当前 active 归属。 | 原生 monstersFall；同推进块中提前退役的后续 due actor 不再调用 takeNativeDecision；坠落退役录像闭环。安全楼梯退出沿既有回归验证。 |
| P9 组内泄露信号 | 安装时强制同知识组 raw 与 roasted 的 glyph/color/maxStack/tags 一致；关联节点 glyph/color 也与组一致。 | 四项食物字段和两项节点字段逐项拒绝；既有合法定义集合与知识投影回归继续通过。结束画面复核见 §10.2。 |
| P10 DF 错误覆盖 | spawnSettled 移出 finally；DF 抛错只解除活动上下文，原异常原样传播，不在半完成地图上结算。 | 保留原 Error 的错误消息、spawnSettled 调用为 0；finally 的上下文清理保持原样。 |
| P10 饥饿伤害 | 保留原生 hp -= 1、绕过护盾的饥饿规则，在扣血前 wakeSlumber。 | 饥饿扣血、唤醒及护盾值断言；既有沉眠与麻痹共存回归保留。 |
| P10 超喂风险标注 | 新内部 ControlledActionRisk.kind=`edible-overfeed`；target 是受喂 actor，保留原录制确认决定语义。 | 独立 risk 类型/目标、拒绝决定、save/load/replay/seek/续录。原 tool-break 回归保留。 |
| P10 一次跨多 band | 每个阈值按跨越时刻顺序独立发事件，fact.value 使用跨越时的投影，最后再物化当前值；revision 单调递增。 | full→low→empty→deadline 的时间/value/previousBand/deferred/revision，失败中间 hook 不阻断后续机械事件；中间 band 请求离队或立即退役后不再发后续 band/deadline，且闭环。 |

按合同精神自行决定的细节：

1. 危险地形过滤采取保守策略，免疫火/飞行物种也不主动进入伤害、熔岩、坠落、深水、陷阱及自燃格；安全楼梯是原生 monsterAvoids 禁入楼梯的 E26 专用例外。非攻击落位保留一次呕吐/蛛网挣扎与缠绕状态处理，跳过环境 promotion/DF；沉眠、麻痹、入迷、笼子和 body decision disability 只等待。绝不因本次主动落位受伤或攻击。
2. 体群继续校验完整 formation 和全部肢体地形。新回归揭示离队计划的 ticksUntilTurn 指纹会被提交前赋值破坏，故仅在离队路径的成功 compositor commit 后赋计时；compositor 校验/指纹规则保持原样，原生非离队分支保持原赋值时序。
3. qualifies 的故障 false 使用普通 false 的既有语义：已有行发 detached/ineligible 并移除，未挂载者不创建行；不把失败当资格 true，也不让原生调用失败。诊断保持非持久 session 数据。
4. band callback 失败沿时间路径降级，机械跨越继续；callback 成功要求 depart 后，检查离队状态和行是否仍存在，从而覆盖同步立即退役（其 departure active 已被移除）的情况。每个跨越和 deadline 各增加 revision，不被最后物化的旧投影覆盖。
5. 用可信 fixture 扩展完成原生 fall/resurrect/stairs 入口验证；fixture 的 API 只用于 DEV/test，未扩展 worldSdk 或生产内容模块合同。

维护者明确保留并移交 **5G** 的两项：**roast 对整条连锁 strict 回滚**、**沉眠期间原生自动吃 FOOD**。两者本步保持原行为；自动进食仍不吃 MATERIAL。沉眠自然到期提示、hover O(V·E) 属审查的其他低项，本次没有改变；营养时钟继续按原规则推进。

### 10.2 全仓 Item.name 审计与守卫归因

用 TypeScript checker 遍历非测试 src，识别类型为 Item 的 `.name` 访问；另用 rg 检查 Vue/模板及中央 Item formatter。修复玩家消息之后余下 11 处逐项分类（完整表达式及行号在 `item-name-audit.json`）：

| 文件 / 读点 | 留用原因 |
| --- | --- |
| Inventory.ts kind fallback；runtime.ts equippedItems.kindKey | 身份/种类数据，不是显示消息；MATERIAL 不能装备 |
| FireContact.ts item.name 赋值 | 生/烤转化时保存定义 nameKey；玩家名称由动态 displayName 解析 |
| BlueprintEngine.ts 与 GenerationCoordinator.ts | 内部生成审计 ledger，不是玩家消息 |
| ItemUseCoordinator.ts、Game.ts 两处、WorldMaterialTransfer.ts | Item 克隆构造元数据，不是展示 |
| ItemDetailIntro.ts | 原生 catalog 的身份查找 |
| DetailGenerator.ts omniscient 分支 | 原生明确全知详情的真名标题；MATERIAL 在前置分支已经用 displayName 返回 |

Item.ts 中央 displayName 对 this.name 的读取是 formatter/原生身份来源，不替换持久元数据。审查 P9 所指 `GameEndOverlay.vue` 的 item.name 实际为结束画面 DTO 字段：`Game.triggerGameOver` 填入的是 item.displayName；并非 Item.name 泄露，故此模板不改。

P6 的深水/熔岩消息位于两个既有 raw-terrain 读者 if statement 内，源文本变化使结构读者指纹失效。先复核 before/after statement，确认 `cell.layers`、scope、两个地形条件与各 count=1 完全相同，再登记仅这两处新的完整 statement 指纹：

| 原 key | 本次 key |
| --- | --- |
| `09c29f59fab3e6160e697cd46e19d05bda0511b61d495257533cf35221ccca0d` | `e1455e6468c2691118ab2e51a5858a18298ea1b802b0cff01f2c7a424fc3e14a` |
| `16f5f26390bbb865d977bb995213caa0893b0a406d9ea8e1959087a832fe4219` | `af49cfe706dbb6a3e6f69005f423f7265ecf69d5e2f8f6e76c75240ce383b93c` |

`reader-message-attribution.json` 登记了两个完整源语句差异：只有 logger 的 displayName/name 参数。未修改地形判据、守卫算法、断言语义或 count；E23/E26 三处 pin 保持原字节。最终 boundary 通过。

### 10.3 P7 性能与黄金逐字段归因

独立测量使用 Node 24.19.0 / Apple M5（10 核）、3072 MB heap；无并行测试或 build。审查前候选与修复后各用隔离 Vite SSR runtime，同 seed 51020001、同一真实 recorded fixture fire，20 堆放同格，每种场景 3 对交替先后执行（共 24 对）。下表是每项 3 次 median，单位 ms，不是 P95；原始每对值在 `performance.json`。wall 包含整条 fixture 命令、原生 DF、接触、结算和录像，render 单独包裹 requestEdibleRender。全场景铺 77×27 安全地面以控制 DF 传播；小场景铺 11×11，外围保留自然地图。玩家高 HP/无怪物是测量控制，不代替自然 trace。

| 模块（均含 fgfixture） | quantity | 场景 | wall 审查前→现 | render 审查前→现 | 准备次数 |
| --- | --- | --- | --- | --- | --- |
| 无其他模块 | 1 | 11x11 | 360.433→367.847 | 0.011→0.003 | 20→1 |
| 无其他模块 | 1 | full-arena | 727.016→753.229 | 0.014→0.002 | 20→1 |
| 无其他模块 | 3 | 11x11 | 484.259→361.975 | 137.091→11.534 | 20→1 |
| 无其他模块 | 3 | full-arena | 1190.394→761.831 | 478.982→31.128 | 20→1 |
| growth/narrative/combat/giants/crafting | 1 | 11x11 | 357.118→364.914 | 0.009→0.006 | 20→1 |
| growth/narrative/combat/giants/crafting | 1 | full-arena | 742.589→754.797 | 0.012→0.004 | 20→1 |
| growth/narrative/combat/giants/crafting | 3 | 11x11 | 486.703→365.456 | 138.090→7.734 | 20→1 |
| growth/narrative/combat/giants/crafting | 3 | full-arena | 1196.041→756.318 | 476.957→31.266 | 20→1 |

quantity 3 的重复 flare 准备明显减少；quantity 1 几乎没有 flare 准备开销，总命令没有观察到改善。全场景修复后仍约 0.76 s，同步 native DF/结算和录像的剩余停顿没有拆帧。§6 原 725.887 ms 单样本是首交历史；“主要运行 DF”的原分析没有单独量出准备耗时，本次以成对结果及分项测量为准。

**P7 单变量归因**：另起同当前源码的隔离 Vite runtime，只在内存 transform 把 FireContact 恢复为循环内逐接触准备；其他 P1–P10 修复保留。与最终源码运行同一个 quantity 3 / 20 堆真实场景，before 准备 20 次、after 1 次，各 20 个接触事实、无残留物品，完整 toSnapshot 除 savedAt 后逐叶比较 **0 处差异**（`p7-only-before-snapshot.json`、`p7-only-after-snapshot.json`、`p7-only-leaf-diff.json`）。本场景没有观测到 isExplored、原生两流或持久需求/知识字段差异；不将其扩大为所有地形下不可能改变探索的结论。

**规范黄金**：最终按原 UR2/UR3/UR4、crafting natural trace、giants 三种自然 trace 的捕获/比对入口运行，全部通过；六个仓库黄金与审查前候选字节相同，逐字段新增变化为 **0**。这些规范场景没有食物接触链，因此本批没有受影响的规范黄金需要重录；不为 P7 改写无差异的黄金。首次 E1 所需的重录和逐字段登记仍保留在 §5.1，本批没有再次改它们。完整前后 SHA 在 `review-golden-hashes.json`：

| 黄金 | 本批前后相同 SHA-256 |
| --- | --- |
| `src/test/fixtures/traces/u-r3-trace.json.gz` | `03f034d0f69f7071c57cbf5aa5166df9d0e2de07077806e17d45b4addfc69f95` |
| `src/test/fixtures/traces/u-r4-trace.json.gz` | `0893f749cfbcd6e16d3632ae29c34ad79626a83389d8b3d0e568b9e9cb6837c4` |
| `src/ext/modules/crafting/data/natural-trace.json` | `89425e66fc7ed3942b384add154d460ea594527e331d3afacae44aeeded13a1c` |
| `src/ext/modules/giants/data/natural-trace.json` | `fc975ad841ea4985f81b1dc2ac8480e3d24076dc6aadd4ce4a3f44171dd02a4c` |
| `src/ext/modules/giants/data/colossus-natural-trace.json` | `b8d0e7a1c876a3ecd7bfeba1dcb754ae7f3ad7c0edb08559388d083811559632` |
| `src/ext/modules/giants/data/spine-natural-trace.json` | `5f71a93a83e91fa402fd93b5801c90241762f37904317e2c5c53f27d5ca3bb54` |


### 10.4 最终门禁与冻结

所有最终 Node 门禁将 codex runtime bin 放 PATH 首位，实际 v24.19.0，NODE_OPTIONS=--max-old-space-size=3072；所有 vitest 命令显式 --maxWorkers=2。按开发期政策只跑相关测试及下表门禁，不跑 test:full/test:gen 或 fetch CE。

| 门禁 | exit / 耗时 | 结果 |
| --- | --- | --- |
| 定向相关测试 (`final-related`) | 0 / 544.775 s | 51 文件：903 passed / 4 既有 CE 条件 skipped（907 项） |
| test:drift (`final-drift`) | 0 / 71.094 s | 5 文件：8 passed |
| boundary (`final-boundary-2`) | 0 / 2.634 s | Module boundaries and test ownership verified |
| vue-tsc -b (`final-vue-3`) | 0 / 9.269 s | 通过 |
| npm run build (`final-build-3`) | 0 / 12.804 s | 通过 |

相关集含新增十文件（原九文件 + review 42 项）和原生移动/伤害/饥饿/DF/坠落/盟友/物品名称/体群/持久录像/源守卫、上述自然黄金。相关集合中的 4 skipped 为已有 CE 源码条件项，缺少 .ce-reference；没有引入 skip，也没有据此宣称 CE 条件验收。最终 related 的精确命令如下，其他门禁分别为 `npm run test:drift -- --maxWorkers=2`、`npm run check:modules`、`npx vue-tsc -b`、`npm run build`：

```sh
npx vitest run \
  src/test/ext_actor_needs_runtime.test.ts \
  src/test/ext_departure_runtime.test.ts \
  src/test/ext_derived_draw_vectors.test.ts \
  src/test/ext_edible_review.test.ts \
  src/test/ext_edible_runtime.test.ts \
  src/test/ext_fire_contact_runtime.test.ts \
  src/test/ext_kind_knowledge_runtime.test.ts \
  src/test/ext_placement_group_runtime.test.ts \
  src/test/ext_slumber_runtime.test.ts \
  src/test/ext_edible_combinations.test.ts \
  src/test/u_03b_level_travel.test.ts \
  src/test/u_06_monster_damage.test.ts \
  src/test/u_07_monster_blink.test.ts \
  src/test/u_11_corpse_learning.test.ts \
  src/test/u_12b_ally_mode.test.ts \
  src/test/u_15f_food.test.ts \
  src/test/u_16_lifecycle.test.ts \
  src/test/u_17a_df_transaction.test.ts \
  src/test/u_18_water_cage.test.ts \
  src/test/p2_2_real_speed.test.ts \
  src/test/p2_3_objective_time.test.ts \
  src/test/p2_4_animation_cadence.test.ts \
  src/test/p4_5_melee_specials.test.ts \
  src/test/f_2b_creature_burning.test.ts \
  src/test/f_2c_explosion.test.ts \
  src/test/c_5_fall_subsystem.test.ts \
  src/test/u20_inventory.test.ts \
  src/test/x3_u6_messages.test.ts \
  src/test/x3b_item_details.test.ts \
  src/test/x2d_scroll_equipment.test.ts \
  src/test/b_1a_identification.test.ts \
  src/test/u_15d_weapon_runic.test.ts \
  src/test/u21c_flare_sidebar.test.ts \
  src/test/retained_render_determinism.test.ts \
  src/test/phase4d_composite_movement.test.ts \
  src/test/phase4d_movement_environment.test.ts \
  src/test/phase4d_terminal_identity.test.ts \
  src/test/phase4e_recording.test.ts \
  src/test/ext_prepared_controlled_commands.test.ts \
  src/test/ext_foundation_contracts.test.ts \
  src/test/ext_structure_source_guard.test.ts \
  src/test/ext_module_boundaries.test.ts \
  src/test/repo_hygiene.test.ts \
  src/test/u_r2_trace.test.ts \
  src/test/u_r3_trace.test.ts \
  src/test/u_r4_trace.test.ts \
  src/ext/modules/crafting/tests/crafting_trace.test.ts \
  src/ext/modules/giants/tests/giants_trace.test.ts \
  src/ext/modules/giants/tests/giants_spine_trace.test.ts \
  src/ext/modules/giants/tests/giants_runtime.test.ts \
  src/ext/modules/giants/tests/giants_rigid.test.ts \
  --maxWorkers=2
```


旧 W-26 失败单列：首轮原生相关 42 文件共 737 passed / 4 既有 CE 条件 skipped / 1 failed；失败是 `w_26_arcana_closure.test.ts:150` 的旧 flavor 缺失槽重建后第二次 loadSnapshot 断言。保持同一旧测试不变，在修复前候选副本及原 `53efa07` HEAD archive 中运行同一 testNamePattern，均在同一断言得到 false（`w26-before`、`w26-head`）。确认不是本批或首交 5A4 造成，不改它的生产路径、前提或断言；最终定向相关集合不纳入这个无关旧迁移用例。本报告不宣称完整 npm test 或该旧用例通过。

worldSdk.ts 与 HEAD 和审查前副本逐字节相等，SHA-256 仍为 `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343`。foundation=10、whole-run=6、recording=4、origin=2、IDB=2、World5.schema=1、EDIBLE_SDK_VERSION=1，本批无额外 bump；生产模块版本/rules 没改。§7.1 已更新最终源码/fixture 冻结值，旧首交测量对应的历史源码指纹另在外部证据留存。

| 修复后可信实现 / 回归 | SHA-256 |
| --- | --- |
| `src/engine/Core/ActorNeeds.ts` | `3d0a6d0db8d38d040ff3ceac8eadf74dabd184aa0cc63caa16f09141d79003b4` |
| `src/engine/Core/ActorDeparture.ts` | `23508354817fec9d2da2fe38a22797aea2e4afb0ce874549b8e12337db4af80f` |
| `src/engine/Core/FireContact.ts` | `ac0379717999be75273b3ca9fd997095a739cd039c5d755a195cfddd1fc97463` |
| `src/test/ext_edible_review.test.ts` | `559a38b13d31c859833f9cabcdee2770fb33246ec9bd420a0b2cb179199df424` |


原始证据只在本机临时目录；没有新 raw 大文件/截图/CRLF，没有 commit 或 push。未追加 full/CE fetch/5Z/浏览器门禁。

## 附录 A. 首交门禁命令与逐文件清单（历史）

下列命令均在首交候选工作树运行，审查后的最终门禁在 §10.4；A 为首次相关集合（E1黄金更新前）；其后只重跑修复/新增直接涉及的文件，不把定向集合冒称 full 档。每个编号与 §5 同表对应，原 stdout/exit/elapsed JSON 位于仓库外同名 evidence。

### A 首次相关集合

```sh
npx vitest run \
  src/ext/modules/combat/tests/combat_adapters.test.ts \
  src/ext/modules/combat/tests/combat_body_transition_facts.test.ts \
  src/ext/modules/combat/tests/combat_bonfire_definitions.test.ts \
  src/ext/modules/combat/tests/combat_bonfire_runtime.test.ts \
  src/ext/modules/combat/tests/combat_bonfire_ui.test.ts \
  src/ext/modules/combat/tests/combat_part_break_runtime.test.ts \
  src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts \
  src/ext/modules/combat/tests/combat_phase4d_body_lifecycle.test.ts \
  src/ext/modules/combat/tests/combat_runtime.test.ts \
  src/ext/modules/crafting/tests/crafting_persistence.test.ts \
  src/ext/modules/crafting/tests/crafting_projection.test.ts \
  src/ext/modules/crafting/tests/crafting_runtime.test.ts \
  src/ext/modules/crafting/tests/crafting_sdk_integration.test.ts \
  src/ext/modules/giants/tests/giants_c5_placement.test.ts \
  src/ext/modules/giants/tests/giants_colossus.test.ts \
  src/ext/modules/giants/tests/giants_committed_transition.test.ts \
  src/ext/modules/giants/tests/giants_composite.test.ts \
  src/ext/modules/giants/tests/giants_composite_natural.test.ts \
  src/ext/modules/giants/tests/giants_composite_sfc.test.ts \
  src/ext/modules/giants/tests/giants_config_examples.test.ts \
  src/ext/modules/giants/tests/giants_contract.test.ts \
  src/ext/modules/giants/tests/giants_rigid.test.ts \
  src/ext/modules/giants/tests/giants_runtime.test.ts \
  src/ext/modules/giants/tests/giants_spine_trace.test.ts \
  src/ext/modules/giants/tests/giants_trace.test.ts \
  src/ext/modules/giants/tests/giants_transitions.test.ts \
  src/ext/modules/giants/tests/giants_transitions_sfc.test.ts \
  src/ext/modules/giants/tests/giants_ui.test.ts \
  src/ext/modules/giants/tests/giants_zones.test.ts \
  src/ext/modules/giants/tests/giants_zones_natural.test.ts \
  src/ext/modules/giants/tests/giants_zones_sfc.test.ts \
  src/test/b_1a_identification.test.ts \
  src/test/b_1b_identification_persistence.test.ts \
  src/test/b_1c_detect_magic.test.ts \
  src/test/b_2_throwing.test.ts \
  src/test/ext_actor_needs_runtime.test.ts \
  src/test/ext_combat_adapter_foundation.test.ts \
  src/test/ext_combat_neutral_differential.test.ts \
  src/test/ext_combat_transition_facts.test.ts \
  src/test/ext_compatibility_diagnostics.test.ts \
  src/test/ext_departure_runtime.test.ts \
  src/test/ext_derived_draw_vectors.test.ts \
  src/test/ext_edible_combinations.test.ts \
  src/test/ext_edible_runtime.test.ts \
  src/test/ext_fire_contact_runtime.test.ts \
  src/test/ext_foundation.test.ts \
  src/test/ext_foundation_contracts.test.ts \
  src/test/ext_kind_knowledge_runtime.test.ts \
  src/test/ext_module_composition.test.ts \
  src/test/ext_placement_group_runtime.test.ts \
  src/test/ext_recording_v4_digest.test.ts \
  src/test/ext_recording_v4_snapshots.test.ts \
  src/test/ext_recording_v4_storage.test.ts \
  src/test/ext_slumber_runtime.test.ts \
  src/test/ext_stats_native.test.ts \
  src/test/ext_stats_pipeline.test.ts \
  src/test/ext_stats_review.test.ts \
  src/test/ext_stats_runtime.test.ts \
  src/test/ext_structure_combinations.test.ts \
  src/test/ext_structure_geometry.test.ts \
  src/test/ext_structure_integration.test.ts \
  src/test/ext_structure_performance.test.ts \
  src/test/ext_structure_properties.test.ts \
  src/test/ext_structure_protection.test.ts \
  src/test/ext_structure_review.test.ts \
  src/test/ext_structure_source_guard.test.ts \
  src/test/ext_structure_transactions.test.ts \
  src/test/ext_world5_clock_levels.test.ts \
  src/test/ext_world5_offline.test.ts \
  src/test/ext_world_harness_closed_loop.test.ts \
  src/test/ext_world_harness_combinations.test.ts \
  src/test/ext_world_items_roots.test.ts \
  src/test/ext_world_work_boundaries.test.ts \
  src/test/ext_world_work_failures.test.ts \
  src/test/ext_world_work_review.test.ts \
  src/test/ext_world_work_sdk_contract.test.ts \
  src/test/ext_world_work_transactions.test.ts \
  src/test/f_1_fire_as_terrain.test.ts \
  src/test/f_2a_fire_mechanics.test.ts \
  src/test/f_2b_creature_burning.test.ts \
  src/test/f_2c_explosion.test.ts \
  src/test/phase3a0_scheduler.test.ts \
  src/test/phase4a2_body_combat.test.ts \
  src/test/phase4d_body_status.test.ts \
  src/test/slaying_melee_autohit.test.ts \
  src/test/u_01_instance_snapshot.test.ts \
  src/test/u_03_whole_run_snapshot.test.ts \
  src/test/u_03b_level_travel.test.ts \
  src/test/u_13_combat_math.test.ts \
  src/test/u_14a_status_gaps.test.ts \
  src/test/u_14b_status_gaps.test.ts \
  src/test/u_15f_food.test.ts \
  src/test/u_19f_fire.test.ts \
  src/test/u_27_recording.test.ts \
  src/test/u_r1_codec.test.ts \
  src/test/u_r2_trace.test.ts \
  src/test/u_r3_trace.test.ts \
  src/test/u_r4_trace.test.ts \
  src/test/w_9_directed_status.test.ts \
  src/test/x2a_recording_checkpoint.test.ts \
  src/test/x2c_hit_status_owner.test.ts \
  src/test/x2f_thrown_math.test.ts \
  src/test/x2g_native_effects.test.ts \
  src/test/x2i_discovery_text.test.ts \
  src/test/x3_u8c_combat_items.test.ts \
  src/test/x3b_display_recording.test.ts \
  src/test/x3b_item_details.test.ts \
  src/test/x4_r3_creature_items.test.ts \
  --maxWorkers=2
```
### B harness/结构/工作位回归

```sh
npx vitest run src/test/ext_world_harness_closed_loop.test.ts src/test/ext_world_harness_combinations.test.ts src/test/ext_structure_source_guard.test.ts src/test/ext_world_work_review.test.ts src/test/ext_world_work_transactions.test.ts src/test/ext_structure_review.test.ts src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts --maxWorkers=2
```
### C 版本/摘要/UR/giants 重录后

```sh
npx vitest run src/test/ext_foundation_contracts.test.ts src/test/ext_recording_v4_digest.test.ts src/test/u_r2_trace.test.ts src/test/u_r3_trace.test.ts src/test/u_r4_trace.test.ts src/ext/modules/giants/tests/giants_trace.test.ts src/ext/modules/giants/tests/giants_spine_trace.test.ts --maxWorkers=2
```
### D 新增九文件完整批次

```sh
npx vitest run src/test/ext_derived_draw_vectors.test.ts src/test/ext_edible_runtime.test.ts src/test/ext_fire_contact_runtime.test.ts src/test/ext_kind_knowledge_runtime.test.ts src/test/ext_actor_needs_runtime.test.ts src/test/ext_departure_runtime.test.ts src/test/ext_slumber_runtime.test.ts src/test/ext_placement_group_runtime.test.ts src/test/ext_edible_combinations.test.ts --maxWorkers=2
```
### E 追加沉眠战斗覆盖

```sh
npx vitest run src/test/ext_slumber_runtime.test.ts --maxWorkers=2
```
### F feed/call/退役失败追加覆盖

```sh
npx vitest run src/test/ext_edible_runtime.test.ts src/test/ext_departure_runtime.test.ts --maxWorkers=2
```
### G 离队 gate 调整后原生回归

```sh
npx vitest run src/test/phase3a0_scheduler.test.ts src/test/phase4d_body_status.test.ts src/test/u_14a_status_gaps.test.ts src/ext/modules/combat/tests/combat_phase4d_body_actions.test.ts --maxWorkers=2
```
### H 最终生产树 drift

```sh
npm run test:drift -- --maxWorkers=2
```
### I 最终 boundary

```sh
node scripts/check-module-boundaries.mjs
```
### J 最终 types

```sh
npx vue-tsc -b
```
### K 最终生产树 build

```sh
npm run build
```

## 附录 B. 反事实与捕获命令

所有以下命令都在隔离副本、保持相同 Node/heap/worker 条件。namePattern 的未选项由 vitest 统计为 skipped，报告区分于 CE 条件 skip。

```sh
# descriptor 单文件回退，counterfactual 副本
npx vitest run src/test/ext_foundation_contracts.test.ts --maxWorkers=2 --testNamePattern 'binds complete'
# 仅 E1 元数据 tuple 回退，metadata-counterfactual 副本
npx vitest run src/test/u_r2_trace.test.ts src/test/u_r3_trace.test.ts src/test/u_r4_trace.test.ts --maxWorkers=2
npx vitest run src/test/ext_recording_v4_digest.test.ts src/ext/modules/giants/tests/giants_trace.test.ts src/ext/modules/giants/tests/giants_spine_trace.test.ts --maxWorkers=2 --testNamePattern 'freezes tagged|naturally recreates'
npx vitest run src/ext/modules/crafting/tests/crafting_trace.test.ts --maxWorkers=2
# 各 base/current 捕获，目录参数分别指向仓库外对应捕获目录
UR3_CAPTURE=1 UR4_CAPTURE=1 UR3_CAPTURE_DIR=<capture-dir> UR4_CAPTURE_DIR=<capture-dir> npx vitest run src/test/u_r3_trace.test.ts src/test/u_r4_trace.test.ts --maxWorkers=2
BROGUE_CAPTURE_GIANTS_TRACE=1 npx vitest run src/ext/modules/giants/tests/giants_trace.test.ts src/ext/modules/giants/tests/giants_spine_trace.test.ts --maxWorkers=2 --testNamePattern 'naturally recreates'
CRAFTING_CAPTURE_TRACE=<raw-file> npx vitest run src/ext/modules/crafting/tests/crafting_trace.test.ts --maxWorkers=2 --testNamePattern 'naturally reproduces'
```

实际目录/文件和值保存在 `capture-before/after.result.json`、`giants-capture.result.json`、`crafting-before/after.result.json` 及各日志；占位符仅为阅读省略本机目录，不表示未执行。原始 trace 差分登记在 `trace-field-diff.json`、`giants-field-diff.json`、`crafting-field-diff.json`。

## 附录 C. H8 paralyzed 全部非测试源码出现行分类

基线为开工 HEAD 53efa07，86 行分布在19文件；包含执行判断、类型/状态登记、施加/解除、文案与 CE 注释，不能把86行都称为独立机械读者。47行执行判断（44直接、3集合）统一谓词；WorldWork 集合附属旧 cast 随迁移删除；StatusId/SpatialSchema合法状态表扩展slumber；paralysis免疫/气体/解除/饥饿及文案保持专属。

“最终锚点”是当前同语义函数的实际起始行，非声称旧表达式还在该行；原基线读行准确保留，便于 git show 定位。覆盖栏为本次相关测试文件（名字省略 .test.ts），其中原生项主要固化 paralysis 不变，新 ext_slumber/ext_departure 项固化新状态与离队；不等于每条读者都用 slumber 穷举调用。growth 两条显示输入判断未做真实浏览器验证。

| 基线读行 | 表达式 / 语义证据 | 分类与处理 | 最终锚点 | 覆盖 |
| --- | --- | --- | --- | --- |
| `src/engine/UI/DetailGenerator.ts:220` | `const playerHitProb = forecastHit ? forecastHit('outgoing') : monster.hasStatus('stuck') \|\| monster.hasStatus('paralyzed') \|\| monster.isCaged` | 失能/无助/中断：改 isIncapacitated | `src/engine/UI/DetailGenerator.ts:110` generateMonsterDetail | ext_kind_knowledge_runtime、x3b_item_details、ext_slumber_runtime |
| `src/engine/Core/PhasedAttackProduction.ts:74` | `\|\|['paralyzed','entranced','confused'].some(status=>source.hasStatus(status as 'paralyzed'))) return false;` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/PhasedAttackProduction.ts:68` eligible | combat_phase4d_body_actions、phase3a0_scheduler、ext_slumber_runtime |
| `src/engine/Core/PhasedAttackProduction.ts:201` | `return !!row&&row.dodgeRemainingTicks>0&&source.hp>0&&!source.hasStatus('paralyzed')&&!source.hasStatus('entranced')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/PhasedAttackProduction.ts:199` isActorDodgeProtected | combat_phase4d_body_actions、phase3a0_scheduler、ext_slumber_runtime |
| `src/engine/Core/PhasedAttackProduction.ts:550` | `if(row.parryRemainingTicks>0&&(!source\|\|source.hp<=0\|\|source.hasStatus('paralyzed')\|\|source.hasStatus('entranced')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/PhasedAttackProduction.ts:547` validatePhasedAttackGeometry | combat_phase4d_body_actions、phase3a0_scheduler、ext_slumber_runtime |
| `src/engine/Core/PhasedAttackProduction.ts:576` | `if(pending && (!expected.includes(sub.profileId??metadata.profileId) \|\| bodyStatusDisables(source,'attacks') \|\| source.hasStatus('paralyzed') \|\| source.hasStatus('entranced') \|\| (source instanceof Monster && source.isCaged)))` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/PhasedAttackProduction.ts:547` validatePhasedAttackGeometry | combat_phase4d_body_actions、phase3a0_scheduler、ext_slumber_runtime |
| `src/engine/Core/PhasedAttackProduction.ts:660` | `return source.hp>0&&!source.hasStatus('paralyzed')&&!source.hasStatus('entranced')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/PhasedAttackProduction.ts:659` defenseSourceValid | combat_phase4d_body_actions、phase3a0_scheduler、ext_slumber_runtime |
| `src/engine/Core/TimeCoordinator.ts:224` | `if (!m.hasStatus('entranced') && !m.hasStatus('paralyzed') && !m.isCaged` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/TimeCoordinator.ts:119` advancementLoop | u_14a/b_status_gaps、u_15f_food、ext_slumber_runtime |
| `src/engine/Core/TimeCoordinator.ts:313` | `if (!ports.world.player.hasStatus('paralyzed') && ports.world.player.nutrition <= 1) {` | 保留 CE paralysis 饥饿/回合统计专属 | `src/engine/Core/TimeCoordinator.ts:245` objectiveTimeBlock | u_14a/b_status_gaps、u_15f_food、ext_slumber_runtime |
| `src/engine/Core/TimeCoordinator.ts:452` | `if (!ports.world.player.hasStatus('paralyzed')) logger.turn++;` | 保留 CE paralysis 饥饿/回合统计专属 | `src/engine/Core/TimeCoordinator.ts:424` playerTurnEnded | u_14a/b_status_gaps、u_15f_food、ext_slumber_runtime |
| `src/engine/Core/TimeCoordinator.ts:537` | `&& !ports.world.player.hasStatus('paralyzed')) {` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/TimeCoordinator.ts:424` playerTurnEnded | u_14a/b_status_gaps、u_15f_food、ext_slumber_runtime |
| `src/engine/Core/TimeCoordinator.ts:549` | `&& ports.world.player.hasStatus('paralyzed'));` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/TimeCoordinator.ts:424` playerTurnEnded | u_14a/b_status_gaps、u_15f_food、ext_slumber_runtime |
| `src/engine/Core/WorldRestProduction.ts:51` | `return game.player.seized \|\| ['paralyzed', 'entranced', 'confused', 'stuck', 'nauseous'].some(status => game.player.hasStatus(status as 'paralyzed'))` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/WorldRestProduction.ts:51` incapacitated | combat_bonfire_runtime、ext_world_work_review |
| `src/engine/Core/Game.ts:557` | `canManageCharacter: () => !this.interactionActive && !this.isGameOver && this.player.hp > 0 && !this.player.hasStatus('paralyzed')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:506` createExtensionRuntime | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:601` | `return entity.depth === this.depth && !this.isGameOver && this.player.hp > 0 && !this.player.hasStatus('paralyzed')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:614` canInteractWith | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:1993` | `if(actors.some(m=>m.spatial?.movementRegionId!==undefined\|\|m.hasStatus('paralyzed')\|\|m.hasStatus('entranced')\|\|m.isCaged))return;` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:2008` scheduleBodyFollower | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:4297` | `\|\| this.interactionActive \|\| this.isGameOver \|\| this.player.hp <= 0 \|\| this.player.hasStatus('paralyzed')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:4323` validateControlledAction | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:4419` | `if (this.player.hasStatus('paralyzed') && action !== 'toggle_inventory' && action !== 'escape') {` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:4406` performPlayerActionStages | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:4420` | `// Loaded/test states may already be paralyzed. The scheduler drains` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Core/Game.ts:4406` performPlayerActionStages | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:4470` | `// 瘫痪时走上方 paralyzed 分支被拦（CE 投掷也须能行动）。` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Core/Game.ts:4406` performPlayerActionStages | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:5461` | `\|\| this.player.hasStatus('paralyzed')) return;` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:5489` eatItemStages | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:5507` | `\|\| this.player.hasStatus('paralyzed') \|\| this.pendingIdentify \|\| this.pendingArcana)) return;` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:5543` readItem | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:5669` | `if (this.isInputLocked() \|\| this.isGameOver \|\| this.player.hp <= 0 \|\| this.player.hasStatus('paralyzed')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:5710` useArcanaItem | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:5772` | `if (this.isGameOver \|\| this.player.hp <= 0 \|\| this.player.hasStatus('paralyzed')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:5811` confirmArcanaTargetStages | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:7210` | `if (target.hasStatus('paralyzed')) {` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:7210` applyMonsterBoltHit | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:7211` | `target.setStatusDuration('paralyzed', 0);` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:7210` applyMonsterBoltHit | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:8367` | `if (status === 'paralyzed') logger.log(i18next.t('status.player.paralyzed', { defaultValue: 'You are paralyzed!' }), '#ff9999', { acknowledge: true });` | 保留 paralysis 文案/情境标签；slumber 使用 asleep | `src/engine/Core/Game.ts:8412` applyTimedStatus | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:8465` | `if (status === 'paralyzed') {` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:8478` applyMonsterOnHitStatus | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:8467` | `i18next.t('status.player.inflicted_paralyzed', {` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:8478` applyMonsterOnHitStatus | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:8536` | `target.setStatusDuration('paralyzed', Math.max(target.getStatusDuration('paralyzed'), duration));` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:8560` applyWeaponRunicEffect | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:8537` | `target.maxStatus.paralyzed = target.getStatusDuration('paralyzed');` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:8560` applyWeaponRunicEffect | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:8540` | `this.spawnFloatingText(i18next.t('status.float.paralyzed', { defaultValue: 'Paralyzed' }), physicalContactOf(target).x, physicalContactOf(target).y, 0x99ccff);` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:8560` applyWeaponRunicEffect | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:8956` | `if (status === 'paralyzed') logger.log(i18next.t('status.player.paralyzed_off', { defaultValue: 'You can move again.' }), '#cccccc');` | 保留 paralysis 文案/情境标签；slumber 使用 asleep | `src/engine/Core/Game.ts:8975` tickCreatureStatuses | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:9529` | `&& monster.hasStatus('entranced') && !monster.hasStatus('paralyzed') && !monster.hasStatus('stuck') && (dx \|\| dy))` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:9573` moveEntrancedMonsters | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:11230` | `if (!aborted && !this.isGameOver && this.player.hp > 0 && this.player.hasStatus('paralyzed')) {` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:11260` finishAdvancement | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:11540` | `if (snapshot.run.isGameOver \|\| decodedPlayer.hp <= 0 \|\| decodedPlayer.hasStatus('paralyzed')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:11530` loadSnapshot | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:12308` | `const owner = bodyStatusOwner(entity, 'paralyzed');` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:12116` applyEnvironmentalEffects | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:12315` | `? entity.applyStatus('paralyzed', 20)` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:12116` applyEnvironmentalEffects | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:12316` | `: this.applyStatusToMonster(entity as Monster, 'paralyzed', 20, 'gas');` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:12116` applyEnvironmentalEffects | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:12318` | `logger.log(i18next.t('status.player.paralyzed', { defaultValue: 'You are paralyzed!' }), '#ff9999', { acknowledge: true });` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Core/Game.ts:12116` applyEnvironmentalEffects | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:12573` | `if (!source \|\| bodyStatusDisables(source,'attacks') \|\| slot.life !== 'active' \|\| slot.readyInTicks > 0 \|\| source.hasStatus('paralyzed') \|\| source.hasStatus('entranced')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:12605` takeBodyDecision | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/Game.ts:12817` | `if (core.hasStatus('paralyzed') \|\| core.spatial!.actionLockInTicks \|\| bodyStatusDisables(core,'movement')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/Game.ts:12869` rotateBodyPart | ext_edible_runtime、ext_actor_needs_runtime、ext_slumber_runtime、b_2_throwing、u_03_whole_run_snapshot |
| `src/engine/Core/ActorActionProduction.ts:57` | `return (actor.spatial?.actionLockInTicks ?? 0) > 0 \|\| actor.hasStatus('paralyzed') \|\| actor.hasStatus('entranced')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/ActorActionProduction.ts:57` incapacitatedSource | phase3a0_scheduler、combat_phase4d_body_actions |
| `src/engine/Core/WorldWork.ts:256` | `if (a.hasStatus('paralyzed') \|\| a.hasStatus('entranced')) reject('C5_BUSY');` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/WorldWork.ts:248` common | ext_world_work_review/transactions、ext_slumber_runtime |
| `src/engine/Core/WorldWork.ts:986` | `['paralyzed', 'entranced', 'confused', 'stuck', 'nauseous'].some((status) =>` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/WorldWork.ts:975` interruptReason | ext_world_work_review/transactions、ext_slumber_runtime |
| `src/engine/Core/WorldWork.ts:987` | `a.hasStatus(status as 'paralyzed')` | 迁移附属：旧集合 cast 随谓词改写删除 | `src/engine/Core/WorldWork.ts:975` interruptReason | ext_world_work_review/transactions、ext_slumber_runtime |
| `src/engine/Core/ActorActionAuthority.ts:73` | `\|\| source.ticksUntilTurn > 0 \|\| source.hasStatus('paralyzed') \|\| source.hasStatus('entranced') \|\| source.hasStatus('confused')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Core/ActorActionAuthority.ts:68` prepareActorAction | phase3a0_scheduler、combat_phase4d_body_actions |
| `src/engine/Combat/ActorCombatResolution.ts:297` | `if (!a \|\| !d \|\| a === d \|\| a.hp <= 0 \|\| d.hp <= 0 \|\| (a.spatial?.actionLockInTicks ?? 0) > 0 \|\| a.hasStatus('paralyzed') \|\| a.hasStatus('entranced')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/ActorCombatResolution.ts:294` eligible | phase4a2_body_combat、u_13_combat_math、combat_runtime |
| `src/engine/Combat/ActorCombatResolution.ts:303` | `if (!owner \|\| owner.hp<=0 \|\| (owner.spatial?.actionLockInTicks??0)>0 \|\| owner.hasStatus('paralyzed') \|\| owner.hasStatus('entranced')) return null;` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/ActorCombatResolution.ts:294` eligible | phase4a2_body_combat、u_13_combat_math、combat_runtime |
| `src/engine/Combat/ActorCombatResolution.ts:342` | `const defenseActive = defender.hp > 0 && !defender.hasStatus('paralyzed') && !defender.hasStatus('entranced')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/ActorCombatResolution.ts:322` commitNativeMelee | phase4a2_body_combat、u_13_combat_math、combat_runtime |
| `src/engine/Combat/CombatText.ts:3` | `export type AttackCircumstance = 'none' \| 'zero' \| 'lunge' \| 'paralyzed' \| 'asleep' \| 'sneak' \| 'helpless';` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Combat/CombatText.ts:3`  | x2i_discovery_text、ext_slumber_runtime |
| `src/engine/Combat/CombatText.ts:52` | `: ['lunge', 'paralyzed', 'asleep', 'sneak'].includes(circumstance)` | 保留 paralysis 文案/情境标签；slumber 使用 asleep | `src/engine/Combat/CombatText.ts:31` formatCombatText | x2i_discovery_text、ext_slumber_runtime |
| `src/engine/Combat/CombatText.ts:62` | `paralyzed: \` while ${subject} ${d.player ? 'are' : 'is'} paralyzed\`,` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Combat/CombatText.ts:31` formatCombatText | x2i_discovery_text、ext_slumber_runtime |
| `src/engine/Combat/CombatText.ts:67` | `: (circumstance === 'paralyzed' \|\| circumstance === 'helpless') && d.player` | 保留 paralysis 文案/情境标签；slumber 使用 asleep | `src/engine/Combat/CombatText.ts:31` formatCombatText | x2i_discovery_text、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:61` | `* 只收 sneakAttack \|\| asleep \|\| paralyzed），也不置 backstab 消息位。` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:62`  | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:110` | `const autoHit = opts?.lungeAttack === true \|\| defender.hasStatus('paralyzed') \|\| defender.hasStatus('stuck')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/Combat.ts:101` previewHitChance | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:240` | `const defenderStuck = !inanimateDefender && defender.hasStatus('paralyzed');` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/Combat.ts:173` resolveAttack | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:248` | `// Backstab: sleeping, paralyzed, or unaware targets take triple damage` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:173` resolveAttack | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:254` | `// attackHit() has its own short circuit, even for an inanimate paralyzed` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:173` resolveAttack | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:256` | `const autoHit = backstab \|\| lungeAttack \|\| defender.hasStatus('paralyzed') \|\| defender.hasStatus('stuck')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/Combat.ts:173` resolveAttack | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:341` | `// paralyzed \|\| lungeAttack）命中时只乘【一次】倍率：玩家装备匕首` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:173` resolveAttack | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:343` | `// paralyzed 两支触发 ×3（基线已存在），本轮补上 sneakAttack(WANDERING)` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:173` resolveAttack | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:346` | `// 只收 sneakAttack \|\| asleep \|\| paralyzed，不含 lungeAttack），突进只` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:173` resolveAttack | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:444` | `stealFromPlayer(attacker, defender, () => defender.hasStatus('stuck') \|\| defender.hasStatus('paralyzed')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/Combat.ts:173` resolveAttack | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:452` | `: defenderStuck ? 'paralyzed' : defenderAsleep ? 'asleep' : sneakAttack ? 'sneak'` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Combat/Combat.ts:173` resolveAttack | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:529` | `const defenderStuck = !inanimateDefender && defender.hasStatus('paralyzed');` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/Combat.ts:465` resolveAttackExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:537` | `// Backstab: sleeping, paralyzed, or unaware targets take triple damage` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:465` resolveAttackExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:543` | `// attackHit() has its own short circuit, even for an inanimate paralyzed` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:465` resolveAttackExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:545` | `const autoHit = backstab \|\| lungeAttack \|\| defender.hasStatus('paralyzed') \|\| defender.hasStatus('stuck')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/Combat.ts:465` resolveAttackExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:637` | `// paralyzed \|\| lungeAttack）命中时只乘【一次】倍率：玩家装备匕首` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:465` resolveAttackExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:639` | `// paralyzed 两支触发 ×3（基线已存在），本轮补上 sneakAttack(WANDERING)` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:465` resolveAttackExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:642` | `// 只收 sneakAttack \|\| asleep \|\| paralyzed，不含 lungeAttack），突进只` | 保留 CE/旧路径注释（无机械读取） | `src/engine/Combat/Combat.ts:465` resolveAttackExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:743` | `stealFromPlayer(attacker, defender, () => defender.hasStatus('stuck') \|\| defender.hasStatus('paralyzed')` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/Combat.ts:465` resolveAttackExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:751` | `: defenderStuck ? 'paralyzed' : defenderAsleep ? 'asleep' : sneakAttack ? 'sneak'` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Combat/Combat.ts:465` resolveAttackExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:861` | `const autoHit = defender.hasStatus('paralyzed') \|\| defender.hasStatus('stuck') \|\| defender.isCaged;` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/Combat.ts:852` resolveThrownWeaponClassic | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Combat/Combat.ts:921` | `const autoHit = defender.hasStatus('paralyzed') \|\| defender.hasStatus('stuck') \|\| defender.isCaged;` | 失能/无助/中断：改 isIncapacitated | `src/engine/Combat/Combat.ts:912` resolveThrownWeaponExtended | u_13_combat_math、slaying_melee_autohit、ext_slumber_runtime |
| `src/engine/Status/statusConfig.ts:21` | `paralyzed: { id: 'paralyzed', label: '麻痹', color: '#fca5a5', isDebuff: true },` | 保留 paralysis 专属施加/解除/数据 | `src/engine/Status/statusConfig.ts:23`  | ext_slumber_runtime |
| `src/engine/Movement/CompositeMovement.ts:118` | `if (options.forced \|\| !(actor.spatial!.actionLockInTicks \|\| actor.hasStatus('stuck') \|\| actor.hasStatus('paralyzed') \|\| bodyStatusDisables(actor,'movement'))) {` | 失能/无助/中断：改 isIncapacitated | `src/engine/Movement/CompositeMovement.ts:116` candidates | phase4a2_body_combat、phase4d_body_status |
| `src/engine/Movement/CompositeMovement.ts:158` | `\|\| core.spatial!.actionLockInTicks \|\| core.hasStatus('stuck') \|\| core.hasStatus('paralyzed') \|\| bodyStatusDisables(core,'movement'))) return blocked('immobile');` | 失能/无助/中断：改 isIncapacitated | `src/engine/Movement/CompositeMovement.ts:149` planStep | phase4a2_body_combat、phase4d_body_status |
| `src/engine/Movement/SpatialSchema.ts:108` | `const ids = new Set('paralyzed invisible telepathy levitating hallucinating confused regenerating haste poisoned slowed hasted weakened flying immune_fire discordant shielded entranced nauseous darkness magical_fear stuck donning enraged lifespan_remaining aggravating burning explosion_immunity'.split(' '));` | 登记：合法状态枚举增加 slumber，保留 paralyzed | `src/engine/Movement/SpatialSchema.ts:107` validateNativeBodyStatusRows | u_01_instance_snapshot、u_03_whole_run_snapshot、phase4d_body_status |
| `src/engine/Movement/LevelTravel.ts:89` | `\|\| (flags&T_OBSTRUCTS_PASSABILITY) \|\| m.hasStatus('entranced') \|\| m.hasStatus('paralyzed')) continue;` | 失能/无助/中断：改 isIncapacitated | `src/engine/Movement/LevelTravel.ts:58` scheduleLevelFollowers | u_03b_level_travel、ext_departure_runtime |
| `src/entities/Monster.ts:1296` | `\|\| this.hasStatus('paralyzed') \|\| this.isCaged \|\| (!dx && !dy)) return;` | 失能/无助/中断：改 isIncapacitated | `src/entities/Monster.ts:1298` moveEntrancedWithinAction | ext_slumber_runtime、ext_departure_runtime、phase3a0_scheduler |
| `src/entities/Monster.ts:1751` | `if (this.hasStatus('paralyzed') \|\| this.hasStatus('entranced') \|\| bodyStatusDisables(this,'decision')) {` | 失能/无助/中断：改 isIncapacitated | `src/entities/Monster.ts:1744` prepareNativeDecision | ext_slumber_runtime、ext_departure_runtime、phase3a0_scheduler |
| `src/entities/Player.ts:186` | `if (!this.hasStatus('paralyzed')) {` | 保留 CE paralysis 饥饿/回合统计专属 | `src/entities/Player.ts:183` tickNutrition | u_15f_food、u_14a_status_gaps |
| `src/entities/Creature.ts:14` | `export type StatusId = 'paralyzed' \| 'invisible' \| 'telepathy' \| 'levitating' \| 'hallucinating' \| 'confused' \| 'regenerating' \| 'haste' \| 'poisoned' \| 'slowed' \| 'hasted' \| 'weakened' \| 'flying' \| 'immune_fire' \| 'discordant' \| 'shielded' \| 'entranced' \| 'nauseous' \| 'darkness' \| 'magical_fear' \| 'stuck' \| 'donning' \| 'enraged' \| 'lifespan_remaining' \| 'aggravating';` | 登记：StatusId 增加 slumber，保留 paralyzed | `src/entities/Creature.ts:15` StatusId | ext_slumber_runtime、u_01_instance_snapshot |
| `src/ext/modules/growth/view.ts:320` | `if (!cell \|\| game.player.hasStatus('confused') \|\| game.player.hasStatus('paralyzed')) return false;` | 失能/无助/中断：改 isIncapacitated | `src/ext/modules/growth/view.ts:319` knownGrowthMoveCandidate | ext_module_composition、ext_edible_combinations（engine；UI未验证） |
| `src/ext/modules/growth/view.ts:345` | `&& !game.player.hasStatus('confused') && !game.player.hasStatus('paralyzed')` | 失能/无助/中断：改 isIncapacitated | `src/ext/modules/growth/view.ts:334` readGrowthSkillTargets | ext_module_composition、ext_edible_combinations（engine；UI未验证） |

另有 declarative `body-status-profile.json` 增加 slumber，沿 paralysis 的 group/control/max 规则；不是新的原生麻痹气体/解除规则。新增 trusted ActorDeparture 的失能判断使用相同谓词（见 §3.8），不属于基线 paralyzed inventory。没有修改原生 paralyzed label、免疫气体或消除路径去清 slumber。
