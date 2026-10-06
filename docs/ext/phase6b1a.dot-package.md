# 6B1-α dot 任务包：`loot` 纯核心（数据 + 校验 + 生成器 + 统计）＋ 叙事 NPC 像素立绘（整包一次派发）

> 状态：**派发草稿，未派发**。由 Claude 依据已批准的[阶段 6 设计](phase6-loot.md)（L-D01–L-D13：L-D10=C、L-D11=B，其余 A）与维护者已批准的[数值候选表](phase6-loot-numbers.md)（维护者口径“全部按推荐”：N-01–N-13 全取推荐项，含 N-01=A、N-03=B、N-04=A、N-05=A、N-12=B、N-13=A）编写。维护者完成 §A 检查并把本文合入 `ext/phase6-loot-design` 后，再把 §0 提示块转贴给 dot。
>
> 本包把设计 §13 的 6B1 拆出一个**不接线的纯核心子步 6B1-α**：设计稿要求 6B1 以 5A2-S 与 6A1 为前置，二者目前都不存在；6B1-α 不触碰 Game、共用类型、codec、属性管线，只在 `src/ext/modules/loot/**` 内交付可单测的数据、校验器、确定性生成器与统计工具，并把物品数据形状与生成器 I/O 写成**临时合同**，待 C6-1（6A0/6A1）与 5A2-S 落地后由本地复核、尽量少返工。第二部分是独立的 narrative 立绘像素化，二者同分支、分提交。

---

## 0 转贴给 dot 的提示块（维护者复制此块）

```text
你是 BrogueJS 扩展原型（独立新产品原型分支，不合 main）的 6B1-α 执行者。本次一次长块独立开发直到完成全部交付，期间不要向维护者提问。共两部分：
 第一部分（主体）：在 src/ext/modules/loot/ 内实现“刷宝 loot 纯核心”：数据文件、严格校验器、确定性纯生成器、固定向量测试、统计工具与报告。不接入游戏。
 第二部分：用你的 GPT 图像生成能力，把 narrative 模块三位 NPC 的立绘重做为统一风格的像素画，并做模块内渲染适配。

基线与分支：
- git fetch origin
- git switch -c ext/phase6-loot-core origin/ext/foundation   （预期 HEAD = 5180f6c；不同则照常开工并在报告记录）
- git merge --no-ff origin/ext/phase6-loot-design -m "Merge loot design docs"   （只带入文档与一个探针脚本，应无冲突）
- 只推 ext/phase6-loot-core；不推其他分支、不合并其他分支、不打 tag。

唯一任务书：docs/ext/phase6b1a.dot-package.md（与本提示冲突时以任务书为准）。先读 AGENTS.md、docs/ext/README.md，再完整读任务书。docs/ext/phase6-loot.md 与 docs/ext/phase6-loot-numbers.md 是已批准的设计与数值来源；任务书对它们的解释、单位换算与补充决定优先。

硬规则（详见任务书 §15、§16）：
1. 只改：src/ext/modules/loot/**；src/ext/modules/narrative/{assets/portraits/**,data/portraits.json,ui/NarrativePortrait.vue,ui/NarrativeDialogue.vue,tests/**,test-suites.json,tools/**}；docs/ext/loot-core-contract.md；docs/ext/phase6b1a.report.md；docs/ext/evidence/phase6b1a-loot-stats.json；docs/ext/narrative-config.md 中与立绘有关的句子。其他任何文件一律不改。
2. loot 模块必须“安装但惰性”：descriptor 存在（发现器强制），defaultEnabled:false，启用后不改变任何玩法、不消耗随机数（任务书 §4）。
3. 任务书给定的 ID、数值、抽取次序、单位、版本号不得更改；数值表与设计稿冲突时以任务书为准。
4. 遇到未写明细节，按任务书 §16.2 自行决定并在报告“自行决定事项”列出，不要停下来问。
5. 只跑任务书 §13 的门禁；不跑完整 npm test、全部 test:ext、删除矩阵、ce:fetch、test:full、test:gen。

交付：按任务书 §14 写报告与合同文档，按逻辑分提交，门禁通过后推送 ext/phase6-loot-core；最后按任务书 §17 回复一段 ≤30 行中文摘要。
```

---

## A 派发前维护者检查清单（dot 不读本节）

| # | 事项 | 说明 | 核对 |
| --- | --- | --- | --- |
| A1 | 本文已提交并推到 `origin/ext/phase6-loot-design` | dot 通过 merge 读到它；未推送则 dot 读不到任务书 | ☐ |
| A2 | `origin/ext/foundation` 仍为 `5180f6c`（foundation 协议 5，含阶段 1–4 与 polish） | 若已前进：本包可照用（只增 loot 目录），但请确认新提交未改 `src/ext/catalog.ts`、`scripts/test-discovery.mjs`、`src/test/i18n_scan.ts`、`src/test/p1_30_i18n_gate.test.ts`、narrative 立绘相关文件；有改动先修订 §4/§12 | ☐ |
| A3 | 合并带入的非文档文件 | `merge origin/ext/phase6-loot-design` 会带入 `scripts/phase5a0-size-probe.mjs`（5A0 体积探针，独立脚本，不被任何测试或构建引用）。已在临时树验证 merge 无冲突。可接受；若不想让它进 loot 分支，改为让 dot 只 `git checkout origin/ext/phase6-loot-design -- docs/ext` | ☐ |
| A4 | 数值表的批准记录 | `phase6-loot-numbers.md` 页首仍写“待维护者审定”。本包 §1.2 已记录“全部按推荐”；建议维护者在派发前给数值表页首补一行批准记录（可选，不影响 dot） | ☐ |
| A5 | 签署 §16.1 的预先决定 | 尤其 D-01 惰性 descriptor（会在新局模块列表出现“刷宝装备（开发中）”）、D-05“唯一结果不抽”、D-08 腐化抽取细则、D-09 金币抽取位置、D-11 fallback 权重并入语义、D-21 立绘 48×64 网格 | ☐ |
| A6 | 6B1 前置豁免 | 设计 §13.2 要求 6B1 以 5A2-S、6A1 为前置；本包只做不接线的 α 子步，维护者确认豁免仅适用于 6B1-α | ☐ |
| A7 | dot 具备图像生成能力 | 若 dot 环境没有 GPT 图像生成，第二部分整体记为 blocked（§12.10），第一部分照常 | ☐ |
| A8 | 收尾成本提示 | loot 被发现器安装后，`src/test/ext_module_composition.test.ts` 的真实子集从 16 增至 32，删除矩阵与组合 smoke 相应翻倍；这些只在阶段收尾运行 | ☐ |

---

## 1 目标、前提与范围

### 1.1 第一部分目标（6B1-α）

在 `src/ext/modules/loot/` 交付：

1. **完整数据文件**：从数值表逐项落成 `data/*.json`（稀有度、物等公式、阶梯、基底、词缀池含 combat/growth 依赖词缀与缺席替代、仅腐化负面词缀、符文词缀族数据、8 件唯一品、怪物分级表覆盖全部 67 种原生怪物、掉落表、宝库/Boss 规则、金币、三套预设 稀缺/标准/丰饶、强化卷轴映射、鉴定、腐化、分解、上限）。
2. **严格校验器**：每个数据文件、跨文件引用、预算、互斥与资格；物品实例数据 `LootItemData` 校验。
3. **确定性纯生成器**：输入 `randomInt` 回调 + 冻结请求事实，输出 `LootItemData[]`（含派生原生事实与金币），严格按 §7 次序抽取；固定向量测试。
4. **纯辅助函数**：怪物倍率插值、金币、分解、熟悉度、强化上限、物品修正投影（临时）。
5. **统计工具**：模块内 node 脚本，用真实生成器跑固定种子，按层统计件数、稀有度构成、唯一品机会、强度代理，对照数值表，偏差 >±20% 标记。
6. **临时合同文档**与**报告**。

不接入游戏：不写 `statSources`、不注册 `itemDataValidators`、不挂掉落服务、无命令、无 UI、无模块 state 内容。

### 1.2 已批准的前提（不再讨论）

- 设计 L-D01–L-D13 全部按推荐（L-D10=C 任何非行政死亡都掉、L-D11=B 部位不掉）。
- 数值表 N-01–N-13 全部按推荐：N-01=A 自有怪物分级表；N-02=A 接受 D21–26 丰收；N-03=B 最高 3 阶滑动窗口 25/40/35；N-04=A `precise` 为命中值 increased；N-05=A 防御封顶 220 内部 + `warding` 减伤 + 生命；N-06=A 首批 8 件唯一；N-07=A 强化上限 10/8/6/4；N-08=A 满级精炼；N-09=B 10 碎片兑换一次鉴定；N-10=A 不发 web 自创符文；N-11=A 发击杀金币；N-12=B 本表为 v1 数据，用真实生成器固定种子统计校验 ±20%；N-13=A 深度锚点倍率表。
- 数值表 §12 对设计稿的全部修改同时生效（预设 ID、怪物分级掉率、稀有度权重随物等放大、本地%、腐化追加抽取等）。

### 1.3 第二部分目标（narrative 像素立绘）

narrative 已有三位 NPC 与三张 288×384 绘画风 PNG（`assets/portraits/`），与游戏字形/ASCII 暗色风格不一致。用 dot 的 GPT 图像生成按统一模板重画为 **48×64 像素网格的像素画**，经共享调色板量化后替换原文件；模块内 CSS 改为最近邻放大。只是显示资产变化（`displayVersion` 1.1.0 → 1.2.0），不改 narrative 规则包与指纹。

### 1.4 非目标（出现即越界）

- 任何 Game/引擎/共用类型/codec/runtime/catalog/发现器/测试支持文件的修改；任何属性管线实现。
- loot 的命令、模块 state 内容、UI、掉落接线、鉴定/强化/分解的**执行**（本步只有数据与纯函数）。
- 套装、插槽、符文之语、合成掷词缀（6C）；冠军怪（L-D09 B）。
- 启用符文词缀族（数据写入但 `runeFamilyEnabled:false`，见 §5.5）。
- narrative 的对白、NPC、剧情、规则数据、locale 文案改动；新增 NPC 或表情立绘。

---

## 2 基线与分支

| 项目 | 值 |
| --- | --- |
| 基线 | `origin/ext/foundation` @ `5180f6c`（foundation 协议 5；growth/narrative/combat/giants 已安装） |
| 合入文档 | `origin/ext/phase6-loot-design`（设计、数值表、本任务书；外加 `scripts/phase5a0-size-probe.mjs`，不改不用） |
| 工作分支 | `ext/phase6-loot-core`（只推它） |
| 运行环境 | Node 24.x；`NODE_OPTIONS=--max-old-space-size=3072`；vitest `--maxWorkers=2`；不新增 npm 依赖；图像后处理用 Python 3 + Pillow + numpy（仓库外安装，不进 package.json） |

开工第一件事：`git log -1`、`git status`（须干净）、`node scripts/test-discovery.mjs > /dev/null && echo ok`，结果写入报告 §2。

---

## 3 loot 模块目录（完整布局）

```text
src/ext/modules/loot/
  descriptor.ts        发现入口（惰性，§4）
  index.ts             createLootModule()：返回惰性 ExtensionModule
  definitions.ts       LOOT_VERSION='0.1.0'；loadLootPack()；getLootPackIdentity()
  types.ts             全部数据类型与临时合同类型（§5、§6 的 TS 声明逐字采用）
  errors.ts            LootDataError / LootContractError（code + path）
  schema.ts            每文件严格校验 + 跨文件校验 + 静态抽取上界（§8）
  catalog.ts           buildEffectiveLootCatalog(pack, availability)（§6.4）
  random.ts            LootRandom 包装：区间校验、计数、预算；weightedPick（§7.1）
  rarity.ts            computeRarityWeights()（§7.4，统计工具与测试共用）
  generator.ts         rollLoot(catalog, request, random)（§7）
  item.ts              validateLootItemData / deriveNativeFacts / projectItemModifiers（§6、§9）
  economy.ts           monsterScalingAt / goldRange / salvageYield / familiarityThresholds / enhancementCap（§9）
  data/                ilvl.json tiers.json bases.json rarities.json affixes.json uniques.json
                       monsterClasses.json dropTables.json gold.json presets.json enhancement.json
                       identify.json corruption.json salvage.json caps.json rareNames.json
  locales/zh_CN.json   全部 ext.loot.* 文本（§5.16）
  tools/stats.ts       computeLootStats(options)：纯统计（§10）
  tools/doc-targets.ts 数值表对照目标（从数值表转录，§10.4）
  tools/loot-stats.mjs CLI：Vite SSR 加载 stats.ts 跑全量（§10.5）
  tests/*.test.ts      §11
  test-suites.json     只登记本模块测试
```

所有 JSON 数据必须放在 `data/`（i18n 门禁只扫描已安装模块 `data/` 下 JSON 的 `nameKey/descriptionKey/labelKey/...` 字段作为引用，§5.16）。

---

## 4 版本、身份与“安装但惰性”

### 4.1 为什么必须有 descriptor（已核对真实发现机制）

- `src/ext/catalog.ts` 以 `import.meta.glob('./modules/*/descriptor.ts', { eager: true })` 安装**每个**模块目录，目录名须等于 `descriptor.id`。
- `scripts/test-discovery.mjs` 的 `discoverModules()` 对 `src/ext/modules/` 下**每个**子目录要求存在 `descriptor.ts` 与 `test-suites.json`，否则整个测试发现失败（npm test、vitest、boundary 全部失败）。
- `ModuleDescriptor` 字段是白名单（`id/version/foundation/rules/create/labelKey/descriptionKey/defaultEnabled/locales`），没有“隐藏/未发布”标志。

因此“不建 descriptor”或“建目录但不安装”在不改共用文件的前提下不可行。决定（D-01）：**loot 以惰性模块安装**——出现在新局模块列表中、默认不启用；即使启用，也只在存档/录像 manifest 记录 `loot` 版本与规则指纹，不注册任何钩子、命令、组件、端口或 UI，不消耗任何随机数。真正的玩法接线在 6B1 集成步（本地）进行时才赋予行为并升版本。

### 4.2 descriptor 与 module

```ts
// descriptor.ts
export const descriptor: ModuleDescriptor = {
  id: 'loot', version: LOOT_VERSION, foundation: 5,
  rules: getLootPackIdentity(),            // { schema: 1, version: LOOT_VERSION, fingerprint }
  create: createLootModule, defaultEnabled: false,
  labelKey: 'ext.loot.module.name', descriptionKey: 'ext.loot.module.description',
  locales: { zh_CN: zhCN },
};
// index.ts —— 惰性模块：只有下列 5 个键
export function createLootModule(): ExtensionModule {
  return { id: 'loot', version: LOOT_VERSION, rules: getLootPackIdentity(),
    initialState: () => ({}), validateState: (v): v is Json => isPlainEmptyObject(v) };
}
```

- `LOOT_VERSION = '0.1.0'`；`rules.version` 必须等于模块版本（registry 强制）；`rules.schema = 1`。
- 指纹：`extensionDataFingerprint(pack)`，`pack` 为 `loadLootPack()` 返回的、已校验的 16 个数据文件对象（键名为文件名去扩展名，locale 不入指纹）。
- `createLootModule()` 不得调用 `buildEffectiveLootCatalog` 或生成器（保持零成本、零副作用）；`loadLootPack()` 在 `getLootPackIdentity()` 内调用一次即可（与 giants 相同模式）。
- 文案：`ext.loot.module.name`=“刷宝装备（开发中）”；`ext.loot.module.description`=“只含掉落数据与生成器核心，尚未接入游戏；启用后不改变任何玩法。”

### 4.3 惰性证明（测试 T-INERT，§11）

同种子 `createHeadlessGame()` 各开一局 `extensions: []` 与 `extensions: ['loot']`（`mode:'test'`、`ruleSet:'extended'`），执行同一组 ≥20 条公开命令（移动/搜索/休息），断言：`rng.getState()` 相同；两份存档各自删去 `extensions` 字段后其余逐字段相同，且 loot 局的 `extensions.modules.loot` 为 `{}`、manifest 只多出 loot 一项；loot 局 save→load→replay→seek 成功。测试只用公开 API 与 `src/test/harness`、`src/test/support/*` 现有工具，不改它们。

---

## 5 数据文件（单位、形状与完整数值）

### 5.0 通用约定

- 每个文件根对象有 `"schema": 1`；未知字段一律拒绝；全部数值为安全整数；百分比一律写 **bp**（1% = 100 bp）。
- 数组顺序即抽取顺序，**有语义**；本节给出的顺序必须原样保留。
- ID：词缀 `loot.affix.<name>`；符文词缀 `loot.affix.rune-w-<runicType>` / `loot.affix.rune-a-<runicType>`；唯一品 `loot.unique.<name>`，其固定行 `loot.unique.<name>.r<序号>`；预设 `scarce|standard|bountiful`。均须满足 `validId`（`src/ext/json.ts`）。原生 ID（`dagger`、`ring_of_light`、怪物 typeId）照原生写法。
- 文本键一律 `ext.loot.` 前缀（descriptor 校验强制）。数值表 §6 示例中的 `loot.preset.standard` 改为 `ext.loot.preset.standard.name`。
- 单位标签（`ModifierSpec.unit`）：`bp`、`int`、`display-armor`（护甲显示点）、`ring-point`（戒指点）、`runic-strength`（符文强度）。

### 5.1 `ilvl.json`

```json
{ "schema": 1, "ilvlPerDepthBp": 15000, "min": 1, "max": 99, "siteIlvl": 1,
  "sourceBonus": { "floor": 0, "kill": 0, "vault": 3, "encounter": 5, "part": 2, "craft": 0 },
  "classBonus": { "none": 0, "fodder": 0, "splitter": 0, "standard": 0, "elite": 1 },
  "championBonus": 2 }
```

`ilvl = clamp(floor(depth × ilvlPerDepthBp / 10000) + sourceBonus[source] + (kill ? classBonus[class] + (champion ? championBonus : 0) : 0) + table.ilvlBonus, min, max)`。物等的怪物分级加值只来自本文件（掉落表的 `ilvlBonus` 在 v1 全为 0，避免数值表 §1.1 与 §5.2 重复计入 elite +1）。

### 5.2 `tiers.json`

```json
{ "schema": 1,
  "tiers": [ {"tier":1,"minIlvl":1,"enabled":true}, {"tier":2,"minIlvl":6,"enabled":true},
             {"tier":3,"minIlvl":12,"enabled":true}, {"tier":4,"minIlvl":20,"enabled":true},
             {"tier":5,"minIlvl":30,"enabled":true}, {"tier":6,"minIlvl":40,"enabled":true},
             {"tier":7,"minIlvl":55,"enabled":false} ],
  "window": { "size": 3, "weightsHighToLow": [25, 40, 35] } }
```

### 5.3 `bases.json`

```json
{ "schema": 1,
  "ilvlBands": [ {"minIlvl":1,"maxIlvl":11}, {"minIlvl":12,"maxIlvl":26}, {"minIlvl":27,"maxIlvl":99} ],
  "weaponTierWeights": { "light": [10,8,6], "medium": [6,10,9], "heavy": [3,8,12] },
  "weapons": [ {"baseId":"dagger","tier":"light"}, {"baseId":"whip","tier":"light"}, {"baseId":"spear","tier":"light"},
               {"baseId":"rapier","tier":"light"}, {"baseId":"sword","tier":"light"}, {"baseId":"mace","tier":"medium"},
               {"baseId":"axe","tier":"light"}, {"baseId":"flail","tier":"medium"}, {"baseId":"broadsword","tier":"heavy"},
               {"baseId":"war_pike","tier":"heavy"}, {"baseId":"war_hammer","tier":"heavy"}, {"baseId":"war_axe","tier":"heavy"} ],
  "armors": [ {"baseId":"leather_armor","weights":[12,6,4]}, {"baseId":"scale_mail","weights":[10,8,6]},
              {"baseId":"chain_mail","weights":[8,10,8]}, {"baseId":"banded_mail","weights":[5,10,10]},
              {"baseId":"splint_mail","weights":[3,8,10]}, {"baseId":"plate_mail","weights":[2,6,10]} ],
  "rings": [ {"baseId":"ring_of_clairvoyance","weight":10}, {"baseId":"ring_of_stealth","weight":10},
             {"baseId":"ring_of_regeneration","weight":10}, {"baseId":"ring_of_transference","weight":10},
             {"baseId":"ring_of_light","weight":10}, {"baseId":"ring_of_awareness","weight":10},
             {"baseId":"ring_of_wisdom","weight":10}, {"baseId":"ring_of_reaping","weight":10} ],
  "ringImplicit": { "base": 1, "ilvlStep": 15, "min": 1, "max": 4 } }
```

武器顺序 = `src/data/weapons.json` 顺序剔除 halberd 与投掷武器；每把武器的权重 = 其档在当前物等段的权重。`ringImplicit = clamp(base + floor(ilvl / ilvlStep), min, max)`。测试须断言每个 baseId 存在于原生数据且类别正确（武器 `src/data/weapons.json`、护甲 `armors.json`、戒指 `arcana.json` 的 `rings`）。

### 5.4 `rarities.json`

顺序 normal, magic, rare, unique, set, runeword。字段：`id, order, nameKey, colorDark, colorLight, marker, affixes: {prefixMax, suffixMax} | null, enhancementCap, droppable`。

| id | colorDark / colorLight | marker | affixes | enhancementCap | droppable |
| --- | --- | --- | --- | --- | --- |
| normal | `#c8c8c8` / `#4a4a4a` | `""` | `{0,0}` | 10 | true |
| magic | `#6a8cff` / `#2b4fd1` | `◇` | `{1,1}` | 8 | true |
| rare | `#ffd94a` / `#9c7a00` | `◆` | `{3,3}` | 6 | true |
| unique | `#c7a046` / `#7a5a14` | `★` | null | 4 | true |
| set | `#3fd36b` / `#16803a` | `✦` | null | 4 | false（6C） |
| runeword | `#b8a77a` / `#6b5c33` | `⊕` | null | 0 | false（只能镶嵌产生） |

### 5.5 `affixes.json`

```ts
interface AffixesFile { schema: 1; runeFamilyEnabled: false; affixes: AffixDefinition[] }
interface AffixDefinition {
  id: string; nameKey: string; position: 'prefix' | 'suffix';
  itemClasses: ItemClass[];            // 非空子集，按 weapon, armor, ring 顺序书写
  group: string; weight: number;       // 0…10000
  polarity: 1 | -1;                    // -1 = 仅腐化
  maxTier: number;                     // 1…6；tiers 必须是 T1…maxTier 连续
  tiers: { tier: number; ranges: [number, number][] }[];   // 每阶 0…4 个值，lo ≤ hi
  modifiers: ModifierSpec[];
  requires: { module: 'combat' | 'growth'; key: string } | null;
  fallback: { kind: 'replace'; affixId: string } | { kind: 'omit' } | null;  // requires≠null ⇔ fallback≠null
  expand: { kind: 'growth-attributes' } | null;   // 仅 adept
  rune: { slot: 'weapon' | 'armor'; runicType: string } | null;
  tags: string[];
}
interface ModifierSpec {
  stat: string;                        // 见 §6.5 词表；adept 用 'growth.attribute:{attribute}'
  category: 'flat' | 'increased' | 'more' | 'local-increased' | 'local-flat' | 'override';
  slot?: 'speed';                      // 仅 more
  valueIndex: number;                  // 指向该阶 ranges 下标
  unit: 'bp' | 'int' | 'display-armor' | 'ring-point' | 'runic-strength';
  runicType?: string;                  // 仅符文行
  conditions?: { kind: 'target-tag'; tag: 'body.large' }[];
}
```

**正面·原生键**（顺序即文件顺序；`[lo,hi]`，T1→T6）：

| # | id（名） | 位 | 适用 | 组 | 权重 | 修正（stat / category / unit） | T1 | T2 | T3 | T4 | T5 | T6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | keen 锋利的 | 前 | 武 | dmg-pct | 1000 | `loot.local.damage` local-increased bp | 1500,2500 | 2600,4000 | 4100,6000 | 6100,8500 | 8600,11500 | 11600,15000 |
| 2 | brutal 凶暴的 | 前 | 武 | dmg-flat | 1000 | `loot.local.damage` local-flat int（v0=最小，v1=最大） | 1,1 / 2,3 | 1,2 / 3,5 | 2,3 / 5,7 | 3,5 / 8,11 | 5,7 / 12,15 | 7,9 / 16,20 |
| 3 | honed 淬炼的 | 前 | 武 | enchant | 600 | `native.weapon-enchant` flat int | 1,1 | 1,2 | 2,2 | 2,3 | 3,4 | 4,5 |
| 4 | giantsbane 屠巨的 | 前 | 武 | slayer | 500 | `native.physical-damage-dealt` increased bp，条件 body.large | 2000,3000 | 3100,4500 | 4600,6500 | 6600,9000 | 9100,12000 | 12100,16000 |
| 5 | reinforced 加固的 | 前 | 甲 | def-pct | 1000 | `loot.local.armor` local-increased bp | 1000,1500 | 1600,2200 | 2300,3000 | 3100,4000 | 4100,5000 | 5100,6000 |
| 6 | plated 镶板的 | 前 | 甲 | def-flat | 800 | `native.defense` flat display-armor | 1,1 | 1,2 | 2,2 | 2,3 | 3,4 | 4,5 |
| 7 | warding 守护的 | 前 | 甲/戒 | dr | 700 | `native.physical-damage-taken` increased bp | -400,-300 | -600,-500 | -800,-700 | -1100,-900 | -1400,-1200 | -1800,-1500 |
| 8 | radiant 辉光的 | 前 | 甲/戒 | light | 300 | `native.light` flat ring-point | 1,1 | 1,1 | 1,2 | 2,2 | 2,2 | 3,3 |
| 9 | precise 精准之 | 后 | 武/戒 | accuracy | 900 | `native.accuracy` increased bp | 800,1200 | 1300,1800 | 1900,2500 | 2600,3300 | 3400,4200 | 4300,5200 |
| 10 | swift 迅捷之 | 后 | 武 | speed | 500 | `native.attack-speed` more(speed) bp（负=更快） | -600,-400 | -900,-700 | -1200,-1000 | -1500,-1300 | -1800,-1600 | -2200,-1900 |
| 11 | vital 活力之 | 后 | 甲/戒 | life | 1200 | `native.max-hp` flat int | 5,9 | 10,16 | 17,25 | 26,36 | 37,50 | 51,68 |
| 12 | mending 愈合之 | 后 | 甲/戒 | regen | 500 | `native.regeneration` flat ring-point | 1,1 | 1,1 | 1,2 | 2,2 | 2,3 | 3,3 |
| 13 | titan 巨力之 | 后 | 武/甲/戒 | strength | 600 | `native.strength` flat int | 1,1 | 1,1 | 1,2 | 2,2 | 2,3 | 3,4 |
| 14 | shadow 暗影之 | 后 | 甲/戒 | stealth | 400 | `native.stealth-range` flat ring-point | 1,1 | 1,1 | 1,2 | 2,2 | 2,3 | 3,3 |
| 15 | seeker 寻觅之 | 后 | 戒 | search | 400 | `native.awareness` flat ring-point | 1,1 | 1,2 | 2,2 | 2,3 | 3,3 | 3,4 |
| 16 | clairvoyant 洞悉之 | 后 | 戒 | clairvoyance | 250 | `native.clairvoyance` flat ring-point | 1,1 | 1,2 | 2,2 | 2,3 | 3,3 | 3,4 |
| 17 | wisdom 睿智之 | 后 | 戒 | wisdom | 300 | `native.wisdom` flat ring-point | 1,1 | 1,1 | 1,2 | 2,2 | 2,3 | 3,3 |
| 18 | fireward 阻燃之 | 后 | 甲/戒 | res-fire | 700 | `native.resist.fire` flat bp | 800,1200 | 1300,1800 | 1900,2500 | 2600,3300 | 3400,4200 | 4300,5000 |
| 19 | antivenom 抗毒之 | 后 | 甲/戒 | res-poison | 700 | `native.resist.poison` flat bp | 同 18 | | | | | |
| 20 | leech 汲血之 | 后 | 武 | leech | 500 | `native.transference` flat ring-point | 1,1 | 1,1 | 1,2 | 2,2 | 2,3 | 3,3 |
| 21 | reaper 收割之 | 后 | 武 | reaping | 400 | `native.reaping` flat ring-point | 1,1 | 1,2 | 2,2 | 2,3 | 3,4 | 4,5 |
| 22 | fortune 好运之 | 后 | 戒 | find | 400 | `loot.rarity-find` flat bp | 500,1000 | 1000,1500 | 1500,2200 | 2200,3000 | 3000,4000 | 4000,5000 |

以上 `maxTier=6`、`polarity=1`、`requires/fallback/expand/rune=null`。

**正面·模块键**（接在 22 之后）：

| # | id（名） | 位 | 适用 | 组 | 权重 | 修正 | T1 | T2 | T3 | T4 | T5 | T6 | requires → fallback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 23 | enduring 坚忍的 | 前 | 甲 | stamina | 600 | `combat.stamina-capacity` flat int | 2,3 | 3,4 | 4,6 | 6,8 | 8,10 | 10,12 | combat `combat.stamina-capacity` → replace vital |
| 24 | steadfast 磐石之 | 后 | 甲 | poise | 500 | `combat.poise-capacity` flat int | 1,1 | 1,2 | 2,2 | 2,3 | 3,4 | 4,5 | combat `combat.poise-capacity` → omit |
| 25 | tireless 不倦之 | 后 | 戒 | stamina-regen | 400 | `combat.stamina-regen` increased bp | 500,800 | 800,1200 | 1200,1600 | 1600,2000 | 2000,2500 | 2500,3000 | combat `combat.stamina-regen` → replace mending |
| 26 | sage 贤者之 | 后 | 戒 | focus | 400 | `growth.focus-capacity` flat int | 1,1 | 1,1 | 1,2 | 2,2 | 2,3 | 3,3 | growth `growth.focus-capacity` → replace mending |
| 27 | adept 精擅之 | 后 | 武/甲/戒 | attribute | 600 | `growth.attribute:{attribute}` flat int；`expand: growth-attributes` | 1,1 | 1,1 | 1,2 | 2,2 | 2,3 | 3,3 | growth `growth.attribute` → replace titan |
| 28 | scholar 博学之 | 后 | 戒 | xp | 300 | `growth.xp-gain` increased bp | 400,600 | 600,900 | 900,1200 | 1200,1600 | 1600,2000 | 2000,2500 | growth `growth.xp-gain` → omit |
| 29 | stalwart 坚毅的 | 前 | 甲 | poise-recovery | 300 | `combat.poise-recovery` increased bp | 600,1000 | 1000,1400 | 1400,1900 | 1900,2500 | 2500,3200 | 3200,4000 | combat `combat.poise-recovery` → replace warding |

**负面（仅腐化，`polarity:-1`，每阶单值 lo=hi）**（接在 29 之后）。数值表“T1→T6 线性插值”按 `v_k = v1 + (v6 − v1) × (k−1)/5` 求值、**四舍五入远离零**：

| # | id（名） | 位 | 适用 | 组 | 权重 | 修正 | T1 | T2 | T3 | T4 | T5 | T6 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 30 | dull 钝化的 | 前 | 武 | dmg-pct | 1000 | `loot.local.damage` local-increased bp | -1000 | -1500 | -2000 | -2500 | -3000 | -3500 |
| 31 | brittle 脆裂的 | 前 | 甲 | def-pct | 1000 | `loot.local.armor` local-increased bp | -1000 | -1500 | -2000 | -2500 | -3000 | -3500 |
| 32 | frail 虚弱之 | 后 | 甲/戒 | life | 1000 | `native.max-hp` flat int | -4 | -11 | -18 | -26 | -33 | -40 |
| 33 | clumsy 笨拙之 | 后 | 武/戒 | accuracy | 800 | `native.accuracy` increased bp | -800 | -1200 | -1700 | -2100 | -2600 | -3000 |
| 34 | noisy 喧闹之 | 后 | 甲/戒 | stealth | 600 | `native.stealth-range` flat ring-point | -1 | -1 | -1 | -2 | -2 | -2 |
| 35 | sluggish 迟滞之 | 后 | 武 | speed | 600 | `native.attack-speed` more(speed) bp | 500 | 700 | 900 | 1100 | 1300 | 1500 |

**符文词缀族**（接在 35 之后；全部后缀、组 `rune`、`runeFamilyEnabled:false` 时不进入任何候选，见 §7）：

- 正面强度阶（`runic-strength`）：T1 2,2；T2 3,3；T3 4,4；T4 5,6；T5 7,8；T6 9,10。修正：武器 `native.runic-power`，护甲 `native.armor-runic-power`，category flat，带 `runicType`。
- 权重 = 子权重 × 5（组目标约 300，D-12）。顺序与子权重/最高阶：
  - 武器（`rune-w-*`，itemClasses [weapon]）：speed 10/T6、quietus 3/**T4**、paralyzing 7/**T5**、multiplicity 8/T6、slowing 10/T6、confusion 8/T6、force 8/T6、slaying 5/T6。
  - 护甲（`rune-a-*`，itemClasses [armor]）：multiplicity 8、mutuality 8、absorption 10、reprisal 10、immunity 5、reflection 8、respiration 6、dampening 6（均 T6）。
- 负面符文（`polarity:-1`、`maxTier:1`、`tiers:[{tier:1,ranges:[]}]`、权重 10）：武器 mercy、plenty；护甲 burden、vulnerability、immolation。
- `runicType` 取原生字符串（与 `src/locales/zh_CN.json` 的 `runic.name.*` 一致）。slaying/immunity 在原生需要目标怪物类，抽取方式留给 6B3（D-13）；v1 校验器要求 `runeFamilyEnabled === false`。

### 5.6 `uniques.json`

```ts
interface UniquesFile { schema: 1; uniques: UniqueDefinition[];
  bossUniqueBias: { formId: string; uniqueId: string; multiplierBp: number }[] }
interface UniqueDefinition { id: string; nameKey: string; descriptionKey: string; baseId: string;
  minIlvl: number; weight: number; rows: { rowId: string; ranges: [number, number][]; modifiers: ModifierSpec[] }[] } // rows 1…8
```

| id | 基底 | minIlvl | 权重 | 固定行（按序 r0…；`[lo,hi]` 已换算单位） |
| --- | --- | --- | --- | --- |
| `loot.unique.whisper` 低语 | dagger | 5 | 100 | r0 `native.weapon-enchant` flat int 3,3；r1 `native.accuracy` increased bp 2000,3000；r2 `native.transference` flat ring-point 2,2；r3 `native.runic-power` flat runic-strength 4,4（quietus） |
| `loot.unique.ember-fang` 余烬之牙 | sword | 15 | 100 | r0 `loot.local.damage` local-increased bp 7000,10000；r1 `native.resist.fire` flat bp 3000,3000；r2 `native.light` ring-point 2,2；r3 `native.regeneration` ring-point 1,1 |
| `loot.unique.penitent` 苦修者之环 | ring_of_regeneration | 12 | 80 | r0 `loot.ring-implicit` override ring-point 3,3；r1 `native.max-hp` flat int -10,-10；r2 `native.physical-damage-taken` increased bp -1000,-1000；r3 `native.resist.poison` flat bp 4000,4000 |
| `loot.unique.shadowweave` 影织 | leather_armor | 8 | 100 | r0 `native.stealth-range` ring-point 3,3；r1 `native.attack-speed` more(speed) bp -1200,-1200；r2 `native.max-hp` flat int 25,35；r3 `native.accuracy` increased bp 1500,1500 |
| `loot.unique.cinder-mail` 灰烬链甲 | chain_mail | 18 | 80 | r0 `loot.local.armor` local-increased bp 4000,4000；r1 `native.resist.fire` flat bp 5000,5000；r2 `native.armor-runic-power` runic-strength 6,6（reflection）；r3 `native.max-hp` flat int -15,-15 |
| `loot.unique.colossus-maul` 巨像之锤 | war_hammer | 25 | 60 | r0 `loot.local.damage` local-flat int 8,8 / 14,14（两值）；r1 `native.strength` flat int 4,4；r2 `native.physical-damage-dealt` increased bp 10000,13000 条件 body.large；r3 `native.attack-speed` more(speed) bp 1500,1500；r4 `native.runic-power` runic-strength 8,8（force） |
| `loot.unique.vigil-plate` 守夜人板甲 | plate_mail | 30 | 60 | r0 `loot.local.armor` local-increased bp 4500,5500；r1 `native.max-hp` flat int 60,80；r2 `native.physical-damage-taken` increased bp -1500,-1500；r3 `native.stealth-range` ring-point -2,-2；r4 `native.armor-runic-power` runic-strength 8,8（absorption） |
| `loot.unique.gambler` 赌徒之戒 | ring_of_awareness | 20 | 60 | r0 `loot.ring-implicit` override ring-point 2,2；r1 `loot.rarity-find` flat bp 6000,8000；r2 `native.max-hp` flat int -20,-20；r3 `native.accuracy` increased bp -1000,-1000 |

- 唯一戒指的“本体附魔 +N”解释为**覆盖** ilvl 推导的 ringImplicit（D-14）。
- `bossUniqueBias: [{ "formId": "giants.abyssal-colossus", "uniqueId": "loot.unique.colossus-maul", "multiplierBp": 50000 }]`（D-15；giants 缺席时在有效目录中忽略）。
- 唯一品名称与一句描述（中文、原创）由 dot 撰写，进 locale。

### 5.7 `monsterClasses.json`

```json
{ "schema": 1, "defaultClass": "standard",
  "classes": ["none", "fodder", "splitter", "standard", "elite"],
  "members": [ { "typeId": "rat", "class": "fodder" }, "… 全部 67 种，按 src/data/monsters.json 顺序 …" ],
  "modifiers": { "leader": { "chanceBonusBp": 500 }, "champion": { "chanceBonusBp": 1000, "rarityBonusBp": 5000 } } }
```

成员（已对 `src/data/monsters.json` 核对，恰好 67 种、无遗漏无重复）：

- **none**（17）：goblin_totem, ogre_totem, eldritch_totem, mirrored_totem, spectral_blade, spectral_sword, stone_guardian, winged_guardian, guardian_spirit, Warden_of_Yendor, sentinel, arrow_turret, spark_turret, dart_turret, flame_turret, phylactery, phoenix_egg
- **fodder**（12）：rat, kobold, jackal, eel, monkey, bloat, pit_bloat, explosive_bloat, toad, acid_mound, wisp, pixie
- **splitter**（3）：pink_jelly, acidic_jelly, black_jelly
- **elite**（15）：ogre, troll, naga, underworm, kraken, lich, tentacle_horror, golem, dragon, vampire, goblin_warlord, unicorn, ifrit, phoenix, mangrove_dryad
- **standard**（20）：goblin, goblin_conjurer, goblin_mystic, vampire_bat, centipede, bog_monster, spider, wraith, zombie, ogre_shaman, salamander, dar_blademaster, dar_priestess, dar_battlemage, centaur, phantom, imp, fury, revenant, flamedancer

未列出的 typeId（将来的新怪、giants 形态）取 `defaultClass`。

### 5.8 `dropTables.json`

```ts
interface DropTablesFile { schema: 1; tables: DropTable[] }
interface DropTable { id: string; priority: number;
  match: { source: LootSource; monsterClass?: MonsterClassId; monsterId?: string; formId?: string; depth?: [number, number] };
  chanceBp: number; count: [number, number] | 'preset-encounter';
  classWeights: { weapon: number; armor: number; ring: number }; rarityBonusBp: number;
  minRarity: RarityId | null; ilvlBonus: number }
```

v1 数据（顺序如下；全部 `ilvlBonus:0`、`minRarity:null`、`priority:100`）：

| id | match | chanceBp | count | classWeights 武/甲/戒 | rarityBonusBp |
| --- | --- | --- | --- | --- | --- |
| `loot.drop.kill-fodder` | kill + fodder | 300 | [1,1] | 40/35/25 | 0 |
| `loot.drop.kill-splitter` | kill + splitter | 100 | [1,1] | 40/35/25 | 0 |
| `loot.drop.kill-standard` | kill + standard | 700 | [1,1] | 40/35/25 | 0 |
| `loot.drop.kill-elite` | kill + elite | 3000 | **[1,3]** | 40/35/25 | 5000 |
| `loot.drop.encounter` | encounter | 10000 | `"preset-encounter"` | 35/35/30 | 0 |

- 选表：按 `priority` 降序、同值按数组顺序，第一张 `match` 全部键都满足的表生效；不叠加。kill 无匹配表（含 class=none）→ 不掉物品。
- elite 写 [1,3] 再被预设 `maxPerKill` 截断（稀缺 1 → [1,1]、标准 2 → [1,2]、丰饶 3 → [1,3]），恰好复现数值表“丰饶 elite 件数改 1–3”（D-10）。
- 楼层与宝库不查表（物品类别由请求给出）。

### 5.9 `gold.json`

```json
{ "schema": 1, "amount": { "minBase": 5, "minPerDepth": 3, "maxBase": 15, "maxPerDepth": 6 },
  "byClass": { "fodder": { "chanceBp": 1500, "multiplier": 1 }, "splitter": { "chanceBp": 500, "multiplier": 1 },
               "standard": { "chanceBp": 2000, "multiplier": 1 }, "elite": { "chanceBp": 4000, "multiplier": 3 } },
  "encounter": { "chanceBp": 10000, "multiplier": 10 } }
```

金额 `= floor(randomInt(minBase + minPerDepth·d, maxBase + maxPerDepth·d) × multiplier × goldMultiplierBp / 10000)`，结果 ≥ 1。leader/champion 不影响金币。

### 5.10 `presets.json`

三套顺序 scarce, standard, bountiful。字段与数值表 §6 的 JSON 形状一致，nameKey/descriptionKey 用 `ext.loot.preset.<id>.name|description`。完整数值：

| 字段 | scarce | standard | bountiful |
| --- | --- | --- | --- |
| floorConversionBp | 10000 | 10000 | 10000 |
| killDropMultiplierBp | 6000 | 10000 | 20000 |
| maxPerKill | 1 | 2 | 3 |
| rarityWeights normal/magic/rare/unique/set | 850/120/27/3/0 | 700/220/70/10/0 | 480/330/160/30/0 |
| rarityIlvlScalingBp normal/magic/rare/unique/set | 0/100/150/150/0 | 0/150/250/250/0 | 0/150/300/300/0 |
| affixCount.magic `[{n,w}]` | 1:60, 2:40 | 1:55, 2:45 | 1:40, 2:60 |
| affixCount.rare | 3:55, 4:35, 5:10 | 3:45, 4:35, 5:20 | 4:50, 5:35, 6:15 |
| affixCount.rareHighIlvl `{minIlvl:40, table}` | 4:60, 5:30, 6:10 | 4:45, 5:35, 6:20 | 4:30, 5:40, 6:30 |
| encounter `{count, firstMinRarity, restMinRarity, uniqueWeightBp}` | 1, magic, magic, 30000 | 2, rare, magic, 30000 | 3, rare, magic, 60000 |
| vault `{minRarity, highValueMinRarity}` | magic, magic | magic, rare | rare, rare |
| rarityFind `{k, cap}` | 25000, 10000 | 25000, 20000 | 25000, 30000 |
| corruptChanceBp | 1000 | 600 | 400 |
| familiarity `{weaponKills, armorTurns, ringTurns}` | 20, 1000, 1500 | 10, 600, 800 | 6, 400, 500 |
| goldMultiplierBp | 5000 | 10000 | 15000 |
| salvageMultiplierBp | 10000 | 10000 | 7500 |
| monsterScaling | 表 S | 表 M | 表 B |

`monsterScaling` 为 `[{depth, hpBp, damageBp, accuracyBp}]`，锚点 D1/D5/D10/D20/D26，`accuracyBp` 全 0：

| 锚点 | S hp/dmg | M hp/dmg | B hp/dmg |
| --- | --- | --- | --- |
| 1 | 0/0 | 0/0 | 0/0 |
| 5 | 2000/5000 | 2500/7000 | 2500/9000 |
| 10 | 3500/6500 | 5000/10000 | 5000/14000 |
| 20 | 3500/5000 | 5000/9000 | 5000/12000 |
| 26 | 2500/3000 | 4000/6500 | 4500/9000 |

### 5.11 `enhancement.json`（强化卷轴映射，数据；执行在 6B3）

```json
{ "schema": 1, "caps": { "normal": 10, "magic": 8, "rare": 6, "unique": 4, "set": 4, "runeword": 0 },
  "weapon": { "localDamageBpPerLevel": 1000, "weaponEnchantEveryLevels": 3 },
  "armor": { "maxHpPerLevel": 5, "defenseInternalPerLevel": 5 },
  "ring": { "implicitEveryLevels": 2 },
  "atCap": { "kind": "refine", "target": "random-positive-affix", "keep": "higher", "rejectWhenAllAtTierMax": true },
  "nonLootItems": "native-plus-one" }
```

### 5.12 `identify.json`、`corruption.json`、`salvage.json`

```json
{ "schema": 1, "familiarityMultiplierBp": { "normal": 10000, "magic": 5000, "rare": 10000, "unique": 15000 },
  "familiarityRounding": "ceil", "scrollRevealsAll": true,
  "firstTriggerReveal": { "enabled": true, "excludedStats": ["native.stealth-range", "native.awareness", "native.clairvoyance",
    "native.light", "native.wisdom", "loot.rarity-find", "growth.xp-gain"] } }
```

```json
{ "schema": 1, "eligibleRarities": ["magic", "rare"], "maxTotalAffixes": 6, "negativeRuneFallback": true,
  "compensation": { "tierStep": 1, "maxTier": 6 }, "nativeCursed": true }
```

```json
{ "schema": 1, "shardItemId": "loot.shard", "nameKey": "ext.loot.shard.name", "maxStack": 99,
  "base": { "normal": 1, "magic": 3, "rare": 8, "unique": 20 }, "ilvlStep": 10,
  "corruptedMultiplierBp": 15000, "minimum": 1, "exchange": { "shards": 10, "effect": "identify-one" } }
```

### 5.13 `caps.json`（数值表 §9.1，数据；执行在 5A2-S/6B 集成）

`{ "schema":1, "caps": [ {stat, scope:'loot-sources'|'final', min?, max?, unit} … ] }`，按数值表 §9.1 逐行：`native.max-hp` final max 9999 int；`native.resist.fire`、`native.resist.poison` final max 7500 bp；`native.weapon-enchant` loot-sources max 10 int；`native.defense` final max 220（**内部单位**，unit `int`）；`native.regeneration` loot-sources max 8；`native.stealth-range` max 5；`native.transference` 6；`native.reaping` 8；`native.wisdom` 6；`native.light` 6；`native.clairvoyance` 6；`native.awareness` 8（以上 ring-point、loot-sources）；`native.attack-speed` loot-sources min -4000 bp；`native.physical-damage-taken` loot-sources min -5000 bp。`loot.rarity-find` 的上限在预设 `rarityFind.cap`，不在本文件。

### 5.14 `rareNames.json`

`{ "schema": 1, "first": [ {"nameKey": "ext.loot.rare.first.00"}, … 32 项 ], "second": [ {"nameKey": "ext.loot.rare.second.00"}, … 32 项 ] }`。中文词由 dot 原创（前词两字意象如“血鸦”，后词如“之噬”）；不得用真实品牌、他作专名。

### 5.15 跨文件不变量（校验器必须检查，§8）

所有 baseId 在 bases 中；唯一品基底与类别一致；fallback 目标存在、`polarity=1`、`requires=null`、至少共享一个 itemClass、非符文；负面词缀的 group 必须有同名正面词缀组；每个 itemClass 在每个物等段至少一个正面候选；preset 的 affixCount n 不超过对应稀有度 prefixMax+suffixMax；`rarityWeights.set=0`；bossUniqueBias 的 uniqueId 存在。

### 5.16 `locales/zh_CN.json` 与 i18n 门禁

基线的 `src/test/p1_30_i18n_gate.test.ts` 会把每个已安装模块 descriptor 的 locale 合入资源，并要求**无缺失键、无未引用键**。引用只来自源码字面量与已安装模块 `data/**/*.json` 中字段名为 `nameKey/descriptionKey/textKey/titleKey/unavailableKey/altKey/reasonKey/labelKey` 的字符串。因此：

- locale 中每个键都必须被 `data/` 某个上述字段或 `descriptor.ts` 的 `labelKey/descriptionKey` 引用；反之亦然。
- 键集合：`ext.loot.module.name|description`；`ext.loot.rarity.<6 id>`；`ext.loot.preset.<id>.name|description`；`ext.loot.affix.<name>`（29 条正面 + 6 条负面 + 21 条符文；adept 变体共用 adept 的 nameKey，属性名由 6B2 UI 从 growth 取）；`ext.loot.unique.<name>.name|description`；`ext.loot.rare.first.00–31`、`ext.loot.rare.second.00–31`；`ext.loot.shard.name`。不加 UI 文案（6B2 再加）。
- 模块测试 `loot_locale` 复刻该规则（键集合 = data 引用集合 ∪ descriptor 两键），并在门禁里实际跑一次 `p1_30`。

---

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

### 7.5 固定向量（必须逐字实现为测试；`tape` 断言每次调用的 lo/hi 与返回值）

可用性一律 `{combat:null, growth:null, giants:null}`，`rarityFindBp:0`，`claimedUniqueIds:[]`。

**V1（kill，D10，standard，ogre，非 leader/champion）**，ilvl = 15 + 0 + 1 = 16，共 23 次：

| # | 步骤 | randomInt(lo,hi) | 返回 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | K1 掉率 3000 | (1,10000) | 1874 | 掉落 |
| 2 | K2 件数 [1,2] | (1,2) | 1 | 1 件 |
| 3 | 3a 类别 40/35/25 | (1,100) | 17 | weapon |
| 4 | 3b 基底（段 2：轻 8、中 10、重 8；总 100） | (1,100) | 97 | war_axe（93–100） |
| 5 | 4 稀有度 700/408/147/21/0 | (1,1276) | 1200 | rare（1109–1255） |
| 6 | 6 词缀数 45/35/20 | (1,100) | 30 | 3 |
| 7 | 7a 位置 | (0,1) | 0 | 前缀 |
| 8 | 7b keen1000/brutal1000/honed600/giantsbane500 | (1,3100) | 500 | keen |
| 9 | 7c 阶 [35,40,25] | (1,100) | 90 | T3 |
| 10 | 7d keen T3 | (4100,6000) | 5200 | |
| 11 | 7a | (0,1) | 1 | 后缀 |
| 12 | 7b precise900/swift500/titan1200/leech500/reaper400 | (1,3500) | 450 | precise |
| 13 | 7c | (1,100) | 50 | T2 |
| 14 | 7d precise T2 | (1300,1800) | 1500 | |
| 15 | 7a | (0,1) | 0 | 前缀 |
| 16 | 7b brutal1000/honed600/giantsbane500 | (1,2100) | 300 | brutal |
| 17 | 7c | (1,100) | 60 | T2 |
| 18 | 7d brutal T2 最小 | (1,2) | 2 | |
| 19 | 7d brutal T2 最大 | (3,5) | 4 | |
| 20 | C1 腐化 600 | (1,10000) | 9000 | 不腐化 |
| 21 | 9 前词 | (0,31) | 5 | |
| 22 | 9 后词 | (0,31) | 17 | |
| 23 | G1 elite 金币 4000 | (1,10000) | 7000 | 无金币 |

期望：`items[0].data = { v:1, baseId:'war_axe', ilvl:16, rarity:'rare', uniqueId:null, setId:null, affixes:[{id:'loot.affix.keen',tier:3,values:[5200],known:false},{id:'loot.affix.precise',tier:2,values:[1500],known:false},{id:'loot.affix.brutal',tier:2,values:[2,4],known:false}], corrupted:false, enhancement:0, sockets:0, socketed:[], nameParts:[5,17], origin:{source:'kill',depth:10} }`；`native = { kind:'war_axe', category:'weapon', enchantment:0, runicType:null, runicStrength:null, isCursed:false, identified:false }`；`gold:0`、`newUniqueIds:[]`、`draws:23`。（titan 武器权重 1200 = 600 + adept 缺席替代 600。）

**V2（floor，D1，standard，itemClass ring）**，ilvl 1，共 7 次：

| # | 步骤 | randomInt | 返回 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | 3b 戒指 8×10 | (1,80) | 25 | ring_of_regeneration |
| 2 | 4 稀有度 700/223/71/10/0 | (1,1004) | 800 | magic |
| 3 | 6 词缀数 55/45 | (1,100) | 20 | 1 |
| 4 | 7a（前缀候选 warding/radiant 非空） | (0,1) | 1 | 后缀 |
| 5 | 7b 戒指后缀：precise900, vital1200, mending1300, titan1200, shadow400, seeker400, clairvoyant250, wisdom300, fireward700, antivenom700, fortune400 | (1,7750) | 2000 | vital |
| — | 7c 只有 T1 | 不抽 | | T1 |
| 6 | 7d vital T1 | (5,9) | 7 | |
| 7 | C1 腐化 600 | (1,10000) | 10000 | 不腐化 |

期望：`affixes:[{id:'loot.affix.vital',tier:1,values:[7],known:false}]`、`nameParts:null`、`origin:{source:'floor',depth:1}`、`converted:true`、`native.enchantment:1`、`gold:0`、`draws:7`。（mending 1300 = 500 + tireless 400 + sage 400；scholar 被 omit。）

**dot 自行推导并加入至少 12 条向量**（每条在测试注释写出推导，覆盖）：elite 两件；leader + champion 掉率/物等/稀有度修正；丰饶 elite [1,3]；稀缺 maxPerKill=1 时件数不抽；encounter 首件 rare 截断 + 唯一 ×3 + boss bias（giants 可用）与 bias 被忽略（giants 缺席）；唯一候选为空降级为 rare；唯一已被 claimedUniqueIds 占用；唯一固定行区间抽取；vault 给定 baseId；vault highValue；floor 转换率 <10000 的失败分支（需临时预设）；rare ilvl ≥40 使用 rareHighIlvl；腐化：负面词缀 + 补偿（含 m=1 不抽）；腐化但负面候选为空不腐化；combat+growth 都在时 enduring/adept 变体出现；class=none 与 encounterSubject 0 抽取；rarityFindBp 超过 cap。

---

## 8 校验器与预算

### 8.1 `loadLootPack` 必须拒绝（每条一个负例测试，断言错误码与路径）

1. 任一文件缺失、`schema≠1`、未知字段、非安全整数、负权重、权重 >10000。
2. 预算：词缀 >256；每词缀阶 >8 或 `maxTier`>6；每阶值 >4；唯一品 >128；每唯一行 >8；掉落表 >256；预设 >8；`maxPerKill`、encounter.count 不在 1…8；count[1] >8。
3. 区间：lo>hi；阶不连续/重复；`tiers.minIlvl` 非严格递增；`ilvlBands` 不连续覆盖 1…99；monsterScaling 锚点非严格递增或首锚点≠1。
4. 引用：未知 baseId/uniqueId/affixId/rarity/class/preset 字段；fallback 目标不合法（§5.15）；`requires` 与 `fallback` 只出现一个；`expand` 出现在 adept 以外。
5. 互斥：同一 `id` 重复；`rune` 组以外，同一组的词缀必须同一位置（不得一组里既有前缀又有后缀；同组多个正面词缀允许，如 adept 变体）；`rune` 组只能含 `rune≠null` 的词缀，反之亦然；负面词缀的组没有同名正面组。
6. 资格：itemClasses 空或含重复；每 itemClass × 每物等段至少一个正面候选；稀有度 prefixMax+suffixMax > 6；预设 affixCount 的 n 超出稀有度上限或 n<1；`rarityWeights.set≠0`；`runeFamilyEnabled≠false`。
7. 静态抽取上界：按 §7 计算单件最坏抽取数（类别+基底+稀有度+唯一+词缀数+每槽(位置+词缀+阶+值数)×6+腐化(判定+负面+阶+补偿选+补偿值)+唯一行值+名称）与单事件（判定+件数+8×单件+金币 2）；超过 64/512 拒绝 `DRAW_BUDGET`，报告写出 v1 数据的实际上界。
8. 怪物分级：typeId 重复、class 不在 classes。测试另断言 members 恰为 `src/data/monsters.json` 全部 67 个 ID。
9. locale：data 引用的键缺失；locale 多出未引用键；键不以 `ext.loot.` 开头。

### 8.2 `validateLootItemData` 必须拒绝

`v≠1`；未知字段；未知 baseId；ilvl 越界；rarity 为 set/runeword；unique 与 uniqueId 不一致或唯一基底不符；affixes 数量超出稀有度上限（腐化允许多 1 条负面，总数 ≤6）；前/后缀名额超限（负面不计）；组重复；未知词缀或不适用该 itemClass；tier 超过 maxTier；**未腐化物品的每条 tier 必须已对 ilvl 解锁**，腐化物品允许恰好一条正面词缀比其最高解锁阶高 1；values 长度或范围与该阶不符；负面词缀条数 ≠ (corrupted?1:0)；unique 的 affixes 与 rows 不一一对应或值越界；nameParts 存在性与 rare 不符或下标越界；known 非布尔；enhancement 不在 0…cap；sockets≠0、socketed 非空、setId 非 null；origin 非法。生成器产出必须 100% 通过（属性测试）。

---

## 9 纯辅助函数（`economy.ts`、`item.ts`）

| 函数 | 规则 | 必测向量 |
| --- | --- | --- |
| `monsterScalingAt(preset, depth)` | 锚点间线性：`v0 + floor((v1−v0)×(d−d0)/(d1−d0))`；d ≥ 末锚点取末锚点 | 标准 D7 → hp 3500 / dmg 8200；D23 → 4500 / 7750；D30 = D26；D1 → 0/0 |
| `goldRange(depth)` | `[5+3d, 15+6d]` | D10 → [35,75] |
| `salvageYield(data, preset)` | `q = base×(1+floor(ilvl/10))`；`q = floor(q×salvageMultiplierBp/10000)`；腐化 `q=floor(q×15000/10000)`；`max(1,q)` | 标准 rare ilvl16 腐化 → 24；丰饶 normal ilvl1 → 1 |
| `familiarityThresholds(data, preset)` | 预设值 × 稀有度倍率，`ceil` | 标准 magic 武器 → 5 杀；标准 unique 护甲 → 900 回合 |
| `enhancementCap(data)` | rarities.enhancementCap | |
| `ringImplicit(ilvl)` | §5.3 | ilvl 1→1、15→2、45→4、99→4 |

---

## 10 统计工具

### 10.1 目的

N-12=B：用**真实生成器**跑固定种子，对照数值表 §6（稀有度分布）、§10.1（每层件数与构成、累计、击杀金币）、§10.1 唯一品机会、§9.2（强度代理），偏差 >±20% 标记，供维护者决定是否回调数值。偏差标记不是失败。

### 10.2 事件模型（固定，写进报告；与数值表模型同口径）

每局 D1–D26 逐层，工具自带确定性 PRNG（`mulberry32`，种子 = `seedBase + runIndex`，各预设独立用同一种子集；**只用于统计，不是规则 RNG**），其 `randomInt` 同时驱动事件模型与生成器：

| 事件 | 模型 |
| --- | --- |
| 击杀 | 次数 `K(d)=12+0.35d`：取 `floor(K)` 次，再以小数部分概率加 1 次；每次从“该深度可出现怪物”等权选一种：`minDepth ≤ d ≤ maxDepth`、class≠none、排除传说盟友 unicorn/ifrit/phoenix/mangrove_dryad；leader/champion 恒 false |
| 楼层 | 件数 `3 + geom(60%)`（每次 60% 再 +1），D1–2 再 +2、D3–4 再 +1；每件按原生类别权重 武10/甲8/戒3/其他104 抽类别，武/甲/戒转 floor 请求 |
| 宝库 | 每层 30% 一件，类别 武10/甲8/戒3，`baseId:null`、`highValue:false` |
| 遭遇 | 每层概率 P(d)：D1–2 0；D3–6 0.5；D7–8 0.7；D9–20 1.0；D21+ 0；`formId:null` |
| 唯一收据 | 每局维护 `claimedUniqueIds` |
| 寻宝 | `rarityFindBp` = 已获物品中 `fortune` 与 gambler 行的最大两件戒指之和（简化），封顶由生成器处理 |

### 10.3 输出

每预设 × 深度（D1、D5、D10、D15、D20、D26，及全 1–26 明细）：

- 每层件数均值，拆分击杀/楼层/宝库/Boss；普/魔/稀/唯件数；累计件数；击杀金币均值。
- 稀有度精确分布（不抽样）：`computeRarityWeights` 在 ilvl 1/15/30/39 普通击杀与 elite 下的百分比，对照数值表 §6 表，容差 ±0.15 个百分点（应完全吻合；不吻合即实现错误或数值表算术错误，报告逐格说明）。
- 唯一品：每局“唯一稀有度抽中次数”（机会）对照 0.6 / 4.5 / 14；实际产出唯一件数、各唯一品分布、降级为 rare 的比例。
- 阶分布：每层词缀阶占比；首次出现 T2–T6 的深度对照数值表 §1.2。
- 腐化率、平均词缀数、每件/每事件最大抽取数、生成物 `validateLootItemData` 失败数（必须 0）。
- 强度代理（仅标准预设，D1/5/10/15/20/26 的每局中位数，对照数值表 §9.2）：
  - `E(d)=floor(0.6d)` 张强化卷轴，武器 `ceil(E/2)`、护甲 `floor(E/2)`，各按该件稀有度上限截断。
  - 武器 `W = ((min+flatMin)+(max+flatMax))/2 × max(0,10000+localDamageBp+1000·e)/10000 × 1.065^(weaponEnchant+floor(e/3))`；基底伤害由 `src/data/weapons.json` 的 `XdY+Z` 得 min=X+Z、max=X·Y+Z；取已获武器（含起始 dagger）的最大值。
  - 护甲显示 `min(22, base×(10000+localArmorBp)/10000 + plated + 0.5e)`；生命 `30+10·floor(d/4)` + 最佳护甲（vital+唯一生命行+5e）+ 最佳两枚戒指生命；减伤 = 最佳护甲与两枚戒指的 `physical-damage-taken` 之和取负，封顶 50%。各指标独立取最大（乐观上界）。
  - 报告标注“口径不同（独立取最大、忽略力量/成长/鉴定），仅作复核提示”。

偏差标记：`|实际−目标|/目标 > 20%` 且 `|实际−目标| > 0.02`（避免极小值噪声）。

### 10.4 `tools/doc-targets.ts`

从数值表转录：§6 稀有度表（3 预设 × 4 物等 × 普/魔/稀/唯，含括号内 elite）、§10.1 全表（15 行 × 件数/拆分/构成/累计/金币）、§10.1 唯一机会、§9.2 标准列、§1.2 首次可得深度。每个常量旁注明出处节号。

### 10.5 运行方式

- `tools/stats.ts` 导出纯函数 `computeLootStats({ runs, presets, depths, seedBase }) → LootStatsReport`（JSON 可序列化，含输入参数、包指纹、有效目录指纹）与 `renderLootStatsMarkdown(report)`。
- `tools/loot-stats.mjs`：用 Vite 的 `createServer({ configFile: false, root: <仓库根>, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' })` + `ssrLoadModule('/src/ext/modules/loot/tools/stats.ts')` 加载并运行，参数 `--runs 300 --seed-base 1 --out <目录>`，写 `loot-stats.json` 与 `loot-stats.md`，结束关闭 server。退出码只在异常或生成物校验失败时非 0。命令：`node src/ext/modules/loot/tools/loot-stats.mjs --runs 300 --seed-base 1 --out <仓库外目录>`。
- 若 Vite SSR 方式在 dot 环境不可用：改用测试文件 `tests/loot_stats.test.ts` 内由环境变量 `LOOT_STATS_FULL=1 LOOT_STATS_OUT=<目录>` 触发全量运行（默认只跑小样本），并在报告写明。
- 全量：每预设 300 局 × D1–26。把 JSON 结果提交为 `docs/ext/evidence/phase6b1a-loot-stats.json`（须 ≤256 KiB，超出则只提交汇总层级），Markdown 汇总写进报告。

---

## 11 loot 测试要求（全部登记在 `src/ext/modules/loot/test-suites.json` 的 `test`；`gen`/`drift` 为空）

| 文件 | 覆盖 |
| --- | --- |
| `tests/loot_data.test.ts` | 全部数据载入与冻结；**双重转录**：测试内独立手写 §5 的关键表（全部词缀阶区间、唯一行、预设、怪物分级、掉落表、金币）与 JSON 逐项比对；baseId 对原生数据；怪物 67 种全覆盖；指纹稳定、改任一数值指纹变化、改 locale 不变 |
| `tests/loot_schema.test.ts` | §8.1 全部负例（≥45 条，`it.each`） |
| `tests/loot_catalog.test.ts` | 可用性 4 种组合（无/combat/growth/两者）+ giants 有无：有效权重表逐项断言（含 V1/V2 用到的权重）、adept 变体与权重、omit、bias 丢弃、指纹确定性与区分性 |
| `tests/loot_generator_vectors.test.ts` | V1、V2 与 ≥12 条自推导向量；tape 调用参数逐次断言、tape 用尽断言 |
| `tests/loot_generator_props.test.ts` | 每预设 × 每来源 × ≥2000 个种子：结果通过 `validateLootItemData`；前后缀名额、组互斥、阶窗口、值区间；`draws` 等于实际调用次数且 ≤ 上界；同种子同结果；输入深冻结不被修改；“唯一结果不抽”（构造单候选场景断言调用次数）；回调越界/非整数抛错；非法请求 0 次抽取 |
| `tests/loot_item.test.ts` | §8.2 全部负例；`deriveNativeFacts`（戒指本体、唯一覆盖、符文行、腐化诅咒）；`projectItemModifiers`（adept 展开、强化行、本体行） |
| `tests/loot_economy.test.ts` | §9 全部向量 |
| `tests/loot_locale.test.ts` | §5.16 键集合双向一致；全部中文非空、无占位“TODO” |
| `tests/loot_stats.test.ts` | `computeLootStats({runs:5})` 两次结果深相等；结构完整；稀有度精确表对照（§10.3 容差）；生成物校验失败数 0 |
| `tests/loot_inert.test.ts` | §4.3 惰性证明；descriptor 字段；`createLootModule()` 只含 5 个键 |

---

## 12 第二部分：narrative NPC 像素立绘

### 12.1 现状（已核对基线）

- NPC 定义：`src/ext/modules/narrative/data/definitions.json` 的 `npcs[]`，每个有 `portraitId`；节点可覆盖 `portraitId`（当前无覆盖）。
- 立绘槽**已存在**：`data/portraits.json`（schema 1，`displayVersion 1.1.0`，三项 288×384、`fit:contain`、`anchor:bottom-center`）；`ui/portraits.ts` 以 `import.meta.glob('../assets/portraits/**/*.{png,webp}')` 解析；`ui/NarrativePortrait.vue` 渲染并处理加载失败占位；`ui/NarrativeDialogue.vue` 布局：桌面 240×320、≤700px 宽 72×96、≤350px 宽 48×64，立绘页大图 `max-width:420px`。测试断言源码含 `width:72px;height:96px` 与 `width:48px;height:64px`（保持不变）。
- 显示资产变化只更新 `displayVersion`，不进入规则指纹（`narrative-config.md` 第 42 行）。

因此无需新增立绘槽；只替换资产与做渲染适配，不改任何共用文件。

### 12.2 规格（D-21）

| 项 | 值 |
| --- | --- |
| 像素网格 | **48×64**（3:4），资产即按 1× 存储（不预放大），PNG 实际尺寸 48×64 |
| 显示倍率 | 桌面 240×320 = 5×；≤350px 48×64 = 1×；≤700px 72×96 = 1.5×（DPR 2 设备上为 3 个物理像素，整数）；立绘页 `max-width:384px`（8×） |
| 渲染 | `image-rendering: crisp-edges; image-rendering: pixelated;`（后者覆盖前者），只放大不缩小 |
| 背景 | PNG 透明背景，alpha 只有 0/255；组件背景改为纯色 `var(--bg-deep,#11130f)`（去掉径向渐变），保持深色 |
| 调色板 | 三张共享一份 **24 色**调色板（+1 透明索引）；无抖动 |
| 构图 | 半身至腰、3/4 侧身朝画面右侧、视线向右前方；头顶约在第 4–10 行；画面底边切过腰部；手与道具在胸前、完整入框 |
| 光照 | 单一暖色光源来自左上，右侧深阴影；两到三级平涂明暗 |
| 轮廓 | 一像素深褐黑外轮廓（须比背景 `#11130f` 明显可辨，见 §12.7） |
| 文件 | 索引色 PNG（color type 3），位深 8 或 4，无 tEXt/iTXt/zTXt/eXIf/时间块；每张 ≤4 KiB，三张合计 ≤12 KiB |
| 命名 | 原文件名原位替换：`archive-keeper.png`、`bell-mender.png`、`wick-listener.png`；调色板 `assets/portraits/palette.json`（按亮度升序的 `#rrggbb` 数组，不含透明） |

### 12.3 提示词模板（英文；只替换花括号）

```text
Pixel art character portrait for a dark fantasy roguelike game. {SUBJECT}. {FACE}. {CLOTHING}. {PROP}.
Bust-to-waist portrait, three-quarter view, the body and face turned toward the right side of the image, eyes looking slightly to the right. Exactly one figure, centered horizontally. The top of the head sits about one fifth of the image height below the top edge; the bottom edge of the image cuts straight across the waist. Both hands and the held object are fully inside the frame, in front of the chest.
Chunky low-resolution pixel art drawn on a 48 by 64 pixel grid and enlarged with hard square pixels. Every pixel is one flat solid colour. Limited muted palette of about 20 colours: {PALETTE}. One dark brown-black outline one pixel wide around the whole silhouette. Simple cel shading in two or three flat steps. A single warm light from the upper left; the right side of the figure falls into deep shadow.
The entire background is one flat pure magenta colour, hex FF00FF, from edge to edge, with nothing else in it.
There is no text, no letters, no numbers, no signature, no watermark, no border, no frame, no scenery, no floor, no cast shadow, no glow, no light rays, no sparkles, no smoke, no gradient, no blur, no soft edges, no anti-aliasing, no noise, no second character.
Original character design, not based on any existing game, film, comic, artwork or artist.
```

### 12.4 每位 NPC 的关键词（取自 definitions.json 与 zh_CN.json；保留上一版人物设定的连续性）

| NPC（ID / 字形 / 地图色） | SUBJECT | FACE | CLOTHING | PROP | PALETTE |
| --- | --- | --- | --- | --- | --- |
| 档案守卫 `archive.keeper` / 人 / `#c3ad80`（“守着残页的旅人”） | a weathered middle-aged man, a quiet traveller who guards torn manuscript pages | short grey beard, tired calm eyes in the shade of a hood | ochre-brown hooded travelling cloak with frayed edges over dark brown clothes | a thick bundle of loose parchment pages tied with cord, held flat against his chest with both hands | ochre, parchment beige, umber brown, charcoal, a little ash grey, warm skin |
| 缄钟匠 `bell.mender` / 钟 / `#bda078`（“银发匠人捧着裂开的铜铃，围裙满是煤灰”） | a practical older woman, a craftswoman who repairs bells | short silver hair, lined steady face, firm closed mouth | soot-grey leather work apron over charcoal work clothes, sleeves rolled to the elbow | a small copper handbell with one clear crack down its rim, held in both hands, a short cord hanging from its handle | copper, soot grey, charcoal, silver white, warm tan skin, dull brass |
| 听烬人 `wick.listener` / 烬 / `#9bafbb`（“灰蓝兜帽……提着一盏熄灭的灯”） | a lean, patient, slightly uncanny adult of uncertain age who listens to an extinguished lamp | pale narrow face half in shadow under a deep cowl, calm half-closed eyes, a listening expression | ash-blue hooded cowl and long ash-blue robe with a ragged hem | a small dark iron lantern raised to chest height in one hand, its wick black and unlit, no flame and no light inside | ash blue, slate grey, charcoal, pale bone skin, dull iron |

可把旧立绘作为角色参考图（我方原创资产）以保持人物设定连续，但风格必须按本模板重画。每位最多生成 6 次，记录每次的拒绝原因。

### 12.5 后处理（Python + Pillow + numpy；脚本提交为 `src/ext/modules/narrative/tools/pixelize_portraits.py`，中间产物留在仓库外）

做法与教训来自维护者的像素产线经验库（键控色单一来源、量化不可跳过、共享调色板与统一缩放、去杂点在降采样之后、四角透明闸门、可量化验收）：

1. **原图闸门**：生成尺寸 1024×1536。四角各 32×32 区域的平均色与 `#FF00FF` 的最大通道差 ≤60，否则丢弃（模型改了背景色）。
2. **键控**：像素与 `#FF00FF` 最大通道差 ≤60，或 `min(r,b) − g > 30`（半透明洋红边缘）→ 透明。三位 NPC 主色（赭/铜/灰蓝）均不与洋红色相相邻，统一用洋红；键控色只在脚本一个常量里定义。
3. **固定裁切**（统一缩放的来源）：取底部 1024×1365 区域（去掉顶部 171 行背景），三张完全相同。裁后在**源图**上做边缘检查：顶行不透明 ≤2 px；左右列在上 80% 高度内不透明 ≤2 px；否则丢弃（头或道具被切）。
4. **降采样**：预乘 alpha 后 BOX 缩到 48×64，再反预乘；alpha ≥128 → 255，否则 0。
5. **去杂点**：删除与主体断开、面积 ≤2 px 的不透明连通块（4 邻接），记录删除数。
6. **共享调色板**：三张选定图都完成 1–5 后，对三张的全部不透明像素合并做 median-cut 得 24 色；写 `palette.json`。
7. **映射**：每像素映射到 L1 距离最近的调色板色，不抖动。
8. **保存**：P 模式，索引 0 为透明（tRNS 只有一个 0，其余 255），`optimize=True`，不写任何文本/EXIF 块。
9. **预览**（仓库外）：三张并排在 `#11130f` 上的 1×、5×、8× 最近邻放大联系表，用于视觉验收。

若 24 色导致明显色带或人物主色丢失，可升到 32 色一次，报告说明理由（D-22）。

### 12.6 模块内改动

- `data/portraits.json`：三项 `width:48`、`height:64`，`displayVersion` → `1.2.0`；ID、asset、altKey、fallbackGlyph 不变。
- `ui/NarrativePortrait.vue`：`img` 加 `image-rendering:crisp-edges;image-rendering:pixelated`；背景改纯色 `var(--bg-deep,#11130f)`。占位/加载失败逻辑不动。
- `ui/NarrativeDialogue.vue`：`.narrative-large-portrait` 的 `max-width:420px` → `384px`；其余尺寸不变（保留 72×96、48×64 断言）。
- `tests/narrative_portrait_pixels.test.ts`（新增，登记到 narrative 的 `test-suites.json`）：对 manifest 中每个 asset 读文件字节并解析 PNG 块：IHDR 48×64、color type 3、位深 4 或 8、无隔行；PLTE 项数 ≤ `palette.json` 长度 + 1；tRNS 恰一个 0、其余 255；无 tEXt/iTXt/zTXt/eXIf/tIME；文件 ≤4096 B；PLTE 中非透明色 ⊆ `palette.json`；用 `node:zlib` 解 IDAT 并反滤波，断言四角透明、顶行不透明 ≤2、左右列上 80% 内不透明 ≤2；`palette.json` 无洋红类颜色（`min(r,b)−g>30 且 r>150`）。另在既有源码断言测试中增加对 `image-rendering:pixelated` 的检查。
- `docs/ext/narrative-config.md`：把“三位NPC的原创GPT生成PNG立绘”“288×384”等句子更新为像素立绘规格，并加一小节“像素立绘规范”（网格、调色板、渲染、后处理脚本位置、替换步骤）。

### 12.7 验收

数值（脚本输出写进报告）：

| 检查 | 通过条件 |
| --- | --- |
| 调色板越界 | 0（三张） |
| 四角透明 | 是（三张） |
| 头顶行（首个 ≥3 不透明像素的行） | 每张 3–12，三张极差 ≤4 |
| 不透明覆盖率 | 35%–75% |
| 去杂点删除数 | 报告实际值 |
| 轮廓可辨 | 剪影边界像素与 `#11130f` 的 WCAG 对比度中位数 ≥1.5 |
| 文件大小 | 每张 ≤4 KiB，合计 ≤12 KiB |

视觉一致性清单（逐项写“是/否+说明”）：同一光向；同一朝向；同一轮廓粗细；同一像素密度（无亚像素细节、无半像素斜线糊块）；1× 下眼睛与道具可辨；人物主色与地图字形色同色相族；无文字/水印/边框；听烬人的灯无火光；缄钟匠的裂口可见；三张并排看是同一套美术。

浏览器（当次 `npm run build` + `npx vite preview`，Playwright Chromium）：1440×900、390×844、320×844 三视口 × DPR 1 与 2，打开任一 NPC 对话与“查看立绘”页；截图放大检查像素边缘锐利、无模糊、无裁切、无默认占位。截图留仓库外，不提交。浏览器不可用时记为 **blocked**，不得写通过。

### 12.8 署名与许可

报告写明：图像由 dot 环境的 OpenAI 图像模型生成（模型名、日期、每张最终采用的完整提示词），为本项目原创角色；提示词不含任何艺术家、作品或游戏名；未使用第三方图片作参考（旧立绘为本项目自有资产）；生成内容按 OpenAI 使用条款归使用者；最终 PNG 的 SHA-256。

### 12.9 Part 2 门禁

`node scripts/check-module-boundaries.mjs`、`npx vue-tsc -b`、`npm run build`、`npx vitest run src/ext/modules/narrative/tests --maxWorkers=2`、`npx vitest run src/test/p1_30_i18n_gate.test.ts`、§12.7 浏览器验收。

### 12.10 不可用时

dot 环境无法生成图像：第二部分整体不改任何 narrative 文件，报告记 blocked 与原因。部分 NPC 无法达标：三张都不替换（保持风格一致），报告附候选与失败原因。

---

## 13 门禁

所有命令在仓库根执行，`NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=2`。报告只写实际运行过的命令、退出码、数量（passed/skipped/todo/failed）、耗时；未运行写“未运行”及原因。

| 里程碑 | 内容 | 门禁 |
| --- | --- | --- |
| M1 | 目录骨架、descriptor（惰性）、test-suites.json、全部 data 与 locale、schema、definitions | boundary、vue-tsc、`npx vitest run src/ext/modules/loot/tests`、`node scripts/test-discovery.mjs` |
| M2 | catalog、rarity、generator、V1/V2 与自推导向量、属性测试 | boundary、vue-tsc、loot 测试 |
| M3 | item/economy、全部负例 | 同上 + build |
| M4 | 统计工具、全量运行、evidence | 同上；全量统计命令 |
| M5 | 惰性证明与直接受影响的既有测试 | boundary、vue-tsc、build、loot 测试、`npx vitest run src/test/p1_30_i18n_gate.test.ts src/test/ext_module_creation_ui.test.ts src/test/ext_module_boundaries.test.ts src/test/phase4f_audit.test.ts src/test/ext_module_composition.test.ts --maxWorkers=2` |
| M6 | 第二部分资产与模块内改动 | §12.9 |
| 收尾 | 同一最终候选树 | boundary、vue-tsc、build、loot 测试、narrative 测试、M5 列出的既有测试各一次 |

- boundary = `node scripts/check-module-boundaries.mjs`；vue-tsc = `npx vue-tsc -b`；build = `npm run build`。
- 不跑完整 `npm test`、全部 `test:ext`、组合 smoke 脚本、删除矩阵、`ce:fetch`、`test:full`、`test:gen`、`test:drift`（本步不改生成）。
- `ext_module_composition.test.ts` 会把 loot 纳入全部子集（32 个真实子集），耗时较长，属预期；失败须归因。

---

## 14 交付物与报告格式

### 14.1 `docs/ext/phase6b1a.report.md`（节序固定）

1. **结论**：两部分各自完成/部分完成/blocked；一句话说明 loot 核心是否全部按任务书实现。
2. **基线与环境**：起点 commit、merge commit、最终 commit、Node 版本、发现器检查结果。
3. **交付清单**：新增/修改文件列表与 `git diff --stat origin/ext/foundation..HEAD` 摘要；声明全部在允许范围内。
4. **版本与身份**：LOOT_VERSION、rules 指纹、v1 数据静态抽取上界（单件/单事件）、narrative displayVersion。
5. **数据一致性**：声明 §5 数值逐项照录（指向 `loot_data` 双重转录测试）；列出任务书对数值表所作的全部解释（负面插值、单位换算、权重合并等）。
6. **生成器与向量**：向量清单（每条一句目的）、属性测试规模、抽取预算实测最大值。
7. **统计结果**：§10.3 全部表格（目标/实际/偏差/标记），偏差 >±20% 的项逐条给出最可能原因（模型口径差异/数据/实现），**不改数据**，只提出可选调整建议。
8. **第二部分**：最终提示词、尝试次数与拒绝原因、§12.7 数值与清单、浏览器结果、署名许可、SHA-256。
9. **门禁结果表**：§13 各里程碑末次与收尾。
10. **自行决定事项**：按 §16.2 作出的全部决定。
11. **待集成与复核清单**：§6 中所有 `[C6-1] [5A2-S] [6B-int] [6B3]` 项，各写“集成时需确认什么”。
12. **未覆盖项**。

### 14.2 `docs/ext/loot-core-contract.md`

内容：用途与稳定性分级（稳定 / 临时待 C6-1 / 临时待 5A2-S / 待 6B 集成 / 待 6B3）；§6 全部类型；§7 抽取次序全文（可直接引用或复制本任务书 §7）；错误码表；“集成复核清单”表（项目 / 待复核步 / 可能变化 / 影响面 / 预计改动文件）。这份文档将作为 6A0 C6-1 合同起草时的输入。

### 14.3 提交

按逻辑分提交，英文前缀：`feat(loot): data pack, schema and inert descriptor` / `feat(loot): deterministic generator and effective catalog` / `test(loot): …` / `feat(loot): stats tool and evidence` / `feat(narrative): pixel-art NPC portraits` / `docs(ext): 6B1-alpha report and loot core contract`。先跑完门禁确认结果，再单独执行推送；里程碑门禁通过后可推送备份。

---

## 15 不得修改清单

| 类别 | 内容 |
| --- | --- |
| 共享源码 | `src/engine/**`、`src/entities/**`、`src/data/**`、`src/ext/*.ts`、`src/ext/ui/**`、`src/ui/**`、`src/components/**`、`src/App.vue`、`src/locales/**`、`src/i18n.ts`、`src/test/**`（含 harness、support、i18n_scan） |
| 其他模块 | `src/ext/modules/{growth,combat,giants}/**`；narrative 中 §12.6 未列出的文件（definitions.json、locales、schema、其余 ui/逻辑） |
| 脚本与配置 | `scripts/**`、`package.json`、lock、`vite.config.*`、`tsconfig*.json` |
| 文档 | 除 `docs/ext/phase6b1a.report.md`、`docs/ext/loot-core-contract.md`、`docs/ext/evidence/phase6b1a-loot-stats.json`、`docs/ext/narrative-config.md`（仅立绘相关句子与新增小节）外的所有文档，含 README、设计稿、数值表与本任务书 |
| 版本 | foundation 协议、任何格式号、其他模块的 module/rules/state 版本；narrative 只改 `displayVersion` |
| 本包决定 | §4 版本与惰性形态、§5 全部 ID/数值/顺序/单位、§6 类型名与字段、§7 抽取次序、§12.2 规格 |

禁止手段：`Math.random`/`Date`/全局 RNG 进入生成器；为过门禁而 skip/todo/放宽既有测试；在 loot 内 import 其他模块文件；把 locale 键写成动态拼接（i18n 扫描不可解析）；在仓库提交原始生成图、联系表或截图。

---

## 16 已预先作出的决定与 dot 自主裁决规则

### 16.1 已决定（不再讨论；维护者在 §A5 签署）

| 编号 | 决定 |
| --- | --- |
| D-01 | loot 以惰性模块安装（§4）：发现器强制 descriptor；defaultEnabled:false；启用零行为、零随机数 |
| D-02 | 版本 `0.1.0`、rules schema 1；模块 state 恒 `{}` |
| D-03 | 数据拆为 16 个 JSON（§3），全部在 `data/`；单位一律 bp/int/显示点/戒指点/符文强度 |
| D-04 | 预设 ID `scarce/standard/bountiful`，文本键 `ext.loot.*` |
| D-05 | “唯一结果不抽”：单候选、lo=hi、min=max、概率 ≤0 或 ≥10000 均不调用 randomInt |
| D-06 | 第 3 步拆为 3a 类别与 3b 基底两次加权选择 |
| D-07 | `LootItemData` 新增 `corrupted` 字段；唯一品固定行存于 `affixes`（id=rowId、tier=0） |
| D-08 | 腐化：C1 判定 → C2 负面（窗口抽阶，值为常量）→ C3 补偿（随机一条正面词缀 +1 阶并重抽值）；负面不受前后缀名额限制，总数 ≤6；无负面候选且符文族关闭时不腐化、不回退 C1 |
| D-09 | 金币在全部物品之后抽取；class=none、encounterSubject 不掉金币；leader/champion 不影响金币 |
| D-10 | elite 掉落表件数写 [1,3]，由 maxPerKill 截断 |
| D-11 | fallback `replace` = 把来源权重按共同适用的 itemClass 并入目标；adept 变体权重 `max(1, floor(600/n))` |
| D-12 | 符文词缀权重 = 子权重 × 5；v1 `runeFamilyEnabled:false`，正负符文都不进入候选 |
| D-13 | slaying/immunity 的目标怪物类抽取留给 6B3 |
| D-14 | 唯一戒指“本体附魔 +N”= 覆盖 ringImplicit |
| D-15 | `bossUniqueBias` 首条：abyssal-colossus → colossus-maul ×5 |
| D-16 | 负面词缀插值四舍五入远离零（§5.5 表为准） |
| D-17 | 物等的怪物分级加值只来自 ilvl.json，掉落表 ilvlBonus v1 全 0 |
| D-18 | 稀有度权重计算顺序与逐步向下取整（§7.4） |
| D-19 | 分解结果下限 1 |
| D-20 | 统计工具事件模型（§10.2）与强度代理公式（§10.3）；偏差只标记不改数据 |
| D-21 | 立绘 48×64 网格、1× 存储、最近邻放大、透明背景、24 色共享调色板、洋红键控、固定裁切 |
| D-22 | 调色板可在质量不足时一次升至 32 色并报告 |

### 16.2 未写明细节的裁决规则（按顺序适用）

1. 任务书与数值表/设计稿冲突 → 以任务书为准；任务书未覆盖而数值表有 → 以数值表为准；都没有 → 规则 3–5。
2. 任务书与基线实际代码冲突（例如发现器或 i18n 门禁行为与 §4/§5.16 描述不同）→ 以实际代码为准，选不改共用文件的做法，报告记录。
3. 纯代码组织、命名私有函数、测试拆分 → 自行决定，列入“自行决定事项”。
4. 数值、ID、版本、抽取次序 → 不改；确实无法满足（例如静态抽取上界超预算）时保持数据、在报告提出修订建议，并把受影响测试写为对“建议值”的独立断言而非放宽原断言。
5. 测试发现任务书算例本身算错（例如 V1/V2 某个权重） → 不改数据去迎合；在报告给出正确推导与差异，测试按正确推导实现，并在该测试注释标明“任务书算例更正”。
6. 统计偏差 → 只报告与建议，不改数据（N-12=B）。

---

## 17 dot 最终回复格式（≤30 行中文）

```text
6B1-α 完成情况：第一部分 <完成/部分>；第二部分 <完成/部分/blocked>
分支/提交：ext/phase6-loot-core @ <最终 commit>（起点 <foundation commit>，merge <commit>）
报告：docs/ext/phase6b1a.report.md；合同：docs/ext/loot-core-contract.md；统计：docs/ext/evidence/phase6b1a-loot-stats.json
loot：版本 0.1.0，rules 指纹 <sha256:前12位>；数据 16 文件；词缀 <n>（含符文 <n>）、唯一 8、预设 3、怪物分级 67
生成器：向量 <n> 条（含 V1/V2）；属性测试 <n> 次；静态抽取上界 单件 <n>/单事件 <n>；实测最大 <n>/<n>
统计：300 局 × 3 预设；偏差 >±20% 标记 <n> 项（列最重要 3 项）
立绘：48×64、调色板 <n> 色、三张合计 <n> B；浏览器 <通过/blocked>
门禁：boundary <码> / vue-tsc <码> / build <码> / loot 测试 <passed/failed> / narrative 测试 <…> / 受影响既有测试 <…>
自行决定事项 <n> 条；待集成复核项 <n> 条；未覆盖项：<一句>
```
