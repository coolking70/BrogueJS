# 6B1 任务单：将 loot 原型接入 6A1 物品 SDK

> 2026-10-15。目标分支 `ext/phase6`，编写基线 **`b2702ffd4da8004e796631315eff08dd8e81f1b0`**（6A1 物品 SDK 与两轮审查修复已合入）。原型输入固定 **`93523fc596b173396a0d526ab2073b327ff7cf3e`**（`ext/phase6-loot-core`），不随分支后续移动。
>
> 2026-10-15 维护者授权实施：在 `ext/phase6`、HEAD `26aaaf3` 按第4节完整实施，第7节 B1-D1～D6 全部采用 A；测试遵守第6节瘦身策略，不 commit/push。需额外裁定且无法按推荐推进的事项记入报告并继续其余部分。

## 1 依据、基线与迁移结论

开工先读根 `AGENTS.md`、[HANDOFF](../HANDOFF.md)、[开发指南](../development.md)、[架构](../architecture.md)，再读 [C6-1 合同](phase6a-contract.md)、[6A0 报告](phase6a0.report.md)、[6A1 任务书](phase6a1.task.md)、[6A1 报告](phase6a1.report.md)、[SDK 清单](phase6a1.sdk-manifest.json) 与 [ext 当前测试政策](README.md#扩展分支测试门禁政策2026-10-13-即日生效)。

原型文档用 `git show 93523fc:<路径>` 读取；提交历史用 `git log ext/phase6-loot-core -- <路径>` 查看，不 checkout、不整体合并该分支。必读输入如下，历史报告保持原有时间和验证范围：

| 固定提交中的路径（均在 `docs/ext/`） | 本步用途 |
| --- | --- |
| `phase6-loot.md`，尤其 §13 | 阶段边界：6B1 核心接入、6B2 完整 UI、6B3 强化/符文、6C 后续系统 |
| `phase6-loot-numbers.md`、`phase6-loot-tuning.md`、`phase6b1a-v11.task.md` | 已批准 v1.1 数值与 M1–M4 裁定 |
| `loot-core-contract.md`、`phase6b1a.dot-package.md` | 稳定实例、纯函数、抽取次序与待替换临时接口 |
| `phase6b1a.report.md`，尤其 §13；`evidence/phase6b1a-loot-stats.json` | 最终 v1.1 统计、固定向量、校验结论与未接入范围 |
| `loot-ui-contract.md`、`phase6b1b.dot-package.md`、`phase6b1b.report.md` | 已知投影、纯展示组件、真实种子夹具与临时比较公式 |
| `phase6b1b.acceptance.md` | 最晚独立验收；F-01/F-02 已修，**F-03（S2）必须在本步修复** |
| `evidence/phase6-loot-tuning-v1.1-stats.json` | 调参实验历史；不是最终统计，不覆盖 `phase6b1a.report.md` §13 的最终证据 |

优先级：本次维护者明确范围/测试瘦身要求 → 已批准 v1.1 与 C6-D1–D6 → 6A1 实际导出及最终修复 → 原型中未被覆盖的合同。不能用旧设计的 26 词缀/6 唯一、旧预设名、旧倍率、recording v3 或“还未批准数值”覆盖现值。6A1 文档中“未 commit／待合入／不派发”的历史停点已由本次指定 `b2702ff` 合入事实更新；不回头要求再次完成 6A1。

### 1.1 应继承的事实，不得扩大为新验收结论

- 原型 0.1.1 是惰性规则包：`defaultEnabled=false`、state 为 `{}`，没有真实掉落、属性、命令接线；β 组件未挂载。迁移必须产生新的集成身份，不能仅复制 descriptor 后宣称完成。
- 已批准内容为 **33 个非符文词缀、21 个符文变体数据、8 件唯一品**；三预设 `scarce/standard/bountiful`；遭遇唯一乘数 **5000/10000/5000 bp**；warding 仅护甲；丰饶 elite 保留 1–3。随机符文族、T7、套装/符文之语仍未开放，唯一品固定符文行保留。
- 原型机械包指纹为 `sha256:7785d8e68e6486bd422e40c6a3f0d317b102683116dcea8e483f2256d9c84fd2`；全可选能力缺席的有效目录指纹为 `sha256:ed86796fad38b1b7995aa94fb1ee4641a8d366e5c8f41c84295d206e9a1aa45c`。它们是迁移对照值，不等于新运行规则身份。
- v1.1 纯核心历史门禁为 10 文件/335 项；最终 β 验收为 loot 18 文件/627 项。v1.1 统计为 300 局×3 预设、430730 事件/157252 件、0 校验失败、最大单件/事件抽取 33/88，余 14 项标记（3A/11D）。这些是纯生成器与模型结果，不能称真实游戏掉率或平衡已验。M4 真实力量、武器强度与怪物倍率平衡验证仍留 6B2/后续游玩，不在本步改目标或压低词缀。
- β F-01 预设确认按钮冒泡、F-02 预览硬编码文本已在 `93523fc` 修复；必须迁入修复和回归。F-03 未修；浏览器布局/触控/像素验收未完成，312 框静态预览不算真实浏览器通过。
- 6A1 已具备中性 fixture 的全链与回滚验证；最终身份为 **foundation15 / whole-run7 / recording4 / origin2 / world5 schema4 / worldSdk1 / edibleSdk1 / itemSdk1**。SDK 清单以报告末尾 N1 修复后版本为准，闭包聚合 SHA-256 为 `eebf539720177aebbfe177e0769aa5b80a2d317731b37061b5ab0e44ceab12f5`。实际入口：`src/ext/itemSdk.ts`、`types.ts`、`stats.ts`、`descriptor.ts`；见证为 `src/ext/testing/itemHarness.ts` 与 `testing/fixtures/itemFixture/index.ts`。
- 6A1 冷查询/比较性能已在 R7 修复后达标，不能沿用首次超标作为未修缺陷；八件完整死亡事务包含大对象图 checkpoint，仍不能冒称单件纯生成 ≤1ms 已证明。既有 N2 七包长路线超时是原报告的限定性能遗留，不作为本步扩大测试或放宽新测试的理由。

## 2 目标、范围与非目标

**目标**：复用原型已验的核心算法、目录、已知投影和组件，在 6A1 公开 SDK 上形成真实的“建局选预设 → 自然掉落 → 拾取/装备并生效 → 鉴定 → 分解/碎片鉴定 → 当前版本存读、回放、seek、续录”核心闭环，并关闭比较行 F-03。启用 loot 后不再惰性；未启用、未安装时保持原生及其它模块路径。

### 2.1 实施范围

| 范围 | 允许交付与边界 |
| --- | --- |
| 模块迁移 | `src/ext/modules/loot/**`：数据/schema/生成器/经济纯函数、descriptor、显式版本 state、掉落/属性/命令/知识/展示适配、自有 locale、测试、夹具、工具及 `test-suites.json` |
| 最小展示 | C6 名称与前景色装饰、可信已知投影、真实属性比较读口；迁入 β 并修 F-03。推荐仅挂载模块自有的新局预设选择，完整详情/比较/分解/过滤面板留 6B2（§7 B1-D1） |
| 文档 | 后续实施更新 `loot-core-contract.md`、`loot-ui-contract.md`，写 `phase6b1.report.md`；保留固定输入文档/验收摘要的来源与历史身份。历史全文可继续通过固定 git blob 复核，不把过时报告改写成当前通过 |
| 登记 | 按真实归属维护模块清单；跨模块测试依赖登记到 `scripts/test-dependencies.json`，仅真实新增底座测试才改共享 `scripts/test-suites.json` |
| 底座缺口 | 先给出“公开接口缺口→最小复现→影响→候选补口”，由本地维护者处理（§7 B1-D4）。模块侧不得私引 `Game`/runtime 内部、写 Item、复制掉落服务或关闭守卫；共享改动单列、重新核对合同及散列 |

从固定输入按文件清单迁移，不整分支 merge/cherry-pick。原型同时包含 narrative 像素立绘、其它模块/历史共享文件；这些不属于 loot 接入，**不得带入或覆盖当前成果**。原型旧 foundation/配置/测试发现格式均按当前公开接口适配，不回退底座。单主笔串行形成停点；本文不派发子代理或 dot。

### 2.2 非目标

- 不重写已验生成算法、不重新调 v1.1 数值；不做 CE 源码/行为对照、逐骰 CE 一致性，不恢复已移除的 CE 测试入口。
- 不做开发存档兼容或迁移；不读取原型 `{}` state 后补默认值继续游戏。保留当前版本严格校验与版本/缺包拒绝。
- 不做 6B2 完整产品 UI、主题改版、角色来源面板或浏览器/真机矩阵；修 F-03 不是授权提前完成整套 UI。
- 不做 6B3 强化等级/符文强度重塑、随机符文族、6C 套装/插槽/符文之语/工位、`part/craft/site` 来源、扩背包/加装备槽。没有接线的命令不注册为空成功。
- 不发布 growth 属性能力、不改 giants 私有状态，不改 crafting/settlement/foraging/narrative 玩法；不增加 npm 依赖，不做全项目性能工程。
- 不运行完整 npm/test:ext/drift、全启用组合或单删/单留矩阵；本步门禁仅按 §6。完成后交报告停下，不自动 commit/push、合 main、打标签或开下一步。

## 3 必须保持的接入合同

### 3.1 数据、身份与可选能力

1. `Item.moduleData.loot` 是 `LootItemDataV1` 唯一实例真相；保持 `v:1`、`corrupted`、词缀/固定行顺序、`nameParts` 与原稳定 ID。不得另存全量物品镜像到 module state 或塞入 `worldItem`。实例仍≤6 随机词缀/≤8 唯一固定行，quantity=1、不堆叠。
2. owner validator 复用 `validateLootItemData`，再对 detached `ItemFacts` 校验基底/类别/数量/知识等跨字段关系。保持 4 owner、单 owner≤4KiB、总 moduleData≤8KiB、深度≤16；loot state 紧凑 UTF-8≤4KiB。出生武/甲 +0 不等于读档永远 +0；原生强化后、腐化后解咒、否定后的合法实例均须可保存，不强制回写出生值。
3. 用显式 state 版本、预设、初始化标记、命令 revision、紧凑唯一收据与遭遇 watermark；不保存无限事件 key 历史。`settle` 只按实际 `DropAcceptance.newUniqueIds` 更新收据，分解不退收据。SDK 未向 roll 暴露宿主位图：模块用于纯生成请求的收据投影须来自同事务 acceptance，并与宿主记账一致；不得私读 `foundation.itemDrops`。
4. 有效目录来自静态 pack + 规范化真实 availability。combat 按 `foundation.stats.v1` 的已注册键；giants 按 `foundation.item-encounters.v1` 的公开 form 声明；`growth.attributes.v1` 当前 unavailable，**adept→titan**，不凭安装名假定能力。缺失 fallback/omit 与权重合并沿原核心。
5. manifest configuration 与恰一次 `create` 的 preset 一致，默认推荐 standard、模块默认关闭。静态机械包、有效能力指纹与预设均纳入可校验规则身份；locale 不入机械指纹。开局、load、replay/seek 重建同一目录，能力身份不同必须拒绝，不用当前默认目录静默替换旧目录。核实配置在首层掉落之前生效，不能先用 standard 生成再改成所选预设。

### 3.2 掉落与固定装配

- 注册 C6 `itemDrops` 四来源，可信 `DropEvent` 转 `LootRollRequest`；玩家寻宝值在宿主事件开始时捕获，整个多件事件使用同一值。继续使用 `rollLoot` 的完整请求先验、闭区间随机、单候选不抽与金币最后抽取。
- **随机分桶必须实际接通。** 原型 `CountedLootRandom.beginItem()` 仅内部计数，不会通知 C6 `beginItem(index)`。允许给纯包加不抽骰的分段通知适配，保持原随机 tape 和结果；明确事件前置骰、首件、后续件与金币的桶归属。SDK 桶0已有前置骰时不能再次 `beginItem(0)` 重置，后续按1…7单调推进，金币用8；保留纯包每件64/事件512及宿主预算。不能整个事件只占桶0，也不能先 roll 一遍探测边界再重抽。
- `LootGeneratedItem` 映射为 `DropItemSpec`：全26基底沿宿主固定装配，武/甲出生0，戒指 implicit/唯一覆盖只生效一次，熟悉度用 `familiarityThresholds`，不调用随机原生 spawn 后覆盖。`runicStrength` 不是可写原生字段；固定唯一 `runicType` 可装配，完整强度效果仍留6B3。
- 将每件 `data.uniqueId` 映射到平行 `uniqueIds`，不能把纯包 `newUniqueIds` 整批当已落地收据。至多8件装备+1金币根；接纳按8192机械根（C5新增材料7168策略不改）。部分接受/全跳过保留已抽骰；跳过唯一不记账、未来可掉；消费遭遇即推进 watermark，load/seek/重访不补发。
- floor 沿 SDK 投掷分流；vault 保留6A1最终修复的一次原生 kind 资格/回退候选语义。任何已定义 qualifiers（包括 `[]`）完整原生回退，不拓宽 highValue 转换、不循环重试唯一。无深度场景不伪造 depth=1。
- kill 使用宿主统一终结安全点，任何击杀者均可，但盟友死者/行政清除/独立克隆/召唤副本/无奖励主体排除；携带物→loot→死亡DF次序不变。giants 可信 split 子体继承遭遇资格但无独立 kill 奖励，最后主体终结只结算一次；失格向剩余主体传播。
- 提案/validator/settle/后续结算异常必须沿6A1外层完整回滚，包括世界/双流/ID/收据/金币计量/物化/缓存/消息。不得把异常伪装为正常无掉落，或以模块 state 回滚代替宿主事务。

### 3.3 属性与已知比较

`LootModifierDraft` 必须显式适配 `StatModifierRow`，不作类型强转；声明 `itemPolicy:'C6-1'`，来源使用 `loot.item.<实体ID>.*` 合法 ID，双戒独立，未知词缀机械生效但 `known=false`。

| 原型语义 | 6A1 接入要求 |
| --- | --- |
| keen/brutal、reinforced/plated | 用 `native.weapon-base-min/max`、`native.armor-base` 公式前节点；本件 flat→local increased→floor，再走附魔/力量/穿戴；护甲显示点×10 |
| 武/甲附魔、符文强度单位 | 整附魔→quarter ×4；不叠加两份原生默认强度，未完成6B3部分明确标记限制 |
| mending / shadow / noisy / radiant / seeker | 分别接 regeneration-bonus、stealth-points、light-points、awareness；感知×20一次，负潜行/零光规则由底座处理，不直改最终范围/倍率 |
| ring implicit | 固定装配的原生 enchantment 已承载，禁止草稿再加一份 |
| swift / caps | speed 草稿映射 equipment 槽；loot owner 聚合预算与最终 clamp 分开，不能截断 growth/native 来源；每件24行、既有owner/总行预算保持 |
| monsterScaling | 推荐本步按已批准曲线接真实怪物 environment 来源和可信出生满血初始化，之后升容不补、降容钳制；不借 base/refill-delta 越权（§7 B1-D3） |
| 比较 | 真实候选用 `hypothetical(..., knownOnly=true)`，四槽同源投影，双戒各列；禁止 β 临时基础公式成为真实机械结果。条件收益独立标明，不冒充无条件总收益 |

实际求值、已知比较、全量重算对照、缓存失效须一致。collect/query/name/appearance/比较不能揭示知识、开启事务、写脏标记或抽随机数。

### 3.4 命令、知识与展示

所有玩家写入经 `executeCommand('ext:command', JSON.stringify({module:'loot',action,payload}))`；原生卷轴经 `executeItemCommand`。使用 `itemCommands` 的纯 prepare/宿主提交，不再注册同名自由写 commands。

| action | payload / 行为 | 成本 |
| --- | --- | --- |
| `create` | `{v:1,presetId}`，只初始化一次，与 manifest 一致，局中不可换预设 | 0 tick，记录初始命令 |
| `set-filter` | `{v:1,revision,minRarity,classes,autoPickupGold}`，严格字段/类别，规范去重排序；自动拾取服从过滤，显式拾取可越过 | 0 tick，仍录像 |
| `salvage` | `{v:1,revision,itemIds}`，1–26互异背包ID，装备中/粘装拒绝；调用原 `salvageYield`，按候选背包容量预检 | 每件100 tick，整单原子 |
| `identify-shards` | `{v:1,revision,itemId}`，消耗10个 `loot.shard`，鉴定整件与应学习的原生种类/符文 | 100 tick，消耗与揭示原子 |

`loot.shard` 通过 C5 `worldDefinitions.items` 注册 MATERIAL，stack99、无 moduleData，可多堆；不造新材料系统。唯一品**允许分解、事前 Yes/No 警告、收据不返还**，此为已批准 C6-D4，不再提请选择。非法/陈旧/CAS失效/No/失败整单0成本；确认与拒绝记录沿现有录像语义。

鉴定复用 `itemKnowledge` 和宿主同步：卷轴、熟悉度、碎片、否定后的种类/实例区别均保持6A1两轮修复。否定后种类未知戒指仍可选鉴定；存读后亦然。首次触发揭示需明确“词缀→真实结算事实→受控入口”（§7 B1-D5），不得在 collect 或 getter 中首次揭示。

`itemPresentation.project` 可在可信边界读取 raw；name/appearance/组件仅接已知 DTO。扩充 β 的 location 为 floor/pack/equipped/container，不把箱内物品伪装成背包。保守 floor getter、未知戒指 baseId 隐藏、未知行仅位置、未鉴定专名/词缀/物等隔离、无可靠诅咒暴露事实时 false、幻觉/记忆不查询真实稀有度。保留原 glyph 与铭文，C6 前景 token 显式映射，玩家文本全部 i18n。

## 4 分步交付与停点

| 步骤 | 交付 | 进入下一步的条件 |
| --- | --- | --- |
| B1-1 迁移盘点 | 实际HEAD/SDK核对；原型逐文件“迁入/适配/不迁”清单；迁入纯核心、β及已修回归，保留数值/固定向量 | 无 narrative/旧底座混入；报告区分纯包历史验收与当前待验，§7影响范围的决定已登记 |
| B1-2 模块与目录 | 当前descriptor、runConfiguration、显式state/validator、有效能力目录/指纹、一次create、碎片定义 | 三预设一致性/缺能力fallback/未知字段与身份拒绝通过；首层已用所选配置 |
| B1-3 掉落接入 | 四来源provider、分桶桥、固定装配提案、accepted唯一收据/watermark | 原向量/随机顺序保持；真实宿主成功、部分接纳、跳过与异常回滚分开验证 |
| B1-4 属性与命令 | 词缀真实属性、批准怪物曲线（按裁定）、过滤/分解/碎片鉴定、原生知识接线 | 真实装备值与hypothetical一致；知识不泄露；成本/CAS/确认/失败原子性通过 |
| B1-5 展示适配与S2 | C6只读装饰、container投影、真实比较适配、F-03 DTO/组件/i18n/回归；最小新局UI按裁定 | F-01/F-02不回归；F-03在公开DTO及渲染文本中关闭，不仅内部key正确 |
| B1-6 集成验收与报告 | 当前loot真实命令生命周期、限定门禁、静态依赖+全删1行、最终身份/差量/遗留报告 | §5逐项有证据；未验证项与后续6B2/6B3/6C清楚列出；完成即停 |

每步在同一份后续 `docs/ext/phase6b1.report.md` 更新结果和失败修复，不把中间停点当发布。发现SDK不足先收敛最小缺口；不得为了完成模块在本地复制引擎私有逻辑。

## 5 验收条件

### 5.1 必修 S2：F-03 装备比较缺目标条件/符文名称

来源为固定输入 `phase6b1b.acceptance.md` 的 F-03，定位为原 `ui/viewModel.ts:248`、`ui/types.ts:86`、`ui/LootComparePanel.vue:32`（实施以符号为准）。

1. 用原真实夹具 **R08（seed 146/0）**：全部揭示、pack、standard、比较空武器槽。旧行“物理伤害 +89.73%”缺 `body.large` 的“对大型目标”。修复后条件必须贯穿公开比较行 DTO→视图模型→组件→本地化文本，不得把该收益合并为全目标收益。
2. 用 **R12（seed 707/0）** 同样流程：force 行旧显示“符文强度 8”，必须同时显示其本地化符文名称，不能仅显示通用属性标签或裸 `force` ID。
3. 给 `LootCompareRowView` 明确增加 condition/runic 文本引用（可选或显式null约定须同步合同）；保留按条件、符文区分的稳定聚合身份。禁止组件解析key、临时拼字符串掩盖DTO丢字段。
4. 新增回归先在原型复现，再验证已知条件/不同符文不混行；部分已知/未知不暴露隐藏条件、符文、值或sourceId。更新必要组件快照，保留独立文本断言；核对窄容器布局规则。旧89.73%/8是复现锚点，接真实管线后的差值按实际求值验证，不强迫临时公式数值成为新神谕。
5. 即使完整比较面板留6B2，本步也必须交付DTO/模型/组件修复及回归；不得继续把F-03登记为“接线前再修”。组件测试不冒称浏览器像素验收。

### 5.2 核心接入通过标准

| 编号 | 必须证明的结果 |
| --- | --- |
| A1 输入忠实 | 16份原型规则文件/ID/数组顺序和v1.1批准值可追溯；26条固定tape及schema/非法输入零RNG等相关回归保持。适配新增分桶不改纯算法输出；纯包原指纹与新集成身份分列 |
| A2 身份/状态 | 三预设首层配置一致；重复create/配置不符拒绝；当前有效目录/收据/state预算及非法输入有负例；locale不改变机械指纹；缺能力fallback不读私有模块数据 |
| A3 掉落 | 真实floor、普通kill、受限vault与giants encounter路径；普通死亡不双掉，split/lost/load/重访不重发；事件冻结寻宝、金币次序、分桶与预算可核对 |
| A4 接纳/回滚 | 满根、无落点、部分接受/全跳过、跳过唯一未来再掉；异常恢复完整状态、双流/ID/收据，而正常跳过保骰。原6A1差分回滚保护不弱化 |
| A5 机械生效 | 武/甲/双戒、同基底双戒、力量不足、本地平加/百分比、单位、ring implicit一次、loot预算与其它来源隔离；未知机械生效且已知比较不计隐藏项；装备/卸装后物化与缓存正确 |
| A6 操作经济 | 真正公开命令完成过滤、单件/批量分解、唯一No/Yes、10片鉴定；多堆/满背包/装备中/粘装/陈旧/篡改/确认期间目标变化与晚失败均无部分提交 |
| A7 知识展示 | 原生卷轴/熟悉度/碎片/否定→再鉴定及存读后行为正确；已知投影、名称/铭文、四位置、未知戒指、侦测/腐化、幻觉/记忆无泄露；重复显示/比较不改变完整状态与双流；F-03关闭 |
| A8 真实生命周期 | 至少一条记录种子与命令的自然击杀→掉落→拾取→装备/生效→鉴定→分解/碎片鉴定链，经save/load、逐事件replay零OOS、seek与续录一致；另以当前loot覆盖256摘要/2048周期checkpoint。不能用手塞moduleData或旧c6fixture结果冒充自然loot链 |
| A9 缺包/可删除 | 正常树静态依赖合法；唯一全删副本确无全部可选模块目录，所有权/发现器正确，限定门禁与全关生命周期通过；当前候选真实loot存档/录像在缺包环境明确拒绝、保活局，不只因旧codec提前失败 |
| A10 关闭范围 | 源码身份、实际命令/exit/数量、首败/修复、API差量、未验项齐全；不宣称历史统计等于游戏平衡、不宣称静态UI等于浏览器通过、不宣称阶段6全面完成 |

## 6 测试策略：本步按 ext 瘦身执行

本节是本任务专用门禁，覆盖旧 `development.md`、6A0/6A1任务书、原型任务中的冲突安排。**仅相关测试 + boundary/静态测试依赖 + vue-tsc + build；可删除性仅静态依赖检查与一行全移除。** 不把被删减的大套件暗中搬进工具脚本。

### 6.1 正常树限定检查

使用现有Node24环境、`NODE_OPTIONS=--max-old-space-size=3072`，每批 `--maxWorkers=2`，批次串行；不新增依赖。先由发现器确认实际归属，在报告列出最终明确文件列表。相关检查示意：

```sh
node scripts/test-discovery.mjs
node scripts/check-module-boundaries.mjs
node scripts/check-test-dependencies.mjs
node node_modules/vitest/vitest.mjs run src/ext/modules/loot/tests --maxWorkers=2
node node_modules/vue-tsc/bin/vue-tsc.js -b
npm run build
```

- loot 包内原核心、β与新接入测试均属直接相关；将旧“启用loot仍惰性”历史前提更新为本步真实启用合同，同时保留未启用/未安装的中性回归、纯展示无副作用和preview不入生产构建保护，不能整删惰性测试来掩盖默认行为变化。
- 底座优先复用 `src/test/ext_item_{data,drop,stats,commands,presentation,roots,recording}.test.ts` 中直接相关文件；若改共享实现，再按实际影响选择原stats、鉴定、generation差分/录像测试。i18n、硬编码、测试归属/边界与SFC等守卫按触达范围定向运行。**不照抄6A1的42文件批次、不重跑整个narrative或阶段5长路线。**
- 模块内普通测试只依赖自身与公开底座；真实giants/combat等跨模块用例声明实际依赖。正常树齐包时执行原断言；物理缺依赖仅按现有声明机制具名跳过并报告，不能以optional掩盖静态私引或正常树失败。
- 只保留少量有直接因果的真实Game场景：loot单开、loot+combat、loot+giants（含split/lost），以及能力缺席/当前growth仍无属性能力。容器/材料联动按触达补一个相关场景；不是穷举启用子集。无loot对照比较本项目自身状态/RNG，不是CE对照。
- 同一版本存读/replay/seek/续录、坏档/缺包拒绝、预算和回滚必须保留。旧格式直接拒绝，不开发迁移，不维护旧格式可读可播测试。纯格式黄金原法重录、说明版本原因，无需反事实/逐叶归因；混有玩法/RNG或未知变化先查清，不能套用纯格式豁免。过时前提最小调整并说明；断言语义改变按ext政策做反事实，不放宽守卫、容差或超时。
- 原型统计结论作为固定输入迁移，不自动重跑300局统计、2000件体积或整套性能探针。算法/数值若发生必要差异，先记录原因并补最小定向证据；调参和扩大测量另由维护者安排。

**本步不运行** `ce:fetch`、`test:full`、`test:gen`、完整 `npm test`、全部 `test:ext`、完整 `test:drift`、正常树128/256组合、单删/单留/发布矩阵、浏览器/真机或长局性能大套件。需要的确定性/生成回归从相关文件定向选择，不恢复CE依赖。阶段6后续门禁另行安排，本文不预先承诺全量结果。

### 6.2 一行全移除，必须是真实物理删除

在仓库外隔离副本删除**发现器列出的全部可选模块目录（含新loot）**，不在工作树删除，不留空壳、不改共享导入白名单；前后核对目录所有权、测试发现差量和源树散列。八模块是预计安装数，不是硬编码矩阵维度。

当前 `scripts/check-module-removal.mjs` 默认执行全部剩余 `test:ext`，超出本任务范围。可使用其已有准备模式生成唯一全删副本：

```sh
node scripts/check-module-removal.mjs --profile=removal --retain=none --prepare-only --engine-only --output=/private/tmp/phase6b1-all-removed-UNIQUE
```

执行前将 `UNIQUE` 换为本轮唯一标识；从输出读取 `temporaryCopy`，**准备成功只算 prepared-not-verified**。随后仅在该副本执行 boundary、静态测试依赖、vue-tsc、build、本步直接相关且剩余可运行测试、一次全关引擎生命周期及真实缺包输入拒绝。当前版本缺包输入须在完整候选用实际loot命令导出后交给副本，不手改manifest或拿原型旧档充数。缺包拒绝须验证原局、双流/ID及录像状态保持。

保存独立的小型结果摘要，将“准备结果”与“实际限定验收结果”分列；不篡改脚本的全量通过字段。不得误跑默认全移除runner里的全部 `test:ext` 或正常组合smoke；无需修改共享runner来满足本文。只这一行全删，不追加单删/单留、release-matrix或全开/全关重复布局。

## 7 维护者裁定（2026-10-15，B1-D1～D6 全部采用 A）

维护者已明确裁定以下六项全部采用推荐选项 A，授权本地主笔串行实施并记录结果，无需中途再次确认。数值v1.1、唯一分解、费用、四槽、缺能力fallback、S2必修、测试瘦身保持已定。下表保留原选项作为裁定依据；所有行的生效选择均为 A。

| 编号 | 待定问题 / 选项 | 推荐与理由 |
| --- | --- | --- |
| B1-D1 UI接入到哪里 | A 最小新局预设选择+C6装饰/已知读口+β迁移与F-03修复；B 同步挂载详情/比较/过滤/分解全部面板；C 全部挂载留6B2，6B1只用程序化配置 | **A**。兑现新局选预设，核心命令可由真实Game验收；完整游戏UI仍留6B2。预设选择必须同时落实manifest与initialCommand，不能仅改组件返回值；若现有creation流程不足按D4补口 |
| B1-D2 集成版本与默认 | A module/rules建议0.2.0，显式state `v:1`，defaultEnabled=false/default preset=standard；B 采用维护者统一版本号或改变默认启用策略 | **A**。与惰性0.1.1明确区分；静态规则文件schema不因无关状态字段盲升。foundation/whole-run/recording/origin默认沿15/7/4/2，确有共享协议变化才由维护者统一升号并拒旧，不迁移 |
| B1-D3 怪物倍率接入时点 | A 本步接已批准monsterScaling原曲线，M4重新平衡留6B2；B 本步只接装备属性，倍率也后置 | **A**。避免只上线装备膨胀却遗漏已设计的怪物侧数值；使用6A1环境来源/出生初始化，不另改曲线，不把本步正确性验证称平衡验收 |
| B1-D4 SDK实际缺口的处理范围 | A 允许本地主笔做有最小复现的通用窄补口并单列审阅/定向回归；B 严格模块目录，遇缺口暂停对应接线，先交补口清单 | **A**。重点核对有效目录身份初始化、首次触发知识、真实比较与新局配置桥；不得借此全面解冻SDK。模块代码仍不得越权，worldSdk/edibleSdk冻结保持；有导出变化更新合同与新散列 |
| B1-D5 首次触发揭示覆盖 | A 本步列明并接通已有可靠结算事实的适用词缀，缺真实端口者列具体缺口；B 所有触发揭示后置，仅支持卷轴/熟悉度/碎片/否定 | **A**。保留已批准鉴定方向，但不能臆造事件或在查询中写状态；逐项列明已接/待补，无法完成者由维护者明确收窄范围，不能静默宣称全部触发生效 |
| B1-D6 历史材料的落盘方式 | A 迁入运行所需loot文件与核心/UI合同，当前报告记录固定提交和验收摘要；历史长报告/统计仍按git blob引用；B 同时复制整套loot历史文档/小型统计 | **A**。保留可追溯结论，避免把旧路径链接与过时门禁当现行规格；无论选择哪项都排除narrative资产与其它模块代码，原始截图/大证据不入库 |

## 8 后续交付报告要求

后续交付代码/相关测试、更新后的两个loot合同与 `docs/ext/phase6b1.report.md`，不提交。报告至少包括：

- 开工HEAD、固定原型提交、最终候选源码身份；迁入/适配/排除文件清单及§7裁定，显式说明未整体合并原型分支。
- 原型稳定合同→6A1实际API→模块适配→验收用例对应表；随机分桶、accepted收据、有效目录身份、单位/公式/sourceId、命令revision/CAS与知识同步逐项落地。
- 当前版本表、state字段/预算、新规则身份与原纯包指纹的区别；共享补口/导出散列、必要U03/摘要登记。无共享变化则明确保持，不把旧报告候选hash当新源码hash。
- F-03复现与修复证据，F-01/F-02回归结果；原型14项统计标记、M4、固定符文强度限制、浏览器待验及实际触发揭示范围分别交接。
- 真实自然链的种子/命令/模块配置、当前存读/replay/seek/续录和拒绝保活局证据；每批实际命令、exit、通过/失败/声明跳过/未选/todo/unhandled、耗时与首败修复，不重叠累加或引用旧报告冒充本轮通过。
- 全删一行的副本/物理删除/发现器所有权、限定检查结果、当前版本缺包拒绝，准备模式与实际执行分列；未跑的全量/组合/浏览器明确标未验证。

只提交可复现说明和小型摘要，原始日志/快照/截图放仓外 `/private/tmp/phase6b1-*`，不提交大于1MiB的原始证据、不产生CRLF。完成上述范围即交维护者审阅，不自动扩展到6B2/6B3/6C或发布。
