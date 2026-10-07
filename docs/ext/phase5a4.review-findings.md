# 5A4 采食底座独立审阅（只读）

- 对象：`/Users/coolking70/Documents/同步空间/BrogueJS-p5`，分支 `ext/phase5`，HEAD `53efa07` + 未提交工作树（5A4a–d）。
- 方法：读 diff 与新增文件；repro 全部在副本 `/private/tmp/p5a4-review`（rsync，去 .git/dist）中进行，新增临时测试 `src/test/zz_review_chain.test.ts`、`src/test/zz_review_more.test.ts`（已登记到副本的 `scripts/test-suites.json`），只在副本里加了埋点。工作树未改动。
- Node：codex runtime v24，`--maxWorkers=1`。
- `worldSdk.ts` 与 HEAD 字节一致（`git diff --quiet` 通过，SHA-256 `297803af…fa343`）。

## 一、按严重度排序的问题

### P1（高）离队中的同伴仍会攻击，一回合还能多次行动，并会走进熔岩死亡（违反 E26）

位置：`src/engine/Core/ActorDeparture.ts` `departureStep`（候选循环 `for (const p of candidates) if (game.moveDepartingActor(actor, p)) break;`）→ `Game.moveDepartingActor` → `Monster.moveForDeparture` → 原生私有 `tryMoveTo`。

1. **会攻击**：`tryMoveTo` 移动前先跑 `performWhipAttack` / `performSpearAttack`（矛：goblin、goblin_warlord；鞭：salamander）。goblin 是最常见的被俘同伴。
2. **一回合多次行动**：攻击时 `tryMoveTo` 返回，但位置没变，于是 `moveDepartingActor` 返回 false，循环接着试下一个候选格。结果同一回合里先攻击、再移动，或者对不同目标连续出手。呕吐（`tryVomit`）、蛛网挣扎等失败分支也会反复触发。
3. **踩危险地形**：候选格只过滤了"界内、无怪、非玩家格"，既没调用 `monsterAvoids`，也没检查伤害地形。楼梯不可达时走"远离玩家"分支，排序只看与玩家的距离；楼梯可达时，较优格一旦失败也会回退到距离为 30000 的阻挡格。熔岩对 `terrainPassableOrSecretDoor` 来说可以通过。死亡后走原生死亡流程，进复活池，与"非死亡退役"相反。

Repro（副本）：
- 矛击：goblin 同伴在 (11,10)，玩家在 (10,10)，敌对 rat 放在 (9,12)；`departure` grace=300 之后执行 `departure-step`。结果 **rat hp 6→0**，同伴还在同一步移到了 (11,11)。
- 熔岩：把 5..15 区域四周围成 GRANITE 使楼梯不可达，(12,9)/(12,10)/(12,11) 铺 LAVA，执行 `departure-step`。同伴走到 (12,9) 熔岩上，再过一回合 **hp 0，`purgatory` 包含它**。

修复方向：离队专用一步移动。(a) 只选一个目标格，用原生 `monsterAvoids` / `speciesForbiddenFlags` 加伤害地形过滤；(b) 用不含攻击的落位原语（与 `tryMoveTo` 后半段同样的通行检查 + `commitCreatureAnchor`），不经过鞭/矛；(c) 每回合最多尝试一次，失败就原地等待。补回归：矛/鞭同伴在离队路径上不出手；危险格不进入；每回合最多一个动作。

### P2（高）`qualifies` 抛异常或返回非布尔时，异常直接穿出原生流程，盟友状态只改了一半（与报告"异常不作为资格 true；诊断"不符）

位置：`src/engine/Core/ActorNeeds.ts` `triggerActorNeeds`。`participant.qualifies` 没有 try/catch，返回非布尔时还显式 `throw new World5Error('C5_PROVIDER')`。调用点都在原生流程里：`becomeAllyWith`（Game.ts:14243，包括生成期 2414/2452、法杖支配、解救俘虏、9637 克隆）、`relationshipChanged`（runtime.ts:1404，polymorph 中途）、体群 `group-changed`（6607/12789）。

Repro：把 fgfixture 的 `qualifies` 改成 `throw` 或 `return 1`，直接调用 `g.becomeAllyWith(goblin)`：
- throw：`Error: boom` 穿出，`isAlly` 已经是 true，诊断表为空；
- 非布尔：`C5_PROVIDER` 穿出，同上。

影响：模块缺陷会让玩家移动、施法或关卡生成中途抛错。体群成员只处理了前一部分；polymorph 停在中间。

修复方向：按 E29 的时间路径语义，捕获异常、Promise 或非布尔，视为 `false`（不挂载、不删行），调用 `runtime.noteEdibleDiagnostic(owner,'qualifies')`，不得向外抛。

### P3（中高）需求时钟的"下一到期"缓存在行所属生物重新进入活动层时不失效，band/deadline 事件静默停摆

位置：`ActorNeeds.ts` `nextDue` / `settleActorNeeds`。`nextDue` 只统计 `game.monsters + dormantMonsters` 里的行，结果缓存在 `due`。生物经 `monsterEntersLevel`（Game.ts:2003，由 `monstersApproachStairs` 在客观块里调用，正好在 `settleEdibleClocks` 之后）、休眠切换等途径进入活动集时，没有调用 `invalidateNeeds`。

典型场景：玩家下楼，落后的同伴 `entersLevelIn>0`。入层时 `settleActorNeeds(true)` 看不到它，`next=Infinity`。同伴几回合后到达，此后 band/deadline 不再触发，直到别的写点（喂食、死亡、trigger）刚好失效缓存。离队也因此不会发生。

Repro（以移出/放回 `g.monsters` 模拟在途）：先 `advance 100 deferred` 并让同伴不在活动层，再放回，然后 `advance 5000`。结果 band 仍为 `full`，`deadlineFired=false`，事件只有 `["attached"]`。对照组（不移出）得到 `["attached","band","deadline"]`，band=`empty`。

修复方向：任选其一。(a) `nextDue` 对所有行计算（只跳过离队中的），不按活动集过滤；结算时再按活动集跳过。(b) 缓存里同时记录活动集签名（如 monsters/dormant 的 id 集合 hash 或引用），不一致就重算。(c) 在 `monsterEntersLevel`、`toggleMonsterDormancy`、复活和 `restoreLevelResidents` 等加入活动集的点调用 `invalidateNeeds`。推荐 (a)，最少依赖调用点。

### P4（中）复活的同伴不会重新挂载需求行（违反 E25）

位置：`Game.resurrectAlly`（Game.ts:13231）。复活走 purgatory 原路，不经过 `becomeAllyWith`，也没有调用 `triggerActorNeeds(...,'ally-gained')`。

Repro：同伴有 1 行；`takeDamage(1000)` + `search` 后，行数 0，在 purgatory；`g.resurrectAlly({12,12})` 返回 true，hp 15、`isAlly` 为 true，**行数仍为 0**。

修复：在 `resurrectAlly` 成功、`this.monsters.unshift(candidate)` 之后调用 `triggerActorNeeds(this,[candidate],'ally-gained')`。体群核心要连同成员一起传入。补回归。

### P5（中）玩家着火时在 DF 事务内部直接排空火接触队列，打破"DF 回调只入队、最外层结算排空"的契约

位置：`Game.exposeCreatureToFire`（11883，`current===0&&entity===this.player` → `igniteEdibleInventory`）→ `FireContact.igniteEdibleInventory` → `drainFireContacts`。DF 铺火格时，`refreshFeatureCell → instantEffects → applyDungeonFeatureContact → applyEnvironmentalEffects → applyContactFire → exposeCreatureToFire`，因此排空发生在外层 DF 的 `executeDungeonFeature` 中途。

后果：
- 本 DF 中先前由 `burnItems` 入队的地面接触被提前处理；
- 背包爆裂产生的 `DF_EXPLOSION_FIRE/BLOAT` 作为外层 DF 的子事务生成（继承 parent、共享 `caughtFire` 和方形生物的 `contactScope`，方形生物的二次接触会被同 scope 去重），并在外层 fill 仍在进行时改写格子；
- `spawnSettled` 不为这些爆炸触发。

结果仍可确定地重放，但时序不符合任务书/报告的 FIFO 最外层语义。

Repro（副本给 `drainFireContacts` 加了 `activeOptions.has(grid)` 埋点）：背包放 6 种可食物，地面 (11,10) 放 raw，对玩家格执行 `DF_FLAMETHROWER`。埋点得到 `drains=[{nested:true,pending:[carrier-ignited,carrier-ignited]}]`。

修复（已在副本验证）：在 `DungeonFeature.ts` 导出 `dungeonFeatureActive(grid)`，`drainFireContacts` 开头加 `if (dungeonFeatureActive(game.grid)) return;`，交给最外层 `spawnSettled` 排空。改后同一 repro 为 `drains=[{nested:false,pending:[carrier-ignited,carrier-ignited,spawn-fire]}]`，`closedLoop`（save/load/replay/seek/续录）通过，`ext_fire_contact_runtime.test.ts` 22/22 通过。

### P6（中）未知可食物的真实定义键经原生消息泄露

位置：
- `Game.equipItem`：5A4 把 `if(this.rejectMaterialUse(item))return;` 改成对可食物放行（`!edibleDefinition(...)&&`），于是落到 `Player.equip` 返回 false，打出 `item.equip_fail`，`name: item.name`。
- `Game.dropItem`：Game.ts:5147，`item.drop`，`name: item.name`。

`item.name` 是真实定义的 `nameKey`（如 `ext.foraging.<kind>.name`），未翻译，直接显示。

Repro：未知 sample7（显示名"外观样本a2"）先 equip 再 drop，日志为 "You cannot equip the **ext.fgfixture.sample7.name**." 和 "Dropped **ext.fgfixture.sample7.name**."。

修复：equip 对可食物恢复 `rejectMaterialUse`，或给出专用"不能装备"消息，名字用 `displayName`。`item.drop`（以及同类的 `item.equip/unequip`）改用 `displayName`；后者对已有材料也是显示缺陷。补"未知可食物所有消息不含定义 ID"的回归，可扫描 logger 文本里的 `ext.<owner>.`。

### P7（中，性能）20 件连锁爆裂的主要开销是每个接触都调用 `prepareFlareKnowledge`，复杂度为平方

位置：`FireContact.drainFireContacts` 循环末尾每件都调用 `game.requestEdibleRender()` → `prepareFlareKnowledge()`。每次有新 flare 时，都会对**全部**活动 flare 的所有帧重绘光照并刷新 FOV。

实测（副本，单格 20 件 sample7，fixture 场景）：

| 场景 | 总耗时 | 其中 render |
| --- | --- | --- |
| q=1（EXPLOSION_FIRE） | 约 54 ms | ≈0 |
| q=3（BLOAT），修复前 | 167 ms | 125 ms |
| q=3（BLOAT），修复后 | 54 ms | 9–18 ms |

参与者/事务每件约 0.2 ms，不是瓶颈。报告的 726 ms 可能来自更大的可见区或光照场景，我在 fixture 中没有复现到这个数值，但平方项已经确认。

修复（已在副本验证）：循环内只置标志，循环结束后调用一次 `requestEdibleRender()`。改后 `ext_fire_contact_runtime.test.ts` 22/22 通过（含 closedLoop、roast 失败 render 回滚）。注意：flare 的 `remember` 帧现在在最终地图上评估，可能改变少量 `isExplored`，需要按原方法重录受影响的黄金文件。

递归与上界：`spawnSettled→drain` 被 `draining` 挡住，连锁是迭代式的；每件物品每次排空最多处理一次（`processed`）。总数受地面可食物数量约束，无需额外上限。可选：入队时按 itemId 去重，减少大火 DF 产生的重复项；单次排空若超过 N 件，只合并渲染，不拆帧（保持任务书的同步 FIFO）。

### P8（低中）离队状态的其他边角

- `settleDepartures` / `retireActor` 只在 `game.monsters/dormantMonsters` 里找。离队者若坠落（`pendingFallenByDepth`）或在其他非活动表里，`active` 行会永久残留；`leaving` 时也不清。建议在离层时把找不到实体的行一并退役，或写诊断后删除。
- `advancementLoop` 的 `dueActors` 是快照。同一推进块内，若需求事件里的 `depart`（`onNeedEvent` 任何事件都允许 `depart`，不限 deadline）导致不可见离队者被立即 `retire`，该生物 hp>0，仍会在本块被调度行动（成为幽灵）。建议给退役者加标记，由调度过滤；或只允许 deadline 事件 depart；或把 retire 延到边界。
- 楼梯格带 `TM_PROMOTES_ON_STEP`（`DF_REPEL_CREATURES`），"到达楼梯格即退役"可能很少命中，主要靠 grace/不可见。行为上可以接受，建议补测试确认。

### P9（低）知识登记表的展示层还有可区分信号

- 基础层没有校验同一知识组内 raw（以及 roasted）成员的 `glyph/color/maxStack/tags` 一致。设计文档 §113 要求"所有种类统一 `#B8A4E0`"，但只是内容约定。若 5G 有一处写错，颜色、堆叠上限或 tags（5D 经 ItemRead 可见）就会跨局暴露种类。建议在 `validateEdibleDefinitions` 中对知识组成员强制这些字段一致。
- 结束画面 `GameEndOverlay.vue:136` 显示 `item.name`（原始键），材料原有问题，揭示时机可以接受，但会显示内部键。

### P10（低）其他

- `spawnDungeonFeature` 的 `finally` 在 DF 抛错时也会调用 `spawnSettled`，在半完成的地图上排空，且可能用新异常覆盖原异常。建议只在正常返回路径调用，或 try/catch 只记录诊断。
- 沉眠的玩家：`Player.recoverPerTurn` 的饥饿扣血直接 `hp -= 1`，不唤醒；`TimeCoordinator:315` 自动进食只检查 `paralyzed`，沉眠时会自动吃；`tickNutrition` 沉眠时继续消耗。三者都和"失能"口径不一致，建议统一用 `isIncapacitated` 或明确写入规则。沉眠自然到期也没有"可以动了"之类的提示。
- roast 的 `drainFireContacts(game,true)` 对**整条连锁**都用 strict。热源格爆炸引燃旁边地面可食物时，后者的参与者失败会回滚整条 roast 命令。任务书只要求"整堆一次 strict"，建议只对 roast 目标 strict，连锁接触降级。
- feed 超喂确认借用了 `risk.kind='tool-break'` 做录像决定的载体，语义错标。建议新增 risk kind，或在 UI/录像审计里注明。
- `readVisibleInteractables` 对每个 view 做 `worldWorkEntities().find(...)!`，复杂度 O(V·E)，找不到时直接崩溃；hover 也会调用。量小，可改成 Map。
- 跨多个 band 一次结算时只发一次 band 事件（例：full→empty 跳过 low），模块收不到中间档。如果这是有意的，应在 SDK 文档写明。

## 二、已核实且无问题的项目

- 经典局与无采食扩展局：
  - `Item.fireContactCooldownUntilTurn` 用 `declare`，不产生自有属性；`serializeItem/deserialize` 在非自有时删键，经典条目字节不变。
  - `spawnSettled` 在经典局只做一次 WeakMap 查找后返回。
  - `burnFloorItemsAt/burnFloorItems` 在无 runtime 时 `edibleDefinitions` 返回 []。
  - `igniteEdibleInventory` 在背包无可食物时 0 次 RNG。
  - `departureTurn/isDeparting` 在无 runtime 时短路；`settleEdibleClocks` 各函数无 runtime 时 return。
  - `runtime.transaction` 新增的是 `structuredClone({})`。
  - `worldDefinitionFingerprints` 只对声明了新键的包加 `foundationEdibleRules`，旧包指纹不变。
  - `destroyFloorItemsInLava` 只在 `applyEnvironmentalEffects` 的全局分支（instantTarget 早返回之后），不在 DF 内。
- 移除先于效果：floor/inventory 都先 `removeEdibleFloorItem/removeItem/转化`，再调用参与者、写消息、生成 DF；`processed` 保证同一次排空每件最多一次；`draining` 防止重入；连锁时自爆物品不会再被接触；lava 绕过冷却但仍受 `processed` 约束；抛出物克隆删除冷却；`Inventory.addItem` 和偷窃都删除冷却；`EdibleValidation` 只允许 floor 根带冷却（`pendingFallenItems` 也算 floor）。
- 确定性：派生抽样不读原生 RNG；外观/效果/seed 的 memo 按 runtime 键，load/seek/新局都会新建 runtime；读档候选对象带 `currentSeed`；`transactEdible` 回滚时 `clearFireContacts`；`toSnapshot` 在队列非空时拒绝保存（同步路径下边界处恒为空）。
- 沉眠：
  - 免疫沿用 paralysis；Creature/Monster 的伤害提交与护盾全吸收都先唤醒；体群 owner 用 `bodyStatusOwner`；
  - 与麻痹并存时唤醒只清沉眠；
  - 战斗必中、×3、`circumstance:'asleep'` 正确；
  - 跟随换层、体群动作与方形移动 gate 都改用 `isIncapacitated`；
  - `prepareNativeDecision` 中离队 step 已移到失能 gate 之后。
- 热源识别：combat 篝火通过 `actorActionBinding().state.bonfires.bindings`，crafting 通过 `station.hearth` 标签，均无硬 import；同层、可见、距离、交互线的检查齐全。
- 离队退役清理：`monsters/dormant/levels/purgatory/pendingFallen/bodyGroups/visible` 集合、leader/carried 引用、扩展组件与属性账本、phased attack 与 production source 均已处理；`excludeLevelFollower` 排除离队者；离层时同事务退役。
- `worldSdk.ts` 字节不变；boundary 规则把新的可信实现加入了禁止内容模块直接 import 的名单。
- 投射与知识：detect magic 的 polarity 对 MATERIAL 为 0；`itemView` 只含 id/category/quantity；`readEdibleContext` 只供 owner；未知物确认用组内最大饱腹值；详情里未知物不显示效果和饱腹；幻觉下名字不随机化（按规范）。

## 三、建议优先级

合入前修复：P1、P2、P3、P4、P5、P6，各补一条回归。P7 改动很小，收益明显，但需要按原方法重录黄金文件。P8–P10 可以登记到 5G/5D 交接或 5Z 收尾。
