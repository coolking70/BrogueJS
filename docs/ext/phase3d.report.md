# 3d 韧性、硬直、确定弹反与单一战斗栏

日期：2026-10-05 UTC。分支 `ext/phase3`。仅实现已批准 P3-D04=A；无免费反击、无 3e 篝火，不合 main、不打 tag、不部署。

## 基线和版本

开工工作树干净，HEAD 为已接受 3c `a34b0c283b7ff0679d2bb3acb4fdf45a2f8f765b`，origin 为实际 `https://github.com/coolking70/BrogueJS.git`。第一次普通 fetch 未更新显式 remote-tracking 引用，随后用完整 refspec fetch 和 `git ls-remote` 核验 hosted foundation 同为 a34b0c2；merge 为 Already up to date。没有使用旧脏树或覆盖 4b 历史。

combat module/rules **1.3.0**，生产状态 **schema 3**。模块数据 schema 仍为1；精确 manifest/指纹和状态校验拒绝旧版本，不迁移。foundation/native/whole-run/replay 格式版本没有新增全局字段。所有新增机械数据仍在 combat 的唯一 actor ledger；未加 Game 实例字段。

开工时4c仍在阶段4分支；开发中实际 GitHub 的 foundation/phase4 均前进到 `315fd8cb2e570d26f6cc23692f650e19b71005e7`。先保留3d检查点 `62382e7`，再以 merge `6e0e71c` 纳入完整4c历史，之后才实施 combat provider。冲突仅为 Game import 与资格条件，保留两边增量。正式 giants 数据/locale 与 hosted foundation 完全相同，维护者已调整的长录像门限原样纳入，没有另改门限或主动重跑该1174命令测试。

## 数据、费用与唯一时钟

- parry 数据：cost3、window60、recovery100、poiseDamage12、contactRange1。所有值严格有界；费用不得超过适用 profile 的容量，窗口必须正整数且不超过恢复期。
- policy 显式声明 poise 容量/恢复分子分母/恢复延迟、破防结束回值、原生单击 poiseDamage 和 poiseImmune。当前容量12、恢复1/30、延迟40、破防结束回12、原生单击2；现有 breakRecoveryTicks50 保留。招式使用原声明的每段 poiseDamage。
- 玩家、敌人、盟友共用准备、付款、防御、资源计算和恢复规则。现阶段生产身体仍是 independent owner；所有已落地 footprint 均通过底座 contact 获取确定面对方向。未开放未来复合体能力。
- 正 elapsed 由既有前景 scheduler 唯一推进。未结束原生 dodge/parry/stagger 恢复与 idle 的交界拆分，定点余数不依赖 delta 分块；满池不积攒余数。缓存层冻结这些字段，恢复层重建原生 timer mirror，不补发离线弹反/攻击。
- 非束硬直用 actor.staggerRemainingTicks/native timer 镜像；已施放的攻击束用既有 break-recovery，actor 不再放第二个倒计时。原生攻击结束后的恢复取 max(原生恢复,硬直)，玩家不把硬直再累加一次，快 NPC 也不能用 attackSpeed 覆盖更长硬直。
- 当 poise 首次降到0，清除保护窗口，取消未释放子段并进入正恢复；同一恢复期重复打击既不再次扣 poise，也不延长硬直。结束按数据恢复到合法正值。免疫模板拒绝新 poise 冲击；变形前已经发生的恢复继续合法结束。容量变化钳制，不免费回满；克隆不复制 ledger 或活跃窗口。

## 弹反与物理解析

命令是 `{module:'combat',action:'parry',payload:{facing}}` 的严格 ext:command。准备冻结朝向、session/revision、来源修订和资格事实，零费用/时间/RNG；提交重验后付一次费用，写入窗口和恢复。未知/坏输入不冒充成功。方向/确认/返回复用既有 DialogService；parry 本身无位移/攻击目标，不新增环境风险确认，也不借 parry 确认授权后续攻击。

顺序：底座资格/contact → dodge → parry → 原生命中/伤害/盾 → poise → physicalResolved。只处理直接物理，投射物/bolt/reflection/non-weapon、环境/DOT 不隐式获弹反。窗口含开始，不含结束；elapsed 先扣，剩余0的同tick攻击失败。面对方向由实际 contact 的 from/to 八方向决定，同时检查配置距离。不可弹反段和错误方向不消费窗口；成功首次消费，后续同tick命中不会复用。被迫位移（含离开后回原格）、失能、离层取消保护但不退款。

成功返回独立 defended 结果，并分配唯一 causal resolution ID 发布可选 defended 事实；不走 beforeAttack/普通概率骰/physicalResolved，不伪造 positivePhysicalDamage，也没有免费 counterattack。攻击者接受配置 poise 冲击，破防后同一已付款原生横扫剩余目标和 phased 后续段停止。普通攻击仍只付原生一次费用，phased 凭据携带每段已付款 poise 值，不按目标再次收费。

原生 AttackResult.damage 是护盾前显示值，因此 poise 接口使用 CombatSystem 两条原生 resolver 的实际 post-shield hpDamage，不修改 CE 返回值。miss、武器免疫、全盾吸收不伤 poise。成长仍按自己的声明消费逐击效果；新增 parry action 不伪装为 attack，旧 growth 包未声明防御中断便忽略它，没有新增硬依赖/import。

NPC 只对已经提交、可见、打中自身足迹、将在有效窗口内落下的 parryable 预警作防御选择，按稳定 actor/source 次序，不读玩家未来输入、不取额外随机。保留原生生存、恐惧、尸体学习/施法优先级；未配置 profile 的 NPC 继续原生选择，但资源/被动 poise 仍共用。

## 存读、录像和 UI

严格状态验证包括容量/余数/延迟、窗口和恢复的准确关系、过期/已消费窗口不得留朝向、同一 actor 不得叠加两类原生恢复或同时拥有 bundle clock。零 poise 必须由本 actor 原生 stagger 或当前 scheduler break-recovery 持有；拒绝空闲/风摇/别的 actor 伪造恢复。候选世界还验证前景活跃来源和原生 timer mirror，坏档不能退休旧局。

加载仅绑定，不付款/抽骰/恢复/发事实；首次 update 可继续已保存玩家恢复。命令录像、checkpoint、双向 seek 与保存后续录使用同一机械状态和双方 RNG。

重复战斗按钮根因是 useCombatUi 同时在 module bar 和底部 commands 返回整组动作。现在底部 commands 为空，五个动作只保留在 module bar。移动端标签收起、单行不换行，容器限宽且可横向滚动，不再占两排重复控制。弹反方向/成本/窗口/恢复说明走模块本地化与数据 DTO。HUD 的 poise/硬直/parry 与 stamina 都读取同一历史 DisplayFrame；旧 DTO 不凭空补未来值。双击/长按/方向键/Back/Cancel 沿既有输入屏障。

**3c 闪避能力白名单原样保留**：single 和独立 builtin r0 2×2/3×3 方形。任意 mask、旋转、zone、复合体仍拒绝；没有因为4b底座任意刚体而扩张 dodge。

## 实际验证与审查

环境 Node24.19.0，3GiB 堆，至多2 Vitest workers。按授权只跑功能相关门禁；不跑完整 npm test、全部 test:ext、removal、CE full/gen、drift，没有改生成基线/黄金 trace。没有运行或延长 giants_rigid 1174命令长测试的 deadline；其3c已接受的维护者覆盖不在本步重开。

开发过程：
- 数据/纯恢复初次4文件212项通过；审查增加零poise owner和免疫换形恢复后，4文件214项通过。
- UI3文件46项通过；新增 parry UI18项在类型修订后复跑通过。本地化/硬编码静态过滤8通过、21未选中。
- 原生接线5文件278项通过；新增直接miss/immune/hook反例后的3文件98项通过。最后 native epilogue 顺序专项单项通过，非全文件再次执行。
- 新生产初轮14项为8通过/6失败：5项错误假设 breakRecovery80（实际原数据50），1项使用不存在的 fixture.thrust；修正新夹具。其后4个运行相关文件93通过/1失败，唯一失败是旧测试显式要求 schema2。保持所有旧机械断言，仅升级 schema3前提。新增 AI/原生epilogue/defended事实后生产21项全过。
- 类型检查曾发现旧资源DTO缺新增字段、UI测试union属性、recording错误属性名及 Array.at 不在目标lib；按真实 schema、events 和旧目标库修复，未放宽类型配置。
- 独立只读审查指出恢复层错误写 dodge timer、零poise缺恢复 owner、原生epilogue覆盖硬直；均已修复并新增精确回归。没有通过删用例、skip或放宽阈值消除问题。
- 旧 UI 断言修订做单变量反事实：旧重复command的disabled断言在原组件通过，新组件移除重复command后失败；将同一disabled断言移到唯一bar。旧 projection 精确形状/最后动作前提在原 view 通过，新 additive DTO 后失败；保留旧 stamina/dodge 值，新增完整字段并按 ID 找 dodge。

### 4c 合入前的广域相关运行

58文件集合完整执行：**56文件通过/2文件失败，1427 passed /5 failed /8历史 skipped，exit1，393.29s**。三项为新的恢复 helper 在无 combat 的最小原生测试世界中提前读 player；修为先检查 session，未改原测试。两项旧3b生命周期夹具把NPC放在已提交预警中，新AI合理选parry而非attack；隔离副本仅移除新AI选择块，原两项通过。新夹具把NPC移到预警外，仍验证原多段攻击的换形/离层取消和精确恢复。修订后的3个完整相关文件 **55/55 passed**。这是失败后定向复核，不冒充58文件一次全绿。

### 4c provider 和原子接线

注册 **唯一** `optionalPartBreaks['combat.part-break.v1']`，直接使用已发布 `src/ext/partBreak.ts`；该协议文件/签名未改。prepare 仅克隆自身 namespace，检查原始 canonical state 和 receipt；commit 再验后提交同一 next-state。原生 zoneState/broken/generation 是唯一收据账本，重复接触已毁区不再消费，没有第二个破坏 ledger。独立body的 actorId=groupId 是当前 CORE；不宣称4d复合体已经实现。

balanceLoss 按 core policy 扣poise；免疫/已在恢复中/零损失返回handled但不追加冲击。破防才清保护并转入同一50tick恢复；不会额外设置原生 fallbackStun。缺失或明确unsupported仍只用原生fallback。无bundle换形使用当前profile，钳制容量/延迟并清不兼容余数，不回满；busy bundle保持捕获profile。一次规范化和冲击只增一次revision。

为安全消费已发布的窄 setState，本次补齐其与正在解析的生产 scheduler 的接线：
- narrow actor-action provider 写入保持 root/scheduler/bundle/child/phase 对象身份；因果事务失败后恢复原引用及原值，不能留下指向旧state的活跃scheduler
- 捕获 actorActionBinding 独立于 provider，故 absent/unsupported/其它provider的失败也恢复combat图，而非只恢复有provider的情况
- mechanical zoneBroken（速度、3b取消、原生timer镜像、hover/瞄准清理）进入同一既有 commitPartBreak 事务，Game内部checkpoint恢复native时钟/速度、派生changedSources/scheduler fault和录制有效性；不新增Game字段
- 两个同tick owner可能都处于0边界。仅同步事务校验允许**原状态已经到期的同一 action/child/phase 标识**，不能制造新0边界；持久化codec默认仍拒绝0，load/save没有放宽
- dispatch在native resolver后保留provider插入的正break-recovery，不能再把它推进掉。原生单击poise采用4c实际传导的post-shield/post-zone数值，局部装甲完全吸收也不额外扣poise

新增provider41项和defense-state51项 **92/92通过**。真实生产接线16项、现有giants zone25项与底座协议31项合计 **72/72通过**：包含part-break耗尽核心poise、排斥fallback、原生receipt一次、未付费prepared plan回滚、active图引用回滚、provider在setState后throw/错误返回/Promise、过期capability、机械取消后revision预算失败（combat安装但provider缺失/unsupported）、两个同时到期原生owner及当前解析source插入恢复。诊断场景与自然生成证据分开，不把它们叫作自然boss通关。

开发中的接线初次90项运行88通过/2失败：一个过期capability错误字符串改变，恢复包含旧`outside`约定；一个新load夹具在捕获旧局快照前创建了另一个headless Game、重置全局entity allocator，改为先捕获再建新Game。随后旧giants集合有3项设计前提失败；隔离副本仅取消combat provider注册后，5个原相关用例通过。最终夹具按已安装combat判断fallback/poise、只断言未支付玩家资源，显式fixture provider替换默认provider而不注册两个竞争者。没有削弱原一次命中/传导/事件、护盾/取消回滚和坏档断言。

最终64文件相关集合、构建、组合smoke、最终foundation检查和源散列在交付时追加。浏览器真实像素/触控目前未验；SSR和CSS源码回归不能冒称320px实际布局通过。

## 最终交付门禁与剩余范围

- 4c整合后的64个相关文件：**64/64通过，1596 passed /8历史 skipped，exit0，416.34s**。清单 `/tmp/phase3d-4c-related-files.txt`，日志 `/tmp/phase3d-4c-related-stable.log`。该集合的893个源/config输入 SHA-256 为 **e086adf35d45b62b9f894e66212728e9ff06c2c1883c7a4a39e126a186a337f8**，运行期间未变。
- 随后自行发现 checkpoint 未包含 dormant/pending cohort。新 dormant 回滚反例在旧实现明确失败（速度150未回到100），改用既有 `actorActionWorld()` 权威实体集合后，5个完整直接相关文件 **107/107 passed，exit0，48.49s**。新增实际NPC成功弹反的录制用例明确断言3次defended事实，并验证causal ID/RNG、逐事件checkpoint、双向seek及保存后续录；整个 parry 文件 **22/22 passed，exit0，18.61s**。
- 上述最后修改只涉及 Game 内部checkpoint的一行实体集合选择和两个测试文件，没有更改任何其它运行机制。最后源集合893文件 SHA-256 为 **edd3e4e6aff9c9cf7c0303a69dd09b694f872b51456a2a583e14c5aaf19b89dc**。64文件结果属于前一冻结集合，最后的直接受影响复核、type/build/组合smoke属于最终集合；不混称全部在最后字节上一次重跑，不把重叠结果相加称唯一测试总数。
- 最终 boundary / vue-tsc / production build / diff-check：**exit0**。构建只有既有大chunk提示。一次并行build工具会话在审批审核环节被取消，日志停在启动，没有编译错误也没有完成结果；该次是未完成，不算通过，已在最后候选完整重跑成功。
- 最终5个真实Game相关子集 smoke（combat、combat+growth、combat+giants、combat+growth+narrative、全部四模块）：**5 passed /26名称过滤，exit0，13.27s**。不是全子集矩阵、不是浏览器。
- 完成前再次使用完整refspec fetch、实际 `git ls-remote` 和 merge，hosted foundation仍为 **315fd8cb2e570d26f6cc23692f650e19b71005e7**，merge Already up to date，已是本分支祖先。正式giants数据/locale相对它无差异。保留tmpdir可移植性修复和上游历史。
- 独立只读审查覆盖最后delta，无剩余源码blocker。未跑完整npm test、全部test:ext、物理删除、CE full/gen或drift；未重跑giants_rigid1174命令长测试，未自行改其门限。没有宣称这些未跑项通过。
- **浏览器像素和触控仍未验证。** 将提供唯一稳定轻量DEV QA包和指南；真实320/390/桌面普通/沉浸验证由支持的浏览器执行。截图只留QA本地，包内不含截图。若父任务后续完成浏览器验收，记录应另列实际布局/模式和结果，不能用SSR/引擎检查补称像素成功。

停止在3d。下一步篝火/3e、完整3f收尾、main/tag/部署均未执行。

## Mac QA 后续：传输阻塞，未执行像素用例

2026-10-05 UTC：新的 Mac 官方 IAB 能力检查已有响应；不能再用旧会话失去工具说明本次浏览器不可用。随后通过官方 Library 流程取得本次稳定 QA 包时，两次受支持的下载尝试均在 DNS 解析阶段失败。一次新建的受支持重试耗时0.097秒，错误链为 `URLError → gaierror [Errno 8] nodename nor servname provided, or not known`。

这两次结果没有进入 HTTP 响应，不能据此声称链接过期、权限拒绝或浏览器阻止访问。Mac 未取得文件字节，故没有本机包哈希核验；没有打开本次候选画面、执行浏览器用例或生成截图。先前源码、引擎、类型和构建证据不受这项传输失败影响，但不能替代真实像素验收。

已停止本轮 QA 和下载重试，没有改走其它路线规避限制。维护者已询问是否按与3c相同的条件方式交付；截至本补记，用户批准仍待取得，因此没有发布分支。本补记仅更新报告，不修改源码、数据、测试或稳定 QA 构建。最终源码散列仍为 `edd3e4e6aff9c9cf7c0303a69dd09b694f872b51456a2a583e14c5aaf19b89dc`。
