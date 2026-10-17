# 6C0 共同合同与冻结候选

> 6Z 当前索引（2026-10-17，候选 `06682d5`）：当前身份 foundation20/itemSdk4/worldSdk2/world schema6/edibleSdk1；loot0.9.0、pack0.6.0/schema5、实例6/state2，crafting1.1.0/definitions schema2、growth1.10.0，whole-run7/recording4/origin2。现行增量见 [loot配置](loot-config.md) 与 [合同差异](phase6z-contract-delta.md)；以下有日期的旧章节是冻结历史，不追改数值或历史通过数。6Z实绩见[报告](phase6z.report.md)，浏览器/性能不因功能提交自动关闭。

2026-10-16，`ext/phase6` / `057abf2`。依据 [6C任务单 §3.1](phase6c.task.md#31-c0-交付) 和维护者 C-D1..C-D8 全采纳裁定。**本文件是待维护者冻结的具体合同；本步只交文档，不注册目录、改运行版本或接通玩法。** 下面的新增字段、配置和接口都是后续 C1–C4 的实施目标，不是当前 SDK 已有能力。原设计示例不能覆盖本表；所有新增数值为 C0 起步配置，未做平衡验收。

## 1 当前事实、优先级和交付边界

优先级沿任务单 §1。读过根 AGENTS、HANDOFF/development/architecture、ext README，6A/C6 与 loot 核心/UI 合同、6B1–B4 任务/报告及 B3/B4 合同、P0/P1/P2 报告；历史设计/numbers/tuning 固定读取 `93523fc596b173396a0d526ab2073b327ff7cf3e` 的三个原文。工位另核对 [C5 §5.3–5.6](phase5a-contract.md)、实际 WorldWork 与 SDK。

| 057abf2 代码锚点 | 实际能力 / C0结论 |
| --- | --- |
| `src/ext/modules/loot/types.ts`、`item.ts`、`session.ts` | 实例v2；setId恒null，sockets=0，socketed=[]；四来源。state1含8位uniqueMask、watermark，无套装收据 |
| `src/ext/itemDrops.ts`、`itemSdk.ts` | 每owner登记≤128收据ID，宿主32位hex串；逐件接纳后记账。可容纳首批8唯一+8套装件，无需C1扩位图或另开套装掉落服务 |
| `src/engine/Core/ItemCommands.ts`、`src/ext/itemSdk.ts` | prepare纯；只有create/filter/salvage/identify，不能把socket伪装成identify；受控消费与自有数据更新机制可复用 |
| `src/engine/Core/WorldWork.ts` 的 escrowInputs、`WorldWorkValidation.ts` 的 `escrow native` | 当前按worldItem定义扣料；不接受裸原生装备托管。不能通过给装备补worldItem伪装绕过 |
| `src/ext/worldSdk.ts` RecipeDefinition/TimedWorkRequest | 无装备目标、改造输出或lootRoll；票据已有完成序号、输入托管、输出/退款预留及行动bundle时钟 |
| `src/ext/modules/crafting/data/definitions.json` | 只有桌/炉，无forge；dagger与leather_armor已有固定+0已知装配配方 |
| `src/ext/partBreak.ts`、Game的resolveBodyMemberHit/finishBodyMemberDamage | 已有可信部位破坏与单provider `combat.part-break.v1`；该provider无奖励/RNG权。新掉落应在破坏事务内独立发布事实 |
| `src/engine/Movement/BodyGroups.ts` | 成员generation恒0，appliedBreaks持久且有界，连锁退休不是直接击破；再生关闭 |
| `src/ext/worldBasics.ts` 的 requireDungeon、`WorldWorkPlacement.ts`、world5.ts | site有LevelRef/放置形状预留，执行仍拒非dungeon；未发现可达site产出入口。按C-D5延期site玩法接线，C4只交协议/拒绝无入口测试 |
| `src/ext/world5.ts` | 实际schema5，任务单旧schema4已纠正；本步没有格式变更 |

B4-5已由维护者依据云端run **38860207834** 关闭；沿[报告末节](phase6b4.report.md#b4-5-维护者裁定关闭2026-10-16)及冻结 `scripts/ext-perf-6b4-budget.json`。冻结后仅复查原三轮校准数据、无第四次独立回放是已知限制，不转为C1豁免。D7浏览器、M4/14项平衡遗留保持；唯一仍8件、T7关闭；6Z为普通收口。

## 2 目录形状与编码边界

所有目录准入一次完成：严格对象键、稠密数组、有限安全整数、合法所属ID与i18n键、无未知字段/重复ID/危险键/函数/getter/非法引用。schema是文件级，不要求未改文件一起升号。目录冻结后建立索引；查询不重验目录。`ranges`、`ModifierSpec`沿现行纯包，固定值用`[n,n]`；`rowId`唯一，`valueIndex`必须指向本行值。

| 新文件/字段（拟置于loot/data） | 精确逻辑形状与限制 |
| --- | --- |
| sets.json | `{schema:1,sets:[{id,nameKey,descriptionKey,pieces:[{id,nameKey,descriptionKey,baseId,minIlvl,weight,rows:[{rowId,ranges,modifiers}]}],bonuses:[{count,rows:[{rowId,ranges,modifiers}]}]}]}`；≤32套、每套1…4件，首批都4件；count为2/3/4，严格递增、≤件数。固定件行≤8，阈值各≤4行；阈值range必须定值，不另掷/保存奖励数值 |
| runes.json | `{schema:1,runes:[{id,nameKey,descriptionKey,itemClasses,weight,minIlvl,rows}]}`；≤33；id同时为MATERIAL definitionId；itemClasses非空且仅weapon/armor，rows≤4且定值；worldDefinitions.items按同ID登记、maxStack99、无moduleData |
| runewords.json | `{schema:1,words:[{id,nameKey,descriptionKey,baseClasses,sockets,sequence,rows}]}`；≤64；sockets1…4且等于sequence.length，引用已登记rune且类兼容；每词≤8定值行。按(类别,孔数,完整序列)建唯一索引，重叠类别造成的同键歧义拒绝 |
| sockets.json | `{schema:1,bases:[{baseId,bands:[{minIlvl,maxIlvl,weights:[w0,w1,w2,w3,w4]}]}]}`；恰覆盖现行12武器+6甲，无重复基底/重叠或空档；非负整数且每段正权重和>0。戒指固定0、不入表 |
| stationOperations.json | `{schema:1,stationTag:'station.forge',operations:[{id,kind,mode,workTicks,shardCost}]}`；kind=unsocket/reforge；unsocket的mode=last/all，reforge的mode=null；三条目录见§5，封闭操作种类，不是任意脚本 |
| 新来源表 | 沿DropTable的priority、match、chanceBp、count、classWeights、rarityBonusBp、minRarity、ilvlBonus；C4新增part的bodyDefinitionId/partIds匹配；材料副表与装备表分开，见§4/§6。来源、概率/数量上限均准入校验；同priority同匹配的歧义拒绝 |
| crafting配方 | 在其公开RecipeDefinition增加可选`lootRoll:{maxRarity:'normal'|'magic'}`；只允许恰一件受支持native装备输出，不能套到材料/食物/多个输出；没有该字段沿旧行为 |

预算保持单owner≤4096 UTF-8字节、moduleData总≤8192字节、≤4 owner、深度≤16、loot state≤4096字节；每件≤6随机行/≤8固定行/≤4孔。数字与文本均计入实际编码，不以平均体积代替最坏合法实例。总收据ID **unique数+全部set件数≤128**（首批16）；32套×4件再加8唯一的136配置应拒绝，32是独立套数上限，非保证所有上限可同时取满，不暗扩宿主预算。

每新行至多4个ModifierSpec；展开后须同时满足现有**24行/装备、256行/provider**及总预算，准入按最坏四槽组合（含强化行、单符文/词替换、阈值）检查，超限拒绝而不是查询截断。最多4件×4孔的小集合与最多两套的阈值求值。`src/engine/Stats/ItemStatPolicy.ts`要求equipment行sourceId以`loot.item.<已装备ID>.`开头：本件行用`loot.item.<itemId>.row.<rowId>`；每套以当前已装备成员中最小itemId为锚，奖励用`loot.item.<anchorId>.set.<setId>.b<count>.<rowId>`，每阈值仅一份，并计入锚件24行预算。knownOnly先按已知件身份过滤再选锚/计数，机械投影用全部成员；不借environment层绕过装备守卫，不依赖遍历次序。逻辑展示来源仍是setId+count+rowId，换锚只改宿主归属，不产生额外奖励。全局loot cap与原物化账本同算，升容不补、降容钳制。

### 2.1 实例、收据与非法组合

C1在v2形状上激活`setId:string|null`，新增必填`pieceId:string|null`和`identityKnown:boolean`，版本v3；非set两字段必须null。set的uniqueId/nameParts均null、corrupted=false、sockets=0、socketed=[]；affixes恰为目录固定rows按原序映射，tier=0，values在ranges内。件ID全局唯一，setId指向所属套，baseId/minIlvl必须匹配。件身份不能从原生基底猜测（两枚同基底也可为不同件）。set出生identityKnown=false；完整鉴定/熟悉度才置true且全部行known=true，单行触发即使已揭示最后一行也不置true。非set的C1实例identityKnown必须等于旧affixes.every(known)，保持原规则。宿主原生identified与模块itemKnowledge.known必须按该值一致校验；不再对set硬套“所有行已知=完整身份已知”。强化0…4，出生0，固定行可沿6B4精炼取大，首批定值行全满则拒绝精炼。

这些新增布尔/身份字段和原生知识一致性均在create/update/save/load验证，缺字段或矛盾拒绝，不load补默认。套装首次触发通过现itemKnowledge.trigger/reveal/known适配，不能只改validator而遗留宿主identified派生；原生否定/鉴定尾处理也须保持两者一致。

C1 state2新增`setMask`为32个小写hex字符，按setId/pieceId字典序映射、未用位必须0；保留uniqueMask及原八唯一目录顺序。宿主uniqueCatalog拼接原8唯一ID+规范排序pieceId，同一平行uniqueIds栏使用不同命名空间区分两种收据；validateReceipts逐项核对双侧。只在实际接纳时记对应位；同批提案中临时占用防重复，跳过件不永久占用；丢弃/分解不退收据。宿主结构不变、无需C1 foundation升号。

C2实例v4：sockets变0…4、socketed为有序rune definitionId数组，长度≤sockets。**序列是权威；runewordId不落盘**，由冻结匹配索引派生。满孔匹配必须rarity=runeword；未满/不匹配必须normal，不能load时修复。normal/runeword的affixes=[]、uniqueId/setId/pieceId/nameParts=null、corrupted=false，无targetClass；有符文时enhancement=0，runeword cap0，非normal/runeword仍禁止孔和序列。戒指有孔、非法rune、错类、超孔、成词后仍normal、词缺完整序列、强白底镶嵌均拒绝。重复rune合法（例如ka,ka不成词），不是重复字段错误；同序列定义两个词才非法。

材料无模块实例；序列和词奖励从主动命令产生，效果已知，不新增每孔known位。底材完整实例知识用继承的identityKnown保留，原生identified与它一致；kind知识仍走宿主现全局知识。normal出生沿原规则identityKnown=true，主动镶嵌/拆卸/成词保持接单前值；完整鉴定才可置true。禁止用affixes为空或rarity=runeword自动鉴定。更新路径不得全量deriveNative覆盖被削弱/否定后的原生附魔、旗标、力量需求、熟悉度或诅咒。C3实例v5拓展origin接受craft；C4实例v6拓展part及site协议，具体联合见§6；不存派生套装件数、runewordId或物品副本。

## 3 C1两套×四件及经济配置

表中id为完整ID（件的`id=pieceId`）；所有件minIlvl=6、weight=100、仅一条固定行r0，range为列示值的定区间。nameKey/descriptionKey统一 `ext.loot.<去掉loot.的完整ID>.name/.description`，rowId=`<pieceId>.r0`。无职业限制，无growth/combat依赖。

| setId / 中文名 | pieceId / 中文名 | baseId | 固定行：stat / category / unit / value |
| --- | --- | --- | --- |
| loot.set.wanderer / 行旅者 | loot.piece.wanderer.blade / 行旅短剑 | sword | native.accuracy / increased / bp / 1000 |
| 同上 | loot.piece.wanderer.coat / 行旅轻甲 | leather_armor | native.max-hp / flat / int / 10 |
| 同上 | loot.piece.wanderer.lamp / 引路之环 | ring_of_light | native.resist.fire / flat / bp / 1000 |
| 同上 | loot.piece.wanderer.watch / 守夜之环 | ring_of_awareness | native.max-hp / flat / int / 10 |
| loot.set.bastion / 壁垒 | loot.piece.bastion.mace / 壁垒钉锤 | mace | native.physical-damage-dealt / increased / bp / 1000 |
| 同上 | loot.piece.bastion.mail / 壁垒锁甲 | chain_mail | native.defense / flat / display-armor / 1 |
| 同上 | loot.piece.bastion.vigor / 坚韧之环 | ring_of_regeneration | native.max-hp / flat / int / 10 |
| 同上 | loot.piece.bastion.guard / 护卫之环 | ring_of_transference | native.resist.poison / flat / bp / 1000 |

戒指本体仍由ringImplicit(ilvl)派生一次，以上固定行不重复加本体。`native.defense/display-armor`经现适配×10进入native.armor-base；没有新属性键。

| 套装 | 2件（b2.r0） | 3件（b3.r0） | 4件（b4.r0） |
| --- | --- | --- | --- |
| wanderer | native.move-speed / increased / bp / −1000 | native.max-hp / flat / int / 15 | loot.rarity-find / flat / bp / 2000 |
| bastion | native.max-hp / flat / int / 15 | native.resist.fire / flat / bp / 1500 | native.physical-damage-taken / increased / bp / −1000 |

rowId=`<setId>.b<count>.r0`。阈值累计，4件同时取2/3/4行；3→2丢3件行，4→3丢4件行。按已装备不同pieceId计数；双戒同件计1，不同件计2，库存/箱/escrow不计。两个2件混套各得自己的2件奖励，不满足任何3件门槛。

| 新配置 | scarce | standard | bountiful | 解释 |
| --- | ---: | ---: | ---: | --- |
| rarityWeights.set | 3 | 10 | 30 | 与各预设现unique基础权重相同；其余权重保持 |
| rarityIlvlScalingBp.set | 150 | 250 | 300 | 沿unique物等缩放；按既有每步floor、rarityBonus与寻宝修正 |
| encounter set额外乘数 | 10000 | 10000 | 10000 | 不借用uniqueWeightBp或bossUniqueBias，无新字段 |
| runeword掉落权重 | 0 | 0 | 0 | droppable=false，不列入抽取联合；只能合成序列转换 |
| salvage.base.set / runeword | 20 / 8 | 20 / 8 | 20 / 8 | 既有倍率与物等公式保持，任何镶嵌物分解不返符文 |
| familiarityMultiplierBp.set / runeword | 15000 / 10000 | 同左 | 同左 | set沿unique；runeword仅服务底材未完成熟悉度，不再学习已知词奖励 |

set设droppable=true。先按原规则选基底，再掷rarity；掷到set时在同基底、minIlvl合格、未接纳/未被同批临时占用的件中按稳定ID选择。无候选直接降rare，沿rare流程，不补抽rarity、不改基底、不无限重试。minRarity仍用现order，故套装属于rare以上；runeword不得作为掉落minRarity。非法目录不是“无候选”，须报错。

分解公式保持 `max(1, floor(floor(base×(1+floor(ilvl/10))×presetMultiplier/10000)×corruptMultiplier/10000))`（非腐化第二倍率为10000）。独立字面例：standard ilvl20套装=60片、词=24片；bountiful同物等=45/18片。未知物品沿已知上下界展示收益区间，损失确认不泄露隐藏物等/固定行。

知识：完整鉴定/熟悉度揭示件名、套名、固定行及公开套装奖励表；单行首次实际触发仅揭示该件该行，不顺带揭示套名/其它件。机械件数包含未知件；knownOnly件数只包含已完整知晓件身份的装备，奖励仅按此件数到达的阈值投影，不暴露实际隐藏门槛。阈值奖励本身无独立持久known位、无触发整套鉴定；已知目录允许预览配齐收益，当前激活状态仍用保守已知计数。假设换装必须整组重算，不能把单件差值相加。

## 4 C2孔、四符文与两词

所有18个武/甲基底使用同一初始分段（数据仍逐baseId显式列出，供以后配置差异）；按normal生成末尾抽一次，其他rarity/戒指0孔0骰。正常白装可带空孔并强化；一旦enhancement>0不得开始镶嵌，序列非空禁止任何强化/精炼路径（含growth授予），失败0消费。

| ilvl闭区间 | 0/1/2/3/4孔权重 |
| --- | --- |
| 1…11 | 70 / 20 / 10 / 0 / 0 |
| 12…26 | 50 / 20 / 20 / 10 / 0 |
| 27…99 | 40 / 15 / 20 / 15 / 10 |

四符文均minIlvl=1、weight=100、itemClasses=[weapon,armor]，每枚一条定值r0，rowId=`<id>.r0`，i18n按§3同规则；MATERIAL颜色/字形沿现材料展示，名称已知、不走装备熟悉度。

| definitionId / 名称 | stat / category / unit / value |
| --- | --- |
| loot.rune.ka / 卡 | native.resist.fire / flat / bp / 500 |
| loot.rune.ul / 乌尔 | native.max-hp / flat / int / 5 |
| loot.rune.tal / 塔尔 | native.accuracy / increased / bp / 500 |
| loot.rune.ren / 仁 | native.physical-damage-dealt / increased / bp / 500 |

| wordId / 名称 | baseClasses / sockets / sequence | 完整替换收益（每项独立r0/r1定值行） |
| --- | --- | --- |
| loot.word.ash / 余烬 | [armor] / 2 / [loot.rune.ka,loot.rune.ul] | native.resist.fire flat bp 2000；native.max-hp flat int 20 |
| loot.word.edge / 锋芒 | [weapon] / 2 / [loot.rune.tal,loot.rune.ren] | native.accuracy increased bp 1500；native.physical-damage-dealt increased bp 1500 |

词没有minIlvl额外条件，完整序列+类别+孔数唯一决定；不是序列子串匹配。4孔装前两枚符合2孔词时仍不成词；ul→ka亦不成词。成词只贡献词行，不能再加500抗火/5HP或500命中/500伤害。拆末枚后变normal并只保留剩余单符文收益。

材料获取：C2独立`runeDrops`副表（schema1，行字段`id,presetId,source,chanceBp,count,runeIds`），只对合格kill（none/fodder/splitter/encounterSubject排除）及encounter开放；每事件最多1枚，count=[1,1]，runeIds按上述四ID字典序。kill概率scarce/standard/bountiful=500/1000/1500bp，encounter=2500/5000/7500bp。这是新增概率配置，不改变既有装备chance/count或金币表；chance不再乘killDropMultiplier/leader/champion/寻宝。floor/vault不追加材料，保原类别替换合同。旧装备件全部生成后、金币前，在下一物品bucket抽概率→按weight选rune；当前最多3装备+1材料，仍总≤8提案/事件；通用超限在准入拒绝，不静默挤掉装备。

命令固定 `{v:1,itemId,runeItemId,revision}`；只取当前玩家包内未装备未锁定目标及包内MATERIAL，目标必须合法normal/未强化/有空孔；rune允许类别匹配。只追加一枚，成功100tick/1枚，消耗与目标数据/词转换原子。prepare只给已知效果/序列和确认，不掷骰、不写；确认后复验会话、CAS、两个ID/所有权/数量/锁、容量和强化。No/重复/陈旧/满孔/错类均零成本。请求不得带runewordId或指定收益。

| 操作 | 孔/序列、set/word来源 | 原生与知识 |
| --- | --- | --- |
| 主动镶嵌/成词 | 同事务更新序列与rarity；效果已知 | 不揭示底材秘密、不恢复原生附魔或runicType |
| 否定 | 保留set/piece、孔、序列及其L2来源效果；词仍匹配有效 | 沿6B4关闭原生runicType/旗标；新内容没有原生runic行，不重开它 |
| 完整鉴定 | 机械不变 | 揭示底材，set完整身份；词/序列本已知 |
| 分解 | 整件和孔中符文消失，不退唯一/套装收据 | 必须明确损失确认，取消无损 |
| load/seek | 严格验证匹配与预算，重建派生索引/绑定 | 不重新成词、不重复奖励、不主动鉴定或补资源 |

## 5 C3工位、装备所有权与craft

### 5.1 最小可达目录

新增crafting.forge：tag=`station.forge`，8邻接合法工作位、interactionDistance=1，建造用crafting.stone×6 + crafting.metal×4，placementTicks=300，kitDefinitionId=null；沿现放置命令，不要求settlement。金属已有D2起生产节点，镐沿make-pick；无新资源/采集系统。文案键走crafting本地化。

| loot操作ID | 目标 / 参数 | 托管材料、时间、输出 |
| --- | --- | --- |
| loot.work.unsocket-last | normal/runeword，有序列，mode=last | 10 loot.shard；100tick；同ID装备去末枚+该符文×1 |
| loot.work.unsocket-all | 同上，mode=all | n×10片；n×100tick（n=1…4）；同ID装备清序列+按定义ID合并的全部n枚 |
| loot.work.reforge | 已完整鉴定magic/rare，选正面非rune随机行rowIndex | 10片；100tick；同ID装备替换恰该行 |

all是**一批原子工作**，workTicks=100×接单时n，最多400；不是逐枚完成的多批票据。取消未完成all返原完整装备和全部n×10片，已过时间不退；last/reforge也是1批，禁止batchCount>1。拆卸不要求底材已鉴定，孔/序列已知。重铸禁止固定行/负面行/原生符文族/unique/set/runeword；选中行保留前/后缀位置，候选为类适用且不与其它行互斥的正面非rune词缀，允许同词缀/同结果/变差。按当前ilvl窗口重选阶和值；其它行（包括腐化补偿行）、enhancement、诅咒/否定偏移及身份不动，新行known=true，无额外腐化骰。

工位动作请求新增受限变体 `kind:'item-operation',operationId,itemId,itemRevision,stationId,stationRevision,inventoryStamp`，仅reforge再带rowIndex；操作ID决定mode，不允许客户端提交成本/时间/RNG/产物/actorId。itemRevision为宿主捕获并重验的数据签名（非新增每件持久版本）；work准备返回opaque句柄，绑定session/owner/ticket与原生图。精确TS签名和中性类型见证随C3实现，不能称当前SDK支持。

### 5.2 C5票据映射与失败行为

`WorkTicket.kind`新增item-operation；持久操作说明最多1KiB：`{operationId,targetItemId,targetStamp,rowIndex?}`，只存ID/签名/参数，不复制装备。目标与费用在同一真实escrow，沿现inputEscrowId；targetItemId是该escrow中唯一非worldItem目标，材料仍按definitionId数量验证。现WorldWorkValidation必须辨别两种合法输入，不全局放开任意escrow。所有根用现可信枚举器校验，目标仍quantity1、单owner，不贡献装备属性。

接单前同时预留：同ID装备的1个输出槽、最多4个不同符文输出堆（计已有堆的剩余99容量）、及原装备+未耗碎片的退款容量；计入C5材料接纳7168/总机械根8192的既有策略，输出/退款不得双计占用或侵占别单预留。背包无合法预留直接拒绝，不默默丢地；退款沿既有refund根，箱毁坏/remains归原C5，不发明跨局仓库。目标只能从自己包内提交，箱中先经现取回命令；费用首批也只取包内，不扫描全世界。

状态映射：接受→真实托管→working（bundle为权威时钟、remainingTicks镜像）→完成/取消；不会在UI自行倒计时。完成在一个事务内校验票据与ordinal→受控roll（仅reforge/craft）→校验候选→更新同ID目标/消耗本批料→输出→推进completedBatches/lastCompletionOrdinal及提交事实。失败恢复**完成入口前**完整对象图/引用、双流、allocator、托管/预留、组件/state、消息、物化和缓存；之后沿C5显式取消退款未完成投入。已付劳动和已完成旧批不退；不可把完成失败改为+0产物或悄悄重试。退款失败亦显式失败，不能吞装备。

取消/受伤/威胁/离层/工位销毁/死亡走现C5中断；本批offlineEligible=false，不开启居民自动改装。存读/跨层保留托管与退款根，不能复制同ID到背包；load不重新prepare/roll。幂等键=(ticketId,lastCompletionOrdinal+1)，宿主分配器/完成高水位持久、ID不重用；已终结或旧ordinal拒绝，票据回收后也不可重发。允许当前合法工作的save/load/replay/seek/续录，不给旧格式迁移。

### 5.3 craft软协议

为保持桌配方旧合同，新增两条forge配方：`crafting.forge-dagger`用metal×4+wood×1、1000tick；`crafting.forge-leather-armor`用fiber×6+leather×4、1500tick。输出分别复用plain-dagger/plain-leather-armor，quantity1，stationTags=[station.forge]，toolTag=null、offlineEligible=false，lootRoll={maxRarity:'magic'}。批数沿C5 1…16、逐批结算；其它配方不改。

`loot.item-roll.v1`是宿主调度的两阶段可选工作provider，不是纯query偷偷掷骰：prepare只收冻结配方/基底/数量/maxRarity/地点/有效目录身份，确认支持并固定输出上界；commit仅在该票据完成事务中接收有限randomInt/beginItem能力与脱离活体的事实，返回自有数据+固定原生装配提案，无任意Game/Item写权。provider缺席在接单时绑定plain分支：+0已知、0 loot骰；provider存在但坏数据/异常/不支持不能降格absent。票据绑定分支和身份，完成时不得偷偷切换。

双开输出按配方基底（不掷类别/基底），以当前地点深度、sourceBonus.craft=0、classBonus=0、接单时已知地点绑定算ilvl；normal/magic权重沿所选预设物等缩放/寻宝（完成时可信属性快照），截掉rare/unique/set，不抽腐化/金币；normal可按§4生空孔。本批maxRarity=normal则normal零rarity骰。产物+0、全部词缀/原生种类已知；新增规则不借原spawn多耗随机。origin见§6；配方、分支、能力fallback均进机械身份。

仅loot：套装/镶嵌可用，工位不可用；仅crafting：forge及两配方可用，固定+0已知；双开：能力存在才可改装及roll；无settlement：仍可背包操作；无giants不影响本节。箱内列表只读投影，取回仍原100tick容器命令，不提供绕过宿主的箱内改装按钮。

## 6 C4来源台账与确定性

| 来源 | 可信入口→资格→收据 / 固定配置 |
| --- | --- |
| craft（C3） | WorldWork.completeBatch成功路径→已绑定合法配方/固定基底/分支→ticketId+完成ordinal；不重复送入普通ItemDrops，避免双roll；最多magic |
| part（C4） | Game真实成员直接击破提交→冻结的body/part/generation/破坏点/出生资格/非行政因果→同破坏事务roll及接纳；不能从查询/成员退休/kill回调补发 |
| site（延期） | 当前无真实入口；C4只提交可校验协议与缺入口拒绝，不能通过传source='site'造奖励或新建地图 |

首批part仅两个现有生产body的非core成员：`giants.shale-weaver-body` 的leg00…leg07、`giants.copper-tendril-body` 的limb00…limb03；每body一条priority100表，chanceBp=2500、count=[1,1]、classWeights={weapon:40,armor:35,ring:25}、rarityBonusBp=0、minRarity=null、ilvlBonus=0。概率不乘killDropMultiplier、不加leader/champion概率，不掉金币/额外符文；ilvl按floor(depth×15000/10000)+2及主体既有class/champion加值后clamp1…99。无表直接0骰。表只从公开body目录能力解析，缺能力omit并进指纹，不私引giants。

part最小事实含`v,eventId,level,at,actorId,sourceId,bodyDefinitionId,groupId,partId,generation,zoneId`及宿主给出的出生/因果资格；首批zoneId='body'、generation=0。同一直接破坏至多一次；父段破坏连锁退休的子段没有新奖励。当前appliedBreaks可作为消费凭据：持久破坏与掉落尝试在同事务完成，chance失败或无容量也已消费资格（以后不重试）；接纳到的唯一/set收据另按实际接纳记，不能把消费资格等同已获得物品。不得等待退休后才找已清除的伤害来源。

自然敌对奖励主体才可触发；召唤、克隆、分裂新主体、盟友、行政删除、已失格encounter主体一律排除；沿宿主现birth/causality与失格传播语义，不能只检查当前hostile。新临时entityId不能生成新资格。变形保持原资格的稳定键；再生首批关闭，若以后开放必须由宿主生命周期显式授予新generation，不能自动跟随模型generation增长。若跨形态无法保持/证明对应关系则保守不授新part资格。普通kill、encounter、part互不冒领收据；encounterSubject只限制普通kill，不自动取消仍合格的part。需验证多个事实同事务稳定次序、核心死亡同时发生时先part后终结奖励。

origin演进：C1/C2仍`{source:floor|kill|encounter|vault,depth}`；C3增加`{source:'craft',depth,recipeId}`；C4增加`{source:'part',depth,bodyDefinitionId,partId}`。origin只存可审计来源，不存完整事件历史；幂等凭据在宿主，不由origin反推发奖。site协议为`{source:'site',siteId,siteKind}`，无depth，siteIlvl=1、怪物倍率中性；siteId稳定合法ID、siteKind必须来自已登记地点类型。当前无site provider/地点目录，所以此分支实例准入拒绝（包括“伪depth=1”），协议不等于可生成合法site物品。若未来引入带地下深度的地点类型须另升schema，不在本轮默许混合字段。

### 6.1 固定随机顺序

| 路径 | 顺序 / 空候选行为 |
| --- | --- |
| C1 | 旧事件资格/概率/件数→旧类别/基底→含set的rarity→set件候选（规范ID）→固定行值；无set候选降rare继续旧词缀/腐化/名字；原unique顺序/bias保持 |
| C2 | 旧单件末尾第10步normal孔数→原6B4目标类末尾逻辑（normal没有目标骰）；全部装备后材料副表概率→rune选择→原金币；镶嵌/成词零骰 |
| C3重铸 | 完成时玩家指定槽不抽选行→合法词缀按有效目录原序权重→合法最高三阶按现低到高权重→ranges按分量；不再精炼max、不再腐化补偿 |
| C3 craft | 固定基底→截断normal/magic rarity→旧正面词缀数/位置/候选/阶/值→normal孔数→若生成目标符文按6B4末尾目标骰；无腐化/名字/金币；结果已知 |
| C4 part | 可信资格与表匹配→2500bp概率→固定count零骰→旧类别/基底及新rarity/单件流程；无材料副表、无金币 |

所有加权选择正候选≥2才抽`[1,sum]`，单候选/定区间/0或10000概率零骰。每件≤64/事件≤512，材料概率/选择计入其单件bucket；每批工作单独预算，不能一次完成无界批次。正常部分接纳保留已耗骰，异常退双流及完整世界。纯预览/prepare/socket/unsocket/阈值求值/知识投影均零骰。

## 7 最小通用补口清单与影响

本表是C-D6授权边界；实现时若发现需要超出下列权限/格式，先补合同供维护者裁定，不借C0授权做全面重构。C0本身不修改这些文件。

| 编号/阶段 | 缺口与拟触达 | 权限、写集、失败 / 身份影响 |
| --- | --- | --- |
| G1 / C1 | 现itemDrops收据可复用；loot模块内set适配、knownOnly全套求值、固定行知识与filter合法稀有度 | 不扩宿主权限；模块state2、实例v3、目录指纹；纯collect零事务。filter新增set/runeword阈值按C1/C2启用，旧四档语义保持 |
| G2 / C2 | itemSdk.DropItemSpec及itemDrops/宿主接纳改为严格联合`{kind:'native',native,moduleData}`或`{kind:'material',definitionId,quantity}`；material只允许本owner已登记MATERIAL，无moduleData/native混搭 | ≤8提案、99/堆，实际根/落点预算；floor/vault禁材料替换。沿原事务恢复材料/根/ID/RNG与收据，材料uniqueIds必须null；itemSdk及foundation升号 |
| G3 / C2 | ItemCommandProvider新增通用受限`socket`类（材料消费+目标自有数据变换）；ItemCommand验证器独立检查一个目标/一枚材料/100tick | 无任意原生字段、无RNG；更新只写自有moduleData，底材知识保留，不冒用identify；完整确认/CAS与事务。与G2同次升itemSdk/foundation |
| G4 / C3 | worldSdk TimedWorkRequest/WorkTicket/OutputReservation和WorldWork/Validation/快照codec增加装备目标/原位改造输出 | 只托管已授权未装备quantity1目标，真实对象移动，强校验归属、签名、锁定、预算、双预留；异常全图回滚；worldSdk2、world schema6、foundation下一号；同步所有实际引用worldSdk字面版本的descriptor/WorldDefinitionPack/中性见证（含loot、crafting、settlement、foraging，按发现器核对），原调用行为保持，不能只升导出常量。edible无差量 |
| G5 / C3 | 通用有预算的工作完成provider协议，crafting RecipeDefinition可选lootRoll；重铸共享同一完成执行器 | prepare纯、commit为宿主调用；只授有限随机与纯提案、不得暴露活对象；分支/结果验证、输入/输出/ordinal原子；provider坏结果硬失败，无缺席回退；与G4同次foundation，crafting版本/schema升号 |
| G6 / C4 | partBreak成功提交发可多消费者事实；itemSdk.DropEvent的part联合；公开只读body资格目录 | 不占combat.part-break.v1单provider、不给普通hook奖励/RNG；完整破坏/接纳事务含空间、因果、收据/消息/物化；旧appliedBreaks首批可复用，不增无限历史；itemSdk/foundation升号。如需新增持久资格字段，先列schema差量再分配，不给模块造generation |
| G7 / C1起 | ext-perf-selection/check/run-ab及workflow现硬编码6B4路径和1714前缀 | 增有限身份注册表：p0、6b4、6c1…6c4的manifest/两完整route/source及有依据前缀；只启用已具备制品项。A选择最近已验身份，B选择候选身份；累计phase6起点另报；不开放任意manifest或单case豁免。无规则SDK身份变化，独立登记控制工具hash |

G7负例：未知/重复/冲突选择、缺任一classic/all路线/source/manifest、hash漂移、计数增长、缺逐块P99数据、少于三轮、不同工作量却缺合法前缀、freeze后无独立回放均不得收口。原profile/common/compare观测与oracle保持；首次需该能力的C1再编码并跑`test-ext-perf-selection.mjs`与`test-ext-perf-ab.mjs`，C0仅列合同。

### 7.1 失效、性能负载和未来验证责任

| 事件 | 必须保持 |
| --- | --- |
| 装备/卸装/改造/镶嵌/强化/否定 | 机械与known缓存、录像摘要失效；按受影响角色重算完整四槽，物化降钳不补 |
| 鉴定/首次固定行触发 | 仅知识/known比较及摘要失效；不因看详情补收据或触发套装奖励 |
| 提案失败/回滚/跨角色事务 | 恢复对象图及原引用、双流/ID/账本/收据/会话缓存；沿P2保守失效，不漏依赖 |
| load/seek/换局/GC | 校验全部所有权根、重建绑定/派生，不重新发完成或破坏事实；UI旧ID/草稿/回调清理 |

C1小场景=四件2→3→4→3、2+2混套、双戒同件/不同件、已知/未知比较；C2=0/1/4孔、满孔匹配/不匹配、100次只读；C3=4枚all的400tick/40片、同ID输出、取消/满输出/跨层退款、16批craft与provider故障；C4=两body最多12个直接成员事实及连锁负例、重复/读档/失格。每场景固定种子/规模/动作，三次计数一致，分别报冷/热与查询零事务/双流零抽取；补充场景不能代替完整D20。

C1–C4按任务单§7：云端同runner三轮串行交错A/B，classic/all完整路线、D20≥500行动、256/2048检查点、零OOS/逐域/终态/双流/调度及17既有计数+新增计数稳定；修订D6的P95+10%、命令max/客观块P99+25%、墙钟+10%，判式严格`B>A+max(1ms,A×比例)`，三轮至少两轮任一指标越线阻断。round.max仅报告，P99最近秩；完整工作量变化须有rowsHash/双流/块数/回合/ticks一致的前缀，不能照抄1714；仍保完整路线校准及冻结后独立回放。维护者执行320×568/800×900/1440×900浏览器并审预算，作者交源/构建身份与复现清单。

后续相关测试按真实触达选：loot schema/catalog/item/generator vectors/economy/stats/knowledge/UI与新set/socket/work/source测试；共享补口保留item drop/command、WorldWork SDK/transactions/failures、part break/giants真实自然链及generation checkpoint差分；涉及原生战斗保留中性差分/ITEM_RUNIC。正常树不跳；跨包声明依赖。每个代码交付的一行全删与同版本真实缺包拒绝、生命周期边界沿任务单§6，C0不冒称执行。

## 8 版本身份与接线顺序

| 身份 | 当前实值 | C1 | C2 | C3 | C4 |
| --- | --- | --- | --- | --- | --- |
| loot module/rules | 0.5.0 | 0.6.0 | 0.7.0 | 0.8.0 | 0.9.0 |
| loot pack / 总身份schema | 0.2.0 / 1 | 0.3.0 / 2 | 0.4.0 / 3 | 0.5.0 / 4 | 0.6.0 / 5 |
| loot实例 / state | v2 / 1 | v3 / 2 | v4 / 2 | v5 / 2 | v6 / 2（part收据沿宿主） |
| foundation / itemSdk | 17 / 2 | 17 / 2 | 18 / 3 | 19 / 3（若工作接口独立于itemSdk） | 20 / 4 |
| world5.schema / worldSdk | 5 / 1 | 保持 | 保持 | 6 / 2 | 保持（无新增世界字段时） |
| crafting module/rules / 定义schema | 1.0.0 / 1 | 保持 | 保持 | 1.1.0 / 2 | 保持 |
| growth / edible | 1.10.0 / SDK1 | 全部保持既有消费合同；不因增加内容自动升号 | 同左 | 同左 | 同左 |
| whole-run / recording / origin codec | 7 / 4 / 2 | 容器结构不变均保持；模块实例的origin与recording origin codec区分 | 同左 | 同左 | 同左 |

未来号是按本顺序的**分配方案**，集成人实施时核对最新HEAD与真实签名再统一分配，禁止覆盖中间占号；公共接口字节一旦变化必须登记新散列，不得声称worldSdk1冻结不变。C3若改itemSdk也须同次升号，顺延C4；C4若新增宿主持久资格，必须升实际所属schema并更新本表。纯数值改动不升文件schema；C1的rarities/presets沿schema1仅激活现字段，salvage/identify因新增键变schema2；新增文件各schema1。C2/C3/C4新增字段联合分别升受影响文件schema，总包schema按表记录组装合同变化。

每步从新局捕获当前版本save/完整recording/seek/续录；旧身份、缺包、坏数据在候选发布前严格拒绝并保活局。记录source树与dist字节hash、静态pack、有效能力目录、configuration/rules fingerprint、SDK清单、性能manifest与输入hash；locale正文不进机械指纹，目录/能力fallback必须进。C0不产生新dist、不伪造新指纹；基线身份摘要见[C0报告](phase6c0.report.md)。

冻结检查点：维护者确认本文具体目录/权重/经济、知识/来源、G1–G7边界及版本方案后，再明确开C1。**C0交付即停止；site玩法按裁定延期，C1–C4代码、性能和浏览器均未实施/未验。**
