# 扩展底座：阶段 0 与 1a0 技术合同

阶段 0 基于 main `3c1407fcb0b074a7b4dd4879d15eb7c0be346749`。本阶段只搭底座；不引入成长、NPC、魂系战斗或多格规则。范围与优先级遵循 [路线](README.md)、[Lost Flame 机制笔记](references/lost-flame-notes.md) 和 [totalwar 笔记](references/totalwar-notes.md)。机制结构自行设计，未读取/复制商业游戏代码、数据或素材，未查 CE 源码。

> 当前 1a0 已补充可信因果来源、生成事务、死亡事实/回收和版本化成长数据合同；尚未启用经验、属性求值或技能玩法。当前合同以本文第 3/4/5/6/9 节增补及 [配置说明](growth-config.md)、[24 项表达审计](growth-expression-audit.md) 为准。阶段 0 报告是历史证据，1a0 门禁另见 [本步报告](phase1a0.report.md)。

## 1. 隔离与输入边界

现有 `Game.mode` 仍表示 normal/easy/wizard/test 的难度/调试方式。新 `ruleSet` 是从 `extensionRuntime` 派生的只读访问器：classic / extended。菜单默认“经典 CE”，另可选“扩展模式”，两个选择与原难度独立，文本全部在 `zh_CN.json`。

经典新局不调用注册表、工厂、模块初始化、派发或数据定义校验，`extensionRuntime === null`，生物没有扩展回调，存档/录像不添加扩展键。引擎只做空值分支；原规则、骰子次序、实体编码及经典 JSON 投影不变。模块代码的静态导入只声明类型/函数，没有顶层注册、随机调用或新局副作用。经典守卫用原 main 捕获的双流完整 tuple（含实质流计数）比较开局、命令攻击和等待结果，并断言注册/启用/钩子均零调用；既有黄金 trace 与生成基线保持原断言。

新局选择属于录像起点配置。局内所有改状态输入经 `Game.executeCommand` / `executeItemCommand`。模块命令格式是 `executeCommand('ext:command', JSON.stringify({ module, action, payload }))`，`applyCommand` 在实时、回放、seek 中使用同一个派发器。底座先校验命令必须为仅含 module/action/payload 的完整 JSON 对象，且 action 必须是模块自身登记的函数（不接受原型继承方法）；模块命令再自行校验 payload，不直接从 Vue 事件修改组件状态；本阶段示例不添加任何玩家命令。物品仍使用原命令边界。

## 2. 注册表与生命周期

| 步骤 | 实现 | 合同 |
|---|---|---|
| 注册 | `src/ext/registry.ts: ExtensionRegistry.register` | ID 为稳定小写标识，版本为三段数字；重名拒绝。仅登记纯工厂，不执行工厂 |
| 启用 | `catalog.ts` / `registry.manifest` / `registry.create` | 只在开局/读取扩展输入时调用。集合按 ID 排序，依赖必须显式启用；依赖拓扑排序，独立模块按 ID；缺项、重复、循环、版本差异拒绝 |
| 新局 | `ExtensionRuntime` 构造 → `newGame` → 绑定玩家 → 生成楼层 | `initialState` 为纯 JSON；`onNewGame` 可改自身状态/组件，可用实质 RNG；首层钩子随后运行 |
| 保存 | `runtime.snapshot` → `Game.toSnapshot` / `toSaveSnapshot` | 纯深拷贝，不派发模块事件、不耗随机数；存档命名空间独立 |
| 读取 | 校验模块集合/版本/状态 → 解码原世界 → 绑定全部实体 → `loaded` | 不重播初始化/生成/出生/击杀；`onLoad` 仅重建会话资源，context 禁止写状态、消息或 RNG |
| 卸载 | 新局/读档退休旧 runtime 的 `unload` | 逆依赖顺序卸载，解除所有生物回调；重复调用无效。卸载不能改世界或用 RNG |

`initialState`、工厂、`validateState` 和组件校验器必须纯且同步：读取录像/续录来源校验也会调用这些函数。生命周期及事件回调也必须同步，运行时拒绝返回 Promise 的命令/事件/全部生命周期回调；禁止定时器、网络返回或墙钟驱动世界变化。模块集合在一局内固定，阶段 0 不做热加载、热卸载、版本迁移；版本变更应拒绝旧扩展数据。

生命周期错误不会被静默吞掉。新局/命令钩子失败按引擎原异常机制使完整录制来源失效；当前内置示例的纯校验与同步回调无外部资源。未来模块的会话资源加载若可能失败，应在退休旧局前预检，不能在 `onLoad` 中执行会失败的异步加载。

## 3. 钩子清单与权限

事件输入是深拷贝且深冻结的 DTO；`CreatureView`/`ItemView` 是摘要，不是活的引擎对象。模块只能通过 context 读写自己的 JSON 状态和自己命名空间里的生物组件；不能通过事件直接修改 HP、地图、命中或原伤害数值。context 的 `state` / `getComponent` 返回深拷贝。写入权限按单次回调作用域授予，回调结束后永久失效；已结束回调或 `onLoad` 保存的 context 不能借后续事件重新获得写入、消息或随机权限。`setState` 和可选 `componentValidators` 校验写入与读档，所有数据还须有限值、无循环、无原型键的 JSON。

以下事件均属于同步模拟生命周期，可通过 `context.randomInt` 消耗引擎实质随机流。该 API 强制选择实质流并恢复原流选择器；不创建第三条流。参数须为安全整数，闭区间跨度不得超过 `0xffffffff`，超界在调用引擎随机流前拒绝，避免原拒绝采样器零除数。显示、保存、校验、读取/卸载禁止 RNG。回调顺序固定，随机调用数也因此固定。模块不得直接使用 `Math.random`、时间、网络或装饰流决定规则结果。

| 钩子 | 准确位置 / 时机 | 事件可读数据 | 可写与随机合同 |
|---|---|---|---|
| `beforeLevelGeneration` | `Game.generateDepth`，首次访问时先生成事实，缓冲到外层生成提交后派发 | 目标深度 | 自身状态/组件；1a0 起不得在投机生成期间运行模块，派发使用已恢复的本局实质流/已提交世界 |
| `afterLevelGeneration` | 同一包装方法，原生成与入层补跑/落点/居民恢复完整返回后，只首次访问触发 | 目标深度 | 自身状态/组件；原生成器已恢复返程种子，使用恢复后的实质流 |
| `creatureSpawned` | `MonsterLifecycle.ownedMonsterList` 的列表绑定/插入调用 `runtime.attachCreature`；玩家在新局初始化后显式绑定 | 生物 ID/名字/HP/位置/是否玩家 | 自身状态/组件；每个对象每局首次绑定一次，换列表/唤醒/重访不重复，读档不发；生成中出生暂存，外层提交按实体 ID 初始化，失败丢弃，不消费模块 RNG |
| `playerTurnEnded` | `Game.finishTurnEpilogue`，原结算、最终视野、消息合并后 | 原 `stats.turns` | 自身状态/组件；覆盖同步、动画与强制回合的共同收尾，原回合调度不改 |
| `beforeAttack` | `CombatSystem.attack` 包装器，原 `resolveAttack` 任何掷骰/早退之前 | 攻防双方摘要 | 自身状态/组件；无取消或改伤害接口；覆盖原 attack 的近战与复用该入口的效果 |
| `afterAttack` | 同包装器，原结果返回后、调用者的额外符文/分裂/文本等后处理之前 | 双方结算后摘要、完整只读 `AttackResult`（含未命中/抓持等早退） | 自身状态/组件；异常时只清理攻击来源栈，不发成功结果事件 |
| `damage` | `Creature.takeDamage`，原吸盾、血迹、转移回调、扣 HP 之后，调用 `die` 之前；另在 `Player.recoverPerTurn` / 旧饥饿入口的原扣血点及 `Game` 否定致死赋值插入 | 生物摘要、原 HP、HP 伤害、兼容观察 sourceId、可信 origin、实际 hpLost、damageKind | 自身状态/组件；吸盾与免疫仍由原路径决定。零伤害也可发事件；否定致死沿原后续零伤害通知另有事件，不能按事件次数当伤害次数 |
| `kill` | `Game.killMonster`，`deathProcessed=true` 后、乘客处理前；原去重旗标防重复 | 死者摘要、兼容 sourceId、终结 origin、是否行政移除 | 自身状态/组件；终结来源在死亡 DF 之前捕获，派发仍在原去重之后；递归 DF 不覆盖原终结来源。行政移除 origin=null |
| `itemPickedUp` | `Game.logPickup`，手动拾取及位移/行走拾取的共同成功出口 | 玩家摘要、原物品 ID/类别/数量（堆叠可合并） | 自身状态/组件；满包/避让/取消均不发，金币也发；事件与原移除地面对象相邻，不要推断事件发生时所有后处理都完成 |
| `itemUsed` | `Game.quaffItem` / `readItem` 成功消费并应用效果后的回合尾前；`consumeFood` 成功消费/补营养后；护符 `invokeCharm` 的成功 endTurn；法杖/魔杖 `commitArcanaTarget` 后 | 玩家/物品摘要、quaff/read/eat/charm/arcana | 自身状态/组件；取消、冷却、已知空杖不发。未知空杖按原消耗回合的使用尝试发；选择法器目标本身不发 |
| `enteredLevel` | `Game.generateDepth` 完整返回后，排在 `afterLevelGeneration` 后；包含重访和首层 | 深度、firstVisit | 自身状态/组件；使用入层后的实质流 |

1a0 增补：怪物仍只派发一次原 `kill`，玩家非获胜终局另派发 `playerDied`，两者共享 `DeathFact` 的只读结构。`generationCommitted` 在成功提交时提供 label/creatureIds；`generationRolledBack` 使用只读 context，禁止状态、消息、RNG。嵌套回滚诊断等外层成功后派发；失败外层只通知自身回滚。任何开放生成事务都不能取 `runtime.snapshot()`。

`sourceId` 继续只作旧 attack 栈观察，**绝不能据此发 XP**。新 `EffectOrigin` 明确 actor/creditActor/creditParty、类型与父链，近战/投掷/射线/反射/反伤/毒/燃烧/位移接线见第 9 节。属性替换仍须 1b 的只读策略端口，不允许通过 damage/kill 事件暗改 HP。


## 4. 数据定义与生物组件

`src/ext/definitions.ts` 提供 `DefinitionPack` / 判别联合 TS 类型 / `validateDefinitionPack`。数据包格式：

```json
{
  "schema": 1,
  "definitions": [
    { "kind": "skill", "id": "demo.observe", "nameKey": "ext.skill.observe", "cost": 0, "effects": [] }
  ]
}
```

包校验 schema、有限 JSON、唯一 ID、中文词条键、整数范围、职业→技能、敌人→职业/技能、NPC→敌人模板/对话、对话节点入口与选择目标。定义种类包含 profession/skill/npc/dialogue/enemy；任何效果只允许显式 message/component 数据，禁止字符串脚本或 eval。组件效果这里只校验形状，没有效果执行器；字段也不直接覆盖原 CE 字段。

敌人将 body、locomotion、footprint、attributes、progression、可选 professionId、AI 的 behavior/traits、attacks 与 afterEffects、skillIds 分开。这是参考笔记的结构启发，自行设计字段与示例数值。footprint 校验允许 1–3 的未来元数据，阶段 0 没有生成该定义的运行器，现有所有实体仍占 1 格；不得把通过定义校验等同于引擎支持多格。

`modules/example/definitions.json` 是覆盖五种定义的原创示例包，只用于格式验证，不生成 NPC、不提供技能/职业玩法。`text.ts` 登记示例包的 i18n 词汇。后续模块先加载自身包并校验，跨包引用应在所有包登记后进行二阶段校验，不能依赖异步加载先后。

生物组件使用独立表 `components[creatureId]['moduleId:componentName']`，玩家、敌人、中立 NPC、盟友使用相同 API。已有 `ProgressionComponent`、`AttributesComponent`、`ProfessionComponent` 类型及纯校验器，未来种族/信仰/技能以新组件加入，绝不往 Player 添加专属成长字段。模块用 `componentValidators` 登记自身组件规则。实体 ID 为本局稳定 ID，涵盖当前/缓存层、休眠、携带、待坠落、炼狱实体；读档绑定整个实体图。1a0 在命令最终安全边界按机械实体图可达性回收：当前/缓存/休眠/携带/待坠落/炼狱及其 leader 引用保留；everSeen/可见历史不单独保活。组件和因果终结记录回收，模块状态中的独立奖励收据不删；不能按当前楼层不在场删除。

## 5. 独立扩展存档区块与契约

扩展局顶层 `GameSnapshot.extensions`：

```json
{
  "manifest": { "schema": 1, "foundation": 1, "modules": [{ "id": "example", "version": "1.0.0" }] },
  "modules": { "example": { "kills": 1 } },
  "components": { "1": { "growth:progression": { "level": 1, "experience": 0 } } },
  "foundation": { "version": 1, "causality": { "nextEffectId": 1, "statusOrigins": {}, "fatalOrigins": {}, "pendingDisplacements": {} }, "deaths": {} }
}
```

上例 components 的 growth 仅说明格式，真实包必须将 growth 纳入 manifest，否则拒绝。模块版本同时负责自身状态/组件格式；顶层 schema 负责底座包络。记录历史须为有效对象数组，异常容器/空元素在退休旧局前拒绝；集合/版本、状态键集合、模块校验器、组件 ID/命名空间/JSON 均先校验，不接受部分扩展读取，不做迁移。经典局省略 extensions；显式扩展模式即使模块列表为空也保存包络。

`Game.extensionRuntime` 是新增的唯一实例字段，已登记 `scripts/u03-state-contract.json` 的 persist 合同。函数、事件处理器、实体回调与工厂不序列化；仅扩展包络深拷贝。生物回调是 `Creature` 访问器背后的 WeakMap，U01 实体字段登记表与原 codec 不变。经典 U03 世界投影不增加任何键。

`toSaveSnapshot` 的 `run.recordingOrigin` 携带扩展 manifest，起点及末命令的扩展 checkpoint 必须对应当前包络，才能保留完整续录来源。缺/伪造来源仍遵循原世界诊断档规则；有扩展来源却删除顶层扩展区块拒绝。快照不是对任意手改世界的真实性证明。

## 6. 录像与确定性

经典录像 version 2、字段、检查点保持不变。扩展录像附加可选头 `extensions: { schema: 1, foundation: 1, modules: [{ id, version, rules? }] }`；每条扩展命令检查点附加 `extensions: ExtensionSnapshot`。兼容校验按本地注册表精确核对头中的集合/版本；读取后按头启用该集合，不要求播放器当前正在玩同一模式。已注册但未在头中启用的模块不参与回放，缺依赖或缺模块拒绝。

删除头而事件仍含扩展数据/命令、改变版本、未注册模块、非法状态均明确拒绝并给本地化提示。回放保留原位置/回合/决策/双 RNG 校验，再以规范键序 JSON 比较扩展状态；差异进入原 OOS，消息使用现有本地化 OOS 显示。seek 通过原重新开局+命令执行路径，扩展状态不从任意跳转点猜测恢复。

阶段 0 为便于调试，每命令保存完整扩展状态。D19 已确认 A：阶段 1 继续完整 checkpoint，只测量大小；摘要/周期快照是另行确认的后续优化，不能直接删 checkpoint。所有模块须升级版本来记录规则/数据变更，避免同版本数据漂移造成无提示错误。

## 7. 示例与验证

内置 example 1.0.0 每次非行政怪物死亡累加 kills，使用 `ext.example.kill` 在原消息栏显示。它统计死亡生命周期，不代表“玩家击杀归属”；也不会提供经验/等级。保存与回放都记录该计数，默认扩展局启用它。

`ext_hardening.test.ts` 覆盖过期权限、严格命令派发、随机区间、损坏历史无副作用拒绝、函数引用攻击与命令回放；`ext_validation.test.ts` 另覆盖严格 JSON/容器及同步生命周期边界；`ext_foundation.test.ts` 覆盖注册/依赖、钩子顺序、状态/双生物组件往返、纯数据校验、真实拾取/使用、随机流接入、行政死亡去重、非法头拒绝、自然地图21条命令的击杀录像/seek/读档续录、扩展 checkpoint OOS，以及经典零模块调用+原 main 精确 RNG。既有测试、trace、生成夹具不修改。浏览器在1440×1000及390×844验证开局选择、自然击杀提示、存档录像和不匹配提示，截图不入库；手机尺寸是浏览器模拟，未声称安卓实机测试。

门禁与实际原文输出见 [阶段 0 报告](foundation.report.md)。

## 8. 阶段 1–5 预判

| 阶段 | 可复用底座 | 需要补充或深入的改动 / 风险 |
|---|---|---|
| 1 成长 | creatureSpawned、kill、damage、playerTurnEnded、命令、组件、数据包、存档录像 | 先定义击杀归属/经验分配（环境及持续伤害需来源传播）、生成提交/回滚、死亡组件回收。属性影响原战斗须增加仅扩展模式使用的规则策略端口，不能在只读事件里暗改 HP；加点等输入需模块命令 payload 校验 |
| 2 叙事 | npc/dialogue定义、组件、enteredLevel、item事件、模块命令 | 需要目标实体互动命令、对话条件/效果解释器及录像决策，立绘异步加载只影响显示。NPC 关系/剧情按实体与模块保存；UI禁泄露不可见信息 |
| 3 类魂 | before/afterAttack、damage、turn末、skills定义、组件 | 先预警格/多回合攻击，再体力/韧性/弹反。需在 AI 选行动前与调度耗时提交处加入策略/取消端口，当前 afterAttack 不包含所有调用者后处理，不足以实现替换战斗。跨回合攻击与目标落格必须持久化，动画不能驱动结算 |
| 4 多格 | enemy.footprint元数据、生成/出生/进层生命周期 | 必须重构占位与规则查询，单靠现有钩子不成立，详见下节；先2×2后3×3 |
| 5 多层世界 | 通用组件、模块命令、独立命名空间、层进入事件 | 世界→区域→战场→遭遇的 ID/时钟/随机域/上下层结算需独立设计。先纯数据世界回合及一张原型图；低层结果只在明确进入/离开边界汇总。B/C/D精度切换保持人数/士气/损失守恒，指挥权随身份且不泄露情报 |

### 多格占位的高风险依赖

1. **占位表**：从单坐标生物查询改为“格子→实体ID”与“实体→占位格集合”；死亡、移动、交换、击退、传送、休眠、坠层、复活都要原子维护。主控实体一份 HP/状态；命中任意占格不能在同一 AOE 中重复受伤。长条身体先主体+跟随段，不做任意形状。
2. **寻路**：按体型和移动方式检查全部占格及对角扫掠；障碍膨胀/距离图缓存键包含 footprint、地形版本和占位版本。当前 mapToMe、怪物查询内缓存、盟友安全图、自动旅行与楼梯接近都假定1格，不能只替换 A* 邻居函数。体型缓存可能带来内存及深层 CPU 峰值。
3. **视野**：任一身体格可见即实体可见，但不能因此泄露未见的全身/背后区域；攻击起点、距离、视线阻挡、嗅觉、灯光与幻觉需要统一锚点/占格策略，不能多格各算一名生物。
4. **目标选择**：鼠标任意占格映射同一ID；法术射线、近战范围、穿刺、连锁、AOE与自动战斗目标须去重，命中格与实体来源分别保存。回放记录稳定目标ID/格，不用渲染对象索引。
5. **渲染**：四地图模式、记忆、光照、隐身、图例、检视、镜头、绘制保留缓存均需要“一个实体多格显示”的模型；不让各身体格消耗额外规则/装饰 RNG 改变录像。Boss条/立绘纯显示，不改世界。
6. **地图生成**：Boss场地净空、体型通道宽度、门/楼梯尺寸、出生候选与重访落点必须保证整块可站立；蓝图失败必须回滚所有占位和组件。继承怪物、携带乘客、上下层入口不可把单位挤进单格通道。
7. **验收**：仅在扩展模式启用新的占位策略，经典继续原查询路径。先独立2×2测试场，覆盖转角、双单位碰撞、AOE去重、坠层/存读档/回放，再开始自然 Boss 场地。阶段5建立在这些合同之上，不能同时切换空间模型与世界时钟。

建议按路线1→2→3→4→5，每阶段结束审核；阶段1先纯成长状态与输入/录像，属性战斗政策后接；阶段3先预警；阶段4先2×2专场；阶段5先设计与世界图原型。本次到阶段0停止。

## 9. 1a0 已实现的补强及尚未启用部分

### 因果传播

- `src/ext/causality.ts` 的 `EffectCausality` 只在扩展 runtime 中实例化；scope 必须同步，Promise 拒绝，try/finally 恢复，显式 null 屏蔽外层来源，ID 不用 RNG/墙钟
- 近战、玩家投掷和符文后处理、法器/怪物射线都带独立来源；反射改变 creditActor 而不改变 CE 的机械 caster，墙反射清责任者。反伤/分摊归实际反伤者，负转移自伤归实际付费者
- 毒/燃烧仅最后一次有效增强/刷新更新来源；清除、免疫、变形和复活清相应记录。持续伤害不借当前 attack 栈，来源实体死亡/离场不影响保存的 ID 证据
- 显式位移紧邻落地与死亡 DF 同步爆炸有界继承；跨结算坠落使用一次性的 pendingDisplacements。后续地火、气体、自然陷阱、饥饿明确无责任者；掘地/粉碎对镶墙生物的直接致死叶子保留施法/反射来源，其后地形/DF 仍明确无归属
- 玩家、怪物直接终结（否定、寿命、行政移除）有明确终结原因。怪物终结在死亡 DF 之前捕获，DF 的新来源属于死者，避免递归爆炸抢走外层归属
- creditPartyId 保存施加时 `player:<id>` 或 null。**它是因果证据，不是经验领取资格**；1a 必须另行校验生成资格、实际队伍关系和唯一收据。1a0 未实施关系版本账本或 XP 分配

### 事务和安全边界

1. 实际蓝图 checkpoint 有可选 commit；每次楼梯重试和外层楼层进入有嵌套事务。扩展事件/出生暂存，失败机器/失败尝试丢弃其来源和组件资料，不运行模块 RNG/消息
2. 最外层成功后，出生初始化按稳定 ID，缓冲事实按原产生顺序。生命周期 beforeLevelGeneration 的“before”表示事实产生位置，不再表示可在投机世界执行模块
3. 外层异常恢复旧 live 对象图、原 runtime、原 RNG、日志/待确认/战斗缓冲、已知物品集合、奖励配额、死亡 WeakSet 和已存在格图的会话绑定；不走 loadSnapshot，也不因动画推进无法取档而放弃回滚。内部生成失败/重试仍保留 CE 原随机消耗；实体 ID 不倒退重用
4. 渲染通知只在生成事务提交后发出；UI 回调异常不能把已提交模拟倒退成半局
5. 回收在实时命令/动画最终 checkpoint 和回放校验前同一安全边界执行；不把回收塞进纯 snapshot getter

### 数据与版本

完整 growth 包位于 `src/ext/modules/growth/`，包含有限端口/效果/动作 DTO、严格 schema、静态引用/循环/范围校验及 24 样例；模块仅空状态，没有成长玩法 hook/command。默认扩展仍为 example；显式选择 growth 可验证其存档/录像版本合同。

1a0 manifest 增加精确 `foundation:1`，snapshot 增加 foundation.version/causality/deaths。缺旧版本字段直接拒绝，不迁移。数据模块 rules 携带 schema/version/规范 JSON SHA-256；schema、模块/规则版本、完整内容指纹任一不符都拒绝。手改数值却漏升版本也不能静默播放旧输入。hash/加载校验只在扩展启用边界运行。

纯规则求值、属性对 CE 规则的策略端口、实际动作执行/消费/资源提交分别属于 1b/1d（基础资源提交 1a），身份模板属于 1e；本步不声称这些合同已经改变玩法。全部新增 Game 成员均是方法，无新增实例字段，原 U03 字段清单无需改变。

## 10. 1a：成长实际接线与安全提交

默认扩展目录改为 growth，精确 `moduleVersion/rulesVersion=1.1.0`、数据 schema 仍为 1；foundation 的既有版本仍为 1。旧 growth@1.0.0 拒绝，example 仍可显式启用。纯合同工厂保留给显式探针，生产注册的是玩法工厂。

- `birth.ts` 是只写一次的短生命周期构造桥：真实生成入口标自然/召唤/分裂/克隆/周期/脚本/测试，以及是否真正复制原生属性。WeakMap 不持有生物，也不冒充存档；已提交出生转为 growth:reward，固定实体奖励 ID/原种类/报价。已有出生事务继续缓冲初始化，失败不创建收据
- growth 模块拥有 progression/derived/focus/skills/reward 五种通用生物组件和 XP/首访/鉴定/剧情收据。来源摘要只存 ID、关系版本和必要阵营/生存事实，不持有对象。关系凭证由实际责任者产生；反射不把盟友凭证误写成主角凭证
- ItemLoader 真正种类知识提交/推断发只读事实；起始已知集合在中性创建时作为基线。模块只排队或记事实，经验统一在最终命令/动画/强制回合安全点结算。没有录制来源的动画局也经过同一结算，不以“是否录了 checkpoint”判断是否发奖励
- 新局菜单经原 executeCommand 录一次中性 create-character；未创建局只有此命令可接受，持久保存拒绝。重放先验证首条创建、创建不重复及精确模块/配置/状态合同。引擎守卫在取消自动行动/改临时显示前拒绝非法扩展输入，不把可预期的坏 payload 变成录像来源丢失
- `commitResources` 不是任意对象写入：仅声明资源能力的模块在创建命令、出生、原生形态重置或安全结算范围可用；CAS 校验预期 HP/maxHp、有限安全整数和合法上下界，不能使死亡者复活。作用域失效后不可调用。普通事件/读取回调不能拿此能力修改资源
- 原生 HP 的唯一所有者仍是 Creature；appliedMaxHp 只标识已应用自动加值，升级按差额提交。实际复制体减去复制的旧加值再应用新组件；新召唤物不减召唤者的加值。变形和召唤者复活的原生最大生命重置后补回自动加值，并钳制重置造成的过量当前 HP；通用属性/物品策略仍归 1b
- 存档预检验证组件互相一致、来源摘要/队伍凭证与 foundation 引用、原生资源及机械实体根。观察历史保留的尸体仍可存在于原存档实体图，但不因此要求成长组件或重新绑定 hooks；加载不发奖励、不重新应用差额

对外配置的已启用/仅 helper/后续待接线状态见 [growth-config §1](growth-config.md)。1a 不推进专注恢复/技能冷却时间、不执行属性/技能/身份/模板；没有扩展通用脚本解释器或某个样例技能 ID 的规则分支。checkpointGenerationWorld 本步未优化，性能测量与缩小写集方案见 [1a 报告](phase1a.report.md)。


## 11. 1a1：生成检查点的显式写集

`checkpointGenerationWorld` 不再从整个 Game 递归捕获。Game 在调用内选择写集，捕获仍保存原对象的属性描述符、Map/Set 成员与 typed-array 字节；失败时原位恢复，不重新加载存档、不替换实体、不调用所有权数组 setter。选择根的成本包括在检查点捕获计时中。

- Game 顶层、levels 容器、非目标缓存层包装对象做浅快照；顶层指针替换/标量写入和缓存成员增删仍能撤销
- 深快照覆盖玩家/背包、当前/休眠/炼狱/所有缓存层及 pending fallen 的生物图（包括 leader/carriedMonster/carriedItem、观察集中仍有的生物）、相关数组、物品与坠落队列、levelSeeds、计量生成表、stats、矿灯参数、鉴定集合
- 真正重访目标或同层重入的网格/环境/模拟光照/气味图仍深捕获；未触达缓存层的几何、光照、环境、FOV、气味和 waypoint 大图只保留引用。缓存怪物不可整体排除：跨层 demote 修改领导/waypoint 标志，monstersFall 可追加已缓存下一层的原 monsters 数组
- 新层挖图期间，部分 DF 早于替换 scent/waypoints；无条件 aggravate 会改离层气味、waypoint 0 和可重用 scanner，因此这些仍捕获。其它旧 waypoint 距离图与 coverage 保留引用；重访目标 setUpWaypoints 会替换 coordinates/distanceMaps/coverage，旧图保留引用，scanner 仍捕获
- 录像/回放历史和 UI 详情没有生成期写入，保留顶层引用。旧浮字/发现消息/flare/flash 队列在本边界只追加或替换，保存引用和原长度。模拟光照与纯显示缓存区分：LightMap 保存旧 visualMap 引用和弱 renderSources 列表的引用/长度，避免失败重访影响下一次 dance
- 既有 RNG/日志/奖励配额/死亡 WeakSet/DF 会话绑定/陷阱弱状态恢复继续保留；实体 ID 不回退重用；机器编号保留原生成路径的分配/重置行为，不随外层失败回退，经典模式从不调用检查点

写集的前提是当前 generation、environment catch-up 与受限发布端口。**修改生成、补算或发布路径的写入时，必须同步更新写集，并保证 `ext_generation_checkpoint_differential.test.ts` 差分对照测试通过**；不能把此函数当作任意 Game 修改事务。实现、反例覆盖、性能及完整门禁见 [1a1 报告](phase1a1.report.md)。


## 12. 1b：纯求值、属性提交和物品永久收益

实际实现位于 `growth/evaluator.ts`、`attributes.ts`、`items.ts` 与 `module.ts`，精确版本为 growth@1.2.0。模块的 `rulePolicies` 只收到冻结数值 DTO 和只读组件/模块视图，没有 RNG、日志、命令或活对象能力。重复查询不写状态；多模块争同一未定义策略槽直接拒绝。加法预算和乘法槽组合见 growth-config §5.1；攻守物伤只通过一个合并端口缩放一次。

经典 Combat 原 solver、Game 原潜行/搜索函数体保留；扩展在已有 hooks 分支选扩展 solver，Game 在扩展会话组装时安装会话原型上的策略方法，新局/读档退休时恢复。会话 WeakMap 只保存原型/当前一次搜索模式，不替代持久状态；无新增 Game 实例字段，U03 清单不变。原命中短路/概率100%取骰优先；手动搜索只标记它自己的那次原搜索，后续 turn-end 自动搜索不能继承 manual 标记。

属性/洗点通过原 executeCommand→module command 记录。公开命令只能操作当前玩家；只读预检在取消旅行/改显示/录像前做完。合法提交用 CAS 受控 HP/maxHP/STR/gold 能力与模块组件一起写入；异常回滚这些字段及模块状态。奖励安全点和原物品永久增益边界也覆盖新增 STR/gold，不能只回滚 HP。数值派生和正常物品增益的所有者分开，load 不补差额，形态变化先剥离旧成长基值，保留 CE 原生当前生命语义后只加回一次。

生成写集回归增加测试专用原 1a0 完整对象图检查点作为独立对照，不调用当前缩窄选择器。固定种子的新层、重访、坠落及同层进入分别注入生成/发布失败，对照世界投影、实体图、双 RNG、消息/待确认/战斗缓冲和模块状态。另一个完整描述符遍历检查原对象身份、别名、Map/Set、typed bytes 和存档未登记字段；两项 mutation controls 分别证明漏真实 gas 写入和新增离层几何写入会失败。弱会话状态仍沿显式生命周期快照，LightMap 弱光源修复由独立行为回归保护；不把普通对象图遍历声称能观察 WeakMap。

1b 不实施成长 UI、技能动作执行/客观时钟或身份模板；没有新增生产 undo journal。门禁与覆盖矩阵以 [1b 报告](phase1b.report.md) 为准。


## 13. 1c：会话只读投影与刻符角色页

`ExtensionModule.view` 是只读显示数据描述符。运行器创建会话时分离复制并深冻结定义和字段选择；`readModuleView` 只复制该模块指定的当前玩家组件/少量状态字段，返回不入存档的 opaque 会话身份。不会遍历整局、奖励收据、因果状态或所有怪物，也不向 UI 交付模块写能力。经典运行器为空，读模型立即返回 null。

`growth/view.ts` 负责定义驱动条目、经验阈值、合法草稿、资源与上下文参考预览、技能/槽位/前置和身份目录。草稿需要会话与 revision 同时匹配；提交 helper 再读当前会话，输出严格的已有 allocate/respec payload，最终仍由引擎命令预检与原子提交裁决。临时草稿、标签页、焦点、模态和成功提示不进 Game，不加实例字段，不改 U03 合同或 growth@1.2.0 规则版本。

`App.vue` 拥有角色页显示状态，保持背包/检视/原生确认与目标选择隔离。`GameCanvas` 的可选显示模态属性只停止帧驱动的自动推进并屏蔽地图输入，不通过 interrupt 命令污染取消流程；关闭后恢复显示焦点。实体状态与随机数的不变性、真实组件行为和浏览器尺寸验收由1c报告列出。技能执行/身份创建仍等1d/1e授权，不因显示目录而启用。
