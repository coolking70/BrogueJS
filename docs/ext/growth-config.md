# Growth 数据配置合同（1a0）

本文件记录 growth 数据包的实际字段合同。配置是有限、可校验的 JSON，不是脚本；数值是可调整的默认样例，不承诺平衡。1a0只提供合同/加载验证/版本绑定，**不注册启用成长玩法，不发XP，不执行属性、技能或身份效果**。

## 1. 实际文件与边界

| 文件 | 责任 |
|---|---|
| `src/ext/modules/growth/index.ts` | 显式opt-in合同工厂：校验真实怪物/物品/类别引用，仅允许空模块状态，无XP/创建/技能钩子 |
| `src/ext/modules/growth/types.ts` | 配置类型、判别联合、有限规则端口/动作词汇 |
| `src/ext/modules/growth/schema.ts` | `getGrowthSchema()`结构合同及两阶段纯校验、引用/预算/循环/版本检查；schema显式请求时才构造并冻结缓存 |
| `src/ext/modules/growth/definitions.json` | 默认样例配置和12技能/4职业/4血统/4信仰定义 |
| `src/ext/modules/growth/definitions.ts` | `parseGrowthDefinitionPack`验证后深拷贝/深冻结；默认加载器和惰性数据指纹 |
| `src/ext/modules/growth/text.ts` | 样例定义与校验错误的本地化词条 |
| `src/ext/registry.ts`、`src/ext/types.ts` | 模块数据合同与阶段0精确版本校验衔接 |

不复用阶段0 `src/ext/definitions.ts` 的示例三属性/简单effects冒充正式成长schema。旧 example 包与测试保持原合同；growth包通过数据校验不等于引擎支持其中所有动作。显式合同工厂`createGrowthContractModule()`不进入默认扩展集合；当前默认仍是example。工厂仅验证包/返回空状态模块，不提供玩法钩子。当前实际门禁结果及尚未接线的运行能力以1a0报告为准。

## 2. 固定技术合同与可调数据

固定A：D02确定致死来源、D04有界环境/持续伤害因果、D16经典隔离和窄纯端口、D17嵌套生成事务、D18安全点可达性回收、D19每命令完整checkpoint、D20最后有效状态施加者、D22首世界动作前create-character命令。这些不能靠改JSON关闭。

其余玩法数值/开关是数据：XP来源和报价、盟友分配、等级上限/曲线/逐级发点、自动生命/回复、属性目录与公式、训练力量、洗点及代价、装配槽位/学习限制、专注/冷却、原物品收益上限或折算、身份/誓约、怪物组件与深度模板。更改这些数据仍须通过范围、预算、引用、纯JSON和精确版本校验；不代表允许绕过有限端口写入任意世界字段。

版本负责确定性兼容，不承担旧档迁移。经典输入仍无growth配置/快照键，不能为了让所有包统一加载而给经典局增加模块初始化或策略工作。

## 3. 类型和取值约定

- integer字段须有限且为安全整数；number字段可用有限小数并服从各自范围；NaN、Infinity不合法，整数输入不自动四舍五入
- `null`只在字段明确允许时使用；省略字段与null不是等价默认。数组/对象必须符合schema，未知键、原型键、循环/非JSON值被拒绝
- 稳定ID用于引用/录像；nameKey/descriptionKey用于本地化，不能拿显示名做身份或效果判定
- bp为基点，10000bp=1倍、100bp=1个百分点；负修正与增益经过相同预算/钳制顺序
- “默认样例”指仓库 `definitions.json` 中实际保存值，不是加载器替缺失字段补值。表里的数组样例可能展示第一个元素；完整默认列表始终以该JSON为准
- 结构校验先于交叉引用/循环前置/预算/版本校验；校验与导入纯同步，不取RNG、不写世界、不运行效果

## 4. 完整字段目录

以下目录按实际 `getGrowthSchema()` 生成/核对。相同的判别联合叶子按变体列出；`[]`表示数组元素，`{kind=…}`表示判别联合变体。每个字段标出类型/范围、当前样例、校验和运行实现责任；schema本身均由1a0拥有，后续步骤新增或改变字段时必须同步更新本节。

`MAX`为9007199254740991；每个对象的列出键均必填，未知键拒绝。表中`number`允许有限小数，`integer`只允许安全整数。共享类型的每个使用处都继承该节完整结构；所有结构校验归1a0，最后一列是运行时实现责任。样例列从实际JSON取值，重复元素仅展示不同值的前几个，不是新增默认填充机制。

### 4.1 包标识

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a0 |
| `$.schema` | 枚举 `1` | `1` | 1a0 |
| `$.moduleId` | 枚举 `"growth"` | `"growth"` | 1a0 |
| `$.moduleVersion` | 三段非负整数版本，禁止多余前导0 | `"1.0.0"` | 1a0 |
| `$.rulesVersion` | 三段非负整数版本，禁止多余前导0 | `"1.0.0"` | 1a0 |
| `$.config` | object；全部配置子组必填，见以下各节 | 对象 | 1a–1e |
| `$.definitions` | array；元素为Skill或Identity，完整结构见对应节 | 24项：12技能/4职业/4血统/4信仰 | 1d/1e |

### 4.2 config.experience

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.experience` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.sources` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.sources.kills` | boolean | `true` | 1a |
| `$.config.experience.sources.firstVisits` | boolean | `true` | 1a |
| `$.config.experience.sources.identification` | boolean | `true` | 1a |
| `$.config.experience.sources.story` | boolean | `false` | 1a |
| `$.config.experience.kills` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.kills.base` | 安全整数 [0,MAX] | `6` | 1a |
| `$.config.experience.kills.perThreatRank` | 安全整数 [0,MAX] | `2` | 1a |
| `$.config.experience.kills.threatRank` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.kills.threatRank.min` | 安全整数 [0,MAX] | `1` | 1a |
| `$.config.experience.kills.threatRank.max` | 安全整数 [0,MAX] | `20` | 1a |
| `$.config.experience.kills.eligibleCreationReasons` | array，长度≥0；元素唯一 | 样例长度1；见元素字段 | 1a |
| `$.config.experience.kills.eligibleCreationReasons[]` | 枚举 `"natural"`,`"summoned"`,`"split"`,`"clone"`,`"periodic"`,`"scripted"`,`"test"` | `"natural"` | 1a |
| `$.config.experience.kills.requireInitiallyHostile` | boolean | `true` | 1a |
| `$.config.experience.kills.requireHostileAtDeath` | boolean | `true` | 1a |
| `$.config.experience.kills.monsterQuotes` | array，长度≥0 | 样例长度67；见元素字段 | 1a |
| `$.config.experience.kills.monsterQuotes[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.kills.monsterQuotes[].monsterId` | 外部ID（字母起始；字母/数字/_.:-） | `"rat" / "kobold" / "jackal" / "eel" …` | 1a |
| `$.config.experience.kills.monsterQuotes[].threatRank` | 安全整数 [0,MAX] | `1 / 2 / 5 / 3 …` | 1a |
| `$.config.experience.kills.monsterQuotes[].amount` | 可为null；否则 安全整数 [0,MAX] | `null` | 1a |
| `$.config.experience.firstVisits` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.firstVisits.minDepth` | 安全整数 [1,MAX] | `2` | 1a |
| `$.config.experience.firstVisits.maxDepth` | 安全整数 [1,MAX] | `26` | 1a |
| `$.config.experience.firstVisits.base` | 安全整数 [0,MAX] | `20` | 1a |
| `$.config.experience.firstVisits.perDepth` | 安全整数 [0,MAX] | `5` | 1a |
| `$.config.experience.firstVisits.cap` | 可为null；否则 安全整数 [0,MAX] | `null` | 1a |
| `$.config.experience.identification` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.identification.perKind` | 安全整数 [0,MAX] | `10` | 1a |
| `$.config.experience.identification.totalCap` | 安全整数 [0,MAX] | `300` | 1a |
| `$.config.experience.identification.categories` | array，长度≥0；元素唯一 | 样例长度6；见元素字段 | 1a |
| `$.config.experience.identification.categories[]` | 外部ID（字母起始；字母/数字/_.:-） | `"potion" / "scroll" / "wand" / "staff" …` | 1a |
| `$.config.experience.story` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.story.rewards` | array，长度≥0 | `[]` | 1a |
| `$.config.experience.story.rewards[]` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1a |
| `$.config.experience.story.rewards[].id` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1a |
| `$.config.experience.story.rewards[].amount` | 安全整数 [0,MAX] | 样例未选此变体/无元素 | 1a |
| `$.config.experience.story.rewards[].reasonKey` | 本地化键 `ext.growth.*`，且词条必须存在 | 样例未选此变体/无元素 | 1a |
| `$.config.experience.allySplit` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.experience.allySplit.playerBasisPoints` | 安全整数 [0,10000] | `8000` | 1a |
| `$.config.experience.allySplit.remainder` | 枚举 `"credited-actor"` | `"credited-actor"` | 1a |
| `$.config.experience.allySplit.rounding` | 枚举 `"floor"`,`"ceil"`,`"nearest"`,`"truncate"` | `"floor"` | 1a |

### 4.3 config.levels

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.levels` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.levels.cap` | 安全整数 [1,MAX] | `20` | 1a |
| `$.config.levels.experience` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1a |
| `$.config.levels.experience{kind=table}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1a |
| `$.config.levels.experience{kind=table}.kind` | 枚举 `"table"` | 样例未选此变体/无元素 | 1a |
| `$.config.levels.experience{kind=table}.cumulative` | array，长度≥1 | 样例未选此变体/无元素 | 1a |
| `$.config.levels.experience{kind=table}.cumulative[]` | 安全整数 [0,MAX] | 样例未选此变体/无元素 | 1a |
| `$.config.levels.experience{kind=curve}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.levels.experience{kind=curve}.kind` | 枚举 `"curve"` | `"curve"` | 1a |
| `$.config.levels.experience{kind=curve}.base` | 安全整数 [0,MAX] | `40` | 1a |
| `$.config.levels.experience{kind=curve}.linear` | 安全整数 [0,MAX] | `20` | 1a |
| `$.config.levels.experience{kind=curve}.quadratic` | 安全整数 [0,MAX] | `4` | 1a |
| `$.config.levels.attributePoints` | `Schedule`；完整结构见共用类型 | 对象；见子字段 | 1a |
| `$.config.levels.skillPoints` | `Schedule`；完整结构见共用类型 | 对象；见子字段 | 1a |
| `$.config.levels.maxHp` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.levels.maxHp.grants` | `Schedule`；完整结构见共用类型 | 对象；见子字段 | 1a |
| `$.config.levels.maxHp.cap` | 安全整数 [0,MAX] | `10` | 1a |
| `$.config.levels.recovery` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `$.config.levels.recovery.levelHp` | 枚举 `"none"`,`"increase"`,`"full"` | `"none"` | 1a |
| `$.config.levels.recovery.allocationHp` | 枚举 `"none"`,`"increase"`,`"full"` | `"none"` | 1a |
| `$.config.levels.recovery.levelFocus` | 枚举 `"none"`,`"increase"`,`"full"` | `"none"` | 1a |
| `$.config.levels.recovery.allocationFocus` | 枚举 `"none"`,`"increase"`,`"full"` | `"none"` | 1a |
| `$.config.levels.recovery.clearCooldownOnLevel` | boolean | `false` | 1a |
| `$.config.levels.recovery.clearCooldownOnAllocation` | boolean | `false` | 1a |
| `$.config.levels.recovery.creationHp` | 枚举 `"native"`,`"full"` | `"full"` | 1a |

### 4.4 config.attributes

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.attributes` | array，长度≥0 | 样例长度5；见元素字段 | 1b |
| `$.config.attributes[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.attributes[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.strength-training" / "growth.attribute.agility" / "growth.attribute.constitution" / "growth.… …` | 1b |
| `$.config.attributes[].nameKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.attribute.strength-training.name" / "ext.growth.attribute.agility.name" / "ext.growth.attribute.co… …` | 1b |
| `$.config.attributes[].descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.attribute.strength-training.description" / "ext.growth.attribute.agility.description" / "ext.growt… …` | 1b |
| `$.config.attributes[].min` | 安全整数 [0,MAX] | `0` | 1b |
| `$.config.attributes[].cap` | 安全整数 [0,MAX] | `4 / 8` | 1b |
| `$.config.attributes[].initial` | 安全整数 [0,MAX] | `0` | 1b |
| `$.config.attributes[].pointCost` | 安全整数 [1,MAX] | `3 / 1` | 1b |
| `$.config.attributes[].effects` | array，长度≥0 | 样例长度1；见元素字段 | 1b |
| `$.config.attributes[].effects[]` | `Modifier`；完整结构见共用类型 | 对象；见子字段 | 1b |

### 4.5 config.attributeTotalCap

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.attributeTotalCap` | 可为null；否则 安全整数 [0,MAX] | `36` | 1b |

### 4.6 config.strengthTraining

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.strengthTraining` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.strengthTraining.enabled` | boolean | `true` | 1b |
| `$.config.strengthTraining.attributeId` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.strength-training"` | 1b |
| `$.config.strengthTraining.pointCost` | 安全整数 [1,MAX] | `3` | 1b |
| `$.config.strengthTraining.cap` | 安全整数 [0,MAX] | `4` | 1b |

### 4.7 config.respec

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.respec` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.respec.enabled` | boolean | `false` | 1b |
| `$.config.respec.cost` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.respec.cost.resource` | 枚举 `"gold"`,`"attribute-points"`,`"skill-points"`,`"focus"` | `"gold"` | 1b |
| `$.config.respec.cost.amount` | 安全整数 [0,MAX] | `0` | 1b |
| `$.config.respec.refundBasisPoints` | 安全整数 [0,10000] | `10000` | 1b |
| `$.config.respec.clearCooldowns` | boolean | `false` | 1b |

### 4.8 config.skills

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.skills` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `$.config.skills.activeSlots` | 安全整数 [0,MAX] | `3` | 1d |
| `$.config.skills.passiveSlots` | 安全整数 [0,MAX] | `3` | 1d |
| `$.config.skills.equipTime` | 枚举 `"native-wait"`,`"none"` | `"native-wait"` | 1d |
| `$.config.skills.lockMode` | 枚举 `"none"`,`"soft"`,`"hard"` | `"soft"` | 1d |
| `$.config.skills.prerequisites` | 枚举 `"all"` | `"all"` | 1d |
| `$.config.skills.equipPreservesCooldowns` | boolean | `true` | 1d |
| `$.config.skills.equipPreservesFocus` | boolean | `true` | 1d |

### 4.9 config.focus

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.focus` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a状态/1b数值/1d时钟 |
| `$.config.focus.base` | 安全整数 [0,MAX] | `8` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.min` | 安全整数 [0,MAX] | `0` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.cap` | 安全整数 [0,MAX] | `13` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.recoveryAmount` | 安全整数 [0,MAX] | `1` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.recoveryInterval` | 安全整数 [1,MAX] | `8` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.objectiveTicksPerBlock` | 安全整数 [1,MAX] | `100` | 1a状态/1b数值/1d时钟 |
| `$.config.focus.resetRemainderWhenFull` | boolean | `true` | 1a状态/1b数值/1d时钟 |

### 4.10 config.rules

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.rules` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.budgets` | array，长度≥1 | 样例长度12；见元素字段 | 1b |
| `$.config.rules.budgets[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.budgets[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.budget.hitchance" / "growth.budget.physical" / "growth.budget.stealthrange" / "growth.budget.searchstr… …` | 1b |
| `$.config.rules.budgets[].min` | 有限实数 [−MAX,MAX] | `-10000 / -2500 / -9007199254740991 / 0 …` | 1b |
| `$.config.rules.budgets[].max` | 有限实数 [−MAX,MAX] | `10000 / 2000 / 9007199254740991 / 40 …` | 1b |
| `$.config.rules.ports` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.ports.hitChance` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.physicalDamage` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.receivedPhysicalDamage` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.stealthRange` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.searchStrength` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.strengthBonus` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.maxHpBonus` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.focusCapacity` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.focusRecoveryInterval` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.ports.cooldownDuration` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.taggedProperties` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.taggedProperties.duration` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.taggedProperties.intensity` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.taggedProperties.cooldown` | `RulePort`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `$.config.rules.order` | array，长度≥4且≤4；元素唯一 | 样例长度4；见元素字段 | 1b |
| `$.config.rules.order[]` | 枚举 `"add"`,`"multiply"`,`"global-clamp"`,`"round"` | `"add" / "multiply" / "global-clamp" / "round"` | 1b |
| `$.config.rules.hitPrecedence` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.rules.hitPrecedence.guaranteedHit` | 枚举 `"preserve"` | `"preserve"` | 1b |
| `$.config.rules.hitPrecedence.guaranteedMiss` | 枚举 `"preserve"` | `"preserve"` | 1b |
| `$.config.rules.hitPrecedence.guaranteedRoll` | 枚举 `"preserve-roll"` | `"preserve-roll"` | 1b |

### 4.11 config.identities

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.identities` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.enabled` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.enabled.professions` | boolean | `true` | 1e |
| `$.config.identities.enabled.lineages` | boolean | `true` | 1e |
| `$.config.identities.enabled.faiths` | boolean | `true` | 1e |
| `$.config.identities.defaults` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.defaults.professionId` | 稳定ID（小写；`.`/`-`分段） | `"growth.profession.guardian"` | 1e |
| `$.config.identities.defaults.lineageId` | 稳定ID（小写；`.`/`-`分段） | `"growth.lineage.human"` | 1e |
| `$.config.identities.defaults.faithId` | 稳定ID（小写；`.`/`-`分段） | `"growth.faith.unaffiliated"` | 1e |
| `$.config.identities.budgets` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.budgets.profession` | 安全整数 [0,MAX] | `2` | 1e |
| `$.config.identities.budgets.lineage` | 安全整数 [0,MAX] | `1` | 1e |
| `$.config.identities.budgets.faith` | 安全整数 [0,MAX] | `0` | 1e |
| `$.config.identities.giftLimits` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.identities.giftLimits.active` | 安全整数 [0,MAX] | `1` | 1e |
| `$.config.identities.giftLimits.passive` | 安全整数 [0,MAX] | `1` | 1e |
| `$.config.identities.changeFaith` | boolean | `false` | 1e |

### 4.12 config.itemGrowth

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.itemGrowth` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.itemGrowth.rules` | array，长度≥0 | 样例长度3；见元素字段 | 1b |
| `$.config.itemGrowth.rules[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `$.config.itemGrowth.rules[].itemId` | 外部ID（字母起始；字母/数字/_.:-） | `"potion_of_strength" / "potion_of_life" / "scroll_of_enchantment"` | 1b |
| `$.config.itemGrowth.rules[].nativeEffect` | 枚举 `"preserve"`,`"replace"` | `"preserve"` | 1b |
| `$.config.itemGrowth.rules[].destination` | 枚举 `"strengthBonus"`,`"maxHpBonus"`,`"attribute-points"`,`"skill-points"`,`"enchantment"` | `"strengthBonus" / "maxHpBonus" / "enchantment"` | 1b |
| `$.config.itemGrowth.rules[].conversion` | 有限实数 [0,MAX] | `1` | 1b |
| `$.config.itemGrowth.rules[].perItemCap` | 可为null；否则 有限实数 [0,MAX] | `null` | 1b |
| `$.config.itemGrowth.rules[].runCap` | 可为null；否则 有限实数 [0,MAX] | `null` | 1b |

### 4.13 config.monsters

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `$.config.monsters` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.monsters.enabled` | boolean | `true` | 1e |
| `$.config.monsters.defaultTemplateId` | 稳定ID（小写；`.`/`-`分段） | `"growth.template.neutral"` | 1e |
| `$.config.monsters.alliesGrow` | boolean | `true` | 1e |
| `$.config.monsters.clone` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.monsters.clone.inheritBuild` | boolean | `true` | 1e |
| `$.config.monsters.clone.inheritUnspentPoints` | boolean | `false` | 1e |
| `$.config.monsters.clone.rewards` | boolean | `false` | 1e |
| `$.config.monsters.clone.progression` | boolean | `false` | 1e |
| `$.config.monsters.templates` | array，长度≥1 | 样例长度1；见元素字段 | 1e |
| `$.config.monsters.templates[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `$.config.monsters.templates[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.template.neutral"` | 1e |
| `$.config.monsters.templates[].nameKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.template.neutral.name"` | 1e |
| `$.config.monsters.templates[].descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.template.neutral.description"` | 1e |
| `$.config.monsters.templates[].level` | 安全整数 [1,MAX] | `1` | 1e |
| `$.config.monsters.templates[].experience` | 安全整数 [0,MAX] | `0` | 1e |
| `$.config.monsters.templates[].attributes` | array，长度≥0 | `[]` | 1e |
| `$.config.monsters.templates[].attributes[]` | `AttributeGrant`；完整结构见共用类型 | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.templates[].professionId` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1e |
| `$.config.monsters.templates[].lineageId` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1e |
| `$.config.monsters.templates[].faithId` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1e |
| `$.config.monsters.templates[].skills` | array，长度≥0；元素唯一 | `[]` | 1e |
| `$.config.monsters.templates[].skills[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.templates[].activeSlots` | array，长度≥0；元素唯一 | `[]` | 1e |
| `$.config.monsters.templates[].activeSlots[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.templates[].passiveSlots` | array，长度≥0；元素唯一 | `[]` | 1e |
| `$.config.monsters.templates[].passiveSlots[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.templates[].unspentAttributePoints` | 安全整数 [0,MAX] | `0` | 1e |
| `$.config.monsters.templates[].unspentSkillPoints` | 安全整数 [0,MAX] | `0` | 1e |
| `$.config.monsters.depthTemplates` | array，长度≥0 | `[]` | 1e |
| `$.config.monsters.depthTemplates[]` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.depthTemplates[].minDepth` | 安全整数 [1,MAX] | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.depthTemplates[].maxDepth` | 安全整数 [1,MAX] | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.depthTemplates[].templateId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1e |
| `$.config.monsters.depthTemplates[].priority` | 安全整数 [0,MAX] | 样例未选此变体/无元素 | 1e |

### 4.14 技能定义

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Skill` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.id` | 稳定ID（小写；`.`/`-`分段） | `"growth.skill.steady-hand" / "growth.skill.close-guard" / "growth.skill.careful-step" / "growth.skill.methodic… …` | 1b求值/1d |
| `Skill.nameKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.skill.steady-hand.name" / "ext.growth.skill.close-guard.name" / "ext.growth.skill.careful-step.nam… …` | 1b求值/1d |
| `Skill.descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.skill.steady-hand.description" / "ext.growth.skill.close-guard.description" / "ext.growth.skill.ca… …` | 1b求值/1d |
| `Skill.kind` | 枚举 `"skill"` | `"skill"` | 1b求值/1d |
| `Skill.mode` | 枚举 `"active"`,`"passive"` | `"passive" / "active"` | 1b求值/1d |
| `Skill.tags` | array，长度≥0；元素唯一 | 样例长度1；见元素字段 | 1b求值/1d |
| `Skill.tags[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.tag.steady-hand" / "growth.tag.close-guard" / "growth.tag.careful-step" / "growth.tag.methodical" …` | 1b求值/1d |
| `Skill.cost` | 安全整数 [0,MAX] | `1 / 2` | 1b求值/1d |
| `Skill.prerequisites` | array，长度≥0；元素唯一 | 样例长度1；见元素字段 | 1b求值/1d |
| `Skill.prerequisites[]` | `Prerequisite`；完整结构见共用类型 | 对象；见子字段 | 1b求值/1d |
| `Skill.lock` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.lock.mode` | 枚举 `"none"`,`"soft"`,`"hard"` | `"none"` | 1b求值/1d |
| `Skill.lock.professionIds` | array，长度≥0；元素唯一 | `[]` | 1b求值/1d |
| `Skill.lock.professionIds[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1b求值/1d |
| `Skill.lock.lineageIds` | array，长度≥0；元素唯一 | `[]` | 1b求值/1d |
| `Skill.lock.lineageIds[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1b求值/1d |
| `Skill.lock.faithIds` | array，长度≥0；元素唯一 | `[]` | 1b求值/1d |
| `Skill.lock.faithIds[]` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1b求值/1d |
| `Skill.focusCost` | 安全整数 [0,MAX] | `0 / 2 / 3` | 1b求值/1d |
| `Skill.cooldown` | 安全整数 [0,MAX] | `0 / 6 / 10 / 8` | 1b求值/1d |
| `Skill.action` | 可为null；否则 `Action` | `null / {"kind":"attack","target":"adjacent-creature","attackKind":"melee","time":"native-attack"} / {"kind":"w… …` | 1b求值/1d |
| `Skill.action{非null}` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=attack}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=attack}.kind` | 枚举 `"attack"` | `"attack"` | 1b求值/1d |
| `Skill.action{非null}{kind=attack}.target` | 枚举 `"adjacent-creature"` | `"adjacent-creature"` | 1b求值/1d |
| `Skill.action{非null}{kind=attack}.attackKind` | 枚举 `"melee"` | `"melee"` | 1b求值/1d |
| `Skill.action{非null}{kind=attack}.time` | 枚举 `"native-attack"` | `"native-attack"` | 1b求值/1d |
| `Skill.action{非null}{kind=move}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=move}.kind` | 枚举 `"move"` | `"move"` | 1b求值/1d |
| `Skill.action{非null}{kind=move}.target` | 枚举 `"adjacent-cell"` | `"adjacent-cell"` | 1b求值/1d |
| `Skill.action{非null}{kind=move}.occupied` | 枚举 `"reject"` | `"reject"` | 1b求值/1d |
| `Skill.action{非null}{kind=move}.time` | 枚举 `"native-move"` | `"native-move"` | 1b求值/1d |
| `Skill.action{非null}{kind=wait}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=wait}.kind` | 枚举 `"wait"` | `"wait"` | 1b求值/1d |
| `Skill.action{非null}{kind=wait}.target` | 枚举 `"self"` | `"self"` | 1b求值/1d |
| `Skill.action{非null}{kind=wait}.time` | 枚举 `"native-wait"` | `"native-wait"` | 1b求值/1d |
| `Skill.action{非null}{kind=search}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d |
| `Skill.action{非null}{kind=search}.kind` | 枚举 `"search"` | `"search"` | 1b求值/1d |
| `Skill.action{非null}{kind=search}.target` | 枚举 `"self"` | `"self"` | 1b求值/1d |
| `Skill.action{非null}{kind=search}.mode` | 枚举 `"manual"` | `"manual"` | 1b求值/1d |
| `Skill.action{非null}{kind=search}.time` | 枚举 `"native-search"` | `"native-search"` | 1b求值/1d |
| `Skill.effects` | array，长度≥0 | 样例长度1；见元素字段 | 1b求值/1d |
| `Skill.effects[]` | `Effect`；完整结构见共用类型 | 对象；见子字段 | 1b求值/1d |

### 4.15 身份定义

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Identity` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `Identity.id` | 稳定ID（小写；`.`/`-`分段） | `"growth.profession.guardian" / "growth.profession.scout" / "growth.profession.explorer" / "growth.profession.s… …` | 1e |
| `Identity.nameKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.profession.guardian.name" / "ext.growth.profession.scout.name" / "ext.growth.profession.explorer.n… …` | 1e |
| `Identity.descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.profession.guardian.description" / "ext.growth.profession.scout.description" / "ext.growth.profess… …` | 1e |
| `Identity.kind` | 枚举 `"profession"`,`"lineage"`,`"faith"` | `"profession" / "lineage" / "faith"` | 1e |
| `Identity.attributes` | array，长度≥0 | 样例长度1；见元素字段 | 1e |
| `Identity.attributes[]` | `AttributeGrant`；完整结构见共用类型 | 对象；见子字段 | 1e |
| `Identity.choices` | array，长度≥0 | 样例长度1；见元素字段 | 1e |
| `Identity.choices[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `Identity.choices[].attributeIds` | array，长度≥1；元素唯一 | 样例长度4；见元素字段 | 1e |
| `Identity.choices[].attributeIds[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.agility" / "growth.attribute.constitution" / "growth.attribute.will" / "growth.attribute.per…` | 1e |
| `Identity.choices[].points` | 安全整数 [1,MAX] | `1` | 1e |
| `Identity.choices[].perAttributeCap` | 安全整数 [1,MAX] | `1` | 1e |
| `Identity.gifts` | array，长度≥0 | 样例长度2；见元素字段 | 1e |
| `Identity.gifts[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `Identity.gifts[].skillId` | 稳定ID（小写；`.`/`-`分段） | `"growth.skill.close-guard" / "growth.skill.brace" / "growth.skill.careful-step" / "growth.skill.hold-breath" …` | 1b求值/1d |
| `Identity.gifts[].waivePrerequisites` | boolean | `true` | 1e |
| `Identity.effects` | array，长度≥0 | 样例长度1；见元素字段 | 1e |
| `Identity.effects[]` | `Effect`；完整结构见共用类型 | 对象；见子字段 | 1e |
| `Identity.oaths` | array，长度≥0 | 样例长度1；见元素字段 | 1e |
| `Identity.oaths[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e |
| `Identity.oaths[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.oath.watch" / "growth.oath.path" / "growth.oath.restraint"` | 1e |
| `Identity.oaths[].descriptionKey` | 本地化键 `ext.growth.*`，且词条必须存在 | `"ext.growth.oath.watch.description" / "ext.growth.oath.path.description" / "ext.growth.oath.restraint.descript…` | 1e |
| `Identity.oaths[].effects` | array，长度≥0 | 样例长度2；见元素字段 | 1e |
| `Identity.oaths[].effects[]` | `Effect`；完整结构见共用类型 | 对象；见子字段 | 1e |
| `Identity.recommendedAttributes` | array，长度≥0；元素唯一 | 样例长度4；见元素字段 | 1e |
| `Identity.recommendedAttributes[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.constitution" / "growth.attribute.agility" / "growth.attribute.will" / "growth.attribute.per…` | 1e |
| `Identity.recommendedSkills` | array，长度≥0；元素唯一 | 样例长度2；见元素字段 | 1b求值/1d |
| `Identity.recommendedSkills[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.skill.close-guard" / "growth.skill.brace" / "growth.skill.careful-step" / "growth.skill.hold-breath" …` | 1b求值/1d |

### 4.16 共用 Magnitude

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Magnitude` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Magnitude.source` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b；效果提交1d |
| `Magnitude.source{kind=constant}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Magnitude.source{kind=constant}.kind` | 枚举 `"constant"` | `"constant"` | 1b；效果提交1d |
| `Magnitude.source{kind=attribute}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Magnitude.source{kind=attribute}.kind` | 枚举 `"attribute"` | `"attribute"` | 1b；效果提交1d |
| `Magnitude.source{kind=attribute}.attributeId` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.strength-training" / "growth.attribute.agility" / "growth.attribute.constitution" / "growth.… …` | 1b；效果提交1d |
| `Magnitude.source{kind=level}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1b；效果提交1d |
| `Magnitude.source{kind=level}.kind` | 枚举 `"level"` | 样例未选此变体/无元素 | 1b；效果提交1d |
| `Magnitude.coefficient` | 有限实数 [−MAX,MAX] | `1 / 100 / -50 / -1 …` | 1b；效果提交1d |
| `Magnitude.divisor` | 有限实数 (0,MAX] | `1 / 3 / 2 / 4` | 1b；效果提交1d |
| `Magnitude.rounding` | 枚举 `"floor"`,`"ceil"`,`"nearest"`,`"truncate"` | `"floor" / "ceil"` | 1b；效果提交1d |
| `Magnitude.min` | 有限实数 [−MAX,MAX] | `0 / -400 / -2 / 500 …` | 1b；效果提交1d |
| `Magnitude.max` | 有限实数 [−MAX,MAX] | `4 / 800 / 0 / 24 …` | 1b；效果提交1d |

### 4.17 共用 Condition

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Condition` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=attack-kind}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=attack-kind}.kind` | 枚举 `"attack-kind"` | `"attack-kind"` | 1b；效果提交1d |
| `Condition{kind=attack-kind}.values` | array，长度≥1；元素唯一 | 样例长度2；见元素字段 | 1b；效果提交1d |
| `Condition{kind=attack-kind}.values[]` | 枚举 `"melee"`,`"thrown"`,`"bolt"`,`"reprisal"`,`"other"` | `"melee" / "thrown"` | 1b；效果提交1d |
| `Condition{kind=damage-kind}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=damage-kind}.kind` | 枚举 `"damage-kind"` | `"damage-kind"` | 1b；效果提交1d |
| `Condition{kind=damage-kind}.values` | array，长度≥1；元素唯一 | 样例长度1；见元素字段 | 1b；效果提交1d |
| `Condition{kind=damage-kind}.values[]` | 枚举 `"physical"`,`"fire"`,`"poison"`,`"other"` | `"physical"` | 1b；效果提交1d |
| `Condition{kind=role}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=role}.kind` | 枚举 `"role"` | `"role"` | 1b；效果提交1d |
| `Condition{kind=role}.value` | 枚举 `"actor"`,`"target"` | `"actor" / "target"` | 1b；效果提交1d |
| `Condition{kind=search-mode}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=search-mode}.kind` | 枚举 `"search-mode"` | `"search-mode"` | 1b；效果提交1d |
| `Condition{kind=search-mode}.value` | 枚举 `"manual"`,`"automatic"` | `"manual"` | 1b；效果提交1d |
| `Condition{kind=adjacent,probability-roll,hit,positive-hp-damage,direct-damage}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=adjacent,probability-roll,hit,positive-hp-damage,direct-damage}.kind` | 枚举 `"adjacent"`,`"probability-roll"`,`"hit"`,`"positive-hp-damage"`,`"direct-damage"` | `"probability-roll" / "adjacent" / "hit" / "positive-hp-damage" …` | 1b；效果提交1d |
| `Condition{kind=adjacent,probability-roll,hit,positive-hp-damage,direct-damage}.value` | boolean | `true` | 1b；效果提交1d |
| `Condition{kind=tag}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Condition{kind=tag}.kind` | 枚举 `"tag"` | `"tag"` | 1b；效果提交1d |
| `Condition{kind=tag}.tag` | 稳定ID（小写；`.`/`-`分段） | `"growth.tag.survey"` | 1b；效果提交1d |

### 4.18 共用 Effect

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Effect` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Effect{kind=modifier}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b |
| `Effect{kind=modifier}.kind` | 枚举 `"modifier"` | `"modifier"` | 1b |
| `Effect{kind=modifier}.port` | 枚举 `"hitChance"`,`"physicalDamage"`,`"receivedPhysicalDamage"`,`"stealthRange"`,`"searchStrength"`,`"strengthBonus"`,`"maxHpBonus"`,`"focusCapacity"`,`"focusRecoveryInterval"`,`"cooldownDuration"` | `"strengthBonus" / "hitChance" / "stealthRange" / "maxHpBonus" …` | 1b |
| `Effect{kind=modifier}.operation` | 枚举 `"add"`,`"multiply"` | `"add"` | 1b |
| `Effect{kind=modifier}.slot` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1b |
| `Effect{kind=modifier}.magnitude` | `Magnitude`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `Effect{kind=modifier}.conditions` | array，长度≥0；元素唯一 | 样例长度4；见元素字段 | 1b |
| `Effect{kind=modifier}.conditions[]` | `Condition`；完整结构见共用类型 | 对象；见子字段 | 1b |
| `Effect{kind=tagged-modifier}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.kind` | 枚举 `"tagged-modifier"` | `"tagged-modifier"` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.tag` | 稳定ID（小写；`.`/`-`分段） | `"growth.tag.brace" / "growth.tag.hold-breath"` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.property` | 枚举 `"duration"`,`"intensity"`,`"cooldown"` | `"duration" / "intensity" / "cooldown"` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.operation` | 枚举 `"add"`,`"multiply"` | `"add"` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.slot` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.magnitude` | `Magnitude`；完整结构见共用类型 | 对象；见子字段 | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.conditions` | array，长度≥0；元素唯一 | `[]` | 1d通用/1e身份 |
| `Effect{kind=tagged-modifier}.conditions[]` | `Condition`；完整结构见共用类型 | 样例未选此变体/无元素 | 1d通用/1e身份 |
| `Effect{kind=timed}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.kind` | 枚举 `"timed"` | `"timed"` | 1d |
| `Effect{kind=timed}.id` | 稳定ID（小写；`.`/`-`分段） | `"growth.effect.measured-strike" / "growth.effect.brace" / "growth.effect.withdraw" / "growth.effect.hold-breat… …` | 1d |
| `Effect{kind=timed}.tags` | array，长度≥0；元素唯一 | 样例长度1；见元素字段 | 1d |
| `Effect{kind=timed}.tags[]` | 稳定ID（小写；`.`/`-`分段） | `"growth.tag.measured-strike" / "growth.tag.brace" / "growth.tag.withdraw" / "growth.tag.hold-breath" …` | 1d |
| `Effect{kind=timed}.recipient` | 枚举 `"self"`,`"target"` | `"self" / "target"` | 1d |
| `Effect{kind=timed}.application` | 枚举 `"action-start"`,`"action-result"` | `"action-start" / "action-result"` | 1d |
| `Effect{kind=timed}.conditions` | array，长度≥0；元素唯一 | 样例长度2；见元素字段 | 1d |
| `Effect{kind=timed}.conditions[]` | `Condition`；完整结构见共用类型 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.duration` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1d |
| `Effect{kind=timed}.duration{kind=action}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.duration{kind=action}.kind` | 枚举 `"action"` | `"action"` | 1d |
| `Effect{kind=timed}.duration{kind=objective-blocks}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.duration{kind=objective-blocks}.kind` | 枚举 `"objective-blocks"` | `"objective-blocks"` | 1d |
| `Effect{kind=timed}.duration{kind=objective-blocks}.blocks` | 安全整数 [1,MAX] | `2 / 1 / 3` | 1d |
| `Effect{kind=timed}.duration{kind=objective-blocks}.cap` | 安全整数 [1,MAX] | `3 / 1 / 4 / 2` | 1d |
| `Effect{kind=timed}.modifiers` | array，长度≥1 | 样例长度2；见元素字段 | 1d |
| `Effect{kind=timed}.modifiers[]` | `Modifier`；完整结构见共用类型 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.consume` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d |
| `Effect{kind=timed}.consume.event` | 枚举 `"none"`,`"positive-direct-physical"`,`"physical-probability-roll"` | `"none" / "positive-direct-physical" / "physical-probability-roll"` | 1d |
| `Effect{kind=timed}.consume.count` | 安全整数 [0,MAX] | `0 / 1` | 1d |
| `Effect{kind=timed}.consume.phase` | 枚举 `"per-resolution-commit"` | `"per-resolution-commit"` | 1d |
| `Effect{kind=timed}.consume.includesShieldAbsorbed` | boolean | `false / true` | 1d |
| `Effect{kind=timed}.interruptions` | array，长度≥0；元素唯一 | 样例长度3；见元素字段 | 1d |
| `Effect{kind=timed}.interruptions[]` | 枚举 `"attack"`,`"projectile"`,`"cast"`,`"move"`,`"search"`,`"wait"` | `"attack" / "projectile" / "cast"` | 1d |
| `Effect{kind=resource}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a提交基础/1e触发 |
| `Effect{kind=resource}.kind` | 枚举 `"resource"` | `"resource"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.id` | 稳定ID（小写；`.`/`-`分段） | `"growth.effect.path-focus"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.resource` | 枚举 `"focus"`,`"hp"` | `"focus"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.amount` | 安全整数 [−MAX,MAX] | `1` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger.kind` | 枚举 `"first-visit"` | `"first-visit"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger.minDepth` | 安全整数 [1,MAX] | `2` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger.maxDepth` | 安全整数 [1,MAX] | `26` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.trigger.receipt` | 枚举 `"depth"` | `"depth"` | 1a提交基础/1e触发 |
| `Effect{kind=resource}.clamp` | 枚举 `"resource-bounds"` | `"resource-bounds"` | 1a提交基础/1e触发 |

### 4.19 共用 Modifier

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Modifier` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `Modifier.kind` | 枚举 `"modifier"` | `"modifier"` | 1b；效果提交1d |
| `Modifier.port` | 枚举 `"hitChance"`,`"physicalDamage"`,`"receivedPhysicalDamage"`,`"stealthRange"`,`"searchStrength"`,`"strengthBonus"`,`"maxHpBonus"`,`"focusCapacity"`,`"focusRecoveryInterval"`,`"cooldownDuration"` | `"strengthBonus" / "hitChance" / "stealthRange" / "maxHpBonus" …` | 1b；效果提交1d |
| `Modifier.operation` | 枚举 `"add"`,`"multiply"` | `"add"` | 1b；效果提交1d |
| `Modifier.slot` | 可为null；否则 稳定ID（小写；`.`/`-`分段） | `null` | 1b；效果提交1d |
| `Modifier.magnitude` | `Magnitude`；完整结构见共用类型 | 对象；见子字段 | 1b；效果提交1d |
| `Modifier.conditions` | array，长度≥0；元素唯一 | 样例长度4；见元素字段 | 1b；效果提交1d |
| `Modifier.conditions[]` | `Condition`；完整结构见共用类型 | 对象；见子字段 | 1b；效果提交1d |

### 4.20 共用 Prerequisite

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Prerequisite` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1d/1e |
| `Prerequisite{kind=level}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d/1e |
| `Prerequisite{kind=level}.kind` | 枚举 `"level"` | `"level"` | 1d/1e |
| `Prerequisite{kind=level}.min` | 安全整数 [1,MAX] | `4` | 1d/1e |
| `Prerequisite{kind=attribute}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1d/1e |
| `Prerequisite{kind=attribute}.kind` | 枚举 `"attribute"` | `"attribute"` | 1d/1e |
| `Prerequisite{kind=attribute}.attributeId` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.agility" / "growth.attribute.constitution" / "growth.attribute.perception" / "growth.attribu…` | 1d/1e |
| `Prerequisite{kind=attribute}.min` | 安全整数 [0,MAX] | `2` | 1d/1e |
| `Prerequisite{kind=skill}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1b求值/1d |
| `Prerequisite{kind=skill}.kind` | 枚举 `"skill"` | 样例未选此变体/无元素 | 1b求值/1d |
| `Prerequisite{kind=skill}.skillId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1b求值/1d |
| `Prerequisite{kind=profession}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=profession}.kind` | 枚举 `"profession"` | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=profession}.professionId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=lineage}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=lineage}.kind` | 枚举 `"lineage"` | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=lineage}.lineageId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=faith}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=faith}.kind` | 枚举 `"faith"` | 样例未选此变体/无元素 | 1d/1e |
| `Prerequisite{kind=faith}.faithId` | 稳定ID（小写；`.`/`-`分段） | 样例未选此变体/无元素 | 1d/1e |

### 4.21 共用 Action

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Action` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}.kind` | 枚举 `"attack"` | `"attack"` | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}.target` | 枚举 `"adjacent-creature"` | `"adjacent-creature"` | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}.attackKind` | 枚举 `"melee"` | `"melee"` | 1b求值/1d执行/1e身份 |
| `Action{kind=attack}.time` | 枚举 `"native-attack"` | `"native-attack"` | 1b求值/1d执行/1e身份 |
| `Action{kind=move}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=move}.kind` | 枚举 `"move"` | `"move"` | 1b求值/1d执行/1e身份 |
| `Action{kind=move}.target` | 枚举 `"adjacent-cell"` | `"adjacent-cell"` | 1b求值/1d执行/1e身份 |
| `Action{kind=move}.occupied` | 枚举 `"reject"` | `"reject"` | 1b求值/1d执行/1e身份 |
| `Action{kind=move}.time` | 枚举 `"native-move"` | `"native-move"` | 1b求值/1d执行/1e身份 |
| `Action{kind=wait}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=wait}.kind` | 枚举 `"wait"` | `"wait"` | 1b求值/1d执行/1e身份 |
| `Action{kind=wait}.target` | 枚举 `"self"` | `"self"` | 1b求值/1d执行/1e身份 |
| `Action{kind=wait}.time` | 枚举 `"native-wait"` | `"native-wait"` | 1b求值/1d执行/1e身份 |
| `Action{kind=search}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b求值/1d执行/1e身份 |
| `Action{kind=search}.kind` | 枚举 `"search"` | `"search"` | 1b求值/1d执行/1e身份 |
| `Action{kind=search}.target` | 枚举 `"self"` | `"self"` | 1b求值/1d执行/1e身份 |
| `Action{kind=search}.mode` | 枚举 `"manual"` | `"manual"` | 1b求值/1d执行/1e身份 |
| `Action{kind=search}.time` | 枚举 `"native-search"` | `"native-search"` | 1b求值/1d执行/1e身份 |

### 4.22 共用 Schedule

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `Schedule` | oneOf（必须恰好匹配一个变体） | 对象；见子字段 | 1a |
| `Schedule{kind=periodic}` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1a |
| `Schedule{kind=periodic}.kind` | 枚举 `"periodic"` | `"periodic"` | 1a |
| `Schedule{kind=periodic}.firstLevel` | 安全整数 [1,MAX] | `2` | 1a |
| `Schedule{kind=periodic}.every` | 安全整数 [1,MAX] | `1 / 2` | 1a |
| `Schedule{kind=periodic}.amount` | 安全整数 [0,MAX] | `1` | 1a |
| `Schedule{kind=table}` | object；所有列出子键必填，未知键拒绝 | 样例未选此变体/无元素 | 1a |
| `Schedule{kind=table}.kind` | 枚举 `"table"` | 样例未选此变体/无元素 | 1a |
| `Schedule{kind=table}.grants` | array，长度≥1 | 样例未选此变体/无元素 | 1a |
| `Schedule{kind=table}.grants[]` | 安全整数 [0,MAX] | 样例未选此变体/无元素 | 1a |

### 4.23 共用 AttributeGrant

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `AttributeGrant` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1e；属性预算1b |
| `AttributeGrant.attributeId` | 稳定ID（小写；`.`/`-`分段） | `"growth.attribute.constitution" / "growth.attribute.agility" / "growth.attribute.perception" / "growth.attribu…` | 1e；属性预算1b |
| `AttributeGrant.amount` | 安全整数 [0,MAX] | `2 / 1` | 1e；属性预算1b |

### 4.24 共用 RulePort

| 字段/变体 | 类型、范围与结构校验 | 当前默认样例 | 运行实现步骤 |
|---|---|---|---|
| `RulePort` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `RulePort.additiveMode` | 枚举 `"flat"`,`"base-basis-points"` | `"flat" / "base-basis-points"` | 1b；效果提交1d |
| `RulePort.budgetId` | 稳定ID（小写；`.`/`-`分段） | `"growth.budget.hitchance" / "growth.budget.physical" / "growth.budget.stealthrange" / "growth.budget.searchstr… …` | 1b；效果提交1d |
| `RulePort.multiplierSlots` | array，长度≥0 | 样例长度1；见元素字段 | 1b；效果提交1d |
| `RulePort.multiplierSlots[]` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `RulePort.multiplierSlots[].id` | 稳定ID（小写；`.`/`-`分段） | `"growth.slot.final"` | 1b；效果提交1d |
| `RulePort.multiplierSlots[].min` | 有限实数 [0,MAX] | `0` | 1b；效果提交1d |
| `RulePort.multiplierSlots[].max` | 有限实数 [0,MAX] | `4` | 1b；效果提交1d |
| `RulePort.globalClamp` | object；所有列出子键必填，未知键拒绝 | 对象；见子字段 | 1b；效果提交1d |
| `RulePort.globalClamp.min` | 有限实数 [−MAX,MAX] | `500 / 0 / 1 / -9007199254740991` | 1b；效果提交1d |
| `RulePort.globalClamp.max` | 有限实数 [−MAX,MAX] | `9500 / 9007199254740991 / 4 / 34 …` | 1b；效果提交1d |
| `RulePort.rounding` | 枚举 `"floor"`,`"ceil"`,`"nearest"`,`"truncate"` | `"floor" / "ceil"` | 1b；效果提交1d |
| `RulePort.preserveZero` | boolean | `false / true` | 1b；效果提交1d |
| `RulePort.minimumPositive` | 可为null；否则 有限实数 [0,MAX] | `null / 1` | 1b；效果提交1d |
| `RulePort.minimumBaseRatio` | 可为null；否则 有限实数 [0,MAX] | `null / 0.75` | 1b；效果提交1d |

### 4.25 各规则端口的实际样例

| 端口 | 模式/预算 | 乘法槽[min,max] | 全局[min,max]/舍入 | 保零/正值下限/基值比例下限 |
|---|---|---|---|---|
| `hitChance` | flat / `growth.budget.hitchance` | growth.slot.final[0,4] | [500,9500] / floor | false / null / null |
| `physicalDamage` | base-basis-points / `growth.budget.physical` | growth.slot.final[0,4] | [0,9007199254740991] / floor | true / 1 / null |
| `receivedPhysicalDamage` | base-basis-points / `growth.budget.physical` | growth.slot.final[0,4] | [0,9007199254740991] / floor | true / 1 / null |
| `stealthRange` | flat / `growth.budget.stealthrange` | growth.slot.final[0,4] | [1,9007199254740991] / floor | false / null / null |
| `searchStrength` | flat / `growth.budget.searchstrength` | growth.slot.final[0,4] | [0,9007199254740991] / floor | false / null / null |
| `strengthBonus` | flat / `growth.budget.strengthbonus` | growth.slot.final[0,4] | [0,4] / floor | false / null / null |
| `maxHpBonus` | flat / `growth.budget.maxhpbonus` | growth.slot.final[0,4] | [0,34] / floor | false / null / null |
| `focusCapacity` | flat / `growth.budget.focuscapacity` | growth.slot.final[0,4] | [0,13] / floor | false / null / null |
| `focusRecoveryInterval` | flat / `growth.budget.focusrecoveryinterval` | growth.slot.final[0,4] | [1,9007199254740991] / floor | false / null / null |
| `cooldownDuration` | flat / `growth.budget.cooldownduration` | growth.slot.final[0,4] | [0,9007199254740991] / ceil | true / null / 0.75 |
| `taggedProperties.duration` | flat / `growth.budget.tag-duration` | growth.slot.final[0,4] | [1,9007199254740991] / floor | false / null / null |
| `taggedProperties.intensity` | flat / `growth.budget.tag-intensity` | growth.slot.final[0,4] | [-9007199254740991,9007199254740991] / floor | false / null / null |
| `taggedProperties.cooldown` | flat / `growth.budget.tag-cooldown` | growth.slot.final[0,4] | [0,9007199254740991] / floor | false / null / null |

## 5. 求值、效果及动作合同

### 5.1 标量公式与叠加

`GrowthMagnitude`的有界公式为 `clamp(round(source * coefficient / divisor), min, max)`。constant来源值恒为1；attribute来源只读引用属性，level来源只读已验证等级。不支持变量字符串、任意对象路径、代码或第三种随机流。

先按固定顺序汇总加法，受共享预算限制；再按声明顺序应用有名乘法槽，最后global-clamp和round。每端口声明flat或base-basis-points解释、保零、正值下限及基值比例下限。默认`physicalDamage`与`receivedPhysicalDamage`共享`growth.budget.physical`：同一次物理结算收集攻守两向修正，合并预算后只缩放一次，不能把两个端口各自乘一次。必中/必失优先，原100%仍取骰路径必须保留其原随机调用。有限词汇和解释算法归1b；1a0只验证配置结构/引用。

### 5.2 有限条件、临时效果与消费

条件数组为AND，不存在任意布尔表达式脚本。条件读取动作类别、伤害类别、角色位置、相邻、手动/自动搜索、实际概率求值、命中、实际HP伤害、直接伤害或稳定标签事实。

临时效果将应用时点（action-start/action-result）、对象（self/target）、持续（动作期/客观块）、内部modifier、消费事件和中断动作分开。消费只在per-resolution-commit发生，不能在只读求值器/UI查询时扣次数。架势的positive-direct-physical在护盾前判正，盾全吸收仍消费；牵制的physical-probability-roll要求实际普通物理概率求值，原必中短路不消费。同一动作多击之间必须即时可见消费结果。

按标签的duration/intensity/cooldown修正只作用于明确声明的标签目标和属性，不能作为任意对象写入路径。intensity在原magnitude自身舍入/钳制后、所属端口加法预算/全局钳制前应用；duration在声明的duration.cap之前应用；cooldown先修正技能的基础冷却，再进入通用属性冷却求值/比例下限。否则架势固定−2000bp的magnitude范围会错误吞掉守望誓约的额外−500bp。first-visit资源效果独立于XP开关，带稳定效果`id`、`trigger.receipt:depth`、深度边界及`resource-bounds`钳制；以效果ID+深度记录收据，增减资源均限于合法最小/最大值。实现归属/24项覆盖见[表达审计](growth-expression-audit.md)。

### 5.3 受控动作

只允许attack、move、wait、search。攻击仅相邻普通近战；移动仅合法相邻格且被占格拒绝；等待/搜索以self为目标、搜索限manual。耗时引用native-attack/native-move/native-wait/native-search，不能由JSON绕过原时间、危险确认、终局/麻痹/模态等资格守卫。运行器归1d；玩家命令不能提交任意actorId或嵌套公开executeCommand来伪造一次动作。

### 5.4 纯端口与提交事实DTO（类型合同，未实现运行器）

`types.ts`同时提供以下只读输入/输出合同；不是额外JSON配置字段，不含活Game/Creature、回调、UI或RNG权限。

| 类型 | 实际字段/变体 | 责任 |
|---|---|---|
| `GrowthRuleActor` | id、level、attributes只读ID→数值表 | 1b构造经验证视图 |
| `GrowthRuleInput` | actor、nullable target、baseValue、actionId、resolutionId、tags | 1b纯求值上下文 |
| `GrowthHitInput` | 基础字段+attackKind(melee/thrown)、adjacent、rollMode(skip-guaranteed-hit/skip-guaranteed-miss/roll-guaranteed/roll-probability) | 1b保留原必中/必失/RNG优先 |
| `GrowthDamageInput` | 基础字段+attackKind、damageKind=physical、direct、immune | 1b物伤统一预算槽 |
| `GrowthStealthInput` / `GrowthSearchInput` | 前者加nativeMinimum/invisible，后者加mode(manual/automatic) | 1b保留原隐身/最低距离/搜索语义 |
| `GrowthCooldownInput` | 基础字段+skillId/baseCooldown | 1b求值，1d状态提交 |
| `GrowthRulePolicies` | 10个方法名与config.rules.ports相同；每次返回有限同步number | 1b；不得消费效果或写状态 |
| `GrowthActionResult` | actionId、resolutionId、actorId、nullable targetId、kind、committed、hit、hpLost、positiveDirectPhysicalBeforeShield、probabilityRollCommitted | 1d原结算事实；区分架势和牵制条件 |
| `GrowthEffectConsumptionFact` | effectId、actorId、actionId、resolutionId、event(positive-direct-physical/physical-probability-roll)、consumedCount | 1d逐单独命中后提交，不能等整命令结尾 |

学习限制采用`none < soft < hard`；有效模式是全局`config.skills.lockMode`与每技能`lock.mode`两者较宽松者（min），soft仅建议。只有两者均hard时才按非空身份白名单限制；显式赠技豁免单独校验。默认样例技能mode=none，因此全局soft不会把其变成身份硬锁。前置数组始终按`all`求AND，不随soft推荐模式跳过。

### 5.5 原物品永久收益的唯一换算

`itemGrowth.rules[].nativeEffect=preserve`时，conversion是原永久收益的倍率；默认力量药水/生命药水/强化卷轴均为1，分别保留原+1力量/+10最大生命/+1强化。`replace`时conversion是每次使用的替代授予量，destination指定接收字段/点数。perItemCap/runCap只限制这笔永久收益，不按比例改原治疗、清状态或其它物品效果；执行桥归1b。

力量训练换算只由其引用属性的strengthBonus modifier幅度定义，避免重复strengthPerPoint字段造成两套答案。冷却最小比例只由`rules.ports.cooldownDuration.minimumBaseRatio`定义，focus中没有第二个floorCooldownRatio。其它maxHp/strength原生所有者及派生差额同步仍沿[阶段1设计](phase1-growth.md)约束，不将永久收益重复加到原字段。

## 6. 跨字段校验与拒绝策略

校验应明确报告路径和本地化原因，不得通过静默截断、未知字段忽略、随机回退或按加载顺序碰运气处理坏包。实际已实现检查由 `definitions.ts` 及1a0负例测试核对；新增语义必须配负例。

实际两阶段校验在`schema.ts`，加载器不偷偷补默认值：

- JSON/形状：有限、无环、无危险原型键；对象完整且无未知键；oneOf恰好匹配一个变体；数组唯一性、ID格式、数值范围、枚举严格检查
- 引用/去重：属性、定义、预算、模板ID唯一；技能/身份/推荐/赠技引用必须存在且kind匹配；命名前置不能重复，skill依赖图无环；临时/资源效果ID唯一
- 效果/叠加：来源属性存在，幅度min≤max且计算不溢出；add必须slot=null，multiply必须引用已声明槽且幅度不负；duration标签要命中客观块临时效果，intensity要命中可修正强度，cooldown要命中主动技能；消费事件/count/护盾旗标匹配；求值order固定且每预算/槽/钳制范围有效
- 等级/预算：累计表长度=cap、L1=0且严格递增；曲线有正费用且满级累计安全；发点表长度=cap或periodic起始级合法，累计授予安全；属性初值/上限、总属性上限、训练属性与价格/上限一致；focus的min≤base≤cap
- 身份/模板：固定初值、选择容量、身份点数及赠技数量校验；模板等级/XP区间、属性/技能预算、赠技豁免、实际前置/硬锁、已学与装配模式/槽数校验；深度范围min≤max、模板引用存在，同priority的重叠范围拒绝
- 外部目录：传`monsterIds`时必须与报价表精确同集合；传`itemIds`/`categoryIds`时检查物品/鉴定类别引用。显式`createGrowthContractModule`工厂会传实际怪物、物品和支持类别目录；直接调用纯schema校验时若省略这些可选参数，不会凭空查引擎目录
- 版本/文本：schema固定1，moduleVersion匹配调用方版本且rulesVersion与其相等；所有引用的nameKey/descriptionKey/reasonKey须通过hasText。注册/读取模块时再比较规范化包SHA-256指纹，拒绝同版本换包

错误码为`json`、`shape`、`field`、`range`、`duplicate`、`reference`、`cycle`、`version`、`text`、`budget`，映射`ext.growth.error.<code>`并带出错路径。parse成功后返回深拷贝/深冻结数据，不暴露调用方可变别名。

纯schema抛出结构化GrowthValidationError；实际public parse/load及合同工厂的错误message已在生产边界本地化，同时保留key/path/detail/code供诊断和后续UI。技术引用ID可展示，内部英文诊断短语不直接拼给玩家。工厂按真实zh_CN资源目录校验非空词条，不以text.ts的样例词条表作为定义白名单；新增技能/属性只需修改定义JSON及本地化资源，不需改界面或词条登记代码。

纯包校验不替代实际create-character身份组合、目标合法性、资源充足、revision和原子提交检查，后者属于1b/1d/1e；通过模板校验也不表示已生成/执行该模板。

## 7. 版本升级规则

- `schema`描述包形状；不兼容字段/判别联合变化必须升级schema并更新读取器。不要悄悄接受旧包，再猜缺失字段
- `rulesVersion`描述这组效果语义/数值，当前校验要求它与`moduleVersion`精确相等；任何会改变同输入可观察结果的公式、样例值、技能/身份/模板或默认开关变化都升级它
- `moduleVersion`与注册growth时提供的模块精确版本绑定；schema/规则/数据/状态合同变化要同时升级模块版本，依赖已有阶段0精确manifest检查拒绝旧扩展存档/录像
- 同版本不得换包内容；规范化数据指纹用于发现同版本漂移。改文档错字或不参与规则的说明是否需要升版本，以实际包内容是否改变及指纹检查为准；不能为了绕过检查放宽兼容
- 不做旧存档迁移或自动修档；错误在退休旧局之前拒绝。1a0未默认启用growth，因此不把版本合同测试描述为“已有玩家成长档迁移成功”

### 7.1 修改数据的最小流程

1. 改`definitions.json`中的配置/条目；增删属性/技能时同步修正前置、推荐、赠技、标签和模板引用。空属性目录可合法表达，但需禁用力量训练并令attributeId=null，同时清除相关引用
2. 新显示项/错误内容补本地化键，保持ID稳定。不要将中文描述变为解释器输入，也不要为某个ID加特殊引擎/UI分支
3. 数据或语义改变同步升级JSON的moduleVersion/rulesVersion与`GROWTH_VERSION`；`getGrowthPackIdentity()`按规范键序数据计算指纹，不手填或弱化它。schema形状变化另升schema/读取器
4. 跑对应步骤的校验/负例和完整门禁，记录实际引擎/实体文件及档位；更新本字段目录/样例审计。旧扩展输入应明确拒绝，不能隐式迁移

## 8. 后续步骤维护责任

| 步骤 | 实现和文档维护责任 |
|---|---|
| 1a0 | 所有字段形状/加载校验/版本绑定与24项表达审计；不启用玩法 |
| 1a | XP、报价/收据、等级/点数/自动生命/升级回复；派生同步和focus/cooldown状态提交基础；中性create-character首动作边界 |
| 1b | 统一纯求值和端口、可增删属性/训练/洗点、预算/槽位/钳制/舍入、原物品折算与收益限制 |
| 1c | 通用数据读模型/UI，内容增删不加组件中的ID规则分支；未启用能力不提前显示成可用 |
| 1d | 动作桥、12技能、客观时间、资源消耗、效果持续/结果条件/逐命中消费/中断/回放 |
| 1e | 身份选择/赠予/誓约、怪物模板与盟友自动分配；收齐实际字段、样例和运行限制 |

各步门禁按 [phase1-growth.md §12.1](phase1-growth.md#121-每小步门禁最新批准替代旧的重复全量要求)。完整/CE档中test:full替代npm test；取不到CE时回退npm test并明确“CE 对照用例未执行”。未来合入main前由维护者本机补跑完整test:full。此配置文档不代替实际测试报告，也不把尚未执行的步骤写成通过。
