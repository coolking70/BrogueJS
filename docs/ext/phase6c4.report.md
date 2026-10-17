# 6C4 作者报告

> 性能补录（2026-10-17）见末节：拆分run39028341691三个D6计时gate均pass；原incomplete来自pending C3基线，非工具缺陷。C3采纳后离线冻结C4，明确缺独立第四轮云端验证；浏览器仍待验。下方旧性能待办为历史。

> 6Z后继核对（2026-10-17）：C4已由维护者提交为`07d7c97`；R2独立复验实际7文件294项通过，R1-F1关闭，证据`/private/tmp/p6c4rev2.findings.md`、`.tests.json`与`.integrity.json`，逐文件沿用依据见[6Z报告](phase6z.report.md)。本报告下方R1“待第2轮”等保留当时状态，不重写历史计数。C4云端run39006896716仍待维护者结果采纳；不代表性能/浏览器已通过。

开工分支 `ext/phase6`，基线 `0d2e98a91e238e9c988017e87c7a51fb31569691`。依据任务单 §4.4、冻结 C0 §6/§6.1 实施，不修改冻结合同或既有数值；不 commit、不进入 6Z。6C3 云端 A/B 的结果与本候选分开记录。

## 来源台账与宿主权限

| 来源 | 真实入口 → 可信事实 → 资格/幂等 → 抽取 → 接纳/回滚 → 已知投影 |
| --- | --- |
| part | `Game.applyBodyMemberDamage` → `resolveBodyMemberHit` → `ExtensionRuntime.commitPartBreak` 的直接成员成功提交；退休前捕获原 body、part、generation、接触点、核心及非行政伤害来源 → 自然敌对核心出生时宿主授予原 body 的有限部位集合，按 `(coreId, originalBodyId, partId, 0)` 消费 → 2500bp 概率、固定 count 零骰、原单件流程 → 同事务原接纳及唯一/套装实际接纳收据；异常恢复原生图/引用、runtime、双流、allocator、台账、知识/物化/消息 → 已鉴定物品显示通用部位来源，地面/未知/幻觉不显示 |
| craft | 6C3 的 WorldWork 完成批次路径、票据 ordinal、固定基底与受控提案保持；不转投普通 drop provider |
| site | 搜索 `worldSdk.LevelRef`、`world5`、`worldBasics.requireDungeon` 和 Game/WorldWork 后，只有地点引用协议；无可达地点产出、地点类型目录或 provider。`requireDungeon` 明确拒绝 site。保留无 depth 的 `SiteLootOrigin` 类型与 siteIlvl=1 配置，生成/实例准入拒绝；不建世界地图，不加按钮。**site 玩法接线延期至前置世界任务。** |

`partBroken` 是独立的只读多消费者事实，不占 `combat.part-break.v1` 的单 provider，也不给 hook RNG、奖励或状态写权限。掉落输入只能在可信破坏调用栈内消费；直接构造 `source:'part'` 不获权限。固定 zone 为 body、generation 为 0。普通 kill、encounter 与 part 各自使用原资格/收据。

`appliedBreaks` 仍记录当前模型破坏。切换至另一 body 会重建该集合，因此新增 `foundation.itemDrops.parts`：每个自然核心最多一条原 body 记录，保存尚未消费的规范部位 ID；空集合留到核心终结/GC，禁止重新授予。临时成员 ID 不参与资格；原核心/原 body 的出生墓碑保持。现有换形事实没有认证的一一部位映射，因此 phase/polymorph/split 保守清空尚未使用的资格，另一 body、返回原 body 及后代均不获新资格。再生仍关闭，今后新 generation 必须另由宿主生命周期显式授予。该字段仅在 part provider 存在时出现，最多 32768 核心、每条不超过已注册 body 的有限非核心部位；非活根随既有 GC 清理，无无限事件历史。

自然出生以 `creationReason='natural'`、出生敌对、非复制为准；召唤/克隆/split/periodic/scripted 不授予。当前盟友、克隆、无奖励标记、encounter 失格会取消资格；行政因果不抽取。chance 失败、无落点、容量不足也消费资格；唯一/套装仅实际接纳才记获得收据。核心同次转移伤害致死时，part 在 finishBodyMemberDamage 的终结奖励前提交；连锁退休不发新事实。

## 冻结内容、确定性与预算

`dropTables` schema 2 仅新增两条表：shale-weaver 的 leg00…leg07，copper-tendril 的 limb00…limb03；priority=100，chance=2500bp，count=[1,1]，类别权重 40/35/25，rarityBonus=0、minRarity=null、ilvlBonus=0。part 不乘 killDropMultiplier，不加 leader/champion 概率，不开金币或符文材料副表。ilvl 仍按深度×1.5 向下取整、part +2、原怪物类与 champion 加值、1…99 钳制。

通过 `foundation.item-bodies.v1` 读取公开非核心部位目录；缺能力时表不进入有效目录，能力清单进入指纹。没有私引 giants 实现。候选的旧四来源骰带保留原顺序/数值，仅实例身份从 v5 更新到 v6。固定随机区间和单候选不抽骰，每件 64/事件 512 上限保持。

part 不增加装备属性来源行。默认每件最坏行仍 weapon=11、armor=8、ring=6；四槽加最终 cap 的 provider 最坏行=35。原每件24/provider256、六随机/八固定/四孔、4KiB owner/8KiB moduleData、loot state 4KiB 等守卫保持。

## 版本及共享补口

| 身份 | 本候选 |
| --- | --- |
| foundation / itemSdk | 20 / 4 |
| loot module/rules、pack、总包 schema | 0.9.0、0.6.0、5 |
| loot instance / state | 6 / 2 |
| dropTables schema | 2 |
| world schema / worldSdk / crafting | 6 / 2 / 1.1.0（保持） |
| whole-run / recording / origin codec | 7 / 4 / 2（保持） |

G6 补口限于：公开只读 body 目录、DropEvent.part 联合、只读 partBroken hook、Game 的宿主接纳回调及破坏图检查点；持久资格归 foundation 20，不给 Game 加字段，不扩世界 schema。原已有路径不经过新增 part 抽取。原破坏事务值回滚不足以保留对象引用；新增 part 路径补原生/runtime/RNG 对象图捕获及统计会话恢复，生产故障回归核对完整图而非存档投影。

## 验证记录

原始日志与大制品位于 `/private/tmp/phase6c4/`，不提交。关键证据清单 `evidence-index.json` 的 SHA-256 为 `f435d8a6ac07e9e815ede7d09cd12f6b75fcfd738bcb261ce0a769657814050e`。首次误用系统 Node25 的类型诊断保留，正式门禁使用 Node24.19.0、3072MiB、Vitest 单 worker/禁文件并行。

旧测试单变量证据：未改 `loot_b4_vectors` 在基线 22 pass；`loot_data`/`loot_inert`/`loot_ui_i18n` 在基线 16 pass。候选首轮限定 60 文件：56 pass/4 fail，1513 pass/25 fail，无 skip/todo/unhandled；25 项均为身份或新增目录差量。原捕获方法重放 21 条完整骰带，逐区间、骰数、native 校验不变；唯一叶差量为每条 `data.v:5→6`（仓外 `vector-field-delta.json` 逐项登记）。独立 drop 表转录保留旧五表，追加冻结两表；pack/module/schema/hash 断言按新身份更新。

其它旧测试单变量证据：未改测试的 `loot_item` + `loot_generator_vectors`，基线生产 127 pass，候选生产 121 pass/6 fail，仅 v5→v6 实例身份差量。随后只迁当前版本前提，骰带与数值断言保留。性能选择/策略旧负例把未实施 `6c4` 当未知；原脚本在基线通过、加注册后失败，未知身份前提移到未实施 `6c5`，保留缺制品/hash漂移/少轮数/阈值及不能 freeze 的断言。

新增测试早期失败保留：漏登记测试归属；新骰带 rarity 总权重手算误写1182（实际按冻结表1121）；错把运行模式 easy 当 loot 预设；受控场景未推进 GC 导致孤立旧 birth 根读档拒绝；破坏后残留 native action lock 的换形前提。没有因此放宽守卫或改冻结数值。

自然链证据：seed=3、wizard、loot+giants，D5 原生生成铜触须，425 个真实命令事件；断点287后继续，四个直接部位破坏，实际获得 axe/rapier 两件（ilvl9），拾取、上下楼重访、断肢存读档、完整回放与 seek 的世界/双流/收据相等。早期 seed=2 路线未能通过 D6 下楼，保留 `natural-first.log`，改用实际可完成的 seed=3；没有改下降规则或放松断言。受控两 body 场景与这条自然路线分列，未将直接构造怪物称为自然生成。

最终定向复核 `related-final.json`：17 文件、443 pass，0 fail/skip/todo/unhandled（253.21s）。覆盖两类来源、双观察者只读权限、成员盟友失格、换形撤资格、坏表/坏 origin、v6 原骰带/静态目录、默认关闭、i18n、通用 item 接纳/存档、中性战斗差分、generation checkpoint 差分、原 part-break/giants/body actions。首轮 25 项失败全部关闭；不把前后批次拼成一次完整测试通过。其它已通过且未再触达的限定文件不重复跑。

最后移除自然路线测试的 `node:fs` 导入及本机固定路径调试写入，保证 CI 可移植；断言/生产字节未改。该文件单独复跑 1 pass（44.36s），boundary/依赖/vue-tsc 再次 exit 0，证据 `portable-natural.json` 与 `*-portable.log`。没有因去除测试输出重跑不受影响的 build 或全删布局。

正式限定门禁：boundary、测试依赖检查、性能选择/策略负例、`vue-tsc -b`、Vite build 均 exit 0；只保留既有 chunk-size 提示。没有运行 `npm test`、全量 `test:ext`、drift、CE/full/gen 或组合枚举。

唯一一行全移除：通过 `check-module-removal --profile=removal --retain=none --prepare-only --engine-only` 建立隔离副本，按发现器物理删除 8 个模块，随后实际执行 boundary、依赖、vue-tsc、build、四个剩余相关物品文件（94 pass/0 fail/skip）及引擎生命周期。新局/行动/保存/载入/回放/seek/续录通过；foundation20 的真实 loot+giants save/recording 在缺包副本被拒绝，完整图/双流/allocator 不变。887 个剩余 src 文件与最终候选逐字节一致。`all-removed/module-removal-results.json` 仅记准备状态，实际结论见 `all-removed/verified.json`、`gates.json` 和 `lifecycle.json`；不把 prepare-only 或限定测试称为完整 ext 全绿。

SSR 工具在当前沙箱输出 HMR WebSocket `listen EPERM`，日志保留；这些工具使用 SSR 加载，不依赖该端口，捕获/补充场景/全删生命周期均正常结束。未改变冻结 observer 来消除环境日志。

## 审查发现处理：第 1 轮

[独立审查 R1-F1](phase6c4.review-findings.md#r1-f1--p2-重要part-掉落表没有拒绝同优先级同匹配歧义)：**作者已修复，待第 2 轮独立复验**。修复范围仅 `schema.ts`、`loot_schema.test.ts`、`loot_generator_vectors.test.ts` 及本报告；不修改冻结合同、数据、生成器或运行时，不 commit。

`assertLootPack` 在逐表校验后检查表间匹配交集：相同来源/priority、闭区间深度相交（未填即 1…99），且选择条件可同时满足时，抛出 `INVALID_COMBINATION`，路径指向冲突表的 `.match`，错误说明另一张表的位置。part 按 body ID 与部位集合交集判断，部位排列不影响结论；概率为零或奖励内容不同均不能绕过。不同 priority 可重叠，互不相交的匹配仍合法。没有修改选择器的排序/优先级或任何随机消费；检查仅发生在目录准入，256 表最多 32,640 对，每个 part 集合仍受 64 项上限约束。

其它来源排查与处理：

| 来源/表 | 结论 |
| --- | --- |
| kill | 同样缺少表间校验，本次一并补齐。检查 class/monsterId 通配及深度交集；指定 ID 按 `monsterClasses.members/defaultClass` 解析类别，避免误拒绝不可能交叠的 class/ID 组合。 |
| encounter | 同样缺少表间校验，本次一并补齐。formId 通配/同形态与深度交集不能在同优先级竞争。 |
| floor / vault | 生成器不走 `selectTable`，没有当前玩法的表序竞争；声明层仍统一拒绝同优先级相交的 DropTable，不新增选表入口，原转换/固定基底路径保持。 |
| runeDrops / gold | 符文副表原有 `(presetId, source)` 唯一校验；金币为按来源/类别索引的严格对象，均无同类首条命中歧义。本次不改。 |
| craft / site | craft 使用 WorldWork 票据、recipeId 与固定基底，不使用 DropTable；site 仍无真实生成入口，不新增来源表或接线。 |

新增 35 项回归：18 类歧义各在两种表序下拒绝（含零概率遮蔽、部位集合重排/部分相交、闭区间端点、全深度通配、kill 类别/ID/default、encounter 形态以及 floor/vault 声明）；13 类合法边界各在两种表序下准入；3 类合法选表（不同 priority、互斥部位、相邻深度）交换表序及部位顺序后完整结果相同，并逐区间核对固定的 **1 件/5 骰**；另验证恰好 256 条互斥表可准入。修复前定向运行新增组为 17 pass / 18 fail（其余 102 项因名称筛选未运行），18 个拒绝断言均暴露旧缺口；修复后全部通过。

旧测试单变量反事实：未改 V25 原来专测“同 priority 取首条”，新守卫下被拒绝；首次两文件运行 163 pass / 1 fail，唯一失败即 V25。保持测试不变，仅将本次生产 `schema.ts` 回退至送审字节，V25 通过；恢复修复后，把该测试第二张表 priority 从 500 改为 499，移除描述中的 stable ties。所有掉落结果、ilvl、类别及字面骰带断言原样保留；这只是测试前提修正，不改默认表或冻结数值。

本轮仅执行用户指定门禁，Node 24.19.0、3072MiB、Vitest 单 worker/禁文件并行：

| 验证 | 结果 |
| --- | --- |
| 相关测试 | 7 文件 / **294 pass，0 fail/skip/todo/unhandled**；schema 137、catalog 12、data 11、generator_vectors 27、generator_props 53、b4_vectors 22、sources 32；22.59s |
| boundary / 测试依赖检查 | 各 exit 0 |
| `vue-tsc -b` / Vite build | 各 exit 0；build 仅既有 chunk-size 提示 |
| `git diff --check` | exit 0 |

证据独立存放 `/private/tmp/phase6c4-r1/`：`red.json`、`guard-first.json`、`v25-before.log`、`v25-counterfactual.log`、`related-final.json`、四个门禁日志、`source-delta.json` 与 `final-identities.json`；不覆盖首轮原始证据。`source-delta.json` 对比第 1 轮送审清单，仅列出上述三个 src 文件。冻结数值、pack/rules/有效目录指纹、SDK、版本均保持；本轮没有新增性能身份或路线，没有运行全量测试、全移除、浏览器或性能计时。先前 A/B 冒烟是修复前证据，不据此宣称当前生产字节已通过性能验收；正式云端仍按下节参数使用维护者提交后的最终 SHA。

## 候选字节身份

未提交工作树；src/dist 均逐目录排序递归枚举相对路径，逐文件 SHA-256 后对 JSON 清单求 SHA-256（本轮 `/private/tmp/phase6c4-r1/final-identities.json` 留完整清单）。历史 C0/C3 合同/报告及 CE 生成基线保持。第 1 轮送审 src 为 `256f74296ad16fd50b2f90e061718e466e61894024d18cfa8fb557f688583018`、dist 为 `4f1b53dc1803605fd79f1ca54458f09ef4d1f6805b0243de4ba87f175aa4e55c`；当前修复候选如下。

| 对象 | SHA-256 / 指纹 |
| --- | --- |
| src（R1 修复后） | `6cf83cd238698fb37da0f3f556e1bf1384c33af06733e2fcdeecec179e9ddf65` |
| dist（R1 修复后） | `d6454dee2ea35d4fa3e5201589aad428054f17ef9b61dd3b545cb6ae00aef4d6` |
| itemSdk.ts | `c6073e08177aba37297ac54762acd0e1e49708c9cda5a7cf91a246cf8ee4fbdd` |
| worldSdk.ts | `34695c7a2d845d7de9cb5ea96ed1593ad9269bcda2c7841be2df331a14e5f5ce` |
| edibleSdk.ts | `fc7edee625d48d61affe9f64d7bc9b66d38d23d2b391eb93599d044a8ef3ae0b` |
| types.ts | `4cc537241931b5672db450c11fdfc788aa8299b7efa51e65677b5497d9adb730` |
| descriptor.ts | `44f8a0df44c148ab086405f393b2a190b89c9ecbe4abec3d28b76edae88dbfa9` |
| loot 静态 pack | `sha256:db6af53a8010424f3c3aea431e7a83188d0feb83fa4c5efa2fbdf0e86659e4f0` |
| loot rules | `sha256:745fff0befa6ded14159bc11f21db2257ee778fb4b4b13525613fd786d974f3b` |
| 无能力有效目录 | `sha256:c9f3101f3bd134350f917379987952b4b03d45aab1380f9e8b7b6412d1be163a` |
| loot+giants 有效目录 / standard | `sha256:efda77602a7901840c66ce809c487059a18232d941e887fb530529b8f8b315be` |
| crafting（保持） | `sha256:6c92dced97fb2f6f192be73ceb432c558c826d5bdf0e1de2b0ff2437cdbe2e3a` |

## 性能交接

冒烟隔离 B 全 src 散列为 `4712fd1c19fcd34f4ed3fae9e83f48ba0692c03f734b2cc9ce6354404688ee09`，运行期间保持不变。第 1 轮送审散列相对冒烟仅来自上面的测试输出移除：`portable-test-delta.json` 证明当时所有其它 src 文件逐字节相同（包括全部生产代码、性能实际导入的测试支持代码），dist 未变。此后 R1 修复另改变准入代码及两个测试文件，见审查处理节，未重跑性能。没有修改 B 副本、替换头部或放宽 runner 的首尾漂移检查；正式云端使用提交后的最终 SHA。

新增有限 `6c4` 身份及两 body/12 部位补充场景。6C3 仍未验收时，只允许明确的 6c3→6c4 比较：从干净基线实际生成完整 classic/all 输入，不冒用 C2 预算或宣称 C3 已接受；沿原 observer/比较器/阈值，并禁止在基线待验状态冻结 C4。原 C3 工作流默认选择、observer/比较器及阈值未改。C3 云端关闭并采纳身份后，正式通路仍检查基线预算及独立冻结回放。

本地 `ab-smoke/result.json` 已完成：`rounds=1 / limit=257 / cases=both`，18 步 exit 0、hard=pass；六条 observer 流各257事件、OOS=0，可比前缀的 rowsHash/双流/块数/回合/ticks 一致；候选 src 首尾散列一致。最终 status=incomplete、无 manifest：单轮不足 D6，且 C3 基线尚未接受，禁止冻结。生成了四条完整 D20 路线（每条 D20=500 settled），但本地 observer **只回放短前缀**，没有将其当成完整 D20 计时或正式性能通过。

| 完整生成输入 | 持久录像事件数 | recordingHash |
| --- | --- | --- |
| A classic | 2208 | `2c42da63a126342cdc9cd66dabc5ded85affe17a7e951094d516c490e4254249` |
| A all | 2423 | `5d9af59885faf2e6c7214ba1b1c31e039f86bc2f3e0561a7483c132ca21a4477` |
| B classic | 2208 | `ab901fb175c236a9d0be6e367e2967ffae4905efa3ea99e6dad71b28fd410304` |
| B all | 2423 | `a286a8138625337360e6e6dffcdb0fd08b1933afef11e622520923f2d12d303f` |

生成器过程日志的2207/2417与落盘录像的2208/2423分别登记，不混用。六条实际257事件输入的 hash、17计数、逐块P99、语义/双流及15个控制工具 hash 均在 `ab-smoke/result.json`；toolHashes 按键排序、紧凑 JSON 的 SHA-256 为 `97813c143dc5951b95afe0869ab32f983f4469c120ff26780cac90c0bfd28ed7`。

C4 补充场景三次一致：2 body、12 directBreaks、12 dropAttempts、2 accepted items、26 transactions；100 hot reads 的 queryTransactions=0，双流/allocator/图均零变化。查询及两 body 各自的冷/热破坏耗时、逐次样本和内存留 `ab-smoke/c4-scenes.json`；C1 补充场景亦通过。这里只证明工具/确定性/规模，毫秒数不作性能结论。

云端由维护者提交后运行：

```text
workflow: ext-perf.yml
ref: ext/phase6
base_ref: 0d2e98a91e238e9c988017e87c7a51fb31569691
head_ref: <提交后完整 SHA>
base_identity: 6c3
head_identity: 6c4
rounds: 3
```

参数摘要：`base=0d2e98a`、`head=<提交后 SHA>`、`base_identity=6c3`、`head_identity=6c4`。没有提交，故不能伪填 head SHA。正式性能仍待云端 A/B，本机毫秒数不作为性能通过结论。

## 浏览器三档清单（待维护者）

自动知识/UI 测试不替代浏览器视觉验收；以下均待执行。

| 视口 | 复核项目 | 状态 |
| --- | --- | --- |
| 320×568 | 击破成员→拾取→未知详情→鉴定；来源提示与长词缀换行、无横向溢出、滚动末行可达、孔位及确认按钮触控目标≥44×44px | 待验 |
| 800×900 | 两种 body 的部位拾取、详情/比较切换及独立滚动；未知与幻觉不显示来源秘密，已鉴定仅显示“部位破坏”；无 giants 时无死按钮 | 待验 |
| 1440×900 | 鼠标与键盘均可操作，部位/kill/encounter 来源并存且不重复；跨层返回、保存/载入、回放/seek后数量与属性不变；已有套装/嵌孔/工位 UI 回归 | 待验 |

三档共同确认无 site 产出或入口按钮；展开/比较/滚动不耗时、不鉴定，键盘不穿透地图、Esc逐层返回；忙态不重复提交，load/seek/换局后旧目标清理、回放只读、控制台无新错误；记录实际浏览器、src/dist 身份、操作序列及截图路径。截图和大于1MiB原始制品留仓外。phase6 功能实施到 C4 停止，site 按前置条件延期；不进入 6Z，不自动发布。


## 拆分云端性能正式结论与冻结（2026-10-17）

本节覆盖上文性能待办；浏览器待验不变。完整artifact `/private/tmp/perfci-39028341691/`，run **39028341691**，A=`0d2e98a91e238e9c988017e87c7a51fb31569691`（6c3），B=`07d7c97cdbe3f49ed58ae5137d145fceb02fcfbb`（6c4），control=`1094801`。使用原汇总器在新目录逐个核验三个shard的输入、轮次、runner、工具hash、逐域/状态/工作计数与C1/C4补充场景：hard pass、原aggregate incomplete精确复现。

**不是汇总工具缺陷。** 当时C3 accepted=false，`pendingPerfBaseline(6c3,6c4)`为真；`canFreeze`据此拒绝，`overallStatus`返回incomplete。runner也因pending跳过独立第4次B回放，merger只在pass分支生成candidate/suggested预算。三轮正式计时、完整D20输入和补充场景齐全，缺的是第四轮及冻结产物。只翻accepted后重跑普通merger仍会因缺第四轮失败；本次未修改或绕松该自动守卫。

| 门禁 | 越线轮数 | D6计时结论 |
| --- | --- | --- |
| classic/full | 0/3 | pass |
| all/full | 1/3（首轮D20 command.max +28.63%） | pass |
| all/prefix | 1/3（末轮round.p99 +33.50%） | pass |

all/full命令P95 **+0.40%／−0.05%／+0.59%**，墙钟 **−0.36%／−0.43%／+0.50%**。两侧classic2208输入/2431块、all2423输入/2549块，完整all可比；相同前缀也为2423。数据只在各shard同runner配对，不比较不同runner绝对时间。

6C3已按本次维护者授权登记已知尾部风险并采纳后，C4的三轮A完整输入/语义与C3预算一致，额外原`ext-perf-budget.mjs check`全部hard pass（跨云端机器只检查确定性/计数，毫秒警告不用于该基线链判定）。**正式计时结论pass，预算按既有离线采纳方式冻结**：原`freeze-split`取B两个case完整第1/2/3轮，不移除样本、不借本机耗时，三轮冻结后校准数据检查均hard pass。新增C4 manifest和两套route/source，经`loadPerfIdentity`核对后accepted=true，provenance标为`offline-passing-timing`并保留原`cloudVerdict=incomplete`。

C4两case均无独立第4次B云端回放，`independentPostFreezeReplay=false`、`independentHeldOutReplay=false`；本次离线采纳不宣称自动全流程或独立复核通过。不覆盖浏览器/真机、D22+、最大居民负载及部位掉落/工位/craft压力性能；C4受控补充场景仅证明功能和有界规模。完整分析见[6Z §5.1](phase6z.report.md#51-拆分云端复核与预算采纳2026-10-17)，hash/逐轮小型证据见[联合证据](evidence/phase6c3-c4-perf-review.json)，原始离线输出在 `/private/tmp/p6-perf-review/`。

本轮限定验证全部exit0：`node scripts/test-ext-perf-selection.mjs`、`node scripts/test-ext-perf-ab.mjs`、`node scripts/test-ext-perf-split.mjs`及`npm run check:test-dependencies`。身份测试随已采纳预算更新；缺产物/hash漂移/轮次/阈值/缺第四轮拒绝断言保留，原pending基线拒绝语义移到隔离的未接受C3注册表夹具继续验证，未放宽守卫。测试在两次诊断回放结束后串行执行。主仓无生产代码修改，因此未跑生产相关测试、boundary、vue-tsc、build或全量门禁。没有commit/push。日志及退出码见[联合证据](evidence/phase6c3-c4-perf-review.json)。
