# 战斗内容配置手册

本文按当前 combat 数据加载器、生产执行器及公开命令说明配置，不把[阶段 3 设计](phase3-combat.md)或[阶段 4 设计](phase4-giants.md)中的提案当成已实现能力。路径均相对仓库根。分支政策、阶段授权及验收范围以[扩展路线](README.md)和相应交付报告为准；本页不是新的功能验收报告。

## 1. 入口、版本与独立启用

| 文件 | 用途 |
|---|---|
| `src/ext/modules/combat/data/definitions.json` | 唯一正式机械内容包：资源、招式、profile、原生物种绑定、闪避、弹反、篝火 |
| `src/ext/modules/combat/locales/zh_CN.json` | 扁平的 `ext.combat.*` 中文文本键 |
| `schema.ts`、`types.ts` | combat 包的精确字段、整数范围、引用与预算 |
| `definitions.ts`、`descriptor.ts`、`module.ts` | 版本、规则指纹、发现式注册及能力声明 |
| `production.ts` | 内容包到通用 `ActorAttackDefinitions` 的转换、生产状态初始化 |
| `bonfires.ts`、`partBreak.ts` | 篝火绑定/历史与可选部位破坏 provider |
| `view.ts`、`ui/` | 只读资源/预警/篝火投影、共用对话框和命令构造 |
| `tests/`、`test-suites.json` | 模块测试及发现器登记，新增测试须同步登记 |

底座执行依据是 `src/ext/actorActions.ts`、`actorActionValidation.ts`、`worldRest.ts`、`partBreak.ts`，以及 `src/engine/Core/PhasedAttackProduction.ts`、`ActorResources.ts`、`WorldRestProduction.ts`。实际身体几何、占位、命中、伤害与时钟由底座负责。普通调数不应在 Game/UI 中为某个招式 ID 加特判。

| 标识 | 当前值与含义 |
|---|---|
| `schema` | `1`，combat 数据包结构 |
| `moduleId` | `"combat"` |
| `moduleVersion`、`rulesVersion`、`COMBAT_VERSION` | 均为 `"1.5.0"`；加载器接受精确值，不是任意 semver |
| descriptor 的 `foundation` | `5` |
| 扩展 manifest / foundation snapshot | manifest `schema: 1`，foundation 版本 `5` |
| 原生整局存档 / 录像 | `version: 3`；整局 schema 为 `brogue-web-whole-run-v3` |
| 正式 combat 持久状态 | `schema: 3`，位于 `extensions.modules.combat` |
| 内嵌 scheduler / 只读模块 view | 各为 `schema: 1`，与数据包版本分别校验 |

`state.ts`、`components.ts` 和 `planner.ts` 保留早期纯规划/fixture 合同。它们的 `CombatState.schema: 1`、`combat:resources`、`combat:action` **不是正式游戏存档结构**。生产只有一份模块 ledger：`revision / nextActionId / scheduler / actions / actors / bonfires`；正式模块明确拒绝 `combat:*` 生物组件，不能同时添加第二份资源池或阶段时钟。

### 1.1 单独使用与组合

- combat 默认不启用；新局选择“战斗规则”才加载本局玩法。可只选 combat，也可与 growth、narrative、giants 任意组合；本局启用集合固定，不支持游玩中热插拔
- 只选 combat 时无需成长角色、剧情 NPC 或巨人内容，默认玩家招式、原生怪物绑定、体力/韧性、防御及篝火都可工作
- 不启用 combat 时，没有其资源池、招式调度和模块栏；giants 仍用自己的原生攻击与底座部位破坏降级
- 不启用 giants 时，combat 使用底座单格/已安装的其他合法身体能力；它不导入 giants 内容。空间能力属于底座，安装某个内容包不等于开放全部阶段 4 功能
- 存档/录像按其保存的 manifest 重建启用集合；此前 live 局或新局菜单未选 combat，不会因此拒绝该档。只有所需模块未安装/不可用、版本或规则指纹不匹配、manifest/状态不合法等情况才拒绝。不能删除存档中的 combat 字段来“迁移”

引擎集成可使用现有新局边界，例如已有 `game` 上调用：

```ts
game.startNewGame({
    seed: 8201,
    mode: 'normal',
    ruleSet: 'extended',
    extensions: ['combat'],
    initialCommands: [],
});
```

组合包含其他模块时，沿现有开局 UI/模块创建器收集该模块需要的 `initialCommands`，不要把上例空数组当作所有组合的创建流程。安装/启用验证与真实物理删除是不同证据；删除矩阵是否执行应查对应收尾报告，不由本页推定。

## 2. 包结构、文本和硬预算

根对象完整字段如下，全部必需，不接受额外键：

```text
schema, moduleId, moduleVersion, rulesVersion,
resourcePolicies, attacks, profiles, nativeProfiles, playerProfileId,
breakRecoveryTicks, dodge, parry, bonfires
```

`loadCombatPack(raw, locale)` 先完整校验，再复制并深冻结输入，返回带加载来源标记的包。`createCombatModuleFromPack(pack)` 只接受加载器返回的包，不能以 TypeScript 强制类型转换绕过校验。正式入口 `createCombatModule()` 使用仓库 JSON；没有运行时导入任意 URL、JS 脚本或编辑器热重载协议。

### 2.1 通用格式

- 所有机械数值必须是有限安全整数；小数、`NaN`、无穷、数字字符串均拒绝
- ID 最长 128 字符，语法为 `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$`；不接受下划线、空格、大写、连续分隔符及污染键
- 资源策略、招式、profile、篝火定义共享一张 ID 唯一表；不同类别不能同名。物种绑定中的 `monsterId` 是另一类引用
- 对象精确校验必需键和未知键；拒绝函数、getter、symbol、循环、稀疏/附加属性数组、非普通原型以及 `__proto__ / constructor / prototype`
- 名称/说明引用必须存在于本包 locale，键匹配 `ext.combat.*` 且最长 256 字符。locale 是至多 512 项的扁平字典，值为非空字符串，不能包含 HTML 尖括号、`javascript:`、`eval(` 或 `new Function(`
- 加载错误为 `CombatValidationError`，带 `code / path / textKey`；常见码包括 `UNKNOWN_KEY`、`UNKNOWN_REFERENCE`、`INVALID_RANGE`、`INVALID_VERSION`、`DUPLICATE_ID`、`BUDGET`。篝火子验证失败归为 `INVALID_STATE`，路径 `$.bonfires`

### 2.2 内容预算

| 对象 | 硬限制 |
|---|---|
| 资源策略 / 招式 / profile | 各 1–128 条，三类加篝火定义的**总数**还须 ≤128 |
| `nativeProfiles` | 0–128 条；每个物种至多一条 |
| 每个 profile 的 `attackIds` | 1–128 个、不重复、必须存在 |
| 每招式 `segments` | 1–8 段 |
| 每段每个方向的 `offsets` | 1–256 格，格子不重复，x/y 各为 −32…32 |
| 投影后的实际危险格 | 每段最多 1024 格；数据 offsets 合法并不保证大身体的并集一定不超限 |
| 时间刻 | 单个配置时间及招式总时长各 ≤1,000,000；具体字段是否可为 0 见下文 |
| 资源量 / 恢复分子分母 | 各 ≤1,000,000；容量、分母为正 |
| combat JSON 整体 | 最大嵌套深度 32、1,000,000 个值、8,000,000 个累计字符串 UTF-16 单元，单字符串 ≤4096 |

这些是代码硬上限，内容不能用自造根 `limits` 覆盖。`bonfires.limits` 是唯一该包接受的配置预算，且另受 §6 硬上限约束。进入底座后仍有独立校验：生产 JSON 深度 24、资源 actor 行/动作束各最多 4096、并行子动作最多 4、锁定格最多 1024，世界坐标还须符合当前地图和源足迹。模块纯 fixture 的 ±1,000,000 坐标 DTO 范围不能用来宣称生产地图支持该范围。

## 3. 资源策略与 profile

### 3.1 `resourcePolicies[]`

下表列出完整字段及当前唯一策略 `fixture.resources` 的默认值。

| 字段 | 默认 | 范围 / 含义 |
|---|---:|---|
| `id` | `fixture.resources` | 包内唯一 ID |
| `staminaCapacity` | 24 | 1–1,000,000 |
| `initialStamina` | 24 | 0–容量；初始池，不是每次行动回填量 |
| `regenPerTickNumerator` | 1 | 0–1,000,000；0 关闭体力自动恢复 |
| `regenPerTickDenominator` | 20 | 1–1,000,000；默认每 20 时间刻恢复 1 |
| `regenDelayTicks` | 40 | 0–1,000,000；一次成功付款后重置的恢复延迟 |
| `nativeAttackCost` | 2 | 0–体力容量；已接入原生攻击的统一费用 |
| `regenPhases` | `idle, recovery, break-recovery` | 从五个合法阶段中选 0–5 个，不能重复 |
| `poiseCapacity` | 12 | 1–1,000,000；初始韧性为满值 |
| `poiseRecoveryNumerator` | 1 | 0–1,000,000 |
| `poiseRecoveryDenominator` | 30 | 1–1,000,000 |
| `poiseRecoveryDelayTicks` | 40 | 0–1,000,000；有效韧性损失后重置 |
| `poiseBreakRecoveryValue` | 12 | 1–韧性容量；硬直结束的明确恢复值 |
| `nativePoiseDamage` | 2 | 0–1,000,000；原生有效物理攻击的韧性冲击 |
| `poiseImmune` | `false` | 布尔；阻止新的韧性破防，不代表 HP/状态免疫 |

五个阶段名是 `idle / windup / inter-segment / recovery / break-recovery`。体力恢复要求当前所有相关未完成子动作阶段都在 `regenPhases` 中；闪避/弹反恢复视为 `recovery`，原生硬直为 `break-recovery`。韧性恢复使用自己的延迟和定点余数，不由 `regenPhases` 开关控制；硬直期间不积累韧性恢复。

时间来自底座实际经过的 elapsed ticks，非毫秒、帧数或玩家命令数。延迟在实际时间中递减，只有扣除延迟后的余下时间可贡献恢复。恢复以“旧余数 + 有效时间 × 分子”整除分母并持久保存余数，满池清余数；不能用 0tick 打开界面刷资源。默认策略下，从体力 20、余数 0、延迟 40 开始，在允许阶段经过 100tick，结果是体力 23、余数 0。

成功付款即使费用为 0，也会按现有 `chargeActorResources` 重置体力恢复延迟。降低容量钳制现量；提高容量不直接补满。原生形态/profile 变更在安全边界更新绑定并重置相关余数；不能用变形来重新领取 `initialStamina`。缓存层上的生物资源冻结，读档不补算一个新的恢复步骤。

### 3.2 `profiles[]`、`playerProfileId`、`nativeProfiles[]`

profile 精确字段为 `id / resourcePolicyId / attackIds`。资源策略和每个招式都必须存在；每招式费用及全局 dodge/parry 费用必须不高于该 profile 的体力容量。即使只打算让某种 NPC 攻击，也不能声明付不起全局防御的 profile。

| 默认 profile | 招式 |
|---|---|
| `fixture.profile` | `fixture.slash`、`fixture.stomp`、`fixture.double-thrust` |
| `combat.fan-edge` | `fixture.slash` |
| `combat.follow-thrust` | `fixture.double-thrust` |
| `combat.shock-ring` | `fixture.stomp` |

所有默认 profile 都引用 `fixture.resources`。`playerProfileId` 为 `fixture.profile`；名称中的 `fixture` 是现有稳定 ID，当前已由生产入口使用，不能据此当作未启用示例删除。

默认物种绑定为 `rat → combat.fan-edge`、`kobold → combat.follow-thrust`、`ogre → combat.shock-ring`。每条精确字段为 `monsterId / profileId`；profile 必须存在，物种 ID 不可重复。包加载器只验证 `monsterId` 的格式，**不会验证它一定在原生/已安装形态目录中**；拼错物种名可能顺利加载但从不触发，要用实际出生实体验证。

未绑定物种没有额外 phased 招式，仍走原生行为；combat 已启用时，其原生攻击资源策略回退到玩家默认 profile，并非免体力。玩家与 NPC 共用付款、恢复、防御和硬直逻辑。growth 技能调用原生攻击时，专注与体力在已有原生动作事务中分别付一次；不要在技能效果或 combat JSON 中再扣一遍。

当前 AI 没有可配置的 `weights / priority / reserve / rangePolicy`。通过资格和原生生存/施法优先级后，按 profile 的 `attackIds` 顺序选择首个可支付、首段能覆盖合法目标的招式；已感知的临近可弹反预警可触发确定的 NPC 弹反。不会随机按权重选招，也没有数据开关能让 NPC 自动使用闪避。单独提供 `prepareActorDodge` 不等于已存在 AI 闪避选择。

## 4. 招式、八向形状和命中

### 4.1 `attacks[]` 完整字段

| 字段 | 合同 |
|---|---|
| `id / nameKey` | 唯一 ID / 已存在的模块名称键 |
| `cost` | 0–1,000,000；动作接受时一次付整招费用，不按目标/格子/段数收费 |
| `windupTicks` | 1–1,000,000；第一段预警时长 |
| `recoveryTicks` | 1–1,000,000；最后一段之后的恢复时长 |
| `interruptPolicy` | 只接受 `"cancel-pending"` |
| `segments` | 1–8 个下述严格段对象 |

总时长 = `windupTicks + 所有段 delayTicks 之和 + recoveryTicks`，必须 ≤1,000,000。不能仅检查每个时长各自合法。

| 段字段 | 合同 |
|---|---|
| `delayTicks` | 第一段必须为 0；其余段必须为 1–1,000,000 |
| `shape` | 下述唯一形状类型 |
| `locationPolicy` | 仅 `"locked-world"` |
| `targetPolicy` | 仅 `"part"` |
| `damageProfile` | 仅 `"native-melee"` |
| `poiseDamage` | 0–1,000,000；该段有效物理冲击的韧性损失 |
| `parryable / dodgeable` | 显式布尔；分别控制该段是否允许相应防御 |
| `friendlyFire` | 只接受 `false`；不能通过改成 true 开启友军火力 |

`shape` 必须有 `kind / offsets / selfExclusion / occlusion`：

- `kind: "footprint-offset-union"`
- `offsets` 完整提供 `n / ne / e / se / s / sw / w / nw` 八个数组，每格精确为 `{x, y}`。x 向东增、y 向南增；八向是显式整数模板，不由一个方向自动旋转
- `selfExclusion: "source-member"` 或 `"whole-group"`，默认招式全为后者
- `occlusion: "line-of-effect"`

实际危险区从**发起成员每个真实身体格**加所选方向 offsets 求并集，再减去声明的自身排除格，按地图边界和逐格作用线裁切，去重并按 y/x 排序。不是“以核心锚点画一块矩形”，也不是每个身体格额外攻击一次。`source-member` 只改变几何排除范围，不绕过底座敌我/同群禁止命中的资格检查。

每段进入预警时冻结世界格；目标移开会挥空，不追踪目标。下一段在上一段解析后锁定自己的新区域，并经过它的正 `delayTicks`。来源位移、旋转、破坏、退休或资格失效按底座取消待段，不改由核心接替发射，不退款；已发生的伤害保留。招式开始后沿同一调度器推进到恢复完成，不是等待玩家下一次按键才释放，也不允许在自己前摇中靠墙钟抢按另一命令。

伤害复用原生命中、防护、护盾、装备、符文与来源逻辑。包内没有 `damage`、命中率公式、脚本效果、投射物、`single-ray`、追踪或瞬间转向字段。添加这些字段会被拒绝，需先扩展底座协议及测试。

### 4.2 当前默认节奏

| 招式 ID / 显示名 | 费用 | 前摇 | 段间隔 | 恢复 | 总时长 | 韧性伤害 / 防御 |
|---|---:|---:|---|---:|---:|---|
| `fixture.slash` / 扇锋斩 | 4 | 50 | 第一段 0 | 40 | 90 | 2；可弹反、可闪避 |
| `fixture.stomp` / 震环击 | 7 | 100 | 第一段 0 | 70 | 170 | 5；不可弹反、可闪避 |
| `fixture.double-thrust` / 续锋刺 | 6 | 40 | 0、30 | 60 | 130 | 每段 2；两段均可弹反、可闪避 |

扇锋斩为面向附近三格；震环击为源身体的八邻偏移并集；续锋刺首段伸一格，第二段伸一、二格。大身体会改变实际并集，因此不能把默认“八个偏移”解释成永远只警示八个世界格。

### 4.3 阶段 4 组合边界

当前底座已有固定 zone 与真实复合成员路径，不能再把 3b 的“只有 independent/r0 方形”历史限制当作全部攻击的现状。相反，闪避仍有独立白名单，见 §5。

- 每次局部/范围效果按实际 part/zone 接触去重，同一 zone 多格只一次，不同 zone 可各一次
- 固定 zone 的防护后有效损失按 1:1 传所属原生 HP；外围成员按 1:4 传核心，传导不重新解算一次命中/防御/符文/韧性/成长效果。具体局部 HP、倍率和破坏表属于身体/giants 数据，不属于 combat pack
- 复合体只有核心作自由决策并承担原生时间；最多 4 个真实就绪来源并行动作，总束耗时取最长来源、下一边界取最早来源
- 当前生产每个来源按自己的 profile/资源行付款，捕获独立 shape、scope、冷却和来源身份；并非阶段 3 早期设计草图中的单个共享体力池。受到物理冲击或成员被弹反时的韧性/整体硬直归核心
- 成员局部取消只取消自身待段；核心破防取消整束。成员不自行 `takeTurn`，也不写另一份原生行动时钟
- 4d 仍有未完成项，含完整逐子步环境、整体转换/clone/迁层等；详见[当前 4d 报告](phase4d.report.md)。增加 profile 绑定不授权这些能力，也不能把当前限制包装成永久 Boss 免疫

## 5. 闪避、弹反与硬直

| 配置 | 默认 | 校验 |
|---|---|---|
| `dodge` | `cost: 4, windowTicks: 40, recoveryTicks: 80` | 费用 0–1,000,000；恢复 1–1,000,000；窗口 1–恢复时长 |
| `parry` | `cost: 3, windowTicks: 60, recoveryTicks: 100, poiseDamage: 12, contactRange: 1` | 同上；韧性冲击 0–1,000,000；接触距离 1–32 |
| `breakRecoveryTicks` | 50 | 1–1,000,000 |

防御窗口包含在恢复总时长内，不是额外相加。窗口减到 0 的同一 tick 已失效；同为 60tick 的命中与 60tick 弹反窗口并不保证成功。显示“可弹反”只表示段属性，仍需正确朝向、真实接触距离及有效窗口。

闪避固定移动一格，没有可调 `distance`。完整身体必须能落脚，不能穿墙、穿人、跨越禁止的角落/区域；楼梯、门户、祭坛及确定死亡落点另有门。当前只接无 spatial 的单格，或 r0 的 `builtin:single / builtin:square-2 / builtin:square-3`，允许可选 `movementRegionId`；任意 mask、旋转姿态、zone、bodyMember 等不因阶段 4 已安装而自动开放。

闪避只保护标为可闪避的直接物理攻击；火、毒、坠落等环境/状态伤害照常。强制位移、空间来源变化、失能或离层使窗口失效；不能用先移出再移回保留旧保护。

弹反开始时锁定八向之一，按真实接触格差的符号匹配朝向，并满足 `contactRange`。首次合资格的直接物理攻击接触即消耗整个窗口（在原生命中概率抽签之前），再对攻击来源施加配置韧性冲击；没有成功率骰、免费反击或额外普通命中。不可弹反段、环境和投射物不因此免疫；提高 `contactRange` 不会把原本不属于弹反类别的远程伤害变成近战。外围成员没有独立弹反入口，群核心受共享资格约束。

有效正物理冲击损失韧性；归零会清理防御窗口、取消待段并进入正恢复。硬直以现有恢复与配置恢复的最大值衔接，不无限追加一份时长；同次硬直中的重复冲击不重新制造破防。恢复终点回到 `poiseBreakRecoveryValue`。`poiseImmune` 阻止新的破防，不能清掉已接受的恢复或令生物免疫其他状态。

## 6. 篝火配置与休息

`bonfires` 必须含 `definitions / limits`，至少一个定义，仍计入全包 128 定义上限。当前没有以空数组完全关闭篝火的配置形式。

### 6.1 完整字段与默认值

| 字段 | 默认 | 范围 / 含义 |
|---|---|---|
| `id` | `combat.bonfire` | 包内唯一；加 `.slot.1024` 后仍须 ≤128 字符 |
| `nameKey / descriptionKey` | `ext.combat.bonfire.name / description` | 两个已存在的 locale 键 |
| `glyph / color` | `♨ / #E7A34B` | 单个非控制 Unicode 码点 / 六位十六进制色 |
| `interactionDistance` | 1 | 0–16，按实际身体距离；仍要求可见及交互作用线 |
| `placement.minDepth / maxDepth` | 1 / 40 | 1–40、含端点、最小≤最大 |
| `placement.maxPerDepth / maxPerRun` | 1 / 40 | 都为正；每层≤每局；每局≤配置 `maxPlacements` |
| `placement.minStairDistance` | 2 | 0–256，距楼梯的最小距离 |
| `placement.maxEntranceDistance` | 6 | 最小楼梯距离–256，入口附近搜索半径 |
| `placement.onNoSpace` | `skip` | 仅 `skip / defer` |
| `restTicks` | 500 | 1–1,000,000 时间刻 |
| `restorePolicy.hp / stamina / poise` | 各 `full` | 每项只接受 `full / none` |
| `resetPolicy` | `none` | 只接受 `none` |
| `limits.maxActive` | 40 | 1–min(配置 `maxPlacements`, 1024) |
| `limits.maxPlacements` | 40 | 1–1024；所有定义 `maxPerRun` 之和不得超过它 |
| `limits.maxRestReceipts` | 128 | 1–4096；滚动历史上限 |

篝火是非阻挡 `WorldInteractable`，不是 Creature、复活点或剧情 gate。坐标/实体 ID 属于 foundation 世界，combat 只持绑定和有界历史。

### 6.2 放置、名额和重访

仅在首次入层的既有事务中，按稳定定义/实例 ID 次序尝试安全放置。底座从入口附近当前可见、可通行、交互线可达的合法 FLOOR 候选中选择，排除占用、危险、机器、楼梯距离等，按稳定距离/坐标顺序处理；不挖房间、不刷新地图、不新增随机抽样。

`skip` 记录已跳过并消耗该整局槽位；`defer` 保留同一实例槽位，只在更深且首次进入的合格层重试。最深合格层失败，或之后首次入层已越过范围，最终记 skipped。重访/读档不重新放置；缓存楼层的活绑定也占 `maxActive`。移除不再保留层的对象只清活绑定，不返还历史名额。

`maxPerDepth` 是尝试预算，不能假定它保证本层成功生成数量。调高放置距离/数量也不保证安全候选存在。多于 256 个放置请求由模块在同一外层事务分批，后批看得到前批占位；不是多个独立、可半成功的存档步骤。

### 6.3 实际休息行为

打开说明为 0tick 只读操作，真正提交要经过正式 `rest` 命令和 Game 记录的风险确认。纯准备和等待确认期间不付款、恢复、分配 actionId 或消耗规则 RNG。No、陈旧会话/计划、失效对象和无效输入均免费拒绝。

开始要求玩家存活、未失能、无其他交互 gate、未忙碌/硬直，篝火在当前可见交互范围内，且无当前直接可见的合资格敌情。满血仍可休息，没有隐含消耗品或一次性限制。确认后分配动作 ID、增加访问序号，在唯一 scheduler 中提交一段有时长 recovery；期间 NPC、环境、饥饿、毒和客观时钟正常推进，玩家没有额外保护。

正 HP 损失、死亡、位移/空间来源变化、失能、离层、目标移除或新可见敌情会中断篝火奖励。盾完全吸收而 HP 未减不伪称受伤；源 revision 能检测移出再移回。关闭说明框只能取消未开始的输入，不是已经开始休息的取消命令。

完成奖励等到同 tick 敌人/环境及原生回合收尾（包括饥饿死亡和最后视野）之后，按**当前** HP 上限、体力/韧性当前有效容量应用所选 `full`。中断没有这笔完成奖励，但经过时间本来发生的普通回血/资源恢复不会倒退。篝火完成奖励不清毒/饥饿，不额外补充 growth 专注或重置技能冷却；若 growth 启用，其正常专注恢复、冷却及状态时钟仍随实际时间推进。篝火也不重置敌人、死亡/任务收据或世界时间，不复活玩家。

`bindings / placements / pending / active / receipts` 保存实例、次数和结果；倒计时只在 scheduler。`active.phase: settling` 是同步结算中的短暂安全点，不能保存/载入；合法 resting 可按严格源身份与时钟恢复。完成收据精确一次，读档/更新不重复发奖；旧收据被滚动淘汰也不清访问/完成总数。

## 7. 可选软接口与 3g adapters

### 7.1 `combat.part-break.v1`：已接线

协议定义在 `src/ext/partBreak.ts`，combat 在 `module.ts.optionalPartBreaks` 注册 provider。来源为底座可信部位破坏事务，不是玩家命令、普通剧情奖励或可以在 JSON 中随意触发的事件。

当前请求精确字段为：

```text
schema: 1,
resolutionId, actorId, sourceId,
groupId, partId, zoneId, generation,
balanceLoss, fallbackStunTicks
```

`actorId === groupId`，代表独立实体或群核心；`sourceId` 为正实体 ID 或 null；`generation` 当前仅接受 0；损失/降级时长为 0–1,000,000。固定 zone 使用 `partId: self` 且 `zoneId` 不是 `body`；真实成员使用非 self 的 `partId` 和 `zoneId: body`，还必须有底座从真实 owned 活槽签发的冻结 member 证明。仅手造请求或序列化 bodyMember 不能授予权限。

provider 的 prepare 返回 ready 计划或明确 unsupported；commit 只能写自身模块状态/组件和缓冲消息，不能直接写原生 HP、世界位置、奖励、RNG 或额外时间。combat 对核心当前权威资源应用 `balanceLoss`，需要时硬直/取消整束；部位破坏收据的去重仍只有底座账本一份。

成功 handled 与底座 fallback 互斥。combat 缺席、禁用或明确不支持时，底座才按身体数据 `fallbackStunTicks` 施加行动抑制；poise 免疫、正在硬直等合法 handled 情况不会再追加 fallback。provider 抛错会使同一破坏事务回滚，不以捕获错误后改走 fallback 来重复提交。局部破坏不发 kill、不额外给 XP、不触发成员死亡掉落；核心死亡沿原生终结路径处理。

### 7.2 3g 受信属性容量 adapter

`growth.combat-stats.v1` 通过底座 `queryOptionalActor` 查询真实 actor。请求仅含 `v: 1 / baseStaminaCapacity / basePoiseCapacity`；actor 的身份、当前/缓存层和群体归属由底座核验，payload actorId 不能授予权限。provider 只读自己模块允许的冻结 actor 组件。缺 provider 或显式 unsupported 回退 combat 模板；provider 异常、非法 DTO、越界整数直接拒绝，不能伪装缺席。

成长模块解释它自己的数据映射与临时效果，combat 只消费 `status: supported / staminaCapacity / poiseCapacity / revision`。两容量均为 1–1,000,000 整数；revision 为 `sha256:` 加 64 位小写十六进制。当前成长换算选择 A：基础容量加属性投入的受限整数加值，再应用成长已声明的容量效果；实际绑定、整数系数/分母与上下限在成长包配置。恢复速率、费用、恢复相位与动作时钟仍为 combat 模板值。

- 容量更新选择 A：`newCurrent = min(oldCurrent, newCapacity)`。容量增加不补值，下降截断溢出，反复开关效果不能刷满
- 容量同步保留原恢复延迟、定点余数、防御窗口与已付费动作。仅后续真实恢复 tick/付款按原 full-pool 规则处理余数；提高韧性不解除已经开始的硬直
- 支持成长 adapter 的已物化资源行保存 `combatStats: { staminaCapacity, poiseCapacity, revision }`。精确加载必须与候选世界 actor 的纯查询一致，删除/伪造 DTO 或过期 revision 拒绝；attach/load/预览不补值、不修档
- 同步仅发生于付款、权威 elapsed 或机械结算。新行从模板初始绝对余额开始；只有正常恢复或实际成功休息可填新增容量
- 群体成员独立支付自己的体力；decision/time 与 poise-break 仍归核心。NPC 使用同一可信协议，且只支持成长配置批准的模板

### 7.3 3g 已提交战斗事实

`combat.event.v1` 提供四种事实：`attack-resolved / staggered / parried / rest-completed`。所有事实都有底座 factId、depth、turn 与公开 actor 身份；没有位置、未来招式或未公开 NPC 资料。

- `attack-resolved` 每个真实解算子段一次，以 actionId/sourceSubactionId/segmentIndex 唯一标识，含有界 hitCount/hpLost 摘要；windup 不发布，原生逐击 physicalResolved 保持原职责
- `staggered` 仅韧性真正耗尽并开始硬直时发布；已有硬直的后续命中不重复发布
- `parried` 引用原有 defended hook 分配的真实 resolutionId；同次成功弹反可以另产生攻击者 staggered，这是不同事实
- `rest-completed` 在恢复、完成计数与收据全部成功提交后发布，含 actor/action/bonfire/visit；中断休息不伪造成功

底座按稳定模块 ID 排序，每个根事实只分配一次 ID，并为消费者预留互不碰撞的有界派生范围。原生改变、模块 state、事实计数、消息及两 RNG 处于同一提交事务；任意消费者或预算失败一起回滚。没有消费者时不产生队列或额外事实 ID。读取、重复加载与 replay/seek 不补发旧事实。narrative 用数据声明事件、公开 actor 角色/标签、条件、次数与唯一收据键，在安全点只应用 flag/计数/旁支资格，不允许订阅发奖励；不会自动打开对话。订阅种类在注册时冻结，未订阅的事件不分配队列/ID或执行原生事实检查点。

原生没有 phased action 的 stagger/parry 使用 actionId=0；群成员 generation 从0开始，来源同 tick 退休仍保留事务开始时的可信来源身份。具体写集、独立审查与开发期验证见 [3g 报告](phase3g.report.md)。完整收尾门禁仍等4f统一通知。

以下仍未实现：`combat.attack-profile.v1`（仍使用 combat 自有 nativeProfiles）、`combat.public-state.v1`（已有 UI view 不等于剧情查询协议）。内容不得直接 import growth/narrative 实现；篝火、部位破坏及 combat 独立启用不依赖它们存在。现有 HUD 玩家行动计数保持 logger.turn 口径。

## 8. 公开输入、只读显示与确定性

当前玩家输入统一为 `game.executeCommand('ext:command', JSON.stringify(input))`，外层精确为 `module / action / payload`，没有另加 `v`、actorId、源成员 ID 或 session token 的字段。

```ts
// 攻击：攻击 ID 须属于玩家当前 profile
{ module: 'combat', action: 'attack', payload: { attackId: 'fixture.slash', facing: 'e' } }
// 闪避和弹反
{ module: 'combat', action: 'dodge', payload: { facing: 'n' } }
{ module: 'combat', action: 'parry', payload: { facing: 'w' } }
// 休息：数字为当前世界实体 ID，不能填定义字符串 combat.bonfire
{ module: 'combat', action: 'rest', payload: { bonfireId: 123 } }
```

上述是输入对象示意；`123` 不保证存在。真实 UI 应从当前公开列表取得篝火 ID。`ui/view.ts` 提供 `readCombatUiView / buildCombatUiCommand / buildCombatRestCommand`，按当前 session/revision 复核显示选择，再交引擎重复检查资格、资源、几何及风险。按钮 `canUse` 是提示，不是授权世界写入；NPC 使用底座 actor scope/调度入口，不能伪造玩家 actorId 或嵌套执行玩家命令。

显示使用脱离实体的模块 view 和公开 `DisplayFrame`，危险格/来源可见性由底座裁切。历史 ACK/演出帧不能回查未来 live 状态填补未知 HP、部位、资源或弹反属性。方向对话与篝火说明复用 `DialogHost / DialogInput`；不要另加一套 window 键盘/触屏屏障。

确定性必须保留的要点：

1. 规则修改经正式命令或可信 NPC 执行入口；预览、打开/取消面板、文案和动画不推进机械时钟、不消耗实质 RNG
2. 前摇、段间隔、恢复、资源余数都按实际正 elapsed ticks；动画快慢/暂停不改变命中顺序。不要写 `Date.now()` 或每渲染帧扣资源
3. 每束/来源的持久阶段是唯一时钟，原生 `ticksUntilTurn` 为严格同步镜像。读档验证一致性，不能静默修复坏档或重放一次已经完成的攻击/休息
4. 持久 `sourceFootprintVersion` 是机械几何指纹；会话 revision 只是防陈旧凭据，读档先验证候选世界再重新绑定。不要持久化 UI session object
5. 机械 JSON 的规范指纹忽略对象键顺序、保留数组顺序；改招式顺序、数值或绑定会改变规则身份。locale 文本值不在机械指纹内，但机械包里的文本键、glyph/color 等字段仍在指纹内
6. module/rules/数据指纹与精确启用集合共同校验。当前不迁移旧规则存档/录像；不能为了继续读旧档而保留伪造指纹。升级版本须同步 JSON、TypeScript 字面量、loader、常量和对应测试，不改 JSON 一处就宣称兼容

## 9. 常见调数任务与作者检查表

| 目标 | 调整位置 / 额外注意 |
|---|---|
| 增大体力池 | 改策略 capacity，明确是否也改 initial；所有引用 profile 共用该策略，NPC 同时受影响 |
| 放缓攻击压力 | 提高 windup/段间隔或 recovery；总时长仍受上限，玩家动作本身也会锁定更久 |
| 改耗体与续航 | 同时看 attack cost、nativeAttackCost、延迟、恢复分数及允许阶段；零费用仍会重置延迟 |
| 减少硬直 | 增大 poiseCapacity、减少有效 poiseDamage 或调整恢复；`poiseImmune` 只管韧性 |
| 增加 NPC 招式 | 定义完整八向招式→加入 profile→绑定正确物种 ID；数组顺序影响实际 AI 首选 |
| 调整危险区 | 修改每段八向 offsets；用单格、方形及当前真实 mask/成员各验预算、排除自身和作用线 |
| 制作不可弹反重击 | 段 `parryable: false`；`dodgeable` 单独决定，不能只改文字 |
| 改篝火恢复内容 | 三个 restore 字段分别 full/none；不能通过字段顺带重置世界、专注或冷却 |
| 减少篝火 | 缩小深度范围/名额并保持总预算；无位行为选 skip/defer，不能指望重访补发 |

提交前至少核对：

- 包能由真实 loader 加载；必需键、所有引用、八向格子、总时长/总定义/总放置预算合法，locale 齐全
- 正式自然出生路径确实使用新物种/profile；手工 fixture 验证几何不等于自然生成和真实录像证据
- 资源付款一次、失败/No 免费、当前窗口终点正确；投射物/环境、来源变化、满池和低容量等边界没有被文案掩盖
- 有效命中与 fixed-zone/member 传导不重复费用/效果；part-break handled/fallback 互斥、失败共同回滚
- 新局、save/load、逐条 replay、seek、存档续录及缺模块/版本拒绝都有相关覆盖；坏档不退休旧 live Game
- 测试归属留在模块目录与其 `test-suites.json`；通用底座 fixture 不 import 可删除内容模块

相关最小测试入口可从 `combat_schema`、`combat_runtime`、`combat_native_stamina`、`combat_defense_state`、`combat_dodge`、`combat_parry`、`combat_part_break*`、`combat_bonfire*`、`combat_square_replay` 和直接受影响的底座专项选择，仍以本次授权/交付门禁为准。阶段 3 开发期不把完整 `npm test`、全部 `test:ext`、真实 removal 矩阵重复跑在每个小步；收尾所需完整门禁、组合 smoke、删除证据和真实浏览器验收另行按路线执行，不能用定向测试或本文代替。
