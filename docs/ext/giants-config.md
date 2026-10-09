# 巨兽与通用空间能力配置手册

适用：giants2 派发基线 `e0fa39a225428d36e6e342f6585f57f45960e6ba`，foundation **11**、whole-run **6**、recording **4**、origin **2**、world **5 / schema 2**、worldSdk/edibleSdk **1**；giants module/rules **1.0.0**，pack/state/spatial **schema 1**。本文以本基线验证器和执行路径为准，设计草图中的预留类型不等于可用字段；不随并行 phase5 工作变动。

作者主要编辑 `src/ext/modules/giants/data/definitions.json`，显示文字编辑同目录 `locales/zh_CN.json`。所有正式名称、描述、命中区名称必须走 i18n。不要编辑 `monsters.json` 来增加 giants 内容，不通过模块回调直接挖图、移动生物或改 HP。

## 1 通用约定、安装与默认值

验证入口：`giants/schema.ts:isGiantsPack/assertGiantsPack` → `nativeForms.ts:validNativeForm`、`generation.ts:validGenerationContribution`、`bodyTransitions.ts:validActiveBodyTransitions`；真正安装还经过 `ExtensionRuntime` 的引用闭包、provider 及所有权检查。`SpatialCatalog` 负责形状、zone、body、profile 与 break 定义。下面所有整数均为安全整数，不能传浮点、NaN、Infinity、函数、循环对象或额外字段。

模块/形态/模板/转换 ID 使用 `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$`，giants 自有 ID 以 `giants.` 开头。底座空间 ID/part/zone 使用 `^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$`，区分大小写。坐标 `{x,y}` 是整数、各在 −32768…32767；形状坐标相对锚点，允许负值。模块不能登记 foundation 所有权的任意定义。

**必填字段没有隐式默认。** 表中“省略”只表示整个可选属性不写；JSON 的 null、空对象和伪默认均不能替代。普通单格生物没有 `spatial` 属性。原生 fixture 与正式生产校验的边界不同，作者须走正式安装入口，不能以 `SpatialCatalog(true)` 的几何通过替代正式许可。

| pack 字段 | 必填／范围／省略行为 |
| --- | --- |
| `schema` | 必填，恰为 1 |
| `moduleVersion`、`rulesVersion` | 必填，当前各恰为 `1.0.0`；升版本须同步代码常量和 descriptor，不是只改 JSON |
| `forms` | 必填，1–16 个，ID 唯一，按本章形态规则验证 |
| `templates` | 必填，1–16 个，ID 唯一，全部引用 pack 内 form |
| `bodies` | 可省略；提供时必含 `definitions`（1–16 个）及 `breakRules`（0–16 个）；另可含 `statusProfiles`、`attackProfiles`（各 0–16 个） |
| `transitions` | 可省略；提供时 1–16 个，ID 唯一；空数组也拒绝 |

注册依赖次序：固定 zone break → footprint → form；body status/attack/member break → body；最后转换和生成引用。所有引用必须已存在，跨 owner 引用受安装器约束；不能在存档中放一段新定义来授权自己。安装深拷贝并冻结声明，运行期间不能修改定义。

## 2 敌人形态：`NativeFormDefinition`

以下字段全部必填，唯形状二选一和 `breakRules` 为条件字段。

| 字段 | 合法值与用途 |
| --- | --- |
| `id` | 自有 `giants.*` ID；不得重复 |
| `nameKey`、`descriptionKey` | 字符串，前缀 `ext.giants.`；在模块 locale 登记实际中文，schema 本身不代查翻译是否存在 |
| `size` **或** `footprint` | 严格二选一：`size` 只能 2 或 3；footprint 见 §3，显式 1×1 成员也走 footprint |
| `char` | 恰一个 Unicode 码点，不是两个字符拼接 |
| `color` | 整数 0…16777215（0xFFFFFF） |
| `hp` | 1…10000，原生最大生命值；不是 encounter 共用副本 |
| `accuracy` | 0…100，原生命中基数，不代表最终命中百分比 |
| `defense` | 0…1000，原生防御 |
| `damage` | `最小值-最大值` 十进制字符串，例如 `4-9`；1≤最小≤最大≤1000 |
| `moveSpeed`、`attackSpeed` | 1…1000 **ticks**；数字越大行动越慢 |
| `bloodType`、`DFChance`、`DFType` | 当前必填且均为 0；没有自定义血迹／死亡 DF 能力 |
| `breakRules` | 只可在 footprint 形态上提供，0–16 个固定 zone 规则；size 形态提供该字段会拒绝 |

转换消息从声明的 source/result form 读取 `nameKey` 和结果数量，因此侧栏、实体名称和转换消息使用同一份形态名称。当前巨像分裂为两具**岩脊兽**，没有暗藏另一个“岩脊碎像”species。修改 locale 名称即会同步消息；机械规则仍在 pack。

创建只能使用本局已安装 form；外围成员形态不可作为独立主体生成、主动转换来源或结果。主体若是复合体核心，生成应提供 bodyId，转换则由其唯一核心 form 自动解析 body。

## 3 形状、pose 与固定命中区

底座完整 `FootprintDefinition` 必填 `id,owner,geometry,poses`，可选 `zones,zoneCells`。giants 的 `form.footprint` 只写后四项，`id` 自动等于 form.id，owner 自动为 giants。size 宏解析为 `builtin:square-2/3`、r0，不产生旋转动作。

| 字段 | 合法范围与默认 |
| --- | --- |
| `geometry.kind=rect` | 必填 `width,height`，各 1…16，乘积≤16；从 (0,0) 向右／向下占格 |
| `geometry.kind=mask` | 必填 `cells:[{x,y}]`，1–16 格、唯一、含 (0,0)、四邻接连通；两轴包围跨度各≤16 |
| `poses` | 必填；正式刚体只能一个固定 `r0/r90/r180/r270` 或完整四向集合；2/3 向、镜像均拒绝。按声明首项初始化；转换旧 pose 若新形态支持则保留，否则取首项 |
| `zones` | 可省略或空数组；最多8个，不自动把每格设为一个区 |
| `zoneCells` | 可省略或空数组；每条必须是 `{x,y,zoneId}`，属于真实 mask、同格只标一次、引用已声明 zone；每个 zone 至少有一个标签格 |

未标签格自动为保留 `body`。凹角与孔洞不占位、不阻路、不受击，不能用包围盒代替。编译按 y/x 稳定排序；r90 把 (x,y) 变为 (−y,x)，绕原点格中心旋转，不重新平移到左上角。旋转检查连续 90° 扫掠；180° 检查两段及中间 pose，耗时为两倍移动 ticks。单边 sweep≤256 格，超限直接拒绝，不裁掉旋转弧。

每个 `zones[]` 对象必填如下字段：

| 字段 | 合法范围 |
| --- | --- |
| `id` | 空间 ID，唯一，不能是 `body` |
| `nameKey` | 空间 ID 语法且以 `ext.giants.` 开头；中文走 locale |
| `health` | `{"kind":"native"}` 仅引用实体 HP；或 `{"kind":"local","maxHp":1…1000000,"ownerTransfer":{"numerator":n,"denominator":d}}` |
| `armor` | 0…1000000 |
| `damageMultiplier` | 必填有理数 `{numerator:0…1000000,denominator:1…1000000}` |
| `breakRuleId` | 已注册固定 keep-zone 规则，或 `foundation:keep-zone` |

正式 local zone 的 ownerTransfer 必须 **n=d（1:1）**，不是任意比例；native zone 不另存 HP。物理伤害先区装甲再倍率、整数取整，扣 local 正 HP 限额后传实体一次；直接 native/core 不自传。zone 破坏不删身体格，也不发普通死亡、掉落或 XP。

底座几何能表示16格的4×4，r3 §8.2明确允许；**未提供正式4×4 species/场地，也没有 `size:4` 宏**。未知4×4 form 在创建／读档拒绝；不能把通用 mask 的能力反说成4×4正式内容已交付。

## 4 复合体、成员、约束与修正

`bodies.definitions[]` 对象所有字段必填：

| 字段 | 合法范围与执行语义 |
| --- | --- |
| `id,owner` | 自有唯一空间 ID、`owner:"giants"` |
| `parts` | 1–17 个，恰一个 core；partId 唯一，实际总格≤64、声明 zone 总数≤32 |
| `constraints` | 有根树；每个非核心恰一个父边，所有节点最终到 core；不允许环、自环、断开 |
| `minSupportParts` | 0…parts.length；低于此数量禁止移动；作者应设为实际可提供支撑的数量以内 |
| `noSupport` | 正式仅 `immobile`，保留合资格攻击；collapse/die 当前只在几何 fixture 类型中预留 |
| `coreDeath` | 正式仅 `remove-members`；不开放 debris-members |
| `statusProfileId` | 已注册 profile，通常 `foundation:native` |

每个 `parts[]` 全部必填：

| 字段 | 合法范围 |
| --- | --- |
| `partId` | 唯一空间 ID；外围不能用保留 `self` |
| `role` | core / support / weapon / segment；恰一个 core |
| `providesSupport` | boolean；角色不自动决定是否提供支撑 |
| `formId` | 已登记同 owner 形态；同一 form 只能作为一个 body 的核心，不能有歧义 |
| `preferredOffset` | `{x,y}`；core 必须 (0,0)，外围为相对核心的落脚偏好，非刚性位置 |
| `attackProfileIds` | 0–4 个，唯一，引用本 owner 的 `attackProfiles`；空数组用原生即时攻击 |
| `coreTransfer` | 有理数范围同 §3；外围正式恰为 `{numerator:1,denominator:4}`；core 通常 0/1，直接核心伤不自传 |
| `breakRuleId` | core 通常 foundation:keep-zone；外围必引用 remove＋retire-subtree 规则 |
| `statusProfileId` | 已注册完整有限状态 profile |

每个 `constraints[]` 全部必填：`childPartId,parentPartId` 引用节点；`kind` 为 tether/chain；`minDistance` 0…64，`maxDistance` min…64；`maxStepPerAction` 正式1…2（基础几何验证允许至32，不授予正式行动）；`requiresClearLink` boolean。距离是父子足迹最短切比雪夫格距，连接线不占位／受击；clear link 和每段轨迹均检查墙、占位、连接与区域。

核心唯一调度。成员保留独立HP／位置／局部状态／冷却；不额外 takeTurn、playerTurnEnded 或录制玩家命令。核心每次最多4个攻击来源，独立scope/费用，耗时取最大值。移动按树和稳定part顺序规划，每成员≤32候选、每次≤128回溯节点；无解正耗时等待，不瞬移腿、不无限搜。核心路径是乐观图，完整成员方案才准提交。

### 4.1 固定区与成员 break rule

共同必填 `id,owner,trigger:"hp-zero",disposition,modifiers`；固定 zone 的 disposition 只能 keep-zone，成员只能 remove。成员还必须显式 `childrenOnBreak:"retire-subtree"`；不开放重接父边、replacementFootprintId、inert-body、debris、regenerate、locomotion。每条最多8项修正；同 kind 或同禁攻ID／暴露zone 不可重复。

| modifier | 全部字段／范围／开放处 |
| --- | --- |
| move-ticks-multiplier | `kind,numerator:1…1000000,denominator:1…1000000`；固定区与成员均可，派生倍率、向上取整；结果ticks≤1000000 |
| disable-attack | `kind,attackId`（空间ID）；两处可，针对声明ID或provider具体profile；不能禁用首项后绕到无条件 native fallback |
| expose-zone | `kind,partId:"self",zoneId,damageMultiplier`；仅固定区，必须指本形状已登记zone、不能body；暴露倍率取最大有效值 |
| balance-loss | `kind,amount:0…1000000,fallbackStunTicks:0…1000000`；两处可，可选provider与底座锁互斥 |

成员破坏释放占位、槽位保留墓碑，子树无死亡退休；核心真正死亡才终结一次。修正由唯一破坏收据派生，读档／重访不叠乘，不为每腿复制成长、携带物或资源账本。

### 4.2 status 与 attack profile

`statusProfiles[]` 全部必填 `id,owner,kind:"native",rows`。rows 必须完整且恰含 `src/data/body-status-profile.json` 的27个statusId，无重复／未知：paralyzed、invisible、telepathy、levitating、hallucinating、confused、regenerating、haste、poisoned、slowed、hasted、weakened、flying、immune_fire、discordant、shielded、entranced、nauseous、darkness、magical_fear、stuck、donning、enraged、lifespan_remaining、aggravating、burning、explosion_immunity。这里的 regenerating 是原生生命恢复状态，**不是部位再生**。

每行必填 `statusId,owner,merge,disables`；owner 为 group/entity，merge 为 max/stack/replace，disables 为不重复的 decision/attacks/movement 数组（可空）。使用group的成员行必须与核心该状态的merge一致。省略自定义表直接引用 foundation:native；默认群精神/加减速/隐身，毒火等留实体，逐客观块只计时一次。免疫和叠加仍用原生状态规则，不接受脚本 reducer。

`attackProfiles[]` 全部必填 `id,owner,providerProfileId`（空间ID）。它是底座指向可选阶段攻击provider的有限引用，不包含招式本体。未启用combat时执行native即时攻击；启用provider时所有引用必须精确解析，否则安装拒绝。正式织兽核心为 combat.shock-ring，腿为 combat.fan-edge；底座无 combat 导入。

## 5 主动转换声明与被动入口

`transitions[]` 全部必填：

| 字段 | 合法范围 |
| --- | --- |
| `id` | 自有唯一 giants.* ID |
| `sourceFormId` | pack内独立形态或复合体核心，不能外围 |
| `condition` | 恰 `{kind:"hp-at-most",numerator:1…10000,denominator:numerator…10000}`；当前HP≤maxHP×比例 |
| `ticks` | 1…10000，NPC正耗时 |
| `hpCost` | 0…9999，native HP费用；不能致死自身，费用不自动改成combat体力 |
| `transition` | 必填下面六项；不能提供sourceGroupId、脚本、random数量、额外字段 |

transition字段：`reason` phase/split/clone/summon；`results` 1–4个；`hp` ratio/injury/conserve/current；`statuses` preserve/clear；`relationships` preserve/clear；`placement` nearest/random-nearest。全部无隐式默认。

每个result恰 `{formId,memberMap}`；formId为pack内独立/核心形态；memberMap数组0–16项，每项恰 `{from,to}`，引用源／目标body非核心槽；from跨全部结果唯一，to每结果唯一。没有隐式按名称配对。第一结果保留核心ID，映射成员保留ID；未映射成员新建或无死亡退休。clone/summon所有副本ID全新，不得填memberMap，并且只允许复制sourceFormId本身；当前没有召唤任意其他species的正式声明。

| reason / HP | 数量与政策 |
| --- | --- |
| phase | 恰1结果；ratio按最大HP比例向下取整且至少1；injury保持已损伤量且至少1；current保持当前HP但仍受结果容量检查 |
| split | 2–4结果且hp必须conserve；按结果序号均分正整数HP，余数给较早结果，HP不足或任一容量不足则整批失败 |
| clone / summon | 1–4副本且hp必须current；源保留，副本各取当前HP，不复制原奖励权利／掉落／paid计划；普通clone XP配置也不能重授这份权利 |

同body的phase不能复活已坏槽位；再生/regrow、镜像不是合法reason。clear清状态及加减速缓存；preserve深拷贝合法容器。每声明每来源只一次，后裔继承spent集合，禁止下一tick重试及指数召唤。

底座可信运行请求 `BodyTransitionRequest` 另必填 `sourceGroupId`（正整数）；被动polymorph增加 `reason:"polymorph"`、`hp:"polymorph"`、`relationships:"native-polymorph"` 且恰1结果，这是内部原生资格路径，不是作者可输入的主动招式字段。

执行纯准备→必要抽样→全结果虚拟ID/完整落点预留→revision复核→批次提交；任一无位/预算失败不留半体。主动失败保留费用、正耗时、spent/no-effect收据；意外异常恢复地图/光照/实体/群/ID/消息/费用/双RNG/计划引用。分裂所有主体继承原encounter，最后主体实际死亡才defeated；clone/summon副本不加入原subjects、不继承Boss marker，原奖励权利不翻倍。

## 6 生成贡献与场地

`templates[]` 是底座 `GenerationContribution`，以下均必填，bodyId例外：

| 字段 | 合法值 |
| --- | --- |
| `id` | 唯一自有giants.* ID |
| `priority` | −100…100，按priority、owner、template ID稳定排序 |
| `minDepth,maxDepth` | 1≤min≤max≤40 |
| `chance` | 0…100，尝试百分比，不保证成功出生 |
| `width,height` | 净空宽12…32，高10…24；giants非size2形态要求至少16×12 |
| `entranceWidth` | 3…min(width,height)−4 |
| `candidateLimit` | 1…16 |
| `formId` | 本pack形态；复合体必须为对应唯一核心 |
| `bodyId` | 可省略表示刚体；提供时为已安装body且核心formId匹配 |
| `guard` | 恰return-to-spawn，全身体硬守场 |

侧室可绕行、不封门；每层所有贡献最多一个成功场地、有限候选；预算满记skipped/budget，无位记skipped/no-space。直廊长度≤12，spawn离边至少两格；必须验证玩家绕行/楼梯连通、刚体各pose和sweep可达、复合体真实落脚/约束。出生前预留被陷阱/机器/autogen/填充尊重，最终发布还须验动态占位；失败不把身体缩成一格。区域几何唯一保存在底座owned regions，总预算128；实体spatial只引用regionId。移动/击退/传送/转换所有结果都受该边界；fall清旧层边界，不在下一层重造场地。

## 7 持久字段与预算（不由作者手填运行时状态）

底座 `CreatureSpatialComponent` 必填 `schema:1,footprintId,pose`；可选movementRegionId（正整数已存在区域）、bodyMember（恰groupId正整数/partId）、actionLockInTicks（0…1000000）、zoneState。zoneState逐local区恰一条 `{zoneId,hp:0…maxHp,broken,generation:0}`，hp==0当且仅当broken，禁止regenerateInTicks；native区不写此记录。出生时自动建立local区记录：hp=maxHp、broken=false、generation=0；新群活槽readyInTicks=0、appliedBreaks为空。未用能力属性省略，不填undefined。

`BodyGroupState` 必填schema1、groupId=coreId正整数、bodyDefinitionId、members、appliedBreaks。members与定义槽位一一对应：`partId,entityId,life,generation:0,readyInTicks:0…1000000`；活槽life=active且实体存在，退休槽life=removed/entityId=null/ready=0；生产不接受broken/inert实体残体。appliedBreaks每个恰partId/zoneId=body/generation0，外围直接破坏一次，核心不能登记。实体唯一归组、全组同层同生命周期；循环/共享/孤儿/重叠/错form拒绝。群HP、位置、局部状态仍在Creature，群表不复制。

`run.spatialWorld` schema1只存实际引用的definitions闭包和groups；definitions含footprints/bodies，按需含forms/breakRules/statusProfiles/attackProfiles。实际定义必须等于安装许可；索引、revision、path cache及短scope是派生数据，load/rollback/seek重建。

| 限额 | 当前值／超限行为 |
| --- | --- |
| 单体格／跨度／zone | 16／每轴16／8；拒绝定义或读档 |
| 正式pose／理论底座pose／每90°sweep | 1或4／类型最多8／256；镜像未开放 |
| 群成员／群格／群zone | 17（含core）／64／32；全批拒绝 |
| 每成员候选／回溯／成员移动子步／攻击束 | 32／128／2／4；bounded blocked、正耗时 |
| 活动层实体／新空间占格 | 128／512；创建/转换/读档拒绝；不抢真实ID或缩成员 |
| 一次LOS候选格对 | 128，距离及稳定足迹序先固定候选；不依设备耗时或失败次数扩表 |
| 当前层path cache | 8组LRU；只影响成本，不影响机械结果 |
| pack forms/templates/transitions/body定义 | 各16；profile表及break表各16 |
| placements/bosses/每encounter subjects | 128／128／64；重复key、错绑定和伪defeated拒绝 |

GiantsState只由底座事实更新，初态schema1/revision0/placements[]/bosses[]；每次改动revision递增。placement字段：instanceKey=`templateId.depth-N`、templateId、depth、result、regionId、reason。placed必须region正ID/reason null，skipped必须region null/reason no-space或budget。boss字段：encounterKey=`instanceKey.encounter`、primaryId、spawnDefinitionId、instanceKey、regionId、subjects、status；subjects为groupId/status alive|dead|lost，首项primaryId，跨encounter不能共享；boss status为alive/defeated/escaped/lost，全部主体dead才defeated，lost不得还有alive，escaped仍有活主体。`giants:boss`组件只含schema1/encounterKey/spawnDefinitionId，不存第二套HP或位置。

## 8 与其他模块的软接口现状

- **combat.part-break.v1** 已接：底座证明group/part/zone/generation并提供balanceLoss/fallbackStunTicks；combat ready时扣韧性/进入恢复且底座不加fallback锁；absent/disabled/unsupported用短锁。非法或重复provider安装拒绝；异常同破坏事务回滚。来源破坏/退休/换形取消已付款预警，保留恢复/费用，不补射。
- **phased profile** 已接：body attackProfileIds→providerProfileId，核心唯一decision/time owner，member作为独立来源、独立资源与scope；combat缺席native即时攻击，安装了provider却缺profile会拒绝。本手册不额外授权新种类专属招式或自定义 AI；giants2 四个新 form 没有新增 attack profile 绑定。
- **growth XP报价** 已接出生、受击来源、真正终结：报价配置归growth的monsterQuotes（按originalMonsterType），giants无内置XP字段。未配正式type报价通常0XP；不能认为一个Boss默认27。27/13是正报价测试夹具。成员破坏无killXP、核心原权利一次，split额外主体/clone/summon零权利。无growth照常战斗与终结。
- **narrative** 无正式Boss专用剧情联动/必需storyFact消费者；空间、可信事实和可选奖励接口可复用，现无剧情数据可配置“杀Boss开门”。不要把未来proposal当现成功能。未启用narrative不影响giants。

## 9 版本、旧档与作者验收

当前 whole-run 版本6、recording版本4、recordingOrigin版本2、whole-run schema `brogue-web-whole-run-v6`；foundation11、manifest schema1、world5 schema2；模块独立版本、rules schema/version/fingerprint写入精确manifest。机械pack全文canonical指纹改变就拒绝旧指纹输入；缺giants、错版本、坏定义/群/zone/预算在旧局退休前拒绝。**不迁移旧档，不重放旧规则录像，不剥掉缺失模块状态继续加载。** locale消息更名本轮不改变机械pack指纹；但形态名称/描述进入实体快照，今后修改species文字仍须检查自然trace。

新增数据后跑真实schema、boundary、类型、build、直接功能/giants专项和drift；改trace先归因、用原捕获入口重录并列逐字段变化。普通基线不得因为giants内容而无解释重录。giants2 只跑九行相关组合（无模块、仅 giants、分别配其他六模块、七模块全开）和只删 giants 的 plan；完整 npm test、全部 test:ext、128组合、实际删除、全项目性能/体积留5Z。自然trace须在生产概率/深度下从正式新局与公开命令采集；诊断布景不得冒充自然证据。

## 10 三个完整配置例子

以下每段都是可交给 `assertGiantsPack` 的完整pack，不是省略必填字段的草图。命名与数值是文档示例，不自动进入正式随机形态目录；配套locale须新增所用ext.giants.*键。验证来源：模块自有 `tests/giants_config_examples.test.ts` 从本文直接提取JSON，运行真实pack校验、模块工厂和ExtensionRuntime安装，并验证生成/转换引用闭包；不得改为另一份手抄测试对象。

三个例子共同使用以下locale条目，追加到模块`locales/zh_CN.json`；不把中文直接写进机械pack：

```json
{
  "ext.giants.example-guardian.name": "岩门守卫",
  "ext.giants.example-guardian.description": "双肩如岩门的守卫，驻守宽阔侧室。",
  "ext.giants.example-arm.name": "守卫岩臂",
  "ext.giants.example-arm.description": "独立落脚和受击的支撑岩臂；折断后使核心停步。",
  "ext.giants.example-small.name": "碎甲守卫",
  "ext.giants.example-small.description": "守卫换形后的碎甲躯体，保留此前的伤量。"
}
```

### 10.1 新增一个2×2大型敌人

<!-- giants-config-example: enemy -->
```json
{
  "schema": 1,
  "moduleVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "forms": [
    {
      "id": "giants.example-guardian",
      "nameKey": "ext.giants.example-guardian.name",
      "descriptionKey": "ext.giants.example-guardian.description",
      "size": 2,
      "char": "G",
      "color": 11965276,
      "hp": 100,
      "accuracy": 75,
      "defense": 20,
      "damage": "3-6",
      "moveSpeed": 150,
      "attackSpeed": 150,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0
    }
  ],
  "templates": [
    {
      "id": "giants.example-room",
      "priority": 0,
      "minDepth": 3,
      "maxDepth": 8,
      "chance": 50,
      "width": 16,
      "height": 12,
      "entranceWidth": 4,
      "candidateLimit": 16,
      "formId": "giants.example-guardian",
      "guard": "return-to-spawn"
    }
  ]
}
```

在locale中添加example-guardian的name/description；把此形态和模板追加到正式pack（不重复ID），用createModuleMonster检查完整2×2落点，然后用D3场地/存读/录像验证。

### 10.2 新增一个核心＋独立支撑成员的复合体

<!-- giants-config-example: body -->
```json
{
  "schema": 1,
  "moduleVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "forms": [
    {
      "id": "giants.example-guardian",
      "nameKey": "ext.giants.example-guardian.name",
      "descriptionKey": "ext.giants.example-guardian.description",
      "size": 2,
      "char": "G",
      "color": 11965276,
      "hp": 100,
      "accuracy": 75,
      "defense": 20,
      "damage": "3-6",
      "moveSpeed": 150,
      "attackSpeed": 150,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0
    },
    {
      "id": "giants.example-arm",
      "nameKey": "ext.giants.example-arm.name",
      "descriptionKey": "ext.giants.example-arm.description",
      "char": "G",
      "color": 11965276,
      "hp": 12,
      "accuracy": 75,
      "defense": 20,
      "damage": "3-6",
      "moveSpeed": 150,
      "attackSpeed": 150,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0,
      "footprint": {
        "geometry": {
          "kind": "rect",
          "width": 1,
          "height": 1
        },
        "poses": [
          "r0"
        ]
      }
    }
  ],
  "templates": [
    {
      "id": "giants.example-body-room",
      "priority": 0,
      "minDepth": 3,
      "maxDepth": 8,
      "chance": 50,
      "width": 16,
      "height": 12,
      "entranceWidth": 4,
      "candidateLimit": 16,
      "formId": "giants.example-guardian",
      "guard": "return-to-spawn",
      "bodyId": "giants.example-body"
    }
  ],
  "bodies": {
    "definitions": [
      {
        "id": "giants.example-body",
        "owner": "giants",
        "parts": [
          {
            "partId": "core",
            "role": "core",
            "providesSupport": false,
            "formId": "giants.example-guardian",
            "preferredOffset": {
              "x": 0,
              "y": 0
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 0,
              "denominator": 1
            },
            "breakRuleId": "foundation:keep-zone",
            "statusProfileId": "foundation:native"
          },
          {
            "partId": "support",
            "role": "support",
            "providesSupport": true,
            "formId": "giants.example-arm",
            "preferredOffset": {
              "x": -1,
              "y": 0
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 1,
              "denominator": 4
            },
            "breakRuleId": "giants.example-retire",
            "statusProfileId": "foundation:native"
          }
        ],
        "constraints": [
          {
            "childPartId": "support",
            "parentPartId": "core",
            "kind": "tether",
            "minDistance": 1,
            "maxDistance": 3,
            "maxStepPerAction": 2,
            "requiresClearLink": true
          }
        ],
        "minSupportParts": 1,
        "noSupport": "immobile",
        "coreDeath": "remove-members",
        "statusProfileId": "foundation:native"
      }
    ],
    "breakRules": [
      {
        "id": "giants.example-retire",
        "owner": "giants",
        "trigger": "hp-zero",
        "disposition": "remove",
        "childrenOnBreak": "retire-subtree",
        "modifiers": [
          {
            "kind": "move-ticks-multiplier",
            "numerator": 3,
            "denominator": 2
          }
        ]
      }
    ]
  }
}
```

这是最小完整两实体例子；模板bodyId声明整个身体。增加腿须同时加唯一parts槽与父边，并保持17成员/64格/支撑预算。attackProfileIds为空时无需combat；打断支撑后核心不能移动、仍可攻击。

### 10.3 新增一个半血换形招式

<!-- giants-config-example: transition -->
```json
{
  "schema": 1,
  "moduleVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "forms": [
    {
      "id": "giants.example-guardian",
      "nameKey": "ext.giants.example-guardian.name",
      "descriptionKey": "ext.giants.example-guardian.description",
      "size": 2,
      "char": "G",
      "color": 11965276,
      "hp": 100,
      "accuracy": 75,
      "defense": 20,
      "damage": "3-6",
      "moveSpeed": 150,
      "attackSpeed": 150,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0
    },
    {
      "id": "giants.example-small",
      "nameKey": "ext.giants.example-small.name",
      "descriptionKey": "ext.giants.example-small.description",
      "size": 2,
      "char": "G",
      "color": 11965276,
      "hp": 100,
      "accuracy": 75,
      "defense": 20,
      "damage": "3-6",
      "moveSpeed": 150,
      "attackSpeed": 150,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0
    }
  ],
  "templates": [
    {
      "id": "giants.example-transition-room",
      "priority": 0,
      "minDepth": 3,
      "maxDepth": 8,
      "chance": 50,
      "width": 16,
      "height": 12,
      "entranceWidth": 4,
      "candidateLimit": 16,
      "formId": "giants.example-guardian",
      "guard": "return-to-spawn"
    }
  ],
  "transitions": [
    {
      "id": "giants.example-phase",
      "sourceFormId": "giants.example-guardian",
      "condition": {
        "kind": "hp-at-most",
        "numerator": 1,
        "denominator": 2
      },
      "ticks": 200,
      "hpCost": 2,
      "transition": {
        "reason": "phase",
        "results": [
          {
            "formId": "giants.example-small",
            "memberMap": []
          }
        ],
        "hp": "injury",
        "statuses": "clear",
        "relationships": "preserve",
        "placement": "nearest"
      }
    }
  ]
}
```

半血时付2HP、200ticks，只触发一次；保持伤量换为example-small并清状态。无落点仍保留费用和正耗时。若改分裂，results须2–4且hp=conserve；若改clone/summon，目标必须等于来源且hp=current。


## 11 giants2 正式内容索引与完整默认包

本批恰两种 species：盲灯蜷兽与铜须伏螯。展躯盲灯兽是第一种的阶段形态，伏螯节须是第二种的外围成员，不能算第三／第四物种。首批岩脊兽、沉渊巨像、棘脊爬兽、页岩织兽保留；总计9 forms、6 templates、2 bodies、2 member break rules、2 transitions、原2 attack profiles。

| 形态ID（giants. 前缀） | 名称 | HP | accuracy / defense | damage | move / attack ticks | 字形／颜色（十进制） | 用途 |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| blind-lantern | 盲灯蜷兽 | 84 | 75 / 12 | 3–6 | 150 / 180 | L / 13153674 | D2–4，7格四旋转非矩形 |
| blind-lantern-open | 展躯盲灯兽 | 84 | 80 / 8 | 4–7 | 100 / 140 | l / 14862475 | 只作换形目标，5格钩形 |
| copper-tendril | 铜须伏螯 | 108 | 80 / 18 | 3–6 | 160 / 180 | T / 11239516 | D5–8，2×2核心 |
| copper-tendril-limb | 伏螯节须 | 18 | 70 / 6 | 1–3 | 160 / 220 | t / 13212523 | 1×1外围，不能独立自然生成 |

四形态 bloodType / DFChance / DFType 都为0。名字和描述对应 `ext.giants.<形态后缀>.name/.description`，芯首与灯褶另对应 `ext.giants.blind-lantern.wick/.mantle`。描述中的灯不提供照明，铜不提供矿物。

### 11.1 默认形状、部位与行动

蜷伏 r0 掩码为 (0,0),(1,0),(2,0),(0,1),(1,1),(2,1),(1,2)；展躯为 (0,0),(1,0),(2,0),(3,0),(3,1)。均为 r0/r90/r180/r270，绕锚点按 (x,y)→(-y,x) 旋转，不按包围盒重新对齐；凹格不占位。

灯褶 mantle 标签 (1,0),(2,0),(2,1)，local HP18、armor1、伤害倍率1/1、向实体传伤1/1。芯首 wick 标签(0,0)，native HP、armor0、倍率1/1，使用 foundation:keep-zone；其他格为body。灯褶触发 hp-zero 后 keep-zone，整兽 move ticks ×4/3（150→200），暴露 self/wick 倍率2/1，balance-loss5；无provider fallback锁40ticks，不与combat恢复重复叠加。破坏不删格。

lantern-uncoil 在下一合资格NPC决策满足 HP/maxHP≤1/2（HP≤42）时触发一次：200ticks、0HP、phase、一个 blind-lantern-open 结果、memberMap=[]、hp=ratio、statuses/relationships=preserve、placement=nearest。新旧maxHP同84，不回血；保留ID/区域/encounter与兼容pose。新形态没有旧local灯褶，wick倍率回到新定义的1/1、move100；失败也正耗时并记spent，不再尝试。

伏螯body为 copper-tendril-body，5实体共8格。core偏好(0,0)，不提供支撑、coreTransfer0/1、foundation:keep-zone；limb00/01/02/03偏好(-1,0)/(2,0)/(-1,2)/(2,2)，各为support并提供支撑，使用 copper-tendril-limb、coreTransfer1/4。所有part的attackProfileIds=[]、statusProfileId=foundation:native。四条父边均直接连core，tether距离1…3、maxStepPerAction2、requiresClearLink=true；偏好不是刚性强制位置。

外围hp-zero使用 copper-limb-retire：remove、childrenOnBreak=retire-subtree、move ticks×5/4、balance-loss4／fallback30ticks。单击先消耗其正HP限额，再向下取整传core四分之一；断须释放格、保留槽墓碑与一次收据，不再生。minSupportParts2，剩1或0不能移动但仍可合法近战。coreDeath=remove-members，无额外成员死亡奖励。核心唯一调度，沿原生感知、睡眠、寻路、接触、有限落脚；不添加脚本AI。

### 11.2 默认生成与奖励

lantern-chamber：D2–4、chance50、form blind-lantern、无bodyId；copper-chamber：D5–8、chance45、form copper-tendril、bodyId copper-tendril-body。两者均priority10、净空16×12、entranceWidth5、candidateLimit16、guard=return-to-spawn。旧priority0/1/2先尝试；每层最多1场地成功，chance是尝试率，空间/预算失败记完整跳过，不缩形、不封主路。

四形态金币／物品掉率均0%，无携带物、专属奖励0；这些是nativeFormData固定执行合同，**不是可在JSON添加的掉落字段**。部位破坏与phase不发额外kill/XP；真正核心终结沿已有事实一次。growth对新type无报价时0XP，缺growth仍可玩。没有矿物、掉落表、肢体再生或新增combat招式配置。

### 11.3 可独立校验的全部默认字段

以下完整子包保存全部字段、引用与数组次序，可独立交给assertGiantsPack和真实Runtime安装。它不是完整生产包的替代品：按顺序追加forms/templates/transitions及bodies.definitions/breakRules；保留原根版本、旧数组前缀和旧bodies.attackProfiles，未提供的statusProfiles继续缺席。后续作者调数仍须遵守§1–7合法范围；本次交付不调参。新例子使用独立标记，不改变前三个作者示例。

<!-- giants2-config-defaults -->
```json
{
  "schema": 1,
  "moduleVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "forms": [
    {
      "id": "giants.blind-lantern",
      "nameKey": "ext.giants.blind-lantern.name",
      "descriptionKey": "ext.giants.blind-lantern.description",
      "char": "L",
      "color": 13153674,
      "hp": 84,
      "accuracy": 75,
      "defense": 12,
      "damage": "3-6",
      "moveSpeed": 150,
      "attackSpeed": 180,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0,
      "footprint": {
        "geometry": {
          "kind": "mask",
          "cells": [
            {
              "x": 0,
              "y": 0
            },
            {
              "x": 1,
              "y": 0
            },
            {
              "x": 2,
              "y": 0
            },
            {
              "x": 0,
              "y": 1
            },
            {
              "x": 1,
              "y": 1
            },
            {
              "x": 2,
              "y": 1
            },
            {
              "x": 1,
              "y": 2
            }
          ]
        },
        "poses": [
          "r0",
          "r90",
          "r180",
          "r270"
        ],
        "zones": [
          {
            "id": "mantle",
            "nameKey": "ext.giants.blind-lantern.mantle",
            "health": {
              "kind": "local",
              "maxHp": 18,
              "ownerTransfer": {
                "numerator": 1,
                "denominator": 1
              }
            },
            "armor": 1,
            "damageMultiplier": {
              "numerator": 1,
              "denominator": 1
            },
            "breakRuleId": "giants.lantern-mantle-break"
          },
          {
            "id": "wick",
            "nameKey": "ext.giants.blind-lantern.wick",
            "health": {
              "kind": "native"
            },
            "armor": 0,
            "damageMultiplier": {
              "numerator": 1,
              "denominator": 1
            },
            "breakRuleId": "foundation:keep-zone"
          }
        ],
        "zoneCells": [
          {
            "x": 0,
            "y": 0,
            "zoneId": "wick"
          },
          {
            "x": 1,
            "y": 0,
            "zoneId": "mantle"
          },
          {
            "x": 2,
            "y": 0,
            "zoneId": "mantle"
          },
          {
            "x": 2,
            "y": 1,
            "zoneId": "mantle"
          }
        ]
      },
      "breakRules": [
        {
          "id": "giants.lantern-mantle-break",
          "owner": "giants",
          "trigger": "hp-zero",
          "disposition": "keep-zone",
          "modifiers": [
            {
              "kind": "move-ticks-multiplier",
              "numerator": 4,
              "denominator": 3
            },
            {
              "kind": "expose-zone",
              "partId": "self",
              "zoneId": "wick",
              "damageMultiplier": {
                "numerator": 2,
                "denominator": 1
              }
            },
            {
              "kind": "balance-loss",
              "amount": 5,
              "fallbackStunTicks": 40
            }
          ]
        }
      ]
    },
    {
      "id": "giants.blind-lantern-open",
      "nameKey": "ext.giants.blind-lantern-open.name",
      "descriptionKey": "ext.giants.blind-lantern-open.description",
      "char": "l",
      "color": 14862475,
      "hp": 84,
      "accuracy": 80,
      "defense": 8,
      "damage": "4-7",
      "moveSpeed": 100,
      "attackSpeed": 140,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0,
      "footprint": {
        "geometry": {
          "kind": "mask",
          "cells": [
            {
              "x": 0,
              "y": 0
            },
            {
              "x": 1,
              "y": 0
            },
            {
              "x": 2,
              "y": 0
            },
            {
              "x": 3,
              "y": 0
            },
            {
              "x": 3,
              "y": 1
            }
          ]
        },
        "poses": [
          "r0",
          "r90",
          "r180",
          "r270"
        ],
        "zones": [
          {
            "id": "wick",
            "nameKey": "ext.giants.blind-lantern.wick",
            "health": {
              "kind": "native"
            },
            "armor": 0,
            "damageMultiplier": {
              "numerator": 1,
              "denominator": 1
            },
            "breakRuleId": "foundation:keep-zone"
          }
        ],
        "zoneCells": [
          {
            "x": 0,
            "y": 0,
            "zoneId": "wick"
          }
        ]
      }
    },
    {
      "id": "giants.copper-tendril",
      "nameKey": "ext.giants.copper-tendril.name",
      "descriptionKey": "ext.giants.copper-tendril.description",
      "char": "T",
      "color": 11239516,
      "hp": 108,
      "accuracy": 80,
      "defense": 18,
      "damage": "3-6",
      "moveSpeed": 160,
      "attackSpeed": 180,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0,
      "size": 2
    },
    {
      "id": "giants.copper-tendril-limb",
      "nameKey": "ext.giants.copper-tendril-limb.name",
      "descriptionKey": "ext.giants.copper-tendril-limb.description",
      "char": "t",
      "color": 13212523,
      "hp": 18,
      "accuracy": 70,
      "defense": 6,
      "damage": "1-3",
      "moveSpeed": 160,
      "attackSpeed": 220,
      "bloodType": 0,
      "DFChance": 0,
      "DFType": 0,
      "footprint": {
        "geometry": {
          "kind": "rect",
          "width": 1,
          "height": 1
        },
        "poses": [
          "r0"
        ]
      }
    }
  ],
  "templates": [
    {
      "id": "giants.lantern-chamber",
      "priority": 10,
      "minDepth": 2,
      "maxDepth": 4,
      "chance": 50,
      "width": 16,
      "height": 12,
      "entranceWidth": 5,
      "candidateLimit": 16,
      "formId": "giants.blind-lantern",
      "guard": "return-to-spawn"
    },
    {
      "id": "giants.copper-chamber",
      "priority": 10,
      "minDepth": 5,
      "maxDepth": 8,
      "chance": 45,
      "width": 16,
      "height": 12,
      "entranceWidth": 5,
      "candidateLimit": 16,
      "formId": "giants.copper-tendril",
      "guard": "return-to-spawn",
      "bodyId": "giants.copper-tendril-body"
    }
  ],
  "bodies": {
    "definitions": [
      {
        "id": "giants.copper-tendril-body",
        "owner": "giants",
        "parts": [
          {
            "partId": "core",
            "role": "core",
            "providesSupport": false,
            "formId": "giants.copper-tendril",
            "preferredOffset": {
              "x": 0,
              "y": 0
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 0,
              "denominator": 1
            },
            "breakRuleId": "foundation:keep-zone",
            "statusProfileId": "foundation:native"
          },
          {
            "partId": "limb00",
            "role": "support",
            "providesSupport": true,
            "formId": "giants.copper-tendril-limb",
            "preferredOffset": {
              "x": -1,
              "y": 0
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 1,
              "denominator": 4
            },
            "breakRuleId": "giants.copper-limb-retire",
            "statusProfileId": "foundation:native"
          },
          {
            "partId": "limb01",
            "role": "support",
            "providesSupport": true,
            "formId": "giants.copper-tendril-limb",
            "preferredOffset": {
              "x": 2,
              "y": 0
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 1,
              "denominator": 4
            },
            "breakRuleId": "giants.copper-limb-retire",
            "statusProfileId": "foundation:native"
          },
          {
            "partId": "limb02",
            "role": "support",
            "providesSupport": true,
            "formId": "giants.copper-tendril-limb",
            "preferredOffset": {
              "x": -1,
              "y": 2
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 1,
              "denominator": 4
            },
            "breakRuleId": "giants.copper-limb-retire",
            "statusProfileId": "foundation:native"
          },
          {
            "partId": "limb03",
            "role": "support",
            "providesSupport": true,
            "formId": "giants.copper-tendril-limb",
            "preferredOffset": {
              "x": 2,
              "y": 2
            },
            "attackProfileIds": [],
            "coreTransfer": {
              "numerator": 1,
              "denominator": 4
            },
            "breakRuleId": "giants.copper-limb-retire",
            "statusProfileId": "foundation:native"
          }
        ],
        "constraints": [
          {
            "childPartId": "limb00",
            "parentPartId": "core",
            "kind": "tether",
            "minDistance": 1,
            "maxDistance": 3,
            "maxStepPerAction": 2,
            "requiresClearLink": true
          },
          {
            "childPartId": "limb01",
            "parentPartId": "core",
            "kind": "tether",
            "minDistance": 1,
            "maxDistance": 3,
            "maxStepPerAction": 2,
            "requiresClearLink": true
          },
          {
            "childPartId": "limb02",
            "parentPartId": "core",
            "kind": "tether",
            "minDistance": 1,
            "maxDistance": 3,
            "maxStepPerAction": 2,
            "requiresClearLink": true
          },
          {
            "childPartId": "limb03",
            "parentPartId": "core",
            "kind": "tether",
            "minDistance": 1,
            "maxDistance": 3,
            "maxStepPerAction": 2,
            "requiresClearLink": true
          }
        ],
        "minSupportParts": 2,
        "noSupport": "immobile",
        "coreDeath": "remove-members",
        "statusProfileId": "foundation:native"
      }
    ],
    "breakRules": [
      {
        "id": "giants.copper-limb-retire",
        "owner": "giants",
        "trigger": "hp-zero",
        "disposition": "remove",
        "childrenOnBreak": "retire-subtree",
        "modifiers": [
          {
            "kind": "move-ticks-multiplier",
            "numerator": 5,
            "denominator": 4
          },
          {
            "kind": "balance-loss",
            "amount": 4,
            "fallbackStunTicks": 30
          }
        ]
      }
    ]
  },
  "transitions": [
    {
      "id": "giants.lantern-uncoil",
      "sourceFormId": "giants.blind-lantern",
      "condition": {
        "kind": "hp-at-most",
        "numerator": 1,
        "denominator": 2
      },
      "ticks": 200,
      "hpCost": 0,
      "transition": {
        "reason": "phase",
        "results": [
          {
            "formId": "giants.blind-lantern-open",
            "memberMap": []
          }
        ],
        "hp": "ratio",
        "statuses": "preserve",
        "relationships": "preserve",
        "placement": "nearest"
      }
    }
  ]
}
```

### 11.4 指纹与验收入口

本次只追加机械数据，用现有canonical算法得到 `sha256:1a49551065efebbcea96cb35cb83fcd049f969b24aee4bf6dd4c5c7f0790d4f8`，module/rules及全部协议版本不变。旧指纹save/recording须在当前player/runtime退休前拒绝；不能手改manifest蒙混兼容。locale不进机械fingerprint，但名称进入实体快照，改名也须复验trace。

测试入口：`giants2_contract.test.ts`直接读派发文档、比对e0fa39a原包／原locale字节oracle、校验完整合并、独立子包、真实Runtime及历史原包正式命令save/replay拒绝；`giants2_imports.test.ts`用AST限制§6导入路径/type/value。功能覆盖按 `docs/ext/giants2.report.md` 的实际结果表核对；测试存在不代表已通过。原三个 `giants-config-example` 仍由 `giants_config_examples.test.ts` 读本文安装验证。

最终候选门禁依次为boundary、vue-tsc、build、giants自有测试（maxWorkers2）、实际drift（maxWorkers2）、只删giants plan与diff-check；另跑直接受影响共享回归。运行环境为Node24.19.0、NODE_OPTIONS=--max-old-space-size=3072。两条新自然trace需出生、破坏、展躯／失撑、终结以及save/load/replay/seek/续录；normal模式另作短局。UI沿现有只读DisplayFrame/HUD/侧栏，三个viewport×普通/沉浸×四地图模式的实际浏览器覆盖按报告注明，不能以组件测试替代。
