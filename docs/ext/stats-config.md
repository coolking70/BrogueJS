# Foundation 属性配置（5A2-S）

统一入口为 `src/ext/stats.ts`。生产查询、原生 CE 表节点、growth 来源与 combat 模板共同经过 `StatPipeline`；内容模块不导入引擎、其它模块实现或旧规则端口。foundation 8，growth module/rules 1.8.0，combat module/rules 1.6.0、state 4；旧版本拒载，不迁移。whole-run 仍为 5、录像仍为 4；录像头的 codec.foundation 与摘要版本身份为 8。

## 数值、层与类别

普通来源 `value` 必须为安全整数。基点 10000 表示 100%。所有中间加法、乘法和分母使用 BigInt；最终先钳制，再按键声明舍入一次：`floor`、`ceil`、`nearest-half-away`（负数半整数也远离零）。

求值顺序为：最高优先级 override → flat 总和 → increased 单池 → 有名 more 槽按声明次序各乘一次 → clamp 交集 → 最终舍入。公式为 `(base + flat) × (1 + increased/10000) × ∏(1 + moreSlot/10000)`。同槽合并增量，不重复乘每一行；多 override 没有不同的显式 priority 时拒绝。层顺序固定为 base / intrinsic / equipment / character / temporary / environment，同层按 owner、sourceId、sourceKind 码点排序。

increased 池为 −9000…50000 bp；普通 more 槽为 0…40000 bp；attack-speed/move-speed 的所有槽允许 −5000 bp（包括 growth 槽），loot swift 的 −5…−25% 和 wanderer 的 −10% 直接可表达。其它键的 growth 既有 `growth.slot.final` 为 −10000…30000 bp，保留旧配置的 0…4 倍范围。growth 的 additive budget 先按 owner/category/上下限形成子池，钳制后进入公共池；不占用其它模块的预算。兼容字段 `legacyFactor` 仅限 growth 的 more 来源，把既有定义的十进制因子作为精确分数计算（包括不足一个基点的因子），其它模块必须使用整数 bp。该字段不是新的浮点求值器。clamp 只能收紧硬限，空交集拒绝。

命中成对求值合并攻击方 `native.hit-chance` 与防守方 `native.evasion`；物理伤害合并 dealt/taken。双方 increased 只乘一次。必中、必失、免疫及跳过概率骰的分支由战斗消费边界处理。完全无修正的成对求值返回 CE 原值，保留原生 0/99/100 命中边界；有修正时执行键的硬限。

查询 facts 中的 baseValue 只覆盖正在查询的键；context.base(otherKey) 仍返回其它键自己的 L0，不能把零冷却当成零容量。combat 结算逐键提供当前模板的 L0；已接受动作继续使用其冻结模板，切换模板后标脏。

普通潜行的原生 clamp 来源把下限收紧为 2，原生休息/隐形状态允许 1；该来源也计入预算。

每 actor ≤256 行（包括原生来源），每 actor 的每键 ≤64 个不同 `(owner, sourceKind, sourceId)`，每模块 ≤128 键。成对求值先分别校验双方预算，再合并池；双方各64来源仍合法，合并后的 override 冲突继续拒绝。等于上限合法，超限在来源提交前拒绝。行须为严格 JSON，同步、纯；Promise、getter、循环、非安全整数、未知字段、未声明的槽及异常均失败，不降级为缺席。模块键须有自己的 `<moduleId>.` 前缀；模块不能给固定 DAG 添加边。

条件仅支持 melee/thrown、目标公开 `body.*`/MonsterClass 标签、自身状态、相邻、HP 比例阈值（bp）。物化键在安装/事务准入时拒绝任何 conditions 字段（包括自身状态及空数组），避免 HP 比例振荡或交付事实缺失。事实和自己的组件/state 均冻结；没有 RNG、消息或可写世界能力。

## 键表

表中普通整数键的最终舍入均为 floor；冷却为 ceil。原生 CE 的力量差、伤害表、护甲、弱化、戒指、状态的既有取整属于原生公式节点，保留其边界。

| 键 | 单位 | 下限 | 上限 | 类型 |
| --- | --- | ---: | ---: | --- |
| native.regeneration | 精确 HP/turn 分数 | 0 | 1000000 | rational query |
| native.regeneration-bonus | 原生戒指附魔单位 | −1000000 | 1000000 | query |
| native.weapon-enchant / armor-enchant | 四分之一附魔点 | −800 | 2000 | query |
| native.accuracy | accuracy | 0 | 1000000 | query |
| native.hit-chance | bp | 500 | 9500 | pair query |
| native.defense | 十分之一防御点 | 0 | 1000000 | query |
| native.evasion | bp | 0 | 10000 | pair query |
| native.damage-min / damage-max | HP | 0 | 1000000 | query |
| native.physical-damage-dealt / physical-damage-taken | HP | 0 | 1000000 | pair query |
| native.strength | strength | 1 | MAX_SAFE_INTEGER | materialized |
| native.effective-strength | strength | −1000000 | 1000000 | query |
| native.max-hp | HP | 1 | MAX_SAFE_INTEGER | materialized |
| native.stealth-range | tile | 普通 2、原生休息/隐形 1 | 1000000 | query |
| native.search-strength | search strength | 0 | 1000000 | query |
| native.awareness | search strength | −1000000 | 1000000 | query |
| native.clairvoyance / light / reaping / transference / wisdom | 原生戒指单位 | −1000000 | 1000000 | query |
| native.attack-speed | tick | 有模块行时 25 | 有模块行时 max(400, 原生值) | query |
| native.move-speed | tick | 1 | 1000000 | query |
| native.runic-power / armor-runic-power | 四分之一附魔点 | −800 | 2000 | query |
| native.resist.physical / fire / poison / other | bp | 0 | 7500 | query |
| combat.stamina-capacity / poise-capacity | resource | 1 | 1000000 | materialized |
| combat.stamina-regen / poise-recovery / native-attack-cost | 模板分子/费用 | 0 | 1000000 | query |
| growth.focus-capacity | focus | 0 | 1000000 | materialized |
| growth.focus-recovery-interval | tick | 0 | 1000000 | query |
| growth.cooldown-duration | tick，ceil | 0 | 1000000 | query |
| growth.xp-gain | XP | 0 | MAX_SAFE_INTEGER | query |

原生键没有对该键生效的模块来源行时返回原生求值，不套用表中硬限；原生显式 clamp 来源仍有效。有模块来源时才用硬限。attack-speed 上限例外取 max(400, 原生值)，原生值包含减速和变异，故被减速的箭塔/图腾不会被截到 400。其余硬限为 foundation 数据表。通用 query 上限 1000000 覆盖原生值至少十倍；附魔/符文为原 CE 上限十倍。HP/力量及 XP 使用安全整数最大值，保留既有合法成长配置与溢出守卫。示例指定的命中/攻速/抗性例外按任务 S11 固定。本轮 F1/F4/F5 维护者裁定属于尚未合入的同一 5A2-S 批次，foundation 仍为 8；之后修改硬限或固定 DAG 必须升 foundation 版本。

DAG 固定：regeneration-bonus → regeneration；strength → effective-strength → weapon/armor-enchant；weapon-enchant → accuracy、damage-min/max、runic-power；armor-enchant → defense、armor-runic-power。

### 回血的维护者裁定

`native.regeneration` 在求值账本内为约分后的 `{numerator, denominator}`，分子分母均为安全整数，分母为正；不把该 query 键写入持久物化账本。只在玩家/怪物的回血消费边界转为 `number`。UI 比较速率直接交叉相乘，不把分数先转小数。整数键调用 `value`，回血调用 `rational`；误用 `value` 读取回血会拒绝。

S18 零修正逐值等价按精确分数语义验收，原生 POW_REGEN 表及怪物间隔保持原算法。无法约分到安全整数的来源组合在提交前拒绝，不近似、不静默丢行。怪物保留原生计数器的零修正时序；非零来源可在一次消费中回复多个 HP。

`native.regeneration-bonus` 是玩家原生戒指总加值的整数输入。loot v1.1 的 mending（+1…+5 戒指单位）应声明该键的 flat 行；`native.regeneration` 的 flat 是整数 HP/turn，不能把戒指单位直接写到速率上。该输入通过原生 `turnsForFullRegenInThousandths` 表和既有 HP/间隔取整计算精确分数；怪物无装备时保留原生 regenTurns 节点。

`native.defense` 的 10 单位等于显示护甲 1 点：玩家节点为 `max(0,trunc((armor + 净附魔 − donning) × 10))`，净附魔含力量差。loot plated 的显示 +1…+11 必须写 flat +10…+110。reinforced 的 increased 作用于整个 defense，包括基础护甲、附魔/力量差和穿戴惩罚，不是物品的局部护甲百分比；本批没有 native.armor-base 输入节点。keen 的 physical-damage-dealt 同样是全局成对池；brutal 的 damage-min/max flat 改变原生伤害端点，装备武器玩家会经过附魔节点。

BE_ATTACK、反射/普通 bolt 中复用 attack 的交付以及非武器 attack 与近战使用相同的命中/物理伤害成对求值，条件 attack-kind 为 melee；交付不会因此进入近战 stamina/poise/主动防御调度域。真正的 BE_DAMAGE 仍走独立伤害种类/抗性路径。偷窃的第二次命中骰在两种 resolver 中均使用相同修正；0/100 和自动命中仍保留原生消费边界。设计上扣光当前 HP 的 other 调用（含自爆、否定消灭、失去领袖）统一使用 drainCurrentHp，显式忽略抗性；普通 other 伤害即使数值恰等于当前 HP 仍受抗性缩放，避免用数值相等推测调用意图。

## 物化与查询面

只有 HP、力量、stamina 容量、poise 容量、focus 容量物化。持久结构为 `ExtensionSnapshot.foundation.stats = {schema:1, applied:[{actorId,key,bonus}]}`，按 actorId 的字符串码点及 key 码点排序，仅存非零加值；无行省略 stats，禁止空 applied 数组。原生基础为当前上限减旧账本加值，完整新来源求值后统一写回。降容钳制、升容不补；只有 growth 永久 character 来源可声明 `grantPolicy:'refill-delta'`。该标注不让账本按整键加值自动补量；账本 write 的 refill 恒为 0，growth 的升级/属性点资源提案显式声明其恢复政策和永久增量，装备增减只改变上限/钳制。临时技能、装备、光环不得补血。原生显式治疗/克隆保留其既有经过校验的恢复/过量 HP 政策。

growth 的资源提案暂存于事务内，foundation 写上限与力量；不存在 derived 持久组件或第二个 applied 账本。combat actors 不存 combatStats/revision，三处容量消费者直接读管线；容量改变保持剩余计时和分数。

装备来源仅限 inventory 根中被槽引用的 Item；非 inventory 的悬挂槽也不贡献。箱、escrow、refund、remains、地面、怪物携带均不贡献。模块 `equippedItems()` DTO 当前仅含 id/category/kindKey/enchant/identified/runic，不含 moduleData。6A1 在该 DTO 的统一入口扩展，不能另建所有权枚举器。

模块只读 façade 提供 `value / rational / applied / breakdown / hypothetical`，不暴露注册、缓存、诊断、清空或写入口。`hypothetical(actorId,{equip?,unequip?},knownOnly)` 不写缓存/revision/world，不消费 RNG；未知装备行可用 known:false 过滤，原生未知附魔也过滤。`context.previewStats(actorId, ownComponents)` 仅允许投影本模块的组件草案，同样只读；真实 growth 奖励/分配/重置提案通过该入口包含其它模块来源。引擎 UI 的机械附魔/成长组件草案使用同一管线的临时覆盖，结束后释放，不修改实际 Item/组件。

缓存为会话派生：每 actor 至多128键 LRU（actor 缓存也有128上限），按显式 revision 与冻结目标事实分隔；来源冻结视图随显式写入口失效。账本的 set/remove/restore 在实际行变化时统一标记 extensions 摘要，覆盖装备、GC、克隆继承和原生最大生命重置；相同行的重复写入不标脏。没有原生 strength 字段的 NPC 使用固定 L0 12，账本加值只参与查询，不从该默认基础再扣一次。load/seek/rollback 清空。markStatsDirty 仅递增 revision、置位脏 actor，不同步 collect/reconcile。value/rational/breakdown/applied/成对读取时合并重算；纯 hypothetical 不发布物化或改 revision。物化签名只包含物化键及其 DAG 依赖和 L0，HP/状态等无关变化复用已验证结果，仍钳制资源；装备/模块事务在发布前完整校验预算、条件和分数安全。Item/Inventory 的会话 WeakMap 脏回调覆盖附魔、互换、叠堆、鉴定与耐久，不进入存档。相同 JSON 的 state/component 重写及删除缺席组件不触发属性失效；真实写入仍失效。完整准入以原始/激活来源行、原生公式输入和 combat profile 为签名复用成功验证；激活条件或机械输入变化重新校验，声明变化清该验证记录，记录也受 128 actor 上限约束。调试/测试每条命令后全量重算账本，缓存命中也与新算值比较。

## 声明示例与后续接入

现有 growth 实例见 `src/ext/modules/growth/statSources.ts` 的 `createGrowthStatSources`。它从自己的 progression/attributes/skill-build/identity 组件计算来源：永久角色加值为 character flat，临时技能与永久值的差为 temporary flat。以下为其永久 HP 行的形式，`base` 是已算出的永久加值：

```ts
{
  stat: 'native.max-hp', value: base, category: 'flat', layer: 'character',
  sourceKind: 'permanent-growth', sourceId: 'growth.native.max-hp.permanent',
  grantPolicy: 'refill-delta'
}
```

growth 的 focus/冷却/XP 键由该 provider 声明，combat 容量映射先读 `context.base(stat)` 获得模板 L0，再声明差值；不调用其它模块或写原生字段。既有技能的 additive budget 和 final more 槽也转成来源行，实际求值复用公共核。

未来装备模块可采用以下形式：

```ts
statSources: {
  collect(actor, context) {
    return context.equippedItems().map(item => ({
      stat: 'native.max-hp', category: 'flat', value: 5,
      layer: 'equipment', sourceKind: 'equipment',
      sourceId: `loot.item.${item.id}`, known: item.identified
    }));
  }
}
```

此处 loot 为未来模块名示意，本步不安装 loot、不添加词缀或 moduleData。crafting 同样声明自己的键与来源，稳定 sourceId 可用 `crafting.<definitionId>`；settlement 光环用 environment 层，sourceId 可用 `settlement.aura.<structureId>`。环境/装备来源不声明 refill-delta。C5-1 劳动信用仍为 elapsed×1，不声明或读取 foundation.labor-rate，不改 C5 DTO/SDK。

foraging 同伴虚弱/饥荒使用 increased 负值：命中 −2000/−4000 bp，造成伤害 −2500/−5000 bp。最低 −5000 在 −9000 下限内，可分别声明 native.accuracy 与 native.physical-damage-dealt；命中按 foraging 设计作用于攻击者 accuracy 输入节点；这是攻击方来源，别声明 native.evasion 或 damage-taken。多惩罚和正增益合并到公共池，合计低于 −9000 时按池下限钳制。focus 消耗与饥荒状态机由后续 foraging 模块负责，本步未实现玩法来源。
