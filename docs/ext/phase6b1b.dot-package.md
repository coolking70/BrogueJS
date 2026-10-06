# 6B1-β dot 任务包：`loot` UI 组件（纯展示，不挂载）

> 状态：**派发草稿，未派发**。由 Claude 依据已批准的[阶段 6 设计](phase6-loot.md)（§8.3 鉴定、§10 背包与 UI；L-D02=A、L-D06=A、L-D07=A）、[数值表 v1.1](phase6-loot-numbers.md)（§8 鉴定/腐化/分解，§10.3 命名示例）、[loot 临时合同](loot-core-contract.md) 与 [6B1-α 报告](phase6b1a.report.md) 编写；基线 `ext/phase6-loot-core` @ `ecbec6e`（loot 0.1.1）。维护者完成 §A 后，把 §0 提示块转贴给 dot。
>
> 本包把设计 §13.1 的 **6B2 UI** 拆出一个**不接线的前置子步 6B1-β**：只在 `src/ext/modules/loot/` 内交付纯展示 Vue 组件、纯视图模型（view-model）构建器、已知投影、自有 UI 文案、固定种子真实生成器夹具、SFC/快照测试与一个不进构建的预览页。**任何组件都不挂载**：不建 `ui/descriptor.ts`、不接 `src/ext/ui` 插槽、不访问 `Game`、不产生命令。真正的挂载、DialogHost 抽屉、背包/地面接线、命令与属性管线比较，留给 6A1/5A2-S 落地后的 6B 集成步（本地）。

---

## 0 转贴给 dot 的提示块（维护者复制此块）

```text
你是 BrogueJS 扩展原型（独立新产品原型分支，不合 main）的 6B1-β 执行者。本次一次长块独立开发直到完成全部交付，期间不要向维护者提问。
任务：在 src/ext/modules/loot/ 内实现“刷宝 loot 的纯展示 UI 组件”（稀有色名称筹码、物品详情卡、与已装备比较、分解确认、拾取过滤表单、新局预设选择），以及驱动它们的纯视图模型构建器与“已知投影”。组件不挂载、不接入游戏、不改变任何玩法。

基线与分支：
- git fetch origin
- 若本地无该分支：git switch -c ext/phase6-loot-core --track origin/ext/phase6-loot-core
  若已有：git switch ext/phase6-loot-core && git merge --ff-only origin/ext/phase6-loot-core
- 预期 HEAD = origin/ext/phase6-loot-core 最新提交（ecbec6e 之后、提交信息为 "docs(ext): 6B1-beta dot package (loot UI components)" 的那个提交）；不同则照常开工并在报告记录
- 只推 ext/phase6-loot-core；不推其他分支、不合并其他分支、不打 tag、不开 PR。

唯一任务书：docs/ext/phase6b1b.dot-package.md（与本提示冲突时以任务书为准）。先读 AGENTS.md、docs/ext/README.md，再完整读任务书；docs/ext/phase6-loot.md、docs/ext/phase6-loot-numbers.md、docs/ext/loot-core-contract.md 是已批准的设计/数值/核心合同，任务书对它们的解释与补充决定优先。

硬规则（详见任务书 §13、§14）：
1. 只改任务书 §13.1 白名单内的文件；loot 核心（data/、locales/zh_CN.json、types.ts、generator.ts、schema.ts、catalog.ts、item.ts、economy.ts、rarity.ts、definitions.ts、index.ts、tools/stats.ts 等）一律不改；LOOT_VERSION 保持 0.1.1。
2. 不得创建 src/ext/modules/loot/ui/descriptor.ts；任何 loot 组件不得被 loot 目录以外的文件引用；不访问 Game/引擎运行时/扩展运行时；loot 在游戏中保持惰性。
3. 所有玩家可见文本走 i18n，且必须满足任务书 §7 的 i18n 门禁写法（p1_30 扫描器的真实规则）。
4. 测试夹具只能来自真实 v1.1 生成器 + 固定种子（任务书 §9），只允许 §9.3 列出的合法后续变换；不得手写物品数据。
5. 遇到未写明细节，按任务书 §14.2 自行决定并在报告“自行决定事项”列出，不要停下来问。
6. 只跑任务书 §12 的门禁；不跑完整 npm test、全部 test:ext、组合 smoke 脚本、删除矩阵、ce:fetch、test:full、test:gen、test:drift。

交付：按任务书 §15 写报告 docs/ext/phase6b1b.report.md 与 UI 临时合同 docs/ext/loot-ui-contract.md，按逻辑分提交，门禁通过后单独执行推送 ext/phase6-loot-core；最后按任务书 §16 回复一段 ≤30 行中文摘要。
```

---

## A 派发前维护者检查清单（dot 不读本节）

| # | 事项 | 说明 | 核对 |
| --- | --- | --- | --- |
| A1 | 本文已提交并推到 `origin/ext/phase6-loot-core` | dot 从该分支最新提交开工；本文提交即 §0 所说“预期 HEAD” | ☐ |
| A2 | 分支自 `ecbec6e` 之后无其他提交 | 若有：确认未改 `src/ext/modules/loot/**`、`src/test/i18n_scan.ts`、`src/test/p1_30_i18n_gate.test.ts`、`src/test/support/sfcHarness.ts`、`src/ext/ui/registry.ts`；有改动先修订 §6/§7/§8 | ☐ |
| A3 | 签署 §14.1 预先决定 | 尤其 B-01（UI 文案独立文件 + descriptor 合并一行）、B-04/B-05（稀有名/唯一名鉴定后才显示）、B-12（唯一品可分解但警告，设计 §10.4 写“非唯一”而数值表 §8.3 给了唯一 20 碎片）、B-13（拾取过滤预设默认值）、B-15（非 scoped 样式 + `.loot-` 前缀 + 容器查询）、B-18（项目“不做无障碍”政策下本步只做基础可达性） | ☐ |
| A4 | 步号口径 | 设计 §13.1 的 6B2（UI）被拆为 6B1-β（本步，纯组件不挂载）+ 6B 集成（本地挂载/命令/管线比较）；本步不满足设计 6B2 的“320/390/1440 真实生产构建浏览器验收”，该项留给集成步 | ☐ |
| A5 | 浏览器验收由维护者自做 | dot 环境上次浏览器 blocked。本包要求 dot 交付可在本地打开的预览页（实时页 + 静态 HTML），由维护者在交付后用浏览器检查 320/390/桌面与明暗主题；dot 报告不得声称浏览器通过 | ☐ |
| A6 | 文案原创 | UI 文案由 dot 撰写（约 100–140 条 `ext.loot.ui.*`），维护者在预览页一并审阅措辞 | ☐ |
| A7 | 收尾成本 | descriptor 的 locale 增加 UI 键会进入生产包（文案字符串，几 KB）；组件代码不进入生产包（§12 构建产物检查） | ☐ |

---

## 1 目标、前提与范围

### 1.1 目标

在 `src/ext/modules/loot/` 交付：

1. **已知投影** `projectLootKnowledge`：`LootItemDataV1 + 宿主已知事实 → LootKnownItem`，把玩家不知道的信息（未知词缀的 id/阶/值、未鉴定的唯一/稀有名、未暴露的腐化）**在类型与数据层剥离**。组件与视图模型只接收 `LootKnownItem`，永远不接收 `LootItemDataV1`。
2. **纯视图模型构建器**：`LootKnownItem + 有效目录 (+ 选项) → 组件 props`（显示行、i18n 键 + 参数、预格式化数值、色彩 token），不读 Game、不读全局、不抽随机。
3. **六个展示组件**（+ 内部子组件）：稀有色名称筹码、物品详情卡、与已装备比较面板、分解确认面板、拾取过滤设置表单、新局预设选择器。全部 i18n、明暗两套主题、320/390/桌面三档布局、触控目标 ≥44px、键盘可操作、对 combat/growth 缺席有回退。
4. **固定种子真实夹具**：用 v1.1 真实生成器 `rollLoot` + `mulberry32` 种子搜索得到全部演示物品，记录种子表，测试复核。
5. **测试**：已知投影、视图模型、每个组件每个状态的 SFC 渲染与快照、i18n 闭合、样式/触控尺寸/对比度、键盘、无泄露、惰性与不挂载。
6. **预览页**（不进构建）：Vite 开发服务器实时页 + 一键生成的自包含静态 HTML，渲染全部组件的全部状态，供维护者在浏览器检查。
7. **UI 临时合同文档**与**报告**。

### 1.2 已批准前提（不再讨论）

- 设计 L-D01–L-D13 已批准（L-D02=A：稀有度可见、词缀数拾取后可见、内容待鉴定/熟悉/首次触发揭示；L-D06=A：26 格 + 拾取过滤 + 分解为 `loot.shard`；L-D07=A：新局菜单选预设）。
- 数值表 v1.1 已批准；本步只读其数据，不改任何数值。
- 6B1-α 的全部核心文件与合同（[loot-core-contract.md](loot-core-contract.md)）是本步的**只读输入**。

### 1.3 非目标（出现即越界）

- 任何挂载：`ui/descriptor.ts`、`useSession`、HUD/bar/panel 插槽、creationStep、DialogService/DialogHost、`registerKeyHandler`、背包 `InventoryOverlay`/`DetailPanel` 改动、地图着色。
- 任何命令构建（`set-filter`、`salvage`、预设初始命令）、模块 state、Game/引擎/扩展运行时访问。
- 真实属性管线求值（比较面板用本包 §5.6 的**临时**已知差值公式，[5A2-S] 后替换）。
- 修改 loot 核心、数据、核心 locale、版本；修改共享文件、其他模块、脚本、配置。
- 套装/插槽/符文之语 UI（6C）、角色面板来源分解（需 5A2-S）、强化/精炼操作 UI（6B3）。

---

## 2 基线与环境

| 项目 | 值 |
| --- | --- |
| 基线 | `origin/ext/phase6-loot-core` 最新提交（`ecbec6e` + 本任务书提交）；loot 0.1.1、foundation 5 |
| 工作分支 | `ext/phase6-loot-core`（只推它；若常规 `git push` 无凭据，可沿用 6B1-α 的对象 API 发布方式，逐提交 tree 与本地一致并在报告列出） |
| 运行环境 | Node 24.x；`NODE_OPTIONS=--max-old-space-size=3072`；vitest `--maxWorkers=2`；不新增 npm 依赖（已有 `vue`、`i18next`、`i18next-vue`、`@vue/compiler-sfc`、`vue/server-renderer`、`@vitejs/plugin-vue`、`vite`） |

开工第一件事：`git log -1`、`git status`（须干净）、`node scripts/test-discovery.mjs > /dev/null && echo ok`、`npx vitest run src/ext/modules/loot/tests --maxWorkers=2`（基线 loot 测试应 10 文件 335 passed），结果写入报告 §2。

---

## 3 目录布局（新增/修改的全部文件）

```text
src/ext/modules/loot/
  descriptor.ts              修改一处：locales.zh_CN 合并 UI 文案（§7.1）
  locales/ui.zh_CN.json      新增：全部 ext.loot.ui.* 文案（§7）
  ui/
    types.ts                 UI 合同类型（§4、§5 逐字采用，可加 readonly/JSDoc）
    errors.ts                LootUiError（code + path）
    knowledge.ts             projectLootKnowledge / knownModifierDrafts（§4）
    tables.ts                字面量表：属性标签/方向/格式、原生基底名键、符文名键、类别字形（§5.2、§7.3）
    format.ts                纯数值格式化（§5.3）
    viewModel.ts             build* 构建器（§5）
    LootItemChip.vue         名称筹码（§6.1）
    LootItemCard.vue         详情卡（§6.2）
    LootAffixRow.vue         详情卡/比较内部用词缀行（内部子组件）
    LootComparePanel.vue     比较面板（§6.3）
    LootSalvagePanel.vue     分解确认（§6.4）
    LootPickupFilterForm.vue 拾取过滤表单（§6.5）
    LootPresetPicker.vue     预设选择（§6.6）
  tools/
    preview/index.html       Vite 开发页入口（§10.1）
    preview/main.ts          开发页挂载脚本
    preview/LootUiGallery.vue 全状态画廊（开发页与静态页共用）
    preview/fixtures.ts      固定种子夹具（§9）
    preview/states.ts        画廊/测试共用的状态清单（§8）
    preview/render.ts        SSR 渲染静态 HTML 的纯函数（§10.2）
    loot-ui-preview.mjs      CLI：生成静态 HTML（§10.2）
  tests/
    loot_ui_knowledge.test.ts / loot_ui_viewmodel.test.ts / loot_ui_fixtures.test.ts /
    loot_ui_components.test.ts / loot_ui_i18n.test.ts / loot_ui_style.test.ts /
    loot_ui_preview.test.ts / loot_ui_inert.test.ts
    __snapshots__/loot_ui_*.snap
  test-suites.json           只追加上述 8 个测试文件
docs/ext/loot-ui-contract.md 新增（§15.2）
docs/ext/phase6b1b.report.md 新增（§15.1）
```

**禁止**：`ui/descriptor.ts`（`src/ext/ui/registry.ts` 以 `import.meta.glob('../modules/*/ui/descriptor.ts')` 自动发现并挂载）；`ui/` 下任何 `use*Ui`/`useSession`；在 `ui/` 内 `import` Game、`src/engine/Core/**`、`src/ext/runtime*`、`src/ext/ui/**`、`src/ui/**`。允许只读引用：loot 核心模块（`../types`、`../catalog`、`../item`、`../economy`、`../rarity`、`../definitions`）、`src/data/{weapons,armors,arcana}.json`（原生基底名/伤害/护甲/力量需求）、`vue`、`i18next-vue`。

---

## 4 已知投影（`ui/knowledge.ts`）

### 4.1 类型（`ui/types.ts` 逐字采用）

```ts
import type { ItemClass, RarityId } from '../types';

export type LootUiLocation = 'floor' | 'pack' | 'equipped';
/** 宿主（6B 集成）从原生 Item 与 ItemLoader 读出的已知事实。[C6-1] */
export interface LootKnowledgeFacts {
  readonly v: 1;
  readonly location: LootUiLocation;          // floor = 地面/未拾取
  readonly ringKindKnown: boolean;            // 戒指种类是否已识别；武器/护甲忽略
  readonly magicPolarity: 'unknown' | 'benign' | 'malevolent';   // 原生 detect magic 结果
  readonly curseRevealed: boolean;            // 原生已向玩家暴露诅咒（如脱不下）
  readonly hallucinating: boolean;            // 仅 location='floor' 时生效
  readonly familiarity: { readonly unit: 'kills' | 'turns'; readonly remaining: number } | null;  // 熟悉度剩余 [6B-int]
}
export type LootAffixPosition = 'prefix' | 'suffix' | 'row';     // row = 唯一品固定行
export type LootKnownAffix =
  | { readonly known: true; readonly id: string; readonly position: LootAffixPosition;
      readonly polarity: 1 | -1; readonly tier: number; readonly values: readonly number[] }
  | { readonly known: false; readonly position: LootAffixPosition };
export interface LootKnownItem {
  readonly v: 1;
  readonly location: LootUiLocation;
  readonly itemClass: ItemClass;
  readonly baseId: string | null;             // null ⇔ 戒指种类未知
  readonly rarity: RarityId | null;           // null ⇔ 地面幻觉
  readonly ilvl: number | null;               // null ⇔ 地面
  readonly enhancement: number;               // 玩家亲手强化，恒已知
  readonly affixCount: number | null;         // null ⇔ 地面
  readonly affixes: readonly LootKnownAffix[];  // 地面为 []；否则与 data.affixes 同序同长
  readonly uniqueId: string | null;           // 仅“唯一且已鉴定”非空
  readonly rareName: readonly [number, number] | null;  // 仅“稀有且已鉴定”非空
  readonly corrupted: boolean | null;         // null = 玩家未知
  readonly identified: boolean;               // data.affixes 全部 known（normal 恒 true）
  readonly polarity: 'unknown' | 'benign' | 'malevolent';
  readonly familiarity: LootKnowledgeFacts['familiarity'];
}
export function projectLootKnowledge(data: LootItemDataV1, catalog: EffectiveLootCatalog,
  facts: LootKnowledgeFacts): LootKnownItem;
export function knownModifierDrafts(item: LootKnownItem, catalog: EffectiveLootCatalog): LootModifierDraft[];
```

### 4.2 投影规则（逐条实现并逐条测试）

1. 先 `validateLootItemData(data, catalog)`，失败抛 `LootUiError('INVALID_ITEM', path)`。`facts` 严格校验（未知字段、类型、`remaining` 非负安全整数），失败抛 `INVALID_INPUT`。
2. **事实一致性**（不一致抛 `INCONSISTENT_FACTS`，防止画出不可能状态）：`curseRevealed=true` 要求 `data.corrupted`；`magicPolarity='malevolent'` 要求 `data.corrupted`；`'benign'` 要求 `!data.corrupted`；`familiarity≠null` 要求 `location≠'floor'` 且物品未全鉴定。
3. `itemClass` 由 `lootItemClass(baseId, catalog)`；`baseId`：武器/护甲恒给出；戒指 `ringKindKnown ? baseId : null`。
4. **地面**（`location='floor'`）：`ilvl=null`、`affixCount=null`、`affixes=[]`、`uniqueId=null`、`rareName=null`；`rarity = hallucinating ? null : data.rarity`；`corrupted`、`polarity` 按第 7、8 条。
5. **持有**（pack/equipped）：`hallucinating` 忽略；`rarity=data.rarity`、`ilvl=data.ilvl`、`affixCount=data.affixes.length`；`affixes[i]` 对应 `data.affixes[i]`：
   - `known=true` → 全量（`id/tier/values` 原样，`position` 由目录词缀定义的 `position` 或唯一行取 `'row'`，`polarity` 取定义值，唯一行取 `1`）。
   - `known=false` → 只留 `position`（负面词缀也只暴露 position，不暴露 polarity）。
6. `identified = data.affixes.every(a => a.known)`；`uniqueId = (rarity='unique' && identified) ? data.uniqueId : null`；`rareName = (rarity='rare' && identified) ? data.nameParts : null`。
7. `corrupted`：若 `data.corrupted` → `identified || curseRevealed || 负面词缀已知 ? true : null`；否则 → `identified ? false : null`。
8. `polarity = facts.magicPolarity`；但 `corrupted===true` 时强制 `'malevolent'`，`identified && !corrupted` 时强制 `'benign'`。
9. 结果深冻结；输入不被修改（测试深冻结输入）。不调用任何随机，不读全局。
10. `knownModifierDrafts`：只用 `LootKnownItem` 与目录重建修正草稿，规则与 `projectItemModifiers` 相同但**只输出已知行**（未知词缀行省略；强化行、戒指本体行恒输出；戒指本体行在“唯一戒指且存在未知固定行”时省略，因为可能被 override）。地面物品返回 `[]`。**一致性神谕测试**：对每个夹具的“全鉴定”版本，`knownModifierDrafts(project(data))` 与 `projectItemModifiers(data).filter(d => d.known)` 深相等（按 sourceId/stat 稳定排序后）。

---

## 5 视图模型（`ui/viewModel.ts`、`ui/format.ts`、`ui/tables.ts`）

### 5.1 视图类型（`ui/types.ts` 逐字采用）

```ts
/** 一切文本引用都用字段名 nameKey —— 见 §7.2 i18n 门禁原因。params 已预格式化。 */
export interface LootTextRef { readonly nameKey: string; readonly params: Readonly<Record<string, string | number>> }
export interface LootRarityStyle {
  readonly id: RarityId | null;               // null = 未知（幻觉）
  readonly colorDark: string; readonly colorLight: string;   // 来自 rarities.json；未知用中性 token（§6.0）
  readonly marker: string;                    // rarities.json marker；未知为 '?'
  readonly label: LootTextRef | null;
}
export interface LootNameView {
  readonly nameKey: string;                   // 名称模板键（§7.4）
  readonly parts: Readonly<Record<'base' | 'prefix' | 'suffix' | 'first' | 'second' | 'unique', LootTextRef | null>>;
  readonly enhancement: number;               // >0 时组件追加 ext.loot.ui.name.enhancement
}
export interface LootChipView {
  readonly glyph: ')' | ']' | '=';            // 与原生 ItemLoader 字形一致
  readonly rarity: LootRarityStyle;
  readonly name: LootNameView;
  readonly corrupted: boolean | null;         // true 才显示腐化标记
  readonly unknownCount: number;              // 未知词缀/固定行数
  readonly countHidden: boolean;              // 地面：词缀数未知
}
export interface LootModLineView {
  readonly value: string;                     // 预格式化：'+52%'、'+2–4'、'=3'、'-1'
  readonly stat: LootTextRef;                 // 属性标签
  readonly condition: LootTextRef | null;     // body.large 条件
  readonly runic: LootTextRef | null;         // 符文名（runicType）
  readonly tone: 'good' | 'bad' | 'neutral';
}
export interface LootAffixRowView {
  readonly key: string;                       // 稳定：`${index}:${id ?? 'unknown'}`
  readonly known: boolean;
  readonly position: LootAffixPosition;
  readonly name: LootTextRef | null;          // 已知词缀名；唯一行 null；未知行为“未知前缀/后缀/词条”
  readonly tier: number | null;               // 已知且非唯一行
  readonly lines: readonly LootModLineView[];
  readonly negative: boolean;                 // 已知负面词缀
}
export interface LootBaseStatView {
  readonly key: 'damage' | 'armor' | 'strength' | 'implicit' | 'enhancement';
  readonly label: LootTextRef; readonly value: string;
  readonly partial: boolean;                  // 存在可能影响此值的未知行 → 组件加 '?' 标记
}
export interface LootItemView {
  readonly chip: LootChipView;
  readonly subtitle: readonly LootTextRef[];  // 稀有度、物等、类别
  readonly baseStats: readonly LootBaseStatView[];
  readonly rows: readonly LootAffixRowView[]; // 排序：前缀 → 后缀 → 固定行，组内保持数据顺序
  readonly notices: readonly LootTextRef[];   // 顺序固定，见 §5.4
  readonly flavor: LootTextRef | null;        // 已鉴定唯一品描述
}
export interface LootCompareRowView {
  readonly key: string; readonly label: LootTextRef;
  readonly before: string; readonly after: string; readonly delta: string;
  readonly tone: 'better' | 'worse' | 'same';
}
export interface LootCompareColumnView {
  readonly slot: LootTextRef;                 // 武器/护甲/左戒/右戒
  readonly equipped: LootChipView | null;     // null = 空槽
  readonly rows: readonly LootCompareRowView[];
}
export interface LootCompareView {
  readonly candidate: LootChipView;
  readonly available: boolean;                // 地面候选 → false（需拾取后比较）
  readonly columns: readonly LootCompareColumnView[];   // 武/甲 1 列，戒指 2 列
  readonly notices: readonly LootTextRef[];   // 未知未计入、力量不足、临时公式说明
}
export interface LootSalvageEntryView {
  readonly key: string; readonly chip: LootChipView;
  readonly shards: { readonly min: number; readonly max: number };
  readonly blocked: LootTextRef | null;       // 不可分解原因
  readonly warnings: readonly LootTextRef[];
}
export interface LootSalvageView {
  readonly entries: readonly LootSalvageEntryView[];
  readonly total: { readonly min: number; readonly max: number };   // 只计未阻断项
  readonly exchange: LootTextRef;             // “每 10 碎片可兑换鉴定一件”
  readonly confirmable: boolean;              // 至少一项未阻断
}
export interface LootPickupFilterDraft {      // 设计 §10.3 set-filter 载荷的 UI 草稿 [6B-int]
  readonly v: 1;
  readonly minRarity: 'normal' | 'magic' | 'rare' | 'unique';
  readonly classes: readonly ItemClass[];     // 去重，按 weapon, armor, ring 顺序；可为空
  readonly autoPickupGold: boolean;
}
export interface LootPresetMetricView { readonly key: string; readonly label: LootTextRef; readonly value: string }
export interface LootPresetOptionView {
  readonly id: string; readonly name: LootTextRef; readonly description: LootTextRef;
  readonly metrics: readonly LootPresetMetricView[];
}
export interface LootUiOptions {
  readonly presetId: string;
  readonly attributeLabels?: Readonly<Record<string, string>>;   // growth 属性显示名，宿主提供 [5A2-S]
  readonly showTiers?: boolean;               // 默认 true
}
```

### 5.2 构建器签名

```ts
export function buildLootChipView(item: LootKnownItem, catalog: EffectiveLootCatalog): LootChipView;
export function buildLootItemView(item: LootKnownItem, catalog: EffectiveLootCatalog, options: LootUiOptions): LootItemView;
export function buildLootCompareView(candidate: LootKnownItem, equipped: readonly (LootKnownItem | null)[],
  catalog: EffectiveLootCatalog, options: LootUiOptions & { readonly playerStrength: number | null }): LootCompareView;
export function buildLootSalvageView(entries: readonly { readonly key: string; readonly item: LootKnownItem }[],
  catalog: EffectiveLootCatalog, presetId: string): LootSalvageView;
export function defaultLootPickupFilter(presetId: string): LootPickupFilterDraft;
export function normalizeLootPickupFilter(value: unknown): LootPickupFilterDraft;   // 严格校验 + 规范化顺序
export function buildLootPresetOptions(pack: LootPack): readonly LootPresetOptionView[];
```

全部纯函数：结果深冻结、输入不变、无随机、无 `Date`/全局。构建器**只接受 `LootKnownItem`**（类型层面不接受 `LootItemDataV1`）。非法输入抛 `LootUiError`：`INVALID_INPUT`、`UNKNOWN_PRESET`、`UNKNOWN_AFFIX`、`UNKNOWN_BASE`、`CLASS_MISMATCH`（比较时槽位类别不符）。

`tables.ts` 必须是**字面量表**（i18n 门禁要求，§7.2），至少包括：

- `LOOT_UI_STATS`：覆盖 loot 数据中出现的**全部** `(stat, unit)` 组合（含符文族、唯一行、强化行 `native.defense`/int 与 `native.max-hp`/int、本体行 `loot.ring-implicit`），每项 `{ stat, unit, nameKey: 'ext.loot.ui.stat.…', better: 'higher' | 'lower' }`。`better='lower'` 仅 `native.attack-speed`、`native.physical-damage-taken`；其余 `higher`。`growth.attribute:{attribute}` 用一项 `nameKey: 'ext.loot.ui.stat.growth-attribute'`（参数 `name`）。测试断言覆盖度（数据中每个组合恰有一项，无多余项）。
- `LOOT_UI_BASE_NAMES`：bases.json 全部 26 个 baseId → `{ baseId, nameKey: 'name.<原生 name 字段>' }`（如 `dagger → 'name.Dagger'`、`ring_of_light → 'name.Ring of Light'`）；测试对照 `src/data/*.json` 的 `name` 字段与主 locale 存在性。
- `LOOT_UI_RUNICS`：loot 数据中出现的全部 runicType → `{ runicType, nameKey: 'runic.name.<type>' }`（主 locale 已有）。
- `LOOT_UI_CLASS_GLYPHS`：`weapon ')'`、`armor ']'`、`ring '='`（与 `ItemLoader` 的 `new Item(…, ')'|']'|'=' …)` 一致）。

### 5.3 数值格式（`format.ts`，确定、与语言无关）

| 输入 | 规则 | 例 |
| --- | --- | --- |
| `unit='bp'`（任意 category） | 百分比：`v/100`，最多 2 位小数并去尾零；正数加 `+`，负数用 ASCII `-` | 5200→`+52%`；1250→`+12.5%`；-600→`-6%` |
| `int`、`ring-point`、`display-armor`（flat/local-flat） | 有符号整数 | `+3`、`-10` |
| `native.defense` + `unit='int'`（强化行，内部单位） | `v/10`，1 位小数去尾零，有符号 | 25→`+2.5` |
| 同一词缀/行内两条 `local-flat` 同 stat（brutal、巨像之锤 r0） | 合并为一行区间 `+a–b`（en dash U+2013） | `+2–4` |
| `category='override'` | `=N` | `=3` |
| `unit='runic-strength'` | 无符号整数，stat 标签为“符文强度”，`runic` 填符文名 | `4` |

`tone`：负面词缀（polarity −1）恒 `bad`；否则按 `better` 与数值符号：有利 `good`、不利 `bad`、0 `neutral`（如苦修者之环 `native.max-hp -10` 为 `bad`）。条件 `body.large` → `condition: { nameKey: 'ext.loot.ui.condition.body-large' }`。adept 变体 stat `growth.attribute:<id>` → `stat: { nameKey: 'ext.loot.ui.stat.growth-attribute', params: { name: attributeLabels?.[id] ?? id } }`（缺省直接显示属性 ID，属 growth 缺 UI 名时的回退）。

### 5.4 详情卡构建规则（`buildLootItemView`）

- **名称**（§7.4 模板）：normal → `base`；magic 已知部分 → `prefix?+suffix?+base`（未知部分为空）；rare 已鉴定 → `first+second base`（例“血鸦之噬 战斧”）；rare 未鉴定 → “未鉴定的稀有{base}”；unique 已鉴定 → 唯一名；unique 未鉴定 → “未鉴定的唯一{base}”；地面幻觉 → `base` 用类别通称（“武器/护甲/戒指”）；戒指种类未知 → “未知戒指”。`enhancement>0` → 追加 “ +N”。
- **subtitle**：`rarity.label`（未知不出）、`ilvl`（“物等 N”，地面不出）、类别。
- **baseStats**（全部用 §5.6 同一套临时公式，[5A2-S]）：武器 `damage`（原生 `XdY+Z` → min=X+Z、max=X·Y+Z，叠加**已知**本地% / 本地 flat / 强化本地%；`partial` = 存在未知词缀）+ `strength`（原生 strengthRequired）；护甲 `armor`（原生 armor 显示值 × (1+已知本地护甲%) + 已知 plated + 强化 0.5/级，1 位小数，封顶 22；`partial` 同理）+ `strength`；戒指 `implicit`（ringImplicit(ilvl) 或已知唯一 override；唯一戒指有未知行时值为 `?`）。`enhancement>0` 时追加 `enhancement`（“强化 N/上限”，上限 `enhancementCap`）。地面只给 `strength`（武/甲）与基底名，不给数值行。
- **rows**：按 §4 `affixes` 产出；未知行 `name` = `ext.loot.ui.unknown.prefix|suffix|row`。
- **notices**（顺序固定，满足条件才出）：①地面 `ext.loot.ui.notice.floor-count-hidden`；②持有且有未知行 `ext.loot.ui.notice.unknown-active`（“未知词缀仍然生效”）；③`polarity='malevolent'` 且 `corrupted!==true` `…notice.malevolent`；④`polarity='benign'` 且未全鉴定 `…notice.benign`；⑤`corrupted===true` `…notice.corrupted`（“腐化：已诅咒，无法卸下”）；⑥`familiarity` → `…notice.familiarity-kills|turns`（参数 `remaining`）。
- **flavor**：已鉴定唯一品 → 其 `descriptionKey` 作为 `nameKey`（字段名仍是 nameKey，见 §7.2）。

### 5.5 比较规则（`buildLootCompareView`）

- 候选地面 → `available=false`、`columns=[]`、notice `ext.loot.ui.compare.pickup-first`。
- 列：武器/护甲 1 列（`equipped[0]`，可为 null=空槽）；戒指 2 列（左戒 `equipped[0]`、右戒 `equipped[1]`，各可 null）。槽位类别与候选不符抛 `CLASS_MISMATCH`。
- 行（每列独立）：先 `baseStats` 中的数值行（伤害区间、护甲、戒指本体、力量需求），再把双方 `knownModifierDrafts` 按 `(stat, category, unit, condition, runicType)` 聚合求和后的修正行，按 `LOOT_UI_STATS` 表序排列。`before`/`after` 为格式化值（缺失视为 0），`delta = after − before` 有符号格式化；`tone` 由 `better` 方向决定，0 为 `same`。伤害区间的 delta 用 “`+Δmin–+Δmax`”，tone 按平均值。
- notices：候选或任一已装备有未知行 → `…compare.unknown-excluded`（参数 `count` = 双方未知行总数）；`playerStrength≠null && < 候选力量需求` → `…compare.strength-short`（参数 `short`）；恒追加 `…compare.provisional`（“估算值，仅含已知效果”）[5A2-S]。

### 5.6 临时公式（与 6B1-α 统计工具的强度代理同口径，[5A2-S] 替换为管线 `hypothetical(knownOnly)`）

- 武器伤害：`min' = floor((min + flatMin) × max(0, 10000 + localBp + 1000·e) / 10000)`，max 同理；`localBp` = 已知 `loot.local.damage` local-increased 之和，`flatMin/flatMax` = 已知 local-flat 两值之和，`e` = enhancement（`localDamageBpPerLevel` 读 enhancement.json，勿硬编码）。
- 护甲显示：`min(22, base × (10000 + localArmorBp) / 10000 + plated + e × defenseInternalPerLevel / 10)`，1 位小数向下取整。
- 不计力量惩罚、攻速、命中、管线上限；`partial` 标记与 `provisional` notice 必须出现。

### 5.7 分解规则（`buildLootSalvageView`）

- 每项碎片：与 `salvageYield` 同公式（base × (1+floor(ilvl/ilvlStep)) × salvageMultiplierBp/10000，腐化 ×corruptedMultiplierBp/10000，下限 minimum）。`corrupted===null` 且稀有度属 `corruption.eligibleRarities` → `min`=未腐化值、`max`=腐化值；否则 `min=max`。**一致性神谕测试**：对全鉴定夹具与 `salvageYield(data, preset)` 相等。
- 阻断（`blocked` 非 null，不计入 total）：地面 `ext.loot.ui.salvage.blocked-floor`；`location='equipped'` `…blocked-equipped`。
- 警告：唯一品 `…salvage.warn-unique`（“分解后本局不会再掉落同一件”）；`corrupted===null` 且有区间 `…salvage.warn-range`。
- `exchange` 参数来自 salvage.json `exchange.shards`；`confirmable = 至少一项未阻断`。

### 5.8 拾取过滤与预设

- `defaultLootPickupFilter`：`scarce → {minRarity:'normal'}`、`standard → 'magic'`、`bountiful → 'magic'`；三者 `classes:['weapon','armor','ring']`、`autoPickupGold:true`。常量放 `tables.ts`，[6B-int] 复核（数值表 §10 建议“标准默认魔法及以上”）。未知预设抛 `UNKNOWN_PRESET`。
- `buildLootPresetOptions`：按 presets.json 顺序；`metrics` 全部由数据计算，不手写数字：`kill-drop`（killDropMultiplierBp → “×1.0”）、`max-per-kill`、`rarity-ilvl1` 与 `rarity-ilvl30`（`computeRarityWeights(preset, ilvl, 0, 10000, 0, 'normal')` 的 魔/稀/唯 百分比，1 位小数，参数 `magic/rare/unique`）、`corrupt`（corruptChanceBp → %）、`gold`（goldMultiplierBp → ×）、`monster-peak`（monsterScaling 中 hpBp/damageBp 最大值 → `+%`）。

---

## 6 组件合同（props / emits，[6B-int] 挂载时复核）

### 6.0 共同要求

- `<script setup lang="ts">`，文本一律 `const { t } = useTranslation()`（`i18next-vue`），写法遵守 §7.2。单根元素；不 Teleport；不注册 `window`/`document` 监听；不读 `localStorage`；不调用 `Math.random`/`Date`。
- **样式**：`<style>`（**不加 scoped**），每条选择器以 `.loot-` 开头（`@container`/`@media` 内同样），禁止元素选择器开头、`:global`、`!important`、`@import`、`url()`（§11 样式测试强制）。理由：静态预览需要把 SFC 样式原样拼接（B-15）。
- **主题 token**（在各组件根类上声明，回退到游戏外壳变量）：`--loot-bg: var(--th-panel, #0d0d0c)`、`--loot-raised: var(--th-raised, #181815)`、`--loot-fg: var(--th-fg, #e4dfd1)`、`--loot-dim: var(--th-dim, #9e998d)`、`--loot-line: var(--th-line, #34322c)`、`--loot-good: var(--th-ok, #8fbf6a)`、`--loot-bad: var(--th-hp, #d9503f)`、`--loot-focus: var(--th-accent, #e4dfd1)`；字体 `var(--th-font, monospace)`、圆角 `var(--th-r, 0)`。**浅色主题**仅当祖先或自身带 `[data-loot-theme="light"]` 时生效：`--loot-bg:#f4f1e8; --loot-raised:#ebe6d8; --loot-fg:#1f1d18; --loot-dim:#5d584c; --loot-line:#b9b2a0; --loot-good:#2f6b1f; --loot-bad:#a3271b; --loot-focus:#1f1d18`。不使用 `prefers-color-scheme`（游戏外壳固定深色）。
- **稀有色**：组件在稀有元素上内联设置 `--loot-rarity-dark`/`--loot-rarity-light`（来自 `LootRarityStyle`），CSS 默认 `color: var(--loot-rarity-dark)`，浅色主题下 `var(--loot-rarity-light)`；稀有度未知用 `var(--loot-dim)`。名称字重 600。
- **布局**：组件根 `container-type: inline-size`，用 `@container` 断点（<360、360–639、≥640）而不是视口媒体查询；<360 单列，比较面板戒指两列在 <640 改为上下堆叠；任何宽度下无横向滚动（`min-width:0`、`overflow-wrap:anywhere`）。
- **触控与键盘**：所有可交互元素（按钮、选项、筹码、复选）`min-height:44px; min-width:44px`；可见 `:focus-visible` 轮廓 `2px solid var(--loot-focus)`；`Escape` 在面板/表单根 `@keydown` 上触发 `cancel`/`close`；单选组（预设、最低稀有度）用 roving tabindex + 方向键（←↑ 上一项，→↓ 下一项，Home/End），`Enter`/`Space` 激活。
- **基础可达性**：面板根 `role="dialog"` + `aria-labelledby`（不设 aria-modal、不做焦点陷阱——由集成步的 DialogHost 负责 [6B-int]）；单选组 `role="radiogroup"`/`role="radio"` + `aria-checked`；比较差值用文字符号（+/-）而不只靠颜色；稀有度同时有 marker 与文字。

### 6.1 `LootItemChip.vue`

| props | 类型 | 默认 |
| --- | --- | --- |
| `view` | `LootChipView` | 必填 |
| `interactive` | `boolean` | `false`（true 时根为 `<button type="button">`，否则 `<span>`） |
| `selected` | `boolean` | `false`（`aria-pressed`） |
| `compact` | `boolean` | `false`（只显示字形+marker+名称，用于列表） |

emits：`activate: []`（仅 interactive，点击/Enter/Space）。内容：字形（稀有色）、marker、名称（模板翻译 §7.4）、强化后缀、`corrupted===true` 时 `†` 标记 + `aria-label` 文本、`unknownCount>0` 时 `?×N` 徽标、`countHidden` 时 `?` 徽标。

### 6.2 `LootItemCard.vue`

props：`view: LootItemView`；`maxRows?: number = 8`（超出时折叠为“更多（N）”切换按钮，本地状态）；`actions?: readonly ('compare' | 'salvage' | 'close')[] = []`。emits：`action: [id: 'compare' | 'salvage' | 'close']`（`Escape` 触发 `action('close')`，仅当 actions 含 close）。结构：标题区（筹码）→ subtitle → baseStats（`partial` 加 `?`）→ rows（`LootAffixRow`：名称、阶“N阶”（`showTiers`）、各行 value+stat+condition+runic，负面行 `--loot-bad`、未知行 `--loot-dim` 斜体）→ notices → flavor → 动作按钮。

### 6.3 `LootComparePanel.vue`

props：`view: LootCompareView`；`maxRows?: number = 6`（每列超出折叠“全部比较”）。emits：`close: []`（关闭按钮与 `Escape`）。`available=false` 只显示候选筹码与提示。戒指两列各有槽名标题与已装备筹码（空槽显示“空”）。表格语义：每列 `<table>`，表头 属性/当前/候选/差值；<360 宽改为每行两行堆叠（CSS），不得横向滚动。

### 6.4 `LootSalvagePanel.vue`

props：`view: LootSalvageView`；`submitting?: boolean = false`。emits：`confirm: [keys: string[]]`（未阻断项 key，按 entries 顺序）、`cancel: []`。显示：每项筹码 + 碎片（区间显示 `a–b`）+ 阻断/警告，合计，兑换说明，确认按钮（`!confirmable || submitting` 时 disabled）与取消。确认按钮文案带件数与合计（参数）。

### 6.5 `LootPickupFilterForm.vue`

props：`value: LootPickupFilterDraft`；`defaults: LootPickupFilterDraft`；`presetName: LootTextRef`；`readOnly?: boolean = false`；`submitting?: boolean = false`。内部持有草稿副本（`value` 变化时重置）。控件：最低稀有度单选组（普通/魔法/稀有/唯一，选项文字用 rarities.json 的稀有度名 + 对应稀有色）、类别三项切换（武器/护甲/戒指）、金币自动拾取开关、“恢复预设默认”按钮。emits：`submit: [draft: LootPickupFilterDraft]`（规范化后；草稿与 `value` 相同时提交按钮 disabled）、`cancel: []`。`readOnly` 时全部控件 disabled 并显示 `ext.loot.ui.filter.read-only`。

### 6.6 `LootPresetPicker.vue`

props：`options: readonly LootPresetOptionView[]`；`modelValue: string`；`disabled?: boolean = false`。emits：`update:modelValue: [id: string]`（方向键/点击改变选择）、`confirm: [id: string]`（Enter 或确认按钮）。每个选项卡片：名称、描述、metrics 列表；`radiogroup` 语义。这是“新局菜单选预设”的展示部分；接成 creationStep 并产生 L-D07 初始命令是 [6B-int]。

---

## 7 i18n：文案文件与门禁写法（必须照做）

### 7.1 文件与 descriptor

- 新文件 `src/ext/modules/loot/locales/ui.zh_CN.json`：只含 `ext.loot.ui.*` 键，中文原创，非空、无 TODO。
- **不得**把 UI 键加入 `locales/zh_CN.json`：核心 `validateLootLocale`（`schema.ts`）要求该文件每个键都被 data 引用，否则 `loadLootPack()` 抛 `LOCALE_UNUSED`，整个模块（含 descriptor 指纹）加载失败。
- `descriptor.ts` 只改 `locales`：`locales: { zh_CN: { ...zhCN, ...uiZhCN } }`（两文件键集合不得相交，测试断言）。locale 不入规则指纹，LOOT_VERSION 与指纹不变（测试断言 `getLootPackIdentity()` 与改动前相同：`sha256:7785d8e6…` 前缀以 6B1-α 报告 §13.1 为准）。

### 7.2 扫描器真实规则（`src/test/i18n_scan.ts`，p1_30 门禁要求“无缺失、无未引用、无 unresolved”）

逐条核对过扫描器源码，loot UI 必须只用以下写法：

1. **Vue/TS 中 `t()`/`$t()` 首参**只允许：(a) 完整字符串字面量 `t('ext.loot.ui.card.more')`，或字面量三元；(b) **属性路径且末段字段名为 `nameKey` 或 `descriptionKey`**：`t(row.name.nameKey, row.name.params)`。扫描器对 (b) 只认“所属模块 data JSON 中出现过的字段名”，loot data 只有 `nameKey`/`descriptionKey`——这正是 `LootTextRef` 字段名统一为 `nameKey` 的原因（`labelKey`/`textKey` 在 Vue 中会被判 unresolved）。
2. 首参**禁止**：可选链（`a?.nameKey`）、下标（`a['nameKey']`）、函数调用结果、局部变量、拼接或模板（`t('ext.loot.ui.stat.' + x)` 会登记为前缀引用，削弱未引用检查；本包要求 loot UI **零前缀引用**）。需要包装时写成参数为 `ref: LootTextRef` 的函数，内部 `t(ref.nameKey, ref.params)`。
3. **TS 中的键字面量**必须出现在名为 `nameKey`/`descriptionKey`/`labelKey`/`textKey`/`titleKey`/`reasonKey`/`altKey`/`unavailableKey` 的属性赋值里（`{ nameKey: 'ext.loot.ui.notice.floor-count-hidden', params: {} }`）才算“被引用”；普通对象键或变量里的字面量不算。模板字符串只允许插值类型为**有限字符串字面量联合**（如 `` `ext.loot.ui.unknown.${position}` ``，`position: LootAffixPosition`），且展开 ≤256 个；`string` 类型插值会被判 unresolved。
4. 原生名称键（`name.*`、`runic.name.*`）同样以 `nameKey:` 字面量写在 `tables.ts`，不得用 `'name.' + …`。
5. 扫描器会扫 `src/ext/modules/loot/` 下除 `tests/`、`*.test.ts` 之外的全部 `.ts/.vue`（含 `tools/preview/**`）；预览代码不得调用 `t()` 于非合规表达式。预览页的开发者说明文字（状态 ID、宽度标签）可用普通字面量，不走 i18n。

### 7.3 键集合（dot 撰写中文，键名按此分组；具体条目以组件需要为准，全部必须被引用）

`ext.loot.ui.name.*`（名称模板：normal/magic/rare/rare-unidentified/unique-unidentified/enhancement/class-weapon/class-armor/class-ring/unknown-ring）、`ext.loot.ui.subtitle.*`（物等、类别）、`ext.loot.ui.stat.*`（§5.2 全部属性标签）、`ext.loot.ui.base.*`（伤害/护甲/力量需求/本体/强化）、`ext.loot.ui.unknown.prefix|suffix|row`、`ext.loot.ui.tier`（“{{tier}}阶”）、`ext.loot.ui.condition.body-large`、`ext.loot.ui.notice.*`、`ext.loot.ui.card.*`（更多/收起/动作）、`ext.loot.ui.compare.*`、`ext.loot.ui.salvage.*`、`ext.loot.ui.filter.*`、`ext.loot.ui.preset.*`（metrics 标签与确认）、`ext.loot.ui.chip.*`（腐化/未知徽标的 aria 文本）、`ext.loot.ui.slot.*`（武器/护甲/左戒/右戒/空）。稀有度名、词缀名、唯一名与描述、稀有名词表、预设名与描述、碎片名**复用核心 locale 已有键**，不得重复定义。

### 7.4 名称模板（中文语序，参数为已翻译片段）

| 键 | 模板（建议，dot 可微调措辞但不改参数名） |
| --- | --- |
| `ext.loot.ui.name.normal` | `{{base}}` |
| `ext.loot.ui.name.magic` | `{{prefix}}{{suffix}}{{base}}` |
| `ext.loot.ui.name.rare` | `{{first}}{{second}} {{base}}` |
| `ext.loot.ui.name.rare-unidentified` | `未鉴定的稀有{{base}}` |
| `ext.loot.ui.name.unique-unidentified` | `未鉴定的唯一{{base}}` |
| `ext.loot.ui.name.unique` | `{{unique}}` |
| `ext.loot.ui.name.enhancement` | ` +{{level}}` |

组件实现：`part(ref) = ref ? t(ref.nameKey, ref.params) : ''`，再 `t(view.name.nameKey, { base: part(parts.base), … })`；i18next 插值对片段转义的行为以实测为准（中文无需转义问题，若出现 `&amp;` 等，改用 `interpolation: { escapeValue: false }` 的**调用级**选项，不改全局配置）。

---

## 8 状态清单（`tools/preview/states.ts`，画廊与测试共用）

每个状态 = `{ id, component, fixture(s) + 变换 + facts + options/props }`，id 稳定（快照名用它）。必须至少包含：

| 组件 | 状态 id 与内容 |
| --- | --- |
| Chip | `chip.normal`（R01 全鉴定）· `chip.magic-unknown`（R04 持有未鉴定）· `chip.rare-identified`（R07 全鉴定）· `chip.rare-unknown`（R07 未鉴定）· `chip.unique-unknown`（R14）· `chip.unique-identified`（R14 全鉴定）· `chip.corrupted`（R10 全鉴定）· `chip.enhanced`（R04 全鉴定 +8）· `chip.floor`（R06 地面）· `chip.hallucinating`（R06 地面+幻觉）· `chip.ring-kind-unknown`（R05 持有、种类未知）· `chip.selected`（R07 interactive+selected） |
| Card | `card.floor`（R06）· `card.magic-unknown`（R04）· `card.rare-partial`（R06 前 2 条已知）· `card.rare-brutal`（R07 全鉴定）· `card.giantsbane`（R08 全鉴定）· `card.unique-unknown`（R12）· `card.unique-maul`（R12 全鉴定：符文行+条件+双值）· `card.unique-ring`（R13 全鉴定：override）· `card.malevolent`（R10 未鉴定，facts malevolent）· `card.corrupted`（R10 全鉴定）· `card.combat-affix`（R15 全鉴定）· `card.growth-labels`（R16 全鉴定，attributeLabels 提供）· `card.growth-fallback`（R16 全鉴定，不提供 attributeLabels）· `card.enhanced-cap`（R04 全鉴定，enhancement=上限）· `card.folded`（R09 全鉴定，maxRows=4，折叠态）· `card.unfolded`（同上展开，测试中点击“更多”后）· `card.ring-unknown-kind`（R05 未鉴定、种类未知）· `card.familiarity`（R04 持有未鉴定，familiarity kills=3）· `card.t6`（R17 全鉴定） |
| Compare | `compare.weapon`（R07 全鉴定 vs E-W）· `compare.partial`（R06 部分已知 vs E-A）· `compare.empty-slot`（R02 vs null）· `compare.rings`（R05 全鉴定 vs [E-R1, E-R2]）· `compare.strength-short`（R07 vs E-W，playerStrength=12）· `compare.folded`（R09 vs E-W，maxRows=6 有折叠）· `compare.floor`（R06 地面） |
| Salvage | `salvage.single`（R04 全鉴定）· `salvage.batch`（R04 全鉴定 + R10 未鉴定(区间) + R03）· `salvage.unique`（R14 全鉴定）· `salvage.blocked`（E-W equipped + R02）· `salvage.corrupted`（R10 全鉴定）· `salvage.bountiful`（R04 全鉴定，presetId bountiful） |
| Filter | `filter.standard`（默认）· `filter.dirty`（minRarity 改 rare 后）· `filter.no-classes`（classes []）· `filter.read-only` · `filter.bountiful` |
| Preset | `preset.standard`（选中 standard）· `preset.disabled` · `preset.keyboard`（从 standard 按 → 后选中 bountiful） |

未在表中出现的组件内部分支（如 submitting）也要至少在测试里覆盖一次。

---

## 9 固定种子真实夹具（`tools/preview/fixtures.ts`）

### 9.1 生成方式

- 随机：`mulberry32(seed)`（从 `../stats` 导入，只读）。生成：`rollLoot(catalog, request, random)`。
- 目录：`none` = `buildEffectiveLootCatalog(loadLootPack(), {combat:null, growth:null, giants:null})`；`full` = `{ combat: { stats: ['combat.stamina-capacity','combat.poise-capacity','combat.stamina-regen','combat.poise-recovery'] }, growth: { stats: ['growth.focus-capacity','growth.attribute','growth.xp-gain'], attributes: ['strength','dexterity','wisdom'] }, giants: { formIds: ['giants.abyssal-colossus'] } }`。
- **搜索**：对每个配方，种子从 1 递增到 20000，取**第一个**使谓词成立的 `(seed, itemIndex)`（itemIndex 为该次结果 `items` 中第一个满足谓词的下标）。把结果写成字面量表 `LOOT_UI_FIXTURE_SEEDS`。测试 `loot_ui_fixtures` 重新搜索并断言与记录一致（证明非手挑），并断言每件 `validateLootItemData` 通过。若某配方 20000 内无解：按 §14.2 规则 4 放宽（只允许改深度/预设/请求来源，不改谓词含义），报告记录。

### 9.2 配方（请求一律 `v:1, rarityFindBp:0, claimedUniqueIds:[]`）

| id | 目录 | 请求 | 谓词 |
| --- | --- | --- | --- |
| R01 | none | floor D1 standard weapon | normal |
| R02 | none | floor D3 standard armor | normal |
| R03 | none | floor D3 standard ring | normal |
| R04 | none | floor D8 standard weapon | magic，恰 1 前缀 + 1 后缀，未腐化 |
| R05 | none | floor D4 standard ring | magic，1 条词缀，未腐化 |
| R06 | none | kill D12 standard `ogre`（非 leader/champion/encounterSubject） | rare 护甲，≥4 条，未腐化 |
| R07 | none | kill D16 standard `ogre` | rare 武器，含 `loot.affix.brutal`，未腐化 |
| R08 | none | kill D16 standard `ogre` | rare 武器，含 `loot.affix.giantsbane` |
| R09 | none | vault D30 bountiful weapon baseId:null highValue:true | rare，6 条词缀 |
| R10 | none | kill D16 scarce `ogre` | rare，corrupted |
| R11 | none | floor D10 scarce weapon | magic，corrupted |
| R12 | full | encounter D20 standard formId `giants.abyssal-colossus` | uniqueId `loot.unique.colossus-maul` |
| R13 | none | encounter D14 standard formId null | 唯一戒指（penitent 或 gambler） |
| R14 | none | encounter D6 standard formId null | uniqueId `loot.unique.whisper` |
| R15 | full | kill D16 standard `ogre` | 护甲，含 enduring/steadfast/stalwart 之一 |
| R16 | full | kill D16 standard `ogre` | 含 `loot.affix.adept.*` 变体 |
| R17 | none | vault D40 bountiful armor highValue:true | rare，含至少一条 tier=6 |
| E-W | none | kill D12 standard `ogre` | magic 武器（比较用已装备） |
| E-A | none | floor D12 standard armor | magic 护甲 |
| E-R1 | none | floor D12 standard ring | rare 戒指 |
| E-R2 | none | floor D12 standard ring | magic 戒指 |

R11 只作夹具覆盖（腐化魔法），不强制进画廊。

### 9.3 唯一允许的后续变换（模拟未来合法命令/揭示，其余一律不许改）

1. `reveal`：`'none'`（生成态，全 false）、`'all'`（全 true）、或下标集合（部分已知，模拟首次触发揭示）。
2. `enhancement`：`0…enhancementCap(rarity)` 的整数（模拟强化卷轴）。
3. 每次变换后必须 `validateLootItemData` 通过；变换函数在 `fixtures.ts` 中，测试覆盖其拒绝越界。
4. `LootKnowledgeFacts` 由状态表给出，必须通过 §4.2 的一致性检查（例如 `malevolent` 只能配腐化物品）。

---

## 10 预览页（不进构建）

### 10.1 实时开发页

- `tools/preview/index.html` + `main.ts`：`createApp(LootUiGallery)`，用 `i18next.createInstance()` 以“主 `src/locales/zh_CN.json` + loot `zh_CN.json` + `ui.zh_CN.json`”初始化，`app.use(I18NextVue, { i18next: instance })`。不引入游戏外壳 CSS（组件 token 已有回退），页面自身背景随主题切换。
- 画廊工具栏：主题（深/浅，切换画廊根 `data-loot-theme`）、宽度框（320 / 390 / 1024 三列并排，或单选）、组件筛选；每个状态块标出状态 id，交互状态（展开、选择、键盘）可直接操作。
- 维护者打开方式（写进报告与合同）：`npm run dev`，浏览器访问 `http://localhost:5173/src/ext/modules/loot/tools/preview/index.html`。生产 `vite build` 只以根 `index.html` 为入口，本页不进入产物。

### 10.2 静态 HTML

- `tools/preview/render.ts` 导出纯函数 `renderLootUiPreview(options: { css: string }): Promise<string>`：`createSSRApp(LootUiGallery, { mode: 'static' })` + `renderToString`，静态模式下每个状态渲染为 深色×(320,390,1024) 与 浅色×(320,390,1024) 六个框，输出一个自包含 HTML（内联 `options.css`，无脚本、无外链）。render.ts 不 import `node:*`（避免改类型配置）；CSS 由调用方收集。
- `tools/loot-ui-preview.mjs`：仿照 `loot-stats.mjs`，`createServer({ configFile:false, root, plugins:[vue()], logLevel:'error', optimizeDeps:{noDiscovery:true, include:[]}, server:{middlewareMode:true, hmr:false, ws:false}, appType:'custom' })`，用 `@vue/compiler-sfc` 的 `parse` 读取 `ui/*.vue` 与 `LootUiGallery.vue` 的全部 `<style>` 内容拼成 css，`ssrLoadModule('/src/ext/modules/loot/tools/preview/render.ts')` 生成 HTML 写到 `--out <目录>/loot-ui-preview.html`。用法：`node src/ext/modules/loot/tools/loot-ui-preview.mjs --out <仓库外目录>`。
- `tests/loot_ui_preview.test.ts` 在 vitest 内用同样方式（直接 import render.ts）生成 HTML 并断言：包含 §8 每个状态 id、深浅两套 × 三宽度、无 `ext.loot.` 原始键文本（缺键回退）、无 `<script`、无外链 `http`；设置环境变量 `LOOT_UI_PREVIEW_OUT=<目录>` 时额外写文件。生成物不提交。

---

## 11 测试（全部登记到 `src/ext/modules/loot/test-suites.json` 的 `test`）

渲染测试使用共享 `createSfcHarness`（`src/test/support/sfcHarness.ts`，只读使用）+ 自定义 Vue renderer（参照 `sfc_harness.test.ts` / growth `ext_growth_ui.test.ts` 的写法），i18next 用真实资源（主 + loot 核心 + UI）通过 `i18next-vue` 插件注入。

| 文件 | 覆盖 |
| --- | --- |
| `loot_ui_knowledge.test.ts` | §4.2 每条规则（含 3 种 INCONSISTENT_FACTS、地面/持有/幻觉/种类未知、腐化已知性 3 条路径、polarity 强制）；输入深冻结不变；结果深冻结；无随机（以抛错的 `Math.random` 桩包住调用）；`knownModifierDrafts` 一致性神谕（全部夹具全鉴定版） |
| `loot_ui_viewmodel.test.ts` | 每个构建器：名称模板选择全表、baseStats（含 partial、唯一戒指 `?`）、行排序、notices 顺序、格式表（§5.3 每行至少 2 例，含 brutal 合并区间、override、runic、defense/int、负 bp）、tone、adept 标签回退、比较列/聚合/delta/tone/notices、分解区间与神谕、阻断/警告、过滤默认与 `normalizeLootPickupFilter` 负例（未知字段、重复类别、非法 minRarity）、预设 metrics 由数据推导（对 standard 至少手算 3 个值写进注释）；`LOOT_UI_STATS`/`BASE_NAMES`/`RUNICS` 覆盖度 |
| `loot_ui_fixtures.test.ts` | §9 种子表重搜一致；每件校验通过；变换越界拒绝；谓词成立 |
| `loot_ui_components.test.ts` | §8 每个状态渲染成功并 `toMatchSnapshot()`（序列化：标签、class、role、aria-*、data-*、disabled、文本；稳定排序）；交互：筹码 activate、卡片折叠展开、比较折叠、分解 confirm 只含未阻断 key 且 submitting 禁用、过滤表单草稿/重置/提交规范化/只读禁用/未改动禁用提交、预设方向键+Home/End+Enter、各面板 Escape；**无泄露**：所有“未知”状态的渲染文本与组件 props 的 JSON 中不出现隐藏词缀的 id、其翻译名与其数值格式串（逐项构造被隐藏集合比对） |
| `loot_ui_i18n.test.ts` | 用 `scanI18nUsage`（只读 import `src/test/i18n_scan`）扫 `src` 与合并资源：位于 `ext/modules/loot/` 的 unresolved=0、missing=0、前缀引用=0；`ui.zh_CN.json` 每个键都在 literals 中；两 locale 文件键不相交；UI 文案全中文非空无 TODO；渲染文本不含 `ext.loot.`/`name.`/`runic.name.` 原始键；descriptor 合并后指纹与 LOOT_VERSION 不变 |
| `loot_ui_style.test.ts` | 解析每个 loot SFC 的 `<style>`（postcss，只读使用已有依赖）：非 scoped、选择器全部 `.loot-` 前缀、无 `!important`/`@import`/`url(`/`:global`/`prefers-color-scheme`；交互类声明 `min-height:44px` 与 `min-width:44px`；存在 `[data-loot-theme="light"]` 覆盖与 `@container`；对比度：6 稀有度 × (深色对 `#0d0d0c`、浅色对 `#f4f1e8`) WCAG ≥3.0，并输出实测值进报告（已知 rare 浅色约 3.58，低于 4.5：只报告，不改数据） |
| `loot_ui_preview.test.ts` | §10.2 断言 |
| `loot_ui_inert.test.ts` | `src/ext/modules/loot/ui/descriptor.ts` 不存在；`getInstalledModuleUiContributions()` 不含 `loot`；扫描 `src/` 下 loot 目录以外的文件无对 `modules/loot/ui` 或 `modules/loot/tools` 的引用；`ui/` 源码不含 `Math.random`、`Date`、`window.`、`document.`、`localStorage`、`addEventListener`、对 `engine/Core`、`ext/runtime`、`ext/ui`、`src/ui` 的 import；既有 `loot_inert` 保持通过 |

快照：首次用 `npx vitest run src/ext/modules/loot/tests/loot_ui_components.test.ts --maxWorkers=2 -u` 生成，再不带 `-u` 重跑确认通过；`.snap` 文件提交。报告列出快照数量。

---

## 12 门禁

所有命令在仓库根执行，`NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=2`。报告只写实际运行过的命令、退出码、数量（passed/skipped/todo/failed）、耗时；未运行写“未运行”及原因。

| 里程碑 | 内容 | 门禁 |
| --- | --- | --- |
| M1 | types/errors/knowledge/tables/format/viewModel + 夹具 + 对应测试 | boundary、vue-tsc、`npx vitest run src/ext/modules/loot/tests --maxWorkers=2` |
| M2 | 六组件 + locale + descriptor 合并 + components/i18n/style 测试 | 同上 + `npx vitest run src/test/p1_30_i18n_gate.test.ts --maxWorkers=2` |
| M3 | 预览页、CLI、preview/inert 测试 | 同上 + build + `node src/ext/modules/loot/tools/loot-ui-preview.mjs --out <仓库外目录>` |
| 收尾 | 同一最终候选树 | 见下 |

收尾（同一最终树，各一次）：

- `node scripts/check-module-boundaries.mjs`
- `npx vue-tsc -b`
- `npm run build`，随后 `grep -rl "loot-item-card\|loot-compare\|LootUiGallery" dist/` 必须无匹配（组件与预览不进产物），结果写报告
- `npx vitest run src/ext/modules/loot/tests --maxWorkers=2`
- `npx vitest run src/ext/modules/narrative/tests --maxWorkers=2`
- `npx vitest run src/test/p1_30_i18n_gate.test.ts src/test/ext_module_creation_ui.test.ts src/test/ext_module_boundaries.test.ts src/test/sfc_harness.test.ts --maxWorkers=2`（descriptor locale 变化与共享 harness 的直接受影响集）
- `node src/ext/modules/loot/tools/loot-ui-preview.mjs --out <仓库外目录>`（报告记 HTML 大小与状态数）

不跑：完整 `npm test`、全部 `test:ext`、`ext_module_composition`、组合 smoke、删除矩阵、`ce:fetch`、`test:full`、`test:gen`、`test:drift`。浏览器检查不由 dot 执行，报告写“浏览器：未执行（交维护者用预览页检查）”，不得写通过。

---

## 13 允许与禁止修改

### 13.1 白名单（只能改这些）

`src/ext/modules/loot/ui/**`（新建，**不含** `ui/descriptor.ts`）；`src/ext/modules/loot/locales/ui.zh_CN.json`（新建）；`src/ext/modules/loot/descriptor.ts`（仅 locales 合并一处，外加一行 import）；`src/ext/modules/loot/tools/preview/**`（新建）；`src/ext/modules/loot/tools/loot-ui-preview.mjs`（新建）；`src/ext/modules/loot/tests/loot_ui_*.test.ts` 与 `tests/__snapshots__/loot_ui_*`（新建）；`src/ext/modules/loot/test-suites.json`（只追加 8 项）；`docs/ext/loot-ui-contract.md`（新建）；`docs/ext/phase6b1b.report.md`（新建）。

### 13.2 不得修改

| 类别 | 内容 |
| --- | --- |
| loot 核心 | `data/**`、`locales/zh_CN.json`、`types.ts`、`errors.ts`、`schema.ts`、`catalog.ts`、`random.ts`、`rarity.ts`、`generator.ts`、`item.ts`、`economy.ts`、`definitions.ts`、`index.ts`、`tools/stats.ts`、`tools/doc-targets.ts`、`tools/loot-stats.mjs`、既有 10 个测试文件 |
| 版本 | LOOT_VERSION、rules schema、指纹、foundation 号、其他模块任何版本 |
| 共享源码 | `src/engine/**`、`src/entities/**`、`src/data/**`、`src/ext/*.ts`、`src/ext/ui/**`、`src/ui/**`、`src/components/**`、`src/assets/**`、`src/App.vue`、`src/main.ts`、`src/locales/**`、`src/test/**`（含 harness、support、i18n_scan） |
| 其他模块 | `src/ext/modules/{growth,narrative,combat,giants}/**` |
| 脚本与配置 | `scripts/**`、`package.json`、lock、`vite.config.*`、`tsconfig*.json`、根 `index.html` |
| 文档 | 除 §13.1 两个新文档外的全部文档（含 README、设计稿、数值表、核心合同、本任务书） |

禁止手段：为过门禁 skip/todo/放宽既有测试或扫描规则；在 loot 内 import 其他模块文件；动态拼接 i18n 键；手写/篡改夹具物品数据（§9.3 以外）；提交生成的静态 HTML、截图或其他生成物；全局 i18next 配置改动（测试/预览一律 `createInstance`）。

---

## 14 已预先作出的决定与 dot 自主裁决规则

### 14.1 已决定（不再讨论；维护者在 §A3 签署）

| 编号 | 决定 |
| --- | --- |
| B-01 | UI 文案放独立 `locales/ui.zh_CN.json`，descriptor 合并；核心 locale 与 `validateLootLocale` 不动；LOOT_VERSION 0.1.1 与指纹不变 |
| B-02 | 不挂载：无 `ui/descriptor.ts`、无 session、无外部引用；组件不进生产产物 |
| B-03 | 已知投影是视图层唯一输入，类型上不接受 `LootItemDataV1`；隐藏信息在投影处剥离 |
| B-04 | 稀有名仅在全部词缀已知后显示；之前显示“未鉴定的稀有{基底}” |
| B-05 | 唯一名/描述仅在全部固定行已知后显示（设计 §8.3）；戒指种类未知显示“未知戒指” |
| B-06 | 腐化已知 ⇔ 全鉴定 或 curseRevealed 或 负面词缀已知；detect magic 只给极性徽标 |
| B-07 | 幻觉只影响地面（稀有度未知、类别通称）；背包内物品不受影响 |
| B-08 | 地面：只显示稀有度、基底与力量需求；物等与词缀数拾取后显示 |
| B-09 | i18n 写法按 §7.2（`LootTextRef.nameKey` 统一字段名、字面量表、零前缀引用） |
| B-10 | 数值格式按 §5.3（ASCII 正负号、bp→%、区间 en dash、override `=N`） |
| B-11 | 比较用 §5.6 临时公式，仅已知效果，力量不足只提示不计惩罚；[5A2-S] 改为管线假设求值 |
| B-12 | 分解：地面/已装备阻断；唯一品可分解但警告（按数值表 §8.3 的唯一 20 碎片；设计 §10.4“非唯一”与之冲突，取数值表并在 §A3 提请签署）；腐化未知显示区间 |
| B-13 | 拾取过滤默认：稀缺“普通及以上”、标准/丰饶“魔法及以上”，全类别、自动拾金；放 `tables.ts`，[6B-int] 复核 |
| B-14 | 预设选择器的全部数字由数据计算，不手写 |
| B-15 | 样式非 scoped + `.loot-` 前缀；容器查询；token 回退到外壳变量；浅色仅 `[data-loot-theme="light"]` 开启；稀有色来自 rarities.json，经 CSS 自定义属性注入 |
| B-16 | 字形 `)`/`]`/`=` 与原生一致；腐化标记 `†`；未知徽标 `?×N` |
| B-17 | 键盘只在组件根本地处理；无全局监听、无焦点陷阱（集成时由 DialogHost/`registerKeyHandler` 承担） |
| B-18 | 项目政策“不做无障碍”（AGENTS.md）下，本步只做基础可达性：语义角色、标签、键盘、44px 目标、非纯颜色差值 |
| B-19 | 夹具只来自真实生成器 + mulberry32 首个命中种子；只允许 §9.3 变换 |
| B-20 | 快照为自定义 renderer 的文本序列化，提交 `.snap` |
| B-21 | 预览：Vite 实时页 + SSR 静态 HTML（CLI 与测试共用 render.ts）；生成物不提交 |
| B-22 | growth 属性显示名由宿主经 `attributeLabels` 提供，缺省显示属性 ID |
| B-23 | 折叠阈值：详情卡 8 行、比较每列 6 行（可由 props 调整） |

### 14.2 未写明细节的裁决规则（按顺序适用）

1. 任务书与设计稿/数值表冲突 → 以任务书为准；任务书未覆盖而设计/数值表有 → 以设计/数值表为准；都没有 → 规则 3–6。
2. 任务书与基线实际代码冲突（扫描器、harness、i18next-vue 在 SSR 下的行为等） → 以实际代码为准，选不改共享文件的做法，报告记录。
3. 纯代码组织、私有函数、CSS 细节、文案措辞、测试拆分 → 自行决定，列入“自行决定事项”。
4. 夹具配方无解 → 只放宽深度/预设/来源（保持谓词含义），报告记录配方变更。
5. 公共类型名、字段名、构建器签名、状态 id、§14.1 决定 → 不改；确需增加字段只能**追加可选字段**并在合同标注。
6. 发现核心（6B1-α）缺陷 → 不修；在报告“核心问题”列出复现与建议。

---

## 15 交付物与报告格式

### 15.1 `docs/ext/phase6b1b.report.md`（节序固定）

1. **结论**：完成/部分完成；一句话说明 loot 是否仍惰性、组件是否未挂载。
2. **基线与环境**：起点 commit、最终 commit、Node 版本、开工检查结果。
3. **交付清单**：新增/修改文件列表与 `git diff --stat <起点>..HEAD` 摘要；声明全部在 §13.1 白名单内（附自动核对命令）。
4. **合同摘要**：§4/§5/§6 实际导出与签名；任何追加的可选字段。
5. **i18n**：UI 键数量；扫描结果（unresolved/missing/前缀均 0）；指纹与版本未变的证据。
6. **夹具**：种子表（配方 → seed/itemIndex/简述物品），放宽记录。
7. **状态与快照**：§8 全部状态 id、快照数量、交互测试清单、无泄露测试方法。
8. **样式与主题**：token 表、断点、44px 检查、对比度实测表（12 格）。
9. **预览**：打开方式、静态 HTML 生成命令、大小与状态框数量；“浏览器：未执行（交维护者）”。
10. **门禁结果表**：§12 各里程碑末次与收尾；构建产物 grep 结果。
11. **自行决定事项**。
12. **待集成复核清单**：全部 `[C6-1] [5A2-S] [6B-int] [6B3]` 标记项，各写“集成时需确认什么”。
13. **核心问题**（若有）与**未覆盖项**。

### 15.2 `docs/ext/loot-ui-contract.md`

用途与稳定性分级（稳定 / 临时待 C6-1 / 待 5A2-S / 待 6B 集成 / 待 6B3）；§4、§5 全部类型与构建器签名；§6 组件 props/emits 表；§7.2 i18n 写法；主题 token 与稀有色注入方式；预览打开方式；“集成复核清单”表（项目 / 待复核步 / 可能变化 / 影响面 / 预计改动文件），至少包括：`LootKnowledgeFacts` 来源（原生 identified/magicDetected/ItemLoader.identifiedItems/诅咒暴露）[C6-1]；熟悉度剩余 [6B-int]；比较改用管线 `hypothetical(knownOnly)` 与力量惩罚 [5A2-S]；growth 属性名 `attributeLabels` [5A2-S]；挂载位置（背包详情抽屉、地面提示、新局 creationStep）与 DialogHost/键盘接管 [6B-int]；`set-filter`/`salvage`/预设初始命令载荷 [6B-int]；拾取过滤默认值 [6B-int]；强化上限显示与精炼 UI [6B3]；地图稀有色装饰器 [6A1]；套装/插槽行 [6C]。

### 15.3 提交

按逻辑分提交，英文前缀，例如：`feat(loot-ui): knowledge projection and view models` / `test(loot-ui): seeded fixtures and view-model tests` / `feat(loot-ui): presentational components and locale` / `test(loot-ui): component snapshots, i18n and style checks` / `feat(loot-ui): preview gallery and static renderer` / `docs(ext): 6B1-beta report and loot UI contract`。先跑完门禁确认结果，再单独执行推送；里程碑门禁通过后可推送备份。

---

## 16 dot 最终回复格式（≤30 行中文）

```text
6B1-β 完成情况：<完成/部分>；loot 仍惰性：<是/否>；组件挂载：无
分支/提交：ext/phase6-loot-core @ <最终 commit>（起点 <commit>）
报告：docs/ext/phase6b1b.report.md；合同：docs/ext/loot-ui-contract.md
组件：<6> 个 + 内部 <n>；构建器 <n> 个；UI 文案 <n> 键（前缀引用 0，unresolved 0）
状态：<n> 个（快照 <n>）；夹具配方 <n>（放宽 <n>）；无泄露检查 <n> 项
样式：44px 检查 <通过/失败>；对比度最低 <值>（<稀有度/主题>）
预览：npm run dev → /src/ext/modules/loot/tools/preview/index.html；静态 HTML <大小> KiB
门禁：boundary <码> / vue-tsc <码> / build <码>（产物 grep <无匹配/有>）/ loot 测试 <passed/failed> / narrative <…> / 受影响既有 <…>
浏览器：未执行（交维护者）
指纹/版本：未变（<sha256 前12位>，0.1.1）
自行决定 <n> 条；待集成复核 <n> 项；核心问题 <n>；未覆盖：<一句>
```
