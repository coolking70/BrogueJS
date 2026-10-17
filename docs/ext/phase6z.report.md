# 6Z 收口报告

> **2026-10-18 创建阻断修复见 §4.2。** 维护者浏览器发现的全模块无法开局已在真实 MainMenu SFC 流程复现并修复；最小触发集是 settlement 单模块。新增 UI 创建流程组合冒烟覆盖精选七组合（含全部 8 模块）及重试，原 engine-only 七组合通过不代表此路径已覆盖。

> 性能补录（2026-10-17）见§5.1：6C3排除路线工作量差异，保留D6 regression并按已知尾部风险采纳；6C4计时pass、离线采纳。两份预算及完整route/source已冻结；无完整第四轮独立云端验证。下列旧性能待办为历史。

> **当前清理结果见 §4.1：原22个失败文件已关闭。** 74项由当前版本重录/前提修正关闭；另64项按维护者授权从短战斗矩阵排除loot组合，不能计作重跑通过。限定25文件首批227pass/3fail，修正后仅3个失败文件补验10pass；boundary、依赖、vue-tsc、build通过。其余章节保留原6Z/CI阶段记录，原138项清单为历史状态；人工/性能待办不因本轮自动关闭。

2026-10-17，`ext/phase6`，开工及当前HEAD `06682d538084d552e40ba192c9f1e2e896b3e13d`；phase5比较点 `9cf8366`。初始工作区干净。维护者已接受Z-D1…Z-D7全部推荐并追加精简门禁，先修订[任务单](phase6z.task.md)后执行。最多两轮修复；未提交、推送、合并、部署，没有tag/Release/package升版。

**两轮修复已结束，自动门禁未通过：首轮160项失败关闭22项，仍有138项、涉及22个文件未关闭。** 另行关闭了b2堆OOM和MainMenu套件初始化失败。精选七组合通过；物理全删首败经同一删除副本定向复验关闭，补跑原先未执行的生命周期端点通过。未启动第三轮，不把未关闭失败列作获准延期。U01–U18全部待维护者；C3云端超时、C4被取消，完整性能结论待维护者补录，不阻塞其余收口工作。

## 1 环境、身份与证据

Node24.19.0、3072MiB old-space（非RSS限制）、Vitest4.1.11、macOS26.6.2 arm64；单次正常测试maxWorkers=2，其它重门禁顺序执行，没有另启性能基准或预算回放。沿用现有node_modules，未重复npm ci/改lockfile。`vue-tsc -b`单跑后直接Vite build，避免npm build再次隐式类型检查。

仓外证据根 `/private/tmp/phase6z-06682d5/`。每项`*.result.json`记录完整参数、cwd、起止与exit，`*.log`保留原输出，Vitest另存JSON。[门禁索引](evidence/phase6z-gates.json)保留原始命令和退出码。源码/工具逐文件SHA在`source-before.json`与`source-final.json`；最终固定src/scripts范围1,545文件聚合SHA为 `5b3eae8771dbc202a0c49037fc923f109666a60541e0e3f2a4149758bb356039`，算法及22个文件前后SHA见[最终身份](evidence/phase6z-final-identity.json)。两轮共修改两个Vue局部函数名、18个测试文件及两个既有黄金夹具；生产引擎/规则/RNG/SDK/存录写入均未改。仓外探针不是生产入口。未加入截图或>1MiB新原始证据；重录的既有受跟踪UR4黄金gzip仍约1.3MB，属于原夹具更新。维护者仍须安排持久归档，临时目录不作为长期唯一副本。

build产物逐路径SHA清单及算法在`dist-identity.json`；R1修复后必要构建复验的`R1-dist-identity.json`与首次逐字节一致，聚合 `e8f898996854caf00833db803699a4e220f12329b6d724209c2a49d11b228542`（UTF-8紧凑JSON的排序path/sha256数组）。R2只改测试夹具，不重建。仅原有>500kB chunk提示，无构建错误。当前构建base为默认`/`，维护者可用`npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`，不冒充已部署Pages构建。

## 2 影响面选择、沿用与去重

发现器（根/模块test-suites）共677文件；`analyzeTestDependencies`传递imports及required/optional返回errors=[]。以`9cf8366..HEAD`的src/scripts diff交集选择，补入目录动态发现依赖、测试读源码字面路径与扫描守卫；测试自身/夹具也算依赖。完整决策在[逐文件选择清单](evidence/phase6z-test-selection.json)，仓外`selection.json`保留完整依赖与交集，`impact_selection.py`与`selection-correction.json`保留算法及人工动态读补充。

初选为 **653文件单批运行、7文件沿用、17文件未受影响**。启动后人工核对未选文件，发现`gameplay_layout`与`ui_concepts`的`source(relativePath)`动态拼接读App/MainMenu未被静态分析展开，补选2文件，各首次运行一次，最终655需执行/7沿用/15未影响。原653批次不重启、不重复任何已通过文件；这一选择工具局限及补选独立登记，不伪称所有文件由单个命令完成。没有另跑完整npm test或test:ext，未把重叠套件计数相加。选择以整文件为单位，既有`combat_combinations`和`ext_module_composition`内部的动态组合断言仍随受影响文件执行；独立engine smoke入口仅七组合，未另启256组合runner。两者范围分列，不把整文件原有用例隐去。发现器drift共8文件（根2生成基线+模块6轨迹），全部依赖实际变化并纳入该批；根2文件各有208个交集依赖。因此不登记drift跳过，也不另启重复test:drift命令，结果按成员单列。

沿用规则：必须整文件全部原样passed、无筛选skip；测试/夹具/传递依赖/动态模块生产目录的每个当前SHA均与原审查快照一致，缺hash即不沿用。实际只有6C4 R2以下七文件满足，均来自`/private/tmp/p6c4rev2.tests.json`（294pass），快照`p6c4rev2.before.json`与审查前后integrity核对。6C4 R1另外14文件虽曾通过，但其依赖schema在R1修复后变化，未沿用；早期各步Game/shared依赖后来继续变化，也不以旧限定通过替代当前影响面。

| 沿用文件 | 原通过数 | 核对依赖数 |
| --- | --- | --- |
| `loot_b4_vectors.test.ts` | 22 | 559 |
| `loot_catalog.test.ts` | 12 | 558 |
| `loot_data.test.ts` | 11 | 558 |
| `loot_generator_props.test.ts` | 53 | 558 |
| `loot_generator_vectors.test.ts` | 27 | 558 |
| `loot_schema.test.ts` | 137 | 559 |
| `loot_sources.test.ts` | 32 | 566 |

R2原审查发现证明：1,119配置对/2,238方向检查全部符合独立判据；当前七文件及依赖无后续变化。这里只沿用相应文件294项，未把独立探针额外加进本次Vitest计数。

最终沿用复核：初选为了安全把整个模块生产目录纳入动态依赖，因此上表是初选保守依赖数；R1两个Vue改名后，继续追踪七文件的真实imports及八个descriptor的动态加载闭包。TypeScript import扫描得到436文件、无Vue、无未解析相对import；与各文件静态依赖并集分别438/437/437/437/437/437/444文件，全部自原冻结至R2字节不变。两个UI文件不可从该引擎闭包到达，因而没有机械重跑七文件。算法、完整闭包及逐项变化空集在仓外`descriptor-closure.mjs/.json`和[最终身份](evidence/phase6z-final-identity.json)。

## 3 门禁实绩

| 门禁 | 首次结果 | 复核/限制 |
| --- | --- | --- |
| boundary | exit0 | 一次 |
| 静态测试依赖 | exit0、677文件、errors=[] | 首次一次；R1修改后必要复验exit0 |
| vue-tsc -b | exit0 | 首次一次；R1修改后必要复验exit0 |
| Vite build | exit0 | 首次一次；R1修改后必要复验exit0，产物相同 |
| 653文件影响面批次 | exit1；12,365pass / 160fail / 19skip / 1todo，1unhandled；8938.97s | 611通过/40失败/1历史跳过/1 OOM未完成文件；b2另21项pending，不算通过 |
| 动态读源码补选 | exit0；2文件11pass | 两文件首次执行，未重复已跑文件 |
| 其中drift | 2生成基线通过、6模块轨迹文件失败 | 仅原8成员，未重复启套件 |
| 物理全删retain=none / engine-only | 首次exit1；1684pass/6fail/25skip，122文件 | boundary/deps/types/build通过；R1同副本5文件86pass关闭6项失败，原先未跑endpoint补跑1pass |
| 正常七组合engine-only | exit0；7/7 engine passed | 全开/全关/loot+growth/loot/growth/全开去loot/全开去growth，browser not-run |
| Z-D5有界孔位/100只读 | exit0；6场景各100次 | 受控合法0/1/4孔，另2孔匹配/反序及4孔前缀；不作时延结论 |
| R1定向复验 | exit0；20文件385pass；b2另21pass | b2保持3072MiB/单worker；两组不与首轮总数相加 |
| R2定向复验 | exit1；settlement_review 12pass/1fail | 关闭两项照明夹具失败，键盘行为冲突保留；两轮用完 |
| 浏览器U01–U18 | 未执行 | 维护者三档54格统一清单 |

七组合仓外`seven-smoke.mjs`从原smoke只换输入集合与绝对import，`seven-smoke.diff`保留差量；原Game生命周期/自然贡献/存读/完整replay/seek/续录断言不变。没有给仓库新加选择器或削弱守卫。全删使用原runner并核对真实8模块缺席，声明缺required的具名skip与历史skip分列。真实缺包使用当前原生捕获的五组loot输入，各在正常树完整生命周期通过后，物理删除树逐份拒绝并核对完整图/引用/双流/entity与machine allocator/时钟和活局续玩；不改manifest头，不用合成缺包代替。

上述详细输入身份、结果及物理删除证明见[集成证据](evidence/phase6z-integration.json)：全删原122文件为92通过/5失败/25跳过，25跳过明确分成24个缺required声明及1个历史性能开关。266个模块所属测试随目录移除，411个根测试文件仍在。只建立一个删除布局，R1仅同步其中仍存在的测试/夹具并定向复验；所有剩余src/scripts与最终正常树相同。没有重跑全122文件或重建第二个删除副本。正常树的两项Vue生产改名在删除树中不存在，删除树原静态/types/build证据未失效；R1正常树已验证共享测试签名。原全删runner的exit1照实保留，后续关闭由独立结果证明，不伪改原日志为exit0。

七组合原产物顶层`passed:false`包含未执行browser，`requestedScopePassed:true`及engine七项passed才是本次engine-only结论；原CLI字段`combinationSelection:all`是被七项仓外选择器覆盖前的默认标签，实际数组长度为7。影响面中已有`combat_combinations`内部128组合、`ext_module_composition`内部271项（含256子集）仍按整文件执行；后者271通过，不等于新跑256个完整冒烟生命周期。

真实输入为seed42的loot、loot+growth、loot+crafting、loot+giants、八模块全开五组，各含当前foundation20原生save/recording，共10次缺包拒绝；未污染存活局，随后续玩通过。小见证六场景每项100次热读均为2,900次collection、零transaction；modifier行读取分别11,600/14,500/23,200/17,400/17,400/17,400，socket modifier行数0/1/4/2/2/2。完整图/引用/双流/分配器不变，模块data 263–324字节、state均321字节；精确字段见[孔位见证](evidence/phase6z-socket-witness.json)。不把这些有界计数外推成性能预算。SSR探针出现HMR端口EPERM告警，但相关进程及断言exit0；这不构成浏览器验收。

## 4 首败与修复轮次

首轮永久保留为exit1；40失败文件/160失败断言另有b2堆OOM。Vitest JSON把b2文件标成passed，但其21条均pending、没有完成；按日志裁定为中断，不计通过。main_menu_replay_seek的10条skip来自beforeAll缺导入映射，属于失败未执行；其余9个历史skip（性能1、旧tick4、speed2、objective2）及smoke的1todo见[完整首败/非执行清单](evidence/phase6z-first-failures.json)。未发现实际timeout失败，不擅自把OOM改叫timeout。

R1已应用21文件：两个Vue局部函数名、17个测试前提/内存留存修正、两个原法重录夹具。引擎规则/RNG/生产SDK/持久写入代码均未修改。反事实和逐字段登记见[修复证据](evidence/phase6z-repairs.json)，所有生产回退仅在仓外副本，根工作树未采用回退。

| 原因 | 单变量证据与修复 | 保留的断言语义 |
| --- | --- | --- |
| 本地confirm名称撞D4守卫 | 两个生产组件改为submitPreset；不改守卫、事件名、DOM/i18n | 禁止原生确认框、真实创建键鼠行为 |
| ACK新增一处生产源 | 仅回退新增Game ACK行，旧文件25/25；源数21→22 | 每个源均先入档再观察、逐个ACK消耗 |
| 照明批处理观察点 | 仅回退Game.updateVision，旧文件29/29；spy改看updateLighting参数 | 2/3格body恰一中心光、全footprint遮挡、双流不变 |
| blueprint重试新增allowDrop参数 | 仅回退Game调用第六参，旧文件16/16；精确补false | 每次重抽整请求，已定义qualifiers不得走loot转换 |
| MainMenu新增公开selection导入 | 仅回退MainMenu生产文件，旧文件10/10；夹具接真实导入 | 原数值输入/seek/加载边界 |
| growth状态改为认证不可变JSON | 仅在runtime回退不可变存储，旧文件11/11；测试用复制替换安装私有sentinel | 白名单、无NPC/收据泄漏、DTO冻结、完整只读 |
| 旧身份常量/物品实例 | whole-run7、foundation20、growth1.10.0、worldSdk2、实例6和C3真实规则指纹 | 精确身份检查、所有历史拒旧负例和功能断言保持 |
| digest空域向量 | 原独立canonical SHA方法复现旧17和当前20 | Merkle/Unicode及历史foundation11 chain向量不变 |
| geometry黄金 | 原C5_CAPTURE_GEOMETRY，6处仅worldSdk1→2定义指纹 | 三seed全部坐标、工作位和射线逐值相等 |
| UR4黄金 | 原UR4_CAPTURE，52处仅chainDigest；仅回退FOUNDATION_PROTOCOL20→15，旧文件1/1 | 全snapshot、事件、命令、tick、双流及连续/动画相等 |
| b2内存 | 原3072MiB单文件单worker再次OOM；逐层完成断言后清stairs spy记录 | 34seed×26层、机器/占位/覆盖者/连通性全部保持，不提高内存或减样本 |

UR4首次反事实误用17仍失败，日志`R1-cf-ur4-wrong17.*`保留；随后从夹具最后提交b2702ff确认历史为15，正确单变量通过。没有因此采用错误黄金。R1定向20文件385项全通过，b2独立完整文件21项通过（304.74s），同一物理删除树5文件86项与补跑生命周期1项通过。没有重新启动653文件批次。

R2仅改`settlement_review.test.ts`：夹具手工改光照状态后，在两处`updateVision`前清空旧光照。单变量回退Game.updateVision后，原文件12pass/1fail，证明两项hidden-light失败的前提变化；剩余键盘失败在反事实中也存在。采用夹具修正后整文件仍12pass/1fail，原断言全部保留。剩余展开状态下`u.key('k')`预期false、实际true（约第82行），未改输入守卫或放宽断言。R1/R2均为本作者审查与复验，没有独立审查者。

首轮160项断言失败最终关闭22项；18个首败文件完整关闭，settlement文件关闭2/3。MainMenu的10条初始化skip恢复通过、b2的21条pending恢复通过，均不混入160项断言失败的减法。剩余22文件138项见[逐项未关闭清单](evidence/phase6z-unclosed.json)，保留用例全名、原始错误及责任人。以下只列已观察到的失败入口，不把它们一概裁定为生产缺陷或纯格式变化：

| 未关闭范围 | 文件/断言数 | 已知入口与下一任务 |
| --- | --- | --- |
| dialog_host、phase4a0_spatial_differential、replay_import_ui | 3 / 11 | 固定seed蘑菇不同、完整图/checkpoint hash不同、旧foundation15正例遇Missing replay item；须单变量归因，正例不可只改头 |
| combat2_evasion/integrated_natural/links/natural/revisit | 5 / 6 | 旧manifest14/hash；核原捕获身份及完整自然路径，证明后按原法重录 |
| combat_combinations | 1 / 64 | loot开启组合未达到原自然玩家近战命中前提；无loot的64组合通过，不能放宽seed/样本/命中断言求绿 |
| crafting_trace、foraging_trace | 2 / 7 | 轨迹/指纹与第9命令不一致；归因后原法重录并逐字段登记 |
| giants2_persistence、giants2_trace、giants_spine_trace、giants_trace | 4 / 13 | 存录与黄金身份/轨迹失败；区分身份、RNG和真实行为，不套用旧giantHit例外 |
| narrative2_combinations/imports/persistence/trace | 4 / 34 | 原基线字段/声明及存录轨迹失败；正例修复须追完整生命周期，不借历史900s豁免提前身份失败 |
| resident_captive_natural、resident_natural | 2 / 2 | 自然路径前提失败；核现行世界/事件与原见证，保留原功能要求 |
| settlement_review | 1 / 1 | 展开面板键盘k行为冲突；按实际输入路由与既定合同裁定 |

以上全部交维护者安排后续有界修复任务，需归因、必要单变量反事实/原法重录以及整文件复验后才关闭；当前无新增豁免。两轮额度已经用完，未继续第三轮，也未为未改源码的失败重复运行。

仓外工具准备两次非产品错误保留：早期`select.py`名称遮蔽Python标准库select，改名`impact_selection.py`后运行（未启动types/build或测试）；预算审计首次误指artifact的inputs目录，实际文件在candidate-artifacts，修正路径后exit0。没有因此修改生产或预算。

## 4.1 维护者裁定后的清理

2026-10-17追加授权，沿用[2026-10-13 ext 测试瘦身政策](phase5-test-policy.report.md)。本轮开工HEAD为`06682d5`；19:20观察到外部CI拆分提交将HEAD推进至`1094801`，CI文件字节与本轮开工快照一致，本作者未执行Git写入。本节覆盖§4末尾旧“需单变量反事实/逐字段归因、不得继续”的后续安排；原首败、R1/R2和138项清单保留为历史证据。只处理原22文件及夹具/输入合同直接影响的文件，不重启全量、CE、组合smoke或性能任务，不提交。

身份、规则指纹与phase6合法功能变化按当前源码原法重录，不实施开发期兼容，也不做生产回退。所有同版本存读、回放、seek、续录、正伤害/状态/资源/居民等功能断言保留。当前无生产代码修复；`settlement_review`为camp-fix旧预期，真实选格路由本已隔离全局按键。

| 原未关闭测试文件 | 处置 | 原因与保留要求 |
| --- | --- | --- |
| `dialog_host.test.ts` | 前提调整 | 当前固定seed的未知mend外观为温石菌；保留未知/命名/品尝/已知与烤制名称、详情、存读身份替换及只读RNG断言。 |
| `phase4a0_spatial_differential.test.ts` | 重录 | 原P4A0_CAPTURE完整图捕获当前phase6字段/缓存/摘要；保留四组合13场景、完整图和存读回放功能。 |
| `replay_import_ui.test.ts` | 重录、前提调整 | 旧seed2采集路线已不成立；原foraging捕获器产生当前自然路线，再经真实App开局与公开命令导出，更新原正例raw；保留真实导入、响应式静止、0/末尾seek、存读续录及拒绝污染检查。 |
| `combat2_evasion.test.ts` | 重录 | 固定原公开输入重算当前manifest/完整机械摘要，原预警躲避与自然来源断言保留。 |
| `combat2_integrated_natural.test.ts` | 重录 | seed118原输入和伤害观察保留；七包缓存路线按原自然捕获器刷新，1620条不变，旧第463条NPC ID 249→当前247；继续严格检查非空自然NPC缓存冻结。 |
| `combat2_links.test.ts` | 重录、前提调整 | 身份修复后暴露原seed47夹具从未命中巨人（终止原因为no-safe-stair-route）；改用已按当前源码重录且经integrated用例验证的原生seed118三模块公开路线，真实巨人正伤害与growth focus消费均成立；原命中、来源、完整生命周期断言不变，不沿用旧giantHit例外。 |
| `combat2_natural.test.ts` | 重录、前提补足 | 原五seed公开输入逐条重执行，命中/释放/格挡与最终双RNG不变；身份关闭后发现旧采样上限D8无法覆盖D11起自然生成的zombie，且旧evasion标记未对应实际招式释放。原五条全部保留，再加已验证的seed3真实躲避路线及seed438491256、815公开命令的D11自然zombie路线；不注入场景/生命/RNG。五种玩家正伤害、五种自然NPC释放、格挡/躲避及每条同版本完整生命周期断言均未改。 |
| `combat2_revisit.test.ts` | 重录 | 原输入当前身份/摘要；真实楼梯往返与缓存断言保留。 |
| `combat_combinations.test.ts` | 前提调整（组合范围） | loot怪物倍率破坏原短战斗的自然命中前提；此矩阵限定不含loot的64组合，未改任何命中/伤害断言。含loot的组合生命周期沿用6Z七组合及既有loot测试，不声称本文件仍验证128组合。 |
| `crafting_trace.test.ts` | 重录 | 原CRAFTING_CAPTURE_TRACE重采最终当前身份/摘要；全部原公开命令、配方进展、耐久、工位及生命周期断言保持。 |
| `foraging_trace.test.ts` | 重录 | 原FORAGING_CAPTURE_DIRECTORY自然捕获器生成有效节点/库存戳与当前轨迹：A原seed2/149命令→seed24/43，B原seed6/27→seed2/68，沿用原1..64搜索和功能要求；保留No/Yes、吃/投/命名/下楼及烤制/焦炭、完整生命周期。 |
| `giants2_persistence.test.ts` | 重录 | 共用当前giants2原种子原捕获器夹具；伤害/部位/阶段、拒绝污染、楼层与存录功能保持。 |
| `giants2_trace.test.ts` | 重录 | lantern/copper各用原captureNatural与原seed采完整机械检查点，保留全部重放比对。 |
| `giants_spine_trace.test.ts` | 重录 | 原BROGUE_CAPTURE_GIANTS_TRACE；当前扩展身份摘要。 |
| `giants_trace.test.ts` | 重录 | 原BROGUE_CAPTURE_GIANTS_TRACE；D3/D7当前扩展身份摘要。 |
| `narrative2_combinations.test.ts` | 重录 | 原captureNatural与各原seed生成九组合当前公开路线/摘要；NPC与存录功能断言保持。 |
| `narrative2_imports.test.ts` | 重录 | 原AST字段集/导出声明指纹算法捕获phase6合法字段与合同；导入所有权、发现归属、指纹敏感性断言保持。 |
| `narrative2_persistence.test.ts` | 重录 | 使用当前五NPC自然路线；存读各节点、分支奖励、回忆、seek及拒绝污染检查保持。 |
| `narrative2_trace.test.ts` | 重录 | five-wizard/cord-normal使用原算法与原seed，保完整机械和消息检查点。 |
| `resident_captive_natural.test.ts` | 重录 | 原RESIDENT_FORMAT_CAPTURE，仅更新检查点digest；原239输入、救援、No/Yes、付费营地床铺与生命周期保持。 |
| `resident_natural.test.ts` | 重录 | 原RESIDENT_FORMAT_CAPTURE，仅更新检查点digest；原956输入、同actor/作物、岗位/饥饿/楼梯/存录功能保持。 |
| `settlement_review.test.ts` | 前提调整 | [camp-fix §2](camp-fix.report.md#2-施工面板与键盘)规定选格期间接管全部键盘；`k`应返回true，玩家位置与显示光标均不变、不录命令。折叠与非选格放行保持，并补入真实InputManager的k隔离覆盖。 |

限定整文件批次为上述22文件，加直接受居民夹具影响的`resident_production_replay.test.ts`、`resident_replay_import_ui.test.ts`，以及新增真实按键隔离覆盖的`settlement_input.test.ts`，共25文件。使用3072MiB、maxWorkers=2及原测试超时，无名称筛选/skip/todo。首批 **227pass/3fail，exit1，2200.14s**，原结果保留：导入测试重录编辑误删了旧拒绝用例仍需的`historicalRecording`声明；links原路线缺巨人命中；natural旧样本缺自然zombie释放。前者只恢复声明，后两者补足上述真实路线，均不改功能断言。因实际失败修正，必要补验仅重跑这3个完整文件，**10pass/0fail，exit0**；其余22个已通过文件不重复。逐文件最终状态全部通过，两次执行的重叠计数不相加，也不把首批exit1改称一次全绿。

原138项的处置为74项修正/重录，加64项含loot组合按本次授权调整矩阵范围；后者没有执行，不能报成138项全部复验通过。`settlement_review`确认是旧合同预期而非生产缺陷；本轮没有生产修复。自然战斗新增D11路线沿用原start/play/observe/mechanical/digest公开捕获方法，只用已有纯导路函数及只读BFS选取输入，无性能runner或状态注入；首次导路错过zombie后触发深度上限失败，日志保留，随后捕获实际释放并由原完整生命周期门禁验证。原五条自然路线全部保留，新增两条，未减少样本/断言或提高超时。

boundary、静态依赖、`vue-tsc -b`及Vite build均exit0。它们在导入声明和links修正后执行；此后只补自然战斗的不透明JSON夹具，没有生产/测试代码变化。补验期间源码/夹具逐文件SHA完全稳定；补验通过后，仅把自然夹具改为每条trace一行的紧凑JSON（1,261,804→720,396字节，解析值完全相同），不为纯空白重跑测试。最终依赖检查再次exit0；build仍只有原有chunk体积提示。未启动全量、CE、组合smoke或性能任务。

本轮差量为7个测试源码、29个当前夹具、本报告§4.1及顶部状态提示，另新增[清理证据](evidence/phase6z-cleanup.json)；逐文件SHA、两批真实结果、门禁命令/退出码及前提修正说明均在证据中。开工时既有生产/测试/CI改动保持，只有原`settlement_review`追加本次键盘修正；本作者未执行commit/push或其它Git写入。原始138项清单及报告其它章节逐字节保留。仓外原始捕获、日志和脚本位于`/private/tmp/phase6z-cleanup/`，没有新增>1MB原始证据到仓库。捕获阶段的名称筛选运行不冒充最终整文件验收；原失败日志均保留。

## 4.2 UI 创建流程组合冒烟与发布阻断修复（2026-10-18）

本次基于 `ext/phase6` / `cbeb1b4`，开工工作区干净；按维护者要求在 Node/SFC 环境定位，未启动浏览器、全量/CE/drift、性能或删除矩阵，未 commit。维护者原始复现为 vite dev、800×900：全选 8 模块，growth 卫士/人类/无信仰确认后，在 loot「确认预设」处显示 `ext.creation.unavailable`，未发出 `new-game`。

**二分与根因。** 用客户端编译的真实 MainMenu、GrowthCreationStep/Panel 和 LootCreationStep/PresetPicker，保留实际模块发现、推荐勾选、创建计划、命令合并、配置桥及 registry。只替换 Node 下的 SFC 加载方式和无关标题特效/图鉴。在生产文件未修改时得到：

| 选择集 | MainMenu 提交结果 |
| --- | --- |
| 全部 8 模块 | 失败，`DataCloneError` |
| combat + crafting + foraging + giants | 成功 |
| growth + loot + narrative + settlement | 失败，同上 |
| growth + loot | 成功 |
| narrative + settlement | 失败，同上 |
| narrative | 成功 |
| settlement | 失败，同上；无需任何创建弹窗 |
| 空集 | 成功 |

最小触发集是 **settlement 单模块**。`configurationDrafts` 是深响应式 `ref`；`buildModuleCreationConfigurations` 的 `Object.entries(drafts)` 保留了营地配置 `{ raids: false }` 的 Vue Proxy，`ExtensionRegistry.manifest()` 在 `structuredClone(configuration)` 处抛 `DataCloneError: #<Object> could not be cloned.`。loot 的配置被 `configurationFromCreation` 替换成普通 `{ presetId }`，所以 growth+loot 正常。此缺陷不是配置键冲突、命令所有者/顺序或模块规则冲突。旧 submit 在配置构造之前锁定 `creationSubmitting`，catch 又不复位，异常后还会阻断重试。

生产修复仅在 `MainMenu.vue`：以 `structuredClone(toRaw(configurationDrafts.value))` 将 UI 自有草稿快照化后传入配置桥；全部创建数据构造成功后才锁定提交。catch 输出带模块列表、当前步骤和原始 Error/stack 的 console 诊断（开发和生产均保留），复位提交锁；无创建步骤时退出 creationContext，使「进入地牢」可重试。保留原 i18n 错误提示，不修改 registry 校验、引擎规则、命令边界、RNG、manifest/存录格式或黄金基线。

**原冒烟为什么漏检。** `scripts/check-module-composition-smoke.mjs` 直接 `registry.manifest(ids)` 使用普通默认配置，从 `registry.create(manifest)` 获取 `initialCommand`，再调用 `game.startNewGame` / `executeCommand`；完全没有 MainMenu 的响应式草稿与配置桥。旧真实创建 UI 用例仅覆盖 growth+loot，foundation UI 用例使用无营地配置的合成模块。因此先前「七组合 engine passed」结论仍是引擎范围，不能代替创建 UI 验收。

新增 `src/test/ext_creation_combinations_ui.test.ts`（登记常规套件及 8 个 required 模块依赖），共 **11 项**：

- 精选七组合：全开、全关、loot+growth、loot、growth、全开去 loot、全开去 growth。全开即全部 8 模块，不重复计数；另加 settlement 最小触发集。
- 全部模块下实际修改 `raids=true` 与 `scarce` 非默认预设，确认合并值没有丢失。
- 含创建步骤的 loot 与无步骤的 settlement 各注入一次配置构造错误，断言原始 Error 和上下文诊断、显示错误、可重试、保留选项且只发出一次新局。

每个成功路径通过真实菜单控件选择模块（loot 自动推荐 growth；需要 loot-only/去 growth 时显式取消），UI 输入 seed 42，点击实际创建控件。MainMenu 原样载荷进入真实 `Game.startNewGame`，核对 D1、存活、runtime `readyToSave`、完整 manifest 与录像 manifest、初始命令 owner/顺序及实际记录的逐条输入；growth 同时核对卫士/人类/无信仰，loot 预设与 manifest 配置一致。测试设置 800×900 的宿主窗口值，但 Node renderer 不验证布局/真实浏览器，不能据此关闭人工视口清单。

**限定验收。** 修复前七组合中全开/去 loot/去 growth 三项失败，均未发出新局；另四项成功。修复后相关整文件批次 6 文件 **62/62 通过、exit0**：新增组合 UI、`ext_module_creation_ui`、`ext_module_ui`、`main_menu_replay_seek`、`loot_game_sfc`、`ext_growth_creation_ui`，命令为 `npx vitest run <上述六文件完整路径> --maxWorkers=2`（13.61s）。boundary 与测试依赖检查通过，后者 678 文件、errors=[]；首次 vue-tsc 发现新增测试 tuple union 的 `includes` 参数被推断为 never，仅给用例 ids 增加 `readonly string[]` 类型注解后 `npx vue-tsc -b` exit0。未修改任何旧测试或守卫，也未改失败断言求绿。随后补强 loot 自动推荐 growth 的明确断言，新增 UI 文件定向复验 **11/11 通过、exit0**，不与 62 项重复相加。单独 `npx vue-tsc -b` 后直接执行 `npx vite build`，构建 exit0（3.39s），仅原有 >500kB chunk 提示，未重复调用含 types 的 npm build。

本次原始日志保存在仓外 `/private/tmp/creation-{bisection,prefixed,fixed,related,ui-final,boundary,dependencies,types,types-final,build}.log`，二分逐组合错误栈在 `/private/tmp/creation-bisection.jsonl`；不提交大体积依赖清单。探针首次两次被现有测试登记/依赖守卫拒绝，补正确套件登记及实际全模块 manifest 前置断言后运行，没有修改守卫。前述历史失败和本次定位失败均保留，不能把定位阶段称为一次全绿。

## 5 既有性能预算与云端状态

本节下列为上一轮历史核对，最新拆分artifact结论、预算采纳及限制见§5.1。

只做文件/hash/身份核对，新增A/B、正式性能回放、独立基准运行次数=0。影响面整文件中原有`combat_runtime`包含9次命令计时观察，已随21项执行；这是整文件运行附带的计时，并非“完全没有计时”，没有用于性能结论或预算采纳，也不重跑。原`ext_structure_performance`保持环境开关关闭的既有skip；`resident_performance_preparation`是untimed计数/合同断言。`budget-audit-final`exit0：原loadPerfIdentity核对classic/all路线长度、D20≥500、source/route/manifest recordingHash。B4/C1原result文件SHA吻合provenance；C2去provenance的原freeze SHA吻合`81d9a0086f666254439f93981c0b0e8082e1c21afb8bc5c39ece13d406ce83ae`，两套route/source与原云端artifact逐字节相等。

| 阶段/run | 已核对结论 | 限制 |
| --- | --- | --- |
| 6B4 [38860207834](https://github.com/coolking70/BrogueJS/actions/runs/38860207834) | GitHub原job failure保持；维护者修订D6后离线重算pass、预算accepted | 0/3越线，完整all不同工作量仅报告；无第4次独立回放，不借新运行追认 |
| 6C1 [38920592958](https://github.com/coolking70/BrogueJS/actions/runs/38920592958) | 原job success，三轮预算与独立验证已采纳 | 仅原C1候选，不当C4性能结论 |
| 6C2 [38960940396](https://github.com/coolking70/BrogueJS/actions/runs/38960940396) | 原job failure、hard pass、D6 regression；维护者接受known-prefix-overhead，预算accepted | D1 47输入/45块，all前缀3/3 P95越线（约11–14%），不伪改pass；本地独立完整复核classic2208/all2423事件0 OOS，非第4次云端计时 |
| 6C3 [38996836519](https://github.com/coolking70/BrogueJS/actions/runs/38996836519) | job117291147218 completed/failure；第3轮A-all-full阶段触及330分钟步骤上限 | 三轮未完成；无冻结manifest、accepted=false，待维护者裁定 |
| 6C4 [39006896716](https://github.com/coolking70/BrogueJS/actions/runs/39006896716) | job117321092332 completed/cancelled；第1轮B-all-prefix阶段取消，已生成pending C3基线 | 三轮未完成；无冻结manifest、accepted=false；不能仅翻accepted，待维护者裁定 |

GitHub查询走连接器（本机gh/DNS访问失败原日志保留），原job状态与性能裁定分开。09:15 UTC复核已取得作业完整文本日志及制品元数据：C3 control/B=`0d2e98a`、A=`33d7aba`；C4 control/B=`07d7c97`、A=`0d2e98a`。C3制品12095515952（32,642,435字节）、C4制品12094918558（14,538,993字节），ZIP SHA/日志SHA及到期时间见[预算审计](evidence/phase6z-budget-audit.json)。连接器返回ZIP引用，但本机DNS无法下载ZIP，因此只声明日志/元数据已取得，完整制品未本地归档；不从部分日志推算P95或D6。原07:09查询的in_progress快照保留。没有dispatch/rerun。制品7天保留，维护者归档与补齐control/A/B SHA、attempt、完整结果/独立验证后才采纳；不阻塞本次其它收口工作。

| 预算身份 | 完整文件SHA-256 | accepted |
| --- | --- | --- |
| 6b4 | `c659a3788e4f53aa8ea20e7a050950b3bb39f990f2fd92863a3f7eecc0ea2e38` | true |
| 6c1 | `d2734c8d7c2930d3db0549289e9eb165ff89505c2e95c5db43035b343fb53ab3` | true |
| 6c2 | `63f210adef8608b9b048f3ae07ec3188251a7be7f879522084d9fa7c6f6e563f` | true |
| 6c3 | `尚无预算` | false |
| 6c4 | `尚无预算` | false |

### 5.1 拆分云端复核与预算采纳（2026-10-17）

本次使用维护者已下载的完整 artifact：6C3 `/private/tmp/perfci-39028334751/`、6C4 `/private/tmp/perfci-39028341691/`。开工 HEAD `ed13574`；未触发云端、未修改生产、observer、D6 阈值、自动 freeze 或回放语义。原汇总工具从三个 shard 在新目录重新合并，核验原工具 hash、runner invocation、A1/B1/A2/B2/A3/B3 次序、完整输入、逐轮域/最终状态、原 A 预算及补充场景，结果与原 aggregate 相同；6C4 因 pending 基线原本不检查 A 预算，本次另以新冻 C3 对其三轮 A 完整结果检查通过。原 artifact 只读，离线证据在 `/private/tmp/p6-perf-review/`。

| 阶段 | 原工具结论（保持） | 本次采纳 |
| --- | --- | --- |
| 6C3，33d7aba→0d2e98a，run39028334751 | hard pass；classic 0/3、all/full 2/3、all/prefix 1/3；D6 regression | 更符合尾部噪声特征，未确证真实代码回退，但不能证明纯噪声；保留尾部风险，按本次维护者授权登记 `known-tail-risk` 并冻结，不伪改自动 regression 为 pass |
| 6C4，0d2e98a→07d7c97，run39028341691 | hard pass；classic 0/3、all/full 1/3、all/prefix 1/3，三个 gate pass；aggregate incomplete | 离线正式计时 pass，接受 C3 后基线链完整；冻结 `offline-passing-timing`，原 incomplete 保留 |

**6C4 incomplete 原因不是汇总工具缺陷。** `pendingPerfBaseline(6c3,6c4)` 在 C3 accepted=false 时为真，`canFreeze` 明确返回 false，`overallStatus` 因而 incomplete。runner 同条件跳过独立第4次 B 回放；aggregate 只在 status=pass 时生成 candidate/suggested manifest。缺少的是完整第四轮验证与冻结 manifest，不是三轮输入/计时或 C1/C4 补充场景。仅翻 accepted 再跑普通 merger 会在“Missing independent fourth B replay”处失败；本次没有降低该守卫。按既有维护者离线采纳做法，用原 `freeze-split` 从各 case 原 B 完整1/2/3轮冻结，再重查这三轮；这是校准数据复查，不能叫独立复核。C3仅有classic第4轮，all缺；C4两个case都缺。未来自动路径仍要求完整独立复核。

**6C3 不属于工作量差异。** classic 两侧2208输入/2431块；all两侧2423输入/2549块与客观回合/253375 ticks，全部observer调用计数一致，去ms的rowsHash、双RNG完全一致。all相同结果前缀为2423，覆盖完整路线；state/domain hash随版本身份变化不作跨版本强等。不能把all/full降为report-only，也不能借另一runner的prefix通过抵消其2/3越线；prefix门禁按既有策略只比较全程指标，不包含D20分层指标，即使该次前缀恰好等于全程。

| all/full 指标 | 第1轮 A→B | 第2轮 A→B | 第3轮 A→B |
| --- | --- | --- | --- |
| 命令 P95（ms） | 739.293→744.693（+0.73%） | 753.834→741.409（−1.65%） | 724.866→738.941（+1.94%） |
| 墙钟（s） | 789.048→790.667（+0.21%） | 801.382→803.769（+0.30%） | 768.440→795.076（+3.47%） |
| 客观回合 P99（ms） | 380.287→631.881（+66.16%） | 390.738→401.182（+2.67%） | 384.681→402.847（+4.72%） |
| D20命令 max（ms） | 2165.010→3178.313（+46.80%） | 2971.452→2153.694（−27.52%） | 2760.532→2103.488（−23.80%） |
| D20客观回合 P99（ms） | 190.062→283.585（+49.21%） | 211.470→200.160（−5.35%） | 190.075→256.729（+35.07%） |

D20每轮570个客观回合，P99取第565小（第6大），容易受少数尖峰影响。同一all/full runner的A自身D20命令max跨度37.25%，B跨度51.10%；B客观总P99第1轮比第2轮高57.50%。D20>500ms客观块：A三轮1/2/1个，B为3/0/2个；A发生于2031、2111/2351、2347，B发生于2030/2144/2368、无、1961/2273，尖峰不是固定命令新增工作。稳定较慢的1993/2285/2399在两侧反复出现。P95/墙钟无越线，尾部跨轮漂移支持噪声为主，但原wall artifact没有GC/调度记录，不能声称已经证明某一次GC或排除微小真实分配开销。

本地 profile 使用隔离的A=`33d7aba`、B=`0d2e98a`源码副本和各自云端原all输入，从origin完整串行回放；只在副本加诊断计数，主仓生产未改。每侧2423输入、0 OOS，最终完整状态hash分别精确等于云端A/B，两条RNG也一致。计数窗口是loadReplay后的输入执行；CPU仅采D19–D20，不包括冷启动。原始脚本、log、`.cpuprofile`及小型汇总在 `/private/tmp/p6-perf-review/`，不将单次本机耗时用于D6或预算。

D19–D20共551输入/622客观块：两侧`validateLootItemData`均80次，新增`prepareWorkOperation`、`bindCraftRoll`、`completeWorkOperation`、`completeCraftRoll`及runtime work-item provider入口均0次，`computeEquipmentRowBudget`在本次回放计数窗口内0次。来源校验函数会检查新增craft条件，但这条路线的craft来源为0；最终保存图的loot来源出现15个floor、2个kill，工作事实仅2条startup，没有制造/重铸/拆符文。不能以入口未触发为理由跳过通用校验开销。

D1–18两侧`worldWorkTransaction`均145次、`checkpointWorldWork`均147次；C3把前者转入`itemCommandTransaction`，因此后者A=1、B=146，确有共享回滚保护增加的内部工作，并非“所有新增代码都未执行”。这些调用在D19–D20均0，不能直接解释D20尾部；撤掉回滚保护会改变语义，未发现由证据支持的低成本等价修复。D19–D20 self CPU采样仍以既有`structuredClone`（A36.08%／B35.79%）、`isStatJson`（5.90%／5.69%）等为主；新增工位函数和`validateLootItemData`没有self样本，零采样不等于零耗时。GC采样占比3.99%／4.80%，单次profile的差别不能归因为云端某次暂停或证明纯噪声。综合结论为排除路线工作量差异、尾部偏噪声但保留真实分配/回滚开销风险；原D6 regression不变，按本次授权登记已知尾部开销/风险。

预算来源严格为各自候选commit；6Z当前HEAD不冒充两个历史候选。新增C3/C4 manifest及classic/all route/source，`loadPerfIdentity`核验完整长度、D20≥500与recordingHash后才登记accepted=true。绝对时间不跨runner比较，保留三轮所有样本；没有新云端计时、没有完整第四轮独立云端验证，不覆盖浏览器/真机、D22+、最大居民负载、工位/craft及部位掉落压力性能。对应受控补充场景仅证明功能/规模，不替代该覆盖。

本轮限定验证全部exit0：`node scripts/test-ext-perf-selection.mjs`、`node scripts/test-ext-perf-ab.mjs`、`node scripts/test-ext-perf-split.mjs`及`npm run check:test-dependencies`。身份测试随已采纳预算更新；缺产物/hash漂移/轮次/阈值/缺第四轮拒绝断言保留，原pending基线拒绝语义移到隔离的未接受C3注册表夹具继续验证，未放宽守卫。测试在两次诊断回放结束后串行执行。主仓无生产代码修改，因此未跑生产相关测试、boundary、vue-tsc、build或全量门禁。没有commit/push。日志及退出码见[联合证据](evidence/phase6c3-c4-perf-review.json)。

本次新预算登记（覆盖上表C3/C4历史“尚无预算”行）：

| 身份 | manifest SHA-256 | accepted |
| --- | --- | --- |
| 6c3 | `c497c6788b394da0f2ce5d69d5913b8eaca859b3b24d749a70bc5bdc693e9924` | true（上述离线裁定及限制） |
| 6c4 | `8820ca2e4da1bc69af1a95fddbfc17a3479bf98fce35a0b801a38927377c9557` | true（上述离线裁定及限制） |

全部身份、逐轮指标、计数、profile摘要及校验日志hash见[联合证据](evidence/phase6c3-c4-perf-review.json)。

## 6 合同、文档和延期

[loot-config](loot-config.md)按实际22文件schema、预设、四槽/鉴定/过滤/分解/强化/精炼/镶嵌/工位/craft/part、费用、来源/收据/知识、软依赖与指纹、预算/扩展方法收口。当前core/UI合同去除过期现行0.3.0/随机符文未开/C预留说明。A/C0/B3/B4及历史C5报告只加明确后继入口，不改冻结数值/历史通过数；growth/stats/crafting/settlement/扩展架构、HANDOFF/README/状态卡/索引、i18n与release入口同步。

版本逐项从源码核对：foundation20、itemSdk4、worldSdk2、world schema6、edibleSdk1；loot0.9.0/pack0.6.0/schema5/实例6/state2/dropTables2；crafting1.1.0/definitions2、growth1.10.0；whole-run7/recording4/origin2。SDK逐入口SHA与phase5差量见[合同差异](phase6z-contract-delta.md)，不能再称九冻结全不变。U03相对phase5仅增加6B4 `pendingEnchantmentScrollId`（run.enchantmentScrollId、成功/取消/新局清空、load校验所有权）；C3/C4没有新增Game字段。本次无新增玩家文本或Game字段。

[统一人工清单](phase6z.manual-checklist.md)18项×320×568/800×900/1440×900，54格全部待维护者；自然路径、受控稀有场景、构建/输入身份与结果模板齐全，不把SSR/引擎通过写成浏览器通过。[遗留/延期](phase6z-remainders.md)列责任人、前置、下一任务、验收方法及阻断属性；site、M4、内容扩编/T7、新职业、真机/D22+/最大世界以及历史5Z未覆盖范围保持明确，不自动扩大本轮。

## 7 foundation差异与发布停点

最后于2026-10-17 10:11:23 UTC通过GitHub连接器复核远端ext/foundation，SHA仍为`33d7aba6e458529ae126dee2d889c7b2c24507bd`，与本地remote-tracking一致。`git rev-list --left-right --count origin/ext/foundation...HEAD`为0/3；共同祖先就是目标，当前可快进关系。三提交为6C3 `0d2e98a`、6C4 `07d7c97`、6Z任务单`06682d5`；已提交部分107文件、4172增加/319删除行，详细清单仓外`foundation-diff.names`/`.stat`。本次未提交文档/修复另列最终`final-candidate.patch`、`final-delivery-manifest.json`（所有改动/新增文件及内容SHA，含本报告），不能把HEAD当已含交付文件。

现Pages工作流仅ext/foundation push（另有workflow_dispatch），Node24、base `/BrogueJS/`；main/Node22为历史经典流程。已写[发布说明草稿](phase6z-release-notes.md)，无发布授权、不执行Z7。之后目标前进必须核实际合并树与失效影响，不force、不顺带合main；人工/性能及任何正确性阻断关闭前不称可发布。

最终交付为44个既有文件修改（22文档、22源码/测试/夹具）及15个新增文档/小型证据文件。文档检查347个本地文件链接均存在，JSON可解析，无新增CRLF或>1MiB新文件，`git diff --check`通过；src/scripts与最终身份一致，分支/HEAD未变，暂存区为空。本轮自有门禁队列均有完成标记和真实退出码，不留后台测试继续消耗第三轮额度。最终工作树补丁和新增文件内容SHA由上述仓外交付清单保存，原首败日志及反事实失败均未覆盖。

## 8 追加：性能 CI 分片修复（2026-10-17，未提交）

本节为维护者另行授权的 CI/脚本增量工作，覆盖上文“本次不新跑性能”的范围描述；上文 6Z 门禁、未关闭项和旧云端状态保持历史原样。没有改引擎、既有 6Z 修复或预算采纳状态，没有 commit/push/dispatch。C3/C4 原完整 artifact 现已在 `/private/tmp/perfci-38996836519/`、`/private/tmp/perfci-39006896716/` 可读，本节基于其 `result.json` 的实际步骤起止时间估算，不把中断样本重算成通过。

### 拆分与裁定

- `.github/workflows/ext-perf.yml` 改为 `classic`、`all-full`、`all-prefix` 三个并行 matrix job，`fail-fast: false`。每个分片独占一个云端 runner，按 A1/B1/A2/B2/A3/B3 顺序运行；classic 与 all 拆开后，all 本身仍需 full/prefix 再拆。各 job 上限 360 分钟、测量步骤 345 分钟，保留安装和证据上传窗口；失败/超时仍上传已有结果。
- `run-ext-perf-ab.mjs --shard …` 自动限定 case/kind。完整前缀与完整录像等长时，复用已经由生产导出的完整输入字节，避免重复捕获；prefix 的计时回放仍独立执行，不复用 full 的测量样本。前缀较短时仍按原捕获入口重新导出。生成器、观察器、原始录制字段及 D6 阈值没有变化。
- 新增 `merge-ext-perf-ab.mjs NEW_OUT CLASSIC_DIR ALL_FULL_DIR ALL_PREFIX_DIR`；最后的 `summary` job 用 `if: always()` 下载三份独立制品，核对 SHA/工具字节/运行 attempt、分片身份、完整 A/B 顺序、输入 hash、原始 summary/rounds、逐轮最终状态和 domain、稳定计数、两条 RNG、全量与前缀对应关系，再检查 A 的已采纳预算。缺分片、缺轮、未完成、硬门禁失败或混用身份都会生成失败 summary/result，不能冒充 pass。
- 统一沿用 `D6-2026-10-16`：P95 +10%、客观回合 P99 / 命令 max +25%、elapsed +10%，最小 1 ms；任一可比指标越线达到 2/3 轮判 regression。classic/full 与 all/prefix 必须证明可比；all/full 工作量不同才仅报告。不同分片 runner 的绝对时间不相互比较。
- 三轮 D6 通过才从各 full 分片的前三次 B 数据冻结建议预算。两个 full 分片各自在自己的 runner 留一份独立第四次 B 完整回放，汇总冻结后用这份保留样本检查预算；准确含义是“独立保留回放、冻结后检查”，不是汇总 runner 又回放一次。`freeze-split` 允许不同 case 来自不同 runner，但每个 case 内三轮仍要求相同 node/machine/source/语义/计数；旧 `freeze` 的跨 case 同机限制及其测试保留。
- 汇总制品 `ext-perf-<run>-<attempt>-aggregate` 包含 `result.json`、`summary.md`、三份原始分片、预算/比较日志，以及仅在合格时生成的 `ext-perf-<identity>-budget.suggested.json`。各分片另有独立 artifact。建议预算保留各 case 的 runner/provenance；不写仓库预算、不自动把 accepted 翻为 true。C3 仍未采纳时，C3→C4 的 pending-baseline 保护不变：可以完整比较并显示各 D6 gate，但总状态 incomplete，不建议冻结 C4。

### 时长估算与余量

旧 C3 artifact：classic 2208 事件，all/full 与 all/prefix 均 2423 事件。all 的生成 25.31 分钟、A/B 完整捕获 24.46/24.36 分钟；已完成完整观察平均 24.34 分钟。旧单 job 中 all 一项约需 440 分钟（含原重复 prefix 捕获、三轮两种观察和第四次 B 验证），因此只拆 classic/all 仍不够。新估算使用已完成步骤，不补造被截断的第三轮耗时。

| 分片 | C3 按原慢 runner 估算 | C4 按原 artifact 估算 | C3 ×1.2 + 10 分钟准备/补充/上传 | 相对 360 分钟 job 余量 |
| --- | ---: | ---: | ---: | ---: |
| classic | 11.22 分钟 | 9.18 分钟 | 23.46 分钟 | 336.54 分钟 |
| all-full | 244.55 分钟 | 198.22 分钟 | 303.46 分钟 | 56.54 分钟 |
| all-prefix | 220.20 分钟 | 180.27 分钟 | 274.24 分钟 | 85.76 分钟 |

C4 旧 artifact 也证明 prefix=完整 2423 事件；其 runner 较快，完整观察约 17.95 分钟。表内 C4 保守计入 pending C3 重新生成及第四次 B，两者当前不会同时需要（pending 禁止冻结）。若用 C3 的慢速估算 C4，约 270 分钟；再加 20% 波动和 10 分钟固定成本约 334 分钟，仍低于 360 分钟，测量部分低于 345 分钟。汇总只做离线校验/冻结，不再次跑引擎，单独留 20 分钟。估算不是运行时保证；后续路线长度/复杂度增长需重新估算。计算明细在仓外 `duration-estimates.json`。

### 云端重跑参数

workflow 需从包含本次工具修改的 control revision 调度，不能直接重跑旧 workflow 代码；A/B 引擎身份保持以下固定 SHA。这里仅登记参数，未调度云端任务。

| 重跑 | base_ref | head_ref | base_identity → head_identity | rounds |
| --- | --- | --- | --- | --- |
| 6C3 | `33d7aba6e458529ae126dee2d889c7b2c24507bd` | `0d2e98a91e238e9c988017e87c7a51fb31569691` | `6c2` → `6c3` | `3` |
| 6C4 | `0d2e98a91e238e9c988017e87c7a51fb31569691` | `07d7c97cdbe3f49ed58ae5137d145fceb02fcfbb` | `6c3` → `6c4` | `3` |

本地复现使用 Node v24.19.0、3072 MiB；A/B 是 `/private/tmp/ext-perf-split-20261017/{base,head}` 的独立 detached clone，只覆盖与 CI 相同的两个测量工具文件，不修改 `src`。三分片用相同参数：

```sh
node scripts/run-ext-perf-ab.mjs \
  --base /private/tmp/ext-perf-split-20261017/base \
  --head /private/tmp/ext-perf-split-20261017/head \
  --out /private/tmp/ext-perf-split-20261017/<shard> \
  --base-identity 6c2 --head-identity 6c3 --rounds 1 --shard <shard>
node scripts/merge-ext-perf-ab.mjs \
  /private/tmp/ext-perf-split-20261017/aggregate \
  /private/tmp/ext-perf-split-20261017/classic \
  /private/tmp/ext-perf-split-20261017/all-full \
  /private/tmp/ext-perf-split-20261017/all-prefix
```

`<shard>` 分别为 classic/all-full/all-prefix；没有 `--limit`，走完整路线。两个 all 分片本地并行，都是同一台 Apple M5 的独立进程，因共享本机资源且仅一轮，计时仅诊断；正式云端每个分片使用独立 runner，三轮才可给出正式结论。原始证据全部留仓外，不提交 >1 MiB 文件。

相关脚本验收（均 Node v24.19.0，最终退出 0）：`test-ext-perf-ab.mjs`、`test-ext-perf-split.mjs`、`test-ext-perf-selection.mjs`、`test-ext-perf-route.mjs`；`check-test-dependencies.mjs` 检查 677 个文件，errors=[]。新增分片测试实际走 CLI，覆盖三轮合成证据汇总/建议预算/第四次保留样本检查、一轮 incomplete、跨 case 不同机器、缺分片/缺轮/缺验证/重复或乱序输入、身份/attempt/工具/原始 summary 漂移及 regression 拒绝路径。合成通过不作为真实性能结论。首次新增测试因临时 control 缺 `node_modules` 找不到 vite 而失败，已修临时夹具依赖链接，并给云端 summary job 加 `npm ci`；没有改生产断言。最终日志及命令/退出码/耗时在仓外 `script-checks.json` 和同目录日志。

Workflow YAML 可解析，matrix 三分片、`fail-fast: false` 和 summary 的 `needs: ab` / `if: always()` 检查通过。原 6Z 证据登记的 22 个源码/测试修改逐一核 SHA-256，全部保持原 `after` 值。未运行 npm 全量、drift、types/build、CE 或其它门禁。

实际完整路线冒烟已完成（`rounds=1`、`limit=0`）：三个分片及汇总命令全部 exit 0；classic 耗时 2.59 分钟，all-full 45.82 分钟，all-prefix 45.48 分钟（后两者本机并行）。classic A/B 各 2208 事件、all-full A/B 与 all-prefix A/B 各 2423 事件，六份观察均 0 OOS。两份 all 分片的完整 A/B 输入及 prefix 输入 recordingHash 均与旧 run `38996836519` 一致；最长可比前缀 2423 事件。汇总重新读取原始 summary/rounds、核对身份/输入/语义，并实际执行 `original-budget-1` 检查，全部硬门禁 pass。

| 本地一轮 gate | 越线轮数 | 判定 | 越线指标（A→B，ms） |
| --- | --- | --- | --- |
| classic/full | 0/1 | incomplete | 无 |
| all/full | 1/1 | incomplete | 客观回合 P99 316.564→417.859；D20 客观回合 P99 114.276→178.564 |
| all/prefix | 1/1 | incomplete | 客观回合 P99 264.026→416.992 |

总结果 **hard=pass、status=incomplete**，符合一轮诊断口径；没有生成 candidate/suggested manifest，没有第四次真实回放，也没有据此采纳 C3。保留本地越线原值，不把它们清零或归因成已经证实的环境噪声；同机并行且仅一轮不能替代独立云端 runner 三轮 D6 裁定。建议 manifest 的成功分支由前述三轮合成 CLI 测试实际覆盖，真实建议预算须等待完整云端结果。

最终本地交付证据：`/private/tmp/ext-perf-split-20261017/aggregate/{result.json,summary.md}`（含 `shards/` 三份可移植原始证据与预算检查日志）、`smoke-summary.json`、`script-checks.json`、`duration-estimates.json`。三分片运行和自动汇总进程均已退出，没有遗留后台测试。本轮实际修改范围仅 CI、五份性能脚本（含两份新增脚本）及本报告追加节；分支/HEAD、暂存区和原 6Z 的 22 份源码/测试修改保持。
