# 5D1 执行报告（按用户裁决验收可提交）

## 当前裁决（2026-10-09，立即收口）

**5D1本步按用户裁决验收，可提交。** 父后续负责提交及填写提交号，或由提交记录自说明；本执行者未commit/push，未合main或5G。停止新增审查、浏览器、构建和冻结源，以下旧待验结论均按当时状态保留。

已确证的玩法及存档/录像一致性问题已修复并独立关闭，当前无剩余已证实阻断。V16径向误激活与居民岗位选择问题已有窄回归及独立通过；同值DTO草稿刷新F1独立复验20项通过并关闭。最终浏览器复验仍未完成，不能称全场景通过。

已有结果分版本引用、不累计重叠数：V12正式性能16人净增P95为3.672584ms、64人峰值46.777167ms；final-ui-draft-fix原四文件81项及五守卫38项通过，boundary/types/实际build通过；final-ui-fix实际drift8项通过。父V17既有摘要为四原raw真实回放0 OOS、末9字段相同，同源build与selector准入通过；本轮不重新验证这些结果。 独立草稿结论见外部 `final-ui-independent-review/draft-followup/FINAL-UI-DRAFT-REVIEW.md`；历史失败保留，不改写旧版本结果。

遗留分两类：①玩法/存档录像正确性：当前无剩余已证实阻断；静态5G集成R1是后续集成风险，不是5D1已证实缺陷。②证据/截图/脚本形式及覆盖缺口：最终V17十手势、24矩阵、self955三个完整浏览器场景、真机/原生失焦/截图和完整5Z门禁延期，见[5Z遗留清单](phase5z-remainders.md)。本轮只改文档，仅执行git diff --check，不追加运行门禁。

按用户最新裁决，每开发步骤最多两轮“审查→修复”；第二轮后余项移入5Z。今后只保存结果摘要，不再逐字节封存、多版本重建或追加采证审查轮次；本政策覆盖下文历史封存流程。收口后若新增确证玩法或存档/录像一致性问题，仅做一次修复及受影响测试。

## 上一轮V12限定收口记录（历史，已由顶部裁决覆盖）

5D1限定回归已完成串行复核（原12文件批次exit1保留），boundary/types/npm build/npm drift已通过，V12正式性能两项通过；仍待登记/文档接入差量独立复核、最终浏览器及父验收提交。5G eda3094已验收发布、尚未集成。 此处是唯一当前结论；下文原结果均为历史阶段证据，不能累加或冒充最终浏览器。HEAD仍769f6fc18aad4881bfcc8d2170de84cfd319e4e8，未commit/push、未合5G。

natural/captive/相关整文件与串行复核/types/build/drift绑定2633文件source `15c32d016d8e3b7a88e92d11fad88e4e4b773632cac4f5c507708152237c83a6`，每个命令前后相同；相比正式性能input-v12的00a29c690ae888d75a87d7e2a0f99a68d29e63d2eca297dfe31573dca1c9967a，唯一测试delta为resident_natural.test.ts。本轮单key迁移登记后boundary新exit0，source前后`bc6093b937e869a01362f9e02ca7af2eca5709f773e28aa76f39b1abfb03c810`相同；最终文档接入源与逐文件SHA另封存仓库外FINAL-CLOSEOUT-READY.md。全部生产、其余测试、fixture/资源仍逐字节匹配V12；scripts只有structure-readers.json单key登记，检测器/门禁实现逐字不变。既有types/build/drift成功输入的运行字节未变，按registry任务不重复门禁。Node24.19.0绝对路径/3GiB/Vitest≤2workers，重任务串行。

| 实际限定门禁 | 结果（整文件/包装器，不累计） | 外部证据 |
| --- | --- | --- |
| natural | exit0；2通过/0失败/0skip/0todo | closeout2-natural.report.json / natural.tests.json |
| captive | exit0；1通过/0失败/0skip/0todo | closeout2-captive.report.json / captive.tests.json |
| residents | exit1；130通过/1失败/0skip/0todo | closeout2-residents.report.json / residents.tests.json |
| offline-serial | exit0；38通过/0失败/0skip/0todo | closeout2-offline-serial.report.json / offline-serial.tests.json |
| drift | exit0；8通过/0失败/0skip/0todo | closeout2-drift.report.json / drift.tests.json |
| npm run check:modules | exit0 | closeout3-boundary.report.json（原closeout2 exit1保留） |
| vue-tsc -b | exit0 | closeout2-types.report.json |
| 实际npm run build | exit0 | closeout2-build.report.json |

全部原始证据位于`/private/tmp/brogue-commander-20261008-5d1/implementation-evidence/remainder/`和`final-closeout-continue/`。12文件首批130通过1失败；失败用例有原120000ms门限，JSON仅有STACK_TRACE_ERROR且耗时158.554s。按development§4原门限/原seed/原断言单worker整文件串行复核ext_world5_offline，38项通过；不将复核冒充首批一次全绿，不累加重复项。限定居民整文件选择及理由见selected-whole-files.json；未重跑全npm/test:ext/128集/独立probe或正式性能。

| 任务范围 | 本轮覆盖与余项 |
| --- | --- |
| A 来源/招募 | sources整文件及正常seed3俘虏239/240；四原raw完整回放、23seek含0。No完整零变化、Yes100tick及同actor身份保持 |
| B 需求 | needs整文件与共享reference/时钟/离线：锁粮、双轴、分段长跳、规范退役及失败回滚 |
| C 岗位 | jobs/labor整文件：实际plant/haul/guard、escrow、信用/端点/暂停与寻路 |
| D 生命周期/持久 | lifecycle/codec/escort/fall整文件及正常录像save/load/seek |
| E UI/自然来源 | 英文正常self956/957与两原raw实际完整回放，23关键seek另含initial0（共24）；controlled尾另列。V6/UI44旧显示矩阵仅为历史证据，当前真实Game24矩阵与三关键容器仍待父验 |
| F 收口 | 新boundary/types/npm build/npm drift、V12正式性能、审定配置手册及16段合同接入完成；登记/文档差量独立复核、浏览器、父验收/提交待办 |

### 原自然exit1的单项旧前提修订

原closeout-natural exit1、1通过1失败永久保留。外部diagnosis2在原00a29c源逐原raw输入精确验证，首失配是916零时间stairs_up拒绝；387招募No完整摘要相等。915/916五域native/extensions/world5/actorActions/random、双RNG、时间/位置/HP/库存及inputState不变，Logger发原生“There are no stairs up here.”（turn904、灰色、non-ACK/non-foldable），mechanical nextId79→80；因此knowledge/root应改变。完整snapshot只多日志、相关高水位和非机械savedAt。仅把旧snapshot机械日志加该常量行即可精确重算新六域/root，未用失败actual直接覆盖期望。

正式测试保留No完整零变化，并将916误设的完整root不变改为上述精确五域/机械字段/双RNG和单条完整Logger变化、派生knowledge/root变化；916事件、fixture/raw及后续956/957、完整回放/seek断言均保留。生产不变，依据续行任务无需重跑性能。精确patch/新旧测试SHA/诊断在final-closeout-continue/；固定测试ca09ff32…已由full-review/NATURAL-PREMISE-REVIEW.md独立PASS，本轮不再改测试；该结论仅限测试delta，非全域验收。外部diagnosis首次仅语法Transform失败0项执行，diagnosis2真实1项通过，两次记录分开保留。

### 正式性能记录（五次，保留四次失败）

| 固定输入 | 16人净增P95 ms（≤5） | 64冷+7暖峰值ms（≤50） | 正式exit/两项结果 |
| --- | --- | --- | --- |
| V7 | 67.885542 | 310.606708 | exit1，0通过2失败 |
| V8 | 7.775833 | 111.247709 | exit1，0通过2失败 |
| V9 | 9.073125 | 55.148542 | exit1，0通过2失败 |
| V11 | 5.526667 | 48.510083 | exit1，1通过1失败（16失败/64通过） |
| V12 | 3.672584 | 46.777167 | exit0，2通过0失败 |

无正式V10采样；诊断/profile不计正式次数。V12 control P95=16.778583ms、residents=20.451167ms，64冷46.777167ms及7暖44.110042/42.631375/41.499083/41.060375/40.998583/40.813291/43.254208ms。正式source前后00a29c…相同，父2637manifest SHA828a94ede769034cc80488f28f4cbe14ee5e083618dd2ecd83e65a11dde4bf53；CPU Apple M5/macOS26.6.2/32GiB、Node24.19.0/3GiB/2workers、原320/32及冷+7暖门限未改。原log/SHA在performance-v12-final.report.json。测试前提修订、单key登记及随后文档不改性能生产输入，不把本轮测试source说成原采样的完整source。

### 审定文档、迁移登记、格式和九冻结

原boundary exit1为computeRooms→roomGeometry的已审读点迁移；父在phase5d1-closeout-registry.task.md审核并明确采纳，仅替换scripts/structure-readers.json的8108…→9a11…单key，count/classification/handling/coverage逐字保持，检测器与门禁实现不改；新boundary exit0，原失败和逐条inventory保留。登记与文档接入的实际差量交父后续独立复核。

DOCS-REREVIEW.md独立关闭D-R1/D-R2/D-R3；接入前自行核61文件，V9→V12只有ResidentJobs/ResidentPathing，精确匹配父V11清单，且仅免建无邻格距离图/堵塞BFS前沿，无改班、取消、退款或环境分支变更。完整手册替换及16唯一old锚点均接入；V9性能旧“当前”措辞按正式V12事实修订，历史失败不删除。world5经济C5-1/1.1.0、foundation11/world5schema2/settlement module/rules1.1.0/state2；whole-run6/recording4/RecordingOrigin2、worldSdk1/edibleSdk1仍保持。

九冻结实际SHA如下，逐项仍等开工preflight；fgfixture及foraging树未改：

| 文件 | SHA-256 |
| --- | --- |
| `src/ext/worldSdk.ts` | `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343` |
| `src/ext/edibleSdk.ts` | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` |
| `src/ext/worldEdible.ts` | `7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67` |
| `src/ext/kindKnowledge.ts` | `4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f` |
| `src/ext/actorNeeds.ts` | `8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e` |
| `src/ext/stats.ts` | `c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84` |
| `src/ext/testing/worldHarness.ts` | `a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0` |
| `src/ext/testing/forageHarness.ts` | `ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38` |
| `src/ext/testing/fixtures/forageFixture/index.ts` | `adc02caaa085519c54a4c0c202ef9f06f1a2b818806bd6b819773f81a4b1abea` |

### 先前待验范围与推荐裁决（历史，已由顶部裁决覆盖）

建议父独立复核本轮登记/文档接入差量，再冻结最终source用于中文raw兼容桥接与实际浏览器构建，完成真实Game24矩阵及三关键容器后裁定5D1、commit/push并核远端。当前只可称限定收口候选，不可称整步已验收。

正常fresh英文956/957与controlled from-save饥荒/撤营尾分列；中文UI955省略原916且加入背包包络，不能替代英文956或沿用其完整knowledge。reportItems.name使既有跨locale摘要不同，中文参考须同locale原生回放绑定，未修成跨locale兼容。原生失焦/真实手机未验；完整npm/test:ext/128组合、最大8营/3072格/满箱、完整体积/物理删除等留5Z，5D2离线岗位/供应链/厨师等未实现。5G eda3094已独立验收发布，尚未集成，不声称真实foraging联动通过。

## 历史实施和验证记录（以下保留当时结论）

开工2026-10-08，ext/phase5，HEAD769f6fc18aad4881bfcc8d2170de84cfd319e4e8。
正式任务为[phase5d1.task.md](phase5d1.task.md)，保留指挥任务/历史preflight。
本报告随里程碑更新；已通过的针对性用例列在下文，完整5D1与浏览器尚未验收。未commit/push、未派代理。

## 1 早期实施进度（历史）

A/B/C/D 已补齐实际生产回归及主要失败原子检查，AB/FR1/FR2/FR3已独立关闭。E 名册/守卫选格与天然seed3当前239路线/四原录及C1初始检查均已实际通过；旧seed28闭环不能沿用，新的独立956输入正常新局精确复现尚待正式来源报告和当前源接入。F 当前同源UI14、boundary/types/build及真正npm drift8项已通过；性能准备已交，安静计时、父级真实浏览器和最后delta独立审查仍未完成。不能称整步通过。

## 2 共享写集（首patch前登记）

新增ext/residentSdk/schema与Core ResidentProduction/Needs/Jobs；ext types/runtime/world5/structureSdk/descriptor；
Game命令、生成entry/真实救援/死亡/跨层、TimeCoordinator需求安全点、PhasedAttackProduction唯一selector；
StructureProduction锁/粮仓/ledger、WorldWork生产NPC scope、WorldWorkValidation、ActorDeparture非活动carrier；
Monster原生priority及移动、StructureWorld床/种植工作位失效；recording dirty/digest契约及必要候选校验。
事务覆盖world5、容器Item、模块state/components、所有active/cached/pending/purgatory actor与携物图、
动作根、runtime/session、ID/RNG/logger、generation写集/对象身份。九冻结/fgfixture完全不改。
没有新增原生Item/Creature持久字段计划；whole-run6/recording4/origin2保留，foundation11/world5schema2/settlement1.1.0/state2。

## 3 早期验证与缺项（历史）

下文记录实际阶段测试。各阶段余项、自然正常新局完整公开命令录像及浏览器仍未验。
完整npm/test:ext/128组合/完整删除/最大结构压力/Worker留5Z。不读写外部dot树/foraging。当前树四模块golden仅按已归因协议/schema变化更新摘要叶，公共输入与断言保持，详见末节。
原失败日志后续均保留于/private/tmp/brogue-commander-20261008-5d1/implementation-evidence。

## 4 v2合同追加

正式任务SHA8de2d031，独立合同F1/F2采纳；尚非代码验收。劳动半开区间、暂停保票据信用，端点FOOD→住房→合法完成；回滚以各次最外层同步事务入口，不倒退已付原生时间。上轮SIGINT主动中断，不列功能门禁失败。

## A 首轮真实入口验证（2026-10-08）
Node24、3GiB、2workers，resident_sources + settlement_runtime：2文件5测试通过，日志 implementation-evidence/A-eighth.log。覆盖可信entry真实候选、原actor招募100tick、No与陈旧报价0tick/RNG/ID、source消费、故障回滚身份、生产save/load及结构录像。此前失败日志A-existing及A-first至A-seventh保留；发现并修复native模板underscore校验、运行期命令注册和独立单格读档接线。受控卧室准备明确不是自然路线。A其余救援/预算/codec负例继续补。下一步B：双需求独立参考、真实日粮与离队故障；C active bundle退款和劳动端点。

I7已消费：真实FOOD按quantity占槽，代表性供粮输入限定16箱×64槽=1024份/营。本轮纯核4营64居民供粮长跳+独立短reference已5测试通过（B-kernel-first.log，26ms整个文件）；它不是实际Game提交性能。下一步测真实提交与16在场事务成本。

I8/I9已消费，加入完整实际需求提交分段/hash/锁/revision/规范收据尾对照和终结存读。B-production-second：真实日界锁粮、F2时钟保留/对象身份恢复、cached发粮/非死亡退役/携物归层，3项通过（6.25s测试）；终结存读是随后追加，尚待重跑。

## B/C 目前已验证部分（后续改动仍需最终重跑）
B-production-third 4项实际提交：真实锁粮/双轴需求、F2已付时钟保留和对象身份、cached退役归层及最终存读、一次补算vs2/17提交的库存/locks/revisions/receipt/hash完整一致。C-jobs-fifth 3项实际岗位通过。BC-labor-perf-first：需求4项及劳动A06/A07两项通过；16人口性能初始准备遭C5_SCOPE拒绝，性能尚不通过。严格记录检查发现首轮性能无效，16-resident-first保留不采纳。
K1 shared worldJson拒自定义数组原型，产品纯核6项及指挥固定副本独立复审已通过；这不代表完整验收。
C5-1旧纯核反事实：首跑测试ownership启动失败，无行为证据；第二跑真实恢复基线WorldSettlement/world5/原测试，16项通过（counterfactual-offline/baseline-second.log），finally恢复全部当前文件。新DTO原生FOOD ItemID消费及日/epoch双需求的独立reference保留完整等值断言，修正旧每epoch食物前提；M2有界事件收据测试清空人口/订单，避免它同时要求未授权离队提交；其收据断言不变。真实fixture350次wait最初曾按实际32epoch日界差计算欠粮预期；本次最终已撤回此断言变更，详见下文，只补足受控离线前提，保留foodShortage===3。housing仍独立验。
缺项：更多生命周期/预算/故障、A09/50%劳动/同刻FOOD搬运、真实护送与新居民组合录像、自然路线、UI和浏览器、有效16在场及64长结算性能、最终门禁与文档同步。


## A/B 短批次修复（2026-10-08，等待固定输入复审）

已消费收件箱I14/I15；原[生产审查](phase5d1-production-ab.review-findings.md)保留，修后结论须另立独立复审。本次依照外部phase5d1-fix-ab.task.md完成小批次，停止后不自行推进D/E/F或commit/push。

AB-1：killMonster在captureDeath与dying写入之前捕获原生检查点，并由外层resident事务覆盖退款、后半段掉落、死亡DF和kill发布。原生检查点明确保留入口actor的dying membership；异常恢复原对象图/RNG/allocator/dirty并抛出。入口原本HP0保持0；不复活合法致死。可信重试与原生public wait清理不重复掉落/退款/死亡发布。

AB-2：从camp ledger高水位识别待结1000tick边界，无新增持久字段。原生机械输入在新命令分配/移动/攻击之前重试；其他机械物品/模块命令待结时C5_BUSY拒绝，resident/structure保留自身纯准备和接受后同事务补结；replay/internal stages共用入口，TimeCoordinator在prelude和每次新elapsed前补结。动画异常收尾遇到待结账时跳过epilogue/自由决策，保留已付时钟和countdown。显示/目标modal与未接受的extension报价不调用该输入结算；resident/structure仍在确认和CAS通过后的自身事务里结旧区间。I15真实合法未结save的开关背包、read UI、recruit No及陈旧报价均保持粮/ledger/clock/双流/ID。

fix-ab-fourth：6文件58项通过，含9个真实Game故障/阻断/存读及纯拒绝反例，保留劳动A06/A07、需求F2和旧离线35项。最初5项新增失败分别是save字符串包含实时savedAt、误监听不存在的attackMonster；第二轮3项失败是组件缺失实际返回undefined而非null。对象图独立audit断言首轮即通过；生产故障和测试本身失败没有混称。类型首轮13条测试导入/方法错误，第二/第三轮已通过；协议向量完整联测仍在最终核对。

原始地形守卫首次exit1拒两处新raw读取；未改守卫。候选复用stableGround；种植采用readCellProperties的安全稳定水源资格，临时洪水、深水、熔岩、未知水源不合格。foundation10→11导致empty codec root变更；旧descriptor+原测试单变量反事实通过，独立Python hashlib记录codec字段、root/start/chain的逐字段归因，证据fix-ab-protocol-vectors.json。fixture注册版本同步当前rules identity，不更改守卫或断言语义；第一次反事实夹具用例通过而protocol未恢复，第二次protocol恢复但测试header已改11，二者exit1均保留；第三次仅descriptor生产文件及原HEAD测试用例恢复，exit0。

尚欠：16代表性performance、合法64人口/供粮长提交预算，正常新局完整原始trace与真实救援、C更多端点/50%、D护送负例、E浏览器、F相关组合/限定门禁。旧16-resident-first无有效记录计量不采纳，后续performance准备C5_SCOPE/C5_BAD_PAYLOAD失败保留，不声明通过。D-escort受控单例通过仅为阶段证据，非自然路线或完整D。外部交付status/manifest记录最终实际结果与范围。


短批次最终证据：fix-ab-final-fourth已13文件179通过/2既有CE条件跳过，类型与边界守卫通过；随后仅调整350-wait旧用例前提，再做最终同输入复核。旧原测试在恢复此次相关生产文件及其原fixture后真实通过1项（fix-ab-counterfactual-managed-third/baseline.log）。前两次临时混用新旧生产链分别启动时缺residentJobs、elapsed进入新居民回调而失败，均不当行为证据；finally完整还原，manifest确认临时回退后恢复原5b候选值，最终前提修订后登记361b候选值。最终测试保留350次公开wait的缓存生态/进入倒计时隔离检查，再用生产advanceWorldClock提供三个绝对离线日界；原欠粮3断言与收据/存读/enteredLevel断言不变，不称自然路线或性能证据。

类型最终第四轮已通过：pending item operation仅解析string，其他payload不调用String/toString，补空值默认；真实toString getter零次反例及物品drop待结时拒绝/库存与ID保持均加入9项故障套件。无新增Game持久字段。最终准确输入、测试结果与全部历史失败归档见外部phase5d1-fix-ab.status.md和phase5d1-fix-ab.manifest.json；本报告不关闭独立AB审查的两项结论。

最终短批次同输入复核：fix-ab-final-fifth，13文件179通过/2既有CE条件跳过，144.12s，exit0；vue-tsc第五轮exit0，模块边界exit0，diff --check通过。最终src/scripts/public+根配置1182份集合SHA361b94d5e343362bc817d8887d7ff9650778b18c42100b6a928496a57e40484a，测试前后相同，9冻结SHA全部不变。状态与逐文件交付manifest已写外部根目录；停止等待指挥固定输入AB复审，未commit/push，完整5D1及D/E/F仍未完成。


## 2026-10-08 A/B第二轮新发现短批次：ready停点，尚未跑相关门禁

已读独立review-rereview及固定真实probe/output。本批仅Game/Logger/resident_failures三文件相对SHA361变化：真实throw在No/诅咒拒绝后、卸装/库存/ID/RNG/付时前结旧账，覆盖perform与默认mouse目标；帮助/图鉴方向按实际模态分派保持零成本；默认wand/staff use允许真实目标准备，真正confirm在风险No/无效/已知空充能拒绝之后、charge/effect/time之前结账。公开与内部分类携带perform。Logger检查点原位恢复原数组、消息行（含重复count）与combat/presentation队列引用。前轮AB-1死亡外层保持。

外部同一小Node探针旧候选11项中8失败3控制组通过（exit1），新候选11/11断言通过（exit0）；保留真实投掷/法杖、双流完整状态/ID/时间/物品检查，显示/No/取消/ACK/barrier与失败后成功重试/存读档。首次staff save/load清目标导致无效探针已明确归档，修正实际target模式后旧候选charge2→1/native time+100，修复后失败前零变化；不拿无效Missing expected exception充证据。布景受控，不称自然trace。

精确源集合1182份SHA 5bc5be471b7c6eb417bf8f06e1e6a5e2356cec0aa09aacbf0c30754d5803deb7，小Node前后不变，9冻结SHA不变，diff --check通过。**新增11项Vitest回归只写未跑；本批未运行Vitest/types/boundary/build/full/gen/drift或浏览器。旧179/2属上一候选，不属新SHA结果。** 外部phase5d1-fix-ab2.status/manifest/ready已写，按指挥短批次任务停在ready，等待安排相关测试与独立审查；不自裁新S1/S2关闭，不展开剩余C/D/E/F、性能、自然路线与救援/UI/F，不读改5G，不commit/push/派代理。


## 2026-10-08 AB2/I16针对性测试交付，停止待独立复审

按新测试任务先resident_failures全20通过；随后相关7文件首轮268通过/2失败（D4历史版本pin5与现有whole-run6冲突）。只回退WholeRunSnapshot.ts至6e068cd^的实际v5生产文件、保持原测试不变，两项完整存读/续录/回放用例通过；finally恢复当前文件字节。HEAD同文件已是6的第一次无变化尝试不作为归因证据，日志保留。按正式任务whole-run6，仅将D4严格版本元数据5→6；原0OOS/续录/load断言不改，未放宽语义或加skip。

补齐I16嵌套checkpoint/重复恢复两项：旧Logger单文件hash核对反事实2项身份失败，ready实现2项通过；新增x3_u6_messages回归检查原数组/行/count/ID/turn/ACK/combat/heard。类型首轮TS2345实际失败，Logger数组描述符改用显式属性键Map并逐键恢复后types通过，保留旧日志，未改守卫。

最终1182份输入SHA a387f9729e3899696e63de3c818abb5e4e9dc016b80bfd6965cf00fda238b330，9冻结不变；同输入最终types exit0、8文件290项通过exit0、2个既有Logger/展示checkpoint用例通过exit0、boundary exit0，逐阶段源码散列不变；diff --check通过。总选择292项通过，无CE条件skip；另36项为-t名称未选择，与CE跳过分开。最终8文件实际完整重跑包括resident20和D4全29，非拼接首轮结果。未跑build/full/gen/drift/浏览器/性能。准确路径、命令、历史失败与counterfactual见外部phase5d1-fix-ab2-tested.status.md、tested.manifest.json、implementation-evidence/ab2-tests/gates-tested-state.json/final-summary.json。旧179/2仅是旧SHA背景。现在停止待独立AB复审，不自裁关闭、不继续C/D/E/F；未commit/push/派代理，未读改5G。


## Remainder 实施与证据（2026-10-08，候选门禁进行中）

本轮完整继续来自外部 `phase5d1-remainder-coordinated.task.md`，收件箱已消费 I18–I35。AB 第三次独立复审关闭的死亡外层、已付需求边界、纯显示/No、Logger 数组/消息对象身份恢复全部保留。九冻结 SDK、foundation11、whole-run6、recording4、origin2 不变；未提交/推送，未派代理。仅 settlement 已安装六模块组合，不声称未装 foraging 实际联动。

生产变化：

- 救援来源按真实 actor/合格模板登记，64 个未消费来源上限和128展示收据分开；死亡GC释放来源，来源不能凭日志回卷重生。坏来源/坏档在候选验证阶段拒绝。非字符串 extension 原载荷先验证纯数据，getter 不进入路由。
- 搬运在休息/零效率时保留原 escrow Item 和同一票据；实际种植信用按已付半开区间累计，达到1000后余数清零，需求结算先于端点产出。实际满箱/拆plot或箱/危险退款只一次；守卫保留原生战斗优先和唯一 native prepare。
- 缓存护送入层先验证真实落脚；无位留源原对象与countdown1。真实居民坠落的外层检查点位于伤害之前，覆盖 pending/cache/归属/携物和后续重入；玩家跌落不全队传送。未招募自生候选不进入原生盟友楼梯跟随队列。
- 居民距离图为 WeakMap 派生数据：按 Grid/地形 revision/原生静止不死阻挡足迹/目标和revision缓存，最多32图；每实际步重查占位、危险、斜角、原actor通行。梯度被挡时一次有界本层BFS（最多2291格）；缓存与原map引用纳入同步失败恢复。无新增 Game 持久字段，不改实质RNG。
- 实际多营长结算先合并全home离队绝对时点，再按 tick/camp slot/actor 发布；原生300tick可见告别只给真实可见active actor。离队收据使用逻辑截止处理已到期grace，已付world clock不倒退。真实64/MAX_SAFE 的 world/extensions/原Item/原monster/完整digest 在1/2/17分段完全一致。旧38项 receipt次序/ordinal/tick 差异仍保留，独立FR1关闭须由复审方最终源重跑。
- ResidentsPanel 按名册选择显示详情，0/16名单、>=44px入口；守卫坐标来自共享map cursor。深度/所选居民/忙态和陈旧source变化清理选择；关闭/重开使旧ACK callback失效。只读选格/箭头不推进世界、RNG、ID或录制事件。

FR2/S2：独立真实 plant ticket 伪造为 delivery、无bundle/0credit/pending 的档原先被接受并可在public wait产crop。新增坏档反例首轮如实失败；现在 codec 联合检查 kind/phase、resident plan、源目的箱、plot成员、haul quantity、预留槽、日高水位、信用/余数、working/suspended/pending与唯一body recovery bundle。种植发布同时要求 planting、1000credit、0remainder，不能靠伪 delivery 绕过。合法暂停/待完成故障重试档必须继续可读；当前 codec+labor 回归通过，独立probe仍待最终源复核。

I33 共享前置：仅语义移植5G已审提交 `eda309443cdd57a4cad1ec92d2cd3c5da7230d34` 的 `Logger.pendingAcknowledgment` 空disabled ACK通知守卫，保留本轮全部checkpoint身份逻辑；没有合并5G或复制整文件/SDK/foraging fixture。新回归在本P5 foundation11上挂载真实App，用真正normal seed3前20条公共输入新录录像，真实File导入、无操作静默、seek20→0→20、save/load续录和raw replay；另检查空读零通知、stale pending/unread/terminal仅清一次。此处为自有mounted Vue host机制回归，实际浏览器仍由parent负责。已读5G独立报告 `maintenance-tree/docs/ext/phase5g-replay-import.review-findings.md`，注明授权出处I33。

多态F2首轮真正失败是最外层在原生关系改变之后取检查点；现将accepted同步施法（取消aim、实际wand charge/zap、关系发布、itemUsed）纳入resident事务，原生paid elapsed留在事务外。独立全对象图oracle在restore瞬间、原wand charge/RNG/allocator/同actor allegiance均检查；故障结束continuous recording后普通存档不保留临时aim，因此用真实confirm重试消耗一次charge，再检查稳定save/load完整digest，不隐藏此输入合同差异。旧探针日志保留。

### 性能准备（不是计时通过）

`preparation-scale-phase30-first.json`：2文件4case全过。两组均按同一真实付费施工、真实救援+招募准备16名原生盟友，仅末尾控制组去居民成员/需求并恢复native follow；比较player、native HP/status/clock、世界tick、turn、双流、structures、箱和原Items完整相同。明确控制是16native allies/0registered，不是0NPC。

室内seed箱避免共享门口取种往返阻塞；phase30合法受控origin使工作在32warmup之后仍有实际劳动，不声称全部320条持续劳动。320真实正耗时wait，index255 fullCheckpoint非null，单列warmup/ordinary/summary。居民组4crop入真实箱、32wood搬运；ordinary plant credit2200/完成4，haul完成4，guard移动88/正wait2208。真实residentPathRebuilds2366=468缓存miss+1898占位BFS；native travelDistanceMap532另列，不冒充全部path成本。保存world47712B/whole1949209B。

64准备是4个真实paid营各16活工/合法床，实际FOOD46/46/62/62（每箱<=64槽、锁2），world118808B/whole7337987B。有限逐日独立reference只算库存饱和前短区间；超长MAX_SAFE解析守恒、CB规范事实/尾128及真实1/2/17提交/终态load/+1overflow零变化通过。计时入口与8次真实64 cold/warm提交已准备，须parent安静窗口执行；当前没有P95/<=50ms结论。最大结构/满箱极限仍5Z未验。

### 自然路线与最终门禁待办

seed3真实天然D3原goblin85救援/正常建营卧室/锁粮/招募No与Yes的238/239不可变原录像来自 `captive-astra/NATURAL-CAPTIVE-READY.md`。招募No全digest零变化；原生救援No允许既有everSeenMonsterIds变化，不混同。续录合同只前237个完整事件一致，第238临时末尾checkpoint去除后chain重算，不称原前缀全字节不变。

旧seed28正常1980公共输入曾通过，但新版居民绕障改变实际位置；独立I34指出首次拒绝为event219 plant C5_DISTANCE，后续event327死亡是下游。原失败保留，路线回归已补每条ext result断言，禁止静默继续。指挥I35有界重录进行中，必须最终源重验新公开路线；此项未闭合不能称E完成。最终related/boundary/types/build/实际npm drift、同源SHA、真实浏览器24格+三容器、计时、独立FR1/FR2/路径缓存与Logger组合复审均须真实结果补录。


### I36–I42 后续归因（尚未最终交付）

相关居民批首次13文件81pass/2fail：原I15 opaque坏对象在未结需求边界必须抛C5_BUSY，新raw-data guard提前return使旧断言失败；生产catch已保留该busy结果而不调用getter/结算，原测试未改，后续AB20与codec3全通过。第二个失败是天然seed3首225旧regionId110不存在，当前实际camp106；末尾21000vs21100只是施工拒绝下游。只撤Game.excludeLevelFollower中未消费spawn楼梯排除这一变量，其余当前全部源/测试不变，旧238路线与未改原录238完整replay、seek、save/续录全通过；finally核对恢复原Game字节。该必要stay规则改变跨层原生时间线/生成及世界ID，不能盲改tick关闭。fresh报价重录发现旧door46,21现在C5_PROTECTED，保留当前原地图/快照/失败录像；遵I42不再试走，交parent固定input-v3中Astra原会话重录，保持真实UI9×9几何及当前quote。原录像从未改写。

I36候选政策两probe通过：受控和平20次真实wait对应20次原生prepare/0次native fallback，原对象保正timer；邻接真kobold下一次仅1prepare/1native，普通无source盟友仍原生。正常seed28固定原路线前141条审计不写私人状态，birth37,25→39,21，137次优先检查124false/13true，11次nativeMove全在priority=true且实际同kobold9已知敌情（distance约11→1）时发生。没有发现和平fallback漂移；未擅缩“已知敌情”的半径、屏蔽原生避险/战斗或靠herding修产品。此前源在受控helper被冻100000tick/与敌人同区的问题是probe前提错误，已明确隔离；不是生产问题修饰。原失败日志保留。前141输入单列小fixture，仅源政策审计，不假称核心闭环。

独立fixed-v2 own probes确认FR1和FR2修后关闭，包含合法pending save/retry。新增FR3/S2晚itemUsed实际执行/autoID/vision后throw使ItemLoader类型知识21→22与完整图2886处泄漏；本地新晚case同样3010差异失败。修复为可信同步native transaction弱作用域，checkpointResidentWorld在多态接受外层组合真实checkpointCombatFactWorld，覆盖原知识Set/Map、Grid/FOV/LightMap及原actor key顺序/引用。普通经济事务仍原写集，无新Game字段，不把paid elapsed放回同步事务。早/晚多态+实际retry/稳定save、FR2合法pending、Logger/App共10项全过（fr3-fixed-first）；独立同probe须对新固定源再验。

I41 self v2实际招募No/Yes和crop53 qty1通过，但haul在45700接受，实际战斗伤HP20→12、48000进入rest，旧100wait止56700尚不到next work64000；没有永久路径阻断证据，指挥授权外部仅一次schedule-aware v3捕获与一次保留fresh exact rerun，不修生产规避班次。当前新自然core和seed3完整回放仍等待，不能用旧局或准备prefix冒充。


### Shared 最终前置门禁与独立关闭（仍待完整同源交付）

related-foundation-first：37显式相关文件595case，593pass/2fail，0skip（控制台无CE提示不等于存在skip，用JSON计数为准）。覆盖formal§6.1列出的时钟/needs/departure、C5 work/structure事务、generation独立checkpoint、wholeRun/真实stairs、录像三底座及旧u27/x2a/x3b/续录、Canvas/module/dialog、源码/i18n/hygiene/membership、三golden和Logger。第一失败是候选名/description的动态`t.nameKey`不可静态扫描，生产复用已存在且用于world Item的`worldText`扩展文本入口，所有已验证ext键原值不变；守卫未改。第二失败UR4仅52 `recording.chainDigest`字段，所有snapshot/原事件/日志/时钟/双RNG均相同。

UR4基线归因：第一次仅descriptor10反事实失败，原因Game header另硬编码11，真实失败保留。header改用既有FOUNDATION_PROTOCOL同一权威（当前11输出完全相同）后，第二次仅descriptor11→10、其余source/test/旧golden不动，旧完整UR4精确pass；finally恢复原字节。按docs/testing§3原UR4_CAPTURE=1/maxWorkers1正式重录，并逐叶登记52 chain字段，其余零变化。旧SHA `0893f749cfbcd6e16d3632ae29c34ad79626a83389d8b3d0e568b9e9cb6837c4` → 新SHA `730a78a8af493d192fcc426fdcdfb37d02c0b27c1b415d1517e66b03241a0ee6`；旧/新压缩尺寸1318856/1318877，为既有黄金fixture的更新，未增加仓内原始失败证据。完整字段前后值/命令/退出/SHA在外部ur4-foundation11-attribution.json，旧raw gzip保ur4-before.json.gz；UR2/UR3及生成基线未动。shared-fix-verification-first6文件58pass0fail0skip，含原UR4等值assert、i18n/u24/hygiene/membership/旧codec向量。另c4完整文件+p1+外部UR4捕获3文件57pass0fail0skip。

Boundary复核明确exit0；types七/八分别为已退休的seed3探索helper unknown参数及其残留data变量失败，修测试前提/类型而不改生产语义/断言；types九exit0。真正npm run build在Node24.19.0/3GiB exit0（不是只vite），source-identity inventory前后同SHA `8d74ac4d983b8a4a79e26943845a7f2f606a735572ba737a77df5e1c66cbde3b`，2633输入（含docs，采用parent浏览器scope）。构建当刻已自动交BROWSER-BUILD-CANDIDATE-READY.md、前后源清单/build report原log SHA/dist逐文件清单；该candidate仍含当时旧自然fixture，最终新fixture/docs后要重新repin，未称浏览器final。Vite既有chunk>500KB提示保留，不等于失败。

已完整读full-review/REVIEW-v3.md：FR3独立四点early resident-delete、late itemUsed、实际identifyItemKind后、真实updateVision后完整live图/知识原Set与Map/值/顺序、charge/aim/双流/ID/dirty/Logger全部0diff，合法重试/稳定save通过；还检查native scope清理/嵌套、thenable拒绝、entry前合法日粮保留及paid elapsed之后不回滚。经济outer内native子调用不升级是明确边界，当前合法多态从最外声明true，没有新有害可达路径。FR1/FR2原独立关闭延续，I16/I33 Logger与源政策/path checks延续。最终i18n/header/UR4/新自然fixture变化仍需窄独立复核。

I46当前新天然seed3完成：239原录/240续录，UI bounds42,18,9,9、床6(46,20)、camp106，同goblin85；旧223输入原样执行，后续实际公开移动避开真实actor占门/左床位。capturer两次正常新局各240公开命令，239原事件逐字段相同，正常save/load/完整replay/seek过；carriedItem始终null，本自然路线不声称非空loot覆盖（非空控制真救援已有单列实际源测试）。招募No全digest不变，Yes100tick，HP8保留，付时原生移动/regen保留。root已完整解析natural-route-v2和qa-ui-operations全239项并与原raw的action/data/decisions逐一相等，压缩进新自有小fixture；旧fixture/旧原238和失败证据外部保留，正在当前source实际公共输入/检查点digest/239与240四个原raw复验。source/source raw SHA见captiveroute小fixture与外部报告，不改原录字段。

### I49/I53 真实窄屏触控修复与 I51/I52 测试补强（验收继续）

父级实际组件浏览器确认390窄屏数量输入36×44、五个短动作按钮42×44；桌面18项通过不能代替窄屏44×44。最初仅给子控件min-width44的候选被独立UI44审查发现父 `.settlement-panel[data-v-parent] *` 的min-width0覆盖，修复未生效，旧失败与v5固定输入保留。当前 `.residents input/select/button` scoped实际优先级(0,2,1)超过父通配(0,2,0)，checkbox局部后置(0,3,1)保24图形/44label命中；border-box、自然wrap、max-width及flex-shrink保留，无!important、无脚本/模板/命令变化。实际Vue compileStyle静态结果在 ui44-scoped-fix.json；需要新源父级浏览器，尚未宣告真实尺寸通过。先前UI14pass仅机制回归，不是新CSS几何验收。

新俘虏测试明确在第一命令前校验原initial/events0的depth/tick/完整digest，并加入seek0；招募后显式resident存在/campId106/bed6，来源仍为已验证原fixture，不用当前输出改期望。外部四份原录像audit记录完整绝对路径、原字节SHA和每次真实replay结果，环境明确；完整四次回放仍正在必要窄复验，不以仅1pass日志替代路径事实。原录与static inputs/digest断言未改。

PERF-READY.md已交准备，场景/320真实输入/16对照与64计时范围明确。当前未timing，不与scout/browser/门禁并发。整体仍待crafting/giants黄金精确归因、实际完整npm drift、新CSS types/build与parent浏览器、当前自然self完整链及最终窄审/计时。

### Crafting / giants 漂移黄金归因（完整入口复验待运行）

实际npm drift首轮8项2pass6fail，完整失败保留；两生成基线通过不等于入口通过。仅descriptor11→10生产反事实在原assert/输入/golden不动时，三giants全部旧黄金pass；crafting仍fail。crafting原捕获final逐叶只有digest不同，inventory/nodes/state严格全等。完整只读production mechanicalDigest分析：固定协议10，仅复制投影schema1但保residentJobs仍fail；schema1且移除空residentJobs精确恢复旧b52cb4a...。native/actorActions/knowledge/random域不变，剩余是world5 schema2的hash叶合同，不是工作行为/RNG变化。

两次不完整回退失败均保留：旧world5文件启动缺residentJobs.some，Game只改full snapshot旧schema触发原Recording domain divergence守卫；没有更改守卫、跳过或超时。最终schema叶格式生产单变量反事实：在协议10固定前提下只RecordingDigest.world5DigestLeaves的复制叶恢复旧schema1/无residentJobs，两full/增量同路径，真实Game状态及原断言/输入/golden全部不变，原crafting first完整final断言exit0。finally原字节恢复descriptor11 c501572e...、Game92736e7...、原RecordingDigest25cb4cab...；RecordingDigest无永久修改。本实验只证明旧codec hash合同可恢复，不声称旧world5文件完整可运行或旧协议可加载新录像。

按原CRAFTING_CAPTURE_TRACE公共264输入及每条receipt方法捕获真实final，仓内仅 /final/digest：b52cb4a64add710c68c615b3d05af27ada228f0efaeb63e4da45ee5ff189b060 → c32f43ba043f58352baaf21c03d84eb6fba5554821db84539720c84504d0593f。文件SHA 89425e66fc7ed3942b384add154d460ea594527e331d3afacae44aeeded13a1c → 639cfdd646fc299d432b5424c1e23b61191fa0ff143ac43d9bfe75bba0162626。未手改输入/断言/库存/节点/state。Giants按原BROGUE_CAPTURE_GIANTS_TRACE=1三原capture函数捕获，实际3pass，三文件仅 /extensionsHash，nativeWorldHash/commandsHash/双RNG/actor/region/state全叶不变：

- src/ext/modules/giants/data/natural-trace.json: fc975ad841ea4985f81b1dc2ac8480e3d24076dc6aadd4ce4a3f44171dd02a4c → cc40824d5206e330f0de469bbf7f294675f036b8e5b1fe02ae9e788764567b1b；484324ffedadb63d8723758bdb646dde77e11efdaf6d268c7bf751e996ddb1bb → d447965c5b7ccc9c7f501624c490ac8631609d9bc66d3a19e2e1546b40bbf5b2
- src/ext/modules/giants/data/colossus-natural-trace.json: b8d0e7a1c876a3ecd7bfeba1dcb754ae7f3ad7c0edb08559388d083811559632 → 340913ff4d621e310a83009c2b76edee3d54561b2998272e48ec8209cb8e8042；f3f2496bd7a4b71c75d90cbc6a047b8eaced16eaf43ce61863f5ecf9d4b49a48 → 161591719a46b18ae62a3bddcf06e441106fa1739d8760b679952e22be6008f5
- src/ext/modules/giants/data/spine-natural-trace.json: 5f71a93a83e91fa402fd93b5801c90241762f37904317e2c5c53f27d5ca3bb54 → 28f6878c8943e9c55bbc9d1ebb2dc2aa914d7aa307966eb75e6779a747e60469；48e7e461cd85b0df677cc58834ceb5249496502b98525f16a649f03e8c65c770 → 59a76eaf6ab2430a512bb1b9e479c97778270f09ad6f6578016404f3dc5cbac1

逐字段before/after与SHA、真实命令/退出在外部 crafting-golden-update.json、crafting-schema-attribution.json、crafting-digest-counterfactual.report.json、giants-golden-attribution.json；全部旧raw副本保外部。四模块golden已明确仅改上述摘要叶；dot公共输入、原断言、生成baseline、九冻结未改。新CSS相关UI、boundary/types/build与正式npm drift顺序复验结果见下节，尚不宣告完整5D1。

I51/I52俘虏必要复验已exit0，1pass0fail0skip；23唯一阶段/seek含0、camp106/bed6明断言。captive-c1-reference-audit.json实际记录四原239/240绝对路径、SHA及四次 {ok:true,firstMismatch:null}；Game/descriptor/world5/测试/fixture SHA绑定。运行期间无关CSS/报告变化单列，不冒称该次全源前后冻结。

### V7门禁与接力状态（历史，以顶部当前入口为准）

当前真实生产/配置输入scope1198文件SHA10d37362426a193b78cd2e3f288126ece07ba31a2d2b50a6c9939c11ab61daf7，九冻结均不变；HEAD仍769f6fc。下面五门禁在同一parent inventory scope2633文件SHA2b6fafa55dcf21d7c5b1afe2dbc7fd9cfdcffa81b70d0bcf5c3a10aff4fce83a下运行，每次before/after完全一致，Node24.19.0/3GiB/Vitest maxWorkers2。文档随后补写不改变生产/config子scope；不能把已更新文档后的完整scope冒称构建时身份。

| 实际门禁 | 结果 | 外部原始证据 |
| --- | --- | --- |
| 4文件UI必要回归 | 14pass/0fail/0skip，exit0 | i53-ui-final.tests.json / .report.json |
| node scripts/check-module-boundaries.mjs | exit0 | boundary-i53-final.report.json / .log |
| vue-tsc -b | exit0 | types-i53-final.report.json / .log |
| 真正npm run build | exit0，Vite既有chunk提示保留 | build-candidate-i53.report.json / .log |
| 真正npm run test:drift | 8pass/0fail/0skip，exit0（两generation+crafting3+giants3） | drift-i53-final.tests.json / .report.json / .log |

构建当刻已立即BROWSER-BUILD-CANDIDATE-READY.md与build-i53-dist-manifest.json，不将build称browser；父级在新自然fixture/文档最终完成后还需repin。没有跑完整npm/test:ext/CE/128/5Z，缺CE提示与JSON0skip分别如实登记。所有原失败、首轮2pass6fail、counterfactual未成功尝试仍保留。

当前必要C1外部运行绑定封存 captive-c1-run-envelope.json：实际argv/cwd/四路径环境/Node/退出0、输出报告与log/audit SHA、测试d67b9c...、Game92736e7...及原fixture/descriptor/world5逐文件SHA；真实运行依赖字节逐一与父级fixedv6 manifest a0c6081e...核同。23seek含0与四结果齐全。测试进行时仅无关CSS/文档改变，不声称全源起止冻结；之后的临时codec实验与黄金变化发生在C1结束后。V6-E1外部绑定项交父级据该封存清单核对，未因元数据重跑长录像。UI44-F1/V4-C1已在V6-REVIEW.md独立源码关闭，真实新尺寸还需父级浏览器。

最近v5后真实delta只有报告、ResidentsPanel局部CSS、C1测试与四owned黄金文件，DELTA-REVIEW-READY.md已交具体before/after。core Game/RecordingDigest/descriptor均已恢复独立审过的当前字节，没有后续生产行为变化。PERF-READY只代表16/64准备，不代表5ms/50ms通过；不会在当前scout/browser/reviewer活动时计时。自然自生来源/当前源回放、最终浏览器24格+三容器及54显示矩阵、计时与最终审查仍待接力，不反复运行旧1980失败fixture。

### I57 性能阻断与诊断（2026-10-08）

父级固定 v7、真实安静窗口的 `performance-final` 实际退出 1：0 通过、2 失败，全部布景/正确性断言通过后才到性能门限。16 人普通新增 P95 为 67.885542 ms（要求 ≤5 ms），64 人长需求 peak 为 310.606708 ms（要求 ≤50 ms）。原五份结果永久保留，不能把之前的计时准备报告当成性能通过。

原执行者已对原同场景实际做 Node CPU profile（与父级浏览器并行，仅诊断）。64 人主要热点是逐人终结来源时的整份营地状态 clone/validate/canonical 发布；16 人主要是原生敌人感知射线的占用查询及距离图。第一轮真实 profile 的 64 最终完整 digest 与原计时相同，16 原320输入的劳动、移动、正等待、票据/货物/ID和统计字段均相同；这仍不代替最终同源确定性及安静性能复测。当前正在进行最小查询快路、无订阅 hook 快路及同步无观察者退役写入合并，相关失败/回滚、原生顺序和最终候选复验尚在进行。5D1 尚未完整验收，不提交或合并5G。


### 普通回放营地入口修复（2026-10-08，待独立审查及父级浏览器）

父级 captive-final-smoke-02 的1440×900普通回放在277/281缺入口，readonlyPanel路线仍exit1、saveOrigin仍null；原0394前后JSON/PNG、summary/fatal/steps及node-phases.jsonl全部保留。实际查看after图并核对App组合：回放隐藏CommandBar，而营地bar原来仅沉浸产生入口。没有把旧V13浏览器结果称为本修复成功。

本轮只改四个生产UI/语言文件：useSettlementUi在普通/沉浸回放均提供独立bar入口，显式依赖tick刷新非响应Game的回放/面板资格；入口跟随opened隐藏，disabled沿blocked/model/canOpenPanel，开面板仍走原host门槛。局部presentationBusy与共享模块约定一致，仅暂停live展示，replay/seek保持只读可查看。SettlementEntry补disabled与min-width44（原min-height44保留）；SettlementPanel加明确回放只读提示，文本登记zh_CN i18n。App、Game、引擎/地形/格式/注册表/所有原fixture均未改；send的回放拒绝及Game.executeCommand原边界保持。

真实客户端SFC挂载覆盖App+CommandBar+营地Entry/Panel及ResidentsPanel，Pixi等视觉兄弟隔离；新普通/沉浸各用新捕获的正常seed3前20公开输入，验证CommandBar隐藏但入口可点击、面板只读提示、camp/build实际控件禁用及事件闭包不改变完整save/双随机状态/ID/Logger、合法wait和原始模块输入被回放边界拒绝，关闭/重开、seek20/0重建、旧回调退役、load正常后原模式入口与命令栏恢复。该短prefix没有可见采集节点，明确不声称采集实际按钮覆盖。居民有数据的控件另用真实controlled resident view挂载：居民选择可用，8个写按钮、fieldset与粮仓写按钮禁用；这是组件测试，不是正常回放中招募/居民重建或完整239/281路线验收。新增session测试覆盖回放忽略live展示滞后及tick重算canOpenPanel。既有测试断言/超时/skip均未改。

所有最终门禁在2633文件source `88ebd9b82ed43520f6f5ebca5edca90eff1ee98c98257d1cf4d87d57b752513a` 前后相同，Node24.19.0绝对路径、3GiB、Vitest最多2worker、串行运行。证据根 `/private/tmp/brogue-commander-20261008-5d1/replay-entry-fix/`：ui-pinned整5文件30pass/0fail/0skip/0todo；static-ui-pinned三i18n/hygiene整文件31pass/0fail/0skip/0todo；boundary-pinned、types-pinned（vue-tsc -b）、实际npm build-pinned均exit0，原log/JSON/argv/源清单/SHA齐全。构建仅P5/dist，Vite既有大chunk提示保留；报告随后仅追加本段，外部READY另列最终含文档source，不能把它说成构建时完整身份。

因果反事实只恢复useSettlementUi的旧bar getter，最终新测试与其他生产分支不动：resident_replay_import_ui整文件5pass/1fail/0skip，普通回放在入口存在断言精确失败，随后finally逐字节恢复到上述门禁source。entry-counterfactual-pinned.report/log及restore.json保留；早期夹具、同步/异步挂载及中间产品/测试修正失败日志亦保留，未用它们冒充最终门禁。四原俘虏raw SHA逐一等旧audit；冻结V13的53产物逐一等原manifest；正式V12性能log等原SHA，未新计时或重新跑drift/full natural/完整全量。外部runtime-delta/preserved-evidence/build-dist-manifest记录核对范围；本轮候选仍需另进程独立审查、父级固定新source/build并完成真实完整路线与44px测量，未commit/push、未派代理。


### 径向菜单静止手势修复候选（2026-10-09，待独立代码审查/新浏览器）

父实际radial-probe-v15-run-01退出2，原结果保留：1440 click/250ms mouse hold两项有效、0新输入且展开；390/320各tap与250ms touch hold共四项可信down/up各一次、同坐标，DOM物理命中pickup，新增一条原生pickup且收环，但随后旧探针的严格事件前缀检查失败。本轮完整读取六份before/immediate/after/事件/结果并实际查看320-native-tap/after.png；没有把总exit2说成通过，也没有把其他PNG哈希核对说成视觉验收。原RADIAL-PROBE-PREP-READY“headless与保存浏览器一致”措辞不准确：实际原save run.options.headed=true、probe headless=true，仅browser版本145.0.7632.6相同，不宣称同GPU/显示环境；原记录不回填。

独立纯数据归因：四项原281前缀只在索引280的fullCheckpoint与chainDigest有差，其他原事件全部相等。Game.recordInputEvent会移除此前导出末条非256边界的临时完整checkpoint并重算链，exportRecording/finishRecordingPrefix给新的末条加完整摘要；这是既有规则而非旧前缀被改写。调用原compareRecordings continuation得到281、ui-envelope.sameUiWorld六项全部相等；额外按固定V15纯C5 canonical/正式root+chain算法校验每个完整/事件根和每条链，精确期望仅旧尾full→null及相应重链，固定256边界及新尾仍严格。五种旧full/chain/早期hp/固定checkpoint/新尾root篡改均拒绝。证据radial-fix/v15-attribution.json记录逐字段前后值、实际事件坐标/时长及原SHA；这解释探针保护失败，不修改原run-01或把旧运行改成成功。

生产仅RadialCommands.vue：记录同一pointer的起点/是否实际移动，8 CSS像素hypot阈值过滤轻触/静止按住/小抖动；布局移动本身不能拖选，只有同pointer真实移动后释放点才命中菜单。保留原公开dispatch、一次选择、直接菜单click、第二次hub关闭、Escape/外部关闭及拖选；cancel/lostcapture、不同pointer和卸载清理，卸载后旧callback不再派命令。CSS、命令表、Game/引擎/RNG/格式/冻结接口均不改，没有采用安全角点替代产品修复。

在现有theme_shell_fixes真实客户端SFC renderer补11项：Vue更新后CSS内移模型下静止0/250ms不dispatch、5px抖动、真实移动一次选择/直接选择、不同pointer及cancel/lostcapture/第二次关闭/Escape/外部/卸载边界；模型不是新浏览器证据。原19项测试体与断言不变，仅host补原生DOM/pointer接口。新最终测试配旧产品的单文件反事实22pass/8fail/0skip、exit1，含静止手势精确派出pickup；finally逐字恢复新源码。正常修复UI整4文件86pass/0fail/0skip；i18n/hygiene整3文件31pass/0fail/0skip；boundary、vue-tsc -b、实际npm run build均exit0，Node24.19.0/3072MiB/最多2worker/串行，五门禁source前后同`a2413ae77809317a175b22057be5878d058786ae8029da13f5a1b56278e4c8cc`。P5自身dist更新，Vite原chunk提示保留；报告随后只追加本段，最终含报告source另列外部READY，不冒称构建时完整身份。未重跑perf/长自然/全量/drift。

外部radial-fix-probe修订短探针保留相同六个默认中心手势及原deadline/真实API/触控模拟范围，唯一必要逻辑变化是接受父实际新绑定与上述精确尾比较，另纠正环境描述；prepare-inputs.mjs只接受真实binding路径/SHA，核原storage origin5446及新生产差量仅Radial（其他允许测试/文档），不会猜新sourceHash/伪造candidate/改存储或原录像。四外部mjs语法exit0；未运行准备脚本或新探针，父给真实冻结绑定后再准备并执行。radial-fix-probe/syntax-check.json与RADIAL-FIX-READY列参数。旧V15构建53产物及原run/旧准备文件、四原raw、V12性能log均核SHA保留；新浏览器六项零输入、真实拖选和完整QA仍待父独立复验。本轮未commit/push、未派代理。


### V16 两项真实 UI 失败的最终修复候选（2026-10-09，待独立审查/父级真实浏览器）

父真实 radial-v16-probe-run-01 总exit2全部保留：桌面两原地和两inventory、320真touch drag共5例通过；390/320 tap/250ms hold四例complete=true且各一pickup，320direct不完整，不能称十例过。父parent-v16-radial-click-attribution.json及实际after原事件确认同touch pointerId的hub down/up同坐标，随后lostpointercapture、trusted click落到移动后pickup。旧8px条件只拦release，item click仍直达run。本轮不回填旧结果；无新浏览器运行。

RadialCommands.vue以hub-origin pointerId跨pointerup/implicit lostcapture/cancel/闭环保留click所有权，item click据所属手势拒绝兼容click及owned drag中异pointer激活；document capture阶段下一次真正pointerdown更新手势，允许同ID的新直接点项。detail=0键盘项激活保留；不加时间禁点、不改CSS/动作表，不改变真实8px drag的一次公开dispatch、hub正常展开/收起、Escape/外部及卸载退役。新增9项真实SFC事件序列模型：四条原坐标/0或250ms的pointerup→lostcapture→item click路径、下一次真tap、drag后另一项click至多一次、cancel/lostcapture/闭环及键盘、异pointer。isTrusted字段是模型输入，不冒称浏览器生成事件。

居民source399 UI402→403原plant(24,21→30,[31])失败exit1/0528原图/JSON保留。原稿语义见task§2/§5：同camp实际固定箱/田地，但不从未见格泄漏对象。按父本轮明确裁定新增StructureProduction只读jobTargets metadata，仅当前层可见居民的家营、owner/region/层/合法chest/plot匹配，格已探索或在自建construction记录（供给箱由establish创建）；只含ID/坐标/revision及plot名key，不含隐藏箱items/容量/锁粮或账本。通用boxes/components仍当前isVisible过滤，粮仓仍原visibleBoxes，不扩大其它模块投影或修改冻结SDK。view.ts增加显示DTO，ResidentsPanel按选中居民camp给source/destination/plots；haul Item列表仍只从可见box.items读。useSettlementUi在发送时重新从同可信metadata取CAS revision，缺目标/不可见haul源直接拒绝，仍唯一executeCommand与原合法性/付时/原子校验。目标/居民revision、库存、camp/depth/可用状态变更清草稿，replay/旧session写拒绝不变。Game字段、命令合同、基础版本、录像/存档/摘要/RNG及九冻结SDK、原fixture/route/seed/ID未改。

现有resident_replay_import_ui整文件新增一项实际正常seed28前398命令、最多15秒回归；其展开的前398 action/data/decisions逐一等父原UI955 raw（外部natural-prefix-input-proof.json），未改可见位/actor/库存/ID。现场assert观测箱30(24,20)/plot31(23,20)的isVisible均false，原view.boxes只有21/components无31；新home45 metadata给21/30和31且箱30只3个metadata键。真实SFC原生v-model监听器选择21/30/31，实际session提交恰好一条原source399 payload（state14/camp45rev2/actor24rev1/box rev2/0/plot rev0），原命令成功、同actor plant、tick41000/HP30。投影/选项/草稿前后完整save、双RNG、ID全同。相关负例覆盖外层/owner/region/未知非自建plot/非chest、未提供目标、隐藏haul源、CAS更新/删除/不同camp/depth/不可用DTO与replay旧callback；逆向边界fixture/DTO改动只在自然正例后，明确不作为原398布景或真实浏览器证据。原隐藏库存/只读居民断言保持。

两个单变量反事实原测试断言不变：只回退Radial生产文件，整文件30pass/9fail、exit1；只回退StructureProduction原visible-only投影，最终整文件6pass/1fail、exit1，新增岗位测试在metadata缺失精确失败。finally逐字恢复。较早projection反事实2fail/5pass也保留，当时granary误共用岗位boxes导致旧readonly前提额外失败；随后将粮仓列表保持原可见来源，最终反事实只有新增用例失败，未修改旧断言。初次CLI --minWorkers不受Vitest4支持exit1/0tests、首次实际related45pass/1fail（测试host在原生loadReplay关面板时null render）、首次types exit2（三个新host类型/ES2021接口错误）均保留并修正，没有调整原超时/skip或弱化语义。

实际最终门禁全部Node24.19.0绝对路径、3072MiB、Vitest≤2workers，重任务串行，source前后一致为862adc8fef1ea4833d45f42610fb23fff58c2dc77333e833b02d7e0332783173：restored-related整4文件70pass/0fail/0skip，guards-final五源码/i18n/hygiene/membership/structure守卫文件38pass/0fail/0skip，check:modules、vue-tsc -b、实际npm run build均exit0，实际npm run test:drift整5文件8pass/0fail/0skip（66.26s）exit0。精确argv/exit/完整日志/SHA在外部final-ui-fix各*.report.json/log，表中无未执行项。P5/dist本轮53文件登记built-dist-manifest，不把它当父candidate；原Vite chunk提示保留。原已过217引擎/性能核心代码不变，本次新增工作只在只读structure projection入口，不进NPC决策/时钟/needs/jobs调度，不复跑正式perf；额外UI投影成本及父最终浏览器仍需父裁定。未跑全量/CE/删除矩阵或完整self路线。

代码完成后、追加本段前已封存只读code-input/2633文件及code-manifest（final-ui-fix/code-freeze.json），可供独立审查；只有五生产文件及两个现有测试文件相对V16变化。此段是随后唯一doc差量，最终含文档SHA见外部FINAL-UI-FIX-READY，不能冒称上述npm build的完整源身份。V16快照、原失败/raw/QA及已有严格比较器保持原字节。父后续独立审查后重新冻结绑定/构建，跑原十手势和完整正常居民UI路线；纯tests不能宣称真实问题已关闭。本轮无browser/代理/commit/push。


### 相同 DTO 刷新的居民草稿修复（2026-10-09，待独立复审）

独立 final-ui-independent-review/independent-sfc-03.log 两项实际 SFC 失败保留：同值新 DTO 与真实 session.refresh 清空 source21/destination30/plot31 并覆盖编辑排班。根因为 ResidentsPanel 单 getter 每次返回新数组；本轮仅一行改为两个标量 getter 的多源 watch。其它四个上一轮生产文件逐字不变，全部原测试前缀保留；不修改独立审查、QA、旧快照或失败证据。

在原正常 seed28 前398公开输入的真实 SFC 上新增两项刷新反例，覆盖箱21/30、可见物品23、田31、数量4、work12/rest6及居民24，两次同值对象替换/真实 session 重读均应保留；另九项负例覆盖居民切换/删除、camp/depth、目标或居民CAS、目标删除、blocked及不可用。编辑及读回只接事件spy，完整save、双RNG、ID不变，负例只改显示DTO。先以与旧冻结版相同的生产字节实跑，两个新增正例均失败（exit1；16项为定向过滤未执行），再改 watch：定向11pass，原四文件整批81pass/0fail/0skip；五守卫整文件38pass及地形源码白名单1pass（29项定向过滤），check:modules、vue-tsc -b、实际npm run build均exit0。初次辅助读回对Vue代理structuredClone导致两项DataCloneError，只修测试序列化后才取得有效产品反事实；首次失败仍保留。

各门禁Node24.19.0、3072MiB、≤2workers、重任务串行且源起止一致为3b73aad5b90880b0a7fd9f6f2853ef149343bb51a67c126c3b66de457d1d981b；新final-ui-draft-fix/code-input与manifest封存2633文件，外部FINAL-UI-DRAFT-FIX-READY先写、本段随后作为唯一文档差量追加，最终身份见doc-delta.json。纠正上轮“native217核心均不在差量”的泛化：StructureProduction是引擎文件，上轮已改其只读UI投影，不能声称整个引擎文件集合未变；Game与居民/时钟/needs/jobs执行热路字节保持，本轮仅UI watch变化，不重测drift/perf，不冒称投影成本已复测。无browser/代理/commit/push；原独立失败不改写为通过，交新固定代码独立复审及父V17最终冻结。
