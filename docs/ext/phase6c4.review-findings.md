# 6C4 独立审查，第 1 轮

结论：**需修**。新发现 1 项重要问题（P2），无已确认阻断级问题。浏览器、数值平衡及正式云端性能按本轮要求排除，不计缺陷。没有修改仓库文件、没有 commit；全部探针和本报告位于 `/private/tmp/`。

审查基线为 `0d2e98a91e238e9c988017e87c7a51fb31569691`，对象为其上全部未提交改动（含新增测试、报告和性能场景脚本）。已读 AGENTS.md、HANDOFF/development/architecture、6C 任务书、C0 合同和 C4 作者报告。按用户指定范围，仅执行相关测试、boundary、测试依赖检查及相关独立探针/性能工具冒烟，未运行完整 npm/ext/drift、构建或组合枚举。

## 新问题

### R1-F1 / P2 重要：part 掉落表没有拒绝同优先级同匹配歧义

位置：`src/ext/modules/loot/schema.ts:421–431`，实际选择路径 `src/ext/modules/loot/generator.ts:101–109`。

冻结合同 §2“新来源表”明确要求“同priority同匹配的歧义拒绝”。新增 part 校验只检查必要字段、重复 partId 和混搭字段；表间只检查 ID 唯一，没有检查匹配歧义。`selectTable` 按 priority 后再按输入数组下标选第一条，使应当拒绝的配置被接纳，掉落结果与实质随机消费量取决于目录排列。

复现（无需改仓库）：

1. 复制 `loadLootPack()` 中的 `loot.drop.part-shale-weaver` 表；保留 priority=100 和完全相同的 match，只将新表 ID 设为 `loot.drop.review-ambiguous`、chanceBp 设为 0。
2. 将新表插到原表前，调用 `loadLootPack(pack)` 与 `buildEffectiveLootCatalog`；两者均成功，未拒绝歧义。
3. 用 depth=10、standard、shale-weaver/leg00、ogre、champion=false 和 `randomInt: lo => lo` 调用 `rollLoot`。
4. 仅交换这两条表的先后顺序，再次验证和抽取。

独立实测：

```json
{"bothSchemasAccepted":true,"samePriority":100,"zeroChanceFirst":{"items":0,"draws":0},"originalFirst":{"items":1,"draws":5}}
```

脚本：`/private/tmp/p6c4rev1.ambiguity.mjs`；日志：`/private/tmp/p6c4rev1.ambiguity.log`；退出 0（脚本断言缺陷行为存在）。复现命令：

```sh
NODE_OPTIONS=--max-old-space-size=3072 /Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /private/tmp/p6c4rev1.ambiguity.mjs
```

影响：当前冻结的两条默认表互不重叠，未观察到默认自然路线 OOS；问题是新来源目录的强制准入合同缺失，不是平衡意见。应在准入阶段拒绝同优先级、同 body/part/depth 匹配的歧义（partIds 按集合语义处理），补明确负例；不要通过重新排序、悄悄挑一条或改冻结合同消除问题。保持旧四来源既有优先级和骰序。

## 逐条判定与证据

| 审查项 | 判定 | 证据与实际范围 |
| --- | --- | --- |
| 可信直接部位破坏与宿主显式授予 | 通过 | `Game.ts:13292` → `resolveBodyMemberHit` → `runtime.ts:965/1058`；退休前捕获成员/接触点/因果。`itemDrops.ts:66` 仅 natural、初始敌对、非复制出生授予原 body 的有限资格；模块 hook 无授予 generation 权限。自然路线和两 body 的真实 damage 回归通过。 |
| 一次性、再生、换形、新临时 ID | 通过 | `consumePart` 在抽概率前移除原部位；失败概率、容量不足也消费。`BodyGroups.ts`/`BodyMemberHealth.ts` 限 generation=0、再生关闭；`itemDrops.ts:134` 对 phase/polymorph/split 清空原核心未用资格但保留墓碑。换形回原形、成员换 ID 不重领测试通过。连锁退休走 `retiredBodyParts`，不补直接事实。 |
| 失格传播与独立来源 | 通过 | 召唤/克隆/split/periodic/scripted 不获 part 资格；核心或成员 ally/clone/rewardless、encounter lost、administrative 负例通过。encounterSubject 本身不排除 part；part 先于致死转移后的 kill 结算。唯一/set 只在实际接纳后写原收据，普通 kill/encounter 不冒领 part 台账。 |
| site 真实入口与延期 | 通过（明确延期） | `worldSdk.LevelRef`/`world5` 只有协议预留；`worldBasics.ts:91` 的 requireDungeon 拒 site，world5 校验仍要求 dungeon。无新 site 生成、按钮或世界地图。generator 拒 site，实例校验拒 site 及混入 depth；siteIlvl=1 既有配置保持。报告没有将协议称为玩法接线完成。 |
| 来源台账、固定配置与随机顺序 | **需修：R1-F1**；其余通过 | 默认两表与 §6 一致：8/4 部位、2500bp、1件、40/35/25、不加金币/材料/kill概率倍率、ilvl +2。字面骰带通过；原 21 条 runic 向量独立逐叶比对只有 data.v 5→6。宿主资格、接纳收据分开且有界；歧义目录准入缺口见上。 |
| 完整事务与多消费者边界 | 通过 | `runtime.ts:987/998/1084`、`Game.ts:580` 补完整原生/runtime/双流/ID/统计会话回滚；新 sources 测试在 roll、settle、observer 三处故障均核对全图和引用。partBroken 深冻结、只读广播，不占 combat.part-break.v1；直接伪造 source=part 在 resolveItemDrop 拒绝。另独立验证 loot+giants+combat 同开真实破坏尝试一次、随后存读成功。 |
| 知识边界 | 通过 | `knowledge.ts:50` 仅非地面、完整鉴定且非幻觉显示通用 partSource；不输出 body/part 秘密。未知、地面、幻觉负例及 100 次纯读全图/双流不变通过，i18n 闭合通过。 |
| 版本拒旧、同版本存读/回放/seek/续录 | 通过（已测范围） | foundation20/itemSdk4、loot0.9.0/pack0.6.0/schema5/实例6/state2；world6/worldSdk2、whole-run7/recording4/origin2保持。自然 seed=3 路线实跑断肢断点、拾取、上下楼、存读续录、完整 replay 与双向 seek，世界/双流/台账相等；旧 foundation 与坏台账拒绝保活局。 |
| 模块边界、缺 giants/全移除 | 通过（限定范围） | boundary 与依赖检查退出0。目录从 `foundation.item-bodies.v1` 获取，`catalog.ts:79` 缺能力 omit 并纳入指纹，`item.ts:49` 拒不在有效表中的 part origin。独立探针验证只开 loot 时不可伪造 part；另在注册表实际去掉 giants、保留 loot 后验证同版本 giants+loot 存档/录像拒绝且全图/双流/allocator不变。作者物理全删副本无8模块，887个剩余src与当前字节一致；核对 boundary/依赖/types/build、4文件94项、真实生命周期及缺包拒绝原始证据。本轮未重复执行删除布局或宣称覆盖其它组合。 |
| 共享补口、最坏行预算 | 通过 | 共享差量限 G6 的目录、事件、接纳、事务和 foundation 台账；无 Game 新字段，无 worldSdk/edibleSdk 或世界schema变化。part 不新增属性行，预算测试结果 weapon=11、armor=8、ring=6，provider=35；原24/256、6随机/8固定/4孔及4KiB/8KiB限制保持。 |
| 云端 A/B 工具本地冒烟 | 通过（工具与证据；非正式性能） | 本轮重跑 selection/AB-policy 负例和 C4 补充场景；三次均12 directBreaks、12 dropAttempts、2 items、26 transactions，100 reads 的 queryTransactions=0，双流一致。核对作者18步冒烟退出0，6流×257事件、0 OOS、hard=pass/status=incomplete、无manifest；15项工具散列与当前相同。pending 6c3→6c4 仅比较，canFreeze明确拒绝，未借用已接受C2预算。 |

## 独立执行与证据

使用 Node `24.19.0`，Vitest 单 worker、禁文件并行、3072MiB；本轮两批相关测试 **14 个不同文件 / 299 项通过，0 fail、0 pending**。两批分别保留结果，未称为一次完整套件全绿：

- 第一批6文件184项：sources(32)、sources_recording(1)、b4_vectors(22)、generator_vectors(27)、item(100)、inert(2)。`/private/tmp/p6c4rev1.tests.json`、`.tests.log`。
- 第二批8文件115项：generation_checkpoint_differential(16)、item_data(20)、item_drop(32)、combat_part_break_runtime(19)、giants2_parts(7)、loot_capabilities(6)、loot_catalog(12)、loot_ui_i18n(3)。`/private/tmp/p6c4rev1.shared-tests.json`、`.shared-tests.log`。
- `node scripts/check-module-boundaries.mjs`、`node scripts/check-test-dependencies.mjs`：退出0；依赖报告 errors=[]。
- `node scripts/test-ext-perf-selection.mjs`、`node scripts/test-ext-perf-ab.mjs`：退出0。
- `node scripts/profile-ext-6c4.mjs /private/tmp/p6c4rev1.scenes.json`：退出0；三次计数和RNG相同。SSR有沙箱 HMR listen EPERM 日志，场景正常完成，不把端口提示计为缺陷。
- `/private/tmp/p6c4rev1.probe.mjs`：只开loot的伪造来源拒绝及loot+giants+combat真实破坏/存读，退出0。
- `/private/tmp/p6c4rev1.absent.mjs`：实际缺giants注册表、part origin拒绝、同版本缺包存档/录像保活局。首次全部断言完成后因审查脚本误调用不存在的 dispose() 退出1，原日志保留；移除该清理调用后复跑，最终日志为 `/private/tmp/p6c4rev1.absent-final.log`。不改生产文件或断言。
- `/private/tmp/p6c4rev1.ambiguity.mjs`：R1-F1复现，退出0。

核对作者 `evidence-index.json` 全部文件散列一致；当前src/dist每个文件与 `final-identities.json` 一致，src散列 `256f74296ad16fd50b2f90e061718e466e61894024d18cfa8fb557f688583018`。作者A/B隔离B与当前src仅自然路线测试文件的调试输出删除不同，所有生产字节一致。冻结合同、CE基线和既有守卫没有因本轮审查修改。

本轮仅要求修复 R1-F1；其它条目在上述静态核查、相关实测和明确标注的作者证据范围内未发现新的重要缺陷。修复后可在第2轮定向复验该准入边界及相邻来源测试，无需据此扩展到浏览器、平衡或云端性能审查。
