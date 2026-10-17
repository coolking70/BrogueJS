# loot 配置与操作手册（phase6 当前实现）

核对候选 `06682d5`，2026-10-17。模块默认关闭，启用时默认 `standard`；推荐 growth，但可显式关闭推荐并仅启用 loot。三档预设在新局冻结，局中不可改。功能、性能与人工验收分开，见 [6Z报告](phase6z.report.md)、[统一人工清单](phase6z.manual-checklist.md)。

## 目录、schema 与扩展入口

入口 `src/ext/modules/loot/descriptor.ts` → `definitions.ts` / `schema.ts` → `catalog.ts` → `generator.ts` / `item.ts` / `index.ts`；全部 JSON 在 `src/ext/modules/loot/data/`。`loadLootPack(raw?)` 严格校验全部文件后复制并深冻结；默认目录缓存，不能在运行中修改。完整类型以 `types.ts` 的 `LootPack` / `LootRawFiles` 和 `schema.ts` 的精确键、引用、范围检查为准。

| 文件 | schema | 配置职责与主要字段 |
| --- | --- | --- |
| bases | 1 | ilvlBands、weaponTierWeights、weapons(baseId/tier)、armors(baseId/weights)、rings(baseId/weight)、ringImplicit |
| ilvl | 1 | ilvlPerDepthBp、min/max、siteIlvl、sourceBonus、classBonus、championBonus；site 值仅协议预留 |
| tiers | 1 | tiers(tier/minIlvl/enabled)、window(size/weightsHighToLow)；T1–T6 开放，T7 关闭 |
| rarities | 1 | 六稀有度的颜色/marker、词缀数上限、enhancementCap、droppable；词只由满孔顺序匹配产生 |
| affixes | 1 | id/nameKey/position/itemClasses/group/weight/polarity/maxTier/tiers/modifiers；requires/fallback/expand/rune/tags；runeFamilyEnabled 已开放 |
| uniques | 1 | 8 唯一品及 bossUniqueBias；baseId/minIlvl/weight、固定 rows，未扩编到16 |
| sets | 1 | 两套×四槽 pieces，累计 count 阈值 bonuses；同件双戒不重复计件，不同件可计两件 |
| runes | 1 | ka/ul/tal/ren 四符文，itemClasses/weight/minIlvl/rows |
| runewords | 1 | ash/edge 两词，baseClasses/sockets/sequence/rows；严格顺序与满孔匹配 |
| sockets | 1 | 18 武甲基底，各 bands(minIlvl/maxIlvl/weights[0…4孔])，戒指不可开孔 |
| runeDrops | 1 | rows(id/presetId/source/chanceBp/count/runeIds)，kill/encounter 副表；同 preset/source 唯一 |
| monsterClasses | 1 | defaultClass/classes/members(typeId/class)、leader/champion 修正 |
| dropTables | 2 | tables(id/priority/match/chanceBp/count/classWeights/rarityBonusBp/minRarity/ilvlBonus)；part 的 bodyDefinitionId/partIds 来自公开目录 |
| gold | 1 | amount、byClass、encounter；独立金额/来源概率 |
| presets | 1 | 转化、掉率/稀有权重与物等缩放、词缀数、encounter/vault 保底、寻宝/腐化、熟悉度、金币/分解倍率、monsterScaling |
| enhancement | 1 | caps、weapon/armor/ring 每级贡献、atCap 精炼和非 loot 原生 +1 |
| identify | 2 | familiarityMultiplierBp/ceil、scrollRevealsAll、firstTriggerReveal |
| corruption | 1 | eligibleRarities/maxTotalAffixes/negativeRuneFallback、补偿 tierStep/maxTier、nativeCursed |
| salvage | 2 | shardItemId/maxStack/base/ilvlStep/corruptedMultiplierBp/minimum/exchange |
| stationOperations | 1 | station.forge，operations(id/kind/mode/workTicks/shardCost) |
| caps | 1 | stat/scope(loot-sources 或 final)/min/max/unit；不能拿显示单位覆盖内部值 |
| rareNames | 1 | first/second 本地化名称片段 |

所有概率用基点（10000=100%），权重按相对值取样；范围是闭区间整数对。随机词缀按 group 去重，modifier 的 valueIndex 引用该行 ranges；stat 必须是公开声明键，conditions 仅支持已声明条件，不能添加任意可执行表达式。词条最多六随机/八固定，孔最多四；稀有度、腐化、孔/强化组合仍须通过实例校验。

同优先级、同来源且可能同时匹配的掉落表拒绝；闭区间边界相交、通配、概率为零都不能绕过。不同 priority 可重叠。floor/vault 保持原转换路径，craft 不走普通 DropTable，site 无玩法入口。不要依靠数组顺序掩盖歧义。

## 预设及冻结数值

| 项目 | scarce | standard | bountiful |
| --- | --- | --- | --- |
| 地面转换 bp | 10000 | 10000 | 10000 |
| kill 倍率 bp / 每次上限 | 6000 / 1 | 10000 / 2 | 20000 / 3 |
| normal/magic/rare/unique/set 基础权重 | 850/120/27/3/3 | 700/220/70/10/10 | 480/330/160/30/30 |
| encounter 件数 | 1 | 2 | 3 |
| 金币 / 分解倍率 bp | 5000 / 10000 | 10000 / 10000 | 15000 / 7500 |

物等按深度×1.5向下取整，叠加来源/怪物类/champion加值并钳制1…99；part 来源+2。物等1–11的0…4孔权重为70/20/10/0/0，12–26为50/20/20/10/0，27–99为40/15/20/15/10。正常武甲终端抽孔，戒指与非normal不抽孔；固定区间和单候选不耗骰。

`monsterScaling` 保持目录原值；M4怪物侧平衡、TTK/EHP及统计结论整体延期。三档数值是配置事实，不代表已完成平衡验收。

## 玩家操作与知识

- 装备四槽：武器、护甲、左戒、右戒；用实际 `executeItemCommand` 替换/卸下。比较由真实属性管线 `hypothetical(knownOnly)` 投影，包含套装阈值变化，未知项不参与已知收益；容量增加不补满，下降钳制。
- 背包/检视详情读取 `readLootGameView`，纯查询零事务/零RNG。未拾取、未知戒指、部分已知、幻觉分别投影；part 仅在允许的完整鉴定视图显示通用来源，不泄露 body/part 秘密。
- 五档拾取过滤：normal/magic/rare/unique/set，类别及金币选择是0tick命令；手动拾取可以越过过滤。标准/丰饶默认最低 magic，会留下普通装备；希望全部自动拾取时选 normal 并勾选武器/护甲/戒指。未鉴定不妨碍按公开稀有度和类别过滤；自动探索不会再追逐被过滤物品，改变过滤后立即重新纳入目标。草稿不被轮询覆盖，同值不重复记命令。
- 分解：单件或1–26件批量；已装备/粘装、地面等非法目标拒绝；唯一品须确认。基础碎片 normal1/magic3/rare8/unique20/set20/runeword8，再按物等、腐化和预设计算；未知物品展示合法区间，不能反推秘密。碎片堆叠99。批次失败原子回滚，不部分扣费。
- 碎片鉴定：10碎片、100tick，一件仍有未知信息的合法目标；已全知/缺费/陈旧CAS拒绝。卷轴鉴定和熟悉度仍沿原生桥接；首次真实有效触发仅揭示匹配行。
- 强化/精炼：实际附魔卷轴成功后才消费。normal/magic/rare/unique/set上限10/8/6/4/4；runeword上限0。武器每级本地伤害+1000bp、每3级原生附魔+1；护甲每级HP+5及内部防御+5；戒指每2级implicit+1。到上限随机正词缀精炼取较高值，全满拒绝，负面保留。非loot走原生+1；已嵌符文不能强化。
- 插槽符文：材料获取/拾取/99堆叠后，按顺序追加至合法孔，成功消耗1符文与100tick；取消/陈旧revision不扣费。ash=护甲2孔 ka→ul；edge=武器2孔 tal→ren。4孔中的2符文前缀不成词，反序不成词；成词替代单符文行。
- 工位：建造真实锻炉，未装备合法物品与碎片交WorldWork托管；unsocket-last、unsocket-all、reforge各10碎片/100工作tick。拆最后/全部返还对应符文；重铸保持冻结限定边界，不提供任意改物权限。失败/取消退款、满包/预留、跨层/死亡/provider异常走宿主单所有权事务；UI用rowId/revision CAS提交。箱内只读，仍用原取回入口取出。
- craft：crafting公开两锻炉配方，loot启用时走可信完成票据ordinal、固定基底，品质≤magic；loot关闭时产plain +0已知装备。craft 不冒用 kill/part 掉落接口。
- 原生随机符文：21随机/4固定符文已在6B4接入真实效果与知识；与上面的四种插槽材料分开。随机符文的目标/强度仍受原生可知性约束。

## 来源、能力与持久合同

floor/kill/encounter/vault 沿宿主真实来源及原接纳事务；唯一/套装仅实际接纳后记获得收据。part 在自然敌对非复制核心出生时，宿主冻结原body有限部位资格；直接成功破坏消费一次，概率失败/无空间亦消费。召唤/克隆/split/scripted 不授予；换形/phase/split保守撤销未用资格，临时成员ID和返回原形不能重领。两body为 shale-weaver的8腿、copper-tendril的4肢，2500bp/1件/40:35:25，无金币/符文副表。再生关闭，site待前置世界任务。

loot通过 `combat` 公开键、`growth.attributes.v1`、`foundation.item-bodies.v1`、WorldWork/item SDK 取能力；缺能力按词缀 replace/omit fallback、缺body目录去掉part表，不私引模块实现。静态pack含原生符文目标目录；有效目录指纹包含实际能力集合与目录，配置与规则指纹进入manifest，不能手改存档头绕过。

当前：foundation20/itemSdk4/worldSdk2/world schema6/edibleSdk1；loot module与rules0.9.1、pack0.6.0/schema5、实例v6/state2；growth1.10.0、crafting1.1.0/definitions schema2；whole-run7/recording4/origin2。旧版本严格拒绝，不迁移。0.9.1因过滤物品的探索路径语义修正升级，0.9.0存档/录像不接纳；本轮相关测试与回放证据见[1018试玩报告](playtest-1018.report.md)。原0.9.0七组合证据仍按原版本引用，未在0.9.1重跑；人工效果见U01–U18。

## 添加配置的步骤与硬预算

1. 在对应JSON增条目并补`locales`完整nameKey/descriptionKey；ID稳定、引用闭合、权重及范围有界。新增词/符文先校验基底类别/孔数/完整顺序，不直接写实例中的派生word ID。
2. 通过`loadLootPack(raw)`与`buildEffectiveLootCatalog`，分别检查能力存在/缺席；为新目录准备合法、非法、同priority相交、顺序不变和缺能力样例。不得修改守卫、放宽预算。
3. 经原公开命令/来源和真实接纳验证，核对未知显示、四槽比较、失败全图回滚及同版本存录。必要身份变化按合同升级并拒旧，不造兼容迁移。
4. 按源码影响选测试，更新模块自有test-suites和test-dependencies；变更冻结规则需另行维护者裁定，本文不是调数值授权。

单件owner≤4KiB、moduleData总计≤8KiB、JSON深度≤16、loot state≤4KiB、工位operation≤1KiB；每件属性行≤24/provider≤256，默认最坏武器11/护甲8/戒指6，四槽31+4cap=35。每件抽骰≤64/事件≤512；掉落表≤256。根容量7168准入/8192完整检查保留原语义，不给原生历史增长设新8192硬读档上限。整份save/recording不自创总大小上限。

正式性能沿B4/C1/C2冻结预算和原例外；C3/C4运行结果待维护者补录。6Z仅增加0/1/4孔与匹配/不匹配、100次只读计数/体积见证，不用本机时延宣称云端通过。D22+、手机真机、最大居民/结构/长局均未覆盖。
