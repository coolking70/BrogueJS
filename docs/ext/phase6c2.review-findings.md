# 6C2 独立审查第 1 轮

结论：**需修**。确认 3 项重要问题（P2），未发现阻断级问题。最多两轮中的本轮仅审查，不修改仓库、不 commit。

审查对象：`e27648489953069b9aca4c9cf2b8a5ed5162a372` 之上的全部工作区改动（含新增未跟踪文件）。已读 AGENTS.md、HANDOFF、development、architecture、phase6c.task、冻结 phase6c0-contract 与 phase6c2.report。以冻结合同及本次用户限定为准；浏览器待验、数值平衡、云端性能不作为缺陷。本报告的地面详情问题是独立脚本直接调用投影 API 的异常，不是浏览器验收缺失。

源码身份独立核对：src 1467 文件，按路径排序的 `[{path,sha256}]` 紧凑 JSON 聚合为 `7df67e8b2152cfa3b3d648dc3be7f03ba9e1a95f6f773ae8cff0182e63a9efbe`，与实施报告一致。

## 新问题（仅重要级）

### R1-F1 / P2：地面符文之语的合法 DTO 被自身校验器拒绝

定位：`src/ext/modules/loot/gameView.ts:41–43`、`src/ext/modules/loot/ui/knowledge.ts:89–96`；上游 `src/engine/Items/ItemPresentation.ts:5–9`。

宿主的 floor redaction 只返回 `{rarity}`。新 gameView 虽尝试复制 `socketProjection.sockets`，该字段实际上已被宿主删除；随后新校验器要求任何 runeword DTO 必有 sockets。背包里合法的词丢到地面后，选择该物品调用 `readLootGameView` 就抛 `INVALID_INPUT: item.sockets`，详情无法正常生成。普通有孔白装的地面孔信息同样被裁掉。不能通过放开底材秘密来修复，应让公开孔/序列投影与 floor DTO 合同一致。

复现（合法受控出生物品，后续走真实命令）：

1. seed42 / easy / loot，准备未知的 2 孔 leather_armor 白装及 ka、ul 材料各 1。
2. 经 `h.ext('loot','socket', {v:1,itemId,runeItemId,revision}, [true])` 先 ka 后 ul；实际成为 runeword，背包详情成功。
3. `g.executeItemCommand('drop', item)`，确认物品在当前可见地面。
4. `g.extensionRuntime.projectKnownItem(item,'loot','floor').data` 得到 `{"rarity":"runeword"}`；`readLootGameView(g,item.id,[])` 抛错。

独立复现文件：`/private/tmp/p6c2rev1-floor.mjs`；结果：`/private/tmp/p6c2rev1-floor.log`。在仓库根执行 `node /private/tmp/p6c2rev1-floor.mjs`。输出含 `FORMED runeword`、`onFloor:true`、`visible:true`、`FLOOR_VIEW_ERROR INVALID_INPUT: item.sockets`。

### R1-F2 / P2：新材料掉落绕过 C5 接纳预算及工作输出预留

定位：`src/engine/Core/Game.ts:1339–1345`；已有预算实现 `src/engine/Core/WorldWorkWorld.ts:586–592`。

新 material 分支直接复用原生掉落的 `roots >= 8192` 判断并装配材料，没有应用 C5 的 `countWorldItemRoots + outputReservation.slots + extra <= 7168` 接纳约束。冻结共同合同要求保留 C5/C6 根预算，G2 要求按实际预算接纳；材料不能占用 C5 留出的余量或忽略已预留输出。该问题是新增材料路径遗漏，原生装备的既有 8192 路径无需因此改写。

复现：使用真实死亡入口、受控合法 material proposal 隔离落点和掉率；以不同 ID 的物品填充至 7168 根，留下合法落点。此时 `checkItemBudget(g,1)` 抛 `C5_BUDGET`，但 `g.killMonster(monster)` 仍新增 1 枚 `loot.rune.ka`，根数成为 7169。预期此材料提案正常 `skipped:capacity`，不要将正常无容量改为整次死亡异常回滚。

独立复现文件：`/private/tmp/p6c2rev1-probe.mjs`；结果：`/private/tmp/p6c2rev1-probe.log`。在仓库根执行 `node /private/tmp/p6c2rev1-probe.mjs`。实际：

```json
{"before":7168,"budgetError":"C5_BUDGET","after":7169,"runeDelta":1}
```

此探针验证共享接纳边界，不冒称自然长局达到 7168 根；未声称已经发生存档损坏。

### R1-F3 / P2：单一正权重孔数仍耗实质随机骰

定位：`src/ext/modules/loot/generator.ts:256–260`。

冻结合同 §6.1 明确所有加权选择只有正候选至少 2 个才抽骰，单候选零骰。孔数分支直接 `randomInt(1,sum)`，仅当权重总和恰为 1 才被 CountedLootRandom 的定区间优化消去。因此合法的 `[0,0,100,0,0]` 与 `[0,0,1,0,0]` 都必为 2 孔，前者却额外耗骰。旧向量测试使用 `[1,0,0,0,0]`，未覆盖这个差异。

复现：复制生产 pack，将普通稀有度设为唯一正候选、vault 下限设 normal、移除装备表最低稀有度条件，各基底孔权重设 `[0,0,100,0,0]`。`loadLootPack` 准入成功。对 D1 / standard / vault / dagger 生成并记录 randomInt，得到 2 孔但仍调用 `[1,100]`；预期无调用。见同一 `/private/tmp/p6c2rev1-probe.mjs` 的 `SINGLETON` 输出：

```json
{"sockets":2,"draws":[[1,100]]}
```

影响合法单候选配置下的随机顺序和冻结零骰合同；当前三段生产权重均多候选，此问题不是声称当前生产同版本回放 OOS。建议沿既有 weightedPick 的正候选过滤逻辑处理，不改冻结权重。

## 逐条判定与证据

| 核查项 | 判定 | 代码与独立证据 |
| --- | --- | --- |
| 18 基底、ilvl 三段孔权重 | 通过 | sockets.json；loot_sockets 的冻结表断言、每段 1…100 字面遍历，权重分别 70/20/10/0/0、50/20/20/10/0、40/15/20/15/10；戒指 0 孔。 |
| 孔抽取时机与零骰 | 部分不符：F3 | generator.ts:256，normal 武甲单件末尾；其他 rarity/戒指不进入；普通 normal 无原生目标骰，代码顺序无观测差异。单正权重零骰不符。 |
| 四符文目录、C5 MATERIAL | 通过 | runes.json、index.ts:14；minIlvl=1、weight=100、武/甲均兼容，定值 500/5/500/500，maxStack99、无 moduleData。99+1、消费单枚、箱内拆堆/存读/取回专项通过。 |
| runeDrops 来源、每事件≤1、概率 | 通过（接纳预算见 F2） | generator.ts:141–143、265–277；none/encounterSubject 提前返回，fodder/splitter 排除；仅 kill/encounter。6 行概率 500/1000/1500 与 2500/5000/7500，count=[1,1]；装备之后、金币之前独立材料 bucket，chance 不乘寻宝/精英；字面概率边界及自然拾取链通过。宿主原出生/死亡资格与幂等路径保留。 |
| socket 载荷与合法性 | 通过 | ItemCommands.ts:38–42、62–73 与 loot/commands.ts socket 分支；严格 v/itemId/runeItemId/revision，无收益或 wordId；只包内未装备 quantity1 normal、enhancement0、有空孔、同 owner MATERIAL、类兼容。真实 C5 箱内目标/材料不可直接操作，托管不在背包。 |
| 原子性、成功 100tick/1枚、失败0消费 | 通过 | ItemCommands prepare/commit；密封计划绑定 game/runtime、对象引用、背包序列化 stamp 与装备引用。No、陈旧、重复、满孔、错误ID/owner、容量不足拒绝；后段 commitState 故障全图/双流/ID/时钟恢复。loot_sockets 与 ext_item_commands 实跑通过。 |
| 强化与镶嵌互斥（含 growth/精炼） | 通过 | enhancement.ts:19、36；Game.ts:8076、8136；runtime.ts:1966、1987。空孔允许强化，非空硬否决优先于重定向；enchantment/attribute-points/skill-points 三条 growth 测试通过，模块 limit/preview/apply 亦拒绝正量强化。 |
| 完整序列/类别/孔数、非子串、顺序敏感 | 通过 | sockets.ts 完整 JSON key，schema.ts:386–394 歧义检查，item.ts:47–58 一致性拒绝；反序、错类、4孔前缀/满4孔、重复符文测试通过。 |
| 成词只贡献词行 | 通过 | socketRows 二选一；item.ts:148 投影，余烬仅 2000火抗+20HP，锋芒仅1500命中+1500伤害；未叠加单符文。真实装备 HP 与抗性、known rows 及只读测试通过。 |
| 拆末枚 | 本步未涉及，符合停点 | 无 unsocket 命令/按钮/工位；文案明确本阶段不可取回。属于 C3，不将未实现拆卸列为 C2 缺陷。 |
| 否定、完整鉴定、分解 | 通过 | socket commit 不 deriveNative，保存 enchantment/strengthRequired/isCursed/charges/identified；否定保留词及序列，鉴定独立揭示底材；salvage 有永久损失确认，No 无损、Yes 只返碎片且不返符文。专项实跑通过。 |
| 存读/seek 不重新成词、不重复奖励 | 通过 | 序列权威，runewordId 不落盘；load 严格验证、不修正、不补资源。自然闭环、两词+4孔受控闭环 2049 事件及 0/255/256/257/2047/2048/2049 seek、续录测试通过。 |
| 知识边界、不泄露底材 | 背包/装备通过；地面投影不符 F1 | identityKnown 保留，knownModifiers 中孔/词行已知，trigger 不因空 affixes 自动鉴定；100次只读全图不变。地面裁剪与新 DTO 必填合同冲突，独立真实成词→drop 探针确证。 |
| 版本拒旧与同版本确定性 | 通过（限定证据） | module/rules0.7、pack0.4/schema3、实例v4/state2、foundation18/itemSdk3；world/edible/容器 codec 无差量。v3、错误匹配/超孔/未知 rune/知识矛盾存档拒绝保活局；坏指纹/状态拒绝及当前 save/replay/seek 已实跑。未做旧档迁移。 |
| 模块边界与全移除 | 通过；全移除为证据复核 | 本轮 boundary、测试依赖退出0。物理检查作者 keep-none 副本 src/ext/modules 为空；10个受影响共享文件与候选逐字节一致。其5文件160项、生命周期 requestedScopePassed=true 与真实缺包save/recording拒绝证据均存在。未将 prepared-not-verified 或浏览器 not-run 当完整通过。 |
| 共享补口权限 | 形状/权限通过；接纳预算 F2 | G2严格 native/material 联合，同owner、无混搭、无材料收据、floor/vault禁材料；G3只改owner数据、不授原生字段/RNG写权。allowed 为实现冻结强化互斥的通用硬否决，无 C3/C4、Game新字段、其它模块规则或冻结预算扩展。 |
| 最坏行预算（孔/词） | 通过 | schema.ts:369–394 按 local damage 展开后计数，单符文×4≤24、词≤24；有序列不可强化/成套，故无额外强化/套阈值叠加。独立 budget 探针：孔24与词24行准入并投影，孔32/词28拒绝。四槽按每件≤24再加有限全局cap，未见 C2 新增路径突破256/provider；生产孔最多4行、词2行。 |

## 本轮实际执行

只执行相关测试、boundary、测试依赖、仓外相关探针与只读差异/身份检查；没有执行完整 npm/ext/drift、CE、浏览器、性能、build/types 或重新生成全移除布局。Node v25.2.1。两批 Vitest 串行，每批单 worker，无 skip/todo/unhandled 报告。

1. `npx vitest run`：loot_sockets、loot_socket_journey、loot_b4_growth、loot_enhancement、ext_item_commands、ext_item_drop、ext_generation_checkpoint_differential（均为对应 .test.ts 路径），`--maxWorkers=1 --no-file-parallelism`。**7文件151项通过，exit0**；日志 `/private/tmp/p6c2rev1-tests.log`，212.65s。
2. `npx vitest run`：loot_schema、loot_data、loot_generator_vectors、loot_item、loot_game_sfc、loot_ui_viewmodel、loot_integration、loot_stats_integration、loot_economy（均位于 src/ext/modules/loot/tests/），同选项。**9文件386项通过，exit0**；日志 `/private/tmp/p6c2rev1-tests2.log`，52.28s。
3. `node scripts/check-module-boundaries.mjs` → `Module boundaries and test ownership verified.`，exit0；`node scripts/check-test-dependencies.mjs` → errors=[]，exit0。
4. 三份仓外探针：`p6c2rev1-probe.mjs` 复现 F2/F3；`p6c2rev1-floor.mjs` 复现 F1；`p6c2rev1-budget.mjs` 行预算通过。各自同名 .log 保存输出。Vite boot 日志出现非致命 sandbox websocket EPERM；脚本继续完成并退出0，不把该环境告警计为产品缺陷。
5. `git diff --check e276484` 通过。上述 16 个不同测试文件共 **537 项通过**，不是完整阶段验收通过，亦不能覆盖三个独立反例。

## 既有证据与审查限度

旧测试修改主要为版本、终端孔/材料骰造成的夹具变化；原向量禁用新增目录的布景、快照重录逐叶表、套装自然筹资前提变更均已阅读。未发现通过改断言语义、放宽超时或修改守卫掩盖本轮行为的情形。本轮没有重新搭旧提交做反事实，作者该部分证据归属保持，不冒称独立重跑。已有统计工具 set=NaN 不作为本轮新问题。

全移除证据来源：`/private/tmp/phase6c2/finish-results.json`、`removal-related.log`、`removal-lifecycle.json`、`removal-real-missing.json`。实际副本 `/private/var/folders/2s/dmv643cj5493tlmrh5rfgwxw0000gn/T/brogue-removed-modules-kX7Sk0/candidate`，全部8模块物理不存在，无stub；本轮核查共享候选一致性后沿用作者执行结果。

修复三项后再进行最多第2轮的定向复核。本轮结论：**需修**。
