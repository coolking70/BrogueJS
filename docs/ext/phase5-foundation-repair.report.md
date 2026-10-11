# 六项底座维护者收口（2026-10-12）

独立 [R2](phase5-foundation-repair.review-r2.md) 通过，新增确证 S1/S2/S3 均为0。R1-F1至F5与combat2 VISIBILITY补充关闭，无需末修，不开R3。本提交收口六项生产修复、R1响应与正式回归，维护者已提交 `63a279e26a9166beaf321d01e1c0d434c55c08a8` 并成功推送origin/ext/phase5。

源码1311输入 SHA256 `73a08ca004620f1e9c5f78ef0fe298aee4d236a5a6b47d4916d973604b9afc14`，dist60 SHA256 `b7055a7b4d2d84c21badd1c3bc9975e6a8014dc4fe04c4499ed840f2df4f6696`，收口复算与R2一致。正常226文件唯一并集4314过/1既有CE skip，保留原bulk exit1与三完整文件修后58过替换口径；drift14过；缺五包剩余ext2924过/1同一skip；补充主6文件76过、缺包native5过。相关boundary/types/build与原性能通过。未重跑或累计既有结果，未冒称新一次226命令exit0。

combat2原完整文件仍2过2败/exit1：giantHit与zombie自然释放缺证据按用户裁定留集成，保留原断言及首败。下一步另立SDK-1/SDK-2小步骤，独立最多两轮审查后推送；随后依次集成narrative2与combat2，最终候选统一完整npm/ext/drift、128启用及15删除布局，不沿用旧5Z证据。Claude最终人工待验，XP skip、5D3另案。

以下历史“未提交/待R2”由本段覆盖。

---

# 阶段5底座六项修复报告（R1修复及VISIBILITY补充完成，2026-10-12）

本次R2前原作者补充已完成全部相关门禁，**三个combat2 VISIBILITY完整seek首败已闭，已按用户范围裁定写补充READY交父统一独立R2**。主候选1311 inputs／`73a08ca004620f1e9c5f78ef0fe298aee4d236a5a6b47d4916d973604b9afc14`，dist60／`b7055a7b4d2d84c21badd1c3bc9975e6a8014dc4fe04c4499ed840f2df4f6696`，19生产及全部原黄金保持R1字节。本次仅新增根native VISIBILITY 5项、foraging可见隐形盟友正例、根归属登记与文档/小证据。主6完整76pass、missing根5pass、边界/类型/构建通过；原3完整2pass/2fail（NPC zombie释放/巨兽正伤害原fixture缺口），原首败及原因保留；两内容项移至combat2集成待办，不阻塞本步。此前BLOCKED是历史判断，已被本次用户裁定覆盖，详见文末范围收口。外部原内容未合入，SDK未执行，R2仍由父独立派发。下方R1收口身份/计数是历史，未受影响结果按完整源重构证明复用，不冒称新完整npm/ext/128/15。

## R1历史收口（2026-10-11；其另resume前置现已完成）

本轮R1原作者修复及相关门禁已实际结束，F1–F5、原63项失败和扩展空间5项首败全部关闭。此为 `foundation-r1-fix.READY.md`，尚不是六项最终R2验收或发布：父会话必须另resume同原作者补combat2 seed3/47 VISIBILITY，再进入唯一剩余独立R2，无R3。唯一生产作者，ext/phase5，开工及当前HEAD `4856505e2c48f37586ca016af2d59f443b79ec9d`（生产 `0ec7c56`），全部改动未提交；未合narrative2/combat2、未commit/push/tag、未派审查代理或其它作者。SDK1/2和步骤B全量npm/128/15不在本轮；XP disabled/skip、5D3和Claude人工待验边界保持。

最终源码1310 inputs／`2184edaa2205880e3c35a6517a69c996dfbe2d0a2f0a6c323a569515fb604625`；实际构建60文件／`b7055a7b4d2d84c21badd1c3bc9975e6a8014dc4fe04c4499ed840f2df4f6696`。相关正常完整文件最终唯一并集4314pass/0fail/1既有CEskip；缺五包全部剩余ext191文件2924pass/0fail/1同一既有CEskip；drift14pass；0todo，无新增skip/exclude。正常并集不是新一次226命令exit0：原批4309pass/5fail/1skip真实exit1保留，三合法前提修正完整58复验exit0、其余源码字节SHA重构相同。真实命令、source/build前后、计数及原63逐项映射见[r1-gates.json](evidence/phase5-foundation-repair/r1-gates.json)与[r1-failures.json](evidence/phase5-foundation-repair/r1-failures.json)。

固定参考：xreview `4bc60a9fadbd73e1ef11247beae1a6a5f18e4a4f`；narrative2验收及草案 `1d0d900212c94e5acfccdd63d244e24d6f2d1bd2`。完整读取，草案只作复现起点。三套既有5Z exit0仅作历史输入，不当六项修复证据。

## 首败与执行环境

原参考探针已转为src/test正式文件并登记test-suites，物理路线保留全部命令/切点/快照断言。原XR公开建造/下单/拆除、真实结盟饥饿离队和真实楼梯离线补结，布景限制保持并公开；不是自然UI录像。

日志在 `/private/tmp/brogue-commander-20261009-5z/`，均由run-child.sh/watchdog.sh记录完成。初次shell实际Node25.2.1：`foundation-baseline`不合环境合同；纠错时停止失败后短暂启动另一批，两个进程树已停止（SIGTERM），`foundation-baseline-node24`也因重叠无效。两者不当通过或有效首败。后续显式Node24.19.0绝对路径、NODE_OPTIONS=--max-old-space-size=3072、单worker无文件并发，`foundation-first-valid`为有效未修首败入口。没有CE fetch/full/gen，缺CE提示及实际skip保留。

## 当前缺陷与修复状态

| 项 | 原缺陷 | 当前 |
| --- | --- | --- |
| ORIGIN | 已回滚同步扩展事务仍一律退役录制来源 | 已实施，本轮R1相关门禁已关闭 |
| VISIBILITY | 无闪光跳过普通FOV规范化，缓存完整世界分叉 | 已实施，本轮R1相关门禁已关闭 |
| SPATIAL | 解码后的缓存grid未绑定当前runtime depth区域查询 | 已实施，本轮R1相关门禁已关闭 |
| XR-01 | 完成订单无活票据后拆箱/站遗漏引用清理 | 已实施，本轮R1相关门禁已关闭 |
| XR-02 | 结盟袭击者非致死退休后名册悬挂，无法收尾/保存 | 已实施独立退出记录和格式升版，本轮R1相关门禁已关闭 |
| XR-03 | 离线多批产物只发一条累计craft-batch事实 | 已实施，本轮R1相关门禁已关闭 |

独立R1已经不通过并结束，同原作者已完成必要修复与实际门禁；当时要求的combat2 seed3/47另resume前置现已完成，当前交父独立R2一次统一复核，无R3。以下保留所有历史首败/中断/无效探针及逐次改正，不将它们改写成通过。

## 首版实施与相关首轮（尚待最终门禁）

有效 `foundation-first-valid`：3文件9项，7失败/2通过，0skip/todo，exit1，111.73s。ORIGIN两异常在完整资格叶失败；VISIBILITY完整缓存快照差异；SPATIAL load后投影失败；XR分别box/raidActor引用错误和3≠4计数。原日志保留，均未通过改断言迎合现状。

`foundation-smoke-six` 首版3文件9项：6通过/3失败，exit1，82.23s。三失败都是录像旧codec固定13的遗漏（两个ORIGIN已通过回滚/重试，A01在loadReplay返回false）；缓存SPATIAL及XR三项已过。首轮types exit2三项（codec类型、TS控制流、readonly Set）及新增测试types两项已按真实错误修正，未冒称通过。

`foundation-expanded-first`：2文件21项，15通过/6失败，exit1，31.87s。新增测试的六败为三个布景类别：烧毁后读取原fixture已置null的id（三项），独立crafting站没有绑定结构（两项），未注册输入按合同纯拒绝而非抛异常（一项）。只修这些新增前提，保留保存/产物/退款/失败关闭断言；不涉及旧测试前提修订。

`foundation-expanded-second`：4文件27项全过，0skip/todo，exit0，156.40s。完整世界/记录来源/双RNG/消息保持，缓存每depth严格区域负例、拒档活局身份、两次存读、真实stairs_up重访、卸载重开再读；烧毁同箱/拆除绑定灶台及交付期限、退款产出唯一；真结盟需求→可见宽限/视外即时退休，独立原因时点、非kill、9种伪造/旧格式拒绝及经济解冻；在线/离线1/4批物理数量、事实累计/ordinal、终端ticket和模块总数。

当前136文件完整受影响首批及boundary/types正在收集。boundary首次exit1：新增src/test XR文件跨所有者引用settlement私有测试helper，将移到其所有者目录，不加白名单或弱化守卫。新回放场景与性能结构保护将另跑；这一步还没有READY结论。

## 生产写集与格式

ORIGIN使用命令局部的恢复完成通知，仅来自runtime.command外层同步transaction；不按异常类型或全局ext豁免。runtime恢复模块state/components/world、edible根、stat ledger及绑定、资源、causality/deaths、事实游标/待发布前缀、RNG及allocator。原生action revision改变、异步结果被拒、消息已开始向native发布、GC移除了native bindings、回滚自身失败均不能获得凭据。Game只恢复已审计的同步预处理（字段指针/标量、普通FOV两种可见性旗标、player、logger/RNG、stat查询会话）；活动flare、work/rest、native bundles、待推进/确认/已消费decision等大写集均无资格。GC后异常、原生写入或未知异常继续退役录制来源并抛原异常。成功后的额外收集/录制故障没有回滚凭据。无Game新字段，receipt/hasSuspended只在CommandExecution临时对象，非持久字段；scripts/u03-state-contract.json更新现有world5登记的schema5退休子语义，未改字段分档。

VISIBILITY每个清理边界均重算普通FOV，remember=false；保留已有flare知识采样路径。SPATIAL仅在成功发布加载后，把活动grid及每depth缓存grid绑定当前runtime ledger的实时查询；classic清空resolver，拒档不会触碰活局绑定。

XR-01共同销毁路径直接遍历所有生产订单的source/destination/station/plot引用，再用既有cancelResidentWork/退款/终端ticket路径；无活票据completed订单只清引用，不再次付出物品。待交付产物保持原next-epoch期限与fallbackAt。

XR-02权威非致死retireActor主体由既有native/经济事务一起保护；发布原departure receipt后，袭击成员独立retired={owner,reason,tick,ordinal}引用同一见证，不能当defeated，也不复用仅限幸存坠层的departed。完成与保存共用见证语义；存在live实体、缺receipt、原因/时点/ordinal不符、与defeated/departed冲突均拒绝。active raid见证在128条departure bounded历史裁剪时受保护；袭击关闭后沿原合同清名册，历史离队收据仍保留到正常裁剪。

XR-03在生产plan结果应用前记原completed/ordinal，再按每个实际新增物理批次发布连续事实。消费者仍每条+1，不对累计completedBatches做+=；物理debit/output/退款预留及交付期限不变。

版本：foundation13→14，world5 schema4→5，settlement module/rules1.3.0→1.4.0；whole-run6/recording4/origin2保持。录像codec类型/解析校验跟随固定foundation常量，旧codec拒绝，无迁移。九冻结SDK未修改。版本及黄金影响待最终单变量归因登记。

## 完整受影响首败与审计修订

`foundation-affected-first`：136完整文件，无name过滤，23文件失败/112通过/1既有CE文件skip；128测试失败/2583通过/1既有CE测试skip，0todo；exit1，2405.05s。未启动步骤B全量。首败分类：foundation常量/独立根向量与历史格式黄金；旧布景移动玩家重铺地图却手写isVisible而不建立当前光照；新文件所有权登记错误；首版退休事务性能回退。所有完整快照、退款/物品数量、空间/防伪、源代码守卫断言保持。

64人原性能门限50ms下实测首版峰值6877.376ms，明确失败，不当作环境噪声重试。根因为每个退休主体重复进入包含缓存地图的edible全世界checkpoint。改用已存在的可嵌套transactResidentWorld，coalesced needs外层只获取一次原生stat会话/绑定checkpoint，独立退休也有同一受控写集。不得改50ms/5ms门限。待相同文件实测及晚失败绑定回滚证明。

ORIGIN又收紧：只为generic router获取checkpoint，专用world/native/edible/resident/structure/action router不取得资格；曾悬停UI确认有临时hasSuspended标记且无资格。checkpoint创建移入异常关闭保护；缺随机恢复端口无receipt。审计的原生stat/FOV读取可能改变actor的资源材料化和缓存，补所有原生actor浅字段及现有scheduler/defense恢复函数，仍不遍历缓存grid/物品/地形图。CommandExecution两临时字段不是Game持久字段。

boundary第二次及audit-new启动失败为模块test-suites未登记（0测试，不能当通过），已按所有者manifest登记，不改守卫；类型第四次四个新增前提类型错误（ES目标不支持Array.at、private actorFacts访问、RecordedInputData不接受undefined）已最小修正。`foundation-boundary-3`与`foundation-types-5`实际exit0。当前audit-new-2串行实测，新增日界/袭击暂停组合有一项前提失败，保首败待栈归因，不冒称完成。

## 新增回归完善（旧前提仍未改）

`foundation-audit-new-2` 6完整文件37项：34过/3新增前提败，exit1，146.55s；其中原16/64人性能两项及ORIGIN性能保护通过，原门限不变。`foundation-new-replay-3` 24过/4新增前提败，82.40s；`foundation-new-replay-4` 26过/3新增前提败，80.99s。前提分类：99个native FOOD超过真实包容量，表台消费4木后未留足24木，已招募居民位于屋外被墙遮挡却从屋内下单；改为合法数量并从真实相邻可见位置发公开命令，不放宽容量/可见性/付款断言。XR-02公开付费营地→真实结盟饥饿退休的可见宽限/视外即时、每stage存读/回放/非单调seek与完整世界相等均已通过，晚故障回滚native stat绑定及原演员对象图后重试已通过。

`foundation-new-xr3-diagnostic` name=XR-03，6过/1败/18过滤，exit1，47.35s：在线/离线四物理批的保存、续录、原录像重放与0/end/end seek均过；唯一新败是袭击会按原合同使在线劳动danger中止，需显式resupply。随后补真实stairs_down缓存冻结、save/load、stairs_up返回/剩余敌人结束和公开resupply恢复同一ticket。first corrected 1过/1败/18过滤，6.46s，捕获暂停前应在真实离层后的经济入口（离层合法重算travelRemainingTicks）；second corrected 2过/18过滤、exit0，7.96s。日界/暂停保持全生产state、fact前缀、totals；恢复后物理4/terminal4/totals4/ordinals1..4，存读重复settle不重计。name过滤不当实际skip或完整文件通过。

ORIGIN补未知router异常、checkpoint创建异常、rollback自身失败、真实原生确认取消；保同一原异常对象、来源失败关闭、无吞异常。executeCommand预路由allowInput的未知异常也失败关闭；会实际重试native needs的预处理异常失败关闭，既有未接受输入的纯busy guard仍沿原路径拒绝。用于取得资格的router判定全部处于advanceCommand异常保护内。

## 完整回滚凭据的最后两处审计首败

`foundation-origin-proof-first` 8项：4过/4败，exit1，4.41s。两条真实新负例首败都是来源仍true：①公开controlled wait置于真实withCommittedFacts事务，afterResolve抛同一原对象；嵌套事务回滚会重置nativeActionRevision，外层不能以revision相等证明没有原生边界；②真实idle combat scheduler在settlement内被重建后抛原对象，恢复原scheduler对象字段并未恢复当前WeakMap绑定。另外两败是新增参数表被it.each展开为单独字符串，形成Unavailable extension:a，仅修新参数包装，断言不变。

新增runtime外部WeakMap单调nativeBoundaryRevisions，在controlled action尝试及native stat解绑处记边界，嵌套对象/原生事实回滚不能回卷；已disposed也不能出具凭据。Game回滚前核当前scheduler及phased/world session身份；换绑未知状态失败关闭，照抛原异常，不伪装恢复完成。PhasedAttackProduction只新增可信内部身份读取，无SDK/Game持久字段，仍不复制缓存grid。与已安装combat或combat+giants+settlement+crafting+foraging的真正纯事务反例配对：完整世界/来源/消息/RNG保持，重试、存读与回放均过。`foundation-origin-proof-second` 2完整文件11/11、0skip/todo，exit0，11.67s。

旧前提单变量反事实已完成：只回退17生产文件，25旧完整文件362/362、0skip/todo，exit0，708.96s，测试和黄金未改。后加的原生凭据安全检查仅影响异常资格；成功捕获链字段不变，最终源码的同法capture/完整受影响文件将再次确认。

执行纠错：逐叶Python比较误提前与capture并行，已精确停止该进程（SIGTERM），partial输出无效，不用于归因/通过。保守时间窗09:52:11—09:56:03内的nonvis resident/crafting/foraging及final traces四capture批次不作为有效串行结果；其余已结束、未重叠capture保留。正在用相同原方法/原参数/真实绝对root逐批串行补这四项（新的*-serial日志），不按重叠计数或环境噪声当通过。capture-only的crafting一项+2过滤、import一项+4过滤以及foraging两项只捕获早返均不当完整正常回归覆盖；完整文件另在最终门禁执行。

## 捕获证据纠错与第一轮归因

四批纠正的严格串行capture均实际exit0，原方法/原参数不变。有效第一轮base→nonvisibility候选238配对文件2331叶、nonvisibility→最终238文件483叶；types-6 exit0。nonvisibility候选仅撤掉本次普通FOV重算，其余生产候选保持，因此所有非FOV效果仍须逐叶确证，而非凭变体名称认定。可见性改变包含实际战斗文本“something”→“Rat”，全部旧快照字段及原捕获断言保留，尚未更新黄金。

补充居民底层raw提取器错误：Game.currentSeed是string，最初与number比较导致无raw文件；原RESIDENT_FORMAT_CAPTURE摘要/物理断言仍有效，但不能充作底层变化归因。已将只读提取器Number(seed)规范化，按原自然/俘虏完整路线重跑base/nonvisibility/final，各cut写完整快照；当前base实际exit0，其余串行中。后续完整逐叶登记以有效补捕结果为准。

覆盖补查：居民raw的三批实际均exit0（完整2文件3项），但自然路线原24个digest checkpoint中914遗漏，另有load/replay初始化的0事件D2/D3完整状态。额外状态不能冒充914证据。已让只读提取器直接从原不可变路线checkpoints取cut，按原自然路线单文件name过滤再补三变体；其1项运行/1项名称过滤不会称完整正常文件通过。现有49个raw配对及原捕获整体比较289配对文件：非FOV2793叶、FOV990叶；包括缓存isVisible、版本/规则指纹、派生摘要和实际可见目标消息，未见RNG、知识、物品/经济/时间/命令变化。最终逐叶登记须待914齐全。

旧前提最小修订范围（先有25完整旧文件仅回退生产362/362反事实）：共享结构/settlement布景及dialog/u03b移动铺图后建立真实native光照；不可见目标使用真实invisible状态或原目标/周边隐藏格实际零光，替代会被普通FOV重新规范化的手写旗标。所有成本/时间/拒绝/信息泄漏/风险确认/全世界断言不变。格式常量及独立根SHA向量按14更新，历史11链向量不变；旧13不可变导出保留并与旧12一起严格拒绝，不更改旧raw。居民raid名册严格期望只增加retired:null，不放松任何validator。

补充XR-02现有真实饥饿退休场景：其active raid见证之后再经过129次独立权威native非致死离队，严格保持128收据预算、仍保原raid见证、无death/reward，再同一save-load/12伪造负例/剩余敌人/经济恢复。此为新保护逻辑的受影响回归，待最终完整文件执行，不当已通过。

## 黄金完整归因与原法更新

914补捕三变体各实际exit0：原自然路线1项运行/1项名称过滤，122.71s/124.00s/127.13s；不当完整文件正常通过。完整比较/编码/登记实际exit0，三变体每对290个完整配对文件，自然24/24及俘虏23/23底层cut均覆盖，另保load/replay初始化的额外0事件D2/D3状态。非FOV2799叶：派生格式hash2433、foundation13→14 158、world5schema4→5 55、settlement版本100、规则指纹50、捕获wall time3。FOV1051叶：isVisible920、可见目标战斗名称72、派生hash56、wall time3。没有RNG、知识、物品/经济、tick/turn、输入/decision、原生物理变化；未归因分类使登记失败。详见[evidence登记](evidence/phase5-foundation-repair/README.md)及全部逐叶gzip（处理后的157456 bytes）。

原法更新UR4、P4 compact、crafting/foraging三个final、居民两route仅digest及新的foundation14 App公开39事件导出。UR2/UR3所有变体内容相同，保原文件。原命令/非digest物理checkpoints逐字段等于HEAD，旧13 raw SHA保持c526804…；新14导出59162bytes/SHA7c2a6f65a8925e62c212ffb08f1d934db48712bdddf51b09a3f18a74b4e3fb7e。独立root14向量由原独立算法得到338678…，原历史11链向量不变。无新的快照裁字段/断言变化/门限变化。18生产文件恢复后逐字节等于最终捕获候选，git diff --check exit0。

最终258完整受影响文件现按单worker严格串行执行（无name过滤），含全部七模块自有完整文件与根底座/格式/空间/原生资源/离队/录制/完整trace/源码守卫。后续boundary、types、实际build、实际drift与c4a局部源码守卫按固定脚本继续串行。尚未得最终门禁结论，未READY。

## 2026-10-11T11:05:12+08:00 最终门禁进程中断与重启

原 foundation-final-gates.sh 在10:44启动后未独立于执行会话存活，作者exit0不代表子门禁通过。foundation-affected-final.log只有启动行、无done且实际进程全部退出；保留原证据，分类为执行中断，不计产品失败或有效测试结果。本次使用launch-detached.py以start_new_session（setsid语义）加nohup独立启动，标准输入/dev/null、输出文件；run-child.sh记录每项及整批done。六项原命令串行重跑，新增汇总记录每项退出码和前后源码身份；结束后维护者核验并接独立R1。未来后台长任务统一此启动方式。

## Final detached gates: 2026-10-11T13:28:29+08:00

Source before/after unchanged: 71907f538e762766a378fa94a74963217889ab53c04efd5911c5ea0afa30904c. Aggregate exit1; NOT READY.

foundation-affected-final-detached: exit1, 5784.421s; Test Files  9 failed | 248 passed | 1 skipped (258) / Tests  63 failed | 4766 passed | 1 skipped (4830) / Duration  5783.84s (transform 4.04s, setup 0ms, import 109.74s, tests 5661.30s, environment 36ms)

foundation-boundary-final-detached: exit0, 2.454s;

foundation-types-final-detached: exit0, 9.013s;

foundation-build-final-detached: exit0, 12.358s;

foundation-drift-final-detached: exit1, 143.165s; Test Files  3 failed | 4 passed (7) / Tests  5 failed | 9 passed (14) / Duration  142.85s (transform 1.12s, setup 0ms, import 4.41s, tests 138.08s, environment 1ms)

foundation-c4a-source-final-detached: exit0, 1.805s; Test Files  1 passed (1) / Tests  1 passed | 29 skipped (30) / Duration  1.61s (transform 1.02s, setup 0ms, import 1.50s, tests 43ms, environment 0ms)

63 failures in 9 files: giants2_persistence8, growth_prepared38, foraging_feed1, giants_spine_trace1, giants2_trace2, giants_trace2, foundation_lifecycle1, growth_square_melee9, combat_rest_relations1. Drift5 overlaps the three giants trace files; do not add counts. One existing skip, no todo or reported unhandled. c4a29 are name-filtered, not genuine skips.

Observed failures concern hashes, target/confirmation, visibility and createRaidMonster returning null in the new retirement test. Root causes require independent R1; do not assume all stale fixtures. Preserve first failures; original author resumes after R1. No narrative2 merge.

## R1: 2026-10-11T14:34:05+08:00

Independent R1 rejected this candidate. See [R1 report](phase5-foundation-repair.review-r1.md). F1 confirms S1 incomplete native retirement rollback (spatial revisions and examined set); F2 removable-module test dependencies; F3 invalid invisible-ally feeding premise; F4 initial giants2 format golden omission with later checkpoints still unproven; F5 witness-retention stress coverage interrupted. 48 target/confirmation failures remain unclassified pending controlled counterfactuals. Original author resumes all findings; no R3, no narrative2 merge.

## R1 后原作者修复（2026-10-11，尚未关闭）

已完整读取独立R1最终报告 `/private/tmp/brogue-commander-20261009-5z/foundation-r1.final.md`。R1不通过，唯一原生产作者继续，不派代理或自己审查；下一次只允许维护者独立R2，无R3。上轮 `foundation-final-gates.sh` 因作者执行会话退出中断、缺done，明确无效，不算通过也不算测试exit1。最新硬规则生效：全部长任务由 `launch-detached.py` 建独立OS会话+nohup、文件stdin/stdout及run-child自动done，禁止执行会话内后台进程随会话退出。

维护者实际detached门禁：258完整文件248过/9败/1既有CE skip，4766项过/63败/1既有skip，0todo、0已报告unhandled，exit1、5784.421s。drift7文件4过/3败、9项过/5败，exit1，5失败全与63重叠不另计；boundary/types/build及局部c4a守卫exit0，c4a为1运行/29名称过滤。原候选1308 inputs/SHA71907f538e762766a378fa94a74963217889ab53c04efd5911c5ea0afa30904c前后一致；实际build SHA d164aa45287b1a8ced5cbebb446bb332fd0fa1eda5c6d12d59d785d6aa81ab43。维护者性能16人P95净增1.356416ms、64人峰23.417417ms；ORIGIN1/8depthP95为0.341833/1.639917ms。这些真实结果未关闭F1及63项失败，不能称READY。

原63个失败逐项完整测试名/源文件/绝对日志行号已从原log提取到[evidence/r1-failures.json](evidence/phase5-foundation-repair/r1-failures.json)，固定原源码身份及5个drift重叠。每项当前仍unresolved；F1是63项之外独立确证产品缺陷，F2是删除合同问题，均不重复计入63。后续在同一映射逐项登记修复与实际完整文件证据，不以分组登记代替关闭。

| R1项 | 作者当前处理与证据 | 关闭条件／尚缺 |
|---|---|---|
| F1 S1 | 新正式根回归 `ext_foundation_retirement_atomicity.test.ts` 已登记；中性fgfixture所有者、已安装combat会话可选，没有新可删除包硬依赖。活动/真实stairs缓存 × 有/无square-2乘客，另含携物；每次布景先实际save/load验证接受，再真实native退休成功后抛同一原异常。`foundation-r1-f1-unfixed-v1`实际4败/0过、0skip/todo、exit1、6.37s；四例full-object-graph均只报告examinedEntityIds Set遗漏，有乘客两例source/anchor0→1。原异常、初始存读接受、对象引用/stat/session/RNG/allocator/clock及重试无kill/reward的其余断言运行到末尾。 | 生产尚未修，待窄原生写集（整个携带图的空间WeakMap/catalog/listener、examined集合、phased source等），不能退回全缓存图；同回归和16/64原门限复验。 |
| F2 S2 | 新7文件固定可删除包问题接受；待实际缺包/仅恢复包单变量证据与中性或实际安装集投影。 | 原全部底座断言和正常七包覆盖、缺包存档/录像拒绝及活局保持；相关删除的剩余完整ext不可省，不计步骤B128/15。 |
| F3 S2 | 认可新invisible盟友前提不成立，不能改产品拒食规则。 | 按实际普通FOV黑暗/遮挡布景，先assert不能直接看见，再保原拒绝/attempt/零机械成本；新前提独立归因和整文件。 |
| F4 S2 | 初始lantern/copper格式叶确证只限初始；spine与D3/D7后续未归因，native hash不能称格式。四个完整巨人文件已排生产单变量反事实，原测试/黄金不动。 | 原capture逐检查点全叶归因、保种子/输入/decision/全部快照、整文件及实际drift。 |
| F5 S2 | 固定(60,20)造怪null的拒绝因子尚需定位，不预设前提问题。 | 保129实际权威退休/128上限及原raid见证，完成全部原12拒档、新增fake actor/借真实unrelated receipt/fake region负例、结束/经济；若占据残留修生产。 |
| 48未决FOV/确认 | 原25文件反事实不覆盖；growth prepared、square melee和combat rest relations三个完整原文件已排生产单变量反事实。 | 先证旧前提再最小修光照/遮挡/观察时点，保全部risk、No、收费、stale token、决策/0OOS；合法FOV仍失确认则修生产并记CE依据。 |

当前detached `foundation-r1-counters-v1`，独立wrapper/session PID42020，summary=`foundation-r1-counters-v1.summary.json`，done=`foundation-r1-counters-v1.done`。串行先新F1未修首败，再只回退18生产文件跑原三个确认文件+四巨人完整文件；finally逐字节恢复R1生产候选。保存原七测试文件与五巨人trace before/after SHA以核只有生产变量；新F1测试和manifest追加不修改这七文件或任何黄金。当前active子stage=`foundation-r1-production-base-counter-v1`。生产树正临时单变量回退，运行中不得编辑源码或另开测试。dispatch和quick-check登记新增marker，父只能按真实summary/各done核验；作者exit0不是子测试完成。

## R1 接续 2026-10-11：最新合同及有效前置证据

已完整读取 pipeline-supplement-20261011.md、foundation-r1.final.md、foundation-r1-fix.prompt.txt。任务书附完整补充合同；本轮必须完成 F1–F5 实际修复及相关门禁，再交父另 resume 原作者补 combat2 seed3/47 VISIBILITY，之后才同一独立 R2。不提前 SDK 或内容集成。

`foundation-r1-counters-v1.done=exit0` 是反事实 runner 状态，不是候选通过：F1 原生产四项正式晚失败回归 0pass/4fail，真实 native 退休后集合丢失，携带分支 off-graph anchor/source revision 改变；原七文件/五黄金不动仅回退18生产 69/69pass、targetsUnchanged=true、productionRestored=true。不重复该有效反事实，也不凭69过将63原失败归类为过时前提。下一步分别隔离普通FOV差量与合法原生场景。

F1 当前实施：外层窄 actor 携带图、owned list计数、examined集合、squareMotion会话、phased source和空间revision/listener/catalog恢复；grid、catalog、actor地图引用停止遍历。修后结果尚待真实门禁，不称关闭。

### R1 逐步证据（仍在进行，非READY）

仅撤 Game 无flare普通FOV分支：原三个确认文件全过；加feed整文件共88pass/1fail（feed隐形盟友前提），四文件目标SHA未变，生产已恢复。外部完整测试副本只改原生光照/黑暗前提、原56条断言不动，在origin捕获前及所有候选回放共同重建，56/56pass。正式最小改前提：prepared场景尾updateVision(false)，square玩家移动后重建光照，隐藏contact/bonfire使用实际黑暗light+普通FOV；风险链/No零成本/一次收费/stale/replay/seek/continued/missing/surplus所有原断言保留。外部v1钩子被afterEach还原、v2在live命令前补光但不在origin前，均无效，分别47fail与25fail/31pass，不能用于通过。

F2物理只删除五包、不动生产与五文件目标：19fail/20name-filtered；恢复五包18pass/1fail/20name-filtered，唯一剩余为原F5造怪点。targetsUnchanged/productionUnchanged=true，runner exit0仅证明配对完成。正式根组合按实际安装集；无combat的native clock合同明确用独立0.0.1协议fixture；缺foraging用具同计时政策的fgfixture；缺crafting用明确0.0.1制作合同fixture（公开resident recipe服务约束crafting owner，独立定义/规则，不冒用被删除1.0.0身份）。缺包真实拒档/录像需另在无fixture实际registry验证；删除剩余完整ext门禁待跑。本轮仅相关布局，不冒充后续128/15。

F5拒因只读探针：type=kobold，(60,20)，flags=0、terrainRejected=false、budget=true；被布景中原生活kobold ID25占据，dead=false、departing=false。正式用空floor(60,21)，129次真实创建/结盟/beginDeparture，每次前后核实体移除；保原128及原raid witness、12拒档及剩敌/经济恢复，并增fake actor/借真实unrelated receipt/协调fake raid region引用三负例。修后十完整文件与types已串行启动，尚待结果。

额外signed RGB推测经源码核否：LightMap.lightSumAt已按CE Movement.c2584–2586逐通道max(0)；临时错误规格探针1fail/8name-filtered不构成产品缺陷，未改此生产行为，错误新增测试撤销。

### R1 正式十文件结果与 F1 最后空间会话修复

`foundation-r1-types-local-v1` exit0。`foundation-r1-ten-files-fixed-v1` 十完整文件9过/1败，133pass/1fail，0skip/todo，exit1、319.48s。原48确认、feed、F5共50个原失败已逐项关联此完整文件结果；不把整批exit1叫候选通过。F5 visible=true 129真实退休、128预算/原见证、原12＋新3负例、剩余敌人/经济恢复均实际执行；XR-02/03完整save/replay/seek/续录均执行。

新F1最后square/no-passenger分支只剩 full-object-graph `world.g own keys`：native清理删除最后squareMotion，浅恢复重新插入顺序不同。补仅会发生删字段的Game／携带物品目标描述符恢复，不遍历grid，不改变守卫/断言。随后短同步`foundation-r1-f1-fixed-v3.log`完整六分支6/6过，6.87s，所有值/身份/空间revision/terrain订阅/clock/RNG/allocator/session和原异常/重试/无kill保持。中间v2试加held edible cooldown前提被原strict validator合法拒绝（仅允许floor），六例在故障前失败，撤销该新增非法布景，不改守卫、不作为产品缺陷或通过。原16/64门限待最终相关复验。

F2缺包修后首批14fail/25pass（5完整文件）是中性fixture装配缺口：craft文本未在ext.crafting命名空间；fgfixture未排除公开resident-status，误将居民也当需食同伴；独立D3 arena用原七包seed2不产区域。修有限fixture命名空间，按公开resident query排除，用既有独立bodyArena合同的固定7306 seed（原正常七包seed2/784输入不改）补区域生成。第二批37pass/2fail，四完整文件过，两个XR探针在原history诊断读取中发现制作fixture遗漏history；补持久、有界完整CommittedWorkFact history，保全部底座断言，不删诊断字段。第三批39项全完整文件重测正在运行。制作fixture内容另用crafting.foundation-*明确隔离ID、0.0.1身份；只有公开recipe服务要求的owner保crafting，实际缺包catalog仍无它，真实内容拒绝探针不装fixture。

F2修后五包实际缺失副本的五完整文件`foundation-r1-five-missing-fixed-v3` exit0：5文件/39项全过、0skip/todo，196.16s。组件namespace、公开resident排除及严格fixture state/history修好后真实save-load/replay/seek与完整世界/拒档/产物/事实/统计断言均执行；没有skip/exclude或registry松绑。另需实际缺包、无fixture registry保存/录像拒绝与全剩余ext门禁，不因39项过提前称F2全关闭。

### R1-F4 五条巨人完整路线：原方法捕获与逐叶证据（2026-10-11 19:50）

原7文件/黄金不动、仅回退18生产的69/69反事实已有效，不再重复。另按原捕获入口运行三变体：base（固定18生产回退HEAD，新增SpatialRevision关联登记在三变体保持常量）、nonvis（当前修复仅撤普通无flare FOV）、final（当前修复）；三个原 natural capture 与 giants2 原 captureNatural 固定原seed，不搜索新seed，命令、决定、检查点index/label和物理路线逐项一致。每变体5路线全部通过，黄金在捕获期间保持原字节；111.07/110.10/111.92s，三个done均exit0，productionRestored=true。

完整原快照有28个检查点（ridgeback/colossus/spine各1、lantern10、copper15），跨两变体边界登记9199叶：格式56、普通FOV旗标1667、派生recording digest7413、派生trace hash57、捕获墙钟6，未知0。D3/D7的nativeWorldHash变化明确来自cached levels的普通FOV14/51叶，不能归为格式；spine full世界60 FOV叶变但其native投影排除缓存层，nativehash不变，extensionsHash来自foundation13→14。lantern72/copper1470普通FOV叶变化分别覆盖其原检查点，初始点只有格式hash，后续各点仍保完整字段断言。三条natural的扩展hash只在base→nonvis改变；两条giants2每点完整worldHash只由对应完整叶变化解释。所有public recording event除明确登记派生摘要外精确相同，输入/决定/行动/HP/时钟/两RNG/物品stamp保持。

原natural hash直接canonical原GameSnapshot，不能以JSON再parse替代：pub-v1因此复算失配exit1，未改黄金；pub-v2缺gzipSync导入exit1，也未改黄金。两次证据错误保留。补按原3函数/3变体用V8原值序列化捕获（保undefined），三个done皆exit0、原生产/黄金恢复；随后84项原native/extension/command/检查点/final完整hash逐项核对，`foundation-r1-giants-raw-hash-verify-v3.done` exit0。保undefined的逐叶重算仍9199、未知0，`foundation-r1-giants-leaf-publish-v3.done` exit0才按原final捕获写入5黄金。整文件与drift门禁随后单独执行，捕获通过不代替其通过。

可审阅压缩叶登记：`docs/ext/evidence/phase5-foundation-repair/r1-giants-golden-changes.json.gz`。外部大原始快照、V8文件及命令留在执行根`foundation-r1-evidence/giants-{base,nonvis,final}`，不提交原始大证据。

### R1最终相关门禁启动与首关修正（2026-10-11 19:58）

226实际受影响完整文件清单在执行根`foundation-r1-affected-files.txt`：全combat/foraging/crafting/giants/settlement、根ext与30个phase4空间/身份/回滚/录制合同、48失败的growth两文件和i18n/归属/卫生守卫。不是新全npm，也不是StepB128/15布局。F1改公共SpatialRevision的会话恢复与resident原生写集，因此覆盖这些真正执行相关原生/扩展生命周期的完整文件。执行串行boundary/types/实际build→226→drift→实际七包原始存档录像来源；之后物理缺五包的无fixture真实拒档/录像/活局及剩余ext。

`foundation-r1-final-related-v1`只执行boundary，exit1，源码前后b9d4d63fa0c2768edd1c7fa27107098c28689095d6741cd37f179bd2afa0776f；原地形读取表达式由独立临时变量重写导致原raw-reader指纹失配，没有新读行为。生产保原`cells.set(cell, { grid, observedTypes: [...cell.layers] })`，随后只登记已有entry引用；原守卫/清单一字不改。v2 boundary实际exit0，后续门禁进行中，当前不能称通过或READY。黄金允许叶登记与该句型修正无机械差异，最终源码身份另以门禁前后核验。

R1生产差量另核：对照初版71907备份的18生产路径，只有`src/engine/Core/Game.ts`再次改变；新增修改路径`src/engine/Movement/SpatialRevision.ts`只维护原watch entry引用与回滚关联。此前其余17生产路径逐字节不变。F2/F3/F5及48项已确证旧前提调整均在所属测试/有限中性fixture，F4只更新已登记允许叶的五原黄金。F4 base是固定18路径HEAD回退，新SpatialRevision关联在三变体为常量（原完整hash仍精确复现原黄金）；nonvis→final严格只改变普通无flare FOV分支。无新增Game持久字段，无再次升格式，无修改raw-reader守卫或宽registry。


### R1逐项响应索引（最终相关门禁仍进行中）

| R1项目 | 已实施修复／独立归因 | 正式证据／最终待验 |
|---|---|---|
| F1 S1 | 外层退休窄写集补整个carried graph、examined集合、空间source/anchor revision及listener/catalog、列表ownership、squareMotion/bodyGroups、phased defense source、stat session、terrain订阅关联；保存原对象与原异常。只在实际删除目标保own descriptors，不作全缓存地图盲拷贝 | 未修4fail；修后正式活动/缓存/携带、乘客与无乘客、最后square session共6/6pass；完整图值/身份/时钟/RNG/allocator/集合及重试一次验证；原16P95≤5ms、64peak≤50ms在当前226完整文件批中复验 |
| F2 S2 | 先真实物理缺五包/只恢复包反事实；底座合同用明确有限fixture（fgfixture和crafting0.0.1独立规则/ID/文案，不模拟被删包身份），实际安装包正常分支保持。完整七包原seed/input仍用原路线；缺包以全部实际剩余包加命名根arena进行公开换层和原区域否例 | 缺五包五完整文件39/39pass，0skip/todo；无fixture实际registry的真实七包存档/录像拒绝及活局与全部剩余ext、边界类型构建在当前正常批之后执行；不是StepB15/128 |
| F3 S2 | 仅撤VISIBILITY时invisible-only feed仍失败，MonsterVisibility盟友分支确认不隐藏。真实黑暗+普通FOV建立不可见格，命令前断言cell及direct visibility均false；原拒绝/录制尝试/零mechanics/食物不消耗全部保留 | 十完整文件中foraging_feed完整通过；当前226批再覆盖实际foraging完整文件；没有生产“隐形盟友拒食”特例 |
| F4 S2 | 原7文件/黄金69/69反事实有效不重复；五固定种子原capture三变体及保undefined的V8补充，84原hash核对、28点完整world跨两边界9199叶全登记未知0，五黄金原法重录；D3/D7 native明确归cached FOV，spine extension归格式 | 当前正常批giants2_persistence 8/8已实际通过其全部后续合同；其余原3 trace文件和drift待本批完成，捕获通过不作整文件通过 |
| F5 S2 | 原(60,20)是初始活kobold25占据，其他原生准入因子合法；新场景只改为已证实空位(60,21)。129次真实造怪/结盟/权威退休、128上限、原witness、原12拒档及fake actor/unrelated实际receipt/fake region新增3负例均保留 | 十完整文件中完整20项通过（两个visibility分支、压力段及全部后续经济/存读断言）；当前226批最终复验；不注入权威receipts绕过真实压力 |
| 48确认／目标失败 | 只撤普通无flare FOV的原三个完整文件通过；原断言不动的合法光照原生origin布景三个完整文件56/56通过，双证据确证旧旗标/光照前提。最小调整仅prepare light/普通黑暗FOV/观察时点，不改确认链和guard | 十完整文件中的原48项全已过；当前批完整原文件再次覆盖fire/gas/plate/acid/ally、多目标/空间接触、No零成本/一次收费、stale runtime/RNG、两问true/false回放seek续录及决定缺失/多余拒绝与0OOS |

原63名称/参数及日志行完整保留在`r1-failures.json`，独立F1/F2不冒充63之一；原drift5项仅是63的重叠。最终候选计数/源码构建身份及READY要等所有相关子测试真实结束。此次没有审查代理或额外审查轮，R1后同原作者修复；本轮完成必须再由父resume原作者combat2 seed3/47 VISIBILITY补充，然后同一独立R2，无R3。

2026-10-11T20:50:56.276817+08:00 R1-F1原性能门限实际复验：resident_performance完整2/2pass（55.718s），16人ordinary P95净增1.3714569999974628ms≤5；64实际worker长期需求退休峰值24.675167000001238ms≤50，完整64来源GC、八次相同digest/存读及有界事实均保留。Node v24.19.0、3072MiB策略、单worker，无门限改动。16报告中的summaryPeak=50.501208ms不是原门限对象，不冒充64峰值或另设门限。原始性能报告只留执行根，`foundation-r1-final-performance-summary.json`摘录真实门限字段；整批仍进行中，不能只凭性能两项称候选通过。

### 最终扩展空间覆盖的5项首败、单项因果与合法前提（2026-10-11T21:42:35.940053+08:00）

v2实际完成226文件，222文件过/3文件败/1既有CE缺失skip；4309pass/5fail/1skip，0todo，exit1，5460.15s；前后1310源d3ef1e65（完整SHA见summary）一致，新实际build b7055a7b4d2d84c21badd1c3bc9975e6a8014dc4fe04c4499ed840f2df4f6696。原63个完整title逐项精确匹配本批assertionResults全部passed，没有省参数；新增5首败是本次加全phase4空间覆盖发现，不混入原63或drift5。

| 新首败 | 首败结果 | 单变量／合法原生场景证据与最小修复 |
|---|---|---|
| phase4a2_body_effects auto_explore adjacent tail | hp1000而期望998 | 玩家布景换位置后没有native照明；只在原命令前native updateVision(false)，先assert目标实际可直接见，保998伤害及原位置断言 |
| 同文件2/3-square modal save/load/continue/replay/seek，两项 | 原完整world续跑比较失败 | 原installRecordingScene铺图/移玩家而光照仍是生成图值；只在原origin callback最后准备native light，原seed/命令/决定/物理检查点及完整world/逐事件/seek断言全保留 |
| phase4d_movement_environment late fault full graph/next move | 完整graph rollback已过，末尾真实load后再次移动的完整save比较失败 | 原twoStepScene铺图/移动而light未重建；只在该例最初before snapshot与故障审计前native updateVision(false)，原terrain/status/HP/revision故障、独立全图/原RNG/ID、重试、存读后同移动及完整save比较全保留 |
| phase4a3_body_display no-space | 预期No safe visible space却未throw | 原手写all isVisible=false被snapshot正常FOV覆盖。仅将实际LightMap的全RGB置0，以普通remember=false FOV先assert真无可见格；保原throw/完整world/ID/recorder/RNG/export全部断言 |

`foundation-r1-effects-counter-v1`仅撤普通no-flare FOV，原三完整文件58/58pass（33.514s），target SHA全部不变，Game生产字节恢复，其他六修复/F1/SpatialRevision保留。这只证明单项因果，不作过时前提免责。

恢复全部生产后的外部合法原生场景副本（58项原assertions不动）：v1两文件过、57pass/1fail（32.56s），no-space探针误写不存在的Cell.lightRGB，属于无效黑暗前提，失败保留、不计通过；v2改用真实LightMap.lightAt RGB并预断言普通FOV无可见格，完整58/58pass/0skip/0todo，done exit0。这双证据才允许上述最小前提调整，实际落仓仅三文件8insert/1delete（另三处private fixture调用用既有局部结构类型访问，未开放生产API）。没有修改任何原断言、种子、命令、决定、物理检查点或黄金。

随后v3 boundary过/types exit2（三处Game.updateVision私有访问），未启动build/测试/drift；首败保留。当前v4以局部结构类型fixture访问重新执行边界/types/build、三完整文件58、drift、单独c4a源码guard和真实七包来源；尚不能称全部结束。v2其它223文件的复用通过整个1310-source排序SHA重构证明：仅换回三测试旧hash便精确重现d3ef1e65dd93d244e6c32a6419323a04bc5be4fcde55a47b6da25e63a899967f，所有其它源码/测试/黄金/配置字节保持；不盲重跑已有效的完整批，也不重复计58项。

### R1正常候选实际收口（缺包全部剩余ext仍待结束）

当前源码1310 inputs／`2184edaa2205880e3c35a6517a69c996dfbe2d0a2f0a6c323a569515fb604625`；实际dist60文件／`b7055a7b4d2d84c21badd1c3bc9975e6a8014dc4fe04c4499ed840f2df4f6696`。HEAD4856505，未提交；v4前后sourceUnchanged=true。

| 相关正常门禁 | 实际结果与计数依据 |
|---|---|
| 226完整文件的最终唯一并集 | 225完整文件过、1既有CE缺失skip；4314pass/0fail/1skip/0todo。原v2 aggregate真实exit1（4309/5/1）永久保留；只有3个合法修正的文件58项由v4完整结果替换，v4真实exit0。整个1310-source旧hash重构证明其余223完整文件、全部生产/黄金/配置字节相同，不冒充新一次226命令exit0、不重复计58 |
| boundary/types/实际build | v4各exit0；2.32/8.45/11.82s |
| 原3新首败空间文件 | 完整58/58pass，0skip/todo，v4 exit0，33.16s；全部原assertions、原输入保持 |
| drift | 7完整文件14/14pass，0skip/todo，exit0，149.63s；与原63重叠的5全部过 |
| c4a指定源码guard | exit0，1pass/29name-filtered，2.05s；这是命令名称过滤，不是29个真实skip；未执行CE gen/full/fetch |
| 真实无fixture七包来源 | save接受、recording接受、4真实events逐一replay0OOS，exit0，2.76s；正常catalog无fixture注册 |

唯一真实skip是原`ext_structure_performance.test.ts`的`observes zero and 3072-cell/12288-component budget fixture`，CE源缺失；原文件字节保持，不新增skip/todo/exclude。F1正式六分支、growth square10、combat rest relations5、D3/D7 trace2、spine1均在本次完整结果实际passed；原63完整title逐项精确匹配，全部已关闭。性能报告摘录使用原16/64门限，完整冷热、事实/来源GC/原生stock和重复存读断言不变。

相关物理缺五包：实际catalog仅growth/settlement，真实旧七包save及recording均拒绝，完整活局、原player/grid/monsters/runtime/world5/levels身份、RNG/allocator不变，fixtureRegistry=false；missing boundary/types/build各exit0。当前`foundation-r1-missing-remaining-ext-v1`运行全部实际剩余ext，尚不能据正常收口宣布READY。

### R1作者本轮最终交接（2026-10-11T22:37:43.048572+08:00）

F2实际物理缺五包布局全部结束：缺combat/crafting/foraging/giants/narrative，实际catalog仅growth/settlement；无fixture真实七包来源先保存/录像接受且4events replay0OOS，然后缺包存档/录像均拒绝、完整活局/根身份/RNG/allocator保持。missing guard/boundary/types/build各exit0（2.06/2.06/7.32/10.46s）；`npm run test:ext -- --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=<执行根>/foundation-r1-missing-remaining-ext-v1.vitest.json`实际191完整文件190过/1既有CEskip、2924pass/0fail/1skip/0todo，exit0，2789.58s。没有name过滤、skip/exclude增项或省略剩余ext；包自己的文件/实际安装集组合随真实所有者删除。独立临时副本1059 src/scripts/public inputs前后SHA `9f97e5667ad5ae055b011f1bca13518a480eb8b3f25ec79cfe90bdb418bf9f73`完全一致，五目录始终实际不存在。此一个相关布局不冒充步骤B全128/15。

主仓库最终身份再次核为2184edaa完整SHA及b7055a7b完整buildSHA（报告顶部），git diff --check exit0、HEAD4856505不变；所有相关子测试done已核实际结束，没有作者exit0替代子测试完成。统一可审阅摘要 `r1-gates.json` 收录每个最终命令、退出码、耗时、文件/测试/skip/todo/name-filter计数、两布局身份及diff路径；大原始快照/日志只留执行根。原63名称/参数/首败日志行逐项映射到实际passed title，原drift5重叠不重复算；五新增空间首败单列 `r1-additional-spatial-failures.json`。v3私有调用类型首败、legal-v1错误Cell RGB探针、pub-v1原值JSON丢undefined/pub-v2缺导入及所有历史中断均保留，不作通过证据。

持久格式仍为本步登记的foundation14/world5 schema5/settlement module及rules1.4.0；whole-run6/recording4/origin2/settlement state2及九SDK冻结不变，严格拒旧13/12等raw、无迁移或防伪放宽。R1没有新增Game持久字段，已有CommandExecution瞬态与world5语义登记U03。R1生产在首版18文件中仅再改Game，新增SpatialRevision；完整步骤相对HEAD共19生产路径，另外测试/fixture/原法黄金/合同与报告。所有新增玩家可见内容仍走i18n，neutral fixture独立文本/规则/ID不能被称作删除包真实玩法。

当前F1–F5及原63/新增5没有未关闭缺陷。交父后**必须另resume同原作者补combat2固定seed3/47原VISIBILITY场景（换层/坠层、完整缓存快照、非单调seek），不能直接派R2**。之后同一R2同时核六项、R1响应和补充场景；不新增审查轮、不自行第三轮。独立复核重点：窄native closure与订阅/identity恢复、性能原门限、有限fixture隔离与真实无fixture缺包拒绝、五巨人原输入/28点全world/undefined叶归因、所有风险/No/一次收费/决策/OOS和见证防伪负例。Claude最终候选人工抽样仍待回执，XP skip/5D3另案、CE缺失skip、SDK和内容合并后统一全量均未越界。

父ID01a1163c-1880-7c31-b810-dd60d1e07ac8；执行根 `/private/tmp/brogue-commander-20261009-5z/`，启动器launch-detached.py＋run-child、纯shell watchdog.sh。本轮READY为同目录foundation-r1-fix.READY.md；未写foundation-six.READY.md，不提交/推送/合并/打标签。

最终ORIGIN独立结构/计量文件亦实际passed：1/8 cache depth P95 0.370583/1.782709ms，Node24.19.0；这是测量值及无全图盲拷贝结构保护，不冒充新增数值门限。最终正常bulk/修正58/drift/缺包ext日志无Vitest unhandled报告；git diff --check exit0（2026-10-11T22:40:31.790648+08:00）。

## 2026-10-12 R2前combat2 VISIBILITY补充（进行中）
已完整读固定4ea702c的验收及全部七个evidence文件，SDK/前提patch仅参考未应用；原内容仅装配执行根foundation-combat2-tree，主仓库生产不合内容。外部树共享六修复19生产路径与主候选同字节，唯一内容差量明确为固定combat目录。三个原完整文件在18生产回退HEAD下实际3fail/1pass，exit1、345.87s；8/8/23缓存isVisible首败全叶复核与directHash==wantedHash保存foundation-combat2-first-leaves.json。后续seed11/12和seek后巨兽接触尚待当前候选完整运行，不冒称已通过。
R1原则审计：仅撤普通FOV反事实只作因果证据；合法场景须另满足原生Movement.c2572/2582–2589的几何FOV与>50光强、透视规则。prepared场景原铺图/移玩家却保生成LightMap，不是公开输入改变原生规则；最小updateVision(false)发生在origin前且共同用于replay/seek，全部No/收费/两问/stale/缺失多余决定断言保持。square接触/rest/no-space隐格由真正普通FOV零光建立；foraging盟友invisible在MonsterVisibility盟友分支不会hidden，真实黑暗负例不意味着拒绝可见隐形盟友。将补对应可见正例，保原完整33负/正例及经济/recording断言。新增空间5项原字段全图不裁；giants spine及D3/D7不是仅因撤FOV通过即旧前提，已有三变体原捕获全叶与84原hash证明，黄金仅登记允许格式/FOV派生叶。CE源码当前缺失未fetch，不将注释行号当作本次CE动态对照。

### 原seed47后置巨兽正伤害：新暴露内容阻碍（2026-10-12）
当前原文件links的validateNaturalPersistence已实际写出425 events/18 saves/seek[425,0,24,2,425]/续录426、0OOS及完整世界相等；此后原`expect(giantHit).toBe(true)`失败（完整批最终堆栈待结束核验）。固定fixture的hits中所有玩家正伤害目标为14/27/36/39/53/71/74/85/88/89/106/107/110；自然giants根51/83/99/151没有任何正伤害记录。53是goblin conjurer37召唤的spectral_blade，不是巨兽/巨兽成员；原trace.reason为no-safe-stair-route而非goals-complete。三变体原观察hits均精确等于该原fixture，所以不是本修复改变伤害；不能为使giantHit通过而伪造目标身份、改变生产伤害或放宽原断言。
此项与已闭完整seek分开；原fixture还要求`observation.hits===trace.hits`，因此保持全部原输入/物理检查点/该hits数组时，正伤害真值不可能凭底座修复变true。已向用户请求是否追加独立原seed47 prefix续接证据（不修改原文件/原fixture），或保此真实内容首败交父后续内容阶段裁定。未获裁定不擅自扩大内容输入；其余相关门禁继续，不写READY冒称原完整文件全绿。

### 原文件实际结束与本步主门禁（2026-10-12）
原完整3文件实际2pass/2fail，0skip/todo，exit1、1372.43s；evasion和normal-short完整通过；natural到达并完成seed11/12各全部持久化后在NPC招式集合失败（缺combat.anchor-break/zombie），links到达完整seek后的giantHit=false。所有原observation hits/releases/parries精确相同且三变体base/nonvis/final均验证；固定输入中的玩家五招正伤害齐全，NPC仅四招。原文件源码before/afterSHA不变、Game变体已恢复。此两原内容证据缺口与三个已闭VIS首败分列，不把2pass当4pass。
主门禁v1包装器生成替换范围错误，NameError、未执行任何子门禁，null==null的sourceUnchanged无效，不作证据。v2 boundary/types/build过，6完整71pass/5新fixture fail（四native坠层天然DESCENT_LIGHT却误断言无flare；feed诊断load按合同关闭录像却误要求追加event）。只纠正新fixture：路线保真实flare一次knowledge准备及后续纯读、完整世界/RNG/allocator/非单调seek/续录；独立noflare受控旗标及知识断言全部保留。feed使用原生初始非满satiety，不经诊断load，原收费100/一event/一fact/一食物断言不动。v3最终6文件76/76pass、0skip/todo，97.09s；boundary/types/build均exit0，源1311/73a08ca004620f1e9c5f78ef0fe298aee4d236a5a6b47d4916d973604b9afc14前后一致。
实际缺combat/crafting/foraging/giants/narrative的新根正式5项全部过、无skip/todo（70.48s），边界/类型各0，不新跑StepB128/15或全部剩余ext。其余原R1剩余191文件及真实无fixture拒档由完整source旧hash重构复用；唯一原CE skip不变。external边界发现诊断root导入combat私有test helper，保首败；移probe/config到其combat测试所有者再验，不宽化守卫或加例外。

### 补充最后实际收尾与阻碍（2026-10-12）
主candidate相关source前后73a08ca0…；native root5及feed34完整通过，四守卫合37，6文件76pass/0fail/0skip/0todo，无name过滤。missing root5全过、边界/类型0，五目录实际始终不存在；原R1实际全部剩余191/2924+1CEskip及真实七包拒档按同源证明复用，不补无关全量。external诊断移动正确所有者后boundary/types均0，首版outside-owner拒绝保留；新根仅撤普通FOV的5项全fail，真实0pass/5fail/exit1、47.01s，完整snapshot差分/空队列旗标分别失败，target SHA不变、Game原bytes精确恢复，tail包装exit0仅表示配对完成。最终source重新计算73a完整值，实际dist b705不变，git diff --check0。
原内容自然NPC集合缺combat.anchor-break，原links giantHit=false均在三变体相同原事实证实；全seek、11/12、源/原断言/原RNG/命令/决定/物理检查点保持。需要对独立原prefix续接输入或后置内容合同作外部裁定，无法在本步骤的不可变原输入约束下合法制造所缺事实；**不能把两原文件exit1仅登记后称READY**。当前写foundation-combat2-visibility.BLOCKED.md逐项交父，未写READY，未派R2/R3、未commit/push/merge/tag。所有当前子门禁确实结束，dispatch active_child清空；原63及F1–F5的R1证据保留，新的两内容首败不混计其中。XP skip/5D3另案/Z1-A不CE fetch/full/gen/Claude最终候选待验继续。

## 2026-10-12 用户范围裁定落实：VISIBILITY READY（同一原作者接续）

完整读取执行根combat2-giantHit-scope-decision.md及最新pipeline-supplement-20261011.md。用户明确seed47后置giantHit=false是原combat2已登记自然巨兽新招接触缺证据，移至combat2集成待办，不阻塞本步或R2、不再等待裁定；补充合同C10同样已列zombie自然释放为集成待补。覆盖上方所有“待裁/不能READY/BLOCKED”当前态措辞，历史首败、错误判断及证据原样保留。本轮没有新生产或测试修改、内容输入、黄金更新、SDK或整合；因此不重复上轮有效门禁。

### 范围内实际通过

- 原evasion seed3/62、natural seed3/64、links seed47/425三个VISIBILITY首败关闭。原seed/命令/决定/换层坠层/物理检查点不变；外部固定4ea702c内容装配隔离，19共享生产与主候选同字节。完整世界断言保所有缓存层和可见旗标，不用0OOS代替。
- 原完整文件实际natural seed3：64事件/7次存读/seek[64,0,49,1,64]/续录65；seed11：315/14/[315,0,34,1,315]/316；seed12：1328/21/[1328,0,138,1,1328]/1329。links原完整文件425/18/[425,0,24,2,425]/426，所有完整世界比较先通过再到后置giantHit。独立捕获更广links另有19存点，不冒充原文件18存点。
- 正式无可删除模块依赖根native5（seed3/47 × 有无渲染真实fall/stairs四例＋无flare纯边界一例）、foraging完整34（原33保留，增可见隐形盟友接受、100tick、一event/一fact/一食物正例）与四守卫37，主6完整文件76/76pass、0fail/skip/todo/name-filter、无已报告unhandled，exit0；boundary/types/实际build各exit0。仅撤普通FOV根5全fail的有效反事实保留，不是候选失败。
- 真实缺combat/crafting/foraging/giants/narrative时新根5/5pass、boundary/types0，实际目录缺失、无新skip/exclude。旧全部191剩余ext/2924pass＋1既有CEskip、真实无fixture七包save/录像拒绝及完整活局保持由全源重构证明复用；不是新一次全ext或128/15。
- R1原则审计已完成：七文件原expect/公开命令按序保留＋独立单FOV反事实＋合法原生LightMap/普通FOV语义，不能只凭撤FOV通过认旧前提。保两问true/false replay/seek/续录、决定缺失/多余拒绝、过期runtime/RNG、风险No零成本/一次收费/可见安全/完整recording与原输入。giants spine/D3/D7保原捕获逐叶；新增空间5项保58条实际原文件断言；F1窄写集/完整身份与原异常/原16/64门限均按精确同源复用。没有新增产品“隐形盟友拒食”规则。
- 全世界2537点/对、125148叶（5074格式、120074普通FOV）、未知0；独立7635root/7572chain及63全世界扩展投影样本核对。大raw保持执行根，处理后的gzip各小于1MB。

### 范围外内容待办（原完整文件仍exit1，未弱化）

| 原用例 | 实际结果与归因 | 集成阶段责任 |
| --- | --- | --- |
| combat2_natural五trace聚合 | 全部原seed1/2/3/11/12持久化完成后，原NPC集合断言缺zombie/combat.anchor-break；原releases三变体精确相同 | 按补充合同C10补自然zombie释放证据，保原断言和原首败，原seed23/118等SDK安全prefix与自然/受控证据分列合同保持 |
| combat2_links seed47/425 | 全存读/seek/续录先过，45行giantHit=false；原自然giants51/83/99/151无正伤害，原reason=no-safe-stair-route，53是spectral_blade | 按用户裁定在combat2集成本地补自然/公开命中巨兽路线或已有可命中种子，保原断言；本轮不提前修内容、不换原seed47 |

原3完整文件真实2pass/2fail、exit1、0skip/todo，不能写为整文件全绿或整combat2验收通过。两个范围外内容首败及原测试源码SHA/原断言完整保留；无新增skip/exclude、无裁快照。集成时仍须复验原内容用例，不能拿本次外部装配当已合内容。

### 本次证据核验及交接

实际完成时间2026-10-12T02:15:58.014950+08:00。本次短同步核验22个既有aggregate/child done与原Vitest JSON（包含范围外exit1和counter exit1），各summary active=null；原三个test文件与固定4ea702c逐字节相同。源码1311／`73a08ca004620f1e9c5f78ef0fe298aee4d236a5a6b47d4916d973604b9afc14`，dist60／`b7055a7b4d2d84c21badd1c3bc9975e6a8014dc4fe04c4499ed840f2df4f6696`重新计算相同。初次临时build核验误把dist/前缀算入路径而失败，未产生证据；按原fingerprint.py的相对dist路径纠正后同值，不是构建或源码变化。核验脚本真实exit0、git diff --check0、quick-check bash -n0；未新跑或伪造子done、未覆盖任何历史done。`combat2-visibility-scope-close.json`保核验方法/实际done/计数和范围映射。

本次只改任务书/报告/中文状态、证据摘要及外部进度/dispatch/READY。上轮新增根测试/feed正例/归属保持原字节，19生产/全部原黄金保持R1，复用原drift14和性能不冒称新跑。持久格式仍foundation14/world5schema5/settlement1.4.0，whole6/record4/origin2/九SDK冻结、无新Game字段。

已写执行根foundation-combat2-visibility.READY.md；此前BLOCKED留作历史并标记裁定已解除。范围内无未关闭缺陷、无活动子测试；下一步父01a1163c-1880-7c31-b810-dd60d1e07ac8派既有独立R2一次统一复核六项R1修复及本补充，不自行审查/派代理/R3。未commit/push/merge/tag，不SDK/内容合入/全npm/ext/128/15/CE fetch/full/gen；XP skip、5D3另案、Claude最终候选人工仍待回执。启动器launch-detached.py/run-child，纯shellwatchdog.sh。

收口暂存检查发现原未跟踪报告尾空格及 ext_foundation_boundary_audit.test.ts 文件末尾多一空行，已仅清理空白。审查源73a08ca0保持为被测身份；最终提交源 SHA256 `cf4156f866f2a8cf87c72886da8a6700e0346499db7211b354772e9c69fc0c30`（1311输入），唯一源码差异为该文件末尾空行，语义、断言与构建均未变，未因此重复门禁。
