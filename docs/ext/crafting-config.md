# 合成与资源采集配置手册

适用：阶段 5B 的 `crafting` 内容模块，foundation **7**、冻结 **worldSdk 1**、C5-1 **1.0.0**；module/rules **1.0.0**，pack/state **schema 1**，四种命令 **payload v1**。本文说明已实现的配置入口，不把预留的 SDK 类型视为本模块已经开放的功能。

机械数据入口是 `src/ext/modules/crafting/data/definitions.json`，文本入口是同目录的 `locales/zh_CN.json`。生产数据以[5B 任务书 §5](phase5b.dot-package.md#5-数据包与完整数值已批准逐字照抄)为准。本文示例仅用于作者学习与校验，不自动加入正式包，不修改本轮批准的数值、名称、ID 或版本。

## 1 通用约定、安装与职责

### 1.1 加载路径

`descriptor.ts` 自动被 catalog 发现；新局默认不勾选 `crafting`。开局只启用 crafting 即可使用完整采集与制作规则，无须启用 growth、narrative、combat、giants 或 settlement。一局中模块集合固定。

生产加载链：

1. `loadCraftingPack()` 深拷贝机械 JSON，调用 `assertCraftingPack(pack)`
2. `getCraftingPackIdentity(pack)` 生成整包规则指纹
3. `createCraftingModuleFromPack(pack)` 再校验并隔离配置副本
4. `toWorldDefinitionPack(pack)` 产出 SDK 定义包，固定顺序为 `items:[...materials,...tools]`，其余数组保持原序，`limits` 不传给 SDK
5. foundation 校验 owner、locale、定义包、descriptor 和世界能力声明，并冻结已注册的定义

只在模块自有目录增加定义、翻译及测试。无须修改共享 catalog、共享测试清单或其他模块。新增模块自有测试须在 `crafting/test-suites.json` 登记；发现器会拒绝遗漏或失效路径。

### 1.2 所有字段都显式填写

本文各对象的字段均必填，没有隐式默认。`null`、空数组和缺字段不是同一含义。不得增加 `unitWeight`、脚本函数、随机数量、actorId、调度器、事件回调或任意扩展键。

- 所有数值字段都是有限安全整数，不接受字符串数字、浮点、NaN、Infinity 或超出 `Number.MAX_SAFE_INTEGER` 的值
- 定义 ID、标签使用 `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$`，长度 1…128；定义 ID 必须以 `crafting.` 开头
- 物品、节点、工位、配方共用同一个定义 ID 空间，跨种类重复也拒绝
- `tags` 与 `stationTags` 至多 16 项，按码点升序且不重复；不要用本地化排序。非空工位标签必须完整存在于一个候选工位上
- 文本键必须以 `ext.crafting.` 开头且在 `zh_CN.json` 存在；所有 locale 键也必须属于此前缀
- 字形是一个 Unicode 码点，禁止控制、格式控制及孤立代理字符；颜色是 `#RRGGBB`，允许十六进制大小写，正式数据使用大写
- 禁止 getter/setter、循环引用、特殊对象原型、未配对的 UTF-16 代理码、稀疏数组、数组附加属性、symbol、不可枚举内容字段，以及 `__proto__` / `prototype` / `constructor` 键；验证不会调用 getter
- 对象字段书写顺序不影响指纹；任何数组顺序都会影响指纹

### 1.3 与 foundation 的分工

| 内容 | 所有者与行为 |
| --- | --- |
| 定义、中文文本、模块面板、只读投影 | crafting |
| 节点随机落位、skip/defer 收据、再生物化 | foundation；crafting 不调用生成接口，也不抽取原生 RNG |
| 节点/工位的地图字形、悬停、详情 | foundation；crafting 不自行绘制地图格 |
| 资格、距离、交互线、威胁、CAS、预算、背包槽位 | foundation；模块只做 payload 与自有静态规则检查 |
| 计时、首批执行、多批 `auto_work`、`auto_step` | foundation；模块不推进时间，也不自行发送 `auto_step` |
| 材料 escrow、产物、退款、工具耐久、工具损坏确认 | foundation；确认对话使用既有 DialogService |
| 原生匕首与皮甲装配 | foundation；普通 +0、已鉴定、无诅咒/符文，沿原生堆叠规则 |
| 事实历史与计数 | crafting 参与者，只在提交事实后写自有 state |
| 保存、严格加载、录制、回放、seek | foundation；模块贡献自己的规则身份与状态 |

没有食物制作、菌类、随机品质、附魔、生产 XP、居民订单、离线生产、箱创建、床/箱套件使用、拆台返还或移动工位。火炉可以放置并公开 `station.hearth` 标签，但正式包没有火炉配方。

## 2 根结构与公共字段

| 根字段 | 类型、范围与含义 |
| --- | --- |
| `schema` | 整数，恰为 `1` |
| `moduleId` | 字符串，恰为 `"crafting"` |
| `moduleVersion` / `rulesVersion` | 字符串，各恰为 `"1.0.0"`；不能只改 JSON 而不更新对应代码协议 |
| `materials` | 物品定义数组，0…128；只允许 material / kit / native，正式 11 行 |
| `tools` | 物品定义数组，0…128；只允许 tool，正式 1 行 |
| `resourceNodes` | 节点定义数组，0…128 且不超过 `limits.nodeDefinitions`；正式 5 行 |
| `stations` | 工位定义数组，0…128；正式 2 行；与 materials、tools 的总长度不超过 `limits.itemAndStationDefinitions` |
| `recipes` | 配方定义数组，0…128 且不超过 `limits.recipes`；正式 7 行 |
| `startupItems` | 恰一个启动礼包对象，不能为 null，见 §6 |
| `limits` | 恰 12 个键，均为正安全整数，见 §7 |

四类定义共同字段：`owner:"crafting"`、唯一 `id`、`nameKey`、`descriptionKey`。物品、节点与工位还必须有 `glyph` 和 `color`；配方没有外观字段。

默认文本键格式：

- 物品：`ext.crafting.item.<短ID>.name` / `.description`
- 节点：`ext.crafting.node.<短ID>.name` / `.description`
- 工位：`ext.crafting.station.<短ID>.name` / `.description`
- 配方：`ext.crafting.recipe.<短ID>.name` / `.description`

每个 `ItemAmount` 严格为 `{ "itemDefinitionId": "crafting.…", "count": N }`。列表长 1…8，`count` 为 1…99，同一列表内 ID 不重复，全部引用本包物品。列表不自动排序、聚合或补缺项。

## 3 物品与工具

每个物品定义除公共字段外，必填以下五项：

| 字段 | 类型、范围与含义 |
| --- | --- |
| `category` | `"material"` / `"kit"` / `"native"` / `"tool"`；必须放入对应根数组 |
| `maxStack` | 整数 1…`limits.stack`，上界最多 99；tool 与本包 native 必须为 1 |
| `nativeTemplate` | material/kit/tool 必须 null；native 只能 `"dagger"` 或 `"leather_armor"` |
| `tags` | 0…16 个有效标签，去重、码点升序；可用于工具匹配 |
| `tool` | tool 类必须为完整工具对象；其他类别必须 null |

上表中的 `glyph`、`color` 已在公共字段中说明。工具对象恰含：

| 工具字段 | 类型、范围与含义 |
| --- | --- |
| `tag` | 有效标签字符串，必须同时存在于该行 `tags` 中 |
| `maxDurability` | 整数 1…1000000；创建时耐久上限 |
| `durabilityPerBatch` | 整数 1…maxDurability；每个成功工作批次扣除的耐久 |

正式矿镐为 `crafting.pick`，`basic.pick`、耐久 40、每次成功采金属扣 1。耐久 0 保留物品，但不能满足工具要求；会耗尽耐久的一次工作触发 foundation 的 `tool-break` 确认。拒绝确认录制但零成本。失败/中断的批次不产出、不扣耐久。

材料、工具、套件可拾取和丢弃，不可装备、投掷或使用。床/箱套件只作为可保存、可搬运、最多 99 堆叠的物品；5B 没有床/箱放置入口。

native 定义的外观只用于定义校验与指纹，产物沿原生物品外观：

- 匕首：`)`、`#CCCCCC`，`src/engine/Items/ItemLoader.ts:1317` 的 WEAPON 构造常量
- 皮甲：`]`、`#888888`，同文件 `:1389` 的 ARMOR 构造常量
- `src/engine/UI/Appearance.ts:483–484` 使用 `item.char` / `item.color`

`crafting_schema.test.ts` 直接读取这两个构造常量及实际显示路径断言一致，不创建随机物品。native 的 `maxStack:1` 不改原生合并规则；每批配方单条输出数量也不能超过对应物品的 maxStack。

## 4 资源节点

| 节点字段 | 类型、范围与含义 |
| --- | --- |
| 公共字段 | `owner,id,nameKey,descriptionKey,glyph,color`，全部必填 |
| `kind` | `"wood"` / `"stone"` / `"ore"` / `"fiber"`；不接受 SDK 中预留的 fungus |
| `yield` | 1…8 个 ItemAmount，全部引用 material；一份采集完成时给出的物品 |
| `capacity` | 整数 1…9999；节点资源单位容量 |
| `harvestTicks` | 整数 1…10000；正式五行均为 100 |
| `unitsPerHarvest` | 整数 1…99，且不超过 capacity；一次采集占用/消耗的资源单位，正式为 1 |
| `requiredToolTag` | null 或本包某工具对象的 tag；正式只有矿脉要求 basic.pick |
| `regeneration` | 严格二选一，见下文 |
| `placement` | 恰含 dungeon 与 site，两字段都必须写；site 必须 null |

`regeneration`：

- 无再生：恰 `{ "kind":"none" }`
- 周期再生：恰 `{ "kind":"periodic", "units":1…99, "intervalTicks":1…1000000 }`

再生归 foundation 按真实 elapsed tick 物化，离层返回也结算。满容量时不积累余数；只读查询不推进节点 revision，也不自行预测再生后库存。正式木材每 2000 tick 回 1，纤维每 1000 tick 回 1，石/金属/皮革不再生。

`placement.dungeon` 为 null 或恰含以下字段的对象：

| 放置字段 | 类型、范围与含义 |
| --- | --- |
| `minDepth` | 整数 1…40，最浅 dungeon 深度 |
| `maxDepth` | 整数 minDepth…40，最深深度，闭区间 |
| `maxPerDepth` | 整数 1…32，该定义每层数量上限 |
| `maxPerRun` | 整数 1…512，该定义整局数量上限 |
| `onNoSpace` | `"skip"` 或 `"defer"`；无合法空间时跳过或由 foundation 延后重试 |

每个深度所有适用定义的 maxPerDepth 之和不得超过 `limits.nodesPerLevel`；所有定义 maxPerRun 之和不得超过 `limits.nodesPerRun`。dungeon 为 null 的行不自动落位，5B 没有模块自建节点的替代入口。site 配置尚未开放。

正式配置摘要（顺序有意义）：

| 节点 | kind / 产物 | 容量 | 深度 | 每层 / 整局 | 无空间 |
| --- | --- | ---: | --- | --- | --- |
| wood-node | wood / wood×1 | 20 | 1…40 | 2 / 32 | defer |
| stone-node | stone / stone×1 | 20 | 1…40 | 2 / 32 | skip |
| fiber-node | fiber / fiber×1 | 20 | 1…40 | 2 / 32 | skip |
| metal-node | ore / metal×1 | 20 | 2…40 | 1 / 24 | skip |
| hide-cache | fiber / leather×1 | 12 | 1…20 | 1 / 24 | skip |

配置每层合计 8、整局合计 144；D1 实际适用上限为 7。hide-cache 的 fiber 是有限行为分类，名称为“皮革存料”，不会引入尸体或怪物掉落逻辑。

## 5 工位与配方

### 5.1 工位

| 工位字段 | 类型、范围与含义 |
| --- | --- |
| 公共字段 | `owner,id,nameKey,descriptionKey,glyph,color` |
| `interactionDistance` | 整数 0…16；正式桌/炉均为 1 |
| `stationTags` | 1…16 个有效标签；码点升序且不重复，不能空 |
| `placementCost` | 1…8 个 ItemAmount；只允许 material，不允许 kit/tool/native |
| `placementTicks` | 整数 1…10000；正式桌/炉均为 300 |
| `workPositionPolicy` | 恰为 `"adjacent-passable"` |
| `kitDefinitionId` | 本包 category=kit 的物品 ID；5B 配置必须存在，不接受 null |

放置工作桌：木4、石2，或工作桌套件1。放置火炉：石6、木2，或火炉套件1。背包有套件时优先扣 1 个套件，否则扣材料；不会叠加扣除，也不再弹来源选择确认。UI 的来源显示只是预告，实际决定由 foundation 作出。

工位可制作资格根据 `StationRead.workPositions`，不能用简单邻接距离代替。只满足距离但不属于工作位置仍不可制作。工位不要求房间/屋顶；火炉不会生成火、烟或氧气模拟。

### 5.2 配方

| 配方字段 | 类型、范围与含义 |
| --- | --- |
| 公共字段 | `owner,id,nameKey,descriptionKey`；不接受 glyph/color |
| `inputs` | 1…8 个 ItemAmount，只引用 material 或 kit |
| `outputs` | 1…8 个 ItemAmount，可引用本包任意类别；每行 count 不得超过对应 maxStack |
| `stationTags` | 0…16 项；空表示徒手；非空必须是本包某一个工位 stationTags 的子集 |
| `toolTag` | null 或本包工具 tag；正式七条均为 null |
| `workTicks` | 整数 100…10000；正式包单批最多 1500，不补偿原生回血规则 |
| `offlineEligible` | boolean，数据预留标记；5B 不读取它来开启订单或离线生产 |

批数由玩家命令传入 1…`limits.batchMax`，不是配方字段。徒手配方 stationId/stationRevision 必须成对为 null；工位配方自动选取可达且完整覆盖标签的最小 interactableId。多个工位各有部分标签不能拼成一套资格。

采集/单批制作/放置在接单命令内完成或中断；多批接单命令执行第 1 批，之后每个原生 `auto_step` 执行 1 批。命令结束时玩家 bundle 不存活，批间 activeTicket 可继续或取消。未开始批次的 escrow 只退款一次，已完成产物保留；不要在 UI 或模块中复制这套规则。

## 6 启动礼包

`startupItems` 必须恰含三字段：

| 字段 | 类型、范围与含义 |
| --- | --- |
| `instanceKey` | 字符串，恰为 `"crafting.startup"` |
| `items` | 1…8 项 ItemAmount；引用本包物品，每行 count 为 1…99，不重复 |
| `overflow` | 恰为 `"floor-then-skip"` |

正式礼包按顺序为木材6、石料4、植物纤维2。由 foundation 在新局 D1 首次落位时发一次：先尝试背包，再落地，仍无法容纳的部分跳过；保存收据区分 granted/partial/skipped。加载与回放不能再次发放。crafting 不在 initialState、投影或 UI 中补发物品。

## 7 limits、事实历史与预算

所有 limits 键必填，取值为 **1…下表上限**；允许收紧静态预算，但不能放松。startupReceipts 上界为 1，故只能等于 1。正式数据逐项使用上限值。

| 键 | 最大值 | 检查/用途 |
| --- | ---: | --- |
| `recipes` | 128 | recipes.length |
| `itemAndStationDefinitions` | 128 | materials.length + tools.length + stations.length |
| `nodeDefinitions` | 128 | resourceNodes.length |
| `nodesPerLevel` | 32 | 深度 1…40 逐层检查适用节点的 maxPerDepth 总和 |
| `nodesPerRun` | 512 | 所有节点 maxPerRun 总和 |
| `stationsPerLevel` | 16 | place-station prepare 检查当前层 crafting 工位数量 |
| `stationsPerRun` | 128 | 对应 foundation 全 owner 共享工位预算；正式运行固定由底座 128 预算接纳，不由模块单独计数 |
| `startupReceipts` | 1 | 恰一份 startupItems，去重收据归 foundation |
| `placementReceipts` | 512 | 模块 state.placements 的滚动历史上限 |
| `workHistory` | 128 | 模块 state.history 的滚动历史上限 |
| `batchMax` | 16 | craft payload 批数上限 |
| `stack` | 99 | 物品 maxStack 上界；tool/native 仍必须为 1 |

收紧运行期相关值不改变 foundation 自己的固定共享预算，尤其 `stationsPerRun` 不创建新的模块私有计数器。达到全 owner 共享工位数 128 时，foundation 返回 C5_BUDGET。

作者不能手填运行中的物品、节点、票据或历史。crafting 自有 state 只包含 schema、lastFactId、五项 totals、placements 和 history。accepted 事实只推进 lastFactId，不计产出；完成/中断/取消/礼包事实由参与者归档，事实 ID 允许跳号并去重。历史满时丢最旧记录，计数在 MAX_SAFE_INTEGER 饱和。活跃票据与终结摘要归 foundation，不要把模块历史当作可执行工作队列。

## 8 版本、指纹与旧档

当前身份为：

- module `crafting` / version `1.0.0`
- rules `{schema:1, version:"1.0.0", fingerprint:extensionDataFingerprint(pack)}`
- 正式包指纹：`sha256:fc1b8d11b7faf918331cf58895f135e11e67d397b5c88d1a08c5b2b679597fe1`
- state schema 1、四个 payload v1、descriptor worldSdk 1

指纹覆盖校验后的整个 `definitions.json`，包括版本字段、limits、glyph/color、文本键字符串、所有机械数值、数组内容与顺序。改 JSON 空白或对象键顺序不改指纹；修改 locale 中的中文文本不改指纹；修改机械包中指向该文本的 nameKey/descriptionKey 会改指纹。即使没有提高 version，内容变更仍由指纹识别。

foundation 另将每个 owner 的 SDK 定义包 canonical SHA-256 存入 `world5.definitionsFingerprint`。这是额外校验；由于 limits 不进入 SDK 包，不能用该指纹替代 crafting 整包身份。

保存与录像要求精确 manifest。缺模块、错 module/rules 版本、错规则指纹或 SDK 定义指纹会被拒绝，不迁移旧档，不删除模块状态后强行加载，也不承诺用新规则回放旧录像。若未来批准升版本，需要一起更新 JSON、代码版本常量、校验与测试，不能只改一个字符串。

## 8.1 SDK1 集成后的只读界面（foundation 9）

模块栏使用 `crafting.open`；底座继续接受既有 `owner:action` 格式，两种格式都保留所有权、重复 ID 与会话退休检查。

`readModuleView('crafting', { sourceContainerId: null | 箱ID })` 只提交显示查询。省略查询等于背包来源；输入经过安全整数 JSON 校验、复制与冻结，不进入模块状态、存档、录像或随机流。返回 DTO 增加 `lastError`、`sourceContainerId`、`sourceRevision` 和 `containers`。箱清单只包含当前层已有记忆的箱（全局上限 112），携带坐标、revision、capacity、occupiedSlots、reservedSlots、inReach；`inReach` 由底座的距离及真实交互线判定。UI 可分别选择采集目标箱和制作材料来源箱；制作产物仍放入背包。未知箱查询视为不可用，远处已知箱可见但不可选。

配方的输入拥有量、maxBatch 与 reason 属于**当前所选来源**，不能把背包预览用于另一只箱。每次投影只预览一个来源，至多 `recipes.length × batchMax` 次 `previewRecipe`，正式包仍为 7×16=112；读库存 1 次、每个附近自有节点至多再读 1 次，无额外 `queryContainers`/`queryStations`。切换来源重读投影，不按箱数乘预算。放置工位仍只扣背包套件/材料。

`WorldWorkReadSDK.lastCommandError?()` 与 `ContainerRead.inReach?` 是 SDK1 的可选兼容扩展，旧调用方式仍成立。最后工作错误是会话诊断，不保存；自身提交及确认完成后 UI 按有限错误码选 i18n 键，运行时替换时清空，不显示原始 code/field。正在推进/等待确认的命令边界仍不可重入；空闲边界上有玩家 combat bundle 时，已注册世界工作命令录制零成本 `C5_BUSY`，普通玩家输入仍被锁定。

窄屏（≤700px）面板是至多 320px/36dvh 的底部抽屉，顶部可收起至 52px；内部滚动，地图使用剩余视口。桌面沿用 370px 侧面板。像素验收结果及 SDK 文件新 SHA 见 [集成报告](phase5b-integration.report.md)。

## 9 三个完整配置追加例子

以下每个 JSON 块均为**独立应用于正式包的追加清单**，不是可直接作为根包载入的对象。`append` 的数组行按原顺序追加到同名根数组；`locale` 键合入 `locales/zh_CN.json`；其余正式字段和 startupItems/limits 保持原值。每个例子都包含新增定义的全部必填字段与全部翻译，没有省略号。

这些示例不自动进入生产配置。采用时须获得对应规则/数值变更批准，并更新黄金表与回放验证。真正安装前，先把 locale 合入模块资源；仅向 `assertCraftingPack(pack, mergedLocale)` 传入临时翻译不等于 descriptor 已注册这些键。

`tests/crafting_config_examples.test.ts` 从本文直接读取三个 JSON 块，应用到正式包副本后运行 crafting 与 foundation 的真实静态校验器，检查每个例子的规则指纹变化；测试不维护另一份手抄示例。

### 9.1 新增一种材料与节点

增加黏土材料及 D2…D10 的黏土堆。kind 使用已有 stone 行为分类；不会引入新的地形或特殊采掘规则。本例每层配置上限增至 9、整局声明增至 160，仍在预算内。

<!-- crafting-config-example: material-node -->
```json
{
  "append": {
    "materials": [
      {
        "owner": "crafting", "id": "crafting.example-clay",
        "nameKey": "ext.crafting.item.example-clay.name",
        "descriptionKey": "ext.crafting.item.example-clay.description",
        "category": "material", "glyph": "%", "color": "#AD8260", "maxStack": 99,
        "nativeTemplate": null, "tags": ["basic.clay"], "tool": null
      }
    ],
    "resourceNodes": [
      {
        "owner": "crafting", "id": "crafting.example-clay-node",
        "nameKey": "ext.crafting.node.example-clay-node.name",
        "descriptionKey": "ext.crafting.node.example-clay-node.description",
        "glyph": "泥", "color": "#AD8260", "kind": "stone",
        "yield": [{"itemDefinitionId": "crafting.example-clay", "count": 1}],
        "capacity": 12, "harvestTicks": 100, "unitsPerHarvest": 1, "requiredToolTag": null,
        "regeneration": {"kind": "none"},
        "placement": {
          "dungeon": {"minDepth": 2, "maxDepth": 10, "maxPerDepth": 1, "maxPerRun": 16, "onNoSpace": "skip"},
          "site": null
        }
      }
    ]
  },
  "locale": {
    "ext.crafting.item.example-clay.name": "黏土",
    "ext.crafting.item.example-clay.description": "可用于后续制作的湿润黏土。",
    "ext.crafting.node.example-clay-node.name": "黏土堆",
    "ext.crafting.node.example-clay-node.description": "一堆可徒手采集、采完不再生的黏土。"
  }
}
```

只增加材料/节点不会自动增加配方。后续配方可引用 `crafting.example-clay`；先确认使用它的配方与同一份 pack 一起安装。

### 9.2 新增一个桌上配方

增加不同配比的床铺套件配方，使用已有原料与产物；工位标签沿用 station.table。其 offlineEligible 仍只是一项数据，不启动离线生产。

<!-- crafting-config-example: table-recipe -->
```json
{
  "append": {
    "recipes": [
      {
        "owner": "crafting", "id": "crafting.example-weave-bed-kit",
        "nameKey": "ext.crafting.recipe.example-weave-bed-kit.name",
        "descriptionKey": "ext.crafting.recipe.example-weave-bed-kit.description",
        "inputs": [{"itemDefinitionId": "crafting.wood", "count": 2}, {"itemDefinitionId": "crafting.fiber", "count": 4}],
        "outputs": [{"itemDefinitionId": "crafting.kit-bed", "count": 1}],
        "stationTags": ["station.table"], "toolTag": null, "workTicks": 500, "offlineEligible": true
      }
    ]
  },
  "locale": {
    "ext.crafting.recipe.example-weave-bed-kit.name": "编制床铺套件",
    "ext.crafting.recipe.example-weave-bed-kit.description": "在工作桌上用木料和较多纤维编制一套床铺套件。"
  }
}
```

### 9.3 新增一种工位及其可制作套件

增加工匠台、套件与徒手套件配方；最后一条配方展示如何让新工位真正提供独立标签资格。工位与套件都使用既有物品机制，不赋予 kit 使用动作。放置仍从“工作台”页签发 place-station，由 foundation 自动选择套件或材料。

<!-- crafting-config-example: station-kit -->
```json
{
  "append": {
    "materials": [
      {
        "owner": "crafting", "id": "crafting.example-kit-bench",
        "nameKey": "ext.crafting.item.example-kit-bench.name",
        "descriptionKey": "ext.crafting.item.example-kit-bench.description",
        "category": "kit", "glyph": "▣", "color": "#A8B2C0", "maxStack": 99,
        "nativeTemplate": null, "tags": ["kit.station.bench"], "tool": null
      }
    ],
    "stations": [
      {
        "owner": "crafting", "id": "crafting.example-bench",
        "nameKey": "ext.crafting.station.example-bench.name",
        "descriptionKey": "ext.crafting.station.example-bench.description",
        "glyph": "台", "color": "#B08D57", "interactionDistance": 1,
        "stationTags": ["station.bench"],
        "placementCost": [{"itemDefinitionId": "crafting.wood", "count": 4}, {"itemDefinitionId": "crafting.stone", "count": 2}],
        "placementTicks": 300, "workPositionPolicy": "adjacent-passable", "kitDefinitionId": "crafting.example-kit-bench"
      }
    ],
    "recipes": [
      {
        "owner": "crafting", "id": "crafting.example-make-bench-kit",
        "nameKey": "ext.crafting.recipe.example-make-bench-kit.name",
        "descriptionKey": "ext.crafting.recipe.example-make-bench-kit.description",
        "inputs": [{"itemDefinitionId": "crafting.wood", "count": 4}, {"itemDefinitionId": "crafting.stone", "count": 2}],
        "outputs": [{"itemDefinitionId": "crafting.example-kit-bench", "count": 1}],
        "stationTags": [], "toolTag": null, "workTicks": 500, "offlineEligible": false
      },
      {
        "owner": "crafting", "id": "crafting.example-bench-bed-kit",
        "nameKey": "ext.crafting.recipe.example-bench-bed-kit.name",
        "descriptionKey": "ext.crafting.recipe.example-bench-bed-kit.description",
        "inputs": [{"itemDefinitionId": "crafting.wood", "count": 4}, {"itemDefinitionId": "crafting.fiber", "count": 2}],
        "outputs": [{"itemDefinitionId": "crafting.kit-bed", "count": 1}],
        "stationTags": ["station.bench"], "toolTag": null, "workTicks": 500, "offlineEligible": true
      }
    ]
  },
  "locale": {
    "ext.crafting.item.example-kit-bench.name": "工匠台套件",
    "ext.crafting.item.example-kit-bench.description": "可以就地组装为工匠台的便携套件。",
    "ext.crafting.station.example-bench.name": "工匠台",
    "ext.crafting.station.example-bench.description": "带有独立工位标签的简易制作台。",
    "ext.crafting.recipe.example-make-bench-kit.name": "制作工匠台套件",
    "ext.crafting.recipe.example-make-bench-kit.description": "徒手将木材和石料准备为工匠台套件。",
    "ext.crafting.recipe.example-bench-bed-kit.name": "在工匠台制作床铺套件",
    "ext.crafting.recipe.example-bench-bed-kit.description": "使用工匠台将木材和纤维制成一套床铺套件。"
  }
}
```

## 10 作者自检清单

- [ ] 新规则已获批准；没有擅改正式 5B 的数据、ID、名称、顺序或版本
- [ ] 每个对象字段齐全、无多余键，无非 JSON 内容；所有数值是合法安全整数
- [ ] 全包定义 ID 唯一且前缀正确；所有引用、工具标签、套件类别与工位标签可满足
- [ ] 每个机械 nameKey/descriptionKey 已加入模块中文 locale；没有越权 locale 键
- [ ] tags/stationTags 严格码点升序去重；工位标签非空
- [ ] 每个 ItemAmount 列表非空且不重复；输入只用 material/kit，节点与放置成本只用 material
- [ ] native 仅匕首/皮甲、maxStack=1；没有食物或菌类内容
- [ ] 每个深度与整局节点预算、定义总数、配方数、堆叠上限全部通过
- [ ] 工位 kit 与原材料不双扣；新增工位若需制作入口，已提供可达的套件/材料路径
- [ ] 已了解整包指纹变化会拒绝旧档/录像；未修改旧基线来掩盖错误
- [ ] 测试从真实定义/文档读取数据，不用复制的测试对象冒充生产内容；新增测试已登记
- [ ] 先跑 boundary、vue-tsc、crafting 定向测试；本轮对应里程碑要求 build 时追加 build
- [ ] 涉及运行规则时用真实 Game 验证新局、命令、拒绝、save/load、replay/seek，不 mock foundation
- [ ] 最终收尾按任务书 §9.2 运行 test:ext、test:drift、组合与两行物理删除、浏览器视口；只如实报告实际运行项

开发命令（仓库根；Node 24.19.0；不要把推送与门禁串联）：

```sh
NODE_OPTIONS=--max-old-space-size=3072 node scripts/check-module-boundaries.mjs
NODE_OPTIONS=--max-old-space-size=3072 npx vue-tsc -b
NODE_OPTIONS=--max-old-space-size=3072 npx vitest run src/ext/modules/crafting/tests --maxWorkers=2
```

完整测试范围与未覆盖项以[5B 执行报告](phase5b.report.md)为准。配置示例通过静态校验不等于完成新内容的真实运行、平衡与浏览器验收。
