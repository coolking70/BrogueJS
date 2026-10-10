# 5D2 实施及第1轮修复报告（2026-10-09，未提交）

## 维护者最终验收

5D2本步验收通过，已提交并推送 `ce7a2da3aaa8e454af69a588cec7857fb7db5f33` 至 `ext/phase5`；发布状态以[当前状态](commander-status.md)为准。第1轮独立审查确认的R1（缺失production坏档）和R2（取消后待交付数量放大）均由原执行者修复；第2轮独立复核关闭两项，窄测9项通过、14项未选中，exit0，覆盖坏档拒绝且live会话保持、合法取消/拆箱/次周期交付及存读不重复。两轮额度已用完，不再追加审查或证据封存。

本步范围内无剩余已证实玩法或存档录像缺陷。沿用实施门禁和受影响复测结果，不将初次27文件382通过1失败或drift9通过3失败改写成首次全绿。完整门禁、组合/删除、浏览器/真机与最大世界性能等覆盖缺口继续登记[5Z](phase5z-remainders.md)。下文实施和修复记录保留当时事实，历史“未提交/待父”措辞由本段及当前状态覆盖。


基线为`ext/phase5` / `e0fa39a225428d36e6e342f6585f57f45960e6ba`，开工干净。5D1 `f067e89`和5G集成`467962b`（含`eda3094`）已由父提交推送。本进程只实施、第1轮修复及相关测试，没有派代理、commit、push或开始独立审查。授权及可逆数值见[任务书](phase5d2.task.md)。完成交外部READY后停止写入；父最多两轮独立审查，后续提交由父执行。

## 交付行为

公开`order-work/resupply-work/cancel-order`通过原Game命令、原生确认与营地/居民/箱/设施/田地revision和inventoryStamp双验CAS。下单一次预留全单真实输入、工具和输出/退款容量；1…16批，每plan总寿命32个绝对1000tick周期，停工也耗寿命。公开补给重验资格/物料并分配新planId，保未完同票据、信用、escrow和绝对日配额。No/陈旧/重复/坏参数不扣实物或时间。容量不足提前拒绝；危险/失能保票据停工，显式合格补给再开工。取消、死亡、离队、拆设施走单一退款所有权，不吞物或重复兑现。

农夫最多6格，每格每绝对32000tick营地日最多1作物，每批消耗1种子、1000有效tick产生1作物；猎人1000有效tick/肉，每人每天最多2肉。厨师每500有效tick加工3作物或2肉或5带food.ingredient.mushroom标签的食材，需灶台，输出固定无特性原生ration_of_food。真实foraging生/烤/不同种可混同类账单，焦炭拒绝；没有食用/火接触/揭示/原效果，原生FOOD进入真实粮仓后由原日粮消费。settlement自有灶台木4石4/300tick，不依赖peer。

crafting新增同步只读`crafting.recipe-catalog.v1`；底座对目录的owner/ID及实际注册定义核同并稳定排序。缺席/unsupported降级，坏值/异步/异常/越权显式C5_PROVIDER并恢复入口图；NPC不获任意玩家命令权，不跨模块读JSON或复制crafting planner。当前offlineEligible chest-kit及bed-kit沿真实工位/工具/原配方账单和owner事实提交；已有chest-kit实物用例覆盖settlement+crafting及再加foraging。

中文名册提供配方/源目标箱/工位/批数、订单剩余周期、完成数、停工原因、取消和补给按钮；沿原模块面板/Dialog/键盘归属。DTO只列合法可见居民及公开目标元数据，不泄露隐藏箱实物；回放只读，session替换清草稿，同值DTO保草稿。普通/沉浸/窄屏仍用原布局，本步没有真实浏览器矩阵结果。

## 时钟、事务与唯一根

持久状态扩展world5.orders的production、offline.pendingOutputs/productionQuotas及可信terminalTickets的residentOutput；复用world5.tickets/containers、原WorkDetails及居民引用，无第二份模块库存/订单/需求时钟，无新Game/Item/Creature字段，无新随机流或scheduler。原actorActions支付在场劳动；移动/战斗/escort/休息不计生产信用。离场冻结设施、威胁、合法路线和旅行预算，只计别层真实simulationTicks；墙钟、读档、查看不生产。农田各格旅行按冻结路径预算扣除。

ResidentNeeds按共同绝对时间线：先交付上一周期产物，日界先日粮/住房，再用真实ticket/escrow只读DTO调用纯ResidentOrderEconomy，100/50/0/0效率与整数余数。最多32生产周期及一次延迟交付，长尾用既有闭式needs，不逐tick/日重放；同周期下一订单和日粮不能消费本周期产物。旧空订单/两份投影库存不再承载居民生产；通用WorldSettlement正式生产效果须显式校验参与者，不开放fixtureEffects豁免。

最外层transactResidentWorld结合runtime事务，覆盖world5、真实Item根、模块state、原actorActions、ID、双随机、消息和收据。失败恢复原对象图与引用，保留此前已支付原生时间b。runtime.worldWorkFact锁存真实replaceState失败，即使crafting既有容错参与者捕获异常，底座仍拒绝并共同回滚；没有改旧参与者不抛异常合同。完成/取消/需求事实按同一发生时间排序，避免whole/2/17分段改变收据。待下一周期产物有唯一ticket或terminal所有者；取消不提前交付，目标箱毁坏保原截止时间并最终形成唯一地面Item。terminal清理保护待交付owner。

严格save/load跨引用校验订单/居民/home/票据/实际配方/输入账单/工具/预留/延迟输出/日配额/容量及冻结资格。旧格式拒绝，不迁移；load/seek不偷结算。正常新局公开398事件前缀后下猎单、真实肉、保存/录像/seek/续录完成0 OOS；prepared场景仅作局部规则/失败图/极长尾证据，不称自然玩法路线。

## 版本及格式归因

| 身份 | 原 → 当前 | 原因 |
| --- | --- | --- |
| foundation | 11 → 12 | 生产机械语义、软目录及摘要参与状态 |
| world5 schema | 2 → 3 | 严格订单进度、待可用产物、日配额 |
| ResidentEconomy / WorldSettlement经济合同 | 1.1.0 → 1.2.0 | 有限生产可信DTO/提交语义；不改冻结SDK合同 |
| settlement module/rules | 1.1.0 → 1.2.0 | 自有灶台/食材/原生口粮/配方与公开命令 |
| settlement state / whole-run / recording / origin | 2 / 6 / 4 / 2，保持 | 新持久根在world5；原生实体与容器外壳保持 |
| crafting module/rules | 1.0.0，保持 | 内容配方不变；新只读能力及底座语义由foundation12拒旧 |
| worldSdk / edibleSdk | 1 / 1，保持 | 九冻结SDK未修改，沿用实施时已核对的结果 |

一次身份/定义数据单变量反事实保生产算法，旧seed28初始摘要重新匹配；随后按原公开方法重录crafting、foraging A/B、resident自然/俘虏checkpoint及giants三trace扩展身份摘要，命令/判定/非摘要final不变。原App10/11 raw保留，App12 raw来自原App重执行捕获，不手改raw。受影响fixture类别、捕获方法及验证结果见[格式重录摘要](phase5d2-format-recapture.md)；只保存结果摘要，不保留逐字段SHA清单。经典生成基线/原生黄金不手工刷新。

## 实际验证

所有重任务使用Node24.19.0绝对PATH、NODE_OPTIONS=--max-old-space-size=3072、maxWorkers=1，串行。普通日志在/private/tmp/phase5d2-*.log；没有多版本构建、封存或大截图提交。下表按实际批次记录，不累计重叠通过数。

| 实际命令/批次（统一上述环境） | exit / 结果 | 范围与日志 |
| --- | --- | --- |
| vitest：5个resident_production*文件 | 1；40通过2失败 | 初批，2个新fixture前提问题；final-production.log |
| vitest：production/food/economy受影响3文件 | 1；26通过1失败 | FOOD占槽前提，final-affected.log |
| vitest：上述3文件+crafting_module | 1；73通过1失败 | 三生产文件27项全过，旧API键表待修；final-affected2.log |
| 原方法crafting/foraging捕获（-t） | 0；3项执行通过，8项未选中 | 2文件执行；初regex未选中App，另捕获App1项通过；capture/app-capture.log；不称普通门禁 |
| 原resident两路线格式捕获（-t） | 0；2项执行通过，1项未选中 | 225.16秒，保原非摘要/持久/回放/seek断言；resident-capture.log |
| 身份数据、crafting接口、空根向量、UI组件单变量反事实 | 旧身份/生产文件exit0；当前旧前提失败 | format-counterfactual、crafting-premise、digest-premise、ui-premise日志；首次未登记probe discovery失败不计归因成功 |
| vitest：27文件相关批次 | 1；382通过1失败 | 仅旧空根身份；468.29秒测试时间，related-final.log |
| vitest：digest及settlement validation/runtime/persistence | 0；4文件51通过 | 仅复测受影响，format-gates.log |
| vitest：resident_replay_import_ui整文件 | 1；17通过1失败 → 0；18通过 | 只读按钮数前提，ui-final/ui-fixed.log |
| vitest：codec/economy最终2文件 | 1；30通过1失败 | 新+0 fixture误调用只允许正数的advanceWorldClock；codec-economy-final.log；经济核11项全过 |
| vitest：availability四边界受影响复测（-t） | 0；4项通过，16项未选中 | availability-fixed.log；不冒充整文件新一批全过 |
| npm run check:modules | 0 | 边界及测试归属；boundary-final.log |
| vue-tsc -b | 2 → 0 | 历史11哈希向量与当前header字面类型冲突；明确hash-only输入类型，生产格式守卫不变；types-final/types-fixed.log |
| npm run build | 2 → 0 | 首次止于同一fixture类型问题；修后实际vite产物，build-final/build-fixed.log；常规大chunk提示未改阈值 |
| npm run test:drift -- --maxWorkers=1（实际仅一次） | 1；6文件9通过3失败 | 144.25秒；只giants三extensionsHash身份变化，drift-final.log |
| descriptor单变量反事实/原giants捕获入口 | 各0；各2文件3项通过 | 保原Native/RNG/commands等全部字段，仅extensionsHash变化；giants-identity/giants-capture.log |
| vitest：drift受影响2文件普通模式 | 0；3项通过 | drift-affected-fixed.log；未重跑已过4文件9项，不声称首批一次全绿 |

经济核11项包含16人单周期与64人×32周期的纯值有界探针，断言分别≤5ms/≤50ms通过；不是完整Game/frame/P95或最大世界证据。最终drift受影响普通模式3项通过；没有剩余已观察到的失败，未重复完整批次。

开发失败保留摘要：早期新猎人场景玩家挡门；新正常seed3路线default休息/尸体原生优先导致无产物，换成正常seed28合法398前缀及公开排班；旧算法分段收据不等已修共同时间线。最终第一批5文件40通过2失败（满仓fixture改坏固定容量、prepared回放非录制定位导致不可见）；修合法满槽实物/受控只读呈现后，受影响批26通过1失败（FOOD按单位占槽而非itemIds）；再次修为真实occupiedSlots。后续4文件73通过1失败，仅旧crafting严格API键表未含新optionalQueries。仅回退crafting/module.ts即旧断言通过，再只加接口键前提、保持精确键表断言；旧容错参与者守卫未改。27文件相关批382通过1失败仅当前空根身份旧向量，descriptor单变量证明后独立SHA修正；4文件51项复测通过。UI批17通过1失败只读按钮数旧前提，单回退ResidentsPanel即通过后仅8→9，18项整文件通过。最后新+0边界fixture把“未推进”误作advanceWorldClock(0)，触发正耗时守卫；修为不调用advance，保边界/存读断言，不改生产守卫。以上不是独立审查轮次。

测试前提变更登记：ext_recording_v4_digest当前codecIdentity数组11→12及空根标准SHA独立重算，descriptor生产文件单变量验证旧向量通过；历史11链向量不变；App正例raw12长度/SHA取真实新导出、原raw不动；resident checkpoint仅摘要叶由捕获重录；crafting模块接口键表加optionalQueries，经生产文件单变量验证；只读UI精确按钮数8→9，仍要求全部disabled且输入/根不变，经单组件反事实。没有加skip、降低断言、延timeout或改生成守卫。捕获使用-t未选中项单列为未执行，不能算普通门禁覆盖。

## 第1轮独立审查修复

第1轮修复完成，待父必要第2轮；候选仍未提交、未推送。父审查确认两项单字段坏存档接受缺陷：R1删除production后居民订单失去管理/有限寿命入口；R2已交付1、取消待交付1时，把pending数量改为2可让2批兑现3肉。本轮全部修复，不将既有通过门禁当成这两个反例的覆盖。

R1在按production过滤前，以真实居民记录/组件识别订单，要求完整production，之后照常验证已注册配方和home/票据引用；通用fixture订单不以缺失进度冒充居民订单。R2在可信world5.terminalTickets扩展residentOutput，保存并严格验证经济层、目标箱、准确未交付数量和拆箱地面坐标；退役数量从活票据输出预留扣除未完成批次得到，不以累计完成数代替剩余所有权。候选验证对所有pending核同目标/层/坐标及全量剩余数量，交付时在原事务内同步扣减，空余额仍可存读。拆箱同步更新已取消票据的地面归属，保持原延迟截止时间。九冻结SDK没有修改，没有新增Game/Item/Creature字段或版本迁移。

新增两项拒绝回归只删除production或只放大pending.count，均断言独立完整对象图审计无差异、runtime/world根引用不换、摘要/随机/ID不变。R2回归同时验证原合法存档load后仅补交1肉，余额归零，再load/settle不重复交付；拆箱正例增加“先取消再拆箱”变体，保原唯一地面所有者、截止时间及存读断言。这些受控劳动边界不称自然路线。

| 本轮实际命令（Node24.19.0、3GB、maxWorkers=1，串行） | exit / 结果 | 范围与日志 |
| --- | --- | --- |
| vitest：resident_production_codec.test.ts整文件 | 0；23通过 | 两项新拒绝、原坏例/provider/writer、取消、两种拆箱、可用性四边界；/private/tmp/phase5d2-fix-round1-codec.log |
| vitest：production/food两文件，-t 'public hunter\|public farmer\|32 epochs\|cached hunter\|cached chef\|registered offlineEligible' | 0；7通过、9未选中 | 真实猎/农、补给、跨层whole/2/17、厨师及两种crafting组合；/private/tmp/phase5d2-fix-round1-production.log |
| vitest：codec，-t 'inflated cancelled\|destroyed destination' | 0；3通过、20未选中 | 收尾补显式经济层shape守卫后仅复测退役数量与两种拆箱路径；/private/tmp/phase5d2-fix-round1-terminal-shape.log |
| node node_modules/vue-tsc/bin/vue-tsc.js -b | 0 | /private/tmp/phase5d2-fix-round1-types.log |
| node scripts/check-module-boundaries.mjs | 0 | 模块边界及测试归属；/private/tmp/phase5d2-fix-round1-boundary.log |

本轮未观察到受影响失败；没有重跑27文件、完整drift、既有自然路线、build或全部门禁，没有临时回退生产源、测试前提反事实、身份重建或新增采证。格式重录文档仅缩为约7行结果摘要，删除逐字段SHA长表，实施阶段实际失败/复测批次及范围限制保留。完整覆盖与采证形式缺口沿[5Z](phase5z-remainders.md)，不另开文档审查轮次。

## 未覆盖及下一步

核心生产闭环及第1轮R1/R2修复完成，待父必要第2轮（总共最多两轮）。完整npm/test:ext、CE全量、128组合/物理删除、最大8营3072结构/满箱长局性能及体积、真实浏览器普通/沉浸/窄屏、真机/原生失焦在[5Z](phase5z-remainders.md)登记。新纯值经济核有界预算检测不冒充5D1正式Game/frame性能或5D2最终最大负载。本报告不宣称已提交、已完整验收或已完成阶段5战争玩法。
