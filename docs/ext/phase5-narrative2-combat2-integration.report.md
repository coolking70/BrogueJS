# narrative2 / combat2 顺序集成报告

**本轮 R1 响应交 BLOCKED（2026-10-13）。** R1-F1 的11个测试/helper/fixture路径修订及四代表物理删除布局相关复测已实际完成；生产、registry、发现器、旧fixture字节不变。正常七包N2组合仍未在原900秒门限内通过，未获内容豁免，故不交R1-fix READY、不宣称R1全部关闭。没有确证新增生产缺陷。前一候选的READY及下方完整模块计数为历史证据，不能替代本轮结果；原47 giantHit、zombie anchor-break与自然group缺口继续按用户批准非阻塞。

## 固定来源、授权和候选

开工 HEAD `c7bee4ffe6190a1173319ab3730df5f5143f26e6`。六项 `63a279e`、SDK `e9280c6a9e217e9e1c27c55744f7281ddcb494fe` 及其正式回归/登记保留。

| 顺序 | 固定来源 | 实际 merge | 父系与冲突 |
|---|---|---|---|
| 1 | narrative2 `1d0d900212c94e5acfccdd63d244e24d6f2d1bd2` | `70a8e98b5ab86833a10ddeba068ffb8caf18d9b4` | 第一父 c7bee4f，第二父固定 narrative2；无冲突 |
| 2 | combat2 `4ea702c0fce7a25cea9be0bf92b27dbd3ff29677` | `a15c9800877db8280ab031e9e600d33f019db33c` | 第一父70a8e98，第二父固定combat2；无冲突，自动合并保 combat_sdk_generation_identity 登记 |

两来源和已发布底座均为真实祖先。合并提交只用于保父系及继续流程，不代表验收。唯一作者，同一会话，无新增审查轮/其他代理；未push、合main/foundation、tag或最终修验提交。父专属 commander-status、dispatch/monitor/quick-check/任务书不改不暂存；它们的并发工作树差异不属于本作者交付。最终修验提交由维护者核对。

执行根 `R=/private/tmp/brogue-commander-20261009-5z`；本步证据 `E=R/integration-evidence`。Node24 / 3072MiB / 单worker串行，全部长后台 launch-detached.py 独立OS session+nohup+run-child done。argv/真实exit/耗时/源码脚本前后SHA逐命令外存。未运行完整npm/ext/128/15或CEfetch/full/gen；最终统一批次与独立R1/最多R2由维护者安排。

## 首败、单变量归因与实际修订

当前真实合并树首轮 narrative exit1：22文件、416项，381过/35败、0skip/todo，2985.51s；combat exit1：950项，940过/10败、0skip/todo，3937.62s；giants2 foundation exit1：13过/2败。原日志和JSON分别 `E/{narrative,combat,giants}-original.*`，不继承旧5Z或隔离副本通过。

narrative 十个 failCommit/failSettlement 与 N2-A01 首轮已通过；其余是22持久化/2trace/8组合的旧身份或hash、七包旧路线自然NPC缺失、1协议声明指纹、cord.mender absent-skipped 原60000ms超时。combat两SDK公开前缀首轮原封通过；额外10败为 foundation13 固定值1、固定trace身份/hash4、bonfire1、旧64组合原60000ms超时4。超时首败保留，不增加原门限，不自动归过时前提。

| 修订 | 当前树原失败 / 仅一生产变量反事实 | 最小修订与边界 |
|---|---|---|
| bonfire native终点中断 | 新表原NPC attack0；只definitions回59b9ba6，1过/48名称过滤 | 仅jackal→未绑定wraith；原伤害/终点时钟/中断/No不变；目标复验1过/48过滤 |
| giants2 SDK02 动画开/关 | 原hits0两败；只旧definitions，2过/13过滤 | 同一物种前提修订；完整文件15过，无skip/todo/过滤，35045d9来源/GC幂等保留 |
| N2两协议声明指纹 | 仅descriptor/RecordingV4旧声明时原身份守卫1过/4过滤 | descriptor 13→14；RecordingV4 codec.foundation 13→共享常量类型；精确两hash刷新。Game字段集合及其余四声明不变 |
| C2 foundation固定值 | 仅descriptor旧声明时原13断言通过 | expected 13→14，仅已发布格式前提 |
| growth明确No真实回归 | 新受控arena/discordant ally No完整世界首败，仅justRested true→false | Game受控输入清零移到确认/资格/费用及beforeCommit成功之后；普通输入前缀保持，无新Game字段。整growth曾8过；最终完整combat全8项（含justRested=true前提）已实际通过 |

No用例保完整世界/缓存/RNG/资源/时钟，runtime/ledger/actorActions原对象身份，恰一次false录制，过期Yes拒绝。它是受控协议证据，不伪称自然路线。Game只此8行必要修复；已发布其他生产、回归和登记按 `E/published-repairs-at-merge.json` 对照。反事实只在当前主工作树临时回退明确生产路径，try/finally恢复；`E/attribution-restored.json`确认恢复，不把回退期间结果当最终候选验收。

## 黄金与完整快照

原fixtures逐字外存 `E/original/`；四变体完整raw快照/录像外存 `E/captures/{base,nonvis,oldcombat,final}`，解压约50.4GiB，不入仓。base精确复现原黄金；只读逐叶v1终止exit-15/外层1保留，优化v2同样完整比较exit0/1214.99s。五ndjson逐行计数完全等summary、0坏行，见leaf-file-integrity.json。

| 单变量比较 | 分类 / 叶数 |
|---|---|
| combat base→nonvis（全八原trace） | foundation14 5212、派生录制摘要7795、wall-clock8；无物理输入/费用/RNG/行动差异 |
| combat nonvis→final | 普通FOV120320、wall-clock8；完整缓存字段保留 |
| narrative base→nonvis | 格式411、派生摘要8299、模块输入身份129、settlement1.4身份6、clock11 |
| narrative nonvis→oldcombat | 普通FOV5798、clock11 |
| narrative oldcombat→final | 新combat profile/rules身份26、合法内容后续world/message/RNG48635、模块输入17、格式10、派生276、FOV155、clock10；七包原201拒绝，未冒充完整路线 |

combat八trace（evasion seed3、natural seeds1/2/3/11/12、links seed47、revisit seed1）按原mechanical/digest实际捕获，只刷新identity/checkpoints/真实recordingBytes。inputs、keyIndices、命中/释放/格挡、depth/tick/finalRNG精确断言不变。combat-fixture-refresh的trace SHA是紧凑JSON值的散列，实际文件字节SHA另见作者manifest；字段旧新值、派生hash和raw映射见combat-fixture-refresh.json、leaf-verified-classification.json；SDK23/118 fixtures未替换，首败prefix/initialCommands/attempted不抽掉。

narrative七包旧200事件当前仅D2/13100tick/48,15，只有回旧combat时为D4/18600tick/73,4；原第201 open entity155尚未自然出生/到达而拒绝。新绑定合法改变路线推进，不作hash-only替换。原捕获方法TRACE实际exit0：five-wizard/cord-normal两项，184.95s。COMBOS原法在外部看门狗1214s到限被TERM，实际exit143（不是124/通过），无完整Vitest JSON。八行本轮lifecycle产物存在；七包原seed2完整捕获835→1620事件，五个自然birth、完整save与continued save已生成，但生命周期未完成。当前其余十trace命令/seed/events不变；完整世界/身份/派生hash及原捕获器补记的birth.entrance真实楼层入口元数据变化，原自然放置守卫不变；七包保原seed2/原捕获器/所有自然到达与完整世界断言，命令/RNG合法重新采集。逐字段旧新记录narrative-fixture-refresh.json；最终完整narrative常规门禁exit0实际复验了新七包所有生命周期断言；capture中断143仍保留，不把中断批次改记通过。没有追加搜索。

## 原12、九行、原6

| 原narrative # | 原入口 | 当前已取得 / 最终整模块 |
|---|---|---|
| 1 | cord.mender failCommit | 最终整narrative通过，原断言全保 |
| 2 | cord.mender failSettlement | 最终整narrative通过，原断言全保 |
| 3 | cistern.listener failCommit | 最终整narrative通过，原断言全保 |
| 4 | cistern.listener failSettlement | 最终整narrative通过，原断言全保 |
| 5 | bone.clerk failCommit | 最终整narrative通过，原断言全保 |
| 6 | bone.clerk failSettlement | 最终整narrative通过，原断言全保 |
| 7 | salt.warden failCommit | 最终整narrative通过，原断言全保 |
| 8 | salt.warden failSettlement | 最终整narrative通过，原断言全保 |
| 9 | letter.carrier failCommit | 最终整narrative通过，原断言全保 |
| 10 | letter.carrier failSettlement | 最终整narrative通过，原断言全保 |
| 11 | N2-A01 完整缓存/save/replay/continue | 最终整narrative通过，原断言全保 |
| 12 | 七包读档后再存 | 原路线首败保留；原法新route最终完整通过，与九行末行重叠不另累计 |

| 九行 | 最终整文件状态 |
|---|---|
| [] | 通过 |
| narrative | 通过，五新人 |
| narrative+growth | 通过；XP disabled |
| narrative+combat | 通过 |
| narrative+giants | 通过 |
| narrative+crafting | 通过 |
| narrative+foraging | 通过 |
| narrative+settlement | 通过 |
| narrative+growth+combat+giants+crafting+foraging+settlement | 通过，五新人及完整缓存空间/存读/续录/replay/seek；不与原12重复累计 |

| 原combat # | 原入口 | 当前取得 / 最终整模块 |
|---|---|---|
| 1 | seed23 原90条prefix+第91 attempted | 首轮及最终完整combat原封通过 |
| 2 | seed118 原151条prefix+第152 attempted | 首轮及最终完整combat原封通过 |
| 3 | seed3 evasion /62完整seek | 最终完整combat原固定输入/完整seek通过 |
| 4 | seed3 natural /64完整seek（后续11/12不省） | 最终完整combat原五trace存读/replay/非单调seek/续录全部完成；后置anchor-break内容断言仍败，非持久化失败 |
| 5 | seed47 links /425完整seek | 刷新后真实完整18保存、seek[425,0,24,2,425]、续录426、OOS0完成。文件仍exit1，唯一后置giantHit=false；原断言/首败保留，内容豁免，不称整文件通过 |
| 6 | bonfire旧jackal | 严格单变量后wraith最小前提修订；最终完整combat整bonfire文件通过 |

giants2 SDK02 两项另列，不能混入原combat6。

## 自然证据、正式缓存回归及受控证据

旧自然批次 Vitest81282/worker81284 由维护者 TERM（约88分钟），next2-v2 done143，无整文件结果，不称通过/124。zombie 的18条搜索记录（seed23..40）均未取得 anchor-break 实际释放，body 没有有效 fixture 或闭环。规划器草稿与全部未完成断言原文外存 `R/integration-natural-incomplete-draft.test.ts.txt`、helper草稿 `R/integration-natural-search-helper.draft.ts.txt`；原正式 helper 恢复 merge HEAD 字节。原 `combat2_natural.test.ts` 的五NPC释放断言与 `combat2_links.test.ts` 的正伤害谓词/giantHit 断言及 SDK23/118 fixture 都逐字未改，没有新增skip或捕获开关。

| 要求 | 实际结果及范围 |
|---|---|
| zombie自然出生并释放anchor-break | 用户已批准非阻塞内容缺口；完整combat原natural文件后置断言仍失败，原首败保留，无后续搜索 |
| 自然巨兽新招正伤害 | 原seed47仍giantHit=false，原首败/断言完整保留并获内容豁免。新增固定118从零回放已独立完整通过，保原151安全prefix和第152 attempted，正伤害目标确为natural出生的giants类型；不替代或改写原47结果 |
| 自然群体paid handled及member实际释放 | 尚无完整自然闭环；用户已批准非阻塞内容证据缺口，不把受控协议用例冒充自然 |
| 非空cached NPC combat资源冻结 | 下述七包固定自然公开路线正式回归实际通过；非空、活自然出生、完整资源行与完整缓存世界相等、活动tick增加全部执行 |
| 自然seed11/12完整持久化 | 原1/2/3/11/12五trace全走完原存读/replay/非单调seek/续录，来自最终完整combat真实新标记；不能把原natural后置内容失败写成该文件exit0 |
| growth技能明确No | 受控arena/discordant ally协议证据，完整combat中8项全过；No完整世界/RNG/缓存/资源/时钟、原对象身份、一次false、过期Yes拒绝全保。justRested真实生产修复如前，不称自然证据 |

固定118新增正式用例153事件、9个完整保存、seek[153,0,18,2,153]、续录154/OOS0，且完整世界比较与原命中/释放/格挡、RNG/检查点断言执行。原23/118初始输入与attempted不重抽；原47为425事件、18保存、seek[425,0,24,2,425]、续录426/OOS0，原正伤害断言在其后仍失败。原evasion3、natural3的完整缓存显示字段保持，不以0 OOS代替完整比较。原seed11为315事件/14保存/seek[315,0,34,1,315]/续录316，seed12为1328/21/seek[1328,0,138,1,1328]/续录1329。新鲜标记、mtime、SHA、归属范围在 `E/natural/final-fixed-scope-manifest.json`，原TERM批次部分118标记不混用。

缓存首败分两次保留：最终全combat的新增seed12为空；cache-known118-v1 exit1，2项1过1败，固定118完整持久化通过但cached rows仍undefined，冻结比较没有运行。两者不是已证明的生产冻结缺陷，也不是内容豁免。前提审计确认这些 combat-controller 保存切点没有cached资源，而已有七包原法完整自然save确有17条（最早到达save有2条）。本轮没有继续盲换seed或capture，而将已有七包seed2/modewizard/modules7/全部1620公开命令及decisions/finalRng精确复制为combat自有小型输入 `combat2-integrated-cached-route.json`。不跨模块导入helper/data，不注入位置/HP/敌人/资源/RNG，不删命令或cached字段；原N2trace不改。`cache-seven-route-premise-update.json`逐字SHA/原法来源与前提分类可追溯，12/118缓存首败源码另存。

缓存首次七包完整复验 `cache-seven-fixed-full-v1` exit1，2项1过1败，617.67s墙钟：固定118完整通过；七包全部输入、D8、双RNG、完整load等值和非空资源已通过，但在load后读取birth bridge得到0个natural来源。时钟/冻结比较未执行，首败原样外存。`ext/birth.ts` 的实际合同明确该桥是one-way/session-only，非实体状态、解码不保留；不是新的生产持久化回归。新用例只纠正观察时点：在保存前从真正活对象读取birth事实并脱离引用记录，完整load世界等值后要求相同id/type/hp>0仍拥有缓存资源；原自然来源和冻结语义不变，不重新标记NPC或增加持久字段。`cache-birth-bridge-premise-update.json`保存合同/前后SHA与首败。修后没有搜索、换seed或改变公开输入，同一固定门禁独立新stage正常复验，不是超时后的续预算。

七包修后v2仍exit1：活natural来源、非空、完整load、活动tick及17条cached资源全等已执行通过，随后完整cached levels比较失败；v3只前移失败raw保存，名称选中缓存0过1败/118过滤1，真实skip0/todo0/unhandled0，exit1。完整前后逐叶只D7四个预约入场NPC `entersLevelIn` 6→4、5→3、3→1、4→2，无其他cached世界或资源差异；tick156200→156300，12个活natural来源，包含stamina22/regenRemainder10等非平凡资源。原raw/首败保 `E/natural/cache-world-firstfail-v3/`，不是通过。

Game.monstersApproachStairs是原生相邻层预约者入场时钟，当前方法与59b9ba6逐字同SHA，正常倒计时不能当作combat推进缓存。受控单变量counter在同一完整真实save上：仅临时抑制该回调则完整cached世界相等；恢复回调并重载完整save/RNG，公开等待允许预约者原生入场。counter-v1 exit1只是三wait尚有预约者（单变量cache断言已过）；counter-v2完整1项过exit0，0skip/todo/unhandled/filter，身份稳定，第5次预约清空、第6次后完整cache和13资源行冻结过。该受控probe明确不作自然通过，回调恢复、临时.probe/.config在done后归档并删除。单变量某中间JSON的nativeRemaining标签错指counter后值；权威native四叶/raw和public逐步输入、末counter摘要保实际[4,3,1,2]，在verified-premise注明，不据错标签声称native值。

正式自然case最小前提改为全部原1620公开输入与finalRng检查后再固定6次公开wait，显式断言预约为空，之后才建立完整save/load及freeze基线。fixture不改、原命令不抽掉、没有写预约/位置/资源/RNG或采用mock，不删缓存字段；全部原完整cache/资源/来源/非空/clock断言仍在。`cache-native-settle-premise-update.json`及`cache-admission-verified-premise.json`含前后SHA、原方法身份、单变量与6输入实际轨迹。正常固定回归的前提纠错与诊断有明确首败，不是内容搜索/超时后拆分续预算。

正式新缓存用例经 registry 的原initialCommands开局，校验初始公开prefix、逐输入接受/decisions、D8/1620及完整双RNG；保存并加载完整自然世界等值后，确认非空缓存资源，保存前观测的真实natural birth与加载后的活NPC id/type对应，再仅公开wait。比较全部cached actor资源行和完整 `levels`，保全字段；基线前已用固定6条公开wait等原生入场结束；活动tick真实增长。完整before/after机械快照外存，不提交大raw。受控非零恢复/延迟冻结守卫在原完整combat也通过，单列为协议证据，不拿它代替自然非空回归。

本阶段新增正式登记文件只有固定118完整回放与七包非空缓存两项；无自动自然搜索分支。原完整文件v2仍1过1败；原固定118第一case/其helper与最终候选逐字相同，unchanged-fixed118-body-audit.json核对v2该case确过。最终v4只选中修后缓存1过/118名称过滤1，实际源码skip0/todo0/unhandled0，后续门禁通过；不把两次结果拼成一次整文件2过。实际资源/时钟数见下方收口数据。所有自然补证仍须 bounded-natural-command.py 外部1200秒/唯一记录，保更短原门限；本次固定公开回放也保守使用该包装，最终正常完成exit0，前面的固定回放前提首败各自正常exit1，均未超时；不借此续内容搜索预算。原两个TERM143保持143，不改成124/通过。

## 世界路线修复与还原审计

原78文件批次仅 `ext_foundation_world_repair.test.ts` 七包物理路线在D2失败（期待D8），不是区域load守卫被删除。根因与上面七包新combat绑定下原201到达失败一致。当前生产树 ONLY definitions回真实59b9ba6，原784条物理fixture在原完整语义下通过：counter exit0，1通过/1名称过滤（JSON写skipped，实际 -t 未选的A01，不是真实skip）。try/finally恢复当前definitions，`world-route-counter-restored.json`核对恢复true/SHA f8beb26074a6101e378f8184b549ece3c58608519c4fc99f68593497325a87f3。

原root fixture逐值等旧N2七包835事件全部过滤ext:command的784物理输入；使用相同原过滤方法对本轮原法1620事件得到1569条，seed2/modules7/modewizard不变。只更新fixture，原root test逐字merge HEAD不动。原D8、全cached区域/足迹/非法区域拒档保持runtime/cache/RNG/allocator原身份、第二存读、受控定位真实楼梯再公开重访、退役和重新load全部断言保留。`world-route-fixture-refresh.json`登记旧新输入SHA与方法；完整world-repair文件2项通过exit0，原78整批仍保exit1，不能拼成一次1258全过。

## 真实门禁和源码身份

最终定向 v1 是真实合并生产树 Node24.19.0 / 3072MiB / maxWorkers1 / no-file-parallelism 的串行 boundary→types→build→全部narrative→全部combat→78显式受影响→drift，不是完整npm/ext。每条argv、exit、墙钟、src/scripts逐路径前后身份在 `E/final-v1-*.result.json`；全部运行中源码无变化。78实际路径在 `E/affected-files.json`，不以数字代替文件集合。全N2/C2/78的外部runner遗漏JSON reporter参数，测试没有遗漏；原stdout逐测试和真实汇总保留，`final-v1-verified-summaries.json`校验总计、首败、过滤和源码。drift有真实JSON，不为补JSON重复整模块。

| 门禁/阶段 | 真实exit与计数 | 说明 |
|---|---|---|
| final-v1 boundary | 0，2.78s | 无测试计数；源码前后一致 |
| final-v1 types | 0，9.78s | 同上 |
| final-v1 build | 0，13.05s | 保原chunk大小警告 |
| 完整narrative | 0，22文件全过；416过0败 | 1573.41s，原12/九行完整生命周期实际关闭 |
| 完整combat（含旧64与新增两项） | **1，49文件46过3败；950过3败/953** | 3508.13s；原giantHit、缺anchor-break获内容豁免；新增缓存空样本当时未获豁免、后续正式修验关闭 |
| 78受影响完整批次 | **1，78文件77过1败；1257过1败/1258** | 2066.31s；旧七包物理fixture停D2，后续原法fixture修复完整文件关闭，原批次不改记exit0 |
| drift | 0，8文件16项全过 | 286.27s；身份一致 |
| world-route ONLYdefinitions counter | 0，1过/1名称过滤 | 153.05s墙钟；不是原78最终候选通过，不混入pass总计 |
| world-route修后完整文件 | 0，1文件2项全过 | 438.35s墙钟；test字节不改，身份一致 |
| cache-known118-v1 | **1，1文件1过1败/2** | 228.41s墙钟；固定118完整通过，cached rows为空，冻结比较未执行；身份一致 |
| cache-seven-fixed-full-v1 | **1，1文件1过1败/2** | 617.67s墙钟；非空与load通过，birth桥观察时点错误导致来源断言失败，冻结尚未执行；身份一致 |

除明确counter名称过滤外上述Vitest批次均真实skip0/todo0/unhandled0/名称过滤0；无CE源码提示不是实际测试skip数。重叠批次不累加，原模块真实失败与后续相关整文件通过并列。原60秒超时首败保留，最终v1这些用例实际通过，未改原门限。

正式v4缓存选择回归真实exit0；其后boundary exit0，types exit2（新测试 Array.at 不在项目既有TS lib，build/membership尚未运行），外包v4真实done2，不称整个stage0。只将已由记录长度断言确保非空的末事件读取.at(-1)换为[length-1]，同一普通数组同一末事件/decisions，未改生产/helper/fixture/输入或任何断言；v4已过运行体原文及前后SHA留cache-types-accessor-correction.json。随后独立v5只相关boundary/types/build/membership+hygiene全部实际完成，不为测试库访问器等价语法重复昂贵固定路线。该一测试访问器的源码差异与自然case实际运行身份明确分列，不冒称v4在后来源码身份重跑过。

v1后至本轮收口唯一src/scripts差异是：七包root物理fixture、独立combat缓存测试（含固定6waits的前提）与其自有新公开输入fixture。所有生产（含No修复）、其他原回归、narrative输入/测试不变；root fixture由完整world-repair复验，新combat固定118 case保持v2真实通过时的body/helpers字节，修后缓存case由v4名称选择复验，未重复已过全N2/C2/78/drift。范围差异 `whole-to-cache-close-source-delta.json`，最终related运行前后SHA各自稳定；短门禁与当前一致，v4自然回归与最终只有明确等价测试末项访问器差异；world-repair之后仅独立combat test/data变化，对应root所有源/fixture与生产仍同字节。发布修复对照 `published-repairs-final-audit.json` 只Game必要No窄修与原法root路线fixture变化，其他生产/回归/登记字节保持，SDK登记保留；原links/natural/helper/SDK23/118/rootworld test核对均等merge HEAD。

| 本轮相关收口 | 真实exit/范围 | 墙钟秒 |
|---|---|---:|
| cache-seven-settled-formal-v4 | 0；1文件/1过0败，skip0/todo0/unhandled0/名称过滤1 | 439.39 |
| cache-close-boundary-v5 | 0；非Vitest门禁，无测试计数 | 4.94 |
| cache-close-types-v5 | 0；非Vitest门禁，无测试计数 | 17.05 |
| cache-close-build-v5 | 0；非Vitest门禁，无测试计数 | 28.81 |
| cache-close-membership-v5 | 0；2文件/8过0败，skip0/todo0/unhandled0/名称过滤0 | 1.02 |

`integration-cache-types-close-v5.done`真实exit0；wrapper24898/runner24899独立session/nohup已结束。v4测试外部budget记录正常完成exit0，v4外包stage为types失败真实2，两者分列。正式缓存实际 `13` 条非空NPC资源行、`9` 个活自然出生来源；D8，tick `156800→156900`；6waits后的完整资源行及完整缓存世界SHA `ef7715f1212e43d91c9dfc9f3a7361d41fdc6ed37dd9206137de1a74a7704200` 两边相同，完整raw before/after外存 `E/natural/final-fixed-scope/`。不是部分fixture输出代替通过。

最终源码身份：HEAD `a15c9800877db8280ab031e9e600d33f019db33c`（两个merge检查点之后未修验commit），src/scripts `1371` 路径集合规范JSON SHA256 `81a0a08abc4fa89138d667b36646a6c9f19d94a2f8b2cdd9c12d12281f00dc54`，完整逐路径及最终构建dist SHA在 `final-candidate-source-identity.json`；该身份不含父文档并发状态。作者显式路径清单、逐文件SHA/大小/JSON/CRLF/diff-check在 `author-paths-current.json` 与 `author-diff-check.json`。无暂存父状态、无push/main/foundation/tag或另派作者。

## R1前历史 READY、未验与人工交付

必要实现/正式回归/相关复测已完成，剩余 zombie自然anchor-break、原47 giantHit内容证据、自然群体handled闭环按用户最新裁定非阻塞；保原断言/首败/未完成搜索，不继续寻找或假通过。暂无已确证未修复生产缺陷。READY只供维护者核对稳定候选并派独立R1/最多R2，不代表完整combat原批次全绿或最终发布验收。

本作者没有运行最终完整npm/test:ext、128启用子集、15实际物理删除布局及29删除smoke；也没主动CEfetch/full/gen。维护者独立审修后统一最终批次，不能沿用旧5Z或本阶段定向结果替代。当前fixed七包内容输入要求该正常安装候选；实际删除布局及缺包输入拒绝均留维护者统一批次，未在本阶段宣称通过。XP奖励absent/disabled真实skip维持（与Vitest skip0分开），5D3招募另案。

人工清单 `R/integration-narrative2-combat2.manual.md`：Claude须在最终组合Git/构建身份上验五新人两结局、原12行UI、三宽度/横屏/普通沉浸/四渲染器、像素390/DPR1实际1.5倍与图片失败降级、触摸键盘/焦点/真机、No/取消与保存回放seek。combat含1440×900/390×844/320×844矩阵。全部仍待人工，无回执，不用engine/SSR/CSS/静态资产代替实际浏览器通过。截图与>1MB raw外存不提交。


## R1-F1 响应（2026-10-13，正式相关验证结束，BLOCKED）

独立R1正常done0，唯一S2为剩余模块测试固定请求物理删除的可选包，没有新增确证生产缺陷。本轮同作者响应，无新审查轮、无其他代理。基于R1候选HEAD a15c980加未提交，src/scripts原1371路径规范JSON SHA `81a0a08abc4fa89138d667b36646a6c9f19d94a2f8b2cdd9c12d12281f00dc54`；修订仅11个测试/helper/fixture路径，生产、registry、发现器、脚本、原全部trace/SDK fixture均不变。当前1373路径规范JSON SHA `027cdd47e9c03c29b12027c1bfd1480743ec25a30a3bf541cdb31dfcd614fc56`，逐路径见 `R/integration-r1-evidence/candidate-f1-source.json`。正常树测试与4个最小代表物理删除布局相关复验已结束；缺包路径验证完成，但正常七包N2原门限超时未关闭，本轮交BLOCKED。

| F1关联入口 | 正常树原语义保留 | 缺包布局的合法执行／拒绝 |
|---|---|---|
| C2 combinations | 原九行、原自然controller/300命令/180秒、五新招输入/真实正伤害/原全持久化 | 实际安装包驱动合法pair与去重的剩余全开行；不请求不存在模块 |
| C2 growth | 原5行费用/Stat容量/一次物理解算/focus，原技能费用、整世界拒绝与明确No全部保留 | 5行保base容量/原费用/native executor恰1；growth专属通知为不调用，view absent；3技能用例验证真实剩余全开lifecycle与原七包拒绝、缺包命令零成本/完整世界/原runtime-ledger-actions身份 |
| C2 links／SDK118／integrated118 | 原47输入/425完整持久化/giantHit原断言首败、原118 151安全prefix+152attempted与新153事件/正伤害均保留；23始终原封执行 | giants或growth缺包则原跨包路线无同一内容定义，实际manifest必须拒绝；显式执行全部剩余真实包完整存读/回放/非单调seek/续录，并拒绝原七包完整save/replay。23无其他依赖，不降级 |
| C2 integrated cached seven-route | 原七包1620全部公开输入/decisions/finalRng、固定6wait预约空、原生出生桥保存前观察、load后原活id/type、非空完整资源/完整cached levels/活动tick守卫全保留 | 该七包固定自然生成路线不能移植到不同安装树；明确验证剩余全开合法lifecycle与真实旧七包输入拒绝。另相关复验未改的combat_dodge非空NPC fraction/delay/recovery缓存冻结协议守卫，不冒充自然缓存proof |
| N2 combinations | 原九行与原七包1620、原5新人自然出生/全部存读seek续录断言不减 | 原合法单包/pair trace保持；部分安装的剩余全开行用现有明确D1诊断placement，逐个五NPC原对话/journal/XP skip/完整lifecycle，启用全部剩余真实包；另有明确真实七包拒绝用例。短集合去重，无silent skip |
| N2 rewardFixture／rewards | 正常growth disabled与两结局/once-only/回滚/完整world/logger/录制/seek等原断言保留，ready/unsupported自有provider保持 | 物理无growth时旧disabled请求改实际absent语义，明确用例标题记录；仍执行两结局及完整持久化，不注入fake growth。不改变XP skip政策 |
| N2 metadata settlement | 正常Narrative+Settlement及原作者metadata无机制影响、奖励、player/RNG/续录等守卫 | 用实际可安装的这两个相关包；settlement物理不存在明确断言undefined，完整剩余场景/录制前后等值保持 |
| C2 evasion/natural/revisit/SDK23、N2 trace/persistence及其helper | 固定fixture均只需其目录owner，字节及原断言保持 | owner物理删除由既有完整目录所有权撤除注册；owner保留仍被原发现器全部发现，不改发现器排除失败 |

真实首败为独立当前候选副本物理删除narrative后，缓存选择0过1败/118名称过滤1，exit1，Unavailable extension: narrative。生产目录没有删包。`firstfail-deletion.json`与repro JSON/command保首败。新七包拒绝fixture由R1正常树真实seed2/default initialCommands+3publicwait采集完整save与recording，并实际load/replay全世界等值1过exit0；不是复制伪manifest、不是注册缺包工厂。无损gzip-base64文件83542字节，完整decoded raw1959809字节及SHA封装在fixture；原捕获原文与真实结果外存，不裁世界/录像。

新增统一fallback实际启用全部剩余包，检查安装模块/view及原required manifest拒绝，用公开wait、完整save/load、回放逐事件RNG/游标、非单调seek终点→0→中点→终点、原录制prefix+续录再回放完整世界等值；旧七包loadSnapshot/loadReplay真实返回false并保持完整机械世界/录像/缓存/runtime/player对象、RNG与allocator。仅savedAt及每次export新生成recordedAt墙钟规范化；全部世界、缓存、logger、身份、events、checkpoints、decisions与双RNG保留。生产registry拒绝路径字节不变。

前提首败分列：probe-v1 combat-only13项1过12败exit1（types0）；五项原growth通知hook在growth物理不存在时为0，native费用/解算前置已真实执行；其余完整remaining lifecycle通过后整录像比较仅recordedAt新墙钟差异。生产Combat.ts wantsPhysicalResolution与runtime仅growth注册physicalResolved、Game.exportRecording每次Date.now提供语义依据。最小测试前提调整保正常hook恰1，同时所有树native executor恰1，缺包hook不调用；录像只规范化recordedAt，保持全部其它内容。probe-v2真实12过1败exit1，唯一新增受控删除缓存草稿空rows；其后诊断发现D1七个活natural NPC尚未出招故无资源，接触诊断又产生未结束原生楼梯预约者。两次真实exit1/完整raw保留；这段临时定位/接触草稿已撤回，不当通过，不删正常七包任何守卫，也不混内容豁免。

pilot-v1真实done0：正常boundary/types/build/discovery全0，membership+hygiene8过；combat-only四文件13过。仅删growth N2选择7过/90名称过滤、真实skip0/todo0/unhandled0；Vitest截断长$name导致全remaining行未选，明确不把该scope当行通过。后续formal-deletion-allremaining-premise真正选中该行1过/8名称过滤exit0，五NPC每个完整lifecycle执行，源前后一致。正式正常八相关文件与四物理代表布局结果见下表；pilot和正式重叠不累计。

本轮不重跑已过完整N2/C2/78，不跑最终完整npm/ext/128/15；四代表布局仅F1关联定向，不称最终15矩阵或全部剩余test:ext绿。原950过3败exit1、1257过1败exit1仍保；原47/zombie/group批准内容缺口仍非阻塞，原断言不动不搜索。Claude最终人工仍待验、XP skip、5D3另案、CE不主动fetch/full/gen。


### R1-F1 正式命令、结果与安装矩阵

证据根 `F=R/integration-r1-evidence`。完整命令/工作目录/秒数/exit/src与scripts全路径前后SHA在每个 `<stage>.command.json`；Vitest真实default stdout及JSON均保留。`F/f1-final-verified-summaries.json`统一核对，不把JSON的名称过滤skipped当真实skip。运行环境Node24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=1 --no-file-parallelism`，生产树和临时副本均串行。所有正式命令前后源码身份一致，重叠不累加。

短门禁的实际入口为 `node scripts/check-module-boundaries.mjs`、`node node_modules/vue-tsc/bin/vue-tsc.js -b`、`npm run build`、`node scripts/test-discovery.mjs`；membership+hygiene入口为 `node node_modules/vitest/vitest.mjs run src/test/test_suite_membership.test.ts src/test/repo_hygiene.test.ts --maxWorkers=1 --no-file-parallelism --reporter=default --reporter=json --outputFile=<F唯一JSON>`。其余Vitest使用同样参数，具体文件/名称pattern在command记录。C2组合自然controller每条另包 `bounded-natural-command.py --seconds 1200 --record <唯一budget.json> -- <原命令>`，均正常exit0，原300命令/180秒门限不变。没有开启任何zombie/giant捕获；正常N2为已存在固定输入回放，没有重新capture。

| 实际安装布局 | 关联入口及真实结果 | 原语义／合法降级与真实拒绝 |
|---|---|---|
| 正常七包 | C2四文件12过1败exit1；C2九行9过exit0；N2三文件94过3败exit1 | C2唯一败在原47第47行giantHit，获批内容缺口；integrated整文件2过，包含153事件正伤害和原1620＋6wait自然非空缓存。N2正常原body不减，超时另列下文 |
| 物理删narrative、其余六包 | C2四文件11过2败exit1；SDK118独立1过/名称过滤1 exit0；C2合法组合8过exit0；缓存协议1过/过滤51 exit0 | 原47内容败保留，SDK118180秒首败后同一源码独立正式执行通过；正常23/118场景仍使用原prefix/attempted。七包缓存跨包路线改明确剩余全开完整lifecycle及真正旧七包拒绝，无自然缓存冒称 |
| 物理删growth、其余六包 | C2四文件13过exit0；C2合法组合8过exit0；缓存协议1过/过滤51 exit0；N2三文件97过exit0 | native fee/解算和base Stat路径；growth专属命令/manifest拒绝、全剩余完整lifecycle。N2原合法pair＋全部剩余五NPC明确诊断内容/lifecycle、真实七包拒绝；两结局缺growth为absent XP收据 |
| 仅留combat、物理删另外六包 | C2四文件13过exit0；去重组合2过exit0；缓存协议1过/过滤51 exit0 | giants/growth跨包内容无定义，明确缺包拒绝＋combat唯一实际包完整lifecycle。原SDK23始终执行，不用伪缺失包factory |
| 仅留narrative、物理删另外六包 | N2三文件91过exit0 | 去重[]/narrative及明确七包拒绝，共3个组合测试；奖励仍执行46项，metadata42项，settlement缺失明确undefined，无文件排除或测试skip |

正常与四代表布局各自boundary/types/build/discovery exit0，membership+hygiene均8过exit0。发现器实际test/gen/drift/ext文件数依次为正常586/27/8/332、删narrative565/27/7/310、删growth548/27/8/294、combat-only421/27/2/161、narrative-only393/27/3/134；这些是完整发现结果，不是本轮运行全部ext的宣称。各自完整成员清单和物理删除路径/前后集合在discovery.log与deletion.json；生产目录从未并发删包。

以下逐套保原exit/过败/过滤，不把独立恢复拼回原批次全绿。`—`为非Vitest门禁；所有完整JSON结果真实skip0/todo0/unhandled0。原CE缺源码提示并非实际skip计数；XP skipped为业务收据，与Vitest计数分开。外部124反事实没有完整JSON，过败/skip/todo/unhandled/过滤均未知而非0。

| stage（详见F同名command/JSON/log） | exit | 过 | 败 | 名称过滤 | 秒 |
|---|---:|---:|---:|---:|---:|
| audited-current-seven-fixture-acceptance | 0 | 1 | 0 | 0 | 6.47 |
| audited-original-caller-firstfail | 1 | 0 | 1 | 1 | 3.43 |
| following-without-narrative-c2-combinations | 0 | 8 | 0 | 0 | 432.16 |
| following-without-narrative-cache-protocol | 0 | 1 | 0 | 51 | 4.61 |
| following-without-narrative-sdk118 | 0 | 1 | 0 | 1 | 21.95 |
| formal-deletion-allremaining-premise | 0 | 1 | 0 | 8 | 75.33 |
| formal-normal-boundary | 0 | — | — | — | 5.46 |
| formal-normal-build | 0 | — | — | — | 23.76 |
| formal-normal-c2-combinations | 0 | 9 | 0 | 0 | 239.22 |
| formal-normal-c2 | 1 | 12 | 1 | 0 | 1214.68 |
| formal-normal-discovery | 0 | — | — | — | 0.20 |
| formal-normal-membership | 0 | 8 | 0 | 0 | 1.16 |
| formal-normal-n2 | 1 | 94 | 3 | 0 | 3303.03 |
| formal-normal-types | 0 | — | — | — | 17.78 |
| formal2-without-narrative-boundary | 0 | — | — | — | 4.92 |
| formal2-without-narrative-build | 0 | — | — | — | 23.27 |
| formal2-without-narrative-c2 | 1 | 11 | 2 | 0 | 1406.39 |
| formal2-without-narrative-discovery | 0 | — | — | — | 0.20 |
| formal2-without-narrative-membership | 0 | 8 | 0 | 0 | 1.15 |
| formal2-without-narrative-types | 0 | — | — | — | 16.86 |
| formal3-combat-only-boundary | 0 | — | — | — | 4.14 |
| formal3-combat-only-build | 0 | — | — | — | 19.85 |
| formal3-combat-only-c2-combinations | 0 | 2 | 0 | 0 | 43.63 |
| formal3-combat-only-c2 | 0 | 13 | 0 | 0 | 75.96 |
| formal3-combat-only-cache-protocol | 0 | 1 | 0 | 51 | 4.63 |
| formal3-combat-only-discovery | 0 | — | — | — | 0.16 |
| formal3-combat-only-membership | 0 | 8 | 0 | 0 | 1.02 |
| formal3-combat-only-types | 0 | — | — | — | 13.71 |
| formal3-narrative-only-boundary | 0 | — | — | — | 3.95 |
| formal3-narrative-only-build | 0 | — | — | — | 18.60 |
| formal3-narrative-only-discovery | 0 | — | — | — | 0.15 |
| formal3-narrative-only-membership | 0 | 8 | 0 | 0 | 1.01 |
| formal3-narrative-only-n2 | 0 | 91 | 0 | 0 | 561.34 |
| formal3-narrative-only-types | 0 | — | — | — | 14.33 |
| formal3-without-growth-boundary | 0 | — | — | — | 4.94 |
| formal3-without-growth-build | 0 | — | — | — | 130.29 |
| formal3-without-growth-c2-combinations | 0 | 8 | 0 | 0 | 217.39 |
| formal3-without-growth-c2 | 0 | 13 | 0 | 0 | 105.80 |
| formal3-without-growth-cache-protocol | 0 | 1 | 0 | 51 | 4.74 |
| formal3-without-growth-discovery | 0 | — | — | — | 0.19 |
| formal3-without-growth-membership | 0 | 8 | 0 | 0 | 1.14 |
| formal3-without-growth-n2 | 0 | 97 | 0 | 0 | 809.73 |
| formal3-without-growth-types | 0 | — | — | — | 15.73 |
| recover-normal-narrative-five | 0 | 1 | 0 | 8 | 101.56 |
| recover-normal-salt-disabled | 0 | 1 | 0 | 45 | 26.67 |
| recover-normal-seven | 1 | 0 | 1 | 8 | 10734.50 |
| seven-caller-counter | 124 | ? | ? | ? | 900.19 |


### 单变量、完整输入与最终审计

最后 `integration-r1-final-audit-v1` 独立session/pgid44546，wrapper44546/runner44547，真实done0。当前生产候选复制后实际删除narrative，**只将C2 integrated caller还原R1原文件**：`audited-original-caller-firstfail`真实exit1、0过1败/名称过滤1，仍为Unavailable extension: narrative。修改后的同布局正式缓存降级已通过，归因于测试请求前提而非production registry改变。该counter是预期失败审计，不当生产通过。

当前正常七包副本只新增一份临时验收test及它的root登记，生产/模块/fixture保持本候选。`audited-current-seven-fixture-acceptance`真实exit0、1过0败；无损fixture完整raw字节与SHA核对、真实manifest接受、完整原存档读取/原事件/extensions保持、录像每事件RNG/游标/完整末世界等值均执行。声明的副本专属临时两路径及完整前后身份可追溯，未混进唯一生产树。此为同版本真实缺包输入fixture的合法正常接受边界，不是旧格式迁移或伪造缺包输入。

正常缓存正式整文件2过的完整before/after各约15.6MB原始快照已无损归档 `F/normal-cached-full-raw/`，manifest保原字节SHA、压缩SHA及来源stage。13条资源/9个活natural来源、tick156800→156900、完整cached levels与资源同SHA ef7715f1212e43d91c9dfc9f3a7361d41fdc6ed37dd9206137de1a74a7704200，所有自然来源和全字段守卫保留。没有使用撤回的删除布局临时cache草稿作为通过证据。

### 未关闭项、影响与本轮交付

**唯一当前未关闭的必要相关验证：正常七包N2组合原900000ms门限超时。** 正常三文件批次实际94过3败exit1：metadata42过；rewards45过1败（salt.warden disabled60000ms超时）；combinations7过2败（narrative-only与七包900000ms超时）。同一最终源码独立恢复salt disabled1过/过滤45 exit0、narrative五新人1过/过滤8 exit0；七包独立仍0过1败/过滤8 exit1，原日志明确900000ms timeout，实际同步运行约10730.912s后才结算，不能把执行超过门限称通过。没有放宽门限或修改断言。

为区分F1 caller改动与必要回放本身，另在当前正常生产副本仅还原R1组合caller，外部保原900秒硬上限：`seven-caller-counter.original900.budget.json`记录900.187秒进程组TERM、child143/命令exit124，无完整Vitest结果。新旧caller均未完成门限，**不能据此确证F1引入生产缺陷，也不能自行归因机器环境或自行豁免**。完整原1620输入、九行原body及正常完整生命周期语义都保持，但本轮正常七包该套正式闭环尚无通过证据；前一候选完整N2 416过是历史，不替代本轮。没有续开相同预算或自然搜索。

影响：F1缺包请求已系统性实施并由关联代表布局验证，生产未确证新增回归；但本轮正常树原九行必须通过的收口条件仍未满足，故**不宣布R1全部关闭、不写R1-fix READY、不推进push或擅自下一审查轮**。交 `R/integration-r1-fix.BLOCKED.md`，已验证/未验证分列供维护者按既有流程裁定。原giantHit/anchor-break/group豁免不能用于关闭该超时。

最终本轮source仍HEAD a15c980＋未提交，src/scripts1373路径规范紧凑排序JSON SHA027cdd47e9c03c29b12027c1bfd1480743ec25a30a3bf541cdb31dfcd614fc56。R1原1371路径SHA81a0a08abc4fa89138d667b36646a6c9f19d94a2f8b2cdd9c12d12281f00dc54→F1仅上表11测试/helper/新fixture路径，生产、SDK登记、发现器、scripts及117个既有data/fixture字节不变；原body保持审计在f1-normal-guard-preservation.json。每命令identity使用path-NUL-byteSHA-LF的另一散列算法，不能和规范JSON集合SHA直接混比。

未运行最终完整npm/test:ext/drift、128及最终删除总批次；没有额外重复全N2/C2/78。执行根最新commander-rules的阶段5门禁政策已另更新，静态测试依赖声明检查、CE用途清理和最终全删1行属于后续政策收口，不能把文档当本轮已经实现/验证，也不以历史15行要求主动扩大本R1修复。原SDK/六项不重开R3；Claude最终人工仍待验，XP skip、5D3另案、不主动CEfetch/full/gen。无push/新merge/main/foundation/tag/其他代理，父专属状态/任务等未改未暂存；Git index为空。最后检查无残存作者门禁进程。


外包stage真实done另保 `F/f1-stage-done-receipts.json`：repro/probe-v1/probe-v2/cache-diagnostic/cache-formal/formal-v1/recover-v1/layouts-v1各exit1；origin-capture/pilot/following/final-audit各exit0；seven-caller-counter exit124。正常正式/恢复/首个layout外包曾因未批准超时结束1，后继独立范围done0不能覆盖这些首败或冒称所有stage绿。最后following/final-audit的0只代表各自计划命令结束及预期审计完成，不改变表中内容败、超时和外部124。


### 维护者最新裁定：R1-F1可交R2，七包超时转性能调查

2026-10-13T09:55:27+08:00：用户明确将正常七包N2约3小时同步执行后900秒超时、旧caller外部900秒exit124登记为非阻塞性能调查项。原失败不改写为通过；原作者代表布局相关结果足以交READY并进入独立R2。上节旧BLOCKED结论由本裁定覆盖。已核当前1373路径与作者最终身份一致。另起一次总墙钟20分钟（≤30分钟）隔离性能探针，同seed七包全开按命令分段计时；确认产品热点则R2后修生产，仅路线过重才按新政策缩为短路线/最小组合或性质断言。探针未完成时不称已归因。后续仍为R2→政策清理/静态依赖检查→完整npm/ext/drift、128、全删1行→推送人工清单。


## 维护者接续（2026-10-13T10:23:05+08:00）：R2通过与性能探针限制

独立R2已完成并PASS，R1-F1关闭，无新确证S1/S2/S3；审查开始/结束1373个src/scripts路径与交接相同，集合SHA256 `027cdd47e9c03c29b12027c1bfd1480743ec25a30a3bf541cdb31dfcd614fc56`。报告见执行根 `integration-review-r2.final.md`，done exit0。此为限定审查结论，不代表最终门禁通过，不开R3。

一次限时性能探针结束（外包代理exit0仅表示报告交付，非测试通过）：原seed2七包路线只完成551/1620事件（550命令+init），尚未到完整存读/回放/seek/续录。测量117.299秒，其中命令90.506秒、原观察25.044秒；窗口命令均耗时增长与深度/命令种类混杂，不能据此确认局长复杂度缺陷，也不能判定只是测试路线过重。监督进程ps被沙箱拒绝并发生退出处理异常，原执行未完整结束；已记录清理，维护者实际核无残留测试进程。报告及原始摘要见执行根 `n2-performance-probe-workspace/probe-output/report.md`、`summary.json`；预算文件 `n2-performance-probe.budget.json`。测试断言与生产未变，未自动重跑。原七包超时仍为获准非阻塞性能调查，不计通过、不自动缩测。

已同轮独立resume原作者执行CE/旧格式逐项清理、声明式静态测试依赖检查及相关验证，stage `integration-policy-cleanup`，wrapper48341/作者48342。依用户最新政策清理后统一最终npm/ext/drift、128及全删1行，15行只留大版本发布前。最终门禁、推送及Claude人工仍待完成。
