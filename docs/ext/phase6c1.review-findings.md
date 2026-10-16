# 6C1 独立审查 R1

结论：**需修**。新增重要问题 1 项（R1-F1），无新增阻断级问题。数值平衡、维护者浏览器验收、云端 A/B 测量均按委托范围排除，不据其尚未执行判缺陷。本轮不修改仓库文件、不 commit；探针和审查证据只写 `/private/tmp`。

审查基线：HEAD `9abb255ec00bd09692646d289f9f2ab3f698dc09`，对象为相对该 HEAD 的全部未提交 6C1 改动。已读 AGENTS.md、HANDOFF/development/architecture、phase6c.task.md、冻结 phase6c0-contract.md 和 phase6c1.report.md。当前 src 共 1460 文件，按作者报告算法独立计算 hash 为 `19d1bb9d82f111a79b2561e79858d0aa056397464314602b606c2e461cb2efda`，与报告一致。

## 新问题（仅重要/阻断）

### R1-F1 — 重要（P2）：目录预算少算武器强化展开行，放行运行时必被拒绝的套装配置

定位：`src/ext/modules/loot/schema.ts:352–355`，尤其 `expanded(piece.rows)+2+rewards>24`。

冻结合同 §2 明确要求目录准入按最坏四槽组合、包含强化展开及全部阈值检查每件 24 行预算，超限在准入拒绝。现在一律预留 `+2`，但 `item.ts:142–144` 的武器强化生成 local-increased damage 和 weapon-enchant 两个草稿，前者在 `statSources.ts:34–40` 展开成 damage-min/max 两行，所以真实强化贡献是 **3 行**。

独立复现（只改变内存中的目录，不修改仓库）：

1. 克隆当前默认 pack，仅将行旅短剑固定行设为 5 行，各自含 `[4,4,4,4,3]` 个原有合法 accuracy modifier，即 19 个固定属性行。沿用已有 ID/i18n/base、每行合法固定 range，保留原 2/3/4 件的 3 条奖励。
2. `loadLootPack(raw)` / `buildEffectiveLootCatalog(...)` 均接受；构造四件合法实例，短剑数字 itemId 最小、enhancement=4，`validateLootItemData` 四件均通过。
3. `lootStatSources.collect` 给短剑展开 **19+3+3=25 行**；原样调用生产 `itemStatPolicy` 抛出 `StatValidationError(reason='budget')`。
4. 同一配置只将短剑 enhancement 改为 0，展开 **22 行**，`itemStatPolicy` 通过。差量明确来自强化展开。

复现命令（仓库根）：`node /private/tmp/p6c1rev1-probe.mjs`。探针：`/private/tmp/p6c1rev1-probe.mjs`；实际输出：`/private/tmp/p6c1rev1.probe.log`。Node 24.19.0 与初次 Node 25 均复现；Vite 的 HMR EPERM 提示不影响断言完成，探针 exit0 表示成功复现上述预算拒绝。

影响：首批冻结的每件单行目录不会触发，但合同允许的目录尺寸被错误接纳，强化/装备后的属性查询撞上宿主预算守卫，不能保证“准入合法即可运行”。这是目录合法性/可扩展框架缺陷，不是数值平衡问题。建议按真实类别和适配展开计算强化行数，补 24 行可接纳、25 行准入拒绝的边界回归；保持宿主 24 行守卫不变。

## 逐项判定与证据

| 核查项 | 判定 | 依据与实测 |
| --- | --- | --- |
| 两套各四件、固定行、2/3/4 奖励数值 | 通过 | `data/sets.json` 与合同 §3 逐项比较；独立字面断言覆盖 8 件、6 奖励，见 `p6c1rev1.catalog.log`。minIlvl=6、weight=100、rowId/类别/单位/值均一致；原八 unique 未扩编。 |
| 目录准入、固定行和强化展开预算 | **需修 R1-F1** | 重复/引用/阈值/range/未知键/收据超限负例通过；但武器强化最坏展开漏 1 行，独立复现如上。 |
| set 掉率与选择顺序 | 通过 | `catalog.ts:69` 以 setId/pieceId 排序；`generator.ts:154–198` 先类别/基底、再 rarity、再合格且未占用件。`rarity.ts` 仅 unique 使用 encounter 额外乘数；set 不使用 bossUniqueBias。3/10/30 与 150/250/300 独立核验，其他 preset 字段与 HEAD 完全一致。 |
| 无候选降 rare、不补抽 | 通过 | `generator.ts:193–198` 直接改 rarity 后走原 rare 流程，无重选基底/重掷 rarity；`random.ts` 单候选/定区间零骰。套装专测覆盖合法单候选 0 骰、已领/错基底/低 ilvl 降 rare。 |
| 每局唯一件与实际接纳收据 | 通过 | `generator.ts` 同批 occupied 防重复；`drops.ts:7–33` 独立 uniqueMask/setMask、只 settle accepted.newUniqueIds，双侧逐项验证；`session.ts:54–59` 拒非法编码和未用高位。自然链分解后 setMask 不变，套装/通用 drop 与 checkpoint 回滚测试通过。 |
| 累计阈值、双戒去重、混套、库存不计 | 通过 | `sets.ts:4–18` 只消费 provider 的装备列表，以不同 pieceId 计数，最小数字 itemId 作锚，所有 count≤件数奖励累计；`statSources.ts:29/50` 不读取库存根。专测覆盖 1→2→3→4→3→2→1、重复戒指、不同戒指、混套及反序；真实四件 move-speed=90、maxHP 基础+35、rarity-find=2000，升容不补血。 |
| knownOnly 不泄露隐藏成员、换装整组重算 | 通过 | `sets.ts:7` 先按 identityKnown 过滤再计数/选锚；`runtime.ts:463` 传入实际 knownOnly 模式；`comparison.ts:58–66` / `gameView.ts:42–43` 只用四槽已知 DTO。专测未知四件的已知 rarity-find=0，隐藏最小 ID 后锚改为已知成员；双戒两列换装丢失 4 件阈值；100 次完整 UI 读取对象图/RNG/ID 不变。 |
| 首次触发只揭该行、完整鉴定/熟悉度 | 通过 | `knowledge.ts:24–27` 对 set 保留 identityKnown，最后一行揭示也不识别身份；`index.ts:33/39` 原生 identified 与模块身份一致；`commands.ts:7` 全鉴定才设 true，`ui/knowledge.ts` 未完整身份时 setId/pieceId 为空。专测及既有真实触发回归验证该路径。 |
| 分解、熟悉度、强化 | 通过（首批目录） | set/runeword 分解基值 20/8、熟悉度 15000/10000；standard ilvl20 set=60、bountiful=45，armor 熟悉度900；set cap=4，首批定值行到顶后无精炼骰。取消/陈旧/CAS/晚提交回滚和实际碎片鉴定沿受控命令；套装损失确认存在，收据不退。预算边界另见 F1。 |
| 版本身份、拒旧与坏数据保活局 | 通过 | module/rules0.6.0、pack0.3.0/schema2、实例v3/state2；foundation17/itemSdk2、world5/schema5/sdk1、whole-run7/recording4/origin2 未越阶段改号。实例缺字段/错身份/旧v、state旧v/非法mask拒绝；宿主原生身份不一致的 save 拒绝且图/RNG不变。 |
| 同版本 save/load/replay/seek/续录 | 通过 | 套装专测自然 seed110 floor D4 壁垒锁甲→拾取/装备/卸装/碎片鉴定/分解→save/load/full replay/seek/续录通过。loot+growth 专测跨256摘要及2048快照、边界 seek 与续录通过。四件阈值用受控场景验证，与自然单件见证分列。 |
| 模块边界与全移除 | 通过（本轮限定范围） | 正常树 boundary/依赖通过。复核作者同一全删副本八目录为空、installed=[]，非模块 src 与当前候选逐字节一致；在该副本独立重跑 boundary、依赖、六份真实 loot/loot-growth/natural save/recording 缺包拒绝，全部通过且活局图/RNG/ID/录像不变。全关生命周期和删除布局5文件160项沿作者日志复核，本轮不重跑 types/build 或新增删除布局。 |
| 共享补口和阶段范围 | 通过 | 宿主生产差量仅 `stats.ts:103` 只读 knownOnly 字段和 `runtime.ts:463` 传值，无活 Item/Game 引用、写/RNG/事务权限扩张，符合 G1 所需保守投影。item/world/edible SDK 哈希与报告一致；stats 新散列已登记。G7 有限身份工具负例通过，未实施 C2–C4、未改守卫/OOS/oracle。 |

## 本轮执行记录

- 首批相关测试：13 文件、598 项，Node25.2.1，`--maxWorkers=2 --configLoader=runner --no-cache`，heap3072MiB。exit1：597通过，自然套装链1项60秒超时；完整日志 `p6c1rev1.tests.log`，不写成全绿。
- 按原时限复核完整 `loot_sets.test.ts`：Node24.19.0、单worker、相同源码/断言，exit0，26项全部通过，测试57.71秒、总61.14秒。日志 `p6c1rev1.sets-serial.log`。不与首批重复累计，不把超时未经证据归因为产品缺陷。
- 补充知识/命令/强化/集成/B4相关测试：Node24.19.0，双worker、相同heap/loader/no-cache选项，6文件139项全部通过，exit0，总78.91秒。文件为 loot_trigger_commits、loot_trigger_settlements、loot_commands_integration、loot_enhancement、loot_integration、loot_b4_runtime；日志 `p6c1rev1.integration.log`。
- `node scripts/check-module-boundaries.mjs`、`node scripts/check-test-dependencies.mjs` 正常树和同一全删副本均 exit0；依赖 errors=[]。对应 `p6c1rev1.boundary.log`、`p6c1rev1.dependencies.log`、`p6c1rev1.removal-boundary.log`、`p6c1rev1.removal-dependencies.log`。
- `node scripts/test-ext-perf-selection.mjs`、`node scripts/test-ext-perf-ab.mjs` 均 exit0；日志 `p6c1rev1.perf-selection.log`、`p6c1rev1.perf-policy.log`。这里只运行工具功能/拒绝负例，未进行性能测量。
- 独立全删缺包探针 exit0：`p6c1rev1-missing.mjs`、`p6c1rev1.removal-missing.log/json`。输入沿作者真实导出的当前版本制品；未篡改 manifest、未用旧身份提前拒绝。
- 原测试前提修订检查：版本/元数据、set=0旧固定骰池前提、set启用后的选项/计数/展示夹具调整与报告一致；未见放宽断言/预算/超时或新增 skip。作者原地单变量反事实日志8文件337项通过，本轮只核对该证据，不回退生产文件重做。
- 未跑完整 npm/ext/drift、CE、全组合、单删/单留、浏览器、正式性能或 build/types。所有本轮相关检查均无仓库写入、无 commit。正式浏览器与云端 A/B 保留维护者职责，不计问题。

修复停点：只需修 R1-F1 的目录准入展开计数并添加对应边界回归，保持冻结首批数值和宿主守卫。若交第2轮，优先核对该修复及其相关回归；本报告不代替维护者发布授权。

首批13文件精确选择：loot_sets、loot_sets_growth、loot_schema、loot_generator_vectors、loot_economy、loot_item、loot_ui_viewmodel、loot_ui_components（均在 src/ext/modules/loot/tests）；ext_stats_runtime、ext_stats_pipeline、ext_item_drop、ext_item_commands、ext_generation_checkpoint_differential（均在 src/test）。均使用 `.test.ts` 后缀。正常树测试未 skip/todo，无 unhandled；首次超时和复核退出码分列保留。

交付前再次计算 src hash 与开审及作者报告一致；仓库源码未变。
