# 5D1 居民、需求和基础在场岗位：任务书

日期：2026-10-08。用户已明确授权继续本地开发；本任务经指挥核对实施前勘察与完整草稿后定稿，作为同一本地执行会话的实施指令。开发、独立审查分进程，发现交原会话修复；指挥最终核验后提交推送。

## 0 维护者裁定与实施授权

本步正式授权完整5D1。采纳实施前勘察§3九项可回退推荐及本任务具体数值，记录为“维护者按用户推荐先行授权裁定”，不声称用户逐条确认。本文覆盖旧5A/C5-1关于每epoch发粮、吃粮归零、所有居民禁止护送、空resident ledger、锁粮永远恰2的旧前提；旧报告的历史结果保持。

- 采用食物每日、住房每epoch各0..3独立欠额，效率取两者max；仅食物3档后再缺一日触发非死亡离开。新人不补交入营前边界，护送仍从home真实粮仓供粮。
- 新候选沿草稿最终修订为友好、留驻的真实单格actor；不新增外交或NPC装备系统。招募保留原生救援完成后的实际实体/战利品图，不重造救援已落物。
- 本步新自然模板、种植床/种子/作物数据、有限来源、岗位与班次建议按文内执行；种植床是生产家具，不是DEV测试fixture。机械低光阈值必须先明确当前光照量纲，在配置/报告写出实际采样与换算，不能拿UI亮度/屏幕颜色当规则；低光/水源不具备时给真实停工原因。
- 5D1必须有日粮离层/护送一致性；不实现5D2厨师、猎人、完整离线岗位生产。基础种植与真实搬运在场必交，途中取消/失能/离队的退款与唯一归属不可延期。
- 版本采用foundation11、world5 schema2、settlement module/rules1.1.0/state2；九冻结/fgfixture不变。whole-run6、recording4/origin2保留，除非确需原生实体字段再按任务明确升号及归因；优先不新增此类字段。
- 性能验收收窄：本步必须测16居民在场新增普通P95、64人口预算/GC、64居民代表性长需求结算与边界。最大3072结构格/满箱组合的全面压力、完整体积矩阵归5Z；不得把未跑的最大结构负载写通过。64代表性长结算目标≤50ms、普通新增P95≤5ms；固定样本/设备/源码，失败如实修复或交指挥裁定。
- 现有5G原交付和返工树保持隔离；当前实现不含生产foraging。将来5G合入需按本次新格式重验，旧foundation10录像不能作为foundation11新证据，责任由指挥接续。
- 生产/测试开发由本地Codex CLI执行；每个内部里程碑写外部状态与progress，不到最终报告才披露缺项。子进程不commit/push、不再派代理；最后交独立审查、resume修复和指挥浏览器核验。此授权不要求日常可回退决定逐次询问用户。

## 0.1 独立合同检查后追加裁定（F1/F2）

以下为指挥采纳的明确语义，优先于正文任何概括说法。见 phase5d1-contract.review-findings.md；这里只关闭合同歧义，尚不证明实现或测试通过。

**F1：劳动与端点。** 每次正耗时推进采用半开区间[t0,t1)。劳动只计算此区间内已接受种植阶段与work班次的交集，按各子区间当时的效率累加；在住房epoch、日界、班次和实际资格事件处分段。整数公式q=floor((r+dt×eff)/100)、r=(r+dt×eff)%100；只有唯一bundle elapsed来源记一次，镜像、finish、selector不再次记dt。切步或有限分段均可，不新建第二调度器。

到端点b，先封存此前已赚取的信用，再处理b的FOOD、住房和生命周期；随后提交仍合法票据的完成及同刻入箱，最后选择新动作。恰在work结束达到1000有效tick的票据可完成，不因新班次rest或新效率下降追溯抹掉劳动；真实死亡、离队或中断仍取消。同刻搬入粮仓的FOOD在该日界消费之后发布，不反供本次日粮。

未完成票据遇rest/watch或效率0时暂停，保留同一票据/escrow/信用余数，不产出、不再取种子；恢复后下次合法native决策续同票据。显式取消或既定中断退款并销毁该票据信用，不迁给新单。只使用合法现有SDK状态及必要内部生命周期校验，不以“暂停”为由另设可写倒计时。每格日限額按成功产出端点floor(b/32000)登记，同格竞争用真实预留/CAS只完成一次。无自动新批次授权。

**F2：事务起点。** No、报价/CAS拒绝和尚未接受的纯准备失败，与提交前机械快照比较，零耗时/规则RNG/ID/物化。需求提交、完成/退款、死亡/离队清理和entry故障，则分别捕获其最外层同步事务入口；完整恢复该事务写集与对象身份，不倒退该入口之前已付的原生时间或合法原生效果。entry必须以外层entry检查点为准。

若worldClock已到b后日界需求事务失败，保留已到b的时钟与既有elapsed状态，回滚未成功发布的粮/需求/退役效果；结清b之前不继续新信用、产出或自由决策。完成失败按已有策略取消退款或明确中止推进，不把已付命令假作未付而重跑。退款自身失败须回滚退款事务并暴露失败，不吞异常。报告明确每类故障oracle所取检查点及恢复范围。

补充：闭式需求结算在离开释放床位后，按FOOD→住房顺序重算资格，不只改粮食分母；无床活居民是合法住房短缺状态，codec拒绝“所引用床不存在/非法”，不能把bed=null全部拒掉。

## 1 固定身份与边界

工作树 `/Users/coolking70/Documents/同步空间/BrogueJS-p5`，`ext/phase5`，开工固定 HEAD `769f6fc18aad4881bfcc8d2170de84cfd319e4e8`，5C1已验收代码5dbeb32。实施先复核身份/干净程度并保留用户已有改动，不切分支、不commit/push、不派代理。先读本轮preflight、AGENTS及项目必读文档、ext README/commander、联合设计、foraging §7/10/12.4、C5-1、5A4 §8、5C1 task/report/acceptance/config、progress。

5D1授权范围：settlement单独自生及真实救援招募，床/粮/人口资格与确认，驻留/带路/回营，真实日粮/住房/饥荒离开，最小在场种植/搬运/守卫，完整生命周期/严格存读/真实命令录像及UI。所有5D1小步最终必须联合闭环，不能以类型、planner、UI按钮占位或待5D2为整项交付。

明确后置：5C2 site；5D2厨师、猎场、完整农田系统、离线岗位产出/供应链/补给单续工与crafting配方居民订单；5D3叙事随身交互招募；5E袭击；5F/worldmap/Worker/5Z。5D1仍须需求跨离层/护送分段一致和长离场耗粮，不能把这部分后置。

5G新返工基线 origin/codex/phase5g-revision-base=db50a84511dde0b0196f8b182205b9ea70086ef3，原dot ext/phase5g=0fb2720；本P5没有foraging。禁止修改任何dot树/分支、foraging目录、9冻结文件或整个fgfixture树。冻结列表/当前SHA见preflight §4；允许读冻结声明，新增生产可信能力使用独立入口，不以SDK冻结为由绕world/实体状态所有者。与5G将来整合的格式/trace重验由指挥负责，不改其golden。扩展新政策优先旧CE，门禁按本任务。

## 2 可玩闭环和具体决策

### 2.1 玩家实际路径

仅settlement、normal新局 → 原生探索取得第二份天然FOOD → 正常采建材/建营、存两份锁粮 → 建合法卧室床和箱 → 看见本包原生候选或真正解救俘虏 → 邻近确认招募 → 同一个actor成为驻留居民 → 派种植，观察走到种植床、种子消费/计时、真实作物入箱 → 指定源/目的箱搬运，观察同一Item在真实脚程后转移 → 指定守卫点，和平回岗/危险按原生战斗 → 指令带路、真实楼梯跨层、回营驻留 → 日界锁粮优先真实消费，粮仓不足降效率，住房损坏独立短缺 → 第四次相应饥荒日非死亡离开 → 清空关联后拆营，只退剩余真实储粮。中途及边界save/load/replay/seek/续录必须成功。

上述生产全部入口可从已有SettlementPanel正常操作，不需要私有Game写入/调试按钮。测试布景独立标来源；自然完整新局录像只准自然准备/公开命令。

### 2.2 有限候选、自生与救援

推荐数据：2个自有普通单格人形模板“行脚人”“园丁”，HP20/24、accuracy80、defense0、damage1–3、move/attack100、无附魔/技能/随机装备/召唤/吸尸；名字及描述走locale。使用真正Monster原生状态/占位/HP/战斗，不用固定world interactable，不用giants群/1格mask。

生产单格模板入口现不存在。新增中性有限声明/可信创建函数，模板由启用模块提供并严格验证（owner、有限整数、单格、字段白名单）；预检形状/实体128/空间512/候选预算/保护格后才构造分配ID，attachCreature和出生事实一次，load不发出生。沿当前生成事务和allocator/reservation；不注册world fixture。不要扩大现有giants nativeForms规则来使任意形态可招募。

推荐有限来源触发：D1首次可信entry尝试1名；D5/D10/D15首次可信entry各尝试1名，总4名。固定模板按depth表选择，无新随机；稳定入口可达距离、y/x排序，避危险/机器/楼梯/现有全部足迹/资源与giants reservation，最多扫描本层2291格，无位留pending一次重试到下次真实entry；两次仍无位记skip，不重生成地图。entry token之外不创造候选，退出/重访/拆建不得补名额。未招募者为友好但未登记居民的真实actor：isAlly=true、leader=null、boundToLeader=false、doesNotTrackLeader=true；和平待在出生附近，不攻击玩家、不要强占owned region。这利用真实盟友关系而不另造中立外交系统，候选自由决策仍需明确等待/原生避险战斗的仲裁，不能让原生盟友fallback把它自动带走；没有来源的普通盟友仍不受此等待政策影响。候选总活跃≤4，独立于人口预算但算活动实体。首次entry记录`sourceKey=settlement.spawn.<depth>`状态attempted/deferred/placed/skipped/terminal与原actorID；40层以内有界，不靠滚动日志判断是否可再生成。

真实救援：捕捉所有共用救援转换的wasCaged=true且救后ally=true事件；freeCaptive、魔法救援等走同一可信登记。普通becomeAllyWith/支配若wasCaged=false不能产生候选；笼内、多格/群、限时召唤、无生命/液体限定/不能走楼梯、departing、玩家/复制体一律不准。救援候选推荐仅kobold/goblin/goblin_mystic/goblin_conjurer/ogre这5个现有类人模板；仍要求实际普通single，无bodyMember，spatial不存在或仅builtin:single/r0；mask/rigid/多格即使外观看似1格也拒绝，模板表不越过当前资格。monkey等动物被救也保留原盟友，不当工人。禁止从任意isAlly推断招募资格。

未消费的救援候选活组件最多64个（与4个自生slot分别计）；达到上限时救援仍照原规则成为盟友，但不再登记新招募来源，并给一次有界来源受限结果，不分配虚假居民名额。终结候选立即GC，已消费source保原actor组件直到终结。救援收据按原actorID唯一；原生救援可以落carriedItem且改变关系，招募基线为救援完成后的完整对象图。招募不得再次落物、补HP、清status/诅咒、重授growth/重造装备、换actorID或复制原actor。报告特别分列救援已有落物和招募本身物品/装备保留；若指挥要求救前carriedItem不落地，另明确改救援语义并补其真实回归，不能暗中捡回/复制。

候选来源GC：只给活actor保source component；自生4个持久slot保terminal高水位；救援actor已终结不复活/不重招，删除其活候选记录；同一活actor招募/解除后source.consumed仍true，不支持解散再招刷初值。滚动128条展示收据不是幂等权威。原生克隆/复活不得继承consumed=false的来源。

### 2.3 招募、床、粮仓及管理命令

招募需当前可见、Chebyshev≤1、有交互线，玩家和目标存活且可行动、无直接已知敌情、目标未忙/未departing，目标与home营地同当前层并在可达region内。必须真实来源、未消费、普通单格资格、home人口<16/全局<64（active/cached/escort/pending均计）、1个可达完好合法卧室床空位，以及至少1份未承诺日粮可用。报价按现有人口预留下次日界需要的库存：当前可用FOOD单位≥home活居民数+1；已锁两份可作此报价，报价不立即吃粮/不增新锁，所有成功后实际粮耗仍按日界。No/陈旧/无位/不足/非法/忙态0成本；成功100tick，付时正常危险/饥饿继续，前后不补HP。

床合法性：底座computeRooms真实完整屋顶房间、bedroom标签、camp内完好bed、至少一邻接合法工作位、从home内可达且无直接已知危险。Component ID是床身份，room ID不持久。稳定分配：保留仍合法且唯一的已有床；无床居民actorID序，空床componentID序；一床一人。床/墙/门框/屋顶变化立即失效并重新分配，不删居民。驻留、护送仍可保home床；housing资格衡量home可用住所，不按actor当前是否睡在床上扣额。

粮仓=marker.supplyId常在集合 + 玩家显式标为粮仓的本camp箱。只真FOOD ration_of_food/mango各quantity1=1份，MATERIAL作物/可食世界菌均不算日粮。非粮仓的FOOD不算；禁止隐式扫玩家包、邻营或全层箱。标箱/取消标箱仅本层可见相邻可交互、实际camp权限与revision；supply不能取消。箱毁坏清粮仓引用并先按既有残骸保物品，残骸不自动成为粮仓。空箱撤销/同一箱不得属两营；玩家额外未锁粮仍能正常取。首锁两份消费后不会自动补锁。

新公开`ext:command` action推荐：`recruit`、`set-residence`（stay/escort）、`return-home`（同层真实到home范围才完成stay）、`assign-job`（idle/plant/haul/guard）、`set-schedule`、`set-granary`、`dismiss-resident`。管理只修改未来计划，0tick不赠信用/产物/重置欠額；涉及取消在途工作必须同事务退款且取消已接受未来阶段。recruit/dismiss各100tick并原生确认，No为0。escort/stay/return管理0tick，真实移动由actor自己正耗时。没有远程回营瞬移。

payload新命令v1：严格owner/action白名单，stateRevision、camp regionId/revision、目标candidate/residentRevision；粮仓/岗位补真实box/component revisions、所选itemId/quantity及inventory stamp（触物命令）。目标actorID是被操作对象，不授予玩家指定行动者。所有真正状态输入经game.executeCommand；只读显示/选择/预览0时间0RNG。成功发布后旧revision变陈旧，同一个source只消费一次。

### 2.4 日粮与住房：唯一双轴模型

唯一时钟world5.simulationTicks，epoch=1000tick、dayEpochs=32、dayTicks=32000tick，日界绝对floor(t/32000)变化。加入/归属、床/粮仓/实际供应等资格变动先纯规划旧区间，在成功的同一事务中结到当前时点再变更（拒绝/No不偷物化），再添新人；新人不承担入营之前的边界；加入32000之后第一次发粮64000。日界与住房epoch同刻按“上一阶段可用物→FOOD→住房→本段劳动资格”处理。

home ledger唯一保存每居民`foodShortage:0..3,housingShortage:0..3,unfedDays:0..4,departed:boolean`；`shortage=max(foodShortage,housingShortage)`为只读派生，若接口要shortage字段则仅投影，不第二份可写持久值。组件仅引用这些值，不再复制欠额。alive由真实actor生命资格验证，终结清活行。

每日home内actorID升序各取1份真FOOD。全局多营home按slot升序；单营库存顺序：仍锁定单位优先（按itemID），随后其他粮仓按containerID、其中ItemID升序。相同堆先消费锁定前缀，不拆新Item、不分配ID；quantity−1、清空时从container.itemIds/worldContainerItems删根，并同事务减少/删除对应lock、增consumedLockedUnits、revision/收据及needs。初始剩lock+consumedLockedUnits恒2，0..2；多出的可取数量不因消费错误变锁定。部分堆、口粮+芒果、合并额外粮、最后一份须真实对象核验。

吃上foodShortage=max(0,old−1)，unfedDays=0；缺粮foodShortage=min(3,old+1)，unfedDays=min(4,oldUnfedDays+1)。**仅当发粮前foodShortage==3且本日再次缺粮时离开**；初值0连续四次缺粮即离开，3档吃上一日退2后下一次缺粮到3并不立即离开。住房与食物相互不覆盖。

每1000tick边界住房合法则housingShortage=max(0,old−1)，不足min(3,old+1)；其与食物取max作为劳动效率100%、50%、0%、0%。2/3档可避险/带路/归位/守卫，不做种植或经济搬运；床不足从不触发departure。床刚修复后不立即把housing清零，随后三个满足epoch逐级恢复；FOOD充足也不能掩盖住房短缺。

所有在场/离场/护送使用同一needs transition和FOOD消费口。推荐真实推进的经济安全点按due home处理需求，包括cached home；只结需求，不跑离线jobs/生态。跨日时先完成该边界需求再允许后续job信用/发新batch；native动作内跨日也不能先按旧效率算下一段。实现可在worldClock elapsed已提交后的安全阶段接需求结算（只读取时钟，不再加delta），或客观块到期阶段，但要证明工作完成/新决策与边界一致；不能只挂finishTurnEpilogue造成busy批次先越界生产。入层和有效机械触及home确保欠区间结清；UI/load/seek读取不结算，seek真实命令推进仍正常。

极长区间不是迭代全部day/epoch：生产最多有限已付阶段，住房最多3次达到饱和/恢复；按库存整轮、末轮actorID余粮、个体短缺/离开阈值跳跃，移除离开者后重算分母。原生箱64槽/FOOD按quantity占槽，供给有限，但算法仍不得按经过天数循环。独立测试参考迭代器只迭代短区间，超长用边界/解析守恒校验；生产闭式不作自己的参照。需求revision按跨过的规范epoch/实际资格事件前进，不按plan调用次数前进；消费/离开事实以绝对边界tick和actor/source为identity，不能每次分段额外写一条机械收据。新增需求提交的world计数也按规范事件数而非补算调用数递增，空区间不递增。每区间全部余数/高水位/锁/库存/需求/离开收据满足S(t0,t2)=S(S(t0,t1),t1,t2)。

### 2.5 在场岗位、信用、班次

三段32epoch日程推荐：work16、rest8、watch8，绝对simulationTicks phase，0tick改schedule只改未来。自定义三段均≥1且总32；明确处在rest/watch时不生产。guard岗位在work/watch值守，rest待床旁；所有阶段危险/战斗优先。escort期间岗位挂起，不产信用。缺属性模块效率基础1，不接growth工作加速/XP。

本步**基础种植**：自有可建“种植床”fixture，wood2+fiber1/300tick/HP100，seed/crop为MATERIAL、crop公开tag food.ingredient.crop。单独settlement新局一次有收据给6种子，无FOOD赠送；床在camp合法稳定地面、邻近已知稳定水源（距离≤2的浅水/水源资格，非危险水格）和低光条件（采用可信机械光照阈值，推荐≤0.4，规则指纹化），不要求site。床最多每营12格、每农夫最多6格；指定箱输出，箱满不种。玩家先把种子真实存进所选同camp源箱，NPC不能从玩家包远程抽取种子。第一批一格耗1种子，不自动自繁殖，最多每格每camp日1作物；下一camp日再消费种子。

真实动作：actor走合法邻工作位；预检种子/输出槽并预留；1000实际有效劳动tick完成一批出1作物；记录plot的本日已完成高水位，种子在正式票据escrow，取消退未耗份，产物在真实container里，不能UI改数。效率50%需要2000实际劳动tick；以elapsed×效率分子/100及余数计credit，移动/失败等待/rest/guard/战斗均不授种植信用。尚未完成时受伤/失能/离营退款、保本单确定状态，不被0tick改岗位续工刷。种植票据使用同一native bundle唯一倒计时；若信用实现需延长计划时长，写清安全整数/余数、不可在bundle外再次累计时间。本步不给离线种植产量；完整农田/自动续种/猎场/灶台在5D2。

**搬运**：玩家明确选择同camp两固定箱、真实ItemID及quantity（一次至多1个非堆叠物或材料/粮≤8单位），不能搬锁定粮、不自动搬未见地面资源。source→actor carrying的中立真实escrow→步行destination→入箱。每居民一个hauling ticket，出发时预留输入和目的仓容量/退款位置；取货/放货各耗100tick，步行每次原生moveSpeed，ID保留/部分堆拆分沿底座。不能把两个箱扣加数瞬间叫搬运；运输中的物品只有一个owner。目的毁坏/满仓/演员死亡/离队/取消，按预留原源或refund/remains安全回收，携物不能被隐式销毁，输出空间释放与终结一次。无跨层搬运，本步离层取消并退款，不暗中离线兑现。

**守卫**：指定camp内可达安全格/完整逃生；和平真实走岗/返回岗、站岗正moveSpeed等待，不随玩家远走；actor实际可感知敌情进入原生攻击/移动/撤险，有combat时共享其招式时序但缺席仍能普通战斗。无离层战斗、防御分/额外袭击/复制伤害公式。只读视图可列当前状态/停工原因。

所有自由行动统一：底座busy/失能门禁→原生一次prepareNativeDecision→原生避险/感知战斗优先→居民当次工作/移动/等待→native fallback。必须提取/调用能判断原生优先行为的窄部分，不能先跑takeNativeDecision整段再跑job；有已知敌情本次只native/combat，不从native回来的timer再“补工作”。PhasedAttackProduction单selector仲裁，无combat时同样绑定foundation clock；不能settlement另装provider/scheduler。每个handled/blocked置正timer；忙态只dispatch已接受bundle，prelude/信用不双跑。路径按真实cellProperties/门/占位，最大79×29；每次受阻最多一次重规划，仍无路本次正等待，缓存按层/结构/源目标修订失效，不每帧寻路。

## 3 共享窄口、单一权威和回滚

新增建议 `ext/residentSdk.ts`（命令/只读DTO/有限政策，不导入Game）与可信 `Core/ResidentProduction.ts`、`ResidentNeeds.ts`/`ResidentJobs.ts`。名字可调整但责任不合并成content任意写Game口。runtime新增有限声明/读投影和内部组件替换方法；模块只能数据/只读prepare，可信adapter经owner和scope选择真实定义/箱/actor。`prepareTrustedWorldWork`当前DEV+fixture不改成对任何内容公开的生产后门；新增NPC prepare需active NativeActorDecisionScope。

权威分配：

| 状态 | 唯一位置/约束 |
| --- | --- |
| HP/坐标/装备/背包/status/leader | 原Monster/Creature/实体图，不进settlement state或ResidentRecord副本；当前普通Monster只有carriedItem战利品与原生伤防等字段，没有Player式Inventory/装备槽，保持其全部已有字段/组件不等于新增NPC装备系统 |
| home归属和人口 | world5.residents，索引actorId/owner/slot/homeLevel/camp实例标识；与真实component双向严格引用 |
| 来源/岗位/班次/床/escort模式/job票据引用 | settlement:resident组件；候选来源单独组件/有限source receipt；home key为被验证引用，归属修改只经同一事务 |
| food/housing欠额及日/epoch物化边界 | home OfflineLedger residentStates唯一数值根；组件和UI只投影 |
| 各job实际输入/产物/物流携物 | world5 ticket/container/escrow roots、worldContainerItems真实Item，不另存quantity |
| 首锁剩量/消费守恒、粮仓选择 | CampRecord.locked+consumedLockedUnits/granary IDs；锁数量是权限引用，不是库存 |
| 房间/路径/FOV/最后报告 | 房间/路线派生；最后报告有时点且不可消费，不因UI打开更新 |

新生命周期事务必须覆盖active/dormant/cached/pending/purgatory、world5索引/ledger/orders/tickets/escrow、actor components、module state/source receipts、action roots/resources、运行期need due/session缓存、物品图/装备引用、ID分配器、RNG、logger/事实/dirty标记、房间/路径/渲染/录制origin。`checkpointWorldWork`和`checkpointStructureWorld`不是自动覆盖证明；新增显式写集并更新generation checkpoint。测试用独立完整对象图oracle，故障后核对身份/引用/Set/Map，不仅toSnapshot投影。

recruit发布顺序：完整纯预检/报价→原生confirm→再次纯预检/CAS→world事务写归属/组件/需求/source消费/床→resident-status能读true→最后triggerActorNeeds(resident-changed)→成功事实/耗时。解除归属先取消订单/退款/床/job/锁涉及引用、删索引/组件/活ledger行→queryfalse→若为离开先beginDeparture/retireActor→同事务末对仍存在的真实actor触发resident-changed。普通资格解除后仍活且未离开的盟友可获得同伴需求；离开者不得在末尾再挂需求。Core/ActorNeeds现有挂载已检查!isDeparting，应保持并验证；同步retired对象不再触发新挂载。不得以actorDeparted hook事后清人口，它可被降级吞错，不能承担守恒。

饥荒离开：在日界同事务完成全部该actor资源清理和唯一source/离开收据；在场可见用visibleGraceTicks=300（与5A4例子一致）非敌对向楼梯离开，不攻击，不再工作/喂食/招募；不可见/离场grace0同步退役。不死亡、无kill/XP/deathDF/复活池；HP不被清0。beginDeparture需扩展可定位真实非活动carrier，而retireDepartingActors必须把物品落该carrier层/pending同层物品根，不能放当前this.items；携带乘客若需释放也归同一个真实carrier层，不塞当前monsters。满地保既有refund/remains路径。不要临时把cached actor塞active数组做退役。

| 生命周期触发 | 本步具体处理 |
| --- | --- |
| 死亡/原生永久移除 | 在同原生死亡事务清居民、床、订单/预留和退款，释放人口；保死亡来源终结事实；原生死亡/掉落仍只一次 |
| 失去盟友、支配解除/变形不合资格 | 先清居民经济/岗位，alive actor保真实原生新关系；notify resident-changed，不强改回盟友 |
| 临时混乱/恐惧/失能/硬直 | 停当次job/取消需取消票据，保身份和需求；原生危险/耗时照常，不能靠休眠免日粮 |
| 坠落/击退/换层 | 清/挂起在场job与退款，保home人口/需求；pending落地顺序与需求结算正确，不能新增一份居民 |
| dismiss | 确认100tick，原子解除经济后非死亡离开；无再招来源重置 |
| 拆营 | 本步沿5C1严格拒绝有活居民/订单/预留的营地，要求先显式解散/清理；最终retire只清空根并退剩粮，不默默退役人/吞料 |
| player game-over | 冻结全局，不补结远方需求/离开，不继续job；保终局回放 |
| load/seek/new game | 候选验证所有引用/版本后才换live；load不调用招募/需求生产，失败旧player/runtime/RNG/对象身份不变；seek重走同录制命令并清UI草稿/旧selector缓存 |

### 3.1 护送旧合同精确修订

C5-1 §3.5“所有world5 resident排除follow”改为“stay及不合资格resident排除；明确escort且原生楼梯资格合法者允许正常schedule”。departing仍排除，movementRegion hard bind照旧；居民不默认movementRegionId绑定camp。只楼梯护送，玩家坠落direction0不把整队免费传下去，真实居民自行坠落沿pending。

`monstersApproachStairs`管理层整层冻结改为仅放行匹配已授权escort、存活/可行动/leader与原生资格合法、已安排真实stairs方向的居民；其余actors/倒计时生态仍冻结。迁出前先结home需求至当前时点、取消在场job/退款，目标层需求/离线结算先于跟随落地；同一actor只能source cached或target active一处，无位保持source倒计时1和原物品根。place/entry notify SourceChanged后重建实际resident read，不改home坐标。

escort时人口/床预留/home日粮持续，query resident=true，foraging无组件。驻留取消尚未迁出的entersLevelIn/approaching；在别层不能把模式设stay来假装回home，必须保持escort或明确在同层可达新camp经转籍（转籍本步可不出按钮，严拒跨camp payload）。回营在真实进入home范围后return-home切stay，再认领岗位；无位/失能不传送/复活。

## 4 状态、版本、codec和离线DTO

推荐一次分配：foundation **11**、world5 **schema2**、C5-1经济合同 **1.1.0**、settlement module/rules **1.1.0**、state **2**、居民新payload **v1**；现有结构命令payload v1保持，因为其外壳没变。worldSdk1/edibleSdk1不改。whole-run **v6**、recording **4**/origin **2**、IDB2可保留：新增状态在已版本化world5/组件/模块根，manifest foundation精确拒旧档/旧录像，无新增Item/Creature字段。若实施确需新的原生字段才whole-run同步升7，必须在报告逐字段说明，不抢多份子里程碑号码、不迁移。

具体DTO修订（非冻结worldSdk的新增可信resident经济入口）：

- OfflineRules增dayEpochs=32，食物分子100/50/0/0、efficiencyDenominator100。保epochTicks1000/maxPlanEpochs32，为5D2留工作寿命；本步生产offline订单不给产出。
- OfflineResidentState以foodShortage/housingShortage/unfedDays/departed替旧可写shortage，真正终结行由提交GC；alive如保留只能和真实资格一致。deferred departure plan中departed=true为过渡结果，commit后删活行并写有界receipt，不把dead/departed历史永久占人口。
- OfflineFrozenResident增真实bed引用/bedEligible、物理是否home/escort模式的有限资格投影；facilities用真实结构有限DTO替never[]，无HP第二权威（输入快照只读），结构revision/房间资格来自底座。
- OfflineInput schema2，加入显式粮仓集合、锁引用、原生FOOD的ItemID/consumableId/quantity有限读形状和实物/CAS签名；不能以definitionId!=null推断天然粮。所有来自真实已启用规则/根，不信存档自带规则。
- OfflineEffect新增`ration-consume{containerId,itemId,quantity,lockedQuantity,atTick}`与`resident-departure{actorId,homeInstance,atTick,reason}`。item-delta仍用于已定义材料，不能拿它匿名消耗FOOD。
- OfflinePlan增严格contractVersion=1.1.0并携next needs ledger和有界消费/离开效果、输入digest/version/区间/sourceRevision，一次性或同结果幂等；生产commit校验真实所有权/数量/locks/人口/source/camp ordinal，必须显式支持这些效果，不能传fixtureEffects=true绕现在C5_UNSUPPORTED。
- CampState2增grain storage refs、consumedLockedUnits及有限候选source slots/收据；locked剩0..2且初锁守恒，报告只读。
- world5严格校验bed/facility/真实resident/组件、camp实例slot ordinal、活名额和source唯一；只有本步确实用的orders/tickets结构才开放（订单引用真ticket），不一口气放开全部pendingOutputs离线生产。

更新ext/world5根validator、WorldWorkValidation、StructureProduction真实camp校验、runtime module component/world validation、WholeRunSnapshot候选验证及recording dirty/digest contract。新Game持久字段若有登记U03；优先复用root避免Game再存resident数组。与fixture旧rules/state的适配在非冻结fixture/中性可信层更新，不改9冻结和fgfixture。

黄金/基线：生成候选或新种子/规则有影响时跑完整npm drift；任何golden差异先列字段/原因和单变量归因，再用原捕获方法重录允许的本地基线。纯foundation字面量/新world字段的差异也必须报告，不能静默flip。不改foraging或dot golden；后续5G整合升版/fixture/trace责任指挥登记。新自然录像与受控save-origin录像分别保存。

## 5 UI与输入

继续SettlementPanel同一抽屉，增加居民和岗位页/概况粮仓卡，不另开全屏管理器或物理输入屏障。居民卡显示姓名、驻留/带路、床位、食物/住房短缺、实际岗位/停工原因；选中才展命令，避免宽表。招募页只列真实可见候选和当前camp可用床/粮/名额，距离/危险不足给普通中文；不向玩家暴露SDK/schema/actor scope/codec/seed/事务栈。

岗位选实际目标格/床/种植床/源目的箱/Item和数量，复用map selection +轮廓；不从未见格泄漏候选/岗位对象。粮仓标记和source选择直观；日粮显示下一日界/可用份数/锁定剩份，远方只上次报告时间，不UI结算。不能误写“6周期粮”沿旧每epoch发粮解释。

所有中文i18n；仅用已有DialogService/DialogHost/DialogInput确认。ACK/展示忙保持旧DTO并暂停显示队列，不偷取下一帧HP/粮量；当前输入/背包/modal/canOpenPanel gating保持5C1 R2修复。表单键不漏到地图，抽屉外原生移动/DPad仍可用，带路不因打开面板瞬间走一格；关闭/blur/load/seek/session替换清选格/草稿，已付动作自然推进。

1440×900、390×844、320×844 ×普通/沉浸×original/refined/hanzi/tiles共24行，本步实际固定build验。长名/0/16居民/无床/缺粮/岗位长原因用卡片换行/原生滚动，不横向溢出；触摸≥44px，地图与人物/危险/预警保持可见。真实手机另列，不拿hasTouch等同实机。

## 6 具体测试、自然路线和浏览器准备

### 6.1 仅相关门禁

所有最终命令前置Node24.19.0 bin，`NODE_OPTIONS=--max-old-space-size=3072`，Vitest最多`--maxWorkers=2`。最终一次同SHA：新增/修改及直接受影响相关Vitest → `node scripts/check-module-boundaries.mjs` → `npx vue-tsc -b` → `npm run build`；顺序可为快速定位调整，但最后结果准确记录。涉及候选生成/种植结构或地形读点跑**完整npm run test:drift**。不ce:fetch/full/gen，不完整npm test/test:ext/128组合/完整删除/5Z。旧前提确需改先单变量反事实，只改前提不放宽assert/超时/skip。

新增settlement自有测试建议按主题分文件并登记自有test-suites：resident_sources/commands/needs/jobs/escort/lifecycle/persistence/ui/natural/performance。底座测试只用新中性resident fixture/抽象声明（独立于fgfixture和worldHarness），不得硬引settlement/crafting/foraging。相关既有至少：ext_world5_offline/clock_levels、world_work_transactions/failures/boundaries/review/sdk_contract、actor_actions_root_world、actor_needs_runtime/departure_runtime、generation_checkpoint_differential、结构transactions/properties/protection/review/source_guard、u_03_whole_run_snapshot/u_03b_level_travel、recording_v4_digest/snapshots/storage、u_27/x2a/x3b/ux_1d_recording_continuation；UI改动加ext_canvas_input/module_ui、dialog_service_input/dialog_host、settlement原有输入/UI/相机/库存/自然/persistence、i18n/hygiene/membership/U03守卫。实际清单依据最终触碰读点裁剪并写报告，不拿清单名字当已执行。

| 证据组 | 必须真实断言 |
| --- | --- |
| 来源 | 独立settlement真实自生entry一次；无位延期/skip、不分配ID；真实键盘/移动救援确认No/Yes及魔法救援来源；支配动物/笼内/群/限时/重复/克隆不招；原actor object/ID/HP/status/装备/物品根保留 |
| 招募 | 床/粮/16/64/实体128/空间512/visible/line/unsafe/busy/CAS/No；非JSON/getter/多余键/伪actorId；所有拒绝完整机械/双流/ID/时间不变，确认录一次 |
| FOOD | 0/31999/32000/32001边界；actorID次序、2份锁优先、口粮/芒果、部分/整堆/额外合并；消耗量守恒、不复制ID、不吃非粮仓/菌/作物、锁全部入口不能取；撤营退剩0/1/2 |
| 双需求 | 食物0→1→2→3→leave，第3档吃上退2再缺到3不立即leave；住房每epoch+1/−1且不leave；max合成100/50/0/0；招募/改班/修床不能重置；分2/17随机段、home/escort/cached输入同最终值 |
| 长尾 | 多居民余粮导致actorID公平结果、离开后分母变化、无food/满仓/10^9tick/安全整数边界、0跨度/重复plan/stale；短reference对比全部余数/锁/库存/receipt/高水位，长跳不按天数耗时 |
| job真行为 | 无combat第一次native自由决策可开始job；activation/prelude计一次；busy0次额外prelude；种植真实走位/种子escrow/定时作物入箱/50%实际耗时/当天限产/缺水低光/满箱；搬运原对象source→在途→dest及每步正耗时；守卫和平回岗、真敌情只原生战斗；失能/恐惧/麻痹/硬直/死亡/危险优先 |
| 护送 | stay不follow；escort从管理home真实stairs迁出、cached倒计时可推进；无位留source不双owner；跨2层/反向/取消/回营/坠落/pending、home粮耗仍持续且foraging资格不重复；不是改depth/瞬移 |
| 生命周期 | active/dormant/cached/pending/purgatory完整终结与原层落物；death、ally-lost、polymorph、dismiss、starvation、camp retire、game-over；源高水位/退款/床/job/locks/人口/need组件GC，反复64名额复用而收据≤128 |
| 失败原子 | 在source/组件/索引/ledger/锁/Item删除、refund、departure、落物、事实及entry后半段逐点throw/Promise/非法返回；独立全对象图/ID/双流/logger/dirty/缓存/动作根恢复，不能只有保存投影 |
| codec | 坏schema/foundation/rules/camp ordinal、缺bed/duplicatebed、孤儿actor/source/ledger/order、双Item owner、伪锁/粮仓权限/负/unsafe余数，在退休旧live前拒绝；load不补粮/生成/招募/离队 |
| 录像 | 真新局源头记录招募→jobs→escort→日界/离开，逐条replay0OOS、跨边界seek、saveOrigin读档续录前缀不重写；受控布景单列from-save可回放，不声称完整自然新局 |
| UI | 正常入口No/Yes、忙态/modal/ACK/背包关闭重开、非模态键/DPad/blur、显示读时钟/规则随机/库存不变、旧展示帧不泄漏未来粮量 |

模块组合至少settlement独立、+crafting、+combat、+giants、+growth、+narrative及本树6模块实际全开；每行含真实居民命令/需求、save-load/replay/seek/续录，不仅start/wait。按installed descriptors解析可选peer；缺peer时单模块和中性软查询消费者仍必跑，peer-specific测试不硬import不存在目录/不以return当通过；registry发现缺席结果明确报告。生产foraging未装故本轮不宣称真实foraging+settlement已测；用中性需求consumer读取resident-status，招募同事务移除/解除后恢复需求以验证协议。将来真foraging整合重验归指挥。

### 6.2 性能与预算

固定预算：营地8、单营16/全局64居民、自生候选最多4/未消费救援来源64、层实体128/空间512、每居民1ticket、营地32orders、种植床12/每人6、每营16箱/箱64槽、world既有8192−1024 C5新增Item余量和7168自有读档根，receipt128；source高水位与slot ordinal不会因日志滚动归零。相同原生装备无新增root；部分搬运stack拆分先验预算，退款预留/残骸不能临时因预算吞物。

比较相同种子无居民/16居民在场320正耗时命令（32预热），普通新增P95≤5ms，256 full摘要峰单列不含在ordinary内；64居民代表性长需求结算目标≤50ms，新增持久状态与whole JSON记录真实UTF8/冷暖/设备/样本；最大8camp/3072结构格/满箱组合及4MiB/32MiB全规模体积上限验收留5Z，本步不冒称已跑。基础job至少记录path重建次数、credit/票据数量；cached需求不跑每tick或全actor每帧扫描。性能不达标先修写集/缓存/有限算法，不跳真实事件/减验收语义；Worker既有债务单列后置。大证据/截图全部仓库外。

### 6.3 自然命令路线准备与浏览器

应用develop-web-game技能已有脚本，`WEB_GAME_CLIENT=/Users/coolking70/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js`，action_payloads参考同目录references/action_payloads.json。已有GameCanvas公开render_game_to_text/advanceTime可用，不新建production调试入口；advanceTime只推进显示帧，不把墙钟当日粮游戏时钟。

先复用5C1自然seed28/natural-route.json仅作为“取得天然双粮→建营”候选起点；新自生actor会改变占位/AI/RNG，**不能假设原76步仍成功**。实施后仓库外只读侦察天然地图找可达安全房间/水源/候选与可建卧室，正常mode+settlement筛有限种子并记录失败/成功；实际路线只公开move/search/stairs/采集/建造/管理/确认，不能抹敌人/改HP/塞粮/改depth。必要预先规划可读全地图，但报告“预规划、非盲探索”。另找含真实笼俘虏的天然种子并实际救援一次，正常招募；不能仅测试人工new Monster(isCaged=true)算自然来源证据。

自然引擎路线至少完整双粮→卧室床→自生招募→种植/搬运/守卫→真实跨层护送/回营与一个日界消费，保存完整新局原始录像；断粮四日/死亡/满64预算等可用严格from-save controlled scenario分别验证，不用长自然饿死玩家来替代规则测试。浏览器必须关键实际入口招募No/Yes、同actor呈现/岗位真实变化、粮仓标记/锁粮消费、驻留/护送楼梯/回营、save/read/重放一个跨边界片段；受控浏览器载入场景须注明save-origin，不能声称自然完整新局。

先固定同SHA生产build空外部目录/manifest，运行原skill client的小步actions/暂停/文本/截图/控制台；实际打开最新截图目检，菜单背景canvas不充当游戏截图。标准canvas读回若黑，按技能有头复跑并用页面合成截图补证据，保原失败。补充公开DOM路线脚本可复用5C1现有driver，但不替代技能client，不强点disabled、不调用私有engine。每重要变化小步再验，UI显示与游戏文本相符。

跑24布局行；关键剧情/操作至少1440普通与390/320沉浸真实路径。每行记录geometry、按钮可达/真实输入、截图、公开状态及产品console错误；代表图必须真正查看，未目检的不能称已目检。长名字/16居民卡片/0床/粮荒/满库存显示夹具可辅助但和真实Game功能分列；hasTouch/真实手机分列。浏览器在受限执行环境不可用时保实际错误/退出码并交固定构建/可执行路线给指挥接力，本项仍未验，不把权限缺失算通过。

## 7 交付表与共享文件清单

建议实施顺序（内部里程碑，不授权以中间停点冒充完成）：A状态/来源与招募原子性 → B双需求/真实锁粮消费/生命周期 → C在场3岗位与单次native仲裁 → D护送/回营/跨层版本持久 → E面板与自然公开路线 → F同SHA限定门禁/浏览器/报告。每一步及时写外部状态与progress追加；最终全部必做闭环完成后停止等独立审查，不自行提交。

| 交付 | 位置与验收要求 |
| --- | --- |
| 实现 | settlement自有schema/data/state/commands/component/projection/UI/locale/tests，生产resident入口/needs/jobs/生命周期与跨层适配 |
| 设计/合同同步 | C5-1经济修订、settlement-config、报告/README准确状态；仅实施阶段写仓库，不在本preflight写 |
| 报告 | docs/ext/phase5d1.report.md：任务逐条映射/文件符号、推荐决定、版本逐字段、真实测试命令/exit/数量/耗时、失败/反事实、冻结hash、自然/controlled/UI界限、性能和未验边界 |
| 外部证据 | /private/tmp/brogue-commander-20261008-5d1/ 下新目录，保命令/原录像/哈希/截图/采样，不覆盖5C1或dot原始证据 |
| progress | 保Original prompt原行，只追加实际工作/未验/下一步；不删旧事实 |
| 结束 | 简短中文交付，停止等指挥安排独立审查/resume，未commit/push/合main/foundation |

允许且必须按责任最小修改的共享文件类别：

- 新ext/residentSdk及中性严格schema；ext/types/world投影声明、runtime有限配置/组件/查询入口、descriptor FOUNDATION_PROTOCOL、world5 DTO/validator。structureSdk CampState2及constructionSchema camp字段适配，但保既有WorldWork/edible frozenSDK字节。
- Core/Game（命令接线、真实救援来源、单次决策、生命周期与carrier适配、生成/离层/落地）、GenerationCoordinator/checkpointGenerationWorld、TimeCoordinator（需求安全点，时钟只加一次）、PhasedAttackProduction唯一selector（无第二scheduler）、WorldSettlement的新版needs规划/commit许可。
- Core/StructureProduction（state2锁/粮仓/非空ledger）、WorldWork/WorldWorkWorld（生产NPC scoped准备/原生FOOD可信consume/真实搬运预留）、WorldMaterialTransfer继续锁权限、WorldWorkValidation/EdibleValidation相关引用；ActorDeparture/Core ActorNeeds（非活动actor/资格触发，同事务清理，不改ext/actorNeeds.ts）。
- entities/Monster必要原生priority拆口与居民当次移动/失能门禁；Movement/LevelTravel及Game.monstersApproachStairs escort例外；Map/StructureWorld/rooms失效与种植fixture工作位（不复制地形/房间）。
- WholeRunSnapshot/EntitySnapshot仅确需原生codec字段时改；RecordingDigest/dirty contract、U03/实体字段合同只登记真实新增，不伪造新Game数组。foundation测试/独立中性resident fixture、自有test-suites和scripts共用测试清单。
- UI原则上只settlement自有；GameCanvas/App/ext UI host只有增加合法只读resident投影或复用选格必要时最小变动，保唯一input屏障/5C1 R2。其他模块生产玩法不改，peer测试只适配真实可选组合/版本前提，不能硬引用不存在模块。

禁止shared变化：九冻结和fgfixture、foraging目录、dot分支/树、5G golden/trace、任意仓库外共享5G修改；不能把shared bug藏到module临时复制状态、吞异常、setTimeout延迟清理或fixtureEffects=true。所需共享写集和版本变动在首个生产patch前登记，完成按同一实际输入验收。

重大范围变化若出现（任意形态工人、叙事actor附着、完整离线生产、site、跨营跨层物流、离层生态死亡、Worker/新录像存储算法）列阻断建议给指挥，不暗中扩大。当前推荐数值和有限接口方案可回退，按任务授权先落实并记录，不逐项等待用户。
