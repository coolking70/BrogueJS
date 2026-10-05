# 3d 韧性、硬直、确定弹反与单一战斗栏

日期：2026-10-05 UTC。分支 `ext/phase3`。仅实现已批准 P3-D04=A；无免费反击、无 3e 篝火，不合 main、不打 tag、不部署。

## 基线和版本

开工工作树干净，HEAD 为已接受 3c `a34b0c283b7ff0679d2bb3acb4fdf45a2f8f765b`，origin 为实际 `https://github.com/coolking70/BrogueJS.git`。第一次普通 fetch 未更新显式 remote-tracking 引用，随后用完整 refspec fetch 和 `git ls-remote` 核验 hosted foundation 同为 a34b0c2；merge 为 Already up to date。没有使用旧脏树或覆盖 4b 历史。

combat module/rules **1.3.0**，生产状态 **schema 3**。模块数据 schema 仍为1；精确 manifest/指纹和状态校验拒绝旧版本，不迁移。foundation/native/whole-run/replay 格式版本没有新增全局字段。所有新增机械数据仍在 combat 的唯一 actor ledger；未加 Game 实例字段。

开工与开发末段核对时，阶段4分支 `413303d5225dfa4139ed8f329aa51ac506624cad` 的 4c 固定部位仍未进入 foundation。已阅读 `phase4c.report.md` 了解已发布 prepare/native apply/provider commit、fallback 互斥和回滚合同，但本步**不提前实现/替代底座协议**。若最终 foundation 不含4c，则 combat part-break provider 明确延后，不能把现有独立实体 poise 叫作复合核心或部位破坏联动。

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

最终相关集合、构建、组合 smoke、最终 foundation 检查和源散列在交付时追加。浏览器真实像素/触控目前未验；SSR和CSS源码回归不能冒称320px实际布局通过。
