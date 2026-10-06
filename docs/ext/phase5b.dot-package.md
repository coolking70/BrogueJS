# 5B dot 任务包：独立 `crafting` 内容模块（整包一次派发）

> 状态：**定稿，可派发**（2026-10-07 按冻结 worldSdk 1 的实际代码完成 §A 全部核对并改正本文；基线 `ext/phase5b-base`，代码 = `2d870a2`）。本包的自行决定（§12.1 等）已由维护者 2026-10-06 表态“全部按推荐”批准。同日按已批准的[野外采食方向](phase5-foraging.md)修订：删除菌类节点、菌材料、口粮物品与“菌→口粮”配方，玩家不能自制食物（见 §1.4）。由 Claude 依据已批准的[阶段5设计](phase5-settlement-world.md)（P5-D01–D14 全 A）、[C5-1 合同 r2](phase5a-contract.md)、[5A0 报告](phase5a0.report.md) §5.3–5.6 已批准数值及其 §7 r2 修订编写，并按 [5A2 报告](phase5a2.report.md) §7/§9 与独立审查的 5B 不符项清单定稿。维护者把下方提示块原样转贴给 dot 即可。**合同文字与基线实际 SDK 不一致之处已在本文改正为实际行为；仍有冲突时以基线代码为准（§12.2-1）。**

---

## 0 转贴给 dot 的提示块（维护者复制此块）

```text
你是 BrogueJS 扩展原型的 5B 执行者。任务：在独立模块目录 src/ext/modules/crafting/ 内实现完整的 crafting（资源采集与合成）内容模块，一次长块独立开发直到完成全部交付，期间不要向维护者提问。

基线与分支：
- git fetch origin && git switch -c ext/phase5b origin/ext/phase5b-base
- 该 tip = 代码基线 2d870a2（ext/phase5：5A1+5A1-R+5A2 含审查修复，冻结 worldSdk 1，FOUNDATION_PROTOCOL=7）+ 一个只改 docs/ext/phase5b.dot-package.md 的定稿提交。开工先确认 `git diff --stat 2d870a2 HEAD` 只列出该文件、`git status` 干净。
- 只推 ext/phase5b；不推 ext/phase5、ext/phase5b-base、ext/foundation、main；不打 tag；不合并、不 rebase 任何分支。
- 本地 5A2-S（属性读点调整，不改 worldSdk/harness/骨架）可能与你并行开发。你只在下面允许的路径内工作，不要碰任何共享文件；与 5A2-S 的集成 rebase 和 trace 重跑由维护者完成，你不需要预留兼容。

唯一任务书：docs/ext/phase5b.dot-package.md（本提示与其冲突时以该文件为准；它的 §A 是维护者已完成的核对记录，可作背景）。先读 AGENTS.md、docs/ext/README.md，再完整读该任务书；它引用的 C5-1 合同（docs/ext/phase5a-contract.md §4.2、§5、§8、§9、§10.1）、5A0 报告 §5/§7、5A2 报告 §7/§9 只作背景，数值、ID、文案、版本均以任务书为准；合同文字与基线实际 SDK 冲突时以基线代码为准。

硬规则（详见任务书 §11）：
1. 只改 src/ext/modules/crafting/**、docs/ext/crafting-config.md、docs/ext/phase5b.report.md。其他任何文件（Game/引擎、src/ext/*.ts、src/ext/testing/**、src/ext/ui/**、其他模块、scripts/**、package.json、配置、基线/trace、其他文档）一律不改。
2. 生产代码只可 import：src/ext/worldSdk、src/ext/types、src/ext/descriptor、src/ext/fingerprint、src/ext/world（仅 import type）、src/ext/ui/**、src/ui/** 与模块自有文件（边界脚本强制）；测试可另用 src/ext/testing/worldHarness 等。
3. 不改任务书给定的 ID、数值、上限、版本号；不增加任务书非目标中的玩法。
4. SDK 缺口/缺陷/与合同不符：不绕过、不在模块里另造调度器或补丁，记入报告“SDK 问题清单”（含最小复现），其余工作继续推进。基线既有失败（例如任务书 §9.2 写明的组合 smoke 失败）照实记录，不修共享脚本。
5. 遇到任务书未写明的细节，按任务书 §12 的裁决规则自行决定并在报告“自行决定事项”列出，不要停下来问。
6. 开发期每个里程碑只跑任务书 §9.1 的功能门禁；全部完成后跑一次 §9.2 收尾门禁。不跑完整 npm test、不跑全量删除矩阵、不跑 ce:fetch/test:full/test:gen。环境 Node 24.19.0、NODE_OPTIONS=--max-old-space-size=3072、vitest --maxWorkers=2。

交付：按任务书 §10 写 docs/ext/phase5b.report.md，按逻辑分若干提交推到 ext/phase5b，最后回复一段 ≤30 行的中文摘要（最终 commit、报告路径、门禁结果一览、SDK 问题清单条数、未覆盖项）。
```

---

## A 派发前维护者检查清单（已全部完成；dot 只作背景阅读，不需执行）

2026-10-07 由 Claude 按冻结 worldSdk 1 的实际代码逐项核对完毕，差异已**直接改入本文对应段落**（dot 不需自行适配）。核对树：`ext/phase5b-base` @ `2d870a2`（= `ext/phase5` = 5A1+5A1-R+5A2 含审查修复 H1–H3/M1–M5/L1–L11）；依据 [5A2 报告](phase5a2.report.md) §7、§9“SDK修订冻结清单”与独立审查 §5 的 5B 不符项清单。

### A.1 占位符（已填）

| 占位符 | 实际值 | 证据 | 状态 |
| --- | --- | --- | --- |
| `<BASE_5A2_COMMIT>` | 代码基线 `2d870a2`；派发 tip = `origin/ext/phase5b-base`（`2d870a2` + 仅本文件的定稿文档提交） | `git log` / `git diff --stat 2d870a2 origin/ext/phase5b-base` 只应列出本文件 | ☑ |
| `<FOUNDATION_PROTOCOL>` | **7** | `src/ext/descriptor.ts:5` `export const FOUNDATION_PROTOCOL = 7 as const;` | ☑ |
| `<MODULE_VERSIONS>` | growth **1.7.0**、narrative **1.4.0**、combat **1.6.0**（state schema 4）、giants **1.0.0** | 各模块 `definitions.ts` 的 `*_VERSION` 常量 | ☑ |
| `<SDK_SHA256_worldSdk>` | `e2f3cbbf06fa9afd939ec3a3a5f75193d47003a08410fd1c5d2e8899051da05f` | `shasum -a 256 src/ext/worldSdk.ts`，与 5A2 报告 §7 一致 | ☑ |
| `<SDK_SHA256_harness>` | `0cc14ecd4cf734591616b291239b3ef23b99e451af6f954a3de6de3f3143ba26` | `src/ext/testing/worldHarness.ts`，同上 | ☑ |
| `<SDK_SHA256_skeleton>` | 目录仅 `index.ts`：`f4d70fd3b9be75444f181448ced4005c20d546c0cff7ce11eef366bb4a1a5372`；聚合 `7da2f828d4363cb8c09e024be4ac1ca32d907298f00d8ec029ab87f7aad5c6ad`（排序的 `相对路径\t文件SHA\n` UTF-8 的 SHA-256） | 同上 | ☑ |
| （补充）world-work-basic fixture | `src/ext/testing/fixtures/worldWorkBasic.ts`：`a0267454f15f1b3c90649ab1a4945ddf1e055d40dc0072e776ab74265ca61ee1` | 同上 | ☑ |
| `<5A2S_STATUS>` / `<5A3_STATUS>` | 均**未合入**基线 | `git log 2d870a2` | ☑ |

### A.2 名称核对（合同 §9 → 实际导出）

| # | 项目 | 实际（冻结 worldSdk 1） | 改动的本文段落 | 核对 |
| --- | --- | --- | --- | --- |
| 1 | 公开入口 | `src/ext/worldSdk.ts` 存在，但**不是唯一入口**：生产代码另需 `ext/types`（ExtensionModule、Json）、`ext/descriptor`（FOUNDATION_PROTOCOL、ModuleDescriptor）、`ext/fingerprint`（extensionDataFingerprint）、`ext/world`（仅 `import type`，ExtensionProjectionContext）；另可用 `src/ext/ui/**`、`src/ui/**`。`check-module-boundaries.mjs` 对 crafting 生产代码强制此白名单 | §6.0（新增） | ☑ |
| 2 | 七个定义类型 | 名称与字段逐字一致；静态校验器 `assertWorldDefinitionPack`（`src/engine/Core/WorldDefinitions.ts`）严格键集、tags 码点升序、native 行 maxStack 恰 1（ration 为 99）、tool.tag ∈ tags | §5.8 已实测通过（见 A.5） | ☑ |
| 3 | prepare SDK | 名称一致。请求对象严格键集：`planTimedWork` 必带 `kind` 且不带 `v`；`planStationPlacement` 用 `at:{x,y}`；句柄 `operation` 必须等于信封 action（否则 `C5_BAD_PAYLOAD`）；未知 recipe 由 foundation 返回 `C5_BAD_DEFINITION` | §6.3 | ☑ |
| 4 | 参与者/事实 | `onCommitted(fact, tx)`；`tx.state` 深冻结，`replaceState` 写自身 JSON，同步、返回 void。`CommittedWorkFact.result` 为**四值** `accepted/completed/interrupted/skipped`；每次接单（harvest/craft/place-station）先发 `accepted`（completedBatches 0、completionOrdinal 0），完成再发 `completed`；取消发 `operation:'cancel'`、`interrupted`；启动礼包 `startup`、`completed/skipped`，definitionId 为礼包首个物品 | §6.4 | ☑ |
| 5 | 读 SDK | `ExtensionProjectionContext.worldWork`（`src/ext/world.ts:28`）；仅在模块声明 worldDefinitions、world5 存在、包内有本 owner 的 items 行时提供 | §7.1 | ☑ |
| 6 | DTO 字段 | 一致。`ItemRead.available` 恒等于 quantity（不扣预留）；`WorkContext.stations` = 本层自有全部 + 已见他人；`WorkContext.containers` = 本层已见 chest；`ResourceNodeRecord` 无 nameKey/glyph（取自本包定义）；节点查询**不**返回可采资格 | §7.1 | ☑ |
| 7 | 模块字段 | `worldDefinitions` / `worldWorkCommands`（每项恰一个键 `prepare`，且不得与 `commands[action]` 同名）/ `worldWorkParticipant`（恰一个键 `onCommitted`） | §6.2 | ☑ |
| 8 | `worldSdk: 1` 位置 | 只在 `ModuleDescriptor`（可选键）；ExtensionModule 上没有。声明世界字段却缺 worldSdk → 构造失败 `C5_BAD_VERSION` | §6.1 | ☑ |
| 9 | 错误码 | **33** 个（5A2 任务书“34”有误）。prepare 可直接返回 `{ok:false,code,field}` 字面量，但 code 必须属于 33 码、field 为 null 或字符串，否则 foundation 降为 `C5_PROVIDER` | §6.3 | ☑ |
| 10 | 常量 | `C5_CONTRACT_VERSION='1.0.0'`、`WORLD_SDK_VERSION=1`；worldSdk 另导出纯函数 `levelKey`/`compareLevelRefs`（来自无引擎依赖的 `worldBasics`） | §6.0 | ☑ |
| 11 | `CraftingCommand` | 已由 worldSdk 导出（module 字面量 `'crafting'`），另有 `CraftingAction` | §6.3 | ☑ |
| 12 | harness | `createWorldHarness`（`src/ext/testing/worldHarness.ts`）+ 测试专用 `worldHarnessGame(h)`；`WorldHarnessOptions`/`WorldHarness` 由 worldSdk 导出；fixture 名 `world-work-basic`（加入 `c5fixture`）、`crafting-skeleton`（加入 `craftskel`）。行为：被拒命令也 `recorded:true`；`error` = 最后一次世界工作错误，非世界命令不重置，接单成功但同命令内被中断时仍为 null；`replay()`/`seek()` **替换** harness 的活局；`world5().tickets` 只含活跃票据，终结票据见 `terminalTickets`（全 owner 共享最近 64 条），另有 `definitionsFingerprint` | §8 | ☑ |
| 13 | i18n 键 | `ext.foundation.world.error.<去 C5_ 小写>`（如 `resource_empty`、`unknown_target`），zh_CN 中 33 键齐全；`ext.foundation.world.confirm.tool-break` ✓；另有 `ext.foundation.world.message.{completed,interrupted,startup}` | §7.4 | ☑ |
| 14 | 续作 | autoAction `{kind:'auto_work',ticketId}`，续作命令 `auto_step`；harvest 与单批 craft 不写 auto_work；`runAutoUntilIdle` 覆盖 auto_work | §6.5 | ☑ |

### A.3 行为核对

| # | 问题 | 实际 | 本文处理 | 核对 |
| --- | --- | --- | --- | --- |
| 1 | kit 优先 | 是（5A2 D16）：背包有 kit 扣 1 个 kit，否则扣材料；不弹确认、不双扣 | 原假设成立 | ☑ |
| 2 | `WorkContext.stations` 范围 | 当前层自有工位全部 + 已见他人工位；DTO 带 levelRef | 原假设成立；§6.3 计数仍按 `definitionId` 前缀过滤 | ☑ |
| 3 | 地图对象 owner 与渲染 | interactable owner = 定义模块（`crafting`）；地图/悬停/详情归 foundation；节点交互距离固定 1；**工位资格看 `StationRead.workPositions`**（同时使用 interactionDistance） | §7.1 `inReach` 改为 workPositions | ☑ |
| 4 | 日志 | foundation 写完成/中断/礼包日志（取配方/节点/工位 nameKey；礼包取首个物品）；玩家主动 cancel-work 也写“中断” | 原假设成立 | ☑ |
| 5 | native glyph/color | 只做静态校验，产物外观沿原生模板 | 原假设成立 | ☑ |
| 6 | prepare 无 state | 是 | 原假设成立 | ☑ |
| 7 | `c5fixture` 同局 | 可以。fixture 在 D1 玩家附近放自己的节点、桌（tags `["table"]`，不满足本包 `station.table`）与一个容量 16 的箱（owner `c5fixture`）；crafting 可把该箱作来源/目标（同层、Chebyshev ≤1、交互线、hasMemory）；fixture 会占开局附近格子 | §8.2 T7/T10 说明 | ☑ |
| 8 | harness 原生命令 | `command(action,data)` 直接调用原生 `executeCommand` | 原假设成立 | ☑ |
| 9 | removal/composition/测试发现自动发现新模块 | 在 `/private/tmp` 副本加最小 crafting 实测：catalog 安装列表、`check-module-removal.mjs --plan --profile=removal --retain=…`（两行矩阵）、`scripts/test-discovery.mjs`、`check-module-boundaries.mjs` 均自动发现 crafting。**但** `check-module-composition-smoke.mjs` 在基线本身（不加 crafting）即失败：`recordingOrigin.initial` 为 undefined（录像来源已升 version 2，脚本未跟上） | §9.2 写明“基线既有失败”的处理 | ☑ |
| 10 | 放置/礼包不碰原生 RNG | 是（c5-place-v1 SHA 拒绝抽样，不抽原生 RNG；固定向量见 `ext_world_work_boundaries`）；实体 ID 会被占用而偏移 | 原假设成立（T8 已允许 ID 偏移） | ☑ |

### A.4 合入与派发

- ☑ 本文件定稿提交于 `ext/phase5b-base`（父提交 `2d870a2`）并推送 `origin/ext/phase5b-base`；dot 读的是该分支里的版本。
- ☑ 5A2 未改 §5 任何数值相关上限（material/kit stack ≤99、tool stack 1、batch 1…16、workTicks ≤10000、节点每层合计 ≤32/整局 ≤512、工位全局 ≤128、无 unitWeight）。
- ☑ 提示块占位符已替换。
- ☑ 5A2-S 可与 5B 并行（只改属性读点，不改 worldSdk/harness/骨架）；集成 rebase 由维护者做。

### A.5 定义包实测（2026-10-07）

把 §5.8 JSON（`<NATIVE_*>` 暂填 `(`/`[`/`#C0C0C0`，仅为通过外观格式校验）放入 `/private/tmp/p5b-validate`（`2d870a2` 的 `git archive` 副本）的最小 crafting 模块（骨架式 prepare、计数参与者），Node 25.2.1（本机无 24.19.0，仅影响运行器）：

- `assertWorldDefinitionPack(pack,'crafting',localeKeys)` 通过；`validateModuleDescriptors` 通过（foundation 7、worldSdk 1）。
- 真实 harness 新局（仅 crafting；以及 crafting+growth+narrative+combat+giants）：启动礼包 `granted`，背包恰 木6/石4/纤维2；D1 放置 wood×2、stone×2、fiber×2、hide×1、无 metal，7 条 placement 收据全 `completed`；`definitionsFingerprint.crafting` 存在；徒手 `make-table-kit` 在同一命令内 `accepted`→`completed`，命令后 bundles=0、tickets=0、terminalTickets=1；seed 1 的首批在同命令内因 `threat` 被 `cancel/interrupted`，而 harness `error` 仍为 null；save/load 与 replay（firstMismatch null）通过。
- 结论：§5.8 数据**无需改动**即被冻结 SDK 接受。

---

## 1 目标与范围

### 1.1 目标

在 `src/ext/modules/crafting/` 交付一个**只硬依赖底座**的独立内容模块，使“仅启用 crafting”的新局可以完整游玩以下闭环：

1. 新局一次性启动礼包（木6、石4、纤维2）。
2. D1 徒手采集木/石/纤维/皮革存料（每次 100 tick 得 1 单位）。
3. 徒手做镐、桌套件、炉套件；在身边放置工作桌/火炉（用套件或原材料）。
4. 下到 D2+ 用镐采金属。
5. 桌上做 +0 已鉴定匕首、皮甲、床铺/储物箱套件。
6. 多批制造（1…16 批）自动续作，可被敌情/伤害打断，未开始的批次精确退款一次。
7. 全程真实命令录制，save/load/replay/seek/续录一致。

### 1.2 已批准的产品选择（不再讨论）

手采 100 tick/1 单位；材料 stack 99；三类工位（手工/桌/炉）；固定普通材料、+0 已知简单装备、床/箱/桌/炉套件；**不制作任何食物**；单包配方 ≤128；配方输入只能是 material/kit；配方耗时保持短（单批 ≤1500 tick；一批 10000 tick 只回一次血，属既有语义，不补偿）；无生产 XP、随机品质、附魔、商店。

### 1.3 非目标（出现即越界）

- 居民/NPC 工作、订单、离线生产、32 周期补给（5D2）；`crafting.recipe-catalog.v1` 可选查询（5D2）。
- 箱的放置/创建、结构建造、拆台返还、移动工位（settlement/5A3+）。
- 套件“使用”（床/箱放置）——套件在 5B 只是可保存、可搬运的物品，以及桌/炉的替代放置来源。
- 新的原生物品类、把 native 模板加入随机掉落、修改怪物掉落、修改原生饥饿/回血规则。
- 任何 growth/narrative/combat/giants 联动（只做组合不报错的验证）。
- 新的 window 级键盘屏障、新的弹窗系统、新字体/图片资源。
- 任何食物、菌类材料或菌类资源点（归独立 `foraging` 模块与 settlement 厨师，见 §1.4）。

### 1.4 2026-10-06 修订（维护者批准）

按已批准的[野外采食方向](phase5-foraging.md)：菌丛节点改归独立 `foraging` 模块；只有 settlement 的厨师居民能把食材加工成口粮。本包因此删除 `crafting.fungus`、`crafting.ration`、`crafting.fungus-node`、`crafting.cook-ration`，物品 14→12、节点 6→5、配方 8→7、物品与工位定义 16→14，每层节点配置 10→8、整局 176→144；native 外观占位 6→4。火炉与火炉套件**保留**（其余已批准内容不变）：5B 内没有火炉配方，火炉仍可放置，并以公开标签 `station.hearth` 供 settlement 的炊事岗位软匹配。C5-1 SDK 的 `nativeTemplate` 与资源 `kind` 枚举仍含 `ration_of_food` / `fungus`（SDK 冻结，不改），本包 schema 不再使用它们。

---

## 2 基线与分支

| 项目 | 值 |
| --- | --- |
| 基线 | `origin/ext/phase5b-base`：代码 = `ext/phase5` @ `2d870a2`（5A1+5A1-R+5A2 含审查修复已合入；5A2-S：**未合入**，可能并行开发；5A3：**未合入**）+ 本文件定稿的纯文档提交 |
| 工作分支 | `git switch -c ext/phase5b origin/ext/phase5b-base` |
| foundation | `FOUNDATION_PROTOCOL = 7`（只引用常量，不写字面量） |
| 既有模块 | growth 1.7.0、narrative 1.4.0、combat 1.6.0（state schema 4）、giants 1.0.0；一个字节都不改 |
| SDK 冻结文件（SHA-256） | `src/ext/worldSdk.ts` `e2f3cbbf06fa9afd939ec3a3a5f75193d47003a08410fd1c5d2e8899051da05f`；`src/ext/testing/worldHarness.ts` `0cc14ecd4cf734591616b291239b3ef23b99e451af6f954a3de6de3f3143ba26`；`src/ext/testing/fixtures/craftingSkeleton/index.ts`（该目录唯一文件）`f4d70fd3b9be75444f181448ced4005c20d546c0cff7ce11eef366bb4a1a5372`；`src/ext/testing/fixtures/worldWorkBasic.ts` `a0267454f15f1b3c90649ab1a4945ddf1e055d40dc0072e776ab74265ca61ee1` |
| 运行环境 | Node 24.19.0；`NODE_OPTIONS=--max-old-space-size=3072`；vitest `--maxWorkers=2`；不新增 npm 依赖 |

开工第一件事：`git log -1`、`git status`（须干净）、`git diff --stat 2d870a2 HEAD`（只应列出本任务书）、`shasum -a 256` 上述 SDK 文件并与表比对，结果写入报告 §2。哈希不符**照常开工**，在报告记录差异并以基线实际代码为准。

开工前先完整阅读骨架示例 `src/ext/testing/fixtures/craftingSkeleton/`（测试专用模块 id `craftskel`，不进生产 catalog；它与正式 `crafting` 互不冲突，dot 不改它）：它是 5A2 交付的“最小可运行 crafting”，本模块的接入方式（descriptor、`worldDefinitions` 组装、四个 `worldWorkCommands`、参与者、投影）以它为模板扩展，不另起炉灶。**但不要照抄它的参与者与 state**：骨架把原始事实（含 `accepted`）整条追加进 `history`（`slice(-128)`），本模块必须按 §6.4 的形状、过滤与上限实现；骨架的 `prepare` 用 `as any` 省略了 payload 校验，本模块按 §6.3 严格校验。

---

## 3 模块目录（完整布局）

```text
src/ext/modules/crafting/
  descriptor.ts            发现入口；id 'crafting'；foundation: FOUNDATION_PROTOCOL；worldSdk: 1（ModuleDescriptor 上）
  index.ts                 createCraftingModule()：loadCraftingPack() → createCraftingModuleFromPack(pack)
  module.ts                ExtensionModule：worldDefinitions / worldWorkCommands / worldWorkParticipant /
                           initialState / validateState / projectView
  definitions.ts           CRAFTING_VERSION='1.0.0'；loadCraftingPack()；getCraftingPackIdentity()；
                           toWorldDefinitionPack(pack)
  schema.ts                assertCraftingPack(value)：严格校验（§5.6）
  types.ts                 CraftingPack / CraftingState / CraftingView 等模块自有类型
  state.ts                 initialCraftingState / validateCraftingState / applyFact（参与者纯函数）
  commands.ts              四个 WorldWorkCommand.prepare（payload 校验 → SDK plan*）
  view.ts                  projectCraftingView(context)（纯投影，§7.1）
  data/definitions.json    机械数据包（§5，逐字照抄）
  data/natural-trace.json  自然公开命令 trace（§8.3，dot 生成）
  locales/zh_CN.json       全部文案（§7.4）
  ui/descriptor.ts         ModuleUiContribution（useSession）
  ui/useCraftingUi.ts      会话：命令按钮、面板开关、提交、刷新
  ui/view.ts               readCraftingUiView：严格解析投影 DTO（fail-closed）
  ui/CraftingPanel.vue     面板（四页签）
  ui/CraftingWorkHud.vue   进行中工作 HUD
  ui/commands.ts           buildHarvestCommand / buildCraftCommand / buildPlaceCommand / buildCancelCommand
  test-suites.json         {"test":[…],"gen":[],"drift":["tests/crafting_trace.test.ts"]}
  tests/…                  §8 列出的全部测试
docs/ext/crafting-config.md   自有配置手册（§10.2）
docs/ext/phase5b.report.md    执行报告（§10.1）
```

文件可再拆分（例如 `ui/CraftingRecipeCard.vue`），但不得少于以上职责，也不得在目录外新增文件。模块自有测试全部在 `tests/` 且全部登记在 `test-suites.json`（发现器会拒绝未登记或路径失效的测试）。

---

## 4 版本与身份

| 项目 | 值 | 说明 |
| --- | --- | --- |
| module id | `crafting` | 目录名同 |
| module version | `1.0.0`（`CRAFTING_VERSION`） | |
| rules identity | `{ schema: 1, version: '1.0.0', fingerprint: extensionDataFingerprint(pack) }` | 与 giants 同法；`pack` 为 `data/definitions.json` 经 schema 校验后的完整对象 |
| state schema | `1`（state 根字段 `schema: 1`） | |
| payload 版本 | 四种命令 payload 均 `v: 1` | 合同 §9 |
| worldSdk | `1` | |
| defaultEnabled | `false` | 新局默认不勾选，开局界面可选 |
| 显示 | 无独立 displayVersion；locale 文本不进指纹；glyph/color 属于机械定义（SDK 要求），进入指纹 | |

指纹覆盖数组顺序：`data/definitions.json` 中任何数组的重新排序都是规则变化。另外 foundation 会把每个 owner 的 SDK 定义包 canonical SHA-256 持久绑定在 `world5.definitionsFingerprint`（`sha256:` 前缀），load 时严格核对；这只是额外保险，crafting 的 rules 指纹仍必须覆盖整包（`limits` 只在 rules 指纹里）。

---

## 5 数据包与完整数值（已批准，逐字照抄）

### 5.1 根结构

```ts
interface CraftingPack {
  schema: 1; moduleId: 'crafting'; moduleVersion: '1.0.0'; rulesVersion: '1.0.0';
  materials: ItemDefinitionContribution[];   // category ∈ material | kit | native
  tools: ItemDefinitionContribution[];       // category = tool
  resourceNodes: ResourceDefinition[];
  stations: StationDefinition[];
  recipes: RecipeDefinition[];
  startupItems: StartupItemsDeclaration;
  limits: CraftingLimits;
}
```

`toWorldDefinitionPack(pack)` 产出 `{ schema: 1, worldSdk: 1, items: [...materials, ...tools], resourceNodes, stations, recipes, startupItems }`（items 顺序固定为 materials 在前、tools 在后；其余数组原序）。`limits` 只留在 crafting 包内，不传给 SDK。

### 5.2 物品（12 种）

ID 一律 `crafting.<短ID>`；`nameKey/descriptionKey` 一律 `ext.crafting.item.<短ID>.name|description`；`owner` 一律 `'crafting'`。

| 短ID | category | maxStack | tags | tool | nativeTemplate | glyph | color |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| wood | material | 99 | `["basic.wood"]` | null | null | `%` | `#A0784A` |
| stone | material | 99 | `["basic.stone"]` | null | null | `%` | `#9EA3A8` |
| metal | material | 99 | `["basic.metal"]` | null | null | `%` | `#B7C3CF` |
| fiber | material | 99 | `["basic.fiber"]` | null | null | `%` | `#8DB360` |
| leather | material | 99 | `["basic.leather"]` | null | null | `%` | `#B0805A` |
| kit-bed | kit | 99 | `["kit.bed"]` | null | null | `▣` | `#A8B2C0` |
| kit-chest | kit | 99 | `["kit.chest"]` | null | null | `▣` | `#A8B2C0` |
| kit-table | kit | 99 | `["kit.station.table"]` | null | null | `▣` | `#A8B2C0` |
| kit-hearth | kit | 99 | `["kit.station.hearth"]` | null | null | `▣` | `#A8B2C0` |
| plain-dagger | native | 1 | `[]` | null | `dagger` | 原生外观 | 原生外观 |
| plain-leather-armor | native | 1 | `[]` | null | `leather_armor` | 原生外观 | 原生外观 |
| pick | tool | 1 | `["basic.pick"]` | `{tag:"basic.pick", maxDurability:40, durabilityPerBatch:1}` | null | `†` | `#D2D6D8` |

- 前 11 行进 `materials`（表中顺序），`pick` 是 `tools` 唯一一行。
- “原生外观”：取基线原生渲染对该模板所属类别（WEAPON/ARMOR）实际使用的字形与 `#RRGGBB` 颜色（在 `src/engine`/`src/ui` 的物品显示代码里查找）；若原生颜色不是固定 hex，用其默认前景色换算的 hex。在 `crafting_schema.test.ts` 断言三行与原生显示常量一致，并在报告写出取值与来源行。
- native 行的 `maxStack` 只用于单批输出上限校验，不改原生合并/背包规则（合同 §5.1）。
- 制造出的 native 物品与自然生成的同模板物品不可区分（+0、已鉴定、无诅咒/符文），由 foundation 装配；crafting 不做任何装配。
- 镐耐久：初始 40；每次成功采集要求 `basic.pick` 的节点（只有金属矿脉）扣 1；耐久 0 仍是同一件物品，不能再满足工具要求。会使耐久降到 0 的那次采集由 foundation 弹出 `tool-break` 确认（5A2 D6），答 No 记录一条命令、0 成本。
- MATERIAL（材料/工具/套件）可拾取、丢弃，不可装备/投掷/使用（5A2 D9，foundation 处理）；crafting 不为它们增加任何使用入口。
- 不存在 unitWeight 字段（合同 r2 已删除）。

### 5.3 资源节点（5 种）

ID `crafting.<短ID>`；文本键 `ext.crafting.node.<短ID>.name|description`；全部 `harvestTicks: 100`、`unitsPerHarvest: 1`、`yield` 恰一项 count 1、`placement.site: null`。

| 短ID | kind | yield | capacity | regeneration | requiredToolTag | dungeon placement（min…max / 每层 / 整局 / onNoSpace） | glyph | color |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- |
| wood-node | wood | crafting.wood ×1 | 20 | periodic 1 / 2000 tick | null | 1…40 / 2 / 32 / **defer** | `木` | `#A0784A` |
| stone-node | stone | crafting.stone ×1 | 20 | none | null | 1…40 / 2 / 32 / skip | `石` | `#9EA3A8` |
| fiber-node | fiber | crafting.fiber ×1 | 20 | periodic 1 / 1000 tick | null | 1…40 / 2 / 32 / skip | `草` | `#8DB360` |
| metal-node | ore | crafting.metal ×1 | 20 | none | `basic.pick` | 2…40 / 1 / 24 / skip | `矿` | `#B7C3CF` |
| hide-cache | fiber | crafting.leather ×1 | 12 | none | null | 1…20 / 1 / 24 / skip | `皮` | `#B0805A` |

- 每层配置合计 8 ≤ 32；整局合计 144 ≤ 512。
- 本包不含菌类节点（`kind:'fungus'` 由独立 `foraging` 模块使用，见 §1.4）。
- `hide-cache` 的 kind 是有限行为分类 `fiber`，显示名为“皮革存料”，不是动物尸体规则，也不改怪物掉落。
- 放置、defer 重试、skip 收据、再生物化全部由 foundation 按合同 §9.1(e)、§5.4 执行；crafting 不调用任何放置接口、不写 `generationContributions`。

### 5.4 工位（2 种实体工位 + 手工）

手工 = 配方 `stationTags: []`，payload `stationId: null`，不需要任何实体。

| 短ID | stationTags | placementCost | 替代 kit | placementTicks | interactionDistance | workPositionPolicy | glyph | color |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- |
| table | `["station.table"]` | wood 4 + stone 2 | crafting.kit-table | 300 | 1 | adjacent-passable | `桌` | `#B08D57` |
| hearth | `["station.hearth"]` | stone 6 + wood 2 | crafting.kit-hearth | 300 | 1 | adjacent-passable | `炉` | `#E0703A` |

ID `crafting.table` / `crafting.hearth`；文本键 `ext.crafting.station.<短ID>.name|description`。kit 与原材料等价、不叠加扣除；火炉不产生火/烟/氧气模拟，5B 内没有火炉配方（§1.4），仅可放置并公开 `station.hearth` 标签；不需要房间或屋顶。5B 不提供拆除/回收。

### 5.5 配方（7 条）

ID `crafting.<短ID>`；文本键 `ext.crafting.recipe.<短ID>.name|description`；`toolTag` 全部 null；batch 1…16。

| 短ID | inputs（每批，按此顺序） | outputs（每批） | workTicks | stationTags | offlineEligible |
| --- | --- | --- | ---: | --- | --- |
| make-pick | wood 2, stone 2 | pick 1 | 500 | `[]` | false |
| make-table-kit | wood 4, stone 2 | kit-table 1 | 500 | `[]` | false |
| make-hearth-kit | stone 6, wood 2 | kit-hearth 1 | 500 | `[]` | false |
| make-dagger | metal 4, wood 1 | plain-dagger 1 | 1000 | `["station.table"]` | false |
| make-leather-armor | fiber 6, leather 4 | plain-leather-armor 1 | 1500 | `["station.table"]` | false |
| make-bed-kit | wood 4, fiber 2 | kit-bed 1 | 500 | `["station.table"]` | true |
| make-chest-kit | wood 6 | kit-chest 1 | 500 | `["station.table"]` | true |

`offlineEligible` 只是给 5D2 订单 adapter 的数据标记；5B 不读取它、不建订单。

### 5.6 启动礼包与上限

```json
"startupItems": { "instanceKey": "crafting.startup",
  "items": [ {"itemDefinitionId":"crafting.wood","count":6},
             {"itemDefinitionId":"crafting.stone","count":4},
             {"itemDefinitionId":"crafting.fiber","count":2} ],
  "overflow": "floor-then-skip" }
```

礼包恰好够“镐 + 桌（或桌套件）”，不含金属/皮革/装备/食物。由 foundation 在新局 D1 首次落位时发一次（合同 §9.1(f)），load/replay 不补发。

| limits 键 | 值 | 校验含义（schema 静态检查） |
| --- | ---: | --- |
| recipes | 128 | `recipes.length ≤` |
| itemAndStationDefinitions | 128 | `materials+tools+stations ≤`（首包 14） |
| nodeDefinitions | 128 | `resourceNodes.length ≤` |
| nodesPerLevel | 32 | 任一深度上可放置定义的 `maxPerDepth` 之和 ≤ |
| nodesPerRun | 512 | 全部 `maxPerRun` 之和 ≤ |
| stationsPerLevel | 16 | 运行期：place-station prepare 检查（§6.3） |
| stationsPerRun | 128 | 等于 foundation C5 工位子预算；运行期由 foundation 的 `C5_BUDGET` 执行 |
| startupReceipts | 1 | 恰一份 startupItems |
| placementReceipts | 512 | state.placements 滚动上限（§6.4） |
| workHistory | 128 | state.history 滚动上限 |
| batchMax | 16 | payload `batchCount ≤` |
| stack | 99 | material/kit 行 `maxStack ≤` |

### 5.7 schema 严格校验（`assertCraftingPack`）

- 所有对象严格键集合（多键/缺键/`undefined`/getter/原型污染/非 JSON 均拒绝）；全部整数为有限安全整数且落在合同 §10.1 范围；ID 符合 validId、长度 1…128、以 `crafting.` 开头且全包唯一（物品、节点、工位、配方共用一个 ID 空间检查）。
- 文本键以 `ext.crafting.` 开头且在 `locales/zh_CN.json` 中存在；glyph 为单个非控制字符；color 为 `#RRGGBB`。
- tags/stationTags 去重且按码点排序、≤16；工位 stationTags 非空。
- ItemAmount 列表 1…8 项、count 1…99、同列表 ID 不重复，引用必须是本包物品。
- 配方 inputs 只能引用 category material/kit；outputs 引用本包任何物品；workTicks 100…10000；stationTags 必须是本包某工位 tags 的子集（或空）。
- native 行 nativeTemplate ∈ {dagger, leather_armor}（不接受 `ration_of_food`）且 tool=null；tool 行 maxStack=1、tool 非空、tool.tag ∈ 本行 tags；其他行 tool=null。
- 资源 yield 引用 material；requiredToolTag 为 null 或某 tool 行的 tool.tag；`regeneration`/`placement` 范围按合同 §10.1；`site` 必须 null（5B 不开放 site）。
- 工位 kitDefinitionId 必须引用 category kit 且 placementCost 只含 material。
- limits 全部 12 键存在，且每个值 ≤ 上表值（可以更严，不可更松），并按 §5.6 校验数据满足它。
- 任一错误抛出，模块构造失败（不部分注册）。

### 5.8 `data/definitions.json`（权威数据，dot 原样写入）

```json
{
  "schema": 1, "moduleId": "crafting", "moduleVersion": "1.0.0", "rulesVersion": "1.0.0",
  "materials": [
    {"owner":"crafting","id":"crafting.wood","nameKey":"ext.crafting.item.wood.name","descriptionKey":"ext.crafting.item.wood.description","category":"material","glyph":"%","color":"#A0784A","maxStack":99,"nativeTemplate":null,"tags":["basic.wood"],"tool":null},
    {"owner":"crafting","id":"crafting.stone","nameKey":"ext.crafting.item.stone.name","descriptionKey":"ext.crafting.item.stone.description","category":"material","glyph":"%","color":"#9EA3A8","maxStack":99,"nativeTemplate":null,"tags":["basic.stone"],"tool":null},
    {"owner":"crafting","id":"crafting.metal","nameKey":"ext.crafting.item.metal.name","descriptionKey":"ext.crafting.item.metal.description","category":"material","glyph":"%","color":"#B7C3CF","maxStack":99,"nativeTemplate":null,"tags":["basic.metal"],"tool":null},
    {"owner":"crafting","id":"crafting.fiber","nameKey":"ext.crafting.item.fiber.name","descriptionKey":"ext.crafting.item.fiber.description","category":"material","glyph":"%","color":"#8DB360","maxStack":99,"nativeTemplate":null,"tags":["basic.fiber"],"tool":null},
    {"owner":"crafting","id":"crafting.leather","nameKey":"ext.crafting.item.leather.name","descriptionKey":"ext.crafting.item.leather.description","category":"material","glyph":"%","color":"#B0805A","maxStack":99,"nativeTemplate":null,"tags":["basic.leather"],"tool":null},
    {"owner":"crafting","id":"crafting.kit-bed","nameKey":"ext.crafting.item.kit-bed.name","descriptionKey":"ext.crafting.item.kit-bed.description","category":"kit","glyph":"▣","color":"#A8B2C0","maxStack":99,"nativeTemplate":null,"tags":["kit.bed"],"tool":null},
    {"owner":"crafting","id":"crafting.kit-chest","nameKey":"ext.crafting.item.kit-chest.name","descriptionKey":"ext.crafting.item.kit-chest.description","category":"kit","glyph":"▣","color":"#A8B2C0","maxStack":99,"nativeTemplate":null,"tags":["kit.chest"],"tool":null},
    {"owner":"crafting","id":"crafting.kit-table","nameKey":"ext.crafting.item.kit-table.name","descriptionKey":"ext.crafting.item.kit-table.description","category":"kit","glyph":"▣","color":"#A8B2C0","maxStack":99,"nativeTemplate":null,"tags":["kit.station.table"],"tool":null},
    {"owner":"crafting","id":"crafting.kit-hearth","nameKey":"ext.crafting.item.kit-hearth.name","descriptionKey":"ext.crafting.item.kit-hearth.description","category":"kit","glyph":"▣","color":"#A8B2C0","maxStack":99,"nativeTemplate":null,"tags":["kit.station.hearth"],"tool":null},
    {"owner":"crafting","id":"crafting.plain-dagger","nameKey":"ext.crafting.item.plain-dagger.name","descriptionKey":"ext.crafting.item.plain-dagger.description","category":"native","glyph":"<NATIVE_WEAPON_GLYPH>","color":"<NATIVE_WEAPON_COLOR>","maxStack":1,"nativeTemplate":"dagger","tags":[],"tool":null},
    {"owner":"crafting","id":"crafting.plain-leather-armor","nameKey":"ext.crafting.item.plain-leather-armor.name","descriptionKey":"ext.crafting.item.plain-leather-armor.description","category":"native","glyph":"<NATIVE_ARMOR_GLYPH>","color":"<NATIVE_ARMOR_COLOR>","maxStack":1,"nativeTemplate":"leather_armor","tags":[],"tool":null}
  ],
  "tools": [
    {"owner":"crafting","id":"crafting.pick","nameKey":"ext.crafting.item.pick.name","descriptionKey":"ext.crafting.item.pick.description","category":"tool","glyph":"†","color":"#D2D6D8","maxStack":1,"nativeTemplate":null,"tags":["basic.pick"],"tool":{"tag":"basic.pick","maxDurability":40,"durabilityPerBatch":1}}
  ],
  "resourceNodes": [
    {"owner":"crafting","id":"crafting.wood-node","nameKey":"ext.crafting.node.wood-node.name","descriptionKey":"ext.crafting.node.wood-node.description","glyph":"木","color":"#A0784A","kind":"wood","yield":[{"itemDefinitionId":"crafting.wood","count":1}],"capacity":20,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":2000},"placement":{"dungeon":{"minDepth":1,"maxDepth":40,"maxPerDepth":2,"maxPerRun":32,"onNoSpace":"defer"},"site":null}},
    {"owner":"crafting","id":"crafting.stone-node","nameKey":"ext.crafting.node.stone-node.name","descriptionKey":"ext.crafting.node.stone-node.description","glyph":"石","color":"#9EA3A8","kind":"stone","yield":[{"itemDefinitionId":"crafting.stone","count":1}],"capacity":20,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"none"},"placement":{"dungeon":{"minDepth":1,"maxDepth":40,"maxPerDepth":2,"maxPerRun":32,"onNoSpace":"skip"},"site":null}},
    {"owner":"crafting","id":"crafting.fiber-node","nameKey":"ext.crafting.node.fiber-node.name","descriptionKey":"ext.crafting.node.fiber-node.description","glyph":"草","color":"#8DB360","kind":"fiber","yield":[{"itemDefinitionId":"crafting.fiber","count":1}],"capacity":20,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"periodic","units":1,"intervalTicks":1000},"placement":{"dungeon":{"minDepth":1,"maxDepth":40,"maxPerDepth":2,"maxPerRun":32,"onNoSpace":"skip"},"site":null}},
    {"owner":"crafting","id":"crafting.metal-node","nameKey":"ext.crafting.node.metal-node.name","descriptionKey":"ext.crafting.node.metal-node.description","glyph":"矿","color":"#B7C3CF","kind":"ore","yield":[{"itemDefinitionId":"crafting.metal","count":1}],"capacity":20,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":"basic.pick","regeneration":{"kind":"none"},"placement":{"dungeon":{"minDepth":2,"maxDepth":40,"maxPerDepth":1,"maxPerRun":24,"onNoSpace":"skip"},"site":null}},
    {"owner":"crafting","id":"crafting.hide-cache","nameKey":"ext.crafting.node.hide-cache.name","descriptionKey":"ext.crafting.node.hide-cache.description","glyph":"皮","color":"#B0805A","kind":"fiber","yield":[{"itemDefinitionId":"crafting.leather","count":1}],"capacity":12,"harvestTicks":100,"unitsPerHarvest":1,"requiredToolTag":null,"regeneration":{"kind":"none"},"placement":{"dungeon":{"minDepth":1,"maxDepth":20,"maxPerDepth":1,"maxPerRun":24,"onNoSpace":"skip"},"site":null}}
  ],
  "stations": [
    {"owner":"crafting","id":"crafting.table","nameKey":"ext.crafting.station.table.name","descriptionKey":"ext.crafting.station.table.description","glyph":"桌","color":"#B08D57","interactionDistance":1,"stationTags":["station.table"],"placementCost":[{"itemDefinitionId":"crafting.wood","count":4},{"itemDefinitionId":"crafting.stone","count":2}],"placementTicks":300,"workPositionPolicy":"adjacent-passable","kitDefinitionId":"crafting.kit-table"},
    {"owner":"crafting","id":"crafting.hearth","nameKey":"ext.crafting.station.hearth.name","descriptionKey":"ext.crafting.station.hearth.description","glyph":"炉","color":"#E0703A","interactionDistance":1,"stationTags":["station.hearth"],"placementCost":[{"itemDefinitionId":"crafting.stone","count":6},{"itemDefinitionId":"crafting.wood","count":2}],"placementTicks":300,"workPositionPolicy":"adjacent-passable","kitDefinitionId":"crafting.kit-hearth"}
  ],
  "recipes": [
    {"owner":"crafting","id":"crafting.make-pick","nameKey":"ext.crafting.recipe.make-pick.name","descriptionKey":"ext.crafting.recipe.make-pick.description","inputs":[{"itemDefinitionId":"crafting.wood","count":2},{"itemDefinitionId":"crafting.stone","count":2}],"outputs":[{"itemDefinitionId":"crafting.pick","count":1}],"stationTags":[],"toolTag":null,"workTicks":500,"offlineEligible":false},
    {"owner":"crafting","id":"crafting.make-table-kit","nameKey":"ext.crafting.recipe.make-table-kit.name","descriptionKey":"ext.crafting.recipe.make-table-kit.description","inputs":[{"itemDefinitionId":"crafting.wood","count":4},{"itemDefinitionId":"crafting.stone","count":2}],"outputs":[{"itemDefinitionId":"crafting.kit-table","count":1}],"stationTags":[],"toolTag":null,"workTicks":500,"offlineEligible":false},
    {"owner":"crafting","id":"crafting.make-hearth-kit","nameKey":"ext.crafting.recipe.make-hearth-kit.name","descriptionKey":"ext.crafting.recipe.make-hearth-kit.description","inputs":[{"itemDefinitionId":"crafting.stone","count":6},{"itemDefinitionId":"crafting.wood","count":2}],"outputs":[{"itemDefinitionId":"crafting.kit-hearth","count":1}],"stationTags":[],"toolTag":null,"workTicks":500,"offlineEligible":false},
    {"owner":"crafting","id":"crafting.make-dagger","nameKey":"ext.crafting.recipe.make-dagger.name","descriptionKey":"ext.crafting.recipe.make-dagger.description","inputs":[{"itemDefinitionId":"crafting.metal","count":4},{"itemDefinitionId":"crafting.wood","count":1}],"outputs":[{"itemDefinitionId":"crafting.plain-dagger","count":1}],"stationTags":["station.table"],"toolTag":null,"workTicks":1000,"offlineEligible":false},
    {"owner":"crafting","id":"crafting.make-leather-armor","nameKey":"ext.crafting.recipe.make-leather-armor.name","descriptionKey":"ext.crafting.recipe.make-leather-armor.description","inputs":[{"itemDefinitionId":"crafting.fiber","count":6},{"itemDefinitionId":"crafting.leather","count":4}],"outputs":[{"itemDefinitionId":"crafting.plain-leather-armor","count":1}],"stationTags":["station.table"],"toolTag":null,"workTicks":1500,"offlineEligible":false},
    {"owner":"crafting","id":"crafting.make-bed-kit","nameKey":"ext.crafting.recipe.make-bed-kit.name","descriptionKey":"ext.crafting.recipe.make-bed-kit.description","inputs":[{"itemDefinitionId":"crafting.wood","count":4},{"itemDefinitionId":"crafting.fiber","count":2}],"outputs":[{"itemDefinitionId":"crafting.kit-bed","count":1}],"stationTags":["station.table"],"toolTag":null,"workTicks":500,"offlineEligible":true},
    {"owner":"crafting","id":"crafting.make-chest-kit","nameKey":"ext.crafting.recipe.make-chest-kit.name","descriptionKey":"ext.crafting.recipe.make-chest-kit.description","inputs":[{"itemDefinitionId":"crafting.wood","count":6}],"outputs":[{"itemDefinitionId":"crafting.kit-chest","count":1}],"stationTags":["station.table"],"toolTag":null,"workTicks":500,"offlineEligible":true}
  ],
  "startupItems": {"instanceKey":"crafting.startup","items":[{"itemDefinitionId":"crafting.wood","count":6},{"itemDefinitionId":"crafting.stone","count":4},{"itemDefinitionId":"crafting.fiber","count":2}],"overflow":"floor-then-skip"},
  "limits": {"recipes":128,"itemAndStationDefinitions":128,"nodeDefinitions":128,"nodesPerLevel":32,"nodesPerRun":512,"stationsPerLevel":16,"stationsPerRun":128,"startupReceipts":1,"placementReceipts":512,"workHistory":128,"batchMax":16,"stack":99}
}
```

`<NATIVE_*>` 四个占位按 §5.2“原生外观”规则由 dot 填入并在报告列出；这是本 JSON 中唯一允许 dot 填写的值（foundation 对 native 行的 glyph/color 只做格式校验：单字形、`#RRGGBB`；产物外观沿原生模板）。本 JSON 已于 2026-10-07 在基线副本上经 `assertWorldDefinitionPack` 与真实新局实测通过（§A.5），字段集与冻结 SDK 逐字一致，不需增删字段。

---

## 6 模块实现规则

### 6.0 允许的导入（`check-module-boundaries.mjs` 强制）

生产代码（`tests/` 以外）只可 import：`src/ext/worldSdk`（类型、`C5_CONTRACT_VERSION`/`WORLD_SDK_VERSION` 常量、纯函数 `levelKey`/`compareLevelRefs`）、`src/ext/types`（`ExtensionModule`、`Json` 等）、`src/ext/descriptor`（`FOUNDATION_PROTOCOL`、`ModuleDescriptor`）、`src/ext/fingerprint`（`extensionDataFingerprint`）、`src/ext/world`（**仅** `import type`，如 `ExtensionProjectionContext`）、共享 UI `src/ext/ui/**` 与 `src/ui/**`、模块自有文件和 npm 依赖（vue 等）。不得 import 任何 `src/engine/**`、`src/ext/testing/**`、其他模块。测试文件可另 import `src/ext/testing/worldHarness`（含测试专用 `worldHarnessGame(h)` 取真实 Game 做断言/布景）与引擎只读断言工具。

### 6.1 descriptor

```ts
export const descriptor: ModuleDescriptor = {
  id: 'crafting', version: CRAFTING_VERSION, foundation: FOUNDATION_PROTOCOL,
  worldSdk: 1,                                   // 只在 ModuleDescriptor；ExtensionModule 上没有此键
  rules: getCraftingPackIdentity(), create: createCraftingModule,
  defaultEnabled: false,
  labelKey: 'ext.crafting.module.name', descriptionKey: 'ext.crafting.module.description',
  locales: { zh_CN: zhCN }
};
```

不写 `dependencies`；不 import 任何其他模块；不在 catalog 等共享文件登记（发现器自动发现）。

### 6.2 module

`createCraftingModuleFromPack(pack)` 返回的 `ExtensionModule` 只含：`id/version/rules`（同 descriptor）、`worldDefinitions: toWorldDefinitionPack(pack)`、`worldWorkCommands: { harvest, craft, 'place-station', 'cancel-work' }`（每项对象恰一个键 `prepare`）、`worldWorkParticipant`（恰一个键 `onCommitted`）、`initialState`、`validateState`、`projectView`。foundation 构造时整包校验一次（`validateWorldModule`），任一不符整模块拒绝。**不实现** `commands`、`interactionCommands`、`actorActions`、`generationContributions`、`worldInteractables`、`ownedRegions`、钩子回调或任何可选 provider。

### 6.3 四个命令的 prepare（`commands.ts`）

外层格式固定：`executeCommand('ext:command', JSON.stringify({module:'crafting', action, payload}))`。prepare 必须纯：不读写 state、不取 RNG、不用 `Date`/`Math.random`、不分配 ID、不发消息、不缓存句柄。

| action | payload（严格键集，`v:1`） | 模块检查（失败返回码） | 委托 |
| --- | --- | --- | --- |
| harvest | `{v,nodeId,nodeRevision,inventoryStamp,destinationId,destinationRevision}` | 键集/类型/安全整数（`C5_BAD_PAYLOAD`）；`destinationId===null` ⇔ `destinationRevision===null` | `sdk.planTimedWork({kind:'harvest',…})` |
| craft | `{v,recipeId,batchCount,stationId,stationRevision,sourceContainerId,sourceRevision,inventoryStamp}` | recipeId 为本包配方（否则 `C5_BAD_DEFINITION`）；`1 ≤ batchCount ≤ limits.batchMax`（`C5_BAD_PAYLOAD`）；配方 stationTags 为空 ⇔ `stationId===null`；id 与 revision 成对 null | `sdk.planTimedWork({kind:'craft',…})` |
| place-station | `{v,definitionId,x,y,inventoryStamp}` | definitionId 为本包工位；x/y 安全整数；`sdk.readWorkContext({kind:'inventory'})` 中本层 crafting 工位数 ≥ `stationsPerLevel` → `C5_BUDGET`（读失败原样返回其结果） | `sdk.planStationPlacement({definitionId, at:{x,y}, inventoryStamp})` |
| cancel-work | `{v,ticketId,ticketRevision}` | 键集/类型 | `sdk.planCancelWork({ticketId,ticketRevision})` |

- 模块不提交数量、输出、actorId、workTicks、来源选择；SDK 的所有资格/CAS/预算判断不重复实现，原样返回其 `WorldResult`。
- 请求对象严格键集（foundation 拒绝多余键）：传给 SDK 的对象去掉 `v`；`planTimedWork` 必须带 `kind`（`'harvest'`/`'craft'`）；放置把 `x,y` 换成 `at:{x,y}`。每个 action 只能调用与自己对应的 plan（harvest→`planTimedWork({kind:'harvest'})`、craft→`planTimedWork({kind:'craft'})`、place-station→`planStationPlacement`、cancel-work→`planCancelWork`）；返回句柄的 `operation` 与信封 action 不符时 foundation 判 `C5_BAD_PAYLOAD`。
- 模块自造的失败结果只用 worldSdk 的 33 个 `WorldErrorCode`，`field` 为 `null` 或简短字段名字符串；码不在 33 码内会被 foundation 降为 `C5_PROVIDER`。prepare 收到的 payload 已被 foundation 深冻结，不得修改。
- 参考：外层可用 worldSdk 导出的 `CraftingCommand`/`CraftingAction` 类型；foundation 对“配方需工位却 `stationId:null`”与“工位标签不满足”返回 `C5_INPUT`，模块层的成对 null 检查在此之前返回 `C5_BAD_PAYLOAD`。
- 本层工位计数口径：`WorkContext.stations` 中 `definitionId` 以 `crafting.` 开头且 `levelRef` 等于当前 `levelRef` 的条数（实际 `stations` 已含当前层全部自有工位 + 已见他人工位，§A.3#2 已核对）。整局 128 是 foundation 的**全 owner 共享** C5 工位预算（`world5.stations.length ≥ 128` → `C5_BUDGET`），crafting 不另计。

### 6.4 模块 state 与参与者（`state.ts`）

```ts
interface CraftingState {
  schema: 1;
  lastFactId: number;                      // 已吸收事实的最高 factId（0 起）
  totals: { harvest: number; craftBatches: number; placements: number; cancels: number; startup: number };
  placements: PlacementReceipt[];          // ≤ limits.placementReceipts，满则丢最旧
  history: HistoryEntry[];                 // ≤ limits.workHistory，满则丢最旧
}
interface PlacementReceipt { factId: number; definitionId: string; result: 'completed'|'interrupted'; tick: number }
interface HistoryEntry { factId: number; operation: CommittedWorkFact['operation']; definitionId: string;
  completedBatches: number; result: 'completed'|'interrupted'|'skipped'; reason: string|null; tick: number }
```

- `initialState()` = `{schema:1,lastFactId:0,totals:{全0},placements:[],history:[]}`。
- 事实形状（冻结 SDK 实际行为）：`fact.result` 四值 `accepted|completed|interrupted|skipped`。每次接单（harvest / craft / place-station）先发一条 `accepted`（operation 同接单种类，craft 为 `craft-batch`；`completedBatches 0`、`completionOrdinal 0`、`ticketId` 非 null），之后每完成一批发一条 `completed`（harvest 只有一条 completed）；取消/中断发 `operation:'cancel'`、`result:'interrupted'`、`reason` 为原因（`threat`/`damage`/`input`/`player` 等字符串），`definitionId` 为被取消工作的配方/节点/工位 ID；启动礼包发 `operation:'startup'`、`result:'completed'|'skipped'`、`ticketId:null`、`definitionId` 为礼包首个物品 ID。
- `onCommitted(fact, tx)`：调用纯函数 `applyFact(tx.state, fact)` 后 `tx.replaceState(next)`。`tx.state` 深冻结，必须构造新对象；同步执行、返回 void；`next` 必须通过 `validateState`。`fact.owner !== 'crafting'` 或 `fact.factId <= lastFactId` → 不调用 replaceState（幂等；factId 可以跳号）。
- `result === 'accepted'`：只把 `lastFactId` 推进到该 factId，**不**计 totals、不写 PlacementReceipt、不写 HistoryEntry（接收不是完成）。
- 其余事实：totals 对应 operation：`harvest`、`craft-batch`、`place-station`、`cancel`、`startup` 各 +1（`result==='completed'` 才计 harvest/craftBatches/placements；cancel/startup 任何 result 都计）；达到 `MAX_SAFE_INTEGER` 时饱和不再增加。PlacementReceipt：`place-station` + `completed` 追加 `result:'completed'`；`cancel` 且 `definitionId` 为本包工位 ID 追加 `result:'interrupted'`。所有非 accepted 事实追加 HistoryEntry（result 只会是 completed/interrupted/skipped）。
- **参与者绝不抛异常**：异常会被 foundation 归类为 `C5_PROVIDER` 并取消该工作，取消事实**仍会尝试送达**本参与者；只有那次送达再失败时，foundation 才不经参与者保留该事实（`recentFacts` 可见、state 不变）。因此输入非预期时原样返回不变 state，且 `lastFactId` 用 `<=` 判断以容忍跳号。
- `validateState` 严格：键集、整数范围、数组上限（placements ≤512、history ≤128）、各数组内 factId 严格递增、`lastFactId ≥` 数组中最大 factId、operation 五值/result 枚举（history 三值、placements 两值）、definitionId 为本包 ID。
- state 只能经参与者改变；投影/UI 只读。

### 6.5 时间与续作

一切计时、bundle、`auto_work` 续作、中断谓词、退款、耐久扣减均由 foundation 执行（合同 §8）。crafting 的义务只是：数据给对；UI 正确显示 `activeTicket`；不在任何地方自行推进时间或调用 `auto_step`。

实际时序（冻结 SDK）：玩家的工作 bundle **从不跨命令存活**——接单命令内同步跑完首批（或单批/采集/放置的全部），每条 `auto_step` 命令内跑完下一批；命令结束后 bundles=0。多批 craft 接单后写 autoAction `{kind:'auto_work',ticketId}`，批间票据为 `working` 且 `bundleActionId:null`；harvest、单批 craft 与放置不写 auto_work。中断（输入/威胁/伤害/移动/离层/失能/目标或工具失效）发生在执行该批的那条命令内部：该批不产出、未开始批次的 escrow 一次退款。tool-break 确认阈值为 `toolDurability ≤ durabilityPerBatch × batchCount`，采集与制作都适用。

---

## 7 投影、UI 与 i18n

### 7.1 投影 `projectView(context)`（`view.ts`）

纯函数，只用 `context.worldWork`（`WorldWorkReadSDK`）、`context.nearbyInteractables`（runtime 已按 owner=`crafting` 过滤）、`context.state` 与本包定义。`worldWork` 缺席或 `readWorkContext({kind:'inventory'})` 失败 → 返回 `{v:1, available:false}`。成功时返回：

```ts
interface CraftingView {
  v: 1; available: true; levelRef: LevelRef; inventoryStamp: string;
  activeTicket: null | { ticketId: number; ticketRevision: number; kind: WorkTicket['kind'];
    definitionId: string; nameKey: string; totalBatches: number; completedBatches: number;
    remainingTicks: number; status: WorkTicket['status'] };
  nodes: { interactableId: number; definitionId: string; nameKey: string; glyph: string; color: string;
    remaining: number; capacity: number; available: number; nodeRevision: number;
    requiredToolTag: string | null; canHarvest: boolean; reason: WorldErrorCode | null }[];      // 仅 nearby 且 owner='crafting'
  stations: { interactableId: number; definitionId: string; nameKey: string; tags: string[];
    stationRevision: number; inReach: boolean }[];
  recipes: { recipeId: string; nameKey: string; descriptionKey: string;
    inputs: { itemDefinitionId: string; nameKey: string; perBatch: number; have: number }[];
    outputs: { itemDefinitionId: string; nameKey: string; perBatch: number }[];
    workTicks: number; stationTags: string[]; stationId: number | null; stationRevision: number | null;
    maxBatch: number; reason: WorldErrorCode | null }[];                                         // 包内顺序
  placements: { definitionId: string; nameKey: string; placementTicks: number;
    source: 'kit' | 'materials' | null; kitHave: number;
    cost: { itemDefinitionId: string; nameKey: string; need: number; have: number }[] }[];
  history: HistoryEntry[];                                                                       // state.history 最新 8 条，新在前
}
```

计算规则（全部确定、无随机）：

- `have` = 背包 `ItemRead` 中该 definitionId 的 `available` 之和（不扫描箱）。
- 配方 `stationId`：stationTags 为空 → null；否则在 `stations` 中取 `inReach` 且 tags 覆盖配方 stationTags 的工位，按 `interactableId` 升序取第一个；找不到 → `stationId=null`、`maxBatch=0`、`reason='C5_GATE'`（UI 显示“需要{{station}}”）。
- `maxBatch`：候选 = min(batchMax, 各输入 ⌊have/perBatch⌋)；从候选向下调用 `previewRecipe(recipeId, n, stationId, null)`，取第一个 `ok` 的 n；全不 ok → 0，`reason` = 候选批次（至少 1）preview 的 reason。单次投影 previewRecipe 调用总数 ≤ 7×16。
- `inReach`：玩家当前位置（`WorkContext.at`）∈ 该工位 `StationRead.workPositions`（foundation 的工位资格同样只认 workPositions；只用 Chebyshev 距离会出现“UI 可做、提交得 `C5_DISTANCE`”）。`stations` 行来自 `WorkContext.stations` 中 `definitionId` 以 `crafting.` 开头者。
- `placements[].source`：背包有对应 kit → `'kit'`；否则材料齐 → `'materials'`；都不够 → null。仅作 UI 预告，实际来源由 foundation 决定（有 kit 先扣 1 个 kit，否则扣材料；不弹确认、不双扣，§A.3#1）。
- 节点行：对 `nearbyInteractables` 每个条目调用 `readWorkContext({kind:'node', interactableId})`，失败（例如它是工位）则不列出；成功时 `node` 为 `ResourceNodeRecord`，名称/字形/颜色/工具要求取本包定义。冻结 SDK 的节点查询**不返回可采资格**，`canHarvest/reason` 由投影按以下顺序确定性计算（第一个命中即为 reason，全不命中则 `canHarvest:true, reason:null`）：`!ctx.available` → `ctx.activeTicket ? 'C5_BUSY' : 'C5_GATE'`；玩家与节点 Chebyshev 距离 >1 → `C5_DISTANCE`；`remaining < unitsPerHarvest` → `C5_RESOURCE_EMPTY`；`remaining − reservedUnits < unitsPerHarvest` → `C5_RESERVED`；`requiredToolTag` 非 null 且背包无 `tags` 含该标签且 `toolDurability > 0` 的 ItemRead → `C5_TOOL`。威胁、交互线、背包容量只由提交时 foundation 判定，被拒后按 §7.4 显示。`available` = `remaining − reservedUnits`（下限 0）。投影读到的是“最后已物化值”（5A2 D7），再生节点的剩余量可能偏低，提交时以 foundation 虚拟物化值为准；UI 不需要也不得自行推算再生。
- 配方无可用工位时投影 `reason='C5_GATE'` 是**投影自定的显示码**（UI 显示“需要{{station}}”）；若真的提交，foundation 返回 `C5_INPUT`。

### 7.2 UI 会话（`ui/useCraftingUi.ts`）

参照 growth 的 panel 加载方式（`src/ext/modules/growth/ui/useGrowthUi.ts`）与 combat 的提交/刷新/失活防护（`src/ext/modules/combat/ui/useCombatUi.ts`），只读学习，不 import 它们。

- `commands`：一个模块栏命令 `{ id:'crafting.open', label: t('ext.crafting.ui.open'), glyph:'匠' }`；`available:false` 时 disabled。
- `panel`：`CraftingPanel.vue`（`defineAsyncComponent` 懒加载）；打开前 `host.canOpenPanel()`、`host.beforeOpenPanel()`，关闭 `host.afterClosePanel()`。
- `hud`：存在 `activeTicket` 时显示 `CraftingWorkHud.vue`（一行：名称 · 第 a/b 批 · 本批剩余 N 刻）；否则 null。
- 读数据：`game.extensionRuntime.readModuleView('crafting')` 的投影，经 `ui/view.ts` 严格解析（任何字段异常 → 视为不可用，fail-closed）。
- 提交：`ui/commands.ts` 用投影中的 revision/stamp 拼 payload，`game.executeCommand('ext:command', json)`；提交中禁止二次提交（`submitting` 锁 + 忽略 `event.detail > 1` 的连点）；结果由下一次刷新反映；被拒（revision/stamp 未变且无待确认）显示该码的 i18n 文本。确认对话由 foundation/shell 经 DialogService 呈现，模块不自建确认。
- 失活：`host.game()` 或 `extensionRuntime` 变化、`isPresentationBusy()`、`canPresentInteraction()===false` → 关闭面板、清草稿；回放/seek 中面板可打开但只读（所有提交按钮 disabled 并显示“回放中，仅可查看”）；seek 后清空批量选择与方向草稿。
- 反复打开/关闭/切页签不得改变时间、背包、票据、state 或任何 RNG（§8.2 T12 断言）。

### 7.3 面板布局与可用性

四个页签：**采集 / 制作 / 工作台 / 工作**。

| 页签 | 内容 | 操作 |
| --- | --- | --- |
| 采集 | 附近节点卡片：字形+名称、`剩余 r / c`、工具要求（缺镐红字） | “采集（100 刻）”；不可用时显示原因 |
| 制作 | 配方卡片（包内顺序）：名称、工位徽标（徒手/需要工作桌/需要火炉）、每项输入“需 n / 拥有 h”（不足红字）、输出、`t 刻/批` | 批量 −/数值/+（1…maxBatch，maxBatch=0 时整卡灰态并显示原因）、“共 k 批 · T 刻”、“开始制作” |
| 工作台 | 桌/炉两张卡：费用或“使用套件 ×1”预告、`300 刻` | 先选方向（八方向 3×3 方格，中心为玩家），再“放置”；被拒显示原因 |
| 工作 | `activeTicket` 详情与最近记录（≤8） | “停止工作”（仅当 `activeTicket.status==='working'` 且 `bundleActionId===null` 时可用——玩家多批工作的批间正是此状态；否则灰态并说明“本批完成后可停止”） |

视口要求（实测）：

- 1440×900：面板为地图旁的侧栏式面板，原命令环保持可用。
- 390×844 与 320×844（普通 + 沉浸）：单列；页签条固定顶部；底部“取消/确认”固定且不遮挡玩家与相邻格；**无横向滚动**；所有可点目标 ≥44×44 CSS px；名称最多两行截断；数量只用 −/数值/+ 步进，不依赖悬停或键盘。
- 四种地图显示模式下面板/HUD 均不遮挡玩家所在格的高亮与敌人预警。
- 风格：刻符现有字体、色系、CSS 变量；不新增字体、图片、emoji；地图上的节点/工位字形由 foundation 渲染（§5.3/§5.4 的 CJK 字形与颜色）。

### 7.4 i18n（`locales/zh_CN.json`，全部键）

物品/节点/工位/配方的名称与描述（描述允许润色，名称不得改）：

| 键前缀 | name | description |
| --- | --- | --- |
| `item.wood` | 木材 | 从朽木堆劈下的木料，可用来做工具柄、工作台与家具。 |
| `item.stone` | 石料 | 敲下的碎石块，适合砌火炉、做工作台底座。 |
| `item.metal` | 金属块 | 从矿脉凿出的粗金属，在工作桌上可以打成匕首。 |
| `item.fiber` | 植物纤维 | 从洞穴苇丛剥下的纤维，可搓绳、缝甲、做床铺。 |
| `item.leather` | 皮革 | 前人留下的鞣制皮料，缝制皮甲的主料。 |
| `item.kit-bed` | 床铺套件 | 拆散捆好的床架与铺垫，可以随身携带。 |
| `item.kit-chest` | 储物箱套件 | 拆散捆好的木箱板材，可以随身携带。 |
| `item.kit-table` | 工作桌套件 | 可以就地组装成一张工作桌。 |
| `item.kit-hearth` | 火炉套件 | 可以就地垒成一座火炉。 |
| `item.plain-dagger` | 匕首 | 在工作桌上打制的普通匕首，没有任何附魔。 |
| `item.plain-leather-armor` | 皮甲 | 在工作桌上缝制的普通皮甲，没有任何附魔。 |
| `item.pick` | 矿镐 | 木柄石头的粗制矿镐，能凿开金属矿脉；用久会坏。 |
| `node.wood-node` | 朽木堆 | 倒伏的朽木，可以徒手劈下木材，过一段时间会再积起来。 |
| `node.stone-node` | 碎石堆 | 坍落的碎石，可以徒手搬走，采完就没有了。 |
| `node.fiber-node` | 洞穴苇丛 | 潮湿处生长的苇草，可以徒手剥取纤维，会慢慢长回来。 |
| `node.metal-node` | 金属矿脉 | 岩壁中露出的金属矿脉，需要矿镐才能凿取。 |
| `node.hide-cache` | 皮革存料 | 前人遗留的一捆鞣制皮料，取完就没有了。 |
| `station.table` | 工作桌 | 简易工作桌，可以打制装备与家具套件。 |
| `station.hearth` | 火炉 | 石砌火炉，可以作为烹饪的场所。 |
| `recipe.make-pick` | 制作矿镐 | 用木材和石料做一把矿镐。 |
| `recipe.make-table-kit` | 制作工作桌套件 | 把材料预先做成可携带的工作桌套件。 |
| `recipe.make-hearth-kit` | 制作火炉套件 | 把材料预先做成可携带的火炉套件。 |
| `recipe.make-dagger` | 打制匕首 | 在工作桌上把金属打成一把匕首。 |
| `recipe.make-leather-armor` | 缝制皮甲 | 在工作桌上用皮革和纤维缝一件皮甲。 |
| `recipe.make-bed-kit` | 制作床铺套件 | 在工作桌上做一套床铺套件。 |
| `recipe.make-chest-kit` | 制作储物箱套件 | 在工作桌上做一套储物箱套件。 |

（表中键省略了公共前缀 `ext.crafting.` 与后缀 `.name/.description`。）

模块与界面键（全部以 `ext.crafting.` 开头，值固定如下，可修正错别字）：

| 键 | 文本 |
| --- | --- |
| `module.name` | 合成 |
| `module.description` | 在地牢中采集木石、纤维与矿料，制作工具、工作台、普通装备与家具套件。 |
| `ui.open` | 合成 |
| `ui.title` | 合成 |
| `ui.tab.harvest` / `ui.tab.craft` / `ui.tab.station` / `ui.tab.work` | 采集 / 制作 / 工作台 / 工作 |
| `ui.close` / `ui.cancel` | 关闭 / 取消 |
| `ui.unavailable` | 当前无法进行合成 |
| `ui.replay_readonly` | 回放中，仅可查看 |
| `ui.harvest.none` | 附近没有可采集的资源点 |
| `ui.harvest.remaining` | 剩余 {{remaining}} / {{capacity}} |
| `ui.harvest.action` | 采集（{{ticks}} 刻） |
| `ui.tool.required` | 需要：{{tool}} |
| `ui.station.hand` / `ui.station.need` | 徒手 / 需要{{station}} |
| `ui.recipe.need_have` | 需 {{need}} / 拥有 {{have}} |
| `ui.recipe.per_batch` | {{ticks}} 刻/批 |
| `ui.recipe.total` | 共 {{batches}} 批 · {{ticks}} 刻 |
| `ui.recipe.start` | 开始制作 |
| `ui.batch.decrease` / `ui.batch.increase` | 减少一批 / 增加一批 |
| `ui.place.source_kit` | 使用 {{kit}} ×1 |
| `ui.place.source_materials` | 使用材料 |
| `ui.place.source_none` | 材料不足 |
| `ui.place.choose_direction` | 选择放置方向 |
| `ui.place.action` | 放置（{{ticks}} 刻） |
| `ui.dir.n` … `ui.dir.nw`（8 个） | 上 / 右上 / 右 / 右下 / 下 / 左下 / 左 / 左上 |
| `ui.work.none` | 没有进行中的工作 |
| `ui.work.active` | {{name}} · 第 {{done}}/{{total}} 批 |
| `ui.work.remaining` | 本批剩余 {{ticks}} 刻 |
| `ui.work.stop` | 停止工作 |
| `ui.work.stop_after_batch` | 本批完成后可停止 |
| `ui.history.title` | 最近记录 |
| `ui.history.completed` / `ui.history.interrupted` / `ui.history.skipped` | 完成：{{name}} / 中断：{{name}} / 跳过：{{name}} |
| `ui.rejected` | 操作未执行，请重新查看 |

更具体的错误文案（其余码回退 foundation 的 `ext.foundation.world.error.<code>`，再无则用 `ui.rejected`；任何情况下不向玩家显示错误码或 `field`）：

| 键 `ext.crafting.error.` + | 文本 |
| --- | --- |
| `stale` | 情况已经变化，请重新查看 |
| `busy` | 正在进行其他动作 |
| `threat` | 附近有敌人，无法专心工作 |
| `distance` | 距离太远 |
| `tool` | 缺少可用的工具 |
| `input` | 材料不足 |
| `capacity` | 背包空间不足 |
| `resource_empty` | 这里已经采空了 |
| `reserved` | 这里正被占用 |
| `budget` | 已达到数量上限 |
| `blocked` | 那里不能放置 |
| `gate` | 现在不能这样做 |
| `unknown_target` | 看不到目标 |

locale 守卫：每个机械 nameKey/descriptionKey 都存在；所有 `ext.crafting.*` 键都以 `ext.crafting.` 开头（descriptor 校验会拒绝越权键）。

---

## 8 测试要求

### 8.1 测试文件（全部登记在 `test-suites.json`）

`test` 套件：`crafting_schema`、`crafting_data_tables`、`crafting_module`、`crafting_commands`、`crafting_projection`、`crafting_runtime`、`crafting_placement`、`crafting_regen`、`crafting_rejections`、`crafting_work`、`crafting_persistence`、`crafting_combinations`、`crafting_ui`（SFC 用仓库共享 harness）。`drift` 套件：`crafting_trace`。文件名均为 `tests/<名>.test.ts`。除 `crafting_schema/data_tables/module/commands/ui` 的纯单元部分外，**一律走真实 Game**（`createWorldHarness` 或等价的真实 `executeCommand`/录像路径），不 mock 底座。

harness 实际语义（写断言前必读）：被拒的 `ext` 命令也 `recorded:true`（0 成本但录制）；`error` 是“最后一次世界工作错误”，非世界命令不会重置它，接单成功但同命令内被中断时仍为 `null`——判断完成/中断要看事实（`recentFacts`/`worldWorkFacts`）、背包与 `terminalTickets`，不能只看 `error`；`replay()`/`seek()` 会**替换** harness 当前活局（需要继续原局时先 `save()`，或另建 harness）；`world5().tickets` 只含活跃票据，终结票据只在 `terminalTickets`（全 owner 共享最近 64 条摘要）；需要布景（放怪、扣血、填满背包）时测试可用 `worldHarnessGame(h)` 取真实 Game，但被测动作本身必须走公开命令。

### 8.2 必须覆盖的用例

| # | 文件 | 用例 |
| --- | --- | --- |
| T1 | schema | §5.7 每条规则至少一个拒绝用例；未知键、缺键、非整数、越界、重复 ID、错误前缀、悬空引用、native 作输入、stationTags 不可满足、limits 放松、locale 缺键 |
| T2 | schema | 指纹稳定（两次加载相同）；任一机械数组重排或任一数值变化 → 指纹变化；locale 文本变化 → 指纹不变；native 外观两行与原生显示常量一致 |
| T3 | data_tables | 逐项断言 §5.2–5.6 全部数值/ID/顺序（作为“改数值必须改此测试”的黄金表） |
| T4 | module | descriptor 通过 `validateModuleDescriptors`；`toWorldDefinitionPack` 顺序与内容；state 初值/校验/拒绝；`applyFact` 幂等（含 factId 跳号）、`accepted` 只推进 lastFactId、cancel 工位事实写 interrupted 收据、滚动上限 512/128、饱和、非 crafting 事实忽略、绝不抛异常 |
| T5 | commands | 四种 payload 严格键集与 `v`；成对 null 规则；batchCount 0/17/非整数；未知 recipe/工位；prepare 前后 state、两条 RNG、实体/计划 ID、消息均不变 |
| T6 | projection | `available:false` 路径；have/maxBatch/stationId 选择/source 预告的确定规则；反复投影结果相同且无写入 |
| T7 | runtime | 仅 crafting 新局（新局 D1 开局可能有可见敌人导致 `C5_THREAT`，选种子时排除并记录）：启动收据 granted 且背包恰为 木6/石4/纤维2；load/replay 不补发；满背包时 partial（落地）与全部 skipped；采集 100 tick 得 1；镐→桌（kit 与材料两种来源各一次，且不双扣）→炉；D2 金属需镐、每次耐久 −1、耐久 0 后拒绝；匕首/皮甲 +0 已鉴定无符文、与自然同模板物品 stacksWith 规则一致；新局与任何流程中都不出现 crafting 制造的食物；套件可堆叠 99 并能 save/load |
| T8 | placement | D1 放置 wood/stone/fiber 各 ≤2、hide ≤1、无 metal、无任何 crafting 菌类节点；D2 起有 metal；D21 起无 hide；wood 达 32 后不再放；skip/defer 收据唯一；节点不在楼梯/giants 侧室/其他 interactable 上；放置与启动礼包不推进两条原生 RNG（与同种子 `[]` 模块局比较 D1–D3：地形、怪物种类/位置、原生物品种类/位置逐项相同；实体 ID 数值因节点/礼包占号允许不同，比较时忽略） |
| T9 | regen | wood 每 2000、fiber 每 1000 tick 回 1，满容量不积余；stone/metal/hide 不再生；只读查询不改变节点 revision；离层后返回按 elapsed 物化 |
| T10 | rejections | 合同 §4.3 每组至少一个（箱来源/目标类用例可与 `fixtures:['world-work-basic']` 同局，用 `c5fixture` 的容量 16 箱；其桌 tags 为 `table`，不满足本包配方）：镐耐久 1 时采矿触发 `tool-break` 确认，Yes 采到且耐久 0、No 录制但零成本、陈旧 nodeRevision/inventoryStamp/stationRevision、伪造 actorId 字段、跨层/未见目标、距离、无工具/工具破损、节点空/已预留、满背包、输出无槽、工位每层 16 上限、batch 超限、unsafe 乘法；全部 0 tick/0 料/0 RNG/0 新 ID（但仍各录制一条命令） |
| T11 | work | 多批（5 批）`auto_work`：接单命令内完成第 1 批、此后每条 `auto_step` 完成一批，每批恰一条录制命令、命令后 bundles=0；第 2 批完成后（批间）布景一个可见敌人 → 下一条 `auto_step` 停止，已完成 2 批保留，未开始 3 批 escrow 恰退款一次；执行某批的命令内受伤（布景一个会在该批期间攻击的怪）→ 该批不产出、不扣耐久、剩余全部退款；批间 `cancel-work` 成功（事实 `cancel/interrupted`、reason 记录）；陈旧 `ticketRevision` → `C5_STALE`、他人/不存在票据 → `C5_UNKNOWN_TARGET`；工具中途破损停止续作；退款后背包与预期逐项相等。（“bundle 存活时 cancel-work → `C5_BUSY`”在玩家公开命令下构造不出来，由 foundation 测试覆盖，本包不要求。） |
| T12 | persistence | 在“多批工作批间（autoAction=auto_work、票据 working）/放置后/确认 No 后/取消后/节点部分采空且有再生余数”各存一次档：load 后继续得到与不存档相同的结果；整局录像 replay 首个不一致为 null；seek 到上述各点再续录一致（注意 replay/seek 替换活局，对照组另建 harness）；面板反复打开/关闭/切页签前后 digest 与两 RNG 不变。玩家 bundle 不跨命令存活，不要求“批中存档”。 |
| T13 | combinations | crafting + growth / narrative / combat / giants 各自，及五模块全开：新局、启动礼包、一次采集、一次制作、save/load/replay 成功；combat 动作存活时 craft → `C5_BUSY`；combat 伤害中断批次；giants 侧室内无节点。settlement 若已安装则加“仅 settlement”“crafting+settlement”两行，未安装则该行不存在（不得硬引用 settlement） |
| T14 | ui | `ui/view.ts` 对畸形 DTO fail-closed；四页签渲染；批量步进边界；连点只提交一次；回放只读；seek 清草稿；`presentationBusy` 关闭面板；HUD 只在 activeTicket 时出现 |
| T15 | trace（drift） | 重放 `data/natural-trace.json`：`ext` 命令逐条 `recorded/error` 与 trace 记录一致（被拒也是 `recorded:true`），原生命令逐条核对录制条数增量，终局背包/节点/state/digest 与 trace 末尾一致 |

### 8.3 自然公开命令 trace

dot 选定一个固定种子（normal 模式），**只用公开命令**（原生移动/旅行/下楼 + 四个 crafting 命令 + 确认答案）从新局走完：启动礼包 → D1 采木/石/纤维/皮 → 做镐 → 放桌（材料或套件）→ 放炉 → 做皮甲、床/箱套件 → 带一个桌套件下 D2 → 采 4 金属 → 在 D2 放桌 → 打匕首。若该种子 D1 某节点被 skip，换种子；最多尝试 64 个种子，记录选择过程。trace JSON 字段：`seed`、`mode`、`modules:['crafting']`、`commands:[{action,data,answers?,expect}]`、`final:{inventory,digest}`；`ext:command` 条目的 `expect` 为 harness `ext()` 返回的 `{recorded,error}`，原生命令（含 `auto_step`）条目的 `expect` 为 `{recorded}`（由录制条数增量得出），不写 error（harness 的 error 不被原生命令重置）。T15 回放它。报告写明种子、命令数、总 tick、录像大小。

5A2-S 与 5B 并行；集成时维护者会 rebase 并重跑此 trace、逐字段归因（合同 §11.4）；dot 不需要预留兼容。

---

## 9 门禁

所有命令在仓库根执行，统一 Node 24.19.0、`NODE_OPTIONS=--max-old-space-size=3072`、`--maxWorkers=2`。报告只写实际运行过的命令、退出码、测试数量（passed/skipped/todo/failed）、耗时；未运行的写“未运行”及原因。

### 9.1 开发期（每个里程碑结束时）

| 里程碑 | 内容 | 门禁 |
| --- | --- | --- |
| M1 | 数据包、schema、指纹、locale（T1–T3） | boundary、vue-tsc、crafting 定向测试 |
| M2 | descriptor/module/state/commands（T4、T5） | 同上 + build |
| M3 | 投影、运行期闭环、放置、再生、拒绝（T6–T10） | boundary、vue-tsc、crafting 定向测试 |
| M4 | 多批/中断/取消与持久化（T11、T12） | 同上 |
| M5 | UI（T14）+ 本地浏览器自查 | 同上 + build |
| M6 | 自然 trace 与组合（T13、T15） | 同上 + 受影响的既有测试（若有） |

- boundary = `node scripts/check-module-boundaries.mjs`；vue-tsc = `npx vue-tsc -b`；build = `npm run build`。
- crafting 定向测试 = `npx vitest run src/ext/modules/crafting/tests --maxWorkers=2`（若基线要求经 `scripts/run-test-suite.mjs` 的发现环境，使用其等价定向方式并在报告写明）。
- 开发期不跑完整 `npm test`、全部 `test:ext`、删除矩阵；不跑 `ce:fetch`、`test:full`、`test:gen`。

### 9.2 5B 收尾（全部完成后一次，同一最终候选树）

1. `node scripts/check-module-boundaries.mjs`
2. `npx vue-tsc -b`
3. `npm run build`
4. `npm run test:ext`（全部扩展测试一次，含其他模块与 foundation 的 ext 测试）
5. `npm run test:drift`（一次；含 crafting trace）
6. 组合 smoke：`node scripts/check-module-composition-smoke.mjs --output <仓库外目录>/smoke.json`，覆盖全部已安装模块子集（5 模块 32 个子集），engine + 当次构建浏览器；浏览器不可用时记为 **blocked**，不得记为通过，并另跑 `--engine-only`。**已知基线既有失败**：在 `2d870a2` 不加 crafting 时 engine 段即失败（`SyntaxError: "undefined" is not valid JSON`，脚本第 78 行读取 `recordingOrigin.initial`，而录像来源已是 version 2，无此字段）。dot 不修该脚本：先在干净基线复现一次并在报告记录原文，再记录含 crafting 时是否为同一错误；若同一错误，标“基线既有失败（非 5B 引入）”，不算 5B 失败。
7. 删除（removal 档，两行）：
   - 删 crafting：`NODE_OPTIONS=--max-old-space-size=3072 node scripts/check-module-removal.mjs --profile=removal --retain=combat,giants,growth,narrative --maxWorkers=2 --output=<仓库外目录>`
   - 只留 crafting：同上 `--retain=crafting`
   - 以上参数已在基线副本用 `--plan` 实测接受，且自动发现 crafting（两行矩阵分别 removed=[crafting] 与 removed=[combat,giants,growth,narrative]）。每行内含 composition-smoke 闸门，会遇到第 6 项的基线既有失败：照实记录各闸门结果，其余闸门（boundary/typecheck/build/test:ext）单独给出结论。
8. 浏览器视口验收（§7.3）：1440×900、390×844、320×844 × 普通/沉浸 × 四种地图模式；覆盖长名称、满背包、取消、连点、blur、触摸、旧 ACK 帧与回放；真实设备与模拟分别标注；截图留仓库外，不提交。

**不在 5B 范围**：完整 `npm test`、全量 64 行删除矩阵、5Z 体积/性能（留 5Z）。

---

## 10 交付物与报告格式

### 10.1 `docs/ext/phase5b.report.md`

按以下节序，事实写清，不夸大：

1. **结论**：完成/部分完成；一句话说明仅 crafting 是否可玩完整闭环。
2. **基线与环境**：基线 commit、分支、最终 commit、Node 版本、SDK 文件哈希比对结果。
3. **交付清单**：新增文件列表（全部在允许范围内的声明 + `git diff --stat <BASE>..HEAD` 摘要）。
4. **版本与身份**：module/rules 版本、指纹值、state schema、payload v、worldSdk。
5. **数据一致性**：声明 §5 全部数值逐字照抄（指向 T3）；native 外观取值及来源文件行。
6. **SDK 差异与问题清单**：每条含 合同条款 / 实际行为 / 最小复现（测试名或命令）/ 对 crafting 的影响 / 建议的本地修订。没有则写“无”。
7. **门禁结果表**：§9.1 末次与 §9.2 全部命令、退出码、数量、耗时。
8. **自然 trace 与持久化证据**：种子、命令数、总 tick、录像字节数、replay/seek 结果。
9. **组合与删除**：32 子集与两行删除的结果表。
10. **浏览器与视口**：矩阵结果，真实/模拟分类，已知问题。
11. **自行决定事项**：按 §12 规则作出的全部决定。
12. **未覆盖 / 待本地集成**：例如 5A3 工位邻接回归、5A2-S 集成后 trace 重跑、组合 smoke 基线既有失败修复后的重跑。

### 10.2 `docs/ext/crafting-config.md`

参照 `docs/ext/giants-config.md` 的结构：通用约定与安装、物品/节点/工位/配方/启动礼包/limits 每个字段的类型、范围与含义、校验规则、版本与指纹（改什么会改指纹、旧档如何被拒）、与 foundation 的分工（放置、计时、续作、退款、渲染归 foundation）、三个完整配置例子（新增一种材料+节点、新增一个桌上配方、新增一种工位及其套件），以及作者自检清单。

### 10.3 提交

在 `ext/phase5b` 上按逻辑分提交（例如 data+schema / module+commands / projection+tests / UI / trace+docs），提交信息英文前缀 `feat(crafting): …` / `test(crafting): …` / `docs(ext): …`。先跑完门禁并确认结果，再单独执行推送。

---

## 11 不得修改清单

| 类别 | 内容 |
| --- | --- |
| 共享源码 | `src/engine/**`；`src/ext/*.ts`（runtime/types/descriptor/catalog/world/worldSdk/fingerprint 等）；`src/ext/testing/**`（harness、fixture、骨架）；`src/ext/ui/**`；`src/ui/**`；`src/components/**`；`src/App.vue`；共享 i18n 资源 |
| 其他模块 | `src/ext/modules/{growth,narrative,combat,giants,settlement…}/**` |
| 脚本与配置 | `scripts/**`（含 `test-suites.json`、`u03-state-contract.json`、`recording-digest-contract.json`、发现器、门禁脚本）、`package.json`、lock 文件、`vite.config.*`、`tsconfig*.json` |
| 基线 | 生成基线、黄金 trace、其他模块的 trace 数据 |
| 文档 | 除 `docs/ext/crafting-config.md`、`docs/ext/phase5b.report.md` 外的所有文档（含 README、本任务书、合同） |
| 版本 | `FOUNDATION_PROTOCOL`、whole-run/录像/来源/实体格式号、其他模块的 module/rules/state 版本 |
| 本包决定 | §4 全部版本与身份、§5 全部 ID/数值/顺序/上限、§6.3 payload 形状、§7.4 名称 |

禁止的实现手段：在模块内另建调度器或 WeakMap 动作根；monkeypatch `Game`/runtime；在 `commands[action]` 里实现四个世界命令；直接写 Game 字段；使用 `Math.random`、`Date`、全局 RNG；模块内绘制地图格；新增 window 键盘监听；为让门禁通过而 skip/todo/放宽任何既有测试。

---

## 12 已预先作出的决定与 dot 自主裁决规则

### 12.1 已决定（不再讨论）

1. 模块 id `crafting`，版本 1.0.0，state schema 1，payload v1，`defaultEnabled:false`。
2. §5 全部数据，包括 ItemAmount 顺序、tags、glyph/color、文本键命名、startup instanceKey `crafting.startup`。
3. `materials` 数组承载 material/kit/native 行，`tools` 只承载工具；SDK 包中 materials 在前。
4. state 只做事实历史与计数（§6.4）；工位每层上限由 prepare 检查，每局上限交 foundation 预算。
5. 配方工位自动选择：可达且标签满足的最小 interactableId。
6. UI：模块栏命令 + 懒加载面板（四页签）+ 工作 HUD；放置用八方向选择；确认对话归 foundation。
7. 文案与错误码映射按 §7.4。
8. 5B 不实现箱的创建与套件使用；`sourceContainerId/destinationId` 只在 payload/UI 中支持“有箱时可选”，默认 null。

### 12.2 未写明细节的裁决规则（按顺序适用）

1. 合同文字与基线实际 SDK/骨架示例冲突 → 以基线实际代码为准，报告 SDK 差异节记录。
2. 实际 SDK 缺少本包必需的能力 → 不绕过；把受影响用例写成报告中的“待本地集成”并附复现，继续做其余部分。
3. 纯 UI/代码组织细节 → 自行决定，遵守 §7.3 的可用性要求，列入“自行决定事项”。
4. 数值、ID、版本、文案名称 → 不改；若确实无法满足（例如 schema 上限与 SDK 冲突），保持本包数值，在报告提出修订建议。
5. 测试发现“合同语义 ≠ foundation 实际行为” → 不改 foundation，也不把断言改成迎合错误行为；提交的测试套件中不保留该失败断言（也不用 skip/todo），而是把“期望（合同）/实际/复现步骤”写入报告 SDK 问题清单，由本地修底座后补回。
