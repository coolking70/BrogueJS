# 阶段 0：扩展底座

基于 main `3c1407fcb0b074a7b4dd4879d15eb7c0be346749`。本阶段只搭底座；不引入成长、NPC、魂系战斗或多格规则。范围与优先级遵循 [路线](README.md)、[Lost Flame 机制笔记](references/lost-flame-notes.md) 和 [totalwar 笔记](references/totalwar-notes.md)。机制结构自行设计，未读取/复制商业游戏代码、数据或素材，未查 CE 源码。

## 1. 隔离与输入边界

现有 `Game.mode` 仍表示 normal/easy/wizard/test 的难度/调试方式。新 `ruleSet` 是从 `extensionRuntime` 派生的只读访问器：classic / extended。菜单默认“经典 CE”，另可选“扩展模式”，两个选择与原难度独立，文本全部在 `zh_CN.json`。

经典新局不调用注册表、工厂、模块初始化、派发或数据定义校验，`extensionRuntime === null`，生物没有扩展回调，存档/录像不添加扩展键。引擎只做空值分支；原规则、骰子次序、实体编码及经典 JSON 投影不变。模块代码的静态导入只声明类型/函数，没有顶层注册、随机调用或新局副作用。经典守卫用原 main 捕获的双流完整 tuple（含实质流计数）比较开局、命令攻击和等待结果，并断言注册/启用/钩子均零调用；既有黄金 trace 与生成基线保持原断言。

新局选择属于录像起点配置。局内所有改状态输入经 `Game.executeCommand` / `executeItemCommand`。模块命令格式是 `executeCommand('ext:command', JSON.stringify({ module, action, payload }))`，`applyCommand` 在实时、回放、seek 中使用同一个派发器。模块命令必须自行校验 payload，不直接从 Vue 事件修改组件状态；本阶段示例不添加任何玩家命令。物品仍使用原命令边界。

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

事件输入是深拷贝且深冻结的 DTO；`CreatureView`/`ItemView` 是摘要，不是活的引擎对象。模块只能通过 context 读写自己的 JSON 状态和自己命名空间里的生物组件；不能通过事件直接修改 HP、地图、命中或原伤害数值。context 的 `state` / `getComponent` 返回深拷贝。`setState` 和可选 `componentValidators` 校验写入与读档，所有数据还须有限值、无循环、无原型键的 JSON。

以下事件均属于同步模拟生命周期，可通过 `context.randomInt` 消耗引擎实质随机流。该 API 强制选择实质流并恢复原流选择器；不创建第三条流。显示、保存、校验、读取/卸载禁止 RNG。回调顺序固定，随机调用数也因此固定。模块不得直接使用 `Math.random`、时间、网络或装饰流决定规则结果。

| 钩子 | 准确位置 / 时机 | 事件可读数据 | 可写与随机合同 |
|---|---|---|---|
| `beforeLevelGeneration` | `Game.generateDepth`，目标层首次访问，调用原 `GenerationCoordinator.generateDepth` 前 | 目标深度 | 自身状态/组件；此时用进入前的全局实质流，旧楼层仍是当前世界 |
| `afterLevelGeneration` | 同一包装方法，原生成与入层补跑/落点/居民恢复完整返回后，只首次访问触发 | 目标深度 | 自身状态/组件；原生成器已恢复返程种子，使用恢复后的实质流 |
| `creatureSpawned` | `MonsterLifecycle.ownedMonsterList` 的列表绑定/插入调用 `runtime.attachCreature`；玩家在新局初始化后显式绑定 | 生物 ID/名字/HP/位置/是否玩家 | 自身状态/组件；每个对象每局首次绑定一次，换列表/唤醒/重访不重复，读档不发；生成期间用当前楼层随机域 |
| `playerTurnEnded` | `Game.finishTurnEpilogue`，原结算、最终视野、消息合并后 | 原 `stats.turns` | 自身状态/组件；覆盖同步、动画与强制回合的共同收尾，原回合调度不改 |
| `beforeAttack` | `CombatSystem.attack` 包装器，原 `resolveAttack` 任何掷骰/早退之前 | 攻防双方摘要 | 自身状态/组件；无取消或改伤害接口；覆盖原 attack 的近战与复用该入口的效果 |
| `afterAttack` | 同包装器，原结果返回后、调用者的额外符文/分裂/文本等后处理之前 | 双方结算后摘要、完整只读 `AttackResult`（含未命中/抓持等早退） | 自身状态/组件；异常时只清理攻击来源栈，不发成功结果事件 |
| `damage` | `Creature.takeDamage`，原吸盾、血迹、转移回调、扣 HP 之后，调用 `die` 之前；另在 `Player.recoverPerTurn` / 旧饥饿入口的原扣血点及 `Game` 否定致死赋值插入 | 生物摘要、原 HP、HP 伤害、当前攻击源 ID 或 null | 自身状态/组件；吸盾与免疫仍由原路径决定。零伤害也可发事件；否定致死沿原后续零伤害通知另有事件，不能按事件次数当伤害次数 |
| `kill` | `Game.killMonster`，`deathProcessed=true` 后、乘客处理前；原去重旗标防重复 | 死者摘要、攻击源 ID 或 null、是否行政移除 | 自身状态/组件；死亡 DF 在此之前，可发生递归死亡。行政移除也报告，示例明确忽略 |
| `itemPickedUp` | `Game.logPickup`，手动拾取及位移/行走拾取的共同成功出口 | 玩家摘要、原物品 ID/类别/数量（堆叠可合并） | 自身状态/组件；满包/避让/取消均不发，金币也发；事件与原移除地面对象相邻，不要推断事件发生时所有后处理都完成 |
| `itemUsed` | `Game.quaffItem` / `readItem` 成功消费并应用效果后的回合尾前；`consumeFood` 成功消费/补营养后；护符 `invokeCharm` 的成功 endTurn；法杖/魔杖 `commitArcanaTarget` 后 | 玩家/物品摘要、quaff/read/eat/charm/arcana | 自身状态/组件；取消、冷却、已知空杖不发。未知空杖按原消耗回合的使用尝试发；选择法器目标本身不发 |
| `enteredLevel` | `Game.generateDepth` 完整返回后，排在 `afterLevelGeneration` 后；包含重访和首层 | 深度、firstVisit | 自身状态/组件；使用入层后的实质流 |

钩子边界有意不伪装成完整规则替换系统：`kill` 当前是怪物生命周期，玩家死亡仍通过原终局流程；`sourceId` 仅在 `attack` 栈内可信，环境、普通法术伤害为 null，不能直接据此给玩家 XP。投掷的独立 `projectileWeaponHit`、独立法术伤害不发 attack 事件，但 HP 损失走 damage，怪物死亡走 kill。生成重试/蓝图回滚中的列表插入可能是暂态出生；阶段 1 若按出生附加持久复杂状态，要先加入生成事务的提交/回滚钩子。上述范围是阶段 0 的明确能力边界，不改变旧规则来统一入口。

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

生物组件使用独立表 `components[creatureId]['moduleId:componentName']`，玩家、敌人、中立 NPC、盟友使用相同 API。已有 `ProgressionComponent`、`AttributesComponent`、`ProfessionComponent` 类型及纯校验器，未来种族/信仰/技能以新组件加入，绝不往 Player 添加专属成长字段。模块用 `componentValidators` 登记自身组件规则。实体 ID 为本局稳定 ID，涵盖当前/缓存层、休眠、携带、待坠落、炼狱实体；读档绑定整个实体图。死亡组件可保留供复活，局结束清空；长期局的墓碑回收策略留待阶段 1 设计，不能简单按“当前楼层不在场”删除。

## 5. 独立扩展存档区块与契约

扩展局顶层 `GameSnapshot.extensions`：

```json
{
  "manifest": { "schema": 1, "modules": [{ "id": "example", "version": "1.0.0" }] },
  "modules": { "example": { "kills": 1 } },
  "components": { "1": { "growth:progression": { "level": 1, "experience": 0 } } }
}
```

上例 components 的 growth 仅说明格式，真实包必须将 growth 纳入 manifest，否则拒绝。模块版本同时负责自身状态/组件格式；顶层 schema 负责底座包络。集合/版本、状态键集合、模块校验器、组件 ID/命名空间/JSON 均先校验，不接受部分扩展读取，不做迁移。经典局省略 extensions；显式扩展模式即使模块列表为空也保存包络。

`Game.extensionRuntime` 是新增的唯一实例字段，已登记 `scripts/u03-state-contract.json` 的 persist 合同。函数、事件处理器、实体回调与工厂不序列化；仅扩展包络深拷贝。生物回调是 `Creature` 访问器背后的 WeakMap，U01 实体字段登记表与原 codec 不变。经典 U03 世界投影不增加任何键。

`toSaveSnapshot` 的 `run.recordingOrigin` 携带扩展 manifest，起点及末命令的扩展 checkpoint 必须对应当前包络，才能保留完整续录来源。缺/伪造来源仍遵循原世界诊断档规则；有扩展来源却删除顶层扩展区块拒绝。快照不是对任意手改世界的真实性证明。

## 6. 录像与确定性

经典录像 version 2、字段、检查点保持不变。扩展录像附加可选头 `extensions: { schema: 1, modules: [{ id, version }] }`；每条扩展命令检查点附加 `extensions: ExtensionSnapshot`。兼容校验按本地注册表精确核对头中的集合/版本；读取后按头启用该集合，不要求播放器当前正在玩同一模式。已注册但未在头中启用的模块不参与回放，缺依赖或缺模块拒绝。

删除头而事件仍含扩展数据/命令、改变版本、未注册模块、非法状态均明确拒绝并给本地化提示。回放保留原位置/回合/决策/双 RNG 校验，再以规范键序 JSON 比较扩展状态；差异进入原 OOS，消息使用现有本地化 OOS 显示。seek 通过原重新开局+命令执行路径，扩展状态不从任意跳转点猜测恢复。

阶段 0 为便于调试，每命令保存完整扩展状态。阶段 1 状态变大后应测量录像体积，设计稳定摘要和周期快照；不能在没有等价测试时直接删 checkpoint。所有模块须升级版本来记录规则/数据变更，避免同版本数据漂移造成无提示错误。

## 7. 示例与验证

内置 example 1.0.0 每次非行政怪物死亡累加 kills，使用 `ext.example.kill` 在原消息栏显示。它统计死亡生命周期，不代表“玩家击杀归属”；也不会提供经验/等级。保存与回放都记录该计数，默认扩展局启用它。

`ext_validation.test.ts` 另覆盖严格 JSON/容器及同步生命周期边界；`ext_foundation.test.ts` 覆盖注册/依赖、钩子顺序、状态/双生物组件往返、纯数据校验、真实拾取/使用、随机流接入、行政死亡去重、非法头拒绝、自然地图21条命令的击杀录像/seek/读档续录、扩展 checkpoint OOS，以及经典零模块调用+原 main 精确 RNG。既有测试、trace、生成夹具不修改。浏览器在1440×1000及390×844验证开局选择、自然击杀提示、存档录像和不匹配提示，截图不入库；手机尺寸是浏览器模拟，未声称安卓实机测试。

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
