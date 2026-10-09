# 远征营地 5E1 配置手册

本文描述5E1实施候选（未提交）；实施测试、失败和覆盖缺口见[5E1报告](phase5e1.report.md)，待父独立审查。5D2已由父提交 `ce7a2da`。5D1历史验收和性能仅按当时版本引用；完整门禁、最终浏览器和真机归[5Z](phase5z-remainders.md)。

生产目录 `src/ext/modules/settlement/`；入口 `descriptor.ts` 由 catalog 自动发现，`defaultEnabled=false`。新局扩展选择中单独勾选「远征营地」即可使用，不依赖其他内容模块。启用后按原有启动收据发放建材，寻找第二份原生食物，再在合法地牢区域建营地。不开启时没有本模块定义、启动材料、采集节点或营地逻辑。

## 数据和身份

建造与居民机械数据归 `data/definitions.json`；5E1 袭击默认规则归自有 `raids.ts`，两者及本局固定配置共同形成 manifest 的规则身份。外层键为 `schema,moduleVersion,rulesVersion,world,camp,residents`；外层 schema=1、module/rules=1.3.0，内层 world schema/worldSdk=1，residents.schema=1。foundation=13，world5.schema=4，settlement state.schema=2；whole-run=6、recording=4、RecordingOrigin=2。SDK 兼容号和持久格式号是不同身份，不因 world5 升号就把 worldSdk 改成2。`definitions.ts` 对整个包计算一个 `extensionDataFingerprint`，同时包含营地政策、world 定义和居民政策。调整机械数据须同步 rules 身份并遵循存档/录像匹配；本步不迁移旧档。

`schema.ts` 和中性 `ext/constructionSchema.ts` 拒绝未知键、非法 JSON、getter、非安全整数、非法 owner/ID、缺失定义引用、预算越界；`WorldDefinitions.ts` 保留可信入口并继续调用既有 edible 校验。内容模块只声明数据和接收 detached/frozen DTO，不导入 Game，不注册结构 DEV fixture。

| 内容 | 数量/时间/规则 |
| --- | --- |
| wood / stone / fiber | material；`basic.wood/basic.stone/basic.fiber`；maxStack=99 |
| 新局建材/种子 | wood12、stone8、fiber6、seed6；一次启动收据；溢出沿底座 floor-then-skip；不额外发 FOOD |
| 木、石、纤维源 | 徒手100 tick取1，容量20；D1…40每类每层最多尝试1个，全局每类40个；落位失败有收据，不改天然地形 |
| 再生 | 木2000 tick回1，纤维1000 tick回1，石无再生；查看虚拟投影，工作提交才实体结算 |
| 建营地 | wood4+stone2；300 tick；背包明确选择2份真实口粮/芒果 |
| 扩张 | wood2+stone2；300 tick/次；保留 region ID、增加 revision |
| 撤营 | 100 tick；关联结构/居民/订单必须先处理；剩余补给须能合法放入背包，否则整笔拒绝 |
| 门开关 / 拆卸 / 批量转移 | 100 tick/条公开命令；查看和编辑0 tick |

结构材料账单以 JSON 为准：

| 定义 ID（settlement. 前缀） | 材料 | tick | HP | 物理/火抗性 | 资格 |
| --- | --- | --- | --- | --- | --- |
| wood-floor | wood1 | 100 | 100 | 0/0 | floor，易燃 |
| stone-floor | stone1 | 100 | 200 | 25/100 | floor，不燃 |
| wood-wall | wood2 | 100 | 150 | 0/0 | wall，易燃 |
| stone-wall | stone2 | 100 | 300 | 25/100 | wall，不燃 |
| door | wood2 | 200 | 150 | 0/0 | door，易燃 |
| window | wood2 | 200 | 100 | 0/0 | window，易燃 |
| roof | wood1+fiber1 | 200 | 100 | 0/0 | roof，易燃；仅房间覆盖资格 |
| bed | wood4+fiber2 | 300 | 100 | 0/0 | fixture + RestPoint，易燃 |
| chest | wood6 | 300 | 150 | 0/0 | fixture，64槽，易燃 |
| plot | wood2+fiber1 | 300 | 100 | 0/0 | fixture，种植床，易燃 |
| hearth | wood4+stone4 | 300 | 150 | 0/0 | fixture，station.hearth，易燃 |

床的原生休息上限30000 tick、交互距离1、HP策略 `native-over-time`、可选战斗资源 `none`、重置 `none`。休息依原生 auto_step 推进；饥饿、环境、敌情/受伤/消息打断照常，不补满、不产生 FOOD、不重置篝火。

## 能改什么：数据、运行时选择与代码常量

下表中的“可改”指编辑源码数据包后重新构建，不是游戏内设置。所有字段先过严格 schema 和引用验证；只改 JSON 不绕过可信执行资格。机械变动须同步规则身份/指纹与相应格式，不能修改存档里的数值授予能力。名称/说明在 `locales/zh_CN.json`；ID/owner和语义标签参与引用，任意改名会影响营地、材料匹配、种子/作物识别，必须同步引用。

| 数据字段 | 当前值/允许范围 | 性质与校验位置 |
| --- | --- | --- |
| schema、moduleVersion、rulesVersion、world.schema/worldSdk、residents.schema | 1、1.3.0、1.3.0、1/1、1 | 严格身份；settlement/schema.ts、constructionSchema.ts、residentSchema.ts；不能作数值旋钮 |
| world.items[].maxStack/tags | 木/石/纤维/种子/作物/肉等材料maxStack99；原生口粮模板及食材标签见数据表 | maxStack 1…99，tags≤16、有效ID且严格排序；普通材料 nativeTemplate/tool=null；settlement.ration为native原生食物模板，普通无特性。mushroom占位定义无食材标签，不能自行制造可用蘑菇 |
| resourceNodes[].capacity/harvestTicks/unitsPerHarvest/yield/requiredToolTag | 20/100/1/1件/null | 容量1…9999；工时1…10000；单次1…min(99,capacity)；物品数量1…99、引用有效；工具tag可为null/合法ID，实际工具规则仍须满足底座 |
| regeneration | 木 periodic(1,2000)，纤维 periodic(1,1000)，石 none | 枚举 none/periodic；periodic.units 1…99、intervalTicks 1…1000000 |
| placement.dungeon | 深度1…40、每层1/每局40、onNoSpace=skip；site=null | min/maxDepth 1…40、maxPerDepth 1…32、maxPerRun 1…512，skip/defer；整包每层总尝试≤32、节点总预算≤512；现版只执行地牢，不能据site字段宣称已实现地表 |
| startupItems | settlement.startup；12木/8石/6纤维/6种子 | items引用和数量校验；overflow只能 floor-then-skip，一次真实新局收据，不是每次读档发放 |
| camp.createCost/expandCost | wood4+stone2 / wood2+stone2 | 1…8项、数量1…99、无重复，引用本包basic.* material；create/expandTicks默认300、dismantle/retireTicks默认100，各1…10000 |
| camp.supplyCapacity / requiredFood | 64 / 2 | supplyCapacity 1…64可改；requiredFood必须2，锁守恒也写死2，不能仅改JSON |
| structures[].constructionCost/constructionTicks/maxHp/resistances/refund* | 上表；字段默认1/2 | 工时1…10000、HP1…1000000、物理/火抗0…100、分母1…10000、分子0…分母。refundNumerator/Denominator虽通过范围校验，实际destroyComponent固定按1/2退料，改JSON不能改变退款比例；退款读取实际原账单及当前耐久。部件slot/barrierKind与blocks必须配套，不能任意解锁墙/窗性质 |
| structures[].containerCapacity/stationDefinitionId/restPointDefinitionId | chest64 / hearth→settlement.hearth-station / bed→settlement.rest | 容器仅fixture可1…64；绑定台/休息点须同包定义；本包有基础灶台。床/种植床语义还依赖tags及实际固定ID，不能只换标签制造额外岗位 |
| restPoints[] | 30000/距离1，native-over-time/none/none | maxRestTicks 100…30000且100倍数，距离0…16，hp可native-over-time或none；optionalCombatResources/resetPolicy只能none |
| residents.templates[] | 恰两模板：wayfarer HP20、gardener HP24；accuracy80、defense0、damage="1-3"、move/attack100 | 模板ID须settlement.前缀，文本key须ext.settlement.前缀；HP/速度1…1000，accuracy0…100，defense0…1000，伤害非负整数闭区间且上限1000；无任意行为/技能/随机装备字段 |
| residents.rescuedTemplates | kobold/goblin/goblin_mystic/goblin_conjurer/ogre | 列表≤16，元素只可取这5个ID，可收窄；不能添加动物/巨兽突破原生资格 |
| residents.spawnDepths/dayEpochs/lowLightChannels/plotWorkTicks | [1,5,10,15] / 32 / 306 / 1000 | JSON中有字段，但校验器要求这些精确值；不是当前开放的配置能力 |
| mode/job/schedule/granaryIds | stay或escort；idle/plant/haul/guard；默认[16,8,8]；补给堆+显式箱 | 游戏内公开命令选择，依目标revision/CAS；日程三正整数和32。需求欠额/信用/来源consumed不是用户可编辑配置 |

更多结构/资源通用字段枚举以 `constructionSchema.ts` 为准；日粮识别、1000/32000边界、100/50/0/0效率、四次初始连续缺粮离开、100tick招募/遣散/搬运交接、床分配和人口/设施预算都在可信代码里。没有 JSON 键可设置居民工资、离线产率、动物工人、跨层自动物流、工作成长或袭击。

## 所有权、预算与收据

每层1营地、全局8营地，使用最小空闲 slot0…7；重建时该 slot 的 ordinal 高水位递增。初始9×9、最大24×20，每营地384结构格/16箱，每箱64槽，遵守底座更严格的全局预算。补给堆也计入箱预算，所以另建箱最多15个；全局 chest 预算112。施工草稿最多16格，不持久化。


居民与世界硬预算继续取代码，不是包内limits配置：每营16/整局64（含active/cached/escort/pending），自生4槽、未消费救援来源64，每居民至多1个residentJobs票据、全局residentJobs≤64，种植床每营12、plant.plotIds≤6、haul.quantity≤8；plotDays≤96。结构全局3072格/12288部件；world5层≤40、offline账本≤8、receipts≤128；所有计数/ID/时间为安全整数。world5.orders≤256、单次OfflineInput.orders≤32是底座已有根/计划上限，5D2每居民至多一个生产订单，与legacy residentJobs排他；单次实际经济核按营地和有界周期处理。

C5新增Item接纳按真实根加预留的7168（8192−1024）预算，部分搬运拆堆和产物先验预算；全局world interactable≤1024且C5计数≤832，chest≤112、remains≤16、RestPoint≤64、nodes≤512（每层≤32）。普通自生创建还检查活动/沉眠实体128与空间512。箱槽按底座类目核算，FOOD quantity按份占槽；不是所有堆都只占一槽。这些限制相互取更严的一项，人口够不保证床/箱/活动实体仍有空间；不承诺最大负载已测通过。

`state.ts` 的 schema2 保存 `revision,camps,constructions,history,spawnSlots,plotDays`。营地只引用 region、slot/ordinal、补给容器和标记，另有 `consumedLockedUnits,granaryIds`；`locked` 引用实际 Item ID 和剩余锁量，剩锁总量 + consumedLockedUnits 必须为2，各在0…2内。锁量为0的条目删除，最后一份真实食物吃完同时删除 Item 根和容器引用。`reportItems` 是有时间戳的显示快照，不能消费；history最多128条。退款收据只记录 component ID 与真实已付材料定义/数量，不复制库存或HP；每个存续组件必须有且只有一份合法账单，读档拒绝删账单或伪造数目。

FOOD 整堆转移保留 Item 对象和 ID，部分堆拆出新的真实 Item，实际库存只存在于补给容器一次。额外食物可合入锁定堆，取出只能取未锁定后缀；共用 `WorldMaterialTransfer` 同样检查锁，不能借别的模块转移入口绕过。非堆叠装备保持 ID、附魔、诅咒和鉴定字段；容器内不自动食用、充能或回血。

5C1 已采用、5D1 继续保留的补给标记采用**不接受结构攻击或拆卸**的非战斗交互实体，只有明确撤营可解除锁；这是可逆策略，并非已经实现补给堆战斗残骸。普通箱沿底座掉落/残骸路径保存真实内容。撤营同一事务返回剩余 Item、移除补给/标记/空账本、释放 slot/region并恢复 native政策，保留访问层、节点/资源账本、高水位和有界收据。满背包拒绝撤营；本版未新增地面退粮降级路径。

建材来源只能是明确选择的背包或单个当前可见且可达的箱。选择的是**实际物品定义**；可使用已安装其他模块的匹配 `basic.*` 标签，床/箱可明确选择一件 `kit.bed/kit.chest`。不读 crafting JSON、不合并定义身份、不自动扫箱。实际付款账单用于 `floor(count × hp/maxHp × 1/2)` 退款；一件 kit 的全耐久拆卸仍退0件，不转换成免费原料。

## 来源、招募、住房和粮仓

本包单独启用即可产生真实普通单格候选：D1行脚人、D5园丁、D10行脚人、D15园丁，各首次可信entry尝试一次。按入口可达距离、y/x稳定选址，无新随机抽模板；避机器/保护/危险/已有足迹/世界对象/owned region等。无位第一次写deferred，下次真实entry仅重试一次，再失败skipped；placed/skipped/terminal不会因重访/拆建/日志淘汰补生。存档spawnSlots的status只有deferred/placed/skipped/terminal，attempts=1…2。未招募的自生候选友好留驻、和平等待，原生危险战斗优先，不自动追玩家过楼梯；不占居民人口额度，仍计原生实体预算。

救援来源在真实wasCaged→解救成为盟友的共用转换中登记，只准配置名单和当前普通单格资格。普通支配/任意isAlly、仍在笼内、克隆、限时召唤、无生命/液体限定/不能用楼梯/正在离队、bodyMember或非builtin:single/r0空间形态不准。救援仍遵循原生落carriedItem等效果；招募以救援完成后的同一个actor及对象图为基线，不再落物、不补HP、不清状态、不重授成长或制造装备。当前Monster没有居民装备管理系统。活的未消费救援来源≤64，与4个自生槽分计；达上限仍可正常救援成为盟友，但不登记新招募来源。已消费的来源不能遣散后重新招募，终结时GC来源组件，自生槽保terminal高水位。

招募前先在home营地建完好合法卧室床，并将真实粮存入粮仓。目标与home同层且在营地范围，当前直接可见、Chebyshev距离≤1、有交互线；玩家/目标存活、可行动、无忙态，招募时无当前可见活的非盟友非俘虏敌人。单营<16/全局<64、至少一张空合法床、粮仓FOOD份数≥该home现居民数+1才能报价。锁粮也计报价；成功报价不立即吃粮、不加锁，成功招募100tick且正常付时危险继续，No或拒绝0成本。

住房来自 `computeRooms` 的完整屋顶/闭合边界/bedroom房间中、营地内HP>0的床，且从营地标记的通路图至少能到相邻位。床是component ID，房间ID不持久；仍合法且唯一的床优先保留，其余居民actorID升序分配剩余componentID升序床，一床一人。结构变化会更新资格；失床不删居民，null床位合法。住房看home可用住所，护送居民仍保home床，不按人物此刻是否睡在床旁扣额。

粮仓集合始终包含marker的supplyId，可在居民页把本camp真实箱显式标记/取消粮仓。需当前层可见、相邻可交互和箱revision；补给堆不能取消，一箱不可归两营。只计原生FOOD `ration_of_food`或`mango`，quantity1=1份；作物MATERIAL、可食菌、玩家背包、未标粮箱、其他营地不算。箱毁坏移除粮仓引用，物品沿已有残骸保留，残骸不自动计日粮。空的仍合法箱不是额外免费食物来源。

## 真实日粮、双欠额与离队

唯一时钟 `world5.simulationTicks`；日界为32000的绝对倍数，每活居民每日1份；住房在每1000tick绝对边界评估。新人先结旧区间再加入，不补交入营前边界。在场、缓存home、护送都由同一home账本结需求；关闭游戏现实过夜、查看和load不会耗粮或产出。

日粮按营地slot升序、营内actorID升序分配。库存顺序为剩余锁定单位按ItemID优先，然后粮仓containerID/ItemID升序的未锁单位。真实Item quantity降低，同事务更新锁量、consumedLockedUnits、引用/revision与needs；不拆新Item、不为日粮分配新ID。初锁两份吃完不自动补锁；额外存粮仍可取未锁后缀，所有公开转移/搬运入口都检查锁。撤营只退真实剩粮0/1/2份及额外库存，不退已消费粮。

| 轴/派生 | 满足 | 不足 | 后果 |
| --- | --- | --- | --- |
| foodShortage 0…3 | 每日减1至0，unfedDays归0 | 每日加1至3，unfedDays加1至4 | 发粮前foodShortage已3且本日再次缺粮，非死亡离开 |
| housingShortage 0…3 | 每epoch减1至0 | 每epoch加1至3 | 仅住房不足不触发离队 |
| shortage（只读） | max(foodShortage,housingShortage) | 两轴独立 | 效率依0/1/2/3为100%/50%/0%/0% |

从初值0连续四个日界缺粮才离开；3档吃上一日降2后再缺只回3，不立即离开。修床/改班/换岗不重置欠额，床从3档恢复需三个满足epoch。2/3档不种植/经济搬运，仍可原生避险、护送、归位和守卫。

离队先取消工作/退款、移除居民索引/组件/需求/床与订单预留，释放人口；走底座非死亡departure与真实承载层落物，不发死亡/击杀事实。当前可见离队有300tick可见宽限，缓存/非可见直接按退役策略处理；长跳按实际离队绝对时点计算，已过宽限不再停留。死亡、资格丢失、多态、坠落、离层、终结同样清理相应真实引用，source消费事实不能回到未招募状态。玩家终局冻结需求和工作。长需求规划按有限库存整轮、余粮、短缺阈值与离队后的新人口处理，不逐日遍历漫长空区间；保余数/绝对事实/高水位的分段一致性。

## 在场岗位、班次和操作

打开居民页，从当前可见居民名册选中一人查看卡片；可见并选中不等于可操作。指派岗位、改班、遣散及驻留操作都需目标当前直接可见，玩家与目标Chebyshev距离≤1且有交互线，双方存活、可行动，并满足公开命令的资格与忙态门槛；指派岗位另需居民在home营地同层范围内。默认日程 `[16,8,8]` 为work/rest/watch，各单位1000tick，以绝对epoch模32定位；表单填工作/休整，警戒自动为32减前两段。三段必须都是正整数、合计32。改班不重置日界和需求欠额，也不赠送信用；若已有工作票据，会取消退款、销毁已累积信用并回idle，需要重新指派岗位。尚未接受票据的工作计划不能一概视为被清空。原生危险、战斗、失能始终先于岗位；无combat/growth/narrative仍可做基础岗位，无工作XP或属性加速。

| 岗位 | 面板选择与真实行为 | 完成/暂停/限制 |
| --- | --- | --- |
| idle | 选择闲置，通常走向home床旁并正常待命 | 不产物、不回血特权 |
| plant | 玩家先把settlement.seed存进本camp源箱；选源/目的真实chest及1…6个种植床component ID；居民走源箱邻位，100tick取种子进入escrow，再走种植床邻位 | 一次票据耗1种子、1000有效劳动tick产1件settlement.crop进目的箱；完工回idle，需重新下单，不自动完成所选6格或跨日续种 |
| haul | 源/目的为本camp不同chest，选真实Item ID和1…8件；非MATERIAL/FOOD/GEM只可1件 | 100tick取货、实际步行、100tick交付；整件保对象/ID/全部字段，部分堆拆真实Item；完成回idle。锁粮不可取，没有跨层或扫背包搬运 |
| guard | 用居民页共享方向/地图光标选择营地内可见安全坐标并指派 | work/watch和平归岗，rest走床旁；遇危险交回原生战斗，没有守卫产量/离线防御结算 |

种植床定义 `settlement.plot`：wood2+fiber1、300tick建造、HP100；每营最多12个，每人一次选择最多6个。作物/种子均MATERIAL、maxStack99；crop标签 `food.ingredient.crop` 供后续加工，不是日粮。正式接受须源种子、目的槽与退款槽可预留，完工每格按端点 `floor(tick/32000)` 记plotDays，当天同格只能成功一次。

低光采样为种植床格的 `LightMap.lightSumAt`：`max(0,r)+max(0,g)+max(0,b) ≤306`。按3通道各255的参考满量程，306/(3×255)=0.4；比较的是原始机械通道和，不做截断或屏幕亮度换算。水源扫描床周围dx/dy各−2…2（Chebyshev≤2），格须可见/有记忆/已探索且非机器；CellProperties为稳定地面、不阻行，baseMechFlags同时具ALLOWS_SUBMERGING/EXTINGUISHES_FIRE且无VANISHES_UPON_PROMOTION，临时洪水不算。接单前环境不符会保留工作计划并等待再次尝试，可显示water/light/plot-removed等具体资格原因；源空、满箱或预留冲突也属接单前停等，不造产物。已经进入planting后，水/光等环境资格失效会按interrupted取消票据、退款、销毁信用并回idle；当前卡片原因是interrupted，条件恢复后须重新指派。设施移除的公开拆卸路径也会取消关联工作，不承诺保留原票据等待设施恢复。

只有已接受planting阶段、work班次与当段有效资格的交集授劳动。整数信用 `q=floor((r+dt×eff)/100)`、余数取模100；100%需1000劳动tick、50%需2000劳动tick，走路/取货/失败等待/休整/警戒/战斗不授种植信用。rest/watch或效率0暂停同票据及escrow，恢复仍用原信用；进入planting后环境失格的interrupted取消不属于这种可恢复暂停。改岗位/班次/驻留模式会取消已有在途票据，原料退款、信用销毁；改班有票据时回idle，未有票据的计划不能一概说清空。受伤/失能/原生优先/目标移除/离层等中断不退款已付时间。原箱仍在则退原箱，原箱消失则同一真实物品落在home所在真实层的营地标记处；不复制货物或临时发虚假残骸。

护送在相邻可见居民卡点带路，0tick取消在场工作并切escort，之后依原生移动/楼梯正耗时跟随；stay和不合资格居民不跟层，玩家坠落不免费带整队。管理缓存层只允许合格已授权escort的楼梯倒计时/迁出，其余生态仍冻结。目标层无位保源层唯一actor/原物品和倒计时待重试；home归属/粮耗/人口不随物理楼层迁移。带回原营地同层真实范围，再相邻点击回营或驻留，0tick确认stay；不是远程回营寻路，也不迁居别营。护送期无工作信用、无离线生产。

## 公开命令与事务

结构操作统一入口为 `game.executeCommand('ext:command', JSON.stringify({module:'settlement',action,payload}))`。外壳仅 `module,action,payload`，payload v=1。适配器先纯验证，原生确认后重新验证 CAS，以 `transactStructureWorld` 原子提交模块状态、region/组件、容器/Item/ID、收据/消息和正耗时；No、过期、失败无机械成本。UI 不持有计划句柄，不直接写 Game。

| action | payload 在 v/stateRevision 基础上的键 |
| --- | --- |
| establish | inventoryStamp,x,y,bounds,food,sourceContainerId,sourceRevision,materials |
| expand | inventoryStamp,regionId,regionRevision,bounds,sourceContainerId,sourceRevision,materials |
| build | inventoryStamp,regionId,regionRevision,definitionId,x,y,sourceContainerId,sourceRevision,materials |
| retire | inventoryStamp,regionId,regionRevision |
| dismantle | inventoryStamp,componentId,componentRevision |
| door | inventoryStamp,componentId,componentRevision,open |
| transfer | inventoryStamp,containerId,containerRevision,direction,items |
| rest | restPointId,restPointRevision（无 inventoryStamp） |

`bounds={x,y,width,height}`；`food/items=[{itemId,quantity}]`；`materials=[{itemDefinitionId,count}]`；背包来源的 sourceContainerId/sourceRevision 均为 null。transfer 一笔可含多个实际 Item，direction 为 deposit/withdraw。harvest 与 cancel-work 继续使用冻结 WorldWork SDK1：前者 `v,nodeId,nodeRevision,inventoryStamp,destinationId,destinationRevision`，后者 `v,ticketId,ticketRevision`，没有营地 stateRevision。


居民命令使用相同外壳，但payload基础键是 `v=1,stateRevision,campId,campRevision`（campId为region ID，不能套用结构命令的regionRevision键）。除此只准下表精确键；targetRevision在招募时取source revision，其他取resident revision。公开targetId是操作目标，不是行动者授权。查看可见卡片不授予管理权限：指派岗位、改班、遣散、驻留/回营等目标命令共同要求当前直接可见、Chebyshev距离≤1、有交互线，玩家与目标存活、可行动并满足资格/忙态门槛；指派岗位另需居民在home营地同层范围内，驻留/回营仍须已真实到home。

| action | 基础键之外的精确键 | 成功耗时 |
| --- | --- | --- |
| recruit | targetId,targetRevision | 100tick，原生确认 |
| set-residence | targetId,targetRevision,mode | 0，mode=stay/escort |
| return-home | targetId,targetRevision | 0，必须已真实在home |
| assign-job | targetId,targetRevision,job,sourceRevision,destinationRevision,componentRevisions,inventoryStamp | 0，取消已有旧票据并指派新计划 |
| set-schedule | targetId,targetRevision,schedule | 0，有票据则取消退款/销毁信用/回idle；无票据不一概清空计划 |
| set-granary | containerId,containerRevision,enabled | 0，enabled为boolean |
| dismiss-resident | targetId,targetRevision | 100tick，原生确认 |

job严格为 `{kind:'idle'}`、`{kind:'guard',at:{x,y}}`、`{kind:'plant',plotIds,sourceId,destinationId}` 或 `{kind:'haul',sourceId,destinationId,itemId,quantity}`；位置x=1…77/y=1…27。idle/guard的sourceRevision/destinationRevision必须null、componentRevisions=[]；plant的componentRevisions与plotIds逐项对应，haul为[]；plant/haul两个箱revision均必填，所有assign-job都带实际inventoryStamp。UI刷新并取得这些值，过期命令拒绝。确认No、报价/准备/CAS拒绝为0耗时/0规则随机/0ID/0物化；不能凭手写JSON跳过距离或票据资格。

管理矩形和实际工作足迹分别校验。bounds 可包围天然岩石或被墙遮挡的未知格，不要求全矩形当前可见；尺寸、范围边界、region 唯一性、全局预算与巨兽预留不重叠继续检查。实际标记须当前可见、已探索或有记忆、邻近可达且安全；实际施工仍检查当前可见、机器/楼梯/终局/impregnable、危险、全足迹与逃生。扩张不得切开既有工作实体或演员足迹；隐藏边界冲突统一返回 C5_BLOCKED，可见冲突才返回 C5_PROTECTED，不揭示隐藏实体/机器详情。

正式床边休息只提交 `v,stateRevision,restPointId,restPointRevision`。面板在原生确认完成且 RestPoint 已启动后关闭；No、过期或距离拒绝保留面板并显示结果。原生满血休息可以立即停止而不耗时；需要恢复时通过原生 auto_step 正常耗时/饥饿/回血，Escape 可中断，不为验收注入伤害。

`StructureReadSDK` 是独立窄只读端口，worldSdk.ts/edibleSdk.ts 未扩展。只投影当前可见组件/箱/节点、可见完整房间、背包和自有营地引用。远方营地或当前未见补给只显示最后可见报告，查看/读档不触发离线结算、不推进规则 RNG。

## UI 与后续扩展点

面板含营地、建造、库存、采集、居民五页；可选择实际材料来源/kit、两份食物、地图/方向光标、设施、存取/休息/撤营。草稿按 y,x、floor/barrier/roof/fixture、定义ID稳定排序，每格各发一条公开命令和原生确认；遇 No/危险/失效/缺料停止，已建保留。关闭/blur/load/seek/session替换清空显示队列；DialogService/DialogHost/DialogInput仍是模态屏障，ACK忙时由宿主隐藏根，保留旧DTO和显示队列但暂停施工；恢复展示边界后才重验/独立确认下一格，不展示未来状态。

无本层营地时，营地页可直接输入标记坐标、用方向按钮或地图选址，并预览初始9×9范围。标记有界 x=1…77/y=1…27，矩形起点钳制在地图内并保留9×9（x=1…69/y=1…19）；展示、轮廓、确认与付费命令使用同一 campTarget，切页不受建造 cursor 影响。选址/草稿只改显示状态，失败不扣料/粮/时间。

营地/合成是非模态抽屉：展开或收起时抽屉外原生键盘/DPad移动沿唯一命令入口，不自动关面板；施工选格只拥有其方向键，表单键不漏给玩家。合成仅拥有抽屉内控件键与 Escape；原生 SELECT 默认操作保留。打开抽屉取消长按并公开中断正在进行的自动行动，抽屉打开期间暂停自动调度；真实 DialogInput/确认/ACK 仍优先。已提交的推进/展示后缀继续完成，相机仍更新。

普通和沉浸共用实际可用地图视口与同一逆变换。移动端抽屉最大min(36dvh,320px)，收起52px；桌面右栏370px；建造/合成抽屉均预留 shell 空间。四模式从最终已显示字符映射墙/门窗/顶/床箱的汉字与纯矢量，不查隐藏绑定；后发火/楼梯优先于结构。画布固定测量原点，图层自身居中/跟随；本地纯函数验证不等于真实像素验收。

折叠按推荐仅支持≤700px，桌面隐藏营地收起按钮，与合成一致；窄屏收起状态由 UI session 管理，清选格/草稿并恢复地图空间，展开后恢复当前页选格。此为可逆显示选择；真实桌面/窄屏几何仍须指挥固定构建验收。

## 有限生产订单（5D2）

居民名册选择配方、源/目标箱、设施和批数（1…16），提交 `order-work`；已有订单可 `cancel-order` 或 `resupply-work`。居民须在所属营地、stay、可见相邻、健康且无原生优先动作，命令带营地/居民/箱/工位/田地revision及库存stamp；No/陈旧/坏输入不扣物或时间。接单锁定全单真实输入escrow、工具及输出/退款槽，满仓先拒绝。未知/远处箱仅列公开身份，不投影隐藏物品。

| 配方 | 实物输入 → 输出 | 有效劳动及限制 |
| --- | --- | --- |
| farm | 1种子 → 1作物 | 1000tick；每人最多6格，每格每绝对营地日最多1作物；实际水/暗光/路线资格 |
| hunt | 无输入 → 1肉 | 1000tick；每人每天最多2肉，受真实劳动约束 |
| cook-crop | 3作物 → 1普通口粮 | 500tick；station.hearth |
| cook-meat | 2肉 → 1普通口粮 | 500tick；station.hearth |
| cook-mushroom | 5份带food.ingredient.mushroom标签食材 → 1普通口粮 | 500tick；有foraging时列出；生/烤/不同种可混合，焦炭不可用 |
| crafting目录 | 当前公开offlineEligible配方的原账单与产物 | 当前chest-kit/bed-kit；已知合法crafting工位/工具，不授权任意玩家命令 |

蘑菇加工不触发食用、揭示、火接触或原有效果；产物为原生ration_of_food固定模板。没有foraging仍有作物/肉循环，没有crafting仍可建settlement基础灶台。crafting通过同步只读 `crafting.recipe-catalog.v1` 提供目录，缺席/unsupported降级，坏输出/异步/异常/越权显式拒绝并回滚。

每单总寿命32个绝对1000tick经济周期，包含停工；load/返回/查看不刷新。日界先消费真实粮仓口粮及判住房，再以100/50/0/0效率结劳动；本周期完成的产物只在下一周期实体入库，不能同周期被后单或日粮消费。离场仅计别层真实simulationTicks；冻结设施/危险/路线，扣旅行和work/rest预算；长尾最多32生产周期加一次交付，再闭式结需求。绝对日配额独立持久，不因取消/换单/续工重置。

危险/失能/缺料/需求不足会停工；danger保票据/escrow但须合格公开补给才能继续。寿命耗尽needs-resupply，补给分配新planId并保未完票据/余数；取消/死亡/拆除只退款一次。已赚但待次周期产物不提前兑现；目标箱毁坏后保原截止时间，在原位置形成唯一真实地面Item。存读/seek仅重建；回放面板只读，替换session清草稿，同值DTO保草稿。

## 居民查询、存读与尚未实现的范围

`settlement.resident-status.v1` 已实现：严格输入 `{actorId: 正安全整数}`，且只能有这一个键；严格输出 `{resident: boolean}`。查询实际 `resident` 组件是否存在，不恒返 false，不包含岗位/欠额/来源详情，也不以普通 isAlly 判断。招募及解除后在可信提交中触发 resident-changed；查询本身不补算需求、不推进时间、不生成候选。当前固定源未安装生产 foraging，不能把中性消费者查询验证写成真实 foraging 联动验收。

存档中 world5.residents 只索引归属与人口；模块 resident 组件保存 `campId,campOrdinal,revision,mode,bedId,schedule,job,stopReason`，source 组件保存 `schema,key,kind,consumed,revision`；home ledger.residentStates 唯一保存需求数值。在途材料只由真实 escrow 容器持有，native bundle 是唯一倒计时来源，信用/余数存 residentJobs。原生 actor 的 HP、位置、状态和 Item 内容仍由实体根持有；不复制到名册。

读档先在候选对象图核验格式/manifest/指纹、actor/source/home/slot ordinal、床/粮仓、锁守恒、岗位/票据/escrow、容器 Item 的唯一归属，再替换旧 live。缺床位 `bedId=null` 是合法住房短缺；引用不存在或不合法床、重复床、孤儿来源或居民、双重库存等被拒绝。load/UI/seek定位本身不消费粮、不生成或离队；seek重放真实命令则正常推进。旧 foundation/state/规则身份不匹配直接拒绝，无旧档迁移。保存来源和续录仍使用 RecordingOrigin2；受控场景的 from-save 录像与真实 fresh 新局录像分列，不能互相代替。

所有状态输入通过公开命令并记录原生确认；NPC工作沿同一个 actorActions 调度器，不嵌套玩家命令或建立第二时钟。劳动按半开区间计算，在端点先封存信用，再结 FOOD/住房/离队，随后合法工作完成入箱，最后选下一动作；同刻刚搬入的粮不倒填本次日粮。失败回滚以该最外层同步事务入口为准，保留入口之前已付的原生时间/效果；需求失败未结清前不放行后续信用和生产。退款失败恢复退款事务并暴露失败，不吞掉材料。

5D2已接入有限生产订单、完整农田、猎人、厨师及可选crafting。玩家不能直接合成FOOD；作物/肉先交厨师加工成普通口粮，进入目标粮仓后由原日粮消费。供应链通过真实源/目标箱和次周期可用库存串接，每个订单需显式下达；没有无限自动重订或跨层物流。5C2 site、5D3 narrative 随身招募、5F世界地图/Worker尚未提供；5E1普通袭击与修缮见下文，大型袭击另立5E2。

[5C1执行报告](phase5c1.report.md)保留当时验收事实；[5D1任务书](phase5d1.task.md)及[5D1报告](phase5d1.report.md)记录本轮范围和阶段证据。本文不把历史通过次数转述为5D1整体通过；V12正式16居民普通净增P95为3.672584ms（门槛≤5）、64居民冷+7暖峰值46.777167ms（门槛≤50），两项实际通过；测试旧前提独立窄复核已通过；实际浏览器和父最终验收尚未完成。最大8营地/3072结构格/满箱、完整体积矩阵、全量 npm test/全部test:ext/全组合和物理删除矩阵归5Z，真实手机另列。


## 营地袭击与修缮（5E1）

新局勾选“允许营地袭击”启用，默认关闭。本局开关写入 manifest.modules[].configuration，存读、回放和 seek 依存录重建；游戏内没有开关。未启用 settlement 时没有此项或袭击实体。规则默认1000 tick周期、建营32000 tick宽限、2000 tick预警、事件结束32000 tick冷却；每营一个事件、全局最多四个待展开/在场事件，第一批最多八个普通单格原生怪物。

离层前已经物化的同一批入侵者冻结在原层，返回续打；已有combat预警/动作保原ID、阶段剩余与锁定格/资源，不在缓存层释放攻击，返回后下一实际推进继续。营地显示“被围”：冻结期间所有离线劳动、产物交付、需求扣粮、欠额、离营和袭击摘要暂停。返回本层仍须实际结束袭击；仅返回、菜单、换岗或取消订单均不解除被围。暂停时间从营地有效经济时钟排除，恢复不追补，也不刷新订单32周期寿命、日配额或粮食日界；其他营地和全局时间继续。

尚未物化的离场事件只结算一次有限物资/耐久损失，不隐藏跑战斗、杀居民或生成残敌。连续离场不再结第二次；玩家实际进入营地region才确认报告并重新武装，后续仍有冷却。远营只显示最后报告，现场精确损失在回营后呈现。

建造面板中，仍存在且受损的部件提供“付费修缮”。确认预览列出部件、恢复耐久、真实材料和tick；耗材按建造配方乘修复比例逐项向上取整，耗时同比例且至少100 tick。走原同步付费施工事务及所有权/距离/revision/CAS，No、陈旧计划或writer失败不免费恢复HP。已毁坏的部件按原建造命令重建。

本步尚未提供大型袭击、自动修缮、战争或远征。5C2/5D3继续后置，5Z前范围待定；实际验证和覆盖限制见[5E1报告](phase5e1.report.md)。
