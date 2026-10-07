# 5G dot 任务包：独立 `foraging` 内容模块（野外采食，整包一次派发）

> 状态：**派发草稿，未派发**（2026-10-07，分支 `ext/phase5-design`）。由 Claude 依据已批准的[野外采食设计稿](phase5-foraging.md)（§16 裁定 Q1–Q11=A、Q12=B）、[5A4 任务书](phase5a4.task.md)（E1–E30 已签认，附录设计缺口按建议处理）与 5A4 本地实现（`ext/phase5` 未提交工作树 + 审查修复轮进行中；`phase5a4.report.md` §7“5G 冻结清单”、`phase5a4.review-findings.md`）编写；格式沿用[5B dot 任务包](phase5b.dot-package.md)定稿版。
>
> 维护者规则（2026-10-06/07，本包强制）：每种菌**恰好一个**特性；全部未鉴定外观名与已知名必须**纯奇幻**，不得描述或令人联想任何真实蘑菇——审阅过的固定名单 + 禁用词测试；篝火/灶台烤制首版即做；临时力量；玩家着火瞬间背包菌各 1/3 概率火接触；同伴长期饥饿**离队不死亡**；营地食物经济**不在本包**（归 settlement 5D）。
>
> 本包按 5A4 当前工作树的 `src/ext/edibleSdk.ts` 实际导出编写。SDK 可能在修复轮中小幅变化，因此 **§A 列出派发前须由维护者逐项复核的全部名称与语义**；任何差异由维护者一次性改入本文，dot 不负责猜测。§12.3 是本包自行决定、需维护者签认的事项，签认前不得派发。

---

## 0 转贴给 dot 的提示块（维护者复制此块）

```text
你是 BrogueJS 扩展原型的 5G 执行者。任务：在独立模块目录 src/ext/modules/foraging/ 内实现完整的 foraging（野外采食：未知菌类、烤制、爆燃菌、同伴饥饿与喂食）内容模块，一次长块独立开发直到完成全部交付，期间不要向维护者提问。

基线与分支：
- git fetch origin && git switch -c ext/phase5g origin/ext/phase5g-base
- 该 tip = 代码基线 <BASE_COMMIT>（ext/phase5：5A1–5A4 含审查修复，FOUNDATION_PROTOCOL=<FOUNDATION_PROTOCOL>，EDIBLE_SDK_VERSION=1，worldSdk 1）+ 定稿提交（只改 docs/ext/phase5g.dot-package.md）。开工先确认 `git diff --stat <BASE_COMMIT> HEAD` 只列出该文件、`git status` 干净。
- 只推 ext/phase5g；不推 ext/phase5、ext/phase5g-base、ext/foundation、main；不打 tag；不合并、不 rebase 任何分支。
- 本地可能并行开发 settlement（5C1，只写 src/ext/modules/settlement/**）。你只在下面允许的路径内工作，不碰任何共享文件；集成 rebase 与 trace 重跑由维护者完成。

唯一任务书：docs/ext/phase5g.dot-package.md（本提示与其冲突时以该文件为准；§A 是维护者已完成的核对记录，可作背景）。先读 AGENTS.md、docs/ext/README.md，再完整读该任务书；它引用的设计稿 docs/ext/phase5-foraging.md、5A4 任务书与 5A4 报告只作背景，数值、ID、文案、版本均以任务书为准；任务书与基线实际 SDK 冲突时以基线代码为准。

硬规则（详见任务书 §11）：
1. 只改 src/ext/modules/foraging/**、docs/ext/foraging-config.md、docs/ext/phase5g.report.md。其他任何文件（Game/引擎、src/ext/*.ts、src/ext/testing/**、src/ext/ui/**、src/ui/**、其他模块、scripts/**、package.json、配置、基线/trace、其他文档、共享 locale）一律不改。
2. 生产代码只可 import 任务书 §6.0 白名单（worldSdk、edibleSdk、stats 仅类型、types、descriptor、fingerprint、world 仅 import type、src/ext/ui/**、src/ui/**、vue、i18next 与模块自有文件）；不得 import src/engine/**、src/ext/testing/**、src/ext/structureTypes、src/data/**、其他模块。模块自带 foraging_imports 测试强制此白名单。
3. 不改任务书给定的 ID、数值、名单、文案名称、上限、版本号；名称池与已知名一个字都不改；不增加任务书非目标中的玩法（营地食物经济、厨师、粮仓一律不做）。
4. SDK 缺口/缺陷/与任务书不符：不绕过、不在模块里另造调度器或补丁，记入报告“SDK 问题清单”（含最小复现），其余工作继续推进。基线既有失败照实记录，不修共享脚本。
5. 遇到任务书未写明的细节，按任务书 §12.2 的裁决规则自行决定并在报告“自行决定事项”列出，不要停下来问。
6. 开发期每个里程碑只跑任务书 §9.1 的功能门禁；全部完成后跑一次 §9.2 收尾门禁。不跑完整 npm test、不跑全量删除矩阵、不跑 ce:fetch/test:full/test:gen。环境 Node 24.19.0、NODE_OPTIONS=--max-old-space-size=3072、vitest --maxWorkers=2。

交付：按任务书 §10 写 docs/ext/phase5g.report.md 与 docs/ext/foraging-config.md，按逻辑分若干提交推到 ext/phase5g，最后按任务书 §10.4 模板回复一段 ≤30 行的中文摘要。
```

---

## A 派发前维护者检查清单（派发前由维护者完成；dot 只作背景阅读，不需执行）

5A4 尚在审查修复轮（P1–P10，见 `phase5a4.review-findings.md`），本包按当前未提交工作树编写。合入后按下表逐项复核；**任一项实际值与本文不同，直接改入本文对应段落**，并在本节勾选。全部 ☑ 且 §12.3 签认后才可派发。

### A.1 占位符

| 占位符 | 预期 / 当前参考值（修复轮后可能变） | 复核方法 | 状态 |
| --- | --- | --- | --- |
| `<BASE_COMMIT>` | 5A4 合入 `ext/phase5` 的 commit；派发 tip = `origin/ext/phase5g-base`（该 commit + 仅本文件的定稿文档提交） | `git log`；`git diff --stat <BASE_COMMIT> origin/ext/phase5g-base` 只列本文件 | ☐ |
| `<FOUNDATION_PROTOCOL>` | **10**（预期） | `src/ext/descriptor.ts` `FOUNDATION_PROTOCOL` | ☐ |
| whole-run / 录像 / 来源 / IDB | 6 / 4 / 2 / 2 | 5A4 报告 §1 | ☐ |
| `EDIBLE_SDK_VERSION` | 1 | `src/ext/worldEdible.ts` | ☐ |
| `<INSTALLED_MODULES>` | 当前：combat、crafting、giants、growth、narrative（+ settlement 若已合入） | `ls src/ext/modules` | ☐ |
| `<MODULE_VERSIONS>` | 当前：growth 1.8.0、narrative 1.4.0、combat 1.6.0、giants 1.0.0、crafting 1.0.0 | 各 `definitions.ts` 版本常量 | ☐ |
| `<SUBSET_COUNT>` | 加入 foraging 后：6 模块 **64** 子集（有 settlement 则 7 模块 128） | 2^模块数 | ☐ |
| `<SHA256_worldSdk>` | 当前 `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343`（应不变） | `shasum -a 256` | ☐ |
| `<SHA256_edibleSdk>` | 当前 `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` | 同上 | ☐ |
| `<SHA256_worldEdible>` | 当前 `7f498298e12f1d7c5366b8e7cdce555b958350f89d51a90b737abafa55dc9e67` | 同上 | ☐ |
| `<SHA256_kindKnowledge>` | 当前 `4be5703961933f450fababbcb6f9f2d5d987ffd701e6f3e67d27cd27d90a184f` | 同上 | ☐ |
| `<SHA256_actorNeeds>` | 当前 `8e56c4a90e24424adf5fe443d9623c6474a59e5ef17763aa44981b9c1e3c333e` | 同上 | ☐ |
| `<SHA256_stats>` | 当前 `c80ae73f2e08c1f9e1dc8b34c7b63684244b4b24a47a4135f3ed5d8093302c84` | 同上 | ☐ |
| `<SHA256_worldHarness>` | 当前 `a3caff8906b22826814907f2f3fbecbadd8cd022e2bf4da8691fb475a684e9e0` | 同上 | ☐ |
| `<SHA256_forageHarness>` | 当前 `ea4b47e02fe0c967fb0867211d33894d3eeb59f0bec202462c3627417a316d38` | 同上 | ☐ |
| `<SHA256_fgfixture>` | `index.ts` 当前 `09ba885cae62b7d5d93b4e8260fa53138522adae1368f705844e922d0ea34779`；目录树聚合当前 `eeffa362037317f376218d48ced6aa590ff905ca1fa8fc9ccec8ec9f32a37e12`（5A4 报告 §7.1 算法） | 同上 | ☐ |

### A.2 名称与形状（本文按右列编写；须与合入代码逐字一致）

| # | 项目 | 本文依据（当前工作树） | 影响段落 | 核对 |
| --- | --- | --- | --- | --- |
| 1 | `edibleSdk.ts` 导出 | `export *` from `worldEdible`（`EDIBLE_SDK_VERSION`、`EdibleStatusId`、`EffectIntent`、`EdibleEffect`、`FireBehavior`、`EdibleItemDefinition`、`EdibleAction`、`FeedRequest`、`RoastRequest`、`EdiblePlanHandle`、`EdibleItemRead`、`FeedTargetRead`、`HeatSourceRead`、`EdibleContext`、`EdiblePrepareSDK`、`EdibleCommand`、`EffectOutcome`、`EdibleConsumedFact`、`EdibleTransaction`、`EdibleParticipant`、`FireContactCause`、`FireContactFact`）；`export type *` from `kindKnowledge`（`KindKnowledgeGroup`、`KindKnowledgeState`、`KindKnowledgeView`）与 `actorNeeds`（`ActorNeedDeclaration`、`ActorNeedFacts`、`NeedTrigger`、`NeedEventFact`、`NeedTransaction`、`ActorNeedParticipant`） | §6.0–6.6 | ☐ |
| 2 | `PlacementGroup` 类型 | **不在** edibleSdk，定义在可信 `structureTypes.ts`。本文令模块用 `type ForagingWorldPack = NonNullable<ExtensionModule['worldDefinitions']>` 与 `NonNullable<ForagingWorldPack['placementGroups']>[number]` 派生，不 import structureTypes。若修复轮把它加入 edibleSdk，改 §6.0 允许直接导入 | §6.0、§5.1 | ☐ |
| 3 | `ExtensionModule` 新字段 | `edibleCommands?: Partial<Record<'feed'\|'roast', EdibleCommand>>`、`edibleParticipant?`、`actorNeedParticipant?`；`hooks.actorDeparted: {actor: ActorFacts; owner; reason; deferred}`；`statSources?: StatSourceProvider`；`componentValidators?` | §6.2、§6.5 | ☐ |
| 4 | `ext:command` 分派次序 | `isEdibleCommand`（feed/roast）先于 `isWorldWorkCommand`（harvest）；信封严格键 `module,action,payload` | §6.3 | ☐ |
| 5 | feed/roast 请求对象 | `FeedRequest {targetId,targetRevision,itemId,inventoryStamp}`、`RoastRequest {heatSourceId,itemId,inventoryStamp}`，严格键、**无 `v`**；`targetRevision` = 需求行 revision | §6.3 | ☐ |
| 6 | `readEdibleContext()` 语义 | `inventory` 含本 owner 可食物品与原生口粮/芒果；`satiety` 非 known 时 null（原生 1800/1550）；`feedTargets` 为**本层直接可见**且带本 owner 需求行的全部生物（**不限相邻**，含离队中 `departing:true`）；`heatSources` 为可达（同层、可见、距离 ≤ 定义 interactionDistance、交互线）热源 | §6.3、§7.1 | ☐ |
| 7 | 投影读口 | `ExtensionProjectionContext.edible?: {readEdibleContext(); knowledge(groupId)}`，仅声明 E3 键的 owner；`nearbyInteractables` 的 `WorldInteractableView` 带可选 `displayName/displayDescription`（foundation 已按知识解析） | §7.1 | ☐ |
| 8 | `EdibleTransaction.message` / `NeedTransaction.message` | `message(key, params?)`；key 须属本 owner locale；params 为 string/number，由 foundation 用 i18next 插值。复核：是否允许 params 携带模块用 `i18next.t` 预翻译的名称串 | §6.4、§6.5 | ☐ |
| 9 | `markKnowledge` | 只本 owner 组成员；单调 `unknown→tasted→known`、`unknown→known`；回退/越组返回 false 不写；同一事务可写多行 | §6.4 | ☐ |
| 10 | `EffectOutcome` 字段 | `intent, applied, newlyStarted, immune, notApplicable, hpGained, satietyGained, satietyLost`；`EdibleConsumedFact` 含 `hpBefore, maxHp, visibleToPlayer, resolvedIntent, definitionId|null, nativeFood` | §6.4 | ☐ |
| 11 | `FireContactFact` | `result: transformed\|burned-up\|exploded\|destroyed`；`location: floor\|inventory`；`visibleToPlayer`；七种 cause | §6.4 | ☐ |
| 12 | 需求声明与事件 | `ActorNeedDeclaration` 字段与范围（max/ticksPerPoint ≤1000000、bands 1…8 首阈值=max 严格递减、deadline、departure grace 100 倍数）；`NeedEventFact.kind attached\|detached\|band\|deadline`、`reason ineligible\|death\|departed\|null`、`deferred`、`visibleToPlayer`；`NeedTransaction.setOwnComponent/removeOwnComponent/depart` | §5.7、§6.5 | ☐ |
| 13 | `ActorNeedFacts` | `actorId, monsterId, allied, inanimate, timedSummon, groupRole single\|core\|member`；`qualifies` 的 ctx 只有 `queryOptional` | §6.5 | ☐ |
| 14 | statSources 组件读法 | `StatSourceContext.getComponent(actorId, name)` 用**未限定**组件名（同 growth `'progression'`）；`setOwnComponent` 写入后同事务重算属性 | §6.5 | ☐ |
| 15 | 属性键与预算 | `native.strength` 物化键 flat；`native.accuracy` query、`native.physical-damage-dealt` pair query；query `increased` −9000…+50000 bp；temporary `more` 0…40000 bp（physical-damage-dealt `more` 下限 0） | §5.2、§6.5 | ☐ |
| 16 | 包校验上限 | 可食定义每 owner ≤128、maxStack 1…20、tags ≤16、satiety 0…2150；derived-choice 2…8 选项、ordinal 安全非负；transform 同 owner、无环、目标 maxStack ≥ 来源；knowledgeGroups 每 owner ≤8、kinds 1…32、pool kinds…64；placementGroups 每 owner ≤8、members 1…64、perDepth 不重叠、maxPerRun 0…512、preference tags ≤2 radius 0…8 权重 1…16；actorNeeds 每 owner ≤4；分组成员 placement 必须 `{dungeon:null,site:null}`；资源 yield 可引用同 owner 可食定义；`startupItems:null` 合法 | §5 | ☐ |
| 17 | 知识模板占位符 | `roasted`/`node` 恰一个 `{{name}}`；`called` 恰 `{{name}}`+`{{title}}`；`tastedNote/roastUnknownNote/unknownDetail` 无占位符 | §7.4 | ☐ |
| 18 | foundation locale 键 | `ext.foundation.edible.confirm.not_hungry/overfeed`、`ext.foundation.edible.satiety`、`ext.foundation.status.slumber(+_wake_player/_wake_monster)`；错误 `ext.foundation.world.error.<去 C5_ 小写>` | §7.4 | ☐ |
| 19 | 原生命令串 | 吃 `command('item:execute','eat|<letter>')`；扔 `'throw|<letter>'` 后 `command('mouse_travel',{x,y})`；起绰号 `'call|<letter>|<title>'`；确认经 harness `answers` | §8 | ☐ |
| 20 | harness | `createWorldHarness(options, overrides?)` 自动发现生产 foraging；`worldHarnessGame(h)`；`createForageHarness` 总会加入 `fgfixture`（foraging 测试默认不用它） | §8 | ☐ |

### A.3 行为与修复轮状态（本文假设右列；修复后不同则改正文）

| # | 问题 | 本文假设 | 影响 | 核对 |
| --- | --- | --- | --- | --- |
| 1 | 审查 P1：离队者攻击/多动/踩熔岩 | 已修：离队者不攻击、每回合至多一动、避开危险地形 | T-COMP 离队用例按此断言 | ☐ |
| 2 | 审查 P2：`qualifies` 抛错/非布尔 | 已修：视为 false + 诊断，不外抛 | §6.5“参与者绝不抛异常”仍要求 | ☐ |
| 3 | 审查 P3：在途同伴 nextDue 失效 | 已修 | T-COMP“落后同伴下楼后仍按时饥饿” | ☐ |
| 4 | 审查 P4：复活同伴重挂需求行 | 已修（`resurrectAlly` 触发 ally-gained，按 `initial` 1800） | T-COMP 复活用例 | ☐ |
| 5 | 审查 P5：DF 内部排空 | 已修（最外层排空） | T-FIRE 连锁顺序 | ☐ |
| 6 | 审查 P6：equip/drop 等原生消息泄露 nameKey | 已修（一律 displayName）；本包另以 §5.3 中性 nameKey 文本兜底，并由 T-LEAK 扫描日志 | §5.3、T-LEAK | ☐ |
| 7 | 审查 P9：组内 glyph/color/maxStack/tags 一致性校验 | 若加入：本包生菌全同、烤菌全同，已满足 | §5.3 | ☐ |
| 8 | 审查 P10：跨多档只发一次 band 事件 | 保持（模块按“当前档”处理，不假设逐档） | §6.5 | ☐ |
| 9 | 5A2 采集完成日志的名称来源 | 复核 `ext.foundation.world.message.completed` 用节点 nameKey 还是知识解析名；本包节点 nameKey 文本统一中性“菌丛”，两者都不泄露 | §5.4 | ☐ |
| 10 | 原生背包对可食物品提供 吃/扔/起绰号 | 是（foundation 负责；模块不加吃/扔入口） | §7.2 | ☐ |
| 11 | 热源识别 | combat 篝火（worldRest 绑定）与任何 owner 带 `station.hearth` 的工位（crafting 火炉）；未装提供方时 `heatSources` 空 | §6.3、T-ROAST | ☐ |
| 12 | `hooks.actorDeparted` 中可 `context.message` | 是（giants 在钩子中用 `context.message(i18next.t(...))` 先例） | §6.5 | ☐ |
| 13 | 自动发现 | catalog、`check-module-removal.mjs --plan --profile=removal --retain=…`、`scripts/test-discovery.mjs`、`check-module-boundaries.mjs`、composition smoke 自动发现 foraging（在仓库外副本放最小 foraging 实测，同 5B §A.3#9） | §9.2 | ☐ |
| 14 | 边界脚本对 foraging 的白名单 | 当前 `check-module-boundaries.mjs` 的严格白名单**只对 crafting**；对 foraging 只禁可信实现文件与跨模块。可选：维护者在派发基线把 crafting 规则推广到 foraging（含 edibleSdk、stats）；无论是否推广，本包 `foraging_imports` 测试都强制 §6.0 | §6.0 | ☐ |

### A.4 定义包实测（派发前）

在 `<BASE_COMMIT>` 的 `git archive` 副本中放最小 foraging 模块（§5.10 JSON + §7.4 locale + 空参与者），确认：`validateModuleDescriptors` 通过；世界包校验与可食/知识/分组/需求校验全部通过；仅 foraging 新局 D1 有 1–2 个菌丛收据、`definitionsFingerprint.foraging` 存在；同种子有/无 foraging 原生生成逐项相同。**若校验拒绝本包任何字段，改 §5 并记录原因。** ☐

### A.5 合入与派发

- ☐ §12.3 自行决定事项已签认（尤其 nonEaters 名单 Q10、名称/描述文本）。
- ☐ 本文件定稿提交于 `ext/phase5g-base`（父提交 `<BASE_COMMIT>`）并推送；提示块占位符已替换。
- ☐ settlement 若已合入：T-COMBO 加“仅 settlement”“foraging+settlement”两行，并确认 settlement 是否提供 `settlement.resident-status.v1`（形状须与 §6.5 一致；不一致则改本文）。

---

## 1 目标与范围

### 1.1 目标

在 `src/ext/modules/foraging/` 交付一个**只硬依赖底座**（5A1–5A4）的独立内容模块，使“仅启用 foraging”的新局可以完整游玩：

1. 地牢各层生成菌丛（D1–3 每层 1–2 丛，D4+ 2–3 丛；偏向发光菌/菌林地形），越深种类越多。
2. 徒手采集（100 tick/1 个，每丛 3 个，每 32000 tick 回 1 个）。
3. 未知菌只显示本局随机外观名；吃下（原生“吃”）得少量饱腹 + 唯一特性；满足揭示条件时学会种类，否则记“吃过，无明显效果”。
4. 火接触（火地形、扔进火、背包着火、篝火/火炉烤制命令）把菌变成“烤 X”；每局每种 50% 烤后保留特性、50% 去除；烤菌再碰火变焦炭，焦炭再碰火烧尽。
5. 爆燃菌：吃/扔无效果，任何火接触即爆炸；目睹爆炸才学会。
6. 盟友同伴有饱腹值，随时间下降；饿→虚弱→饥荒；饥荒满 300 回合离队（不死亡）；玩家用“喂食”命令把背包食物给相邻同伴，同伴对某些菌的反应可揭示种类。
7. 全程真实命令录制，save/load/replay/seek/续录一致。

### 1.2 已批准的产品选择（不再讨论）

- 12 种菌、每种恰好一个特性（无复合）；数值见 §5.2。
- 非魔法知识：鉴定卷轴、探测魔法、最后种类升格、任何“揭示全部”永不揭示（foundation 已隔离）；只能自己吃、喂同伴看反应、目睹爆炸学会。
- 外观名池 18 个 + 已知名 12 个为**审阅名单**，纯奇幻，运行期不拼接、不生成新名。
- 未知菌详情与喂食界面不显示饱腹数值（Q11=A）。
- 背包着火：玩家燃烧 0→正的瞬间，每堆可食物品 1/3 概率火接触（Q2=A，foundation 执行）。
- 篝火（combat）与 `station.hearth` 工位（crafting 火炉、将来 settlement 灶台）可烤（Q12=B，foundation 识别热源）。
- “暗影”= 原生 `darkness`（Q3=A）；临时力量 = `native.strength` +2、400 回合，到期移除。
- 同伴饥饿仅在启用 foraging 时存在；同伴 AI 永不自己进食；喂食永远被接受；同伴不会饿死。
- 同伴离队：视野外立即退役，视野内非敌对离开 ≤20 回合后退役（Q4=A，foundation H7）。
- 不进食同伴：规则排除（无生命/限时召唤/群体成员/营地居民）+ 模板名单 `nonEaters`（Q10=A，名单待维护者审阅，§12.3）。

### 1.3 非目标（出现即越界）

- **营地食物经济**：日粮、起始储粮、粮仓、短缺、厨师加工、农田/猎人、离线结算（全部归 settlement 5C1/5D）。本模块只给可食物品打公开标签 `food.ingredient.mushroom`，不读写任何营地数据。
- 修改任何 foundation 行为：吃/扔/起绰号流程、火接触入口与概率、爆炸选型、冷却、名称解析、需求时钟物化、离队行为、slumber。
- 新的原生物品类、把菌加入原生掉落/商店、改原生饥饿/自动进食/鉴定规则、给玩家制作食物。
- 新状态、新属性键、新错误码、新热源类型（只用 foundation 识别的两类）。
- 修改共享侧栏/背包/详情/地图组件（foundation 已负责命名显示）；新的 window 级键盘屏障、新弹窗系统、新字体/图片/emoji。
- 与 growth/narrative/combat/giants/crafting 的任何代码联动（只做组合不报错与热源烤制的验证）。

---

## 2 基线与分支

| 项目 | 值 |
| --- | --- |
| 基线 | `origin/ext/phase5g-base`：代码 = `ext/phase5` @ `<BASE_COMMIT>`（5A1–5A4 含 5A4 审查修复）+ 本文件定稿的纯文档提交 |
| 工作分支 | `git switch -c ext/phase5g origin/ext/phase5g-base` |
| foundation | `FOUNDATION_PROTOCOL = <FOUNDATION_PROTOCOL>`（预期 10；只引用常量，不写字面量）；`EDIBLE_SDK_VERSION = 1`；`worldSdk: 1` |
| 既有模块 | `<INSTALLED_MODULES>`，版本 `<MODULE_VERSIONS>`；一个字节都不改 |
| SDK 冻结文件（SHA-256） | `src/ext/worldSdk.ts` `<SHA256_worldSdk>`；`src/ext/edibleSdk.ts` `<SHA256_edibleSdk>`；`src/ext/worldEdible.ts` `<SHA256_worldEdible>`；`src/ext/kindKnowledge.ts` `<SHA256_kindKnowledge>`；`src/ext/actorNeeds.ts` `<SHA256_actorNeeds>`；`src/ext/stats.ts` `<SHA256_stats>`；`src/ext/testing/worldHarness.ts` `<SHA256_worldHarness>`；`src/ext/testing/forageHarness.ts` `<SHA256_forageHarness>`；`src/ext/testing/fixtures/forageFixture/` `<SHA256_fgfixture>` |
| 运行环境 | Node 24.19.0；`NODE_OPTIONS=--max-old-space-size=3072`；vitest `--maxWorkers=2`；不新增 npm 依赖 |

开工第一件事：`git log -1`、`git status`（须干净）、`git diff --stat <BASE_COMMIT> HEAD`（只应列出本任务书）、`shasum -a 256` 上述文件并与表比对，结果写入报告 §2。哈希不符**照常开工**，在报告记录差异并以基线实际代码为准。

开工前先完整阅读：`src/ext/testing/fixtures/forageFixture/index.ts`（测试专用 `fgfixture`，演示全部 E3/E4 字段与参与者接线；**只学接线，不抄数值与 `as any`**，它的参与者把整条事实写进 history、prepare 不校验 payload，本模块按 §6 严格实现）、`src/ext/modules/crafting/`（模块骨架、harvest 命令、投影、UI 会话、测试与 trace 的成熟写法，只读学习，不 import）、5A4 报告 §7（5G 冻结清单）。

---

## 3 模块目录（完整布局）

```text
src/ext/modules/foraging/
  descriptor.ts            发现入口；id 'foraging'；foundation: FOUNDATION_PROTOCOL；worldSdk: 1
  index.ts                 createForagingModule()：loadForagingPack() → createForagingModuleFromPack(pack)
  module.ts                ExtensionModule 组装（§6.2）
  definitions.ts           FORAGING_VERSION='1.0.0'；loadForagingPack()；getForagingPackIdentity()；toWorldDefinitionPack(pack)
  schema.ts                assertForagingPack(value, localeKeys)：严格校验（§5.9）
  types.ts                 ForagingPack / ForagingState / ForagingView 等模块自有类型
  knowledge.ts             纯函数：揭示判定（§6.4 表）
  participants.ts          edibleParticipant / actorNeedParticipant / hooks.actorDeparted（§6.4、§6.5）
  statSources.ts           饥饿惩罚 statSources（§6.5）
  state.ts                 initialForagingState / validateForagingState / applyFact（§6.6）
  commands.ts              harvest（worldWorkCommands）、feed/roast（edibleCommands）prepare
  view.ts                  projectForagingView(context)（§7.1）
  data/definitions.json    机械数据包（§5.10，逐字照抄）
  data/natural-trace.json        自然 trace A：仅 foraging（§8.3）
  data/natural-trace-hearth.json 自然 trace B：foraging + crafting 火炉烤制（§8.3）
  locales/zh_CN.json       全部文案（§7.4，逐字照抄）
  ui/descriptor.ts         ModuleUiContribution
  ui/useForagingUi.ts      会话：模块栏命令、面板、HUD、提交、刷新、失活
  ui/view.ts               readForagingUiView：严格解析投影 DTO（fail-closed）
  ui/commands.ts           buildHarvestCommand / buildFeedCommand / buildRoastCommand
  ui/ForagingPanel.vue     面板（三页签：采集 / 烤制 / 喂食）
  ui/ForagingCompanionHud.vue  同伴饱腹 HUD
  test-suites.json         {"test":[…],"gen":[],"drift":["tests/foraging_trace.test.ts"]}
  tests/…                  §8 列出的全部测试
docs/ext/foraging-config.md   自有配置手册（§10.2）
docs/ext/phase5g.report.md    执行报告（§10.1）
```

文件可再拆分（例如 `ui/ForagingFoodCard.vue`），但不得少于以上职责，也不得在目录外新增文件。模块测试全部在 `tests/` 且全部登记在 `test-suites.json`（发现器拒绝未登记或路径失效的测试）。

---

## 4 版本与身份

| 项目 | 值 | 说明 |
| --- | --- | --- |
| module id | `foraging` | 目录名同 |
| module version | `1.0.0`（`FORAGING_VERSION`） | |
| rules identity | `{ schema: 1, version: '1.0.0', fingerprint: extensionDataFingerprint(pack) }` | `pack` 为 `data/definitions.json` 经 schema 校验后的完整对象 |
| state schema | `1` | |
| payload 版本 | harvest/feed/roast 模块 payload 均 `v: 1`（传给 SDK 前去掉 `v`） | |
| worldSdk / edible SDK | `1` / `EDIBLE_SDK_VERSION`（1） | |
| defaultEnabled | `false` | |
| 显示 | locale 文本不进指纹；glyph/color 属机械定义，进指纹 | |

数组顺序进指纹：`data/definitions.json` 中任何数组重排都是规则变化。foundation 另把 owner 世界包 + 采食算法规则绑定为世界定义指纹，并以此为派生抽样盐（外观分配、烤制政策、菌丛位置随之变化）；改包即旧档按严格版本拒绝，不迁移。

---

## 5 数据包与完整数值（已批准，逐字照抄）

### 5.1 根结构（模块自有 schema）

```ts
interface ForagingPack {
  schema: 1; moduleId: 'foraging'; moduleVersion: '1.0.0'; rulesVersion: '1.0.0';
  kinds: ForagingKind[];                        // 12，顺序 = 设计稿 §3 表序，进指纹
  edibleItems: EdibleItemDefinition[];          // 12 生 + 11 烤 + 1 焦炭 = 24（edibleSdk 类型）
  resourceNodes: ResourceDefinition[];          // 12，kind:'fungus'（worldSdk 类型）
  knowledgeGroups: KindKnowledgeGroup[];        // 恰 1 组
  placementGroups: ForagingPlacementGroup[];    // 恰 1 组（类型由 ExtensionModule['worldDefinitions'] 派生，§6.0）
  actorNeeds: ActorNeedDeclaration[];           // 恰 1 项
  companion: CompanionRules;
  limits: ForagingLimits;
}
interface ForagingKind { id: string; minDepth: 1..40; weight: 1..100; satiety: 1..2150;
  reveal: 'always' | 'if-injured' | 'if-not-already' | 'on-explosion'; companionReveal: boolean }
interface CompanionRules { needId: 'foraging.companion-satiety'; component: 'hunger';
  penalties: { band: 'weak' | 'starving'; accuracyIncreasedBp: number; damageIncreasedBp: number }[];
  nonEaters: string[];                          // 怪物模板 ID，去重码点序，≤ limits.nonEaters
  residentQuery: 'settlement.resident-status.v1' }
interface ForagingLimits { kinds: 32; appearancePool: 64; edibleItems: 128; maxStack: 20;
  nodesPerLevel: 3; nodesPerRun: 120; nonEaters: 64; history: 64 }
```

`toWorldDefinitionPack(pack)` = `{ schema: 1, worldSdk: 1, items: [], resourceNodes, stations: [], recipes: [], startupItems: null, edibleItems, knowledgeGroups, placementGroups, actorNeeds }`（数组原序、原对象深复制）。`kinds/companion/limits` 只留在 foraging 包内，进 rules 指纹，不传给 SDK。

### 5.2 菌种表（12 种，每种一个特性）

时长单位为回合（100 tick）。饱腹为 nutrition 点；烤菌 = 生 +100；焦炭 20。效果对玩家与同伴走同一意图（foundation E10：telepathy/hallucinating/darkness 对非玩家 `notApplicable`）。

| # | kind | 已知名 | 特性 | 意图（`effect`） | 玩家揭示 `reveal` | 同伴可揭示 | 生饱腹 | 最浅层 | 权重 |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: |
| 0 | `mend` | 愈合菌 | 回复 | `heal-fraction` 30% / min 5 | `if-injured`（吃前 HP < 上限） | 是（喂前受伤） | 200 | 1 | 10 |
| 1 | `venom` | 蚀骨菌 | 中毒 | `status poisoned` 8 | `always` | 是 | 300 | 1 | 10 |
| 2 | `prism` | 幻彩菌 | 幻觉 | `status hallucinating` 100 | `if-not-already` | 否 | 350 | 1 | 8 |
| 3 | `astray` | 迷途菌 | 混乱 | `status confused` 8 | `always` | 是 | 300 | 1 | 8 |
| 4 | `upheave` | 翻胃菌 | 呕吐 | `status-and-satiety nauseous` 15，−300，下限 150 | `always` | 是 | 300 | 1 | 8 |
| 5 | `farsense` | 通心菌 | 心灵感应 | `status telepathy` 150 | `always` | 否 | 200 | 3 | 6 |
| 6 | `veil` | 匿影菌 | 暗影 | `status darkness` 200 | `if-not-already` | 否 | 250 | 3 | 6 |
| 7 | `drowse` | 沉眠菌 | 沉眠 | `status slumber` 25 | `always` | 是 | 400 | 4 | 6 |
| 8 | `blast` | 爆燃菌 | 爆裂 | `explosive`；`fire: explode, largeAtQuantity 3` | `on-explosion`（吃永不揭示） | 否 | 150 | 5 | 5 |
| 9 | `might` | 蛮力菌 | 临时力量 | `temp-stat` 400：玩家 `native.strength` +2；同伴 `native.physical-damage-dealt` `more` +2500 bp | `always` | 是 | 250 | 6 | 5 |
| 10 | `stiffen` | 僵缚菌 | 麻痹 | `status paralyzed` 8 | `always` | 是 | 250 | 6 | 5 |
| 11 | `quicken` | 迅步菌 | 加速 | `status haste` 10 | `always` | 是 | 150 | 8 | 4 |

- 好 5（回复、通心、暗影、力量、加速）、坏 6（中毒、幻觉、混乱、呕吐、沉眠、麻痹）、中性 1（爆裂）。
- 每层可出种类：D1–2 五种，D3 七种，D4 八种，D5 九种，D6–7 十一种，D8+ 十二种（由 `minDepth` 决定）。
- 叠加语义、免疫、施加路径全部沿 foundation（E10）；本模块不写任何状态公式。

### 5.3 可食物品（24 个定义）

| 定义 | ID | nameKey 文本（中性兜底） | glyph | color | satiety | effect | fire |
| --- | --- | --- | --- | --- | ---: | --- | --- |
| 生菌 ×12 | `foraging.<kind>` | “奇异的菌” | `菌` | `#B8A4E0` | 表 §5.2 | 该种意图 | 非 blast：`transform → foraging.<kind>-roasted`，msg `fire.roasted`；blast：`explode`，`largeAtQuantity 3`，msg `fire.exploded` |
| 烤菌 ×11（无 blast） | `foraging.<kind>-roasted` | “烤过的菌” | `菌` | `#C8966A` | 生 +100 | `derived-choice`：domain `foraging.roast-policy`，ordinal = 该种在 `kinds` 中的下标（0…11，跳过 8），options `[该种意图, {kind:'none'}]`（下标 0 = 保留，1 = 去除） | `transform → foraging.char`，msg `fire.charred` |
| 焦炭 ×1 | `foraging.char` | “焦炭” | `炭` | `#6B5B53` | 20 | `none` | `burn-up`，msg `fire.burned` |

- 全部 `maxStack: 20`；生/烤 `tags: ["food.ingredient.mushroom"]`；焦炭 `tags: []`、不属知识组（始终已知，用自身名称）。
- 生菌之间、烤菌之间 glyph/color/maxStack/tags **完全相同**（不能凭外观区分种类）。
- **为什么 nameKey 文本中性**：玩家可见名称一律由 foundation 经知识登记表解析；任何回退路径若误用 nameKey 也只会显示“奇异的菌/烤过的菌”，不泄露种类。T-LEAK 断言日志/投影中不出现 `ext.foraging.` 键串、定义 ID 或未知种类的已知名。
- 烤制政策 `keep/strip` 由 foundation 的整局派生抽样决定（各 50%，独立），不存档、不显示，本模块不计算也不缓存它。

### 5.4 菌丛节点与分组放置

12 个节点 `foraging.<kind>-patch`：`kind:'fungus'`、`yield:[{itemDefinitionId:'foraging.<kind>',count:1}]`、`capacity 3`、`harvestTicks 100`、`unitsPerHarvest 1`、`requiredToolTag null`、`regeneration {periodic, units 1, intervalTicks 32000}`、`placement {dungeon:null, site:null}`、glyph `菌`、color `#B8A4E0`（全部相同）；nameKey 文本统一“菌丛”（地图/悬停/列表显示名由 foundation 解析为“{外观名}丛”/“{已知名}丛”）。

分组 `foraging.patches`：

| 项 | 值 |
| --- | --- |
| members | 12 个节点，`minDepth/weight` 同 §5.2 |
| perDepth | D1–3：1–2；D4–40：2–3 |
| maxPerRun | 120（每层 ≤3；与 crafting 每层 8 合计 11 ≤ 32；整局 144+120 = 264 ≤ 512） |
| preference | tags `["terrain.fungus-forest","terrain.luminescent-fungus"]`，radius 3，preferredWeight 4，otherWeight 1 |
| 无位/预算 | foundation 记 skip 收据（`no-space/budget/run-limit`），不重生成 |

“洞穴型区域”偏好首版不支持（5A4 E23）。放置、收据、再生物化全部由 foundation 执行；本模块不调用任何放置接口、不写 `generationContributions`。

### 5.5 知识组与命名规则

知识组 `foraging.mushrooms`：kinds 12 行（`id`=kind，`raw`、`roasted`（blast 为 null）、`node`、`knownNameKey ext.foraging.kind.<kind>.name`、`knownDescriptionKey ext.foraging.kind.<kind>.description`）；`appearancePool` 18 行（§5.6）；`assignmentDomainId 'foraging.appearance'`；`templates`：`roasted ext.foraging.template.roasted`、`node …template.node`、`tastedNote …template.tasted_note`、`roastUnknownNote …template.roast_unknown_note`、`called …template.called`、`unknownDetail …template.unknown_detail`。

命名规则（已批准，强制；T-NAME 守护）：

1. 外观名、外观描述、已知名、已知描述、节点名、模板、消息与全部 UI 文案**不得描述或令人联想任何真实蘑菇**：不用真实物种名或俗名，不写菌盖/菌褶/菌柄/菌环/菌托/斑点/伞形/颜色花纹等写实形态，不用“X色+菇/蘑”组合。
2. 一律用明显虚构的奇幻特征（光、声、温度、符文、晶体、烟雾、星光、倒影、时间感）；统一后缀“菌”，玩家可见统称一律“菌”或“菌类”，不出现“菇/蘑/蕈/蘑菇”。
3. 描述不暗示药理或毒理（不写“有毒”“可治病”“致幻”等）；已知名可以概括游戏内效果（游戏规则名，不是现实物种），已知描述只写游戏内效果。
4. 名称只能来自 §5.6/§5.2 的审阅名单；运行期不拼接、截取或生成新名（foundation 模板只做“烤{{name}}”“{{name}}丛”“附注”“绰号”固定组合）。增删改名单须改数据 + 更新 T-NAME 快照 + 维护者审阅；dot 不得改。

### 5.6 外观名池（18 个，审阅名单，逐字照抄设计稿 §5.2）

foundation 每局倒序 Fisher–Yates 洗牌，取前 12 个按 `kinds` 顺序分配。

| 池 ID | 外观名 | 描述 |
| --- | --- | --- |
| `whisper` | 低语菌 | 凑近能听见细碎的低语，却听不清在说什么。 |
| `frostbreath` | 霜息菌 | 四周的空气总比别处冷一截，指尖碰上去会结一层薄霜。 |
| `stardust` | 星屑菌 | 表面浮着细小光点，像被困住的星屑，怎么拂也拂不掉。 |
| `echo` | 回响菌 | 轻敲一下，会传出好几声回音，一声比一声远。 |
| `rune` | 符纹菌 | 表面浮现缓慢变换的细小符文，没有人读得懂。 |
| `prismshard` | 晶棱菌 | 半透明的棱晶质地，转动时把光折成从未见过的颜色。 |
| `smoke` | 烟缕菌 | 像一团凝而不散的灰烟，握在手里却有实在的分量。 |
| `chime` | 幽铃菌 | 轻轻一碰，就响起仿佛很远的铃声。 |
| `moonsand` | 月砂菌 | 像用发光的细沙捏成，捏不散，也不掉渣。 |
| `mirror` | 镜面菌 | 光滑得能照出人影，只是倒影总慢半拍。 |
| `mistheart` | 雾心菌 | 中心悬着一小团不停翻涌的雾。 |
| `needlelight` | 针光菌 | 向四面八方射出极细的光针，碰到皮肤却毫无感觉。 |
| `hush` | 寂鸣菌 | 拿在手里时，周围的声音都会变轻。 |
| `warmstone` | 温石菌 | 摸起来像晒过太阳的石头，带着恒定的暖意。 |
| `glaze` | 琉璃菌 | 通体如琉璃，里面封着一缕缓慢旋转的光。 |
| `afterimage` | 虹痕菌 | 移开视线后，眼前还会留下一道彩色残影。 |
| `backshadow` | 逆影菌 | 它的影子总是指向光源。 |
| `hourglass` | 沙漏菌 | 内部有细沙自下而上缓缓流动。 |

**编写时核验（Claude，2026-10-07）**：18 个外观名与 12 个已知名均以“菌”结尾、互不重复；§7.4 全部 200 条文案对 §5.7 禁用词表逐条扫描 0 命中；没有一项是已知真实菌种的中文名或俗名，也没有写实形态/颜色花纹描写（“星屑/光点”“灰烟”“彩色残影”是光与烟的奇幻特征，不是菌体花纹）。唯一需维护者留意的是已知名“幻彩菌”含“幻”字——它是游戏效果名（规则 3 允许），描述不写“致幻”；如维护者认为仍有联想，在派发前改名（§12.3-15）。

### 5.7 禁用词表（T-NAME 使用，作用于 `locales/zh_CN.json` 全部值）

`菇`、`蘑`、`蕈`、`菌盖`、`菌褶`、`菌柄`、`菌环`、`菌托`、`斑点`、`伞`、`毒`、`鹅膏`、`牛肝`、`松茸`、`香菇`、`平菇`、`金针`、`鸡枞`、`鸡油`、`灵芝`、`竹荪`、`羊肚`、`木耳`、`银耳`、`猴头`、`松露`、`茯苓`、`虫草`、`孢子`、`致幻`、`迷幻`、`药`、`治病`、`疗效`、`食用菌`。

（在设计稿 §13 T-NAME 列表上追加了 `毒、鸡油、银耳、猴头、松露、茯苓、虫草、迷幻、药、治病、疗效、食用菌`，更严格；§7.4 全部文本已按此表通过。）

### 5.8 同伴规则

需求声明 `foraging.companion-satiety`：`role satiety`、`max 2150`、`initial 1800`、`ticksPerPoint 200`（玩家的一半速度；1800 约够 3600 回合）、bands `fed ≤2150`、`hungry ≤300`、`weak ≤150`、`starving ≤0`、`zeroDeadlineTicks 30000`（饥荒满 300 回合）、`departure.visibleGraceTicks 2000`（视野内离开 ≤20 回合）。

| 档 | 范围 | 惩罚（statSources，`layer:'temporary'`，`category:'increased'`） |
| --- | --- | --- |
| fed | 301…2150 | 无 |
| hungry | 151…300 | 无（仅提示） |
| weak | 1…150 | `native.accuracy` −2000 bp；`native.physical-damage-dealt` −2500 bp |
| starving | 0 | `native.accuracy` −4000 bp；`native.physical-damage-dealt` −5000 bp；foundation 开始离队计时 |

同伴不掉血、不饿死；任何进食使值 >0 即清除离队计时（foundation）。惩罚不写原生 `weaknessAmount`。

`nonEaters`（**模板名单，待维护者审阅，Q10**；规则排除之外额外不进食的盟友）：`arrow_turret, bloat, dart_turret, explosive_bloat, flame_turret, flamedancer, golem, ifrit, lich, mangrove_dryad, phantom, phoenix, pit_bloat, revenant, sentinel, spark_turret, vampire, wisp, wraith, zombie`（20 个，码点序；理由：炮塔/构装、气囊、元素/火焰生物、亡灵与灵体、植物）。`MONST_INANIMATE` 模板（各类 totem、spectral blade/sword、guardian、phylactery、phoenix_egg）已由规则排除，不重复列入。

### 5.9 schema 严格校验（`assertForagingPack(value, localeKeys)`）

- 所有对象严格键集（多键/缺键/`undefined`/getter/原型污染/非 JSON 拒绝）；整数为安全整数且在 §5.1 与 A.2#16 范围；ID 以 `foraging.` 开头、全包唯一（可食、节点、组、分组、需求共用一个 ID 空间检查）。
- `kinds` 恰 12 行、id 唯一、顺序同 §5.2；`edibleItems` 恰按“12 生（kinds 序）→ 11 烤（kinds 序跳过 blast）→ 焦炭”排列；每个生菌 `effect` 与烤菌 `options[0]` **逐字相等**于该种意图（单一真相：模块用 kinds 下标交叉核对）；烤菌 satiety = 生 +100；derived-choice `ordinal` = kinds 下标、`domainId` 恰 `foraging.roast-policy`、`options[1]` 恰 `{kind:'none'}`。
- 只有 blast 的 fire 为 `explode`、`roasted` 为 null；其余生菌 `transform` 指向自己的烤定义；烤菌 `transform → foraging.char`；焦炭 `burn-up`。
- 生菌之间、烤菌之间 glyph/color/maxStack/tags 全同；焦炭 tags 为空。
- 节点 12 行与 kinds 一一对应、`yield` 指向同种生菌、placement 双 null；分组 members 与节点同序且 `minDepth/weight` 等于 kinds。
- 知识组：kinds 行与 §5.5 一致；`appearancePool` 恰 18 行且 ID 与 §5.6 同序；全部 nameKey/descriptionKey/模板键以 `ext.foraging.` 开头且在 locale 中存在。
- 需求声明与 §5.8 一致；`companion.needId` 指向它；penalties 恰 weak、starving 两行；nonEaters 去重码点序、`≤ limits.nonEaters`。
- limits 全部 8 键存在、值 ≤ §5.1 表值，并以数据自检（例如 perDepth.max ≤ nodesPerLevel、maxPerRun ≤ nodesPerRun）。
- 任一错误抛出，模块构造失败（不部分注册）。

### 5.10 `data/definitions.json`（权威数据，dot 原样写入）

```json
{
  "schema": 1,
  "moduleId": "foraging",
  "moduleVersion": "1.0.0",
  "rulesVersion": "1.0.0",
  "kinds": [
    {"id":"mend","minDepth":1,"weight":10,"satiety":200,"reveal":"if-injured","companionReveal":true},
    {"id":"venom","minDepth":1,"weight":10,"satiety":300,"reveal":"always","companionReveal":true},
    {"id":"prism","minDepth":1,"weight":8,"satiety":350,"reveal":"if-not-already","companionReveal":false},
    {"id":"astray","minDepth":1,"weight":8,"satiety":300,"reveal":"always","companionReveal":true},
    {"id":"upheave","minDepth":1,"weight":8,"satiety":300,"reveal":"always","companionReveal":true},
    {"id":"farsense","minDepth":3,"weight":6,"satiety":200,"reveal":"always","companionReveal":false},
    {"id":"veil","minDepth":3,"weight":6,"satiety":250,"reveal":"if-not-already","companionReveal":false},
    {"id":"drowse","minDepth":4,"weight":6,"satiety":400,"reveal":"always","companionReveal":true},
    {"id":"blast","minDepth":5,"weight":5,"satiety":150,"reveal":"on-explosion","companionReveal":false},
    {"id":"might","minDepth":6,"weight":5,"satiety":250,"reveal":"always","companionReveal":true},
    {"id":"stiffen","minDepth":6,"weight":5,"satiety":250,"reveal":"always","companionReveal":true},
    {"id":"quicken","minDepth":8,"weight":4,"satiety":150,"reveal":"always","companionReveal":true}
  ],
  "edibleItems": [
    {"owner":"foraging","id":"foraging.mend","nameKey":"ext.foraging.item.mend.name","descriptionKey":"ext.foraging.item.mend.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":200,"effect":{"kind":"heal-fraction","percent":30,"min":5},"fire":{"onContact":"transform","to":"foraging.mend-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.venom","nameKey":"ext.foraging.item.venom.name","descriptionKey":"ext.foraging.item.venom.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":300,"effect":{"kind":"status","status":"poisoned","turns":8},"fire":{"onContact":"transform","to":"foraging.venom-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.prism","nameKey":"ext.foraging.item.prism.name","descriptionKey":"ext.foraging.item.prism.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":350,"effect":{"kind":"status","status":"hallucinating","turns":100},"fire":{"onContact":"transform","to":"foraging.prism-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.astray","nameKey":"ext.foraging.item.astray.name","descriptionKey":"ext.foraging.item.astray.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":300,"effect":{"kind":"status","status":"confused","turns":8},"fire":{"onContact":"transform","to":"foraging.astray-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.upheave","nameKey":"ext.foraging.item.upheave.name","descriptionKey":"ext.foraging.item.upheave.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":300,"effect":{"kind":"status-and-satiety","status":"nauseous","turns":15,"satietyLoss":300,"floor":150},"fire":{"onContact":"transform","to":"foraging.upheave-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.farsense","nameKey":"ext.foraging.item.farsense.name","descriptionKey":"ext.foraging.item.farsense.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":200,"effect":{"kind":"status","status":"telepathy","turns":150},"fire":{"onContact":"transform","to":"foraging.farsense-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.veil","nameKey":"ext.foraging.item.veil.name","descriptionKey":"ext.foraging.item.veil.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":250,"effect":{"kind":"status","status":"darkness","turns":200},"fire":{"onContact":"transform","to":"foraging.veil-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.drowse","nameKey":"ext.foraging.item.drowse.name","descriptionKey":"ext.foraging.item.drowse.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":400,"effect":{"kind":"status","status":"slumber","turns":25},"fire":{"onContact":"transform","to":"foraging.drowse-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.blast","nameKey":"ext.foraging.item.blast.name","descriptionKey":"ext.foraging.item.blast.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":150,"effect":{"kind":"explosive"},"fire":{"onContact":"explode","largeAtQuantity":3,"messageKey":"ext.foraging.fire.exploded"}},
    {"owner":"foraging","id":"foraging.might","nameKey":"ext.foraging.item.might.name","descriptionKey":"ext.foraging.item.might.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":250,"effect":{"kind":"temp-stat","turns":400,"player":{"key":"native.strength","value":2},"other":{"key":"native.physical-damage-dealt","category":"more","valueBp":2500}},"fire":{"onContact":"transform","to":"foraging.might-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.stiffen","nameKey":"ext.foraging.item.stiffen.name","descriptionKey":"ext.foraging.item.stiffen.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":250,"effect":{"kind":"status","status":"paralyzed","turns":8},"fire":{"onContact":"transform","to":"foraging.stiffen-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.quicken","nameKey":"ext.foraging.item.quicken.name","descriptionKey":"ext.foraging.item.quicken.description","glyph":"菌","color":"#B8A4E0","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":150,"effect":{"kind":"status","status":"haste","turns":10},"fire":{"onContact":"transform","to":"foraging.quicken-roasted","messageKey":"ext.foraging.fire.roasted"}},
    {"owner":"foraging","id":"foraging.mend-roasted","nameKey":"ext.foraging.item.mend-roasted.name","descriptionKey":"ext.foraging.item.mend-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":300,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":0,"options":[{"kind":"heal-fraction","percent":30,"min":5},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.venom-roasted","nameKey":"ext.foraging.item.venom-roasted.name","descriptionKey":"ext.foraging.item.venom-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":400,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":1,"options":[{"kind":"status","status":"poisoned","turns":8},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.prism-roasted","nameKey":"ext.foraging.item.prism-roasted.name","descriptionKey":"ext.foraging.item.prism-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":450,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":2,"options":[{"kind":"status","status":"hallucinating","turns":100},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.astray-roasted","nameKey":"ext.foraging.item.astray-roasted.name","descriptionKey":"ext.foraging.item.astray-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":400,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":3,"options":[{"kind":"status","status":"confused","turns":8},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.upheave-roasted","nameKey":"ext.foraging.item.upheave-roasted.name","descriptionKey":"ext.foraging.item.upheave-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":400,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":4,"options":[{"kind":"status-and-satiety","status":"nauseous","turns":15,"satietyLoss":300,"floor":150},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.farsense-roasted","nameKey":"ext.foraging.item.farsense-roasted.name","descriptionKey":"ext.foraging.item.farsense-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":300,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":5,"options":[{"kind":"status","status":"telepathy","turns":150},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.veil-roasted","nameKey":"ext.foraging.item.veil-roasted.name","descriptionKey":"ext.foraging.item.veil-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":350,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":6,"options":[{"kind":"status","status":"darkness","turns":200},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.drowse-roasted","nameKey":"ext.foraging.item.drowse-roasted.name","descriptionKey":"ext.foraging.item.drowse-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":500,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":7,"options":[{"kind":"status","status":"slumber","turns":25},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.might-roasted","nameKey":"ext.foraging.item.might-roasted.name","descriptionKey":"ext.foraging.item.might-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":350,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":9,"options":[{"kind":"temp-stat","turns":400,"player":{"key":"native.strength","value":2},"other":{"key":"native.physical-damage-dealt","category":"more","valueBp":2500}},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.stiffen-roasted","nameKey":"ext.foraging.item.stiffen-roasted.name","descriptionKey":"ext.foraging.item.stiffen-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":350,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":10,"options":[{"kind":"status","status":"paralyzed","turns":8},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.quicken-roasted","nameKey":"ext.foraging.item.quicken-roasted.name","descriptionKey":"ext.foraging.item.quicken-roasted.description","glyph":"菌","color":"#C8966A","maxStack":20,"tags":["food.ingredient.mushroom"],"satiety":250,"effect":{"kind":"derived-choice","domainId":"foraging.roast-policy","ordinal":11,"options":[{"kind":"status","status":"haste","turns":10},{"kind":"none"}]},"fire":{"onContact":"transform","to":"foraging.char","messageKey":"ext.foraging.fire.charred"}},
    {"owner":"foraging","id":"foraging.char","nameKey":"ext.foraging.item.char.name","descriptionKey":"ext.foraging.item.char.description","glyph":"炭","color":"#6B5B53","maxStack":20,"tags":[],"satiety":20,"effect":{"kind":"none"},"fire":{"onContact":"burn-up","messageKey":"ext.foraging.fire.burned"}}
  ],
  "resourceNodes": [
    {"owner":"foraging","id":"foraging.mend-patch","nameKey":"ext.foraging.node.mend.name","descriptionKey":"ext.foraging.node.mend.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.mend","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.venom-patch","nameKey":"ext.foraging.node.venom.name","descriptionKey":"ext.foraging.node.venom.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.venom","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.prism-patch","nameKey":"ext.foraging.node.prism.name","descriptionKey":"ext.foraging.node.prism.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.prism","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.astray-patch","nameKey":"ext.foraging.node.astray.name","descriptionKey":"ext.foraging.node.astray.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.astray","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.upheave-patch","nameKey":"ext.foraging.node.upheave.name","descriptionKey":"ext.foraging.node.upheave.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.upheave","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.farsense-patch","nameKey":"ext.foraging.node.farsense.name","descriptionKey":"ext.foraging.node.farsense.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.farsense","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.veil-patch","nameKey":"ext.foraging.node.veil.name","descriptionKey":"ext.foraging.node.veil.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.veil","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.drowse-patch","nameKey":"ext.foraging.node.drowse.name","descriptionKey":"ext.foraging.node.drowse.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.drowse","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.blast-patch","nameKey":"ext.foraging.node.blast.name","descriptionKey":"ext.foraging.node.blast.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.blast","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.might-patch","nameKey":"ext.foraging.node.might.name","descriptionKey":"ext.foraging.node.might.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.might","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.stiffen-patch","nameKey":"ext.foraging.node.stiffen.name","descriptionKey":"ext.foraging.node.stiffen.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.stiffen","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}},
    {"owner":"foraging","id":"foraging.quicken-patch","nameKey":"ext.foraging.node.quicken.name","descriptionKey":"ext.foraging.node.quicken.description","glyph":"菌","color":"#B8A4E0","kind":"fungus","yield":[{"itemDefinitionId":"foraging.quicken","count":1}],"capacity":3,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":32000},"placement":{"dungeon":null,"site":null}}
  ],
  "knowledgeGroups": [ {"owner":"foraging","id":"foraging.mushrooms",
    "kinds": [
      {"id":"mend","raw":"foraging.mend","roasted":"foraging.mend-roasted","node":"foraging.mend-patch","knownNameKey":"ext.foraging.kind.mend.name","knownDescriptionKey":"ext.foraging.kind.mend.description"},
      {"id":"venom","raw":"foraging.venom","roasted":"foraging.venom-roasted","node":"foraging.venom-patch","knownNameKey":"ext.foraging.kind.venom.name","knownDescriptionKey":"ext.foraging.kind.venom.description"},
      {"id":"prism","raw":"foraging.prism","roasted":"foraging.prism-roasted","node":"foraging.prism-patch","knownNameKey":"ext.foraging.kind.prism.name","knownDescriptionKey":"ext.foraging.kind.prism.description"},
      {"id":"astray","raw":"foraging.astray","roasted":"foraging.astray-roasted","node":"foraging.astray-patch","knownNameKey":"ext.foraging.kind.astray.name","knownDescriptionKey":"ext.foraging.kind.astray.description"},
      {"id":"upheave","raw":"foraging.upheave","roasted":"foraging.upheave-roasted","node":"foraging.upheave-patch","knownNameKey":"ext.foraging.kind.upheave.name","knownDescriptionKey":"ext.foraging.kind.upheave.description"},
      {"id":"farsense","raw":"foraging.farsense","roasted":"foraging.farsense-roasted","node":"foraging.farsense-patch","knownNameKey":"ext.foraging.kind.farsense.name","knownDescriptionKey":"ext.foraging.kind.farsense.description"},
      {"id":"veil","raw":"foraging.veil","roasted":"foraging.veil-roasted","node":"foraging.veil-patch","knownNameKey":"ext.foraging.kind.veil.name","knownDescriptionKey":"ext.foraging.kind.veil.description"},
      {"id":"drowse","raw":"foraging.drowse","roasted":"foraging.drowse-roasted","node":"foraging.drowse-patch","knownNameKey":"ext.foraging.kind.drowse.name","knownDescriptionKey":"ext.foraging.kind.drowse.description"},
      {"id":"blast","raw":"foraging.blast","roasted":null,"node":"foraging.blast-patch","knownNameKey":"ext.foraging.kind.blast.name","knownDescriptionKey":"ext.foraging.kind.blast.description"},
      {"id":"might","raw":"foraging.might","roasted":"foraging.might-roasted","node":"foraging.might-patch","knownNameKey":"ext.foraging.kind.might.name","knownDescriptionKey":"ext.foraging.kind.might.description"},
      {"id":"stiffen","raw":"foraging.stiffen","roasted":"foraging.stiffen-roasted","node":"foraging.stiffen-patch","knownNameKey":"ext.foraging.kind.stiffen.name","knownDescriptionKey":"ext.foraging.kind.stiffen.description"},
      {"id":"quicken","raw":"foraging.quicken","roasted":"foraging.quicken-roasted","node":"foraging.quicken-patch","knownNameKey":"ext.foraging.kind.quicken.name","knownDescriptionKey":"ext.foraging.kind.quicken.description"}
    ],
    "appearancePool": [
      {"id":"whisper","nameKey":"ext.foraging.appearance.whisper.name","descriptionKey":"ext.foraging.appearance.whisper.description"},
      {"id":"frostbreath","nameKey":"ext.foraging.appearance.frostbreath.name","descriptionKey":"ext.foraging.appearance.frostbreath.description"},
      {"id":"stardust","nameKey":"ext.foraging.appearance.stardust.name","descriptionKey":"ext.foraging.appearance.stardust.description"},
      {"id":"echo","nameKey":"ext.foraging.appearance.echo.name","descriptionKey":"ext.foraging.appearance.echo.description"},
      {"id":"rune","nameKey":"ext.foraging.appearance.rune.name","descriptionKey":"ext.foraging.appearance.rune.description"},
      {"id":"prismshard","nameKey":"ext.foraging.appearance.prismshard.name","descriptionKey":"ext.foraging.appearance.prismshard.description"},
      {"id":"smoke","nameKey":"ext.foraging.appearance.smoke.name","descriptionKey":"ext.foraging.appearance.smoke.description"},
      {"id":"chime","nameKey":"ext.foraging.appearance.chime.name","descriptionKey":"ext.foraging.appearance.chime.description"},
      {"id":"moonsand","nameKey":"ext.foraging.appearance.moonsand.name","descriptionKey":"ext.foraging.appearance.moonsand.description"},
      {"id":"mirror","nameKey":"ext.foraging.appearance.mirror.name","descriptionKey":"ext.foraging.appearance.mirror.description"},
      {"id":"mistheart","nameKey":"ext.foraging.appearance.mistheart.name","descriptionKey":"ext.foraging.appearance.mistheart.description"},
      {"id":"needlelight","nameKey":"ext.foraging.appearance.needlelight.name","descriptionKey":"ext.foraging.appearance.needlelight.description"},
      {"id":"hush","nameKey":"ext.foraging.appearance.hush.name","descriptionKey":"ext.foraging.appearance.hush.description"},
      {"id":"warmstone","nameKey":"ext.foraging.appearance.warmstone.name","descriptionKey":"ext.foraging.appearance.warmstone.description"},
      {"id":"glaze","nameKey":"ext.foraging.appearance.glaze.name","descriptionKey":"ext.foraging.appearance.glaze.description"},
      {"id":"afterimage","nameKey":"ext.foraging.appearance.afterimage.name","descriptionKey":"ext.foraging.appearance.afterimage.description"},
      {"id":"backshadow","nameKey":"ext.foraging.appearance.backshadow.name","descriptionKey":"ext.foraging.appearance.backshadow.description"},
      {"id":"hourglass","nameKey":"ext.foraging.appearance.hourglass.name","descriptionKey":"ext.foraging.appearance.hourglass.description"}
    ],
    "assignmentDomainId":"foraging.appearance",
    "templates":{"roasted":"ext.foraging.template.roasted","node":"ext.foraging.template.node","tastedNote":"ext.foraging.template.tasted_note","roastUnknownNote":"ext.foraging.template.roast_unknown_note","called":"ext.foraging.template.called","unknownDetail":"ext.foraging.template.unknown_detail"} } ],
  "placementGroups": [ {"owner":"foraging","id":"foraging.patches",
    "members": [
      {"resourceDefinitionId":"foraging.mend-patch","minDepth":1,"weight":10},
      {"resourceDefinitionId":"foraging.venom-patch","minDepth":1,"weight":10},
      {"resourceDefinitionId":"foraging.prism-patch","minDepth":1,"weight":8},
      {"resourceDefinitionId":"foraging.astray-patch","minDepth":1,"weight":8},
      {"resourceDefinitionId":"foraging.upheave-patch","minDepth":1,"weight":8},
      {"resourceDefinitionId":"foraging.farsense-patch","minDepth":3,"weight":6},
      {"resourceDefinitionId":"foraging.veil-patch","minDepth":3,"weight":6},
      {"resourceDefinitionId":"foraging.drowse-patch","minDepth":4,"weight":6},
      {"resourceDefinitionId":"foraging.blast-patch","minDepth":5,"weight":5},
      {"resourceDefinitionId":"foraging.might-patch","minDepth":6,"weight":5},
      {"resourceDefinitionId":"foraging.stiffen-patch","minDepth":6,"weight":5},
      {"resourceDefinitionId":"foraging.quicken-patch","minDepth":8,"weight":4}
    ],
    "perDepth":[{"fromDepth":1,"toDepth":3,"min":1,"max":2},{"fromDepth":4,"toDepth":40,"min":2,"max":3}],"maxPerRun":120,
    "preference":{"tags":["terrain.fungus-forest","terrain.luminescent-fungus"],"radius":3,"preferredWeight":4,"otherWeight":1} } ],
  "actorNeeds": [{"owner":"foraging","id":"foraging.companion-satiety","role":"satiety","max":2150,"initial":1800,"ticksPerPoint":200,"bands":[{"id":"fed","atOrBelow":2150},{"id":"hungry","atOrBelow":300},{"id":"weak","atOrBelow":150},{"id":"starving","atOrBelow":0}],"zeroDeadlineTicks":30000,"departure":{"visibleGraceTicks":2000}}],
  "companion": {"needId":"foraging.companion-satiety","component":"hunger","penalties":[{"band":"weak","accuracyIncreasedBp":-2000,"damageIncreasedBp":-2500},{"band":"starving","accuracyIncreasedBp":-4000,"damageIncreasedBp":-5000}],"nonEaters":["arrow_turret","bloat","dart_turret","explosive_bloat","flame_turret","flamedancer","golem","ifrit","lich","mangrove_dryad","phantom","phoenix","pit_bloat","revenant","sentinel","spark_turret","vampire","wisp","wraith","zombie"],"residentQuery":"settlement.resident-status.v1"},
  "limits": {"kinds":32,"appearancePool":64,"edibleItems":128,"maxStack":20,"nodesPerLevel":3,"nodesPerRun":120,"nonEaters":64,"history":64}
}
```

本 JSON 由 Claude 以脚本生成并核对计数（可食 24、节点 12、外观池 18）；字段集按当前工作树 SDK 编写，维护者在 §A.4 实测。**这是本包唯一权威数值来源；除 §A 维护者改正外 dot 不得修改。**

---

## 6 模块实现规则

### 6.0 允许的导入（模块测试 `foraging_imports` 强制；边界脚本另强制可信文件禁令）

生产代码（`tests/` 以外）只可 import：

| 来源 | 允许内容 |
| --- | --- |
| `src/ext/worldSdk` | 类型（`ResourceDefinition`、`WorldResult`、`WorldErrorCode`、`JsonValue`、`DeepReadonly`、`WorldWorkReadSDK`、`WorkContext` 等）、常量 `WORLD_SDK_VERSION`、纯函数 `levelKey/compareLevelRefs` |
| `src/ext/edibleSdk` | §A.2#1 全部类型与 `EDIBLE_SDK_VERSION` |
| `src/ext/stats` | **仅 `import type`**（`StatSourceProvider`、`StatModifierRow`、`StatSourceContext`） |
| `src/ext/types` | `ExtensionModule`、`Json`、`HookHandlers`、`ActorFacts`、`OptionalQueryResult` 等类型 |
| `src/ext/descriptor` | `FOUNDATION_PROTOCOL`、`ModuleDescriptor` |
| `src/ext/fingerprint` | `extensionDataFingerprint` |
| `src/ext/world` | **仅 `import type`**（`ExtensionProjectionContext`、`WorldInteractableView`） |
| `src/ext/ui/**`、`src/ui/**` | 共享 UI（同 crafting/combat：`ModuleUiHost`、`DialogService` 类型、`DisplayFrame` 类型等） |
| npm | `vue`、`i18next` |

不得 import：`src/engine/**`、`src/ext/structureTypes`（可信声明）、`src/ext/testing/**`、`src/data/**`、`src/ext/runtime`、其他模块。可信实现文件（`Edible*`、`FireContact`、`KindKnowledge`、`DerivedDraw`、`PlacementGroups`、`ActorNeeds`、`ActorDeparture`、`WorldWork*` 等）由边界脚本禁止。

分组类型派生：`type ForagingWorldPack = NonNullable<ExtensionModule['worldDefinitions']>; type ForagingPlacementGroup = NonNullable<ForagingWorldPack['placementGroups']>[number];`

测试可另 import：`src/ext/testing/worldHarness`（`createWorldHarness`、测试专用 `worldHarnessGame(h)`）；为**布景与独立预言**可 import 引擎（`Monster`、`src/data/monsters.json`、`ItemLoader`、`KindKnowledge.assembleEdibleItem`、`DungeonFeature` 的 `spawnDungeonFeature/catalogFeature`、地形常量）与 `node:crypto`。被测动作本身（采集、吃、扔、起绰号、喂食、烤制、移动、下楼）必须走公开命令。`createForageHarness` 会强制加入 `fgfixture`，本模块测试默认不用；确需时在报告说明。

### 6.1 descriptor

```ts
export const descriptor: ModuleDescriptor = {
  id: 'foraging', version: FORAGING_VERSION, foundation: FOUNDATION_PROTOCOL,
  worldSdk: 1, rules: getForagingPackIdentity(), create: createForagingModule,
  defaultEnabled: false,
  labelKey: 'ext.foraging.module.name', descriptionKey: 'ext.foraging.module.description',
  locales: { zh_CN: zhCN }
};
```

不写 `dependencies`；不在 catalog 等共享文件登记（发现器自动发现）。

### 6.2 module

`createForagingModuleFromPack(pack)` 返回的 `ExtensionModule` 只含：`id/version/rules`、`worldDefinitions: toWorldDefinitionPack(pack)`、`worldWorkCommands: { harvest }`、`edibleCommands: { feed, roast }`、`edibleParticipant: { onConsumed, onFireContact }`、`actorNeedParticipant: { qualifies, onNeedEvent }`、`hooks: { actorDeparted }`、`statSources: { collect }`（无 keys、无 revisionHint）、`componentValidators: { hunger }`、`initialState`、`validateState`、`projectView`。**不实现** `commands`、`interactionCommands`、`worldWorkParticipant`、`actorActions`、`generationContributions`、`worldInteractables`、`ownedRegions`、`publicActorTags`、`optionalQueries`（本模块只消费 `settlement.resident-status.v1`，不提供任何查询）。

### 6.3 命令（`commands.ts`）

外层固定：`executeCommand('ext:command', JSON.stringify({module:'foraging', action, payload}))`。prepare 必须纯：不读写 state、不取 RNG、不用 `Date`/`Math.random`、不分配 ID、不发消息、不缓存句柄；payload 已深冻结。

| action | 归属 | payload（严格键集，`v:1`） | 模块检查（失败码） | 委托 |
| --- | --- | --- | --- | --- |
| harvest | `worldWorkCommands` | `{v,nodeId,nodeRevision,inventoryStamp,destinationId,destinationRevision}` | 键集/类型/安全整数（`C5_BAD_PAYLOAD`）；`destinationId===null ⇔ destinationRevision===null`；UI 恒传 null | `sdk.planTimedWork({kind:'harvest', nodeId, nodeRevision, inventoryStamp, destinationId, destinationRevision})` |
| feed | `edibleCommands` | `{v,targetId,targetRevision,itemId,inventoryStamp}` | 键集/类型/安全整数（`C5_BAD_PAYLOAD`） | `sdk.planFeed({targetId,targetRevision,itemId,inventoryStamp})` |
| roast | `edibleCommands` | `{v,heatSourceId,itemId,inventoryStamp}` | 同上 | `sdk.planRoast({heatSourceId,itemId,inventoryStamp})` |

- 资格、距离、可见、失能、离开中、CAS、确认（“不太饿/它现在不太饿”）、耗时、喂食后效果全部由 foundation 判定与执行；模块不重复实现，原样返回 `WorldResult`。模块自造的失败只用 `C5_BAD_PAYLOAD`，`field` 为字段名。
- 每个 action 只调用与自己对应的 plan；被拒命令仍记录（0 成本）。
- 本模块不提供 `cancel-work`（采集是单批 100 tick，在命令内完成或被中断）。

### 6.4 可食参与者与知识（`participants.ts` + `knowledge.ts`）

参与者同步、纯 JSON、**绝不抛异常**（异常 = 命令回滚为 `C5_PROVIDER` 或时间路径丢弃写入）：输入非预期时只做 `lastFactId` 推进或原样不写。只处理 `fact.owner === 'foraging'`。

**`onConsumed(fact, tx)`**（`operation: 'eat' | 'feed'`）：

1. `definitionId` 为 null（喂原生口粮/芒果）或为 `foraging.char`：不写知识；feed 时写 `message.fed_food`；记账。
2. 解析 `definitionId` → (kind, form ∈ raw|roasted)。`revealed = predicate(kind, form, fact)`：

| 条件 | eat（玩家） | feed（同伴） |
| --- | --- | --- |
| 公共前提 | `!outcome.immune && !outcome.notApplicable && resolvedIntent.kind !== 'none'` | 同左，且 `kind.companionReveal && fact.visibleToPlayer` |
| `always` | 前提即真 | 前提即真 |
| `if-injured` | `fact.hpBefore < fact.maxHp` | 同左（目标的 hpBefore/maxHp） |
| `if-not-already` | `outcome.newlyStarted` | —（companionReveal 为 false） |
| `on-explosion` | 永不 | 永不 |

   “always”按设计稿 §3 字面：即使已处于该状态（取较大值导致时长未增）也揭示；只有免疫/不适用不揭示。

3. `revealed`：`markKnowledge(definitionId,'known')`；若 form=roasted 再 `markKnowledge(raw,'known')`（揭示烤菌即知种类，维护者 2026-10-07 已批准）。消息：eat 生 → `message.revealed {name}`；eat 烤 → `message.revealed_roasted {name}`；feed → `message.fed_revealed {name}`。`name` = `i18next.t(kind.knownNameKey)`（模块预翻译后作参数）。
4. 否则 `markKnowledge(definitionId,'tasted')`（已 known 时返回 false，忽略）；eat → `message.tasted`；feed → `message.fed_tasted`。
5. 生菌已知**不**自动标烤菌 known（烤后保留/去除是独立知识）。

**`onFireContact(fact, tx)`**：`result==='exploded' && (fact.visibleToPlayer || fact.location==='inventory')` 且 definitionId 为 `foraging.blast` → `markKnowledge('foraging.blast','known')`（foundation 在参与者之后解析消息名，故爆炸消息显示“爆燃菌炸开了！”）。其他结果只记账。变形/爆炸/烧尽消息由 foundation 用定义 `fire.messageKey` 写，模块不重复写。

### 6.5 同伴：资格、需求事件、惩罚、离队消息

**`qualifies(needId, facts, ctx)`**：`needId === 'foraging.companion-satiety' && facts.allied && !facts.inanimate && !facts.timedSummon && facts.groupRole !== 'member' && !(facts.monsterId && nonEaters.includes(facts.monsterId)) && !isResident(facts.actorId, ctx)`。

- `isResident`：`ctx.queryOptional('settlement.resident-status.v1', {actorId})`；仅当结果 `status:'available'` 且 `value` 严格等于 `{resident:true}` 时为真；`unavailable`、其他形状、异常一律视为“非居民”（缺席不排除）。此输入/输出形状是本模块对 settlement 的消费合同，写入报告“交接 5D”。
- 返回严格布尔，绝不抛异常（try/catch 包住查询）。

**`onNeedEvent(fact, tx)`**（只处理本 needId）：

| kind | 写组件 | 消息（仅 `visibleToPlayer && !deferred`） | 其他 |
| --- | --- | --- | --- |
| attached | `setOwnComponent(actorId,'hunger',{band})` | 无 | |
| band | 同上（取 `fact.band`；跨多档只发一次，按当前档处理） | `message.band.<band>`（fed/hungry/weak/starving） | |
| deadline | 不变 | `message.departing`（若可见） | `tx.depart(actorId)`（foundation 按声明 grace 决定立即退役或离开态） |
| detached | `removeOwnComponent(actorId,'hunger')`（reason 为 ineligible；death/departed 时 foundation 已清理，调用须容错） | 无 | 记账（departed） |

组件 `hunger` 值严格为 `{band:'fed'|'hungry'|'weak'|'starving'}`；`componentValidators.hunger` 严格校验。

**`statSources.collect(actor, ctx)`**：`ctx.getComponent(actor.id,'hunger')` 的 band 为 weak/starving 时返回两行 `{stat:'native.accuracy'|'native.physical-damage-dealt', category:'increased', value:<§5.8>, layer:'temporary', sourceKind:'foraging.hunger', sourceId:'foraging.hunger.<band>'}`；否则 `[]`。纯函数、0 RNG。

**`hooks.actorDeparted(event, context)`**：`event.owner==='foraging'` 时 `context.message(i18next.t(event.deferred ? 'ext.foraging.message.departed_away' : 'ext.foraging.message.departed', {name: event.actor.name}))`；其余 owner 忽略。不写 state。

### 6.6 模块 state（`state.ts`）

```ts
interface ForagingState {
  schema: 1;
  lastFactId: number;
  totals: { eaten: number; fed: number; revealed: number; roasted: number; charred: number;
            burned: number; exploded: number; departed: number };
  history: { factId: number; kind: 'eat'|'feed'|'fire'|'need'; result: string; tick: number }[];  // ≤64，满则丢最旧
}
```

- `initialState()` 全 0、空 history。参与者用纯函数 `applyFact(state, fact)` 后 `tx.replaceState(next)`；`fact.factId <= lastFactId` 不写（幂等，容忍跳号）。
- totals：eat/feed 各 +1；揭示成功 `revealed` +1；fire `transformed` 且来源为生 → roasted、来源为烤 → charred；`burned-up`/`destroyed` → burned；`exploded` → exploded；need `detached` 且 reason `departed` → departed。饱和于 `MAX_SAFE_INTEGER`。
- history 的 `result` 只存枚举短串（`revealed/tasted/food/transformed/burned-up/exploded/destroyed/attached/band/deadline/detached`），**不存 definitionId、kind、名称**（防泄露）。
- `validateState` 严格：键集、整数范围、history ≤64 且 factId 严格递增、`lastFactId ≥` 最大 factId、枚举。
- state 只经参与者改变；投影/UI 只读。

### 6.7 时间与随机

一切计时、物化、火接触、爆炸、冷却、离队、外观分配、烤制政策、菌丛放置都由 foundation 执行。本模块不推进时间、不取任何 RNG（`randomInt` 也不用）、不缓存派生结果、不在 hooks 里写机械状态。

---

## 7 投影、UI 与 i18n

### 7.1 投影 `projectView(context)`（`view.ts`）

纯函数，只用 `context.edible`、`context.worldWork`、`context.nearbyInteractables`（runtime 已按 owner 过滤）与本包定义。`edible` 或 `worldWork` 缺席、或 `readEdibleContext()` 失败 → `{v:1, available:false}`。成功：

```ts
interface ForagingView {
  v: 1; available: true; inventoryStamp: string;
  activeTicket: null | { ticketId: number; remainingTicks: number };            // 仅本 owner 的采集票据
  nodes: { interactableId: number; displayName: string; remaining: number; capacity: number;
    available: number; nodeRevision: number; canHarvest: boolean; reason: WorldErrorCode | null }[];
  foods: { itemId: number; displayName: string; quantity: number;
    source: 'foraging' | 'native';                                              // 本模块可食 / 原生口粮芒果
    knowledge: 'unknown' | 'tasted' | 'known' | null;
    satiety: number | null; roastable: boolean }[];                             // roastable = source==='foraging'
  companions: { actorId: number; targetRevision: number; band: 'fed'|'hungry'|'weak'|'starving';
    departing: boolean }[];                                                     // 来自 feedTargets（本层可见）
  heatSources: { interactableId: number; kind: 'bonfire' | 'hearth-station' }[];
}
```

- **不输出** definitionId、kind、已知名、饱腹精确值（非 known 时 `satiety:null`）、烤制政策、需求精确值 `value`（只给档位）。
- 节点行：对 `nearbyInteractables` 中本 owner 条目调用 `readWorkContext({kind:'node', interactableId})`，失败则不列；`displayName` 取 `WorldInteractableView.displayName`（缺失则列表不显示该行，不回退 nameKey）；`canHarvest/reason` 按 crafting §7.1 同一顺序计算（`!available→C5_BUSY/C5_GATE`、距离 >1 `C5_DISTANCE`、`remaining<1` `C5_RESOURCE_EMPTY`、预留 `C5_RESERVED`；无工具要求）。
- 投影 0 RNG、0 写；反复投影结果相同。

### 7.2 UI 会话（`ui/useForagingUi.ts`）

参照 crafting `useCraftingUi.ts`（面板、提交、失活）与 combat `useCombatUi.ts`（`host.readDisplayFrame()` 读 `rows` 取怪物名与距离），只读学习，不 import 它们。

- 模块栏命令 `{ id:'foraging.open', label: t('ext.foraging.ui.open'), glyph:'菌' }`；投影 `available:false` 时 disabled。
- 面板 `ForagingPanel.vue`（`defineAsyncComponent` 懒加载），三页签：**采集 / 烤制 / 喂食**；打开前 `host.canOpenPanel()`、`host.beforeOpenPanel()`，关闭 `host.afterClosePanel()`。
- HUD `ForagingCompanionHud.vue`：存在任一同伴档位 ≠ fed 或 departing 时显示一行一名同伴“名称 · 档位”（名称取 display frame `rows` 中 `kind==='monster' && id===actorId` 的 `name`，取不到用 `ui.companion.unknown_name`）；否则 null。共享侧栏不改（侧栏档位显示不在本包，§12.3-10）。
- 吃、扔、起绰号走原生背包（foundation 已支持），模块不加重复入口。
- 读数据：`readModuleView('foraging')` 经 `ui/view.ts` 严格解析，任何字段异常视为不可用（fail-closed）。
- 提交：`ui/commands.ts` 用投影里的 revision/stamp 拼 payload；`submitting` 锁 + 忽略 `event.detail > 1`；确认对话由 foundation/shell 经 DialogService 呈现；被拒显示 `ext.foraging.error.<码>`，无则回退 `ext.foundation.world.error.<码>`，再无则 `ui.rejected`；不向玩家显示错误码或 field。
- 失活：`host.game()`/`extensionRuntime` 变化、`isPresentationBusy()`、`canPresentInteraction()===false` → 关闭面板、清草稿；回放/seek 中只读（提交按钮 disabled，显示 `ui.replay_readonly`）；seek 后清选择。反复开关/切页签不改时间、背包、state 或 RNG（T-PERSIST 断言）。

### 7.3 面板布局与视口

| 页签 | 内容 | 操作 |
| --- | --- | --- |
| 采集 | 附近菌丛卡片：名称（foundation 解析名）、`剩余 r / c` | “采集（100 刻）”；不可用时显示原因 |
| 烤制 | 热源选择（多个时按 interactableId 升序，默认第一个；显示“篝火/火炉”）；`roastable` 食物卡片（名称、数量；**不按种类过滤**——未知爆燃菌也可选，烤它会在热源处爆炸，这是玩法而非缺陷） | “烤制”；无热源显示 `ui.roast.no_heat` |
| 喂食 | 同伴卡片（名称、档位、离开中标“即将离开”；按 display frame 距离判断相邻，非相邻灰态 `ui.feed.not_adjacent`；相邻仅一名时自动选中）；食物卡片（名称、数量；饱腹：known 显示 `饱腹 N`，未知显示“少量”，原生显示数值） | 选同伴 → 选食物 → “喂食” |

- 1440×900：地图旁侧栏式面板，原命令环保持可用。
- 390×844 与 320×844（普通 + 沉浸）：单列底部抽屉；页签条固定顶部；同伴卡在上、食物列表在下；底部“取消/确认”固定且不遮挡玩家与相邻格；**无横向滚动**；可点目标 ≥44×44 CSS px；名称最多两行截断；不依赖悬停或键盘。
- 四种地图显示模式下面板/HUD 不遮挡玩家格高亮与敌人预警。
- 风格：沿用现有字体、色系、CSS 变量；不新增字体/图片/emoji；地图节点字形由 foundation 渲染。

### 7.4 i18n（`locales/zh_CN.json`，逐字照抄）

名称类（kind/appearance/item/node 的 name、模板）**不得改一字**；描述与 UI/错误/消息文案仅可改错别字，且改后须仍通过 §5.7 禁用词与 T-NAME 快照（快照变化 = 需维护者审阅，dot 不应改）。

```json
{
  "ext.foraging.module.name": "采食",
  "ext.foraging.module.description": "在地牢中采集奇异的菌类：吃下才知道它是什么，用火烤会改变它，同伴也需要你喂食。",
  "ext.foraging.kind.mend.name": "愈合菌",
  "ext.foraging.kind.mend.description": "吃下后伤口会迅速愈合。",
  "ext.foraging.item.mend.name": "奇异的菌",
  "ext.foraging.item.mend.description": "一株说不出来历的菌。",
  "ext.foraging.item.mend-roasted.name": "烤过的菌",
  "ext.foraging.item.mend-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.mend.name": "菌丛",
  "ext.foraging.node.mend.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.venom.name": "蚀骨菌",
  "ext.foraging.kind.venom.description": "吃下后身体会被慢慢侵蚀，一段时间内持续失去生命。",
  "ext.foraging.item.venom.name": "奇异的菌",
  "ext.foraging.item.venom.description": "一株说不出来历的菌。",
  "ext.foraging.item.venom-roasted.name": "烤过的菌",
  "ext.foraging.item.venom-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.venom.name": "菌丛",
  "ext.foraging.node.venom.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.prism.name": "幻彩菌",
  "ext.foraging.kind.prism.description": "吃下后眼前的一切都会变得光怪陆离。",
  "ext.foraging.item.prism.name": "奇异的菌",
  "ext.foraging.item.prism.description": "一株说不出来历的菌。",
  "ext.foraging.item.prism-roasted.name": "烤过的菌",
  "ext.foraging.item.prism-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.prism.name": "菌丛",
  "ext.foraging.node.prism.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.astray.name": "迷途菌",
  "ext.foraging.kind.astray.description": "吃下后头晕目眩，脚步不听使唤。",
  "ext.foraging.item.astray.name": "奇异的菌",
  "ext.foraging.item.astray.description": "一株说不出来历的菌。",
  "ext.foraging.item.astray-roasted.name": "烤过的菌",
  "ext.foraging.item.astray-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.astray.name": "菌丛",
  "ext.foraging.node.astray.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.upheave.name": "翻胃菌",
  "ext.foraging.kind.upheave.description": "吃下后腹中翻腾，会吐掉不少刚吃下的东西。",
  "ext.foraging.item.upheave.name": "奇异的菌",
  "ext.foraging.item.upheave.description": "一株说不出来历的菌。",
  "ext.foraging.item.upheave-roasted.name": "烤过的菌",
  "ext.foraging.item.upheave-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.upheave.name": "菌丛",
  "ext.foraging.node.upheave.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.farsense.name": "通心菌",
  "ext.foraging.kind.farsense.description": "吃下后能隔着墙壁感知附近生物的心跳。",
  "ext.foraging.item.farsense.name": "奇异的菌",
  "ext.foraging.item.farsense.description": "一株说不出来历的菌。",
  "ext.foraging.item.farsense-roasted.name": "烤过的菌",
  "ext.foraging.item.farsense-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.farsense.name": "菌丛",
  "ext.foraging.node.farsense.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.veil.name": "匿影菌",
  "ext.foraging.kind.veil.description": "吃下后身形隐入暗处，更难被发现，自己也看不远。",
  "ext.foraging.item.veil.name": "奇异的菌",
  "ext.foraging.item.veil.description": "一株说不出来历的菌。",
  "ext.foraging.item.veil-roasted.name": "烤过的菌",
  "ext.foraging.item.veil-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.veil.name": "菌丛",
  "ext.foraging.node.veil.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.drowse.name": "沉眠菌",
  "ext.foraging.kind.drowse.description": "吃下后会陷入沉眠，受到伤害才会醒来。",
  "ext.foraging.item.drowse.name": "奇异的菌",
  "ext.foraging.item.drowse.description": "一株说不出来历的菌。",
  "ext.foraging.item.drowse-roasted.name": "烤过的菌",
  "ext.foraging.item.drowse-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.drowse.name": "菌丛",
  "ext.foraging.node.drowse.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.blast.name": "爆燃菌",
  "ext.foraging.kind.blast.description": "吃下去平淡无奇，碰到火却会猛烈炸开。",
  "ext.foraging.item.blast.name": "奇异的菌",
  "ext.foraging.item.blast.description": "一株说不出来历的菌。",
  "ext.foraging.node.blast.name": "菌丛",
  "ext.foraging.node.blast.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.might.name": "蛮力菌",
  "ext.foraging.kind.might.description": "吃下后力气暂时变大。",
  "ext.foraging.item.might.name": "奇异的菌",
  "ext.foraging.item.might.description": "一株说不出来历的菌。",
  "ext.foraging.item.might-roasted.name": "烤过的菌",
  "ext.foraging.item.might-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.might.name": "菌丛",
  "ext.foraging.node.might.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.stiffen.name": "僵缚菌",
  "ext.foraging.kind.stiffen.description": "吃下后全身僵硬，暂时无法动弹。",
  "ext.foraging.item.stiffen.name": "奇异的菌",
  "ext.foraging.item.stiffen.description": "一株说不出来历的菌。",
  "ext.foraging.item.stiffen-roasted.name": "烤过的菌",
  "ext.foraging.item.stiffen-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.stiffen.name": "菌丛",
  "ext.foraging.node.stiffen.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.kind.quicken.name": "迅步菌",
  "ext.foraging.kind.quicken.description": "吃下后身手变得飞快，效果短暂。",
  "ext.foraging.item.quicken.name": "奇异的菌",
  "ext.foraging.item.quicken.description": "一株说不出来历的菌。",
  "ext.foraging.item.quicken-roasted.name": "烤过的菌",
  "ext.foraging.item.quicken-roasted.description": "一株烤过的菌。",
  "ext.foraging.node.quicken.name": "菌丛",
  "ext.foraging.node.quicken.description": "一丛奇异的菌，采过之后会慢慢长回来。",
  "ext.foraging.item.char.name": "焦炭",
  "ext.foraging.item.char.description": "烤过了头，只剩一点焦香。",
  "ext.foraging.appearance.whisper.name": "低语菌",
  "ext.foraging.appearance.whisper.description": "凑近能听见细碎的低语，却听不清在说什么。",
  "ext.foraging.appearance.frostbreath.name": "霜息菌",
  "ext.foraging.appearance.frostbreath.description": "四周的空气总比别处冷一截，指尖碰上去会结一层薄霜。",
  "ext.foraging.appearance.stardust.name": "星屑菌",
  "ext.foraging.appearance.stardust.description": "表面浮着细小光点，像被困住的星屑，怎么拂也拂不掉。",
  "ext.foraging.appearance.echo.name": "回响菌",
  "ext.foraging.appearance.echo.description": "轻敲一下，会传出好几声回音，一声比一声远。",
  "ext.foraging.appearance.rune.name": "符纹菌",
  "ext.foraging.appearance.rune.description": "表面浮现缓慢变换的细小符文，没有人读得懂。",
  "ext.foraging.appearance.prismshard.name": "晶棱菌",
  "ext.foraging.appearance.prismshard.description": "半透明的棱晶质地，转动时把光折成从未见过的颜色。",
  "ext.foraging.appearance.smoke.name": "烟缕菌",
  "ext.foraging.appearance.smoke.description": "像一团凝而不散的灰烟，握在手里却有实在的分量。",
  "ext.foraging.appearance.chime.name": "幽铃菌",
  "ext.foraging.appearance.chime.description": "轻轻一碰，就响起仿佛很远的铃声。",
  "ext.foraging.appearance.moonsand.name": "月砂菌",
  "ext.foraging.appearance.moonsand.description": "像用发光的细沙捏成，捏不散，也不掉渣。",
  "ext.foraging.appearance.mirror.name": "镜面菌",
  "ext.foraging.appearance.mirror.description": "光滑得能照出人影，只是倒影总慢半拍。",
  "ext.foraging.appearance.mistheart.name": "雾心菌",
  "ext.foraging.appearance.mistheart.description": "中心悬着一小团不停翻涌的雾。",
  "ext.foraging.appearance.needlelight.name": "针光菌",
  "ext.foraging.appearance.needlelight.description": "向四面八方射出极细的光针，碰到皮肤却毫无感觉。",
  "ext.foraging.appearance.hush.name": "寂鸣菌",
  "ext.foraging.appearance.hush.description": "拿在手里时，周围的声音都会变轻。",
  "ext.foraging.appearance.warmstone.name": "温石菌",
  "ext.foraging.appearance.warmstone.description": "摸起来像晒过太阳的石头，带着恒定的暖意。",
  "ext.foraging.appearance.glaze.name": "琉璃菌",
  "ext.foraging.appearance.glaze.description": "通体如琉璃，里面封着一缕缓慢旋转的光。",
  "ext.foraging.appearance.afterimage.name": "虹痕菌",
  "ext.foraging.appearance.afterimage.description": "移开视线后，眼前还会留下一道彩色残影。",
  "ext.foraging.appearance.backshadow.name": "逆影菌",
  "ext.foraging.appearance.backshadow.description": "它的影子总是指向光源。",
  "ext.foraging.appearance.hourglass.name": "沙漏菌",
  "ext.foraging.appearance.hourglass.description": "内部有细沙自下而上缓缓流动。",
  "ext.foraging.template.roasted": "烤{{name}}",
  "ext.foraging.template.node": "{{name}}丛",
  "ext.foraging.template.tasted_note": "（吃过，无明显效果）",
  "ext.foraging.template.roast_unknown_note": "（烤后效果未知）",
  "ext.foraging.template.called": "{{name}}（叫作：{{title}}）",
  "ext.foraging.template.unknown_detail": "能稍微充饥。",
  "ext.foraging.fire.roasted": "{{item}}被烤熟了。",
  "ext.foraging.fire.charred": "{{item}}烧成了焦炭。",
  "ext.foraging.fire.burned": "{{item}}烧尽了。",
  "ext.foraging.fire.exploded": "{{item}}炸开了！",
  "ext.foraging.message.revealed": "这是{{name}}！",
  "ext.foraging.message.revealed_roasted": "这是烤{{name}}，烤过之后效果还在！",
  "ext.foraging.message.tasted": "吃下去之后，没有什么明显的感觉。",
  "ext.foraging.message.fed_revealed": "看它的反应，那是{{name}}。",
  "ext.foraging.message.fed_tasted": "它吃了下去，看不出有什么反应。",
  "ext.foraging.message.fed_food": "它吃得很香。",
  "ext.foraging.message.band.hungry": "你的一名同伴饿了。",
  "ext.foraging.message.band.weak": "你的一名同伴饿得有气无力。",
  "ext.foraging.message.band.starving": "你的一名同伴快要饿垮了，再不喂食它会离开。",
  "ext.foraging.message.band.fed": "你的一名同伴吃饱了。",
  "ext.foraging.message.departing": "你的一名同伴饿得受不了，开始离开队伍。",
  "ext.foraging.message.departed": "{{name}}饿得受不了，离开了队伍。",
  "ext.foraging.message.departed_away": "{{name}}在你离开时离队了。",
  "ext.foraging.band.fed": "饱足",
  "ext.foraging.band.hungry": "饥饿",
  "ext.foraging.band.weak": "虚弱",
  "ext.foraging.band.starving": "饥荒",
  "ext.foraging.band.departing": "即将离开",
  "ext.foraging.ui.open": "采食",
  "ext.foraging.ui.title": "采食",
  "ext.foraging.ui.tab.harvest": "采集",
  "ext.foraging.ui.tab.roast": "烤制",
  "ext.foraging.ui.tab.feed": "喂食",
  "ext.foraging.ui.close": "关闭",
  "ext.foraging.ui.cancel": "取消",
  "ext.foraging.ui.unavailable": "当前无法采食",
  "ext.foraging.ui.replay_readonly": "回放中，仅可查看",
  "ext.foraging.ui.harvest.none": "附近没有可采集的菌丛",
  "ext.foraging.ui.harvest.remaining": "剩余 {{remaining}} / {{capacity}}",
  "ext.foraging.ui.harvest.action": "采集（{{ticks}} 刻）",
  "ext.foraging.ui.roast.no_heat": "附近没有可以烤东西的篝火或火炉",
  "ext.foraging.ui.roast.none": "背包里没有可以烤的菌类",
  "ext.foraging.ui.roast.heat.bonfire": "篝火",
  "ext.foraging.ui.roast.heat.hearth": "火炉",
  "ext.foraging.ui.roast.action": "烤制",
  "ext.foraging.ui.feed.no_companion": "身边没有需要喂食的同伴",
  "ext.foraging.ui.feed.choose_companion": "选择同伴",
  "ext.foraging.ui.feed.not_adjacent": "需要站在它旁边",
  "ext.foraging.ui.feed.none": "背包里没有可以喂的食物",
  "ext.foraging.ui.feed.satiety_small": "少量",
  "ext.foraging.ui.feed.satiety_value": "饱腹 {{value}}",
  "ext.foraging.ui.feed.action": "喂食",
  "ext.foraging.ui.hud.title": "同伴饱腹",
  "ext.foraging.ui.companion.unknown_name": "同伴",
  "ext.foraging.ui.rejected": "操作未执行，请重新查看",
  "ext.foraging.error.stale": "情况已经变化，请重新查看",
  "ext.foraging.error.busy": "现在无法行动",
  "ext.foraging.error.distance": "距离太远",
  "ext.foraging.error.input": "这件东西不能这样用",
  "ext.foraging.error.gate": "它现在吃不了东西",
  "ext.foraging.error.unknown_target": "看不到目标",
  "ext.foraging.error.capacity": "背包空间不足",
  "ext.foraging.error.resource_empty": "这里已经采空了",
  "ext.foraging.error.reserved": "这里正被占用",
  "ext.foraging.error.threat": "附近有敌人，无法专心采集",
  "ext.foraging.error.wrong_level": "目标不在这一层"
}
```

---

## 8 测试要求

### 8.1 测试文件（全部登记在 `test-suites.json`）

`test` 套件：`foraging_imports`、`foraging_schema`、`foraging_data_tables`、`foraging_names`、`foraging_module`、`foraging_commands`、`foraging_eat`、`foraging_knowledge`、`foraging_fire`、`foraging_roast`、`foraging_nodes`、`foraging_companion`、`foraging_feed`、`foraging_leak`、`foraging_persistence`、`foraging_combinations`、`foraging_ui`。`drift` 套件：`foraging_trace`。文件名均为 `tests/<名>.test.ts`。除 imports/schema/data_tables/names/module/commands/ui 的纯单元部分外，**一律走真实 Game**（`createWorldHarness` 与真实 `executeCommand`/录像路径），不 mock 底座。

harness 语义（写断言前必读，同 5B §8.1）：被拒命令也 `recorded:true`；`error` 是最后一次世界工作错误，非世界命令不重置；`replay()/seek()` **替换**活局（对照组另建 harness 或先 `save()`）；判断结果看事实、背包、知识视图与 state，不能只看 `error`。布景（放盟友、扣血、放火地形、给背包塞可食物品、调整位置）可用 `worldHarnessGame(h)` 与 §6.0 允许的引擎布景函数；被测动作必须走公开命令。i18n：测试自行初始化 i18next 并加入 foundation `ext.foundation.edible.*`/`status.slumber*`/`world.*` 与本模块 locale（参照 `forageHarness.ts` 的做法，不 import 它）。

### 8.2 必须覆盖的用例

| # | 文件 | 用例 |
| --- | --- | --- |
| T-IMP | imports | 扫描 `foraging/` 下非测试 `.ts/.vue` 的全部 import/动态 import/`import type` 说明符，逐条对照 §6.0 白名单；`stats`、`world` 只允许 `import type` |
| T1 | schema | §5.9 每条规则至少一个拒绝用例（未知键、缺键、越界、重复 ID、错误前缀、生烤意图不一致、ordinal 错、options[1] 非 none、glyph/color 不一致、blast 可烤、节点/分组不对应、模板键缺失、limits 放松、nonEaters 乱序）；指纹稳定；任一机械数组重排或数值变化 → 指纹变化；locale 文本变化 → 指纹不变 |
| T-DATA | data_tables | 逐项断言 §5.2–§5.8 全部数值/ID/顺序（“改数值必须改此测试”的黄金表） |
| T-NAME | names | 外观池 18 个与已知名 12 个比对测试内固定快照数组（人工审阅触发器）；池 ≥ 种类数；外观名与已知名全部以“菌”结尾且互不重复；locale 全部值对 §5.7 禁用词 0 命中；名称不含 ASCII 字母/数字；模板占位符恰为 A.2#17；运行期抽样（多个种子新局、各知识状态、生/烤/节点/绰号）foundation 解析名必为“名单项 / 烤+名单项 / 名单项+丛 / 附注 / 绰号”固定组合之一 |
| T-MOD | module | descriptor 通过 `validateModuleDescriptors`；`toWorldDefinitionPack` 内容与顺序；state 初值/校验/拒绝；`applyFact` 幂等、跳号、64 上限、饱和；揭示判定纯函数全表（12 种 × eat/feed × 生/烤 × 条件真假 × immune/notApplicable）；`qualifies` 全分支（含 queryOptional 抛错/畸形/unavailable）；statSources 三档输出；参与者对畸形输入不抛 |
| T-CMD | commands | 三种 payload 严格键与 `v`；成对 null；非安全整数；prepare 前后 state、两条 RNG、实体/计划 ID、消息不变 |
| T-EAT | eat | 真实吃（`item:execute eat|x`，含 E9 确认 Yes/No：No 录制且 0 成本）：12 种生菌各自意图结果与揭示/tasted；回复满血 tasted、受伤 known；幻觉/暗影已处于时 tasted；免疫（如布景已免疫麻痹）tasted；呕吐饱腹下限 150；力量 +2 持续 400 回合到期回落且无永久成长；沉眠 25 回合受伤醒；爆燃菌吃下只得 150 饱腹 + tasted；自动进食永不选菌（营养降至 ≤1 时只吃原生 FOOD 或无）；烤菌 keep/strip 两种政策（用独立预言选种子，见下）各自结果，keep 揭示同时生菌 known，strip 只 tasted |
| T-KNOW | knowledge | unknown/tasted/known 迁移单调；生/烤独立；名称/详情按 §5.5（经 foundation 解析）在背包、详情、悬停、节点各一；未知详情无饱腹；起绰号（`call|x|标题`）显示、known 后不显示但保留；鉴定卷轴菜单不含菌、探测魔法无标记、最后种类升格不触发、幻觉中名称不随机化 |
| T-FIRE | fire | 布景火地形（spawn-fire）、地面燃烧、扔进火、玩家着火瞬间背包（1/3，固定种子下抽取位置与结果确定；背包无可食物品时两流计数不变）、熔岩：生→烤→焦炭→烧尽链与对应消息；冷却内不二次接触；爆燃 1/2/3 个 DF 选型；可见爆炸揭示、视野外爆炸不揭示、背包爆炸揭示；连锁顺序确定 |
| T-ROAST | roast | crafting 火炉（真实放置）与 combat 篝火两种热源各一次 `roast`：生→烤、烤→焦、焦→烧尽、爆燃在热源格爆炸；未装提供方时投影 `heatSources` 为空且命令 `C5_DISTANCE/C5_UNKNOWN_TARGET` 0 成本；超距/无交互线/陈旧 stamp 拒绝 0 成本；扔进热源格一次接触 |
| T-NODE | nodes | 新局逐层（D1–D12 抽样多个种子）：每层数量区间、种类 ⊆ 深度合格集合、所有节点 glyph/color 相同、显示名为“外观名丛”且吃后（已知）变“已知名丛”；整局 ≤120；收据 completed/skipped；同种子有/无 foraging 的地形、怪物、原生物品与两流计数逐项相同（实体 ID 允许偏移）；采集 100 tick 得 1、3 次后空、32000 tick 回 1、满容量不积余 |
| T-COMP | companion | 资格：普通盟友挂载 1800；`MONST_INANIMATE`、限时召唤、giants 群体成员（核心挂、成员不挂）、nonEaters 模板、stub 居民（测试内 override 模块提供 `settlement.resident-status.v1` 返回 `{resident:true}`）不挂；失去盟友摘除；时间推进：1800→hungry（≤300）→weak（≤150）→starving（0）精确 tick（200 tick/点）；weak/starving 下 `native.accuracy`/`physical-damage-dealt` 查询值与预期一致；饥荒 30000 tick 后：视野外立即退役（不发死亡事实/XP、携带物落地、消息含名字）、视野内离开态 ≤20 回合退役且不攻击；离层后回来入层物化与 `departed_away`；喂食清除离队计时；同伴不掉血；复活同伴重新 1800 |
| T-FEED | feed | 相邻可见同伴：原生口粮 +1800、芒果 +1550、各菌饱腹与意图作用于同伴；揭示矩阵（§6.4：回复受伤才揭示、心灵感应/幻觉/暗影/爆燃只 tasted）；超量确认 Yes/No；拒绝 0 成本：非相邻、不可见、非同伴、失能、离开中（`C5_GATE`）、物品非食物、陈旧 targetRevision/stamp、跨层 |
| T-LEAK | leak | 未知状态下执行吃、扔、丢弃、装备尝试、起绰号、采集、烤制、喂食、爆炸、存读后：日志全文、投影 JSON、UI 渲染文本中不出现 `ext.foraging.`、`foraging.` 定义 ID、任何未揭示种类的已知名或饱腹精确值；未知菌全部生菌外观同字形同色 |
| T-PERSIST | persistence | 吃/烤/爆炸/喂/离开中/退役后/沉眠中/力量生效中/节点部分采空且有再生余数 各存一次档：load 后继续与不存档结果相同；整局 replay 首个不一致为 null；seek 到各点续录一致；面板反复开关/切页签前后 digest 与两流不变；坏 state（越界、乱序 history、未知键）读档被拒 |
| T-COMBO | combinations | foraging 与 growth/narrative/combat/giants/crafting 各自及全开：新局、一次采集、一次吃、save/load/replay 成功；+combat 篝火烤制；+crafting 火炉烤制、crafting 包指纹不变；+giants 群体核心挂载与整体退役；settlement 若已安装则加“仅 settlement”“foraging+settlement”两行，未安装则该行不存在（不得硬引用 settlement） |
| T-UI | ui | `ui/view.ts` 对畸形 DTO fail-closed；三页签渲染；相邻判断与自动选中；未知饱腹显示“少量”；连点只提交一次；回放只读；seek 清草稿；`presentationBusy` 关闭面板；HUD 只在有饥饿/离开同伴时出现（SFC 用仓库共享 harness） |
| T-TRACE | trace（drift） | 重放 §8.3 两条 trace：`ext` 命令逐条 `{recorded,error}` 与 trace 一致；原生命令核对录制条数增量；终局背包（显示名+数量）、知识视图、state、digest 与 trace 末尾一致 |

烤制政策的独立预言：测试内用 `node:crypto` 按 5A4 §2.4 算法（`c5-derive-seed-v1`/`c5-derive-v1`、拒绝重抽 `range`）独立复算 `foraging.roast-policy` 第 k 种的选项，盐取 `worldHarnessGame(h).extensionRuntime.worldDefinitionFingerprints().foraging` 去掉 `sha256:`；以此挑选 keep 与 strip 的种子。预言与实际不符 → 记 SDK 问题，不改断言迎合。

### 8.3 自然公开命令 trace

只用公开命令（原生移动/旅行/下楼、`item:execute` 吃/扔/起绰号、`mouse_travel` 选扔点、foraging 的 harvest/feed/roast、crafting 的 harvest/place-station、确认答案）。trace JSON 字段同 5B：`seed`、`mode`、`modules`、`commands:[{action,data,answers?,expect}]`、`final:{inventory,knowledge,digest}`；`ext:command` 的 `expect` 为 `{recorded,error}`，原生命令为 `{recorded}`。

- **trace A**（`data/natural-trace.json`，`modules:['foraging']`）：新局 → 走到 D1 菌丛 → 采空（3 次）→ 吃 1 个（“不太饿”确认先答 No 一次、再答 Yes；开局营养 1800 时必触发，未触发则换种子）→ 扔 1 个到相邻地面 → 给 1 个未知菌起绰号 → 下 D2 → 再采 ≥1 个。种子从 1 起顺序尝试，D1 无可达菌丛或开局可见敌人导致采集被拒则换种子，最多 64 个，记录选择过程。
- **trace B**（`data/natural-trace-hearth.json`，`modules:['crafting','foraging']`）：新局 → 采 crafting 石料补足火炉材料 → `place-station` 放火炉 → 采菌 ≥2 → 在火炉旁 `roast` 一堆（生→烤）→ 吃 1 个烤菌（答确认）→ 再 `roast` 剩余烤菌（烤→焦炭）。同样顺序选种子 ≤64。
- 喂食不进自然 trace（自然盟友依赖种子与机关，不保证可达），由 T-FEED/T-COMP 真实命令覆盖。
- 报告写明两条 trace 的种子、命令数、总 tick、录像字节数。

---

## 9 门禁

所有命令在仓库根执行，统一 Node 24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=2`。报告只写实际运行过的命令、退出码、测试数量（passed/skipped/todo/failed）、耗时；未运行的写“未运行”及原因。

### 9.1 开发期（每个里程碑结束时，仅功能门禁）

| 里程碑 | 内容 | 门禁 |
| --- | --- | --- |
| M1 | 数据包、schema、指纹、locale、命名（T-IMP、T1、T-DATA、T-NAME） | boundary、vue-tsc、foraging 定向测试 |
| M2 | descriptor/module/state/命令/参与者纯函数（T-MOD、T-CMD） | 同上 + build |
| M3 | 吃、知识、火、烤制、节点（T-EAT、T-KNOW、T-FIRE、T-ROAST、T-NODE） | boundary、vue-tsc、foraging 定向测试 |
| M4 | 同伴、喂食、泄露、持久化（T-COMP、T-FEED、T-LEAK、T-PERSIST） | 同上 |
| M5 | UI（T-UI）+ 本地浏览器自查 | 同上 + build |
| M6 | 自然 trace 与组合（T-TRACE、T-COMBO） | 同上 + 受影响的既有测试（若有，逐文件列出） |

- boundary = `node scripts/check-module-boundaries.mjs`；vue-tsc = `npx vue-tsc -b`；build = `npm run build`。
- foraging 定向测试 = `npx vitest run src/ext/modules/foraging/tests --maxWorkers=2`（若基线要求经 `scripts/run-test-suite.mjs` 的发现环境，用其等价定向方式并在报告写明）。
- 开发期不跑完整 `npm test`、全部 `test:ext`、删除矩阵；不跑 `ce:fetch`、`test:full`、`test:gen`。

### 9.2 5G 收尾（全部完成后一次，同一最终候选树）

1. `node scripts/check-module-boundaries.mjs`
2. `npx vue-tsc -b`
3. `npm run build`
4. `npm run test:ext`（全部扩展测试**一次**，含其他模块与 foundation ext 测试）
5. `npm run test:drift`（**一次**；含 foraging 两条 trace）
6. 组合 smoke：`node scripts/check-module-composition-smoke.mjs --output <仓库外目录>/smoke.json`，覆盖**全部** `<SUBSET_COUNT>` 个已安装模块子集，engine + 当次构建浏览器；浏览器不可用记 **blocked**（不得记通过），并另跑 `--engine-only`。任何失败按真实失败归因。
7. 删除（removal 档，两行）：
   - 只删 foraging：`NODE_OPTIONS=--max-old-space-size=3072 node scripts/check-module-removal.mjs --profile=removal --retain=<INSTALLED_MODULES 码点序逗号分隔> --maxWorkers=2 --output=<仓库外目录>`
   - 只留 foraging：同上 `--retain=foraging`
   - 每行内含 composition-smoke 闸门，结果照实记录。
8. 浏览器视口验收（§7.3）：1440×900、390×844、320×844 × 普通/沉浸 × 四种地图模式；覆盖长名称、满背包、无热源、多同伴、离开中同伴、连点、blur、触摸、回放；真实设备与模拟分别标注；截图留仓库外，不提交。

**不在 5G 范围**：完整 `npm test`、全量删除矩阵、5Z 体积/性能。

---

## 10 交付物、报告与回复格式

### 10.1 `docs/ext/phase5g.report.md`

按以下节序，事实写清，不夸大：

1. **结论**：完成/部分完成；一句话说明仅 foraging 是否可玩完整闭环。
2. **基线与环境**：基线 commit、分支、最终 commit、Node 版本、§2 冻结文件哈希比对结果。
3. **交付清单**：新增文件列表（全部在允许范围内的声明 + `git diff --stat <BASE_COMMIT>..HEAD` 摘要）。
4. **版本与身份**：module/rules 版本、指纹值、state schema、payload v、worldSdk/edible SDK。
5. **数据一致性**：声明 §5.10 数据与 §7.4 名称逐字照抄（指向 T-DATA、T-NAME）；禁用词扫描结果。
6. **SDK 差异与问题清单**：每条含 任务书条款 / 实际行为 / 最小复现（测试名或命令）/ 对 foraging 的影响 / 建议的本地修订。没有则写“无”。
7. **门禁结果表**：§9.1 末次与 §9.2 全部命令、退出码、数量、耗时。
8. **自然 trace 与持久化证据**：两条 trace 的种子、命令数、总 tick、录像字节数、replay/seek 结果。
9. **组合与删除**：全部子集与两行删除结果表。
10. **浏览器与视口**：矩阵结果，真实/模拟分类，已知问题。
11. **自行决定事项**：按 §12.2 作出的全部决定。
12. **交接 5D**：`food.ingredient.mushroom` 标签计数、`settlement.resident-status.v1` 消费形状（§6.5）、厨师不得读种类/改知识。
13. **未覆盖 / 待本地集成**。

### 10.2 `docs/ext/foraging-config.md`

参照 `docs/ext/crafting-config.md`/`giants-config.md`：安装与通用约定；kinds/可食定义/节点/分组/知识组/需求/companion/limits 每字段类型、范围与含义；命名规则与禁用词（§5.5、§5.7）及“改名单须审阅”流程；校验规则；版本与指纹（改什么会改指纹、外观分配/烤制政策/菌丛位置随之变化、旧档被拒）；与 foundation 的分工（吃/扔/火/知识解析/需求/离队/放置归 foundation）；三个完整配置例子（新增一种菌及其烤菌/节点/分组成员；调整同伴饥饿速度与档位；从 nonEaters 增删一个模板）；作者自检清单。

### 10.3 提交

在 `ext/phase5g` 上按逻辑分提交（例如 data+schema+names / module+participants / projection+tests / UI / trace+docs），提交信息英文前缀 `feat(foraging): …` / `test(foraging): …` / `docs(ext): …`。先跑完门禁并确认结果，再单独推送。

### 10.4 最终回复模板（≤30 行，中文）

```text
5G foraging：<完成|部分完成>；仅 foraging 闭环：<可玩|不可玩，原因>
分支 ext/phase5g，最终 commit <sha>；报告 docs/ext/phase5g.report.md；配置手册 docs/ext/foraging-config.md
基线 <BASE_COMMIT>；冻结文件哈希：<全部一致|差异 N 项（见报告 §2）>
门禁：boundary <✓/✗> · vue-tsc <✓/✗> · build <✓/✗>
      test:ext <passed/failed/skipped>（一次）· test:drift <passed/failed>（一次）
      组合 smoke <通过数>/<SUBSET_COUNT>（浏览器 <通过|blocked>）
      删除：只删 foraging <✓/✗> · 只留 foraging <✓/✗>
自然 trace：A 种子 <n>，<命令数> 条，<tick>；B 种子 <n>，<命令数> 条，<tick>
视口：1440/390/320 × 普通/沉浸 × 4 模式 <结果>（真实设备 <有|无>）
SDK 问题清单：<N> 条（最严重一条一句话）
自行决定事项：<N> 条
未覆盖：<列表或“无”>
```

---

## 11 不得修改清单

| 类别 | 内容 |
| --- | --- |
| 共享源码 | `src/engine/**`；`src/ext/*.ts`（runtime/types/descriptor/catalog/world/worldSdk/edibleSdk/worldEdible/kindKnowledge/actorNeeds/stats/structureTypes/fingerprint 等）；`src/ext/testing/**`（harness、forageHarness、fgfixture、骨架）；`src/ext/ui/**`；`src/ui/**`；`src/components/**`；`src/App.vue`；共享 i18n（`src/locales/**`） |
| 其他模块 | `src/ext/modules/{growth,narrative,combat,giants,crafting,settlement…}/**` |
| 脚本与配置 | `scripts/**`（含 `test-suites.json`、`u03-state-contract.json`、`recording-digest-contract.json`、发现器、门禁脚本）、`package.json`、lock 文件、`vite.config.*`、`tsconfig*.json` |
| 基线 | 生成基线、黄金 trace、其他模块 trace 数据 |
| 文档 | 除 `docs/ext/foraging-config.md`、`docs/ext/phase5g.report.md` 外的所有文档（含 README、本任务书、设计稿、合同） |
| 版本 | `FOUNDATION_PROTOCOL`、`EDIBLE_SDK_VERSION`、whole-run/录像/来源/实体格式号、其他模块的 module/rules/state 版本 |
| 本包决定 | §4 版本与身份、§5 全部 ID/数值/顺序/名单/上限、§6.3 payload 形状、§7.4 名称类文本 |

禁止的实现手段：模块内另建调度器、时钟、随机源或 WeakMap 动作根；自行计算外观分配或烤制政策；monkeypatch `Game`/runtime；在 `commands[action]` 里实现 harvest/feed/roast；直接写 Game 字段或读 `game.monsters` 等引擎对象（UI 只用 `readModuleView`、`readDisplayFrame`、`executeCommand`）；`Math.random`、`Date`、全局 RNG；模块内绘制地图格；新增 window 键盘监听；为让门禁通过而 skip/todo/放宽任何既有测试。

---

## 12 已预先作出的决定与 dot 自主裁决规则

### 12.1 已决定（不再讨论）

1. 模块 id `foraging`，版本 1.0.0，state schema 1，payload v1，`defaultEnabled:false`。
2. §5 全部数据，包括定义 ID 命名、生/烤/焦顺序、烤制 derived-choice 形状（options[0] 保留、[1] 去除、ordinal = kinds 下标）、节点与分组、需求声明、nonEaters、limits。
3. 揭示判定按 §6.4 表；揭示烤菌同时揭示生菌；生菌已知不推断烤菌。
4. 同伴惩罚经 statSources 读自有组件 `hunger`；离队消息经 `hooks.actorDeparted`；档位消息无名字。
5. UI：模块栏命令 + 懒加载三页签面板 + 同伴 HUD；吃/扔/绰号走原生背包；确认对话归 foundation。
6. 不提供任何 optional query；只消费 `settlement.resident-status.v1`（§6.5 形状）。

### 12.2 未写明细节的裁决规则（按顺序适用）

1. 任务书文字与基线实际 SDK/fgfixture 冲突 → 以基线实际代码为准，报告 SDK 差异节记录。
2. 实际 SDK 缺少本包必需的能力（例如 message 参数不能带名字、投影缺 displayName、热源未识别）→ 不绕过；受影响用例写入“待本地集成”并附复现，继续做其余部分。
3. 纯 UI/代码组织细节 → 自行决定，遵守 §7.3 可用性要求，列入“自行决定事项”。
4. 数值、ID、版本、名称 → 不改；若确实无法满足（例如 SDK 校验拒绝某字段），保持本包数值，在报告提出修订建议，相关测试按第 5 条处理。
5. 测试发现“任务书语义 ≠ foundation 实际行为” → 不改 foundation，也不把断言改成迎合错误行为；提交的测试套件中不保留该失败断言（也不用 skip/todo），把“期望/实际/复现步骤”写入 SDK 问题清单，由本地修底座后补回。
6. 任何可能泄露种类的取舍（显示、排序、过滤、消息、错误文案）→ 选择不泄露的一方，并列入自行决定事项。
7. 文案需要新增键 → 只可新增 UI/错误类键，文本须通过 §5.7 禁用词；不得新增或改动名称类键。

### 12.3 本包自行决定、需维护者派发前签认的事项

| # | 事项 | 决定 | 理由 |
| --- | --- | --- | --- |
| 1 | 定义 ID | 生 `foraging.<kind>`、烤 `foraging.<kind>-roasted`、焦 `foraging.char`、节点 `foraging.<kind>-patch`，可读 ID | 泄露靠 foundation 显示路径与 T-LEAK 守护，不靠混淆 ID |
| 2 | nameKey 中性兜底文本 | 生“奇异的菌”、烤“烤过的菌”、节点“菌丛”，全部相同 | 防审查 P6 类回退路径泄露 |
| 3 | 烤菌/焦炭外观 | 烤菌 `菌` `#C8966A`（全同）；焦炭 `炭` `#6B5B53` | 设计稿未定；生/烤可区分、种类不可区分 |
| 4 | “always” 揭示语义 | 未免疫、未不适用即揭示，即使状态已存在 | 设计稿 §3 只给幻觉/暗影设“吃前未处于”条件 |
| 5 | 同伴揭示前提 | 另需 `visibleToPlayer` | 设计稿 §7.5“反应可见” |
| 6 | 背包内爆炸 | 视为可见，揭示爆燃菌 | 设计稿 §6.3“或在玩家背包内” |
| 7 | 离队 grace | 2000 tick（20 回合）；deadline 30000 tick | 设计稿 §7.2/§7.4 数值换算 |
| 8 | 档位 ID | fed/hungry/weak/starving | 设计稿 §7.2 四档 |
| 9 | 档位消息无名字，离队消息有名字 | `NeedEventFact` 无名字；`actorDeparted` 带 `actor.name` | SDK 事实；若维护者要求名字，需底座给需求事件补名字 |
| 10 | 侧栏/盟友详情显示饱腹档 | 首版不做（共享组件不可改），改为模块 HUD + 喂食页 | 设计稿 §15 要求侧栏；需本地后续接线 |
| 11 | nonEaters 名单 | §5.8 的 20 个模板 | Q10=A 要求维护者审阅 |
| 12 | 居民查询形状 | 输入 `{actorId}`，仅 `{resident:true}` 视为居民；其余（含缺席/畸形）视为非居民 | settlement 尚未定义；写入交接 5D |
| 13 | 烤制页不按种类过滤 | 未知爆燃菌可选，烤即在热源爆炸 | 过滤会泄露种类 |
| 14 | 自然 trace 拆为两条，喂食不入 trace | A 仅 foraging；B foraging+crafting 火炉 | 无提供方时无热源；自然盟友不可保证 |
| 15 | 名称与文案 | §5.6 外观名/描述逐字沿用设计稿；12 条已知描述、模板、消息、UI 文案为本包新写；“幻彩菌”保留 | 需维护者终审命名规则合规 |
| 16 | 禁用词表扩充 | 设计稿列表 + 12 个追加词 | 更严格，现有文本全部通过 |
| 17 | 导入白名单测试 | 模块自带 `foraging_imports`；建议维护者把边界脚本的 crafting 白名单推广到 foraging（§A.3#14） | 当前边界脚本只对 crafting 严格 |
| 18 | might 同伴效果 | `native.physical-damage-dealt` temporary `more` +2500 bp | 设计稿“伤害 more +25%”；在 0…40000 预算内 |
| 19 | 模块 state 不存种类 | history 只存枚举结果 | 防投影/存档检查泄露 |
| 20 | limits | `kinds 32、appearancePool 64、edibleItems 128、maxStack 20、nodesPerLevel 3、nodesPerRun 120、nonEaters 64、history 64` | 与设计稿 §8.1 和 SDK 上限一致 |
