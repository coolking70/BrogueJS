# 6B4 实施合同与分步记录

2026-10-16，开工 ext/phase6 / 8d7c799；D1–D7 全部 A。按任务单串行实施，不调参、不 commit。本文为实现前冻结方案，实际完成与门禁以报告为准。

## B4-0 差量

历史设计 §8 的早期曲线由 numbers §7 / 当前 enhancement.json 覆盖：武器每级1000bp、每3级1当量；甲每级5HP/5内部甲；戒每2级1本体。上限10/8/6/4保持。21符文定义和4固定行沿当前数据，不新增内容。

| 通用补口 | 必要性与权限/写集 |
| --- | --- |
| ItemEnhancementProvider | 只读资格/接受上限，提交时纯数据提案及受预算随机；只能更新自有 moduleData 和目标戒指附魔，宿主验证、计数、消费、解咒及回滚。没有活Item/任意字段权限 |
| ItemGrowthInput.nativeLimit | 宿主给目标可接受整数上限，growth在发奖和收据前钳制同目的输出；替换为点数等其它奖励不套目标上限 |
| runic-effect 事实 | 宿主实际效果点绑定当前actor/item/type/target，模块只提出匹配行知识；原效果事务内提交，查询不能发事实 |
| 目标目录 | 宿主稳定15类、现有频率/深度顺序；生成末尾仅slaying/immunity取一次0…sum−1目标骰；实例v2保存targetClass，固定装配映射vorpalEnemy |
| 延迟卷轴消费 | 具有强化provider的会话，读卷轴只打开选择；成功提交才消费、自亮、解咒和收尾。取消/无目标/失败不消费；未启用保持原路径 |

| 请求/目标 | 接受量 | growth收据 | timesEnchanted | 随机 |
| --- | --- | --- | --- | --- |
| 0 | 0，不精炼 | 0 | 0 | 0 |
| 未满，1/多级 | min(请求,剩余等级) | 实际接受 | 实际接受 | 0 |
| 已满，可精炼 | min(请求,1) | 1 | 1 | 行选择，然后按原序各分量；单候选/固定区间0骰 |
| 已满，全满/无正面候选 | 拒绝 | 0 | 0 | 0 |
| 合法替换其它奖励 | 沿growth现有政策 | 实际奖励 | 0 | 0 |

精炼候选包含已满正面行，逐分量max，不改变身份/目标/负面；选中已满行仍付费。不额外鉴定，未知只提示完成；全满拒绝优先于解咒。否定后的原生runicType/旗标作为执行开关，不从数据恢复符文。

## 强度和失效

近战概率、武器持续/数量/力场、护甲吸收/反伤/分身、反射以及详情统一读取native.runic-power/armor-runic-power。loot行整当量×4一次替代本件L0；原生仍用净附魔，投掷不能借装备符文。knownOnly先过滤，未知不得暴露强度。固定4行分别quietus4/reflection6/force8/absorption8。

强化/精炼标机械及知识/录像摘要；揭示仅失效知识；否定/换装沿原机械失效；load/seek/换局重建绑定，不发触发事实。只读不建事务、不扫全根。

## 版本方案

foundation17、itemSdk2、loot module/rules0.5.0、pack0.2.0/schema1、实例v2/state1、growth1.10.0。whole-run7/recording4/origin2和world/edible格式保持；延迟卷轴选择元数据纳入现有run严格校验/U03。目标表纳入loot规则身份。原P0不覆盖，新6B4 manifest独立接入，保持比较/预算强度；旧baseline在43f115b仓外副本测量。

## 测试选择

先跑新强化/符文算例，再按实际触达选loot schema/catalog/item/data/generator_vectors/generator_props/economy、growth items/item_runtime、stats native/runtime/item_stats、trigger settlements/commits、UI viewmodel/game_sfc/knowledge/inert、原生命令/战斗/反射及否定、录像边界/生命周期和源码守卫。最终报告登记显式文件，不使用目录参数。Node24、3072MiB、maxWorkers2、批次串行；正式P0期间不同时运行构建/测试/profiler。全删仅一份隔离副本；浏览器三档交维护者。

### P0 接入差量（D5 A）

原 `scripts/ext-perf-budget.json`、原路线和 instrumentation 均保留。`check-ext-perf.mjs` 新增唯一白名单 `--phase6b4`，选择独立 `ext-perf-6b4-budget.json` 和 `ext-6b4-late-{classic,all}.route.json`，仍必须两个完整case；无任意manifest路径、单case或跳过oracle开关。重复/未知选项、缺目录和未知case均拒绝。以 `scripts/test-ext-perf-selection.mjs` 独立负例验证。新manifest必须由原freeze工具读取3次完整结果产生，不从实测失败改上限。

## 25 行触发账本

所有行的事实字段统一为 `kind=runic-effect, settlementId, actorId, itemId, targetId, runicType, targetTags, phase, result=committed`。itemId 是当前会话绑定的原生实体 ID；phase 区分实际效果、实际投掷和原生自亮尾处理。宿主在实际执行点裁定结果，纯 provider 只匹配本件稳定 rowId；已揭示重复不递增序号。常规效果事务包住原效果与知识提交。

| 物品/稳定 rowId | 类型 | 强度读取 | 执行/揭示条件 | 必须拒绝的归因 | 测试入口 |
| --- | --- | --- | --- | --- | --- |
| weapon / `loot.affix.rune-w-speed` | speed | native.runic-power/4；行值×4为L0 | 玩家恢复哨兵实际变为−1 | 已有−1 | loot_b4_runtime：actual weapon effect speed；loot_b4_vectors：loot.affix.rune-w-speed |
| weapon / `loot.affix.rune-w-quietus` | quietus | native.runic-power/4；行值×4为L0 | 目标生命被斩杀效果降低 | 已死亡/无可降低生命 | loot_b4_runtime：actual weapon effect quietus；loot_b4_vectors：loot.affix.rune-w-quietus |
| weapon / `loot.affix.rune-w-paralyzing` | paralyzing | native.runic-power/4；行值×4为L0 | 麻痹时长实际增加 | 已有更长麻痹 | loot_b4_runtime：actual weapon effect paralyzing；loot_b4_vectors：loot.affix.rune-w-paralyzing |
| weapon / `loot.affix.rune-w-multiplicity` | multiplicity | native.runic-power/4；行值×4为L0 | 至少一实体成功落地 | 骰失败或无落点 | loot_b4_runtime：actual weapon effect multiplicity；loot_b4_vectors：loot.affix.rune-w-multiplicity |
| weapon / `loot.affix.rune-w-slowing` | slowing | native.runic-power/4；行值×4为L0 | 减速时长变化或移除加速 | 相同时长且无加速 | loot_b4_runtime：actual weapon effect slowing；loot_b4_vectors：loot.affix.rune-w-slowing |
| weapon / `loot.affix.rune-w-confusion` | confusion | native.runic-power/4；行值×4为L0 | 混乱时长实际增加 | 已有更长混乱 | loot_b4_runtime：actual weapon effect confusion；loot_b4_vectors：loot.affix.rune-w-confusion |
| weapon / `loot.affix.rune-w-force` | force | native.runic-power/4；行值×4为L0 | 击退至少一格 | 完全无位移 | loot_b4_runtime：actual weapon effect force；loot_b4_vectors：loot.affix.rune-w-force |
| weapon / `loot.affix.rune-w-slaying` | slaying | native.runic-power/4；行值×4为L0；此效果不随强度增长 | 目标类匹配且斩杀实际降低生命 | 不匹配/普通击杀 | loot_b4_runtime：actual weapon effect slaying；loot_b4_vectors：loot.affix.rune-w-slaying |
| armor / `loot.affix.rune-a-multiplicity` | multiplicity | native.armor-runic-power/4；行值×4为L0 | 至少一实体成功落地 | 骰失败或无落点 | loot_b4_runtime：actual armor effect multiplicity；loot_b4_vectors：loot.affix.rune-a-multiplicity |
| armor / `loot.affix.rune-a-mutuality` | mutuality | native.armor-runic-power/4；行值×4为L0；此效果不随强度增长 | 相邻合格敌人实际承伤，或分摊降低玩家该击伤害 | 无对象/0伤害 | loot_b4_runtime：actual armor effect mutuality；loot_b4_vectors：loot.affix.rune-a-mutuality |
| armor / `loot.affix.rune-a-absorption` | absorption | native.armor-runic-power/4；行值×4为L0 | 实际吸收量>0 | 0输入 | loot_b4_runtime：actual armor effect absorption；loot_b4_vectors：loot.affix.rune-a-absorption |
| armor / `loot.affix.rune-a-reprisal` | reprisal | native.armor-runic-power/4；行值×4为L0 | 合格近战对象实际失血且输入>0 | 无对象/不合格/0输入 | loot_b4_runtime：actual armor effect reprisal；loot_b4_vectors：loot.affix.rune-a-reprisal |
| armor / `loot.affix.rune-a-immunity` | immunity | native.armor-runic-power/4；行值×4为L0；此效果不随强度增长 | 匹配类实际阻断正伤害或反射射线 | 不匹配/0伤害/其它免疫 | loot_b4_runtime：actual armor effect immunity；loot_b4_vectors：loot.affix.rune-a-immunity |
| armor / `loot.affix.rune-a-reflection` | reflection | native.armor-runic-power/4；行值×4为L0 | 实际改变射线路径的回执 | 概率失败/他人反射 | loot_b4_runtime：actual armor effect reflection；loot_b4_vectors：loot.affix.rune-a-reflection |
| armor / `loot.affix.rune-a-respiration` | respiration | native.armor-runic-power/4；行值×4为L0；此效果不随强度增长 | 在伤害结算阶段阻止正伤害，或阻止气体状态时长增加 | 瞬时毒气接触/已有更长状态/安全地面/仅装备/查询 | loot_b4_runtime：actual armor effect respiration；loot_b4_vectors：loot.affix.rune-a-respiration |
| armor / `loot.affix.rune-a-dampening` | dampening | native.armor-runic-power/4；行值×4为L0；此效果不随强度增长 | 爆炸危险实际被阻断 | 无爆炸/已有爆炸豁免 | loot_b4_runtime：actual armor effect dampening；loot_b4_vectors：loot.affix.rune-a-dampening |
| weapon / `loot.affix.rune-w-mercy` | mercy | native.runic-power；固定行为不虚报强度收益 | 目标实际恢复生命 | 满血 | loot_b4_runtime：actual weapon effect mercy；loot_b4_vectors：loot.affix.rune-w-mercy |
| weapon / `loot.affix.rune-w-plenty` | plenty | native.runic-power；固定行为不虚报强度收益 | 克隆实体成功落地 | 克隆失败/无落点 | loot_b4_runtime：actual weapon effect plenty；loot_b4_vectors：loot.affix.rune-w-plenty |
| armor / `loot.affix.rune-a-burden` | burden | native.armor-runic-power；固定行为不虚报强度收益 | 力量需求实际增加 | 概率失败 | loot_b4_runtime：actual armor effect burden；loot_b4_vectors：loot.affix.rune-a-burden |
| armor / `loot.affix.rune-a-vulnerability` | vulnerability | native.armor-runic-power；固定行为不虚报强度收益 | 正伤害实际翻倍 | 0输入 | loot_b4_runtime：actual armor effect vulnerability；loot_b4_vectors：loot.affix.rune-a-vulnerability |
| armor / `loot.affix.rune-a-immolation` | immolation | native.armor-runic-power；固定行为不虚报强度收益 | 火焰至少一格实际落层 | 概率失败/无落层 | loot_b4_runtime：actual armor effect immolation；loot_b4_vectors：loot.affix.rune-a-immolation |
| dagger / `loot.unique.whisper.r3` | quietus | native.runic-power = 16 quarter | 目标生命被斩杀效果降低 | 已死亡/无可降低生命 | loot_b4_runtime：unique loot.unique.whisper / actual fixed unique；vigil absorption 专项 |
| chain_mail / `loot.unique.cinder-mail.r2` | reflection | native.armor-runic-power = 24 quarter | 实际改变射线路径的回执 | 概率失败/他人反射 | loot_b4_runtime：unique loot.unique.cinder-mail / actual fixed unique；vigil absorption 专项 |
| war_hammer / `loot.unique.colossus-maul.r4` | force | native.runic-power = 32 quarter | 击退至少一格 | 完全无位移 | loot_b4_runtime：unique loot.unique.colossus-maul / actual fixed unique；vigil absorption 专项 |
| plate_mail / `loot.unique.vigil-plate.r4` | absorption | native.armor-runic-power = 32 quarter | 实际吸收量>0 | 0输入 | loot_b4_runtime：unique loot.unique.vigil-plate / actual fixed unique；vigil absorption 专项 |

### 生命周期与知识同步

| 事件 | 原生字段 | loot 行/缓存 |
| --- | --- | --- |
| 首次实际效果 | 仅该件 runicKnown | 仅匹配符文行 known；知识/摘要失效，不叠机械收益 |
| 完整鉴定/熟悉度 | 保留原生完整鉴定规则 | 所有行揭示，专名按既有规则出现 |
| 未知强化卷轴自亮尾 | 保留原生允许的符文自亮 | native-reveal 仅同步匹配行，未装备目标也验证背包所有权 |
| 强化/精炼 | 武甲出生 enchant=0，强化保留既有削弱偏移且不减力量；戒指仅加派生本体增量；times按接受量 | 只改 enhancement/选定正面数值，机械与摘要失效 |
| 解咒 | isCursed=false | corrupted及负面行保留，更新/加载不套出生诅咒等式 |
| 地面否定 | 沿原生清 runicType/旗标与附魔 | 不由绑定、collect或load重建原生符文 |
| 卸装/拾取/换层 | 沿原生所有权与装备流程 | 不触发知识；机械缓存沿原失效 |
| load/replay/seek/换局 | 校验当前身份后重建会话绑定 | 不发触发事实；旧会话/脱离绑定事实不得写当前物品 |

### 反事实与固定数据变化

原 `43f115b` 生产代码（与 `8d7c799` src 相同）配原28个loot测试：743通过、1条已有失败。已有失败是 inert 测试仍期待 module0.2.0，而基线实际0.4.0。其余过时前提先有上述反事实，再作最小修订：实例合法版本2/非法版本1，符文禁用负例改为武甲错配，schema负例改为非boolean；旧非符文骰带显式关闭族保留每个原断言，新启用族21条独立字面骰带覆盖真实生成。数值转录未改。

UI 仍由原 first-hit finder 捕获；R07明确其原测试一直依赖的brutal+titan组合，R06明确四行。R08原正向换装比较要求非诅咒且只比较条件词缀，因此固定该前提；新规则原seed146生成腐化sluggish，原生换装正确拒绝，不能删除正增益断言。R16因启用符文池改为seed39/index0。具体新旧行/值与9个SSR快照差量由原捕获方法更新，原始结果留仓外，不用截图替代运行时验证。

自然成长路线原seed26在D6、坐标33,8无法在500步预算内到17,14；保留失败日志。按原生产生成找到seed36首层whip含adept.will，保持6层/每段500步/60秒限制和全部断言，完整save/replay/seek/续录通过。该变更仅换路线前提，不是放宽玩法或门禁。

原生被否定/削弱后的附魔偏移不会被强化恢复：provider 仅提出 enchantmentDelta；0 输出在宿主直接返回，保留全部数值与计数。

### 最终 UI 与只读边界

`Game.canCancelEnchantment` 只是 pending 状态的派生读取，不增加持久字段。背包关闭/Esc 在延迟消费选择时经 `executeCommand` 取消；原生强制目标选择仍保持原守卫。游戏卡片和来源卡对已知但原生开关已关闭的符文显示“符文已失效”，未知行不为此新增披露。真实挂载 SFC、原生强化、U03 与 i18n 守卫均有最终限定复验。

四固定唯一行另有零变化/失败负例；实际投掷验证本件强度不借手持唯一武器，并验证知识提交失败恢复投掷物、完整世界及双流。受控长链覆盖强化→满级精炼→真实吸收→部分已知→save/load→完整replay→255/256/257与2047/2048/2049 seek→续录，不冒充自然掉落路线。

### 新增开销小场景

同输入串行三次，强化/精炼均为 extension.transaction 5、itemCommandTransaction 1、collectExtensionComponents 4；这是包含既有回合收尾的整次命令计数。精炼比强化多2次实质抽取。实际效果场景计数为1/1/0；100次只读查询为0/0/0，双流均0抽取且完整图不变。重复输出及物品hash一致；原始证据为仓外 `phase6b4-feature-counts.json`，不以小场景替代完整 P0。

## 本次交付停点

R1 三项重要问题已修复：分摊按邻敌实际承伤归因；呼吸仅在实际阻止伤害/状态增长阶段揭示；背包及地面详情走同一纯属性投影。存读档回归与本轮 14 文件 / 487 项相关测试、boundary/依赖/types/build 通过。B4-5 仍待验：本轮原版重测首轮再次被 Sleep/DarkWake 污染，作废保留；无有效三轮候选，不冻结新预算。D6 A 不变，D7 浏览器交维护者；原首轮唯一全删证据保留其旧源码身份，不冒称再次执行。详见[报告](phase6b4.report.md)。
