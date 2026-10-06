# 5A4 任务书：采食底座（可食世界物品、火接触、非魔法种类知识、整局派生抽样、分组放置、生物需求时钟、离队退役、沉眠状态）

> 基线：**5A3 合入后的 `ext/phase5`（维护者开工时填写确切 commit：`________`）**。工作分支 `ext/phase5`。顺序 5A2 → 5A2-S → 5A3 → **5A4**，同一本地主笔串行（共享 `Game.ts`/`runtime.ts`/`TimeCoordinator.ts`）；可与 dot 的 5B（只写 `src/ext/modules/crafting/**`）并行。
> 依据：[野外采食设计稿](phase5-foraging.md)（§9 H1–H8、§6、§11 的 5A4a–d 行、§12；§16 维护者 2026-10-06 裁定：Q12=B——篝火/灶台首版即可烤，按 §6.1 第 5 条软接口；Q1–Q11 全部 A）、[阶段 5 设计](phase5-settlement-world.md)（§8.3a、§14 的 5A4 行）、[C5-1 合同 r2](phase5a-contract.md)（含 5A1 后由 `ext/phase5` 写入的 §10.2 维护者裁定；本步读 §2、§3.1、§3.4、§4、§5、§9、§10、§11）、[5A2](phase5a2.task.md)/[5A2-S](phase5a2s.task.md)/[5A3](phase5a3.task.md) 任务书及其报告、[5B dot 任务包](phase5b.dot-package.md) §1.4（火炉 `station.hearth`）。行号以 `ext/phase5` 的 `8e946bb`（5A1 合入后）为参考，开工时按语义重定位并写实际行号。
> 本步只交付**底座能力 + 底座测试 fixture `fgfixture`**，不建 `src/ext/modules/foraging/**`、不写任何蘑菇种类/数值/文案。`src/ext/worldSdk.ts` **逐字不变**（同 5A3 R2）。开发期门禁按 P5-D14=A 与[扩展门禁政策](README.md#当前验收门禁)。**不要 commit。**
> 本任务书 §1 的预先裁定由 Claude 依据已批准设计拟定，**待维护者签认**；签认前不得开工。

## 0 开工核对（不通过先停下报告）

1. 5A2、5A2-S、5A3 均已合入；记录 foundation 号（预期 9）、whole-run（预期 v5）、录像 4、来源 2、IDB v2；`worldSdk.ts` 的 SHA-256 与 5A2 报告冻结值一致；5A3 引入的扩展定义包类型（`structures?`/`restPoints?`）的实际导出文件名。
2. 复核代码事实（`8e946bb` 参考行号）：
   - 吃：`Game.ts` `eatItemStages`（~5363，耗时 `player.movementSpeed` + `playerTurnEnded`）、`consumeFoodStages`（~5379，仅 FOOD、"不太饿"确认、`itemUsed` 事件）、`applyCommandStages` 的 `item:` 分派（~3751）；`TimeCoordinator.objectiveTimeBlock` 自动进食（~312，只找 `ItemCategory.FOOD`）。
   - 火：`TimeCoordinator.updateEnvironment`（~342；`fallFloorItems → burnFloorItems → driftFloorItems` ~414）、`Game.burnFloorItems`（~12290，熔岩毁非护符、火只烧 SCROLL）、`burnFloorItemsAt`（~13045，`fillSpawnMap` 的 `burnItems` 回调 ~12929，只烧 SCROLL）、`burnFloorItem`（~13052，先删再刷新再播 `DF_ITEM_FIRE`）、`exposeCreatureToFire`（~11747，`current===0` 时播"着火"，再取 max）。
   - 投掷：`throwItemAtStages`（~7938；药水碎裂、燃烧镖、通用落地 `qualifyingThrowLanding` ~8150）。
   - 爆炸：`DungeonFeatureCatalog.ts` `DF_EXPLOSION_FIRE`（~642）、`DF_BLOAT_EXPLOSION`（~657）、`DF_ITEM_FIRE`（~609）；`Game.ts` ~9695 爆炸 bloat 的 `spawn(m, DF.DF_BLOAT_EXPLOSION)`。
   - 知识：`ItemLoader` `identifiedItems/callTitles/magicPolarityRevealed/callKind`（~457–480）、`detectMagicOnItem`/`tryIdentifyLastItemKindsAllPolarityCategories`（`Game.ts` ~5110–5151）、`chooseIdentifyTarget`/`canIdentifyChosenItem`（~7278）、`callItem`/`itemCallMode`（~7343）；5A2 对 MATERIAL 的 D9 拒绝入口与显示名实现位置。
   - 状态：`Creature.ts` `StatusId`（~13）、`takeDamage`（~351）；`'paralyzed'` 的全部非测试读者（基线粗计 Game 24、Combat 11、TimeCoordinator 5、PhasedAttackProduction 5、CombatText 3、ActorCombatResolution 3、growth view 2、Monster 2、CompositeMovement 2、其余各 1）。
   - 盟友：`Game.becomeAllyWith`（~14021）、`relationshipChanged`（`Monster.ts` ~829、`Game.ts` ~6475、`runtime.ts` ~1262）、`MonsterMode.PERM_FLEEING`（`Monster.ts` ~287；`MonsterTheft.ts` ~54 的逃跑先例）。
   - 随机：`Random.ts` 双流、`randRange`（~149）；`WorldSettlement.offlineDraw/offlineSeedKey`（~166–190）；5A2 的 `c5-place-v1` 候选与抽样实现位置；5A2-S `stats-config.md` 的实际键名（预期 `native.strength`、`native.hit-chance`、`native.physical-damage-dealt`）与 `more` 槽下限。
   - 时间：合同 §3.1 的 `simulationTicks` 唯一提交点在客观块之前（`advancementLoop` 中 `soonestTurn>0` 分支）。
3. `git log` 记录基线与干净工作区。通读设计稿 §2–§9、§12 后再动手。

## 1 预先裁定（签认后不再回问）

| # | 事项 | 裁定 |
| --- | --- | --- |
| E1 | 版本 | foundation 号 **+1**（5A3 实际号 +1，预期 9→**10**：新增 foundation 快照键、包键、可选模块字段）；whole-run **v5→v6**（`Item` 新可选字段 `fireContactCooldownUntilTurn`、`StatusId` 新值 `slumber` 改变实体字段合同）；录像格式 4、来源 2、IDB v2、`World5Snapshot.schema` 1 均不变；growth/narrative/combat/giants/crafting 及 `c5fixture`/`craftskel` 版本不改。子里程碑之间不得各自升号 |
| E2 | SDK 冻结与入口 | `src/ext/worldSdk.ts` 逐字不变（SHA-256 测试）。新增模块可见入口 **`src/ext/edibleSdk.ts`**（只做类型/常量再导出），其来源文件 `src/ext/worldEdible.ts`、`kindKnowledge.ts`、`actorNeeds.ts`（模块可见类型）；可信实现放 `src/engine/Core/Edible*.ts`、`FireContact.ts`、`KindKnowledge.ts`、`DerivedDraw.ts`、`PlacementGroups.ts`、`ActorNeeds.ts`、`ActorDeparture.ts`（命名可微调并在报告列出）。boundary 守卫：内容模块只能 import `worldSdk.ts`、`edibleSdk.ts`、`stats.ts` 获取世界/采食能力，不得 import 上述可信文件 |
| E3 | 包键 | 在 5A3 的扩展包类型之上以**可选键**加入 `edibleItems?`、`knowledgeGroups?`、`placementGroups?`、`actorNeeds?`；缺省不归一为空数组，**不含这些键的包（骨架、crafting、c5fixture）规则指纹逐字不变**（测试）。声明任一键或任一新模块字段（E4）的模块必须 `worldSdk: 1` 且声明 `worldDefinitions`（world5 必然存在，需求时钟依赖 `simulationTicks`）；否则构造失败 `C5_BAD_VERSION` |
| E4 | 新模块字段（`ExtensionModule`，`types.ts`） | `edibleCommands?: Partial<Record<'feed'\|'roast', EdibleCommand>>`、`edibleParticipant?`、`actorNeedParticipant?`；与 `commands`、`worldWorkCommands` 同名 action 互斥（构造期检查）；声明 `actorNeeds` 必须同时声明 `actorNeedParticipant.qualifies` |
| E5 | 错误码 | **不新增错误码**，全部复用 `WorldErrorCode`（`import type` 自 `worldSdk.ts`）与 `WorldResult`；映射见 §2 各节；玩家只见 `ext.foundation.world.error.*` 既有 i18n |
| E6 | 可食物品身份 | 可食物品 = `ItemCategory.MATERIAL(13)` + `worldItem.definitionId` 指向某个 `edibleItems` 定义（`quality:'basic'`、`toolDurability:null`）。`ItemRead.category` 报 `'material'`，`tags` 取可食定义（settlement 据 `food.ingredient.mushroom` 计数）。可食物品**例外于 5A2 D9**：可吃、可扔、可燃（火接触）；仍不可装备/阅读/使用；不受鉴定流程影响；原生生成/掉落永不产出 |
| E7 | 来源与配方 | `ResourceDefinition.yield` 可引用**同 owner** 的可食定义（5A2 校验扩展）；采集输出按 5A2 正常创建 MATERIAL Item（maxStack ≤20，预留/退款同 5A2）；`startupItems` 与配方 inputs/outputs **不得**引用可食定义（`C5_BAD_DEFINITION`） |
| E8 | 吃/喂/烤耗时 | 吃 = 原生 `player.movementSpeed`（沿 `eatItemStages`）；喂食、烤制命令同样 `movementSpeed` + `playerTurnEnded`（常速即设计稿的 100 tick，随加速/减速变化）；扔沿原生投掷 |
| E9 | "不太饿"确认不泄露 | 已知（`known`）或不属任何知识组的定义：沿原生 `STOMACH_SIZE − nutrition < satiety`。`unknown/tasted` 定义：阈值改用**该知识组全部成员的最大 satiety**（组内常数，不随种类变）。喂食对目标需求值同理。文案 foundation 键 `ext.foundation.edible.confirm.not_hungry`、`…confirm.overfeed` |
| E10 | 状态施加 | 每个 `EdibleStatusId` 调用该状态**既有的原生施加路径**与原生免疫判定（不另写公式）：hallucinating/telepathy/darkness/confused/nauseous/paralyzed 取较大值；poisoned 走原生中毒累加（CE 规则，故会叠加）；haste 玩家走加速药水路径（`haste`，清 `slowed`）、怪物走法杖路径（`hasted`）；slumber 取较大值。**telepathy/hallucinating/darkness 对非玩家目标不写状态**，outcome 记 `notApplicable:true`（原生对怪物无对应语义，避免未测路径） |
| E11 | 临时属性 | `temp-stat` 由 foundation 自有 L4 来源"定时授予"实现（新根 `timedStats`）：玩家用 `player.key/value`（预期 `native.strength` flat +N，物化键，授予与到期同事务 `reconcileMaterialized`）；非玩家用 `other.key/valueBp`（query 键）。同一 (actor, 定义 owner, key) 再次授予只把到期刷新为 max，不叠加。来源有效性是纯函数 `simulationTicks < untilTick`；到期行在客观块（活动层）与入层事务中删除 |
| E12 | 地面火接触与冷却 | **所有地面入口统一受冷却约束**：一次接触后写 `Item.fireContactCooldownUntilTurn = absoluteTurnNumber + 10`（10 个客观块）；`absoluteTurnNumber < until` 期间任何地面入口（含火蔓延的 `fillSpawnMap`）都不触发。拾取、放入容器、被怪物携带时删除该字段（不写 undefined）。背包入口与烤制命令不看冷却 |
| E13 | 背包着火（Q2=A） | 仅在**玩家**燃烧时长 0→正的那一次 `exposeCreatureToFire` 中、`setBurningDuration` **之后**判定：按 `inventoryLetter` 升序，对每一堆可食物品抽一次实质流 `rng.randRange(1, 3) === 1`；无可食物品时 0 次抽取。同伴/怪物携带物不判定 |
| E14 | 爆炸 | 定义 `fire.onContact:'explode'`：数量 `< largeAtQuantity` 用 `DF_EXPLOSION_FIRE`，否则 `DF_BLOAT_EXPLOSION`；伤害/点火/连锁全部沿原生。地面在物品格、背包在玩家格、烤制命令在**热源格**。熔岩上的爆裂物品爆炸，其余可食物品沿原生熔岩销毁（`burnFloorItem`） |
| E15 | 先移除后效果 | 任何接触（变形/烧尽/爆炸）**先**完成物品移除或变形与冷却写入，再调用参与者，再写消息，最后 `spawnDungeonFeature`（同 `main` 的 `fef0ef8` 教训：陷阱先消耗再生效，防自触发） |
| E16 | 连锁与重入 | 火接触一律进**会话队列**（U03 session，命令边界必须为空，save 断言为空）：`fillSpawnMap.burnItems` 回调只入队；`DungeonFeature` effects 新增可选回调 `spawnSettled()`，在最外层 `spawnDungeonFeature` 返回时调用（无回调/队列空即 no-op；生成期 effects 为 null）；排空时 `draining` 标志屏蔽重入，FIFO 处理，同一次回调入队的多件按 Item ID 升序；不在 DF 内的入口（客观块地面检查、投掷落地、背包着火、烤制）入队后立即排空。每件物品每次排空至多一次接触（冷却/删除保证终止） |
| E17 | 热源（Q12=B） | 热源由 **foundation 识别**，不要求提供方改代码：(a) combat 篝火（foundation 既有 `worldRest` 绑定识别的 interactable）；(b) 任何 owner 的 world5 工位，其定义 `stationTags` 含 `station.hearth`（crafting 火炉、5C1 settlement 灶台、绑定 5A3 fixture 的工位）。热源本身不被引燃、不产生火地形。用热源：玩家同层、已见、Chebyshev ≤ 热源 `interactionDistance`（篝火定义/工位定义）、`hasInteractionLine`；无威胁限制 |
| E18 | 投掷入火 | 投掷物通用落地后，若落点为燃烧格（`T_IS_FIRE`，经 5A3 `cellProperties`）或热源格 → 立即一次接触（cause `thrown` / `heat-source-throw`），受 E12 冷却；之后回合正常结算。不碎、不伤人（可食物品投掷沿原生非武器投掷） |
| E19 | 变形实现 | 变形就地改 `worldItem.definitionId`（Item ID、数量、`inventoryLetter` 不变；不自动合并相邻同定义堆）；`burn-up`：地面沿 `burnFloorItem`（删除 + `DF_ITEM_FIRE`），背包内直接删除不播 DF |
| E20 | 效果解析 | 定义 `effect` 可为 `derived-choice`：foundation 用 H4 在 `(owner, domainId, ordinal)` 上取 `range(options.length)` 选项；结果是会话派生缓存，load/seek 重算。烤制"保留/去除"政策即以此表达（模块数据），不存档、不显示 |
| E21 | 知识写入 | 只经参与者事务 `markKnowledge`（仅本 owner 组成员；单调 `unknown→tasted→known`、`unknown→known`；回退/越组返回 false 不写）与原生 `item:call` 绰号命令。foundation 不自动推断"知道烤即知道生"——此语义归 5G（§12 建议） |
| E22 | 原生知识隔离 | 鉴定卷轴不可选中、探测魔法不标极性、最后种类升格不计入、任何"揭示全部"不触及、`itemKnowledgeChanged` 与 `knownKinds()` 不含登记表、幻觉时可食物品名称**不随机化**（0 RNG） |
| E23 | 放置偏好词汇 | 首版地形标签只有 `terrain.luminescent-fungus`（`LUMINESCENT_FUNGUS`）与 `terrain.fungus-forest`（`FUNGUS_FOREST`/`TRAMPLED_FUNGUS_FOREST`），按基础层类型读取（5A3 的"基础类型读者"）。设计稿 §4.2 的"洞穴型区域"在生成后无持久标记，**首版不支持**（见 §12 设计缺口） |
| E24 | 分组放置时机 | 某层首次 visited 的 enteredLevel 事务中：5A2 `c5-place-v1` 逐定义放置 → **本步分组放置**（按 (owner, groupId) 码点序）→ 5A2 启动礼包 → 模块 enteredLevel 钩子。分组成员的 `ResourceDefinition.placement` 必须 `{dungeon:null, site:null}`（若 5A2 校验拒绝两者皆 null，对"被某分组引用的定义"放宽并报告） |
| E25 | 需求时钟资格 | 资格由模块纯谓词 `qualifies(needId, facts, ctx)` 判定，foundation 只在固定触发点调用（§2.6）；不在每回合轮询。死亡即删行（不保留到复活）；复活后经 `ally-gained` 触发按 `initial` 重新挂载 |
| E26 | 离队态（Q4=A） | Brogue 无中立阵营，故"非敌对离开"实现为：保留 `isAlly` 标记但移出跟随链、不可指挥、不发起攻击、不随玩家换层，AI 改为向最近楼梯（不可达则远离玩家）移动；被玩家攻击照原生"攻击盟友"确认。退役条件（客观块按 actorId 检查）：到达楼梯格、玩家不可见、到达 `untilTick`；玩家离层时该层离开中者同事务退役 |
| E27 | 退役 | 移出整局：携带物按稳定近邻序落地（无位则留在原格）、群体（giants 核心）整体退役、删除其组件/需求行/定时授予/离开行；**不**发 kill/death 事实、XP、`MA_DF_ON_DEATH`、死亡消息，不进复活候选；发新钩子 `actorDeparted`（非死亡事实）；写 foundation 离开收据 |
| E28 | 沉眠 `slumber` | 新 `StatusId`；新谓词 `isIncapacitated(c) = paralyzed ∨ slumber`。凡读者语义为"不能行动/无助防御（必中、×3 等）/输入锁/自动推进/中断判定"一律改用谓词；"麻痹专属"语义（麻痹免疫、麻痹气体、解除麻痹的效果、麻痹文案、CE 麻痹时不耗饥饿）保留只读 `paralyzed`。任何 `takeDamage` 收到 `amount>0`（含被护盾吸收）即同事务清除 slumber 并写醒来消息。免疫判定与 paralyzed 相同。经典局永不施加 |
| E29 | 参与者失败 | 命令内（eat/feed/roast/call）：参与者异常/Promise/越权 → 全回滚，命令成为已记录的 0 成本拒绝（`C5_PROVIDER`）。时间推进中（火接触、需求事件、离队）：丢弃该参与者的暂存写入，机械结果照常提交，写会话诊断；确定性可重放（同 5A2 批完成失败的做法） |
| E30 | fixture | 测试专用模块 `fgfixture`（`src/ext/testing/fixtures/forageFixture/`，定义 ID 前缀 `fgfixture.`，不进生产 catalog/构建），配套 `src/ext/testing/forageHarness.ts`（包装 5A2 `createWorldHarness`；合同 §9 的 `WorldHarnessOptions.fixtures` 联合类型冻结，不扩展它） |

## 2 接口与数据合同（实现须逐字落地；数值范围为运行期校验）

所有新类型遵守合同 §2 的通用规则：严格未知键、安全整数、validId（1…128，定义 ID 以 `owner.` 开头）、码点排序、DTO 深复制深冻结；文本键归 owner locale；颜色 `#RRGGBB`。

### 2.1 H1 可食世界物品与效果意图（`src/ext/worldEdible.ts`）

```ts
import type { DefinitionId, ModuleId, EntityId, Revision, ContentStamp, Tick, Position,
  JsonValue, DeepReadonly, WorldResult } from './worldSdk';
export const EDIBLE_SDK_VERSION = 1 as const;
export type EdibleStatusId = 'poisoned' | 'hallucinating' | 'confused' | 'nauseous'
  | 'telepathy' | 'darkness' | 'haste' | 'paralyzed' | 'slumber';
export type EffectIntent =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'heal-fraction'; percent: number; min: number }>         // 1..100 / 0..1000
  | Readonly<{ kind: 'status'; status: EdibleStatusId; turns: number }>      // 1..1000
  | Readonly<{ kind: 'status-and-satiety'; status: 'nauseous'; turns: number;
      satietyLoss: number; floor: number }>                                  // 1..2150 / 0..2150
  | Readonly<{ kind: 'temp-stat'; turns: number;                             // 1..2000
      player: Readonly<{ key: string; value: number }>;                     // flat，物化键
      other: Readonly<{ key: string; category: 'increased' | 'more'; valueBp: number }> }>
  | Readonly<{ kind: 'explosive' }>;                                          // 吃/喂无效果
export type EdibleEffect = EffectIntent | Readonly<{ kind: 'derived-choice';
  domainId: string; ordinal: number; options: readonly EffectIntent[] }>;    // 2..8，不可嵌套
export type FireBehavior =
  | Readonly<{ onContact: 'transform'; to: DefinitionId; messageKey: string }>
  | Readonly<{ onContact: 'burn-up'; messageKey: string }>
  | Readonly<{ onContact: 'explode'; largeAtQuantity: number; messageKey: string }>; // 1..20
export interface EdibleItemDefinition {
  owner: ModuleId; id: DefinitionId; nameKey: string; descriptionKey: string;
  glyph: string; color: string; maxStack: number;          // 1..20
  tags: readonly string[];                                 // ≤16，去重码点序
  satiety: number;                                         // 0..2150
  effect: EdibleEffect; fire: FireBehavior;
}
```

- 校验：每 owner ≤128 个可食定义；`transform.to` 必须是同 owner 可食定义且转化图无环；`temp-stat` 的键必须在 5A2-S 键表中、`player.key` 为物化键、`other.category` 与 `valueBp` 落在该键该类别的预算内（`more` 槽下限按 5A2-S 实际值，预期 0）；`derived-choice.domainId` validId。
- **吃**（原生 `item:eat|<letter>`）：`eatItemStages` 新分支 `isEdible(item)` → `consumeEdibleStages`：资格同原生（非交互中、未锁输入、未死、`!isIncapacitated(player)`）→ E9 确认 → 扣 1 → `nutrition = min(STOMACH_SIZE, nutrition + satiety)` → `refreshHungerState` → 解析并执行意图（作用于玩家）→ `itemUsed{operation:'eat'}` → 参与者 `onConsumed` → `movementSpeed` + `playerTurnEnded`。自动进食（只找 FOOD）天然排除，须有测试固化。
- 意图语义：`heal-fraction` 回复 `max(min, floor(maxHp×percent/100))` 封顶 maxHp；`status-and-satiety` 先得饱腹，再若值 > floor 则 `max(floor, 值 − loss)`；`explosive` 只得饱腹。
- **扔**：MATERIAL 投掷拒绝对可食物品放行，走原生 `throwItemAtStages`（拆出 quantity=1 新 Item，沿 5A2 拆堆规则），落地后按 E18；不受 C5 8192 接纳预算约束（等同原生操作）。
- **绰号**：`itemCallMode` 对 `unknown/tasted` 可食物品返回 `'kind'`；`callItem` 新分支写登记表 `title`（空白清除；长度上限沿原生 call 输入上限，开工核对写入报告）；`known` 时沿原生"已经知道"消息。
- **命令**（`ext:command`，新分支 `isEdibleCommand` 与 5A2 `isWorldWorkCommand` 并列、先于 `executePreparedExtensionCommandStages`）：

```ts
export type EdibleAction = 'feed' | 'roast';
export interface FeedRequest { targetId: EntityId; targetRevision: Revision;   // = 目标需求行 revision
  itemId: EntityId; inventoryStamp: ContentStamp }
export interface RoastRequest { heatSourceId: EntityId; itemId: EntityId; inventoryStamp: ContentStamp }
declare const ediblePlanBrand: unique symbol;
export interface EdiblePlanHandle { readonly [ediblePlanBrand]: true; operation: EdibleAction;
  owner: ModuleId; actorId: EntityId }
export interface EdibleItemRead { itemId: EntityId; definitionId: DefinitionId | null;
  nativeFood: 'ration_of_food' | 'mango' | null; quantity: number; displayName: string;
  knowledge: 'unknown' | 'tasted' | 'known' | null; satiety: number | null;   // 非 known 时 null
  tags: readonly string[] }
export interface FeedTargetRead { actorId: EntityId; needId: string; targetRevision: Revision;
  band: string; value: number; departing: boolean }
export interface HeatSourceRead { interactableId: EntityId; kind: 'bonfire' | 'hearth-station';
  at: Position; interactionDistance: number }
export interface EdibleContext { actorId: EntityId; at: Position; inventoryStamp: ContentStamp;
  inventory: readonly EdibleItemRead[]; feedTargets: readonly FeedTargetRead[];
  heatSources: readonly HeatSourceRead[] }
export interface EdiblePrepareSDK { readonly owner: ModuleId; readonly actorId: EntityId;
  readEdibleContext(): WorldResult<EdibleContext>;
  planFeed(request: FeedRequest): WorldResult<EdiblePlanHandle>;
  planRoast(request: RoastRequest): WorldResult<EdiblePlanHandle> }
export interface EdibleCommand { prepare(payload: JsonValue, sdk: EdiblePrepareSDK): WorldResult<EdiblePlanHandle> }
```

- 流程同 5A2 §2 5A2d：prepare（纯，0 tick/0 RNG/0 ID）→ 有风险则 `recordDecision:false` 收集确认 → 重新 prepare 并 canonical 比较（不等 `C5_STALE`，0 成本）→ `requestConfirm` 记录一次 → 引擎提交。No 仍记录为一条命令，世界与两流不变。句柄只活一次命令；prepare 外调用 → `C5_SCOPE`。
- `planFeed` 检查与错误码：payload/请求键 `C5_BAD_PAYLOAD`；目标不存在、不可见或不带本 owner `role:'satiety'` 需求行 → `C5_UNKNOWN_TARGET`（不泄露隐藏实体）；不同层 `C5_WRONG_LEVEL`；Chebyshev ≠1 或无交互线 `C5_DISTANCE`；目标 `isIncapacitated` 或离开中 → `C5_GATE`；物品不在玩家背包或既非可食定义也非原生 FOOD → `C5_INPUT`；`targetRevision`/`inventoryStamp` 不符 `C5_STALE`；玩家 `isIncapacitated`/输入锁 `C5_BUSY`。提交：扣 1 → 目标需求值 +satiety（原生 FOOD 按 consumables 的 nutrition：口粮 1800、芒果 1550；封顶 max；>0 清零点计时与截止）→ 意图作用于目标（`status-and-satiety` 的饱腹扣减作用于需求值）→ `onConsumed{operation:'feed'}` → 耗时。喂食永远被接受。
- `planRoast` 检查：热源不在 `heatSources`（不存在/未见/超距/无交互线）→ `C5_DISTANCE`（未见统一 `C5_UNKNOWN_TARGET`）；物品不可食 `C5_INPUT`；CAS 同上。提交：对整堆执行一次接触（cause `roast-command`，E14 爆炸在热源格）→ 耗时。
- 参与者：

```ts
export interface EffectOutcome { intent: EffectIntent['kind']; applied: boolean; newlyStarted: boolean;
  immune: boolean; notApplicable: boolean; hpGained: number; satietyGained: number; satietyLost: number }
export interface EdibleConsumedFact { owner: ModuleId; factId: number; operation: 'eat' | 'feed';
  eaterId: EntityId; feederId: EntityId | null; definitionId: DefinitionId | null;
  nativeFood: 'ration_of_food' | 'mango' | null; resolvedIntent: EffectIntent;
  outcome: EffectOutcome; hpBefore: number; maxHp: number; visibleToPlayer: boolean; tick: Tick }
export interface EdibleTransaction { readonly state: JsonValue; replaceState(next: JsonValue): void;
  markKnowledge(definitionId: DefinitionId, state: 'tasted' | 'known'): boolean;
  message(key: string, params?: Readonly<Record<string, string | number>>): void }
export interface EdibleParticipant {
  onConsumed?(fact: DeepReadonly<EdibleConsumedFact>, tx: EdibleTransaction): void;
  onFireContact?(fact: DeepReadonly<FireContactFact>, tx: EdibleTransaction): void }
```

  - `applied` = 状态时长实际增加或回复 >0；`newlyStarted` = 施加前该状态为 0；`immune` 按原生免疫；`notApplicable` 见 E10。只调用该定义 owner 的参与者；原生 FOOD 喂食调用发起命令的模块。参与者同步、纯 JSON、不得启动事务/取 RNG；失败按 E29。factId 用既有 runtime 事实分配器。
- 投影：`ExtensionProjectionContext.edible?: { readEdibleContext(); knowledge(groupId): KindKnowledgeView }`，仅对声明了 E3 键的 owner 提供；只读、0 RNG。

### 2.2 H2 火接触（`FireContact.ts`，类型在 `worldEdible.ts`）

```ts
export type FireContactCause = 'spawn-fire' | 'thrown' | 'floor-burning' | 'carrier-ignited'
  | 'roast-command' | 'heat-source-throw' | 'lava';
export interface FireContactFact { owner: ModuleId; factId: number; itemId: EntityId;
  definitionId: DefinitionId; quantity: number; cause: FireContactCause;
  location: 'floor' | 'inventory'; at: Position;
  result: 'transformed' | 'burned-up' | 'exploded' | 'destroyed';
  toDefinitionId: DefinitionId | null; explosion: 'explosion-fire' | 'bloat-explosion' | null;
  visibleToPlayer: boolean; tick: Tick }
```

| 入口 | 位置 | 冷却 | 抽取 |
| --- | --- | --- | --- |
| `spawn-fire` | `burnFloorItemsAt`（`fillSpawnMap.burnItems`）对可食物品只入队，SCROLL 原样 | 是 | 0 |
| `floor-burning` | `burnFloorItems` 每客观块：可食物品在 `T_IS_FIRE` 格且不在冷却 | 是 | 0 |
| `lava` | `burnFloorItems`：熔岩格可食物品——`explode` 入队，其余沿原生 `burnFloorItem` | — | 0 |
| `thrown` / `heat-source-throw` | 投掷落地（E18） | 是 | 0 |
| `carrier-ignited` | 玩家 0→正着火（E13） | 否 | 每堆 1 次实质流 |
| `roast-command` | 烤制命令 | 否 | 0 |

- 结果：`transform`（E19，地面写冷却）、`burn-up`、`explode`（E14、E15）。消息：可见格（或背包）用定义 `messageKey`，参数 `{item}`=接触前名称、`{result}`=变形后名称，名称在参与者回调**之后**解析（参与者可能先揭示）。
- 箱/escrow/托管/残骸/生物携带中的可食物品不受火接触；深水、坠落、漂流、偷取沿 MATERIAL 原生规则。关卡回访的原生 catch-up 中照常发生（不可见）。
- 与卷轴共存：同一循环内卷轴分支与次序不变。

### 2.3 H3 非魔法种类知识（`src/ext/kindKnowledge.ts`）

```ts
export interface KindKnowledgeGroup {
  owner: ModuleId; id: string;                         // owner. 前缀；每 owner ≤8
  kinds: readonly Readonly<{ id: string; raw: DefinitionId; roasted: DefinitionId | null;
    node: DefinitionId | null; knownNameKey: string; knownDescriptionKey: string }>[]; // 1..32
  appearancePool: readonly Readonly<{ id: string; nameKey: string; descriptionKey: string }>[]; // kinds..64
  assignmentDomainId: string;
  templates: Readonly<{ roasted: string; node: string; tastedNote: string;
    roastUnknownNote: string; called: string; unknownDetail: string }>;
}
export type KindKnowledgeState = 'unknown' | 'tasted' | 'known';
export interface KindKnowledgeView { groupId: string;
  rows: readonly Readonly<{ definitionId: DefinitionId; state: KindKnowledgeState; title: string | null }>[] }
```

- 成员定义唯一属于一个组；`raw/roasted` 必须是同 owner 可食定义，`node` 是同 owner 资源定义。模板键文本须含且仅含规定占位符：`roasted`/`node` 各一个 `{{name}}`，`called` 含 `{{name}}` 与 `{{title}}`，其余无占位符（加载 locale 时校验，缺键即兼容诊断失败，不回退显示内部 ID）。
- 外观分配：H4 Fisher–Yates：`for i = n−1 … 1: j = range(assignmentDomainId, ordinal = n−1−i, i+1); swap(pool[i], pool[j])`，种类 k（数组序）得 `pool[k]`。会话派生缓存，不存档。
- 持久：`extensions.foundation.kindKnowledge = { schema: 1, rows: {groupId, definitionId, state, title}[] }`，按 (groupId, definitionId) 码点序；行仅当 `state≠unknown` 或 `title≠null` 时存在；**无行省略键**。load 校验：组/定义存在且属已启用 owner、状态枚举、title 长度。
- 名称解析（唯一实现，背包/详情/悬停/消息/容器/营地库存/确认文本共用；0 RNG；不进摘要的显示缓存）：
  - 生定义 R：基名 = R 为 known 则已知名，否则外观名；R 为 tasted 加 `tastedNote`；非 known 且有 title 用 `called`。
  - 烤定义 S：内名 = S 或 R 为 known 则已知名，否则外观名；整体 `roasted{{name}}`；S 为 tasted 加 `tastedNote`，否则若 R known 而 S 非 known 加 `roastUnknownNote`；title 规则同上（S 自己的 title）。
  - 节点：`node{{name}}`，内名 = R known 则已知名否则外观名。
  - 详情：非 known → 外观描述 + `unknownDetail`（不显示 satiety）；known → 已知描述 + satiety。
  - 不属任何组的可食定义（如焦炭）用自身 `nameKey/descriptionKey`，始终已知。

### 2.4 H4 整局派生抽样（`DerivedDraw.ts`，算法 ID 进 manifest/指纹）

- `derivedSeedKey(runSeed, owner, rulesFingerprintHex)` = SHA-256 小写十六进制 of canonical `["c5-derive-seed-v1", runSeed, owner, rulesFingerprintHex]`；`rulesFingerprintHex` 为 owner 规则指纹去掉 `sha256:` 前缀的 64 位十六进制；runSeed 为引擎规范十进制字符串。
- `derivedDraw(seedKey, domainId, ordinal, attempt)` = SHA-256 of canonical `["c5-derive-v1", seedKey, domainId, ordinal, attempt]` 的首 4 字节大端 uint32。
- `range(domainId, ordinal, n)`（n = 1…2^32）：`limit = 2^32 − (2^32 mod n)`；attempt 从 0 递增，取首个 `< limit` 的值 `mod n`。canonical JSON 同合同 §3.4（M7）。不读、不推进两条原生流。
- 冻结向量（Node 24 `JSON.stringify`+`crypto` 与 Python `json.dumps(ensure_ascii=False, separators=(',',':'))`+`hashlib` 两种实现独立复算；同法复算合同 `offlineDraw(64个0,0,raid,0)=156442572` 一致）：

| 输入 | 输出 |
| --- | --- |
| `derivedSeedKey("51005000","fgfixture",64个0)` | `8c10e2b890bbc28b47cff53059cea1f694cb20231560996d4393977f148eed80` |
| `derivedSeedKey("1","foraging",64个f)` | `a004cac75de63d19bc5b26395d7f0375594be437264efc7dc4652cbabcdacb61` |
| `derivedDraw(上行1, "fgfixture.kinds.appearance", 0, 0)` | **1692360874** |
| `derivedDraw(上行1, "fgfixture.kinds.appearance", 1, 0)` | **1906428524** |
| `derivedDraw(上行2, "foraging.roast-policy", 9007199254740991, 0)` | **479313020** |
| `range` 拒绝重抽：seedKey 同行1、domain `fgfixture.reject`、ordinal 0、n = 2^31+1 | attempt 0 = 4090733778 ≥ limit 2147483649 被拒；attempt 1 = 1916848773 → **1916848773** |
| 洗牌：seedKey 同行1、domain `fgfixture.kinds.appearance`、池 `[a0…a5]` | `a0,a2,a1,a3,a5,a4` |

- 另冻结拒绝：空/非十六进制/超长 seedKey、非 validId domainId、负数/非安全整数 ordinal/attempt、n=0。

### 2.5 H5 资源分组放置（`PlacementGroups.ts`）

```ts
export type TerrainPreferenceTag = 'terrain.luminescent-fungus' | 'terrain.fungus-forest';
export interface PlacementGroup {
  owner: ModuleId; id: string;                                  // owner. 前缀；每 owner ≤8
  members: readonly Readonly<{ resourceDefinitionId: DefinitionId; minDepth: number; weight: number }>[]; // 1..64；1..40 / 1..100
  perDepth: readonly Readonly<{ fromDepth: number; toDepth: number; min: number; max: number }>[]; // 不重叠，0≤min≤max≤32；未覆盖层数量 0
  maxPerRun: number;                                            // 0..512
  preference: Readonly<{ tags: readonly TerrainPreferenceTag[]; radius: number;   // 0..8
    preferredWeight: number; otherWeight: number }> | null;      // 1..16
}
```

算法（深度 d、`levelKey` = `dungeon.<d>`；domain 串 `<groupId>.count.<levelKey>` 等均须 validId）：

1. `count = min + range("<groupId>.count.<levelKey>", 0, max−min+1)`；
2. 候选 = 5A2 `c5-place-v1` 的同一候选函数（D8 资格，复用实现不复制）在此刻的结果，按 (y,x)；
3. 对 k = 0…count−1：若本组整局已放置数 = `maxPerRun`、或该层节点 32/整局 512/世界 interactable 子预算已满 → 剩余记 skip；合格成员 = `minDepth ≤ d`，按权重 `range("<groupId>.kind.<levelKey>", k, Σweight)` 选定义；格权重 = 半径 `radius` 内（Chebyshev）任一格的基础层类型命中任一标签 ? `preferredWeight` : `otherWeight`（`preference=null` 时全为 1），`range("<groupId>.cell.<levelKey>", k, Σ格权重)` 按 (y,x) 累加选格；用 5A2 的可信节点创建（interactable + `ResourceNodeRecord`，instanceKey `<groupId>#<levelKey>#<k>`）放置并移出候选；候选空 → 剩余记 skip。
4. 每组每层一条 `WorldReceipt{kind:'placement', identity:'<groupId>@<levelKey>', result:'completed'|'skipped', reason:null|'no-space'|'budget'|'run-limit'}`。不读、不推进两条原生流；不改房间/楼梯/giants reservation；`defer` 不支持。

### 2.6 H6 生物需求时钟（`src/ext/actorNeeds.ts` / `ActorNeeds.ts`）

```ts
export interface ActorNeedDeclaration {
  owner: ModuleId; id: string; role: 'satiety';               // owner. 前缀；每 owner ≤4
  max: number; initial: number; ticksPerPoint: number;        // 1..1000000；0≤initial≤max
  bands: readonly Readonly<{ id: string; atOrBelow: number }>[]; // 1..8，严格递减，bands[0].atOrBelow = max
  zeroDeadlineTicks: number | null;                           // 1..10000000
  departure: Readonly<{ visibleGraceTicks: number }> | null;  // 0..100000，100 的倍数
}
export interface ActorNeedFacts { actorId: EntityId; monsterId: string | null; allied: boolean;
  inanimate: boolean; timedSummon: boolean; groupRole: 'single' | 'core' | 'member' }
export type NeedTrigger = 'ally-gained' | 'ally-lost' | 'group-changed' | 'resident-changed' | 'trusted';
export interface NeedEventFact { owner: ModuleId; factId: number; actorId: EntityId; needId: string;
  kind: 'attached' | 'detached' | 'band' | 'deadline'; band: string; previousBand: string | null;
  value: number; crossedAtTick: Tick; tick: Tick; deferred: boolean; visibleToPlayer: boolean;
  reason: 'ineligible' | 'death' | 'departed' | null }
export interface NeedTransaction { readonly state: JsonValue; replaceState(next: JsonValue): void;
  setOwnComponent(actorId: EntityId, name: string, value: JsonValue): void;
  removeOwnComponent(actorId: EntityId, name: string): void;
  depart(actorId: EntityId): void;            // 按声明 departure 走 H7
  message(key: string, params?: Readonly<Record<string, string | number>>): void }
export interface ActorNeedParticipant {
  qualifies(needId: string, facts: DeepReadonly<ActorNeedFacts>,
    ctx: Readonly<{ queryOptional(capability: string, input: JsonValue): import('./types').OptionalQueryResult }>): boolean;
  onNeedEvent?(fact: DeepReadonly<NeedEventFact>, tx: NeedTransaction): void }
```

- 持久：`extensions.foundation.actorNeeds = { schema: 1, rows: {actorId, needId, value, remainderTicks, lastSettledTick, zeroSinceTick|null, deadlineFired, band, revision}[] }`，按 (actorId, needId)；无行省略键。玩家永不挂载。
- 物化（纯整数）：`elapsed = now − lastSettledTick + remainderTicks`，`points = floor(elapsed / ticksPerPoint)`，`value' = max(0, value − points)`；值 >0 时 `remainderTicks = elapsed mod ticksPerPoint`，值 = 0 时 remainder 置 0；首次到 0 的 `zeroSinceTick = lastSettledTick − remainderTicks + value×ticksPerPoint`。只在写入点物化（挂载、喂食/吃、事件、入层、离开）；读取（投影/statSources 读组件/`readEdibleContext`）用纯计算不写。物化不递增 `revision`；挂载、喂食、事件写、离开开始递增。
- 事件：客观块中（玩家饥饿段之后、`monstersApproachStairs` 之前）对**活动层**有行的生物按 actorId 升序检查：band ≠ 已存 band → `band` 事件（`crossedAtTick` 为精确跨越 tick）；`zeroDeadlineTicks` 到期且未触发 → `deadline` 事件一次。入层事务中对新到达/该层上的行先物化再按同规则发事件，`deferred:true`。用派生的"下一到期 tick"缓存使无到期时每块 O(1)。只比较整数，0 RNG。
- 资格触发：`becomeAllyWith`（ally-gained）、`relationshipChanged` 失去盟友（ally-lost）、群体归属变化（group-changed）、world5 `residents` 写入（resident-changed，5A4 由可信 fixture 操作驱动）、`trusted`（fixture）；在触发事务内按 actorId 调 `qualifies`：真且无行 → 挂载（`value=initial`，`attached` 事件）；假且有行 → 删行（`detached{reason:'ineligible'}`）。死亡同事务删行（`detached{reason:'death'}`，不调 `qualifies`）。
- statSources 不新增读口：模块在 `onNeedEvent` 中写**自己的组件**（组件写入递增 `actorStatRevision`，按 5A2-S S6 同事务物化）。

### 2.7 H7 离队退役（`ActorDeparture.ts`，可信；5D 居民离开复用）

- `beginDeparture(actorId, {owner, reason, visibleGraceTicks})`：玩家不可见或 grace=0 → 立即 `retireActor`；否则进入 E26 离开态，持久 `extensions.foundation.departures = { schema: 1, nextOrdinal, active: {actorId, owner, reason, startedTick, untilTick}[], receipts: {ordinal, actorId, owner, reason, tick, result:'retired'}[] ≤128 滚动 }`；无内容省略键；`nextOrdinal` 不因淘汰回退。
- `retireActor` 按 E27；离开中目标喂食 `C5_GATE`；离开态生物不触发需求事件。新增 `HookEvents.actorDeparted: { actor: ActorFacts; owner: string; reason: string; deferred: boolean }`。

### 2.8 H8 沉眠（E28）

- `StatusId` 加 `'slumber'`；`statusConfig` 条目与 foundation locale 标签 `ext.foundation.status.slumber`、醒来消息 `ext.foundation.status.slumber_wake_player` / `…_wake_monster`。玩家沉眠期间沿麻痹的自动推进循环（输入锁 + 原生续推），受伤醒来即停止续推。
- **先交读者清单**：`'paralyzed'` 全部非测试读者逐条分类为"无法行动/无助"（改 `isIncapacitated`）或"麻痹专属"（保留），写入报告附录，是 5A4a 验收物。

## 3 子步骤与停点

每个子步骤完成可停下写阶段报告；中途子步骤只供审阅，不可单独合并；版本只在本批次分配一次（E1）。

### 5A4a 可食物品、效果意图、沉眠（H1 除喂食、H8）

- E3/E4/E6/E7 包键与字段骨架、构造校验与指纹（缺省键不归一）；`edibleSdk.ts` 与 boundary 守卫。
- 吃/扔/绰号分支、E9 确认、意图执行（`derived-choice` 在 5A4c 接入前由构造期以 `C5_BAD_DEFINITION` 拒绝，5A4a 的 fixture 不使用它）、E11 定时授予、`onConsumed` 参与者与 E29。
- `planRoast` 的命令骨架可留到 5A4b；`planFeed` 留到 5A4d。
- 显示名本步暂用定义 `nameKey`（5A4c 接入登记表）。
- H8 读者清单与迁移、slumber 施加/唤醒/存读。
- **停点验收**：吃/扔资格与 0 成本拒绝；自动进食排除；鉴定/探测/升格/幻觉排除；意图逐项（含免疫与 `notApplicable`）；定时授予物化与到期；slumber 伤害唤醒（含护盾吸收、中毒/燃烧伤害）、玩家续推、怪物不行动；save/load/replay/seek。

### 5A4b 火接触、爆炸与热源（H2、Q12=B）

- E12–E19：六类入口、冷却字段与清除点、队列与 `spawnSettled`、爆炸选型、熔岩、背包着火、热源识别与 `planRoast`、投掷入火/入热源。
- **停点验收**：每入口各自恰好一次；冷却 9/10/11 块；生→烤→焦→烧尽链；1/2/3 个爆裂物的 DF 选型；连锁顺序（多件同格按 ID、跨格 FIFO）；背包着火抽取位置固定且无可食物品 0 抽；先移除后效果（无自触发）；与卷轴燃烧共存；篝火（有 combat）与 `station.hearth` 工位（`c5fixture` 或 `craftskel` 建一个带该标签的台）两种热源，未装提供方时 `heatSources` 为空。

### 5A4c 知识、派生抽样、分组放置（H3、H4、H5）

- H4 实现与 §2.4 向量；`derived-choice` 接入；H3 登记表、名称解析全路径接入、绰号、隔离（E22）；H5 算法与收据、E23/E24。
- **停点验收**：名称解析表每格（生/烤/节点 × unknown/tasted/known × 有/无 title × 生已知烤未知）；模板占位符校验；登记表单调与越组拒绝；原生鉴定菜单不含、探测魔法无标记、升格不触发、幻觉不变名；同种子"有/无 fgfixture"地形、怪物、原生物品、两流计数逐项相同（实体 ID 数值可不同）；数量区间、深度合格集合、权重、偏好（命中/不命中/半径边界）、skip 三种原因、32/512 预算。

### 5A4d 需求时钟、离队与喂食（H6、H7、H1 喂食）

- §2.6 物化/事件/触发、§2.7 离开态与退役、`planFeed` 与反应事实。
- **停点验收**：懒物化分段一致（同总时长分 1/2/17 段读写值相同）；精确跨越 tick；截止只触发一次；离层后返回入层物化与 `deferred`；actorId 顺序；资格四种触发与死亡删行；离开态行为（不攻击/不跟随/寻楼梯）与三种退役条件；退役不发死亡事实/XP/DF、携带物守恒、群体整体退役；喂食每种拒绝码 0 成本、超量确认 Yes/No、原生口粮/芒果、意图作用于目标需求值。

## 4 零影响、确定性与持久

1. **经典局**：无 runtime → 无可食物品、无队列入队、无着火抽取、无需求检查、`isIncapacitated` 只多一次布尔读；两条 RNG 流、生成、UR2/UR3/UR4、逐事件录像成本不变；存档字节除 whole-run 版本串外逐字相同（新 Item 字段与 foundation 键全部省略）。
2. **无采食能力的扩展局**（四模块、骨架、crafting、`c5fixture`）：同上；包指纹不变；不建任何新根、不注册派生抽样域。测试用同种子"5A4 前基线 / 5A4 后"对照 UR2/UR3/UR4、`test:drift`、骨架 harness 闭环摘要（除版本外壳）与录像体积。
3. **确定性**：外观分配、烤制政策、节点数量/种类/格全部 H4；背包着火是唯一新增实质流抽取，且只在有可食物品时；显示/名称解析/投影 0 RNG、0 写。
4. **存读校验**（退休旧局前）：可食定义属已启用 owner；`fireContactCooldownUntilTurn` 只在地面可食物品上且为安全整数；知识行合法；需求行只在存活非玩家生物上、`lastSettledTick ≤ simulationTicks`、`remainderTicks < ticksPerPoint`、band 与值一致；定时授予与离开行引用存活生物且 `untilTick` 合法；队列为空。不修补坏档。
5. **登记**：`ITEM_FIELDS`/u_01 实体字段审计/U03（新 Item 字段=run；队列、DF 深度、`draining`=session；外观分配、意图解析、名称、下一到期缓存=derived）；`recording-digest-contract`（foundation 新键属 extensions 域，Item 字段属 native 域）。

## 5 非目标（出现即越界）

- `src/ext/modules/foraging/**`、任何蘑菇种类/数值/文案/命名池、同伴饥饿数值、`feed`/`roast` 的玩家 UI（归 5G）。
- 营地日粮/厨师/粮仓（5C1/5D）；settlement 居民登记的生产路径（只做触发点与 fixture）。
- 改 `worldSdk.ts`、5A2-S 公式/键表、生成算法、原生食物/卷轴/药水规则；修改 combat/crafting 代码或版本；新增 npm 依赖。

## 6 必测场景（登记 `scripts/test-suites.json` 底座清单：`ext_edible_*`、`ext_fire_contact_*`、`ext_kind_knowledge_*`、`ext_derived_draw_*`、`ext_placement_group_*`、`ext_actor_needs_*`、`ext_departure_*`、`ext_slumber_*`）

- `fgfixture` 内容（测试数据，名称用中性"样本甲/乙…"）：生/烤/焦三段链 1 组（烤用 `derived-choice` 两选项）、`heal-fraction`、`status`（poisoned、slumber、haste、telepathy）、`status-and-satiety`、`temp-stat`、`explosive`（`largeAtQuantity:3`）各一；全部可食定义带标签 `food.ingredient.mushroom`（供 5D2 厨师软接口测试）；知识组 4 种 + 外观池 6；两个节点定义 + 一个带偏好的分组；一个 `satiety` 需求（小 `ticksPerPoint` 便于测试）；`feed`/`roast` 测试命令与参与者（写自身 state 历史、按 outcome 标记知识、band 事件写组件、deadline 调 `depart`）。
- 上述各子步停点验收全部条目。
- 构造期：缺 `worldSdk`、坏包（每条校验各一）、`transform` 成环、模板占位符错误、动作名与 `commands` 冲突 → 运行时构造失败且兼容诊断 i18n。
- 事务：每个命令与时间推进入口在 ID 分配/扣物/变形/参与者/事实/消息/DF 各发布点注入失败，按 E29 恢复（独立写集差分，不只比 JSON）。
- 持久：吃、扔、烤、爆炸、连锁、背包着火、喂食、知识写入、需求跨越、截止、离开中、退役、slumber 中、定时授予中的 save/load/逐条 replay/seek/续录一致；投影反复读取不改任何状态与随机域。
- 共存：`fgfixture` 单独、`fgfixture`+combat（篝火）、`fgfixture`+骨架（火炉标签台）、`fgfixture`+combat+giants（群体核心挂载与整体退役）、`fgfixture`+四模块全开。
- 回归：`worldSdk.ts` SHA-256 不变；骨架/crafting 包指纹不变；5A3 工作位/交互线逐格回归 fixture 不变；同种子有/无 `fgfixture` 原生生成逐项相同。

## 7 预计改动的共享文件

`src/engine/Core/Game.ts`（吃/扔/绰号/燃烧/着火/`ext:command` 分支/入层/离开/死亡清理）、`TimeCoordinator.ts`（客观块需求与定时授予检查、`isIncapacitated`）、`GenerationCoordinator.ts`（仅首访分组放置调用点）、`WholeRunSnapshot.ts`（v6、校验）、`EntitySnapshot.ts`、`PhasedAttackProduction.ts`、`ActorActionProduction.ts`、`ActorActionAuthority.ts`、`WorldRestProduction.ts`（读者迁移）、新 `Edible*.ts`/`FireContact.ts`/`KindKnowledge.ts`/`DerivedDraw.ts`/`PlacementGroups.ts`/`ActorNeeds.ts`/`ActorDeparture.ts`；`src/engine/Map/DungeonFeature.ts`（`spawnSettled` 可选回调）；`src/entities/Creature.ts`、`Monster.ts`、`Player.ts`；`src/engine/Combat/Combat.ts`、`ActorCombatResolution.ts`、`CombatText.ts`、`MonsterAI.ts`；`src/engine/Movement/CompositeMovement.ts`、`LevelTravel.ts`；`src/engine/Status/statusConfig.ts`；`src/engine/Items/Item.ts`、`Inventory.ts`、`ItemUseCoordinator.ts`；`src/engine/Stats/*`（定时授予来源）；`src/engine/UI/DetailGenerator.ts` 及背包/详情/悬停 Vue 组件；`src/ext/types.ts`、`runtime.ts`、`compatibility.ts`、`world.ts`、`world5.ts`（5A2 校验扩展）、新 `src/ext/edibleSdk.ts`/`worldEdible.ts`/`kindKnowledge.ts`/`actorNeeds.ts`、`src/ext/testing/**`；`src/ext/modules/growth/view.ts`（仅 paralyzed 读者分类需要时）；foundation locale；`scripts/u03-state-contract.json`、`recording-digest-contract.json`、`test-suites.json`、`check-module-boundaries.mjs`。

- 冲突等级最高：`Game.ts`、`runtime.ts`、`TimeCoordinator.ts`——本步期间只由本步主笔修改。生成目录只读；黄金/trace 预期仅版本外壳变化，任何其他变化先单变量归因。

## 8 门禁（开发期相关功能，P5-D14=A）

环境同 5A2（Node 24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、vitest `--maxWorkers=2`）。每个子步停下前跑相关部分，最终全部跑：

1. `node scripts/check-module-boundaries.mjs`
2. `npx vue-tsc -b`
3. `npm run build`
4. 本步新增测试 + 直接受影响：H8 读者清单涉及的原生测试（麻痹/输入锁/战斗命中与伤害/自动推进，逐文件列出）；火/燃烧/熔岩/爆炸/卷轴燃烧/投掷/吃/自动进食/鉴定/探测魔法/绰号相关原生测试（grep `burnFloorItem`、`exposeCreatureToFire`、`DF_EXPLOSION_FIRE`、`consumeFood`、`detectMagic`、`callItem` 定位并列出）；combat 篝火与身体动作测试、giants 群体/自然 trace；`u_01*`、`u_03*`、`u_27_recording`、`u_r2/u_r3/u_r4_trace`、`x2a`、`x3b_*`、`ext_recording_v4_*`、`ext_world5_*`、`ext_world_items_*`、`ext_world_work_*`、`ext_world_harness_*`、`ext_stats_*`、`ext_structure_*`（工作位回归）、`ext_foundation*`、`ext_module_composition`、`ext_compatibility_diagnostics`。
5. `npm run test:drift`（`DungeonFeature.ts` 与生成共享，须证明生成不变）。
6. 真实组合 smoke（engine-only）：空、四模块各单独与全开、骨架单独、`fgfixture` 单独、§6 共存各组；每组新局/游玩/save/load/逐条 replay/seek/续录。
7. 性能：经典 control、无采食扩展局、`fgfixture` 局的录像每命令新增成本 P95 与 5A3 对照；满背包 26 堆可食物品着火、单格 20 件连锁爆炸、64 个需求行的客观块耗时。

不跑完整 `npm test`、全部 `test:ext`、removal 矩阵（留 5Z）。失败处理同 5A2 §7：先单变量归因；真实缺陷修生产代码补回归；不加 skip、不放宽有效断言、不延长超时。

## 9 交付

- 代码与测试（**不 commit / 不 push**），以及 `docs/ext/phase5a4.report.md`：
  - 基线 commit、§0 核对与实际行号、最终版本表（E1 每项实际值）、U03/实体字段/摘要域登记清单。
  - H8 `paralyzed` 读者分类表（文件:行、语义、分类、处理、覆盖测试）。
  - 逐子项 done/not-done（5A4a–d）；自定细节列表（文件名、事务实现、`spawnSettled` 接线）。
  - §2.4 向量的生产 API 复算结果。
  - 每条门禁实际命令、退出码、文件/用例数、耗时；drift 结果；失败与修复；反事实证据；重录逐字段归因（预期仅外壳）。
  - 性能实测。
  - **5G 冻结清单**（§10 每项实际值/路径/SHA-256）与"交接 5D"（`ActorDeparture` 用法、`resident-changed` 触发点、`food.ingredient.mushroom` 标签计数用 `ItemRead`）。
  - 未覆盖项（真实浏览器 UI、最大状态长局、5Z 门禁）标"未验证"。
- 原始证据放仓库外（`/private/tmp/...`）；README 仅可在报告完成后追加一行 5A4 状态。

## 10 5G dot 任务包前置：5A4 合入后必须冻结的内容

5G1/5G2 计划以 dot 整包实现（设计稿 Q6=A），只写 `src/ext/modules/foraging/**`。5A4 合入后、编写 5G 任务包前，维护者须确认下列各项都有实际值，缺一项不得派发：

1. 5A4 合入 commit；`worldSdk.ts`（不变）、`edibleSdk.ts`、`worldEdible.ts`、`kindKnowledge.ts`、`actorNeeds.ts`、`stats.ts`、`forageHarness.ts`、`fgfixture` 目录的路径与 **SHA-256**；foundation 号（预期 10）、whole-run v6、`EDIBLE_SDK_VERSION=1`、`worldSdk: 1` 与 `FOUNDATION_PROTOCOL` 用法。
2. 包键 schema（§2.1、§2.3、§2.5、§2.6）与全部上限；`ResourceDefinition.yield` 可引用可食定义、分组成员 `placement` 双 null（E7、E24）。
3. 效果意图词汇、`EdibleStatusId` 子集、E10 原生路径映射与 `notApplicable` 规则、`temp-stat` 可用键与各类别预算（尤其 `more` 槽下限）。
4. 火接触：六类入口、冷却 10 块与清除点、背包着火 1/3 的抽取位置与次序、爆炸选型阈值、熔岩、先移除后效果、队列次序、热源识别规则与距离（E12–E19）。
5. 知识：状态机、`markKnowledge` 语义、模板键与占位符、名称解析表、外观洗牌算法、E22 隔离清单。
6. H4 算法 ID 与 §2.4 向量；分组放置算法、地形标签词汇、收据形状。
7. 需求时钟：物化公式、band/deadline 事件时机与 `deferred`、触发点、`qualifies` 上下文、组件写入→属性重算路径；离开态行为与退役语义（E25–E27）；`actorDeparted` 钩子。
8. `feed`/`roast` payload v1、CAS 字段（`targetRevision` = 需求行 revision）、确认/No 记录流程、每个拒绝码；参与者接口与 E29 失败语义。
9. 投影 `edible?` 读口、foundation 负责的地图/背包/详情命名、foundation locale 键清单（错误、确认、slumber）。
10. harness API、`fgfixture` 可作参照实现的范围、foraging 测试的自动发现入口（同 5B，不改共享清单）。
11. 5G 需带走的设计更正（见下"设计缺口"第 2、4、6 条）。

## 附：本任务书自行决定、需维护者签认的事项与发现的设计缺口

自行决定（§1）：E2 单一模块入口 `edibleSdk.ts`；E8 喂/烤耗时用 `movementSpeed`；E9 未知物确认阈值取组内最大饱腹；E10 poisoned 沿原生累加、三种状态对怪物 `notApplicable`；E12 地面入口一律受冷却（含火蔓延）且以客观块计；E14 烤制命令爆炸在热源格；E16 队列与 `spawnSettled` 回调；E17 热源由 foundation 识别（不要求 combat/crafting 声明）；E21 知识联动交给模块；E22 幻觉不变名；E25 死亡删行、复活按 `initial` 重挂；E26 离开态保留 `isAlly` 标记；E29 时间推进中参与者失败的降级。

设计缺口（建议随签认一并裁定）：

1. **"洞穴型区域"偏好无法实现**：生成后无持久房间类型标记；首版只支持发光菌/菌林地形（E23）。若要洞穴偏好，需要在生成期捕获元数据，触及生成代码与 drift。
2. **5A2-S `more` 槽下限 0**：设计稿 §7.2 同伴虚弱/饥荒的伤害 `more −2500/−5000 bp` 不合法；5G 应改用 `increased` 负值（−9000…+50000 bp 合法）或请求放宽键表（升 foundation 号）。
3. **热源"提供方声明 `heatSource` 标签"不可行**：crafting 由 dot 冻结、combat 不宜为此升版本；改为 foundation 识别篝火与 `station.hearth` 工位（E17）。
4. **"解除盟友身份但不敌对"**：Brogue 无中立阵营，非盟友即敌对；E26 以保留盟友标记 + 不跟随/不攻击/寻楼梯实现，语义上等价但内部标记不同。
5. **背包着火判定的位置与时序**：设计稿未规定相对 `setBurningDuration` 的先后；E13 定为之后，避免爆炸重入时再次判定。
6. **生/烤知识联动未定**：揭示烤定义（保留政策）时逻辑上已知种类；建议 5G 同时把生定义标 `known`（E21 允许一次事务写多行）。
7. **吃/喂确认会泄露饱腹数值**：设计 §5.5 要求隐藏未知物饱腹，但原生"不太饿"确认阈值会暴露；E9 已规避，需认可。
8. **`targetRevision` 未定义**：生物无版本号；E1/§2.1 定为需求行 revision。
9. **设计稿与 README 状态不同步**：`phase5-foraging.md` 抬头仍写"设计稿待审"、README 写"Q1–Q12 待审"，而 §16 已记 2026-10-06 裁定；建议签认本任务书时一并更新抬头。
