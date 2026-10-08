# 5D1 固定候选 input-v1 独立完整正确性审查

## 当前独立审查入口（2026-10-08，V12）

原input-v1审查原文及后续修复证据保持；FR1/FR2由固定v2独立报告关闭，FR3由v3独立报告关闭；V10其余优化、V11访问器修复和V12数字坐标索引均有独立结论。它们不等于5D1最终验收。V12正式性能2项通过、本轮限定回归完成串行复核（首批exit1保留），boundary/types/npm build/npm drift通过；原916测试前提修订已由full-review/NATURAL-PREMISE-REVIEW.md独立PASS；本轮单key迁移登记已由父审核采纳，登记/文档实际差量复核及最终浏览器/父验收提交仍待办。

外部独立报告根`/private/tmp/brogue-commander-20261008-5d1/full-review/`：REVIEW-v2.md、REVIEW-v3.md、PERF-FIX-REVIEW-v10.md、PERF-FIX-REVIEW-v11.md、PERF-FIX-REVIEW-v12.md、NATURAL-PREMISE-REVIEW.md。文档三项由`docs-review/DOCS-REREVIEW.md`独立关闭，已在相同语义的V12生产接入；执行者不重新签认。原自然exit1、精确915/916诊断、精确test/登记/doc delta和当前门禁见[5D1报告](phase5d1.report.md)顶部及仓库外FINAL-CLOSEOUT-READY.md。

## 历史input-v1独立报告原文（以下保留）

**结论：固定 input-v1 确认两项 S2（FR1、FR2）；不作最终验收。** 已先交 EARLY-FINDINGS.md，继续完成新增 C/D/E/F 相关审查与 A/B 回归。没有确认新的 S1，也没有把风格意见或未跑门禁列为缺陷。原执行者仍为唯一生产写入者。

## 1. 精确输入与边界

审查根：`/private/tmp/brogue-commander-20261008-5d1/full-review/input-v1`；任务指定基线 `769f6fc18aad4881bfcc8d2170de84cfd319e4e8`，本报告以固定文件清单为实际输入身份，不能把完整候选说成该基线的干净提交。

| 身份 | SHA-256 |
| --- | --- |
| manifest-v1.json 原文件字节 | `cadade3827dd036b0ecb4b53a7aea6f2389b5acd7f10d83cf210de99a66a7ae2` |
| 2632条路径→文件hash清单，按路径排序紧凑JSON | `1daa8d9f5af768f7525028600ad3ebd4e4a1d1ec93c913069da13ac2e4221ab1` |
| 固定正式 phase5d1.task.md | `8de2d03106f19cd018ba70fbbb8b42227224bea03c5121176d1ba2558da16b62` |
| 本次 full-review-v1.task.md | `7d68540e443176256f11eabf3188a2c0b809e1a227564177409c1f8b66695403` |
| tracked-diff-v1.patch | `4d6a9169c688135b5933dab7f3cf096d250ddd272aa558cd4b6f86a20b274618` |

审查前后逐文件及文件集合核验：2632/2632一致，缺失/额外/改变均0；9冻结文件实际字节全部符合固定 preflight 表。证据 [integrity-before.json](repro/integrity-before.json)、[integrity-after.json](repro/integrity-after.json)。包含未跟踪的新生产文件，未以 tracked-diff 当完整输入。禁止树/fgfixture未被本进程改写。

已读 AGENTS、HANDOFF、development、architecture、ext README、正式任务含§0/0.1、preflight、固定执行报告，以及独立34例 oracle 和 commander-inbox（至I32）。从真实 Game/native selector/worldClock/实体与Item所有权/保存录像反查主要路径。相关源码：ResidentProduction/World/Needs/Economy/Jobs/Pathing/Validation，Game命令、死亡、生成、楼梯、坠落和退休写集，TimeCoordinator/PhasedAttackProduction，world5/worldWorkSchema/runtime，居民面板与原抽屉输入、投影与locale、直接相关新增测试。

未使用移动产品树作输入。现有安装仅借用 esbuild/运行依赖；8个bundle的metafile核验显示生产源码仅来自input-v1，探针来自repro，其他均node_modules，见 [bundle-input-audit.json](repro/bundle-input-audit.json)。所有布景私有准备都明确为受控证据；自然路线不注入HP/敌人/地图/资源/位置/时钟/RNG。

## 2. 确认缺陷

### FR1 / S2 — 跨营地补结 native departure 的序号、顺序与退休tick随分段改变

位置：[ResidentNeeds.ts:190](input-v1/src/engine/Core/ResidentNeeds.ts:190)、[ActorDeparture.ts:51](input-v1/src/engine/Core/ActorDeparture.ts:51)、[ActorDeparture.ts:82](input-v1/src/engine/Core/ActorDeparture.ts:82)、[ActorDeparture.ts:103](input-v1/src/engine/Core/ActorDeparture.ts:103)。

独立合法受控 Game：公开付材建D1/D2营地与卧室，真实楼梯换层；自生原actor46与经原生救援转换的原actor72公开招募，实际FOOD/床/来源与保存校验合法。起点32000，库存8与2、需求0，1/2/17运行使用完全相同17次时钟输入，终点416000，仅改变settle调用分区。

| 持久根 | 整段/两段 | 17段 |
| --- | --- | --- |
| foundation departure ordinal1 | actor46，tick416000 | actor72，tick224300 |
| foundation departure ordinal2 | actor72，tick224300 | actor46，tick416000 |
| world5.receipts | 相同 | 相同 |
| 完整机械digest | 与17段不同 | 与整段不同 |

各运行自身保存/载入保持该摘要差异。不是时钟调用次数差异，也不是只读展示顺序：foundation收据/序号进入完整机械根。

随后独立复核I29：同起点把D2玩家移至看不见actor72的合法位置，双方相同17次逐日时钟输入到576000。整段actor72退休tick224300，逐日tick224000，匹配actor后仍不同。见 [probe.ts](repro/probe.ts)、[probe.output.txt](repro/probe.output.txt)、[scale-1.json](repro/scale-1.json)、[scale-17.json](repro/scale-17.json)、[unseen-scale-1.json](repro/unseen-scale-1.json)、[unseen-scale-17.json](repro/unseen-scale-17.json)。

原因：Needs逐camp立即执行removeResident/retire，再仅给world5 facts按tick/slot/actor排序；foundation收据已按调用顺序nextOrdinal++/push/裁剪。另beginDeparture长补结先因clock超过grace而记until，精确日界却因不可见立即记now，导致tick本身变化。只重排测试数组不能修复事实时间，更不能解除完整根等值断言。

修复要求：跨营地生命周期/退休按同一规范事件语义发布，统一不可见/楼梯等立即退休与可见300tick grace的时间；序号、128条保留顺序必须同规范事件次序。回归至少包含不同粮量、cached/active、不可见/可见/楼梯及1/2/17全根比较。

**范围：I30说明移动树已有后续scale修复。本报告只判定固定input-v1；未审该后续修复，不声称最新树仍有FR1。** 最终固定候选需原样重跑独立探针，执行者自身通过数不替代关闭。

### FR2 / S2 — 非法 plant/delivery 档可读入，公开wait在零劳动信用下产作物

位置：[ResidentValidation.ts:51](input-v1/src/engine/Core/ResidentValidation.ts:51)、[ResidentValidation.ts:56](input-v1/src/engine/Core/ResidentValidation.ts:56)、[ResidentJobs.ts:340](input-v1/src/engine/Core/ResidentJobs.ts:340)、[ResidentJobs.ts:355](input-v1/src/engine/Core/ResidentJobs.ts:355)。

通过实际付材/招募/派plant/原生selector取得合法planting票据、原seed escrow及真实plot/箱。诊断快照改该票为kind=plant、phase=delivery、creditTicks/remainder=0、pendingCompletion=true、actionId=null，删除原bundle，保留其余来源/所有权引用。loadSnapshot返回true；下一条公开wait消费seed、产生crop1、清票据。这是非法联合状态带来的实际产出，不是仅漏一个无后果字段校验。见 [jobs.ts](repro/jobs.ts)、[jobs.results.json](repro/jobs.results.json)、[jobs.output.txt](repro/jobs.output.txt)。

原因：codec分别枚举kind/phase而不校验合法组合。完成的信用检查只对phase=planting生效，随后delivery也进入kind=plant的createOutputs分支。因而严格坏档拒绝和1000有效tick产出前提均被绕过。

修复要求：在候选验证阶段校验kind/phase/actionId/status/pendingCompletion及真实计划、plot、cargo/预留的联合关系；plant发布时始终复核满1000信用，不能以phase名称代替劳动资格。坏档须在替换live roots/RNG/ID/日志前拒绝，并保留合法暂停票据及完成晚故障留下的pendingCompletion档。I32已由指挥采用；本进程未修改生产代码。

## 3. 实际独立验证及通过范围

实际命令/退出码/准备失败详见 [COMMANDS.md](repro/COMMANDS.md)。运行时v24.19.0，每条Node命令3GiB上限，无Vitest worker，最多2个引擎探针同时执行。各入口单独编译并执行，最终compile均exit0；下列反例探针exit0表示反例成立，不能解释为产品门禁通过。

| 探针 | 实际结果 | 独立断言 |
| --- | --- | --- |
| probe.cjs | exit0，FR1成立 | 真实两层营地/actor/库存；1/2/17顺序差异，另逐日不可见退休tick差异；自身存读稳定 |
| jobs.cjs | exit0，FR2成立；其余5例通过 | A06满信用在rest端点完成；A07保同票/同seed/950信用；F03完成晚发布故障完整图/双流/ID/dirty回滚；F04退款晚发布故障保持原票/cargo并暴露异常，重试仅退一次；B05真FOOD日界前先欠粮、后入箱，下一日才吃 |
| pathing.cjs | exit0 | 三个占位挡住所有下降方向；原生wait驱动22,10→22,9→23,8→24,9→24,10；每步正计时；cache同map命中、地形失效、40目标后旧条目淘汰、计数checkpoint恢复、保存载入 |
| ab-regression.cjs | exit0，28项 | 原独立v3断言仅换固定导入；死亡早/晚故障、活escrow、待日界入口拦截、同步/动画、perform/default throw、实际staff及No、ACK、Logger嵌套/描述符/折叠行与pending身份均仍通过 |
| escort.cjs | exit0 | 真实楼梯安排cached escort；无目标空间保source/anchor/loot/倒计时1；存读保持；迁入晚故障在实际最外entry检查点恢复完整图/双流/ID，重试只迁入原actor一次 |
| fall.cjs | exit0 | 原生坠落晚故障回滚伤害和双流/身份；重试只受一次6..12伤；pending唯一carrier/home/床仍在；需求退休晚故障完整图回滚；最终同原loot落D2 pending items、当前层不变、非死亡、可保存 |
| bed-release.cjs | exit0 | C03真实第二招募/床拆除与合法bed=null档；另独立B02吃粮3→2、下次缺粮到3不离开、再缺才96000离开；32000先饥荒解除占床者、后给存活者同床并housing2→1，33000→0；床释放/重分配晚发布失败整体恢复，时钟仍32000 |
| natural.cjs captive | exit0 | 正常seed3的238条真实命令，原actor85救援/招募No与Yes，拒绝world/双RNG/ID/clock不变；同actor；save/load；加1命令续录回放与原录回放零OOS，10边界seek摘要一致 |
| natural.cjs self | exit1 | 固定seed28路由首个已确认扩展拒绝event219，派plant时报C5_DISTANCE；没有完成自然闭环 |

F03实际选择是**暴露异常/中止，保留已赚1000信用与原seed及pendingCompletion**，不是已自动取消退款。检查点实际tick6800、nextID54；没有回退此前原生时间。F04另起退款事务，晚故障前源seed5/cargo1，失败回入口5/1且同原对象，成功重试6/0。F02/C03以及pending退休故障都保留已到达端点的时钟。完整图oracle为独立旧全遍历audit，不调用生产checkpoint作比较参考；Map/Set/数组/描述符与原引用均检查，WeakMap/WeakSet内容为oracle不透明边界。路径WeakMap另做直接功能/缓存检查，未声称全WeakMap扫描。

独立算术expected用oracle A06/A07、B02/B05、C03、F02/F03/F04；原kernel1600是既有独立证据，本轮未重跑也未把它当生产完整提交证据。上述通过均是局部行为/事务证明，不等于覆盖34例全部或全组合/全设备。

## 4. 自然路线、UI/组合/性能证据缺口

**seed28旧自然命令序列在本输入未通过。** 已原样运行，未修改路线以规避失败。强化每条ext错误检查后，event219派plant返回C5_DISTANCE，tick22300；最早runner未检查该返回而继续，event327、tick33100、玩家36,23被原生Jackal杀死（原始失败日志/记录已保留）。这证明旧路线不能作为本固定输入成功证据；尚未完成新旧生产差异的单变量归因，因此不另立游玩S1/S2。证据 [natural-self.output.txt](repro/natural-self.output.txt)、[natural-self.failure.json](repro/natural-self.failure.json)、[natural-self.failed-recording.json](repro/natural-self.failed-recording.json)。I31要求最终SHA重验/必要时按实际正常命令重新捕获自然路由；不能改HP/抹敌或把受控场景改称自然。

seed3实走通过是引擎证据；未读取外部原始旧完整录的captured roots在本源重放，不能把本次重新导出的回放混同“原录不重捕获审计”。保存续录+一次wait为239条，无前缀覆盖。seed28未通过，自生全闭环仍需最终源新证据。

UI静态接线确实使用同抽屉居民页、已有map cursor与公开ext命令、真实box/component revisions、投影可见性过滤；ACK busy分支保旧DTO并暂停读取，读取没有settle调用。未跑浏览器/DOM挂载验证，未独立证明24布局、DPad、背包关闭重开、浸入/窄屏、实际点击No/Yes与旧帧冻结；这些由指挥固定build验，不能把本次headless当UI通过。

组合源码按installed descriptors实际枚举单模块/peer/全开，并无本次审查添加范围过滤；本轮独立引擎探针使用settlement单独，未重复跑全部peer组合/6模块/中性consumer。可选peer行为、真实foraging未装与后续整合仍须如实分列。

occupied replan实际绕路/有界cache已验证。BFS每个格只访问一次，调用时临时数组/队列不进入持久根，基础map缓存上限32；无路正等待。它不承诺解决单格门永久被站岗者完全占住的物理局面。本轮没有重跑旧17性能场景或16/64计时。16普通P95、64长段时延/GC、普通窗口实际haul/crop/guard活动仍是指挥/执行者责任；travelDistanceMap spy不足以计occupied BFS，应使用residentPathRebuilds。未把配置角色称不存在，未把预热完成误写为ordinary经济负载，未宣称3072格/满箱/5Z已验。

## 5. 交付与后续关闭

已完成本次只读审查任务，产物全部在full-review根及repro。EARLY-FINDINGS已先写并补充退休tick反例。未修改input-v1/移动生产树、未派代理/commit/push、未运行浏览器/性能/npm全套/test:ext/128/全删除/构建。

本固定候选的FR1/FR2需在最终固定源复跑独立探针关闭；自然seed28路由缺口需补实际正常命令和原录/同SHA证据，UI与性能由指挥接续。本报告保持“早期候选完整正确性审查”的定位，停止，不自行宣布5D1验收或继续生产修复。
