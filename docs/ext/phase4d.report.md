# 4d-5 执行报告：整体被动变形、复制与坠落等待

基于维护者已提交4d-4并合入dot 3d追踪诊断的 `ext/phase4` HEAD `a2b58f83a9e4255b4f3be9499efd3b9399301202`，开工工作树干净。本轮交付 **4d-5 可独立验收子里程碑，完整4d仍未完成**：推进原剩余项5–7的整体被动polymorph、clone/plenty、坠落/缓存层/pending与已付款phased动作的交叉。按任务书允许的干净子里程碑收束，当前未完成范围仍逐项列为1–8。未暂存、commit或push。后方保留HEAD中4d-4/4d-3/4d-2/4d-1/4d-0历史报告原字节。

维护者已浏览器确认4d-4“两只织兽两行、成员概况正确”，并完成提交；这份确认沿本轮用户指令登记。本轮遵照“浏览器验收由维护者执行，不必尝试启动浏览器”，没有启动浏览器、Vite服务器或Playwright，不重复此前受限尝试。

## 整体被动变形与复制

任一真实活腿命中普通polymorph时，经可信群路由只转换核心一次；没有Boss身份额外免疫。只采用当前安装声明授权的目标身体，核心form必须唯一对应一个body，生产目录拒绝歧义；外围形态不作为独立变形结果。抽样保持原目录顺序和完整范围，外围条目与原生MONST_NO_POLYMORPH条目一样拒绝后继续抽样；同形/原生不可变形结果沿原有拒绝规则。不循环重抽到能塞进去的小身体。落脚沿既有polymorph确定性最近路径/环搜索，整个网格有限；每个候选同时核验全部真实部位的footprint、地形/水生、区域、重叠、连接树及128实体/512格全局预算。新目标采用声明preferred formation，复制则保留当前formation。尚未开放主动转换、非r0复合体pose、镜像或成员再生。

单体↔群体均先准备独立未发布值，再求完整落点，主体原对象/core ID不变。原生polymorph的关系、mutation、状态、抓持、携带生物清除、速度缓存及至少101tick仍由原routine执行；HP沿CE `Items.c:4572–4631` 的比例/保留伤量取较大值，并沿既有growth nativeMaximumBase去除增长最大值部分。新成员HP取转换后核心存活比例，不把腿HP相加治疗核心；原槽墓碑不继承到新身体。消失成员走无死亡退休，核心仍存活时保留原奖励主体，不发击败/成员死亡事实。新成员先用预备ID和明确群行为构造，无真实ID分配或睡眠骰；全体结构提交后才登记ID、出生与新的可信群身份。无位不改旧实体、关系、状态、群表或ID；已发生的形态抽样保留，真实魔杖原充能仍消费。

被动clone命中任一腿时复制整组活部位和独立深拷贝的removed槽/破坏收据/冷却，全部新ID；每个原生可变容器独立，内部leader引用重映射。沿CE `Monsters.c:568–628` 的copy例外清携带物、标记clone、至少101tick及性别选择，原encounter/Boss/成长及奖励组件不搬移到新ID；新成长组件仍由既有birth政策初始化。新birth为clone、对应各原来源，当前四种giants/growth/combat组合实际杀复制核心均没有增加XP，成员退休不发死亡。这是无正XP报价诊断原型的默认组合验证，不代替有价原型的复制奖励抑制验收。无位时不取随机、不分ID、不减原HP。

真实plenty魔杖命中腿时，资格和HP接收者路由核心；先整组复制成功，再沿CE `Items.c:5367–5399` 对两个核心ceil折半，腿当前HP保持复制值。没有把被命中的腿当成独立复制对象或错误折半。原生符文plenty调用同一整组clone，不额外套魔杖的HP折半政策。默认配置的出生标记/组件与零XP变化已验证；有价原型以及自定义growth clone奖励策略仍待验证。

## 整组坠落、缓存层与pending

坠落资格合并核心和活跃有效providesSupport成员，任一支撑或悬浮可维持整组；外围不独立坠落。一次真实环境推进只对核心结算一次原生6–12 clumped伤害与因果；核心致死整体终结一次，成员无死亡退休。存活则全体同时清旧层区域、抓持/入迷、旧corpse目标与原旅行标记，进入下层缓存或同一个现有pendingFallenByDepth队列，preplaced作为已结算的坠落收据。底层边界不创第41层或悬空群表。

下层完整配置无位时一个部位都不发布；pending不进当前空间索引/调度，不推进精神计时、HP/成员冷却，也不重复落伤。已有缓存层恢复及GenerationCoordinator入层沿同一整组批量预验；普通到达者先处理，群体由新端口restorePendingBodyGroups调用已有有界重试入口。仅入层或相关grid/occupancy/pending revision变化时按核心ID稳定重试，仍按完整实际配置求位；成功一次移动并发布全组。楼梯盟友followers整体跟随仍未接通。坠落/落脚本轮验证的是完整批量成功及无位等待路径，未将区域退出/入层异常纳入polymorph/clone的窄回滚承诺。

WholeRunSnapshot写入与纯解码均核验全组只能属一个当前/缓存/休眠世界或同一个pending队列。pending必须所有活成员齐全、preplaced一致、没有独立旅行/坠落标记，并满足几何/树距离；未访问下层没有地形，不能虚构clear-link或落脚许可。实际落脚仍提供真实grid进行全部连接/地形检验。篡改队列缺成员在旧局退休前拒绝；原ID/墓碑/gen0/分类/预算校验保持，没有新存档迁移、Game持久字段或U03登记变化。

## 窄事务与3b/3d已付款动作

polymorph/clone调用的commitBodyTransition为本轮独立登记的身体结构写集：原实体/玩家完整值图和引用、全层owned实体闭包、群表、列表、统计/公开知识、actor-action binding状态图、ID、两RNG、logger、runtime缓冲的资源/事实/消息，以及source/anchor WeakMap revision、production action checkpoint和phased defense bindings。借用既有对象图捕获原语，不声称floor-generation事务天然覆盖身体转换。polymorph删除可选字段时还恢复原own-key顺序/descriptor，完整图oracle不只比较存档投影。结构失败恢复原值、原对象关系和派生动作入口；所有环境接触在完整结构成功之后处理，合法新身体遇险不回滚成旧身体。移动逐子步接触/地图修改的窄回滚是独立剩余项，未在本轮宣称完成。

本轮发现runtime回滚JSON会更换模块状态对象，已付款live scheduler/session仍可能持有丢弃的突变ledger；新增checkpointActorActionBindingIdentity在原状态值图恢复、runtime rollback后核验规范JSON相等，再保留原binding对象身份。故障专项实际改变核心落点/形态后抛错，完整原生图、资源、ID/两流均恢复；随后的真实wait结果与从保存点新load的同后缀相同。没有重建并取消已经付款的原束来掩盖失败。

成功polymorph取消旧核心/成员来源geometry，活核心resource ledger保留，旧腿随行政退休清来源；成功坠落的活旅行者也保留ledger，在空间所有权移动完成后reconcileProductionActorActions重绑定恢复所属深度。旧windup变惰性并清locked cells，保留正的已付款恢复，不再释放攻击；pending期间冻结。clone不继承任何原paid bundle/payment/locked plan，原组已付款束继续。核心仍是唯一decision/time owner，成员不takeTurn、不推进原生timer，无嵌套executeCommand。未改3d可信member证明、part-break provider/fallback互斥、checkpointZoneBreak或3c dodge白名单。

| 共享文件/函数 | 本轮改动 |
| --- | --- |
| Game.polymorphBoltTarget/polymorphWholeBody/wholeBodyPlacement/commitBodyTransition | 一次整体抽样、全部位纯落脚、主体ID保留、独立结构写集/回滚 |
| Game.cloneMonster/cloneWholeBody、PLENTY分支 | 整组深复制/新ID/关系映射，核心一次折半，无主动split开放 |
| Game.creatureShouldFall/fallWholeBody/orderedBodyActors/translateBodyActors | 支撑联合、一伤、整组迁出、批量空间提交 |
| Game.restoreLevelResident/retrySquareLandings、GenerationCoordinator.generateDepth | 当前/缓存/新层恢复与无位pending统一整组发布 |
| WholeRunSnapshot.toWholeRunSnapshot/decodeWholeRunWorld/validateProductionGroupOwnership | pending全组所有权/收据/几何纯验证 |
| SpatialCatalog.bodyForCoreForm/isPeripheralForm/registerBody、Polymorph.polymorphSpecies | 唯一核心身体与外围抽样资格，保留原生完整目录范围的拒绝抽样 |
| SquarePlacement.squarePlacementCandidates、BodyConstraints.bodyConstraintsSatisfied | 全组候选资格先于最近选择；仅pending无地形几何验证 |
| Creature/Monster构造、copyNativeValue/copyForBodyPlan/copyForClone/polymorph | 未发布准备值不取ID/睡眠骰，容器深拷贝，复用原生polymorph数据输入 |
| CreatureSpatial.checkpointSpatialActorRevisions、PhasedAttackProduction.checkpointPhasedAttackSources | 原有已付款来源/防御的图外派生身份回滚 |
| ExtensionRuntime.checkpointActorActionBindingIdentity | 值图/JSON回滚后恢复原paid ledger对象身份 |

## 专项与旧测试前提裁决

新增 `src/test/phase4d_body_lifecycle.test.ts` **21项**，登记常规core组。真实玩家操作经executeItemCommand/executeCommand；private helper探针和诊断建场明确只作结构/故障功能验证，未冒充默认新局自然录像。覆盖真实魔杖腿→老鼠、老鼠→九部位且比例HP/ID；无位完整对象图/关系/状态；受损clone的墓碑/冷却/容器/内部leader/存读；clone与polymorph发布异常；支撑联合；真实wait的一伤pending/冻结/坏档拒绝；缓存层无位→入层等待→空间变化批量落脚；致命fall唯一死亡；四组合真实plenty与实际杀clone零XP；已付款windup的polymorph/fall取消、惰性正恢复、深度/存读同后缀；clone不继承paid plan；改变落点后失败的完整图及live后续行动恢复。最终新增项数见下方门禁。

只修订一项旧负例的夹具前提：phase4d_production_body.test.ts原“registered member geometry alone cannot grant an orphan publication or clone a slot”用真实owned腿断言cloneMonster返回null，依赖4d此前整组clone关闭。先仅回退生产Game.ts至HEAD，其他候选生产文件/原测试不动，该项通过（2.337s）；恢复候选Game原项失败（2.056s）。然后只把clone目标换为该用例已有orphan，仍断言返回null，未翻转断言、降低可信身份限制或改其他断言。证据 `/private/tmp/p4d5-counterfactual-head-game.log`、`/private/tmp/p4d5-counterfactual-candidate-game.log`及对应JSON；反事实脚本finally恢复候选文件。

开发失败均保留并修正：新wand夹具ID、flatMap索引误当catalog、CErat比例HP/物品ID预期、rollback字段顺序、pending writer遗漏队列、类型收窄、活fall来源ledger误退休、runtime live binding身份，以及最初故障墙位侵犯旧tether的诊断布景。最后一种将墙移至旧tether外而只阻挡新四格body，不放松合法旧图。最终v1相关集合另发现既有三项polymorph及三项dodge预备动作守卫失败：新增落脚多掷骰及抽样范围缩短；改生产代码恢复确定性落脚/原范围拒绝抽样，六项旧测试原文保持。追加外围拒绝抽样专项。没有修改旧容差、deadline、skip，未改守卫来接受新增偏差；最终门禁从新冻结候选重新开始，不拼接v1已过结果。

正式giants definitions/locale、生成基线及黄金trace不变，无重录。所有新增可见提示复用现有i18n的fall/plenty消息，无新裸显示文案。正式自然内容仍为seed7309/wizard/仅giants/D15；真实自然断足/击败、独立load后缀、逐条replay、三点seek与续录在最终候选重跑。其事件元数据及结果见下方；这不是normal平衡验收，新增转换/clone/fall专项的save/load后缀不替代这些生命周期的真实自然replay/seek证明。

## 最终开发期验收与性能

最终v2同一冻结候选的8项门全部exit0。Node24.19.0、3GiB堆、Vitest最多2workers；正式自然长文件与其余相关文件串行，合计 **125文件2793项全部通过**，其中本轮新增21项。按用户开发期功能测试政策，不跑完整npm test/全部test:ext/removal/CE full/gen；没有新增Game持久字段，U03状态合同未变。

| 门禁 | 实际结果 | runner耗时 |
| --- | --- | ---: |
| `node scripts/check-module-boundaries.mjs` | 通过，含唯一测试归属 | 1.662s |
| `npx vue-tsc -b` | 通过 | 7.478s |
| `npm run build` | 通过；保留既有大chunk提示 | 10.422s |
| 正式自然录像，单独运行 | 1文件、5项全部通过，各480s门限不变 | 423.292s |
| 其余124文件相关Vitest | 124文件、2788项全部通过 | 883.304s |
| terrain catalog白名单定向守卫 | 1项通过；名字选择外29项未运行，未新增skip | 2.153s |
| `check-module-composition-smoke.mjs --engine-only` | 16/16引擎组合通过，requestedScopePassed=true | 92.552s |
| `npm run test:drift -- --maxWorkers=2` | 4文件、5项全部通过 | 71.937s |

v1不是全绿：相关124文件2787项中6失败/2781通过（runner811.797s），在该门exit1后结束，terrain/组合/drift未运行；源码输入未漂移。修正生产代码后，生命周期21项和4文件定向7项通过（其余47项是名字选择外未运行，未新增skip），随后冻结v2重新串行执行上表全部门，不拼接v1结果。失败证据 `/private/tmp/p4d5-final-v1-gates.json`及相关log，定向结果 `/private/tmp/p4d5-v2-focus-lifecycle.log`、`/private/tmp/p4d5-v2-focus-old-guards.log`保留。

组合报告browser=not-run、整体passed=false，只认明确请求的engine-only范围通过；其中giants自然样例是原D3路径，不声称这份16组合报告验证了全部D15复合体生命周期。相关集合为原4d-4范围加本轮生命周期、W19/20/21/23/C5、原生战斗与growth生命周期/来源/clone overhealth等回归。全部原命令/文件清单见gate JSON。

正式自然元数据仍为 **seed7309 / wizard / 仅giants / D15**：2175事件抵达、2200首次断足、2435最终击败、coreId482、8足退休、核心HP0，与历史相同；原记录 `/private/tmp/p4d3-natural-acceptance.json`由既有专项捕获。新变形/clone/fall没有新增默认新局自然录像，不据上述旧自然链路宣称新生命周期replay/seek已齐。

冻结输入覆盖src/、scripts/、package/tsconfig/vite，共 **910文件**，所有门changedInputs=[]，开始/结束及报告写入前均相同。路径排序的紧凑JSON路径→SHA256再取SHA256为 `73a8ed9cb2453216fb4876bbe327eaccc72f164d36b9c25bfe00a0bda79e65bd`；开始/结束UTC `2026-10-05T16:18:49Z` / `2026-10-05T16:43:42Z`。原始证据为 `/private/tmp/p4d5-final-v2-gates.json`、同前缀各日志及composition JSON，不入库。

17实体诊断追击运行20条真实executeCommand(wait)，20条均整组移动；仅计命令，不含建场/断言。冷次 **37.341ms**，其余19条暖样本 **P50 33.619ms / P95 39.329ms**，最大 **39.329ms**。原始数据 `/private/tmp/p4d5-final-v2-command-performance.json`；另保留仅plan+commit的fixture计时 `/private/tmp/p4d5-final-v2-fixture-performance.json`，不把它当每命令耗时。这是Node诊断，不是自然局/浏览器/手机性能，未控制宿主负载，不据此声称改善或回退。


## 完整4d剩余项（当前，仍按原1–8）

1. **声明与群环境仍缺。** 正式原创身体/整组场地、27原生状态分类/可信路由保持，本轮补唯一核心body和纯整组转换落脚。仍缺核心/成员fixed-zone、攻击profile声明闭包、自定义/局部status profile覆盖、移动逐子步环境接触及相应地图/机械窄回滚；复合体fixed r0门保持。
2. **完整群AI仍缺。** 恐惧合法邻步、混乱唯一方向、催眠一次反向群落脚保持；有界远路、安全图/原生生存、盟友跟随/逃跑/施法完整优先级、受控攻击/恶心/抓取等全部移动出口仍待接线。新转换的有限最近落脚不是远路AI。
3. **攻击/效果的完整组合仍缺。** 双腿横扫、公开焚烧与1:4中央传伤保持；本轮追加四组合真实plenty核心路由/整组clone。仍需实际火球、多源growth/combat逐次消费全部条件、精神射线/面积效果及全部被动/治疗组合。
4. **完整破坏派生、引用与奖励组合仍缺。** 可信part-break provider/fallback、正式断足/自然核心击败保持；本轮补复制核心实际杀零XP、致命fall核心一次与旧腿无死亡退休。仍缺攻击profile失攻派生、全部外部关系/目标引用清理、原组实际XP数值、有正报价原型的clone奖励抑制和所有死因组合，不把内部clone leader remap当作全部引用清理完成。
5. **完整环境资格仍缺。** 核心唯一精神计时、全组支配/关系/纷争和局部毒火网保持；本轮核心/有效支撑联合坠落与一伤收据已接。仍需全套受击惊醒/原生被动/核心预算作用、全组飞行/潜水all谓词、核心携带物/熔岩/水流及其他环境组合。
6. **主要被动生命周期已推进，换层与真实录像仍缺。** 保core ID的单体↔群体原子polymorph、全新ID/深状态/无原奖励权利的整组clone、真实整组fall/缓存层/pending/入层重试及全组同队列/收据/树距离codec已接。仍缺整体楼梯盟友followers、fall/落脚区域退出等异常的窄写集回滚、pending部位叠位等全部坏档矩阵、其他迁层/瞬移/拉拽等完整出口，以及这些生命周期的真实命令save/replay/seek/续录交叉；原正式自然断足录像保持，本轮诊断后缀不冒充新自然转换录像。
7. **已付款跨生命周期诊断已补，正式完整组合仍缺。** gen0、每源付款/scope、来源破坏取消保持；本轮补windup整体poly/fall惰性正恢复、pending时钟冻结、clone不继承plan、失败live行动续跑。仍需完整群精神中断、正式profile声明后真实自然phased录像，以及楼梯跟随/所有生命周期交叉。D13成员再生/非零generation继续关闭。
8. **侧栏归并已由维护者浏览器确认，其他显示/平衡验收仍缺。** 当前/历史群行、核心HP/可见成员概况/详情、单腿命中瞄准检视和320/390客户端专项保持。隐藏核心的更完整既知群呈现策略、normal平衡仍缺；320/390真实CSS/触屏/ACK及本轮被动生命周期页面验收由维护者执行，本轮不启动浏览器。

## 保留的4d-4/4d-3/4d-2/4d-1/4d-0历史报告

以下为HEAD维护者已提交历史报告原文；其当时“当前剩余项”不覆盖本轮上方的新清单。

# 4d-4 执行报告：周围实体归并、群状态与关系路由

基于维护者已提交4d-3并合入dot 3d修复的 `ext/phase4` HEAD `81c82a023c4052f73f41c503d822dc6a8898e7ef`，开工工作树干净。本轮交付 **4d-4 可独立验收子里程碑；完整4d仍未完成**。维护者反馈的周围实体逐腿铺满侧栏已修复，并推进原剩余项1、2、3、5、8中的原生状态归属、群关系与显示链路。整体变形、clone、迁层等尚未开放，剩余项仍按原1–8列在下方。未暂存、commit或push。后方保留HEAD中4d-3/4d-2/4d-1/4d-0历史报告原字节。

## 侧栏、检视与公开知识

普通主题侧栏、ContextPanel紧凑列表和Sidebar抽屉共用 `publicSidebarEntityRows`；DisplayFrame捕获同一投影。**两只完全可见的页岩织兽，18个真实实体归并为2行**。每行使用核心字形/名称、核心HP条和数值，附“成员存活8 · 破坏0”；断足更新为核心93/96、存活7/破坏1。聚合行沿第一个已排序的公开成员继承列表优先级，腿focus映射到所属核心，距离取已公开成员的最近距离。

核心行点击详情、地图直接检视核心时，附当前可见成员清单，逐条给独立HP条/数值、行为关系和局部/共享状态。原 `sidebarEntityRows` 保留独立实体选择；地图命中、瞄准、单腿检视仍使用真实成员。列表不改实体表、hover、机械状态、输入日志或两个RNG。

归并只使用原 `publicMonsterGroups` 的公开DTO；核心不公开或幻觉时不发布群身份，原可见腿仍可独立列出。隐藏成员不发布ID/HP/位置；不完全可见时仅报“可见成员N”，不猜精确破坏数。核心当前隐藏、成员隐藏或已移位的旧行不能通过点击获得新身份。历史帧保存脱离实体对象的行与群DTO，后续断足不改历史HP/概况；演出busy时详情入口仍由现有presentation barrier拒绝。没有扩大FOV、telepathy或隐身身份门。

新增通用文案位于 `src/locales/zh_CN.json` 的四个sidebar键，全部经i18n。成员概况单独换行，主题侧栏跨剩余列、可折行；紧凑列表及抽屉用相同摘要。320/390的两个实际Vue组件已用客户端脚本/模板/生命周期主持测试验证；这些测试不实施浏览器CSS排版。

## 原生状态分类、唯一存储与关系

`src/data/body-status-profile.json` 为 `foundation:native` 提供27个已知原生状态（含burning/explosion_immunity逃生舱）的有限分类行：statusId、group/entity owner、merge、disables。SpatialCatalog校验完整集合、唯一ID、归属/合并/禁行枚举及精确字段，冻结后进入 `run.spatialWorld.definitions.statusProfiles[].rows` 已安装声明闭包。缺行、未知/重复行或脚本式禁行字段拒绝；不从保存数据创建新profile。本轮仅开放这份原生默认分类，未开放模块自定义profile/局部精神覆盖。disables描述沿原生状态资格执行，不能授权任意状态脚本。

14个group状态为麻痹、主动隐身、幻觉、混乱、再生、haste/hasted、减速、纷争、入迷、黑暗、恐惧、激怒和寿命；另外13个状态留在实体，包括毒、火、网、盾、虚弱、局部漂浮/飞行/免火等。群状态存核心，成员查询和免疫/抵抗判定路由核心；计时仍只遍历实际存储，成员不拷贝精神计时器。group apply按max合并，多部位重复施加不叠8份；entity继续原生毒浓度、盾吸收和缠绕规则。成员显示可读共享状态但不复制机械字段。核心加减速及到期通过每个来源自己的native speed重算所有来源，断足倍率仍从收据派生。

路由关联是ownedMonsterList验证真实群槽后绑定的WeakMap，每次读取复核当前群/part/form/活动generation0及核心。退休或伪造身份不能借序列化bodyMember获得群路由；当前、休眠、缓存与pending列表使用同一拥有者查询。pure群codec拒绝成员私藏群状态和任何实体的未知分类键，坏档不发布候选世界；读档发布后重建关联。没有新增Game持久字段或第二份状态表。

支配射线命中腿时，原生资格与一次成功率掷骰用核心HP；成功后将整组原生阵营/被支配标记更新，仍只花一次魔杖充能。becomeAllyWith通过腿调用同样作用整组，沿原生demote/drop清理各实体；敌我和队友查询按群核心关系，纷争不令本组成员互为敌人。原生睡眠决策仍由核心prelude唯一持有；全套受击惊醒/原生被动组合尚未验完。

催眠通过玩家移动的原入口，只让群核心作一次反向整组落脚，成员不各走一遍。恐惧的即时路径禁止足攻击，选合法且增加威胁距离的邻步；混乱移动只由核心在至多8个经过原128节点/32候选预算检验的整组计划中选择一次随机方向。这里没有复制旧TS单体70%分支：实际CE `Monsters.c:moveMonster`在非entranced的confused状态调用一次randValidDirectionFrom；`Movement.c:moveEntrancedMonsters`反向一次并排除麻痹/缠绕/俘虏。此轮仅实现合法整组移动出口，不宣称完整原生生存/施法/受控攻击优先级或远路AI。环境仍在整组终态结算，逐子步及窄回滚仍是缺口。

## 与3a0/3b/3d的共享接线

核心继续唯一decision/time owner；成员不takeTurn、无嵌套executeCommand、无成员原生timer推进。真实elapsed槽冷却、至多4来源max耗时、sourceEntityId/partId/generation0和每源付款/scope保持4d-2路径。共享hasStatus查询使原生资格/计划中断读到核心群状态；混乱/恐惧走native fallback。局部actionLock和毒火网仍属于具体成员。没有改combat part-break provider/fallback协议、可信member证明、poise owner、独立付款或恢复边界。

| 共享文件/函数 | 本轮改动 |
| --- | --- |
| UI/MonsterGroups.publicSidebarEntityRows/bodyMemberSummary/appendPublicBodyDetail | 只读群归并、公开摘要与可见成员详情，保留原独立选择 |
| displayProjection.observeDisplayFrame、三列表组件、nearbyDetail、Game.handleInspectAt | 同一当前/历史投影，fresh可见性重验，核心详情加成员 |
| SpatialSchema.validateNativeBodyStatusRows/statusProfile | 有限完整原生分类、冻结并序列化声明闭包 |
| MonsterLifecycle.ownedMonsterList、Game.bodyStatusContext | 真实owned成员验证后绑定可重建WeakMap，读取复核活槽 |
| Creature.has/get/set/applyStatus/hasStatusImmunity | group存核心和共享查询，entity原生路径保持 |
| Monster.apply/setStatus/refreshSpeeds、monstersAreEnemies/Teammates/boltEnemies | 核心精神效果/速度刷新及全组关系、自排除 |
| BodyGroups.validateBodyGroup | pure拒绝未知分类及成员私藏群状态 |
| Game.applyStatusToMonster/discordBlastFromPlayer/气体状态出口 | 群精神免疫/抵抗归核心，气体按实体暴露、核心max合并；混乱惊醒归核心 |
| Game.dominateBoltTarget/becomeAllyWith | 真实腿命中用核心判定一次、全组阵营与支配标记 |
| Game.moveEntrancedMonsters/takeBodyDecision/tryMoveBodyCore、PhasedAttackProduction.selectBody | 一次受控移动、恐惧邻步与混乱唯一方向；沿旧规划/终态环境及phased资格 |
| statusConfig.creatureStatusRows、MonsterSidebar.monsterBehaviorLabel | 显示共享精神状态/核心行为，独立局部状态仍可见 |

## 专项与开发问题

新增两文件共 **26项**：`phase4d_group_sidebar.test.ts` 8项（含2组件×320/390的4项真实客户端渲染），`phase4d_body_status.test.ts` 18项。覆盖两正式织兽18→2行、核心HP/断足概况、核心/腿检视、隐藏/幻觉/旧行、历史冻结和零RNG/零命令点击；8种群状态经全部成员施加但只存核心/真实wait只减一次；各来源速度与到期；局部毒/免火/网；关系/纷争自排除；完整分类/坏档原局不替换、读档状态续跑；真实魔杖支配一次付款/核心成功率、催眠反向群移动、恐惧无足攻击；整组格麻痹气体一次状态变化和一次倒计时、单腿燃烧一次HP/1:4传伤。

读档状态用例比较实体、群声明/机械表和RNG，不冒充新增精神状态的真实开局录像。真实开局录像另沿既有正式自然专项重跑：**seed7309 / wizard / 仅giants / D15**，2175事件抵达、2200首次断足、2435最终击败、coreId482、8足退休，与4d-3元数据相同；5个独立load后缀/全replay/3点seek用例通过，各保留480s原deadline。这仍不是normal平衡验收。

开发中的失败都在本轮新增代码/夹具：最初observeDisplayFrame漏logger参数；新状态夹具把executeCommand第三参数误传true；拒绝坏档比较漏归一化savedAt；类型收窄需显式Array分支，Sidebar残留一处旧选择器引用。修正后新专项26项通过。未改旧测试/守卫、断言语义、容差、deadline或skip；无需旧行为反事实修订。giants正式definitions/locale内容、生成基线和黄金trace未改、未重录。原生状态profile的新增rows进入复合体存档声明闭包，旧存档不迁移，按项目既定决策由严格声明校验拒绝不相符数据。

## 最终开发期验收、性能与环境边界

最终v1同一冻结候选的8项门全部exit0。Node24.19.0、3GiB堆、Vitest最多2workers；自然长文件与其余相关串行，合计 **110文件2424项全部通过**，其中本轮新增26项。按用户开发期政策，不跑完整npm test/全部test:ext/removal/CE full/gen。无新增Game字段，U03状态登记不变。

| 门禁 | 实际结果 | runner耗时 |
| --- | --- | ---: |
| `node scripts/check-module-boundaries.mjs` | 通过，含唯一测试归属 | 1.773s |
| `npx vue-tsc -b` | 通过 | 8.095s |
| `npm run build` | 通过；保留既有大chunk提示 | 11.337s |
| 正式自然录像，单独运行 | 1文件、5项全部通过，各480s门限不变 | 438.114s |
| 其余109文件相关Vitest（含合入3d） | 109文件、2419项全部通过 | 764.082s |
| terrain catalog白名单定向守卫 | 1项通过；名字选择外29项未运行，未新增skip | 2.023s |
| `check-module-composition-smoke.mjs --engine-only` | 16/16引擎组合通过，requestedScopePassed=true | 86.906s |
| `npm run test:drift -- --maxWorkers=2` | 4文件、5项全部通过 | 81.889s |

组合报告browser=not-run、整体passed=false；只认明确请求的engine-only范围通过。相关集合含4a0全对象差分、4a–4d、giants/growth/combat、3a0/3b/3c/3d（含本次合入动画/弹反提示修复）、状态/关系/侧栏/客户端UI、原生战斗/弹道/环境、whole-run/录像/UR2–4和仓库源码守卫。

冻结输入覆盖src/、scripts/、package/tsconfig/vite，共**908文件**，各门changedInputs=[]；开始/结束及报告补写时均相同。按路径排序的紧凑JSON路径→SHA256清单再取SHA256为 `428166d8ef08da7667b56b48c4ba26a00481d07aae7161659e593364a20b373f`，UTC `2026-10-05T14:26:51Z` / `2026-10-05T14:50:05Z`。原命令、清单、耗时为 `/private/tmp/p4d4-final-v1-gates.json`，各日志同前缀，组合详情为 `/private/tmp/p4d4-final-v1-composition.json`；原始证据不入库。

17实体诊断追击运行20条真实executeCommand(wait)，20条均整组移动；计时仅包命令，不含建场/断言。冷次**35.683ms**，19个暖样本**P50 33.738ms / P95 39.798ms**，最大**39.798ms**。原始数据 `/private/tmp/p4d4-final-v1-command-performance.json`。这是Node诊断，不是自然局/浏览器/手机性能；未控制宿主前后负载，不据此声称改善或回退。

沿用 [develop-web-game技能](/Users/coolking70/.codex/skills/develop-web-game/SKILL.md) 步骤7的“You must run `$WEB_GAME_CLIENT` after each meaningful change”。UI改变及最终候选后均执行原客户端；Vite监听127.0.0.1:5414返回EPERM，Chromium MachPortRendezvousServer返回Permission denied(1100)，自动浏览器inventory为browsers=[]。额外查看现有Arc入口，当前窗口不是本地游戏页，未获得本候选的真实页面。未绕过权限限制，无截图或触控验收；真实320/390 CSS/触屏/ACK仍明确剩余。日志 `/private/tmp/p4d4-browser-server.log`、`/private/tmp/p4d4-browser-client.log`、`/private/tmp/p4d4-browser-final-client.log`。


## 完整4d剩余项（当前，仍按原1–8）

1. **分类/正式生成已推进，声明与群环境尚缺。** 原生27状态分类/可信路由及正式整组场地保留；仍缺核心/成员fixed-zone、攻击profile声明闭包、自定义/局部状态profile覆盖、移动逐子步环境与窄事务回滚，fixed pose门保持。
2. **局部精神移动与关系已推进，完整群AI仍缺。** 新增恐惧合法邻步、混乱唯一方向、催眠一次反向群落脚；仍缺有界远路、安全图/原生生存、盟友跟随/逃跑/施法完整优先级、受控攻击/恶心/抓取等完整移动出口。邻步不能当作完整AI。
3. **群精神存储/计时已接，完整组合仍缺。** 原四组合双腿横扫/公开焚烧/中央1:4保持；仍需实际火球、多源growth/combat逐次消费全部条件、精神射线/面积效果和被动/治疗的完整组合。
4. **破坏/原生击败保持，完整派生与收据组合仍缺。** 仍缺攻击profile失攻派生、全部关系/目标引用清理、实际XP数值和所有死因组合验证；provider/fallback及3d可信身份/回滚未改。
5. **群状态/支配/纷争、局部毒火网已推进；完整环境资格仍缺。** 已有核心唯一精神计时、全组支配/阵营查询、局部毒火与stationary网腿。仍缺受击惊醒/全部原生被动和核心预算效果、全组飞行/支撑坠落/潜水all谓词、携带物/熔岩/水流等完整资格和环境组合。分类表不等于全部效果出口完成。
6. **整体生命周期仍缺。** 保coreID的单体↔复合体原子polymorph、整组clone新ID/深拷贝/无奖励、实际整组移层/pending仍关闭。正式破坏自然存读/replay/seek/续录保持，本轮另补状态诊断续跑，不替代转换/迁移录像。
7. **3b多源路径保持，跨生命周期组合仍缺。** gen0/付款/scope/破坏取消/存读保持；仍需完整群精神中断与正式profile的真实phased录像、整体转换/迁层交叉验证。成员再生/非零generation按D13继续关闭。
8. **维护者侧栏反馈已修复；真实设备/平衡仍缺。** 当前/历史三个列表按公开群体归并、核心HP/成员摘要/详情、单腿命中瞄准检视、公开裁切与320/390客户端专项完成。仍需320/390真实CSS像素/触屏/ACK切换、隐藏核心时的更完整既知群呈现策略及normal平衡验收。

本轮按任务书允许的干净子里程碑收束，不把剩余生命周期和组合能力标为完整4d。继续工作的主要接缝是逐段环境/完整群AI、整体polymorph/clone/迁层与其phased/真实录像交叉，再收束全部组合和设备验收。

## 保留的4d-3/4d-2/4d-1/4d-0历史报告

以下为HEAD维护者已提交的历史报告原文，其当时状态不覆盖本轮当前剩余清单。

# 4d-3 执行报告：正式复合体内容与自然可玩闭环

基于维护者已提交4d-2的 `ext/phase4` HEAD `0f89227f6626b59a77d3513bc6da91ffbc0b4067`，开工工作树干净。按本轮授权优先完成项1、8的内容闭环，交付可独立审阅的 **4d-3 子里程碑，完整4d仍未完成**。正式页岩织兽、整组场地验算、仅giants自然击败/断足存读/真实录像链路和公开核心HUD已接通；其余状态、生命周期和跨模块组合缺口仍逐项列在下方。未暂存、commit或push。4d-2/4d-1/4d-0历史报告原字节保留在后方。

## 正式内容、生成与公开显示

正式数据为 `src/ext/modules/giants/data/definitions.json` 的 `giants.shale-weaver`、`giants.shale-weaver-leg` 与 `giants.shale-weaver-body`，模板为 `giants.shale-chamber`。页岩织兽为2×2核心、8个1×1独立支撑成员，共9实体/12格，固定r0、generation0、无local zone。核心HP96、移动150/攻击150tick，岩足HP12/攻击200tick，伤害临时为3–6与1–3；断足remove-subtree、唯一收据派生移动倍率9/8与balance-loss4/fallback30，1:4传伤、全支撑毁immobile但核心仍可攻击。无新增硬依赖、Boss额外免疫声明或脚本AI；原尚未开放的整体转换门仍待后续接通，不能把它当作最终免疫策略。

侧室在D15–20、chance100，16×12、入口5格、候选≤16；只在giants开启时参与生成。位于原D3/D7/D11验收内容之后。`GenerationContribution.bodyId` 是可选已安装声明引用，`formId`必须匹配该body唯一核心；runtime在模块自己的nativeBodies闭包中复核，保存数据不能授权身体。giants pack增加可选bodies，沿既有SpatialCatalog注册/校验有限部位树和member-break规则，指纹包含正式声明。

`compositeSideChamberValid` 使用每个真实form的足迹/pose与preferredOffset，检查重叠、树约束、清洁地形、核心周围两格余量、整个房间所有可拟合整组锚点的连通、真实入口及玩家绕行空间。证明范围是固定preferred formation的单位平移；没有用核心面积代替整组，也没有把它当作任意变形落脚/远路AI证明。生成在原生放置/catch-up后复核场地，按整组格筛出有限锚点，再调用纯 `canCreateCompositeMonster`；通过后安装原owned region、用现有generation事务一次发布九实体自然出生，placement/encounter/Boss component仅核心一份。出生后各部位仍走现有4d-1移动/中央HP与4d-2多来源调度能力。

公开地图沿既有4a-3独立实体足迹路径绘制：核心W、岩足w，各自可命中/瞄准/检视；没有画出隐藏格。新增纯 `publicMonsterGroups` 为历史DisplayFrame捕获已见核心及已见成员ID/part/HP/裁切格。核心不可见或幻觉不发布群身份；成员未见不发布其位置/HP；完整当前可见配置及缺槽偏好格可见时才给精确破坏数，否则HUD只报可见外围数。HUD选择成员focus/aim时仍显示核心HP，历史帧不读未来对象，显示不消耗RNG。新增文本全部在giants locale；320/390客户端渲染主持测试通过，真实CSS布局/触控仍待浏览器验收。

## 共享文件函数级改动与原生击败出口

| 文件/函数 | 本轮改动 |
| --- | --- |
| ext/generation.validGenerationContribution | 可选bodyId的精确字段/同模块命名空间校验，旧声明对象形状保留 |
| runtime构造声明校验 | generation body属于本模块已安装闭包且form为其唯一核心 |
| giants types/schema/module | 可选bodies声明、纯SpatialCatalog闭包验证、安装nativeBodies；旧pack仍可读 |
| SideChamber.compositeSideChamberValid | 实际九部位配置的锚点图、约束/入口/玩家绕行验算 |
| Game.makeGenerationPorts.publishSideChambers | body-aware场地、整组锚点纯预验与自然批量出生；placement仍按core一次 |
| Game.preflightCompositeMonster/canCreateCompositeMonster/createCompositeMonster | 提取原整组纯预验供生成复用，构造/发布仍走原原子出生事务 |
| Game投掷/resolvePoisonDamage/玩家近战终结出口 | 退休成员不计击杀、熟悉度或掉落；用退休对象的原groupId身份判断，不依赖已清除活槽 |
| Game.finishBodyMemberDamage | 成员传伤使核心致死时，核心终结和统计一次；直接成员出口不重复计数 |
| UI/MonsterGroups.publicMonsterGroups、observeDisplayFrame | 按公开知识捕获可选群DTO，普通帧不增加群字段 |
| giants ui/view.selectBossHud、BossHud.vue | 可见成员focus映射到core HP；完整/局部外围概况与历史隐藏 |

新专项发现真实玩家击断一条腿虽无deathCaptured，却仍增加原生kills/武器熟悉度。修正近战、投掷和毒死亡出口后，又用先红后绿用例确认致命1:4传伤原先漏算核心击败；该唯一终结由finishBodyMemberDamage计数。成员仍无die/kill事实、死亡DF/掉落/独立XP，核心仍发一次原生死亡事实。这里验证统计和事实次数；尚未宣称所有XP数值/成长消费/各类死因组合完成。

## 自然验收与新增专项

**自然验收：seed7309、wizard模式、仅giants、D15。** 2175条记录事件经实际move/search/stairs及正常物品命令抵达，核心ID482、9实体自然出生；第2200事件保存首次断足，第2435事件击败核心，8条岩足均破坏退休。未生成注入、改图、改HP、重定位或加载诊断arena；wizard为真实开局选项，本轮不把其999HP当作normal平衡验收。路径选择只读地图，变化经公开命令；前11层用原路线助手，后段采用避开可选大型敌人且检查真实对角规则的路线。击败过程通过公开物品卸鞭和近战进行。

`giants_composite_natural.test.ts` 从真实开局捕获自然出生、击败与首次断足存档，最终拆为五个功能用例：新Game加载断足save后执行精确命令后缀并续录；新Game从开局每事件replay不OOS；三个新Game分别seek断足/抵达/最终，额外逐一比较该点原捕获的完整机械快照。共享的仅为公开命令生成后的脱离对象JSON，不共享活Game或诊断arena。机械快照比较只归一化savedAt与输入日志字段，未排除recordingOrigin或成员机械状态；与4d-2诊断存档不同，这次录像来源为实际开局链路。原始验收元数据 `/private/tmp/p4d3-natural-acceptance.json`；早期开发自然整链1项通过，实际356.16s；后续并发及单独运行分别超480s，见下方。最终五项各保持480s，既有测试deadline未改。

新增共**23项**：`giants_composite.test.ts` 16项、`giants_composite_sfc.test.ts` 2项、自然5项。覆盖安装闭包正反例、腿格挡墙时核心可拟合而整组失败/零ID-RNG、实际入口/场地拒绝、已有群根时正式generation发布失败的独立全对象图audit、四组合真实双腿横扫各一次/中央传伤、四组合公开投掷焚烧药剂多腿按part各一次、单腿毒伤每客观块一次/不推进成员原生timer、真实玩家腿破坏与core终结/致命传伤统计，以及公开DTO局部可见/历史HP和客户端HUD。投掷焚烧用例明确隔离物品/DF子段，客观毒伤另跑真实wait；它不是全部火球/精神/群环境组合验收。

开发途中修新夹具的非法runtime.setComponent调用、误用不存在的毒方法、readonly数组赋值及audit捕获时点/spy安装顺序；typecheck的Object.hasOwn改为项目现有lib可用的hasOwnProperty，没有改编译目标。自然路线初次2000命令预算停D14，后续route拒绝/卡住仅调整新的只读选路；最终公开2435事件完整通过。没有改旧守卫、容差、deadline、skip或原断言语义。

## 旧内容前提与trace逐字段登记

先保留失败，再只回退本轮生产 `definitions.json`，其他生产/locale/测试均保持候选：

- 原内容合同与三份原trace：新数据3文件6项中4失败/2通过；仅HEAD数据后3文件6项全过。原因分别是原3 form/3 template固定数量前提，及新声明指纹。仅把旧合同的精确数量前提改为5 form、4 template、5个唯一nameKey；原旧物种、字段、关闭默认、依赖、校验与唯一性语义保持。
- 4d-1/4d-2诊断：新数据使旧support覆盖nativeBodies而留下正式generation引用，两文件41项失败；仅HEAD数据后41项全过。support改为保留base的nativeBodies并追加诊断定义/规则，不改测试断言，也不放松生产可信声明校验。

- 最终v1相关集合发现原巨像用例要求D15无任何场地，与本轮D15–20正式声明冲突。先保留失败，只回退同一生产definitions.json：原用例在新数据下1项失败（5.984s），HEAD数据下1项通过（6.346s）。恢复新数据后仅将D15前提更新为页岩场地，并补D21无场地边界；D7/8/9竞争顺序、预算及每层最多一次成功断言保持。v1在该失败后主动终止，不拼接其已过门禁；冻结v2从头重跑。

证据分别为 `/private/tmp/p4d3-counterfactual.json`、`/private/tmp/p4d3-body-counterfactual.json`、`/private/tmp/p4d3-colossus-counterfactual.json` 及各同前缀log。恢复新数据后，经原入口 `BROGUE_CAPTURE_GIANTS_TRACE=1 npx vitest run giants_trace/giants_spine_trace --maxWorkers=2` 重录，2文件3项通过；三份trace各仅1叶 `$.extensionsHash` 变化：

| trace | 原值 | 新值 |
| --- | --- | --- |
| natural-trace | `631af57c013a929cd03dc284489a64fe145e3751dba6cedc593c7778a57320aa` | `5bc704bcddb8a049d6e120f4ed243e60d4093dd37306f2a33446da3129cea1b1` |
| colossus-natural-trace | `582cd61cbb0dffeed27a100be0eed709e0d646aa541aaa44123614d624e10b11` | `44f1ccf5d1beeabad8b7f1b02c38e328f51ca1665352d1761ba6b8f9c9d0d8cb` |
| spine-natural-trace | `e113aa7232c2eebcee47555ebb65cec5e742302c22dda4865065be70121f13f2` | `2aa0b596cc96edc954fc2500462419082b46051622947606bc3ed06ccf3a3ade` |

原因均为giants正式数据声明闭包改变；D3/D7/D11的命令、地图/实体、两个RNG与计数、placement/Boss事实均原字节不变。逐叶原始证据 `/private/tmp/p4d3-trace-leaf-changes.json`；普通生成基线和UR2/3/4未重录。

## 开发期最终门禁、性能与浏览器边界

最终v4同一冻结候选的以下命令全部exit0。Node24.19.0、3GiB堆、Vitest至多2workers；相关范围为原84文件+本轮3文件，共**87文件1822项全部通过**，其中新增23项。新增自然长文件单独运行，其余86文件另跑，两次都保留maxWorkers=2与原deadline，结果不重复计数。按开发期政策不跑完整npm test/全部test:ext/removal/CE full/gen。新增Game方法/派生显示DTO，无新增Game持久字段，状态合同无需变更。

v2同一900输入的完整相关集合为86文件/1817项通过，唯一失败为新增自然用例超480s（实际556.615s），runner945.277s后exit1；未进入terrain/组合/drift。v3在单独运行整链时仍超480s（494.342s，runner495.994s），未进入后续门禁。v4只把本轮新增自然测试拆为五个独立功能用例，保持每项480s和全部原断言，额外逐点比较三个新Game独立seek的完整机械快照；生产代码、旧测试和deadline不变。自然文件与其余86文件串行，从头重跑下表，不拼接v2/v3结果。原始失败证据 `/private/tmp/p4d3-final-v2-gates.json`、`/private/tmp/p4d3-final-v3-gates.json` 及各log保留；v1旧D15前提失败/主动终止另见上方反事实与 `/private/tmp/p4d3-final-v1-aborted.json`。

| 门禁 | 实际结果 | runner耗时 |
| --- | --- | ---: |
| `node scripts/check-module-boundaries.mjs` | 模块边界及唯一测试归属通过 | 1.697s |
| `npx vue-tsc -b` | 通过 | 7.438s |
| `npm run build` | 通过；保留既有大chunk提示 | 10.362s |
| 正式自然录像专项，单独运行 | **1/1文件、5/5项通过**；每项480s门限不变 | 477.439s |
| 其余86文件相关Vitest集合 | **86/86文件、1817/1817项通过** | 843.732s |
| terrain catalog白名单定向守卫 | 1项通过；名字选择外29项未运行，未新增skip | 2.198s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16引擎组合通过**，`requestedScopePassed=true` | 98.238s |
| `npm run test:drift -- --maxWorkers=2` | **4/4文件、5/5项通过** | 107.121s |

相关集合包含4a0全对象差分、4a–4c、giants、combat/3a0/3b/3c/3d、growth近战消费、出生/破坏回滚、原生弹道/护盾/环境、whole-run/移层/录像及UR2/3/4、仓库源码守卫。组合报告browser为not-run、整体passed=false，只认明确请求的engine-only范围通过；不是正式复合体的16组合自然击败验收。

冻结输入覆盖src/、scripts/、package/tsconfig/vite，共**900文件**。每个门后changedInputs=[]，开始/结束/报告补写时完全相同。按路径排序的紧凑JSON路径→SHA256清单再取SHA256为 `5730fa722480299c500786990f3230644903161af1d5a98a166c4297fdff5231`；开始/结束UTC `2026-10-05T13:03:47Z` / `2026-10-05T13:29:35Z`。原命令、清单与耗时为 `/private/tmp/p4d3-final-v4-gates.json`，各日志为 `/private/tmp/p4d3-final-v4-*.log`，组合详情为 `/private/tmp/p4d3-final-v4-composition.json`。原始证据不入库。

17实体诊断追击沿旧arena运行20条真实executeCommand(wait)，20条均发生整组移动；计时仅包命令，不含建场/保存/断言。冷次**38.875ms**，其余19条暖样本**P50 34.025ms / P95 39.933ms**，最大**39.933ms**。原始记录 `/private/tmp/p4d3-final-v4-command-performance.json`。这是Node诊断，不是自然种子/浏览器/手机基准；没有在相同宿主负载下做前后对照，不据此声称改善或回退。

使用 [develop-web-game技能](/Users/coolking70/.codex/skills/develop-web-game/SKILL.md) 尝试浏览器小步验证；其步骤7要求“You must run `$WEB_GAME_CLIENT` after each meaningful change”。已执行现有客户端，Vite监听127.0.0.1:5413返回EPERM，Chromium启动报MachPortRendezvous Permission denied，CUA浏览器inventory为空；未绕过限制，没有截图。日志 `/private/tmp/p4d3-vite.log`、`/private/tmp/p4d3-playwright.log`。320/390 SFC主持无CSS布局/真实触控引擎，因此真实像素/触控与ACK切换仍待验收。

## 完整4d剩余项（当前，按原1–8）

1. **正式声明/生成内容已接，完整群环境仍缺。** 正式body/真实足迹约束/生成闭包/整组arena和自然出生完成。核心/成员fixed-zone、攻击profile与完整StatusProfile分类闭包、移动逐子步环境接触/窄事务回滚仍缺，固定pose门保持。
2. **近邻即时/真实多来源phased保持，完整群AI仍缺。** 有界远路、逃跑/原生生存、盟友/关系与施法优先级尚未完整接线；当前近邻选择不代替完整AI。
3. **组合部分已补。** 四种giants/growth/combat组合的真实双腿横扫、公开焚烧药剂多腿按part一次及1:4中央传伤已验。仍需实际火球、多源成长逐次消费全部条件、精神效果群路由等完整组合。
4. **原生击败出口与正式断足已补。** 成员不计统计/熟悉度/掉落、致命传伤核心一次计数、自然断足/唯一核心事实完成；4d-2 provider/fallback合同保持。仍缺完整攻击profile失攻派生、全部关系/目标引用清理、XP数值/各类死因的组合验证。
5. **单腿毒客观tick已补；完整状态归属仍缺。** 群精神/关系统一一tick、全状态分类/路由、毒火网全部环境资格、支配/纷争、整组坠落与潜水仍未完成。
6. **正式自然破坏存读/replay/seek/续录已补；整体生命周期仍缺。** 保coreID的单体↔复合体polymorph、整组clone新ID/深拷贝/无奖励、实际移层/pending仍缺。已有外围留场不能当作整体迁移完成。
7. **真实自然即时群录像已补；生产多源phased跨生命周期组合仍缺。** 4d-2的gen0/付款/scope/取消与存读保持；仍需整体转换/移层及正式profile生成后的真实phased录像组合。成员再生/非零generation按D13继续关闭。
8. **正式原创敌人/场地/自然击败及公开群HUD已接。** 独立成员地图/瞄准/检视沿既有路径可用，核心HP、可见外围与历史隔离专项通过。仍缺完整成员关系/检视状态展示、320/390真实CSS/触屏/ACK验收及normal平衡验收。

本轮在任务书允许的干净子里程碑收束，优先内容闭环与历史报告中的原顺序不同，依据本轮维护者明确的优先建议。下一步应以数据分类的群状态/关系和整体生命周期为主，再做跨模块完整组合；不能把当前受限门当作完整4d最终玩法。

## 保留的4d-2/4d-1/4d-0历史报告

以下为维护者已提交的历史报告原文，描述各历史子里程碑当时状态。

# 4d-2 执行报告：复合体多来源 phased 与 3d 可信成员破坏

基于维护者已提交4d-1并合入dot 3d后的 `ext/phase4` HEAD `8f7ab26974a509821ad2f40e48e018a2878a87f5`。本轮继续原剩余1–8，交付可独立审阅的 **4d-2 子里程碑，尚未完成完整4d**；重点补齐真实3b多来源束与3d provider的成员身份/取消/时钟合同。未暂存、commit、push。下方为当前剩余范围，后方逐字保留4d-1/4d-0历史报告，不把历史门禁当作本轮结果。

## 本轮范围与调度合同

- 复合体在核心唯一原生 prelude 后，进入既有 `selectNativeActorAction`；没有调用成员 takeTurn、推进成员原生timer或嵌套executeCommand。来源按partId稳定排序，每次最多4个已拥有且就绪的槽；来源读取已安装actorActions的nativeProfile绑定，未安装combat/未绑定profile仍走原即时近战和移动路径。没有以模块布尔值赋予调度权限。
- 一个束的decision/time owner均为核心，每个真实来源携带entityId、partId、**sourceGeneration=0**与足迹指纹。每源按自身profile/资源池付一次费用、拥有独立原生攻击scope/已付款凭据、独立locked shape与冷却；核心只镜像最早阶段边界，整束到最长子动作结束才退休。不同来源可用不同profile，不能拿核心余额支付所有来源。
- `sourceGeneration`与每子动作metadata的`profileId`只在生产复合体出现；旧独立actor状态对象形状保持原样。pure codec拒绝非零generation，candidate world再对群表活动槽、真实实体/part/owner/深度核验。普通实体不能借generation字段伪装成员。无需新Game字段，未改whole-run或combat schema版本。
- 成员出生时的原生睡眠AI状态不再成为额外决策/中断门，睡眠决策归核心；局部actionLock仍只中断对应成员。实际战斗解析器保留每源真实footprint，以核心判断来源敌我与群睡眠，不把成员缩成核心点。whole-group self exclusion按全部活成员格重验，不能打到本组其它成员。
- 资源恢复读取本来源所在束的实际阶段，缓存层仍冻结；活束的捕获profile不在GC时被替换。来源无死亡退休后，取消子动作的locked cells清空，惰性metadata可留在束中直到整体收束，但不得恢复释放；对应资源row在子动作已经惰性后退休，不留下坏档中的孤儿ledger。

## 3d provider与fallback的可信互斥

请求继续采用 `actorId=groupId=核心ID`，fixed-zone仍为self/真实zone。成员请求为真实partId/body/generation0，**请求本身不构成身份授权**。Game从当前/休眠owned列表与唯一群表核验真实活动槽、实体/form/正HP；runtime再与已attach实体对照，生成冻结的 `context.member={entityId,groupId,partId,generation,bodyDefinitionId}`。combat provider在非self请求时必须收到相符证明，不能单靠字符串partId或传入一个member DTO获得能力。

handled仅沿combat唯一core ledger扣poise/取消束，不设置fallback；absent或明确unsupported仅沿原生fallbackStun。真实provider的无束核心恢复由 `reconcileActorNativeRecovery` 在事务内镜像，busy束由已有scheduler唯一持有恢复。成员破坏不再误调用固定zone的 `zoneBroken(core,'body')`：独立`memberBroken`针对真实退休子树及其locked目标通知来源改变。取消通知在事务内记录、成功后的伤害hook/无死亡退休阶段结算；失败不提前终结束或触发终端sweep。

沿合入3d的 `checkpointZoneBreak` 恢复原生时钟/速度、派生changedSources/fault、录像有效性与hover；沿原native commit恢复成员/核心HP、唯一收据与锁；沿provider事务恢复combat对象图、RNG和临时因果ID。throw、坏返回、Promise以及provider成功后的机械回调错误均不留下半次破坏。旧fixed-zone provider与self协议未放宽，3c dodge身体白名单未扩大。

成员受到直接物理poise冲击或成功被弹反时，韧性/硬直属核心；局部子动作取消恢复不等于整个群体破防。即时近战被弹反破防后停止其余来源，并按max(原生攻击恢复,核心硬直)镜像，不能把成员timer变成第二个机械时钟。

## 共享文件函数级改动

| 文件/函数 | 本轮改动 |
| --- | --- |
| ActorActionScheduler: codec/createActorActionBundle/dispatch | 条件性的generation0字段，保留独立actor原形状；有界来源generation进入释放边界 |
| ActorActionProduction: validSource/候选与live host/notifyProductionActorSourceChanged | 候选群表身份、核心资格、成员局部取消；事务内可延后结算通知 |
| PhasedAttackProduction: eligible/cellsFor/commitBody/selectBody/resolve/advanceResources | 核心选真实多源束、全源先验后独立付款、min边界/max收束、完整群排除格与每源恢复 |
| PhasedAttackProduction: retirePhasedAttackSource/validatePhasedAttackGeometry/isActorStaggered/applyActorPoiseDamage | 惰性来源与ledger退休、每源profile加载、局部/核心恢复区分、物理冲击归核心 |
| ActorCombatResolution: eligible/currentSegmentCells | 真正成员来源的原生物理解析、核心决策关系与全群自排除 |
| Game: actorActionWorld/timePorts/loadSnapshot/validateMemberBreak/成员退休与破坏回调/takeBodyDecision | 唯一群根进入候选动作验证；原生prelude后选束；可信证明及事务回调；即时束恢复不覆盖核心硬直 |
| ext/partBreak/runtime.commitPartBreak | 底座证明类型、冻结证明生成及独立memberBroken，保留provider/fallback唯一选择 |
| combat/partBreak.prepare | 非self需匹配底座证明；复用3d唯一ledger与原prepare/commit事务 |
| actorActions/actorActionValidation | 条件性的每源profile；每源费用容量约束及旧独立束总额门保持 |
| scripts/test-suites.json | 新生产专项唯一归属；旧测试/守卫未改 |

## 数据与专项

新增 `src/test/phase4d_body_actions.test.ts` **20项**，使用底座安装descriptor读取真实combat provider与数据，未导入任何模块实现。诊断nativeForms/body沿4d-1接缝注册；给诊断腿绑定正式数据中的follow-thrust/fan-edge profile，验证混合130/90tick来源、两段释放、四源上限和独立6/4费用。声明与arena均是诊断，不是正式内容或自然种子；无新增玩家UI文本、正式模块JSON/locale、生成基线或黄金trace。

专项包括真实wait选择与释放、mixed min/max、generation/part/profile坏档不替换旧局、member proof的正反例、absent/unsupported/handled及busy fallback、局部成员锁与核心破防、真实玩家parry命令、provider throw/坏返回/Promise的对象图回滚、机械回调失败后的旧束继续，以及成员墓碑后save/load命令续跑。续跑比较全部持久机械字段和双方RNG，**只排除savedAt与输入日志/录像origin**：外部诊断创建/伤害没有真实开局命令来源，不能据此宣称新局replay/seek/续录完成。

首轮2文件34项27过7失败，原4d-1的21项均过；新失败暴露外围出生睡眠被误当额外行动/中断门。修正后又定位原生resolver同一资格门和退休资源row残留，修生产。新save/load测试误把墙钟与不可重放诊断输入历史算作机械等价；逐叶证据仅为savedAt、recordedInputEvents/index、recordingOrigin，按上述明确边界修新夹具。未改任何旧测试前提、断言、守卫、容差或deadline。开发4文件76项通过；随后补busy fallback两项，新专项20项通过。最终统一冻结门禁另列，不把局部复核相加冒称唯一测试总数。

## 开发期最终门禁与性能

环境 Node24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`。相关集合为原4d-1的77文件加新专项及3d的6个combat文件，共84文件。按开发期授权，不跑完整npm test/全部test:ext/removal/CE full/gen。**最终v1同一冻结候选，以下门禁全部exit0：**

| 门禁 | 实际结果 | runner耗时 |
| --- | --- | ---: |
| `node scripts/check-module-boundaries.mjs` | 模块边界及唯一测试归属通过 | 1.741s |
| `npx vue-tsc -b` | 通过 | 6.984s |
| `npm run build` | 通过，保留既有大chunk提示 | 9.590s |
| 84文件相关Vitest集合 | **84/84文件、1799/1799项通过**；含本轮20项专项及合入的3d相关测试 | 483.032s |
| terrain catalog白名单定向守卫 | 1项通过；`-t 白名单`选择外的29项未运行，未新增skip | 1.652s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16引擎组合通过**，`requestedScopePassed=true` | 73.811s |
| `npm run test:drift -- --maxWorkers=2` | **4/4文件、5/5项通过** | 68.031s |

组合报告的browser为`not-run`、整体`passed=false`；本次仅明确请求的engine-only范围通过，不宣称浏览器或正式复合体自然录像通过。相关集合包含4a0差分、4a–4c、giants、combat/3a0/3b/3c/3d、growth近战消费、出生/破坏回滚、原生弹道/护盾/环境、whole-run/移层/录像与UR2/3/4及源码守卫。旧测试、守卫、生成基线和黄金trace未改。

冻结清单覆盖`src/`、`scripts/`、package/tsconfig/vite输入，共**896文件**；每个门禁后`changedInputs=[]`，运行前后完全相同。按路径排序的紧凑JSON文件→SHA256清单再取SHA256，值为`c4ba31f08a5c514da4a3701d5b260b401c646de75fe5ecb65b519772de282708`。开始/结束UTC为`2026-10-05T11:29:57Z` / `2026-10-05T11:40:42Z`。清单、原命令及耗时见`/private/tmp/p4d2-final-v1-gates.json`，各门日志为`/private/tmp/p4d2-final-v1-*.log`，组合详情见`/private/tmp/p4d2-final-v1-composition.json`；原始证据不入库。

本候选沿原17实体追击诊断，在核心+16外围的arena中运行20条真实`executeCommand(wait)`，20条均发生整组移动。计时只包命令，不含建场/保存/断言：冷次**22.030ms**、其余19条暖样本**P50 19.241ms / P95 22.658ms**、最大**22.658ms**。原始结果为`/private/tmp/p4d2-final-v1-command-performance.json`。这是Node功能测试的诊断结果，不是自然种子、浏览器或手机性能验收；未在相同宿主负载下做前后对照，不能据此声称性能改善或回退。

## 完整4d剩余项（当前，仍按原1–8）

1. **部分完成，仍缺完整声明/生成。** 4d-1群根/批量创建/当前缓存休眠codec保持；现有生产body仍无zone、固定当前pose。还缺核心/成员fixed-zone、攻击profile与状态分类完整声明闭包、正式generation/arena场地整组实算，以及逐子步环境接触和窄回滚。
2. **多来源调度已补，完整AI仍缺。** 核心唯一轮转、真实elapsed冷却、≤4即时或phased束、每源scope/费用、min边界/max收束已接。仍缺有界远路、逃跑/关系/原生生存与施法优先级的完整群AI，不能以近邻攻击选择代替它。
3. **中央1:4路径保持，完整组合仍缺。** 真实成员来源可用原生phased resolver；尚未补真实横扫两腿/火球多腿及growth/combat消费的全部组合，精神效果仍只有collect去重，没有完整群状态路由。
4. **3d成员provider和取消已补，内容派生仍缺。** 可信身份、真实provider/fallback互斥、核心韧性/恢复与异常对象图回滚、破坏来源/locked目标取消已接。仍缺完整攻击profile失攻派生、全部关系/目标引用清理和实际XP收据组合验证。
5. **仅核心睡眠决策与韧性归属已接。** 精神/关系群状态一tick，成员毒/火/网，支配/纷争及群坠落/潜水的完整生产路由未完成。
6. **诊断phased存读续跑已补，整体生命周期仍缺。** 保coreID的单体↔群体原子polymorph、整组clone新ID/深拷贝/无奖励、实际移层/pending，以及通过真实开局命令生成群体的replay/seek/续录仍未完成。
7. **生产3b多源接线已补，跨生命周期组合仍缺。** entityId/partId/generation0、每源profile与付款、成员破坏/局部锁/核心破防取消、存读与真实冷却已验证。仍需和未来整体转换/移层/正式生成录像组合验收；成员再生/非零generation仍按D13关闭。
8. **未完成。** 群核心/成员公开绘制与检视身份、Boss coreHP及成员概况、部分可见/历史隔离、320/390真实布局触控、正式原创复合体/实算场地与仅giants自然击败种子。

这些剩余能力继续保持门关闭；未把单体操作拒绝或诊断arena当作完整4d最终玩法。下一步首先应补整组逐段环境/状态关系和生命周期，再接正式内容与公开验收，不能先新增自然敌人掩盖这些缺口。

## 保留的4d-1/4d-0历史报告

以下为维护者已提交报告原文，描述各历史子里程碑当时的状态。

# 4d-1 执行报告：生产群表、核心轮转与成员退休

基于维护者已提交的 `ext/phase4` HEAD `2adaf6a`，继续执行报告原“完整4d剩余项”1–8。本轮收束到可单独审阅的 **4d-1 子里程碑，尚未完成完整4d**。未暂存、commit 或 push。下文逐项列出剩余范围；文末保留 4d-0 报告原文，历史能力门描述以当时状态为准。

## 本轮范围

- 已安装模块可声明不可变 `nativeBodies`（body definitions + member break rules），所有 form 引用必须属于同一模块且来自其 nativeForms；快照只描述已安装闭包，不安装或授权数据。限制为 generation=0、无局部 zone 的成员/核心、≤17 实体/64 格、固定当前 pose、移除并退休子树、1:4 成员传伤；再生、镜像、残骸、重新挂接和非 immobile 的无支撑策略继续关闭。固定 zone 的 keep-zone 门未放宽，remove 走独立 `registerMemberBreakRule`。
- `createCompositeMonster` 按整组 preferred formation 纯预验几何、牵引、区域、外部占位和预算；失败不分配 ID 或 RNG。通过后以新 owned list 一次发布完整批次，并使用现有 generation token 缓冲出生事件。失败恢复 Game/群表/列表引用、runtime 状态、ID 与 RNG。新增独立全对象图 audit，覆盖已有破坏墓碑时第二组出生发布失败。当前 API 为引擎创建接缝；正式场地模板尚未接入。
- 唯一机械群表为可选 `Game.bodyGroups`，普通局无此字段；登记 `scripts/u03-state-contract.json`。前台 planner 的 `CreatureSpatial.groups` 引用本层群记录，服务本身临时、派生且及时 dispose。存档写在已有 `run.spatialWorld.groups`，未改存档版本；根闭包、typeId/form、HP/槽位、唯一收据、子树墓碑、约束、当前/缓存/休眠整组所有权均先验证再发布。pending、携带与整组实际迁移尚未开放。
- TimeCoordinator 三处候选/减时/决策过滤只保留独立生物及群核心，成员原生 ticks 不写。成员 readyInTicks 按真实 soonestTurn 减时，缓存层不减；核心在一次原生 prelude 后选择移动或最多4个即时近战源，来源使用独立 native attack scope，组耗时取 max，blocked/冷却中仍付正耗时。移动最多尝试8个核心邻步，每个邻步保留32候选/128分支上限。
- `BodyMemberHealth` 在中央 post-shield 出口扣成员 HP，按 floor(min(防护后伤量, 命中前正HP)/4) 直接扣核心 HP，不调用核心 takeDamage，不重复解算/护甲/符文/反伤/伤害 hook。核心仅补因果归属以保留原命中 credit；原生成员伤害 hook 完成后再退休。成员不走 die/kill/DF/掉落/XP 路径；父槽破坏退休整棵子树，只有直接破坏槽产生收据、传伤和减速。核心致死收敛为一次原生整体终结。
- part-break 请求扩展到真实 partId/body/generation=0，runtime 再经 Game 的已拥有活动槽核验。provider handled 与 fallback 互斥；异常恢复成员/核心 HP、破坏集、锁、护盾、runtime 状态和临时 effect ID。移动耗时从原生当前基础速度及唯一破坏集派生，读档不重叠乘；全支撑毁后不能移动但核心仍可近战。

## 共享文件的函数级改动

| 文件/函数 | 改动 |
| --- | --- |
| SpatialSchema: registerForm/registerBody/registerMemberBreakRule/permitsMember | 已安装声明授权、有限 remove 协议、成员几何门与闭包 |
| BodyGroups: validateBodyGroup/retiredBodyParts/bodyMoveTicks | 实体/form/槽墓碑与树退休核验、唯一收据派生减速 |
| CreatureSpatial: assertNativeSpatial/restoreWorld/collectBodyTargets/commitCompositeAnchors | 注册成员几何、生产群表预验、D08 group key、禁止原生单锚点撕裂群体 |
| CompositeMovement: cohort/planStep/commit | 生产活动成员及墓碑、存活支撑资格、派生正成本、完整群锚点发布 |
| MonsterLifecycle: ownedMonsterList | 每个生产成员必须匹配接收 Game 的已拥有槽，拒绝孤儿/跨会话发布 |
| Game: createCompositeMonster/takeBodyDecision/advanceBodyElapsed/killMonster/retireBodyEntities/toSnapshot/loadSnapshot | 完整出生批次、核心选择/成员冷却、无死亡退休、群根序列化及加载顺序 |
| WholeRunSnapshot: snapshotSquareWorld/validateProductionGroupOwnership/decodeWholeRunWorld | 已安装完整定义闭包、全层群根与不分裂物理归属 |
| TimeCoordinator: advancementLoop | 三处核心唯一过滤、真实 elapsed 成员冷却 |
| ActorActionProduction: validation/live host decisionOwnerId | 从已验证的 bodyMember 映射 core owner；尚未构造生产多来源 phased 束 |
| Creature: takeDamage；runtime: attachCreature/commitPartBreak | 中央成员 HP 接缝、完成伤害后退休、成员无 die、真实软接口身份 |
| BodyCombat: withZoneProtection | 成员 provider 失败恢复 pre-takeDamage 护盾 |

普通单实体旋转、place/teleport、polymorph 与 clone 不允许把群体拆成一个实体。整组坠落当前显式拒绝；诊断群体带 WILL_NOT_USE_STAIRS，移动拒绝 trap/auto-descent。**这些是未完成迁移/转换能力的门，不是完整4d的最终玩法策略。** 一般群体平移目前只结算最终各实体环境，尚未交付成员两子步的逐段环境接触/位移失败回滚。

## 数据、公开输入与验收边界

诊断定义在 `src/test/support/productionComposite.ts`，读取底座安装 descriptor 的数据声明，不导入 giants 实现或资源；`src/test/phase4d_production_body.test.ts` 经正常 registry/ExtensionRuntime、非 fixture catalog、真实 owned list 与 executeCommand 验证。8腿与16外围组均已运行；已有 fixture 多头/链轨迹保持回归。测试 arena/HP 安排是明确的诊断前提，**不是自然种子验收**；没有新增正式 species、场地、UI 文本、自然黄金 trace 或旧基线。

## 开发期功能门禁

运行环境为 Node24.19.0（PATH 前置指定 runtime）、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`。按开发期功能政策，不跑完整 npm test / 全部 test:ext / removal / CE full/gen。旧测试、守卫和黄金 trace 未改。

开发中生产测试跨模块导入被边界拒绝，已改为读取底座安装声明；没有改守卫。原32项规划 + 新20项生产用例共52项局部通过后，冻结复核发现外围槽可使用固定 zone 保留的 `self` 名称，且活成员 HP 校验不足；新增1项声明/活成员校验回归并修生产入口。原 v1 门禁在相关集合运行期间发生这3个输入变化，结果为76文件通过/1失败、1608项通过/1失败（失败为新增校验用例），runner 未进入 smoke/drift。该候选废弃，不能拼接其结果；修复后生产专项21项单独通过，再冻结 v2 重跑全部门禁。

**最终 v2 同一冻结候选全部 exit0：**

| 门禁 | 实际结果 | runner 耗时 |
| --- | --- | ---: |
| `node scripts/check-module-boundaries.mjs` | 模块边界及唯一测试归属通过 | 1.547s |
| `npx vue-tsc -b` | 通过 | 6.763s |
| `npm run build` | 通过，保留既有大 chunk 提示 | 9.216s |
| 77文件相关 Vitest 集合 | **77/77文件、1609/1609项通过**；含32项原规划与21项新生产专项 | 422.406s |
| terrain catalog 白名单定向守卫 | 1项通过；`-t 白名单` 选择外的29项未运行，未新增 skip | 1.668s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16引擎组合通过**，`requestedScopePassed=true` | 66.640s |
| `npm run test:drift -- --maxWorkers=2` | **4/4文件、5/5项通过** | 54.291s |

组合报告的 browser 为 `not-run`，整体 `passed=false`；只认本次明确请求的 engine-only 门禁通过，不宣称浏览器或生产复合体自然录像通过。相关集合覆盖4a0全对象差分、4a–4c、giants、combat/3a0/3b/3c、growth近战消费、出生回滚、固定 zone/part-break、实例/随机/whole-run/移层/录像、UR2/3/4、弹道/环境/护盾及仓库守卫。

冻结清单覆盖 `src/`、`scripts/`、package/tsconfig/vite 输入，共 **887文件**；每个门禁后 `changedInputs=[]`，运行前后相同。按路径排序的紧凑 JSON 文件→SHA256 清单再取 SHA256，值为 `3d90368d42653ea849d95b6cc0fdc3c6a6f23c265285d1a6c9fb4414dbb2fc21`。结束时间 UTC `2026-10-05T10:46:13Z`。原始清单/命令/耗时见 `/private/tmp/p4d1-final-v2-gates.json`，各门日志为 `/private/tmp/p4d1-final-v2-*.log`；组合详情见 `/private/tmp/p4d1-final-v2-composition.json`，废弃 v1 证据独立保留，不覆盖。

## 真实命令性能

核心+16外围共17实体在诊断 arena 追击，20次真实 `executeCommand(wait)` 均发生核心/整组位移。计时只包命令，不含建场、保存和断言：冷次 **17.213ms**，其余19次暖样本 **P50 14.472ms / P95 16.709ms**，最大 **17.213ms**。这是 Node 功能测试中的真实 Game 命令，不能替代自然种子、浏览器或手机性能验收；没有用 fixture planner 耗时冒充命令耗时。数据见 `/private/tmp/p4d1-final-v2-command-performance.json`。

## 完整4d剩余项（对应原报告1–8）

1. **部分完成。** 生产声明/群根/批量创建/当前缓存休眠 codec 已接。仍缺核心及成员 fixed-zone/攻击 profile/状态分类完整引用闭包、正式 generation/场地整组实算、arena 自然入口、逐子步环境接触与窄回滚；目前固定当前 pose、无 zone。
2. **部分完成。** 三处核心过滤、真实 elapsed 成员冷却、≤4 即时攻击/max 耗时、正 blocked 成本及真实17实体命令已接。仍缺有界远路/逃跑/关系语义等完整 AI 和多来源 phased 子动作选择，不能以即时近战当作3b完成。
3. **部分完成。** 中央1:4截断传伤、两个直接/area-damage part 各一次、core直接扣一次和因果归属通过。仍缺真实横扫/火球多腿路径与 growth/combat 消费的完整组合专项；mental 这里只完成 collect 的 group 去重，未完成状态归属。
4. **部分完成。** remove墓碑、链子树无死亡退休、唯一软收据/provider回滚、派生减速、全支撑毁后仍攻击、核心整体一次终结通过。仍缺完整攻击 profile 失攻派生、所有目标/关系/计划引用清理及实际 XP 收据组合验证；目前 sourceChanged 接缝已调用，真实多源 phased 取消尚未验。
5. **未完成。** 精神/关系群状态一 tick，成员毒/火/网局部状态，以及支配/纷争/群坠落/潜水的生产路由。
6. **未完成。** 单体↔群体保 coreID 的原子 polymorph、整组 clone 全新ID/深拷贝/无奖励、实际移层/pending、真正从开局命令生成群体的 replay/seek/续录；现仅有诊断 save/load 命令续跑确定性。
7. **部分底座接缝。** production scheduler owner 映射成员→核心，并在退休时通知 sourceChanged。仍缺 partId/generation 与3b定义的真实多源 phased 束、破坏/锁导致的取消恢复、存读/录像/真实冷却组合。
8. **未完成。** 公开核心/成员绘制和检视身份、Boss coreHP+成员概况、部分可见/历史帧/320与390验收、正式原创复合体与实算场地、仅giants（无growth/combat）自然击败种子。当前普通实体绘制不计为完整群体UI验收。

## 保留的4d-0历史报告

以下为维护者已提交的4d-0报告原文；关于能力关闭的陈述描述4d-0当时的状态。

# 4d-0 执行报告：复合体有界落脚规划底座

本轮执行 `docs/ext/phase4d.task.md`，基于 `ext/phase4` / `315fd8cb2e570d26f6cc23692f650e19b71005e7`。按任务书“可在干净子里程碑停下并列剩余项”，交付 **4d-0**。**不是完整4d，生产group能力仍关闭。** 未暂存、commit、push；用户原有未跟踪任务书保持原样。

## 范围与能力门

交付原生fixture的核心＋成员平移规划、树约束与连续轨迹验证、预算退化、一次性原子位置发布，以及已有entity/group/whole-run fixture codec的距离约束补强。八腿、多头、链形与17成员场景都不需要ExtensionRuntime或任何正式模块。

`CompositeMovement` 构造只接受 `SpatialCatalog.fixture`。Game的owned实体列表、原生动作/生产codec继续拒绝bodyMember；不能通过保存几何、实例化planner或提交伪造计划获得生产群体能力。没有给Game加字段、增加存档版本、规则随机调用、HP/冷却副本或新的群表。唯一机械群身份仍在 `CreatureSpatial.groups`；planner的WeakMap仅保存一次性计划凭据。

不开放成员退休/再生、身体旋转、局部伤害、实际NPC群调度或正式敌人。活动槽必须generation=0、life=active，尚不接受破坏墓碑。现有fixed-zone、nativeForm、经典/扩展战斗解算器、combat provider和giants内容均未改；另修复下述基线已有的经典射线适配器参数问题。

## 落脚与运动合同

1. 核心先确定一个邻步。按有根约束树、partId字典顺序求成员路径；父成员先于子成员，稳定性不依赖定义数组、群表数组或monsters数组顺序。
2. 成员在当前pose下枚举简单平移路径，最多两步；不穿墙到终点，也不借pose参数免费转身。保留旧落脚优先，然后按新核心＋preferredOffset的切比雪夫距离、路径长、终点y/x、完整路径y/x排序。每次递归最多32候选，整次核心移动尝试最多128个候选分支；可用更低诊断预算，不允许超过上限。
3. 所有路径共用最多两个单位子步；短路径之后驻留。每个子步的实际单位格方块使用相对线性运动的开放区间相交，拒绝腿互换、对角交叉及中途重叠，允许链段以相同速度跟进父段腾出的旧格。格边接触不等于占位重叠。
4. 每条父子约束以实际footprint的最近切比雪夫距离衡量。maxDistance要求每对格子许可时间区间的并集覆盖完整子步；minDistance要求没有格对进入禁止区间。这能捕获端点都合法、最近格对切换却造成中途过度拉伸的U形掩码反例。没有用动画采样代替生产验证。
5. 平移扫掠保守检查目的及两正交中间锚点，包含地图、全部身体格、区域和active-or-reserved外部占位。clearLink静态规则取稳定最近格对的supercover；运动期间要求可能连接的扫掠包围矩形全部无墙。此规则会过度拒绝一些弯道，但不会让连接隔墙穿过。
6. 无支撑资格、核心局部行动锁或移动失能返回immobile；地形/成员/约束无解或预算耗尽返回blocked。所有blocked结果都携正core movementSpeed成本，**调用者尚须在未来生产接线中提交该成本**；本轮不会自动写核心/成员ticksUntilTurn或推进状态/环境。
7. 提交只接受当前planner持有的一次性凭据。先复核群表、实体引用、HP/计时/局部资格、源位移revision、loc引用及可写性、地形/占位revision，重查全部轨迹；再同步发布最终锚点。没有任意环境或模块回调夹在半组位置之间。失败不写任何最终位置，重复提交、伪造克隆计划、离开再回原格、dispose旧会话都被拒绝。

## 共享文件函数级改动

| 文件/函数 | 本轮实改 |
|---|---|
| `Movement/BodyConstraints.ts`（新增） | `bodyConstraintOrder`稳定树序；`clearBodyLink`整数supercover；`bodyConstraintsSatisfied`按实际格对校验距离、父槽存在和clearLink。 |
| `Movement/BodyTrajectory.ts`（新增） | `trajectoriesCollide`连续单位格方块碰撞；`trajectoryConstraintSatisfied`连续牵引许可区间覆盖、最短距离禁止区间与保守连接扫掠。 |
| `Movement/CompositeMovement.ts`（新增） | fixture能力门、cohort/资格校验、最多32候选/128节点的确定回溯、正成本blocked、单次`planStep/commit`；没有Game/TimeCoordinator接线。 |
| `Movement/CreatureSpatial.ts::entityById` | 可信引擎/fixture的实体解析；不暴露给模块context。 |
| `Movement/CreatureSpatial.ts::restoreWorld` | 原有所有权/闭包验证后、发布群表前，增加实际footprint距离与clearLink验证；活孩子不能引用不存在的父槽。坏fixture图不替换旧机械群表。 |
| `Movement/CreatureSpatial.ts::dispose` | 解绑/释放派生服务后递增revision，旧位置计划不得继续发布。 |
| `Core/Game.ts::applyMonsterBoltHit` | 原BE_ATTACK的delivery标记只在有ExtensionRuntime时传递，经典路径恢复原选项对象，扩展射线仍绕过近战体力收费。命中/伤害/符文/状态公式及Combat.ts未改。 |
| `scripts/test-suites.json` | 新增复合体专项和独立射线参数回归的唯一归属；旧守卫/断言未改。 |
| `docs/ext/architecture.md`、`progress.md` | 登记本步边界和继续接线的责任。 |

## 与3a0/3b调度的边界

**没有接通生产actor-action。** `ActorActionScheduler`的核心owner、sourceEntityId/sourcePartId、≤4子动作、min边界/max耗时合同和TimeCoordinator原三处遍历保持原样。planner只给路径与正costTicks；运动的两个几何子步不引入另一份规则倒计时。

后续4d须把群核心映射为唯一decision/time owner，成员作为真实来源；成员generation还要进入来源验证/取消合同。即时攻击束或phased招式必须在可信actor-action会话内冻结来源、逐成员独立scope/冷却，收束后核心只提交一次max耗时。成员破坏、位移、变形或移层必须取消相应待段；不得从planner内调用成员takeTurn/endTurnWithAttack/playerTurnEnded或嵌套executeCommand。本轮只运行现有3a0/3b/3c相关回归，不把它们通过称为复合体组合已实现。

## 数据、验收入口与性能

fixture数据位于 `src/test/support/compositeScene.ts`：2×2核心＋8条1×1腿、3个头、1×1核心＋5段链、核心＋16外围成员。声明复用既有BodyDefinition/BodyGroupState/SpatialCatalog，不改原生怪物目录或giants规则指纹。首个八腿完整轨迹有显式坐标期望；链的连续四次动作逐实体断言向东一格；其余轨迹同时用独立密集时间采样验证连续碰撞/距离。单格几何另枚举2025组相对位置和单位速度，与独立33时点采样逐组对照。

没有新增正式敌人、场地、自然种子或自然复合体录像。旧seed7306/7309等仍是4a–4c内容的验收回归，不能充当本步自然复合体证明。

性能测的是17成员**fixture plan＋成功时commit**，不含建场/序列化/断言，不是executeCommand、NPC追击帧率或手机性能。20次定向尝试中15次成功、5次触及128预算后blocked，成员最多两步；这些blocked保留为有界算法的真实限制，没有改预算或把成功样本拼成全身可达结论。

最终同一冻结候选冷次 **1.803ms**，其余19次成功/blocked混合暖样本 **P50 1.569ms / P95 3.428ms**，最大分支128。Node24.19.0、两个worker的功能测试环境；只是这一小型诊断场景，不能替代真实Game17成员追击每命令测试。完整20次数据在 `/private/tmp/p4d-final-v4-performance.json`。

## 实际测试与结果

运行环境Node24.19.0（PATH前置任务指定runtime）、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`。按本步开发期功能政策，不跑完整npm test / 全部test:ext / removal / CE full/gen。

开发首个候选 **3文件/83项全部通过**；新专项当时31项，覆盖上述几何、128节点退化、无机械随机/ID/时钟消耗、活动/休眠外部占位、腿隔墙、旧loc引用、单次计划、源离开再回、群共享、会话退休、引擎谓词变化、实体/群表fixture存读、whole-run坏牵引拒绝和生产能力门。首轮失败是新测试误用不存在的rng.getCallCounts、只读数组reverse类型、外部障碍布景落在旧腿格、以及误要求17成员有限回溯永不blocked；已修测试布景和记录真实算法限制，**没有修改任何旧测试、预算、断言容差或新增skip**。RNG的现有getState本就包含两流和两计数。

冻结复核时发现原地保留成员可能在非法地形/区域上仍得到planned、到commit才被拒绝；新增1项先红回归精确复现。补全起始整组fit检查后，新专项 **32/32项通过**，无位立即给正成本blocked。第一轮门禁在related期间主动中断，runner exit130，已完成的boundary/type/build各exit0；未运行后续smoke/drift，未把它算作相关集合通过。原证据 `/private/tmp/p4d-final-*` 与 `p4d-standing-terrain-{red,green}.log` 保留；最终候选改用独立 `p4d-final-v2-*` 全链重跑。

v2相关集合实际为 **71文件通过/1失败、1482项通过/2失败，450.12s，exit1**；后续smoke/drift未进入。两失败来自未改的 `w_4_bolt_reflection`：期待经典BE_ATTACK只有isWeaponAttack/grid，但合入的3c向所有调用追加了delivery=bolt。**只回退本轮原有唯一共享生产文件CreatureSpatial.ts**，新Movement模块随之不再被生产引用；原W4仍精确2失败/27通过，证明不是4d引入。证据 `p4d-w4-counterfactual.{json,log}`；回退在finally内恢复，无旧测试/断言修订。

按“撞上守卫改代码”修复Game适配器，仅ExtensionRuntime存在时交付扩展delivery标记。新增 `native_bolt_delivery.test.ts` 用真实Game经典/仅combat开局验证两类BE_ATTACK射线：旧生产2红；新生产保留经典原调用形状，扩展NPC体力已耗尽时仍有实际射线伤害、余额仍0，不误判成近战收费。没有去掉扩展分类，也没有删除/放宽旧W4断言。修复后 **4文件/81项全部通过**，含新两项、原W4的29项、3c原生体力18项和复合体32项；日志 `p4d-native-bolt-{red,green}.log`。最终候选使用独立 `p4d-final-v3-*` 重跑全部门禁。

v3在type阶段exit2：新射线夹具误用了不存在的Monster.damage字段，已改为原生damageString；生产字节未改。没有执行build/相关集合/smoke/drift，未算作通过。最终冻结候选为独立 `p4d-final-v4-*`。

**最终v4同一冻结候选全部exit0：**

| 门禁 | 实际结果 | runner耗时 |
|---|---|---:|
| `node scripts/check-module-boundaries.mjs` | 边界及唯一测试归属通过 | 1.537s |
| `npx vue-tsc -b` | 通过 | 6.706s |
| `npm run build` | 通过，保留既有大chunk提示 | 9.232s |
| 73文件相关Vitest集合 | **73/73文件、1486/1486项通过，0 skipped/todo**；含新增34项、4a0零影响完整图差分、4a–4c、giants、combat 3a0/3b/3c、UR2/3/4、U03、存档录像与源码守卫 | 410.549s |
| `c_4a_terrain_catalog -t 白名单` | 1项通过，29项因名称筛选未执行；没有跑重型普查 | 1.637s |
| `check-module-composition-smoke.mjs --engine-only` | **16/16组合通过**；真实新局、自然贡献、save/load/replay/seek/续录 | 65.585s |
| `npm run test:drift -- --maxWorkers=2` | **4/4文件、5/5项通过**，普通两份生成基线与giants三份自然trace | 57.844s |

最终结束UTC **2026-10-05T09:34:00Z**。**883份**生产/测试/脚本/配置输入每项门禁后及最终均无变化；路径排序紧凑JSON散列集合SHA-256 **`1a548898b6219a572438a2077cfd415e2427155db9b2a9821d6c992b483da7bf`**。之后只补报告与progress。旧测试、生成基线和黄金trace均未改、未重录，不存在旧守卫前提修订。LF、git diff --check通过，截图/大体积原始证据未入库。

精确73文件清单 `/private/tmp/p4d-related-files.json`；最终runner `p4d-final-v4-gates.py`，命令/退出码/逐文件前后散列 `p4d-final-v4-gates.json`，原始日志 `p4d-final-v4-*.log`，组合结果 `p4d-final-v4-composition.json`。组合报告engine.status=passed、requestedScopePassed=true；browser=not-run、整体passed=false表示只完成任务指定engine-only范围，不能冒充浏览器产品验收。SSR HMR监听EPERM输出保留；engine-only实际exit0。

## 完整4d剩余项

1. 生产group声明/能力门及原生创建：成员原生数值、statusProfile/breakRule/attack闭包、群表全层codec/写集、批次出生与正式场地的整组路线验算。当前planner仍是fixture入口，移动候选不含旋转或等待后再迈步的路径；实际中间/终态驻留格的环境接触批处理及其异常窄写集也未接入。
2. TimeCoordinator三处核心过滤、真实soonestTurn递减成员冷却；核心移动与≤4即时/phased子段束的互斥选择、max耗时与无合法动作正耗时提交。补真实Game17成员追击每命令性能。
3. 原生受击按part路由、外围1:4截断传核心，不重复命中/RNG/符文/反伤/growth消费；两腿横扫/火球及整体精神scope的实际解算。
4. 唯一破坏收据、remove＋墓碑、抓持/leader/目标/计划入边清理、链子树退休、派生速度/失攻、全部支撑毁后immobile仍可攻击；将4c目前仅self/actorId=groupId的combat.part-break.v1校验扩展到可信成员身份，并一并验证provider或互斥fallback；核心死整体终结/XP一次。
5. 精神/关系群归属及局部毒火缠绕，环境/状态客观块各所有者一次；支配/纷争作用整组，坠落/潜水资格整组校验。
6. 被动polymorph单体↔复合体保核心ID、全组预检/回滚；clone全新ID/深拷贝/无奖励；整组换层/坠落/pending及实际save/load/replay/seek/续录。
7. 成员来源generation的3b招式组合、成员破坏取消待段及恢复时钟验证。
8. 公开核心/成员绘制、独立瞄准/检视、Boss核心HP与成员概况、部分可见裁切、历史帧隔离、320/390像素/触控；原创复合敌人和自然击败验收。

本轮没有新增显示功能，因此没有复合体像素证据，不宣称现有HUD能表达群体。4e主动换形/分裂/召唤、再生、残骸地形和镜像继续不在4d范围内。
