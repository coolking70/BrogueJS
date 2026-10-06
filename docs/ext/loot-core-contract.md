# loot 纯核心临时合同（6B1-α）

## 用途与稳定性

本合同供 C6-1 / 5A2-S 起草与 6B 集成复核使用。当前 `loot` 0.1.0 只安装惰性 descriptor，默认关闭，模块 state 恒 `{}`；无玩法接线、命令、UI、statSources 或 itemDataValidators 注册。生成器仅供独立调用和测试，绝不能把本合同误读为可玩掉落已经接入。

- **稳定**：v1 数据 ID、单位、数组顺序、随机抽取顺序、冻结纯函数与错误边界
- **临时待 C6-1**：Item.moduleData 形状、固定原生装配、随机端口和请求事实名称
- **临时待 5A2-S**：修正草稿、属性可用性发现、单位换算、本地百分比、最终钳制
- **待 6B 集成**：掉落事务、唯一收据、金币实体与地表/部位来源
- **待 6B3**：符文目标与原生强化执行

下列类型和抽取次序照录任务书；实现额外的数据文件类型见 `src/ext/modules/loot/types.ts`。所有 `[步号]` 都是后续复核标记，不代表本次实施授权。

## 6 临时合同（docs/ext/loot-core-contract.md 的权威内容）

`types.ts` 逐字采用下列声明（可加 `readonly` 与 JSDoc，不改名、不改形）。每项后的 `[C6-1]`、`[5A2-S]`、`[6B-int]`、`[6B3]` 表示“待该步复核，可能改名/改形”；无标记者为本模块内部稳定约定。

### 6.1 物品实例数据

```ts
export type ItemClass = 'weapon' | 'armor' | 'ring';
export type RarityId = 'normal' | 'magic' | 'rare' | 'unique' | 'set' | 'runeword';
export type LootSource = 'floor' | 'kill' | 'encounter' | 'vault';      // 'part'/'craft' 为 v1 之后 [6B-int]
export type MonsterClassId = 'none' | 'fodder' | 'splitter' | 'standard' | 'elite';

export interface LootAffixRoll { id: string; tier: number; values: number[]; known: boolean }
export interface LootItemDataV1 {               // 将存于 Item.moduleData.loot [C6-1]
  v: 1;
  baseId: string;                              // 原生 kind
  ilvl: number;                                // 1…99
  rarity: RarityId;                            // v1 生成器只产出 normal|magic|rare|unique
  uniqueId: string | null;                     // rarity=unique ⇔ 非空
  setId: null;                                 // 6C 前恒 null
  affixes: LootAffixRoll[];                    // magic/rare：生成顺序；unique：与 rows 一一对应（id=rowId, tier=0）
  corrupted: boolean;                          // 设计 §5.1 之外的新增字段（D-07）
  enhancement: number;                         // 生成时 0
  sockets: 0; socketed: [];                    // 6C 前恒定
  nameParts: [number, number] | null;          // rarity=rare ⇔ 非空
  origin: { source: LootSource; depth: number };   // depth 1…99；地表/site 规则 [C6-1]
}
export interface LootNativeFacts {             // 底座固定 +0 装配后需写入的原生字段 [C6-1]
  kind: string; category: ItemClass;
  enchantment: number;                         // 武/甲 0；戒指 = ringImplicit 或唯一覆盖 + floor(enhancement/2)
  runicType: string | null; runicStrength: number | null;   // 来自符文词缀或唯一行 [6B3]
  isCursed: boolean;                           // = corrupted
  identified: boolean;                         // = affixes.every(a => a.known)
}
export interface LootGeneratedItem { data: LootItemDataV1; native: LootNativeFacts }
```

### 6.2 生成器 I/O

```ts
export interface LootRandom { randomInt(lo: number, hi: number): number }   // 闭区间；实为引擎实质流 context.randomInt [C6-1]
interface LootRequestBase { v: 1; depth: number; presetId: string;
  rarityFindBp: number;                     // 玩家 loot.rarity-find 当前值，≥0 [5A2-S]
  claimedUniqueIds: readonly string[] }     // 本局已掉唯一收据 [6B-int]
export type LootRollRequest =
  | (LootRequestBase & { source: 'kill'; monster: { typeId: string; leader: boolean; champion: boolean; encounterSubject: boolean } })
  | (LootRequestBase & { source: 'floor'; itemClass: ItemClass })
  | (LootRequestBase & { source: 'vault'; itemClass: ItemClass; baseId: string | null; highValue: boolean })
  | (LootRequestBase & { source: 'encounter'; formId: string | null });          // 请求字段名 [C6-1]
export interface LootRollResult {
  v: 1;
  converted: boolean;                       // floor：false 表示保留原生物品；其他来源恒 true
  items: LootGeneratedItem[];               // ≤ 8
  gold: number;                             // 0 = 无金币；生成原生 GOLD 物品 [6B-int]
  newUniqueIds: string[];                   // 本事件新占用的唯一品，按生成顺序
  draws: number;                            // 实际 randomInt 次数
}
export function rollLoot(catalog: EffectiveLootCatalog, request: LootRollRequest, random: LootRandom): LootRollResult;
```

- 纯函数：不读全局、不用 `Math.random`/`Date`、不改输入（测试对输入深冻结）；结果深冻结、可 `structuredClone`。
- **先完整校验请求再抽第一次**；非法请求抛 `LootContractError`，此时 `randomInt` 调用次数必须为 0。错误码：`INVALID_REQUEST`、`UNKNOWN_PRESET`、`UNKNOWN_BASE`、`RANDOM_OUT_OF_RANGE`（回调返回非整数或越界）、`DRAW_BUDGET`（单件 >64 或单事件 >512）。

### 6.3 校验与派生

```ts
export function validateLootItemData(value: unknown, catalog: EffectiveLootCatalog): value is LootItemDataV1;  // 将作 itemDataValidators [C6-1]
export function deriveNativeFacts(data: LootItemDataV1, catalog: EffectiveLootCatalog): LootNativeFacts;
export function projectItemModifiers(data: LootItemDataV1, catalog: EffectiveLootCatalog): LootModifierDraft[];  // [5A2-S]
export interface LootModifierDraft { sourceId: string; stat: string; category: ModifierSpec['category'];
  slot: 'speed' | null; unit: ModifierSpec['unit']; value: number; conditions: ModifierSpec['conditions'];
  runicType: string | null; known: boolean }
```

`projectItemModifiers` 只做“数据 → 未换算的修正草稿”：每个词缀/唯一行每个 modifier 一行（`value = values[valueIndex]`，adept 的 stat 已展开为具体属性），外加强化行（`enhancement>0` 时按 enhancement.json 生成，sourceId `<baseId>#enhancement`）与戒指本体行（`loot.ring-implicit` flat，sourceId `<baseId>#implicit`）。单位换算、本地%折算成 flat、上限钳制都属于 5A2-S 的 `collect`，本步不做。

### 6.4 有效目录与可用性

```ts
export interface LootAvailability {                            // 获取方式（queryOptional 名称）[5A2-S]
  combat: { stats: readonly string[] } | null;
  growth: { stats: readonly string[]; attributes: readonly string[] } | null;
  giants: { formIds: readonly string[] } | null;
}
export function loadLootPack(raw?: LootRawFiles): LootPack;   // LootRawFiles = 16 个文件名→未校验 JSON（类型自定）；缺省读模块 data；失败抛 LootDataError
export function buildEffectiveLootCatalog(pack: LootPack, availability: LootAvailability): EffectiveLootCatalog;
// EffectiveLootCatalog 至少含：pack、availability（规范化、排序后）、按 itemClass 的有效词缀权重表、
// 展开后的 adept 变体、有效 bossUniqueBias、fingerprint = extensionDataFingerprint({ pack, availability })
```

规则（D-11）：
1. `requires` 满足 ⇔ 对应模块非 null 且其 `stats` 含 `requires.key`；adept 另需 `growth.attributes` 非空。
2. 满足：保留。adept 展开为 `loot.affix.adept.<attribute>` 变体，按 `attributes` 顺序插在 adept 原位置，每个变体权重 `max(1, floor(600 / n))`，同组 `attribute`，stat 把 `{attribute}` 替换为属性 ID，nameKey 沿用 adept 的。属性 ID 不满足 `validId` 片段规则时整项视为不可用。
3. 不满足且 `fallback.kind='omit'`：从所有候选中移除。
4. 不满足且 `replace`：移除来源词缀；对来源与目标**共同适用**的每个 itemClass，把来源权重加到目标在该类别的有效权重上（目标的位置、组、阶、修正不变；物品里存目标 ID）。因此有效权重是 `effectiveWeight[affixId][itemClass]`。
5. giants 缺席或其 `formIds` 不含某 bias 的 formId：该 bias 丢弃。
6. 同一 `(pack, availability)` 必须得到同一指纹；availability 数组在规范化时排序去重。

---

## 7 生成器：精确抽取次序

### 7.1 通用规则

- **加权选择**：按定义数组顺序累加正权重；权重 0 的项不参与；`r = randomInt(1, total)`，选第一个累计 ≥ r 的项。
- **唯一结果不抽**（D-05）：任何候选只剩 1 个、区间 lo=hi、件数 min=max、概率 ≤0 或 ≥10000 的判定，都不调用 `randomInt`。候选为空时也不抽。
- 一切整数运算后立即 `Math.floor`（负数也向下取整）；中间值不得超出安全整数。
- 计数：每次 `randomInt` 计入 `draws`；单件 >64 或单事件 >512 抛 `DRAW_BUDGET`（校验器保证静态上界，运行时再兜底）。

### 7.2 事件级

```text
kill：
  K0 monster class = members[typeId] ?? defaultClass
     encounterSubject=true 或 class=none → items=[]、gold=0、draws=0，结束
     选表（§5.8）；无匹配表 → 不掉物品，直接 G
  K1 有效掉率 = min(10000, floor(table.chanceBp × killDropMultiplierBp / 10000)
                 + (leader ? 500 : 0) + (champion ? 1000 : 0))；判定 randomInt(1,10000) ≤ 有效掉率，失败 → 跳到 G
  K2 件数区间 = [table.count[0], min(table.count[1], maxPerKill)]；min<max 时 randomInt
  每件 i：步骤 3–10（§7.3），rarityBonusBp = table.rarityBonusBp + (champion ? 5000 : 0)
floor：
  F1 floorConversionBp 判定（10000 不抽）；失败 → converted=false、items=[]，结束（无金币）
  1 件：步骤 3–10，itemClass 由请求给出（跳过 3a）
vault：
  1 件：itemClass 由请求给出；baseId 非 null 时跳过 3b（须属于该类，否则 UNKNOWN_BASE）
  minRarity = highValue ? vault.highValueMinRarity : vault.minRarity
encounter：
  件数 = preset.encounter.count（不抽）；第 0 件 minRarity=firstMinRarity，其余 restMinRarity
  unique 稀有度权重额外 × uniqueWeightBp/10000；有效 bossUniqueBias 中 formId 匹配的唯一品在第 5 步权重 × multiplierBp/10000
G 金币（kill 与 encounter；在全部物品之后）：
  G1 chanceBp 判定（encounter 10000 不抽）
  G2 金额 randomInt(5+3d, 15+6d)，再按 §5.9 乘算
```

ilvl 按 §5.1；`claimedUniqueIds` 与本事件已产出的唯一品都视为已占用。

### 7.3 单件步骤（严格顺序）

```text
3a 类别：kill/encounter 按 table.classWeights 加权（weapon, armor, ring 顺序）
3b 基底：武器按 §5.3 档权重、护甲按段权重、戒指等权；加权选
4  稀有度：computeRarityWeights（§7.4）后加权选
5  若 unique：候选 = 基底相同、minIlvl ≤ ilvl、未占用的唯一品；加权选（含 boss bias）
   候选为空 → rarity 降为 rare，不补抽稀有度，继续第 6 步
6  词缀数（magic/rare）：magic 用 affixCount.magic；rare 在 ilvl ≥ rareHighIlvl.minIlvl 时用 rareHighIlvl.table，否则 affixCount.rare；加权选 n
7  对槽 k = 0…n−1：
   候选(位置) = 有效目录中 itemClass 适用、polarity=+1、非 rune 组（runeFamilyEnabled=false）、
                组未被本件使用、至少一阶已解锁 的该位置词缀（权重取 effectiveWeight[id][itemClass]）
   a 前后缀都还有名额且两侧候选都非空 → randomInt(0,1)（0=前缀，1=后缀）；只有一侧可行 → 取该侧不抽；都不可行 → 停止追加
   b 加权选词缀
   c 阶：已解锁阶 = { t ≤ maxTier, tiers[t].enabled, tiers[t].minIlvl ≤ ilvl }；窗口 = 其中最高的至多 3 阶，按阶升序排列，
     权重为 weightsHighToLow 反向对齐（3 阶 [35,40,25]，2 阶 [40,25]，1 阶不抽）；加权选
   d 值：按 ranges 顺序逐个 randomInt(lo,hi)（lo=hi 不抽）
C  腐化（仅 magic/rare，在全部词缀之后、第 8 步之前）：
   C1 corruptChanceBp 判定
   C2 命中 → 负面候选 = itemClass 适用、polarity=−1、非 rune、组未被使用 的负面词缀，且当前词缀总数 < 6；
      加权选（不受前后缀名额限制）→ 阶按第 7c 规则抽 → 值为常量不抽
      负面候选为空 → 若 negativeRuneFallback 且 runeFamilyEnabled 且 rune 组未用：负面符文加权选；
      否则本件不腐化（C1 的抽取不回退），跳到第 8 步
   C3 补偿：在 tier < min(maxTier, compensation.maxTier) 的正面词缀中 randomInt(0, m−1) 选一（m=1 不抽，m=0 无补偿）；
      该词缀 tier+1，按新阶 ranges 逐值重抽（lo=hi 不抽）
   corrupted=true
8  unique：按 rows 顺序逐值 randomInt（lo=hi 不抽）；affixes = rows 映射（id=rowId、tier=0）
9  rare：nameParts = [randomInt(0, first.length−1), randomInt(0, second.length−1)]
10 插槽：v1 不抽，sockets=0
之后：enhancement=0；全部 known=false（normal 无词缀）；派生 native（§6.1）
```

### 7.4 稀有度权重（`computeRarityWeights`，导出供测试与统计）

输入 `(preset, ilvl, rarityBonusBp, uniqueWeightBp, rarityFindBp, minRarity)`，对 normal/magic/rare/unique/set 依次：

1. `w = floor(base × (10000 + scaling × ilvl) / 10000)`
2. magic 及以上：`w = floor(w × (10000 + rarityBonusBp) / 10000)`
3. unique：`w = floor(w × uniqueWeightBp / 10000)`（非 encounter 时 uniqueWeightBp=10000）
4. 寻宝：`R = min(max(rarityFindBp,0), cap)`；`eff = R=0 ? 0 : floor(R × k / (R + k))`；magic 及以上 `w = floor(w × (10000 + eff) / 10000)`
5. 低于 minRarity 的 w 置 0

核对（数值表 §10.3）：标准、ilvl 16、elite → normal 700、magic 408、rare 147、unique 21、set 0，总 1276。


## 错误边界

`LootDataError` 与 `LootContractError` 均携带 `code` 和 `path`。生成请求必须全部通过校验后才可调用随机回调；失败不消耗随机数。实例校验返回布尔值，不修复输入。固定向量测试同时断言每次随机区间、返回值、调用总数及 tape 用尽。

| 错误码 | 边界 | 含义 |
| --- | --- | --- |
| INVALID_REQUEST | 生成请求 | 结构、值域、未知字段或非法收据 |
| UNKNOWN_PRESET | 生成请求 | 未安装预设 |
| UNKNOWN_BASE | 生成请求 | 未知基底或与请求类别不符 |
| RANDOM_OUT_OF_RANGE | 随机端口 | 回调返回非安全整数或越界 |
| DRAW_BUDGET | 数据加载 / 随机端口 | 静态上界或运行时单件 64 / 事件 512 预算超限 |

数据加载错误统一为 LootDataError，路径指向具体文件/字段/数组项：

| 错误码 | 含义 |
| --- | --- |
| MISSING_FILE | 缺少16个必需文件之一 |
| INVALID_SCHEMA | 文件 schema 不为1 |
| UNKNOWN_FIELD | 根对象或嵌套对象未知字段 |
| INVALID_TYPE | 类型、有限JSON或安全整数失败 |
| INVALID_VALUE | 枚举、字面量或值域失败 |
| INVALID_RANGE | 数值区间、阶/深度顺序或覆盖失败 |
| INVALID_REFERENCE | 未知或不合法跨文件引用 |
| DUPLICATE_ID | 标识重复 |
| INVALID_COMBINATION | 互斥组、requires/fallback或修正组合失败 |
| MISSING_CANDIDATE | 类别×物等段无正面候选 |
| LOCALE_MISSING | 引用文本键缺失 |
| LOCALE_UNUSED | 文本键没有任何可静态识别引用 |
| BUDGET | 文件规模、件数或行数超限 |
| DRAW_BUDGET | 静态随机调用上界超限 |

负例测试逐个核对具体路径，不静默降级。

## 集成复核清单

| 项目 | 待复核步 | 可能变化 | 影响面 | 预计改动文件 |
| --- | --- | --- | --- | --- |
| LootItemDataV1 存入 Item.moduleData.loot | C6-1 | 数据容器与 codec 位置 | 全物品根存读与拒绝旧档 | types.ts、item.ts、未来 adapter |
| LootNativeFacts 固定 +0 装配 | C6-1 | 原生字段命名与类别映射 | 禁止再次随机原生附魔 | item.ts、未来 adapter |
| context.randomInt 闭区间端口 | C6-1 | RNG 注入端口名 | 调用顺序与事务预算 | random.ts、未来 adapter |
| 请求 source/depth/monster/formId | C6-1 | 可信冻结事实与地表深度 | 来源校验及物等 | types.ts、generator.ts |
| LootModifierDraft | 5A2-S | 正式 modifier 与 sourceId 合同 | collect、已知投影、单位换算 | item.ts、未来 statSources |
| display-armor / ring-point / 本地百分比 | 5A2-S | 正式单位与本地折算 | 不可双重转换；final cap | item.ts、未来 collect |
| availability / optional query | 5A2-S | 查询名称、属性 ID | adept 展开与 fallback | catalog.ts、未来 adapter |
| rarityFindBp | 5A2-S | 玩家只读属性事实 | 权重池与封顶顺序 | types.ts、rarity.ts |
| claimedUniqueIds/newUniqueIds | 6B-int | 单调收据和事务提交 | 同事件及跨事件唯一性 | generator.ts、未来 state/adapter |
| gold 到原生 GOLD | 6B-int | 物品容量与安全提交 | 金币不重复发放 | 未来 adapter |
| part/craft/site 来源 | 6B-int | v1 后新增来源 | 请求联合、物等及掉落表 | types.ts、generator.ts、schema.ts |
| validateLootItemData 注册 | C6-1 | 正式 validator 生命周期 | 畸形模块数据拒绝 | item.ts、未来 module |
| slaying/immunity 目标怪物类 | 6B3 | 目标字段与抽取次序 | 符文族目前严格禁用 | types.ts、generator.ts、item.ts |
| runicType/runicStrength | 6B3 | 原生符文读取位置 | 固定唯一行与后续符文族 | item.ts、未来 adapter |
| 强化/refine/鉴定/分解执行 | 6B3 / 6B-int | 命令与消耗事务 | 纯函数不等于已执行玩法 | economy.ts、item.ts、未来 commands |

## 明确未集成

无属性管线、Game 掉落、装备生效、鉴定/强化/分解命令、背包/地面 UI、掉落收据持久化、套装、插槽、符文之语。共享文件没有因本包修改。后续集成须更新模块版本并按当步合同验收，不迁移旧格式。
