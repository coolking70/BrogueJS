# 6C1 套装闭环报告

**2026-10-17 更新：云端 run 38920592958 性能 pass，硬门禁 pass；6C1 预算已采用，详见文末。下文“性能待云端”是首交付历史，不覆盖本次结果。**

2026-10-16，`ext/phase6`，开工 HEAD `9abb255`。按维护者已冻结的 [C0 合同](phase6c0-contract.md) 实施，冻结数值未调整；未 commit、未进入 C2。性能与浏览器交维护者侧执行，本报告不据本地功能结果宣称 A10 或三档浏览器通过。

## 实现与边界

- `loot/data/sets.json`：行旅者、壁垒各四件，稳定 setId/pieceId、固定行与累计 2/3/4 件奖励；原八件 unique 不扩编。稀有度权重、物等缩放、熟悉度与碎片基表严格沿冻结值。
- 生成按 base/rarity 后筛选合法件；单候选零选择骰，无候选直接降 rare，不重抽稀有度，不应用 unique 的首领偏置。每事件临时占用防重复提案；只有宿主实际接纳的 pieceId 进入独立 `setMask`，分解不退收据。
- 四槽按不同 pieceId 计数；同件双戒只计一件，混套独立累计。每套奖励绑定当前有效成员的最小数字 itemId，仍受装备来源策略、每件 24 行/provider 256 行及 loot cap 约束。目录准入检查固定行、全部阈值及强化展开预算。
- 套装 `identityKnown` 与固定行 known 分离：实际触发只揭该行，最后一行揭示亦不公开身份；完整鉴定/熟悉度揭示身份与公开奖励表。机械包含未知件；knownOnly 先过滤身份再选锚、计数，假设换装重算整组。
- 详情、双戒比较、角色来源显示已知件数与阈值奖励，拾取过滤启用 set；文案在 loot 自有 i18n。缓存有效目录，热查询不重建目录；未新增 Game 字段。
- 固定行沿原强化路径，set cap=4；分解确认包含套装件、按冻结经济结算，不返还收据。存档严格拒绝旧实例/state 和不一致身份，保留现有摘要、快照和回放格式。

最小通用补口为 `StatSourceContext.knownOnly?: boolean`（只读），由 runtime 的实际投影模式传入。缺口是模块必须在发出套装行前按已知成员重新选锚，事后过滤单行不能表达此语义。它不授予活 Item/Game、写权、随机数或事务权限；写集为空，失败沿现有纯 provider 校验。`stats.ts` 字节 hash 因此改变，foundation17/itemSdk2 按冻结版本方案保留。没有改宿主守卫、预算、回滚范围、OOS 或 oracle。

版本：loot module/rules `0.6.0`；pack `0.3.0`/schema2；实例 v3、state2；foundation17/itemSdk2、world schema5/sdk1、whole-run7、recording4、origin2 不变。runeword 只补冻结经济枚举，仍不可掉落，插槽/词/工位/新来源均未实施。

## 验证口径及失败归因

Node v24.19.0；`NODE_OPTIONS=--max-old-space-size=3072`，Vitest 串行批次、`--maxWorkers=2 --configLoader=runner --no-cache`。原始日志在 `/private/tmp/phase6c1-9abb255/`，不提交截图或大原始证据。相关文件清单保存为 `related-final-files.json`：loot 相关规则、UI、命令、增长与生命周期；共享属性/装备/掉落、generation checkpoint 差分及卫生/归属。排除统计平衡普查 `loot_stats.test.ts`，没有跑完整 npm/ext/drift、CE/full/gen、全组合、单删/单留或本地长性能基准。

旧测试修订先做反事实：保留旧测试，只临时回退本次 tracked 生产文件到 HEAD，8 文件 337 项通过（`counterfactual-in-place.log`）；finally 恢复生产字节。另有隔离 HEAD 31 文件 848 项通过供参照，不拿隔离结果替代单变量。旧前提修订如下，未放宽断言语义、预算、超时或容差：

- 手工 v2 实例与 state1 升为本次 v3/state2，按原已知行填写非套装 identityKnown；模块版本、pack hash、文件/本地化条目数跟随目录变化。
- 原 B4 固定骰带显式使用原 set=0 的旧池前提，骰带/抽数/符文数值断言保留；当前含 set 的生成由新专测及自然链覆盖。固定向量只增加 v3 元数据，没有改造原骰结果。
- 旧 schema “正 set 权重非法”前提改为负权重非法；UI 原非法 set 选项改为仍非法的 runeword；过滤键盘覆盖扩为五档。
- 预览黄金用原 first-hit 捕获方法重录：R06 `218/0→192/0`，R12 `707/0→110/0`，R13 `150/0→36/1`，R14 `7/0→75/0`，R16 `39/0→105/0`（seed/index）。新增 set 权重改变类别选择与后续骰消费，未改头或检查点。R06 新基底 splint_mail，行 reinforced2879/warding−366/vital8/plated1。部分揭示仍两行，索引由 0/1 改 0/3，避免原未知值字符串 `+1` 被另一已知 `+15` 包含造成前提碰撞；隐藏信息断言原样保留。17 个 SFC 快照按原 Vitest 捕获更新。
- 新建独立套装展示组件触发既有组件数量守卫，删除新文件并复用原详情/面板组件内布局，未改守卫。
- 新事务故障测试的 spy 最初在对象图快照后安装，导致审计看到测试自身改动；改为先安装 spy 再捕获，保留完整图断言。
- 自然路线早期因避怪往返、不可达升级目标及吸血怪阻塞失败；失败日志保留，路线发现与最终记录命令的自然见证分列，不以手工装配替代自然生成。

## 性能交接

有限身份注册支持 `p0 / 6b4 / 6c1`，拒绝未知/C2 身份、冲突参数、缺任一 classic/all 路线/source/manifest 或 hash 漂移。`check-ext-perf --identity=6c1` 在新预算尚未审核采用时必须失败，不能把空预算当通过。

维护者将候选提交并推到 `ext/phase6` 后，从包含本次工具的 revision dispatch `.github/workflows/ext-perf.yml`：

| 参数 | 值 |
| --- | --- |
| base_ref | `9abb255` |
| head_ref | `ext/phase6` |
| base_identity | `6b4` |
| head_identity | `6c1` |
| rounds | `3` |

A 使用已验 6B4 完整输入与预算；B 在同 runner 以原 `generate-ext-perf.mjs` 从新局生成 classic/all 到 D20、≥500 结算行动，原捕获器验证实际 recordingHash。相同前缀从生产命令、双流、回合/ticks/位置等结果自动求得，不沿用 B4 的 1714 常数；每轮原 observer 再核对 rowsHash、块/回合/ticks/双流。保留 17 项入口计数与三轮稳定性、修订 D6、P0 冻结参考；历史绝对时间仅作参考。

新增 `profile-ext-6c1.mjs` 为受控小场景：最多四件、五个合法候选、10 次 1→2→3→4→3→2→1→2→3→4 切换，每次冷查询及 100 次混套双戒热比较，共三轮；记录缓存计数/事务数、时间与内存，纯读完整图/双流/ID/事务不变，重复计数必须稳定。它不替代完整 all 路线，也不作为自然生成见证。

三轮完整正确性与 D6 通过后，原 freezer 产生候选预算，再独立第四次 B 完整回放和 frozen check；仅输出 suggested manifest，维护者审核后采用，并连同生成的路线/source 固定到注册路径。当前没有伪造或采用 6C1 manifest，**性能待云端验收**。

## 浏览器交接（全部未执行）

维护者用本候选生产构建，记录 source/dist hash、URL、浏览器版本、CSS viewport/DPR、seed/预设/模块和证据路径。三档为 320×568、800×900、1440×900；必要补 1024×768 入口。真实自然链与受控四件场景分别记录，SSR/SFC 通过不代替浏览器结果。

- 新局 loot 推荐 growth；显式单开及重开/取消/忙态；五档过滤保存与回放。
- 未知→单行已知→完整身份：未知套名、件名、奖励激活不泄露；完整后详情显示公开 2/3/4 表与保守已知计数。
- 两套各四件；1/2/3/4 件累计阈值，换下/恢复、混套；同件双戒不重计、不同件计两件；背包/地面/箱内不贡献。
- 双戒两列比较包含整组阈值损益，与角色来源一致；未知成员不计入已知奖励。升 HP 上限不补血，降限钳制。
- 完整鉴定、熟悉度、+4 上限、套装分解确认/取消/CAS；碎片数量准确，分解后不退收据；当前存读/完整回放/seek/续录无 OOS。
- 320：无横溢、长件名/奖励换行、双戒纵排，确认/取消/返回与成本可达、触控目标 ≥44px。800：列表/详情独立滚动，旋转/缩放不提交旧目标。桌面：鼠标和键盘路径、焦点及阈值损益可辨。

C2–C4 项不出现在本步验收清单；本步停在 C1，不声明平衡、移动设备性能、D22+ 或发布验收。

## 本地结果与自然见证

| 最终检查 | 结果 / 原始日志 |
| --- | --- |
| 40 文件相关回归 | exit0，1036 项通过，279.98s；`related-final.log`，显式文件表 `related-final-files.json` |
| 套装专测 | exit0，26 项通过，55.56s；`sets-verified.log`，与上行不重叠 |
| loot+growth 最终类型前提复验 | 该文件 1 项通过；`sets-final.log` 同批自然路线曾失败，不能把该批写成全通过，也不重复累计此 1 项 |
| discovery / boundary / 测试依赖 | 全部 exit0；`gates-final.json`，依赖 errors=[] |
| vue-tsc -b / npm run build | exit0；`types-verified.log` / `build-verified.log`（最后只修正文档注释，再构建核对）。构建保留既有 >500kB chunk 提示 |
| 性能身份/参数/比较器负例 | exit0；`perf-selection-final.log`、`perf-options-verified.log`。原预算计数增长、OOS、语义不稳、1ms 边界、三轮裁决与不足轮次仍拒绝 |

上述最终完整文件运行无 skip/todo/unhandled。开发时 `-t natural set` 的其余 25 项是明确筛选排除，最终 26 项已全部执行；不把筛选排除数记作产品 skip。早期类型检查失败于测试调用 private `findLiveSeizer` 和 harness 不接受 wizard 类型，改为读取公开怪物事实、harness 用 easy；生产自然路线仍经正式 `startNewGame` 使用 wizard。未改变类型守卫。

自然见证：seed=110、bountiful、显式 loot 单开；`loot.piece.bastion.mail` 在 D4 的 floor 生成，setMask=`00000000000000000000000000000004`。实际移动、拾取、装备、卸装、沿途分解换取碎片、完整鉴定、分解目标，最终 D6，续录共 416 事件。前后完整 replay、seek 与 digest 一致；分解保留收据。导出的 `natural-save.json` 保留已鉴定套装实物，`natural-recording.json` 包含整条自然命令链，`natural-witness.json` 为小型摘要。自然装备的 owner JSON 为 351B，当前 loot state 322B，均低于 4096B；这两个实测值不冒称所有未来合法目录的最大值。

四件阈值、混套及重复戒指用合法受控物品装配覆盖，与自然一件见证分列。真实四件机械值独立期望包括 move-speed=90、maxHP 基础+35、rarity-find=2000；未知身份的 knownOnly rarity-find=0；换掉第四件失去 4 件奖励、换掉两戒失去 3/4 件奖励。100 次完整 UI 读取的对象图/双流/ID 不变。分解取消、晚提交故障回滚、实际 60 碎片及碎片鉴定均有真实命令测试。

小场景脚本曾因受控 native 装配漏填必需字段被 `C6_DATA` 拒绝，修工具 fixture，未改宿主验证。局部工具功能验证与正式云端计时分开；本地 Vite SSR 发出 HMR 端口 EPERM 提示但继续完成，未将该提示隐藏或当浏览器通过。正式 A/B、长路线计时和预算冻结未在本地执行。

## 首交付候选身份（R1 修复前）

以下保留首交付及独立审查的基线身份；R1-F1 修复后的当前 src/dist 身份见文末“审查发现处理”。

源码与 dist 聚合 hash 定义：按路径排序的 `[{path,sha256}]` 紧凑 UTF-8 JSON 再 SHA256；源码包含测试及新增未跟踪文件。明细在 `identities-final.json`。未提交候选没有新的 commit SHA。

| 身份 | 值 |
| --- | --- |
| HEAD | `9abb255ec00bd09692646d289f9f2ab3f698dc09` |
| src (1460 文件) | `19d1bb9d82f111a79b2561e79858d0aa056397464314602b606c2e461cb2efda` |
| dist (61 文件) | `05c6fedb32e6c7ce23b8bf94e5915eef85a490d29c27b481a5926789581cf207` |
| loot/data (17 文件) | `25dfed94678c3f68dfa4e73a00e97ff2cdba497f282499cf3e085e25a3d112de` |
| 静态 pack fingerprint | `sha256:25ae08fe56130634da233a7900220f0fdc4a68154f29d563fb75258d5ff3276a` |
| src/ext/itemSdk.ts SHA256 | `b69e33f91ac1a2babc582277b613aec5f3fc1badbde4d751addf12505ebbe9e6` |
| src/ext/worldSdk.ts SHA256 | `297803afb0dd07d40d601644ca2b71349d3373e2d2d3bae3535288be741fa343` |
| src/ext/edibleSdk.ts SHA256 | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` |
| src/ext/stats.ts SHA256 | `c828f7b94f48a40273d7fb5320e3228d89f4ef0fc6d7345f9f16667a78ce3ee8` |
| scripts/ext-perf-6b4-budget.json SHA256 | `c659a3788e4f53aa8ea20e7a050950b3bb39f990f2fd92863a3f7eecc0ea2e38` |
| loot 有效 catalog fingerprint | `sha256:a2722748f946ed84b8dd8b967ede2008b9eaec118e3307498d129d155e0b9e88` |
| loot-growth 有效 catalog fingerprint | `sha256:76a69d23bb658d8bcba7b0303597e639e6879d5015485e7f9a33b05f00620c00` |
| loot rules fingerprint | `sha256:f32f1a81b70ecdd338739a1df703a2c70e9ea89d2d2951c84d310cd5c9188dc1` |

两份有效目录取自候选真实导出会话：standard/loot 单开与 standard/loot+growth，差异由公开能力决定；不是手写全开指纹。完整 manifest/configuration 与逐文件 hash 均在证据 JSON。item/world/edible SDK 入口字节不变，stats 入口差量已说明。没有生成新的云端路线/预算身份。

## 一行全移除

只准备一次 `--profile=removal --retain=none --prepare-only --engine-only`；隔离副本为 `/private/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-4rD2Mr/candidate`。真实删除 combat/crafting/foraging/giants/growth/loot/narrative/settlement 八个模块目录，无类型桩；发现器 installed=[]。末次共享文件与测试依赖表同步到同一副本，没有再准备第二布局。

- boundary、静态依赖、vue-tsc、build 均 exit0。末次边界/依赖/类型日志为 `removal-*-final.log`；构建为 `removal-build.log`。模块自身测试随真实目录删除；`ext_item_stats.test.ts` 声明 required combat，缺包布局不选入。其余直接相关五文件（item_drop、item_commands、stats_pipeline、stats_runtime、generation_checkpoint_differential）160 项全部通过，零 skip/todo/unhandled，`removal-related.log`。
- 仅一次全关引擎生命周期：new/play/save/load/full replay/seek/续录均通过，2 个事件续至 3 个，逐检查点一致。`removal-lifecycle.json` 的 requestedScopePassed=true；browser 明确 not-run，完整 engine-and-browser 的 passed=false，不能改写为浏览器已过。
- 当前候选真实导出的 loot、loot+growth、自然套装三组 save/recording，在缺包副本全部拒绝；每次完整对象图、双流、ID、当前录像保持。输入此前已在正常候选成功 load/replay，没有编辑 manifest、借旧版本提前拒绝。六项结果见 `removal-real-missing.json`；脚本 `/private/tmp/c1-missing-package.mjs`，末次日志 `removal-real-missing-final.log`。生命周期工具自身的合成缺包探针只作附加负例，不冒充这六份真实输入。

原 prepare 清单的 `prepared-not-verified` 仅表示准备器未自动跑全矩阵；上述限定实测由 `finish-results.json` 和补充实际缺包结果提供，未执行完整剩余 ext 或任何单删/单留。

首次失败保留：`old-tests-first.log` exit1（8 文件，78 失败/259 通过）；`related-first.log` exit1（32 文件，44 失败/829 通过，17 快照差异）；归因为前述版本/目录前提、快照及组件守卫。`sets-final-second.log` 自然链 60s 超时，保持时限、改沿途材料路线后 `sets-verified.log` 全部通过。探索种子的直接生成脚本仅用于定位 seed，最终自然见证只使用记录命令，不算自然证据的探索输出不提交。

有界小场景最终工具验证 exit0，`c1-scenes-verified.json` 三轮计数完全稳定：按阈值阶段，每次完整 UI 查询调用 loot collect 32 或 35 次，100 次热查询 3200 或 3500 次，按当次装备展开的 rows 数亦稳定；纯查询事务=0，完整对象图/双流/ID 不变。hypothetical 路径不计 pipeline 普通缓存 hits/misses（此处均0），不把它误报为命中优化。时间/内存保留作工具诊断，正式性能裁决仍只待云端同 runner A/B。

停点：C1 实现与限定本地验收完成；云端 A/B、预算审核采用和三档浏览器待维护者执行。未 commit/push，未启动 C2。

## 审查发现处理 — R1-F1

2026-10-16，依据 [第 1 轮独立审查](phase6c1.review-findings.md) 修复唯一重要问题 R1-F1，已完成作者侧回归，待独立复核。原准入固定预留 `+2`，漏算武器 local-increased damage 展开的第二行，确实会放行 `19 固定 + 3 累计奖励 + 3 强化 = 25` 的配置。

`schema.ts` 现在按基底类别的真实适配结果预留：武器 3 行（damage-min/max、weapon-enchant），护甲 2 行（max-hp、defense），戒指 0 行（固有值及强化走原生 enchant，适配器不再输出）。set 强化上限为 0 时预留 0；上限为正时，即使强化数值为 0，武器/护甲实际输出的行仍计入。固定行和全部累计奖励照常计数，每件上限仍为 24，宿主守卫不变。

同类排查覆盖 loot 生产代码的预算/行数限制及 `projectItemModifiers → lootStatSources → adaptLootModifier` 路径，未发现另一处固定强化行预留。固定行的 local-increased damage 一条展开两条，local-flat damage 的一对仍为两条；两种均补边界回归。`computeStaticDrawBudget` 中的 `+2` 是既有随机抽数预算，未与属性行预算混用，保持不变。

在原 `loot_schema.test.ts` 新增 11 项回归，内存克隆目录生成边界夹具，不修改冻结 JSON。测试通过实际 provider 展开，再调用原生产 `itemStatPolicy`：

| 类别 | 恰好通过的固定行 + 累计奖励 + 强化行 | 准入拒绝 |
| --- | --- | --- |
| 武器 | `18 + 3 + 3 = 24` | 固定行增至 19，总计 25 |
| 护甲 | `19 + 3 + 2 = 24` | 固定行增至 20，总计 25 |
| 左/右戒指（分别作奖励锚） | `21 + 3 + 0 = 24` | 固定行增至 22，总计 25 |
| 三类强化上限 0 | `21 + 3 + 0 = 24` | 固定行增至 22，总计 25 |

其余回归覆盖上述两种局部伤害展开及武器/护甲的零值强化行。先将首批 9 项新回归运行于未修复生产代码：schema 100 项中 8 失败、92 通过（`red.log`，exit1），同时揭出武器少算、戒指及关闭强化时多算；修复后通过，再补 2 项零值回归。既有断言、超时、预算、测试前提均未修改。

本轮证据目录：`/private/tmp/phase6c1-r1-fix/`，退出码汇总 `results.json`。Node 24.19.0，heap 3072 MiB；最终只运行下列限定检查：

| 检查 | 结果 |
| --- | --- |
| 相关测试 | 6 文件 245 项通过，9.38s，exit0；`related-final.log`，无 skip/todo/unhandled |
| `node scripts/check-module-boundaries.mjs` | exit0；`boundary.log` |
| `node scripts/check-test-dependencies.mjs` | exit0，errors=[]；`test-dependencies.log` |
| `node node_modules/vue-tsc/bin/vue-tsc.js -b` | exit0；`types.log` |
| `npm run build`（包含 vue-tsc -b） | exit0；`build.log`，保留既有 >500 kB chunk 提示 |

相关测试命令：

```sh
node node_modules/vitest/vitest.mjs run \
  src/ext/modules/loot/tests/loot_schema.test.ts \
  src/ext/modules/loot/tests/loot_data.test.ts \
  src/ext/modules/loot/tests/loot_catalog.test.ts \
  src/ext/modules/loot/tests/loot_item.test.ts \
  src/ext/modules/loot/tests/loot_enhancement.test.ts \
  src/ext/modules/loot/tests/loot_stats_integration.test.ts \
  --maxWorkers=2 --configLoader=runner --no-cache
```

本轮仅修改 `schema.ts`、`loot_schema.test.ts` 和本报告；逐文件与首交付 source 清单比对确认源码只变前两文件。冻结目录、版本、pack/catalog/rules fingerprint、宿主守卫均未变。沿用前文聚合算法，本轮身份及逐文件清单见 `identities.json`：

| 当前候选身份 | 值 |
| --- | --- |
| HEAD | `9abb255ec00bd09692646d289f9f2ab3f698dc09` |
| src（1460 文件） | `52e4ac6ef50f4f46836110c877842d144b7dfec7aa5a993ff213809b0fc4be50` |
| dist（61 文件） | `a3fb25f35bb1170d7032231d488c167af675797851820ac1bd1183311c9da20c` |
| loot/data（17 文件） | `25dfed94678c3f68dfa4e73a00e97ff2cdba497f282499cf3e085e25a3d112de`（与首交付相同） |

本轮未重跑自然路线、一行全移除、性能或浏览器；前轮自然链超时及复核记录保留，不计入本轮通过数。云端 A/B 参数仍为 base=`9abb255`、head=`ext/phase6`（完整 workflow 参数见前文），三档浏览器清单仍交维护者。未 commit/push，停在 C1。


## 云端性能验收与预算采用（2026-10-17）

[run 38920592958 / attempt 1](https://github.com/coolking70/BrogueJS/actions/runs/38920592958)：`status=pass`、`hard=pass`。原始 artifact 位于 `/private/tmp/perfci-38920592958/ext-perf-38920592958-1/`，依据 `result.json`、`summary.md`、`round-1/2/3` 和 `round-verify`，不是本地重计时结果。

- A：`9abb255ec00bd09692646d289f9f2ab3f698dc09`（6B4）；B/control：`e27648489953069b9aca4c9cf2b8a5ed5162a372`（6C1）。Node v24.21.0，AMD EPYC 9V45，heap 3072 MiB，A/B 的 src 均 clean。
- 三轮 classic/full 2208 事件、all/full 2528 事件，全部零 OOS；17 项入口计数、语义/hash/双流稳定。自动推导 all 同输入/结果前缀为 2528 事件，不沿用历史 1714。
- 修订 D6：classic/full **0/3** 越线，all/full **1/3**，all/prefix **1/3**，均 pass。all/full 第一轮 D20 command max +27.50%、all/prefix 第三轮 objective P99 +32.93% 的单轮越线保留，没有删除样本或调整阈值。
- B 的 classic 与 all 均到 D20、500 次结算行动；all 最大 34 怪、212 地形光源。`C1-bounded-supplement` pass。
- 原 freezer 用 B 前三轮完整数据生成建议预算，随后**独立第四次** B classic/all 完整回放零 OOS，`independent-frozen-check` pass。这一点强于 6B4 只复用校准数据离线检查的限制。

采用 `ext-perf-6c1-budget.suggested.json` 到 [scripts/ext-perf-6c1-budget.json](../../scripts/ext-perf-6c1-budget.json)，全部测量、预算、断言值保持原样，仅附加 `provenance` 记录 run、源码、工具 hash 和限制。建议文件原始 SHA256：`7dd2f1a4940dec92d7cd877b83ac69596e6c98ebed3ede57004764ff401583e7`；落盘含来源版 SHA256：`d2734c8d7c2930d3db0549289e9eb165ff89505c2e95c5db43035b343fb53ab3`。对应 `candidate-artifacts` 的 classic/all `.route.json` 和 `.source.json` 按原字节冻结为 `scripts/perf/ext-6c1-late-{classic,all}.{route,source}.json`，完整录像大于 1 MB，留在外部 artifact。身份注册 `6c1.accepted=true`，缺制品/hash 漂移仍拒绝。

本地用已采用预算对云端 `round-verify/B-{classic,all}-full` 离线复核 exit0，日志 `/private/tmp/phase6-route-fix/c1-frozen-check.log`；这是检查既有独立验证数据，不冒称新的第五次回放。

限制：绝对毫秒值只适用于该云端机器；wizard 全知脚本路线不代表人类游玩或浏览器/移动端；覆盖到 D20，不声称 D22+、居民/结构最大负载或数值平衡。此预算只证明 6C1，不是 6C2 结论。6C2 原失败 run 与修复后的重跑参数见 [6C2 报告](phase6c2.report.md)。
