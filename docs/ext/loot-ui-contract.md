# loot UI 合同（6B2 游戏会话与 β 展示）

2026-10-15。纯包0.1.1、集成0.3.0。生产挂载新局预设与背包/检视详情、实际属性比较、过滤、分解、已知装备来源；浏览器三档待维护者验收。输入经可信边界投影后才允许进入视图模型与组件。

## 当前边界

- 新局选择同时输出 `{presetId}` manifest configuration 和恰一次 create，首层已使用选定配置。
- 四位置 floor/pack/equipped/container。floor 对外仅稀有度，未知戒指 baseId 为 null；未知行只有位置；名称保留原生基底和外层铭文。无可靠诅咒暴露事实传 false，侦测不擅自推导历史腐化。幻觉/记忆不查询真实稀有度。
- `buildLiveLootCompareView` 接候选实体ID、已知DTO和公开 StatQuery，以 `hypothetical(playerId, patch, true)` 求基础六项及实际生效扩展标量。戒指比较列与原生命令一致：双空仅左槽、单戒仅空槽、双满才分别替换左右实体；已装备候选仅展示当前槽且不提供重复装备动作。条件/符文行独立，不并入无条件收益；固定符文强度是数据展示，未宣称6B3强度已生效。
- 原生/loot 两侧分别生成当前物品 chip 与已知条件/符文行，native↔loot 均保留条件收益增减；未知行不进入比较，不为原生物品伪造 loot DTO。
- 包内未知/部分已知物品分解以公开合法物等上下界、已知稀有度和可能腐化状态计算可信产量区间；完全已知时给确定值。混合批次合计各有效条目上下界，不读取隐藏精确物等。地面分解仍阻断。
- `buildLootCompareView` 仍供纯 β 预览；其中临时基础公式不是运行机械结果，禁止用作真实比较适配。
- F-03：公开 LootCompareRowView 增加可选 `condition?: LootTextRef` / `runic?: LootTextRef`，视图模型保留分组身份，组件直接本地化引用，不解析key。R08“对大型目标”、R12“力量”有独立DTO与渲染文本回归，未揭示行不产生这些引用。
- 原F-01/F-02回归保留；窄容器规则和SSR组件回归不等于浏览器像素/触控验收。

## 公开类型与函数

```ts
import type { ItemClass, RarityId } from '../types';

export type LootUiLocation = 'floor' | 'pack' | 'equipped' | 'container';
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
  readonly condition?: LootTextRef; readonly runic?: LootTextRef;
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

## 6B2 会话接线

共享 `ModuleUiSession.itemActions` 只传物品ID；loot适配器读取实际位置并构造已知DTO，容器ID经既有 `projectView/worldWork.readWorkContext` 公开只读能力返回。原生物品使用独立 fallback，不伪造loot实例。批量分解/碎片鉴定/过滤只走 `executeCommand`；装备只走 `executeItemCommand`。草稿与展示刷新解耦，零tick设置去重，确认与异步收尾后才发布反馈。关闭/换局/load/seek清会话选择并释放键处理器；主模态占用显示时遵从宿主互斥。来源页列实际已装备已知行，条件与符文保持标签，不归入无条件总收益。


## 6B3 当前差量（2026-10-15）

本节覆盖上文历史阶段的属性能力缺口及后续阶段编号。已落地内容见 [6B3实施合同](phase6b3-contract.md)：软推荐选择、正式 `growth.attributes.v1` / `growth.attribute:<完整定义ID>`、受限两阶段属性派生、sage/adept/scholar实际提交知识、有限职业/树贡献与已知来源UI。growth1.9.0、loot0.4.0、foundation16；原数值未调，其他持久格式按合同保持。上文强化/精炼/符文强度重塑指向的6B3均顺延6B4；不追改历史验收结论。当前限定门禁及维护者浏览器待验见 [6B3报告](phase6b3.report.md)。

## 6B4 差量（2026-10-16）

维护者 D1–D7 全部采用 A。强化/精炼、21 随机符文、4 固定符文及真实效果知识协议以 [6B4 合同](phase6b4-contract.md) 为当前增量规格；版本为 foundation17/itemSdk2/loot0.5.0、pack0.2.0/实例v2/growth1.10.0。数值曲线不变。真实卷轴延迟到目标成功提交才消费；纯查询不触发知识或事务，原生非loot规则保持。浏览器三档交维护者，验收实绩见 [报告](phase6b4.report.md)。
