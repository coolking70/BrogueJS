# C6-1：阶段 6A 物品扩展与掉落服务合同

2026-10-11，6A0 候选合同。**只交文档与只读探针，未实现任何下述新增 API，未启用 loot。** 6A1 合并、fixture 验收并填入导出散列后才可作为 dot 的冻结 SDK。声明的静态类型检查不等于运行时接线验收。

## 1. 依据与优先级

- 代码基线：`ext/loot-6a0` / `origin/ext/phase5` = `59b9ba691daf66819eeea0299a0539f3641ad208`。本文所有生产代码 `文件:行` 均指该提交，不引用设计稿的旧行号作为实现事实。
- 设计输入固定为 `origin/ext/phase6-loot-core` = `93523fc596b173396a0d526ab2073b327ff7cf3e` 的 `docs/ext/{phase6-loot.md,phase6-loot-numbers.md,phase6-loot-tuning.md,loot-core-contract.md,loot-ui-contract.md}`。可用 `git show 93523fc:docs/ext/<文件>` 复核；本树不复制整套远端文档，也不合入远端模块。
- §13 的 **6A0** 是本步授权。数值以已批准的 **v1.1** 为准：`scarce/standard/bountiful`，33 个非符文词缀、21 个符文变体数据、8 件唯一品；遭遇唯一乘数 5000/10000/5000，warding 仅护甲，丰饶 elite 1–3。旧设计“26 词缀、6 唯一品”、旧预设名与旧倍率不再用于派发。L-D、N、M 已批准项不重新提请。
- `loot-core-contract.md` 的 v1 实例形状（含 `corrupted`）、随机向量与严格错误边界保持；标记 `[C6-1]` / `[5A2-S]` 的临时接口由本合同逐项对接。规则包 0.1.1 与未挂载的 β UI 都不代表可玩集成。
- 遵守当前任务的轻量验证限制，不触碰 BrogueJS-p5，不借历史 full 要求重复启动大套件。后续阶段 6 门禁政策仍需维护者明确。

## 2. 当前真实接入点与差量

| 接入点（本表均为现存源码） | 已实现事实 | 6A1 必须补齐 |
| --- | --- | --- |
| `src/engine/Items/Item.ts:71` | 可选 `worldItem` 是 C5 材料字段；没有 `moduleData` | 单一通用可选字段，不能把词缀塞进 worldItem |
| `src/engine/Core/EntitySnapshot.ts:11`、`:97` | ITEM_FIELDS 显式投影，深拷贝普通容器；未列字段会丢失 | 序列化/反序列化登记 moduleData，保持缺席语义 |
| `src/test/u_01_instance_snapshot.test.ts:24` | 实例字段审计使用 ITEM_FIELDS | 增加真实字段与自有属性审计，不削弱守卫 |
| `src/engine/Core/WholeRunSnapshot.ts:163`、`:246`、`:556` | 活跃层、缓存层、背包、坠落、entityGraph 编码/解码/原始行枚举 | 原始 DTO 在 codec 丢字段前做 moduleData 校验；图引用与所有权分开验证 |
| `src/engine/Core/WorldItemRoots.ts:6`、`:62` | 唯一机械所有者枚举、ID 去重；容器由 worldContainerItems 解引用 | 所有机械根均可读写/校验，不能只扫背包 |
| `src/engine/Core/WorldWork.ts:695`、`src/engine/Core/WorldWorkValidation.ts:318` | escrow 是容器；现工作输入只接受 worldItem | escrow 数据必须被校验；不因此自动开放原生装备作 crafting 输入 |
| `src/engine/Core/Game.ts:11929`、`:12007` | loadSnapshot 先构建候选，再验证，后退役活局 | moduleData 坏档/缺 owner/跨字段不一致在发布前拒绝，活局与 ID/RNG 不变 |
| `src/engine/Items/Inventory.ts:40`、`:42`、`:81` | stacksWith 外还有 materialCompatible 与 addItem 快路 | 所有合并入口对任一含 moduleData 的物品拒绝堆叠，含 hasSpace/预览/容器路径 |
| `src/engine/Items/WorldItems.ts:22`、`:44`、`src/ext/worldSdk.ts:118` | 固定装配只有 dagger / leather_armor / ration_of_food，已知 +0 | 提取共用原生模板装配核心并扩展武/甲/戒；**没有现成的全基底装配器** |
| `src/engine/Core/Game.ts:1199`、`:1255` | populate 先保底/计量，再类别与原生基底骰 | 在普通可转换类别内切换服务；不先 spawn 随机装备再覆盖 |
| `src/engine/Core/Game.ts:1369`、`:1376` | blueprint 包含类别掩码、指定 ID、品质重试 | vault 单次事务适配，明确 qualifiers，不能逐次原生重试重复领唯一品 |
| `src/engine/Items/ItemLoader.ts:1325`、`:1397`、`:1491` | 原生武/甲/戒 spawn 消耗 RNG | 转换成功的 loot 物品禁止再走这些随机 spawn |
| `src/engine/Core/Game.ts:10922`、`:10960`、`:10977` | 核心终结、captureDeath、携带物掉落、死亡 DF；外围成员提前退役 | kill 事件放在携带物之后、DF 之前；所有非行政死因统一进入 |
| `src/engine/Core/Game.ts:9327`、`:9681`、`:9812` | 旧 dropMonsterLoot 仍有毒死/近战调用 | 已有掉落服务接管时抑制旧两条额外掉落；未安装/未接管保持原状 |
| `src/ext/runtime.ts:1540` | captureDeath 先执行 deathCaptured，再存 DeathFact | 资格/遭遇归属需在回调改状态前捕获；不能从 kill 通知反推 |
| `src/ext/modules/giants/module.ts:32`、`:103`、`:111` | boss public tag / encounterKey；giants 私有 subjects 在 deathCaptured 中转 defeated/lost | **尚无通用 encounter defeated 服务**；新增底座生命周期适配与 giants 声明式接线，不导入 giants 私有 state |
| `src/engine/Core/Game.ts:499`、`:1762`、`:14039`、`src/engine/Core/WorldCheckpoint.ts:18` | 战斗事实/生成/工作各有显式事务写集 | 掉落写集纳入外层回滚、ID allocator、RNG、收据、属性/显示绑定，不能只回滚模块 state |
| `src/ext/types.ts:289`、`:301`、`:312` | 有 componentValidators/statSources/commands，无 itemDataValidators | 新增通用贡献声明与安装冲突校验 |
| `src/engine/Core/Game.ts:3833`、`:4373`、`src/ext/runtime.ts:1388` | executeCommand 边界；普通扩展 runtime 要求 JSON 字符串 envelope | loot 命令复用边界，原生卷轴继续 executeItemCommand；不新造绕过录像的入口 |
| `src/ext/registry.ts:22`、`:54`、`src/ext/ui/creation.ts:27`、`src/engine/Core/Game.ts:1185` | runConfiguration 精确校验与初始命令已有路径 | 预设同时进入 manifest 配置/身份与一次 create 初始命令，二者相同 |
| `src/engine/Items/Item.ts:200`、`src/engine/Items/WorldItemPresentation.ts:8` | 名称 getter 与 MATERIAL 弱绑定展示 | 另加通用名称装饰，不把原生 loot 冒充 MATERIAL |
| `src/engine/UI/Appearance.ts:492` | 真正物品外观入口是 itemAppearance，有可见/记忆/幻觉分支 | 在这里接只读前景色装饰；旧设计 mapTileDrawing 不是实际物品着色入口 |
| `src/engine/Items/ItemLoader.ts:851`、`:888`、`:907` | 卷轴鉴定/武器熟悉/穿戴熟悉分支；鉴定现在会 markItemStatsDirty | 同步 native identified 与 known；纯知识变化不再误增机械 revision，仍改变存档与知识投影 |
| `src/ext/stats.ts:78`、`:102`、`src/ext/runtime.ts:396` | EquippedStatItem 只有 id/category/kindKey/enchant/identified/runic | 增加冻结自有 moduleData 与基底事实；不得令 provider 获得 Item 指针 |
| `src/ext/stats.ts:125`、`src/engine/Stats/StatPipeline.ts:404` | hypothetical(actorId, change, knownOnly) 已实现 | β UI 临时公式换为此接口；四槽身份须明确，双戒分别比较 |
| `src/engine/Stats/NativeStatKeys.ts:30`、`src/engine/Stats/NativeStatSources.ts:88` | quarter enchant、回血分数、已附魔的伤害节点 | 需要 §7 单位映射和本地公式输入补口，不可直接照抄纯包 draft |
| `src/ext/modules/growth/statSources.ts:16`、`src/ext/modules/growth/module.ts:499` | 无 growth.attribute:* 注册；只有 growth.public-character.v1 查询 | growth.attributes.v1 尚不存在；必须发布可选能力后才激活 adept，否则使用已批准 fallback |
| `src/ext/descriptor.ts:5`、`src/engine/Core/WholeRunSnapshot.ts:188`、`src/engine/Core/RecordingV4.ts:64` | foundation13 / whole-run6 / recording4 / origin2 | 按 §9 统一分配新批次，6A0 不占号 |

`src/engine/Core/WorldItemRoots.ts` 的机械根不包含纯历史观察引用；`WholeRunSnapshot` 的 entityGraph 却可能包含它们。**持久化校验扫描每一个原始 Item 行**，不能用机械根计数器代替。装备与 visible/everSeen 是引用，不重复算 8,192 所有者额度。

## 3. Item.moduleData 与校验生命周期

拟新增：`declare public moduleData?: Record<string, Json>`。每个顶层键必须等于启用模块的 module ID；值为该模块自描述版本对象（loot 是 `v:1`），不再增加第二层名字。`itemDataValidators` 使用同样的 ID 键，安装时要求键等于声明模块 ID；不照搬组件的 `module:name` 命名。

1. 原生物品省略属性；拒绝显式 undefined、null、空 map、未知模块键、已安装但本局未启用的键、无 validator 的键。codec 拷贝不能把缺席变成自有 undefined。
2. 先验证有限 JSON、普通/空原型对象、稠密数组、无 getter/setter/符号/危险键/循环，再运行 owner validator；不得借 JSON.stringify 丢掉非法值来“净化”。候选预算：每件最多 4 owner、单 owner 紧凑 UTF-8 JSON ≤4 KiB、总 moduleData ≤8 KiB、递归深度≤16；这是 **6A0 新提案，待批准**。8,192 Item roots 上限沿 C5-1。
3. validator 同步、纯，只接收脱离实体的事实；闭包可捕获已验证有效目录。校验失败或抛错都拒绝，无降级、删除坏字段或迁移。校验包含 id/kind/category/quantity=1、词缀阶/值域/互斥/预算、稀有度和 nameParts/uniqueId 关系、`identified ⇔ 全部 known` 等跨字段一致性。原生种类已知与实例已知必须区分。
4. 每次可信创建/变更提交前验证；存档前验证所有根；读档先验证原始行再 decode，候选解码后复核引用与拥有者、目录、物化账本，最后一次性发布。失败保留当前局、两条 RNG、allocator、录像 generation/prefix。
5. 移动背包/地面/携带/缓存/坠落/容器只转移所有权和同一实例。禁止对有 moduleData 的物品堆叠、自动合并和拆数量；深拷贝候选/回滚不共享可变子对象。loot.shard、后续符文 MATERIAL 本身不带 moduleData，仍可按 C5 堆到 99。
6. 6B3 前原生强化仍可改 loot 物品原生 enchantment，因此**不能**在读档 validator 一律强制武/甲 enchantment=0；+0 是出生合同。6B3 开启重塑后再统一原生字段/数据关系与新版本。腐化后解咒也允许 isCursed=false 而 corrupted=true，不能按出生等式拒绝合法档。
7. 绑定与缓存属于会话资源；load/seek 重建、卸载清理。知识变化也要更新 native 摘要，但不加机械 stat revision；应清理/重算已知投影缓存。新增 Game 字段须登记 `scripts/u03-state-contract.json`；优先由受控会话保存 plan/revision，避免每件新增持久版本字段。

## 4. C6-1 声明草案（可独立类型检查）

下块是**新 SDK 候选形状**，将落于 `src/ext/itemSdk.ts`，由 `src/ext/types.ts` 贡献类型接入。Json/文本/坐标等独立别名用于 6A0 无副作用类型检查，6A1 实现须复用仓内等价类型并做真实 provider fixture 类型检查。它不是现存导出列表。实例 LootItemDataV1 保持远端 core 类型，不在底座复制 loot 语义。

```ts
// C6-1 declarations: checked by scripts/phase6a0-contract-check.mjs
export type C6Json = null | boolean | number | string | readonly C6Json[]
  | { readonly [key: string]: C6Json };
export type ItemModuleData = Readonly<Record<string, C6Json>>;
export type ItemClass = 'weapon' | 'armor' | 'ring';
export type DropSource = 'floor' | 'kill' | 'encounter' | 'vault';
export type At = Readonly<{ x: number; y: number }>;
export interface ItemFacts {
  readonly id: number;
  readonly category: number;
  readonly kindKey: string;
  readonly quantity: number;
  readonly identified: boolean;
  readonly enchantment: number;
  readonly isCursed: boolean;
  readonly moduleData?: ItemModuleData;
}
export interface ItemDataValidationContext {
  readonly owner: string;
  readonly enabledModules: readonly string[];
  readonly item: ItemFacts;
  readonly phase: 'create' | 'update' | 'save' | 'load';
}
export type ItemDataValidator = (value: unknown, facts: ItemDataValidationContext) => boolean;
interface DropBase {
  readonly v: 1;
  readonly eventId: number;
  readonly level: Readonly<{ kind: 'dungeon'; depth: number }>;
  readonly at: At;
  readonly playerId: number;
}
export type DropEvent = DropBase & (
  | { readonly source: 'floor'; readonly itemClass: ItemClass }
  | { readonly source: 'vault'; readonly itemClass: ItemClass;
      readonly baseId: string | null; readonly highValue: boolean;
      readonly qualifiers: readonly string[] }
  | { readonly source: 'kill'; readonly actorId: number;
      readonly monster: Readonly<{ typeId: string; leader: boolean;
        champion: boolean; encounterSubject: boolean }> }
  | { readonly source: 'encounter'; readonly encounterKey: string;
      readonly encounterOrdinal: number; readonly formId: string | null }
);
export interface NativeAssembly {
  readonly kind: string;
  readonly category: ItemClass;
  readonly enchantment: number;
  readonly runicType: string | null;
  readonly isCursed: boolean;
  readonly identified: boolean;
  readonly familiarityRemaining: number;
}
export interface DropItemSpec {
  readonly native: NativeAssembly;
  readonly moduleData: ItemModuleData;
}
export interface DropRollContext {
  readonly owner: string;
  readonly state: C6Json;
  readonly event: DropEvent;
  randomInt(lo: number, hi: number): number;
  stat(actorId: number, key: string): number;
}
export interface DropProposal {
  readonly v: 1;
  readonly converted: boolean;
  readonly items: readonly DropItemSpec[];
  readonly gold: number;
  // Parallel to items; null means no unique receipt, never a free-form state patch.
  readonly uniqueIds: readonly (string | null)[];
}
export interface DropAcceptance {
  readonly v: 1;
  readonly eventId: number;
  readonly accepted: readonly { readonly index: number; readonly itemId: number }[];
  readonly skipped: readonly { readonly index: number; readonly reason: 'capacity' | 'placement' }[];
  readonly acceptedGold: number;
  readonly newUniqueIds: readonly string[];
}
declare const planBrand: unique symbol;
export interface DropPlanHandle { readonly [planBrand]: true; readonly contract: 'C6-1' }
export interface DropProvider {
  readonly sources: readonly DropSource[];
  roll(event: DropEvent, context: DropRollContext): DropProposal;
  // Pure next-state calculation, applied only with the native commit.
  settle(state: C6Json, event: DropEvent, accepted: DropAcceptance): C6Json;
}
// Host-owned safe-point authority; never exposed to UI or ordinary event callbacks.
export interface DropAuthority {
  prepare(event: DropEvent): DropPlanHandle;
  commit(plan: DropPlanHandle): DropAcceptance;
}
export interface KnownItemFacts {
  readonly v: 1;
  readonly location: 'floor' | 'pack' | 'equipped' | 'container';
  readonly baseName: string;
  readonly nativeGlyph: string;
  readonly hallucinating: boolean;
  readonly data: C6Json; // owner projection, already stripped of hidden fields
}
export interface TextRef {
  readonly nameKey: string;
  readonly params: Readonly<Record<string, string | number>>;
}
export interface ItemPresentationProvider {
  // Pure trusted projection, kept inside runtime; raw data never goes to Vue props.
  project(item: ItemFacts, knowledge: C6Json): C6Json;
  name(item: KnownItemFacts): TextRef | null;
  appearance(item: KnownItemFacts): Readonly<{ colorToken: string; marker: string }> | null;
}
export interface ItemContribution {
  readonly itemDataValidators?: Readonly<Record<string, ItemDataValidator>>;
  readonly itemDrops?: DropProvider;
  readonly itemPresentation?: ItemPresentationProvider;
  readonly itemCommands?: Readonly<Record<string, ItemCommandProvider>>;
}
export interface ItemCommandRead {
  readonly owner: string;
  readonly playerId: number;
  readonly revision: number;
  readonly state: C6Json;
  readonly inventory: readonly ItemFacts[];
  readonly equippedIds: readonly number[];
}
export interface ItemCommandProposal {
  readonly v: 1;
  readonly revision: number;
  readonly consume: readonly { readonly itemId: number; readonly quantity: number }[];
  readonly updateOwnData: readonly { readonly itemId: number; readonly data: C6Json }[];
  readonly materials: readonly { readonly definitionId: string; readonly quantity: number }[];
  readonly nextState: C6Json;
  readonly chargedTicks: number;
  readonly confirmation: TextRef | null;
}
export interface ItemCommandProvider {
  // Pure, detached preflight. Host owns confirmation, revalidation and commit.
  prepare(payload: C6Json, context: ItemCommandRead): ItemCommandProposal | null;
}
export type LootCommand = {
  readonly module: 'loot';
  readonly action: 'create' | 'set-filter' | 'salvage' | 'identify-shards'
    | 'socket' | 'unsocket' | 'reforge';
  readonly payload: C6Json;
};
```

`DropProposal.uniqueIds` 将纯包 `newUniqueIds` 和 items 对齐；宿主验证一一对应、重复与实际 accepted，不能直接照单持久化全部 newUniqueIds。`NativeAssembly` 不含不存在的 `Item.runicStrength`；强度保留在 moduleData，经管线使用。上面的 stat 读取只能读本事件捕获的合法玩家事实，不能在 roll 中触发 reconcile/消息/新事务。

`prepare` 是可信安全点内的一次掷骰与计划准备，**不是 UI 只读报价**；不可反复调用挑选结果。模块只有 roll/settle，不能自行发 event、持有活体或直接调用 authority。plan 是会话 WeakMap 中的一次性能力，品牌不能作为运行时防伪；提交必须检查真实对象身份、owner、当前命令/生成事务、事件序号、世界 revision/根容量和实体存在性。过期、复用、伪造、跨局/跨 owner 均拒绝且无额外 RNG/时间。

## 5. 掉落安全点、事务与收据

### 5.1 事件资格与抽取边界

| 来源 | 宿主负责 | 纯包负责 |
| --- | --- | --- |
| floor | 计量/食物/深层宝石原路径；普通武器先保留投掷分流资格，甲/戒直接可转换；可转换路径不再掷被替换的原生近战基底。转换拒绝后才走原生 spawn；外层落点只做一次 | 转换率、类内基底/物等/词缀；converted=false 时无产物/金/收据 |
| vault | 掩码选定类别、显式基底与 qualifiers。投掷/非三类走原生。先把已支持的品质语义映射为高价值/最低稀有，再仅做一次 loot 计划 | 固定基底不抽；其余按表；不通过重复原生 spawn 来凑品质 |
| kill | deathProcessed/dying 去重；先抓 clone、rewardless、召唤出生资格、ally、leader、mutation、encounter 事实，再 captureDeath；携带物先落，loot 再落，最后死亡 DF | 怪物分级/掉率/物品和金币（金币在所有物品抽取后） |
| encounter | 同一已登记遭遇 alive→defeated 提交一次；成员/分裂主体全终结才有效；行政失去主体转 lost；load/seek/查询不派发 | 保底、件数、唯一偏置、金币；主体 kill 的 encounterSubject=true 防双掉 |

L-D10=C 是**任何击杀者的非行政死亡**都可掉，仍排除“死者为盟友/克隆/无奖励转换/召唤副本”。不能用“击杀者不是玩家”过滤。现 `DeathFact` 不包含这些全部字段，须在宿主生成可信 DropEvent；召唤资格要审计出生路径，不能临时凭怪物 ID 猜测。部位 part、合成 craft 与 site 均不进 v1 联合；无深度场景暂不发事件，不伪造 depth=1 等价于 siteIlvl（倍率非整数时二者不同）。

floor 投掷资格必须明确到固定向量：建议类别选 WEAPON 后，用一次原生频率加权的“投掷/近战”分流；投掷再在投掷池选基底，近战交 loot 基底池。这会改变启用 loot 时的 RNG 次序，属于新版本路径；**未启用时不得加这次分流**。vault qualifiers 不仅有“好附魔”，`MachineItemGeneration` 的其它约束必须逐项适配；无法等价表达的请求返回明确“不接管”并走完整原生路径，不悄悄丢约束，不发 loot 收据。对应映射/向量在 6A1b 冻结后给 dot。

### 5.2 计划、提交与回滚

固定顺序：资格/静态校验 → 冻结事实 → 开外层 checkpoint → owner roll（闭区间实质 RNG，≤64/件、≤512/事件）→ 校验提案 → 按提案顺序预检容量/落点 → 固定装配 → 生成 acceptance → owner settle → 校验新 state/Item/属性预算 → 一次提交世界、收据、goldGenerated、脏标记 → 成功后发布事实/本地化提示。

- 同 source 最多一个接管 provider，冲突在安装期拒绝；不要把多个 provider 按装载顺序相乘。所有注册与列表顺序稳定，显示、校验、settle 都不抽 RNG。
- 8 件装备上限；金币最多额外 1 个原生 GOLD 根，也计入 8,192 根预算。件数规则与全局根额度是两个不同限制。
- 容量不足/无落点是**预期接受结果**：按生成顺序接受可放的件，跳过其余；保留已完成的生成骰，不为重试再抽。无候选不抽落点；有候选沿底座掉落候选次序/原单次 randRange，floor/vault 保持外层唯一落点所有者。全满可提交零件 acceptance，至多一次本地化提示。
- 唯一收据仅对实际落地的 accepted 物品提交；同事件 roll 内仍用临时占用防重复。被跳过的唯一允许未来再掉；遭遇 watermark 在成功消费本事件（包括全被跳过）后推进，不能在重访时补发。
- 结构非法、validator/settle 异常、陈旧 plan、目录/属性预算失败是**异常回滚**：恢复外层世界、双流与计数、allocator、死亡处理标志、携带物、goldGenerated、module state、物化账本、缓存/弱绑定、消息/事实队列。不是“保留骰但回滚一半”。嵌套生成或死亡 DF 失败回到相应外层安全点。
- `killMonster` 目前只有 resident 路径包装完整 native checkpoint，runtime.transaction 也不自动覆盖任意 Item 写集。6A1 必须补真实宿主事务，不能把现有 transaction 调用当作掉落已经原子化。

kill/encounter 的外层 checkpoint 必须在 `captureDeath` 之前开始，覆盖 deathCaptured 的模块变更、核心/成员退役和携带物；掉落 prepare 复用该外层，不能等携带物已经落地才开始唯一的 checkpoint。普通生成同理复用原生成事务。

### 5.3 遭遇适配与持久状态

建议新增底座通用遭遇声明/生命周期登记（模块提交冻结的 encounterKey/formId/subject IDs；底座核验出生/分裂/终结事实），而不是 loot 读 giants.bosses。giants 的现存 status 仍由 giants 管理；适配器在同一事务内发布经宿主验证的转移，底座单调分配 encounterOrdinal，原有公共 tag 用于主体识别。声明与 ordinal 要覆盖换层、分裂、行政清除、重载，6A1b 用中性 fixture 验证，真实 giants 接线由本地维护，dot 不碰它。

loot state 目标仍 ≤4 KiB。唯一品用目录固定序号的紧凑收据（最多128），遭遇用已验证全序的 watermark，而非无限增长的 encounterKey 历史；目录与收据位置受 rules 指纹保护，不迁移。底座持久序号、遭遇登记的精确字段/预算需要在 6A1b 审查后统一纳入 foundation 格式，不得先声称存在。若选键列表替代 watermark，必须给最坏预算与溢出行为后重新冻结；不得截掉旧收据或退化为重复掉落。

## 6. 固定装配、命令外壳与显示

### 6.1 复用 5A2

从 `assembleWorldItem` 提取一个不掷骰的原生模板装配核心，C5 原三模板调用结果保持；新增 C6 包装只接受经宿主登记的近战武器12/护甲6/戒指8基底。复制 damage/clumping/flags/armor/strengthRequired/weight/identityId/glyph/color；quantity=1，无 quiver 堆叠 ID。武/甲出生 enchantment=0；戒指 implicit/唯一覆盖由纯包 deriveNativeFacts 给出一次，不再重复加一条 implicit stat 修正。

熟悉度由预设提供并经 schema 限界，写原生 charges；已知状态/诅咒/runicType 必须与生成数据一致。初始固定唯一符文允许写原生 runicType，6B3 前强度读取仍有原生限制，不能宣布完整强度效果已生效。装配和恢复不得调用随机 spawn。

**6A0 不修改任何既有冻结文件。** 6A1 不为扩充 nativeTemplate 修改 `worldSdk.ts` 的冻结联合；新 C6 接口调用共用内部装配核心。§7 若要扩充已冻结 `stats.ts`，须明确解冻范围、保持原调用兼容并发布新散列，不能同时宣称九冻结字节不变。旧文档的 `registerItemDefinitions` 不是现成方法，实际是模块 `worldDefinitions.items`（`src/ext/worldSdk.ts:449`）由 C5 注册/验证。loot.shard/符文沿该入口注册，不能另造材料系统。

### 6.2 命令与时间

逻辑名字写作 loot.*，线上仍为 `executeCommand('ext:command', JSON.stringify({module:'loot',action,payload}))`，或按最终受控原生计划路由保留同一 envelope。`executeItemCommand` 继续承载原生卷轴选择/确认；不得给 UI 一个自由 `perform` 回调写 Item。

| action / 阶段 | payload（均严格字段校验） | 成本/提交 |
| --- | --- | --- |
| create / 6B1 | `{v:1,presetId}`，恰一次，与 manifest configuration 一致 | 0 tick；初始命令，不准局中换预设 |
| set-filter / 6B1 | `{v:1,revision,minRarity,classes,autoPickupGold}` | 0 tick但录像；class 去重规范排序；影响自动拾取的 state |
| salvage / 6B1 | `{v:1,revision,itemIds}`，1–26 个互异当前背包 ID | 每件100 tick，事务全成或全败；唯一/装备中/粘装拒绝；碎片容量预检、确认先于提交 |
| identify-shards / 6B1 | `{v:1,revision,itemId}` | 10碎片鉴定整件；建议100 tick，待维护者定时；消耗与揭示原子 |
| socket / 6C2 | `{v:1,revision,itemId,runeItemId}` | 100 tick；6B1 不注册，无空成功命令 |
| unsocket/reforge / 6C3 | 走工位、受控工作票据/CAS | 未接线前拒绝，不在普通 commands 内绕过工位 |

revision 是模块持久命令 revision；计划额外绑定 item/所有者/会话原生事实（不能只看模块 revision，否则丢弃/换装后仍可能接受旧目标）。非法、陈旧、拒绝确认均0消耗/0机械时间/0实质 RNG，不进已接受命令；确认决策由既有录像边界记录。未来“首次触发揭示”只能在结算安全点提交，不允许 statSources.collect / UI 查询触发。

`itemCommands` 是拟新增宿主路由，复用 envelope 而不与同名 `commands` 双重注册；原 `prepareControlledCommand` 只承载 attack/move/wait/search（`src/ext/types.ts:152`），不能拿 wait 包装物品写入来冒充现成能力。宿主把 prepare 的纯DTO封为会话计划，先校验自身owner、背包所有权、装备/粘装、每件数量、材料定义归属/堆叠/容量、action允许的tick/修改种类，确认后再CAS重验，最后执行consume/update/material输出与nextState。updateOwnData只能改自己的顶层数据，原生identified/canBeIdentified等由可信知识同步器派生；原生强化/符文补丁权限留6B3另约。读档/回放执行同一宿主提交，普通callback拿不到Item能力。v1仅鉴定/分解/过滤，prepare无RNG；未来重铸不能塞进这个纯准备接口。

原始设计禁分解唯一品，数值表却给了唯一基础碎片20；本合同暂沿原设计**拒绝唯一**，保留数值行作预留，列为维护者待定而不擅自开放。β UI 发出 keys 必须由宿主转换为当前 item IDs 并重新校验。container 的 UI location 是新扩展，β 目前只有 floor/pack/equipped；不能把箱内未知物品强转为已知背包。

### 6.3 名称、外观与已知投影

- 装饰器安装为 runtime/session WeakMap 绑定，禁止静态 import loot；模块缺席为原生名/外观。先算原生名称，再装饰，inscription 最外层保留；避免装饰器回调递归读 uninscribedName。
- raw Item/moduleData 仅进入可信 owner `project`；Vue props/name/appearance 接收已知 DTO。底座给种类已知、实例已知、detect magic 可见极性、诅咒确已暴露、熟悉度剩余和位置。`isCursed` 本身不等于已暴露；没有可靠暴露事实时传 false，不能猜测。
- floor 仅稀有度可见，词缀数/物等/未鉴定唯一名/稀有随机名不可见；未知戒指隐藏 baseId；未知行只有位置标签，没有 id/tier/values/sourceId。纯 getter 缺少位置时使用保守 floor 投影；明确背包/装备/容器读口再提供相应上下文。
- itemAppearance 在 `cellVisible && !hallucinating` 时才请求稀有色。幻觉整条分支不读真实稀有度，即使原生 halledColor 骰未命中也不能泄露；记忆格沿记忆外观，不重新查真值。保持原生 glyph，仅改前景主题 token；mapTileDrawing 继续消费渲染结果。
- 名称/颜色/比较/显示过滤均不得写状态、脏标记、时间或 RNG。机械自动拾取过滤走 state 与命令，显式拾取可越过过滤但仍经原生命令。
- i18n 引用为 nameKey/params；目录 locale 排除机械指纹，数值/预设/有效 availability 纳入。β 已实现的格式化/组件可复用，但其临时比较公式不得作为最终机械规格。

## 7. 与 5A2-S 属性管线的接口

保持 `statSources.collect(actor, context)`、`StatModifierRow`、`hypothetical` 和物化账本；新增只读装备事实必须在真实装备和 hypothetical 中采用同一投影。owner 由 runtime 填入，sourceId 用 `loot.item.<entityId>.affix.<index>.<modifierIndex>` 等 validId 字符，不沿用纯包 `<baseId>#...`（也不能让两枚同基底戒指共享来源身份）。layer 通常 equipment；unknown 行机械生效且 known=false；loot 不使用 refill-delta。

| 纯包草稿 | 当前管线事实 | C6 适配要求 |
| --- | --- | --- |
| weapon-enchant / runic-strength 整附魔 | weapon-enchant/runic-power/armor-runic-power 单位 quarter enchant | 精确 ×4；runic 强度的原生默认与固定值替换在6B3统一，避免平加两次 |
| plated 的 display-armor | native.defense 是十分之一护甲 | ×10；但本地 reinforced 需先合并本件 plated，再作本地比例 |
| mending 的 native.regeneration ring-point | native.regeneration 是精确 HP/turn，依赖 regeneration-bonus | 改投 native.regeneration-bonus；绝不能把“3戒指点”当“3 HP/turn” |
| shadow/noisy 的 ring-point | stealth-range 已含环境折半、装备与原生 ringStealthAdjustment | 需要同原生规则的聚合戒指点入口，负点×4且保留最终下限；不能简单 value 取负 |
| seeker 的 ring-point | awareness 原生行已乘 ringAwarenessBonus（每点20） | ×20一次，caps 8点=160；不是 cap=8 search strength |
| radiant 的 ring-point | light 基值1，原生含零光规则 | 与原生戒指点合并后执行原规则；“6点”不直接把最终倍率截成6 |
| keen/brutal 与 reinforced/plated 本地修正 | damage-min/max 在 nativeBase 已经过附魔；defense 已含甲附魔/穿戴惩罚 | 必须增加**公式前**装备基底入口，同一事实用于实际掷伤害与预览；不可向现有最终端点直接加未经附魔的 flat |
| swift slot='speed' | NativeStatKeys 没有 speed 槽，有 equipment 槽 | 映射 equipment；loot 来源 more≥−4000，最终速度仍走底座25…400，不能把“60 tick”当所有基底通用下限 |
| ring-implicit | 装配已写原生 ring.enchantment，nativeRows/nativeBase 再读取 | 草稿 implicit 不再次输出修正；已知比较按戒指知识投影 |
| growth.attribute:<id> / growth.attributes.v1 | 两者当前均未提供；growth.public-character.v1 只给等级/身份 | 先提供正式可选能力和无环属性映射，否则 adept 走 titan fallback；禁止读取 growth 私有数据冒充可用 |
| combat 容量/恢复键 | COMBAT_STAT_KEYS 已有相应声明 | 从底座已注册键查询可用性，不靠“模块安装了”推定；缺键按 fallback |
| loot 来源 enchant≤10、减伤≥−50% | row budget 与最终 clamp 是不同机制 | 对 loot 来源先聚合限界，不把 growth/native 一起截断；最终 defense≤220 等才用 clamp |
| monsterScaling L0 increased | validateStatRows 不允许 owner=loot 对 native 键 layer=base | 用语义等价的 environment 来源或本地新增受控出生基础端口；不能让 dot 关闭 layer 校验 |

上述公式前基底/戒指点/能力发现缺口是 **6A1s 子步**，不是假定 5A2-S 已全覆盖。建议新增底座 `native.weapon-base-min/max`、`native.armor-base` 及戒指点聚合输入节点，宿主扩充固定 DAG 和真实伤害读点；模块只产行，不新增边。最终导出节点名/舍入顺序/力量惩罚、随机掷伤害是否取修正后区间必须经实现与固定向量冻结，6A0 不把它伪装成已存在 SDK。不得直接把 UI 的向下取整公式复制到另一个求值器。

装备/分解/强化等机械变更经 `markItemStatsDirty` 与现有物化 reconcile，降容钳制、升容不补；出生怪物倍率如需满血，要用明确的出生初始化安全点，不能借 loot 来源获得 growth 的 refill-delta 权限。5A2-S 全量重算对照、知情/未知 hypothetical、不污染活体/cache/RNG、同基底双戒来源分离是必验项。鉴定仅改知识时不改机械值，仍使 native 摘要失效；当前 ItemLoader 的 unconditional mark 必须区分。

## 8. 与 5A1 录像/存档的关系

- 当前录像已经是 v4：每条 event 的轻摘要域为 extensions/world5/actorActions（`src/engine/Core/RecordingV4.ts:15`），full 六域包括 native/knowledge/random。词缀留在原生 Item 图；唯一/过滤/分解计数留 loot state；不能再按旧 v3 的“4KiB×每命令”估算。
- `src/engine/Core/RecordingDigest.ts:20` 的 codecIdentity 包括 whole-run/foundation/origin；Item.moduleData 应自然进入 native 域，新增 foundation 掉落生命周期状态进入 extensions/foundation 相应叶。每次接受变更需要通知相应 revision；known 翻转也不可漏摘要。不能只更新属性脏标记就认为录像已更新。
- `src/engine/Core/Game.ts:3724` 实际用 JSON.stringify + TextEncoder 发送 checkpoint bytes；`src/engine/Core/RecordingCheckpoint.ts:29` 解析完整世界再计算 full digest。探针采用相同编码步骤，不测 worker 传输/哈希成本。
- digestChunk=256，checkpointPeriod=2048；seek 快照总预算64 MiB、最多128（`src/engine/Core/RecordingV4.ts:98`，`src/engine/Core/RecordingFormat.ts:205`）。新增 Item 字节影响整局/周期快照与实际编码成本；不随每个轻摘要等量重复，但会降低可留周期快照数。不能因此省掉 seek/续录边界校验。
- plain snapshot、toSaveSnapshot 的 origin/prefix、录制初始 digest、周期 full、seek、存档续录、checkpoint worker 同步回退必须在6A1以中性带数据物品贯穿。校验错误发生在活局退休前；缺模块/错误版本严格拒绝，不剥离 moduleData 继续玩。

## 9. 版本计划与停点

| 身份 | 当前实值 | 6A1/6B 计划 |
| --- | --- | --- |
| foundation | 13 | C6 注册/掉落持久状态与 stats 接口统一升号，由集成人分配；不预占14 |
| whole-run / schema | 6 / brogue-web-whole-run-v6 | 新 Item 字段与编码合同需升号；同批更新 WholeRunSnapshot/RecordingDigest/RecordingFormat/worker/类型与身份守卫 |
| recording envelope | 4 | 如果 event/header结构不变可留4，但 codec 指向新 whole-run/foundation；结构变更再升；旧 codec 仍拒绝 |
| origin | 2 | 无前缀/输入状态结构变化可留2；必须跟新 header身份，不能接续旧规则 |
| world5 schema / WorldWork SDK / edible SDK | 4 / 1 / 1 | C6不改变其格式时保持；固定装配内部复用不扩大旧冻结 SDK |
| C6 SDK | 不存在 | 候选 v1；6A1验收后填导出文件清单与SHA-256 |
| loot module/rules | 远端0.1.1惰性包，本树未安装 | 接线改变行为与state，module/rules同步升级、state显式版本；不把纯包0.1.1当集成身份 |
| 有效目录 | 由pack+availability构建 | 静态包指纹、预设configuration、能力规范排序一起保护；任一机械变化拒旧档 |

所有改号与生成/trace变化在6A1做单变量归因、原方法重录、逐叶登记；6A0不改版本/黄金/测试清单。合同审查后可进入报告所列6A1子步；**不能据本合同直接派发可玩6B1或宣称阶段6底座验收完成**。
