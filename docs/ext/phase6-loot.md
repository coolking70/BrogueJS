# 阶段 6 设计稿：刷宝装备（`loot`）与共享属性管线

> **状态：设计稿待审。** 2026-10-06；分支 `ext/phase6-loot-design`，只读审计基线 `f1dbbd0`（阶段 5 设计、C5-1 草案与 5A0 提案均已批准，foundation 在本树仍为 4，集成基线 `7f6de96` 为 5，5A1 统一分配 6）。本轮只交付本文和 README 一行，不改代码、测试、数据或格式版本，不 commit。文中新类型、接口、预算、数值与规则都是提案；审阅通过不等于授权实施各小步。
>
> 政策来源：[扩展 README](README.md)、[底座架构](architecture.md)、[阶段 5 设计](phase5-settlement-world.md)、[C5-1 合同](phase5a-contract.md)、[5A0 报告](phase5a0.report.md)。相关模块手册：[growth](growth-config.md)、[combat](combat-config.md)、[giants](giants-config.md)、[combat adapter 提案](phase3-adapters.proposal.md)。

### 已定前提（维护者已决定，本文不再询问）

| 编号 | 已定内容 | 本文中的落实 |
| --- | --- | --- |
| P6-F1 | 掉落哲学**可配置**：掉率、稀有度权重、词缀数量全部数据驱动；不保留 Brogue 个位数稀缺经济，接受数值膨胀 | §3 预设、§6 生成表、§7 目录全部为数据；数值按 ARPG 尺度给出 |
| P6-F2 | 原版强化卷轴与武器/护甲符文保留为底层机制；启用 `loot` 时可彻底重塑其角色与数值，只共享底层逻辑 | §8 给出重塑方案，不向 CE 数值妥协 |
| P6-F3 | 分步：先词缀+稀有度+掉落表（含物品等级、鉴定、UI）；套装与符文之语为第二步（两者都设计，分期实现） | §13 6B 系列与 6C 系列 |
| P6-F4 | 遵循扩展架构：独立目录 `src/ext/modules/loot/`，只硬依赖底座；对 growth/combat/giants/narrative/crafting/settlement 仅软接口；规则 RNG 走引擎；严格版本化存读档/录像；可物理删除 | §4/§5/§11/§12 |

## 1 结论、范围与推荐边界

推荐拆成 **一个底座前置 + 一个独立模块**：

| 轨道 | 拥有内容 | 不承担 | 推荐负责人 |
| --- | --- | --- | --- |
| **S 共享属性管线**（底座，建议编号 5A2-S） | 统一、确定、有序的属性修正管线；原生属性派生改走管线；模块 `statSources` 声明；物化资源上限账本；纯“假设换装”求值 | 任何词缀/稀有度/掉落内容 | 本地 Codex 单一主笔；Claude 审查 |
| **6A 物品扩展底座** | Item 上的模块数据字段与 codec；统一掉落服务（populate/击杀/遭遇/部位破坏/机器）；固定原生装配复用 5A2；已知投影 | 词缀语义、生成算法 | 本地 Codex |
| **6B `loot` 第一步** | 物品等级、稀有度、前后缀、唯一品、掉落表、预设、鉴定、强化/符文重塑、UI、拾取过滤 | 套装、插槽、符文之语 | 核心包可整块派 dot；共用接线本地 |
| **6C `loot` 第二步** | 套装件数奖励、插槽、符文物品、符文之语、与 crafting/settlement 软联动（重铸、拆卸、仓库） | 商店、交易、跨局继承 | dot（数据+纯求值）+ 本地（工位/容器接线） |

首个可玩闭环（6B 结束）：D1 起怪物按预设掉落带稀有色的武器/护甲/戒指 → 未鉴定只显稀有度与“未知词缀×N” → 装备后数值经管线立即生效、熟悉度或鉴定卷轴揭示 → 比较提示给出已知差值 → 深层物品等级提升解锁更高阶词缀、巨兽 Boss 保底稀有。**不启用 loot 时**原生生成/掉落/强化/符文路径照旧（只是数值改由管线计算，零修正时结果相同，§4.9）。

范围外：商店/交易/金币消耗、跨局仓库、怪物穿戴玩家装备、法杖/魔杖/护符/投掷物的词缀（首版只做近战武器、护甲、戒指三类）、任意脚本效果。

## 2 只读审计：可复用能力与真正缺口

行号以本工作树 `f1dbbd0` 为准；集成基线可能偏移，实施时重核。

| 代码锚点 | 当前执行事实 | 阶段 6 裁决 |
| --- | --- | --- |
| `src/engine/Items/Item.ts:11–25,63–110` | ItemCategory 0…12（GEM=12，C5-1 追加 MATERIAL=13）；实例字段 `enchantment/timesEnchanted/runicType/runicKnown/isCursed/identified/canBeIdentified/magicDetected`，武器/护甲/戒指的 `charges` 复用为熟悉度倒计时 | 词缀不能塞进 `enchantment`/`runicType`；需要显式的模块实例数据字段（§5），保留原字段作为“底层机制” |
| `ItemLoader.spawnWeapon:1299`、`spawnArmor:1371` | 直接用全局 `rng` 按 CE 次序掷 40% 附魔、50% 诅咒、符文与长尾；投掷武器“先掷后剥” | loot 物品不能调用这两个函数再“覆盖”结果（会多耗随机且语义混乱）；复用 5A2 的**固定 +0 原生装配**，所有 loot 抽样走模块 `context.randomInt` |
| `Game.spawnPopulateItem:1075–1140` | 楼层物品：食物保底→计量表→`pickItemCategory`→`chooseKind`；武器/护甲分支调用上面两个 spawn | 加一个底座“生成转换”切点：loot 启用时武器/护甲/戒指分支交给掉落服务，计量/食物保底保持原生 |
| `Game.dropMonsterLoot:9075`；调用点 `:8721`（毒死）、`:9203`（玩家近战击杀） | Web 自创：只在两条路径掷 `itemDropChance`，硬编码 dagger/sword/leather/chain；法术、盟友、陷阱击杀不掉 | **最大缺口**：掉落路径不统一。loot 启用时改由 `killMonster` 唯一安全点派发掉落事实（§6.1），原两处调用在 loot 启用时跳过 |
| `Game.killMonster:10291–10325` | 非行政死亡只 `makeMonsterDropItem`（携带物）；复合体外围成员走 `retireBrokenBodyMembers` 不终结、不掉落；核心死亡才终结 | 掉落挂在核心真实终结之后、死亡 DF 之前的同一位置；成员破坏另走部位破坏事实（§6.4） |
| `CombatSystem.previewHitChance:99`、`resolveAttack:180`、`resolveAttackExtended:482`、`resolveThrownWeaponClassic/Extended:886/947` | 玩家命中=100×`accuracyFraction(netEnchant)`×`defenseFraction`；伤害端点 `enchantedDamage`；扩展分支再调 `rule('hitChance'|'physicalDamage')` | 两条求值器可按总原则 1 合并；命中/伤害的输入值改从管线取（§4.8） |
| `CombatFormulas.ts`：`netEnchant:29`、`accuracyFraction:39`、`damageFraction:47`、`hitProbability:81`、`playerDefense:111`、`monsterAccuracyAdjusted/DefenseAdjusted:61/64`、`runicWeaponChance:306`、`armorAbsorptionMax:382` 等 | 纯函数、CE 定点表；同一 netEnchant 同时驱动命中、伤害、符文强度 | 保留为“原生公式节点”；管线只修改其**输入与输出**，不复制公式 |
| `RingBonuses.ts`：`ringBonus/effectiveRingEnchant/turnsForFullRegenInThousandths`；`Player.regenRatePerTurn:278` | 戒指效果按 identityId 求和；再生、光照、潜行、感知、透视、收割、转移都由此派生 | 每种戒指效果变成管线属性键（如 `native.regeneration`），戒指本体是来源之一；词缀可贡献同一键 |
| `Game.ts:540,3125`（透视）、`:8050`（感知）、`:8102–8144`（潜行+`rule('stealthRange')`）、`:576`（搜索+`rule('searchStrength')`）、`:8342`（武器符文）、`:8520`（护甲符文） | 各自直接读戒指/装备并就地计算 | 全部列入路由清单（§4.8） |
| UI：`DetailGenerator.ts:188–219`、`ItemDetailEquipment.ts:20–61`、`MonsterSidebar.ts:149`、`BoltReflection.ts:43` | 预览与比较各自重算 playerDefense/netEnchant；`ItemDetailEquipment` 已有“实例未知则按 0 显示”的先例 | 改为调用管线的纯“假设求值”与已知投影，消除 UI/规则两套公式 |
| `src/ext/types.ts` `ExtensionRulePolicies`；`runtime.ts:257`（`Conflicting extension rule providers`）、`rule():719`、`nativeMaximumBase:756` | 每端口只允许**一个**提供者；返回单个标量；growth 独占 10 个端口与 `nativeBonuses` | loot 与 growth 同时修改命中/伤害会被拒绝启用——这正是需要共享管线的直接证据 |
| growth `module.ts:534 nativeBonuses`、`experience.ts:134 reconcileGrowthMaximum`、`commitItemGrowth` | growth 把 `appliedMaxHp/appliedStrength` 以差额写进原生 `maxHp/strength`，自带账本 | 推广为底座“物化属性账本”，growth 迁移为其来源之一（§4.5） |
| combat `resourcePolicies`（容量/恢复/韧性）、`ActorResources.ts:39` | 资源容量来自 combat 包模板；降容钳制、升容不补满 | 容量改为管线物化键 `combat.stamina-capacity` 等；保留“降钳不补”语义 |
| `EntitySnapshot.ts:10–18 ITEM_FIELDS`、`serializeItem/deserializeItem` | 显式字段表，u_01 审计声明与实例自有属性一致 | 新增一个底座字段（§5.2）并登记；不按模块各加字段 |
| `Inventory.ts:9 capacity=26`；`Player.ts:30–38` 四个装备位 | 26 字母背包；武器/护甲/左右戒指 | 26 格是刷宝的主要摩擦（§10.4）；套装件数受 4 槽限制（L-D01） |
| `ItemLoader.identifyInstance:847`、`updateIdentifiableItem:860`、`decrementWeaponAutoIDTimer:883`、`decrementWornFamiliarity:901`、静态 `identifiedItems` | 两层未知态：种类级（风味）与实例级（附魔/符文） | 词缀鉴定挂在实例级，复用熟悉度计时与鉴定卷轴目标（§8.3） |
| `types.ts OptionalQueryProvider`、`runtime.queryOptional:456` | 只读、带版本号的可选查询；缺席返回 unavailable | loot 的跨模块目录（growth 属性表、combat 资源键）用它解析 |
| 扩展录像：每条命令完整 `extensions` checkpoint（[架构 §6](architecture.md#6-录像与确定性)）；5A0 已批准新版摘要录像 | 原生实体图不在逐命令 checkpoint 中；模块 state 在 | 词缀数据放原生实体图，模块 state 保持极小（§11.2） |

## 3 核心循环、基调与掉落预设

### 3.1 循环与基调

“下潜 → 击杀/开宝库 → 地上闪出稀有色 → 拾取前看到稀有度、拾取后看词缀数量 → 熟悉或鉴定 → 比较换装 → 更深处更高物品等级”。Brogue 的鉴定悬念、诅咒风险和单件装备身份保留为风味；“每件都可能是毕业装”的 ARPG 期待成为主轴。数值膨胀是设计本身：伤害、护甲、生命在 D26 以后可达原版的 3–6 倍，怪物侧的抗衡由预设的“怪物强化”字段或后续冠军怪处理（L-D09），不靠压低词缀。

### 3.2 可配置的掉落哲学

全部字段归 loot 数据包 `presets[]`；一局只使用一个预设，选择方式见 L-D07。默认三套：

| 字段 | `classic-plus` | **`arpg-standard`（推荐默认）** | `bountiful` |
| --- | --- | --- | --- |
| 楼层武器/护甲/戒指转为 loot 物品比例 | 100%（但多为普通） | 100% | 100% |
| 怪物额外掉落倍率（相对原 `itemDropChance`） | ×1.0 | ×2.5，并对无掉率的普通怪给 4% 底率 | ×5.0，底率 10% |
| 单次击杀最多掉落件数 | 1 | 2 | 3 |
| 稀有度权重 普通/魔法/稀有/唯一/套装（‰） | 850/120/26/3/1 | 680/230/80/8/2 | 480/330/160/24/6 |
| 魔法词缀数 | 1–2 | 1–2 | 1–2 |
| 稀有词缀数 | 3–4 | 3–5（物等≥40 时 4–6） | 4–6 |
| 物品等级 | `floor(depth×1.5)+来源加值`，1…99 | 同左 | 同左 |
| Boss 遭遇保底 | 1 件魔法 | 2 件，至少 1 稀有 | 3 件，至少 1 稀有、20% 唯一 |
| 宝库（机器奖励房）最低稀有度 | 魔法 | 魔法；高价值宝库稀有 | 稀有 |
| 寻宝属性 `loot.rarity-find` 上限 | 100% | 300% | 500% |
| 怪物强化（每层生命/伤害倍率，经管线 L0 来源） | 无 | 生命 +3%/层、伤害 +2%/层 | 生命 +4%/层、伤害 +3%/层 |

预设只能引用本包的权重表/曲线，不含脚本；字段经严格 schema 与安全整数校验，进入规则指纹（改预设数值必须升 rules 版本）。

## 4 共享底座：统一属性修正管线（关键前置）

### 4.1 为什么必须先做

审计显示三种互不兼容的修正方式并存：①原生代码就地计算（戒指、netEnchant、潜行）；②growth 的单提供者 `rulePolicies`（运行时拒绝第二个提供者）；③growth/combat 各自把“已应用加值”写进原生字段或自有账本。loot 每个词缀都要同时触达这三类，若各开一个端口会立即与 growth 冲突，且 UI 比较、套装件数、crafting 重铸都需要“去掉/换上某来源后的结果”。因此把属性派生统一到底座，让 loot、growth、combat、crafting、settlement 都只**声明修正来源**。

### 4.2 模型

| 概念 | 定义 |
| --- | --- |
| **StatKey** | 稳定 ID。底座拥有 `native.*`（§4.8 清单）；模块拥有 `<moduleId>.*`（如 `combat.stamina-capacity`、`growth.focus-capacity`、`loot.rarity-find`）。每键声明：值域、整数/基点、`kind: query|materialized`、硬上下限、舍入、可用类别、所属 owner。模块键随模块启用注册，缺席即不存在 |
| **Source** | 一组修正的来源：`{owner, sourceKind, sourceId}`，如 `native:equipment:item#123`、`loot:set:loot.set.wanderer`、`growth:attribute:agility`、`native:status:weakened`。来源 ID 是稳定字符串/实体 ID，不含会话对象 |
| **Layer**（固定次序） | L0 基础（形态/职业数据、原生基础值）→ L1 原生内在（力量差、原戒指附魔、原装备附魔）→ L2 装备（loot 词缀、唯一/套装/符文之语、强化等级）→ L3 角色（growth 属性/技能/身份）→ L4 临时（状态、架势、技能临时效果、combat 姿态）→ L5 环境/聚落（营地光环、房间加成，阶段 5 之后） |
| **Category** | `override`（整值替换，极少用）、`flat`（整数加）、`increased`（基点，同键所有来源**相加**成一个池）、`more`（基点，**有名乘法槽**；同槽先求和再乘一次，跨槽按槽声明顺序相乘）、`clamp`（来源追加的上下限，只能收紧） |
| **Condition** | 有限词汇：攻击类别（melee/thrown）、目标公开标签（如 `body.large`、MonsterClass 成员）、自身状态、相邻、HP 比例阈值。条件只读冻结事实，不能读 RNG/全局 |

### 4.3 求值公式（每键、每次查询相同）

```text
base   = L0 基础值（原生字段或模块模板）
if override 存在: base = 唯一 override（同键多个 override 在安装时拒绝，除非声明了优先级且不同）
v1 = base + Σ flat                                  // 全部层，按 (layer, owner, sourceId) 稳定排序
v2 = v1 × (10000 + Σ increased) / 10000             // 一个加法百分比池，池先受类别预算钳制
v3 = v2 × Π_slot (10000 + Σ_slot more) / 10000      // 槽按 StatKey 声明顺序；每槽先钳制
v4 = clamp(v3, max(键下限, 来源 clamp 下限), min(键上限, 来源 clamp 上限))
out = round(v4, 键舍入规则)                         // 只舍入一次
```

全部用安全整数与基点（1 bp = 0.01%）；中间值用 BigInt 或分子/分母保存，乘前检查溢出，禁止浮点。growth 现有“加法预算→有名乘法槽→global-clamp→round”（[growth-config §5.1](growth-config.md#51-标量公式与叠加)）与此同构，因此 growth 的预算与槽可原样映射为 `increased` 池预算和 `more` 槽。

**依赖图**：部分键是原生公式的输入，部分是输出，例如 `native.weapon-enchant`（netEnchant 前的附魔+力量差）→ CE 表 → `native.accuracy`/`native.damage-min|max`。底座声明固定无环 DAG，按拓扑序求值；模块不能新增边，只能给节点加修正。

**双方属性**：物理伤害保持 growth 的“攻守合并只缩放一次”合同：`native.physical-damage-dealt`（攻击者）与 `native.physical-damage-taken`（防御者）的 increased 池在 `evaluatePair(attacker, defender, 'physical-damage')` 中合并为一个池再乘一次；命中同理合并攻方 `native.hit-chance` 与守方 `native.evasion`。必中/必失/仍掷骰的 100% 与免疫优先级仍在战斗求值器中保留，管线不改变“是否掷骰”。

### 4.4 上限与预算

1. 每键硬上下限（底座数据），例：`native.hit-chance` 500…9500 bp、`native.attack-speed` 25…400 tick、抗性 0…7500 bp、`native.stealth-range` 下限沿原生（正常 2、特殊 1）。
2. 每键每类别预算：如 `increased` 池 −9000…+50000 bp；`more` 槽 0…40000 bp。来源总数超过预算按池钳制，不按加载顺序丢弃。
3. 每 actor 修正行 ≤256，每键来源 ≤64；超限在提交该来源（换装/学技能）前拒绝，不静默截断。
4. 模块可追加更紧的 `clamp`，不能放宽底座硬限。

### 4.5 查询属性与物化属性

| 类型 | 适用键 | 存储 | 变更 |
| --- | --- | --- | --- |
| **query** | 命中、伤害端点、防御、攻速/移速、再生速率、潜行、搜索、感知、透视、光照、收割、转移、抗性、符文强度、寻宝 | 不存储；每次查询求值（带缓存） | 来源变化立即生效 |
| **materialized** | `native.max-hp`、`native.strength`、`combat.stamina-capacity`、`combat.poise-capacity`、`growth.focus-capacity` | 原生字段/资源池保存“当前值+当前上限”；底座账本 `appliedBonus[actorId][statKey]` 保存最近一次物化的总加值 | 只在可信安全点 `reconcileMaterialized(actor)`：新上限 = 原生基础 + 新加值；当前值**降则钳制、升则不补**（采用 [adapter 提案 §2 A](phase3-adapters.proposal.md)），永久成长可显式声明 `grantPolicy: refill-delta` |

growth 现有 `appliedMaxHp/appliedStrength` 与 `reconcileGrowthMaximum` 迁入此账本：growth 只声明 L3 来源，差额由底座统一写一次。这样换装、升级、套装件数变化共用一个“剥离旧加值→加新加值”的实现，不会出现双写或漏剥离。

### 4.6 重算与缓存

- 缓存是**会话派生数据**：键为 `(actorId, statKey, actorStatRevision, targetFactsKey)`；`actorStatRevision` 在装备增减、Item 模块数据改变（鉴定不改变机械值，不递增）、组件写入、状态起止、群体归属变化时由显式写入口递增。不入存档，load/seek/回滚后清空重建。
- 每 actor 缓存 ≤128 键；当前层 ≤128 actor（沿空间预算），LRU 淘汰只影响成本。
- 测试与调试模式启用“全量重算对照”：每次查询比较缓存值与无缓存求值，漏登记脏标记即失败（同 5A0 增量 Merkle 的证明思路）。
- 纯假设求值 `evaluateHypothetical(actor, {equip?, unequip?, knownOnly})` 复制来源集合计算，不写缓存、不递增 revision、不消耗 RNG，供比较提示与 AI 自动换装（若将来有）使用。

### 4.7 存读档与录像中性

管线本身不新增持久状态：query 键无存档；物化键只有既有原生字段 + 账本（账本归 foundation 世界状态，随 snapshot 校验“基础+加值=当前上限”）。求值无 RNG、无消息、无时间；`statSources.collect` 必须同步、纯、返回严格 JSON 行，异常即失败（不降级为“缺席”）。录像 v3 下行为由原命令重放复现；v4 摘要把账本纳入 foundation 域，派生缓存排除。

### 4.8 路由清单（实施时逐项改造）

| 管线键 | 现计算位置（需改为调用管线） | 原生基础 / 公式节点 |
| --- | --- | --- |
| `native.weapon-enchant` | `Combat.ts:105,221,521,896,957`；`Game.ts:8342`；`ItemDetailEquipment.ts:20–38`；`DetailGenerator.ts:215` | `netEnchant(enchant, effectiveStrength, strReq)` |
| `native.accuracy` / `native.hit-chance` | `previewHitChance:99`；`resolveAttack*`：`hitProbability` 调用 `:124,335,464,635,781,904,965`；growth `rule('hitChance')` `:127,636,967` | 玩家 100 / `Monster.accuracy` + `monsterAccuracyAdjusted` |
| `native.defense` / `native.evasion` | `playerDefense` 于 `Combat.ts:109,244,544`、`DetailGenerator.ts:188`、`MonsterSidebar.ts:149`、`ItemDetailEquipment.ts:56–61`；`monsterDefenseAdjusted` | `(armor+netEnchant−donning)×10` / `Monster.defense` |
| `native.damage-min/max`、`native.physical-damage-dealt/taken` | `enchantedDamage` 于 `Combat.ts:346–347,653–654,917,985`；growth `rule('physicalDamage')` `:693,988` | 武器 `damage` 串 / `Monster.damageString` |
| `native.strength` (materialized) | `Player.effectiveStrength:41`、growth `nativeBonuses` | `Player.strength − weaknessAmount` |
| `native.max-hp` (materialized) | growth `reconcileGrowthMaximum`、`runtime.nativeMaximumBase:756` | `Creature.maxHp` 基础 |
| `native.regeneration` | `Player.regenRatePerTurn:278`（`ring_of_regeneration`）、`Monster.regenTurns` | POW_REGEN 表 |
| `native.stealth-range` | `Game.ts:8102–8144`（`ring_of_stealth` + `rule('stealthRange')`） | CE currentStealthRange |
| `native.search-strength` / `native.awareness` | `Game.ts:576`（`rule('searchStrength')`）、`awarenessBonus:8050` | 原搜索强度 / `ring_of_awareness` |
| `native.clairvoyance`、`native.light` | `Game.ts:540,3125`、`ringLightMultiplier` | 戒指附魔和 |
| `native.reaping`、`native.transference`、`native.wisdom` | `Combat.ts:389,703,798`；护符/法杖充能处的 `ring_of_wisdom` | 戒指附魔和 |
| `native.attack-speed`、`native.move-speed` | `Creature.attackSpeed/movementSpeed:115–117` 的读者（`TimeCoordinator.ts:222,467`、`Game.ts:4183,4389`） | 100 tick；haste/slow 状态为 L4 来源 |
| `native.runic-power`、`native.armor-runic-power` | `runicWeaponChance:306` 与各符文时长/强度函数、`Game.ts:8520`、`BoltReflection.ts:43` | 现读 netEnchant；loot 启用时可读独立键（§8.2） |
| `native.resist.fire/poison/…`（新） | `Creature.takeDamage` 的 `damageKind`、中毒施加处 | 新增读取点；无来源时值 0，等价原规则 |
| `combat.stamina-capacity/regen`、`combat.poise-capacity/recovery`、`combat.native-attack-cost` | combat `resourcePolicies` → `ActorResources` | combat 模板为 L0 |
| `growth.focus-capacity`、`growth.focus-recovery-interval`、`growth.cooldown-duration`、`growth.xp-gain` | growth `rulePolicies` 同名端口 | growth 配置为 L0 |

### 4.9 迁移步骤与风险

1. **影子模式**：先实现管线与 native 来源，旧代码继续计算；在 test/调试构建逐次比较“旧值 vs 管线值”，零模块修正时必须完全一致（这是回归证明，不是对 CE 的长期兼容义务）。
2. **切换读取点**：按 §4.8 逐行替换；删除被替换的局部重算；UI 改用 `evaluateHypothetical`。
3. **growth 迁移**：`rulePolicies` 改为 `statSources`（L3/L4），删除单提供者端口与 `Conflicting extension rule providers` 检查；物化账本接管 `appliedMaxHp/appliedStrength`。growth 必须升 module/rules/state 版本，旧档拒绝。
4. **combat 容量迁移（可选同批）**：资源容量读取改为物化键；若改变 combat 存档布局则升版本，与 5A2 的中立 scheduler 迁移合并为一次 combat 格式变化。

**排期建议**：作为 **5A2-S**，紧接 5A2 之后、由同一本地主笔在 5A3 之前或与 5A3 顺序执行；它与 5B1（dot 的 crafting）不触碰相同文件，可与 dot 并行。它与 5A2 都改 `Game.ts`/`Combat.ts`/`runtime.ts`/growth，因此不能和 5A2 由两人同时写；foundation 格式号沿 5A1 统一分配（若账本改变 foundation 快照则升一次，不预占号码）。阶段 5 的 `growth.work-stats.v1` 与 adapter 提案 `growth.combat-stats.v1` 将被管线来源取代，不再另做协议。

**风险**：高。命中/伤害/防御全部改道，自然 trace 与相关录像会变（需按 AGENTS 规则逐字段归因后重录）；growth/combat 版本升级；物化账本若漏剥离会造成最大生命漂移。缓解：影子模式差分、全量重算对照、物化账本读档一致性校验、真实 Game save/load/replay/seek。

### 4.10 声明草图

```ts
// 底座（拟 src/engine/Stats/StatPipeline.ts + src/ext/stats.ts），草图非现有 API
type StatCategory = 'override' | 'flat' | 'increased' | 'more' | 'clamp';
interface StatModifierRow {
  stat: string; category: StatCategory; value: number;      // flat=原单位，increased/more=bp
  slot?: string;                                            // more 必填，引用键声明的槽
  layer: 'base' | 'intrinsic' | 'equipment' | 'character' | 'temporary' | 'environment';
  sourceId: string; conditions?: readonly StatCondition[];  // 有限词汇
}
interface StatSourceProvider {                               // ExtensionModule.statSources
  keys?: readonly StatKeyDeclaration[];                     // 模块自有键
  collect(actor: ActorFacts, context: StatSourceContext): readonly StatModifierRow[]; // 纯、同步、无 RNG
  revisionHint?(actor: ActorFacts, context: StatSourceContext): number;             // 可选脏标记辅助
}
interface StatQuery {
  value(actorId: number, stat: string, facts?: PairFacts): number;
  breakdown(actorId: number, stat: string): StatBreakdown;  // UI 用，冻结，可按 knownOnly 过滤
  hypothetical(actorId: number, change: EquipChange, knownOnly: boolean): Readonly<Record<string, number>>;
}
```

## 5 物品实例数据

### 5.1 数据形状

```ts
interface LootItemData {                 // Item.moduleData.loot；版本随 loot state 版本
  v: 1;
  baseId: string;                        // 原生模板 ID（dagger、chain_mail、ring_of_light…）
  ilvl: number;                          // 1…99
  rarity: 'normal' | 'magic' | 'rare' | 'unique' | 'set' | 'runeword';
  uniqueId: string | null;               // rarity=unique 时必填
  setId: string | null;                  // rarity=set 时必填（6C）
  affixes: readonly { id: string; tier: number; values: readonly number[]; known: boolean }[]; // ≤6；唯一/套装固定行≤8
  enhancement: number;                   // 强化等级（§8.1），0…rarity 上限
  sockets: number;                       // 0…4（6C 前恒 0）
  socketed: readonly string[];           // 已嵌符文定义 ID，按嵌入顺序（6C）
  nameParts: readonly [number, number] | null; // 稀有名的两个词表下标，生成时抽定
  origin: { source: 'floor' | 'kill' | 'encounter' | 'part' | 'vault' | 'craft'; depth: number };
}
```

存“已掷出的值”而非种子：目录升级必然升 rules 版本并拒绝旧档，所以不需要从种子重算；读档时按当前目录校验 `tier` 存在且每个值落在该阶区间、词缀组互斥、前后缀数量与稀有度规则一致、`known` 与原生 `identified` 一致（全部已知 ⇔ 实例已鉴定）。

### 5.2 挂接方式（底座 6A1）

- 底座给 `Item` 增加**一个**可选字段 `moduleData?: Record<ModuleId, Json>`，登记 `ITEM_FIELDS` 与 u_01 字段合同；原生物品省略该属性（不写 undefined）。
- 模块通过 `itemDataValidators: Record<name, (value, ctx) => boolean>` 声明自有键的严格校验，读档在退休旧局前对所有 Item 根（地面/背包/携带/缓存层/坠落/C5-1 容器与 escrow）校验；manifest 未启用的模块键出现即拒绝；模块删除后此类档因 manifest 缺模块被拒绝（不剥离续玩）。
- 写入只经可信路径：掉落服务提交、loot 命令（鉴定/强化/嵌符文）、crafting 软联动的计划提交；普通事件回调无权写 Item。
- 物品拆分/合并：loot 物品不可堆叠（maxStack=1）；`stacksWith` 对含 `moduleData` 的 Item 一律返回 false。
- 显示名：`Item.uninscribedName` 增加底座“名称装饰器”插槽，loot 提供前缀/后缀/稀有名/唯一名；未启用即原名。

### 5.3 体积

单件典型 JSON 250–450 B（稀有 5 词缀约 420 B）。按“当前层+缓存层+背包同时存活 2,000 件 loot 物品”估算新增 ≈0.6–0.9 MiB 整局快照，计入 C5-1 全局 8,192 Item roots。因数据在原生实体图，**不进入 v3 逐命令扩展 checkpoint**；loot 模块 state 只保存唯一品/遭遇收据与少量计数，目标 ≤4 KiB（§11.2）。实施前在 6A0 用真实编码做一次体积探针（同 5A0 方法），不以本估算代替。

## 6 生成

### 6.1 掉落来源与唯一安全点

| 来源 | 触发点（底座 6A1 提供） | 资格 | 收据 |
| --- | --- | --- | --- |
| 楼层生成 `floor` | `spawnPopulateItem` 抽中 WEAPON/ARMOR/RING 后，生成事务内 | 与原生同一次物品配额；投掷武器、钥匙、护符、宝石、消耗品不转换 | 无（生成事务失败整体回滚） |
| 怪物击杀 `kill` | `killMonster` 非行政终结、`captureDeath` 之后、死亡 DF 之前，一次 | 死者非克隆/非 `bodyTransitionRewardless`/非召唤副本/非玩家盟友；击杀者范围见 L-D10；复合体只核心 | DeathFact 已唯一，无需另存 |
| 遭遇 `encounter` | 底座 boss encounter 由 alive→defeated 的同一提交 | giants 的 `bosses[].status=defeated`（全部 subjects 死亡）；分裂后最后一个主体死亡才触发 | `encounterKey` 收据存 loot state，读档/重放不重发 |
| 部位破坏 `part` | 底座部位破坏事务提交后的只读事实（新增多消费者事实，不占 `combat.part-break.v1` 单 provider 槽） | 首版仅 L-D11=A 时；每 `(groupId, partId, generation)` 一次 | 底座破坏收据已唯一 |
| 宝库 `vault` | `spawnBlueprintItem` 的武器/护甲/戒指，含 `itemQualifiers` | 最低稀有度按预设 | 生成事务 |
| 合成 `craft`（6C3） | crafting 计划提交时的可选 provider `loot.item-roll.v1` | 只在 crafting 配方声明允许时 | crafting 工作票据完成序号 |

loot 启用时，`dropMonsterLoot` 的 Web 自创两处调用（`:8721`、`:9203`）跳过；原生 `makeMonsterDropItem`（携带物）照旧且先于 loot 掉落。loot 未启用时一切照旧。

### 6.2 物品等级

`ilvl = clamp(floor(depth × ilvlPerDepthBp / 10000) + sourceBonus, 1, 99)`；默认 `ilvlPerDepthBp=15000`、来源加值 floor 0 / kill 0 / 冠军 +2（若有）/ encounter +5 / vault +3 / part +2。site（地表）无深度时取 `siteIlvl` 配置（默认 1）。物品等级只决定可用词缀阶与基底，不直接加数值。

### 6.3 抽样算法与精确抽取次序

所有抽取经 `context.randomInt`（实质流）；显示、比较、过滤、名称渲染不抽。加权选择统一为“按定义数组顺序累加权重，`randomInt(1, total)` 选第一个累计 ≥ 结果的项”；权重为 0 的项不参与；候选为空时不抽。

```text
对一次掉落事件（来源 S，深度 d）：
 1. [kill/part] 掉落判定：randomInt(1,10000) ≤ 有效掉率bp → 否则结束（不再抽）
 2. 件数：若表 count.min<count.max 则 randomInt(min,max)，否则不抽
 对每件 i = 0…n−1，严格按顺序：
 3. 基底：加权选 baseId（按表与 ilvl 过滤；表可固定基底则不抽）
 4. 稀有度：加权选（预设权重 × 寻宝修正，见下；来源最低稀有度直接截断权重表，不重抽）
 5. 若 unique/set：加权选符合 baseId 与 ilvl、且未被本局收据占用的唯一品/套装件；
    候选为空 → 降为 rare，**不补抽稀有度**，继续第 6 步
 6. 词缀数：magic/rare 时 randomInt(min,max)；unique/set 跳过
 7. 对每个词缀槽 k：
    a. 若前后缀都还有名额且双方候选非空：randomInt(0,1) 选位置；否则不抽
    b. 加权选词缀（过滤：物品类、ilvl≥最低阶要求、未用互斥组、模块可用性）
    c. 加权选阶（只含 minIlvl≤ilvl 的阶，默认高阶权重递减）
    d. 每个数值 v_j：randomInt(lo_j, hi_j)
 8. unique/set 的固定行若有区间，按定义顺序逐值 randomInt
 9. 稀有名：rare 时 randomInt 选前词、后词
10. 插槽（6C）：按基底/ilvl/稀有度表 randomInt(0,max)，6C 前不抽
 之后由底座：固定 +0 原生装配（不抽）→ 落点选择沿原 `captiveItemDropCandidates` 的单次 randRange
```

寻宝修正：`effective = R × K / (R + K)`（R=玩家 `loot.rarity-find` 基点，K=预设常数，默认 25000）仅放大 magic/rare/unique/set 权重，普通权重不变；整数运算、向下取整。

抽取预算：每件 ≤64 次、每事件 ≤8 件 ≤512 次；超出视为数据错误在加载期拒绝（可静态推算上界）。

### 6.4 掉落表

`dropTables[]`：`id / match / count / chanceBp / entries / minRarity / ilvlBonus`。`match` 只用有限键：`monsterId`（原生 typeId）、`formId`（giants 已注册形态）、`bodyDefinitionId + partId`（部位）、`encounter: true`、`depth: [min,max]`、`source`。多表命中按 `priority` 取第一张，不叠加（避免组合顺序歧义）。`entries[]` 为 `{baseClass|baseId, weight}`。巨兽 Boss 可声明专属唯一品权重；giants 缺席时这些表因 `formId` 未注册而在安装期**被忽略并记录**（软依赖，见 §12）。

## 7 词缀目录

### 7.1 数据形状

```ts
interface AffixDefinition {
  id: string; nameKey: string;                  // 本包 locale
  position: 'prefix' | 'suffix';
  itemClasses: readonly ('weapon' | 'armor' | 'ring')[];
  group: string;                                // 互斥组：同一物品同组至多一个
  weight: number;                               // 0…10000
  tiers: readonly { tier: number; minIlvl: number; weight: number; ranges: readonly [number, number][] }[]; // 1…8 阶
  modifiers: readonly { stat: string; category: StatCategory; slot?: string; valueIndex: number; conditions?: StatCondition[] }[];
  requires: { module: string; stat: string } | null;   // 软依赖键
  fallback: { kind: 'replace'; affixId: string } | { kind: 'omit' } | null;
  polarity: 1 | -1;                             // -1 为负面（诅咒/腐化）
  tags: readonly string[];
}
```

目录构建在**开局启用边界**一次完成：`requires` 的模块/键不存在时按 `fallback` 替换或剔除，得到本局有效目录；有效目录的规范 JSON 指纹写入 loot rules 身份（同一模块集合 → 同一目录）。因为一局模块集合固定，已生成物品不会遇到“提供者中途消失”。

### 7.2 首版示例目录（数值为 ARPG 尺度提案）

阶列写 T1 / 最高阶（最低物等）。“底座键”指 §4.8 的 `native.*`。

| ID | 位 | 适用 | 修正 | T1 → 顶阶 | 组 | 依赖 / 缺席替代 |
| --- | --- | --- | --- | --- | --- | --- |
| `loot.affix.keen` 锋利的 | 前 | 武 | `native.physical-damage-dealt` increased | +15–30% → +120–170%（物等 45） | dmg-pct | — |
| `loot.affix.brutal` 凶暴的 | 前 | 武 | `native.damage-min/max` flat（两值） | +1/+2–3 → +9–12/+16–22 | dmg-flat | — |
| `loot.affix.honed` 淬炼的 | 前 | 武 | `native.weapon-enchant` flat | +1 → +5–7 | enchant | — |
| `loot.affix.precise` 精准之 | 后 | 武/戒 | `native.hit-chance` flat bp | +300–600 → +2000–2800 | accuracy | — |
| `loot.affix.swift` 迅捷之 | 后 | 武 | `native.attack-speed` more（速度槽，负值=更快） | −5–8% → −20–25% | speed | — |
| `loot.affix.reinforced` 加固的 | 前 | 甲 | `native.defense` increased | +20–40% → +130–180% | def-pct | — |
| `loot.affix.plated` 镶板的 | 前 | 甲 | `native.defense` flat（显示护甲单位） | +1–2 → +8–11 | def-flat | — |
| `loot.affix.vital` 活力之 | 后 | 甲/戒 | `native.max-hp` flat（物化） | +5–10 → +55–75 | life | — |
| `loot.affix.mending` 愈合之 | 后 | 甲/戒 | `native.regeneration` flat（戒指单位） | +1 → +4–5 | regen | — |
| `loot.affix.titan` 巨力之 | 后 | 武/甲/戒 | `native.strength` flat（物化） | +1 → +4–5 | strength | — |
| `loot.affix.shadow` 暗影之 | 后 | 甲/戒 | `native.stealth-range` flat（负值） | −1 → −4（下限仍沿原生） | stealth | — |
| `loot.affix.seeker` 寻觅之 | 后 | 戒 | `native.awareness` flat | +20–40 → +100–140 | search | — |
| `loot.affix.fireward` 阻燃之 | 后 | 甲/戒 | `native.resist.fire` flat bp | +1000–1500 → +4000–5000 | res-fire | — |
| `loot.affix.antivenom` 抗毒之 | 后 | 甲/戒 | `native.resist.poison` flat bp | 同上 | res-poison | — |
| `loot.affix.leech` 汲血之 | 后 | 武 | `native.transference` flat | +1 → +5–6 | leech | — |
| `loot.affix.reaper` 收割之 | 后 | 武 | `native.reaping` flat | +1 → +5–6 | reaping | — |
| `loot.affix.radiant` 辉光的 | 前 | 甲/戒 | `native.light` flat | +1 → +3 | light | — |
| `loot.affix.giantsbane` 屠巨的 | 前 | 武 | `native.physical-damage-dealt` increased，条件 目标公开标签 `body.large` | +25–40% → +120–160% | slayer | 标签由底座空间尺寸给出，无 giants 时仍可对原生大型生物生效；无此类目标则恒不触发 |
| `loot.affix.fortune` 好运之 | 后 | 戒 | `loot.rarity-find` flat bp | +1000–2000 → +5000–7000 | find | — |
| `loot.affix.enduring` 坚忍的 | 前 | 甲 | `combat.stamina-capacity` flat | +3–5 → +20–26 | stamina | combat；缺席 → `replace: loot.affix.vital` |
| `loot.affix.steadfast` 磐石之 | 后 | 甲 | `combat.poise-capacity` flat | +2–3 → +10–13 | poise | combat；缺席 → `omit` |
| `loot.affix.tireless` 不倦之 | 后 | 戒 | `combat.stamina-regen` increased | +10–20% → +60–80% | stamina-regen | combat；缺席 → `replace: loot.affix.mending` |
| `loot.affix.sage` 贤者之 | 后 | 戒 | `growth.focus-capacity` flat | +1 → +4 | focus | growth；缺席 → `replace: loot.affix.mending` |
| `loot.affix.adept` 精擅之 | 后 | 武/甲/戒 | `growth.attribute:<id>` flat，`<id>` 来自 `growth.attributes.v1` 可选查询返回的已发布属性表，按表顺序展开为多条变体 | +1 → +3 | attribute | growth；缺席 → `replace: loot.affix.titan` |
| `loot.affix.scholar` 博学之 | 后 | 戒 | `growth.xp-gain` increased | +5–8% → +20–25% | xp | growth；缺席 → `omit` |
| `loot.affix.brittle` 脆裂的（负面） | 前 | 甲 | `native.defense` increased（负） | −10–20% → −30–40% | def-pct | 仅腐化/诅咒物品（L-D05） |

示例唯一品与第二步样例（仅示意数据形状）：

- `loot.unique.ember-fang`（基底 sword，物等 ≥20）：固定行 `native.physical-damage-dealt +80–110%`、`native.resist.fire +3000`、`native.weapon-runic: burning-proc`（见 §8.2 的符文词缀族）。
- 套装 `loot.set.wanderer`（武/甲/双戒 4 件）：2 件 `native.move-speed −10%`；3 件 `native.stealth-range −2`；4 件 `loot.rarity-find +5000`。
- 符文之语 `loot.word.ash`：基底 armor、2 孔、顺序 `rune.ka` → `rune.ul`：`native.resist.fire +5000`、`native.max-hp +40`。

## 8 强化卷轴、符文与鉴定的重塑

### 8.1 强化卷轴（`scroll_of_enchantment`）

| 方案 | 启用 loot 时的作用 | 评价 |
| --- | --- | --- |
| **A 强化等级（推荐）** | 对 loot 物品：`enhancement+1`，按 loot 曲线放大**基底**属性（默认每级武器基础伤害 +8%、护甲基础值 +10%、戒指本体附魔 +1），上限按稀有度（普通 10/魔法 8/稀有 6/唯一·套装 4）；到上限后卷轴改为“提升一条随机词缀的数值到本阶上限内重掷”或被拒绝（数据配置）。仍沿原 `canEnchantChosenItem`/`enchantChosenItem` 目标选择、自亮、解除诅咒与原生 `timesEnchanted` 计数；非 loot 物品（法杖、魔杖、护符）保留原生 +1 | 卷轴保持高价值且不压缩 ARPG 数值；底层流程复用 |
| B 原样 +1 附魔叠加 | 原生 +1 `enchantment` 照旧，词缀在其上 | 最省事，但 +1 在膨胀数值下几乎无感，卷轴失去意义 |
| C 改为洗练货币 | 读卷轴=重掷一件物品的全部词缀（保留稀有度） | 刷宝感强，但抹去 Brogue 的养成线，且与 crafting 重铸重复 |

growth 的 `itemGrowth` 对强化卷轴的换算（`destination: enchantment`）在 A 下改为对 `enhancement` 的授予；两者经管线后不冲突，growth 无需感知 loot。

### 8.2 武器/护甲符文

| 方案 | 内容 | 评价 |
| --- | --- | --- |
| **A 符文词缀族（推荐）** | 原生 `runicType` 仍是执行开关；loot 物品的符文只能由“符文词缀”（如 `loot.affix.rune-paralyzing`，每件至多 1 个，独立 `rune` 组）或唯一品固定行给出；符文强度改读 `native.runic-power` / `native.armor-runic-power`（L0=该词缀阶的强度值，非 netEnchant），触发概率与时长仍走原 `runicWeaponChance` 等函数表 | 保留全部原符文行为代码，数值完全归 loot；可数据控制出现率 |
| B 原生符文独立 | loot 基底仍按原生 40%/符文骰决定符文，词缀另算 | 需要调用原 spawn 随机路径，语义重复且与 §6.3 次序冲突 |
| C 启用 loot 时取消符文 | 不产生符文 | 失去 Brogue 特色效果 |

负面符文（mercy、plenty、burden、vulnerability、immolation）在 A 下只作为腐化物品的负面词缀出现（L-D05）。

### 8.3 鉴定

- 稀有度在**看见时即公开**（地面颜色、名称前缀“魔法/稀有…”）；词缀数量拾取后公开；词缀内容未知时显示“未知前缀/后缀”（推荐 L-D02=A）。
- 未知词缀**仍然生效**（与 Brogue 未知附魔生效一致）；角色面板总值包含其效果但比较提示与明细只显示已知部分，未知部分标“?”，避免泄露。
- 揭示途径：鉴定卷轴（揭示全部，置原生 `identified=true`）；原熟悉度计时（武器 20 杀 / 护甲 1000 回合 / 戒指 1500 回合）到期揭示全部；`detect magic` 照原规则显示极性（存在负面词缀即恶性）；可选“使用即知”：命中、承伤等首次实际触发某词缀修正时揭示该词缀（`known=true`，L-D02 可关）。
- 唯一品/套装在鉴定前显示为“未鉴定的唯一 <基底>”；鉴定后显示名称与固定行。
- 所有揭示写入只经可信路径（命令或原熟悉度安全点），不在 UI 查询时发生；揭示不改变机械值，因此不递增属性 revision。

## 9 第二步：套装、插槽与符文之语（6C）

| 主题 | 设计 |
| --- | --- |
| 套装 | `sets[]`：`id/nameKey/pieces[]/bonuses[{count, modifiers}]`；件 = 带固定行的特定基底唯一件，rarity=set。件数按**当前装备**中不同件计（同件重复不计）；奖励作为 L2 来源 `loot:set:<id>:<count>` 交给管线；4 槽下最多 4 件（L-D01 若加槽则相应放宽） |
| 插槽 | 普通（白）物品按基底/物等可带 0–4 孔（武器/护甲；戒指 0）；6C 前孔数恒 0 |
| 符文物品 | loot 经 5A2 `registerItemDefinitions` 注册 `category: 'material'`、tags `loot.rune.<id>`、maxStack 99 的符文定义（复用 C5-1 堆叠/容器/escrow，不新增类别）；掉落表可掉符文；单符文嵌入时提供自身小修正 |
| 嵌入 | 命令 `socket {v:1,itemId,runeItemId,revision}`：100 tick，消耗 1 枚符文，追加到 `socketed` 末尾；不可撤销。顺序即嵌入顺序 |
| 符文之语 | `runewords[]`：`id/baseClasses/sockets/sequence[]/modifiers`；当普通物品孔位恰好填满且序列完全匹配时，在同一提交内转为 rarity=runeword，单符文修正被符文之语修正**替换**；不匹配则保留单符文修正 |
| crafting 软联动 | 可选 `crafting` 工位标签（`station.forge`）存在时，loot 经 5A2 工作票据提供：**拆卸**（取回最后一枚或全部符文，耗时，符文是否保留由数据定）、**重铸**（重掷一条词缀，消耗材料）；无 crafting 时这些操作不可用但套装/符文之语照常 |
| 合成物品掷词缀 | 可选 provider `loot.item-roll.v1`（prepare/commit 同可选奖励协议）：crafting 配方声明 `lootRoll: {maxRarity}` 时由 loot 在工作票据完成时掷词缀；provider 缺席则输出保持 P5-D10 的 +0 已知 |
| settlement 仓库 | 无需 loot 自有仓库：settlement/crafting 的箱子（C5-1 容器根）可存 loot 物品；loot 只提供箱内物品的只读列表投影与过滤 |

## 10 背包与 UI

### 10.1 文本与比较

- 物品详情（`ItemDetailEquipment` 体系）新增“词缀段”：每行“名称 + 数值 + 阶（可选）”，按前缀→后缀→固定行→套装→符文排序；未知行灰色“未知后缀”。
- 比较：以当前同槽装备为基准，调用管线 `hypothetical(knownOnly=true)` 输出关键键差值（命中%、伤害区间、防御、最大生命、抗性、模块键），正绿负红；戒指同时对左右各比一次。
- 角色面板：管线 `breakdown` 展示每键来源（原生/装备/成长/临时），未知来源合并为“未知装备效果”。

### 10.2 稀有色与字形主题

| 稀有度 | 颜色（深色主题） | 浅色主题 | 背包标记 |
| --- | --- | --- | --- |
| 普通 | `#c8c8c8` | `#4a4a4a` | 无 |
| 魔法 | `#6a8cff` | `#2b4fd1` | ◇ |
| 稀有 | `#ffd94a` | `#9c7a00` | ◆ |
| 唯一 | `#c7a046` | `#7a5a14` | ★ |
| 套装 | `#3fd36b` | `#16803a` | ✦ |
| 符文之语 | `#b8a77a` | `#6b5c33` | ⊕ |

地图字形保留原生 `)` `]` `=`，仅前景色按稀有度（`src/ui/mapTileDrawing.ts` 的物品着色走底座“物品外观装饰器”插槽）；幻觉时沿原随机外观，不读真实稀有度。背包标记字符保证在单色/小屏下仍可区分。颜色进主题 token，不在组件内硬编码。

### 10.3 过滤与拾取

- 拾取过滤为**机械规则**（影响是否自动拾取），属 loot state，经命令 `set-filter {v:1, minRarity, classes[], autoPickupGold}` 修改并录像；显示过滤（背包只看稀有以上）是纯 UI 状态，不入存档。
- 走过低于阈值的物品只提示不拾取；原 `ITEM_PLAYER_AVOIDS` 语义保留。

### 10.4 26 格限制

刷宝在 26 字母背包下会迅速溢出。推荐 L-D06=A：保持 26 格与字母体系，提供①拾取过滤；②“分解”命令（100 tick，把非唯一 loot 物品转为 loot 自有材料 `loot.shard`，经 5A2 注册为 material、stack 99，仅占 1 格；数量按稀有度/物等表）；③批量丢弃确认。分解不依赖 crafting；有 crafting 时 `loot.shard` 可作为重铸材料。

### 10.5 手机 320/390

- 详情与比较用底部抽屉（复用 `DialogHost`），宽 320 时单列：名称行 → 稀有度/物等 → 词缀行（最多 8 行，超出折叠“更多”）→ 比较差值（最多 6 项，其余在“全部比较”）。
- 过滤用面板内可横向滚动的筹码行，页面本身无横向滚动；所有按钮 ≥40×40 px。
- 浏览器验收在 320×640、390×844、1440×1000 三档，以当次生产构建为准。

## 11 持久化、确定性、性能与预算

### 11.1 存储位置

| 真相 | 位置 | 不重复保存 |
| --- | --- | --- |
| 物品词缀/稀有度/物等/孔/强化 | `Item.moduleData.loot`（原生实体图） | 模块 state 中的物品副本 |
| 唯一品已掉收据、遭遇掉落收据、拾取过滤、分解计数 | `extensions.modules.loot`（≤4 KiB） | 掉落历史全文 |
| 管线物化账本 | foundation 世界状态 | 各模块自有 applied 字段（迁移后删除） |
| 管线缓存、有效目录索引、名称渲染 | 会话派生，load/seek 重建 | 存档 |

### 11.2 版本与录像

loot 拥有 module/rules/state 版本与规范指纹（目录、预设、掉落表、唯一/套装/符文之语全部进机械指纹，locale 除外）；任一变化升版本，旧档拒绝，不迁移。底座的 `Item.moduleData`、物化账本、掉落服务若改变实体/foundation 编码，由集成人在当时的格式批次统一升号（不预占）。v3 录像下 loot state 每命令进入 checkpoint：4 KiB × 1 万命令 ≈ 40 MiB，可接受但不理想；推荐 loot 实现排在 5A1-R（已批准的摘要+周期快照录像）之后（L-D12）。

### 11.3 性能与预算

| 对象 | 硬上限 | 触顶 |
| --- | --- | --- |
| 词缀定义 / 每词缀阶 / 每阶数值 | 256 / 8 / 4 | 加载拒绝 |
| 唯一品 / 套装 / 每套件数 / 符文之语 / 符文定义 | 128 / 32 / 4（加槽后 6） / 64 / 33 | 加载拒绝 |
| 掉落表 / 每表条目 / 预设 | 256 / 64 / 8 | 加载拒绝 |
| 每件词缀 / 固定行 / 孔 | 6 / 8 / 4 | 生成器不产生；读档拒绝 |
| 每事件件数 / 每件抽取次数 | 8 / 64 | 静态校验 |
| 管线：每 actor 修正行 / 每键来源 / 模块键 | 256 / 64 / 128 | 提交来源前拒绝 |
| 全局 Item roots | 沿 C5-1 的 8,192（loot 物品计入） | 掉落事务预检，无额度则该件**不生成**并记一次本地化提示（掉落判定已完成的抽取不回退，保证确定性） |

性能目标（实施时实测、报告硬件与规模）：单次管线查询缓存命中 P95 ≤0.01 ms、未命中 ≤0.1 ms；单次击杀掉落（8 件上限）≤1 ms；比较提示 ≤2 ms；有效目录构建 ≤20 ms（开局一次）。

### 11.4 确定性要点

1. 所有规则抽取走实质流，次序按 §6.3 固定；显示/比较/过滤/名称/颜色不抽。
2. 掉落只在唯一安全点；读档、seek、重访不重发；遭遇/唯一品收据单调。
3. 管线求值纯、同步；缓存只影响成本。
4. 命令：`identify-use`（若扩展卷轴目标）、`set-filter`、`salvage`、`socket`、`unsocket/reforge`（经工位）均为 `{module:'loot',action,payload:{v:1,…,revision}}`，0 成本拒绝陈旧/非法输入。

## 12 依赖、软接口与共享文件

### 12.1 依赖图

```mermaid
flowchart LR
  F[底座: 属性管线 5A2-S + 物品扩展/掉落服务 6A] --> L[loot]
  F --> G[growth] & K[combat] & C[crafting] & S[settlement]
  G -. statSources / growth.attributes.v1 .-> L
  K -. combat.* 属性键 .-> L
  J[giants] -. formId/遭遇/部位事实（底座） .-> L
  C -. loot.item-roll.v1 / 工位重铸 .-> L
  S -. 容器存放 .-> L
  N[narrative] -. 可选奖励 loot.reward.v1（后续） .-> L
```

实线为硬依赖（只有底座）；虚线全部可缺席：缺 growth/combat → §7 fallback；缺 giants → 相关掉落表忽略，遭遇事实只来自底座通用 boss marker；缺 crafting → 无重铸/拆卸/合成掷词缀；缺 settlement → 无营地箱，背包+分解仍可玩；narrative 后续可通过可选奖励协议发放指定唯一品，首版不做。loot 不 import 其它模块文件；物理删除 `src/ext/modules/loot/` 后底座与其余模块应通过 boundary/vue-tsc/build/剩余 test:ext/组合 smoke。

### 12.2 共享文件触碰清单

| 文件 | 步骤 | 冲突说明 |
| --- | --- | --- |
| `src/engine/Combat/Combat.ts`、`CombatFormulas.ts`、`BoltReflection.ts` | 5A2-S | 最高；与 combat/giants 收尾和 5A2 同期，单一主笔 |
| `src/engine/Core/Game.ts`（populate、killMonster、dropMonsterLoot、潜行/搜索/感知/透视、符文、鉴定、强化） | 5A2-S、6A1、6B3 | 最高；阶段 5 也在此，按批次顺序合并 |
| `src/entities/Player.ts`、`Creature.ts`、`Monster.ts`、`src/engine/Items/RingBonuses.ts` | 5A2-S | 高 |
| `src/engine/Items/Item.ts`、`ItemLoader.ts`、`Inventory.ts`、`ItemUseCoordinator.ts`、`EntitySnapshot.ts`、`scripts/u03-state-contract.json`、u_01 审计 | 6A1、6B3 | 高；与 5A2 的 MATERIAL/容器改动交叉 |
| `src/ext/types.ts`、`runtime.ts`、`compatibility.ts`、新 `src/ext/stats.ts`、新 `src/engine/Stats/*` | 5A2-S、6A1 | 高；dot 禁改 |
| `src/ext/modules/growth/**` | 5A2-S（迁移） | growth 版本升级，由本地负责 |
| `src/ext/modules/combat/**` | 5A2-S（可选容量迁移） | 与 5A2 combat 格式变化合并 |
| `src/engine/UI/DetailGenerator.ts`、`ItemDetail*.ts`、`MonsterSidebar.ts`、`src/components/InventoryOverlay.vue`、`DetailPanel.vue`、`src/ui/mapTileDrawing.ts`、主题 token | 5A2-S（改用管线）、6A1（装饰器插槽）、6B2 | 中高；底座插槽本地做，loot 自有面板可由 dot |
| `scripts` 测试发现器 / 组合清单 | 6B1 | 新模块登记归其自有 `test-suites.json` |

## 13 分步实施与 dot 交接

### 13.1 每步可停下的闭环

| 小步 | 交付 / 停点 | 验收重点 |
| --- | --- | --- |
| **5A2-S 属性管线**（阶段 5 底座批次，5A2 之后） | 管线、native 来源、§4.8 全部读取点切换、物化账本、growth 迁移、UI 改用假设求值；零修正下影子差分一致 | 影子差分全绿；全量重算对照；growth 全部既有功能与录像；物化账本 save/load/replay/seek/续录；无模块/各模块组合；性能 |
| **6A0 合同与探针** | C6-1：`Item.moduleData`、itemDataValidators、掉落服务事件/计划/提交、名称/外观装饰器、固定装配复用、`loot.*` 命令外壳；真实编码体积探针 | 声明可类型检查；体积报告；不启用玩法 |
| **6A1 物品扩展底座** | 字段与 codec、掉落服务（floor/kill/encounter/vault；part 可后置）、底座 fixture 模块演示一件带数据物品的生成→保存→重放 | 全 Item 根校验、坏档拒绝、生成事务回滚、掉落唯一性、真实命令录像；loot 未安装时零行为变化 |
| **6B1 loot 核心包**（可派 dot） | schema/目录/预设/掉落表/生成器/鉴定揭示/拾取过滤/分解/命令/自有 locale/测试；首版 ~26 词缀、6 唯一品 | 单独启用与任意组合；§6.3 抽取次序固定向量；目录 fallback；预算负例；自然击杀→掉落→装备→生效→鉴定→save/replay/seek |
| **6B2 UI** | 详情词缀段、比较、角色来源分解、稀有色主题、过滤筹码、手机布局 | 320/390/1440 真实生产构建；未知不泄露；无 RNG/状态写 |
| **6B3 强化与符文重塑** | §8.1 A、§8.2 A 接线（触碰原生物品使用与符文读取点） | 原生非 loot 物品行为不变；强化上限/卷轴自亮/解除诅咒；符文强度改读管线；growth itemGrowth 组合 |
| **6C1 套装** | 套装件、件数奖励 | 换装增减件数的物化/查询一致；读档无漂移 |
| **6C2 插槽与符文之语** | 孔、符文物品（经 5A2 定义注册）、嵌入命令、符文之语转换 | 顺序/不匹配/满孔、符文堆叠与容器、预算 |
| **6C3 crafting/settlement 软联动** | `loot.item-roll.v1`、工位拆卸/重铸、箱内过滤投影 | 双模块单开/双开/删除；工作票据中断退款；provider 缺席 |
| **6Z 收尾** | 配置手册 `loot-config.md`、全部组合/真实删除/浏览器/体积/性能 | 按当时门禁政策统一执行 |

每步验收后停下等维护者批准。可停在 6B1+6B2 得到可玩的刷宝首版；6B3 可推迟（届时原生强化/符文照旧作用于 loot 物品的原生字段）。

### 13.2 dot 适合承接的任务

dot 的每条消息需维护者手动转贴，只派**大块、自包含、合同先行**的任务：

1. **6B1 loot 核心包**（推荐）：前置为 5A2-S 与 6A1 已合并、C6-1 冻结并给出真实导出/fixture/SDK hash/版本。授权范围仅 `src/ext/modules/loot/**` 与自有文档；内容：schema、目录与预设数据（维护者先批准 §3.2/§7.2 数值表）、纯生成器（输入为 `randomInt` 回调与冻结事实，输出 `LootItemData[]`，便于固定向量测试）、校验器、命令、自有 UI 面板（经 `src/ext/ui` 插槽）、locale、测试与 `test-suites.json`。禁止改 Game/共用类型/codec/其它模块/package。共享需求汇成一份清单由本地修 SDK。
2. **6C 数据与纯求值包**：套装/符文之语/符文定义及其纯求值与校验（不含工位与 5A2 票据接线），同样只在 loot 目录内。
3. 不适合 dot：5A2-S（共享文件密集、需逐行迁移）、6A1、6B3、6C3 接线、主题与通用 UI 插槽。

派发前维护者需填写：基线 commit、C6-1 导出文件、已选待决项、版本号、SDK hash、当步门禁档位；缺项只允许做纯数据草案。

### 13.3 门禁

纯设计本轮只查 Markdown。实施期建议沿用 P5-D14=A 的方式（开发期相关功能门禁逐步、收尾统一完整），但阶段 6 须由维护者另行明确；在此之前 README 一般门禁适用。新增 loot 后模块数 7（4 既有 + crafting + settlement + loot），启用子集 128，删除矩阵相应扩大，由发现器动态计算。

## 14 待维护者决定（推荐不是批准）

> **维护者决定（2026-10-06）：L-D01–L-D13 全部采用推荐项（L-D10 选 C、L-D11 选 B，其余选 A）。** 设计已批准；L-D08=A：共享属性修正管线作为 5A2-S 排入阶段 5（5A2 之后，本地实施）。§3.2 预设数值与 §7.2 词条数值暂按提案作为草案，在 6B1 派发 dot 前由维护者最终确认。

技术不变量不列为选项：只硬依赖底座、命令边界、引擎 RNG、严格版本不迁移、可物理删除、掉落唯一安全点。

| 编号 | 选项 | 推荐与理由 |
| --- | --- | --- |
| **L-D01 装备槽位** | A 保持 4 槽（武器/护甲/双戒），套装≤4 件；B 加头/手/脚 3 槽（需新原生基底、受击/护甲公式分摊）；C 只加 1 个“饰品”槽 | **A**：不动原生装备模型即可刷宝；B 收益大但是独立的原生改造，可作为后续步骤 |
| **L-D02 鉴定与可见性** | A 稀有度可见、词缀待鉴定/熟悉/首次触发揭示；B 拾取即全知（无鉴定玩法）；C 严格 Brogue：稀有度也要 detect magic | **A**：保留鉴定悬念又不阻碍刷宝判断 |
| **L-D03 强化卷轴** | A 强化等级（loot 曲线、稀有度上限）；B 原生 +1 叠加；C 洗练货币 | **A**（§8.1） |
| **L-D04 符文** | A 符文词缀族，强度读管线；B 原生符文骰独立；C 取消符文 | **A**（§8.2） |
| **L-D05 诅咒/负面** | A 少量“腐化”物品（含 1 条负面词缀、原生粘装语义），预设控制概率；B 另外保留原生负附魔/诅咒骰；C 无诅咒 | **A**：保留风险风味且数据可调 |
| **L-D06 背包压力** | A 26 格 + 拾取过滤 + 分解为 `loot.shard`；B 扩为 52 字母；C 独立无字母战利品页 | **A**：不改字母输入体系；B/C 牵动输入、UI 与命令格式 |
| **L-D07 预设选择方式** | A 新局菜单选择（记录为一次初始命令，进 manifest 校验）；B 数据包固定默认，改预设即改数据版本；C 局中可切换 | **A**：契合“掉落哲学可配置”且仍确定可重放；C 会让收据/平衡失去意义 |
| **L-D08 管线排期** | A 5A2-S：5A2 之后、同一主笔，阶段 5 内完成；B 与 5A2 合并为一个大批次；C 推迟到阶段 6 首步 | **A**：growth/combat/阶段 5 都受益，且不拖慢 dot 的 5B1；B 批次过大难审，C 让 5D 的工作属性等软联动重复造协议 |
| **L-D09 怪物侧数值** | A 首版怪物不吃 loot 词缀，靠预设“深度生命/伤害倍率”抗衡膨胀；B 冠军/精英怪（随机 1–3 条怪物词缀，经管线）；C 怪物可穿戴拾取的装备 | **A** 首版，B 作为 6B 之后的独立小步；C 风险最大 |
| **L-D10 盟友击杀掉落** | A 盟友/召唤物击杀也掉落（按因果终结）；B 仅玩家及其因果来源击杀掉落；C 任何非行政死亡都掉 | **C**：最简单且避免“让盟友补刀损失掉落”的反直觉；配额由掉率控制 |
| **L-D11 巨兽部位掉落** | A 部位破坏按部位表掉一次（`part` 来源）；B 只核心终结与遭遇结算掉落；C 部位只掉符文/材料 | **B** 首版（不新增多消费者事实），A 随 6C 或巨兽内容扩充再做 |
| **L-D12 录像前置** | A loot 实现（6B1 起）排在 5A1-R 新录像之后；B 允许在 v3 录像下先做，模块 state ≤4 KiB | **A**：避免长局录像体积问题再出现一次；5A2-S/6A 不受此限 |
| **L-D13 合成联动深度** | A 可选 provider：配方声明后最多掷到魔法，锻炉工位可重铸/拆卸；B 保持 P5-D10，合成永远 +0，只做重铸；C 可直接合成稀有/唯一 | **A**：联动有价值又不冲掉掉落来源；需要 crafting 配方新增一个可选字段（crafting 升版本，另行批准） |

## 15 本轮交付与检查范围

本轮新增本文，并在 [README](README.md) 阶段表与审阅入口各加一行“设计稿待审”。未改代码、测试、数据、脚本或格式版本，未运行 npm test/build/组合/删除/浏览器（纯文档）。交付检查：新增文档与 README 链接目标存在、Markdown 代码块闭合、无 CRLF/冲突标记、`git diff --check` 与修改范围检查。不 commit、不推送。

**阻塞性问题（需维护者确认后才能进入 6A0）**：①L-D08 是否把 5A2-S 正式纳入阶段 5 排期（影响 5A2 之后的本地主笔顺序与 growth 版本计划）；②§3.2 与 §7.2 数值表是否按提案批准，或另给目标强度曲线（6B1 派 dot 前必须一次定稿）。
