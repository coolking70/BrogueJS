# 5A2-S 完整实施报告

Sa–Se 已实施。统一属性管线已接全部生产读取点、growth 来源/资源提案、combat 容量账本与 UI 假设求值；回血按维护者最新精确分数裁定。未 commit/push，loot 分支只读参考。最终门禁和性能结果见下文。

## 1 基线、版本与冻结边界

基线为已验收 5A2 `eb31996`；开工 HEAD `2d870a2`，只补任务基线，开工工作树为空，交付 HEAD 不变。已先读 AGENTS.md、HANDOFF、development、architecture、ext README、任务书及合同指定章节。5A2 报告 §6 在 `docs/ext/phase5a2.report.md:172`，明确交接 combat 1.6.0/state4 与旧 combatStats。

| 项 | 开工→交付 | 实际位置/说明 |
| --- | --- | --- |
| foundation | 7→8 | src/ext/descriptor.ts:5；foundation.stats 进入 extensions |
| whole-run | 5→5 | src/engine/Core/WholeRunSnapshot.ts:188；没有新原生实体字段 |
| recording | 4→4 | Game.makeRecordingHeader；codec.foundation 与摘要 codecIdentity 7→8，协议结构未扩展 |
| growth module/rules | 1.7.0→1.8.0 / 1.7.0→1.8.0 | src/ext/modules/growth/definitions.ts:7、data/definitions.json:4–5；moduleVersion 本来就是 fingerprint 输入，所以 rules 同升 |
| combat module/rules/state | 1.6.0 / 1.6.0 / 4，均不再升 | src/ext/modules/combat/definitions.ts:8；`git tag --contains eb31996` 空，S9 允许合并升号 |
| narrative | 1.4.0，不变 | src/ext/modules/narrative/definitions.ts:9 |
| giants | 1.0.0，不变 | src/ext/modules/giants/definitions.ts:5 |

旧 foundation/growth 档与录像拒载，不迁移。物化账本属 extensions dirty 域；StatPipeline、缓存/诊断、actorStatRevision、冻结来源视图、临时提案与假设组件为 WeakMap derived/session。登记在 scripts/u03-state-contract.json 的 extensionRuntime 合同与 scripts/recording-digest-contract.json 的 derivedSessionServices。没有给 Game 增加字段。

只读参考 `origin/ext/phase6-loot-core` @ `1223d09d784d4272956c72ebd25b6792468e53ad` 的 loot §4 全部与 tuning v1.1。它替代任务中历史设计引用 `23fc19d` 的数值参考；没有 cherry-pick/merge 或安装 loot，没有词缀、moduleData、labor-rate、新依赖、C5 DTO/SDK/签名、生成算法改动。

| 冻结文件 | SHA-256（与 5A2 一致） |
| --- | --- |
| src/ext/worldSdk.ts | e2f3cbbf06fa9afd939ec3a3a5f75193d47003a08410fd1c5d2e8899051da05f |
| src/ext/testing/worldHarness.ts | 0cc14ecd4cf734591616b291239b3ef23b99e451af6f954a3de6de3f3143ba26 |
| src/ext/testing/fixtures/craftingSkeleton/index.ts | f4d70fd3b9be75444f181448ced4005c20d546c0cff7ce11eef366bb4a1a5372 |
| src/ext/testing/fixtures/worldWorkBasic.ts | a0267454f15f1b3c90649ab1a4945ddf1e055d40dc0072e776ab74265ca61ee1 |


开工核对来自冻结 HEAD 的实际位置：runtime 的十端口表/冲突检查在 src/ext/runtime.ts:329–330，rule 在932，nativeMaximumBase在968；growth 的持久 derived 定义/校验在 components.ts:5/39，reconcileGrowthMaximum 从 module.ts:136 开始，rulePolicies/nativeBonuses 在532/536，optionalActorQueries 的 growth.combat-stats.v1 在510。其三个消费者为 Game.ts:11592、PhasedAttackProduction.ts:88、combat/partBreak.ts:44。交付已删除旧端口、冲突检查、derived 持久组件与可选容量查询；pure GrowthDerived 临时计划类型保留，通用资源提交接口改为基础/资源提案。nativeMaximumBase 的交付位置为 src/ext/runtime.ts:1066，使用 foundation 账本剥离旧加值。§3列所有生产读点交付行号。

## 2 Sa–Se 与自行决定的实现细节

| 子项 | 状态 | 实际交付 |
| --- | --- | --- |
| Sa | done | StatQuery/声明、BigInt 有理求值、固定 DAG、双边池、纯来源/有限条件/预算、LRU/脏标记/调试重算、真实 Game 与原生影子 |
| Sb | done | 下表全部路由；原生 CE 表为来源节点；规则/UI 接同一管线；已知过滤、装备/附魔假设求值 |
| Sc | done | 稀疏持久 applied 账本、来源同事务预检/统一写回、load 校验/rollback/GC；growth 端口/derived 持久组件与原加值写法退役 |
| Sd | done | combat 三处容量消费者改读管线；actors.combatStats 与其 revision 退役；费用/恢复速率经键读取 |
| Se | done | readonly context.stats、statSources 声明面、equippedItems DTO、stats-config 配置手册与后续交接 |

1. 普通来源值必须是安全整数。BigInt 执行 `(base+flat)×(1+increased/10000)×各有名 more 槽`，同槽先合并，最后 clamp/舍入一次。override 有不同显式 priority 才可并存；冲突/错误/异步/不纯来源直接失败。模块不能改 DAG。
2. 原生附魔/符文单位为四分之一点，防御为十分之一点，hit/evasion/抗性为 bp。CE 原表函数保留在 NativeStatSources 白名单作为原生节点；旧 playerDefense 与再生 oracle 放测试支持。成长旧十个端口的语义只保留在测试 oracle，不再是运行期提供者 API。
3. 回血键用安全整数、正分母、约分的 `{numerator,denominator}`；仅玩家/怪物回血消费转 number。UI 速率比较用交叉乘，`.value(native.regeneration)` 拒绝。原生怪物计数器的零修正时序保留；非零来源可一次回血多个 HP；无法约分到安全整数的组合在提交前拒绝。裁定已写入合同、任务书和 stats-config。
4. 五个物化键只存非零 bonus，按 actorId 字符串码点/key 排序；全零省略 stats，空 applied 数组拒绝。HP/力量先减旧账本，完整新来源只由 foundation 写一次。降容钳制；升容不补；仅 growth 永久 character 来源可声明 refill-delta；恢复须由提供方资源提案显式给出，账本不按整键差额补血。显式旧治疗/克隆过量 HP 政策独立保留。
5. growth 的原 additive budget 是本 owner 的子池，钳制后进入公共 increased；有名 final more 槽保留旧 0…4 倍边界，速度类按 F4 改为最低0.5倍。`legacyFactor` 仅供 growth 旧十进制配置的精确因子，BigInt 处理不足一 bp 的乘数；其它模块用整数 bp。GrowthDerived 只作为纯计划的临时结构存在，不在组件/存档保存。
6. 实际 growth 经验/奖励/分配/重置通过 readonly `previewStats(actorId, ownComponents)` 投影自己的组件草案，仍包含其它来源；UI 使用同一 hypothetical。不得改其它模块组件，不写世界/cache/revision，不消费 RNG。原生 Item 的四分之一附魔提案合法，未知信息按 knownOnly 过滤。
7. S7 明确允许直接读装备槽：生产取“被槽引用且存在于 inventory 根”的物品；测试用唯一 forEachItemRoot 断言集合相等，并把同一物品实际移入 chest/escrow/refund/remains/floor/carrier 图验证均为零。不会把悬挂槽当来源；DTO 不包含 moduleData，后续统一扩展此入口。
8. 每 actor 256 行、每actor的每键64来源、每模块128键，成对先各自接纳再并池（64+64合法），原生依赖行及潜行 clamp 也计入。native/模块冻结视图只在来源实际收集时缓存；合法条件事实不能访问 RNG/全局。源码守卫禁止规则/UI 直接调用已迁移公式及 raw ringBonus，条件源码守卫和模块边界守卫保留。
9. 每 actor128键 LRU、actor/source cache 也有界。按显式 revision 与冻结 actor/target facts 隔离；load/seek/rollback 清空。调试缓存命中重算比对，每条命令全量核对 applied 账本。物化来源/L0/原生依赖行相同可复用已预检结果，仍钳制当前资源；这不会跳过装备新增的原生预算行。
10. 无 statSources 的普通模块写入不会无条件重算所有属性：来源只能读自身 state/components，因此没有跨模块隐式依赖。资源提案、原生机械字段、装备、状态、HP、关系、休息与光照的实际变化均有脏入口。经典无绑定 fixture 的 WeakMap 原生管线复用声明而每次刷新值，避免旧 fixture 手改字段造成陈旧结果。
11. combat 容量没变时仍保持原隐式满资源池，不因一个身份容量对象制造 actors 行；容量变更保留延迟/分数/已接动作，降容钳制。接受动作的 profile/费用等时序仍由原调度合同持有。事务回滚保存原始速度字段，不把已修正 query 值写回原生基础。
12. 普通潜行硬下限由原生 clamp 收紧为2，原生休息/隐形可为1；原生移动速度为0仍拒绝，不能被键下限偷偷修成1。其它键硬限、舍入与例外完整列于 stats-config，HP/力量/XP 用 MAX_SAFE_INTEGER 以保留原有合法成长及溢出守卫。
13. 账本 set/remove/restore 在实际行变化时统一回调 extensions 脏标记，覆盖直接 clone delta 继承与原生最大生命重置；无变化不标脏。没有 strength 原生字段的 NPC 使用固定 L0 12，加值只参与 query，不从默认12再次扣除。新增5个缓存/默认基础反例全部保留。
14. 成对求值的64来源预算按 actor 分别接纳，64+64合法，合并后仍检查 override 冲突。新增128行双边反例保留。

foraging 已确认：虚弱/饥荒 accuracy increased −2000/−4000，physical-damage-dealt increased −2500/−5000；均在 −9000…50000 公共池内。基值100得到80/60与75/50。按设计作用于 accuracy 输入节点，不误写 hit/evasion；旧设计文档的负 damage more 写法不用于实现。本步不实现 foraging 玩法来源。

## 3 loot §4.8 逐行路由审计

下列开工位置来自 HEAD/任务附录，交付位置为实际文件行号。全部16行已迁移，未迁移项为0。原生字段初始化、序列化、事务备份及 CE 表节点是基础/写边界，不是绕过管线的数值消费读点。

| 键 | 开工读法/位置 | 交付实际位置 | 切换结果 | 对应数值/状态证据 |
| --- | --- | --- | --- | --- |
| weapon-enchant | Combat.ts:105/221；Game.ts:8574；ItemDetailEquipment.ts:20 | src/engine/Combat/Combat.ts:209；src/engine/Stats/NativeStatSources.ts:76；src/engine/UI/ItemDetailEquipment.ts:21 | netEnchant → 固定 DAG/CE 表；规则与已知装备假设投影 | native 影子；u_13；x3b/x4_r4；neutral |
| accuracy / hit-chance | Combat.previewHitChance:99；runtime.rule:932 | src/engine/Stats/NativeStatSources.ts:140；src/engine/Combat/Combat.ts:100 | accuracy 节点 + hit/evasion 双边单池；保留保证命中/掷骰边界 | native；pipeline pair；ext_engine_policies；slaying；neutral |
| defense / evasion | Combat 原 playerDefense/monsterDefenseAdjusted；MonsterSidebar:149 | src/engine/Stats/NativeStatSources.ts:79；src/engine/UI/MonsterSidebar.ts:150；src/engine/UI/ItemDetailEquipment.ts:55 | armor-enchant → defense；防守方 evasion 并池；UI 已知 breakdown | native；armor_*；neutral；x3b/x4_r4 |
| damage-min/max / dealt/taken | Combat.ts:346/653/917/985 的 enchantedDamage；旧 physicalDamage 端口 | src/engine/Combat/Combat.ts:320；src/engine/Stats/NativeStatSources.ts:146；src/engine/Stats/StatPipeline.ts:416 | 端点/掷骰原生节点 → 攻守单池；盾前只缩放一次；投掷带真实 projectile facts | native；pipeline；u_13；engine_policies；neutral；combat/giants |
| strength | Player.effectiveStrength:41；growth nativeBonuses | src/entities/Player.ts:41；src/ext/runtime.ts:425 | 账本物化 strength；effective-strength 节点承载 weakness | native；runtime；growth attributes/templates/lifecycle |
| max-hp | runtime.nativeMaximumBase:968；growth reconcileGrowthMaximum | src/ext/runtime.ts:406；src/engine/Stats/MaterializedStats.ts:34 | 剥离旧 applied → 完整新来源 → foundation 单写；永久恢复由提供方提案显式给出 | runtime；engine_policies transformations；growth clone/itemGrowth |
| regeneration | Player.regenRatePerTurn:284；Monster 恢复:1680 | src/entities/Player.ts:292；src/entities/Monster.ts:1688；src/engine/Stats/NativeStatSources.ts:94/96 | POW_REGEN/怪物间隔为精确约分分数；仅回血消费转 number | native 70 组 ring/HP/status 分数；hunger_regen；u_14*；cloning |
| stealth-range | Game.ts:8306/8345/8376 原局部公式与端口 | src/engine/Core/Game.ts:8318；src/engine/Stats/NativeStatSources.ts:95；src/engine/Stats/NativeStatSources.ts:110 | 原生环境/戒指节点 + 来源；普通 clamp 2，原生休息/隐形 1 | runtime clamp；ai_1/p4_8；u_15b；growth skills/view |
| search-strength / awareness | Game.ts:625/8281 原端口与戒指读取 | src/engine/Core/Game.ts:627；src/engine/Core/Game.ts:8294 | 手动/自动 facts 共用管线，搜索算法仍在消费端 | pipeline 条件；p1_42；search_progress_hud；u_15b |
| clairvoyance / light | Game.ts:585/透视与矿灯 ringLightMultiplier | src/engine/Core/Game.ts:590；src/engine/Core/Game.ts:3167 | 两个感知入口与照明读同一节点；光照变化标脏 | native rings；u_15b；flare/sidebar；UR traces |
| reaping / transference / wisdom | Combat 戒指收益；ArcanaRecharge.equippedWisdomBonus:60 | src/engine/Combat/Combat.ts:370；src/engine/Combat/Combat.ts:761；src/engine/Core/Game.ts:11278 | 战斗/法杖消费改读 query；纯戒指表仅在原生来源内 | native rings；u_15b；x3_u8c；neutral recharge |
| attack-speed / move-speed | Creature 原字段读者；TimeCoordinator:222/467；Game 多处 | src/engine/Core/TimeCoordinator.ts:226；src/entities/Monster.ts:1069；src/engine/Core/Game.ts:4637 | L0 速度与 L4 haste/slow；计时、移动/攻击、AI/侧栏全消费 query | native；p2_1/2/3/4；phase4b；combat/giants traces |
| runic-power / armor-runic-power | Game.ts:8574/8752；BoltReflection:43；Combat runicWeaponChance | src/engine/Core/Game.ts:8510；src/engine/Core/Game.ts:8692；src/engine/Combat/BoltReflection.ts:44 | 独立符文键默认依赖装备附魔；现 CE 时长/强度表保留作节点 | native DAG；u_15d*；armor_runic；slaying |
| resist physical/fire/poison/other | Creature.takeDamage/addPoison 原无抗性键 | src/entities/Creature.ts:371；src/entities/Creature.ts:272 | 直接伤害按 damageKind 抗性；毒时长先缩放；0 来源等价 | native 零抗性；runtime；gas/status/bolt/body tests |
| combat capacities/regen/recovery/cost | 旧 growth.combat-stats.v1；三处 DTO 消费者 | src/engine/Core/PhasedAttackProduction.ts:88；src/ext/modules/combat/partBreak.ts:44；src/engine/Core/Game.ts:11542 | combat 模板 L0；容量账本；速率/费用 query；无 combatStats 持久行 | combat 全套；giants zones；growth combat-stats；runtime |
| growth focus/interval/cooldown/xp | growth.rulePolicies:532；optional query:510 | src/ext/modules/growth/statSources.ts:15；src/ext/modules/growth/module.ts:77；src/ext/modules/growth/module.ts:162 | 全部生产读点经 query/own-component hypothetical；纯计划复用同一核 | growth 全套；runtime foreign proposal；UI；组合 smoke |

完整原生键/模块键表、上限、舍入与固定 DAG 见 [stats-config](stats-config.md)。新增 native 影子覆盖真实 Game 三种子、玩家/四类怪物、附魔/力量差/weakness/donning、haste/slow、全部戒指类及已知投影、70组玩家回血分数、零抗性、合法四分之一附魔。pipeline/runtime 覆盖各类别/槽、预算临界、条件词汇、目标双边池、极端安全整数、非法 override/DAG/纯JSON、RNG/冻结/不写假设、漏脏与 LRU、五键物化、永久/临时政策、load/逐条 replay/seek/续录、坏账本、命令/生成回滚与真实 S7 图。

### 逐键硬限与舍入

| 键 | 单位 | 下限 | 上限 | 类型 | 最终舍入 |
| --- | --- | ---: | ---: | --- | --- |
| native.regeneration | 精确 HP/turn 分数 | 0 | 1000000 | rational query | 精确约分，不舍入 |
| native.regeneration-bonus | 戒指附魔单位 | −1000000 | 1000000 | query | floor |
| native.weapon-enchant / armor-enchant | 四分之一附魔点 | −800 | 2000 | query | floor |
| native.accuracy | accuracy | 0 | 1000000 | query | floor |
| native.hit-chance | bp | 500 | 9500 | pair query | floor |
| native.defense | 十分之一防御点 | 0 | 1000000 | query | floor |
| native.evasion | bp | 0 | 10000 | pair query | floor |
| native.damage-min / damage-max | HP | 0 | 1000000 | query | floor |
| native.physical-damage-dealt / physical-damage-taken | HP | 0 | 1000000 | pair query | floor |
| native.strength | strength | 1 | MAX_SAFE_INTEGER | materialized | floor |
| native.effective-strength | strength | −1000000 | 1000000 | query | floor |
| native.max-hp | HP | 1 | MAX_SAFE_INTEGER | materialized | floor |
| native.stealth-range | tile | 普通 2、原生休息/隐形 1 | 1000000 | query | floor |
| native.search-strength | search strength | 0 | 1000000 | query | floor |
| native.awareness | search strength | −1000000 | 1000000 | query | floor |
| native.clairvoyance / light / reaping / transference / wisdom | 原生戒指单位 | −1000000 | 1000000 | query | floor |
| native.attack-speed | tick | 有来源时 25 | 有来源时 max(400, 原生值) | query | floor |
| native.move-speed | tick | 1 | 1000000 | query | floor |
| native.runic-power / armor-runic-power | 四分之一附魔点 | −800 | 2000 | query | floor |
| native.resist.physical / fire / poison / other | bp | 0 | 7500 | query | floor |
| combat.stamina-capacity / poise-capacity | resource | 1 | 1000000 | materialized | floor |
| combat.stamina-regen / poise-recovery / native-attack-cost | 模板分子/费用 | 0 | 1000000 | query | floor |
| growth.focus-capacity | focus | 0 | 1000000 | materialized | floor |
| growth.focus-recovery-interval | tick | 0 | 1000000 | query | floor |
| growth.cooldown-duration | tick，ceil | 0 | 1000000 | query | ceil |
| growth.xp-gain | XP | 0 | MAX_SAFE_INTEGER | query | floor |

原生键没有生效的模块来源行时不套表中硬限，保留 CE 原生求值；原生显式 clamp 仍生效。有来源的 attack-speed 下限25，上限 max(400, 原生值)。原生 CE 节点的既有取整不改变；公共来源只在整条管线末尾舍入一次。零修正原生影子24项覆盖各键类和真实Game多种子，精确回血按S18裁定，不以旧浮点舍入误差判断分数不等。命中零来源的0/99/100保证分支继续由消费边界处理。普通更高上限满足任务的至少原生十倍约束，指定命中/攻速/抗性限值按S11例外；HP/力量/XP使用MAX_SAFE_INTEGER保留溢出守卫。


## 4 i18n、失败处理、旧前提与逐字段归因

5A1 `c3319ae` 的 p1_30 对应守卫通过；冻结 5A2 HEAD 同一守卫在三个新增 C5 读点失败：WorldWork 的 d.nameKey、Item 的材料名称 this.name、DetailGenerator 的 item.description 直接作为动态 t 的首参，缺 ext 命名空间限定。修复引入 worldText 的受控 `ext.${suffix}` 翻译入口，三处生产调用改用它；i18n 守卫及断言不改。证据：5A1对应单项守卫exit0（1通过/25由-t过滤，3.16s），5A2同项exit1（1失败/25过滤，2.29s），修复后两个i18n文件全部29项通过（exit0，11.40s）；日志 p5a2s-i18n-5a1.log、i18n-baseline.log、i18n-fixed.log，最终底座集合再次完整复验p1_30/u24。

旧结构前提已迁移：growth 测试读 foundation.stats.applied 替代 derived 组件，manifest 查 growth 条目替代依赖数组索引；combat 测试读管线容量替代 combatStats DTO，坏档继续拒绝；旧规则端口观测替换为 statSources/frozen facts。攻击结果、HP、概率骰、RNG、资源、完整机械快照的有效断言保持。

装备旧 fixture 曾只写槽而未把 Item 加进 inventory，在 S7 下不再是装备来源。neutral、giants sweep、growth skills 和 source-consumer fixture 只补所有权前提，数值断言不放宽。冻结基线原 neutral 6项、growth属性/生命周期37项、giants目标5项、physical-before-shield1项均通过；另外在当前冻结副本恢复旧悬挂槽 fixture，**只改变 NativeStatSources 这一生产文件的 inventory 成员判断**：新规范时2失败/2通过，临时旧判断时4/4通过；正式实现保持新规范。日志 one-file-counterfactual-before/after；实际源码不放松 S7。

既有 D4/U15a save.version=4 断言在冻结5A2也失败；只更新为已经存在的whole-run5，recording4及其零OOS/seek/续录断言保留。修复本次真实回归：classic 新 Player 未配置环境导致气味差异；休息/光照漏标脏导致 giants HUD 的缓存漂移；身份容量对象使 implicit pool 变成 actor 行导致拒载/stale/no-payment断言失败；原生零移动速度被 clamp 掩盖；无事件钩子的原生装备/GC/克隆继承/最大生命重置账本变更未触发摘要脏标记；无 strength 原生字段的 NPC 错从默认基础剥离加值；零冷却的 baseValue 污染其它容量键而拒绝临时技能；资源模板切换仍使用旧行基础。基础覆盖现只作用于当前键，资源消费显式带当前/已接受模板、切换后标脏。生产均修复，未绕过守卫。

首轮门禁有失败及中断（exit130）：all-module-final、all-modules-complete、final-root-gate、root-complete。原因和更正如上；编辑与测试同时刷新时还出现一次旧加载的 StatPipeline 没有 sourceSignature 方法，后续全新进程验证排除了混载。新测试自身错误曾包含错误 descriptor.version 名称、已装备基值及仅捕获未调用来源的 fixture 前提；已修，不伪装成生产回归。最终结果只引用最终日志。smoke 初版误监听仅 phased 路径、对角阻挡后空转、未升级就终止；改成真实 CombatSystem 攻击、可通行四向路由和实际升级，保留正伤害/分配断言。

没有生成基线或原生数值变化。UR4 和 giants 黄金 trace 仅随版本身份更新，逐叶登记如下。独立 Merkle 固定向量按原 Node crypto+c5Canonical 方法重录：单变量 codecIdentity/header.foundation 7→8，六个 domain hash 全部不变，空域 root、recordingStart、首chain分别变化如下（日志 p5a2s-capture-vectors.log）：

| 字段 | 旧 | 新 | 归因 |
| --- | --- | --- | --- |
| empty root | e47b9c6389bbb10231605f929a086f5f90c6d34c480b0ddfd521f7b53a67264a | 8cd4143674ecc3e7cd23fc439be10b6960988788ee563ea87ce226d8804bb6f1 | codecIdentity foundation |
| recordingStart | b79ac6f05064939958ee8aef5cae19fdc77bec262c494ea4b4fca39490119681 | 76970205a70642ae188cc5c2b3e61a99d1e4eef32e41eb98c0d468e960a37b5e | header.foundation + initialDigest.root |
| first chain | 8e517f61f9d903949ade9dae12442001e2a221c017c860e2f3b40b165878ee79 | 978f9315ab7164b5b10a7261e32c2ff7c14dc108e5cb7eacb13b96b3a4443d23 | recordingStart 传递 |

### 黄金 trace 重录逐字段登记

没有生成基线或原生数值变化。原捕获方法重录的变化如下；旧值/新值全列，不以“更新快照”代替归因。

UR4：在仓库外当前候选副本，仅回退同一 foundation 版本身份（Game 录像头和 RecordingDigest.codecIdentity 两个写点均8→7），严格旧 trace 测试通过（exit0，1项，5.21s）；这是同一个版本变量，未回退数值实现。再用 `UR4_CAPTURE=1 UR4_CAPTURE_DIR=/private/tmp/p5a2s-ur4-capture npx vitest run src/test/u_r4_trace.test.ts --maxWorkers=2` 的原捕获入口重录。完整叶差分仅52个 chainDigest，事件、world/native快照、tick和RNG字段没有变化。

压缩文件 `src/test/fixtures/traces/u-r4-trace.json.gz` SHA-256：`ceece712d26e4e117663d8c4321e49507de1a5a076b00288facbb9f4b42e7b10` → `438581e21cd4c39b77c83b085c75969b9738836c8b83ae5e8c87bf8607e88c07`。

| UR4 JSON Pointer | 旧 chainDigest | 新 chainDigest |
| --- | --- | --- |
| `/death/animated/rows/1/recording/0/chainDigest` | `09ce365e49d11e9bb880587aaf174fb11133727ac35b9a0aedc103248aee7d23` | `d5847b6eec1cc098d717e282c1f18823d194f3bd4183b18a59f0e4d6f167c0a0` |
| `/death/continuous/rows/1/recording/0/chainDigest` | `09ce365e49d11e9bb880587aaf174fb11133727ac35b9a0aedc103248aee7d23` | `d5847b6eec1cc098d717e282c1f18823d194f3bd4183b18a59f0e4d6f167c0a0` |
| `/fall/animated/rows/0/recording/0/chainDigest` | `fc2970117c886588fda78b98135dfedb58dc9d03fa4ea998bf4c059cf26b7931` | `50b940396fa7226ca19e56fcad99c98e14aea7f0ac82e92fd27b298333fd7d5a` |
| `/fall/continuous/rows/0/recording/0/chainDigest` | `fc2970117c886588fda78b98135dfedb58dc9d03fa4ea998bf4c059cf26b7931` | `50b940396fa7226ca19e56fcad99c98e14aea7f0ac82e92fd27b298333fd7d5a` |
| `/hasted/animated/rows/0/recording/0/chainDigest` | `de17829552b5cb761c3f165a1fdd2e1342f891f120c3ac2bf644e665be8d07bc` | `d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389` |
| `/hasted/animated/rows/1/recording/0/chainDigest` | `de17829552b5cb761c3f165a1fdd2e1342f891f120c3ac2bf644e665be8d07bc` | `d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389` |
| `/hasted/animated/rows/1/recording/1/chainDigest` | `ea7c9aefd3a3f94273b206f4bc5c61899558dd86da115e4debb6aa77efcd4893` | `0a1d42bd1a4bd7b3974d1a2d597884bbde5bb8088dbbe2f58201b8005e5d8ef6` |
| `/hasted/animated/rows/1/recording/2/chainDigest` | `5061370a0e3f8389ad15771bfdb6153f71950d2ce0e1f776d807fee3840bb581` | `1d1e7f2b3c13d6415a3117f472c114eff027a600ad4996a9931eefada185a2bd` |
| `/hasted/animated/rows/2/recording/0/chainDigest` | `de17829552b5cb761c3f165a1fdd2e1342f891f120c3ac2bf644e665be8d07bc` | `d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389` |
| `/hasted/animated/rows/2/recording/1/chainDigest` | `ea7c9aefd3a3f94273b206f4bc5c61899558dd86da115e4debb6aa77efcd4893` | `0a1d42bd1a4bd7b3974d1a2d597884bbde5bb8088dbbe2f58201b8005e5d8ef6` |
| `/hasted/animated/rows/2/recording/2/chainDigest` | `5061370a0e3f8389ad15771bfdb6153f71950d2ce0e1f776d807fee3840bb581` | `1d1e7f2b3c13d6415a3117f472c114eff027a600ad4996a9931eefada185a2bd` |
| `/hasted/animated/rows/2/recording/3/chainDigest` | `5c7d8fc8aa1a350162770d4e2ef321953113e2e42d62914b713ee19f2d8b7183` | `646a47b1351bd4b630336c8b475a067fd49f290e748ac4247c0e1403626bbb4d` |
| `/hasted/continuous/rows/0/recording/0/chainDigest` | `de17829552b5cb761c3f165a1fdd2e1342f891f120c3ac2bf644e665be8d07bc` | `d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389` |
| `/hasted/continuous/rows/1/recording/0/chainDigest` | `de17829552b5cb761c3f165a1fdd2e1342f891f120c3ac2bf644e665be8d07bc` | `d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389` |
| `/hasted/continuous/rows/1/recording/1/chainDigest` | `ea7c9aefd3a3f94273b206f4bc5c61899558dd86da115e4debb6aa77efcd4893` | `0a1d42bd1a4bd7b3974d1a2d597884bbde5bb8088dbbe2f58201b8005e5d8ef6` |
| `/hasted/continuous/rows/1/recording/2/chainDigest` | `5061370a0e3f8389ad15771bfdb6153f71950d2ce0e1f776d807fee3840bb581` | `1d1e7f2b3c13d6415a3117f472c114eff027a600ad4996a9931eefada185a2bd` |
| `/hasted/continuous/rows/2/recording/0/chainDigest` | `de17829552b5cb761c3f165a1fdd2e1342f891f120c3ac2bf644e665be8d07bc` | `d8031788969becea46b5660dbc717a5d01c279f841cbd800e70ed423862f4389` |
| `/hasted/continuous/rows/2/recording/1/chainDigest` | `ea7c9aefd3a3f94273b206f4bc5c61899558dd86da115e4debb6aa77efcd4893` | `0a1d42bd1a4bd7b3974d1a2d597884bbde5bb8088dbbe2f58201b8005e5d8ef6` |
| `/hasted/continuous/rows/2/recording/2/chainDigest` | `5061370a0e3f8389ad15771bfdb6153f71950d2ce0e1f776d807fee3840bb581` | `1d1e7f2b3c13d6415a3117f472c114eff027a600ad4996a9931eefada185a2bd` |
| `/hasted/continuous/rows/2/recording/3/chainDigest` | `5c7d8fc8aa1a350162770d4e2ef321953113e2e42d62914b713ee19f2d8b7183` | `646a47b1351bd4b630336c8b475a067fd49f290e748ac4247c0e1403626bbb4d` |
| `/slowed-environment/animated/rows/2/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/animated/rows/3/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/animated/rows/4/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/animated/rows/4/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/animated/rows/5/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/animated/rows/5/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/animated/rows/6/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/animated/rows/6/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/animated/rows/6/recording/2/chainDigest` | `1767702d780c5bf067cd8244656107bb0828978e78aa420c36199026754a5b6e` | `0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0` |
| `/slowed-environment/animated/rows/7/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/animated/rows/7/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/animated/rows/7/recording/2/chainDigest` | `1767702d780c5bf067cd8244656107bb0828978e78aa420c36199026754a5b6e` | `0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0` |
| `/slowed-environment/animated/rows/8/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/animated/rows/8/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/animated/rows/8/recording/2/chainDigest` | `1767702d780c5bf067cd8244656107bb0828978e78aa420c36199026754a5b6e` | `0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0` |
| `/slowed-environment/animated/rows/8/recording/3/chainDigest` | `bc8e25ec9529867b22bf89c03d75c95c428b3e7175923a5bbc1aa0e401bea948` | `973ebd4ffa6e51e64082d1fec05b77a47b022c8e6c4d71003031ce346f1b61ca` |
| `/slowed-environment/continuous/rows/2/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/continuous/rows/3/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/continuous/rows/4/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/continuous/rows/4/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/continuous/rows/5/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/continuous/rows/5/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/continuous/rows/6/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/continuous/rows/6/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/continuous/rows/6/recording/2/chainDigest` | `1767702d780c5bf067cd8244656107bb0828978e78aa420c36199026754a5b6e` | `0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0` |
| `/slowed-environment/continuous/rows/7/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/continuous/rows/7/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/continuous/rows/7/recording/2/chainDigest` | `1767702d780c5bf067cd8244656107bb0828978e78aa420c36199026754a5b6e` | `0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0` |
| `/slowed-environment/continuous/rows/8/recording/0/chainDigest` | `864a5388d730ec0163755ca2cd530ecc2876ceae4b7bf10f4e6e2926f3a740e6` | `470b583c827e83aec0009534d1774979b0cee37fe502e44ff6f1e2bb0c478618` |
| `/slowed-environment/continuous/rows/8/recording/1/chainDigest` | `f7150e77aff1d41685ca57a9962cee781ceae0a61d7fd6fba81b3f7421c7116e` | `a6170f7d52d57031595f0ef311cc682c27c63fc72ee4c2d09382e913360f15a2` |
| `/slowed-environment/continuous/rows/8/recording/2/chainDigest` | `1767702d780c5bf067cd8244656107bb0828978e78aa420c36199026754a5b6e` | `0611ccdb5e7d646f924bddc3af721d887aa9defeca9c43be71ff22c02b619dd0` |
| `/slowed-environment/continuous/rows/8/recording/3/chainDigest` | `bc8e25ec9529867b22bf89c03d75c95c428b3e7175923a5bbc1aa0e401bea948` | `973ebd4ffa6e51e64082d1fec05b77a47b022c8e6c4d71003031ce346f1b61ca` |

每行原因相同：foundation codecIdentity/录像头改变→initial root/start改变→该事件chain传递。原始差分 `/private/tmp/p5a2s-ur4-leaf-diff.json`。

Giants：在候选副本仅回退 `src/ext/descriptor.ts` foundation8→7，三个严格旧自然trace通过（exit0，3项，22.73s）。再用原 `BROGUE_CAPTURE_GIANTS_TRACE=1` 捕获入口重录，三个配置JSON各只改 extensionsHash。完整 extensions 叶比较每场恰好 `/foundation/version:7→8`、`/manifest/foundation:7→8`；native/world hash、命令路径/数量、boss状态、实质/美容RNG均相同。当前新trace独立复验exit0，3项，23.16s；最终模块门禁再验。

| 文件 | 旧 extensionsHash | 新 extensionsHash | 旧文件 SHA-256 | 新文件 SHA-256 |
| --- | --- | --- | --- | --- |
| src/ext/modules/giants/data/natural-trace.json | `b9b32e012e9d5aa3e45c967cc054ae1541152af96c41e55a8dc30b985aff9075` | `70d0a2a4d84a1d1c234a9d806ffd9c2e3fc429162641c05acee49825ffd5c70b` | `a2ee53b6a6c542fbfcd139ff4132ad403b3ea19484f1790fe2c9ed832c7b6095` | `685b4388fb3716cd793d57f7aba8812a2be312c08a13360026d09ef7497c258f` |
| src/ext/modules/giants/data/colossus-natural-trace.json | `c91c21b13e36aade93235c3e2073562ef2191921b60f3e13a27721126fefd6e6` | `81b36977e975059b6e689388cd7bd9d41eb9ae1817f5c997784e8965d05d61f0` | `a66f6687512a62f598c8fd60870bb87555c9d890e8fdb8cabb2dc64e01a3d3df` | `c5dabe67ce895d6d4ca9fc0169b16f9ac76645e99d29060daadc5a800a81e38a` |
| src/ext/modules/giants/data/spine-natural-trace.json | `964b29e2e5a0c6773cd412681200ba464fa4a49869718aa4fdb86258df9e5237` | `42fd044a099b1f6b9ba69aac81fb0ab777412a0a38518fd96d7b8b30c67d3b50` | `6c0773fefb9dbf4b69d170e8832e512a756ea68e21643f2b95d1d224c4cc5cf7` | `93785fb56f953485f6a04925af5866f0f66af6d8283abb9e772b197ed10d7282` |

原始逐叶比较 `/private/tmp/p5a2s-giants-trace-diff.json`；可靠反事实日志 `p5a2s-trace-foundation-counterfactual.log`。所有捕获副本和原始证据位于 `/private/tmp`，只更新既有正式黄金文件（UR4 gzip沿用已有约1.3MB规格），不新增原始日志/截图。


## 5 首次封板开发期门禁（审查前；本轮复验见 §8）

每次 Node/Vitest/构建前：

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
export BROGUE_CE_DIR=/Users/coolking70/Documents/同步空间/BrogueJS/.ce-reference/BrogueCE-master
```

Node 实际24.19.0，Vitest统一 `--maxWorkers=2`。仅开发期相关集合；不跑完整 npm test/test:ext/removal/CE full/gen/drift。本步没有生成/随机流算法变更。`npm run ce:fetch` 已尝试，exit1（沙盒网络无法解析github.com）；相关CE源断言使用本机已缓存源码，SOURCE.json 固定 legacy commit49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9。没有把缺源码跳过当通过。

表中112路径展开为附录的全部路径；实际参数数组、退出码和进程wall time另存 `/private/tmp/p5a2s-root-sealed-command.json`。模块命令按目录过滤，实际发现37growth/33combat/18giants；不是全量test:ext。下表不相加重叠项。

| 实际命令（测试均--maxWorkers=2） | 退出码 | 文件/用例结果 | 耗时 | 证据日志（/private/tmp） |
| --- | ---: | --- | ---: | --- |
| `node scripts/check-module-boundaries.mjs` | 0 | pass | 3.21s wall | p5a2s-boundary-timed.log |
| `npx vue-tsc -b` | 0 | pass | 15.27s wall | p5a2s-types-timed.log |
| `npm run build` | 0 | pass | 22.74s wall | p5a2s-build-timed.log |
| `npx vitest run <附录112个路径> --maxWorkers=2` | 0 | 112文件/2799通过、8既有skip、4既有todo | 1746.31s（wall 1746.88s） | p5a2s-root-sealed.log |
| `npx vitest run src/ext/modules/growth/tests src/ext/modules/combat/tests src/ext/modules/giants/tests --maxWorkers=2` | 0 | 88文件/1482通过 | 1769.62s | p5a2s-modules-sealed.log |
| `npx vitest run src/test/ext_stats_pipeline.test.ts src/test/ext_stats_native.test.ts src/test/ext_stats_runtime.test.ts src/test/ext_foundation_contracts.test.ts src/test/ext_recording_v4_digest.test.ts --maxWorkers=2` | 0 | 5文件/113通过 | 42.07s | p5a2s-ledger-final.log |
| `npx vitest run` + 18个C5/录像/修复文件（下列清单）+ `--maxWorkers=2` | 0 | 18文件/239通过 | 172.51s | p5a2s-bottom-sealed.log |

18文件为 ext_recording_v4_storage、ext_recording_v4_snapshots、ext_world_harness_combinations、ext_world_harness_closed_loop、ext_world_work_transactions、ext_world_work_review、ext_world_work_boundaries、ext_world_work_sdk_contract、ext_world_work_failures、ext_combat_transition_facts、phase3a0_scheduler、u_15a_shattering、u_r4_trace、p1_30_i18n_gate、u24_hardcoded_text、test_suite_membership、repo_hygiene、ext_engine_policies（均 src/test/<名>.test.ts）；最终112文件包含它们。

最终底座的既有8个显式skip和4个todo，逐项属于 p2_1的4个旧相位/生成快照、p2_2的2个旧快照、p2_3的2个旧快照，以及 CombatFormulas的4个旧符文时长/镜像/力距todo；这些声明未改。设置BROGUE_CE_DIR后，本步相关CE条件源码断言执行，未额外因缺CE跳过。

初轮相关大集合不是绿门禁：底座107文件101通过/6失败，2643通过/10失败/8skip/4todo，1214.90s；模块88文件82通过/6失败，1473通过/9失败，1270.40s。当时tee壳返回0，但Vitest实际失败1，按失败记录，不用壳的0掩盖它。根因及修复见§4；最终命令直接传递Vitest退出码。模块初轮失败涉及 giants_trace、combat_native_stamina、ext_growth_combat_stats、ext_growth_item_runtime、combat_defense_state、combat_native_defense；底座初轮涉及 ext_stats_native、ext_stats_runtime、phase3a0_scheduler、ext_combat_transition_facts、u_15a_shattering、u_r4_trace。

修复过程的新反例先失败再通过：账本装备/GC/无字段NPC基础3项（3失败/20过滤，1.48s，p5a2s-ledger-boundary-before.log），clone/reset2项（2失败/23过滤，1.44s，p5a2s-ledger-copy-reset-before.log），双方各64来源1项（1失败/35过滤，p5a2s-pair-budget-before.log）。最终三份stats文件总85项均通过并纳入112文件大集合，没有更改断言来容纳错误行为。


相关 root 清单由关键词 netEnchant/playerDefense/ringBonus/regenRatePerTurn/stealthRange/searchStrength 与实际修改文件并集选取，加任务指定 C5/recording/UR2/3/4/U03/UI/i18n/状态守卫；底座112个独立文件（含5个补充修改测试），模块37growth+33combat+18giants。分组有重叠，测试数量不能直接相加。全部列表见附录。最终类型/构建只有既有500kB chunk提示。

真实组合 smoke 命令 `node /private/tmp/p5a2s-smoke.mjs`，exit0，日志创建至末次写入跨度约90.56s，八组全部通过（证据 `p5a2s-smoke-sealed.log` / `p5a2s-smoke.json`，engine-only）。seed7397，通过公共 registry 初始化命令建立真实新局，不改地图/actor/HP、不强制刷新敌人；普通 move/bump 产生正伤害，公开 item 命令卸下/重新装备起始武器。growth 自然升到2级（XP64）后，公开命令分配 constitution1。所有组均完成完整 digest 一致的 save/load、逐事件 replay零OOS、seek2/末尾、重新读档续录+1输入。公开 harness 的mode仍normal；实际Game的wizard用于完成长烟测，未修改SDK。

| 模块集合 | 原始局正伤害攻击 | 成长加点 | 录像命令 | save/load/replay/seek/续录 |
| --- | ---: | ---: | ---: | --- |
| 空 | 1 | 0 | 15 | pass |
| growth | 14 | 1 | 89 | pass |
| narrative | 1 | 0 | 15 | pass |
| combat | 1 | 0 | 15 | pass |
| giants | 1 | 0 | 15 | pass |
| growth,narrative,combat,giants | 13 | 1 | 87 | pass |
| growth,combat | 13 | 1 | 87 | pass |
| craftskel,growth,narrative,combat,giants | 13 | 1 | 87 | pass |

表中攻击仅计原始游玩局；smoke汇总的attack计数包含随后replay，不能把两者混称原始战斗次数。C5骨架实际harvest/place/craft/cancel/escrow与NPC-mid-bundle闭环另由最终底座门禁中的world-work/harness测试验证。没有进行浏览器像素验收，本步任务要求engine-only。


### C5 与已验收5A2的直接逐叶对照

`node /private/tmp/p5a2s-c5-differential.mjs`，exit0，33.51s；source baseline为HEAD的只读归档（与eb31996的src/scripts/public完全相同）。复用原harness闭环场景，seed51020001，逐步harvest/place/craft2批/cancel，save/load、完整replay、seek3、存档续作完成第二批，再replay续录。两棵树均完成4条最终分支命令。只在仓库外SSR观察独立merkleDomain的完整输入，SDK/harness文件不改，不归一化机械值。

每阶段 native/world5/actorActions/knowledge/random 五个域及其全部输入叶完全相同，tick、物品根、工单、RNG没有差异；extensions每阶段恰好2叶：`/root/foundation/version`和`/root/manifest/foundation`均7→8。current codecIdentity8配合这两叶重新计算root，与最终实际root逐值相等。

| 阶段 | baseline root | current root | 完整叶差分 |
| --- | --- | --- | --- |
| startup | `5e934473487691ceaab0c721c246ad8f05ea6447d18132bcc83b299117064991` | `d24b02bef7293394f59e56d0c6f8d72b14fb43195adfcf1bb8be3006e3026c5b` | 仅上述2个版本叶 |
| harvest | `1b3de80ad85f90168e8afe7870b3f8ae507ed2f3166e00aad4f07d20337587ce` | `ed5793e4ae055a04a714945035b249219af4e2bcefe3f21ee110207a6002d5e0` | 仅上述2个版本叶 |
| station | `86baccfdb3d87ab16becd961cc6b7195eb27c452e3db7aeaa22e57cdfa33860b` | `dc73d0d22ce13b52ce2749c77ea216cdf0386b6ea33a705197fdee15b7639611` | 仅上述2个版本叶 |
| mid-craft | `a764174f2a73c6afdebdd2053d32e3ff318160f77f78f865158da83a42cc0469` | `5894b68ec600e3c1a6a0b7fa4a8c0d6f5dfb64c4087d90f4e2f3c797d398bc6b` | 仅上述2个版本叶 |
| cancel | `73d44d8d2a2fbebbbac924f339f3b6007a2202354f79b1ff5c10aee2ded2fd34` | `045f053580dc7253f677a5f5c91145d9d5e88d70ee484057ba029c6a3c038ba1` | 仅上述2个版本叶 |
| save-load | `73d44d8d2a2fbebbbac924f339f3b6007a2202354f79b1ff5c10aee2ded2fd34` | `045f053580dc7253f677a5f5c91145d9d5e88d70ee484057ba029c6a3c038ba1` | 仅上述2个版本叶 |
| replay | `73d44d8d2a2fbebbbac924f339f3b6007a2202354f79b1ff5c10aee2ded2fd34` | `045f053580dc7253f677a5f5c91145d9d5e88d70ee484057ba029c6a3c038ba1` | 仅上述2个版本叶 |
| seek3 | `a764174f2a73c6afdebdd2053d32e3ff318160f77f78f865158da83a42cc0469` | `5894b68ec600e3c1a6a0b7fa4a8c0d6f5dfb64c4087d90f4e2f3c797d398bc6b` | 仅上述2个版本叶 |
| continuation | `f615f343bac8cd891910be91d2fc21f7ab0b85f13521687f76f65f12d01279e8` | `d006bce43247eaacc857bcddb22fbbcdbd3ee322e230c43bec7e65aa2c7ee3be` | 仅上述2个版本叶 |
| continuation-replay | `f615f343bac8cd891910be91d2fc21f7ab0b85f13521687f76f65f12d01279e8` | `d006bce43247eaacc857bcddb22fbbcdbd3ee322e230c43bec7e65aa2c7ee3be` | 仅上述2个版本叶 |

完整逐叶数据 `/private/tmp/p5a2s-c5-baseline-leaves.json`、`p5a2s-c5-current-leaves.json`（各约16MB，仅仓库外）；每阶段域hash及差分见 `p5a2s-c5-differential.json`。私有观察脚本首轮把差异列表的枚举顺序当成失败，按路径码点排序后完整重跑通过，值/域断言未放宽；时长元数据原以ms误标seconds，已换算为33.51s，捕获的机械数据未改。

## 6 首次封板性能与5A2成本对照（审查前；本轮复测见 §8）

实际命令 `node /private/tmp/p5a2s-perf.mjs`，exit0，wall 82.65s。硬件 Apple M5 / 10核 / 32GiB / arm64；Node24.19.0、3GiB堆。最终进程与本轮tests/build隔离；两棵真实源码树同进程成对比较，不用纯数组/空假根模拟存档。

首次封板输入hash：当时 src/scripts/public 的1015文件 `dcbc081896ae1046c4f408eb811ee0f2637fc2d818a77c1cbac7edad7962ce90`，测量前后相等并与封存hash一致；5A2只读对照 `922ca79ebe6892955a9922777df1a43f9d886b2f37b34cb430b7b1091e516ae1` @ `2d870a2`（该HEAD与验收eb31996在src/scripts/public无差异）。

每树2049真实命令，交错交换先后顺序，丢弃前32预热，8个每256命令的full checkpoint另列，普通2009配对样本计算 `current−baseline` 的P95，不能拿两个独立P95相减当新增成本。classic/ext-zero用escape录像输入；ext-zero为实际空statSources模块。D1/D8使用实际C5票据，每次命令完成一个批次，累计每树2049个completed事实；材料循环产出、工具耐久10000、1tick配方和无活跃敌人的受控fixture用于持续采样，不是新增生产配方。D8真实生成并缓存7层，加当前层共8层，Set核对visitedLevels=8；D1为1层。

| 场景 | n | baseline median/P95 ms | current median/P95 ms | 新增 median/P95 ms | 新增P95阈值 ms |
| --- | ---: | --- | --- | --- | ---: |
| classic | 2009 | 0.030333 / 0.034250 | 0.030375 / 0.034167 | 0.000042 / 0.001958 | 1，pass |
| ext-zero | 2009 | 0.058500 / 0.066292 | 0.058375 / 0.071208 | -0.000041 / 0.005459 | 5，pass |
| craft-D1 | 2009 | 6.319291 / 6.778875 | 6.396125 / 6.857291 | 0.077000 / 0.562501 | 10，pass |
| craft-D8 | 2009 | 6.139000 / 6.600500 | 6.227208 / 6.699875 | 0.089834 / 0.525542 | 10，pass |

强制full checkpoint当前树成本（每组n=8，未混入普通样本）：

| 场景 | median ms | P95 ms |
| --- | ---: | ---: |
| classic | 68.755708 | 139.369792 |
| ext-zero | 70.651541 | 141.836792 |
| craft-D1 | 85.925667 | 167.990208 |
| craft-D8 | 559.297084 | 1135.256084 |

真正开启四个生产模块的普通非debug运行期，seed7397，玩家accuracy查询，各10200次，丢弃前200，命中与clear后未命中各10000样本：

| 查询 | median ms | P95 ms | 阈值 ms |
| --- | ---: | ---: | ---: |
| hit | 0.001167 | 0.001333 | 0.01，pass |
| miss | 0.058041 | 0.064334 | 0.1，pass |

普通战斗采样为四模块真实Game的24个已完成追敌/普通bump回合，玩家攻击2次、正伤害2次、physical-pair3次。初始化前在prototype安装计时器，使已绑定module façade也进入统计；6个查询方法及sourceSignature/validateSources共11988个外层调用，不重复累计嵌套调用。累计 **668.780821ms**，每回合median **27.594241ms**、P95 **40.118742ms**、max 42.754173ms；这是管线求值/来源签名/预提交校验总成本，不是整个游戏回合wall time。该总成本任务没有另设上限。首轮仅计六查询得到247.76ms，发现漏计预检后扩为八入口，最终采用本轮668.78ms，未拿较小旧值交付。

测量边界：最初计划32回合的固定追敌路线，在第27条命令（i=26、turn27）遇到既有 `Actor action scheduler: inconsistent phase clock`。在已验收5A2只读树用完全相同seed/命令复现：combat action2，decision/timeCharge owner10，elapsed70，inter-segment index1 remaining0，另一个NPC提交bundle时触发原守卫。当前与基线诊断状态相同，日志 `p5a2s-combat-perf-diag.log` / `p5a2s-combat-baseline-diag.log`；本步不改非目标动作根/调度器，不把32回合说成通过。最终统计24个完整完成的回合前缀（含实际正伤害），不是一场完整战斗结束的计时。

基准脚本的初版batchCount2在第一批完成后仍有活票据，不能接下一张票据；改成一批一张、循环材料后才完成2049次真实批次。标准战斗计时也补纳入原先遗漏的来源签名与校验。这些是仓库外测量器修正，生产代码/守卫/阈值不改。全部原始成对样本、JSON和日志保留 `/private/tmp/p5a2s-perf*.json`、`p5a2s-perf-sealed.log`，无>1MB原始证据进入仓库。


## 7 后续交接与交付检查

6A0/6B：使用 src/ext/stats.ts 的只读 StatQuery、statSources、有限条件与稳定 sourceKind/sourceId。own-component previewStats 只能投影本模块；物化五键由 foundation 写回，装备/技能不得 refill。equippedItems 的统一DTO留给6A1添加 moduleData，继续遵守 inventory 根规范，不另建所有权系统。labor-rate仍不存在，C5 elapsed×1及冻结SDK不变。

5A3：回血读取 `stats.rational(actorId,'native.regeneration')`，安全约分数仅在回血消费边界转number；不能调用.value读回血，不能用UI/日志消费实质随机流。继续使用原生怪物计数器或本键消费适配，不新增第二回血源。

集成人：本步合入后必须按合同§11.4重跑dot的crafting自然trace/save/replay/seek，并逐字段归因。预期影响仅foundation/growth身份外壳、由其引起的header/manifest/root/chain指纹及extensions账本；native/world5/actorAction具体数值、tick、原生Item根、RNG次数/状态应等价。当前骨架C5闭环、8层真实批次性能与SDK hash已验证；尚未发生合入，不能把本步测试替代实际crafting模块合入后的交接动作。

交付检查：最终HEAD仍 `2d870a2a420ceb75ba95b42c55afd6731dddacd1`，无commit/push。SDK/harness/两个冻结fixture四个SHA与5A2一致；package.json/锁文件未改；无CRLF；没有新增>1MB原始证据。唯一大于1MB的改动文件是已存在的正式UR4 gzip黄金fixture（1318770→1318825字节），按原捕获方法和上面52叶登记更新，原始逐叶数据在仓库外。最终源hash与门禁封存/性能前后相等，报告与README不在该源码hash输入。`git diff --check`通过。报告完成后README仅追加一行完成入口。

## 8 审查发现处理

本节对应 `phase5a2s.review-findings.md` 第一部分 F1–F9 与惰性标脏要求，覆盖本轮最终修复。第二部分调度器崩溃已被维护者划给另一 foundation 任务，本步没有修改 `ActorActionScheduler.ts`，没有合入 `/private/tmp/p5fix` 的候选调度修复。版本仍是同批次 foundation 8 / growth 1.8.0；回血精确分数裁定不变。

### 逐项复核、复现与修复

| 发现 | 根因与复核证据 | 最终处理 | 新增回归 |
| --- | --- | --- | --- |
| F1 | 原 `evaluateStat` 无来源也套 attack-speed 的400上限。原 speed.mjs 重现：减速 goblin_totem 600→400、arrow_turret 500→400、ogre_totem 800→400。 | 无该键模块行的原生求值不套硬限；有行时25…max(400, 原生值)，原生值包含 slow/haste/变异。原生显式 clamp 保留。S11/合同/手册同步，同批仍 foundation8。原脚本修后逐值600/500/800。 | review 用例遍历全部 monster×全部mutation（含无变异）×none/slow/haste；覆盖施法慢速旗标；零行800、正增量动态cap800、负增量下限25。 |
| F2 | 原 refill 看“整键是否存在永久行”，误把装备增量当永久成长；refill.mjs 重现40/20→70/50→40/40。 | 账本 reconcile 的 refill 恒为0；只有提供方已校验的资源提案显式恢复永久部分，装备/光环只改变容量与钳制。不新增 permanentBonus 或存档 schema。原脚本修后40/20→70/20→40/20。 | 账本反复穿脱三次；真实 Game growth 体质永久+3只补3，装备+30不补，第二次分配仍只补3，load 后反复换装仍不补。 |
| F3 | 原 stale.mjs 重现扩展防御50→50（classic50→40），手动 mark 才40；伤害标脏发生在随后酸腐蚀写入之前。 | Monster 的 geometry/takeTurn 两处酸腐蚀即时置脏；全仓实际原生附魔、力量需求、耐久、识别、叠堆、恢复写入审计见下节。Item/Inventory 的 WeakMap 回调只登记会话所有者，无实体存档字段。 | 两处酸腐蚀真实路径在伤害后特意预热脆弱窗口，下一读和save/load均defense−10；commutation/戒指鉴定/堆叠附魔；反射与武器符文识别两条来源依赖 runic.identified 的回归，以及已知堆叠力量药水在flare/回合/知识回调之前读取的回归。 |
| F4 | 原键声明 more 负值下限0，swift/wanderer 的负百分比被截掉。 | attack-speed/move-speed 的所有有名槽下限−5000bp，包括growth final；普通上限40000、growth final上限30000沿用。loot swift−5…−25%、wanderer−10%可直接表达。 | 两键的 equipment more−2500得到75、−9000按槽下限得到50。 |
| F5 | regeneration flat 的单位是整数HP/turn，无法承接戒指单位 mending。 | 新增整数 native.regeneration-bonus 与固定输入边 regeneration-bonus→regeneration，玩家仍走CE回血表、HP/间隔取整及精确约分。mending+1…+5应声明新输入键flat；不把整数戒指单位写速率。 | 每个1…5输入与实际同附魔再生戒指的 numerator/denominator 精确相等；原有所有回血/分数守卫继续验。 |
| F6 | 物化键条件可能由自身HP比例反馈振荡，attack事实也无稳定消费语义。 | validateStatRows 在安装/发布前拒绝任何物化键 conditions 属性，包括空数组和 self-status；不是只拒绝HP条件。 | 五个物化键分别拒绝HP比例/self-status/attack-kind/空条件。 |
| F7 | 扣光当前HP的 other 调用以前也吃抗性，自爆可残血存活。 | 增加显式 drainCurrentHp（other 原因、忽略抗性），7处生产行政/自毁调用改用它。普通 other 伤害即使金额恰好等于当前HP也继续吃抗性，避免按金额猜意图。 | other75%抵抗下8伤害只扣2、普通8HP/8伤害留下6，显式drain归零；kamikaze有抗性仍死亡且不直接伤害目标。 |
| F8 | CE resolver 的 BE_ATTACK/bolt/非武器命中吃修正，伤害漏成对池；偷窃第二次概率两条路径不一致。 | 统一 attack 交付的命中与physical-damage双边求值，这些交付采用 melee 属性事实域，保留原费用/poise/防御时序域。毒接触仍保留原毒时长骰，只修正替代的物理1HP；BE_DAMAGE独立。偷窃两路径都用 nativeHitChance。 | melee/bolt/nonweapon各验证preview和实际概率60、双方25%同池伤害4→6；三类零修正逐值/HP/完整RNG状态等价；两条偷窃路径均两次60概率。 |
| F9 | defense 的原生标度与词缀“局部”含义容易混淆。 | 手册明确 defense 为十分之一显示防御点，plated显示+1…+11须换算flat+10…+110；reinforced increased作用整个 defense（含附魔/力量差/穿戴惩罚）。keen是全局physical池，brutal为装备武器玩家路径的端点flat；没有悄增armor-base节点。 | 配置手册 §原生键/DAG/未来来源声明说明；保留原生防御影子与成对公式回归。 |

原始修前与修后探针均在 `/private/tmp/p5rev/`。另用scalar-probes.mjs在审查前副本（只含另任务的调度器候选；本探针不调用调度器）与最终树分别复核F4/F5/F6/F7/F8：负more100→75、mending输入缺席→声明及DAG、条件物化接纳→拒绝、other75%抗性下行政扣光残15→0、非武器preview50/实际骰60/伤害4→统一60/60/6、真实bolt因果scope伤害4→6。bolt回归使用生产的causality.withOrigin；delivery字段只分类stamina门，不能单靠它声称进入bolt resolver。stale.mjs 故意直接改字段、绕开生产写入口，是陈旧窗口诊断，不能把它说成“裸写已经自动失效”；最终保证由两条真实酸腐蚀路径与标脏回归验收。

### 全仓原生写入点审计

AST扫描全部339个生产TS（不含test/tests/testing）和39个Vue脚本，先检查直接赋值/复合赋值/自增，再补动态字段、解构赋值、delete、Object.assign/defineProperty/defineProperties 与 Reflect.set/deleteProperty；扩大到装备来源DTO能读取的identity/runic识别等属性。初查306处、补查共483个候选，分布52文件；Vue相关写入0。全部候选逐项读上下文，下面列出每文件候选数、完整作用域集合及处理依据。候选数包含初始化、纯DTO、rollback和数组等误命中，不能当作483处活装备写入。扫描脚本与逐行行号/片段保留 `/private/tmp/p5rev/write-audit{,-complete,-vue}.mjs/.json`，仓库不提交原始探针。

装备实际写入口明细：Monster.resolveGeometryAttackAt/takeNativeDecisionWithinAction 两处 armor.enchantment−1 新增 player 标脏；Game.applyChosenEnchantmentGain调用侧、negationBlastFromPlayer（附魔、识别、符文移除）、resolvePlayerMeleeAttackAt（武器腐蚀）、tryTriggerArmorRunic（负重strengthRequired）已具备mark；本轮补充 Commutation.swapItemToEnchantLevel、ArcanaEnchantment.enchantArcana、ItemUseCoordinator.applyChosenEnchantmentGain/checkpointEnchantmentGain.restore、ItemLoader四类鉴定、Inventory.add/remove/叠堆、WorldItems.assembleWorldItem、WorldWork.completeBatch耐久。Game.quaffItem的动态native永久grant字段写入后立即markStatsDirty（已知堆叠力量药水不会靠移除根或知识回调偶然失效）；Game内28处 runicKnown=true 写入也补 Item 回调，包括未绑定新局/测试房初始化（空回调）、反射/强化发现、武器/护甲符文、爆炸免疫和呼吸护甲识别；允许来源使用 runic.identified 后这一类不再只是显示知识。runicKnown=false 的否定/互换路径在同事务结束统一标脏。新对象工厂、快照decode及hypothetical副本不绑定，保持纯预览；rollback 清缓存并恢复资源/账本。

原生actor机械写入同时核对：新增 summoner还原、mutation最终发布、moveSpeed setter、状态衰减时转盟友、MonsterAI两处转盟友、Game.becomeSingleAllyWith、身体转变 survivor 发布前的脏入口。既有伤害/治疗、状态起止/虚弱/速度刷新、装备原子提交、原生最大值重置、光照/休息及模块state/component写入口保留。字段初始化/序列化/事务副本不是规则消费点，不把query修正值回写到原生基础。

| 文件 | 候选数 | 全部候选所在作用域 | 处理/排除依据 |
| --- | ---: | --- | --- |
| `src/entities/Creature.ts` | 23 | refreshSpeeds、constructor、setStatusDuration、applyStatus、weaken、heal、addPoison、restoreShield、absorbShieldDamage、tickStatuses、takeDamageCommitted、die | 状态、速度、虚弱、heal/takeDamage 的显式脏入口；构造未绑定；shield 临时恢复按事实/所属伤害事务失效。 |
| `src/entities/Player.ts` | 20 | constructor、tickTemporaryImmunities、grantTemporaryImmunity、mutateEquipment、equipCommitted、unequipCommitted、recoverPerTurn、updateNutrition | 装备原子事务校验/重算；回血末尾标脏；营养 HP 写入随伤害/回合边界；rollback 清会话。 |
| `src/entities/Monster.ts` | 66 | restoreSummonerForm、constructor、copyNativeValue、clearBodyPlanStatuses、copyForClone、copyPlayerForClone、empower、polymorph、tickStatuses、top-level、mutate、resolveGeometryAttackAt、recoverPerTick、allocateForSnapshot、takeNativeDecisionWithinAction、takeSquareMovementTurn | 酸腐蚀两处新增标脏；restoreSummonerForm/mutate/moveSpeed/盟友关系新增标脏；empower/polymorph 经既有状态/最大值重置入口；副本、构造、allocateForSnapshot 尚未绑定。 |
| `src/engine/Stats/NativeStatSources.ts` | 1 | projectItem | projectItem 为 detached hypothetical Object.assign，保持 live 实体、revision 与账本不变。 |
| `src/engine/Systems/EventBus.ts` | 2 | on、off | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Items/WorldItems.ts` | 11 | assembleWorldItem | 原生武器 damage/strengthRequired 与护甲 armor/strengthRequired 完成后经 Item 脏回调；新建 Item 未绑定时回调为空。 |
| `src/engine/Items/ItemSpawnHeatMap.ts` | 2 | coolHeatMapAt | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Items/ArcanaEnchantment.ts` | 1 | enchantArcana | enchantArcana 的 Object.assign 后新增 Item 脏回调；gain 草案是纯数据。 |
| `src/engine/Items/Commutation.ts` | 5 | swapItemToEnchantLevel | swapItemToEnchantLevel 完成附魔/识别/符文旗标写入后新增 Item 脏回调。 |
| `src/engine/Items/ItemUseCoordinator.ts` | 9 | applyChosenEnchantmentGain、checkpointEnchantmentGain、invokeCharm、prepareThrownItem | 实际附魔 gain 与 checkpoint restore 新增 Item 脏回调；既有 finish 标记 player；charm 状态经 applyStatus；throw clone 是新对象。 |
| `src/engine/Items/ItemLoader.ts` | 56 | identifyItemKind、identifyInstance、decrementWeaponAutoIDTimer、decrementWornFamiliarity、spawnPotion、spawnScroll、spawnFood、spawnWeapon、spawnArmor、spawnWand、spawnStaff、spawnRing、spawnCharm、spawnKey、spawnGold、spawnGem、spawnAmulet | identifyItemKind/identifyInstance/两类自动鉴定新增 Item 脏回调；spawn* 的其余字段写入为未绑定新实体初始化。 |
| `src/engine/Items/Inventory.ts` | 4 | addItem | 叠堆合并附魔/力量需求/识别属性，以及加入/移除均通过 Inventory 脏回调；装备所有权仍只认 inventory 根。 |
| `src/engine/Lighting/LightMap.ts` | 10 | initCells、clearLighting、paintLight | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Environment/Gas.ts` | 2 | constructor | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Movement/CreatureSpatial.ts` | 5 | clearMovementRegion、setSpatial | fixture region/目录绑定与空间转换；live 身体转变在 Game survivor 发布前新增标脏；x/y/tags 属冻结事实。 |
| `src/engine/Map/DungeonFeature.ts` | 1 | evacuateCreatures | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Map/PathFrontier.ts` | 3 | pop、swap | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Map/Scent.ts` | 2 | set、resetTurnNumber | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Map/WaypointMap.ts` | 2 | setUpWaypointsInner、refreshWaypoint | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Map/Pathfinding.ts` | 1 | constructor | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Generator/Architect.ts` | 1 | designRandomRoom | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Random.ts` | 1 | setState | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Combat/BodyCombat.ts` | 2 | withZoneProtection | withZoneProtection 的 shield 临时恢复，所属原生伤害事务标脏；不发布装备来源。 |
| `src/engine/Combat/Combat.ts` | 2 | transferMonsterHealth | transference 经原生 heal，衔接伤害事务；扣光 HP 的入口见 F7。 |
| `src/engine/Combat/BodyMemberHealth.ts` | 6 | resolveBodyMemberHit、apply、rollback | body HP 的 apply/rollback 所属原生伤害/部位事务清缓存，数值事实也含 HP/maxHP；无装备字段写入。 |
| `src/engine/Combat/MonsterBlink.ts` | 2 | buildBlinkAllySafetyMap | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Combat/FixedZoneHealth.ts` | 6 | resolveFixedZoneContact、apply、rollback | zone/group 的 HP 同步及 rollback 由伤害/部位事务管理；不写装备字段。 |
| `src/engine/Combat/MonsterAI.ts` | 2 | updateMonsterState | 两条 live isAlly 写入新增 markStatsDirty。 |
| `src/engine/Combat/MonsterTheft.ts` | 2 | stealFromPlayer | 保留 detached stolen Item 副本和玩家回避旗标；移除装备经 Player/Inventory 入口。 |
| `src/engine/Core/WorldDefinitions.ts` | 1 | validateWorldModule | worldDefinitions 纯声明冻结描述符，不是实体机械字段。 |
| `src/engine/Core/ActorActionAuthority.ts` | 1 | commitActorAction | 资源提案 authority 的 rollback Object.assign，不涉及原生装备。 |
| `src/engine/Core/WorldWork.ts` | 5 | afterEscrow、commitWorldWork、startWorldWorkBatch、completeBatch | completeBatch 的耐久减量后新增 Inventory 脏回调；其它候选是 detached escrow 克隆、节点 DTO 与不经过属性键的劳作事实。 |
| `src/engine/Core/WorldMaterialTransfer.ts` | 2 | planMaterialTransfer、commitMaterialTransfer | 分拆的 preview/new Item 无绑定，live pack 移入移出经 Inventory/命令事务。 |
| `src/engine/Core/Game.ts` | 138 | checkpointCombatFactWorld、createExtensionRuntime、startNewGame、registerWorldSettlementFixture、spawnHordeAt、summonMinionsFor、generateTestDepth、hintRunicEquipment、updateRecordedCheckpoint、withReplayCandidate、equipItem、unequipItem、dropItem、quaffItem、applyBoltResult、observeBoltReflection、polymorphBoltTarget、prepareAndCommitBodyTransition、tryActiveBodyTransition、commitBodyTransition、conjureBladesAt、summonCharmGuardian、applyBoltEffectAt、chooseEnchantTarget、negateCreatureMagic、negationBlastFromPlayer、throwItemAtStages、applyWeaponRunicEffect、tryTriggerArmorRunic、resolvePlayerMeleeAttackAt、trySplitMonster、commitWholeBodyFall、retrySquareLandings、killMonster、sweepDeepWaterItem、loadSnapshot、resolveExplosionDamageAt、applyNauseaFromTerrain、applyEnvironmentalEffects、applyBodyMemberDamage、retireBodyEntities、createCompositeMonster、createModuleMonster、createSquareMonster、aggravateMonsters、becomeSingleAllyWith、markPackFull | 实时机械/识别写入见下方明细；新实体/规划候选/DTO 不绑定；rollback 恢复描述符并清扩展会话；load 重建绑定和完整准入。 |
| `src/engine/Core/WorldRestProduction.ts` | 2 | settleWorldRestCommitted | 恢复 HP 经 rest 提交与回合标脏；其它 Object.assign 为纯 effect 数据。 |
| `src/engine/Core/LevelSnapshot.ts` | 1 | restoreGrid | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/engine/Core/TimeCoordinator.ts` | 1 | finishTurnEpilogue | 客观块 heal/tickStatuses 脏入口；候选 Object.assign 为纯 observer payload。 |
| `src/engine/Core/EntitySnapshot.ts` | 4 | serializeItem、deserializeItem、restoreEntityGraph | 纯序列化与新建实体反序列化，尚未绑定，load 后统一验证；不在活装备上改写。 |
| `src/engine/Core/WorldSettlement.ts` | 4 | jsonCheckpoint、commitOfflineSettlement | offline 输入是克隆实体；checkpoint restore 属结算事务的 rollback/清会话。 |
| `src/engine/Core/GenerationCoordinator.ts` | 10 | checkpointGenerationWorld、createMachineRuntime、populateLevel | 新生成实体未绑定；checkpoint 恢复整个事务并清会话；借用 Item 的位置/机器旗标非缓存属性字段。 |
| `src/engine/Core/WorldWorkWorld.ts` | 4 | previewItem、additionalItemSlots | previewItem/额外槽位计算只用 detached Item，不修改已绑定装备。 |
| `src/engine/Core/PhasedAttackProduction.ts` | 5 | pay、advanceResources、commit、commitBody | actor 资源/调度状态数据与 rollback，不改原生装备数值；资源准入仍读取容量账本。 |
| `src/engine/Core/WholeRunSnapshot.ts` | 5 | decodePlayer | decodePlayer 在新实体上还原原生字段及装备引用；后续 attach/账本完整准入。 |
| `src/engine/Core/MonsterLifecycle.ts` | 2 | set、deleteProperty | 死亡/出生观测代理的 Reflect.set/deleteProperty，不是新增装备写入口；实体快照事实触发原生生命周期处理。 |
| `src/i18n.ts` | 1 | top-level | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/ui/presentationTimeline.ts` | 1 | checkpoint | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/ui/frameProfile.ts` | 1 | record | 数组/地形/随机流/灯光/显示 DTO 等候选误命中，无活装备属性写入；环境结果经既有光照或 actor 事实失效入口。 |
| `src/ext/actorActionIdentity.ts` | 1 | restore | 递归恢复 actorActions 对象图，不是原生装备；外层 rollback 清属性会话。 |
| `src/ext/causality.ts` | 10 | terminal、clearTerminal、statusChanged、clearStatus、markDisplacement、consumeDisplacement、clearCreature | 伤害/状态因果字典数据，不是原生机械字段。 |
| `src/ext/runtime.ts` | 27 | prepareWorld5Settlement、constructor、reconcileMaterialized、commitResources、commitCharacterResources、commitPartBreakWithin、restoreResources、checkpointActorStateIdentity、commitItemGrowth、invoke、attachCreature、captureDeath、collectComponents、checkpointActorActionBindingIdentity | 物化唯一写回、资源提案/原生永久 grant 显式清缓存/准入/重算；restore/身份 rollback 清会话；组件 GC 同时删除账本与缓存；DTO/死亡快照为纯数据。 |
| `src/ext/modules/growth/module.ts` | 5 | initialize、planAward | 成长草案及经验候选数据；实际变化通过 setComponent 与显式 commitResources，不直接写活原生装备。 |
| `src/ext/modules/combat/ui/diagnostics.ts` | 2 | placeCombatTelegraphFixture | 受控测试 fixture 初始化，与交互命令边界之后的 observer 同步；无生产装备写入。 |

### 惰性重算、准入缓存与性能复验

markStatsDirty 只递增会话revision并置脏，不同步collect或reconcile；同actor多次写入在下一次value/rational/breakdown/applied/成对读取合并重算，hypothetical不发布物化。装备和模块来源事务仍先验证完整原始/激活来源、预算、DAG输出和安全分数，再发布物化字段，不能把惰性化理解为“允许坏来源先落状态”。物化签名限于物化键/依赖/L0；完整准入成功记录以原始/激活行、原生公式输入（类型+字符串编码保留NaN/undefined区别）、combat profile为签名且有128actor上限，机械输入或条件激活变化重新校验。相同JSON的state/component重复写入、删除缺席组件不冲掉来源缓存；实际变化照常失效。调试新算比对、load/seek/rollback/GC与摘要脏合同不变。

性能整改中先发现“每次dirty改成全DAG准入”会更慢；最终用相关物化签名、成功准入记忆与无变化state写入短路消除重复预检。新用例验证20次mark不收集、首次读仅收集一次、下一次命中不重复；并证明条件激活/NaN输入仍重新拒绝和无变化写入不收集。不会引用较快但漏计准入的计时。最终八入口计时器仍在module façade绑定前安装，仅累加外层调用，同原报告口径。

最终独立复测命令 `node /private/tmp/p5rev/perf-review.mjs`，exit0、wall 85.58s；所有tests/build结束后运行，无并发测试。Apple M5/10核/32GiB/arm64，Node24.19.0、3GiB堆。1017文件源码测前/测后与封存 `34cd3a6155bce7d8f402209eb057763553fc86d91399c6df524780dd2b617c11` 相同；5A2只读对照仍为2d870a2/922ca79ebe6892955a9922777df1a43f9d886b2f37b34cb430b7b1091e516ae1。采样/预热/配对方法沿§6：2049实际命令，普通2009成对样本；8个full checkpoint单列，D1/D8各实际完成2049批，D8访问8层（缓存7层）。

| 场景 | baseline median/P95 ms | current median/P95 ms | 配对新增 median/P95 ms | 新增P95阈值 |
| --- | --- | --- | --- | --- |
| classic | 0.030042 / 0.034667 | 0.030083 / 0.035500 | 0.000042 / 0.002542 | 1 ms，pass |
| ext-zero | 0.058333 / 0.066625 | 0.058875 / 0.073333 | 0.000500 / 0.007708 | 5 ms，pass |
| craft-D1 | 6.357208 / 6.853042 | 7.127833 / 7.685041 | 0.774792 / 1.359666 | 10 ms，pass |
| craft-D8 | 6.232833 / 6.760667 | 7.004625 / 7.589250 | 0.791125 / 1.348959 | 10 ms，pass |

| full checkpoint（每组n=8） | current median ms | current P95 ms |
| --- | ---: | ---: |
| classic | 68.377875 | 139.846625 |
| ext-zero | 71.175875 | 143.446542 |
| craft-D1 | 86.961708 | 170.850792 |
| craft-D8 | 567.882875 | 1160.529000 |

| 四生产模块普通非debug查询（各10000，预热200） | median ms | P95 ms | 阈值 |
| --- | ---: | ---: | --- |
| hit | 0.001208 | 0.001417 | 0.01ms，pass |
| miss | 0.058583 | 0.066333 | 0.1ms，pass |

| 普通战斗属性管线（同24个已完成回合） | 审查前 ms | 审查后 ms | 下降 |
| --- | ---: | ---: | ---: |
| 累计 | 668.780821 | 203.480648 | 69.57% |
| 每回合 median | 27.594241 | 7.685584 | 72.15% |
| 每回合 P95 | 40.118742 | 11.543629 | 71.23% |

八入口外层调用11988→6302；真实玩家攻击2次、正伤害2次、physical pair 3次；max 24.492674ms。六个阈值全部通过。这里测的是属性管线/来源签名/预检成本，不是整个游戏回合wall；仍只取既有调度器第27条命令故障之前的24个完整回合，未改调度器也不声称完整战斗结束。首次审查封存cfa20639测得199.885005ms/median7.459839/P9510.675288，仅为中间结果；本节最终结果包含后补的识别/药水写入口，不能混用不同hash数字。

全部原始成对样本、JSON和日志保留 `/private/tmp/p5rev/perf-*.json`、`perf-review.json`、`perf-gate.log/json`；原始大文件在仓库外。

### 本轮门禁、失败处理与交付检查

新增 `ext_stats_review` 29项，growth属性自有测试新增1项，根套件登记未遗漏。相关范围为原§5底座112文件加审查回归、酸腐蚀/互换/识别/行政死亡/生命周期/生成事务直接受影响的7文件，共119；新增文件为 `src/test/b_1a_identification.test.ts`、`src/test/ext_generation_transactions.test.ts`、`src/test/ext_stats_review.test.ts`、`src/test/i_1_interaction.test.ts`、`src/test/p4_4_split_kamikaze.test.ts`、`src/test/u_16_lifecycle.test.ts`、`src/test/u_17e_altars.test.ts`；growth/combat/giants自有88文件继续验证。全部Vitest限制maxWorkers=2，Node24.19.0放PATH首位，NODE_OPTIONS=--max-old-space-size=3072；CE只使用已有参考目录，按开发期政策不跑全量/removal/drift/gen档。

旧前提处理均先做单变量反事实：

1. `ext_stats_runtime` inventory根用例原来在mark后立即断言物化字段；只回退runtime.ts（其它修复不动）恢复原用例前提，1/1通过。正式测试只在mark与原数值断言之间加native.max-hp读取边界，断言和值不改；惰性化本身另有明确零收集回归。
2. `ext_combat_neutral_differential` 的 aquatic non-weapon preview 原来断言扩展pair调用为空；只回退Combat.ts、保留全部其它生产文件，旧前提1/1通过。F8已明确让扩展非武器预览参与管线，故保留其空调用/37概率/100桶精确支持/HP与RNG断言，把该旧空调用前提限定为classic预览，扩展空来源及有来源三类交付由新review回归覆盖。未改概率、随机消耗、伤害或世界语义断言。两个反事实filter产生的skip仅为未选用例，不计正式门禁skip。

新符文识别测试初次错误地把“无符文但runicKnown=true”的起始装备计为提供修正；只改来源fixture为kind非null且已识别，保留下一读defense+10断言，29/29最终复验通过。酸腐蚀fixture早期缺角色初始化和存档引用刷新已按真实Game前提补齐，原defense−10/存读档断言保留。新增药水回归的可空工厂结果与私有turn回调类型声明经vue-tsc指出，补合法非空/测试接口类型后复验；不改生产行为或数值断言。相关底座首次整批的非武器旧前提及加载旧Game导致两条符文回归失败如实登记，最终引用修正后的受影响文件复跑，不把首轮exit1写成通过。

| 验证 | 本轮结果 | exit / wall | 原始证据 |
| --- | --- | --- | --- |
| 相关底座整批，119文件 | 首轮117文件通过、2文件的3项失败；2929通过、8既有skip、4既有todo | 1 / 1340.46s，失败已逐项修复/复跑 | root-gate.log/json、root-test-files.txt |
| 两个受影响文件最终复跑 | neutral173 + review29 = 202通过；所有首轮失败消除 | 0 / Vitest56.93s | related-repair-final.log |
| 最终封存审查回归再验 | 29通过（含真实bolt scope与已知堆叠力量药水即时读取） | 0 / Vitest6.66s | stats-sealed-final.log |
| 相关底座按文件最终结果合并 | 119文件，2933通过、8既有skip、4既有todo；2731未变通过项+202最终复跑项，不重复计数 | 首轮与受影响复跑合并验收，未声称首轮exit0 | 上三行 |
| growth/combat/giants自有 | 88文件、1483通过（含真实growth永久恢复/换装回归） | 0 / 1306.47s | modules-gate.log/json |
| boundary / check:modules | pass | 0 / 1.80s | boundary-gate.log/json |
| build（vue-tsc -b + Vite） | pass | 0 / 10.26s | build-gate.log/json |
| vue-tsc -b | pass | 0 / 7.85s | types-gate.log/json |
| 八组合真实Game smoke | 全8组合实际正伤害、成长组合自然升级/分配、save/load/replay/seek/续录闭环通过 | 0 / 106.54s | smoke-gate.log/json、smoke-review.json |
| C5真实骨架与5A2逐叶对照 | 10阶段全部native/world5/actorActions/knowledge/random叶等价；仅foundation身份2叶与root codec identity变化 | 0 / 30.08s | c5-gate.log/json、c5-review-differential.json |

底座+模块按最终文件结果合计207文件、4416通过、8既有skip、4既有todo；没有新增skip/todo，未运行非相关全量档。


源码封存为src/scripts/public共1017文件 `34cd3a6155bce7d8f402209eb057763553fc86d91399c6df524780dd2b617c11`；报告/手册/README不在该hash输入。F3补充符文识别入口之前的首次审查计时封存cfa20639仅为中间证据，最终性能与检查须以本段hash一致为准。冻结4SHA仍按§1核对，HEAD不变、没有commit/push、没有依赖或锁文件变化、没有新>1MB原始证据入仓。ActorActionScheduler.ts逐字等于HEAD；PhasedAttackProduction的bind严格准入保持原合同，本轮没有改变调度候选态或同tick决策顺序。第27条命令既有调度器故障保留给独立任务，24回合性能前缀不宣称整场战斗已结束。

## 附录：首次封板相关底座文件（本轮新增范围见 §8）

```text
src/engine/Combat/CombatFormulas.test.ts
src/test/ai_1_scent_tracking.test.ts
src/test/armor_display_effect.test.ts
src/test/armor_model_effect.test.ts
src/test/armor_runic_effect.test.ts
src/test/b_1_weapon_specials.test.ts
src/test/dialog_d4_blink.test.ts
src/test/ext_combat_adapter_foundation.test.ts
src/test/ext_combat_neutral_differential.test.ts
src/test/ext_combat_transition_facts.test.ts
src/test/ext_compatibility_diagnostics.test.ts
src/test/ext_controlled_action_bridge.test.ts
src/test/ext_engine_policies.test.ts
src/test/ext_foundation.test.ts
src/test/ext_foundation_contracts.test.ts
src/test/ext_module_composition.test.ts
src/test/ext_recording_v4_digest.test.ts
src/test/ext_recording_v4_snapshots.test.ts
src/test/ext_recording_v4_storage.test.ts
src/test/ext_slaying_alignment.test.ts
src/test/ext_stats_native.test.ts
src/test/ext_stats_pipeline.test.ts
src/test/ext_stats_runtime.test.ts
src/test/ext_world_harness_closed_loop.test.ts
src/test/ext_world_harness_combinations.test.ts
src/test/ext_world_work_boundaries.test.ts
src/test/ext_world_work_failures.test.ts
src/test/ext_world_work_review.test.ts
src/test/ext_world_work_sdk_contract.test.ts
src/test/ext_world_work_transactions.test.ts
src/test/g_2_gas_df_wiring.test.ts
src/test/gameplay_layout.test.ts
src/test/hunger_regen.test.ts
src/test/monster_damage_balance.test.ts
src/test/monster_stats_effect.test.ts
src/test/p1_30_i18n_gate.test.ts
src/test/p1_31_35_placement_snapshot.test.ts
src/test/p1_42_secret_door_search.test.ts
src/test/p2_1_tick_architecture.test.ts
src/test/p2_2_real_speed.test.ts
src/test/p2_3_objective_time.test.ts
src/test/p2_4_animation_cadence.test.ts
src/test/p4_10_waypoint.test.ts
src/test/p4_1b_monster_casting.test.ts
src/test/p4_7_player_weapon_geometry.test.ts
src/test/p4_8_scent_map.test.ts
src/test/p4_9_safety_map.test.ts
src/test/phase3a0_defense.test.ts
src/test/phase3a0_native_prelude.test.ts
src/test/phase3a0_scheduler.test.ts
src/test/phase3b_body_action_resolution.test.ts
src/test/phase4a1_game_square.test.ts
src/test/phase4a2_body_combat.test.ts
src/test/phase4a2_body_effects.test.ts
src/test/phase4a4_generation_contributions.test.ts
src/test/phase4b_game_rigid.test.ts
src/test/phase4b_pose_pathing.test.ts
src/test/phase4b_rigid_rotation.test.ts
src/test/phase4d_body_status.test.ts
src/test/phase4d_composite_movement.test.ts
src/test/phase4d_group_sidebar.test.ts
src/test/phase4d_production_body.test.ts
src/test/phase4d_travel_ai.test.ts
src/test/phase4e_body_transition.test.ts
src/test/repo_hygiene.test.ts
src/test/search_progress_hud.test.ts
src/test/slaying_melee_autohit.test.ts
src/test/test_suite_membership.test.ts
src/test/u21c_flare_sidebar.test.ts
src/test/u24_hardcoded_text.test.ts
src/test/u_01_instance_snapshot.test.ts
src/test/u_02a_rng_snapshot.test.ts
src/test/u_03_whole_run_snapshot.test.ts
src/test/u_03b_level_travel.test.ts
src/test/u_06_monster_damage.test.ts
src/test/u_07_monster_blink.test.ts
src/test/u_09_learning_consumers.test.ts
src/test/u_10_absorption_snapshot.test.ts
src/test/u_11_corpse_learning.test.ts
src/test/u_13_combat_math.test.ts
src/test/u_14a_status_gaps.test.ts
src/test/u_14b_status_gaps.test.ts
src/test/u_15a_shattering.test.ts
src/test/u_15b2_ring_birth.test.ts
src/test/u_15b_rings.test.ts
src/test/u_15d2_armor_runic.test.ts
src/test/u_15d_weapon_runic.test.ts
src/test/u_17f_carriers.test.ts
src/test/u_r2_trace.test.ts
src/test/u_r3_trace.test.ts
src/test/u_r4_trace.test.ts
src/test/ui_1_rendering.test.ts
src/test/w_12_blink_beckoning.test.ts
src/test/w_16_conjuration.test.ts
src/test/w_18_entrancement.test.ts
src/test/w_19_polymorph.test.ts
src/test/w_20_cloning.test.ts
src/test/w_21_empowerment.test.ts
src/test/w_23_negation.test.ts
src/test/w_2_arcana_submission.test.ts
src/test/w_8_staff_damage.test.ts
src/test/w_9_directed_status.test.ts
src/test/x2c_hit_status_owner.test.ts
src/test/x3_u2_ally_captive.test.ts
src/test/x3_u3_cursed_equipment.test.ts
src/test/x3_u7_sidebar.test.ts
src/test/x3_u8a_forced_turns.test.ts
src/test/x3_u8b_items.test.ts
src/test/x3_u8c_combat_items.test.ts
src/test/x3b_item_details.test.ts
src/test/x4_r4_item_details.test.ts
src/test/x4a_movement_rendering.test.ts
```
