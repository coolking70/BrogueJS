# 叙事内容配置手册

本文面向新增 NPC、对白、剧情事件和立绘的内容作者，按当前实际加载器与执行代码说明，不把 [阶段 2 设计](phase2-narrative.md) 中的接口草图当作已实现功能。路径均相对仓库根。分支政策与交付门禁以 [路线](README.md) 为准；本页不改变阶段授权或旧报告的验收结论。

## 1. 从哪里改

| 文件 | 内容作者的用途 |
|---|---|
| `src/ext/modules/narrative/data/definitions.json` | 唯一机械内容包：预算、标记、计数器、NPC、放置、对话图、日志定义、事件与触发器 |
| `src/ext/modules/narrative/locales/zh_CN.json` | 扁平的 `ext.narrative.*` 文本键到中文字符串映射；包括名字、对白、选项、禁用原因、日志与立绘替代文本 |
| `src/ext/modules/narrative/data/portraits.json` | 独立显示清单：立绘 ID、本地图片相对路径、尺寸、占位字形 |
| `src/ext/modules/narrative/assets/portraits/` | 新增图片的实际目录；当前包含三位 NPC 的原创 GPT 生成像素立绘（48×64 索引色 PNG、共享调色板） |
| `src/ext/modules/narrative/schema.ts`、`types.ts` | 结构、范围、引用、退出路径、循环与版本校验的实际依据 |
| `conditions.ts`、`effects.ts`、`triggers.ts`、`placement.ts` | 位于同一模块目录；条件、效果、事件顺序、收据及放置语义 |
| `state.ts`、`input.ts`、`sessions.ts` | 持久状态与命令合同；内容作者不要手改存档或自行造会话 ID |
| `ui/portraits.ts`、`ui/NarrativePortrait.vue` | 只读立绘解析与加载失败降级，不拥有世界状态 |
| `tests/`、`test-suites.json` | 模块自有测试与登记清单；新增测试也须登记 |

普通内容增删、数值调整只需改数据与 locale，不为某个 NPC 或奖励 ID 在解释器、UI 或 Game 内写特判。不支持 JSON 中嵌入脚本、HTML、远程请求、自由文本对话、巡逻/跟随/可伤害 NPC、商店或物品授予；新增解释器能力是另一个实现任务。

模块默认 `defaultEnabled: false`，开局选择“叙事交互”才启用。可以单独选 narrative，也可以与 growth 组合；一局内集合固定。没有 growth 时不要求创建成长角色，对话和日志照常工作。

## 2. 当前版本、默认样例与基本约定

### 2.1 版本表

| 标识 | 当前值 | 校验/用途 |
|---|---|---|
| `definitions.json.schema` | `1` | 数据结构版本 |
| `moduleId` | `"narrative"` | 稳定模块 ID |
| `moduleVersion`、`rulesVersion` | 均为 `"1.4.0"` | 当前加载器只接受此精确值，并非任意 semver |
| `stateVersion` | `4` | 模块私有持久状态 `schema: 4` |
| `inputVersion` | `2` | open/choose/close 的 payload 必须带 `v: 2` |
| `descriptor.ts.foundation` | `5` | 底座要求；不是内容开关 |
| `portraits.json.schema` | `1` | 显示清单结构 |
| `portraits.json.displayVersion` | `"1.2.0"` | 独立显示版本，格式为三段数字 |

模块持久状态保存在 `extensions.modules.narrative`，不会另建顶层 narrative 存档；包括 flags/counters、日志、触发/奖励/放置收据、NPC 绑定和当前会话。内容定义不写入该状态来替代版本校验。

规则指纹由完整 `definitions.json` 的规范化内容生成。改对白键引用、NPC 的 `portraitId`、数值、顺序或其它包内字段也会改变指纹，即使版本数字未动；格式空白和对象键排列不属于机械差异。存档/录像按精确模块集合、版本和规则指纹校验，不迁移旧内容包，不静默剥除缺失模块。

- 只修改现有 locale 的文字、既有立绘 ID 对应的图片/显示元数据：不进入机械指纹；立绘显示内容变更更新 `displayVersion`
- 在 `definitions.json` 改立绘绑定、新增节点/NPC/事件或调整规则：属于规则包变更，应按版本策略审查，另开新局验证
- 升级 module/rules 版本须同步 `definitions.ts` 的 `NARRATIVE_VERSION`、`types.ts`、`schema.ts` 精确校验与相应用例，不能只在 JSON 改数字。状态/输入合同改变时再同步其版本与读写验证器

### 2.2 仓库实际默认内容

- NPC `archive.keeper`（档案守卫），字形 `人`、颜色 `#c3ad80`、交谈距离 1、默认立绘 `archive.keeper.neutral`
- 放置 `archive.first`：D1 首访，每局/每层上限均为 1，距楼梯至少 1 格、距入口最多 8 格，无位置即 `skip`
- 对话 `archive.greeting`，入口 `hello`；阅读残页只在 `archive.read === false` 时可用，不满足时禁用并显示“已经读过这张残页”
- 阅读依次设置 `archive.read=true`、公开日志 `archive.note`、发出 `archive.read-done`；`next:null` 结束交谈。另一项 `leave` 恒可用、无效果、结束交谈
- 触发器 `archive.reward` 监听该 story 事件，每局一次，尝试 `growth.story-reward.v1` 的 `rewardId: archive.read`；不是固定发放经验
- growth 的默认配置 `config.experience.sources.story=false` ，已配置 `bell.settled` / `wick.settled` 各5XP报价，所以默认组合也不会给这个样例经验。缺席/关闭/未知报价均走有记录的 skip，见 §7
- 新增 `bell.mender`（缄钟匠）与 `wick.listener`（听烬人）：分别六/七节点、各两个互斥结局，D1–D2首访可放置，无位置defer。具体路径见本轮报告
- `bell.verdict` 的值为 unresolved/toll/hush，`wick.verdict` 为 unresolved/keep/release；结局生成独立日志并发出各自 settled 事件，触发各自一次性奖励收据。已结局时开场改为可选回顾路径，不再次发奖
- 缄钟匠的残页旁支以 `archive.read=true` 为条件；未读时禁用并解释原因，叙事单独启用仍可走全部两个结局
- 3g新增 `bonfire.rested`：玩家第一次真正完成篝火休息后置为true，解锁听烬人开场的“灰烬余温”旁支。不会自动打开对话、发消息、日志或奖励；未启用combat时旁支保持隐藏
- 三张立绘清单绑定 48×64 索引色 PNG，contain、bottom-center，共享 32 色调色板和二值透明背景；桌面 240×320，窄屏依照原 72×96/48×64 展示合同以最近邻放大，立绘页最大宽度 384px。缺图/失败降级仍保留，但不是实际资产的替代

这些都是文件里实际保存的样例，不是省略字段时由加载器补出的默认值。

### 2.3 所有定义共用的约束

规则包顶层完整键为 `schema,moduleId,moduleVersion,rulesVersion,stateVersion,inputVersion,config,flags,counters,npcs,dialogues,journal,storyEvents,triggers`；config 只有 `timePolicy,closePolicy,limits`，后文分别列出每个子结构。

- 对象列出的字段均须提供，未知字段拒绝；允许 `null` 的字段也不能直接省略。数组可为空的情形下也须写 `[]`
- 数字只允许安全整数，范围为 −9007199254740991 至 9007199254740991；不接受小数、NaN、Infinity 或自动类型转换
- ID 最长 128 字符，格式为 `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$`；例如 `road.scout`、`ask-route`。不允许下划线、大写、空格或 `constructor`、`prototype`、`__proto__`
- flags、counters、NPC、dialogue、journal、storyEvent、trigger、placement 的 ID 在整个规则包内不能重复。node ID 在本对话内唯一；choice ID 在整份本对话内唯一，不只是本节点。不同对话可以复用 node/choice ID
- portrait ID 在立绘清单内唯一；`optional-reward.receiptId` 在整包所有效果出现位置中唯一。这两类有自己的检查集合，建议仍按用途命名以免混淆
- 所有文本键最长 256 字符，格式为 `ext.narrative.` 后接字母、数字、`_`、`.`、`-`，并须存在于模块 locale；值为非空白字符串。文本按纯文本展示，不支持富文本
- 任意 JSON 字符串值最长 16384 个 UTF-16 代码单元，拒绝 `<`、`>`、`javascript:`、`eval(`、`new Function(` 等片段；不可把脚本或 HTML 写进说明
- 只接受普通纯 JSON 树；拒绝访问器、原型污染键、循环、函数、稀疏数组等。整体树深度上限 64，值节点上限 4000000
- 顶层各定义数组上限 4096；nodes、每节点 choices、placements 和字符串枚举数组也有 4096 上限，且还须满足以下更小预算与交叉检查

## 3. NPC 与放置

NPC 对象完整字段如下：

| 字段 | 类型/范围与含义 |
|---|---|
| `id` | 包内全局唯一 ID |
| `nameKey`、`descriptionKey` | 已存在的模块文本键 |
| `glyph` | 单个可打印 Unicode 标量；不是多个字符/组合字形，不接受控制、组合、分隔字符 |
| `color` | 六位十六进制 `#RRGGBB` |
| `portraitId` | 已登记 portrait ID 或 `null` |
| `dialogueId` | 已登记 dialogue ID |
| `presence` | 固定 `"stationary-interactable"` |
| `interactionDistance` | 0–16，切比雪夫距离；0 仅同格，1 包括相邻格及同格 |
| `placements` | 放置规则数组，可为空；空数组不会自动生成 NPC |

该 NPC 是底座的固定可穿行交互对象，不是敌人/盟友 Creature，不参与战斗、怪物 AI 或成长模板。开口需要当前层、玩家存活且处于允许交互的安全输入边界、对象稳定可见、距离内且交互线可达；不能隔双墙斜角说话。自动探索或跑动不会自动开口。条件数据不能绕过这些世界资格检查。

每条 placement 的完整字段：

| 字段 | 类型/范围 |
|---|---|
| `id` | 包内全局唯一 ID |
| `minDepth`、`maxDepth` | 1–40，包含端点，`minDepth <= maxDepth` |
| `maxPerRun` | 1–`config.limits.maxActiveNpcs`，该条规则整局可分配的槽位数 |
| `maxPerDepth` | 1–`maxPerRun`，该条规则本层尝试的槽位数上限 |
| `minStairDistance` | 0–256，距任意上下楼梯的最小切比雪夫距离 |
| `maxEntranceDistance` | `minStairDistance`–256，距入口的最大切比雪夫距离 |
| `onNoSpace` | `"skip"` 或 `"defer"` |

执行规则：

1. 只在首次实际进入某层并提交后尝试放置；重访不重放，读档不会重新抽位置。不改地图、不重试生成、不消耗 RNG
2. 在入口附近当前可见、可通行且交互线可达的安全 FLOOR 筛选；排除不透明/机关、气体、危险/陷阱/自动下落地形以及占用格等。候选按入口距离、y、x 排序，取合法候选
3. NPC/placement/实例按稳定 ID 次序处理，不以 JSON 注册顺序抽奖。各规则独立计数；同时仍受整局已绑定 NPC 总数上限约束，缓存楼层绑定也计入 `maxActiveNpcs`
4. `skip`：记该槽位已跳过，消耗本局槽位，不在以后补生。`defer`：保留槽位，记录本次深度，只在范围内更深且首次进入的层重试，不会退回较浅层或因重访重复尝试
5. 到 `maxDepth` 仍失败，或后续首次入层已越过它，待放槽位最终记为 skipped。配置上限/无空位造成的未放置都会按这一政策处理

## 4. 对话图与剧情状态

### 4.1 对话和选项

| 对象 | 完整字段 |
|---|---|
| dialogue | `id`、`entry`（本对话 node ID）、`nodes`（至少 1 项） |
| node | `id`、`textKey`、`portraitId`（已登记 ID 或 null）、`choices`（至少 1 项） |
| choice | `id`、`textKey`、`condition`、`unavailable`、`unavailableKey`、`effects`、`next` |

- node 的 `portraitId:null` 表示沿用 NPC 立绘；两者均 null 时使用通用字形占位，不表示禁止显示立绘区
- `next` 为本对话 node ID 或 `null`；null 结束会话，不是跳回入口。下次开口从 `entry` 开始，flags/counters/日志/收据保留
- `unavailable` 为 `hide`（条件不满足时不投影该选项）或 `disable`（显示但不可选）；`unavailableKey` 为已登记文本键或 null，推荐为禁用项提供原因
- `effects` 按数组顺序执行，可为空。选择前会重新核对当前 revision、session、node、选项和条件，不能靠旧 UI 快照选择失效选项
- 所有节点须从 entry 沿 next 结构可达。允许玩家手动选择形成循环，但每个节点必须有一条加载器能证明“恒真、无效果、最终 next:null”的退出路径；可跨多个节点。最简单做法是每节点保留 `{op:"true"}`、`effects:[]` 的离开项
- 退出路径不能依赖 flags、等级等运行时条件；即使实际总满足，也不算静态安全出口。`true/not/all/any` 的常量表达式可以证明恒真
- `config.timePolicy` 目前只支持 `"free-frozen"`；open/choose/close 不耗回合，活跃会话由引擎冻结世界。`closePolicy` 只支持 `"close-session"`，关闭不自动选择选项、不执行效果、不触发“离开事件”
- 读日志、看立绘和回放只读界面的查看操作不是剧情命令，不额外发奖。存档保存进行中的会话，load 恢复已保存状态而不重新触发开口/选择效果；replay/seek 则从重建的回放状态确定性地重新执行历史命令与效果，收据随状态一起重建，不在还原结果之外累积重复奖励

### 4.2 flags、counters、journal、storyEvents

| 目录 | 完整结构与约束 |
|---|---|
| `flags[]` boolean | `id,type:"boolean",initial:boolean,min:null,max:null,values:null` |
| `flags[]` integer | `id,type:"integer",initial:整数,min:整数,max:整数,values:null`；min≤initial≤max |
| `flags[]` string | `id,type:"string",initial:字符串,min:null,max:null,values:[非空字符串…]`；枚举至少 1 项且不重复，initial 在其中 |
| `counters[]` | `id,initial,min,max`；三者安全整数，min≤initial≤max；可以允许负数 |
| `journal[]` | `id,titleKey,textKey`；这里只登记定义，执行 journal 效果后才公开；定义总数不能超过 maxJournalEntries |
| `storyEvents[]` | 只有 `id`；声明可被 emit-story 发出的事件，不自动运行 |

标记与计数器是本局叙事状态，不是每个 NPC 实例独立一份。重复生成同一 NPC 默认共享任务进度；若需不同进度，须使用不同声明 ID 或另行设计实例化能力。journal 按 entryId 幂等，首次公开决定顺序，重复效果不增加条目。

## 5. 条件目录

条件是有限 AST，不接受表达式字符串或任意函数。下表列出每个变体的全部字段：

| `op` | 其余字段 | 语义 |
|---|---|---|
| `true` | 无 | 恒真 |
| `all` | `args:[条件,…]`，至少 1 项 | 全满足；运行时从左至右短路 |
| `any` | `args:[条件,…]`，至少 1 项 | 任一满足；运行时从左至右短路 |
| `not` | `arg:条件` | 取反 |
| `flag` | `id,equals` | 已声明标记的精确相等；equals 必须符合该标记类型/枚举/范围 |
| `counter` | `id,compare,value` | 已声明计数器与安全整数比较；compare 为 eq/ne/lt/lte/gt/gte |
| `depth` | `min,max` | 当前事实深度在闭区间内，1≤min≤max≤40 |
| `event-field` | `field,equals` | 只读当前事件允许的字段，见下表 |
| `optional-player` | `capability,field,compare,value,onUnavailable` | 只读可选 growth 玩家公开信息，见 §7 |

`event-field` 的合法上下文：

| 上下文 | 唯一合法 field | equals |
|---|---|---|
| `entered-level` trigger | `firstVisit` | boolean |
| `npc-interacted` trigger | `npcId` | 已声明 NPC ID |
| `dialogue-choice` trigger 或 choice 自己的 condition | `choiceId` | 本对话内已声明 choice ID |
| `story` trigger | 无 | 不能使用 event-field |

节点预览逐个选项使用该选项自己的 choiceId；它不是“上次选了什么”的查询。想判断历史选择，应由先前效果设置 flag/counter。没有任意事件 payload、隐藏怪物、世界字段或全局脚本查询能力。

加载时以最坏 AST 访问数核对整节点所有选项（包括隐藏项）共用的预览预算。运行时选择前置条件和整个因果事件链的触发条件共用执行预算；单项都合法不保证组合后的事件链不会超限。

## 6. 效果、触发器与原子性

### 6.1 效果目录

| `kind` | 其余全部字段 | 语义 |
|---|---|---|
| `set-flag` | `id,value` | 设置已声明标记；不做类型转换 |
| `add-counter` | `id,amount` | 安全整数加法，允许负数；结果须在声明 min/max 内，溢出拒绝，不钳制 |
| `journal` | `entryId` | 首次公开已声明日志，重复无额外条目 |
| `message` | `textKey` | 提交成功后发模块本地化消息；不是日志条目 |
| `emit-story` | `eventId` | 将已声明 story 事件排入 FIFO 因果队列 |
| `optional-reward` | `capability,rewardId,receiptId,onUnavailable` | 可选玩家奖励，详见 §7 |

只允许这六种效果；没有直接改 HP、背包、地图或任意其它模块组件的效果。所有本地效果与可选奖励先完整预检，再在底座受控事务内提交；后续条件预算、计数范围、provider 提交等失败时不留下半条选择的 flag、日志、奖励、消息或录像输入。内容作者应修复超限/越界配置，不把拒绝当作正常分支控制。

### 6.2 triggers[]

每项都有 `id,on,priority,condition,repeat,effects`；combat-event另须提供`receiptId`：

| `on.kind` | on 的其余字段 | 实际时机 |
|---|---|---|
| `entered-level` | 无 | 首访/重访入层的真实已提交事实；首访可用 event-field 筛选。开局事实在所选模块初始化完成后的安全结算边界释放 |
| `npc-interacted` | `npcId` | 成功 open 时，进入对话入口前 |
| `dialogue-choice` | `dialogueId,choiceId` | 成功选择指定对话的指定选项；choice 自身 effects 先执行 |
| `story` | `eventId` | 消费匹配的 emit-story 事件 |
| `combat-event` | `eventKind,actorRole,actorTags` | 只消费已提交的公开战斗事实，效果限制与收据见§6.3 |

`priority` 是 −1000000 至 1000000 的整数。同一事实的触发器按 priority 降序、ID 字典升序执行；不是 JSON 数组先后。派生 story 事件按 FIFO 处理，继承产生它的 depth/turn。较后触发器可以读到同计划内较前效果设置的叙事 flag/counter。

repeat 完整变体：

- `{ "kind": "once-per-run" }`：全局本局一次
- `{ "kind": "once-per-depth" }`：每个深度一次；不是每次进入该层一次
- `{ "kind": "bounded", "maxFirings": N, "cooldownTurns": T }`：全局本局最多 N 次，N 为 1–65536；T 为非负安全整数，两次成功触发的世界 turn 至少相差 T。失败条件不消耗次数

冷却不随打开/选择/关闭对话推进，因为它们不耗回合；`cooldownTurns:0` 才允许不同事实在同一 turn 再次触发。收据让同事实不重复执行。load 恢复收据；replay/seek 按相同命令与事实序号在重建状态中重演，不在还原结果之外累积重复奖励。

自动 `story → trigger → emit-story` 图必须无环，包括自环；即使 guard 永假、repeat 为 once 或 maxFirings 很小，也不放行自动环。人工 next 循环与此不同，受会话转移上限控制。

### 6.3 `combat.event.v1` 有界订阅（3g）

叙事仅消费底座已经提交的战斗事实；不读取combat私有状态、不导入combat模块，不监听动作尝试。支持四类 `eventKind`：

- `attack-resolved`：一个招式段已经解算，actor为攻击者
- `staggered`：硬直真正开始，actor为进入硬直者
- `parried`：弹反已经成功，actor为成功弹反者，带真实 `resolutionId`
- `rest-completed`：篝火休息和恢复已经提交，actor为休息者；失败或中断不会发布此事实

在原有 `triggers[]` 中使用下面形状。此例已写入实际默认包：

```json
{
  "id": "bonfire.first-rest",
  "on": {
    "kind": "combat-event",
    "eventKind": "rest-completed",
    "actorRole": "player",
    "actorTags": []
  },
  "priority": 0,
  "condition": { "op": "flag", "id": "bonfire.rested", "equals": false },
  "repeat": { "kind": "once-per-run" },
  "receiptId": "bonfire.first-rest.receipt",
  "effects": [{ "kind": "set-flag", "id": "bonfire.rested", "value": true }]
}
```

`on` 的四个字段和顶层 `receiptId` 必须提供。`actorRole` 为 `player`、`ally`、`hostile`、`neutral` 或 `any`；指事件已经公开的参与者角色，不允许填写任意actor ID。`actorTags` 是0–32个不同的合法公开标签ID，全部命中才触发；空数组不限制标签。标签不提供隐藏位置、名字、未来招式或未揭示NPC资料。

条件继续使用§5的有界flag/counter/depth/optional-player等表达式；combat事实没有额外 `event-field` 白名单。`repeat` 沿用 once-per-run、once-per-depth 或 bounded（显式最大次数和冷却回合）；优先级相同按trigger ID的稳定ASCII顺序执行。`receiptId` 在整个包的订阅和optional-reward收据中必须唯一，持久收据还包含trigger、作用域、次数、回合和根fact ID。读取存档、回放seek、重复同ID事实不补发或重复执行。

订阅效果仅允许 `set-flag` 和 `add-counter`。旁支资格由现有对话choice条件读取这些值。`message`、`journal`、`emit-story`、`optional-reward`和自动开对话均拒绝，不能借派生story间接发奖励。计数溢出或预算不足使整个原生事务回滚，不能截断执行部分效果。

底座先为一个共享根fact及按模块ID排序的消费者派生范围做预算，再统一准备和提交；narrative不自行占用其他消费者的范围。combat订阅派生预算为0。entered-level改用 `foundation.story.v1`；只有可能直接发出story的入口trigger才预留 `eventsPerCommand` 的有界派生区间。直接玩家交谈命令继续由本模块按原合同提交连续的本地因果范围。

narrative缺席，或内容包没有combat订阅时，不注册combat消费者，也不为叙事保留历史事件队列。combat缺席时既有NPC、对话和日志照常工作，篝火旁支保持隐藏，不补发旧事实。3g精确要求module/rules 1.4.0、state 4和foundation 5；旧版本或规则指纹不匹配直接拒绝，不迁移。

## 7. growth 可选联动

### 7.1 只读条件

`optional-player` 的 capability 固定为 `"growth.public-character.v1"`：

- `field:"level"`：compare 只接受 eq 或 gte，value 为 ≥1 的安全整数
- `field:"professionId" | "lineageId" | "faithId"`：compare 只接受 eq，value 为 ID。值不在 narrative 内硬引用校验，作者需核对 growth 自己的定义
- `onUnavailable` 必填 boolean；growth 缺席或能力不支持输入时取此值。它为 true 表示允许 narrative-only 用户使用该分支，为 false 表示不提供这一条件分支
- provider 正常返回的身份 null 只代表玩家没有该身份，比较为 false；它不是 unavailable。没有配置“等于 null”的条件变体
- 只能读玩家 level/professionId/lineageId/faithId，不接受 actorId，不暴露 NPC 身份/模板/内部收据。非法、异步或泄露额外字段的 provider 结果是错误，不伪装成缺席

一个执行计划内缓存公开玩家快照；同计划里刚准备的奖励不会让后续条件临时看到“已升级”。不要依赖模块加载顺序或用可选奖励制造递归升级判断。

### 7.2 奖励与降级

`optional-reward` 的字段固定为：

- `capability:"growth.story-reward.v1"`
- `rewardId`：growth 自己报价表中的 ID；narrative 不写经验数额或 growth 文案
- `receiptId`：该效果在叙事整局中的唯一收据 ID，不能在另一个选项/触发器效果里再次声明
- `onUnavailable:"skip"`：当前唯一降级政策，没有延迟补发或其它奖励替代变体

三种正常跳过结果为 absent（模块/能力缺席）、disabled（growth story 来源关闭）、unsupported-key（来源开启但没有该 rewardId 报价）。叙事会记录 skipped 原因，之后不会重试。成功提交后才记录 applied；ready 只代表预检成功。一个 receiptId 每局最多尝试一次，即使触发器 bounded 多次或 once-per-depth，也不会逐次领奖。要表达多个独立奖励，分别声明效果与 receiptId；不能套循环伪造动态收据。

若确实要启用默认档案守卫的经验奖励，需要另行修改 growth 自有文件：

1. `src/ext/modules/growth/data/definitions.json` 中设 `config.experience.sources.story=true`
2. 向 `config.experience.story.rewards` 加入 `{ "id":"archive.read", "amount":20, "reasonKey":"ext.growth.story.archive_read" }`；20 是这里举例的作者选择，不是仓库默认值
3. 在 `src/ext/modules/growth/locales/zh_CN.json` 加入 `"ext.growth.story.archive_read":"阅读档案残页"`，通过 growth 自己的 schema/版本校验
4. 新建 growth+narrative 局核对当条命令到账，再验证 narrative-only 的 skip 路径。修改 growth 包会改变它自己的规则指纹，不能拿旧档热补

narrative 不导入 growth 文件。以上仅是内容作者配置两份可组合包的说明；只写 narrative 内容时不必安装、开启或修改 growth。

## 8. 预算与失败定位

所有 `config.limits` 字段必填，最小值均为 1：

| 字段 | 默认值 | 实现上限 | 计数口径 |
|---|---:|---:|---|
| `conditionDepth` | 8 | 16 | 根条件深度为 1 |
| `conditionOpsPerCommand` | 256 | 1024 | 被访问 AST 节点数；节点预览还有加载期最坏总量检查 |
| `effectsPerCommand` | 64 | 256 | 一个因果执行计划的全部效果，包含后来去重/跳过的效果 |
| `eventsPerCommand` | 32 | 128 | 派生 story 事件数，不含根事实 |
| `transitionsPerSession` | 128 | 1024 | 成功 choose 的转移次数；到顶后禁用选择，但仍可 close |
| `maxActiveNpcs` | 32 | 256 | 已绑定交互 NPC 总数，包含缓存楼层 |
| `maxJournalEntries` | 256 | 4096 | 日志定义/已公开条目容量，不静默截断 |
| `maxReceipts` | 4096 | 65536 | trigger 收据、reward 收据、placement 收据和待放槽位的共享总量 |

加载器对收据做保守估算：每个 once-per-depth trigger 预留 40，其余 trigger 预留 1，加每个可选奖励效果 1，加各 placement 的 maxPerRun 之和；结果不得超过 maxReceipts。bounded 的多次计数存在同一 trigger 收据内。运行时仍检查实际总量。

常见错误：

- `UNKNOWN_KEY / INVALID_TYPE`：多了拼错字段、漏了必填字段，或把应为 null 的字段省略
- `UNKNOWN_REFERENCE / INVALID_TEXT`：ID/入口/next/文本键没有登记；检查引用类别与完整命名空间
- `DUPLICATE_ID / DUPLICATE_RECEIPT`：跨定义/跨节点重复，或复制可选奖励后忘了换 receiptId
- `UNREACHABLE_NODE / MISSING_EXIT`：新节点没有 next 指入，或离开路线带条件/效果
- `AUTOMATIC_CYCLE`：story 图形成环，不能用一次性 trigger 掩盖
- `CONDITION_LIMIT / EFFECT_LIMIT / EVENT_LIMIT`：单节点或整个执行链超预算；先缩短内容链，必要时在实现上限内调整包预算
- `COUNTER_RANGE / FLAG_VALUE`：效果越过声明域；选择整体拒绝，不会“加到上限为止”
- `INVALID_PORTRAIT`：图片路径不安全；缺真实文件本身不会报这一错，而是显示占位

错误对象携带具体 JSON 路径与 `ext.narrative.error.<code>` 文案键。修正配置后重新加载新局，不编辑运行中的 state/revision/收据去绕验证。

## 9. 新增内容示例：引路人和 D2 首访提示

下面是追加到默认规则包的内容片段，不是可替换整个 `definitions.json` 的完整包。按同名数组追加，保留原有顶层版本/config 和默认内容；随后合并本节 locale。它增加一个 D1–D2 放置规则、一段可重复开口但只能领取一次线索的对话、一个日志、一个手动 story 链，以及 D2 首访提示。示例不依赖 growth，不改生产数据。

<!-- narrative-example: append-definitions -->
```json
{
  "flags": [
    { "id": "road.clue-read", "type": "boolean", "initial": false, "min": null, "max": null, "values": null }
  ],
  "counters": [
    { "id": "road.clue-count", "initial": 0, "min": 0, "max": 1 }
  ],
  "npcs": [
    {
      "id": "road.scout", "nameKey": "ext.narrative.npc.scout.name",
      "descriptionKey": "ext.narrative.npc.scout.description", "glyph": "引", "color": "#b8c9a0",
      "portraitId": null, "dialogueId": "road.greeting", "presence": "stationary-interactable", "interactionDistance": 1,
      "placements": [
        { "id": "road.first", "minDepth": 1, "maxDepth": 2, "maxPerRun": 1, "maxPerDepth": 1,
          "minStairDistance": 1, "maxEntranceDistance": 8, "onNoSpace": "defer" }
      ]
    }
  ],
  "dialogues": [
    {
      "id": "road.greeting", "entry": "hello", "nodes": [
        {
          "id": "hello", "textKey": "ext.narrative.dialogue.scout.hello", "portraitId": null,
          "choices": [
            {
              "id": "ask-route", "textKey": "ext.narrative.choice.scout.ask",
              "condition": { "op": "flag", "id": "road.clue-read", "equals": false },
              "unavailable": "disable", "unavailableKey": "ext.narrative.choice.scout.read",
              "effects": [
                { "kind": "set-flag", "id": "road.clue-read", "value": true },
                { "kind": "add-counter", "id": "road.clue-count", "amount": 1 },
                { "kind": "journal", "entryId": "road.note" },
                { "kind": "emit-story", "eventId": "road.clue-shared" }
              ],
              "next": "thanks"
            },
            { "id": "leave", "textKey": "ext.narrative.choice.leave", "condition": { "op": "true" },
              "unavailable": "disable", "unavailableKey": null, "effects": [], "next": null }
          ]
        },
        {
          "id": "thanks", "textKey": "ext.narrative.dialogue.scout.thanks", "portraitId": null,
          "choices": [
            { "id": "finish", "textKey": "ext.narrative.choice.leave", "condition": { "op": "true" },
              "unavailable": "disable", "unavailableKey": null, "effects": [], "next": null }
          ]
        }
      ]
    }
  ],
  "journal": [
    { "id": "road.note", "titleKey": "ext.narrative.journal.road.title", "textKey": "ext.narrative.journal.road.body" }
  ],
  "storyEvents": [ { "id": "road.clue-shared" } ],
  "triggers": [
    {
      "id": "road.acknowledge", "on": { "kind": "story", "eventId": "road.clue-shared" }, "priority": 0,
      "condition": { "op": "counter", "id": "road.clue-count", "compare": "eq", "value": 1 },
      "repeat": { "kind": "once-per-run" }, "effects": [ { "kind": "message", "textKey": "ext.narrative.message.road.known" } ]
    },
    {
      "id": "road.depth-two", "on": { "kind": "entered-level" }, "priority": 10,
      "condition": { "op": "all", "args": [
        { "op": "event-field", "field": "firstVisit", "equals": true }, { "op": "depth", "min": 2, "max": 2 }
      ] },
      "repeat": { "kind": "once-per-run" }, "effects": [ { "kind": "message", "textKey": "ext.narrative.message.road.depth_two" } ]
    }
  ]
}
```

对应 locale 追加片段（已有 `ext.narrative.choice.leave` 直接复用）：

<!-- narrative-example: append-locales -->
```json
{
  "ext.narrative.npc.scout.name": "引路人",
  "ext.narrative.npc.scout.description": "一位在岔路旁停步的旅人。",
  "ext.narrative.dialogue.scout.hello": "前面的石壁上留着旧路标。",
  "ext.narrative.dialogue.scout.thanks": "看见岔路时，记得先观察周围。",
  "ext.narrative.choice.scout.ask": "请告诉我路标的含义",
  "ext.narrative.choice.scout.read": "已经记下这条线索",
  "ext.narrative.journal.road.title": "岔路上的标记",
  "ext.narrative.journal.road.body": "引路人提醒我观察石壁上的旧路标。",
  "ext.narrative.message.road.known": "你记下了引路人的提示。",
  "ext.narrative.message.road.depth_two": "这里已经是第二层，留心每一个岔路。"
}
```

操作顺序：先合并 locale，再把片段各数组元素追加到定义包，运行加载器校验，开启新局。即使两个 NPC 都想在 D1 入口附近放置，也会按稳定顺序竞争合法候选；示例的 defer 只承诺无位时到 D2 首访再试，不保证每个种子一定出现。

新增额外对话节点时，先添加唯一 node ID 和 locale，再从已有选项的 next 指过去，并给新节点提供恒真无效果的离开路线。改变开场白分支可把条件放在入口节点的选项上；当前没有自动跳转节点或进入节点效果字段。

## 10. 为引路人接入立绘

1. 使用已授权素材，把图片放在 `src/ext/modules/narrative/assets/portraits/road/scout-neutral.webp`
2. 在 `portraits.json.portraits` 追加下面对象，保留原项，并更新 `displayVersion`
3. 在模块 locale 增加 `"ext.narrative.portrait.scout":"引路人立绘"`
4. 将示例 NPC 的 `portraitId` 改为 `"road.scout.neutral"`；要在某节点换表情，另登记立绘 ID，再覆盖该 node.portraitId。这一步改变 definitions.json，因而改变规则指纹

<!-- narrative-example: append-portrait -->
```json
{
  "id": "road.scout.neutral",
  "asset": "road/scout-neutral.webp",
  "width": 240,
  "height": 320,
  "fit": "contain",
  "anchor": "bottom-center",
  "altKey": "ext.narrative.portrait.scout",
  "fallbackGlyph": "引"
}
```

asset 是 `assets/portraits/` 下相对路径，只支持 png/webp，路径段只能用英文字母、数字、`_`、`-`；不接受 `/` 开头、`..`、反斜杠、URL、query/hash、SVG 或 data URI。width/height 为 1–8192 的整数；当前 fit/anchor 只有上面的固定值。清单通过不代表文件存在或图像可解码，仍须运行 build 和浏览器验图。

Vite 用模块目录内的静态白名单收集资源；不把 NPC ID 拼成请求地址。asset:null、未知显示 ID、缺文件、加载中或加载失败都显示占位；已被 definitions.json 引用的未知 portrait ID 则会在包校验时先被拒绝。迟到的旧图片事件不能清空新图。图片完成/失败不改变规则、RNG、存档、录像、命令进度或 seek。

只替换既有 ID 下的图像/清单显示信息时，升 displayVersion 即可，不需为图片本身改 module/rules/state/input。新增实际图片后还要检查桌面、320/390 宽、横竖屏、长名字/正文，以及主动制造图片失败时仍可离开对话；不要把引擎测试当作这些像素检查的证据。

### 10.1 像素立绘规范

- 资产以 48×64 像素网格、1× 尺寸存储，禁止预放大；三位 NPC 共用 `assets/portraits/palette.json`，颜色按相对亮度升序排列，透明索引为 0。基础方案为 24 色，本次依据 D-22 一次提升至 32 色，以减少银发、铜铃与肤色细节合并；不抖动
- PNG 必须为索引色（color type 3）、4 或 8 位、无隔行；alpha 只有 0/255，不含文本、EXIF 或时间块；每张不超过 4 KiB。轮廓、顶部和侧边留白、四角透明与配色由 `tests/narrative_portrait_pixels.test.ts` 检查
- UI 使用 `image-rendering:crisp-edges;image-rendering:pixelated`，在纯色 `var(--bg-deep,#11130f)` 上只放大不缩小；桌面 5×、最窄屏 1×、手机 1.5×（DPR 2 时为 3 个物理像素），立绘页最大 8×
- 后处理脚本为 `src/ext/modules/narrative/tools/pixelize_portraits.py`，依赖 Python、Pillow、numpy。输入顺序固定为档案守卫、缄钟匠、听烬人；使用三张原始 1024×1536 洋红底图，先检查四角键控色，再统一裁去顶部 171 行，预乘 alpha 的 BOX 降至 48×64、删除断开的至多两像素杂点、合并全部不透明像素作 median-cut 调色板并按 L1 最近色无抖动映射
- 替换步骤：在仓库外准备三张原图，运行 `python src/ext/modules/narrative/tools/pixelize_portraits.py keeper-source.png bell-source.png wick-source.png --out /tmp/portrait-candidates --evidence /tmp/portrait-evidence --colors 32`；必须先取得全部数值检查通过，并检查 1×/5×/8× 联系表的朝向、光向、轮廓、面部、道具与裂口。三张作为一组复制最终 PNG 和 palette.json 回资产目录，保持 ID 与文件名，更新 displayVersion；原图、联系表和截图不进仓库
- 接着跑 narrative 测试、boundary、vue-tsc、build 与 i18n 门禁；用当次构建在 1440×900、390×844、320×844，各 DPR 1/2，核对 NPC 对话及查看立绘页。生成失败或任一角色不达标时，不替换整套资产；浏览器不可用必须记录 blocked

## 11. 作者自检与交付

加载器入口是 `loadNarrativePack(definitions, portraits, locales)`（`schema.ts`），成功返回深冻结隔离包，失败抛带路径的 `NarrativeError`；`validateNarrativePack` 是同一入口别名，不返回宽松 boolean。纯函数执行样例可用 `initialNarrativeState`、`planNarrativeChoice`、`planNarrativeFact`；这些只是内容工具，不能代替真实 Game 目标资格/命令/存档/录像测试。

修改内容后的快速定位可跑：

```bash
NODE_OPTIONS=--max-old-space-size=3072 npx vitest run src/ext/modules/narrative/tests/narrative_schema.test.ts src/ext/modules/narrative/tests/narrative_kernel.test.ts --maxWorkers=2
```

此命令加载实际默认包并检查内核，不是完整交付门禁。新增分支/循环/联动内容还应加针对性用例，验证选择成功和失败、返回入口、hide/disable、计数边界、事件顺序、重复事实、收据以及 growth 缺席/关闭/未知报价/成功四条路径。测试归 narrative 自有目录并登记到 `test-suites.json`；不要跨模块导入 growth 私有代码，可通过底座发现式集成夹具验证组合。

交付时按 README 当前 full 档，在同一最终正常树完整运行 boundary、vue-tsc、build、全部 test:ext、完整 npm test 以及所有已安装模块子集真实 Game 新局/游玩/save-load/逐条 replay/seek/续录 smoke。需要独立性验收时另在真实删除副本跑 removal 档，不能用关闭开关冒充删除。正常树完整 npm test 与删除副本 removal 不互相替代。

除§6.3首休订阅外，本页其余示例是教学片段，未写入默认生产数据；片段合并后的 schema 和纯内核验证结果由本轮报告登记。所有实际门禁、浏览器覆盖和未覆盖项以当轮报告为准，不从本手册的操作说明推断已经通过。
