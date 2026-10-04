# 阶段 4：通用多格与复合体敌人设计稿

> **r3：已记录维护者 2026-10-05 决定（D01–D16，见 §12；门禁改为开发期功能测试、收尾全量，见 §14.1）。r2：按维护者 2026-10-05 要求修订。设计已获维护者批准（决定见 §12），实施按步另行授权；4a0 待与阶段 3 共享文件清单对照后授权。** 分支 `ext/phase4`，初稿源码审计基线 `6f837dbf094b42571cd4072ea6ff578a923d7b84`；r2 修订起点 `124256793397ffe58d6af80fe88d1536574fe394`，两者之间仅有文档提交，源码与初稿审计相同。本文执行[修订任务书](phase4-design-r2.task.md)，保留[初稿任务书](phase4-design.task.md)中仍有效的合同。所有“拟新增”接口、数值和验收均为计划，不代表已经实现或通过。阶段 3 由另一设计任务推进，本工作树没有其设计稿，软接口仍需维护者对照确认。
>
> 本轮仅修订本文，不改其他文档、代码、测试、数据或脚本，不 commit。沿用初稿任务书“纯文档，不运行长门禁”的交付约束，本轮仅做只读源码审计和文档检查；未来实施各步仍按 [README 当前政策](README.md#当前验收门禁)执行，不能用本轮文档检查代替实施门禁。

## 1 范围与设计主张

底座一次迁移为两个正交原语：**刚体足迹**以整数相对格掩码描述一个实体的身体，可附朝向与命中区；**复合体**由核心和若干成员实体组成，共享行动决策，但成员有独立位置、轨迹、攻击、HP 和局部状态。方形 N×N 只是刚体的预编译特例；刚体上的固定弱点用命中区，独立移动的腿、触手、头或身体段用成员。二者可以组合，例如 2×2 核心加八条 1×1 腿。

推荐采纳修订任务书的拆分，补上三项底座合同：显式实体／部位／群体三种命中键；核心唯一调度、成员子动作；覆盖身体拓扑变化的受控原子事务。理由见 §2.3。第一次迁移就携带这些身份和 schema，之后按能力逐步开放；不再先把数十处入口改成 `size`，以后再改成群体。玩家仍是独立 1×1 生物，不加入复合体。

底座提供空间、群体生命周期与部位规则，正式模块建议使用稳定 ID **`giants`**，只依赖底座。模块目录删除后，底座仍能用自有多格／复合体 fixture 验证已交付能力；正式敌人、场地数据、血条及专属行为随模块删除。未使用这些能力时，当前模拟、机械状态和双 RNG 调用保持一致；这是一项新的能力合同，不把扩展原型重新冻结为 CE 规则。

**P4-D07 已决定 A**：Boss 不因身份获得额外免疫，可被变形、复制等；主动换形／换体型、单体与复合体互转、分裂、复制和召唤自身副本也走同一转换底座。是否编写某项招式、具体传伤比例等仍是产品选择，不能以 Boss 身份免疫省略底座路径。其他待决项集中在 §12；正文按推荐项展开，批准前不视为已授权内容。

实施顺序改为：通用底座迁移 → 方形大型敌人可玩纵切 → 任意形状与朝向 → 命中区与部位破坏 → 复合体 → 主动形态变化／分裂／复制 → 收尾。每步有完整闭环，可验收后停下；schema 中尚未开放的能力在创建、读档与命令预检明确拒绝，不作为“占位字段已存在所以功能已实现”。

机制启发只来自[Lost Flame 笔记 §3 与 §5](references/lost-flame-notes.md#3-大型敌人阶段-4-参考)中的占格、场地和血条观察。下列空间模型、接口及场地参数自行设计，不读取或复制其商业代码、数据、文本和素材。本设计不生成美术资产。

## 2 现状审计与改造边界

### 2.1 审计口径与数量级

审计 `src/engine`、`src/entities`、`src/ext`、`src/components`、`src/ui` 下生产 `.ts/.vue`：排除 `tests/`、`fixtures/` 和 `*.test.ts`，共 **253 个文件**。按正则匹配行计数，包含声明、注释及少量物品/普通坐标候选，不是 AST 调用计数，各项互有重叠，不能相加当作改动点总数。

| 检索族 | 匹配行 / 文件数 | 分布与含义 |
|---|---:|---|
| `getMonsterAt\s*\(` | 64 / 6 | Game 41、Monster 14、MonsterBlink 4，其余 5；约数十个占位查询入口 |
| `(monsters\|dormantMonsters\|creatures)\.(find\|some\|filter)\(` | 51 / 23 | 包含按 ID/资格筛选，须人工辨认其中的坐标碰撞判断；查询不全经 Game |
| `Math.max(Math.abs…` | 45 / 17 | Game 18、Monster 9、Combat 3；包括玩家→格点、物品距离，不能全部替换为生物距离 |
| `…\.loc(\.[xy])?\s*=(?!=)` | 74 / 8 | Game 45、ItemLoader 13、GenerationCoordinator 8；包含物品写入，生物位移散落在数十处 |
| `HAS_MONSTER/HAS_PLAYER` 文本 | 37 / 13 | 主要是 CE 对照注释，并非 37 个实际格标志读写 |

复核入口可用 `rg -n 'getMonsterAt\s*\(|HAS_(MONSTER|PLAYER)' src/engine src/entities` 与 `rg -n 'loc\.[xy] =|\.loc =|Math\.max\(Math\.abs' src/engine src/entities src/ext src/ui src/components`；上表统计另用相同范围按匹配行去重。估计需迁移 **数十个写入出口、约百处空间判断候选、二十余个直接消费文件**。实施前每类建立实际调用清单，逐项注明“改 footprint / 保留单格坐标 / 仅改端口”，不能以搜索无匹配代替语义验收。

### 2.2 已核对的表示与执行入口

以下路径均相对仓库根，行号对应本次基线。表内“必须”指能力启用时的路径必须覆盖；1×1 分支可继续调用原实现。

| 分类 | 实际文件 / 函数与现状 | 必须改造的部分 |
|---|---|---|
| 生物位置 | `src/entities/Creature.ts:60–75,144–158`：`loc` 是单个 Pos，x/y 是访问器；`mapToMe` 是目标所属的一张图。`Monster.ts:264` 的 `MonsterData` 没有运行时尺寸 | 保留 loc 为锚点，增加底座足迹；不能从字形、HP 或模块 ID 猜尺寸 |
| 定义元数据 | `src/ext/definitions.ts:18,78–79`：enemy 的 footprint 宽高允许 1–3，但没有多格运行器；`Monster` 构造仍是单格；`CreatureFeatures.creatureFeatureInfo` 的特征表只来自原怪物数据 | 接入经过验证的通用形状／身体与形态贡献；旧宽高 metadata 只是矩形宏，不能成为新的运行时 size 模型 |
| 活跃占位 | `Game.ts:10895 getMonsterAt` 按 loc 扫描 `monsters`，包括 hp>0 或死亡处理中尚未 deathProcessed 的对象；`Monster.ts:240 creatureAtLoc` 另查玩家 | 尾格查询、玩家/怪物统一 facade；保留死亡效果期间的生命周期语义 |
| 休眠占位 | `Grid.ts` 的 `hasDormantMonster` 与 `Game.awakenDormantMonstersAt`；`CreaturePlacement.canPlaceCreature` 排除存活休眠者，`Conjuration.bladeSpawnLocation` 则不把休眠者当活跃占位 | 区分活跃占位、休眠预留与落点策略。不能把现有不同查询统一成一个无条件 occupied 布尔值 |
| 普通移动/堵路 | `Game.performPlayerActionStages` 的 move 分支（约 3984）、`Monster.tryMoveTo:2184`、`moveEntranced`、`randFlittingDirection`；多个目的地只查一个格 | 整体 fit、对角边、与自身旧格重叠、抓持与挣扎；所有真正生物位置写入改走统一提交 |
| 同伴交换 | `Game.movePlayerPastAlly:8723` 先写玩家/盟友 loc，失败恢复；`CreaturePlacement.allySwapCandidates` 单格搜索 | 多对象原子计划；首版有任一多格参与时不自动交换，不能先移动再发现挤不下 |
| 击退/拉拽 | `Game.processStaggerHit:8470`、`applyWeaponRunicEffect` 中力场位移（约 7652）、`beckonCreature:11789`、`placeCreature:11816` | 推进完整 footprint、接触点与方向、逐步碰撞/落地；不能只检查锚点路径 |
| 闪现/传送 | `Game.finishBlink:11743` 临时把 caster 移到 -1/-1 并搬走潜水者；`teleportCreature` 与 `teleportCandidates`；`MonsterBlink` 多张单格图 | 显式忽略实体的占位预检替代临时假位置；完整落点过滤、同格命中与传送候选规则 |
| 召唤/克隆/分裂 | `Game.spawnHordeAt`、`summonMinionsFor`、`cloneMonster`、`trySplitMonster`；`Conjuration.bladeSpawnLocation`、`Cloning.cloneLocation` | 不仅大型者的出生，也要防小召唤物落到大型者尾格；批量预留、防重复 ID 和预算 |
| 变形/关系 | `Monster.polymorph:744` 先改状态/关系再改形；`Polymorph.polymorphSpecies` 仅原目录；`Domination.ts`、`Game.freeCaptive`、`resurrectAlly` | 形态／拓扑变化先求全体落点再提交；按D07支持通用关系转换，不留半组盟友；自然俘虏内容范围另由D03决定 |
| 楼层转移/坠落 | `Game.monstersFall:8984`、`restoreLevelResident`、`monsterEntersLevel`；`GenerationCoordinator.generateDepth:241`；`LevelTravel.scheduleLevelFollowers/travelPlacement/restoreTravelPosition` | 大型坠落和恢复不能用单格 qualifyingNear；当前层、缓存层、pending 队列的空间所有权一起改 |
| 地形/气体接触 | `Game.applyEnvironmentalEffects:10612` 从 entity.loc 取一个 cell；`resolveExplosionDamage`、`applyEntanglementFromTerrain`、`creatureShouldFall`、`applyNauseaFromTerrain`、`applyLichenPoison` | 改为足迹暴露摘要；同一生物只结算一次每种效果，不能对各格重复调用整套函数 |
| 门/机关/陷阱 | `Game.handleSpecialTileEntry:11515` 是玩家入口；`applyDisplacementTileEntry`、`triggerCreatureTrapLayers`、`Promotion.promoteOnStep/promoteLayersWithMechFlag`；`TimeCoordinator.objectiveTimeBlock` 有玩家踩门晋升 | 增加普通 NPC 的多格进入/驻留事件；区分每个机关的世界触发与对生物的去重效果，保留玩家专属标志 |
| DF 与环境回调 | `Game.bindDungeonFeatureEffects:10917` 的 creatures/instantEffects 用单点，invalidatePathing 只重算 loopMap、置 safety stale；`DungeonFeature.spawnDungeonFeature` 可逐格重入接触 | 整体阻路验证、受影响实体集合、同一 DF 的命中作用域；接入统一空间缓存失效，不能仅改 callback 中的 getMonsterAt |
| 物品/死亡掉落 | `Game.logPickup`、`pickUpItemAfterDisplacement`、`monsterDropItem`、`sweepDeepWaterItem`、`keyOnTileAt/useContactKeyAt`；`ItemSpawnHeatMap` 有占用端口 | 拾取仍是玩家单格；怪物携带钥匙/掉落/涉水判据需足迹语义。物品本身继续单格，不扩大物品 loc |
| 近战与几何武器 | `Game` 的突进/连枷/鞭/矛/横扫及 `performPlayerAttack`；`Monster.performWhipAttack/performSpearAttack/performSweepAttack`；`CombatSystem.resolveAttack*` 抓持等检查点距离 | 建立唯一目标列表和近战接触对；同一实体尾格不产生第二次伤害、状态、成长消费或消息 |
| 弹道/投掷 | `BoltTrajectory.traceBolt/boltLine` 按 `world.creatureAt(pos)`；`Bolt.ts:290–325` 明确保留重复访问 contacts；Game 玩家/怪物射线与投掷入口 | 整体占位碰撞 + 多格实体专用去重；现有 1×1 反射重访语义必须保持，不能无条件对所有 ID 全局去重 |
| 范围技能/成长 | `Game.negationBlastFromPlayer/discordBlastFromPlayer` 按锚点筛选；`validateControlledAction:3671` 的成长 attack 要求锚点相邻；`growth/module.ts` 调 `context.validateAction`，`skills.ts` 计划效果 | 底座统一 range/shape→实体列表与资格复核；成长现有技能是受控动作加效果，不声称已有通用 AoE 运行器 |
| AI/距离/感知 | `Monster.takeTurn:1520/findPlayerPath:2141`、`MonsterAI.updateMonsterState`、`MonsterBlink.openCreaturePath/getBlinkTargetMap`；`ScentMap.awareOfTarget` 是点查询并含概率掷骰 | 足迹距离、接触目标集合、感知摘要一次判定；各格重复 awareOfTarget 会错误放大警觉概率 |
| 多种距离图 | `Pathfind.findPath`、`DijkstraMap.batchScan`、`SafetyMap.getSafetyMapForMonster`、`WaypointSystem.nextStep`、`MapToShore.buildMapToShore` | NPC 多格寻路/逃跑/游荡不能复用 1×1 图；玩家岸距/旅行本身继续 1×1，只修大型障碍输入 |
| FOV/遮挡/潜水 | `FOVSys.computeFOV/computeFOVMask` 接受单点；`Game.updateVision/isCreatureLightBlocker`；`MonsterVisibility.canSeeMonster/monsterInGas`；`Submersion.ts` | 身体任一可见格、足迹 LOS、气体显影及全身潜水条件；玩家 FOV 算法原入口无需改成多源 |
| 渲染/目标/侧栏 | `GameCanvas.vue:645` 单个 placeEntity；`displayProjection.observeDisplayMap` 也单点；`MonsterSidebar.visibleMonsterRows/sidebarEntityRows` 以 loc 排序/聚焦；`Game.getCellDetails` 与 `arcanaTargetCandidates` | 当前帧和延迟显示帧都投影多格，检视尾格得到同一实体；隐藏身体不能透过渲染矩形泄漏 |
| 持久与确定性 | `EntitySnapshot.CREATURE_FIELDS`、`WholeRunSnapshot.toWholeRunSnapshot/isWholeRunSnapshot`、`LevelSnapshot`；`Game.loadSnapshot/exportRecording/replaySeek`、`ExtensionRuntime.snapshot/validateWorld` | 实体 codec 保存底座足迹；完整图恢复后重建索引；规则版本、模块 manifest、续录检查一起覆盖 |

不是所有 x/y 都应替换：地图格、物品、楼梯、鼠标光标和世界交互对象仍是点；Creature 的 loc 作为锚点也仍可合法读取。必须消除的是“锚点等同于整个身体”的碰撞、接触、距离和可见性推断。

### 2.3 r2 补充审计与方案裁决

初稿 §2.1 的统计口径和入口表仍有效，数量是匹配候选而非实施清单。本轮另核对以下实际执行路径，未重新把历史搜索数写成精确改动数：

| 现状证据 | r2 设计结论 |
|---|---|
| `Creature.ts:60–75,169–206,305–343`：HP／状态属每个对象，tickStatuses 按对象递减，takeDamage 可直接 die；没有命中区或共享状态所有者 | zone/成员受击需路由入口，先截获部位 HP=0，不能让原生 die 自动发布普通击杀；状态必须先解析归属再递减 |
| `TimeCoordinator.ts:104–181`：soonestTurn、递减和行动遍历全部 monsters；攻击由 `Monster.endTurnWithAttack:962` 写耗时，移动／跳过由推进循环兜底 | 核心唯一调度比成员各自调度改动可控；三处遍历都过滤成员，不仅 takeTurn 早退，否则 0 tick 成员会卡住循环 |
| `TimeCoordinator.ts:191–235`／`Game.tickCreatureStatuses:7916`：环境→状态递减→环境演化；`Game.ts:9533` 发 objectiveTime，现 actorIds 无群体区分 | 群状态一次、局部状态各一次；新增群体资格 DTO 和群预算归属，不把过滤调度等同过滤所有状态／被动 |
| `Systems/Time.ts:10–17`／`Game.ts:3798` 等：currentTick 是玩家动作累计簿记，不是 NPC 子事件绝对时刻 | 成员冷却推荐剩余 tick，随 advancementLoop 实际 soonestTurn 递减；不借 currentTick 定时。阶段3若统一真实模拟时钟再共用其协议 |
| `Monster.polymorph:744–825`／`Game.polymorphBoltTarget:5691`：先取消关系、mutation、携带者等，再抽形态和改 HP，最后更新视野 | 不能包一个事后 canFit 检查；拆成纯转换计划、落点预留和原子提交，失败保留旧形态／关系／状态 |
| `Monster.copyForClone:653–685` 是浅复制加显式容器复制；`Game.cloneMonster:8491` 只计划一个格；`trySplitMonster:8515–8580` 先减 HP 再 clone | 新 spatial／zone／群表不能被浅共享；复制整组并重映射成员引用，分裂先验全部结果，再改 HP／分配 ID |
| `Creature.constructor:144–158` 分配ID，`Monster.constructor:597–646` 还可能掷睡眠骰；`copyForClone:655,681–684` 分配ID／可能掷性别骰 | 不能用现有构造／clone调用做纯预检；显式准备创建属性及随机结果，暂存对象不分配真实ID／不再取骰 |
| `Game.killMonster:9235–9287` 即使 administrative 也 captureDeath／emit kill／demote；`MonsterLifecycle.ts:25–56` 仅管理实体生命周期与列表 owner | 用行政死亡删旧部位仍会发 kill；必须新增 retirePart/replaceBody 的无死亡路径，核心终结才发整体击杀 |
| `EntitySnapshot.ts:18–50,103–116` 明列字段、copyFields 可写 undefined，实体图只跟 leader／carried 引用 | codec 需保存可选 zone/spatial 和群表，完整图额外遍历成员边；群体根不能仅靠 leader 边或当前 monsters 列表 |
| `src/ext/worldSpatial.ts:7–31` 是可见、非阻挡交互对象放置；`definitions.ts:16–21,76–83` 的 enemy metadata 没有身体运行器 | 不拿 worldInteractables 当战斗部位，不借已有 width/height 验证冒称任意形状已支持 |

因此采纳“刚体 + 复合体”，不把所有腿编码成一个可变大掩码，也不把群体当既有 leader/follower：前者无法独立 HP／行动轨迹，后者是关系指针，不保证调度、连接、原子迁层或单次奖励。群体管理属原生底座；仅模块内容依赖 ExtensionRuntime，通用 fixture 可在无模块情况下运行。

## 3 通用底座模型与 `giants` 模块

### 3.1 身份、所有权与 schema 草图

拟新增 `src/engine/Movement/CreatureSpatial.ts`（几何／占位／提交）、`src/engine/Map/FootprintPathing.ts`（位姿图）、`src/engine/Core/BodyGroup.ts`（群体生命周期／调度）、`src/engine/Combat/BodyDamage.ts`（命中区／伤害路由）、`src/ext/spatial.ts`（冻结 DTO／有限声明）、`src/ui/creatureFootprint.ts`（公开呈现）。名称可审阅调整，能力归底座，不导入 giants。

三个身份必须区分：entityId 指 Creature；partKey 指 `(entityId, zoneId)`，无命中区时用该实体的保留标签 `body`；groupId 指整体，复合体固定等于 coreId，普通单体查询时隐式等于 entityId，**不分配群体 ID、不新建群体记录**。partId 是群内稳定槽名（如 left-leg-1），便于定义、再生和形态映射，不代替运行时命中键。成员均有独立实体 ID；核心也是成员之一，不另造不可受击的“脑实体”。

以下均为拟新增 schema，省略引用和数值校验器；字段从 4a0 就定为通用形状，功能按 §14 解锁：

```ts
type Pose = 'r0' | 'r90' | 'r180' | 'r270'
  | 'm0' | 'm90' | 'm180' | 'm270';
interface FootprintDefinition {
  id: string; owner: 'foundation' | string;
  geometry: { kind: 'rect'; width: number; height: number }
    | { kind: 'mask'; cells: readonly { x: number; y: number }[] };
  poses: readonly Pose[];
  zoneCells?: readonly { x: number; y: number; zoneId: string }[];
  zones?: readonly HitZoneDefinition[];
}
interface HitZoneDefinition {
  id: string; nameKey: string;
  health: { kind: 'native' } | { kind: 'local'; maxHp: number;
    ownerTransfer: { numerator: number; denominator: number } };
  armor: number; damageMultiplier: { numerator: number; denominator: number };
  breakRuleId: string;
}
interface CreatureSpatialComponent {
  schema: 1;
  footprintId: string; pose: Pose;
  movementRegionId?: number;
  bodyMember?: { groupId: number; partId: string };
  actionLockInTicks?: number; // 缺可选硬直模块时的有界行动抑制。
  zoneState?: { zoneId: string; hp: number; broken: boolean;
    generation: number; regenerateInTicks?: number }[];
}
interface BodyConstraint {
  childPartId: string; parentPartId: string;
  kind: 'tether' | 'chain';
  minDistance: number; maxDistance: number;
  maxStepPerAction: number; requiresClearLink: boolean;
}
interface PartDefinition {
  partId: string; role: 'core' | 'support' | 'weapon' | 'segment';
  providesSupport: boolean;
  formId: string; preferredOffset: { x: number; y: number };
  attackProfileIds: readonly string[];
  coreTransfer: { numerator: number; denominator: number };
  breakRuleId: string; statusProfileId: string;
}
interface PartBreakRule {
  id: string; trigger: 'hp-zero';
  disposition: 'keep-zone' | 'remove' | 'inert-body' | 'debris';
  replacementFootprintId?: string; // 固定zone破坏后可声明形状变体。
  childrenOnBreak?: 'retire-subtree' | { reparentTo: string };
  modifiers: readonly (
    | { kind: 'move-ticks-multiplier'; numerator: number; denominator: number }
    | { kind: 'disable-attack'; attackId: string }
    | { kind: 'expose-zone'; partId: string; zoneId: string }
    | { kind: 'balance-loss'; amount: number; fallbackStunTicks: number }
    | { kind: 'locomotion'; mode: 'ground' | 'water' | 'flying' | 'immobile' }
  )[];
  regenerate?: { delayTicks: number; formId: string; maxCycles: number };
}
interface BodyDefinition {
  id: string; owner: string; parts: readonly PartDefinition[];
  constraints: readonly BodyConstraint[];
  minSupportParts: number;
  noSupport: 'immobile' | 'collapse' | 'die';
  coreDeath: 'remove-members' | 'debris-members';
  statusProfileId: string;
}
interface BodyGroupState {
  schema: 1; groupId: number; coreId: number; bodyDefinitionId: string;
  members: { partId: string; entityId: number | null;
    life: 'active' | 'broken' | 'removed'; generation: number;
    readyInTicks: number; regenerateInTicks?: number }[];
  appliedBreaks: { partId: string; zoneId: string; generation: number }[];
  // HP、位置、状态在 Creature；本表不再复制。
}
interface CreatureSpatialView {
  entityId: number; groupId: number; partId: string | null;
  anchor: Readonly<{ x: number; y: number }>; footprintId: string; pose: Pose;
  cells: readonly Readonly<{ x: number; y: number; zoneId: string }>[];
}
```

整数锚点 `Creature.loc` 是形状的局部原点／旋转支点；原点必须是掩码内一格。初稿方形的原点仍为左上角，builtin square-2／square-3 只用 r0，战斗面向另有 8 方向，不因“转身”改变方形占位。任意形状的 offset 可为负，旋转／镜像绕原点变换，原点世界位置不漂移；不把每个旋转结果重新挪到包围盒左上。对称且占格／命中区标签一致的位姿可共用编译表。方形宏只预编译一次偏移和矩形快速公式，不实例化 N² 个实体／zone；普通 1×1 没有 spatial 属性，默认 builtin single/r0。UI 的宽高是派生信息，不再把 size 当机械真相。

形状格唯一、整数、4 邻接连通，允许凹形和孔洞；包围盒空洞不占位／阻路／命中。命中区一格一个标签，未标注用保留body；zoneId唯一，native zone HP引用Creature.hp、不保存zoneState HP，local zone才存独立HP。定义maxHp／装甲／倍率不重复写状态，zone可破坏／再生时才创建对应记录。坏掩码／孤立格／重复zone/part／零分母／循环约束／超预算拒绝；同一身体恰有一个core角色，全部form/shape/profile/break/attack引用合法、coreId与groupId一致。

约束首批限定为有根树，父亲先于孩子求解；九头蛇用星形，长蛇用chain，蜘蛛／章鱼用核心加支链。距离为父子footprint最短切比雪夫格距，clearLink用确定接触对查墙／连接路径。连接边默认不占格、不受击；可攻击触手全长用实际segment成员，不用显示线代替身体。循环拓扑留版本化扩展，不无界求解；partId群内唯一，禁止多群共享实体、跨层拆散、成员重叠或玩家入组。

群体 HP 只有核心的原生 HP；各成员的原生 HP 和 local zone HP 分别保存。群体精神状态／关系由核心持有，成员查询通过 status profile 路由到核心；局部状态留在成员，不拷贝整份核心状态。由成员数和 appliedBreaks 派生的速度、可用攻击与支撑能力不重复保存。核心背包是整体携带物所有者；成员不自动获得同一份装备、掉落或成长余额。

### 3.2 通用接口与占位索引

| 拟新增底座 API | 合同 |
|---|---|
| `spatialOf(id)` / `footprintCells(id)` / `membersOf(groupId)` | 冻结可信 DTO；单体也给隐式 groupId／body 标签；格按 y/x 稳定排序，无 RNG |
| `occupantAtCell(p,policy)` | 返回 `{entityId,groupId,partId,zoneId}`，可解析实体；显式 active、active-or-reserved、死亡接触资格；getMonsterAt 兼容入口只返回实际占该格的 Monster，不偷偷返回核心 |
| `distanceBetweenFootprints` / `nearestContact` | 实体格对几何；另有显式 group union 视图，保留每种距离单位和墙角政策；不能把尾腿位置当核心锚点 |
| `canFitPose` / `canStepFootprint` / `canRotateFootprint` | 完整形状／扫掠、地形、区域、动态占位；忽略本次计划自己的旧占格，不忽略未参与搬移的同群成员 |
| `planSpatialChange` / `commitSpatialChange` | 单体／多体落点、转向、出生、移层共同计划；复核实体／形态／地图／占位 revision 后原子发布，再按新旧足迹差处理接触 |
| `collectBodyTargets(cells,policy,scope)` | 输出实体／部位／群体及真实接触格，明确 dedupKey；顺序遵循子段接触顺序，无方向时 y/x、entityId、zoneId |
| `planBodyTransition` / `commitBodyTransition` | §4.4 的身体拓扑事务；ID、形态、关系、组件、群组、计划、事实一起提交，不是任意脚本世界事务 |
| `readKnownBodyTarget` | 玩家投影另裁切已公开格／部位；不直接交完整机械 DTO，不给隐藏连接拓扑或未见部位 HP |

格→占位引用是派生索引，不写 Cell、不存档；物理活跃层一格最多一个实体，包括同群成员也不叠格。索引编号映射到实体及命中区，群体身份从原生组件解析；去重键从 4a0 已可表达三种，不让各消费点自己猜。休眠预留另表，射线不把休眠者当活跃目标；按旧规则允许的预留／活跃重叠由策略返回预留集合。复合体唤醒需全组合法落点，不能只抢核心格。

真相仍是实体 loc、spatial、群表及楼层／活跃／休眠／死亡所有权。出生、位移、变形、部位破坏、再生、移层、唤醒和列表替换都走发布点；死亡 DF／掉落期间保留原 `getMonsterAt` 可查询窗，deathProcessed 后去除对应资格。部位移除另走 retirePart，不套用死亡窗。携带、purgatory、pending 不占当前层；群体进入这些状态时全组同步迁出。

构造／解码／生成临时离图位置只准存在于“索引未发布”作用域；`ownedMonsterList` Proxy 不拦截 loc，不能靠它保正确。load/grid 替换、回滚后从真相重建缓存；WeakMap 仅藏派生服务，`checkpointGenerationWorld` 跳过 WeakMap/WeakSet，restoreSession 必须主动失效／重建。机械群表、成员冷却、破坏与再生记录不能放 WeakMap 逃避 codec／写集。

### 3.3 未使用能力时的零影响合同

1. 普通实体不添加 spatial、空 zoneState、默认 bodyMember 或群表；codec 按“属性缺席”处理，不写 spatial:undefined。基础格式升级仅是包络变化，差分只排除版本、savedAt 和明确派生缓存，不能排除 HP、坐标、tick、组件、队列或实体计数。
2. 空集合、growth-only、narrative-only、growth+narrative 的原场景没有占位表、位姿图、群调度过滤表、额外 FOV mask 或新增规则 RNG；1×1 几何与 getMonsterAt 保留轻路径。能力使用者计数在生命周期更新，不每步全局扫描“有没有巨人”。
3. 原生空间／群体 fixture 不需要 ExtensionRuntime；不向未启用 giants 的 manifest/state 注入 giants 块。格式变化如实列出，不能声称序列化 JSON 逐字节不变。
4. 以初稿源码基线真实 Game 场景做新局、移动、战斗、位移、召唤、机关、换层、存读与录像差分，比较完整机械对象图／引用、消息、双流状态与调用数。此证明针对未使用新能力的组合，不要求 CE 同种子逐骰。
5. 显示／保存／校验／索引重建／纯几何不取实质 RNG；同一实体幻觉外观一次采样，不能按格或部位重复随机。最后一个使用者离层释放派生缓存，不保存“曾激活”标记；核心同源判断、被动和费用不因成员数自动倍增。

### 3.4 模块内容与受控声明

`src/ext/modules/giants/` 自有 descriptor/module、schema/types、原创 definitions、形状／身体／部位／转换／招式数据、场地模板、state codec、locales、AI 声明、UI/Boss 血条及 tests/test-suites。机械定义进自有 rules 指纹，显示资产版本独立。底座创建计划白名单接收 MonsterData 与空间／身体定义，不改原 monsters.json/horde 表，不依赖 growth 模板运行器。nameKey/descriptionKey 通过通用创建适配器纯解析，ItemLoader.translateName 现只查 name.*，不能在共享原词条表塞 Boss 文本或为取名取骰。

通用形态目录贡献包含 owner 限定 formId、native 属性／速度／特征、rigid footprintId 或 composite bodyDefinitionId、合法转换配置。当前 Polymorph 仅原目录，CreatureFeatures 对未知 typeId 给零血迹／DF；启用模块的冻结贡献须一起接到出生、被动变形抽样、主动转换与 snapshot.form 校验。缺特征有明确默认，原创血迹／死亡 DF 需声明；共享函数不得 import giants。未使用能力时原形态抽样范围、顺序与 RNG 不变。

P4-D07=A 不新增 boss/size 免疫谓词；材料／技能已有通用资格仍适用并在检视说明。正式内容初次只开放一个方形敌人，之后逐步提供不规则刚体、带核心弱点的石像、蜘蛛／章鱼、九头蛇或长蛇等原创样例；这些是可选验收载体，不承诺全部编写。底座成员移动／攻击／受击完整时无阶段3也可玩；成长与叙事缺席不影响存活、战斗、破坏或整体死亡。

内容 AI 仅给有限“守场／追击／回归、支撑落脚、可用攻击、条件转换”的声明，不接受脚本。成员级成长属性若需要由通用出生配置显式授予，群体共享预算默认只属核心；任何共享修正用底座请求／软能力接入，不复制核心组件制造多个 XP／资源账户。

## 4 空间、群体行动与身体转换

### 4.1 刚体移动、旋转与邻接

刚体足迹是 `anchor + compiledOffsets(footprintId,pose)`，整体原子移动；包围盒仅作早排除。正常平移锚点一格，消耗一次 movementSpeed，不按格数增加 tick。目的全部占格满足该 actor 通行／区域／占位策略；自己的旧新身体重叠合法，不允许盖住别人。多格对角推荐目的位姿及两个正交中间位姿均 fit，图边用同一谓词；1×1 保留各入口原墙角语义。

物理朝向与攻击面向分开。4a 方形只 r0；4b 开放 r0/r90/r180/r270，镜像作为已建模但默认不开放的可选位姿。转 180° 必须经过两个明确的 90° 原语，不能只验起终掩码；每个 90° 使用预编译保守扫掠格集合（格方块绕整数支点的整个旋转轨迹所触格），检查地形、地图、区域及其他实体。镜像不是瞬时“翻身穿墙”，需显式转换能力和其扫掠／落点规则，首批不能通过换 pose 绕检查。

扫掠只用于运动碰撞，不让扫到的每个格触发踩板、气体伤害或一次近战；实体实际驻留／进入格才触发环境。旋转默认花 movementSpeed，同一子动作不兼作平移；以后显式转向招式可给正整数耗时，不能免费反复旋转触发世界。窄道终态放得下但旋转弧碰墙就拒绝／找可转空间；不缩身体、不挤墙。足迹标签随旋转同步，命中区不能留在旧世界格。

几何距离取任意身体格对最短距离；近战邻接要求切比雪夫距=1 且有合法接触对，双墙斜角不能仅凭距离打到。矩形用 O(1) 下界／距离，掩码枚举有界格对，平局按源 y/x、目标 y/x；欧氏平方与气味尺度仍各自保留。群体 union 查询是显式选项；实际出手、受击与推力必须落到成员和接触格。

### 4.2 落点与位移失败合同

新能力落点搜索有界、确定性：原位先验 → 合法位姿图上的最近路径距 → 只有允许越障的原因可回退方环／全图；同距按 pose 声明次序、y/x。行走不回退不可达区。原生随机传送仍在稳定完整候选上一次抽取，无候选零次；无能力 1×1 的原候选次序／随机调用不变。

| 原因 | 新空间规则 | 失败与费用 |
|---|---|---|
| 生成／自然出生 | 刚体完整 fit；复合体先核心再按 partId／约束拓扑预留全组，排除楼梯、危险、机器和批次占位 | 全组不放置，写 placed/skipped；不缩水、不留半只、不用失败实例消耗 ID |
| 交换／推挤 | 4a 首批多格参与不自动交换，盟友绕行；普通 1×1 原交换不变。后续只允许显式完整多对象计划 | 不递归挤人；魅惑成功不能因无法交换而被撤销或变成额外免疫 |
| 击退／力场／拉拽 | 实际接触对确定方向。刚体逐格整体预检；复合体推荐推整体，成员命中将力路由到核心，重新规划全组姿态 | 墙／实体／约束／区域阻挡即停；碰撞伤害一次、不连锁推人。只移动一条腿须独立局部招式，不继承整体击退 |
| 瞬移／闪现／随机传送 | 穿越遵守原技能；落点刚体／全组 fit，复合体保留原相对姿态先验，不足时有界重布。多格不搬走／杀掉落点生物 | 效果不位移，合法施放费用保留；不临时写 -1/-1。未使用能力的 1×1 潜水者搬移规则保留 |
| 召唤／复制／分裂 | 先声明确定数量／形态，再预留全批身体，见 §4.4；成员和小召唤物都查实际足迹 | 新能力批次整体无效，不逐成员跳过；原生未使用能力的召唤语义不顺带重写 |
| 变形／换体型 | 同一转换底座，形态／关系／状态修改前找到完整位姿与全组落点 | 无位无机械转换，不循环重掷到小体型；已发生形态抽样的 RNG 留存，费用按调用入口处理 |
| 坠落 | 刚体推荐全部占格无支撑才落；群体按核心与有效 support 的支撑联合判断，任一有效支撑可维持整体 | 落层／伤害一次，全组进同一 pending；下层无空间保持有界待放置，不分散成员／反复落伤／补造场地 |
| 换层／追楼梯 | 首批自然 Boss 守场，受控转换成盟友后可有界跟随尝试；接收层预检完整身体／组约束 | 无位留原层并显示原因，不偷偷带单格核心过去。群组缓存／恢复／pending 全部一起迁移 |
| 休眠唤醒／复活／乘客释放 | 原生候选形态、关系和全组落点预检，成功才发布占位；死亡释放乘客也是批次 | 无位保留原所有权／待放置，失败不先回 HP；区域引用需随移层清理／重绑定 |

pending 属现有 `pendingFallenByDepth` 的持久实体图，新增元数据以 groupId 关联全组并记录单次坠落／等待空间；按 ID 稳定重试，只在入层或相关空间 revision 改变时触发，不靠 UI／每帧轮询。全组等待时不进当前层索引或调度，也不凭空推进成员冷却／再生。到底层沿原终局边界，不创第 41 层。缓存层补算按原离层时钟合同推进一次，不能因成员数倍算。

movementRegionId 引用 `extensions.foundation.world.regions` 的唯一几何真相，不复制矩形；原生 fixture 可不使用区域。选择守场时计划中所有成员占格都在边界，形态变大或复制也如此；未选择守场则只去掉该过滤。坠落清旧 depth 区域，模块记 escaped/lost，不在下一层凭 arenaId 复造场地。

### 4.3 核心调度与成员轨迹规划

**推荐核心一个调度项，成员作为群体回合内子动作**。核心共享大脑、阵营／主要目标／睡眠／精神决策；成员保持自己的几何、HP、局部资格与攻击冷却。不采用各成员独立 takeTurn：当前 soonestTurn／状态／攻击耗时分散，独立调度会放大 AI／感知骰、改变同 tick 顺序，并难以保证“核心带着身体整体走”和阶段3的预警取消。

1. 三处调度遍历（找最早、减 ticksUntilTurn、执行）都只包含独立生物和群核心；成员仍在原生实体列表以支持受击、环境和 codec，不用 hp=0／isDormant 假装免调度。普通生物原列表顺序不变，核心继承所在槽；新群按创建计划次序追加。成员残留 ticksUntilTurn 不作为调度权威，save validator 和调试守卫禁止直接把成员耗时提交到全局。
2. 群每次行动先冻结成员资格／目标，选择“核心移动 + 落脚”或“有界攻击子段束”，不默认移动再让每腿免费攻击。攻击束最多 4 子段，每个有独立发起成员／scope；默认耗时为各已执行子动作耗时最大值（并行动作），核心只提交一次正 tick。串行连段须显式给合计耗时。成员 readyInTicks 随真实 soonestTurn 递减一次，结束时各自设置冷却；不能按成员调用 playerTurnEnded、endTurnWithAttack 或嵌套 executeCommand。
3. 空动作／麻痹／无合法落脚至少花核心 movementSpeed，不留 0 tick 自旋。成员被禁用、核心死亡、部位破坏时剩余子段及时取消，不能继续使用起初冻结的死亡部位。原生攻击适配器返回结果与耗时，由群协调器落账；同源命中／成长逐次消费仍按每个独立子段实际命中一次处理。
4. 阶段3的蓄力／预警计划可在不同核心激活中推进，成员攻击计划标注发起实体／partId／generation／足迹 revision；就绪成员不自行创建调度项。持久冷却、待执行计划与取消事实同一安全边界保存，跨玩家命令不保存半执行攻击束。§11.3 约定软联动，缺阶段3用即时攻击。

移动规划先确定候选核心一步，再按约束树与 partId 稳定顺序选落脚点。候选围绕“新核心 + preferredOffset”及合法父成员足迹生成，依次最小化偏好距、移动路径长、y/x／pose；不取随机骰，不按 JS 容器偶然顺序。每成员最多 32 候选，maxStepPerAction 首批≤2，逐步扫掠检查；给每个子步预留格／边，禁止腿交换时交叉穿过另一腿或核心。移动中的足迹与连接也须满足约束，不只验终态。

先尝试保留旧落脚点，再尝试重落脚；允许留一条未动的腿，只要全路径牵引距离和 minSupportParts 成立。支撑／连接不够则核心移动拒绝，可花一次移动行动原地调整合法成员，或等待；不把腿隔墙瞬移到新核心旁。有限回溯预算≤128 个分支节点／核心移动尝试，预算耗尽返回 blocked，最多重新选一次核心邻步；不以无解等同残疾／死亡。长蛇链沿核心路径与父段旧位置生成候选，仍走同一验证，不能用无碰撞约束的“把尾段 loc 直接改成头的旧格”。

路径图只对核心刚体给乐观可达，下一个动作的完整成员解算才是通行证据；连续受阻按有限重规划／等待／回归处理，不能声称求出了最短全身构型路径。该有界局部算法可能漏掉需要复杂换脚的路线，这是首版取舍；场地样例必须保证验收路线可解，复杂全局构型规划另行授权。 **维护者决定（r3）**：行动受限问题以生成为基准解决——巨大怪物只在其场地／通道模板保证体型可通行的区域生成与活动，场地模板须对该怪物的刚体足迹与成员约束（含旋转扫掠、腿落脚）实际验算可达；不为复杂地形研发全局构型规划。

### 4.4 主动与被动身体转换的原子事务

所有身体拓扑变化共用 `BodyTransitionRequest`：reason（polymorph／phase／split／clone／summon／regrow）、sourceGroupId、目标形态和数量、成员映射、HP／状态／关系／预算继承政策、区域与落点政策。提交计划保存原实体／群／定义／占位 revision，目标 DTO、ID 预留数、无死亡退休集、取消计划与缓冲事实；模块只能交有限声明，不能任意修改世界。

| 转换 | 身份与状态 | 完整落点／事实 |
|---|---|---|
| 被玩家变形、主动换形／阶段换体型 | 主体保留原 core/entity ID；旧单体的隐式 groupId 也等于它，新复合体沿用。复合体→单体移除群表，隐式 groupId 仍相同；按 partId 显式映射保留成员 ID，其余新建／退休 | 单体与整组都先求位。玩家打任一成员的普通 polymorph 推荐作用于整体，不先单独变一条腿；“只变部位”须另有局部转换招式与约束计划 |
| 分裂一分为二或多体 | 第一结果保留核心 ID／主群身份，其他结果分配新核心与全部成员 ID；原成员保留／转属只准显式一对一映射，不能被两组共有 | 一次预留全部结果；HP 默认守恒地分配、余额／掉落／XP 权利不复制。原 Boss encounter 绑定所有分裂后裔，全部实际终结才算击败一次 |
| 复制或召唤自身副本 | 源 ID／组不变；副本所有实体新 ID，partId 槽映射而非复制 bodyMember.groupId；容器深复制，不共享 zone/status/成员可写对象 | 副本保留形状／成员数，深度／阵营／区域按声明。默认不复制掉落／奖励权利，不借“Boss 可复制”制造无限奖励；独立副本不自动变成原场地胜负绑定 |
| 召唤其他单位／多体批次 | 每结果新 ID；加入自身身体还是独立生物必须显式声明，普通 follower 不是 bodyMember | 数量在规划前确定，批次全 fit 才提交；允许内容定义先用预算确定较少数量，再形成原子计划，不提交后逐体跳过 |
| 减成员／再生长 | 同槽再生 generation+1，新实体 ID；破坏历史收据保留，已有部位不能用复用旧 ID 冒充从未坏过 | 少掉的部位用 retirePart/replaceBody，**不调用 killMonster（即使 administrative=true）**；不发 kill／掉落／经验／死亡 DF。再生先验位置，失败按有界时钟等待 |

HP 政策必须是声明枚举：被动 polymorph 继续既有 polymorphHP 主体比例／伤量规则，群形态只读核心 HP，不把所有腿 HP 相加治疗主体；新 local／成员 HP 默认用同一存活比例，缺失的旧槽按目标形态重建，不复用外部死亡收据。主动阶段转换可配置保持比例／伤量／显式模板，但不默认满血；分裂守恒、复制模板或当前比例另声明。状态、抓持／leader／携带、成长组件和计划分别声明 preserve／clear／remap，不能 shallow-copy 获得未授权资源。普通物品资格沿通用规则，Boss 身份不参与免疫判定。

退休成员的入边也纳入计划：抓持两端清理，leader默认改指存活核心或清空，携带者按原所有权处理，预备／蓄力／检视目标失效。不能只删monsters数组而让别的实体继续引用旧腿，或把无死亡退休的腿留作GC根。chain父段破坏默认连其子树无死亡退休；要保留末端须声明childrenOnBreak重接到存活父段并全体验约束，否则拒绝定义。核心死亡移除所有成员不触发多次后裔kill。

计划顺序：纯校验形态与预算 → 必需随机抽样（明确次数／顺序）→ 虚拟 ID 与全结果足迹、约束、区域及动态占位预留 → 纯验证 HP／关系／状态与软 provider 意图 → 暂存新对象并深复制／映射 → 复核 revision → 同步提交实体、群表、索引、预算／模块绑定、计划取消和事实。真实 ID 计数只在成功提交推进；计划无解不修改原生状态／收据，已发生的形态或数量抽样 RNG 不倒退，不能重抽直到 fit。

暂存创建使用无分配／无RNG的原生装配端口（可沿allocateForSnapshot的构造方式扩展），不直接new Monster或copyForClone；睡眠／性别／突变等确需随机的出生属性在计划中显式抽取并携结果，装配不再抽第二遍。新ID按结果序号、核心先、约束拓扑／partId次序一次提交；失败的虚拟ID不推进nextEntityId。此端口只有可信底座能调用，模块没有任意原生对象写权限。

受控输入可预见拒绝沿现有 prepare 协议不扣费／不录命令；已命中物品的被动变形无位属于效果失败，物品原费用保留；已承诺的主动阶段／施法无位默认保留其行动耗时与已付费用，并记录无效果，不能同 tick 无限重试。主动纯预检不能先调用 takeDamage／polymorph 再回滚作“预览”。

结构提交一次发布，之后环境／陷阱依据真实进入格和 §5.2 顺序处理；新身体当场遇险死亡是后续合法因果，不说明转换未原子。不把回调插在群表半更新时。预期之外异常必须回滚已登记的窄写集（对象图与引用、列表、ID、群表、扩展资源／事实／消息、两流及缓存恢复），验证完整图；接触若会改地图，写集必须包含实际地图修改。现有生成／2c 奖励事务不能直接声称已覆盖此动作，实施需单独登记边界；失败不得发布出生／破坏／转换事实后再留半体。

Boss encounter／奖励权利由模块或可选 provider 保存，底座只给可信 group-terminal、part-broken、body-replaced、clone/split 事实及来源。部位破坏没有 kill XP，整体死亡按核心 groupId 一次；分裂让已有奖励池分给结果，复制默认新零权利，具体数额不由 giants 硬编码 growth。原形失去 Boss 外观但同一主体还活着时不算击败，不靠变老鼠触发死亡奖励。

## 5 地形、气体、机关与物品

### 5.1 一份足迹暴露摘要

多格路径先读取身体格的四层地形/气体，生成冻结 `FootprintExposure`，再按现有主时序结算生物；1×1 保持原路径。不能对每个格直接调用 `applyEnvironmentalEffects`。刚体每实体一次；复合体先各成员暴露，再按 §5.3 数据归属路由，群体状态／整体携带物只推进一次，成员局部伤害与状态各一次，不按占格或 zone 数增加时钟。

| 类别 | 多格推荐规则 | 一次性与混合情形 |
|---|---|---|
| 火/可燃地形 | 任一占格接触火即可点燃，免疫/飞行/潜水按原效果资格；燃烧状态伤害仍每客观块一次 | 完全处于灭火层才灭火；有干燥着火格时不会因一只脚踩水来回熄灭。着火身体可点燃每个可燃接触格，但逐格世界写入不复制生物伤害 |
| 熔岩 | 任一占格接触无豁免熔岩即可致死；只执行一次死亡与终结来源 | 免火/飞行等资格仍由原生效果规则决定。选择“任一格”使边缘避险有意义；不是 N² 次伤害 |
| 深水 | 任一占格涉深水即进入涉水风险/行动限制；水生者普通移动要求全部身体格满足水生通行；飞行/免水保留豁免 | 不新增原本没有的溺水数值。潜水与水下隐藏要求全部身体格可潜且无干地；冲刷携带物只抽一次，不按格翻倍 |
| 裂隙/下降/支撑 | 推荐全部身体格都缺支撑才坠落；深水不算“缺支撑”。悬浮者不落 | 等效支撑条件单独求 AND；不能把 flags OR 后看到 T_AUTO_DESCENT 就落。该产品规则见 P4-D04 |
| 气体浓度 | 现代码按 GAS tile flags 判效果，**不以 volume 设置阈值**；保持此规则。任一占格含某气体效果即暴露，同类状态用一次 max 刷新 | 暴露摘要可携带每种气体最大 volume 供将来公式使用，首版不将浓度平均/累加乘伤。不同气体种类各自生效；同种腐蚀/蒸汽等渐进伤害类别取最强一次 |
| 蛛网/毒苔/荆棘 | 任一格接触即可缠绕/中毒；同种效果一次抽样或刷新；只有全部身体离开对应地形才清接触状态 | 挣扎消耗一次行动；破网时按身体接触格稳定处理，不为每格再投挣扎骰 |
| 地形治疗/渐进损伤 | 该结算类别在身体内取最大有效强度一次；伤害与治疗作为两个既有类别按原时序 | 不把覆盖面积变成倍增器，也不提前给移动瞬间补一个气体伤害 tick |
| 爆炸 | 同一爆炸/DF scope内，刚体一次，复合体默认group一次核心伤；part切断效果须显式声明。原免疫窗继续处理跨scope连续爆炸 | 不靠免疫窗掩盖尾格重复；死亡DF不重发XP，独立后续爆炸按原免疫规则 |
| 陷阱/压力板 | 任一新进入身体格触发**该格**合资格机关，每个真实机关一次，玩家专属ENTRY不施加给怪物 | 独立陷阱各触发，机器激活按机器去重，伤害按效果的实体／部位／群键去重，不把一组脚当同一块板 |
| 门/地形晋升 | 身体碰到的通用 creature-step 门格分别开启；目的地整体开门预计划后才验 fit/移动。正常不会撞碎墙或挤过 1 格门 | 多格驻留格维持通用踩门晋升；改变地形后通知缓存。不能无条件把玩家专属晋升复制给 NPC |
| 钥匙/物品/掉落 | 玩家拾取仍 1×1；携带匹配钥匙可作用于任一身体接触的机关，同一消耗物一次；普通怪物不新增扫地拾取能力 | 死亡/携带物掉落以实际死亡接触格起搜，再按 footprint 附近稳定单格候选；只掉一份。物品仍可在身体下方存在，UI 由遮挡优先级决定 |

整体 flags OR 仅适合“任一格”存在性；不能拿 OR 同时替代支撑、全身潜水、灭火、免疫与每种气体的实际采样。上表首先规定每个刚体的摘要，群体额外聚合见 §5.3，成员着火不自动让另一条干腿着火。首版上述推荐共同组成底座版本化规则集；可配置点是经过校验的分类／归属枚举，不接受任意 reducer 脚本。

### 5.2 重入、触发顺序与随机边界

移动提交后按新进入格y/x处理通用机关，复合体的成员格在同一稳定接触序列；旧驻留格不伪造进入。需驻留的DF／地形按客观块查全身体。实体死亡／瞬移／坠落／换形，或部位破坏改变群拓扑时停止旧列表，用新真相续算；同一contact scope保留已处理进入格／机关记录，不能重启列表重复踩板／掷骰。

DF 可逐格回调，并嵌套触发新的 DF。底座提供短命 effect/contact scope，记录 `(scopeId, effectKind, dedupKind, targetKey)`；targetKey 按 §6 是实体／部位／群体。内层同源面积接触共享作用域，不按格重新分配 effect ID；不同独立陷阱／攻击子段获得独立作用域。被杀整体的死亡爆炸是新子效果作用域，继承因果来源但不共用杀死它的命中账本；普通部位破坏不自动生成死亡爆炸。作用域同步排空，不存档，不由 UI／墙钟／装饰 RNG 创建；跨命令延迟效果保存独立持久 plan。

每种生物效果按其唯一目标键采样一次，群精神／整体爆炸不是每成员一骰；世界格既有火焰／晋升／气体RNG仍按真实地形变化，启用新身体可有意改变环境后续RNG。报告分清目标去重与真实多格地形变化，不把所有漂移笼统归体型。无使用者不建立新scope或改变原调用次序。

### 5.3 状态归属与群体环境

底座提供 StatusProfile 数据行 `{statusId, owner:'group'|'entity', merge:'max'|'stack'|'replace', disables:[…]}`，实际叠加／免疫／伤害仍调用该状态的既有规则。群体默认 profile 可由身体定义引用，特定技能可声明经白名单允许的局部覆盖；不在代码写“蜘蛛精神免疫”或为每种怪物分支。group owner 存核心，entity owner 存实际成员，单体两者均落在自身。

| 状态／资格类别 | 推荐归属与效果 | 可配置边界 |
|---|---|---|
| 魅惑／支配关系、纷争、恐惧、睡眠、入迷 | group；全组阵营／目标选择一致，只作一次精神／关系判定。入迷的受控移动执行全组空间计划 | 支配是关系变化而非另造 status；不得因打中腿只把一腿变盟友。剧情局部叛离需显式拆组转换 |
| 麻痹、混乱 | 默认 group；麻痹禁核心及子动作，混乱一次方向选择后整组预检 | 明示“局部麻痹”的部位招式可 entity，仅禁该肢体；核心不因此失去大脑，但支撑数可能不足 |
| 燃烧、中毒、局部腐蚀／缠绕 | entity；腿的毒／火计时和伤害只在该成员一次，传核心遵循传伤政策。缠绕阻止该成员改落脚 | group 毒素须技能显式声明，写核心一次；不向全体拷贝 poisoned，也不反复写核心加 8 层毒 |
| 加速／减速、整体飞行、隐身、免火等 | 身体 profile 明确 group 或 entity。默认加减速与主动隐身属 group；局部飞行／免火是成员资格 | 一个头会飞不能让全组跨渊；group 资格从核心路由，资格变化失效通行／暴露图 |

objectiveTimeBlock 中先各实体／成员读暴露，按状态 owner 合并相同施加，再执行每个状态所有者一次计时／伤害，保持原环境→状态→环境演化主序。核心群状态可被所有成员查询，但不能被所有成员 tick。成长的客观效果若是核心预算只执行一次；已明确授予成员的被动各自有效。缺 profile、未知状态归属或冲突定义在载入数据时拒绝，不用默默套群体默认隐藏错误。

群体支撑只计 providesSupport=true 的活跃成员（核心同样声明），武器触手可显式兼任；支撑者任一合法支撑即保持组不坠落，全部无支撑才整组坠落。维持正常行走另需 minSupportParts，不能把一脚撑住不坠落等同可正常跑动。全组潜水／水下隐藏要求所有活跃身体满足条件，部分腿露干地就不全隐；各成员的火／水暴露仍局部处理。掉落、涉水冲刷核心携带物和整体熔岩致死按归属路由：核心接触致死整体，肢体接触致死该部位并触发破坏，不因一只耐热触手覆盖核心免疫，也不把每腿当独立掉落袋。

### 5.4 部位破坏、传伤与再生

受击定位实体／zone，走独立命中／防护／整数伤害，再扣实际HP（native或local）；zone装甲／弱点倍率只解算一次。local zone按ownerTransfer传所属实体原生HP，非核心成员再按coreTransfer传核心；每段基数=min(防护后伤量,受击者本次命中前正HP)，不传过量伤害，逐段向下取整。比例默认在[0,1]内，不允许反向／循环／自传。沿同一resolutionId保留来源，不重投命中／重复装甲，也不重新触发符文／吸血／临时效果；额外传导防护须明示并进入规则指纹。

推荐固定local命中区传导1:1、外围成员1:4（P4-D09）；直接核心native HP只扣一次，不自传。数值可配置0或1:1等；成员有local zone时先传给该成员，再按成员政策传核心，不额外沿zone→核心旁路重复传导。横扫两腿的两次局部伤害／传导是有意结果，同腿多格仍一次。同scope核心直接受击后，外围独立命中的派生伤量仍有效，不伪造第二次核心攻击；贡献统计不把同份伤两次计入击杀。

local HP到0发布唯一 `(groupId,partId,zoneId,generation)` 破坏收据；单体partId使用保留self，收据由zoneState.broken/generation承载，不为它创建群表。native zone共享实体HP，到0时非核心成员按PartDefinition破坏一次、核心／单体按真正死亡一次，不让每个native zone各触发破坏。zone默认keep-zone，不移身体格，只失攻／防护或暴露其他zone；掉石甲须声明replacementFootprintId并按§4.4换合法变体，不任意删格断开。成员默认remove，释放占位、保留槽墓碑；inert-body不可行动／再受击，仍由群管理，其资格排除普通hp<=0 death sweep。默认随群保留相对偏移、整体搬移／迁层，剔除活支撑／攻击但保留牵引／碰撞；固定原地残体转独立非战斗世界对象，不让同群残体跨层分裂。

debris 转地形是可选声明，需预检地形／机器／连通性、写集和缓存失效；4c 首批不开放阻路残骸，以免截断玩家唯一出口。remove／debris 均不发成员 kill／死亡 DF／掉落／XP。整体核心 HP=0 才终结全组一次，成员按 coreDeath 批次无死亡退休／残骸；有意部位爆炸可声明独立 break effect，不能借普通死亡回调重复奖励。

破坏修正从唯一破坏集与仍有效成员派生：腿少→movementSpeed的tick倍率增大（速度变慢）；头毁→禁对应攻击；甲毁→核心zone弱点开放；有效支撑数低于minSupportParts→noSupport的immobile／collapse／die，不仅在计数恰好0才判断。平衡损失可请求阶段3韧性／硬直，缺席用声明短行动抑制和取消子段（§11.3）。重载／收据重入不累乘速度或重复清攻击；规则修正／再生恢复需重算并失效通行／动作资格。

schema 预留 regenerateInTicks、generation 和 maxCycles，首批产品推荐不启用再生（P4-D13）；后续在实际客观时钟安全边界计划 regrow，合法落点才创建新成员／恢复 zone 与撤回对应派生修正。无位只等待下一次有效重试／期限，不占一格无实体残影、不每帧循环生长；再生的旧破坏收据和生成次数持久保存，读档不送免费新腿。

## 6 攻击、弹道、目标与去重键

### 6.1 效果类别决定目标粒度

占位查询只交事实，**底座的版本化 EffectTargetPolicy 按效果类别给默认，招式／效果数据可显式覆盖**，不是 UI、getMonsterAt 或某种怪物自己决定。同一子段定义 `dedup:'entity'|'part'|'group'` 及明确的 damage/status recipient：entity 是实际成员，part 是成员＋zone，group 是 coreId（单体隐式 groupId）。覆盖需静态校验且进入 rules 指纹，未声明用下表；不能随机挑键，不能用增长倍增／帧顺序决定键。

| 效果类别 | 推荐默认与命中接收者 | 可配置点／理由 |
|---|---|---|
| 单点近战／投掷／定向射线 | part；第一次碰到的真实成员／zone，只有一个目标 | 可瞄弱点、每腿独立受击；普通无 zone 单体仍只有 body，N 个身体格不多投骰 |
| 横扫／矛／鞭等局部几何武器 | part；每个相交部位一次 | **横扫同时扫两条蜘蛛腿各一次**，多格同腿一次；可显式 entity 将该腿多个固定 zone 合并，或 group 作整体冲击，但须说明 HP 路由 |
| 爆炸／范围伤害（火球、闪电链、爆炸等） | **part**；与范围相交的每个部位各命中一次（同一部位多格仍一次），每次按 §5.4 局部扣血与传导 | **维护者决定 D08**：与横扫／矛／鞭一致，火球覆盖八条腿就是八次部位命中；大体型吃范围伤害更多是有意设计，数值由 HP／传导比例调节。整体治疗等非伤害整体效果仍按 group 一次 |
| 否定／纷争／魅惑／恐惧等精神或整体身份效果 | **group**；由 profile 路由一次到核心并影响全组 | **维护者决定 D08**：只有针对整体的精神／身份类效果按整只一次。局部状态招式必须 entity/part 明示；ordinary polymorph 对整体一次，不各腿重抽形态 |
| 地形／气体／持续伤害 | exposure 先按 entity，施加按状态 owner 合并；不是强行全部 group | 成员燃烧各自一 tick，群毒只一 tick；世界机关按格／机器去重独立于身体命中键 |
| 击杀／XP／整体 defeat 事实 | group，核心终结一次 | part-broken 另事实；不可配置为每腿一份普通击杀奖励 |

群键命中保留实际 contact 的成员／格供命中位置、血迹／反射方向和消息，但用核心防御／整体资格解算，不先扣腿再额外扣核心。部位键命中走 §5.4 局部与传导；entity 键合并多个 zone 时以首次合法接触 zone 解算，而非各 zone 伤量相加。同一实际局部命中只消费一次成长逐命中效果、符文、抓持、反伤、吸血与 physicalResolved；传导是其派生事实，不重新触发这些出口。攻者部位可独立 HP／装备，共享资源的费用仍由声明的核心预算支付一次，不能由每条腿重复扣同一费用。

### 6.2 几何、弹道与知识

普通近战从发起成员到目标部位的最近合法接触对出手；大型单体普通攻击仍只打一个目标，不按身体格免费多攻。攻击束中的不同头／腿属于显式子段，新 scope 可再命中同一目标，不能因为同一 Boss 合并连段。横扫外围取发起成员 footprint 的 8 邻接并集扣自身；矛／鞭／触手相对形状按底座原语产生，保留原矛从远到近等解算顺序，无方向枚举按 y/x、entityId、zoneId。

非穿透弹道在第一格身体接触停，隐藏尾格有机械碰撞但不能泄漏身份。穿透默认一 projectile scope 对每个 part 一次；对于无 zone 的刚体仍只一次，显式整体射线可 group，切割射线可 part 多次。反射按同一有效碰撞键首次采样，不能在同腿的第二格又掷一次；有多个明确不同部位的可反射资格时依稳定接触序分别处理，并受弹道本身反射上限约束。

现 `traceBolt` 允许反射后重复访问同一普通 1×1 实体，保留该无能力语义。只有启用 spatial/zone/bodyMember 的目标按新键折叠 scope 内重复接触；混合场景须验证“巨人单部位一次、普通反射目标按原重访次数”。不借此次迁移统一所有旧弹道；若阶段3要改，另定规则与版本。

AoE 先用原距离度量／LOS 生成格集合，再与实际掩码交集收集目标，不能仅测锚点半径或矩形包围盒；L 形空角不挨打，蛇段在范围里而头不在也能命中。资格、敌我、隐藏知识与免疫仍由效果政策复核；按已决定 D08，火球与横扫同为 part：碰到两腿就是两次局部伤（各自按 §5.4 传导）；只有整体精神／身份效果按 group 一次。成长已有技能是受控动作＋效果，不冒称已有通用 AoE，几何复用底座。

自动选敌先 group 一条候选，再列公开可打部位；手动瞄准仍记玩家真实点击格，须解析当时 contact。部位命令可带实体／zone／generation 与 revision 作为验证信息，不能让玩家提交群核心 actorId 或伪造 hidden part。prepared 等待后再次核对知识、形态、位置、部位存活与接触规则，陈旧目标取消不扣费，沿既有风险确认协议；prepare 不先移动／伤害再回滚。

## 7 视野、潜行、感知和关系

- 任一占格满足直接可见／既有隐藏资格即可公开该实体，复合体附近列表聚合为一个整体，但只给已知成员／部位。看见一条腿不公开墙后的核心位置、隐藏连接、未见部位数或 HP；完整身体轮廓仅逐格公开。纯机械 group 查询与玩家知识分开。
- 看见目标的可信几何按声明观察成员与其身体格求 LOS；核心默认观察者，头等可声明额外观察者。先最近／边界候选短路，不把 NPC 多源 FOV 写进玩家探索；若能力需要 mask 则懒建并集。独立感知判定默认群体一次，不能八眼投八次警觉骰。局部机关感应另有显式状态 profile／能力，不是任意成员自动全知。
- 隐身按 profile 归属；气体只显影实际可公开接触格，其他腿／墙后核心不一起画出。telepathy/entranced 沿现有身份与位置知识区分，不能直接曝光完整拓扑。全组潜水隐藏用 §5.3 的 all 谓词，不把一条触手潜水当作全组消失。
- 气味／潜行取相关 footprint 最近距离及 awarenessDistance 摘要，再一次原概率决策；保留 Scent 尺度。合法核心邻步／落脚方案用同一可通行谓词，不让每腿 scent 投票越墙。噪声／警报图对组内相关格取 min，只唤醒核心一次，不创建新全局声音系统。
- 光遮挡覆盖实际实体足迹，孔洞不挡。默认全组一个发光原点，取核心稳定合法格；局部发光部位需明示光源且预算化，不按面积复制 RNG。普通 1×1 原点与采样保持。
- D07=A 下支配／魅惑等不因 Boss 或体型额外拒绝：成功时原子改变整体关系，成员保持一队。P4-D03 现只决定是否**自然生成**大型盟友／俘虏与相关内容，不再提供 Boss 身份免疫。首批推荐只自然生成敌对者；被玩家转成盟友后仍能即时战斗／待命，遇窄道绕行或停留，不强行交换／追层；应明确提示无法跟随的空间原因。

底座 faction/isAlly 不与尺寸绑定，关系事实一次发整体语义并让成员查询一致。后续自然盟友、全部成员锁链／救援与宽入口跟随内容需补独立验收；原生 leader/follower 保留其用途，不拿它们兼任 bodyGroup。受控 entranced 位移、discord 与普通盟友 AI 均使用已交付空间计划，不能留一条腿被迫走出区域的半转换。

## 8 形状 × 朝向寻路与性能

### 8.1 位姿图与缓存

对每个 `(anchor,pose)` 建合法节点，`fit = AND(tilePolicy(anchor+offset))`；平移八邻边按 §4.1 检查，旋转边按编译扫掠 mask 检查并给明确正代价。单朝向方形仍为原锚点图；矩形可滑窗／前缀和 O(WH)，一般 mask 直接 O(WHKA)，K 是实际占格数、A 是有效位姿数；不把凹形的整个包围盒当实体。危险路径代价取占格最大有效代价，不把面积和代价相加默默倍增行动 tick。

目标是可合法攻击目标 footprint 的多个位姿零源；等权 BFS，有旋转／地形权重用 Dijkstra/A*。NPC 逃跑、安全、waypoint、闪现／跨层落点均接位姿图；玩家仍1×1，只修新障碍输入。`Creature.mapToMe` 不含 traveller 形状，MonsterBlink 的“目标离开原图值≤3才刷新”也不足用；新图独立缓存，不覆盖原图，不拿单格 safety/waypoint 偷代替。

| 缓存 | key | 失效 |
|---|---|---|
| 地形 fit／代价／旋转边表 | grid 身份、形状及 zone/pose 指纹、通行／免疫／状态指纹、区域、terrainRevision | 门／DF／晋升／液体／影响避险的气体类型、形态／位姿资格／边界变更 |
| 距离／目标图 | 上项＋目标实体或群体 footprint revision、目标类别、危险 revision | 目标成员移动／破坏／再生／变形／死亡；不用旧“值3”近似 |
| 动态规划／成员局部解 | 上项＋occupancyRevision、参与搬移集、约束／群体能力 revision | 占位、支撑／连接变化；通常临时检查，不为每腿永久缓存全图 |

每当前层最多 8 组缓存（整组含 A 个姿态切片），LRU 只影响速度、不影响选路／平局。共享静态图不把移动小怪永久变墙；下一步验动态完整身体并作一次有界重规划。组路径只保证核心乐观通行，成员解在 §4.3，不能为其全部排列建指数级距离图。

现 invalidatePathing 仅局部 loopMap/safety；必须接统一地形 mutation 通知，覆盖 Grid.setTerrain、直接 layers 写＋refreshTerrainProperties、门／钥匙／Promotion/DF、部位残骸和环境。volume 变化没有浓度公式时不无条件刷新图；type／危险资格改变才刷新。成员移动只推进动态占位与相关目标 revision，不重建全部静态表。load／换层／rollback 丢缓存，revision 不持久，恢复真相后选路应一致。无能力使用者时不启用数组、计数或失效扫描。

### 8.2 建议硬上限与退化策略

| 项目 | 推荐上限（P4-D12） | 超界行为 |
|---|---:|---|
| 单实体实际形状格数 K／包围盒边 | K≤16，单边≤16 | 校验拒绝；容纳长条／L／十字，正式内容仍先2×2、3×3 |
| 物理位姿 A／旋转扫掠格 | 通常 A≤4；含镜像最多8；单边旋转 sweep≤256格 | 数据预编译检查，过大拒绝，不截断旋转弧 |
| 每组成员数／总物理占格 | 核心＋外围≤17（外围≤16）；总格≤64 | 创建／转换／读档全部拒绝；足够八腿、九头、16节蛇样例 |
| local zone／组总 zone | 每实体≤8，整组≤32 | 拒绝，不把每像素自动升成部位 |
| 成员候选／约束回溯／攻击束 | 每成员≤32候选，≤128回溯节点，≤4攻击子段／激活 | bounded blocked／减少预先声明的束，不执行一半后跳过 |
| 活动层新能力实体／占格总预算 | ≤128实体、≤512格，仍受原生实体全局预算 | 防复制／召唤指数膨胀；失败不抢 ID，不缩成员 |
| 群体观察 LOS 工作 | 每感知摘要最多128候选格对 | 观察成员／格从定义稳定选定，预算不足不改变选集；必要时下一激活重试，不能随机抽眼 |

上限是推荐，确认后成为版本化校验而非运行时随机器速度裁掉身体。128 格对的观察策略须在感知定义就固定候选集／采样规则，不能按帧耗时提前放弃导致不同设备敌人视野不同。一般刚体≤16格对玩家只有16对；组对组最坏64×64，先空间下界与固定观察集合裁减，需另验极端场景。

4a 的内容／运行开放只限 square-2／square-3，4a0 fixture 可有任意掩码；4b 后 K≤16 的通用 mask 可表示4×4，但本阶段无正式4×4场地／内容。此处取代初稿全底座拒绝4×4的限制，理由是通用格数预算更合适；不能把任意形状支持写成首批已提供4×4敌人。

### 8.3 成本估算与实测要求

地图仍79×29=2291格。方形 r0 快路径的候选上界2×2为2184、3×3为2079，直接格判定8736／18711次，八邻图约1.75万／1.66万边。一般 K=16/A=4 上界9164节点，fit约14.7万格判定，平移＋左右旋转≤约9.2万边；A=8 最多18328节点，操作量约翻倍，旋转 sweep 需编译／缓存，不能每边实时浮点动画采样。BFS O(V+E)，正权堆 Dijkstra O(E log V)，这是估算，非毫秒／FPS。

占位索引用 Int32 索引编号＋zone标签数组约14 KiB／层，编号查稳定 entityId／groupId，不能截断超Int32的实体 ID。fit Uint8＋cost Uint16＋distance Int32 每pose约16 KiB；8组×4pose原始数组约500 KiB，8pose约1 MiB，另有旋转边表、JS堆、临时规划和渲染。初稿150–250 KiB只适合单朝向方形，不再当通用上界。群约束每次最多128分支×有界成员／候选检测，不承诺线性求得全构型最短路。

实测无能力局、1/4/8个2×2、1/4个3×3、4种L／十字／长条姿态、1/4个8腿组与16段蛇；覆盖追击、堵路、开门、气体、旋转、不可达、断腿／再生与分裂。报告命令P50/P95、索引／图构建数、缓存命中、约束节点、RNG、分配量和渲染帧；无能力新增索引／图／约束求解为0、实质RNG增量0、机械图相同。新增空间计算P95≤5ms仍只是调优目标，最终设备预算待确认，不能为达标改随机／跳伤害或放宽正确性断言。

## 9 刻符渲染、目标与移动端

推荐 **实际掩码轮廓 + 每个刚体一个主字形**（P4-D05）：刚体绘图组按实际格边画细线／低亮填充，中央稳定合法格放一个字形；L形缺角、十字凹边、长条和孔洞都保留地形，不画包围盒填充。局部可见裁切到公开格，主字形移至稳定已见格；不能放大到遮住足迹外危险。四种地图共用几何，模式只影响字形，不影响命中。

复合体用核心主字形＋成员的小字形／端点标记，连接线仅在两端及路径均可公开时绘制，不能跨黑雾暴露核心。脚步／触手轨迹来自已提交历史帧的成员路径；动画可插值但不提前移动机械占位。固定 zone 选中时用局部细框，破坏用残缺边／破坏标记，颜色之外保留文本标签；小尺寸屏幕不在每格叠 HP 数字。

未完全看见时不画完整矩形外框或未见尾格；选中目标边框也被公开格遮罩裁切。相邻火/气/机关仍可辨认，接触格局部闪烁表示本次受击；HP 浮字每实体/效果一次。轮廓属底座呈现，Boss 内容色彩/字形/血条属模块。首版不需要图片资产或图生视频。

- **侧栏／附近列表**：一个 group 一条 row（单体即自身），显示公开形状简述／整体状态；展开仅列已知部位。排序用已知身体最短距离，row.loc 是稳定公开检视格，不给隐藏锚点。共享 Sidebar、ThemeNearby、ContextPanel 同一 DTO；若只见腿，名称／主 HP 仍受知识门槛，不用“聚合”泄漏核心。
- **Boss 血条／部位检视**：giants HUD 贡献一条名称＋核心 HP 条，当前目标优先、其次最近已知 Boss；看不见且未获准知道核心血量时只给已知目标标记，隐藏主 HP。选中部位可加一条局部 HP／护甲／弱点／破坏状态及对整体影响；其他已知部位用紧凑摘要（如“已知腿 3，已毁 1”），不透露未见总数。桌面检视可展开列表，手机默认只显示当前部位并可循环切换；字段缺权限则不显示，数字／名称全走 locale。
- **桌面与手机**：血条沿 HUD 流式排布，390宽两行、320宽名称省略／HP紧凑、保留条形进度，不强制镜头缩放。实际部位格可点选，右键／长按直接检视当前部位＋整体公开摘要；窄屏用附近部位列表辅助选择1格腿。投掷／法杖保持“瞄准→确认”，同组另一格或另一部位是改目标，不能直接确认；破坏／再生后旧焦点清理或迁到合法公开部位。
- **显示时序**：`displayProjection`/`DisplayFrame` 捕获公开 bodies 与模块 hud DTO，`presentationTimeline` 使用同一历史帧；不能在旧伤害消息等待期间用 game.monsters 的新 HP/新坐标画血条。忙态沿 D3 presentationHidden 约定，不新造弹窗或输入屏障。
- **录像/seek**：回放同样读取当前回放世界投影，无等待动画的机械要求；seek 清旧 body 绘图组、血条、hover、目标描边，再投影目标 checkpoint。显示缩放、绘图资源与血条焦点不进入机械存档。

未来阶段 3 的预警层在地形之上、身体与目标轮廓之下或使用明确独立边框，不互相覆盖颜色含义；本文只规定通用层/遮罩入口，不实现预警。

## 10 场地生成与模块落地

### 10.1 首版场地合同

推荐可绕开的侧室场地、守场 Boss、入口开放（P4-D02/D06）；不自行决定内容名称、生成深度、数量、奖励或强制通关路线。下表是供实施 fixture 与首版模板起步的原创几何参数，正式内容密度待确认。

| 体型 | 最小净空矩形（不含墙） | 一般通道 / 本地入口 | 必须验证 |
|---|---:|---|---|
| 2×2 | 12×10 | ≥3 格宽、门洞同宽；不能用一扇普通门卡掉第三列 | Boss 出生离边≥2 格；玩家有连续绕行空间，锚点图可达到入口内侧与主要战斗区 |
| 3×3 | 16×12 | ≥4 格宽、门洞同宽 | 同上；用 3×3 图实际验证，不能以玩家 flood fill 代替 |
| 4×4／其他形状／复合体 | 不提供首批正式模板 | 4b后通用掩码可表达4×4；任意形状以实际位姿可达图验证，复合体另验落脚／约束 | 后续 authored 模板须验证旋转空间、成员活动范围与玩家绕行；仅面积够大不成立 |

场地边界和出生/巡游锚点区分：净空矩形保证 fit，spawn 周围至少两格缓冲，玩家出生/楼梯不能落在 Boss 身体或直接相邻杀伤区。计算玩家出口连通、Boss 锚点可达集合、可绕行的玩家格带和无堵死楼梯，不仅检查房间面积。装饰柱/水/陷阱只能放在验算后仍满足合同的模板变体，失败不用缩水通道。

守场方案将通用 movementBounds 设为该场地净空：行走、闪现、随机传送、拉拽/击退都不能越界；外面的玩家不会使 Boss 卡在追击窄道，可在无合法场内攻击位时回归。边界不是无条件减伤/穿墙攻击，也不强制给 Boss 远程招式。坠落是一种楼层所有权转移，不能留一个旧 depth 的边界：底座转移时清该局部边界，并由 giants 记录 escaped/lost 绑定状态，采用通用 native AI；下一层不凭原 arenaId 复造场地。首版场地不放渊，此异常仍用 fixture 覆盖。自由追击选项则不设置 bounds。

### 10.2 接入点与事务

当前 `Architect.generateLevel` 顺序为 generateTerrain → traps → BlueprintEngine machines → autogen → doors/walls；`GenerationCoordinator.generateDepth` 在 floor-attempt 中建图/放楼梯，随后 populate、恢复坠落者、补算环境、入口/居民恢复。**现有 before/afterLevelGeneration hook 都在外层生成完成后派发**，不能在普通模块 hook 内偷偷改地图，`worldInteractables` 也只有非阻挡叙事对象放置能力，不适合战斗 Boss。

拟新增底座 `GenerationContribution` 声明与有限空间创建计划：

1. 启用模块登记纯模板/候选规则声明，按 priority、owner ID、template ID 排序；静态发现不挖图、不取 RNG。多个模块同时贡献场地时按同一预算/预留规则处理，重叠候选拒绝或选下一个，不按加载顺序抢格。
2. floor-attempt 内，基础地形完成后、陷阱／机器放置前选可附接侧室并保留 mask。模板挖掘、入口连通与实际形状／位姿图验算由底座执行；复合体还要验核心轨迹、各成员落脚与约束，不能以核心可达图声称整组可达。traps、机器、autogen、楼梯、populate 均尊重预留，不填柱或把楼梯放进身体。必要时在 Architect.generateTerrain 房间阶段加可附接净空，不事后覆盖机器。
3. 同一 generation transaction 内，成功模板形成底座 owned region 和受控出生意图；楼梯／填充／坠落恢复／首次环境补算后再验全体落点，发布 Boss 与成员到原生列表／占位。每个实际实体有一次可信 creatureSpawned，并携 groupId／partId／奖励归属；整体有一次 body-created，不能给每腿重授核心预算。之后才发 committed/enteredLevel。
4. 最终一遍验证区域及落点；模板失败在本次候选预算内确定性换下一候选，预算耗尽 skip，并记录原因。建议每层≤1 场地、≤16 候选尝试作为首版性能预算（待数据确认）。不为 Boss 无限重生成楼层；若将来强制 Boss 主路，失败须显式生成失败/回滚，而不能悄悄 skip。
5. 生成写集覆盖 grid/layers/masks、owned region、怪物/列表/组件、module state/收据、entity/effect 计数、两流、缓存与显示队列；继承现有事务并扩 `checkpointGenerationWorld` 显式 roots/restoreSession，测试完整对象图及身份恢复。2c 奖励事务不是通用地图事务，不能直接拿来 spawn/挖场地。

owned region 的几何/owner/深度在底座持久世界中保存，giants 的场地结果/绑定/击败事实在自有 state 保存。给 `src/ext/world.ts` 增加区域类型时，原 non-blocking interactable 保持原类型，不把 Boss 伪装成叙事 NPC；可将新区域定义放 `src/ext/spatial.ts` 并由 world/runtime 统一保存/校验。

### 10.3 零生成影响与 drift

未启用 giants 时，不产生 generation contribution、区域/mask、收据或额外取骰；空能力分支沿原生成流程，现有场景的地图、实体、ID 和双 RNG 应完全一致。启用 giants 后可改变房间、楼梯、机器/人口可放置空间和后续随机消耗，这是有意的生成变化，需报告而非保证原地图不变。

4a 方形纵切接场地时及后续任何生成改变均跑 `test:drift`：保留未使用能力组合原基线，另建 giants 开启的原创场地夹具与固定种子 trace。公共生成让未开启组合漂移，先查是否违反零影响，不笼统称“Boss生成所以重录”。按扩展 README 当前政策记录批准变化／重录原因与结果，不强制 CE 源码、旧 CE 全量档或单变量反事实。

## 11 持久化、录像与阶段 3／5 接口

### 11.1 真相的保存位置与版本

| 内容 | 保存位置／归属 |
|---|---|
| loc／form／HP／成员局部状态、可选 spatial／pose／zoneState／bodyMember／actionLockInTicks | EntitySnapshot 生物 codec，覆盖当前／缓存／休眠／携带／pending／purgatory；底座字段不塞 giants:* 或 growth:* |
| 群组、成员 ID／槽位／generation／冷却／破坏／再生记录及所用通用定义 | 拟新增可选 `WholeRunSnapshot.run.spatialWorld`（schema=1，groups＋definitions）；原生根，无 ExtensionRuntime 也可保存 fixture。未使用省略，不存全局索引／revision |
| 区域几何、owner／depth／instanceKey | 保留 `extensions.foundation.world.regions` 作为唯一真相；仅使用模块 owned region 才需要扩展包络，spatial 只保存引用 |
| 生成收据、Boss encounter／主体与分裂后裔绑定、defeated/escaped/lost | `extensions.modules.giants`，state schema=1；giants:boss 只存内容／公开标记，不复制 HP、坐标、zone 或群表 |
| 形状／身体／破坏／状态／转换定义身份 | 当前启用模块 rules 指纹或 foundation 内建规则版本；snapshot 的所用定义表为 codec 解析而非绕过 manifest 的替代品 |
| 占位、位姿图、空间 revision、contact scope、暂存计划、绘图与检视焦点 | 派生会话状态，不保存；load／rollback／seek 清理重建。跨命令阶段3攻击计划是它的持久状态，不放入此行 |

原生 spatialWorld 根是 r2 对初稿的补充：群体必须在没有扩展 runtime 的底座 fixture 中工作，也不能只靠模块私有状态救回实体成员；区域仍保持原所有权路径，不重复迁移。定义表每 ID 一份，覆盖实际使用的 footprint/body/profile/break 引用闭包，按预算规范排序；foundation fixture 的定义必须来自测试原生目录／确定性初始化端口。模块 owner 的定义必须与已启用目录和 rules 指纹一致，未知／缺模块形态不能只靠 snapshot 内自带 JSON 偷载。旧形态暂时不用但待再生／计划有引用也纳入闭包。

```ts
interface GiantsState {
  schema: 1; revision: number;
  placements: { instanceKey: string; templateId: string; depth: number;
    result: 'placed' | 'skipped'; regionId: number | null;
    reason: 'no-space' | 'budget' | null }[];
  bosses: { encounterKey: string; primaryId: number; spawnDefinitionId: string;
    instanceKey: string; regionId: number | null;
    subjects: { groupId: number; status: 'alive' | 'dead' | 'lost' }[];
    status: 'alive' | 'defeated' | 'escaped' | 'lost' }[];
}
```

推荐 placement／Boss记录各≤128，subjects受实体与后裔预算；instanceKey／encounterKey唯一。分裂原 encounter subjects 增加结果，复制不默认加入；变形保留主体身份与 spawnDefinitionId，不能因变老鼠视为死亡。defeated 只在所有绑定主体实际死亡时一次成立；行政退休／永久丢失记 lost，不能算击败。escaped 是仍活但离场，重访/load不再生新Boss。历史死亡ID不是GC保活根，live成员必须由群体根和实际机械所有权共同可达。无玩家giants命令时不虚设 input schema，未来再加严格版本与 prepare。

第一次底座迁移建议实体／whole-run version2→3、whole-run schema v2→v3、录像 version2→3、foundation3→4，manifest.schema仍1；第一次就包含通用 mask、pose、zone、group 身份与可选群表布局，之后能力开启不重迁入口。未实施的能力先显式 capability 拒绝；后来改变模拟／新增已开放布局仍升级对应规则／格式版本，不能承诺预留字段使任何后版旧录像兼容。若阶段3先占号，合并时统一下一版本，不能两份不同foundation4。

giants正式首版拟为1.0.0，rules `{schema:1,version:'1.0.0',fingerprint:…}`；只有启用列入manifest。保留descriptor声明底座兼容，各模块自身规则／数据变化才升其module/rules，不以兼容声明假称内容升级。旧档/录像不迁移，旧版本／缺模块／禁用／错误指纹在退休旧局前 i18n 明确拒绝，不剥状态继续读。

新增Game机械实例字段必须登记 `scripts/u03-state-contract.json`；原生空间世界若由Game持有就登记初始化／清理／save合同，不能因服务在WeakMap而漏登其真实机械根。生物显式字段清单／copyForClone／codec／U01同步可选字段缺席语义；新局、死亡、移层、purgatory、load、回滚和seek的群引用清理一起覆盖。

### 11.2 读档、确定性与篡改拒绝

纯验证版本／manifest／JSON／预算 → 解码完整实体与定义引用 → 构建群表和实体ID边 → 按当前／缓存／休眠／携带／pending所有权分层 → 验mask／pose／zone HP、核心、每成员唯一群、约束树／槽位／generation／破坏收据／非负成员冷却与有界正行动耗时、玩家1×1、区域、活跃重叠 → 建候选索引／调度视图 → 全部成功才退休旧局。load不发出生／破坏／转换／死亡事实，不消费RNG。

群所有活跃成员与核心同层同生命周期；破坏墓碑允许 entityId=null，但不能有悬空活引用；inert-body有显式物理残体资格，不能被普通死亡 sweep重结算。缓存层分别验，当前镜像缓存不重复索引；pending全组保存未放置状态，不强验为当前层fit。环境可改变地形使既有合法身体暂时受阻，读取必须验证位置／所有权／重叠及允许的机械状态，不能一概拿当前canFit=false拒绝；预期位移／出生仍不得提交非法fit。

NPC仍在advancementLoop内，玩家每输入经executeCommand/executeItemCommand，不能为每条腿录虚构玩家命令。保存只在现有安全回合边界，无半执行子动作束。扩展checkpoint保存包络，原生空间摘要按entityId／groupId／zoneId规范排序，含shape/pose/层/区域/成员拓扑、HP／局部状态、破坏generation、readyInTicks/actionLock、pending；可用有界规范hash和诊断片段，不把完整未见机械表给UI。无能力不添加摘要；续录origin最终检查点同时校验。

逐条replay与seek通过真实命令重建，成员顺序、目标去重、约束求解、抽样、ID和回滚全部确定，LRU不改结果。切点覆盖旋转、断腿、蓄力来源被毁、再生等待、单体↔群体、分裂、多体复制、pending／死亡／入层收据，save-load→续录最终完整机械图／引用／两流／收据一致。篡改mask／pose／共享成员／循环连接／错误owner／zoneHP／收据generation／超预算／规则hash在旧局退休前拒绝。fixture用相同测试原生初始化／生成端口确定重建初始世界，不把调试注入后的录像冒称默认生产新局能重放。

### 11.3 与阶段 3 的软接口

两模块只硬依赖底座；阶段3不import giants、不假设size=1或每个Monster都有独立调度。以下协议为待对照设计，无阶段3时即时攻击／断部位照常可玩。

| 提供／期望接口 | 语义、归属与缺席行为 |
|---|---|
| 可信发起成员几何 | actorId→entityId/groupId/partId/generation、足迹／pose/revision；玩家公开DTO另裁切。多头攻击必须指定发起头，腿砸指定腿，不总从核心左上发射 |
| 相对攻击形状 | 预警格=`(发起成员足迹 ⊕ 攻击面向变换的相对格集) − 声明的自身排除集`，再按LOS／范围裁切。source mask只取该成员；射线从合法边缘接触格发出，不自动为每占格造独立射线／攻击 |
| 命中键与作用域 | 阶段3交子段格集合＋EffectTargetPolicy，底座按 §6 收集；多次挥击显式新scope，成员束中独立头也各有scope。共享费用／成长消费不按预警格数增长 |
| 计划绑定与取消 | 持久计划记发起成员ID／generation／footprint revision、groupId和阶段；破坏／退休必取消对应来源计划，不能改由核心补射。移动／旋转／换形时阶段3选择cancel／重新预警／锁定世界格，计划与实际命中使用同一政策 |
| 调度／actor-native耗时 | 阶段3在核心激活推进子动作，不额外调成员、不调用playerTurnEnded。需扩现有玩家专用ControlledAction适配器，返回不落账的NPC原生结果，群协调器唯一落账；currentTick不是NPC精细模拟钟 |
| 可选攻击profile／硬直provider | 版本化冻结profile（拟combat.attack-profile.v1）缺席用native攻击；拟combat.part-break.v1接resolution／破坏收据／balance-loss，可给韧性损失或硬直意图。多provider在注册预检拒绝，不依赖加载顺序 |
| 部位破坏平衡降级 | provider缺席用数据fallbackStunTicks写核心actionLockInTicks（一次收据，真实soonestTurn递减），取消被毁来源攻击／必要时剩余束；不虚设韧性槽、不持久阶段3字段。纯部位移除／无balance-loss时只取消自身子段 |
| 同帧呈现 | 身体／部位HP／预警/来源标记共用公开DisplayFrame；只画获准知道格。阶段3拥有预警颜色／时序，giants拥有内容血条／部位摘要，不另造弹窗／输入屏障 |

若预警期间成员位移改变发起足迹，阶段3必须明确新预警的时机与是否重新给反应时间，不能临命中无提示重定位。阶段4提供revision与取消事实，不替阶段3猜蓄力规则。软provider只读计划＋有界受控提交，失败与body transition同边界回滚；不能用2c奖励adapter改地图或推进一次额外时间。

本阶段不实现体力、闪避、弹反、篝火、掉魂／复活循环；韧性联动缺席有上述明确替代行为。叙事／成长可选Boss事实／奖励仍走底座事实或协议，不扩现有单storyFact消费者为未设计的多消费者总线，不把Boss defeat变为剧情必需。

### 11.4 阶段 5 复用扩展点

部队编队可复用形状／位姿图、group身份、核心统一计划、成员目标与伤害粒度、约束和部位损耗修正；刚体表示整体占格，复合体表示分散兵员／队列。编队可引用不同约束profile，而非在giants里复制空间系统。阶段5是否需要跨地图尺度、独立士兵调度／士气／更大成员预算仍需单独设计，当前17成员／64格预算不承诺军队规模。只记录复用方向，不定义阶段5模块、战场或世界模拟。

## 12 产品待决与已决定事项

**r3 维护者决定（2026-10-05）**：D01–D06、D09–D16 均采用推荐 A；D07=A；D08 按下表“已决定”行（范围伤害也按部位）。另：移动受限问题以“场景生成保证符合巨大怪物体型”为设计基准（见 §4.3、§10），开发期门禁改为功能测试、完整测试留到收尾（见 §14.1）。**D07=A 已由维护者决定**，不再征询Boss免疫；其余正文按推荐假设展开。原子性、明确去重键、唯一机械真相、确定性和只硬依赖底座是技术合同；可选的是分类默认／数值／内容边界，不能关掉合同。

| 编号 | 选项 | 推荐与理由 |
|---|---|---|
| **P4-D01 首次授权边界** | A 先4a0，验收后逐步授权；B 连续授权4a0–4a方形纵切 | **A**：先通用身份／入口迁移再内容，4a0未开放功能明确拒绝。B可加速，每步仍独立full／报告，可在4a停下 |
| **P4-D02 场地与追击** | A 可绕开侧室、全身体硬守场；B 侧室出生，自由追击；C 主路必经与封门 | **A**：模板／落脚可控、失败skip。边界适用于转换结果但不是免疫；B要验长条转弯／成员追层，C要定撤退／必达设计 |
| **P4-D03 自然关系内容（r2更新）** | A 只自然敌对，无自然大型盟友／俘虏；B 加自然盟友，无俘虏；C 三者都生成 | **A**：保留内容取舍，**所有项都支持D07要求的通用支配／关系转换**，不再提供Boss额外免疫。B/C扩大跟随／锁链／救援与UI验收 |
| **P4-D04 危险边缘** | A 任一格环境接触，全部有效支撑无地才坠落；B 任一核心／支撑格跨渊就整组落；C 环境只看核心主格 | **A**：身体接触有意义且可跨小裂隙；复合体局部火／熔岩可毁腿，核心致死仍终结。B更危险；C忽略可见肢体危险不推荐 |
| **P4-D05 刻符身体显示** | A 实际掩码轮廓＋刚体主字形，复合体核心＋部位标记；B 可见裁切的放大字形；C 自有拼图／图块素材 | **A**：凹形／断腿与320宽清楚，无新美术；B易盖地形，C需资产和四地图降级方案 |
| **P4-D06 首批规模／密度** | A 4a先一个2×2＋侧室，再独立3×3；B 4a一次两体型多模板；C 常规horde生成大怪 | **A**：纵切可验可停；名称／深度／属性／奖励／出现率在4a内容实施前定稿，不沿旧4d延后。复合体样例另随4d授权，不默认全做 |
| **P4-D07 Boss转换资格：已决定A** | A 不因Boss身份额外免疫；含被动变形／复制，以及主动换形／换体型、单体↔群体、分裂／复制／召唤自身副本 | **已定**：能力走通用原子计划；无空间是明确失败，不是假免疫。招式是否编写和数值另授权，不保留B/C免疫备选 |
| **P4-D08 效果默认去重键：已决定** | 维护者决定：近战、投掷、射线、横扫／矛／鞭、爆炸／火球等范围伤害均 **part**（碰到的每个部位各一次，同一部位多格仍一次）；仅针对整体的精神／身份效果（否定、纷争、魅惑、恐惧、普通变形等）**group** 一次；地形／气体暴露按 entity 再按状态 owner 合并；击杀／XP 按 group 一次 | **已定**：大体型更容易被范围攻击多处命中是有意设计，靠部位 HP 与 D09 传导比例调平衡；招式仍可显式覆盖并写入规则指纹 |
| **P4-D09 部位伤害传核心** | A 固定local zone1:1、外围成员1:4；B 所有外围0，主要靠破坏修正；C 所有外围1:1 | **A**：打腿推进整体战斗，仍鼓励打核心；直接核心HP不自传，有理数数据可配置。B易成纯拆件耗时，C横扫多腿削核心快，需重调HP |
| **P4-D10 破坏后的成员** | A 默认remove＋槽位墓碑；B 默认inert-body占位；C 默认debris地形 | **A**：占位和手机最清楚，固定zone默认保留身体。B/C作为显式扩展；B需残体移动规则，C需连通／机器写集和drift |
| **P4-D11 物理朝向** | A 4b支持4向旋转、暂不开放镜像；B 形状均固定朝向；C 同时开放镜像姿态 | **A**：长条窄道有真实转身，扫掠明确；方形仍r0无额外成本。B省功能但内容受限，C需另定翻身动作而非免费换pose |
| **P4-D12 预算** | A 采用§8.2上限（16格／4或8姿态／17成员／64组格等）；B 首版外围≤8、总组格≤32；C 放大到32外围／128组格 | **A**：覆盖八腿、九头、长蛇且有界；B调试更小但少扩展样例，C应先有实测，不仅改数字放行 |
| **P4-D13 部位再生** | A schema预留，首批不启用；B 4d就交有次数上限再生；C 所有部位无限再生 | **A**：断部位闭环先完成，未来新槽generation／ID有合同。B需正式再生时钟／落点／录像验收，C不推荐且仍受实体预算 |
| **P4-D14 多部位攻击节奏** | A 核心激活最多4子段，并行束耗时取max；B 同样唯一核心但全部串行求和；C 首个复合体只允许一个部位出手 | **A**：支持九头蛇多头威胁且上限明确，成员冷却独立；B总回合慢，C内容保守但底座仍接受有界束。独立成员全局调度不是本版选项 |
| **P4-D15 全部支撑部位被毁** | A 默认immobile，保留可用攻击；B collapse＋短硬直后匍匐减速；C 整体死亡 | **A**：破坏收益可理解且无必需阶段3；可按身体定义覆盖。B需匍匐姿态／移动与落位内容，C容易用断一脚秒杀需明确检视 |
| **P4-D16 打成员的普通变形** | A 对整体变形；B 只变命中成员并维持约束；C 每个招式显式选择，无默认 | **A**：沿既有物品“变一只怪物”，单体↔群体统一；B需要局部替换/断连接/HP政策，不能初次就留下半组。C作者负担高，可后续局部招式明示覆盖 |

giants开局默认是否勾选仍用模块选择器可配置入口，建议开发验收默认不勾选；正式组合／数值留维护者后续统一定，不顺带改菜单。D07不会自动授权全部复合体内容或后续步骤实施。

## 13 与阶段 3 对照用的共享文件触碰清单

规模为**设计估算**：小≤约100行有效变更，中约100–300行，大>300行或多分支迁移；不承诺最终行数。路径下未列出的实际发现点要在实施报告补入清单。优先共享底座接口，避免阶段3/4各自引入一套 actor geometry、AoE 命中列表和耗时提交。

| 共享文件 / 范围 | 改动性质与规模 | 与阶段3的协调点 |
|---|---|---|
| `src/entities/Creature.ts`、`Monster.ts` | 可选通用spatial／成员身份／zone与状态路由，中；Monster构造／移动／受击／复制／变形／AI迁移，大 | 共用actor／part来源资格，takeDamage/die先截获局部破坏，copyForClone不得共享新容器；不加魂系私有字段 |
| `src/engine/Core/Game.ts` | 空间服务接线、查询/位移/武器/地形/目标/生成/持久，多处大改；预计数百行至千行级迁移，应按函数拆步 | **最高冲突**：受控行动、风险预检、近战几何、击退、NPC决策、录像checkpoint；先抽空间接口再分别接内容 |
| `Core/TimeCoordinator.ts`、`Systems/Time.ts` | 调度三处改核心视图、成员剩余冷却／actionLock递减、群与局部客观块，中至大；Time仅核对簿记不当NPC绝对钟 | **高冲突**：同tick子段／多回合计划／暂停，核心一次耗时提交，成员不能0tick卡循环 |
| `Core/MonsterLifecycle.ts` | 群拥有关系、part-retire／残体资格、核心单次终结，中至大 | 破坏／形态退休与真正死亡分流，取消来源计划顺序一致，不能administrative kill代替移除 |
| `Movement/CreaturePlacement.ts`、`LevelTravel.ts`、`Entrancement.ts`、`Submersion.ts` | 整体落点/恢复/水下判据，中至大；`PlayerTravel.ts`只修大型障碍端口，小 | 闪避/冲刺与击退共用canStep/commit；不能两方重写placeCreature |
| `Combat/Combat.ts` | 邻接／成员与zone接触上下文、实体／部位／群键命中、原始／传导事实与费用，中至大 | 命中／反伤／抓持／韧性同序；现存两解算器消费点均覆盖，不顺便合并；传导不多消费一次攻击 |
| `Combat/MonsterAI.ts`、`MonsterBlink.ts`、`MonsterAbsorption.ts` | footprint距离、可达、感知、缓存，中至大 | NPC选技与原生行动适配；巨人无phase3使用同一native AI |
| `Combat/BoltTrajectory.ts`、`Bolt.ts`、`BoltTargeting.ts`、`BoltReflection.ts`、`Cloning.ts`、`Conjuration.ts`、`Polymorph.ts`、`Domination.ts`、`CreatureFeatures.ts` | 占位／三种目标键、整组复制／分裂、纯形态计划／关系路由，中至大；轨迹纯几何保留 | 远程来源部位／反射scope／D07共同资格，1×1旧重访明确；模块形态不得硬导入 |
| `Map/Pathfind.ts`、`Pathfinding.ts`（含DijkstraMap）、`SafetyMap.ts`、`Scent.ts`、`WaypointMap.ts` | 形状×位姿边／旋转代价、目标集合／群感知，中至大；旧1×1路径保留 | 冲刺／成员落脚／威胁图／预警可选代价；核心乐观图不能替代全组约束解 |
| `Map/Grid.ts`、`Promotion.ts`、`DungeonFeature.ts`、`Environment/Gas.ts` | 变更通知、DF作用域/身体暴露接口，中；不新增生物真相Cell位 | 破坏地形与范围技能必须通知同一revision |
| `Lighting/FOV.ts`、`LightMap.ts`、`UI/MonsterVisibility.ts` | 足迹LOS/遮挡/隐藏摘要，小至中 | 预警可见裁切与目标知识，勿把NPC FOV写玩家探索 |
| `UI/MonsterSidebar.ts`、`Appearance.ts` | 唯一entity row、公开格外观，小至中 | 状态图标/韧性条各模块贡献，底座row保持通用 |
| `Core/GenerationCoordinator.ts`、`Generator/Architect.ts`、`BlueprintEngine.ts`、`GenerationPlacement.ts`、`Stairs.ts`、`Map/AutoGenerator.ts` | 通用贡献／掩码／全组出生／预留、实体图写集与restoreSession，大；`Items/ItemSpawnHeatMap.ts`只排除端口 | 篝火／场地共预留；群表、定义根、成员引用与缓冲事实纳入checkpointGenerationWorld，不能只比较存档投影 |
| `Core/EntitySnapshot.ts`、`WholeRunSnapshot.ts`、`LevelSnapshot.ts` | 通用字段／成员图codec、原生spatialWorld根、分层／拓扑／预算验证、版本、pending群元数据，大 | **高冲突**：阶段3攻击计划／来源generation／格式号；同一组恢复、取消和续录一致 |
| `src/ext/types.ts`、`runtime.ts`、`world.ts`、`causality.ts`、`birth.ts`、`definitions.ts` | body／part／group DTO、状态／原始与传导来源、单次终结／无死亡退休／出生归属、通用定义、区域／GC／窄事务，大 | 当前因果状态以entity为键需显式扩路由；软硬直与共享奖励预算不得重复，2c事务不是任意地图事务 |
| `src/ext/descriptor.ts`、`catalog.ts`、`registry.ts`、`compatibility.ts` | 底座版本与通用能力登记/精确校验，小；保持glob发现 | 不加giants/phase3硬导入；模块版本独立 |
| `src/ui/displayProjection.ts`、`presentationTimeline.ts`、`engine/Core/PresentationObserver.ts` | 历史帧mask／成员轨迹／公开zone／破坏／再生及HUD投影，中至大 | 位置／部位HP／来源预警同帧，旧ACK不露未来，物理隐藏与群聚合不泄漏核心 |
| `src/components/GameCanvas.vue`、`src/ui/retainedMapDrawing.ts`、`mapTileDrawing.ts`、`mapPointer.ts`、`targeting.ts`、`mapTileSemantics.ts`、`nearbyInspection.ts` | 身体组/遮罩/目标交互，中至大 | 身体/预警/目标层、缩放与触控点击协议；不加新物理输入屏障 |
| `components/Sidebar.vue`、`ContextPanel.vue`、`theme/ThemeNearby.vue`、`TargetBar.vue` | 若新row字段需接线，小；优先保持通用消费 | 不在共享组件按模块ID写Boss专用UI |
| `src/ext/ui/types.ts`、`ui/registry.ts`、`ui/useModuleUi.ts`、`App.vue` | 仅当前HUD插槽不足或历史帧DTO接线时增加通用插槽/展示端口，小至中 | Boss与阶段3资源条的并排/窄屏排布；不能必选另一模块UI |
| `src/ext/modules/growth/module.ts`、`skills.ts`、相关view/UI | 空间目标／成员资格、共享预算／出生／击杀／传导贡献消费、中；数额仍归该模块 | **只改消费点，不让底座import growth**；没有growth仍破坏／变形／死亡可玩，删目录改动随之消失 |
| `src/ext/modules/growth/descriptor.ts`、`narrative/descriptor.ts` | 兼容新版底座声明，小；narrative无新增剧情内容 | 与阶段3统一兼容版本，不改历史报告 |
| `src/locales/zh_CN.json`、`content`通用词条 | 底座体型/空间失败提示，小；giants文本在自有locale | 玩家可见文本全部i18n；独立发现/删除仍成立 |
| `scripts/u03-state-contract.json`、`scripts/test-suites.json`、底座ext测试清单与 `src/test/…` | 仅新增Game字段时登记U03；登记底座测试/fixture，中 | 共用状态/录像/生成守卫，不借前提调整削弱有效断言 |
| `scripts/check-module-composition-smoke.mjs`、`check-module-removal.mjs` | 扩真实空间/新模块smoke与通用fixture，小至中；发现式矩阵保留 | 各模块子集及物理删除矩阵自动扩大，不只验两模块同开 |

**新增但不归模块的文件**：§3.1六类文件，另含通用形状编译／旋转sweep、成员约束规划／body transition事务、状态profile／部位破坏修正、生成／形态贡献、footprint exposure、底座fixture与测试。机械群表属于原生持久根而非giants，shape编译表只是缓存。**模块新增文件**仅 `src/ext/modules/giants/**`。r2共享生产候选约80–100个文件，是新增触碰面后的估计，含可能只核对／转接者；最终实改按每步审计清单，不承诺一次改完。原生产目录无须塞原创怪物，测试／格式清单另计。

## 14 分步实施与验收计划

### 14.1 每步门禁与停点

**维护者决定（r3，取代下文与 §14.2 门禁列中的“每步 full＋removal”）**：开发各步（4a0–4e）只做**功能相关测试**——`node scripts/check-module-boundaries.mjs`、`npx vue-tsc -b`、`npm run build`、本步新增／修改功能的相关测试文件与直接受影响的既有测试（含 giants 与底座空间测试、受影响模块测试），以及本步涉及的真实 Game smoke（新局／save-load／replay／seek／续录，只跑相关子集）。**不跑完整 `npm test`、不跑全部 `test:ext`、不跑删除副本 removal 矩阵**；改变生成时跑相关 drift 场景并说明。报告列出实际运行的测试清单与结果，不把未跑的项目写成通过。完整 `npm test`、全部 `test:ext`、全子集 smoke、removal 删除矩阵与 drift 全量统一在 **4f 收尾**执行一次（或维护者另行指定的里程碑）。

以下为原 r2 门禁描述，保留作收尾（4f）时的 full／removal 定义：

获准实施后，每一步最终正常候选树执行 **full（扩展政策）**：`node scripts/check-module-boundaries.mjs` → `npx vue-tsc -b` → `npm run build` → 全部 `npm run test:ext` → 完整 `npm test` 一次 → 所有已安装模块子集真实Game新局／游玩／save-load／逐条replay／seek／存档续录smoke。统一Node24.19.0、3GiB堆、2workers；hash、实际命令／退出码／数量／skip/todo／耗时入报告。不要求ce:fetch/test:full/test:gen，不隐藏已有CE缓存。**改变生成另加 `npm run test:drift`**。

每步另执行实际删除副本 **removal**：删整个所属模块目录／数据／自有测试，清TS/Vite缓存，boundary/typecheck/build/全部剩余test:ext/全部剩余子集真实smoke/缺模块旧输入拒绝；不重复完整npm test，正常full仍必需。沿现有 `check-module-removal.mjs --profile=removal`，证据目录在仓库外；plan、prepare-only、软件禁用、engine-only不冒充物理删除／浏览器实测。首次4a0尚无giants就跑当前已安装目录矩阵，模块加入时自动扩展，不保留空壳模拟删除。

growth/narrative/giants安装后，启用子集8种、目录保留子集8种（7行真实删除）；阶段3若届时安装自动扩16/16，不假定其ID。模块测试归自有test-suites，通用空间／群体fixture归底座并在删giants后保留。每步结束停交维护者，不自动进入下一步／合main／部署／commit。

“可停下”表示已开放能力无占位／行动／保存半成品，已有内容完整可玩；尚未开放的schema变体在创建／输入／读档明确拒绝。4a0仅基础接口和单格生产规则完整，不声称生产多格战斗可用；4a之后每新增能力有独立样例闭环，不用“未来4e会补”解释当前损坏的出生／复制／变形／录像路径。

### 14.2 推荐分步矩阵（替代初稿按子系统横切）

| 步骤 | 交付与可停下边界 | 验收标准／新增测试 | 门禁档位／浏览器人工验证 |
|---|---|---|---|
| **4a0 通用底座一次迁移** | shapeId／mask／pose／zone／group身份、三种目标键、占位facade、所有位置写出口／codec／版本／窄事务接口。生产仍单实体，方形与任意mask只在原生fixture测已开放索引／几何，不解锁复合体行动 | 四尾格同entity/body；L形缺角空／十字／孔洞不占位，part/group键稳定；自重叠／休眠预留／死亡DF窗；实例缺席语义与完整机械图／消息／双RNG无能力差分；clone容器不共享；fixture save/load索引重建；未知未开放能力拒绝；迁移清单逐项判定且消费点不再只拿size／裸loc推整个身体 | **full＋removal**；如公共生成落点行为变更加drift。桌面／320／390普通与沉浸单格游玩无回归；诊断页面查方形／mask尾格与孔洞，不声称已可自然大型战斗 |
| **4a 方形敌人纵切** | 把初稿移动／环境／攻击／视野／渲染／模块场地合成首个2×2可玩闭环：自然生成、即时战斗、血条、通用被动变形／复制／支配、死亡及save/replay。验收后可独立4a-2推广3×3，未交4b也完整可玩 | 宽窄道／对角／自重叠／动态堵路，击退／闪现／拉拽／传送／召唤全落点；环境一次、独立陷阱各触发、重入停止旧格；几何武器／射线／AoE各默认键一次，1×1反射混合原语义；尾格可见／气体显影、感知一骰；2×2↔普通形态无位原子失败；支配不新增免疫；场地净空／绕行／收据／故障完整图回滚，giants-only自然种子击败／存读／续录 | 每个内容交付 **full＋drift＋removal**；当次构建1440×900、390×844、320×844×普通／沉浸，四地图／缩放／部分可见／手机尾格瞄准与确认；自然生成守场、遇火水、击退、复制／变形／支配及血条，不只调试注入 |
| **4b 任意刚体形状与朝向** | 开放通用mask和4向物理旋转、扫掠与位姿图；选一个L／十字或长条原创样例贯通占位／环境／攻击／显示／存档，方形不增加姿态成本 | 凹角／孔洞真实空格，长条窄道转身／墙边rotation终态可fit但sweep不fit拒绝，180°两段验证，标签同步；转向正耗时；目标／图缓存pose失效／LRU不改路径；变形／复制保形状与朝向、save/load/replay/seek；shapeK/A/sweep预算及性能负例 | **full＋removal**，生成模板／自然形状落点改变加drift；四地图轮廓／凹角地形可读，320/390触点一致，旋转与击退反馈、部分可见不画包围盒；纯底座fixture和正式样例分别注明 |
| **4c 固定命中区与部位破坏** | 单刚体的local zone HP／装甲／弱点、破坏表／来源事实／coreTransfer，部位选择和公开摘要；原创带核心区样例可完整战斗，暂不必支持独立移动成员／再生 | 区格多次接触去重、横扫两zone政策、zone HP=0仅破坏一次；直接核心不自传、local传导不重投／重复符文消费／反伤／贡献；弱点暴露与速度修正幂等、破坏不kill/XP/DF；旧prepared目标破坏取消，软韧性provider缺席actionLock有效；zone状态读档／seek/续录、坏HP/标签拒绝 | **full＋removal**，改变形状变体／生成或残骸地形追加drift；桌面精确选弱点、320/390当前部位HP／破坏／摘要不遮地图，旧ACK帧不露新弱点／HP，破坏后选中清理；无growth无阶段3仍可击败 |
| **4d 复合体独立成员** | 核心唯一调度、成员HP／状态／位置／受击／攻击，树约束落脚、有限攻击束、支撑／破坏后整体修正。选一个蜘蛛／章鱼式或九头蛇／长蛇样例；**被动**整组复制／变形／支配同步支持，不能新增Boss免疫 | 8腿／多头／链fixture确定移动轨迹，墙／其他腿／扫掠／牵引受阻及128节点退化、无0tick死循环／重复推进；多成员攻击独立scope／冷却，腿毒火与群精神各一次；两腿横扫各一次、火球覆盖多腿各一次（D08）、群精神效果一次；全腿毁／核心死各政策、XP终结一次；老鼠↔复合体保核心ID／无位全回滚，整组clone全新ID／深拷贝／无奖励复制；移层／pending／残体／破坏时save/replay/续录 | **full＋removal**，自然复合体生成／落点与场地变化加drift；当次构建核心＋腿轨迹、两腿各被击中与攻击、断腿减速／失招／全部断腿、320/390列表选腿／隐藏核心不泄漏；存在阶段3时另验来源部位破坏取消预警 |
| **4e 主动换形、分裂、复制与召唤** | 开放主动转换声明／阶段条件，在此前完整敌人基础上追加换体型／单体↔群体、全批分裂／副本召唤；同一事务复用而非新的size迁移。选有限原创转换招式，非承诺全部内容 | shape/member数量变化、显式保留／映射／退休ID，减少成员无kill；多结果预留其中一体无位全无效、ID／HP／群表／费用／RNG/消息故障回滚；split HP／奖励权利守恒、原encounter一次击败；clone/summon不共享状态、限额阻指数膨胀；已有计划正确取消／重预警；主动失败正耗时；转换前后／等待时save/load/逐条replay/seek/续录 | **full＋removal**，自然出生规则改变加drift；真实战斗触发换形／分裂／副本、窄场失败、Boss条主体与后裔状态、部位减少／增加、长名称窄屏；无阶段3即时行为和可选预警行为分别验证 |
| **4f 收尾与配置手册** | 仅补漏／文档／独立性，不把先前遗漏玩法推迟到此；作者手册列mask/pose/zone/group/constraint/status/break/transition schema、预算和实际开放能力 | 全目录保留子集真实删除，剩余子集新局／save/replay/seek/续录；删giants后全部已交底座fixture仍过，含giants旧输入拒绝；格式篡改／隐知识／不可达性能／缓存层／pending／关系／缺软provider最终矩阵；有阶段3再验16组合及非法/重复provider；再生若未授权明确未开放 | 正常 **full**、删除 **removal**，生成收尾变化加drift；最终当次构建复验六布局／四地图／触控／native与可选魂系，截图与>1MiB原始证据在仓库外，报告设备实测和触摸模拟区别 |

每步可再拆小步，但不能先向正常菜单发布只有占位却不能攻击／保存的敌人。4a2／4b等已开放形态的旧完整链路需继续有效；复杂内容尚未授权就不登记成可随机变出的形态。若4d授权再生（D13=B），该步同时交时钟／无位等待／generation／HP恢复／取消修正／seek负例和浏览器验证；否则在数据和读档能力预检拒绝regenerate声明，不留可输入但无运行器的正式规则。

已有原生能力的组合也算当步闭环：例如4a的Boss被变成果冻后受击分裂，仍要完整预留结果、正确保留／分配ID与绑定终结，不能推迟到4e或增加变形免疫。4e解锁的是新编写的主动转换招式与复杂多体结果，不替早期已有复制／分裂调用补落点安全。

### 14.3 真实 Game smoke 与专项场景

所有正常安装子集均用真实Game.startNewGame及公开executeCommand/executeItemCommand驱动：至少移动、等待、一次合法战斗／物品；保存→加载继续；导出→loadReplay逐条到底；seek0／中段／终点；存档→继续→导出续录。比较机械世界／引用、消息／时间、双RNG和适用收据，不只断言“没抛异常”。

4a0尚无正式giants自然出生时，新增空间专项用确定原生fixture并标明能力边界；不是菜单模块，也不写假manifest。**4a起**每个含giants的子集另有固定种子自然场地闭环；后续新形状／zone／成员／转换分别有专项fixture与授权样例闭环，不能仅注入实体替代正式生成。软能力缺席须实际触发替代行为，不只开关一次。

每步重点边界还覆盖：尾格DF重入、机关导致死亡／瞬移后停旧列表；生成中途throw、乘客释放、无空间坠落；确认等待后成员被毁／形态改变；同一腿多格与两腿相交不同键；core/part伤害归属及真实符文；核心0HP、成员0HP与行政退休不同事实；重复入层／seek不再发XP／收据。

删除脚本／组合smoke发现式扩展，保留底座所有登记fixture，不给删除矩阵额外skip。浏览器使用当次构建，记包hash／视口／设备；没有真手机只标触摸模拟，不能称设备实测；engine-only结果明确未验证浏览器。

### 14.4 交付证据与明确负例

- 坏mask（重复／断开／非整数／无原点／超K）、坏pose/sweep、zone不在身体／重复标签、零分母、超HP／次数、过多成员／group格、循环／跨层／多群共享成员、孤儿核心、重叠、ID/owner冲突、假arena／encounter绑定、player多格、未开放能力、未知模块／版本／指纹均明确拒绝。
- 新原生群根／definition／组件／成员引用全部登记写集与codec；故障验证完整对象图／身份／双RNG／消息恢复，不能只比较save投影。能力未使用局的源基线差分与新能力性能实测分开列，不声称新规则与CE逐骰一致。
- 每份报告列共享实改文件、版本／规则变化、有效测试及任何前提修订理由、基线／trace变化原因、正常full／删除removal的实际结果、性能与浏览器未验证项。未运行长门禁、估算、静态审计或设计验收标准均不能写成通过证据。

本轮只交r2设计稿；上述实施、内容与未决产品选项须维护者另行授权，不修改其他文档，也不commit。
