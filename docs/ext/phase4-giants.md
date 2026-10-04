# 阶段 4：大型敌人设计稿

> **设计稿待审，未授权实施。** 审计分支 `ext/phase4`，基线 `6f837dbf094b42571cd4072ea6ff578a923d7b84`，日期 2026-10-05。本文按[阶段 4 任务书](phase4-design.task.md)编写，所有“拟新增”接口、数值和验收均为计划，不代表已经实现或通过。阶段 3 由另一设计任务推进，本文没有审查其尚未提供的设计稿。
>
> 本轮仅新增本文与 README 的两个审阅链接，不改代码、测试、数据或脚本，不 commit。任务书明确要求纯文档不运行长门禁，覆盖 README 对一般纯文档交付的 full 要求；本轮仅做只读源码审计和文档检查。未来实施各步仍按 [README 当前政策](README.md#当前验收门禁)执行，不能用本轮文档检查代替实施门禁。

## 1 范围与设计主张

一个大型敌人仍是一个 `Monster`、一个实体 ID、一份 HP/状态、一个调度项，方形身体占 N×N 格。先用 2×2 完成底座闭环，再在同一实现上开放 3×3；首版数据校验拒绝 4×4，保留扩大尺寸上限的接口。玩家固定 1×1。本阶段不做分段身体、旋转长方形、身体弱点或每格独立生命。

底座提供空间能力，正式模块建议使用稳定 ID **`giants`**，只依赖底座。模块目录删除后，底座仍能用自有多格 fixture 验证所有空间规则；正式大型敌人、场地数据、血条及专属行为随模块删除。不开启多格能力时，当前模拟、机械状态和双 RNG 调用保持一致；这是一项新的空间能力合同，不把扩展原型重新冻结为 CE 规则。

技术方案采用左上锚点、整体占位与原子位移、按体型的锚点距离图、按实体去重的效果命中。产品选择集中在 §12；正文依推荐项展开可实施方案，维护者确认前不把推荐项视为批准。

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
| 定义元数据 | `src/ext/definitions.ts:18,78–79`：enemy 的 footprint 宽高允许 1–3，但没有多格运行器；`Monster` 构造仍是单格；`CreatureFeatures.creatureFeatureInfo` 的特征表只来自原怪物数据 | 接入经过验证的原生创建/形态贡献计划；已有 metadata 合法不等于已支持多格。方形首版额外约束宽高相等 |
| 活跃占位 | `Game.ts:10895 getMonsterAt` 按 loc 扫描 `monsters`，包括 hp>0 或死亡处理中尚未 deathProcessed 的对象；`Monster.ts:240 creatureAtLoc` 另查玩家 | 尾格查询、玩家/怪物统一 facade；保留死亡效果期间的生命周期语义 |
| 休眠占位 | `Grid.ts` 的 `hasDormantMonster` 与 `Game.awakenDormantMonstersAt`；`CreaturePlacement.canPlaceCreature` 排除存活休眠者，`Conjuration.bladeSpawnLocation` 则不把休眠者当活跃占位 | 区分活跃占位、休眠预留与落点策略。不能把现有不同查询统一成一个无条件 occupied 布尔值 |
| 普通移动/堵路 | `Game.performPlayerActionStages` 的 move 分支（约 3984）、`Monster.tryMoveTo:2184`、`moveEntranced`、`randFlittingDirection`；多个目的地只查一个格 | 整体 fit、对角边、与自身旧格重叠、抓持与挣扎；所有真正生物位置写入改走统一提交 |
| 同伴交换 | `Game.movePlayerPastAlly:8723` 先写玩家/盟友 loc，失败恢复；`CreaturePlacement.allySwapCandidates` 单格搜索 | 多对象原子计划；首版有任一多格参与时不自动交换，不能先移动再发现挤不下 |
| 击退/拉拽 | `Game.processStaggerHit:8470`、`applyWeaponRunicEffect` 中力场位移（约 7652）、`beckonCreature:11789`、`placeCreature:11816` | 推进完整 footprint、接触点与方向、逐步碰撞/落地；不能只检查锚点路径 |
| 闪现/传送 | `Game.finishBlink:11743` 临时把 caster 移到 -1/-1 并搬走潜水者；`teleportCreature` 与 `teleportCandidates`；`MonsterBlink` 多张单格图 | 显式忽略实体的占位预检替代临时假位置；完整落点过滤、同格命中与传送候选规则 |
| 召唤/克隆/分裂 | `Game.spawnHordeAt`、`summonMinionsFor`、`cloneMonster`、`trySplitMonster`；`Conjuration.bladeSpawnLocation`、`Cloning.cloneLocation` | 不仅大型者的出生，也要防小召唤物落到大型者尾格；批量预留、防重复 ID 和预算 |
| 变形/关系 | `Monster.polymorph:744` 先改状态/关系再改形；`Polymorph.polymorphSpecies` 仅原目录；`Domination.ts`、`Game.freeCaptive`、`resurrectAlly` | 变形尺寸变化须先求落点，再提交；大体型转换为盟友等按 §12 产品选项集中拒绝或支持，不留半转换 |
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

## 3 底座能力与 `giants` 模块

### 3.1 所有权和接口草图

拟新增底座文件 `src/engine/Movement/CreatureSpatial.ts`（原生几何、占位和提交）、`src/engine/Map/FootprintPathing.ts`（锚点通行与图缓存）、`src/ext/spatial.ts`（冻结 DTO 与受控请求）、`src/ui/creatureFootprint.ts`（公开身体呈现）。文件名在审阅时可调整，能力归属不变。

```ts
// 拟新增；schema 与尺寸上限是校验规则，不由模块任意扩张。
interface CreatureSpatialComponent {
  schema: 1;
  size: 1 | 2 | 3;
  movementRegionId?: number; // 可选底座区域引用，不复制矩形
}
// Creature.spatial?: CreatureSpatialComponent
// 不使用能力的 1×1 实体不创建此属性；查询默认 size=1。
interface CreatureFootprintView {
  id: number;
  anchor: Readonly<{ x: number; y: number }>;
  size: 1 | 2 | 3;
  cells: readonly Readonly<{ x: number; y: number }>[];
}
```

`movementRegionId` 引用可选的通用移动边界，不代表“Boss 房间”概念。下文的 movementBounds 指从该区域解析出的只读矩形。若选择场地约束方案，由底座创建计划设置引用并持久保存；几何真相只有 `foundation.world.regions` 一份，`giants` 保存 arenaId 和绑定，不复制怪物坐标、HP 或矩形。变小后可保留 size=1 与区域引用，能力仍被使用；普通 1×1 生物没有此组件。只有足迹、不用区域的底座 fixture 不要求模块或扩展 runtime。

| 拟新增底座 API | 合同 |
|---|---|
| `footprintOf(id)` / `footprintCells(id)` / `containsCell(id,p)` | 内部可信查询，冻结只读；当前层存在实体才返回；格集合按 y/x 排序，最多 9 格，无 RNG |
| `creatureAtCell(p, policy)` | facade；策略显式区分 active、active-or-reserved、原有死亡接触资格。`getMonsterAt` 保留为只返回 Monster 的兼容入口 |
| `distanceBetweenFootprints(a,b,metric)` / `nearestContact(a,b,linePolicy)` | 切比雪夫/欧氏平方/既有感知尺度分别保留；相同距离按源格 y/x、目标格 y/x 决定，不能混用距离单位 |
| `canFitAt(actor,anchor,policy)` / `canStepFootprint(actor,from,to,policy)` | 整体地图界限、地形、占位、空间边界、对角规则；允许忽略自己的旧占格；返回拒绝原因而非写世界 |
| `planPlacement(request)` / `commitPlacement(plan)` | 预检后提交，复核实体/形态/地图/占位 revision；修改锚点、组件和索引原子可见，再执行接触。适用于单体与批量出生，不是任意世界事务 |
| `collectCreatureTargets(cells,scope)` | 格集合→唯一实体，稳定接触顺序；资格/隐藏知识由调用方策略决定；去重出口覆盖成长逐命中消费 |
| `readKnownCreatureSpatial(id)` | 玩家公开投影只给已允许显示的格、可瞄准格、公开尺寸/名称，不能把完整机械 footprint DTO 直接发 UI |

原生引擎接 Game/Creature 实对象；模块只接冻结空间 DTO 和有限的创建/行动计划。普通 hook、`queryOptional`、UI contribution 无权改 Creature.spatial、loc 或地图。`queryOptional` 现有 narrow context 不是任意 NPC 空间查询器；空间能力通过新的底座只读端口进入 runtime/context，按 actor 资格与目标知识授权。

### 3.2 占位索引与生命周期

- **真相**是实体的锚点、足迹组件、所属楼层和活跃/休眠/死亡生命周期；占位索引是派生缓存，不写入 Cell，也不存档。一个格最多一个物理活跃实体，返回同一实体的所有身体格不制造新 ID。
- 当前层有多格实体或空间约束使用者时，懒建格→实体索引，同时索引普通生物；休眠预留分开维护，按入口策略查。不把休眠者放进射线/战斗活跃列表。若预留与活跃占格按旧规则重叠，策略返回预留集合；唤醒必须重新求合法完整落点，不能直接抢占。
- 出生、移动、形态变化、死亡资格变化、移层、休眠/唤醒、列表替换都更新索引。死亡 DF/掉落完成前，保留现有 `getMonsterAt` 的可查询时间窗；进入 deathProcessed 后即不再作为该查询的占位者。携带乘客、purgatory、pending 落层者不占当前层格。
- 所有活世界位置写入经提交原语；构造、解码、生成期间借用玩家离图位置等例外须显式有“索引未发布”作用域。`ownedMonsterList` 的 Proxy 只处理列表所有权，**不会**拦截 loc 修改，不能靠它自动维护索引。
- 新局/load/grid 替换清理旧缓存；恢复/回滚后从实体真相重建。缓存可放 Game 键控 WeakMap，不藏机械状态。`checkpointGenerationWorld` 会跳过 WeakMap/WeakSet，所以必须登记 `restoreSession` 重建/失效，不能期待现有深拷贝自动回滚。

### 3.3 未使用能力时的零影响合同

1. 普通实体不添加 spatial 属性；codec 特别按“属性缺席”处理，不能因 `copyFields` 在恢复时写出 `spatial: undefined`，改变完整对象图。基础存档/录像版本升级是兼容包络变化，比较机械状态时仅排除版本标识、savedAt 和明确派生缓存，不能排除 HP、坐标、tick、组件、队列或实体计数。
2. 空集合、growth-only、narrative-only、growth+narrative 的原生场景没有空间组件、占位表、体型图、额外 FOV 掩码或新增规则 RNG；`getMonsterAt` 和 1×1 几何保留原轻路径，不每步扫描所有实体去“检查有没有巨人”。使用者计数在生命周期变更时维护。
3. 新 native 几何 facade 不创建 ExtensionRuntime，不向未启用 giants 的 manifest/state 注入 giants 块。底座格式的新版本元数据必须如实列出，不能声称序列化 JSON 逐字节未变。
4. 以本基线实际捕获的真实 Game 场景作空间改造前后差分：新局、走路/战斗/位移/召唤/机关/换层/存读/录像，比较完整机械对象图、消息、双流状态及调用数。该比较只证明未使用空间能力的组合无回归，不要求与 CE 同种子逐骰一致。
5. 显示、保存、校验、索引重建和纯几何查询不取实质 RNG；显示相同实体不按身体格反复取幻觉外观随机值。最后一个空间使用者离层后释放该层派生缓存，不持久记录“曾经激活过索引”。

### 3.4 模块自有内容

`src/ext/modules/giants/` 拥有 descriptor/module、schema/types、原创 `data/definitions.json`、场地模板、状态与 codec 校验、locales、AI 声明、UI/descriptor、Boss 血条和 tests/test-suites。机械包进入自有 rules 指纹，显示资产版本单独管理。正式敌人通过底座 Monster 创建计划提供经过白名单校验的 `MonsterData` 与 spatial，不改 `src/data/monsters.json` 和原 horde 表，也不要求 growth 的敌人模板运行器。

还需底座通用的原生形态目录贡献：当前 `Polymorph.knownPolymorphSpecies/polymorphSpecies` 只查原 monsters JSON，`CreatureFeatures.creatureFeatureInfo` 对未知 typeId 返回零血迹/DF。不能只成功 new Monster 就声称正式巨人所有路径可用。由当前启用模块提供冻结的、带 owner 的形态/特征声明，底座按稳定限定 ID 查形态、出生、变形候选与 snapshot.form 校验，未启用时不追加候选或取骰；缺特征沿明确的默认值，原创血迹/死亡DF如需启用须显式声明。禁止在这些共享函数中 import giants 数据。P4-D07=A 时把已启用的大型形态加入受控变形目录，旧形态抽样在无能力组合保持原范围和顺序。

敌人定义至少包含限定ID、nameKey/descriptionKey、native属性/速度/行为与攻击声明、squareSize、可选特征、arena模板引用与内容转换资格；校验有限JSON、唯一ID、引用、整数/数值预算、方形尺寸和locale归属，不接受脚本。`ItemLoader.translateName` 当前只查 `name.*`（该文件:18–20,962）；模块的 `ext.giants.*` 词条应由通用创建适配器纯解析为原生显示名/描述，保留内容ID用于后续投影，不在共享原词条表塞具体Boss中文，也不为取名消耗RNG。

底座拥有多格移动、攻击几何和调度；模块 AI 首版只提供“守场/追击/回归”的有限声明与家园目标，不接受任意脚本。原生 `Monster.takeTurn` 仍执行行动与提交耗时。启用 growth 时沿其已有通用出生/伤害事实自然工作；没有 growth 时 native HP/攻击/速度足以游玩。XP、剧情门、魂系招式均不是 giants 单独开启的条件。

## 4 空间与位移规则

### 4.1 锚点、移动与邻接

锚点定为整数左上角 `(x,y)`，占据 `{(x+i,y+j) | 0≤i,j<N}`。地图坐标沿用现有方向，屏幕中心仅用于呈现。左上锚点便于 2×2 偶数体型、序列化、矩形检验和障碍膨胀，避免半格中心。方向不是持久空间字段；方形转身不改变占格，不挤缩、不旋转穿过窄道。

一次正常移动是锚点移动一格，整体消耗一次 movementSpeed，绝不按 N² 增加回合。目的 footprint 的所有格都须满足该 actor 的通行策略、空间边界与占位约束；旧身体与新身体的自重叠合法，其他实体不能被覆盖。NPC 找路抵达目标身体旁的攻击锚点集合，而不是进入玩家格。

多格对角移动推荐采用保守合同：目的锚点以及两个正交中间锚点都可 fit，移动边检查与距离图一致，禁止穿墙角或擦过其他生物。该规则仅用于多格；保留当前 1×1 各入口既有墙角语义。不能给所有 NPC 顺便改一套对角规则，违反零影响合同。

几何距离是任意身体格对的最短距离；非重叠的生物近战可邻接 iff 切比雪夫距离=1，且至少一对相邻接触格通过本次攻击的墙角/墙穿规则。矩形之间可 O(1) 求距离，再按稳定顺序找合法接触对。纯“距离=1”不能让隔双墙斜角的双方打到彼此。

### 4.2 位移与无落点合同

所有推荐的新多格落点搜索有界、确定性：原锚点先验 → 合法锚点图上最近路径距离 → 允许跨障碍的原因才可回退方环/全图；同距按 y/x 选首个。**行走不回退到不可达区域**。随机传送是例外：稳定完整候选表上一次原生 RNG 抽取，无候选零次；1×1 保留原候选次序与随机调用。寻路/搜索自身均不取骰。

| 原因 | 多格规则决定 / 推荐方案 | 失败与理由 |
|---|---|---|
| 生成/自然出生 | 完整 footprint fit，排除楼梯、危险、机器冲突及已预留实体；批次计划逐体预留后提交 | 没有合格场地就不放 Boss，写 placed/skipped 收据；不把大怪缩水，不反复随机试到成功 |
| 普通交换/推挤 | 首版任一参与者多格时禁止自动交换；其他生物选择绕路；两个 1×1 的原交换不变 | 避免把 1 格玩家与 4/9 格身体做不对称互换；未来可增加全批次原子交换，但不能递归无界挤人 |
| 击退/力场 | 以实际接触对求八方向推进，每格锚点步都验整体；旧路径允许的墙碰撞伤害只结算一次，以首个阻挡前沿为接触点 | 遇墙/其他生物/场地边界停止，不连锁推动。不按身体格复制撞击伤害；保留原施法/攻击费用 |
| 拉拽 | 以双方最近合法接触对指向施法者，每一步整体验证，最远停在距离=1 | 阻挡即停；合法施放但无移动保留原效果耗时，不退回技能费用 |
| 瞬移/闪现 | 穿越过程遵循原技能是否允许穿障碍的语义；落点一定完整 fit。多格不搬走/杀掉落点上的生物，改搜最近合法落点 | 没位置则效果不位移；不会通过临时 -1/-1 暴露错误索引。普通 1×1 的潜水者搬移规则仍保留 |
| 随机传送 | 所有占格都符合效果的危险/楼梯/机器等约束；距离与“视野外”按 footprint 判断，候选一次随机选取 | 若启用场地边界，候选只在该边界；无候选不改位置、不取选址骰。已合法施放的消耗沿原入口 |
| 召唤/克隆 | 以召唤者外围为搜索起点，大型复制保留尺寸，逐体预留；小召唤物也查尾格；形态/关系策略先预检 | 无位跳过该体；合法的整次召唤仍按原调用者付费。禁止用失败实体消耗 ID，禁止大怪复制成隐式 1×1 |
| polymorph | 单独生成候选形态计划，保留实体 ID，按旧规则计算 HP；同锚点不 fit 时搜最近合法锚点，成功才原子提交形态/关系/足迹/位置 | 无位则整次变形无机械效果，原形/HP/关系/状态不半改。形态抽样若已消耗 RNG 保留，不循环重掷直到找到小体型 |
| 坠落 | 推荐非飞行者全部身体格均无支撑且带下降地形才落；部分踩渊不落。伤害与落层一次，进入下层重新搜索完整安全落点 | 未生成下层继续使用 pending；已生成下层也先计划。全图无落点时保留有界 pending，不叠格、不删除实体、不补造场地 |
| 换层/追楼梯 | giants 首版守场生物不主动追楼梯；底座 fixture 仍验证跨层多格恢复。若未来允许跟随，需 N 宽出入口和接收楼层 fit | 通道不合格不转层；不会用普通单格 follower map 偷带过去 |
| 休眠唤醒/复活/乘客释放 | 先建原生候选体型与关系计划，找完整落点，成功后发布活跃索引 | 无位保持休眠/待放置，失败不从旧所有者摘除；不先恢复 HP 再留在墙内 |

pending 落层实体不进当前层索引/调度，保留于现有 `pendingFallenByDepth` 的持久实体图；补充显式“等待空间”的有限元数据，按实体 ID 排序，仅在入层或相关空间 revision 改变后重试。恢复者成功进入索引后才行动和触发接触；等待期间不反复结算坠落伤害、不反复消耗 RNG。队列数量沿实体预算约束；到底层无法下降沿原终局边界处理，不创造第 41 层。

§12 若不选择守场约束，所有搜索去掉 movementBounds 过滤，其余安全规则相同。基础 fixture 无模块也能测试任意尺寸变化；Boss 是否可变形、盟友化和复制属于内容策略，不能令底座形态转换一直缺实现。

## 5 地形、气体、机关与物品

### 5.1 一份足迹暴露摘要

多格路径先读取身体格的四层地形/气体，生成冻结 `FootprintExposure`，再按现有主时序结算生物；1×1 保持原路径。不能对每个格直接调用 `applyEnvironmentalEffects`。状态时钟、燃烧/中毒伤害、恢复与成长客观块只按实体一次推进。

| 类别 | 多格推荐规则 | 一次性与混合情形 |
|---|---|---|
| 火/可燃地形 | 任一占格接触火即可点燃，免疫/飞行/潜水按原效果资格；燃烧状态伤害仍每客观块一次 | 完全处于灭火层才灭火；有干燥着火格时不会因一只脚踩水来回熄灭。着火身体可点燃每个可燃接触格，但逐格世界写入不复制生物伤害 |
| 熔岩 | 任一占格接触无豁免熔岩即可致死；只执行一次死亡与终结来源 | 免火/飞行等资格仍由原生效果规则决定。选择“任一格”使边缘避险有意义；不是 N² 次伤害 |
| 深水 | 任一占格涉深水即进入涉水风险/行动限制；水生者普通移动要求全部身体格满足水生通行；飞行/免水保留豁免 | 不新增原本没有的溺水数值。潜水与水下隐藏要求全部身体格可潜且无干地；冲刷携带物只抽一次，不按格翻倍 |
| 裂隙/下降/支撑 | 推荐全部身体格都缺支撑才坠落；深水不算“缺支撑”。悬浮者不落 | 等效支撑条件单独求 AND；不能把 flags OR 后看到 T_AUTO_DESCENT 就落。该产品规则见 P4-D04 |
| 气体浓度 | 现代码按 GAS tile flags 判效果，**不以 volume 设置阈值**；保持此规则。任一占格含某气体效果即暴露，同类状态用一次 max 刷新 | 暴露摘要可携带每种气体最大 volume 供将来公式使用，首版不将浓度平均/累加乘伤。不同气体种类各自生效；同种腐蚀/蒸汽等渐进伤害类别取最强一次 |
| 蛛网/毒苔/荆棘 | 任一格接触即可缠绕/中毒；同种效果一次抽样或刷新；只有全部身体离开对应地形才清接触状态 | 挣扎消耗一次行动；破网时按身体接触格稳定处理，不为每格再投挣扎骰 |
| 地形治疗/渐进损伤 | 该结算类别在身体内取最大有效强度一次；伤害与治疗作为两个既有类别按原时序 | 不把覆盖面积变成倍增器，也不提前给移动瞬间补一个气体伤害 tick |
| 爆炸 | 同一个爆炸/DF 因果作用域内，同一实体一次命中；现有免疫窗继续处理跨作用域的连续爆炸 | 不靠长免疫窗掩盖尾格重复调用；死亡 DF 不反复触发死亡/XP。独立后续爆炸是否伤害仍按原免疫规则 |
| 陷阱/压力板 | 任一新进入身体格可触发**该格**符合资格的机关；每个真实机关一次，玩家专属 ENTRY 标志不施加给怪物 | 多个独立陷阱可各触发，不能“整只巨人只踩一块板”；同一机器激活由机器去重，同一范围伤害由实体去重 |
| 门/地形晋升 | 身体碰到的通用 creature-step 门格分别开启；目的地整体开门预计划后才验 fit/移动。正常不会撞碎墙或挤过 1 格门 | 多格驻留格维持通用踩门晋升；改变地形后通知缓存。不能无条件把玩家专属晋升复制给 NPC |
| 钥匙/物品/掉落 | 玩家拾取仍 1×1；携带匹配钥匙可作用于任一身体接触的机关，同一消耗物一次；普通怪物不新增扫地拾取能力 | 死亡/携带物掉落以实际死亡接触格起搜，再按 footprint 附近稳定单格候选；只掉一份。物品仍可在身体下方存在，UI 由遮挡优先级决定 |

整体 flags OR 仅适合“任一格”存在性；不能拿 OR 同时替代支撑、全身潜水、灭火、免疫与每种气体的实际采样。首版上述推荐共同组成一个底座版本化规则集，不开放每个 Boss 自写任意 reducer。

### 5.2 重入、触发顺序与随机边界

移动提交后按新进入格 y/x 处理通用机关；旧驻留格不伪造重新进入。原有需驻留检测的 DF/地形按客观块检查全身体。触发使实体死亡、瞬移、坠落或形态变化时，停止旧占格列表处理，再使用新真相结算；不能拿旧 `loc`/exposure 继续触发另一格。

DF 可逐格回调，并嵌套触发新的 DF。底座提供短命 effect/contact scope，记录 `(scopeId, creatureId, effectKind)`；内层同源面积接触共享作用域，不按格重新分配 effect ID；不同独立陷阱/动作子段获得自己的作用域。被杀实体的死亡爆炸是新的子效果作用域，继承可信因果来源但不与杀死它的那次爆炸共享命中账本。作用域在同步提交边界排空，不进存档，不由 UI 创建，不从墙钟或装饰 RNG 取 ID。存在跨命令延迟效果时必须单独定义持久 plan，而非保存一个半开的作用域。

每种生物效果按唯一实体采样一次；世界格的既有火焰/晋升/气体 RNG 仍按真实地形变化执行，启用大型者可以有意影响环境后续 RNG。报告区分“单位效果去重”与“真实多格地形变化”，不能把所有 RNG 漂移笼统归于体型。没有空间使用者时不建立这些新作用域或改变原调用次序。

## 6 攻击、弹道与目标

1. 普通近战从最近合法接触对出手；命中任一身体格就是命中该实体，防御、伤害、符文、抓持、反伤、击杀、日志与成长 `physicalResolved` 全部一次。被击退方向和血迹/浮字使用实际接触格，不能总落在左上角。
2. 横扫的格集合是攻击者 footprint 外围的 8 邻接并集，扣除自己的身体；矛/鞭/穿刺由底座“相对形状”产生格集合。首版大型普通攻击只打一名相邻敌人，不因为有多个身体格获得多次攻击。多头/连段必须显式声明多个独立攻击子段，属于以后内容。
3. 单个攻击子段/单次范围效果内，以 creatureId 去重。命中顺序取该子段的首次接触序，格枚举无方向语义时用 y/x、再实体 ID；保留现有矛从远到近等明确的解算顺序。不会因面积更大多触发一次成长临时效果消费。范围伤害、否定/纷争、成长动作复用同一目标收集器，不在模块中复制一套半径筛选。
4. **弹道碰撞**发生在第一格身体接触。非穿透投掷/射线当场停，撞到未被看见的尾格仍有机械碰撞，但消息不得泄漏身份。穿透弹道继续对后续地形逐格作用，对同一多格实体仅解算一次生物效果；反射概率也只在该实体首次碰撞采样，不能沿身体重复掷反射骰。
5. 本基线 `traceBolt` 保留反射后重复访问同一 1×1 实体的 hits，这是现状语义。新去重规则只折叠多格实体在该次 projectile scope 内的重复接触；普通 1×1 的重访仍保留。混合场景必须有“巨人 1 次、普通反射目标按原重访次数”的测试。若阶段 3 将来要统一弹道语义，应另行评审，不借本次迁移修改。
6. AoE 必须用形状格集合与 footprint 的交集，而非锚点是否在半径内。先按原技能所用距离度量生成格，再收集实体；障碍/LOS、敌我/免疫/目标知识继续由效果自己的策略复核。不存在的通用成长 AoE 只留该底座接口，不在本阶段增加新成长技能。
7. 自动目标按唯一实体 ID 列表、最近合法公开接触格排序；手动瞄准保持格点，命令/录像记录玩家真实点击格。目标选择 UI 为同一实体高亮所有**可公开格**。ID 目标的成长 attack 验证/准备/提交用同一 footprint 接触规则，取消和陈旧目标不扣费，已有 prepared 风险确认协议继续使用。

碰撞与知识是两套查询：规则可以撞上隐藏生物，UI/自动选敌不可以凭占位表发现它。确认前的纯预检与实际提交使用相同几何，但提交再次核对形态、锚点、空间 revision；prepare 期间不先移动/伤害再回滚。

## 7 视野、潜行、感知和关系

- **玩家看见大型者**：任一占格满足当前直接可见性且该实体未按对应隐藏规则隐匿，即成为一个可见实体。身份门槛继续复用 `MonsterVisibility`。实际展示只画可见/被允许感知的身体格；看见脚不自动把整块未探索墙后地图变成可见。
- **大型者看见目标**：至少一个身体观察格与至少一个目标占格有合法 LOS，且在该观察格对应的原距离范围内。可信 NPC 查询最多 9×9 格对，先最近/边界候选，再短路；不把 NPC 多源 FOV 写进玩家的 Cell.isVisible/isExplored。需要范围掩码的技能才懒建纯 mask 并集。
- **隐身/气体**：隐身是一份实体状态，不是九个独立隐身骰。气体接触可显影的可见身体格；气体外、墙后格不因同一实体显影而全部画出。telepathy/entranced 的已知位置沿现有身份/位置区别，只输出被规则允许的标记，不直接曝光所有隐藏身体边界。
- **潜行/气味**：最近 footprint 距离与身体采样的最小 awarenessDistance 作为感知摘要，沿 Scent 原有尺度，不直接用欧氏距离替代。先合并摘要，再执行一次原概率决策；一只 3×3 不能投九次 25% 警觉骰。气味梯度用于选择合法锚点邻居，不能逐格 scent.stepDirection 后多数投票穿窄门。
- **噪声/警报**：`aggravateMonsters` 的现有路径距离图对每只生物取占格最小值，只唤醒一次；底座公开这种距离 reducer，不新造全局声音系统。身体遮挡光的谓词覆盖全部占格，普通地形 LOS 是否阻挡生物仍按该查询原策略。发光生物采用确定的身体中央合法格作为发光原点，1×1 原点不变，不按面积复制光源/RNG。
- **关系**：推荐首版 giants 正式内容只生成敌对者，不生成大型盟友/俘虏，也不允许魅惑/支配把它变为大型盟友（P4-D03）。集中内容资格检查覆盖 domination、复活、友方复制/召唤、笼子群落、关系改变事实；“entranced 跟随位移”和 discord 等现有状态不等同成为盟友，仍按 footprint 支持。拒绝必须本地化说明，不能静默缩水。

底座不把 faction、isAlly 和尺寸绑定，测试 fixture 可构造大型盟友验证目标/占位；首版只限制模块内容与转换策略。将来放开时需补 NPC 主动动作、全批次交换、跟随楼梯/下层落位、锁链/救援、友方确认和数据策略版本，并复用同一空间能力。

## 8 按体型寻路与性能

### 8.1 锚点图与现有路径的关系

对尺寸 N 的合法左上锚点 A 建图：`fit(A) = AND(tilePolicy(A+offset))`，物理障碍等效向左/上膨胀 N−1 格。通行格网可用行滑窗/坏格前缀和构建，O(W×H)；处理需要状态/液体/边界的策略也可首版直接 O(W×H×N²)，先正确再测量。目的锚点代价取身体格最大地形代价，禁止用总和悄悄放大移动耗时；行动 tick 仍由原速度决定。

距离图以多个“可与目标 footprint 合法攻击”的锚点为零源，执行确定的 BFS（等权）或 Dijkstra（正权）。对角边使用 §4.1 的同一 canStep，不能只用一个 -2 格标志近似多格墙角。实现可给现有 scanner 增加邻边谓词，保留 1×1 原 scanner 路径；NPC 的 A*、逃跑安全图、游荡 waypoint、闪现候选与跨层落点一起迁移到体型视图。

`Creature.mapToMe` 现在不含 traveller 体型/通行策略，`getBlinkTargetMap` 只看目标是否走离原图值≤3的区域；这不能给 2×2/3×3 共用。新多格缓存独立按 key 管理，不覆盖原 `mapToMe`，也不把旧单格 waypoint/safety 图当成正确的多格图。

### 8.2 缓存、动态占位和失效

推荐每个当前层 SpatialService 懒持有两级缓存，最多 **8 个**大型查询图，LRU 顺序仅影响性能，不能影响路径结果：

| 缓存 | key | 失效 |
|---|---|---|
| 地形 fit/代价图 | grid 身份、N、locomotion/免疫/状态通行指纹、movementBounds、terrainRevision | 地形/门/DF 晋升、液体边界、影响避险的气体变化、尺寸/状态资格/边界变化 |
| 距离/目标图 | 上述 key + 目标 ID/footprint revision、目的类型、危险评估 revision | 目标移动/死亡/变形、风险地图变化；首版不沿用“移出值3才更新”的近似 |
| 动态局部规划 | 上述 key + occupancyRevision、被忽略 actorId、阵营/阻挡策略 | 任何参与占位变化；通常只在共享地形图上临时修正并验下一步，不永久为每 actor 缓存全图 |

共享静态图不把移动小怪永久膨胀成墙。下一步必须实时验整体占位；被挡后在同一体型图上做有界动态路径搜索，动态目标若完全封死则等待/按当前 AI 换目标。静态图可以跨 actor 共享，临时图忽略自身全部身体；不能误让自己的旧格阻断自己。不可达搜索扩展最多合法锚点数，不新增随机“脱困”；路径平局按现有方向次序固定。

现 `invalidatePathing` 只在 DF callback 中更新 loopMap/safety，尚无统一 terrainRevision。实施必须加通用 mutation 通知，并覆盖 `Promotion`、门与钥匙、`Grid.setTerrain` 以及直接改 layers 后 `refreshTerrainProperties` 的写入；`TimeCoordinator.updateEnvironment` 汇总实际变更，不每块无条件重建体型图。影响多格避险的气体 type/资格改变要失效，不因 volume 每次随机舍入都无条件使无浓度公式的图失效。

出生/死亡/位移/休眠→活跃推进 occupancyRevision；只清动态规划和目标相关项，不让一只小怪走路重建所有静态 fit 图。换层/load/生成回滚直接丢弃缓存。revision 不存档；按真相重建并保证读档后选路完全一样。无能力使用者时这些计数、数组、图构建和失效扫描都不启用。

### 8.3 成本估算与实施验证

当前 `src/types/index.ts:46–53` 给出 **79×29=2291 格**。不考虑边墙的候选锚点上界：2×2 为 78×28=2184，3×3 为 77×27=2079。直接逐锚点检查身体分别约 8736/18711 次格判定；每张图最多约 1.75 万/1.66 万条八邻边，BFS O(V+E)，正权堆 Dijkstra O(E log V)。对角检查预先读取 fit 图即可，不每条边重新扫九格。

格→ID 用 Int32Array 约 9 KiB，预留另算；单组 fit Uint8 + cost Uint16 + distance Int32 约 16 KiB，8 组原始数组约 125 KiB，加占位与临时图约 **150–250 KiB/活动楼层**，不含 JS 容器、堆和 FOV mask。上述是操作量/数组字节估算，**不是实测毫秒或 FPS**。若实体 ID 超出 Int32 范围须校验或换索引编号，不截断共享 entityId。

实施时记录同候选真实 Game 的无大型局、1/4/8 个 2×2、1/4 个 3×3，追击/动态堵路/开门/气体/不可达场景的命令耗时 P50/P95、图构建次数、命中率、分配量与渲染帧。未使用局要求新增体型图/索引构建计数为 0、实质 RNG 增量为 0、机械状态一致；耗时与基线重复测量比较，不能只凭均值宣布零成本。多格局暂以 P95 单命令额外空间计算≤5 ms 为调优目标，最终预算需维护者按设备实测确认，未达时仍报告正确性和瓶颈，不放宽测试制造通过。

## 9 刻符渲染、目标与移动端

推荐 **逐格轮廓 + 身体内一个主字形**（P4-D05）：2×2/3×3 是一个实体绘图组，身体边缘细线、低亮填充，中央一个实体字形；局部可见时只裁切到公开格，主字形可移到稳定的已见格。不要把九个相同怪物字形画成九只怪，也不要放大到遮住足迹外的危险格。ASCII/汉字/图块四种地图共用占位几何；地图模式影响主字形，不影响命中。

未完全看见时不画完整矩形外框或未见尾格；选中目标边框也被公开格遮罩裁切。相邻火/气/机关仍可辨认，接触格局部闪烁表示本次受击；HP 浮字每实体/效果一次。轮廓属底座呈现，Boss 内容色彩/字形/血条属模块。首版不需要图片资产或图生视频。

- **侧栏/附近列表**：一只大型者一条 row，显示公开体型（如“2×2”）和原状态/HP；排序取玩家到身体的最短同类距离，focus 落在任一可检视占格即选中。row.loc 使用稳定公开检视格，不能把隐藏锚点当点击目的地。共用 Sidebar、ThemeNearby、ContextPanel 消费同一 row DTO。
- **Boss 血条**：由 giants 的通用 hud contribution 提供“名称 + 当前/最大 HP + 条”，只读取当前公开帧的 Boss DTO。建议当前目标优先，其次最近可见 Boss，最多一条；未见/失去知识时隐藏，不能提前显示墙后 HP。若多个 Boss，附近列表可以切目标，不占用全屏堆叠。数字/名称全部走模块 locale。
- **桌面与手机**：血条跟随现有 HUD 流式排布，不固定遮住地图；390 宽显示两行，320 宽允许名称省略、HP 紧凑显示，保留一条条形进度，不强制改镜头缩放。320/390 下每个 body 格可点选，长按尾格检视同一实体；投掷/法杖沿原“瞄准→确认”，不得因点击同一个实体的另一格直接确认。
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
| 4×4 | 不提供正式模板 | 模板 schema 预留尺寸参数；运行校验仍拒绝 4 | 将来另扩上限、预算与图/视觉测试，不能仅把数据 size 改为4 |

场地边界和出生/巡游锚点区分：净空矩形保证 fit，spawn 周围至少两格缓冲，玩家出生/楼梯不能落在 Boss 身体或直接相邻杀伤区。计算玩家出口连通、Boss 锚点可达集合、可绕行的玩家格带和无堵死楼梯，不仅检查房间面积。装饰柱/水/陷阱只能放在验算后仍满足合同的模板变体，失败不用缩水通道。

守场方案将通用 movementBounds 设为该场地净空：行走、闪现、随机传送、拉拽/击退都不能越界；外面的玩家不会使 Boss 卡在追击窄道，可在无合法场内攻击位时回归。边界不是无条件减伤/穿墙攻击，也不强制给 Boss 远程招式。坠落是一种楼层所有权转移，不能留一个旧 depth 的边界：底座转移时清该局部边界，并由 giants 记录 escaped/lost 绑定状态，采用通用 native AI；下一层不凭原 arenaId 复造场地。首版场地不放渊，此异常仍用 fixture 覆盖。自由追击选项则不设置 bounds。

### 10.2 接入点与事务

当前 `Architect.generateLevel` 顺序为 generateTerrain → traps → BlueprintEngine machines → autogen → doors/walls；`GenerationCoordinator.generateDepth` 在 floor-attempt 中建图/放楼梯，随后 populate、恢复坠落者、补算环境、入口/居民恢复。**现有 before/afterLevelGeneration hook 都在外层生成完成后派发**，不能在普通模块 hook 内偷偷改地图，`worldInteractables` 也只有非阻挡叙事对象放置能力，不适合战斗 Boss。

拟新增底座 `GenerationContribution` 声明与有限空间创建计划：

1. 启用模块登记纯模板/候选规则声明，按 priority、owner ID、template ID 排序；静态发现不挖图、不取 RNG。多个模块同时贡献场地时按同一预算/预留规则处理，重叠候选拒绝或选下一个，不按加载顺序抢格。
2. floor-attempt 内，基础地形完成后、陷阱/机器放置前选可附接侧室并保留其 mask。模板挖掘、入口连通与 N 图验算由底座执行；traps、机器、autogen、楼梯、populate 均尊重预留区，不能后续填柱或把楼梯放进身体。必要时在 `Architect.generateTerrain` 的房间阶段增加可附接净空，不事后覆盖已有机器。
3. 在同一 generation transaction 内，成功模板形成底座 owned region 结果和受控出生意图；楼梯与基础填充成功、恢复坠落者及首次环境补算完成后，再验完整落点，发布 Boss 到原生列表/占位。出生只派发一次可信 creatureSpawned，之后才对外发 committed/enteredLevel。
4. 最终一遍验证区域及落点；模板失败在本次候选预算内确定性换下一候选，预算耗尽 skip，并记录原因。建议每层≤1 场地、≤16 候选尝试作为首版性能预算（待数据确认）。不为 Boss 无限重生成楼层；若将来强制 Boss 主路，失败须显式生成失败/回滚，而不能悄悄 skip。
5. 生成写集覆盖 grid/layers/masks、owned region、怪物/列表/组件、module state/收据、entity/effect 计数、两流、缓存与显示队列；继承现有事务并扩 `checkpointGenerationWorld` 显式 roots/restoreSession，测试完整对象图及身份恢复。2c 奖励事务不是通用地图事务，不能直接拿来 spawn/挖场地。

owned region 的几何/owner/深度在底座持久世界中保存，giants 的场地结果/绑定/击败事实在自有 state 保存。给 `src/ext/world.ts` 增加区域类型时，原 non-blocking interactable 保持原类型，不把 Boss 伪装成叙事 NPC；可将新区域定义放 `src/ext/spatial.ts` 并由 world/runtime 统一保存/校验。

### 10.3 零生成影响与 drift

未启用 giants 时，不产生 generation contribution、区域/mask、收据或额外取骰；空能力分支沿原生成流程，现有场景的地图、实体、ID 和双 RNG 应完全一致。启用 giants 后可改变房间、楼梯、机器/人口可放置空间和后续随机消耗，这是有意的生成变化，需报告而非保证原地图不变。

4d 必跑 `test:drift`：保留未启用组合的原基线，另建立 giants 开启的原创场地夹具与固定种子 trace。若公共生成调整使未开启也漂移，先查清是否违背零影响合同，不能统称“Boss 生成所以重录”。只有符合已批准设计的实际变化才按原捕获入口重录并逐项说明；遵循扩展 README 当前政策，不强制 CE 源码或旧 CE 全量档。

## 11 持久化、录像与阶段 3 协议

### 11.1 持久位置与版本

| 内容 | 保存位置 / 归属 |
|---|---|
| 原生 spatial、锚点、形态与待落层元数据 | `EntitySnapshot` 的生物 codec；完整实体图覆盖当前/缓存/休眠/携带/pending/purgatory。空间组件是底座字段，不塞入 `giants:*` 或 `growth:*` |
| 区域几何、owner、深度、稳定 instanceKey | `extensions.foundation.world` 的新增 regions（未使用时省略该能力块）；底座验证，缓存层同样覆盖 |
| 场地生成收据、Boss ID/定义/arena 绑定、defeated/escaped 等内容进度 | `extensions.modules.giants`，state schema=1；可选 `giants:boss` 自有组件只保存模块内容引用/公开标记，不复制空间/HP |
| 占位表、尺寸距离图、空间 revision、contact scope、绘图组 | 派生会话状态，不保存；新局/load/rollback/seek 清理后重建 |
| 模块规则身份 | 录像与存档 manifest 中 `giants@1.0.0`、rules `{schema:1,version:'1.0.0',fingerprint:…}`；只有启用时列入 |

模块 state 草图（拟新增，均有上限；无玩家命令时不虚设 input schema）：

```ts
interface GiantsState {
  schema: 1;
  revision: number;
  placements: { instanceKey: string; templateId: string; depth: number;
    result: 'placed' | 'skipped'; regionId: number | null;
    reason: 'no-space' | 'budget' | null }[];
  bosses: { creatureId: number; definitionId: string; instanceKey: string;
    regionId: number; status: 'alive' | 'defeated' | 'escaped' | 'lost' }[];
}
```

首版建议placement/Boss记录各≤128条，每个instanceKey唯一，region/creature引用与状态相容；击败记录只存历史ID，不把死者对象作为GC保活根。生成收据和状态变化在同一受控提交中更新，普通death事实只能更新模块自有内容状态。`escaped` 表示已离开家园、实体仍可存在，`lost` 表示行政移除等不算击败的终结；重访/load不把这两者重新生成成Boss。将来若新增玩家可发的giants命令，再独立定义严格payload版本和纯prepare合同。

建议第一次原生空间格式落地统一升 **实体/whole-run version 2→3、whole-run schema v2→v3、录像 version 2→3、extension foundation 3→4**；manifest.schema 仍1。这是计划版本，不是本轮变更。若阶段 3 先占用版本号，由维护者合并时统一分配下一版本，不能两边各把不同布局都叫 foundation4。升级所有保留 descriptor 的底座兼容要求；模块自有规则/数据变动才升各自 module/rules/schema，不以更新兼容声明假称其内容变更。

兼容版本标识例外不削弱 §3.3 的机械状态合同：未使用能力的实体不新增默认 spatial 或空区域机械记录。旧档/录像不迁移、版本不符明确拒绝；要求 giants 的输入遇到其物理缺失、禁用、版本/指纹不符也拒绝，不能剥掉模块继续载入。提示沿兼容错误 i18n，拒绝在退休旧局前完成。

新增 Game 实例字段必须登记 `scripts/u03-state-contract.json`；本案优先会话 SpatialService，若没有新增 Game 字段则不空改该清单。生物 codec/字段清单、schema 校验和 U01 仍须同步登记可选 spatial 的缺席语义。若区域移入 Game 持久根或新增队列，则对应 U03 登记不可省略。

### 11.2 读档与录像完整性

读取顺序：纯验证版本/manifest/JSON/预算 → 解码所有实体与引用 → 按机械所有权分层 → 校验尺寸、整数锚点、身体边界、玩家1×1、ID/owner/模块绑定/区域一致性与活跃重叠 → 构建候选当前层索引 → 完整校验成功才退休旧局并绑定候选世界。load 不执行出生、生成、机关或死亡事实，不消耗 RNG。

缓存层分别验，不让旧的同一层缓存数组与当前列表重复索引。休眠预留和乘客/pending 分别用其合法状态合同，不把未放置实体强行验为当前层 footprint。地形可能在原生环境过程中变成阻挡/危险，合法存档不能一律以“当前 canFit=false”拒绝；读取强校验位置界限/活跃重叠/所有权，通行状态与待接触标志按原生合法状态验证。可预见的出生/位移失败则始终禁止提交非法 fit。

每条输入仍经 `executeCommand/executeItemCommand`，NPC 在原 `advancementLoop` 内行动，不能嵌套玩家命令。保存等待现有安全回合边界；扩展 checkpoint 继续保存完整包络，同时以有界、规范实体 ID 顺序的原生 spatial 世界摘要覆盖尺寸/位置/所属层/区域与 pending 状态，防止只有玩家位置相同而漏掉巨人分歧。无空间使用者时不添加空间机械摘要。随机/生物状态与现有录制来源校验保持，格式升级同时改 origin 最终检查点校验。

逐条 replay 与 seek 均通过原新局+命令执行重建占位，不从 UI footprint 猜世界。用巨人移动前后、受击、形态改变、坠落 pending、死亡、入层收据等切点做 save/load→续录；最终完整机械图、双 RNG 和模块收据等价，OOS 必须能指到空间摘要。篡改尺寸/重叠/owner/孤儿绑定/错误规则哈希在旧局退休前拒绝。空间能力 fixture 不依赖 giants 安装。

### 11.3 期望阶段 3 使用的可选接口

两个模块只依赖底座。本文建议的协议需维护者与阶段 3 设计对照确认；没有 phase3 实现时 giants 仍用原生即时攻击完整游玩。

| 阶段 4 提供 / 期望 | 约定与缺席行为 |
|---|---|
| 底座只读 footprint 查询 | 可信攻击计划给定 actorId 得占格集合/锚点/size/revision；玩家公开投影另行裁切。阶段3不 import giants，也不假设 size=1 |
| 相对攻击形状 | 预警格 = `(攻击者 footprint ⊕ 朝向变换后的相对偏移集合) − 自身身体`，再按技能 LOS/范围政策裁切；同源重叠格去重。形状原点/是否包含自身必须显式，不用左上锚点硬编码9份攻击 |
| 方向与射线出发点 | shape 使用固定8方向；定向单射线从 `nearestContact` 对应身体边缘出发，Minkowski 并集适用于面积形状。两者是不同 shape 原语，不能把九条独立射线无意变成九次攻击 |
| 目标收集/命中 scope | 阶段3的一次攻击子段交格集合，由底座按 footprint 收集实体、按该 scope 去重。独立后续子段显式新 scope，不因“同一只Boss”合并所有连段 |
| 计划与空间变化 | 准备时记 footprint revision；蓄力后移动/变形/强制位移由阶段3决定 cancel/重定位/重算政策并保存计划。它负责让预警与实际攻击一致，底座不替魂系模块猜时序 |
| actor-native 行动/耗时 | 在 `Monster.takeTurn` 选择行为、`tryMoveTo/CombatSystem.attack` 执行动作、原 endTurn/advancementLoop 提交耗时。当前 ControlledActionRequest 公开适配器仅支持玩家；阶段3若补NPC主动施放需共建原生actor接口，不能宣称已现成可用 |
| 可选魂系招式描述 | 后续可用版本化软能力查询（如 `combat.attack-profile.v1`，最终ID由阶段3提案确认）给冻结攻击描述；缺provider跳过并用即时 native attack。多provider冲突在注册预检拒绝，不能由加载顺序决定 |
| 身体/预警显示层 | 共用公开 footprint/render layer DTO，UI 只画已公开格。阶段3拥有预警配色/时序与技能提示，giants 仅贡献身体与血条 |

阶段 4 不实现预警、多回合计划、体力、闪避、韧性/硬直、弹反、篝火、掉魂或复活循环；不为缺阶段3报错，不把阶段3字段写进 giants schema。叙事可选 Boss 击败事实/成长可选奖励未来通过底座事实或协议接入，本阶段不扩目前单 storyFact 消费者协议，不让击败 Boss 默认成为剧情必需状态。

## 12 待维护者决定的产品问题

以下编号供答复“P4-D01=A”等。每项先给推荐，批准之前正文所述内容政策均是推荐设计，不代表自行裁定。空间原子性、按实体去重、确定性、只硬依赖底座等技术安全合同不是可关闭的产品选项。

| 编号 | 选项 | 推荐与影响 |
|---|---|---|
| **P4-D01 首次授权边界** | A 先独立做4a0，验收后逐步授权；B 连续授权4a0–4b | **A**：占位迁移涉及大量旧入口，先证明1×1无回归与删除模块后底座可用。B可加速，但每小步仍完整full并交报告 |
| **P4-D02 场地与追击** | A 可绕开侧室、硬守场（普通/强制位移均受边界）；B 侧室出生、自由追击可通行区域；C 主路必经场地与封门 | **A**：首版生成可控、失败可skip；B需额外防堵走廊/跨层，C需严格必达及锁门/撤退产品设计，不自动引入 |
| **P4-D03 大型者关系** | A 首版敌对，拒绝大型盟友/俘虏/支配/友方复制；B 允许盟友和支配，仍无大型俘虏；C 三者全部支持 | **A**：完整交付敌人而不扩救援/跟随范围；B/C必须增加交换、追层落位和相应UI验收，底座不硬编码敌对 |
| **P4-D04 危险边缘** | A 任一熔岩/火/气体接触生效，全部无支撑才坠落；B 同类接触生效，任一渊格就坠落；C 所有环境仅主格决定 | **A**：攻击尾格与环境尾格一致，大身体可以跨小裂隙；B更危险并需防场地边缘秒落，C会让可见身体踩危险却无效果，不推荐 |
| **P4-D05 刻符身体显示** | A 逐格轮廓+一个主字形；B 跨格放大字形且严格可见裁切；C 自有拼图字形/图块素材 | **A**：无需新美术，320宽和部分可见都清楚；B字形可能压住地形，C要另定资产制作/授权与四种地图降级 |
| **P4-D06 内容规模/生成密度** | A 先一个2×2原创敌人和侧室模板，再一个3×3；B 首次内容交付就两体型多模板；C 稀有普通大怪进入常规horde | **A**：先验完整闭环；具体名称、深度、属性、奖励与出现率仍由维护者在4d前定稿。B增内容调试，C扩大地图通行和生成普查范围 |
| **P4-D07 Boss 非尺寸免疫** | A 不按Boss身份额外免疫，变形/敌对克隆使用通用空间规则；B Boss拒绝变形与复制，位移仍可；C 连强制位移也免疫 | **A**：保留现有物品交互，体型变化有实测覆盖；B/C作为内容明示抗性可选，不用“占不下”代替免疫说明。无论选择哪项，底座仍须测试形态/落点能力 |

开局默认是否勾选 giants 沿模块选择器现有“可配置默认”的产品入口，本设计建议开发验收期间默认不勾选；正式默认组合与内容数值留维护者后续统一决定，不顺带改菜单默认。

## 13 与阶段 3 对照用的共享文件触碰清单

规模为**设计估算**：小≤约100行有效变更，中约100–300行，大>300行或多分支迁移；不承诺最终行数。路径下未列出的实际发现点要在实施报告补入清单。优先共享底座接口，避免阶段3/4各自引入一套 actor geometry、AoE 命中列表和耗时提交。

| 共享文件 / 范围 | 改动性质与规模 | 与阶段3的协调点 |
|---|---|---|
| `src/entities/Creature.ts`、`Monster.ts` | Creature新增可选spatial，小；Monster数据/构造、移动、近战、AI入口迁移，大 | 共用actor状态/朝向需求；不由本阶段加魂系字段 |
| `src/engine/Core/Game.ts` | 空间服务接线、查询/位移/武器/地形/目标/生成/持久，多处大改；预计数百行至千行级迁移，应按函数拆步 | **最高冲突**：受控行动、风险预检、近战几何、击退、NPC决策、录像checkpoint；先抽空间接口再分别接内容 |
| `Core/TimeCoordinator.ts` | 端口/接触摘要/环境失效，小至中；保留单实体调度 | 阶段3改蓄力/客观时序时共用一次耗时提交，禁止双推进 |
| `Core/MonsterLifecycle.ts` | 生命周期通知和死亡占位资格，小至中 | 暂停/死亡/重生时清计划与占位的先后 |
| `Movement/CreaturePlacement.ts`、`LevelTravel.ts`、`Entrancement.ts`、`Submersion.ts` | 整体落点/恢复/水下判据，中至大；`PlayerTravel.ts`只修大型障碍端口，小 | 闪避/冲刺与击退共用canStep/commit；不能两方重写placeCreature |
| `Combat/Combat.ts` | 邻接/接触上下文、命中出口去重，小至中 | 命中/反伤/抓持/韧性等共同结算顺序，现存双解算器都覆盖；不顺便合并两套实现 |
| `Combat/MonsterAI.ts`、`MonsterBlink.ts`、`MonsterAbsorption.ts` | footprint距离、可达、感知、缓存，中至大 | NPC选技与原生行动适配；巨人无phase3使用同一native AI |
| `Combat/BoltTrajectory.ts`、`Bolt.ts`、`BoltTargeting.ts`、`Cloning.ts`、`Conjuration.ts`、`Polymorph.ts`、`Domination.ts`、`CreatureFeatures.ts` | 占位/接触去重/落点与资格、通用形态特征贡献，中；轨迹纯几何尽量保留 | 远程招式和effect scope；1×1反射重访特例明确，模块形态不得硬导入 |
| `Map/Pathfind.ts`、`Pathfinding.ts`、`SafetyMap.ts`、`Scent.ts`、`WaypointMap.ts` | 增边谓词/体型视图，中至大；旧1×1路径不批量换算法 | 冲刺路径、威胁图、撤退/预警影响的可选代价 |
| `Map/Grid.ts`、`Promotion.ts`、`DungeonFeature.ts`、`Environment/Gas.ts` | 变更通知、DF作用域/身体暴露接口，中；不新增生物真相Cell位 | 破坏地形与范围技能必须通知同一revision |
| `Lighting/FOV.ts`、`LightMap.ts`、`UI/MonsterVisibility.ts` | 足迹LOS/遮挡/隐藏摘要，小至中 | 预警可见裁切与目标知识，勿把NPC FOV写玩家探索 |
| `UI/MonsterSidebar.ts`、`Appearance.ts` | 唯一entity row、公开格外观，小至中 | 状态图标/韧性条各模块贡献，底座row保持通用 |
| `Core/GenerationCoordinator.ts`、`Generator/Architect.ts`、`BlueprintEngine.ts`、`GenerationPlacement.ts`、`Stairs.ts`、`Map/AutoGenerator.ts` | 通用贡献/净空mask/楼梯填充过滤/事务写集，大；`Items/ItemSpawnHeatMap.ts`仅空间排除端口，小 | 篝火或其他场地共同预留、生成次序/预算冲突，不各自覆盖房间 |
| `Core/EntitySnapshot.ts`、`WholeRunSnapshot.ts`、`LevelSnapshot.ts` | 可选字段codec、分层验证、版本、pending元数据，中至大 | 统一格式升级；尸体/复活/计划持久必须同版 |
| `src/ext/types.ts`、`runtime.ts`、`world.ts` | 原生空间DTO/创建与区域能力、快照/验证/GC/事务，中至大 | 不混入某模块规则，不把已存在2c奖励事务当任意世界事务 |
| `src/ext/descriptor.ts`、`catalog.ts`、`registry.ts`、`compatibility.ts` | 底座版本与通用能力登记/精确校验，小；保持glob发现 | 不加giants/phase3硬导入；模块版本独立 |
| `src/ui/displayProjection.ts`、`presentationTimeline.ts`、`engine/Core/PresentationObserver.ts` | 历史帧body/hud公共投影，中；observer仅在确需新观察点时小改 | HP/位置/预警同帧，不暴露模拟未来 |
| `src/components/GameCanvas.vue`、`src/ui/retainedMapDrawing.ts`、`mapTileDrawing.ts`、`mapPointer.ts`、`targeting.ts`、`mapTileSemantics.ts`、`nearbyInspection.ts` | 身体组/遮罩/目标交互，中至大 | 身体/预警/目标层、缩放与触控点击协议；不加新物理输入屏障 |
| `components/Sidebar.vue`、`ContextPanel.vue`、`theme/ThemeNearby.vue`、`TargetBar.vue` | 若新row字段需接线，小；优先保持通用消费 | 不在共享组件按模块ID写Boss专用UI |
| `src/ext/ui/types.ts`、`ui/registry.ts`、`ui/useModuleUi.ts`、`App.vue` | 仅当前HUD插槽不足或历史帧DTO接线时增加通用插槽/展示端口，小至中 | Boss与阶段3资源条的并排/窄屏排布；不能必选另一模块UI |
| `src/ext/modules/growth/module.ts`、`skills.ts`、相关view/UI | 尽量只让底座validateAction自动支持；确有锚点假设时改为底座查询，小至中 | **只改该模块消费点，不让底座import growth**；它物理删除时这些改动随目录消失 |
| `src/ext/modules/growth/descriptor.ts`、`narrative/descriptor.ts` | 兼容新版底座声明，小；narrative无新增剧情内容 | 与阶段3统一兼容版本，不改历史报告 |
| `src/locales/zh_CN.json`、`content`通用词条 | 底座体型/空间失败提示，小；giants文本在自有locale | 玩家可见文本全部i18n；独立发现/删除仍成立 |
| `scripts/u03-state-contract.json`、`scripts/test-suites.json`、底座ext测试清单与 `src/test/…` | 仅新增Game字段时登记U03；登记底座测试/fixture，中 | 共用状态/录像/生成守卫，不借前提调整削弱有效断言 |
| `scripts/check-module-composition-smoke.mjs`、`check-module-removal.mjs` | 扩真实空间/新模块smoke与通用fixture，小至中；发现式矩阵保留 | 各模块子集及物理删除矩阵自动扩大，不只验两模块同开 |

**新增但不归模块的文件**：§3.1 四类空间文件、通用生成/形态贡献、footprint exposure辅助、底座测试fixture，随底座保留。**模块新增文件**：仅 `src/ext/modules/giants/**`。共享生产触碰候选约70–80个文件，包括可能只需核对或端口转接的文件；最终实改数量以逐步审计清单为准。生产数据不需改原目录，测试/格式清单变更另计。这里列候选触碰面，不建议一次改完，也不把“可能无需改”的文件当已承诺实施。

## 14 分步实施与验收计划

### 14.1 每小步固定门禁

实施获准后，每一步在同一最终正常候选树执行 **full（扩展政策）**：boundary → vue-tsc → build → 全部 `test:ext` → 完整 `npm test` 一次 → 所有已安装模块子集的真实 Game 新局/游玩/save-load/逐条 replay/seek/存档续录 smoke。Node 24.19.0、3 GiB堆、2 workers；准确命令、hash、退出码、数量、skip/todo、耗时入报告。不需要 `ce:fetch/test:full/test:gen`，不隐藏已有CE缓存。涉及实际生成变化另跑 `test:drift`。

真实删除副本用 **removal**：删除完整模块自有目录/数据/自有测试，清缓存，再 boundary/typecheck/build/全部剩余ext/所有剩余子集真实smoke/缺模块输入拒绝，不重复完整npm test；正常full单独必需。`--plan`、软件禁用、`--prepare-only` 和 `--engine-only` 均不能冒充已实际删除且已浏览器验收。

当前模块 growth/narrative 加入 giants 后，正常启用子集是8种，目录保留子集也是8种，其中7种实际删除行；phase3若届时安装，自动扩大到16/16，不预先假定其ID。模块自有测试归模块的 `test-suites.json`，底座footprint测试归共用底座清单，删除giants仍要运行。每小步完成停交维护者，不自动推进下一步、合main、部署或commit。

### 14.2 分步交付矩阵

| 步骤 | 实施范围 | 验收标准与有意义的新增测试 | 档位 / 浏览器人工验证 |
|---|---|---|---|
| **4a0 底座占位入口迁移** | 原生足迹/空间facade、生命周期索引、受控位置提交、codec与版本预留；正式内容未接入。先以1×1验证，底座2×2 fixture仅测索引 | 查询四尾格同ID、自重叠、无覆盖、死亡DF窗口、休眠策略差异；所有活写出口登记；故障回滚完整对象图/引用/索引一致；无能力真实Game差分机械状态/消息/双RNG相同。底座fixture可保存/读回并重建，不声称已有巨人寻路 | **full**；现有桌面/320/390普通与沉浸游玩无界面回归，尾格检视可先由诊断fixture验；无自然巨人内容 |
| **4a 移动、落点、寻路与环境** | 2×2完整行走/推退/传送/出生/跨层/变形；地形exposure与缓存。几何以N参数实现，3×3暂只做底座边界fixture，正式全链路推广留4d-2 | 窄道拒绝、足够宽通过、保守对角、自旧格重叠、动态堵路、门/DF/气体失效、无位失败不半提交；任一熔岩/气体一次、全身体无支撑坠落、多个独立陷阱、触发瞬移后不处理旧格；pending无空间存读续录；固定场景性能报告 | **full**；若修改生成落点/公共生成实质影响追加drift。人工移动/击退/部分身体遇火水/开门；可用底座诊断层，不冒称自然生成 |
| **4b 攻击、目标与视野** | 几何武器、射线/投掷/爆炸/范围收集、成长validateAction消费、LOS/感知/隐身 | 鞭/矛/横扫/闪电/爆炸多格只一次，独立子段仍多次；真实符文/抓持/反伤/击杀/成长消费一次；混合1×1反射重访保持；从尾格命中/选中，隔墙/斜角不合法；感知只一骰、身体部分显影不露隐藏格 | **full**；桌面右键、手机长按/瞄准确认/目标切换、隐身气体、部分可见、自动行进打断；成长关闭和开启都试玩 |
| **4c 身体呈现与通用UI投影** | 四地图身体组、公共row、历史DisplayFrame、目标层；底座假Boss DTO展示通用HUD接线，正式血条在模块步骤 | 一体一row/浮字；碰撞格与高亮一致；隐藏身体裁切；显示反复刷新不改变规则两流；旧ACK帧与未来HP/位置隔离，seek清旧绘图/目标；无giants也编译/渲染fixture | **full**；1440×900、390×844、320×844 × 普通/沉浸六布局，四地图模式、缩放、部分遮挡、快速瞄准/取消、横竖切换；触控未实测需明示 |
| **4d giants模块与场地** | 自有schema/敌人/场地数据、descriptor、AI声明、生成/形态贡献/区域、收据/绑定、正式Boss血条；4d-1先完成2×2自然生成全链路，验收后4d-2推广3×3并重跑同等覆盖 | giants-only真实新局自然生成/交战/击败；无growth无phase3可玩；区域净空/入口/玩家与Boss可达/绕行验证；失败skip、重访不复生、批次ID预算、生成异常回滚；内容换名/合法换尺寸无需硬编码；所有8子集save-load/replay/seek/续录，其中含giants子集须有自然巨人 | 每次交付**full + drift**；各体型真实生成场地、追击/回归/边界与血条消失、320/390长名称/气体/伤害消息；正式包生成后验，不只fixture |
| **4e 收尾、可移除与配置手册** | 补所有生成/位移/关系遗漏、格式攻击负例、组合与删除矩阵、内容配置说明/最终报告 | 全部目录子集实际删除+剩余smoke，giants删掉底座2×2/3×3仍全过；依赖giants旧档拒绝、未选giants新局正常；离层缓存/pending/变形/死亡切点续录；如phase3已安装再验可选provider缺席/非法/顺序与16子集；明确未支持4×4/多段身体 | 正常**full**，删除**removal**；若有生成收尾则drift；最终构建真实浏览器复验六布局、native与可选魂系场景，截图只存仓库外 |

4a 的环境迁移较大，可由维护者拆为4a-1几何/位移、4a-2环境/缓存、4a-3体型推广；每个小步同样full、独立报告，不能用拆步规避最终真实Game验收。4a0若将纯codec升级与所有位置迁移难以安全同交，可先交协议/预检，再迁移写出口；不提前宣称多格能力完成。

### 14.3 每步真实 Game smoke 的最低内容

正常树所有已安装子集都用真实 `Game.startNewGame`、公开 `executeCommand`/`executeItemCommand` 驱动；至少游玩移动、等待、一次合法战斗/物品行为，保存→加载继续，导出→loadReplay逐条到底，seek 0/中段/终点，存档→继续→导出续录。比较机械世界、消息/时间、双 RNG 与适用模块收据，不只检查“没抛异常”。

底座步骤尚无正式giants自然出生时，多格专项由原生fixture建立并明确标为fixture；无能力组合仍跑真实新局。4d之后giants每个含giants的子集必须另有固定种子**自然新局场地**闭环，不能每次调试注入Boss替代自然生成；测试fixture不作为正常模块出现在菜单/manifest。缺可选模块的场景须触发实际替代行为，不仅开关一次。

真实删除矩阵优先沿现有 `scripts/check-module-removal.mjs` 和 composition smoke 发现器扩展，所有保留子集照跑；移除giants的副本仍跑底座多格fixture，同时拒绝要求giants的保存输入。浏览器操作必须使用当次构建包，报告版本/包hash与设备；没有真手机只能报告触摸模拟，不能宣称设备实测。

### 14.4 必须保留的异常与交付证据

- 坏尺寸（0/负数/小数/4/非方形）、超界/负锚点、重叠、ID重复、假owner、孤儿arena/Boss绑定、player多格、未知模块/错误版本/指纹、超预算区域/实体全部明确拒绝。
- prepared目标在确认等待中移动/变形、机关重入造成死亡/瞬移、DF发生在尾格、生成中途throw、死亡乘客释放、无位坠落等待、重复入层与seek收据均有专门场景。
- 每份实施报告列共享文件实改清单、版本/机械规则改变、仍有效测试覆盖及任何前提调整的依据、基线变化原因、正常full/removal各自结果、性能与浏览器未验证项。不把静态审计、估算或本设计的验收计划写成运行证据。

本轮交付边界止于设计与审阅链接；上述实施和产品选择需维护者另行裁定。
