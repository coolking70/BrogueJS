# 5A2-S 独立审查（只读）

对象：`/Users/coolking70/Documents/同步空间/BrogueJS-p5` @ `2d870a2` + 未提交工作树（5A2-S）。工作树未改动。所有复现都在 `/private/tmp/p5rev`（脚本）与 `/private/tmp/p5fix`（工作树副本 + 候选修复）中完成。临时 worktree `/private/tmp/fnd`（5180f6c）与 `/private/tmp/r5a1`（c3319ae）用完已 `git worktree remove` 并 prune。

环境：Node 24.19.0，`NODE_OPTIONS=--max-old-space-size=3072`，脚本均用 Vite SSR 直接加载各树源码。

---

## 第二部分（优先）：`Actor action scheduler: inconsistent phase clock` 崩溃

### 结论

- **不是 5A2/5A2-S 引入的**，是 **3A0 起就存在的调度器缺陷**。`commitBundle` 的候选态校验最早见于 `21aceeb`（2026-10-05，“add 3a0 actor action foundation fixtures and native scheduler bridge”）。
- 用同一 seed 和同一命令表，在当前 5A2-S 树、已验收的 5A2 树（`/private/tmp/p5a2s-baseline-readonly` = 2d870a2）、5A1 `c3319ae`、foundation `5180f6c` 上**都在同一条命令崩溃**。
- 严重度：**高**。错误在 scheduler `run()` 内抛出后会经 `onFault` 锁存，这一局/录像随即作废。启用 combat 模块时，只要同一 tick 内出现“id 较小的 NPC 自由决策并提交新动作，而 id 较大的 NPC 的分段释放恰好到期（剩余 0）”，就会触发；多怪混战里这很常见。

### 精确复现

- seed **7397**，模式 `wizard`，ruleSet `extended`，模块 `growth,narrative,combat,giants`，带各模块的 `initialCommand`（脚本 `/private/tmp/p5rev/repro.mjs`，用法 `node repro.mjs <树根> <命令表.json>`）。
- 命令表（`/private/tmp/p5rev/cmds-current.json`，共 27 条，第 27 条即 i=26 时崩溃）：
  `wait×11, move(-1,0)×5, wait×2, move(0,-1)×4, move(1,0), move(-1,0), move(1,0), move(0,-1), move(0,-1)`
- 崩溃瞬间的状态：
  - 怪 **id8**（Kobold，t=0）在 dueActors 按 id 排序的循环里先于 id10 处理。它做自由决策，走 `PhasedAttackProduction.select → commit → scheduler.commitBundle`。
  - 此时怪 **id10** 的 combat bundle（actionId 2）处在 inter-segment index1，`phaseRemainingTicks=0`，`elapsedActionTicks=70`。它已经到期，正等着本循环稍后的 `dispatchActorBoundary(10)`。
- 结果：4 棵树全部输出 `CRASH 26 ["move",{"x":0,"y":-1}] Error: Actor action scheduler: inconsistent phase clock`。

### 根因（file:line）

- `src/engine/Core/ActorActionScheduler.ts:453-456`（`commitBundle`）：

  ```ts
  const candidate = { schema: 1, bundles: [...state.bundles, copy] };
  validateActorActionSchedulerState(candidate);   // dueBoundaries 取默认空集
  ```

  这里用严格编解码校验检查了**全部现存 bundle**，而不只是新 bundle。

- `ActorActionScheduler.ts:229`：现存 bundle 只要有活跃子动作 `phaseRemainingTicks < 1`，且不在 `dueBoundaries` 中，就判为 `inconsistent phase clock`。

- `ActorActionScheduler.ts:156` 的注释写着“Zero is permitted only transiently inside a synchronous dispatch microstep”，这个前提不成立：
  - `TimeCoordinator.ts:152` 的 `advanceActionTime` 把 bundle 推到 0 之后，零值会一直保留，直到 `TimeCoordinator.ts:198-214` 的 dueActors 循环（按 id 升序）轮到这个 owner。
  - 在此之前，id 更小的 actor 可能做自由决策并提交新 bundle。

- 对照：模块事务校验早已知道这个窗口。`src/ext/actorActionValidation.ts:364-368` 的 `validateProductionActorAttackTransactionState` 会构造同样的 due 集合，唯独调度器自己的 `commitBundle` 漏了。

### 修复方向（已在副本验证）

在 `commitBundle` 里，把现存的、处于前台的、已到期的子动作身份放进候选态校验的 `dueBoundaries`：

```ts
const due = new Set(state.bundles.filter(foreground).flatMap(b => b.subactions
    .filter(child => active(child) && child.phaseRemainingTicks === 0)
    .map(child => `${b.actionId}:${child.sourceSubactionId}:${child.phaseIndex}`)));
validateActorActionSchedulerState(candidate, due);
```

新 bundle 本身仍由 `:453` 的单独严格校验和 `fresh action` 检查约束。存读档（`snapshot()`）仍用严格默认值，不放宽编解码。

验证（`/private/tmp/p5fix`，只改这一处）：

- 同一路线跑 120 条命令全部完成。test 模式（debug 缓存对照开启）下跑 150 条，也无漂移、无崩溃。
- `phase3a0_scheduler`、`ext_combat_transition_facts`、`phase3b_body_action_resolution` 共 55 项通过。
- combat/giants 全套模块测试未跑（耗时约 30 分钟），修复落地时需补跑。

备选方案（不推荐）：改 dueActors 循环，先派发所有到期 bundle，再处理自由决策。这会改变既有的同 tick 按 id 顺序的语义和 trace。

另需注意：`PhasedAttackProduction.ts:404`（`bindPhasedAttackProduction`）在 session 状态身份变化时，会用 `new Set()` 严格重验，而它会在 NPC 回合中途被调用（`canPayNativeActorAttack:187` 等）。目前事务回滚保留了状态身份，所以没有触发，但它属于同一类隐患。建议同样改用事务版 due 集合，或者断言该路径只在 tick 边界执行。

### 回归测试大纲

1. **单元**（`src/test/phase3a0_scheduler.test.ts`）：
   - `fixture(100,[actor(2,0),actor(3,0)])`，提交 bundle(3)（windup 20），`advanceActionTime(20)`，此时 owner3 到期为 0。
   - 再 `commitBundle(createActorActionBundle(definition(2)))`：期望不抛错。然后 `dispatchActorBoundary(3)` 应解析 `resolve:3:1:0`。
   - 现状下这里会抛 `inconsistent phase clock`。已用脚本 `/private/tmp/p5rev/unit.mjs` 证实：原树 FAIL，修复副本 OK。
2. **循环级**：同一 fixture 走 `drain()`，让 `monsterTakeTurn` 对 id2 的 mock 在 owner3 到期的 tick 内提交 bundle。断言事件顺序为 `native:2` → `resolve:3…`，并且没有 fault。
3. **端到端**：seed 7397 + 上面 27 条命令，四模块（或仅 combat），断言不崩溃；接着做 save/load、逐条 replay、seek，均零 OOS。
4. **反例**：现存 bundle 若是非到期的 0（不在前台的层、或已取消），commit 仍须拒绝；`snapshot()`/load 遇到到期为 0 的状态也须拒绝。

---

## 第一部分：5A2-S 缺陷（按严重度排序）

### F1【高｜经典零修正等价被破坏】`native.attack-speed` 硬上限 400 截断了原生减速后的攻速

- **位置**：`src/engine/Stats/NativeStatKeys.ts:57` `key('attack-speed','tick',25,400)`。`evaluateStat` 无论有没有来源行都会做键硬限钳制（`StatPipeline.ts`，`numerator > max*denominator` 处）。
- **哪些生物会超限**：monsters.json 中攻速 250（arrow/dart/flame turret）、300（goblin_totem）、400（ogre_totem）；另有攻速倍率 2.0 的变异作用在 200 攻速怪身上。这些生物被 slowed（×2）后原生值是 500/600/800，管线返回 400。
- **复现**：`/private/tmp/p5rev/speed.mjs`（经典、无 runtime 的 standalone 管线）。

  | 生物 | 原生字段 | 管线值 |
  | --- | ---: | ---: |
  | goblin_totem | 600 | 400 |
  | arrow_turret | 500 | 400 |
  | ogre_totem | 800 | 400 |
  | rat（对照） | 200 | 200 |

- **影响面**：读取点 `Monster.endTurnWithAttack`、`ticksUntilTurn = nativeStat(...'native.attack-speed')` 等都已改读管线，所以**经典局里被减速的箭塔会比 CE 攻击得更快**。这违反任务书不变量 1（零修正等价），也违反“经典零影响”。影子测试没覆盖这种怪物和状态组合。
- **修复方向**：
  - 上限至少取“原生最大攻速 ×2（slow）×2（变异）”，例如 2000 以上；任务书 S11 的“≥原生 ×10”原则对攻速同样适用（S11 示例 25…400 与之冲突，需维护者裁定）。
  - 或者 clamp 只在存在模块来源时生效，与 hit-chance 无来源时直接返回原值的做法一致。
  - 补影子用例：slowed 状态 × 全部怪物类型的攻速/移速，以及 MONST_CAST_SPELLS_SLOWLY。
- 修改硬限需升 foundation 号（stats-config 已有规定）。

### F2【中，阻塞 loot】`refill-delta` 判定按“整键是否含永久行”，换装会白嫖回血

- **位置**：
  - `src/engine/Stats/MaterializedStats.ts:27-29`：`permanent = rows.some(r => r.grantPolicy === 'refill-delta')`，`refill = permanent ? max(0, bonus - old) : 0`。
  - `src/ext/runtime.ts:424` 的写回会按 `refill` 加 HP（前提是没有 growth 提案）。
- **问题**：只要 growth 给某个 actor 写了永久 max-hp 行（分配过体质/升级），**同一键上任何其它来源的增量**（未来 loot 的 `native.max-hp` 装备行、growth 在无提案时变化的临时 build 行、聚落光环）都会被当作永久增量补血。
- **复现**：`/private/tmp/p5rev/refill.mjs`。用真实 `StatPipeline` + `MaterializedStats.reconcile`，growth 永久 +10，再装备一件 +30 的 equipment 行：
  - 装备前：`{maxHp:40, hp:20}`
  - 装备后：`{maxHp:70, hp:50}`（白补 30）
  - 卸下后：`{maxHp:40, hp:40}`
  - 反复穿脱即可回满血。这违反 S4/stats-config 的“装备、光环、临时技能不得补血”。
- **修复方向**：
  - 补血量只取 refill-delta 行之和的增量，需要记住上次永久部分。可在账本行附带 `permanentBonus`，或由 growth 在自身资源提案里显式给出补血量。
  - 或者在 reconcile 里分别算“全部行”和“去掉 refill 行”两个值，只把永久部分的差额作为 refill，这同样需要持久化上次永久值。
- **回归**：growth 永久 HP>0 时，装备/卸下 equipment 层 max-hp 行，HP 不变（只钳制）；升级时只补永久增量。

### F3【中｜仅扩展局】护甲被酸腐蚀后不标脏，防御缓存陈旧

- **位置**：`src/entities/Monster.ts:1585` 与 `:2212`。`game.player.equippedArmor.enchantment -= 1` 之后没有 `markStatsDirty(player)`。
- **时序**：这次命中的命中判定和 takeDamage（会标脏）都在腐蚀之前，所以缓存里留着腐蚀前的 `native.defense`。直到下一次玩家被标脏（下一次受伤、tickStatuses 等），之前所有对玩家的命中判定、侧栏、预览都用旧防御。
- **复现**：`/private/tmp/p5rev/stale.mjs`，同 seed 起始皮甲。
  - classic：腐蚀前 50 → 腐蚀后 40（standalone 每次都 clear，正确）。
  - extended（growth）：腐蚀前 50 → 腐蚀后 **50（陈旧）** → 手动 `markStatsDirty` 后才变成 40。
- **后果**：
  - 扩展局与经典局对同一事件序列的命中概率不同。
  - 若陈旧窗口跨过一个存档点，load 会清缓存，导致“连续游玩”与“读档续玩”在下一次命中判定上分叉（可能 OOS）。
  - debug/test 模式会报 `Stat cache drift`，但生产模式（normal/wizard）不会报。
- **修复方向**：两处补 `markStatsDirty(game.player)`。更稳妥的做法是给 Item 机械字段（enchantment/strengthRequired/armor/damage）提供统一的写入口，并在源码守卫里禁止对已装备物品直接写这些字段。
- 本轮已核对其它写点：武器腐蚀 `Game.ts:9337`、强化 `:7503`、否定 `:7754`、力量需求 `:8831` 都已标脏；commutation（`Commutation.ts:41`）在 `Game.ts` 调用侧是否标脏未逐一核对，建议一并排查。

### F4【中低，阻塞 loot】速度类“负 more”无法表达

- **位置**：`NativeStatKeys.ts:22-29`。原生键的 more 槽除 `growth.slot.final` 外都是 `0…40000`。
- **问题**：loot §7.2 `loot.affix.swift`（`native.attack-speed` more，负值表示更快，−5…−25%）和套装 `wanderer`（`native.move-speed −10%`）都会被钳到 0，**完全无效**。
- **修复方向**：
  - 给 attack-speed/move-speed 声明专用速度槽（如 `speed` −9000…0），或者在 stats-config 里明确规定 loot 改用 increased 负值（池下限 −9000 足够）。
  - 不论哪种，都要在 loot 文档和 stats-config 中写明。

### F5【中低，阻塞 loot】回血键与 loot“戒指单位”词缀不匹配

- **问题**：
  - `native.regeneration` 是精确有理数（HP/turn），flat 行只能加整数 HP/turn，+1 就是每回合 1 HP，是原生的约 300 倍。
  - loot §7.2 `loot.affix.mending` 写的是 `native.regeneration flat（戒指单位）+1→+5`，在现有 DAG 下无法表达：没有“回血等级/戒指加值”输入节点，也就无法经 `turnsForFullRegenInThousandths` 表求值。
- **修复方向**：
  - 增加原生输入键 `native.regeneration-bonus`（戒指单位，整数），加一条 DAG 边 `regeneration-bonus → regeneration`，`nativeBase` 读它而不是读原始 `ring('regeneration')`。
  - 或者把 loot 词缀改为 increased bp。
  - 加 DAG 边需升 foundation 号，最好赶在 6B 之前定下。

### F6【中低】物化键接受条件行，HP 比例条件会振荡或失去意义

- **位置**：`src/ext/stats.ts:252-330`（`validateStatRows`）没有禁止 `kind:'materialized'` 的键带 `conditions`。
- **问题**：reconcile 用 `facts={}` 和当前 HP 求条件。
  - `hp-ratio at-least` + `native.max-hp`：满血时条件成立，上限升高；比例下降后条件不成立，上限降回并钳制；HP 回满后又成立。结果每次标脏（每回合都会）就翻转一次。
  - `attack-kind`、`target-tag`、`adjacent` 对物化键永远不成立。
- **修复方向**：物化键只允许无条件行，或只允许 `self-status` 条件；安装期拒绝其它组合。

### F7【低】`native.resist.*` 作用于所有正向 `takeDamage`，包括“设计上必死”的调用

- **位置**：`src/entities/Creature.ts:367`。所有 `damageKind` 都会按抗性缩放。
- **问题**：`Combat.ts:265/547` 的 kamikaze 自爆 `attacker.takeDamage(attacker.hp, true)` 走 `'other'`。一旦某个生物（例如未来受聚落光环影响的盟友）带有 `resist.other`，它的自爆就不会死。同类的“按当前 HP 扣光”写法都有此风险。
- **修复方向**：给这类调用一个不可抗的 kind（如 `'lethal'`/`'self'`），或者加 `ignoresResistance` 参数。目前没有怪物侧来源，属于潜在问题。

### F8【低｜有修正时才显现的不一致】几条命中/伤害路径对修正的覆盖不统一

- `CombatSystem.resolveAttack`（扩展局中 BE_ATTACK、bolt、非武器攻击会走这里）：
  - 命中改用 `nativeHitChance`，会吃 growth/loot 的 hit/evasion 修正，而旧实现在这条路径上不吃任何修正（previewHitChance 在 `isWeaponAttack===false` 时同样不用）。
  - 同一路径不做 physical-damage 成对求值。命中吃修正、伤害不吃，前后不一致。
- 偷窃判定：`resolveAttack` 里 `stealFromPlayer` 用 `nativeHitChance`（含修正），`resolveAttackExtended` 里用 `nativeHitBase`（不含）。两条路径语义不同。
- **建议**：明确“哪些交付方式算 melee/thrown 修正域”，在三条路径统一，并补用例。

### F9【低｜文档/语义】防御类词缀的单位与“局部”含义

- `native.defense` 的单位是十分之一点（`(armor+enchant/4−donning)×10`）。loot §7.2 `plated` 写的是“显示护甲单位 +1…+11”，loot 侧需要 ×10。stats-config 的键表已写单位，但 loot 文档未同步。
- `reinforced` 的 increased 作用于整个 defense（含附魔、力量差、穿戴中惩罚），不是只作用于物品护甲值的“局部 %”。若 loot 想要 ARPG 的局部护甲 %，需要一个 `native.armor-base`（物品护甲）输入节点。
- 武器伤害同理：`keen` 用 `physical-damage-dealt`，属于全局池；`brutal` 用 damage-min/max 的 flat，只在装备武器的玩家路径生效（`weaponEnchant!==undefined` 分支），这一点可以接受，但需在 stats-config 中写明。

### 观察（不算缺陷，供维护者知悉）

- **性能**：每次 `markStatsDirty`（tickStatuses、takeDamage、heal 每回合都会多次触发）都会同步 `reconcileMaterialized` → `sourceSignature`（含 collect）。这就是报告中约 27 ms/战斗回合的来源。缓存几乎每回合都被标脏冲掉，命中率低。正确性不受影响，但 6B 来源数上来后需要关注。
- **回血精度**：`regenRatePerTurn` 由 `per + 1000/interval` 改为 `(per*interval+1000)/interval`，regenerating 状态由 `/0.6` 改为 `×5/3`，浮点结果可能差 1 ulp，长期累加时跨整数的时刻可能偏一回合。维护者已裁定按精确分数验收（S18），这里只登记为已知语义变化；旧 foundation 7 的录像本来就会被拒载。
- **伤害串缺省**：怪物伤害端点改由 `nativeBase` 的 `a.damageString ?? '1d2'` 取，而旧战斗代码对 falsy 值的缺省是 `'1d3'`。monsters.json 全部条目都有合法 damage，变异/empower 的产物也合法，所以目前不可达。

---

## 已核对且无问题

- **零修正数值等价（除 F1 外）**：
  - weapon-enchant：`enchant×4 + round(netEnchant×4) − enchant×4`，保留 CE 的 [−20,50] 钳制；力量差是四分之一点的整数倍。
  - 玩家 accuracy：`trunc(100×accuracyFraction)`，再走无附魔的 `hitProbability`，与旧版 `hitProbability(100,def,enchant)` 逐值相同。
  - defense：与 `playerDefense` 等价。
  - 怪物 accuracy/defense 的 weakness 处理不变。
  - 投掷：accuracy/enchantedDamage 走 projectileFacts，等价。
  - 玩家回血：`per = floor((hp−1)/whole)`、`interval = floor(full/left)` 与旧循环逐值相同。
  - 怪物回血：零修正时保留原计数器。
  - stealth：逐行对照旧 `calculateStealthRange`，含休息/隐形下限。
  - 移速：L0 加 haste/slow 行，合计等于原字段，含 zone 调整。
  - 无来源时命中成对求值直接返回原值，0/100 分支保留。
- **舍入与钳制次序**：BigInt 有理求值；flat → increased 池（先钳制）→ 按声明顺序的 more 槽 → clamp → 一次舍入。`roundStatFraction` 对负数 floor/ceil/half-away 正确。growth 的 `legacyFactor` 精确十进制。
- **资源钳制**：max-hp 下降时 `hp=min(hp,value)`，键下限 1，卸装不会致死；上升不补（F2 例外）；stamina/poise/focus 降则钳制。growth 提案（`proposals`）优先于通用钳制，保留了显式过量 HP 政策。
- **缓存失效**：装备/卸下（`Player.mutateEquipment` + `atomicStats`）、状态起止（`setStatusDuration`/`applyStatus`/`weaken`/`tickStatuses`）、takeDamage/heal、休息与光照、强化/否定/武器腐蚀、模块 setState/setComponent（`invalidateStats`）都有脏入口。load/seek/rollback 清 pipeline 和签名。强力药水在 growth/combat/narrative 三种组合下都实测无陈旧（`/private/tmp/p5rev/potion.mjs`）。test 模式 150 命令战斗路线无 cache drift。
- **确定性/RNG**：管线求值与 collect 冻结、同步；条件词汇不触及 RNG 或全局。`hypothetical` 以 `change` 为真值时绕过 source/module-view 缓存，不写 revision。
- **经典局**：没有 runtime 时 `nativeStat` 每次 clear standalone 管线，没有账本，所以不存在 F3 这类陈旧问题。除 F1 外未见数值差异。
- **装备来源 S7**：绑定后只认 inventory 根中被槽引用的物品，未绑定时保留经典语义。模块 DTO 不含 moduleData。
- **loot 可表达性（除 F4/F5/F9 外）**：伤害 increased（pair 合并池）、flat 伤害端点、weapon-enchant flat、hit-chance flat bp、defense increased/flat、strength/max-hp flat 物化、stealth 负 flat（原生下限保留）、awareness、resist.fire/poison bp（读取点在 takeDamage 和中毒施加处）、transference/reaping/light、`body.large` 目标标签条件，都可以表达。
- **foraging 负 increased**：accuracy −2000/−4000、physical-damage-dealt −2500/−5000 都在 −9000…50000 池内；作用于攻击方 accuracy 节点而不是 evasion，与 foraging 设计一致。多个惩罚合并后按池下限钳制。
- **版本/存档**：foundation 7→8，growth 1.8.0，combat 1.6.0/state4 沿用。账本只存非零加值并排序，拒绝空 applied。load 时用 `ledger.assert` 校验“基础+账本=当前上限”。旧档靠版本拒载（未单独复验，依赖报告与既有测试）。
