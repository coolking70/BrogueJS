# 6B2 实施报告（交审候选）

开工 `ext/phase6 / 9ab574550dabb88f6cfa9b1e94e6a5fa8450b737`，工作树干净；未 commit/push。维护者已批准任务单 §7 七项 A。单主笔，无子代理。首次实施 D4 先交基线；第 1 轮审查修复时维护者已裁定 D4 数值平衡整体延后。D7 浏览器由维护者执行。最新交付见文末“审查发现处理”，此前候选身份/全移除记录保留为历史证据。

## B2-0 合同与范围

- 通用 `ModuleUiSession.itemActions(itemId)`，共享背包/详情通过 injection 接入；不私引 loot、不传原始 Item props。宿主 `beforeOpenItemPanel` 核验并转换显示入口。无新增 Game 字段。
- 模块适配层查实际背包/装备/可见地面/可达已知容器。幻觉地面无入口；容器只用已有 WorldWork read，无新的取回命令。
- 正式详情去掉 β 基础公式。比较保留六标量，新增命中值、移动 tick、恢复强度、火/毒抗性 bp、潜行格数、搜索、透视、光照、转移/收割/充能、寻宝 bp、可选体力/韧性容量恢复；基础六行常显，其他按相关性展开。命中值不等于目标命中率；tick/潜行范围/物理输入承伤越低越好，其他越高越好。没有 growth 能力，不显示虚构属性。
- D5 新增 `ItemTriggerFact` 的 `stat-commit` 分支：宿主提交键与目标 tags，模块纯匹配非符文非零来源行，准备全部候选后统一提交。查询、load 重建及重复 reconcile 不发事实。容量/常驻/命中/时序以真实参与结算为准，包括负面与封顶；抗性须真实少受伤，恢复允许分数进度，资源 proc 须真实变化。
- D6：loot module/rules 0.2.0→0.3.0，静态 pack 仍 0.1.1；state 1，foundation/whole-run/recording/origin 15/7/4/2 未变。共享新增可选结算方法，无新持久结构，worldSdk/edibleSdk 不变。

## 分步进度

B2-0 裁定已登记；B2-1/B2-2 游戏接线已落盘；B2-3 D5 适用非符文路径已补齐，证据见下表。B2-4 基线已交，数值平衡按维护者最新裁定整体延后；B2-5 以限定门禁结果交审，三档浏览器由维护者执行。不是发布结论。

## 验证记录

- UI inert 旧生产基线：3/3，exit0，2.54s，`/private/tmp/phase6b2/ui-inert-before.log`。生产挂载后预期仅“未挂载”旧前提失效；继续保留共享导入/纯展示/预览隔离断言。
- 首次 UI 类型检查 exit0；D5 初次类型检查暴露错误读取 `enchant2`（本项目字段为 `staffRechargeRemaining`），已改生产字段，未改守卫。

## 待维护者浏览器复核

最终生产构建按任务单 §5.2 的全部十项执行，320×568 / 800×900 / 1440×900 分别登记通过、失败、步骤、控制台和仓外截图。当前全部未执行，不能以 SFC 测试代替。

## M4 基线（B2-4 停点交付，未改曲线）

当前 module/rules 0.3.0，原 hp/damage/accuracy 曲线保持。小型汇总见 [M4 数据](evidence/phase6b2-m4.json)，重跑入口 `node src/ext/modules/loot/tools/loot-balance.mjs /private/tmp/phase6b2/m4.json`。原始数据与日志为 `/private/tmp/phase6b2/m4-baseline-final.json`、`m4-final.log`。

口径：D1/5/10/15/20/26 × scarce/standard/bountiful × 3 个固定种子（104729、13007、65537），每种子由真实 rollLoot 依次生成一武、一甲、两枚不同实例戒指，不拼四个独立最大值。按整套管线击杀时间代理排序标低/中/高。正常开局原生力量12，装备加力正常物化；未注入力量药水或假定深度力量曲线，无 growth。原生附魔为真实生成值，未额外强化；未鉴定/熟悉状态和全知机械上界分别登记。各深度目标为 rat/goblin/ogre/troll/golem/dragon 的普通近战，真实 hostile 自身深度与生命倍率。装备不足力量仍允许穿戴，按实际惩罚求值。

以下 **固定装配实验** 不是自然通关难度。T 为 200 次上限的实际连续 CombatSystem.attack 累计攻击 tick，未击杀标 `>`；没有把它冒充含追赶/怪物 AI/休息的完整决斗。TTK 代理按实际命中、物理求值和攻击时钟计算，独立承伤实验从满血开始；EHP 按10点物理输入求值，仅为代理，和抗性/实际攻击分列。该三样本预算没有均值置信区间，不能证明全局平衡。

|深度|预设|档|实际力量/不足|伤害范围|命中%|攻击tick|敌HP|实际击杀T|承受攻击数|恢复HP/回合|EHP代理|
|---|---|---|---|---|---|---|---|---|---|---|---|
|1|scarce|low|12/5|4–6|45|100|6|400|28|0.099|30|
|1|scarce|mid|12/7|3–4|85|100|6|300|16|0.099|30|
|1|scarce|high|12/5|3–4|100|100|6|200|18|0.099|30|
|1|standard|low|12/5|4–6|45|100|6|400|28|0.099|30|
|1|standard|mid|12/7|3–4|85|100|6|300|16|0.099|30|
|1|standard|high|12/0|3–4|100|100|6|200|28|0.099|30|
|1|bountiful|low|12/5|4–6|45|100|6|400|40|0.119|36|
|1|bountiful|mid|12/7|3–4|85|100|6|300|16|0.099|30|
|1|bountiful|high|12/0|3–4|100|100|6|200|28|0.099|30|
|5|scarce|low|12/3|1–3|54|50|18|950|12|0.132|20|
|5|scarce|mid|12/3|1–3|54|50|18|750|14|0.099|20|
|5|scarce|high|13/1|6–9|74|100|18|400|13|0.099|20|
|5|standard|low|12/3|1–3|58|50|18|750|16|0.099|17.647|
|5|standard|mid|13/2|2–3|63|50|18|800|12|0.132|17.647|
|5|standard|high|12/2|7–10|64|100|18|400|8|0.176|17.647|
|5|bountiful|low|12/7|1–3|57|50|18|950|8|0.132|15.789|
|5|bountiful|mid|12/3|1–3|64|50|18|750|14|0.099|15.789|
|5|bountiful|high|12/2|7–10|82|100|18|400|8|0.176|15.789|
|10|scarce|low|12/8|7–9|12|200|74|7000|2|0.099|18.75|
|10|scarce|mid|12/5|1–3|28|50|74|7050|2|0.099|18.75|
|10|scarce|high|13/2|5–6|32|100|74|6000|5|0.24|25.625|
|10|standard|low|12/8|7–9|12|200|82|8600|2|0.099|15|
|10|standard|mid|12/5|1–3|28|50|82|8500|2|0.116|17.5|
|10|standard|high|14/1|5–7|38|100|82|4000|6|0.211|25.263|
|10|bountiful|low|12/8|7–9|12|200|82|8600|2|0.129|16.25|
|10|bountiful|mid|12/5|1–3|28|50|82|8500|3|0.225|21.25|
|10|bountiful|high|15/4|8–12|48|88|82|1056|2|0.149|18.75|
|15|scarce|low|12/7|4–7|13|100|87|14600|2|0.099|20|
|15|scarce|mid|12/1|3–4|34|100|87|7900|2|0.099|20|
|15|scarce|high|13/3|11–18|24|200|87|4400|4|0.212|42.667|
|15|standard|low|12/7|4–7|13|100|97|17800|2|0.099|15.789|
|15|standard|mid|12/1|3–4|34|100|97|8400|2|0.099|15.789|
|15|standard|high|14/2|13–16|49|200|97|1700|3|0.099|15.789|
|15|bountiful|low|13/0|4–5|40|100|97|6100|3|0.132|13.636|
|15|bountiful|mid|13/3|11–14|35|200|97|4900|2|0.146|19.13|
|15|bountiful|high|16/3|8–13|24|100|97|1800|3|0.132|13.636|
|20|scarce|low|12/7|4–7|13|100|540|>20000|5|0.099|20|
|20|scarce|mid|12/7|4–7|13|100|540|>20000|4|0.233|20|
|20|scarce|high|12/7|3–7|24|41|540|>8200|3|0.233|20|
|20|standard|low|12/7|4–7|13|100|600|>20000|4|0.099|17.647|
|20|standard|mid|15/4|7–11|21|100|600|>20000|3|0.176|16.667|
|20|standard|high|12/7|3–7|30|41|600|>8200|2|0.233|15.789|
|20|bountiful|low|12/7|4–7|16|100|600|>20000|2|0.176|13.636|
|20|bountiful|mid|12/7|3–9|37|50|600|>10000|2|0.099|13.636|
|20|bountiful|high|19/0|16–26|48|100|600|5700|10|0.31|14.286|
|26|scarce|low|12/7|3–5|10|100|187|>20000|1|0.099|23.077|
|26|scarce|mid|12/6|5–9|11|100|187|>20000|1|0.714|23.077|
|26|scarce|high|14/2|11–14|22|200|187|7600|1|0.099|23.077|
|26|standard|low|12/7|3–5|13|100|210|>20000|2|0.422|48|
|26|standard|mid|14/2|11–14|22|200|210|9000|1|0.22|31.25|
|26|standard|high|13/5|8–14|17|100|210|10900|1|0.099|18.75|
|26|bountiful|low|12/4|8–10|16|200|217|20100|1|0.099|15.789|
|26|bountiful|mid|14/5|15–30|16|100|217|5900|1|0.176|27.895|
|26|bountiful|high|16/3|13–19|25|100|217|6700|2|0.817|58.333|

正常路线为3条**无状态注入、知地形的下楼路线**；不等同人类充分搜刮/选装策略。分别 seed7：105步、死于D2；seed26：141步、死于D3；seed42：119步、死于D2。均原生力量12、起始匕首与皮甲，未获得可用的已知力量药水。三条当前版本 save/load、完整 replay、seek 均通过；死亡后 escape 续录也通过，但不冒充“活着继续游玩”的续录覆盖（活局链另用本轮 loot_integration）。三条的早死说明该路线策略/装配不能作为深层正常难度估计。

可选能力小样本：D10 同一104729装配，loot+combat 123次/6150tick；loot+giants 170次/8500tick。这两例验证能力对有效目录/装配求值的差异，**不是巨兽招式/遭遇实战测量**。真实giants split/自身深度另由相关能力回归覆盖。

### 建议目标区间选项（待维护者冻结，不是通过线）

推荐 A：先保留本轮 hp 曲线，要求补有正常搜刮/力量药水与选装的中/深层路线，再冻结 normal 知识状态、同层代表普通近战敌人的中位击杀 tick：D1 200–600，D5 300–900，D10/15 400–1600，D20/26 600–2400；低/高装配只作离群展示，不硬压进同一带。承伤目标草案为无恢复至少4–10次普通命中，EHP单独展示。范围只是提交裁定的产品目标，不以本次结果反向改线。

备选 B：接受低力量实验作为“欠配惩罚”边界，不据它调生命；先冻结“同一正常路线、同一装配，相对无loot项目对照”的目标倍率，再补同输入对照。当前**未测无loot对照**，不得给出实测相对倍率。

|锚点|scarce旧→建议A|standard旧→建议A|bountiful旧→建议A|依据|
|---|---|---|---|---|
|1|0→0（暂保留）|0→0（暂保留）|0→0（暂保留）|低力量/未强化样本已有长击杀或200次截尾；没有支持全段再加血的证据|
|5|2000→2000（暂保留）|2500→2500（暂保留）|2500→2500（暂保留）|低力量/未强化样本已有长击杀或200次截尾；没有支持全段再加血的证据|
|10|3500→3500（暂保留）|5000→5000（暂保留）|5000→5000（暂保留）|低力量/未强化样本已有长击杀或200次截尾；没有支持全段再加血的证据|
|15|3500→3500（暂保留）|5000→5000（暂保留）|5000→5000（暂保留）|低力量/未强化样本已有长击杀或200次截尾；没有支持全段再加血的证据|
|20|3500→3500（暂保留）|5000→5000（暂保留）|5000→5000（暂保留）|低力量/未强化样本已有长击杀或200次截尾；没有支持全段再加血的证据|
|26|2500→2500（暂保留）|4000→4000（暂保留）|4500→4500（暂保留）|低力量/未强化样本已有长击杀或200次截尾；没有支持全段再加血的证据|

D4 状态：**基线已交，具体目标与曲线待维护者冻结**。未调 damageBp/accuracyBp、掉率、词缀或cap；没有B曲线落盘与调后通过结论。当前数据不足以关闭 A5 完整平衡验收；无loot对照、真实巨兽招式负载和中/深正常搜刮路线仍需在下一次获批测量预算中补充，不把它们冒充已测。

### 历史14项逐项处置

|项|本轮处理|状态|
|---|---|---|
|scarce D1 kill|历史抽样/粗模型残差，未改掉率|保留A解释|
|scarce D5 rare|历史低频抽样残差，未再跑300局|保留A解释|
|bountiful D5 unique|历史机会口径/遭遇倍率解释，非净唯一件数|保留A解释|
|standard D1 weapon|实测3套伤害/命中/时钟见表，起始原生力量12|旧单击代理退为历史，新目标待定|
|standard D10 weapon|力量12–14、欠配与命中惩罚明显|待目标冻结|
|standard D15 weapon|同套装配量测，未强化，离群明显|待目标冻结|
|standard D20 weapon|golem生命600，多例200次截尾|待正常装备路线，不能据旧代理加血|
|standard D26 weapon|力量12–14、欠配2–7，伤害/时钟分列|待目标冻结|
|standard D20 armor|实际同套护甲/承伤/EHP分列，无独立最大值拼接|旧代理不可直接裁决，待目标|
|standard D5 consistentDefense.mitigation|10点承伤真实求值与实际攻击分列|历史模型保留，目标待定|
|standard D10 consistentDefense.mitigation|同上，并列能力样本|历史模型保留，目标待定|
|standard D15 optimistic mitigation|不用不同护甲的生命/减伤最大值组合|旧乐观指标退为历史|
|standard D20 optimistic mitigation|同套装配与真实承伤替代旧组合最大值|旧乐观指标退为历史|
|standard D26 optimistic mitigation|同套装配与真实承伤替代旧组合最大值|旧乐观指标退为历史|

以上没有把14项全部标绿，也未与旧37项调参实验混用。

## 最终限定验证计划（执行前登记）

统一 Node24、`NODE_OPTIONS=--max-old-space-size=3072`、Vitest `--maxWorkers=2`，下列批次串行。不运行完整 npm test/ext/drift/CE 或组合矩阵。

- A（模块 UI/机械闭环）：`loot_ui_{inert,knowledge,viewmodel,components,style,i18n}`；`loot_game_ui`、`loot_game_sfc`、`loot_trigger_commits`、`loot_trigger_settlements`；`loot_commands_integration`、`loot_stats_integration`、`loot_integration`、`loot_capabilities`。覆盖 F-01/F-02/F-03/F1、真命令、真实结算/能力fallback、单条自然当前版本存读回放续录；自然链额外导出候选输入到仓外。
- B（共享窄补口）：`ext_item_commands`、`ext_item_presentation`、`ext_item_stats`、`ext_module_creation_ui`；`ext_stats_{pipeline,native,runtime,review}`；`ext_combat_neutral_differential`、`ext_slaying_alignment`、`slaying_melee_autohit`；`ext_recording_async`。核验可选属性方法、原生统计依赖、强制命中语义、事务与异步收尾。
- C（营地定向）：`phase5_ui_open -t 'shared seven-module shell|DEV wait'`；`camp_recording -t 'delayed checkpoint'`。公共模态/输入互斥与 pending 命令检查点。
- D（静态守卫）：`p1_30_i18n_gate`、`u24_hardcoded_text`、`repo_hygiene`、`test_suite_membership`，加发现器、boundary、测试依赖、vue-tsc、生产build。
- 唯一全移除副本另验 boundary/依赖/types/build、剩余直接相关 B 子集及一次全关生命周期；实际当前候选loot输入缺包拒绝与完整活局不变单独探针。


## UI 与共享补口审阅地图

|入口|只读投影/比较|提交|
|---|---|---|
|背包 / 原生检视中的模块按钮|`ModuleItemActions` 仅传 ID；`gameView` 从真实位置取已知 DTO|显示切换无tick|
|模块工具栏 / 详情 / 双戒比较|会话选中ID；当前原生或loot装备，`hypothetical(...,true)` 与 `hypotheticalValue`；正式详情禁用β基础数值|装备/卸下走 executeItemCommand；显式左右戒替换|
|来源页|实际装备已知行、词条名/单位/条件/符文，附已知StatQuery来源|只读，不暴露未知rowId/值|
|过滤|本地草稿、等值轮询不重置；取消/恢复预设默认|一次 set-filter，0tick，等值提交不重复发|
|单件/批量分解|实际包内ID；装备/地面/容器/原生禁选；总tick与碎片区间|salvage，CAS；唯一确认沿宿主No/Yes，完成/取消/拒绝反馈保持|
|十片鉴定|原生 canIdentifyItem 与材料余额；F1否定后的种类/符文目标不被affix全已知误挡|identify-shards，10片/100tick|

地面只投影稀有度，幻觉时不提供真实地面入口；容器只读来自既有 WorldWork 公开能力，仍用既有容器流程取回。没有添加活Item props/模块写口。无loot时共享注入返回空动作。面板 claim 地图键，保留浏览器原生Tab/Enter/Space按钮操作；Esc逐层回退，事件不冒泡到地图。会话换 runtime/load/seek/死亡关闭，旧回调失效，dispose移除监听。确认忙/ACK/动画由宿主控制显示互斥。

共享改动清单：`ModuleUiSession.itemActions`、`ModuleUiHost.beforeOpenItemPanel`、通用 `DetailInfo.itemId`；可信宿主 `StatPipeline.hypotheticalValue` 派生值接口及恢复对 max-hp 的DAG依赖；`ItemTriggerFact.stat-commit` 与 CreatureExtensionHooks 的可选结算通知；宿主 equip/回合视觉与搜索/攻速/概率/实际恢复/抗性/资源/掉落提交点。无 Game 新字段，无 worldSdk/edibleSdk 差量。没有给渲染、悬停、普通FOV或hypothetical查询加写副作用。

## D5 逐行账本

来源统一为宿主当时实际装备实例 ID（武/甲/双戒去重），模块从该实例已验证数据匹配具体行；不按一次命中推断整件。stat-commit 只携带脱离活体的键与目标tags。先准备并验证所有候选，再提交知识、native identified/canBeIdentified、知识缓存与录像根；应用异常恢复完整宿主图。机械revision不因知识改变，双RNG不加抽。下面“已接”指实现和定向自动化覆盖，不代表浏览器完成。

|事实组|实际提交点|正例与负例/零收益语义|
|---|---|---|
|物理|既有 physicalResolved，近战正物理且 hpLost>0|本地伤害/附魔/减伤匹配行；大型条件以目标tag判；预览/未掉血/不匹配不揭示，未扩大投掷法术适用面|
|护甲/命中|Combat命中公式真实掷骰后|命中或miss均参与；公式封顶100%仍参与；显式必中特例/自动命中绕过公式不发|
|攻速|实际玩家攻击恢复/救笼耗时提交|正负攻速均参与；失败/预览无事实|
|容量|Game实际装备成功、状态同步后|生命/力量/战斗容量；减益/封顶仍是参与；普通读/读档reconcile不发|
|恢复|Player真实受伤且未中毒/抑制时推进regenCarry|分数恢复算生效；满血/抑制不发；双戒逐件，备用环不揭示|
|光照/透视/潜行|TimeCoordinator真实回合的视觉/潜行结算|常驻/正负值参与，即使视觉结果封顶；普通updateVision/FOV查询不发；隐身绕过潜行时不发|
|搜索|可直接看见的秘密格进入搜索概率公式|成功与失败均参与；无秘密或被遮挡不发|
|火/毒抗性|Creature抗性计算确实减小正伤害|免疫前短路/零输入/取整无减免不发|
|转移|真实近战有符号HP转移|实际HP变化；原生满血可获得超量HP，只有确实无变化才不发，负转移可发|
|收割/智慧|实际收割后或时间充能后资源快照变化|staff分数倒计时算变化；全满不发；只改变护符不归因智慧；undefined默认倒计时不算伪变化|
|寻宝|原生掉落事务真正产生物品提案、稀有度被求值后|有物品稀有度求值，即使最终放置失败也参与；未出物品/原生vault回退不发；读取drop预览不发|
|战斗恢复|公开通用Actor资源推进后stamina/poise或分数余额增加|能力存在且实际恢复；满资源/无增益不发，韧性破防恢复不冒充普通恢复|
|原生戒指内禀|penitent恢复 / gambler搜索，同上真实路径|由固定基底映射；native enchant为0（否定）不揭示内禀行|

|非符文定义（35）|机械键 → 事实组|处置|
|---|---|---|
|keen|loot.local.damage → 物理|已接|
|brutal|loot.local.damage → 物理|已接|
|honed|native.weapon-enchant → 物理|已接|
|giantsbane|native.physical-damage-dealt → 物理/目标条件|已接|
|reinforced|loot.local.armor → 护甲/命中|已接|
|plated|native.defense → 护甲/命中|已接|
|warding|native.physical-damage-taken → 物理|已接|
|radiant|native.light → 光照|已接|
|precise|native.accuracy → 护甲/命中|已接|
|swift|native.attack-speed → 攻速|已接|
|vital|native.max-hp → 容量|已接|
|mending|native.regeneration → 恢复|已接|
|titan|native.strength → 容量|已接|
|shadow|native.stealth-range → 潜行|已接|
|seeker|native.awareness → 搜索|已接|
|clairvoyant|native.clairvoyance → 透视|已接|
|wisdom|native.wisdom → 智慧|已接|
|fireward|native.resist.fire → 火抗|已接|
|antivenom|native.resist.poison → 毒抗|已接|
|leech|native.transference → 转移|已接|
|reaper|native.reaping → 收割|已接|
|fortune|loot.rarity-find → 寻宝|已接|
|enduring|combat.stamina-capacity → 容量(combat)|已接；缺能力 →vital|
|steadfast|combat.poise-capacity → 容量(combat)|已接；缺能力 omit|
|tireless|combat.stamina-regen → 战斗恢复|已接；缺能力 →mending|
|sage|growth.focus-capacity → 能力缺席|growth能力缺席；替换为 mending，按有效行触发|
|adept|growth.attribute:{attribute} → 能力缺席|growth能力缺席；替换为 titan，按有效行触发|
|scholar|growth.xp-gain → 能力缺席|growth能力缺席；omit|
|stalwart|combat.poise-recovery → 战斗恢复|已接；缺能力 →warding|
|dull|loot.local.damage → 物理|已接|
|brittle|loot.local.armor → 护甲/命中|已接|
|frail|native.max-hp → 容量|已接|
|clumsy|native.accuracy → 护甲/命中|已接|
|noisy|native.stealth-range → 潜行|已接|
|sluggish|native.attack-speed → 攻速|已接|

|唯一 rowId（均加 `loot.unique.` 前缀）|实际键/事实组|处置|
|---|---|---|
|whisper.r0|native.weapon-enchant → 物理|已接，逐行匹配|
|whisper.r1|native.accuracy → 护甲/命中|已接，逐行匹配|
|whisper.r2|native.transference → 转移|已接，逐行匹配|
|whisper.r3|native.runic-power → 固定符文|强度留6B3；原生runicType行为保留，不由本事实揭示|
|ember-fang.r0|loot.local.damage → 物理|已接，逐行匹配|
|ember-fang.r1|native.resist.fire → 火抗|已接，逐行匹配|
|ember-fang.r2|native.light → 光照|已接，逐行匹配|
|ember-fang.r3|native.regeneration → 恢复|已接，逐行匹配|
|penitent.r0|loot.ring-implicit → 恢复|已接，逐行匹配|
|penitent.r1|native.max-hp → 容量|已接，逐行匹配|
|penitent.r2|native.physical-damage-taken → 物理|已接，逐行匹配|
|penitent.r3|native.resist.poison → 毒抗|已接，逐行匹配|
|shadowweave.r0|native.stealth-range → 潜行|已接，逐行匹配|
|shadowweave.r1|native.attack-speed → 攻速|已接，逐行匹配|
|shadowweave.r2|native.max-hp → 容量|已接，逐行匹配|
|shadowweave.r3|native.accuracy → 护甲/命中|已接，逐行匹配|
|cinder-mail.r0|loot.local.armor → 护甲/命中|已接，逐行匹配|
|cinder-mail.r1|native.resist.fire → 火抗|已接，逐行匹配|
|cinder-mail.r2|native.armor-runic-power → 固定符文|强度留6B3；原生runicType行为保留，不由本事实揭示|
|cinder-mail.r3|native.max-hp → 容量|已接，逐行匹配|
|colossus-maul.r0|loot.local.damage → 物理|已接，逐行匹配|
|colossus-maul.r1|native.strength → 容量|已接，逐行匹配|
|colossus-maul.r2|native.physical-damage-dealt → 物理/目标条件|已接，逐行匹配|
|colossus-maul.r3|native.attack-speed → 攻速|已接，逐行匹配|
|colossus-maul.r4|native.runic-power → 固定符文|强度留6B3；原生runicType行为保留，不由本事实揭示|
|vigil-plate.r0|loot.local.armor → 护甲/命中|已接，逐行匹配|
|vigil-plate.r1|native.max-hp → 容量|已接，逐行匹配|
|vigil-plate.r2|native.physical-damage-taken → 物理|已接，逐行匹配|
|vigil-plate.r3|native.stealth-range → 潜行|已接，逐行匹配|
|vigil-plate.r4|native.armor-runic-power → 固定符文|强度留6B3；原生runicType行为保留，不由本事实揭示|
|gambler.r0|loot.ring-implicit → 搜索|已接，逐行匹配|
|gambler.r1|loot.rarity-find → 寻宝|已接，逐行匹配|
|gambler.r2|native.max-hp → 容量|已接，逐行匹配|
|gambler.r3|native.accuracy → 护甲/命中|已接，逐行匹配|


证据分层：`loot_trigger_commits` 枚举当前有效所有词缀与唯一行的匹配/空事实/幂等/未知不变，并验装备提交、未装备、完整回滚、无RNG/机械revision变化及两种唯一内禀的真实结算；`loot_trigger_settlements` 用真实生成词缀物品，逐组执行实际turn/搜索/攻击概率/攻速/抗性/分数回血/收割/转移/充能/掉落/战斗资源恢复与双戒。纯枚举向量只证明逐行映射，真实结算按上述共享路径复用，不冒充为每件唯一分别打过整局。旧物理条件边界、F1与当前版本生命周期由既有相关回归继续执行。没有新批量延期；随机符文/固定强度仍为已定6B3，growth缺席按已定fallback。

属性门面守卫首败：新方法最初被加入模块context的StatQuery枚举；现限定到可信宿主 StatPipeline/UI 适配器，模块只读门面仍为原五方法，守卫与断言保持原样。

### D7 维护者三档复核清单

本轮按用户分工 **未执行真实浏览器**，不是启动失败，也没有用SSR/SFC/CSS冒充通过。以下每格均待维护者填实际结果；截图/控制台/导出证据建议放 `/private/tmp/phase6b2-browser/<宽度>/<编号>`。步骤在构建产物中完成，先开启loot，分别取scarce/standard/bountiful新局；需要唯一/否定等边界时可用注明的受控存档，不能伪称自然获得。

|编号与实际复核步骤|320×568|800×900|1440×900|
|---|---|---|---|
|1 三预设选择，方向键切选、Enter/Space确认恰一次，进入后预设一致且不可改|未执行|未执行|未执行|
|2 背包→模块详情→比较→返回；地面/装备/已知可达容器、未知戒指、部分已知稀有/唯一、长铭文、空列表、幻觉/记忆|未执行|未执行|未执行|
|3 武/甲/左右戒替换、空槽/原生对照；条件“大型目标”、符文名称/未接强度提示与未知影响|未执行|未执行|未执行|
|4 修改过滤草稿，跨多个轮询后取消/默认/应用；一次0tick录像，自动拾取变化、手动拾取可越过|未执行|未执行|未执行|
|5 单/批分解、费用/产量、唯一No/Yes；装备/粘装禁用；满包/陈旧失败无部分扣费、反馈不被刷新清除|未执行|未执行|未执行|
|6 十片鉴定、缺片/全已知拒绝；否定后的未知种类戒指及仅符文未知可鉴定，余额/详情/比较同步|未执行|未执行|未执行|
|7 打开时方向/i/d/a/j/./x不走地图；Tab/按钮/Enter/Space有效，Esc分层；点击/触摸/滚动不穿透，关闭恢复|未执行|未执行|未执行|
|8 ACK/确认/动画忙/营地互斥，重复点击不重发；回放只读、load/seek/换局/死亡无旧选择/监听|未执行|未执行|未执行|
|9 实际UI链导出→重载→回放，过滤/知识/材料/装备一致；控制台无新错误/未处理拒绝|未执行|未执行|未执行|
|10 当前主题稀有色/长文可辨，浅色仅局部抽样；无gallery/fixture生产入口|未执行|未执行|未执行|

320另核横向溢出、最底按钮可达、双戒纵排与44px触控；800核真实容器宽度和侧栏遮挡；1440核列宽/条件文字/面板最大宽度。截图/实际浏览器存录路径目前为空，待维护者执行填写。

补充营地定向计划：执行 `settlement_input.test.ts` 与 `settlement_feedback_ui.test.ts -t 'canvas native keyboard|build, storage and harvest'`，验证旧抽屉地图输入语义、失败反馈及禁用原因，避免仅用公共壳层测试替代模块行为。


## 限定验证结果与首败处理

下表次数不相加，不重复累计复跑。正常树无声明依赖跳过；`-t`显示的skipped全部是明确未选，不是失败被豁免。各最终批次无todo/unhandled。所有原始日志在 `/private/tmp/phase6b2/`。

|批次/日志|exit|通过/失败|未选|Vitest耗时|
|---|---|---|---|---|
|A `final-A.log`（上文14文件）|0|302 / 0|0|80.55s|
|B `final-B.log`（上文12文件）|1|397 / 1|0|174.43s|
|定向修复 `final-fixes.log`|0|76 / 0|0|59.20s|
|C1 公共壳与DEV wait|0|2 / 0|16|8.10s|
|C2 pending营地检查点|0|1 / 0|1|10.79s|
|C3 原抽屉输入/失败反馈|0|2 / 0|20|4.62s|
|D 静态守卫与最终UI两文件|0|43 / 0|0|24.39s|

定向修复确切文件：`src/ext/modules/loot/tests/loot_trigger_{commits,settlements}.test.ts`、`loot_game_{ui,sfc}.test.ts`、`loot_integration.test.ts`、`src/test/ext_stats_runtime.test.ts`，统一 `node node_modules/vitest/vitest.mjs run … --maxWorkers=2`。这批重导出真实候选存档/录像，新增唯一内禀/双戒用例一并通过；最后UI来源格式变动由D两文件复验。B首败只涉及门面枚举，生产改为宿主专用方法后原断言通过，其余397项没有改动。

正常树静态命令：`node scripts/test-discovery.mjs` exit0；`node scripts/check-module-boundaries.mjs` exit0；`node scripts/check-test-dependencies.mjs` exit0（errors=[]）；`node node_modules/vue-tsc/bin/vue-tsc.js -b` exit0；`npm run build` exit0。最后三项wall耗时6.74s/17.20s/30.46s；Vite构建6.49s，只有既有大chunk提示。日志分别为 discovery-final.json、boundary-final.log、dependencies-final.log、types-verified.log、build-final.log。没有扩大为全量/CE/drift/组合矩阵。

首败及中间试验保留：

- `ui-inert-before.log` 旧生产3通过，2.54s。
- `related-first.log` 26通过/2失败，49.82s：生产挂载后旧“仅creation无session”前提、容量equip后旧“全未知”前提已过时。
- `counterfactual.log`：临时仅回退本次已跟踪生产文件到HEAD（测试保留旧版），`loot_integration.test.ts loot_ui_inert.test.ts -t 'equips real rows|registers only'`，2通过/11未选，3.97s；finally恢复生产。随后只修session存在前提和titan实际装备已知前提，保留纯展示、无跨模块私引、随机/机械/未知行其余断言。无守卫被改。
- `ui-d5.log` 17通过/6失败，51.70s：原生对照曾伪造不合法known DTO，改独立原生fallback；新测试R07误认vital，改实际titan；确认测试补真实pending决定收尾。`ui-d5-fix.log` 定向11通过/9未选，9.52s。
- `new-final.log` 27通过/1失败，26.74s：brittle令公式封顶100%仍真实参与，修生产为区分显式必中特例。`new-second.log` 36通过，25.97s。
- 初次boundary拒绝新适配器私引WorldWorkWorld、生产目录引用测试布景，以及在有原生地形读取的分支插入攻速回执导致固定语句指纹变化。修生产：用现有projectView公开读能力；测量布景归测试目录；攻速放既有攻击恢复提交点。`boundary-second.log`与最终边界均通过，读者清单/守卫未修改。
- 类型首败依次修正：真实充能字段staffRechargeRemaining；未使用变量/样本数组类型；测试私有视觉入口的受控转换；确认循环的TS控制流窄化改独立helper；新唯一装配补必需熟悉度字段。没有放宽类型检查、超时或断言。

早期试探的完整日志均保留；最终可复跑命令以上述显式文件清单和仓外 `final-gates.json` 为准。中间失败不写成通过，所有发生变化的生产路径已有对应最终复验。

## 唯一全移除行（限定验收通过）

执行 `node scripts/check-module-removal.mjs --profile=removal --retain=none --prepare-only --engine-only --output=/private/tmp/phase6b2-all-removed-20261015`，exit0。runner原结果保持 **prepared-not-verified**，未篡改为全量通过。其输入完整候选hash为 `8d76bcc2691ea0418cb9cbf65ebfc71a8738683b9d1e93ca7521e1ff6d905de6`。

唯一副本：`/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-knbBgL/candidate`。发现器实际删除：combat, crafting, foraging, giants, growth, loot, narrative, settlement，逐目录verifiedAbsent=true；剩余模块为空。所有权差量恰为250个模块测试文件，剩余408个发现器文件；未新增白名单/桩/空壳。没有第二行布局或单删/单留。

|该副本独立限定门禁|exit|wall耗时|
|---|---|---|
|removed-boundary|0|7.98s|
|removed-dependencies|0|5.37s|
|removed-types|0|12.25s|
|removed-build|0|23.3s|
|removed-related|0|44.63s|
|removed-probe|0|8.11s|

剩余直接相关测试确切清单：`ext_item_commands`、`ext_item_presentation`、`ext_item_stats`、`ext_module_creation_ui`、`ext_stats_pipeline`、`ext_stats_native`、`ext_stats_runtime`、`ext_stats_review`（均 `src/test/*.test.ts`，统一run/--maxWorkers=2）。结果125通过、0失败、2个具名整文件声明skip，Vitest38.83s，无todo/unhandled；`ext_item_stats`、`ext_stats_review`各因物理缺combat/growth被依赖插件替换为一个声明skip，其他6文件原断言执行。正常树这两个文件已执行，无用optional掩盖依赖。

全关探针在这一副本中执行 `node /private/tmp/phase6b2/removed-probe.mjs`：真实new→3次wait→save/load→第4次wait续录→逐事件replay→seek(0,1,4)，逐步机械digest一致。随后恢复活局，直接读取完整候选导出的 `candidate-save.json`/`candidate-recording.json`（loot0.3.0、同whole-run7/recording4），**没有编辑manifest或格式**，两者均拒绝；完整对象图、双RNG、实体ID和录像内容不变。结果 `removed-probe.json`。源码副本门禁不含浏览器，D7仍待维护者；runner准备状态和此限定通过明确分列。

源树物理模块未删除。结束比对：冻结后全部生产/脚本/测试输入逐文件SHA不变；副本所有未删除输入和源树一致，差异列表为空。报告/进度后补验收结果属于文档差量，不冒充同一全文hash。

## 最终候选身份与交接

未提交候选仍基于 `ext/phase6 / 9ab574550dabb88f6cfa9b1e94e6a5fa8450b737`；没有commit/push。生产/脚本/测试等1488个非docs/progress/AGENTS输入的路径排序SHA摘要：`baf7e9f04ccf753434ffb1fd55561dbf0dffd49f74bb26db750d67c9dc340195`，算法为每文件SHA256后按 `path\0sha\n` 汇总（清单在 source-freeze.json）。

纯pack0.1.1：`sha256:7785d8e68e6486bd422e40c6a3f0d317b102683116dcea8e483f2256d9c84fd2`（未变）。locale不进机械指纹；35非符文+21符文定义、8唯一品数据未减删，仅修合同旧33计数。loot module/rules 0.2.0→0.3.0；state1、foundation15、whole-run7、recording4、origin2保持。

|预设|rules旧指纹（0.2.0）|候选指纹（0.3.0）|
|---|---|---|
|scarce|`sha256:70987bf3348dce8a28963a708e2c3580531aae7c19a6a64b32fd60c56e003719`|`sha256:ea81bd9d51e10250130da11fe54b90d2d8e26f0f03e13b64b84501ebd6496abb`|
|standard|`sha256:bcee37a95390944a7151dff13589eb92d881ec553f9aa6c10614b379745b967a`|`sha256:b6dbbec72782996cd8c90983204bfba7e76af3bc10241876fbddaaf20978c132`|
|bountiful|`sha256:6d7a444e8c754bf7d88682048efbd78b87c92314e17bcab1f05f31b8344f3747`|`sha256:2c9f6de4cdd07c42406d8c790cb9b42fa1d832f4d7b119f586f8041cd15a645f`|

当前单开standard有效目录指纹：`sha256:ed86796fad38b1b7995aa94fb1ee4641a8d366e5c8f41c84295d206e9a1aa45c`；纯定义与可用能力决定它，未因UI/locale虚升。worldSdk SHA256 `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343`、edibleSdk `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` 均与HEAD逐字节相同。

正常树生产dist 61文件摘要（路径NUL+内容SHA256二进制）：`60869ac95f357766151a11b6c03e302efb3f93e9f1abfee8dda176dccceda8fd`；构建未检出预览fixture/gallery专有标识。当前真实候选save约2.28MB、recording约0.26MB留仓外；入仓M4汇总223413字节，不提交截图或大原始证据。

**首次交审时的交接剩余（D4 现已整体延后）**：维护者冻结D4目标区间、下一批正常路线补样预算与具体hp曲线；主笔本轮未调曲线。D7由维护者按上表三档实际浏览器复核。除此无另行缩减D5范围的待裁定项，不自动进入6B3，不宣称A5平衡或完整UI浏览器验收完成。


### D2 比较字段与单位核对

|键|展示单位/口径|能力/条件|
|---|---|---|
|native.damage-min / damage-max|实际伤害端点|基础六行；实际力量与原生附魔管线|
|native.defense|内部值÷10，护甲点|基础六行；不是物理减伤百分比|
|native.max-hp / strength|生命点/力量点|基础六行|
|native.attack-speed|tick，越低越好|基础六行；武器原生QUICK/STAGGER说明仍由原生详情承载|
|native.accuracy / move-speed|命中值/tick|命中值不是对指定目标的概率|
|native.regeneration-bonus / regeneration|恢复加成点/HP每原生回合的有理数值|派生恢复用可信宿主单键假设读口，含假设max-hp|
|native.physical-damage-taken|每100点物理输入的剩余值|无目标条件探针；非最终命中率或全伤害免疫|
|native.resist.fire / resist.poison|bp|火/毒抗性，非护甲|
|native.stealth-range / awareness / clairvoyance / light|格数/搜索值/透视值/照明值|潜行越低越好，受当前实际环境影响|
|native.transference / reaping / wisdom|各原生效果点|不能把proc数值当作每次必得HP/资源|
|loot.rarity-find|bp|寻宝稀有度加成，不是掉落率|
|combat.stamina-capacity / stamina-regen / poise-capacity / poise-recovery|对应公开容量/每tick恢复分子|仅StatPipeline实际声明能力时显示|
|条件/符文行|保留正式DTO单位、条件与符文名|大型目标条件独列，固定符文强度未接，growth缺席不伪造|

基础六行默认显示，其余展开阅读；全部计算使用knownOnly，并保留未知影响提示。来源页的百分比来源按bp÷100显示，不能与最终标量直接相加。


## 审查发现处理（第 1 轮，2026-10-15）

本节为最新交付状态，覆盖上文首次交审时的候选身份与结论。维护者最新裁定 **D4 数值平衡整体延后**：保留已交 M4 基线与建议作为历史测量，本轮不补样、不调曲线，也不以目标冻结作为修复交付的前置条件。D7 三档真实浏览器仍由维护者执行。四项重要问题逐项修复；验证结果在本节登记。无 commit。

### 最终相关测试选择（执行前登记）

按最新指令仅相关测试 + boundary + 静态测试依赖 + vue-tsc + build，不执行全量、CE、drift 或新移除副本。Node24、`NODE_OPTIONS=--max-old-space-size=3072`，Vitest `--maxWorkers=2`，批次串行。

- A：覆盖四个审查反例、真实会话/SFC、触发结算、命令与存读回放、属性管线及可信 UI 投影。显式文件：`src/ext/modules/loot/tests/loot_review_r1.test.ts`, `src/ext/modules/loot/tests/loot_game_ui.test.ts`, `src/ext/modules/loot/tests/loot_game_sfc.test.ts`, `src/ext/modules/loot/tests/loot_trigger_settlements.test.ts`, `src/ext/modules/loot/tests/loot_trigger_commits.test.ts`, `src/ext/modules/loot/tests/loot_integration.test.ts`, `src/ext/modules/loot/tests/loot_commands_integration.test.ts`, `src/ext/modules/loot/tests/loot_stats_integration.test.ts`, `src/ext/modules/loot/tests/loot_ui_viewmodel.test.ts`, `src/ext/modules/loot/tests/loot_ui_components.test.ts`, `src/ext/modules/loot/tests/loot_ui_knowledge.test.ts`, `src/ext/modules/loot/tests/loot_ui_i18n.test.ts`, `src/ext/modules/loot/tests/loot_ui_inert.test.ts`。
- B：覆盖共享资源分段推进的算术、原生破防、状态校验与动画调度。显式文件：`src/test/ext_actor_resources.test.ts`, `src/ext/modules/combat/tests/combat_native_defense.test.ts`, `src/ext/modules/combat/tests/combat_defense_state.test.ts`, `src/ext/modules/combat/tests/combat_animated_defense.test.ts`。
- C：触达 i18n、硬编码、测试归属与仓库卫生守卫。显式文件：`src/test/u24_hardcoded_text.test.ts`, `src/test/p1_30_i18n_gate.test.ts`, `src/test/test_suite_membership.test.ts`, `src/test/repo_hygiene.test.ts`。

完整命令与日志留 `/private/tmp/phase6b2-r1/plan.json`、各同名 `.log`，退出码与墙钟耗时留 `gates.json`。

### 四项修复与回归

|审查项|复现、根因与修复|新增验证（均使用真实生产入口）|
|---|---|---|
|R1-F1 / D5 原生破防误揭示|原生 stagger 的 50 tick 仅固定重置 poise 0→12，却被外层空 phases 判为普通恢复。`PhasedAttackProduction.advanceResources` 现按每个实际区间的 phases 与整数/分数增量分别归因；固定破防区间不发普通恢复回执，跨边界 idle 余量仍可发。资源算术与时钟切段未改。|真实生成未知 stalwart 装备，真实破防，读档后只推进到破防终点仍未知；另真实生成 stalwart+steadfast（容量大于固定重置12），验证整段/分段/边界存读三种方式，分别跨界1tick分数恢复和30tick整数恢复均揭示，揭示后读档保留。|
|R1-F2 / D2 戒指命令映射|原生命令在有空槽时忽略 replacement，旧左替换按钮实际填右。共用 `lootRingEquipSlots` 限定真实可执行槽位，面板、比较与回调一致；双空只填左、左占只填右、右占只填左、双满才左右替换；已装备候选不提供重复装备。回调重新核验，错误槽位拒绝。|旧反例回调 `onEquip(false,'left')` 在右空时不执行；6种布局覆盖双空/左右单占/双满分别替换/已装备，读档后调用真实会话→executeItemCommand，实际恢复加成与所选比较列相同，再读档验证槽位和数值；挂载真实 SFC 点击“佩戴到右戒槽”及“替换左戒”，核对2→4和4→4与按钮可见性。|
|R1-F3 / D1 未知分解产量|旧 helper 将 `ilvl=null` 当0产量。现在仅用已知 DTO 与公开 ilvl [1,99]、稀有度分解表、预设倍率和允许的腐化状态求上下界；不传隐藏 ilvl。新 i18n 提示解释物等未知区间；地面仍阻断，已知件仍可确定，混合合计累加上下界。|未知实例从0–0改为8–120，真实命令产量被包含；未知+部分已知+完全已知混合批次读档前后预览一致、命令所得与合计区间一致、再次读档余额与物品删除保持；3预设×3稀有度×99物等×合法腐化情况独立算术枚举，所有实际可能产量均被区间包含。DTO物等仍null，读取不改完整图或RNG。|
|R1-F4 / D2 混合比较|旧 fallback 只在候选有 loot DTO 时构造双方行，使原生候选的当前 loot 装备丢失。双方分别投影 chip；抽出已知 modifier 比较供 β 与正式适配复用，native一侧用null表示无loot来源，不伪造DTO；大型目标/符文独立行保留增减，未知行只提示排除。|真实生成 giantsbane 装备→原生匕首保留当前 chip 与大型目标损失；R08条件、R12符文各覆盖 native↔loot、未知→已知及读档前后相等；两方向差值符号正确、未知不出现条件/符文引用，重复查询的完整图/RNG不变。|

新增 `loot_review_r1.test.ts` 20项已登记 loot 所有权清单；因使用真实 combat 模块，静态依赖登记 **required combat**，无optional或私引combat测试/实现。`loot_game_sfc.test.ts` 增加1项挂载交互回归。其余原有测试断言和守卫均不修改。本轮没有新增Game字段、共享SDK权限、存档结构、规则数据或数值曲线；同一未发布6B2批次继续使用loot module/rules0.3.0、pack0.1.1。

复现先于修复：新文件最初4项在旧生产上 **4失败**，`red.log`，exit1，Vitest6.86s，分别命中误揭示/错误填槽/零产量/当前chip丢失。7个修复前生产文件已留 `/private/tmp/phase6b2-r1/before/`。同4项修后 `green-first.log` **4通过**，exit0，6.74s。随后扩展17项的首次运行 `expanded.log` 9通过/8失败（exit1，18.53s）为新布景问题：固定重置已达基础容量12，无空间做正恢复；裸机械快照没有录像前缀，不能以事件数增长判断命令执行。改用真实生成的额外韧性容量组合，并观察实际命令入口及装备/属性结果，`expanded-fixed.log` **17通过**（exit0，18.96s）。未修改生产绕过这两种失败，未放宽旧测试。最终再补整数恢复3项与SFC交互1项，结果见下。

以上为受控布景与真实生产入口回归，不冒充自然路线或浏览器验收。F1固定重置、普通恢复与存读路径均分列；F2裸机械快照回归验证状态继续执行，完整录像链由既有 `loot_integration` 自然拾取/装备/分解/过滤、save/load/replay/seek/续录测试验证。


类型检查首轮发现公开 `RarityId` 含预留 `set`，分解基表仅四类；已恢复原 helper 的缺失基表拒绝检查，并在求值入口接纳公开类型后显式验证，未用类型放宽掩盖非法值。`types.log` exit2（17.47s）保留。收尾重验预先登记：`loot_review_r1`、`loot_ui_viewmodel`、`loot_ui_components`、`loot_game_sfc`（同目录，同入口/worker参数），覆盖分解算术、组件和全部新反例；随后重新 boundary、依赖、vue-tsc、build。其余A/B/C已通过路径无新增改动，不重复整批。

### 本轮补充给维护者的浏览器复核清单

三档仍为 **320×568 / 800×900 / 1440×900**，沿任务单 §5.2 清单执行。本轮以下四项均标 **待真实浏览器验证**，SFC通过不能替代：

- 单戒/双空时只出现实际可填空槽的“佩戴到…”按钮，比较仅同一槽列；双满才提供左右替换；点击后装备与数值对应，已装备候选无重复装备按钮。窄屏按钮不遮挡返回/卸下。
- 未知和部分已知装备分解显示区间与物等未知提示；混合批次总计也为区间，确认操作后余额落在区间内，完全已知件给确定值；读档后再开面板相同。
- 原生武器对比已知 giantsbane/符文 loot 武器，当前物品不显示空槽；展开“大型目标”/符文行可见损失，反向装备比较可见收益，未揭示行不出现名称或数值。
- 未知 stalwart 装备只经历原生固定破防恢复时不揭示；之后发生真正普通恢复才揭示，边界存读后行为一致。此项可配合受控复核，不能用满韧性状态当普通恢复正例。

本轮未运行浏览器、未重跑 M4、未新建或重跑移除副本。上文唯一全移除候选 `baf7e9f…` 与其日志仅证明首次交审源码；修复后源码已变，不能把那份旧副本写成当前候选删除验收。当前限定门禁见下，D4 整体延后不影响四项修复交付。


### 修复候选限定验收与身份

|批次/门禁|结果|exit|墙钟耗时|
|---|---|---|---|
|`related-A.log`|A：13文件316项通过，Vitest65.58s|0|72.89s|
|`related-B.log`|B：4文件101项通过，Vitest22.83s|0|30.08s|
|`guards.log`|C：4文件37项通过，Vitest15.45s|0|22.55s|
|`related-final.log`|类型修正后受影响4文件193项通过，Vitest21.69s|0|28.86s|
|`boundary-final.log`|边界与测试归属通过|0|10.72s|
|`dependencies-final.log`|静态依赖 errors=[]|0|6.79s|
|`types-final.log`|vue-tsc -b 通过|0|17.36s|
|`build.log`|npm run build 通过（含 vue-tsc -b 与 Vite）|0|29.94s|

相关最终覆盖共21个不同文件、454项，0失败、0 skip/todo，无unhandled；后验193项包含在其中，不重复累计。类型首败已由修正后的types-final/build关闭，所有受影响路径复验通过。旧测试、守卫、断言语义无修订；无新黄金trace/生成基线。`git diff --check`通过；未执行全量、CE/drift、组合矩阵或本轮全移除。

最终仍基于 `ext/phase6 / 9ab574550dabb88f6cfa9b1e94e6a5fa8450b737`，未commit/push。1489个非docs/progress/AGENTS输入按原算法 `path\0sha\n` 汇总SHA256：`1b145bc706fd4733fd53249120485048771e31e3d0c66447267768f780323fc4`，清单 `/private/tmp/phase6b2-r1/source-freeze.json`。相对首次交审源码仅上述7个生产文件、SFC测试、1个新回归文件及2个测试登记文件变化，共11路径；没有数值数据差量。此摘要取代旧候选摘要作为当前源码身份。

本轮dist 61文件，沿原路径NUL+内容SHA256二进制算法摘要 `de7873291973e1484197811e4671fa42886638e835c3e846c6e54c0c44487eb3`；实际命令、结果、耗时和两次门禁轨迹保存在 `gates.json` / `finish-gates.json` / `candidate.json`，均位于 `/private/tmp/phase6b2-r1/`。源码及构建不再修改后交接。四项重要问题均已修复并补回归，D4整体延期、D7维护者浏览器待验继续单列；不将代码测试通过写成发布或浏览器验收结论。
