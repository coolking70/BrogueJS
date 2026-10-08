# 采食模块配置手册（5G，1.0.0）

## 1 安装与通用约定

本文面向采食内容包作者；首发数据与名称以[5G任务书 §5–§7](phase5g.dot-package.md)为准，运行接口以当前冻结 SDK 为准。本文的三个修改例子均为未批准的后续提案。

模块目录 `src/ext/modules/foraging/` 由 catalog 自动发现，descriptor id 为 `foraging`，默认关闭，仅依赖 foundation 10 / worldSdk 1 / edible SDK 1。新局选择“采食”即生效；一局的模块集合固定。仅采食可完成发现、采集、吃、扔、绰号、知识、同伴喂食闭环。烤制需要可选 combat 篝火或 crafting 的火炉；没有热源时仍可正常采食。

机械配置在 `data/definitions.json`；文本在 `locales/zh_CN.json`。所有对象要求精确键集、安全整数、纯 JSON；getter、非标准原型、未知键、缺键、undefined、循环引用等均拒绝。可食、节点、知识组、放置组、需求共用 owner 前缀 ID 空间，禁止重复。数组顺序是规则身份的一部分，不可随意重排。首次安装先严格校验，失败不做部分注册。定义 ID 使用 `foraging.` 前缀和小写字母、数字、点、连字符，最长128字符；种类 ID、外观池 ID 和需求档位 ID 是各自表内的局部 ID，不要求该前缀。

当前是受审阅的固定首发包：12 种、24 个可食定义、12 个节点、18 个外观、1 个知识组、1 个放置组和1个需求。下文新增种类与改档位例子是后续作者修改提案，必须同步 schema、黄金测试并经审阅，不能只编辑 JSON 就声称当前严格加载器会接受。

## 2 字段目录

### 根与种类

| 字段 | 类型 / 范围 | 含义 |
|---|---|---|
| schema | 整数 1 | 数据格式 |
| moduleId | 字符串 `foraging` | 稳定模块身份 |
| moduleVersion / rulesVersion | 字符串 `1.0.0` | 首发版本，修改需有明确版本决定 |
| kinds | 数组，当前恰12行，≤limits.kinds | 顺序为所有交叉表与烤制 ordinal 的来源 |
| kinds[].id | 唯一审阅字符串 | 当前 mend、venom、prism、astray、upheave、farsense、veil、drowse、blast、might、stiffen、quicken，顺序固定 |
| minDepth | 1…40 安全整数 | 最浅出现地牢层 |
| weight | 1…100 安全整数 | 放置种类相对权重 |
| satiety | 1…2150 安全整数 | 生菌饱腹，烤菌还须满足 +100 后≤2150 |
| reveal | always / if-injured / if-not-already / on-explosion | 已批准的效果可见性判断，不能从 applied 代替 |
| companionReveal | boolean | 同伴反应是否能揭示；另须可见且非免疫、非不适用 |

### 可食定义 edibleItems

顺序必须为12生→11烤（跳过 blast）→焦炭。

| 字段 | 类型 / 范围 | 含义 |
|---|---|---|
| owner / id | `foraging` / `foraging.<kind>` 等唯一 ID | 生、烤、焦分别无后缀、`-roasted`、`foraging.char` |
| nameKey / descriptionKey | 本模块已存在的 locale 键 | nameKey 中性兜底，玩家名称交给知识解析 |
| glyph / color | 单码点 / `#RRGGBB` | 生烤统一 `菌` / `#B8A4E0`；焦 `炭` / `#6B5B53` |
| maxStack | 1…20 整数 | 首发20，同知识组所有生烤一致 |
| tags | 去重排序字符串数组 | 生烤恰 `food.ingredient.mushroom`；焦空数组 |
| satiety | 0…2150 整数（生菌本包1…2150） | 首发按种类表，烤=生+100，焦20；未知时不投影精确值 |
| effect | 下表联合对象 | 每种恰一个意图，无模块自行执行的状态公式 |
| fire | 下表联合对象 | 整堆接触规则，由底座执行 |

下面列出 SDK 意图的字段类型和通用范围，便于作者理解。当前模块 schema 仍逐种固定任务书 §5.2 的意图及全部参数；例如不能仅将回复30%改成31%就直接加载。增改这些值须先审阅，再同步 schema 与黄金表。时长 `turns` 均为回合，1回合=100刻；饱腹为 nutrition 点。

意图完整形状：

- `{kind:'none'}`：无效果
- `{kind:'heal-fraction',percent,min}`：percent 1…100、min 0…1000；首发回复30%、至少5
- `{kind:'status',status,turns}`：status 为 poisoned/hallucinating/confused/nauseous/telepathy/darkness/haste/paralyzed/slumber；turns 1…1000
- `{kind:'status-and-satiety',status:'nauseous',turns,satietyLoss,floor}`：turns 1…1000，satietyLoss 1…2150，floor 0…2150；首发15、300、150
- `{kind:'temp-stat',turns,player:{key,value},other:{key,category,valueBp}}`：turns 1…2000；player.key 为字符串物化键（SDK支持 `native.strength`、`native.max-hp`），player.value 为有符号安全整数；other.key 为 SDK 已公布的查询属性字符串，other.category 为 `increased` 或 `more`，other.valueBp 为安全整数（increased −9000…50000，temporary more 0…40000；attack-speed/move-speed的more下限例外为−5000）。首发仅 native.strength +2、native.physical-damage-dealt more +2500bp、400回合；不能自行新增属性
- `{kind:'explosive'}`：吃无效果；只遇火爆炸
- `{kind:'derived-choice',domainId:'foraging.roast-policy',ordinal,options:[rawEffect,{kind:'none'}]}`：只用于烤菌，ordinal为安全非负整数且=kinds下标；options[0]保留、options[1]去除，底座各以50%抽样，模块不计算或缓存 keep/strip

fire 只有三类：`{onContact:'transform',to,messageKey}`（生→同种烤，烤→char），`{onContact:'explode',largeAtQuantity:3,messageKey}`（仅blast），`{onContact:'burn-up',messageKey}`（仅char）。目标同owner、闭包完整、无环，目标堆叠上限不小于来源。消息键来自既有四条 fire 文案。

### 节点 resourceNodes

每种一行，顺序同kinds。owner/id/nameKey/descriptionKey/glyph/color 含义同上；id=`foraging.<kind>-patch`，fallback名称均“菌丛”。`kind:'fungus'`；`yield:[{itemDefinitionId:'foraging.<kind>',count:1}]`；`capacity:3`；`harvestTicks:100`；`unitsPerHarvest:1`；`requiredToolTag:null`；`regeneration:{kind:'periodic',units:1,intervalTicks:32000}`；`placement:{dungeon:null,site:null}`。这是固定首发约束，不能绕过放置组独立生成节点。物化时不积存满容量溢出。

### 知识组 knowledgeGroups

恰1行：owner=`foraging`、id=`foraging.mushrooms`；`assignmentDomainId:'foraging.appearance'`。`kinds[]`每行含id/raw/roasted/node/knownNameKey/knownDescriptionKey；生、烤、节点引用一一对应，blast.roasted=null。`appearancePool[]`18行含唯一id/nameKey/descriptionKey，固定审阅顺序；SDK最大64且至少种类数。`templates`恰 roasted/node/tastedNote/roastUnknownNote/called/unknownDetail 六键：roasted/node各一个`{{name}}`，called各一个`{{name}}`与`{{title}}`，其余无占位符。

未知→尝过→已知单调；生已知不推断烤效果，烤揭示同时揭示生。无效果不等于无营养。魔法鉴定/探测/最后种类升格不进入本知识组。

### 放置组 placementGroups

恰1行，owner=`foraging`、id=`foraging.patches`。members[]同节点顺序，每行resourceDefinitionId/minDepth/weight，后两项须等于kinds。perDepth[]每行fromDepth/toDepth/min/max，范围1…40，区间递增不重叠，数量0…32且max≤limits.nodesPerLevel；首发D1–3 1…2，D4–40 2…3。maxPerRun首发120，≤limits.nodesPerRun。preference固定：tags两种`terrain.fungus-forest`、`terrain.luminescent-fungus`，radius3、preferredWeight4、otherWeight1。SDK一般范围tags≤2、radius0…8、权重1…16，但本包首发固定值。无空位/预算不足只由底座记skip，不自行补生成。

### 需求 actorNeeds、同伴 companion

actorNeeds恰1行，owner=`foraging`、id=`foraging.companion-satiety`，role=`satiety`。max2150、initial1800、ticksPerPoint200；bands按fed2150→hungry300→weak150→starving0排列（阈值含上界）；zeroDeadlineTicks30000；departure.visibleGraceTicks2000。SDK一般范围max/ticksPerPoint1…1000000，initial0…max，bands1…8且首阈值=max、其后严格下降，deadline null或1…10000000，grace0…100000且100倍数；本包固定上述首发值。

companion恰五键：needId引用该需求；component=`hunger`；penalties恰weak/starving两行，每行band/accuracyIncreasedBp/damageIncreasedBp，分别−2000/−2500与−4000/−5000；temporary increased层、不使用weaknessAmount。nonEaters为去重码点排序模板字符串数组，当前20行、上限 `limits.nonEaters`（至多64）；模板 ID 最长128字符，使用小写字母、数字与分隔单词的下划线，新增前须核对怪物目录。residentQuery固定`settlement.resident-status.v1`；仅available且value严格为`{resident:true}`排除，缺席/异常/畸形均非居民。

还自动排除非盟友、无生命、限时召唤、群体成员；群体核心可饥饿。同伴不饿死、不自行找吃的，饥荒300回合后离队；视野内最多20回合离开，视野外立即退役。进食使目标饱腹值回到正数时，由底座清除零点截止。

### limits

八个键均必填、正安全整数，缩小也必须容纳实际数据：

| 键 | 允许范围 | 约束对象 |
|---|---|---|
| kinds | 1…32 | 菌种行数；当前数据至少需要12 |
| appearancePool | 1…64 | 外观池行数；当前数据至少需要18 |
| edibleItems | 1…128 | 生、烤、焦全部可食定义；当前至少需要24 |
| maxStack | 1…20 | 每个可食定义的堆叠上限；当前数据需要20 |
| nodesPerLevel | 1…3 | 每个perDepth区间的max；当前数据需要3 |
| nodesPerRun | 1…120 | 放置组maxPerRun；当前数据需要120 |
| nonEaters | 1…64 | 排除模板名单长度；当前数据至少需要20 |
| history | 1…64 | 模块保留的最新事件条数，超出丢最旧 |

history最多64条，仅记录事件枚举与事实序号/时刻，不记录菌种 ID、definitionId 或名称；其中 history.kind 是 eat/feed/fire/need 事件类别，并非菌种。计数在 MAX_SAFE_INTEGER 饱和。

### 严格校验与跨表约束

`assertForagingPack(value, localeKeys)` 先拒绝非 JSON、访问器、循环、稀疏数组、隐藏键、符号键和原型污染，再核对精确对象键集。校验失败会抛错，`createForagingModuleFromPack` 不会返回一个部分注册的模块。

- kinds 的12个 ID、顺序、reveal 与 companionReveal 均固定；每种生定义的意图必须是其指定单一意图
- 生、烤、焦炭排列固定；烤 satiety=生+100，ordinal=种类下标，options[0]与生意图深度相等，options[1]只能是none；blast无烤定义
- 节点产物、知识组成员与分组成员一一指向对应种类；成员的minDepth/weight与kinds一致；节点独立placement双null
- 知识组生烤glyph/color/maxStack/tags一致，节点glyph/color同组一致；char不进入知识组且tags为空
- 每个名称、描述、模板、火消息键都有本模块前缀且在localeKeys中存在；固定模板占位符另由底座安装检查及T-NAME守护
- 需求、档位与惩罚保持首发定值；nonEaters排序去重；所有计数与预算符合limits，不能通过放松上限掩盖越界

限值只能在数据仍可容纳时收紧。例如kinds上限可收紧至12，appearancePool可收紧至18，edibleItems可收紧至24；把nodesPerLevel收紧为2而仍保留D4起每层最多3丛会被拒绝。

## 3 命名与审阅

已知12名：愈合菌、蚀骨菌、苍鸾菌、迷途菌、翻胃菌、通心菌、匿影菌、沉眠菌、爆燃菌、蛮力菌、僵缚菌、迅步菌。
外观18名：低语菌、霜息菌、星屑菌、回响菌、符纹菌、晶棱菌、烟缕菌、幽铃菌、月砂菌、镜面菌、雾心菌、针光菌、寂鸣菌、温石菌、琉璃菌、虹痕菌、逆影菌、沙漏菌。

全部以“菌”结尾、互不重复、无ASCII字母数字、纯奇幻，不描写现实菌体形态或暗示现实药理；不得运行期合成新名，仅用底座固定烤/丛/附注/绰号模板。既有200条文案不得改字。

全部locale值扫描禁用词：菇、蘑、蕈、菌盖、菌褶、菌柄、菌环、菌托、斑点、伞、毒、鹅膏、牛肝、松茸、香菇、平菇、金针、鸡枞、鸡油、灵芝、竹荪、羊肚、木耳、银耳、猴头、松露、茯苓、虫草、孢子、致幻、迷幻、药、治病、疗效、食用菌。

改名单流程：先提审新名称/描述及理由→维护者审阅→改数据与locale→更新schema固定名单及T-NAME人工快照→跑全套定向门禁→记录规则版本/指纹变化。不能先放宽禁词或替换测试预期来让未经审阅的名称通过。

## 4 版本、指纹与底座分工

rules=`{schema:1,version:'1.0.0',fingerprint:extensionDataFingerprint(pack)}`。完整pack参与指纹，机械数值、任一数组重排、glyph/color、需求、nonEaters或limits变化都会改身份；locale文本不进rules指纹。底座另将owner世界包与算法绑定为`worldDefinitionFingerprints().foraging`，以此为外观分配、烤制政策、放置的派生盐；世界包变化可能同时改变三者。仅改变companion/limits等包自有规则必改rules指纹，不一定改变世界包盐。严格旧档/录像校验拒绝不匹配身份，不迁移。

模块声明数据、校验payload、观察事实并写本owner知识/state/component；吃/扔/确认/火/效果/知识名称解析/需求时钟/离队/放置/存档录像由foundation负责。生产导入只能走任务书白名单；stat类型从ExtensionModule派生。禁止自造时钟/RNG/烤制抽样/调度、Game写入、共享组件修改或绕过SDK。

## 5 三个完整修改示例

### 示例一：提审第13种及其完整引用闭包（未批准）

这是尚未批准的未来作者提案，不属于5G执行名单，也不能直接载入当前schema。新名“星径菌”与描述须先审阅；不新增外观池（18≥13），沿用现有加速单一意图作为例子，不引入新的SDK能力。把kind追加到kinds末尾；raw插入全部生菌末尾；roasted插入全部烤菌末尾、焦炭之前；节点/知识/分组成员分别追加。已有种类ordinal不变，新ordinal12。下面每个对象是完整对象，不是省略字段的patch：

```json
{
  "kind": {
    "id": "starpath",
    "minDepth": 9,
    "weight": 3,
    "satiety": 180,
    "reveal": "always",
    "companionReveal": true
  },
  "raw": {
    "owner": "foraging",
    "id": "foraging.starpath",
    "nameKey": "ext.foraging.item.starpath.name",
    "descriptionKey": "ext.foraging.item.starpath.description",
    "glyph": "菌",
    "color": "#B8A4E0",
    "maxStack": 20,
    "tags": [
      "food.ingredient.mushroom"
    ],
    "satiety": 180,
    "effect": {
      "kind": "status",
      "status": "haste",
      "turns": 10
    },
    "fire": {
      "onContact": "transform",
      "to": "foraging.starpath-roasted",
      "messageKey": "ext.foraging.fire.roasted"
    }
  },
  "roasted": {
    "owner": "foraging",
    "id": "foraging.starpath-roasted",
    "nameKey": "ext.foraging.item.starpath-roasted.name",
    "descriptionKey": "ext.foraging.item.starpath-roasted.description",
    "glyph": "菌",
    "color": "#B8A4E0",
    "maxStack": 20,
    "tags": [
      "food.ingredient.mushroom"
    ],
    "satiety": 280,
    "effect": {
      "kind": "derived-choice",
      "domainId": "foraging.roast-policy",
      "ordinal": 12,
      "options": [
        {
          "kind": "status",
          "status": "haste",
          "turns": 10
        },
        {
          "kind": "none"
        }
      ]
    },
    "fire": {
      "onContact": "transform",
      "to": "foraging.char",
      "messageKey": "ext.foraging.fire.charred"
    }
  },
  "node": {
    "owner": "foraging",
    "id": "foraging.starpath-patch",
    "nameKey": "ext.foraging.node.starpath.name",
    "descriptionKey": "ext.foraging.node.starpath.description",
    "glyph": "菌",
    "color": "#B8A4E0",
    "kind": "fungus",
    "yield": [
      {
        "itemDefinitionId": "foraging.starpath",
        "count": 1
      }
    ],
    "capacity": 3,
    "harvestTicks": 100,
    "unitsPerHarvest": 1,
    "requiredToolTag": null,
    "regeneration": {
      "kind": "periodic",
      "units": 1,
      "intervalTicks": 32000
    },
    "placement": {
      "dungeon": null,
      "site": null
    }
  },
  "knowledgeKind": {
    "id": "starpath",
    "raw": "foraging.starpath",
    "roasted": "foraging.starpath-roasted",
    "node": "foraging.starpath-patch",
    "knownNameKey": "ext.foraging.kind.starpath.name",
    "knownDescriptionKey": "ext.foraging.kind.starpath.description"
  },
  "placementMember": {
    "resourceDefinitionId": "foraging.starpath-patch",
    "minDepth": 9,
    "weight": 3
  },
  "localeProposal": {
    "ext.foraging.kind.starpath.name": "星径菌",
    "ext.foraging.kind.starpath.description": "吃下后脚步暂时变快。",
    "ext.foraging.item.starpath.name": "奇异的菌",
    "ext.foraging.item.starpath.description": "一株说不出来历的菌。",
    "ext.foraging.item.starpath-roasted.name": "烤过的菌",
    "ext.foraging.item.starpath-roasted.description": "一株烤过的菌。",
    "ext.foraging.node.starpath.name": "菌丛",
    "ext.foraging.node.starpath.description": "一丛奇异的菌，采过之后会慢慢长回来。"
  }
}
```

同时更新schema的受审阅ID/特性数组与精确长度（13种、26可食、13节点）、黄金表与名称快照；保留全部禁止词测试和引用闭包检查；按审阅决定更新规则身份/版本，不迁移旧档。上限32/128/64无需放松。这个提案没有修改本次生产数据或固定locale。

### 示例二：同伴下降加快、提前提示（未来审阅提案，未批准）

把需求完整替换为下列对象，饱腹下降从每200刻1点改为每100刻1点，hungry/weak阈值提前到400/200。max/initial/零点deadline/离开grace不变；惩罚仍weak −2000/−2500、starving −4000/−5000。该示例须同步更新schema固定NEED、黄金表、精确tick测试和手册，不改底座时钟。

```json
{
  "owner": "foraging",
  "id": "foraging.companion-satiety",
  "role": "satiety",
  "max": 2150,
  "initial": 1800,
  "ticksPerPoint": 100,
  "bands": [
    {
      "id": "fed",
      "atOrBelow": 2150
    },
    {
      "id": "hungry",
      "atOrBelow": 400
    },
    {
      "id": "weak",
      "atOrBelow": 200
    },
    {
      "id": "starving",
      "atOrBelow": 0
    }
  ],
  "zeroDeadlineTicks": 30000,
  "departure": {
    "visibleGraceTicks": 2000
  }
}
```

从initial1800算：hungry在140000刻、weak在160000刻、starving在180000刻，若未喂食则deadline在210000刻。喂食恢复跨档消息仍由底座逐档发布，不能模块补发。改前评估与原生玩家饥饿速度关系。

### 示例三：名单删除一个模板、加入另一个模板（未来审阅提案，未批准）

示例删除bloat、加入bog_monster（只说明操作，未获批准，不改变本次20模板决定）。已核对 `src/data/monsters.json` 存在 `id:"bog_monster"`；正式改动仍须先确认设计理由，再用码点序排序和去重；它们仍受无生命/限时/群体成员/居民的通用排除。完整companion如下，可由现有结构schema校验；正式变更还须改黄金名单、版本审阅与真实资格回归：

```json
{
  "needId": "foraging.companion-satiety",
  "component": "hunger",
  "penalties": [
    {
      "band": "weak",
      "accuracyIncreasedBp": -2000,
      "damageIncreasedBp": -2500
    },
    {
      "band": "starving",
      "accuracyIncreasedBp": -4000,
      "damageIncreasedBp": -5000
    }
  ],
  "nonEaters": [
    "arrow_turret",
    "bog_monster",
    "dart_turret",
    "explosive_bloat",
    "flame_turret",
    "flamedancer",
    "golem",
    "ifrit",
    "lich",
    "mangrove_dryad",
    "phantom",
    "phoenix",
    "pit_bloat",
    "revenant",
    "sentinel",
    "spark_turret",
    "vampire",
    "wisp",
    "wraith",
    "zombie"
  ],
  "residentQuery": "settlement.resident-status.v1"
}
```

## 6 作者自检

- 只编辑模块目录与批准的自有文档；无共享代码、其他模块或配置更改
- 数据/名字变动已审阅，所有对象严格键集、引用与顺序闭合
- 生烤意图一致、ordinal正确、blast无烤定义、节点同字形同色
- 非已知信息不出投影，未知营养为null，UI仅显示“少量”
- 无新增RNG、时间推进、Game写入或共享SDK旁路
- 需求档位、nonEaters排序、可选居民查询fail-open行为有测试
- 配置修改后规则指纹与世界包盐影响已记录，旧档拒绝已验证
- boundary / vue-tsc / build / 全部foraging定向测试 / 受影响旧测试 / drift / 七相关组合 / 两条自然trace已运行并如实记结果
- 浏览器能力实际检查，未运行不能声称通过；完整npm test、全部test:ext、64子集与删除门禁留5Z
- 交接settlement仅按food.ingredient.mushroom标签求quantity总和；厨师不得读取隐藏kind或改变知识

## 7 集中修订的事务与首版反馈合同

本节依照 `phase5g-revision.dot-package.md`，覆盖旧包“参与者绝不抛”的泛化解释；不改机械数据、固定名称、规则身份或接口版本。

- `onConsumed/onFireContact/onNeedEvent` 在首个 writer 前完成全部事实/state验证与纯规划。畸形、重复、外owner输入保守返回且零writer；`qualifies`及可选居民查询仍布尔兜底
- 提交开始后，知识、消息、state、组件和depart writer异常必须传播到foundation；不得吞错、继续写或补偿。`markKnowledge=false`为正常的未新增/未升级结果
- eat/feed的消费参与者与主动roast的火参与者失败：已有外层事务回滚，命令仍录制，零成本C5_PROVIDER。环境火和所有需求参与者（也包括feed产生的需求事件）失败：仅撤销参与者写入/缓冲消息/本事件depart请求，保留先前机械结算并记诊断，不保证重投或整笔feed回滚
- revealed按产生新known知识的事实计数，同一烤菌事实两次知识写返回值取OR、最多加1。重复known、降级与仅tasted不增加revealed，正常消费计数仍增长
- worldSdk已有可选`lastCommandError`读口；固定ForagingView不投影具体提交错误。维护者明确接受首版通用拒绝反馈，本轮不增加lastError字段、不猜测错误码；节点已有reason仍显示相应原因。此为首版规格裁定，不称所有具体提交码已实现

特殊布景持久化与自然录像分列：真实同伴沉眠可在公开feed完成后保存；玩家沉眠通常在同一食用命令内同步排空到醒来，不虚造命令间保存窗口。九类特殊布景各自完整新局录像移交5Z。
