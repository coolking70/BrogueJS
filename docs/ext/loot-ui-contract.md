# loot UI 临时合同（6B1-β）

本合同只覆盖未挂载的纯展示组件。规则包 0.1.1 不变；无 Game、运行时、命令、状态或插槽接线。输入经过已知投影后才允许进入视图模型与组件。

## 稳定性

| 层 | 状态 | 边界 |
| --- | --- | --- |
| 已知投影、格式化、展示 DTO | 本步稳定 | 未知事实不能通过 props/文本泄露 |
| 宿主事实 | 临时待 C6-1 | 识别、侦测、诅咒由宿主提供 |
| 比较与属性名 | 待 5A2-S | 仅已知修正的临时公式 |
| 事件和展示状态 | 待 6B 集成 | 不产生命令，不挂载 |
| 强化上限/符文 | 待 6B3 | 当前仅显示，不执行操作 |

## 公开类型与函数

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

## 组件 props / emits

| 组件 | props（? 为可选） | emits |
| --- | --- | --- |
| LootItemChip | view, interactive?=false, selected?=false, compact?=false | activate() |
| LootItemCard | view, maxRows?=8, actions?=[], initiallyExpanded?=false | action(compare/salvage/close) |
| LootAffixRow（内部） | view | 无 |
| LootComparePanel | view, maxRows?=6 | close() |
| LootSalvagePanel | view, submitting?=false | confirm(keys), cancel() |
| LootPickupFilterForm | value, defaults, presetName, readOnly?=false, submitting?=false, initialDraft? | submit(normalizedDraft), cancel() |
| LootPresetPicker | options, modelValue, disabled?=false | update:modelValue(id), confirm(id) |

未知戒指的草稿 sourceId 为 unknown-ring#implicit / unknown-ring#enhancement；地面分解阻断且产量显示0，不反推隐藏物等。比较力量需求下降为 better，未知影响的估算值与差值附 ?。PresetPicker 没有 cancel/close emit，Escape 留宿主，其余合同定义了关闭/取消的面板本地处理 Escape。

追加可选字段：initiallyExpanded 用于 SSR 展开状态；initialDraft 用于 SSR 草稿状态，缺省取 value，后续 value 变化仍重置草稿。二者不接触游戏状态。

## i18n 约束

文本引用统一 LootTextRef.nameKey + params；t 首参仅完整字面量或以 nameKey/descriptionKey 结尾的属性路径。禁止可选链、下标、局部键变量、运行时拼接和前缀引用。原生名称、符文与属性映射使用 nameKey 字面量表。UI 文案单独位于 locales/ui.zh_CN.json，descriptor 仅合并资源；核心 locale 与指纹不变。名称模板先逐段翻译再插值。

## 主题与布局

非 scoped 样式全部使用 .loot- 前缀。根节点为 inline-size 查询容器；<360、360–639、≥640 三档；戒指比较列 <640 纵向排列。交互目标至少 44×44px，焦点轮廓 2px。

| Token | 深色默认（外壳变量回退） | 浅色 |
| --- | --- | --- |
| --loot-bg | --th-panel / #0d0d0c | #f4f1e8 |
| --loot-raised | --th-raised / #181815 | #ebe6d8 |
| --loot-fg | --th-fg / #e4dfd1 | #1f1d18 |
| --loot-dim | --th-dim / #9e998d | #5d584c |
| --loot-line | --th-line / #34322c | #b9b2a0 |
| --loot-good | --th-ok / #8fbf6a | #2f6b1f |
| --loot-bad | --th-hp / #d9503f | #a3271b |
| --loot-focus | --th-accent / #e4dfd1 | #1f1d18 |

浅色仅由自身或祖先 data-loot-theme="light" 开启。稀有色由 LootRarityStyle 注入 --loot-rarity-dark / --loot-rarity-light；未知使用中性色。字体回退 --th-font / monospace，圆角 --th-r / 0。

## 预览

npm run dev 后打开 http://localhost:5173/src/ext/modules/loot/tools/preview/index.html 。

静态：node src/ext/modules/loot/tools/loot-ui-preview.mjs --out <仓库外目录>，输出 loot-ui-preview.html，可直接打开。无脚本和外链；全状态 × 深浅 × 320/390/1024。静态页不能交互；实时页用于键盘、展开、表单检查。组件、画廊和生成物均不进入生产构建。

浏览器：未执行（交维护者用预览页检查）。

## 集成复核清单

| 项目 | 待复核步 | 可能变化 | 影响面 | 预计改动文件 |
| --- | --- | --- | --- | --- |
| LootKnowledgeFacts 来源：原生 identified/magicDetected/ItemLoader.identifiedItems/诅咒暴露 | C6-1 | 可信事实适配 | 投影真实性 | 新 adapter、knowledge.ts |
| 熟悉度剩余 | 6B-int | 宿主进度来源 | notice | 新 adapter |
| 比较 hypothetical(knownOnly)、力量惩罚 | 5A2-S | 替换临时公式 | baseStats、差值 | viewModel.ts |
| growth 属性名 attributeLabels | 5A2-S | 真实标签接口 | adept 名称 | 新 adapter |
| 背包抽屉、地面、新局 creationStep | 6B-int | 增加挂载 | 入口与布局 | 新 ui/descriptor.ts |
| DialogHost 与键盘接管 | 6B-int | 焦点、全局按键归宿主 | 面板生命周期 | 新 UI session |
| set-filter/salvage/预设命令载荷 | 6B-int | 真正命令与事务 | emits 消费方 | 新 adapter/commands |
| 拾取过滤默认值 | 6B-int | 平衡与设置策略 | defaultLootPickupFilter | tables.ts |
| 强化上限、精炼 UI | 6B3 | 交互与成本 | 详情与新组件 | viewModel.ts、ui/ |
| 地图稀有色装饰器 | 6A1 | 只读地图接口 | 地面提示 | 新 adapter |
| 套装/插槽行 | 6C | 新 DTO 与行 | 详情、比较 | types.ts、viewModel.ts、组件 |
