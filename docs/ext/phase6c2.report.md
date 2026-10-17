# 6C2 实施报告

性能最新结论见文末「性能剖析与已知开销预算（2026-10-17）」：保留云端 regression，按本轮维护者选择接受短前缀已知开销并冻结预算；三档浏览器仍待验。前文各次待验状态为历史记录。

开工：`ext/phase6` / `e276484`。授权止于 6C2；不 commit、不 push、不进入 C3。冻结输入为 `phase6c0-contract.md` §4；四符文、两词、孔权重、掉落概率和经济数值均保持原表。6C1 云端 A/B 独立进行，本步不改套装行为与冻结性能预算。

性能与三档浏览器均交维护者待验，不将本地功能结果当作阶段验收通过。以下首轮送审记录保留作历史证据；R1 修复、复验与更新身份见文末「审查发现处理」。

## 最小通用补口

| 缺口 | 权限与实现 | 写集及失败行为 | 版本 |
| --- | --- | --- | --- |
| DropItemSpec 只支持原生装备 | 新增独立 `{kind:'native',native,moduleData}` / `{kind:'material',definitionId,quantity}` 严格联合，只允许同 owner、category=material、maxStack=99、无 tool/nativeTemplate 的 C5 定义；不能携带 moduleData/唯一收据，floor/vault 禁止材料 | 沿原受控掉落接纳；先验证提案，再按根预算/落点接纳（R1 补正：native 沿原8192；material 调用 C5 的7168根及输出预留检查）。异常使用原生成事务，覆盖物品/地形/ID/双流/收据/缓存；正常无容量/落点返回 skipped | foundation 17→18；itemSdk 2→3 |
| 无独立镶嵌命令 | `kind:socket`；严格 v1/itemId/runeItemId/revision；背包未装备目标与同 owner MATERIAL；恰消费1、更新1、100 tick、必确认、无输出材料 | prepare 纯读；密封计划绑定 Game/runtime、对象身份和完整背包/装备/CAS。确认后再比较；失败不扣料、不耗时。只更新 owner 数据，不全量 deriveNative；机械失效与鉴定知识失效分开 | 同上 |

新增 `ItemEnhancementProvider.allowed?` 纯布尔硬否决（同次 SDK 升号），在原生强化选择、执行及模块应用三个入口检查。仅已镶嵌白装/词返回 false，阻止 growth 的附魔/属性点/技能点重定向绕过 cap=0；原有满强化套装可否重定向仍沿 C1。`FixedItemAssembly` 接受独立 native 结构，只有掉落提案边界要求 kind；中性 fixture/旧探针只同步新提案格式，未改采样、负载或预算。

现有 C5 工作投入实际从背包移入 escrow，无原生装备锁字段；只在当前背包按 ID 解析且比较完整计划 stamp，不能操作 escrow/箱子/地面/另一会话旧计划。未新增 Game 字段、世界所有权根、工作票据或 C3 工位按钮。

## 实现范围

新增 sockets/runes/runewords/runeDrops 四个 schema1 目录及准入索引。18 种武甲基底按冻结 ilvl 三段权重，normal 生成末尾抽孔；戒指和其余稀有度无孔骰。材料在装备完成后、金币前进入下一物品桶，独立概率不乘寻宝/精英修正；排除 none/fodder/splitter/encounterSubject。保持每件64/每事件512 RNG与最多8提案限制。

实例 v4 只存孔数和有序 rune definitionId；完整类别+孔数+序列索引派生词身份。重复符文允许；前缀、反序、错类不成词。满孔匹配与 rarity 必须一致，load 不修复。未满/不匹配投影各孔行（孔索引隔离来源），成词只投影词行。强化与非空序列互斥，白装空孔仍可强化。

主动镶嵌与词效果已知，原生附魔、力量需求、诅咒、熟悉度和底材 identityKnown 保持。否定保留孔/序列/L2奖励；完整鉴定单独揭示底材。分解销毁全部嵌入符文，不返还；UI与宿主都提示永久损失。详情显示孔/序列，公开词配方与奖励，逐枚确认、成本、互斥和本阶段无法取回。

版本：loot module/rules 0.7.0；pack 0.4.0/schema3；实例4/state2；foundation18/itemSdk3。world5 schema5/worldSdk1、edible SDK1、whole-run7/recording4/origin2 不变。

## 验证记录

证据目录：`/private/tmp/phase6c2/`；截图与大原始证据不提交。只运行相关测试、boundary、测试依赖、一行全移除、vue-tsc 和 build；不运行完整 npm/ext/drift、组合穷举或本地性能 A/B。

初始旧套件：`old-loot-first.log`，34文件中25失败/9通过，158失败/659通过（两文件在收集期失败）。隔离原提交 `e276484`、原测试/夹具不变：`counterfactual.log`，32文件通过、2文件失败，899通过/2失败。失败分别为套装自然链60秒超时和统计工具 set 计数 NaN；后者是6C1已有工具问题，不改6C1行为以掩盖。其余版本、UI样本、字面RNG带和快照失配已有单变量反事实。

最终相关结果分批记录（没有把中间失败算作通过）：

| 范围 | 结果 / 证据 |
| --- | --- |
| 原相关清单47文件 | `related-second.log` 1169通过/5失败（当时C2为49项，后补真实箱子/非法存档至51项）；其中版本断言、locale计数、静态可扫描i18n、容量布景等5项修复后，`related-fixes.log` 5文件84项全通过 |
| G2严格联合后的掉落宿主、loot桥接、C2 | `g2-final.log` 中3文件93项通过；同批新增SFC按钮标签布景失败，按真实含空格标签修复后 `sfc-final.log` 13项全通过 |
| C2专项 | 51项：字面权重与概率、0/1/4孔、反序/错类/非子串、重复符文、未知与非法目录、100tick/No/双提交/CAS、后段故障全图回滚、99+1堆叠/拆堆/真实C5箱子存读取回、容量、否定/完整鉴定/分解、存档拒绝非法v4。100次只读全图不变单独复验 `pure100-final.log`（1通过，其余50为名称过滤未运行，不是产品skip） |
| 套装自然链 | `sets-final-pass.log` 26项全通过，原60秒上限未改；seed110 / bountiful / loot，D4 floor wanderer.lamp，真实近战战利品筹资，332事件；存读/全回放/中途与末尾seek/续录均通过 |
| 旧统计工具 | `stats-preexisting-final.log` 14通过/1失败；失败为set计数NaN导致JSON往返不等，原提交同一用例同一断言已失败，送审时未修，R1已修复（见末节） |
| growth互斥 | `loot_b4_growth.test.ts` 三种redirect均拒绝已嵌目标，原多级强化/精炼/收据上限断言仍通过 |
| 自然符文闭环 | `socket-natural-final.log` 1通过；seed26 / wizard / bountiful / loot；D1白装25、D4真实获得ul，2孔嵌1枚；No/Yes、存读、全回放、seek、续录，512事件 |
| 受控两词/未成词录像 | C2专项中合法初始出生夹具：余烬、锋芒、4孔前缀同时运行；2049事件、seek 0/255/256/257/2047/2048/2049、续录终态一致。明确属于受控场景，不冒称自然成词 |
| 正常树门禁 | `boundary-final.log`、`dependencies-final.log`、`types-final.log`、`build-final.log` 退出0；build只有既有大chunk提示 |
| 一行全移除 | 同一 `keep-none` 副本实际删除8模块，无stub。boundary/依赖/vue-tsc/build均0；共享5文件160项通过；唯一去重端点新局→行动→存读→回放→seek→续录通过；真实自然C2存档/录像缺包均拒绝，live全图、双流、ID、事件不变 |

全移除命令：`node scripts/check-module-removal.mjs --profile=removal --retain=none --prepare-only --engine-only --output=/private/tmp/phase6c2/removal`，随后仅在此副本同步最终共享差量，执行限定相关门禁。工具prepare摘要保留 `prepared-not-verified` 及默认全量门禁提示；实际授权范围和退出码见 `finish-results.json`，生命周期的 `requestedScopePassed=true`、浏览器 `not-run`，不能把其总 `passed=false` 包装为浏览器通过。共享5文件为 ext_item_drop、ext_item_commands、ext_stats_pipeline、ext_stats_runtime、ext_generation_checkpoint_differential；未展开组合穷举。

### 旧前提与基线归因

- 生产前后原旧测试/夹具采用相同原提交字节，旧版隔离反事实已记录。旧套装自然链另有原提交串行1项通过（`counterfactual-natural-serial.log`）；G2中性掉落原测试独立反事实32项通过（`g2-counterfactual.log`）。没有更改守卫、行为断言、容差或超时。
- 实例字面量3→4、module0.6→0.7、pack0.3/schema2→0.4/schema3，locale闭集171→183；21份6B4 runic向量仅 `/data/v` 改动。新文件引用/版本/固定指纹按新合同更新，静态保守RNG上界45/364→46/374，仍低于64/512。
- 旧“无新家族”字面骰带的目录前提补齐：runeDrops=0、孔权重只剩0孔，保持其原抽样断言；真实C2权重与材料骰由新独立字面带覆盖。旧growth触发鉴定布景把邻近高HP老鼠明确设为 HUNTING、accuracy1000；原触发后知识断言不变，避免依赖已改变的睡眠/命中随机轨迹。
- 原 first-hit `findLootUiFixture` 重录全部21样本，只有R07 seed/index `272/1→35/1`、R16 `105/0→35/1`。递归逐叶共49变更：21个实例v；R07另14个叶（seed、baseId spear→broadsword、affix0 brutal/tier4/[3,9]→reaper/tier3/[2]、affix1 titan/tier4/[2]→brutal/tier2/[2,3]、affix2 honed/tier3/[2]→titan/tier2/[1]、nameParts [1,11]→[30,14]）；R16另14个叶（seed/index、ring_of_wisdom→broadsword、magic→rare、新增precise tier4/[2759]与leech tier2/[1]且known=false、nameParts null→[30,14]）。全部差量见仓外 `fixture-leaf-deltas.json`。
- SFC按原Vitest捕获更新8快照：card.growth-fallback/growth-labels/rare-brutal、chip.rare-identified/rare-unknown/selected、compare.strength-short/weapon；皆由上两样本的名称、类别、词行、伤害和力量派生。原力量比较用例显式恢复spear底材前提，原13力量短缺/满足断言未改。
- 套装自然见证继续使用原seed110、原探索/鉴定/分解/回放方法；新终端孔骰与材料骰改变首件样本：D4 floor bastion.mail→wanderer.lamp；原筹资路线D6→D7、事件416→541、setMask尾`04→40`。原floor-only布景在并行与串行均超60秒。最终仅改筹资前提：缺碎片时先走当前层goblin/ogre的真实战斗，再分解实际掉落；仍用原walk/保存/回放入口，无物品/碎片注入。生成的新套装带来第二个合法收据，故把“分解不退收据”的基准取样移到筹资之后，原完全相等断言保留。最终D4完成、332事件、mask尾41；阶段操作、回放断言和60秒超时均保留。曾筛选的359（跳层假样本）、201（自然途中蝙蝠战斗不结束）均未采用，也不列为通过证据。

| 基线文件 | 前 SHA256 | 后 SHA256 |
| --- | --- | --- |
| b4-runic-vectors.json | `da9e0e4687e8a67827e96edcc2ce1b74e490a405d2111f061b9e838f1eee39f6` | `6f5b55a14d8fa17821e20ec65726a5f401152ba9b98e1b0c2ff3c82f45935515` |
| loot_ui_components.test.ts.snap | `d09529c8415eb42a55cf528e64bf9cabb14d2de53a5e469d739e2fa4c3996b81` | `a2a2e52a14702af33eac59ec8de8236aa1896bc8a9f3584b4c8c8e2cf2f86bc5` |
| tools/preview/fixtures.ts | `90f38c16c167ceb747ae259c02c63f94c8ee47e52c703b0320ae5d5112064b4c` | `24a3b2bd79e44b21f0c1619ad67f02e0637e16f254844513302300cb53f1f75d` |

## 三档浏览器清单（全部待维护者）

| 视口 | 检查 |
| --- | --- |
| 320×568 | 长名称/序列/词奖励换行，无横溢；孔0/1/4、材料计数可读；镶嵌/取消/返回与100tick成本可达，按钮≥44px |
| 800×900 | 列表与详情滚动、双戒比较原行为；旋转/缩放/切换目标不提交旧ID；词预览和确认后刷新 |
| 1440×900 | 鼠标与键盘镶嵌No/Yes、满孔/已强化/已装备禁用；重复提交、成词/不成词、词替换单符文；无拆卸按钮 |

复现基准：最终候选 `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`，URL `http://127.0.0.1:4173/`；维护者记录实际浏览器版本、CSS viewport与DPR、source/dist身份和每格结果。新局 extended / loot / bountiful / wizard / seed26，将拾取过滤设normal；D1白装在(73,12)，自然符文见D4路线。两词/四孔不匹配另用受控当前版存档或自然材料逐枚操作，注明布景来源，不用SFC结果代替浏览器。

三档共同：自然符文掉落→拾取/99堆叠→顺序镶嵌；余烬/锋芒、反序/错类/4孔前缀；底材秘密不泄露；完整鉴定/否定后收益保持；分解损失确认No/Yes；当前存读/回放/seek；loot单开与loot+growth、满背包、箱内只读及取回。UI查询不得修改实质状态。

## 云端性能待验

参数：`base=e276484`，`head=ext/phase6`。沿已有同runner三轮A/B与D6预算；本候选未commit，需维护者后续提交并推送后绑定实际head源码/构建身份。6C1在途结果不代表C2；不改冻结预算或声称本地性能通过。


当前云端工具只登记到6c1，且accepted仍为false；本次不修改在途6C1的workflow、选取器、预算或冻结制品。维护者须先确认C1 A/B身份，再以本候选注册/捕获C2完整路线和补充场景（0/1/4孔、匹配/不匹配、100次只读），不能直接把6C1 manifest或1714前缀标成C2结果。三档UI与云端A/B仍待验；原提交已有的统计工具set计数NaN已在R1修复，见文末。本报告不宣称6C2阶段验收完成。

## 首轮送审身份与停点（R1 更新见文末）

本地验证 Node `v25.2.1`；没有做本地性能测量。最终类型/构建/边界/依赖与差异检查见 `last-checks.json`（全部退出0）。源码聚合算法：按路径排序的 `[{path,sha256}]` 紧凑 UTF-8 JSON 再 SHA256；含测试和新增未跟踪文件，完整清单在仓外 `identities-final.json`。HEAD仍为 `e27648489953069b9aca4c9cf2b8a5ed5162a372`，没有候选commit。

| 身份 | SHA256 / fingerprint |
| --- | --- |
| src（1467文件） | `7df67e8b2152cfa3b3d648dc3be7f03ba9e1a95f6f773ae8cff0182e63a9efbe` |
| dist（61文件） | `826fc98cd433e47f185cb69ab0139a9efa2b83f0b3ed0a1509cf096c06661bae` |
| loot数据（21文件） | `9a3d70c3efce6e500b0f37679a61302d70a7a2768ca79e4e899e91547090886c` |
| 静态pack | `sha256:ddf001ce3ec90674daca0cf553498728d8d75ccd11636f02bdb7c4cfed511dab` |
| loot-only有效catalog | `sha256:861e7ba63415b6ecef57a0fb22551eb85e1aa397b9e5349f09d5d9febe0403a9` |
| loot rules | `sha256:1f92947e24cbb5102d15759c1712d652ae2dbb009d5f034dbf7dc9cb254234d2` |
| src/ext/itemSdk.ts | `001fc37a6ad1b19566a55d34c1c718f272fbd3286df875a223cc026eb3392379` |
| src/ext/worldSdk.ts | `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343` |
| src/ext/edibleSdk.ts | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` |
| src/ext/stats.ts | `c828f7b94f48a40273d7fb5320e3228d89f4ef0fc6d7345f9f16667a78ce3ee8` |
| scripts/ext-perf-6b4-budget.json | `c659a3788e4f53aa8ea20e7a050950b3bb39f990f2fd92863a3f7eecc0ea2e38` |

自然证据均在 `/private/tmp/phase6c2/`，未提交大文件：

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| natural-save.json | 8379248 | `078b5f0fed0529b0f3a4e0894148f37b1657994d12dea0d5140b58cb47841365` |
| natural-recording.json | 495868 | `2e5fb76c514a206a62e1b26bb3fa4753dfb45e178ee0a6d9b589d6949d32c505` |
| set-natural-save.json | 7921498 | `dae577aa025780dc5bbf9c1d03097902af5c0a67f8861af040d8abff8db9826b` |
| set-natural-recording.json | 322656 | `64127c36d482202152d4e51126105f2fcb9692d7f46527c49539092a5701e670` |

停在C2：代码、限定门禁、三档浏览器清单与云端参数已交付；浏览器/性能仍待维护者执行，不宣称阶段验收通过。冻结C0、C1套装规则与数据、两份性能预算及在途workflow均未修改；无C3工位、拆卸/重铸/合成接口，无commit或push。


## 审查发现处理（第1轮，R1）

输入：[独立审查发现](phase6c2.review-findings.md)，结论「需修」。本轮逐项自行复现后修复；下述为主笔修复及自验记录，不替代下一轮独立复核。证据目录 `/private/tmp/phase6c2-r1/`。HEAD仍为 `e276484`；不 commit、不进入 C3，冻结数值不变。

| 发现 | 复现、根因与处理 | 回归 |
| --- | --- | --- |
| R1-F1 地面词装详情异常 | 原审查脚本重跑：实际两次socket、drop后，host投影只有rarity，详情抛 `INVALID_INPUT: item.sockets`（`repro-floor.log`）。模块已投影公开孔信息，但宿主floor白名单删掉了它。宿主现只额外保留有界 `{count,sequence}`（0…4、序列不超孔、每个ID≤128字符），重新构造对象，丢弃附带秘密字段；gameView复用同一次投影，原DTO校验不放宽。`fixed-floor.log` 显示完整公开序列且 `FLOOR_VIEW_OK` | 中性宿主白名单测试覆盖嵌套秘密、非法孔数、超长/对象ID；真实drop测试覆盖0孔、部分镶嵌、2孔词、4孔前缀，存读及多次只读全图不变，底材附魔/力量/诅咒/熟悉度保持隐藏。两种词装及4孔前缀均在真实drop后完成存读、2049事件全回放、边界seek及续录 |
| R1-F2 材料绕过C5预算 | `repro-probe.log`：7168根、C5拒绝新增时，真实kill仍产出1符文至7169。新增material分支现复用 `checkItemBudget(game,1)`，包括全部所有权根及未完成票据的outputReservation.slots；仅捕获 `World5Error/C5_BUDGET` 并返回 `skipped:capacity`，发生在落点骰和实体分配之前，其余错误继续原事务回滚。native原8192上限不改。`fixed-probe.log` 为7168→7168、runeDelta=0 | 六组真实死亡边界：7167/7168、真实工位工作票据预留1格时7166/7167、native先接纳后material重新判容量；覆盖native在7168根仍可按原规则接纳。每组存读、恢复死亡前档重做死亡，对照digest、双随机流及下一实体ID；预留保持。另用受控合法出生7168根、真实move近战杀死原生怪物，验证跳过不撤销死亡，存读/完整回放/seek/续录终态一致 |
| R1-F3 单正权重仍耗骰 | `repro-probe.log`：合法 `[0,0,100,0,0]` 得2孔却调用 `[1,100]`。normal末尾改用已有 `weightedPick`，单正候选不抽；冻结多候选表仍恰抽一次。`fixed-probe.log` 返回2孔且draws=[] | 0…4孔各测单权重1和100，底层随机回调直接抛错，结果与trace均为0骰。受控两词生命周期的出生夹具用100权重单候选实际生成两件白底，逐次断言全局RNG不变，贯穿存读/回放/seek；原三段权重100个枚举点及戒指/非normal回归保持 |
| 统计NaN（附带修复） | 本轮 `repro-stats.log` 再现原断言：set为NaN，JSON序列化后为null。根因是生成器已产set，但 `RarityCounts`/初始化仅四旧类，`as keyof RarityCounts` 掩盖了 `undefined++`。实际分层计数改成穷尽 `Record<RarityId,number>`，补set/runeword初值0，去掉错误索引断言，输出列补套/词。NaN修复后继续暴露旧理论表混入set权重的问题（`stats-detail.log`）；6B1冻结文档仅四类，故仅历史理论核对显式用四类模型，真实生成模拟仍使用完整未改生产preset，报告模型写明两者口径 | 原15项现全通过，未放宽或删除原JSON往返、权重、容差及总数断言；增加确有set样本、六类键齐全、有限数、runeword生成计数为0的断言。实际各层六类数量之和仍等于件数；未修改doc-targets、掉落概率或C1套装行为 |

本轮只运行相关测试、boundary、测试依赖检查、vue-tsc、build；依最新指示不重跑全移除、全量npm/ext/drift、浏览器或本地性能。初次补测的夹具错误（候选目录未同步最低稀有度、native缺owner/非法熟悉度、工作点存在威胁、把死亡标志误当立即移出列表、手工怪物无出生掉落资格）已在测试前提中修正；未改生产守卫、原行为断言或超时。类型检查发现的测试ES版本/API名称问题也已修正。

本轮专项 `focused-final.log`：3文件85项全部通过（sockets67、stats15、通用presentation3）。其中新增16项socket回归及1项中性白名单回归，原两词生命周期补入零骰生成与真实drop，并保留原所有回放断言。`budget-second.log` 的12通过/55过滤未运行是中间定向排错，最终全67项已覆盖；不将过滤项计作通过。


| 本轮最终检查 | 结果 / 日志 |
| --- | --- |
| 专项：sockets、stats、宿主presentation | 3文件85项全部通过；`focused-final.log` |
| 相邻回归：数据/schema/生成向量及性质/item、knowledge/viewmodel/SFC、loot与stats桥接、自然符文生命周期、宿主掉落/命令、C5根及工作边界、生成事务差分 | 16文件582项全部通过；`related-final.log`，限定 `--maxWorkers=2`；自然符文仍覆盖真实掉落/镶嵌/存读/回放/seek/续录 |
| boundary | 退出0；`boundary-final.log` |
| 测试依赖检查 | 退出0；`dependencies-final.log` |
| `npx vue-tsc -b` | 退出0；`types-final.log` |
| `npm run build` | 退出0；`build-final.log`，仅既有大chunk提示 |

合计19个相关测试文件、667项全部通过，无失败或产品skip。旧测试的行为断言、文档数值与容差均未删改；没有重录黄金trace或UI快照。版本仍为当前未发布C2候选 foundation18/itemSdk3、loot0.7.0/pack0.4.0；本轮仅补SDK白名单说明，未增加Game字段。C0冻结文档、21份loot数据、C1套装规则、性能预算和在途workflow保持不变。

以下R1身份取代上面的首轮送审源码/构建身份，算法不变，完整清单为本轮仓外 `identities-final.json`：

| 身份 | SHA256 |
| --- | --- |
| src（1467文件） | `670488fad3894ebe7c4ab4b6d6a8630b15424c1494f540c44016483ee3134193` |
| dist（61文件） | `36c9e4759ff57e0b7d3f4a6b5e894063e502f3f5ef4a35b6353ff60167ae6091` |
| loot数据（21文件，未变） | `9a3d70c3efce6e500b0f37679a61302d70a7a2768ca79e4e899e91547090886c` |
| itemSdk（仅补公开floor投影说明） | `ba0b8a4d7401da0972ebb9ecc2f260993cbe9910d2908f5b5c6044289add69f6` |

pack/catalog/rules、worldSdk/edibleSdk/stats核心与性能预算指纹仍与首轮送审表相同。云端A/B仍交维护者以 `base=e276484 head=ext/phase6` 绑定后续实际提交；浏览器三档待验，并增加「实际成词→drop→选中地面词装→存读后再选中」共同检查项。R1自验完成，等待独立复核；未commit、未push，停在C2。


## 基准路线修复与云端重跑准备（2026-10-17）

本节覆盖前文“工具只登记到 6c1 / accepted=false”的历史状态。工作分支 `ext/phase6`，引擎 B 固定为 `feb33b030f74949a2e0af001362b53f2f6e0eea3`，`src` tree `5c588225980a69b5a12a0d2572a1a3aee899beca`；本次只改性能脚本、工作流和文档/冻结制品，没有修改游戏代码，没有 commit/push。

### 原失败与回退策略

[run 38937707099](https://github.com/coolking70/BrogueJS/actions/runs/38937707099) 在 `004-generate-B-all.log` 报 `Stuck 6:31,21`，尚未进入三轮性能计时，不能解释为性能 regression。`candidate-artifacts/all/route-failure.json` 显示阻路吸血蝙蝠 HP=1555/maxHp=23，玩家持初始匕首、被蛛网缠住；原 BFS 避怪失败后直接穿怪寻路，原地不断攻击，定期 search 不能结束这一局面。

修复位于 `generate-ext-perf.mjs` 和独立可测的 `ext-perf-route-recovery.mjs`：

- 固定 BFS 方向及稳定目标次序；优先避开蛛网，必要时才允许穿越。可选升级武器避怪不可达时转向楼梯。
- 每层累计同格访问/原地不动达到 24 次，或可选绕行达到 512 步，放弃该层可选拾取；继续受阻则封锁失败的有向边并重新规划。楼层变化清空这些规划状态。
- 局部无路、原地 600 次或每层 1024 步/全局 16000 命令上限触发同种子重建：只在失败楼层入口多提交一次真实 `wait`，保留之前楼层的入口等待策略，最多 16 次完整尝试。所有等待、移动、搜索、上下楼/装备仍经过正式命令入口。计数与重试不读墙钟、不取 RNG、不编辑怪物、地图或存档；不换种子。
- 每次失败保留独立诊断和累计尝试记录；最终只导出最后一次从新局起完整录制的成功路线。引擎错误、录制错误、死亡、覆盖失败不会被当作可恢复路线错误吞掉；重试耗尽仍硬失败。
- D20 原定 500 次等待保留，增加结算数和多怪/多地形光源检查。它是有界的确定性采集策略，不承诺所有未来规则/种子都必然可通关。

初次“只封边/换目标”探针仍在 D6 失败；避蛛网单独亦不足。失败证据保留在 `/private/tmp/phase6-route-fix/{gen-1,probe,gen-2,gen-3}` 及同名日志。最终策略在第一次尝试 D6 无路后，第二次仅以 D6 入口 1 次等待越过瓶颈；未调整游戏规则或硬门禁。

### 云端工具衔接

采用 6C1 云端预算、路线及 source，来源与限制见 [6C1 报告](phase6c1.report.md#云端性能验收与预算采用2026-10-17)。`6c1` 成为可用 A 身份，新增未校准 `6c2` 作为 B；缺 6C2 manifest 的普通预算检查仍必须失败，不会把 C1 预算冒充 C2。

冻结输入从 dispatch 的 control checkout 读取，因为历史 A=e276484 提交早于云端预算采用；A 仍用自己的生产代码原捕获，每个 recordingHash、事件数都必须匹配冻结输入。工作流仅将 control 的两个路线规划脚本复制到历史 A/B 临时检出目录；原生成器/捕获器/观察器/比较器字节一致性检查保留，并加上新 helper。引擎必须 clean，原 observer、OOS、语义/双 RNG、17 项计数、D6 阈值及 freezer 均未修改。报告继续保留实际 A/B/control 身份和所有工具 hash。

`profile-ext-6c1.mjs` 的原 C1 套装小场景仍执行，明确不是新的 C2 插槽专场。其 v3 手造实例在当前 C2 `loot=0.7.0` 上实测 `INVALID_ITEM`；只将 fixture 版本按 `0.6.0→3 / 0.7.0→4` 有限映射，未知版本拒绝，其余布景/纯读对象图、ID、事务、重复计数断言原样保留。修正后当前源码小场景 pass；日志 `c1-scene-old.log`（失败）与 `c1-scene-fixed.log`、结果 `c1-scene-fixed.json`（通过）。该功能验证不作为本地性能 A/B 结论，C2 孔数/匹配专场仍属此前报告的未验范围。

### 重新触发 6C2 云端 A/B

维护者提交并推送本次**工具及冻结制品**后，选择包含本次修复的 workflow revision（例如届时的 `ext/phase6`）dispatch `.github/workflows/ext-perf.yml`。本次不代为提交或触发。

| 参数 | 值 |
| --- | --- |
| workflow ref | 包含本次修复及冻结文件的 `ext/phase6`（不能用旧 feb33b0 作为 workflow ref） |
| base_ref | `e27648489953069b9aca4c9cf2b8a5ed5162a372` |
| head_ref | `feb33b030f74949a2e0af001362b53f2f6e0eea3` |
| base_identity | `6c1` |
| head_identity | `6c2` |
| rounds | `3` |

```sh
gh workflow run ext-perf.yml --ref ext/phase6 \
  -f base_ref=e27648489953069b9aca4c9cf2b8a5ed5162a372 \
  -f head_ref=feb33b030f74949a2e0af001362b53f2f6e0eea3 \
  -f base_identity=6c1 -f head_identity=6c2 -f rounds=3
```

B classic/all 仍从新局生成并捕获完整 D20 输入，all 可比前缀重新从生产结果求得，不使用任何历史常数。完整工作量不同的时延按原政策只报告，可比前缀决定相对裁决；完整路线的 OOS/语义/工作量硬验证不跳过。通过三轮与独立冻结后第四次检查才生成 `ext-perf-6c2-budget.suggested.json`；本次未冻结 C2 预算、未宣称 C2 云端或整个阶段验收通过。


### 限定脚本验收记录

证据根目录 `/private/tmp/phase6-route-fix/`，所有 >1 MB 录像/观察器原始数据留在该目录。按用户范围没有跑完整 npm/ext/drift、CE/full/gen、build、浏览器或完整三轮本地 A/B。

| 检查 | 结果 |
| --- | --- |
| `node scripts/test-ext-perf-route.mjs` | exit0；阻路攻击、往返/长绕行、楼层重置、不可达拾取、蛛网/熔岩、重试上限及非路线错误不吞掉 |
| `node scripts/test-ext-perf-selection.mjs` | exit0；已冻结 C1 完整制品、未校准 C2 拒绝、缺文件/hash 漂移/未知身份/冲突参数/自动前缀 |
| `node scripts/test-ext-perf-ab.mjs` | exit0；新 C1→C2 参数与原 OOS/计数/1ms/2-of-3/P99/冻结负例 |
| `npm run check:test-dependencies` | exit0，`errors=[]`；`dependencies-final.log` |
| C1 冻结后独立回放数据的离线预算检查 | exit0，classic/all hard pass；`c1-frozen-check.log` |
| C1 小场景在 C2 的夹具兼容验证 | exit0，`c1-scene-fixed.json` status pass；不作为性能结论 |
| 历史 A/B 捕获器、observer、common、comparator 字节核对 | 与 control 相同；原预算与云端建议除 provenance 外深比较相等 |

旧脚本测试前提变化：开工未修改文件时，原 `test-ext-perf-selection.mjs` 与 `test-ext-perf-ab.mjs` 均 exit0。本次明确采用 C1、新增 C2 后，将“C1 未校准/不能作为 A”前提转到仍未校准的 C2，将未知身份负例转到 C3；未知/未校准拒绝语义及全部性能断言未放宽。新路线测试早期两次失败来自测试布景未初始化每层规划状态、以及期望未考虑合法对角最短路，分别修正测试初始化和预期首步；未修改游戏代码或原守卫。

本地 Vite SSR 仍输出既有 HMR `listen EPERM :24678` 提示；引擎脚本继续正常完成，日志保留，不改 observer/common 来隐藏该提示。


### 当前 B 的确定性生成（最终源码）

Node v24.19.0、heap 3072 MiB，固定 seed `438491256`、全部 8 模块、wizard；`final-1` / `final-2` 两次独立进程均 exit0，完整到 D20、500 次结算行动、最大 28 怪 / 188 地形光源，**2423 条录制事件**。两次都仅经历一次 D6 无路重试，采用 D6 入口 1 次等待；所有失败与回退记录也相同。

两次的 `.recording.json`、`.route.json`、`.source.json`、`.recovery.json` **逐字节一致**；生成开始/结束的工具 hash 一致，`git diff HEAD -- src` 为空。录像完整对象 SHA256（原工具 `sha256(JSON.stringify(value))`）为 `cdcb13635af4c1a29bc4bb529bf662d34e6f5e420d07f2dc9f2c4044834475c9`；带缩进/末尾换行的原始录像文件 SHA256 为 `f86cafc89419617d5ef0bfd49cf9746b20585f558ca8bccae522a7d26b7182e5`，紧凑路线文件 SHA256 为 `037cd4197249316b215fc4607cbb9813e6f13c4a6d025f8c59e36367132aa6eb`。汇总在 `verification.json`，源码/工具身份在 `final-source.json`。

生成器 SHA256：`08db39c98b875c79cd8fdde4c4c5b622df0cddfe057e1cdb0eaf83e3afff93f3`；规划 helper SHA256：`de82f77593f525996a194b3cefa8d6dc6faf65ecc49fba876a607abe7e7cb44d`。重现命令（本机使用上述 Node 24 二进制）：

```sh
node scripts/generate-ext-perf.mjs /private/tmp/phase6-route-fix/final-1 all 438491256 500
node scripts/generate-ext-perf.mjs /private/tmp/phase6-route-fix/final-2 all 438491256 500
```

当前 B 与 6C1 云端原录制内容经原 `comparablePrefix` 求得 **47 条**相同输入/结果前缀。云端仍须重新捕获并由 observer 验证，不能把此短前缀当 D20 相对时延证据；完整 D20 负载及其正确性仍独立保留。自然怪物/光源数与旧路线不同，不以改世界或减少等待得到结果。


完整回放核对：原 `profile-ext-perf.mjs` 在未修改的当前 B 引擎上处理 **2423/2423 事件，exit0，OOS=0，末层 D20**；客观块/rounds=2549、roundTicks=253375。回放输入为预验证 `gen-4/all-438491256.recording.json`，已与最终 `final-1/final-2` 的完整录像逐字节比对相等；因此是同一最终输入的一次完整回放，没有再做三轮计时。运行命令：

```sh
node scripts/profile-ext-perf.mjs \
  /private/tmp/phase6-route-fix/gen-4/all-438491256.recording.json \
  /private/tmp/phase6-route-fix/replay
```

`replay.summary.json` 的 recordingHash 与上述一致，stateHash=`65480287d7135b64d16f39487be805843f6fd526c135fa947b9318e5cfdc7d77`，rowsHash=`7d0ecbf759d7e983b721122c468d3b058fb2be4694591c20972141f9d7b35ca1`。完整 observer 的双流、检查点与最终状态校验保持；`verification.json` 最终 status=pass。生成/回放曾并行运行，本机时间只作诊断，不能拿来判断云端性能。最终 `git diff --check` 通过，改动文件均 LF 且小于 1 MiB，游戏源码未改；未 commit/push。


## 第二次云端生成失败：classic 规划器隔离修复（2026-10-17）

本节覆盖上节关于 classic 也使用恢复规划器的实现。开工 `ext/phase6` / HEAD `0ed9dda9fbe3b9c6ec89ea35bd38c40f8e6d1e2d`；固定引擎 A=`e27648489953069b9aca4c9cf2b8a5ed5162a372`、B=`feb33b030f74949a2e0af001362b53f2f6e0eea3`。本次只改脚本、工作流说明及本报告，不修改游戏代码、冻结路线/预算、observer、捕获器或 D6 判定规则，不 commit/push、不触发云端任务。

### 根因与 classic 行为判断

失败证据：[run 38954039307](https://github.com/coolking70/BrogueJS/actions/runs/38954039307)，本地 `/private/tmp/perfci-38954039307/ext-perf-38954039307-1/`。三个实际执行步骤均 exit0：B classic 生成、A classic 捕获、B classic 捕获；随后命令数组断言 `Classic route changed` 失败，尚未执行 all 或任何性能回放。

- A 使用 control 中已冻结的 C1 classic 路线（2208 事件），B 使用 `0ed9dda` 新规划器（2243 事件）。两份输入各自都精确匹配其 source/hash，因此并非捕获器漂移或身份选错。实际 A/B/control 提交号分别与上文一致，生产源码 clean，observer hash=`6e23847b7d9d97a01ee42c77388bf012be62fb45f9ac4895e69434432879bef3`。
- `0ed9dda` 的避蛛网、阻路可选拾取放弃、封边及入口等待策略未按 classic/all 隔离，改变了 classic 的玩家输入。首个命令差异为第 **713** 条（D10）：冻结路线 `move(-1,0)`，新路线 `move(-1,-1)`；新路线后来在 D18 失败六次，最终添加六次入口等待。A 没有重新规划，仍按冻结命令执行。即使两侧脚本字节相同，也不代表“一侧读旧冻结输入、另一侧运行新规划器”所得输入相同。
- 独立诊断在 B 上用原 `regenerate-ext-perf.mjs` 执行 A 的完整冻结 classic 命令。该命令按预期以 **exit1** 保留 `.mismatch.json`：跨 foundation 版本的完整录像 hash 不相等，不能直接拿 A hash 当 B hash。逐叶差分仅有 `codec.foundation` **17→18**、`initialDigest.root`、2208 个 `events[*].chainDigest`、9 个 `events[*].fullCheckpoint.root`；其余全部字段相等，包括所有事件输入/结果、双 RNG、初始及完整检查点的全部域摘要。
- 根摘要包含 `RecordingDigest.ts` 的 `codecIdentity`，链摘要由含 codec 的录制 header/initialDigest 起算；上述差异是版本身份变化的确定结果。另对初始与9个完整检查点共10对根摘要按原公式离线重算，仅替换 codec 中的17/18就精确复现两侧根（`codec-root-attribution.json`）。没有改写录像 header、摘要或检查点来绕过验证。B 的原生重新生成录像继续使用 foundation18 并由其自己的 hash 校验。

**判断：本次 classic 断言失败来自采集规划策略不一致，不是已发现的 6C2 classic 游戏行为/RNG 缺陷。** 固定 B 引擎，仅恢复 classic 规划算法后，完整输入恢复冻结的2208条；同输入两侧的状态域和双 RNG 证据相等。此结论针对本次完整 D1–D20 基准路径；不冒称穷尽所有 classic 玩法。宿主差异审阅亦未发现本次路径绕过 classic/extension 分支进入 loot 的执行点。

### 修复

`ext-perf-route-recovery.mjs` 增加独立的 `nextClassicRouteStep`，从 `feb33b0` 的原生成器提取原 BFS，保留方向顺序、可选装备目标、穿怪回退与蛛网最短路径选择。`generate-ext-perf.mjs` 仅在 `combination=all` 时启用恢复状态、每层预算、失败重建及入口等待；classic 保留原全局16000命令/原地600次上限，失败立即报告，不进入 extension 重试。source 的 planner 描述也按实际策略区分。工作流继续把同一份 control 工具复制到 A/B，明确标示 frozen classic BFS / all-only recovery。

原 `Classic route changed` 命令数组断言、每份录像 hash、完整 D20/500结算覆盖、回放 OOS、语义/双 RNG、17项计数与预算判定全部保留。未把 classic 改成短前缀或 report-only，也未重录冻结 classic 文件。新增脚本回归覆盖 classic 穿怪拾取/蛛网直路、完全不读取 recovery 状态、无路不申请入口等待，并补 classic 语义/RNG/工作量漂移仍硬失败及 rounds=1 不得冻结预算的负例。

### 本地完整流程冒烟

证据目录 `/private/tmp/phase6c2-classic-fix/`；独立检出目录为同名前缀加 `-A` / `-B`，两个引擎均固定到上述提交且 `src` clean。Node **v24.19.0**，每子进程 heap3072 MiB，复用本地相同依赖（A/B/control lock hash一致），工具按工作流 staging。云端失败运行用 v24.21.0；本次本地结果只验证流程及确定性，不作跨机器性能结论。

实际运行完整云端 orchestrator（无 `--limit`，非只测生成器）：

```sh
node scripts/run-ext-perf-ab.mjs \
  --base /private/tmp/phase6c2-classic-fix-A \
  --head /private/tmp/phase6c2-classic-fix-B \
  --out /private/tmp/phase6c2-classic-fix/smoke \
  --base-identity 6c1 --head-identity 6c2 --rounds 1
```

A 的 classic/all 按工作流通过原 `regenerate-ext-perf.mjs` 从新局执行冻结命令生成完整录像；B 的 classic/all 先从新局规划生成路线，再独立从新局重建并核对完整录像 hash。两侧每条完整路线各实际回放一次，all 另有各一次动态可比前缀回放；原预算检查和 C1 bounded supplement 仍执行。A 不用新 all 规划器替换冻结基准，避免把规划策略变化混进原预算身份。


classic 实际完整回放补证：A/B 都为2208事件、OOS=0、2431客观块/rounds、241350 ticks；17项调用计数完全相同。末态 `stateHash` 同为 `b099974554cdb317a829b00c8b3dd9cc53f82903d6a1611360be5bd8f5aacd70`，`eventDomainsHash` 同为 `3ae0c021ab4e915078c20582b5afe24f5c6ef5043bce91f5febe294e87cb372c`，`rowsHash` 同为 `e5d9b7e22d222a54659cf7b4ae088e6f6bbf68e0a62823f2154372b75c287bef`。最终实质/装饰流调用数分别5595527/556且两流完整状态相同。`verifiedFullDomainsHash` 是唯一不同的 observer semantic 汇总项，因为其输入保留了上述版本相关的 fullCheckpoint.root；所有 checkpoint 域本身相同。

B classic 原生录像 hash=`fd4fe3cc3d5051cdf5090358d64a52054fc6e6fad7c3d3083d51771e1f0a5128`，恢复记录为空；A classic 原冻结 hash=`651a38e00d142d91ba18b8d4fe86d4dab976750a2057815f217b8bec56917bca`。B all 为2423事件、D20结算500、最大28怪/188地形光源，仍仅D6入口1次等待，录像与上轮 `final-1` 逐字节相同，hash仍为 `cdcb13635af4c1a29bc4bb529bf662d34e6f5e420d07f2dc9f2c4044834475c9`。

### 最终限定验收结果

完整命令 **exit0**，16个步骤全部 exit0，`hard=pass`；因 `rounds=1`，总状态按原规则为 **`incomplete`**，不是正式性能 pass，未调用 freezer、未生成 suggested manifest。生成/命令一致性断言、四份完整录像及两份前缀回放、原 C1 预算硬检查和 C1 bounded supplement 均实际完成。`smoke/result.json`、`smoke/summary.md` 保留全部结果，`verification.json` 为额外离线核对汇总（status=pass）。

| 侧 / 场景 / 输入 | 事件 | OOS | 客观块 / rounds | roundTicks |
| --- | --- | --- | --- | --- |
| A / classic / full | 2208 | 0 | 2431 / 2431 | 241350 |
| B / classic / full | 2208 | 0 | 2431 / 2431 | 241350 |
| A / all / full | 2528 | 0 | 2391 / 2391 | 237584 |
| A / all / prefix | 47 | 0 | 45 / 45 | 4500 |
| B / all / full | 2423 | 0 | 2549 / 2549 | 253375 |
| B / all / prefix | 47 | 0 | 45 / 45 | 4500 |

classic/full 与 all/prefix 均通过语义/RNG/工作量硬检查，单轮相对计时状态为 incomplete；all/full 因两侧工作量不同按原政策 report-only。47条前缀是本次生产捕获动态求得，不能替代 D20 性能证据。A 的 `original-budget-1` 对 classic/all 的 hash、完整语义及17项计数检查均 hard pass。原 supplement 仍是 C1 套装专场，不能冒充 C2 插槽专场。

| 限定检查 | 结果 / 证据 |
| --- | --- |
| `node scripts/test-ext-perf-route.mjs` | exit0；`test-route-final.log`，新增 classic 规划隔离负例 |
| `node scripts/test-ext-perf-selection.mjs` | exit0；`test-selection-final.log` |
| `node scripts/test-ext-perf-ab.mjs` | exit0；`test-ab-final.log`，classic 漂移仍拒绝、单轮不得冻结 |
| `npm run check:test-dependencies`（另以 Node24 直接复核底层脚本） | exit0、errors=[]；`dependencies.log` / `dependencies-final.log` |
| 完整 rounds=1 orchestrator | exit0；`smoke.log`，16步骤及6次回放全部完成 |
| 离线完整结果、classic全部差分/计数及工具身份核对 | exit0；`verify-smoke.mjs` / `verification.json` |
| 仓库差异检查 | `git diff --check` 通过；仅6个工具/测试/工作流/报告文件变更，全部 LF、小于1 MiB，A/B及主工作树的游戏源码未改 |

没有运行全量 npm/ext/drift、CE/full/gen、build 或浏览器测试。所有既有断言保留，仅新增回归；没有旧测试前提改写。引擎和工具相关原始证据均留仓外，不提交大文件。Vite 既有 HMR `listen EPERM :24678` 日志仍保留，未改 observer/common 隐藏提示。

本次实际执行的生成工具 SHA256 与最终文件一致：

| 文件 | SHA256 |
| --- | --- |
| `generate-ext-perf.mjs` | `a251310efe43cd406fd41c4b2c3f503e0368cd6f97a8e895f70f960c23297750` |
| `ext-perf-route-recovery.mjs` | `fe4c6afeeefe6c27a493bf4a6cd712e259a5c0238d130879bffaf60665ce2903` |

全部 orchestrator 已登记工具 hash 在结束后逐一复核一致；workflow 本次仅更新策略描述及步骤名称，staging/参数/执行路径未改。原失败 artifact、跨版本诊断的预期 exit1 与完整冒烟 exit0 分开保留，不把前者隐去。未 commit、未 push、未触发新云端 run。

### 重新触发参数（本次修复版本）

维护者后续提交并推送工具修复后，以包含本次修改的 workflow ref dispatch。**不要再次用旧 `0ed9dda` 或 `feb33b0` 作为 workflow ref**；引擎 A/B 仍固定下表提交，不随工具提交漂移。

| 参数 | 值 |
| --- | --- |
| workflow ref | 含本次 classic 隔离修复的 `ext/phase6` |
| base_ref | `e27648489953069b9aca4c9cf2b8a5ed5162a372` |
| head_ref | `feb33b030f74949a2e0af001362b53f2f6e0eea3` |
| base_identity / head_identity | `6c1` / `6c2` |
| rounds | 正式 `3`；如先做云端诊断则 `1`，不得冻结 |

```sh
gh workflow run ext-perf.yml --ref ext/phase6 \
  -f base_ref=e27648489953069b9aca4c9cf2b8a5ed5162a372 \
  -f head_ref=feb33b030f74949a2e0af001362b53f2f6e0eea3 \
  -f base_identity=6c1 -f head_identity=6c2 -f rounds=3
```

本地冒烟能证明固定 A/B 在修复工具下通过完整生成、原生捕获、回放与硬判定路径；正式云端三轮时延、独立第四次冻结后验证及 C2 专场仍按原范围待验，不据本机计时预判 D6。

## 性能剖析与已知开销预算（2026-10-17）

本节覆盖前文性能待验状态。结论：**没有发现能解释云端尾延迟、且值得实施的低成本生产优化；不改游戏代码。按维护者本轮给定的回退选择，接受此次短前缀尾延迟为已知开销，以原云端 B 三轮完整数据冻结 C2 预算。** 这属于明确接受已测回归，不是将 D6 判定改成 pass；具体微观成因仍未确证，不能声称已定位成孔/符文计算或已经修复。D20 完整路线仍属不同工作量，不能拿本节的 D1 结论外推。

### 输入、方法及可复现性

- A=`e27648489953069b9aca4c9cf2b8a5ed5162a372`；B=`feb33b030f74949a2e0af001362b53f2f6e0eea3`；H=`c1f68d0`。B/H 的整个 `src` tree 都是 `5c588225980a69b5a12a0d2572a1a3aee899beca`，本轮生产源码保持该身份。A/B 使用既有独立检出 `/private/tmp/phase6c2-classic-fix-{A,B}`，H 使用当前工作树，依赖相同。
- 输入直接使用 run [38960940396](https://github.com/coolking70/BrogueJS/actions/runs/38960940396) artifact `inputs/{A,B}-all-prefix.json`，各自原生版本头/检查点原样保留；H 使用 B 原录像。两文件各 73,710 字节，文件 SHA256 分别为 `ae44a0a2fc7d22e1f586c61460fcff1c1293a75b3d8668a756683bfca62ae371`、`2101583a97e2e5685e5e4cf0759e4b5b9f2016d3e6aa1f7a28896f77a743d840`。47 条同输入/结果前缀，D1、45 块、4500 tick、最大7怪；不截掉早期慢命令，不抑制检查点。
- Apple M5 / darwin arm64 / Node **v24.19.0** / heap3072 MiB；云端 Node v24.21.0。沿原 observer 的12次未计时 wait、原生 `loadReplay`、固定 `Date.now`；wall、CPU、细分插桩分别执行，各子进程串行，不与测试/build争用。
- wall 五轮顺序为 ABH、HBA、ABH、HBA、ABH，未增改原 observer。CPU 为各版本1次默认采样及另3次100µs采样。细分为各版本3次函数计数/包含时间，另3次带推进段归属与掉落请求的计数。后者用仓外 Vite transform 对指定函数体插入 `try/finally`，不修改生产文件；计时只用于归因，不用于门禁。
- 原始证据与探针在 `/private/tmp/phase6c2-profile/`：`run.py`、`cpu100.mjs`、`run-cpu100.py`、`instrument{,2}.mjs`、`detail{,2}.mjs`、`run-detail{,2}.py`、`analyze-cpu.py`，以及对应 `*-wall-*` / `*-cpu100-*` / `*-detail*` 输出。45次正式前缀回放逐份比较原云端对应侧的完整 state、逐事件 domains、full-domains、17项计数、双流及全部 semantic 字段，全部精确一致、0 OOS；见 `verification.json`。开头另有1次 Node25 默认CPU探索，仅留原文件 `A-cpu.*`，不纳入以上比较和统计。
- A/B 最终状态仅8个叶不同：foundation版本2处、loot模块/rules版本2处、rules/catalog/world definitions指纹3处、地面一件loot实例v一处；无物理状态或随机流差异。H/B 全状态一致。控制台 Vite HMR 监听有 sandbox EPERM 警告，SSR回放完整退出0；这发生在计时前，不伪称启动无警告。

复跑 wall 单次的原方法（cwd 切到对应引擎；所有路径均为仓外证据路径）：

```sh
/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  --max-old-space-size=3072 \
  /Users/coolking70/Documents/同步空间/BrogueJS-p6/scripts/profile-ext-perf.mjs \
  /private/tmp/perfci-38960940396/ext-perf-38960940396-1/inputs/A-all-prefix.json \
  /private/tmp/phase6c2-profile/new-A
```

B/H 换 B 原生输入；CPU默认采样加 `--cpu`，100µs及细分用上述独立探针。既有输出不得覆盖。

### 云端尾部位置与本地配对结果

门禁的 `round.p95` 是 `observeObjectiveWork` 统计的**完整客观推进工作**，包含怪物行动；`objectiveBlocks.p95` 只计 `Game.objectiveTimeBlock`。原云端 19→21 ms 指前者，不应混为后者或每块稳定增加2 ms。

| 云端轮次 | 完整客观段 P95 A→B（ms） | 相对差 | P95所处命令 |
| --- | --- | --- | --- |
| 1 | 18.963→21.589 | +13.84% | A=3，B=7；B另有命令23插入尾部 |
| 2 | 18.604→20.654 | +11.02% | 两侧均3 |
| 3 | 18.206→20.313 | +11.58% | 两侧均3 |

45个样本的 nearest-rank P95 是第43个，即第三慢样本。三轮最大值均在命令8（实际rat死亡、图捕获），不是P95的通常来源；不能因CPU里捕获显眼就将P95增长归因于捕获。原 run 硬门禁pass、classic 0/3、all/prefix 3/3 regression完整保留。

| 本地轮次 | A P95 | B P95 / 相对A | H P95 / 相对A |
| --- | --- | --- | --- |
| 1 | 5.631 | 5.851 / +3.91% | 5.578 / −0.94% |
| 2 | 5.630 | 5.962 / +5.90% | 5.762 / +2.34% |
| 3 | 5.660 | 5.566 / −1.66% | 5.507 / −2.70% |
| 4 | 5.760 | 5.556 / −3.54% | 5.535 / −3.91% |
| 5 | 5.407 | 6.230 / +15.21% | 5.784 / +6.96% |

单位ms。配对相对差中位数 B **+3.91%**、H **−0.94%**；仅按+10%比率计B为1/5、H为0/5，B第5轮绝对差0.823ms，尚未超过原D6的最小1ms噪声门槛。这里不是正式三轮云端门禁，也不是“优化后回到+10%”：生产代码根本未改。同源码B/H也会分开波动，故不能将这组数据解释成一次修复。wall总时长中位数 A/B/H=427.94/426.34/427.20ms；完整客观段总时长中位数190.49/187.80/189.94ms，未复现稳定累计增长。

### 分段计数、耗时及新增工作

下表计数为 A/B/H **全部相同**（各3次重复一致）；时间为第二组细分3次中位数，仅统计 `advancementLoop` 内的调用。包含时间有嵌套，不能相加；“每块”均指整段除45的摊销，不声称每一块都执行了该项。

| 分段 | 全前缀次数 / 推进内次数 | 推进内 A / B / H 总ms | B摊销ms/块 |
| --- | --- | --- | --- |
| 属性来源汇总 `runtime.collect` | 3011 / 972 | 28.199 / 26.200 / 26.076 | 0.5822 |
| 其中 loot provider | 3011 / 972 | 1.229 / 1.251 / 1.232 | 0.0278 |
| 来源 JSON 校验（含递归） | 89151 / 33837 | 7.186 / 7.212 / 6.799 | 0.1603 |
| `validateStatRows` | 3049 / 979 | 1.845 / 1.859 / 1.800 | 0.0413 |
| `invalidateStats` | 62 / 48 | 0.115 / 0.111 / 0.114 | 0.0025 |
| extension事务 | 97 / 2 | 2.705 / 2.642 / 2.687 | 0.0587 |
| JSON事务捕获 | 194 / 4 | 0.028 / 0.028 / 0.029 | 0.0006 |
| 独立图捕获 `checkpointGenerationWorld` | 13 / 4 | 27.782 / 29.060 / 28.653 | 0.6458 |
| 合并图捕获 `checkpointGenerationWorldGroups` | 1 / 1 | 0.922 / 0.904 / 0.908 | 0.0201 |
| loot掉落provider（整个调用） | 1 / 1 | 0.106 / 0.103 / 0.103 | 0.0023 |

其他稳定工作量：属性cache hits/misses **5881/3733**、pipeline clear61、物品装备事实3011、套装来源850（推进内287）、`collectExtensionComponents`93、`settle`93、vision137、gas90、light mask6300、occupancy89077。没有C2引入更多查询、来源行校验或失效的计数证据。

- **孔/符文/词行进入属性管线：0次。** `projectItemModifiers`、`socketRows`、`matchRuneword` 均0；初始装备不带loot数据，唯一地面loot实例没有进入装备管线。新建“无孔装备快路”对本输入没有收益。
- **物品校验、显示投影：0次。** `validateLootItemData`、`deriveNativeFacts`、`projectLootKnowledge`、`assertLootKnownItem`、presentation的project/name/appearance均0；版本正确的原生load在计时区外完成，绑定复用既有检查结果。100次只读/成词场景不是本前缀，不能将其成本算到这里。
- **新增的实际执行代码很小且集中于一次死亡。** `requests.json` 证明仅有D1普通rat kill，0寻宝、无收据、无leader/champion。C2增加空`materials`数组、空映射/展开及材料分支判断；未生成装备/材料、未进入孔骰或符文概率路径。包含所有旧逻辑的整个掉落provider也只约0.103ms（摊销0.0023ms/块），无法解释命令3的云端P95差额；不能将该包含时间当成净新增时间。
- **事务/捕获不是新增次数。** 既有图捕获占相当时间，但同次数、同世界工作量，热点集中于命令8。改写写集或失效粒度会涉及回滚对象身份、派生属性与录像合同，当前无收益证据，成本/风险明显高于无条件加缓存。

100µs CPU采样各版本3次聚合，剔除inspector启停栈，按调用祖先分配互斥类别（不是各函数inclusive时间求和）：

| CPU样本归属 | A占比 | B占比 | H占比 |
| --- | --- | --- | --- |
| 属性管线及provider | 28.95% | 29.31% | 28.81% |
| 图捕获 | 6.92% | 6.88% | 6.78% |
| 事务剩余部分 | 5.56% | 5.47% | 5.39% |
| 摘要/快照 | 13.44% | 13.48% | 13.33% |
| 视野/光照 | 10.73% | 10.74% | 10.52% |
| 环境 | 9.61% | 9.59% | 9.49% |
| GC | 1.95% | 1.70% | 2.40% |
| 其余调度、原生行动等 | 22.84% | 22.83% | 23.27% |

采样总量A/B/H=1384.96/1390.66/1402.37ms；孔/词和物品显示投影均无样本。以上是**现有总成本构成**，不是“云端新增11–14%的分摊”。本地不能从近零、变号的净差中可靠估计新增占比，也没有云端CPU/GC数据来证明具体是哪次JIT、分配或调度造成尾部差额。早期短样本/运行时热度是待验证解释，不写成已确认根因。接受的已知限制是原云端这条47输入前缀的P95回归，不是宣称C2在所有负载上固定多耗11–14%。

### 预算冻结与后续触发

采用 [C2预算](../../scripts/ext-perf-6c2-budget.json)，并将原 artifact 的 classic/all `.route.json`、`.source.json` 逐字节冻结到 `scripts/perf/ext-6c2-late-*`；完整录像、状态、CPU profile不进仓库。原 `ext-perf-budget.mjs freeze` 读取 **云端B前三轮完整数据**，不使用47条前缀或本地计时校准。未附来源的原始冻结文件SHA256：`81d9a0086f666254439f93981c0b0e8082e1c21afb8bc5c39ece13d406ce83ae`。落盘预算仅增加 `provenance`，测量、计数、阈值、hash与policy字段保持原值。

`provenance.acceptance=known-prefix-overhead`、`cloudVerdict=regression` 明确区分“按本轮维护者授权接受”与“自动门禁通过”。注册C2 `accepted=true`，缺预算/路线/source、hash漂移仍拒绝。**未改** `ext-perf-ab-policy.mjs`、自动 `canFreeze`、observer、比较器、freezer、工作流、C1/B4预算、生产规则或生成输入；未来遇到同类D6回归仍会返回regression，不存在自动放宽接受路径。

冻结后在当前同源码H上各做一次独立完整原生回放（`freeze-check-{classic,all}.*`），使用原 `ext-perf-budget.mjs check` 验证；并将完整state、domains、full-domains逐份与原云端B第一轮比较。这是本地独立正确性/工作量复核，不是第四次云端计时，也不是新一次A/B通过。其最终实际结果见下表。

| 独立冻结复核 | 事件 | 客观块 | ticks | 结果 |
| --- | --- | --- | --- | --- |
| classic | 2208 | 2431 | 241350 | 0 OOS；原frozen check硬检查及完整JSON相等 |
| all | 2423 | 2549 | 253375 | 0 OOS；原frozen check硬检查及完整JSON相等 |

如需在维护者提交本轮预算/工具/报告后再运行原A/B，触发参数如下；本轮没有生产优化，不承诺该重跑会改变原regression，也不需要靠重跑偶然pass来追认本次已知开销接受：

```text
workflow: ext-perf.yml
workflow ref: ext/phase6（含维护者后续提交的本轮改动）
base_ref: e27648489953069b9aca4c9cf2b8a5ed5162a372
head_ref: <维护者提交本轮改动后的完整新SHA>
base_identity: 6c1
head_identity: 6c2
rounds: 3
```

本执行者没有commit/push或触发云端。预算来源仍绑定原生产B `feb33b0`，新head的`src`应继续为上述同一tree；不得把尚未产生的新提交号写成已验证身份。若今后要进一步解释这个尾部差额，需要同云端runner的逐命令CPU/GC/JIT证据；本地已有证据只足以排除本前缀上大多数假定的C2新增热路径。

### 本轮限定验证

- 生产文件没有修改，故没有新增游戏行为回归或重录黄金trace；必要回归放在性能身份选择与A/B策略脚本。C2接受后的原缺制品负例在空目录中继续执行，并将逐件缺失、hash漂移检查同时覆盖C1/C2。A/B的未知身份负例移至仍未知的C3；不登记或进入C3。
- 旧前提归因：改注册前，原 `test-ext-perf-selection.mjs`、`test-ext-perf-ab.mjs`、`test-ext-perf-route.mjs` 在原 `c1f68d0` 全部exit0，证据 `checks/`。本轮没有生产行为变化，只有“C2尚无预算/不能作为已接受A”的前提因实际冻结而过时；保留缺制品拒绝语义、原P95/P99/max/1ms阈值、2/3规则、回归禁止自动freeze断言，未修改生产守卫或任何性能容差。
- 最终相关脚本3项、boundary、测试依赖检查全部exit0，见 `checks-final/`。`vue-tsc -b` 与实际Vite生产build在本轮同一未变生产源码上exit0，见 `checks/types.log`、`checks/build.log`；build仅既有大chunk提示。没有运行全量npm/ext/drift、组合删除或浏览器套件。
- 原云端完整证据、45次前缀精确比较、2次独立完整冻结复核、测试退出码分开登记，不将它们拼成新一次云端A/B pass。`git diff --check`、LF及新增制品大小检查通过；所有提交候选文件均小于1MiB。
