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
