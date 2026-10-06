# 5A2-S 任务书：foundation 统一属性修正管线（crafting / settlement / loot 共用）

> 基线：**5A2 完整交付并合入后的 `ext/phase5`（维护者开工时填写确切 commit：`eb31996`（5A2 含审查修复））**。工作分支 `ext/phase5`。本步由本地单一主笔执行，**不得与 5A2 或 5A3 并行写同一树**；可与 dot 的 5B（只写 `src/ext/modules/crafting/**`）并行。
> 依据（均已批准）：`docs/ext/phase5a-contract.md`（C5-1 r2；本步读 §1.2、§3.2、§5.1–§5.2、§7、§11 第 4 条）；**loot 分支** `docs/ext/phase6-loot.md`（阶段 6 设计已批准，L-D08=A：管线作为 5A2-S 排入阶段 5；本步读 §2 审计表、**§4 全部**、§5.2、§11.1、§11.3、§12.2）；`docs/ext/phase5a2.report.md`（实际版本号、combat 已分配版本、交接事项）。loot 文档位于 `ext/phase6-loot-design` 分支（本机工作树 `BrogueJS-loot`），开工时把其 §4 的内容视为本任务书的规格附录；若主仓库尚无该文件，**不要合并 loot 分支**，按本任务书 §1–§2 的裁定执行并在报告中引用其 commit `23fc19d`。
> 目标：把分散在原生代码、growth 单提供者 `rulePolicies`、growth/combat 各自“已应用加值”账本中的属性派生，统一为一个确定、有序、可假设求值的 foundation 管线；growth、combat 改为**声明修正来源**；为 loot（6B）、crafting 软联动、settlement 光环（L5）预留通用入口。**数值膨胀已被接受，Brogue 数值对新来源不具约束力**；零修正时与旧值逐值相等只是回归证明，不是长期兼容义务。开发期门禁按 P5-D14=A。**不要 commit。**
> 维护者 2026-10-06 对本任务书的全部预先裁定表态“全部按推荐”（记录见[阶段 5 设计 §15](phase5-settlement-world.md#15-待维护者决定推荐不是批准)）。

## 0 开工核对（不通过先停下报告）

1. 5A2 已合入；`docs/ext/phase5a2.report.md` 中“交接给 5A2-S”一节存在，记录了 combat 已分配的版本号（预期 module 1.6.0 / state 4）与 actors 行中待迁移的 `combatStats`。
2. 确认当前版本：foundation **7**、whole-run **v5**、录像 4、growth 1.7.0、narrative 1.4.0、giants 1.0.0（与 5A2 报告不符则停下）。
3. 复核下列代码事实（行号以 `2cd10a5` 为参考，按语义重定位并在报告写实际行号）：
   - `src/ext/runtime.ts` 十个单提供者端口 `hitChance / physicalDamage / stealthRange / searchStrength / strengthBonus / maxHpBonus / focusCapacity / focusRecoveryInterval / cooldownDuration / nativeBonuses` 与 `Conflicting extension rule providers`；`rule()`、`nativeMaximumBase`。
   - 端口消费者：`Game.ts` searchStrength(~622)、stealthRange(~8198)；`Combat.ts` 中 hitChance/physicalDamage 扩展分支。
   - growth 物化：`components.ts` 的 `GrowthDerived {appliedStrength, appliedMaxHp}` 组件、`module.ts` 中 `reconcileGrowthMaximum` 与 `commitCharacterResources` 的各调用、`nativeBonuses`。
   - `growth.combat-stats.v1` 可选查询的提供者（growth `module.ts` optionalActorQueries）与消费者（`Game.ts` ~11386、`PhasedAttackProduction.ts` ~84、combat `partBreak.ts` ~45）；`src/ext/combatStats.ts`。
   - loot §4.8 路由清单中每一行的现计算位置（loot 文档行号基于 `f1dbbd0`，漂移更大，逐行重定位）。
4. `git log` 记录基线与干净工作区。通读 loot §4 与合同 §11 第 4 条后再动手。

## 1 预先裁定（开工前已定，不再回问）

| # | 事项 | 裁定 |
| --- | --- | --- |
| S1 | 规格来源 | 模型、求值公式、上限、查询/物化分类、缓存、录像中性、路由清单、迁移步骤一律以 loot §4.2–§4.9 为准；本表只补充或改写其未定/冲突处 |
| S2 | C5 边界 | **不得修改任何 C5 DTO 或合同 §9 签名**（`worldSdk.ts` 导出逐字不变，5A2 报告记录的 SHA-256 以外的变化即越界）；不声明、不读取 `foundation.labor-rate`（合同 §3.2：C5-1 劳动信用固定 elapsed×1） |
| S3 | 文件布局 | 求值核 `src/engine/Stats/StatPipeline.ts`、原生键与 DAG `src/engine/Stats/NativeStatKeys.ts`、原生来源 `src/engine/Stats/NativeStatSources.ts`、物化账本 `src/engine/Stats/MaterializedStats.ts`；模块可见类型与校验 `src/ext/stats.ts`（内容模块的唯一属性入口） |
| S4 | 物化键 | 物化（有“当前值+上限”或需要写回原生字段）的只有：`native.max-hp`、`native.strength`、`combat.stamina-capacity`、`combat.poise-capacity`、`growth.focus-capacity`。其余全部为 query 键。物化政策：降则钳制、升则不补；可声明 `grantPolicy: 'refill-delta'` 的只有永久成长来源（growth 升级/属性点），沿 growth 现有行为 |
| S5 | 账本位置 | `ExtensionSnapshot.foundation.stats = { schema: 1, applied: { actorId, key, bonus }[] }`，按 (actorId, key) 码点排序；**无行时省略 `stats` 键**（不写空数组）。经典局（无 runtime）没有账本，物化加值恒 0。读档校验“原生基础 + 账本加值 = 当前上限”，不等即坏档 |
| S6 | 物化时机 | 与来源变化**同一事务**调用 `reconcileMaterialized(actor)`：装备/卸下、growth 组件提交、模块 state 提交且其 statSources 结果变化、状态起止（若影响物化键）、群体归属变化。测试/调试构建在每条命令 `finishTurnEpilogue` 后断言全部 actor 账本无漂移（全量重算对照） |
| S7 | 装备来源定义 | “只有装备在背包中的物品是属性来源”（合同 §5.1）。来源集合的规范定义 = §5.2 枚举器 inventory 根中被装备槽引用的物品；生产实现可直接读装备槽引用，但须有测试断言二者相等，且箱/escrow/refund/remains/地面/生物携带中的物品贡献为 0 |
| S8 | growth 迁移 | growth 删除 `rulePolicies`（十个端口），改为 `statSources`（L3 角色、L4 临时）；删除 `derived` 组件中的 `appliedStrength/appliedMaxHp`（由 S5 账本接管）；退役 `growth.combat-stats.v1` 可选查询，combat 改读 `combat.stamina-capacity / combat.poise-capacity` 物化键。runtime 删除十个单提供者端口与 `Conflicting extension rule providers` 检查。growth module 版本 1.7.0→**1.8.0**；rules 版本仅当指纹输入变化时升（报告举证）；旧档拒绝不迁移 |
| S9 | combat 版本 | combat 删除 actors 行的 `combatStats`、容量改读物化键，**沿用 5A2 已分配的 combat 版本号，不再升**（合同 §1.2 合并升号）。若 5A2 的 combat 号已随某次合入打过标签，停下请维护者单独分配 |
| S10 | foundation 版本 | 账本进入 foundation 快照 → foundation 7→**8**。whole-run 仅当实体字段变化才升（预期不升，仍 v5）。录像格式不变；账本属 extensions dirty 域；管线缓存登记为 derived/session 并列入摘要排除清单 |
| S11 | 数值上限（接受膨胀） | 每键硬上下限与类别预算是 foundation 数据表（`NativeStatKeys.ts`），不是 CE 推导；初值按 loot §4.4 示例（`increased` 池 −9000…+50000 bp、每 `more` 槽 0…40000 bp、命中 500…9500 bp、攻速 25…400 tick、抗性 0…7500 bp），其余键给出不小于“零修正原生值 ×10”的上限并在报告列表；修改该表即升 foundation 号。中间值用 BigInt 或分子/分母，**任何合法输入不得溢出或产生浮点** |
| S12 | 舍入 | 每键声明一次舍入（`floor` / `nearest-half-away` / `ceil`），只在最后舍入一次；原生键的舍入选择以“零修正逐值等于旧实现”为准，逐键写入报告 |
| S13 | 影子模式 | 旧计算函数在迁移完成后**移出生产**，保留为仅测试 oracle（`src/test/support/legacyStats.ts`）；零修正影子差分测试长期保留 |
| S14 | 条件词汇 | 首版条件只实现 loot §4.2 的有限词汇：攻击类别 melee/thrown、目标公开标签（`body.*` 与 MonsterClass 成员）、自身状态、相邻、HP 比例阈值（基点）。条件只读冻结事实 |
| S15 | 模块读取面 | 模块经 `ExtensionContext.stats`（只读）获得 `value / breakdown / hypothetical`（loot §4.10 `StatQuery`）；`hypothetical(actor, {equip?, unequip?}, knownOnly)` 不写缓存、不递增 revision、0 RNG。`StatSourceContext` 提供 `equippedItems()` 只读 DTO（id、category、kindKey、enchant、identified、runic 公开态），6A1 将在此 DTO 上追加 `moduleData`，本步不加 |
| S16 | 新抗性键 | `native.resist.fire / poison / …`（键清单按 `Creature.takeDamage` 的实际 damageKind 与中毒施加处列出）新增读取点；无来源时值 0，结果与旧规则逐值相同 |
| S17 | 怪物 | 怪物的命中/防御/伤害/再生/速度同样走管线（成对求值需要双方）；本步没有任何怪物侧非零来源，零修正等价 |
| S18 | RestPoint / auto_rest 回血 | 原生回血速率统一改读 `native.regeneration`（合同 §7 最后一条）；若 5A3 尚未实现 RestPoint，只改 auto_rest/原生回合回血读取点，5A3 直接使用该键 |

## 2 推荐顺序与可停下的子里程碑

### 5A2-Sa 管线核与原生来源（影子模式）

- StatKey 声明（值域、单位/基点、kind、硬上下限、舍入、`more` 槽顺序、owner）、Source/Layer(L0–L5)/Category(override/flat/increased/more/clamp)/Condition 模型；loot §4.3 公式逐字实现；同键多 override 安装期拒绝（除非声明不同优先级）；固定无环 DAG 按拓扑序求值，模块不能加边。
- 成对求值 `evaluatePair(attacker, defender, 'physical-damage' | 'hit')`：攻守 increased 池合并后只乘一次；必中/必失/免疫优先级仍留在战斗求值器。
- 上限：每 actor 修正行 ≤256、每键来源 ≤64、模块键 ≤128；超限在**提交该来源前**拒绝（安装或命令，`C5`无关的 i18n 原因），不静默截断。
- 缓存：键 `(actorId, statKey, actorStatRevision, targetFactsKey)`，会话派生，load/seek/回滚清空；`actorStatRevision` 只在显式写入口递增（装备、Item 机械字段、组件写、状态起止、群体归属）；每 actor ≤128 键 LRU。测试模式全量重算对照：漏标脏即失败。
- 原生来源：L0 基础（形态/原生字段）、L1 原生内在（力量差、原戒指附魔、原装备附魔）、L4 原生状态（haste/slow/weakened 等）作为来源行。
- 影子模式：生产仍用旧计算；测试构建逐次比较旧值与管线值，零模块修正时必须完全一致（全部 §4.8 键、玩家与怪物、真实 Game 多种子）。
- **停点验收**：影子差分全绿；性能基准初测。

### 5A2-Sb 读取点切换（loot §4.8 全表）

- 按 §4.8 逐行把读取点改为调用管线，删除被替换的局部重算；`native.weapon-enchant` → CE 表节点 → `native.accuracy`/`native.damage-min|max`；`native.defense/evasion`；`native.regeneration`（S18）；潜行、搜索、感知、透视、光照、收割、转移、智慧；攻速/移速（`TimeCoordinator`、`Game` 中的读者）；符文强度键（默认由 weapon-enchant 派生，无新来源）；新抗性键（S16）。
- UI：`DetailGenerator`、`ItemDetailEquipment`、`MonsterSidebar`、`BoltReflection` 改用 `hypothetical`/`breakdown`（已知投影），消除 UI 与规则两套公式；纯显示 0 RNG、不写状态。
- 每切一组读取点跑一次影子差分与相关 trace；旧函数最终迁到 S13 的测试 oracle。
- **停点验收**：UR2/UR3/UR4 与原生相关测试逐值不变；UI 数值与规则一致。

### 5A2-Sc 物化账本与 growth 迁移

- S4–S6：`reconcileMaterialized`（剥离旧加值 → 加新加值，降钳不补，`refill-delta` 仅永久成长），账本 S5、读档一致性校验、全量重算对照。
- S8：growth `rulePolicies` → `statSources`；growth 的加法预算/有名乘法槽/global-clamp 原样映射为 `increased` 池预算与 `more` 槽（loot §4.3 末段，[growth-config §5.1](growth-config.md#51-标量公式与叠加)）；`derived` 组件中的已应用加值删除；`nativeMaximumBase`、`commitCharacterResources` 中关于 strength/maxHp 加值的路径改由账本统一写一次；growth 的 view 预览改用 `hypothetical`。runtime 删除十个端口与冲突检查。
- growth 全部既有功能（属性、技能、身份、内容奖励、可选奖励、itemGrowth、模态推进、UI）行为不变；版本按 S8。
- **停点验收**：growth 自有测试全绿（只修因结构迁移而过时的前提，单变量反事实证明）；账本 save/load/replay/seek/续录。

### 5A2-Sd combat 容量迁移

- combat 资源容量改读 `combat.stamina-capacity / combat.poise-capacity`；growth 以 L3 来源贡献；退役 `growth.combat-stats.v1` 与 `src/ext/combatStats.ts` 中只为它服务的解析；combat actors 行删除 `combatStats`（含其 sha256 revision）。保持“降容钳制、升容不补满”。恢复速率/延迟/攻击费用（`combat.stamina-regen`、`combat.poise-recovery`、`combat.native-attack-cost`）按 loot §4.8 声明为 combat 自有 query 键，L0 = combat 模板。
- partBreak、PhasedAttackProduction、Game 中的三个消费者全部改道；giants 依赖的组合行为不变。
- 版本按 S9。
- **停点验收**：combat、giants、combat+growth、combat+giants+growth 的来源/费用/打断/录像不倒退；combat 自然 trace 逐值不变或逐字段归因。

### 5A2-Se 模块声明面、文档与收尾

- `ExtensionModule.statSources`（`keys?`、`collect`、`revisionHint?`，loot §4.10）与安装期校验（键 owner 前缀、值域、槽声明、行数上限）；`collect` 必须同步、纯、严格 JSON 行，异常/Promise 即失败（不降级为缺席）。
- 新增配置手册节或文档 `docs/ext/stats-config.md`：键表（含 S11 上限、S12 舍入）、层与类别语义、成对求值、物化政策、来源声明示例（growth 实例、未来 loot/crafting/settlement 用法），供 6B/5D 引用。
- 交接：dot 的 crafting trace 若已交付，集成人在本步合入后**重跑**并逐字段归因（合同 §11 第 4 条）；本报告列出预期受影响字段（预期仅版本外壳）。

## 3 非目标（出现即越界）

- 任何 loot 内容：词缀、稀有度、掉落、`Item.moduleData`、名称装饰器、掉落服务（6A/6B）。
- 新增玩法数值或新来源（除把既有 growth/combat/原生来源迁入）；工作速度属性 `foundation.labor-rate`。
- 改 C5 DTO / §9 SDK / world5 / 动作根；结构/RestPoint（5A3）。
- 改生成算法；新增 npm 依赖。

## 4 必须保持的不变量

1. **零修正等价**：无模块来源时，全部 §4.8 键对玩家与怪物逐值等于旧实现；UR2/UR3/UR4 与原生测试不变。
2. **确定性**：求值纯、同步、0 RNG、0 消息、0 时间；缓存只影响成本；`hypothetical` 不写任何状态。
3. **物化守恒**：任意来源增删序列后“基础 + 账本加值 = 上限”；降钳不补；无漏剥离/双写；load/seek/回滚后一致。
4. **单一属性入口**：删除后不得再有绕过管线的局部重算（新增源码守卫：禁止在规则/UI 代码中直接调用已迁移的旧公式入口与 `ringBonus` 一类原始读取，白名单只含管线原生来源实现）。
5. **C5 不变**：`worldSdk.ts` 与 5A2 报告的 SHA-256 一致；crafting 骨架 harness 闭环逐字段不变。
6. 经典局逐事件录像成本不增加；扩展局每命令新增成本仍在 5A1-R 阈值内。

## 5 必测场景（登记到 `scripts/test-suites.json` 底座清单，命名 `ext_stats_*`；growth/combat 新测试放各自模块 tests 目录）

- 公式：每类别单独与组合（flat→increased 池→more 槽→clamp→一次舍入）、override 冲突安装拒绝、DAG 拓扑序、成对池合并只乘一次；极端值（increased +50000 bp、flat 10^6、多 more 槽满额）不溢出、按 S11 钳制；负预算下限。
- 上限：256 行/64 来源/128 模块键边界（等于与超出 1），超限在提交前拒绝且世界不变。
- 条件词汇每种至少一例；条件读不到 RNG/全局（源码守卫）。
- 影子差分：多种子真实 Game（玩家+怪物，含戒指、强弱化、加速/减速、毒、透视、潜行、搜索）零修正逐值相等。
- 缓存：命中/未命中、每个脏标记入口、LRU、load/seek/回滚清空；全量重算对照在随机操作序列（装备/卸下/升级/状态）下零漂移。
- `hypothetical`：换装比较、knownOnly 过滤、0 RNG/0 写入（写集差分）。
- 物化：装备 +maxHp 来源上/下、HP 高于新上限时钳制、升级 `refill-delta`、growth+combat 同时变化、save/load/逐条 replay/seek/续录、坏档（账本与原生不符、未知键、空数组 `applied: []` 而非省略）拒绝。
- S7：同一物品在背包已装备/背包未装备/箱/escrow/地面/怪物携带时的贡献（仅第一种非 0）。
- growth：全部既有自有测试；迁移前后玩家数值逐值对照；旧 growth 档拒绝。
- combat：容量随 growth 变化降钳不补；三处 combat-stats 消费者改道；giants 部位破坏与身体动作不变；旧 combat 档拒绝。
- C5：骨架 harness 完整闭环摘要与 5A2 交付时一致（除版本外壳）；`worldSdk.ts` hash 不变。
- 性能（实测并报告硬件）：缓存命中 P95 ≤0.01 ms、未命中 ≤0.1 ms（loot §11.3）；一场标准战斗回合的属性求值总耗时；录像每命令新增成本 P95 与 5A2 对照。

## 6 预计改动的共享文件

新 `src/engine/Stats/*`、`src/ext/stats.ts`；`src/ext/types.ts`、`runtime.ts`（删端口、加 statSources/context.stats/账本）、`compatibility.ts`、`fingerprint.ts`、`combatStats.ts`；`src/engine/Combat/Combat.ts`、`CombatFormulas.ts`（只作为公式节点被调用，不复制公式）、`BoltReflection.ts`；`src/engine/Core/Game.ts`（潜行/搜索/感知/透视/符文/回血等读取点、combat-stats 消费者）、`TimeCoordinator.ts`（速度读取）、`PhasedAttackProduction.ts`、`WholeRunSnapshot.ts`（foundation 快照账本校验）；`src/entities/Player.ts`、`Creature.ts`、`Monster.ts`；`src/engine/Items/RingBonuses.ts`；`src/engine/UI/DetailGenerator.ts`、`ItemDetailEquipment.ts`、`MonsterSidebar.ts` 及相关 Vue 组件；`src/ext/modules/growth/**`（迁移、版本）；`src/ext/modules/combat/**`（容量、partBreak、descriptor 不升号）；`scripts/u03-state-contract.json`、`scripts/recording-digest-contract.json`、`scripts/test-suites.json`；新 `docs/ext/stats-config.md`。

- 冲突等级最高：`Game.ts`、`Combat.ts`、`runtime.ts`、growth——本步期间这些文件只由本步主笔修改。
- 黄金/trace：目标零数值变化；任何变化先单变量归因（只回退本步某一生产文件），确属已批准语义（如舍入统一）才按原捕获方法重录并逐字段登记。

## 7 门禁（开发期相关功能，P5-D14=A）

环境同 5A2（Node 24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、vitest `--maxWorkers=2`）。每个子里程碑停下前跑相关部分，最终全部跑：

1. `node scripts/check-module-boundaries.mjs`
2. `npx vue-tsc -b`
3. `npm run build`
4. 本步新增测试 + 直接受影响：growth、combat 全部自有测试；giants 涉及战斗数值/身体/自然 trace 的测试；`u_r2/u_r3/u_r4_trace`；战斗/命中/伤害/护甲/戒指/潜行/搜索/回血/速度相关原生测试（grep `netEnchant`、`playerDefense`、`ringBonus`、`regenRatePerTurn`、`stealthRange`、`searchStrength` 定位并在报告列出）；物品详情/侧栏 UI 测试；`u_03_whole_run_snapshot`、`ext_foundation*`、`ext_compatibility_diagnostics`、`ext_module_composition`、`ext_recording_v4_*`、`ext_world_work_*`、`ext_world_harness_*`。
5. 真实组合 smoke（engine-only）：空、四模块各单独、四模块全开、growth+combat、骨架+四模块全开；每组新局/游玩（含战斗与升级/装备变化）/save/load/逐条 replay/seek/续录。
6. 因本步改动大量 CE 局部规则读取点：加跑 CE 局部规则档中与战斗/戒指/回血相关的用例（若需 CE 源码，先 `npm run ce:fetch`，在报告注明）；不改生成，预期无需 `test:drift`，若触及则跑。

不跑完整 `npm test`、全部 `test:ext`、removal 矩阵（留 5Z）。失败处理同 5A2 §7。

## 8 交付

- 代码与测试（**不 commit**），`docs/ext/phase5a2s.report.md` 与 `docs/ext/stats-config.md`：
  - 基线 commit、§0 核对与实际行号、最终版本表（foundation/growth/combat 实际值与 S9 说明）、U03/摘要域登记。
  - loot §4.8 路由清单逐行：实际文件:行、切换前后、对应影子测试；未迁移项须写原因（预期为 0）。
  - 原生键表：上限、舍入（S11、S12）及零修正等价证据。
  - 逐子项 done/not-done（Sa–Se）；自定细节列表。
  - 每条门禁实际命令、退出码、数量、耗时；失败与修复；反事实证据；重录逐字段归因（预期无）。
  - 性能实测与 5A2 录像成本对照。
  - 交接：给 6A0/6B（`StatQuery`、`statSources`、`equippedItems()` DTO 扩展点、物化政策）、给 5A3（`native.regeneration` 用法）、给集成人（crafting trace 重跑）。
- 原始证据放仓库外；**不要 commit / push**；README 仅可在报告完成后追加一行。
